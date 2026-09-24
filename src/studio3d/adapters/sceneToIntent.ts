import type { ActionDefinition, ActionInteractionSpec, EquipmentInstance, RuntimeActionRequest } from "../../domain/types";
import { getBenchSize } from "../../equipment/visualCatalog";
import type { BenchOverlapResult } from "../../player/benchOverlap";
import { snapPointAligningSourceAnchor } from "../../player/benchTargeting";
import type { ActionInputField, ActionInputResolution } from "../../runtime/actionInputs";
import type { InteractionInvalidFeedback, RuntimeInteractionIntent } from "../../runtime/interactionIntents";

/**
 * Gestures on the 3D bench -> what the 2D player would send (plan §4.5; handoff §5.6). Pure: the
 * caller resolves and commits, and nothing is committed while a drag is in progress (G-5).
 *
 * A release resolves in exactly the 2D order (`Workbench.finishMove`):
 *   1. inside the expected drag-to-zone station -> the step's placeIntent;
 *   2. a valid overlap -> the step's interaction intent (snaps use the anchor point);
 *   3. an invalid overlap -> a refusal, which the caller shows and records as an assessment failure;
 *   4. otherwise -> a free move: `place` with `parameters.benchMove`, never an attempt.
 * Probes never free-move. After a completed interaction the source is parked, except after snaps,
 * instrument reads and probes.
 */

export const intentTypeForInteraction: Record<ActionInteractionSpec["type"], RuntimeInteractionIntent["type"]> = {
  dragToZone: "placeIntent",
  snapIntoTarget: "snapIntent",
  pourInto: "pourIntent",
  dispenseDrops: "dispenseDropIntent",
  spotOnto: "spotIntent",
  rinseTarget: "rinseIntent",
  placeInInstrument: "instrumentReadIntent",
  readInstrument: "instrumentReadIntent",
  recordNotebook: "notebookRecordIntent",
  recordTimeSeries: "timeSeriesRecordIntent",
  submitCalculation: "calculationSubmitIntent",
};

/** The step's input merged into an intent, exactly as the 2D `runIntent` does. */
export const mergeActionInput = (
  intent: RuntimeInteractionIntent,
  input: ActionInputResolution & { field?: ActionInputField },
  expectedAction?: ActionDefinition,
): RuntimeInteractionIntent => {
  const configurationParameter = expectedAction?.parameters.configurationParameter;
  const configuredRuntimeParameters =
    input.field?.role === "teacherConfiguration" && typeof configurationParameter === "string" && input.value !== undefined
      ? { [configurationParameter]: input.value }
      : undefined;
  if (!input.field || !input.valid) return intent;
  return {
    ...intent,
    value: input.value ?? intent.value,
    note: input.note ?? intent.note,
    configurationApproved: input.field.role === "teacherConfiguration" || intent.configurationApproved,
    runtimeParameters: { ...intent.runtimeParameters, ...configuredRuntimeParameters },
  } as RuntimeInteractionIntent;
};

export type CarriedKind = "item" | "probe";

export interface ReleaseContext {
  expectedInteraction?: ActionInteractionSpec;
  expectedActionId?: string;
  currentNodeId: string;
  /** The current node's retry feedback, used when the interaction names no invalid cue. */
  retryFeedback: string;
  carried: { instanceId: string; definitionId: string; label: string; kind: CarriedKind };
  /** The station the release point lies inside, if any ("workbench" for the bench surface). */
  releaseStation?: string;
  overlap: BenchOverlapResult;
  instances: readonly EquipmentInstance[];
  /** Runtime bench units of the release point, and of the target's anchor for snaps. */
  releasePoint: { x: number; y: number };
  snapPoint?: { x: number; y: number };
  nextZIndex: number;
  /**
   * Where the release came from: a bench carry ("pointer", the default) or hand control ("vision"),
   * which the 2D player gives its camera releases (StudentPlayer `origin: "vision"`).
   */
  origin?: ReleaseOrigin;
}

export type ReleaseOrigin = "pointer" | "vision";

export type ReleaseResolution =
  | { kind: "dragToZone"; intent: RuntimeInteractionIntent }
  | { kind: "interaction"; intent: RuntimeInteractionIntent; parkAfter: boolean }
  | { kind: "invalidOverlap"; feedback: InteractionInvalidFeedback }
  | { kind: "freeMove"; request: RuntimeActionRequest }
  | { kind: "none" };

export const benchMoveRequest = (instanceId: string, point: { x: number; y: number }, zIndex: number): RuntimeActionRequest => ({
  verb: "place",
  sourceInstanceId: instanceId,
  location: "workbench",
  parameters: { benchMove: true, x: point.x, y: point.y, zIndex },
});

/** The refusal the 2D player reports for an invalid overlap, word for word (reportInvalidOverlap). */
export const invalidOverlapFeedback = (
  context: Pick<ReleaseContext, "expectedInteraction" | "expectedActionId" | "currentNodeId" | "retryFeedback" | "instances">,
  sourceInstanceId: string,
  targetInstanceId: string,
): InteractionInvalidFeedback => {
  const source = context.instances.find((instance) => instance.id === sourceInstanceId);
  const target = context.instances.find((instance) => instance.id === targetInstanceId);
  const expectedTarget = context.expectedInteraction?.targetDefinitionId
    ?? (context.expectedInteraction?.type === "readInstrument" ? context.expectedInteraction.stationId : undefined);
  const targetMatches = target?.definitionId === expectedTarget;
  return {
    reason: targetMatches ? "incompatibleEquipment" : "invalidTarget",
    message: targetMatches
      ? `${source?.label ?? "That item"} is not the expected source for this step.`
      : `${target?.label ?? "That target"} is not the correct target for this step.`,
    recovery: context.expectedInteraction?.invalidCue ?? context.retryFeedback,
    nodeId: context.currentNodeId,
    ...(context.expectedActionId ? { actionId: context.expectedActionId } : {}),
  };
};

export const resolveRelease = (context: ReleaseContext): ReleaseResolution => {
  const { expectedInteraction: expected, carried, overlap } = context;
  const origin = context.origin ?? "pointer";
  const expectedDragToZone =
    expected?.type === "dragToZone" && expected.sourceDefinitionId === carried.definitionId ? expected.stationId : undefined;
  if (expectedDragToZone && context.releaseStation === expectedDragToZone) {
    return { kind: "dragToZone", intent: { type: "placeIntent", origin, sourceInstanceId: carried.instanceId, stationId: expectedDragToZone } };
  }
  if (overlap.kind === "valid" && overlap.target && expected) {
    const target = context.instances.find((instance) => instance.id === overlap.target!.id);
    const point = expected.type === "snapIntoTarget" && context.snapPoint ? context.snapPoint : context.releasePoint;
    return {
      kind: "interaction",
      intent: {
        type: intentTypeForInteraction[expected.type],
        origin,
        sourceInstanceId: carried.instanceId,
        targetInstanceId: overlap.target.id,
        sourceDefinitionId: carried.definitionId,
        targetDefinitionId: target?.definitionId,
        stationId: target?.definitionId,
        snapZoneId: expected.snapZoneId,
        x: point.x,
        y: point.y,
      } as RuntimeInteractionIntent,
      parkAfter: expected.type !== "snapIntoTarget" && expected.type !== "readInstrument" && carried.kind !== "probe",
    };
  }
  if (overlap.kind === "invalid" && overlap.target) {
    return { kind: "invalidOverlap", feedback: invalidOverlapFeedback(context, carried.instanceId, overlap.target.id) };
  }
  if (carried.kind === "probe") return { kind: "none" };
  return { kind: "freeMove", request: benchMoveRequest(carried.instanceId, context.releasePoint, context.nextZIndex) };
};

/**
 * Where a snap is sent (Workbench.snapPointForTarget): the runtime point that lines the carried
 * item's snap anchor up with the target zone's anchor, from the 2D shared helper, so both players
 * record the same seat. `target` is in runtime bench units. Without a zone, or without an anchor
 * for it, the target's own point is sent, as in 2D. Never negative.
 */
export const snapReleasePoint = (
  target: { instanceId: string; definitionId: string; x: number; y: number },
  draggedDefinitionId: string,
  snapZoneId?: string,
): { x: number; y: number } => {
  const size = getBenchSize(target.definitionId);
  const aligned = snapZoneId
    ? snapPointAligningSourceAnchor({ id: target.instanceId, definitionId: target.definitionId, x: target.x, y: target.y, width: size.width, height: size.height },
      draggedDefinitionId, snapZoneId)
    : undefined;
  const point = aligned ?? { x: target.x, y: target.y };
  return { x: Math.max(0, point.x), y: Math.max(0, point.y) };
};

/** A tray item dropped on the bench: the step's placeIntent when it expects it, else a free move (placeShelfEquipment). */
export const resolveTrayDrop = (
  expected: ActionInteractionSpec | undefined,
  currentNodeCompleted: boolean,
  expectedActionEquipmentDefinitionId: string | undefined,
  definitionId: string,
  point: { x: number; y: number },
  nextZIndex: number,
  origin: ReleaseOrigin = "pointer",
): { kind: "intent"; intent: RuntimeInteractionIntent } | { kind: "freeMove"; request: RuntimeActionRequest } => {
  const expectedSource = expected?.sourceDefinitionId ?? expectedActionEquipmentDefinitionId;
  const station = (zone: string) => (zone === "shelf" ? "shelf" : zone === "heating" || zone === "oven" || zone === "drying-oven" ? "oven" : "workbench");
  const matches = !currentNodeCompleted && expected?.type === "dragToZone" && expectedSource === definitionId
    && station(expected.stationId ?? "workbench") === "workbench";
  if (matches) {
    return {
      kind: "intent",
      intent: { type: "placeIntent", origin, sourceDefinitionId: definitionId, stationId: expected?.stationId ?? "workbench", x: point.x, y: point.y },
    };
  }
  return {
    kind: "freeMove",
    request: { verb: "place", equipmentDefinitionId: definitionId, location: "workbench", parameters: { benchMove: true, x: point.x, y: point.y, zIndex: nextZIndex } },
  };
};
