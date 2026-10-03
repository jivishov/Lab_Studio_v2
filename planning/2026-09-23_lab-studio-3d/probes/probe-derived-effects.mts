// Probe: the handler-derived effect contract of transmittance-dilution's atomless actions. Not a test run.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { deriveActionEffectContract } = await import(root + "src/domain/atomRegistry.ts");
const raw = JSON.parse(await readFile(new URL(root + "public/techniques/transmittance-dilution.json"), "utf8"));
for (const action of raw.actions.filter((a: any) => !a.atomId)) {
  const derived = deriveActionEffectContract(action);
  console.log(action.id, JSON.stringify(derived.contract), derived.errors.join("; "));
}
