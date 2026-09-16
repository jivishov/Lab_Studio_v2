import { readFileSync, writeFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const clone = (value) => structuredClone(value);
const only = process.argv.find((argument) => argument.startsWith("--only="))?.slice("--only=".length);
if (only !== undefined && only !== "marble") {
  throw new Error(`Unsupported targeted Cycle 08 output "${only}". Supported value: marble.`);
}

const paths = {
  marbleLab: "public/labs/marble-statue-kinetics.json",
  cvLab: "public/labs/crystal-violet-rate-law.json",
  marble: "public/techniques/marble-gas-syringe-kinetics.json",
  dilution: "public/techniques/crystal-violet-micromolar-dilution-series.json",
  calibration: "public/techniques/crystal-violet-spectrophotometer-calibration.json",
  analysis: "public/techniques/crystal-violet-integrated-rate-law-comparison.json",
  waste: "public/techniques/crystal-violet-waste-treatment.json",
  kinetics: "public/techniques/crystal-violet-kinetics.json",
};

const interactionType = (action) => action.interaction?.type ??
  (action.verb === "calculate" ? "submitCalculation" : "recordNotebook");

const effectForInteraction = (type, pedagogical = false) => {
  const contracts = {
    dragToZone: [["apparatus-material-instrument-state"], ["equipment"]],
    snapIntoTarget: [["apparatus-material-instrument-state"], ["equipment", "instrument"]],
    pourInto: [["apparatus-material-instrument-state"], ["equipment", "material"]],
    dispenseDrops: [["apparatus-material-instrument-state"], ["equipment", "material"]],
    spotOnto: [["apparatus-material-instrument-state"], ["equipment", "material"]],
    rinseTarget: [["apparatus-material-instrument-state"], ["equipment", "material"]],
    placeInInstrument: [["apparatus-material-instrument-state"], ["equipment", "instrument", "material"]],
    readInstrument: [["measurement-direct-observation-acquisition"], ["instrument", "measurement-observation", "evidence"]],
    recordTimeSeries: [["measurement-direct-observation-acquisition", "evidence-recording"], ["measurement-observation", "evidence"]],
    recordNotebook: [["evidence-recording"], ["evidence"]],
    submitCalculation: [["calculation-analysis"], ["analysis", "evidence"]],
  };
  const [classes, targets] = contracts[type];
  return {
    classes: [...classes, ...(pedagogical ? ["pedagogical-orchestration"] : [])],
    targets: targets.map((domain) => ({ domain })),
  };
};

const localize = (action) => ({
  ...clone(action),
  effect: effectForInteraction(interactionType(action), true),
});

const actionEffect = (action) => effectForInteraction(interactionType(action));

const evidenceOutput = (action) => {
  const type = interactionType(action);
  const kind = type === "recordTimeSeries" ? "data-series" :
    type === "readInstrument" ? "measurement" :
    type === "submitCalculation" ? "calculation" :
    type === "recordNotebook" ? "notebook" : "action-evidence";
  const referenceId = action.parameters.measurementId ?? action.parameters.dataSeriesId ?? action.parameters.calculationId;
  return { id: `evidence-${action.id}`, kind, actionId: action.id, ...(typeof referenceId === "string" ? { referenceId } : {}) };
};

const roleContract = (technique) => {
  const definitionsByRole = new Map();
  for (const action of technique.actions) {
    for (const [roleId, definitionId] of Object.entries(action.equipmentRoleBindings ?? {})) {
      const definitions = definitionsByRole.get(roleId) ?? new Set();
      definitions.add(definitionId);
      definitionsByRole.set(roleId, definitions);
    }
  }
  return [...definitionsByRole].map(([roleId, definitions]) => ({
    roleId,
    required: true,
    allowedDefinitionIds: [...definitions],
    sourceInstanceIds: technique.initialState.equipment
      .filter((item) => definitions.has(item.definitionId))
      .map((item) => item.id),
  }));
};

const modelContract = (technique) => [
  ...(technique.kineticsModels ?? []).map((model) => ({ id: `kinetics-${model.id}`, kind: "kinetics", sourceModelId: model.id, required: true })),
  ...(technique.titrationModels ?? []).map((model) => ({ id: `titration-${model.id}`, kind: "titration", sourceModelId: model.id, required: true })),
  ...(technique.chromatographyModels ?? []).map((model) => ({ id: `chromatography-${model.id}`, kind: "chromatography", sourceModelId: model.id, required: true })),
];

const setComposition = (technique, {
  version,
  configurationSlots = [],
  approvalGates = [],
  variants = [],
  orderedProcedure,
  presentationPaths = [],
  catalogDisposition = "lab-scoped",
  updatedAt = "2026-09-05T00:00:00.000Z",
}) => {
  technique.metadata.version = version;
  technique.metadata.updatedAt = updatedAt;
  technique.metadata.tags = [...new Set([...(technique.metadata.tags ?? []), "composition", "cycle-08"] )];
  for (const action of technique.actions) delete action.effect;
  technique.successCriteria = [];
  technique.composition = {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: technique.process.nodes[0].id },
      { id: "exit", kind: "exit", nodeId: technique.process.nodes.at(-1).id },
    ],
    equipmentRoles: roleContract(technique),
    modelSlots: modelContract(technique),
    configurationSlots,
    approvalGates,
    variants,
    evidenceOutputs: technique.actions.map(evidenceOutput),
    completion: { exitPortIds: ["exit"], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
    catalogDisposition,
    legacyActionEffects: technique.actions.filter((action) => !action.atomId).map((action) => ({ actionId: action.id, effect: actionEffect(action) })),
    ...(orderedProcedure ? { orderedProcedure } : {}),
    ...(presentationPaths.length > 0 ? { presentationPaths } : {}),
  };
  return technique;
};

const validationIds = (technique) => {
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (typeof value.id === "string" && typeof value.type === "string") ids.add(value.id);
      Object.values(value).forEach(visit);
    }
  };
  for (const action of technique.actions) visit(action.prerequisites);
  for (const node of technique.process.nodes) visit(node.validation);
  for (const rule of technique.successCriteria ?? []) visit(rule);
  return [...ids];
};

const referenceIds = (technique) => {
  const ids = new Set();
  const singular = /(?:Measurement|Calculation|Reference|Output|Progress|DataSeries)Ids?$|EvidenceId$|EvidenceScopeId$|NotebookTag$/i;
  const namedArrays = new Set(["sourceMeasurements", "timeMeasurements", "measuredComponentMassIds", "tareMassIds"]);
  const namedValues = new Set(["repeatGroupId", "nextScopeId", "pairId", "systemId"]);
  const visit = (value, key = "") => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if ((singular.test(key) || namedArrays.has(key)) && typeof item === "string") ids.add(item);
        else visit(item, key);
      }
    } else if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) {
        if ((singular.test(childKey) || namedValues.has(childKey)) && typeof child === "string" && !child.includes("{{config.")) ids.add(child);
        visit(child, childKey);
      }
    }
  };
  visit(technique);
  return [...ids];
};

const idPreservation = (technique) => ({
  actions: Object.fromEntries(technique.actions.map((action) => [action.id, action.id])),
  nodes: Object.fromEntries(technique.process.nodes.map((node) => [node.id, node.id])),
  validationRules: Object.fromEntries(validationIds(technique).map((id) => [id, id])),
  references: Object.fromEntries(referenceIds(technique).map((id) => [id, id])),
});

const bindingFor = (technique, lab, targetBySource = {}) => {
  const labEquipment = new Map(lab.initialState.equipment.map((item) => [item.id, item]));
  const equipmentBindings = {};
  for (const role of technique.composition.equipmentRoles) {
    const mappings = role.sourceInstanceIds.map((sourceInstanceId) => {
      const source = technique.initialState.equipment.find((item) => item.id === sourceInstanceId);
      const targetId = targetBySource[sourceInstanceId] ?? sourceInstanceId;
      const target = labEquipment.get(targetId);
      if (!source || !target) throw new Error(`Cannot bind ${technique.id}/${role.roleId}: ${sourceInstanceId} -> ${targetId}`);
      return { sourceInstanceId, definitionId: target.definitionId, instanceId: target.id };
    });
    if (mappings.length === 1) {
      equipmentBindings[role.roleId] = { definitionId: mappings[0].definitionId, instanceId: mappings[0].instanceId };
    } else {
      equipmentBindings[role.roleId] = { sourceInstances: mappings };
    }
  }
  return {
    equipment: equipmentBindings,
    models: Object.fromEntries(technique.composition.modelSlots.map((slot) => [slot.id, slot.sourceModelId])),
    configuration: {},
  };
};

const makeNode = (action, template) => ({
  ...(template ? clone(template) : {
    id: `${action.id}-node`, type: action.verb === "calculate" ? "calculation" : action.verb === "observe" || action.verb === "record" ? "observation" : "instruction",
    config: {}, hints: [],
  }),
  id: template?.id ?? `${action.id}-node`,
  title: action.label,
  description: action.stateChanges?.[0] ?? `${action.label} is complete.`,
  actionId: action.id,
  validation: template?.validation ?? [{ id: `${action.id}-complete`, type: "actionEvidence", label: `${action.label} was completed.`, actionId: action.id }],
  feedback: template?.feedback ?? { success: `${action.label} complete.`, retry: `Review ${action.label.toLowerCase()} and try again.` },
});

const linearProcess = (actions, oldNodes = []) => {
  const oldByAction = new Map(oldNodes.map((node) => [node.actionId, node]));
  const nodes = actions.map((action) => makeNode(action, oldByAction.get(action.id)));
  return {
    startNodeId: nodes[0].id,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id, label: "Next", condition: { type: "validationPassed" } })),
  };
};

const localProcess = (oldProcess, segmentActionIds) => {
  const oldByAction = new Map(oldProcess.nodes.map((node) => [node.actionId, node]));
  const actionIds = segmentActionIds.flat();
  const nodes = actionIds.map((id) => clone(oldByAction.get(id)));
  if (nodes.some((node) => !node)) throw new Error("Missing local process node during Cycle 08 migration");
  const edges = segmentActionIds.flatMap((segment) => segment.slice(1).map((id, index) => ({
    from: oldByAction.get(segment[index]).id,
    to: oldByAction.get(id).id,
    label: "Next",
    condition: { type: "validationPassed" },
  })));
  return { startNodeId: nodes[0].id, nodes, edges };
};

const mapPreservation = (technique, actionMap, nodeMap = {}) => ({
  actions: actionMap,
  nodes: Object.fromEntries(technique.process.nodes
    .filter((node) => actionMap[node.actionId])
    .map((node) => [node.id, nodeMap[node.id] ?? `${actionMap[node.actionId]}-node`])),
  validationRules: {},
  references: {},
});

const endpoint = (instanceId, portId) => ({ kind: "technique-port", instanceId, portId });
const labNode = (nodeId) => ({ kind: "lab-node", nodeId });
const connection = (id, from, to, label = "Next", enabledWhen) => ({
  id, from, to, label, condition: { type: "validationPassed" }, ...(enabledWhen ? { enabledWhen } : {}),
});

// Marble technique: split the instrument read from its notebook record and put timer arming
// before the first physical contact. Exact locking/trigger geometry remains teacher-confirmed C.
const marble = readJson(paths.marble);
if (!["1.1.0", "2.0.0", "2.1.0"].includes(marble.metadata.version)) throw new Error(`Expected marble technique 1.1.0, 2.0.0 or 2.1.0, found ${marble.metadata.version}`);
const marbleOldNodes = clone(marble.process.nodes);
const connect = marble.actions.find((action) => action.id === "gas-technique-connect-syringe");
connect.parameters.beginEvidenceScopeId = "{{config.evidenceScopeId}}";
const zero = marble.actions.find((action) => action.id === "gas-technique-zero-syringe");
zero.label = "Read the gas-syringe baseline and instrument scale";
zero.parameters = {
  ...zero.parameters,
  // The notebook tag is per-instance configuration: a technique-local literal would be rewritten
  // in the validation rules but not in this parameter, so replicate trials would either share one
  // evidence identity or gate on a tag no handler ever writes.
  tag: "{{config.zeroNotebookTag}}",
  measurementId: "gas-technique-syringe-baseline",
  label: "Gas-syringe starting volume",
  unit: "mL",
  // `observe` records a measurement only on the numeric-input path; without it the declared
  // measurementId is decorative and the following copy-only record can never run.
  inputMode: "numeric",
  inputRole: "studentResponse",
  inputLabel: "Gas-syringe starting volume read from the barrel",
  inputMin: 0,
  inputMax: "{{config.instrumentCapacityMl}}",
  inputStep: "{{config.instrumentGraduationMl}}",
  instrumentCapacityMl: "{{config.instrumentCapacityMl}}",
  instrumentGraduationMl: "{{config.instrumentGraduationMl}}",
  readingProvenance: "student instrument read",
};
zero.stateChanges = ["A fresh syringe starting-volume observation is available; it is not yet a notebook baseline."];
const recordZero = {
  id: "gas-technique-record-zero-baseline",
  verb: "record",
  label: "Record the gas-syringe baseline and readable scale",
  parameters: {
    measurementId: "gas-technique-syringe-baseline",
    label: "Gas-syringe starting volume",
    unit: "mL",
    copyExistingMeasurementOnly: true,
    instrumentCapacityMl: "{{config.instrumentCapacityMl}}",
    instrumentGraduationMl: "{{config.instrumentGraduationMl}}",
  },
  interaction: { type: "recordNotebook", valueParameter: "measurementId", accessibleLabel: "Copy the observed syringe baseline and record its readable scale.", successCue: "The baseline is recorded separately from the instrument read.", invalidCue: "Read the syringe before recording its baseline." },
  prerequisites: [{ id: "gas-technique-baseline-read-required", type: "measurementRecorded", label: "The gas-syringe starting volume was read.", measurementId: "gas-technique-syringe-baseline" }],
  stateChanges: ["The observed start, capacity, and graduation are recorded as the run baseline."],
  invalidCases: clone(zero.invalidCases),
  feedback: { success: "The gas-syringe baseline is recorded.", invalid: "Read the syringe and its scale before recording the baseline." },
  evidence: ["record", "measurement", "gas-syringe-baseline"],
};
const pathCheck = marble.actions.find((action) => action.id === "gas-technique-check-path");
pathCheck.label = "Verify the nonblocked expanding gas path";
pathCheck.parameters.note = "Before reactant contact, verify every connection is present, tubing is not kinked, the recorded baseline still stands, and the syringe plunger can expand freely. Reject a missing connection separately from a blocked pressure hazard; exact locking geometry remains teacher-confirmed.";
pathCheck.parameters.safetyState = "nonblocked-expanding-path-verified-before-contact";
pathCheck.parameters.tag = "{{config.pathCheckNotebookTag}}";
pathCheck.prerequisites = [{
  id: "technique-zero-required",
  type: "actionEvidence",
  label: "The gas syringe baseline is recorded.",
  actionId: "gas-technique-record-zero-baseline",
}];
pathCheck.invalidCases = [...pathCheck.invalidCases.filter((item) => item.id !== "blocked-gas-path"), {
  id: "blocked-gas-path",
  when: "the tubing is kinked, the plunger cannot expand, or a rigid closed volume would trap generated gas",
  message: "Do not initiate gas generation against a blocked or non-expanding path.",
  recovery: "Keep reactants separated, open or reconfigure the collection path, then repeat the path and baseline checks.",
}];
const sync = marble.actions.find((action) => action.id === "gas-technique-synchronize-start");
sync.label = "Arm the timer and define first contact as time zero";
sync.interaction = { type: "recordNotebook", valueParameter: "note", accessibleLabel: "Record the approved contact-defined time-zero rule before initiating the reaction.", successCue: "The timer is armed before contact.", invalidCue: "Define and arm the time-zero rule before allowing reactant contact." };
sync.parameters.note = "Arm the timer before the reactants meet. The first physical contact of the weighed marble with acid is the reaction-start and timer-start event; the first series row is the configured time-zero evidence. Exact trigger or locking geometry remains teacher-confirmed.";
sync.parameters.tag = "{{config.reactionStartNotebookTag}}";
sync.parameters.exactTriggerGeometry = "teacher-confirmed; not inferred";
sync.prerequisites = [
  { id: "technique-timer-arm-needs-marble-mass", type: "measurementRecorded", label: "The marble mass is recorded while reactants remain separate.", measurementId: "gas-technique-marble-mass" },
  { id: "technique-timer-arm-needs-safe-path", type: "notebookEntry", label: "The nonblocked expanding gas path is verified.", notebookTag: "{{config.pathCheckNotebookTag}}" },
];
sync.stateChanges = ["The timer is armed and the approved first-contact time-zero rule is recorded while reactants remain separate."];
const measureAcid = marble.actions.find((action) => action.id === "gas-technique-measure-acid");
measureAcid.parameters.volumeMl = "{{config.acidVolumeMl}}";
measureAcid.parameters.tolerance = "{{config.acidVolumeToleranceMl}}";
const transferAcid = marble.actions.find((action) => action.id === "gas-technique-transfer-acid");
transferAcid.parameters.volumeMl = "{{config.acidVolumeMl}}";
const weighMarble = marble.actions.find((action) => action.id === "gas-technique-weigh-marble");
weighMarble.parameters.sourceDefinitionId = "watch-glass";
weighMarble.parameters.inputMode = "numeric";
// The value is the learner's own balance reading, so the declared role must say so. The runtime
// already resolves an absent role to `studentResponse`; declaring it changes no input path and
// stops the declaration from disagreeing with the reading the action actually collects.
weighMarble.parameters.inputRole = "studentResponse";
weighMarble.parameters.inputLabel = "Marble-chip mass shown on the tared watch glass";
weighMarble.parameters.inputMin = 0.001;
weighMarble.parameters.inputStep = 0.001;
weighMarble.parameters.unit = "g";
weighMarble.parameters.inputRequired = true;
// The continuity-aware output is the one learner-entered balance reading.  Do not
// leave a legacy measurement id or configured expected value that an interaction
// could silently substitute for that evidence.
delete weighMarble.parameters.measurementId;
delete weighMarble.parameters.expectedMassG;
weighMarble.parameters.tolerance = "{{config.marbleMassToleranceG}}";
weighMarble.interaction.sourceDefinitionId = "watch-glass";
delete weighMarble.interaction.valueParameter;
weighMarble.equipmentRoleBindings = {
  ...weighMarble.equipmentRoleBindings,
  "weighed-vessel": "watch-glass",
};
weighMarble.mass = {
  source: "action-input",
  outputMeasurementId: "gas-technique-marble-mass",
  continuity: {
    version: 1,
    quantityKind: "material-portion",
    measuredSupportInstanceId: "technique-watch-glass",
    materialSourceInstanceId: "technique-marble-chips",
  },
};
weighMarble.stateChanges = ["Record the displayed {{presentation.marbleTarget}} marble-chip portion on the tared watch glass; the chip stock is not depleted until the portion is transferred."];
const contact = marble.actions.find((action) => action.id === "gas-technique-transfer-marble");
contact.label = "Initiate the reaction by adding the weighed marble to acid";
delete contact.parameters.massG;
delete contact.interaction.valueParameter;
contact.mass = {
  source: "measurement",
  referenceId: "gas-technique-marble-mass",
  continuity: {
    version: 1,
    quantityKind: "material-portion",
    producerActionId: "gas-technique-weigh-marble",
    measuredSupportInstanceId: "technique-watch-glass",
    materialSourceInstanceId: "technique-marble-chips",
  },
};
contact.parameters.reactionStartTrigger = "first-reactant-contact";
contact.parameters.timerStartsAtContact = true;
contact.parameters.timeZeroEvidence = "first row of guided-marble-gas-series";
contact.parameters.exactTriggerGeometry = "teacher-confirmed; not inferred";
contact.prerequisites = [
  ...contact.prerequisites.filter((rule) => rule.id !== "technique-timer-armed-before-contact-required"),
  { id: "technique-timer-armed-before-contact-required", type: "notebookEntry", label: "The timer is armed and first contact is defined as time zero.", notebookTag: "{{config.reactionStartNotebookTag}}" },
];
contact.prerequisites = contact.prerequisites.map((rule) => rule.id === "technique-marble-mass-required"
  ? {
      ...rule,
      measurementContinuity: {
        version: 1,
        quantityKind: "material-portion",
        producerActionId: "gas-technique-weigh-marble",
        measuredSupportInstanceId: "technique-watch-glass",
        materialSourceInstanceId: "technique-marble-chips",
      },
    }
  : rule);
contact.parameters.note = "Transfer the exact {{presentation.marbleTarget}} balance reading into {{presentation.acidAmount}} of acid. This depletes the marble-chip stock only at transfer; it does not use a configured runtime mass fallback.";
contact.stateChanges = ["The first marble-acid contact starts the reaction and timer at the same defined time-zero event."];
const seat = marble.actions.find((action) => action.id === "gas-technique-seat-stopper");
seat.parameters.safetyPath = "previously verified nonblocked expanding path";
seat.parameters.exactLockingGeometry = "teacher-confirmed; not inferred";
const series = marble.actions.find((action) => action.id === "gas-technique-record-series");
series.parameters.conditionId = "guided-configuration";
series.parameters.dataSeriesId = "guided-marble-gas-series";
series.parameters.label = "{{config.seriesLabel}}";
series.parameters.instrumentGraduationMl = "{{config.instrumentGraduationMl}}";
series.parameters.samplingIntervalS = "{{config.samplingIntervalS}}";
series.parameters.rateIntervalS = "{{config.rateIntervalS}}";
series.parameters.firstRecordedTimeS = 0;
series.parameters.timeZeroProvenance = "first-reactant-contact";
series.parameters.evidenceLayer = "raw-simulator-generated-time-series";
series.parameters.note = "Record gas volume every {{presentation.samplingInterval}} and calculate the initial rate over {{presentation.rateWindow}}.";
series.mass = {
  source: "measurement",
  referenceId: "gas-technique-marble-mass",
  continuity: {
    version: 1,
    quantityKind: "material-portion",
    producerActionId: "gas-technique-weigh-marble",
    measuredSupportInstanceId: "technique-watch-glass",
    materialSourceInstanceId: "technique-marble-chips",
  },
};
const calculate = marble.actions.find((action) => action.id === "gas-technique-calculate-rate");
calculate.interaction = { type: "submitCalculation", valueParameter: "calculationId", accessibleLabel: "Calculate a rate from the separately recorded raw series.", successCue: "The rate is derived from the selected evidence interval.", invalidCue: "Record the raw series before calculating a rate." };
calculate.parameters.dataSeriesId = "guided-marble-gas-series";
calculate.parameters.intervalS = "{{config.rateIntervalS}}";
const review = marble.actions.find((action) => action.id === "gas-technique-review-limits");
review.interaction = { type: "recordNotebook", valueParameter: "note", accessibleLabel: "Record limits of the simulator series and derived rate.", successCue: "Evidence and model limits are recorded.", invalidCue: "Separate raw series evidence from the rate calculation and model assumptions." };
review.prerequisites = [{
  id: "technique-rate-calculation-required",
  type: "actionEvidence",
  label: "The derived rate calculation is recorded.",
  actionId: "gas-technique-calculate-rate",
}];
const originalOrder = marble.actions;
const byId = new Map(originalOrder.map((action) => [action.id, action]));
marble.actions = [
  byId.get("gas-technique-connect-syringe"), zero, recordZero, pathCheck,
  measureAcid, transferAcid, weighMarble, sync, contact, seat, series, calculate, review,
];
marble.process = linearProcess(marble.actions, marbleOldNodes);
const marbleSyncNode = marble.process.nodes.find((node) => node.actionId === "gas-technique-synchronize-start");
if (marbleSyncNode) marbleSyncNode.validation = [{
  id: "synchronize-start-done",
  type: "notebookEntry",
  label: "Synchronized start recorded.",
  notebookTag: "{{config.reactionStartNotebookTag}}",
}];
sync.prerequisites = sync.prerequisites.map((rule) => rule.id === "technique-timer-arm-needs-marble-mass"
  ? {
      ...rule,
      measurementContinuity: {
        version: 1,
        quantityKind: "material-portion",
        producerActionId: "gas-technique-weigh-marble",
        measuredSupportInstanceId: "technique-watch-glass",
        materialSourceInstanceId: "technique-marble-chips",
      },
    }
  : rule);
const marbleSeriesNode = marble.process.nodes.find((node) => node.actionId === "gas-technique-record-series");
if (marbleSeriesNode) marbleSeriesNode.validation = [{
  id: "record-series-done",
  type: "dataSeriesRecorded",
  label: "Guided gas-volume series recorded.",
  dataSeriesId: "guided-marble-gas-series",
}];
// Every marble notebook identity is per-instance configuration. The compiler rewrites a
// technique-local literal inside `notebookTag` rules but leaves `parameters.tag` alone, so a
// literal tag either collides across replicate trials (when an instance preserves it) or gates on
// a scoped tag no handler ever writes (when it does not). Binding both sides to the same
// configuration slot keeps writer and gate identical and keeps each trial's evidence separate.
const marbleNotebookTagSlots = {
  "gas-technique-zero": "{{config.zeroNotebookTag}}",
  "gas-technique-path-check": "{{config.pathCheckNotebookTag}}",
  "gas-technique-reaction-start-armed": "{{config.reactionStartNotebookTag}}",
  "gas-technique-evidence-limits": "{{config.evidenceLimitsNotebookTag}}",
};
const configuredMarbleTag = (value) => marbleNotebookTagSlots[value] ?? value;
for (const action of marble.actions) {
  if (typeof action.parameters.tag === "string") action.parameters.tag = configuredMarbleTag(action.parameters.tag);
  for (const rule of action.prerequisites ?? []) {
    if (typeof rule.notebookTag === "string") rule.notebookTag = configuredMarbleTag(rule.notebookTag);
  }
}
for (const marbleNode of marble.process.nodes) {
  for (const rule of marbleNode.validation ?? []) {
    if (typeof rule.notebookTag === "string") rule.notebookTag = configuredMarbleTag(rule.notebookTag);
  }
}
const marbleZeroNode = marble.process.nodes.find((node) => node.actionId === "gas-technique-zero-syringe");
if (marbleZeroNode) marbleZeroNode.validation[0].label = "The gas-syringe starting volume is read.";

const marbleConfigurationSlots = [
  ["selectedProcedure", "string", ["trial-acquisition", "rate-analysis"]],
  ["acidVolumeMl", "number"], ["acidVolumeToleranceMl", "number"],
  ["marbleMassG", "number"], ["marbleMassToleranceG", "number"],
  ["seriesLabel", "string"],
  ["instrumentCapacityMl", "number"], ["instrumentGraduationMl", "number"],
  ["samplingIntervalS", "number"], ["rateIntervalS", "number"],
  ["evidenceScopeId", "string"],
  ["zeroNotebookTag", "string"], ["pathCheckNotebookTag", "string"],
  ["reactionStartNotebookTag", "string"], ["evidenceLimitsNotebookTag", "string"],
].map(([id, valueType, allowedValues]) => ({ id, valueType, required: true, ...(allowedValues ? { allowedValues } : {}) }));
setComposition(marble, {
  version: "2.1.0",
  updatedAt: "2026-09-06T00:00:00.000Z",
  configurationSlots: marbleConfigurationSlots,
  presentationPaths: ["label", "description", "parameters.note", "stateChanges.*"],
  orderedProcedure: {
    configurationSlotId: "selectedProcedure", startActionIds: [], endActionIds: [], minimumTests: 1, resources: [],
    groups: [
      { id: "trial-acquisition", actionIds: marble.actions.slice(0, 11).map((action) => action.id), testCount: 1, evidenceKind: "quantitative" },
      { id: "rate-analysis", actionIds: marble.actions.slice(11).map((action) => action.id), testCount: 1, evidenceKind: "procedure" },
    ],
  },
});

// Crystal-violet full-phase techniques gain explicit contracts. The calibration preparation
// labels are narrowed to the notebook evidence their handler actually records.
const dilution = readJson(paths.dilution);
setComposition(dilution, { version: "1.2.0" });

const calibration = readJson(paths.calibration);
for (const action of calibration.actions.filter((item) => item.id.startsWith("cv11-condition-cuvette-"))) {
  const concentration = action.id.split("-").at(-1);
  action.label = `Record optical-face preparation for the ${Number(concentration)} micromolar cuvette`;
  action.parameters.note = `Record the teacher-approved conditioning, wiping, and orientation rule for the ${Number(concentration)} micromolar cuvette. This notebook action does not fill the cuvette; the separate following transfer does.`;
  action.parameters.evidenceBoundary = "records the teacher rule; does not claim a physical fill";
  action.stateChanges = ["The teacher-approved optical handling rule is recorded for this cuvette; its fill remains a separate operation."];
}
setComposition(calibration, { version: "1.2.0" });

const cvLabOriginal = readJson(paths.cvLab);
const carrier = cvLabOriginal.techniques.find((item) => item.id === "crystal-violet-hydroxide-order-extension");
if (!carrier) throw new Error("Missing historical crystal-violet hydroxide-order carrier");

const analysis = readJson(paths.analysis);
analysis.actions = analysis.actions.filter((action) => !carrier.actions.some((item) => item.id === action.id));
for (const action of analysis.actions) {
  delete action.parameters.expected;
  delete action.parameters.slope;
  delete action.parameters.selectedTransform;
  if (["cv11-select-order-w", "cv11-calculate-k-star"].includes(action.id)) delete action.parameters.tolerance;
  action.parameters.evidenceBoundary = "derived from recorded calibration and kinetic evidence; no expected model result is stored";
}
const compare = analysis.actions.find((action) => action.id === "cv11-compare-integrated-rate-law-fits");
compare.label = "Record the comparison of all three least-squares fits";
compare.parameters.sourceCalculationIds = ["cv11-zero-order-fit", "cv11-first-order-fit", "cv11-second-order-fit"];
compare.parameters.note = "Record a comparison of equations, residual patterns, and fit metrics already calculated for [CV+], ln[CV+], and 1/[CV+] versus time before selecting w. This evidence action does not perform the regressions.";
compare.stateChanges = ["A source-grounded comparison of the three completed candidate fits is recorded."];
const extensionActions = clone(carrier.actions);
extensionActions[0].parameters = {
  ...extensionActions[0].parameters,
  note: "This instance is emitted only by the declared teacher-approved witness. Record the approval and the method boundary before proposing hydroxide conditions.",
  tag: "optional-extension-gate",
  approvalBinding: "analysis-extension.teacher-approved=true",
  recovery: "Leave the extension absent and continue to waste handling when approval is false.",
};
delete extensionActions[0].parameters.unlocked;
extensionActions[1].prerequisites = [{ id: "extension-approval-required", type: "actionEvidence", label: "Teacher approval for the optional extension is recorded.", actionId: extensionActions[0].id }];
extensionActions[2].prerequisites = [{ id: "extension-design-required", type: "actionEvidence", label: "The approved hydroxide-variation design is recorded.", actionId: extensionActions[1].id }];
analysis.actions = [...analysis.actions, ...extensionActions];
analysis.process = linearProcess(analysis.actions, [...analysis.process.nodes, ...carrier.process.nodes]);
setComposition(analysis, {
  version: "2.0.0",
  configurationSlots: [{ id: "selectedProcedure", valueType: "string", required: true, allowedValues: ["integrated-rate-law-analysis", "hydroxide-order-extension"] }],
  approvalGates: [{ id: "teacher-approved", label: "Teacher approved the optional hydroxide-order method" }],
  variants: [{ id: "hydroxide-order-extension", label: "Teacher-approved hydroxide-order extension", enabledWhen: { kind: "approval", gateId: "teacher-approved", equals: true } }],
  orderedProcedure: {
    configurationSlotId: "selectedProcedure", startActionIds: [], endActionIds: [], minimumTests: 1, resources: [],
    groups: [
      { id: "integrated-rate-law-analysis", actionIds: analysis.actions.slice(0, 8).map((action) => action.id), testCount: 1, evidenceKind: "quantitative" },
      { id: "hydroxide-order-extension", actionIds: analysis.actions.slice(8).map((action) => action.id), testCount: 1, evidenceKind: "procedure" },
    ],
  },
});

const waste = readJson(paths.waste);
const removeKineticCuvette = clone(
  cvLabOriginal.actions.find((action) => action.id === "cv11-remove-kinetic-cuvette") ??
  waste.actions.find((action) => action.id === "cv11-remove-kinetic-cuvette"),
);
if (!removeKineticCuvette) throw new Error("Missing kinetic cuvette cleanup action");
for (const id of ["cv11-kinetic-cuvette", "cv11-spectrophotometer"]) {
  if (!waste.initialState.equipment.some((item) => item.id === id)) {
    waste.initialState.equipment.push(clone(cvLabOriginal.initialState.equipment.find((item) => item.id === id)));
  }
}
waste.requiredEquipment = [...new Set([...waste.requiredEquipment, "cuvette", "spectrophotometer"])];
waste.actions = [removeKineticCuvette, ...waste.actions.filter((action) => action.id !== removeKineticCuvette.id)];
waste.process = linearProcess(waste.actions, [
  cvLabOriginal.process.nodes.find((node) => node.actionId === "cv11-remove-kinetic-cuvette"),
  ...waste.process.nodes,
].filter(Boolean));
setComposition(waste, { version: "1.2.0" });

const kinetics = readJson(paths.kinetics);
if (!kinetics.composition || kinetics.metadata.version !== "1.2.0") throw new Error("Run targeted crystal-violet-kinetics generation before the migration");

// Marble lab composition. Every condition receives fresh configured apparatus and a complete
// acquisition instance; only inquiry, evidence interpretation, and calculation remain lab-local.
const marbleLab = readJson(paths.marbleLab);
const equipmentById = new Map(marbleLab.initialState.equipment.map((item) => [item.id, item]));
const appendClone = (sourceId, id, label, contents) => {
  if (equipmentById.has(id)) return;
  const item = clone(equipmentById.get(sourceId));
  item.id = id;
  item.label = label;
  if (contents) item.contents = contents;
  marbleLab.initialState.equipment.push(item);
  equipmentById.set(id, item);
};
for (const trial of ["acid-2m", "acid-4m", "acid-6m"]) {
  appendClone("graduated-cylinder-1", `${trial}-graduated-cylinder`, `${trial} graduated cylinder`);
  appendClone("erlenmeyer-flask-250ml-1", `${trial}-reaction-flask`, `${trial} reaction flask`);
  appendClone("rubber-stopper-delivery-tube-1", `${trial}-delivery-stopper`, `${trial} stopper and delivery tube`);
  appendClone("gas-syringe-1", `${trial}-gas-syringe`, `${trial} gas syringe`);
}
for (const [condition, concentration] of [["acid-2m", 2], ["acid-6m", 6]]) {
  const contents = clone(equipmentById.get("hcl-bottle-1").contents);
  contents.label = `${concentration.toFixed(1)} M hydrochloric acid`;
  contents.concentration.value = concentration;
  if (contents.solutes[0]) contents.solutes[0].amount = concentration * contents.volumeMl / 1000;
  appendClone("hcl-bottle-1", `${condition}-hcl-bottle`, `${concentration.toFixed(1)} M HCl (teacher-configured)`, contents);
}
if (!marbleLab.kineticsModels.some((model) => model.id === "marble-model-practice")) {
  const authoredMarbleModel = clone(marbleLab.kineticsModels[0]);
  const configuredModel = (id, sourceConditionId) => {
    const model = clone(authoredMarbleModel);
    const condition = clone(model.conditions.find((item) => item.id === sourceConditionId));
    condition.id = "guided-configuration";
    model.id = id;
    model.conditions = [condition];
    model.defaultVariable = condition.variable;
    model.controlled = {
      ...model.controlled,
      acidConcentrationM: condition.acidConcentrationM,
      chipSize: condition.chipSize,
      temperatureC: condition.temperatureC,
    };
    return model;
  };
  marbleLab.kineticsModels = [
    configuredModel("marble-model-practice", "acid-4m"),
    configuredModel("marble-model-acid-2m", "acid-2m"),
    configuredModel("marble-model-acid-4m", "acid-4m"),
    configuredModel("marble-model-acid-6m", "acid-6m"),
  ];
}

const practiceActionMap = {
  "gas-technique-connect-syringe": "connect-gas-syringe",
  "gas-technique-zero-syringe": "zero-gas-syringe",
  "gas-technique-record-zero-baseline": "record-gas-syringe-baseline",
  "gas-technique-check-path": "verify-safe-gas-path",
  "gas-technique-measure-acid": "measure-practice-acid",
  "gas-technique-transfer-acid": "transfer-practice-acid",
  "gas-technique-weigh-marble": "weigh-practice-marble",
  "gas-technique-synchronize-start": "record-synchronized-reaction-start",
  "gas-technique-transfer-marble": "transfer-practice-marble",
  "gas-technique-seat-stopper": "assemble-gas-apparatus",
  "gas-technique-record-series": "record-practice-run",
};
const marbleSourceEquipment = {
  "technique-hcl-bottle": "hcl-bottle-1",
  "technique-graduated-cylinder": "graduated-cylinder-1",
  "technique-reaction-flask": "erlenmeyer-flask-250ml-1",
  "technique-delivery-stopper": "rubber-stopper-delivery-tube-1",
  "technique-gas-syringe": "gas-syringe-1",
  "technique-marble-chips": "marble-chips-1",
  "technique-balance": "analytical-balance-1",
  "technique-watch-glass": "watch-glass-1",
  "technique-stopwatch": "stopwatch-1",
};
const marbleConfig = (selectedProcedure, seriesLabel, evidenceScope) => ({
  selectedProcedure,
  acidVolumeMl: 50,
  acidVolumeToleranceMl: 1,
  marbleMassG: 1.3,
  marbleMassToleranceG: 0.05,
  seriesLabel,
  instrumentCapacityMl: 100,
  instrumentGraduationMl: 1,
  samplingIntervalS: 5,
  rateIntervalS: 15,
  evidenceScopeId: evidenceScope,
  // Distinct per run so one trial's zero, path check, start or limits note cannot satisfy another's gate.
  zeroNotebookTag: `${evidenceScope}-syringe-zero`,
  pathCheckNotebookTag: `${evidenceScope}-gas-path-check`,
  reactionStartNotebookTag: `${evidenceScope}-reaction-start`,
  evidenceLimitsNotebookTag: `${evidenceScope}-evidence-limits`,
});
const marblePresentation = {
  acidAmount: "50 mL of hydrochloric acid",
  marbleTarget: "1.30 g",
  samplingInterval: "5 s",
  rateWindow: "0–15 s",
};
const marbleInstance = (instanceId, selectedProcedure, seriesLabel, targets, modelId, preserveIds, evidenceScope) => {
  const bindings = bindingFor(marble, marbleLab, targets);
  bindings.configuration = marbleConfig(selectedProcedure, seriesLabel, evidenceScope ?? instanceId);
  bindings.presentation = marblePresentation;
  bindings.models = { [`kinetics-${marble.kineticsModels[0].id}`]: modelId };
  return { instanceId, techniqueId: marble.id, version: marble.metadata.version, bindings, ...(preserveIds ? { preserveIds } : {}) };
};
const trialTargets = (prefix, acidBottle) => ({
  ...marbleSourceEquipment,
  "technique-hcl-bottle": acidBottle,
  "technique-graduated-cylinder": `${prefix}-graduated-cylinder`,
  "technique-reaction-flask": `${prefix}-reaction-flask`,
  "technique-delivery-stopper": `${prefix}-delivery-stopper`,
  "technique-gas-syringe": `${prefix}-gas-syringe`,
});
const practicePreserve = mapPreservation(marble, practiceActionMap, {
  "gas-technique-zero-syringe-node": "zero-gas-syringe-node",
  "gas-technique-record-zero-baseline-node": "record-gas-syringe-baseline-node",
});
practicePreserve.references = {
  "gas-technique-acid-volume": "practice-hcl-volume",
  "gas-technique-marble-mass": "marble-mass",
  "gas-technique-syringe-baseline": "gas-syringe-baseline",
  "guided-marble-gas-series": "practice-gas-series",
  "guided-marble-initial-rate": "guided-marble-initial-rate",
};
const marbleInstances = [
  marbleInstance("practice-trial", "trial-acquisition", "Practice run: 4.0 M HCl", marbleSourceEquipment, "marble-model-practice", practicePreserve, "practice"),
  marbleInstance("acid-2m-trial", "trial-acquisition", "2.0 M HCl", trialTargets("acid-2m", "acid-2m-hcl-bottle"), "marble-model-acid-2m", {
    actions: { "gas-technique-record-series": "record-acid-2m-run" },
    nodes: { "gas-technique-record-series-node": "record-acid-2m-run-node" }, validationRules: {}, references: { "guided-marble-gas-series": "acid-2m-gas-series" },
  }),
  marbleInstance("acid-4m-trial", "trial-acquisition", "4.0 M HCl", trialTargets("acid-4m", "hcl-bottle-1"), "marble-model-acid-4m", {
    actions: { "gas-technique-record-series": "record-acid-4m-run" },
    nodes: { "gas-technique-record-series-node": "record-acid-4m-run-node" }, validationRules: {}, references: { "guided-marble-gas-series": "acid-4m-gas-series" },
  }),
  marbleInstance("acid-6m-trial", "trial-acquisition", "6.0 M HCl", trialTargets("acid-6m", "acid-6m-hcl-bottle"), "marble-model-acid-6m", {
    actions: { "gas-technique-record-series": "record-acid-6m-run" },
    nodes: { "gas-technique-record-series-node": "record-acid-6m-run-node" }, validationRules: {}, references: { "guided-marble-gas-series": "acid-6m-gas-series" },
  }),
];
for (const [suffix, seriesId, calculationId, targets, modelId] of [
  ["2m", "acid-2m-gas-series", "acid-2m-initial-rate", trialTargets("acid-2m", "acid-2m-hcl-bottle"), "marble-model-acid-2m"],
  ["4m", "acid-4m-gas-series", "acid-4m-initial-rate", trialTargets("acid-4m", "hcl-bottle-1"), "marble-model-acid-4m"],
  ["6m", "acid-6m-gas-series", "acid-6m-initial-rate", trialTargets("acid-6m", "acid-6m-hcl-bottle"), "marble-model-acid-6m"],
]) {
  marbleInstances.push(marbleInstance(`acid-${suffix}-rate-analysis`, "rate-analysis", `${suffix.toUpperCase()} rate analysis`, targets, modelId, {
    actions: { "gas-technique-calculate-rate": `calculate-acid-${suffix}-rate` },
    nodes: { "gas-technique-calculate-rate-node": `calculate-acid-${suffix}-rate-node` },
    validationRules: {},
    references: {
      "guided-marble-gas-series": seriesId,
      "guided-marble-initial-rate": calculationId,
    },
  }));
}
const marbleImported = new Set([
  "connect-gas-syringe", "zero-gas-syringe", "verify-safe-gas-path", "measure-practice-acid", "transfer-practice-acid",
  "weigh-practice-marble", "transfer-practice-marble", "assemble-gas-apparatus", "record-synchronized-reaction-start",
  "record-practice-run", "record-acid-2m-run", "record-acid-4m-run", "record-acid-6m-run",
  "calculate-acid-2m-rate", "calculate-acid-4m-rate", "calculate-acid-6m-rate",
]);
const marbleLocalIds = marbleLab.actions.map((action) => action.id).filter((id) => !marbleImported.has(id));
marbleLab.actions = marbleLab.actions.filter((action) => marbleLocalIds.includes(action.id)).map((action) => {
  const result = localize(action);
  result.prerequisites = result.prerequisites.filter((rule) => !["dataSeriesRecorded", "calculationWithinTolerance"].includes(rule.type));
  return result;
});
const marblePostStart = marbleLocalIds.indexOf("record-run-provenance-and-replicates");
const marbleCompareStart = marbleLocalIds.indexOf("compare-rate-models");
const marbleSegments = [
  ["review-inquiry-scope", "record-research-questions", "choose-variable-hypothesis", "configure-experimental-design", "document-safety-plan", "initial-teacher-approval"],
  ["revise-procedure-note", "revised-teacher-approval"],
  marbleLocalIds.slice(marblePostStart, marbleCompareStart),
  marbleLocalIds.slice(marbleCompareStart),
];
marbleLab.process = localProcess(marbleLab.process, marbleSegments);
marbleLab.techniqueInstances = marbleInstances;
marbleLab.compositionStart = labNode(`${marbleSegments[0][0]}-node`);
marbleLab.compositionConnections = [
  connection("marble-design-to-practice", labNode("initial-approval-node"), endpoint("practice-trial", "entry")),
  connection("marble-practice-to-revision", endpoint("practice-trial", "exit"), labNode("revision-node")),
  connection("marble-revision-to-2m", labNode("revised-approval-node"), endpoint("acid-2m-trial", "entry")),
  connection("marble-2m-to-4m", endpoint("acid-2m-trial", "exit"), endpoint("acid-4m-trial", "entry")),
  connection("marble-4m-to-6m", endpoint("acid-4m-trial", "exit"), endpoint("acid-6m-trial", "entry")),
  connection("marble-6m-to-evidence-review", endpoint("acid-6m-trial", "exit"), labNode("run-provenance-node")),
  connection("marble-graph-to-2m-rate", labNode("graph-node"), endpoint("acid-2m-rate-analysis", "entry")),
  connection("marble-2m-rate-to-4m-rate", endpoint("acid-2m-rate-analysis", "exit"), endpoint("acid-4m-rate-analysis", "entry")),
  connection("marble-4m-rate-to-6m-rate", endpoint("acid-4m-rate-analysis", "exit"), endpoint("acid-6m-rate-analysis", "entry")),
  connection("marble-rates-to-model-comparison", endpoint("acid-6m-rate-analysis", "exit"), labNode("rate-model-node")),
];
marbleLab.reachabilityWitnesses = [{ id: "teacher-approved-guided-design", configuration: {}, approvalGates: {} }];
marbleLab.compositionAssessmentOrder = marbleLab.assessments.map((rule) => ({ kind: "lab-assessment", ruleId: rule.id }));
delete marbleLab.techniqueRefs;
marbleLab.metadata.version = "3.1.0";
marbleLab.metadata.updatedAt = "2026-09-06T00:00:00.000Z";
marbleLab.metadata.tags = [...new Set([...marbleLab.metadata.tags, "technique-composition", "cycle-08"] )];

// Crystal-violet lab composition.
const cvLab = cvLabOriginal;
const directInstance = (instanceId, technique, configuration = {}) => {
  const bindings = bindingFor(technique, cvLab);
  bindings.configuration = configuration;
  return { instanceId, techniqueId: technique.id, version: technique.metadata.version, bindings, preserveIds: idPreservation(technique) };
};
const cvEquipmentTargets = {
  "kinetics-cv-stock": "cv11-stock-bottle",
  "kinetics-naoh-stock": "cv11-naoh-bottle",
  "kinetics-cv-pipette": "cv11-kinetic-cv-pipette",
  "kinetics-naoh-pipette": "cv11-kinetic-naoh-pipette",
  "kinetics-reaction-vessel": "cv11-reaction-tube",
  "kinetics-transfer-pipette": "cv11-kinetic-transfer-pipette",
  "kinetics-reaction-cuvette": "cv11-kinetic-cuvette",
  "kinetics-spectrophotometer": "cv11-spectrophotometer",
  "kinetics-stopwatch": "cv11-stopwatch",
};
const cvCommonConfiguration = {
  cvVolumeMl: 5, naohVolumeMl: 5, totalVolumeMl: 10, aliquotVolumeMl: 3,
  scheduledTimeS: 15, instrumentReadingValue: 0.397,
  pairId: "cv11-kinetic-pair-1", absorbanceLabel: "Kinetic absorbance 1",
  wavelengthMeasurementId: "cv11-approved-wavelength-nm", zeroNotebookTag: "instrument-blanked",
};
const kineticsInstance = (instanceId, configuration, preserveIds) => {
  const bindings = bindingFor(kinetics, cvLab, cvEquipmentTargets);
  bindings.configuration = { ...cvCommonConfiguration, ...configuration };
  return { instanceId, techniqueId: kinetics.id, version: kinetics.metadata.version, bindings, preserveIds };
};
const initMap = {
  "measure-cv-reaction-portion": "cv11-measure-kinetic-cv",
  "measure-naoh-reaction-portion": "cv11-measure-kinetic-naoh",
  "transfer-cv-to-reaction-vessel": "cv11-transfer-cv-to-reaction-vessel",
  "initiate-cv-naoh-reaction": "cv11-start-reaction-with-naoh",
  "record-immediate-mixing": "cv11-mix-reaction",
  "measure-reacting-aliquot": "cv11-measure-reacting-aliquot",
  "fill-reaction-cuvette": "cv11-fill-kinetic-cuvette",
  "insert-reaction-cuvette": "cv11-insert-kinetic-cuvette",
};
const initPreserve = mapPreservation(kinetics, initMap);
initPreserve.references = {
  "kinetics-cv-volume": "cv11-kinetic-cv-volume",
  "kinetics-naoh-volume": "cv11-kinetic-naoh-volume",
  "kinetics-reacting-aliquot-volume": "cv11-reacting-aliquot-volume",
  "timer-armed": "timer-armed", "timed-mixing": "timed-mixing",
};
const cvInstances = [
  directInstance("dilution-series", dilution),
  directInstance("instrument-calibration", calibration),
  kineticsInstance("kinetics-initiation", { selectedProcedure: "reaction-initiation" }, initPreserve),
];
const times = [15, 45, 75, 105, 135, 165, 195, 225];
const absorbances = [0.397, 0.277, 0.193, 0.134, 0.094, 0.065, 0.046, 0.032];
for (let index = 0; index < times.length; index += 1) {
  const number = index + 1;
  const actionMap = {
    "wait-for-cv-scheduled-time": `cv11-record-kinetic-time-${number}`,
    "read-cv-scheduled-absorbance": `cv11-read-kinetic-absorbance-${number}`,
    "record-cv-scheduled-absorbance": `cv11-record-kinetic-absorbance-${number}`,
  };
  const readingPreserve = mapPreservation(kinetics, actionMap);
  // Without these the carrier's own measurement ids are scoped per instance while the rules that
  // consume them resolve unscoped, so no scheduled read or paired record could ever run, and the
  // analysis instance (which already preserves these identities) would find no evidence.
  readingPreserve.references = {
    "kinetics-scheduled-time": `cv11-kinetic-time-${number}`,
    "kinetics-scheduled-absorbance": `cv11-kinetic-absorbance-${number}`,
    "kinetics-reaction-dead-time": "cv11-dead-time-s",
  };
  cvInstances.push(kineticsInstance(`kinetics-reading-${number}`, {
    selectedProcedure: "scheduled-reading",
    scheduledTimeS: times[index],
    instrumentReadingValue: absorbances[index],
    pairId: `cv11-kinetic-pair-${number}`,
    absorbanceLabel: `Kinetic absorbance ${number}`,
  }, readingPreserve));
}
const analysisMain = directInstance("rate-law-analysis", analysis, { selectedProcedure: "integrated-rate-law-analysis" });
analysisMain.preserveIds = mapPreservation(analysis, Object.fromEntries(analysis.actions.slice(0, 8).map((action) => [action.id, action.id])));
analysisMain.preserveIds.references = Object.fromEntries(referenceIds(analysis).map((id) => [id, id]));
const analysisExtension = directInstance("analysis-extension", analysis, { selectedProcedure: "hydroxide-order-extension" });
analysisExtension.variantId = "hydroxide-order-extension";
analysisExtension.preserveIds = mapPreservation(analysis, Object.fromEntries(extensionActions.map((action) => [action.id, action.id])));
analysisExtension.preserveIds.references = Object.fromEntries(referenceIds({ ...analysis, actions: extensionActions }).map((id) => [id, id]));
cvInstances.push(analysisMain, analysisExtension, directInstance("waste-treatment", waste));

const cvImported = new Set([
  ...dilution.actions.map((action) => action.id),
  ...calibration.actions.map((action) => action.id),
  ...analysis.actions.map((action) => action.id),
  ...waste.actions.map((action) => action.id),
  "cv11-measure-kinetic-cv", "cv11-measure-kinetic-naoh", "cv11-transfer-cv-to-reaction-vessel",
  "cv11-start-reaction-with-naoh", "cv11-mix-reaction", "cv11-measure-reacting-aliquot",
  "cv11-fill-kinetic-cuvette", "cv11-insert-kinetic-cuvette",
  ...times.flatMap((_, index) => [
    `cv11-record-kinetic-time-${index + 1}`,
    `cv11-read-kinetic-absorbance-${index + 1}`,
    `cv11-record-kinetic-absorbance-${index + 1}`,
  ]),
]);
const cvLocalIds = cvLab.actions.map((action) => action.id).filter((id) => !cvImported.has(id));
cvLab.actions = cvLab.actions.filter((action) => cvLocalIds.includes(action.id)).map((action) => {
  const result = localize(action);
  if (result.id === "cv11-record-dead-time") {
    delete result.parameters.tag;
    result.parameters.evidenceBoundary = "fresh elapsed time from contact through insertion; not a model-fit result";
  }
  return result;
});
const cvSegments = [
  ["cv11-design-kinetic-volumes", "cv11-design-timing-and-stop-rule", "cv11-approve-kinetic-design", "cv11-arm-timer"],
  ["cv11-record-dead-time"],
  ["cv11-confirm-percent-completion-stop"],
];
cvLab.process = localProcess(cvLab.process, cvSegments);
cvLab.techniqueInstances = cvInstances;
cvLab.compositionStart = endpoint("dilution-series", "entry");
cvLab.compositionConnections = [
  connection("cv-dilution-to-calibration", endpoint("dilution-series", "exit"), endpoint("instrument-calibration", "entry")),
  connection("cv-calibration-to-design", endpoint("instrument-calibration", "exit"), labNode("cv11-design-kinetic-volumes-node")),
  connection("cv-design-to-initiation", labNode("cv11-arm-timer-node"), endpoint("kinetics-initiation", "entry")),
  connection("cv-initiation-to-dead-time", endpoint("kinetics-initiation", "exit"), labNode("cv11-record-dead-time-node")),
  connection("cv-dead-time-to-reading-1", labNode("cv11-record-dead-time-node"), endpoint("kinetics-reading-1", "entry")),
  ...times.slice(1).map((_, index) => connection(`cv-reading-${index + 1}-to-${index + 2}`, endpoint(`kinetics-reading-${index + 1}`, "exit"), endpoint(`kinetics-reading-${index + 2}`, "entry"))),
  connection("cv-reading-8-to-stop", endpoint("kinetics-reading-8", "exit"), labNode("cv11-confirm-percent-completion-stop-node")),
  connection("cv-stop-to-analysis", labNode("cv11-confirm-percent-completion-stop-node"), endpoint("rate-law-analysis", "entry")),
  connection("cv-analysis-to-waste-unapproved", endpoint("rate-law-analysis", "exit"), endpoint("waste-treatment", "entry"), "Continue without optional extension", { kind: "approval", instanceId: "analysis-extension", gateId: "teacher-approved", equals: false }),
  connection("cv-analysis-to-extension-approved", endpoint("rate-law-analysis", "exit"), endpoint("analysis-extension", "entry"), "Run teacher-approved hydroxide-order extension", { kind: "approval", instanceId: "analysis-extension", gateId: "teacher-approved", equals: true }),
  connection("cv-extension-to-waste-approved", endpoint("analysis-extension", "exit"), endpoint("waste-treatment", "entry"), "Continue to waste treatment", { kind: "approval", instanceId: "analysis-extension", gateId: "teacher-approved", equals: true }),
];
cvLab.reachabilityWitnesses = [
  { id: "mandatory-path", configuration: {}, approvalGates: { "analysis-extension.teacher-approved": false } },
  { id: "teacher-approved-extension", configuration: {}, approvalGates: { "analysis-extension.teacher-approved": true } },
];
const extensionIds = new Set(extensionActions.map((action) => action.id));
const mentionsExtension = (value) => JSON.stringify(value).split('"').some((part) => extensionIds.has(part));
cvLab.assessments = cvLab.assessments.filter((rule) => !mentionsExtension(rule));
cvLab.compositionAssessmentOrder = cvLab.assessments.map((rule) => ({ kind: "lab-assessment", ruleId: rule.id }));
delete cvLab.techniqueRefs;
cvLab.metadata.version = "2.1.0";
cvLab.metadata.updatedAt = "2026-09-06T00:00:00.000Z";
cvLab.metadata.tags = [...new Set([...cvLab.metadata.tags, "technique-composition", "cycle-08", "approval-witnessed-extension"] )];

writeJson(paths.marble, marble);
writeJson(paths.marbleLab, marbleLab);
if (!only) {
  writeJson(paths.dilution, dilution);
  writeJson(paths.calibration, calibration);
  writeJson(paths.analysis, analysis);
  writeJson(paths.waste, waste);
  writeJson(paths.cvLab, cvLab);
}

console.log(only ? "migrated Cycle 08 marble kinetics composition" : "migrated Cycle 08 kinetics compositions");
