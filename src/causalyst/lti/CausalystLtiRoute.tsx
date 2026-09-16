import { useEffect, useState } from "react";
import { CausalystAttempt } from "../attempt/CausalystAttempt";
import {
  createAssayAssessmentFixture,
  createChemistryAssessmentFixture,
  type CausalystAssessmentDefinition,
} from "../domain";
import {
  approveLtiScore,
  createLtiAssignment,
  exchangeCausalystLaunchCode,
  listLtiSubmissions,
  loadCurrentLtiAssignment,
  readLaunchCodeFromHash,
  returnApprovedLtiScore,
  returnDeepLinkSelection,
  submitLtiAttempt,
  type CausalystLtiSession,
  type LtiAssignment,
  type LtiSubmissionRecord,
} from "./client";
import "../author/causalyst.css";

const DeepLinkSelection = ({ session }: { session: CausalystLtiSession }) => {
  const [message, setMessage] = useState("Choose one validated, version-pinned assessment.");
  const fixtures = [createChemistryAssessmentFixture(), createAssayAssessmentFixture()];
  const publish = async (assessment: CausalystAssessmentDefinition) => {
    try {
      setMessage("Validating and creating the deployment-scoped assignment.");
      const assignment = await createLtiAssignment(session, assessment);
      setMessage("Returning the signed resource selection to the LMS.");
      await returnDeepLinkSelection(session, assignment.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deep Linking failed.");
    }
  };
  return (
    <main className="causalyst-library causalyst-lti-selection">
      <header className="causalyst-library__hero causalyst-library__hero--compact">
        <div className="causalyst-library__copy">
          <span className="causalyst-kicker">LTI Deep Linking · instructor authorized</span>
          <h1>Select a Causalyst assessment</h1>
          <p>
            The LMS receives only a signed resource link and stable assignment reference.
            The validated assessment remains in the Learning Integration Service.
          </p>
        </div>
      </header>
      <p className="causalyst-message" role="status">{message}</p>
      <ul className="causalyst-lti-list">
        {fixtures.map((assessment) => (
          <li key={assessment.id}>
            <div>
              <strong>{assessment.title}</strong>
              <span>{assessment.domainPackRef.id} · {assessment.rubric.totalPoints} points · teacher review required</span>
            </div>
            <button onClick={() => void publish(assessment)} type="button">Return this assessment to LMS</button>
          </li>
        ))}
      </ul>
      <p className="causalyst-boundary">No roster, name, email, accommodation, or automatic score is requested.</p>
    </main>
  );
};

const InstructorReview = ({
  assignment,
  session,
}: {
  assignment: LtiAssignment;
  session: CausalystLtiSession;
}) => {
  const [submissions, setSubmissions] = useState<LtiSubmissionRecord[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading deployment-scoped submissions.");
  const refresh = async () => {
    const next = await listLtiSubmissions(session, assignment.id);
    setSubmissions(next);
    setMessage(next.length ? `${next.length} submission(s) ready for review.` : "No submissions yet.");
  };
  useEffect(() => {
    void refresh().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "Submission review could not load."));
  }, [assignment.id]);

  return (
    <main className="causalyst-author causalyst-review">
      <header className="causalyst-author__header">
        <div className="causalyst-author__copy">
          <span className="causalyst-kicker">LTI instructor review · pseudonymous records</span>
          <h1>{assignment.assessment.title}</h1>
          <p>Inspect artifact pins, semantic traces, evidence, and explanations before approving any score.</p>
        </div>
        <button onClick={() => void refresh()} type="button">Refresh submissions</button>
      </header>
      <p className="causalyst-message" role="status">{message}</p>
      {submissions.map((record) => (
        <section className="causalyst-card" key={record.id}>
          <h2>Submission {record.id}</h2>
          <dl>
            <div><dt>Status</dt><dd>{record.status}</dd></div>
            <div><dt>Submitted</dt><dd>{record.submittedAt}</dd></div>
            <div><dt>Integrity</dt><dd>{record.submission.integrity.status}</dd></div>
            <div><dt>Artifact versions</dt><dd>{record.submission.integrity.artifactRefs.map(({ id, version }) => `${id}@${version}`).join(", ")}</dd></div>
          </dl>
          <h3>Semantic trace</h3>
          <table>
            <thead><tr><th scope="col">Sequence</th><th scope="col">Event</th><th scope="col">Outcome</th></tr></thead>
            <tbody>{record.submission.runTraces.flatMap(({ events }) => events).map((event) => (
              <tr key={event.eventId}><td>{event.sequence}</td><th scope="row">{event.summary}</th><td>{event.outcome}</td></tr>
            ))}</tbody>
          </table>
          <h3>Learner explanations</h3>
          <ul>{record.submission.explanations.map((explanation) => (
            <li key={explanation.promptId}><strong>{explanation.promptId}</strong><p>{explanation.responseText}</p></li>
          ))}</ul>
          {assignment.gradable && assignment.scoreMaximum && (
            <div>
              <label>Teacher-approved score
                <input
                  inputMode="decimal"
                  value={scores[record.id] ?? ""}
                  onChange={(event) => setScores((current) => ({ ...current, [record.id]: event.currentTarget.value }))}
                />
                <span> out of {assignment.scoreMaximum}</span>
              </label>
              <button
                disabled={!scores[record.id]}
                onClick={() => void approveLtiScore(
                  session,
                  record.id,
                  scores[record.id],
                  assignment.scoreMaximum!,
                ).then(() => {
                  setMessage("Teacher approval recorded. No score has been returned automatically.");
                  return refresh();
                }).catch((error: unknown) =>
                  setMessage(error instanceof Error ? error.message : "Score approval failed."))}
                type="button"
              >
                Record explicit teacher approval
              </button>
              {assignment.agsEnabled && (
                <button
                  onClick={() => void returnApprovedLtiScore(
                    session,
                    record.id,
                    `ags_${record.id}_teacher_approved`,
                  ).then(() => setMessage("Approved score return request completed."))
                    .catch((error: unknown) =>
                      setMessage(error instanceof Error ? error.message : "AGS return failed."))}
                  type="button"
                >
                  Return approved score to LMS
                </button>
              )}
            </div>
          )}
        </section>
      ))}
    </main>
  );
};

export const CausalystLtiRoute = () => {
  const [session, setSession] = useState<CausalystLtiSession>();
  const [assignment, setAssignment] = useState<LtiAssignment>();
  const [message, setMessage] = useState("Exchanging the one-time LTI launch code.");

  useEffect(() => {
    const launchCode = readLaunchCodeFromHash(window.location.hash);
    if (!launchCode) {
      setMessage("This LTI launch is missing or has already been exchanged. Relaunch from the LMS.");
      return;
    }
    void exchangeCausalystLaunchCode(launchCode)
      .then(async (value) => {
        window.history.replaceState(null, "", "#/causalyst-lti");
        setSession(value);
        if (value.session.ltiContext?.messageType === "LtiResourceLinkRequest") {
          setAssignment(await loadCurrentLtiAssignment(value));
        }
        setMessage("Secure pseudonymous LTI session ready.");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "LTI launch failed."));
  }, []);

  if (!session) return <main className="route-status" aria-live="polite"><h1>Causalyst LTI</h1><p>{message}</p></main>;
  if (session.session.ltiContext?.messageType === "LtiDeepLinkingRequest") {
    return <DeepLinkSelection session={session} />;
  }
  if (!assignment) return <main className="route-status" aria-live="polite"><h1>Causalyst LTI</h1><p>{message}</p></main>;
  if (session.session.roles.includes("instructor") || session.session.roles.includes("administrator")) {
    return <InstructorReview assignment={assignment} session={session} />;
  }
  return (
    <CausalystAttempt
      assessment={assignment.assessment}
      onValidatedSubmission={(submission) => submitLtiAttempt(session, assignment.id, submission).then(() => undefined)}
      submissionMode="lti"
    />
  );
};
