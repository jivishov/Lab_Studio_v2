import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const manifestPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_4.json`;
const impactPath = `${planningRoot}/evidence/CYCLE_05_EXECUTABLE_EVIDENCE_AMENDMENT_IMPACT.json`;
const predecessorManifestPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_3.json`;
const predecessorImpactPath = `${planningRoot}/evidence/CYCLE_05_ROLE_CONTINUITY_AMENDMENT_IMPACT.json`;
const predecessorCapturePath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_PREDECESSOR_REVISION_3_EXECUTABLE_EVIDENCE.json`;
const requestPath = `${planningRoot}/evidence/lane-05/shared-contract-request-03-executable-evidence.json`;
const statusPath = `${planningRoot}/_CYCLE_STATUS.json`;
const handoffPath = `${planningRoot}/CONTINUATION_CYCLE_05.md`;
const immutableOlderControls = [
  `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_2.json`,
  `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_AMENDMENT_IMPACT.json`,
  `${planningRoot}/evidence/CYCLE_04_BASELINE_MANIFEST.json`,
  `${planningRoot}/CONTINUATION_CYCLE_04.md`,
];

const expectedPredecessorSha256 = "08a8871d51e35967ac994510c9948ab9ac1aad3cc4c021f6d227ae2ed14574cd";
const expectedPredecessorImpactSha256 = "b1a421670e3681de1c4f821d656ed03e550634a5d487c28053f90d331d2df1c4";
const expectedCaptureSha256 = "bd0d0009f968b44425104588a49c7318bccb6f04a30797de1569369bedfe62fe";
const expectedRequestSha256 = "7eeaf50b4b8951ce34b982d2615172d1bfa07418ad046562f907ed52c8f54a9c";
const sharedChanged = [
  "src/data/compileLabComposition.ts",
  "src/data/compositionStaticFixtures.ts",
  "src/domain/compositionValidation.ts",
  "src/domain/types.ts",
  "src/domain/validation.ts",
  "src/runtime/reducer.ts",
];
const sharedAdded = [
  requestPath,
  "scripts/checkCycle05ExecutableEvidenceAmendment.mjs",
  "scripts/captureCycle05ExecutableEvidenceBaseline.mjs",
];
const affectedOutputs = [
  "scripts/migrateCycle05SpectroscopyComposition.mjs",
  "scripts/checkCycle05SpectroscopyComposition.mjs",
  "scripts/generatorInputs/apChem/spectroscopy.mjs",
  "scripts/generatorInputs/simulator/transmittanceDilution.mjs",
  "public/techniques/transmittance-dilution.json",
  "public/techniques/beers-law-calibration.json",
  "public/techniques/brass-spectrophotometry.json",
  "public/techniques/blue1-standard-dilutions.json",
  "public/techniques/blue1-percent-transmittance.json",
  "public/techniques/blue1-class-calibration.json",
  "public/labs/blue1-spectroscopy.json",
  "public/labs/brass-colorimetry.json",
  `${planningRoot}/evidence/lane-05/technique-atomicity-overlay.json`,
  `${planningRoot}/evidence/lane-05/lab-composition-overlay.json`,
  `${planningRoot}/evidence/lane-05/source-trace-overlay.json`,
];
const preexistingCycle05Changed = affectedOutputs.filter((path) => path !== "public/techniques/blue1-class-calibration.json");

const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha256 = (path) => sha256(readFileSync(resolve(cwd, path)));
const samePaths = (rows, expected) => JSON.stringify(rows.map((row) => row.path).sort()) === JSON.stringify([...expected].sort());

for (const [path, expected] of [
  [predecessorManifestPath, expectedPredecessorSha256],
  [predecessorImpactPath, expectedPredecessorImpactSha256],
  [predecessorCapturePath, expectedCaptureSha256],
  [requestPath, expectedRequestSha256],
]) {
  if (fileSha256(path) !== expected) throw new Error(`Immutable revision-4 lineage changed: ${path}`);
}
const predecessor = JSON.parse(readFileSync(resolve(cwd, predecessorManifestPath), "utf8"));
if (predecessor.baselineRevision !== 3 || predecessor.fileCount !== 1379 ||
  predecessor.aggregateSha256 !== "3f602b891d06c3a4de65f53dba5c03110eec79c15b80708b79c6a6e9f7da6849") {
  throw new Error("Revision-3 full baseline is not the accepted predecessor identity.");
}

const excludedRows = [
  { path: manifestPath, reason: "manifest self" },
  { path: impactPath, reason: "records this manifest identity" },
  { path: predecessorManifestPath, reason: "immutable revision-3 full identity control" },
  { path: predecessorImpactPath, reason: "immutable revision-3 impact control" },
  { path: predecessorCapturePath, reason: "immutable clean-HEAD predecessor capture" },
  ...immutableOlderControls.map((path) => ({ path, reason: "immutable older lineage control" })),
  { path: statusPath, reason: "coordinator-owned mutable status ledger" },
  { path: handoffPath, reason: "handoff records final manifest identities" },
];
const excludedExact = new Set(excludedRows.map((row) => row.path));
const excludedPattern = /(^|\/)(?:\.git|node_modules|dist|build|coverage|\.vite|\.cache)(\/|$)|(^|\/)\.env(?:\.|$)/i;
const tracked = lines(execFileSync("git", ["ls-files", "--", "."], { encoding: "utf8" }));
const untracked = lines(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "."], { encoding: "utf8" }));
const candidates = [...new Set([...tracked, ...untracked])]
  .map((path) => path.replaceAll("\\", "/"))
  .filter((path) => !excludedExact.has(path) && !excludedPattern.test(path))
  .sort();
const files = candidates.map((path) => {
  const bytes = readFileSync(resolve(cwd, path));
  return { path, size: statSync(resolve(cwd, path)).size, sha256: sha256(bytes) };
});
const previous = new Map(predecessor.files.map((file) => [file.path, file]));
const current = new Map(files.map((file) => [file.path, file]));
const predecessorDelta = {
  added: files.filter((file) => !previous.has(file.path)),
  removed: predecessor.files.filter((file) => !current.has(file.path)),
  changed: files.filter((file) => previous.has(file.path) && previous.get(file.path).sha256 !== file.sha256)
    .map((file) => ({ path: file.path, beforeSha256: previous.get(file.path).sha256, sha256: file.sha256 })),
};
if (!samePaths(predecessorDelta.added, sharedAdded) || !samePaths(predecessorDelta.removed, []) ||
  !samePaths(predecessorDelta.changed, [...preexistingCycle05Changed, ...sharedChanged])) {
  throw new Error(`Unexpected revision-3 delta: ${JSON.stringify(predecessorDelta)}`);
}
const aggregate = createHash("sha256");
for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
const output = {
  schema: "lab-studio/shared-contract-baseline-manifest@1",
  baselineRevision: 4,
  state: "reviewed-frozen",
  criticalReviewRequired: false,
  criticalReview: {
    model: "gpt-5.6-sol",
    reasoningEffort: "xhigh",
    performed: true,
    accepted: true,
    acceptedAt: "2026-09-04",
  },
  transportMode: "sequential",
  repositoryScope: "Lab_studio only",
  predecessor: {
    baselineRevision: 3, manifestPath: predecessorManifestPath, manifestSha256: expectedPredecessorSha256,
    impactPath: predecessorImpactPath, impactSha256: expectedPredecessorImpactSha256,
    capturePath: predecessorCapturePath, captureSha256: expectedCaptureSha256,
    fileCount: predecessor.fileCount, aggregateSha256: predecessor.aggregateSha256,
  },
  request: { requestId: "cycle-05-executable-evidence-03", path: requestPath, sha256: expectedRequestSha256 },
  git: {
    root: execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim().replaceAll("\\", "/"),
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    headIsCompleteBaseline: false,
  },
  identityBoundary: {
    included: "All tracked and explicitly present untracked Lab_studio files, including unchanged stale Cycle 05 lane bytes, except the exact circular, coordinator, handoff, and immutable lineage controls below.",
    excludedExact: excludedRows,
    excludedPatterns: [".git", "node_modules", "build/dist/coverage/cache", "real .env files"],
    staleLaneBytesIncluded: true,
    circularHashDependencyAvoided: true,
  },
  predecessorDelta: {
    ...predecessorDelta,
    classifications: {
      sharedContractAmendmentChanged: sharedChanged,
      sharedContractAmendmentAdded: sharedAdded,
      preexistingCycle05ReplayChangedBeforeRevision4: preexistingCycle05Changed,
      staleAffectedCycle05UnchangedFromRevision4Window: affectedOutputs,
      coordinatorControlExclusion: [statusPath],
      reviewHandoffExclusion: [handoffPath],
    },
    unexpected: [],
  },
  fileCount: files.length,
  aggregateSha256: aggregate.digest("hex"),
  files,
  contractDependencies: {
    compilerContractVersion: "1.4",
    compilerSha256: fileSha256("src/data/compileLabComposition.ts"),
    compositionValidationSha256: fileSha256("src/domain/compositionValidation.ts"),
    domainTypesSha256: fileSha256("src/domain/types.ts"),
    domainValidationSha256: fileSha256("src/domain/validation.ts"),
    compositionFixturesSha256: fileSha256("src/data/compositionStaticFixtures.ts"),
    runtimeReducerSha256: fileSha256("src/runtime/reducer.ts"),
    amendmentCheckerSha256: fileSha256("scripts/checkCycle05ExecutableEvidenceAmendment.mjs"),
    captureScriptSha256: fileSha256("scripts/captureCycle05ExecutableEvidenceBaseline.mjs"),
  },
  affectedOutputs: { cycle: "05", state: "stale-replay-required", paths: affectedOutputs },
  unaffectedCycles: ["01", "02", "03", "04", "06", "07", "08", "09", "10", "11"],
  returnProtocol: "Revision 4 is xhigh-reviewed and frozen; Cycle 05 medium lane replay may now begin against this exact identity.",
};
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(resolve(cwd, manifestPath), serialized);
  console.log(`wrote ${resolve(cwd, manifestPath)}`);
} else process.stdout.write(serialized);
