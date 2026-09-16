import { useState, type FormEvent } from "react";
import type { BondingSetup } from "../data/labSetup";

const fields: Array<[keyof BondingSetup, string]> = [
  ["knownCount", "Assigned known samples (4–6)"], ["blindCount", "Assigned blind samples (4–6)"],
  ["conductivityThresholds", "Conducting decision threshold (µS/cm)"],
  ["phThresholds", "pH classification boundary"],
  ["meltingApparatusLimits", "Approved apparatus upper temperature (°C)"],
];
export const BondingSetupForm = ({ onStart, error }: { onStart: (setup: BondingSetup) => void; error?: string }) => {
  const [procedure, setProcedure] = useState("");
  const [values, setValues] = useState<Partial<Record<keyof BondingSetup, string>>>({});
  const submit = (event: FormEvent) => { event.preventDefault(); onStart({ ...Object.fromEntries(fields.map(([key]) => [key, Number(values[key])])), selectedProcedure: procedure } as unknown as BondingSetup); };
  return <main className="route-status"><h1>Bonding classroom setup</h1>
    <p>This supported route uses appearance, solubility, aqueous conductivity, pH, magnetism, melting and reagent-response tests. It excludes metal-only dry conductivity from arbitrary unknowns. Instrument values are externally acquired classroom evidence, not predicted chemical properties. Choose at least four tests with qualitative and quantitative evidence. Preparation and disposal follow the chosen tests automatically. Magnetism must precede melting when both use the dry specimen.</p>
    <form onSubmit={submit}><label>Selected tests in execution order (comma separated)<input required value={procedure} onChange={(event) => setProcedure(event.target.value)} placeholder="appearance,water,conductivity,ph" /></label><p>Available: appearance, water, conductivity, ph, ethanol, hexanes, magnet, melting, hcl, naoh. Quantitative: conductivity, ph, melting. Other tests are qualitative.</p>{fields.map(([key, label]) => <label key={key} style={{ display: "block", marginBlock: "0.75rem" }}>{label}<input required type="number" step="any" value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value })} /></label>)}
      <label><input type="checkbox" required /> The instructor approves this selected panel and order, instrument calibration, microscale quantities, hood controls and waste routes for the assigned materials.</label>
      {error && <p role="alert">{error}</p>}<button type="submit">Use approved setup and start</button>
    </form></main>;
};
