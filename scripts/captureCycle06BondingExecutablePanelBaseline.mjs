import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const root = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const manifestPath = `${root}/evidence/CYCLE_07_SHARED_CONTRACT_BASELINE_REVISION_7.json`;
const impactPath = `${root}/evidence/CYCLE_06_EXECUTABLE_BONDING_PANEL_AMENDMENT_IMPACT.json`;
const predecessorManifestPath = `${root}/evidence/CYCLE_06_SHARED_CONTRACT_BASELINE_REVISION_6.json`;
const predecessorImpactPath = `${root}/evidence/CYCLE_06_AP_GENERATOR_BONDING_ATOMIC_CONTRACT_AMENDMENT_IMPACT.json`;
const predecessorCapturePath = `${root}/evidence/CYCLE_06_SHARED_CONTRACT_PREDECESSOR_REVISION_6_EXECUTABLE_BONDING_PANEL.json`;
const requestPath = `${root}/evidence/lane-06/shared-contract-request-02-executable-bonding-panel.json`;
const expected = {
  predecessor: "478a7aa07dde09cbaa559d5c42b981d51ebbd94cc6ff3dd1e3b130345acf8e83",
  predecessorImpact: "f1b49ffbbea65501020366ccc0ee1950b1405d7f43ba4807dab936ba5d070af0",
  predecessorCapture: "2fd792eee87a10ea8a7e09f21889273d70e248faf4853f35107e817aa2692f9f",
  request: "69105195dbdd72e85e267cc47f78c677f74a6adc981ab702d04b9946d7a22f26",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path) => sha(readFileSync(resolve(cwd, path)));
for (const [path, hash] of [[predecessorManifestPath, expected.predecessor], [predecessorImpactPath, expected.predecessorImpact],
  [predecessorCapturePath, expected.predecessorCapture], [requestPath, expected.request]]) {
  if (fileSha(path) !== hash) throw new Error(`Immutable revision-7 lineage changed: ${path}`);
}
const predecessor = JSON.parse(readFileSync(resolve(cwd, predecessorManifestPath), "utf8"));
if (predecessor.baselineRevision !== 6 || predecessor.state !== "reviewed-frozen" || predecessor.fileCount !== 1388 ||
    predecessor.aggregateSha256 !== "b04d1561187236a8e277f89d407498f4cca1140ed208944c552fe812f430f596") {
  throw new Error("Revision 6 is not the accepted predecessor identity.");
}

const excludedRows = [
  { path: manifestPath, reason: "manifest self" },
  { path: impactPath, reason: "records this manifest identity" },
  { path: predecessorCapturePath, reason: "immutable revision-6 predecessor capture" },
  ...predecessor.identityBoundary.excludedExact.map((row) => ({ path: row.path, reason: "inherited immutable/circular coordinator exclusion" })),
];
const excluded = new Set(excludedRows.map((row) => row.path));
const excludedPattern = /(^|\/)(?:\.git|node_modules|dist|build|coverage|\.vite|\.cache)(\/|$)|(^|\/)\.env(?:\.|$)/i;
const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const tracked = lines(execFileSync("git", ["ls-files", "--", "."], { encoding: "utf8" }));
const untracked = lines(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "."], { encoding: "utf8" }));
const paths = [...new Set([...tracked, ...untracked])].map((path) => path.replaceAll("\\", "/"))
  .filter((path) => !excluded.has(path) && !excludedPattern.test(path)).sort();
const files = paths.map((path) => {
  const bytes = readFileSync(resolve(cwd, path));
  return { path, size: statSync(resolve(cwd, path)).size, sha256: sha(bytes) };
});
const previous = new Map(predecessor.files.map((file) => [file.path, file]));
const current = new Map(files.map((file) => [file.path, file]));
const delta = {
  added: files.filter((file) => !previous.has(file.path)),
  removed: predecessor.files.filter((file) => !current.has(file.path)),
  changed: files.filter((file) => previous.has(file.path) && previous.get(file.path).sha256 !== file.sha256)
    .map((file) => ({ path: file.path, beforeSha256: previous.get(file.path).sha256, sha256: file.sha256 })),
};
const amendmentAdded = [requestPath, "scripts/checkCycle06BondingExecutablePanelAmendment.mjs", "scripts/captureCycle06BondingExecutablePanelBaseline.mjs"];
const amendmentChanged = ["scripts/generateApChemTechniqueFragments.mjs"];
const affectedAdded = [
  "scripts/checkCycle06GravimetrySeparationComposition.mjs",
  `${root}/evidence/lane-06/technique-atomicity-overlay.json`, `${root}/evidence/lane-06/lab-composition-overlay.json`,
  `${root}/evidence/lane-06/source-trace-overlay.json`,
];
const affectedChanged = [
  "scripts/migrateCycle06GravimetrySeparationComposition.mjs", "scripts/generatorInputs/apChem/gravimetrySeparation.mjs",
  "scripts/generatorInputs/simulator/paperChromatography.mjs", "public/labs/hard-water-analysis.json",
  "public/labs/paper-chromatography.json", "public/labs/bonding-unknown-solids.json", "public/labs/quick-ache-relief-separation.json",
  "public/techniques/hard-water-gravimetry.json", "public/techniques/hard-water-practice-preparation.json",
  "public/techniques/gravimetric-vacuum-filtration.json", "public/techniques/two-stage-precipitate-drying.json",
  "public/techniques/inquiry-plan-approval.json", "public/techniques/hard-water-two-sample-inquiry.json",
  "public/techniques/paper-chromatography.json", "public/techniques/bonding-solids-tests.json", "public/techniques/tablet-separation.json",
  "public/techniques/quick-ache-property-evidence.json", "public/techniques/quick-ache-design-approval.json",
  "public/techniques/quick-ache-extraction-recovery.json", "public/techniques/quick-ache-analysis-report.json",
];
const same = (rows, expectedPaths) => JSON.stringify(rows.map((row) => row.path).sort()) === JSON.stringify([...expectedPaths].sort());
if (!same(delta.added, [...amendmentAdded, ...affectedAdded]) || delta.removed.length > 0 ||
    !same(delta.changed, [...amendmentChanged, ...affectedChanged])) {
  throw new Error(`Unexpected revision-6 delta: ${JSON.stringify(delta)}`);
}
const aggregate = createHash("sha256");
for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
const affected = [
  "scripts/migrateCycle06GravimetrySeparationComposition.mjs", "scripts/checkCycle06GravimetrySeparationComposition.mjs",
  "scripts/generatorInputs/apChem/gravimetrySeparation.mjs", "scripts/generatorInputs/simulator/paperChromatography.mjs",
  ...affectedChanged.filter((path) => path.startsWith("public/")), ...affectedAdded.filter((path) => path.includes("/lane-06/")),
];
const output = {
  schema: "lab-studio/shared-contract-baseline-manifest@1", baselineRevision: 7, state: "reviewed-pending", criticalReviewRequired: true,
  criticalReview: { model: "gpt-5.6-sol", reasoningEffort: "xhigh", performed: false, accepted: false, verdict: "pending" },
  transportMode: "sequential", repositoryScope: "Lab_studio only",
  predecessor: { baselineRevision: 6, manifestPath: predecessorManifestPath, manifestSha256: expected.predecessor,
    impactPath: predecessorImpactPath, impactSha256: expected.predecessorImpact, capturePath: predecessorCapturePath,
    captureSha256: expected.predecessorCapture, fileCount: predecessor.fileCount, aggregateSha256: predecessor.aggregateSha256 },
  request: { requestId: "cycle-06-bonding-executable-per-sample-contract-02", path: requestPath, sha256: expected.request },
  git: { root: execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim().replaceAll("\\", "/"),
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), headIsCompleteBaseline: false },
  identityBoundary: { included: "All tracked and explicitly present untracked Lab_studio files, including the stale Cycle 06 lane candidate that must replay, except exact circular, coordinator, handoff, and immutable lineage controls.",
    excludedExact: excludedRows, excludedPatterns: [".git", "node_modules", "build/dist/coverage/cache", "real .env files"],
    staleAffectedLaneBytesIncluded: true, circularHashDependencyAvoided: true },
  predecessorDelta: { ...delta, classifications: { sharedContractAmendmentChanged: amendmentChanged,
    sharedContractAmendmentAdded: amendmentAdded, staleAffectedCycle06Changed: affectedChanged,
    staleAffectedCycle06Added: affectedAdded }, unexpected: [] },
  fileCount: files.length, aggregateSha256: aggregate.digest("hex"), files,
  contractDependencies: { compilerContractVersion: "1.5", apGeneratorSha256: fileSha("scripts/generateApChemTechniqueFragments.mjs"),
    amendmentCheckerSha256: fileSha("scripts/checkCycle06BondingExecutablePanelAmendment.mjs"),
    captureScriptSha256: fileSha("scripts/captureCycle06BondingExecutablePanelBaseline.mjs") },
  affectedOutputs: { cycle: "06", state: "replay-and-review-after-amendment-acceptance", paths: affected },
  expectedReplayGate: { target: "bonding-solids-tests", currentActions: 53, requiredActions: 42,
    classification: "expected-stale-lane-input-contract-failure" },
  unaffectedCycles: ["01", "02", "03", "04", "05", "07", "08", "09", "10", "11"],
  returnProtocol: "Revision 7 is reviewed-pending; run and accept the separate gpt-5.6-sol xhigh amendment review before Cycle 06 replay.",
};
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) { writeFileSync(resolve(cwd, manifestPath), serialized); console.log(`wrote ${resolve(cwd, manifestPath)}`); }
else process.stdout.write(serialized);
