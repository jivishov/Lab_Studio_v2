import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const planningRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const techniqueIds = [
  "transmittance-dilution", "beers-law-calibration", "brass-spectrophotometry",
  "blue1-standard-dilutions", "blue1-percent-transmittance", "blue1-class-calibration",
];
const sourceFiles = {
  blue1: "sports-drink-blue-dye-spectroscopy_2026-07-27.md",
  brass: "how-can-color-determine-copper-in-brass_2026-07-27.md",
};
const baseline = JSON.parse(await readFile(`${planningRoot}/evidence/CYCLE_05_SHARED_CONTRACT_BASELINE_REVISION_5.json`, "utf8"));
const techniqueAudit = JSON.parse(await readFile(`${planningRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`, "utf8"));
const labAudit = JSON.parse(await readFile(`${planningRoot}/LAB_COMPOSITION_AUDIT.json`, "utf8"));
const atoms = new Map(JSON.parse(await readFile("src/domain/atomRegistry.json", "utf8")).atoms.map((atom) => [atom.id, atom]));
const roles = new Map(JSON.parse(await readFile("src/domain/equipmentRoleRegistry.json", "utf8")).roles.map((role) => [role.id, role]));
const sourceTrace = JSON.parse(await readFile("docs/architecture/source-trace-registry.json", "utf8"));
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const clone = (value) => structuredClone(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const writeJson = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

const effectFromFlags = (flags) => {
  const classes = [];
  if (flags.apparatusMaterialInstrumentState) classes.push("apparatus-material-instrument-state");
  if (flags.measurementOrDirectObservation) classes.push("measurement-direct-observation-acquisition");
  if (flags.evidenceRecording) classes.push("evidence-recording");
  if (flags.calculationOrAnalysis) classes.push("calculation-analysis");
  if (flags.pedagogicalOrchestration) classes.push("pedagogical-orchestration");
  const targets = [];
  if (flags.apparatusMaterialInstrumentState) targets.push({ domain: "equipment" }, { domain: "material" }, { domain: "instrument" });
  if (flags.measurementOrDirectObservation) targets.push({ domain: "measurement-observation" }, { domain: "evidence" });
  if (flags.evidenceRecording) targets.push({ domain: "evidence" });
  if (flags.calculationOrAnalysis) targets.push({ domain: "analysis" });
  if (flags.pedagogicalOrchestration) targets.push({ domain: "pedagogy" });
  return { classes: [...new Set(classes)], targets: targets.filter((item, index, all) => all.findIndex((x) => x.domain === item.domain) === index) };
};

const auditEffect = (kind, ownerId, actionId) => {
  const rows = kind === "technique" ? techniqueAudit.rows : labAudit.rows;
  const row = rows.find((item) => (kind === "technique" ? item.techniqueId === ownerId : item.labId === ownerId) && item.actionId === actionId);
  const handlerEffects = {
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
  const derived = row && handlerEffects[row.effect.resolvedInteractionType];
  return derived ? { classes: derived[0], targets: derived[1].map((domain) => ({ domain })) }
    : { classes: ["pedagogical-orchestration"], targets: [{ domain: "pedagogy" }] };
};

const compositionFor = (technique, effectOwnerId = technique.id) => {
  const roleDefinitions = new Map();
  for (const action of technique.actions) {
    for (const [roleId, definitionId] of Object.entries(action.equipmentRoleBindings ?? {})) {
      const row = roleDefinitions.get(roleId) ?? new Set();
      row.add(definitionId);
      roleDefinitions.set(roleId, row);
    }
  }
  const equipmentRoles = [...roleDefinitions].map(([roleId, definitionIds]) => ({
    roleId,
    required: false,
    allowedDefinitionIds: [...definitionIds],
    sourceInstanceIds: [],
  }));
  const handlerEffects = {
    dragToZone: { classes: ["apparatus-material-instrument-state"], targets: [{ domain: "equipment" }] },
    snapIntoTarget: { classes: ["apparatus-material-instrument-state"], targets: [{ domain: "equipment" }, { domain: "instrument" }] },
    pourInto: { classes: ["apparatus-material-instrument-state"], targets: [{ domain: "equipment" }, { domain: "material" }] },
    dispenseDrops: { classes: ["apparatus-material-instrument-state"], targets: [{ domain: "equipment" }, { domain: "material" }] },
    spotOnto: { classes: ["apparatus-material-instrument-state"], targets: [{ domain: "equipment" }, { domain: "material" }] },
    rinseTarget: { classes: ["apparatus-material-instrument-state"], targets: [{ domain: "equipment" }, { domain: "material" }] },
    placeInInstrument: { classes: ["apparatus-material-instrument-state"], targets: [{ domain: "equipment" }, { domain: "instrument" }, { domain: "material" }] },
    readInstrument: { classes: ["measurement-direct-observation-acquisition"], targets: [{ domain: "instrument" }, { domain: "measurement-observation" }, { domain: "evidence" }] },
    recordTimeSeries: { classes: ["measurement-direct-observation-acquisition", "evidence-recording"], targets: [{ domain: "measurement-observation" }, { domain: "evidence" }] },
    recordNotebook: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] },
    submitCalculation: { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] },
  };
  const legacyActionEffects = technique.actions.filter((action) => !action.atomId).map((action) => ({
    actionId: action.id,
    effect: clone(handlerEffects[action.interaction?.type] ?? (effectOwnerId === "brass-colorimetry" && labAudit.rows.some((row) => row.labId === effectOwnerId && row.actionId === action.id)
      ? auditEffect("lab", effectOwnerId, action.id)
      : auditEffect("technique", technique.id, action.id))),
  }));
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
  return {
    schemaVersion: 1,
    ports,
    equipmentRoles,
    modelSlots: [],
    configurationSlots: [],
    approvalGates: [],
    variants: [],
    evidenceOutputs: [],
    completion: { exitPortIds: ports.filter((port) => port.kind === "exit").map((port) => port.id), requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
    catalogDisposition: "composable",
    legacyActionEffects,
  };
};

const makeAction = ({ id, label, atomId = null, bindings = {}, parameters = {}, prerequisites = [], evidence = [] }) => {
  const action = {
    id,
    verb: atomId ? atoms.get(atomId).verb : (/calculate|fit|compare|plot|derive/.test(id) ? "calculate" : "record"),
    label,
    parameters,
    prerequisites,
    stateChanges: [`${label}: completed with the named sample and configuration provenance preserved.`],
    invalidCases: [{
      id: "wrong-order",
      when: "the required predecessor evidence or named equipment is unavailable",
      message: "This operation is not ready or the selected sample does not match the authored provenance.",
      recovery: "Restore the named sample and equipment state, then complete the immediately preceding operation.",
    }],
    feedback: {
      success: `${label} complete.`,
      invalid: "Check the named sample, equipment binding, configuration evidence, and operation order.",
    },
    evidence,
  };
  if (atomId) bindAtom(action, atomId, bindings);
  else if (/calculate|fit|compare|plot|derive/.test(id)) action.interaction = { type: "submitCalculation", valueParameter: "calculationId", accessibleLabel: label };
  else action.interaction = { type: "recordNotebook", valueParameter: parameters.measurementId ? "measurementId" : "tag", accessibleLabel: label };
  return action;
};

const makeNode = (action, type = "action", description = action.label) => ({
  id: `${action.id}-node`,
  type,
  title: action.label,
  description,
  actionId: action.id,
  config: {},
  validation: [{
    id: `${action.id}-node-done`,
    type: "actionEvidence",
    label: `${action.label} was completed.`,
    actionId: action.id,
  }],
  hints: [],
  feedback: { success: `${action.label} complete.`, retry: `Review ${action.label} and try again.` },
});

const linearProcess = (actions) => ({
  startNodeId: `${actions[0].id}-node`,
  nodes: actions.map((action) => makeNode(action, /calculate|record/.test(action.verb) ? "calculation" : "action")),
  edges: actions.slice(1).map((action, index) => ({
    from: `${actions[index].id}-node`,
    to: `${action.id}-node`,
    label: "Next",
    condition: { type: "validationPassed" },
  })),
});

const interactionForAtom = (atomId) => atoms.get(atomId)?.allowedInteractionTypes[0];
const bindAtom = (action, atomId, bindings) => {
  const atom = atoms.get(atomId);
  action.atomId = atomId;
  action.verb = atom.verb;
  action.equipmentRoleBindings = bindings;
  const type = interactionForAtom(atomId);
  const definitions = Object.values(bindings);
  if (type === "readInstrument") {
    action.interaction = { type, sourceDefinitionId: definitions[0], stationId: definitions[0], accessibleLabel: action.label };
  } else if (type === "rinseTarget") {
    action.interaction = { type, sourceDefinitionId: definitions[0], targetDefinitionId: definitions.at(-1), accessibleLabel: action.label };
  } else if (type === "pourInto") {
    const sourceDefinitionId = atomId.startsWith("atom.measure.") ? definitions[1] : definitions[0];
    const targetDefinitionId = atomId.startsWith("atom.measure.") ? definitions[0] : definitions[1] ?? definitions[0];
    action.interaction = {
      type,
      sourceDefinitionId: atomId === "atom.transfer.return-cuvette-to-origin" ? definitions[1]
        : atomId === "atom.transfer.adjust-color-depth-standard" ? "test-tube" : sourceDefinitionId,
      targetDefinitionId: atomId === "atom.transfer.adjust-color-depth-standard" ? "test-tube" : targetDefinitionId,
      accessibleLabel: action.label,
    };
  } else if (type === "recordNotebook") {
    action.interaction = { type, valueParameter: action.parameters?.measurementId ? "measurementId" : "tag", accessibleLabel: action.label };
  } else if (type === "dragToZone") {
    action.interaction = { type, sourceDefinitionId: definitions[0], stationId: action.parameters?.location ?? "workbench", accessibleLabel: action.label };
  } else if (type === "snapIntoTarget") {
    action.interaction = { type, sourceDefinitionId: definitions.at(-1), targetDefinitionId: definitions[0], accessibleLabel: action.label };
  } else {
    action.interaction = { type, accessibleLabel: action.label };
  }
};

const brassAtomFor = (action) => {
  const id = action.id;
  if (/^scan-read-/.test(id) || /^read-(?:0p\d+|unknown)-absorbance/.test(id)) return ["atom.observe.read-photometer", { "photometer-instrument": "spectrophotometer" }];
  if (/^record-(?:0p\d+|unknown)-absorbance/.test(id)) return ["atom.record.photometer-reading", { "photometer-instrument": "spectrophotometer" }];
  if (/^condition-(?:0p|unknown)/.test(id)) return ["atom.rinse.condition-cuvette-with-sample", { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }];
  if (/^return-(?:0p|unknown)/.test(id)) return ["atom.transfer.return-cuvette-to-origin", { "photometer-sample-holder": "cuvette", "provenance-matched-sample-receiver": "test-tube" }];
  if (id === "calibrate-zero-percent-t-action") return ["atom.observe.dark-zero-photometer", { "photometer-instrument": "spectrophotometer" }];
  if (id === "calibrate-hundred-percent-t-action") return ["atom.observe.blank-photometer", { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }];
  if (id === "blank-wipe-orient-action") return ["atom.rinse.prepare-cuvette-optical-faces", { "photometer-sample-holder": "cuvette" }];
  if (id === "visual-match-action") return ["atom.transfer.adjust-color-depth-standard", { "color-depth-comparison-apparatus": "brass-color-depth-comparison" }];
  if (id === "record-standard-depth-action" || id === "record-unknown-depth-action") return ["atom.observe.read-color-depth", { "color-depth-comparison-apparatus": "brass-color-depth-comparison" }];
  if (id === "neutralize-waste-action") return ["atom.transfer.treat-waste-with-solid-to-endpoint", { "solid-reagent-source": "reagent-bottle", "waste-receiver": "waste-beaker" }];
  if (id === "record-waste-ph-action") return ["atom.observe.read-waste-ph-indicator", { "ph-indicator-medium": "ph-paper", "waste-receiver": "waste-beaker" }];
  return null;
};

const techniqueOwnedBrass = (row) => {
  const id = row.actionId;
  if (row.effect.flags.apparatusMaterialInstrumentState || row.effect.flags.measurementOrDirectObservation) return true;
  return /^(scan-read-|scan-record-|condition-|read-(?:0p\d+|unknown)-absorbance|record-(?:0p\d+|unknown)-absorbance|return-|calibrate-(?:zero|hundred)-percent-t|blank-wipe-orient|visual-match|record-(?:standard|unknown)-depth|neutralize-waste|record-waste-ph)/.test(id);
};

const promoteBrassStandardMeasurements = async () => {
  const lab = await readJson("public/labs/brass-colorimetry.json");
  if (!lab.techniqueInstances) return;
  const technique = await readJson("public/techniques/brass-spectrophotometry.json");
  const promoteNodes = lab.process.nodes.filter((node) => /^(?:read|record)-0p\d+-absorbance$/.test(node.id));
  if (!promoteNodes.length) return;
  const promoteNodeIds = new Set(promoteNodes.map((node) => node.id));
  const promoteActionIds = new Set(promoteNodes.map((node) => node.actionId));
  const promoteActions = lab.actions.filter((action) => promoteActionIds.has(action.id));
  for (const action of promoteActions) {
    const mapping = brassAtomFor(action);
    if (mapping) bindAtom(action, mapping[0], mapping[1]);
  }
  technique.actions.push(...promoteActions.map(clone));
  technique.process.nodes.push(...promoteNodes.map(clone));
  const internalEdges = lab.process.edges.filter((edge) => promoteNodeIds.has(edge.from) && promoteNodeIds.has(edge.to));
  technique.process.edges.push(...internalEdges.map(clone));
  lab.actions = lab.actions.filter((action) => !promoteActionIds.has(action.id));
  lab.process.nodes = lab.process.nodes.filter((node) => !promoteNodeIds.has(node.id));
  lab.process.edges = lab.process.edges.filter((edge) => !promoteNodeIds.has(edge.from) && !promoteNodeIds.has(edge.to));
  const portKey = new Set(technique.composition.ports.map((port) => `${port.kind}:${port.nodeId}`));
  const ensurePort = (kind, nodeId) => {
    if (!portKey.has(`${kind}:${nodeId}`)) technique.composition.ports.push({ id: `${kind}-${nodeId}`, kind, nodeId, label: kind === "entry" ? "Entry" : "Exit" });
    portKey.add(`${kind}:${nodeId}`);
  };
  for (const connection of lab.compositionConnections) {
    if (connection.from.kind === "lab-node" && promoteNodeIds.has(connection.from.nodeId)) {
      ensurePort("exit", connection.from.nodeId);
      connection.from = { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: `exit-${connection.from.nodeId}` };
    }
    if (connection.to.kind === "lab-node" && promoteNodeIds.has(connection.to.nodeId)) {
      ensurePort("entry", connection.to.nodeId);
      connection.to = { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: `entry-${connection.to.nodeId}` };
    }
  }
  technique.composition.completion.exitPortIds = technique.composition.ports.filter((port) => port.kind === "exit").map((port) => port.id);
  const instance = lab.techniqueInstances[0];
  for (const action of promoteActions) instance.preserveIds.actions[action.id] = action.id;
  for (const node of promoteNodes) instance.preserveIds.nodes[node.id] = node.id;
  await writeJson("public/techniques/brass-spectrophotometry.json", technique);
  await writeJson("public/labs/brass-colorimetry.json", lab);
};

const addCrossBoundaryPorts = (technique, allEdges, nodeOwner, ownerId) => {
  const portKeys = new Set(technique.composition.ports.map((port) => `${port.kind}:${port.nodeId}`));
  for (const edge of allEdges) {
    if (nodeOwner.get(edge.to) === ownerId && nodeOwner.get(edge.from) !== ownerId && !portKeys.has(`entry:${edge.to}`)) {
      technique.composition.ports.push({ id: `entry-${edge.to}`, kind: "entry", nodeId: edge.to, label: "Entry" });
      portKeys.add(`entry:${edge.to}`);
    }
    if (nodeOwner.get(edge.from) === ownerId && nodeOwner.get(edge.to) !== ownerId && !portKeys.has(`exit:${edge.from}`)) {
      technique.composition.ports.push({ id: `exit-${edge.from}`, kind: "exit", nodeId: edge.from, label: "Exit" });
      portKeys.add(`exit:${edge.from}`);
    }
  }
  technique.composition.completion.exitPortIds = technique.composition.ports.filter((port) => port.kind === "exit").map((port) => port.id);
};

const endpoint = (nodeId, ownerId, labOwner = "lab") => ownerId === labOwner
  ? { kind: "lab-node", nodeId }
  : { kind: "technique-port", instanceId: ownerId, portId: `${ownerId.startsWith("brass") ? "" : ""}${nodeId}` };

const migrateBlue = async () => {
  const lab = await readJson("public/labs/blue1-spectroscopy.json");
  if (lab.techniqueInstances) return;
  const techniques = new Map();
  for (const id of ["blue1-standard-dilutions", "blue1-percent-transmittance", "blue1-class-calibration"]) techniques.set(id, await readJson(`public/techniques/${id}.json`));
  const auditRows = labAudit.rows.filter((row) => row.labId === lab.id);
  const physicalLocal = new Set(auditRows.filter((row) => row.currentActionOrigin.kind === "lab-local" &&
    (row.effect.flags.apparatusMaterialInstrumentState || row.effect.flags.measurementOrDirectObservation)).map((row) => row.nodeId));
  const percent = techniques.get("blue1-percent-transmittance");
  for (const nodeId of physicalLocal) {
    const node = lab.process.nodes.find((item) => item.id === nodeId);
    const action = lab.actions.find((item) => item.id === node.actionId);
    if (!percent.actions.some((item) => item.id === action.id)) percent.actions.push(clone(action));
    if (!percent.process.nodes.some((item) => item.id === node.id)) percent.process.nodes.push(clone(node));
  }
  const nodeOwner = new Map();
  for (const [id, technique] of techniques) for (const node of technique.process.nodes) nodeOwner.set(node.id, id);
  for (const node of lab.process.nodes) if (!nodeOwner.has(node.id)) nodeOwner.set(node.id, "lab");
  const originalEdges = clone(lab.process.edges);
  for (const [id, technique] of techniques) {
    technique.process.edges = originalEdges.filter((edge) => nodeOwner.get(edge.from) === id && nodeOwner.get(edge.to) === id);
    technique.metadata.version = "1.2.0";
    technique.metadata.updatedAt = "2026-08-30T00:00:00.000Z";
    technique.composition = compositionFor(technique);
    addCrossBoundaryPorts(technique, originalEdges, nodeOwner, id);
    await writeJson(`public/techniques/${id}.json`, technique);
  }
  const localNodeIds = new Set([...nodeOwner].filter(([, owner]) => owner === "lab").map(([id]) => id));
  const localActionIds = new Set(lab.process.nodes.filter((node) => localNodeIds.has(node.id)).map((node) => node.actionId));
  lab.actions = lab.actions.filter((action) => localActionIds.has(action.id));
  lab.process.nodes = lab.process.nodes.filter((node) => localNodeIds.has(node.id));
  lab.process.edges = originalEdges.filter((edge) => nodeOwner.get(edge.from) === "lab" && nodeOwner.get(edge.to) === "lab");
  delete lab.techniqueRefs;
  lab.techniqueInstances = [...techniques].map(([id]) => ({
    instanceId: id, techniqueId: id, version: "1.2.0", bindings: { equipment: {}, models: {}, configuration: {} },
    preserveIds: { actions: {}, nodes: {}, validationRules: {} },
  }));
  for (const instance of lab.techniqueInstances) {
    const technique = techniques.get(instance.techniqueId);
    for (const action of technique.actions) instance.preserveIds.actions[action.id] = action.id;
    for (const node of technique.process.nodes) instance.preserveIds.nodes[node.id] = node.id;
  }
  const startOwner = nodeOwner.get(lab.process.startNodeId);
  lab.compositionStart = startOwner === "lab" ? { kind: "lab-node", nodeId: lab.process.startNodeId } :
    { kind: "technique-port", instanceId: startOwner, portId: `entry-${lab.process.startNodeId}` };
  lab.compositionConnections = originalEdges.filter((edge) => nodeOwner.get(edge.from) !== nodeOwner.get(edge.to)).map((edge, index) => ({
    id: `blue1-cross-${index + 1}`,
    from: nodeOwner.get(edge.from) === "lab" ? { kind: "lab-node", nodeId: edge.from } : { kind: "technique-port", instanceId: nodeOwner.get(edge.from), portId: `exit-${edge.from}` },
    to: nodeOwner.get(edge.to) === "lab" ? { kind: "lab-node", nodeId: edge.to } : { kind: "technique-port", instanceId: nodeOwner.get(edge.to), portId: `entry-${edge.to}` },
    label: edge.label ?? "Next", condition: edge.condition,
  }));
  lab.reachabilityWitnesses = [{ id: "default", configuration: {}, approvalGates: {} }];
  lab.metadata.version = "1.2.0";
  lab.metadata.updatedAt = "2026-08-30T00:00:00.000Z";
  await writeJson("public/labs/blue1-spectroscopy.json", lab);
};

const migrateBrass = async () => {
  const lab = await readJson("public/labs/brass-colorimetry.json");
  if (lab.techniqueInstances) return;
  const stub = await readJson("public/techniques/brass-spectrophotometry.json");
  const rows = labAudit.rows.filter((row) => row.labId === lab.id);
  const ownedNodeIds = new Set(rows.filter(techniqueOwnedBrass).map((row) => row.nodeId));
  const ownedActionIds = new Set(rows.filter(techniqueOwnedBrass).map((row) => row.actionId));
  const actions = lab.actions.filter((action) => ownedActionIds.has(action.id)).map(clone);
  for (const action of actions) {
    const mapping = brassAtomFor(action);
    if (mapping) bindAtom(action, mapping[0], mapping[1]);
  }
  const legacyActions = stub.actions.filter((action) => !actions.some((item) => item.id === action.id)).map(clone);
  const technique = {
    ...stub,
    title: "Perform source-grounded brass spectrophotometry",
    learningGoal: "Prepare the brass solution and standards, calibrate the instrument in two stages, acquire provenance-preserving absorbance and color-depth evidence, and treat waste without embedding expected results.",
    requiredEquipment: [...new Set([...stub.requiredEquipment, ...lab.equipment])],
    initialState: clone(lab.initialState),
    actions: [...legacyActions, ...actions],
    process: {
      startNodeId: lab.process.nodes.find((node) => ownedNodeIds.has(node.id))?.id,
      nodes: lab.process.nodes.filter((node) => ownedNodeIds.has(node.id)).map(clone),
      edges: lab.process.edges.filter((edge) => ownedNodeIds.has(edge.from) && ownedNodeIds.has(edge.to)).map(clone),
    },
    successCriteria: [],
    commonMistakes: stub.commonMistakes,
    metadata: { ...stub.metadata, version: "1.1.0", updatedAt: "2026-08-30T00:00:00.000Z", tags: [...new Set([...(stub.metadata.tags ?? []), "source-grounded", "brass-colorimetry"])] },
  };
  technique.composition = compositionFor(technique, "brass-colorimetry");
  const nodeOwner = new Map(lab.process.nodes.map((node) => [node.id, ownedNodeIds.has(node.id) ? "brass-spectrophotometry" : "lab"]));
  addCrossBoundaryPorts(technique, lab.process.edges, nodeOwner, "brass-spectrophotometry");
  await writeJson("public/techniques/brass-spectrophotometry.json", technique);
  const localActionIds = new Set(lab.process.nodes.filter((node) => !ownedNodeIds.has(node.id)).map((node) => node.actionId));
  lab.actions = lab.actions.filter((action) => localActionIds.has(action.id));
  lab.process.nodes = lab.process.nodes.filter((node) => !ownedNodeIds.has(node.id));
  const originalEdges = clone(lab.process.edges);
  lab.process.edges = originalEdges.filter((edge) => nodeOwner.get(edge.from) === "lab" && nodeOwner.get(edge.to) === "lab");
  lab.techniqueInstances = [{
    instanceId: "brass-spectrophotometry", techniqueId: "brass-spectrophotometry", version: "1.1.0",
    bindings: { equipment: {}, models: {}, configuration: {} },
    preserveIds: {
      actions: Object.fromEntries(actions.map((action) => [action.id, action.id])),
      nodes: Object.fromEntries(technique.process.nodes.map((node) => [node.id, node.id])),
      validationRules: {},
    },
  }];
  const startOwner = nodeOwner.get(lab.process.startNodeId);
  lab.compositionStart = startOwner === "lab" ? { kind: "lab-node", nodeId: lab.process.startNodeId } :
    { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: `entry-${lab.process.startNodeId}` };
  lab.compositionConnections = originalEdges.filter((edge) => nodeOwner.get(edge.from) !== nodeOwner.get(edge.to)).map((edge, index) => ({
    id: `brass-cross-${index + 1}`,
    from: nodeOwner.get(edge.from) === "lab" ? { kind: "lab-node", nodeId: edge.from } : { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: `exit-${edge.from}` },
    to: nodeOwner.get(edge.to) === "lab" ? { kind: "lab-node", nodeId: edge.to } : { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: `entry-${edge.to}` },
    label: edge.label ?? "Next", condition: edge.condition,
  }));
  lab.reachabilityWitnesses = [{ id: "default", configuration: {}, approvalGates: {} }];
  lab.metadata.version = "1.2.0";
  lab.metadata.updatedAt = "2026-08-30T00:00:00.000Z";
  await writeJson("public/labs/brass-colorimetry.json", lab);
};

const refineGenerated = async () => {
  for (const id of ["transmittance-dilution", "beers-law-calibration"]) {
    const technique = await readJson(`public/techniques/${id}.json`);
    technique.metadata.version = "1.1.0";
    technique.metadata.updatedAt = "2026-08-30T00:00:00.000Z";
    for (const action of technique.actions) {
      for (const key of ["expected", "expectedMassG", "value"]) delete action.parameters[key];
    }
    technique.composition = compositionFor(technique);
    await writeJson(`public/techniques/${id}.json`, technique);
  }
};

const stripHiddenOutputs = async () => {
  const paths = [
    ...techniqueIds.map((id) => `public/techniques/${id}.json`),
    "public/labs/blue1-spectroscopy.json",
    "public/labs/brass-colorimetry.json",
  ];
  for (const path of paths) {
    const owner = await readJson(path);
    if (owner.id === "brass-spectrophotometry") {
      const incompatibleStubIds = new Set([
        "weigh-brass", "observe-dissolution", "transfer-brass-solution", "dilute-brass-solution",
        "transfer-brass-cuvette", "record-brass-absorbance", "calculate-copper-percent",
      ]);
      owner.actions = owner.actions.filter((action) => !incompatibleStubIds.has(action.id));
      for (const action of owner.actions) {
        const mapping = brassAtomFor(action);
        if (mapping) bindAtom(action, mapping[0], mapping[1]);
      }
      for (const item of [
        { id: "waste-beaker", definitionId: "waste-beaker", label: "Brass waste receiver", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
        { id: "ph-paper", definitionId: "ph-paper", label: "pH paper", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
      ]) if (!owner.initialState.equipment.some((existing) => existing.id === item.id)) owner.initialState.equipment.push(item);
      owner.requiredEquipment = [...new Set([...owner.requiredEquipment, "waste-beaker", "ph-paper"])];
      const removeConcreteInstances = (value) => {
        if (Array.isArray(value)) return value.forEach(removeConcreteInstances);
        if (!value || typeof value !== "object") return;
        for (const key of Object.keys(value)) {
          if (/InstanceId$/.test(key)) delete value[key];
          else removeConcreteInstances(value[key]);
        }
      };
      owner.actions.forEach(removeConcreteInstances);
      owner.initialState.equipment = [];
      const measurementFor = (actionId) => actionId
        .replace(/^scan-read-(\d+)-action$/, "scan-$1-absorbance")
        .replace(/^read-(0p\d+|unknown)-absorbance-action$/, "$1-absorbance")
        .replace(/^record-(0p\d+|unknown)-absorbance-action$/, "$1-absorbance");
      for (const action of owner.actions) {
        if (action.atomId === "atom.observe.read-photometer") {
          action.parameters.photometerOperation = "read";
          action.parameters.photometricQuantity = "absorbance";
          action.parameters.wavelengthMeasurementId = "{{config.wavelengthMeasurementId}}";
          action.parameters.requiresZeroNotebookTag = "spectrophotometer-blanked";
          action.parameters.cuvetteInstanceId = "{{config.measurementCuvetteInstanceId}}";
          action.parameters.measurementId = measurementFor(action.id);
          action.parameters.unit = "absorbance";
        }
        if (action.atomId === "atom.record.photometer-reading") {
          action.parameters.measurementId = measurementFor(action.id);
          action.prerequisites = [{ id: `${action.id}-needs-read`, type: "measurementRecorded", label: "The instrument reading was acquired", measurementId: action.parameters.measurementId }];
        }
        if (action.id === "calibrate-hundred-percent-t-action") {
          action.parameters.photometerOperation = "zero";
          action.parameters.wavelengthMeasurementId = "{{config.wavelengthMeasurementId}}";
          action.parameters.cuvetteInstanceId = "{{config.measurementCuvetteInstanceId}}";
        }
        if (action.id === "insert-blank-action" || action.id === "remove-blank-action") {
          action.parameters.equipmentInstanceId = "{{config.measurementCuvetteInstanceId}}";
        }
      }
    }
    if (owner.id === "brass-colorimetry") {
      owner.equipment = [...new Set([...owner.equipment, "waste-beaker", "ph-paper"])];
      for (const item of [
        { id: "waste-beaker", definitionId: "waste-beaker", label: "Brass waste receiver", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
        { id: "ph-paper", definitionId: "ph-paper", label: "pH paper", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
      ]) if (!owner.initialState.equipment.some((existing) => existing.id === item.id)) owner.initialState.equipment.push(item);
    }
    if (owner.id === "blue1-spectroscopy" || owner.id === "brass-colorimetry") {
      for (const action of owner.actions) action.effect = auditEffect("lab", owner.id, action.id);
    }
    for (const action of owner.actions ?? []) {
      for (const key of ["expected", "expectedMassG", "expectedVolumeMl", "value"]) delete action.parameters?.[key];
    }
    if (owner.id === "transmittance-dilution") {
      const absorbance = owner.actions.find((action) => action.id === "calculate-absorbance");
      if (absorbance?.prerequisites?.[0]?.id === "percent-transmittance-required") {
        absorbance.prerequisites[0].id = "percent-transmittance-required-for-absorbance";
      }
    }
    if (owner.composition) {
      const effectOwnerId = owner.id === "brass-spectrophotometry" ? "brass-colorimetry" : owner.id;
      owner.composition.legacyActionEffects = owner.actions.filter((action) => !action.atomId).map((action) => ({
        actionId: action.id,
        effect: effectOwnerId === "brass-colorimetry" && labAudit.rows.some((row) => row.labId === effectOwnerId && row.actionId === action.id)
          ? auditEffect("lab", effectOwnerId, action.id)
          : auditEffect("technique", owner.id, action.id),
      }));
      owner.composition.equipmentRoles = compositionFor(owner, effectOwnerId).equipmentRoles;
      if (owner.id === "brass-spectrophotometry") {
        owner.composition.configurationSlots = [
          { id: "wavelengthMeasurementId", valueType: "string", required: true },
          { id: "measurementCuvetteInstanceId", valueType: "string", required: true },
        ];
      }
    }
    await writeJson(path, owner);
  }
};

const repairSourceFidelity = async () => {
  const configureLegacyEffects = (technique) => {
    technique.composition = compositionFor(technique);
    for (const row of technique.composition.legacyActionEffects) {
      if (/calculate|fit|compare|plot|derive/.test(row.actionId)) {
        row.effect = { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] };
      } else {
        row.effect = { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] };
      }
    }
  };

  const buildGeneric = async (id) => {
    const current = await readJson(`public/techniques/${id}.json`);
    const commonConfig = [
      { id: "stockConcentrationMeasurementId", valueType: "string", required: true },
      { id: "stockVolumeMeasurementId", valueType: "string", required: true },
      { id: "finalVolumeMeasurementId", valueType: "string", required: true },
      { id: "wavelengthMeasurementId", valueType: "string", required: true },
      { id: "blankRuleNotebookTag", valueType: "string", required: true },
    ];
    const instrument = { "photometer-instrument": "spectrophotometer" };
    const holder = { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" };
    const actions = id === "transmittance-dilution" ? [
      makeAction({ id: "place-volumetric-flask", label: "Select the clean labelled dilution receiver", atomId: "atom.place.select-clean-dry-receiving-vessel", bindings: { "receiving-vessel": "test-tube" }, parameters: { equipmentDefinitionId: "test-tube", equipmentInstanceId: "prepared-receiver-1" } }),
      makeAction({ id: "place-graduated-cylinder", label: "Place the approved variable-volume device", atomId: "atom.place.variable-volume-device", bindings: { "variable-volume-measuring-device": "graduated-cylinder" }, parameters: { equipmentDefinitionId: "graduated-cylinder", equipmentInstanceId: "graduated-cylinder-1" } }),
      makeAction({ id: "measure-stock-dye", label: "Measure the configured stock-dye aliquot", atomId: "atom.measure.variable-volume", bindings: { "variable-volume-measuring-device": "graduated-cylinder", "liquid-source": "sample-bottle" }, parameters: { sourceInstanceId: "sample-bottle-1", targetInstanceId: "graduated-cylinder-1", volumeMeasurementId: "{{config.stockVolumeMeasurementId}}", concentrationMeasurementId: "{{config.stockConcentrationMeasurementId}}" } }),
      makeAction({ id: "transfer-dye-aliquot", label: "Transfer the measured stock aliquot", atomId: "atom.transfer.measured-liquid", bindings: { "measured-solvent-source": "graduated-cylinder", "receiving-vessel": "test-tube" }, parameters: { sourceInstanceId: "graduated-cylinder-1", targetInstanceId: "prepared-receiver-1", volumeMeasurementId: "{{config.stockVolumeMeasurementId}}" } }),
      makeAction({ id: "measure-water-volume", label: "Measure the configured water volume", atomId: "atom.measure.variable-volume", bindings: { "variable-volume-measuring-device": "graduated-cylinder", "liquid-source": "wash-bottle" }, parameters: { sourceInstanceId: "wash-bottle-1", targetInstanceId: "graduated-cylinder-1", volumeMeasurementId: "{{config.finalVolumeMeasurementId}}" } }),
      makeAction({ id: "add-water-below-mark", label: "Dilute and mix to the configured final volume", atomId: "atom.dilute.to-final-volume", bindings: { "measured-solvent-source": "graduated-cylinder", "receiving-vessel": "test-tube" }, parameters: { sourceInstanceId: "graduated-cylinder-1", targetInstanceId: "prepared-receiver-1", finalVolumeMeasurementId: "{{config.finalVolumeMeasurementId}}" } }),
      makeAction({ id: "place-spectrophotometer", label: "Place the photometer", atomId: "atom.place.photometer", bindings: instrument, parameters: { equipmentInstanceId: "spectrophotometer-1" } }),
      makeAction({ id: "configure-photometer", label: "Apply the configured wavelength and percent-transmittance mode", atomId: "atom.observe.configure-photometer", bindings: instrument, parameters: { photometerInstanceId: "spectrophotometer-1", measurementId: "{{config.wavelengthMeasurementId}}", configurationQuantity: "measurement wavelength", unit: "nm", photometricMode: "percentTransmittance", tag: "generic-photometer-configured" } }),
      makeAction({ id: "fill-blank-cuvette", label: "Fill the teacher-approved blank cuvette", atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "sample-bottle", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: "blank-source-1", targetInstanceId: "blank-cuvette-1" } }),
      makeAction({ id: "wipe-blank-cuvette", label: "Record the configured blank optical-face rule", atomId: "atom.observe.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "blank-cuvette-1", tag: "{{config.blankRuleNotebookTag}}" } }),
      makeAction({ id: "insert-blank-cuvette", label: "Insert the blank cuvette", atomId: "atom.place.insert-cuvette", bindings: holder, parameters: { equipmentInstanceId: "blank-cuvette-1", targetInstanceId: "spectrophotometer-1" } }),
      makeAction({ id: "zero-with-blank", label: "Blank the photometer", atomId: "atom.observe.blank-photometer", bindings: holder, parameters: { photometerInstanceId: "spectrophotometer-1", cuvetteInstanceId: "blank-cuvette-1", wavelengthMeasurementId: "{{config.wavelengthMeasurementId}}", photometerOperation: "zero", tag: "generic-photometer-blanked" } }),
      makeAction({ id: "remove-blank-cuvette", label: "Remove the blank cuvette", atomId: "atom.place.remove-cuvette", bindings: holder, parameters: { equipmentInstanceId: "blank-cuvette-1" } }),
      makeAction({ id: "fill-sample-cuvette", label: "Fill the sample cuvette from the labelled dilution receiver", atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: "prepared-receiver-1", targetInstanceId: "sample-cuvette-1" } }),
      makeAction({ id: "wipe-orient-sample-cuvette", label: "Record the configured sample optical-face rule", atomId: "atom.observe.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "sample-cuvette-1", tag: "{{config.blankRuleNotebookTag}}" } }),
      makeAction({ id: "insert-sample-cuvette", label: "Insert the sample cuvette", atomId: "atom.place.insert-cuvette", bindings: holder, parameters: { equipmentInstanceId: "sample-cuvette-1", targetInstanceId: "spectrophotometer-1" } }),
      makeAction({ id: "read-percent-transmittance", label: "Read percent transmittance", atomId: "atom.observe.read-photometer", bindings: holder, parameters: { photometerInstanceId: "spectrophotometer-1", cuvetteInstanceId: "sample-cuvette-1", wavelengthMeasurementId: "{{config.wavelengthMeasurementId}}", requiresZeroNotebookTag: "generic-photometer-blanked", photometerOperation: "read", measurementId: "percent-transmittance", photometricQuantity: "percentTransmittance", unit: "%T" } }),
      makeAction({ id: "record-percent-transmittance", label: "Record percent transmittance", atomId: "atom.record.photometer-reading", bindings: holder, parameters: { measurementId: "percent-transmittance", unit: "%T" }, prerequisites: [{ id: "percent-transmittance-read", type: "measurementRecorded", label: "Percent transmittance was read", measurementId: "percent-transmittance" }] }),
      makeAction({ id: "remove-sample-cuvette", label: "Remove the sample cuvette", atomId: "atom.place.remove-cuvette", bindings: holder, parameters: { equipmentInstanceId: "sample-cuvette-1" } }),
      makeAction({ id: "calculate-decimal-transmittance", label: "Calculate decimal transmittance", parameters: { calculationId: "decimal-transmittance", sourceMeasurementId: "percent-transmittance" } }),
      makeAction({ id: "calculate-absorbance", label: "Calculate absorbance", parameters: { calculationId: "absorbance", sourceMeasurementId: "percent-transmittance" } }),
      makeAction({ id: "calculate-diluted-concentration", label: "Calculate the diluted concentration", parameters: { calculationId: "diluted-concentration", stockConcentrationMeasurementId: "{{config.stockConcentrationMeasurementId}}", stockVolumeMeasurementId: "{{config.stockVolumeMeasurementId}}", finalVolumeMeasurementId: "{{config.finalVolumeMeasurementId}}" } }),
    ] : [
      makeAction({ id: "place-spectrophotometer", label: "Place the photometer", atomId: "atom.place.photometer", bindings: instrument, parameters: { equipmentInstanceId: "spectrophotometer-1" } }),
      makeAction({ id: "measure-stock-dye", label: "Measure the configured stock aliquot", atomId: "atom.measure.variable-volume", bindings: { "variable-volume-measuring-device": "graduated-cylinder", "liquid-source": "sample-bottle" }, parameters: { sourceInstanceId: "sample-bottle-1", targetInstanceId: "graduated-cylinder-1", volumeMeasurementId: "{{config.stockVolumeMeasurementId}}" } }),
      makeAction({ id: "transfer-stock-dye", label: "Transfer the measured stock aliquot", atomId: "atom.transfer.measured-liquid", bindings: { "measured-solvent-source": "graduated-cylinder", "receiving-vessel": "test-tube" }, parameters: { sourceInstanceId: "graduated-cylinder-1", targetInstanceId: "prepared-receiver-1", volumeMeasurementId: "{{config.stockVolumeMeasurementId}}" } }),
      makeAction({ id: "measure-water-volume", label: "Measure the configured dilution water volume", atomId: "atom.measure.variable-volume", bindings: { "variable-volume-measuring-device": "graduated-cylinder", "liquid-source": "wash-bottle" }, parameters: { sourceInstanceId: "wash-bottle-1", targetInstanceId: "graduated-cylinder-1", volumeMeasurementId: "{{config.finalVolumeMeasurementId}}" } }),
      makeAction({ id: "dilute-standard", label: "Dilute and mix the standard to its configured final volume", atomId: "atom.dilute.to-final-volume", bindings: { "measured-solvent-source": "graduated-cylinder", "receiving-vessel": "test-tube" }, parameters: { sourceInstanceId: "graduated-cylinder-1", targetInstanceId: "prepared-receiver-1", finalVolumeMeasurementId: "{{config.finalVolumeMeasurementId}}" } }),
      makeAction({ id: "configure-photometer", label: "Apply the configured wavelength and measurement mode", atomId: "atom.observe.configure-photometer", bindings: instrument, parameters: { photometerInstanceId: "spectrophotometer-1", measurementId: "{{config.wavelengthMeasurementId}}", configurationQuantity: "measurement wavelength", unit: "nm", photometricMode: "percentTransmittance", tag: "generic-photometer-configured" } }),
      makeAction({ id: "fill-calibration-blank", label: "Fill the configured calibration blank", atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "sample-bottle", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: "blank-source-1", targetInstanceId: "blank-cuvette-1" } }),
      makeAction({ id: "prepare-calibration-blank-optical-faces", label: "Record the configured blank optical-face rule", atomId: "atom.observe.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "blank-cuvette-1", tag: "{{config.blankRuleNotebookTag}}" } }),
      makeAction({ id: "insert-calibration-blank", label: "Insert the calibration blank", atomId: "atom.place.insert-cuvette", bindings: holder, parameters: { equipmentInstanceId: "blank-cuvette-1", targetInstanceId: "spectrophotometer-1" } }),
      makeAction({ id: "blank-photometer", label: "Blank the photometer", atomId: "atom.observe.blank-photometer", bindings: holder, parameters: { photometerInstanceId: "spectrophotometer-1", cuvetteInstanceId: "blank-cuvette-1", wavelengthMeasurementId: "{{config.wavelengthMeasurementId}}", photometerOperation: "zero", tag: "generic-photometer-blanked" } }),
      makeAction({ id: "remove-calibration-blank", label: "Remove the calibration blank", atomId: "atom.place.remove-cuvette", bindings: holder, parameters: { equipmentInstanceId: "blank-cuvette-1" } }),
      makeAction({ id: "transfer-standard-cuvette", label: "Fill the cuvette from the prepared standard receiver", atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: "prepared-receiver-1", targetInstanceId: "cuvette-1" } }),
      makeAction({ id: "prepare-standard-optical-faces", label: "Record the configured sample optical-face rule", atomId: "atom.observe.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "cuvette-1", tag: "{{config.blankRuleNotebookTag}}" } }),
      makeAction({ id: "insert-standard-cuvette", label: "Insert the standard cuvette", atomId: "atom.place.insert-cuvette", bindings: holder, parameters: { equipmentInstanceId: "cuvette-1", targetInstanceId: "spectrophotometer-1" } }),
      makeAction({ id: "read-percent-transmittance", label: "Read the standard percent transmittance", atomId: "atom.observe.read-photometer", bindings: holder, parameters: { photometerInstanceId: "spectrophotometer-1", cuvetteInstanceId: "cuvette-1", wavelengthMeasurementId: "{{config.wavelengthMeasurementId}}", requiresZeroNotebookTag: "generic-photometer-blanked", photometerOperation: "read", measurementId: "percent-transmittance", photometricQuantity: "percentTransmittance", unit: "%T" } }),
      makeAction({ id: "record-percent-transmittance", label: "Record the standard percent transmittance", atomId: "atom.record.photometer-reading", bindings: holder, parameters: { measurementId: "percent-transmittance", unit: "%T" }, prerequisites: [{ id: "standard-reading-required", type: "measurementRecorded", label: "The standard was read", measurementId: "percent-transmittance" }] }),
      makeAction({ id: "remove-standard-cuvette", label: "Remove the standard cuvette", atomId: "atom.place.remove-cuvette", bindings: holder, parameters: { equipmentInstanceId: "cuvette-1" } }),
      makeAction({ id: "calculate-absorbance", label: "Calculate absorbance from the recorded transmittance", parameters: { calculationId: "absorbance", sourceMeasurementId: "percent-transmittance" } }),
    ];
    for (const action of actions) action.id = `${id}-${action.id}`;
    current.actions = actions;
    current.process = linearProcess(actions);
    current.successCriteria = [];
    current.metadata.version = "1.1.0";
    current.metadata.updatedAt = "2026-08-31T00:00:00.000Z";
    const preparedReceiver = current.initialState.equipment.find((item) => item.id === "volumetric-flask-1" || item.id === "prepared-receiver-1");
    if (preparedReceiver) Object.assign(preparedReceiver, { id: "prepared-receiver-1", definitionId: "test-tube", label: "Clean labelled prepared-sample receiver" });
    current.requiredEquipment = [...new Set(current.requiredEquipment.map((definitionId) => definitionId === "volumetric-flask" ? "test-tube" : definitionId))];
    current.initialState.equipment = current.initialState.equipment.filter((item) => !["blank-source-1", "standard-source-1", "blank-cuvette-1"].includes(item.id));
    const stockSource = current.initialState.equipment.find((item) => item.id === "sample-bottle-1");
    if (stockSource?.contents) {
      delete stockSource.contents.volumeMl;
      delete stockSource.contents.concentration;
      for (const solute of stockSource.contents.solutes ?? []) {
        delete solute.amount;
        delete solute.unit;
      }
    }
    current.initialState.equipment.push(
      { id: "blank-source-1", definitionId: "sample-bottle", label: "Teacher-approved blank source", location: "shelf", contents: { kind: "solution", label: "configured blank", solutes: [], contamination: [], wetState: "wet", visualState: "clear-liquid" } },
      { id: "blank-cuvette-1", definitionId: "cuvette", label: "Blank cuvette", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
    );
    configureLegacyEffects(current);
    for (const role of current.composition.equipmentRoles) {
      role.required = true;
      role.sourceInstanceIds = [];
    }
    current.composition.configurationSlots = commonConfig;
    await writeJson(`public/techniques/${id}.json`, current);
  };

  await buildGeneric("transmittance-dilution");
  await buildGeneric("beers-law-calibration");

  const blueLab = await readJson("public/labs/blue1-spectroscopy.json");
  const blueTechnique = await readJson("public/techniques/blue1-percent-transmittance.json");
  const removeBlueActions = new Set(["i1-prepare-unknown-under-approved-plan", "i1-record-over-range-response"]);
  const removeBlueNodes = new Set(blueLab.process.nodes.filter((node) => removeBlueActions.has(node.actionId)).map((node) => node.id));
  const blueIncoming = blueLab.compositionConnections.find((row) => row.to.kind === "lab-node" && removeBlueNodes.has(row.to.nodeId));
  const blueOutgoing = blueLab.compositionConnections.find((row) => row.from.kind === "lab-node" && removeBlueNodes.has(row.from.nodeId));
  blueLab.actions = blueLab.actions.filter((action) => !removeBlueActions.has(action.id));
  blueLab.process.nodes = blueLab.process.nodes.filter((node) => !removeBlueNodes.has(node.id));
  blueLab.process.edges = blueLab.process.edges.filter((edge) => !removeBlueNodes.has(edge.from) && !removeBlueNodes.has(edge.to));
  blueLab.compositionConnections = blueLab.compositionConnections.filter((row) =>
    !(row.from.kind === "lab-node" && removeBlueNodes.has(row.from.nodeId)) &&
    !(row.to.kind === "lab-node" && removeBlueNodes.has(row.to.nodeId)) &&
    !/i1-(?:insert|remove)-unknown-cuvette-node/.test(JSON.stringify(row)));
  const unknownHolder = { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" };
  const unknownActions = [
    makeAction({ id: "i1-prepare-unknown-under-approved-plan", label: "Measure the approved unknown aliquot", atomId: "atom.measure.variable-volume", bindings: { "variable-volume-measuring-device": "graduated-pipette-10ml", "liquid-source": "sample-bottle" }, parameters: { sourceInstanceId: "i1-unknown-sample", targetInstanceId: "i1-unknown-measuring-device", volumeMeasurementId: "{{config.approvedUnknownAliquotMeasurementId}}" } }),
    makeAction({ id: "i1-transfer-approved-unknown-aliquot", label: "Transfer the measured unknown aliquot to its prepared receiver", atomId: "atom.transfer.measured-liquid", bindings: { "measured-solvent-source": "graduated-pipette-10ml", "receiving-vessel": "test-tube" }, parameters: { sourceInstanceId: "i1-unknown-measuring-device", targetInstanceId: "i1-prepared-unknown-tube" } }),
    makeAction({ id: "i1-fill-unknown-cuvette", label: "Fill the unknown cuvette from the prepared unknown receiver", atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: "i1-prepared-unknown-tube", targetInstanceId: "i1-unknown-cuvette" } }),
    makeAction({ id: "i1-prepare-unknown-optical-faces", label: "Record the approved unknown cuvette optical-face rule", atomId: "atom.observe.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "i1-unknown-cuvette", tag: "teacher-blank-cuvette-rule" } }),
    blueTechnique.actions.find((action) => action.id === "i1-insert-unknown-cuvette"),
    blueTechnique.actions.find((action) => action.id === "i1-read-unknown-percent-t"),
    makeAction({ id: "i1-record-unknown-percent-t", label: "Record the unknown percent transmittance", atomId: "atom.record.photometer-reading", bindings: unknownHolder, parameters: { measurementId: "i1-unknown-percent-t", unit: "%T" }, prerequisites: [{ id: "unknown-read-required", type: "measurementRecorded", label: "The unknown was read", measurementId: "i1-unknown-percent-t" }] }),
    blueTechnique.actions.find((action) => action.id === "i1-remove-unknown-cuvette"),
    makeAction({ id: "i1-measure-over-range-unknown-aliquot", label: "Measure the approved over-range unknown aliquot from the original sample", atomId: "atom.measure.variable-volume", bindings: { "variable-volume-measuring-device": "graduated-pipette-10ml", "liquid-source": "sample-bottle" }, parameters: { sourceInstanceId: "i1-unknown-sample", targetInstanceId: "i1-unknown-measuring-device", volumeMeasurementId: "{{config.approvedUnknownAliquotMeasurementId}}" } }),
    makeAction({ id: "i1-record-over-range-response", label: "Dilute the measured over-range aliquot to the approved final volume", atomId: "atom.dilute.to-final-volume", bindings: { "measured-solvent-source": "graduated-pipette-10ml", "receiving-vessel": "test-tube" }, parameters: { sourceInstanceId: "i1-unknown-measuring-device", targetInstanceId: "i1-diluted-unknown-tube", finalVolumeMeasurementId: "{{config.approvedOverRangeFinalVolumeMeasurementId}}" } }),
    makeAction({ id: "i1-fill-diluted-unknown-cuvette", label: "Fill the cuvette with the approved diluted unknown", atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: "i1-diluted-unknown-tube", targetInstanceId: "i1-unknown-cuvette" } }),
    makeAction({ id: "i1-prepare-diluted-unknown-optical-faces", label: "Record the approved diluted-unknown optical-face rule", atomId: "atom.observe.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "i1-unknown-cuvette", tag: "teacher-blank-cuvette-rule" } }),
    makeAction({ id: "i1-insert-diluted-unknown-cuvette", label: "Insert the diluted unknown cuvette", atomId: "atom.place.insert-cuvette", bindings: unknownHolder, parameters: { equipmentInstanceId: "i1-unknown-cuvette", targetInstanceId: "i1-spectrophotometer" } }),
    makeAction({ id: "i1-read-diluted-unknown-percent-t", label: "Read the diluted unknown percent transmittance", atomId: "atom.observe.read-photometer", bindings: unknownHolder, parameters: { photometerInstanceId: "i1-spectrophotometer", cuvetteInstanceId: "i1-unknown-cuvette", wavelengthMeasurementId: "i1-wavelength", requiresZeroNotebookTag: "instrument-blanked", photometerOperation: "read", measurementId: "i1-diluted-unknown-percent-t", photometricQuantity: "percentTransmittance", unit: "%T" } }),
    makeAction({ id: "i1-record-diluted-unknown-percent-t", label: "Record the diluted unknown percent transmittance", atomId: "atom.record.photometer-reading", bindings: unknownHolder, parameters: { measurementId: "i1-diluted-unknown-percent-t", unit: "%T" }, prerequisites: [{ id: "diluted-unknown-read-required", type: "measurementRecorded", label: "The diluted unknown was read", measurementId: "i1-diluted-unknown-percent-t" }] }),
    makeAction({ id: "i1-remove-diluted-unknown-cuvette", label: "Remove the diluted unknown cuvette", atomId: "atom.place.remove-cuvette", bindings: unknownHolder, parameters: { equipmentInstanceId: "i1-unknown-cuvette" } }),
  ].filter(Boolean);
  const oldUnknownIds = new Set(unknownActions.map((action) => action.id));
  blueTechnique.actions = [...blueTechnique.actions.filter((action) => !oldUnknownIds.has(action.id)), ...unknownActions];
  blueTechnique.process.nodes = [...blueTechnique.process.nodes.filter((node) => !oldUnknownIds.has(node.actionId)), ...unknownActions.map((action) => makeNode(action))];
  blueTechnique.process.edges = [
    ...blueTechnique.process.edges.filter((edge) => ![...oldUnknownIds].some((id) => edge.from === `${id}-node` || edge.to === `${id}-node`)),
    ...unknownActions.slice(1).map((action, index) => ({ from: `${unknownActions[index].id}-node`, to: `${action.id}-node`, label: "Next", condition: { type: "validationPassed" } })),
  ];
  blueTechnique.composition = compositionFor(blueTechnique);
  blueTechnique.composition.configurationSlots = [
    { id: "approvedUnknownAliquotMeasurementId", valueType: "string", required: true },
    { id: "approvedOverRangeFinalVolumeMeasurementId", valueType: "string", required: true },
  ];
  for (const port of [
    { id: "entry-i1-prepare-unknown-under-approved-plan-node", kind: "entry", nodeId: "i1-prepare-unknown-under-approved-plan-node", label: "Approved unknown entry" },
    { id: "exit-i1-remove-diluted-unknown-cuvette-node", kind: "exit", nodeId: "i1-remove-diluted-unknown-cuvette-node", label: "Unknown measurement exit" },
  ]) if (!blueTechnique.composition.ports.some((existing) => existing.id === port.id)) blueTechnique.composition.ports.push(port);
  blueTechnique.composition.completion.exitPortIds = [...new Set(blueTechnique.composition.ports.filter((port) => port.kind === "exit").map((port) => port.id))];
  for (const item of [
    { id: "i1-unknown-measuring-device", definitionId: "graduated-pipette-10ml", label: "Approved unknown aliquot pipette", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
    { id: "i1-prepared-unknown-tube", definitionId: "test-tube", label: "Prepared unknown receiver", location: "shelf", contents: { kind: "empty", label: "prepared unknown receiver", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
    { id: "i1-diluted-unknown-tube", definitionId: "test-tube", label: "Approved diluted unknown", location: "shelf", contents: { kind: "empty", label: "approved diluted unknown", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
  ]) {
    if (!blueLab.initialState.equipment.some((existing) => existing.id === item.id)) blueLab.initialState.equipment.push(item);
  }
  blueLab.initialState.equipment.find((item) => item.id === "i1-diluted-unknown-tube").location = "shelf";
  const existingDilutedTube = blueTechnique.initialState.equipment.find((item) => item.id === "i1-diluted-unknown-tube");
  if (existingDilutedTube) existingDilutedTube.location = "shelf";
  blueTechnique.requiredEquipment = [...new Set([...blueTechnique.requiredEquipment, "graduated-pipette-10ml", "sample-bottle", "test-tube", "volumetric-flask"] )];
  const blueInstance = blueLab.techniqueInstances.find((instance) => instance.techniqueId === blueTechnique.id);
  blueInstance.bindings.configuration = {
    approvedUnknownAliquotMeasurementId: "i1-approved-unknown-aliquot",
    approvedOverRangeFinalVolumeMeasurementId: "i1-approved-over-range-final-volume",
  };
  for (const action of unknownActions) blueInstance.preserveIds.actions[action.id] = action.id;
  for (const action of unknownActions) blueInstance.preserveIds.nodes[`${action.id}-node`] = `${action.id}-node`;
  if (blueIncoming) blueLab.compositionConnections.push({ ...blueIncoming, id: "blue1-cross-unknown-entry", to: { kind: "technique-port", instanceId: blueTechnique.id, portId: "entry-i1-prepare-unknown-under-approved-plan-node" } });
  if (blueOutgoing) blueLab.compositionConnections.push({ ...blueOutgoing, id: "blue1-cross-unknown-exit", from: { kind: "technique-port", instanceId: blueTechnique.id, portId: "exit-i1-remove-diluted-unknown-cuvette-node" } });
  if (!blueLab.compositionConnections.some((row) => row.id === "blue1-cross-unknown-entry")) blueLab.compositionConnections.push({ id: "blue1-cross-unknown-entry", from: { kind: "lab-node", nodeId: "i1-record-inquiry-approval-node" }, to: { kind: "technique-port", instanceId: blueTechnique.id, portId: "entry-i1-prepare-unknown-under-approved-plan-node" }, label: "Execute approved plan", condition: { type: "validationPassed" } });
  if (!blueLab.compositionConnections.some((row) => row.id === "blue1-cross-unknown-exit")) blueLab.compositionConnections.push({ id: "blue1-cross-unknown-exit", from: { kind: "technique-port", instanceId: blueTechnique.id, portId: "exit-i1-remove-diluted-unknown-cuvette-node" }, to: { kind: "lab-node", nodeId: "i1-record-unknown-reading-set-node" }, label: "Analyze recorded unknown evidence", condition: { type: "validationPassed" } });
  await writeJson("public/techniques/blue1-percent-transmittance.json", blueTechnique);
  await writeJson("public/labs/blue1-spectroscopy.json", blueLab);

  const brassLab = await readJson("public/labs/brass-colorimetry.json");
  const brass = await readJson("public/techniques/brass-spectrophotometry.json");
  const scanOldActionIds = new Set(brass.actions.filter((action) => /^scan-(?:set|read|record)-/.test(action.id)).map((action) => action.id));
  const scanOldNodeIds = new Set(brass.process.nodes.filter((node) => scanOldActionIds.has(node.actionId)).map((node) => node.id));
  const scanActions = [];
  for (let wavelength = 400; wavelength <= 700; wavelength += 20) {
    const waveId = `scan-${wavelength}-wavelength-nm`;
    scanActions.push(
      makeAction({ id: `scan-set-${wavelength}-action`, label: `Set the scan wavelength to ${wavelength} nm`, atomId: "atom.observe.configure-photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { photometerInstanceId: "spectrophotometer", measurementId: waveId, configurationQuantity: "scan wavelength", unit: "nm", wavelengthNm: wavelength, photometricMode: "absorbance", tag: "prelab-scan-ready", configurationProvenance: "manual-stated scan setting" } }),
      makeAction({ id: `scan-read-${wavelength}-action`, label: `Read assigned salt A at ${wavelength} nm`, atomId: "atom.observe.read-photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { photometerInstanceId: "spectrophotometer", wavelengthMeasurementId: waveId, measurementId: `scan-${wavelength}-salt-a-absorbance`, sampleIdentity: "assigned-salt-a", photometricQuantity: "absorbance", unit: "absorbance" } }),
      makeAction({ id: `scan-record-${wavelength}-action`, label: `Record assigned salt A at ${wavelength} nm`, atomId: "atom.record.photometer-reading", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { measurementId: `scan-${wavelength}-salt-a-absorbance`, sampleIdentity: "assigned-salt-a", unit: "absorbance" } }),
      makeAction({ id: `scan-read-${wavelength}-salt-b-action`, label: `Read assigned salt B at ${wavelength} nm`, atomId: "atom.observe.read-photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { photometerInstanceId: "spectrophotometer", wavelengthMeasurementId: waveId, measurementId: `scan-${wavelength}-salt-b-absorbance`, sampleIdentity: "assigned-salt-b", photometricQuantity: "absorbance", unit: "absorbance" } }),
      makeAction({ id: `scan-record-${wavelength}-salt-b-action`, label: `Record assigned salt B at ${wavelength} nm`, atomId: "atom.record.photometer-reading", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { measurementId: `scan-${wavelength}-salt-b-absorbance`, sampleIdentity: "assigned-salt-b", unit: "absorbance" } }),
    );
  }
  brass.actions = [...brass.actions.filter((action) => !scanOldActionIds.has(action.id)), ...scanActions];
  brass.process.nodes = [...brass.process.nodes.filter((node) => !scanOldNodeIds.has(node.id)), ...scanActions.map((action) => makeNode(action))];
  brass.process.edges = [
    ...brass.process.edges.filter((edge) => !scanOldNodeIds.has(edge.from) && !scanOldNodeIds.has(edge.to)),
    ...scanActions.slice(1).map((action, index) => ({ from: `${scanActions[index].id}-node`, to: `${action.id}-node`, label: "Next", condition: { type: "validationPassed" } })),
  ];
  brass.process.startNodeId = `${scanActions[0].id}-node`;

  const samples = ["0p0250", "0p0500", "0p100", "0p200", "0p400", "unknown"];
  const addedSampleActions = [];
  for (const sample of samples) {
    const tubeId = sample === "unknown" ? "unknown-sample-tube" : `standard-${sample}-tube`;
    const conditionId = `condition-${sample}-action`;
    const readId = `read-${sample}-absorbance-action`;
    const recordId = `record-${sample}-absorbance-action`;
    const returnId = `return-${sample}-action`;
    const sequence = [
      makeAction({ id: `fill-${sample}-cuvette-action`, label: `Fill the cuvette from ${tubeId}`, atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: tubeId, targetInstanceId: "measurement-cuvette", sampleIdentity: sample } }),
      makeAction({ id: `prepare-${sample}-optical-faces-action`, label: `Wipe and orient the filled ${sample} cuvette`, atomId: "atom.rinse.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "measurement-cuvette", sampleIdentity: sample } }),
      makeAction({ id: `insert-${sample}-cuvette-action`, label: `Insert the ${sample} cuvette`, atomId: "atom.place.insert-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: "measurement-cuvette", targetInstanceId: "spectrophotometer", sampleIdentity: sample } }),
      makeAction({ id: `remove-${sample}-cuvette-action`, label: `Remove the ${sample} cuvette`, atomId: "atom.place.remove-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: "measurement-cuvette", sampleIdentity: sample } }),
    ];
    addedSampleActions.push(...sequence);
    const conditionNode = brass.process.nodes.find((node) => node.actionId === conditionId)?.id;
    const readNode = brass.process.nodes.find((node) => node.actionId === readId)?.id;
    const recordNode = brass.process.nodes.find((node) => node.actionId === recordId)?.id;
    const returnNode = brass.process.nodes.find((node) => node.actionId === returnId)?.id;
    const sampleSequenceNodeIds = new Set([
      conditionNode,
      readNode,
      recordNode,
      returnNode,
      ...sequence.map((action) => `${action.id}-node`),
    ]);
    brass.process.edges = brass.process.edges.filter((edge) => !(
      sampleSequenceNodeIds.has(edge.from) && sampleSequenceNodeIds.has(edge.to)
    ));
    brass.process.edges.push(
      { from: conditionNode, to: `${sequence[0].id}-node`, label: "Next", condition: { type: "validationPassed" } },
      { from: `${sequence[0].id}-node`, to: `${sequence[1].id}-node`, label: "Next", condition: { type: "validationPassed" } },
      { from: `${sequence[1].id}-node`, to: `${sequence[2].id}-node`, label: "Next", condition: { type: "validationPassed" } },
      { from: `${sequence[2].id}-node`, to: readNode, label: "Next", condition: { type: "validationPassed" } },
      { from: readNode, to: recordNode, label: "Next", condition: { type: "validationPassed" } },
      { from: recordNode, to: `${sequence[3].id}-node`, label: "Next", condition: { type: "validationPassed" } },
      { from: `${sequence[3].id}-node`, to: returnNode, label: "Next", condition: { type: "validationPassed" } },
    );
  }
  const addedSampleActionIds = new Set(addedSampleActions.map((action) => action.id));
  brass.actions = [...brass.actions.filter((action) => !addedSampleActionIds.has(action.id)), ...addedSampleActions];
  brass.process.nodes = [...brass.process.nodes.filter((node) => !addedSampleActionIds.has(node.actionId)), ...addedSampleActions.map((action) => makeNode(action))];
  const removeBrassConcreteInstanceIds = (value) => {
    if (Array.isArray(value)) return value.forEach(removeBrassConcreteInstanceIds);
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      if (/InstanceId$/.test(key)) delete value[key];
      else removeBrassConcreteInstanceIds(value[key]);
    }
  };
  brass.actions.forEach(removeBrassConcreteInstanceIds);
  const photometerSourceId = "spectrophotometer";
  const cuvetteSourceId = "measurement-cuvette";
  for (const action of brass.actions) {
    if (action.atomId === "atom.observe.read-photometer") {
      action.parameters.photometerInstanceId = photometerSourceId;
      action.parameters.cuvetteInstanceId = cuvetteSourceId;
      action.parameters.photometerOperation = "read";
      action.parameters.requiresZeroNotebookTag = /^scan-read-/.test(action.id) ? "prelab-scan-ready" : "spectrophotometer-blanked";
    }
    if (action.atomId === "atom.record.photometer-reading") {
      action.prerequisites = [{ id: `${action.id}-needs-read`, type: "measurementRecorded", label: "The named photometer reading was acquired", measurementId: action.parameters.measurementId }];
    }
    if (action.atomId === "atom.place.insert-cuvette" || action.atomId === "atom.place.remove-cuvette") action.parameters.equipmentInstanceId = cuvetteSourceId;
    if (action.id === "calibrate-hundred-percent-t-action") {
      action.parameters.photometerInstanceId = photometerSourceId;
      action.parameters.cuvetteInstanceId = cuvetteSourceId;
      action.parameters.photometerOperation = "zero";
      action.parameters.tag = "spectrophotometer-blanked";
    }
  }
  brassLab.compositionConnections = brassLab.compositionConnections.filter((row) => {
    if (row.from.kind !== "technique-port" || row.to.kind !== "technique-port") return true;
    return !/^(?:condition|record)-/.test(row.from.portId.replace(/^exit-/, "")) || !/^(?:read|return)-/.test(row.to.portId.replace(/^entry-/, ""));
  });

  const bridgeLabNode = (actionId, replacementAction = null) => {
    const node = brassLab.process.nodes.find((candidate) => candidate.actionId === actionId);
    if (!node) return;
    const incoming = brassLab.compositionConnections.filter((row) => row.to.kind === "lab-node" && row.to.nodeId === node.id);
    const outgoing = brassLab.compositionConnections.filter((row) => row.from.kind === "lab-node" && row.from.nodeId === node.id);
    brassLab.compositionConnections = brassLab.compositionConnections.filter((row) =>
      !(row.to.kind === "lab-node" && row.to.nodeId === node.id) && !(row.from.kind === "lab-node" && row.from.nodeId === node.id));
    for (const left of incoming) for (const right of outgoing) brassLab.compositionConnections.push({
      id: `brass-repair-${actionId}-${left.id}-${right.id}`,
      from: left.from,
      to: right.to,
      label: "Continue after required evidence",
      condition: { type: "validationPassed" },
    });
    brassLab.actions = brassLab.actions.filter((action) => action.id !== actionId);
    brassLab.process.nodes = brassLab.process.nodes.filter((candidate) => candidate.id !== node.id);
    brassLab.process.edges = brassLab.process.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id);
    if (replacementAction) {
      const action = brassLab.actions.find((candidate) => candidate.id === replacementAction.id);
      if (action) Object.assign(action, replacementAction);
    }
  };
  for (const actionId of [
    "teacher-add-water-action", "mix-unknown-action", "standard-0p400-mix-action", "standard-0p200-mix-action",
    "standard-0p100-mix-action", "standard-0p0500-mix-action", "standard-0p0250-mix-action", "cleanup-action",
  ]) bridgeLabNode(actionId);

  const teacherDigestAction = makeAction({
    id: "confirm-teacher-diluted-digest-action",
    label: "Confirm the externally supplied teacher-diluted digest state",
    parameters: { tag: "teacher-diluted-digest-ready", externalStateBoundary: "The teacher performs the manual-stated water addition outside learner control; this confirmation records only that the resulting digest is available." },
    evidence: ["teacher-controlled state boundary", "no learner physical operation"],
  });
  teacherDigestAction.effect = { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] };
  const existingTeacherDigestAction = brassLab.actions.find((action) => action.id === teacherDigestAction.id);
  if (existingTeacherDigestAction) Object.assign(existingTeacherDigestAction, teacherDigestAction);
  else brassLab.actions.push(teacherDigestAction);
  if (!brassLab.process.nodes.some((node) => node.actionId === teacherDigestAction.id)) brassLab.process.nodes.push(makeNode(teacherDigestAction, "teacherNote", "Record that the teacher-controlled diluted digest has been supplied; do not simulate or infer the water addition."));
  if (!brassLab.process.edges.some((edge) => edge.from === "teacher-cover-digest" && edge.to === `${teacherDigestAction.id}-node`)) brassLab.process.edges.push({ from: "teacher-cover-digest", to: `${teacherDigestAction.id}-node`, label: "Teacher supplies diluted digest", condition: { type: "validationPassed" } });

  const ensureBrassConnection = (id, from, to) => {
    if (!brassLab.compositionConnections.some((row) => row.id === id)) brassLab.compositionConnections.push({ id, from, to, label: "Continue after required evidence", condition: { type: "validationPassed" } });
  };
  ensureBrassConnection("brass-repair-teacher-digest-to-transfer", { kind: "lab-node", nodeId: `${teacherDigestAction.id}-node` }, { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: "entry-transfer-digest" });
  ensureBrassConnection("brass-repair-unknown-to-standard-calculations", { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: "exit-dilute-unknown-to-mark" }, { kind: "lab-node", nodeId: "standard-0p200-aliquot-ml" });
  ensureBrassConnection("brass-repair-final-standard-to-approval", { kind: "technique-port", instanceId: "brass-spectrophotometry", portId: "exit-standard-0p0250-dilute" }, { kind: "lab-node", nodeId: "teacher-standard-approval" });

  if (!brassLab.initialState.equipment.some((item) => item.id === "unknown-sample-tube")) {
    brassLab.initialState.equipment.push({ id: "unknown-sample-tube", definitionId: "test-tube", label: "Brass unknown sample tube", location: "shelf", contents: { kind: "solution", label: "brass unknown aliquot", solutes: [], contamination: [], wetState: "wet", visualState: "blue-dye-solution" } });
    brassLab.equipment.push("test-tube");
  }
  brassLab.initialState.equipment.find((item) => item.id === "unknown-sample-tube").location = "shelf";
  brassLab.initialState.equipment.find((item) => item.id === "unknown-sample-tube").contents.visualState = "blue-dye-solution";
  brass.composition = compositionFor(brass, "brass-colorimetry");
  for (const role of brass.composition.equipmentRoles) role.required = true;
  brass.composition.configurationSlots = [
    { id: "wavelengthMeasurementId", valueType: "string", required: true },
    { id: "measurementCuvetteInstanceId", valueType: "string", required: true },
  ];
  const scanExit = `${scanActions.at(-1).id}-node`;
  if (!brass.composition.ports.some((port) => port.id === `exit-${scanExit}`)) brass.composition.ports.push({ id: `exit-${scanExit}`, kind: "exit", nodeId: scanExit, label: "Scan exit" });
  brass.composition.completion.exitPortIds = [...new Set(brass.composition.ports.filter((port) => port.kind === "exit").map((port) => port.id))];
  const scanOutgoing = brassLab.compositionConnections.find((row) => row.from.kind === "technique-port" && /scan-record-700/.test(row.from.portId));
  if (scanOutgoing) scanOutgoing.from.portId = `exit-${scanExit}`;
  const scanIncoming = brassLab.compositionConnections.find((row) => row.to.kind === "technique-port" && /entry-scan-(?:read|set)-400/.test(row.to.portId));
  if (scanIncoming) scanIncoming.to.portId = `entry-${scanActions[0].id}-node`;
  const brassInstance = brassLab.techniqueInstances.find((instance) => instance.techniqueId === brass.id);
  for (const action of [...scanActions, ...addedSampleActions]) brassInstance.preserveIds.actions[action.id] = action.id;
  for (const action of [...scanActions, ...addedSampleActions]) brassInstance.preserveIds.nodes[`${action.id}-node`] = `${action.id}-node`;
  const sanitizeLearnerText = (value) => {
    if (Array.isArray(value)) return value.forEach(sanitizeLearnerText);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string") {
        value[key] = child
          .replace(/Configured teaching-profile reading:[^.]+\./gi, "Acquire the named sample reading from the configured instrument state.")
          .replace(/the 0\.160 M Cu2\+ result/gi, "the calculated Cu2+ molarity")
          .replace(/the recorded 1\.250 g brass mass/gi, "the recorded brass mass")
          .replace(/; this default demonstration profile uses 81\.2% Cu as a clearly labeled replaceable value/gi, "")
          .replace(/; this default demonstration profile uses 80\.7% Cu as a clearly labeled replaceable value/gi, "")
          .replace(/; the default demonstration profile uses a replaceable 3\.4% Cu/gi, "");
      } else sanitizeLearnerText(child);
    }
  };
  sanitizeLearnerText(brass);
  sanitizeLearnerText(brassLab);
  await writeJson("public/techniques/brass-spectrophotometry.json", brass);
  await writeJson("public/labs/brass-colorimetry.json", brassLab);
};

const secondMediumRepair = async () => {
  const blueDilutions = await readJson("public/techniques/blue1-standard-dilutions.json");
  const mixActions = blueDilutions.actions.filter((action) => /-mix$/.test(action.id));
  for (const mixAction of mixActions) {
    const prefix = mixAction.id.slice(0, -"-mix".length);
    const waterTransfer = blueDilutions.actions.find((action) => action.id === `${prefix}-transfer-water`);
    if (waterTransfer) {
      bindAtom(waterTransfer, "atom.dilute.to-final-volume", {
        "measured-solvent-source": "graduated-pipette-10ml",
        "receiving-vessel": "test-tube",
      });
      waterTransfer.verb = "dilute";
      waterTransfer.label = waterTransfer.label.replace(/^Transfer water to /, "Add the measured water and mix the ");
      waterTransfer.parameters.finalVolumeMl = 10;
      waterTransfer.parameters.statedFinalVolume = "10 mL";
      waterTransfer.stateChanges = [`${waterTransfer.label}: the labelled standard is mixed at the source-stated 10 mL final volume.`];
      waterTransfer.feedback.success = `${waterTransfer.label} complete.`;
    }
    const nodeId = `${mixAction.id}-node`;
    const incoming = blueDilutions.process.edges.filter((edge) => edge.to === nodeId);
    const outgoing = blueDilutions.process.edges.filter((edge) => edge.from === nodeId);
    blueDilutions.process.edges = blueDilutions.process.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
    for (const left of incoming) for (const right of outgoing) {
      blueDilutions.process.edges.push({ ...left, to: right.to });
    }
    blueDilutions.actions = blueDilutions.actions.filter((action) => action.id !== mixAction.id);
    blueDilutions.process.nodes = blueDilutions.process.nodes.filter((node) => node.id !== nodeId);
    for (const action of blueDilutions.actions) {
      for (const prerequisite of action.prerequisites ?? []) {
        if (prerequisite.actionId === mixAction.id) {
          prerequisite.actionId = waterTransfer?.id
            ?? (blueDilutions.actions.some((candidate) => candidate.id === `${prefix}-transfer-stock`) ? `${prefix}-transfer-stock` : `${prefix}-confirm-zero-stock`);
          prerequisite.label = "The source-stated standard preparation is complete";
        }
      }
    }
    for (const criterion of blueDilutions.successCriteria ?? []) {
      if (criterion.actionId === mixAction.id) {
        criterion.actionId = waterTransfer?.id
          ?? (blueDilutions.actions.some((candidate) => candidate.id === `${prefix}-transfer-stock`) ? `${prefix}-transfer-stock` : `${prefix}-confirm-zero-stock`);
        criterion.label = "The source-stated standard preparation is complete";
      }
    }
  }
  const finalBlueActionIds = new Set(blueDilutions.actions.map((action) => action.id));
  for (const criterion of blueDilutions.successCriteria ?? []) {
    if (!finalBlueActionIds.has(criterion.actionId) && /-mix$/.test(criterion.actionId ?? "")) {
      const prefix = criterion.actionId.slice(0, -"-mix".length);
      criterion.actionId = finalBlueActionIds.has(`${prefix}-transfer-water`) ? `${prefix}-transfer-water`
        : finalBlueActionIds.has(`${prefix}-transfer-stock`) ? `${prefix}-transfer-stock`
          : `${prefix}-confirm-zero-stock`;
      criterion.label = "The source-stated standard preparation is complete";
    }
  }
  blueDilutions.composition = compositionFor(blueDilutions);
  for (const role of blueDilutions.composition.equipmentRoles) role.required = true;
  await writeJson("public/techniques/blue1-standard-dilutions.json", blueDilutions);

  const bluePercent = await readJson("public/techniques/blue1-percent-transmittance.json");
  bluePercent.composition = compositionFor(bluePercent);
  for (const role of bluePercent.composition.equipmentRoles) role.required = true;
  bluePercent.composition.configurationSlots = [
    { id: "approvedUnknownAliquotMeasurementId", valueType: "string", required: true },
    { id: "approvedOverRangeFinalVolumeMeasurementId", valueType: "string", required: true },
  ];
  await writeJson("public/techniques/blue1-percent-transmittance.json", bluePercent);

  const blueLab = await readJson("public/labs/blue1-spectroscopy.json");
  const blueDilutionInstance = blueLab.techniqueInstances.find((instance) => instance.techniqueId === blueDilutions.id);
  if (blueDilutionInstance) {
    const actionIds = new Set(blueDilutions.actions.map((action) => action.id));
    const nodeIds = new Set(blueDilutions.process.nodes.map((node) => node.id));
    blueDilutionInstance.preserveIds.actions = Object.fromEntries(Object.entries(blueDilutionInstance.preserveIds.actions).filter(([id]) => actionIds.has(id)));
    blueDilutionInstance.preserveIds.nodes = Object.fromEntries(Object.entries(blueDilutionInstance.preserveIds.nodes).filter(([id]) => nodeIds.has(id)));
  }
  await writeJson("public/labs/blue1-spectroscopy.json", blueLab);

  const brass = await readJson("public/techniques/brass-spectrophotometry.json");
  const brassLab = await readJson("public/labs/brass-colorimetry.json");
  brassLab.initialState.equipment = brassLab.initialState.equipment.filter((item) => !item.id.startsWith("cycle05-"));
  const brassSample = brassLab.initialState.equipment.find((item) => item.id === "brass-sample-vial");
  if (brassSample?.contents) {
    delete brassSample.contents.massG;
    for (const solute of brassSample.contents.solutes ?? []) {
      delete solute.amount;
      delete solute.unit;
    }
  }
  for (const salt of ["a", "b"]) {
    const id = `assigned-salt-${salt}-solution`;
    if (!brassLab.initialState.equipment.some((item) => item.id === id)) {
      brassLab.initialState.equipment.push({
        id,
        definitionId: "test-tube",
        label: `Teacher-assigned salt ${salt.toUpperCase()} solution`,
        location: "shelf",
        contents: { kind: "solution", label: `assigned salt ${salt.toUpperCase()} solution`, solutes: [], contamination: [], wetState: "wet", visualState: "clear-liquid" },
      });
    }
  }
  brassLab.equipment = [...new Set([...brassLab.equipment, "test-tube"])];

  const oldScanActions = new Set(brass.actions.filter((action) => /^scan-/.test(action.id)).map((action) => action.id));
  const oldScanNodes = new Set(brass.process.nodes.filter((node) => oldScanActions.has(node.actionId)).map((node) => node.id));
  const scanActions = [];
  for (let wavelength = 400; wavelength <= 700; wavelength += 20) {
    const wavelengthMeasurementId = `scan-${wavelength}-wavelength-nm`;
    const scanStep = ((wavelength - 400) / 20) + 1;
    scanActions.push(makeAction({
      id: `scan-set-${wavelength}-action`,
      label: `Set source-stated scan wavelength step ${scanStep}`,
      atomId: "atom.observe.configure-photometer",
      bindings: { "photometer-instrument": "spectrophotometer" },
      parameters: { photometerInstanceId: "spectrophotometer", measurementId: wavelengthMeasurementId, configurationQuantity: "scan wavelength", configurationValue: wavelength, unit: "nm", photometricMode: "absorbance", tag: `scan-${wavelength}-configured` },
    }));
    for (const salt of ["a", "b"]) {
      const sampleIdentity = `assigned-salt-${salt}`;
      const sourceInstanceId = `${sampleIdentity}-solution`;
      const measurementId = `scan-${wavelength}-salt-${salt}-absorbance`;
      scanActions.push(
        makeAction({ id: `scan-fill-${wavelength}-salt-${salt}-action`, label: `Fill the cuvette from assigned salt ${salt.toUpperCase()}`, atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId, targetInstanceId: "measurement-cuvette", sampleIdentity } }),
        makeAction({ id: `scan-insert-${wavelength}-salt-${salt}-action`, label: `Insert assigned salt ${salt.toUpperCase()} for scan step ${scanStep}`, atomId: "atom.place.insert-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: "measurement-cuvette", targetInstanceId: "spectrophotometer", sampleIdentity } }),
        makeAction({ id: `scan-read-${wavelength}-${salt === "a" ? "action" : "salt-b-action"}`, label: `Read assigned salt ${salt.toUpperCase()} at scan step ${scanStep}`, atomId: "atom.observe.read-photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { photometerInstanceId: "spectrophotometer", cuvetteInstanceId: "measurement-cuvette", wavelengthMeasurementId, measurementId, sampleIdentity, photometricQuantity: "absorbance", unit: "absorbance", photometerOperation: "read", requiresZeroNotebookTag: "prelab-scan-ready" } }),
        makeAction({ id: `scan-record-${wavelength}-${salt === "a" ? "action" : "salt-b-action"}`, label: `Record assigned salt ${salt.toUpperCase()} at scan step ${scanStep}`, atomId: "atom.record.photometer-reading", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { measurementId, sampleIdentity, unit: "absorbance" }, prerequisites: [{ id: `scan-${wavelength}-salt-${salt}-read-required`, type: "measurementRecorded", label: `Assigned salt ${salt.toUpperCase()} was read at this scan step`, measurementId }] }),
        makeAction({ id: `scan-remove-${wavelength}-salt-${salt}-action`, label: `Remove assigned salt ${salt.toUpperCase()} after scan step ${scanStep}`, atomId: "atom.place.remove-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: "measurement-cuvette", sampleIdentity } }),
        makeAction({ id: `scan-return-${wavelength}-salt-${salt}-action`, label: `Return assigned salt ${salt.toUpperCase()} to its source tube`, atomId: "atom.transfer.return-cuvette-to-origin", bindings: { "photometer-sample-holder": "cuvette", "provenance-matched-sample-receiver": "test-tube" }, parameters: { sourceInstanceId: "measurement-cuvette", targetInstanceId: sourceInstanceId, sampleIdentity } }),
      );
    }
  }
  brass.actions = [...brass.actions.filter((action) => !oldScanActions.has(action.id)), ...scanActions];
  brass.process.nodes = [...brass.process.nodes.filter((node) => !oldScanNodes.has(node.id)), ...scanActions.map((action) => makeNode(action))];
  brass.process.edges = [
    ...brass.process.edges.filter((edge) => !oldScanNodes.has(edge.from) && !oldScanNodes.has(edge.to)),
    ...scanActions.slice(1).map((action, index) => ({ from: `${scanActions[index].id}-node`, to: `${action.id}-node`, label: "Next", condition: { type: "validationPassed" } })),
  ];
  brass.process.startNodeId = `${scanActions[0].id}-node`;

  const exactSampleTube = (sample) => sample === "unknown" ? "unknown-sample-tube" : `standard-${sample}-tube`;
  for (const action of brass.actions) {
    delete action.effect;
    if (action.id === "place-brass-in-beaker-action") {
      delete action.parameters.massG;
      action.parameters.sourceInstanceId = "brass-sample-vial";
      action.parameters.targetInstanceId = "brass-beaker";
    }
    if (/^(?:tare-empty-beaker|weigh-brass)-action$/.test(action.id)) {
      action.parameters.sourceInstanceId = "brass-beaker";
      action.parameters.targetInstanceId = "balance";
      action.parameters.instrumentInstanceId = "balance";
    }
    if (action.id === "transfer-digest-action") Object.assign(action.parameters, { sourceInstanceId: "brass-beaker", targetInstanceId: "unknown-volumetric-flask" });
    if (/^rinse-beaker-\d+-action$/.test(action.id)) Object.assign(action.parameters, { sourceInstanceId: "wash-bottle", targetInstanceId: "brass-beaker" });
    if (/^transfer-rinse-\d+-action$/.test(action.id)) Object.assign(action.parameters, { sourceInstanceId: "brass-beaker", targetInstanceId: "unknown-volumetric-flask" });
    if (action.id === "dilute-unknown-to-mark-action") Object.assign(action.parameters, { sourceInstanceId: "wash-bottle", targetInstanceId: "unknown-volumetric-flask" });
    const standardPrep = action.id.match(/^standard-(0p\d+)-(stock-transfer|dilute)-action$/);
    if (standardPrep) Object.assign(action.parameters, { sourceInstanceId: standardPrep[2] === "stock-transfer" ? "copper-standard-stock" : "wash-bottle", targetInstanceId: `standard-${standardPrep[1]}-tube` });
    const sample = action.id.match(/^(?:condition|fill|prepare|insert|read|record|remove|return)-(0p\d+|unknown)/)?.[1];
    if (sample) {
      const tubeId = exactSampleTube(sample);
      action.parameters.sampleIdentity = sample;
      if (/^(?:condition|fill)-/.test(action.id)) Object.assign(action.parameters, { sourceInstanceId: tubeId, targetInstanceId: "measurement-cuvette", cuvetteInstanceId: "measurement-cuvette" });
      if (/^prepare-/.test(action.id)) action.parameters.cuvetteInstanceId = "measurement-cuvette";
      if (/^insert-/.test(action.id)) Object.assign(action.parameters, { equipmentInstanceId: "measurement-cuvette", targetInstanceId: "spectrophotometer" });
      if (/^read-/.test(action.id)) Object.assign(action.parameters, { photometerInstanceId: "spectrophotometer", cuvetteInstanceId: "measurement-cuvette" });
      if (/^remove-/.test(action.id)) action.parameters.equipmentInstanceId = "measurement-cuvette";
      if (/^return-/.test(action.id)) Object.assign(action.parameters, { sourceInstanceId: "measurement-cuvette", targetInstanceId: tubeId });
    }
  }
  const blank = brass.actions.find((action) => action.id === "prepare-blank-action");
  if (blank) {
    delete blank.parameters.volumeMl;
    blank.parameters.fillRule = "three-quarters-full";
    blank.parameters.sourceInstanceId = "wash-bottle";
    blank.parameters.targetInstanceId = "measurement-cuvette";
    if (blank.interaction) delete blank.interaction.valueParameter;
  }

  const sanitize = (value, parentKey = "") => {
    if (Array.isArray(value)) return value.forEach((item) => sanitize(item, parentKey));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string") {
        value[key] = child
          .replace(/This simulator profile uses 620 nm as an explicit teacher-configured choice, not a manual-stated value\./gi, "The teacher-approved wavelength must be derived from the recorded prelab spectra and range criterion.")
          .replace(/with all five measured standards:[^.]+\./gi, "with all five source-stated standard concentrations and their learner-measured absorbances.")
          .replace(/Acquire the named sample reading from the configured instrument state\.(?:060|117|224|449|882|358) AU for .*? at 620 nm\./gi, "Acquire the named sample reading from the teacher-approved instrument state; do not preload a result.")
          .replace(/The instrument was blanked to 100%T at the configured 620 nm wavelength\./gi, "The instrument was blanked to 100%T at the teacher-approved wavelength.");
      } else sanitize(child, key);
    }
  };
  sanitize(brass);
  sanitize(brassLab);
  brass.composition = compositionFor(brass, "brass-colorimetry");
  for (const role of brass.composition.equipmentRoles) role.required = true;
  brass.composition.configurationSlots = [
    { id: "wavelengthMeasurementId", valueType: "string", required: true },
    { id: "measurementCuvetteInstanceId", valueType: "string", required: true },
  ];
  const scanExitNodeId = `${scanActions.at(-1).id}-node`;
  if (!brass.composition.ports.some((port) => port.id === `exit-${scanExitNodeId}`)) brass.composition.ports.push({ id: `exit-${scanExitNodeId}`, kind: "exit", nodeId: scanExitNodeId, label: "Scan exit" });
  brass.composition.completion.exitPortIds = [...new Set(brass.composition.ports.filter((port) => port.kind === "exit").map((port) => port.id))];
  const brassInstance = brassLab.techniqueInstances.find((instance) => instance.techniqueId === brass.id);
  if (brassInstance) {
    for (const action of scanActions) {
      brassInstance.preserveIds.actions[action.id] = action.id;
      brassInstance.preserveIds.nodes[`${action.id}-node`] = `${action.id}-node`;
    }
    const actionIds = new Set(brass.actions.map((action) => action.id));
    const nodeIds = new Set(brass.process.nodes.map((node) => node.id));
    brassInstance.preserveIds.actions = Object.fromEntries(Object.entries(brassInstance.preserveIds.actions).filter(([id]) => actionIds.has(id)));
    brassInstance.preserveIds.nodes = Object.fromEntries(Object.entries(brassInstance.preserveIds.nodes).filter(([id]) => nodeIds.has(id)));
  }
  const scanIncoming = brassLab.compositionConnections.find((row) => row.to.kind === "technique-port" && /entry-scan-/.test(row.to.portId));
  if (scanIncoming) scanIncoming.to.portId = `entry-${scanActions[0].id}-node`;
  const scanOutgoing = brassLab.compositionConnections.find((row) => row.from.kind === "technique-port" && /exit-scan-/.test(row.from.portId));
  if (scanOutgoing) scanOutgoing.from.portId = `exit-${scanExitNodeId}`;
  await writeJson("public/techniques/brass-spectrophotometry.json", brass);
  await writeJson("public/labs/brass-colorimetry.json", brassLab);
};

const fourthMediumRepair = async () => {
  const emptyContents = (label = "empty") => ({
    kind: "empty", label, solutes: [], contamination: [], wetState: "dry", visualState: "empty",
  });
  const emptyDestinationHolders = (definition) => {
    const destinationIds = new Set([
      "i1-blank-cuvette", "i1-unknown-cuvette", "measurement-cuvette", "unknown-sample-tube",
      "unknown-volumetric-flask", "i1-prepared-unknown-tube", "i1-diluted-unknown-tube",
      "standard-0p400-tube", "standard-0p200-tube", "standard-0p100-tube",
      "standard-0p0500-tube", "standard-0p0250-tube",
    ]);
    for (const item of definition.initialState?.equipment ?? []) {
      if (destinationIds.has(item.id) || item.definitionId === "cuvette") item.contents = emptyContents();
    }
  };

  const blueTechnique = await readJson("public/techniques/blue1-percent-transmittance.json");
  const blueLab = await readJson("public/labs/blue1-spectroscopy.json");
  emptyDestinationHolders(blueTechnique);
  emptyDestinationHolders(blueLab);
  const rangeDecision = makeAction({
    id: "i1-classify-unknown-range",
    label: "Classify the recorded unknown reading against the approved instrument range",
    parameters: {
      calculationId: "i1-unknown-range-classification",
      measurementId: "i1-unknown-percent-t",
      approvedRangeMeasurementId: "{{config.approvedInstrumentRangeMeasurementId}}",
      resultEncoding: "0 means in range; 1 means over range",
    },
    prerequisites: [{ id: "unknown-range-needs-reading", type: "measurementRecorded", label: "The unknown reading is recorded", measurementId: "i1-unknown-percent-t" }],
  });
  rangeDecision.verb = "calculate";
  rangeDecision.interaction = { type: "submitCalculation", valueParameter: "calculationId", accessibleLabel: rangeDecision.label };
  const inRangeExit = makeAction({
    id: "i1-confirm-in-range-reading",
    label: "Record that the original unknown reading is usable without dilution",
    parameters: { tag: "i1-original-unknown-reading-usable", measurementId: "i1-unknown-percent-t" },
    prerequisites: [{ id: "in-range-classification-required", type: "actionEvidence", label: "The approved range classification is submitted", actionId: "i1-classify-unknown-range" }],
  });
  for (const action of [rangeDecision, inRangeExit]) {
    blueTechnique.actions = blueTechnique.actions.filter((candidate) => candidate.id !== action.id);
    blueTechnique.actions.push(action);
    blueTechnique.process.nodes = blueTechnique.process.nodes.filter((node) => node.actionId !== action.id);
    blueTechnique.process.nodes.push(makeNode(action, action.id === rangeDecision.id ? "calculation" : "action"));
  }
  const branchNodeIds = new Set([
    "i1-remove-unknown-cuvette-node", `${rangeDecision.id}-node`, `${inRangeExit.id}-node`,
  ]);
  blueTechnique.process.edges = blueTechnique.process.edges.filter((edge) =>
    !(branchNodeIds.has(edge.from) || branchNodeIds.has(edge.to)) ||
    (edge.from === "i1-record-unknown-percent-t-node" && edge.to === "i1-remove-unknown-cuvette-node"));
  blueTechnique.process.edges.push(
    { from: "i1-remove-unknown-cuvette-node", to: `${rangeDecision.id}-node`, label: "Evaluate the approved range", condition: { type: "validationPassed" } },
    { from: `${rangeDecision.id}-node`, to: `${inRangeExit.id}-node`, label: "Reading is in range; no dilution", condition: { type: "calculationResult", calculationId: "i1-unknown-range-classification", min: 0, max: 0 } },
    { from: `${rangeDecision.id}-node`, to: "i1-measure-over-range-unknown-aliquot-node", label: "Reading is over range; execute the approved dilution", condition: { type: "calculationResult", calculationId: "i1-unknown-range-classification", min: 1, max: 1 } },
    { from: `${rangeDecision.id}-node`, to: `${rangeDecision.id}-node`, label: "Retry the range classification", condition: { type: "retry", maxAttempts: 2 } },
  );
  blueTechnique.composition = compositionFor(blueTechnique);
  for (const row of blueTechnique.composition.legacyActionEffects) {
    if (row.actionId === rangeDecision.id) row.effect = { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] };
    if (row.actionId === inRangeExit.id) row.effect = { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] };
  }
  for (const role of blueTechnique.composition.equipmentRoles) role.required = true;
  blueTechnique.composition.configurationSlots = [
    { id: "approvedUnknownAliquotMeasurementId", valueType: "string", required: true },
    { id: "approvedOverRangeFinalVolumeMeasurementId", valueType: "string", required: true },
    { id: "approvedInstrumentRangeMeasurementId", valueType: "string", required: true },
  ];
  for (const port of [
    { id: `exit-${inRangeExit.id}-node`, kind: "exit", nodeId: `${inRangeExit.id}-node`, label: "In-range unknown exit" },
    { id: "exit-i1-remove-diluted-unknown-cuvette-node", kind: "exit", nodeId: "i1-remove-diluted-unknown-cuvette-node", label: "Diluted unknown exit" },
  ]) if (!blueTechnique.composition.ports.some((existing) => existing.id === port.id)) blueTechnique.composition.ports.push(port);
  blueTechnique.composition.completion.exitPortIds = blueTechnique.composition.ports.filter((port) => port.kind === "exit").map((port) => port.id);
  const blueInstance = blueLab.techniqueInstances.find((instance) => instance.techniqueId === blueTechnique.id);
  blueInstance.bindings.configuration.approvedInstrumentRangeMeasurementId = "i1-approved-instrument-range";
  for (const action of [rangeDecision, inRangeExit]) {
    blueInstance.preserveIds.actions[action.id] = action.id;
    blueInstance.preserveIds.nodes[`${action.id}-node`] = `${action.id}-node`;
  }
  const oldBlueExit = blueLab.compositionConnections.find((row) => row.id === "blue1-cross-unknown-exit");
  if (oldBlueExit) blueLab.compositionConnections = blueLab.compositionConnections.filter((row) => row.id !== oldBlueExit.id);
  for (const [suffix, portId] of [["in-range", `exit-${inRangeExit.id}-node`], ["diluted", "exit-i1-remove-diluted-unknown-cuvette-node"]]) {
    const id = `blue1-cross-unknown-exit-${suffix}`;
    if (!blueLab.compositionConnections.some((row) => row.id === id)) blueLab.compositionConnections.push({
      id,
      from: { kind: "technique-port", instanceId: blueTechnique.id, portId },
      to: { kind: "lab-node", nodeId: "i1-record-unknown-reading-set-node" },
      label: "Analyze the usable unknown evidence",
      condition: { type: "validationPassed" },
    });
  }

  const brass = await readJson("public/techniques/brass-spectrophotometry.json");
  const brassLab = await readJson("public/labs/brass-colorimetry.json");
  emptyDestinationHolders(brass);
  emptyDestinationHolders(brassLab);
  const preparedUnknownTransfer = makeAction({
    id: "transfer-prepared-unknown-to-original-tube-action",
    label: "Transfer a measured portion of the prepared brass unknown to its original sample tube",
    atomId: "atom.transfer.measured-liquid",
    bindings: { "measured-solvent-source": "volumetric-flask", "receiving-vessel": "test-tube" },
    parameters: {
      sourceInstanceId: "unknown-volumetric-flask",
      targetInstanceId: "unknown-sample-tube",
      volumeProvenance: "source-faithful measured portion; no aliquot volume is authored",
    },
  });
  brass.actions = brass.actions.filter((action) => action.id !== preparedUnknownTransfer.id);
  brass.actions.push(preparedUnknownTransfer);
  brass.process.nodes = brass.process.nodes.filter((node) => node.actionId !== preparedUnknownTransfer.id);
  brass.process.nodes.push(makeNode(preparedUnknownTransfer));
  brass.process.edges = brass.process.edges.filter((edge) =>
    edge.from !== `${preparedUnknownTransfer.id}-node` && edge.to !== `${preparedUnknownTransfer.id}-node` &&
    !(edge.from === "return-0p400" && edge.to === "condition-unknown"));
  brass.process.edges.push(
    { from: "return-0p400", to: `${preparedUnknownTransfer.id}-node`, label: "Prepare the original unknown tube", condition: { type: "validationPassed" } },
    { from: `${preparedUnknownTransfer.id}-node`, to: "condition-unknown", label: "Condition from the prepared unknown", condition: { type: "validationPassed" } },
  );

  for (const action of brass.actions) {
    const standardMatch = action.id.match(/^standard-(0p(?:200|100|0500|0250))-(stock-transfer|dilute)-action$/);
    if (standardMatch) {
      const [, sample, operation] = standardMatch;
      delete action.parameters.volumeMl;
      delete action.parameters.configurationChoice;
      if (operation === "stock-transfer") {
        action.parameters.volumeMeasurementId = `standard-${sample}-aliquot-ml`;
        action.parameters.calculationEvidenceId = `standard-${sample}-aliquot-ml`;
        action.label = `Transfer the learner-calculated stock aliquot for the ${sample.replace("p", ".")} M standard`;
      } else {
        action.parameters.finalVolumeMeasurementId = "{{config.approvedStandardFinalVolumeMeasurementId}}";
        action.label = `Dilute the ${sample.replace("p", ".")} M standard to the source-stated final-volume endpoint`;
      }
    }
    if (action.id === "dilute-unknown-to-mark-action") {
      delete action.parameters.volumeMl;
      delete action.parameters.finalVolumeMl;
      action.parameters.finalVolumeMeasurementId = "{{config.approvedUnknownFinalVolumeMeasurementId}}";
      action.label = "Dilute the brass unknown to the source-stated approved final-volume endpoint";
    }
    if (action.id === "blank-wipe-orient-action") {
      action.parameters.note = "The filled blank cuvette has clean, dry optical faces and the approved orientation; instrument placement remains a separate later atom.";
    }
    if (/^condition-(?:0p\d+|unknown)-action$/.test(action.id)) {
      action.parameters.note = "Condition the empty cuvette twice with approximately 1 mL of the named next sample; this atom does not fill, wipe, orient, or insert the holder.";
    }
  }

  const oldScanActionIds = new Set(brass.actions.filter((action) => /^scan-/.test(action.id)).map((action) => action.id));
  const oldScanNodeIds = new Set(brass.process.nodes.filter((node) => oldScanActionIds.has(node.actionId)).map((node) => node.id));
  const scanActions = [];
  for (let wavelength = 400; wavelength <= 700; wavelength += 20) {
    const wavelengthMeasurementId = `scan-${wavelength}-wavelength-nm`;
    const readinessTag = `scan-${wavelength}-configured`;
    const scanStep = ((wavelength - 400) / 20) + 1;
    scanActions.push(makeAction({
      id: `scan-set-${wavelength}-action`, label: `Set source-stated scan wavelength step ${scanStep}`,
      atomId: "atom.observe.configure-photometer", bindings: { "photometer-instrument": "spectrophotometer" },
      parameters: { photometerInstanceId: "spectrophotometer", measurementId: wavelengthMeasurementId, configurationQuantity: "scan wavelength", configurationValue: wavelength, unit: "nm", photometricMode: "absorbance", tag: readinessTag },
    }));
    for (const salt of ["a", "b"]) {
      const sampleIdentity = `assigned-salt-${salt}`;
      const sourceInstanceId = `${sampleIdentity}-solution`;
      const measurementId = `scan-${wavelength}-salt-${salt}-absorbance`;
      scanActions.push(
        makeAction({ id: `scan-condition-${wavelength}-salt-${salt}-action`, label: `Condition the empty cuvette with assigned salt ${salt.toUpperCase()} for scan step ${scanStep}`, atomId: "atom.rinse.condition-cuvette-with-sample", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId, targetInstanceId: "measurement-cuvette", cuvetteInstanceId: "measurement-cuvette", sampleIdentity, rinseRule: "provenance-matched next sample; conditioning does not fill" } }),
        makeAction({ id: `scan-fill-${wavelength}-salt-${salt}-action`, label: `Fill the cuvette from assigned salt ${salt.toUpperCase()}`, atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId, targetInstanceId: "measurement-cuvette", sampleIdentity } }),
        makeAction({ id: `scan-prepare-${wavelength}-salt-${salt}-optical-faces-action`, label: `Wipe and orient the filled assigned salt ${salt.toUpperCase()} cuvette`, atomId: "atom.rinse.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: "measurement-cuvette", sampleIdentity } }),
        makeAction({ id: `scan-insert-${wavelength}-salt-${salt}-action`, label: `Insert assigned salt ${salt.toUpperCase()} for scan step ${scanStep}`, atomId: "atom.place.insert-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: "measurement-cuvette", targetInstanceId: "spectrophotometer", sampleIdentity } }),
        makeAction({ id: `scan-read-${wavelength}-${salt === "a" ? "action" : "salt-b-action"}`, label: `Read assigned salt ${salt.toUpperCase()} at scan step ${scanStep}`, atomId: "atom.observe.read-photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { photometerInstanceId: "spectrophotometer", cuvetteInstanceId: "measurement-cuvette", wavelengthMeasurementId, measurementId, sampleIdentity, photometricQuantity: "absorbance", unit: "absorbance", photometerOperation: "read", requiresZeroNotebookTag: readinessTag } }),
        makeAction({ id: `scan-record-${wavelength}-${salt === "a" ? "action" : "salt-b-action"}`, label: `Record assigned salt ${salt.toUpperCase()} at scan step ${scanStep}`, atomId: "atom.record.photometer-reading", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { measurementId, sampleIdentity, unit: "absorbance" }, prerequisites: [{ id: `scan-${wavelength}-salt-${salt}-read-required`, type: "measurementRecorded", label: `Assigned salt ${salt.toUpperCase()} was read at this scan step`, measurementId }] }),
        makeAction({ id: `scan-remove-${wavelength}-salt-${salt}-action`, label: `Remove assigned salt ${salt.toUpperCase()} after scan step ${scanStep}`, atomId: "atom.place.remove-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: "measurement-cuvette", sampleIdentity } }),
        makeAction({ id: `scan-return-${wavelength}-salt-${salt}-action`, label: `Return assigned salt ${salt.toUpperCase()} to its source tube`, atomId: "atom.transfer.return-cuvette-to-origin", bindings: { "photometer-sample-holder": "cuvette", "provenance-matched-sample-receiver": "test-tube" }, parameters: { sourceInstanceId: "measurement-cuvette", targetInstanceId: sourceInstanceId, sampleIdentity } }),
      );
    }
  }
  brass.actions = [...brass.actions.filter((action) => !oldScanActionIds.has(action.id)), ...scanActions];
  brass.process.nodes = [...brass.process.nodes.filter((node) => !oldScanNodeIds.has(node.id)), ...scanActions.map((action) => makeNode(action))];
  brass.process.edges = [
    ...brass.process.edges.filter((edge) => !oldScanNodeIds.has(edge.from) && !oldScanNodeIds.has(edge.to)),
    ...scanActions.slice(1).map((action, index) => ({ from: `${scanActions[index].id}-node`, to: `${action.id}-node`, label: "Next", condition: { type: "validationPassed" } })),
  ];
  brass.process.startNodeId = `${scanActions[0].id}-node`;

  const scrubText = (value) => {
    if (Array.isArray(value)) return value.forEach(scrubText);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string") {
        value[key] = child
          .replace(/with all five source-stated standard concentrations and their learner-measured absorbances\.0250 M, 0\.060 AU\), \(0\.0500 M, 0\.117 AU\), \(0\.100 M, 0\.224 AU\), \(0\.200 M, 0\.449 AU\), and \(0\.400 M, 0\.882 AU\)\./gi, "with all five source-stated standard concentrations and their learner-measured absorbances.")
          .replace(/\(0\.0250\s*M,\s*0\.060\s*AU\).*?\(0\.400\s*M,\s*0\.882\s*AU\)\.?/gi, "the five learner-measured standard pairs")
          .replace(/Figure\s*2[^.]*\./gi, "The source figure is illustrative only; use learner-measured calibration evidence.")
          .replace(/configured teaching-profile reading:[^.]+\./gi, "Use the instrument reading acquired for the named sample.")
          .replace(/\b(?:0\.160\s*M|1\.250\s*g|81\.2%|80\.7%|3\.4%\s*Cu)\b/gi, "the learner-derived result");
      } else scrubText(child);
    }
  };
  scrubText(brass);
  scrubText(brassLab);
  brass.composition = compositionFor(brass, "brass-colorimetry");
  for (const role of brass.composition.equipmentRoles) role.required = true;
  brass.composition.configurationSlots = [
    { id: "wavelengthMeasurementId", valueType: "string", required: true },
    { id: "measurementCuvetteInstanceId", valueType: "string", required: true },
    { id: "approvedStandardFinalVolumeMeasurementId", valueType: "string", required: true },
    { id: "approvedUnknownFinalVolumeMeasurementId", valueType: "string", required: true },
  ];
  const scanExitNodeId = `${scanActions.at(-1).id}-node`;
  if (!brass.composition.ports.some((port) => port.id === `exit-${scanExitNodeId}`)) brass.composition.ports.push({ id: `exit-${scanExitNodeId}`, kind: "exit", nodeId: scanExitNodeId, label: "Scan exit" });
  brass.composition.completion.exitPortIds = brass.composition.ports.filter((port) => port.kind === "exit").map((port) => port.id);
  const brassInstance = brassLab.techniqueInstances.find((instance) => instance.techniqueId === brass.id);
  brassInstance.bindings.configuration.approvedStandardFinalVolumeMeasurementId = "approved-standard-final-volume";
  brassInstance.bindings.configuration.approvedUnknownFinalVolumeMeasurementId = "approved-unknown-final-volume";
  for (const action of [preparedUnknownTransfer, ...scanActions]) {
    brassInstance.preserveIds.actions[action.id] = action.id;
    brassInstance.preserveIds.nodes[`${action.id}-node`] = `${action.id}-node`;
  }
  const actionIds = new Set(brass.actions.map((action) => action.id));
  const nodeIds = new Set(brass.process.nodes.map((node) => node.id));
  brassInstance.preserveIds.actions = Object.fromEntries(Object.entries(brassInstance.preserveIds.actions).filter(([id]) => actionIds.has(id)));
  brassInstance.preserveIds.nodes = Object.fromEntries(Object.entries(brassInstance.preserveIds.nodes).filter(([id]) => nodeIds.has(id)));
  const scanIncoming = brassLab.compositionConnections.find((row) => row.to.kind === "technique-port" && /entry-scan-/.test(row.to.portId));
  if (scanIncoming) scanIncoming.to.portId = `entry-${scanActions[0].id}-node`;
  const scanOutgoing = brassLab.compositionConnections.find((row) => row.from.kind === "technique-port" && /exit-scan-/.test(row.from.portId));
  if (scanOutgoing) scanOutgoing.from.portId = `exit-${scanExitNodeId}`;
  await writeJson("public/techniques/blue1-percent-transmittance.json", blueTechnique);
  await writeJson("public/labs/blue1-spectroscopy.json", blueLab);
  await writeJson("public/techniques/brass-spectrophotometry.json", brass);
  await writeJson("public/labs/brass-colorimetry.json", brassLab);
};

const revisionFiveLaneReplay = async () => {
  const emptyContents = () => ({ kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" });
  const actionMap = (definition) => new Map(definition.actions.map((action) => [action.id, action]));
  const setAction = (definition, action) => {
    definition.actions = [...definition.actions.filter((candidate) => candidate.id !== action.id), action];
    definition.process.nodes = [...definition.process.nodes.filter((node) => node.actionId !== action.id), makeNode(action, action.verb === "calculate" ? "calculation" : "action")];
  };
  const removeAction = (definition, id) => {
    definition.actions = definition.actions.filter((action) => action.id !== id);
    definition.process.nodes = definition.process.nodes.filter((node) => node.actionId !== id);
    definition.process.edges = definition.process.edges.filter((edge) => edge.from !== `${id}-node` && edge.to !== `${id}-node`);
  };
  const linearEdges = (ids) => ids.slice(1).map((id, index) => ({
    from: `${ids[index]}-node`, to: `${id}-node`, label: "Next", condition: { type: "validationPassed" },
  }));
  const stripDecorativeVolume = (action) => {
    for (const key of ["volumeMl", "targetVolumeMl", "finalVolumeMl", "volumeMeasurementId", "calculationEvidenceId", "finalVolumeMeasurementId", "fillRule"])
      delete action.parameters[key];
  };
  const stripNumericInput = (action) => {
    for (const key of ["inputMode", "inputRole", "inputLabel", "inputMin", "inputMinExclusive", "inputMax", "inputStep", "requireStudentValue", "unit"])
      delete action.parameters[key];
  };
  const configuredMeasurement = ({ id, label, measurementId, quantity, unit, inputLabel, min = 0, max }) => {
    const action = makeAction({ id, label, parameters: {
      measurementId, configurationQuantity: quantity, inputMode: "numeric", inputRole: "teacherConfiguration",
      inputLabel, inputMin: min, inputMinExclusive: true, ...(max === undefined ? {} : { inputMax: max }), unit,
      configurationProvenance: "teacher-configured; the source supplies no analytical value",
    }});
    action.verb = "observe";
    return action;
  };

  // Generic spectroscopy techniques: all physical quantities use revision-4/5 typed contracts.
  for (const id of ["transmittance-dilution", "beers-law-calibration"]) {
    const technique = await readJson(`public/techniques/${id}.json`);
    const actions = actionMap(technique);
    for (const action of technique.actions) {
      if (action.verb === "measureVolume") {
        const outputMeasurementId = action.parameters.volumeMeasurementId ?? action.parameters.measurementId ?? `${action.id}-ml`;
        stripDecorativeVolume(action);
        action.parameters.inputMode = "numeric";
        action.parameters.inputRole = "teacherConfiguration";
        action.parameters.inputLabel = `${action.label} (mL)`;
        action.parameters.inputMin = 0;
        action.parameters.inputMinExclusive = true;
        action.parameters.unit = "mL";
        action.volume = { source: "action-input", outputMeasurementId };
      } else if (action.verb === "transfer") {
        const isFill = action.atomId === "atom.transfer.fill-cuvette" || action.atomId === "atom.transfer.prepare-photometric-blank";
        const referenceId = /stock|dye-aliquot/.test(action.id)
          ? (id === "transmittance-dilution" ? "{{config.stockVolumeMeasurementId}}" : "{{config.stockVolumeMeasurementId}}")
          : undefined;
        stripDecorativeVolume(action);
        action.volume = isFill ? { source: "target-fill-fraction", fraction: 0.75 }
          : referenceId ? { source: "measurement", referenceId }
            : { source: "action-input" };
        if (action.volume.source === "action-input") {
          action.parameters.inputMode = "numeric"; action.parameters.inputRole = "teacherConfiguration";
          action.parameters.inputLabel = `${action.label} (mL)`; action.parameters.inputMin = 0; action.parameters.inputMinExclusive = true; action.parameters.unit = "mL";
        }
      } else if (action.verb === "dilute") {
        stripDecorativeVolume(action);
        action.volume = { source: "action-input", outputMeasurementId: undefined };
        action.parameters.inputMode = "numeric"; action.parameters.inputRole = "teacherConfiguration";
        action.parameters.inputLabel = `${action.label}: final volume (mL)`; action.parameters.inputMin = 0; action.parameters.inputMinExclusive = true; action.parameters.unit = "mL";
      }
    }
    technique.metadata.version = "1.3.0";
    technique.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
    technique.composition = compositionFor(technique);
    for (const role of technique.composition.equipmentRoles) role.required = true;
    await writeJson(`public/techniques/${id}.json`, technique);
  }

  // Blue standard stock/standard preparation. The listed ratios are source-stated; the stock molarity is not.
  const blueDilutions = await readJson("public/techniques/blue1-standard-dilutions.json");
  const ratios = [["10-0", 10, 0], ["8-2", 8, 2], ["6-4", 6, 4], ["4-6", 4, 6], ["3-7", 3, 7], ["2-8", 2, 8], ["1-9", 1, 9], ["0-10", 0, 10]];
  const stockConfiguration = blueDilutions.actions.find((action) => action.id === "i1-record-stock-concentration");
  stockConfiguration.parameters.configuredValue = undefined;
  stockConfiguration.parameters.configurationQuantity = "Blue #1 stock concentration";
  for (const [slug, stockMl, waterMl] of ratios) {
    const measureStock = blueDilutions.actions.find((action) => action.id === `i1-r${slug}-measure-stock`);
    const transferStock = blueDilutions.actions.find((action) => action.id === `i1-r${slug}-transfer-stock`);
    const measureWater = blueDilutions.actions.find((action) => action.id === `i1-r${slug}-measure-water`);
    const transferWater = blueDilutions.actions.find((action) => action.id === `i1-r${slug}-transfer-water`);
    const calculate = blueDilutions.actions.find((action) => action.id === `i1-r${slug}-calculate-concentration`);
    if (measureStock) { stripDecorativeVolume(measureStock); delete measureStock.parameters.measurementId; measureStock.volume = { source: "literal", valueMl: stockMl, outputMeasurementId: `i1-r${slug}-stock-volume` }; }
    if (transferStock) { stripDecorativeVolume(transferStock); transferStock.volume = { source: "measurement", referenceId: `i1-r${slug}-stock-volume` }; delete transferStock.deliveryDevice; }
    if (measureWater) { stripDecorativeVolume(measureWater); delete measureWater.parameters.measurementId; measureWater.volume = { source: "literal", valueMl: waterMl, outputMeasurementId: `i1-r${slug}-water-volume` }; }
    if (transferWater) { stripDecorativeVolume(transferWater); transferWater.volume = { source: "measurement", referenceId: `i1-r${slug}-water-volume` }; delete transferWater.deliveryDevice; }
    if (calculate) {
      calculate.parameters.calculationId = `blue1-class-calibration--i1-r${slug}-concentration`;
      calculate.parameters.template = "dilutedConcentration";
      calculate.parameters.stockConcentrationMeasurementId = "i1-stock-concentration";
      if (stockMl > 0) { delete calculate.parameters.stockVolumeMl; calculate.parameters.stockVolumeMeasurementId = `i1-r${slug}-stock-volume`; }
      else calculate.parameters.stockVolumeMl = 0;
      calculate.parameters.finalVolumeMl = 10;
      calculate.parameters.unit = "M";
    }
  }
  blueDilutions.metadata.version = "1.3.0";
  blueDilutions.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  blueDilutions.composition = compositionFor(blueDilutions);
  for (const role of blueDilutions.composition.equipmentRoles) role.required = true;
  await writeJson("public/techniques/blue1-standard-dilutions.json", blueDilutions);

  // Blue optical workflow and the genuinely conditional unknown analysis.
  const bluePercent = await readJson("public/techniques/blue1-percent-transmittance.json");
  const blueLab = await readJson("public/labs/blue1-spectroscopy.json");
  const minimumRange = configuredMeasurement({ id: "i1-record-minimum-usable-percent-t", label: "Record the teacher-approved minimum usable percent transmittance", measurementId: "i1-approved-instrument-range", quantity: "minimum usable percent transmittance", unit: "%T", inputLabel: "Teacher-approved minimum usable %T", max: 100 });
  const unknownInventory = makeAction({ id: "i1-configure-unknown-operational-inventory", label: "Configure the finite operational sports-drink inventory", parameters: { sourceDefinitionId: "sample-bottle", sourceInstanceId: "i1-unknown-sample", inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: "Operational sports-drink volume available (mL)", inputMin: 0, inputMinExclusive: true, unit: "mL" } });
  unknownInventory.verb = "observe"; unknownInventory.sourceInventory = { sourceInstanceId: "i1-unknown-sample", sourceDefinitionId: "sample-bottle", outputMeasurementId: "i1-unknown-operational-inventory-ml" };
  const dilutionWaterInventory = makeAction({ id: "i1-configure-unknown-dilution-water", label: "Configure the finite approved dilution-water inventory", parameters: { sourceDefinitionId: "distilled-water-bottle", sourceInstanceId: "i1-unknown-dilution-water", inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: "Approved dilution water available (mL)", inputMin: 0, inputMinExclusive: true, unit: "mL" } });
  dilutionWaterInventory.verb = "observe"; dilutionWaterInventory.equipmentRoleBindings = { "liquid-source": "distilled-water-bottle" }; dilutionWaterInventory.sourceInventory = { sourceInstanceId: "i1-unknown-dilution-water", sourceDefinitionId: "distilled-water-bottle", outputMeasurementId: "i1-unknown-dilution-water-inventory-ml" };
  const fillBlank = makeAction({ id: "i1-fill-blank-cuvette", label: "Fill the approved blank cuvette from the water standard", atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: "i1-r0-10-tube", targetInstanceId: "i1-blank-cuvette", sampleIdentity: "approved-water-blank" } });
  fillBlank.volume = { source: "target-fill-fraction", fraction: 0.75 }; stripNumericInput(fillBlank);
  for (const action of [minimumRange, unknownInventory, dilutionWaterInventory, fillBlank]) setAction(bluePercent, action);
  if (!bluePercent.initialState.equipment.some((item) => item.id === "i1-unknown-dilution-water")) bluePercent.initialState.equipment.push({ id: "i1-unknown-dilution-water", definitionId: "distilled-water-bottle", label: "Teacher-approved unknown dilution water", location: "shelf", contents: { kind: "liquid", label: "distilled water", solutes: [], contamination: [], wetState: "wet", visualState: "clear-liquid" } });
  for (const item of bluePercent.initialState.equipment) if (item.id === "i1-unknown-sample") item.contents.volumeMl = undefined;
  for (const [slug] of ratios) {
    const fill = bluePercent.actions.find((action) => action.id === `i1-r${slug}-fill-cuvette`);
    if (fill) { stripDecorativeVolume(fill); stripNumericInput(fill); fill.volume = { source: "target-fill-fraction", fraction: 0.75 }; }
  }
  const configure = bluePercent.actions.find((action) => action.id === "i1-record-wavelength");
  configure.parameters.configuredValue = undefined;
  const zero = bluePercent.actions.find((action) => action.id === "i1-zero-instrument");
  zero.parameters.photometerOperation = "zero";
  zero.parameters.requiresDarkZeroNotebookTag = undefined;
  const firstMeasure = bluePercent.actions.find((action) => action.id === "i1-prepare-unknown-under-approved-plan");
  stripDecorativeVolume(firstMeasure); firstMeasure.volume = { source: "action-input", outputMeasurementId: "i1-approved-unknown-aliquot" };
  Object.assign(firstMeasure.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: "Approved initial unknown aliquot (mL)", inputMin: 0, inputMinExclusive: true, unit: "mL" });
  const firstTransfer = bluePercent.actions.find((action) => action.id === "i1-transfer-approved-unknown-aliquot");
  stripDecorativeVolume(firstTransfer); firstTransfer.volume = { source: "measurement", referenceId: "i1-approved-unknown-aliquot" }; delete firstTransfer.deliveryDevice;
  const firstFill = bluePercent.actions.find((action) => action.id === "i1-fill-unknown-cuvette"); stripDecorativeVolume(firstFill); stripNumericInput(firstFill); firstFill.volume = { source: "target-fill-fraction", fraction: 0.75 };
  const range = bluePercent.actions.find((action) => action.id === "i1-classify-unknown-range");
  range.parameters = { calculationId: "i1-unknown-range-classification", template: "classifyMeasurementAgainstBound", measurementId: "i1-unknown-percent-t", boundMeasurementId: "i1-approved-instrument-range", comparison: "below", unit: "flag" };
  const minimumRangeIndex = bluePercent.actions.findIndex((action) => action.id === minimumRange.id);
  const rangeIndex = bluePercent.actions.findIndex((action) => action.id === range.id);
  if (minimumRangeIndex > rangeIndex) bluePercent.actions.splice(rangeIndex, 0, ...bluePercent.actions.splice(minimumRangeIndex, 1));
  const secondMeasure = bluePercent.actions.find((action) => action.id === "i1-measure-over-range-unknown-aliquot"); stripDecorativeVolume(secondMeasure); secondMeasure.volume = { source: "action-input", outputMeasurementId: "i1-approved-over-range-aliquot-ml" }; Object.assign(secondMeasure.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: "Teacher-approved over-range aliquot (mL)", inputMin: 0, inputMinExclusive: true, unit: "mL" });
  const secondTransfer = makeAction({ id: "i1-transfer-over-range-unknown-aliquot", label: "Transfer the measured over-range aliquot into the dilution tube", atomId: "atom.transfer.measured-liquid", bindings: { "measured-solvent-source": "graduated-pipette-10ml", "receiving-vessel": "test-tube" }, parameters: { sourceInstanceId: "i1-unknown-measuring-device", targetInstanceId: "i1-diluted-unknown-tube" } });
  secondTransfer.volume = { source: "measurement", referenceId: "i1-approved-over-range-aliquot-ml" };
  setAction(bluePercent, secondTransfer);
  const dilute = bluePercent.actions.find((action) => action.id === "i1-record-over-range-response"); stripDecorativeVolume(dilute); dilute.parameters.sourceDefinitionId = "distilled-water-bottle"; dilute.parameters.sourceInstanceId = "i1-unknown-dilution-water"; dilute.parameters.targetDefinitionId = "test-tube"; dilute.parameters.targetInstanceId = "i1-diluted-unknown-tube"; Object.assign(dilute.parameters, { inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: "Teacher-approved diluted final volume (mL)", inputMin: 0, inputMinExclusive: true, unit: "mL" }); dilute.volume = { source: "action-input", outputMeasurementId: undefined }; dilute.dilutionFactorOutputId = "i1-unknown-dilution-factor";
  const dilutedFill = bluePercent.actions.find((action) => action.id === "i1-fill-diluted-unknown-cuvette"); stripDecorativeVolume(dilutedFill); stripNumericInput(dilutedFill); dilutedFill.volume = { source: "target-fill-fraction", fraction: 0.75 };
  const rawAbs = makeAction({ id: "i1-calculate-raw-unknown-absorbance", label: "Derive absorbance from the recorded raw unknown percent transmittance", parameters: { calculationId: "i1-raw-unknown-absorbance", template: "absorbanceFromPercentT", percentTransmittanceMeasurementId: "i1-unknown-percent-t", unit: "absorbance" } }); rawAbs.verb = "calculate"; rawAbs.interaction = { type: "submitCalculation", accessibleLabel: rawAbs.label };
  const directConc = makeAction({ id: "i1-derive-direct-original-concentration", label: "Derive the original concentration from the raw reading and accepted calibration", parameters: {} }); directConc.verb = "calculate"; directConc.analysis = { type: "concentrationFromRegression", response: { source: "calculation", referenceId: "i1-raw-unknown-absorbance" }, regressionCalculationId: "{{config.calibrationRegressionCalculationId}}", outputUnit: "M", outputCalculationId: "i1-direct-original-blue1-molarity" }; directConc.interaction = { type: "submitCalculation", accessibleLabel: directConc.label };
  const dilutedAbs = makeAction({ id: "i1-calculate-diluted-unknown-absorbance", label: "Derive absorbance from the diluted unknown percent transmittance", parameters: { calculationId: "i1-diluted-unknown-absorbance", template: "absorbanceFromPercentT", percentTransmittanceMeasurementId: "i1-diluted-unknown-percent-t", unit: "absorbance" } }); dilutedAbs.verb = "calculate"; dilutedAbs.interaction = { type: "submitCalculation", accessibleLabel: dilutedAbs.label };
  const dilutedConc = makeAction({ id: "i1-derive-diluted-concentration", label: "Derive the diluted unknown concentration from the accepted calibration", parameters: {} }); dilutedConc.verb = "calculate"; dilutedConc.analysis = { type: "concentrationFromRegression", response: { source: "calculation", referenceId: "i1-diluted-unknown-absorbance" }, regressionCalculationId: "{{config.calibrationRegressionCalculationId}}", outputUnit: "M", outputCalculationId: "i1-diluted-unknown-concentration" }; dilutedConc.interaction = { type: "submitCalculation", accessibleLabel: dilutedConc.label };
  const backCalc = makeAction({ id: "i1-back-calculate-original-concentration", label: "Back-calculate the original concentration from the approved dilution", parameters: { calculationId: "i1-diluted-original-blue1-molarity", template: "backCalculateConcentrationFromDilution", dilutedConcentrationCalculationId: "i1-diluted-unknown-concentration", dilutionFactorCalculationId: "i1-unknown-dilution-factor", unit: "M" } }); backCalc.verb = "calculate"; backCalc.interaction = { type: "submitCalculation", accessibleLabel: backCalc.label };
  for (const action of [rawAbs, directConc, dilutedAbs, dilutedConc, backCalc]) { action.interaction.valueParameter = "calculationId"; setAction(bluePercent, action); }
  removeAction(bluePercent, "i1-confirm-in-range-reading");
  const standardIds = ["i1-record-wavelength", "i1-record-blank-cuvette-rule", "i1-record-minimum-usable-percent-t", "i1-place-spectrophotometer", "i1-fill-blank-cuvette", "i1-insert-blank-cuvette", "i1-zero-instrument", "i1-remove-blank-cuvette"];
  for (const [slug] of ratios) standardIds.push(`i1-r${slug}-fill-cuvette`, `i1-r${slug}-condition-orient-cuvette`, `i1-r${slug}-insert-cuvette`, `i1-r${slug}-read-percent-t`, `i1-r${slug}-record-percent-t`, `i1-r${slug}-remove-cuvette`);
  const unknownPrefix = ["i1-configure-unknown-operational-inventory", "i1-configure-unknown-dilution-water", "i1-prepare-unknown-under-approved-plan", "i1-transfer-approved-unknown-aliquot", "i1-fill-unknown-cuvette", "i1-prepare-unknown-optical-faces", "i1-insert-unknown-cuvette", "i1-read-unknown-percent-t", "i1-record-unknown-percent-t", "i1-remove-unknown-cuvette", "i1-classify-unknown-range"];
  const dilutedPath = ["i1-measure-over-range-unknown-aliquot", "i1-transfer-over-range-unknown-aliquot", "i1-record-over-range-response", "i1-fill-diluted-unknown-cuvette", "i1-prepare-diluted-unknown-optical-faces", "i1-insert-diluted-unknown-cuvette", "i1-read-diluted-unknown-percent-t", "i1-record-diluted-unknown-percent-t", "i1-remove-diluted-unknown-cuvette", "i1-calculate-diluted-unknown-absorbance", "i1-derive-diluted-concentration", "i1-back-calculate-original-concentration"];
  bluePercent.process.edges = [...linearEdges(standardIds), ...linearEdges(unknownPrefix), ...linearEdges(dilutedPath),
    { from: "i1-classify-unknown-range-node", to: "i1-calculate-raw-unknown-absorbance-node", label: "Raw reading is usable", condition: { type: "calculationResult", calculationId: "i1-unknown-range-classification", min: 0, max: 0 } },
    { from: "i1-calculate-raw-unknown-absorbance-node", to: "i1-derive-direct-original-concentration-node", label: "Use accepted calibration", condition: { type: "validationPassed" } },
    { from: "i1-classify-unknown-range-node", to: "i1-measure-over-range-unknown-aliquot-node", label: "Dilution required", condition: { type: "calculationResult", calculationId: "i1-unknown-range-classification", min: 1, max: 1 } },
    { from: "i1-classify-unknown-range-node", to: "i1-classify-unknown-range-node", label: "Retry", condition: { type: "retry", maxAttempts: 2 } },
  ];
  bluePercent.process.startNodeId = `${standardIds[0]}-node`;
  bluePercent.metadata.version = "1.3.0"; bluePercent.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  bluePercent.requiredEquipment = [...new Set([...(bluePercent.requiredEquipment ?? []), "distilled-water-bottle"])];
  bluePercent.composition = compositionFor(bluePercent);
  for (const role of bluePercent.composition.equipmentRoles) role.required = true;
  bluePercent.composition.configurationSlots = [{ id: "calibrationRegressionCalculationId", valueType: "string", required: true }];
  await writeJson("public/techniques/blue1-percent-transmittance.json", bluePercent);

  const blueCalibration = await readJson("public/techniques/blue1-class-calibration.json");
  const calibrationActions = actionMap(blueCalibration);
  for (const [slug] of ratios) {
    const absorbance = calibrationActions.get(`i1-r${slug}-calculate-absorbance`);
    absorbance.analysis = { type: "unaryEvidenceTransform", input: { source: "calculation", referenceId: `i1-r${slug}-decimal-t` }, operation: "negativeLog10", outputUnit: "absorbance", outputCalculationId: `i1-r${slug}-absorbance` };
    absorbance.parameters = {};
  }
  const calibrationChoice = calibrationActions.get("i1-record-source-ambiguity");
  calibrationChoice.choiceObservation = { outputCalculationId: "i1-calibration-transformation-choice", options: [
    { label: "Teacher confirms -log10(decimal T) for this calibration", tag: "negative-log10-confirmed", value: 1 },
    { label: "Teacher requires revision before calibration", tag: "revision-required", value: 0 },
  ] };
  calibrationChoice.parameters.inputMode = "choice"; calibrationChoice.parameters.inputRole = "teacherConfiguration";
  const regressionAction = calibrationActions.get("i1-record-confirmed-calibration");
  regressionAction.verb = "calculate"; regressionAction.parameters = {};
  regressionAction.analysis = { type: "mixedEvidenceRegression", pairs: ratios.filter(([, stock]) => stock > 0).map(([slug]) => ({ x: { source: "calculation", referenceId: `{{config.i1-r${slug}-concentrationCalculationId}}` }, y: { source: "calculation", referenceId: `i1-r${slug}-absorbance` } })), xUnit: "M", yUnit: "absorbance", outputCalculationId: "blue1-percent-transmittance--i1-confirmed-calibration-regression" };
  regressionAction.interaction = { type: "submitCalculation", valueParameter: "calculationId", accessibleLabel: regressionAction.label };
  regressionAction.prerequisites = [{ id: "teacher-transform-confirmed", type: "actionEvidence", label: "Teacher reviewed the calibration transformation", actionId: "i1-record-source-ambiguity" }];
  const choiceEdge = blueCalibration.process.edges.find((edge) => edge.from === "i1-record-source-ambiguity-node" && edge.to === "i1-record-confirmed-calibration-node");
  choiceEdge.condition = { type: "calculationResult", calculationId: "i1-calibration-transformation-choice", min: 1, max: 1 };
  blueCalibration.process.edges = blueCalibration.process.edges.filter((edge) => !(edge.from === "i1-record-source-ambiguity-node" && edge.to === "i1-record-source-ambiguity-node"));
  blueCalibration.process.edges.push({ from: "i1-record-source-ambiguity-node", to: "i1-record-source-ambiguity-node", label: "Revise with teacher", condition: { type: "retry", maxAttempts: 2 } });
  blueCalibration.metadata.version = "1.3.0"; blueCalibration.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  blueCalibration.composition = compositionFor(blueCalibration);
  blueCalibration.composition.configurationSlots = ratios.filter(([, stock]) => stock > 0).map(([slug]) => ({ id: `i1-r${slug}-concentrationCalculationId`, valueType: "string", required: true }));
  await writeJson("public/techniques/blue1-class-calibration.json", blueCalibration);

  // Blue lab cross-technique identities and evidence-derived final mass.
  const bluePercentInstance = blueLab.techniqueInstances.find((instance) => instance.techniqueId === "blue1-percent-transmittance");
  bluePercentInstance.version = "1.3.0";
  bluePercentInstance.bindings.configuration = { calibrationRegressionCalculationId: "blue1-percent-transmittance--i1-confirmed-calibration-regression" };
  const unknownEntryConnection = blueLab.compositionConnections.find((row) => row.id === "blue1-cross-unknown-entry");
  if (unknownEntryConnection) unknownEntryConnection.to.portId = "entry-i1-configure-unknown-operational-inventory-node";
  const blueDilutionInstance = blueLab.techniqueInstances.find((instance) => instance.techniqueId === "blue1-standard-dilutions"); blueDilutionInstance.version = "1.3.0";
  const blueCalibrationInstance = blueLab.techniqueInstances.find((instance) => instance.techniqueId === "blue1-class-calibration"); blueCalibrationInstance.version = "1.3.0";
  blueCalibrationInstance.bindings.configuration = Object.fromEntries(ratios.filter(([, stock]) => stock > 0).map(([slug]) => [`i1-r${slug}-concentrationCalculationId`, `blue1-class-calibration--i1-r${slug}-concentration`]));
  if (!blueLab.initialState.equipment.some((item) => item.id === "i1-unknown-dilution-water")) blueLab.initialState.equipment.push({ id: "i1-unknown-dilution-water", definitionId: "distilled-water-bottle", label: "Teacher-approved unknown dilution water", location: "shelf", contents: { kind: "liquid", label: "distilled water", solutes: [], contamination: [], wetState: "wet", visualState: "clear-liquid" } });
  for (const item of blueLab.initialState.equipment) if (item.id === "i1-unknown-sample") item.contents.volumeMl = undefined;
  const molarMass = clone(blueLab.actions.find((action) => action.id === "i1-record-molar-mass-reference") ?? bluePercent.actions.find((action) => action.id === "i1-record-molar-mass-reference")); Object.assign(molarMass.parameters, { measurementId: "i1-blue1-molar-mass-g-per-mol", configurationQuantity: "Blue #1 molar mass reference", inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: "Teacher-approved Blue #1 molar mass (g/mol)", inputMin: 0, inputMinExclusive: true, unit: "g/mol" }); molarMass.interaction = { type: "recordNotebook", valueParameter: "measurementId", accessibleLabel: molarMass.label }; delete molarMass.effect;
  const finalSolutionVolume = configuredMeasurement({ id: "i1-record-final-solution-volume", label: "Record the source-stated final solution volume", measurementId: "i1-final-solution-volume-ml", quantity: "final sports-drink volume", unit: "mL", inputLabel: "Final solution volume (source states 500 mL)" }); finalSolutionVolume.parameters.configuredValue = 500; finalSolutionVolume.effect = { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] };
  delete finalSolutionVolume.effect;
  const massPrototype = clone(blueLab.actions.find((action) => action.id === "i1-calculate-mass-500ml") ?? bluePercent.actions.find((action) => action.id === "i1-calculate-mass-500ml") ?? bluePercent.actions.find((action) => action.id === "i1-calculate-direct-mass-500ml") ?? bluePercent.actions.find((action) => action.id === "i1-calculate-diluted-mass-500ml")); delete massPrototype.effect; massPrototype.parameters = {}; massPrototype.interaction ??= { type: "submitCalculation", accessibleLabel: massPrototype.label }; massPrototype.interaction.valueParameter = "calculationId";
  const directMass = clone(massPrototype); directMass.id = "i1-calculate-direct-mass-500ml"; directMass.label = "Derive the 500 mL mass from the direct branch"; directMass.analysis = { type: "molarConcentrationToMass", concentration: { source: "calculation", referenceId: "i1-direct-original-blue1-molarity" }, solutionVolumeMeasurementId: "i1-final-solution-volume-ml", molarMassMeasurementId: "i1-blue1-molar-mass-g-per-mol", outputCalculationId: "i1-direct-blue1-mass-500ml" };
  const dilutedMass = clone(massPrototype); dilutedMass.id = "i1-calculate-diluted-mass-500ml"; dilutedMass.label = "Derive the 500 mL mass from the approved dilution branch"; dilutedMass.analysis = { type: "molarConcentrationToMass", concentration: { source: "calculation", referenceId: "i1-diluted-original-blue1-molarity" }, solutionVolumeMeasurementId: "i1-final-solution-volume-ml", molarMassMeasurementId: "i1-blue1-molar-mass-g-per-mol", outputCalculationId: "i1-diluted-blue1-mass-500ml" };
  directMass.prerequisites = [{ id: "i1-direct-mass-needs-concentration", type: "actionEvidence", label: "Direct concentration branch is complete", actionId: "i1-derive-direct-original-concentration" }];
  dilutedMass.prerequisites = [{ id: "i1-diluted-mass-needs-concentration", type: "actionEvidence", label: "Dilution back-calculation branch is complete", actionId: "i1-back-calculate-original-concentration" }];
  for (const action of [molarMass, finalSolutionVolume, directMass, dilutedMass]) setAction(bluePercent, action);
  removeAction(bluePercent, "i1-calculate-mass-500ml");
  const massNodeIds = new Set(["i1-record-molar-mass-reference-node", "i1-record-final-solution-volume-node", "i1-calculate-mass-500ml-node", "i1-calculate-direct-mass-500ml-node", "i1-calculate-diluted-mass-500ml-node"]);
  bluePercent.process.edges = bluePercent.process.edges.filter((edge) => !massNodeIds.has(edge.from) && !massNodeIds.has(edge.to) && !(edge.from === "i1-remove-unknown-cuvette-node" && edge.to === "i1-classify-unknown-range-node"));
  bluePercent.process.edges.push(
    { from: "i1-remove-unknown-cuvette-node", to: "i1-record-molar-mass-reference-node", label: "Configure mass conversion", condition: { type: "validationPassed" } },
    ...linearEdges(["i1-record-molar-mass-reference", "i1-record-final-solution-volume", "i1-classify-unknown-range"]),
    { from: "i1-derive-direct-original-concentration-node", to: "i1-calculate-direct-mass-500ml-node", label: "Derive direct-branch mass", condition: { type: "validationPassed" } },
    { from: "i1-back-calculate-original-concentration-node", to: "i1-calculate-diluted-mass-500ml-node", label: "Derive dilution-branch mass", condition: { type: "validationPassed" } },
  );
  bluePercent.process.edges = bluePercent.process.edges.filter((edge, index, edges) => edges.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(edge)) === index);
  bluePercent.composition = compositionFor(bluePercent); for (const role of bluePercent.composition.equipmentRoles) role.required = true;
  bluePercent.composition.configurationSlots = [{ id: "calibrationRegressionCalculationId", valueType: "string", required: true }];
  await writeJson("public/techniques/blue1-percent-transmittance.json", bluePercent);
  for (const id of ["i1-record-dilution-factor", "i1-calculate-original-molarity", "i1-record-molar-mass-reference", "i1-record-final-solution-volume", "i1-calculate-mass-500ml"]) removeAction(blueLab, id);
  blueLab.process.edges = blueLab.process.edges.filter((edge) => !["i1-record-unknown-reading-set-node", "i1-record-molar-mass-reference-node", "i1-record-final-solution-volume-node", "i1-calculate-mass-500ml-node", "i1-justify-method-node", "i1-postlab-dilution-reasoning-node", "i1-postlab-transformation-reasoning-node", "i1-postlab-uncertainty-node"].includes(edge.from) && !["i1-record-unknown-reading-set-node", "i1-record-molar-mass-reference-node", "i1-record-final-solution-volume-node", "i1-calculate-mass-500ml-node", "i1-justify-method-node", "i1-postlab-dilution-reasoning-node", "i1-postlab-transformation-reasoning-node", "i1-postlab-uncertainty-node"].includes(edge.to));
  blueLab.process.edges.push(...linearEdges(["i1-record-unknown-reading-set", "i1-justify-method", "i1-postlab-dilution-reasoning", "i1-postlab-transformation-reasoning", "i1-postlab-uncertainty"]));
  const unknownExit = blueLab.compositionConnections.find((row) => row.id === "blue1-cross-unknown-exit-in-range"); unknownExit.from.portId = "exit-i1-calculate-direct-mass-500ml-node";
  let dilutedExit = blueLab.compositionConnections.find((row) => row.id === "blue1-cross-unknown-exit-diluted");
  if (!dilutedExit) { dilutedExit = clone(unknownExit); dilutedExit.id = "blue1-cross-unknown-exit-diluted"; blueLab.compositionConnections.push(dilutedExit); }
  dilutedExit.from.portId = "exit-i1-calculate-diluted-mass-500ml-node";
  for (const instance of [blueDilutionInstance, blueCalibrationInstance, bluePercentInstance]) {
    const technique = instance.techniqueId === blueDilutions.id ? blueDilutions : instance.techniqueId === blueCalibration.id ? blueCalibration : bluePercent;
    instance.preserveIds.actions = Object.fromEntries(technique.actions.map((action) => [action.id, action.id]));
    instance.preserveIds.nodes = Object.fromEntries(technique.process.nodes.map((node) => [node.id, node.id]));
  }
  blueDilutionInstance.preserveIds.references = Object.fromEntries(ratios.filter(([, stock]) => stock > 0).map(([slug]) => [`blue1-class-calibration--i1-r${slug}-concentration`, `blue1-class-calibration--i1-r${slug}-concentration`]));
  blueCalibrationInstance.preserveIds.references = { "blue1-percent-transmittance--i1-confirmed-calibration-regression": "blue1-percent-transmittance--i1-confirmed-calibration-regression" };
  bluePercentInstance.preserveIds.references = Object.fromEntries(["i1-approved-unknown-aliquot", "i1-approved-instrument-range"].map((id) => [id, id]));
  blueLab.techniqueInstances = [blueDilutionInstance, blueCalibrationInstance, bluePercentInstance];
  const originalMolarityAssessment = blueLab.assessments?.find((assessment) => assessment.actionId === "i1-calculate-original-molarity");
  if (originalMolarityAssessment) { originalMolarityAssessment.type = "processCompleted"; delete originalMolarityAssessment.actionId; }
  const massAssessment = blueLab.assessments?.find((assessment) => assessment.actionId === "i1-calculate-mass-500ml");
  if (massAssessment) { massAssessment.type = "processCompleted"; delete massAssessment.actionId; }
  blueLab.metadata.version = "1.3.0"; blueLab.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  await writeJson("public/labs/blue1-spectroscopy.json", blueLab);

  // Brass typed preparation, one-time two-cuvette scan preparation, and conserved sample handling.
  const brass = await readJson("public/techniques/brass-spectrophotometry.json");
  const brassLab = await readJson("public/labs/brass-colorimetry.json");
  const brassActions = actionMap(brass);
  const weigh = brassActions.get("weigh-brass-action"); weigh.mass = { source: "action-input", outputMeasurementId: "brass-mass-recorded-g", applyToSourceInventory: true }; Object.assign(weigh.parameters, { sourceInstanceId: "brass-sample-vial", sourceDefinitionId: "small-vial", inputMode: "numeric", inputRole: "studentResponse", inputLabel: "Net brass mass from the tared balance (g)", inputMin: 0, inputMinExclusive: true, unit: "g" }); delete weigh.parameters.measurementId; delete weigh.parameters.configurationChoice;
  weigh.label = "Weigh the brass sample before quantitative transfer";
  const placeBrass = brassActions.get("place-brass-in-beaker-action"); placeBrass.mass = { source: "measurement", referenceId: "brass-mass-recorded-g" }; delete placeBrass.parameters.configurationChoice;
  brass.process.edges = brass.process.edges.filter((edge) => ![["tare-empty-beaker", "place-brass-in-beaker"], ["place-brass-in-beaker", "weigh-brass"], ["tare-empty-beaker", "weigh-brass"], ["weigh-brass", "place-brass-in-beaker"]].some(([from, to]) => edge.from === from && edge.to === to));
  brass.process.edges.push(
    { from: "tare-empty-beaker", to: "weigh-brass", label: "Continue after required evidence", condition: { type: "validationPassed" } },
    { from: "weigh-brass", to: "place-brass-in-beaker", label: "Transfer the measured mass", condition: { type: "validationPassed" } },
  );
  const digest = brassActions.get("transfer-digest-action"); stripDecorativeVolume(digest); digest.volume = { source: "measurement", referenceId: "digest-added-water-ml" };
  for (let index = 1; index <= 4; index += 1) {
    const rinse = brassActions.get(`rinse-beaker-${index}-action`); rinse.parameters.volumeMl = 5; rinse.parameters.collectRinseVolume = true;
    const transfer = brassActions.get(`transfer-rinse-${index}-action`); stripDecorativeVolume(transfer); transfer.volume = { source: "literal", valueMl: 5 };
  }
  const diluteUnknown = brassActions.get("dilute-unknown-to-mark-action"); stripDecorativeVolume(diluteUnknown); diluteUnknown.volume = { source: "measurement", referenceId: "brass-spectrophotometry--approved-unknown-final-volume" };
  for (const sample of ["0p400", "0p200", "0p100", "0p0500", "0p0250"]) {
    const transfer = brassActions.get(`standard-${sample}-stock-transfer-action`); stripDecorativeVolume(transfer); transfer.volume = sample === "0p400" ? { source: "measurement", referenceId: "brass-spectrophotometry--approved-standard-final-volume" } : { source: "calculation", referenceId: `brass-spectrophotometry--standard-${sample}-aliquot-ml` }; transfer.deliveryDevice = { deviceInstanceId: "graduated-pipette", deviceDefinitionId: "graduated-pipette-10ml" };
    const dilution = brassActions.get(`standard-${sample}-dilute-action`); if (dilution) { stripDecorativeVolume(dilution); dilution.volume = { source: "measurement", referenceId: "brass-spectrophotometry--approved-standard-final-volume" }; }
  }
  const dark = brassActions.get("calibrate-zero-percent-t-action"); Object.assign(dark.parameters, { photometerOperation: "darkZero", wavelengthMeasurementId: "{{config.wavelengthMeasurementId}}", photometerInstanceId: "spectrophotometer", tag: "spectrophotometer-dark-zero" });
  const blank = brassActions.get("prepare-blank-action"); stripDecorativeVolume(blank); blank.volume = { source: "target-fill-fraction", fraction: 0.75 };
  const blankZero = brassActions.get("calibrate-hundred-percent-t-action"); blankZero.parameters.requiresDarkZeroNotebookTag = "spectrophotometer-dark-zero";
  for (const sample of ["0p0250", "0p0500", "0p100", "0p200", "0p400", "unknown"]) {
    const condition = brassActions.get(`condition-${sample}-action`); Object.assign(condition.parameters, { conditioningCount: 2, conditioningPortionMl: 1 }); delete condition.parameters.configurationChoice;
    const fill = brassActions.get(`fill-${sample}-cuvette-action`); stripDecorativeVolume(fill); fill.volume = { source: "target-fill-fraction", fraction: 0.75 };
    const read = brassActions.get(`read-${sample}-absorbance-action`); Object.assign(read.parameters, { measurementId: `${sample}-absorbance-au`, unit: "absorbance", inputMode: "numeric", inputRole: "studentResponse", inputLabel: `Instrument absorbance for ${sample}`, inputMin: 0 });
    const record = brassActions.get(`record-${sample}-absorbance-action`); record.parameters.measurementId = `${sample}-absorbance-au`; record.parameters.unit = "absorbance"; delete record.parameters.inputMode; delete record.parameters.inputRole; delete record.parameters.inputLabel; delete record.parameters.configurationChoice;
    const ret = brassActions.get(`return-${sample}-action`); stripDecorativeVolume(ret); ret.volume = { source: "literal", valueMl: 3 };
  }
  const preparedUnknown = brassActions.get("transfer-prepared-unknown-to-original-tube-action"); stripDecorativeVolume(preparedUnknown); preparedUnknown.volume = { source: "action-input" }; Object.assign(preparedUnknown.parameters, { inputMode: "numeric", inputRole: "studentResponse", inputLabel: "Measured prepared-unknown portion for the original tube (mL)", inputMin: 0, inputMinExclusive: true, unit: "mL" }); preparedUnknown.deliveryDevice = { deviceInstanceId: "graduated-pipette", deviceDefinitionId: "graduated-pipette-10ml" };

  // Replace the inflated scan with two one-time preparations and exactly 32 reads/records.
  for (const id of brass.actions.filter((action) => /^scan-/.test(action.id)).map((action) => action.id)) removeAction(brass, id);
  for (const [salt, cuvetteId] of [["a", "salt-a-scan-cuvette"], ["b", "salt-b-scan-cuvette"]]) {
    if (!brass.initialState.equipment.some((item) => item.id === cuvetteId)) brass.initialState.equipment.push({ id: cuvetteId, definitionId: "cuvette", label: `Assigned salt ${salt.toUpperCase()} scan cuvette`, location: "shelf", contents: emptyContents() });
    const sourceId = `assigned-salt-${salt}-solution`;
    const inventory = makeAction({ id: `scan-configure-salt-${salt}-inventory-action`, label: `Configure finite assigned-salt ${salt.toUpperCase()} operational inventory`, parameters: { sourceInstanceId: sourceId, sourceDefinitionId: "test-tube", inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: `Assigned-salt ${salt.toUpperCase()} volume available (mL)`, inputMin: 0, inputMinExclusive: true, unit: "mL" } }); inventory.verb = "observe"; inventory.sourceInventory = { sourceInstanceId: sourceId, sourceDefinitionId: "test-tube", outputMeasurementId: `assigned-salt-${salt}-inventory-ml` };
    const condition = makeAction({ id: `scan-condition-salt-${salt}-once-action`, label: `Condition assigned-salt ${salt.toUpperCase()} scan cuvette once before the wavelength series`, atomId: "atom.rinse.condition-cuvette-with-sample", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: sourceId, targetInstanceId: cuvetteId, conditioningCount: 2, conditioningPortionMl: 1, sampleIdentity: `assigned-salt-${salt}`, decisionProvenance: "R/C operational handling; not a source analytical value" } });
    const fill = makeAction({ id: `scan-fill-salt-${salt}-once-action`, label: `Fill assigned-salt ${salt.toUpperCase()} scan cuvette once`, atomId: "atom.transfer.fill-cuvette", bindings: { "sample-source": "test-tube", "photometer-sample-holder": "cuvette" }, parameters: { sourceInstanceId: sourceId, targetInstanceId: cuvetteId, sampleIdentity: `assigned-salt-${salt}` } }); fill.volume = { source: "target-fill-fraction", fraction: 0.75 };
    const prepare = makeAction({ id: `scan-prepare-salt-${salt}-once-action`, label: `Prepare assigned-salt ${salt.toUpperCase()} optical faces once`, atomId: "atom.rinse.prepare-cuvette-optical-faces", bindings: { "photometer-sample-holder": "cuvette" }, parameters: { cuvetteInstanceId: cuvetteId, sampleIdentity: `assigned-salt-${salt}` } });
    for (const action of [inventory, condition, fill, prepare]) setAction(brass, action);
  }
  const placePhotometer = makeAction({ id: "scan-place-photometer-action", label: "Place the spectrophotometer for the assigned-salt scan", atomId: "atom.place.photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { equipmentDefinitionId: "spectrophotometer", equipmentInstanceId: "spectrophotometer", location: "workbench" } }); setAction(brass, placePhotometer);
  const scanIds = ["scan-place-photometer-action", "scan-configure-salt-a-inventory-action", "scan-condition-salt-a-once-action", "scan-fill-salt-a-once-action", "scan-prepare-salt-a-once-action", "scan-configure-salt-b-inventory-action", "scan-condition-salt-b-once-action", "scan-fill-salt-b-once-action", "scan-prepare-salt-b-once-action"];
  for (let wavelength = 400; wavelength <= 700; wavelength += 20) {
    const set = makeAction({ id: `scan-set-${wavelength}-action`, label: `Set the source-stated scan wavelength to ${wavelength} nm`, atomId: "atom.observe.configure-photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { photometerInstanceId: "spectrophotometer", measurementId: `scan-${wavelength}-wavelength-nm`, configurationQuantity: "scan wavelength", configuredValue: wavelength, unit: "nm", photometricMode: "absorbance", tag: `scan-${wavelength}-configured` } }); setAction(brass, set); scanIds.push(set.id);
    for (const salt of ["a", "b"]) {
      const cuvetteId = `salt-${salt}-scan-cuvette`; const measurementId = `scan-${wavelength}-salt-${salt}-absorbance`;
      const insert = makeAction({ id: `scan-insert-${wavelength}-salt-${salt}-action`, label: `Insert assigned salt ${salt.toUpperCase()} at ${wavelength} nm`, atomId: "atom.place.insert-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: cuvetteId, targetInstanceId: "spectrophotometer", snapZoneId: "spectrophotometer-cuvette-slot", sampleIdentity: `assigned-salt-${salt}` } });
      const read = makeAction({ id: `scan-read-${wavelength}-salt-${salt}-action`, label: `Read assigned salt ${salt.toUpperCase()} at ${wavelength} nm`, atomId: "atom.observe.read-photometer", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { photometerInstanceId: "spectrophotometer", cuvetteInstanceId: cuvetteId, wavelengthMeasurementId: `scan-${wavelength}-wavelength-nm`, measurementId, photometricQuantity: "absorbance", unit: "absorbance", photometerOperation: "read", inputMode: "numeric", inputRole: "studentResponse", inputLabel: `Assigned-salt ${salt.toUpperCase()} absorbance at ${wavelength} nm`, inputMin: 0 } });
      const record = makeAction({ id: `scan-record-${wavelength}-salt-${salt}-action`, label: `Record assigned salt ${salt.toUpperCase()} at ${wavelength} nm`, atomId: "atom.record.photometer-reading", bindings: { "photometer-instrument": "spectrophotometer" }, parameters: { measurementId, unit: "absorbance", sampleIdentity: `assigned-salt-${salt}` }, prerequisites: [{ id: `${measurementId}-required`, type: "measurementRecorded", label: "The matching scan reading exists", measurementId }] });
      const remove = makeAction({ id: `scan-remove-${wavelength}-salt-${salt}-action`, label: `Remove assigned salt ${salt.toUpperCase()} after ${wavelength} nm`, atomId: "atom.place.remove-cuvette", bindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" }, parameters: { equipmentInstanceId: cuvetteId, sampleIdentity: `assigned-salt-${salt}` } });
      for (const action of [insert, read, record, remove]) { setAction(brass, action); scanIds.push(action.id); }
    }
  }
  for (const [salt, cuvetteId] of [["a", "salt-a-scan-cuvette"], ["b", "salt-b-scan-cuvette"]]) {
    const ret = makeAction({ id: `scan-return-salt-${salt}-after-series-action`, label: `Return assigned salt ${salt.toUpperCase()} after the scan series`, atomId: "atom.transfer.return-cuvette-to-origin", bindings: { "photometer-sample-holder": "cuvette", "provenance-matched-sample-receiver": "test-tube" }, parameters: { sourceInstanceId: cuvetteId, targetInstanceId: `assigned-salt-${salt}-solution`, sampleIdentity: `assigned-salt-${salt}` } }); ret.volume = { source: "literal", valueMl: 3 }; setAction(brass, ret); scanIds.push(ret.id);
  }
  const nonScanEdges = brass.process.edges.filter((edge) => !edge.from.startsWith("scan-") && !edge.to.startsWith("scan-"));
  brass.process.edges = [...nonScanEdges, ...linearEdges(scanIds)]; brass.process.startNodeId = `${scanIds[0]}-node`;

  // Canonical process evidence and source-stated preparation endpoints.
  const standardFinal = configuredMeasurement({ id: "record-standard-final-volume-action", label: "Record the source-stated standard final-volume endpoint", measurementId: "approved-standard-final-volume", quantity: "standard final volume", unit: "mL", inputLabel: "Teacher confirms the source endpoint and stated precision" }); standardFinal.parameters.configuredValue = 10;
  const unknownFinal = configuredMeasurement({ id: "record-unknown-final-volume-action", label: "Record the source-stated unknown final-volume endpoint", measurementId: "approved-unknown-final-volume", quantity: "unknown final volume", unit: "mL", inputLabel: "Teacher confirms the 100.0 mL endpoint" }); unknownFinal.parameters.configuredValue = 100;
  standardFinal.parameters.measurementId = "brass-spectrophotometry--approved-standard-final-volume"; delete standardFinal.effect;
  unknownFinal.parameters.measurementId = "brass-spectrophotometry--approved-unknown-final-volume"; delete unknownFinal.effect;
  const evidenceEffect = { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] };
  for (const action of [standardFinal, unknownFinal]) setAction(brass, action);
  const measureAddedWater = makeAction({ id: "measure-50ml-digest-water-action", label: "Measure the source-stated 50 mL digest water", atomId: "atom.measure.variable-volume", bindings: { "variable-volume-measuring-device": "graduated-cylinder", "liquid-source": "wash-bottle" }, parameters: { sourceInstanceId: "wash-bottle", targetInstanceId: "digest-water-cylinder", teacherControlled: true } }); measureAddedWater.volume = { source: "literal", valueMl: 50, outputMeasurementId: "digest-added-water-ml" };
  const addWater = makeAction({ id: "teacher-add-50ml-water-to-digest-action", label: "Teacher adds the source-stated 50 mL water to the completed digest", atomId: "atom.transfer.measured-liquid", bindings: { "measured-solvent-source": "graduated-cylinder", "receiving-vessel": "beaker-250ml" }, parameters: { sourceInstanceId: "digest-water-cylinder", targetInstanceId: "brass-beaker", teacherControlled: true } }); addWater.volume = { source: "measurement", referenceId: "digest-added-water-ml" };
  const transition = makeAction({ id: "confirm-diluted-digest-material-action", label: "Confirm the conservative diluted-digest material transition", parameters: { sourceInstanceId: "digest-water-cylinder", sourceDefinitionId: "graduated-cylinder", targetInstanceId: "brass-beaker", targetDefinitionId: "beaker-250ml", teacherControlled: true } }); transition.verb = "dissolve"; transition.interaction = { type: "pourInto", sourceDefinitionId: "graduated-cylinder", targetDefinitionId: "beaker-250ml", accessibleLabel: "Confirm the completed digest is now the source-stated diluted solution." }; transition.materialTransition = { kind: "solution", label: "Completed brass digest diluted with the source-stated water addition", wetState: "wet", visualState: "copper-blue-solution" };
  for (const action of [measureAddedWater, addWater, transition]) setAction(brass, action);
  for (const definition of [brass, brassLab]) if (!definition.initialState.equipment.some((item) => item.id === "digest-water-cylinder")) definition.initialState.equipment.push({ id: "digest-water-cylinder", definitionId: "graduated-cylinder", label: "Digest-water graduated cylinder", location: "shelf", contents: emptyContents() });
  brassLab.equipment = [...new Set([...(brassLab.equipment ?? []), "graduated-cylinder"])];
  const oldConfirm = brassLab.actions.find((action) => action.id === "confirm-teacher-diluted-digest-action"); oldConfirm.parameters = { tag: "teacher-diluted-digest-ready", note: "Teacher confirms the material transition before the source-stated water addition." };
  brassLab.process.edges = brassLab.process.edges.filter((edge) => !["teacher-cover-digest", "record-unknown-final-volume-action-node", "record-standard-final-volume-action-node", "confirm-teacher-diluted-digest-action-node"].includes(edge.from) && !["teacher-cover-digest", "record-unknown-final-volume-action-node", "record-standard-final-volume-action-node", "confirm-teacher-diluted-digest-action-node"].includes(edge.to));
  brassLab.process.edges.push(
    { from: "teacher-add-acid", to: "teacher-cover-digest", label: "Continue after teacher-controlled digestion", condition: { type: "validationPassed" } },
    { from: "teacher-cover-digest", to: "confirm-teacher-diluted-digest-action-node", label: "Teacher confirms completed digestion", condition: { type: "validationPassed" } },
  );
  const digestNodeIds = new Set(["record-unknown-final-volume-action-node", "record-standard-final-volume-action-node", "measure-50ml-digest-water-action-node", "teacher-add-50ml-water-to-digest-action-node", "confirm-diluted-digest-material-action-node"]);
  brass.process.edges = brass.process.edges.filter((edge) => !digestNodeIds.has(edge.from) && !digestNodeIds.has(edge.to));
  brass.process.edges.push(...linearEdges(["record-unknown-final-volume-action", "record-standard-final-volume-action", "measure-50ml-digest-water-action", "teacher-add-50ml-water-to-digest-action", "confirm-diluted-digest-material-action"]), { from: "confirm-diluted-digest-material-action-node", to: "transfer-digest", label: "Transfer complete available digest", condition: { type: "validationPassed" } });
  const digestConnection = brassLab.compositionConnections.find((row) => row.id === "brass-repair-teacher-digest-to-transfer"); digestConnection.to.portId = "entry-record-unknown-final-volume-action-node";
  const approvedWavelength = brassLab.actions.find((action) => action.id === "approved-wavelength-nm-action");
  approvedWavelength.verb = "observe"; approvedWavelength.parameters.measurementId = "brass-spectrophotometry--approved-wavelength-nm"; delete approvedWavelength.parameters.calculationId; delete approvedWavelength.parameters.configurationChoice; approvedWavelength.interaction = { type: "recordNotebook", valueParameter: "measurementId", accessibleLabel: approvedWavelength.label }; approvedWavelength.effect = clone(evidenceEffect);
  for (const sample of ["0p200", "0p100", "0p0500", "0p0250"]) {
    const action = clone(brassLab.actions.find((candidate) => candidate.id === `standard-${sample}-aliquot-ml-action`) ?? brass.actions.find((candidate) => candidate.id === `standard-${sample}-aliquot-ml-action`));
    action.parameters.calculationId = `brass-spectrophotometry--standard-${sample}-aliquot-ml`;
    delete action.parameters.configurationChoice;
    delete action.effect;
    setAction(brass, action);
  }
  const d01Ids = ["standard-0p200-aliquot-ml-action", "standard-0p100-aliquot-ml-action", "standard-0p0500-aliquot-ml-action", "standard-0p0250-aliquot-ml-action"];
  const d01NodeIds = new Set(d01Ids.map((id) => `${id}-node`));
  brass.process.edges = brass.process.edges.filter((edge) => !d01NodeIds.has(edge.from) && !d01NodeIds.has(edge.to) && !(edge.from === "dilute-unknown-to-mark" && edge.to === "standard-0p400-stock-transfer"));
  brass.process.edges.push(...linearEdges(d01Ids), { from: "dilute-unknown-to-mark", to: `${d01Ids[0]}-node`, label: "Calculate physical standard transfers", condition: { type: "validationPassed" } }, { from: `${d01Ids.at(-1)}-node`, to: "standard-0p400-stock-transfer", label: "Prepare standards", condition: { type: "validationPassed" } });
  for (const id of ["record-standard-final-volume-action", "record-unknown-final-volume-action", ...d01Ids]) removeAction(brassLab, id);
  const remainingBrassLabNodeIds = new Set(brassLab.process.nodes.map((node) => node.id));
  brassLab.process.edges = brassLab.process.edges.filter((edge) => remainingBrassLabNodeIds.has(edge.from) && remainingBrassLabNodeIds.has(edge.to));
  brassLab.compositionConnections = brassLab.compositionConnections.filter((row) => !["brass-repair-unknown-to-standard-calculations", "brass-cross-7"].includes(row.id));
  const brassInstance = brassLab.techniqueInstances.find((instance) => instance.techniqueId === brass.id); brassInstance.version = "1.3.0"; brassInstance.bindings.configuration = { wavelengthMeasurementId: "brass-spectrophotometry--approved-wavelength-nm", measurementCuvetteInstanceId: "measurement-cuvette" };
  for (const cuvetteId of ["salt-a-scan-cuvette", "salt-b-scan-cuvette"]) if (!brassLab.initialState.equipment.some((item) => item.id === cuvetteId)) brassLab.initialState.equipment.push(clone(brass.initialState.equipment.find((item) => item.id === cuvetteId)));
  for (const sourceId of ["assigned-salt-a-solution", "assigned-salt-b-solution"]) for (const definition of [brass, brassLab]) { const item = definition.initialState.equipment.find((candidate) => candidate.id === sourceId); if (item) delete item.contents.volumeMl; }
  // Align canonical downstream measurement identities.
  const recordMass = brassLab.actions.find((action) => action.id === "record-brass-mass-action"); recordMass.parameters = { tag: "brass-mass-recorded", sourceMeasurementId: "brass-mass-recorded-g" }; recordMass.prerequisites = [{ id: "record-brass-mass-needs-measurement", type: "measurementRecorded", label: "The canonical brass mass exists", measurementId: "brass-mass-recorded-g" }];
  const massConnection = brassLab.compositionConnections.find((row) => row.id === "brass-cross-4"); massConnection.from.portId = "exit-place-brass-in-beaker";
  for (const action of brassLab.actions) {
    if (action.parameters.responseMeasurementId === "unknown-absorbance-au") action.parameters.responseMeasurementId = "unknown-absorbance-au";
    if (Array.isArray(action.parameters.measurementIds)) action.parameters.measurementIds = action.parameters.measurementIds.map((id) => id.replace(/-absorbance-au$/, "-absorbance-au"));
  }
  brass.process.edges = brass.process.edges.filter((edge, index, edges) => edges.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(edge)) === index);
  brass.metadata.version = "1.3.0"; brass.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  brass.composition = compositionFor(brass, "brass-colorimetry"); for (const role of brass.composition.equipmentRoles) role.required = true;
  brass.composition.configurationSlots = [{ id: "wavelengthMeasurementId", valueType: "string", required: true }, { id: "measurementCuvetteInstanceId", valueType: "string", required: true }];
  brass.requiredEquipment = [...new Set([...(brass.requiredEquipment ?? []), "graduated-cylinder"])];
  const moveBefore = (actionId, beforeId) => {
    const [action] = brass.actions.splice(brass.actions.findIndex((candidate) => candidate.id === actionId), 1);
    brass.actions.splice(brass.actions.findIndex((candidate) => candidate.id === beforeId), 0, action);
  };
  moveBefore("weigh-brass-action", "place-brass-in-beaker-action");
  const digestPreparation = ["record-unknown-final-volume-action", "record-standard-final-volume-action", "measure-50ml-digest-water-action", "teacher-add-50ml-water-to-digest-action", "confirm-diluted-digest-material-action"].map((id) => brass.actions.splice(brass.actions.findIndex((action) => action.id === id), 1)[0]);
  brass.actions.splice(brass.actions.findIndex((action) => action.id === "transfer-digest-action"), 0, ...digestPreparation);
  const d01Actions = d01Ids.map((id) => brass.actions.splice(brass.actions.findIndex((action) => action.id === id), 1)[0]);
  brass.actions.splice(brass.actions.findIndex((action) => action.id === "standard-0p400-stock-transfer-action"), 0, ...d01Actions);
  brassLab.metadata.version = "1.3.0"; brassLab.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  const scanIncoming = brassLab.compositionConnections.find((row) => row.id === "brass-cross-1"); scanIncoming.to.portId = `entry-${scanIds[0]}-node`;
  const scanOutgoing = brassLab.compositionConnections.find((row) => row.id === "brass-cross-2"); scanOutgoing.from.portId = `exit-${scanIds.at(-1)}-node`;
  // Preserve every final public action/node identity at the lab boundary.
  brassInstance.preserveIds.actions = Object.fromEntries(brass.actions.map((action) => [action.id, action.id]));
  brassInstance.preserveIds.nodes = Object.fromEntries(brass.process.nodes.map((node) => [node.id, node.id]));
  brassInstance.preserveIds.references = Object.fromEntries(["brass-mass-recorded-g", "0p0250-absorbance-au", "0p0500-absorbance-au", "0p100-absorbance-au", "0p200-absorbance-au", "0p400-absorbance-au", "unknown-absorbance-au", "unknown-depth-mm", "standard-depth-mm", "neutralized-waste-ph"].map((id) => [id, id]));
  await writeJson("public/techniques/brass-spectrophotometry.json", brass);
  await writeJson("public/labs/brass-colorimetry.json", brassLab);

  // Keep all lab pins and public metadata coherent.
  for (const lab of [blueLab, brassLab]) {
    for (const instance of lab.techniqueInstances) instance.version = "1.3.0";
  }
};

const applyConsolidatedXhighCorrections = async () => {
  const blue = await readJson("public/techniques/blue1-percent-transmittance.json");
  const blueLab = await readJson("public/labs/blue1-spectroscopy.json");
  const brass = await readJson("public/techniques/brass-spectrophotometry.json");
  const brassLab = await readJson("public/labs/brass-colorimetry.json");
  const nodeIdFor = (definition, actionId) => definition.process.nodes.find((node) => node.actionId === actionId)?.id;
  const addAction = (definition, action) => {
    definition.actions = definition.actions.filter((candidate) => candidate.id !== action.id);
    definition.process.nodes = definition.process.nodes.filter((node) => node.actionId !== action.id);
    definition.actions.push(action);
    definition.process.nodes.push(makeNode(action, action.verb === "calculate" ? "calculation" : "action"));
  };
  const replaceSegment = (definition, actionIds) => {
    const nodeIds = actionIds.map((id) => nodeIdFor(definition, id));
    const touched = new Set(nodeIds);
    definition.process.edges = definition.process.edges.filter((edge) => !touched.has(edge.from) && !touched.has(edge.to));
    definition.process.edges.push(...nodeIds.slice(1).map((nodeId, index) => ({
      from: nodeIds[index], to: nodeId, label: "Next", condition: { type: "validationPassed" },
    })));
    return nodeIds;
  };

  // The teacher-configured replicate count is executable evidence, and both possible
  // unknown acquisitions repeat against it without preloading any classroom result.
  const replicateCount = makeAction({ id: "i1-record-approved-unknown-replicate-count", label: "Record the teacher-approved unknown replicate count", parameters: {
    measurementId: "i1-approved-unknown-replicate-count", configurationQuantity: "unknown replicate count",
    inputMode: "numeric", inputRole: "teacherConfiguration", inputLabel: "Teacher-approved number of raw or diluted unknown readings",
    inputMin: 0, inputMinExclusive: true, inputStep: 1, unit: "count",
    configurationProvenance: "teacher-configured; the source supplies no replicate count",
  }});
  replicateCount.verb = "observe";
  addAction(blue, replicateCount);
  const [orderedReplicateCount] = blue.actions.splice(blue.actions.findIndex((action) => action.id === replicateCount.id), 1);
  blue.actions.splice(blue.actions.findIndex((action) => action.id === "i1-read-unknown-percent-t"), 0, orderedReplicateCount);
  const rawRead = blue.actions.find((action) => action.id === "i1-read-unknown-percent-t");
  const dilutedRead = blue.actions.find((action) => action.id === "i1-read-diluted-unknown-percent-t");
  delete rawRead.parameters.measurementId;
  delete dilutedRead.parameters.measurementId;
  rawRead.parameters.inputRole = "studentResponse";
  rawRead.runtimeRepeat = { countMeasurementId: "i1-approved-unknown-replicate-count", outputMeasurementId: "i1-unknown-percent-t", progressId: "i1-raw-unknown-readings" };
  dilutedRead.runtimeRepeat = { countMeasurementId: "i1-approved-unknown-replicate-count", outputMeasurementId: "i1-diluted-unknown-percent-t", progressId: "i1-diluted-unknown-readings" };
  Object.assign(dilutedRead.parameters, {
    inputMode: "numeric", inputRole: "studentResponse", inputLabel: "Diluted sports-drink %T reading",
    inputMin: 0, inputMax: 100, unit: "%T",
  });
  const rawRecord = blue.actions.find((action) => action.id === "i1-record-unknown-percent-t");
  const dilutedRecord = blue.actions.find((action) => action.id === "i1-record-diluted-unknown-percent-t");
  const rangeClassification = blue.actions.find((action) => action.id === "i1-classify-unknown-range");
  rawRecord.parameters.measurementId = "i1-unknown-percent-t-recorded";
  rawRecord.parameters.sourceMeasurementId = "i1-unknown-percent-t";
  dilutedRecord.parameters.measurementId = "i1-diluted-unknown-percent-t-recorded";
  dilutedRecord.parameters.sourceMeasurementId = "i1-diluted-unknown-percent-t";
  rangeClassification.verb = "calculate";
  rangeClassification.parameters = {
    calculationId: "i1-unknown-range-classification", template: "classifyMeasurementAgainstBound",
    measurementId: "i1-unknown-percent-t-recorded", boundMeasurementId: "i1-approved-instrument-range",
    comparison: "below", unit: "flag",
  };
  delete rangeClassification.choiceObservation;
  rangeClassification.interaction = { type: "submitCalculation", valueParameter: "calculationId", accessibleLabel: rangeClassification.label };
  const rawEntry = blue.process.edges.find((edge) => edge.to === nodeIdFor(blue, "i1-configure-unknown-operational-inventory"));
  if (rawEntry) rawEntry.to = nodeIdFor(blue, replicateCount.id);
  blue.process.edges.push({ from: nodeIdFor(blue, replicateCount.id), to: nodeIdFor(blue, "i1-configure-unknown-operational-inventory"), label: "Use configured replicate evidence", condition: { type: "validationPassed" } });
  const blueInstance = blueLab.techniqueInstances.find((instance) => instance.techniqueId === blue.id);
  const blueIncoming = blueLab.compositionConnections.find((row) => row.id === "blue1-cross-unknown-entry");
  if (blueIncoming) blueIncoming.to.portId = `entry-${nodeIdFor(blue, replicateCount.id)}`;

  // Canonical Brass measurement ids must agree at acquisition, recording, and every
  // downstream prerequisite. The old prerequisites omitted the public `-au` suffix.
  for (const sample of ["0p0250", "0p0500", "0p100", "0p200", "0p400", "unknown"]) {
    const measurementId = `${sample}-absorbance-au`;
    const read = brass.actions.find((action) => action.id === `read-${sample}-absorbance-action`);
    const record = brass.actions.find((action) => action.id === `record-${sample}-absorbance-action`);
    read.parameters.measurementId = measurementId;
    record.parameters.measurementId = measurementId;
    for (const prerequisite of record.prerequisites) if (prerequisite.type === "measurementRecorded") prerequisite.measurementId = measurementId;
  }

  // Physically prepare the two source-stated comparison columns before placing the
  // paired apparatus. The learner supplies the portions; the source supplies no value.
  const comparisonEquipment = [
    { id: "color-depth-unknown-tube", definitionId: "test-tube", label: "Color-depth unknown tube", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
    { id: "color-depth-standard-tube", definitionId: "test-tube", label: "Color-depth 0.400 M standard tube", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } },
  ];
  for (const definition of [brass, brassLab]) for (const item of comparisonEquipment) {
    if (!definition.initialState.equipment.some((candidate) => candidate.id === item.id)) definition.initialState.equipment.push(clone(item));
  }
  const comparisonTransfers = [
    ["fill-color-depth-unknown-action", "Fill the comparison unknown tube", "unknown-sample-tube", "color-depth-unknown-tube", "unknown"],
    ["fill-color-depth-standard-action", "Fill the comparison 0.400 M standard tube", "standard-0p400-tube", "color-depth-standard-tube", "0p400"],
  ].map(([id, label, sourceInstanceId, targetInstanceId, sampleIdentity]) => {
    const action = makeAction({ id, label, parameters: {
      sourceDefinitionId: "test-tube", sourceInstanceId, targetDefinitionId: "test-tube", targetInstanceId, sampleIdentity,
      inputMode: "numeric", inputRole: "studentResponse", inputLabel: `${label} portion (mL)`, inputMin: 0, inputMinExclusive: true, unit: "mL",
    }});
    action.verb = "transfer";
    action.volume = { source: "action-input" };
    action.interaction = { type: "pourInto", sourceDefinitionId: "test-tube", targetDefinitionId: "test-tube", accessibleLabel: label };
    return action;
  });
  comparisonTransfers.forEach((action) => addAction(brass, action));
  const placeComparison = brass.actions.find((action) => action.id === "place-color-depth-comparison-action");
  delete placeComparison.parameters.unknownTubeInstanceId;
  delete placeComparison.parameters.standardTubeInstanceId;
  const adjustStandard = brass.actions.find((action) => action.id === "visual-match-action");
  Object.assign(adjustStandard.parameters, {
    sourceInstanceId: "color-depth-standard-tube", targetInstanceId: "waste-beaker", sampleIdentity: "0p400",
    inputMode: "numeric", inputRole: "studentResponse", inputLabel: "Incremental 0.400 M standard volume removed (mL)", inputMin: 0, inputMinExclusive: true, unit: "mL",
  });
  adjustStandard.volume = { source: "action-input" };
  adjustStandard.equipmentRoleBindings["waste-receiver"] = "waste-beaker";
  adjustStandard.interaction = { type: "pourInto", sourceDefinitionId: "test-tube", targetDefinitionId: "waste-beaker", accessibleLabel: "Remove solution only from the 0.400 M comparison column into the waste beaker" };
  const unknownDepth = brass.actions.find((action) => action.id === "record-unknown-depth-action");
  const standardDepth = brass.actions.find((action) => action.id === "record-standard-depth-action");
  unknownDepth.prerequisites = [{ id: "unknown-depth-needs-match", type: "actionEvidence", label: "The one-sided standard adjustment is complete", actionId: adjustStandard.id }];
  standardDepth.prerequisites = [{ id: "standard-depth-needs-unknown-depth", type: "measurementRecorded", label: "The unknown depth was acquired separately", measurementId: "unknown-depth-mm" }];
  const visualIds = [...comparisonTransfers.map((action) => action.id), placeComparison.id, adjustStandard.id, unknownDepth.id, standardDepth.id];
  const visualNodes = replaceSegment(brass, visualIds);
  const visualConnection = brassLab.compositionConnections.find((row) => row.id === "brass-cross-29");
  if (visualConnection) visualConnection.to.portId = `entry-${visualNodes[0]}`;

  // Collect every returned Brass standard/unknown into one physical treatment vessel.
  const wasteSources = ["0p0250", "0p0500", "0p100", "0p200", "0p400", "unknown"];
  const collectActions = wasteSources.map((sample) => {
    const action = makeAction({ id: `collect-${sample}-waste-action`, label: `Collect remaining ${sample === "unknown" ? "unknown" : `${sample} M standard`} solution in the treatment beaker`, parameters: {
      sourceDefinitionId: "test-tube", sourceInstanceId: sample === "unknown" ? "unknown-sample-tube" : `standard-${sample}-tube`,
      targetDefinitionId: "waste-beaker", targetInstanceId: "waste-beaker", sampleIdentity: sample,
    }});
    action.verb = "transfer";
    action.interaction = { type: "pourInto", sourceDefinitionId: "test-tube", targetDefinitionId: "waste-beaker", accessibleLabel: action.label };
    return action;
  });
  collectActions.forEach((action) => addAction(brass, action));
  const neutralize = brass.actions.find((action) => action.id === "neutralize-waste-action");
  Object.assign(neutralize.parameters, {
    sourceInstanceId: "baking-soda-bottle", targetInstanceId: "waste-beaker",
    inputMode: "numeric", inputRole: "studentResponse", inputLabel: "Mass of this incremental sodium bicarbonate portion (g)", inputMin: 0, inputMinExclusive: true, unit: "g",
  });
  delete neutralize.mass;
  neutralize.equipmentRoleBindings = { "solid-reagent-source": "reagent-bottle", "waste-receiver": "waste-beaker" };
  neutralize.interaction = { type: "pourInto", sourceDefinitionId: "reagent-bottle", targetDefinitionId: "waste-beaker", accessibleLabel: "Add one small sodium bicarbonate portion to the collected waste" };
  const bubbling = makeAction({ id: "observe-waste-bubbling-action", label: "Observe bubbling after this bicarbonate portion", parameters: { inputMode: "choice", inputRole: "studentResponse", inputLabel: "Observed waste response" } });
  bubbling.choiceObservation = { outputCalculationId: "waste-bubbling-disposition", options: [
    { label: "Active bubbling continues", tag: "active-bubbling", value: 0 },
    { label: "Bubbling has subsided", tag: "bubbling-subsided", value: 1 },
  ] };
  bubbling.verb = "observe";
  addAction(brass, bubbling);
  const phRead = brass.actions.find((action) => action.id === "record-waste-ph-action");
  phRead.parameters.inputMin = 0; phRead.parameters.inputMax = 14; delete phRead.parameters.configurationChoice;
  phRead.prerequisites = [{ id: "ph-needs-bubbling-observation", type: "actionEvidence", label: "The bubbling disposition was recorded", actionId: bubbling.id }];
  const phDisposition = makeAction({ id: "classify-waste-ph-action", label: "Classify the measured pH for treatment or teacher-directed disposal", parameters: { inputMode: "choice", inputRole: "studentResponse", inputLabel: "Disposition from the recorded pH" } });
  phDisposition.choiceObservation = { outputCalculationId: "waste-ph-disposition", options: [
    { label: "Recorded pH is outside 5-9; retreat and read again", tag: "ph-retreat-required", value: 0 },
    { label: "Recorded pH is within 5-9", tag: "ph-within-source-range", value: 1 },
  ] };
  phDisposition.verb = "observe";
  phDisposition.prerequisites = [{ id: "ph-disposition-needs-reading", type: "measurementRecorded", label: "A fresh pH-paper reading exists", measurementId: "neutralized-waste-ph" }];
  addAction(brass, phDisposition);
  const wasteReady = makeAction({ id: "confirm-waste-ready-for-disposal-action", label: "Confirm treated waste is ready for teacher-directed disposal", parameters: { tag: "waste-ph-within-range", note: "The recorded pH is within the source-stated 5-9 range and active bubbling has subsided." } });
  wasteReady.prerequisites = [{ id: "waste-ready-needs-ph-disposition", type: "actionEvidence", label: "The pH disposition was recorded", actionId: phDisposition.id }];
  addAction(brass, wasteReady);
  const wasteIds = [...collectActions.map((action) => action.id), neutralize.id, bubbling.id, phRead.id, phDisposition.id, wasteReady.id];
  const wasteNodes = replaceSegment(brass, wasteIds);
  const bubblingToPh = brass.process.edges.find((edge) => edge.from === nodeIdFor(brass, bubbling.id) && edge.to === nodeIdFor(brass, phRead.id));
  bubblingToPh.condition = { type: "calculationResult", calculationId: "waste-bubbling-disposition", min: 1, max: 1 };
  const phToReady = brass.process.edges.find((edge) => edge.from === nodeIdFor(brass, phDisposition.id) && edge.to === nodeIdFor(brass, wasteReady.id));
  phToReady.condition = { type: "calculationResult", calculationId: "waste-ph-disposition", min: 1, max: 1 };
  brass.process.edges.push(
    { from: nodeIdFor(brass, bubbling.id), to: nodeIdFor(brass, neutralize.id), label: "Add another small portion", condition: { type: "calculationResult", calculationId: "waste-bubbling-disposition", min: 0, max: 0 } },
    { from: nodeIdFor(brass, phDisposition.id), to: nodeIdFor(brass, neutralize.id), label: "Retreat and retry pH", condition: { type: "calculationResult", calculationId: "waste-ph-disposition", min: 0, max: 0 } },
  );
  const wasteConnection = brassLab.compositionConnections.find((row) => row.id === "brass-cross-31");
  if (wasteConnection) wasteConnection.to.portId = `entry-${wasteNodes[0]}`;
  const phExit = brassLab.compositionConnections.find((row) => row.id === "brass-cross-32");
  if (phExit) phExit.from.portId = `exit-${nodeIdFor(brass, wasteReady.id)}`;

  // The teacher names the local destination; only then does a final physical transfer occur.
  const destination = { id: "teacher-designated-disposal-receiver", definitionId: "waste-beaker", label: "Teacher-designated final disposal receiver", location: "shelf", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } };
  for (const definition of [brass, brassLab]) if (!definition.initialState.equipment.some((item) => item.id === destination.id)) definition.initialState.equipment.push(clone(destination));
  const teacherGate = brassLab.actions.find((action) => action.id === "teacher-disposal-gate-action");
  Object.assign(teacherGate.parameters, { inputMode: "text", inputRole: "teacherConfiguration", inputLabel: "Teacher-designated local disposal destination", inputKey: "teacher-disposal-destination" });
  delete teacherGate.parameters.inputOptions;
  teacherGate.prerequisites = [{ id: "teacher-disposal-needs-safe-ph", type: "notebookEntry", label: "The treatment workflow recorded safe pH evidence", notebookTag: "waste-ph-within-range" }];
  const dispose = makeAction({ id: "transfer-treated-waste-to-destination-action", label: "Transfer treated waste to the teacher-designated destination", parameters: {
    sourceDefinitionId: "waste-beaker", sourceInstanceId: "waste-beaker", targetDefinitionId: "waste-beaker", targetInstanceId: destination.id,
    requiresNotebookTag: "teacher-disposal-gate", destinationProvenance: "teacher-configured",
  }, prerequisites: [{ id: "final-disposal-needs-teacher-destination", type: "notebookEntry", label: "Teacher recorded the local destination", notebookTag: "teacher-disposal-gate" }] });
  dispose.verb = "transfer";
  dispose.interaction = { type: "pourInto", sourceDefinitionId: "waste-beaker", targetDefinitionId: "waste-beaker", accessibleLabel: dispose.label };
  addAction(brass, dispose);
  brassLab.compositionConnections = brassLab.compositionConnections.filter((row) => row.id !== "brass-cross-33");
  brassLab.compositionConnections.push({ id: "brass-cross-33", from: { kind: "lab-node", nodeId: nodeIdFor(brassLab, teacherGate.id) }, to: { kind: "technique-port", instanceId: brass.id, portId: `entry-${nodeIdFor(brass, dispose.id)}` }, label: "Use the configured destination", condition: { type: "validationPassed" } });

  blue.metadata.updatedAt = brass.metadata.updatedAt = blueLab.metadata.updatedAt = brassLab.metadata.updatedAt = "2026-09-04T00:00:00.000Z";
  blue.composition = compositionFor(blue);
  brass.composition = compositionFor(brass, "brass-colorimetry");
  for (const role of [...blue.composition.equipmentRoles, ...brass.composition.equipmentRoles]) role.required = true;
  blue.composition.configurationSlots = [{ id: "calibrationRegressionCalculationId", valueType: "string", required: true }];
  brass.composition.configurationSlots = [{ id: "wavelengthMeasurementId", valueType: "string", required: true }, { id: "measurementCuvetteInstanceId", valueType: "string", required: true }];
  blueInstance.preserveIds.actions = Object.fromEntries(blue.actions.map((action) => [action.id, action.id]));
  blueInstance.preserveIds.nodes = Object.fromEntries(blue.process.nodes.map((node) => [node.id, node.id]));
  const brassInstance = brassLab.techniqueInstances.find((instance) => instance.techniqueId === brass.id);
  brassInstance.preserveIds.actions = Object.fromEntries(brass.actions.map((action) => [action.id, action.id]));
  brassInstance.preserveIds.nodes = Object.fromEntries(brass.process.nodes.map((node) => [node.id, node.id]));
  await writeJson("public/techniques/blue1-percent-transmittance.json", blue);
  await writeJson("public/labs/blue1-spectroscopy.json", blueLab);
  await writeJson("public/techniques/brass-spectrophotometry.json", brass);
  await writeJson("public/labs/brass-colorimetry.json", brassLab);
};

const emitGeneratorInputs = async () => {
  const beers = await readJson("public/techniques/beers-law-calibration.json");
  const brass = await readJson("public/techniques/brass-spectrophotometry.json");
  const transmittance = await readJson("public/techniques/transmittance-dilution.json");
  const moduleLiteral = (value) => JSON.stringify(value, null, 2);
  await writeFile("scripts/generatorInputs/apChem/spectroscopy.mjs", `/** Cycle 05-owned spectroscopy definitions. Generated from the reviewed revision-5 migration; keep this module data-only. */\nconst definitions = new Map(${moduleLiteral([[beers.id, beers], [brass.id, brass]])});\n\nexport const refineSpectroscopyDefinition = (definition) => structuredClone(definitions.get(definition.id) ?? definition);\n`);
  await writeFile("scripts/generatorInputs/simulator/transmittanceDilution.mjs", `/** Cycle 05-owned transmittance-dilution definition. Generated from the reviewed revision-5 migration; keep this module data-only. */\nconst definition = ${moduleLiteral(transmittance)};\n\nexport const refineTransmittanceDilutionDefinition = (candidate) => candidate.id === definition.id ? structuredClone(definition) : candidate;\n`);
};

const wireLabEquipmentBindings = async () => {
  for (const labId of ["blue1-spectroscopy", "brass-colorimetry"]) {
    const lab = await readJson(`public/labs/${labId}.json`);
    const labInstances = new Map(lab.initialState.equipment.map((item) => [item.id, item]));
    for (const instance of lab.techniqueInstances) {
      const path = `public/techniques/${instance.techniqueId}.json`;
      const technique = await readJson(path);
      if (instance.techniqueId === "brass-spectrophotometry") {
        const candidates = {
          "photometer-instrument": ["spectrophotometer"],
          "balance-instrument": ["balance"],
          "weighed-vessel": ["brass-beaker"],
          "weighed-sample-source": ["brass-sample-vial"],
          "receiving-vessel": ["brass-beaker", "unknown-volumetric-flask", "standard-0p400-tube", "standard-0p200-tube", "standard-0p100-tube", "standard-0p0500-tube", "standard-0p0250-tube", "unknown-sample-tube"],
          "measured-solvent-source": ["unknown-volumetric-flask", "digest-water-cylinder"],
          "mixture-source": ["brass-beaker"],
          "rinse-water-source": ["wash-bottle"],
          "rinsed-vessel": ["brass-beaker"],
          "liquid-source": ["wash-bottle", "copper-standard-stock"],
          "final-volume-vessel": ["unknown-volumetric-flask", "standard-0p400-tube", "standard-0p200-tube", "standard-0p100-tube", "standard-0p0500-tube", "standard-0p0250-tube"],
          "variable-volume-measuring-device": ["graduated-pipette", "digest-water-cylinder"],
          "photometer-sample-holder": ["measurement-cuvette", "salt-a-scan-cuvette", "salt-b-scan-cuvette"],
          "sample-source": ["standard-0p400-tube", "standard-0p200-tube", "standard-0p100-tube", "standard-0p0500-tube", "standard-0p0250-tube", "unknown-sample-tube"],
          "provenance-matched-sample-receiver": ["standard-0p400-tube", "standard-0p200-tube", "standard-0p100-tube", "standard-0p0500-tube", "standard-0p0250-tube", "unknown-sample-tube", "assigned-salt-a-solution", "assigned-salt-b-solution", "color-depth-unknown-tube", "color-depth-standard-tube"],
          "color-depth-comparison-apparatus": ["color-depth-comparison"],
          "solid-reagent-source": ["baking-soda-bottle"],
          "waste-receiver": ["waste-beaker", "teacher-designated-disposal-receiver"],
          "ph-indicator-medium": ["ph-paper"],
        };
        candidates["sample-source"].push("assigned-salt-a-solution", "assigned-salt-b-solution");
        technique.initialState.equipment = [];
        instance.bindings.equipment = {};
        for (const role of technique.composition.equipmentRoles) {
          const ids = candidates[role.roleId] ?? [];
          if (!ids.length) throw new Error(`No concrete brass binding candidates for required role ${role.roleId}.`);
          const mappings = ids.map((labInstanceId, index) => {
            const item = labInstances.get(labInstanceId);
            if (!item || !role.allowedDefinitionIds.includes(item.definitionId)) {
              throw new Error(`Invalid concrete brass binding ${role.roleId} -> ${labInstanceId}/${item?.definitionId}.`);
            }
            const sourceInstanceId = labInstanceId;
            technique.initialState.equipment.push(clone(item));
            return { sourceInstanceId, definitionId: item.definitionId, instanceId: labInstanceId };
          });
          role.sourceInstanceIds = mappings.map((mapping) => mapping.sourceInstanceId);
          instance.bindings.equipment[role.roleId] = mappings.length === 1
            ? { definitionId: mappings[0].definitionId, instanceId: mappings[0].instanceId }
            : { sourceInstances: mappings };
        }
        technique.initialState.equipment = [...new Map(technique.initialState.equipment.map((item) => [item.id, item])).values()];
        instance.bindings.configuration = {
          wavelengthMeasurementId: "brass-spectrophotometry--approved-wavelength-nm",
          measurementCuvetteInstanceId: "measurement-cuvette",
        };
        // Revision 5 permits the same authored source instance to occupy compatible
        // sequential roles when every role preserves the exact source -> target pair.
        // Keep these original identities; never manufacture role-scoped aliases.
        const actionIds = new Set(technique.actions.map((action) => action.id));
        const nodeIds = new Set(technique.process.nodes.map((node) => node.id));
        instance.preserveIds.actions = Object.fromEntries(Object.entries(instance.preserveIds.actions).filter(([sourceId]) => actionIds.has(sourceId)));
        instance.preserveIds.nodes = Object.fromEntries(Object.entries(instance.preserveIds.nodes).filter(([sourceId]) => nodeIds.has(sourceId)));
        await writeJson(path, technique);
        continue;
      }
      const referenced = new Set();
      const collect = (value, key = "") => {
        if (Array.isArray(value)) return value.forEach((item) => collect(item, key));
        if (value && typeof value === "object") return Object.entries(value).forEach(([childKey, child]) => collect(child, childKey));
        if (typeof value === "string" && /InstanceId$/.test(key)) referenced.add(value);
      };
      technique.actions.forEach((action) => collect(action));
      for (const sourceId of referenced) {
        if (!technique.initialState.equipment.some((item) => item.id === sourceId) && labInstances.has(sourceId)) {
          technique.initialState.equipment.push(clone(labInstances.get(sourceId)));
        }
      }
      const techniqueInstances = new Map(technique.initialState.equipment.map((item) => [item.id, item]));
      const roleSources = new Map(technique.composition.equipmentRoles.map((role) => [role.roleId, new Set()]));
      const parameterPreference = (roleId) => {
        if (/instrument/.test(roleId)) return ["photometerInstanceId", "instrumentInstanceId", "targetInstanceId", "equipmentInstanceId"];
        if (/sample-holder/.test(roleId)) return ["cuvetteInstanceId", "equipmentInstanceId", "targetInstanceId", "sourceInstanceId"];
        if (/source/.test(roleId)) return ["sourceInstanceId", "equipmentInstanceId"];
        if (/receiver|vessel|medium/.test(roleId)) return ["targetInstanceId", "equipmentInstanceId", "sourceInstanceId"];
        if (/measuring-device/.test(roleId)) return ["targetInstanceId", "sourceInstanceId", "equipmentInstanceId"];
        return ["sourceInstanceId", "targetInstanceId", "equipmentInstanceId", "cuvetteInstanceId", "photometerInstanceId", "instrumentInstanceId"];
      };
      for (const action of technique.actions) {
        for (const [roleId, definitionId] of Object.entries(action.equipmentRoleBindings ?? {})) {
          const candidates = parameterPreference(roleId)
            .map((key) => action.parameters?.[key])
            .filter((value) => typeof value === "string")
            .filter((sourceId) => techniqueInstances.get(sourceId)?.definitionId === definitionId);
          if (candidates.length) roleSources.get(roleId)?.add(candidates[0]);
        }
      }
      for (const role of technique.composition.equipmentRoles) {
        role.sourceInstanceIds = [...(roleSources.get(role.roleId) ?? [])];
      }
      instance.bindings.equipment = {};
      for (const role of technique.composition.equipmentRoles.filter((candidate) => candidate.sourceInstanceIds.length)) {
        const mappings = role.sourceInstanceIds.map((sourceInstanceId) => {
          const source = techniqueInstances.get(sourceInstanceId);
          const target = labInstances.get(sourceInstanceId);
          if (!target || target.definitionId !== source.definitionId) throw new Error(`${labId} lacks identity equipment binding for ${sourceInstanceId}.`);
          return { sourceInstanceId, definitionId: target.definitionId, instanceId: target.id };
        });
        instance.bindings.equipment[role.roleId] = mappings.length === 1
          ? { definitionId: mappings[0].definitionId, instanceId: mappings[0].instanceId }
          : { sourceInstances: mappings };
      }
      for (const role of technique.composition.equipmentRoles.filter((candidate) => candidate.required && !instance.bindings.equipment[candidate.roleId])) {
        const target = [...labInstances.values()].find((item) => role.allowedDefinitionIds.includes(item.definitionId));
        if (!target) throw new Error(`${labId} lacks a concrete binding for required role ${role.roleId}.`);
        instance.bindings.equipment[role.roleId] = { definitionId: target.definitionId, instanceId: target.id };
      }
      await writeJson(path, technique);
    }
    for (const item of lab.initialState.equipment) if (item.contents?.visualState === "blue-solution") item.contents.visualState = "blue-dye-solution";
    await writeJson(`public/labs/${labId}.json`, lab);
  }
};

const emitOverlays = async () => {
  await mkdir(`${planningRoot}/evidence/lane-05`, { recursive: true });
  const techniques = await Promise.all(techniqueIds.map((id) => readJson(`public/techniques/${id}.json`)));
  const labs = await Promise.all([readJson("public/labs/blue1-spectroscopy.json"), readJson("public/labs/brass-colorimetry.json")]);
  const identity = {
    baselineRevision: 5,
    baselineManifestSha256: "08a8871d51e35967ac994510c9948ab9ac1aad3cc4c021f6d227ae2ed14574cd",
    baselineAggregateSha256: baseline.aggregateSha256,
    impactManifestSha256: "b1a421670e3681de1c4f821d656ed03e550634a5d487c28053f90d331d2df1c4",
  };
  const locatorFor = (owner, actionId) => {
    const blue = (step, basis = "M", sourceTable = "phase") => ({ sourceFile: sourceFiles.blue1, sourceTable, step, basis });
    const brass = (step, basis = "M", sourceTable = "phase") => ({ sourceFile: sourceFiles.brass, sourceTable, step, basis });
    if (owner === "technique:brass-spectrophotometry" || owner === "lab:brass-colorimetry") {
      if (/^scan-set-/.test(actionId)) return brass("P-02");
      if (/^scan-(?:condition|fill|prepare|insert)-/.test(actionId)) return brass("P-03", "M/R");
      if (/^scan-(?:remove|return)-/.test(actionId)) return brass("P-04", "M/R");
      if (/^scan-read-/.test(actionId)) return brass("P-03");
      if (/^scan-record-/.test(actionId)) return brass("P-04");
      if (/tare-empty/.test(actionId)) return brass("BRASS-00", "F/R", "apparatus");
      if (/place-brass/.test(actionId)) return brass("B-03");
      if (/weigh-brass/.test(actionId)) return brass("B-01");
      if (/transfer-digest/.test(actionId)) return brass("B-08");
      if (/rinse-beaker/.test(actionId)) return brass("B-09");
      if (/transfer-rinse/.test(actionId)) return brass("B-10");
      if (/dilute-unknown/.test(actionId)) return brass("B-11");
      if (/transfer-prepared-unknown-to-original-tube/.test(actionId)) return brass("S-05", "R");
      if (/standard-.*stock-transfer/.test(actionId)) return brass("D-02");
      if (/standard-.*dilute/.test(actionId)) return brass("D-03");
      if (/approved-wavelength|teacher-wavelength-approval/.test(actionId)) return brass(actionId.includes("teacher-") ? "S-02" : "S-01");
      if (/calibrate-zero/.test(actionId)) return brass("S-03");
      if (/remove-blank/.test(actionId)) return brass("S-05");
      if (/prepare-blank|blank-wipe|insert-blank|calibrate-hundred/.test(actionId)) return brass("S-04");
      if (/^condition-/.test(actionId)) return brass("S-05");
      if (/^(fill-|prepare-.*optical-faces|insert-.*cuvette)/.test(actionId)) return brass("S-06");
      if (/^read-.*absorbance/.test(actionId)) return brass("S-07");
      if (/^record-.*absorbance/.test(actionId)) return brass("S-08");
      if (/^remove-.*cuvette|^return-/.test(actionId)) return brass("S-09");
      if (/calibration-table-check|calibration-slope|calibration-intercept|calibration-r-squared/.test(actionId)) return brass(actionId === "calibration-table-check-action" ? "A-01" : "A-02");
      if (/spectrometric-unknown-molarity/.test(actionId)) return brass("A-03");
      if (/place-color-depth/.test(actionId)) return brass("V-01");
      if (/visual-match/.test(actionId)) return brass("V-02", "M/F");
      if (/record-(?:unknown|standard)-depth/.test(actionId)) return brass("V-03", "M/F");
      if (/visual-unknown-molarity/.test(actionId)) return brass("V-04", "M/F");
      if (/neutralize-waste|record-waste-ph|teacher-disposal-gate/.test(actionId)) return brass("S-08", "M/C", "safety");
      if (/record-brass-mass/.test(actionId)) return brass("B-02", "R");
      if (/minimum-hno3/.test(actionId)) return brass("B-04");
      if (/teacher-add-acid/.test(actionId)) return brass("B-05");
      if (/teacher-cover-digest/.test(actionId)) return brass("B-06");
      if (/confirm-teacher-diluted-digest/.test(actionId)) return brass("B-07");
      if (/standard-.*aliquot/.test(actionId)) return brass("D-01");
      if (/teacher-standard-approval/.test(actionId)) return brass("D-04");
      if (/spectrometric-copper|visual-copper|method-percent|class-|compare-method|justify-method/.test(actionId)) return brass("A-03", "M/C");
      if (/safety-ppe/.test(actionId)) return brass("S-01", "M", "safety");
      if (/safety-hazards/.test(actionId)) return brass("S-05", "M", "safety");
      if (/safety-hood/.test(actionId)) return brass("S-04", "M", "safety");
      return brass("S-10", "M/R");
    }
    if (owner === "technique:transmittance-dilution" || owner === "technique:beers-law-calibration") {
      if (/place-volumetric-flask/.test(actionId)) return blue("P-03", "R");
      if (/place-graduated-cylinder/.test(actionId)) return blue("P-03", "R");
      if (/measure-stock/.test(actionId)) return blue("P-03");
      if (/transfer-(?:dye-aliquot|stock-dye)/.test(actionId)) return blue("P-04");
      if (/measure-water/.test(actionId)) return blue("P-05");
      if (/add-water-below-mark|dilute-standard/.test(actionId)) return blue("P-06", "M/R");
      if (/place-spectrophotometer/.test(actionId)) return blue("P-08", "R/C");
      if (/configure-photometer/.test(actionId)) return blue("P-01");
      if (/blank/.test(actionId)) return blue("P-08", "R/C");
      if (/sample-cuvette|standard-cuvette|standard-optical-faces/.test(actionId)) return blue("P-09", "M/R");
      if (/read-percent-transmittance/.test(actionId)) return blue("P-10");
      if (/record-percent-transmittance|calculate-decimal-transmittance/.test(actionId)) return blue("P-11");
      if (/calculate-absorbance/.test(actionId)) return blue("A-03");
      if (/calculate-diluted-concentration/.test(actionId)) return blue("P-07");
    }
    if (owner === "technique:blue1-class-calibration") {
      if (/record-provenance/.test(actionId)) return blue("A-01");
      if (/calculate-decimal-t/.test(actionId)) return blue("P-11");
      if (/calculate-absorbance/.test(actionId)) return blue("A-03");
      if (/plot-decimal-t/.test(actionId)) return blue("A-02");
      if (/^i1-plot-/.test(actionId)) return blue("A-03");
      return blue("A-04", "M/C");
    }
    if (/record-stock-concentration|record-dilution-assignments|record-wavelength|configure-photometer/.test(actionId)) return blue("P-01");
    if (/label/.test(actionId)) return blue("P-02", "R");
    if (/confirm-zero-stock/.test(actionId)) return blue("P-03");
    if (/confirm-zero-water/.test(actionId)) return blue("P-05");
    if (/measure-stock|measure-stock-dye/.test(actionId)) return blue("P-03");
    if (/transfer-stock|transfer-dye-aliquot/.test(actionId)) return blue("P-04");
    if (/measure-water/.test(actionId)) return blue("P-05");
    if (/transfer-water|mix|dilute-standard|add-water-below-mark/.test(actionId)) return blue("P-06", "M/R");
    if (/calculate-concentration|calculate-diluted-concentration/.test(actionId)) return blue("P-07");
    if (/blank|place-spectrophotometer|zero-instrument|record-blank-cuvette-rule/.test(actionId)) return blue("P-08", "R/C");
    if (/fill-cuvette|condition-orient|optical-faces|insert-cuvette|remove-cuvette|standard-cuvette|sample-cuvette/.test(actionId)) return blue("P-09", "M/R");
    if (/read-percent|read-unknown|read-diluted/.test(actionId)) return blue(actionId.includes("unknown") ? "I-04" : "P-10");
    if (/record-percent|record-provenance|record-unknown-percent|record-diluted/.test(actionId)) return blue(actionId.includes("unknown") ? "I-04" : "P-11");
    if (/record-confirmed-calibration|record-source-ambiguity|plot-|calculate-decimal|calculate-absorbance/.test(actionId)) return blue("A-04", "M/C");
    if (/identify-unknown/.test(actionId)) return blue("I-01");
    if (/submit-inquiry-plan/.test(actionId)) return blue("I-02", "M/C");
    if (/record-inquiry-approval/.test(actionId)) return blue("I-03", "C");
    if (/record-unknown-reading-set/.test(actionId)) return blue("I-04");
    if (/record-dilution-factor/.test(actionId)) return blue("I-05", "R/C");
    if (/prepare-unknown|transfer-approved-unknown|fill-unknown|insert-unknown|remove-unknown/.test(actionId)) return blue("I-04");
    if (/over-range|diluted-unknown|classify-unknown-range|confirm-in-range/.test(actionId)) return blue("I-05", "R/C");
    if (/original-molarity/.test(actionId)) return blue("I-06");
    if (/mass-500ml|molar-mass/.test(actionId)) return blue("I-07", actionId.includes("reference") ? "C" : "M");
    if (/justify|postlab|uncertainty/.test(actionId)) return blue("I-08");
    if (/safety/.test(actionId)) return blue("S-01", "M", "safety");
    return blue("A-01");
  };
  const currentTechniqueRows = techniques.flatMap((technique) => technique.actions.map((action) => ({
    rowId: `${technique.id}@${technique.metadata.version}#${action.id}`,
    baselineRowIdentity: techniqueAudit.rows.find((row) => row.techniqueId === technique.id && row.actionId === action.id)?.rowId ?? null,
    techniqueId: technique.id, techniqueVersion: technique.metadata.version, actionId: action.id,
    atomId: action.atomId ?? null,
    ...locatorFor(`technique:${technique.id}`, action.id),
    disposition: "owned-final-action",
    effectDecision: action.atomId ? atoms.get(action.atomId).effectContract : technique.composition.legacyActionEffects.find((row) => row.actionId === action.id).effect,
    configurationWitness: "bound by the owning lab instance or retained as an explicit configured source value; no expected result literal",
    sourceConflictDisposition: technique.id.startsWith("blue1") || technique.id === "transmittance-dilution" || technique.id === "beers-law-calibration"
      ? "Investigation 1 M/F governs; R/C blank, wavelength, cuvette, replicate, and transformation choices remain configured."
      : "Investigation 2 M/F governs; wavelength, retry tolerance, digestion gate, and final disposal remain configured.",
    evaluated: true,
  })));
  const techniqueRows = currentTechniqueRows;
  const labRows = labs.flatMap((lab) => [
    ...lab.process.nodes.map((node) => ({
    rowId: `${lab.id}#${node.id}`,
    baselineRowIdentity: labAudit.rows.find((row) => row.labId === lab.id && row.nodeId === node.id)?.rowId ?? null,
    labId: lab.id, nodeId: node.id, actionId: node.actionId,
    ...locatorFor(`lab:${lab.id}`, node.actionId), disposition: "retained-lab-analysis-or-orchestration",
    finalOrigin: { kind: "lab-local", rationale: "calculation, analysis, approval, reflection, or pedagogical orchestration remains lab-owned" },
    effectDecision: auditEffect("lab", lab.id, node.actionId),
      configurationWitnesses: ["default"], sourceConflictDisposition: "No M/F value is replaced by an expected or simulator-truth literal.", evaluated: true,
    })),
    ...lab.techniqueInstances.flatMap((instance) => {
    const technique = techniques.find((item) => item.id === instance.techniqueId);
    return technique.process.nodes.map((node) => {
      const action = technique.actions.find((candidate) => candidate.id === node.actionId);
      const effectDecision = action?.atomId
        ? atoms.get(action.atomId).effectContract
        : technique.composition.legacyActionEffects.find((row) => row.actionId === node.actionId)?.effect;
      const classes = effectDecision?.classes ?? [];
      const semanticDisposition = classes.includes("apparatus-material-instrument-state")
        ? "Technique-owned physical state transition using the exact configured equipment and material instance."
        : classes.includes("measurement-direct-observation-acquisition")
          ? "Technique-owned acquisition from the named instrument and prepared sample state; recording remains separate."
          : classes.includes("evidence-recording")
            ? "Technique-owned evidence recording of a previously acquired or configured value; no physical state change is claimed."
            : classes.includes("calculation-analysis")
              ? "Technique-owned calculation or analysis derived from recorded evidence; no acquisition or physical state change is claimed."
              : "Technique-owned pedagogical or configuration orchestration; no physical or acquisition effect is claimed.";
      return ({
      rowId: `${lab.id}#${node.id}`, baselineRowIdentity: labAudit.rows.find((row) => row.labId === lab.id && row.nodeId === node.id)?.rowId ?? null,
      labId: lab.id, nodeId: node.id, actionId: node.actionId,
      ...locatorFor(`technique:${instance.techniqueId}`, node.actionId), disposition: "technique-instance-operation",
      finalOrigin: { kind: "technique-instance", instanceId: instance.instanceId, techniqueId: instance.techniqueId, version: instance.version, atomId: action?.atomId ?? null },
      effectDecision,
      configurationWitnesses: ["exact technique-instance equipment and configuration binding"], sourceConflictDisposition: semanticDisposition, evaluated: true,
    });
    });
    }),
  ]);
  const techniqueTraceRows = techniques.flatMap((technique) => technique.actions.map((action) => ({
    rowId: `technique:${technique.id}#${action.id}`, owner: `technique:${technique.id}`, actionId: action.id,
    ...locatorFor(`technique:${technique.id}`, action.id),
    atomId: action.atomId ?? null,
    disposition: "owned-addition-or-replacement", evaluated: true,
  })));
  const retainedLabTraceRows = labs.flatMap((lab) => lab.actions.map((action) => ({
    rowId: `lab:${lab.id}#${action.id}`, owner: `lab:${lab.id}`, actionId: action.id,
    ...locatorFor(`lab:${lab.id}`, action.id),
    atomId: null,
    disposition: "owned-retained-lab-key", evaluated: true,
  })));
  const traceRows = [...techniqueTraceRows, ...retainedLabTraceRows];
  for (const row of techniqueRows) {
    row.replacementLocator = {
      owner: `technique:${row.techniqueId}`,
      actionId: row.actionId,
      sourceFile: row.sourceFile,
      sourceTable: row.sourceTable,
      step: row.step,
      basis: row.basis,
      atomId: row.atomId,
    };
  }
  for (const row of labRows) {
    row.atomId = row.finalOrigin?.atomId ?? null;
    row.replacementLocator = {
      owner: row.finalOrigin?.kind === "technique-instance" ? `technique:${row.finalOrigin.techniqueId}` : `lab:${row.labId}`,
      actionId: row.actionId,
      nodeId: row.nodeId,
      sourceFile: row.sourceFile,
      sourceTable: row.sourceTable,
      step: row.step,
      basis: row.basis,
      atomId: row.atomId,
    };
  }
  for (const row of traceRows) {
    row.replacementLocator = {
      owner: row.owner,
      actionId: row.actionId,
      sourceFile: row.sourceFile,
      sourceTable: row.sourceTable,
      step: row.step,
      basis: row.basis,
      atomId: row.atomId,
    };
  }
  const currentTraceKeys = new Set(traceRows.map((row) => `${row.owner}#${row.actionId}`));
  const frozenLaneTraces = sourceTrace.traces.map((row) => ({ ...row, owner: `${row.ownerType}:${row.ownerId}` })).filter((row) => ["lab:blue1-spectroscopy", "lab:brass-colorimetry", ...techniqueIds.map((id) => `technique:${id}`)].includes(row.owner));
  const replacementFor = (row, disposition = "exact-current-action-replacement") => {
    const ownerId = row.owner.split(":").slice(1).join(":");
    const action = row.owner.startsWith("technique:")
      ? techniques.find((technique) => technique.id === ownerId)?.actions.find((candidate) => candidate.id === row.actionId)
      : labs.find((lab) => lab.id === ownerId)?.actions.find((candidate) => candidate.id === row.actionId);
    const effect = action?.atomId ? atoms.get(action.atomId)?.effectContract
      : row.owner.startsWith("lab:") ? auditEffect("lab", ownerId, row.actionId)
        : techniques.find((technique) => technique.id === ownerId)?.composition.legacyActionEffects.find((candidate) => candidate.actionId === row.actionId)?.effect;
    return {
      owner: row.owner, actionId: row.actionId, sourceFile: row.sourceFile, sourceTable: row.sourceTable,
      step: row.step, basis: row.basis, disposition, atomId: row.atomId ?? null, effect,
    };
  };
  const missingCurrentTraces = traceRows.filter((row) => row.atomId && !frozenLaneTraces.some((frozen) => frozen.owner === row.owner && frozen.actionId === row.actionId)).map((row) => ({
    owner: row.owner, actionId: row.actionId, replacementLocator: replacementFor(row, "exact-current-atom-backed-action"),
  }));
  const obsoleteLabOwnerTraces = frozenLaneTraces.filter((row) => row.owner.startsWith("lab:") && !currentTraceKeys.has(`${row.owner}#${row.actionId}`)).map((row) => {
    const exact = traceRows.find((candidate) => candidate.actionId === row.actionId && candidate.sourceFile === row.sourceFile && candidate.sourceTable === row.sourceTable && candidate.step === row.step);
    if (!exact) throw new Error(`Obsolete lab trace ${row.owner}#${row.actionId} has no exact source-located replacement.`);
    return { frozenOwner: row.owner, frozenActionId: row.actionId, frozenLocator: { sourceFile: row.sourceFile, sourceTable: row.sourceTable, step: row.step, basis: row.basis }, reviewedDisposition: "moved-with-same-public-action-id-to-technique-ownership", replacements: [replacementFor(exact)] };
  });
  const obsoleteAtomExamples = [...atoms.values()].flatMap((atom) => (atom.contentExamples ?? []).filter((example) => ["lab:blue1-spectroscopy", "lab:brass-colorimetry"].includes(example.owner) && !currentTraceKeys.has(`${example.owner}#${example.actionId}`)).map((example) => {
    const exact = traceRows.find((row) => row.actionId === example.actionId && row.atomId === atom.id);
    if (!exact) throw new Error(`Obsolete atom example ${atom.id}/${example.owner}#${example.actionId} has no exact atom/action replacement.`);
    return { atomId: atom.id, frozenOwner: example.owner, frozenActionId: example.actionId, reviewedDisposition: "same-atom-and-public-action-id-moved-to-technique-ownership", replacements: [replacementFor(exact)] };
  }));
  const reviewStopTransmittanceIds = ["place-volumetric-flask", "place-graduated-cylinder", "measure-stock-dye", "transfer-dye-aliquot", "add-water-below-mark", "swirl-flask", "top-up-to-mark", "stopper-flask", "invert-to-mix", "place-spectrophotometer", "fill-blank-cuvette", "wipe-blank-cuvette", "zero-with-blank", "fill-sample-cuvette", "wipe-orient-sample-cuvette", "insert-sample-cuvette", "record-percent-transmittance", "calculate-decimal-transmittance", "calculate-absorbance", "calculate-diluted-concentration"];
  const reviewStopBeersIds = ["place-spectrophotometer", "measure-stock-dye", "transfer-stock-dye", "dilute-standard", "transfer-standard-cuvette", "record-percent-transmittance", "calculate-absorbance"];
  const currentByOwner = new Map(techniques.map((technique) => [`technique:${technique.id}`, technique.actions.map((action) => action.id)]));
  const oldBrassIds = currentByOwner.get("technique:brass-spectrophotometry").filter((actionId) =>
    !/^scan-set-/.test(actionId) && !/-salt-b-action$/.test(actionId) && !/^(?:fill-.*-cuvette|prepare-.*-optical-faces|insert-.*-cuvette|remove-.*-cuvette)-action$/.test(actionId));
  const oldBluePercentIds = currentByOwner.get("technique:blue1-percent-transmittance").filter((actionId) =>
    !["i1-prepare-unknown-under-approved-plan", "i1-fill-unknown-cuvette", "i1-prepare-unknown-optical-faces", "i1-record-unknown-percent-t", "i1-record-over-range-response", "i1-fill-diluted-unknown-cuvette", "i1-prepare-diluted-unknown-optical-faces", "i1-insert-diluted-unknown-cuvette", "i1-read-diluted-unknown-percent-t", "i1-record-diluted-unknown-percent-t", "i1-remove-diluted-unknown-cuvette"].includes(actionId));
  const reviewStopKeys = [
    ...reviewStopTransmittanceIds.map((actionId) => ({ owner: "technique:transmittance-dilution", actionId })),
    ...reviewStopBeersIds.map((actionId) => ({ owner: "technique:beers-law-calibration", actionId })),
    ...currentByOwner.get("technique:blue1-standard-dilutions").map((actionId) => ({ owner: "technique:blue1-standard-dilutions", actionId })),
    ...oldBluePercentIds.map((actionId) => ({ owner: "technique:blue1-percent-transmittance", actionId })),
    ...currentByOwner.get("technique:blue1-class-calibration").map((actionId) => ({ owner: "technique:blue1-class-calibration", actionId })),
    ...oldBrassIds.map((actionId) => ({ owner: "technique:brass-spectrophotometry", actionId })),
    ...[...labs.find((lab) => lab.id === "blue1-spectroscopy").actions.map((action) => action.id), "i1-prepare-unknown-under-approved-plan", "i1-record-over-range-response"].map((actionId) => ({ owner: "lab:blue1-spectroscopy", actionId })),
    ...[...labs.find((lab) => lab.id === "brass-colorimetry").actions.filter((action) => action.id !== "confirm-teacher-diluted-digest-action").map((action) => action.id), "teacher-add-water-action", "mix-unknown-action", "standard-0p400-mix-action", "standard-0p200-mix-action", "standard-0p100-mix-action", "standard-0p0500-mix-action", "standard-0p0250-mix-action", "cleanup-action"].map((actionId) => ({ owner: "lab:brass-colorimetry", actionId })),
  ];
  const reviewStopAtomBackedKeys = reviewStopKeys.filter((key) =>
    !["technique:transmittance-dilution", "technique:beers-law-calibration"].includes(key.owner) &&
    traceRows.some((row) => row.owner === key.owner && row.actionId === key.actionId && row.atomId));
  const reviewStopMissingTraces = reviewStopAtomBackedKeys.filter((key) => !frozenLaneTraces.some((row) => row.owner === key.owner && row.actionId === key.actionId)).map((key) => {
    const locator = locatorFor(key.owner, key.actionId);
    const exact = traceRows.find((row) => row.owner === key.owner && row.actionId === key.actionId);
    if (!exact) throw new Error(`Review-stop action ${key.owner}#${key.actionId} has no exact current replacement.`);
    return { reviewStopOwner: key.owner, reviewStopActionId: key.actionId, reviewStopLocator: locator, reviewedDisposition: "exact-current-action-locator", replacements: [replacementFor(exact)] };
  });
  const reviewStopInvalidScanTraceRebindings = reviewStopMissingTraces.filter((row) => /^scan-read-\d+-action$/.test(row.reviewStopActionId));
  const reviewStopMissingTraceReplacements = reviewStopMissingTraces.filter((row) => !/^scan-read-\d+-action$/.test(row.reviewStopActionId));
  await writeJson(`${planningRoot}/evidence/lane-05/technique-atomicity-overlay.json`, { schema: "lab-studio/technique-atomicity-overlay@1", lane: "05", ...identity, baselineAuditSha256: baseline.contractDependencies.atomicityAuditSha256, owners: techniqueIds.map((id) => `technique:${id}`), rows: techniqueRows });
  await writeJson(`${planningRoot}/evidence/lane-05/lab-composition-overlay.json`, { schema: "lab-studio/lab-composition-overlay@1", lane: "05", ...identity, baselineAuditSha256: baseline.contractDependencies.labCompositionAuditSha256, owners: labs.map((lab) => `lab:${lab.id}`), rows: labRows });
  await writeJson(`${planningRoot}/evidence/lane-05/source-trace-overlay.json`, { schema: "lab-studio/source-trace-overlay@1", lane: "05", ...identity, frozenRegistrySha256: baseline.contractDependencies.sourceTraceRegistrySha256, frozenTraceCount: sourceTrace.traces.length, owners: [...techniqueIds.map((id) => `technique:${id}`), ...labs.map((lab) => `lab:${lab.id}`)], reconciliation: { reviewStopMissingTraceReplacements, reviewStopInvalidScanTraceRebindings, missingCurrentTraces, obsoleteLabOwnerTraces, obsoleteAtomExamples }, rows: traceRows });
};

await migrateBlue();
await migrateBrass();
await promoteBrassStandardMeasurements();
await refineGenerated();
await stripHiddenOutputs();
await repairSourceFidelity();
await secondMediumRepair();
await fourthMediumRepair();
await revisionFiveLaneReplay();
await applyConsolidatedXhighCorrections();
await wireLabEquipmentBindings();
await emitGeneratorInputs();
await emitOverlays();
console.log("Cycle 05 spectroscopy migration written: 6 techniques, 2 labs, 3 overlays.");
