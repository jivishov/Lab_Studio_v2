import { declareBondingProcedure, preparePaperChoices, declarePaperProcedure, prepareQuickChoices, declareQuickProcedure } from "./declareCycle06InquiryPlans.mjs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const planRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const techniqueIds = [
  "hard-water-gravimetry",
  "hard-water-practice-preparation",
  "gravimetric-vacuum-filtration",
  "two-stage-precipitate-drying",
  "inquiry-plan-approval",
  "hard-water-two-sample-inquiry",
  "paper-chromatography",
  "bonding-solids-tests",
  "tablet-separation",
  "quick-ache-property-evidence",
  "quick-ache-design-approval",
  "quick-ache-extraction-recovery",
  "quick-ache-analysis-report",
];
const labIds = ["hard-water-analysis", "paper-chromatography", "bonding-unknown-solids", "quick-ache-relief-separation"];
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const clone = (value) => structuredClone(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const onlyArguments = process.argv.filter((argument) => argument.startsWith("--only="));
if (onlyArguments.length > 1) throw new Error("Specify at most one --only target.");
const onlyTarget = onlyArguments[0]?.slice("--only=".length);
if (onlyTarget && onlyTarget !== "hard-water-practice-preparation") {
  throw new Error(`Unsupported bounded Cycle 06 target "${onlyTarget}".`);
}

// The original Cycle 06 migration is deliberately broad.  This opt-in path is
// a narrow maintained writer for the two hard-water balance displays: it reads
// the current direct authoring source and writes only that one technique.
if (onlyTarget === "hard-water-practice-preparation") {
  const technique = await readJson("public/techniques/hard-water-practice-preparation.json");
  const contracts = new Map([
    ["weigh-sodium-carbonate", ["practice-sodium-carbonate-mass", "practice-sodium-beaker"]],
    ["weigh-calcium-chloride", ["practice-calcium-chloride-mass", "practice-calcium-beaker"]],
  ]);
  for (const [actionId, [outputMeasurementId, measuredSupportInstanceId]] of contracts) {
    const action = technique.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error(`Expected hard-water balance action ${actionId} is missing.`);
    action.parameters = {
      ...action.parameters,
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputRequired: true,
      unit: "g",
    };
    // The typed contract is the sole output writer.  Existing records retain
    // their own consumer identity, but this acquisition has no legacy fallback.
    delete action.parameters.measurementId;
    delete action.parameters.expectedMassG;
    delete action.interaction.valueParameter;
    action.mass = {
      source: "action-input",
      outputMeasurementId,
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId,
      },
    };
  }
  for (const actionId of ["record-sodium-carbonate", "record-calcium-chloride"]) {
    const action = technique.actions.find((candidate) => candidate.id === actionId);
    if (!action) throw new Error(`Expected hard-water measurement record ${actionId} is missing.`);
    action.parameters = {
      ...action.parameters,
      // The preceding typed balance action is the only measurement producer. This distinct
      // notebook step consumes that measurement rather than writing a duplicate structured output.
      copyExistingMeasurementOnly: true,
    };
  }
  await writeJson("public/techniques/hard-water-practice-preparation.json", technique);
  console.log("updated hard-water-practice-preparation mass continuity");
  process.exit(0);
}

const atoms = new Map((await readJson("src/domain/atomRegistry.json")).atoms.map((atom) => [atom.id, atom]));
const baseline = await readJson(`${planRoot}/evidence/CYCLE_08_SHARED_CONTRACT_BASELINE_REVISION_8.json`);
const atomicityAudit = await readJson(`${planRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`);
const compositionAudit = await readJson(`${planRoot}/LAB_COMPOSITION_AUDIT.json`);
const sourceRegistry = await readJson("docs/architecture/source-trace-registry.json");

const effectFor = (action) => {
  if (action.atomId) return atoms.get(action.atomId)?.effectContract;
  if (action.extractionObservation || action.extractionIdentity) return { classes: ["measurement-direct-observation-acquisition", "evidence-recording"], targets: [{ domain: "measurement-observation" }, { domain: "evidence" }] };
  if (action.interaction?.type === "submitCalculation") {
    return { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] };
  }
  if (action.interaction?.type === "readInstrument") {
    return { classes: ["measurement-direct-observation-acquisition"], targets: [{ domain: "instrument" }, { domain: "measurement-observation" }, { domain: "evidence" }] };
  }
  return { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] };
};

const uniquifyValidationIds = (technique) => {
  const actionIds = new Set(technique.actions.map((action) => action.id));
  for (const action of technique.actions) {
    action.prerequisites = (action.prerequisites ?? []).filter((rule) => !rule.actionId || actionIds.has(rule.actionId));
    for (const rule of action.prerequisites ?? []) if (!rule.id.startsWith(`${action.id}--`)) rule.id = `${action.id}--${rule.id}`;
  }
  for (const node of technique.process.nodes) {
    for (const rule of node.validation ?? []) if (!rule.id.startsWith(`${node.id}--`)) rule.id = `${node.id}--${rule.id}`;
  }
};

const removeExpectedMeasurementLiterals = (technique) => {
  for (const action of technique.actions) {
    if (action.verb !== "weigh") continue;
    const measurementId = action.parameters.measurementId ?? action.mass?.outputMeasurementId;
    if (typeof measurementId !== "string") throw new Error(`Owned weigh ${technique.id}/${action.id} lacks its measurement identity.`);
    const conflicts = technique.actions.some((other) => other !== action && other.verb === "weigh" && (other.parameters?.measurementId === measurementId || other.mass?.outputMeasurementId === measurementId));
    if (conflicts) {
      delete action.mass;
      action.parameters.measurementId = measurementId;
      action.parameters.configurationRequired = true;
      action.parameters.unlocked = false;
      action.parameters.sourceConfigurationBlock = "mass-acquisition-output-contract-conflict";
      if (!action.prerequisites.some((rule) => rule.path === "unsupportedMassOutputBindingApproved")) action.prerequisites.push({ id: `${action.id}-mass-output-binding-blocked`, type: "statePath", path: "unsupportedMassOutputBindingApproved", equals: true, label: "A supported mass acquisition/record output binding is required before weighing." });
    } else {
      action.mass = { source: "action-input", outputMeasurementId: measurementId };
      delete action.parameters.measurementId;
      delete action.parameters.sourceConfigurationBlock;
      delete action.parameters.unlocked;
      delete action.parameters.configurationRequired;
      action.prerequisites = action.prerequisites.filter((rule) => rule.path !== "unsupportedMassOutputBindingApproved");
    }
    delete action.parameters.expectedMassG;
    action.parameters.inputMode = "numeric";
    action.parameters.inputRole = "studentResponse";
    action.parameters.inputKey = `${measurementId}-input`;
    action.parameters.inputLabel = `${action.label} from the configured simulated balance (g)`;
    action.parameters.inputRequired = true;
    action.parameters.inputMin = 0;
    action.parameters.inputMinExclusive = true;
    action.parameters.unit = "g";
    action.parameters.evidenceProvenance = "learner-entered reading from the configured simulated balance; no expected mass is embedded";
    if (action.interaction) action.interaction.valueParameter = "inputKey";
  }
};

const addBoundaryPort = (technique, kind, nodeId) => {
  const id = `${kind}-${nodeId}`;
  if (!technique.composition.ports.some((port) => port.id === id)) {
    technique.composition.ports.push({ id, kind, nodeId, label: kind === "entry" ? "Entry" : "Exit" });
  }
  if (kind === "exit" && !technique.composition.completion.exitPortIds.includes(id)) {
    technique.composition.completion.exitPortIds.push(id);
  }
  return id;
};

const compositionFor = (technique, disposition = "composable") => {
  const incoming = new Map(technique.process.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(technique.process.nodes.map((node) => [node.id, 0]));
  for (const edge of technique.process.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
  }
  const ports = [];
  for (const node of technique.process.nodes) {
    if ((incoming.get(node.id) ?? 0) === 0) ports.push({ id: `entry-${node.id}`, kind: "entry", nodeId: node.id, label: "Entry" });
    if ((outgoing.get(node.id) ?? 0) === 0) ports.push({ id: `exit-${node.id}`, kind: "exit", nodeId: node.id, label: "Exit" });
  }
  const byRole = new Map();
  const chromatographyModelIds = new Set(technique.actions.map((action) => action.parameters?.chromatographyModelId).filter((id) => typeof id === "string"));
  const titrationModelIds = new Set(technique.actions.map((action) => action.parameters?.titrationModelId).filter((id) => typeof id === "string"));
  const kineticsModelIds = new Set(technique.actions.map((action) => action.parameters?.kineticsModelId).filter((id) => typeof id === "string"));
  for (const action of technique.actions) {
    for (const [roleId, definitionId] of Object.entries(action.equipmentRoleBindings ?? {})) {
      if (!byRole.has(roleId)) byRole.set(roleId, new Set());
      byRole.get(roleId).add(definitionId);
    }
  }
  return {
    schemaVersion: 1,
    ports,
    equipmentRoles: [...byRole].map(([roleId, definitions]) => ({
      roleId,
      required: true,
      allowedDefinitionIds: [...definitions],
      sourceInstanceIds: [],
    })),
    modelSlots: [
      ...[...chromatographyModelIds].map((sourceModelId) => ({ id: `chromatography-${sourceModelId}`, kind: "chromatography", sourceModelId, required: true })),
      ...[...titrationModelIds].map((sourceModelId) => ({ id: `titration-${sourceModelId}`, kind: "titration", sourceModelId, required: true })),
      ...[...kineticsModelIds].map((sourceModelId) => ({ id: `kinetics-${sourceModelId}`, kind: "kinetics", sourceModelId, required: true })),
    ],
    configurationSlots: technique.id === "bonding-solids-tests" ? bondingConfigurationSlots() : technique.id === "paper-chromatography" ? ["baselineHeightMm", "solventDepthMm", "spotVolumeMl", "solventVolumeMl", "spotterLoadVolumeMl", "stopCondition"].map((id) => ({ id, required: true, valueType: id === "stopCondition" ? "string" : "number" })) : [],
    approvalGates: [],
    variants: [],
    evidenceOutputs: [],
    completion: {
      exitPortIds: ports.filter((port) => port.kind === "exit").map((port) => port.id),
      requiredEvidenceOutputIds: [],
      requiredValidationRuleIds: [],
    },
    catalogDisposition: disposition,
    legacyActionEffects: technique.actions.filter((action) => !action.atomId).map((action) => ({
      actionId: action.id,
      effect: effectFor(action),
    })),
  };
};

const makeNode = (action) => ({
  id: `${action.id}-node`,
  type: action.interaction?.type === "submitCalculation" ? "calculation" : "action",
  title: action.label,
  description: action.label,
  actionId: action.id,
  config: {},
  validation: [{ id: `${action.id}-complete`, type: "actionEvidence", label: `${action.label} is complete.`, actionId: action.id }],
  hints: [],
  feedback: { success: `${action.label} complete.`, retry: `Complete ${action.label} with the named sample evidence.` },
});

const bondingActionIds = [
  "label-test-locations", "inspect-solid-appearance", "record-solid-appearance", "dispense-water-microsample",
  "apply-water-solvent", "inspect-water-solubility", "record-water-solubility", "read-aqueous-conductivity",
  "record-aqueous-conductivity", "read-ph-indicator", "record-ph", "dispose-water-test-line",
  "dispense-ethanol-microsample", "apply-ethanol-solvent", "inspect-ethanol-solubility", "record-ethanol-solubility",
  "dispose-ethanol-test-line", "dispense-hexanes-microsample", "apply-hexanes-solvent", "inspect-hexanes-solubility",
  "record-hexanes-solubility", "dispose-hexanes-test-line", "dispense-dry-microsample",
  "test-magnetic-response", "record-magnetic-response", "stage-melting-sample",
  "read-melting-behavior", "record-melting-behavior", "dispose-dry-test-line", "dispense-hcl-microsample",
  "apply-hcl-reagent", "inspect-hcl-response", "record-hcl-response", "dispose-hcl-test-line",
  "dispense-naoh-microsample", "apply-naoh-reagent", "inspect-naoh-response", "record-naoh-response",
  "dispose-naoh-test-line", "complete-sample-matrix",
];
const bondingConfigurationIds = [
  "sampleIdentity", "sampleMode", "evidenceScopeId", "selectedTestPanel", "microsampleAmount",
  "waterAmount", "ethanolAmount", "hexanesAmount", "hclAmount", "naohAmount",
  "conductivityThresholds", "phThresholds", "meltingApparatusLimits", "hoodControl",
  "waterWasteDestination", "ethanolWasteDestination", "hexanesWasteDestination",
  "hclWasteDestination", "naohWasteDestination", "dryWasteDestination",
];
const bondingConfigurationSlots = () => bondingConfigurationIds.map((id) => ({
  id, required: true, valueType: ["conductivityThresholds", "phThresholds", "meltingApparatusLimits"].includes(id) ? "number" : "string",
  ...(id === "sampleMode" ? { allowedValues: ["known", "blind"] } : {}),
  ...(id === "sampleIdentity" ? { redactWhenBlind: true } : {}),
}));
const configured = (id) => `{{config.${id}}}`;

const buildBondingTechnique = (technique, lab) => {
  const itemById = new Map(lab.initialState.equipment.map((item) => [item.id, item]));
  const equipmentMap = [
    ["sample-vial", "small-vial-known-k1"],
    ["water-test-line", "test-tube-1"], ["ethanol-test-line", "test-tube-2"],
    ["hexanes-test-line", "test-tube-3"], ["dry-test-line", "test-tube-4"],
    ["hcl-test-line", "test-tube-5"], ["naoh-test-line", "test-tube-6"],
    ["water-source", "distilled-water-bottle-1"], ["ethanol-source", "reagent-bottle-ethanol"],
    ["hexanes-source", "reagent-bottle-hexanes"], ["hcl-source", "reagent-bottle-hcl"],
    ["naoh-source", "naoh-bottle-1"], ["transfer-tool", "spatula-1"],
    ["conductivity-instrument", "conductivity-tester-1"], ["ph-medium", "ph-paper-1"],
    ["magnetic-tool", "magnet-1"], ["melting-instrument", "melting-point-apparatus-1"],
    ["water-waste", "waste-beaker-aqueous"], ["ethanol-waste", "waste-beaker-organic"],
    ["hexanes-waste", "waste-beaker-organic"], ["hcl-waste", "waste-beaker-aqueous"],
    ["naoh-waste", "waste-beaker-aqueous"], ["dry-waste", "waste-beaker-aqueous"],
  ];
  technique.initialState.equipment = equipmentMap.map(([id, labId]) => {
    const source = itemById.get(labId);
    if (!source) throw new Error(`Bonding source equipment ${labId} is missing.`);
    const result = { ...clone(source), id, label: source.label.replace(/K1/g, "configured sample") };
    if (id === "sample-vial") {
      result.label = "Configured sample";
      result.contents.label = "Configured unidentified solid";
      result.contents.solutes = result.contents.solutes.map((solute) => ({ ...solute, id: "configured-solid", label: "Configured unidentified solid" }));
    }
    return result;
  });
  technique.requiredEquipment = [...new Set(technique.initialState.equipment.map((item) => item.definitionId))];
  const choiceIds = new Set(["inspect-solid-appearance", "inspect-water-solubility", "inspect-ethanol-solubility", "inspect-hexanes-solubility", "inspect-hcl-response", "inspect-naoh-response"]);
  const measurementPairs = new Map([
    ["read-aqueous-conductivity", "aqueous-conductivity"], ["record-aqueous-conductivity", "aqueous-conductivity"],
    ["read-ph-indicator", "ph-indicator"], ["record-ph", "ph-indicator"],
    ["read-solid-conductivity", "solid-conductivity"], ["record-solid-conductivity", "solid-conductivity"],
    ["test-magnetic-response", "magnetic-response"], ["record-magnetic-response", "magnetic-response"],
    ["read-melting-behavior", "melting-behavior"], ["record-melting-behavior", "melting-behavior"],
  ]);
  const lineFor = (id) => ["water", "ethanol", "hexanes", "dry", "hcl", "naoh"].find((line) => id.includes(`-${line}-`));
  const sourceForLine = { water: "water-source", ethanol: "ethanol-source", hexanes: "hexanes-source", hcl: "hcl-source", naoh: "naoh-source" };
  const item = (id) => technique.initialState.equipment.find((entry) => entry.id === id);
  technique.actions = bondingActionIds.map((id, index) => {
    const line = lineFor(id);
    const parameters = { evidenceScopeSlotId: configured("evidenceScopeId") };
    let verb = "observe";
    let interaction = { type: "recordNotebook", valueParameter: "evidenceScopeSlotId", accessibleLabel: `Complete ${id.replaceAll("-", " ")} for the configured sample.` };
    let equipmentRoleBindings;
    let atomId;
    if (id === "label-test-locations") Object.assign(parameters, { sampleIdentity: configured("sampleIdentity"), sampleMode: configured("sampleMode"), selectedTestPanel: configured("selectedTestPanel") });
    if (id === "complete-sample-matrix") Object.assign(parameters, { selectedTestPanel: configured("selectedTestPanel") });
    if (id.startsWith("record-")) verb = "record";
    if (id.startsWith("dispense-")) {
      verb = "transfer"; atomId = "atom.transfer.microsample-portion";
      Object.assign(parameters, { sourceDefinitionId: item("sample-vial").definitionId, sourceInstanceId: "sample-vial", targetDefinitionId: item(`${line}-test-line`).definitionId, targetInstanceId: `${line}-test-line`, microsampleAmount: configured("microsampleAmount") });
      equipmentRoleBindings = { "sample-source": item("sample-vial").definitionId, "bonding-test-vessel": item(`${line}-test-line`).definitionId, "solid-transfer-tool": item("transfer-tool").definitionId };
      interaction = { type: "pourInto", sourceDefinitionId: item("sample-vial").definitionId, targetDefinitionId: item(`${line}-test-line`).definitionId, accessibleLabel: `Transfer the configured fresh microsample to the ${line} test line.` };
    }
    if (id.startsWith("apply-")) {
      verb = "transfer"; atomId = "atom.transfer.apply-test-solvent";
      Object.assign(parameters, { sourceDefinitionId: item(sourceForLine[line]).definitionId, sourceInstanceId: sourceForLine[line], targetDefinitionId: item(`${line}-test-line`).definitionId, targetInstanceId: `${line}-test-line`, reagentAmount: configured(`${line}Amount`) });
      if (line === "hexanes") parameters.hoodControl = configured("hoodControl");
      equipmentRoleBindings = { "bonding-test-solvent-source": item(sourceForLine[line]).definitionId, "bonding-test-vessel": item(`${line}-test-line`).definitionId };
      interaction = { type: "pourInto", sourceDefinitionId: item(sourceForLine[line]).definitionId, targetDefinitionId: item(`${line}-test-line`).definitionId, accessibleLabel: `Apply the configured ${line} reagent under the approved controls.` };
    }
    if (id.startsWith("dispose-")) {
      verb = "transfer"; atomId = "atom.transfer.dispose-to-waste-stream";
      const wasteId = `${line}-waste`;
      Object.assign(parameters, { sourceDefinitionId: item(`${line}-test-line`).definitionId, sourceInstanceId: `${line}-test-line`, targetDefinitionId: item(wasteId).definitionId, targetInstanceId: wasteId, wasteDestination: configured(`${line}WasteDestination`) });
      equipmentRoleBindings = { "bonding-test-vessel": item(`${line}-test-line`).definitionId, "waste-receiver": item(wasteId).definitionId };
      interaction = { type: "pourInto", sourceDefinitionId: item(`${line}-test-line`).definitionId, targetDefinitionId: item(wasteId).definitionId, accessibleLabel: `Dispose the ${line} test line to its configured waste destination.` };
    }
    if (id === "read-aqueous-conductivity") {
      atomId = "atom.observe.read-aqueous-conductivity"; Object.assign(parameters, { sourceInstanceId: "water-test-line", instrumentInstanceId: "conductivity-instrument", conductivityThresholds: configured("conductivityThresholds") });
      equipmentRoleBindings = { "immersed-probe-instrument": item("conductivity-instrument").definitionId, "bonding-test-vessel": item("water-test-line").definitionId };
      interaction = { type: "readInstrument", sourceDefinitionId: item("water-test-line").definitionId, stationId: item("conductivity-instrument").definitionId, valueParameter: "measurementId", accessibleLabel: "Read aqueous conductivity for this sample." };
    }
    if (id === "read-ph-indicator") {
      atomId = "atom.observe.read-ph-indicator"; Object.assign(parameters, { sourceInstanceId: "water-test-line", instrumentInstanceId: "ph-medium", phThresholds: configured("phThresholds") });
      equipmentRoleBindings = { "ph-indicator-medium": item("ph-medium").definitionId, "bonding-test-vessel": item("water-test-line").definitionId };
      interaction = { type: "readInstrument", sourceDefinitionId: item("water-test-line").definitionId, stationId: item("ph-medium").definitionId, valueParameter: "measurementId", accessibleLabel: "Read pH evidence for this sample." };
    }
    if (id === "read-solid-conductivity") {
      Object.assign(parameters, { sourceInstanceId: "dry-test-line", instrumentInstanceId: "conductivity-instrument", conductivityThresholds: configured("conductivityThresholds") });
      equipmentRoleBindings = { "immersed-probe-instrument": item("conductivity-instrument").definitionId, "bonding-test-vessel": item("dry-test-line").definitionId };
      interaction = { type: "readInstrument", sourceDefinitionId: item("dry-test-line").definitionId, stationId: item("conductivity-instrument").definitionId, valueParameter: "measurementId", accessibleLabel: "Read solid conductivity evidence from this sample's fresh dry test portion." };
    }
    if (id === "test-magnetic-response") {
      atomId = "atom.observe.test-magnetic-response"; Object.assign(parameters, { sourceInstanceId: "dry-test-line", instrumentInstanceId: "magnetic-tool" });
      equipmentRoleBindings = { "bonding-test-vessel": item("dry-test-line").definitionId, "magnetic-response-tool": item("magnetic-tool").definitionId };
      interaction = { type: "readInstrument", sourceDefinitionId: item("dry-test-line").definitionId, stationId: item("magnetic-tool").definitionId, valueParameter: "measurementId", accessibleLabel: "Test and read magnetic response for this sample." };
    }
    if (id === "stage-melting-sample") {
      verb = "place"; atomId = "atom.place.melting-point-sample"; Object.assign(parameters, { sourceInstanceId: "dry-test-line", instrumentInstanceId: "melting-instrument", meltingApparatusLimits: configured("meltingApparatusLimits") });
      equipmentRoleBindings = { "bonding-test-vessel": item("dry-test-line").definitionId, "melting-point-instrument": item("melting-instrument").definitionId };
      interaction = { type: "dragToZone", sourceDefinitionId: item("dry-test-line").definitionId, stationId: item("melting-instrument").definitionId, accessibleLabel: "Stage the sample at the configured melting apparatus." };
    }
    if (id === "read-melting-behavior") {
      atomId = "atom.observe.read-melting-behavior"; Object.assign(parameters, { sourceInstanceId: "dry-test-line", instrumentInstanceId: "melting-instrument", meltingApparatusLimits: configured("meltingApparatusLimits") });
      equipmentRoleBindings = { "melting-point-instrument": item("melting-instrument").definitionId, "bonding-test-vessel": item("dry-test-line").definitionId };
      interaction = { type: "readInstrument", sourceDefinitionId: item("dry-test-line").definitionId, stationId: item("melting-instrument").definitionId, valueParameter: "measurementId", accessibleLabel: "Read melting behavior within configured apparatus limits." };
    }
    if (measurementPairs.has(id)) {
      parameters.measurementId = measurementPairs.get(id);
      if (id.startsWith("record-")) parameters.copyExistingMeasurementOnly = true;
    }
    if (choiceIds.has(id)) {
      Object.assign(parameters, { inputMode: "choice", inputRole: "studentResponse", inputKey: `${id}-choice`, inputLabel: id.replaceAll("-", " "), inputRequired: true });
      interaction = { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: `Record the direct ${id.replaceAll("-", " ")} observation.` };
    }
    const action = { id, verb, label: id.replaceAll("-", " "), ...(atomId ? { atomId } : {}), ...(equipmentRoleBindings ? { equipmentRoleBindings } : {}), parameters, interaction,
      prerequisites: index === 0 ? [] : [{ id: `${id}--previous-action`, type: "actionEvidence", label: "Previous sample operation is complete.", actionId: bondingActionIds[index - 1] }],
      stateChanges: [`${id.replaceAll("-", " ")} is completed for only the configured sample evidence scope.`], invalidCases: [],
      feedback: { success: `${id.replaceAll("-", " ")} complete.`, invalid: "Use the configured sample, fresh test line, and approved panel." }, evidence: ["sample-scoped", id] };
    if (id.startsWith("dispense-")) {
      action.mass = { source: "configured-input" };
      Object.assign(action.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputKey: `${id}-mass-g`, inputLabel: "Instructor-approved microsample transfer mass (g)", inputRequired: true, inputMin: 0, inputMinExclusive: true, unit: "g", evidenceProvenance: "C: configured transfer quantity; not an acquired balance measurement" });
      action.interaction.valueParameter = "inputKey";
      action.feedback.invalid = "Enter a positive approved transfer mass within the source inventory.";
    }
    if (id.startsWith("apply-")) {
      if (action.verb !== "rinse") action.volume = { source: "action-input" };
      else delete action.volume;
      Object.assign(action.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputKey: `${id}-volume`, inputLabel: "Approved reagent volume (mL)", inputRequired: true, inputMin: 0, inputMinExclusive: true, unit: "mL" });
      action.interaction.valueParameter = "inputKey";
    }
    if (choiceIds.has(id)) action.choiceObservation = { outputCalculationId: `${id}-choice`, options: [{ label: "Observed", tag: "observed", value: 1 }, { label: "Not observed", tag: "not-observed", value: 0 }, { label: "Ambiguous", tag: "ambiguous", value: 0.5 }] };
    if (id.startsWith("record-") && measurementPairs.has(id)) action.prerequisites = [{ id: `${id}--measurement-required`, type: "measurementRecorded", label: "Instrument evidence was acquired.", measurementId: measurementPairs.get(id) }];
    if (id.startsWith("read-")) {
      Object.assign(action.parameters, { inputMode: "numeric", inputRole: "studentResponse", inputKey: `${id}-reading`, inputLabel: "Externally acquired classroom instrument reading", inputRequired: true, instrumentEvidence: id, unit: id.includes("conductivity") ? "uS/cm" : id.includes("ph-") ? "pH" : "C" });
      action.interaction.valueParameter = "inputKey";
    }
    if (id === "test-magnetic-response") {
      Object.assign(action.parameters, { instrumentEvidence: id, inputMode: "numeric", inputRole: "studentResponse", inputKey: "magnetic-observation", inputLabel: "Observed attraction: 1 = attracted, 0 = no attraction", inputRequired: true, inputMin: 0, inputMax: 1, unit: "flag" });
      action.interaction.valueParameter = "inputKey";
    }
    return action;
  });
  technique.process = { startNodeId: "label-test-locations-node", nodes: technique.actions.map(makeNode), edges: technique.actions.slice(1).map((action, index) => ({ from: `${technique.actions[index].id}-node`, to: `${action.id}-node`, label: "Next", condition: { type: "validationPassed" } })) };
  technique.learningGoal = "Collect a configured, fresh-microsample property panel for one known or blind solid without revealing blind identity.";
  technique.successCriteria = [];
};

const addQuickAchePropertyOperations = (technique) => {
  if (technique.actions.some((action) => action.id === "qar-transfer-sucrose-test-portion")) return;
  const additions = [];
  for (const component of ["sucrose", "acetaminophen", "aspirin"]) {
    const label = component[0].toUpperCase() + component.slice(1);
    additions.push(
      {
        id: `qar-transfer-${component}-test-portion`, verb: "transfer", label: `Transfer a fresh ${component} test portion`,
        atomId: "atom.transfer.microsample-portion",
        equipmentRoleBindings: { "sample-source": "small-vial", "bonding-test-vessel": "test-tube" },
        parameters: { sourceDefinitionId: "small-vial", sourceInstanceId: `qar-${component}-standard`, targetDefinitionId: "test-tube", targetInstanceId: "qar-property-test-tube", amountProvenance: "teacher-approved microscale configuration" },
        interaction: { type: "pourInto", sourceDefinitionId: "small-vial", targetDefinitionId: "test-tube", accessibleLabel: `Transfer the approved fresh ${component} microsample.` },
        prerequisites: [], stateChanges: [`A fresh, labeled ${component} microsample is staged without assuming its result.`],
        invalidCases: [{ id: "wrong-standard", when: "the standard or test vessel identity does not match", message: "Property evidence must retain the pure-component identity.", recovery: "Use a fresh labeled portion of the named standard." }],
        feedback: { success: `${label} test portion staged.`, invalid: "Preserve the named pure-component identity and approved amount." }, evidence: ["transfer", component, "fresh-microsample"],
      },
      {
        id: `qar-apply-${component}-approved-property-test`, verb: "transfer", label: `Apply the approved property test to ${component}`,
        atomId: "atom.transfer.apply-test-solvent",
        equipmentRoleBindings: { "bonding-test-solvent-source": "reagent-bottle", "bonding-test-vessel": "test-tube" },
        parameters: { sourceDefinitionId: "reagent-bottle", sourceInstanceId: "qar-property-reagent", targetDefinitionId: "test-tube", targetInstanceId: "qar-property-test-tube", solventOrReagentIdentity: "approved property-test choice", quantityProvenance: "teacher-approved configuration" },
        interaction: { type: "pourInto", sourceDefinitionId: "reagent-bottle", targetDefinitionId: "test-tube", accessibleLabel: `Apply the approved configured property test to ${component}.` },
        prerequisites: [{ id: `qar-${component}-portion-required`, type: "actionEvidence", label: `Fresh ${component} portion is present.`, actionId: `qar-transfer-${component}-test-portion` }],
        stateChanges: [`The approved property-test reagent is applied to ${component}; no outcome is prefilled.`],
        invalidCases: [{ id: "unapproved-test", when: "the reagent, amount, or test is not in the approved plan", message: "Only an approved property test may generate evidence.", recovery: "Return to the approved test matrix." }],
        feedback: { success: `${label} property test applied.`, invalid: "Use the approved test and configured quantity." }, evidence: ["transfer", component, "approved-property-test"],
      },
      {
        id: `qar-inspect-${component}-property-result`, verb: "observe", label: `Inspect the ${component} property result`,
        parameters: { sourceDefinitionId: "test-tube", sourceInstanceId: "qar-property-test-tube", measurementId: `qar-${component}-property-observation`, resultProvenance: "student direct observation; no expected identity or result literal" },
        interaction: { type: "readInstrument", sourceDefinitionId: "test-tube", stationId: "test-tube", valueParameter: "measurementId", accessibleLabel: `Inspect the observed ${component} property result.` },
        prerequisites: [{ id: `qar-${component}-test-required`, type: "actionEvidence", label: `Approved ${component} test is applied.`, actionId: `qar-apply-${component}-approved-property-test` }],
        stateChanges: [`The observed ${component} result is acquired for its own evidence scope.`],
        invalidCases: [{ id: "cross-component-evidence", when: "an observation belongs to another pure component", message: "One component's result cannot satisfy another component's evidence.", recovery: "Inspect the current labeled test portion." }],
        feedback: { success: `${label} property result acquired.`, invalid: "Use the current labeled pure-component test." }, evidence: ["observe", component, `qar-${component}-property-observation`],
      },
    );
  }
  const ordered = [];
  for (const action of technique.actions) {
    ordered.push(action);
    if (action.id === "qar-select-pure-component-tests") ordered.push(...additions.slice(0, 3));
    if (action.id === "qar-record-sucrose-properties") ordered.push(...additions.slice(3, 6));
    if (action.id === "qar-record-acetaminophen-properties") ordered.push(...additions.slice(6, 9));
  }
  technique.actions = ordered;
  technique.process = {
    startNodeId: technique.process.startNodeId,
    nodes: ordered.map((action) => technique.process.nodes.find((node) => node.actionId === action.id) ?? makeNode(action)),
    edges: ordered.slice(1).map((action, index) => ({ from: (technique.process.nodes.find((node) => node.actionId === ordered[index].id) ?? makeNode(ordered[index])).id, to: (technique.process.nodes.find((node) => node.actionId === action.id) ?? makeNode(action)).id, label: "Next", condition: { type: "validationPassed" } })),
  };
};

const isolateQuickAchePropertyVessels = (technique, lab) => {
  const baseId = "qar-property-test-tube";
  const base = lab.initialState.equipment.find((item) => item.id === baseId)
    ?? technique.initialState.equipment.find((item) => item.id === baseId)
    ?? lab.initialState.equipment.find((item) => /^qar-(?:sucrose|acetaminophen|aspirin)-property-test-tube$/.test(item.id))
    ?? technique.initialState.equipment.find((item) => /^qar-(?:sucrose|acetaminophen|aspirin)-property-test-tube$/.test(item.id));
  if (!base) throw new Error("QuickAche property-test vessel is missing.");
  for (const component of ["sucrose", "acetaminophen", "aspirin"]) {
    const instanceId = `qar-${component}-property-test-tube`;
    if (!lab.initialState.equipment.some((item) => item.id === instanceId)) {
      lab.initialState.equipment.push({ ...clone(base), id: instanceId, label: `${component[0].toUpperCase()}${component.slice(1)} property-test tube` });
    }
    for (const action of technique.actions.filter((item) => item.id.includes(component))) {
      for (const key of ["sourceInstanceId", "targetInstanceId"]) {
        if (action.parameters?.[key] === baseId) action.parameters[key] = instanceId;
      }
    }
  }
  lab.initialState.equipment = lab.initialState.equipment.filter((item) => item.id !== baseId);
  technique.initialState.equipment = technique.initialState.equipment.filter((item) => item.id !== baseId);
};

const addQuickAcheExtractionBoundaries = (technique) => {
  if (technique.actions.some((action) => action.id === "qar-record-starting-mass-evidence")) return;
  const extras = new Map([
    ["qar-record-starting-mass", [{
      id: "qar-record-starting-mass-evidence", verb: "record", label: "Record the measured starting Quick Ache Relief mass",
      parameters: { measurementId: "qar-starting-mass", readActionId: "qar-record-starting-mass", evidenceScope: "starting-tablet-sample" },
      interaction: { type: "recordNotebook", valueParameter: "measurementId", accessibleLabel: "Record the measured starting sample mass." },
      prerequisites: [{ id: "qar-starting-mass-read-required", type: "measurementRecorded", label: "Starting mass was acquired from the balance.", measurementId: "qar-starting-mass" }],
      stateChanges: ["The acquired starting mass is recorded separately from the balance read."], invalidCases: [],
      feedback: { success: "Starting mass recorded.", invalid: "Read the starting mass before recording it." }, evidence: ["record", "qar-starting-mass", "starting-tablet-sample"],
    }]],
    ["qar-mix-and-vent", [{
      id: "qar-vent-extraction-funnel", verb: "observe", label: "Vent the separatory funnel under the approved sequence",
      parameters: { sourceDefinitionId: "separatory-funnel", sourceInstanceId: "qar-separatory-funnel", ventingProvenance: "R/C teacher-approved safety sequence" },
      interaction: { type: "recordNotebook", valueParameter: "ventingProvenance", accessibleLabel: "Vent the separatory funnel away from people as approved." },
      prerequisites: [{ id: "qar-mix-required-before-vent", type: "actionEvidence", label: "The extraction phases were mixed.", actionId: "qar-mix-and-vent" }],
      stateChanges: ["Pressure is relieved as a distinct recoverable safety operation."], invalidCases: [{ id: "unvented-pressure", when: "mixing continues without the approved vent step", message: "The funnel must be vented under the approved sequence.", recovery: "Stop mixing and perform the approved vent operation." }],
      feedback: { success: "Funnel vented.", invalid: "Follow the approved venting direction and sequence." }, evidence: ["vent", "qar-separatory-funnel", "approved-sequence"],
    }]],
    ["qar-settle-and-observe-layers", [{
      id: "qar-inspect-separated-layers", verb: "observe", label: "Inspect the settled layer evidence",
      parameters: { sourceDefinitionId: "separatory-funnel", sourceInstanceId: "qar-separatory-funnel", measurementId: "qar-layer-observation", identityRule: "identify only from supplied or observed physical-property evidence" },
      interaction: { type: "readInstrument", sourceDefinitionId: "separatory-funnel", stationId: "separatory-funnel", valueParameter: "measurementId", accessibleLabel: "Inspect the settled layers without assuming their identity." },
      prerequisites: [{ id: "qar-settled-layers-required", type: "actionEvidence", label: "The phases were allowed to settle.", actionId: "qar-settle-and-observe-layers" }],
      stateChanges: ["Layer appearance is acquired without assigning aqueous or organic identity."], invalidCases: [{ id: "premature-layer-identity", when: "identity is asserted before density or observed evidence", message: "Layer position alone is not accepted as identity evidence.", recovery: "Use the supplied or observed physical-property evidence." }],
      feedback: { success: "Layer evidence acquired.", invalid: "Acquire layer evidence before identifying either phase." }, evidence: ["observe", "qar-layer-observation", "unassigned-layer-identity"],
    }]],
  ]);
  const ordered = [];
  for (const action of technique.actions) {
    ordered.push(action, ...(extras.get(action.id) ?? []));
  }
  technique.actions = ordered;
  technique.process = {
    startNodeId: technique.process.startNodeId,
    nodes: ordered.map((action) => technique.process.nodes.find((node) => node.actionId === action.id) ?? makeNode(action)),
    edges: ordered.slice(1).map((action, index) => ({ from: (technique.process.nodes.find((node) => node.actionId === ordered[index].id) ?? makeNode(ordered[index])).id, to: (technique.process.nodes.find((node) => node.actionId === action.id) ?? makeNode(action)).id, label: "Next", condition: { type: "validationPassed" } })),
  };
};

const promoteRange = (lab, technique, firstNodeId, lastNodeId) => {
  const start = lab.process.nodes.findIndex((node) => node.id === firstNodeId);
  const end = lab.process.nodes.findIndex((node) => node.id === lastNodeId);
  if (start < 0 && lab.techniqueInstances) return;
  if (start < 0 || end < start) throw new Error(`Cannot promote ${lab.id} range ${firstNodeId}..${lastNodeId}.`);
  const nodes = clone(lab.process.nodes.slice(start, end + 1));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const actionIds = new Set(nodes.map((node) => node.actionId));
  technique.actions = clone(lab.actions.filter((action) => actionIds.has(action.id)));
  technique.process = { startNodeId: nodes[0].id, nodes, edges: clone(lab.process.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))) };
  const referenced = new Set();
  const collect = (value, key = "") => {
    if (Array.isArray(value)) return value.forEach((item) => collect(item, key));
    if (value && typeof value === "object") return Object.entries(value).forEach(([childKey, child]) => collect(child, childKey));
    if (typeof value === "string" && /InstanceId$/.test(key)) referenced.add(value);
  };
  technique.actions.forEach((action) => collect(action));
  technique.initialState.equipment = clone(lab.initialState.equipment.filter((item) => referenced.has(item.id)));
  technique.requiredEquipment = [...new Set(technique.initialState.equipment.map((item) => item.definitionId))];
  if (lab.chromatographyModels) technique.chromatographyModels = clone(lab.chromatographyModels);
  if (lab.titrationModels) technique.titrationModels = clone(lab.titrationModels);
  if (lab.kineticsModels) technique.kineticsModels = clone(lab.kineticsModels);
  technique.successCriteria = [];
};

// Lane-owned physical repeat chain; the comparison contract is supplied by the coordinator.
const addConstantMassLoop = (technique, prefix, ids) => {
  if (technique.actions.some((action) => action.id === `${prefix}-constant-mass-choice`)) return;
  const find = (id) => technique.actions.find((action) => action.id === id);
  const nodeFor = (id) => technique.process.nodes.find((node) => node.actionId === id);
  const cloneOperation = (sourceId, suffix, label) => {
    const action = clone(find(sourceId));
    action.id = `${prefix}-${suffix}`;
    action.label = label;
    action.prerequisites = [];
    delete action.parameters.dryMassG;
    action.stateChanges = [label];
    return action;
  };
  const configure = (suffix, label) => ({ id: `${prefix}-${suffix}`, verb: "observe", label,
    parameters: { inputRole: "teacherConfiguration", inputRequired: true, inputKey: `${prefix}-${suffix}-input`, inputLabel: label },
    interaction: { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: label },
    prerequisites: [], stateChanges: ["The instructor configuration is recorded."], invalidCases: [],
    feedback: { success: "Instructor configuration recorded.", invalid: "Supply the classroom criterion; do not infer it from the sample result." }, evidence: ["configuration", "C"] });
  const choice = configure("constant-mass-choice", "Confirm whether additional constant-mass cycles are required");
  choice.parameters.inputMode = "choice";
  choice.choiceObservation = { outputCalculationId: `${prefix}-constant-mass-required`, options: [{ label: "Required", tag: "required", value: 1 }, { label: "Not required", tag: "not-required", value: 0 }] };
  const criterion = configure("constant-mass-tolerance", "Enter the approved constant-mass tolerance in grams");
  Object.assign(criterion.parameters, { inputMode: "numeric", inputMin: 0, unit: "g", measurementId: `${prefix}-constant-mass-tolerance` });
  const previous = cloneOperation(ids.weigh, "previous-cooled-mass", "Read the cooled assembly mass before reheating");
  Object.assign(previous.parameters, { measurementId: `${prefix}-previous-cooled-mass`, inputKey: `${prefix}-previous-cooled-mass-input` });
  const reheat = cloneOperation(ids.dry, "repeat-drying", "Repeat the approved drying stage on this assembly");
  const cool = cloneOperation(ids.cool, "repeat-cooling", "Cool the reheated assembly before its next mass reading");
  const reweigh = cloneOperation(ids.weigh, "repeat-weighing", "Read this assembly's cooled mass after the repeat drying stage");
  Object.assign(reweigh.parameters, { measurementId: find(ids.weigh).parameters.measurementId, inputKey: `${prefix}-current-cooled-mass-input` });
  const record = cloneOperation(ids.record, "record-repeat-mass", "Record the new cooled assembly mass");
  record.parameters.measurementId = find(ids.weigh).parameters.measurementId;
  record.prerequisites = [{ id: `${record.id}-read-required`, type: "measurementRecorded", label: "The new mass was read after cooling.", measurementId: find(ids.weigh).parameters.measurementId }];
  const compare = { id: `${prefix}-compare-constant-mass`, verb: "calculate", label: "Compare successive cooled masses with the approved tolerance",
    parameters: {}, analysis: { type: "massDifferenceWithinTolerance", firstMassMeasurementId: previous.parameters.measurementId,
      secondMassMeasurementId: reweigh.parameters.measurementId, toleranceMeasurementId: criterion.parameters.measurementId,
      comparison: "atOrBelow", outputCalculationId: `${prefix}-constant-mass-result` },
    interaction: { type: "submitCalculation", valueParameter: "calculationId", accessibleLabel: "Evaluate the successive cooled mass difference." },
    prerequisites: [{ id: `${prefix}-criterion-required`, type: "actionEvidence", actionId: criterion.id, label: "Instructor mass tolerance supplied." },
      { id: `${prefix}-repeat-read-required`, type: "actionEvidence", actionId: reweigh.id, label: "The assembly was reweighed after cooling." }],
    stateChanges: ["The two acquired same-assembly masses are compared with the configured criterion."], invalidCases: [],
    feedback: { success: "Mass comparison calculated; follow the result branch.", invalid: "Acquire both cooled readings and the instructor criterion." }, evidence: ["calculation", "constant-mass"] };
  const additions = [choice, criterion, previous, reheat, cool, reweigh, record, compare];
  const entry = nodeFor(ids.record).id;
  const exits = technique.process.edges.filter((edge) => edge.from === entry);
  if (exits.length !== 1) throw new Error(`Expected one continuation from ${entry}.`);
  const next = exits[0].to;
  technique.actions.push(...additions);
  technique.process.nodes.push(...additions.map(makeNode));
  technique.process.edges = technique.process.edges.filter((edge) => edge.from !== entry);
  const edge = (from, to, condition = { type: "validationPassed" }) => ({ from, to, label: "Continue with this assembly's evidence", condition });
  const flag = (id, value) => ({ type: "calculationResult", calculationId: id, min: value, max: value });
  technique.process.edges.push(edge(entry, `${choice.id}-node`),
    edge(`${choice.id}-node`, next, flag(choice.choiceObservation.outputCalculationId, 0)),
    edge(`${choice.id}-node`, `${criterion.id}-node`, flag(choice.choiceObservation.outputCalculationId, 1)));
  const chain = [criterion, previous, reheat, cool, reweigh, record, compare];
  chain.slice(1).forEach((action, index) => technique.process.edges.push(edge(`${chain[index].id}-node`, `${action.id}-node`)));
  technique.process.edges.push(edge(`${compare.id}-node`, next, flag(compare.analysis.outputCalculationId, 1)),
    edge(`${compare.id}-node`, `${previous.id}-node`, flag(compare.analysis.outputCalculationId, 0)));
};

const addGravityFiltrationBranch = (technique, lab, prefix, ids, templates) => {
  const priorIds = new Set(technique.actions.filter((action) => action.id === `${prefix}-choose-filtration` || action.id.startsWith(`${prefix}-gravity-`)).map((action) => action.id));
  if (priorIds.size) {
    const priorNodes = new Set(technique.process.nodes.filter((node) => priorIds.has(node.actionId)).map((node) => node.id));
    const originalStart = technique.process.nodes.find((node) => node.actionId === ids.start).id;
    for (const edge of technique.process.edges) if (edge.to === `${prefix}-choose-filtration-node`) edge.to = originalStart;
    technique.process.edges = technique.process.edges.filter((edge) => !priorNodes.has(edge.from) && !priorNodes.has(edge.to));
    technique.process.nodes = technique.process.nodes.filter((node) => !priorNodes.has(node.id));
    technique.actions = technique.actions.filter((action) => !priorIds.has(action.id));
    technique.initialState.equipment = technique.initialState.equipment.filter((item) => ![`${prefix}-gravity-funnel`, `${prefix}-gravity-receiver`].includes(item.id));
  }
  const actionById = (id) => technique.actions.find((action) => action.id === id);
  const nodeByAction = (id) => technique.process.nodes.find((node) => node.actionId === id);
  const funnelId = `${prefix}-gravity-funnel`;
  const receiverId = `${prefix}-gravity-receiver`;
  for (const [id, definitionId] of [[funnelId, "funnel-stand"], [receiverId, "erlenmeyer-flask-250ml"]]) {
    const template = templates.find((item) => item.definitionId === definitionId);
    const item = { ...clone(template), id, label: `${prefix} ${definitionId === "funnel-stand" ? "preassembled gravity filtration stand" : "gravity filtrate receiver"}` };
    technique.initialState.equipment.push(item);
    if (!lab.initialState.equipment.some((candidate) => candidate.id === id)) lab.initialState.equipment.push(clone(item));
  }
  const choice = { id: `${prefix}-choose-filtration`, verb: "observe", label: "Select the instructor-approved filtration apparatus",
    parameters: { inputMode: "choice", inputRole: "teacherConfiguration", inputKey: `${prefix}-filtration-choice`, inputLabel: "Approved filtration apparatus", inputRequired: true },
    choiceObservation: { outputCalculationId: `${prefix}-filtration-mode`, options: [{ label: "Gravity", tag: "gravity", value: 0 }, { label: "Vacuum", tag: "vacuum", value: 1 }] },
    interaction: { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: "Select gravity or vacuum filtration before assembly." },
    prerequisites: [], stateChanges: ["The instructor apparatus selection determines the next assembly path."], invalidCases: [],
    feedback: { success: "Apparatus selection recorded.", invalid: "Select the approved apparatus before assembly." }, evidence: ["configuration", "C"] };
  const gravityActions = ids.gravitySources.map((sourceId) => {
    const action = clone(actionById(sourceId));
    action.id = `${prefix}-gravity-${sourceId}`;
    action.label = `Gravity filtration: ${action.label}`;
    action.prerequisites = [];
    const replace = (value) => {
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
      if (value === ids.funnel) return funnelId;
      if (value === ids.receiver) return receiverId;
      if (value === "buchner-funnel") return "funnel-stand";
      if (value === "side-arm-filter-flask" || value === "side-arm-flask") return "erlenmeyer-flask-250ml";
      if (value === "buchner-funnel-paper-seat") return "funnel-stand-paper-seat";
      if (value === "buchner-funnel-receiver-neck") return "funnel-receiving-vessel-zone";
      return value;
    };
    const result = replace(action);
    if (result.verb === "filter") result.parameters.receiverInstanceId = receiverId;
    const gravityCopy = (value) => {
      if (Array.isArray(value)) return value.map(gravityCopy);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, gravityCopy(item)]));
      if (typeof value !== "string") return value;
      return value.replace(/Buchner funnel perforated plate/gi, "gravity funnel paper seat").replace(/Buchner funnel/gi, "gravity funnel stand").replace(/Buchner/gi, "gravity funnel stand").replace(/side-arm (?:filter )?flask/gi, "Erlenmeyer receiver").replace(/side-arm receiver/gi, "Erlenmeyer receiver").replace(/perforated plate/gi, "paper seat");
    };
    for (const key of ["label", "parameters", "interaction", "feedback", "invalidCases"]) result[key] = gravityCopy(result[key]);
    result.stateChanges = ["The named sample follows the configured gravity filtration path."];
    return result;
  });
  const first = nodeByAction(ids.start).id;
  const next = nodeByAction(ids.next).id;
  for (const edge of technique.process.edges) if (edge.to === first) edge.to = `${choice.id}-node`;
  technique.actions.push(choice, ...gravityActions);
  technique.process.nodes.push(makeNode(choice), ...gravityActions.map(makeNode));
  technique.process.edges.push({ from: `${choice.id}-node`, to: first, label: "Vacuum apparatus", condition: { type: "calculationResult", calculationId: `${prefix}-filtration-mode`, min: 1, max: 1 } },
    { from: `${choice.id}-node`, to: `${gravityActions[0].id}-node`, label: "Preassembled gravity apparatus", condition: { type: "calculationResult", calculationId: `${prefix}-filtration-mode`, min: 0, max: 0 } });
  gravityActions.forEach((action, index) => technique.process.edges.push({ from: `${action.id}-node`, to: index + 1 < gravityActions.length ? `${gravityActions[index + 1].id}-node` : next, label: "Continue gravity filtration", condition: { type: "validationPassed" } }));
};

const techniques = new Map();
for (const id of techniqueIds) techniques.set(id, await readJson(`public/techniques/${id}.json`));
const labs = new Map();
for (const id of labIds) labs.set(id, await readJson(`public/labs/${id}.json`));

promoteRange(labs.get("paper-chromatography"), techniques.get("paper-chromatography"), "label-water-trial-node", "dispose-propanol-solvent-node");
buildBondingTechnique(techniques.get("bonding-solids-tests"), labs.get("bonding-unknown-solids"));
techniques.get("paper-chromatography").chromatographyModels = clone(labs.get("paper-chromatography").chromatographyModels ?? []);
// These notebook-backed marking actions identify the required pencil by
// definition. The pencil remains lab-owned equipment; it is not a composable
// runtime instance because the shared role registry has no pencil role.
for (const action of techniques.get("paper-chromatography").actions) {
  if (action.parameters?.markingToolDefinitionId === "pencil") delete action.parameters.markingToolInstanceId;
}
addQuickAchePropertyOperations(techniques.get("quick-ache-property-evidence"));
isolateQuickAchePropertyVessels(techniques.get("quick-ache-property-evidence"), labs.get("quick-ache-relief-separation"));
for (const action of techniques.get("quick-ache-property-evidence").actions.filter((item) => /^qar-transfer-(?:sucrose|acetaminophen|aspirin)-test-portion$/.test(item.id))) {
  if (action.equipmentRoleBindings?.["solid-sample-source"]) {
    action.equipmentRoleBindings["sample-source"] = action.equipmentRoleBindings["solid-sample-source"];
    delete action.equipmentRoleBindings["solid-sample-source"];
  }
}
addQuickAcheExtractionBoundaries(techniques.get("quick-ache-extraction-recovery"));
const extraction = techniques.get("quick-ache-extraction-recovery");
const controlsId = "qar-configure-extraction-controls";
if (!extraction.actions.some((action) => action.id === controlsId)) {
  const controls = { id: controlsId, verb: "observe", label: "Supply instructor-approved mixing, venting, settling and recovery controls",
    parameters: { inputRole: "teacherConfiguration", inputMode: "text", inputKey: "qar-extraction-controls", inputLabel: "Approved extraction controls and emulsion recovery", inputRequired: true },
    interaction: { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: "Supply the approved extraction controls." },
    prerequisites: [], stateChanges: ["The configured R/C procedure controls are recorded without assuming a successful extraction."], invalidCases: [],
    feedback: { success: "Extraction controls recorded.", invalid: "Supply the approved controls before manipulating the funnel." }, evidence: ["configuration", "R/C"] };
  const at = extraction.actions.findIndex((action) => action.id === "qar-mix-and-vent");
  extraction.actions.splice(at, 0, controls);
  extraction.process.nodes.push(makeNode(controls));
  const mixNode = extraction.process.nodes.find((node) => node.actionId === "qar-mix-and-vent").id;
  for (const edge of extraction.process.edges) if (edge.to === mixNode) edge.to = `${controlsId}-node`;
  extraction.process.edges.push({ from: `${controlsId}-node`, to: mixNode, label: "Approved controls supplied", condition: { type: "validationPassed" } });
}
for (const [id, operation] of [["qar-mix-and-vent", "mix"], ["qar-vent-extraction-funnel", "vent"], ["qar-settle-and-observe-layers", "settle"]]) {
  const action = extraction.actions.find((item) => item.id === id);
  action.verb = operation;
  action.label = `${operation[0].toUpperCase()}${operation.slice(1)} the extraction funnel under the approved controls`;
  action.atomId = `atom.${operation}.extraction-funnel`;
  action.equipmentRoleBindings = { "extraction-funnel": "separatory-funnel" };
  action.parameters = { sourceInstanceId: "qar-separatory-funnel", sourceDefinitionId: "separatory-funnel" };
  action.interaction = { type: "recordNotebook", accessibleLabel: action.label };
  action.extractionOperation = { operation, vesselInstanceId: "qar-separatory-funnel", requiredControlActionIds: [controlsId] };
  action.prerequisites = [...action.prerequisites.filter((rule) => rule.actionId !== controlsId), { id: `${id}-controls-required`, type: "actionEvidence", actionId: controlsId, label: "Instructor extraction controls supplied." }];
  action.stateChanges = [`The named funnel's ${operation} procedure state changes; layer identity remains unassigned.`];
}
const layerObservation = extraction.actions.find((action) => action.id === "qar-inspect-separated-layers");
layerObservation.parameters = { sourceInstanceId: "qar-separatory-funnel", sourceDefinitionId: "separatory-funnel", inputMode: "choice", inputRole: "studentResponse", inputKey: "qar-layer-observation", inputLabel: "Observed layer condition", inputOptions: ["layers-observed", "emulsion", "incomplete"], inputRequired: true };
layerObservation.interaction = { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: "Report the observed layer condition without a preset result." };
layerObservation.extractionObservation = { vesselInstanceId: "qar-separatory-funnel" };
layerObservation.parameters.requireSeparatedLayers = true;
const repeatChoice = extraction.actions.find((action) => action.id === "qar-repeat-approved-extractions");
repeatChoice.parameters = { inputMode: "numeric", inputRole: "teacherConfiguration", inputKey: "approved-extraction-count", inputLabel: "This supported route executes one extraction. Enter 1 only if the instructor-approved plan requires no further washes; other counts need a separately authored procedure.", inputRequired: true, inputMin: 1, inputMax: 1, measurementId: "qar-approved-extraction-count", unit: "count" };
repeatChoice.interaction.valueParameter = "inputKey";
const emulsionHistory = extraction.actions.find((action) => action.id === "qar-recover-from-emulsion");
if (emulsionHistory) emulsionHistory.parameters = { inputMode: "text", inputRole: "studentResponse", inputKey: "qar-settling-history", inputLabel: "Record the completed standing and layer-observation history. This route does not model brine addition or other emulsion interventions.", inputRequired: true };
for (const id of ["qar-drain-lower-layer", "qar-drain-upper-layer"]) extraction.actions.find((action) => action.id === id).extractionDrain = { vesselInstanceId: "qar-separatory-funnel" };
// These source-configured recovery methods are not supplied. Preserve fractions and stop,
// rather than manufacture a precipitate using magnesium sulfate as a fictitious reagent.
for (const fraction of ["organic", "aqueous"]) {
  const action = extraction.actions.find((item) => item.id === `qar-recover-${fraction}-component`);
  action.verb = "observe";
  delete action.atomId;
  delete action.equipmentRoleBindings;
  action.label = `Recovery method required for the retained ${fraction} fraction`;
  action.parameters = { prompt: `This retained ${fraction} fraction cannot proceed until an instructor supplies a supported recovery method, endpoint and heating restrictions. Its material and evidence remain preserved.`, configurationRequired: true, unlocked: false, sourceConfigurationBlock: "request-07-approved-recovery-method" };
  action.interaction = { type: "recordNotebook", accessibleLabel: action.label };
  action.prerequisites = [{ id: `${action.id}-unsupported-method`, type: "statePath", path: "unsupportedRecoveryMethodApproved", equals: true, label: "A supported instructor-approved recovery method must be implemented before this path can execute." }];
  action.stateChanges = ["No fraction state change: recovery is blocked pending a supported approved method."];
  action.feedback = { success: "Recovery remains unavailable pending the approved implementation.", invalid: action.parameters.prompt };
  action.evidence = ["source-configuration-block", "request-07"];
}
const settleAction = extraction.actions.find((action) => action.id === "qar-settle-and-observe-layers");
const configureFractionAction = (action, operation, sourceInstanceId, fractionId, targetInstanceId) => {
  const verbs = { "remove-solvent": "dry", "remove-drying-agent": "transfer", "observe-residue": "observe", "collect-residue": "transfer", "observe-dryness": "dry", "observe-cooling": "cool", dispose: "transfer", "remove-label": "rinse" };
  action.verb = verbs[operation];
  action.atomId = `atom.${action.verb}.fraction-${operation}`;
  action.equipmentRoleBindings = { "recovery-vessel": extraction.initialState.equipment.find((item) => item.id === sourceInstanceId).definitionId };
  action.fractionHandling = { operation, sourceInstanceId, fractionId, ...(targetInstanceId ? { targetInstanceId } : {}) };
  action.label = `${operation.replaceAll("-", " ")}: ${fractionId} fraction`;
  delete action.mass; delete action.volume;
  action.parameters = { sourceInstanceId, inputMode: ["remove-solvent", "observe-cooling"].includes(operation) ? "numeric" : "choice", inputRole: "studentResponse", inputKey: `${action.id}-observation`, inputRequired: true, inputLabel: action.label,
    recoveryMethod: fractionId === "acidic" ? "external-acid-recovery" : configured(`${fractionId}RecoveryMethod`),
    drynessCriterion: configured("drynessCriterion"), coolingLimitC: configured("coolingLimitC"), recoverySetupApproved: configured("recoverySetupApproved"),
    sourceDefinitionId: extraction.initialState.equipment.find((item) => item.id === sourceInstanceId).definitionId,
    targetDefinitionId: extraction.initialState.equipment.find((item) => item.id === (targetInstanceId ?? sourceInstanceId)).definitionId,
    ...(operation === "remove-solvent" ? { recoveryMethod: configured(`${fractionId}RecoveryMethod`), inputLabel: "Observed remaining solvent volume (mL); zero does not establish residue or yield", inputMin: 0 } : {}),
    ...(operation === "observe-residue" ? { inputOptions: ["residue-present", "no-residue", "incomplete"] } : {}),
    ...(operation === "observe-dryness" ? { inputOptions: ["dry", "wet", "uncertain"], drynessCriterion: configured("drynessCriterion"), inputLabel: `Observed dryness against approved criterion: ${configured("drynessCriterion")}` } : {}),
    ...(operation === "observe-cooling" ? { coolingLimitC: configured("coolingLimitC"), inputLabel: "Measured cooled fraction temperature (C)" } : {}),
    ...(operation === "collect-residue" ? { inputOptions: ["collected"], inputLabel: "Collect the observed residue in its clean tared receiver" } : {}) };
  if (operation === "remove-drying-agent") Object.assign(action.parameters, { inputOptions: ["agent-separated"], inputLabel: "Separate MgSO4 by the approved filtration/decantation before solvent removal" });
  action.interaction = { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: action.label };
  action.prerequisites = (action.prerequisites ?? []).filter((rule) => rule.type !== "statePath");
  action.stateChanges = ["The named fraction records externally observed handling; no identity or mass is inferred."];
  action.feedback = { success: "Observed handling recorded for this fraction.", invalid: "Use acquired classroom evidence for the named fraction; preserve unresolved material." };
  action.evidence = ["classroom-observation", "fraction-provenance", "R/C"];
  const node = extraction.process.nodes.find((node) => node.actionId === action.id);
  if (node) { node.title = action.label; node.description = action.label; }
};
const insertExtractionBefore = (beforeId, action) => {
  const existing = extraction.actions.findIndex((item) => item.id === action.id);
  if (existing >= 0) { extraction.actions[existing] = action; return; }
  const node = extraction.process.nodes.find((item) => item.actionId === beforeId);
  for (const edge of extraction.process.edges) if (edge.to === node.id) edge.to = `${action.id}-node`;
  extraction.process.edges.push({ from: `${action.id}-node`, to: node.id, label: "Continue named fraction", condition: { type: "validationPassed" } });
  extraction.process.nodes.push(makeNode(action));
  extraction.actions.splice(extraction.actions.findIndex((item) => item.id === beforeId), 0, action);
};
for (const owner of [extraction, labs.get("quick-ache-relief-separation")]) if (!owner.initialState.equipment.some((item) => item.id === "qar-dried-organic-fraction-flask")) {
  const receiver = clone(owner.initialState.equipment.find((item) => item.id === "qar-organic-fraction-flask"));
  receiver.id = "qar-dried-organic-fraction-flask"; receiver.label = "Organic solution after drying-agent removal";
  receiver.contents = { kind: "empty", label: "Empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" };
  owner.initialState.equipment.push(receiver);
}
const removeAgent = { id: "qar-remove-drying-agent", prerequisites: [], invalidCases: [] };
configureFractionAction(removeAgent, "remove-drying-agent", "qar-organic-fraction-flask", "organic", "qar-dried-organic-fraction-flask");
insertExtractionBefore("qar-recover-organic-component", removeAgent);
for (const fraction of ["organic", "aqueous"]) {
  const source = fraction === "organic" ? "qar-dried-organic-fraction-flask" : "qar-extraction-beaker";
  configureFractionAction(extraction.actions.find((item) => item.id === `qar-recover-${fraction}-component`), "remove-solvent", source, fraction);
  configureFractionAction(extraction.actions.find((item) => item.id === `qar-wash-${fraction}-solid`), "observe-residue", source, fraction);
}
configureFractionAction(extraction.actions.find((item) => item.id === "qar-precipitate-recovered-component"), "observe-residue", "qar-aqueous-fraction-flask", "acidic");
const recoveryPh = { id: "qar-read-recovery-ph", verb: "observe", label: "Acquire the acidified fraction pH", parameters: { sourceInstanceId: "qar-aqueous-fraction-flask", sourceDefinitionId: "erlenmeyer-flask-250ml", instrumentInstanceId: "qar-ph-meter", instrumentEvidence: "read-ph-indicator", phThresholds: configured("acidEndpointPh"), inputMode: "numeric", inputRole: "studentResponse", inputKey: "qar-acid-ph-input", inputLabel: "Observed acidified fraction pH", inputRequired: true, inputMin: 0, inputMax: configured("acidEndpointPh"), unit: "pH", measurementId: "qar-acid-endpoint-ph" }, interaction: { type: "readInstrument", sourceDefinitionId: "erlenmeyer-flask-250ml", stationId: "ph-meter", valueParameter: "inputKey", accessibleLabel: "Read the acidified fraction pH" }, prerequisites: [{ id: "qar-acid-added", type: "actionEvidence", actionId: "qar-acidify-recovered-fraction", label: "Acid was added to the named fraction." }], stateChanges: ["Actual pH evidence is acquired; no precipitation is inferred."], invalidCases: [], feedback: { success: "Acquired pH meets the configured endpoint.", invalid: "Continue the approved acidification before reporting the endpoint." }, evidence: ["classroom-instrument-evidence"], equipmentRoleBindings: { "recovery-vessel": "erlenmeyer-flask-250ml", "immersed-probe-instrument": "ph-meter" } };
insertExtractionBefore("qar-precipitate-recovered-component", recoveryPh);
const acidicObservation = extraction.actions.find((item) => item.id === "qar-precipitate-recovered-component");
acidicObservation.parameters.acidEndpointMeasurementId = "qar-acid-endpoint-ph";
acidicObservation.parameters.acidEndpointPh = configured("acidEndpointPh");
acidicObservation.prerequisites = [{ id: "qar-acid-ph-required", type: "actionEvidence", actionId: recoveryPh.id, label: "Acquire the approved pH endpoint before inspecting residue." }];
for (const fraction of ["acidic", "organic", "aqueous"]) {
  const source = fraction === "acidic" ? "qar-filter-paper" : fraction === "organic" ? "qar-dried-organic-fraction-flask" : "qar-extraction-beaker";
  const watch = `qar-${fraction}-recovery-watch-glass`;
  const collect = { id: `qar-collect-${fraction}-residue`, prerequisites: [], invalidCases: [] };
  configureFractionAction(collect, "collect-residue", source, fraction, watch);
  insertExtractionBefore(`qar-dry-${fraction}-solid`, collect);
  configureFractionAction(extraction.actions.find((item) => item.id === `qar-dry-${fraction}-solid`), "observe-dryness", watch, fraction);
  configureFractionAction(extraction.actions.find((item) => item.id === `qar-cool-${fraction}-solid`), "observe-cooling", watch, fraction);
  const weigh = extraction.actions.find((item) => item.id === `qar-weigh-${fraction}-solid`);
  delete weigh.parameters.requiresDryPrecipitate;
  weigh.parameters.requiresObservedResidue = true;
  weigh.parameters.maxSafeTemperatureC = configured("coolingLimitC");
}
const dryingAgent = extraction.actions.find((item) => item.id === "qar-dry-organic-phase-with-mgso4");
delete dryingAgent.parameters.massG;
dryingAgent.mass = { source: "configured-input" };
Object.assign(dryingAgent.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputRequired: true, inputMin: 0, inputMinExclusive: true, inputKey: "qar-drying-agent-mass", inputLabel: "Approved MgSO4 drying-agent portion (g)" });
dryingAgent.interaction.valueParameter = "inputKey";
settleAction.prerequisites = settleAction.prerequisites.filter((rule) => rule.notebookTag !== "funnel-vented");
if (!settleAction.prerequisites.some((rule) => rule.actionId === "qar-vent-extraction-funnel")) settleAction.prerequisites.push({ id: "qar-settle-vent-action-required", type: "actionEvidence", actionId: "qar-vent-extraction-funnel", label: "The funnel was vented under approved controls." });
const identityAction = extraction.actions.find((action) => action.id === "qar-identify-layer-from-evidence");
identityAction.extractionIdentity = { vesselInstanceId: "qar-separatory-funnel" };
identityAction.parameters = { sourceInstanceId: "qar-separatory-funnel", organicDensity: configured("organicDensity"), aqueousDensity: configured("aqueousDensity"), inputMode: "choice", inputRole: "studentResponse", inputKey: "qar-layer-identity", inputRequired: true, inputOptions: ["aqueous-below-organic-confirmed"], inputLabel: "Confirm observed aqueous-below-organic order against the supplied phase densities" };
identityAction.interaction = { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: "Confirm the observed density-supported layer order" };
const startingTransfer = extraction.actions.find((action) => action.id === "qar-transfer-weighed-sample");
delete startingTransfer.parameters.massG;
startingTransfer.mass = { source: "measurement", referenceId: "qar-starting-mass" };
identityAction.prerequisites = [
  { id: "qar-layer-read-required", type: "actionEvidence", actionId: "qar-inspect-separated-layers", label: "The settled layers were explicitly inspected." },
  { id: "qar-observed-layers-required", type: "notebookEntry", notebookTag: "layers-observed", label: "The explicit observation reports distinguishable layers." }
];
const identityNode = extraction.process.nodes.find((node) => node.actionId === identityAction.id);
identityNode.validation = [{ id: `${identityNode.id}-action-required`, type: "actionEvidence", actionId: identityAction.id, label: "Layer identification completed from evidence." }, ...identityAction.prerequisites.map((rule) => ({ ...rule, id: `${identityNode.id}-${rule.id}` }))];
const paperAtoms = { markBaseline: "atom.observe.mark-chromatography-baseline", drySpot: "atom.observe.dry-chromatography-spot", markSolventFront: "atom.observe.mark-chromatography-solvent-front", dryDevelopedPaper: "atom.observe.dry-developed-chromatography-paper" };
const configuredPaper = techniques.get("paper-chromatography");
configuredPaper.learningGoal = "Compare separately acquired chromatography evidence using instructor-approved geometry and one of the explicitly supported R/C illustrative solvent models; unconfigured or unsupported model choices remain blocked.";
for (const action of configuredPaper.actions) {
  for (const key of ["baselineHeightMm", "solventDepthMm", "spotVolumeMl", "stopCondition"]) if (key in action.parameters) action.parameters[key] = configured(key);
  if ("originDistanceMm" in action.parameters) action.parameters.originDistanceMm = configured("baselineHeightMm");
  if (typeof action.parameters.volumeMl === "number") action.parameters.volumeMl = configured(action.id.includes("capillary") ? "spotterLoadVolumeMl" : "solventVolumeMl");
  if (/identify-.*-bands|record-.*-quality/.test(action.id)) {
    action.parameters.note = "Inspect this trial's generated chromatogram and record the visible regions, overlap and uncertainty without inferring hidden components.";
  }
  if (action.parameters.instruction) action.parameters.instruction = action.parameters.instruction.replace(/15 mm/g, "configured baseline height").replace(/5 mm/g, "configured solvent depth");
  if (action.parameters.note) action.parameters.note = action.parameters.note.replace(/15 mm/g, "configured baseline height").replace(/5 mm/g, "configured solvent depth");
}
for (const action of techniques.get("paper-chromatography").actions) {
  const atomId = paperAtoms[action.parameters?.chromatographyOperation];
  if (atomId) { action.atomId = atomId; action.equipmentRoleBindings = { "stationary-phase": "chromatography-paper" }; }
}

const gravityTemplates = (await readJson("public/techniques/filtration.json")).initialState.equipment;
addGravityFiltrationBranch(techniques.get("gravimetric-vacuum-filtration"), labs.get("hard-water-analysis"), "practice", {
  start: "place-practice-buchner", next: "record-practice-filtration", funnel: "practice-buchner", receiver: "practice-filter-flask",
  gravitySources: ["place-practice-buchner", "seat-practice-filter-paper", "attach-practice-filter-flask", "wet-practice-filter-paper", "filter-practice-mixture", "rinse-practice-beaker", "wash-practice-precipitate"]
}, gravityTemplates);
for (const sample of ["c", "d"]) addGravityFiltrationBranch(techniques.get("hard-water-two-sample-inquiry"), labs.get("hard-water-analysis"), `unknown-${sample}`, {
  start: `unknown-${sample}-place-buchner`, next: `unknown-${sample}-label-watch`, funnel: `unknown-${sample}-buchner`, receiver: `unknown-${sample}-flask`,
  gravitySources: ["place-buchner", "seat-paper", "attach-flask", "wet-paper", "filter", "rinse-beaker", "wash-precipitate"].map((suffix) => `unknown-${sample}-${suffix}`)
}, gravityTemplates);

addConstantMassLoop(techniques.get("two-stage-precipitate-drying"), "practice", { weigh: "weigh-practice-combined", dry: "second-practice-drying", cool: "cool-practice-assembly", record: "record-practice-combined" });
for (const sample of ["c", "d"]) addConstantMassLoop(techniques.get("hard-water-two-sample-inquiry"), `unknown-${sample}`, { weigh: `unknown-${sample}-weigh-combined`, dry: `unknown-${sample}-second-dry`, cool: `unknown-${sample}-cool`, record: `unknown-${sample}-record-combined` });

// Select accepted mass by a fresh final acquisition on both allowed paths, so the
// optional comparison never leaves downstream calculations bound to a stale initial mass.
for (const [techniqueId, prefixes] of [["two-stage-precipitate-drying", ["practice"]], ["hard-water-two-sample-inquiry", ["unknown-c", "unknown-d"]]]) {
  const technique = techniques.get(techniqueId);
  for (const prefix of prefixes) {
    const initial = technique.actions.find((action) => action.id === (prefix === "practice" ? "weigh-practice-combined" : `${prefix}-weigh-combined`));
    const initialRecord = technique.actions.find((action) => action.id === (prefix === "practice" ? "record-practice-combined" : `${prefix}-record-combined`));
    const finalId = `${prefix}-weigh-accepted-combined`;
    const finalMeasurementId = prefix === "practice" ? "practice-combined-mass" : initialRecord.parameters.measurementId.replace(`${prefix}-initial-cooled-mass`, `${prefix}-combined-mass`);
    // Inquiry original mass names use the source's stable combined-mass identity.
    const stableMeasurementId = prefix === "practice" ? finalMeasurementId : `${prefix}-combined-mass`;
    if (!technique.actions.some((action) => action.id === finalId)) {
      const accepted = clone(initial);
      accepted.id = finalId; accepted.label = "Acquire the accepted cooled assembly mass for downstream calculations";
      accepted.parameters.measurementId = stableMeasurementId; delete accepted.mass;
      const record = clone(initialRecord); record.id = `${prefix}-record-accepted-combined`;
      record.label = "Record the accepted cooled assembly mass";
      record.parameters.measurementId = stableMeasurementId;
      record.prerequisites = [{ id: `${record.id}-required`, type: "measurementRecorded", measurementId: stableMeasurementId, label: "Accepted cooled assembly mass acquired." }];
      const compareNode = `${prefix}-compare-constant-mass-node`;
      const acceptedEdge = technique.process.edges.find((edge) => edge.from === compareNode && edge.condition.min === 1);
      const next = acceptedEdge.to;
      acceptedEdge.to = `${accepted.id}-node`;
      const skipped = technique.process.edges.find((edge) => edge.from === `${prefix}-constant-mass-choice-node` && edge.condition.min === 0);
      skipped.to = `${accepted.id}-node`;
      technique.actions.push(accepted, record); technique.process.nodes.push(makeNode(accepted), makeNode(record));
      technique.process.edges.push({ from: `${accepted.id}-node`, to: `${record.id}-node`, label: "Record acquired mass", condition: { type: "validationPassed" } }, { from: `${record.id}-node`, to: next, label: "Calculate from accepted mass", condition: { type: "validationPassed" } });
    }
    initial.parameters.measurementId = `${prefix}-initial-cooled-mass`; delete initial.mass;
    initialRecord.parameters.measurementId = `${prefix}-initial-cooled-mass`;
    for (const rule of initialRecord.prerequisites) if (rule.measurementId) rule.measurementId = `${prefix}-initial-cooled-mass`;
    const repeated = technique.actions.find((action) => action.id === `${prefix}-repeat-weighing`);
    repeated.parameters.measurementId = `${prefix}-repeat-cooled-mass`; delete repeated.mass;
    const repeatRecord = technique.actions.find((action) => action.id === `${prefix}-record-repeat-mass`);
    repeatRecord.parameters.measurementId = `${prefix}-repeat-cooled-mass`;
    for (const rule of repeatRecord.prerequisites) if (rule.measurementId) rule.measurementId = `${prefix}-repeat-cooled-mass`;
    technique.actions.find((action) => action.id === `${prefix}-compare-constant-mass`).analysis.secondMassMeasurementId = `${prefix}-repeat-cooled-mass`;
  }
}

// Expand a bounded repeat-until-criterion into ordinary fresh physical nodes. The
// eight-cycle software bound is disclosed, not asserted as a scientific endpoint.
for (const [techniqueId, prefixes] of [["two-stage-precipitate-drying", ["practice"]], ["hard-water-two-sample-inquiry", ["unknown-c", "unknown-d"]]]) {
  const technique = techniques.get(techniqueId);
  for (const prefix of prefixes) {
    const gateId = `${prefix}-additional-constant-mass-repetition-unsupported`;
    if (!technique.actions.some((action) => action.id === gateId)) {
      const gate = { id: gateId, verb: "observe", label: "Additional constant-mass repetition is unsupported",
        parameters: { configurationRequired: true, unlocked: false, prompt: "The extra cooled mass check is outside the approved tolerance. Preserve the assembly and evidence; another physical cycle requires supported repetition handling." },
        interaction: { type: "recordNotebook", accessibleLabel: "Additional constant-mass repetition is unsupported." },
        prerequisites: [{ id: `${gateId}-blocked`, type: "statePath", path: "unsupportedAdditionalMassCycleApproved", equals: true, label: "Further physical repetition requires a supported implementation." }],
        stateChanges: ["No accepted dry-mass result is produced; the assembly and readings remain preserved."], invalidCases: [],
        feedback: { success: "Additional repetition remains unavailable.", invalid: "Do not continue to accepted dry-mass calculations; another physical cycle is required." }, evidence: ["unsupported-repetition"] };
      technique.actions.push(gate); technique.process.nodes.push(makeNode(gate));
    }
    for (const edge of technique.process.edges) if (edge.from === `${prefix}-compare-constant-mass-node` && edge.condition.min === 0) edge.to = `${gateId}-node`;
    const terminal = technique.actions.find((action) => action.id === gateId);
    terminal.label = "Approved drying attempt budget exhausted without constant mass";
    terminal.parameters = { inputMode: "text", inputRole: "studentResponse", inputKey: `${prefix}-not-constant-report`, inputRequired: true, inputLabel: "Record the unresolved mass drift and request instructor review; do not report an accepted dry mass." };
    terminal.prerequisites = [];
    terminal.feedback = { success: "Unresolved constant mass recorded. This sample has no accepted final result.", invalid: "Record the unsuccessful endpoint and retain this assembly for instructor review." };
    terminal.evidence = ["criterion-not-reached", "software-bound-eight-attempts", "C"];
    const choice = technique.actions.find((action) => action.id === `${prefix}-constant-mass-choice`);
    choice.parameters.inputLabel = "Require constant mass? This implementation permits at most eight additional drying cycles; unresolved samples end without accepted mass.";
    if (!technique.actions.some((action) => action.id === `${prefix}-cycle-2-drying`)) {
      const originalCompare = technique.actions.find((action) => action.id === `${prefix}-compare-constant-mass`);
      const acceptedTarget = technique.process.edges.find((edge) => edge.from === `${originalCompare.id}-node` && edge.condition.min === 1).to;
      let previousCompare = originalCompare;
      let previousMass = `${prefix}-repeat-cooled-mass`;
      for (let iteration = 2; iteration <= 8; iteration += 1) {
        const newMass = `${prefix}-cycle-${iteration}-cooled-mass`;
        const copy = (suffix, originalId) => {
          const action = clone(technique.actions.find((candidate) => candidate.id === originalId));
          action.id = `${prefix}-cycle-${iteration}-${suffix}`;
          action.label = `Drying cycle ${iteration}: ${action.label}`;
          action.prerequisites = [];
          return action;
        };
        const dry = copy("drying", `${prefix}-repeat-drying`);
        const cool = copy("cooling", `${prefix}-repeat-cooling`);
        const weigh = copy("weighing", `${prefix}-repeat-weighing`);
        delete weigh.mass;
        weigh.parameters.measurementId = newMass;
        const record = copy("record", `${prefix}-record-repeat-mass`);
        record.parameters.measurementId = newMass;
        const compare = copy("compare", originalCompare.id);
        compare.analysis = { ...originalCompare.analysis, firstMassMeasurementId: previousMass, secondMassMeasurementId: newMass, outputCalculationId: `${prefix}-cycle-${iteration}-mass-result` };
        compare.prerequisites = [{ id: `${compare.id}-criterion`, type: "actionEvidence", actionId: `${prefix}-constant-mass-tolerance`, label: "The instructor criterion remains fixed." }];
        const chain = [dry, cool, weigh, record, compare];
        chain.forEach((action, index) => {
          if (index) action.prerequisites.push({ id: `${action.id}-prior`, type: "actionEvidence", actionId: chain[index - 1].id, label: "Complete the preceding operation on this same assembly." });
          technique.actions.push(action); technique.process.nodes.push(makeNode(action));
          if (index) technique.process.edges.push({ from: `${chain[index - 1].id}-node`, to: `${action.id}-node`, condition: { type: "validationPassed" }, label: "Continue this drying cycle" });
        });
        technique.process.edges.find((edge) => edge.from === `${previousCompare.id}-node` && edge.condition.min === 0).to = `${dry.id}-node`;
        technique.process.edges.push({ from: `${compare.id}-node`, to: acceptedTarget, condition: { type: "calculationResult", calculationId: compare.analysis.outputCalculationId, min: 1, max: 1 }, label: "Criterion reached" }, { from: `${compare.id}-node`, to: `${gateId}-node`, condition: { type: "calculationResult", calculationId: compare.analysis.outputCalculationId, min: 0, max: 0 }, label: "Criterion not reached" });
        previousCompare = compare; previousMass = newMass;
      }
    } else {
      technique.process.edges.find((edge) => edge.from === `${prefix}-compare-constant-mass-node` && edge.condition.min === 0).to = `${prefix}-cycle-2-drying-node`;
    }
  }
}

const insertCleanupBefore = (technique, beforeId, sourceId, wasteId, operation, actionId) => {
  const source = technique.initialState.equipment.find((item) => item.id === sourceId);
  if (!source) throw new Error(`Missing cleanup source ${sourceId}`);
  const action = { id: actionId, verb: operation === "dispose" ? "transfer" : "rinse", label: operation === "dispose" ? `Dispose of retained contents from ${source.label}` : `Remove marker from ${source.label} with teacher-supplied rubbing alcohol`, atomId: `atom.${operation === "dispose" ? "transfer" : "rinse"}.fraction-${operation}`, equipmentRoleBindings: { "recovery-vessel": source.definitionId }, fractionHandling: { operation, sourceInstanceId: sourceId, fractionId: sourceId, ...(operation === "dispose" ? { targetInstanceId: wasteId } : {}) }, parameters: { sourceDefinitionId: source.definitionId, targetDefinitionId: operation === "dispose" ? "waste-beaker" : source.definitionId, inputMode: "choice", inputRole: "studentResponse", inputKey: `${actionId}-done`, inputRequired: true, inputOptions: ["completed"], inputLabel: "Perform the named cleanup operation through the approved stream" }, interaction: { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: "Complete this separate cleanup operation" }, prerequisites: [], stateChanges: ["Material enters the named waste ledger or the empty watch-glass label is removed."], invalidCases: [], feedback: { success: "Cleanup state updated.", invalid: "Use the named source and approved waste stream." }, evidence: ["cleanup", "M/R/C"] };
  const existing = technique.actions.findIndex((item) => item.id === actionId);
  Object.assign(action.parameters, { sourceInstanceId: sourceId, ...(operation === "dispose" ? { targetInstanceId: wasteId } : {}) });
  if (operation === "dispose") action.equipmentRoleBindings["waste-receiver"] = "waste-beaker";
  if (existing >= 0) { technique.actions[existing] = action; return; }
  const node = technique.process.nodes.find((item) => item.actionId === beforeId);
  for (const edge of technique.process.edges) if (edge.to === node.id) edge.to = `${actionId}-node`;
  technique.actions.splice(technique.actions.findIndex((item) => item.id === beforeId), 0, action);
  technique.process.nodes.push(makeNode(action));
  technique.process.edges.push({ from: `${actionId}-node`, to: node.id, condition: { type: "validationPassed" }, label: "Continue cleanup" });
};
for (const [techniqueId, labId, beforeId, sources] of [
  ["two-stage-precipitate-drying", "hard-water-analysis", "complete-practice-cleanup", ["practice-watch-glass", "practice-dry-paper", "practice-gravity-receiver"]],
  ["hard-water-two-sample-inquiry", "hard-water-analysis", "complete-unknown-cleanup", ["unknown-c-watch", "unknown-c-paper", "unknown-c-flask", "unknown-c-gravity-receiver", "unknown-d-watch", "unknown-d-paper", "unknown-d-flask", "unknown-d-gravity-receiver"]],
  ["quick-ache-extraction-recovery", "quick-ache-relief-separation", "qar-record-dry-component-masses", ["qar-acidic-recovery-watch-glass", "qar-organic-recovery-watch-glass", "qar-aqueous-recovery-watch-glass", "qar-organic-fraction-flask"]],
]) {
  const technique = techniques.get(techniqueId); const lab = labs.get(labId);
  if (techniqueId === "two-stage-precipitate-drying" && !technique.initialState.equipment.some((item) => item.id === "practice-gravity-receiver")) {
    const receiver = lab.initialState.equipment.find((item) => item.id === "practice-gravity-receiver");
    if (!receiver) throw new Error("Practice gravity receiver missing from lab continuity");
    technique.initialState.equipment.push(clone(receiver));
  }
  const cleanupIds = new Set(technique.actions.filter((action) => /-dispose-contents$|-remove-marker$/.test(action.id)).map((action) => action.id));
  const cleanupNodes = new Set(technique.process.nodes.filter((node) => cleanupIds.has(node.actionId)).map((node) => node.id));
  const priorEntry = technique.process.edges.find((edge) => cleanupNodes.has(edge.to) && !cleanupNodes.has(edge.from));
  technique.actions = technique.actions.filter((action) => !cleanupIds.has(action.id));
  technique.process.nodes = technique.process.nodes.filter((node) => !cleanupNodes.has(node.id));
  technique.process.edges = technique.process.edges.filter((edge) => !cleanupNodes.has(edge.from) && !cleanupNodes.has(edge.to));
  if (priorEntry) technique.process.edges.push({ ...priorEntry, to: technique.process.nodes.find((node) => node.actionId === beforeId).id });
  const wasteId = `${techniqueId}-cleanup-waste`;
  for (const owner of [technique, lab]) if (!owner.initialState.equipment.some((item) => item.id === wasteId)) owner.initialState.equipment.push({ id: wasteId, definitionId: "waste-beaker", label: "Teacher-designated cleanup waste", location: "workbench", contents: { kind: "empty", label: "Empty designated waste", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } });
  for (const owner of [technique, lab]) if (!owner.initialState.equipment.some((item) => item.id === `${wasteId}-solid`)) owner.initialState.equipment.push({ id: `${wasteId}-solid`, definitionId: "waste-beaker", label: "Teacher-designated solid waste", location: "workbench", contents: { kind: "empty", label: "Empty solid waste", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } });
  for (const source of sources) {
    const destination = ["watch-glass", "filter-paper"].includes(technique.initialState.equipment.find((item) => item.id === source).definitionId) || source === "qar-organic-fraction-flask" ? `${wasteId}-solid` : wasteId;
    insertCleanupBefore(technique, beforeId, source, destination, "dispose", `cleanup-${source}-dispose-contents`);
    if (technique.initialState.equipment.find((item) => item.id === source).definitionId === "watch-glass" && labId === "hard-water-analysis") insertCleanupBefore(technique, beforeId, source, wasteId, "remove-label", `cleanup-${source}-remove-marker`);
  }
  if (techniqueId === "two-stage-precipitate-drying") insertCleanupBefore(technique, beforeId, "practice-dry-flask", wasteId, "dispose", "dispose-practice-filtrate");
}

prepareQuickChoices(techniques.get("quick-ache-extraction-recovery"), labs.get("quick-ache-relief-separation"));
preparePaperChoices(techniques.get("paper-chromatography"), labs.get("paper-chromatography"));

for (const technique of techniques.values()) {
  technique.requiredEquipment = [...new Set([...technique.requiredEquipment, ...technique.initialState.equipment.map((item) => item.definitionId)])];
  for (const action of technique.actions) {
    if (action.verb === "rinse") delete action.volume;
    delete action.parameters.dryMassG;
    if (technique.id.startsWith("quick-ache-") && ["transfer", "measureVolume", "rinse"].includes(action.verb) && typeof action.parameters.volumeMl === "number") {
      delete action.parameters.volumeMl;
      if (action.verb !== "rinse") action.volume = { source: "action-input" };
      else delete action.volume;
      Object.assign(action.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputKey: `${action.id}-approved-volume`, inputLabel: "Approved volume (mL)", inputRequired: true, inputMin: 0, inputMinExclusive: true, unit: "mL" });
      action.interaction.valueParameter = "inputKey";
    }
  }
  for (const action of technique.actions) if (action.analysis?.type === "massDifferenceWithinTolerance") {
    delete action.parameters.calculationId;
    action.interaction.valueParameter = "inputKey";
  }
  for (const action of technique.actions) if (technique.id !== "paper-chromatography" && action.verb === "record" && action.interaction?.type === "recordNotebook" && typeof action.parameters.measurementId === "string") {
    action.parameters.copyExistingMeasurementOnly = true;
    delete action.parameters.studentValueRequired;
    delete action.parameters.value;
  }
  if (technique.id === "paper-chromatography") for (const action of technique.actions) delete action.parameters.copyExistingMeasurementOnly;
  removeExpectedMeasurementLiterals(technique);
  if (["hard-water-gravimetry", "gravimetric-vacuum-filtration", "two-stage-precipitate-drying", "hard-water-two-sample-inquiry"].includes(technique.id)) {
    for (const action of technique.actions) {
      if (action.verb === "rinse" && !action.fractionHandling) {
        delete action.parameters.volumeMl;
        Object.assign(action.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputKey: `${action.id}-rinse-volume`, inputLabel: "Approved rinse portion (mL)", inputRequired: true, inputMin: 0, inputMinExclusive: true });
        action.interaction.valueParameter = "inputKey";
      }
      if (action.verb === "dry") {
        action.parameters.temperatureC = configured("ovenTemperatureC");
        action.parameters.durationMinutes = /first/.test(action.id) ? configured("firstDurationMinutes") : 5;
        Object.assign(action.parameters, { inputMode: "numeric", inputRole: "studentResponse", inputKey: `${action.id}-elapsed-minutes`, inputLabel: "Observed elapsed drying time (minutes)", inputRequired: true, inputMin: 0, inputMinExclusive: true, requireElapsedDryingTime: true });
        action.parameters.instruction = "Carry out this separate drying stage at the configured oven temperature; record actual elapsed minutes before removing the same assembly.";
        action.interaction.valueParameter = "inputKey";
      }
      if (action.verb === "cool") action.parameters.cooledTemperatureC = configured("coolingTemperatureC");
      if (action.verb === "weigh" && action.parameters.requiresDryPrecipitate) action.parameters.maxSafeTemperatureC = configured("coolingTemperatureC");
    }
  }
  for (const action of technique.actions.filter((candidate) => candidate.id.endsWith("-weigh-accepted-combined"))) {
    const prefix = action.id.replace("-weigh-accepted-combined", "");
    action.mass.confirmLatestMeasurementIds = [`${prefix}-repeat-cooled-mass`, ...Array.from({ length: 7 }, (_, index) => `${prefix}-cycle-${index + 2}-cooled-mass`)];
    action.mass.toleranceMeasurementId = `${prefix}-constant-mass-tolerance`;
    action.mass.noRepeatCalculationId = `${prefix}-constant-mass-required`;
  }
  // Keep declared evidence producers before the converged accepted-mass consumer.
  for (const accepted of technique.actions.filter((action) => action.id.endsWith("-weigh-accepted-combined"))) {
    const prefix = accepted.id.replace("-weigh-accepted-combined", "");
    const cycles = technique.actions.filter((action) => action.id.startsWith(`${prefix}-cycle-`));
    technique.actions = technique.actions.filter((action) => !cycles.includes(action));
    technique.actions.splice(technique.actions.indexOf(accepted), 0, ...cycles);
  }
  uniquifyValidationIds(technique);
  technique.metadata.version = ["hard-water-gravimetry", "bonding-solids-tests", "tablet-separation", "paper-chromatography"].includes(technique.id)
    ? "1.1.0"
    : "1.2.0";
  technique.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  technique.composition = compositionFor(technique, technique.id === "hard-water-gravimetry" || technique.id === "tablet-separation" ? "composable" : "composable");
  if (["two-stage-precipitate-drying", "hard-water-two-sample-inquiry"].includes(technique.id)) technique.composition.configurationSlots = ["ovenTemperatureC", "firstDurationMinutes", "coolingTemperatureC"].map((id) => ({ id, required: true, valueType: "number" }));
  if (technique.id === "quick-ache-extraction-recovery") technique.composition.configurationSlots = ["organicRecoveryMethod", "aqueousRecoveryMethod", "drynessCriterion", "coolingLimitC", "acidEndpointPh", "organicDensity", "aqueousDensity", "recoverySetupApproved"].map((id) => ({ id, required: true, valueType: ["coolingLimitC", "acidEndpointPh", "organicDensity", "aqueousDensity"].includes(id) ? "number" : id === "recoverySetupApproved" ? "boolean" : "string" }));
}

declareBondingProcedure(techniques.get("bonding-solids-tests"));
declarePaperProcedure(techniques.get("paper-chromatography"));
declareQuickProcedure(techniques.get("quick-ache-extraction-recovery"));

const referencedInstanceIds = (technique) => {
  const result = new Set();
  const visit = (value, key = "") => {
    if (Array.isArray(value)) return value.forEach((item) => visit(item, key));
    if (value && typeof value === "object") return Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    if (typeof value === "string" && /InstanceId$/.test(key)) result.add(value);
  };
  technique.actions.forEach((action) => visit(action));
  return result;
};

const implicitRoleInstances = {
  "hard-water-practice-preparation": {
    "solid-transfer-tool": ["practice-scoopula"],
    "stirring-device": ["practice-stirring-rod"],
  },
  "hard-water-two-sample-inquiry": {
    "stirring-device": ["practice-stirring-rod"],
  },
  "bonding-solids-tests": {
    "solid-transfer-tool": ["spatula-1"],
  },
  "quick-ache-extraction-recovery": {
    "solid-transfer-tool": ["qar-spatula"],
    "stirring-device": ["qar-stirring-rod"],
  },
};

const wireBindings = (lab, technique, instance) => {
  const labItems = new Map(lab.initialState.equipment.map((item) => [item.id, item]));
  const refs = referencedInstanceIds(technique);
  for (const id of refs) if (!technique.initialState.equipment.some((item) => item.id === id) && labItems.has(id)) technique.initialState.equipment.push(clone(labItems.get(id)));
  const sourceItems = new Map(technique.initialState.equipment.map((item) => [item.id, item]));
  const preference = (roleId) => /source/.test(roleId) ? ["sourceInstanceId", "equipmentInstanceId", "targetInstanceId"]
    : /receiver|vessel|medium|assembly/.test(roleId) ? ["receiverInstanceId", "targetInstanceId", "sourceInstanceId", "equipmentInstanceId"]
      : ["sourceInstanceId", "targetInstanceId", "equipmentInstanceId", "instrumentInstanceId"];
  instance.bindings.equipment = {};
  instance.bindings.models = Object.fromEntries(technique.composition.modelSlots.map((slot) => [slot.id, slot.sourceModelId]));
  for (const role of technique.composition.equipmentRoles) {
    const ids = new Set();
    for (const action of technique.actions) {
      const definitionId = action.equipmentRoleBindings?.[role.roleId];
      if (!definitionId) continue;
      for (const key of preference(role.roleId)) {
        const id = action.parameters?.[key];
        if (typeof id === "string" && sourceItems.get(id)?.definitionId === definitionId) { ids.add(id); break; }
      }
    }
    for (const id of implicitRoleInstances[technique.id]?.[role.roleId] ?? []) {
      const item = labItems.get(id);
      if (!item) throw new Error(`${lab.id} lacks implicit identity binding for ${technique.id}/${role.roleId}/${id}.`);
      if (!sourceItems.has(id)) {
        const source = clone(item);
        technique.initialState.equipment.push(source);
        technique.requiredEquipment = [...new Set([...technique.requiredEquipment, source.definitionId])];
        sourceItems.set(id, source);
      }
      ids.add(id);
    }
    role.sourceInstanceIds = [...ids];
    const mappings = [...ids].map((sourceInstanceId) => {
      const source = sourceItems.get(sourceInstanceId);
      const continuityId = technique.id === "two-stage-precipitate-drying" ? ({ "practice-dry-paper": "practice-filter-paper", "practice-dry-flask": "practice-filter-flask" }[sourceInstanceId] ?? sourceInstanceId) : sourceInstanceId;
      const target = labItems.get(continuityId);
      if (!target || target.definitionId !== source.definitionId) throw new Error(`${lab.id} lacks identity binding for ${technique.id}/${sourceInstanceId}.`);
      return { sourceInstanceId, definitionId: target.definitionId, instanceId: target.id };
    });
    if (mappings.length === 1) instance.bindings.equipment[role.roleId] = { definitionId: mappings[0].definitionId, instanceId: mappings[0].instanceId };
    if (mappings.length > 1) instance.bindings.equipment[role.roleId] = { sourceInstances: mappings };
  }
};

const preserveMap = (technique, labNodeBySource) => ({
  actions: Object.fromEntries(technique.actions.map((action) => [action.id, action.id])),
  nodes: Object.fromEntries(technique.process.nodes.map((node) => [node.id, labNodeBySource.get(node.id) ?? node.id])),
  validationRules: {},
  references: {},
});

const migrateLab = (lab, assignments) => {
  if (lab.techniqueInstances) return;
  const originalNodes = clone(lab.process.nodes);
  const originalEdges = clone(lab.process.edges);
  const ownerByNode = new Map();
  const sourceNodeByLabNode = new Map();
  const labNodeByTechnique = new Map();
  for (const assignment of assignments) {
    const technique = techniques.get(assignment.techniqueId);
    const sourceMap = new Map();
    for (const node of technique.process.nodes) {
      const labNodeId = assignment.labNodeId?.(node) ?? node.id;
      if (originalNodes.some((candidate) => candidate.id === labNodeId)) {
        ownerByNode.set(labNodeId, assignment.instanceId);
        sourceNodeByLabNode.set(labNodeId, node.id);
        sourceMap.set(node.id, labNodeId);
      }
    }
    labNodeByTechnique.set(assignment.instanceId, sourceMap);
  }
  const ownedNodeIds = new Set(ownerByNode.keys());
  const ownedActionIds = new Set(originalNodes.filter((node) => ownedNodeIds.has(node.id)).map((node) => node.actionId));
  lab.actions = lab.actions.filter((action) => !ownedActionIds.has(action.id));
  lab.process.nodes = originalNodes.filter((node) => !ownedNodeIds.has(node.id));
  lab.process.edges = originalEdges.filter((edge) => !ownedNodeIds.has(edge.from) && !ownedNodeIds.has(edge.to));
  delete lab.techniqueRefs;
  lab.techniqueInstances = assignments.map((assignment) => {
    const technique = techniques.get(assignment.techniqueId);
    const instance = {
      instanceId: assignment.instanceId, techniqueId: technique.id, version: technique.metadata.version,
      bindings: { equipment: {}, models: {}, configuration: {} },
      preserveIds: preserveMap(technique, labNodeByTechnique.get(assignment.instanceId)),
    };
    wireBindings(lab, technique, instance);
    return instance;
  });
  const endpoint = (nodeId, direction) => {
    const owner = ownerByNode.get(nodeId);
    if (!owner) return { kind: "lab-node", nodeId };
    const technique = techniques.get(assignments.find((item) => item.instanceId === owner).techniqueId);
    const sourceNodeId = sourceNodeByLabNode.get(nodeId);
    const kind = direction === "from" ? "exit" : "entry";
    return { kind: "technique-port", instanceId: owner, portId: addBoundaryPort(technique, kind, sourceNodeId) };
  };
  lab.compositionStart = endpoint(lab.process.startNodeId, "to");
  const connections = [];
  for (const [index, edge] of originalEdges.entries()) {
    const fromOwner = ownerByNode.get(edge.from) ?? "lab";
    const toOwner = ownerByNode.get(edge.to) ?? "lab";
    if (fromOwner === toOwner) continue;
    connections.push({ id: `${lab.id}-cross-${index + 1}`, from: endpoint(edge.from, "from"), to: endpoint(edge.to, "to"), label: edge.label, condition: edge.condition });
  }
  lab.compositionConnections = connections;
  lab.reachabilityWitnesses = [{ id: "default", configuration: {}, approvalGates: {} }];
  lab.compositionEdgeOrder = [];
  for (const edge of originalEdges) {
    const fromOwner = ownerByNode.get(edge.from) ?? "lab";
    const toOwner = ownerByNode.get(edge.to) ?? "lab";
    if (fromOwner !== toOwner) {
      const connection = connections.find((item) => JSON.stringify(item.from) === JSON.stringify(endpoint(edge.from, "from")) && JSON.stringify(item.to) === JSON.stringify(endpoint(edge.to, "to")));
      lab.compositionEdgeOrder.push({ kind: "connection", connectionId: connection.id });
    } else if (fromOwner === "lab") {
      lab.compositionEdgeOrder.push({ kind: "lab-edge", edgeIndex: lab.process.edges.findIndex((item) => item.from === edge.from && item.to === edge.to) });
    } else {
      const technique = techniques.get(assignments.find((item) => item.instanceId === fromOwner).techniqueId);
      const sourceFrom = sourceNodeByLabNode.get(edge.from);
      const sourceTo = sourceNodeByLabNode.get(edge.to);
      lab.compositionEdgeOrder.push({ kind: "technique-edge", instanceId: fromOwner, edgeIndex: technique.process.edges.findIndex((item) => item.from === sourceFrom && item.to === sourceTo) });
    }
  }
  lab.metadata.version = "1.2.0";
  lab.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
};

const rebuildBondingLab = (lab, technique) => {
  for (const role of technique.composition.equipmentRoles) {
    role.sourceInstanceIds = technique.initialState.equipment
      .filter((item) => role.allowedDefinitionIds.includes(item.definitionId))
      .map((item) => item.id);
  }
  const originalActions = new Map(lab.actions.map((action) => [action.id, action]));
  const originalNodes = new Map(lab.process.nodes.map((node) => [node.id, node]));
  const beforeIds = ["inv6-review-safety", "inv6-confirm-known-count", "inv6-confirm-unknown-count", "inv6-select-test-panel", "inv6-confirm-test-count", "inv6-author-protocol", "inv6-teacher-approval"];
  const bridgeIds = ["inv6-derive-known-criteria", "inv6-build-classification-flowchart", "inv6-validate-classifier-knowns"];
  const afterIds = ["inv6-classify-unknowns", "inv6-evaluate-reliability", "inv6-release-identities", "inv6-match-identities", "inv6-instructor-check", "inv6-postlab-reasoning"];
  const bridgeLabels = {
    "inv6-derive-known-criteria": "Derive classification criteria from the known-sample matrix",
    "inv6-build-classification-flowchart": "Build the evidence-based classification flowchart",
    "inv6-validate-classifier-knowns": "Validate the classifier against the known matrix and hypothetical blue crystalline solid",
  };
  const bridgeActions = bridgeIds.map((id) => ({ id, verb: "record", label: bridgeLabels[id],
    parameters: { inputMode: "text", inputRole: "studentResponse", inputKey: `${id}-entry`, inputLabel: bridgeLabels[id], inputRequired: true, evidenceProvenance: "student analysis of the completed configured known-sample matrix" },
    interaction: { type: "recordNotebook", valueParameter: "inputKey", accessibleLabel: bridgeLabels[id] }, prerequisites: [],
    stateChanges: ["The classifier design record is updated without changing sample identity or apparatus state."], invalidCases: [],
    feedback: { success: `${bridgeLabels[id]} complete.`, invalid: "Use only recorded known-sample evidence and state uncertainty." }, evidence: ["analysis", "known-matrix", id] }));
  lab.actions = [...beforeIds.map((id) => originalActions.get(id)), ...bridgeActions, ...afterIds.map((id) => originalActions.get(id))];
  // The configured final blind instance reaches this node through a completion port.
  // Its old single-panel action id no longer exists in the repeated composition.
  lab.actions.find((action) => action.id === "inv6-classify-unknowns").prerequisites = [];
  for (const assessment of lab.assessments ?? []) {
    if (assessment.actionId === "inv6-validate-blue-solid") assessment.actionId = "inv6-validate-classifier-knowns";
  }
  lab.process.nodes = [
    ...beforeIds.map((id) => originalNodes.get(`lab-${id}-node`)),
    ...bridgeActions.map((action) => ({ ...makeNode(action), id: `lab-${action.id}-node`, config: { preservesBlindIdentity: true } })),
    ...afterIds.map((id) => originalNodes.get(`lab-${id}-node`)),
  ];
  const localChains = [beforeIds, bridgeIds, afterIds];
  lab.process.edges = localChains.flatMap((ids) => ids.slice(1).map((id, index) => ({ from: `lab-${ids[index]}-node`, to: `lab-${id}-node`, label: "Continue after evidence is recorded", condition: { type: "validationPassed" } })));
  lab.process.startNodeId = "lab-inv6-review-safety-node";
  delete lab.techniqueRefs;
  const wasteTargets = {
    "water-waste": "bonding-water-waste", "ethanol-waste": "bonding-ethanol-waste", "hexanes-waste": "bonding-hexanes-waste",
    "hcl-waste": "bonding-hcl-waste", "naoh-waste": "bonding-naoh-waste", "dry-waste": "bonding-dry-waste",
  };
  const labItem = (id) => lab.initialState.equipment.find((item) => item.id === id);
  const wasteSources = { "water-waste": "waste-beaker-aqueous", "ethanol-waste": "waste-beaker-organic", "hexanes-waste": "waste-beaker-organic", "hcl-waste": "waste-beaker-aqueous", "naoh-waste": "waste-beaker-aqueous", "dry-waste": "waste-beaker-aqueous" };
  for (const [sourceId, targetId] of Object.entries(wasteTargets)) if (!labItem(targetId) || labItem(targetId).definitionId !== labItem(wasteSources[sourceId]).definitionId) {
    lab.initialState.equipment = lab.initialState.equipment.filter((item) => item.id !== targetId);
    const base = labItem(wasteSources[sourceId]);
    lab.initialState.equipment.push({ ...clone(base), id: targetId, label: `${sourceId.replaceAll("-", " ")} receiver` });
  }
  const genericTargets = {
    "water-test-line": "test-tube-1", "ethanol-test-line": "test-tube-2", "hexanes-test-line": "test-tube-3", "dry-test-line": "test-tube-4", "hcl-test-line": "test-tube-5", "naoh-test-line": "test-tube-6",
    "water-source": "distilled-water-bottle-1", "ethanol-source": "reagent-bottle-ethanol", "hexanes-source": "reagent-bottle-hexanes", "hcl-source": "reagent-bottle-hcl", "naoh-source": "naoh-bottle-1",
    "transfer-tool": "spatula-1", "conductivity-instrument": "conductivity-tester-1", "ph-medium": "ph-paper-1", "magnetic-tool": "magnet-1", "melting-instrument": "melting-point-apparatus-1",
    ...wasteTargets,
  };
  const configuration = (sampleIdentity, sampleMode, count) => ({
    sampleIdentity, sampleMode, evidenceScopeId: `${sampleMode}-${sampleIdentity.toLowerCase()}-bonding-panel`, selectedTestPanel: `approved-panel:${count}-samples`,
    microsampleAmount: "teacher-approved microscale portion", waterAmount: "teacher-approved water amount", ethanolAmount: "teacher-approved ethanol amount", hexanesAmount: "teacher-approved hexanes amount",
    hclAmount: "teacher-approved hydrochloric-acid amount", naohAmount: "teacher-approved sodium-hydroxide amount", conductivityThresholds: "teacher-approved conductivity thresholds",
    phThresholds: "teacher-approved pH thresholds", meltingApparatusLimits: "teacher-approved melting apparatus limits", hoodControl: "teacher-approved hood control",
    waterWasteDestination: "teacher-labeled water-test waste", ethanolWasteDestination: "teacher-labeled ethanol waste", hexanesWasteDestination: "teacher-labeled hexanes waste",
    hclWasteDestination: "teacher-labeled acid waste", naohWasteDestination: "teacher-labeled base waste", dryWasteDestination: "teacher-labeled dry test waste",
  });
  const bindEquipment = (sampleTarget) => Object.fromEntries(technique.composition.equipmentRoles.map((role) => {
    const rows = role.sourceInstanceIds.map((sourceInstanceId) => {
      let targetId = sourceInstanceId === "sample-vial" ? sampleTarget : genericTargets[sourceInstanceId];
      if (sourceInstanceId.endsWith("-test-line")) {
        const isolatedId = `${sampleTarget}-${sourceInstanceId}`;
        if (!labItem(isolatedId)) {
          const original = labItem(targetId);
          if (!original) throw new Error(`Missing test-vessel template ${targetId}.`);
          lab.initialState.equipment.push({ ...clone(original), id: isolatedId, label: `${sampleTarget} ${sourceInstanceId}`, contents: { kind: "empty", label: "Empty fresh test vessel", solutes: [] } });
        }
        targetId = isolatedId;
      }
      const target = labItem(targetId);
      if (!target) throw new Error(`Bonding binding target ${targetId} is missing for ${sourceInstanceId}.`);
      return { sourceInstanceId, definitionId: target.definitionId, instanceId: target.id };
    });
    return [role.roleId, rows.length === 1 ? { definitionId: rows[0].definitionId, instanceId: rows[0].instanceId } : { sourceInstances: rows }];
  }));
  const specs = [
    ["known-1", "K1", "known", 1], ["known-2", "K2", "known", 2], ["known-3", "K3", "known", 3], ["known-4", "K4", "known", 4],
    ["known-5-count5", "K5", "known", 5], ["known-5-count6", "K5", "known", 5], ["known-6", "K6", "known", 6],
    ["blind-1", "U1", "blind", 1], ["blind-2", "U2", "blind", 2], ["blind-3", "U3", "blind", 3], ["blind-4", "U4", "blind", 4],
    ["blind-5-count5", "U5", "blind", 5], ["blind-5-count6", "U5", "blind", 5], ["blind-6", "U6", "blind", 6],
  ];
  const countForInstance = (instanceId) => instanceId.includes("count5") ? 5 : instanceId.includes("count6") || /-6$/.test(instanceId) ? 6 : 4;
  lab.techniqueInstances = specs.map(([instanceId, sampleIdentity, sampleMode, number]) => ({
    instanceId, techniqueId: technique.id, version: technique.metadata.version,
    ...(instanceId.includes("count5") ? { enabledWhen: { kind: "configuration", instanceId: `${sampleMode}-1`, slotId: "selectedTestPanel", equals: "approved-panel:5-samples" } } : {}),
    ...(instanceId.includes("count6") || /-6$/.test(instanceId) ? { enabledWhen: { kind: "configuration", instanceId: `${sampleMode}-1`, slotId: "selectedTestPanel", equals: "approved-panel:6-samples" } } : {}),
    bindings: { equipment: bindEquipment(`small-vial-${sampleMode === "known" ? "known-k" : "unknown-u"}${number}`), models: {}, configuration: configuration(sampleIdentity, sampleMode, countForInstance(instanceId)) },
  }));
  const entry = "entry-label-test-locations-node";
  const exit = "exit-complete-sample-matrix-node";
  const endpoint = (instanceId, kind) => ({ kind: "technique-port", instanceId, portId: kind === "entry" ? entry : exit });
  const predicate = (count, mode) => ({ kind: "configuration", instanceId: `${mode}-1`, slotId: "selectedTestPanel", equals: `approved-panel:${count}-samples` });
  const connections = [];
  const connect = (id, from, to, count) => connections.push({ id, from, to, label: "Continue after configured sample evidence is complete", condition: { type: "validationPassed" }, ...(count ? { enabledWhen: predicate(count, id.startsWith("bonding-blind-") ? "blind" : "known") } : {}) });
  connect("bonding-approval-to-known-1", { kind: "lab-node", nodeId: "lab-inv6-teacher-approval-node" }, endpoint("known-1", "entry"));
  for (let i = 1; i < 4; i++) connect(`bonding-known-${i}-to-${i + 1}`, endpoint(`known-${i}`, "exit"), endpoint(`known-${i + 1}`, "entry"));
  connect("bonding-known-4-to-bridge-count4", endpoint("known-4", "exit"), { kind: "lab-node", nodeId: "lab-inv6-derive-known-criteria-node" }, 4);
  connect("bonding-known-4-to-5-count5", endpoint("known-4", "exit"), endpoint("known-5-count5", "entry"), 5);
  connect("bonding-known-5-count5-to-bridge", endpoint("known-5-count5", "exit"), { kind: "lab-node", nodeId: "lab-inv6-derive-known-criteria-node" }, 5);
  connect("bonding-known-4-to-5-count6", endpoint("known-4", "exit"), endpoint("known-5-count6", "entry"), 6);
  connect("bonding-known-5-count6-to-6", endpoint("known-5-count6", "exit"), endpoint("known-6", "entry"), 6);
  connect("bonding-known-6-to-bridge", endpoint("known-6", "exit"), { kind: "lab-node", nodeId: "lab-inv6-derive-known-criteria-node" }, 6);
  connect("bonding-bridge-to-blind-1", { kind: "lab-node", nodeId: "lab-inv6-validate-classifier-knowns-node" }, endpoint("blind-1", "entry"));
  for (let i = 1; i < 4; i++) connect(`bonding-blind-${i}-to-${i + 1}`, endpoint(`blind-${i}`, "exit"), endpoint(`blind-${i + 1}`, "entry"));
  connect("bonding-blind-4-to-analysis-count4", endpoint("blind-4", "exit"), { kind: "lab-node", nodeId: "lab-inv6-classify-unknowns-node" }, 4);
  connect("bonding-blind-4-to-5-count5", endpoint("blind-4", "exit"), endpoint("blind-5-count5", "entry"), 5);
  connect("bonding-blind-5-count5-to-analysis", endpoint("blind-5-count5", "exit"), { kind: "lab-node", nodeId: "lab-inv6-classify-unknowns-node" }, 5);
  connect("bonding-blind-4-to-5-count6", endpoint("blind-4", "exit"), endpoint("blind-5-count6", "entry"), 6);
  connect("bonding-blind-5-count6-to-6", endpoint("blind-5-count6", "exit"), endpoint("blind-6", "entry"), 6);
  connect("bonding-blind-6-to-analysis", endpoint("blind-6", "exit"), { kind: "lab-node", nodeId: "lab-inv6-classify-unknowns-node" }, 6);
  lab.compositionStart = { kind: "lab-node", nodeId: lab.process.startNodeId };
  lab.compositionConnections = connections;
  lab.reachabilityWitnesses = [4, 5, 6].flatMap((knownCount) => [4, 5, 6].map((blindCount) => ({ id: `${knownCount}-known-and-${blindCount}-blind`, configuration: Object.fromEntries(specs.map(([instanceId, , mode]) => [`${instanceId}.selectedTestPanel`, `approved-panel:${mode === "known" ? knownCount : blindCount}-samples`])), approvalGates: {} })));
  // Optional instances are selected by configuration; the compiler orders active edges.
  delete lab.compositionEdgeOrder;
  lab.metadata.version = "1.3.0";
  lab.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
};

migrateLab(labs.get("hard-water-analysis"), [
  "hard-water-practice-preparation", "gravimetric-vacuum-filtration", "two-stage-precipitate-drying", "inquiry-plan-approval", "hard-water-two-sample-inquiry",
].map((techniqueId) => ({ instanceId: techniqueId, techniqueId, labNodeId: (node) => `${techniqueId}--${node.id}` })));
migrateLab(labs.get("paper-chromatography"), [{ instanceId: "chromatography-trials", techniqueId: "paper-chromatography" }]);
rebuildBondingLab(labs.get("bonding-unknown-solids"), techniques.get("bonding-solids-tests"));

for (const lab of labs.values()) {
  for (const action of lab.actions) action.effect = effectFor(action);
  for (const instance of lab.techniqueInstances ?? []) {
    if (techniques.has(instance.techniqueId)) instance.version = techniques.get(instance.techniqueId).metadata.version;
  }
}

const paperLab = labs.get("paper-chromatography");
const paperTechnique = techniques.get("paper-chromatography");
for (const instance of paperLab.techniqueInstances) {
  instance.preserveIds = preserveMap(paperTechnique, new Map());
  wireBindings(paperLab, paperTechnique, instance);
  for (const slot of paperTechnique.composition.modelSlots) instance.bindings.models[slot.id] = slot.sourceModelId;
}
const quickAche = labs.get("quick-ache-relief-separation");
for (const instance of quickAche.techniqueInstances) {
  const technique = techniques.get(instance.techniqueId);
  instance.version = technique.metadata.version;
  instance.preserveIds = preserveMap(technique, new Map());
  wireBindings(quickAche, technique, instance);
}
const quickAchePorts = new Map(quickAche.techniqueInstances.map((instance) => {
  const technique = techniques.get(instance.techniqueId);
  return [instance.instanceId, {
    entry: technique.composition.ports.find((port) => port.kind === "entry")?.id,
    exit: technique.composition.ports.find((port) => port.kind === "exit")?.id,
  }];
}));
if (quickAche.compositionStart?.kind === "technique-port") {
  quickAche.compositionStart.portId = quickAchePorts.get(quickAche.compositionStart.instanceId)?.entry;
}
for (const connection of quickAche.compositionConnections) {
  if (connection.from.kind === "technique-port") connection.from.portId = quickAchePorts.get(connection.from.instanceId)?.exit;
  if (connection.to.kind === "technique-port") connection.to.portId = quickAchePorts.get(connection.to.instanceId)?.entry;
}
quickAche.compositionEdgeOrder = [];
for (const [index, instance] of quickAche.techniqueInstances.entries()) {
  const technique = techniques.get(instance.techniqueId);
  technique.process.edges.forEach((_, edgeIndex) => quickAche.compositionEdgeOrder.push({ kind: "technique-edge", instanceId: instance.instanceId, edgeIndex }));
  const connection = quickAche.compositionConnections[index];
  if (connection) quickAche.compositionEdgeOrder.push({ kind: "connection", connectionId: connection.id });
}
quickAche.metadata.version = "1.2.0";
quickAche.metadata.updatedAt = "2026-09-04T00:00:00.000Z";

// Recompute concrete bindings after every replay because compositionFor rebuilds
// the role declarations even when the lab source is already migrated.
for (const lab of labs.values()) {
  delete lab.compositionEdgeOrder;
  lab.equipment = [...new Set([...lab.equipment, ...lab.initialState.equipment.map((item) => item.definitionId)])];
  for (const instance of lab.techniqueInstances ?? []) {
    const technique = techniques.get(instance.techniqueId);
    if (technique && technique.id !== "bonding-solids-tests") wireBindings(lab, technique, instance);
  }
}

for (const technique of techniques.values()) await writeJson(`public/techniques/${technique.id}.json`, technique);
for (const lab of labs.values()) await writeJson(`public/labs/${lab.id}.json`, lab);

const emitInput = async (path, ids, functionName, comment) => {
  const values = ids.map((id) => [id, techniques.get(id)]);
  await writeFile(path, `${comment}\nconst definitions = new Map(${JSON.stringify(values, null, 2)});\n\nexport const ${functionName} = (definition) => structuredClone(definitions.get(definition.id) ?? definition);\n`);
};
await emitInput("scripts/generatorInputs/apChem/gravimetrySeparation.mjs", ["hard-water-gravimetry", "bonding-solids-tests", "tablet-separation"], "refineGravimetrySeparationDefinition", "/** Cycle 06-owned gravimetry/separation definitions from the revision-8 checkpoint plus accepted coordinator amendments 04-06 and 10. Keep this module data-only. */");
await emitInput("scripts/generatorInputs/simulator/paperChromatography.mjs", ["paper-chromatography"], "refinePaperChromatographyDefinition", "/** Cycle 06-owned paper-chromatography definition from the revision-8 checkpoint plus accepted coordinator amendments 04-06 and 10. Keep this module data-only. */");

const sourceFor = (owner, actionId) => {
  if (/hard-water/.test(owner) || /practice|gravimetric|precipitate-drying|inquiry-plan/.test(owner)) {
    const step = /unknown-[cd]-/.test(actionId) ? "INQ-06 to INQ-08"
      : /sample|carbonate|dissolv|portion|precipitate-state|age-practice/.test(actionId) ? "PR-02 to PR-15"
        : /filter|buchner|paper|wash|rinse/.test(actionId) ? "FD-01 to FD-12"
          : /dry|cool|watch|break|combined|theoretical|yield/.test(actionId) ? "FD-09 to FD-21"
            : "INQ-01 to INQ-12";
    return { sourceFile: "what-makes-hard-water-hard_2026-07-27.md", sourceTable: "Section 8 procedure phases", step, basis: "M/R/C" };
  }
  if (/paper-chromatography/.test(owner) || /water|propanol|chromat|solvent|band|rf|imf/.test(actionId)) {
    const step = /review|hypothesis|select-solvents|configure|data-table|approval/.test(actionId) ? "HP-01 to HP-09"
      : /compare|evaluate|explain|model|cer|postlab|interpretation/.test(actionId) ? "CP-02 to CP-08"
        : "TR-01 to TR-19";
    return { sourceFile: "sticky-question-paper-chromatography_2026-07-27.md", sourceTable: "Section 8 procedure phases", step, basis: "M/R/C" };
  }
  if (/bonding/.test(owner) || /^inv6-/.test(actionId)) {
    const step = /review|confirm|select|protocol|approval/.test(actionId) ? "D-01 to D-04"
      : /classify|reliability|release|match|instructor|postlab|derive|flowchart|validate/.test(actionId) ? "F-01 to U-05"
        : /unknown/.test(actionId) ? "U-01" : "K-01 to K-07";
    return { sourceFile: "bonding-in-unknown-solids_2026-07-27.md", sourceTable: "Section 8 procedure phases", step, basis: "M/R/C" };
  }
  const step = /property|pure|sucrose|acetaminophen|aspirin|consumer/.test(actionId) ? "P-01 to P-05"
    : /draft|approval|safety/.test(actionId) ? "D-01 to D-02"
      : /calculate|evaluate|analy|report|particulate|formula/.test(actionId) ? "A-01 to A-03"
        : "E-01 to E-13";
  return { sourceFile: "quick-ache-relief-component-separation_2026-07-27.md", sourceTable: "Section 8 procedure phases", step, basis: "M/R/C" };
};

const identity = {
  candidateStatus: "blocked-not-complete",
  sharedAmendments: "coordinator-accepted requests 04-06 and amendment 10; not unchanged frozen revision 8",
  unresolvedRequests: ["07", "08", "09"],
  baselineRevision: baseline.baselineRevision,
  baselineManifestSha256: sha256(await readFile(`${planRoot}/evidence/CYCLE_08_SHARED_CONTRACT_BASELINE_REVISION_8.json`)),
  baselineAggregateSha256: baseline.aggregateSha256,
  impactManifestSha256: sha256(await readFile(`${planRoot}/evidence/CYCLE_06_BONDING_SCALAR_CONFIGURATION_AMENDMENT_IMPACT.json`)),
};
const techniqueRows = [...techniques.values()].flatMap((technique) => technique.actions.map((action) => ({
  rowId: `${technique.id}@${technique.metadata.version}#${action.id}`,
  baselineRowIdentity: atomicityAudit.rows.find((row) => row.techniqueId === technique.id && row.actionId === action.id)?.rowId ?? null,
  techniqueId: technique.id,
  techniqueVersion: technique.metadata.version,
  actionId: action.id,
  atomId: action.atomId ?? null,
  ...sourceFor(`technique:${technique.id}`, action.id),
  disposition: "owned-final-action",
  effectDecision: action.atomId ? atoms.get(action.atomId).effectContract : technique.composition.legacyActionEffects.find((row) => row.actionId === action.id).effect,
  configurationWitness: "exact technique-instance identity plus teacher-approved M/R/C choices; no expected result literal",
  sourceConflictDisposition: "Manual-stated operations govern; missing quantities, endpoints, identities, and outcomes remain configured or evidence-derived.",
  evaluated: true,
})));
const labRows = [];
for (const lab of labs.values()) {
  for (const node of lab.process.nodes) {
    const action = lab.actions.find((candidate) => candidate.id === node.actionId);
    labRows.push({
      rowId: `${lab.id}#${node.id}`,
      baselineRowIdentity: compositionAudit.rows.find((row) => row.labId === lab.id && row.nodeId === node.id)?.rowId ?? null,
      labId: lab.id, nodeId: node.id, actionId: node.actionId, ...sourceFor(`lab:${lab.id}`, node.actionId),
      disposition: "retained-lab-analysis-or-orchestration",
      finalOrigin: { kind: "lab-local", rationale: "inquiry, approval, recording, analysis, assessment, or reflection only" },
      effectDecision: effectFor(action), configurationWitnesses: ["default", "teacher-approved plan"],
      sourceConflictDisposition: "No lab-local action changes apparatus/scientific state or acquires a measurement/direct observation.", evaluated: true,
    });
  }
  for (const instance of lab.techniqueInstances) {
    const technique = techniques.get(instance.techniqueId);
    for (const node of technique.process.nodes) {
      const action = technique.actions.find((candidate) => candidate.id === node.actionId);
      const compiledNodeId = instance.preserveIds?.nodes?.[node.id] ?? `${instance.instanceId}--${node.id}`;
      labRows.push({
        rowId: `${lab.id}#${compiledNodeId}`,
        baselineRowIdentity: compositionAudit.rows.find((row) => row.labId === lab.id && row.nodeId === compiledNodeId)?.rowId ?? null,
        labId: lab.id, nodeId: compiledNodeId, actionId: instance.preserveIds?.actions?.[action.id] ?? action.id,
        ...sourceFor(`technique:${technique.id}`, action.id), disposition: "technique-instance-operation",
        finalOrigin: { kind: "technique-instance", instanceId: instance.instanceId, techniqueId: technique.id, version: technique.metadata.version, atomId: action.atomId ?? null },
        effectDecision: action.atomId ? atoms.get(action.atomId).effectContract : technique.composition.legacyActionEffects.find((row) => row.actionId === action.id).effect,
        configurationWitnesses: ["exact instance/version and concrete sample/trial provenance"],
        sourceConflictDisposition: "Technique owns the operation; configured quantities/endpoints and acquired evidence remain scoped to the named sample or trial.", evaluated: true,
      });
    }
  }
}
const traceRows = [
  ...[...techniques.values()].flatMap((technique) => technique.actions.map((action) => ({
    rowId: `technique:${technique.id}#${action.id}`, owner: `technique:${technique.id}`, actionId: action.id,
    ...sourceFor(`technique:${technique.id}`, action.id), atomId: action.atomId ?? null,
    disposition: "owned-addition-or-replacement", evaluated: true,
  }))),
  ...[...labs.values()].flatMap((lab) => lab.actions.map((action) => ({
    rowId: `lab:${lab.id}#${action.id}`, owner: `lab:${lab.id}`, actionId: action.id,
    ...sourceFor(`lab:${lab.id}`, action.id), atomId: null,
    disposition: "owned-retained-lab-key", evaluated: true,
  }))),
];
await mkdir(`${planRoot}/evidence/lane-06`, { recursive: true });
await writeJson(`${planRoot}/evidence/lane-06/technique-atomicity-overlay.json`, {
  schema: "lab-studio/technique-atomicity-overlay@1", lane: "06", ...identity,
  baselineAuditSha256: sha256(await readFile(`${planRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`)),
  owners: techniqueIds.map((id) => `technique:${id}`), rows: techniqueRows,
});
await writeJson(`${planRoot}/evidence/lane-06/lab-composition-overlay.json`, {
  schema: "lab-studio/lab-composition-overlay@1", lane: "06", ...identity,
  baselineAuditSha256: sha256(await readFile(`${planRoot}/LAB_COMPOSITION_AUDIT.json`)),
  owners: labIds.map((id) => `lab:${id}`), rows: labRows,
});
await writeJson(`${planRoot}/evidence/lane-06/source-trace-overlay.json`, {
  schema: "lab-studio/source-trace-overlay@1", lane: "06", ...identity,
  frozenRegistrySha256: sha256(await readFile("docs/architecture/source-trace-registry.json")),
  frozenTraceCount: sourceRegistry.traces.length,
  owners: [...techniqueIds.map((id) => `technique:${id}`), ...labIds.map((id) => `lab:${id}`)],
  reconciliation: { acceptedSharedRequest: "cycle-06-ap-generator-bonding-atomic-contract-01", obsoleteLabOwnerTraces: [], missingCurrentTraces: [] },
  rows: traceRows,
});

console.log(`Cycle 06 migration wrote ${techniques.size} techniques, ${labs.size} labs, and 3 overlays on baseline ${baseline.baselineRevision}/${baseline.aggregateSha256}.`);
