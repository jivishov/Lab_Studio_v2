import type { RuntimeState } from "../domain/types";

/** Plot only recorded observations; never render a model's hidden equivalence target. */
export function TitrationCurveEvidence({ state }: { state: RuntimeState }) {
  const trials = Object.entries(state.titrationTrials ?? {}).filter(([, trial]) =>
    trial.points.some(point => point.ph !== undefined));
  if (!trials.length) return null;
  return <section aria-label="Recorded titration curves">
    <h3>Recorded pH curves</h3>
    {trials.map(([id, trial]) => {
      const points = trial.points.filter(point => point.ph !== undefined);
      const maximum = Math.max(1, ...points.map(point => point.volumeMl));
      const x = (volume: number) => 35 + volume / maximum * 270;
      const y = (ph: number) => 175 - Math.max(0, Math.min(14, ph)) / 14 * 140;
      return <details key={id} open={!trial.accepted}>
        <summary>{id} — attempt {trial.attempt}</summary>
        <svg viewBox="0 0 330 210" role="img" aria-label={`Recorded pH versus added titrant for ${id}`} style={{ width: "100%" }}>
          <path d="M35 30V175H310" fill="none" stroke="currentColor" />
          <text x="4" y="26" fill="currentColor">pH</text>
          <text x="10" y="40" fill="currentColor">14</text>
          <text x="18" y="178" fill="currentColor">0</text>
          <text x="35" y="200" fill="currentColor">0</text>
          <text x="190" y="200" fill="currentColor">{maximum.toFixed(2)} mL added</text>
          <polyline points={points.map(point => `${x(point.volumeMl)},${y(point.ph!)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
          {points.map((point, index) => <circle key={index} cx={x(point.volumeMl)} cy={y(point.ph!)} r="3" fill="currentColor"><title>{point.volumeMl.toFixed(2)} mL, {point.ph} pH, {point.color}</title></circle>)}
          {trial.endpointVolumeMl !== undefined && <path d={`M${x(trial.endpointVolumeMl)} 30V175`} stroke="currentColor" strokeDasharray="4 4"><title>Accepted indicator endpoint</title></path>}
        </svg>
        <p>Points are recorded model observations. The dashed line marks the accepted indicator endpoint. Select and justify equivalence from the curve.</p>
        <table><caption>Recorded volume, pH, and color</caption><thead><tr><th scope="col">mL</th><th scope="col">pH</th><th scope="col">Color</th></tr></thead><tbody>
          {points.map((point, index) => <tr key={index}><td>{point.volumeMl.toFixed(2)}</td><td>{point.ph}</td><td>{point.color}</td></tr>)}
        </tbody></table>
      </details>;
    })}
  </section>;
}
