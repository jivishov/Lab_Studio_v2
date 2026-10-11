/**
 * Turns a 3D lab module (`labs/*.mjs`) into a composition source and its index entry (D8, decided 2026-10-10;
 * `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design").
 *
 * - Every role of every part is bound from the part's item map (technique item → lab item); a role item that
 *   is not mapped, a lab item that does not exist, or one of another kind is an error.
 * - Every slot a part's technique declares must be configured, and nothing else.
 * - `setup("<field>", offset?)` marks a value the setup page sets. The source carries the field's default (plus
 *   the offset), and the index entry names where each field goes, so the 3D loader can put the teacher's value there.
 * - A part may name a short `title` for the step card and the intro (you, 2026-10-10: "Use short part title");
 *   the index keeps the technique's own as `techniqueTitle`.
 * - The parts run in order, exit port to entry port.
 * - Lab steps (Pack 3, decided 2026-10-10; `proposals/PACK3_ATOMIZATION.md`, "Lab steps in 3D labs"): `steps` is a
 *   list of groups `{ id, title, after?, steps: [{ action, node }] }` (`labRecord`, `labCalculation` and
 *   `labApproval` in `common.mjs`). A group runs before the first part, or after the part named by `after`; groups
 *   with the same place run in the order written. Lab steps keep their ids (the compiler scopes only the parts), and
 *   every scoped id a lab step names (`<instanceId>--<id>`) must belong to a part. Lab step to lab step is a process
 *   edge; into or out of a part it is a composition connection. The index lists each group among the parts, in run
 *   order, with its node ids, so the step card labels a lab step by its group.
 */
const isSetup = (value) => Boolean(value && typeof value === "object" && typeof value.setup === "string");

/** A setup value plus its offset, without float noise (20.3 - 1 is 19.299999999999997). */
export const withOffset = (value, offset) => Math.round((value + offset) * 1e6) / 1e6;

export const composeLab = (declaration, techniqueFor) => {
  const fields = new Map(declaration.setup.map((field) => [field.id, { ...field, targets: [] }]));
  const fill = (value, target) => {
    if (!isSetup(value)) return value;
    const field = fields.get(value.setup);
    if (!field) throw new Error(`${declaration.id}: no setup field "${value.setup}".`);
    if (field.defaultValue === undefined) throw new Error(`${declaration.id}: setup field "${field.id}" has no default.`);
    if (!value.offset) {
      field.targets.push(target);
      return field.defaultValue;
    }
    if (field.kind !== "number" || !Number.isFinite(value.offset)) throw new Error(`${declaration.id}: an offset needs a number field and a number ("${field.id}").`);
    field.targets.push({ ...target, offset: value.offset });
    return withOffset(field.defaultValue, value.offset);
  };

  const benchById = new Map(declaration.bench.map((entry) => [entry.id, entry]));
  const bench = declaration.bench.map((entry) => ({
    ...entry,
    contents: { ...entry.contents, ...(entry.contents.volumeMl !== undefined
      ? { volumeMl: fill(entry.contents.volumeMl, { itemId: entry.id, contents: "volumeMl" }) } : {}) },
  }));

  const parts = [];
  const techniqueInstances = declaration.parts.map((part) => {
    const technique = techniqueFor(part);
    const at = `${declaration.id} part "${part.instanceId}" (${technique.id})`;
    const itemsById = new Map(technique.initialState.equipment.map((entry) => [entry.id, entry]));
    for (const [from, to] of Object.entries(part.items)) {
      const source = itemsById.get(from);
      const target = benchById.get(to);
      if (!source) throw new Error(`${at}: the technique has no item "${from}".`);
      if (!target) throw new Error(`${at}: the lab has no item "${to}".`);
      if (source.definitionId !== target.definitionId) throw new Error(`${at}: "${from}" is a ${source.definitionId}, "${to}" a ${target.definitionId}.`);
    }
    const equipment = {};
    for (const role of technique.composition.equipmentRoles) {
      equipment[role.roleId] = {
        sourceInstances: role.sourceInstanceIds.map((sourceInstanceId) => {
          const instanceId = part.items[sourceInstanceId];
          if (!instanceId) throw new Error(`${at}: role "${role.roleId}" needs item "${sourceInstanceId}", which is not mapped.`);
          return { sourceInstanceId, definitionId: itemsById.get(sourceInstanceId).definitionId, instanceId };
        }),
      };
    }
    const slots = technique.composition.configurationSlots.map((slot) => slot.id);
    const configured = Object.keys(part.configuration);
    const missing = slots.filter((slot) => !configured.includes(slot));
    const extra = configured.filter((slot) => !slots.includes(slot));
    if (missing.length || extra.length) throw new Error(`${at}: slots not configured [${missing}], not declared [${extra}].`);
    const configuration = Object.fromEntries(Object.entries(part.configuration)
      .map(([slotId, value]) => [slotId, fill(value, { instanceId: part.instanceId, slotId })]));
    parts.push({ instanceId: part.instanceId, techniqueId: technique.id, title: part.title ?? technique.title, techniqueTitle: technique.title });
    return { instanceId: part.instanceId, techniqueId: technique.id, version: technique.metadata.version,
      bindings: { equipment, models: {}, configuration } };
  });

  const mapped = new Set(declaration.parts.flatMap((part) => Object.values(part.items)));
  const unused = declaration.bench.filter((entry) => !mapped.has(entry.id)).map((entry) => entry.id);
  if (unused.length) throw new Error(`${declaration.id}: no part uses ${unused.join(", ")}.`);
  for (const field of fields.values()) {
    if (field.targets.length === 0) throw new Error(`${declaration.id}: setup field "${field.id}" goes nowhere.`);
  }
  for (const rule of declaration.rules ?? []) {
    for (const id of [...rule.fields, ...(typeof rule.atMost === "string" ? [rule.atMost] : [])]) {
      if (!fields.has(id)) throw new Error(`${declaration.id}: a rule names no setup field "${id}".`);
    }
  }

  const groups = declaration.steps ?? [];
  const partIds = new Set(declaration.parts.map((part) => part.instanceId));
  const runIds = new Set(partIds);
  const stepIds = new Set();
  const namesNoPart = (value) => typeof value === "string" && value.includes("--") && !partIds.has(value.split("--")[0]);
  const strings = (value) => (typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(strings)
    : value && typeof value === "object" ? Object.values(value).flatMap(strings) : []);
  for (const group of groups) {
    const at = `${declaration.id} lab steps "${group.id}"`;
    if (runIds.has(group.id)) throw new Error(`${at}: the id is already a part's or another group's.`);
    runIds.add(group.id);
    if (group.after !== undefined && !partIds.has(group.after)) throw new Error(`${at}: no part "${group.after}" to follow.`);
    if (!group.title || !group.steps?.length) throw new Error(`${at}: a group needs a title and at least one step.`);
    for (const { action, node } of group.steps) {
      if (node.actionId !== action.id) throw new Error(`${at}: node "${node.id}" runs "${node.actionId}", not "${action.id}".`);
      for (const id of [action.id, node.id]) {
        if (stepIds.has(id)) throw new Error(`${at}: "${id}" is used twice.`);
        stepIds.add(id);
      }
      if (!action.effect) throw new Error(`${at}: action "${action.id}" declares no effect.`);
      const stray = strings([action.parameters, action.effect.targets, node.validation]).filter(namesNoPart);
      if (stray.length) throw new Error(`${at}: "${action.id}" names ${stray.join(", ")}, which no part scopes.`);
    }
  }

  /** The run: groups before the first part, then each part followed by its groups. */
  const placed = (after) => groups.filter((group) => group.after === after).map((group) => ({ group }));
  const run = [...placed(undefined), ...declaration.parts.flatMap((part) => [{ part }, ...placed(part.instanceId)])];
  const stops = run.flatMap((entry) => (entry.part ? [{ instanceId: entry.part.instanceId }]
    : entry.group.steps.map(({ node }) => ({ nodeId: node.id }))));
  const port = (instanceId, portId) => ({ kind: "technique-port", instanceId, portId });
  const endpoint = (stop, portId) => (stop.nodeId ? { kind: "lab-node", nodeId: stop.nodeId } : port(stop.instanceId, portId));
  const next = { label: "Next", condition: { type: "validationPassed" } };
  const pairs = stops.slice(1).map((stop, i) => [stops[i], stop]);
  const labPairs = pairs.filter(([from, to]) => from.nodeId && to.nodeId);
  const crossPairs = pairs.filter(([from, to]) => !(from.nodeId && to.nodeId));
  const ids = declaration.parts.map((part) => part.instanceId);
  const steps = groups.flatMap((group) => group.steps);
  const source = {
    id: declaration.id,
    title: declaration.title,
    description: declaration.description,
    audience: declaration.audience,
    learningGoals: declaration.learningGoals,
    safetyNotes: declaration.safetyNotes,
    equipment: [...new Set(bench.map((entry) => entry.definitionId))],
    techniques: [],
    initialState: { equipment: bench },
    actions: steps.map(({ action }) => action),
    process: {
      startNodeId: stops[0].nodeId ?? `${ids[0]}--start`,
      nodes: steps.map(({ node }) => node),
      edges: labPairs.map(([from, to]) => ({ from: from.nodeId, to: to.nodeId, ...next })),
    },
    assessments: [],
    metadata: { version: "1.0.0", author: "Lab Studio", updatedAt: "2026-10-10T00:00:00.000Z", tags: ["lab", "lab-3d"] },
    techniqueInstances,
    compositionStart: endpoint(stops[0], "entry"),
    compositionConnections: crossPairs.map(([from, to]) => ({
      id: `${from.nodeId ?? from.instanceId}-to-${to.nodeId ?? to.instanceId}`, from: endpoint(from, "exit"), to: endpoint(to, "entry"), ...next,
    })),
    reachabilityWitnesses: [{ id: "default", configuration: {}, approvalGates: {} }],
  };
  const entry = {
    id: declaration.id,
    title: declaration.title,
    description: declaration.description,
    file: `${declaration.id}.json`,
    parts: run.map((entry) => (entry.part ? parts.find((part) => part.instanceId === entry.part.instanceId)
      : { instanceId: entry.group.id, title: entry.group.title, nodeIds: entry.group.steps.map(({ node }) => node.id) })),
    setup: [...fields.values()],
    rules: declaration.rules ?? [],
  };
  return { source, entry };
};
