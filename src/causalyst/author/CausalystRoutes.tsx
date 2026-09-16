import { useEffect, useState } from "react";
import { CausalystAttempt } from "../attempt/CausalystAttempt";
import { createAssayAssessmentFixture, createChemistryAssessmentFixture } from "../domain";
import { LearnerPreview } from "../player/LearnerPreview";
import { TeacherReview } from "../review/TeacherReview";
import { CausalystAuthor } from "./CausalystAuthor";
import { getLocalAssessment, importLocalAssessment, loadLocalAssessments } from "./localLibrary";
import "./causalyst.css";

const useCausalystRouteTop = () => {
  useEffect(() => {
    window.scrollTo({ behavior: "auto", left: 0, top: 0 });
  }, []);
};

export const CausalystLibraryRoute = () => {
  useCausalystRouteTop();
  const [assessments, setAssessments] = useState(loadLocalAssessments);
  const [message, setMessage] = useState<string>();
  return (
    <main className="causalyst-library causalyst-library--index">
      <header className="causalyst-library__hero">
        <div className="causalyst-library__copy">
          <span className="causalyst-kicker">Local assessment workspace · identity-free</span>
          <h1>Causalyst</h1>
          <p>Design simulation-backed assessments from validated Lab Studio and Assay Studio artifacts, then inspect the evidence before any teacher decision.</p>
          <div className="causalyst-library__actions">
            <a className="causalyst-button causalyst-button--primary" href="#/causalyst-author/chemistry-template">New chemistry assessment</a>
            <a className="causalyst-button causalyst-button--secondary" href="#/causalyst-author/assay-template">New assay assessment</a>
          </div>
        </div>
        <div className="causalyst-library__workflow">
          <span className="causalyst-kicker">Evidence workflow</span>
          <ol>
            <li><span>01</span><div><strong>Author</strong><small>Pin the artifact and allowed capabilities.</small></div></li>
            <li><span>02</span><div><strong>Run</strong><small>Collect semantic evidence from the simulation.</small></div></li>
            <li><span>03</span><div><strong>Review</strong><small>Keep the final decision with the teacher.</small></div></li>
          </ol>
          <label className="causalyst-import">Import assessment
            <input
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                void file.text().then((text) => {
                  const imported = importLocalAssessment(text);
                  setAssessments(loadLocalAssessments());
                  setMessage(`Imported ${imported.title}.`);
                }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Import failed."));
              }}
              type="file"
            />
          </label>
        </div>
      </header>
      {message && <p className="causalyst-message" role="status">{message}</p>}
      <div className="causalyst-library__lower-grid">
        <section className="causalyst-library__collection" aria-labelledby="saved-assessments">
          <header className="causalyst-collection__heading">
            <div>
              <span className="causalyst-kicker">Local workspace</span>
              <h2 id="saved-assessments">Saved assessments</h2>
            </div>
            <span className="causalyst-collection__count">{assessments.length} saved</span>
          </header>
          {assessments.length === 0 ? (
            <div className="causalyst-empty-state">
              <span aria-hidden="true">∅</span>
              <div>
                <strong>Your assessment library is ready.</strong>
                <p>Start with a validated chemistry or assay fixture. Drafts stay in this browser and contain no learner identity.</p>
              </div>
            </div>
          ) : (
            <ul>
              {assessments.map((assessment) => (
                <li key={assessment.id}>
                  <div><strong>{assessment.title}</strong><span>{assessment.domainPackRef.id} · {assessment.rubric.totalPoints} points · teacher review required</span></div>
                  <div className="causalyst-collection__actions">
                    <a href={`#/causalyst-author/${assessment.id}`}>Edit</a>
                    <a href={`#/causalyst-preview/${assessment.id}`}>Preview</a>
                    <a href={`#/causalyst-attempt/${assessment.id}`}>Attempt</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="causalyst-review-entry">
          <header className="causalyst-review-entry__heading">
            <span className="causalyst-kicker">Teacher checkpoint</span>
            <h2>Review a portable submission</h2>
          </header>
          <div className="causalyst-review-entry__body">
            <p>Inspect integrity, semantic replay, evidence, and provisional rubric mapping before recording a local decision.</p>
            <a className="causalyst-button causalyst-button--secondary" href="#/causalyst-review/local">Open evidence review</a>
          </div>
        </aside>
      </div>
    </main>
  );
};

const routeAssessment = (assessmentId?: string) => assessmentId === "assay-template"
  ? createAssayAssessmentFixture()
  : assessmentId === "chemistry-template" || !assessmentId
    ? createChemistryAssessmentFixture()
    : getLocalAssessment(assessmentId) ?? createChemistryAssessmentFixture();

export const CausalystAuthorRoute = ({ assessmentId }: { assessmentId?: string }) => {
  useCausalystRouteTop();
  return <CausalystAuthor initialAssessment={routeAssessment(assessmentId)} />;
};

export const CausalystPreviewRoute = ({ assessmentId }: { assessmentId: string }) => {
  useCausalystRouteTop();
  return (
    <main className="causalyst-author causalyst-preview-route">
      <p><a className="causalyst-back-link" href={`#/causalyst-author/${assessmentId}`}>Return to authoring</a></p>
      <LearnerPreview assessment={routeAssessment(assessmentId)} />
    </main>
  );
};

export const CausalystAttemptRoute = ({ assessmentId }: { assessmentId: string }) => {
  useCausalystRouteTop();
  return <CausalystAttempt assessment={routeAssessment(assessmentId)} />;
};

export const CausalystReviewRoute = () => {
  useCausalystRouteTop();
  return <TeacherReview />;
};
