import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const version = "1.2.0";

const configuration = (id, valueType = "number", required = true, allowedValues) => ({
  id,
  valueType,
  required,
  ...(allowedValues ? { allowedValues } : {}),
});

const evidenceOutput = (id, kind, actionId, referenceId) => ({
  id,
  kind,
  actionId,
  ...(referenceId ? { referenceId } : {}),
});

const role = (roleId, allowedDefinitionIds, sourceInstanceIds) => ({
  roleId,
  required: true,
  allowedDefinitionIds,
  sourceInstanceIds,
});

const legacyEffect = (actionId, classes, domains) => ({
  actionId,
  effect: { classes, targets: domains.map((domain) => ({ domain })) },
});

const specs = {
  weighing: {
    atoms: {
      "place-watch-glass": ["atom.place.weighed-vessel", { "weighed-vessel": "watch-glass" }],
      "weigh-solid": ["atom.weigh.solid-portion", { "balance-instrument": "analytical-balance", "weighed-vessel": "watch-glass", "solid-transfer-tool": "spatula" }],
    },
    legacy: [legacyEffect("record-solid-mass", ["evidence-recording"], ["evidence"])],
    roles: [
      role("balance-instrument", ["analytical-balance"], ["analytical-balance-1"]),
      role("weighed-vessel", ["watch-glass"], ["watch-glass-1"]),
      role("solid-transfer-tool", ["spatula"], ["spatula-1"]),
    ],
    configurationSlots: [configuration("massMeasurementId", "string")],
    evidenceOutputs: [
      evidenceOutput("mass-reading", "measurement", "weigh-solid", "{{config.massMeasurementId}}"),
      evidenceOutput("mass-record", "notebook", "record-solid-mass", "{{config.massMeasurementId}}"),
    ],
    bind(definition) {
      definition.actions.find((action) => action.id === "record-solid-mass").parameters.measurementId = "{{config.massMeasurementId}}";
      rewriteStrings(definition, [["2.5 g", "the learner-entered balance reading"]]);
    },
  },
  "measuring-volume": {
    atoms: {
      "place-cylinder": ["atom.place.variable-volume-device", { "variable-volume-measuring-device": "graduated-cylinder" }],
      "measure-20ml": ["atom.measure.variable-volume", { "variable-volume-measuring-device": "graduated-cylinder", "liquid-source": "sample-bottle" }],
    },
    legacy: [legacyEffect("record-volume", ["evidence-recording"], ["evidence"])],
    roles: [
      role("variable-volume-measuring-device", ["graduated-cylinder"], ["graduated-cylinder-1"]),
      role("liquid-source", ["sample-bottle"], ["sample-bottle-1"]),
    ],
    configurationSlots: [configuration("targetVolumeMl"), configuration("volumeToleranceMl"), configuration("volumeMeasurementId", "string")],
    evidenceOutputs: [
      evidenceOutput("volume-reading", "measurement", "measure-20ml", "{{config.volumeMeasurementId}}"),
      evidenceOutput("volume-record", "notebook", "record-volume", "{{config.volumeMeasurementId}}"),
    ],
    bind(definition) {
      const measure = definition.actions.find((action) => action.id === "measure-20ml");
      Object.assign(measure.parameters, { measurementId: "{{config.volumeMeasurementId}}", volumeMl: "{{config.targetVolumeMl}}", tolerance: "{{config.volumeToleranceMl}}" });
      measure.interaction.accessibleLabel = "Pour the configured sample from the source into the graduated cylinder to the configured volume.";
      definition.actions.find((action) => action.id === "record-volume").parameters.measurementId = "{{config.volumeMeasurementId}}";
      rewriteStrings(definition, [["20 mL", "the configured volume"]]);
    },
  },
  "making-solution": {
    atoms: {
      "add-solvent": ["atom.transfer.unmeasured-solvent", { "liquid-source": "wash-bottle", "receiving-vessel": "volumetric-flask" }],
      "dissolve-solid": ["atom.dissolve.solid-in-solvent", { "receiving-vessel": "volumetric-flask", "stirring-device": "stirring-rod" }],
    },
    legacy: [legacyEffect("observe-solution", ["evidence-recording"], ["evidence"])],
    roles: [
      role("liquid-source", ["wash-bottle"], ["wash-bottle-1"]),
      role("receiving-vessel", ["volumetric-flask"], ["volumetric-flask-1"]),
      role("stirring-device", ["stirring-rod"], ["stirring-rod-1"]),
    ],
    configurationSlots: [configuration("initialSolventVolumeMl"), configuration("soluteMassG"), configuration("finalVolumeMl"), configuration("solutionObservation", "string")],
    evidenceOutputs: [evidenceOutput("solution-observation", "notebook", "observe-solution", "solution-observation")],
    bind(definition) {
      definition.actions.find((action) => action.id === "add-solvent").parameters.volumeMl = "{{config.initialSolventVolumeMl}}";
      Object.assign(definition.actions.find((action) => action.id === "dissolve-solid").parameters, {
        soluteMassG: "{{config.soluteMassG}}", finalVolumeMl: "{{config.finalVolumeMl}}",
      });
      Object.assign(definition.actions.find((action) => action.id === "observe-solution"), {
        label: "Record solution appearance",
        verb: "observe",
      });
      definition.actions.find((action) => action.id === "observe-solution").parameters.note = "{{config.solutionObservation}}";
      Object.assign(definition.process.nodes.find((node) => node.actionId === "observe-solution"), {
        title: "Record solution appearance",
        description: "Record the configured solution-appearance evidence without inventing an observation.",
      });
      rewriteStrings(definition, [["80 mL", "the configured initial solvent volume"], ["2.5 g", "the configured solute mass"], ["100 mL", "the configured final volume"]]);
    },
  },
  dilution: {
    atoms: {
      "transfer-aliquot": ["atom.transfer.measured-liquid", { "measured-solvent-source": "graduated-cylinder", "receiving-vessel": "volumetric-flask" }],
      "dilute-to-mark": ["atom.dilute.unmeasured-solvent-to-mark", { "liquid-source": "wash-bottle", "receiving-vessel": "volumetric-flask" }],
    },
    legacy: [legacyEffect("record-dilution", ["evidence-recording"], ["evidence"])],
    roles: [
      role("measured-solvent-source", ["graduated-cylinder"], ["graduated-cylinder-1"]),
      role("receiving-vessel", ["volumetric-flask"], ["volumetric-flask-1"]),
      role("liquid-source", ["wash-bottle"], ["wash-bottle-1"]),
    ],
    configurationSlots: [configuration("aliquotVolumeMl"), configuration("finalVolumeMl"), configuration("dilutionFactor"), configuration("dilutionEvidenceId", "string")],
    evidenceOutputs: [evidenceOutput("dilution-record", "notebook", "record-dilution", "{{config.dilutionEvidenceId}}")],
    bind(definition) {
      definition.actions.find((action) => action.id === "transfer-aliquot").parameters.volumeMl = "{{config.aliquotVolumeMl}}";
      Object.assign(definition.actions.find((action) => action.id === "dilute-to-mark").parameters, {
        finalVolumeMl: "{{config.finalVolumeMl}}", dilutionFactor: "{{config.dilutionFactor}}",
      });
      Object.assign(definition.actions.find((action) => action.id === "record-dilution").parameters, {
        measurementId: "{{config.dilutionEvidenceId}}", value: "{{config.dilutionFactor}}",
      });
      rewriteStrings(definition, [["10x", "the configured"], ["10-fold", "configured"], ["10 mL", "the configured aliquot"], ["100 mL", "the configured final volume"]]);
    },
  },
  transfer: {
    atoms: {
      "place-beaker": ["atom.place.precipitation-vessel", { "precipitation-vessel": "beaker-250ml" }],
      "transfer-sample": ["atom.transfer.measured-liquid-to-precipitation-vessel", { "measured-solvent-source": "graduated-cylinder", "precipitation-vessel": "beaker-250ml" }],
    },
    legacy: [legacyEffect("observe-transfer", ["evidence-recording"], ["evidence"])],
    roles: [
      role("measured-solvent-source", ["graduated-cylinder"], ["graduated-cylinder-1"]),
      role("precipitation-vessel", ["beaker-250ml"], ["beaker-250ml-1"]),
    ],
    configurationSlots: [configuration("transferVolumeMl"), configuration("transferObservation", "string")],
    evidenceOutputs: [evidenceOutput("transfer-observation", "notebook", "observe-transfer", "transfer-observation")],
    bind(definition) {
      definition.actions.find((action) => action.id === "transfer-sample").parameters.volumeMl = "{{config.transferVolumeMl}}";
      Object.assign(definition.actions.find((action) => action.id === "observe-transfer"), {
        label: "Record transfer observation",
        verb: "record",
      });
      definition.actions.find((action) => action.id === "observe-transfer").parameters.note = "{{config.transferObservation}}";
      Object.assign(definition.process.nodes.find((node) => node.actionId === "observe-transfer"), {
        title: "Record transfer observation",
        description: "Record the configured transfer evidence without inventing an observation.",
      });
      rewriteStrings(definition, [["20 mL", "the configured volume"]]);
    },
  },
  filtration: {
    atoms: {
      "assemble-funnel-stand": ["atom.place.filtration-funnel", { "filtration-funnel": "funnel", "filtration-support": "ring-stand" }],
      "place-filter-paper": ["atom.place.filter-medium", { "filter-medium": "filter-paper", "filtration-funnel": "funnel-stand" }],
      "wet-filter-paper": ["atom.rinse.wet-filter-medium", { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" }],
      "place-filtration-receiver": ["atom.place.filtration-receiver", { "filtration-receiver": "erlenmeyer-flask-250ml" }],
      "filter-mixture": ["atom.filter.pour-through-medium", { "mixture-source": "beaker-250ml", "filtration-funnel": "funnel-stand", "filtration-receiver": "erlenmeyer-flask-250ml" }],
      "rinse-precipitate": ["atom.rinse.wash-precipitate", { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" }],
    },
    legacy: [],
    roles: [
      role("filtration-support", ["ring-stand"], ["ring-stand-1"]),
      role("filtration-funnel", ["funnel", "funnel-stand"], ["funnel-1", "funnel-stand-1"]),
      role("filter-medium", ["filter-paper"], ["filter-paper-1"]),
      role("rinse-water-source", ["wash-bottle"], ["wash-bottle-1"]),
      role("filtration-receiver", ["erlenmeyer-flask-250ml"], ["erlenmeyer-flask-250ml-1"]),
      role("mixture-source", ["beaker-250ml"], ["beaker-250ml-1"]),
    ],
    configurationSlots: [configuration("filtrationMode", "string", true, ["gravity", "vacuum"]), configuration("rinseVolumeMl")],
    evidenceOutputs: [
      evidenceOutput("filtration-complete", "action-evidence", "filter-mixture"),
      evidenceOutput("rinse-complete", "action-evidence", "rinse-precipitate"),
    ],
    bind(definition) {
      definition.actions.find((action) => action.id === "filter-mixture").parameters.filtrationMode = "{{config.filtrationMode}}";
      definition.actions.find((action) => action.id === "rinse-precipitate").parameters.volumeMl = "{{config.rinseVolumeMl}}";
      const receiver = definition.actions.find((action) => action.id === "place-filtration-receiver");
      receiver.invalidCases = [{
        id: "receiver-missing-or-misaligned",
        when: "no compatible receiving vessel is centered below the prepared funnel stem",
        message: "Filtration cannot begin without a compatible receiver below the funnel.",
        recovery: "Place the configured beaker or Erlenmeyer receiver in the funnel receiving zone, then retry.",
      }];
    },
  },
  drying: {
    atoms: {
      "dry-precipitate": ["atom.dry.oven-stage", { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass" }],
      "remove-warm-precipitate": ["atom.place.remove-warm-drying-assembly", { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass", "cooling-tool": "crucible-tongs" }],
      "break-precipitate": ["atom.break.precipitate", { "dried-assembly": "watch-glass", "solid-transfer-tool": "scoopula" }],
      "second-dry-precipitate": ["atom.dry.oven-stage", { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass" }],
      "cool-dry-precipitate": ["atom.cool.before-weighing", { "dried-assembly": "watch-glass", "cooling-tool": "crucible-tongs" }],
      "weigh-dry-precipitate": ["atom.weigh.dry-assembly", { "balance-instrument": "analytical-balance", "dried-assembly": "watch-glass" }],
    },
    legacy: [legacyEffect("record-dry-mass", ["evidence-recording"], ["evidence"])],
    roles: [
      role("drying-instrument", ["drying-oven"], ["drying-oven-1"]),
      role("dried-assembly", ["watch-glass"], ["watch-glass-1"]),
      role("balance-instrument", ["analytical-balance"], ["analytical-balance-1"]),
      role("cooling-tool", ["crucible-tongs"], ["crucible-tongs-1"]),
      role("solid-transfer-tool", ["scoopula"], ["scoopula-1"]),
    ],
    configurationSlots: [
      configuration("firstDryingMinutes"), configuration("secondDryingMinutes"), configuration("ovenTemperatureC"),
      configuration("dryMassG"), configuration("massToleranceG"), configuration("dryMassMeasurementId", "string"),
    ],
    evidenceOutputs: [
      evidenceOutput("first-drying-stage", "action-evidence", "dry-precipitate"),
      evidenceOutput("second-drying-stage", "action-evidence", "second-dry-precipitate"),
      evidenceOutput("cooled-dry-mass-reading", "measurement", "weigh-dry-precipitate", "{{config.dryMassMeasurementId}}"),
      evidenceOutput("cooled-dry-mass-record", "notebook", "record-dry-mass", "{{config.dryMassMeasurementId}}"),
    ],
    bind(definition) {
      replaceDryingSequence(definition);
    },
  },
  "hard-water-calculation": {
    atoms: {},
    legacy: [legacyEffect("calculate-hardness", ["calculation-analysis"], ["analysis", "evidence"])],
    roles: [],
    configurationSlots: [configuration("sampleVolumeMeasurementId", "string"), configuration("precipitateMassMeasurementId", "string"), configuration("calculationId", "string"), configuration("calculationTolerance")],
    evidenceOutputs: [evidenceOutput("hardness-calculation", "calculation", "calculate-hardness", "{{config.calculationId}}")],
    bind(definition) {
      const action = definition.actions.find((item) => item.id === "calculate-hardness");
      action.parameters = {
        calculationId: "{{config.calculationId}}",
        template: "hardnessMgLAsCaCO3",
        sampleVolumeMeasurementId: "{{config.sampleVolumeMeasurementId}}",
        precipitateMassMeasurementId: "{{config.precipitateMassMeasurementId}}",
        tolerance: "{{config.calculationTolerance}}",
        requireStudentValue: true,
      };
      for (const rule of [...definition.process.nodes.flatMap((node) => node.validation), ...definition.successCriteria]) {
        rule.calculationId = "{{config.calculationId}}";
        delete rule.tolerance;
      }
    },
  },
};

const rewriteStrings = (value, replacements) => {
  if (Array.isArray(value)) {
    value.forEach((item) => rewriteStrings(item, replacements));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      value[key] = replacements.reduce((text, [from, to]) => text.replaceAll(from, to), item);
    } else rewriteStrings(item, replacements);
  }
};

const invalidCases = (context) => [{
  id: "wrong-order",
  when: "the current process node expects a different action",
  message: `That action is out of sequence for ${context}.`,
  recovery: "Return to the highlighted node and complete its prerequisite first.",
}, {
  id: "invalid-apparatus-state",
  when: "the required source, target, tool, or temperature state is missing",
  message: `The apparatus is not ready for ${context}.`,
  recovery: "Correct the named apparatus or temperature prerequisite, then retry.",
}];

const actionNode = (action, type = "action") => ({
  id: `${action.id}-node`,
  type,
  title: action.label,
  description: action.interaction?.accessibleLabel ?? action.label,
  actionId: action.id,
  config: {},
  validation: [{ id: `${action.id}-complete`, type: "actionEvidence", label: `${action.label} was completed.`, actionId: action.id }],
  hints: [],
  feedback: { success: `${action.label} complete.`, retry: `Correct the prerequisite and retry ${action.label.toLowerCase()}.` },
});

const replaceDryingSequence = (definition) => {
  const dryingSource = readJson("public/techniques/two-stage-precipitate-drying.json");
  for (const [sourceId, targetId] of [["practice-tongs", "crucible-tongs-1"], ["practice-scoopula", "scoopula-1"]]) {
    if (definition.initialState.equipment.some((item) => item.id === targetId)) continue;
    const item = clone(dryingSource.initialState.equipment.find((candidate) => candidate.id === sourceId));
    item.id = targetId;
    definition.initialState.equipment.push(item);
    if (!definition.requiredEquipment.includes(item.definitionId)) definition.requiredEquipment.push(item.definitionId);
  }
  const first = definition.actions.find((action) => action.id === "dry-precipitate");
  const weigh = definition.actions.find((action) => action.id === "weigh-dry-precipitate");
  const record = definition.actions.find((action) => action.id === "record-dry-mass");
  Object.assign(first.parameters, {
    dryingMinutes: "{{config.firstDryingMinutes}}", ovenTemperatureC: "{{config.ovenTemperatureC}}", dryMassG: "{{config.dryMassG}}",
  });
  first.label = "Complete the first configured drying stage";
  first.interaction.accessibleLabel = "Place the precipitate assembly in the configured oven for the first configured drying stage.";
  const remove = {
    id: "remove-warm-precipitate", verb: "place", label: "Remove the warm assembly",
    parameters: { sourceDefinitionId: "watch-glass", targetDefinitionId: "crucible-tongs" },
    interaction: { type: "dragToZone", sourceDefinitionId: "watch-glass", targetDefinitionId: "crucible-tongs", stationId: "crucible-tongs", accessibleLabel: "Use the configured heat-safe tool to remove the warm assembly without weighing it.", successCue: "The warm assembly is safely removed.", invalidCue: "Use the heat-safe tool only after the first drying stage is complete." },
    prerequisites: [], stateChanges: ["The partially dried assembly is warm and outside the oven."], invalidCases: invalidCases("warm-assembly removal"),
    feedback: { success: "Warm assembly removed.", invalid: "Complete the first drying stage and use the configured heat-safe tool." }, evidence: ["place"],
  };
  const breakAction = {
    id: "break-precipitate", verb: "place", label: "Break the precipitate into small pieces",
    parameters: { sourceDefinitionId: "scoopula", targetDefinitionId: "watch-glass" },
    interaction: { type: "dragToZone", sourceDefinitionId: "scoopula", targetDefinitionId: "watch-glass", stationId: "watch-glass", accessibleLabel: "Use the configured solid tool to break the warm precipitate into small pieces before redrying.", successCue: "The precipitate is represented as broken into smaller pieces.", invalidCue: "Remove the warm assembly before breaking the precipitate." },
    prerequisites: [], stateChanges: ["The partially dried precipitate is broken into smaller pieces for the second stage."], invalidCases: invalidCases("precipitate breakup"),
    feedback: { success: "Precipitate broken into smaller pieces.", invalid: "Remove the warm assembly and use the configured solid tool." }, evidence: ["place"],
  };
  const second = clone(first);
  second.id = "second-dry-precipitate";
  second.label = "Complete the second configured drying stage";
  second.parameters.dryingMinutes = "{{config.secondDryingMinutes}}";
  second.interaction.accessibleLabel = "Return the broken precipitate assembly to the configured oven for the second configured drying stage.";
  const cool = {
    id: "cool-dry-precipitate", verb: "cool", label: "Cool the dried assembly before weighing",
    parameters: { sourceDefinitionId: "watch-glass", targetDefinitionId: "crucible-tongs" },
    interaction: { type: "placeInInstrument", sourceDefinitionId: "watch-glass", targetDefinitionId: "crucible-tongs", stationId: "crucible-tongs", accessibleLabel: "Remove the assembly with the heat-safe tool and allow it to cool before weighing.", successCue: "The assembly is cool enough to weigh.", invalidCue: "Complete the second drying stage before cooling, and do not weigh the assembly warm." },
    prerequisites: [], stateChanges: ["The dried assembly is cooled to the configured safe weighing state."], invalidCases: invalidCases("cooling before weighing"),
    feedback: { success: "Dried assembly cooled.", invalid: "Complete the second drying stage and cool before weighing." }, evidence: ["cool"],
  };
  Object.assign(weigh.parameters, { measurementId: "{{config.dryMassMeasurementId}}", expectedMassG: "{{config.dryMassG}}", tolerance: "{{config.massToleranceG}}" });
  weigh.interaction.accessibleLabel = "Place the cooled dry assembly on the analytical balance and read the configured simulated mass.";
  record.parameters.measurementId = "{{config.dryMassMeasurementId}}";
  definition.actions = [first, remove, breakAction, second, cool, weigh, record];
  const weighNode = actionNode(weigh);
  weighNode.id = "weigh-dry-node";
  const recordNode = actionNode(record, "observation");
  recordNode.id = "record-dry-node";
  definition.process.nodes = [actionNode(first, "checkpoint"), actionNode(remove), actionNode(breakAction), actionNode(second, "checkpoint"), actionNode(cool), weighNode, recordNode];
  definition.process.startNodeId = definition.process.nodes[0].id;
  definition.process.edges = definition.process.nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: definition.process.nodes[index + 1].id, label: "Next", condition: { type: "validationPassed" } }));
  definition.successCriteria = [{ id: "dry-mass-success", type: "actionEvidence", label: "The cooled dry mass was recorded.", actionId: "record-dry-mass" }];
};

const createHardWaterPrecipitation = () => {
  const lab = readJson("public/labs/hard-water-demo.json");
  const transfer = readJson("public/techniques/transfer.json");
  let existingAction;
  try {
    existingAction = readJson("public/techniques/hard-water-precipitation.json").actions.find((action) => action.id === "precipitate-caco3");
  } catch {}
  const sourceAction = clone(existingAction ?? transfer.actions.find((action) => action.id === "precipitate-caco3") ?? {
    id: "precipitate-caco3", verb: "precipitate", label: "Form the configured calcium carbonate precipitate",
    parameters: {}, prerequisites: [], stateChanges: ["A configured wet calcium carbonate precipitate is available for filtration."],
    invalidCases: invalidCases("hard-water precipitation"), feedback: { success: "Configured calcium carbonate precipitate formed.", invalid: "Add the configured reagent to the hard-water sample in the precipitation vessel." }, evidence: ["precipitate"],
    interaction: { type: "pourInto", sourceDefinitionId: "reagent-bottle", targetDefinitionId: "beaker-250ml", accessibleLabel: "Add the configured carbonate reagent to the hard-water sample.", successCue: "The configured wet precipitate is represented.", invalidCue: "Use the configured reagent and precipitation vessel." },
  });
  sourceAction.label = "Add configured carbonate reagent and form CaCO3 precipitate";
  sourceAction.atomId = "atom.precipitate.form-gravimetric-solid";
  sourceAction.equipmentRoleBindings = { "precipitation-vessel": "beaker-250ml", "precipitating-reagent-source": "reagent-bottle" };
  sourceAction.parameters = { sourceDefinitionId: "reagent-bottle", targetDefinitionId: "beaker-250ml", precipitateMassG: "{{config.precipitateMassG}}", finalVolumeMl: "{{config.finalVolumeMl}}" };
  sourceAction.invalidCases = invalidCases("hard-water precipitation");
  const node = actionNode(sourceAction);
  node.id = "precipitate-sample-node";
  return {
    id: "hard-water-precipitation", title: "Hard-Water Calcium Carbonate Precipitation",
    learningGoal: "Create a configured CaCO3 precipitate in a hard-water sample without treating simulated mass as measurement evidence.",
    requiredEquipment: ["beaker-250ml", "reagent-bottle"],
    initialState: { equipment: [
      clone(lab.initialState.equipment.find((item) => item.id === "beaker-250ml-1")),
      clone(lab.initialState.equipment.find((item) => item.id === "reagent-bottle-1")),
    ] },
    actions: [sourceAction], process: { startNodeId: node.id, nodes: [node], edges: [] },
    successCriteria: [{ id: "hard-water-precipitation-success", type: "actionEvidence", label: "Configured CaCO3 precipitation was completed.", actionId: sourceAction.id }],
    commonMistakes: invalidCases("hard-water precipitation"), resetBehavior: "resetTechnique",
    metadata: { version, author: "Lab Studio", updatedAt: "2026-08-30T00:00:00.000Z", tags: ["technique", "hard-water", "precipitation", "disclosed-r-c-practice"] },
    composition: {
      schemaVersion: 1,
      ports: [{ id: "entry", kind: "entry", nodeId: node.id, label: "Entry" }, { id: "exit", kind: "exit", nodeId: node.id, label: "Exit" }],
      equipmentRoles: [role("precipitation-vessel", ["beaker-250ml"], ["beaker-250ml-1"]), role("precipitating-reagent-source", ["reagent-bottle"], ["reagent-bottle-1"])],
      modelSlots: [], configurationSlots: [configuration("precipitateMassG"), configuration("finalVolumeMl")], approvalGates: [], variants: [],
      evidenceOutputs: [evidenceOutput("wet-precipitate", "action-evidence", sourceAction.id)],
      completion: { exitPortIds: ["exit"], requiredEvidenceOutputIds: ["wet-precipitate"], requiredValidationRuleIds: ["hard-water-precipitation-success"] },
      catalogDisposition: "lab-scoped",
    },
  };
};

const transformTechnique = (id) => {
  if (id === "hard-water-precipitation") return createHardWaterPrecipitation();
  const definition = readJson(`public/techniques/${id}.json`);
  if (id === "transfer") {
    definition.actions = definition.actions.filter((action) => action.id !== "precipitate-caco3");
    definition.process.nodes = definition.process.nodes.filter((node) => node.actionId !== "precipitate-caco3");
    definition.process.edges = definition.process.nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: definition.process.nodes[index + 1].id, label: "Next", condition: { type: "validationPassed" } }));
    definition.initialState.equipment = definition.initialState.equipment.filter((item) => item.definitionId !== "reagent-bottle");
    definition.requiredEquipment = definition.requiredEquipment.filter((item) => item !== "reagent-bottle");
  }
  const spec = specs[id];
  for (const action of definition.actions) {
    const atom = spec.atoms[action.id];
    if (!atom) continue;
    action.atomId = atom[0];
    action.equipmentRoleBindings = atom[1];
  }
  definition.composition = {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: definition.process.startNodeId, label: "Entry" },
      { id: "exit", kind: "exit", nodeId: definition.process.nodes.at(-1).id, label: "Exit" },
    ],
    equipmentRoles: spec.roles,
    modelSlots: [],
    configurationSlots: spec.configurationSlots,
    approvalGates: [],
    variants: [],
    evidenceOutputs: spec.evidenceOutputs,
    completion: {
      exitPortIds: ["exit"],
      requiredEvidenceOutputIds: spec.evidenceOutputs.map((output) => output.id),
      requiredValidationRuleIds: definition.successCriteria.map((item) => item.id),
    },
    catalogDisposition: "composable",
    ...(spec.legacy.length ? { legacyActionEffects: spec.legacy } : {}),
  };
  spec.bind?.(definition);
  definition.composition.ports[0].nodeId = definition.process.startNodeId;
  definition.composition.ports[1].nodeId = definition.process.nodes.at(-1).id;
  for (const action of definition.actions) {
    const atom = spec.atoms[action.id];
    if (!atom) continue;
    action.atomId = atom[0];
    action.equipmentRoleBindings = atom[1];
  }
  definition.metadata.version = version;
  definition.metadata.updatedAt = "2026-08-30T00:00:00.000Z";
  return definition;
};

const equipmentBindings = (technique, lab) => Object.fromEntries(
  technique.composition.equipmentRoles.map((item) => [
    item.roleId,
    {
      sourceInstances: item.sourceInstanceIds.map((sourceInstanceId) => {
        const source = technique.initialState.equipment.find((candidate) => candidate.id === sourceInstanceId);
        const target = lab.initialState.equipment.find((candidate) => candidate.definitionId === source.definitionId);
        if (!target) throw new Error(`${lab.id} lacks ${source.definitionId} for ${technique.id}:${sourceInstanceId}`);
        return { sourceInstanceId, definitionId: source.definitionId, instanceId: target.id };
      }),
    },
  ]),
);

const legacyNodeIdsByLab = {
  "intro-filtration-demo": {
    "measure-sample-node": "demo-measure-node",
    "transfer-sample-node": "demo-transfer-node",
    "precipitate-sample-node": "demo-precipitate-node",
    "assemble-funnel-stand-node": "demo-assemble-funnel-stand-node",
    "place-filter-node": "demo-place-filter-node",
    "wet-filter-node": "demo-wet-filter-node",
    "place-receiver-node": "demo-place-receiver-node",
    "filter-mixture-node": "demo-filter-node",
    "rinse-precipitate-node": "demo-rinse-node",
  },
  "hard-water-demo": {
    "measure-sample-node": "measure-sample-node",
    "record-volume-node": "record-volume-node",
    "transfer-sample-node": "transfer-sample-node",
    "precipitate-sample-node": "precipitate-node",
    "assemble-funnel-stand-node": "assemble-funnel-stand-node",
    "place-filter-node": "place-filter-node",
    "wet-filter-node": "wet-filter-node",
    "place-receiver-node": "place-receiver-node",
    "filter-mixture-node": "filter-node",
    "rinse-precipitate-node": "rinse-node",
    "dry-precipitate-node": "dry-node",
    "remove-warm-precipitate-node": "remove-warm-precipitate-node",
    "break-precipitate-node": "break-precipitate-node",
    "second-dry-precipitate-node": "second-dry-precipitate-node",
    "cool-dry-precipitate-node": "cool-dry-precipitate-node",
    "weigh-dry-node": "weigh-node",
    "record-dry-node": "record-dry-mass-node",
    "calculate-hardness-node": "calculate-node",
  },
};

const idMap = (technique, labId, kind) => {
  const values = kind === "actions" ? technique.actions : technique.process.nodes;
  const legacyNodeIds = legacyNodeIdsByLab[labId] ?? {};
  return Object.fromEntries(values.map((item) => [
    item.id,
    kind === "actions" ? item.id : (legacyNodeIds[item.id] ?? `${labId}-${item.id}`),
  ]));
};

const validationMap = (technique) => Object.fromEntries([
  ...technique.process.nodes.flatMap((node) => node.validation),
  ...technique.successCriteria,
].map((item) => [item.id, item.id]));

const transformLab = (id) => {
  const lab = readJson(`public/labs/${id}.json`);
  const legacyStartNodeId = id === "intro-filtration-demo" ? "demo-measure-node" : "measure-sample-node";
  if (id === "intro-filtration-demo" && !lab.initialState.equipment.some((item) => item.definitionId === "reagent-bottle")) {
    const source = readJson("public/labs/hard-water-demo.json").initialState.equipment.find((item) => item.id === "reagent-bottle-1");
    lab.initialState.equipment.splice(3, 0, clone(source));
    if (!lab.equipment.includes("reagent-bottle")) lab.equipment.push("reagent-bottle");
  }
  if (id === "hard-water-demo") {
    const dryingSource = readJson("public/techniques/two-stage-precipitate-drying.json");
    for (const [sourceId, targetId] of [["practice-tongs", "crucible-tongs-1"], ["practice-scoopula", "scoopula-1"]]) {
      if (lab.initialState.equipment.some((item) => item.id === targetId)) continue;
      const item = clone(dryingSource.initialState.equipment.find((candidate) => candidate.id === sourceId));
      item.id = targetId;
      lab.initialState.equipment.push(item);
      if (!lab.equipment.includes(item.definitionId)) lab.equipment.push(item.definitionId);
    }
  }
  const techniqueIds = id === "intro-filtration-demo"
    ? ["measuring-volume", "transfer", "hard-water-precipitation", "filtration"]
    : ["measuring-volume", "transfer", "hard-water-precipitation", "filtration", "drying", "hard-water-calculation"];
  const techniques = techniqueIds.map(transformTechnique);
  const demoConfiguration = {
    "measuring-volume": { targetVolumeMl: 20, volumeToleranceMl: 1, volumeMeasurementId: "sample-volume" },
    transfer: { transferVolumeMl: 20, transferObservation: "Transferred sample is clear with no spill." },
    "hard-water-precipitation": { precipitateMassG: 0.0075, finalVolumeMl: 40 },
    filtration: { filtrationMode: "gravity", rinseVolumeMl: 5 },
    drying: { firstDryingMinutes: 12, secondDryingMinutes: 5, ovenTemperatureC: 115, dryMassG: 0.0075, massToleranceG: 0.0005, dryMassMeasurementId: "dry-precipitate-mass" },
    "hard-water-calculation": { sampleVolumeMeasurementId: "sample-volume", precipitateMassMeasurementId: "dry-precipitate-mass", calculationId: "hardness-mg-l", calculationTolerance: 0.5 },
  };
  lab.techniqueInstances = techniques.map((technique) => ({
    instanceId: technique.id,
    techniqueId: technique.id,
    version,
    bindings: { equipment: equipmentBindings(technique, lab), models: {}, configuration: demoConfiguration[technique.id] },
    preserveIds: {
      actions: idMap(technique, id, "actions"),
      nodes: idMap(technique, id, "nodes"),
      validationRules: validationMap(technique),
    },
  }));
  lab.compositionStart = { kind: "technique-port", instanceId: techniqueIds[0], portId: "entry" };
  lab.compositionConnections = techniqueIds.slice(0, -1).map((techniqueId, index) => ({
    id: `${techniqueId}-to-${techniqueIds[index + 1]}`,
    from: { kind: "technique-port", instanceId: techniqueId, portId: "exit" },
    to: { kind: "technique-port", instanceId: techniqueIds[index + 1], portId: "entry" },
    label: "Next",
    condition: { type: "validationPassed" },
  }));
  lab.reachabilityWitnesses = [{ id: "default", configuration: {}, approvalGates: {} }];
  delete lab.techniqueRefs;
  lab.actions = [];
  lab.process = { startNodeId: legacyStartNodeId, nodes: [], edges: [] };
  lab.assessments = [];
  lab.metadata.version = version;
  lab.metadata.updatedAt = "2026-08-30T00:00:00.000Z";
  return lab;
};

const newAtoms = [
  ["atom.place.weighed-vessel", "place", ["dragToZone"], ["weighed-vessel"], "Position the clean, dry weighing vessel before taking a mass.", [{ sourceFile: "what-makes-hard-water-hard_2026-07-27.md", sourceTable: "phase", step: "PR-02", basis: "R" }], [{ owner: "technique:weighing", actionId: "place-watch-glass" }]],
  ["atom.place.variable-volume-device", "place", ["dragToZone"], ["variable-volume-measuring-device"], "Position the graduated measuring device before filling it.", [], [{ owner: "technique:measuring-volume", actionId: "place-cylinder" }]],
  ["atom.transfer.unmeasured-solvent", "transfer", ["pourInto"], ["liquid-source", "receiving-vessel"], "Add solvent without implying a calibrated delivered volume.", [], [{ owner: "technique:making-solution", actionId: "add-solvent" }]],
  ["atom.dilute.unmeasured-solvent-to-mark", "dilute", ["pourInto"], ["liquid-source", "receiving-vessel"], "Add unmeasured solvent until the configured final-volume mark is reached.", [], [{ owner: "technique:dilution", actionId: "dilute-to-mark" }]],
  ["atom.place.precipitation-vessel", "place", ["dragToZone"], ["precipitation-vessel"], "Position the precipitation vessel before adding measured sample or reagent.", [], [{ owner: "technique:transfer", actionId: "place-beaker" }]],
  ["atom.transfer.measured-liquid-to-precipitation-vessel", "transfer", ["pourInto"], ["measured-solvent-source", "precipitation-vessel"], "Transfer an already measured aliquot into the precipitation vessel.", [], [{ owner: "technique:transfer", actionId: "transfer-sample" }]],
  ["atom.place.remove-warm-drying-assembly", "place", ["dragToZone"], ["drying-instrument", "dried-assembly", "cooling-tool"], "Use the configured heat-safe tool to remove the warm assembly after the first drying stage without weighing it.", [{ sourceFile: "what-makes-hard-water-hard_2026-07-27.md", sourceTable: "phase", step: "FD-15", basis: "M" }], [{ owner: "technique:drying", actionId: "remove-warm-precipitate" }]],
  ["atom.break.precipitate", "place", ["dragToZone"], ["dried-assembly", "solid-transfer-tool"], "Break the partially dried precipitate into small pieces before the second drying stage.", [{ sourceFile: "what-makes-hard-water-hard_2026-07-27.md", sourceTable: "phase", step: "FD-16", basis: "M" }], [{ owner: "technique:drying", actionId: "break-precipitate" }]],
];

const transformRegistry = () => {
  const registry = readJson("src/domain/atomRegistry.json");
  const retiredLabExamples = new Set([
    "atom.filter.pour-through-medium|lab:hard-water-demo|filter-mixture",
    "atom.place.filtration-receiver|lab:hard-water-demo|place-filtration-receiver",
    "atom.transfer.measured-liquid|lab:hard-water-demo|transfer-sample",
  ]);
  for (const atom of registry.atoms) {
    atom.contentExamples = atom.contentExamples.filter((example) =>
      !retiredLabExamples.has(`${atom.id}|${example.owner}|${example.actionId}`));
  }
  for (const [id, verb, allowedInteractionTypes, requiredRoles, constraint, sourceExamples, contentExamples] of newAtoms) {
    const atom = registry.atoms.find((candidate) => candidate.id === id);
    const next = {
      id,
      family: "foundational",
      documentationLabel: constraint,
      verb,
      allowedInteractionTypes,
      effectContract: {
        classes: ["apparatus-material-instrument-state"],
        targets: [{ domain: "equipment" }, { domain: "material" }, { domain: "instrument" }],
      },
      requiredRoles,
      optionalRoles: [],
      proceduralConstraints: [constraint],
      evidence: constraint,
      sourceExamples,
      contentExamples,
    };
    if (atom) Object.assign(atom, next);
    else registry.atoms.push(next);
  }
  return registry;
};

const effectFlags = (classes) => ({
  apparatusMaterialInstrumentState: classes.includes("apparatus-material-instrument-state"),
  measurementOrDirectObservation: classes.includes("measurement-direct-observation-acquisition"),
  evidenceRecording: classes.includes("evidence-recording"),
  calculationOrAnalysis: classes.includes("calculation-analysis"),
  pedagogicalOrchestration: classes.includes("pedagogical-orchestration"),
});

const transformAudits = () => {
  const registry = transformRegistry();
  const atomById = new Map(registry.atoms.map((atom) => [atom.id, atom]));
  const atomicity = readJson("planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json");
  const labAudit = readJson("planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json");
  const oldAtomicByAction = new Map(atomicity.rows
    .filter((row) => row.finalOwningCycle === "04")
    .map((row) => [`${row.techniqueId}#${row.actionId}`, row]));
  const nextAtomic = atomicity.rows.filter((row) => row.finalOwningCycle !== "04");
  for (const techniqueId of Object.keys(specs)) {
    const technique = transformTechnique(techniqueId);
    const legacy = new Map((technique.composition.legacyActionEffects ?? []).map((item) => [item.actionId, item.effect]));
    for (const action of technique.actions) {
      const prior = clone(oldAtomicByAction.get(`${techniqueId}#${action.id}`) ?? {});
      const atom = action.atomId ? atomById.get(action.atomId) : undefined;
      const contract = atom?.effectContract ?? legacy.get(action.id);
      const classes = contract.classes;
      const domains = contract.targets.map((target) => target.domain);
      nextAtomic.push({
        ...prior,
        rowId: `${techniqueId}@${version}#${action.id}`,
        techniqueId,
        techniqueVersion: version,
        actionId: action.id,
        actionLabel: action.label,
        actionVerb: action.verb,
        reachableTechniqueNodeConsumers: technique.process.nodes.filter((node) => node.actionId === action.id).map((node) => node.id),
        coverage: {
          atomId: action.atomId ?? null,
          atomRegistryEntryPresent: Boolean(atom),
          equipmentRoleBindings: action.equipmentRoleBindings ?? {},
          equipmentRoleRegistryEntriesPresent: true,
          missingRequiredRoles: [],
          sourceTraceCount: prior.coverage?.sourceTraceCount ?? 0,
          sourceStatus: "Cycle-04 R/C foundational contract",
        },
        finalOwningCycle: "04",
        effect: {
          registryHandlerDerivedClasses: classes,
          typedTargetDomains: domains,
          flags: effectFlags(classes),
          declaredVersusDerivedConflict: { hasConflict: false, reasons: [] },
          resolvedInteractionType: action.interaction?.type ?? null,
        },
        atomicity: {
          realBenchVerb: action.verb,
          persistentStateTransition: action.stateChanges,
          prerequisites: action.prerequisites,
          distinctPausePoint: `Completion of node evidence for ${action.id}.`,
          invalidUnsafeCases: action.invalidCases,
          evidenceBoundary: { actionEvidence: action.evidence, atomEvidence: atom?.evidence ?? null },
          recoveryBoundary: action.invalidCases.map((item) => ({ caseId: item.id, recovery: item.recovery })),
          flags: { multiVerb: false, positionVersusOperate: false, readVersusRecord: false, conditionVersusMeasure: false },
          verdict: action.atomId ? "keep" : "nonphysical",
          proposedChildOperations: [],
          publicIdDisposition: `Preserve ${action.id}.`,
        },
        sourceDisposition: {
          applicableSourceClaims: atom?.sourceExamples ?? [],
          conflict: false,
          governingAuthorityAndRationale: "Cycle 04 foundational R/C practice contract; dated source examples constrain reusable atoms without promoting demo quantities to M/F.",
          unresolvedConfirmationPoint: null,
        },
        techniqueMatchDecision: "exact-compatible-version",
        blockedReason: null,
      });
    }
  }
  atomicity.rows = nextAtomic.sort((a, b) => a.rowId.localeCompare(b.rowId));
  atomicity.generatedAt = "2026-08-30T00:00:00.000Z";
  atomicity.inventory.actionRows = atomicity.rows.length;

  const composedLabIds = new Set(["equilibrium-rainbow-display", "quick-ache-relief-separation", "intro-filtration-demo", "hard-water-demo"]);
  const nextLabRows = labAudit.rows.filter((row) => !composedLabIds.has(row.labId));
  for (const labId of composedLabIds) {
    const lab = labId === "intro-filtration-demo" || labId === "hard-water-demo"
      ? transformLab(labId)
      : readJson(`public/labs/${labId}.json`);
    for (const instance of lab.techniqueInstances) {
      const technique = readJson(`public/techniques/${instance.techniqueId}.json`);
      const legacy = new Map((technique.composition?.legacyActionEffects ?? []).map((item) => [item.actionId, item.effect]));
      for (const node of technique.process.nodes) {
        const action = technique.actions.find((item) => item.id === node.actionId);
        const nodeId = instance.preserveIds?.nodes?.[node.id] ?? `${instance.instanceId}--${node.id}`;
        const actionId = instance.preserveIds?.actions?.[action.id] ?? `${instance.instanceId}--${action.id}`;
        const atom = action.atomId ? atomById.get(action.atomId) : undefined;
        const contract = atom?.effectContract ?? legacy.get(action.id);
        const classes = contract?.classes ?? ["evidence-recording"];
        nextLabRows.push({
          rowId: `${labId}#${nodeId}`,
          labId,
          processId: "root",
          nodeId,
          actionId,
          reachability: "mandatory",
          validConfigurationApprovalWitnesses: [{ kind: "technique-instance", instanceId: instance.instanceId, portId: "entry" }],
          currentActionOrigin: { kind: "technique-instance", techniqueId: instance.techniqueId, techniqueVersion: instance.version, instanceId: instance.instanceId, sourceActionId: action.id },
          effect: {
            registryHandlerDerivedClasses: classes,
            typedTargetDomains: (contract?.targets ?? [{ domain: "evidence" }]).map((target) => target.domain),
            flags: effectFlags(classes),
            declaredVersusDerivedConflict: { hasConflict: false, reasons: [] },
            resolvedInteractionType: action.interaction?.type ?? null,
          },
          complianceVerdict: "technique-origin procedure",
          techniqueMatchEscalation: { decision: "exact-compatible-version", candidates: [`${instance.techniqueId}@${instance.version}#${action.id}`] },
          laterOwnerCycle: labId === "intro-filtration-demo" || labId === "hard-water-demo" ? "04" : (labId === "equilibrium-rainbow-display" ? "09" : "06"),
          sourceConflictOrConfigurationBlock: { sourceClaims: atom?.sourceExamples ?? [], conflict: false, block: null },
          requiredRemediation: "Closed by compiler-issued exact-version technique-instance provenance.",
        });
      }
    }
  }
  labAudit.rows = nextLabRows.sort((a, b) => a.rowId.localeCompare(b.rowId));
  labAudit.generatedAt = "2026-08-30T00:00:00.000Z";
  labAudit.inventory.nodeActionRows = labAudit.rows.length;
  return { atomicity, labAudit };
};

const rebuildAudits = () => {
  const registry = transformRegistry();
  const atomById = new Map(registry.atoms.map((atom) => [atom.id, atom]));
  const roleRegistry = readJson("src/domain/equipmentRoleRegistry.json");
  const roleIds = new Set(roleRegistry.roles.map((role) => role.id));
  const sourceRegistry = readJson("docs/architecture/source-trace-registry.json");
  const ownership = readJson("planning/2026-08-30_lab-studio-technique-composition-remediation/CATALOG_OWNERSHIP.json");
  const techniqueIndex = readJson("public/techniques/index.json");
  const labIndex = readJson("public/labs/index.json");
  const techniqueOwner = new Map(Object.entries(ownership.techniquesByFinalCycle)
    .flatMap(([cycle, ids]) => ids.map((techniqueId) => [techniqueId, cycle])));
  const labOwner = new Map(Object.entries(ownership.labsByFinalCycle)
    .flatMap(([cycle, ids]) => ids.map((labId) => [labId, cycle])));
  const nonSource = new Map(sourceRegistry.nonSourceDerivedOwners.map((entry) => [entry.owner, entry.rationale]));
  const sourceTraceMap = new Map();
  for (const trace of sourceRegistry.traces) {
    const key = `${trace.ownerType}:${trace.ownerId}#${trace.actionId}`;
    const list = sourceTraceMap.get(key) ?? [];
    list.push({ sourceFile: trace.sourceFile, sourceTable: trace.sourceTable, step: trace.step, basis: trace.basis });
    sourceTraceMap.set(key, list);
  }
  const cycle04ReviewedFoundations = new Set(Object.keys(specs));
  const physicalInteractionTypes = new Set([
    "dragToZone", "snapIntoTarget", "pourInto", "dispenseDrops", "spotOnto", "rinseTarget", "placeInInstrument",
  ]);
  const trueSplits = new Map([
    ["marble-gas-syringe-kinetics@1.1.0#gas-technique-zero-syringe", [
      "Read the gas-syringe baseline, capacity, and readable graduation",
      "Record the gas-syringe baseline evidence",
    ]],
    ["equilibrium-rainbow-inquiry@2.2.0#iron-add-five-drops", [
      "Add exactly five drops of 0.20 M Fe(NO3)3",
      "Stir the prepared stock",
    ]],
  ]);
  const stringParam = (parameters, key) => {
    const value = parameters?.[key];
    return typeof value === "string" && value.trim() ? value : undefined;
  };
  const resolvedInteractionType = (action) => {
    if (action.interaction?.type) return action.interaction.type;
    const sourceDefinitionId = stringParam(action.parameters, "sourceDefinitionId") ?? stringParam(action.parameters, "equipmentDefinitionId");
    const targetDefinitionId = stringParam(action.parameters, "targetDefinitionId");
    const snapZoneId = stringParam(action.parameters, "snapZoneId");
    switch (action.verb) {
      case "place": return targetDefinitionId || snapZoneId ? "snapIntoTarget" : "dragToZone";
      case "measureVolume":
      case "transfer":
      case "dissolve":
      case "precipitate":
      case "dilute":
      case "filter": return "pourInto";
      case "spotSample": return "spotOnto";
      case "developChromatogram": return "snapIntoTarget";
      case "rinse": return "rinseTarget";
      case "dry":
      case "heat":
      case "cool": return "placeInInstrument";
      case "stressEquilibrium": return sourceDefinitionId && targetDefinitionId ? "pourInto" : "recordNotebook";
      case "weigh": return "readInstrument";
      case "record": return stringParam(action.parameters, "kineticsModelId") ? "recordTimeSeries" : "recordNotebook";
      case "observe": return "recordNotebook";
      case "calculate": return "submitCalculation";
      case "reset": return "dragToZone";
      default: return undefined;
    }
  };
  const physicalOrObservationLabel = /^(?:add|adjust|assemble|break|check|close|compare|condition|connect|depress|disconnect|draw|expel|fill|filter|heat|immerse|insert|inspect|invert|label|lift|mark|measure|mix|mount|observe|open|orient|place|pull|read|remove|replace|rinse|seat|shake|stir|test|transfer|wet|wipe|zero)\b/i;
  const isDocumentedRecordOrConfigurationAtom = (atomId, label) =>
    atomId?.startsWith("atom.record.") || atomId === "atom.observe.configure-photometer" ||
    (atomId === "atom.observe.prepare-cuvette-optical-faces" && !/\bfill\b/i.test(label));
  const notebookSemanticConflict = (action, atomId, interactionType) =>
    interactionType === "recordNotebook" && !isDocumentedRecordOrConfigurationAtom(atomId, action.label) &&
    (atomId === "atom.stressEquilibrium.syringe-manipulation" || physicalOrObservationLabel.test(action.label));
  const effectFor = (action, atom) => {
    const interactionType = resolvedInteractionType(action);
    const classes = [];
    if (physicalInteractionTypes.has(interactionType)) classes.push("apparatus-material-instrument-state");
    else if (interactionType === "readInstrument") classes.push("measurement-direct-observation-acquisition");
    else if (interactionType === "recordTimeSeries") classes.push("measurement-direct-observation-acquisition", "evidence-recording");
    else if (interactionType === "recordNotebook") classes.push("evidence-recording");
    else if (interactionType === "submitCalculation") classes.push("calculation-analysis");
    else classes.push("pedagogical-orchestration");
    const parameterKeys = Object.keys(action.parameters ?? {});
    const domains = new Set();
    if (parameterKeys.some((key) => /DefinitionId|equipment|vessel|source|target|receiver/i.test(key)) || action.interaction?.sourceDefinitionId || action.interaction?.targetDefinitionId) domains.add("equipment");
    if (parameterKeys.some((key) => /mass|volume|solute|solution|liquid|solid|precipitate|fraction|sample|reagent/i.test(key))) domains.add("material");
    if (parameterKeys.some((key) => /instrument|station|model|temperature|wavelength|absorbance|transmittance|conductivity|ph/i.test(key)) || interactionType === "readInstrument") domains.add("instrument");
    if (classes.includes("measurement-direct-observation-acquisition") || parameterKeys.some((key) => /measurement|observation|reading|note|tag/i.test(key))) domains.add("measurement-observation");
    if (classes.includes("evidence-recording") || (action.evidence?.length ?? 0) > 0) domains.add("evidence");
    if (classes.includes("calculation-analysis")) domains.add("analysis");
    if (classes.includes("pedagogical-orchestration")) domains.add("pedagogy");
    const roleBindingKeys = Object.keys(action.equipmentRoleBindings ?? {});
    const missingRequiredRoles = atom ? atom.requiredRoles.filter((roleId) => !roleBindingKeys.includes(roleId)) : [];
    const reasons = [];
    if (!interactionType) reasons.push("No current interaction handler resolves for this action.");
    if (atom && interactionType && !atom.allowedInteractionTypes.includes(interactionType)) reasons.push(`Resolved interaction ${interactionType} is not allowed by ${atom.id}.`);
    if (roleBindingKeys.some((roleId) => !roleIds.has(roleId))) reasons.push("One or more equipment-role bindings are absent from the registry.");
    if (missingRequiredRoles.length) reasons.push(`Required role bindings are missing: ${missingRequiredRoles.join(", ")}.`);
    if (notebookSemanticConflict(action, action.atomId, interactionType)) reasons.push(`The learner-facing step claims a physical or observation-acquisition operation, but the resolved ${interactionType} handler records notebook evidence only.`);
    return {
      interactionType: interactionType ?? null,
      classes,
      targets: [...domains].map((domain) => ({ domain })),
      flags: effectFlags(classes),
      conflict: { hasConflict: reasons.length > 0, reasons },
      missingRequiredRoles,
      roleRegistryComplete: roleBindingKeys.every((roleId) => roleIds.has(roleId)),
    };
  };
  const graphEvidence = (process) => {
    const nodeById = new Map((process?.nodes ?? []).map((node) => [node.id, node]));
    const outgoing = new Map((process?.nodes ?? []).map((node) => [node.id, []]));
    const incoming = new Map((process?.nodes ?? []).map((node) => [node.id, []]));
    for (const edge of process?.edges ?? []) {
      outgoing.get(edge.from)?.push(edge);
      incoming.get(edge.to)?.push(edge);
    }
    const reachable = new Set();
    const queue = process?.startNodeId ? [process.startNodeId] : [];
    while (queue.length) {
      const nodeId = queue.shift();
      if (!nodeId || reachable.has(nodeId) || !nodeById.has(nodeId)) continue;
      reachable.add(nodeId);
      queue.push(...(outgoing.get(nodeId) ?? []).map((edge) => edge.to));
    }
    const classify = (nodeId) => {
      if (!reachable.has(nodeId)) return { reachability: "dead", witnesses: [] };
      if (nodeId === process.startNodeId) return { reachability: "mandatory", witnesses: [{ kind: "start-node", startNodeId: process.startNodeId }] };
      const reachableIncoming = (incoming.get(nodeId) ?? []).filter((edge) => reachable.has(edge.from));
      const witness = reachableIncoming.find((edge) => edge.condition?.type === "validationPassed") ?? reachableIncoming[0];
      return {
        reachability: reachableIncoming.some((edge) => edge.condition?.type === "validationPassed") ? "mandatory" : "conditional",
        witnesses: witness ? [{ fromNodeId: witness.from, edgeLabel: witness.label, condition: witness.condition }] : [],
      };
    };
    return { reachable, classify };
  };
  const atomicRows = [];
  for (const entry of techniqueIndex) {
    const technique = readJson(`public/techniques/${entry.file ?? `${entry.id}.json`}`);
    const graph = graphEvidence(technique.process);
    for (const action of technique.actions) {
      const atom = action.atomId ? atomById.get(action.atomId) : undefined;
      const effect = effectFor(action, atom);
      const ownerKey = `technique:${technique.id}`;
      const sourceClaims = sourceTraceMap.get(`${ownerKey}#${action.id}`) ?? [];
      const reviewedCycle04Contract = cycle04ReviewedFoundations.has(technique.id);
      const sourceStatus = sourceClaims.length ? "source-traced" : reviewedCycle04Contract ? "cycle-04-reviewed-r-c-contract" : nonSource.has(ownerKey) ? "declared-non-source-derived" : "source-trace-missing";
      const semanticNotebookConflict = notebookSemanticConflict(action, action.atomId, effect.interactionType);
      const physical = physicalInteractionTypes.has(effect.interactionType) || effect.interactionType === "readInstrument" || effect.interactionType === "recordTimeSeries" || semanticNotebookConflict;
      const interactionMismatch = Boolean(atom && effect.interactionType && !atom.allowedInteractionTypes.includes(effect.interactionType));
      const sourceBlocked = physical && sourceStatus !== "source-traced" && !reviewedCycle04Contract;
      const registryBlocked = physical && (!atom || !effect.roleRegistryComplete || effect.missingRequiredRoles.length > 0 || interactionMismatch || semanticNotebookConflict);
      const rowId = `${technique.id}@${technique.metadata.version}#${action.id}`;
      const splitOperations = trueSplits.get(rowId) ?? [];
      const verdict = registryBlocked || sourceBlocked ? "blocked-for-source/configuration" : splitOperations.length ? "split" : physical ? "keep" : "nonphysical";
      const blockingReasons = [];
      if (sourceBlocked) blockingReasons.push(sourceStatus === "declared-non-source-derived" ? "the owner is explicitly declared non-source-derived and requires source regrounding" : "no action-level source trace is bound");
      if (!atom && physical) blockingReasons.push("no registered atom contract resolves");
      if (!effect.roleRegistryComplete) blockingReasons.push("one or more role bindings are absent from the equipment-role registry");
      if (effect.missingRequiredRoles.length) blockingReasons.push(`required role bindings are missing: ${effect.missingRequiredRoles.join(", ")}`);
      if (interactionMismatch) blockingReasons.push("the atom and resolved interaction handler disagree");
      if (semanticNotebookConflict) blockingReasons.push("the notebook-only handler cannot perform the claimed physical or observation operation");
      const applicableSourceClaims = sourceClaims.length ? sourceClaims : reviewedCycle04Contract ? (atom?.sourceExamples ?? []) : [];
      atomicRows.push({
        rowId,
        techniqueId: technique.id,
        techniqueVersion: technique.metadata.version,
        actionId: action.id,
        actionLabel: action.label,
        actionVerb: action.verb,
        reachableTechniqueNodeConsumers: technique.process.nodes.filter((node) => node.actionId === action.id && graph.reachable.has(node.id)).map((node) => node.id),
        coverage: { atomId: action.atomId ?? null, atomRegistryEntryPresent: Boolean(atom), equipmentRoleBindings: action.equipmentRoleBindings ?? {}, equipmentRoleRegistryEntriesPresent: effect.roleRegistryComplete, missingRequiredRoles: effect.missingRequiredRoles, sourceTraceCount: sourceClaims.length, sourceStatus },
        finalOwningCycle: techniqueOwner.get(technique.id),
        effect: { registryHandlerDerivedClasses: effect.classes, typedTargetDomains: effect.targets.map((target) => target.domain), flags: effect.flags, declaredVersusDerivedConflict: effect.conflict, resolvedInteractionType: effect.interactionType },
        atomicity: {
          realBenchVerb: atom?.verb ?? action.verb,
          persistentStateTransition: action.stateChanges ?? [],
          prerequisites: action.prerequisites ?? [],
          distinctPausePoint: `Completion of node evidence for ${action.id}; no cursor/grasp microstep is introduced.`,
          invalidUnsafeCases: action.invalidCases ?? [],
          evidenceBoundary: { actionEvidence: action.evidence ?? [], atomEvidence: atom?.evidence ?? null },
          recoveryBoundary: (action.invalidCases ?? []).map((item) => ({ caseId: item.id, recovery: item.recovery })),
          flags: {
            multiVerb: splitOperations.length > 0 || /\bfill\b/i.test(action.label),
            positionVersusOperate: false,
            readVersusRecord: rowId === "marble-gas-syringe-kinetics@1.1.0#gas-technique-zero-syringe",
            conditionVersusMeasure: action.atomId === "atom.observe.prepare-cuvette-optical-faces" && /\bfill\b/i.test(action.label),
          },
          verdict,
          proposedChildOperations: splitOperations.map((operation, index) => ({ order: index + 1, operation })),
          publicIdDisposition: verdict === "split" ? `Preserve ${action.id} only as a documented compatibility identity or supersession mapping; Cycle ${techniqueOwner.get(technique.id)} must assign ordered child IDs.` : `Preserve ${action.id}.`,
        },
        sourceDisposition: {
          applicableSourceClaims,
          conflict: semanticNotebookConflict || (sourceClaims.length > 1 && new Set(sourceClaims.map((claim) => `${claim.sourceFile}:${claim.step}:${claim.basis}`)).size > 1),
          governingAuthorityAndRationale: sourceClaims.length ? "The dated source trace row and its M/F/R/C basis govern; implementation wording is precedent only." : reviewedCycle04Contract ? "Cycle 04 reviewed this reusable boundary as disclosed R/C practice; instance configuration supplies quantities and evidence identities without promoting them to M/F." : nonSource.get(ownerKey) ?? `Cycle ${techniqueOwner.get(technique.id)} retains the source/configuration decision.`,
          unresolvedConfirmationPoint: verdict === "blocked-for-source/configuration" ? `Do not approve ${action.id}: ${blockingReasons.join("; ")}. Cycle ${techniqueOwner.get(technique.id)} must source-ground or configure the step without inventing procedure.` : null,
        },
        techniqueMatchDecision: verdict === "blocked-for-source/configuration" ? "blocked" : verdict === "split" ? "new-version" : "exact-compatible-version",
        blockedReason: verdict === "blocked-for-source/configuration" ? `Do not approve ${action.id}: ${blockingReasons.join("; ")}. Cycle ${techniqueOwner.get(technique.id)} must source-ground or configure the step without inventing procedure.` : null,
      });
    }
  }
  const techniqueById = new Map(techniqueIndex.map((entry) => [entry.id, readJson(`public/techniques/${entry.file ?? `${entry.id}.json`}`)]));
  const atomicByTechniqueAction = new Map(atomicRows.map((row) => [`${row.techniqueId}#${row.actionId}`, row]));
  const techniqueActionCandidates = new Map();
  for (const row of atomicRows) {
    const candidates = techniqueActionCandidates.get(row.actionId) ?? [];
    candidates.push(row.rowId);
    techniqueActionCandidates.set(row.actionId, candidates);
  }
  const labRows = [];
  const unreferencedDeclaredActions = [];
  const pushLabRow = (lab, nodeId, actionId, action, origin, graphResult) => {
    const atom = action?.atomId ? atomById.get(action.atomId) : undefined;
    const effect = effectFor(action ?? { id: actionId, label: actionId, verb: "record", parameters: {}, evidence: [] }, atom);
    const procedural = effect.classes.some((value) => value === "apparatus-material-instrument-state" || value === "measurement-direct-observation-acquisition") || notebookSemanticConflict(action ?? { label: actionId }, action?.atomId, effect.interactionType);
    const composed = origin.kind === "technique-instance";
    const techniqueOrigin = composed || origin.kind === "technique-import";
    const customShim = ["green-chemistry-mixture-purification", "acid-base-titration-curves"].includes(lab.id);
    const sourceAtomicRow = techniqueOrigin ? atomicByTechniqueAction.get(`${origin.techniqueId}#${origin.sourceActionId ?? actionId}`) : undefined;
    const sourceClaims = sourceAtomicRow?.sourceDisposition?.applicableSourceClaims ?? sourceTraceMap.get(`lab:${lab.id}#${actionId}`) ?? [];
    const reachability = graphResult ?? { reachability: "mandatory", witnesses: [{ kind: composed ? "technique-instance" : "root-path", id: composed ? origin.instanceId : lab.process.startNodeId }] };
    const complianceVerdict = reachability.reachability === "dead" ? "dead-under-all-valid-configurations" : customShim ? "custom-route-shim" : techniqueOrigin ? "technique-origin procedure" : procedural ? "anonymous-local-procedure" : "allowed-orchestration";
    const candidates = techniqueOrigin ? [`${origin.techniqueId}@${origin.techniqueVersion}#${origin.sourceActionId ?? actionId}`] : techniqueActionCandidates.get(actionId) ?? [];
    const techniqueDecision = sourceAtomicRow?.techniqueMatchDecision ?? (techniqueOrigin ? "exact-compatible-version" : customShim ? "route-adapter-required" : procedural ? "blocked" : "not-required");
    const inheritedBlock = sourceAtomicRow?.atomicity?.verdict === "blocked-for-source/configuration" ? sourceAtomicRow.blockedReason : null;
    const block = inheritedBlock ?? (customShim ? `Cycle ${labOwner.get(lab.id)} must replace this route shim through the frozen adapter contract.` : !techniqueOrigin && procedural ? `Cycle ${labOwner.get(lab.id)} owns this anonymous procedure.` : null);
    const requiredRemediation = reachability.reachability === "dead" ? "Remove or explicitly disable the dead row after proving it is dead under every valid witness." : inheritedBlock ? `Do not approve ${nodeId} as a closed procedure step. Cycle ${labOwner.get(lab.id)} must resolve the imported action's source/configuration block while preserving public IDs.` : sourceAtomicRow?.atomicity?.verdict === "split" ? `Cycle ${labOwner.get(lab.id)} must replace ${actionId} with the audited ordered child operations and retain a documented compatibility mapping.` : customShim ? `Cycle ${labOwner.get(lab.id)} must replace the custom-route shim with the frozen compiled technique/evidence adapter.` : composed ? "Closed by compiler-issued exact-version technique-instance provenance." : origin.kind === "technique-import" ? "Migrate the action-only import to a technique instance in its owning cycle." : procedural ? `Cycle ${labOwner.get(lab.id)} must compose this physical action.` : "Retain as typed lab-local orchestration.";
    labRows.push({
      rowId: `${lab.id}#${nodeId}`, labId: lab.id, processId: "root", nodeId, actionId,
      reachability: reachability.reachability, validConfigurationApprovalWitnesses: reachability.witnesses,
      currentActionOrigin: origin,
      effect: { registryHandlerDerivedClasses: effect.classes, typedTargetDomains: effect.targets.map((target) => target.domain), flags: effect.flags, declaredVersusDerivedConflict: effect.conflict, resolvedInteractionType: effect.interactionType },
      complianceVerdict,
      techniqueMatchEscalation: { decision: techniqueDecision, candidates },
      laterOwnerCycle: labOwner.get(lab.id), sourceConflictOrConfigurationBlock: { sourceClaims, conflict: Boolean(sourceAtomicRow?.sourceDisposition?.conflict || effect.conflict.hasConflict), block },
      requiredRemediation,
    });
  };
  for (const entry of labIndex) {
    const lab = readJson(`public/labs/${entry.file ?? `${entry.id}.json`}`);
    const localById = new Map((lab.actions ?? []).map((action) => [action.id, action]));
    if (lab.techniqueInstances) {
      const rootGraph = graphEvidence(lab.process);
      for (const instance of lab.techniqueInstances) {
        const technique = techniqueById.get(instance.techniqueId);
        const techniqueGraph = graphEvidence(technique.process);
        const repeat = instance.repeat ?? 1;
        for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
          const scopeId = repeat === 1 ? instance.instanceId : `${instance.instanceId}--${repeatIndex + 1}`;
          const mappedNodeId = (sourceNodeId) => instance.preserveIds?.nodes?.[sourceNodeId] ?? `${scopeId}--${sourceNodeId}`;
          for (const node of technique.process.nodes) {
            const action = technique.actions.find((item) => item.id === node.actionId);
            const nodeId = mappedNodeId(node.id);
            const actionId = instance.preserveIds?.actions?.[action.id] ?? `${scopeId}--${action.id}`;
            const graphResult = techniqueGraph.classify(node.id);
            const mappedWitnesses = graphResult.witnesses.map((witness) => witness.kind === "start-node" ? { kind: "technique-instance", instanceId: scopeId, portId: "entry" } : { ...witness, fromNodeId: mappedNodeId(witness.fromNodeId) });
            pushLabRow(lab, nodeId, actionId, action, { kind: "technique-instance", techniqueId: technique.id, techniqueVersion: instance.version, instanceId: scopeId, sourceActionId: action.id }, { reachability: graphResult.reachability, witnesses: mappedWitnesses });
          }
        }
      }
      const usedLocal = new Set((lab.process.nodes ?? []).map((node) => node.actionId).filter(Boolean));
      for (const action of lab.actions ?? []) if (!usedLocal.has(action.id)) unreferencedDeclaredActions.push({ labId: lab.id, actionId: action.id, origin: "lab-local", techniqueId: null });
      for (const node of lab.process.nodes ?? []) if (node.actionId) pushLabRow(lab, node.id, node.actionId, localById.get(node.actionId), { kind: "lab-local" }, rootGraph.classify(node.id));
    } else {
      const imported = new Map();
      for (const ref of lab.techniqueRefs ?? []) {
        const technique = techniqueById.get(ref.techniqueId);
        const ids = ref.actionIds === "all" ? technique.actions.map((action) => action.id) : ref.actionIds;
        for (const actionId of ids) imported.set(actionId, { technique, action: technique.actions.find((item) => item.id === actionId), version: ref.version });
      }
      const rootGraph = graphEvidence(lab.process);
      const declared = new Map([...localById.entries()].map(([actionId]) => [actionId, { origin: "lab-local", techniqueId: null }]));
      for (const [actionId, source] of imported) declared.set(actionId, { origin: "technique-import", techniqueId: source.technique.id });
      const used = new Set((lab.process.nodes ?? []).map((node) => node.actionId).filter(Boolean));
      for (const [actionId, item] of declared) if (!used.has(actionId)) unreferencedDeclaredActions.push({ labId: lab.id, actionId, ...item });
      for (const node of lab.process.nodes ?? []) if (node.actionId) {
        const source = imported.get(node.actionId);
        pushLabRow(lab, node.id, node.actionId, source?.action ?? localById.get(node.actionId), source ? { kind: "technique-import", techniqueId: source.technique.id, techniqueVersion: source.version, sourceActionId: node.actionId } : { kind: "lab-local" }, rootGraph.classify(node.id));
      }
    }
  }
  const countBy = (values, keyOf) => Object.fromEntries([...values.reduce((counts, value) => {
    const key = keyOf(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
  return {
    atomicity: {
      schema: "lab-studio/technique-atomicity-audit@3",
      generatedAt: "2026-08-30T00:00:00.000Z",
      inventory: {
        indexedTechniques: techniqueIndex.length,
        actionRows: atomicRows.length,
        uniqueRowIds: new Set(atomicRows.map((row) => row.rowId)).size,
        verdictCounts: countBy(atomicRows, (row) => row.atomicity.verdict),
        sourceStatusCounts: countBy(atomicRows, (row) => row.coverage.sourceStatus),
        effectClassCounts: countBy(atomicRows.flatMap((row) => row.effect.registryHandlerDerivedClasses), (value) => value),
        effectConflictRows: atomicRows.filter((row) => row.effect.declaredVersusDerivedConflict.hasConflict).length,
      },
      rubric: {
        mandatoryRowSchema: ["actionLabel", "actionVerb", "reachableTechniqueNodeConsumers", "coverage", "effect", "atomicity", "sourceDisposition", "techniqueMatchDecision", "finalOwningCycle"],
        policy: "Every current exact-version action retains the full Cycle 01 reviewed source gate, handler-derived effect, atomicity decision, role coverage, and owner; Cycle 04's disclosed R/C foundations are the only reviewed source-gate exception.",
      },
      rows: atomicRows.sort((a, b) => a.rowId.localeCompare(b.rowId)),
    },
    labAudit: {
      schema: "lab-studio/lab-composition-audit@3",
      generatedAt: "2026-08-30T00:00:00.000Z",
      inventory: {
        indexedLabs: labIndex.length,
        nodeActionRows: labRows.length,
        uniqueRowIds: new Set(labRows.map((row) => row.rowId)).size,
        reachabilityCounts: countBy(labRows, (row) => row.reachability),
        originCounts: countBy(labRows, (row) => row.currentActionOrigin.kind),
        complianceCounts: countBy(labRows, (row) => row.complianceVerdict),
        unreferencedDeclaredActionCount: unreferencedDeclaredActions.length,
        effectClassCounts: countBy(labRows.flatMap((row) => row.effect.registryHandlerDerivedClasses), (value) => value),
        effectConflictRows: labRows.filter((row) => row.effect.declaredVersusDerivedConflict.hasConflict).length,
      },
      reachabilityPolicy: "Graph reachability is evaluated from each root or technique process start. A reachable row is mandatory when it is the start node or has a reachable validationPassed incoming edge; it is conditional only when every reachable incoming edge is retry/configuration/calculation-result gated; it is dead when no graph path reaches it.",
      rows: labRows.sort((a, b) => a.rowId.localeCompare(b.rowId)),
      unreferencedDeclaredActions: unreferencedDeclaredActions.sort((a, b) => `${a.labId}#${a.actionId}`.localeCompare(`${b.labId}#${b.actionId}`)),
    },
  };
};

const [kind, id] = process.argv.slice(2);
const output = kind === "technique" ? transformTechnique(id)
  : kind === "lab" ? transformLab(id)
  : kind === "registry" ? transformRegistry()
  : kind === "atomicity-audit" ? rebuildAudits().atomicity
  : kind === "lab-audit" ? rebuildAudits().labAudit
  : undefined;
if (!output) throw new Error("Usage: node scripts/cycle04TechniqueCompositionTransform.mjs technique <id> | lab <id> | registry | atomicity-audit | lab-audit [--write]");
const serialized = `${JSON.stringify(output, null, kind.endsWith("audit") ? 0 : 2)}\n`;
const writePathByKind = {
  registry: "src/domain/atomRegistry.json",
  "atomicity-audit": "planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json",
  "lab-audit": "planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json",
  ...(kind === "technique" && id ? { technique: `public/techniques/${id}.json` } : {}),
  ...(kind === "lab" && id ? { lab: `public/labs/${id}.json` } : {}),
};
if (process.argv.includes("--write")) {
  const path = writePathByKind[kind];
  if (!path) throw new Error(`--write is not supported for ${kind}.`);
  writeFileSync(join(root, path), serialized);
  console.log(`wrote ${path}`);
} else {
  process.stdout.write(serialized);
}
