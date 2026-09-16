import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha256 = (path) => sha256Bytes(readFileSync(path));
const jsonSha256 = (value) => sha256Bytes(`${JSON.stringify(value, null, 2)}\n`);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);

const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const atomPath = "src/domain/atomRegistry.json";
const atomReaderPath = "src/domain/atomRegistry.ts";
const rolePath = "src/domain/equipmentRoleRegistry.json";
const sourceTracePath = "docs/architecture/source-trace-registry.json";
const contentCheckerPath = "scripts/checkContentConsistency.mjs";
const requestPath = `${planningRoot}/evidence/lane-05/shared-contract-request.json`;
const impactPath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_AMENDMENT_IMPACT.json`;
const baselinePath = `${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_2.json`;
const predecessorPath = `${planningRoot}/evidence/CYCLE_04_BASELINE_MANIFEST.json`;
const cycle05HandoffPath = `${planningRoot}/CONTINUATION_CYCLE_05.md`;
const statusPath = `${planningRoot}/_CYCLE_STATUS.json`;

const atomRegistry = readJson(atomPath);
const roleRegistry = readJson(rolePath);
const sourceTraceRegistry = readJson(sourceTracePath);
const request = readJson(requestPath);
const impact = readJson(impactPath);
const baseline = readJson(baselinePath);
const predecessor = readJson(predecessorPath);
const atoms = new Map(atomRegistry.atoms.map((atom) => [atom.id, atom]));
const roles = new Map(roleRegistry.roles.map((role) => [role.id, role]));

const stateEffect = "apparatus-material-instrument-state";
const acquisitionEffect = "measurement-direct-observation-acquisition";
const equipmentMaterial = ["equipment", "material"];
const acquisitionTargets = ["instrument", "measurement-observation", "evidence"];
const expectedAtoms = {
  "atom.rinse.condition-cuvette-with-sample": {
    verb: "rinse", interaction: "rinseTarget",
    effectClasses: [stateEffect], effectTargets: equipmentMaterial,
    requiredRoles: ["sample-source", "photometer-sample-holder"], optionalRoles: [],
    sourceTable: "phase", sourceStep: "S-05", sourceBasis: "M",
  },
  "atom.rinse.prepare-cuvette-optical-faces": {
    verb: "rinse", interaction: "rinseTarget",
    effectClasses: [stateEffect], effectTargets: equipmentMaterial,
    requiredRoles: ["photometer-sample-holder"], optionalRoles: [],
    sourceTable: "phase", sourceStep: "S-06", sourceBasis: "M",
  },
  "atom.observe.dark-zero-photometer": {
    verb: "observe", interaction: "readInstrument",
    effectClasses: [acquisitionEffect], effectTargets: acquisitionTargets,
    requiredRoles: ["photometer-instrument"], optionalRoles: [],
    sourceTable: "phase", sourceStep: "S-03", sourceBasis: "M",
  },
  "atom.transfer.return-cuvette-to-origin": {
    verb: "transfer", interaction: "pourInto",
    effectClasses: [stateEffect], effectTargets: equipmentMaterial,
    requiredRoles: ["photometer-sample-holder", "provenance-matched-sample-receiver"], optionalRoles: [],
    sourceTable: "phase", sourceStep: "S-09", sourceBasis: "M",
  },
  "atom.transfer.adjust-color-depth-standard": {
    verb: "transfer", interaction: "pourInto",
    effectClasses: [stateEffect], effectTargets: ["equipment", "material", "instrument"],
    requiredRoles: ["color-depth-comparison-apparatus"], optionalRoles: ["waste-receiver"],
    sourceTable: "phase", sourceStep: "V-02", sourceBasis: "M/F",
  },
  "atom.observe.read-color-depth": {
    verb: "observe", interaction: "readInstrument",
    effectClasses: [acquisitionEffect], effectTargets: acquisitionTargets,
    requiredRoles: ["color-depth-comparison-apparatus"], optionalRoles: [],
    sourceTable: "phase", sourceStep: "V-03", sourceBasis: "M/F",
  },
  "atom.transfer.treat-waste-with-solid-to-endpoint": {
    verb: "transfer", interaction: "pourInto",
    effectClasses: [stateEffect], effectTargets: equipmentMaterial,
    requiredRoles: ["solid-reagent-source", "waste-receiver"], optionalRoles: ["solid-transfer-tool"],
    sourceTable: "safety", sourceStep: "S-08", sourceBasis: "M/C",
  },
  "atom.observe.read-waste-ph-indicator": {
    verb: "observe", interaction: "readInstrument",
    effectClasses: [acquisitionEffect], effectTargets: acquisitionTargets,
    requiredRoles: ["ph-indicator-medium", "waste-receiver"], optionalRoles: [],
    sourceTable: "safety", sourceStep: "S-08", sourceBasis: "M/C",
  },
};
const addedAtomIds = Object.keys(expectedAtoms);

assert(atomRegistry.schema === "lab-studio/atom-registry@2", "Unexpected atom registry schema.");
assert(roleRegistry.schema === "lab-studio/equipment-role-registry@1", "Unexpected role registry schema.");
assert(atomRegistry.atoms.length === 128, `Expected 128 atoms, found ${atomRegistry.atoms.length}.`);
assert(roleRegistry.roles.length === 72, `Expected 72 roles, found ${roleRegistry.roles.length}.`);
assert(new Set(atomRegistry.atoms.map((atom) => atom.id)).size === atomRegistry.atoms.length, "Duplicate atom id.");
assert(new Set(roleRegistry.roles.map((role) => role.id)).size === roleRegistry.roles.length, "Duplicate role id.");
assert(Object.keys(atomRegistry.sourceTableLegend).includes("safety"), "Atom registry does not distinguish safety citations.");
assert(Object.keys(sourceTraceRegistry.sourceTableLegend).includes("safety"), "Source-trace registry does not distinguish safety citations.");

for (const [atomId, expected] of Object.entries(expectedAtoms)) {
  const atom = atoms.get(atomId);
  assert(atom, `Missing amendment atom ${atomId}.`);
  assert(atom.verb === expected.verb, `${atomId} has wrong verb ${atom.verb}.`);
  assert(same(atom.allowedInteractionTypes, [expected.interaction]), `${atomId} interaction contract changed.`);
  assert(same(atom.effectContract.classes, expected.effectClasses), `${atomId} effect classes changed.`);
  assert(same(atom.effectContract.targets.map(({ domain }) => domain), expected.effectTargets), `${atomId} effect targets changed.`);
  assert(same(atom.requiredRoles, expected.requiredRoles), `${atomId} required roles differ from the reviewed contract.`);
  assert(same(atom.optionalRoles, expected.optionalRoles), `${atomId} optional roles differ from the reviewed contract.`);
  assert(same(atom.sourceExamples, [{
    sourceFile: "how-can-color-determine-copper-in-brass_2026-07-27.md",
    sourceTable: expected.sourceTable,
    step: expected.sourceStep,
    basis: expected.sourceBasis,
  }]), `${atomId} has a stale or ambiguous source citation.`);
  assert(atom.contentExamples.length === 0, `${atomId} must remain unbound until the stale Cycle 05 lane replays.`);
  assert(atom.proceduralConstraints.length >= 3, `${atomId} lacks invalid/recovery constraints.`);
  for (const roleId of [...atom.requiredRoles, ...atom.optionalRoles]) {
    assert(roles.has(roleId), `${atomId} references unknown role ${roleId}.`);
  }
}

const evidenceOnly = atoms.get("atom.observe.prepare-cuvette-optical-faces");
assert(same(evidenceOnly?.allowedInteractionTypes, ["recordNotebook"]) &&
  same(evidenceOnly?.effectContract.classes, ["evidence-recording"]),
  "The Blue #1/crystal-violet evidence-only cuvette rule was broadened or replaced.");
assert(atoms.get("atom.observe.blank-photometer")?.requiredRoles.includes("photometer-sample-holder"),
  "Blank-holder calibration must remain distinct from the empty-compartment dark zero.");
assert(atoms.get("atom.transfer.adjust-color-depth-standard")?.proceduralConstraints.some((text) =>
  text.includes("contains no expected depth or concentration result")), "Color-depth adjustment embeds or permits an expected output.");
assert(atoms.get("atom.observe.read-color-depth")?.proceduralConstraints.some((text) =>
  text.includes("No expected depth, ratio, or concentration")), "Color-depth acquisition embeds or permits an expected output.");
assert(atoms.get("atom.transfer.treat-waste-with-solid-to-endpoint")?.proceduralConstraints.some((text) =>
  text.includes("no local undo") && text.includes("teacher-directed recovery")), "Bulk waste charge lacks explicit local recovery.");

const provenanceRole = roles.get("provenance-matched-sample-receiver");
assert(provenanceRole?.constraints.mustMatchSourceProvenance === true,
  "Origin receiver must require matching provenance.");
assert(provenanceRole?.constraints.crossSampleReturnForbidden === true,
  "Origin receiver must forbid cross-sample return.");
assert(same(provenanceRole?.allowedEquipmentIds, ["test-tube"]), "Origin receiver equipment scope changed.");

const predecessorAtomRegistry = structuredClone(atomRegistry);
predecessorAtomRegistry.atoms = predecessorAtomRegistry.atoms.filter((atom) => !addedAtomIds.includes(atom.id));
delete predecessorAtomRegistry.sourceTableLegend.safety;
const amendmentSentence = " The Cycle 05 coordinator amendment adds generic contracts for source-stated cuvette conditioning and optical preparation, two-stage photometer calibration, provenance-matched cuvette return, one-sided color-depth matching and acquisition, and incremental solid waste treatment with a pH-paper endpoint.";
assert(predecessorAtomRegistry.extensionScope.endsWith(amendmentSentence), "Atom registry amendment scope provenance changed.");
predecessorAtomRegistry.extensionScope = predecessorAtomRegistry.extensionScope.slice(0, -amendmentSentence.length);
assert(jsonSha256(predecessorAtomRegistry) === impact.contractChanges.atomRegistry.beforeSha256,
  "Existing atom registry content changed outside the eight reviewed additions and amendment scope note.");
const predecessorRoleRegistry = structuredClone(roleRegistry);
predecessorRoleRegistry.roles = predecessorRoleRegistry.roles.filter((role) => role.id !== "provenance-matched-sample-receiver");
assert(jsonSha256(predecessorRoleRegistry) === impact.contractChanges.equipmentRoleRegistry.beforeSha256,
  "Existing role registry content changed outside the reviewed provenance role addition.");

const expectedCapabilities = new Map([
  ["source-stated-cuvette-conditioning-and-optical-face-preparation", ["atom.rinse.condition-cuvette-with-sample", "atom.rinse.prepare-cuvette-optical-faces"]],
  ["two-stage-photometer-calibration", ["atom.observe.dark-zero-photometer", "atom.observe.blank-photometer"]],
  ["return-cuvette-sample-to-origin", ["atom.transfer.return-cuvette-to-origin"]],
  ["color-depth-adjustment-and-separate-depth-acquisition", ["atom.transfer.adjust-color-depth-standard", "atom.observe.read-color-depth"]],
  ["solid-bicarbonate-waste-treatment-and-ph-paper-endpoint", ["atom.transfer.treat-waste-with-solid-to-endpoint", "atom.observe.read-waste-ph-indicator"]],
]);
assert(request.missingCapabilities.length === expectedCapabilities.size, "Cycle 05 request does not retain all five capability groups.");
assert(impact.capabilities.length === expectedCapabilities.size, "Impact manifest does not resolve all five capability groups.");
for (const capability of impact.capabilities) {
  assert(expectedCapabilities.has(capability.requestId), `Unexpected impact capability ${capability.requestId}.`);
  assert(same(capability.atomIds, expectedCapabilities.get(capability.requestId)), `${capability.requestId} maps to the wrong atom boundary.`);
}

assert(sourceTraceRegistry.traces.length === 610, "Amendment must not pre-bind Cycle 05 source traces.");
assert(impact.baselineRevision === 2 && impact.state === "reviewed-candidate",
  "Impact manifest must identify reviewed-candidate baseline revision 2.");
assert(impact.criticalReview.performed === true && impact.criticalReview.accepted === true &&
  impact.criticalReview.actualModel === "gpt-5.6-sol" && impact.criticalReview.actualEffort === "xhigh" &&
  impact.criticalReview.refinementApplied === true && impact.criticalReview.resumeBlockedUntilAccepted === false,
  "Impact manifest does not record the completed xhigh review and bounded refinement.");
assert(impact.request.requestId === request.requestId && impact.request.sha256 === sha256(requestPath),
  "Impact manifest request identity mismatch.");
assert(impact.contractChanges.atomRegistry.sha256 === sha256(atomPath), "Impact atom hash is stale.");
assert(impact.contractChanges.atomRegistryReader.sha256 === sha256(atomReaderPath), "Impact atom reader hash is stale.");
assert(impact.contractChanges.equipmentRoleRegistry.sha256 === sha256(rolePath), "Impact role hash is stale.");
assert(impact.contractChanges.sourceTraceCitationMetadata.sha256 === sha256(sourceTracePath), "Impact source-trace hash is stale.");
assert(impact.contractChanges.contentChecker.sha256 === sha256(contentCheckerPath), "Impact content-checker hash is stale.");
assert(impact.contractChanges.generatedDocumentation.sha256 === sha256("docs/atomic-steps.md"), "Impact generated-doc hash is stale.");
assert(impact.contractChanges.narrowChecker.sha256 === sha256("scripts/checkCycle05SharedContractAmendment.mjs"), "Impact narrow-checker hash is stale.");
assert(impact.contractChanges.baselineCapture.sha256 === sha256("scripts/captureCycle05SharedContractBaseline.mjs"), "Impact capture hash is stale.");
assert(impact.consumers.stale.length === 1 && impact.consumers.stale[0].cycle === "05", "Exactly Cycle 05 must be stale.");
assert(impact.lineage.revision1OnlyPostFreezeMismatch.path === statusPath,
  "Revision-1 lineage must name only the coordinator status-ledger mismatch.");
assert(impact.lineage.circularHashDependencyAvoided === true, "Impact manifest must declare the non-circular identity boundary.");

assert(predecessor.baselineRevision === request.baseline.revision &&
  predecessor.fileCount === request.baseline.fileCount && predecessor.files.length === request.baseline.fileCount &&
  predecessor.aggregateSha256 === request.baseline.aggregateSha256,
  "Predecessor manifest does not match the request's reviewed baseline identity.");
assert(baseline.baselineRevision === 2 && baseline.transportMode === "sequential", "Candidate must be sequential revision 2.");
assert(baseline.fileCount === baseline.files.length, "Candidate manifest file count is internally inconsistent.");
const aggregate = createHash("sha256");
for (const file of baseline.files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
assert(aggregate.digest("hex") === baseline.aggregateSha256, "Candidate manifest aggregate is internally inconsistent.");
assert(!baseline.files.some((file) => file.path === cycle05HandoffPath), "Cycle 05 review handoff creates a circular baseline identity.");
assert(baseline.identityBoundary.excludedExact.some((item) => item.path === cycle05HandoffPath),
  "Cycle 05 review handoff exclusion is not explicit.");
assert(baseline.predecessorDelta.unexpected.length === 0, "Candidate baseline contains unexpected predecessor drift.");
assert(impact.baseline.manifestSha256 === sha256(baselinePath), "Impact baseline manifest hash is stale.");
assert(impact.baseline.fileCount === baseline.fileCount && impact.baseline.aggregateSha256 === baseline.aggregateSha256,
  "Impact baseline content identity differs from the candidate manifest.");
assert(baseline.contractDependencies.atomRegistrySha256 === sha256(atomPath) &&
  baseline.contractDependencies.atomRegistryReaderSha256 === sha256(atomReaderPath) &&
  baseline.contractDependencies.equipmentRoleRegistrySha256 === sha256(rolePath) &&
  baseline.contractDependencies.sourceTraceRegistrySha256 === sha256(sourceTracePath) &&
  baseline.contractDependencies.contentCheckerSha256 === sha256(contentCheckerPath) &&
  same(baseline.contractDependencies.sourceCitationTableKinds, ["phase", "apparatus", "safety"]),
  "Candidate shared-contract dependencies are stale.");

console.log(
  `cycle-05 shared amendment: ${addedAtomIds.length} atoms, 1 role, ${sourceTraceRegistry.traces.length} traces, ` +
  `revision ${baseline.baselineRevision}, ${baseline.fileCount} files, aggregate ${baseline.aggregateSha256}`,
);
