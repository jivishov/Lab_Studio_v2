import type { AssayProtocolAnalysis, AssayProtocolProfile } from "../../domain-packs/assay";

export interface AssayProtocolAnalysisPanelProps {
  profile: AssayProtocolProfile;
  analysis: AssayProtocolAnalysis;
}

const statusText = (analysis: AssayProtocolAnalysis) =>
  analysis.status === "complete" ? "Complete under this profile" : "Indeterminate — review required";

export const AssayProtocolAnalysisPanel = ({
  profile,
  analysis,
}: AssayProtocolAnalysisPanelProps) => (
  <section className="assay-protocol-analysis" aria-labelledby="assay-protocol-analysis-title">
    <header>
      <div>
        <span className="assay-eyebrow">Cycle 11 · checked protocol profile</span>
        <h2 id="assay-protocol-analysis-title">{profile.title}</h2>
        <p>
          <strong>{profile.id}@{profile.version}</strong> · {profile.useBoundary}. The active
          profile, source boundary, data provenance, formulas, and limitations remain part of the
          result.
        </p>
      </div>
      <span className={`assay-qc-status is-${analysis.status === "complete" ? "pass" : "indeterminate"}`}>
        {statusText(analysis)}
      </span>
    </header>

    <aside className="assay-qc-boundary" aria-label="Scientific interpretation boundary">
      <strong>{analysis.scientificBoundary}</strong>
      <span>Sources: {analysis.dataSources.join(", ") || "No reviewed source"}</span>
      <span>Readout: {analysis.readoutRef} · {analysis.readoutUnit}</span>
    </aside>

    <div className="assay-protocol-grid">
      <article>
        <h3>Profile sources</h3>
        {profile.sourceReferences.map((source) => (
          <div key={source.id}>
            <a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>
            <small>{source.organization} · {source.versionOrAccessDate}</small>
            <p>{source.supports.join(" ")}</p>
          </div>
        ))}
      </article>
      <article>
        <h3>Validity and limits</h3>
        <ul>
          {profile.validityRange.map((item) => <li key={item}>{item}</li>)}
          {profile.limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </article>
    </div>

    {analysis.endpoint && (
      <div className="assay-protocol-endpoint" role="status">
        <span>{analysis.endpoint.terminology}</span>
        <strong>{analysis.endpoint.concentration.value} {analysis.endpoint.concentration.unit}</strong>
        <small>Rule: {analysis.endpoint.ruleId}. No clinical category or treatment advice is produced.</small>
      </div>
    )}

    {analysis.diagnostics.length > 0 && (
      <div className="assay-planner-diagnostics" role="alert">
        <strong>Analysis is indeterminate</strong>
        <ul>{analysis.diagnostics.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    )}

    <div className="assay-qc-table-scroll">
      <table>
        <caption>Profile-bound reviewed well results</caption>
        <thead>
          <tr>
            <th scope="col">Well</th>
            <th scope="col">Source</th>
            <th scope="col">Raw result</th>
            <th scope="col">Concentration</th>
            <th scope="col">Profile metrics</th>
          </tr>
        </thead>
        <tbody>
          {analysis.wellResults.map((result) => (
            <tr key={result.wellId}>
              <th scope="row">{result.coordinate}</th>
              <td>{result.sourceType}</td>
              <td>{result.rawValue} {result.unit}</td>
              <td>{result.concentration ? `${result.concentration.value} ${result.concentration.unit}` : "Not applicable"}</td>
              <td>{Object.entries(result.metricValues).map(([id, value]) => `${id}: ${value}`).join("; ") || "Binary endpoint input"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <details>
      <summary>Formula trace ({analysis.formulaTraces.length})</summary>
      {analysis.formulaTraces.length === 0 ? (
        <p>The binary endpoint compares reviewed profile-coded values and explicit concentrations; no continuous formula was run.</p>
      ) : (
        <div className="assay-qc-table-scroll">
          <table>
            <caption>Safe expression-rule formula traces</caption>
            <thead><tr><th scope="col">Rule</th><th scope="col">Formula</th><th scope="col">Inputs</th><th scope="col">Result</th></tr></thead>
            <tbody>
              {analysis.formulaTraces.map((trace) => (
                <tr key={trace.id}>
                  <th scope="row">{trace.ruleId}</th>
                  <td>{trace.formula}</td>
                  <td>{trace.inputRefs.join("; ")}</td>
                  <td>{trace.result} {trace.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  </section>
);
