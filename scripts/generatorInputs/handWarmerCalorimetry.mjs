/**
 * Cycle 09-owned hand-warmer definition refinements.
 *
 * The generator remains the only writer for the public hand-warmer files.  This module only
 * declares composition metadata and the small, non-physical inquiry wrapper; it never invents a
 * salt mass, temperature, heat capacity, or measured result.
 */
const clone = (value) => structuredClone(value);

const effectFor = (action) => {
  const type = action.interaction?.type ?? (action.verb === "calculate" ? "submitCalculation" : "recordNotebook");
  const contracts = {
    recordNotebook: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] },
    submitCalculation: { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] },
    readInstrument: { classes: ["measurement-direct-observation-acquisition"], targets: [{ domain: "instrument" }, { domain: "measurement-observation" }, { domain: "evidence" }] },
  };
  return clone(contracts[type] ?? contracts.recordNotebook);
};

const compositionContract = (definition) => {
  const roleDefinitions = new Map();
  for (const action of definition.actions) {
    for (const [roleId, definitionId] of Object.entries(action.equipmentRoleBindings ?? {})) {
      const set = roleDefinitions.get(roleId) ?? new Set();
      set.add(definitionId);
      roleDefinitions.set(roleId, set);
    }
  }
  // "timing-instrument" is declared even though no action carries it in equipmentRoleBindings, and
  // it is required.  It is load-bearing: the frozen driver authors `parameters.timerId:
  // "calibration-timer"` on the three 15-second wait actions, and compileLabComposition resolves a
  // `timerId` only through the instance's bound equipment - an unbound instance reference is a hard
  // compile failure.  A role binding on those atom-less `observe` actions is not an option either,
  // because the shared checker reports `action/role-bindings-without-atom` for that.
  roleDefinitions.set("timing-instrument", new Set(["stopwatch"]));
  const equipmentRoles = [...roleDefinitions.entries()].map(([roleId, definitions]) => ({
    roleId,
    required: true,
    allowedDefinitionIds: [...definitions],
    sourceInstanceIds: definition.initialState.equipment
      .filter((item) => definitions.has(item.definitionId))
      .map((item) => item.id),
  }));
  const legacyActionEffects = definition.actions
    .filter((action) => !action.atomId)
    .map((action) => ({ actionId: action.id, effect: effectFor(action) }));
  return {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: definition.process.nodes[0].id, label: "Begin the configured hand-warmer inquiry" },
      { id: "exit", kind: "exit", nodeId: definition.process.nodes.at(-1).id, label: "Submit evidence-backed design decision" },
    ],
    equipmentRoles,
    modelSlots: [],
    // One slot, and it is read: `wasteRoute` reaches the three disposal actions as
    // `parameters.wasteDestination`.  There is deliberately no `selectedProcedure` slot, because
    // this technique authors exactly one procedure and has no orderedProcedure plan to select
    // from; declaring one would advertise a choice the technique cannot make.
    configurationSlots: [
      { id: "wasteRoute", required: true, valueType: "string", defaultValue: "teacher-configured" },
    ],
    approvalGates: [],
    variants: [],
    evidenceOutputs: definition.actions.map((action) => ({
      id: `evidence-${action.id}`,
      kind: action.interaction?.type === "readInstrument" ? "measurement" : action.verb === "calculate" ? "calculation" : "notebook",
      actionId: action.id,
      ...(action.parameters?.measurementId ? { referenceId: action.parameters.measurementId } : {}),
      ...(action.parameters?.calculationId ? { referenceId: action.parameters.calculationId } : {}),
      ...(action.parameters?.dataSeriesId ? { referenceId: action.parameters.dataSeriesId } : {}),
    })),
    completion: {
      exitPortIds: ["exit"],
      requiredEvidenceOutputIds: definition.actions
        .filter((action) => action.parameters?.conditionalBranch !== "part1-tolerance-retry")
        .filter((action) => action.interaction?.type === "readInstrument" || action.verb === "calculate")
        .map((action) => `evidence-${action.id}`),
      requiredValidationRuleIds: [],
    },
    catalogDisposition: "lab-scoped",
    legacyActionEffects,
  };
};

const uniquifyValidationRuleIds = (definition) => {
  const used = new Set();
  const reserve = (rule, owner) => {
    if (!rule?.id) return;
    const original = rule.id;
    let candidate = original;
    if (used.has(candidate)) {
      candidate = `${original}-${owner}`;
      let suffix = 2;
      while (used.has(candidate)) candidate = `${original}-${owner}-${suffix++}`;
    }
    rule.id = candidate;
    used.add(candidate);
  };
  for (const action of definition.actions) {
    for (const rule of action.prerequisites ?? []) reserve(rule, action.id);
  }
  for (const node of definition.process.nodes) {
    for (const rule of node.validation ?? []) reserve(rule, node.id);
  }
  for (const rule of definition.successCriteria ?? []) reserve(rule, rule.actionId ?? "criterion");
};

export const refineHandWarmerTechnique = (definition) => {
  const next = clone(definition);
  next.metadata = {
    ...next.metadata,
    version: "2.5.1",
    updatedAt: "2026-09-06T00:00:00.000Z",
    tags: [...new Set([...(next.metadata.tags ?? []), "composition", "cycle-09", "open-inquiry", "trial-scoped-evidence"])],
  };
  const actions = next.actions;
  const bind = (predicate, atomId, equipmentRoleBindings, interactionType, parameterPatch = {}) => {
    for (const action of actions.filter((candidate) => predicate(candidate.id))) {
      action.atomId = atomId;
      action.equipmentRoleBindings = {
        ...(action.equipmentRoleBindings ?? {}),
        ...equipmentRoleBindings,
      };
      action.parameters = { ...(action.parameters ?? {}), ...parameterPatch };
      action.interaction = {
        ...(action.interaction ?? {}),
        type: interactionType,
      };
      action.evidence = [...new Set([...(action.evidence ?? []), "physical-state", "source-bound-evidence"])];
    }
  };
  bind(
    (id) => /^P1-(?:13|14)(?:-(?:T2|R1))?$/.test(id),
    "atom.observe.control-calorimetry-stirrer",
    { "stirring-device": "hot-plate-stirrer", "calorimeter-vessel": "hand-warmer-calorimeter" },
    "recordNotebook",
    { targetInstanceId: "hot-plate-stirrer-1", targetDefinitionId: "hot-plate-stirrer" },
  );
  bind(
    (id) => /^P1-26(?:-(?:T2|R1))?$/.test(id),
    "atom.observe.identify-temperature-peak",
    { "immersed-probe-instrument": "probe-thermometer", "immersed-probe-vessel": "hand-warmer-calorimeter" },
    "recordNotebook",
    {
      sourceInstanceId: "hand-warmer-calorimeter-1",
      sourceDefinitionId: "hand-warmer-calorimeter",
      targetInstanceId: "probe-thermometer-1",
      targetDefinitionId: "probe-thermometer",
    },
  );
  bind(
    (id) => /^P2-M13(?:-D[23])?$/.test(id),
    "atom.observe.wait-calorimetry-interval",
    { "timing-instrument": "stopwatch" },
    "recordNotebook",
    { timerId: "calibration-timer" },
  );
  bind(
    (id) => /^P2-M14(?:-D[23])?$/.test(id),
    "atom.observe.read-timed-temperature",
    {
      "immersed-probe-instrument": "probe-thermometer",
      "immersed-probe-vessel": "hand-warmer-calorimeter",
      "timing-instrument": "stopwatch",
    },
    "readInstrument",
    {
      sourceInstanceId: "hand-warmer-calorimeter-1",
      sourceDefinitionId: "hand-warmer-calorimeter",
      targetInstanceId: "probe-thermometer-1",
      targetDefinitionId: "probe-thermometer",
      timerId: "calibration-timer",
    },
  );
  for (const action of actions.filter((candidate) => /^P2-M14(?:-D[23])?$/.test(candidate.id))) {
    action.interaction = {
      ...action.interaction,
      sourceDefinitionId: "hand-warmer-calorimeter",
      stationId: "probe-thermometer",
    };
  }
  bind(
    (id) => /^P2-H08-D[123]-READ-01$/.test(id),
    "atom.observe.read-immersed-probe",
    {
      "immersed-probe-instrument": "probe-thermometer",
      "immersed-probe-vessel": "beaker-150ml",
    },
    "readInstrument",
    {
      sourceInstanceId: "beaker-150ml-1",
      sourceDefinitionId: "beaker-150ml",
      targetInstanceId: "probe-thermometer-1",
      targetDefinitionId: "probe-thermometer",
    },
  );
  for (const action of actions.filter((candidate) => /^P2-H08-D[123]-READ-01$/.test(candidate.id))) {
    action.interaction = {
      ...action.interaction,
      sourceDefinitionId: "beaker-150ml",
      stationId: "probe-thermometer",
    };
  }
  for (const actionId of ["CAL-02", "CAL-03"]) {
    const action = next.actions.find((candidate) => candidate.id === actionId);
    if (action) action.equipmentRoleBindings = {
      ...(action.equipmentRoleBindings ?? {}),
      "calorimeter-vessel": "polystyrene-cup-8oz",
    };
  }
  if (!next.initialState.equipment.some((item) => item.id === "calibration-timer")) {
    next.initialState.equipment.push({
      id: "calibration-timer",
      definitionId: "stopwatch",
      label: "Calibration stopwatch",
      location: "shelf",
      contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" },
    });
  }
  next.requiredEquipment = [...new Set([...(next.requiredEquipment ?? []), "stopwatch"])];
  // The source leaves disposal teacher-configured, so the destination is carried by the
  // configuration slot rather than authored here.
  for (const action of next.actions) {
    if (action.atomId === "atom.transfer.dispose-calorimetry-waste") {
      action.parameters = { ...action.parameters, wasteDestination: "{{config.wasteRoute}}" };
    }
  }
  // The three Part 1 runs share the normal balance -> weighing-boat -> calorimeter handling
  // path.  This is explicitly opt-in evidence continuity, and the source fixes what each quantity
  // means.  PR-07 (M) measures exactly 5.00 g of anhydrous MgSO4 into the weighing boat and
  // PR-08 (M) "quickly add all MgSO4"; fidelity finding 3 (M/C) repeats that the source adds *all*
  // of it and leaves only the timing threshold to teacher configuration.  So the learner's balance
  // entry is a whole-boat confirmation reading, not a first partial portion: it records evidence
  // and neither consumes nor creates material, which is exactly `balance-display`.  The pour then
  // moves the boat's actual contents, and the authored P1-23 variants stay physical so a visible
  // remainder is still transferred rather than asserted away in a notebook.
  for (const { producerId, transferId, residualId } of [
    { producerId: "P1-19", transferId: "P1-22", residualId: "P1-23" },
    { producerId: "P1-19-T2", transferId: "P1-22-T2", residualId: "P1-23-T2" },
    { producerId: "P1-19-R1", transferId: "P1-22-R1", residualId: "P1-23-R1" },
  ]) {
    const producer = next.actions.find((action) => action.id === producerId);
    const transfer = next.actions.find((action) => action.id === transferId);
    const residual = next.actions.find((action) => action.id === residualId);
    if (!producer || !transfer || !residual) {
      throw new Error(`Missing hand-warmer Part 1 mass-continuity action for ${producerId}.`);
    }
    const measurementId = producer.parameters.measurementId;
    if (typeof measurementId !== "string") {
      throw new Error(`Missing mass measurement id for ${producerId}.`);
    }
    const producerContinuity = {
      version: 1,
      quantityKind: "balance-display",
      measuredSupportInstanceId: "weigh-boat-1",
    };
    producer.parameters = {
      ...producer.parameters,
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Stable magnesium sulfate mass shown on the balance",
      // Before F04, these actions used expectedMassG: 5 with tolerance: 0.01.  The numeric
      // entry now carries that existing acceptance directly, so retain its symmetric 5.00 +/-
      // 0.01 g interval rather than introducing a one-sided upper bound or the unrelated 10%
      // result-comparison criterion from PR-14.
      inputMin: 4.99,
      inputMax: 5.01,
      inputStep: 0.001,
      inputRequired: true,
      unit: "g",
    };
    // The contract below is the sole output identity and accepts the learner's
    // current balance reading only. Keeping legacy fields here would make the
    // same action advertise a second writer or supply a configured fallback.
    delete producer.parameters.measurementId;
    delete producer.parameters.expectedMassG;
    delete producer.interaction.valueParameter;
    producer.mass = {
      source: "action-input",
      outputMeasurementId: measurementId,
      continuity: producerContinuity,
    };
    // PR-08 authorizes no partial delivery, so the pour must not be sized by the learner's
    // reading: it empties the boat that PR-07 loaded.  `emptyRemainingSolid` is the existing
    // representation for "move the source's whole remaining solid", and it keeps the boat's own
    // inventory as the single physical accounting.  A `balance-display` record deliberately cannot
    // authorize a portion transfer, so the mass contract is dropped rather than restated here; the
    // fail-closed evidence gate stays on the prerequisite, which still requires this producer's
    // reading in the current evidence scope and generation before any material moves.
    // `requireNonEmptySolidSource` marks this as the *required* first delivery, which distinguishes
    // it from the residual step below. Without it the shared whole-solid handler would treat an
    // empty boat as a completed delivery and return success without moving material or generating
    // the dissolution response. Legacy whole-solid callers that omit the flag keep that behaviour.
    delete transfer.parameters.massG;
    delete transfer.mass;
    transfer.parameters = {
      ...transfer.parameters,
      emptyRemainingSolid: true,
      requireNonEmptySolidSource: true,
    };
    transfer.prerequisites = [
      ...(transfer.prerequisites ?? []).filter((rule) => rule.id !== `${transferId}-current-mass-required`),
      {
        id: `${transferId}-current-mass-required`,
        type: "measurementRecorded",
        label: "The current trial's magnesium sulfate mass is recorded from the weighing boat.",
        measurementId,
        measurementContinuity: { ...producerContinuity, producerActionId: producerId },
      },
    ];
    residual.verb = "transfer";
    residual.parameters = {
      ...residual.parameters,
      sourceInstanceId: "weigh-boat-1",
      targetInstanceId: "hand-warmer-calorimeter-1",
      sourceDefinitionId: "weigh-boat",
      targetDefinitionId: "hand-warmer-calorimeter",
      emptyRemainingSolid: true,
      targetLabel: "Dissolving magnesium sulfate solution",
      visualState: "dissolving-solid",
    };
    // `atom.transfer.weighed-sample-to-vessel` describes moving the pre-weighed portion into the
    // working vessel with its starting mass on record — that is what the step above does, not this
    // one. This step is the completeness half of PR-08's "all": it moves whatever is left, and an
    // already-empty support completes with no transfer. The residual atom says exactly that, and
    // says so without claiming the source states a separate manual operation.
    residual.atomId = "atom.transfer.residual-solid-completion";
    residual.equipmentRoleBindings = {
      "weighed-sample-source": "weigh-boat",
      "receiving-vessel": "hand-warmer-calorimeter",
    };
    residual.interaction = {
      type: "pourInto",
      sourceDefinitionId: "weigh-boat",
      targetDefinitionId: "hand-warmer-calorimeter",
      accessibleLabel: "Empty any remaining visible magnesium sulfate from the weighing boat into the calorimeter.",
    };
    // A physical reset keeps the attempt history and starts a new scope generation, so an
    // unqualified actionEvidence rule would still see the previous run's successful delivery
    // after the boat has been refilled and the delivery undone. `requireCurrentEvidenceScope`
    // narrows the rule to a success recorded in the scope and generation this residual step is
    // running in, so the completeness half of PR-08 can only follow *this* run's delivery.
    residual.prerequisites = [
      {
        id: `${residualId}-initial-transfer-required`,
        type: "actionEvidence",
        actionId: transferId,
        requireCurrentEvidenceScope: true,
        label: "The measured magnesium sulfate portion has been transferred in this attempt.",
      },
    ];
    residual.stateChanges = [
      "Any remaining visible magnesium sulfate is physically transferred from the weighing boat into the calorimeter; an already empty boat is recorded without inventing additional mass.",
    ];
    residual.feedback = {
      success: "The weighing boat has no remaining visible magnesium sulfate.",
      invalid: "Complete the measured magnesium sulfate transfer before emptying any remainder.",
    };
    residual.evidence = ["transfer", "residual-material"];
  }
  uniquifyValidationRuleIds(next);
  next.composition = compositionContract(next);
  return next;
};

const localAction = (id, label, note) => ({
  id,
  verb: "observe",
  label,
  parameters: { note, inputMode: "text", inputRole: "studentResponse", inputLabel: label, inputRequired: true },
  interaction: { type: "recordNotebook", valueParameter: "note", accessibleLabel: label, successCue: `${label} recorded.`, invalidCue: "Record the requested inquiry evidence before continuing." },
  prerequisites: [],
  stateChanges: [note],
  invalidCases: [{ id: "missing-response", when: "the learner has not recorded the inquiry response", message: "The inquiry response is still required.", recovery: "Record a response for this non-physical orchestration step." }],
  feedback: { success: `${label} recorded.`, invalid: "Record the requested inquiry evidence." },
  evidence: ["notebook"],
  effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] },
});

const localNode = (action) => ({
  id: `${action.id}-node`,
  type: "teacherNote",
  title: action.label,
  description: action.parameters.note,
  actionId: action.id,
  config: {},
  validation: [{ id: `${action.id}-complete`, type: "actionEvidence", label: `${action.label} is recorded.`, actionId: action.id }],
  hints: ["This is a non-physical inquiry/orchestration step; physical state and measurements remain owned by the hand-warmer technique instance."],
  feedback: { success: `${action.label} recorded.`, retry: "Record the requested inquiry evidence." },
});

export const refineHandWarmerLab = (definition) => {
  const source = clone(definition);
  if (!source.initialState.equipment.some((item) => item.id === "calibration-timer")) {
    source.initialState.equipment.push({
      id: "calibration-timer",
      definitionId: "stopwatch",
      label: "Calibration stopwatch",
      location: "shelf",
      contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" },
    });
  }
  const inquiryActions = [
    localAction("HW-PLAN-01", "Record the teacher-approved design question and candidate selection", "Record the open design question, supported candidate solids, and the teacher-approved configuration."),
    localAction("HW-PLAN-02", "Record the trial comparison and uncertainty plan", "Record how repeated trials, uncertainty, cost, safety, and environmental evidence will be compared."),
    localAction("HW-CER-01", "Record the evidence-backed hand-warmer design decision", "Record the chosen chemical and amount only after reviewing measured temperature, heat/enthalpy calculations, and uncertainty."),
  ];
  const inquiryNodes = inquiryActions.map(localNode);
  const techniqueVersion = "2.5.1";
  const roleDefinitions = {
    "calorimeter-vessel": ["hand-warmer-calorimeter", "polystyrene-cup-8oz"],
    "stirring-device": ["hot-plate-stirrer", "magnetic-stir-bar"],
    "calorimeter-cover": ["wooden-calorimeter-cover"],
    "immersed-probe-instrument": ["probe-thermometer"],
    "immersed-probe-vessel": ["hand-warmer-calorimeter", "beaker-150ml"],
    "variable-volume-measuring-device": ["graduated-cylinder"],
    "liquid-source": ["wash-bottle", "distilled-water-bottle-2l"],
    "measured-solvent-source": ["beaker-150ml", "graduated-cylinder"],
    "receiving-vessel": ["hand-warmer-calorimeter", "beaker-150ml"],
    "balance-instrument": ["analytical-balance"],
    "weighed-vessel": ["weigh-boat"],
    "solid-reagent-source": ["reagent-bottle"],
    "weighed-sample-source": ["weigh-boat"],
    "waste-receiver": ["waste-beaker"],
    "heated-liquid-vessel": ["beaker-150ml"],
    "heating-instrument": ["hot-plate-stirrer"],
    "timing-instrument": ["stopwatch"],
  };
  const roleBindings = Object.fromEntries(Object.entries(roleDefinitions).map(([roleId, definitions]) => [roleId, {
    sourceInstances: definitions.flatMap((definitionId) => source.initialState.equipment
      .filter((item) => item.definitionId === definitionId)
      .map((item) => ({ sourceInstanceId: item.id, definitionId, instanceId: item.id }))),
  }]));
  const instance = {
    instanceId: "hand-warmer",
    techniqueId: source.id,
    version: techniqueVersion,
    bindings: {
      equipment: roleBindings,
      models: {},
      configuration: { wasteRoute: "teacher-configured" },
    },
  };
  const start = inquiryNodes[0];
  // Planning nodes chain locally; the last one hands off to the technique instance.  The design
  // decision is deliberately left with no lab-local predecessor so that the only route to it runs
  // through the technique exit, and no learner can record a design decision without evidence.
  const planNodes = inquiryNodes.slice(0, -1);
  const planExit = planNodes.at(-1);
  const end = inquiryNodes.at(-1);
  const next = {
    ...source,
    techniques: [],
    equipment: [...new Set([...(source.equipment ?? []), "stopwatch"])],
    initialState: clone(source.initialState),
    actions: inquiryActions,
    process: { startNodeId: start.id, nodes: inquiryNodes, edges: planNodes.slice(1).map((node, index) => ({
      from: planNodes[index].id, to: node.id, label: "Next", condition: { type: "validationPassed" },
    })) },
    assessments: [],
    metadata: { ...source.metadata, version: "2.5.1", tags: [...new Set(["lab", ...(source.metadata.tags ?? []), "composition", "cycle-09", "open-inquiry"])], updatedAt: "2026-09-06T00:00:00.000Z" },
    techniqueInstances: [instance],
    compositionStart: { kind: "lab-node", nodeId: start.id },
    compositionConnections: [
      { id: "hand-warmer-plan-to-technique", from: { kind: "lab-node", nodeId: planExit.id }, to: { kind: "technique-port", instanceId: "hand-warmer", portId: "entry" }, label: "Start configured physical trials", condition: { type: "validationPassed" } },
      { id: "hand-warmer-technique-to-cer", from: { kind: "technique-port", instanceId: "hand-warmer", portId: "exit" }, to: { kind: "lab-node", nodeId: end.id }, label: "Review measured evidence", condition: { type: "validationPassed" } },
    ],
    reachabilityWitnesses: [{ id: "teacher-approved-open-inquiry", configuration: { "hand-warmer.wasteRoute": "teacher-configured" }, approvalGates: {} }],
  };
  delete next.techniqueRefs;
  return next;
};
