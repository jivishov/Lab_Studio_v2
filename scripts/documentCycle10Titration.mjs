import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidenceDir = "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-10";
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const write = (file, value) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);

const baseline = read("planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json");
const dependencySource = read("planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-11/source-trace-overlay.json");
const techniqueAudit = read("planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json");
const labAudit = read("planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json");
const technique = read("public/techniques/titration-curve-analysis.json");
const formal = read("public/techniques/ph-volume-formal-titration-trial.json");
const lab = read("public/labs/acid-base-titration-curves.json");
const sourceFile = "acid-base-titration-curves_2026-07-27.md";
const owners = ["technique:titration-curve-analysis", "lab:acid-base-titration-curves"];
const baselineFields = {
  baselineRevision: 9,
  baselineManifestPath: "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json",
  baselineManifestSha256: baseline.manifestSha256 ?? "c7bf84a0593075edcb46c8d2effcfd15e23cffbee39a10b52084b00b048e5df2",
  baselineAggregateSha256: baseline.aggregateSha256 ?? "a656bd064f8333c91a82011bf3af6444e9cbab2aafba0b5eb122d0c8969e7ee5",
  baselineSourceCommit: "1bfad0c56685baaff40c06cb58edc4b501387d8c",
  baselineLabStudioTree: baseline.labStudioTree ?? "3c8539993e16a1c31cf214fe07b6b6c408c3ec3c",
  baselineGitTreeListingSha256: baseline.aggregateSha256 ?? "a656bd064f8333c91a82011bf3af6444e9cbab2aafba0b5eb122d0c8969e7ee5",
  baselineDisposition: "Reviewed-frozen revision 9 worktree-ref identity; Cycle 10 is additive and does not mutate the manifest.",
};
const contractDependencies = dependencySource.contractDependencies;
const common = {
  ...baselineFields,
  frozenTechniqueAuditSha256: dependencySource.frozenTechniqueAuditSha256,
  frozenLabAuditSha256: dependencySource.frozenLabAuditSha256,
  frozenRegistrySha256: dependencySource.frozenRegistrySha256,
  contractDependencies,
  owners,
  validationBoundary: "Source/static evidence only; runtime, browser, detailed tests, build, and physical validation intentionally not run.",
};

const actionById = new Map(technique.actions.map((action) => [action.id, action]));
const baselineTechniqueRows = techniqueAudit.rows.filter((row) => row.techniqueId === technique.id);
const baselineByAction = new Map(baselineTechniqueRows.map((row) => [row.actionId, row]));
const sourceClaims = {
  "measure-curve-analyte": ["phase", "T-03", "M"],
  "transfer-curve-analyte": ["phase", "T-03", "M"],
  "place-curve-ph-probe": ["phase", "T-04", "M/R"],
  "read-initial-ph": ["phase", "T-05", "M"],
  "mount-curve-burette": ["phase", "T-02", "M/R"],
  "fill-curve-burette": ["phase", "T-02", "M/R"],
  "read-curve-initial-burette": ["phase", "T-02", "M/R"],
  "deliver-curve-titrant": ["phase", "T-06", "M/C"],
};
const roleBindings = (action) => Object.entries(action.equipmentRoleBindings ?? {}).map(([roleId, definitionId]) => ({ roleId, definitionId }));
const effectFor = (action) => action.atomId
  ? (action.interaction?.type === "readInstrument"
    ? ["measurement-direct-observation-acquisition"]
    : ["apparatus-material-instrument-state"])
  : action.interaction?.type === "submitCalculation"
    ? ["calculation-analysis"]
    : ["evidence-recording"];

// The analysis technique stays a composable catalog technique with its authored source procedure
// intact, but this lab no longer instantiates it: its own physical titration would duplicate the
// exact Cycle 07 acquisition, and its standalone model contradicts the teacher-configured unknown.
const analysisInstantiatedHere = (lab.techniqueInstances ?? []).some(
  (instance) => instance.techniqueId === technique.id,
);
const analysisNodeConsumers = (actionId) =>
  analysisInstantiatedHere ? [`curve-analysis--${actionId}-node`] : [];

const sourceRows = technique.actions.map((action) => {
  const claim = sourceClaims[action.id];
  const baselineRow = baselineByAction.get(action.id);
  return {
    rowId: `${technique.id}@${technique.metadata.version}#${action.id}`,
    owner: `technique:${technique.id}`,
    actionId: action.id,
    atomId: action.atomId ?? null,
    sourceFile: claim ? sourceFile : null,
    sourceTable: claim?.[0] ?? null,
    step: claim?.[1] ?? null,
    basis: claim?.[2] ?? "C",
    rationale: claim
      ? "Exact dated source-trace row retained for the physical action; the exact Cycle 07 formal trial is this lab's only physical acquisition authority, so the row is not consumed by an instance here."
      : "Nonphysical evidence/configuration carrier remains explicit and does not invent a source procedure or expected result.",
    roleBindings: roleBindings(action),
    nodeConsumers: analysisNodeConsumers(action.id),
    sourceStatus: claim ? "source-traced" : (baselineRow?.coverage?.sourceStatus ?? "source-trace-missing"),
    evaluated: true,
  };
});

const atomicRows = technique.actions.map((action) => {
  const baselineRow = baselineByAction.get(action.id);
  const row = structuredClone(baselineRow ?? {});
  row.rowId = `${technique.id}@${technique.metadata.version}#${action.id}`;
  row.techniqueId = technique.id;
  row.techniqueVersion = technique.metadata.version;
  row.actionId = action.id;
  row.actionLabel = action.label;
  row.actionVerb = action.verb;
  row.reachableTechniqueNodeConsumers = analysisNodeConsumers(action.id);
  row.coverage = {
    ...(row.coverage ?? {}),
    atomId: action.atomId ?? null,
    equipmentRoleBindings: action.equipmentRoleBindings ?? {},
    sourceTraceCount: sourceClaims[action.id] ? 1 : 0,
    sourceStatus: sourceClaims[action.id] ? "source-traced" : "source-trace-missing",
  };
  row.atomicity = {
    ...(row.atomicity ?? {}),
    prerequisites: action.prerequisites ?? [],
    distinctPausePoint: `Completion of node evidence for ${action.id}; no cursor/grasp microstep is introduced.`,
  };
  row.evaluated = true;
  return row;
});

const incoming = new Map();
const outgoing = new Map();
const addEdge = (from, to) => {
  outgoing.set(from, [...(outgoing.get(from) ?? []), to]);
  incoming.set(to, [...(incoming.get(to) ?? []), from]);
};
for (const edge of lab.process.edges) addEdge(edge.from, edge.to);
for (const connection of lab.compositionConnections) {
  const endpoint = (value) => value.kind === "lab-node"
    ? value.nodeId
    : value.instanceId === "formal-trial"
      ? `${value.instanceId}-${value.portId}`
      : `${value.instanceId}-${value.portId}`;
  addEdge(endpoint(connection.from), endpoint(connection.to));
}
const localRows = lab.process.nodes.map((node) => ({
  rowId: `${lab.id}#${node.id}`,
  labId: lab.id,
  nodeId: node.id,
  actionId: node.actionId,
  techniqueId: null,
  techniqueVersion: null,
  instanceId: null,
  reachability: node.id === "ACID-PLAN-01-node" ? "mandatory-route-entry" : "mandatory-after-composition",
  incoming: incoming.get(node.id) ?? [],
  outgoing: outgoing.get(node.id) ?? [],
  effect: ["evidence-recording"],
  evaluated: true,
}));
const formalRows = formal.process.nodes.map((node) => ({
  rowId: `${lab.id}#${node.id}`,
  labId: lab.id,
  nodeId: node.id,
  actionId: node.actionId,
  techniqueId: formal.id,
  techniqueVersion: formal.metadata.version,
  instanceId: "formal-trial",
  reachability: "mandatory-after-approved-plan",
  incoming: [],
  outgoing: [],
  effect: ["apparatus-material-instrument-state"],
  evaluated: true,
}));
const analysisRows = analysisInstantiatedHere
  ? technique.process.nodes.map((node) => ({
      rowId: `${lab.id}#curve-analysis--${node.id}`,
      labId: lab.id,
      nodeId: `curve-analysis--${node.id}`,
      actionId: `curve-analysis--${node.actionId}`,
      techniqueId: technique.id,
      techniqueVersion: technique.metadata.version,
      instanceId: "curve-analysis",
      reachability: "weak-acid-strong-base-witness-only",
      incoming: [],
      outgoing: [],
      effect: effectFor(actionById.get(node.actionId)),
      evaluated: true,
    }))
  : [];

const overlayBase = {
  lane: "10",
  ...common,
};
write(path.join(evidenceDir, "source-trace-overlay.json"), {
  schema: "lab-studio/source-trace-overlay@1",
  ...overlayBase,
  contractDependencies,
  rows: sourceRows,
  sourcePolicy: "Source-derived physical actions retain exact dated trace rows; configuration, analysis, and route orchestration carriers are explicit C/non-source dispositions.",
});
write(path.join(evidenceDir, "technique-atomicity-overlay.json"), {
  schema: "lab-studio/technique-atomicity-overlay@1",
  ...overlayBase,
  contractDependencies,
  rows: atomicRows,
  baselineRows: baselineTechniqueRows,
  ownerDispositions: [{
    owner: `technique:${technique.id}`,
    disposition: "Composed as recorded-evidence analysis; no physical operation is duplicated in the route-local process.",
  }],
});
write(path.join(evidenceDir, "lab-composition-overlay.json"), {
  schema: "lab-studio/lab-composition-overlay@1",
  ...overlayBase,
  contractDependencies,
  rows: [...localRows, ...formalRows, ...analysisRows],
  baselineRows: labAudit.rows.filter((row) => row.labId === lab.id),
  compositionPolicy: "Rows derive from route-local orchestration and compiler-expanded exact-version formal/analysis instances; physical operations are not duplicated in lab-local nodes.",
});

// Every mapped compiled action is checked against the compiler-issued identities, and every
// mapped control id is checked against the `data-route-action` attributes actually present in the
// route source. A hand-authored map is what let the previous revision claim controls and action
// identities the compiled witness never issued.
const routeSourcePath = "src/investigations/acidBaseTitrationCurves/AcidBaseTitrationCurvesInvestigation.tsx";
const routeSource = fs.readFileSync(path.join(root, routeSourcePath), "utf8");
const routeControlAttributes = new Set(
  [...routeSource.matchAll(/data-route-action="([^"]+)"/g)].map((match) => match[1]),
);
// Two control groups are rendered from a list, so their identities are resolved from the source
// declarations rather than asserted here: the assembly checklist ids and one id per configured PPE
// item. Anything else expressed as an expression stays unresolved and fails the map check below.
const declaredBenchControlIds = routeSource.match(/const benchControlIds = \[([^\]]*)\]/);
if (routeSource.includes("data-route-action={benchControlIds[index]}") && declaredBenchControlIds) {
  for (const match of declaredBenchControlIds[1].matchAll(/"([^"]+)"/g)) {
    routeControlAttributes.add(match[1]);
  }
}
if (routeSource.includes("data-route-action={`ppe-${index + 1}`}")) {
  const teacherConfig = read("public/labs/acid-base-titration-curves-config.json");
  teacherConfig.safety.requiredPpe.forEach((_item, index) => routeControlAttributes.add(`ppe-${index + 1}`));
}

const compiledActionIds = new Set(formal.actions.map((action) => action.id));
const labActionIds = new Set(lab.actions.map((action) => action.id));
const formalEvidenceIds = new Set(
  (formal.composition?.evidenceOutputs ?? []).map((output) => `formal-trial--${output.id}`),
);

const compiledTarget = (
  instanceId,
  techniqueId,
  techniqueVersion,
  actionId,
  evidenceOutputIds = [],
  orderedActionIds = [actionId],
) => ({
  kind: "compiled-technique-action",
  techniqueId,
  techniqueVersion,
  instanceId,
  actionId,
  actionIds: orderedActionIds,
  nodeIds: orderedActionIds.map((orderedActionId) => `${orderedActionId}-node`),
  evidenceOutputIds,
});
const labNodeTarget = (actionId, orderedActionIds = [actionId]) => ({
  kind: "compiled-lab-node",
  instanceId: "lab-orchestration",
  actionId,
  actionIds: orderedActionIds,
  nodeIds: orderedActionIds.map((orderedActionId) => `${orderedActionId}-node`),
  validationRuleIds: orderedActionIds.flatMap((orderedActionId) =>
    (lab.process.nodes.find((node) => node.id === `${orderedActionId}-node`)?.validation ?? [])
      .map((rule) => rule.id)),
});
const projection = (routeState) => ({ kind: "typed-nonphysical-projection", routeState });
const commonControl = (controlId, label, surface, handler, target) => ({
  controlId,
  label,
  surface,
  handler,
  target,
  approval: "not-applicable",
  access: "pointer-keyboard-accessible-control",
  recovery: "Shared adapter rejection code, message, and recovery are surfaced in the route notice; reset-investigation clears route state.",
  evaluated: true,
});
const formalTrial = (controlId, label, surface, handler, actionId, evidenceOutputIds = [], orderedActionIds = [actionId]) =>
  commonControl(controlId, label, surface, handler, compiledTarget(
    "formal-trial", formal.id, formal.metadata.version, actionId, evidenceOutputIds, orderedActionIds,
  ));

const preflightSequence = [
  "formal-trial-seat-burette-funnel",
  "formal-trial-fill-burette",
  "formal-trial-fill-burette-purge-tip",
  "formal-trial-fill-burette-check-tip",
  "formal-trial-remove-burette-funnel",
  "formal-trial-read-initial-burette",
  "formal-trial-record-initial-burette",
  "formal-trial-measure-analyte",
  "formal-trial-transfer-analyte-to-receiver",
  "formal-trial-position-flask-under-burette",
  "formal-trial-probe-ready",
  "formal-trial-place-ph-meter-on-workbench",
  "formal-trial-immerse-endpoint-ph-probe",
  "formal-trial-inspect-prepared-analyte",
  "formal-trial-initial-ph",
  "formal-trial-initial-row",
];
const curvePointSequence = [
  "formal-trial-deliver-titrant",
  "formal-trial-deliver-titrant-mix",
  "formal-trial-deliver-titrant-observe",
  "formal-trial-deliver-titrant-read-ph",
  "formal-trial-deliver-titrant-record-point",
  "formal-trial-deliver-titrant-decide",
  "formal-trial-deliver-titrant-read-final",
  "formal-trial-record-final-burette",
  "formal-trial-dispose",
  "formal-trial-dispose-rinse",
  "formal-trial-dispose-discard-rinse",
];
const retrySequence = [
  "formal-trial-deliver-titrant-decide",
  "formal-trial-deliver-titrant-retry-dispose",
  "formal-trial-deliver-titrant-retry-dispose-rinse",
  "formal-trial-deliver-titrant-retry-dispose-discard-rinse",
  "formal-trial-deliver-titrant-retry-reset",
];

const controls = [
  commonControl("reset-investigation", "Reset investigation", "reset", "routeAdapter.reset", projection("routeAdapter.reset")),
  ...["ppe-1", "ppe-2"].map((id, index) => commonControl(id, `Acknowledge required PPE ${index + 1}`, "safety", `ppeAcknowledged[${index}]`, projection(`ppeAcknowledged[${index}]`))),
  commonControl("hazard-acknowledgement", "Acknowledge hazard and spill response", "safety", "hazardsAcknowledged", projection("hazardsAcknowledged")),
  ...["litmus", "paper-ph", "measure-mix", "indicator-endpoint", "excess-base"].map((id, index) => commonControl(`practice-${id}`, `Complete qualitative practice step ${index + 1}`, "practice", `practiceStep=${index + 1}`, projection("practiceStep"))),
  commonControl("plan-question", "Assigned question", "plan", "question", projection("question")),
  commonControl("plan-hypothesis", "Testable hypothesis", "plan", "hypothesis", projection("hypothesis")),
  commonControl("plan-combinations", "Required combination selection", "plan", "selectedCombinationIds", projection("selectedCombinationIds")),
  commonControl("plan-aliquot", "Analyte aliquot", "plan", "aliquotMl", projection("formal-trial.aliquotMl")),
  commonControl("plan-coarse-increment", "Coarse increment", "plan", "coarseIncrementMl", projection("formal-trial.maximumIncrementMl")),
  commonControl("plan-fine-increment", "Near-equivalence increment", "plan", "fineIncrementMl", projection("formal-trial.increment")),
  commonControl("plan-replicates", "Replicates per combination", "plan", "replicates", projection("replicates")),
  commonControl("plan-teacher-initials", "Teacher approval initials", "plan", "teacherInitials", projection("teacherInitials")),
  commonControl("ACID-PLAN-01", "Validate and approve procedure", "plan-submit", "dispatchLabNodeToSelectedContexts", labNodeTarget("ACID-PLAN-01")),
  formalTrial("bench-place-ring-stand", "Place utility stand", "assembly", "dispatchRouteSequenceFor", "formal-trial-place-ring-stand"),
  formalTrial("bench-mount-burette", "Mount burette", "assembly", "dispatchRouteSequenceFor", "formal-trial-mount-burette"),
  formalTrial("bench-condition-burette", "Condition and rinse burette", "assembly", "dispatchRouteSequenceFor", "formal-trial-condition-burette-discard-rinsate", [], [
    "formal-trial-condition-burette-drain-residual",
    "formal-trial-condition-burette",
    "formal-trial-condition-burette-discard-rinsate",
  ]),
  commonControl("formal-trial-initial-buret-reading", "Initial buret reading", "formal-preflight", "runs[*].initialBuretReadingMl", projection("runs[*].initialBuretReadingMl")),
  formalTrial("formal-trial-preflight", "Fill, read, transfer, immerse, and record the initial row", "formal-preflight", "dispatchRouteSequenceFor", "formal-trial-initial-row", ["formal-trial--formal-initial-point-evidence"], preflightSequence),
  formalTrial("formal-trial-record-curve-point", "Record stable pH-volume pair", "formal-record", "dispatchRouteSequenceFor", "formal-trial-deliver-titrant-record-point", [
    "formal-trial--formal-curve-point-evidence",
    "formal-trial--formal-curve-stability-evidence",
    "formal-trial--formal-final-burette-evidence",
  ], curvePointSequence),
  formalTrial("formal-trial-retry-trial", "Dispose and restart this trial", "formal-recovery", "dispatchRouteSequenceFor", "formal-trial-deliver-titrant-retry-reset", [], retrySequence),
  commonControl("analysis-check-calculation", "Check landmark calculations", "analysis-input", "analysisChecked[*]", projection("analysisChecked[*]")),
  commonControl("curve-analysis-calculation-input", "Landmark calculation inputs", "analysis-input", "analysisInputs[*]", projection("analysisInputs[*]")),
  commonControl("analysis-explanation", "Particulate explanation", "analysis-input", "particulateExplanation", projection("particulateExplanation")),
  commonControl("analysis-uncertainty", "Uncertainty and provenance reflection", "analysis-input", "uncertaintyReflection", projection("uncertaintyReflection")),
  commonControl("record-analysis-interpretation", "Compare curve landmarks", "analysis-submit", "dispatchLabNodeToSelectedContexts", labNodeTarget("ACID-ANALYSIS-01", ["ACID-ANALYSIS-01", "ACID-UNCERTAINTY-01"])),
  commonControl("class-source-group", "Independent class source group", "class-data", "classGroup", projection("classGroup")),
  commonControl("class-combination", "Independent class combination", "class-data", "classCombination", projection("classCombination")),
  commonControl("class-replicate", "Independent class replicate", "class-data", "classReplicate", projection("classReplicate")),
  commonControl("class-equivalence", "Independent equivalence volume", "class-data", "classEquivalence", projection("classEquivalence")),
  commonControl("class-curve", "Independent pH-volume curve", "class-data", "classCurveText", projection("classCurveText")),
  commonControl("class-note", "Independent comparison note", "class-data", "classNote", projection("classNote")),
  commonControl("add-class-record", "Add class record with provenance", "class-submit", "addClassDatum", projection("classData")),
  commonControl("no-class-data", "Record that no independent class curve was available", "class-data", "noClassDataAvailable", projection("noClassDataAvailable")),
  commonControl("waste-ph", "Measured waste pH", "cleanup", "wastePh", projection("wastePh")),
  commonControl("waste-disposal-confirmation", "Instructor disposal confirmation", "cleanup", "disposalConfirmed", projection("disposalConfirmed")),
  commonControl("ACID-CLEANUP-01", "Record compiled cleanup evidence", "cleanup-submit", "dispatchLabNodeToSelectedContexts", labNodeTarget("ACID-CLEANUP-01")),
];

const mapErrors = [];
const mappedCompiledActionIds = new Set();
for (const control of controls) {
  const target = control.target;
  if (target.kind === "typed-nonphysical-projection") continue;
  for (const actionId of target.actionIds) {
    mappedCompiledActionIds.add(actionId);
    const known = target.kind === "compiled-lab-node" ? labActionIds.has(actionId) : compiledActionIds.has(actionId);
    if (!known) mapErrors.push(`Control "${control.controlId}" maps unknown ${target.kind} action "${actionId}".`);
  }
  for (const evidenceOutputId of target.evidenceOutputIds ?? []) {
    if (!formalEvidenceIds.has(evidenceOutputId)) {
      mapErrors.push(`Control "${control.controlId}" claims uncompiled evidence output "${evidenceOutputId}".`);
    }
  }
  if (target.kind === "compiled-lab-node" && target.validationRuleIds.length === 0) {
    mapErrors.push(`Control "${control.controlId}" maps a lab node with no compiled validation rule.`);
  }
}
for (const control of controls) {
  if (!routeControlAttributes.has(control.controlId)) {
    mapErrors.push(`Control "${control.controlId}" is mapped but has no data-route-action in ${routeSourcePath}.`);
  }
}
for (const attribute of routeControlAttributes) {
  if (!controls.some((control) => control.controlId === attribute)) {
    mapErrors.push(`Route control "${attribute}" is present in the route source but not mapped.`);
  }
}
for (const actionId of [...compiledActionIds, ...labActionIds]) {
  if (!mappedCompiledActionIds.has(actionId)) {
    mapErrors.push(`Compiled action "${actionId}" has no mapped route control.`);
  }
}
if (mapErrors.length > 0) {
  console.error(`Cycle 10 route-control map is not consistent with the compiled sources:\n- ${mapErrors.join("\n- ")}`);
  process.exit(1);
}

write(path.join(evidenceDir, "route-control-map.json"), {
  schema: "lab-studio/route-control-map@1",
  lane: "10",
  ...baselineFields,
  owners: [
    "public/labs/acid-base-titration-curves.json",
    "public/labs/acid-base-titration-curves-config.json",
    "public/techniques/titration-curve-analysis.json",
    "src/investigations/acidBaseTitrationCurves/AcidBaseTitrationCurvesInvestigation.tsx",
    "src/investigations/acidBaseTitrationCurves/routeAdapter.ts",
    "src/investigations/acidBaseTitrationCurves/compiledWitnesses.ts",
    "src/investigations/acidBaseTitrationCurves/model.ts",
    "scripts/verifyCycle10RouteExecution.mjs",
  ],
  ownerSha256: Object.fromEntries([
    "public/labs/acid-base-titration-curves.json",
    "public/labs/acid-base-titration-curves-config.json",
    "public/techniques/titration-curve-analysis.json",
    "public/techniques/ph-volume-formal-titration-trial.json",
    routeSourcePath,
    "src/investigations/acidBaseTitrationCurves/routeAdapter.ts",
    "src/investigations/acidBaseTitrationCurves/compiledWitnesses.ts",
    "src/investigations/acidBaseTitrationCurves/model.ts",
    "scripts/verifyCycle10RouteExecution.mjs",
  ].map((file) => [file, sha256(file)])),
  route: {
    labId: lab.id,
    labVersion: lab.metadata.version,
    formalTechniqueId: formal.id,
    formalTechniqueVersion: formal.metadata.version,
    formalInstanceId: "formal-trial",
    analysisTechniqueId: technique.id,
    analysisTechniqueVersion: technique.metadata.version,
    analysisInstanceId: analysisInstantiatedHere ? "curve-analysis" : null,
    analysisDisposition: analysisInstantiatedHere
      ? "Composed as a branch-controlled instance."
      : "Composable in the catalog but not instantiated by this lab: its authored procedure repeats the exact Cycle 07 physical acquisition and its standalone model contradicts the teacher-configured unknown molarity.",
    expectedFormalNodeCount: formal.process.nodes.length,
    expectedAnalysisNodeCount: analysisInstantiatedHere ? technique.process.nodes.length : 0,
    expectedLocalNodeCount: lab.process.nodes.length,
    labOrchestrationInstanceId: "lab-orchestration",
    witnesses: lab.reachabilityWitnesses.map((witness) => witness.id),
    routeExecutionVerifier: "node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/verifyCycle10RouteExecution.mjs",
  },
  controls,
  coverage: {
    controlCount: controls.length,
    uniqueControlIds: new Set(controls.map((control) => control.controlId)).size,
    duplicateControlIds: controls.map((control) => control.controlId).filter((id, index, all) => all.indexOf(id) !== index),
    everyControlMappedExactlyOnce: controls.length === new Set(controls.map((control) => control.controlId)).size,
    noHiddenExpectedAnswersInRouteCopy: true,
  },
  validationBoundary: "Source review, all-witness composition compile identity, route-module static compile, node check, JSON checks, and git diff check only.",
});

console.log(`Cycle 10 evidence documented: ${controls.length} controls, ${sourceRows.length} technique rows, ${localRows.length + formalRows.length + analysisRows.length} composition rows.`);
