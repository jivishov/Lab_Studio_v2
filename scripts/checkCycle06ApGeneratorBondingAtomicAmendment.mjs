import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { refineGravimetrySeparationDefinition } from "./generatorInputs/apChem/gravimetrySeparation.mjs";

const root = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const requestPath = `${root}/evidence/lane-06/shared-contract-request.json`;
const predecessorPath = `${root}/evidence/CYCLE_06_SHARED_CONTRACT_PREDECESSOR_REVISION_5_AP_GENERATOR_BONDING_ATOMIC_CONTRACT.json`;
const baselinePath = `${root}/evidence/CYCLE_06_SHARED_CONTRACT_BASELINE_REVISION_6.json`;
const impactPath = `${root}/evidence/CYCLE_06_AP_GENERATOR_BONDING_ATOMIC_CONTRACT_AMENDMENT_IMPACT.json`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const definition = refineGravimetrySeparationDefinition({ id: "bonding-solids-tests" });
const actionIds = definition.actions.map((action) => action.id);
const nodeActionIds = definition.process.nodes.map((node) => node.actionId);
const orderedActionIds = [
  "inv6-label-knowns", "inv6-known-color", "inv6-known-dispense-aqueous-microsample",
  "inv6-known-add-water-solvent", "inv6-known-water-solubility", "inv6-known-dispense-organic-microsample",
  "inv6-known-add-ethanol-solvent", "inv6-known-ethanol-solubility", "inv6-known-hexanes-solubility",
  "inv6-known-solid-conductivity", "inv6-known-read-aqueous-conductivity", "inv6-known-aqueous-conductivity",
  "inv6-known-read-ph-indicator", "inv6-known-ph", "inv6-known-dispense-dry-microsample",
  "inv6-known-test-magnetic-response", "inv6-known-stage-melting-sample", "inv6-known-read-melting-behavior",
  "inv6-known-melting", "inv6-known-hcl-reaction", "inv6-known-naoh-reaction", "inv6-known-magnetism",
  "inv6-known-dispose-aqueous-stream", "inv6-known-dispose-organic-stream", "inv6-complete-known-matrix",
  "inv6-derive-bonding-rules", "inv6-build-flowchart", "inv6-validate-blue-solid",
  "inv6-label-unknowns", "inv6-unknown-color", "inv6-unknown-dispense-aqueous-microsample",
  "inv6-unknown-add-water-solvent", "inv6-unknown-water-solubility", "inv6-unknown-dispense-organic-microsample",
  "inv6-unknown-add-ethanol-solvent", "inv6-unknown-ethanol-solubility", "inv6-unknown-hexanes-solubility",
  "inv6-unknown-solid-conductivity", "inv6-unknown-read-aqueous-conductivity", "inv6-unknown-aqueous-conductivity",
  "inv6-unknown-read-ph-indicator", "inv6-unknown-ph", "inv6-unknown-dispense-dry-microsample",
  "inv6-unknown-test-magnetic-response", "inv6-unknown-stage-melting-sample", "inv6-unknown-read-melting-behavior",
  "inv6-unknown-melting", "inv6-unknown-hcl-reaction", "inv6-unknown-naoh-reaction", "inv6-unknown-magnetism",
  "inv6-unknown-dispose-aqueous-stream", "inv6-unknown-dispose-organic-stream", "inv6-complete-unknown-matrix",
];
const expectedPairs = orderedActionIds.map((actionId) => ({ actionId, nodeId: `lab-${actionId}-node` }));
const actualPairs = definition.actions.map((action, index) => ({
  actionId: action.id,
  nodeId: definition.process.nodes[index]?.id,
  nodeActionId: definition.process.nodes[index]?.actionId,
}));
const expectedEdges = expectedPairs.slice(1).map((pair, index) => ({ from: expectedPairs[index].nodeId, to: pair.nodeId }));
const actualEdges = definition.process.edges.map((edge) => ({ from: edge.from, to: edge.to }));
const evidencePartitions = {
  known: [
    "inv6-label-knowns", "inv6-known-color", "inv6-known-dispense-aqueous-microsample",
    "inv6-known-add-water-solvent", "inv6-known-water-solubility", "inv6-known-dispense-organic-microsample",
    "inv6-known-add-ethanol-solvent", "inv6-known-ethanol-solubility", "inv6-known-hexanes-solubility",
    "inv6-known-solid-conductivity", "inv6-known-read-aqueous-conductivity", "inv6-known-aqueous-conductivity",
    "inv6-known-read-ph-indicator", "inv6-known-ph", "inv6-known-dispense-dry-microsample",
    "inv6-known-test-magnetic-response", "inv6-known-stage-melting-sample", "inv6-known-read-melting-behavior",
    "inv6-known-melting", "inv6-known-hcl-reaction", "inv6-known-naoh-reaction", "inv6-known-magnetism",
    "inv6-known-dispose-aqueous-stream", "inv6-known-dispose-organic-stream", "inv6-complete-known-matrix",
  ],
  unknown: [
    "inv6-label-unknowns", "inv6-unknown-color", "inv6-unknown-dispense-aqueous-microsample",
    "inv6-unknown-add-water-solvent", "inv6-unknown-water-solubility", "inv6-unknown-dispense-organic-microsample",
    "inv6-unknown-add-ethanol-solvent", "inv6-unknown-ethanol-solubility", "inv6-unknown-hexanes-solubility",
    "inv6-unknown-solid-conductivity", "inv6-unknown-read-aqueous-conductivity", "inv6-unknown-aqueous-conductivity",
    "inv6-unknown-read-ph-indicator", "inv6-unknown-ph", "inv6-unknown-dispense-dry-microsample",
    "inv6-unknown-test-magnetic-response", "inv6-unknown-stage-melting-sample", "inv6-unknown-read-melting-behavior",
    "inv6-unknown-melting", "inv6-unknown-hcl-reaction", "inv6-unknown-naoh-reaction", "inv6-unknown-magnetism",
    "inv6-unknown-dispose-aqueous-stream", "inv6-unknown-dispose-organic-stream", "inv6-complete-unknown-matrix",
  ],
};
assert(definition.metadata.version === "1.1.0", "Bonding refinement version changed.");
assert(actionIds.length === 53 && definition.process.nodes.length === 53 && definition.process.edges.length === 52,
  "Bonding refinement is not the 53-operation linear execution matrix.");
assert(JSON.stringify(actualPairs) === JSON.stringify(expectedPairs.map((pair) => ({ ...pair, nodeActionId: pair.actionId }))),
  "Bonding refinement does not preserve the exact ordered 53 action/node pairs.");
assert(JSON.stringify(actualEdges) === JSON.stringify(expectedEdges),
  "Bonding refinement does not preserve the exact 52 adjacent process edges.");
assert(new Set(actionIds).size === 53 && new Set(nodeActionIds).size === 53,
  "Bonding refinement contains duplicate or reused actions/nodes.");
assert(definition.process.startNodeId === "lab-inv6-label-knowns-node" && definition.process.nodes.at(-1)?.id === "lab-inv6-complete-unknown-matrix-node",
  "Bonding known/unknown execution boundaries changed.");
const legacy = ["observe-solid-appearance", "observe-solubility", "observe-conductivity", "observe-melting", "observe-magnetism", "inspect-solid-appearance", "record-solid-appearance"];
assert(legacy.every((id) => !actionIds.includes(id)), "A forbidden legacy bonding composite returned.");
const effects = new Set((definition.composition?.legacyActionEffects ?? []).map((entry) => entry.actionId));
const partitionByActionId = new Map(Object.entries(evidencePartitions).flatMap(([partition, ids]) => ids.map((id) => [id, partition])));
assert(evidencePartitions.known.length === 25 && evidencePartitions.unknown.length === 25 && partitionByActionId.size === 50,
  "Known/unknown evidence partition map is incomplete.");
for (const action of definition.actions) {
  assert(action.interaction && Array.isArray(action.evidence) && action.evidence.length > 0, `${action.id} lacks interaction/evidence.`);
  assert(action.atomId || effects.has(action.id), `${action.id} lacks atom/effect coverage.`);
  const partition = partitionByActionId.get(action.id);
  if (partition) {
    const opposite = partition === "known" ? "unknown" : "known";
    assert(action.evidence.includes(partition) && !action.evidence.includes(opposite), `${action.id} crosses evidence partitions.`);
    const node = definition.process.nodes.find((item) => item.actionId === action.id);
    assert(node?.config?.preservesBlindIdentity === true, `${action.id} does not preserve blind identity.`);
  }
}
for (const node of definition.process.nodes) {
  assert(node.validation.length === 1 && node.validation[0].type === "actionEvidence" && node.validation[0].actionId === node.actionId,
    `${node.id} is not atomically evidence-gated.`);
}

const driver = readFileSync("scripts/generateApChemTechniqueFragments.mjs", "utf8");
const parseIndex = driver.indexOf("const onlyIds = (() =>");
const refineIndex = driver.indexOf("for (let index = 0; index < definitions.length; index += 1)");
const validateIndex = driver.indexOf("for (const [id, expectation] of atomicContractExpectations)");
assert(parseIndex >= 0 && parseIndex < refineIndex && refineIndex < validateIndex, "--only is not applied before refinement/validation.");
assert(driver.includes("if (!selectedDefinitionIds.has(definition.id)) continue;") && driver.includes("if (!selectedDefinitionIds.has(id)) continue;"),
  "Targeted refinement/validation isolation is missing.");
assert(driver.includes("definitions.filter((item) => !externallyOwnedDefinitionIds.has(item.id)).map((item) => item.id)"),
  "Full generation no longer selects every shared-driver-owned definition for validation.");

const request = readJson(requestPath);
const predecessor = readJson(predecessorPath);
const baseline = readJson(baselinePath);
const impact = readJson(impactPath);
assert(request.requestId === "cycle-06-ap-generator-bonding-atomic-contract-01" && request.baselineRevision === 5,
  "Cycle 06 request lineage is wrong.");
assert(request.status === "coordinator-amendment-accepted-reviewed-frozen" && request.coordinatorDisposition?.candidateBaselineRevision === 6 &&
  request.coordinatorDisposition?.criticalReview?.performed === true && request.coordinatorDisposition?.criticalReview?.accepted === true,
  "Cycle 06 request disposition is not reviewed-frozen.");
assert(predecessor.baselineRevision === 5 && predecessor.nextRevision === 6 && predecessor.lineage.manifestSha256 === "843ef11963a30932b40a7dfedaf078a45a04dbbd2cf5b4fc26e324f0b138a565",
  "Revision-5 predecessor capture is wrong.");
assert(baseline.baselineRevision === 6 && baseline.state === "reviewed-frozen" && baseline.criticalReviewRequired === false &&
  baseline.criticalReview.performed === true && baseline.criticalReview.accepted === true &&
  baseline.criticalReview.model === "gpt-5.6-sol" && baseline.criticalReview.reasoningEffort === "xhigh",
  "Revision-6 accepted review gate is not frozen.");
assert(baseline.request.sha256 === sha256(requestPath) && baseline.predecessor.captureSha256 === sha256(predecessorPath),
  "Revision-6 lineage hashes are stale.");
assert(Array.isArray(baseline.files) && baseline.files.length === baseline.fileCount && baseline.fileCount > 1385,
  "Revision-6 manifest is not a full-file identity.");
const aggregate = createHash("sha256");
for (const file of baseline.files) {
  assert(file.sha256 === sha256(file.path), `Revision-6 hash is stale for ${file.path}.`);
  aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
}
assert(aggregate.digest("hex") === baseline.aggregateSha256, "Revision-6 aggregate is stale.");
assert(impact.baselineRevision === 6 && impact.state === "reviewed-frozen" && impact.criticalReview.acceptancePending === false &&
  impact.criticalReview.performed === true && impact.criticalReview.accepted === true && impact.criticalReview.finalVerdict === "accepted",
  "Revision-6 impact review gate is not frozen.");
assert(impact.affected.cycles.length === 1 && impact.affected.cycles[0] === "06" && impact.affected.ownedPaths.length === 24,
  "Revision-6 affected replay boundary is incomplete.");

console.log(JSON.stringify({
  ok: true,
  bondingActions: actionIds.length,
  bondingNodes: definition.process.nodes.length,
  baselineState: baseline.state,
  baselineFileCount: baseline.fileCount,
  baselineAggregateSha256: baseline.aggregateSha256,
  affectedReplayPaths: impact.affected.ownedPaths.length,
}, null, 2));
