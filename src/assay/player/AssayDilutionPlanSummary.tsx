import type { SerialDilutionPlan } from "../../domain-packs/assay/dilution";

export interface AssayDilutionPlanSummaryProps {
  plan: SerialDilutionPlan;
}

export const AssayDilutionPlanSummary = ({ plan }: AssayDilutionPlanSummaryProps) => (
  <section className="assay-dilution-summary" aria-labelledby="assay-dilution-summary-title">
    <header>
      <div>
        <span className="assay-eyebrow">Exact factor-derived plan</span>
        <h2 id="assay-dilution-summary-title">96-well serial-dilution formula trace</h2>
        <p>
          Eight vertical channels map A–H in each column. Every value is deterministic decimal
          arithmetic; the terminal transfer is explicitly discarded to named liquid waste.
        </p>
      </div>
      <span>{plan.points.length} concentrations · 8 replicates each</span>
    </header>
    <div className="assay-dilution-summary__table-scroll">
      <table>
        <caption>Per-column concentration and volume formula trace</caption>
        <thead>
          <tr>
            <th scope="col">Column</th>
            <th scope="col">Wells</th>
            <th scope="col">Source</th>
            <th scope="col">Transfer + diluent</th>
            <th scope="col">Achieved</th>
            <th scope="col">Retained</th>
            <th scope="col">Equation</th>
          </tr>
        </thead>
        <tbody>
          {plan.points.map((point) => {
            const first = point.targets[0];
            const trace = first.formulaTrace;
            return (
              <tr key={point.id}>
                <th scope="row">{point.index + 1}</th>
                <td>{point.targets.map(({ mapping }) => mapping.coordinate).join(", ")}</td>
                <td>{trace.sourceConcentration.value} {trace.sourceConcentration.unit}</td>
                <td>
                  {trace.transferVolume.value} + {trace.diluentVolume.value} {trace.transferVolume.unit}
                </td>
                <td>{trace.achievedConcentration.value} {trace.achievedConcentration.unit}</td>
                <td>{trace.retainedVolume.value} {trace.retainedVolume.unit}</td>
                <td>{trace.equations.map(({ expression }) => expression).join("; ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <p className="assay-dilution-summary__conservation">
      Conservation: {plan.conservation.sourceVolumeRemoved.value} {plan.conservation.sourceVolumeRemoved.unit}
      {" stock + "}{plan.conservation.diluentVolumeAdded.value} {plan.conservation.diluentVolumeAdded.unit}
      {" diluent = "}{plan.conservation.terminalVolume.value} {plan.conservation.terminalVolume.unit}
      {" retained + "}{plan.conservation.discardedVolume.value} {plan.conservation.discardedVolume.unit} discarded.
    </p>
    <p className="assay-pipetting__boundary">
      Nominal amount-per-volume model only. No stochastic pipette error, quantitative carryover,
      viscosity correction, air-gap behavior, reverse pipetting, or hardware control is claimed.
    </p>
  </section>
);
