/**
 * Cycle 10 route-execution verifier.
 *
 * Compiles every declared reachability witness of the acid-base titration-curves composition and
 * drives the route adapter through the compiled root process for each one. It proves, from source
 * and static compilation only, that:
 *
 *   - the route's independently declared formal-trial targets and lab-node projections match the
 *     compiler-issued identities for every witness (no vacuous filtering);
 *   - each configured context compiles its own witness, so a combination cannot execute against
 *     another context's chemistry model;
 *   - the ordered traversal reaches every compiled node except the rejected-attempt branch, which
 *     is then shown to be reachable and to withdraw only that attempt's evidence;
 *   - the delivery, endpoint-decision, approval, student-response, and waste gates are fail-closed
 *     against the compiled contract rather than against route-local booleans.
 *
 * It does not start Vite, a browser, a test runner, or a runtime session. Run with:
 *
 *   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
 *     scripts/verifyCycle10RouteExecution.mjs
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import { generateTitrationCurve } from "../src/investigations/acidBaseTitrationCurves/model.ts";
import {
  CONTINUE_DELIVERY,
  DISPOSE_AND_RESTART_TRIAL,
  FINISH_AFTER_STABILITY_REVIEW,
  FORMAL_INSTANCE_ID,
  LAB_ORCHESTRATION_INSTANCE_ID,
  acidBaseRouteContextId,
  clearRetriedAttempt,
  createAcidBaseRouteAdapter,
  createInitialAcidBaseRouteState,
  isPlanApproved,
  validateAcidBaseRouteDefinition,
} from "../src/investigations/acidBaseTitrationCurves/routeAdapter.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(await readFile(join(root, relativePath), "utf8"));

const lab = await readJson("public/labs/acid-base-titration-curves.json");
const config = await readJson("public/labs/acid-base-titration-curves-config.json");
const resolveTechnique = async (id) => await readJson(`public/techniques/${id}.json`);

const failures = [];
const check = (condition, label) => {
  if (!condition) failures.push(label);
};

const preflightActionIds = [
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
const assemblyActionIds = [
  "formal-trial-place-ring-stand",
  "formal-trial-mount-burette",
  "formal-trial-condition-burette-drain-residual",
  "formal-trial-condition-burette",
  "formal-trial-condition-burette-discard-rinsate",
];
const disposalActionIds = [
  "formal-trial-dispose",
  "formal-trial-dispose-rinse",
  "formal-trial-dispose-discard-rinse",
];
const retryActionIds = [
  "formal-trial-deliver-titrant-retry-dispose",
  "formal-trial-deliver-titrant-retry-dispose-rinse",
  "formal-trial-deliver-titrant-retry-dispose-discard-rinse",
  "formal-trial-deliver-titrant-retry-reset",
];

/** Volume recorded after the steepest observed interval, from the recorded rows only. */
const postSteepVolumeMl = (points) => {
  if (points.length < 2) return 0;
  let steepestIndex = 1;
  let steepestDelta = -1;
  for (let index = 1; index < points.length; index += 1) {
    const delta = Math.abs(points[index].ph - points[index - 1].ph);
    if (delta > steepestDelta) {
      steepestDelta = delta;
      steepestIndex = index;
    }
  }
  return points[points.length - 1].volumeMl - points[steepestIndex].volumeMl;
};

const summary = [];

for (const witness of lab.reachabilityWitnesses) {
  const definition = await compileLabComposition(lab, resolveTechnique, { witnessId: witness.id });
  const context = acidBaseRouteContextId(definition);
  check(context === witness.id, `${witness.id}: compiled context is "${context}"`);

  const definitionErrors = validateAcidBaseRouteDefinition(definition);
  check(definitionErrors.length === 0, `${witness.id}: ${definitionErrors.join(" ")}`);

  const adapter = createAcidBaseRouteAdapter(definition);
  let state = createInitialAcidBaseRouteState();
  const attempt = (instanceId, actionId, payload = {}) =>
    adapter.execute(state, { instanceId, actionId, payload: { ...payload, contextId: context } });
  const advance = (instanceId, actionId, payload = {}) => {
    const result = attempt(instanceId, actionId, payload);
    if (!result.ok) failures.push(`${witness.id}: ${actionId} unexpectedly rejected (${result.rejection.code}: ${result.rejection.message})`);
    else state = result.state;
  };
  const expectRejection = (label, code, instanceId, actionId, payload = {}) => {
    const result = attempt(instanceId, actionId, payload);
    if (result.ok) failures.push(`${witness.id}: ${label} should have been rejected`);
    else if (result.rejection.code !== code) {
      failures.push(`${witness.id}: ${label} rejected as ${result.rejection.code}, expected ${code}`);
    }
  };

  expectRejection("apparatus before teacher approval", "teacher-approval-required", FORMAL_INSTANCE_ID, "formal-trial-place-ring-stand");
  expectRejection("plan without a student response", "student-response-required", LAB_ORCHESTRATION_INSTANCE_ID, "ACID-PLAN-01");
  expectRejection("an unmapped action", "unmapped-control", FORMAL_INSTANCE_ID, "formal-trial-not-a-real-action");
  expectRejection("a lab node on the technique scope", "unmapped-control", FORMAL_INSTANCE_ID, "ACID-PLAN-01", { note: "plan" });

  const otherContext = context === "strong-acid-strong-base" ? "weak-acid-strong-base" : "strong-acid-strong-base";
  const crossContext = adapter.execute(state, {
    instanceId: LAB_ORCHESTRATION_INSTANCE_ID,
    actionId: "ACID-PLAN-01",
    payload: { note: "plan", contextId: otherContext },
  });
  check(
    !crossContext.ok && crossContext.rejection.code === "context-mismatch",
    `${witness.id}: another context's control should be rejected`,
  );

  advance(LAB_ORCHESTRATION_INSTANCE_ID, "ACID-PLAN-01", { note: "teacher-approved comparative plan" });
  check(isPlanApproved(state), `${witness.id}: the approved plan should be recorded`);
  expectRejection("an out-of-order mount", "prerequisite-missing", FORMAL_INSTANCE_ID, "formal-trial-mount-burette");

  for (const actionId of assemblyActionIds) advance(FORMAL_INSTANCE_ID, actionId);
  expectRejection("interpretation before the trial disposal chain", "prerequisite-missing", LAB_ORCHESTRATION_INSTANCE_ID, "ACID-ANALYSIS-01", { note: "early" });

  const curve = generateTitrationCurve(config, context);
  for (const actionId of preflightActionIds) advance(FORMAL_INSTANCE_ID, actionId, { note: "preflight", value: 0 });

  expectRejection("a cumulative volume sent as an increment", "increment-out-of-contract", FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant", { value: curve.points.at(-1).volumeMl });
  expectRejection("a zero delivery", "increment-out-of-contract", FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant", { value: 0 });
  expectRejection("a sub-resolution delivery", "increment-out-of-contract", FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant", { value: 0.255 });

  for (let index = 1; index < curve.points.length; index += 1) {
    const increment = Number((curve.points[index].volumeMl - curve.points[index - 1].volumeMl).toFixed(2));
    const recordedRows = curve.points.slice(0, index + 1);
    const finalPoint = index === curve.points.length - 1;
    advance(FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant", { value: increment });
    advance(FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-mix", { value: increment });
    advance(FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-observe", { note: "mixed and stabilized" });
    advance(FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-read-ph", { value: curve.points[index].ph });
    advance(FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-record-point", { value: curve.points[index].ph });
    if (index === 1) {
      expectRejection("a route-local endpoint verdict", "unsupported-decision", FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-decide", { stabilityReached: true });
      expectRejection("acceptance before the configured stability evidence", "stability-evidence-required", FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-decide", {
        note: FINISH_AFTER_STABILITY_REVIEW,
        recordedPointCount: recordedRows.length,
        postSteepVolumeMl: postSteepVolumeMl(recordedRows),
      });
    }
    advance(FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-decide", finalPoint
      ? {
          note: FINISH_AFTER_STABILITY_REVIEW,
          recordedPointCount: recordedRows.length,
          postSteepVolumeMl: postSteepVolumeMl(recordedRows),
        }
      : { note: CONTINUE_DELIVERY });
  }

  const finalReading = Number((curve.points.at(-1).volumeMl + 1).toFixed(2));
  advance(FORMAL_INSTANCE_ID, "formal-trial-deliver-titrant-read-final", { value: finalReading });
  advance(FORMAL_INSTANCE_ID, "formal-trial-record-final-burette", { value: finalReading });
  for (const actionId of disposalActionIds) {
    advance(FORMAL_INSTANCE_ID, actionId, { note: "routed to the configured acid-base waste receiver" });
  }

  expectRejection("uncertainty before the interpretation node", "prerequisite-missing", LAB_ORCHESTRATION_INSTANCE_ID, "ACID-UNCERTAINTY-01", { note: "early" });
  advance(LAB_ORCHESTRATION_INSTANCE_ID, "ACID-ANALYSIS-01", { note: "landmark comparison from the recorded rows" });
  advance(LAB_ORCHESTRATION_INSTANCE_ID, "ACID-UNCERTAINTY-01", { note: "uncertainty and provenance limits" });
  expectRejection("release outside the configured neutralization range", "waste-checkpoint-required", LAB_ORCHESTRATION_INSTANCE_ID, "ACID-CLEANUP-01", {
    note: "waste", wasteWithinConfiguredRange: false, instructorRouteConfirmed: true,
  });
  expectRejection("release without the instructor route", "waste-checkpoint-required", LAB_ORCHESTRATION_INSTANCE_ID, "ACID-CLEANUP-01", {
    note: "waste", wasteWithinConfiguredRange: true, instructorRouteConfirmed: false,
  });
  advance(LAB_ORCHESTRATION_INSTANCE_ID, "ACID-CLEANUP-01", {
    note: "measured waste pH inside the configured release range; instructor route confirmed",
    wasteWithinConfiguredRange: true,
    instructorRouteConfirmed: true,
    value: 7,
  });

  const untraversed = definition.process.nodes
    .filter((node) => node.actionId && !state.completedActionIds.includes(node.actionId))
    .map((node) => node.id);
  check(
    untraversed.every((nodeId) => nodeId.includes("retry")),
    `${witness.id}: nodes left untraversed outside the rejected-attempt branch: ${untraversed.join(", ")}`,
  );

  // The authored rejected-attempt recovery must be reachable and must withdraw only that attempt.
  let rejected = state;
  const recoveryAdapter = createAcidBaseRouteAdapter(definition);
  const rejectDecision = recoveryAdapter.execute(rejected, {
    instanceId: FORMAL_INSTANCE_ID,
    actionId: "formal-trial-deliver-titrant-decide",
    payload: { note: DISPOSE_AND_RESTART_TRIAL, contextId: context },
  });
  check(rejectDecision.ok, `${witness.id}: the authored dispose-and-restart decision should be accepted`);
  if (rejectDecision.ok) rejected = rejectDecision.state;
  for (const actionId of retryActionIds) {
    const result = recoveryAdapter.execute(rejected, {
      instanceId: FORMAL_INSTANCE_ID,
      actionId,
      payload: { note: "rejected attempt preserved", contextId: context },
    });
    if (!result.ok) failures.push(`${witness.id}: recovery ${actionId} rejected (${result.rejection.code})`);
    else rejected = result.state;
  }
  const cleared = clearRetriedAttempt(rejected);
  check(isPlanApproved(cleared), `${witness.id}: a restart must keep the approved plan`);
  check(
    assemblyActionIds.every((actionId) => cleared.completedActionIds.includes(actionId)),
    `${witness.id}: a restart must keep the bench assembly`,
  );
  check(
    !cleared.completedActionIds.includes("formal-trial-initial-row"),
    `${witness.id}: a restart must withdraw the attempt's initial row`,
  );
  const reEntry = recoveryAdapter.execute(cleared, {
    instanceId: FORMAL_INSTANCE_ID,
    actionId: "formal-trial-seat-burette-funnel",
    payload: { contextId: context },
  });
  check(reEntry.ok, `${witness.id}: a restart must re-enter at the compiled funnel/fill segment`);

  check(adapter.reset(state).completedActionIds.length === 0, `${witness.id}: reset must clear recorded evidence`);

  summary.push({
    witness: witness.id,
    context,
    nodes: definition.process.nodes.length,
    edges: definition.process.edges.length,
    actions: definition.actions.length,
    origins: definition.compositionManifest.origins.length,
    traversedNodes: definition.process.nodes.length - untraversed.length,
    recordedEvidenceRows: state.evidence.length,
  });
}

const blind = createAcidBaseRouteAdapter(undefined);
const blindResult = blind.execute(createInitialAcidBaseRouteState(), {
  instanceId: FORMAL_INSTANCE_ID,
  actionId: "formal-trial-place-ring-stand",
  payload: {},
});
check(
  !blindResult.ok && blindResult.rejection.code === "manifest-target-mismatch",
  "an absent compiled definition must be fail-closed",
);

for (const row of summary) {
  console.log(
    `${row.witness}: ${row.traversedNodes}/${row.nodes} compiled nodes traversed, ` +
      `${row.edges} edges, ${row.actions} actions, ${row.origins} origins, ${row.recordedEvidenceRows} evidence rows`,
  );
}

if (failures.length > 0) {
  console.error(`\nCycle 10 route-execution verifier failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nCycle 10 route-execution verifier passed for ${summary.length} compiled witnesses.`);
