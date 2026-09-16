import type { RuntimeState } from "../domain/types";
import {
  resolveInteractionIntent,
  type InteractionInvalidFeedback,
  type RuntimeInteractionIntent,
} from "./interactionIntents";
import { performRuntimeAction } from "./reducer";
import type { RuntimeDefinition } from "./createRuntime";

export type InteractionSequenceStepStatus = "accepted" | "rejected";

export interface InteractionSequenceStep {
  index: number;
  intentType: RuntimeInteractionIntent["type"];
  status: InteractionSequenceStepStatus;
  nodeIdBefore: string;
  nodeIdAfter: string;
  actionId?: string;
  message: string;
  recovery?: string;
  invalidFeedback?: InteractionInvalidFeedback;
}

export interface InteractionSequenceResult {
  state: RuntimeState;
  status: "completed" | "rejected" | "aborted";
  steps: InteractionSequenceStep[];
  feedback?: {
    message: string;
    recovery?: string;
    invalid?: InteractionInvalidFeedback;
  };
}

const abortedResult = (
  state: RuntimeState,
  steps: InteractionSequenceStep[],
): InteractionSequenceResult => ({
  state,
  status: "aborted",
  steps,
  feedback: {
    message: "The interaction sequence was cancelled before the next operation.",
    recovery: "Inspect the current rehearsal state before deciding whether to continue.",
  },
});

/**
 * Resolves and performs each intent against the state produced by the preceding intent.
 *
 * The reducer deliberately returns only RuntimeState, so acceptance is read from the new attempt
 * record it appends for ordinary process actions. Resolver rejection and reducer rejection both
 * stop the sequence at the first failed operation. Cancellation is checked between operations;
 * an already-completed synchronous reducer operation is never rolled back or replayed.
 */
export const runInteractionSequence = (
  definition: RuntimeDefinition,
  initialState: RuntimeState,
  intents: readonly RuntimeInteractionIntent[],
  signal?: AbortSignal,
): InteractionSequenceResult => {
  let state = initialState;
  const steps: InteractionSequenceStep[] = [];

  for (let index = 0; index < intents.length; index += 1) {
    if (signal?.aborted) return abortedResult(state, steps);

    const intent = intents[index];
    const nodeIdBefore = state.currentNodeId;
    const resolved = resolveInteractionIntent(definition, state, intent);
    if (!resolved.ok) {
      const step: InteractionSequenceStep = {
        index,
        intentType: intent.type,
        status: "rejected",
        nodeIdBefore,
        nodeIdAfter: state.currentNodeId,
        actionId: resolved.feedback.actionId,
        message: resolved.feedback.message,
        recovery: resolved.feedback.recovery,
        invalidFeedback: resolved.feedback,
      };
      steps.push(step);
      return {
        state,
        status: "rejected",
        steps,
        feedback: {
          message: step.message,
          recovery: step.recovery,
          invalid: resolved.feedback,
        },
      };
    }

    const attemptCountBefore = state.attemptHistory.length;
    const feedbackCountBefore = state.feedbackQueue.length;
    const nextState = performRuntimeAction(definition, state, resolved.request);
    const attempt = nextState.attemptHistory.slice(attemptCountBefore).at(-1);
    const reducerFeedback = nextState.feedbackQueue.slice(feedbackCountBefore).at(-1);
    const accepted = attempt?.success === true;
    const message = attempt?.message ?? reducerFeedback?.message ?? (
      accepted ? resolved.action.feedback.success : "The runtime rejected the interaction."
    );
    const recovery = accepted
      ? undefined
      : reducerFeedback?.recovery ?? resolved.action.feedback.invalid;
    const step: InteractionSequenceStep = {
      index,
      intentType: intent.type,
      status: accepted ? "accepted" : "rejected",
      nodeIdBefore,
      nodeIdAfter: nextState.currentNodeId,
      actionId: resolved.action.id,
      message,
      recovery,
    };
    steps.push(step);
    state = nextState;

    if (!accepted) {
      return {
        state,
        status: "rejected",
        steps,
        feedback: { message, recovery },
      };
    }
  }

  if (signal?.aborted) return abortedResult(state, steps);
  return { state, status: "completed", steps };
};
