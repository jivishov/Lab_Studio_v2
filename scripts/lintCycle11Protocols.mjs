import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const profiles = await server.ssrLoadModule("/src/domain-packs/assay/profiles/index.ts");
  const fixtures = await server.ssrLoadModule(
    "/src/domain-packs/assay/profiles/__fixtures__/cycle11ProtocolFixtures.ts",
  );
  const assayTypes = await server.ssrLoadModule("/src/domain-packs/assay/types/index.ts");
  const assayPackModule = await server.ssrLoadModule("/src/domain-packs/assay/assayPack.ts");
  const workflows = fixtures.getCycle11ProtocolGoldenWorkflows();
  const checked = [
    profiles.xttMetabolicActivityProfile,
    profiles.educationalBrothMicrodilutionProfile,
  ];
  for (const profile of checked) {
    const validation = profiles.validateAssayProtocolProfile(profile);
    if (!validation.ok) throw new Error(JSON.stringify(validation.diagnostics));
    const fileName = profile.workflow === "xtt-metabolic-activity"
      ? "xtt-metabolic-activity.v1.json"
      : "educational-broth-microdilution.v1.json";
    const published = JSON.parse(await readFile(`public/assay-profiles/${fileName}`, "utf8"));
    if (profiles.serializeAssayProtocolProfile(published) !== profiles.serializeAssayProtocolProfile(profile)) {
      throw new Error(`Checked profile drift: ${fileName}`);
    }
  }
  for (const workflow of Object.values(workflows)) {
    const artifactValidation = assayTypes.validateAssayDefinition(workflow.assay);
    if (!artifactValidation.ok) throw new Error(JSON.stringify(artifactValidation.diagnostics));
    const serialized = assayTypes.serializeAssayDefinition(workflow.assay);
    if (assayTypes.serializeAssayDefinition(assayTypes.parseAssayDefinition(serialized)) !== serialized) {
      throw new Error(`Assay artifact canonical round-trip drift: ${workflow.assay.id}`);
    }
    const analysisValidation = profiles.validateAssayProtocolAnalysis(workflow.analysis);
    if (!analysisValidation.ok) throw new Error(JSON.stringify(analysisValidation.diagnostics));
    if (workflow.analysis.status !== "complete") throw new Error(JSON.stringify(workflow.analysis.diagnostics));
    const packaged = assayPackModule.assayDomainPack.packageArtifact(workflow.assay, {
      packageId: `${workflow.assay.id}:cycle11-lint`,
      createdAt: "2026-07-26T23:20:00.000Z",
      capabilityManifestVersion: "2.0",
    });
    if (!packaged.files.some((file) => file.role === "artifact")) {
      throw new Error(`Missing packaged artifact: ${workflow.assay.id}`);
    }
  }
  if (workflows.xtt.analysis.scientificBoundary.toLowerCase().includes("is a direct cell count")) {
    throw new Error("XTT scientific boundary uses prohibited direct-cell-count wording.");
  }
  if (JSON.stringify(workflows.mic.analysis).match(/susceptibilityCategory|treatmentAdvice/)) {
    throw new Error("MIC result leaked a forbidden clinical field.");
  }
  console.log(
    "Cycle 11 protocol lint passed: 2 checked profiles; 2 assay artifacts canonical; "
    + "XTT metabolic-proxy and non-clinical endpoint analyses complete; packages contain reopenable artifacts.",
  );
} finally {
  await server.close();
}
