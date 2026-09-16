import { resolveActionInteraction } from "../domain/interactions";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  RuntimeActionRequest,
  RuntimeState,
} from "../domain/types";
import {
  getActions,
  getProcess,
  performRuntimeAction,
  resolveInteractionIntent,
  type InteractionInvalidFeedback,
  type RuntimeDefinition,
  type RuntimeInteractionIntent,
} from "../runtime";

export const GOBLIN_MODE_DEFINITION_ID = "filtration";
export const GOBLIN_MODE_STEP_DELAY_MS = 1350;

type GoblinModeStepResolution =
  | {
      ok: true;
      action: ActionDefinition;
      interaction: ActionInteractionSpec;
      request: RuntimeActionRequest;
    }
  | {
      ok: false;
      feedback: InteractionInvalidFeedback;
    };

export type GoblinModeStepResult =
  | {
      ok: true;
      action: ActionDefinition;
      interaction: ActionInteractionSpec;
      request: RuntimeActionRequest;
      state: RuntimeState;
    }
  | {
      ok: false;
      feedback: InteractionInvalidFeedback;
    };

const unsupportedGoblinFeedback = (
  message: string,
  nodeId?: string,
  actionId?: string,
): InteractionInvalidFeedback => ({
  reason: "incompatibleIntent",
  message,
  recovery: "Turn off Goblin mode and complete this step manually.",
  nodeId,
  actionId,
});

export const isGoblinModeEligible = (
  definition: RuntimeDefinition,
  previewChrome: boolean,
): boolean => !previewChrome && definition.id === GOBLIN_MODE_DEFINITION_ID;

export const isGoblinModeComplete = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): boolean => getProcess(definition).nodes.every((node) => state.completedNodes.includes(node.id));

const activeAction = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): { action?: ActionDefinition; nodeId?: string } => {
  const currentNode = getProcess(definition).nodes.find((node) => node.id === state.currentNodeId);
  const action = currentNode?.actionId
    ? getActions(definition).find((candidate) => candidate.id === currentNode.actionId)
    : undefined;
  return { action, nodeId: currentNode?.id };
};

export const goblinModeIntentForInteraction = (
  action: ActionDefinition,
  interaction: ActionInteractionSpec,
): RuntimeInteractionIntent | undefined => {
  const base = {
    actionId: action.id,
    origin: "programmatic" as const,
    sourceDefinitionId: interaction.sourceDefinitionId,
    targetDefinitionId: interaction.targetDefinitionId,
    stationId: interaction.stationId,
    snapZoneId: interaction.snapZoneId,
  };

  if (interaction.type === "snapIntoTarget") {
    return { ...base, type: "snapIntent" };
  }
  if (interaction.type === "rinseTarget") {
    return { ...base, type: "rinseIntent" };
  }
  if (interaction.type === "pourInto") {
    return { ...base, type: "pourIntent" };
  }
  return undefined;
};

export const resolveGoblinModeStep = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): GoblinModeStepResolution => {
  const { action, nodeId } = activeAction(definition, state);
  if (!action) {
    return {
      ok: false,
      feedback: unsupportedGoblinFeedback(
        "Goblin mode could not find an action for the current step.",
        nodeId,
      ),
    };
  }

  const interaction = resolveActionInteraction(action);
  if (!interaction) {
    return {
      ok: false,
      feedback: unsupportedGoblinFeedback(
        "Goblin mode only handles configured physical lab interactions.",
        nodeId,
        action.id,
      ),
    };
  }

  const intent = goblinModeIntentForInteraction(action, interaction);
  if (!intent) {
    return {
      ok: false,
      feedback: unsupportedGoblinFeedback(
        "Goblin mode does not automate this kind of lab step yet.",
        nodeId,
        action.id,
      ),
    };
  }

  const resolved = resolveInteractionIntent(definition, state, intent);
  if (!resolved.ok) return resolved;

  return {
    ok: true,
    action: resolved.action,
    interaction: resolved.interaction,
    request: resolved.request,
  };
};

export const performGoblinModeStep = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): GoblinModeStepResult => {
  const resolved = resolveGoblinModeStep(definition, state);
  if (!resolved.ok) return resolved;
  return {
    ...resolved,
    state: performRuntimeAction(definition, state, resolved.request),
  };
};
