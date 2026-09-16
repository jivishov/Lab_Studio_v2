import type { RuntimeState } from "../domain/types";
import { formatEvidenceValue } from "./evidenceFormatting";

interface ResultsPanelProps {
  state: RuntimeState;
}

const chartPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return "";
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  return points
    .map((point, index) => {
      const x = 12 + (point.x / maxX) * 156;
      const y = 86 - (point.y / maxY) * 68;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

export const ResultsPanel = ({ state }: ResultsPanelProps) => (
  <section className="results-panel">
    <div className="panel-heading">
      <h2>Results</h2>
      <span>
        {state.measurements.length + state.dataSeries.length + state.calculations.length} records
      </span>
    </div>
    <div className="result-grid">
      {state.measurements.map((measurement) => (
        <div className="result-row" key={measurement.id}>
          <span>{measurement.label}</span>
          <strong>{formatEvidenceValue(measurement.value, measurement.unit)}</strong>
        </div>
      ))}
      {state.dataSeries.map((series) => (
        <article className="result-row data-series-card" key={series.id}>
          <div className="data-series-card__header">
            <span>{series.label}</span>
            <strong>{series.points.length} readings</strong>
          </div>
          <svg
            aria-label={`${series.label} graph`}
            className="kinetics-chart"
            role="img"
            viewBox="0 0 180 100"
          >
            <line className="kinetics-chart__axis" x1="12" x2="168" y1="86" y2="86" />
            <line className="kinetics-chart__axis" x1="12" x2="12" y1="18" y2="86" />
            <path className="kinetics-chart__line" d={chartPath(series.points)} />
            {series.points.map((point) => {
              const maxX = Math.max(...series.points.map((candidate) => candidate.x), 1);
              const maxY = Math.max(...series.points.map((candidate) => candidate.y), 1);
              return (
                <circle
                  className="kinetics-chart__point"
                  cx={12 + (point.x / maxX) * 156}
                  cy={86 - (point.y / maxY) * 68}
                  key={`${point.x}-${point.y}`}
                  r="2.3"
                />
              );
            })}
            <text x="92" y="98">
              time ({series.xUnit})
            </text>
            <text transform="rotate(-90 8 54)" x="8" y="54">
              {series.yUnit}
            </text>
          </svg>
          <table className="data-series-table">
            <thead>
              <tr>
                <th scope="col">Time ({series.xUnit})</th>
                <th scope="col">Volume ({series.yUnit})</th>
              </tr>
            </thead>
            <tbody>
              {series.points.map((point) => (
                <tr key={`${series.id}-${point.x}`}>
                  <td>{point.x}</td>
                  <td>{point.y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
      {state.calculations.map((calculation) => (
        <div className={`result-row ${calculation.passed ? "passed" : "failed"}`} key={calculation.id}>
          <span>{calculation.label}</span>
          <strong>{formatEvidenceValue(calculation.value, calculation.unit)}</strong>
        </div>
      ))}
    </div>
  </section>
);
