import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const write = (file, value) => fs.writeFileSync(
  path.join(root, file),
  `${JSON.stringify(value, null, 2)}\n`,
);

const formalPath = "public/techniques/ph-volume-formal-titration-trial.json";
const analysisPath = "public/techniques/titration-curve-analysis.json";
const labPath = "public/labs/acid-base-titration-curves.json";

const formal = read(formalPath);
const analysis = read(analysisPath);
const existingLab = read(labPath);
const formalModelIds = formal.titrationModels.map((model) => model.id);

// Composition contracts reserve validation identities globally. The legacy analysis source
// reused two prerequisite ids across separate actions; keep the same predicates while giving
// each authored occurrence an explicit owner-local identity for compiler provenance.
const prerequisiteIdRenames = {
  "fill-curve-burette:burette-mounted-required": "burette-mounted-required-for-fill",
  "deliver-curve-titrant:burette-mounted-required": "burette-mounted-required-for-delivery",
  "place-curve-ph-probe:analyte-required": "analyte-required-for-probe",
  "calculate-curve-molarity:analyte-required": "analyte-required-for-calculation",
};
for (const action of analysis.actions) {
  action.prerequisites = (action.prerequisites ?? []).map((rule) => ({
    ...rule,
    id: prerequisiteIdRenames[`${action.id}:${rule.id}`] ?? rule.id,
  }));
}

const roleSourceInstances = {
  "variable-volume-measuring-device": "graduated-cylinder-1",
  "liquid-source": "unknown-acid-bottle-1",
  "measured-solvent-source": "graduated-cylinder-1",
  "receiving-vessel": "beaker-250ml-1",
  "immersed-probe-instrument": "ph-meter-1",
  "immersed-probe-vessel": "beaker-250ml-1",
  "titrant-delivery-device": "burette-50ml-1",
  "burette-support": "ring-stand-clamp-1",
  "titrant-source": "naoh-bottle-1",
  "analyte-receiver": "beaker-250ml-1",
};

const analysisComposition = {
  schemaVersion: 1,
  ports: [
    {
      id: "entry",
      kind: "entry",
      nodeId: "observe-ph-paper-node",
      label: "Screen and acquire one recorded pH-volume curve",
    },
    {
      id: "exit",
      kind: "exit",
      nodeId: "calculate-curve-molarity-node",
      label: "Recorded curve calculations complete",
    },
  ],
  equipmentRoles: Object.entries(roleSourceInstances).map(([roleId, sourceInstanceId]) => ({
    roleId,
    required: true,
    sourceInstanceIds: [sourceInstanceId],
    allowedDefinitionIds: [
      analysis.initialState.equipment.find((instance) => instance.id === sourceInstanceId)?.definitionId,
    ].filter(Boolean),
  })),
  modelSlots: [
    {
      id: "curve-analysis-model",
      kind: "titration",
      sourceModelId: "curve-unknown-acid",
      required: true,
    },
  ],
  configurationSlots: [
    {
      id: "analysisMode",
      required: true,
      valueType: "string",
      allowedValues: ["recorded-evidence-only"],
      defaultValue: "recorded-evidence-only",
    },
  ],
  approvalGates: [],
  variants: [],
  evidenceOutputs: [
    {
      id: "analysis-screen-evidence",
      kind: "notebook",
      actionId: "observe-ph-paper",
      referenceId: "ph-paper-screen",
      required: true,
    },
    {
      id: "analysis-initial-ph-evidence",
      kind: "measurement",
      actionId: "record-initial-ph",
      referenceId: "initial-ph",
      required: true,
    },
    {
      id: "analysis-equivalence-evidence",
      kind: "measurement",
      actionId: "record-equivalence-volume",
      referenceId: "equivalence-volume",
      required: true,
    },
    {
      id: "analysis-molarity-calculation",
      kind: "calculation",
      actionId: "calculate-curve-molarity",
      referenceId: "curve-molarity",
      required: true,
    },
  ],
  completion: {
    exitPortIds: ["exit"],
    requiredEvidenceOutputIds: [
      "analysis-screen-evidence",
      "analysis-initial-ph-evidence",
      "analysis-equivalence-evidence",
      "analysis-molarity-calculation",
    ],
    requiredValidationRuleIds: [],
  },
  catalogDisposition: "composable",
  legacyActionEffects: [
    {
      actionId: "observe-ph-paper",
      effect: {
        classes: ["evidence-recording"],
        targets: [{ domain: "evidence" }],
      },
    },
    {
      actionId: "record-initial-ph",
      effect: {
        classes: ["evidence-recording"],
        targets: [{ domain: "evidence" }],
      },
    },
    {
      actionId: "record-equivalence-volume",
      effect: {
        classes: ["evidence-recording"],
        targets: [{ domain: "evidence" }],
      },
    },
    {
      actionId: "calculate-curve-molarity",
      effect: {
        classes: ["calculation-analysis"],
        targets: [{ domain: "analysis" }, { domain: "evidence" }],
      },
    },
  ],
};

analysis.metadata = {
  ...analysis.metadata,
  version: "1.2.0",
  updatedAt: "2026-09-06T00:00:00.000Z",
  tags: [
    ...new Set([
      ...analysis.metadata.tags,
      "technique-composition",
      "cycle-10",
      "recorded-evidence",
    ]),
  ],
};
analysis.composition = analysisComposition;

const cloneEquipment = (instance, id, label = instance.label) => ({
  ...structuredClone(instance),
  id,
  label,
});

const analysisEquipmentIds = {
  "unknown-acid-bottle-1": "curve-unknown-acid-bottle",
  "naoh-bottle-1": "curve-naoh-bottle",
  "graduated-cylinder-1": "curve-graduated-cylinder",
  "beaker-250ml-1": "curve-beaker-250ml",
  "burette-50ml-1": "curve-burette",
  "ring-stand-clamp-1": "curve-ring-stand",
  "ph-meter-1": "curve-ph-meter",
  "ph-paper-1": "curve-ph-paper",
  "data-collection-interface-1": "curve-data-interface",
};
const analysisEquipment = analysis.initialState.equipment.map((instance) =>
  cloneEquipment(
    instance,
    analysisEquipmentIds[instance.id],
    `Curve analysis ${instance.label.toLowerCase()}`,
  ),
);

const singleBinding = (definitionId, instanceId) => ({ definitionId, instanceId });
const formalEquipment = Object.fromEntries(
  formal.initialState.equipment.map((instance) => [instance.definitionId, instance]),
);
const formalBindings = Object.fromEntries(
  formal.composition.equipmentRoles.map((role) => {
    const sourceInstanceId = role.sourceInstanceIds?.[0];
    const source = formal.initialState.equipment.find((instance) => instance.id === sourceInstanceId);
    return [
      role.roleId,
      singleBinding(source.definitionId, source.id),
    ];
  }),
);

const analysisBindings = Object.fromEntries(
  Object.entries(roleSourceInstances).map(([roleId, sourceInstanceId]) => {
    const source = analysis.initialState.equipment.find((instance) => instance.id === sourceInstanceId);
    return [roleId, singleBinding(source.definitionId, analysisEquipmentIds[sourceInstanceId])];
  }),
);

const formalConfiguration = {
  contextId: "strong-acid-strong-base",
  formalContextModelId: "formal-strong-acid-strong-base-model",
  aliquotMl: 25,
  maximumIncrementMl: 5,
  maximumDeliveryMl: 50,
  stabilityDeltaPh: 0.12,
  stabilityConsecutiveReadings: 2,
  minimumPostSteepRegionMl: 6,
  conditioningVolumeMl: 1,
  tipPurgeMl: 0.2,
  rinseVolumeMl: 2,
  indicatorPolicy: "indicator-free-formal",
  preparationProtocol: "Teacher-approved sample, apparatus, probe, increment, and stability configuration required before running",
  wasteProtocol: "Teacher-approved acid-base neutralization and disposal route required before running",
};

const formalPreserve = {
  actions: Object.fromEntries(formal.actions.map((action) => [action.id, action.id])),
  nodes: Object.fromEntries(formal.process.nodes.map((node) => [node.id, node.id])),
  validationRules: Object.fromEntries([
    ...formal.actions.flatMap((action) => action.prerequisites ?? []),
    ...formal.process.nodes.flatMap((node) => node.validation ?? []),
    ...formal.successCriteria,
  ].map((rule) => [rule.id, rule.id])),
};
const analysisPreserve = {
  actions: Object.fromEntries(analysis.actions.map((action) => [action.id, `curve-analysis--${action.id}`])),
  nodes: Object.fromEntries(analysis.process.nodes.map((node) => [node.id, `curve-analysis--${node.id}`])),
  validationRules: Object.fromEntries([
    ...analysis.actions.flatMap((action) => action.prerequisites ?? []),
    ...analysis.process.nodes.flatMap((node) => node.validation ?? []),
    ...analysis.successCriteria,
  ].map((rule) => [rule.id, `curve-analysis--${rule.id}`])),
};

const localActions = [
  {
    id: "ACID-PLAN-01",
    verb: "observe",
    label: "Record the approved comparative titration plan",
    parameters: {
      note: "Record the assigned question, hypothesis, selected combinations, aliquot, increments, replicates, and teacher approval before physical acquisition.",
      inputMode: "text",
      inputRole: "studentResponse",
      inputRequired: true,
    },
    interaction: {
      type: "recordNotebook",
      valueParameter: "note",
      accessibleLabel: "Record the approved comparative titration plan before starting physical acquisition.",
      successCue: "Comparative titration plan recorded.",
      invalidCue: "Complete and obtain approval for the comparative titration plan first.",
    },
    prerequisites: [],
    stateChanges: ["Records the approved nonphysical inquiry configuration."],
    invalidCases: [],
    feedback: { success: "Comparative titration plan recorded.", invalid: "Complete the approved plan first." },
    evidence: ["record", "plan"],
    effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }, { domain: "configuration" }] },
  },
  {
    id: "ACID-ANALYSIS-01",
    verb: "record",
    label: "Record curve landmarks and comparison interpretation",
    parameters: {
      measurementId: "curve-landmark-interpretation",
      inputMode: "text",
      inputRole: "studentResponse",
      inputRequired: true,
    },
    interaction: {
      type: "recordNotebook",
      valueParameter: "measurementId",
      accessibleLabel: "Record the curve landmarks and compare the configured acid-base structures using the recorded evidence.",
      successCue: "Curve landmark interpretation recorded.",
      invalidCue: "Complete the selected curve acquisition and cite recorded landmarks.",
    },
    prerequisites: [],
    stateChanges: ["Records a nonphysical interpretation of recorded curve evidence."],
    invalidCases: [],
    feedback: { success: "Curve landmark interpretation recorded.", invalid: "Use the recorded curve evidence." },
    evidence: ["record", "analysis"],
    effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }, { domain: "analysis" }] },
  },
  {
    id: "ACID-UNCERTAINTY-01",
    verb: "record",
    label: "Record uncertainty and provenance limits",
    parameters: {
      measurementId: "curve-uncertainty-reflection",
      inputMode: "text",
      inputRole: "studentResponse",
      inputRequired: true,
    },
    interaction: {
      type: "recordNotebook",
      valueParameter: "measurementId",
      accessibleLabel: "Record uncertainty sources and provenance limits for the curve analysis.",
      successCue: "Uncertainty and provenance limits recorded.",
      invalidCue: "Record the instrument, sampling, stability, and provenance limitations.",
    },
    prerequisites: [],
    stateChanges: ["Records uncertainty and provenance limitations without changing physical evidence."],
    invalidCases: [],
    feedback: { success: "Uncertainty and provenance limits recorded.", invalid: "Record the uncertainty reflection." },
    evidence: ["record", "uncertainty"],
    effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }, { domain: "analysis" }] },
  },
  {
    id: "ACID-CLEANUP-01",
    verb: "record",
    label: "Confirm configured neutralization and disposal",
    parameters: {
      measurementId: "titration-waste-disposal",
      inputMode: "text",
      inputRole: "studentResponse",
      inputRequired: true,
    },
    interaction: {
      type: "recordNotebook",
      valueParameter: "measurementId",
      accessibleLabel: "Record the measured waste pH and instructor-confirmed neutralization and disposal route.",
      successCue: "Configured neutralization and disposal evidence recorded.",
      invalidCue: "Waste must be within the configured release range and the instructor route must be confirmed.",
    },
    prerequisites: [],
    stateChanges: ["Records the nonphysical cleanup confirmation after the waste checkpoint."],
    invalidCases: [],
    feedback: { success: "Configured neutralization and disposal evidence recorded.", invalid: "Complete the configured waste checkpoint." },
    evidence: ["record", "disposal"],
    effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }, { domain: "configuration" }] },
  },
];

const localNodes = [
  {
    id: "ACID-PLAN-01-node",
    type: "teacherNote",
    title: "Approved comparative titration plan",
    description: "Record the teacher-approved question, hypothesis, combinations, volumes, increments, and replicate plan.",
    actionId: "ACID-PLAN-01",
    config: {},
    validation: [{ id: "ACID-PLAN-01-complete", type: "actionEvidence", label: "Comparative titration plan is recorded.", actionId: "ACID-PLAN-01" }],
    hints: ["This nonphysical node configures the route; exact physical acquisition remains owned by the imported formal technique."],
    feedback: { success: "Comparative titration plan recorded.", retry: "Complete the approved plan before acquisition." },
  },
  {
    id: "ACID-ANALYSIS-01-node",
    type: "checkpoint",
    title: "Curve landmark interpretation",
    description: "Record comparisons from the measured pH-volume tables and the imported analysis evidence.",
    actionId: "ACID-ANALYSIS-01",
    config: {},
    validation: [{ id: "ACID-ANALYSIS-01-complete", type: "actionEvidence", label: "Curve landmark interpretation is recorded.", actionId: "ACID-ANALYSIS-01" }],
    hints: ["Use the plotted and recorded evidence; do not infer a hidden answer from the model."],
    feedback: { success: "Curve landmark interpretation recorded.", retry: "Record a comparison grounded in the curve evidence." },
  },
  {
    id: "ACID-UNCERTAINTY-01-node",
    type: "checkpoint",
    title: "Uncertainty and provenance limits",
    description: "Record instrument, increment, stability, and provenance limits without overwriting raw measurements.",
    actionId: "ACID-UNCERTAINTY-01",
    config: {},
    validation: [{ id: "ACID-UNCERTAINTY-01-complete", type: "actionEvidence", label: "Uncertainty and provenance limits are recorded.", actionId: "ACID-UNCERTAINTY-01" }],
    hints: [],
    feedback: { success: "Uncertainty and provenance limits recorded.", retry: "Record the uncertainty reflection." },
  },
  {
    id: "ACID-CLEANUP-01-node",
    type: "checkpoint",
    title: "Neutralization and disposal checkpoint",
    description: "Confirm the measured waste pH is inside the teacher-configured range and record the instructor disposal route.",
    actionId: "ACID-CLEANUP-01",
    config: { teacherConfiguredWasteRange: true },
    validation: [{ id: "ACID-CLEANUP-01-complete", type: "actionEvidence", label: "Configured neutralization and disposal evidence is recorded.", actionId: "ACID-CLEANUP-01" }],
    hints: ["The route records configured waste evidence; it does not claim a universal neutralization rule."],
    feedback: { success: "Configured neutralization and disposal evidence recorded.", retry: "Complete the waste checkpoint before closing the route." },
  },
];

const mappedFormalEquipment = formal.initialState.equipment.map((instance) => cloneEquipment(instance, instance.id));
const lab = {
  ...existingLab,
  description: "Teacher-configured comparative acid-base titration curves composed from the exact indicator-free formal trial and recorded-evidence analysis techniques.",
  equipment: [...new Set([...formal.requiredEquipment, ...analysis.requiredEquipment])],
  techniques: [],
  initialState: { equipment: [...mappedFormalEquipment, ...analysisEquipment] },
  titrationModels: [...structuredClone(formal.titrationModels), ...structuredClone(analysis.titrationModels)],
  actions: localActions,
  process: {
    startNodeId: "ACID-PLAN-01-node",
    nodes: localNodes,
    edges: [
      { from: "ACID-ANALYSIS-01-node", to: "ACID-UNCERTAINTY-01-node", label: "Interpretation recorded", condition: { type: "validationPassed" } },
      { from: "ACID-UNCERTAINTY-01-node", to: "ACID-CLEANUP-01-node", label: "Uncertainty recorded", condition: { type: "validationPassed" } },
    ],
  },
  assessments: [
    { id: "acid-base-titration-curves-complete", type: "actionEvidence", label: "Comparative titration curve investigation is complete.", actionId: "ACID-CLEANUP-01" },
  ],
  metadata: {
    ...existingLab.metadata,
    version: "2.0.0",
    updatedAt: "2026-09-06T00:00:00.000Z",
    tags: [...new Set([...existingLab.metadata.tags, "technique-composition", "cycle-10", "route-adapter"])],
  },
  techniqueInstances: [
    {
      instanceId: "formal-trial",
      techniqueId: formal.id,
      version: formal.metadata.version,
      bindings: {
        equipment: formalBindings,
        models: Object.fromEntries(formalModelIds.map((id) => [id, id])),
        configuration: formalConfiguration,
      },
      preserveIds: formalPreserve,
    },
    {
      instanceId: "curve-analysis",
      techniqueId: analysis.id,
      version: analysis.metadata.version,
      bindings: {
        equipment: analysisBindings,
        models: { "curve-analysis-model": "curve-unknown-acid" },
        configuration: { analysisMode: "recorded-evidence-only" },
      },
      preserveIds: analysisPreserve,
      enabledWhen: {
        kind: "configuration",
        instanceId: "formal-trial",
        slotId: "contextId",
        equals: "weak-acid-strong-base",
      },
    },
  ],
  compositionStart: { kind: "lab-node", nodeId: "ACID-PLAN-01-node" },
  compositionConnections: [
    {
      id: "plan-to-formal-trial",
      from: { kind: "lab-node", nodeId: "ACID-PLAN-01-node" },
      to: { kind: "technique-port", instanceId: "formal-trial", portId: "entry" },
      label: "Approved plan unlocks the exact indicator-free formal trial",
      condition: { type: "validationPassed" },
    },
    {
      id: "formal-to-analysis-weak-acid",
      from: { kind: "technique-port", instanceId: "formal-trial", portId: "exit" },
      to: { kind: "technique-port", instanceId: "curve-analysis", portId: "entry" },
      label: "Weak-acid curve enters recorded-evidence analysis",
      condition: { type: "validationPassed" },
      enabledWhen: { kind: "configuration", instanceId: "formal-trial", slotId: "contextId", equals: "weak-acid-strong-base" },
    },
    {
      id: "formal-to-local-analysis-strong",
      from: { kind: "technique-port", instanceId: "formal-trial", portId: "exit" },
      to: { kind: "lab-node", nodeId: "ACID-ANALYSIS-01-node" },
      label: "Strong-acid/strong-base formal evidence enters local comparison interpretation",
      condition: { type: "validationPassed" },
      enabledWhen: { kind: "configuration", instanceId: "formal-trial", slotId: "contextId", equals: "strong-acid-strong-base" },
    },
    {
      id: "formal-to-local-analysis-weak-base",
      from: { kind: "technique-port", instanceId: "formal-trial", portId: "exit" },
      to: { kind: "lab-node", nodeId: "ACID-ANALYSIS-01-node" },
      label: "Weak-base/strong-acid formal evidence enters local comparison interpretation",
      condition: { type: "validationPassed" },
      enabledWhen: { kind: "configuration", instanceId: "formal-trial", slotId: "contextId", equals: "weak-base-strong-acid" },
    },
    {
      id: "analysis-to-local-interpretation",
      from: { kind: "technique-port", instanceId: "curve-analysis", portId: "exit" },
      to: { kind: "lab-node", nodeId: "ACID-ANALYSIS-01-node" },
      label: "Recorded weak-acid calculation evidence enters comparison interpretation",
      condition: { type: "validationPassed" },
      enabledWhen: { kind: "configuration", instanceId: "formal-trial", slotId: "contextId", equals: "weak-acid-strong-base" },
    },
  ],
  reachabilityWitnesses: [
    {
      id: "strong-acid-strong-base",
      configuration: {
        "formal-trial.contextId": "strong-acid-strong-base",
        "formal-trial.formalContextModelId": "formal-strong-acid-strong-base-model",
        "formal-trial.aliquotMl": 25,
        "formal-trial.maximumIncrementMl": 5,
        "formal-trial.maximumDeliveryMl": 50,
        "formal-trial.stabilityDeltaPh": 0.12,
        "formal-trial.stabilityConsecutiveReadings": 2,
        "formal-trial.minimumPostSteepRegionMl": 6,
        "formal-trial.conditioningVolumeMl": 1,
        "formal-trial.tipPurgeMl": 0.2,
        "formal-trial.rinseVolumeMl": 2,
        "formal-trial.indicatorPolicy": "indicator-free-formal",
        "formal-trial.preparationProtocol": formalConfiguration.preparationProtocol,
        "formal-trial.wasteProtocol": formalConfiguration.wasteProtocol,
        "curve-analysis.analysisMode": "recorded-evidence-only",
      },
      approvalGates: {},
    },
    {
      id: "weak-acid-strong-base",
      configuration: {
        "formal-trial.contextId": "weak-acid-strong-base",
        "formal-trial.formalContextModelId": "formal-weak-acid-strong-base-model",
        "formal-trial.aliquotMl": 25,
        "formal-trial.maximumIncrementMl": 5,
        "formal-trial.maximumDeliveryMl": 50,
        "formal-trial.stabilityDeltaPh": 0.12,
        "formal-trial.stabilityConsecutiveReadings": 2,
        "formal-trial.minimumPostSteepRegionMl": 6,
        "formal-trial.conditioningVolumeMl": 1,
        "formal-trial.tipPurgeMl": 0.2,
        "formal-trial.rinseVolumeMl": 2,
        "formal-trial.indicatorPolicy": "indicator-free-formal",
        "formal-trial.preparationProtocol": formalConfiguration.preparationProtocol,
        "formal-trial.wasteProtocol": formalConfiguration.wasteProtocol,
        "curve-analysis.analysisMode": "recorded-evidence-only",
      },
      approvalGates: {},
    },
    {
      id: "weak-base-strong-acid",
      configuration: {
        "formal-trial.contextId": "weak-base-strong-acid",
        "formal-trial.formalContextModelId": "formal-weak-base-strong-acid-model",
        "formal-trial.aliquotMl": 25,
        "formal-trial.maximumIncrementMl": 5,
        "formal-trial.maximumDeliveryMl": 50,
        "formal-trial.stabilityDeltaPh": 0.12,
        "formal-trial.stabilityConsecutiveReadings": 2,
        "formal-trial.minimumPostSteepRegionMl": 6,
        "formal-trial.conditioningVolumeMl": 1,
        "formal-trial.tipPurgeMl": 0.2,
        "formal-trial.rinseVolumeMl": 2,
        "formal-trial.indicatorPolicy": "indicator-free-formal",
        "formal-trial.preparationProtocol": formalConfiguration.preparationProtocol,
        "formal-trial.wasteProtocol": formalConfiguration.wasteProtocol,
        "curve-analysis.analysisMode": "recorded-evidence-only",
      },
      approvalGates: {},
    },
  ],
};

write(analysisPath, analysis);
write(labPath, lab);
console.log(`Cycle 10 composition written: ${analysisPath}, ${labPath}`);
