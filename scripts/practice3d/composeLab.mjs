/**
 * Turns a 3D lab module (`labs/*.mjs`) into a composition source and its index entry (D8, decided 2026-10-10;
 * `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design").
 *
 * - Every role of every part is bound from the part's item map (technique item → lab item); a role item that
 *   is not mapped, a lab item that does not exist, or one of another kind is an error.
 * - Every slot a part's technique declares must be configured, and nothing else.
 * - `setup("<field>")` marks a value the setup page sets. The source carries the field's default, and the
 *   index entry names where each field goes, so the 3D loader can put the teacher's value there.
 * - The parts run in order, exit port to entry port.
 */
const isSetup = (value) => Boolean(value && typeof value === "object" && typeof value.setup === "string");

export const composeLab = (declaration, techniqueFor) => {
  const fields = new Map(declaration.setup.map((field) => [field.id, { ...field, targets: [] }]));
  const fill = (value, target) => {
    if (!isSetup(value)) return value;
    const field = fields.get(value.setup);
    if (!field) throw new Error(`${declaration.id}: no setup field "${value.setup}".`);
    field.targets.push(target);
    if (field.defaultValue === undefined) throw new Error(`${declaration.id}: setup field "${field.id}" has no default.`);
    return field.defaultValue;
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
    parts.push({ instanceId: part.instanceId, techniqueId: technique.id, title: technique.title });
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

  const port = (instanceId, portId) => ({ kind: "technique-port", instanceId, portId });
  const ids = declaration.parts.map((part) => part.instanceId);
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
    actions: [],
    process: { startNodeId: `${ids[0]}--start`, nodes: [], edges: [] },
    assessments: [],
    metadata: { version: "1.0.0", author: "Lab Studio", updatedAt: "2026-10-10T00:00:00.000Z", tags: ["lab", "lab-3d"] },
    techniqueInstances,
    compositionStart: port(ids[0], "entry"),
    compositionConnections: ids.slice(1).map((id, i) => ({
      id: `${ids[i]}-to-${id}`, from: port(ids[i], "exit"), to: port(id, "entry"), label: "Next", condition: { type: "validationPassed" },
    })),
    reachabilityWitnesses: [{ id: "default", configuration: {}, approvalGates: {} }],
  };
  const entry = {
    id: declaration.id,
    title: declaration.title,
    description: declaration.description,
    file: `${declaration.id}.json`,
    parts,
    setup: [...fields.values()],
    rules: declaration.rules ?? [],
  };
  return { source, entry };
};
