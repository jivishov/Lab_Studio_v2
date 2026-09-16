import type { CausalystAssessmentDefinition } from "../domain/types";

export const LearnerPreview = ({ assessment }: { assessment: CausalystAssessmentDefinition }) => (
  <section className="causalyst-preview" aria-labelledby="causalyst-preview-title">
    <header>
      <span className="causalyst-kicker">Learner preview · no submission</span>
      <h2 id="causalyst-preview-title">{assessment.title}</h2>
      <p>{assessment.instructions}</p>
    </header>
    <div className="causalyst-preview__grid">
      <section>
        <h3>What you will do</h3>
        <ol>
          <li>Review the provided validated {assessment.domainPackRef.id} simulation.</li>
          <li>Make only teacher-authorized changes.</li>
          <li>Validate and run through the local semantic evidence workflow.</li>
          <li>Explain the evidence and limitations.</li>
        </ol>
      </section>
      <section>
        <h3>Evidence expected</h3>
        <ul>
          {assessment.evidencePlan.requiredEvidenceTypeRefs.map(({ id, version }) => (
            <li key={`${id}@${version}`}><code>{id}</code> <span>v{version}</span></li>
          ))}
        </ul>
      </section>
    </div>
    <section className="causalyst-rubric-preview">
      <h3>Rubric</h3>
      <table>
        <thead><tr><th>Criterion</th><th>Evidence rules</th><th>Points</th><th>Decision</th></tr></thead>
        <tbody>
          {assessment.rubric.criteria.map((criterion) => (
            <tr key={criterion.id}>
              <th scope="row">{criterion.title}</th>
              <td>{criterion.evidenceSelectors.length} declarative selector(s)</td>
              <td>{criterion.weight}</td>
              <td>Teacher required</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
    <aside className="causalyst-boundary" role="note">
      This preview does not identify a learner, calculate a final grade, or connect to an LMS.
      The local attempt route adds policy-gated ProcedureIR proposals, semantic evidence, replay,
      and portable submission without broadening those boundaries.
    </aside>
  </section>
);
