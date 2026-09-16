import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { createServer } from "vite";

const mode = process.argv.includes("--check") ? "check" : "write";
const projectRoot = process.cwd();
const outputPath = resolve(projectRoot, "public/capabilities/v2/manifest.json");
const server = await createServer({
  root: projectRoot,
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const chemistry = await server.ssrLoadModule("/src/domain-packs/chemistry/capabilityFragment.ts");
  const assay = await server.ssrLoadModule("/src/domain-packs/assay/capabilityFragment.ts");
  const assayEvidence = await server.ssrLoadModule("/src/domain-packs/assay/evidenceRegistry.ts");
  const capabilities = await server.ssrLoadModule("/src/platform/capabilities/index.ts");
  const evidence = await server.ssrLoadModule("/src/platform/evidence/index.ts");
  const registry = evidence.createEvidenceRegistry([
    evidence.coreEvidenceRegistryFragment,
    assayEvidence.getAssayEvidenceRegistryFragment(),
  ]);
  const manifest = capabilities.mergeCapabilityManifestFragments(
    [
      chemistry.getChemistryCapabilityManifestFragment(),
      assay.getAssayCapabilityManifestFragment(),
    ],
    chemistry.chemistryCapabilityManifestGeneratedAt,
    { evidenceTypeIds: registry.typeIds },
  );
  const generated = capabilities.serializeCapabilityManifest(manifest, { evidenceTypeIds: registry.typeIds });
  if (mode === "check") {
    let checked = "";
    try {
      checked = await readFile(outputPath, "utf8");
    } catch {
      process.stderr.write(`Capability manifest is missing: ${outputPath}\n`);
      process.exitCode = 1;
    }
    if (checked && checked !== generated) {
      process.stderr.write(`Capability manifest drift detected: ${outputPath}\n`);
      process.exitCode = 1;
    } else if (checked) {
      process.stdout.write(`Capability manifest is current: ${outputPath}\n`);
    }
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, generated, "utf8");
    process.stdout.write(`Wrote capability manifest: ${outputPath}\n`);
  }
} finally {
  await server.close();
}
