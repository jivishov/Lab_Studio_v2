import type { ActionDefinition, ActionInteractionSpec, EquipmentInstance, RuntimeActionRequest } from "../../domain/types";
import { benchOperationSpec, type BenchOperationId } from "../../domain/benchOperations";
import { equipmentById } from "../../equipment/catalog";
import { equipment3dEntry } from "../equipment3d/readiness";
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
  /** The tray item itself, when its tile names it (per-item tiles, decided 2026-10-05). */
  instanceId?: string,
  /** The item the step itself names, if any: another of the same kind is only moved, never the step's. */
  expectedInstanceId?: string,
): { kind: "intent"; intent: RuntimeInteractionIntent } | { kind: "freeMove"; request: RuntimeActionRequest } => {
  const item = instanceId ? { sourceInstanceId: instanceId } : {};
  const expectedSource = expected?.sourceDefinitionId ?? expectedActionEquipmentDefinitionId;
  const station = (zone: string) => (zone === "shelf" ? "shelf" : zone === "heating" || zone === "oven" || zone === "drying-oven" ? "oven" : "workbench");
  const matches = !currentNodeCompleted && expected?.type === "dragToZone" && expectedSource === definitionId
    && station(expected.stationId ?? "workbench") === "workbench"
    && (!instanceId || !expectedInstanceId || instanceId === expectedInstanceId);
  if (matches) {
    return {
      kind: "intent",
      intent: { type: "placeIntent", origin, sourceDefinitionId: definitionId, ...item, stationId: expected?.stationId ?? "workbench", x: point.x, y: point.y },
    };
  }
  return {
    kind: "freeMove",
    request: { verb: "place", equipmentDefinitionId: definitionId, ...item, location: "workbench", parameters: { benchMove: true, x: point.x, y: point.y, zIndex: nextZIndex } },
  };
};

/**
 * A solid transfer done with a tool (decided 2026-09-25): the step moves a solid from its source
 * to its target (`pourInto`) and binds a `solid-transfer-tool`, as `atom.transfer.solid-portion`
 * allows. The learner carries the tool, dips it into the source, and releases it over the target;
 * the runtime records the same source-to-target transfer, so nothing new is committed. Tipping
 * the source itself onto the target is refused. Undefined for any other step.
 */
export interface ToolTransfer {
  toolDefinitionId: string;
  sourceInstanceId: string;
  sourceDefinitionId: string;
  targetDefinitionId: string;
}

export const toolTransferFor = (
  action: ActionDefinition | undefined,
  interaction: ActionInteractionSpec | undefined,
  instances: readonly EquipmentInstance[],
  nodeCompleted: boolean,
): ToolTransfer | undefined => {
  const tool = action?.equipmentRoleBindings?.["solid-transfer-tool"];
  if (!action || !tool || nodeCompleted || interaction?.type !== "pourInto" || !interaction.sourceDefinitionId || !interaction.targetDefinitionId) {
    return undefined;
  }
  const namedSource = typeof action.parameters.sourceInstanceId === "string" ? action.parameters.sourceInstanceId : undefined;
  const source = instances.find((instance) => (namedSource ? instance.id === namedSource : instance.definitionId === interaction.sourceDefinitionId));
  if (!source || source.contents.kind !== "solid") return undefined;
  return { toolDefinitionId: tool, sourceInstanceId: source.id, sourceDefinitionId: source.definitionId, targetDefinitionId: interaction.targetDefinitionId };
};

export type ToolRelease =
  | { kind: "transfer"; intent: RuntimeInteractionIntent }
  | { kind: "useTool" }
  | { kind: "none" };

/**
 * A release during a tool transfer. The loaded tool over the target sends the step's own pour
 * (source to target), exactly the intent the source's drag would have sent; the source released
 * over the target is refused in favour of the tool; anything else falls through to the ordinary
 * release (a tool set down unloaded is a free move).
 */
export const resolveToolRelease = (
  tool: ToolTransfer,
  carried: { definitionId: string; loaded: boolean },
  overlap: BenchOverlapResult,
  origin: ReleaseOrigin,
): ToolRelease => {
  const overTarget = overlap.kind === "valid" && overlap.target?.definitionId === tool.targetDefinitionId ? overlap.target : undefined;
  if (carried.definitionId === tool.toolDefinitionId && carried.loaded && overTarget) {
    return {
      kind: "transfer",
      intent: {
        type: "pourIntent",
        origin,
        sourceInstanceId: tool.sourceInstanceId,
        targetInstanceId: overTarget.id,
        sourceDefinitionId: tool.sourceDefinitionId,
        targetDefinitionId: tool.targetDefinitionId,
      } as RuntimeInteractionIntent,
    };
  }
  if (carried.definitionId === tool.sourceDefinitionId && overTarget) return { kind: "useTool" };
  return { kind: "none" };
};

/** Whether a bench point lies within a footprint (a dip into a source's mouth). */
export const pointInFootprint = (footprint: { xMm: number; yMm: number; widthMm: number; depthMm: number }, point: { xMm: number; yMm: number }): boolean =>
  Math.abs(point.xMm - footprint.xMm) <= footprint.widthMm / 2 && Math.abs(point.yMm - footprint.yMm) <= footprint.depthMm / 2;

/**
 * A step done with a pipette (decided 2026-09-26): a `pourInto` whose target is a fillable tool is a
 * draw (the pipette is carried to the liquid and draws it up), and one whose source is a fillable
 * tool is a delivery (the pipette is carried to the receiver and emptied into it). The runtime
 * records the step's own pour either way; only which item is carried, and how it is drawn, differ.
 */
export interface PipetteStep {
  kind: "draw" | "deliver";
  toolDefinitionId: string;
  toolInstanceId: string;
  /** The liquid drawn from (draw), or the vessel delivered to (deliver). */
  otherDefinitionId: string;
  otherInstanceId?: string;
}

/** A pipette (a Beral or a graduated pipette): its 3D model is carried upright by its tip. */
export const isFillableTool = (definitionId: string | undefined): boolean => {
  const definition = definitionId ? equipmentById.get(definitionId) : undefined;
  return Boolean(definition && definition.affordances.includes("fillable") && definitionId && equipment3dEntry(definitionId)?.carriedByTip);
};

export const pipetteStepFor = (
  action: ActionDefinition | undefined,
  interaction: ActionInteractionSpec | undefined,
  instances: readonly EquipmentInstance[],
  nodeCompleted: boolean,
): PipetteStep | undefined => {
  if (!action || nodeCompleted || interaction?.type !== "pourInto" || !interaction.sourceDefinitionId || !interaction.targetDefinitionId) return undefined;
  const named = (key: string) => (typeof action.parameters[key] === "string" ? action.parameters[key] as string : undefined);
  const find = (instanceId: string | undefined, definitionId: string) =>
    instances.find((instance) => (instanceId ? instance.id === instanceId : instance.definitionId === definitionId));
  const draw = isFillableTool(interaction.targetDefinitionId);
  if (!draw && !isFillableTool(interaction.sourceDefinitionId)) return undefined;
  const toolDefinitionId = draw ? interaction.targetDefinitionId : interaction.sourceDefinitionId;
  const otherDefinitionId = draw ? interaction.sourceDefinitionId : interaction.targetDefinitionId;
  const tool = find(named(draw ? "targetInstanceId" : "sourceInstanceId"), toolDefinitionId);
  if (!tool) return undefined;
  const other = find(named(draw ? "sourceInstanceId" : "targetInstanceId"), otherDefinitionId);
  return { kind: draw ? "draw" : "deliver", toolDefinitionId, toolInstanceId: tool.id, otherDefinitionId, ...(other ? { otherInstanceId: other.id } : {}) };
};

export type PipetteRelease =
  | { kind: "transfer"; intent: RuntimeInteractionIntent }
  | { kind: "usePipette" }
  | { kind: "none" };

/**
 * A release during a pipette step. The pipette released over the liquid (draw) or the receiver
 * (deliver) sends the step's own pour; the liquid's vessel carried onto the pipette is refused in
 * favour of the pipette; anything else falls through to the ordinary release.
 */
export const resolvePipetteRelease = (
  step: PipetteStep,
  carried: { instanceId: string; definitionId: string },
  overlap: BenchOverlapResult,
  origin: ReleaseOrigin,
): PipetteRelease => {
  const over = overlap.kind === "valid" && overlap.target?.definitionId === step.otherDefinitionId
    && (!step.otherInstanceId || overlap.target.id === step.otherInstanceId) ? overlap.target : undefined;
  if (carried.instanceId === step.toolInstanceId && over) {
    const [sourceInstanceId, targetInstanceId] = step.kind === "draw" ? [over.id, carried.instanceId] : [carried.instanceId, over.id];
    const [sourceDefinitionId, targetDefinitionId] = step.kind === "draw"
      ? [step.otherDefinitionId, step.toolDefinitionId] : [step.toolDefinitionId, step.otherDefinitionId];
    return { kind: "transfer", intent: { type: "pourIntent", origin, sourceInstanceId, targetInstanceId, sourceDefinitionId, targetDefinitionId } as RuntimeInteractionIntent };
  }
  if (step.kind === "draw" && carried.definitionId === step.otherDefinitionId && overlap.target?.id === step.toolInstanceId) return { kind: "usePipette" };
  return { kind: "none" };
};

/**
 * A step that brings a level to a line drop by drop (decided 2026-10-02): a graduated pipette
 * delivering down to a line (`bySource`) or a dropping pipette bringing a flask to its mark. The
 * pipette is held over the vessel; then each drop, a short run of drops, or "at the line" is sent
 * as the step's own drop intents.
 */
export interface MarkStep {
  pipetteInstanceId: string;
  pipetteDefinitionId: string;
  vesselInstanceId: string;
  vesselDefinitionId: string;
  bySource: boolean;
  /** The volume delivered (by source) or the vessel's volume at the mark (by target), in mL. */
  goalMl: number;
}

export const markStepFor = (
  action: ActionDefinition | undefined,
  interaction: ActionInteractionSpec | undefined,
  instances: readonly EquipmentInstance[],
  nodeCompleted: boolean,
): MarkStep | undefined => {
  if (!action || nodeCompleted || interaction?.type !== "dispenseDrops" || typeof action.parameters.markDispense !== "string") return undefined;
  const named = (key: string) => (typeof action.parameters[key] === "string" ? action.parameters[key] as string : undefined);
  const pipette = instances.find((instance) => instance.id === named("sourceInstanceId"))
    ?? instances.find((instance) => instance.definitionId === interaction.sourceDefinitionId);
  const vessel = instances.find((instance) => instance.id === named("targetInstanceId"))
    ?? instances.find((instance) => instance.definitionId === interaction.targetDefinitionId);
  if (!pipette || !vessel) return undefined;
  const bySource = action.parameters.markDispense === "source";
  const goalMl = Number(action.parameters[bySource ? "deliverMl" : "markVolumeMl"]);
  if (!Number.isFinite(goalMl)) return undefined;
  return { pipetteInstanceId: pipette.id, pipetteDefinitionId: pipette.definitionId, vesselInstanceId: vessel.id,
    vesselDefinitionId: vessel.definitionId, bySource, goalMl };
};

/**
 * A step done as a bench operation (Pack 2, decided 2026-10-05; `src/domain/benchOperations.ts`): what
 * it is done to, what it is done with, and the time it states for the fast step clock (decision 9).
 */
export interface BenchOpStep {
  operation: BenchOperationId;
  /** The step card's button, and what a click on the vessel or a hand gesture does. */
  control: string;
  vesselInstanceId?: string;
  /** The item it is done with: the dropping pipette of the drop test. */
  toolInstanceId?: string;
  /** Minutes the step states (stirring, settling), shown on the step clock. */
  minutes?: number;
}

export const benchOpStepFor = (action: ActionDefinition | undefined, nodeCompleted: boolean): BenchOpStep | undefined => {
  const operation = action?.parameters.benchOperation;
  const spec = benchOperationSpec(operation);
  if (!action || !spec || nodeCompleted) return undefined;
  const text = (key: string) => (typeof action.parameters[key] === "string" ? action.parameters[key] as string : undefined);
  const minutes = [action.parameters.stirMinutes, action.parameters.settleMinutes].find((value): value is number => typeof value === "number");
  return {
    operation: operation as BenchOperationId,
    control: spec.control,
    ...(text("vesselInstanceId") ? { vesselInstanceId: text("vesselInstanceId") } : {}),
    ...(text("sourceInstanceId") ? { toolInstanceId: text("sourceInstanceId") } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
  };
};

/** How long the fast step clock takes to show `minutes` (decision 9: minutes run in a few seconds). */
export const stepClockSeconds = (minutes: number): number => Math.min(8, Math.max(3, minutes * 1.5));
