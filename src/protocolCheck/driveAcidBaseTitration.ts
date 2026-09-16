import { resolveActionInteraction } from "../domain/interactions";
import type { ActionDefinition, RuntimeState } from "../domain/types";
import {
  createRuntimeState,
  getActions,
  getProcess,
  performRuntimeAction,
  runInteractionSequence,
  type InteractionSequenceResult,
  type RuntimeDefinition,
  type RuntimeInteractionIntent,
} from "../runtime";

export interface ProtocolDriveResult {
  ok: boolean;
  state: RuntimeState;
  message: string;
}

const currentAction = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): ActionDefinition | undefined => {
  const node = getProcess(definition).nodes.find((candidate) => candidate.id === state.currentNodeId);
  return getActions(definition).find((candidate) => candidate.id === node?.actionId);
};

const intentForAction = (action: ActionDefinition): RuntimeInteractionIntent | undefined => {
  const interaction = resolveActionInteraction(action);
  if (!interaction) return undefined;
  const shared = {
    actionId: action.id,
    origin: "programmatic" as const,
    stationId: interaction.stationId,
    snapZoneId: interaction.snapZoneId,
  };
  switch (interaction.type) {
    case "dragToZone": return { ...shared, type: "placeIntent" };
    case "snapIntoTarget": return { ...shared, type: "snapIntent" };
    case "pourInto": return { ...shared, type: "pourIntent" };
    case "spotOnto": return { ...shared, type: "spotIntent" };
    case "rinseTarget": return { ...shared, type: "rinseIntent" };
    case "placeInInstrument":
    case "readInstrument": return { ...shared, type: "instrumentReadIntent" };
    case "recordNotebook": return { ...shared, type: "notebookRecordIntent" };
    case "recordTimeSeries": return { ...shared, type: "timeSeriesRecordIntent" };
    case "submitCalculation": return { ...shared, type: "calculationSubmitIntent" };
    default: return undefined;
  }
};

const rejected = (sequence: InteractionSequenceResult): ProtocolDriveResult => ({
  ok: false,
  state: sequence.state,
  message: sequence.status === "aborted"
    ? "Protocol execution was cancelled before the next ordinary operation."
    : "The ordinary runtime rejected a required protocol operation.",
});

const run = (
  definition: RuntimeDefinition,
  state: RuntimeState,
  intents: readonly RuntimeInteractionIntent[],
  signal?: AbortSignal,
): ProtocolDriveResult => {
  const sequence = runInteractionSequence(definition, state, intents, signal);
  return sequence.status === "completed"
    ? { ok: true, state: sequence.state, message: "The ordinary runtime operation completed." }
    : rejected(sequence);
};

export const driveUntilNode = (
  definition: RuntimeDefinition,
  targetNodeId: string,
  signal?: AbortSignal,
): ProtocolDriveResult => {
  let state = createRuntimeState(structuredClone(definition), "guided");
  const process = getProcess(definition);
  let operations = 0;
  while (state.currentNodeId !== targetNodeId && operations < process.nodes.length + 2) {
    if (signal?.aborted) {
      return { ok: false, state, message: "Protocol execution was cancelled before the next case operation." };
    }
    const action = currentAction(definition, state);
    const intent = action ? intentForAction(action) : undefined;
    if (!action || !intent || resolveActionInteraction(action)?.type === "dispenseDrops") {
      return { ok: false, state, message: "The staged process could not be driven to the requested protocol checkpoint." };
    }
    const outcome = run(definition, state, [intent], signal);
    if (!outcome.ok) return outcome;
    state = outcome.state;
    operations += 1;
  }
  return state.currentNodeId === targetNodeId
    ? { ok: true, state, message: "The requested protocol checkpoint was reached through ordinary interactions." }
    : { ok: false, state, message: "The staged process did not reach the requested protocol checkpoint." };
};

export const driveAcidBaseTitration = (
  definitionInput: RuntimeDefinition,
  signal?: AbortSignal,
): ProtocolDriveResult => {
  const definition = structuredClone(definitionInput);
  const process = getProcess(definition);
  let state = createRuntimeState(definition, "guided");
  let nodeOperations = 0;

  while (state.completedNodes.length < process.nodes.length && nodeOperations < process.nodes.length + 4) {
    if (signal?.aborted) {
      return { ok: false, state, message: "Protocol execution was cancelled before the next ordinary operation." };
    }
    const action = currentAction(definition, state);
    const interaction = action ? resolveActionInteraction(action) : undefined;
    if (!action || !interaction) {
      return { ok: false, state, message: "A staged process node has no ordinary runtime interaction." };
    }

    if (interaction.type === "dispenseDrops") {
      const endpointDropCount = action.parameters.endpointDropCount;
      if (!Number.isFinite(endpointDropCount) || Number(endpointDropCount) <= 0) {
        return { ok: false, state, message: "The derived titration plan is unavailable to the ordinary runtime." };
      }
      const drops = Array.from({ length: Math.round(Number(endpointDropCount)) }, () => ({
        type: "dispenseDropIntent" as const,
        actionId: action.id,
        origin: "programmatic" as const,
      }));
      const delivered = run(definition, state, drops, signal);
      if (!delivered.ok) return delivered;
      const accepted = run(definition, delivered.state, [{
        type: "dispenseCompleteIntent",
        actionId: action.id,
        origin: "programmatic",
      }], signal);
      if (!accepted.ok) return accepted;
      state = accepted.state;
    } else {
      const intent = intentForAction(action);
      if (!intent) {
        return { ok: false, state, message: "A staged process interaction has no supported ordinary intent." };
      }
      const outcome = run(definition, state, [intent], signal);
      if (!outcome.ok) return outcome;
      state = outcome.state;
    }
    nodeOperations += 1;
  }

  return state.completedNodes.length >= process.nodes.length
    ? { ok: true, state, message: "The full staged process completed through the ordinary resolver, sequence, and reducer path." }
    : { ok: false, state, message: "The staged process stopped before every required node completed." };
};

export const resetProtocolRuntime = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): RuntimeState => performRuntimeAction(definition, state, { verb: "reset" });

export const protocolIntentForAction = intentForAction;
