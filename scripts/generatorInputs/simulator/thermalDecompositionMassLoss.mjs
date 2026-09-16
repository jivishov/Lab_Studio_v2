/**
 * Cycle 11-owned simulator definition refinement.
 *
 * This module intentionally contains no file-system or network work. The shared generator owns
 * serialization; this lane owns only the data returned for thermal-decomposition-mass-loss.
 */

const emptyContents = () => ({
  kind: "empty",
  label: "empty",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
});

const equipment = (id, definitionId, label, contents = emptyContents()) => ({
  id,
  definitionId,
  label,
  location: "shelf",
  contents,
});

const interactionEffects = {
  dragToZone: {
    classes: ["apparatus-material-instrument-state"],
    targets: [{ domain: "equipment" }],
  },
  snapIntoTarget: {
    classes: ["apparatus-material-instrument-state"],
    targets: [{ domain: "equipment" }, { domain: "instrument" }],
  },
  pourInto: {
    classes: ["apparatus-material-instrument-state"],
    targets: [{ domain: "equipment" }, { domain: "material" }],
  },
  placeInInstrument: {
    classes: ["apparatus-material-instrument-state"],
    targets: [{ domain: "equipment" }, { domain: "instrument" }, { domain: "material" }],
  },
  readInstrument: {
    classes: ["measurement-direct-observation-acquisition"],
    targets: [{ domain: "instrument" }, { domain: "measurement-observation" }, { domain: "evidence" }],
  },
  recordNotebook: {
    classes: ["evidence-recording"],
    targets: [{ domain: "evidence" }],
  },
  submitCalculation: {
    classes: ["calculation-analysis"],
    targets: [{ domain: "analysis" }, { domain: "evidence" }],
  },
};

const commonInvalidCases = [
  {
    id: "wrong-order",
    when: "the route requests this operation before its compiled prerequisite",
    message: "That operation is out of sequence for the approved method.",
    recovery: "Return to the highlighted prerequisite and preserve the current evidence.",
  },
  {
    id: "teacher-approval-required",
    when: "physical execution is requested before the inquiry plan is approved",
    message: "Physical execution is locked until the teacher approves the plan and safety controls.",
    recovery: "Complete the plan, configuration, PPE, and report assignment before approval.",
  },
  {
    id: "same-balance-required",
    when: "a mass is requested from a different balance than the baseline balance",
    message: "Every mass in the run must use the same balance.",
    recovery: "Return to the balance locked by the empty-crucible reading or restart the run.",
  },
];

/**
 * The four balance readings in this run share one identity: observe and record the value the
 * selected balance indicates for the crucible-plus-lid assembly. The atom deliberately describes
 * only the reading. It does not decide the tare convention — confirmation point 4 of the dated
 * plan leaves that open, and `tareConvention` is a required teacher-configured slot with two
 * allowed values — so it asserts neither an instrument zero nor a gross-versus-net interpretation.
 * The cool/dry, prior-step and same-balance obligations stay on each action's own parameters and
 * prerequisites; the atom claims no runtime enforcement of them.
 */
const balanceDisplayAtomId = "atom.weigh.vessel-supported-balance-display";

const specs = [
  {
    id: "approve-thermal-decomposition-plan",
    verb: "record",
    label: "Approve the thermal-decomposition plan",
    interaction: "recordNotebook",
    parameters: {
      tag: "thermal-decomposition-plan-approved",
      inputMode: "choice",
      inputRole: "teacherConfiguration",
      inputRequired: true,
      inputOptions: ["Teacher approved"],
      tareConvention: "{{config.tareConvention}}",
      note: "Approval binds the learner plan, PPE, heating, cooling, balance, constant-mass, replicate, recovery, and report choices for this run.",
    },
    evidence: ["approval", "notebook"],
  },
  {
    // The AP source states no stock total: it leaves sample amount and replicate count to the
    // learner's plan and the teacher's configuration. The quantity is therefore a live teacher
    // setup value rather than a compiled slot or a source-derived amount, and this action carries
    // no `config.*` binding and claims no source example.
    id: "configure-unheated-stock",
    verb: "observe",
    label: "Configure the available unheated mixture stock",
    atomId: "atom.observe.configure-solid-stock-inventory",
    interaction: "recordNotebook",
    sourceDefinitionId: "sample-bottle",
    parameters: {
      sourceInstanceId: "sample-bottle-1",
      sourceDefinitionId: "sample-bottle",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputRequired: true,
      unit: "g",
      note: "The total prepared mixture the class may draw on. Each replicate is issued a working portion from it, and whatever is left is returned to Unused Sample when the run closes.",
    },
    sourceInventory: {
      quantityKind: "solid-mass",
      sourceInstanceId: "sample-bottle-1",
      sourceDefinitionId: "sample-bottle",
      outputMeasurementId: "unheated-stock-configured-g",
      materialSoluteId: "carbonate-mixture-undisclosed",
      materialLabel: "NaHCO3 and Na2CO3 mixture; composition not disclosed",
    },
    roles: { "solid-reagent-source": "sample-bottle" },
    evidence: ["observe", "notebook", "setup"],
  },
  {
    id: "place-balance",
    verb: "place",
    label: "Place and lock one analytical balance",
    interaction: "dragToZone",
    sourceDefinitionId: "analytical-balance",
    stationId: "workbench",
    parameters: { equipmentDefinitionId: "analytical-balance", location: "workbench", balanceChoiceFromRoute: true },
    roles: { "balance-instrument": "analytical-balance" },
  },
  {
    id: "place-empty-crucible",
    verb: "place",
    label: "Place the cool empty crucible and lid",
    interaction: "dragToZone",
    sourceDefinitionId: "crucible-with-lid",
    stationId: "workbench",
    parameters: { equipmentDefinitionId: "crucible-with-lid", location: "workbench", requireCoolDryAssembly: true },
    roles: { "weighed-vessel": "crucible-with-lid" },
  },
  {
    id: "read-empty-crucible",
    verb: "weigh",
    label: "Read the empty crucible and lid mass",
    atomId: balanceDisplayAtomId,
    interaction: "readInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "analytical-balance",
    stationId: "balance",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      instrumentDefinitionId: "analytical-balance",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputRequired: true,
      unit: "g",
      maxSafeTemperatureC: "{{config.coolingEndpointC}}",
      sameBalanceRequired: true,
    },
    roles: { "balance-instrument": "analytical-balance", "weighed-vessel": "crucible-with-lid" },
    mass: {
      source: "action-input",
      outputMeasurementId: "empty-crucible-mass",
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "crucible-with-lid-1",
      },
    },
    evidence: ["weigh", "measurement", "student-entered-reading"],
  },
  {
    id: "record-empty-crucible",
    verb: "record",
    label: "Record the empty crucible and lid mass",
    interaction: "recordNotebook",
    parameters: { measurementId: "empty-crucible-mass", unit: "g", requirePriorInstrumentReading: true, tareConvention: "{{config.tareConvention}}" },
    evidence: ["record", "notebook"],
  },
  {
    // EX-06 loads a *planned* mixture mass and EX-07 then reads the actual loaded mass, so the
    // single authoritative amount here stays the compiled plan target and the balance reading
    // stays separate evidence. The source is the working vial rather than the master stock: the
    // route issues one working portion from the stock immediately before this load, so the excess
    // EX-08 returns is this replicate's own leftover and the remaining replicates keep their supply.
    id: "add-carbonate-sample",
    verb: "transfer",
    label: "Transfer the approved carbonate-mixture portion",
    interaction: "pourInto",
    sourceDefinitionId: "small-vial",
    targetDefinitionId: "crucible-with-lid",
    parameters: {
      sourceInstanceId: "working-sample-portion-1",
      sourceDefinitionId: "small-vial",
      targetInstanceId: "crucible-with-lid-1",
      targetDefinitionId: "crucible-with-lid",
      massG: "{{config.sampleMassG}}",
      massIsPlanTargetNotMeasurement: true,
      targetLabel: "Crucible containing the carbonate mixture",
      visualState: "powder",
    },
    solidTransfer: { mode: "measured-portion", destinationRepresentation: "physical" },
    roles: { "solid-reagent-source": "small-vial", "weighed-vessel": "crucible-with-lid" },
    evidence: ["transfer"],
  },
  {
    id: "weigh-initial-crucible",
    verb: "weigh",
    label: "Read the loaded crucible and lid mass",
    atomId: balanceDisplayAtomId,
    interaction: "readInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "analytical-balance",
    stationId: "balance",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      instrumentDefinitionId: "analytical-balance",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputRequired: true,
      unit: "g",
      maxSafeTemperatureC: "{{config.coolingEndpointC}}",
      sameBalanceRequired: true,
    },
    roles: { "balance-instrument": "analytical-balance", "weighed-vessel": "crucible-with-lid" },
    mass: {
      source: "action-input",
      outputMeasurementId: "loaded-crucible-mass",
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "crucible-with-lid-1",
      },
    },
    evidence: ["weigh", "measurement", "student-entered-reading"],
  },
  {
    id: "record-initial-crucible-mass",
    verb: "record",
    label: "Record the loaded crucible and lid mass",
    interaction: "recordNotebook",
    parameters: { measurementId: "loaded-crucible-mass", unit: "g", requirePriorInstrumentReading: true },
    evidence: ["record", "notebook"],
  },
  {
    // EX-08 sits between the recorded loaded mass and the lid/heating steps, and returns the
    // excess that was never heated. What is left over is this replicate's working remainder
    // (W - p), so the whole remaining vial contents move. A genuinely empty vial is a truthful
    // outcome, not a failure: when the issued portion equals the planned portion there is nothing
    // to return, and `requireNonEmptySource: false` lets that complete as an explicit zero.
    id: "recover-unused-sample",
    verb: "transfer",
    label: "Recover unused unheated mixture",
    atomId: "atom.transfer.unheated-mixture-to-labeled-recovery",
    interaction: "pourInto",
    sourceDefinitionId: "small-vial",
    targetDefinitionId: "beaker-250ml",
    parameters: {
      sourceInstanceId: "working-sample-portion-1",
      sourceDefinitionId: "small-vial",
      targetInstanceId: "unused-sample-recovery-1",
      targetDefinitionId: "beaker-250ml",
      targetLabel: "Unused Sample — unheated",
    },
    solidTransfer: { mode: "whole-remaining", destinationRepresentation: "physical", requireNonEmptySource: false },
    roles: { "solid-reagent-source": "small-vial", "recovery-vessel": "beaker-250ml" },
    evidence: ["transfer", "recovery", "provenance"],
  },
  {
    id: "place-ring-stand",
    verb: "place",
    label: "Place the ring stand",
    interaction: "dragToZone",
    sourceDefinitionId: "ring-stand",
    stationId: "workbench",
    parameters: { equipmentDefinitionId: "ring-stand", location: "workbench" },
  },
  {
    id: "add-clay-triangle",
    verb: "place",
    label: "Seat the clay triangle",
    interaction: "snapIntoTarget",
    sourceDefinitionId: "clay-triangle",
    targetDefinitionId: "ring-stand",
    parameters: { equipmentDefinitionId: "clay-triangle", snapZoneId: "ring-stand-clay-triangle-seat" },
  },
  {
    id: "place-bunsen-burner",
    verb: "place",
    label: "Place the Bunsen burner beneath the support",
    interaction: "dragToZone",
    sourceDefinitionId: "bunsen-burner",
    stationId: "workbench",
    parameters: { equipmentDefinitionId: "bunsen-burner", location: "workbench" },
  },
  {
    id: "place-crucible-on-support",
    verb: "place",
    label: "Place the crucible on the clay triangle",
    interaction: "snapIntoTarget",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "ring-stand",
    parameters: { equipmentDefinitionId: "crucible-with-lid", targetDefinitionId: "ring-stand", snapZoneId: "ring-stand-crucible-seat" },
    roles: { "weighed-vessel": "crucible-with-lid" },
  },
  {
    id: "set-crucible-lid",
    verb: "place",
    label: "Set and inspect the crucible lid position",
    interaction: "dragToZone",
    sourceDefinitionId: "crucible-with-lid",
    stationId: "workbench",
    parameters: {
      sourceInstanceId: "crucible-with-lid-1",
      positionFromRoute: true,
      requiredHeatingPosition: "askew",
      closedLidBlocksHeating: true,
    },
    roles: { "weighed-vessel": "crucible-with-lid" },
    evidence: ["place", "safety-state"],
  },
  {
    id: "warm-gently",
    verb: "dry",
    label: "Warm the covered mixture gently",
    interaction: "placeInInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "bunsen-burner",
    stationId: "heating",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "bunsen-burner",
      durationMin: "{{config.warmDurationMin}}",
      intensity: "gentle",
      lidPositionRequired: "askew",
      durationIsTeacherConfigured: true,
    },
    roles: { "weighed-vessel": "crucible-with-lid" },
    evidence: ["heat", "safety-state"],
  },
  {
    id: "heat-carbonate-mixture",
    verb: "dry",
    label: "Heat the carbonate mixture using the approved plan",
    interaction: "placeInInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "bunsen-burner",
    stationId: "heating",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "bunsen-burner",
      durationMin: "{{config.heatingDurationMin}}",
      intensity: "{{config.heatingIntensity}}",
      lidPositionRequired: "askew",
      noAuthoredProductMass: true,
    },
    roles: { "weighed-vessel": "crucible-with-lid" },
    evidence: ["heat"],
  },
  {
    id: "turn-off-burner",
    verb: "reset",
    label: "Turn off the burner before moving the crucible",
    interaction: "dragToZone",
    sourceDefinitionId: "bunsen-burner",
    stationId: "workbench",
    parameters: { sourceDefinitionId: "bunsen-burner", operation: "extinguish", requireBeforeCooling: true },
    evidence: ["apparatus-state", "safety-state"],
  },
  {
    id: "cool-crucible",
    verb: "cool",
    label: "Move with tongs and cool after the first heat",
    interaction: "placeInInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "crucible-tongs",
    stationId: "heating",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      coolingToolInstanceId: "crucible-tongs-1",
      coolingEndpointC: "{{config.coolingEndpointC}}",
      coolingSurface: "{{config.coolingSurface}}",
      requireBurnerOff: true,
    },
    roles: { "weighed-vessel": "crucible-with-lid", "cooling-tool": "crucible-tongs" },
    evidence: ["cool", "safety-state"],
  },
  {
    id: "weigh-preliminary-final-mass",
    verb: "weigh",
    label: "Read the first cooled-cycle mass",
    atomId: balanceDisplayAtomId,
    interaction: "readInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "analytical-balance",
    stationId: "balance",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      instrumentDefinitionId: "analytical-balance",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputRequired: true,
      unit: "g",
      maxSafeTemperatureC: "{{config.coolingEndpointC}}",
      sameBalanceRequired: true,
      noAuthoredExpectedMass: true,
    },
    roles: { "balance-instrument": "analytical-balance", "weighed-vessel": "crucible-with-lid" },
    mass: {
      source: "action-input",
      outputMeasurementId: "cooled-cycle-mass",
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "crucible-with-lid-1",
      },
    },
    evidence: ["weigh", "measurement", "student-entered-reading"],
  },
  {
    id: "record-cycle-mass",
    verb: "record",
    label: "Record and compare the cooled-cycle mass",
    interaction: "recordNotebook",
    parameters: {
      measurementId: "cooled-cycle-mass",
      unit: "g",
      constantMassToleranceG: "{{config.constantMassToleranceG}}",
      requirePriorInstrumentReading: true,
      comparisonUsesConsecutiveRecordedReadings: true,
    },
    evidence: ["record", "notebook", "constant-mass-comparison"],
  },
  {
    id: "repeat-heat-to-constant-mass",
    verb: "dry",
    label: "Repeat the approved heat stage",
    interaction: "placeInInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "bunsen-burner",
    stationId: "heating",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "bunsen-burner",
      durationMin: "{{config.heatingDurationMin}}",
      intensity: "{{config.heatingIntensity}}",
      maximumHeatCycles: "{{config.maximumHeatCycles}}",
      lidPositionRequired: "askew",
      stopWhenConstantMassReached: true,
      noAuthoredProductMass: true,
    },
    roles: { "weighed-vessel": "crucible-with-lid" },
    evidence: ["heat", "bounded-repeat"],
  },
  {
    id: "cool-constant-mass-crucible",
    verb: "cool",
    label: "Move with tongs and cool after repeat heating",
    interaction: "placeInInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "crucible-tongs",
    stationId: "heating",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      coolingToolInstanceId: "crucible-tongs-1",
      coolingEndpointC: "{{config.coolingEndpointC}}",
      coolingSurface: "{{config.coolingSurface}}",
      requireBurnerOff: true,
    },
    roles: { "weighed-vessel": "crucible-with-lid", "cooling-tool": "crucible-tongs" },
    evidence: ["cool", "safety-state"],
  },
  {
    id: "weigh-final-crucible",
    verb: "weigh",
    label: "Read a subsequent cooled-cycle mass",
    atomId: balanceDisplayAtomId,
    interaction: "readInstrument",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "analytical-balance",
    stationId: "balance",
    parameters: {
      sourceDefinitionId: "crucible-with-lid",
      instrumentDefinitionId: "analytical-balance",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputRequired: true,
      unit: "g",
      maxSafeTemperatureC: "{{config.coolingEndpointC}}",
      sameBalanceRequired: true,
      noAuthoredExpectedMass: true,
    },
    roles: { "balance-instrument": "analytical-balance", "weighed-vessel": "crucible-with-lid" },
    mass: {
      source: "action-input",
      outputMeasurementId: "final-cooled-crucible-mass",
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "crucible-with-lid-1",
      },
    },
    evidence: ["weigh", "measurement", "student-entered-reading"],
  },
  {
    id: "record-final-crucible-mass",
    verb: "record",
    label: "Record the constant final mass",
    interaction: "recordNotebook",
    parameters: {
      measurementId: "final-cooled-crucible-mass",
      unit: "g",
      requireConstantMassComparison: true,
      constantMassToleranceG: "{{config.constantMassToleranceG}}",
    },
    evidence: ["record", "notebook", "constant-mass"],
  },
  {
    // EX-19 moves the cooled residue out of the crucible into the labelled product container. It
    // was previously an observation of the destination beaker, which moved nothing; it is now a
    // real transfer whose source is the crucible it empties.
    //
    // The destination is qualitative: the source's data list records the empty and loaded crucible
    // masses, each cycle mass, the accepted final residue mass and the mass lost, but never a
    // product mass. Writing the input mass onto the receiver would state a known-wrong fact, so the
    // receiver takes a provenance record and no `massG`.
    id: "recover-replicate-product",
    verb: "transfer",
    label: "Recover the cooled replicate product into its labeled vessel",
    atomId: "atom.transfer.heated-product-to-labeled-recovery",
    interaction: "pourInto",
    sourceDefinitionId: "crucible-with-lid",
    targetDefinitionId: "beaker-250ml",
    parameters: {
      sourceInstanceId: "crucible-with-lid-1",
      sourceDefinitionId: "crucible-with-lid",
      targetInstanceId: "heated-product-recovery-1",
      targetDefinitionId: "beaker-250ml",
      targetLabel: "Product Made from Heating Samples",
      requireCoolConstantMass: true,
    },
    solidTransfer: { mode: "whole-remaining", destinationRepresentation: "qualitative-unknown", requireNonEmptySource: true },
    roles: { "weighed-vessel": "crucible-with-lid", "recovery-vessel": "beaker-250ml" },
    evidence: ["transfer", "recovery", "provenance"],
  },
  {
    id: "complete-replicate",
    verb: "record",
    label: "Complete and isolate the replicate evidence",
    interaction: "recordNotebook",
    parameters: { tag: "replicate-complete", minimumReplicates: "{{config.minimumReplicates}}", preserveEvidenceByReplicate: true },
    evidence: ["record", "notebook", "replicate"],
  },
  {
    // Returning whatever mixture the class never used. S-07 requires the unheated material to end
    // up in its own labelled container, but the manual states no closing step of its own, so this
    // is an authored real-life-implicit/configuration action (R/C): it reuses the EX-08 recovery
    // identity and destination without claiming a second EX-08 source citation.
    //
    // It is a normal manifested action so the route never needs an unmanifested escape hatch to
    // close a run. A genuinely empty master is a truthful zero cleanup.
    id: "finalize-unused-master-stock",
    verb: "transfer",
    label: "Return the remaining master stock to Unused Sample",
    atomId: "atom.transfer.unheated-mixture-to-labeled-recovery",
    interaction: "pourInto",
    sourceDefinitionId: "sample-bottle",
    targetDefinitionId: "beaker-250ml",
    parameters: {
      sourceInstanceId: "sample-bottle-1",
      sourceDefinitionId: "sample-bottle",
      targetInstanceId: "unused-sample-recovery-1",
      targetDefinitionId: "beaker-250ml",
      targetLabel: "Unused Sample — unheated",
      minimumReplicates: "{{config.minimumReplicates}}",
    },
    solidTransfer: { mode: "whole-remaining", destinationRepresentation: "physical", requireNonEmptySource: false },
    roles: { "solid-reagent-source": "sample-bottle", "recovery-vessel": "beaker-250ml" },
    evidence: ["transfer", "recovery", "provenance"],
  },
  {
    id: "calculate-carbonate-composition",
    verb: "calculate",
    label: "Calculate composition from recorded mass loss",
    interaction: "submitCalculation",
    valueParameter: "calculationId",
    parameters: {
      calculationId: "composition-analysis",
      template: "carbonateMassLossComposition",
      emptyMassMeasurementId: "empty-crucible-mass",
      initialMassMeasurementId: "loaded-crucible-mass",
      finalMassMeasurementId: "final-cooled-crucible-mass",
      tareConvention: "{{config.tareConvention}}",
      requireStudentValue: true,
      noAuthoredExpectedResult: true,
      reactionEquation: "2 NaHCO3(s) -> Na2CO3(s) + CO2(g) + H2O(g)",
    },
    evidence: ["calculate", "measurement-derived"],
  },
  {
    id: "record-composition-uncertainty",
    verb: "record",
    label: "Record composition uncertainty and limitations",
    interaction: "recordNotebook",
    parameters: { tag: "composition-uncertainty", inputMode: "text", inputRole: "studentResponse", inputRequired: true },
    evidence: ["record", "notebook", "uncertainty"],
  },
  {
    // Every replicate already moved its own product at EX-19, so this final step must not move
    // material a second time. It keeps its public action id and its exit connection but becomes a
    // pure confirmation that all recoveries are accounted for: no atom, no source, no target, no
    // equipment role and no fraction contract.
    id: "recover-final-product",
    verb: "record",
    label: "Confirm every recovery is accounted for",
    interaction: "recordNotebook",
    valueParameter: "inputKey",
    parameters: {
      tag: "all-recoveries-confirmed",
      inputKey: "recover-final-product-done",
      inputMode: "choice",
      inputRole: "studentResponse",
      inputRequired: true,
      inputOptions: ["completed"],
    },
    evidence: ["record", "notebook", "recovery"],
  },
];

const actions = specs.map((spec, index) => ({
  id: spec.id,
  verb: spec.verb,
  label: spec.label,
  ...(spec.atomId ? { atomId: spec.atomId } : {}),
  ...(spec.roles ? { equipmentRoleBindings: spec.roles } : {}),
  ...(spec.fractionHandling ? { fractionHandling: spec.fractionHandling } : {}),
  ...(spec.mass ? { mass: spec.mass } : {}),
  ...(spec.sourceInventory ? { sourceInventory: spec.sourceInventory } : {}),
  ...(spec.solidTransfer ? { solidTransfer: spec.solidTransfer } : {}),
  parameters: spec.parameters,
  interaction: {
    type: spec.interaction,
    ...(spec.sourceDefinitionId ? { sourceDefinitionId: spec.sourceDefinitionId } : {}),
    ...(spec.targetDefinitionId ? { targetDefinitionId: spec.targetDefinitionId } : {}),
    ...(spec.stationId ? { stationId: spec.stationId } : {}),
    ...(spec.valueParameter ? { valueParameter: spec.valueParameter } : {}),
    accessibleLabel: spec.label,
    successCue: `${spec.label} complete.`,
    invalidCue: `Review the approved sequence before ${spec.label.toLowerCase()}.`,
  },
  prerequisites: index === 0 ? [] : [{
    id: `${spec.id}-prerequisite`,
    type: "actionEvidence",
    label: `${specs[index - 1].label} is complete.`,
    actionId: specs[index - 1].id,
  }],
  stateChanges: [`${spec.label}: route state and evidence advance only after validation.`],
  invalidCases: commonInvalidCases,
  feedback: {
    success: `${spec.label} complete.`,
    invalid: `Review the approved sequence before ${spec.label.toLowerCase()}.`,
  },
  evidence: spec.evidence ?? [spec.verb],
}));

const nodes = specs.map((spec, index) => ({
  id: `${spec.id}-node`,
  type: spec.interaction === "submitCalculation" ? "calculation" : spec.interaction === "recordNotebook" ? "observation" : "action",
  title: spec.label,
  description: spec.label,
  actionId: spec.id,
  config: {
    sourceBoundary: "purify-a-mixture-green-chemistry_2026-07-27.md",
    operationIndex: index + 1,
  },
  validation: [{
    id: `${spec.id}-complete`,
    type: "actionEvidence",
    label: `${spec.label} is complete.`,
    actionId: spec.id,
  }],
  hints: [],
  feedback: {
    success: `${spec.label} complete.`,
    retry: `Complete ${spec.label.toLowerCase()} using the approved plan.`,
  },
}));

const evidenceOutputs = [
  ["approval", "action-evidence", "approve-thermal-decomposition-plan", "thermal-decomposition-plan-approved"],
  ["unheated-stock-configured", "measurement", "configure-unheated-stock", "unheated-stock-configured-g"],
  ["empty-mass", "measurement", "read-empty-crucible", "empty-crucible-mass"],
  ["empty-mass-record", "notebook", "record-empty-crucible", "empty-crucible-mass"],
  ["loaded-mass", "measurement", "weigh-initial-crucible", "loaded-crucible-mass"],
  ["loaded-mass-record", "notebook", "record-initial-crucible-mass", "loaded-crucible-mass"],
  ["unused-sample-recovery", "action-evidence", "recover-unused-sample", "unused-sample-recovery"],
  ["cycle-mass", "measurement", "weigh-preliminary-final-mass", "cooled-cycle-mass"],
  ["cycle-mass-record", "notebook", "record-cycle-mass", "cooled-cycle-mass"],
  ["final-mass", "measurement", "weigh-final-crucible", "final-cooled-crucible-mass"],
  ["final-mass-record", "notebook", "record-final-crucible-mass", "final-cooled-crucible-mass"],
  ["replicate-recovery", "action-evidence", "recover-replicate-product", "replicate-product-recovery"],
  ["replicate-completion", "notebook", "complete-replicate", "replicate-complete"],
  ["unused-master-stock-finalized", "action-evidence", "finalize-unused-master-stock", "unused-master-stock-finalized"],
  ["composition-calculation", "calculation", "calculate-carbonate-composition", "composition-analysis"],
  ["uncertainty-record", "notebook", "record-composition-uncertainty", "composition-uncertainty"],
  ["final-product-recovery", "action-evidence", "recover-final-product", "final-product-recovery"],
].map(([id, kind, actionId, referenceId]) => ({ id, kind, actionId, referenceId }));

const definition = {
  id: "thermal-decomposition-mass-loss",
  title: "Approved Thermal Decomposition and Constant-Mass Evidence",
  learningGoal: "Execute a teacher-approved carbonate-mixture plan with a configured sample mass, tare convention, heating/cooling limits, and replicate decision; acquire and separately record same-balance mass evidence, establish constant mass, derive composition, and preserve recovery provenance.",
  requiredEquipment: [
    "analytical-balance",
    "crucible-with-lid",
    "sample-bottle",
    "small-vial",
    "ring-stand",
    "clay-triangle",
    "bunsen-burner",
    "crucible-tongs",
    "beaker-250ml",
  ],
  initialState: {
    equipment: [
      equipment("analytical-balance-a", "analytical-balance", "Analytical balance A"),
      equipment("analytical-balance-b", "analytical-balance", "Analytical balance B"),
      equipment("crucible-with-lid-1", "crucible-with-lid", "Clean, dry crucible with lid"),
      // The master stock starts empty and is filled by `configure-unheated-stock`, so the run
      // always draws on a quantity a teacher actually set rather than on an abstract bottle that
      // could never run out. The working vial starts empty too and holds one issued portion at a
      // time; EX-08 returns whatever of that portion the crucible did not take.
      equipment("sample-bottle-1", "sample-bottle", "Teacher-supplied NaHCO3 / Na2CO3 mixture"),
      equipment("working-sample-portion-1", "small-vial", "Working portion for this replicate"),
      equipment("ring-stand-1", "ring-stand", "Ring stand"),
      equipment("clay-triangle-1", "clay-triangle", "Clay triangle"),
      equipment("bunsen-burner-1", "bunsen-burner", "Bunsen burner"),
      equipment("crucible-tongs-1", "crucible-tongs", "Crucible tongs"),
      equipment("unused-sample-recovery-1", "beaker-250ml", "Unused Sample — unheated"),
      equipment("heated-product-recovery-1", "beaker-250ml", "Product Made from Heating Samples"),
    ],
  },
  actions,
  process: {
    startNodeId: nodes[0].id,
    nodes,
    edges: nodes.slice(0, -1).map((current, index) => ({
      from: current.id,
      to: nodes[index + 1].id,
      label: "Next approved operation",
      condition: { type: "validationPassed" },
    })),
  },
  successCriteria: [
    {
      id: "constant-final-mass-recorded",
      type: "actionEvidence",
      label: "A constant final mass is recorded.",
      actionId: "record-final-crucible-mass",
    },
    {
      id: "composition-derived-from-measurements",
      type: "actionEvidence",
      label: "Composition is derived from recorded mass evidence.",
      actionId: "calculate-carbonate-composition",
    },
    {
      id: "final-product-recovered-separately",
      type: "actionEvidence",
      // Each replicate moved its own product at EX-19; the final step confirms that every one of
      // them, and all the unheated mixture, is accounted for in its own labelled container.
      label: "Every replicate product is recovered separately and all recoveries are confirmed.",
      actionId: "recover-final-product",
    },
  ],
  commonMistakes: [
    {
      id: "closed-lid-heating",
      when: "heating is attempted with the lid fully seated",
      message: "A fully seated lid can trap evolved gas and be ejected.",
      recovery: "Turn off the burner and leave a visible vent gap before heating.",
    },
    {
      id: "hot-weighing",
      when: "the crucible is placed on the balance before cooling",
      message: "Hot apparatus can damage the balance and produce biased readings.",
      recovery: "Use tongs, cool at the approved location, then read the locked balance.",
    },
    {
      id: "single-reading-claim",
      when: "constant mass is claimed from one cooled reading",
      message: "Constant mass requires two consecutive cooled readings within the approved tolerance.",
      recovery: "Repeat the full heat, extinguish, cool, read, and record sequence.",
    },
  ],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "2.0.1",
    author: "Lab Studio",
    updatedAt: "2026-09-06T00:00:00.000Z",
    tags: ["technique", "thermal-decomposition", "constant-mass", "inquiry", "measurement-evidence", "green-chemistry"],
  },
  composition: {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: "approve-thermal-decomposition-plan-node", label: "Approved inquiry entry" },
      { id: "exit", kind: "exit", nodeId: "recover-final-product-node", label: "Final product recovery complete" },
    ],
    equipmentRoles: [
      { roleId: "balance-instrument", required: true, allowedDefinitionIds: ["analytical-balance"], sourceInstanceIds: ["analytical-balance-a", "analytical-balance-b"] },
      { roleId: "weighed-vessel", required: true, allowedDefinitionIds: ["crucible-with-lid"], sourceInstanceIds: ["crucible-with-lid-1"] },
      { roleId: "solid-reagent-source", required: true, allowedDefinitionIds: ["sample-bottle", "small-vial"], sourceInstanceIds: ["sample-bottle-1", "working-sample-portion-1"] },
      { roleId: "receiving-vessel", required: true, allowedDefinitionIds: ["crucible-with-lid"], sourceInstanceIds: ["crucible-with-lid-1"] },
      { roleId: "thermal-support", required: true, allowedDefinitionIds: ["ring-stand", "clay-triangle"], sourceInstanceIds: ["ring-stand-1", "clay-triangle-1"] },
      { roleId: "thermal-heating-instrument", required: true, allowedDefinitionIds: ["bunsen-burner"], sourceInstanceIds: ["bunsen-burner-1"] },
      { roleId: "cooling-tool", required: true, allowedDefinitionIds: ["crucible-tongs"], sourceInstanceIds: ["crucible-tongs-1"] },
      { roleId: "dried-assembly", required: true, allowedDefinitionIds: ["crucible-with-lid"], sourceInstanceIds: ["crucible-with-lid-1"] },
      { roleId: "recovery-vessel", required: true, allowedDefinitionIds: ["beaker-250ml"], sourceInstanceIds: ["unused-sample-recovery-1", "heated-product-recovery-1"] },
    ],
    modelSlots: [],
    configurationSlots: [
      { id: "sampleMassG", valueType: "number", required: true },
      { id: "warmDurationMin", valueType: "number", required: true },
      { id: "heatingDurationMin", valueType: "number", required: true },
      { id: "heatingIntensity", valueType: "string", required: true },
      { id: "constantMassToleranceG", valueType: "number", required: true },
      { id: "maximumHeatCycles", valueType: "number", required: true },
      { id: "coolingEndpointC", valueType: "number", required: true },
      { id: "coolingSurface", valueType: "string", required: true },
      { id: "tareConvention", valueType: "string", required: true, allowedValues: ["record-crucible-plus-lid", "tare-balance-with-crucible-plus-lid"] },
      { id: "minimumReplicates", valueType: "number", required: true },
    ],
    approvalGates: [{ id: "teacher-approved-plan", label: "Teacher approved the inquiry plan and safety configuration" }],
    variants: [],
    evidenceOutputs,
    completion: {
      exitPortIds: ["exit"],
      requiredEvidenceOutputIds: evidenceOutputs.map((output) => output.id),
      requiredValidationRuleIds: ["constant-final-mass-recorded", "composition-derived-from-measurements", "final-product-recovered-separately"],
    },
    catalogDisposition: "lab-scoped",
    legacyActionEffects: specs.filter((spec) => !spec.atomId).map((spec) => ({
      actionId: spec.id,
      effect: spec.effect ?? interactionEffects[spec.interaction],
    })),
  },
};

export const refineThermalDecompositionMassLossDefinition = (candidate) => {
  if (candidate.id !== definition.id) return candidate;

  const next = structuredClone(definition);
  const bind = (actionId, atomId, roles, interaction) => {
    const action = next.actions.find((item) => item.id === actionId);
    if (!action) return;
    action.atomId = atomId;
    action.equipmentRoleBindings = roles;
    delete action.roles;
    if (interaction) action.interaction = interaction;
    action.evidence = [...new Set([...(action.evidence ?? []), "source-bound-apparatus-operation"])];
  };

  bind("place-balance", "atom.place.balance-instrument", { "balance-instrument": "analytical-balance" });
  bind("place-empty-crucible", "atom.place.weighed-vessel", { "weighed-vessel": "crucible-with-lid" });
  bind("place-ring-stand", "atom.place.thermal-support", { "thermal-support": "ring-stand" });
  bind("add-clay-triangle", "atom.place.thermal-support", { "thermal-support": "clay-triangle" });
  bind("place-bunsen-burner", "atom.place.thermal-heating-instrument", { "thermal-heating-instrument": "bunsen-burner" });
  bind(
    "place-crucible-on-support",
    "atom.place.thermal-crucible-assembly",
    { "weighed-vessel": "crucible-with-lid", "thermal-support": "ring-stand" },
  );
  bind("set-crucible-lid", "atom.place.thermal-crucible-assembly", { "weighed-vessel": "crucible-with-lid" });
  for (const actionId of ["warm-gently", "heat-carbonate-mixture", "repeat-heat-to-constant-mass"]) {
    bind(
      actionId,
      "atom.heat.thermal-decomposition-stage",
      { "thermal-heating-instrument": "bunsen-burner", "weighed-vessel": "crucible-with-lid" },
    );
  }
  bind("turn-off-burner", "atom.control.thermal-burner", { "thermal-heating-instrument": "bunsen-burner" });
  for (const actionId of ["cool-crucible", "cool-constant-mass-crucible"]) {
    bind(
      actionId,
      "atom.cool.before-weighing",
      {
        "dried-assembly": "crucible-with-lid",
        "cooling-tool": "crucible-tongs",
      },
    );
  }
  bind(
    "add-carbonate-sample",
    "atom.transfer.solid-portion",
    { "solid-reagent-source": "small-vial", "receiving-vessel": "crucible-with-lid" },
  );

  for (const actionId of [
    "record-empty-crucible",
    "record-initial-crucible-mass",
    "record-cycle-mass",
    "record-final-crucible-mass",
  ]) {
    const action = next.actions.find((item) => item.id === actionId);
    if (action) action.parameters = { ...action.parameters, copyExistingMeasurementOnly: true };
  }

  const atomBackedActionIds = new Set(next.actions.filter((action) => action.atomId).map((action) => action.id));
  next.composition.legacyActionEffects = next.composition.legacyActionEffects.filter(
    (entry) => !atomBackedActionIds.has(entry.actionId),
  );

  next.metadata.updatedAt = "2026-09-12T00:00:00.000Z";
  return next;
};
