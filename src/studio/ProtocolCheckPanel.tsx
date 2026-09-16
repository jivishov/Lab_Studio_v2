import type { ProtocolCheckReport } from "../protocolCheck/types";

export interface ProtocolCheckPanelProps {
  report: ProtocolCheckReport;
}

const LimitationList = ({ title, items }: { title: string; items: readonly string[] }) => (
  <section>
    <h5>{title}</h5>
    <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
  </section>
);

export const ProtocolCheckPanel = ({ report }: ProtocolCheckPanelProps) => {
  const passedCount = report.checks.filter((check) => check.status === "passed").length;
  return (
    <section className="protocol-check-panel" aria-labelledby="protocol-check-title">
      <header>
        <div>
          <span className="composer-kicker">Deterministic Protocol Check</span>
          <h4 id="protocol-check-title">{passedCount} of {report.checks.length} declared checks passed</h4>
        </div>
        <span className={`protocol-check-verdict ${report.passed ? "is-passing" : "is-failing"}`}>
          {report.passed ? "Passing" : "Not passing"}
        </span>
      </header>
      <ol className="protocol-check-results">
        {report.checks.map((check) => (
          <li key={check.name} className={`is-${check.status}`}>
            <strong>{check.name.replaceAll("_", " ")}</strong>
            <span>{check.message}</span>
          </li>
        ))}
      </ol>
      <details>
        <summary>Scientific, safety, and physical limitations</summary>
        <div className="protocol-check-limitations">
          <LimitationList title="Scientific model" items={report.limitations.scientific} />
          <LimitationList title="Declared safety only" items={report.limitations.safety} />
          <LimitationList title="Physical transfer" items={report.limitations.physical} />
        </div>
      </details>
      <p className="protocol-check-boundary">
        This report validates the declared simulated protocol only. It does not certify analytical accuracy,
        characterize an external sample, or authorize physical laboratory work.
      </p>
    </section>
  );
};
