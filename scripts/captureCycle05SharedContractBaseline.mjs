import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const manifestPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_2.json`;
const impactPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_AMENDMENT_IMPACT.json`;
const requestPath = `${planningRoot}/evidence/lane-05/shared-contract-request.json`;
const statusPath = `${planningRoot}/_CYCLE_STATUS.json`;
const revision1ManifestPath = `${planningRoot}/evidence/CYCLE_04_BASELINE_MANIFEST.json`;
const cycle04HandoffPath = `${planningRoot}/CONTINUATION_CYCLE_04.md`;
const cycle05HandoffPath = `${planningRoot}/CONTINUATION_CYCLE_05.md`;

const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const request = JSON.parse(readFileSync(resolve(cwd, requestPath), "utf8"));
const statusDelta = request.baseline.verification.coordinatorControlFileDeltas;
if (request.baseline.revision !== 1 || request.baseline.verification.contentFileMismatches !== 0 ||
    statusDelta.length !== 1 || statusDelta[0].path !== statusPath) {
  throw new Error("Revision-1 lineage is not the reviewed one-ledger-delta state; refusing to restamp it.");
}

const tracked = lines(execFileSync("git", ["ls-files", "--", "."], { encoding: "utf8" }));
const untracked = lines(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "."], { encoding: "utf8" }));
const excludedExact = new Set([
  manifestPath,
  impactPath,
  statusPath,
  revision1ManifestPath,
  cycle04HandoffPath,
  cycle05HandoffPath,
]);
const excludedPattern = /(^|\/)(?:\.git|node_modules|dist|build|coverage|\.vite|\.cache)(\/|$)|(^|\/)\.env(?:\.|$)/i;
const candidates = [...new Set([...tracked, ...untracked])]
  .map((path) => path.replaceAll("\\", "/"))
  .filter((path) => !excludedExact.has(path) && !excludedPattern.test(path))
  .sort();
const files = candidates.map((path) => {
  const absolute = resolve(cwd, path);
  const bytes = readFileSync(absolute);
  return { path, size: statSync(absolute).size, sha256: sha256(bytes) };
});
const predecessor = JSON.parse(readFileSync(resolve(cwd, revision1ManifestPath), "utf8"));
if (predecessor.schema !== "lab-studio/cycle-04-baseline-manifest@1" ||
    predecessor.baselineRevision !== request.baseline.revision ||
    predecessor.fileCount !== request.baseline.fileCount ||
    predecessor.aggregateSha256 !== request.baseline.aggregateSha256 ||
    predecessor.files.length !== request.baseline.fileCount) {
  throw new Error("Revision-1 manifest bytes do not match the reviewed request identity; refusing to restamp it.");
}
const predecessorFiles = new Map(predecessor.files.map((file) => [file.path, file]));
const candidateFiles = new Map(files.map((file) => [file.path, file]));
const predecessorDelta = {
  added: files.filter((file) => !predecessorFiles.has(file.path)),
  removed: predecessor.files.filter((file) => !candidateFiles.has(file.path)),
  changed: files
    .filter((file) => predecessorFiles.has(file.path) && predecessorFiles.get(file.path).sha256 !== file.sha256)
    .map((file) => ({
      path: file.path,
      beforeSha256: predecessorFiles.get(file.path).sha256,
      sha256: file.sha256,
    })),
};
const deltaPaths = (rows) => rows.map((row) => row.path).sort();
const samePaths = (actual, expected) => JSON.stringify(deltaPaths(actual)) === JSON.stringify([...expected].sort());
const expectedAdded = [
  requestPath,
  "scripts/captureCycle05SharedContractBaseline.mjs",
  "scripts/checkCycle05SharedContractAmendment.mjs",
];
const expectedRemoved = [statusPath, cycle05HandoffPath];
const expectedChanged = [
  "docs/atomic-steps.md",
  "docs/architecture/source-trace-registry.json",
  "docs/step-and-image-consistency-audit.md",
  "scripts/checkContentConsistency.mjs",
  "src/domain/atomRegistry.json",
  "src/domain/atomRegistry.ts",
  "src/domain/equipmentRoleRegistry.json",
];
if (!samePaths(predecessorDelta.added, expectedAdded) ||
    !samePaths(predecessorDelta.removed, expectedRemoved) ||
    !samePaths(predecessorDelta.changed, expectedChanged)) {
  throw new Error(`Unexpected revision-1 drift: ${JSON.stringify(predecessorDelta)}`);
}
const aggregate = createHash("sha256");
for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);

const output = {
  schema: "lab-studio/shared-contract-baseline-manifest@1",
  baselineRevision: 2,
  state: "reviewed-candidate",
  criticalReviewRequired: true,
  transportMode: "sequential",
  repositoryScope: "Lab_studio only",
  predecessor: {
    baselineRevision: 1,
    manifestPath: revision1ManifestPath,
    fileCount: request.baseline.fileCount,
    aggregateSha256: request.baseline.aggregateSha256,
    verifiedContentMatches: request.baseline.verification.contentFileMatches,
    verifiedContentMismatches: request.baseline.verification.contentFileMismatches,
    onlyPostFreezeMismatch: statusDelta[0],
  },
  git: {
    root: execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim().replaceAll("\\", "/"),
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    headIsCompleteBaseline: false,
  },
  identityBoundary: {
    included: "All tracked and explicitly present untracked Lab_studio files except the exact coordinator and review-handoff exclusions below.",
    excludedExact: [
      { path: manifestPath, reason: "manifest self" },
      { path: impactPath, reason: "records this manifest identity and therefore remains outside the content aggregate" },
      { path: statusPath, reason: "coordinator-owned mutable status ledger; the sole reviewed revision-1 post-freeze mismatch" },
      { path: revision1ManifestPath, reason: "immutable predecessor identity control" },
      { path: cycle04HandoffPath, reason: "preserves the revision-1 manifest exclusion boundary" },
      { path: cycle05HandoffPath, reason: "review handoff records final revision-2 identities and must not feed those identities back into the aggregate" },
    ],
    excludedPatterns: [".git", "node_modules", "build/dist/coverage/cache", "real .env files"],
    circularHashDependencyAvoided: true,
  },
  predecessorDelta: {
    ...predecessorDelta,
    classifications: {
      sharedContractAmendment: [
        "src/domain/atomRegistry.json",
        "src/domain/atomRegistry.ts",
        "src/domain/equipmentRoleRegistry.json",
        "docs/atomic-steps.md",
        "docs/architecture/source-trace-registry.json",
        "docs/step-and-image-consistency-audit.md",
        "scripts/checkContentConsistency.mjs",
        "scripts/captureCycle05SharedContractBaseline.mjs",
        "scripts/checkCycle05SharedContractAmendment.mjs",
      ],
      blockedLaneEvidence: [requestPath],
      coordinatorControlExclusion: [statusPath],
      reviewHandoffExclusion: [cycle05HandoffPath],
    },
    unexpected: [],
  },
  fileCount: files.length,
  aggregateSha256: aggregate.digest("hex"),
  files,
  contractDependencies: {
    compilerContractVersion: "1.2",
    atomRegistrySha256: sha256(readFileSync(resolve(cwd, "src/domain/atomRegistry.json"))),
    atomRegistryReaderSha256: sha256(readFileSync(resolve(cwd, "src/domain/atomRegistry.ts"))),
    equipmentRoleRegistrySha256: sha256(readFileSync(resolve(cwd, "src/domain/equipmentRoleRegistry.json"))),
    sourceTraceRegistrySha256: sha256(readFileSync(resolve(cwd, "docs/architecture/source-trace-registry.json"))),
    contentCheckerSha256: sha256(readFileSync(resolve(cwd, "scripts/checkContentConsistency.mjs"))),
    sourceCitationTableKinds: ["phase", "apparatus", "safety"],
    atomicityAuditSha256: sha256(readFileSync(resolve(cwd, `${planningRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`))),
    labCompositionAuditSha256: sha256(readFileSync(resolve(cwd, `${planningRoot}/LAB_COMPOSITION_AUDIT.json`))),
  },
  returnProtocol: "Cycle 05 resumes sequentially from this candidate only after the separately required xhigh critical review accepts the amendment and the root coordinator reconciles status.",
};

const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(resolve(cwd, manifestPath), serialized);
  console.log(`wrote ${resolve(cwd, manifestPath)}`);
} else {
  process.stdout.write(serialized);
}
