import { useState, type FormEvent } from "react";
import type { HardWaterSetup } from "../data/labSetup";
export const HardWaterSetupForm = ({ onStart, error }: { onStart: (setup: HardWaterSetup) => void; error?: string }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const fields = [["ovenTemperatureC", "Oven temperature (110–120 °C)"], ["firstDurationMinutes", "First drying stage (10–15 minutes)"], ["coolingTemperatureC", "Approved room-temperature weighing endpoint (°C)"]];
  const submit = (event: FormEvent) => { event.preventDefault(); onStart(Object.fromEntries(fields.map(([key]) => [key, Number(values[key])])) as unknown as HardWaterSetup); };
  return <main className="route-status"><h1>Hard-water classroom setup</h1><p>The source requires a separate five-minute second drying stage. Each drying step acquires elapsed-time evidence. Rinse volumes and constant-mass criteria are entered at their steps.</p><form onSubmit={submit}>{fields.map(([key, label]) => <label key={key} style={{ display: "block", marginBlock: "0.75rem" }}>{label}<input type="number" step="any" required value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value })} /></label>)}{error && <p role="alert">{error}</p>}<button type="submit">Use approved setup and start</button></form></main>;
};
