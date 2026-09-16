import { useState } from "react";
import { parseCausalystSubmissionPackage, type CausalystSubmissionPackage } from "../submission";
import { CausalystReview } from "./CausalystReview";

export const TeacherReview = () => {
  const [value, setValue] = useState<CausalystSubmissionPackage>();
  const [message, setMessage] = useState("Import a portable local submission.");
  if (value) return <CausalystReview initialPackage={value} />;
  return (
    <main className="causalyst-author causalyst-review causalyst-review--empty">
      <header className="causalyst-author__header">
        <div className="causalyst-author__copy">
          <span className="causalyst-kicker">Teacher review · local only</span>
          <h1>Submission evidence review</h1>
          <p>Import a validated, identity-free Causalyst submission package.</p>
        </div>
        <a className="causalyst-header-link" href="#/causalyst">Assessment library</a>
      </header>
      <section className="causalyst-card causalyst-import-panel">
        <label>Import submission
          <input
            accept=".json,application/json"
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                setValue(parseCausalystSubmissionPackage(text));
                setMessage("Submission integrity verified. Review evidence before local approval.");
              }).catch((error: unknown) =>
                setMessage(error instanceof Error ? error.message : "Import failed."));
            }}
          />
        </label>
        <p role="status">{message}</p>
        <aside className="causalyst-boundary" role="note">
          This local review does not identify a learner, return a score, or connect to LTI or AGS.
        </aside>
      </section>
    </main>
  );
};
