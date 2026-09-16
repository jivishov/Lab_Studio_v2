/**
 * Narrow, source/static Cycle 11 verifier for the green-chemistry purification route.
 *
 * It compiles the owned public composition twice — once with the lab's unconfigured placeholder
 * and once with a teacher-approved configuration — and drives the route adapter over the compiled
 * definition. Nothing here starts Vite, a browser, a test runner or a runtime session, and no
 * expected measurement is authored: the walk supplies learner-entered balance displays and asserts
 * only the route's approval, evidence, ordering, safety and recovery boundaries.
 *
 * Run with:
 *   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
 *     scripts/checkCycle11GreenChemistryRoute.mjs
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import { assertConfigured } from "../src/investigations/purifyMixtureGreenChemistry/configuredComposition.ts";
import {
  createGreenChemistryRouteAdapter,
  createInitialGreenChemistryRouteState,
  GREEN_CHEMISTRY_APPROVAL_PLAN_FIELDS,
  GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS,
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
  GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS,
  validateGreenChemistryRouteManifest,
} from "../src/investigations/purifyMixtureGreenChemistry/routeAdapter.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) =>
  JSON.parse(await readFile(join(root, relativePath), "utf8"));

const LAB_PATH = "public/labs/green-chemistry-mixture-purification.json";
const INSTANCE_ID = "thermal-decomposition";

const failures = [];
const check = (label, condition, detail = "") => {
  if (!condition) failures.push(detail ? `${label}: ${detail}` : label);
};

const techniqueIndex = await readJson("public/techniques/index.json");
const techniqueByIdentity = new Map(techniqueIndex.map((entry) => [entry.id, entry]));
const resolveTechnique = async (id) => {
  const entry = techniqueByIdentity.get(id);
  if (!entry) throw new Error(`Technique ${id} is not present in public/techniques/index.json.`);
  return readJson(`public/techniques/${entry.file ?? `${id}.json`}`);
};

const source = await readJson(LAB_PATH);

/** A teacher configuration. Every value is a classroom choice, not a source-fixed quantity. */
const APPROVED_CONFIGURATION = {
  sampleMassG: 2,
  warmDurationMin: 2,
  heatingDurationMin: 6,
  heatingIntensity: "medium blue cone",
  constantMassToleranceG: 0.01,
  maximumHeatCycles: 5,
  coolingEndpointC: 22,
  coolingSurface: "wire gauze on the bench mat",
  tareConvention: "record-crucible-plus-lid",
  minimumReplicates: 2,
};

/**
 * The teacher's runtime stock setup. These are browser-held setup values rather than compiled
 * configuration slots, so they are supplied to the configuring step instead of to the compiler.
 * 12 g issued 2.5 g at a time leaves 0.5 g of unheated excess per replicate and 7 g of stock the
 * class never used.
 */
const APPROVED_STOCK = { stockMassG: 12, workingPortionMassG: 2.5 };

/** Learner-entered balance displays for the walk. No expected composition is asserted. */
const ENTERED_DISPLAYS = [
  { emptyG: 20.0, loadedG: 22.0, cycleG: [21.4, 21.395] },
  { emptyG: 20.001, loadedG: 22.004, cycleG: [21.41, 21.404] },
];

const compileWith = async (configuration) => {
  const configured = structuredClone(source);
  const instance = configured.techniqueInstances.find(
    (candidate) => candidate.instanceId === INSTANCE_ID,
  );
  if (configuration) {
    instance.bindings.configuration = { ...instance.bindings.configuration, ...configuration };
  }
  return compileLabComposition(configured, resolveTechnique);
};

// 1. The public lab's own configuration must be an unusable placeholder.
const placeholder = source.techniqueInstances.find(
  (candidate) => candidate.instanceId === INSTANCE_ID,
).bindings.configuration;
check(
  "public lab configuration is an unconfigured placeholder",
  assertConfigured(placeholder).length > 0,
  "assertConfigured accepted the public lab's own configuration",
);
const placeholderDefinition = await compileWith(undefined);
check(
  "placeholder composition still compiles for catalog consumers",
  placeholderDefinition.compositionManifest?.status === "compiled",
);
check(
  "placeholder compile is rejected by the route",
  validateGreenChemistryRouteManifest(placeholderDefinition).length > 0,
);
const placeholderAdapter = createGreenChemistryRouteAdapter(placeholderDefinition);
const placeholderApproval = placeholderAdapter.execute(
  createInitialGreenChemistryRouteState(),
  {
    instanceId: INSTANCE_ID,
    actionId: "approve-thermal-decomposition-plan",
    payload: { ...placeholder },
  },
);
check(
  "placeholder compile cannot record approval",
  !placeholderApproval.ok && placeholderApproval.rejection.code === "manifest-target-mismatch",
  placeholderApproval.ok ? "approval succeeded" : placeholderApproval.rejection.code,
);

// 2. The configured compile must satisfy every declared route target and lab-node projection.
const definition = await compileWith(APPROVED_CONFIGURATION);
const manifest = definition.compositionManifest;
check("configured composition compiles", manifest?.status === "compiled");
check(
  "configured route map validates",
  validateGreenChemistryRouteManifest(definition).length === 0,
  validateGreenChemistryRouteManifest(definition).join(" "),
);
check(
  "every compiled technique origin is a declared route target",
  manifest.origins.every((origin) =>
    GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS.some(
      (target) => target.actionId === origin.actionId,
    ),
  ),
);
check(
  "declared route targets cover the compiled technique origins exactly",
  GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS.length === manifest.origins.length,
  `${GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS.length} targets vs ${manifest.origins.length} origins`,
);

const adapter = createGreenChemistryRouteAdapter(definition);
let state = createInitialGreenChemistryRouteState();
const approvalPayload = {
  ...APPROVED_CONFIGURATION,
  ...Object.fromEntries(
    GREEN_CHEMISTRY_APPROVAL_PLAN_FIELDS.map((field) => [field, `approved ${field}`]),
  ),
};

const run = (label, actionId, payload = {}, instanceId = INSTANCE_ID) => {
  const result = adapter.execute(state, { instanceId, actionId, payload });
  if (!result.ok) {
    failures.push(`${label} (${actionId}) was rejected: ${result.rejection.code}`);
    return false;
  }
  state = result.state;
  return true;
};

const reject = (label, actionId, payload = {}, expectedCode, instanceId = INSTANCE_ID) => {
  const result = adapter.execute(state, { instanceId, actionId, payload });
  if (result.ok) {
    failures.push(`${label} (${actionId}) should have been rejected but succeeded`);
    return;
  }
  check(label, result.rejection.code === expectedCode, `got ${result.rejection.code}`);
};

// 3. Nothing physical runs before approval, and approval must match the compiled configuration.
reject("unapproved execution blocked", "place-balance", { balanceId: "balance-a" }, "teacher-approval-required");
reject(
  "approval without the learner plan blocked",
  "approve-thermal-decomposition-plan",
  { ...APPROVED_CONFIGURATION },
  "approval-incomplete",
);
reject(
  "approval disagreeing with the compiled instance blocked",
  "approve-thermal-decomposition-plan",
  { ...approvalPayload, heatingDurationMin: APPROVED_CONFIGURATION.heatingDurationMin + 1 },
  "approval-configuration-mismatch",
);
run("approval", "approve-thermal-decomposition-plan", approvalPayload);

// 3b. The run cannot start on a stock that could not supply the approved replicates.
reject(
  "a working portion smaller than the approved portion is blocked",
  "configure-unheated-stock",
  { stockMassG: 12, workingPortionMassG: APPROVED_CONFIGURATION.sampleMassG - 0.1 },
  "working-portion-too-small",
);
reject(
  "a stock too small for the approved replicates is blocked",
  "configure-unheated-stock",
  { stockMassG: 2.5, workingPortionMassG: 2.5 },
  "stock-insufficient",
);
run("stock configured", "configure-unheated-stock", APPROVED_STOCK);
reject(
  "reconfiguring the stock mid-run is blocked",
  "configure-unheated-stock",
  APPROVED_STOCK,
  "stock-already-configured",
);

// 4. Walk each approved replicate through the compiled sequence.
const replicateWalk = (replicateIndex) => {
  const entered = ENTERED_DISPLAYS[replicateIndex];
  const balanceId = "balance-a";
  if (replicateIndex === 0) {
    run("balance placed", "place-balance", { balanceId });
    reject("second balance blocked", "place-balance", { balanceId: "balance-b" }, "same-balance-required");
  }
  run("empty crucible placed", "place-empty-crucible");
  reject(
    "cross-balance empty reading blocked",
    "read-empty-crucible",
    { balanceId: "balance-b", valueG: entered.emptyG },
    "same-balance-required",
  );
  reject(
    "recording before reading blocked",
    "record-empty-crucible",
    {},
    "empty-reading-required",
  );
  run("empty read", "read-empty-crucible", { balanceId, valueG: entered.emptyG });
  run("empty recorded", "record-empty-crucible");
  reject(
    "unapproved portion blocked",
    "add-carbonate-sample",
    { massG: APPROVED_CONFIGURATION.sampleMassG + 0.5 },
    "approved-portion-required",
  );
  const stockBeforeIssueG = state.material.instances.find(
    (instance) => instance.id === state.material.holders.masterStockInstanceId,
  ).contents.massG;
  run("sample transferred", "add-carbonate-sample", { massG: APPROVED_CONFIGURATION.sampleMassG });
  check(
    `replicate ${replicateIndex + 1} issued one working portion from the master stock`,
    state.material.instances.find(
      (instance) => instance.id === state.material.holders.masterStockInstanceId,
    ).contents.massG === Number((stockBeforeIssueG - APPROVED_STOCK.workingPortionMassG).toFixed(6)),
  );
  check(
    `replicate ${replicateIndex + 1} loaded the approved portion into the crucible`,
    state.material.instances.find(
      (instance) => instance.id === state.material.holders.crucibleInstanceId,
    ).contents.massG === APPROVED_CONFIGURATION.sampleMassG,
  );
  reject(
    "a second load before the replicate closes is blocked",
    "add-carbonate-sample",
    { massG: APPROVED_CONFIGURATION.sampleMassG },
    "replicate-already-loaded",
  );
  run("loaded read", "weigh-initial-crucible", { balanceId, valueG: entered.loadedG });
  run("loaded recorded", "record-initial-crucible-mass");
  reject(
    "unheated mixture into the product vessel blocked",
    "recover-unused-sample",
    { destination: "product" },
    "wrong-recovery-stream",
  );
  run("unused mixture recovered", "recover-unused-sample", { destination: "unused" });
  check(
    `replicate ${replicateIndex + 1} returned its unheated excess`,
    state.material.active.excessReturnedG
      === Number(
        (APPROVED_STOCK.workingPortionMassG - APPROVED_CONFIGURATION.sampleMassG).toFixed(6),
      ),
    String(state.material.active.excessReturnedG),
  );
  reject(
    "returning the unheated excess twice is blocked",
    "recover-unused-sample",
    { destination: "unused" },
    "excess-already-recovered",
  );
  if (replicateIndex === 0) {
    run("ring stand placed", "place-ring-stand");
    run("clay triangle seated", "add-clay-triangle");
    run("burner placed", "place-bunsen-burner");
  } else {
    reject("assembled support is not rebuilt", "place-ring-stand", {}, "apparatus-order");
  }
  run("crucible on support", "place-crucible-on-support", {});
  run("lid closed", "set-crucible-lid", { position: "closed" });
  reject("closed-lid ignition blocked", "warm-gently", {}, "lid-vent-required");
  run("lid askew", "set-crucible-lid", { position: "askew" });
  run("gentle warm", "warm-gently", { durationMin: APPROVED_CONFIGURATION.warmDurationMin });
  run("first heat", "heat-carbonate-mixture", { durationMin: APPROVED_CONFIGURATION.heatingDurationMin });
  reject("weighing a hot crucible blocked", "weigh-preliminary-final-mass", { balanceId, valueG: entered.cycleG[0] }, "cooling-required");
  run("burner off", "turn-off-burner");
  run("first cooling", "cool-crucible");
  run("first cooled read", "weigh-preliminary-final-mass", { balanceId, valueG: entered.cycleG[0] });
  run("first cooled recorded", "record-cycle-mass");
  reject(
    "final mass without a constant-mass comparison blocked",
    "record-final-crucible-mass",
    {},
    "constant-mass-required",
  );
  run("repeat heat", "repeat-heat-to-constant-mass", { cycleIndex: 2 });
  run("burner off again", "turn-off-burner");
  run("repeat cooling", "cool-constant-mass-crucible");
  run("second cooled read", "weigh-final-crucible", { balanceId, valueG: entered.cycleG[1] });
  run("second cooled recorded", "record-cycle-mass");
  check(
    `replicate ${replicateIndex + 1} reached constant mass from entered displays`,
    state.cycles[state.cycles.length - 1]?.constant === true,
  );
  run("final mass recorded", "record-final-crucible-mass");
  reject(
    "heated product into the unused vessel blocked",
    "recover-replicate-product",
    { destination: "unused" },
    "wrong-recovery-stream",
  );
  run("replicate product recovered", "recover-replicate-product", { destination: "product" });
  const productReceiver = state.material.instances.find(
    (instance) => instance.id === state.material.holders.productRecoveryInstanceId,
  );
  check(
    `replicate ${replicateIndex + 1} product carries provenance and no invented mass`,
    productReceiver.contents.massG === undefined
      && productReceiver.contents.solutes.length === 0
      && productReceiver.contents.qualitativeSolidProvenance.length === replicateIndex + 1
      && productReceiver.contents.qualitativeSolidProvenance[replicateIndex]
        .destinationPhysicalMassKnown === false,
  );
  check(
    `replicate ${replicateIndex + 1} emptied its crucible`,
    (state.material.instances.find(
      (instance) => instance.id === state.material.holders.crucibleInstanceId,
    ).contents.massG ?? 0) === 0,
  );
  reject(
    "collecting the same replicate product twice is blocked",
    "recover-replicate-product",
    { destination: "product" },
    "product-already-recovered",
  );
  run("replicate completed", "complete-replicate", { replicateId: replicateIndex + 1 });
};

replicateWalk(0);
reject(
  "analysis before every approved replicate blocked",
  "calculate-carbonate-composition",
  { validated: true },
  "measurement-derived-calculation-required",
);
replicateWalk(1);

check(
  "the locked balance survives replicate boundaries",
  state.selectedBalance === "balance-a",
);
check(
  "every approved replicate is closed",
  state.completedReplicates.length === APPROVED_CONFIGURATION.minimumReplicates,
  `${state.completedReplicates.length} closed`,
);

reject(
  "analysis before the run returns its remaining stock is blocked",
  "calculate-carbonate-composition",
  { validated: true },
  "measurement-derived-calculation-required",
);
run("remaining master stock returned", "finalize-unused-master-stock");
check(
  "the run is closed with its completed replicates frozen",
  state.runPhase === "closed"
    && state.material.closure.frozenReplicates.length
      === APPROVED_CONFIGURATION.minimumReplicates,
);
check(
  "the master stock returned exactly what it still held",
  state.material.closure.masterRemainderReturnedG
    === Number(
      (
        APPROVED_STOCK.stockMassG
        - APPROVED_CONFIGURATION.minimumReplicates * APPROVED_STOCK.workingPortionMassG
      ).toFixed(6),
    ),
  String(state.material.closure.masterRemainderReturnedG),
);
check(
  "the Unused Sample container holds every returned unheated gram",
  state.material.instances.find(
    (instance) => instance.id === state.material.holders.unusedRecoveryInstanceId,
  ).contents.massG
    === Number(
      (
        APPROVED_STOCK.stockMassG
        - APPROVED_CONFIGURATION.minimumReplicates * APPROVED_CONFIGURATION.sampleMassG
      ).toFixed(6),
    ),
);
reject(
  "loading after the run closes is blocked",
  "add-carbonate-sample",
  { massG: APPROVED_CONFIGURATION.sampleMassG },
  "run-closed",
);
reject(
  "closing the run twice is blocked",
  "finalize-unused-master-stock",
  {},
  "run-closed",
);
reject(
  "unvalidated arithmetic blocked",
  "calculate-carbonate-composition",
  { validated: false },
  "measurement-derived-calculation-required",
);
run("composition calculated", "calculate-carbonate-composition", {
  calculationId: "composition-analysis",
  validated: true,
});
reject("uncertainty text required", "record-composition-uncertainty", {}, "uncertainty-required");
run("uncertainty recorded", "record-composition-uncertainty", {
  note: "Balance resolution and transfer loss dominate the composition uncertainty.",
});
run("recoveries confirmed", "recover-final-product");
reject(
  "confirming the recoveries twice is blocked",
  "recover-final-product",
  {},
  "recoveries-already-confirmed",
);

// 5. The lab-owned report nodes are compiled nodes and must be dispatched as such.
reject(
  "lab node dispatched against the technique instance blocked",
  "review-assigned-green-chemistry-report",
  { assignedReport: "report", review: "review" },
  "unmapped-control",
);
reject(
  "technique action dispatched as lab orchestration blocked",
  "place-balance",
  { balanceId: "balance-a" },
  "unmapped-control",
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
);
reject(
  "atom economy before the assigned-report review blocked",
  "calculate-assigned-report-atom-economy",
  { atomEconomyPercent: 63.1, validated: true },
  "assigned-report-review-required",
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
);
run(
  "assigned report reviewed",
  "review-assigned-green-chemistry-report",
  { assignedReport: "teacher-provided report text", review: "evidence-based review" },
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
);
run(
  "assigned-report atom economy recorded",
  "calculate-assigned-report-atom-economy",
  { atomEconomyPercent: 63.1, validated: true },
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
);
run(
  "peer review completed",
  "complete-green-chemistry-peer-review",
  {
    additionalGreenPrinciple: "Design for energy efficiency.",
    recommendations: "Report the balance uncertainty with every mass.",
  },
  GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID,
);

// 6. Completion: every compiled action ran, and every required evidence output was produced.
const compiledTechniqueActions = manifest.origins.map((origin) => origin.actionId);
const missingActions = [...compiledTechniqueActions, ...GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS].filter(
  (actionId) => !state.completedActionIds.includes(actionId),
);
check(
  "every compiled action of the route ran",
  missingActions.length === 0,
  missingActions.join(", "),
);
const technique = await resolveTechnique("thermal-decomposition-mass-loss");
const producedEvidence = new Set(state.evidence.flatMap((entry) => entry.evidence));
const missingEvidence = technique.composition.completion.requiredEvidenceOutputIds.filter(
  (id) => !producedEvidence.has(`${INSTANCE_ID}--${id}`),
);
check(
  "every required technique evidence output was produced",
  missingEvidence.length === 0,
  missingEvidence.join(", "),
);
check("the peer review closed the route", state.peerReviewComplete === true);

// 7. Reset returns an unapproved state without inheriting recorded evidence.
const afterReset = adapter.reset(state);
check(
  "reset clears approval and recorded evidence",
  afterReset.approved === false &&
    afterReset.evidence.length === 0 &&
    afterReset.completedReplicates.length === 0 &&
    afterReset.selectedBalance === undefined,
);
check(
  "reset starts a fresh open run with no inherited material",
  afterReset.runPhase === "open"
    && afterReset.material === undefined
    && afterReset.runId !== state.runId,
);

// 8. The lane route-control map must cover the compiled route and the route's own dispatches.
const controlMap = await readJson(
  "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-11/route-control-map.json",
);
const controlIds = controlMap.controls.map((control) => control.controlId);
check(
  "route-control map has no duplicate control ids",
  new Set(controlIds).size === controlIds.length,
);
const mappedActionIds = new Set(
  controlMap.controls.flatMap((control) => control.target.actionIds ?? []),
);
const compiledActionIds = [...compiledTechniqueActions, ...GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS];
const unmappedCompiledActions = compiledActionIds.filter((id) => !mappedActionIds.has(id));
check(
  "route-control map covers every compiled action",
  unmappedCompiledActions.length === 0,
  unmappedCompiledActions.join(", "),
);
const strayMappedActions = [...mappedActionIds].filter((id) => !compiledActionIds.includes(id));
check(
  "route-control map maps no action the compiler does not own",
  strayMappedActions.length === 0,
  strayMappedActions.join(", "),
);
// Several ids are selected by a stage ternary or an apparatus lookup rather than written straight
// after `actionId:`, so the reference check looks for the id as a string literal anywhere in the
// component. The reverse direction — that no uncompiled id can be dispatched — is enforced by the
// adapter itself and exercised by the unmapped-control rejections above.
const playerSource = await readFile(
  join(root, "src/investigations/purifyMixtureGreenChemistry/PurifyMixtureGreenChemistryPlayer.tsx"),
  "utf8",
);
const unreferenced = compiledActionIds.filter((id) => !playerSource.includes(`"${id}"`));
check(
  "the route references every compiled action",
  unreferenced.length === 0,
  unreferenced.join(", "),
);

if (failures.length > 0) {
  console.error(`Cycle 11 route verifier failed with ${failures.length} finding(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `Cycle 11 route verifier passed: ${controlIds.length} mapped controls, ` +
    `${manifest.origins.length} compiled technique origins, ` +
    `${GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS.length} lab-owned nodes, ` +
    `${state.completedActionIds.length} distinct actions executed, ` +
    `${state.evidence.length} evidence records, ` +
    `${technique.composition.completion.requiredEvidenceOutputIds.length} required evidence outputs satisfied.`,
);
