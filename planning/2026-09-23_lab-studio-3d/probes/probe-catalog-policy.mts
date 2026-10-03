// Probe: the bundled-catalogue policy on the published transmittance-dilution, as the loader applies it. Not a test run.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { assessBundledTechniqueCatalogPolicy } = await import(root + "src/data/bundledCatalogPolicyBoundary.ts");
for (const id of ["weighing", "measuring-volume", "making-solution", "dilution", "transmittance-dilution"]) {
  const raw = JSON.parse(await readFile(new URL(root + `public/techniques/${id}.json`), "utf8"));
  try {
    const result = await assessBundledTechniqueCatalogPolicy("bundled", `public/techniques/${id}.json`, raw);
    console.log(id, "accepted", JSON.stringify(result).slice(0, 200));
  } catch (error) {
    console.log(id, "REFUSED", error instanceof Error ? error.message : String(error));
  }
}
