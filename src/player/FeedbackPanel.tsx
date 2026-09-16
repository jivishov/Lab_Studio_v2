import type { RuntimeState } from "../domain/types";

const visibleFeedback = (state: RuntimeState) => {
  const latest = state.feedbackQueue.at(-1);
  return latest ? [latest] : [];
};

export const FeedbackPanel = ({
  announce = true,
  state,
}: {
  announce?: boolean;
  state: RuntimeState;
}) => (
  <section className="feedback-panel" aria-live={announce ? "polite" : undefined}>
    <div className="panel-heading">
      <h2>Feedback</h2>
      <span>
        {state.mode === "assessment"
          ? `assessment - ${
              state.attemptHistory.filter((attempt) => attempt.mode === "assessment" && !attempt.success).length
            } failed attempts`
          : state.mode}
      </span>
    </div>
    <div className="feedback-list">
      {visibleFeedback(state).map((item) => (
        <article className={`feedback-item ${item.severity}`} key={item.id}>
          <strong>{item.severity}</strong>
          <p>{item.message}</p>
          {item.recovery ? <small>{item.recovery}</small> : null}
        </article>
      ))}
      {state.feedbackQueue.length > 1 ? (
        <p className="feedback-history-count">History: {state.feedbackQueue.length - 1} earlier messages</p>
      ) : null}
    </div>
  </section>
);
