import type { ActionVerb, RuntimeState } from "../domain/types";

interface FailedAssessmentAttemptInput {
  actionId: string;
  message: string;
  nodeId: string;
  timestamp: string;
  verb: ActionVerb;
}

export const appendFailedAssessmentAttempt = (
  state: RuntimeState,
  attempt: FailedAssessmentAttemptInput,
): RuntimeState => ({
  ...state,
  attemptHistory: [
    ...state.attemptHistory,
    {
      id: `${attempt.nodeId}-${attempt.actionId}-${state.attemptHistory.length + 1}`,
      timestamp: attempt.timestamp,
      nodeId: attempt.nodeId,
      actionId: attempt.actionId,
      verb: attempt.verb,
      mode: "assessment",
      success: false,
      message: attempt.message,
    },
  ],
});
