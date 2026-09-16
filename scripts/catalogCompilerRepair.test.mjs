import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GREEN_CHEMISTRY_TECHNIQUE_VERSION } from "../src/data/greenChemistrySetup.ts";
import { deriveActionEffectContract } from "../src/domain/atomRegistry.ts";
import { collectCompiledWitnesses } from "../src/data/collectCompiledWitnesses.ts";
import { prepareCycle12WitnessSource } from "../src/data/cycle12WitnessSetup.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const readJson = (relativePath) =>
  JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const actionById = (definition, id) => {
  const action = definition.actions.find((candidate) => candidate.id === id);
  assert.ok(action, `${definition.id} is missing action ${id}`);
  return action;
};
const nodeById = (definition, id) => {
  const node = definition.process.nodes.find((candidate) => candidate.id === id);
  assert.ok(node, `${definition.id} is missing process node ${id}`);
  return node;
};
const classNames = (result) => new Set(result.contract?.classes ?? []);
const assertClasses = (result, expected, label) => {
  assert.deepEqual(result.errors, [], `${label} derives without atom/handler errors`);
  assert.deepEqual([...classNames(result)].sort(), [...expected].sort(), `${label} effect classes`);
};

const runCompilerAssertions = async () => {
const techniqueIndex = readJson("public/techniques/index.json");
const techniqueIndexById = new Map(techniqueIndex.map((entry) => [entry.id, entry]));
const resolveTechnique = async (techniqueId) => {
  const entry = techniqueIndexById.get(techniqueId);
  assert.ok(entry, `technique index resolves ${techniqueId}`);
  return readJson(join("public/techniques", entry.file));
};

const paper = readJson("public/techniques/paper-chromatography.json");
const paperMeasureActions = paper.actions.filter(
  (action) =>
    action.id.startsWith("measure-") &&
    action.atomId === "atom.observe.measure-chromatography-distance",
);
assert.equal(paperMeasureActions.length, 52, "the complete chromatography measurement set is atom-backed");
const paperLegacyIds = new Set((paper.composition.legacyActionEffects ?? []).map((entry) => entry.actionId));
assert.deepEqual(
  paperMeasureActions.filter((action) => paperLegacyIds.has(action.id)).map((action) => action.id),
  [],
  "atom-backed chromatography measurements have no duplicate legacy declarations",
);

const handWarmer = readJson("public/techniques/hand-warmer-calorimetry.json");
const handWarmerLab = readJson("public/labs/hand-warmer-calorimetry.json");
for (const actionId of ["P1-26", "P1-26-T2", "P1-26-R1"]) {
  const result = deriveActionEffectContract(actionById(handWarmer, actionId));
  assertClasses(result, ["measurement-direct-observation-acquisition", "evidence-recording"], actionId);
  assert.ok(!classNames(result).has("apparatus-material-instrument-state"), `${actionId} is a probe-series observation, not a physical mutation`);
}
assert.ok(
  handWarmer.composition.equipmentRoles.some((role) =>
    role.roleId === "immersed-probe-vessel" &&
    role.allowedDefinitionIds.includes("hand-warmer-calorimeter") &&
    role.allowedDefinitionIds.includes("beaker-150ml"),
  ),
  "Hand Warmer declares the vessels used by its immersed probe readings",
);
assert.ok(
  handWarmerLab.techniqueInstances
    .find((instance) => instance.instanceId === "hand-warmer")
    ?.bindings.equipment["immersed-probe-vessel"],
  "the Hand Warmer lab binds the immersed probe vessel role",
);
for (const actionId of ["P2-M14", "P2-M14-D2", "P2-M14-D3", "P2-H08-D1-READ-01", "P2-H08-D2-READ-01", "P2-H08-D3-READ-01"]) {
  const action = actionById(handWarmer, actionId);
  assert.equal(action.interaction?.type, "readInstrument", `${actionId} is an instrument reading`);
  assert.ok(action.interaction?.sourceDefinitionId, `${actionId} identifies its read source`);
  assert.ok(action.interaction?.stationId, `${actionId} identifies its instrument station`);
}

const quickAche = readJson("public/techniques/quick-ache-property-evidence.json");
const quickAcheActionIds = [
  "qar-inspect-sucrose-property-result",
  "qar-inspect-acetaminophen-property-result",
  "qar-inspect-aspirin-property-result",
];
const quickAcheLegacyIds = new Set((quickAche.composition.legacyActionEffects ?? []).map((entry) => entry.actionId));
for (const actionId of quickAcheActionIds) {
  const result = deriveActionEffectContract(actionById(quickAche, actionId));
  assertClasses(result, ["evidence-recording"], actionId);
  assert.ok(!quickAcheLegacyIds.has(actionId), `${actionId} has no duplicate legacy effect declaration`);
}

const quickAcheExtraction = readJson("public/techniques/quick-ache-extraction-recovery.json");
const quickAcheLab = readJson("public/labs/quick-ache-relief-separation.json");
const quickAcheExtractionLegacyIds = new Set(
  (quickAcheExtraction.composition.legacyActionEffects ?? []).map((entry) => entry.actionId),
);
for (const actionId of ["qar-inspect-separated-layers", "qar-identify-layer-from-evidence"]) {
  const result = deriveActionEffectContract(actionById(quickAcheExtraction, actionId));
  assertClasses(result, ["measurement-direct-observation-acquisition", "evidence-recording"], actionId);
  assert.ok(!quickAcheExtractionLegacyIds.has(actionId), `${actionId} has no duplicate legacy effect declaration`);
}
for (const actionId of ["qar-read-recovery-ph", "plan-gravity-qar-read-recovery-ph"]) {
  const action = actionById(quickAcheExtraction, actionId);
  assertClasses(deriveActionEffectContract(action), ["measurement-direct-observation-acquisition"], actionId);
  assert.equal(action.interaction?.type, "readInstrument", `${actionId} remains a real pH reading`);
  assert.equal(action.interaction?.sourceDefinitionId, "erlenmeyer-flask-250ml", `${actionId} names its recovery vessel`);
  assert.equal(action.interaction?.stationId, "ph-meter", `${actionId} names its pH station`);
}
assert.ok(
  quickAcheExtraction.composition.equipmentRoles.some((role) => role.roleId === "immersed-probe-vessel"),
  "Quick Ache declares its immersed probe vessel role",
);
assert.ok(
  quickAcheLab.techniqueInstances
    .find((instance) => instance.instanceId === "extraction")
    ?.bindings.equipment["immersed-probe-vessel"],
  "the Quick Ache extraction instance binds its immersed probe vessel role",
);
for (const actionId of [
  "qar-weigh-filter-paper-tare",
  "plan-gravity-qar-weigh-filter-paper-tare",
  "qar-weigh-acidic-watch-glass-tare",
  "plan-gravity-qar-weigh-acidic-watch-glass-tare",
  "qar-weigh-acidic-solid",
  "plan-gravity-qar-weigh-acidic-solid",
  "qar-weigh-aqueous-watch-glass-tare",
  "plan-gravity-qar-weigh-aqueous-watch-glass-tare",
  "qar-weigh-aqueous-solid",
  "plan-gravity-qar-weigh-aqueous-solid",
]) {
  const action = actionById(quickAcheExtraction, actionId);
  assert.equal(action.mass?.source, "action-input", `${actionId} has one typed balance producer`);
  assert.equal(action.parameters.measurementId, undefined, `${actionId} has no duplicate legacy measurement producer`);
}

const brassTechnique = readJson("public/techniques/brass-spectrophotometry.json");
const brassLab = readJson("public/labs/brass-colorimetry.json");
const approvedWavelengthAction = actionById(brassTechnique, "configure-approved-wavelength-action");
assert.equal(
  approvedWavelengthAction.atomId,
  "atom.observe.set-active-photometer-wavelength",
  "the active wavelength operation has its own physical-state atom",
);
assertClasses(
  deriveActionEffectContract(approvedWavelengthAction),
  ["apparatus-material-instrument-state", "evidence-recording"],
  "approved photometer wavelength configuration",
);
const malformedPhotometerConfiguration = structuredClone(approvedWavelengthAction);
delete malformedPhotometerConfiguration.parameters.photometerConfigurationMode;
const malformedPhotometerResult = deriveActionEffectContract(malformedPhotometerConfiguration);
assert.ok(
  malformedPhotometerResult.errors.some((error) => error.includes("requires an active photometer configuration mode")),
  "a readInstrument action cannot claim the active photometer atom without its authored configuration mode",
);
assert.ok(
  malformedPhotometerResult.errors.some((error) =>
    error.includes('derives effect class "measurement-direct-observation-acquisition"')),
  "the malformed photometer configuration falls back to the reducer's read-only handler and is rejected",
);
assert.equal(
  brassLab.actions.some((action) => action.id === "configure-approved-wavelength-action"),
  false,
  "the physical photometer operation is not lab-local",
);
assert.equal(
  brassLab.process.nodes.some((node) => node.id === "configure-approved-wavelength"),
  false,
  "the physical photometer node is not lab-local",
);
assert.equal(
  nodeById(brassTechnique, "configure-approved-wavelength").actionId,
  "configure-approved-wavelength-action",
  "the technique owns the original process identity",
);
assert.ok(
  !approvedWavelengthAction.prerequisites.some((rule) => rule.actionId === "teacher-wavelength-approval-action"),
  "the moved technique action does not retain an invalid lab-local prerequisite",
);
assert.ok(
  brassLab.initialState.equipment.some((item) =>
    item.id === "scan-blank-cuvette" && item.definitionId === "cuvette"),
  "the Brass lab provides the declared scan blank cuvette",
);
assert.ok(
  brassTechnique.composition.ports.some(
    (port) => port.id === "entry-configure-approved-wavelength" && port.nodeId === "configure-approved-wavelength",
  ),
  "the technique exposes the configuration entry port",
);
assert.ok(
  brassTechnique.process.edges.some(
    (edge) => edge.from === "configure-approved-wavelength" && edge.to === "configure-brass-sample-inventory",
  ),
  "the configuration step precedes the existing brass inventory setup",
);
const brassInstance = brassLab.techniqueInstances.find(
  (instance) => instance.techniqueId === "brass-spectrophotometry",
);
assert.ok(brassInstance, "the Brass technique instance is present");
assert.equal(
  brassInstance.preserveIds.actions["configure-approved-wavelength-action"],
  "configure-approved-wavelength-action",
  "the compiled action id is preserved",
);
assert.equal(
  brassInstance.preserveIds.nodes["configure-approved-wavelength"],
  "configure-approved-wavelength",
  "the compiled node id is preserved",
);
const brassCrossThree = brassLab.compositionConnections.find((connection) => connection.id === "brass-cross-3");
assert.deepEqual(
  brassCrossThree,
  {
    id: "brass-cross-3",
    from: { kind: "lab-node", nodeId: "teacher-wavelength-approval" },
    to: {
      kind: "technique-port",
      instanceId: "brass-spectrophotometry",
      portId: "entry-configure-approved-wavelength",
    },
    label: "Continue after required evidence",
    condition: { type: "validationPassed" },
  },
  "teacher approval crosses into the moved instrument-setting operation",
);

const hardWater = readJson("public/techniques/hard-water-practice-preparation.json");
for (const [weighId, recordId, measurementId] of [
  ["weigh-sodium-carbonate", "record-sodium-carbonate", "practice-sodium-carbonate-mass"],
  ["weigh-calcium-chloride", "record-calcium-chloride", "practice-calcium-chloride-mass"],
]) {
  assert.equal(actionById(hardWater, weighId).mass.outputMeasurementId, measurementId, `${weighId} owns its structured mass output`);
  assert.equal(
    actionById(hardWater, recordId).parameters.copyExistingMeasurementOnly,
    true,
    `${recordId} consumes the balance output without emitting a duplicate`,
  );
}

const thermal = readJson("public/techniques/thermal-decomposition-mass-loss.json");
const greenLab = readJson("public/labs/green-chemistry-mixture-purification.json");
assert.equal(GREEN_CHEMISTRY_TECHNIQUE_VERSION, "2.0.1", "green setup pins the current thermal technique version");
assert.equal(thermal.metadata.version, GREEN_CHEMISTRY_TECHNIQUE_VERSION, "the thermal technique matches the setup pin");
assert.equal(
  greenLab.techniqueInstances.find((instance) => instance.instanceId === "thermal-decomposition")?.version,
  GREEN_CHEMISTRY_TECHNIQUE_VERSION,
  "the green lab instance matches the setup pin",
);
const thermalRoleIds = ["receiving-vessel", "thermal-support", "thermal-heating-instrument", "dried-assembly"];
const thermalInstance = greenLab.techniqueInstances.find((instance) => instance.instanceId === "thermal-decomposition");
assert.ok(thermalInstance, "the green lab thermal instance is present");
for (const roleId of thermalRoleIds) {
  assert.ok(
    thermal.composition.equipmentRoles.some((role) => role.roleId === roleId),
    `the thermal technique declares ${roleId}`,
  );
  assert.ok(thermalInstance.bindings.equipment[roleId], `the green lab binds ${roleId}`);
}
for (const actionId of [
  "record-empty-crucible",
  "record-initial-crucible-mass",
  "record-cycle-mass",
  "record-final-crucible-mass",
]) {
  assert.equal(
    actionById(thermal, actionId).parameters.copyExistingMeasurementOnly,
    true,
    `${actionId} consumes rather than duplicates the preceding balance output`,
  );
}

const sourceTrace = readJson("docs/architecture/source-trace-registry.json");
assert.ok(
  sourceTrace.traces.some(
    (trace) =>
      trace.ownerType === "technique" &&
      trace.ownerId === "brass-spectrophotometry" &&
      trace.actionId === "configure-approved-wavelength-action" &&
      trace.atomId === "atom.observe.set-active-photometer-wavelength" &&
      trace.sourceFile === "how-can-color-determine-copper-in-brass_2026-07-27.md" &&
      trace.sourceTable === "phase" &&
      trace.step === "P-02" &&
      trace.basis === "M",
  ),
  "the moved Brass action retains a source citation",
);

const compilerTargets = [
  ["brass-colorimetry", ["default"]],
  ["hand-warmer-calorimetry", ["teacher-approved-open-inquiry"]],
  // One approved witness per supported tare convention, then the approval-locked static witness.
  ["green-chemistry-mixture-purification", ["teacher-approved-route", "teacher-approved-tared-balance-route", "approval-locked-static-witness"]],
  ["quick-ache-relief-separation", ["default"]],
];
const compiledWitnessSummaries = [];
let compiledBrass;
for (const [labId, expectedWitnessIds] of compilerTargets) {
  const collection = await collectCompiledWitnesses({
    source: readJson(join("public/labs", `${labId}.json`)),
    prepareSource: prepareCycle12WitnessSource,
    resolveTechnique,
  });
  assert.deepEqual(collection.selectedWitnessIds, expectedWitnessIds, `${labId} uses its declared static witness set`);
  assert.equal(collection.attempts.length, expectedWitnessIds.length, `${labId} attempted every declared witness`);
  for (const attempt of collection.attempts) {
    const detail = "error" in attempt ? attempt.error : "";
    assert.equal(attempt.status, "compiled", `${labId}/${attempt.witnessId}: ${detail}`);
    if (attempt.status === "compiled") {
      assert.ok(attempt.compiled.actions.length > 0, `${labId}/${attempt.witnessId} emits actions`);
      assert.ok(attempt.compiled.process.nodes.length > 0, `${labId}/${attempt.witnessId} emits nodes`);
      if (labId === "brass-colorimetry") compiledBrass = attempt.compiled;
    }
  }
  compiledWitnessSummaries.push({
    labId,
    witnessIds: collection.selectedWitnessIds,
    actionCounts: collection.attempts.map((attempt) => attempt.status === "compiled" ? attempt.compiled.actions.length : 0),
  });
}
assert.ok(compiledBrass, "the real compiler produces the Brass witness");
assert.ok(
  compiledBrass.process.edges.some((edge) =>
    edge.from === "teacher-wavelength-approval" && edge.to === "configure-approved-wavelength"),
  "the compiled Brass graph retains the teacher-approval-to-configuration boundary",
);
const compiledBrassConfiguration = actionById(compiledBrass, "configure-approved-wavelength-action");
assert.ok(
  compiledBrassConfiguration.prerequisites.some((rule) =>
    rule.type === "measurementRecorded" && rule.measurementId === "brass-spectrophotometry--approved-wavelength-nm"),
  "the compiled Brass configuration action keeps its technique-scoped wavelength evidence prerequisite",
);

return {
  paperMeasurementActions: paperMeasureActions.length,
  handWarmerPeakActions: 3,
  quickAchePropertyActions: quickAcheActionIds.length,
  hardWaterMeasurementConsumers: 2,
  compiledWitnessSummaries,
};
};

if (process.env.VITEST === "true") {
  const { describe, it } = await import("vitest");
  describe("catalog compiler repair", () => {
    it("preserves the selected catalog compiler contracts", async () => {
      await runCompilerAssertions();
    });
  });
} else {
  const summary = await runCompilerAssertions();
  console.log(JSON.stringify({ ok: true, ...summary }));
}
