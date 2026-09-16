import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const planDir = path.join(
  root,
  "planning/2026-08-30_lab-studio-technique-composition-remediation",
);
const evidenceDir = path.join(planDir, "evidence/lane-11");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const sha256 = (relativePath) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");

const baseline = readJson(
  "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json",
);
const techniquePath = "public/techniques/thermal-decomposition-mass-loss.json";
const labPath = "public/labs/green-chemistry-mixture-purification.json";
const technique = readJson(techniquePath);
const lab = readJson(labPath);
const techniqueVersion = technique.metadata.version;
const instanceId = "thermal-decomposition";
const techniqueNodeId = (actionId) =>
  `${instanceId}--${actionId}-node`;
const techniqueEvidenceId = (evidenceId) =>
  `${instanceId}--${evidenceId}`;
const actionById = new Map(technique.actions.map((action) => [action.id, action]));
const effectByActionId = new Map(
  technique.composition.legacyActionEffects.map((entry) => [
    entry.actionId,
    entry.effect,
  ]),
);
const evidenceByActionId = new Map();
for (const output of technique.composition.evidenceOutputs) {
  const outputs = evidenceByActionId.get(output.actionId) ?? [];
  outputs.push(output);
  evidenceByActionId.set(output.actionId, outputs);
}

const sourceFile = "purify-a-mixture-green-chemistry_2026-07-27.md";
const sourceMap = {
  "approve-thermal-decomposition-plan": ["procedure", "IQ-04", "M", "Approval gates physical execution after the learner plan and safety controls are resolved."],
  "place-balance": ["procedure", "EX-01", "M", "The learner selects the balance used for every mass reading."],
  "place-empty-crucible": ["procedure", "EX-03", "M/R", "The vessel is cleaned and cooled before the empty-vessel reading."],
  "read-empty-crucible": ["procedure", "EX-04", "M", "The empty crucible and lid are read before sample transfer."],
  "record-empty-crucible": ["procedure", "EX-05", "M", "The empty-vessel display is preserved as notebook evidence."],
  "add-carbonate-sample": ["procedure", "EX-06", "M", "The planned mixture portion is transferred into the crucible."],
  "weigh-initial-crucible": ["procedure", "EX-07", "M", "The loaded crucible and lid are read on the selected balance."],
  "record-initial-crucible-mass": ["procedure", "EX-07", "M/R", "The loaded display is recorded separately from the instrument reading."],
  "recover-unused-sample": ["procedure", "EX-08", "M", "Excess unheated mixture remains in its separate unused-sample vessel."],
  "place-ring-stand": ["apparatus", "HEAT-00", "F/R", "The support assembly is placed as a figure/table-supported apparatus state."],
  "add-clay-triangle": ["apparatus", "HEAT-02", "F/R", "The clay triangle is seated in the iron ring; the apparatus table is figure-supported."],
  "place-bunsen-burner": ["apparatus", "HEAT-05", "F/R", "The burner is positioned beneath the support; the apparatus table is figure-supported."],
  "place-crucible-on-support": ["apparatus", "HEAT-03", "F/R", "The crucible is placed on the ceramic triangle; the apparatus table is figure-supported."],
  "set-crucible-lid": ["procedure", "EX-09", "M/F", "Heating uses a lid askew; a closed lid is unsafe and blocked."],
  "warm-gently": ["procedure", "EX-10", "M/C", "Gentle warm-up is retained while duration and intensity remain teacher-configured."],
  "heat-carbonate-mixture": ["procedure", "EX-10", "M/C", "Selective heating is source-grounded; duration and intensity are configuration choices."],
  "turn-off-burner": ["procedure", "EX-11", "M", "The burner is extinguished before the hot crucible is moved."],
  "cool-crucible": ["procedure", "EX-12/EX-13", "M/R", "Tongs and a cooling surface are used, and the crucible must be cool enough to weigh."],
  "weigh-preliminary-final-mass": ["procedure", "EX-14", "M", "The first cooled-cycle mass is read on the same balance."],
  "record-cycle-mass": ["procedure", "EX-14/EX-15", "M/R/C", "Cooled readings are recorded and compared consecutively against the configured tolerance."],
  "repeat-heat-to-constant-mass": ["procedure", "EX-16", "M/C", "The heat/cool/weigh loop repeats until constant mass or the teacher limit."],
  "cool-constant-mass-crucible": ["procedure", "EX-16", "M/R/C", "The repeat product cools before the next same-balance reading."],
  "weigh-final-crucible": ["procedure", "EX-14/EX-16", "M", "A subsequent cooled mass is read without an authored expected value."],
  "record-final-crucible-mass": ["procedure", "EX-14/EX-16", "M/R/C", "The final reading is recorded only after a consecutive constant-mass comparison."],
  "recover-replicate-product": ["procedure", "EX-19", "M/C", "The cooled replicate product is isolated in the product vessel; replicate partition is configured."],
  "complete-replicate": ["procedure", "EX-16/EX-19", "M/C", "Replicate evidence is closed before another configured replicate begins."],
  "calculate-carbonate-composition": ["procedure", "EX-17/EX-18", "M", "Composition is derived from measured mass loss and relative-amount calculations; extracted equation text is independently checked."],
  "record-composition-uncertainty": ["procedure", "11", "M/C", "Uncertainty and limitations are recorded from the measured replicate evidence and teacher tolerance."],
  "recover-final-product": ["procedure", "EX-19", "M", "The final heated product is recovered separately from unused mixture."],
};

const sourceConflict = (actionId, basis) => {
  if (actionId === "calculate-carbonate-composition") {
    return "The source equation extraction is corrupted; the balanced equation is a governed chemistry confirmation, not a copied source claim.";
  }
  if (basis.includes("C")) {
    return "The source leaves this parameter or boundary open; the implementation keeps it teacher-configurable and records no expected result.";
  }
  return null;
};

const roleBindings = (action) => {
  const text = JSON.stringify({ interaction: action.interaction, parameters: action.parameters });
  const roles = [];
  if (text.includes("analytical-balance") || text.includes("balance")) roles.push("balance-instrument");
  if (text.includes("crucible-with-lid")) roles.push("weighed-vessel");
  if (text.includes("sample-bottle")) roles.push("solid-reagent-source");
  if (text.includes("crucible-tongs")) roles.push("cooling-tool");
  if (text.includes("beaker-250ml")) roles.push("recovery-vessel");
  return [...new Set(roles)];
};

const configRefs = (action) => {
  const refs = new Set();
  const text = JSON.stringify(action.parameters ?? {});
  for (const match of text.matchAll(/\{\{config\.([A-Za-z0-9_]+)\}\}/g)) refs.add(match[1]);
  return [...refs];
};

const baselineTechRows = readJson(
  "planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json",
).rows.filter((row) => row.techniqueId === technique.id);
const baselineLabRows = readJson(
  "planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json",
).rows.filter((row) => row.labId === lab.id);

const actionRows = technique.actions.map((action) => {
  const [sourceTable, step, basis, rationale] = sourceMap[action.id] ?? [
    "procedure",
    "confirmation",
    "C",
    "Teacher configuration boundary; no source-fixed procedure is asserted.",
  ];
  const effect = effectByActionId.get(action.id) ?? {
    classes: ["evidence-recording"],
    targets: [{ domain: "evidence" }],
  };
  const outputs = evidenceByActionId.get(action.id) ?? [];
  const atomId = action.atom?.id ?? null;
  return {
    rowId: `${technique.id}@${techniqueVersion}#${action.id}`,
    techniqueId: technique.id,
    techniqueVersion,
    actionId: action.id,
    atomId,
    effect: {
      classes: effect.classes,
      targets: effect.targets.map((target) => target.domain),
      interactionType: action.interaction.type,
    },
    roleBindings: roleBindings(action),
    nodeConsumers: [techniqueNodeId(action.id)],
    decision: action.interaction.type === "readInstrument"
      ? "measurement-direct-observation"
      : action.interaction.type === "submitCalculation"
        ? "calculation-analysis"
        : action.interaction.type === "recordNotebook"
          ? "evidence-recording-or-recovery"
          : "apparatus-material-instrument-state",
    prerequisites: (action.prerequisites ?? []).map((item) => item.actionId),
    pausePoint: `Pause after ${techniqueNodeId(action.id)} evidence; no cursor/grasp microstep is introduced.`,
    recoveryBoundary: (action.invalidCases ?? []).map((item) => ({
      caseId: item.id,
      recovery: item.recovery,
    })),
    configurationParameters: configRefs(action),
    evidenceBoundary: {
      declaredActionEvidence: action.evidence,
      compiledEvidenceOutputIds: outputs.map((output) => techniqueEvidenceId(output.id)),
    },
    reviewBoundary: "Cycle 11 source review and basic static checks only; no detailed tests, build, browser, or physical validation.",
    configurationWitness: {
      instanceId,
      routeWitnesses: lab.reachabilityWitnesses.map((witness) => witness.id),
      teacherApprovalGate: "teacher-approved-plan",
      noAuthoredExpectedValue: true,
    },
    sourceConflict: sourceConflict(action.id, basis),
    sourceLocator: { sourceFile, sourceTable, step, basis, rationale },
    evaluated: true,
  };
});

const localActionRows = lab.process.nodes.map((node) => ({
  rowId: `${lab.id}#${node.id}`,
  owner: "lab:green-chemistry-mixture-purification",
  actionId: node.actionId,
  atomId: null,
  sourceFile,
  sourceTable: "procedure",
  step: node.actionId === "review-assigned-green-chemistry-report" ? "RV-01/RV-03" : node.actionId === "calculate-assigned-report-atom-economy" ? "RV-04" : "RV-05/RV-06",
  basis: "M/C",
  rationale: "The report-review control remains lab-local and teacher-artifact-bound; it is not a physical technique action.",
  evaluated: true,
}));

const ownedFiles = [
  labPath,
  techniquePath,
  "scripts/generatorInputs/simulator/thermalDecompositionMassLoss.mjs",
  "scripts/checkCycle11GreenChemistryRoute.mjs",
  "src/investigations/purifyMixtureGreenChemistry/PurifyMixtureGreenChemistryPlayer.tsx",
  "src/investigations/purifyMixtureGreenChemistry/configuredComposition.ts",
  "src/investigations/purifyMixtureGreenChemistry/model.ts",
  "src/investigations/purifyMixtureGreenChemistry/routeAdapter.ts",
];

/**
 * The public lab binds an unconfigured placeholder to every open configuration slot, because the
 * compiler needs a concrete value for each `{{config.*}}` reference and the source manual fixes
 * none of them. The route recompiles with the teacher-approved configuration before any physical
 * operation runs, so the placeholder can never govern a run.
 */
const configurationDisposition = {
  publicLabBinding: lab.techniqueInstances.find((entry) => entry.instanceId === instanceId)
    .bindings.configuration,
  placeholderQuantityValue: 0,
  placeholderTextValue: "unconfigured-teacher-choice",
  executableConfigurationSource:
    "src/investigations/purifyMixtureGreenChemistry/configuredComposition.ts compiles the owned public source with the teacher-approved configuration bound to the technique instance.",
  adapterRuleSource:
    "greenChemistryRulesFromCompiled reads sampleMassG, warmDurationMin, heatingDurationMin, heatingIntensity, constantMassToleranceG, maximumHeatCycles, coolingEndpointC, coolingSurface and minimumReplicates back out of the compiled action parameters.",
  noAuthoredQuantity: true,
  sharedRequestForCycle12:
    "Register a green-chemistry setup in src/data/labSetup.ts so the public lab can carry an empty configuration like hard-water-analysis, quick-ache-relief-separation and paper-chromatography.",
};

const labNodeActionIds = lab.actions.map((action) => action.id);

const impact = {
  files: Object.fromEntries(ownedFiles.map((file) => [file, sha256(file)])),
  routeManifest: {
    techniqueId: technique.id,
    techniqueVersion,
    instanceId,
    expectedNodeCount: technique.actions.length + lab.process.nodes.length,
    expectedEdgeCount: technique.actions.length - 1 + lab.process.edges.length + 1,
    expectedActionCount: technique.actions.length + lab.actions.length,
    expectedTechniqueNodePrefix: `${instanceId}--`,
    expectedTechniqueEvidencePrefix: `${instanceId}--`,
    labOrchestrationInstanceId: "lab-orchestration",
    labOwnedActionIds: labNodeActionIds,
    // Read from the lab rather than restated here: a hard-coded list silently goes stale the next
    // time the source declares another witness.
    witnesses: lab.reachabilityWitnesses.map((witness) => witness.id),
    witnessDisposition:
      "No witness carries an approval or configuration branch predicate, so every witness compiles the same node set. The approved witnesses differ only in the tare convention they pin for thermal-decomposition, which changes compiled action parameters rather than the graph. Approval gates execution in the route adapter and the UI projection, not in the compiled node set.",
  },
  configurationDisposition,
};

const controls = [
  ["reset-investigation", "Reset investigation", "reset", [], "routeAdapter.reset"],
  ["plan-rationale", "Selective-heating rationale", "inquiry", [], "plan.rationale"],
  ["plan-sample-mass", "Proposed sample mass (g)", "inquiry", [], "plan.sampleMassG"],
  ["plan-heating-intensity", "Heating intensity", "inquiry", [], "plan.heatingIntensity"],
  ["plan-heating-duration", "Heating time per cycle (min)", "inquiry", [], "plan.heatingDurationMin"],
  ["plan-constant-mass-rule", "Proposed constant-mass rule", "inquiry", [], "plan.constantMassRule"],
  ["plan-replicates", "Replicates", "inquiry", [], "plan.replicates"],
  ["plan-apparatus-observations", "Apparatus, observations, and evidence", "inquiry", [], "plan.apparatusAndObservations"],
  ["plan-calculations", "Calculation approach", "inquiry", [], "plan.calculations"],
  ["plan-uncertainty", "Uncertainty plan", "inquiry", [], "plan.uncertainty"],
  ["plan-safety", "Safety precautions", "inquiry", [], "plan.safety"],
  ["plan-recovery", "Recovery plan", "inquiry", [], "plan.recovery"],
  ["config-constant-mass-tolerance", "Constant-mass tolerance (g)", "teacher-configuration", [], "configuration.constantMassToleranceG"],
  ["config-maximum-heat-cycles", "Maximum heat cycles", "teacher-configuration", [], "configuration.maximumHeatCycles"],
  ["config-warm-duration", "Approved gentle warm-up duration (min)", "teacher-configuration", [], "configuration.warmDurationMin"],
  ["config-heating-duration", "Approved cycle duration (min)", "teacher-configuration", [], "configuration.heatingDurationMin"],
  ["config-cooling-endpoint", "Teacher-approved cool endpoint (°C)", "teacher-configuration", [], "configuration.coolingEndpointC"],
  ["config-cooling-surface", "Approved cooling location", "teacher-configuration", [], "configuration.coolingSurface"],
  ["config-ppe", "Baseline PPE / local safety policy", "teacher-configuration", [], "configuration.ppeRequirements"],
  ["config-tare-convention", "Tare convention", "teacher-configuration", [], "configuration.tareConvention"],
  ["config-minimum-replicates", "Minimum replicates", "teacher-configuration", [], "configuration.minimumReplicates"],
  ["config-percentage-tolerance", "Percentage tolerance (percentage points)", "teacher-configuration", [], "configuration.acceptableCompositionUncertaintyPercent"],
  ["config-calculation-tolerance", "Mass-calculation tolerance (g)", "teacher-configuration", [], "configuration.calculationToleranceG"],
  ["config-report-assignment", "Assigned peer report", "teacher-configuration", [], "configuration.reportAssignment"],
  ["report-text", "Assigned report content", "teacher-report", [], "assignedReport.text"],
  ["report-desired-product", "Desired product convention", "teacher-report", [], "assignedReport.desiredProduct"],
  ["report-desired-product-mass", "Desired-product stoichiometric mass contribution (g)", "teacher-report", [], "assignedReport.desiredProductStoichiometricMassG"],
  ["report-reactant-mass", "Total-reactant stoichiometric mass contribution (g)", "teacher-report", [], "assignedReport.totalReactantStoichiometricMassG"],
  ["config-reheat-shared-product", "Teacher manages post-session reheating", "teacher-configuration", [], "configuration.reheatSharedProductAfterSession"],
  ["approve-plan", "Teacher approve and unlock execution", "approval", ["approve-thermal-decomposition-plan"], "executeRouteSequence"],
  ["balance-reading-input", "Observed balance display (g)", "measurement-input", ["read-empty-crucible", "weigh-initial-crucible", "weigh-preliminary-final-mass", "weigh-final-crucible"], "studentMeasurement.valueG"],
  ["read-empty-balance-a", "Read empty on Balance A", "procedure", ["place-balance", "place-empty-crucible", "read-empty-crucible"], "readEmptyMass(balance-a)"],
  ["read-empty-balance-b", "Read empty on Balance B", "procedure", ["place-balance", "place-empty-crucible", "read-empty-crucible"], "readEmptyMass(balance-b)"],
  ["load-sample", "Load approved carbonate-mixture portion", "procedure", ["add-carbonate-sample"], "loadSample"],
  ["read-loaded-balance-a", "Read loaded on Balance A", "procedure", ["weigh-initial-crucible"], "readLoadedMass(balance-a)"],
  ["read-loaded-balance-b", "Read loaded on Balance B", "procedure", ["weigh-initial-crucible"], "readLoadedMass(balance-b)"],
  ["record-displayed-reading", "Record displayed reading", "evidence", ["record-empty-crucible", "record-initial-crucible-mass", "record-cycle-mass", "record-final-crucible-mass"], "recordCurrentMassReading"],
  ["recover-unused-sample-unused", "Recover unused unheated mixture", "recovery", ["recover-unused-sample"], "destination=unused"],
  ["recover-unused-sample-product", "Recover excess into product vessel", "recovery", ["recover-unused-sample"], "destination=product"],
  ["assembly-ring-stand", "Place the ring stand", "procedure", ["place-ring-stand"], "addAssemblyStep"],
  ["assembly-clay-triangle", "Seat the clay triangle", "procedure", ["add-clay-triangle"], "addAssemblyStep"],
  ["assembly-bunsen-burner", "Place the Bunsen burner", "procedure", ["place-bunsen-burner"], "addAssemblyStep"],
  ["assembly-crucible", "Place the crucible on the support", "procedure", ["place-crucible-on-support"], "addAssemblyStep"],
  ["lid-off", "Set lid off", "safety-gate", ["set-crucible-lid"], "position=off"],
  ["lid-closed", "Set lid fully seated", "safety-gate", ["set-crucible-lid"], "position=closed"],
  ["lid-askew", "Set lid askew", "safety-gate", ["set-crucible-lid"], "position=askew"],
  ["heat-cycle", "Heat cycle", "procedure", ["warm-gently", "heat-carbonate-mixture", "repeat-heat-to-constant-mass"], "heatCrucible"],
  ["extinguish-burner", "Extinguish burner", "safety", ["turn-off-burner"], "extinguishBurner"],
  ["cool-crucible", "Move with tongs and cool", "safety", ["cool-crucible", "cool-constant-mass-crucible"], "coolCrucible"],
  ["read-cycle-balance-a", "Read cooled on Balance A", "procedure", ["weigh-preliminary-final-mass", "weigh-final-crucible"], "readCycleMass(balance-a)"],
  ["read-cycle-balance-b", "Read cooled on Balance B", "procedure", ["weigh-preliminary-final-mass", "weigh-final-crucible"], "readCycleMass(balance-b)"],
  ["recover-replicate-unused", "Recover replicate to unused vessel", "recovery", ["recover-replicate-product", "complete-replicate"], "destination=unused"],
  ["recover-replicate-product", "Recover replicate to product vessel", "recovery", ["recover-replicate-product", "complete-replicate"], "destination=product"],
  ["continue-analysis", "Continue to composition analysis", "phase-transition", [], "beginAnalysis"],
  ["analysis-mass-loss", "Mass lost (g)", "analysis-input", ["calculate-carbonate-composition"], "analysis.massLossG"],
  ["analysis-final-na2co3", "Final Na2CO3 product mass (g)", "analysis-input", ["calculate-carbonate-composition"], "analysis.finalSodiumCarbonateMassG"],
  ["analysis-starting-nahco3", "Starting NaHCO3 mass (g)", "analysis-input", ["calculate-carbonate-composition"], "analysis.sodiumBicarbonateMassG"],
  ["analysis-starting-na2co3", "Starting Na2CO3 mass (g)", "analysis-input", ["calculate-carbonate-composition"], "analysis.sodiumCarbonateMassG"],
  ["analysis-percent-nahco3", "NaHCO3 (%)", "analysis-input", ["calculate-carbonate-composition"], "analysis.sodiumBicarbonatePercent"],
  ["analysis-percent-na2co3", "Na2CO3 (%)", "analysis-input", ["calculate-carbonate-composition"], "analysis.sodiumCarbonatePercent"],
  ["analysis-uncertainty", "Uncertainty and limitations", "analysis-input", ["record-composition-uncertainty"], "analysis.uncertainty"],
  ["submit-composition", "Submit composition", "analysis-submit", ["calculate-carbonate-composition", "record-composition-uncertainty"], "submitAnalysis"],
  ["recover-final-unused", "Recover final material as unused", "recovery", ["recover-final-product"], "destination=unused"],
  ["recover-final-product", "Recover final material as product", "recovery", ["recover-final-product"], "destination=product"],
  ["review-investigation-quality", "Investigation quality", "review-input", [], "review.investigationQuality"],
  ["review-communication-quality", "Reporting quality", "review-input", [], "review.communicationQuality"],
  ["review-desired-product", "Desired product identified", "review-input", [], "review.desiredProduct"],
  ["review-atom-economy", "Atom economy (%)", "review-input", [], "review.atomEconomyPercent"],
  ["review-additional-principle", "One additional green-chemistry principle", "review-input", [], "review.additionalGreenPrinciple"],
  ["review-recommendations", "Concise improvement recommendations", "review-input", [], "review.recommendations"],
  ["review-person-style", "Recommendation voice", "review-input", [], "review.personStyle"],
  ["submit-peer-review", "Submit assigned peer review", "review-submit", ["review-assigned-green-chemistry-report", "calculate-assigned-report-atom-economy", "complete-green-chemistry-peer-review"], "submitPeerReview"],
].map(([controlId, label, surface, actionIds, handler]) => ({
  controlId,
  label,
  surface,
  handler,
  target: actionIds.length === 0
    ? { kind: "typed-nonphysical-projection", routeState: handler }
    : actionIds.every((actionId) => labNodeActionIds.includes(actionId))
      ? {
          kind: "compiled-lab-owned-node",
          labId: lab.id,
          instanceId: "lab-orchestration",
          actionIds,
          nodeIds: actionIds.map((actionId) => actionId + "-node"),
          evidenceOutputIds: [],
        }
      : {
          kind: "compiled-technique-action",
          techniqueId: technique.id,
          techniqueVersion,
          instanceId,
          actionIds,
          nodeIds: actionIds.map(techniqueNodeId),
          evidenceOutputIds: actionIds.flatMap((actionId) =>
            (evidenceByActionId.get(actionId) ?? []).map((output) => techniqueEvidenceId(output.id)),
          ),
        },
  approval: ["approval", "procedure", "safety", "recovery", "analysis-submit", "review-submit"].includes(surface) ? "teacher-approved-plan" : "not-applicable",
  access: "pointer-keyboard-accessible-control",
  recovery: "normal route notice plus adapter rejection; reset-investigation clears route state",
  evaluated: true,
}));

const map = {
  schema: "lab-studio/route-control-map@1",
  lane: "11",
  baselineRevision: baseline.baselineRevision,
  baselineManifestSha256: sha256("planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json"),
  baselineAggregateSha256: baseline.source.gitTreeListingSha256,
  owners: ownedFiles,
  route: impact.routeManifest,
  configurationDisposition,
  controls,
  coverage: {
    controlCount: controls.length,
    uniqueControlIds: new Set(controls.map((control) => control.controlId)).size,
    duplicateControlIds: controls.map((control) => control.controlId).filter((id, index, ids) => ids.indexOf(id) !== index),
    everyControlMappedExactlyOnce: controls.length === new Set(controls.map((control) => control.controlId)).size,
    noExpectedMeasurementsOrResults: true,
  },
  validationBoundary: "Source review, compile-output identity review, the narrow scripts/checkCycle11GreenChemistryRoute.mjs adapter/evidence walk, node check, typecheck, targeted generator comparison, JSON checks, and git diff check only. No runtime, browser, detailed test, build, deployment, physical-safety or classroom-disposal validation.",
};

const techniqueOverlay = {
  schema: "lab-studio/technique-atomicity-overlay@1",
  lane: "11",
  baselineRevision: baseline.baselineRevision,
  baselineManifestSha256: sha256("planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json"),
  baselineAggregateSha256: baseline.source.gitTreeListingSha256,
  baselineDisposition: "Frozen revision 9 audit rows are carried as historical identity; every current thermal action is evaluated against the regenerated 1.1.0 composition contract.",
  frozenTechniqueAuditSha256: baseline.contractDependencies.techniqueAtomicityAuditSha256,
  frozenLabAuditSha256: baseline.contractDependencies.labCompositionAuditSha256,
  frozenRegistrySha256: baseline.contractDependencies.sourceTraceRegistrySha256,
  owners: [techniquePath, "scripts/generatorInputs/simulator/thermalDecompositionMassLoss.mjs", "src/investigations/purifyMixtureGreenChemistry/routeAdapter.ts", "src/investigations/purifyMixtureGreenChemistry/configuredComposition.ts"],
  validationBoundary: map.validationBoundary,
  rows: actionRows,
  baselineRows: baselineTechRows.map((row) => ({
    rowId: row.rowId,
    actionId: row.actionId,
    replacementActionId: row.actionId,
    replacementVersion: techniqueVersion,
    priorVerdict: row.atomicity?.verdict ?? null,
    disposition: "Replaced by the source-traced 1.1.0 action with explicit configuration, evidence, and recovery boundaries.",
    evaluated: true,
  })),
};

const sourceOverlay = {
  schema: "lab-studio/source-trace-overlay@1",
  lane: "11",
  baselineRevision: baseline.baselineRevision,
  baselineManifestSha256: sha256("planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json"),
  baselineAggregateSha256: baseline.source.gitTreeListingSha256,
  owners: [labPath, techniquePath, "src/investigations/purifyMixtureGreenChemistry/routeAdapter.ts", "src/investigations/purifyMixtureGreenChemistry/configuredComposition.ts"],
  configurationDisposition,
  sourceRegistryDisposition: "The shared source-trace registry remains frozen; this lane-owned overlay supplies the cycle-11 trace/reconciliation for the modified green route.",
  validationBoundary: map.validationBoundary,
  rows: actionRows.map((row) => ({
    rowId: row.rowId,
    owner: `technique:${row.techniqueId}`,
    actionId: row.actionId,
    atomId: row.atomId,
    ...row.sourceLocator,
    sourceConflict: row.sourceConflict,
    evaluated: true,
  })),
  labLocalActions: localActionRows,
};

const localNodeRows = lab.process.nodes.map((node) => ({
  rowId: `${lab.id}#${node.id}`,
  labId: lab.id,
  nodeId: node.id,
  actionId: node.actionId,
  techniqueId: null,
  techniqueVersion: null,
  instanceId: null,
  reachability: "mandatory-after-technique-exit",
  incoming: lab.process.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from),
  outgoing: lab.process.edges.filter((edge) => edge.from === node.id).map((edge) => edge.to),
  effect: "lab-local teacher-artifact review; no physical technique claim",
  dispatch: "route adapter, lab-orchestration scope",
  evaluated: true,
}));
const techniqueNodeRows = technique.actions.map((action, index) => ({
  rowId: `${lab.id}#${techniqueNodeId(action.id)}`,
  labId: lab.id,
  nodeId: techniqueNodeId(action.id),
  actionId: action.id,
  techniqueId: technique.id,
  techniqueVersion,
  instanceId,
  reachability: index === 0 ? "mandatory-after-approved-entry" : "mandatory-after-prior-technique-node",
  incoming: index === 0 ? [] : [techniqueNodeId(technique.actions[index - 1].id)],
  outgoing: index === technique.actions.length - 1
    ? [lab.process.nodes[0].id]
    : [techniqueNodeId(technique.actions[index + 1].id)],
  effect: effectByActionId.get(action.id)?.classes ?? ["evidence-recording"],
  evaluated: true,
}));

const compositionOverlay = {
  schema: "lab-studio/lab-composition-overlay@1",
  lane: "11",
  baselineRevision: baseline.baselineRevision,
  baselineManifestSha256: sha256("planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json"),
  baselineAggregateSha256: baseline.source.gitTreeListingSha256,
  frozenTechniqueAuditSha256: baseline.contractDependencies.techniqueAtomicityAuditSha256,
  frozenLabAuditSha256: baseline.contractDependencies.labCompositionAuditSha256,
  owners: [labPath, techniquePath, "src/investigations/purifyMixtureGreenChemistry/routeAdapter.ts", "src/investigations/purifyMixtureGreenChemistry/configuredComposition.ts"],
  validationBoundary: map.validationBoundary,
  compiledManifestWitness: impact.routeManifest,
  rows: [...techniqueNodeRows, ...localNodeRows],
  baselineRows: baselineLabRows.map((row) => ({
    rowId: row.rowId,
    priorNodeId: row.nodeId,
    priorActionId: row.actionId,
    replacementEntryNodeId: techniqueNodeId(technique.actions[0].id),
    replacementExitNodeId: techniqueNodeId(technique.actions[technique.actions.length - 1].id),
    disposition: "Replaced the one-node shim with the compiled thermal technique entry/exit and preserved local report-review nodes after the exit connection.",
    evaluated: true,
  })),
  carriers: {
    techniqueInstanceId: instanceId,
    compositionStart: lab.compositionStart,
    compositionConnections: lab.compositionConnections,
    localActionIds: lab.actions,
  },
};

fs.mkdirSync(evidenceDir, { recursive: true });
const write = (filename, value) =>
  fs.writeFileSync(path.join(evidenceDir, filename), `${JSON.stringify(value, null, 2)}\n`);
write("route-control-map.json", map);
write("source-trace-overlay.json", sourceOverlay);
write("technique-atomicity-overlay.json", techniqueOverlay);
write("lab-composition-overlay.json", compositionOverlay);
console.log(`wrote Cycle 11 evidence: ${controls.length} controls, ${actionRows.length} technique rows, ${compositionOverlay.rows.length} composition rows`);
