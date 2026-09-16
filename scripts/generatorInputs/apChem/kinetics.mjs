/**
 * Cycle 08-owned kinetics definition refinement.
 *
 * The shared AP driver owns serialization and its public 11-action compatibility
 * boundary. This module stays data-only and replaces the former generic
 * scheduled-reading stub with the source-grounded Investigation 11 subflows.
 */

const emptyContents = () => ({
  kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty",
});

const equipment = (id, definitionId, label, contents = emptyContents()) => ({
  id, definitionId, label, location: "shelf", contents,
});

const invalidCases = [
  {
    id: "wrong-order",
    when: "the current node expects a different action",
    message: "That operation is out of sequence for the timed kinetics run.",
    recovery: "Return to the highlighted operation and preserve the approved time-zero sequence.",
  },
  {
    id: "unapproved-configuration",
    when: "the kinetic design or scheduled point has not been approved",
    message: "This kinetics choice still requires teacher approval.",
    recovery: "Record the proposed quantities or timing and obtain approval before continuing.",
  },
  {
    id: "cross-contamination",
    when: "a liquid is handled with the wrong assigned pipette",
    message: "That pipette is assigned to a different solution.",
    recovery: "Use the separately assigned crystal-violet, sodium-hydroxide, or transfer pipette.",
  },
];

const action = ({
  id, verb, label, parameters, interaction, prerequisites = [], stateChanges, evidence, atomId,
  equipmentRoleBindings,
}) => ({
  id, verb, label, parameters,
  interaction: {
    ...interaction,
    successCue: interaction.successCue ?? "The source-grounded operation is recorded.",
    invalidCue: interaction.invalidCue ?? "Check the approved design, assigned equipment, and timed sequence.",
  },
  prerequisites,
  stateChanges: stateChanges ?? [`${label} is complete.`],
  invalidCases,
  feedback: {
    success: stateChanges?.[0] ?? `${label} is complete.`,
    invalid: "The operation was not accepted. Review the approved kinetics sequence.",
  },
  evidence,
  ...(atomId ? { atomId } : {}),
  ...(equipmentRoleBindings ? { equipmentRoleBindings } : {}),
});

const node = (item) => ({
  id: `${item.id}-node`,
  type: item.verb === "calculate" ? "calculation" : item.verb === "observe" || item.verb === "record" ? "observation" : "action",
  title: item.label,
  description: item.stateChanges[0],
  actionId: item.id,
  config: {},
  validation: [{ id: `${item.id}-complete`, type: "actionEvidence", label: `${item.label} was completed.`, actionId: item.id }],
  hints: [],
  feedback: { success: `${item.label} complete.`, retry: `Review ${item.label.toLowerCase()} and try again.` },
});

const notebookEffect = (actionId) => ({
  actionId,
  effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] },
});

const configurationSlots = [
  ["selectedProcedure", "string", ["reaction-initiation", "scheduled-reading"]],
  ["cvVolumeMl", "number"],
  ["naohVolumeMl", "number"],
  ["totalVolumeMl", "number"],
  ["aliquotVolumeMl", "number"],
  ["scheduledTimeS", "number"],
  ["instrumentReadingValue", "number"],
  ["pairId", "string"],
  ["absorbanceLabel", "string"],
  ["wavelengthMeasurementId", "string"],
  ["zeroNotebookTag", "string"],
].map(([id, valueType, allowedValues]) => ({ id, valueType, required: true, ...(allowedValues ? { allowedValues } : {}) }));

export const refineKineticsDefinition = (input) => {
  if (input.id !== "crystal-violet-kinetics") return input;

  const actions = [
    action({
      id: "measure-cv-reaction-portion", verb: "measureVolume", label: "Measure the approved crystal-violet portion",
      parameters: {
        sourceDefinitionId: "sample-bottle", sourceInstanceId: "kinetics-cv-stock",
        targetDefinitionId: "graduated-pipette-10ml", targetInstanceId: "kinetics-cv-pipette",
        volumeMl: "{{config.cvVolumeMl}}", measurementId: "kinetics-cv-volume", tolerance: 0.05,
        pipetteAssignment: "crystal-violet", configurationProvenance: "teacher-approved kinetic design",
      },
      interaction: { type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-pipette-10ml", valueParameter: "volumeMl", accessibleLabel: "Measure the approved crystal-violet portion with its assigned pipette." },
      evidence: ["measureVolume", "kinetic-cv-portion", "separate-pipette"],
      atomId: "atom.measure.variable-volume",
      equipmentRoleBindings: { "variable-volume-measuring-device": "graduated-pipette-10ml", "liquid-source": "sample-bottle" },
    }),
    action({
      id: "measure-naoh-reaction-portion", verb: "measureVolume", label: "Measure the approved sodium-hydroxide portion",
      parameters: {
        sourceDefinitionId: "reagent-bottle", sourceInstanceId: "kinetics-naoh-stock",
        targetDefinitionId: "graduated-pipette-10ml", targetInstanceId: "kinetics-naoh-pipette",
        volumeMl: "{{config.naohVolumeMl}}", measurementId: "kinetics-naoh-volume", tolerance: 0.05,
        pipetteAssignment: "sodium-hydroxide", configurationProvenance: "teacher-approved kinetic design",
      },
      interaction: { type: "pourInto", sourceDefinitionId: "reagent-bottle", targetDefinitionId: "graduated-pipette-10ml", valueParameter: "volumeMl", accessibleLabel: "Measure the approved sodium-hydroxide portion with its assigned pipette." },
      prerequisites: [{ id: "kinetics-cv-volume-required", type: "measurementRecorded", label: "The crystal-violet portion is measured and remains separate.", measurementId: "kinetics-cv-volume" }],
      evidence: ["measureVolume", "kinetic-naoh-portion", "separate-pipette"],
      atomId: "atom.measure.variable-volume",
      equipmentRoleBindings: { "variable-volume-measuring-device": "graduated-pipette-10ml", "liquid-source": "reagent-bottle" },
    }),
    action({
      id: "transfer-cv-to-reaction-vessel", verb: "transfer", label: "Transfer crystal violet to the reaction vessel",
      parameters: {
        sourceDefinitionId: "graduated-pipette-10ml", sourceInstanceId: "kinetics-cv-pipette",
        targetDefinitionId: "test-tube", targetInstanceId: "kinetics-reaction-vessel",
        volumeMl: "{{config.cvVolumeMl}}", pipetteAssignment: "crystal-violet",
      },
      interaction: { type: "pourInto", sourceDefinitionId: "graduated-pipette-10ml", targetDefinitionId: "test-tube", valueParameter: "volumeMl", accessibleLabel: "Transfer only the measured crystal-violet portion to the reaction vessel." },
      prerequisites: [{ id: "kinetics-timer-armed-required", type: "notebookEntry", label: "The timer and acquisition are armed before reactant contact.", notebookTag: "timer-armed" }],
      stateChanges: ["Crystal violet is staged in the reaction vessel while sodium hydroxide remains separate."],
      evidence: ["transfer", "kinetic-cv-portion", "reactants-separated"],
      atomId: "atom.transfer.measured-liquid",
      equipmentRoleBindings: { "measured-solvent-source": "graduated-pipette-10ml", "receiving-vessel": "test-tube" },
    }),
    action({
      id: "initiate-cv-naoh-reaction", verb: "transfer", label: "Add sodium hydroxide to initiate the timed reaction",
      parameters: {
        sourceDefinitionId: "graduated-pipette-10ml", sourceInstanceId: "kinetics-naoh-pipette",
        targetDefinitionId: "test-tube", targetInstanceId: "kinetics-reaction-vessel",
        volumeMl: "{{config.naohVolumeMl}}", totalVolumeMl: "{{config.totalVolumeMl}}",
        reactionStartTrigger: "first-reactant-contact", timerStartsAtContact: true,
        mixImmediatelyByApprovedMethod: true, exactTriggerGeometry: "teacher-confirmed; not inferred by the simulator",
        visualState: "purple-solution", pipetteAssignment: "sodium-hydroxide",
      },
      interaction: { type: "pourInto", sourceDefinitionId: "graduated-pipette-10ml", targetDefinitionId: "test-tube", valueParameter: "volumeMl", accessibleLabel: "Add the measured sodium-hydroxide portion; this contact is the recorded time-zero event." },
      prerequisites: [
        { id: "kinetics-naoh-volume-required", type: "measurementRecorded", label: "The sodium-hydroxide portion is measured and remains separate.", measurementId: "kinetics-naoh-volume" },
        { id: "kinetics-cv-staged-required", type: "actionEvidence", label: "Crystal violet is staged in the reaction vessel.", actionId: "transfer-cv-to-reaction-vessel" },
      ],
      stateChanges: ["Reactant contact starts the reaction and the timer at the same defined time-zero event."],
      evidence: ["transfer", "reaction-start", "timer-coupled", "time-zero"],
      atomId: "atom.transfer.initiate-timed-reaction",
      equipmentRoleBindings: { "measured-solvent-source": "graduated-pipette-10ml", "reaction-vessel": "test-tube", "timing-instrument": "stopwatch" },
    }),
    action({
      id: "record-immediate-mixing", verb: "observe", label: "Record immediate mixing and time-zero alignment",
      parameters: {
        note: "Record that the teacher-approved mixing method followed reactant contact immediately, the timer continued from that contact, and no transfer or insertion delay was erased.",
        tag: "timed-mixing", evidenceBoundary: "This records the approved physical mixing; the notebook handler does not claim to perform it.",
      },
      interaction: { type: "recordNotebook", valueParameter: "note", accessibleLabel: "Record immediate mixing and the unchanged contact-defined time zero." },
      prerequisites: [{ id: "kinetics-contact-required", type: "actionEvidence", label: "Reactant contact fixed the reaction start and time zero.", actionId: "initiate-cv-naoh-reaction" }],
      evidence: ["observe", "notebook", "timed-mixing", "time-zero"],
    }),
    action({
      id: "measure-reacting-aliquot", verb: "measureVolume", label: "Measure a reacting aliquot while timing continues",
      parameters: {
        sourceDefinitionId: "test-tube", sourceInstanceId: "kinetics-reaction-vessel",
        targetDefinitionId: "beral-pipette", targetInstanceId: "kinetics-transfer-pipette",
        volumeMl: "{{config.aliquotVolumeMl}}", measurementId: "kinetics-reacting-aliquot-volume", tolerance: 0.1, timerContinues: true,
      },
      interaction: { type: "pourInto", sourceDefinitionId: "test-tube", targetDefinitionId: "beral-pipette", valueParameter: "volumeMl", accessibleLabel: "Withdraw a fresh reacting aliquot without resetting the timer." },
      prerequisites: [{ id: "kinetics-mixing-record-required", type: "notebookEntry", label: "Immediate mixing and time-zero alignment are recorded.", notebookTag: "timed-mixing" }],
      evidence: ["measureVolume", "reacting-aliquot", "timer-running"],
      atomId: "atom.measure.photometric-aliquot",
      equipmentRoleBindings: { "sample-source": "test-tube", "photometric-aliquot-tool": "beral-pipette" },
    }),
    action({
      id: "fill-reaction-cuvette", verb: "transfer", label: "Fill the reaction cuvette while timing continues",
      parameters: {
        sourceDefinitionId: "beral-pipette", sourceInstanceId: "kinetics-transfer-pipette",
        targetDefinitionId: "cuvette", targetInstanceId: "kinetics-reaction-cuvette",
        volumeMl: "{{config.aliquotVolumeMl}}", timerContinues: true,
      },
      interaction: { type: "pourInto", sourceDefinitionId: "beral-pipette", targetDefinitionId: "cuvette", valueParameter: "volumeMl", accessibleLabel: "Deliver the reacting aliquot to the kinetic cuvette while timing continues." },
      prerequisites: [{ id: "kinetics-aliquot-required", type: "measurementRecorded", label: "A fresh reacting aliquot is measured.", measurementId: "kinetics-reacting-aliquot-volume" }],
      evidence: ["transfer", "reacting-aliquot", "timer-running"],
      atomId: "atom.transfer.fill-cuvette",
      equipmentRoleBindings: { "sample-source": "beral-pipette", "photometer-sample-holder": "cuvette" },
    }),
    action({
      id: "insert-reaction-cuvette", verb: "place", label: "Insert the reaction cuvette while timing continues",
      parameters: {
        equipmentDefinitionId: "cuvette", equipmentInstanceId: "kinetics-reaction-cuvette",
        sourceDefinitionId: "cuvette", targetDefinitionId: "spectrophotometer", targetInstanceId: "kinetics-spectrophotometer",
        snapZoneId: "spectrophotometer-cuvette-slot", timerContinues: true,
      },
      interaction: { type: "snapIntoTarget", sourceDefinitionId: "cuvette", targetDefinitionId: "spectrophotometer", snapZoneId: "spectrophotometer-cuvette-slot", accessibleLabel: "Insert the reaction cuvette without stopping or resetting the timer." },
      prerequisites: [
        { id: "kinetics-cuvette-filled-required", type: "actionEvidence", label: "The reaction cuvette is filled.", actionId: "fill-reaction-cuvette" },
        { id: "kinetics-instrument-zero-required", type: "notebookEntry", label: "The instrument is zeroed with the approved blank.", notebookTag: "{{config.zeroNotebookTag}}" },
      ],
      evidence: ["place", "timer-running", "dead-time-preserved"],
      atomId: "atom.place.insert-cuvette",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
    }),
    action({
      id: "wait-for-cv-scheduled-time", verb: "record", label: "Record the fresh elapsed time for this scheduled point",
      parameters: {
        measurementId: "kinetics-scheduled-time", label: "Scheduled kinetic elapsed time", value: "{{config.scheduledTimeS}}", unit: "s",
        pairId: "{{config.pairId}}", quantity: "elapsedTime", timeZeroDefinition: "reactant-contact-event", evidenceLayer: "raw-timed-observation",
      },
      interaction: { type: "recordNotebook", valueParameter: "measurementId", accessibleLabel: "Record the current elapsed time as a fresh raw time-series coordinate." },
      prerequisites: [{ id: "kinetics-dead-time-record-required", type: "measurementRecorded", label: "Reaction start, mixing, transfer, and insertion dead time are recorded.", measurementId: "kinetics-reaction-dead-time" }],
      evidence: ["record", "measurement", "elapsed-time", "raw-series"],
    }),
    action({
      id: "read-cv-scheduled-absorbance", verb: "observe", label: "Read fresh absorbance at the scheduled time",
      parameters: {
        sourceDefinitionId: "cuvette", sourceInstanceId: "kinetics-reaction-cuvette",
        photometerOperation: "read", photometerDefinitionId: "spectrophotometer", photometerInstanceId: "kinetics-spectrophotometer",
        photometricQuantity: "absorbance", wavelengthMeasurementId: "{{config.wavelengthMeasurementId}}",
        requiresZeroNotebookTag: "{{config.zeroNotebookTag}}", cuvetteInstanceId: "kinetics-reaction-cuvette",
        measurementId: "kinetics-scheduled-absorbance", label: "{{config.absorbanceLabel}}",
        instrumentReadingValue: "{{config.instrumentReadingValue}}", unit: "absorbance",
        readingProvenance: "teacher-configured simulated instrument observation acquired only on execution",
        scheduledTimeMeasurementId: "kinetics-scheduled-time", pairId: "{{config.pairId}}",
        evidenceLayer: "raw-instrument-observation", modelComparisonEligibleOnlyAfterRecord: true,
      },
      interaction: { type: "readInstrument", sourceDefinitionId: "cuvette", stationId: "spectrophotometer", accessibleLabel: "Read a fresh absorbance from the inserted reacting sample." },
      prerequisites: [{ id: "kinetics-time-coordinate-required", type: "measurementRecorded", label: "The paired elapsed time is freshly recorded.", measurementId: "kinetics-scheduled-time" }],
      evidence: ["observe", "measurement", "raw-instrument-observation"],
      atomId: "atom.observe.read-photometer",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
    }),
    action({
      id: "record-cv-scheduled-absorbance", verb: "record", label: "Record the paired raw absorbance",
      parameters: {
        measurementId: "kinetics-scheduled-absorbance", label: "{{config.absorbanceLabel}}", unit: "absorbance",
        pairId: "{{config.pairId}}", scheduledTimeMeasurementId: "kinetics-scheduled-time",
        copyExistingMeasurementOnly: true, evidenceLayer: "raw-time-series-row", excludesModelFitOrSelection: true,
      },
      interaction: { type: "recordNotebook", valueParameter: "measurementId", accessibleLabel: "Copy the fresh instrument observation into its paired raw time-series row." },
      prerequisites: [{ id: "kinetics-fresh-absorbance-required", type: "measurementRecorded", label: "A fresh absorbance was read for this scheduled point.", measurementId: "kinetics-scheduled-absorbance" }],
      evidence: ["record", "measurement", "raw-time-series-row"],
      atomId: "atom.record.photometer-reading",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
    }),
  ];

  const nodes = actions.map(node);
  const edges = nodes.slice(1).map((item, index) => ({ from: nodes[index].id, to: item.id, label: "Next", condition: { type: "validationPassed" } }));
  const initialEquipment = [
    equipment("kinetics-cv-stock", "sample-bottle", "Crystal-violet stock", {
      kind: "solution", label: "Teacher-configured crystal-violet stock", volumeMl: 40, solutes: [],
      concentration: { value: 0.000025, unit: "M" }, contamination: [], wetState: "wet", visualState: "purple-solution",
    }),
    equipment("kinetics-naoh-stock", "reagent-bottle", "Sodium-hydroxide solution", {
      kind: "solution", label: "Teacher-configured sodium hydroxide", volumeMl: 40, solutes: [],
      concentration: { value: 0.2, unit: "M" }, contamination: [], wetState: "wet", visualState: "clear-liquid",
    }),
    equipment("kinetics-cv-pipette", "graduated-pipette-10ml", "Crystal-violet-only pipette"),
    equipment("kinetics-naoh-pipette", "graduated-pipette-10ml", "Sodium-hydroxide-only pipette"),
    equipment("kinetics-reaction-vessel", "test-tube", "Kinetics reaction vessel"),
    equipment("kinetics-transfer-pipette", "beral-pipette", "Clean kinetics transfer pipette"),
    equipment("kinetics-reaction-cuvette", "cuvette", "Kinetics reaction cuvette"),
    equipment("kinetics-spectrophotometer", "spectrophotometer", "Spectrophotometer"),
    equipment("kinetics-stopwatch", "stopwatch", "Reaction stopwatch"),
  ];
  const roleDefinitions = new Map();
  for (const item of actions) for (const [roleId, definitionId] of Object.entries(item.equipmentRoleBindings ?? {})) {
    const definitions = roleDefinitions.get(roleId) ?? new Set(); definitions.add(definitionId); roleDefinitions.set(roleId, definitions);
  }

  return {
    ...input,
    title: "Crystal Violet Timed Kinetics",
    learningGoal: "Keep reactants separate until the approved contact-defined time zero, preserve transfer dead time, and acquire fresh paired time/absorbance evidence before any rate-law comparison.",
    requiredEquipment: [...new Set(initialEquipment.map((item) => item.definitionId))],
    initialState: { equipment: initialEquipment }, actions,
    process: { startNodeId: nodes[0].id, nodes, edges }, successCriteria: [], commonMistakes: invalidCases,
    metadata: { ...input.metadata, version: "1.2.0", updatedAt: "2026-09-06T00:00:00.000Z", tags: ["technique", "kinetics", "crystal-violet", "timed-acquisition", "composition"] },
    composition: {
      schemaVersion: 1,
      ports: [{ id: "entry", kind: "entry", nodeId: nodes[0].id }, { id: "exit", kind: "exit", nodeId: nodes.at(-1).id }],
      equipmentRoles: [...roleDefinitions].map(([roleId, definitions]) => ({
        roleId, required: true, allowedDefinitionIds: [...definitions],
        sourceInstanceIds: initialEquipment.filter((item) => definitions.has(item.definitionId)).map((item) => item.id),
      })),
      modelSlots: [], configurationSlots, approvalGates: [], variants: [],
      evidenceOutputs: actions.map((item) => ({ id: `evidence-${item.id}`, kind: item.interaction.type === "readInstrument" ? "measurement" : item.verb === "record" ? "notebook" : "action-evidence", actionId: item.id })),
      completion: { exitPortIds: ["exit"], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
      catalogDisposition: "lab-scoped",
      legacyActionEffects: actions.filter((item) => !item.atomId).map((item) => notebookEffect(item.id)),
      orderedProcedure: {
        configurationSlotId: "selectedProcedure", startActionIds: [], endActionIds: [], minimumTests: 1, resources: [],
        groups: [
          { id: "reaction-initiation", actionIds: actions.slice(0, 8).map((item) => item.id), testCount: 1, evidenceKind: "procedure" },
          { id: "scheduled-reading", actionIds: actions.slice(8).map((item) => item.id), testCount: 1, evidenceKind: "quantitative" },
        ],
      },
    },
  };
};
