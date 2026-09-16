import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    buildQti22CompanionPackage,
    createCycle16QtiFixture,
    validateQtiCompanionModel,
  } = await server.ssrLoadModule("/src/causalyst/qti/index.ts");
  const { studioFeatureFlagDefaults } = await server.ssrLoadModule("/src/platform/featureFlags.ts");
  const { assessment, model } = createCycle16QtiFixture();
  const first = buildQti22CompanionPackage(assessment, model, { generatedAt: "2026-07-27T12:00:00.000Z" });
  const second = buildQti22CompanionPackage(assessment, model, { generatedAt: "2026-07-27T12:00:00.000Z" });
  const equal = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
  if (!equal(first.zip, second.zip)) throw new Error("QTI ZIP generation is not deterministic.");
  const required = new Set(["imsmanifest.xml", "assessment.xml", "package-report.json"]);
  first.files.forEach(({ path }) => required.delete(path));
  if (required.size > 0) throw new Error(`Missing package files: ${[...required].join(", ")}`);
  if (first.files.filter(({ path }) => path.startsWith("items/")).length !== 4) throw new Error("Cycle 16 fixture must serialize all four supported item types.");
  const firstItem = new TextDecoder().decode(first.files.find(({ path }) => path === "items/claim-boundary.xml").content);
  if (!firstItem.includes("../assets/companion-marker.png")
    || !firstItem.includes("alt=\"A neutral marker")
    || !firstItem.includes("associated Causalyst activity")) {
    throw new Error("QTI item does not preserve its static-asset accessibility or associated-activity instructions.");
  }
  if (first.report.simulationEmbedding !== "not-included"
    || first.report.releaseDecision !== "disabled-pending-interoperability-validation"
    || first.report.targetLms.importStatus !== "not-run"
    || first.report.independentValidator.status !== "not-run") {
    throw new Error("QTI report overstates the release or interoperability evidence.");
  }
  if (studioFeatureFlagDefaults.causalystQtiExportV1 !== false) throw new Error("QTI export must remain default-off.");
  const paths = first.files.map(({ path }) => path);
  if (paths.some((path) => path.startsWith("/") || path.includes("\\") || path.split("/").includes(".."))) throw new Error("QTI package contains an unsafe path.");
  const reportText = new TextDecoder().decode(first.files.find(({ path }) => path === "package-report.json").content);
  if (/(embedded portable simulation|universal LMS compatibility|target LMS import passed)/i.test(reportText)) throw new Error("QTI report contains a prohibited portability claim.");
  const unsafe = structuredClone(model);
  unsafe.associatedActivity.href = "javascript:alert(1)";
  if (validateQtiCompanionModel(unsafe).ok) throw new Error("Unsafe activity URL was accepted.");
  console.log(`Cycle 16 QTI lint passed: ${first.files.length} deterministic files; 4 standard item types; safe relative package paths; companion-only/default-off report; LMS and independent-validator checks honestly not run.`);
} finally {
  await server.close();
}
