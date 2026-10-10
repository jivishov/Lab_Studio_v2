/**
 * Shared builders for the Pack 2 3D practice techniques (decided 2026-10-05,
 * `planning/2026-09-23_lab-studio-3d/proposals/PACK2_ATOMIZATION.md`, decision 1).
 *
 * A practice version is a technique of its own: its own id, starting bench and teacher settings,
 * listed in `public/techniques-3d/index.json` and never in `public/techniques/index.json`, so the
 * 2D catalogue, its pack order and the three 2D labs that compose the lab-bound originals are
 * untouched. Each module in this folder describes one practice version; `build.mjs` writes them.
 */

export const INVALID_CASES = [
  {
    id: "wrong-order",
    when: "current node expects a different action",
    message: "That action is out of sequence for the current technique step.",
    recovery: "Check the process map and perform the highlighted step first.",
  },
  {
    id: "missing-source",
    when: "source equipment or contents are missing",
    message: "The selected source does not contain the material required for this action.",
    recovery: "Select equipment that contains the required liquid, solid, solution, or precipitate.",
  },
  {
    id: "overflow",
    when: "target capacity would be exceeded",
    message: "The target equipment cannot hold the requested volume.",
    recovery: "Use a larger container or transfer a smaller measured amount.",
  },
];

export const emptyContents = () => ({
  kind: "empty",
  label: "empty",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
});

/** One starting item. `contents` defaults to empty; the location defaults to the tray ("shelf"). */
export const item = (id, definitionId, label, contents = emptyContents(), location = "shelf") => ({
  id,
  definitionId,
  label,
  location,
  contents,
});

/**
 * One action. `options.roles` is the atom's role bindings (role → definition id); the composition's
 * equipment roles are derived from them. `options.interaction` is authored when the verb's default
 * interaction is not the one the step uses.
 */
export const action = (id, verb, label, parameters, options = {}) => ({
  id,
  verb,
  label,
  parameters,
  prerequisites: options.prerequisites ?? [],
  stateChanges: [`${label}: changes the named equipment and contents only.`],
  invalidCases: INVALID_CASES,
  feedback: {
    success: options.success ?? `${label} complete.`,
    invalid: "The simulator could not complete that action. Review the step requirements.",
  },
  evidence: options.evidence ?? [verb],
  ...(options.interaction ? { interaction: { accessibleLabel: label, ...options.interaction } } : {}),
  ...(options.atomId ? { atomId: options.atomId } : {}),
  ...(options.roles ? { equipmentRoleBindings: options.roles } : {}),
});

/**
 * One process node. `validation` is either an action id (judged by its evidence), or
 * `{ notebookTag }`, or `{ measurementId }`, or `{ calculationId }`: a step that should finish only
 * on acceptance is judged by what it records, never by `actionEvidence` (SESSION_HANDOFF.md).
 */
export const node = (actionId, title, description, validation = { action: actionId }, type = "action") => {
  const id = `${actionId}-node`;
  const rule = validation.notebookTag
    ? { id: `${id}-done`, type: "notebookEntry", label: `${title} was completed.`, notebookTag: validation.notebookTag }
    : validation.measurementId
      ? { id: `${id}-done`, type: "measurementRecorded", label: `${title} was recorded.`, measurementId: validation.measurementId }
      : validation.calculationId
        ? { id: `${id}-done`, type: "calculationWithinTolerance", label: `${title} was submitted.`, calculationId: validation.calculationId }
        : { id: `${id}-done`, type: "actionEvidence", label: `Action ${actionId} was completed.`, actionId };
  return {
    id,
    type,
    title,
    description,
    actionId,
    config: {},
    validation: [rule],
    hints: [],
    feedback: { success: `${title} complete.`, retry: `Review ${title} and try again.` },
  };
};

/**
 * The whole technique. Process edges run node to node in order; the composition's roles come from
 * the actions' role bindings, matched to the starting items of the bound definitions.
 */
export const technique = ({ id, title, learningGoal, equipment, actions, nodes, slots, evidenceOutputs, successActionId, tags, legacyActionEffects = [], requiredEquipment }) => {
  const roles = new Map();
  for (const entry of actions) {
    for (const [roleId, definitionId] of Object.entries(entry.equipmentRoleBindings ?? {})) {
      const role = roles.get(roleId) ?? { roleId, required: true, allowedDefinitionIds: [], sourceInstanceIds: [] };
      if (!role.allowedDefinitionIds.includes(definitionId)) role.allowedDefinitionIds.push(definitionId);
      const named = [entry.parameters.sourceInstanceId, entry.parameters.targetInstanceId, entry.parameters.equipmentInstanceId,
        entry.parameters.instrumentInstanceId, entry.parameters.washingsReceiverInstanceId, entry.parameters.toolInstanceId,
        entry.parameters.vesselInstanceId, entry.parameters.attachmentChildInstanceId, entry.parameters.attachmentParentInstanceId]
        .filter((value) => typeof value === "string");
      const instances = equipment.filter((e) => e.definitionId === definitionId);
      // Where an action names the instance, that one; where it names none, every instance of the kind.
      const chosen = instances.filter((e) => named.includes(e.id));
      for (const instance of chosen.length ? chosen : instances) {
        if (!role.sourceInstanceIds.includes(instance.id)) role.sourceInstanceIds.push(instance.id);
      }
      roles.set(roleId, role);
    }
  }
  const first = nodes[0];
  const last = nodes.at(-1);
  return {
    id,
    title,
    learningGoal,
    requiredEquipment: requiredEquipment ?? [...new Set(equipment.map((e) => e.definitionId))],
    initialState: { equipment },
    actions,
    process: {
      startNodeId: first.id,
      nodes,
      edges: nodes.slice(1).map((next, i) => ({ from: nodes[i].id, to: next.id, label: "Next", condition: { type: "validationPassed" } })),
    },
    successCriteria: [{ id: `${id}-success`, type: "actionEvidence", label: `Action ${successActionId} was completed.`, actionId: successActionId }],
    commonMistakes: INVALID_CASES,
    resetBehavior: "resetTechnique",
    metadata: { version: "1.0.0", author: "Lab Studio", updatedAt: "2026-10-05T00:00:00.000Z", tags: ["technique", "practice-3d", ...tags] },
    composition: {
      schemaVersion: 1,
      ports: [
        { id: "entry", kind: "entry", nodeId: first.id, label: "Entry" },
        { id: "exit", kind: "exit", nodeId: last.id, label: "Exit" },
      ],
      equipmentRoles: [...roles.values()],
      modelSlots: [],
      configurationSlots: slots,
      approvalGates: [],
      variants: [],
      evidenceOutputs,
      completion: {
        exitPortIds: ["exit"],
        requiredEvidenceOutputIds: evidenceOutputs.map((output) => output.id),
        requiredValidationRuleIds: [`${id}-success`],
      },
      // A practice version plays alone in 3D; no lab composes it (decision 1A).
      catalogDisposition: "standalone-practice",
      legacyActionEffects,
    },
  };
};

/**
 * Checking the empty balance reads zero before a technique's first weighing (decided 2026-10-06, the Pack 2
 * fidelity review): nothing is on the pan, so the item weighed next is itself the mass read. The action and
 * its process node; the 3D player lights the balance's TARE key for it.
 */
export const zeroEmptyBalance = (id, balanceInstanceId) => [
  action(id, "observe", "Zero the balance", {
    instrumentInstanceId: balanceInstanceId,
    instrumentDefinitionId: "analytical-balance",
    balanceOperation: "zero",
    tag: `${id}-done`,
    note: "The empty balance reads 0.000 g.",
  }, {
    atomId: "atom.observe.zero-empty-balance",
    evidence: [],
    interaction: { type: "recordNotebook", valueParameter: "tag" },
    roles: { "balance-instrument": "analytical-balance" },
    success: "The empty balance reads zero.",
  }),
  node(id, "Zero the balance",
    "With the pan empty and the draft-shield doors closed, check that the balance reads 0.000 g, and press TARE if it does not.",
    { notebookTag: `${id}-done` }),
];

/** The legacy effect of a record or observation that writes only evidence (the policy allows these for records). */
export const evidenceEffect = (actionId) => ({
  actionId,
  effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] },
});

const CONFIG_REFERENCE = /\{\{config\.([A-Za-z0-9]+)\}\}/g;

/** Every `{{config.*}}` reference in a value, with the JSON path it is at. */
const configReferences = (value, path = "") => {
  if (typeof value === "string") return [...value.matchAll(CONFIG_REFERENCE)].map((match) => ({ slotId: match[1], path }));
  if (Array.isArray(value)) return value.flatMap((entry, index) => configReferences(entry, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, entry]) => configReferences(entry, `${path}.${key}`));
  return [];
};

/**
 * The composable twin of a practice version (D8, decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`,
 * "E0 design"): the same steps for a 3D lab to compose, without the steps that stand in for a technique
 * played before it (`dropSteps`, action ids) and without the slots that only fill the practice bench
 * (`dropSlots`). The starting items stay as the roles' source instances; a lab binds each to its own item
 * and the compiler drops the technique's bench, so contents that name a dropped slot are emptied.
 * Throws when a dropped slot is used anywhere but the bench or a dropped step, or a reference is undeclared.
 */
export const twinOf = (practice, { id, dropSteps = [], dropSlots = [] }) => {
  const twin = structuredClone(practice);
  twin.id = id;
  twin.metadata.tags = twin.metadata.tags.map((tag) => (tag === "practice-3d" ? "twin-3d" : tag));
  const composition = twin.composition;
  composition.catalogDisposition = "composable";

  const dropped = new Set(dropSteps);
  for (const actionId of dropped) {
    if (!twin.actions.some((entry) => entry.id === actionId)) throw new Error(`${id}: no step "${actionId}" to drop.`);
  }
  if (twin.successCriteria.some((criterion) => dropped.has(criterion.actionId))) throw new Error(`${id}: a dropped step is the success step.`);
  twin.actions = twin.actions.filter((entry) => !dropped.has(entry.id));
  const nodes = twin.process.nodes.filter((entry) => !dropped.has(entry.actionId));
  twin.process.nodes = nodes;
  twin.process.startNodeId = nodes[0].id;
  twin.process.edges = nodes.slice(1).map((next, i) => ({ from: nodes[i].id, to: next.id, label: "Next", condition: { type: "validationPassed" } }));
  composition.ports = composition.ports.map((port) => ({ ...port, nodeId: port.kind === "entry" ? nodes[0].id : nodes.at(-1).id }));
  composition.evidenceOutputs = composition.evidenceOutputs.filter((output) => !dropped.has(output.actionId));
  const outputIds = new Set(composition.evidenceOutputs.map((output) => output.id));
  composition.completion.requiredEvidenceOutputIds = composition.completion.requiredEvidenceOutputIds.filter((outputId) => outputIds.has(outputId));
  composition.legacyActionEffects = composition.legacyActionEffects.filter((entry) => !dropped.has(entry.actionId));

  const droppedSlots = new Set(dropSlots);
  for (const slotId of droppedSlots) {
    if (!composition.configurationSlots.some((slot) => slot.id === slotId)) throw new Error(`${id}: no slot "${slotId}" to drop.`);
  }
  composition.configurationSlots = composition.configurationSlots.filter((slot) => !droppedSlots.has(slot.id));
  twin.initialState.equipment = twin.initialState.equipment.map((entry) =>
    (configReferences(entry.contents).some((reference) => droppedSlots.has(reference.slotId)) ? { ...entry, contents: emptyContents() } : entry));
  const declared = new Set(composition.configurationSlots.map((slot) => slot.id));
  for (const reference of configReferences(twin)) {
    if (droppedSlots.has(reference.slotId)) throw new Error(`${id}: dropped slot "${reference.slotId}" is still used at ${reference.path}.`);
    if (!declared.has(reference.slotId)) throw new Error(`${id}: "{{config.${reference.slotId}}}" at ${reference.path} has no slot.`);
  }
  for (const slot of composition.configurationSlots) {
    if (!configReferences(twin).some((reference) => reference.slotId === slot.id)) throw new Error(`${id}: slot "${slot.id}" is kept but nothing uses it.`);
  }
  return twin;
};

/**
 * A setup field's value in a 3D lab module: a part's slot or a bench volume filled from the setup page.
 * `offset` is added to a number field's value: Measure Liquid Volume's pour stops 1 mL under the sample's line.
 */
export const setup = (fieldId, offset) => ({ setup: fieldId, ...(offset ? { offset } : {}) });

/** A Pack 1 original a 3D lab composes as it is, read from `public/techniques/` by the build. */
export const original = (techniqueId) => ({ original: techniqueId });
