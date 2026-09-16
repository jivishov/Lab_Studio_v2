import { useState, type FormEvent } from "react";
import type { QuickAcheSetup } from "../data/labSetup";
export const QuickAcheSetupForm = ({ onStart, error }: { onStart: (setup: QuickAcheSetup) => void; error?: string }) => {
  const [count, setCount] = useState(""); const [order, setOrder] = useState(""); const [method, setMethod] = useState<"gravity" | "vacuum">("vacuum");
  const [criterion, setCriterion] = useState(""); const [temperature, setTemperature] = useState("");
  const [ph, setPh] = useState("");
  const [organicDensity, setOrganicDensity] = useState(""); const [aqueousDensity, setAqueousDensity] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); onStart({ extractionCount: Number(count), recoveryOrder: order, filtrationMethod: method, organicRecoveryMethod: "external-unheated-evaporation", aqueousRecoveryMethod: "external-unheated-evaporation", drynessCriterion: criterion, coolingLimitC: Number(temperature), acidEndpointPh: Number(ph), organicDensity: Number(organicDensity), aqueousDensity: Number(aqueousDensity) }); };
  return <main className="route-status"><h1>Quick Ache classroom recovery</h1><p>This supported mode records externally supervised unheated solvent removal, residue, dryness, temperature and balance observations. It does not predict chemical separation, component identity or yield. Heating-based recovery requires a separately supported procedure.</p><form onSubmit={submit}>
    <label>Total approved extractions (1–5)<input required type="number" min="1" max="5" value={count} onChange={(event) => setCount(event.target.value)} /></label>
    <label>Recovery order<input required value={order} onChange={(event) => setOrder(event.target.value)} placeholder="organic,acidic,aqueous" /></label>
    <p>Order all three fractions: organic, acidic, aqueous. Aqueous filtrate recovery follows acidic filtration. Every extra wash acquires fresh mixing, venting, layer and drain evidence.</p>
    <label>Approved solid filtration<select value={method} onChange={(event) => setMethod(event.target.value as "gravity" | "vacuum")}><option value="vacuum">Vacuum</option><option value="gravity">Gravity</option></select></label>
    <label>Approved dryness criterion<textarea required value={criterion} onChange={(event) => setCriterion(event.target.value)} /></label>
    <label>Approved cooled weighing temperature (°C)<input required type="number" step="any" value={temperature} onChange={(event) => setTemperature(event.target.value)} /></label>
    <label>Approved acidification endpoint (pH at or below)<input required type="number" min="0" max="14" step="any" value={ph} onChange={(event) => setPh(event.target.value)} /></label>
    <label>Supplied organic-phase density (g/mL)<input required type="number" step="any" value={organicDensity} onChange={(event) => setOrganicDensity(event.target.value)} /></label>
    <label>Supplied aqueous-phase density (g/mL)<input required type="number" step="any" value={aqueousDensity} onChange={(event) => setAqueousDensity(event.target.value)} /></label>
    <p>The selected wash count, recovery order and filtration method determine the executed canonical subflows. Five is a software bound, not an extraction recommendation. Unresolved emulsions retain further-standing recovery; solvent removal remains externally supervised and unheated.</p>
    <label><input required type="checkbox" /> The instructor approves unheated solvent removal, ventilation and waste handling for both retained fractions.</label>
    {error && <p role="alert">{error}</p>}<button type="submit">Use approved setup and start</button>
  </form></main>;
};
