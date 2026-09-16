import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const root = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const manifestPath = `${root}/evidence/CYCLE_06_SHARED_CONTRACT_BASELINE_REVISION_6.json`;
const impactPath = `${root}/evidence/CYCLE_06_AP_GENERATOR_BONDING_ATOMIC_CONTRACT_AMENDMENT_IMPACT.json`;
const predecessorManifestPath = `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_5.json`;
const predecessorImpactPath = `${root}/evidence/CYCLE_05_ANALYSIS_AND_PROCEDURE_EVIDENCE_AMENDMENT_IMPACT.json`;
const predecessorCapturePath = `${root}/evidence/CYCLE_06_SHARED_CONTRACT_PREDECESSOR_REVISION_5_AP_GENERATOR_BONDING_ATOMIC_CONTRACT.json`;
const requestPath = `${root}/evidence/lane-06/shared-contract-request.json`;
const statusPath = `${root}/_CYCLE_STATUS.json`;
const handoffPath = `${root}/CONTINUATION_CYCLE_06.md`;
const expected = {
  predecessor: "843ef11963a30932b40a7dfedaf078a45a04dbbd2cf5b4fc26e324f0b138a565",
  predecessorImpact: "15191226b5d4ee74fd35b9f4146504a4e2ce7adedcbf763be0173a2827649cd8",
  request: "a9aadfe07aac7662f0c3850197442b6095ac3522bb10fd37f2bad93c3799fa70",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path) => sha(readFileSync(resolve(cwd, path)));
for (const [path, hash] of [
  [predecessorManifestPath, expected.predecessor],
  [predecessorImpactPath, expected.predecessorImpact],
  [requestPath, expected.request],
]) {
  if (fileSha(path) !== hash) throw new Error(`Immutable revision-6 lineage changed: ${path}`);
}
const predecessor = JSON.parse(readFileSync(resolve(cwd, predecessorManifestPath), "utf8"));
if (predecessor.baselineRevision !== 5 || predecessor.state !== "reviewed-frozen" || predecessor.fileCount !== 1385 || predecessor.aggregateSha256 !== "f50e1a3e763193c89df1ddf727d9418dbff0667bdaf77dd486d88f2c09c42cfb") {
  throw new Error("Revision 5 is not the accepted predecessor identity.");
}

const immutableLineage = [
  predecessorManifestPath,
  predecessorImpactPath,
  predecessorCapturePath,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_4.json`,
  `${root}/evidence/CYCLE_05_EXECUTABLE_EVIDENCE_AMENDMENT_IMPACT.json`,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_PREDECESSOR_REVISION_4_ANALYSIS_AND_PROCEDURE_EVIDENCE.json`,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_3.json`,
  `${root}/evidence/CYCLE_05_ROLE_CONTINUITY_AMENDMENT_IMPACT.json`,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_PREDECESSOR_REVISION_3_EXECUTABLE_EVIDENCE.json`,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_2.json`,
  `${root}/evidence/CYCLE_05_SHARED_CONTRACT_AMENDMENT_IMPACT.json`,
  `${root}/evidence/CYCLE_04_BASELINE_MANIFEST.json`,
  `${root}/CONTINUATION_CYCLE_04.md`,
  `${root}/CONTINUATION_CYCLE_05.md`,
];
const excludedRows = [
  { path: manifestPath, reason: "manifest self" },
  { path: impactPath, reason: "records this manifest identity" },
  ...immutableLineage.map((path) => ({ path, reason: "immutable accepted lineage control" })),
  { path: statusPath, reason: "coordinator-owned mutable status ledger" },
  { path: handoffPath, reason: "handoff records final manifest identities" },
];
const excluded = new Set(excludedRows.map((row) => row.path));
const excludedPattern = /(^|\/)(?:\.git|node_modules|dist|build|coverage|\.vite|\.cache)(\/|$)|(^|\/)\.env(?:\.|$)/i;
const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const tracked = lines(execFileSync("git", ["ls-files", "--", "."], { encoding: "utf8" }));
const untracked = lines(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "."], { encoding: "utf8" }));
const paths = [...new Set([...tracked, ...untracked])]
  .map((path) => path.replaceAll("\\", "/"))
  .filter((path) => !excluded.has(path) && !excludedPattern.test(path))
  .sort();
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

const amendmentAdded = [
  requestPath,
  "scripts/captureCycle06ApGeneratorBondingAtomicBaseline.mjs",
  "scripts/checkCycle06ApGeneratorBondingAtomicAmendment.mjs",
];
const amendmentChanged = ["scripts/generateApChemTechniqueFragments.mjs"];
const cycle06Added = ["scripts/migrateCycle06GravimetrySeparationComposition.mjs"];
const cycle06Changed = [
  "scripts/generatorInputs/apChem/gravimetrySeparation.mjs",
  "scripts/generatorInputs/simulator/paperChromatography.mjs",
  "public/labs/hard-water-analysis.json",
  "public/labs/paper-chromatography.json",
  "public/labs/bonding-unknown-solids.json",
  "public/labs/quick-ache-relief-separation.json",
  "public/techniques/hard-water-gravimetry.json",
  "public/techniques/hard-water-practice-preparation.json",
  "public/techniques/gravimetric-vacuum-filtration.json",
  "public/techniques/two-stage-precipitate-drying.json",
  "public/techniques/inquiry-plan-approval.json",
  "public/techniques/hard-water-two-sample-inquiry.json",
  "public/techniques/paper-chromatography.json",
  "public/techniques/bonding-solids-tests.json",
  "public/techniques/tablet-separation.json",
  "public/techniques/quick-ache-property-evidence.json",
  "public/techniques/quick-ache-design-approval.json",
  "public/techniques/quick-ache-extraction-recovery.json",
  "public/techniques/quick-ache-analysis-report.json",
];
const reconciledCycle05Changed = [
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
  `${root}/evidence/lane-05/technique-atomicity-overlay.json`,
  `${root}/evidence/lane-05/lab-composition-overlay.json`,
  `${root}/evidence/lane-05/source-trace-overlay.json`,
];
const same = (rows, wanted) => JSON.stringify(rows.map((row) => row.path).sort()) === JSON.stringify([...wanted].sort());
if (!same(delta.added, [...amendmentAdded, ...cycle06Added]) || !same(delta.removed, [handoffPath]) ||
    !same(delta.changed, [...amendmentChanged, ...cycle06Changed, ...reconciledCycle05Changed])) {
  throw new Error(`Unexpected revision-5 delta: ${JSON.stringify(delta)}`);
}

const aggregate = createHash("sha256");
for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
const affected = [
  "scripts/migrateCycle06GravimetrySeparationComposition.mjs",
  "scripts/checkCycle06GravimetrySeparationComposition.mjs",
  "scripts/generatorInputs/apChem/gravimetrySeparation.mjs",
  "scripts/generatorInputs/simulator/paperChromatography.mjs",
  ...cycle06Changed.filter((path) => path.startsWith("public/")),
  `${root}/evidence/lane-06/technique-atomicity-overlay.json`,
  `${root}/evidence/lane-06/lab-composition-overlay.json`,
  `${root}/evidence/lane-06/source-trace-overlay.json`,
];
const output = {
  schema: "lab-studio/shared-contract-baseline-manifest@1",
  baselineRevision: 6,
  state: "reviewed-frozen",
  criticalReviewRequired: false,
  criticalReview: { model: "gpt-5.6-sol", reasoningEffort: "xhigh", performed: true, accepted: true, reviewedAt: "2026-09-04", verdict: "accepted" },
  transportMode: "sequential",
  repositoryScope: "Lab_studio only",
  predecessor: {
    baselineRevision: 5,
    manifestPath: predecessorManifestPath,
    manifestSha256: expected.predecessor,
    impactPath: predecessorImpactPath,
    impactSha256: expected.predecessorImpact,
    capturePath: predecessorCapturePath,
    captureSha256: fileSha(predecessorCapturePath),
    fileCount: predecessor.fileCount,
    aggregateSha256: predecessor.aggregateSha256,
  },
  request: { requestId: "cycle-06-ap-generator-bonding-atomic-contract-01", path: requestPath, sha256: expected.request },
  git: {
    root: execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim().replaceAll("\\", "/"),
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    headIsCompleteBaseline: false,
  },
  identityBoundary: {
    included: "All tracked and explicitly present untracked Lab_studio files, including reconciled Cycle 05 and partial Cycle 06 lane bytes, except exact circular, coordinator, handoff, and immutable lineage controls.",
    excludedExact: excludedRows,
    excludedPatterns: [".git", "node_modules", "build/dist/coverage/cache", "real .env files"],
    partialAffectedLaneBytesIncluded: true,
    circularHashDependencyAvoided: true,
  },
  predecessorDelta: {
    ...delta,
    classifications: {
      sharedContractAmendmentChanged: amendmentChanged,
      sharedContractAmendmentAdded: amendmentAdded,
      affectedCycle06PartialChanged: cycle06Changed,
      affectedCycle06PartialAdded: cycle06Added,
      reconciledCycle05BytesChangedAfterRevision5: reconciledCycle05Changed,
      coordinatorControlExclusion: [statusPath],
      reviewHandoffExclusion: [handoffPath],
    },
    unexpected: [],
  },
  fileCount: files.length,
  aggregateSha256: aggregate.digest("hex"),
  files,
  contractDependencies: {
    compilerContractVersion: "1.5",
    apGeneratorSha256: fileSha("scripts/generateApChemTechniqueFragments.mjs"),
    amendmentCheckerSha256: fileSha("scripts/checkCycle06ApGeneratorBondingAtomicAmendment.mjs"),
    captureScriptSha256: fileSha("scripts/captureCycle06ApGeneratorBondingAtomicBaseline.mjs"),
  },
  affectedOutputs: { cycle: "06", state: "ready-for-medium-lane-replay", paths: affected },
  unaffectedCycles: ["01", "02", "03", "04", "05", "07", "08", "09", "10", "11"],
  returnProtocol: "Revision 6 is reviewed-frozen; replay the Cycle 06 lane at gpt-5.6-sol medium, then run its separate xhigh cycle review.",
};
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(resolve(cwd, manifestPath), serialized);
  console.log(`wrote ${resolve(cwd, manifestPath)}`);
} else {
  process.stdout.write(serialized);
}
