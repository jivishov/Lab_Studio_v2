// Probe: standalone status and host labs of the remaining Pack 1 techniques. Not a test run.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { standaloneTechniqueConfigurationBlocker, configurationSlots } = await import(root + "src/data/techniqueConfiguration.ts");
const { hostLabsForTechnique } = await import(root + "src/data/techniqueHosts.ts");
for (const id of ["measuring-volume", "making-solution", "dilution"]) {
  const raw = JSON.parse(await readFile(new URL(root + `public/techniques/${id}.json`), "utf8"));
  console.log(id, "| blocker:", standaloneTechniqueConfigurationBlocker(raw), "| hosts:", JSON.stringify(hostLabsForTechnique(id).map((h: any) => h.id)));
  console.log("   slots:", JSON.stringify(configurationSlots(raw).map((s: any) => [s.id, s.kind, s.unit, s.defaultValue])));
}
