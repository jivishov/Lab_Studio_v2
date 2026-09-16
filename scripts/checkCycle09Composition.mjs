/**
 * Cycle 09 static composition verifier for the calorimetry and equilibrium inquiries.
 *
 * The Cycle 09 review found that a composition source can compile cleanly and still be
 * scientifically wrong: the hand-warmer lab kept a lab-local edge from the last planning node to
 * the design-decision node while the technique instance was wired off the *first* planning node.
 * The compiled graph therefore offered a route from the start straight to "record the chosen
 * chemical and amount" that traversed none of the 310 calorimetry actions, and `nextNodeId` in
 * src/runtime/reducer.ts takes the first matching outgoing edge, so that was the default route
 * rather than an exotic branch.
 *
 * This verifier compiles each owned lab for every declared reachability witness and asserts the
 * properties that failure class violates, plus the ownership and provenance boundaries of the
 * lane:
 *
 *   - no terminal node is reachable without traversing a technique-instance node;
 *   - lab-local rows stay non-physical (no atom, no equipment role, no acquisition effect);
 *   - technique instances pin the exact on-disk technique version;
 *   - every declared equipment role is exercised, and every required one is bound by the instance;
 *   - every declared configuration slot is read, and every advertised value is selectable;
 *   - no observe/record step pre-loads the result a later acquisition is meant to produce;
 *   - the lane overlays cover all and only the Cycle 09 owners, with no unevaluated row;
 *   - the overlay's recorded wiring matches the edges the compiler actually produced.
 *
 * Allowed evidence ceiling: static composition/JSON analysis only. It proves nothing about live
 * thermal behaviour, temperature acquisition, calorimeter assembly, equilibrium manipulation,
 * reset, browser rendering, or physical safety.
 *
 * Run with:
 *   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs
 *     scripts/checkCycle09Composition.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { compileLabComposition } from "../src/data/compileLabComposition.ts";
import {
  deriveCycle09CurrentSourceProjection,
  deriveCycle09ReconciliationInputs,
} from "./cycle09CurrentSourceProjection.mjs";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const LAB_IDS = ["hand-warmer-calorimetry", "equilibrium-rainbow-display"];
const TECHNIQUE_IDS = ["hand-warmer-calorimetry", "equilibrium-rainbow-inquiry"];
const LANE_OWNERS = new Set([
  ...LAB_IDS.map((id) => `lab:${id}`),
  ...TECHNIQUE_IDS.map((id) => `technique:${id}`),
]);
const PLAN_ROOT = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const LANE_ROOT = `${PLAN_ROOT}/evidence/lane-09`;
const ACQUISITION_CLASSES = new Set([
  "apparatus-material-instrument-state",
  "measurement-direct-observation-acquisition",
]);

const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};

const composedOverlay = read(`${LANE_ROOT}/lab-composition-overlay.json`);
const techniques = new Map(TECHNIQUE_IDS.map((id) => [id, read(`public/techniques/${id}.json`)]));
const labs = new Map(LAB_IDS.map((id) => [id, read(`public/labs/${id}.json`)]));
const currentProjection = deriveCycle09CurrentSourceProjection({
  registry: read("src/domain/atomRegistry.json"),
  sourceRegistry: read("docs/architecture/source-trace-registry.json"),
  techniquesById: techniques,
  labsById: labs,
});
const currentProjectionInputs = deriveCycle09ReconciliationInputs(currentProjection);
const resolveTechnique = async (id) =>
  structuredClone(techniques.get(id) ?? read(`public/techniques/${id}.json`));

for (const [id, technique] of techniques) {
  const ruleIds = [
    ...technique.actions.flatMap((action) => (action.prerequisites ?? []).map((rule) => rule.id)),
    ...technique.process.nodes.flatMap((node) => (node.validation ?? []).map((rule) => rule.id)),
    ...(technique.successCriteria ?? []).map((rule) => rule.id),
  ];
  const duplicates = ruleIds.filter((ruleId, index) => ruleIds.indexOf(ruleId) !== index);
  check(
    duplicates.length === 0,
    `technique:${id}: duplicate validation rule id(s) ${[...new Set(duplicates)].join(", ")}`,
  );

  const contract = technique.composition;
  check(Boolean(contract), `technique:${id}: no composition contract`);
  if (!contract) continue;

  // A declared role must actually be exercised, but `equipmentRoleBindings` is not the only way
  // that happens: `compileLabComposition` resolves an instance reference such as
  // `parameters.timerId` only through the instance's bound equipment, so a role can be
  // load-bearing purely by making one of its instances resolvable. Both count as exercised; a role
  // that neither an action nor a parameter reference reaches is the phantom worth failing on.
  const serialized = JSON.stringify(technique);
  const boundRoles = new Set(
    technique.actions.flatMap((action) => Object.keys(action.equipmentRoleBindings ?? {})),
  );
  const referencedInstanceIds = new Set(
    technique.actions.flatMap((action) =>
      Object.entries(action.parameters ?? {})
        .filter(([key]) => key === "timerId" || /InstanceIds?$/.test(key))
        .map(([, value]) => value)
        .filter((value) => typeof value === "string"),
    ),
  );
  for (const role of contract.equipmentRoles ?? []) {
    const exercised = boundRoles.has(role.roleId) ||
      (role.sourceInstanceIds ?? []).some((instanceId) => referencedInstanceIds.has(instanceId));
    check(
      exercised,
      `technique:${id}: equipment role "${role.roleId}" is declared but no action binds it and no action parameter references any of its instances`,
    );
  }

  for (const slot of contract.configurationSlots ?? []) {
    // An unread slot is a setting that silently does nothing. A slot named by an orderedProcedure
    // plan is read by the materializer rather than by a placeholder, so it counts as consumed.
    const consumed = serialized.includes(`{{config.${slot.id}}}`) ||
      contract.orderedProcedure?.configurationSlotId === slot.id;
    check(consumed, `technique:${id}: configuration slot "${slot.id}" is declared but nothing reads it`);
    for (const value of slot.allowedValues ?? []) {
      check(
        consumed || value === slot.defaultValue,
        `technique:${id}: configuration slot "${slot.id}" advertises "${value}", but nothing in the technique selects it`,
      );
    }
  }
}

for (const labId of LAB_IDS) {
  const source = read(`public/labs/${labId}.json`);
  check(
    Array.isArray(source.techniqueInstances) &&
      source.techniqueInstances.length > 0 &&
      Boolean(source.compositionStart) &&
      Array.isArray(source.compositionConnections) &&
      Array.isArray(source.reachabilityWitnesses),
    `lab:${labId}: not a composition source`,
  );
  check(!("techniqueRefs" in source), `lab:${labId}: still carries legacy techniqueRefs`);

  for (const instance of source.techniqueInstances ?? []) {
    const technique = techniques.get(instance.techniqueId);
    check(
      Boolean(technique),
      `lab:${labId}: instance "${instance.instanceId}" is outside the Cycle 09 owner set`,
    );
    if (!technique) continue;
    check(
      instance.version === technique.metadata.version,
      `lab:${labId}: instance "${instance.instanceId}" pins ${instance.techniqueId}@${instance.version}, on disk is @${technique.metadata.version}`,
    );
    for (const role of technique.composition?.equipmentRoles ?? []) {
      check(
        !role.required || Boolean(instance.bindings?.equipment?.[role.roleId]),
        `lab:${labId}: instance "${instance.instanceId}" does not bind required role "${role.roleId}"`,
      );
    }
  }

  // Lab-local rows must stay non-physical: physical state and acquisition belong to the instance.
  for (const action of source.actions ?? []) {
    check(!action.atomId, `lab:${labId}: local action "${action.id}" claims atom "${action.atomId}"`);
    check(
      !action.equipmentRoleBindings,
      `lab:${labId}: local action "${action.id}" binds an equipment role`,
    );
    const acquisition = (action.effect?.classes ?? []).filter((entry) => ACQUISITION_CLASSES.has(entry));
    check(
      acquisition.length === 0,
      `lab:${labId}: local action "${action.id}" declares acquisition effect(s) ${acquisition.join(", ")}`,
    );
  }

  const witnessIds = (source.reachabilityWitnesses ?? []).map((witness) => witness.id);
  for (const witnessId of witnessIds.length > 0 ? witnessIds : [undefined]) {
    const compiled = await compileLabComposition(
      structuredClone(source),
      resolveTechnique,
      witnessId ? { witnessId } : {},
    );
    const label = `lab:${labId}/${witnessId ?? "default"}`;
    const manifest = compiled.compositionManifest;
    check(manifest?.status === "compiled", `${label}: composition did not compile`);
    if (!manifest) continue;

    const techniqueNodeIds = new Set(manifest.origins.map((origin) => origin.nodeId));
    const outgoing = new Map();
    for (const edge of compiled.process.edges) {
      outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    }
    // Walk from the start without ever entering a technique-owned node. Anything terminal that is
    // still reachable is a route to a conclusion that needs no evidence from the instance.
    const seen = new Set([compiled.process.startNodeId]);
    const queue = [compiled.process.startNodeId];
    while (queue.length > 0) {
      for (const next of outgoing.get(queue.shift()) ?? []) {
        if (techniqueNodeIds.has(next) || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    const bypass = compiled.process.nodes
      .filter((node) => seen.has(node.id) && (outgoing.get(node.id) ?? []).length === 0)
      .map((node) => node.id);
    check(
      bypass.length === 0,
      `${label}: terminal node(s) ${bypass.join(", ")} are reachable without traversing any technique-instance node`,
    );

    for (const action of compiled.actions) {
      if (action.verb !== "observe" && action.verb !== "record") continue;
      check(
        !("expected" in (action.parameters ?? {})),
        `${label}: action "${action.id}" stores an expected acquisition result`,
      );
    }

    // The overlay is the artifact a reviewer reads instead of recompiling, so its recorded wiring
    // must be the wiring the compiler produced - the route defect was only visible in edges.
    // The overlay unions its rows across witnesses, so compare only when there is one witness.
    if (witnessIds.length <= 1) {
      const recorded = new Set(
        composedOverlay.rows
          .filter((row) => row.labId === labId)
          .flatMap((row) => [...row.incoming, ...row.outgoing])
          .map((edge) => `${edge.from}->${edge.to}`),
      );
      const actual = new Set(compiled.process.edges.map((edge) => `${edge.from}->${edge.to}`));
      const missing = [...actual].filter((edge) => !recorded.has(edge));
      const extra = [...recorded].filter((edge) => !actual.has(edge));
      check(
        missing.length === 0 && extra.length === 0,
        `${label}: lab-composition-overlay edges differ from the compiled graph (${missing.length} missing, ${extra.length} extra); regenerate the lane overlays`,
      );
    }
  }
}

// The lane overlays are the reviewable evidence: they must cover all and only the Cycle 09 owners.
const localActionCount = LAB_IDS.reduce(
  (sum, labId) => sum + (read(`public/labs/${labId}.json`).actions ?? []).length,
  0,
);
const techniqueActionCount = [...techniques.values()].reduce(
  (sum, technique) => sum + technique.actions.length,
  0,
);
for (const [name, expected] of Object.entries({
  "source-trace-overlay": techniqueActionCount + localActionCount,
  "technique-atomicity-overlay": techniqueActionCount,
})) {
  const overlay = read(`${LANE_ROOT}/${name}.json`);
  check(
    currentProjectionInputs.overlayMatchesCurrentSource(`${name}.json`, overlay.rows),
    `${name}: semantic rows do not match the shared current-source projection; regenerate the lane overlays`,
  );
  check(overlay.rows.length === expected, `${name}: ${overlay.rows.length} rows, expected ${expected}`);
  check(
    overlay.rows.every((row) => row.evaluated === true),
    `${name}: at least one row is not evaluated`,
  );
  check(
    (overlay.owners ?? []).every((owner) => LANE_OWNERS.has(owner)),
    `${name}: owner list reaches outside the Cycle 09 lane`,
  );
  const rowIds = overlay.rows.map((row) => row.rowId);
  check(new Set(rowIds).size === rowIds.length, `${name}: duplicate row identities`);

  // The overlays reconcile against coordinator-owned matrices that later cycles regenerate in
  // place, so they must record what they actually read, not only what revision 9 froze.
  for (const [dependency, path] of Object.entries({
    techniqueAtomicityAuditSha256: `${PLAN_ROOT}/TECHNIQUE_ATOMICITY_AUDIT.json`,
    labCompositionAuditSha256: `${PLAN_ROOT}/LAB_COMPOSITION_AUDIT.json`,
    sourceTraceRegistrySha256: "docs/architecture/source-trace-registry.json",
  })) {
    check(
      overlay.observedContractDependencies?.[dependency] === sha256(path),
      `${name}: observed ${dependency} does not match ${path}; regenerate the lane overlays`,
    );
    const frozen = overlay.contractDependencies?.[dependency];
    const drifted = (overlay.contractDrift ?? []).some((entry) => entry.dependency === dependency);
    check(
      drifted === (frozen !== sha256(path)),
      `${name}: contractDrift does not report the current state of ${dependency}`,
    );
  }
}

check(
  currentProjectionInputs.overlayMatchesCurrentSource("lab-composition-overlay.json", composedOverlay.rows),
  "lab-composition-overlay: semantic rows do not match the shared current-source projection; regenerate the lane overlays",
);

const sourceOverlay = read(`${LANE_ROOT}/source-trace-overlay.json`);
for (const row of sourceOverlay.rows) {
  // An acquisition row without a registry entry is reported as debt, never as a C configuration
  // choice: a C basis would assert the behaviour is a free teacher-configurable decision.
  check(
    row.basis !== null || row.traceDebt !== null,
    `source-trace-overlay: row "${row.rowId}" has neither a basis nor a recorded trace debt`,
  );
}

check(
  composedOverlay.rows.every((row) => LANE_OWNERS.has(`lab:${row.labId}`)),
  "lab-composition-overlay: a row is owned by a lab outside the Cycle 09 lane",
);

if (problems.length > 0) {
  console.error(`Cycle 09 composition failures (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `Cycle 09 composition, evidence-route, ownership, configuration and overlay checks passed for ` +
      `${LAB_IDS.length} labs and ${TECHNIQUE_IDS.length} techniques.`,
  );
}
