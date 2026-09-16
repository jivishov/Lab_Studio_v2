import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const root = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const manifestPath = `${root}/evidence/CYCLE_08_SHARED_CONTRACT_BASELINE_REVISION_8.json`;
const impactPath = `${root}/evidence/CYCLE_06_BONDING_SCALAR_CONFIGURATION_AMENDMENT_IMPACT.json`;
const predecessorPath = `${root}/evidence/CYCLE_07_SHARED_CONTRACT_BASELINE_REVISION_7.json`;
const predecessorImpactPath = `${root}/evidence/CYCLE_06_EXECUTABLE_BONDING_PANEL_AMENDMENT_IMPACT.json`;
const predecessorCapturePath = `${root}/evidence/CYCLE_07_SHARED_CONTRACT_PREDECESSOR_REVISION_7_BONDING_SCALAR_CONFIGURATION.json`;
const requestPath = `${root}/evidence/lane-06/shared-contract-request-03-scalar-configuration-placeholders.json`;
const expected = {
  predecessor: "55416fd97b61533c0effcb91c999fd7aacf9ba517d53e53f42eca6b841ce9ab7",
  predecessorImpact: "948c5980d4d007294b01b9e3bd8c2d656fd8b14c6ce7bd30bb75259829a23475",
  predecessorCapture: "f4687c7938f846367bd7f2a4c3da42682d8a72a86e9dee61dc49842e0d66e7d4",
  request: "d6a4e37393723ff7cd97d8a6d7b9cd7e9fec5bec4c2d2e36a5d4f7c5783e10be",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path) => sha(readFileSync(resolve(cwd, path)));
for (const [path, hash] of [[predecessorPath, expected.predecessor], [predecessorImpactPath, expected.predecessorImpact],
  [predecessorCapturePath, expected.predecessorCapture], [requestPath, expected.request]]) {
  if (fileSha(path) !== hash) throw new Error(`Immutable revision-8 lineage changed: ${path}`);
}
const predecessor = JSON.parse(readFileSync(resolve(cwd, predecessorPath), "utf8"));
if (predecessor.baselineRevision !== 7 || predecessor.state !== "reviewed-frozen" || predecessor.fileCount !== 1395 ||
    predecessor.aggregateSha256 !== "646b7e469e85ca7fc29dedc123c3daac1006d0987881ea171262fc88d1fb1953") {
  throw new Error("Revision 7 is not the accepted predecessor identity.");
}

const excludedRows = [
  { path: manifestPath, reason: "manifest self" },
  { path: impactPath, reason: "records this manifest identity" },
  { path: predecessorCapturePath, reason: "immutable revision-7 predecessor capture" },
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
const amendmentAdded = [requestPath, "scripts/captureCycle06BondingScalarConfigurationBaseline.mjs"];
const amendmentChanged = ["scripts/generateApChemTechniqueFragments.mjs", "scripts/checkCycle06BondingExecutablePanelAmendment.mjs"];
const same = (rows, expectedPaths) => JSON.stringify(rows.map((row) => row.path).sort()) === JSON.stringify([...expectedPaths].sort());
if (!same(delta.added, amendmentAdded) || delta.removed.length > 0 || !same(delta.changed, amendmentChanged)) {
  throw new Error(`Unexpected revision-7 delta: ${JSON.stringify(delta)}`);
}
const aggregate = createHash("sha256");
for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
const affected = predecessor.affectedOutputs.paths;
const output = {
  schema: "lab-studio/shared-contract-baseline-manifest@1", baselineRevision: 8, state: "reviewed-frozen", criticalReviewRequired: false,
  criticalReview: { model: "gpt-5.6-sol", reasoningEffort: "xhigh", performed: true, accepted: true, reviewedAt: "2026-09-04", verdict: "accepted" },
  transportMode: "sequential", repositoryScope: "Lab_studio only",
  predecessor: { baselineRevision: 7, manifestPath: predecessorPath, manifestSha256: expected.predecessor,
    impactPath: predecessorImpactPath, impactSha256: expected.predecessorImpact, capturePath: predecessorCapturePath,
    captureSha256: expected.predecessorCapture, fileCount: predecessor.fileCount, aggregateSha256: predecessor.aggregateSha256 },
  request: { requestId: "cycle-06-bonding-scalar-configuration-placeholders-03", path: requestPath, sha256: expected.request },
  identityBoundary: { included: "All tracked and explicitly present untracked Lab_studio files except exact circular, coordinator, handoff, and immutable lineage controls.",
    excludedExact: excludedRows, excludedPatterns: [".git", "node_modules", "build/dist/coverage/cache", "real .env files"],
    staleAffectedLaneBytesIncluded: true, circularHashDependencyAvoided: true },
  predecessorDelta: { ...delta, classifications: { sharedContractAmendmentChanged: amendmentChanged,
    sharedContractAmendmentAdded: amendmentAdded }, unexpected: [] },
  fileCount: files.length, aggregateSha256: aggregate.digest("hex"), files,
  contractDependencies: { compilerContractVersion: "1.5", apGeneratorSha256: fileSha("scripts/generateApChemTechniqueFragments.mjs"),
    amendmentCheckerSha256: fileSha("scripts/checkCycle06BondingExecutablePanelAmendment.mjs"),
    captureScriptSha256: fileSha("scripts/captureCycle06BondingScalarConfigurationBaseline.mjs") },
  affectedOutputs: { cycle: "06", state: "ready-for-medium-lane-replay", paths: affected },
  expectedReplayGate: predecessor.expectedReplayGate,
  unaffectedCycles: predecessor.unaffectedCycles,
  returnProtocol: "Revision 8 is reviewed-frozen; replay Cycle 06 at gpt-5.6-sol medium, then run its separate xhigh cycle review.",
};
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) { writeFileSync(resolve(cwd, manifestPath), serialized); console.log(`wrote ${resolve(cwd, manifestPath)}`); }
else process.stdout.write(serialized);
