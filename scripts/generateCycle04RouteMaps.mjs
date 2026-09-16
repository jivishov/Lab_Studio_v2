import { writeFileSync } from "node:fs";

const outputPath = "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_04_ROUTE_ADAPTER_FEASIBILITY.json";

const step = (techniqueId, techniqueVersion, instanceId, actionId, payloadBindings = {}, evidenceOutputIds = []) => ({
  techniqueId,
  techniqueVersion,
  instanceId,
  actionId,
  nodeId: `${instanceId}--${actionId}-node`,
  payloadBindings,
  evidenceOutputIds,
});

const acid = (actionId, payload = {}, evidence = []) =>
  step("titration-curve-analysis", "1.2.0", "acid-curve", actionId, payload, evidence);
const green = (actionId, payload = {}, evidence = []) =>
  step("thermal-decomposition-mass-loss", "1.1.0", "thermal-decomposition", actionId, payload, evidence);

const adapterControl = (id, controls, steps, details = {}) => ({
  id,
  controls,
  disposition: "adapter-sequence",
  orderedAtomicTargets: steps,
  prerequisite: details.prerequisite ?? "The compiled manifest is at this control group's first incomplete target; each later target also requires all earlier target evidence and its authored action prerequisites.",
  rejectPolicy: details.rejectPolicy ?? "Stop before the first invalid target; do not commit later targets.",
  feedbackOwner: details.feedbackOwner ?? "The rejected compiled action supplies its authored feedback.",
  recovery: details.recovery ?? "Correct the rejected target's authored prerequisite, then resume at that exact target.",
  reset: details.reset ?? "adapter.reset clears compiled and route-projection state for this control group.",
  access: details.access ?? "Native button/input supports keyboard and pointer or tablet touch.",
});

const configurationControl = (id, controls, techniqueId, techniqueVersion, instanceId, bindings, approvalActionId, details = {}) => ({
  id,
  controls,
  disposition: "configuration-binding",
  techniqueId,
  techniqueVersion,
  instanceId,
  configurationBindings: bindings,
  orderedAtomicTargets: approvalActionId
    ? [step(techniqueId, techniqueVersion, instanceId, approvalActionId, { configuration: "validated route fields" }, [`${instanceId}--approval`])]
    : [],
  prerequisite: details.prerequisite ?? "Every declared configuration slot is present, within its typed bounds, and not yet superseded by a later approval witness.",
  rejectPolicy: details.rejectPolicy ?? "Reject before approval when a declared slot is missing or outside its configured bounds.",
  feedbackOwner: "Route renders compiler/validator errors without completing a technique node.",
  recovery: "Revise the named field and resubmit the same configuration/approval target.",
  reset: details.reset ?? "Restore declared defaults and revoke the approval witness.",
  access: "Native inputs, selects, checkboxes, textareas, and button controls.",
});

const projectionControl = (id, controls, purpose, details = {}) => ({
  id,
  controls,
  disposition: "route-local-projection",
  techniqueId: null,
  techniqueVersion: null,
  instanceId: null,
  orderedAtomicTargets: [],
  projectionBoundary: purpose,
  completionRule: "This projection cannot complete, skip, or mutate a compiled technique node or evidence output.",
  prerequisite: details.prerequisite ?? "The named compiled completion/evidence projection already exists; this route-local control may display or annotate it but cannot create it.",
  rejectPolicy: details.rejectPolicy ?? "Disable or reject when the compiled prerequisite projection is incomplete.",
  feedbackOwner: "Route-local display/provenance feedback only.",
  recovery: details.recovery ?? "Complete the named compiled prerequisite or correct the route-local provenance field.",
  reset: details.reset ?? "Restore the initial route projection without altering authored configuration defaults.",
  access: details.access ?? "Native controls support keyboard and pointer or tablet touch.",
});

const artifact = {
  schema: "lab-studio/route-adapter-feasibility@2",
  baselineRevision: 1,
  adapter: {
    interface: "RouteTechniqueExecutionAdapter<RouteState>",
    targetInterface: "RouteTechniqueExecutionTarget",
    sequenceValidator: "validateRouteTechniqueExecutionTargets",
    dispatchRule: "Dispatch orderedAtomicTargets one at a time through execute; stop on first rejection.",
    manifestGate: "When Cycles 10 and 11 emit their exact family definitions, every adapter target must match compiler-issued instance/action/node/technique/version and named evidence outputs before route dispatch is enabled.",
    sharedGap: null,
    familyVersionRule: "Cycle 10 and 11 must emit the exact versions and IDs frozen here or return a coordinator shared-contract request before route implementation.",
  },
  routes: [
    {
      route: "acid-base-titration-curves",
      component: "src/investigations/acidBaseTitrationCurves/AcidBaseTitrationCurvesInvestigation.tsx",
      lane: "10-after-07",
      representabilityStatus: "exact-map-complete",
      controls: [
        projectionControl("section-navigation", ["brief", "practice", "plan", "run", "analyze", "class-data"], "Projects compiled completion/validation state into section visibility."),
        adapterControl("safety-acknowledgements", ["ppe checks", "teacher configuration check", "continue"], [
          acid("record-safety-acknowledgements", { ppeIds: "checked PPE values", teacherConfigurationAcknowledged: "checkbox value" }, ["acid-curve--safety-acknowledgement"]),
        ], { recovery: "Complete every configured acknowledgement and redispatch the one evidence action.", reset: "Clear acknowledgement evidence and return to brief." }),
        adapterControl("practice-sequence", ["test-and-record-litmus", "read-and-record-paper-pH", "measure-combine-observe", "deliver-to-color-change-read-pH", "add-excess-read-record"], [
          acid("test-litmus", { samples: "configured acid/base pair" }, ["acid-curve--litmus-observation"]),
          acid("read-paper-ph", { scaleReading: "student reading" }, ["acid-curve--paper-ph"]),
          acid("record-paper-ph", { measurementId: "practice-paper-ph" }, ["acid-curve--paper-ph-record"]),
          acid("measure-practice-reactants", { acidVolumeMl: "configured practice volume", baseVolumeMl: "configured practice volume" }),
          acid("combine-practice-reactants", { acidInstanceId: "configured acid", baseInstanceId: "configured base" }),
          acid("observe-practice-mixture", {}, ["acid-curve--mixture-observation"]),
          acid("deliver-practice-base-to-color-change", { deliveredVolumeMl: "student-controlled delivery" }),
          acid("read-practice-color-change-ph", { measurementId: "practice-color-change-ph" }, ["acid-curve--color-change-ph"]),
          acid("add-practice-base-excess", { deliveredVolumeMl: "configured remaining portion" }),
          acid("read-practice-final-ph", { measurementId: "practice-final-ph" }, ["acid-curve--final-ph"]),
          acid("record-practice-final-state", {}, ["acid-curve--practice-final-record"]),
        ]),
        configurationControl("plan-configuration", ["research question", "hypothesis", "combination selections", "aliquot", "coarse increment", "fine increment", "replicate count", "teacher initials", "validate-and-approve"], "titration-curve-analysis", "1.2.0", "acid-curve", {
          question: "research question", hypothesis: "hypothesis", combinationIds: "selected combinations", aliquotMl: "aliquot", coarseIncrementMl: "coarse increment", fineIncrementMl: "fine increment", replicateCount: "replicates", teacherInitials: "approval initials",
        }, "approve-titration-curve-plan"),
        adapterControl("bench-assembly", ["six ordered Confirm buttons from benchSteps"], [
          acid("place-ring-stand"), acid("mount-curve-burette"), acid("condition-curve-burette"), acid("fill-curve-burette"), acid("place-curve-ph-probe"), acid("start-gentle-stirring"),
        ]),
        adapterControl("run-acquisition", ["initial buret meniscus input", "prepare/start run", "record next pH-volume point for each configured replicate"], [
          acid("read-curve-initial-burette", { measurementId: "run-scoped initial burette reading" }, ["acid-curve--initial-burette"]),
          acid("record-curve-initial-burette", { measurementId: "run-scoped initial burette reading" }, ["acid-curve--initial-burette-record"]),
          acid("measure-curve-analyte", { volumeMl: "approved aliquot", measurementId: "run-scoped analyte volume" }),
          acid("transfer-curve-analyte"),
          acid("read-initial-ph", { measurementId: "run-scoped initial pH" }),
          acid("record-initial-ph", { measurementId: "run-scoped initial pH" }, ["acid-curve--initial-ph-record"]),
          acid("deliver-curve-titrant", { targetCumulativeVolumeMl: "next configured point" }),
          acid("read-stable-curve-ph", { measurementId: "run-and-point-scoped pH" }),
          acid("record-curve-point", { dataSeriesId: "run-scoped pH-volume series", volumeMl: "cumulative delivered volume", ph: "stable pH reading" }, ["acid-curve--ph-volume-series"]),
        ], { recovery: "Refill/reread the named instrument or revise the teacher-approved range, then resume at the rejected read/delivery/record target." }),
        adapterControl("analysis", ["per-run calculation fields", "check calculations", "particulate explanation", "uncertainty reflection", "continue"], [
          acid("record-equivalence-volume", { measurementId: "run-scoped equivalence volume" }, ["acid-curve--equivalence-volume"]),
          acid("calculate-curve-molarity", { calculationId: "run-scoped molarity", requireStudentValue: true }, ["acid-curve--molarity-calculation"]),
          acid("record-particulate-explanation", { note: "student explanation" }, ["acid-curve--particulate-analysis"]),
          acid("record-uncertainty-reflection", { note: "student reflection" }, ["acid-curve--uncertainty-reflection"]),
        ]),
        projectionControl("class-data", ["group id", "combination", "replicate", "equivalence volume", "curve text", "comparison note", "add record", "no class data available"], "Stores provenance-linked external comparison records; never completes a physical or acquisition node.", { recovery: "Correct provenance/curve bracketing or explicitly record that no independent class curve was available." }),
        adapterControl("cleanup-completion", ["measured waste pH", "instructor disposal confirmation"], [
          acid("read-waste-ph", { measurementId: "waste-ph" }, ["acid-curve--waste-ph"]),
          acid("record-waste-ph", { measurementId: "waste-ph" }, ["acid-curve--waste-ph-record"]),
          acid("confirm-instructor-disposal-route", { confirmed: "checkbox value" }, ["acid-curve--disposal-confirmation"]),
        ], { recovery: "Continue the configured neutralization, retest, and record a new reading before confirming disposal." }),
      ],
    },
    {
      route: "green-chemistry-mixture-purification",
      component: "src/investigations/purifyMixtureGreenChemistry/PurifyMixtureGreenChemistryPlayer.tsx",
      lane: "11",
      representabilityStatus: "exact-map-complete",
      controls: [
        projectionControl("restart", ["restart investigation"], "Calls adapter.reset and then restores the initial route projection.", { rejectPolicy: "Reset is always available.", recovery: "Not applicable.", reset: "Complete compiled and route reset." }),
        configurationControl("teacher-configuration", ["configuration fields", "two report records and conventions"], "thermal-decomposition-mass-loss", "1.1.0", "thermal-decomposition", {
          heatingDurationMin: "configured duration", maximumCycles: "configured cap", massToleranceG: "configured constant-mass tolerance", minimumReplicates: "configured replicate count", tareConvention: "configured tare convention", reportAssignments: "two report records",
        }),
        configurationControl("inquiry-plan", ["rationale", "sample mass", "heating intensity/duration", "constant-mass rule", "replicates", "apparatus/observations", "calculations", "uncertainty", "safety", "recovery", "approve plan"], "thermal-decomposition-mass-loss", "1.1.0", "thermal-decomposition", {
          rationale: "student rationale", sampleMassG: "planned sample mass", heatingIntensity: "planned intensity", heatingDurationMin: "planned duration", constantMassRule: "student rule", replicateCount: "planned replicates", apparatusPlan: "apparatus/observation plan", calculationPlan: "calculation plan", uncertaintyPlan: "uncertainty", safetyPlan: "safety", recoveryPlan: "recovery",
        }, "approve-thermal-decomposition-plan"),
        adapterControl("mass-baseline-and-loading", ["read empty mass on balance A/B", "record current reading", "load sample", "read loaded mass on locked balance A/B", "recover unused sample to unused/product"], [
          green("place-balance", { balanceId: "selected A/B balance" }), green("place-empty-crucible"),
          green("read-empty-crucible", { measurementId: "replicate-scoped empty mass" }, ["thermal-decomposition--empty-mass"]),
          green("record-empty-crucible", { measurementId: "replicate-scoped empty mass" }, ["thermal-decomposition--empty-mass-record"]),
          green("add-carbonate-sample", { massG: "approved sample mass" }),
          green("weigh-initial-crucible", { measurementId: "replicate-scoped loaded mass" }, ["thermal-decomposition--loaded-mass"]),
          green("record-initial-crucible-mass", { measurementId: "replicate-scoped loaded mass" }, ["thermal-decomposition--loaded-mass-record"]),
          green("recover-unused-sample", { destination: "unused-sample container" }, ["thermal-decomposition--unused-sample-recovery"]),
        ]),
        adapterControl("apparatus-and-lid", ["ordered apparatus steps", "lid off/askew/closed"], [
          green("place-ring-stand"), green("add-clay-triangle"), green("place-bunsen-burner"), green("place-crucible-on-support"), green("set-crucible-lid", { position: "off|askew|closed" }),
        ]),
        adapterControl("heat-cool-weigh-loop", ["heat", "extinguish", "cool", "read cycle mass A/B", "record current reading", "repeat cycle"], [
          green("warm-gently", { durationMin: "configured warm duration" }), green("heat-carbonate-mixture", { durationMin: "configured heating duration" }), green("turn-off-burner"), green("cool-crucible"),
          green("weigh-preliminary-final-mass", { measurementId: "replicate-and-cycle-scoped mass" }, ["thermal-decomposition--cycle-mass"]),
          green("record-cycle-mass", { measurementId: "replicate-and-cycle-scoped mass" }, ["thermal-decomposition--cycle-mass-record"]),
          green("repeat-heat-to-constant-mass", { cycleIndex: "next bounded cycle" }), green("cool-constant-mass-crucible"),
          green("weigh-final-crucible", { measurementId: "replicate-scoped final mass" }, ["thermal-decomposition--final-mass"]),
          green("record-final-crucible-mass", { measurementId: "replicate-scoped final mass" }, ["thermal-decomposition--final-mass-record"]),
        ], { recovery: "Extinguish, cool, correct the lid or balance lock, then resume at the rejected atomic target." }),
        adapterControl("replicate-recovery", ["recover intermediate product to unused/product", "begin analysis"], [
          green("recover-replicate-product", { destination: "unused|product", replicateId: "active replicate" }, ["thermal-decomposition--replicate-recovery"]),
          green("complete-replicate", { replicateId: "active replicate" }, ["thermal-decomposition--replicate-completion"]),
        ]),
        adapterControl("composition-analysis", ["six calculation fields", "uncertainty", "submit analysis"], [
          green("calculate-carbonate-composition", { calculationId: "composition-analysis", requireStudentValue: true }, ["thermal-decomposition--composition-calculation"]),
          green("record-composition-uncertainty", { note: "student uncertainty analysis" }, ["thermal-decomposition--uncertainty-record"]),
        ]),
        adapterControl("final-product-recovery", ["recover final product to unused/product"], [
          green("recover-final-product", { destination: "product container" }, ["thermal-decomposition--final-product-recovery"]),
        ], { recovery: "Use the configured product container after the final cooled mass is recorded." }),
        projectionControl("peer-review-completion", ["five review text fields", "green principle select", "submit peer review"], "Records route-owned peer-review/report evidence after compiled product recovery; it cannot complete physical procedure nodes.", { recovery: "Complete all assigned report fields and reconcile the desired-product identity before resubmission." }),
      ],
    },
  ],
};

artifact.freezeVerdict = "PASS as a fail-closed future family contract. All 19 state-changing control groups have explicit prerequisite/rejection/feedback/recovery/reset/access semantics and either an exact ordered technique/version/instance/action/node/payload/evidence target contract or a route-local projection that cannot complete compiled procedure. Compiler-issued identity validation remains a Cycle 10/11 implementation gate because those family definitions do not yet exist; no Cycle 04 shared adapter capability remains open.";

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(outputPath, serialized);
  console.log(`wrote ${outputPath}`);
} else {
  process.stdout.write(serialized);
}
