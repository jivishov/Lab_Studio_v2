import { useMemo, useState } from "react";
import {
  createCausalystSubmissionPackage,
  type CausalystSubmissionPackage,
} from "../submission";
import { createReplayTimeline } from "../trace/replay";
import { saveLocalSubmissionPackage } from "../attempt/localSubmissions";
import { recordLocalTeacherReview } from "./approval";

export const CausalystReview = ({
  initialPackage,
}: {
  initialPackage: CausalystSubmissionPackage;
}) => {
  const [value, setValue] = useState(initialPackage);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string>();
  const timeline = useMemo(() => value.submission.runTraces.flatMap((trace) =>
    createReplayTimeline(trace, value.submission.evidenceBundle)), [value]);

  const review = (status: "approved-local" | "changes-requested") => {
    try {
      const reviewedAt = new Date().toISOString();
      const levels = status === "approved-local"
        ? value.assessment.rubric.criteria.flatMap((criterion) => {
            const suggestion = value.submission.rubricEvaluation.criteria
              .find(({ criterionId }) => criterionId === criterion.id)?.suggestedLevelId;
            return suggestion ? [{ criterionId: criterion.id, levelId: suggestion }] : [];
          })
        : undefined;
      const submission = recordLocalTeacherReview(value.assessment, value.submission, {
        status,
        reviewedAt,
        reviewerNote: note,
        approvedCriterionLevelIds: levels,
      });
      const next = createCausalystSubmissionPackage(value.assessment, submission, {
        packageId: value.packageId,
        createdAt: value.createdAt,
      });
      saveLocalSubmissionPackage(next);
      setValue(next);
      setMessage(status === "approved-local"
        ? "Local review approved. No score or grade was returned."
        : "Changes requested. No score or grade was returned.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed.");
    }
  };

  return (
    <main className="causalyst-author causalyst-review">
      <header className="causalyst-author__header">
        <div className="causalyst-author__copy">
          <span className="causalyst-kicker">Teacher review · local only</span>
          <h1>{value.assessment.title}</h1>
          <p>Inspect the pinned artifact, semantic replay, evidence, explanations, and provisional rubric mapping.</p>
        </div>
        <dl className="causalyst-author__meta">
          <div><dt>Integrity</dt><dd>{value.submission.integrity.status}</dd></div>
          <div><dt>Review</dt><dd>{value.submission.teacherApproval.status}</dd></div>
          <div><dt>Grade return</dt><dd>Disabled</dd></div>
        </dl>
        <a className="causalyst-header-link" href="#/causalyst">Assessment library</a>
      </header>
      {message && <p className="causalyst-message" role="status">{message}</p>}
      <section className="causalyst-card">
        <h2>Submission integrity</h2>
        <dl>
          <div><dt>Submission</dt><dd>{value.submission.submissionId}</dd></div>
          <div><dt>Assessment</dt><dd>{value.submission.assessmentRef.id}@{value.submission.assessmentRef.version}</dd></div>
          <div><dt>Domain pack</dt><dd>{value.assessment.domainPackRef.id}@{value.submission.integrity.domainPackVersion}</dd></div>
          <div><dt>Integrity</dt><dd>{value.submission.integrity.status}</dd></div>
          <div><dt>Review</dt><dd>{value.submission.teacherApproval.status}</dd></div>
        </dl>
      </section>
      <section className="causalyst-card">
        <h2>Semantic replay</h2>
        <table>
          <thead><tr><th>Seq.</th><th>Time</th><th>Event</th><th>Outcome</th><th>Evidence</th></tr></thead>
          <tbody>{timeline.map((entry) => (
            <tr key={`${entry.sequence}:${entry.occurredAt}`}>
              <td>{entry.sequence}</td>
              <td>{entry.occurredAt}</td>
              <th scope="row">{entry.summary}</th>
              <td>{entry.outcome}</td>
              <td>{entry.evidence.map(({ typeId }) => typeId).join(", ") || "None"}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="causalyst-card">
        <h2>Evidence and explanations</h2>
        <table>
          <thead><tr><th>Type</th><th>Summary</th><th>Representation</th></tr></thead>
          <tbody>{value.submission.evidenceBundle.records.map((record) => (
            <tr key={record.evidenceId}>
              <th scope="row">{record.typeId}@{record.typeVersion}</th>
              <td>{record.summary}</td>
              <td>{record.metadata.accessibleRepresentation}</td>
            </tr>
          ))}</tbody>
        </table>
        {value.submission.explanations.map((response) => (
          <article key={response.promptId}>
            <h3>{response.promptId}</h3>
            <p>{response.responseText}</p>
          </article>
        ))}
      </section>
      <section className="causalyst-card">
        <h2>Provisional rubric mapping</h2>
        <table>
          <thead><tr><th>Criterion</th><th>Suggestion</th><th>Evidence gaps</th><th>Decision</th></tr></thead>
          <tbody>{value.submission.rubricEvaluation.criteria.map((criterion) => (
            <tr key={criterion.criterionId}>
              <th scope="row">{criterion.criterionId}</th>
              <td>{criterion.suggestedLevelId ?? "No suggestion"}</td>
              <td>{criterion.missingSelectorIds.join(", ") || "None"}</td>
              <td>Teacher required</td>
            </tr>
          ))}</tbody>
        </table>
        <label>Teacher note
          <textarea rows={4} value={note} onChange={(event) => setNote(event.currentTarget.value)} />
        </label>
        <div>
          <button onClick={() => review("approved-local")} type="button">Approve local evidence review</button>
          <button onClick={() => review("changes-requested")} type="button">Request changes</button>
        </div>
        <p><strong>Grade return is disabled.</strong> LTI and AGS are not part of this local workflow.</p>
      </section>
    </main>
  );
};
