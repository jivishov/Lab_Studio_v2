import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const root = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const manifestPath = `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_5.json`;
const impactPath = `${root}/evidence/CYCLE_05_ANALYSIS_AND_PROCEDURE_EVIDENCE_AMENDMENT_IMPACT.json`;
const predecessorManifestPath = `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_4.json`;
const predecessorImpactPath = `${root}/evidence/CYCLE_05_EXECUTABLE_EVIDENCE_AMENDMENT_IMPACT.json`;
const predecessorCapturePath = `${root}/evidence/CYCLE_05_SHARED_CONTRACT_PREDECESSOR_REVISION_4_ANALYSIS_AND_PROCEDURE_EVIDENCE.json`;
const requestPath = `${root}/evidence/lane-05/shared-contract-request-04-analysis-and-procedure-evidence.json`;
const statusPath = `${root}/_CYCLE_STATUS.json`;
const handoffPath = `${root}/CONTINUATION_CYCLE_05.md`;
const expected = {
  predecessor: "fc7e66901ee17c66c7088e364ad9d0e3772f2eb9ae0a77d6043e063fd734c1b1",
  predecessorImpact: "66cf3670cebd420812125a511c6a414889ff11e16ba12e22ae4bd33a141b8803",
  predecessorCapture: "25faec421c0e5a9450732b45f11ca27a45a139d6f9252c249b5ff85895ad6896",
  request: "17ebc93b68a831abb68507a470f5bb091fa925bb0ffa9fc7dc8e79df93479ebc",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path) => sha(readFileSync(resolve(cwd, path)));
for (const [path, hash] of [[predecessorManifestPath, expected.predecessor], [predecessorImpactPath, expected.predecessorImpact], [predecessorCapturePath, expected.predecessorCapture], [requestPath, expected.request]]) {
  if (fileSha(path) !== hash) throw new Error(`Immutable revision-5 lineage changed: ${path}`);
}
const predecessor = JSON.parse(readFileSync(resolve(cwd, predecessorManifestPath), "utf8"));
if (predecessor.baselineRevision !== 4 || predecessor.state !== "reviewed-frozen" || predecessor.fileCount !== 1382 || predecessor.aggregateSha256 !== "fa8c9ec99d059db40d836f6e4cef959d874705a92b932d2c93280648c0d79033") throw new Error("Revision 4 is not the accepted predecessor identity.");

const older = [
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_3.json`, `${root}/evidence/CYCLE_05_ROLE_CONTINUITY_AMENDMENT_IMPACT.json`,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_PREDECESSOR_REVISION_3_EXECUTABLE_EVIDENCE.json`, `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_2.json`,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_AMENDMENT_IMPACT.json`, `${root}/evidence/CYCLE_04_BASELINE_MANIFEST.json`, `${root}/CONTINUATION_CYCLE_04.md`,
];
const excludedRows = [
  { path: manifestPath, reason: "manifest self" }, { path: impactPath, reason: "records this manifest identity" },
  { path: predecessorManifestPath, reason: "immutable revision-4 full identity control" }, { path: predecessorImpactPath, reason: "immutable revision-4 impact control" },
  { path: predecessorCapturePath, reason: "immutable revision-4 predecessor capture" }, ...older.map((path) => ({ path, reason: "immutable older lineage control" })),
  { path: statusPath, reason: "coordinator-owned mutable status ledger" }, { path: handoffPath, reason: "handoff records final manifest identities" },
];
const excluded = new Set(excludedRows.map((row) => row.path));
const excludedPattern = /(^|\/)(?:\.git|node_modules|dist|build|coverage|\.vite|\.cache)(\/|$)|(^|\/)\.env(?:\.|$)/i;
const lines = (value) => value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const tracked = lines(execFileSync("git", ["ls-files", "--", "."], { encoding: "utf8" }));
const untracked = lines(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "."], { encoding: "utf8" }));
const paths = [...new Set([...tracked, ...untracked])].map((p) => p.replaceAll("\\", "/")).filter((p) => !excluded.has(p) && !excludedPattern.test(p)).sort();
const files = paths.map((path) => { const bytes = readFileSync(resolve(cwd, path)); return { path, size: statSync(resolve(cwd, path)).size, sha256: sha(bytes) }; });
const previous = new Map(predecessor.files.map((file) => [file.path, file]));
const current = new Map(files.map((file) => [file.path, file]));
const delta = {
  added: files.filter((file) => !previous.has(file.path)),
  removed: predecessor.files.filter((file) => !current.has(file.path)),
  changed: files.filter((file) => previous.has(file.path) && previous.get(file.path).sha256 !== file.sha256).map((file) => ({ path: file.path, beforeSha256: previous.get(file.path).sha256, sha256: file.sha256 })),
};
const expectedAdded = [requestPath, "scripts/checkCycle05AnalysisProcedureEvidenceAmendment.mjs", "scripts/captureCycle05AnalysisProcedureEvidenceBaseline.mjs"];
const expectedChanged = ["scripts/tsCompositionLoader.mjs", "src/data/compileLabComposition.ts", "src/data/compositionStaticFixtures.ts", "src/domain/compositionValidation.ts", "src/domain/types.ts", "src/domain/validation.ts", "src/runtime/actionInputs.ts", "src/runtime/reducer.ts"];
const same = (rows, wanted) => JSON.stringify(rows.map((x) => x.path).sort()) === JSON.stringify([...wanted].sort());
if (!same(delta.added, expectedAdded) || !same(delta.removed, []) || !same(delta.changed, expectedChanged)) throw new Error(`Unexpected revision-4 delta: ${JSON.stringify(delta)}`);
const aggregate = createHash("sha256"); for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
const affected = [
  "scripts/migrateCycle05SpectroscopyComposition.mjs", "scripts/checkCycle05SpectroscopyComposition.mjs", "scripts/generatorInputs/apChem/spectroscopy.mjs", "scripts/generatorInputs/simulator/transmittanceDilution.mjs",
  "public/techniques/transmittance-dilution.json", "public/techniques/beers-law-calibration.json", "public/techniques/brass-spectrophotometry.json", "public/techniques/blue1-standard-dilutions.json",
  "public/techniques/blue1-percent-transmittance.json", "public/techniques/blue1-class-calibration.json", "public/labs/blue1-spectroscopy.json", "public/labs/brass-colorimetry.json",
  `${root}/evidence/lane-05/technique-atomicity-overlay.json`, `${root}/evidence/lane-05/lab-composition-overlay.json`, `${root}/evidence/lane-05/source-trace-overlay.json`,
];
const output = {
  schema: "lab-studio/shared-contract-baseline-manifest@1", baselineRevision: 5, state: "reviewed-frozen", criticalReviewRequired: false,
  criticalReview: { model: "gpt-5.6-sol", reasoningEffort: "xhigh", performed: true, accepted: true, reviewedAt: "2026-09-04", verdict: "accepted" }, transportMode: "sequential", repositoryScope: "Lab_studio only",
  predecessor: { baselineRevision: 4, manifestPath: predecessorManifestPath, manifestSha256: expected.predecessor, impactPath: predecessorImpactPath, impactSha256: expected.predecessorImpact, capturePath: predecessorCapturePath, captureSha256: expected.predecessorCapture, fileCount: predecessor.fileCount, aggregateSha256: predecessor.aggregateSha256 },
  request: { requestId: "cycle-05-analysis-and-procedure-evidence-04", path: requestPath, sha256: expected.request },
  git: { root: execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim().replaceAll("\\", "/"), branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(), head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), headIsCompleteBaseline: false },
  identityBoundary: { included: "All tracked and explicitly present untracked Lab_studio files, including unchanged stale Cycle 05 lane bytes, except exact circular, coordinator, handoff, and immutable lineage controls.", excludedExact: excludedRows, excludedPatterns: [".git", "node_modules", "build/dist/coverage/cache", "real .env files"], staleLaneBytesIncluded: true, circularHashDependencyAvoided: true },
  predecessorDelta: { ...delta, classifications: { sharedContractAmendmentChanged: expectedChanged, sharedContractAmendmentAdded: expectedAdded, staleAffectedCycle05UnchangedFromRevision5Window: affected, coordinatorControlExclusion: [statusPath], reviewHandoffExclusion: [handoffPath] }, unexpected: [] },
  fileCount: files.length, aggregateSha256: aggregate.digest("hex"), files,
  contractDependencies: { compilerContractVersion: "1.5", compilerSha256: fileSha("src/data/compileLabComposition.ts"), compositionValidationSha256: fileSha("src/domain/compositionValidation.ts"), domainTypesSha256: fileSha("src/domain/types.ts"), domainValidationSha256: fileSha("src/domain/validation.ts"), compositionFixturesSha256: fileSha("src/data/compositionStaticFixtures.ts"), actionInputsSha256: fileSha("src/runtime/actionInputs.ts"), runtimeReducerSha256: fileSha("src/runtime/reducer.ts"), amendmentCheckerSha256: fileSha("scripts/checkCycle05AnalysisProcedureEvidenceAmendment.mjs"), captureScriptSha256: fileSha("scripts/captureCycle05AnalysisProcedureEvidenceBaseline.mjs") },
  affectedOutputs: { cycle: "05", state: "ready-for-medium-lane-replay", paths: affected }, unaffectedCycles: ["01", "02", "03", "04", "06", "07", "08", "09", "10", "11"],
  returnProtocol: "Revision 5 is reviewed-frozen; replay the Cycle 05 lane at gpt-5.6-sol medium.",
};
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) { writeFileSync(resolve(cwd, manifestPath), serialized); console.log(`wrote ${resolve(cwd, manifestPath)}`); } else process.stdout.write(serialized);
