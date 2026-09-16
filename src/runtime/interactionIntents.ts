import { resolveActionInteraction } from "../domain/interactions";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  EquipmentInstance,
  EquipmentLocation,
  ProcessNode,
  RuntimeActionRequest,
  RuntimeState,
} from "../domain/types";
import { equipmentById } from "../equipment/catalog";
import { getActions, getProcess, type RuntimeDefinition } from "./createRuntime";
import { actionInputRequestError } from "./actionInputs";
import { closedChamberAccessRefusal, validateActionAttachmentState } from "./attachments";
import { evaluateRule } from "./validation";

type InteractionOrigin = "pointer" | "keyboard" | "programmatic" | "vision";

interface BaseInteractionIntent {
  actionId?: string;
  origin?: InteractionOrigin;
  sourceInstanceId?: string;
  sourceDefinitionId?: string;
  targetInstanceId?: string;
  targetDefinitionId?: string;
  stationId?: string;
  snapZoneId?: string;
  value?: number;
  unit?: string;
  note?: string;
  configurationApproved?: boolean;
  runtimeParameters?: Record<string, string | number | boolean | undefined>;
  x?: number;
  y?: number;
}

export interface PlaceInteractionIntent extends BaseInteractionIntent {
  type: "placeIntent";
}

export interface SnapInteractionIntent extends BaseInteractionIntent {
  type: "snapIntent";
}

export interface PourInteractionIntent extends BaseInteractionIntent {
  type: "pourIntent";
}

export interface DispenseDropInteractionIntent extends BaseInteractionIntent {
  type: "dispenseDropIntent";
}

export interface DispenseCompleteInteractionIntent extends BaseInteractionIntent {
  type: "dispenseCompleteIntent";
}

export interface SpotInteractionIntent extends BaseInteractionIntent {
  type: "spotIntent";
}

export interface RinseInteractionIntent extends BaseInteractionIntent {
  type: "rinseIntent";
}

export interface InstrumentReadInteractionIntent extends BaseInteractionIntent {
  type: "instrumentReadIntent";
}

export interface NotebookRecordInteractionIntent extends BaseInteractionIntent {
  type: "notebookRecordIntent";
}

export interface RecordTimeSeriesInteractionIntent extends BaseInteractionIntent {
  type: "timeSeriesRecordIntent";
}

export interface CalculationSubmitInteractionIntent extends BaseInteractionIntent {
  type: "calculationSubmitIntent";
}

export type RuntimeInteractionIntent =
  | PlaceInteractionIntent
  | SnapInteractionIntent
  | PourInteractionIntent
  | DispenseDropInteractionIntent
  | DispenseCompleteInteractionIntent
  | SpotInteractionIntent
  | RinseInteractionIntent
  | InstrumentReadInteractionIntent
  | NotebookRecordInteractionIntent
  | RecordTimeSeriesInteractionIntent
  | CalculationSubmitInteractionIntent;

export type InteractionInvalidReason =
  | "missingCurrentNode"
  | "missingAction"
  | "wrongSequence"
  | "missingInteraction"
  | "incompatibleIntent"
  | "missingSource"
  | "invalidTarget"
  | "incompatibleEquipment"
  | "overflowRisk"
  | "missingPrerequisite";

export interface InteractionInvalidFeedback {
  reason: InteractionInvalidReason;
  message: string;
  recovery: string;
  nodeId?: string;
  actionId?: string;
}

export type InteractionIntentResult =
  | {
      ok: true;
      request: RuntimeActionRequest;
      action: ActionDefinition;
      interaction: ActionInteractionSpec;
    }
  | {
      ok: false;
      feedback: InteractionInvalidFeedback;
    };

const intentTypesByInteraction: Record<ActionInteractionSpec["type"], RuntimeInteractionIntent["type"][]> = {
  dragToZone: ["placeIntent"],
  snapIntoTarget: ["snapIntent"],
  pourInto: ["pourIntent"],
  dispenseDrops: ["dispenseDropIntent", "dispenseCompleteIntent"],
  spotOnto: ["spotIntent"],
  rinseTarget: ["rinseIntent"],
  placeInInstrument: ["instrumentReadIntent"],
  readInstrument: ["instrumentReadIntent"],
  recordNotebook: ["notebookRecordIntent"],
  recordTimeSeries: ["timeSeriesRecordIntent"],
  submitCalculation: ["calculationSubmitIntent"],
};

const fail = (
  reason: InteractionInvalidReason,
  message: string,
  recovery: string,
  nodeId?: string,
  actionId?: string,
): InteractionIntentResult => ({
  ok: false,
  feedback: { reason, message, recovery, nodeId, actionId },
});

const stringParam = (action: ActionDefinition, key: string): string | undefined => {
  const value = action.parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const numberParam = (action: ActionDefinition, key: string): number | undefined => {
  const value = action.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const getCurrentNode = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): ProcessNode | undefined => getProcess(definition).nodes.find((node) => node.id === state.currentNodeId);

const actionForIntent = (
  definition: RuntimeDefinition,
  state: RuntimeState,
  intent: RuntimeInteractionIntent,
): { action?: ActionDefinition; currentNode?: ProcessNode; wrongSequence?: boolean } => {
  const currentNode = getCurrentNode(definition, state);
  if (!currentNode) return {};

  const actions = getActions(definition);
  const expectedAction = currentNode.actionId
    ? actions.find((candidate) => candidate.id === currentNode.actionId)
    : undefined;
  const requestedAction = intent.actionId
    ? actions.find((candidate) => candidate.id === intent.actionId)
    : expectedAction ??
      actions.find((candidate) => {
        const interaction = resolveActionInteraction(candidate);
        return interaction ? intentTypesByInteraction[interaction.type].includes(intent.type) : false;
      });

  return {
    action: requestedAction,
    currentNode,
    wrongSequence: Boolean(
      intent.actionId &&
        currentNode.actionId &&
        requestedAction &&
        requestedAction.id !== currentNode.actionId,
    ),
  };
};

const firstByDefinition = (
  state: RuntimeState,
  definitionId?: string,
): EquipmentInstance | undefined =>
  definitionId
    ? state.equipmentInstances.find((instance) => instance.definitionId === definitionId)
    : undefined;

const authoredSourceInstanceId = (action: ActionDefinition): string | undefined =>
  stringParam(action, "sourceInstanceId") ??
  (action.verb === "place" ? stringParam(action, "equipmentInstanceId") : undefined);

const authoredTargetInstanceId = (action: ActionDefinition): string | undefined =>
  stringParam(action, "targetInstanceId");

const resolveInstance = (
  state: RuntimeState,
  instanceId: string | undefined,
  requestedDefinitionId: string | undefined,
  expectedDefinitionId: string | undefined,
): { instance?: EquipmentInstance; mismatched?: boolean } => {
  if (instanceId) {
    const instance = state.equipmentInstances.find((candidate) => candidate.id === instanceId);
    if (!instance) return {};
    return {
      instance,
      mismatched: Boolean(expectedDefinitionId && instance.definitionId !== expectedDefinitionId),
    };
  }
  const definitionId = requestedDefinitionId ?? expectedDefinitionId;
  return { instance: firstByDefinition(state, definitionId) };
};

const stationToLocation = (
  interaction: ActionInteractionSpec,
  stationId?: string,
): EquipmentLocation => {
  if (stationId === "shelf") return "shelf";
  if (
    stationId === "heating" ||
    stationId === "oven" ||
    stationId === "drying-oven" ||
    interaction.type === "placeInInstrument"
  ) {
    return "oven";
  }
  if (interaction.type === "snapIntoTarget") return "snapZone";
  return "workbench";
};

const findSnapZone = (
  snapZoneId: string | undefined,
  targetDefinitionId: string | undefined,
) => {
  if (!snapZoneId) return undefined;
  if (targetDefinitionId) {
    return equipmentById.get(targetDefinitionId)?.snapZones.find((zone) => zone.id === snapZoneId);
  }
  for (const definition of equipmentById.values()) {
    const zone = definition.snapZones.find((candidate) => candidate.id === snapZoneId);
    if (zone) return zone;
  }
  return undefined;
};

const requiresSource = (
  interaction: ActionInteractionSpec,
  sourceDefinitionId?: string,
  intentSourceInstanceId?: string,
): boolean =>
  Boolean(sourceDefinitionId || intentSourceInstanceId) ||
  interaction.type === "dragToZone" ||
  interaction.type === "snapIntoTarget" ||
  interaction.type === "spotOnto" ||
  interaction.type === "dispenseDrops" ||
  interaction.type === "placeInInstrument" ||
  interaction.type === "readInstrument";

const requiresTarget = (interaction: ActionInteractionSpec): boolean =>
  interaction.type === "snapIntoTarget" ||
  interaction.type === "pourInto" ||
  interaction.type === "spotOnto" ||
  interaction.type === "dispenseDrops" ||
  interaction.type === "rinseTarget" ||
  interaction.type === "placeInInstrument" ||
  (interaction.type === "readInstrument" && Boolean(interaction.targetDefinitionId));

const preflightPour = (
  action: ActionDefinition,
  state: RuntimeState,
  source: EquipmentInstance | undefined,
  target: EquipmentInstance | undefined,
  value: number | undefined,
  nodeId: string,
): InteractionIntentResult | undefined => {
  if (!source || !target) return undefined;

  const closedTarget = closedChamberAccessRefusal(target);
  if (closedTarget) {
    return fail(
      "invalidTarget",
      closedTarget.message,
      closedTarget.recovery,
      nodeId,
      action.id,
    );
  }
  const currentTargetVolumeMl = target.contents.volumeMl ?? 0;
  const finalVolumeMl = numberParam(action, "finalVolumeMl");
  const targetVolumeMl = numberParam(action, "targetVolumeMl");
  const configuredTopUpVolumeMl =
    action.verb === "measureVolume" && targetVolumeMl !== undefined
      ? Math.max(0, targetVolumeMl - currentTargetVolumeMl)
      : undefined;
  const volumeMl =
    value ??
    numberParam(action, "volumeMl") ??
    configuredTopUpVolumeMl ??
    (action.verb === "dilute" && finalVolumeMl !== undefined
      ? Math.max(0, finalVolumeMl - currentTargetVolumeMl)
      : source.contents.volumeMl ?? 0);
  const sourceDefinition = equipmentById.get(source.definitionId);
  const targetDefinition = equipmentById.get(target.definitionId);
  if (!sourceDefinition?.affordances.includes("pourable")) {
    return fail(
      "incompatibleEquipment",
      "That equipment is not a realistic pour source.",
      "Choose a bottle, cylinder, beaker, or other pourable source for this step.",
      nodeId,
      action.id,
    );
  }
  if (
    targetDefinition?.capacity.unit === "mL" &&
    currentTargetVolumeMl + volumeMl > targetDefinition.capacity.amount
  ) {
    return fail(
      "overflowRisk",
      "That pour would overflow the target container.",
      "Choose a larger target or reduce the transfer volume.",
      nodeId,
      action.id,
    );
  }

  if (
    action.verb !== "dissolve" &&
    action.verb !== "precipitate" &&
    action.verb !== "dilute" &&
    action.verb !== "filter" &&
    (source.contents.kind === "empty" || (source.contents.volumeMl ?? 0) < volumeMl)
  ) {
    return fail(
      "missingSource",
      "The source does not contain enough material for this interaction.",
      "Choose the source that contains the required liquid or mixture.",
      nodeId,
      action.id,
    );
  }

  return undefined;
};

const buildRequest = (
  action: ActionDefinition,
  interaction: ActionInteractionSpec,
  intent: RuntimeInteractionIntent,
  source: EquipmentInstance | undefined,
  target: EquipmentInstance | undefined,
): RuntimeActionRequest => {
  const sourceDefinitionId =
    intent.sourceDefinitionId ??
    interaction.sourceDefinitionId ??
    stringParam(action, "sourceDefinitionId") ??
    stringParam(action, "equipmentDefinitionId");
  const stationId = intent.stationId ?? interaction.stationId;
  const snapZoneId = intent.snapZoneId ?? interaction.snapZoneId ?? stringParam(action, "snapZoneId");
  const dispenseMode =
    intent.type === "dispenseDropIntent"
      ? "drop"
      : intent.type === "dispenseCompleteIntent"
        ? "acceptEndpoint"
        : undefined;
  const defaultValue =
    interaction.type === "dispenseDrops" || action.parameters.copyExistingMeasurementOnly === true
      ? undefined
      : numberParam(action, "volumeMl") ??
        numberParam(action, "expectedMassG") ??
        numberParam(action, "value");
  return {
    actionId: action.id,
    verb: action.verb,
    sourceInstanceId: source?.id,
    targetInstanceId: target?.id,
    equipmentDefinitionId: action.verb === "place" ? sourceDefinitionId : undefined,
    location: action.verb === "place" ? stationToLocation(interaction, stationId) : undefined,
    measurementId: stringParam(action, "measurementId"),
    calculationId: stringParam(action, "calculationId"),
    value: intent.value ?? defaultValue,
    unit: intent.unit ?? stringParam(action, "unit"),
    note: intent.note ?? stringParam(action, "note"),
    parameters: snapZoneId || stationId || dispenseMode || intent.configurationApproved || intent.runtimeParameters || intent.x !== undefined || intent.y !== undefined
      ? {
          ...intent.runtimeParameters,
          snapZoneId,
          stationId,
          dispenseMode,
          configurationApproved: intent.configurationApproved,
          x: intent.x,
          y: intent.y,
        }
      : undefined,
  };
};

export const resolveInteractionIntent = (
  definition: RuntimeDefinition,
  state: RuntimeState,
  intent: RuntimeInteractionIntent,
): InteractionIntentResult => {
  const { action, currentNode, wrongSequence } = actionForIntent(definition, state, intent);
  if (!currentNode) {
    return fail(
      "missingCurrentNode",
      "The current process node is missing.",
      "Reload the lab and try the interaction again.",
    );
  }
  if (!action) {
    return fail(
      "missingAction",
      "No action definition matches this interaction.",
      "Use an interaction configured for the current step.",
      currentNode.id,
    );
  }
  if (wrongSequence) {
    return fail(
      "wrongSequence",
      "That interaction belongs to a different step.",
      currentNode.feedback.retry,
      currentNode.id,
      action.id,
    );
  }

  const interaction = resolveActionInteraction(action);
  if (!interaction) {
    return fail(
      "missingInteraction",
      "The current action does not define or infer an interaction.",
      "Add an interaction spec or use a supported legacy action verb.",
      currentNode.id,
      action.id,
    );
  }

  if (!intentTypesByInteraction[interaction.type].includes(intent.type)) {
    return fail(
      "incompatibleIntent",
      "That interaction type does not match the expected physical operation.",
      interaction.invalidCue ?? action.feedback.invalid,
      currentNode.id,
      action.id,
    );
  }

  const expectedSourceDefinitionId =
    interaction.sourceDefinitionId ??
    stringParam(action, "sourceDefinitionId") ??
    stringParam(action, "equipmentDefinitionId");
  const expectedTargetDefinitionId =
    interaction.targetDefinitionId ?? stringParam(action, "targetDefinitionId");

  const source = resolveInstance(
    state,
    intent.sourceInstanceId ?? authoredSourceInstanceId(action),
    intent.sourceDefinitionId,
    expectedSourceDefinitionId,
  );
  if (source.mismatched) {
    return fail(
      "incompatibleEquipment",
      "The selected source does not match the expected equipment.",
      "Select the source equipment named by the current step.",
      currentNode.id,
      action.id,
    );
  }
  if (requiresSource(interaction, expectedSourceDefinitionId, intent.sourceInstanceId) && !source.instance) {
    return fail(
      "missingSource",
      "The expected source equipment is not available.",
      "Place or select the required source equipment before continuing.",
      currentNode.id,
      action.id,
    );
  }

  const target = resolveInstance(
    state,
    intent.targetInstanceId ?? authoredTargetInstanceId(action),
    intent.targetDefinitionId,
    expectedTargetDefinitionId,
  );
  if (target.mismatched) {
    return fail(
      "invalidTarget",
      "The selected target does not match the expected equipment.",
      "Select the target equipment named by the current step.",
      currentNode.id,
      action.id,
    );
  }
  if (requiresTarget(interaction) && !target.instance) {
    return fail(
      "invalidTarget",
      "The expected target equipment is not available.",
      "Place or select the required target equipment before continuing.",
      currentNode.id,
      action.id,
    );
  }

  const snapZone = findSnapZone(intent.snapZoneId ?? interaction.snapZoneId, expectedTargetDefinitionId);
  if (snapZone && expectedSourceDefinitionId && !snapZone.accepts.includes(expectedSourceDefinitionId)) {
    return fail(
      "incompatibleEquipment",
      "The selected snap zone does not accept that equipment.",
      "Use the highlighted target for the current step.",
      currentNode.id,
      action.id,
    );
  }

  // Dragging a strip into a sealed chamber is refused before a request is built, so the pointer,
  // keyboard and gesture paths all report the closure instead of reaching the reducer with an
  // intent the apparatus cannot accept. The reducer stays the authority; this only reports earlier.
  //
  // Limited to placement, which is what reaching into a vessel means. Development used to snap into
  // the chamber too and had to be excluded here by verb; it now takes the process-control endpoint
  // its physical description always implied, so every snap into a chamber really is an access.
  if (interaction.type === "snapIntoTarget" && action.verb === "place" && target.instance) {
    const closedTarget = closedChamberAccessRefusal(target.instance);
    if (closedTarget) {
      return fail(
        "invalidTarget",
        closedTarget.message,
        closedTarget.recovery,
        currentNode.id,
        action.id,
      );
    }
  }

  const attachmentFailure = validateActionAttachmentState(state, action.parameters);
  if (attachmentFailure) {
    return fail(
      "missingPrerequisite",
      attachmentFailure.message,
      attachmentFailure.recovery,
      currentNode.id,
      action.id,
    );
  }

  const pourFailure =
    interaction.type === "pourInto"
      ? preflightPour(action, state, source.instance, target.instance, intent.value, currentNode.id)
      : undefined;
  if (pourFailure) return pourFailure;

  const request = buildRequest(action, interaction, intent, source.instance, target.instance);
  const inputError = actionInputRequestError(action, request);
  if (inputError) {
    return fail(
      "missingPrerequisite",
      inputError,
      "Enter the requested classroom configuration or student response, then try again.",
      currentNode.id,
      action.id,
    );
  }
  const unmetPrerequisite = action.prerequisites
    .map((rule) => evaluateRule(rule, state, request, currentNode))
    .find((evidence) => !evidence.passed);
  if (unmetPrerequisite) {
    return fail(
      "missingPrerequisite",
      unmetPrerequisite.message,
      action.feedback.invalid,
      currentNode.id,
      action.id,
    );
  }

  return { ok: true, request, action, interaction };
};
