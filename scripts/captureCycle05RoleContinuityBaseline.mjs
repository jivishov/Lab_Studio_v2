import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const manifestPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_3.json`;
const impactPath = `${planningRoot}/evidence/CYCLE_05_ROLE_CONTINUITY_AMENDMENT_IMPACT.json`;
const predecessorManifestPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_2.json`;
const predecessorImpactPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_AMENDMENT_IMPACT.json`;
const revision1ManifestPath = `${planningRoot}/evidence/CYCLE_04_BASELINE_MANIFEST.json`;
const requestPath = `${planningRoot}/evidence/lane-05/shared-contract-request-02-role-continuity.json`;
const statusPath = `${planningRoot}/_CYCLE_STATUS.json`;
const cycle04HandoffPath = `${planningRoot}/CONTINUATION_CYCLE_04.md`;
const cycle05HandoffPath = `${planningRoot}/CONTINUATION_CYCLE_05.md`;

const expectedPredecessorManifestSha256 = "c79e1a634b4c1e979fc1ff7acb198887ae0e7a0d37f163a0c04af27af0771ce3";
const expectedPredecessorImpactSha256 = "52fb5eb7a11be5c244764ca2a605e04fa57b5be3ba7fdf7e863dced70506f958";
const expectedRequestSha256 = "ed420f5f3c8da677d3ec28c8535a459eb868fdb7e350cb4296827302e7b944d9";

const sharedChanged = [
  "src/data/compileLabComposition.ts",
  "src/data/compositionStaticFixtures.ts",
  "src/domain/compositionValidation.ts",
  "src/domain/types.ts",
  "src/domain/validation.ts",
];
const sharedAdded = [
  "scripts/captureCycle05RoleContinuityBaseline.mjs",
  "scripts/checkCycle05RoleContinuityAmendment.mjs",
];
const staleAdded = [
  requestPath,
  `${planningRoot}/evidence/lane-05/lab-composition-overlay.json`,
  `${planningRoot}/evidence/lane-05/source-trace-overlay.json`,
  `${planningRoot}/evidence/lane-05/technique-atomicity-overlay.json`,
  "scripts/checkCycle05SpectroscopyComposition.mjs",
  "scripts/migrateCycle05SpectroscopyComposition.mjs",
];
const staleChanged = [
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
];

const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha256 = (path) => sha256(readFileSync(resolve(cwd, path)));
const samePaths = (rows, expected) => JSON.stringify(rows.map((row) => row.path).sort()) === JSON.stringify([...expected].sort());

if (fileSha256(predecessorManifestPath) !== expectedPredecessorManifestSha256 ||
    fileSha256(predecessorImpactPath) !== expectedPredecessorImpactSha256 ||
    fileSha256(requestPath) !== expectedRequestSha256) {
  throw new Error("Reviewed revision-2 or immutable request lineage changed; refusing revision-3 capture.");
}
const predecessor = JSON.parse(readFileSync(resolve(cwd, predecessorManifestPath), "utf8"));
if (predecessor.baselineRevision !== 2 || predecessor.state !== "reviewed-candidate" ||
    predecessor.fileCount !== 1371 ||
    predecessor.aggregateSha256 !== "9c57fc74980c8e93f815a34b06c0b2039b92c195769a120e12f77ca2f3f884c3") {
  throw new Error("Revision-2 manifest content is not the reviewed predecessor.");
}

const excludedExact = new Set([
  manifestPath,
  impactPath,
  predecessorManifestPath,
  predecessorImpactPath,
  revision1ManifestPath,
  statusPath,
  cycle04HandoffPath,
  cycle05HandoffPath,
]);
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
const predecessorFiles = new Map(predecessor.files.map((file) => [file.path, file]));
const candidateFiles = new Map(files.map((file) => [file.path, file]));
const predecessorDelta = {
  added: files.filter((file) => !predecessorFiles.has(file.path)),
  removed: predecessor.files.filter((file) => !candidateFiles.has(file.path)),
  changed: files.filter((file) => predecessorFiles.has(file.path) && predecessorFiles.get(file.path).sha256 !== file.sha256)
    .map((file) => ({ path: file.path, beforeSha256: predecessorFiles.get(file.path).sha256, sha256: file.sha256 })),
};
if (!samePaths(predecessorDelta.added, [...sharedAdded, ...staleAdded]) ||
    !samePaths(predecessorDelta.removed, []) ||
    !samePaths(predecessorDelta.changed, [...sharedChanged, ...staleChanged])) {
  throw new Error(`Unexpected revision-2 drift: ${JSON.stringify(predecessorDelta)}`);
}

const aggregate = createHash("sha256");
for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
const output = {
  schema: "lab-studio/shared-contract-baseline-manifest@1",
  baselineRevision: 3,
  state: "reviewed-candidate",
  criticalReviewRequired: true,
  transportMode: "sequential",
  repositoryScope: "Lab_studio only",
  predecessor: {
    baselineRevision: 2,
    manifestPath: predecessorManifestPath,
    manifestSha256: expectedPredecessorManifestSha256,
    impactPath: predecessorImpactPath,
    impactSha256: expectedPredecessorImpactSha256,
    fileCount: predecessor.fileCount,
    aggregateSha256: predecessor.aggregateSha256,
  },
  request: { requestId: "cycle-05-role-continuity-02", path: requestPath, sha256: expectedRequestSha256 },
  git: {
    root: execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim().replaceAll("\\", "/"),
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    headIsCompleteBaseline: false,
  },
  identityBoundary: {
    included: "All tracked and explicitly present untracked Lab_studio files, including exact stale Cycle 05 lane bytes, except the exact coordinator, predecessor-control, self, impact, and handoff exclusions below.",
    excludedExact: [
      { path: manifestPath, reason: "manifest self" },
      { path: impactPath, reason: "records this manifest identity" },
      { path: predecessorManifestPath, reason: "immutable reviewed revision-2 identity control" },
      { path: predecessorImpactPath, reason: "immutable accepted revision-2 impact control" },
      { path: revision1ManifestPath, reason: "immutable revision-1 lineage control" },
      { path: statusPath, reason: "coordinator-owned mutable status ledger" },
      { path: cycle04HandoffPath, reason: "preserves predecessor exclusion boundary" },
      { path: cycle05HandoffPath, reason: "handoff records final identities and stale lane state" },
    ],
    excludedPatterns: [".git", "node_modules", "build/dist/coverage/cache", "real .env files"],
    staleLaneBytesIncluded: true,
    circularHashDependencyAvoided: true,
  },
  predecessorDelta: {
    ...predecessorDelta,
    classifications: {
      sharedContractAmendmentChanged: sharedChanged,
      sharedContractAmendmentAdded: sharedAdded,
      staleAffectedCycle05Added: staleAdded,
      staleAffectedCycle05Changed: staleChanged,
      coordinatorControlExclusion: [statusPath],
      reviewHandoffExclusion: [cycle05HandoffPath],
    },
    unexpected: [],
  },
  fileCount: files.length,
  aggregateSha256: aggregate.digest("hex"),
  files,
  contractDependencies: {
    compilerContractVersion: "1.3",
    compilerSha256: fileSha256("src/data/compileLabComposition.ts"),
    compositionValidationSha256: fileSha256("src/domain/compositionValidation.ts"),
    domainTypesSha256: fileSha256("src/domain/types.ts"),
    domainValidationSha256: fileSha256("src/domain/validation.ts"),
    compositionFixturesSha256: fileSha256("src/data/compositionStaticFixtures.ts"),
    fixtureCheckerSha256: fileSha256("scripts/checkTechniqueCompositionFixtures.mjs"),
    atomRegistrySha256: fileSha256("src/domain/atomRegistry.json"),
    equipmentRoleRegistrySha256: fileSha256("src/domain/equipmentRoleRegistry.json"),
    sourceTraceRegistrySha256: fileSha256("docs/architecture/source-trace-registry.json"),
  },
  affectedOutputs: { cycle: "05", state: "stale-mid-repair", paths: [...staleAdded.filter((path) => path !== requestPath), ...staleChanged].sort() },
  unaffectedCycles: ["01", "02", "03", "04", "06", "07", "08", "09", "10", "11"],
  returnProtocol: "Cycle 05 remains blocked until mandatory gpt-5.6-sol xhigh review accepts revision 3 and the root coordinator reconciles status; stale lane output must then be replayed and reviewed.",
};

const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(resolve(cwd, manifestPath), serialized);
  console.log(`wrote ${resolve(cwd, manifestPath)}`);
} else {
  process.stdout.write(serialized);
}
