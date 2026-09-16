import { useState } from "react";
import type { TitrationSetup } from "../data/labSetup";

export function TitrationSetupForm({ labId, onStart, error }: { labId: string; onStart: (setup: TitrationSetup) => void; error?: string }) {
  const [values, setValues] = useState<Record<string,string>>({});
  const beverage = labId === "beverage-acidity";
  const fields = [
    ["endpointWindowMl", "Approved endpoint acceptance window (mL)"],
    ["persistenceSeconds", "Required color persistence (seconds)"],
    ["maximumIncrementMl", "Largest permitted titrant addition (mL)"],
    ...(labId !== "hydrogen-peroxide-redox-titration" ? [["indicatorVolumeMl", "Approved indicator addition (mL; simulation setting)"]] : []),
    ...(labId !== "hydrogen-peroxide-redox-titration" ? [["indicatorStartPh", "Approved phenolphthalein color-onset pH"], ["indicatorStrongPh", "Approved strong-color pH threshold"]] : []),
    ["conditioningVolumeMl", "Titrant volume for burette conditioning (mL)"],
    ["tipPurgeMl", "Approved tip-purge volume (mL)"],
    ["rinseVolumeMl", "Receiver rinse volume (mL)"],
    ...(labId === "hydrogen-peroxide-redox-titration" ? [["standardizationRangeM", "Approved maximum range among standardization trials (mol/L)"]] : []),
    ...(beverage ? [["sampleAMolarityM", "Sample A model concentration (mol/L; instructor input)"], ["sampleBMolarityM", "Sample B model concentration (mol/L; instructor input)"], ["beverageAliquotMl", "Fresh beverage aliquot (mL, at most 10 mL)"], ["naohMolarityM", "Standardized NaOH: 0.10 or 0.25 mol/L"]] : []),
  ];
  return <main className="route-status">
    <h1>Teacher titration setup</h1>
    <p>Enter the approved quantities and endpoint rule before starting. Settings remain fixed during this investigation; a changed plan starts a fresh run.</p>
    <p>{beverage ? "This supported example uses a monoprotic acetic-acid proxy and phenolphthalein for two beverage samples, with two independent quantitative trials each. It does not predict arbitrary mixed or polyprotic beverages. Supply prepared samples; confirm any required degassing and color-interference handling in the sample preparation protocol." : labId === "hydrogen-peroxide-redox-titration" ? "The configured inquiry includes a bounded practice, three independent iron standardizations, and two trials for each assigned peroxide sample. These counts and the simulated unknown concentrations are configuration choices. Acid/aliquot amounts are requested during execution; standardization must finish before sample analysis." : "This reference exercise uses the disclosed weak-acetic-acid model, a 25 mL aliquot, 0.100 M NaOH, and phenolphthalein. These are reference configuration choices, not a source-prescribed procedure."}</p>
    <form onSubmit={event => {event.preventDefault(); onStart({ titrationSetup: true, ...Object.fromEntries(fields.map(([key])=>[key,Number(values[key])])), wasteProtocol: values.wasteProtocol ?? "", preparationProtocol: values.preparationProtocol ?? "" } as TitrationSetup);}}>
      {fields.map(([key,label])=><label key={key} style={{display:"block",marginBlock:"0.75rem"}}>{label}<input required type="number" min="0" step="any" value={values[key]??""} onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}
      <label style={{display:"block"}}>Instructor-approved waste and rinsate route<textarea required value={values.wasteProtocol??""} onChange={e=>setValues({...values,wasteProtocol:e.target.value})}/></label>
      <label style={{display:"block"}}>Approved sample preparation, probe readiness, and indicator protocol<textarea required value={values.preparationProtocol??""} onChange={e=>setValues({...values,preparationProtocol:e.target.value})}/></label>
      <label><input required type="checkbox"/> The instructor approves the supported model, independent trial counts, apparatus, safety precautions, preparation, and waste route.</label>
      {error&&<p role="alert">{error}</p>}
      <button type="submit">Start with approved settings</button>
    </form>
  </main>;
}
