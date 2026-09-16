import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const planRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const laneRoot = join(root, planRoot, "evidence", "lane-08");
mkdirSync(laneRoot, { recursive: true });

const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const sha256 = (path) => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
const write = (name, value) => writeFileSync(join(laneRoot, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
const baselinePath = `${planRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`;
const baseline = read(baselinePath);
const registry = read("src/domain/atomRegistry.json");
const traces = read("docs/architecture/source-trace-registry.json");
const techniqueAudit = read(`${planRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`);
const labAudit = read(`${planRoot}/LAB_COMPOSITION_AUDIT.json`);

const techniqueIds = [
  "marble-gas-syringe-kinetics",
  "crystal-violet-micromolar-dilution-series",
  "crystal-violet-spectrophotometer-calibration",
  "crystal-violet-integrated-rate-law-comparison",
  "crystal-violet-waste-treatment",
  "crystal-violet-kinetics",
];
const labIds = ["marble-statue-kinetics", "crystal-violet-rate-law"];
const carrierId = "crystal-violet-hydroxide-order-extension";
const techniques = new Map(techniqueIds.map((id) => [id, read(`public/techniques/${id}.json`)]));
const labs = new Map(labIds.map((id) => [id, read(`public/labs/${id}.json`)]));
const atoms = new Map(registry.atoms.map((atom) => [atom.id, atom]));
const traceMap = new Map(traces.traces.map((trace) => [`${trace.ownerType}:${trace.ownerId}#${trace.actionId}`, trace]));
const owners = [...labIds.map((id) => `lab:${id}`), ...techniqueIds.map((id) => `technique:${id}`), `technique:${carrierId}`];

const identity = {
  baselineRevision: baseline.baselineRevision,
  baselineManifestPath: baselinePath,
  baselineManifestSha256: sha256(baselinePath),
  baselineAggregateSha256: baseline.source.gitTreeListingSha256,
  baselineSourceCommit: baseline.source.commit,
  baselineLabStudioTree: baseline.source.labStudioTree,
  baselineGitTreeListingSha256: baseline.source.gitTreeListingSha256,
  baselineDisposition: "Reviewed-frozen revision 9 worktree-ref identity; this lane is additive and does not mutate the manifest.",
  frozenTechniqueAuditSha256: baseline.contractDependencies.techniqueAtomicityAuditSha256,
  frozenLabAuditSha256: baseline.contractDependencies.labCompositionAuditSha256,
  frozenRegistrySha256: baseline.contractDependencies.sourceTraceRegistrySha256,
  contractDependencies: baseline.contractDependencies,
};
const header = (schema) => ({
  schema: `lab-studio/${schema}@1`, lane: "08", ...identity, owners,
  validationBoundary: "Source/static evidence only; runtime, browser, detailed tests, build, and physical validation intentionally not run.",
});

const actionTrace = (ownerType, ownerId, action) => {
  const exact = traceMap.get(`${ownerType}:${ownerId}#${action.id}`);
  if (exact) return { ...exact, rationale: "Exact source-registry row retained for the current action identity." };
  if (ownerType === "technique" && ownerId === "crystal-violet-kinetics") {
    return { sourceFile: null, sourceTable: null, step: null, basis: "C", rationale: "Declared non-source-derived AP carrier; timing values and instrument readings remain teacher-configured simulator inputs and are not source claims." };
  }
  if (ownerType === "technique" && ownerId === "crystal-violet-integrated-rate-law-comparison") {
    return { sourceFile: "crystal-violet-rate-law_2026-07-27.md", sourceTable: "phase", step: "C-08/C-09", basis: "M/R/C", rationale: "Derived analysis consumes recorded calibration and kinetic evidence; no expected model result or fixed student answer is claimed." };
  }
  return { sourceFile: null, sourceTable: null, step: null, basis: "C", rationale: "Nonphysical orchestration or explicitly teacher-configured boundary; no manual physical operation is claimed." };
};

const effectFor = (technique, action) => {
  if (action.atomId) return atoms.get(action.atomId)?.effectContract;
  return technique.composition?.legacyActionEffects?.find((entry) => entry.actionId === action.id)?.effect ?? {
    classes: ["pedagogical-orchestration"], targets: [{ domain: "evidence" }],
  };
};
const configValues = (value, path = [], output = {}) => {
  if (typeof value === "string" && value.startsWith("{{config.")) output[path.at(-1)] = value;
  else if (Array.isArray(value)) value.forEach((child, index) => configValues(child, [...path, String(index)], output));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => configValues(child, [...path, key], output));
  return output;
};
const actionRows = (technique) => technique.actions.map((action) => {
  const source = actionTrace("technique", technique.id, action);
  return {
    rowId: `technique:${technique.id}#${action.id}`, owner: `technique:${technique.id}`, actionId: action.id,
    atomId: action.atomId ?? null, sourceFile: source.sourceFile, sourceTable: source.sourceTable,
    step: source.step, basis: source.basis, rationale: source.rationale, evaluated: true,
  };
});
const localRows = (lab) => lab.actions.map((action) => ({
  rowId: `lab:${lab.id}#${action.id}`, owner: `lab:${lab.id}`, actionId: action.id,
  atomId: action.atomId ?? null, sourceFile: null, sourceTable: null, step: null, basis: "C",
  rationale: "Nonphysical lab orchestration retained locally; physical/scientific-state acquisition belongs to a named technique instance.", evaluated: true,
}));

const carrier = {
  owner: `technique:${carrierId}`,
  disposition: "Historical carrier retained as an explicit optional branch owner; it is not a standalone public technique file and is emitted only through the teacher-approved analysis-extension instance.",
  historicalActionIds: ["cv11-extension-approval-gate", "cv11-extension-design-hydroxide-series", "cv11-extension-determine-z-and-k"],
  replacementOwner: "technique:crystal-violet-integrated-rate-law-comparison",
  approvalWitnesses: ["mandatory-path=false", "teacher-approved-extension=true"],
  evaluated: true,
};

const baselineReconcile = (row, currentActions) => {
  const exact = currentActions.filter((action) => action.id === row.actionId).map((action) => action.id);
  const replacements = exact.length ? exact : [];
  return {
    rowId: row.rowId, originalOwner: row.techniqueId ? `technique:${row.techniqueId}` : `lab:${row.labId}`,
    originalActionId: row.actionId, replacementActionIds: replacements,
    disposition: replacements.length
      ? "Reconciled to the current named operation; source/static scope only."
      : "Retired historical anonymous or carrier row; current composition and explicit source/configuration boundary replace the old owner/action identity.",
    sourceSubsetLimitation: "Revision-9 audit row is preserved for reconciliation; this overlay does not rewrite the frozen matrix.", evaluated: true,
  };
};
const relevantTechniqueBaseline = techniqueAudit.rows
  .filter((row) => row.finalOwningCycle === "08" || techniqueIds.includes(row.techniqueId) || row.techniqueId === carrierId)
  .map((row) => baselineReconcile(row, techniques.get(row.techniqueId)?.actions ?? []));
const relevantLabBaseline = labAudit.rows
  .filter((row) => labIds.includes(row.labId) && (row.laterOwnerCycle === "08" || row.requiredRemediation?.includes("Cycle 08")))
  .map((row) => baselineReconcile(row, labs.get(row.labId)?.actions ?? []));

const atomicRows = [...techniques.values()].flatMap((technique) => technique.actions.map((action) => {
  const source = actionTrace("technique", technique.id, action);
  const effect = effectFor(technique, action);
  return {
    rowId: `${technique.id}@${technique.metadata.version}#${action.id}`, techniqueId: technique.id,
    techniqueVersion: technique.metadata.version, actionId: action.id, atomId: action.atomId ?? null,
    effect, roleBindings: action.equipmentRoleBindings ?? {},
    nodeConsumers: technique.process.nodes.filter((node) => node.actionId === action.id).map((node) => node.id),
    decision: action.atomId ? "keep: one handler-dispatched bench or evidence operation" : "nonphysical: learner/instructor response",
    prerequisites: {
      authored: action.prerequisites ?? [], attachmentState: action.parameters?.requiredAttachmentState ?? null,
      assignedSource: action.parameters?.sourceInstanceId ?? null, assignedReceiver: action.parameters?.targetInstanceId ?? null,
      trial: action.parameters?.trialReferenceId ?? null, operation: action.interaction?.type ?? action.verb,
      model: action.parameters?.kineticsModelId ?? null,
    },
    pausePoint: action.label, recoveryBoundary: action.invalidCases ?? [], configurationParameters: configValues(action.parameters ?? {}),
    evidenceBoundary: { declared: action.evidence ?? [], acquisition: action.parameters?.measurementId ?? null, calculation: action.parameters?.calculationId ?? null },
    reviewBoundary: "Static source/handler review; no executed physical or browser validation.",
    configurationWitness: action.parameters?.configurationProvenance ?? "Exact action bindings plus teacher-configured instance values; no C value is promoted to a source mandate.",
    sourceConflict: source.rationale, evaluated: true,
  };
}));

const selectedActionIds = (technique, instance) => {
  const selected = instance.bindings?.configuration?.selectedProcedure;
  const group = technique.composition?.orderedProcedure?.groups?.find((candidate) => candidate.id === selected);
  return new Set(group?.actionIds ?? technique.actions.map((action) => action.id));
};
const instanceRows = (lab, witnessId) => {
  const rows = [];
  for (const node of lab.process.nodes) rows.push({
    rowId: `${lab.id}#${node.id}`, labId: lab.id, nodeId: node.id, actionId: node.actionId,
    techniqueId: null, techniqueVersion: null, instanceId: null, reachability: [witnessId],
    finalOrigin: { kind: "lab-local" }, incoming: lab.process.edges.filter((edge) => edge.to === node.id),
    outgoing: lab.process.edges.filter((edge) => edge.from === node.id), effectDecision: "nonphysical lab orchestration",
    sourceConflictDisposition: "Local evidence/planning action; physical/stateful operations are imported from exact-version techniques.", evaluated: true,
  });
  for (const instance of lab.techniqueInstances ?? []) {
    const technique = techniques.get(instance.techniqueId);
    if (!technique || !selectedActionIds(technique, instance).size) continue;
    if (witnessId === "mandatory-path" && instance.instanceId === "analysis-extension") continue;
    if (witnessId === "default" && instance.instanceId === "analysis-extension") continue;
    for (const sourceNode of technique.process.nodes) {
      if (!selectedActionIds(technique, instance).has(sourceNode.actionId)) continue;
      const nodeId = instance.preserveIds?.nodes?.[sourceNode.id] ?? `${instance.instanceId}--${sourceNode.id}`;
      const actionId = instance.preserveIds?.actions?.[sourceNode.actionId] ?? `${instance.instanceId}--${sourceNode.actionId}`;
      rows.push({
        rowId: `${lab.id}#${nodeId}`, labId: lab.id, nodeId, actionId, techniqueId: technique.id,
        techniqueVersion: technique.metadata.version, instanceId: instance.instanceId, reachability: [witnessId],
        finalOrigin: { kind: "technique-instance", sourceNodeId: sourceNode.id, sourceActionId: sourceNode.actionId },
        incoming: [], outgoing: [], effectDecision: technique.actions.find((action) => action.id === sourceNode.actionId)?.atomId ?? "nonphysical response",
        configurationWitness: { selectedProcedure: instance.bindings?.configuration?.selectedProcedure ?? null, variantId: instance.variantId ?? null, approvalGates: lab.reachabilityWitnesses?.find((witness) => witness.id === witnessId)?.approvalGates ?? {} },
        sourceConflictDisposition: actionTrace("technique", technique.id, technique.actions.find((action) => action.id === sourceNode.actionId)).rationale,
        evaluated: true,
      });
    }
  }
  return rows;
};
const mergedLabRows = (lab) => {
  const witnessIds = ["default", ...(lab.reachabilityWitnesses ?? []).map((witness) => witness.id)];
  const merged = new Map();
  for (const witnessId of witnessIds) for (const row of instanceRows(lab, witnessId)) {
    const prior = merged.get(row.rowId);
    if (prior) prior.reachability = [...new Set([...prior.reachability, ...row.reachability])];
    else merged.set(row.rowId, row);
  }
  return [...merged.values()];
};

write("source-trace-overlay", {
  ...header("source-trace-overlay"), rows: [...techniques.values()].flatMap(actionRows).concat([...labs.values()].flatMap(localRows)),
  carriers: [carrier], sourcePolicy: "Source-derived physical actions use exact registry rows; non-source carriers and lab orchestration carry explicit C/non-source dispositions.",
});
write("technique-atomicity-overlay", {
  ...header("technique-atomicity-overlay"), rows: atomicRows, baselineRows: relevantTechniqueBaseline, carriers: [carrier],
  ownerDispositions: [{ owner: `technique:${carrierId}`, disposition: "Optional approval-gated carrier only; not a standalone public file.", evaluated: true }],
});
write("lab-composition-overlay", {
  ...header("lab-composition-overlay"), rows: [...labs.values()].flatMap(mergedLabRows), baselineRows: relevantLabBaseline,
  carriers: [carrier], compositionPolicy: "Rows are derived from current lab-local nodes and selected ordered-procedure groups for every default/reachability witness; duplicate row identities are merged with witness coverage.",
});

console.log(`Cycle 08 overlays written: ${atomicRows.length} technique actions, ${[...labs.values()].reduce((sum, lab) => sum + mergedLabRows(lab).length, 0)} composed rows.`);
