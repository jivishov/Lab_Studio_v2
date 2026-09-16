import { useState, type FormEvent } from "react";
import type { PaperSetup } from "../data/labSetup";

const fields: Array<[keyof PaperSetup, string]> = [
  ["baselineHeightMm", "Pencil origin above lower edge (mm)"],
  ["solventDepthMm", "Solvent depth (mm)"],
  ["solventVolumeMl", "Solvent per chamber (mL)"],
  ["spotterLoadVolumeMl", "Sample loaded per trial (mL)"],
  ["spotVolumeMl", "Sample applied per spot (mL)"],
  ["paperLengthMm", "Paper length (mm)"],
  ["stopFrontMm", "Stop distance from origin (mm)"],
];

export const PaperSetupForm = ({ onStart, error }: { onStart: (setup: PaperSetup) => void; error?: string }) => {
  const [solvents, setSolvents] = useState("");
  const [datasets, setDatasets] = useState("");
  const [parseError, setParseError] = useState("");
  const [values, setValues] = useState<Partial<Record<keyof PaperSetup, string>>>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const rows = datasets.trim() ? datasets.trim().split("\n").map((line) => {
        const [solvent, label, color, distance] = line.split("|").map((part) => part.trim());
        if (!solvent || !label || !color || distance === undefined || distance === "") throw new Error("Use solvent | observed region label | #RRGGBB | distance in mm for each row.");
        return { solvent, label, color, distanceMm: Number(distance) };
      }) : [];
      const trials = solvents.split(",").map((solvent) => {
        const name = solvent.trim(); const bands = rows.filter((row) => row.solvent === name).map(({ label, color, distanceMm }) => ({ label, color, distanceMm }));
        return { solvent: name, ...(bands.length ? { bands } : {}) };
      });
      if (rows.some((row) => !trials.some((trial) => trial.solvent === row.solvent))) throw new Error("Every dataset row must name a selected solvent.");
      setParseError(""); onStart({ ...Object.fromEntries(fields.map(([key]) => [key, Number(values[key])])), trials } as unknown as PaperSetup);
    } catch (failure) { setParseError(failure instanceof Error ? failure.message : String(failure)); }
  };
  return <main className="route-status">
    <h1>Chromatography classroom setup</h1>
    <p>Enter the instructor-approved geometry and quantities. Choose at least two of the five source solvents. The supplied illustrative water and 2-propanol datasets use an 80 mm front. Other solvent/endpoint choices use instructor-supplied classroom chromatogram data; no predictive chemistry is invented. One to three observed regions are supported, including unresolved overlap as a single region.</p>
    <p>These settings remain fixed for this run. Starting a different setup creates a fresh activity with no carried-over evidence.</p>
    <form onSubmit={submit}>
      <label>Solvents in trial order<input required value={solvents} onChange={(event) => setSolvents(event.target.value)} placeholder="water,propanol" /></label>
      <p>Available: water, propanol, ethanol, acetone, chromatography-solvent (petroleum ether/acetone).</p>
      <label>Instructor dataset rows (one observed region per line)<textarea value={datasets} onChange={(event) => setDatasets(event.target.value)} placeholder="solvent | observed region label | #RRGGBB | measured distance in mm" /></label>
      <p>Leave data blank only for the supplied water/2-propanol examples at 80 mm. Classroom data is displayed as a supplied chromatogram after development, then measured and recorded through the normal ruler and Rf workflow.</p>
      <label><input required type="checkbox" /> The instructor approves the selected solvents, dataset provenance, geometry, ventilation and solvent-specific waste routes.</label>
      {fields.map(([key, label]) => <label key={key} style={{ display: "block", marginBlock: "0.75rem" }}>
        {label}<input required type="number" step="any" min="0" value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
      </label>)}
      {(error || parseError) && <p role="alert">{parseError || error}</p>}
      <button type="submit">Use approved setup and start</button>
    </form>
  </main>;
};
