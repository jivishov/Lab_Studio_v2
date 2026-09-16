import type {
  AssayQcChartProjection,
  AssayQcEvaluation,
  AssayQcRuleSet,
  AssayQcTableProjection,
} from "../../domain-packs/assay";

const statusLabel = (status: AssayQcEvaluation["status"]) => ({
  pass: "Pass under this rule set",
  warn: "Review warnings",
  fail: "Fail under this rule set",
  indeterminate: "Indeterminate",
}[status]);

export interface AssayQcDashboardProps {
  evaluation: AssayQcEvaluation;
  ruleSet: AssayQcRuleSet;
  table: AssayQcTableProjection;
  chart: AssayQcChartProjection;
}

export const AssayQcDashboard = ({
  evaluation,
  ruleSet,
  table,
  chart,
}: AssayQcDashboardProps) => {
  const numericValues = chart.points.map(({ value }) => Math.abs(Number(value))).filter(Number.isFinite);
  const maximum = Math.max(...numericValues, 1);

  return (
    <section className="assay-qc-dashboard" aria-labelledby="assay-qc-heading">
      <header>
        <div>
          <span className="assay-eyebrow">Cycle 08 · table-first QC</span>
          <h1 id="assay-qc-heading">Controls, replicates, and evidence review</h1>
          <p>
            Results apply only to <strong>{ruleSet.policySource.title}</strong> ({ruleSet.policySource.version}).
            Thresholds come from that source-controlled rule data and are not global assay constants.
          </p>
        </div>
        <span className={`assay-qc-status is-${evaluation.status}`}>
          {statusLabel(evaluation.status)}
        </span>
      </header>

      <aside className="assay-qc-boundary" aria-label="Scientific boundary">
        <strong>{ruleSet.policySource.sourceKind}</strong>
        <span>{ruleSet.policySource.validityRange.join(" ")}</span>
        <span>{ruleSet.policySource.limitations.join(" ")}</span>
      </aside>

      <div className="assay-qc-rule-grid">
        {evaluation.ruleResults.map((result) => (
          <article className={`assay-qc-rule is-${result.status}`} key={result.ruleId}>
            <div><span>{result.ruleType}</span><strong>{result.status}</strong></div>
            <h2>{result.title}</h2>
            <p>{result.summary}</p>
            {result.metricValue !== undefined && (
              <dl>
                <div><dt>Metric</dt><dd>{result.metricValue} {result.unit}</dd></div>
                <div><dt>Threshold</dt><dd>{result.threshold ?? "Not supplied"}</dd></div>
              </dl>
            )}
            {result.limitations.map((limitation) => <small key={limitation}>{limitation}</small>)}
          </article>
        ))}
      </div>

      <div className="assay-qc-chart-table">
        <figure>
          <figcaption>{chart.title}</figcaption>
          <div aria-hidden="true" className="assay-qc-bars">
            {chart.points.map((point) => (
              <div key={point.wellId}>
                <span>{point.coordinate}</span>
                <i style={{ width: `${Math.max(2, Math.abs(Number(point.value)) / maximum * 100)}%` }} />
                <strong>{point.value}</strong>
              </div>
            ))}
          </div>
          <p>
            The visual profile is supplementary. The following table is the authoritative,
            screen-reader-readable projection of the same reviewed rows.
          </p>
        </figure>

        <div className="assay-qc-table-scroll">
          <table>
            <caption>Reviewed observation, correction, normalization, and flag data</caption>
            <thead>
              <tr>{table.columns.map((column) => <th key={column.id} scope="col">{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.wellId}>
                  <th scope="row">{row.coordinate}</th>
                  <td>{row.sourceType}</td>
                  <td>{row.reviewStatus}</td>
                  <td>{row.rawValue}</td>
                  <td>{row.correctedValue || "Not calculated"}</td>
                  <td>{row.normalizedValue || "Not calculated"}</td>
                  <td>{row.unit}</td>
                  <td>{row.flags.length > 0 ? row.flags.join("; ") : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details>
        <summary>Formula and evidence trace ({evaluation.formulaTraces.length})</summary>
        <div className="assay-qc-table-scroll">
          <table>
            <caption>Deterministic QC formula traces</caption>
            <thead><tr><th scope="col">Trace</th><th scope="col">Formula</th><th scope="col">Inputs</th><th scope="col">Result</th><th scope="col">Policy</th></tr></thead>
            <tbody>
              {evaluation.formulaTraces.map((trace) => (
                <tr key={trace.id}>
                  <th scope="row">{trace.id}</th>
                  <td>{trace.formula}</td>
                  <td>{trace.inputRefs.map((ref, index) => `${ref}=${trace.inputValues[index]}`).join("; ")}</td>
                  <td>{trace.result} {trace.unit}</td>
                  <td>{trace.policySourceRef}; {trace.rounding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
};
