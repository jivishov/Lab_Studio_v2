import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  createConcreteEquipmentMappingTracker,
  validateCompositionManifest,
} from "../src/domain/compositionValidation.ts";
import { COMPOSITION_COMPILER_CONTRACT_VERSION } from "../src/data/compileLabComposition.ts";
import { runCompositionStaticFixtures } from "../src/data/compositionStaticFixtures.ts";

const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const requestPath = `${planningRoot}/evidence/lane-05/shared-contract-request-02-role-continuity.json`;
const predecessorPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_2.json`;
const predecessorImpactPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_AMENDMENT_IMPACT.json`;
const baselinePath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_3.json`;
const impactPath = `${planningRoot}/evidence/CYCLE_05_ROLE_CONTINUITY_AMENDMENT_IMPACT.json`;
const capturePath = "scripts/captureCycle05RoleContinuityBaseline.mjs";

const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha256 = (path) => sha256Bytes(readFileSync(path));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sorted = (values) => [...values].sort();

assert(sha256(requestPath) === "ed420f5f3c8da677d3ec28c8535a459eb868fdb7e350cb4296827302e7b944d9", "Immutable request identity changed.");
assert(sha256(predecessorPath) === "c79e1a634b4c1e979fc1ff7acb198887ae0e7a0d37f163a0c04af27af0771ce3", "Reviewed revision-2 manifest changed.");
assert(sha256(predecessorImpactPath) === "52fb5eb7a11be5c244764ca2a605e04fa57b5be3ba7fdf7e863dced70506f958", "Accepted revision-2 impact changed.");
assert(COMPOSITION_COMPILER_CONTRACT_VERSION === "1.3", "New compilation does not emit contract 1.3.");

const exactPair = createConcreteEquipmentMappingTracker();
assert(exactPair.reserve("standalone-vessel", "lab-vessel", "receiving-role") === undefined, "First concrete mapping failed.");
assert(exactPair.reserve("standalone-vessel", "lab-vessel", "weighed-role") === undefined, "Exact-pair multi-role reuse failed.");
const sourceConflict = exactPair.reserve("standalone-vessel", "other-lab-vessel", "return-role");
assert(sourceConflict?.endpoint === "source" && sourceConflict.priorTargetInstanceId === "lab-vessel", "One source -> different target was not rejected.");
const targetConflict = exactPair.reserve("other-standalone-vessel", "lab-vessel", "other-sample-role");
assert(targetConflict?.endpoint === "target" && targetConflict.priorSourceInstanceId === "standalone-vessel", "Different sources -> one target was not rejected.");

const bluePipetteContinuity = createConcreteEquipmentMappingTracker();
assert(bluePipetteContinuity.reserve(
  "standalone-graduated-pipette",
  "lab-graduated-pipette",
  "variable-volume-measuring-device",
) === undefined, "Blue pipette measuring-role mapping failed.");
assert(bluePipetteContinuity.reserve(
  "standalone-graduated-pipette",
  "lab-graduated-pipette",
  "measured-solvent-source",
) === undefined, "Blue pipette exact-pair role continuity failed.");

const brassLifecycleContinuity = createConcreteEquipmentMappingTracker();
assert(brassLifecycleContinuity.reserve(
  "standalone-standard-tube",
  "lab-standard-tube",
  "sample-source",
) === undefined, "Brass sample-source mapping failed.");
assert(brassLifecycleContinuity.reserve(
  "standalone-standard-tube",
  "lab-standard-tube",
  "provenance-matched-sample-receiver",
) === undefined, "Brass provenance-return exact-pair continuity failed.");
const mismatchedReturn = brassLifecycleContinuity.reserve(
  "standalone-standard-tube",
  "different-lab-standard-tube",
  "provenance-matched-sample-receiver",
);
assert(mismatchedReturn?.endpoint === "source" && mismatchedReturn.priorTargetInstanceId === "lab-standard-tube",
  "A mismatched provenance-return receiver was not rejected by source identity.");
const crossSampleReturn = brassLifecycleContinuity.reserve(
  "other-standalone-standard-tube",
  "lab-standard-tube",
  "provenance-matched-sample-receiver",
);
assert(crossSampleReturn?.endpoint === "target" && crossSampleReturn.priorSourceInstanceId === "standalone-standard-tube",
  "A cross-sample return collapse was not rejected by target identity.");

const fixtures = await runCompositionStaticFixtures();
assert(fixtures.roleContinuity === "exact-pair-multi-role-reuse-valid-with-bijective-conflict-rejection", "Role-continuity fixture evidence is missing.");
assert(fixtures.legacy === "techniqueRefs-hydration-compiler-contract-1.0-through-1.2-reading-and-unknown-version-rejection",
  "Legacy compiler-contract reading evidence drifted.");
const compilerSource = readFileSync("src/data/compileLabComposition.ts", "utf8");
const validationSource = readFileSync("src/domain/compositionValidation.ts", "utf8");
assert(compilerSource.includes("createConcreteEquipmentMappingTracker"), "Compiler does not consume the centralized mapping semantics.");
assert(validationSource.includes("createConcreteEquipmentMappingTracker"), "Validation does not own the centralized mapping semantics.");
assert(!/(?:blue1|brass|spectroscopy|colorimetry)/i.test(compilerSource + validationSource), "Shared mapping semantics contain a lane-specific branch.");

for (const version of ["1.0", "1.1", "1.2", "1.3"]) {
  const result = validateCompositionManifest({ schemaVersion: 1, compilerContractVersion: version, status: "compiled", instances: [], origins: [] });
  assert(result.ok, `Known compiler manifest ${version} is no longer readable.`);
}
assert(!validateCompositionManifest({ schemaVersion: 1, compilerContractVersion: "1.4", status: "compiled", instances: [], origins: [] }).ok,
  "Unknown compiler manifest 1.4 was accepted.");

const reproduced = execFileSync(process.execPath, [capturePath], { encoding: "utf8" });
assert(reproduced === readFileSync(baselinePath, "utf8"), "Revision-3 baseline capture is not deterministic.");
const baseline = readJson(baselinePath);
const impact = readJson(impactPath);
assert(baseline.baselineRevision === 3 && baseline.state === "reviewed-candidate" && baseline.criticalReviewRequired === true,
  "Revision-3 candidate state is incorrect.");
assert(baseline.predecessor.manifestSha256 === sha256(predecessorPath) && baseline.predecessor.impactSha256 === sha256(predecessorImpactPath),
  "Revision-3 lineage does not identify reviewed revision 2.");
assert(baseline.request.requestId === "cycle-05-role-continuity-02" && baseline.request.sha256 === sha256(requestPath),
  "Revision-3 request identity mismatch.");
assert(baseline.predecessorDelta.unexpected.length === 0 && baseline.identityBoundary.staleLaneBytesIncluded === true,
  "Revision-3 capture hides stale lane bytes or permits unrelated drift.");
assert(baseline.affectedOutputs.state === "stale-mid-repair" && baseline.affectedOutputs.paths.length === 15,
  "Affected Cycle 05 stale path classification is incomplete.");
const expectedStalePaths = [
  `${planningRoot}/evidence/lane-05/lab-composition-overlay.json`,
  `${planningRoot}/evidence/lane-05/source-trace-overlay.json`,
  `${planningRoot}/evidence/lane-05/technique-atomicity-overlay.json`,
  "public/labs/blue1-spectroscopy.json",
  "public/labs/brass-colorimetry.json",
  "public/techniques/beers-law-calibration.json",
  "public/techniques/blue1-class-calibration.json",
  "public/techniques/blue1-percent-transmittance.json",
  "public/techniques/blue1-standard-dilutions.json",
  "public/techniques/brass-spectrophotometry.json",
  "public/techniques/transmittance-dilution.json",
  "scripts/checkCycle05SpectroscopyComposition.mjs",
  "scripts/generatorInputs/apChem/spectroscopy.mjs",
  "scripts/generatorInputs/simulator/transmittanceDilution.mjs",
  "scripts/migrateCycle05SpectroscopyComposition.mjs",
];
assert(same(sorted(baseline.affectedOutputs.paths), sorted(expectedStalePaths)),
  "Affected Cycle 05 stale paths are not the exact reviewed inventory.");
assert(baseline.affectedOutputs.paths.filter((path) => path.startsWith("public/labs/")).length === 2,
  "Cycle 05 stale inventory must contain exactly two labs.");
assert(baseline.affectedOutputs.paths.filter((path) => path.startsWith("public/techniques/")).length === 6,
  "Cycle 05 stale inventory must contain exactly six techniques.");
assert(!baseline.affectedOutputs.paths.includes(requestPath),
  "The immutable accepted request was misclassified as stale lane output.");
assert(baseline.predecessorDelta.classifications.staleAffectedCycle05Added.includes(requestPath),
  "The immutable request is missing from the revision-2 delta classification.");
assert(same(baseline.unaffectedCycles, ["01", "02", "03", "04", "06", "07", "08", "09", "10", "11"]),
  "Unaffected-cycle classification drifted.");
assert(impact.schema === "lab-studio/shared-contract-amendment-impact@1" && impact.baselineRevision === 3 && impact.state === "reviewed-candidate",
  "Revision-3 impact state is incorrect.");
assert(impact.criticalReview.performed === true && impact.criticalReview.accepted === true &&
  impact.criticalReview.actualModel === "gpt-5.6-sol" && impact.criticalReview.actualEffort === "xhigh" &&
  impact.criticalReview.requiredModel === "gpt-5.6-sol" && impact.criticalReview.requiredEffort === "xhigh" &&
  impact.criticalReview.acceptancePending === false,
"Mandatory xhigh review acceptance record is incomplete.");
assert(impact.request.sha256 === sha256(requestPath) && impact.baseline.manifestSha256 === sha256(baselinePath),
  "Impact request or baseline identity is stale.");
for (const [key, path] of Object.entries(impact.sharedContracts)) {
  assert(impact.sharedContractSha256[key] === sha256(path), `Impact shared-contract hash is stale for ${path}.`);
}
assert(same(impact.affected.stalePaths, baseline.affectedOutputs.paths), "Impact stale-path list differs from the baseline.");
assert(same(impact.unaffected.cycles, baseline.unaffectedCycles), "Impact unaffected-cycle list differs from the baseline.");

console.log(JSON.stringify({
  ok: true,
  compilerContractVersion: COMPOSITION_COMPILER_CONTRACT_VERSION,
  fixture: fixtures.roleContinuity,
  fileCount: baseline.fileCount,
  aggregateSha256: baseline.aggregateSha256,
  manifestSha256: sha256(baselinePath),
  impactSha256: sha256(impactPath),
  staleAffectedPaths: baseline.affectedOutputs.paths.length,
  staleInventory: { labs: 2, techniques: 6, overlays: 3, scripts: 4 },
  continuityCases: ["blue-pipette", "brass-return-lifecycle"],
  unresolvedGate: "root-coordinator-status-reconciliation-and-cycle-05-replay",
}, null, 2));
