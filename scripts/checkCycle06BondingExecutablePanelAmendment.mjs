import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const actionIds = [
  "label-test-locations", "inspect-solid-appearance", "record-solid-appearance", "dispense-water-microsample",
  "apply-water-solvent", "inspect-water-solubility", "record-water-solubility", "read-aqueous-conductivity",
  "record-aqueous-conductivity", "read-ph-indicator", "record-ph", "dispose-water-test-line",
  "dispense-ethanol-microsample", "apply-ethanol-solvent", "inspect-ethanol-solubility", "record-ethanol-solubility",
  "dispose-ethanol-test-line", "dispense-hexanes-microsample", "apply-hexanes-solvent", "inspect-hexanes-solubility",
  "record-hexanes-solubility", "dispose-hexanes-test-line", "dispense-dry-microsample", "read-solid-conductivity",
  "record-solid-conductivity", "test-magnetic-response", "record-magnetic-response", "stage-melting-sample",
  "read-melting-behavior", "record-melting-behavior", "dispose-dry-test-line", "dispense-hcl-microsample",
  "apply-hcl-reagent", "inspect-hcl-response", "record-hcl-response", "dispose-hcl-test-line",
  "dispense-naoh-microsample", "apply-naoh-reagent", "inspect-naoh-response", "record-naoh-response",
  "dispose-naoh-test-line", "complete-sample-matrix",
];
const choiceIds = new Set([
  "inspect-solid-appearance", "inspect-water-solubility", "inspect-ethanol-solubility",
  "inspect-hexanes-solubility", "inspect-hcl-response", "inspect-naoh-response",
]);
const measurementPairs = [
  ["read-aqueous-conductivity", "record-aqueous-conductivity"],
  ["read-ph-indicator", "record-ph"],
  ["read-solid-conductivity", "record-solid-conductivity"],
  ["test-magnetic-response", "record-magnetic-response"],
  ["read-melting-behavior", "record-melting-behavior"],
];
const configurationIds = [
  "sampleIdentity", "sampleMode", "evidenceScopeId", "selectedTestPanel", "microsampleAmount",
  "waterAmount", "ethanolAmount", "hexanesAmount", "hclAmount", "naohAmount",
  "conductivityThresholds", "phThresholds", "meltingApparatusLimits", "hoodControl",
  "waterWasteDestination", "ethanolWasteDestination", "hexanesWasteDestination",
  "hclWasteDestination", "naohWasteDestination", "dryWasteDestination",
];
const roleRequirements = {
  dispense: ["sample-source", "bonding-test-vessel", "solid-transfer-tool"],
  apply: ["bonding-test-solvent-source", "bonding-test-vessel"],
  dispose: ["bonding-test-vessel", "waste-receiver"],
  stage: ["bonding-test-vessel", "melting-point-instrument"],
  test: ["bonding-test-vessel", "magnetic-response-tool"],
};
const instrumentRequirements = {
  "read-aqueous-conductivity": { roles: ["immersed-probe-instrument", "bonding-test-vessel"], atomId: "atom.observe.read-aqueous-conductivity" },
  "read-ph-indicator": { roles: ["ph-indicator-medium", "bonding-test-vessel"], atomId: "atom.observe.read-ph-indicator" },
  "read-solid-conductivity": { roles: ["immersed-probe-instrument", "sample-source"], atomId: null },
  "read-melting-behavior": { roles: ["melting-point-instrument", "bonding-test-vessel"], atomId: "atom.observe.read-melting-behavior" },
};
const configured = (slotId) => `{{config.${slotId}}}`;
const equipmentForRole = {
  "sample-source": "small-vial", "bonding-test-vessel": "test-tube", "solid-transfer-tool": "spatula",
  "bonding-test-solvent-source": "reagent-tray", "waste-receiver": "beaker-250ml",
  "melting-point-instrument": "melting-point-apparatus", "magnetic-response-tool": "magnet",
  "immersed-probe-instrument": "conductivity-tester", "ph-indicator-medium": "ph-paper",
};
const measurementByAction = new Map(measurementPairs.flatMap(([readId, recordId]) => [
  [readId, `${readId}-measurement`], [recordId, `${readId}-measurement`],
]));
const fixtureActions = actionIds.map((id) => {
  const prefix = Object.keys(roleRequirements).find((candidate) => id.startsWith(`${candidate}-`));
  const parameters = { evidenceScopeSlotId: configured("evidenceScopeId") };
  if (id.startsWith("dispense-")) parameters.microsampleAmount = configured("microsampleAmount");
  if (id.startsWith("apply-")) parameters.reagentAmount = configured(`${id.split("-")[1]}Amount`);
  if (id.startsWith("dispose-")) parameters.wasteDestination = configured(`${id.split("-")[1]}WasteDestination`);
  if (id === "label-test-locations") Object.assign(parameters, {
    sampleIdentity: configured("sampleIdentity"), sampleMode: configured("sampleMode"), selectedTestPanel: configured("selectedTestPanel"),
  });
  if (id === "complete-sample-matrix") parameters.selectedTestPanel = configured("selectedTestPanel");
  if (id === "read-aqueous-conductivity" || id === "read-solid-conductivity") parameters.conductivityThresholds = configured("conductivityThresholds");
  if (id === "read-ph-indicator") parameters.phThresholds = configured("phThresholds");
  if (id === "stage-melting-sample" || id === "read-melting-behavior") parameters.meltingApparatusLimits = configured("meltingApparatusLimits");
  if (id === "apply-hexanes-solvent") parameters.hoodControl = configured("hoodControl");
  if (measurementByAction.has(id)) {
    parameters.measurementId = measurementByAction.get(id);
    if (id.startsWith("record-") || id === "record-magnetic-response") parameters.copyExistingMeasurementOnly = true;
  }
  const interactionType = prefix === "stage" ? "dragToZone" : prefix === "test" ? "readInstrument" : prefix ? "pourInto" : "recordNotebook";
  const interaction = { type: interactionType, accessibleLabel: `Perform ${id}.` };
  if (interactionType === "pourInto") Object.assign(interaction, { sourceDefinitionId: "sample-bottle", targetDefinitionId: "test-tube" });
  if (interactionType === "dragToZone") Object.assign(interaction, { sourceDefinitionId: "test-tube", stationId: "melting-point-apparatus" });
  if (interactionType === "readInstrument") Object.assign(interaction, { sourceDefinitionId: "test-tube", stationId: "workbench" });
  const action = {
    id, verb: id.startsWith("record-") ? "record" : prefix === "stage" ? "place" : prefix === "test" ? "observe" : prefix ? "transfer" : "observe", label: id,
    parameters, interaction,
    prerequisites: [], stateChanges: [], invalidCases: [], feedback: { success: "ok", invalid: "retry" }, evidence: ["sample-scoped"],
  };
  if (prefix) action.equipmentRoleBindings = Object.fromEntries(roleRequirements[prefix].map((roleId) => [roleId, equipmentForRole[roleId]]));
  if (instrumentRequirements[id]) {
    if (instrumentRequirements[id].atomId) action.atomId = instrumentRequirements[id].atomId;
    action.interaction.type = "readInstrument";
    Object.assign(action.interaction, { sourceDefinitionId: "test-tube", stationId: "workbench" });
    action.equipmentRoleBindings = Object.fromEntries(instrumentRequirements[id].roles.map((roleId) => [roleId, equipmentForRole[roleId]]));
  }
  if (choiceIds.has(id)) {
    action.parameters.inputMode = "choice";
    action.choiceObservation = { outputCalculationId: `${id}-choice`, options: [
      { label: "Observed", tag: "observed", value: 1 }, { label: "Not observed", tag: "not-observed", value: 0 },
    ] };
  }
  return action;
});
const fixture = {
  id: "bonding-solids-tests",
  title: "Bonding Solids Tests Fixture",
  learningGoal: "Validate a configured per-sample bonding test panel.",
  requiredEquipment: [...new Set([...Object.values(equipmentForRole), "sample-bottle"])],
  metadata: { version: "1.1.0", author: "Lab Studio", updatedAt: "2026-09-04", tags: ["fixture"] },
  initialState: { equipment: [] },
  actions: fixtureActions,
  process: {
    startNodeId: "label-test-locations-node",
    nodes: actionIds.map((actionId) => ({ id: `${actionId}-node`, type: "action", title: actionId, description: `Perform ${actionId}.`, actionId, config: {},
      validation: [{ id: `${actionId}-validation`, type: "actionEvidence", label: `${actionId} complete.`, actionId }], hints: [],
      feedback: { success: `${actionId} complete.`, retry: `Retry ${actionId}.` } })),
    edges: actionIds.slice(1).map((id, index) => ({ from: `${actionIds[index]}-node`, to: `${id}-node`, label: "Next", condition: { type: "validationPassed" } })),
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  composition: {
    schemaVersion: 1,
    ports: [
      { id: "entry-label-test-locations-node", kind: "entry", nodeId: "label-test-locations-node", label: "Entry" },
      { id: "exit-complete-sample-matrix-node", kind: "exit", nodeId: "complete-sample-matrix-node", label: "Exit" },
    ],
    equipmentRoles: Object.entries(equipmentForRole).map(([roleId, definitionId]) => ({ roleId, required: true, allowedDefinitionIds: [definitionId], sourceInstanceIds: [] })),
    modelSlots: [], approvalGates: [], variants: [], evidenceOutputs: [],
    configurationSlots: configurationIds.map((id) => ({
      id, required: true, valueType: "string",
      ...(id === "sampleMode" ? { allowedValues: ["known", "blind"] } : {}),
      ...(id === "sampleIdentity" ? { redactWhenBlind: true } : {}),
    })),
    legacyActionEffects: [],
    completion: { exitPortIds: ["exit-complete-sample-matrix-node"], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
    catalogDisposition: "composable",
  },
};

const deriveLegacyEffects = (definition) => {
  const probe = [
    'import { deriveActionEffectContract } from "./src/domain/atomRegistry.ts";',
    'let input = ""; for await (const chunk of process.stdin) input += chunk;',
    'const definition = JSON.parse(input);',
    'const rows = definition.actions.filter((action) => !action.atomId).map((action) => {',
    '  const result = deriveActionEffectContract(action);',
    '  if (!result.contract || result.errors.length) throw new Error(`${action.id}: ${result.errors.join(", ")}`);',
    '  return { actionId: action.id, effect: result.contract };',
    '});',
    'console.log(JSON.stringify(rows));',
  ].join("\n");
  return JSON.parse(execFileSync(process.execPath,
    ["--experimental-loader", "./scripts/tsCompositionLoader.mjs", "--input-type=module", "-e", probe],
    { encoding: "utf8", input: JSON.stringify(definition), stdio: ["pipe", "pipe", "pipe"] }));
};
fixture.composition.legacyActionEffects = deriveLegacyEffects(fixture);

const runProductionValidation = (definition) => {
  try {
    const output = execFileSync(process.execPath,
      ["scripts/generateApChemTechniqueFragments.mjs", "--validate-atomic-fixture", "bonding-solids-tests"],
      { encoding: "utf8", input: JSON.stringify(definition), stdio: ["pipe", "pipe", "pipe"] });
    return { ok: true, output };
  } catch (error) {
    return { ok: false, error: `${error.stderr ?? ""}${error.stdout ?? ""}` };
  }
};
const runDomainValidation = (definition) => {
  const probe = [
    'import { validateTechniqueDefinition } from "./src/domain/validation.ts";',
    'let input = ""; for await (const chunk of process.stdin) input += chunk;',
    'const result = validateTechniqueDefinition(JSON.parse(input));',
    'if (!result.ok) { console.error(JSON.stringify(result.errors)); process.exit(1); }',
    'console.log(JSON.stringify({ ok: true }));',
  ].join("\n");
  try {
    const output = execFileSync(process.execPath,
      ["--experimental-loader", "./scripts/tsCompositionLoader.mjs", "--input-type=module", "-e", probe],
      { encoding: "utf8", input: JSON.stringify(definition), stdio: ["pipe", "pipe", "pipe"] });
    return { ok: true, output };
  } catch (error) {
    return { ok: false, error: `${error.stderr ?? ""}${error.stdout ?? ""}` };
  }
};

assert(actionIds.length === 42 && new Set(actionIds).size === 42, "Requested per-sample action list is not exactly 42 unique IDs.");
const positiveValidation = runProductionValidation(fixture);
assert(positiveValidation.ok, `Positive generic panel fixture failed production validation: ${positiveValidation.error}`);
const positiveDomainValidation = runDomainValidation(fixture);
assert(positiveDomainValidation.ok, `Positive generic panel fixture failed validateTechniqueDefinition: ${positiveDomainValidation.error}`);
const mutants = [
  (() => { const value = structuredClone(fixture); [value.process.nodes[0], value.process.nodes[1]] = [value.process.nodes[1], value.process.nodes[0]]; return value; })(),
  (() => { const value = structuredClone(fixture); value.process.edges[10].to = value.process.edges[12].to; return value; })(),
  (() => { const value = structuredClone(fixture); delete value.actions.find((item) => item.id === "apply-hcl-reagent").equipmentRoleBindings["bonding-test-vessel"]; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "inspect-water-solubility").choiceObservation = undefined; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "record-ph").parameters.measurementId = "other-sample"; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "dispense-water-microsample").parameters.microsampleAmount = 0.05; return value; })(),
  (() => { const value = structuredClone(fixture); value.composition.configurationSlots.find((slot) => slot.id === "sampleIdentity").redactWhenBlind = false; return value; })(),
  (() => { const value = structuredClone(fixture); value.composition.configurationSlots.find((slot) => slot.id === "sampleIdentity").default = "K1"; return value; })(),
  (() => { const value = structuredClone(fixture); value.composition.configurationSlots.find((slot) => slot.id === "waterAmount").defaultValue = 2; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "label-test-locations").parameters.sampleIdentity = "K1"; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "label-test-locations").parameters.selectedTestPanel = configured("sampleIdentity"); return value; })(),
  (() => { const value = structuredClone(fixture); delete value.actions.find((item) => item.id === "apply-hexanes-solvent").parameters.hoodControl; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "apply-water-solvent").parameters.reagentAmount = "{{config.waterAmount"; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "apply-water-solvent").parameters.reagentAmount = "{{config.undeclaredAmount}}"; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "apply-water-solvent").parameters.reagentAmount = { source: "configuration", slotId: "waterAmount" }; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "read-ph-indicator").interaction.type = "recordNotebook"; return value; })(),
  (() => { const value = structuredClone(fixture); delete value.actions.find((item) => item.id === "read-solid-conductivity").equipmentRoleBindings["immersed-probe-instrument"]; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "read-melting-behavior").atomId = "fixture.wrong-read"; return value; })(),
  (() => { const value = structuredClone(fixture); value.composition.legacyActionEffects.find((item) => item.actionId === "read-solid-conductivity").effect = { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] }; return value; })(),
  (() => { const value = structuredClone(fixture); value.actions.find((item) => item.id === "record-aqueous-conductivity").interaction.type = "readInstrument"; return value; })(),
];
for (const [index, mutant] of mutants.entries()) {
  const result = runProductionValidation(mutant);
  assert(!result.ok, `Malformed generic-panel fixture ${index + 1} was accepted by production validation.`);
}

const driver = readFileSync("scripts/generateApChemTechniqueFragments.mjs", "utf8");
assert(driver.includes("actionCount: 42") && driver.includes('"complete-sample-matrix"') && driver.includes('forbiddenActionPrefixes: ["inv6-"]'),
  "Shared driver does not declare the requested exact generic-panel contract.");
assert(driver.indexOf("const onlyIds = (() =>") < driver.indexOf("for (let index = 0; index < definitions.length; index += 1)"),
  "Early --only isolation changed.");
let staleFailure = "";
try {
  execFileSync(process.execPath, ["scripts/generateApChemTechniqueFragments.mjs", "--only", "bonding-solids-tests"], { encoding: "utf8", stdio: "pipe" });
} catch (error) {
  staleFailure = `${error.stderr ?? ""}${error.stdout ?? ""}`;
}
assert(staleFailure.includes("53 actions (expected 42)") && staleFailure.includes("obsolete action families still present: inv6-"),
  "Stale 53-operation lane input did not fail with the expected replay classification.");

const isolatedTargets = ["hard-water-gravimetry", "tablet-separation"];
const indexPath = "public/techniques/index.json";
const isolatedGeneration = [];
for (const id of isolatedTargets) {
  const outputPath = `public/techniques/${id}.json`;
  const before = { output: sha256(outputPath), index: sha256(indexPath) };
  execFileSync(process.execPath, ["scripts/generateApChemTechniqueFragments.mjs", "--only", id], { encoding: "utf8", stdio: "pipe" });
  const after = { output: sha256(outputPath), index: sha256(indexPath) };
  assert(after.output === before.output, `${id} targeted generation changed its committed output bytes.`);
  assert(after.index === before.index, `${id} targeted generation changed the shared index bytes.`);
  isolatedGeneration.push({ id, outputSha256: after.output, indexSha256: after.index });
}

const root = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const paths = {
  request: `${root}/evidence/lane-06/shared-contract-request-03-scalar-configuration-placeholders.json`,
  predecessor: `${root}/evidence/CYCLE_07_SHARED_CONTRACT_PREDECESSOR_REVISION_7_BONDING_SCALAR_CONFIGURATION.json`,
  baseline: `${root}/evidence/CYCLE_08_SHARED_CONTRACT_BASELINE_REVISION_8.json`,
  impact: `${root}/evidence/CYCLE_06_BONDING_SCALAR_CONFIGURATION_AMENDMENT_IMPACT.json`,
  status: `${root}/_CYCLE_STATUS.json`,
};
const records = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, JSON.parse(readFileSync(path, "utf8"))]));
assert(records.request.status === "coordinator-amendment-implemented-review-pending" &&
  records.request.coordinatorDisposition?.candidateBaselineRevision === 8 && records.request.coordinatorDisposition?.criticalReview?.performed === false,
  "Request 03 is not disposed to reviewed-pending revision 8.");
assert(records.predecessor.baselineRevision === 7 && records.predecessor.nextRevision === 8 &&
  records.predecessor.lineage.manifestSha256 === "55416fd97b61533c0effcb91c999fd7aacf9ba517d53e53f42eca6b841ce9ab7",
  "Revision-7 predecessor identity is wrong.");
assert(records.baseline.baselineRevision === 8 && records.baseline.state === "reviewed-pending" &&
  records.baseline.criticalReviewRequired === true && records.baseline.criticalReview.performed === false,
  "Revision-8 candidate is not review-pending.");
assert(records.baseline.request.sha256 === sha256(paths.request) && records.baseline.predecessor.captureSha256 === sha256(paths.predecessor),
  "Revision-8 request or predecessor hash is stale.");
assert(records.impact.request.sha256 === sha256(paths.request) && records.impact.baseline.manifestSha256 === sha256(paths.baseline) &&
  records.impact.baseline.fileCount === records.baseline.fileCount && records.impact.baseline.aggregateSha256 === records.baseline.aggregateSha256,
  "Revision-8 impact identity is stale.");
const aggregate = createHash("sha256");
assert(records.baseline.files.length === records.baseline.fileCount, "Revision-8 file count is stale.");
for (const file of records.baseline.files) {
  assert(file.sha256 === sha256(file.path), `Revision-8 file hash is stale: ${file.path}`);
  aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
}
assert(aggregate.digest("hex") === records.baseline.aggregateSha256, "Revision-8 aggregate is stale.");
assert(records.impact.baselineRevision === 8 && records.impact.state === "reviewed-pending" &&
  records.impact.criticalReview.acceptancePending === true && records.impact.affected.ownedPaths.length === 24,
  "Revision-8 impact boundary or review state is wrong.");
assert(records.status.currentCycle === 6 && records.status.lastCompleted === 5 && records.status.cycles["06"].status === "ready" &&
  records.status.parallelExecution.baselineRevision === 8 && records.status.parallelExecution.baselineRevisionState === "reviewed-pending",
  "Coordinator status no longer preserves the Cycle 06 replay gate.");
assert(records.status.parallelExecution.baselineManifestSha256 === sha256(paths.baseline) &&
  records.status.parallelExecution.baselineFileCount === records.baseline.fileCount &&
  records.status.parallelExecution.baselineAggregateSha256 === records.baseline.aggregateSha256 &&
  records.status.parallelExecution.amendmentImpactSha256 === sha256(paths.impact) &&
  records.status.parallelExecution.revision7Predecessor.predecessorCaptureSha256 === sha256(paths.predecessor),
  "Coordinator status revision-8 hashes are stale.");

console.log(JSON.stringify({ ok: true, expectedActions: 42, expectedNodes: 42, expectedEdges: 41,
  configurationSlots: configurationIds.length, positiveFixtures: 1, validateTechniqueDefinitionFixtures: 1, rejectedMutants: mutants.length,
  productionValidatorInvocations: mutants.length + 1, isolatedGeneration,
  staleBondingReplayGate: "expected-53-versus-42-contract-failure", baselineFileCount: records.baseline.fileCount,
  baselineAggregateSha256: records.baseline.aggregateSha256, affectedReplayPaths: records.impact.affected.ownedPaths.length }, null, 2));
