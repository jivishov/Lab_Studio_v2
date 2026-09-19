/**
 * Standalone content-consistency checker.
 *
 * Enforces the behavioural contracts introduced by
 * `atomic_remediation_plan/CONTINUATION_CYCLE_02.md`, extended by Cycles 03 and 05:
 *
 *   - atomic identity and equipment-role bindings on physical actions,
 *   - atom verb / interaction / role compatibility,
 *   - interaction-specific operands, mirrored from the runtime rather than guessed,
 *   - build-time source traceability that never reaches client-visible state,
 *   - visual-state, realistic-asset, image-alias, and composite registries,
 *   - version-pinned technique action references and the hydrator's boundary (Cycle 03),
 *   - realistic SVG wrapper validity, and the absence of any apparatus-specific composite branch in
 *     the renderer or the reducer (Cycle 05).
 *
 * The rule engine runs over an in-memory "world", so the same rules that scan the repository also
 * run against small positive and negative self-fixtures before any repository file is read. A rule
 * that cannot fail its own fixture is not enforcement.
 *
 * Raw/template rules remain directly runnable with Node. The maintained `content:check` command
 * additionally requests compiled-context diagnostics through the TypeScript composition loader;
 * that adapter is read-only and never imports this command back.
 *
 * Usage:
 *   node scripts/checkContentConsistency.mjs              # self-check, scan, compare to baseline
 *   node scripts/checkContentConsistency.mjs --json       # machine-readable result
 *   node scripts/checkContentConsistency.mjs --limit=50   # human output display limit
 *   node scripts/checkContentConsistency.mjs --write-baseline
 *   node scripts/checkContentConsistency.mjs --write-docs # regenerate docs/atomic-steps.md
 *   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
 *     scripts/checkContentConsistency.mjs --compiled       # raw/template plus compiled contexts
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderDocs } from "./renderAtomicStepsDocs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawArgs = process.argv.slice(2);
const argv = new Set(rawArgs);
const displayLimitArgument = rawArgs.find((argument) => argument.startsWith("--limit="));
const displayLimit = displayLimitArgument
  ? Number(displayLimitArgument.slice("--limit=".length))
  : 25;
if (!Number.isInteger(displayLimit) || displayLimit < 1) {
  console.error("--limit must be a positive integer, for example --limit=50.");
  process.exit(2);
}

const readText = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const listFiles = (relativePath) => readdirSync(join(root, relativePath));

const BASELINE_PATH = "scripts/content-consistency-lint-baseline.json";
const ATOM_REGISTRY_PATH = "src/domain/atomRegistry.json";
const ROLE_REGISTRY_PATH = "src/domain/equipmentRoleRegistry.json";
const VISUAL_STATE_REGISTRY_PATH = "src/equipment/visualStateRegistry.json";
const COMPOSITE_REGISTRY_PATH = "src/equipment/compositeRegistry.json";
const ASSET_REGISTRY_PATH = "src/equipment/assetDispositionRegistry.json";
const ALIAS_REGISTRY_PATH = "src/equipment/imageAliasRegistry.json";
const SOURCE_TRACE_REGISTRY_PATH = "docs/architecture/source-trace-registry.json";
const DOCS_PATH = "docs/atomic-steps.md";
const REALISTIC_DIR = "public/assets/equipment-realistic/v1";

/* ------------------------------------------------------------------ *
 * Shared vocabulary. Mirrors src/domain/types.ts and src/domain/interactions.ts. A drift here is a
 * silent weakening of every rule below, so the checker verifies the mirrors against the source.
 * ------------------------------------------------------------------ */

const PHYSICAL_VERBS = new Set([
  "place",
  "weigh",
  "measureVolume",
  "transfer",
  // Added to src/domain/validation.ts actionVerbs after this mirror was written. Until they
  // were classified here, the mirror check failed as mirror/drift:actionVerbs and, worse, every
  // action using them silently needed no atom identity. All three change physical state.
  "mix",
  "vent",
  "settle",
  "dissolve",
  "precipitate",
  "dilute",
  "filter",
  "spotSample",
  "developChromatogram",
  "rinse",
  "dry",
  "heat",
  "cool",
  "stressEquilibrium",
]);

/**
 * The complement of `PHYSICAL_VERBS`. Together the two must partition `actionVerbs` exactly, which
 * is what turns "someone added a verb to src/domain/types.ts" into a checker failure instead of a
 * verb that silently needs no atom identity.
 */
const NON_PHYSICAL_VERBS = new Set(["observe", "record", "calculate", "reset"]);

const ACTION_EFFECT_CLASSES = new Set([
  "apparatus-material-instrument-state",
  "measurement-direct-observation-acquisition",
  "evidence-recording",
  "calculation-analysis",
  "pedagogical-orchestration",
]);

const ACTION_EFFECT_TARGET_DOMAINS = new Set([
  "equipment", "material", "instrument", "measurement-observation", "evidence",
  "calculation", "analysis", "pedagogy", "configuration", "approval", "model",
]);

const INTERACTION_EFFECT_CLASSES = {
  dragToZone: ["apparatus-material-instrument-state"],
  snapIntoTarget: ["apparatus-material-instrument-state"],
  pourInto: ["apparatus-material-instrument-state"],
  dispenseDrops: ["apparatus-material-instrument-state"],
  spotOnto: ["apparatus-material-instrument-state"],
  rinseTarget: ["apparatus-material-instrument-state"],
  placeInInstrument: ["apparatus-material-instrument-state"],
  readInstrument: ["measurement-direct-observation-acquisition"],
  recordTimeSeries: ["measurement-direct-observation-acquisition", "evidence-recording"],
  recordNotebook: ["evidence-recording"],
  submitCalculation: ["calculation-analysis"],
};

/**
 * Mirrors the active-photometer configuration branch in
 * `deriveActionEffectContract`. A `readInstrument` label normally denotes an
 * acquisition, but this one registered atom reaches the reducer's earlier
 * configuration handler and changes the instrument state instead. Keep the
 * exception atom- and interaction-specific: every other `readInstrument`
 * atom still has to declare the normal acquisition class.
 */
const TYPED_ATOM_INTERACTION_EFFECT_CLASSES = {
  "atom.observe.set-active-photometer-wavelength": {
    readInstrument: ["apparatus-material-instrument-state", "evidence-recording"],
  },
  "atom.developChromatogram.develop-strip": {
    recordNotebook: ["apparatus-material-instrument-state"],
  },
};

const requiredEffectClassesForAtomInteraction = (atomId, interactionType) =>
  TYPED_ATOM_INTERACTION_EFFECT_CLASSES[atomId]?.[interactionType] ??
  INTERACTION_EFFECT_CLASSES[interactionType] ??
  [];

/** Mirrors `compatibleInteractionVerbs` in src/domain/interactions.ts. */
const COMPATIBLE_INTERACTION_VERBS = {
  dragToZone: ["place", "reset"],
  snapIntoTarget: ["place"],
  pourInto: [
    "measureVolume",
    "transfer",
    "dissolve",
    "precipitate",
    "dilute",
    "filter",
    "stressEquilibrium",
  ],
  dispenseDrops: ["transfer"],
  spotOnto: ["spotSample"],
  rinseTarget: ["rinse"],
  placeInInstrument: ["dry", "heat", "cool", "stressEquilibrium"],
  readInstrument: ["weigh", "measureVolume", "observe", "stressEquilibrium"],
  recordTimeSeries: ["record"],
  recordNotebook: ["calculate", "record", "observe", "stressEquilibrium", "mix", "vent", "settle", "dry", "cool", "transfer", "rinse", "developChromatogram"],
  submitCalculation: ["calculate"],
};

/**
 * Mirrors `requiresSource` / `requiresTarget` in src/runtime/interactionIntents.ts.
 *
 * Deliberately not stricter than the runtime: `pourInto` needs no authored source, `dragToZone`
 * needs no target, a snap zone is never required, and `readInstrument` needs a target only when one
 * is already present, so it can never be a target gap.
 */
const REQUIRES_AUTHORED_SOURCE = new Set([
  "dragToZone",
  "snapIntoTarget",
  "spotOnto",
  "dispenseDrops",
  "placeInInstrument",
  "readInstrument",
]);

const REQUIRES_AUTHORED_TARGET = new Set([
  "snapIntoTarget",
  "pourInto",
  "spotOnto",
  "dispenseDrops",
  "rinseTarget",
  "placeInInstrument",
]);

const VALID_BASIS = /^[MFRC](\/[MFRC])*$/;

const SOURCE_TABLES = new Set(["phase", "apparatus", "safety"]);

/**
 * Validates one citation into a dated plan.
 *
 * The source-row shapes in those plans are not interchangeable. A **phase** table has an explicit
 * `Basis` column (`ID | Atomic student action | Basis | ...`) and its letters are copied verbatim.
 * An **apparatus**-assembly table has no basis column at all
 * (`State | Atomic action | Resulting composite | Validation | Asset disposition`), so citing one
 * with `M` would assert that the manual states that exact step when it does not. An apparatus row is
 * table-supported, so its basis must include `F`, compounded with any marker the row carries inline.
 * A **safety** row has a numbered `S-NN` identity and an inline basis marker; it remains distinct
 * from a procedure-phase row that happens to reuse the same `S-NN` text.
 */
const checkSourceCitation = (citation, rulePrefix, scope, evidence, report) => {
  if (!SOURCE_TABLES.has(citation.sourceTable)) {
    report(`${rulePrefix}/invalid-source-table`, scope, `${evidence} sourceTable=${citation.sourceTable}`);
    return;
  }
  if (!VALID_BASIS.test(citation.basis)) {
    report(`${rulePrefix}/invalid-basis`, scope, `${evidence} basis=${citation.basis}`);
    return;
  }
  if (citation.sourceTable === "apparatus" && !citation.basis.split("/").includes("F")) {
    report(
      `${rulePrefix}/apparatus-basis-missing-figure`,
      scope,
      `${evidence} step=${citation.step} basis=${citation.basis}`,
    );
  }
};

const VISUAL_STATE_DISPOSITIONS = new Set([
  "liquid-style",
  "solid-style",
  "state-asset",
  "nonvisual",
  "unresolved",
]);

const VISUAL_STATE_EVIDENCE_KINDS = new Set([
  "source-observed",
  "measurement-derived",
  "simulator-configured",
  "qualitative",
  "presentation-only",
]);

const VISUAL_STATE_SELECTORS = new Set([
  "authored",
  "definition-id",
  "reagent-heuristic",
  "runtime-assigned",
]);

/** How a `runtime-assigned` state reaches the screen: as a fallback, or as the only possibility. */
const RUNTIME_ASSIGNMENT_KINDS = new Set(["default", "unconditional"]);

/** Dispositions that put something on screen, so a selector must be able to reach them. */
const RENDERABLE_DISPOSITIONS = new Set(["liquid-style", "solid-style", "state-asset"]);

const COMPOSITE_KINDS = new Set(["visual", "instance-swap"]);

const COMPOSITE_ROLE_KINDS = new Set([
  "instrument",
  "vessel",
  "delivery",
  "consumable",
  "tool",
  "support",
]);

/**
 * Cycle 05 moved composite recognition out of the renderer and the reducer, and these files have to
 * stay out of it.
 *
 * `literals` is what a re-grown branch would need, and it differs per file on purpose. The renderer
 * must name no apparatus at all: a participant definition id, a participant snap zone, or a composite
 * result asset appearing there is recognition logic. The reducer legitimately names equipment for
 * simulation — chromatography models, filtration transfers — so only a result-asset filename proves
 * it is deciding composite art again. `equipmentOverlays.tsx` is keyed *by* definition id, so a
 * definition literal is its contract rather than a leak; a participant snap zone is not, because a
 * composite overlay must take the zone it draws into from the participant that declares it.
 * `imports` is the evaluator entry point a file must still reach, or `null` for a file that is
 * handed its registry entry by a caller instead of resolving one.
 */
const COMPOSITE_FREE_SOURCES = [
  {
    file: "src/player/EquipmentView.tsx",
    literals: ["resultAsset", "definitionId", "snapZoneId"],
    imports: "evaluateCompositeScene",
  },
  {
    file: "src/runtime/reducer.ts",
    literals: ["resultAsset"],
    imports: "instanceSwapCompositeFor",
  },
  {
    file: "src/player/equipmentOverlays.tsx",
    literals: ["resultAsset", "snapZoneId"],
    imports: "compositeParticipantByRole",
  },
];

/** The one module allowed to evaluate the composite registry. */
const COMPOSITE_EVALUATOR_PATH = "src/equipment/composites.ts";

const ASSET_DISPOSITIONS = new Set([
  "player-active",
  "accessory-active",
  "state-active",
  "composite-active",
  "custom-route-active",
  "gallery-only",
  "intentionally-unused",
  "remediation-candidate",
]);

const ROLE_KINDS = new Set(["instrument", "vessel", "delivery", "consumable", "tool", "support"]);

const present = (value) => value !== undefined && value !== null && value !== "";
const firstPresent = (...values) => values.find(present);

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
};

/**
 * Short content fingerprint. Baseline exemptions carry it so that *modifying* a legacy action
 * invalidates its exemption. Without this the rule would only catch new actions, not modified ones.
 */
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex").slice(0, 12);

const authoredSourceDefinitionId = (action) =>
  firstPresent(
    action.interaction?.sourceDefinitionId,
    action.parameters?.sourceDefinitionId,
    action.parameters?.equipmentDefinitionId,
  );

const authoredTargetDefinitionId = (action) =>
  firstPresent(action.interaction?.targetDefinitionId, action.parameters?.targetDefinitionId);

/* ------------------------------------------------------------------ *
 * Rule engine.
 * ------------------------------------------------------------------ */

const makeReporter = () => {
  const violations = [];
  const report = (rule, scope, evidence, detail = {}) => {
    violations.push({ id: `${rule}:${scope}`, rule, scope, evidence, ...detail });
  };
  return { violations, report };
};

/**
 * The mirrors above are hand-copied vocabulary from TypeScript the checker cannot import. This rule
 * is what makes copying safe: it re-reads each source declaration and reports any disagreement, so a
 * mirror that drifts fails CI instead of silently narrowing every rule built on it.
 *
 * `world.sourceVocabulary` is `null` only for the self-fixture world that supplies its own.
 */
const checkVocabularyMirrors = (world, report) => {
  const source = world.sourceVocabulary;
  if (!source) return;

  const compare = (name, mirrored, parsed, evidence) => {
    const missing = [...parsed].filter((item) => !mirrored.has(item));
    const extra = [...mirrored].filter((item) => !parsed.has(item));
    if (!missing.length && !extra.length) return;
    report("mirror/drift", name, evidence, {
      missingFromChecker: missing.sort(),
      absentFromSource: extra.sort(),
    });
  };

  compare(
    "actionVerbs",
    new Set([...PHYSICAL_VERBS, ...NON_PHYSICAL_VERBS]),
    source.actionVerbs,
    "src/domain/validation.ts actionVerbs vs PHYSICAL_VERBS + NON_PHYSICAL_VERBS",
  );
  for (const verb of PHYSICAL_VERBS) {
    if (NON_PHYSICAL_VERBS.has(verb)) {
      report("mirror/verb-classified-twice", verb, "PHYSICAL_VERBS and NON_PHYSICAL_VERBS");
    }
  }
  compare(
    "interactionOperationTypes",
    new Set(Object.keys(COMPATIBLE_INTERACTION_VERBS)),
    source.interactionOperationTypes,
    "src/domain/interactions.ts interactionOperationTypes vs COMPATIBLE_INTERACTION_VERBS keys",
  );
  for (const [type, verbs] of Object.entries(source.compatibleInteractionVerbs)) {
    compare(
      `compatibleInteractionVerbs.${type}`,
      new Set(COMPATIBLE_INTERACTION_VERBS[type] ?? []),
      new Set(verbs),
      "src/domain/interactions.ts compatibleInteractionVerbs",
    );
  }
  compare(
    "requiresSource",
    REQUIRES_AUTHORED_SOURCE,
    source.requiresSource,
    "src/runtime/interactionIntents.ts requiresSource (unconditional clauses only)",
  );
  compare(
    "requiresTarget",
    REQUIRES_AUTHORED_TARGET,
    source.requiresTarget,
    "src/runtime/interactionIntents.ts requiresTarget (unconditional clauses only)",
  );
  compare(
    "actionEquipmentParameterKeys",
    new Set(EQUIPMENT_PARAMETER_KEYS),
    source.actionEquipmentParameterKeys,
    "src/domain/validation.ts actionEquipmentParameterKeys",
  );
  compare(
    "actionModelParameterKeys",
    new Set(Object.keys(MODEL_PARAMETER_COLLECTIONS)),
    source.actionModelParameterKeys,
    "src/domain/validation.ts actionModelParameterKeys",
  );

  // Cycle 05's palette inversion, asserted rather than assumed: the two appearance modules must read
  // the registry and must not carry a colour literal of their own. A single `rgba(` re-appearing in
  // either file is a second palette starting to grow back.
  for (const module of world.paletteModules ?? []) {
    if (!module.derivesFromRegistry) {
      report("mirror/palette-not-registry-driven", module.file, `expected to read ${module.reader}`);
    }
    if (module.literalColours > 0) {
      report(
        "mirror/palette-literal-colour",
        module.file,
        `${module.literalColours} colour literals outside ${VISUAL_STATE_REGISTRY_PATH}`,
      );
    }
    if (module.authoredBeforeFallbacks === false) {
      report(
        "mirror/authored-state-not-first",
        module.file,
        "resolveLiquidStyle must read the authored visualState before either fallback table",
      );
    }
  }

  // Cycle 08: the third way a visual state becomes reachable. Cycle 05 classified what content
  // authors and what the two fallback tables name, and nothing classified what the reducer assigns
  // by itself — so eight assigned states were registered nowhere at all and `measured-liquid` was
  // registered with provenance asserting the runtime never assigned it. A state the runtime can put
  // on screen must be registered and must say so.
  const visualStateById = new Map(world.registries.visualStates.states.map((state) => [state.id, state]));
  for (const assigned of world.runtimeAssignedVisualStates ?? []) {
    const state = visualStateById.get(assigned.state);
    if (!state) {
      report(
        "mirror/runtime-assigned-state-unregistered",
        assigned.state,
        `${assigned.file} assigns it; ${VISUAL_STATE_REGISTRY_PATH} does not register it`,
      );
      continue;
    }
    if (!(state.selectors ?? []).includes("runtime-assigned")) {
      report(
        "mirror/runtime-assigned-state-selector-missing",
        assigned.state,
        `${assigned.file} assigns it; ${VISUAL_STATE_REGISTRY_PATH} selectors=${(state.selectors ?? []).join("+") || "none"}`,
      );
    }
    // `default` means an authored value wins and the literal is only the fallback; `unconditional`
    // means the reducer decides and no authored value reaches that site. Both are legitimate, but
    // the registry must say which, and the reducer must agree.
    const declared = state.runtimeAssignment;
    if (!RUNTIME_ASSIGNMENT_KINDS.has(declared)) {
      report(
        "mirror/runtime-assignment-undeclared",
        assigned.state,
        `${VISUAL_STATE_REGISTRY_PATH} runtimeAssignment=${declared ?? "absent"}`,
      );
    } else if ((declared === "default") !== assigned.overridable) {
      report(
        "mirror/runtime-assignment-mismatch",
        assigned.state,
        `${VISUAL_STATE_REGISTRY_PATH} declares ${declared}; ${assigned.file} ${
          assigned.overridable ? "reads an authored value first" : "assigns the literal unconditionally"
        }`,
      );
    }
  }
};

const checkRegistryIntegrity = (world, report) => {
  const { atoms, roles } = world.registries;
  const roleIds = new Set();
  for (const role of roles.roles) {
    if (roleIds.has(role.id)) report("registry/role-duplicate-id", role.id, ROLE_REGISTRY_PATH);
    roleIds.add(role.id);
    if (!ROLE_KINDS.has(role.kind)) {
      report("registry/role-unknown-kind", role.id, `${ROLE_REGISTRY_PATH} kind=${role.kind}`);
      continue;
    }
    const allowedCategories = new Set(roles.kindCategoryConstraints[role.kind] ?? []);
    for (const equipmentId of role.allowedEquipmentIds) {
      const definition = world.equipment.get(equipmentId);
      if (!definition) {
        report("registry/role-unknown-equipment", `${role.id}/${equipmentId}`, ROLE_REGISTRY_PATH);
        continue;
      }
      if (!allowedCategories.has(definition.category)) {
        report(
          "registry/role-kind-category-mismatch",
          `${role.id}/${equipmentId}`,
          `${ROLE_REGISTRY_PATH} kind=${role.kind} category=${definition.category}`,
        );
      }
    }
    for (const equipmentId of role.prohibitedEquipmentIds ?? []) {
      if (!world.equipment.has(equipmentId)) {
        report(
          "registry/role-unknown-equipment",
          `${role.id}/${equipmentId}`,
          `${ROLE_REGISTRY_PATH} prohibitedEquipmentIds`,
        );
      }
      if (role.allowedEquipmentIds.includes(equipmentId)) {
        report(
          "registry/role-allowed-and-prohibited",
          `${role.id}/${equipmentId}`,
          ROLE_REGISTRY_PATH,
        );
      }
    }
    for (const other of role.distinguishedFrom ?? []) {
      if (!roles.roles.some((candidate) => candidate.id === other)) {
        report("registry/role-unknown-distinction", `${role.id}/${other}`, ROLE_REGISTRY_PATH);
      }
    }
  }

  const atomIds = new Set();
  const actionByOwner = world.actionIndex;
  for (const atom of atoms.atoms) {
    if (atomIds.has(atom.id)) report("registry/atom-duplicate-id", atom.id, ATOM_REGISTRY_PATH);
    atomIds.add(atom.id);
    if (!atom.effectContract || !Array.isArray(atom.effectContract.classes) ||
      atom.effectContract.classes.length === 0 || !Array.isArray(atom.effectContract.targets) ||
      atom.effectContract.targets.length === 0) {
      report("registry/atom-effect-contract-missing", atom.id, ATOM_REGISTRY_PATH);
    } else {
      const classes = atom.effectContract.classes;
      if (new Set(classes).size !== classes.length) {
        report("registry/atom-effect-class-duplicate", atom.id, ATOM_REGISTRY_PATH);
      }
      for (const effectClass of classes) {
        if (!ACTION_EFFECT_CLASSES.has(effectClass)) {
          report("registry/atom-effect-class-unknown", `${atom.id}/${effectClass}`, ATOM_REGISTRY_PATH);
        }
      }
      const domains = atom.effectContract.targets.map((target) => target?.domain);
      if (new Set(domains).size !== domains.length) {
        report("registry/atom-effect-target-duplicate", atom.id, ATOM_REGISTRY_PATH);
      }
      for (const domain of domains) {
        if (!ACTION_EFFECT_TARGET_DOMAINS.has(domain)) {
          report("registry/atom-effect-target-unknown", `${atom.id}/${domain}`, ATOM_REGISTRY_PATH);
        }
      }
      for (const type of atom.allowedInteractionTypes) {
        for (const effectClass of requiredEffectClassesForAtomInteraction(atom.id, type)) {
          if (!classes.includes(effectClass)) {
            report(
              "registry/atom-effect-handler-conflict",
              `${atom.id}/${type}`,
              `${ATOM_REGISTRY_PATH} handlerClass=${effectClass}`,
            );
          }
        }
      }
    }
    for (const type of atom.allowedInteractionTypes) {
      const compatible = COMPATIBLE_INTERACTION_VERBS[type];
      if (!compatible) {
        report("registry/atom-unknown-interaction", `${atom.id}/${type}`, ATOM_REGISTRY_PATH);
        continue;
      }
      if (!compatible.includes(atom.verb)) {
        report(
          "registry/atom-verb-interaction-incompatible",
          `${atom.id}/${type}`,
          `${ATOM_REGISTRY_PATH} verb=${atom.verb}`,
        );
      }
    }
    for (const roleId of [...atom.requiredRoles, ...atom.optionalRoles]) {
      if (!roleIds.has(roleId)) {
        report("registry/atom-unknown-role", `${atom.id}/${roleId}`, ATOM_REGISTRY_PATH);
      }
    }
    for (const example of atom.sourceExamples) {
      checkSourceCitation(
        example,
        "registry/atom-source-example",
        `${atom.id}/${example.step}`,
        ATOM_REGISTRY_PATH,
        report,
      );
    }
    for (const example of atom.contentExamples) {
      const action = actionByOwner.get(`${example.owner}#${example.actionId}`);
      if (!action) {
        report(
          "registry/atom-content-example-missing",
          `${atom.id}/${example.owner}/${example.actionId}`,
          ATOM_REGISTRY_PATH,
        );
        continue;
      }
      if (action.verb !== atom.verb) {
        report(
          "registry/atom-content-example-verb-mismatch",
          `${atom.id}/${example.owner}/${example.actionId}`,
          `${ATOM_REGISTRY_PATH} atomVerb=${atom.verb} actionVerb=${action.verb}`,
        );
      }
    }
  }
};

/**
 * Action ids a process node may legally reference: the owner's own actions plus every action its
 * `techniqueRefs` select. Selection is read permissively here — a ref with a bad version or a
 * missing action still contributes its selected ids — so that one broken reference produces one
 * `technique-ref/*` violation instead of a cascade of unresolved-node violations.
 */
const resolvableActionIds = (entry, standaloneById) => {
  const ids = new Set((entry.definition.actions ?? []).map((action) => action.id));
  for (const ref of entry.definition.techniqueRefs ?? []) {
    const technique = standaloneById.get(ref.techniqueId);
    if (ref.actionIds === "all") {
      for (const action of technique?.actions ?? []) ids.add(action.id);
    } else {
      for (const actionId of ref.actionIds ?? []) ids.add(actionId);
    }
  }
  return ids;
};

const standaloneTechniquesById = (world) =>
  new Map(
    world.owners
      .filter((entry) => entry.scope === "standaloneTechnique")
      .map((entry) => [entry.definition.id, entry.definition]),
  );

const checkActions = (world, report) => {
  const { atoms, roles } = world.registries;
  const atomById = new Map(atoms.atoms.map((atom) => [atom.id, atom]));
  const roleById = new Map(roles.roles.map((role) => [role.id, role]));
  const standaloneById = standaloneTechniquesById(world);

  for (const entry of world.owners) {
    // Structural rules apply to every owner, including runtime-unreachable embedded techniques:
    // they cost nothing today (measured: zero violations outside runtime-executed owners) and a
    // migration in Cycles 03-04 must not be able to move broken structure into a live lab.
    const declared = new Set((entry.definition.actions ?? []).map((action) => action.id));
    const resolvable = resolvableActionIds(entry, standaloneById);
    const used = new Set();
    for (const node of entry.definition.process?.nodes ?? []) {
      if (!node.actionId) continue;
      used.add(node.actionId);
      if (!resolvable.has(node.actionId)) {
        report(
          "process/unresolved-action-reference",
          `${entry.owner}/${node.id}`,
          `${entry.file} node ${node.id} -> action ${node.actionId}`,
        );
      }
    }
    for (const actionId of declared) {
      if (!used.has(actionId)) {
        report("action/declared-but-unreferenced", `${entry.owner}/${actionId}`, entry.file);
      }
    }
    // Migrating an action out of `actions` and into `techniqueRefs` must not shrink this rule's
    // reach: an imported action no process node uses is dead weight in exactly the same way.
    for (const actionId of resolvable) {
      if (!declared.has(actionId) && !used.has(actionId)) {
        report("action/imported-but-unreferenced", `${entry.owner}/${actionId}`, entry.file);
      }
    }

    for (const action of entry.definition.actions ?? []) {
      const scope = `${entry.owner}/${action.id}`;

      const interaction = action.interaction;
      if (interaction) {
        const missing = [];
        if (
          REQUIRES_AUTHORED_SOURCE.has(interaction.type) &&
          !present(authoredSourceDefinitionId(action))
        ) {
          missing.push("sourceDefinitionId");
        }
        if (
          REQUIRES_AUTHORED_TARGET.has(interaction.type) &&
          !present(authoredTargetDefinitionId(action))
        ) {
          missing.push("targetDefinitionId");
        }
        if (missing.length) {
          report(
            "action/interaction-operand-missing",
            scope,
            `${entry.file} ${interaction.type} missing ${missing.join(", ")}`,
          );
        }
        const compatible = COMPATIBLE_INTERACTION_VERBS[interaction.type];
        if (compatible && !compatible.includes(action.verb)) {
          report(
            "action/interaction-verb-incompatible",
            scope,
            `${entry.file} ${interaction.type} with verb ${action.verb}`,
          );
        }
      }

      // Atomic identity, role bindings, and source traceability are scoped to owners the player
      // actually executes. Requiring them on the 34 runtime-unreachable embedded techniques would
      // add ~327 baseline entries for content Cycles 03-04 are chartered to migrate or delete.
      if (!entry.runtimeExecuted) continue;

      if (PHYSICAL_VERBS.has(action.verb) && !present(action.atomId)) {
        report("action/atom-identity-missing", scope, entry.file, {
          fingerprint: fingerprint(action),
          verb: action.verb,
        });
      }

      if (present(action.atomId)) {
        const atom = atomById.get(action.atomId);
        if (!atom) {
          report("action/atom-unknown", scope, `${entry.file} atomId=${action.atomId}`);
        } else {
          if (atom.verb !== action.verb) {
            report(
              "action/atom-verb-mismatch",
              scope,
              `${entry.file} atomVerb=${atom.verb} actionVerb=${action.verb}`,
            );
          }
          if (action.interaction && !atom.allowedInteractionTypes.includes(action.interaction.type)) {
            report(
              "action/atom-interaction-not-allowed",
              scope,
              `${entry.file} interaction=${action.interaction.type}`,
            );
          }
          for (const roleId of atom.requiredRoles) {
            if (!present(action.equipmentRoleBindings?.[roleId])) {
              report("action/role-binding-missing", `${scope}/${roleId}`, entry.file);
            }
          }
          const knownSlots = new Set([...atom.requiredRoles, ...atom.optionalRoles]);
          for (const [roleId, definitionId] of Object.entries(action.equipmentRoleBindings ?? {})) {
            if (!knownSlots.has(roleId)) {
              report("action/role-binding-unknown-role", `${scope}/${roleId}`, entry.file);
              continue;
            }
            const role = roleById.get(roleId);
            if (!world.equipment.has(definitionId)) {
              report(
                "action/role-binding-unknown-equipment",
                `${scope}/${roleId}`,
                `${entry.file} equipment=${definitionId}`,
              );
              continue;
            }
            const prohibited = role?.prohibitedEquipmentIds?.includes(definitionId) ?? false;
            if (prohibited || !role?.allowedEquipmentIds.includes(definitionId)) {
              report(
                "action/role-binding-not-allowed",
                `${scope}/${roleId}`,
                `${entry.file} role=${roleId} equipment=${definitionId}`,
              );
            }
          }

          const trace = world.sourceTraceIndex.get(`${entry.owner}#${action.id}`);
          if (!trace && !world.nonSourceDerivedOwners.has(entry.owner)) {
            report("action/source-trace-missing", scope, SOURCE_TRACE_REGISTRY_PATH);
          }
        }
      } else if (action.equipmentRoleBindings) {
        report("action/role-bindings-without-atom", scope, entry.file);
      }
    }
  }
};

const checkActionIdCollisions = (world, report) => {
  // Action ids are owner-local. The compiler and every evidence registry key them as
  // `${owner}#${actionId}`, so two independent techniques may legitimately reuse a short id such as
  // `place-ring-stand` with different fingerprints. The old corpus-wide comparison reported those
  // intentional owner-local identities as collisions. Keep the invariant that matters: one owner
  // must not publish the same id with two different definitions.
  for (const entry of world.owners) {
    const byId = new Map();
    for (const action of entry.definition.actions ?? []) {
      const records = byId.get(action.id) ?? [];
      records.push(fingerprint(action));
      byId.set(action.id, records);
    }
    for (const [actionId, records] of byId) {
      const variants = new Set(records);
      if (variants.size < 2) continue;
      report("corpus/action-id-collision", `${entry.owner}/${actionId}`, entry.file, { variants: variants.size });
    }
  }
};

const checkSourceTrace = (world, report) => {
  const registry = world.registries.sourceTrace;
  const knownOwners = new Set(world.owners.map((entry) => entry.owner));
  const atomIds = new Set(world.registries.atoms.atoms.map((atom) => atom.id));

  for (const group of registry.sourceDerivedOwners) {
    for (const owner of group.owners) {
      if (!knownOwners.has(owner)) {
        report("source-trace/unknown-owner", owner, `${SOURCE_TRACE_REGISTRY_PATH} sourceDerivedOwners`);
      }
    }
  }
  for (const entry of registry.nonSourceDerivedOwners) {
    if (!knownOwners.has(entry.owner)) {
      report(
        "source-trace/unknown-owner",
        entry.owner,
        `${SOURCE_TRACE_REGISTRY_PATH} nonSourceDerivedOwners`,
      );
    }
  }

  for (const trace of registry.traces) {
    const owner = `${trace.ownerType}:${trace.ownerId}`;
    const scope = `${owner}/${trace.actionId}`;
    if (!knownOwners.has(owner)) {
      report("source-trace/unknown-owner", scope, SOURCE_TRACE_REGISTRY_PATH);
      continue;
    }
    if (!world.actionIndex.has(`${owner}#${trace.actionId}`)) {
      report("source-trace/unknown-action", scope, SOURCE_TRACE_REGISTRY_PATH);
    }
    if (!atomIds.has(trace.atomId)) {
      report("source-trace/unknown-atom", scope, `${SOURCE_TRACE_REGISTRY_PATH} atomId=${trace.atomId}`);
    }
    checkSourceCitation(trace, "source-trace", scope, SOURCE_TRACE_REGISTRY_PATH, report);
    if (world.nonSourceDerivedOwners.has(owner)) {
      report("source-trace/non-source-derived-owner", scope, SOURCE_TRACE_REGISTRY_PATH);
    }
    if (!world.sourceFiles.has(trace.sourceFile)) {
      report(
        "source-trace/unknown-source-file",
        `${scope}/${trace.sourceFile}`,
        SOURCE_TRACE_REGISTRY_PATH,
      );
    }
  }

  const traceGroups = registry.traceGroups ?? [];
  if (!Array.isArray(traceGroups)) {
    report(
      "source-trace/group-registry-invalid",
      "traceGroups",
      `${SOURCE_TRACE_REGISTRY_PATH} traceGroups must be an array`,
    );
  } else {
    const groupedActionKeys = new Set();
    for (const [index, group] of traceGroups.entries()) {
      const at = `traceGroups[${index}]`;
      const owner = `${group?.ownerType}:${group?.ownerId}`;
      const groupScope = `${owner}/${group?.id ?? index}`;
      const actionIds = group?.actionIds;
      if (!group || typeof group !== "object" || Array.isArray(group)) {
        report("source-trace/group-invalid", at, `${SOURCE_TRACE_REGISTRY_PATH} group is not an object`);
        continue;
      }
      if (!group.id || typeof group.id !== "string") {
        report("source-trace/group-invalid", at, `${SOURCE_TRACE_REGISTRY_PATH} id must be a nonempty string`);
      }
      if (!knownOwners.has(owner)) {
        report("source-trace/unknown-owner", groupScope, `${SOURCE_TRACE_REGISTRY_PATH} traceGroups`);
      }
      if (!Array.isArray(actionIds) || actionIds.length === 0 || actionIds.some((actionId) => typeof actionId !== "string" || !actionId)) {
        report("source-trace/group-invalid", groupScope, `${SOURCE_TRACE_REGISTRY_PATH} actionIds must be a nonempty string array`);
        continue;
      }
      if (new Set(actionIds).size !== actionIds.length) {
        report("source-trace/group-duplicate-member", groupScope, `${SOURCE_TRACE_REGISTRY_PATH} actionIds repeat a member`);
      }
      if (group.traceDisposition !== "context") {
        report("source-trace/group-invalid-disposition", groupScope, `${SOURCE_TRACE_REGISTRY_PATH} traceDisposition=${group.traceDisposition}`);
      }
      if (group.sourceBasis !== group.basis) {
        report("source-trace/group-basis-mismatch", groupScope, `${SOURCE_TRACE_REGISTRY_PATH} sourceBasis=${group.sourceBasis} basis=${group.basis}`);
      }
      if (typeof group.actionBasis !== "string" || !group.actionBasis.trim()) {
        report("source-trace/group-action-basis-missing", groupScope, `${SOURCE_TRACE_REGISTRY_PATH} actionBasis is required`);
      }
      if (typeof group.mappingRationale !== "string" || !group.mappingRationale.trim()) {
        report("source-trace/group-rationale-missing", groupScope, `${SOURCE_TRACE_REGISTRY_PATH} mappingRationale is required`);
      }
      const reviewedMapping = group.reviewedMapping;
      const reviewedStatus = reviewedMapping?.reviewStatus;
      const reviewedDisposition = reviewedMapping?.decisionDisposition;
      const hasReviewedDecision = [
        "reviewed-static-source-mapping",
        "reviewed-authored-simulator-boundary",
      ].includes(reviewedStatus) && String(reviewedDisposition ?? "").startsWith("reviewed-");
      if (reviewedMapping?.schema !== "lab-studio/source-trace-reviewed-mapping@1") {
        report(
          "source-trace/group-review-state-missing",
          groupScope,
          `${SOURCE_TRACE_REGISTRY_PATH} reviewedMapping.schema must be lab-studio/source-trace-reviewed-mapping@1`,
        );
      } else if (!hasReviewedDecision) {
        report(
          "source-trace/group-review-unresolved",
          groupScope,
          `${SOURCE_TRACE_REGISTRY_PATH} reviewStatus=${reviewedStatus ?? "absent"} decisionDisposition=${reviewedDisposition ?? "absent"}`,
        );
      }
      const selectionModes = reviewedMapping?.selectionModes ?? [];
      if (hasReviewedDecision && !selectionModes.includes("reviewed-explicit")) {
        report(
          "source-trace/group-review-selection-not-explicit",
          groupScope,
          `${SOURCE_TRACE_REGISTRY_PATH} selectionModes=${selectionModes.join(",") || "absent"}`,
        );
      }
      checkSourceCitation(group, "source-trace/group", groupScope, SOURCE_TRACE_REGISTRY_PATH, report);
      if (!world.sourceFiles.has(group.sourceFile)) {
        report(
          "source-trace/unknown-source-file",
          `${groupScope}/${group.sourceFile}`,
          SOURCE_TRACE_REGISTRY_PATH,
        );
      }
      if (world.nonSourceDerivedOwners.has(owner)) {
        report("source-trace/non-source-derived-owner", groupScope, SOURCE_TRACE_REGISTRY_PATH);
      }
      for (const actionId of actionIds) {
        const key = `${owner}#${actionId}`;
        if (groupedActionKeys.has(key)) {
          report("source-trace/group-member-repeated", key, SOURCE_TRACE_REGISTRY_PATH);
        }
        groupedActionKeys.add(key);
        const action = world.actionIndex.get(key);
        if (!action) {
          report("source-trace/unknown-action", `${groupScope}/${actionId}`, SOURCE_TRACE_REGISTRY_PATH);
        } else if (action.atomId !== group.atomId) {
          report(
            "source-trace/group-atom-mismatch",
            `${groupScope}/${actionId}`,
            `${SOURCE_TRACE_REGISTRY_PATH} group atomId=${group.atomId} action atomId=${action.atomId}`,
          );
        }
        const directKey = key;
        if (world.registries.sourceTrace.traces.some((trace) => `${trace.ownerType}:${trace.ownerId}#${trace.actionId}` === directKey)) {
          report("source-trace/group-member-already-traced", directKey, SOURCE_TRACE_REGISTRY_PATH);
        }
      }
    }
  }

  // The basis and the table kind are properties of the source row, not of the citation. Two
  // citations of the same row that disagree mean at least one of them was transcribed wrong, which
  // no per-citation rule above can see.
  //
  // A source row is identified by (file, table, step), not by (file, step). `sourceTableLegend`
  // already says so -- it records the table precisely "so a safety S-08 cannot be confused with a
  // procedure-phase S-08" -- but this comparison did not, so two different rows that happen to
  // share a step id were reported as one row cited inconsistently, and their legitimately different
  // bases as a transcription error. Bases are therefore compared within a table.
  //
  // The table kind itself is still compared, because a mistyped table would otherwise hide behind
  // the same split. A derived plan that genuinely reuses a step id across two of its tables has to
  // declare that in the registry, with its rationale, before the split is accepted.
  //
  // The declaration is data like any other row, so it is validated before it is trusted. An
  // ill-formed declaration, one naming a table the legend does not define, or a second declaration
  // for a step some earlier declaration already covers, is reported and then *dropped*: it neither
  // grants the exception nor overwrites the declaration it conflicts with. Otherwise the escape
  // hatch would be a way to silence an arbitrary table mismatch by writing a plausible-looking
  // object next to it.
  //
  // What this validation is not: it checks shape, legal table values and uniqueness. Whether the
  // two rows really do exist in the named plan under that step id, and whether the rationale is
  // true, is a question about the original source that only a human reviewer can answer. Valid
  // metadata is not evidence.
  const declaredCrossTableSteps = new Map();
  const hasCrossTableStepIdentifiers = Object.prototype.hasOwnProperty.call(
    registry,
    "crossTableStepIdentifiers",
  );
  const crossTableStepIdentifiers = registry.crossTableStepIdentifiers;
  if (hasCrossTableStepIdentifiers && !Array.isArray(crossTableStepIdentifiers)) {
    report(
      "source-citation/cross-table-declaration-invalid",
      "crossTableStepIdentifiers",
      `${SOURCE_TRACE_REGISTRY_PATH} crossTableStepIdentifiers must be an array`,
    );
  }
  const declarations = Array.isArray(crossTableStepIdentifiers) ? crossTableStepIdentifiers : [];
  const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
  for (const [index, declaration] of declarations.entries()) {
    const at = `crossTableStepIdentifiers[${index}]`;
    const invalid = [];
    if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
      invalid.push("declaration is not a non-array object");
    }
    const sourceFile = declaration?.sourceFile;
    const step = declaration?.step;
    const tables = declaration?.sourceTables;
    if (!nonEmptyString(sourceFile)) invalid.push("sourceFile must be a nonempty string");
    else if (!world.sourceFiles.has(sourceFile)) invalid.push(`sourceFile=${sourceFile} is not a declared source file`);
    if (!nonEmptyString(step)) invalid.push("step must be a nonempty string");
    if (!Array.isArray(tables) || tables.length < 2) invalid.push("sourceTables needs at least two tables");
    else {
      if (new Set(tables).size !== tables.length) invalid.push("sourceTables repeats a table");
      for (const table of tables) {
        if (!SOURCE_TABLES.has(table)) invalid.push(`sourceTables contains unknown table ${String(table)}`);
      }
    }
    if (!nonEmptyString(declaration?.rationale)) invalid.push("rationale must be a nonempty string");
    const key = nonEmptyString(sourceFile) && nonEmptyString(step)
      ? `${sourceFile}#${step}`
      : at;
    if (invalid.length > 0) {
      report(
        "source-citation/cross-table-declaration-invalid",
        key,
        `${SOURCE_TRACE_REGISTRY_PATH} ${at}: ${invalid.join("; ")}`,
      );
      continue;
    }
    if (declaredCrossTableSteps.has(key)) {
      report(
        "source-citation/cross-table-declaration-duplicate",
        key,
        `${SOURCE_TRACE_REGISTRY_PATH} ${at} re-declares a step already covered by another entry`,
      );
      continue;
    }
    declaredCrossTableSteps.set(key, new Set(tables));
  }
  const citations = new Map();
  const noteCitation = (citation, where) => {
    const key = `${citation.sourceFile}#${citation.step}`;
    if (!citations.has(key)) citations.set(key, []);
    citations.get(key).push({ ...citation, where });
  };
  for (const atom of world.registries.atoms.atoms) {
    for (const example of atom.sourceExamples) noteCitation(example, atom.id);
  }
  for (const trace of registry.traces) {
    noteCitation(trace, `${trace.ownerType}:${trace.ownerId}/${trace.actionId}`);
  }
  for (const group of registry.traceGroups ?? []) {
    noteCitation(group, `${group.ownerType}:${group.ownerId}/${group.id}`);
  }
  for (const [key, group] of citations) {
    const tables = [...new Set(group.map((citation) => citation.sourceTable))];
    const declared = declaredCrossTableSteps.get(key);
    if (tables.length > 1 && !(declared && tables.every((table) => declared.has(table)))) {
      report(
        "source-citation/sourceTable-disagreement",
        key,
        group.map((citation) => `${citation.where}=${citation.sourceTable}`).join(" | "),
      );
    }
    for (const table of tables) {
      const row = group.filter((citation) => citation.sourceTable === table);
      if (new Set(row.map((citation) => citation.basis)).size < 2) continue;
      report(
        "source-citation/basis-disagreement",
        `${key}#${table}`,
        row.map((citation) => `${citation.where}=${citation.basis}`).join(" | "),
      );
    }
  }

  for (const reference of world.srcTraceReferences) {
    report("source-trace/runtime-exposure", reference, `${reference} imports ${SOURCE_TRACE_REGISTRY_PATH}`);
  }
  for (const leak of world.publicTraceLeaks) {
    report("source-trace/serialized-in-public-json", leak.scope, leak.evidence, {
      convention: leak.convention,
    });
  }
};

const checkVisualStates = (world, report) => {
  const registry = world.registries.visualStates;
  const byId = new Map(registry.states.map((state) => [state.id, state]));
  const stateAssetIds = new Set([...world.stateAssetsByEquipment.values()].flat());
  const fallbacks = registry.fallbacks ?? {};
  const fallbackStates = new Set([
    ...(fallbacks.definitionIdStates ?? []).map((entry) => entry.state),
    ...(fallbacks.reagentKeywordStates ?? []).map((entry) => entry.state),
  ]);

  for (const state of registry.states) {
    if (!VISUAL_STATE_DISPOSITIONS.has(state.disposition)) {
      report("visual-state/unknown-disposition", state.id, VISUAL_STATE_REGISTRY_PATH);
      continue;
    }
    if (state.quantitativeClaim !== "none" && state.quantitativeClaim !== "ordinal") {
      report(
        "visual-state/invalid-quantitative-claim",
        state.id,
        `${VISUAL_STATE_REGISTRY_PATH} quantitativeClaim=${state.quantitativeClaim}`,
      );
    }
    if (!VISUAL_STATE_EVIDENCE_KINDS.has(state.evidenceKind)) {
      report(
        "visual-state/unknown-evidence-kind",
        state.id,
        `${VISUAL_STATE_REGISTRY_PATH} evidenceKind=${state.evidenceKind}`,
      );
    }
    const selectors = state.selectors ?? [];
    for (const selector of selectors) {
      if (!VISUAL_STATE_SELECTORS.has(selector)) {
        report("visual-state/unknown-selector", `${state.id}/${selector}`, VISUAL_STATE_REGISTRY_PATH);
      }
    }
    // `authored` is not an opinion: it is exactly whether content sets this state today.
    if (selectors.includes("authored") !== Boolean(state.authoredToday)) {
      report(
        "visual-state/selector-disagrees-with-authoring",
        state.id,
        `${VISUAL_STATE_REGISTRY_PATH} authoredToday=${state.authoredToday} selectors=${selectors.join("+") || "none"}`,
      );
    }
    // A fallback table entry is a reachability claim; the state it names must declare the selector.
    const fallbackSelector = selectors.includes("definition-id") || selectors.includes("reagent-heuristic");
    if (fallbackStates.has(state.id) !== fallbackSelector) {
      report(
        "visual-state/fallback-selector-mismatch",
        state.id,
        `${VISUAL_STATE_REGISTRY_PATH} named by a fallback table=${fallbackStates.has(state.id)} declares a fallback selector=${fallbackSelector}`,
      );
    }
    if (state.disposition === "liquid-style") {
      const key = state.renderStyleKey ?? state.id;
      if (!state.renderStyle || !state.renderStyle.fill) {
        report("visual-state/style-missing", state.id, `${VISUAL_STATE_REGISTRY_PATH} renderStyle`);
      }
      if (key !== state.id && !byId.has(key)) {
        report(
          "visual-state/style-key-unregistered",
          `${state.id}/${key}`,
          `${VISUAL_STATE_REGISTRY_PATH} renderStyleKey`,
        );
      }
    }
    if (state.disposition === "solid-style" && !state.solidStyle?.fill) {
      report("visual-state/style-missing", state.id, `${VISUAL_STATE_REGISTRY_PATH} solidStyle`);
    }
    if (state.disposition === "state-asset") {
      const covered = (state.stateAssetEquipmentIds ?? []).some((equipmentId) =>
        (world.stateAssetsByEquipment.get(equipmentId) ?? []).includes(state.id),
      );
      if (!covered) {
        report("visual-state/state-asset-missing", state.id, VISUAL_STATE_REGISTRY_PATH);
      }
    }
    // A state that can render but that no selector reaches is unreachable debt, whatever its kind.
    if (RENDERABLE_DISPOSITIONS.has(state.disposition) && selectors.length === 0) {
      report("visual-state/registered-but-never-authored", state.id, VISUAL_STATE_REGISTRY_PATH, {
        ownerCycle: state.ownerCycle,
      });
    }
    // Two states may look alike, but only when both say so.
    for (const other of state.sharesAppearanceWith ?? []) {
      const peer = byId.get(other);
      if (!peer || !(peer.sharesAppearanceWith ?? []).includes(state.id)) {
        report(
          "visual-state/shared-appearance-undeclared",
          `${state.id}/${other}`,
          VISUAL_STATE_REGISTRY_PATH,
        );
      }
    }
    if (state.disposition === "unresolved") {
      report("visual-state/unresolved", state.id, state.owners.join(" | ") || VISUAL_STATE_REGISTRY_PATH, {
        ownerCycle: state.ownerCycle,
      });
    }
  }

  // Undeclared identical appearance is the other half of the rule above: any two renderable states
  // with byte-identical style objects must both name each other.
  const byStyle = new Map();
  for (const state of registry.states) {
    const style = state.renderStyle ?? state.solidStyle;
    if (!style) continue;
    const key = JSON.stringify(canonical(style));
    byStyle.set(key, [...(byStyle.get(key) ?? []), state.id]);
  }
  for (const ids of byStyle.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const declared = new Set(byId.get(id)?.sharesAppearanceWith ?? []);
      for (const other of ids) {
        if (other !== id && !declared.has(other)) {
          report("visual-state/shared-appearance-undeclared", `${id}/${other}`, VISUAL_STATE_REGISTRY_PATH);
        }
      }
    }
  }

  for (const entry of fallbacks.definitionIdStates ?? []) {
    if (!world.equipment.has(entry.definitionId)) {
      report("visual-state/fallback-unknown-equipment", entry.definitionId, VISUAL_STATE_REGISTRY_PATH);
    }
    if (!byId.has(entry.state)) {
      report("visual-state/fallback-unknown-state", entry.state, VISUAL_STATE_REGISTRY_PATH);
    }
  }
  for (const entry of fallbacks.reagentKeywordStates ?? []) {
    if (!byId.has(entry.state)) {
      report("visual-state/fallback-unknown-state", entry.state, VISUAL_STATE_REGISTRY_PATH);
    }
  }
  // The two defaults are what an unresolved or unregistered state falls back to, so each must exist
  // and must be of the kind it is defaulting for. A liquid default that names a solid renders nothing.
  for (const [key, disposition] of [
    ["defaultLiquidState", "liquid-style"],
    ["defaultSolidState", "solid-style"],
  ]) {
    const state = byId.get(fallbacks[key]);
    if (!state || state.disposition !== disposition) {
      report(
        "visual-state/fallback-default-unrenderable",
        key,
        `${VISUAL_STATE_REGISTRY_PATH} ${key}=${fallbacks[key]} disposition=${state?.disposition ?? "unregistered"} expected=${disposition}`,
      );
    }
  }

  for (const [stateId, owners] of world.authoredVisualStates) {
    if (byId.has(stateId)) continue;
    report("visual-state/unregistered", stateId, [...owners].sort().join(" | "));
  }
  for (const stateId of stateAssetIds) {
    if (!byId.has(stateId)) {
      report("visual-state/unregistered", stateId, "src/equipment/visualCatalog.ts stateAssets");
    }
  }
};

const checkAssets = (world, report) => {
  const registry = world.registries.assets;
  const byId = new Map(registry.assets.map((asset) => [asset.id, asset]));

  for (const asset of registry.assets) {
    if (!ASSET_DISPOSITIONS.has(asset.disposition)) {
      report("asset/unknown-disposition", asset.id, ASSET_REGISTRY_PATH);
      continue;
    }
    if (!world.assetFiles.has(asset.file.split("/").pop())) {
      report("asset/missing-file", asset.id, `${ASSET_REGISTRY_PATH} file=${asset.file}`);
      continue;
    }
    const tags = world.reachability.get(asset.id) ?? [];
    const expected =
      tags.includes("player-base")
        ? "player-active"
        : tags.includes("accessory-presentation")
          ? "accessory-active"
          : tags.includes("composite-branch")
            ? "composite-active"
            : tags.includes("visual-catalog")
              ? "state-active"
              : tags.includes("custom-route")
                ? "custom-route-active"
                : tags.length === 1 && tags[0] === "gallery"
                  ? "gallery-only"
                  : null;
    if (expected && asset.disposition !== expected) {
      report(
        "asset/disposition-mismatch",
        asset.id,
        `${ASSET_REGISTRY_PATH} declared=${asset.disposition} derived=${expected} tags=${tags.join("+") || "none"}`,
      );
    }
    if (!expected && asset.disposition !== "intentionally-unused" && asset.disposition !== "remediation-candidate") {
      report(
        "asset/disposition-mismatch",
        asset.id,
        `${ASSET_REGISTRY_PATH} declared=${asset.disposition} but no code path reaches it`,
      );
    }
    if (asset.disposition === "remediation-candidate") {
      report("asset/remediation-candidate", asset.id, asset.file, { ownerCycle: asset.ownerCycle });
    }
  }

  for (const file of world.assetFiles) {
    const base = file.replace(/\.(svg|png)$/, "");
    if (file.endsWith(".png") && world.assetFiles.has(`${base}.svg`)) continue;
    if (!byId.has(base)) {
      report("asset/unclassified", base, `${REALISTIC_DIR}/${file}`);
    }
  }

  // A directory or a non-image file inside the asset folder could hide an asset from every
  // reachability rule above, so each one must be documented rather than merely skipped.
  const documented = new Set((registry.nonAssetEntries ?? []).map((entry) => entry.name));
  for (const name of world.assetDirectoryEntries) {
    if (!documented.has(name)) {
      report("asset/undocumented-directory-entry", name, `${REALISTIC_DIR}/${name}`);
    }
  }

  // The AGENTS.md wrapper contract, enforced instead of trusted. Cycle 05 measured all 119 wrappers
  // as compliant; without a rule, the next generated asset is free to diverge from its PNG.
  for (const [id, wrapper] of world.assetWrappers) {
    for (const problem of wrapper.problems) {
      report(`asset/wrapper-${problem.rule}`, id, `${REALISTIC_DIR}/${id}.svg ${problem.detail}`);
    }
  }
};

const checkAliases = (world, report) => {
  const registry = world.registries.aliases;
  const documented = new Map();
  for (const alias of registry.aliases) {
    documented.set(alias.asset, alias);
    if (!alias.rationale || alias.rationale.trim().length === 0) {
      report("alias/rationale-missing", alias.asset, ALIAS_REGISTRY_PATH);
    }
    // Sharing art is permitted only while the semantics stay separate, so the requirement itself
    // must be asserted, not merely honoured by today's data.
    if (alias.labelsMustStayDistinct !== true) {
      report("alias/label-requirement-waived", alias.asset, ALIAS_REGISTRY_PATH);
    }
    const labels = new Set();
    for (const equipmentId of alias.equipmentIds) {
      const definition = world.equipment.get(equipmentId);
      if (!definition) {
        report("alias/unknown-equipment", `${alias.asset}/${equipmentId}`, ALIAS_REGISTRY_PATH);
        continue;
      }
      if (world.realisticAssetById.get(equipmentId) !== alias.asset) {
        report(
          "alias/asset-mismatch",
          `${alias.asset}/${equipmentId}`,
          `${ALIAS_REGISTRY_PATH} catalog maps it to ${world.realisticAssetById.get(equipmentId)}`,
        );
      }
      if (alias.labelsMustStayDistinct && labels.has(definition.label)) {
        report("alias/label-collision", `${alias.asset}/${equipmentId}`, `label=${definition.label}`);
      }
      labels.add(definition.label);
    }
    // The shared wrapper carries one aria-label for every aliased definition, so the accessible
    // distinction has to come from the equipment label the player renders.
    const wrapper = world.assetWrappers.get(alias.asset);
    if (wrapper && !wrapper.ariaLabel) {
      report("alias/shared-wrapper-unlabelled", alias.asset, `${REALISTIC_DIR}/${alias.asset}.svg`);
    }
  }

  const sharing = new Map();
  for (const [equipmentId, asset] of world.realisticAssetById) {
    if (!asset) continue;
    if (!sharing.has(asset)) sharing.set(asset, []);
    sharing.get(asset).push(equipmentId);
  }
  for (const [asset, equipmentIds] of sharing) {
    if (equipmentIds.length < 2) continue;
    const alias = documented.get(asset);
    if (!alias) {
      report("alias/undocumented-shared-asset", asset, equipmentIds.sort().join(" | "));
      continue;
    }
    for (const equipmentId of equipmentIds) {
      if (!alias.equipmentIds.includes(equipmentId)) {
        report("alias/incomplete", `${asset}/${equipmentId}`, ALIAS_REGISTRY_PATH);
      }
    }
  }
};

const checkComposites = (world, report) => {
  const registry = world.registries.composites;
  const assetIds = new Set(world.registries.assets.assets.map((asset) => asset.id));
  const roleIds = new Set(world.registries.roles.roles.map((role) => role.id));
  const rolesById = new Map(world.registries.roles.roles.map((role) => [role.id, role]));

  for (const composite of registry.composites) {
    if (!COMPOSITE_KINDS.has(composite.kind)) {
      report("composite/unknown-kind", `${composite.id}/${composite.kind}`, COMPOSITE_REGISTRY_PATH);
      continue;
    }
    if (!assetIds.has(composite.resultAsset)) {
      report("composite/unknown-asset", `${composite.id}/${composite.resultAsset}`, COMPOSITE_REGISTRY_PATH);
    }

    const participants = composite.participants ?? [];
    const parents = participants.filter((participant) => participant.parent);
    if (parents.length !== 1 || parents[0].definitionId !== composite.parentDefinitionId) {
      report(
        "composite/parent-participant-invalid",
        composite.id,
        `${COMPOSITE_REGISTRY_PATH} ${parents.length} parent participants, parentDefinitionId=${composite.parentDefinitionId}`,
      );
    }
    for (const participant of participants) {
      const scope = `${composite.id}/${participant.role}`;
      if (!world.equipment.has(participant.definitionId)) {
        report("composite/unknown-equipment", `${composite.id}/${participant.definitionId}`, COMPOSITE_REGISTRY_PATH);
      }
      if (!COMPOSITE_ROLE_KINDS.has(participant.roleKind)) {
        report("composite/unknown-role-kind", `${scope}/${participant.roleKind}`, COMPOSITE_REGISTRY_PATH);
      }
      // A role binding is either absent — recorded as a deviation — or real and permitting this
      // equipment. A binding that names a role the equipment is not allowed in is worse than none.
      if (participant.equipmentRoleId) {
        if (!roleIds.has(participant.equipmentRoleId)) {
          report("composite/unknown-equipment-role", `${scope}/${participant.equipmentRoleId}`, COMPOSITE_REGISTRY_PATH);
        } else {
          const allowed = rolesById.get(participant.equipmentRoleId).allowedEquipmentIds ?? [];
          if (!allowed.includes(participant.definitionId)) {
            report(
              "composite/role-forbids-participant",
              `${scope}/${participant.equipmentRoleId}`,
              `${ROLE_REGISTRY_PATH} does not allow ${participant.definitionId}`,
            );
          }
        }
      }
      if (participant.parent) {
        if (participant.snapZoneId !== null || participant.suppressed) {
          report("composite/parent-participant-invalid", scope, `${COMPOSITE_REGISTRY_PATH} a parent occupies no zone and is never suppressed`);
        }
        continue;
      }
      if (!participant.snapZoneId) {
        report("composite/missing-snap-prerequisite", scope, COMPOSITE_REGISTRY_PATH, {
          ownerCycle: composite.ownerCycle,
        });
      } else if (!world.snapZoneIds.has(participant.snapZoneId)) {
        report("composite/unknown-snap-zone", `${scope}/${participant.snapZoneId}`, COMPOSITE_REGISTRY_PATH);
      } else {
        const zone = world.snapZoneAccepts.get(participant.snapZoneId);
        const attachmentParent = participant.attachmentParentRole
          ? participants.find((candidate) => candidate.role === participant.attachmentParentRole)
          : parents[0];
        if (participant.attachmentParentRole && !attachmentParent) {
          report(
            "composite/unknown-attachment-parent-role",
            `${scope}/${participant.attachmentParentRole}`,
            COMPOSITE_REGISTRY_PATH,
          );
        }
        if (zone && !zone.accepts.includes(participant.definitionId)) {
          report(
            "composite/snap-zone-rejects-participant",
            `${scope}/${participant.snapZoneId}`,
            `src/domain/interactionZones.ts accepts ${zone.accepts.join(", ") || "nothing"}`,
          );
        }
        if (zone && attachmentParent && zone.owner !== attachmentParent.definitionId) {
          report(
            "composite/snap-zone-owned-elsewhere",
            `${scope}/${participant.snapZoneId}`,
            `src/domain/interactionZones.ts owner=${zone.owner}; declared attachment parent=${attachmentParent.definitionId}`,
          );
        }
      }
    }

    if (composite.kind === "instance-swap") {
      if (!composite.resultInstanceDefinitionId) {
        report("composite/swap-without-result-instance", composite.id, COMPOSITE_REGISTRY_PATH);
      } else if (!world.equipment.has(composite.resultInstanceDefinitionId)) {
        report(
          "composite/unknown-equipment",
          `${composite.id}/${composite.resultInstanceDefinitionId}`,
          COMPOSITE_REGISTRY_PATH,
        );
      }
      if (!composite.invalidFeedback?.message || !composite.invalidFeedback?.recovery) {
        report("composite/invalid-feedback-undeclared", composite.id, COMPOSITE_REGISTRY_PATH, {
          ownerCycle: composite.ownerCycle,
        });
      }
    } else {
      if (composite.resultInstanceDefinitionId) {
        report("composite/visual-declares-result-instance", composite.id, COMPOSITE_REGISTRY_PATH);
      }
      if (composite.invalidFeedback) {
        report("composite/visual-declares-invalid-feedback", composite.id, COMPOSITE_REGISTRY_PATH);
      }
      if (!registry.rendererPrecedence.includes(composite.id)) {
        report("composite/absent-from-precedence", composite.id, COMPOSITE_REGISTRY_PATH);
      }
    }

    for (const [name, behaviour] of [
      ["detach", composite.detach],
      ["recovery", composite.recovery],
      ["reset", composite.reset],
    ]) {
      if (!behaviour) {
        report(`composite/${name}-undeclared`, composite.id, COMPOSITE_REGISTRY_PATH, {
          ownerCycle: composite.ownerCycle,
        });
      } else if (behaviour.compositeAware !== true) {
        report(`composite/${name}-not-composite-aware`, composite.id, COMPOSITE_REGISTRY_PATH, {
          ownerCycle: composite.ownerCycle,
        });
      }
    }

    if (composite.requiredContentsVisualState !== null) {
      const state = world.registries.visualStates.states.find(
        (candidate) => candidate.id === composite.requiredContentsVisualState,
      );
      if (!state) {
        report(
          "composite/unknown-required-visual-state",
          `${composite.id}/${composite.requiredContentsVisualState}`,
          COMPOSITE_REGISTRY_PATH,
        );
      }
    }

    // A state asset wins the asset override. src/equipment/composites.ts honours that precedence and
    // then draws no composite at all, so an assembly is never rendered missing a part — but the
    // invariant still forbids the situation rather than relying on the fallback.
    if ((world.stateAssetsByEquipment.get(composite.parentDefinitionId) ?? []).length > 0) {
      report("composite/parent-has-state-assets", composite.id, COMPOSITE_REGISTRY_PATH);
    }
    if (composite.extraOverlay && !world.compositeOverlayIds.has(composite.extraOverlay)) {
      report(
        "composite/unknown-overlay",
        `${composite.id}/${composite.extraOverlay}`,
        "src/player/equipmentOverlays.tsx compositeOverlayById",
      );
    }
  }

  for (const id of registry.rendererPrecedence) {
    if (id.includes(".") || id.includes("[")) continue;
    const composite = registry.composites.find((candidate) => candidate.id === id);
    if (!composite) {
      report("composite/unknown-precedence-entry", id, COMPOSITE_REGISTRY_PATH);
    } else if (composite.kind !== "visual") {
      report("composite/non-visual-in-precedence", id, COMPOSITE_REGISTRY_PATH);
    }
  }

  // The point of the cycle: recognition lives in one module. If a composite's own literals reappear
  // in the renderer or the reducer, a second path has grown back.
  for (const [file, leaked] of world.compositeLeaks) {
    for (const literal of leaked) {
      report("composite/hard-coded-branch", `${file}/${literal}`, file);
    }
  }
  // The mirror image: a caller that stopped reaching the evaluator has stopped being driven by it.
  for (const [file, missingImport] of world.compositeEvaluatorConsumers ?? []) {
    if (missingImport) {
      report("composite/evaluator-not-consumed", file, `${file} no longer calls ${missingImport}`);
    }
  }
  if (!world.compositeEvaluatorPresent) {
    report("composite/evaluator-missing", COMPOSITE_EVALUATOR_PATH, COMPOSITE_EVALUATOR_PATH);
  }
};

/** Action `parameters` keys that name a lab-owned simulation model, and the array that owns them. */
const MODEL_PARAMETER_COLLECTIONS = {
  titrationModelId: "titrationModels",
  chromatographyModelId: "chromatographyModels",
  kineticsModelId: "kineticsModels",
};

/** Mirrors `actionEquipmentParameterKeys` in src/domain/validation.ts. */
const EQUIPMENT_PARAMETER_KEYS = [
  "equipmentDefinitionId",
  "sourceDefinitionId",
  "targetDefinitionId",
  "instrumentDefinitionId",
  "ovenDefinitionId",
  "heatSourceDefinitionId",
  "coolingToolDefinitionId",
];

const equipmentIdsUsedByAction = (action) => {
  const used = new Set();
  for (const key of EQUIPMENT_PARAMETER_KEYS) {
    const value = action.parameters?.[key];
    if (present(value)) used.add(value);
  }
  if (present(action.interaction?.sourceDefinitionId)) used.add(action.interaction.sourceDefinitionId);
  if (present(action.interaction?.targetDefinitionId)) used.add(action.interaction.targetDefinitionId);
  return used;
};

const labOwnedModelIds = (definition, collection) => {
  const ids = new Set();
  for (const model of definition[collection] ?? []) ids.add(model.id);
  for (const technique of definition.techniques ?? []) {
    for (const model of technique[collection] ?? []) ids.add(model.id);
  }
  return ids;
};

/**
 * Version-pinned technique action references — the static half of the Cycle 03 contract.
 *
 * `src/data/hydrateBundledLab.ts` enforces the same rules at load time, where a violation becomes a
 * `BundleContentError` a student would see as a broken lab. These rules move that failure to CI, so
 * a migration in Cycles 04+ cannot ship a reference that only breaks in the browser.
 */
const checkTechniqueRefs = (world, report) => {
  const standalone = standaloneTechniquesById(world);
  for (const entry of world.owners) {
    const refs = entry.definition.techniqueRefs;
    if (!Array.isArray(refs)) continue;
    if (entry.scope !== "labRoot") {
      // Hydration runs on bundled lab sources only. A reference anywhere else is never resolved,
      // so its actions would silently vanish instead of being imported.
      report("technique-ref/unsupported-owner", entry.owner, `${entry.file} scope=${entry.scope}`);
      continue;
    }
    const imported = new Map();
    const referencedTechniques = new Set();
    const declaredEquipment = new Set(entry.definition.equipment ?? []);
    const declaredModelIds = Object.fromEntries(
      Object.values(MODEL_PARAMETER_COLLECTIONS).map((collection) => [
        collection,
        labOwnedModelIds(entry.definition, collection),
      ]),
    );
    for (const ref of refs) {
      const scope = `${entry.owner}/${ref.techniqueId}`;
      if (referencedTechniques.has(ref.techniqueId)) {
        report("technique-ref/duplicate-technique", scope, entry.file);
        continue;
      }
      referencedTechniques.add(ref.techniqueId);
      if (!present(ref.version)) {
        report("technique-ref/version-not-pinned", scope, entry.file);
        continue;
      }
      if (ref.actionIds !== "all" && (!Array.isArray(ref.actionIds) || ref.actionIds.length === 0)) {
        report("technique-ref/empty-selection", scope, entry.file);
        continue;
      }
      const technique = standalone.get(ref.techniqueId);
      if (!technique) {
        report("technique-ref/unknown-technique", scope, entry.file);
        continue;
      }
      if (technique.metadata?.version !== ref.version) {
        report(
          "technique-ref/version-mismatch",
          scope,
          `${entry.file} pinned=${ref.version} actual=${technique.metadata?.version}`,
        );
        continue;
      }
      const available = new Map((technique.actions ?? []).map((action) => [action.id, action]));
      const selected =
        ref.actionIds === "all" ? [...available.keys()] : ref.actionIds ?? [];
      for (const actionId of selected) {
        const action = available.get(actionId);
        if (!action) {
          report("technique-ref/missing-action", `${scope}/${actionId}`, entry.file);
          continue;
        }
        if (imported.has(actionId)) {
          report("technique-ref/duplicate-imported-action-id", `${entry.owner}/${actionId}`, entry.file);
          continue;
        }
        imported.set(actionId, ref.techniqueId);

        // A reference imports actions and nothing else, so anything else the action needs has to be
        // declared by the lab. Otherwise the import quietly depends on technique-owned state.
        for (const equipmentId of equipmentIdsUsedByAction(action)) {
          if (!declaredEquipment.has(equipmentId)) {
            report(
              "technique-ref/imported-equipment-undeclared",
              `${scope}/${actionId}/${equipmentId}`,
              `${entry.file} lab.equipment is missing ${equipmentId}`,
            );
          }
        }
        for (const [parameterKey, collection] of Object.entries(MODEL_PARAMETER_COLLECTIONS)) {
          const modelId = action.parameters?.[parameterKey];
          if (!present(modelId)) continue;
          if (!declaredModelIds[collection].has(modelId)) {
            report(
              "technique-ref/imported-model-undeclared",
              `${scope}/${actionId}/${modelId}`,
              `${entry.file} lab.${collection} is missing ${modelId}`,
            );
          }
        }
      }
    }
    for (const action of entry.definition.actions ?? []) {
      if (imported.has(action.id)) {
        report("technique-ref/duplicate-imported-action-id", `${entry.owner}/${action.id}`, entry.file);
      }
    }
    // Unresolved process references are owned by `process/unresolved-action-reference`, which
    // already resolves through `techniqueRefs`. Reporting them again here would double-count.
  }
};

// === CYCLE 11 RULES (BEGIN) ===
/*
 * Investigation 10 (gas-syringe kinetics) and Investigation 6 (bonding in unknown solids).
 *
 * These rules are keyed on atom ids rather than on owner ids, so they hold for any owner that adopts
 * the kinetics or qualitative-analysis atoms rather than only for the two labs Cycle 11 remediated.
 * They exist because the defects they describe were all present in authored content that every other
 * rule in this file accepted: the marble lab sealed the reaction flask before the acid and the marble
 * went in, no action moved the marble at all, three rate calculations carried a stored answer, and the
 * bonding lab drove thirty-five pieces of realistic apparatus with zero physical verbs.
 */

const CYCLE_11_KINETICS_ORDER = [
  "atom.place.gas-delivery-train",
  "atom.observe.zero-gas-collection-instrument",
  "atom.transfer.initiate-solid-reactant-contact",
  "atom.place.gas-collection-apparatus",
  "atom.record.timed-gas-volume",
];

const CYCLE_11_BEFORE_CONTACT = [
  "atom.measure.variable-volume",
  "atom.transfer.measured-liquid",
  "atom.weigh.solid-reactant-portion",
];

const CYCLE_11_AQUEOUS_READS = new Set([
  "atom.observe.read-aqueous-conductivity",
  "atom.observe.read-ph-indicator",
]);

/**
 * Linear process order by action id.
 *
 * Returns an **empty map** for a branching or unwalkable process, and every ordering rule below is
 * guarded on `order.size > 0`. That is a deliberate limit, not an oversight: this cycle's owners are
 * single chains, and inferring "before" from a graph with branches would need a dominance relation
 * rather than a walk. The consequence is that the ordering rules go quiet rather than wrong if a later
 * cycle branches one of these processes, so they are a floor on a linear graph and not a guarantee on
 * an arbitrary one. The prerequisite-shaped rules — which do not consult this map — still apply.
 */
const cycle11ProcessOrder = (definition) => {
  const positions = new Map();
  const nodes = definition.process?.nodes ?? [];
  const edges = definition.process?.edges ?? [];
  const outgoing = new Map();
  for (const edge of edges) {
    if (outgoing.has(edge.from)) return positions;
    outgoing.set(edge.from, edge.to);
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set();
  let cursor = definition.process?.startNodeId;
  let index = 0;
  while (cursor && nodeById.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    const actionId = nodeById.get(cursor).actionId;
    if (actionId && !positions.has(actionId)) positions.set(actionId, index);
    index += 1;
    cursor = outgoing.get(cursor);
  }
  return seen.size === nodes.length ? positions : new Map();
};

const cycle11PrerequisiteActionIds = (action) =>
  (action.prerequisites ?? [])
    .filter((rule) => rule.type === "actionEvidence" && present(rule.actionId))
    .map((rule) => rule.actionId);

const checkCycle11Protocols = (world, report) => {
  const qualitativeAtoms = new Set(
    (world.registries.atoms.atoms ?? [])
      .filter((atom) => atom.family === "qualitative-analysis")
      .map((atom) => atom.id),
  );
  const syringeStates = (world.registries.visualStates.states ?? []).filter((state) =>
    state.id.startsWith("syringe-"),
  );
  for (const state of syringeStates) {
    // Cycle 11 owns the whole `syringe-*` family so that Cycle 12 extends it by adding a value rather
    // than renaming one. A member left unresolved, or resolved without naming the equipment whose
    // stateAssets carry it, breaks that promise silently.
    if (state.disposition === "unresolved") {
      report("cycle11/syringe-state-unresolved", state.id, VISUAL_STATE_REGISTRY_PATH);
    }
    if (state.disposition === "state-asset" && (state.stateAssetEquipmentIds ?? []).length === 0) {
      report("cycle11/syringe-state-asset-unbound", state.id, VISUAL_STATE_REGISTRY_PATH);
    }
  }

  for (const entry of world.owners) {
    if (!entry.runtimeExecuted) continue;
    const actions = entry.definition.actions ?? [];
    const byAtom = new Map();
    for (const action of actions) {
      if (!present(action.atomId)) continue;
      byAtom.set(action.atomId, [...(byAtom.get(action.atomId) ?? []), action]);
    }
    const atomOf = new Map(
      actions.filter((action) => present(action.atomId)).map((action) => [action.id, action.atomId]),
    );
    const order = cycle11ProcessOrder(entry.definition);
    const positionOf = (actionId) => order.get(actionId);

    /* ---- Investigation 10: the chronology, and what may not be stored ---- */

    if (byAtom.has("atom.place.gas-collection-apparatus")) {
      for (const seal of byAtom.get("atom.place.gas-collection-apparatus")) {
        // T-11 adds the solid to the acid; T-12 seals only afterwards, through the approved expanding
        // path. A seal that does not require the contact evidence can be reached with an empty flask,
        // which is the defect this cycle found.
        const requiresContact = cycle11PrerequisiteActionIds(seal).some(
          (actionId) => atomOf.get(actionId) === "atom.transfer.initiate-solid-reactant-contact",
        );
        if (!requiresContact) {
          report(
            "cycle11/gas-seal-without-reactant-contact",
            `${entry.owner}/${seal.id}`,
            `${entry.file} no actionEvidence prerequisite names an atom.transfer.initiate-solid-reactant-contact action`,
          );
        }
      }
      if (!byAtom.has("atom.observe.zero-gas-collection-instrument")) {
        report(
          "cycle11/gas-collection-instrument-never-zeroed",
          entry.owner,
          `${entry.file} seals a collection path but publishes no atom.observe.zero-gas-collection-instrument action`,
        );
      }
    }

    for (const contact of byAtom.get("atom.transfer.initiate-solid-reactant-contact") ?? []) {
      // S-06 inspects the tubing, stopper and collection device before reaction. The leak and baseline
      // check is a notebook gate, so the contact action must consume one.
      const notebookGates = (contact.prerequisites ?? []).filter(
        (rule) => rule.type === "notebookEntry" && present(rule.notebookTag),
      );
      if (notebookGates.length === 0) {
        report(
          "cycle11/reactant-contact-without-path-check",
          `${entry.owner}/${contact.id}`,
          `${entry.file} no notebookEntry prerequisite gates reactant contact on the leak and baseline check`,
        );
      }
    }

    if (order.size > 0) {
      const sequence = CYCLE_11_KINETICS_ORDER.map((atomId) => ({
        atomId,
        positions: (byAtom.get(atomId) ?? [])
          .map((action) => positionOf(action.id))
          .filter((value) => value !== undefined),
      })).filter((step) => step.positions.length > 0);
      for (let index = 1; index < sequence.length; index += 1) {
        const previous = Math.min(...sequence[index - 1].positions);
        const current = Math.min(...sequence[index].positions);
        if (previous >= current) {
          report(
            "cycle11/kinetics-chronology-out-of-order",
            `${entry.owner}/${sequence[index - 1].atomId}-before-${sequence[index].atomId}`,
            `${entry.file} process order places ${sequence[index].atomId} at or before ${sequence[index - 1].atomId}`,
          );
        }
      }
      const contactPositions = (byAtom.get("atom.transfer.initiate-solid-reactant-contact") ?? [])
        .map((action) => positionOf(action.id))
        .filter((value) => value !== undefined);
      if (contactPositions.length > 0) {
        const firstContact = Math.min(...contactPositions);
        for (const atomId of CYCLE_11_BEFORE_CONTACT) {
          const positions = (byAtom.get(atomId) ?? [])
            .map((action) => positionOf(action.id))
            .filter((value) => value !== undefined);
          if (positions.length === 0) continue;
          if (Math.min(...positions) >= firstContact) {
            report(
              "cycle11/reactant-preparation-after-contact",
              `${entry.owner}/${atomId}`,
              `${entry.file} ${atomId} is not complete before the reaction starts`,
            );
          }
        }
      }
    }

    for (const weigh of byAtom.get("atom.weigh.solid-reactant-portion") ?? []) {
      // Settled by Cycle 08: weighing is an instrument read, not an insertion into an instrument.
      if (weigh.interaction?.type !== "readInstrument") {
        report(
          "cycle11/weigh-not-instrument-read",
          `${entry.owner}/${weigh.id}`,
          `${entry.file} interaction=${weigh.interaction?.type ?? "none"}`,
        );
      }
    }

    // The mass that reaches the reaction vessel and the mass the balance read are one quantity. Modern
    // content carries that continuity through the typed `mass` contract; legacy content may still
    // carry a literal massG pair. Validate both shapes without forcing migrated actions back onto a
    // stale parameter-only representation.
    for (const contact of byAtom.get("atom.transfer.initiate-solid-reactant-contact") ?? []) {
      const measurementId = contact.parameters?.massMeasurementId;
      if (!present(measurementId)) {
        report(
          "cycle11/reactant-mass-measurement-undeclared",
          `${entry.owner}/${contact.id}`,
          `${entry.file} names no massMeasurementId, so the transferred mass cites no balance reading`,
        );
        continue;
      }
      const weighed = actions.find(
        (candidate) =>
          candidate.atomId === "atom.weigh.solid-reactant-portion" &&
          (candidate.parameters?.measurementId === measurementId ||
            candidate.mass?.outputMeasurementId === measurementId),
      );
      if (!weighed) {
        report(
          "cycle11/reactant-mass-measurement-unmatched",
          `${entry.owner}/${contact.id}/${measurementId}`,
          `${entry.file} no atom.weigh.solid-reactant-portion action records that measurement`,
        );
        continue;
      }
      const typedContinuity =
        weighed.mass?.source === "action-input" &&
        weighed.mass.outputMeasurementId === measurementId &&
        contact.mass?.source === "measurement" &&
        contact.mass.referenceId === measurementId;
      if (typedContinuity) continue;
      const transferred = Number(contact.parameters?.massG);
      const expected = Number(weighed.parameters?.expectedMassG);
      if (!Number.isFinite(transferred) || !Number.isFinite(expected) || transferred !== expected) {
        report(
          "cycle11/reactant-mass-decoupled-from-balance",
          `${entry.owner}/${contact.id}`,
          `${entry.file} transfers ${contact.parameters?.massG} g against a balance reading of ${weighed.parameters?.expectedMassG} g`,
        );
      }
    }

    // Magnetism is non-destructive and melting is not, and in Investigation 6 both read one line's
    // portion. A magnet read taken after the sample was staged for melting reads a melted or
    // decomposed solid. The first pass of this cycle authored exactly that, and the review caught it.
    if (order.size > 0) {
      const magnetPositions = (byAtom.get("atom.observe.test-magnetic-response") ?? [])
        .map((candidate) => ({ id: candidate.id, at: positionOf(candidate.id) }))
        .filter((candidate) => candidate.at !== undefined);
      const stagePositions = (byAtom.get("atom.place.melting-point-sample") ?? [])
        .map((candidate) => ({
          vessel: candidate.parameters?.sourceInstanceId,
          at: positionOf(candidate.id),
        }))
        .filter((candidate) => candidate.at !== undefined);
      for (const magnet of magnetPositions) {
        const magnetAction = actions.find((candidate) => candidate.id === magnet.id);
        const vessel = magnetAction?.parameters?.sourceInstanceId;
        const staged = stagePositions.find(
          (candidate) => candidate.vessel === vessel && candidate.at < magnet.at,
        );
        if (staged) {
          report(
            "cycle11/magnet-read-after-melting-stage",
            `${entry.owner}/${magnet.id}`,
            `${entry.file} ${vessel} was staged for melting before this read`,
          );
        }
      }
    }

    for (const series of byAtom.get("atom.record.timed-gas-volume") ?? []) {
      if (series.interaction?.type !== "recordTimeSeries") {
        report(
          "cycle11/timed-series-not-time-series-interaction",
          `${entry.owner}/${series.id}`,
          `${entry.file} interaction=${series.interaction?.type ?? "none"}`,
        );
      }
      // A generated curve is admissible evidence only while it says so. Silence here is what let the
      // lab present a modelled series as if the student had read it off the barrel.
      if (series.parameters?.valueProvenance !== "simulator-generated") {
        report(
          "cycle11/timed-series-provenance-undeclared",
          `${entry.owner}/${series.id}`,
          `${entry.file} valueProvenance=${series.parameters?.valueProvenance ?? "absent"}`,
        );
      }
    }

    for (const action of actions) {
      // A derivation from a generated series has no honest expected value: storing one compares the
      // model against a copy of itself and turns a teacher reconfiguration into a silent failure.
      if (action.parameters?.template !== "initialRateMlPerS") continue;
      if (action.parameters?.expected !== undefined) {
        report(
          "cycle11/rate-calculation-stores-answer",
          `${entry.owner}/${action.id}`,
          `${entry.file} expected=${action.parameters.expected}`,
        );
      }
    }

    /* ---- Investigation 6: branch conditions, cleanup order, sample independence ---- */

    for (const action of actions) {
      if (!CYCLE_11_AQUEOUS_READS.has(action.atomId)) continue;
      // Section 9 branches to aqueous conductivity and pH only when an aqueous test solution exists.
      const requiresSolvent = cycle11PrerequisiteActionIds(action).some(
        (actionId) => atomOf.get(actionId) === "atom.transfer.apply-test-solvent",
      );
      if (!requiresSolvent) {
        report(
          "cycle11/aqueous-read-without-test-solution",
          `${entry.owner}/${action.id}`,
          `${entry.file} no actionEvidence prerequisite names an atom.transfer.apply-test-solvent action`,
        );
      }
    }

    for (const disposal of byAtom.get("atom.transfer.dispose-to-waste-stream") ?? []) {
      // K-05 records the result before cleanup. Once the mixture is in the waste beaker the
      // observation is unrecoverable, so the record has to be a hard prerequisite.
      const named = cycle11PrerequisiteActionIds(disposal);
      if (named.length === 0) {
        report(
          "cycle11/disposal-without-recorded-result",
          `${entry.owner}/${disposal.id}`,
          `${entry.file} no actionEvidence prerequisite names the record it must follow`,
        );
        continue;
      }
      if (order.size === 0) continue;
      const disposalPosition = positionOf(disposal.id);
      for (const actionId of named) {
        const recordPosition = positionOf(actionId);
        if (recordPosition === undefined || disposalPosition === undefined) continue;
        if (recordPosition >= disposalPosition) {
          report(
            "cycle11/disposal-precedes-record",
            `${entry.owner}/${disposal.id}`,
            `${entry.file} ${actionId} is not reached before the disposal step`,
          );
        }
      }
    }

    // Twelve blind vials and six test tubes share one bench. Cycle 08 found the same class of defect
    // as F-HW-13, where two samples shared a notebook tag and one satisfied the other's gate: here two
    // test lines sharing a vessel would mix two samples' evidence.
    const vesselOwners = new Map();
    for (const action of byAtom.get("atom.transfer.microsample-portion") ?? []) {
      const vessel = action.parameters?.targetInstanceId;
      if (!present(vessel)) continue;
      vesselOwners.set(vessel, [...(vesselOwners.get(vessel) ?? []), action.id]);
    }
    for (const [vessel, owners] of vesselOwners) {
      if (owners.length < 2) continue;
      report(
        "cycle11/test-vessel-shared-between-samples",
        `${entry.owner}/${vessel}`,
        `${entry.file} ${owners.sort().join(" | ")}`,
      );
    }

    // Definition-level targeting resolves to the first matching instance on the bench, which is how
    // Cycle 08's dry handler took the practice precipitate for an inquiry sample. Every
    // qualitative-analysis action names its instances outright.
    for (const action of actions) {
      if (!qualitativeAtoms.has(action.atomId)) continue;
      const needsTarget = REQUIRES_AUTHORED_TARGET.has(action.interaction?.type);
      if (!present(action.parameters?.sourceInstanceId) && !present(action.parameters?.equipmentInstanceId)) {
        report(
          "cycle11/sample-instance-unnamed",
          `${entry.owner}/${action.id}/source`,
          `${entry.file} names no sourceInstanceId, so the runtime takes the first matching instance`,
        );
      }
      if (needsTarget && !present(action.parameters?.targetInstanceId)) {
        report(
          "cycle11/sample-instance-unnamed",
          `${entry.owner}/${action.id}/target`,
          `${entry.file} names no targetInstanceId, so the runtime takes the first matching instance`,
        );
      }
    }
  }
};
// === CYCLE 11 RULES (END) ===

// === CYCLE 06 RULES (BEGIN) ===
/*
 * Investigation 1 (Blue #1 percent transmittance) and Investigation 11 (crystal-violet rate law).
 *
 * Keyed on atom ids and on declared parameters rather than on owner ids, so they hold for any owner
 * that adopts the spectrophotometry atoms — Cycle 07's brass work will inherit them.
 *
 * Each rule exists because the defect it describes was present in content every other rule in this
 * file accepted. Blue #1 read an instrument that had never been loaded and had no insert or remove
 * action anywhere in the corpus; the crystal-violet `record` actions carried the absorbance the
 * `read` was supposed to produce, so a student could file a reading without taking one; and the
 * three quantities `%T`, `T`, and absorbance were stored in the same shaped field with authored unit
 * strings that nothing checked.
 */

/** Mirrored from `PHOTOMETRIC_UNITS` in `src/runtime/calculations.ts`; verified below. */
const CYCLE_06_PHOTOMETRIC_UNITS = {
  percentTransmittance: "%T",
  decimalTransmittance: "T",
  absorbance: "absorbance",
};

const CYCLE_06_CALCULATIONS_PATH = "src/runtime/calculations.ts";

const CYCLE_06_READ_ATOM = "atom.observe.read-photometer";
const CYCLE_06_ZERO_ATOM = "atom.observe.blank-photometer";
const CYCLE_06_RECORD_ATOM = "atom.record.photometer-reading";
const CYCLE_06_INSERT_ATOM = "atom.place.insert-cuvette";
const CYCLE_06_REMOVE_ATOM = "atom.place.remove-cuvette";
// Mirrors the typed photometer dispatch in `src/runtime/reducer.ts`. Keep this
// finite list separate from the broad `readInstrument` interaction type: an
// arbitrary authored operation must still fail closed.
const CYCLE_06_PHOTOMETER_OPERATIONS = new Set(["darkZero", "zero", "read"]);
// The two calibration contracts the reducer branches on, by their exact strings. They are not
// interchangeable: `selected-wavelength-pair` is the manual's empty-compartment 0%T followed by a
// distilled-water 100%T at one approved wavelength, and `distilled-water-per-wavelength` is the
// prelab scan's per-wavelength water blank, which the reducer reaches only in `wavelength-scan`
// configuration mode and which clears any dark zero. A string outside this set reaches neither
// branch, so it must never be treated as a calibration contract.
const CYCLE_06_SELECTED_WAVELENGTH_CALIBRATION = "selected-wavelength-pair";
const CYCLE_06_GENERIC_SCAN_CALIBRATION = "distilled-water-per-wavelength";
const CYCLE_06_PHOTOMETER_CALIBRATION_METHODS = new Set([
  CYCLE_06_SELECTED_WAVELENGTH_CALIBRATION,
  CYCLE_06_GENERIC_SCAN_CALIBRATION,
]);
/** The reducer's own default when a photometric action names no instrument definition. */
const CYCLE_06_DEFAULT_PHOTOMETER_DEFINITION = "spectrophotometer";
/**
 * Reducer mode string used by the focused fixture that combines a scan configuration with another
 * selected-wavelength configuration. Its presence anywhere in an owner is not a static veto: runtime
 * configuration can change and calibration can be re-established before a later scan read. This is
 * not an enum this file imposes on content.
 */
const CYCLE_06_APPROVED_SELECTED_WAVELENGTH_MODE = "approved-selected-wavelength";

/**
 * Which instrument a photometric action resolves, as far as the JSON can say.
 *
 * Mirrors `findInstance(state, photometerInstanceId ?? request.targetInstanceId ??
 * params.targetInstanceId, photometerDefinitionId ?? "spectrophotometer")`. Two consequences of
 * that precedence matter here and are deliberately *not* smoothed over:
 *
 *   - An explicitly named instance is looked up by id alone; its definition is never checked. So an
 *     `instance:` key says which instance the reducer will find, and nothing about what kind of
 *     apparatus it is. This file must not start rejecting instances on their definition.
 *   - When no instance is named, the reducer falls back to the first instance of the definition.
 *     Two actions that both fall back on the same definition therefore resolve to the same
 *     instrument in any one state, which is why a `definition:` key may match a `definition:` key.
 *     They are still weaker than an explicit pair, because the middle term of the precedence is the
 *     runtime *request*, which no static reading can see.
 *
 * A `definition:` key never matches an `instance:` key: whether the named instance happens to be
 * the first of its definition is a property of the bench, not of the content.
 */
const cycle06PhotometerBinding = (action) => {
  const explicitInstanceId = cycle06Parameter(action, "photometerInstanceId") ??
    cycle06Parameter(action, "targetInstanceId");
  if (explicitInstanceId) return `instance:${explicitInstanceId}`;
  return `definition:${cycle06Parameter(action, "photometerDefinitionId") ?? CYCLE_06_DEFAULT_PHOTOMETER_DEFINITION}`;
};

/** One key per (resolved instrument, wavelength reference) pair. */
const cycle06InstrumentWavelengthKey = (action, wavelengthId) =>
  `${cycle06PhotometerBinding(action)}\u0000${wavelengthId}`;

/**
 * Templates whose operand is a decimal transmittance, and templates whose operand is a percent
 * transmittance. `A = -log10(T)` is that equation only for the decimal; handing it a percent returns
 * a negative absorbance that reads as a number rather than as an error.
 */
const CYCLE_06_DECIMAL_OPERAND_TEMPLATES = new Set(["absorbanceFromDecimalT"]);
const CYCLE_06_PERCENT_OPERAND_TEMPLATES = new Set([
  "decimalTransmittance",
  "absorbanceFromPercentT",
]);

const cycle06Parameter = (action, key) => {
  const value = action.parameters?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const cycle06PrerequisiteMeasurementIds = (action) =>
  new Set(
    (action.prerequisites ?? [])
      .filter((rule) => rule.type === "measurementRecorded" && present(rule.measurementId))
      .map((rule) => rule.measurementId),
  );

/**
 * The measurement ids an action actually writes, mirrored from `src/runtime/reducer.ts`.
 *
 * Six verbs write a measurement, and `observe` writes one only from its chromatography-ruler branch,
 * its photometric-read branch, or its configuration branch. Every other `observe` produces a
 * notebook entry alone — which is how three Cycle 06 configuration steps came to declare a
 * `measurementId`, a numeric `inputMode`, and a unit while storing nothing at all.
 */
const CYCLE_06_MEASUREMENT_WRITING_VERBS = new Set([
  "weigh",
  "measureVolume",
  "dilute",
  "developChromatogram",
  "record",
]);

/**
 * Every action an owner resolves: its own, plus the ones its `techniqueRefs` select.
 *
 * A bundled lab source declares only its lab-local actions, so an owner's own `actions` array is the
 * wrong population for any question about what the *lab* can do. Reading it alone made the first
 * version of `cycle06/photometer-wavelength-unproduced` report nine false positives — both labs
 * import the configuration step that writes the wavelength.
 */
const cycle06ResolvedActions = (entry, standaloneById) => {
  const actions = [...(entry.definition.actions ?? [])];
  for (const ref of entry.definition.techniqueRefs ?? []) {
    const technique = standaloneById.get(ref.techniqueId);
    if (!technique) continue;
    const selected =
      ref.actionIds === "all"
        ? technique.actions ?? []
        : (technique.actions ?? []).filter((action) => (ref.actionIds ?? []).includes(action.id));
    actions.push(...selected);
  }
  return actions;
};

const cycle06ProducedMeasurementId = (action) => {
  const measurementId = cycle06Parameter(action, "measurementId") ??
    (cycle06Parameter(action, "photometerOperation") === "read"
      ? action.runtimeRepeat?.outputMeasurementId
      : undefined);
  if (!measurementId) return undefined;
  if (CYCLE_06_MEASUREMENT_WRITING_VERBS.has(action.verb)) return measurementId;
  if (action.verb !== "observe") return undefined;
  return cycle06Parameter(action, "chromatographyMeasurementType") ||
    cycle06Parameter(action, "configurationQuantity") ||
    cycle06Parameter(action, "photometerOperation") === "read"
    ? measurementId
    : undefined;
};

const cycle06PhotometerReadMeasurementId = (action) =>
  cycle06Parameter(action, "measurementId") ??
  (cycle06Parameter(action, "photometerOperation") === "read"
    ? action.runtimeRepeat?.outputMeasurementId
    : undefined);

/**
 * Actions whose teacher-configuration marker must survive.
 *
 * Every one of these is an open confirmation point in its dated plan. A later cycle that quietly
 * fills one in would be deciding a teaching choice the source deliberately leaves to the classroom,
 * and nothing else in this file would notice.
 */
const CYCLE_06_CONFIRMATION_POINTS = [
  ["technique:blue1-standard-dilutions", "i1-record-stock-concentration"],
  ["technique:blue1-standard-dilutions", "i1-record-dilution-assignments"],
  ["technique:blue1-percent-transmittance", "i1-record-wavelength"],
  ["technique:blue1-percent-transmittance", "i1-record-blank-cuvette-rule"],
  ["technique:blue1-class-calibration", "i1-record-source-ambiguity"],
  ["technique:blue1-class-calibration", "i1-record-confirmed-calibration"],
  ["technique:blue1-percent-transmittance", "i1-record-molar-mass-reference"],
  ["technique:blue1-percent-transmittance", "i1-record-over-range-response"],
  ["technique:crystal-violet-spectrophotometer-calibration", "cv11-set-approved-wavelength"],
  ["technique:crystal-violet-spectrophotometer-calibration", "cv11-prepare-approved-blank"],
  ["technique:crystal-violet-waste-treatment", "cv11-neutralize-excess-base"],
  ["lab:crystal-violet-rate-law", "cv11-confirm-percent-completion-stop"],
];

/** Audit §17.4.1: the optional z/k extension stays an optional teacher-approved branch. */
const CYCLE_06_EXTENSION_ACTIONS = [
  "cv11-extension-approval-gate",
  "cv11-extension-design-hydroxide-series",
  "cv11-extension-determine-z-and-k",
];

const checkCycle06Photometry = (world, report) => {
  const standaloneById = standaloneTechniquesById(world);
  // The unit table is the whole point of separating the three quantities, so it is re-read from the
  // runtime rather than trusted. A drift here would let this file bless a mislabelled measurement.
  if (world.sourceVocabulary) {
    const source = readText(CYCLE_06_CALCULATIONS_PATH);
    for (const [quantity, unit] of Object.entries(CYCLE_06_PHOTOMETRIC_UNITS)) {
      const pattern = new RegExp(`${quantity}\\s*:\\s*"${unit.replace(/[%]/g, "\\$&")}"`);
      if (!pattern.test(source)) {
        report(
          "mirror/photometric-unit-drift",
          quantity,
          `${CYCLE_06_CALCULATIONS_PATH} does not map ${quantity} to "${unit}"`,
        );
      }
    }
  }

  for (const entry of world.owners) {
    if (!entry.runtimeExecuted) continue;
    const actions = entry.definition.actions ?? [];
    const byId = new Map(actions.map((action) => [action.id, action]));
    const producedMeasurementIds = new Set(
      cycle06ResolvedActions(entry, standaloneById)
        .map(cycle06ProducedMeasurementId)
        .filter((id) => present(id)),
    );
    // (resolved instrument, wavelength reference) pairs this owner blanks with the per-wavelength
    // distilled-water method. This is the only static shadow the scan's state gate casts: the
    // reducer keys calibration by the *resolved instrument* and refuses a scan read unless that
    // instrument is configured at that scan wavelength and blanked there in the same configuration
    // generation. The instrument is part of the key because a blank on instrument A says nothing
    // about a read on instrument B, even when both name the same wavelength measurement.
    //
    // Membership is a necessary condition for the notebook-tag exception below and never a proof:
    // it does not show that the blank is reachable on the authored route, that the generations
    // still match when the read runs, that the cuvette in the slot is the named one, or that the
    // wavelength measurement holds the same nanometre value at both events. The reducer compares
    // resolved nanometres; two measurement ids can carry the same value and one id can carry
    // different values at different times, so id equality is a structural proxy in both
    // directions, not a tighter test than the runtime's.
    const genericScanBlanks = new Set(
      cycle06ResolvedActions(entry, standaloneById)
        .filter((candidate) =>
          cycle06Parameter(candidate, "photometerOperation") === "zero" &&
          cycle06Parameter(candidate, "photometerCalibrationMethod") === CYCLE_06_GENERIC_SCAN_CALIBRATION &&
          present(cycle06Parameter(candidate, "wavelengthMeasurementId")))
        .map((candidate) =>
          cycle06InstrumentWavelengthKey(candidate, cycle06Parameter(candidate, "wavelengthMeasurementId"))),
    );
    // A selected-wavelength configuration elsewhere in this owner is not a static incompatibility:
    // runtime configuration can change the instrument's mode and calibration can be re-established
    // before a later scan read. This checker does not evaluate route order, reblanking or calibration
    // generations, so it must not infer a permanent denial from owner-wide action existence.
    const insertedInstances = new Map();
    const removedInstances = new Map();

    for (const action of actions) {
      const scope = `${entry.owner}/${action.id}`;
      const operation = cycle06Parameter(action, "photometerOperation");
      const quantity = cycle06Parameter(action, "photometricQuantity");

      if (quantity && !(quantity in CYCLE_06_PHOTOMETRIC_UNITS)) {
        report("cycle06/photometric-quantity-unknown", scope, `${entry.file} quantity=${quantity}`);
      }

      // A stored unit that disagrees with the declared quantity is a mislabelled measurement, and a
      // table of %T values filed as absorbances looks entirely plausible.
      //
      // The check applies where a photometric value is **stored**: a read, or the record that
      // consumes one. A configuration step names the mode it is setting up rather than a value it
      // holds, so it declares `photometricMode` and carries its own unit — the wavelength's `nm`.
      // The first version of this rule reached configuration steps through `photometricQuantity` and
      // needed a verb-and-operation exception to stay quiet, which is a rule shaped around its own
      // false positive.
      const unit = cycle06Parameter(action, "unit");
      const storesPhotometricValue =
        operation === "read" || action.atomId === CYCLE_06_RECORD_ATOM;
      if (quantity && quantity in CYCLE_06_PHOTOMETRIC_UNITS && unit && storesPhotometricValue) {
        const expected = CYCLE_06_PHOTOMETRIC_UNITS[quantity];
        if (unit !== expected) {
          report(
            "cycle06/photometric-unit-mismatch",
            scope,
            `${entry.file} quantity=${quantity} unit=${unit} expected=${expected}`,
          );
        }
      }
      const mode = cycle06Parameter(action, "photometricMode");
      if (mode && !(mode in CYCLE_06_PHOTOMETRIC_UNITS)) {
        report("cycle06/photometric-quantity-unknown", scope, `${entry.file} mode=${mode}`);
      }
      if (quantity && !storesPhotometricValue) {
        // `photometricQuantity` means "the quantity this action stores". An action that stores none
        // must say `photometricMode` instead, or the unit rule above silently stops covering it.
        report(
          "cycle06/photometric-quantity-on-non-storing-action",
          scope,
          `${entry.file} declares photometricQuantity but stores no reading; use photometricMode`,
        );
      }

      // Found by reviewing this cycle's own code. A configuration value is only real if the runtime
      // stores it: the generic `observe` path writes a notebook entry and no measurement, so an
      // action that declared `measurementId` and a numeric input produced nothing, and every gate
      // consuming it was unsatisfiable through every input path.
      const configurationQuantity = cycle06Parameter(action, "configurationQuantity");
      if (configurationQuantity) {
        for (const key of ["measurementId", "unit"]) {
          if (!cycle06Parameter(action, key)) {
            report("cycle06/configuration-measurement-unstored", `${scope}/${key}`, entry.file);
          }
        }
      }

      // An authored calibration method the reducer does not branch on is dead metadata that reads
      // like a contract. No other rule here looks at this field, so without this report a typo
      // would simply lose the read its exception below and say nothing about why.
      const calibrationMethod = cycle06Parameter(action, "photometerCalibrationMethod");
      if (calibrationMethod && !CYCLE_06_PHOTOMETER_CALIBRATION_METHODS.has(calibrationMethod)) {
        report(
          "cycle06/photometer-calibration-method-unknown",
          scope,
          `${entry.file} photometerCalibrationMethod=${calibrationMethod}`,
        );
      }

      if (operation === "read") {
        // The scan read is the one contract whose zero is state rather than a notebook tag: the
        // reducer's generic-scan read branch refuses it unless the *resolved instrument* is
        // configured at this scan wavelength and blanked there in the same configuration
        // generation. Read precisely, the reducer skips its `requiresZeroNotebookTag` test only
        // for `selected-wavelength-pair`: a generic-scan read that *declares* the tag still has it
        // enforced, wavelength-qualified, on top of the state gate. What the state gate removes is
        // the need to declare it at all -- requiring the declaration is requiring a second, weaker
        // copy of a gate the runtime already holds in state.
        //
        // The structural conditions this file can actually check, all of which must hold:
        //   - the exact supported method string (a typo is reported separately, above, and buys
        //     nothing here);
        //   - a named wavelength measurement (still required below in its own right);
        //   - a per-wavelength distilled-water blank in this owner on the *same resolved
        //     instrument binding* and the same wavelength reference.
        // Everything else a read must declare is still required, the wavelength must still be
        // produced by some action (`photometer-wavelength-unproduced`, below), and a
        // selected-wavelength read keeps its notebook-tag requirement unchanged.
        //
        // What stays outside static proof, and is therefore *not* claimed by granting this
        // exception: whether the blank is reachable on the authored route, whether the
        // configuration epoch and generation still match when the read runs, what the wavelength
        // measurement's value is at either event, which cuvette occupies the slot, and whether the
        // instrument is in `wavelength-scan` mode at that moment. The reducer decides all of those;
        // in particular, a missing mode does not initialize scan calibration, and another authored
        // configuration may change the mode before the read.
        //
        // When the binding cannot be matched -- a different instrument, or one side explicit and
        // the other relying on the definition fallback -- the exception is simply not granted and
        // the pre-existing `cycle06/photometer-read-ungated` requirement stands unchanged. That is
        // a statement about what this file can establish, not a finding that the runtime would
        // refuse the read.
        //
        // A selected-wavelength configuration elsewhere in this owner is intentionally not inspected
        // here. The runtime may transition modes and reblank; only a route/state evaluator could
        // decide whether a particular read is actually accepted. This structural checker does not
        // build one.
        const readWavelengthId = cycle06Parameter(action, "wavelengthMeasurementId");
        const readInstrumentWavelength = present(readWavelengthId)
          ? cycle06InstrumentWavelengthKey(action, readWavelengthId)
          : undefined;
        const stateGatedScanRead =
          calibrationMethod === CYCLE_06_GENERIC_SCAN_CALIBRATION &&
          readInstrumentWavelength !== undefined &&
          genericScanBlanks.has(readInstrumentWavelength);
        for (const key of [
          "photometricQuantity",
          "wavelengthMeasurementId",
          "requiresZeroNotebookTag",
          "cuvetteInstanceId",
          "measurementId",
        ]) {
          if (key === "requiresZeroNotebookTag" && stateGatedScanRead) continue;
          const value = key === "measurementId"
            ? cycle06PhotometerReadMeasurementId(action)
            : cycle06Parameter(action, key);
          if (!value) {
            report("cycle06/photometer-read-ungated", `${scope}/${key}`, entry.file);
          }
        }
      }
      if (operation === "zero") {
        for (const key of ["wavelengthMeasurementId", "cuvetteInstanceId"]) {
          if (!cycle06Parameter(action, key)) {
            report("cycle06/photometer-zero-ungated", `${scope}/${key}`, entry.file);
          }
        }
      }
      // The selected-wavelength protocol has a separate empty-compartment
      // dark-zero phase before the blank. The reducer accepts that typed
      // operation, but only at the currently configured wavelength; a generic
      // dark zero remains valid without this selected-wavelength contract.
      if (
        operation === "darkZero" &&
        cycle06Parameter(action, "photometerCalibrationMethod") === CYCLE_06_SELECTED_WAVELENGTH_CALIBRATION &&
        !cycle06Parameter(action, "wavelengthMeasurementId")
      ) {
        report("cycle06/photometer-dark-zero-ungated", `${scope}/wavelengthMeasurementId`, entry.file);
      }

      // The gate is only a gate if something can satisfy it. A wavelength id no action in this owner
      // writes makes every read and every zero unreachable, which is precisely the defect the first
      // version of this cycle shipped.
      const wavelengthId = cycle06Parameter(action, "wavelengthMeasurementId");
      if (wavelengthId && !producedMeasurementIds.has(wavelengthId)) {
        report(
          "cycle06/photometer-wavelength-unproduced",
          `${scope}/${wavelengthId}`,
          `${entry.file} no action in this owner stores ${wavelengthId}`,
        );
      }
      if (operation && !CYCLE_06_PHOTOMETER_OPERATIONS.has(operation)) {
        report("cycle06/photometer-operation-unknown", scope, `${entry.file} operation=${operation}`);
      }

      // A read declaring no operation cannot be gated by the runtime at all: the reducer's
      // photometric block is entered on `photometerOperation`.
      if (action.atomId === CYCLE_06_READ_ATOM && operation !== "read") {
        report("cycle06/photometer-read-ungated", `${scope}/photometerOperation`, entry.file);
      }
      if (action.atomId === CYCLE_06_ZERO_ATOM && operation !== "zero") {
        report("cycle06/photometer-zero-ungated", `${scope}/photometerOperation`, entry.file);
      }

      if (action.atomId === CYCLE_06_RECORD_ATOM) {
        // The record consumes the read's measurement. Carrying its own value is what let a student
        // write down an absorbance the instrument had never displayed.
        if (action.parameters?.value !== undefined) {
          report("cycle06/photometer-reading-prepopulated", scope, entry.file);
        }
        // A record has an output measurement id and, in the migrated photometry content, a distinct
        // sourceMeasurementId naming the read it consumes. The old check compared the prerequisite
        // with the output id and rejected every honest read -> record alias.
        const sourceMeasurementId = cycle06Parameter(action, "sourceMeasurementId") ??
          cycle06Parameter(action, "measurementId");
        if (!sourceMeasurementId || !cycle06PrerequisiteMeasurementIds(action).has(sourceMeasurementId)) {
          report("cycle06/photometer-record-without-read", scope, entry.file);
        }
      }

      if (action.verb === "calculate") {
        const template = cycle06Parameter(action, "template");
        const percentOperand = cycle06Parameter(action, "percentTransmittanceMeasurementId");
        const decimalOperand =
          cycle06Parameter(action, "decimalTransmittanceMeasurementId") ??
          cycle06Parameter(action, "decimalTransmittanceCalculationId");
        if (template && CYCLE_06_DECIMAL_OPERAND_TEMPLATES.has(template)) {
          if (!decimalOperand || percentOperand) {
            report(
              "cycle06/transmittance-operand-confused",
              scope,
              `${entry.file} ${template} needs a decimal-transmittance operand and no percent operand`,
            );
          }
        }
        if (template && CYCLE_06_PERCENT_OPERAND_TEMPLATES.has(template) && !percentOperand) {
          report(
            "cycle06/transmittance-operand-confused",
            scope,
            `${entry.file} ${template} needs a percentTransmittanceMeasurementId`,
          );
        }
      }

      if (action.atomId === CYCLE_06_INSERT_ATOM || action.atomId === CYCLE_06_REMOVE_ATOM) {
        const instanceId = cycle06Parameter(action, "equipmentInstanceId");
        if (!instanceId) {
          report("cycle06/cuvette-lifecycle-unnamed", scope, entry.file);
        } else {
          const target = action.atomId === CYCLE_06_INSERT_ATOM ? insertedInstances : removedInstances;
          target.set(instanceId, action.id);
        }
      }
    }

    // Leaving a cuvette in the sample compartment blocks the next sample, and the runtime now
    // refuses a read whose slot holds a different cuvette — so an unmatched insert is a dead end.
    for (const [instanceId, actionId] of insertedInstances) {
      if (!removedInstances.has(instanceId)) {
        report(
          "cycle06/cuvette-slot-unbalanced",
          `${entry.owner}/${instanceId}`,
          `${entry.file} inserted by ${actionId}, never removed`,
        );
      }
    }
    for (const [instanceId, actionId] of removedInstances) {
      if (!insertedInstances.has(instanceId)) {
        report(
          "cycle06/cuvette-slot-unbalanced",
          `${entry.owner}/${instanceId}`,
          `${entry.file} removed by ${actionId}, never inserted`,
        );
      }
    }

    for (const [owner, actionId] of CYCLE_06_CONFIRMATION_POINTS) {
      if (entry.owner !== owner) continue;
      const action = byId.get(actionId);
      if (!action) {
        report("cycle06/confirmation-point-action-missing", `${owner}/${actionId}`, entry.file);
        continue;
      }
      if (!cycle06Parameter(action, "unresolvedConfirmationPoint")) {
        report("cycle06/confirmation-point-resolved", `${owner}/${actionId}`, entry.file);
      }
    }

    // Audit §17.4.1. The three extension actions must stay declared and unreferenced: appending
    // their nodes to the root process would turn an optional, teacher-approved branch into required
    // student flow and pre-empt the crystal-violet source's z/k confirmation point.
    if (entry.owner === "lab:crystal-violet-rate-law") {
      const referenced = new Set(
        (entry.definition.process?.nodes ?? []).map((node) => node.actionId).filter(Boolean),
      );
      const declared = new Set([
        ...byId.keys(),
        ...(entry.definition.techniques ?? []).flatMap((technique) =>
          (technique.actions ?? []).map((action) => action.id)),
      ]);
      for (const actionId of CYCLE_06_EXTENSION_ACTIONS) {
        // The optional branch is deliberately carried by an embedded technique, not by the lab
        // root. Checking only the root action array made the valid carrier look undeclared.
        if (!declared.has(actionId)) {
          report("cycle06/hydroxide-extension-missing", actionId, entry.file);
        }
        if (referenced.has(actionId)) {
          report("cycle06/hydroxide-extension-promoted", actionId, entry.file);
        }
      }
      const carriers = (entry.definition.techniques ?? []).map((technique) => technique.id);
      if (!carriers.includes("crystal-violet-hydroxide-order-extension")) {
        report("cycle06/hydroxide-extension-carrier-missing", entry.owner, entry.file);
      }
    }
  }
};
// === CYCLE 06 RULES (END) ===

// === CYCLE 09 RULES (BEGIN) ===
/*
 * Investigations 4, 8, and 14 (titration).
 *
 * Keyed on atom ids and declared parameters rather than owner ids, so any owner that adopts the
 * titration atoms inherits them.
 *
 * Every rule below exists because the defect it names was present in content that every other rule
 * in this file accepted. `acid-base-titration` recorded an initial burette reading of 0.2 mL as an
 * authored constant and told the student in the node description exactly how many clicks the
 * endpoint takes; `hydrogen-peroxide-redox-titration` carried twenty-one burette readings as
 * authored constants and three calculation templates with no implementation, so each computed the
 * teacher's own expected value and passed; `redox-titration` and `titration-curve-analysis` poured
 * a fixed 18.4 mL and 24.8 mL of titrant as though delivery volume were a setting; and
 * `titration-curve-analysis` handed the student the equivalence volume its own analysis step asks
 * them to derive.
 */

const CYCLE_09_READ_BURETTE_ATOM = "atom.measure.read-burette";
const CYCLE_09_DELIVER_ATOM = "atom.transfer.deliver-titrant";
const CYCLE_09_PROBE_READ_ATOM = "atom.observe.read-titration-ph";

/** Parameters that would put a burette reading, or a delivered volume, into the content itself. */
const CYCLE_09_FORBIDDEN_DELIVERY_PARAMETERS = [
  "initialBuretteReadingMl",
  "finalBuretteReadingMl",
  "deliveredVolumeMl",
  "volumeMl",
];

/** Templates whose operands are burette readings the student took. */
const CYCLE_09_TITRATION_TEMPLATES = new Set([
  "acidBaseMolarity",
  "permanganateMolarityFromIron",
  "hydrogenPeroxidePercent",
]);

const cycle09MeasurementIdsWrittenBy = (actions) => {
  const written = new Set();
  for (const action of actions) {
    // A reading an instrument produced, or a final reading an accepted endpoint produced.
    if (action.atomId === CYCLE_09_READ_BURETTE_ATOM && present(action.parameters?.measurementId)) {
      written.add(action.parameters.measurementId);
    }
    if (action.interaction?.type === "dispenseDrops") {
      written.add(action.parameters?.finalBuretteMeasurementId ?? "burette-final-volume");
    }
    // A `record` that supplies its own value writes one too, which is exactly what the
    // authored-reading rule below is about; it is deliberately not counted here.
  }
  return written;
};

const checkCycle09Titration = (world, report) => {
  const titrationAtoms = new Set(
    (world.registries.atoms.atoms ?? [])
      .filter((atom) => atom.family === "titration")
      .map((atom) => atom.id),
  );

  for (const entry of world.owners) {
    if (!entry.runtimeExecuted) continue;
    const actions = entry.definition.actions ?? [];
    const usesTitration = actions.some(
      (action) =>
        titrationAtoms.has(action.atomId) ||
        action.interaction?.type === "dispenseDrops" ||
        CYCLE_09_TITRATION_TEMPLATES.has(action.parameters?.template),
    );
    if (!usesTitration) continue;

    const instrumentWritten = cycle09MeasurementIdsWrittenBy(actions);
    const actionById = new Map(actions.map((action) => [action.id, action]));

    for (const action of actions) {
      const scope = `${entry.owner}/${action.id}`;

      // 1. A burette reading a student is supposed to take may not be authored into the content.
      //    `record-initial-burette` carrying `value: 0.2` is the whole defect: the notebook then
      //    holds a number nobody read, and every calculation downstream consumes it.
      if (
        action.verb === "record" &&
        present(action.parameters?.measurementId) &&
        /burette|initial|final/i.test(String(action.parameters.measurementId)) &&
        action.parameters?.value !== undefined &&
        action.parameters?.teacherConfigured !== true
      ) {
        report(
          "cycle09/authored-burette-reading",
          scope,
          `${entry.file} ${action.parameters.measurementId}=${action.parameters.value}`,
        );
      }

      // 2. A delivery step may not carry the volume it is supposed to produce. The drop plan comes
      //    from the titration model; a literal here is a fabricated endpoint.
      if (action.atomId === CYCLE_09_DELIVER_ATOM || action.interaction?.type === "dispenseDrops") {
        for (const key of CYCLE_09_FORBIDDEN_DELIVERY_PARAMETERS) {
          if (action.parameters?.[key] !== undefined) {
            report("cycle09/authored-delivered-volume", `${scope}/${key}`, entry.file);
          }
        }
        if (!present(action.parameters?.titrationModelId)) {
          report("cycle09/delivery-without-model", scope, entry.file);
        }
        // 3. The delivered volume is the difference of two readings, so the first one has to exist
        //    as something an instrument produced rather than as something the content asserted.
        const initialId = action.parameters?.initialBuretteMeasurementId ?? "burette-initial-volume";
        if (!instrumentWritten.has(initialId)) {
          report("cycle09/initial-reading-not-instrument-derived", `${scope}/${initialId}`, entry.file);
        }
      }

      // 4. A titration calculation must name its operands and must not carry a stored answer in
      //    place of them. `expected` stays legal - it is the accepted value a tolerance is measured
      //    against - but a `value` is the student's, never the content's.
      if (CYCLE_09_TITRATION_TEMPLATES.has(action.parameters?.template)) {
        for (const key of ["initialBuretteMeasurementId", "finalBuretteMeasurementId"]) {
          if (!present(action.parameters?.[key])) {
            report("cycle09/calculation-operand-unnamed", `${scope}/${key}`, entry.file);
          }
        }
        if (action.parameters?.value !== undefined) {
          report("cycle09/calculation-carries-answer", scope, entry.file);
        }
      }

      // 5. A pH read may not report a pH. Nothing in the runtime models a titration curve, so a
      //    content-supplied pH is an invented measurement, not a reading.
      if (action.atomId === CYCLE_09_PROBE_READ_ATOM && action.parameters?.value !== undefined) {
        report("cycle09/authored-ph-reading", scope, entry.file);
      }

      // 6. Endpoint evidence must be per-trial. Cycle 08 found that shared notebook tags let one
      //    sample's observation satisfy another's gate; a lab with more than one dispense action
      //    that tags every endpoint `endpoint` has the same hole.
      if (
        action.verb === "observe" &&
        String(action.parameters?.tag ?? "") === "endpoint" &&
        actions.filter((candidate) => candidate.interaction?.type === "dispenseDrops").length > 1
      ) {
        report("cycle09/shared-endpoint-tag", scope, entry.file);
      }
    }

    // 7. A dispense must be gated on all three of the runtime's conditions through declared
    //    prerequisites, not only by process order: the reducer's gates are the last line of defence,
    //    and content that reaches them has already let the learner try.
    //
    //    The mount clause exists because Cycle 09's own self-review found it: adding the clamp gate
    //    to `executeDropDispense` made `redox-titration` and `titration-curve-analysis`
    //    *unfinishable*, because neither technique had a burette-mount action at all, and every
    //    other rule in this file — and the cycle's own verifier — accepted both. A gate added to a
    //    shared handler is a new obligation on every owner that reaches it.
    const closure = (actionId, seen = new Set()) => {
      if (seen.has(actionId)) return seen;
      seen.add(actionId);
      for (const rule of actionById.get(actionId)?.prerequisites ?? []) {
        if (rule.type === "actionEvidence" && present(rule.actionId)) closure(rule.actionId, seen);
      }
      return seen;
    };
    const CHARGING_ATOMS = new Set([
      "atom.transfer.measured-liquid",
      "atom.transfer.acidify-analyte",
      "atom.transfer.add-indicator",
    ]);
    for (const action of actions) {
      if (action.interaction?.type !== "dispenseDrops") continue;
      const scope = `${entry.owner}/${action.id}`;
      const initialId = action.parameters?.initialBuretteMeasurementId ?? "burette-initial-volume";
      const reachable = [...closure(action.id)].map((id) => actionById.get(id)).filter(Boolean);
      if (
        !(action.prerequisites ?? []).some(
          (rule) => rule.type === "measurementRecorded" && rule.measurementId === initialId,
        )
      ) {
        report("cycle09/dispense-ungated", `${scope}/initial-reading`, entry.file);
      }
      if (!reachable.some((candidate) => candidate.atomId === "atom.place.mount-burette")) {
        report("cycle09/dispense-ungated", `${scope}/mounted-burette`, entry.file);
      }
      if (!reachable.some((candidate) => CHARGING_ATOMS.has(candidate.atomId))) {
        report("cycle09/dispense-ungated", `${scope}/charged-receiver`, entry.file);
      }
    }

    // 7b. The same three conditions have to be *satisfiable* at all: a prerequisite can only be met
    //     by an action the owner actually publishes. This is the check that would have caught the
    //     self-review defect above on its own, independently of what any prerequisite claims.
    for (const action of actions) {
      if (action.interaction?.type !== "dispenseDrops") continue;
      if (!actions.some((candidate) => candidate.atomId === "atom.place.mount-burette")) {
        report("cycle09/dispense-unreachable", `${entry.owner}/${action.id}/no-mount-action`, entry.file);
      }
      if (!actions.some((candidate) => CHARGING_ATOMS.has(candidate.atomId))) {
        report("cycle09/dispense-unreachable", `${entry.owner}/${action.id}/no-charging-action`, entry.file);
      }
    }

    // 7c. A burette read must say which way its scale runs. The runtime defaults to the upward
    //     "how much is in it" reading, which is right for a cylinder and wrong for a burette by the
    //     full capacity of the instrument.
    for (const action of actions) {
      if (action.atomId !== CYCLE_09_READ_BURETTE_ATOM) continue;
      if (action.parameters?.scaleReadsDownward !== true) {
        report("cycle09/burette-read-scale-undeclared", `${entry.owner}/${action.id}`, entry.file);
      }
    }

    // 8. A learner-facing string may not spell out the endpoint. The acid-base node description used
    //    to say "click the stopcock 496 times to add 24.80 mL", which is the answer to the
    //    measurement the lab exists to teach.
    for (const node of entry.definition.process?.nodes ?? []) {
      const action = node.actionId ? actionById.get(node.actionId) : undefined;
      if (!action || action.interaction?.type !== "dispenseDrops") continue;
      const prose = `${node.title ?? ""} ${node.description ?? ""} ${node.hints?.join(" ") ?? ""}`;
      if (/\b\d{2,}\s*(times|drops|clicks)\b/i.test(prose) || /\b\d+\.\d+\s*mL\b/.test(prose)) {
        report("cycle09/endpoint-disclosed-in-prose", `${entry.owner}/${node.id}`, entry.file);
      }
    }
  }

  // 9. The Erlenmeyer/beaker receiver exception is a documented decision, not an accident. If the
  //    documentation disappears, the two vessels become interchangeable again silently.
  const analyteReceiver = (world.registries.roles.roles ?? []).find(
    (role) => role.id === "analyte-receiver",
  );
  if (analyteReceiver && !analyteReceiver.receiverSelection) {
    report("cycle09/receiver-exception-undocumented", "analyte-receiver", ROLE_REGISTRY_PATH);
  }
};
// === CYCLE 09 RULES (END) ===

// === CYCLE 10 RULES (BEGIN) ===
/**
 * Investigation 5 and Investigation 9 failed the same test in the same way: a result was available
 * before the evidence it is computed from. `developChromatogram` wrote the solvent-front and every
 * band distance into `state.measurements` itself, under exactly the ids the record steps name and the
 * Rf calculation consumes, so Rf was available the instant the strip developed. Investigation 9's
 * four composition calculations carried no template at all, so each fell through to
 * `Number(action.value ?? params.expected ?? 0)`, computed 0, compared it against an expected 0 with
 * the default 0.5 tolerance, and passed. Nothing static saw either.
 *
 * The reducer-reading rule below is skipped for the self-fixture worlds, whose owners are all `fx-*`:
 * it reads the real `src/runtime/reducer.ts`, which a fixture cannot mutate. It was tamper-tested
 * against the real file instead, which is the method Cycle 08 used for `mirror/runtime-assigned-state-*`.
 */
const CYCLE_10_REDUCER_PATH = "src/runtime/reducer.ts";

/**
 * Comments are stripped before anything is searched for.
 *
 * The first draft of these rules searched the raw source, and all three survived a tamper test that
 * replaced the actual read with a constant: the explanatory comment above each read still contained
 * the parameter name, so `includes` kept returning true. A rule that a comment can satisfy is not
 * enforcement. Strings are preserved, because the parameter names being looked for live inside them.
 */
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => {
      let inString = null;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (inString) {
          if (character === "\\") index += 1;
          else if (character === inString) inString = null;
          continue;
        }
        if (character === '"' || character === "'" || character === "`") {
          inString = character;
          continue;
        }
        if (character === "/" && line[index + 1] === "/") return line.slice(0, index);
      }
      return line;
    })
    .join("\n");

const cycle10HandlerBody = (source, verb) => {
  const marker = `action.verb === "${verb}"`;
  const start = source.indexOf(marker);
  if (start < 0) return undefined;
  const from = source.indexOf("{", start);
  if (from < 0) return undefined;
  let depth = 0;
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(from, index + 1);
    }
  }
  return undefined;
};

const isCycle10RepositoryWorld = (world) =>
  world.owners.some((entry) => entry.owner === "technique:paper-chromatography");

const checkChromatographyEvidenceGates = (world, report) => {
  if (!isCycle10RepositoryWorld(world) || !existsSync(join(root, CYCLE_10_REDUCER_PATH))) return;
  const source = stripComments(readText(CYCLE_10_REDUCER_PATH));

  const develop = cycle10HandlerBody(source, "developChromatogram");
  if (!develop) {
    report("cycle10/develop-handler-missing", "developChromatogram", CYCLE_10_REDUCER_PATH);
  } else if (!develop.includes("params.recordMeasurementsOnDevelop")) {
    report(
      "cycle10/develop-writes-measurements-unconditionally",
      "developChromatogram",
      `${CYCLE_10_REDUCER_PATH} does not read params.recordMeasurementsOnDevelop`,
    );
  }

  const rfIndex = source.indexOf('template === "chromatographyRf"');
  if (rfIndex < 0 || !source.slice(rfIndex).includes('booleanSetting(params, "requireRecordedMeasurements")')) {
    report(
      "cycle10/rf-falls-back-to-model",
      "chromatographyRf",
      `${CYCLE_10_REDUCER_PATH} computes Rf without reading requireRecordedMeasurements`,
    );
  }

  const observe = cycle10HandlerBody(source, "observe");
  if (observe && !observe.includes('stringSetting(params, "chromatographyMeasurementType")')) {
    report(
      "cycle10/no-ruler-reading-path",
      "chromatographyMeasurementType",
      `${CYCLE_10_REDUCER_PATH} has no student ruler-reading path`,
    );
  }

  const precipitate = cycle10HandlerBody(source, "precipitate");
  // Match the spread, not the name: the first draft looked for `remainingSolutes` and survived a
  // tamper that removed the spread but left the declaration standing, so the rule was inert.
  if (!precipitate || !precipitate.includes("...remainingSolutes")) {
    // Replacing the whole solute list wipes the components a multistage separation has not recovered
    // yet, so the next stage finds nothing and the investigation cannot be completed. Reverting this
    // is invisible in the content, which is why the rule reads the handler.
    report(
      "cycle10/precipitate-discards-other-components",
      "precipitate",
      `${CYCLE_10_REDUCER_PATH} replaces the solute list instead of consuming only the named solute`,
    );
  }

  const spot = cycle10HandlerBody(source, "spotSample");
  if (spot && !spot.includes('booleanSetting(params, "requiresDrying")')) {
    // Without this the spot is dry the instant it is applied, so TR-05's drying step and the
    // develop-time dry-spot gate both become unreachable.
    report(
      "cycle10/spot-dries-instantly",
      "spotSample",
      `${CYCLE_10_REDUCER_PATH} does not read requiresDrying`,
    );
  }
};

/** Pure-component names Investigation 9 issues as standards. A recovered fraction is not one of them. */
const CYCLE_10_PURE_COMPONENT_NAMES = ["aspirin", "acetaminophen", "sucrose"];

const checkSeparationEvidenceProvenance = (world, report) => {
  for (const entry of world.owners) {
    for (const action of entry.definition.actions ?? []) {
      const scope = `${entry.owner}/${action.id}`;
      const params = action.parameters ?? {};

      if (params.template === "chromatographyRf") {
        if (params.requireRecordedMeasurements !== true) {
          report("cycle10/rf-without-recorded-measurement-gate", scope, entry.file);
        }
        for (const key of ["solventFrontMm", "bandDistanceMm", "expected"]) {
          if (params[key] !== undefined) {
            report("cycle10/rf-carries-authored-distance", `${scope}/${key}`, entry.file);
          }
        }
      }

      // TR-12/TR-13 and TR-14/TR-15 are two actions each in the source: one reads the ruler, one
      // writes the number down. A `record` step that names its reading step must have one.
      if (action.verb === "record" && present(params.measurementId) && present(params.readActionId)) {
        const producer = (entry.definition.actions ?? []).find(
          (candidate) =>
            candidate.id === params.readActionId &&
            candidate.parameters?.measurementId === params.measurementId,
        );
        if (!producer) {
          report(
            "cycle10/recorded-distance-has-no-reading",
            scope,
            `${entry.file} readActionId=${params.readActionId}`,
          );
        }
      }

      if (action.verb === "developChromatogram") {
        for (const key of ["requireDrySpot", "trackWetState", "recordMeasurementsOnDevelop"]) {
          if (params[key] === undefined) {
            report("cycle10/development-chronology-undeclared", `${scope}/${key}`, entry.file);
          }
        }
      }

      if (action.verb === "precipitate" && params.precipitateSubstance !== undefined) {
        if (params.precipitateSoluteSourceId === undefined) {
          report("cycle10/recovered-mass-is-a-literal", scope, entry.file);
        }
        const substance = String(params.precipitateSubstance).toLowerCase();
        for (const name of CYCLE_10_PURE_COMPONENT_NAMES) {
          if (substance.includes(name)) {
            report(
              "cycle10/recovered-fraction-named-after-expected-component",
              `${scope}/${name}`,
              entry.file,
            );
          }
        }
      }

      // Finding 3.7: the manual's own sentence describes total recovery while the task asks for
      // composition. Neither reading may be assumed, and neither may carry a stored answer.
      if (params.template === "componentMassPercent" || params.template === "totalPercentRecovery") {
        if (params.compositionFormulaConfirmation === undefined) {
          report("cycle10/composition-formula-unconfirmed", scope, entry.file);
        }
        if (params.expected !== undefined) {
          report("cycle10/composition-carries-answer-key", scope, entry.file);
        }
        if (params.startingMassMeasurementId === undefined) {
          report("cycle10/composition-without-starting-mass", scope, entry.file);
        }
      }
    }
  }
};
// === CYCLE 10 RULES (END) ===

const RULES = [
  checkVocabularyMirrors,
  checkRegistryIntegrity,
  checkActions,
  checkActionIdCollisions,
  checkSourceTrace,
  checkVisualStates,
  checkAssets,
  checkAliases,
  checkComposites,
  checkTechniqueRefs,
  checkCycle11Protocols,
  checkCycle06Photometry,
  checkCycle09Titration,
  checkChromatographyEvidenceGates,
  checkSeparationEvidenceProvenance,
];

const runRules = (world) => {
  const { violations, report } = makeReporter();
  for (const rule of RULES) rule(world, report);
  return violations.sort((a, b) => a.id.localeCompare(b.id));
};

/* ------------------------------------------------------------------ *
 * World construction: shared derived indexes.
 * ------------------------------------------------------------------ */

const finalizeWorld = (world) => {
  world.actionIndex = new Map();
  for (const entry of world.owners) {
    for (const action of entry.definition.actions ?? []) {
      world.actionIndex.set(`${entry.owner}#${action.id}`, action);
    }
  }
  const groupedTraces = (world.registries.sourceTrace.traceGroups ?? []).flatMap((group) =>
    (group.actionIds ?? []).map((actionId) => [
      `${group.ownerType}:${group.ownerId}#${actionId}`,
      {
        ownerType: group.ownerType,
        ownerId: group.ownerId,
        actionId,
        atomId: group.atomId,
        sourceFile: group.sourceFile,
        sourceTable: group.sourceTable,
        step: group.step,
        basis: group.basis,
        traceDisposition: group.traceDisposition,
        sourceBasis: group.sourceBasis,
        actionBasis: group.actionBasis,
        mappingRationale: group.mappingRationale,
        traceGroupId: group.id,
      },
    ]),
  );
  world.sourceTraceIndex = new Map([
    ...world.registries.sourceTrace.traces.map((trace) => [
      `${trace.ownerType}:${trace.ownerId}#${trace.actionId}`,
      trace,
    ]),
    ...groupedTraces,
  ]);
  world.nonSourceDerivedOwners = new Set(
    world.registries.sourceTrace.nonSourceDerivedOwners.map((entry) => entry.owner),
  );
  return world;
};

const emptyWorld = () =>
  finalizeWorld({
    owners: [],
    equipment: new Map(),
    realisticAssetById: new Map(),
    snapZoneIds: new Set(),
    snapZoneAccepts: new Map(),
    paletteModules: [],
    runtimeAssignedVisualStates: [],
    stateAssetsByEquipment: new Map(),
    assetFiles: new Set(),
    assetWrappers: new Map(),
    assetDirectoryEntries: new Set(),
    reachability: new Map(),
    compositeLeaks: new Map(),
    compositeEvaluatorConsumers: new Map(),
    compositeOverlayIds: new Set(),
    compositeEvaluatorPresent: true,
    srcTraceReferences: [],
    publicTraceLeaks: [],
    sourceVocabulary: null,
    authoredVisualStates: new Map(),
    sourceFiles: new Set(),
    registries: {
      atoms: { atoms: [] },
      roles: { kindCategoryConstraints: {}, roles: [] },
      visualStates: { states: [], fallbacks: {} },
      composites: { rendererPrecedence: [], participantRoleKinds: [], composites: [] },
      assets: { assets: [] },
      aliases: { aliases: [] },
      sourceTrace: { sourceDerivedOwners: [], nonSourceDerivedOwners: [], traces: [] },
    },
  });

/* ------------------------------------------------------------------ *
 * Repository world.
 * ------------------------------------------------------------------ */

const isDefinitionShape = (value, folder) =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.id === "string" &&
      value.process &&
      Array.isArray(value.actions) &&
      (folder === "labs" ? Array.isArray(value.techniques) : true),
  );

const collectOwners = () => {
  const owners = [];
  for (const file of listFiles("public/labs")) {
    if (file === "index.json" || !file.endsWith(".json")) continue;
    const lab = readJson(`public/labs/${file}`);
    if (!isDefinitionShape(lab, "labs")) continue;
    owners.push({
      owner: `lab:${lab.id}`,
      scope: "labRoot",
      file: `public/labs/${file}`,
      runtimeExecuted: true,
      definition: lab,
    });
    for (const technique of lab.techniques) {
      owners.push({
        owner: `lab:${lab.id}/technique:${technique.id}`,
        scope: "labEmbeddedTechnique",
        file: `public/labs/${file}`,
        runtimeExecuted: false,
        definition: technique,
      });
    }
  }
  for (const file of listFiles("public/techniques")) {
    if (file === "index.json" || !file.endsWith(".json")) continue;
    const technique = readJson(`public/techniques/${file}`);
    if (!isDefinitionShape(technique, "techniques")) continue;
    owners.push({
      owner: `technique:${technique.id}`,
      scope: "standaloneTechnique",
      file: `public/techniques/${file}`,
      runtimeExecuted: true,
      definition: technique,
    });
  }
  return owners;
};

/* ------------------------------------------------------------------ *
 * Source vocabulary, re-read so `checkVocabularyMirrors` can prove the mirrors above still match.
 * These parsers handle the exact shapes the declarations use today. If a declaration is rewritten
 * into a shape they cannot read, the parsed set comes back different and the mirror rule fires —
 * a false alarm that forces a human to look, never a silent pass.
 * ------------------------------------------------------------------ */

const quotedStrings = (block) => [...block.matchAll(/"([A-Za-z0-9_.-]+)"/g)].map((match) => match[1]);

/** Slices a flat `export const NAME ... = [ "a", "b" ]`, skipping any `[]` in the type annotation. */
const parseStringArrayDeclaration = (source, declaration) => {
  const start = source.indexOf(declaration);
  if (start === -1) return new Set();
  const arrayStart = source.indexOf("[", source.indexOf("=", start));
  const arrayEnd = source.indexOf("]", arrayStart);
  if (arrayStart === -1 || arrayEnd === -1) return new Set();
  return new Set(quotedStrings(source.slice(arrayStart, arrayEnd)));
};

const parseCompatibleInteractionVerbs = (source) => {
  const start = source.indexOf("export const compatibleInteractionVerbs");
  if (start === -1) return {};
  const block = source.slice(source.indexOf("{", start), source.indexOf("\n};", start));
  const parsed = {};
  for (const match of block.matchAll(/^\s{2}([A-Za-z]+):\s*\[([^\]]*)\]/gm)) {
    parsed[match[1]] = quotedStrings(match[2]);
  }
  return parsed;
};

/**
 * The interaction types one of the runtime's operand predicates requires *unconditionally*. A
 * disjunct guarded by `&&` is dropped, because the checker must never be stricter than the runtime:
 * `requiresTarget`'s `readInstrument` clause only applies when a target is already authored, so it
 * can never be an operand gap.
 */
const parseOperandPredicate = (source, declaration) => {
  const start = source.indexOf(declaration);
  if (start === -1) return new Set();
  const bodyEnd = source.indexOf("\nconst ", start + declaration.length);
  const body = source.slice(start, bodyEnd === -1 ? undefined : bodyEnd);
  const types = new Set();
  for (const disjunct of body.split("||")) {
    if (disjunct.includes("&&")) continue;
    const match = disjunct.match(/interaction\.type === "([A-Za-z]+)"/);
    if (match) types.add(match[1]);
  }
  return types;
};

const parseSourceVocabulary = () => {
  const validation = readText("src/domain/validation.ts");
  const interactions = readText("src/domain/interactions.ts");
  const intents = readText("src/runtime/interactionIntents.ts");
  return {
    actionVerbs: parseStringArrayDeclaration(validation, "export const actionVerbs"),
    actionEquipmentParameterKeys: parseStringArrayDeclaration(
      validation,
      "export const actionEquipmentParameterKeys",
    ),
    actionModelParameterKeys: parseStringArrayDeclaration(
      validation,
      "export const actionModelParameterKeys",
    ),
    interactionOperationTypes: parseStringArrayDeclaration(
      interactions,
      "export const interactionOperationTypes",
    ),
    compatibleInteractionVerbs: parseCompatibleInteractionVerbs(interactions),
    requiresSource: parseOperandPredicate(intents, "const requiresSource"),
    requiresTarget: parseOperandPredicate(intents, "const requiresTarget"),
  };
};

const parseEquipmentCatalog = () => {
  const source = readText("src/equipment/catalog.ts");
  const catalogBlock = source.slice(
    source.indexOf("export const v1EquipmentCatalog"),
    source.indexOf("export const equipmentById"),
  );
  const equipment = new Map();
  for (const match of catalogBlock.matchAll(
    /equipment\(\s*"([a-z0-9-]+)",\s*"([^"]+)",\s*"([a-z]+)"/g,
  )) {
    equipment.set(match[1], { id: match[1], label: match[2], category: match[3] });
  }
  const mapBlock = source.slice(
    source.indexOf("const realisticAssetById"),
    source.indexOf("export const publicAssetPath"),
  );
  const realisticAssetById = new Map(
    [...mapBlock.matchAll(/"([a-z0-9-]+)":\s*"([a-z0-9-]*)"/g)].map((match) => [match[1], match[2]]),
  );
  // `catalog.ts` appends the three explicit 1 L stock variants after the literal catalog block.
  // They are real runtime definitions, not aliases that the source checker may ignore. Mirror that
  // small derived loop here so role bindings and image aliases resolve exactly as they do in the
  // player.
  const stockBottleVariants = readJson("src/equipment/stockBottleVariants.json");
  for (const [id, baseId] of Object.entries(stockBottleVariants)) {
    const base = equipment.get(baseId);
    if (!base) continue;
    equipment.set(id, { ...base, id, label: `${base.label} (1 L)` });
    realisticAssetById.set(id, realisticAssetById.get(baseId) ?? baseId);
  }
  // Snap zones are the only `{ id, label, ... }` literals in the catalog block; requiring the
  // following `label:` keeps the match from widening if the catalog ever gains another `id:` field.
  const snapZoneIds = new Set(
    [...catalogBlock.matchAll(/\{\s*id:\s*"([a-z0-9-]+)",\s*\n?\s*label:/g)].map((match) => match[1]),
  );
  // `zone(id, owner, [accepts], relation)` in interactionZones.ts is the authority a composite
  // participant's snap zone is checked against, so the owner and accept list are parsed too.
  const snapZoneAccepts = new Map();
  for (const match of readText("src/domain/interactionZones.ts").matchAll(
    /zone\(\s*\n?\s*"([a-z0-9-]+)",\s*\n?\s*"([a-z0-9-]+)",\s*\n?\s*\[([^\]]*)\]/g,
  )) {
    snapZoneIds.add(match[1]);
    snapZoneAccepts.set(match[1], {
      owner: match[2],
      accepts: [...match[3].matchAll(/"([a-z0-9-]+)"/g)].map((accept) => accept[1]),
    });
  }
  return { equipment, realisticAssetById, snapZoneIds, snapZoneAccepts };
};

/**
 * Cycle 05 moved the palette into the visual-state registry, so the palette keys are now registry
 * data rather than a TypeScript literal to mirror. What remains to verify is the inversion itself:
 * `styles.ts` must build its table from the registry and hold no colour of its own.
 */
const PALETTE_MODULES = [
  {
    file: "src/equipment/liquidRendering/styles.ts",
    reader: "liquidStylesByState",
    // The precedence Cycle 05 inverted, as a source-order fact: the resolver must consult the
    // authored state before either fallback table. Without this the two heuristics could quietly
    // move back above the authored state and only a rendered screenshot would notice.
    authoredMarker: "authoritativeLiquidState(contents.visualState)",
    fallbackMarkers: ["definitionIdStates", "reagentKeywordStates", "normalizeReagentKey(`"],
  },
  { file: "src/equipment/solidRendering.ts", reader: "solidStylesByState" },
  // A composite overlay draws a physical state — the filter cake — so it is a palette consumer too.
  // Before this rule it carried its own literal for a state the registry already owns as
  // `filter-cake`, which is F-07 growing back in a file Cycle 05 created.
  { file: "src/player/equipmentOverlays.tsx", reader: "resolveSolidStyle" },
];

const parsePaletteOwnership = () =>
  PALETTE_MODULES.map(({ file, reader, authoredMarker, fallbackMarkers }) => {
    const source = readText(file);
    const resolverAt = source.indexOf("export const resolveLiquidStyle");
    const resolver = resolverAt >= 0 ? source.slice(resolverAt) : "";
    const authoredAt = authoredMarker ? resolver.indexOf(authoredMarker) : -1;
    const fallbackAt = (fallbackMarkers ?? [])
      .map((marker) => resolver.indexOf(marker))
      .filter((index) => index >= 0);
    return {
      file,
      reader,
      derivesFromRegistry: source.includes(reader),
      literalColours: [...source.matchAll(/rgba?\(\s*\d/g)].map((match) => match[0]).length,
      // `null` where the module has no precedence to assert; otherwise true only when the authored
      // state is read, at least one fallback is read, and the authored read comes first.
      authoredBeforeFallbacks: authoredMarker
        ? authoredAt >= 0 && fallbackAt.length > 0 && authoredAt < Math.min(...fallbackAt)
        : null,
    };
  });

/**
 * Files whose reducers may write `contents.visualState` directly.
 *
 * Kept as a list rather than a glob so that a *new* file gaining that power is a deliberate edit
 * here, not something the parser silently starts or stops covering.
 */
const RUNTIME_STATE_ASSIGNERS = ["src/runtime/reducer.ts"];

/**
 * Visual states the runtime assigns on its own.
 *
 * Reads each `visualState:` assignment expression with brace/paren balancing, so it sees every shape
 * the reducer uses — a bare literal, a ternary, and an authored-first `?? "default"` chain across
 * several lines — and stops at the end of that one property rather than at a fixed line count.
 * `stringSetting(params, "visualState")` reads are removed first: the literal there names an action
 * parameter, not a state, and counting it would report a state called `visualState`.
 */
const collectRuntimeAssignedVisualStates = () => {
  const assigned = [];
  const seen = new Set();
  for (const file of RUNTIME_STATE_ASSIGNERS) {
    const source = readText(file);
    const marker = /visualState:/g;
    let match;
    while ((match = marker.exec(source))) {
      let depth = 0;
      let end = match.index + match[0].length;
      for (; end < source.length; end += 1) {
        const character = source[end];
        if ("([{".includes(character)) depth += 1;
        else if (")]}".includes(character)) {
          if (depth === 0) break;
          depth -= 1;
        } else if (character === "," && depth === 0) break;
      }
      const raw = source.slice(match.index + match[0].length, end);
      // Whether an authored value can win at this site. The registry states this per entry as
      // `runtimeAssignment`, and a claim nothing reads is not a contract — Cycle 08 removed two of
      // these override chains as unused and silently falsified four registry entries, because the
      // rules above only check that the *default literal* is registered.
      const overridable = /stringSetting\(\s*params\s*,\s*"[A-Za-z]+"\s*\)/.test(raw);
      const expression = raw.replace(/stringSetting\(\s*params\s*,\s*"[A-Za-z]+"\s*\)/g, "");
      for (const literal of expression.matchAll(/"([a-z][a-z0-9]*(?:-[a-z0-9]+)*)"/g)) {
        const key = `${file}#${literal[1]}`;
        if (seen.has(key)) {
          if (overridable) {
            const existing = assigned.find(
              (entry) => entry.file === file && entry.state === literal[1],
            );
            if (existing) existing.overridable = true;
          }
          continue;
        }
        seen.add(key);
        assigned.push({ state: literal[1], file, overridable });
      }
    }
    // A state can also reach `visualState:` through a helper, where the assignment site holds a call
    // rather than a literal. `titrationVisualState` is the one that does this today, and without
    // this pass its three states would be registered on trust instead of on evidence.
    for (const helper of source.matchAll(/const\s+\w*VisualState\s*=\s*\([^)]*\)[^{]*\{/g)) {
      let depth = 1;
      let end = helper.index + helper[0].length;
      for (; end < source.length && depth > 0; end += 1) {
        if (source[end] === "{") depth += 1;
        else if (source[end] === "}") depth -= 1;
      }
      for (const literal of source
        .slice(helper.index, end)
        .matchAll(/return\s+"([a-z][a-z0-9]*(?:-[a-z0-9]+)*)"/g)) {
        const key = `${file}#${literal[1]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        assigned.push({ state: literal[1], file, overridable: false });
      }
    }
  }
  return assigned;
};

const parseStateAssets = () => {
  const source = readText("src/equipment/visualCatalog.ts");
  const states = new Map();
  const generated = source.match(
    /handWarmerCalorimeterStateAssets = Object\.fromEntries\(\s*Array\.from\(\{ length: (\d+) \}/,
  );
  if (generated) {
    states.set(
      "hand-warmer-calorimeter",
      Array.from({ length: Number(generated[1]) }, (_, index) => `CAL-${String(index).padStart(2, "0")}`),
    );
  }
  // Until Cycle 11 the only `stateAssets` in the catalog were the generated calorimeter series, so
  // this parser recognised nothing else and a hand-written map was invisible to
  // `visual-state/state-asset-missing`. The scan below reads an inline `stateAssets: { ... }` object
  // literal and the definition id of the `profile(` call that owns it. It is additive: the generated
  // branch above is untouched, and no profile other than the calorimeter's used the field before.
  for (const match of source.matchAll(/stateAssets:\s*\{([^}]*)\}/g)) {
    const stateIds = [...match[1].matchAll(/["']([^"']+)["']\s*:/g)].map((entry) => entry[1]);
    if (stateIds.length === 0) continue;
    const preceding = source.slice(0, match.index);
    const owner = [...preceding.matchAll(/profile\(\s*\n?\s*["']([^"']+)["']/g)].at(-1)?.[1];
    if (!owner) continue;
    states.set(owner, [...new Set([...(states.get(owner) ?? []), ...stateIds])]);
  }
  return states;
};

/**
 * Asset base names named by an inline `stateAssets` map, as `asset("<base-name>")`. The generated
 * calorimeter series has no literal in the file at all, which is why `buildReachability` derives its
 * names from the state ids; a hand-written map does carry them, and this is where they come from.
 * Kept separate from `collectAssetReferences`, which matches names that carry a file extension and is
 * shared by three unrelated files.
 */
const parseInlineStateAssetNames = () => {
  const source = readText("src/equipment/visualCatalog.ts");
  const names = new Set();
  for (const match of source.matchAll(/stateAssets:\s*\{([^}]*)\}/g)) {
    for (const entry of match[1].matchAll(/(?:asset|realisticAsset)\(\s*["']([A-Za-z0-9._-]+)["']\s*\)/g)) {
      names.add(entry[1]);
    }
  }
  return names;
};

/** Assets declared by a presentation-only accessory contract, never a runtime visual state. */
const parseProbePresentationAssetNames = () => {
  const source = readText("src/equipment/visualCatalog.ts");
  const names = new Set();
  for (const match of source.matchAll(/probePresentation:\s*\{([\s\S]*?)\n\s*\},/g)) {
    for (const asset of match[1].matchAll(/equipment-realistic\/v1\/([A-Za-z0-9._-]+)\.svg/g)) {
      names.add(asset[1]);
    }
  }
  return names;
};

const isVisualStateKey = (key) => /[Vv]isualState$/.test(key);

const collectAuthoredVisualStates = (owners) => {
  const states = new Map();
  const record = (state, owner) => {
    if (typeof state !== "string" || !state) return;
    if (!states.has(state)) states.set(state, new Set());
    states.get(state).add(owner);
  };
  const walk = (value, owner, skipKeys) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, owner, skipKeys);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (skipKeys?.has(key)) continue;
      if (isVisualStateKey(key)) record(child, owner);
      else if (key === "visualStateChoices" && Array.isArray(child)) {
        for (const item of child) record(item, owner);
      } else walk(child, owner, skipKeys);
    }
  };
  const labRootSkip = new Set(["techniques"]);
  for (const entry of owners) {
    walk(entry.definition, entry.owner, entry.scope === "labRoot" ? labRootSkip : undefined);
  }
  return states;
};

const walkSourceFiles = (relativeDir, accumulator = []) => {
  const absolute = join(root, relativeDir);
  if (!existsSync(absolute)) return accumulator;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const next = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) walkSourceFiles(next, accumulator);
    else if (/\.(ts|tsx)$/.test(entry.name)) accumulator.push(next);
  }
  return accumulator;
};

const collectAssetReferences = (relativePath, knownBaseNames) => {
  const source = readText(relativePath);
  const found = new Set();
  for (const match of source.matchAll(
    /assets\/equipment-realistic\/v1\/([A-Za-z0-9._-]+)\.(svg|png)/g,
  )) {
    found.add(match[1]);
  }
  for (const match of source.matchAll(/["'`]([A-Za-z0-9._-]+)\.(svg|png)["'`]/g)) {
    if (knownBaseNames.has(match[1])) found.add(match[1]);
  }
  return found;
};

/** IHDR width/height of a PNG, without decoding it. */
const pngDimensions = (relativePath) => {
  const header = readFileSync(join(root, relativePath)).subarray(0, 24);
  if (header.length < 24) return undefined;
  if (header.toString("latin1", 0, 8) !== "\x89PNG\r\n\x1a\n") return undefined;
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
};

/**
 * The `AGENTS.md` PNG-backed wrapper contract, as data.
 *
 * Read only the first 4 KiB: the root `<svg>` tag and the `<image>` attributes that precede the
 * base64 payload live there, and the payload itself is megabytes.
 */
const parseAssetWrappers = (assetFiles) => {
  const wrappers = new Map();
  for (const file of assetFiles) {
    if (!file.endsWith(".svg")) continue;
    const id = file.slice(0, -4);
    const source = readText(`${REALISTIC_DIR}/${file}`);
    const head = source.slice(0, 4096);
    const problems = [];
    const rootTag = head.match(/<svg\b[^>]*>/s)?.[0] ?? "";
    const attribute = (name, from = rootTag) =>
      from.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const ariaLabel = attribute("aria-label");
    const pngFile = `${id}.png`;
    const dimensions = assetFiles.has(pngFile)
      ? pngDimensions(`${REALISTIC_DIR}/${pngFile}`)
      : undefined;

    // The `<image>` element's own tag spans the whole base64 payload, so read its attributes from the
    // bytes on either side of it rather than matching megabytes with a regex.
    const imageStarts = [...source.matchAll(/<image\b/g)].map((match) => match.index);
    if (imageStarts.length !== 1) {
      problems.push({ rule: "png-count", detail: `embeds ${imageStarts.length} <image> elements` });
    } else {
      // Attribute order varies: some wrappers put width/height before `href`, some after the
      // payload. Read both ends of the element and skip the megabytes in between.
      const imageOpen = source.slice(imageStarts[0], imageStarts[0] + 400);
      const imageAttributes = `${imageOpen} ${source.slice(-400)}`;
      if (!imageOpen.includes("data:image/png;base64,")) {
        problems.push({ rule: "not-png-backed", detail: "the <image> href is not an embedded PNG" });
      }
      const preserve = attribute("preserveAspectRatio", imageAttributes);
      if (preserve !== "xMidYMid meet") {
        problems.push({
          rule: "preserve-aspect-ratio",
          detail: `preserveAspectRatio=${preserve ?? "absent"}`,
        });
      }
      if (
        dimensions &&
        (attribute("width", imageAttributes) !== String(dimensions.width) ||
          attribute("height", imageAttributes) !== String(dimensions.height))
      ) {
        problems.push({ rule: "image-dimensions", detail: "the <image> does not carry the PNG size" });
      }
    }
    if (!dimensions) {
      problems.push({ rule: "png-missing", detail: `no readable ${pngFile} beside it` });
    } else {
      const expected = `0 0 ${dimensions.width} ${dimensions.height}`;
      if (
        attribute("width") !== String(dimensions.width) ||
        attribute("height") !== String(dimensions.height) ||
        attribute("viewBox")?.trim() !== expected
      ) {
        problems.push({
          rule: "dimensions",
          detail: `svg ${attribute("width")}x${attribute("height")} viewBox="${attribute("viewBox")}" vs png ${dimensions.width}x${dimensions.height}`,
        });
      }
    }
    if (!ariaLabel || ariaLabel.trim().length === 0) {
      problems.push({ rule: "label", detail: "no aria-label on the root <svg>" });
    }
    if (attribute("role") !== "img") {
      problems.push({ rule: "role", detail: `role=${attribute("role") ?? "absent"}` });
    }
    wrappers.set(id, { id, ariaLabel, dimensions, problems });
  }
  return wrappers;
};

const buildReachability = (assetFiles, realisticAssetById, stateAssetsByEquipment, composites) => {
  const knownBaseNames = new Set([...assetFiles].map((file) => file.replace(/\.(svg|png)$/, "")));
  const playerBase = new Set([...realisticAssetById.values()].filter(Boolean));
  const visualCatalog = collectAssetReferences("src/equipment/visualCatalog.ts", knownBaseNames);
  const accessory = parseProbePresentationAssetNames();
  for (const name of accessory) visualCatalog.delete(name);
  for (const states of stateAssetsByEquipment.values()) {
    // The calorimeter series is generated, so its asset names exist only as a derivable pattern. The
    // guard keeps that derivation to the states it describes; before Cycle 11 every entry in the map
    // was a CAL-NN state, so this changes nothing for them and stops the loop inventing a
    // `hand-warmer-calorimeter-<state>` name for a hand-written map that names its assets outright.
    for (const state of states) {
      if (!/^CAL-\d\d$/.test(state)) continue;
      visualCatalog.add(`hand-warmer-calorimeter-${state.toLowerCase()}`);
    }
  }
  for (const name of parseInlineStateAssetNames()) visualCatalog.add(name);
  // Composite result assets used to be literals in EquipmentView.tsx, so reachability was read from
  // that file. Cycle 05 made the registry the source, so reachability is read from the registry.
  const composite = new Set(
    composites.filter((entry) => entry.kind === "visual").map((entry) => entry.resultAsset),
  );
  // Open-lid art is a registry-adjacent composite override: it is selected by the shared composite
  // evaluator, but the open asset is not itself the resultAsset of a registry composite. Include the
  // evaluator's explicit mapping so the disposition registry can distinguish active art from debt.
  const compositeSource = readText("src/equipment/composites.ts");
  const openLidBlock = compositeSource.match(
    /OPEN_LID_ASSET_BY_SEALED_ASSET[\s\S]*?=\s*\{([\s\S]*?)\n\};/,
  )?.[1] ?? "";
  for (const match of openLidBlock.matchAll(/:\s*"([a-z0-9-]+)"/g)) composite.add(match[1]);
  const customRoute = new Set();
  for (const file of walkSourceFiles("src/investigations")) {
    for (const asset of collectAssetReferences(file, knownBaseNames)) customRoute.add(asset);
  }
  const gallery = collectAssetReferences("src/trials/realisticEquipmentAssets.ts", knownBaseNames);

  const reachability = new Map();
  for (const file of assetFiles) {
    if (!file.endsWith(".svg")) continue;
    const base = file.slice(0, -4);
    const tags = [];
    if (playerBase.has(base)) tags.push("player-base");
    if (accessory.has(base)) tags.push("accessory-presentation");
    if (visualCatalog.has(base)) tags.push("visual-catalog");
    if (composite.has(base)) tags.push("composite-branch");
    if (customRoute.has(base)) tags.push("custom-route");
    if (gallery.has(base)) tags.push("gallery");
    reachability.set(base, tags);
  }
  return reachability;
};

/** Inline source-trace conventions already serialized into public JSON (audit-confirmed). */
const INLINE_TRACE_KEYS = new Set(["sourceBasis", "traceabilityBasis"]);

const collectPublicTraceLeaks = (owners) => {
  const leaks = new Map();
  const walk = (value, entry) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, entry);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (INLINE_TRACE_KEYS.has(key)) {
        const id = `${entry.owner}#${key}`;
        if (!leaks.has(id)) {
          leaks.set(id, { scope: `${entry.owner}/${key}`, evidence: entry.file, convention: key });
        }
      }
      walk(child, entry);
    }
  };
  for (const entry of owners) {
    walk(entry.scope === "labRoot" ? { ...entry.definition, techniques: [] } : entry.definition, entry);
  }
  return [...leaks.values()];
};

/**
 * Modules under `src/` that reference the source-trace registry as a path or import specifier.
 *
 * Matches the name only inside a single- or double-quoted string, which is what an import, a
 * `require`, or a fetch path looks like. A JSDoc mention inside backticks is prose and must not fail
 * the build, or the rule would punish documenting the boundary it exists to protect.
 */
const collectSrcTraceReferences = () =>
  walkSourceFiles("src").filter((file) =>
    /["'][^"']*source-trace-registry[^"']*["']/.test(readText(file)),
  );

const buildRepositoryWorld = () => {
  const owners = collectOwners();
  const { equipment, realisticAssetById, snapZoneIds, snapZoneAccepts } = parseEquipmentCatalog();
  const stateAssetsByEquipment = parseStateAssets();
  const assetDirectoryEntries = new Set();
  const assetFiles = new Set();
  for (const entry of readdirSync(join(root, REALISTIC_DIR), { withFileTypes: true })) {
    if (entry.isFile() && /\.(svg|png)$/.test(entry.name)) assetFiles.add(entry.name);
    else assetDirectoryEntries.add(entry.name);
  }
  const registries = {
    atoms: readJson(ATOM_REGISTRY_PATH),
    roles: readJson(ROLE_REGISTRY_PATH),
    visualStates: readJson(VISUAL_STATE_REGISTRY_PATH),
    composites: readJson(COMPOSITE_REGISTRY_PATH),
    assets: readJson(ASSET_REGISTRY_PATH),
    aliases: readJson(ALIAS_REGISTRY_PATH),
    sourceTrace: readJson(SOURCE_TRACE_REGISTRY_PATH),
  };
  // Cycle 02 verified that each hard-coded branch matched its registry entry. Cycle 05 deleted the
  // branches, so the check inverts: the renderer and the reducer must contain none of the literals a
  // branch would need. Overlay ids stay allowed — an overlay is art, dispatched by registry id.
  const overlaySource = readText("src/player/equipmentOverlays.tsx");
  const compositeOverlayIds = new Set(
    [
      ...(overlaySource
        .slice(overlaySource.indexOf("export const compositeOverlayById"))
        .match(/\{[^}]*\}/s)?.[0] ?? "")
        .matchAll(/"([a-z0-9-]+)":/g),
    ].map((match) => match[1]),
  );
  const compositeLiterals = { resultAsset: new Set(), definitionId: new Set(), snapZoneId: new Set() };
  for (const composite of registries.composites.composites) {
    compositeLiterals.resultAsset.add(`${composite.resultAsset}.svg`);
    for (const participant of composite.participants ?? []) {
      compositeLiterals.definitionId.add(`"${participant.definitionId}"`);
      if (participant.snapZoneId) compositeLiterals.snapZoneId.add(`"${participant.snapZoneId}"`);
    }
  }
  const compositeLeaks = new Map();
  const compositeEvaluatorConsumers = new Map();
  for (const { file, literals, imports } of COMPOSITE_FREE_SOURCES) {
    const source = readText(file);
    const forbidden = literals.flatMap((kind) => [...compositeLiterals[kind]]);
    compositeLeaks.set(file, forbidden.filter((literal) => source.includes(literal)).sort());
    compositeEvaluatorConsumers.set(file, !imports || source.includes(imports) ? undefined : imports);
  }
  const compositeEvaluatorPresent =
    existsSync(join(root, COMPOSITE_EVALUATOR_PATH)) &&
    readText(COMPOSITE_EVALUATOR_PATH).includes("compositeRegistry");
  const sourceFiles = new Set(
    registries.sourceTrace.sourceDerivedOwners.map((group) => group.sourceFile),
  );

  return finalizeWorld({
    sourceVocabulary: parseSourceVocabulary(),
    owners,
    equipment,
    realisticAssetById,
    snapZoneIds,
    snapZoneAccepts,
    paletteModules: parsePaletteOwnership(),
    runtimeAssignedVisualStates: collectRuntimeAssignedVisualStates(),
    stateAssetsByEquipment,
    assetFiles,
    assetWrappers: parseAssetWrappers(assetFiles),
    reachability: buildReachability(
      assetFiles,
      realisticAssetById,
      stateAssetsByEquipment,
      registries.composites.composites,
    ),
    assetDirectoryEntries,
    compositeLeaks,
    compositeEvaluatorConsumers,
    compositeOverlayIds,
    compositeEvaluatorPresent,
    srcTraceReferences: collectSrcTraceReferences(),
    publicTraceLeaks: collectPublicTraceLeaks(owners),
    authoredVisualStates: collectAuthoredVisualStates(owners),
    sourceFiles,
    registries,
  });
};

/* ------------------------------------------------------------------ *
 * Self-fixtures. Every new rule category has a negative fixture; the positive fixture proves the
 * engine reports nothing on a compliant corpus.
 * ------------------------------------------------------------------ */

const fixtureAction = (overrides = {}) => ({
  id: "fx-weigh-sample",
  verb: "weigh",
  label: "Weigh the sample",
  atomId: "atom.fx.weigh",
  equipmentRoleBindings: { "fx-balance": "analytical-balance", "fx-vessel": "beaker-250ml" },
  parameters: {},
  interaction: {
    type: "readInstrument",
    sourceDefinitionId: "beaker-250ml",
    stationId: "balance",
    accessibleLabel: "Read the balance.",
  },
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "ok", invalid: "no" },
  evidence: [],
  ...overrides,
});

const fixtureDefinition = (overrides = {}) => ({
  id: "fx-lab",
  equipment: ["analytical-balance", "beaker-250ml"],
  actions: [fixtureAction()],
  techniques: [],
  process: {
    startNodeId: "fx-node",
    nodes: [
      {
        id: "fx-node",
        type: "action",
        title: "Weigh",
        description: "Weigh",
        actionId: "fx-weigh-sample",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "ok", retry: "again" },
      },
    ],
    edges: [],
  },
  initialState: {
    equipment: [
      {
        id: "fx-beaker-1",
        definitionId: "beaker-250ml",
        label: "Beaker",
        location: "workbench",
        contents: {
          kind: "liquid",
          label: "water",
          solutes: [],
          contamination: [],
          wetState: "wet",
          visualState: "fx-clear",
        },
      },
    ],
  },
  metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-04", tags: [] },
  ...overrides,
});

const fixtureWorld = (mutate = () => {}) => {
  const world = emptyWorld();
  world.equipment = new Map([
    ["analytical-balance", { id: "analytical-balance", label: "Analytical balance", category: "measurement" }],
    ["beaker-250ml", { id: "beaker-250ml", label: "250 mL beaker", category: "container" }],
    ["wash-bottle", { id: "wash-bottle", label: "Wash bottle", category: "reagent" }],
  ]);
  world.realisticAssetById = new Map([
    ["analytical-balance", "fx-balance-art"],
    ["beaker-250ml", "fx-beaker"],
    ["wash-bottle", "fx-wash-bottle"],
  ]);
  world.snapZoneIds = new Set(["fx-zone"]);
  world.snapZoneAccepts = new Map([
    ["fx-zone", { owner: "analytical-balance", accepts: ["beaker-250ml"] }],
  ]);
  world.assetFiles = new Set(["fx-balance-art.svg", "fx-beaker.svg", "fx-wash-bottle.svg"]);
  world.assetWrappers = new Map(
    ["fx-balance-art", "fx-beaker", "fx-wash-bottle"].map((id) => [
      id,
      { id, ariaLabel: id, dimensions: { width: 64, height: 64 }, problems: [] },
    ]),
  );
  world.reachability = new Map([
    ["fx-balance-art", ["player-base"]],
    ["fx-beaker", ["player-base"]],
    ["fx-wash-bottle", ["player-base"]],
  ]);
  world.paletteModules = [
    {
      file: "fixture://styles.ts",
      reader: "liquidStylesByState",
      derivesFromRegistry: true,
      literalColours: 0,
      authoredBeforeFallbacks: true,
    },
  ];
  world.runtimeAssignedVisualStates = [
    { state: "fx-runtime-state", file: "fixture://reducer.ts", overridable: false },
  ];
  world.compositeLeaks = new Map([["fixture://EquipmentView.tsx", []]]);
  world.compositeEvaluatorConsumers = new Map([["fixture://EquipmentView.tsx", undefined]]);
  world.compositeOverlayIds = new Set(["fx-overlay"]);
  world.compositeEvaluatorPresent = true;
  world.sourceFiles = new Set(["fx-plan.md"]);
  // The fixture world supplies a vocabulary that agrees with the mirrors, so the positive fixture
  // stays green and `negative/vocabulary-mirror-drift` has something to perturb.
  world.sourceVocabulary = {
    actionVerbs: new Set([...PHYSICAL_VERBS, ...NON_PHYSICAL_VERBS]),
    actionEquipmentParameterKeys: new Set(EQUIPMENT_PARAMETER_KEYS),
    actionModelParameterKeys: new Set(Object.keys(MODEL_PARAMETER_COLLECTIONS)),
    interactionOperationTypes: new Set(Object.keys(COMPATIBLE_INTERACTION_VERBS)),
    compatibleInteractionVerbs: Object.fromEntries(
      Object.entries(COMPATIBLE_INTERACTION_VERBS).map(([type, verbs]) => [type, [...verbs]]),
    ),
    requiresSource: new Set(REQUIRES_AUTHORED_SOURCE),
    requiresTarget: new Set(REQUIRES_AUTHORED_TARGET),
  };
  world.authoredVisualStates = new Map([["fx-clear", new Set(["lab:fx-lab"])]]);
  world.registries = {
    atoms: {
      atoms: [
        {
          id: "atom.fx.weigh",
          family: "weighing",
          documentationLabel: "Weigh a sample",
          verb: "weigh",
          allowedInteractionTypes: ["readInstrument"],
          effectContract: {
            classes: ["measurement-direct-observation-acquisition"],
            targets: [
              { domain: "instrument" },
              { domain: "measurement-observation" },
              { domain: "evidence" },
            ],
          },
          requiredRoles: ["fx-balance", "fx-vessel"],
          optionalRoles: [],
          proceduralConstraints: [],
          evidence: "recorded mass",
          sourceExamples: [
            { sourceFile: "fx-plan.md", sourceTable: "phase", step: "FX-01", basis: "M" },
          ],
          contentExamples: [{ owner: "lab:fx-lab", actionId: "fx-weigh-sample" }],
        },
      ],
    },
    roles: {
      kindCategoryConstraints: {
        instrument: ["measurement", "heating"],
        vessel: ["container"],
        delivery: ["reagent"],
        consumable: ["filtration"],
        tool: ["tool"],
        support: ["tool"],
      },
      roles: [
        {
          id: "fx-balance",
          label: "Balance",
          kind: "instrument",
          constraints: {},
          allowedEquipmentIds: ["analytical-balance"],
          rationale: "fixture",
        },
        {
          id: "fx-vessel",
          label: "Vessel",
          kind: "vessel",
          constraints: {},
          allowedEquipmentIds: ["beaker-250ml"],
          prohibitedEquipmentIds: ["wash-bottle"],
          rationale: "fixture",
        },
      ],
    },
    visualStates: {
      fallbacks: {
        definitionIdStates: [{ definitionId: "wash-bottle", state: "fx-rinse" }],
        reagentKeywordStates: [],
        defaultLiquidState: "fx-clear",
        defaultSolidState: "fx-powder",
      },
      states: [
        {
          id: "fx-clear",
          disposition: "liquid-style",
          evidenceKind: "qualitative",
          quantitativeClaim: "none",
          authoredToday: true,
          selectors: ["authored"],
          renderStyleKey: "fx-clear",
          renderStyle: { fill: "fx-fill", stroke: "fx-stroke", highlight: "fx-hi", meniscus: "fx-m", opacity: 1 },
          provenance: "fixture",
          owners: ["lab:fx-lab"],
        },
        {
          id: "fx-rinse",
          disposition: "liquid-style",
          evidenceKind: "presentation-only",
          quantitativeClaim: "none",
          authoredToday: false,
          selectors: ["definition-id"],
          renderStyleKey: "fx-rinse",
          renderStyle: { fill: "fx-fill-2", stroke: "fx-stroke", highlight: "fx-hi", meniscus: "fx-m", opacity: 1 },
          provenance: "fixture",
          owners: [],
        },
        {
          id: "fx-powder",
          disposition: "solid-style",
          evidenceKind: "qualitative",
          quantitativeClaim: "none",
          authoredToday: true,
          selectors: ["authored"],
          solidStyle: { fill: "fx-solid-fill", stroke: "fx-solid-stroke", highlight: "fx-solid-hi" },
          provenance: "fixture",
          owners: ["lab:fx-lab"],
        },
        {
          id: "fx-runtime-state",
          disposition: "solid-style",
          evidenceKind: "simulator-configured",
          quantitativeClaim: "none",
          authoredToday: false,
          selectors: ["runtime-assigned"],
          runtimeAssignment: "unconditional",
          solidStyle: { fill: "fx-runtime-fill", stroke: "fx-runtime-stroke", highlight: "fx-runtime-hi" },
          provenance: "fixture",
          owners: [],
        },
      ],
    },
    composites: {
      rendererPrecedence: ["fx-composite"],
      participantRoleKinds: [...COMPOSITE_ROLE_KINDS],
      composites: [
        {
          id: "fx-composite",
          kind: "visual",
          parentDefinitionId: "analytical-balance",
          participants: [
            {
              role: "fx-parent",
              roleKind: "instrument",
              equipmentRoleId: "fx-balance",
              definitionId: "analytical-balance",
              snapZoneId: null,
              parent: true,
              suppressed: false,
            },
            {
              role: "fx-child",
              roleKind: "vessel",
              equipmentRoleId: "fx-vessel",
              definitionId: "beaker-250ml",
              snapZoneId: "fx-zone",
              parent: false,
              suppressed: true,
            },
          ],
          requiredContentsVisualState: null,
          resultAsset: "fx-beaker",
          resultInstanceDefinitionId: null,
          extraOverlay: "fx-overlay",
          invalidFeedback: null,
          detach: { mechanism: "fx", evidence: "fixture", compositeAware: true },
          recovery: { mechanism: "fx", evidence: "fixture", compositeAware: true },
          reset: { mechanism: "fx", evidence: "fixture", compositeAware: true },
          deviations: [],
          ownerCycle: "05",
        },
      ],
    },
    assets: {
      assets: [
        {
          id: "fx-balance-art",
          file: `${REALISTIC_DIR}/fx-balance-art.svg`,
          disposition: "player-active",
          reachabilityTags: ["player-base"],
          rationale: "fixture",
        },
        {
          id: "fx-beaker",
          file: `${REALISTIC_DIR}/fx-beaker.svg`,
          disposition: "player-active",
          reachabilityTags: ["player-base"],
          rationale: "fixture",
        },
        {
          id: "fx-wash-bottle",
          file: `${REALISTIC_DIR}/fx-wash-bottle.svg`,
          disposition: "player-active",
          reachabilityTags: ["player-base"],
          rationale: "fixture",
        },
      ],
    },
    aliases: { aliases: [] },
    sourceTrace: {
      sourceDerivedOwners: [{ sourceFile: "fx-plan.md", investigation: 0, owners: ["lab:fx-lab"] }],
      nonSourceDerivedOwners: [],
      traces: [
        {
          ownerType: "lab",
          ownerId: "fx-lab",
          actionId: "fx-weigh-sample",
          atomId: "atom.fx.weigh",
          sourceFile: "fx-plan.md",
          sourceTable: "phase",
          step: "FX-01",
          basis: "M",
        },
      ],
    },
  };
  world.owners = [
    {
      owner: "lab:fx-lab",
      scope: "labRoot",
      file: "fixture://lab/fx-lab.json",
      runtimeExecuted: true,
      definition: fixtureDefinition(),
    },
  ];
  mutate(world);
  return finalizeWorld(world);
};

/**
 * Add one standalone technique and point the fixture lab's `techniqueRefs` at it. `version` pins the
 * *reference*; the technique itself always publishes `1.0.0`, so passing anything else exercises the
 * mismatch path.
 */
const pushFixtureTechnique = (
  world,
  { actionIds, version = "1.0.0", action = fixtureAction({ id: "fx-shared-action" }) },
) => {
  world.owners.push({
    owner: "technique:fx-technique",
    scope: "standaloneTechnique",
    file: "fixture://technique/fx-technique.json",
    runtimeExecuted: true,
    definition: {
      id: "fx-technique",
      equipment: ["beaker-250ml"],
      actions: [action],
      process: { startNodeId: "n", nodes: [], edges: [] },
      metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-04", tags: [] },
    },
  });
  world.owners[0].definition.techniqueRefs = [{ techniqueId: "fx-technique", version, actionIds }];
};

const configureFixtureAsActivePhotometerConfiguration = (
  world,
  classes = [...TYPED_ATOM_INTERACTION_EFFECT_CLASSES["atom.observe.set-active-photometer-wavelength"].readInstrument],
) => {
  const atom = world.registries.atoms.atoms[0];
  const action = world.owners[0].definition.actions[0];
  atom.id = "atom.observe.set-active-photometer-wavelength";
  atom.family = "spectrophotometry";
  atom.documentationLabel = "Set the active photometer wavelength";
  atom.verb = "observe";
  atom.allowedInteractionTypes = ["readInstrument"];
  atom.effectContract = {
    classes,
    targets: [
      { domain: "instrument" },
      { domain: "measurement-observation" },
      { domain: "evidence" },
    ],
  };
  atom.requiredRoles = ["fx-balance"];
  atom.optionalRoles = [];
  atom.proceduralConstraints = [];
  atom.evidence = "configured active wavelength";
  action.verb = "observe";
  action.atomId = atom.id;
  action.equipmentRoleBindings = { "fx-balance": "analytical-balance" };
  action.parameters = {
    configurationQuantity: "fixture wavelength",
    measurementId: "fx-configured-wavelength",
    unit: "nm",
    photometerInstanceId: "fx-balance",
    photometerConfigurationMode: "approved-selected-wavelength",
  };
  action.interaction = {
    type: "readInstrument",
    sourceDefinitionId: "analytical-balance",
    stationId: "balance",
    accessibleLabel: "Configure the active wavelength.",
  };
  world.registries.sourceTrace.traces[0].atomId = atom.id;
};

const appendFixtureDarkZeroAction = (world, { includeWavelength = true } = {}) => {
  const lab = world.owners[0];
  const configurationAction = {
    id: "fx-configure-wavelength",
    verb: "observe",
    label: "Configure the selected wavelength",
    parameters: {
      configurationQuantity: "fixture wavelength",
      measurementId: "fx-configured-wavelength",
      unit: "nm",
      photometerInstanceId: "fx-balance",
      photometerConfigurationMode: "approved-selected-wavelength",
    },
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "analytical-balance",
      stationId: "balance",
      accessibleLabel: "Configure the selected wavelength.",
    },
    prerequisites: [],
    stateChanges: [],
    invalidCases: [],
    feedback: { success: "ok", invalid: "no" },
    evidence: [],
  };
  const darkZeroAction = {
    id: "fx-dark-zero-photometer",
    verb: "observe",
    label: "Set the photometer dark zero",
    atomId: "atom.fx.dark-zero-photometer",
    equipmentRoleBindings: { "fx-balance": "analytical-balance" },
    parameters: {
      photometerOperation: "darkZero",
      photometerCalibrationMethod: "selected-wavelength-pair",
      photometerInstanceId: "fx-balance",
      ...(includeWavelength ? { wavelengthMeasurementId: "fx-configured-wavelength" } : {}),
    },
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "analytical-balance",
      stationId: "balance",
      accessibleLabel: "Set the photometer dark zero.",
    },
    prerequisites: [],
    stateChanges: [],
    invalidCases: [],
    feedback: { success: "ok", invalid: "no" },
    evidence: [],
  };
  lab.definition.actions.push(configurationAction, darkZeroAction);
  for (const action of [configurationAction, darkZeroAction]) {
    lab.definition.process.nodes.push({
      id: `${action.id}-node`,
      type: "action",
      title: action.label,
      description: action.label,
      actionId: action.id,
      config: {},
      validation: [],
      hints: [],
      feedback: { success: "ok", retry: "again" },
    });
  }
  world.registries.atoms.atoms.push({
    id: darkZeroAction.atomId,
    family: "spectrophotometry",
    documentationLabel: "Set the photometer dark zero",
    verb: "observe",
    allowedInteractionTypes: ["readInstrument"],
    effectContract: {
      classes: ["measurement-direct-observation-acquisition"],
      targets: [
        { domain: "instrument" },
        { domain: "measurement-observation" },
        { domain: "evidence" },
      ],
    },
    requiredRoles: ["fx-balance"],
    optionalRoles: [],
    proceduralConstraints: [],
    evidence: "dark-zero evidence",
    sourceExamples: [{ sourceFile: "fx-plan.md", sourceTable: "phase", step: "FX-02", basis: "M" }],
    contentExamples: [{ owner: "lab:fx-lab", actionId: darkZeroAction.id }],
  });
  world.registries.sourceTrace.traces.push({
    ownerType: "lab",
    ownerId: "fx-lab",
    actionId: darkZeroAction.id,
    atomId: darkZeroAction.atomId,
    sourceFile: "fx-plan.md",
    sourceTable: "phase",
    step: "FX-02",
    basis: "M",
  });
};

/**
 * Append a per-wavelength scan group to the fixture lab, on a representative photometer.
 *
 * The lab gains a `spectrophotometer` and a `cuvette` definition with one instance each, so the
 * fixture reads like the contract it stands for instead of borrowing the balance used by the
 * isolated parameter fixtures elsewhere in this file. Two limits are worth stating: nothing in this
 * checker reads `initialState`, so the bench instances are documentation rather than an assertion;
 * and `findInstance` resolves an explicitly named instance by id without consulting its definition,
 * so a definition-shaped fixture proves nothing about branch reachability either way. The reason to
 * use a photometer here is legibility, not a new equipment-type rule -- and no such rule is added.
 *
 * None of the appended actions carries an atom id, which keeps these fixtures on the
 * parameter-driven rules under test instead of the atom-bound ones exercised elsewhere.
 *
 * Options:
 *   includeBlank        - append the distilled-water blank at all.
 *   method              - the calibration method string both the blank and the read declare.
 *   omit                - read parameters to leave out, one requirement at a time.
 *   bindByDefinition    - blank and read both omit `photometerInstanceId`, so each resolves through
 *                         the reducer's definition fallback.
 *   readBindsByDefinition - only the read omits it, leaving the pair unmatchable.
 *   blankInstanceId     - put the blank on a different instrument than the read.
 *   blankWavelengthId   - blank at a different, separately configured wavelength.
 *   includeOtherSelectedWavelengthConfiguration - append a selected-wavelength configuration for the
 *                         same instrument and wavelength reference before the scan configuration.
 */
const appendFixtureScanReadActions = (world, {
  includeBlank = true,
  method = "distilled-water-per-wavelength",
  omit = [],
  bindByDefinition = false,
  readBindsByDefinition = false,
  blankInstanceId = "fx-spectrophotometer-1",
  blankWavelengthId = "fx-scan-wavelength",
  includeOtherSelectedWavelengthConfiguration = false,
} = {}) => {
  const lab = world.owners[0];
  const readWavelengthId = "fx-scan-wavelength";
  world.equipment.set("spectrophotometer", {
    id: "spectrophotometer",
    label: "Spectrophotometer",
    category: "measurement",
  });
  world.equipment.set("cuvette", { id: "cuvette", label: "Cuvette", category: "container" });
  lab.definition.equipment = [...new Set([...(lab.definition.equipment ?? []), "spectrophotometer", "cuvette"])];
  lab.definition.initialState.equipment.push(
    {
      id: "fx-spectrophotometer-1",
      definitionId: "spectrophotometer",
      label: "Spectrophotometer",
      location: "workbench",
      contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "fx-clear" },
    },
    {
      id: "fx-scan-cuvette",
      definitionId: "cuvette",
      label: "Measurement cuvette",
      location: "workbench",
      contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "fx-clear" },
    },
  );

  const instrumentBinding = (byDefinition) =>
    byDefinition ? {} : { photometerInstanceId: "fx-spectrophotometer-1" };
  const configurationAction = (id, measurementId, label, mode = "wavelength-scan") => ({
    id,
    verb: "observe",
    label,
    parameters: {
      configurationQuantity: "fixture scan wavelength",
      measurementId,
      unit: "nm",
      photometerInstanceId: "fx-spectrophotometer-1",
      photometerConfigurationMode: mode,
    },
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      stationId: "spectrophotometer",
      accessibleLabel: label,
    },
    prerequisites: [],
    stateChanges: [],
    invalidCases: [],
    feedback: { success: "ok", invalid: "no" },
    evidence: [],
  });

  const readParameters = {
    photometerOperation: "read",
    photometerCalibrationMethod: method,
    ...instrumentBinding(bindByDefinition || readBindsByDefinition),
    wavelengthMeasurementId: readWavelengthId,
    cuvetteInstanceId: "fx-scan-cuvette",
    measurementId: "fx-scan-absorbance",
    photometricQuantity: "absorbance",
    unit: "absorbance",
  };
  for (const key of omit) delete readParameters[key];

  const configurationActions = [
    ...(includeOtherSelectedWavelengthConfiguration
      ? [configurationAction(
        "fx-scan-set-selected-wavelength",
        readWavelengthId,
        "Set the selected wavelength",
        CYCLE_06_APPROVED_SELECTED_WAVELENGTH_MODE,
      )]
      : []),
    configurationAction(
      "fx-scan-set-wavelength",
      readWavelengthId,
      "Set the scan wavelength",
    ),
    // A blank at another wavelength needs that wavelength configured too, or the fixture would also
    // trip `photometer-wavelength-unproduced` and stop isolating the rule under test.
    ...(blankWavelengthId !== readWavelengthId
      ? [configurationAction(
        "fx-scan-set-other-wavelength",
        blankWavelengthId,
        "Set another scan wavelength",
      )]
      : []),
  ];
  const actions = [
    ...configurationActions,
    ...(includeBlank
      ? [{
        id: "fx-scan-blank",
        verb: "observe",
        label: "Blank the photometer at the scan wavelength",
        parameters: {
          photometerOperation: "zero",
          photometerCalibrationMethod: method,
          ...(bindByDefinition ? {} : { photometerInstanceId: blankInstanceId }),
          wavelengthMeasurementId: blankWavelengthId,
          cuvetteInstanceId: "fx-scan-cuvette",
          tag: "fx-scan-blanked",
        },
        interaction: {
          type: "readInstrument",
          sourceDefinitionId: "cuvette",
          targetDefinitionId: "spectrophotometer",
          stationId: "spectrophotometer",
          accessibleLabel: "Blank the photometer at the scan wavelength.",
        },
        prerequisites: [],
        stateChanges: [],
        invalidCases: [],
        feedback: { success: "ok", invalid: "no" },
        evidence: [],
      }]
      : []),
    {
      id: "fx-scan-read",
      verb: "observe",
      label: "Read the sample at the scan wavelength",
      parameters: readParameters,
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "cuvette",
        targetDefinitionId: "spectrophotometer",
        stationId: "spectrophotometer",
        accessibleLabel: "Read the sample at the scan wavelength.",
      },
      prerequisites: [],
      stateChanges: [],
      invalidCases: [],
      feedback: { success: "ok", invalid: "no" },
      evidence: [],
    },
  ];
  lab.definition.actions.push(...actions);
  for (const action of actions) {
    lab.definition.process.nodes.push({
      id: `${action.id}-node`,
      type: "action",
      title: action.label,
      description: action.label,
      actionId: action.id,
      config: {},
      validation: [],
      hints: [],
      feedback: { success: "ok", retry: "again" },
    });
  }
};

const FIXTURES = [
  {
    name: "positive/compliant-corpus",
    expect: null,
    mutate: () => {},
  },
  {
    name: "positive/active-photometer-configuration-typed-contract",
    expect: null,
    mutate: (world) => {
      configureFixtureAsActivePhotometerConfiguration(world);
    },
  },
  {
    name: "negative/active-photometer-configuration-typed-contract-conflict",
    expect: "registry/atom-effect-handler-conflict",
    mutate: (world) => {
      configureFixtureAsActivePhotometerConfiguration(world, [
        "measurement-direct-observation-acquisition",
      ]);
    },
  },
  {
    name: "negative/atom-effect-contract-missing",
    expect: "registry/atom-effect-contract-missing",
    mutate: (world) => {
      delete world.registries.atoms.atoms[0].effectContract;
    },
  },
  {
    // Regression guard: before this fixture existed, a lab that imported an action through
    // `techniqueRefs` and referenced it from a process node was reported as having an unresolved
    // node reference and an unreferenced action. Cycle 03's first migration would have failed CI.
    name: "positive/technique-refs-resolve-process-actions",
    expect: null,
    mutate: (world) => {
      world.owners.push({
        owner: "technique:fx-technique",
        scope: "standaloneTechnique",
        file: "fixture://technique/fx-technique.json",
        runtimeExecuted: true,
        definition: {
          id: "fx-technique",
          actions: [fixtureAction({ id: "fx-imported-action" })],
          process: {
            startNodeId: "fx-imported-node",
            nodes: [
              {
                id: "fx-imported-node",
                type: "action",
                title: "Weigh",
                description: "Weigh",
                actionId: "fx-imported-action",
                config: {},
                validation: [],
                hints: [],
                feedback: { success: "ok", retry: "again" },
              },
            ],
            edges: [],
          },
          metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-04", tags: [] },
        },
      });
      world.registries.sourceTrace.sourceDerivedOwners.push({
        sourceFile: "fx-plan.md",
        investigation: 0,
        owners: ["technique:fx-technique"],
      });
      world.registries.sourceTrace.traces.push({
        ownerType: "technique",
        ownerId: "fx-technique",
        actionId: "fx-imported-action",
        atomId: "atom.fx.weigh",
        sourceFile: "fx-plan.md",
        step: "FX-01",
        basis: "M",
        sourceTable: "phase",
      });
      world.owners[0].definition.techniqueRefs = [
        { techniqueId: "fx-technique", version: "1.0.0", actionIds: ["fx-imported-action"] },
      ];
      world.owners[0].definition.process.nodes.push({
        id: "fx-imported-usage-node",
        type: "action",
        title: "Weigh again",
        description: "Weigh again",
        actionId: "fx-imported-action",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "ok", retry: "again" },
      });
    },
  },
  {
    name: "negative/composite-hard-coded-branch",
    expect: "composite/hard-coded-branch",
    mutate: (world) => {
      world.compositeLeaks = new Map([["fixture://EquipmentView.tsx", ['"beaker-250ml"']]]);
    },
  },
  {
    name: "negative/composite-evaluator-missing",
    expect: "composite/evaluator-missing",
    mutate: (world) => {
      world.compositeEvaluatorPresent = false;
    },
  },
  {
    name: "negative/composite-suppresses-non-participant",
    expect: "composite/snap-zone-rejects-participant",
    mutate: (world) => {
      // A participant the zone does not accept can never actually seat, so suppressing it would hide
      // equipment that is not part of the assembly.
      world.registries.composites.composites[0].participants[1].definitionId = "wash-bottle";
    },
  },
  {
    name: "negative/composite-role-forbids-participant",
    expect: "composite/role-forbids-participant",
    mutate: (world) => {
      world.registries.composites.composites[0].participants[1].equipmentRoleId = "fx-balance";
    },
  },
  {
    name: "negative/composite-detach-not-composite-aware",
    expect: "composite/detach-not-composite-aware",
    mutate: (world) => {
      world.registries.composites.composites[0].detach.compositeAware = false;
    },
  },
  {
    name: "negative/composite-swap-without-invalid-feedback",
    expect: "composite/invalid-feedback-undeclared",
    mutate: (world) => {
      const composite = world.registries.composites.composites[0];
      composite.kind = "instance-swap";
      composite.resultInstanceDefinitionId = "beaker-250ml";
      composite.invalidFeedback = null;
      world.registries.composites.rendererPrecedence = [];
    },
  },
  {
    name: "negative/composite-unknown-overlay",
    expect: "composite/unknown-overlay",
    mutate: (world) => {
      world.registries.composites.composites[0].extraOverlay = "fx-absent-overlay";
    },
  },
  {
    name: "negative/visual-state-selector-disagrees-with-authoring",
    expect: "visual-state/selector-disagrees-with-authoring",
    mutate: (world) => {
      world.registries.visualStates.states[0].selectors = [];
    },
  },
  {
    name: "negative/visual-state-fallback-selector-mismatch",
    expect: "visual-state/fallback-selector-mismatch",
    mutate: (world) => {
      world.registries.visualStates.states[1].selectors = [];
      world.registries.visualStates.states[1].authoredToday = false;
    },
  },
  {
    name: "negative/visual-state-shared-appearance-undeclared",
    expect: "visual-state/shared-appearance-undeclared",
    mutate: (world) => {
      const [clear, rinse] = world.registries.visualStates.states;
      rinse.renderStyle = { ...clear.renderStyle };
    },
  },
  {
    name: "negative/visual-state-unknown-evidence-kind",
    expect: "visual-state/unknown-evidence-kind",
    mutate: (world) => {
      world.registries.visualStates.states[0].evidenceKind = "vibes";
    },
  },
  {
    name: "negative/visual-state-solid-style-missing",
    expect: "visual-state/style-missing",
    mutate: (world) => {
      delete world.registries.visualStates.states[2].solidStyle;
    },
  },
  {
    name: "negative/visual-state-fallback-default-unrenderable",
    expect: "visual-state/fallback-default-unrenderable",
    mutate: (world) => {
      // A liquid style is not a solid default: falling back to it would render nothing at all.
      world.registries.visualStates.fallbacks.defaultSolidState = "fx-clear";
    },
  },
  {
    name: "negative/asset-wrapper-dimensions",
    expect: "asset/wrapper-dimensions",
    mutate: (world) => {
      world.assetWrappers.get("fx-beaker").problems.push({
        rule: "dimensions",
        detail: "svg 64x64 vs png 128x128",
      });
    },
  },
  {
    name: "negative/asset-wrapper-label",
    expect: "asset/wrapper-label",
    mutate: (world) => {
      const wrapper = world.assetWrappers.get("fx-beaker");
      wrapper.ariaLabel = undefined;
      wrapper.problems.push({ rule: "label", detail: "no aria-label on the root <svg>" });
    },
  },
  {
    name: "negative/alias-label-requirement-waived",
    expect: "alias/label-requirement-waived",
    mutate: (world) => {
      world.registries.aliases.aliases = [
        {
          asset: "fx-beaker",
          equipmentIds: ["beaker-250ml", "wash-bottle"],
          rationale: "fixture",
          labelsMustStayDistinct: false,
        },
      ];
      world.realisticAssetById.set("wash-bottle", "fx-beaker");
    },
  },
  {
    name: "negative/palette-literal-colour",
    expect: "mirror/palette-literal-colour",
    mutate: (world) => {
      world.paletteModules[0].literalColours = 3;
    },
  },
  {
    name: "negative/authored-state-not-first",
    expect: "mirror/authored-state-not-first",
    mutate: (world) => {
      world.paletteModules[0].authoredBeforeFallbacks = false;
    },
  },
  {
    name: "negative/runtime-assigned-state-unregistered",
    expect: "mirror/runtime-assigned-state-unregistered",
    mutate: (world) => {
      world.runtimeAssignedVisualStates.push({
        state: "fx-unregistered-runtime-state",
        file: "fixture://reducer.ts",
      });
    },
  },
  {
    name: "negative/runtime-assigned-state-selector-missing",
    expect: "mirror/runtime-assigned-state-selector-missing",
    mutate: (world) => {
      const state = world.registries.visualStates.states.find(
        (candidate) => candidate.id === "fx-runtime-state",
      );
      state.selectors = [];
    },
  },
  {
    name: "negative/runtime-assignment-undeclared",
    expect: "mirror/runtime-assignment-undeclared",
    mutate: (world) => {
      const state = world.registries.visualStates.states.find(
        (candidate) => candidate.id === "fx-runtime-state",
      );
      delete state.runtimeAssignment;
    },
  },
  {
    // The direction that actually bit: the registry keeps saying an authored value wins after the
    // override chain is gone from the reducer.
    name: "negative/runtime-assignment-override-removed",
    expect: "mirror/runtime-assignment-mismatch",
    mutate: (world) => {
      const state = world.registries.visualStates.states.find(
        (candidate) => candidate.id === "fx-runtime-state",
      );
      state.runtimeAssignment = "default";
      world.runtimeAssignedVisualStates.find(
        (entry) => entry.state === "fx-runtime-state",
      ).overridable = false;
    },
  },
  {
    name: "negative/runtime-assignment-override-unrecorded",
    expect: "mirror/runtime-assignment-mismatch",
    mutate: (world) => {
      const state = world.registries.visualStates.states.find(
        (candidate) => candidate.id === "fx-runtime-state",
      );
      state.runtimeAssignment = "unconditional";
      world.runtimeAssignedVisualStates.find(
        (entry) => entry.state === "fx-runtime-state",
      ).overridable = true;
    },
  },
  {
    name: "negative/missing-atom-identity",
    expect: "action/atom-identity-missing",
    mutate: (world) => {
      const action = world.owners[0].definition.actions[0];
      delete action.atomId;
      delete action.equipmentRoleBindings;
    },
  },
  {
    name: "negative/missing-role-binding",
    expect: "action/role-binding-missing",
    mutate: (world) => {
      delete world.owners[0].definition.actions[0].equipmentRoleBindings["fx-vessel"];
    },
  },
  {
    name: "negative/role-binding-not-allowed",
    expect: "action/role-binding-not-allowed",
    mutate: (world) => {
      world.owners[0].definition.actions[0].equipmentRoleBindings["fx-vessel"] = "wash-bottle";
    },
  },
  {
    name: "negative/atom-interaction-not-allowed",
    expect: "action/atom-interaction-not-allowed",
    mutate: (world) => {
      world.owners[0].definition.actions[0].interaction = {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record.",
      };
      world.owners[0].definition.actions[0].verb = "observe";
      world.registries.atoms.atoms[0].verb = "observe";
    },
  },
  {
    name: "negative/invalid-interaction-operands",
    expect: "action/interaction-operand-missing",
    mutate: (world) => {
      delete world.owners[0].definition.actions[0].interaction.sourceDefinitionId;
    },
  },
  {
    name: "negative/missing-source-trace",
    expect: "action/source-trace-missing",
    mutate: (world) => {
      world.registries.sourceTrace.traces = [];
    },
  },
  {
    // The exact error this rule was added to catch: an apparatus-assembly row has no Basis column,
    // so citing one as manual-stated invents a claim the dated plan does not make.
    name: "negative/apparatus-row-cited-as-manual-stated",
    expect: "source-trace/apparatus-basis-missing-figure",
    mutate: (world) => {
      world.registries.sourceTrace.traces[0].sourceTable = "apparatus";
      world.registries.sourceTrace.traces[0].basis = "M";
    },
  },
  {
    // Two citations of one source row disagreeing on its basis means one was transcribed wrong.
    // Neither citation is invalid on its own, so only a cross-citation rule can see it.
    name: "negative/source-citation-basis-disagreement",
    expect: "source-citation/basis-disagreement",
    mutate: (world) => {
      world.registries.sourceTrace.traces[0].basis = "M/R";
    },
  },
  {
    // Two tables of one dated plan may reuse a step id; the registry has to say so first.
    name: "negative/source-citation-undeclared-cross-table-step",
    expect: "source-citation/sourceTable-disagreement",
    mutate: (world) => {
      const example = world.registries.atoms.atoms[0].sourceExamples[0];
      example.sourceTable = "safety";
      example.basis = "M/C";
    },
  },
  {
    name: "positive/source-citation-declared-cross-table-step",
    expect: null,
    mutate: (world) => {
      const example = world.registries.atoms.atoms[0].sourceExamples[0];
      example.sourceTable = "safety";
      example.basis = "M/C";
      world.registries.sourceTrace.crossTableStepIdentifiers = [{
        sourceFile: "fx-plan.md",
        step: "FX-01",
        sourceTables: ["phase", "safety"],
        rationale: "fixture",
      }];
    },
  },
  {
    // Declaring the split does not buy silence about a real disagreement inside one of the rows.
    name: "negative/source-citation-basis-disagreement-inside-declared-step",
    expect: "source-citation/basis-disagreement",
    mutate: (world) => {
      world.registries.sourceTrace.traces[0].basis = "M/R";
      world.registries.sourceTrace.crossTableStepIdentifiers = [{
        sourceFile: "fx-plan.md",
        step: "FX-01",
        sourceTables: ["phase", "safety"],
        rationale: "fixture",
      }];
    },
  },
  ...[
    ["declaration-invalid", "source-citation/cross-table-declaration-invalid"],
    // ...and the same world read the other way: the ill-formed declaration grants nothing, so the
    // split it claimed to authorise is still reported.
    ["declaration-invalid-grants-nothing", "source-citation/sourceTable-disagreement"],
  ].map(([name, expected]) => ({
    name: `negative/source-citation-cross-table-${name}`,
    expect: expected,
    mutate: (world) => {
      const example = world.registries.atoms.atoms[0].sourceExamples[0];
      example.sourceTable = "safety";
      example.basis = "M/C";
      world.registries.sourceTrace.crossTableStepIdentifiers = [{
        sourceFile: "fx-plan.md",
        step: "FX-01",
        // "procedure" is not one of the three tables the legend defines.
        sourceTables: ["phase", "procedure"],
        rationale: "fixture",
      }];
    },
  })),
  // Each malformed declaration is paired with a phase/safety citation split. The value must be
  // reported and omitted from `declaredCrossTableSteps`, so the later citation check still reports
  // `sourceTable-disagreement`; these fixtures therefore cover both no-throw and no-authorization.
  ...[
    ["outer-object", {
      sourceFile: "fx-plan.md",
      step: "FX-01",
      sourceTables: ["phase", "safety"],
      rationale: "fixture",
    }],
    ["outer-string", "not-an-array"],
    ["outer-null", null],
    ["entry-array", [["fx-plan.md", "FX-01"]]],
    ["entry-string", ["not-an-object"]],
    ["source-file-nonstring", [{
      sourceFile: 42,
      step: "FX-01",
      sourceTables: ["phase", "safety"],
      rationale: "fixture",
    }]],
    ["step-whitespace", [{
      sourceFile: "fx-plan.md",
      step: "   ",
      sourceTables: ["phase", "safety"],
      rationale: "fixture",
    }]],
    ["rationale-nonstring", [{
      sourceFile: "fx-plan.md",
      step: "FX-01",
      sourceTables: ["phase", "safety"],
      rationale: 42,
    }]],
  ].map(([name, value]) => ({
    name: `negative/source-citation-cross-table-declaration-${name}`,
    expect: "source-citation/cross-table-declaration-invalid",
    mutate: (world) => {
      const example = world.registries.atoms.atoms[0].sourceExamples[0];
      example.sourceTable = "safety";
      example.basis = "M/C";
      world.registries.sourceTrace.crossTableStepIdentifiers = value;
    },
  })),
  ...[
    ["outer-object", {
      sourceFile: "fx-plan.md",
      step: "FX-01",
      sourceTables: ["phase", "safety"],
      rationale: "fixture",
    }],
    ["rationale-nonstring", [{
      sourceFile: "fx-plan.md",
      step: "FX-01",
      sourceTables: ["phase", "safety"],
      rationale: 42,
    }]],
  ].map(([name, value]) => ({
    name: `negative/source-citation-cross-table-declaration-${name}-grants-nothing`,
    expect: "source-citation/sourceTable-disagreement",
    mutate: (world) => {
      const example = world.registries.atoms.atoms[0].sourceExamples[0];
      example.sourceTable = "safety";
      example.basis = "M/C";
      world.registries.sourceTrace.crossTableStepIdentifiers = value;
    },
  })),
  ...[
    ["declaration-duplicate", "source-citation/cross-table-declaration-duplicate"],
    // The second declaration disagrees with the first and does not replace it, so the split the
    // first one does not cover is still reported.
    ["declaration-duplicate-does-not-overwrite", "source-citation/sourceTable-disagreement"],
  ].map(([name, expected]) => ({
    name: `negative/source-citation-cross-table-${name}`,
    expect: expected,
    mutate: (world) => {
      const example = world.registries.atoms.atoms[0].sourceExamples[0];
      example.sourceTable = "safety";
      example.basis = "M/C";
      world.registries.sourceTrace.crossTableStepIdentifiers = [
        {
          sourceFile: "fx-plan.md",
          step: "FX-01",
          sourceTables: ["phase", "apparatus"],
          rationale: "fixture",
        },
        {
          sourceFile: "fx-plan.md",
          step: "FX-01",
          sourceTables: ["phase", "safety"],
          rationale: "fixture",
        },
      ];
    },
  })),
  {
    name: "negative/source-example-missing-source-table",
    expect: "registry/atom-source-example/invalid-source-table",
    mutate: (world) => {
      delete world.registries.atoms.atoms[0].sourceExamples[0].sourceTable;
    },
  },
  {
    name: "negative/source-trace-runtime-exposure",
    expect: "source-trace/runtime-exposure",
    mutate: (world) => {
      world.srcTraceReferences = ["src/fixture/leaks.ts"];
    },
  },
  {
    name: "negative/unknown-visual-state",
    expect: "visual-state/unregistered",
    mutate: (world) => {
      world.authoredVisualStates.set("fx-unknown", new Set(["lab:fx-lab"]));
    },
  },
  {
    name: "negative/unresolved-visual-state",
    expect: "visual-state/unresolved",
    mutate: (world) => {
      world.registries.visualStates.states[0].disposition = "unresolved";
      world.registries.visualStates.states[0].ownerCycle = "05";
    },
  },
  {
    name: "negative/unclassified-asset",
    expect: "asset/unclassified",
    mutate: (world) => {
      world.assetFiles.add("fx-orphan.svg");
      world.reachability.set("fx-orphan", []);
    },
  },
  {
    name: "negative/undocumented-asset-directory-entry",
    expect: "asset/undocumented-directory-entry",
    mutate: (world) => {
      world.assetDirectoryEntries.add("fx-staging-folder");
    },
  },
  {
    name: "negative/undocumented-image-alias",
    expect: "alias/undocumented-shared-asset",
    mutate: (world) => {
      world.realisticAssetById.set("wash-bottle", "fx-beaker");
    },
  },
  {
    name: "negative/composite-unknown-equipment",
    expect: "composite/unknown-equipment",
    mutate: (world) => {
      const composite = world.registries.composites.composites[0];
      composite.parentDefinitionId = "fx-missing-parent";
      composite.participants[0].definitionId = "fx-missing-parent";
      composite.participants[0].equipmentRoleId = null;
    },
  },
  {
    name: "negative/composite-recovery-undeclared",
    expect: "composite/recovery-undeclared",
    mutate: (world) => {
      world.registries.composites.composites[0].recovery = null;
    },
  },
  {
    name: "negative/technique-version-mismatch",
    expect: "technique-ref/version-mismatch",
    mutate: (world) => {
      world.owners.push({
        owner: "technique:fx-technique",
        scope: "standaloneTechnique",
        file: "fixture://technique/fx-technique.json",
        runtimeExecuted: true,
        definition: {
          id: "fx-technique",
          actions: [fixtureAction({ id: "fx-shared-action" })],
          process: { startNodeId: "n", nodes: [], edges: [] },
          metadata: { version: "2.0.0", author: "fixture", updatedAt: "2026-08-04", tags: [] },
        },
      });
      world.owners[0].definition.techniqueRefs = [
        { techniqueId: "fx-technique", version: "1.0.0", actionIds: "all" },
      ];
    },
  },
  {
    name: "negative/technique-missing-selected-action",
    expect: "technique-ref/missing-action",
    mutate: (world) => {
      world.owners.push({
        owner: "technique:fx-technique",
        scope: "standaloneTechnique",
        file: "fixture://technique/fx-technique.json",
        runtimeExecuted: true,
        definition: {
          id: "fx-technique",
          actions: [fixtureAction({ id: "fx-shared-action" })],
          process: { startNodeId: "n", nodes: [], edges: [] },
          metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-04", tags: [] },
        },
      });
      world.owners[0].definition.techniqueRefs = [
        { techniqueId: "fx-technique", version: "1.0.0", actionIds: ["fx-not-there"] },
      ];
    },
  },
  {
    name: "negative/technique-duplicate-imported-action-id",
    expect: "technique-ref/duplicate-imported-action-id",
    mutate: (world) => {
      world.owners.push({
        owner: "technique:fx-technique",
        scope: "standaloneTechnique",
        file: "fixture://technique/fx-technique.json",
        runtimeExecuted: true,
        definition: {
          id: "fx-technique",
          actions: [fixtureAction()],
          process: { startNodeId: "n", nodes: [], edges: [] },
          metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-04", tags: [] },
        },
      });
      world.owners[0].definition.techniqueRefs = [
        { techniqueId: "fx-technique", version: "1.0.0", actionIds: "all" },
      ];
    },
  },
  {
    name: "negative/unresolved-process-action-id",
    expect: "process/unresolved-action-reference",
    mutate: (world) => {
      world.owners[0].definition.process.nodes[0].actionId = "fx-missing-action";
    },
  },
  {
    // Cycle 03. Without this, migrating an unused action from `actions` into `techniqueRefs` would
    // silently retire `action/declared-but-unreferenced` for it.
    name: "negative/imported-but-unreferenced-action",
    expect: "action/imported-but-unreferenced",
    mutate: (world) => {
      pushFixtureTechnique(world, { actionIds: ["fx-shared-action"] });
    },
  },
  {
    // The rule that keeps every other rule honest: the checker cannot import TypeScript, so its
    // vocabulary is hand-copied. Drift here silently narrows everything built on it.
    name: "negative/vocabulary-mirror-drift",
    expect: "mirror/drift",
    mutate: (world) => {
      world.sourceVocabulary.actionVerbs.add("sublimate");
    },
  },
  {
    name: "negative/technique-ref-version-not-pinned",
    expect: "technique-ref/version-not-pinned",
    mutate: (world) => {
      pushFixtureTechnique(world, { actionIds: ["fx-shared-action"], version: "" });
    },
  },
  {
    name: "negative/technique-ref-empty-selection",
    expect: "technique-ref/empty-selection",
    mutate: (world) => {
      pushFixtureTechnique(world, { actionIds: [] });
    },
  },
  {
    name: "negative/technique-ref-duplicate-technique",
    expect: "technique-ref/duplicate-technique",
    mutate: (world) => {
      pushFixtureTechnique(world, { actionIds: ["fx-shared-action"] });
      world.owners[0].definition.techniqueRefs.push({
        techniqueId: "fx-technique",
        version: "1.0.0",
        actionIds: ["fx-shared-action"],
      });
    },
  },
  {
    // The dependency a reference cannot carry: an imported action needs equipment the technique
    // declares and the lab does not, so importing it alone would leave the action unusable.
    name: "negative/imported-equipment-undeclared",
    expect: "technique-ref/imported-equipment-undeclared",
    mutate: (world) => {
      pushFixtureTechnique(world, { actionIds: ["fx-shared-action"] });
      world.owners[0].definition.equipment = ["analytical-balance"];
    },
  },
  {
    name: "negative/imported-model-undeclared",
    expect: "technique-ref/imported-model-undeclared",
    mutate: (world) => {
      pushFixtureTechnique(world, {
        actionIds: ["fx-shared-action"],
        action: fixtureAction({
          id: "fx-shared-action",
          parameters: { titrationModelId: "fx-titration" },
        }),
      });
    },
  },
  {
    name: "negative/technique-ref-on-unsupported-owner",
    expect: "technique-ref/unsupported-owner",
    mutate: (world) => {
      pushFixtureTechnique(world, { actionIds: ["fx-shared-action"] });
      world.owners.push({
        owner: "lab:fx-lab/technique:fx-embedded",
        scope: "labEmbeddedTechnique",
        file: "fixture://lab/fx-lab.json",
        runtimeExecuted: false,
        definition: {
          id: "fx-embedded",
          actions: [],
          process: { startNodeId: "n", nodes: [], edges: [] },
          techniqueRefs: [
            { techniqueId: "fx-technique", version: "1.0.0", actionIds: ["fx-shared-action"] },
          ],
          metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-04", tags: [] },
        },
      });
    },
  },
  {
    name: "positive/photometer-dark-zero-selected-wavelength",
    expect: null,
    mutate: (world) => {
      appendFixtureDarkZeroAction(world);
    },
  },
  {
    // The whole exception, in one fixture: a scan read with no `requiresZeroNotebookTag`, blanked on
    // the same resolved instrument at the same wavelength reference by the per-wavelength
    // distilled-water method, is gated.
    name: "positive/photometer-scan-read-state-gated",
    expect: null,
    mutate: (world) => {
      appendFixtureScanReadActions(world);
    },
  },
  {
    // The supported fallback: neither side names an instance, so both resolve through the reducer's
    // definition fallback to the same instrument. Requiring `photometerInstanceId` here would be a
    // new mandatory field, not a reading of the runtime.
    name: "positive/photometer-scan-read-state-gated-by-definition-fallback",
    expect: null,
    mutate: (world) => {
      appendFixtureScanReadActions(world, { bindByDefinition: true });
    },
  },
  {
    // Remove the blank and the exception evaporates: nothing in the file now says this read is
    // zeroed at all, by a tag or by state.
    name: "negative/photometer-scan-read-without-blank",
    expect: "cycle06/photometer-read-ungated",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { includeBlank: false });
    },
  },
  {
    // The defect this revision fixes. Calibration is keyed by the resolved instrument, so a blank
    // on another instrument is not this read's blank -- however identical their wavelength
    // references are.
    name: "negative/photometer-scan-read-blank-on-another-instrument",
    expect: "cycle06/photometer-read-ungated",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { blankInstanceId: "fx-second-spectrophotometer" });
    },
  },
  {
    // One side explicit, the other relying on the definition fallback: whether they are the same
    // instrument depends on the bench, so the pair cannot be matched here. The read keeps its
    // existing notebook-tag requirement, which is a limit of this file and not a claim that the
    // runtime would refuse the read.
    name: "negative/photometer-scan-read-ambiguous-binding",
    expect: "cycle06/photometer-read-ungated",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { readBindsByDefinition: true });
    },
  },
  {
    // Same instrument, different wavelength reference. Both wavelengths are configured, so this
    // isolates the wavelength half of the pair.
    name: "negative/photometer-scan-read-blank-at-another-wavelength",
    expect: "cycle06/photometer-read-ungated",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { blankWavelengthId: "fx-other-scan-wavelength" });
    },
  },
  {
    // A method string the reducer does not branch on is not a calibration contract, so it may not
    // buy the exception -- and it is reported in its own right rather than passing unremarked.
    name: "negative/photometer-scan-read-unsupported-method",
    expect: "cycle06/photometer-calibration-method-unknown",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { method: "distilled-water" });
    },
  },
  {
    name: "negative/photometer-scan-read-unsupported-method-loses-exception",
    expect: "cycle06/photometer-read-ungated",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { method: "distilled-water" });
    },
  },
  {
    // A selected-wavelength configuration elsewhere in the owner does not permanently invalidate a
    // matching scan contract. This fixture includes both configurations for the same instrument and
    // wavelength reference, with the scan configuration followed by its matching blank; runtime mode,
    // ordering, reblanking and generation are outside this structural self-check.
    name: "positive/photometer-scan-read-with-other-selected-wavelength-configuration",
    expect: null,
    mutate: (world) => {
      appendFixtureScanReadActions(world, { includeOtherSelectedWavelengthConfiguration: true });
    },
  },
  ...["photometricQuantity", "wavelengthMeasurementId", "cuvetteInstanceId", "measurementId"].map((field) => ({
    // One field at a time: the exception narrows the read contract by exactly one requirement, and
    // each of the other four still has to be declared.
    name: `negative/photometer-scan-read-missing-${field}`,
    expect: "cycle06/photometer-read-ungated",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { omit: [field] });
    },
  })),
  {
    // Retained non-scan behaviour: a selected-wavelength read is still notebook-tag gated.
    name: "negative/photometer-selected-read-missing-zero-tag",
    expect: "cycle06/photometer-read-ungated",
    mutate: (world) => {
      appendFixtureScanReadActions(world, { method: "selected-wavelength-pair" });
    },
  },
  {
    name: "negative/photometer-dark-zero-selected-wavelength-ungated",
    expect: "cycle06/photometer-dark-zero-ungated",
    mutate: (world) => {
      appendFixtureDarkZeroAction(world, { includeWavelength: false });
    },
  },
  // === CYCLE 06 FIXTURES (BEGIN) ===
  ...[
    {
      name: "negative/photometric-quantity-unknown",
      expect: "cycle06/photometric-quantity-unknown",
      parameters: { photometricQuantity: "transmission" },
    },
    {
      name: "negative/photometric-unit-mismatch",
      expect: "cycle06/photometric-unit-mismatch",
      verb: "record",
      atomId: "atom.record.photometer-reading",
      parameters: { measurementId: "fx-absorbance", photometricQuantity: "absorbance", unit: "%T" },
      prerequisites: [
        {
          id: "fx-has-reading",
          type: "measurementRecorded",
          label: "read first",
          measurementId: "fx-absorbance",
        },
      ],
    },
    {
      name: "negative/photometric-mode-unknown",
      expect: "cycle06/photometric-quantity-unknown",
      verb: "observe",
      parameters: { photometricMode: "luminance" },
    },
    {
      name: "negative/photometric-quantity-on-non-storing-action",
      expect: "cycle06/photometric-quantity-on-non-storing-action",
      verb: "observe",
      parameters: { photometricQuantity: "absorbance", unit: "nm" },
    },
    {
      name: "negative/configuration-measurement-unstored",
      expect: "cycle06/configuration-measurement-unstored",
      verb: "observe",
      parameters: { configurationQuantity: "measurement wavelength" },
    },
    {
      name: "negative/photometer-wavelength-unproduced",
      expect: "cycle06/photometer-wavelength-unproduced",
      verb: "observe",
      parameters: {
        photometerOperation: "zero",
        wavelengthMeasurementId: "fx-nobody-writes-this",
        cuvetteInstanceId: "fx-cuvette-1",
      },
    },
    {
      name: "negative/photometer-read-ungated",
      expect: "cycle06/photometer-read-ungated",
      verb: "observe",
      parameters: { photometerOperation: "read", photometricQuantity: "absorbance" },
    },
    {
      name: "negative/photometer-zero-ungated",
      expect: "cycle06/photometer-zero-ungated",
      verb: "observe",
      parameters: { photometerOperation: "zero" },
    },
    {
      name: "negative/photometer-operation-unknown",
      expect: "cycle06/photometer-operation-unknown",
      verb: "observe",
      parameters: { photometerOperation: "calibrate" },
    },
    {
      name: "negative/photometer-reading-prepopulated",
      expect: "cycle06/photometer-reading-prepopulated",
      verb: "record",
      atomId: "atom.record.photometer-reading",
      parameters: { measurementId: "fx-absorbance", value: 0.19 },
      prerequisites: [
        {
          id: "fx-has-reading",
          type: "measurementRecorded",
          label: "read first",
          measurementId: "fx-absorbance",
        },
      ],
    },
    {
      name: "negative/photometer-record-without-read",
      expect: "cycle06/photometer-record-without-read",
      verb: "record",
      atomId: "atom.record.photometer-reading",
      parameters: { measurementId: "fx-absorbance" },
    },
    {
      name: "negative/transmittance-operand-confused",
      expect: "cycle06/transmittance-operand-confused",
      verb: "calculate",
      parameters: {
        template: "absorbanceFromDecimalT",
        percentTransmittanceMeasurementId: "fx-percent-t",
      },
    },
    {
      name: "negative/cuvette-slot-unbalanced",
      expect: "cycle06/cuvette-slot-unbalanced",
      verb: "place",
      atomId: "atom.place.insert-cuvette",
      parameters: { equipmentInstanceId: "fx-cuvette-1" },
    },
    {
      name: "negative/cuvette-lifecycle-unnamed",
      expect: "cycle06/cuvette-lifecycle-unnamed",
      verb: "place",
      atomId: "atom.place.remove-cuvette",
      parameters: {},
    },
  ].map(({ name, expect, verb, atomId, parameters, prerequisites }) => ({
    name,
    expect,
    // Every Cycle 06 rule fires on a declared parameter or a bound atom, so one shape covers them
    // all: a second action in the fixture lab carrying exactly the declaration under test. The atom
    // and role bindings are dropped so no unrelated rule reports first and masks the expectation.
    mutate: (world) => {
      const lab = world.owners.find((entry) => entry.owner === "lab:fx-lab");
      lab.definition.actions.push({
        id: "fx-photometer-step",
        verb: verb ?? "observe",
        label: "Photometer step",
        ...(atomId ? { atomId, equipmentRoleBindings: {} } : {}),
        parameters,
        prerequisites: prerequisites ?? [],
        stateChanges: [],
        invalidCases: [],
        feedback: { success: "ok", invalid: "no" },
        evidence: [],
      });
      lab.definition.process.nodes.push({
        id: "fx-photometer-node",
        type: "action",
        title: "Photometer step",
        description: "Photometer step",
        actionId: "fx-photometer-step",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "ok", retry: "again" },
      });
    },
  })),
  // === CYCLE 06 FIXTURES (END) ===
  // === CYCLE 10 FIXTURES (BEGIN) ===
  ...[
    {
      name: "negative/rf-without-recorded-measurement-gate",
      expect: "cycle10/rf-without-recorded-measurement-gate",
      verb: "calculate",
      parameters: { template: "chromatographyRf", calculationId: "fx-rf" },
    },
    {
      name: "negative/rf-carries-authored-distance",
      expect: "cycle10/rf-carries-authored-distance",
      verb: "calculate",
      parameters: {
        template: "chromatographyRf",
        calculationId: "fx-rf",
        requireRecordedMeasurements: true,
        solventFrontMm: 80,
      },
    },
    {
      name: "negative/recorded-distance-has-no-reading",
      expect: "cycle10/recorded-distance-has-no-reading",
      verb: "record",
      parameters: {
        measurementId: "fx-solvent-front",
        readActionId: "fx-reading-that-does-not-exist",
      },
    },
    {
      name: "negative/development-chronology-undeclared",
      expect: "cycle10/development-chronology-undeclared",
      verb: "developChromatogram",
      parameters: { sourceDefinitionId: "beaker-250ml", targetDefinitionId: "beaker-250ml" },
    },
    {
      name: "negative/recovered-mass-is-a-literal",
      expect: "cycle10/recovered-mass-is-a-literal",
      verb: "precipitate",
      parameters: {
        sourceDefinitionId: "beaker-250ml",
        targetDefinitionId: "beaker-250ml",
        precipitateSubstance: "Recovered acidic component",
        precipitateMassG: 0.15,
      },
    },
    {
      name: "negative/recovered-fraction-named-after-expected-component",
      expect: "cycle10/recovered-fraction-named-after-expected-component",
      verb: "precipitate",
      parameters: {
        sourceDefinitionId: "beaker-250ml",
        targetDefinitionId: "beaker-250ml",
        precipitateSubstance: "Recovered aspirin",
        precipitateSoluteSourceId: "fx-solute",
      },
    },
    {
      name: "negative/composition-formula-unconfirmed",
      expect: "cycle10/composition-formula-unconfirmed",
      verb: "calculate",
      parameters: {
        template: "componentMassPercent",
        calculationId: "fx-percent",
        startingMassMeasurementId: "fx-starting-mass",
      },
    },
    {
      name: "negative/composition-carries-answer-key",
      expect: "cycle10/composition-carries-answer-key",
      verb: "calculate",
      parameters: {
        template: "totalPercentRecovery",
        calculationId: "fx-recovery",
        compositionFormulaConfirmation: "component-mass-over-starting-mass",
        startingMassMeasurementId: "fx-starting-mass",
        expected: 100,
      },
    },
    {
      name: "negative/composition-without-starting-mass",
      expect: "cycle10/composition-without-starting-mass",
      verb: "calculate",
      parameters: {
        template: "componentMassPercent",
        calculationId: "fx-percent",
        compositionFormulaConfirmation: "component-mass-over-starting-mass",
      },
    },
  ].map(({ name, expect, verb, parameters }) => ({
    name,
    expect,
    mutate: (world) => {
      const lab = world.owners[0];
      lab.definition.actions.push({
        id: "fx-cycle10-step",
        verb,
        label: "Cycle 10 step",
        atomId: "atom.fx.weigh",
        equipmentRoleBindings: { "fx-balance": "analytical-balance", "fx-vessel": "beaker-250ml" },
        parameters,
        prerequisites: [],
        stateChanges: [],
        invalidCases: [],
        feedback: { success: "ok", invalid: "no" },
        evidence: [],
      });
      lab.definition.process.nodes.push({
        id: "fx-cycle10-node",
        type: "action",
        title: "Cycle 10 step",
        description: "Cycle 10 step",
        actionId: "fx-cycle10-step",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "ok", retry: "again" },
      });
    },
  })),
  // === CYCLE 10 FIXTURES (END) ===
];

const runSelfCheck = () => {
  const results = [];
  for (const fixture of FIXTURES) {
    const violations = runRules(fixtureWorld(fixture.mutate));
    const rules = new Set(violations.map((violation) => violation.rule));
    const passed = fixture.expect === null ? violations.length === 0 : rules.has(fixture.expect);
    results.push({
      name: fixture.name,
      expect: fixture.expect,
      passed,
      observed: [...rules].sort(),
    });
  }
  return results;
};

/* ------------------------------------------------------------------ *
 * Baseline comparison.
 * ------------------------------------------------------------------ */

const buildBaseline = (violations) => ({
  schema: "lab-studio/content-consistency-lint-baseline@1",
  generatedBy: "node scripts/checkContentConsistency.mjs --write-baseline",
  audit: "docs/step-and-image-consistency-audit.md",
  policy:
    "Every entry is a stable violation identifier for debt that already existed when Cycle 02 introduced the rule. Later cycles remove entries. Adding one requires an audit rationale in the same change. Entries that carry a fingerprint are exempt only while the action is unchanged: editing the action invalidates the exemption, which is how \"new or modified\" is enforced.",
  counts: {
    total: violations.length,
    byRule: violations.reduce((totals, violation) => {
      totals[violation.rule] = (totals[violation.rule] ?? 0) + 1;
      return totals;
    }, {}),
  },
  entries: violations.map((violation) => ({
    id: violation.id,
    rule: violation.rule,
    evidence: violation.evidence,
    ...(violation.fingerprint ? { fingerprint: violation.fingerprint } : {}),
    ...(violation.ownerCycle ? { ownerCycle: violation.ownerCycle } : {}),
  })),
});

const compareToBaseline = (violations, routedViolationIds = new Set()) => {
  if (!existsSync(join(root, BASELINE_PATH))) {
    return { missingBaseline: true, added: violations, resolved: [], changed: [] };
  }
  const baseline = readJson(BASELINE_PATH);
  const byId = new Map(baseline.entries.map((entry) => [entry.id, entry]));
  const seen = new Set();
  const added = [];
  const changed = [];
  for (const violation of violations) {
    const entry = byId.get(violation.id);
    if (!entry) {
      added.push(violation);
      continue;
    }
    seen.add(violation.id);
    if (entry.fingerprint && violation.fingerprint && entry.fingerprint !== violation.fingerprint) {
      changed.push({ ...violation, baselineFingerprint: entry.fingerprint });
    }
  }
  const routed = baseline.entries
    .filter((entry) => routedViolationIds.has(entry.id))
    .map((entry) => entry.id);
  const resolved = baseline.entries
    .filter((entry) => !seen.has(entry.id) && !routedViolationIds.has(entry.id))
    .map((entry) => entry.id);
  return { missingBaseline: false, added, resolved, changed, routed };
};

/* ------------------------------------------------------------------ *
 * Entry point.
 * ------------------------------------------------------------------ */

const selfCheck = runSelfCheck();
const selfCheckFailures = selfCheck.filter((result) => !result.passed);

const world = buildRepositoryWorld();
const rawViolations = runRules(world);

if (argv.has("--write-docs")) {
  writeFileSync(join(root, DOCS_PATH), renderDocs(world.registries));
  console.log(`wrote ${DOCS_PATH}`);
}

if (argv.has("--print-docs")) {
  process.stdout.write(renderDocs(world.registries));
  process.exit(selfCheckFailures.length ? 1 : 0);
}

if (argv.has("--write-baseline")) {
  // The baseline tracks only the stable raw/template rule engine. Compiled findings carry their own
  // authoring/context identities and must not be folded into this historical raw baseline.
  const baseline = buildBaseline(rawViolations);
  writeFileSync(join(root, BASELINE_PATH), `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`wrote ${BASELINE_PATH}`);
  console.log(JSON.stringify(baseline.counts, null, 2));
  process.exit(selfCheckFailures.length ? 1 : 0);
}

let compiledDiagnostics = null;
let routedRawViolations = [];
let retainedRawCompositionViolations = [];
let rawViolationDispositions = new Map();
if (argv.has("--compiled")) {
  const { runCompiledContentDiagnostics } = await import("./compiledContentDiagnostics.mjs");
  const { rawCompositionRoutingDisposition } = await import("../src/data/compiledWitnessDiagnostics.ts");
  compiledDiagnostics = await runCompiledContentDiagnostics({ root });
  const routingRows = rawViolations.map((violation) => ({
    violation,
    disposition: rawCompositionRoutingDisposition(violation, compiledDiagnostics.routing),
  }));
  rawViolationDispositions = new Map(routingRows.map(({ violation, disposition }) => [violation.id, disposition]));
  routedRawViolations = routingRows
    .filter(({ disposition }) => disposition.routeToCompiledContexts)
    .map(({ violation }) => violation);
  retainedRawCompositionViolations = routingRows
    .filter(({ disposition }) =>
      !disposition.routeToCompiledContexts && disposition.evaluationScope !== "raw-template-rule",
    )
    .map(({ violation, disposition }) => ({
      id: violation.id,
      rule: violation.rule,
      scope: violation.scope,
      evaluationScope: disposition.evaluationScope,
      detail: disposition.detail,
    }));
}
const routedRawViolationIds = new Set(routedRawViolations.map((violation) => violation.id));
const violations = rawViolations.filter((violation) => !routedRawViolationIds.has(violation.id));
const retainedRawFindings = violations.map((violation) => {
  const disposition = rawViolationDispositions.get(violation.id) ?? {
    evaluationScope: "raw-template-rule",
    detail: "This invocation retained the finding on the raw/template diagnostic path.",
  };
  return {
    id: violation.id,
    rule: violation.rule,
    scope: violation.scope,
    evidence: violation.evidence,
    evaluationScope: disposition.evaluationScope,
    detail: disposition.detail,
  };
});
const comparison = compareToBaseline(violations, routedRawViolationIds);
const expectedDocs = renderDocs(world.registries);
const actualDocs = existsSync(join(root, DOCS_PATH)) ? readText(DOCS_PATH) : null;
const docsStale = actualDocs !== expectedDocs;
const compiledIntegrityFailures = compiledDiagnostics?.statuses.filter((record) =>
  ["compile-failed", "unsupported-setup", "unresolved-template", "unresolved-origin", "unrepresented-configuration"].includes(record.status),
) ?? [];
const compiledFindingFailures = compiledDiagnostics?.findings.contexts ?? [];
const catalogPolicyFailureCount = compiledDiagnostics?.catalogPolicy?.failureCount ?? 0;

const result = {
  selfCheck: {
    total: selfCheck.length,
    failed: selfCheckFailures.length,
    failures: selfCheckFailures,
  },
  registries: {
    atoms: world.registries.atoms.atoms.length,
    roles: world.registries.roles.roles.length,
    visualStates: world.registries.visualStates.states.length,
    composites: world.registries.composites.composites.length,
    assets: world.registries.assets.assets.length,
    imageAliases: world.registries.aliases.aliases.length,
    sourceTraces: world.registries.sourceTrace.traces.length,
  },
  violations: {
    evaluationScope: compiledDiagnostics
      ? "raw/template findings after conservative compiled-context routing"
      : "raw/template findings only",
    total: violations.length,
    byRule: violations.reduce((totals, violation) => {
      totals[violation.rule] = (totals[violation.rule] ?? 0) + 1;
      return totals;
    }, {}),
    retainedFindings: retainedRawFindings,
    retainedCompositionFindings: retainedRawCompositionViolations,
  },
  baseline: {
    missing: comparison.missingBaseline,
    added: comparison.added.map((violation) => violation.id),
    changedFingerprint: comparison.changed.map((violation) => violation.id),
    resolved: comparison.resolved,
    routedToCompiledContexts: comparison.routed ?? [],
  },
  compositionDiagnostics: compiledDiagnostics
    ? {
      mode: "compiled-contexts",
      rawViolationsRouted: routedRawViolations.map((violation) => violation.id),
      integrityFailureCount: compiledIntegrityFailures.length,
      findingFailureCount: compiledFindingFailures.length,
      catalogPolicyFailureCount,
      result: compiledDiagnostics,
    }
    : {
      mode: "raw-template-only",
      detail: "No compiled contexts were requested. Use the maintained content:check command for composition-aware diagnostics.",
    },
  documentation: { path: DOCS_PATH, upToDate: !docsStale },
};

const failed =
  selfCheckFailures.length > 0 ||
  comparison.missingBaseline ||
  comparison.added.length > 0 ||
  comparison.changed.length > 0 ||
  compiledIntegrityFailures.length > 0 ||
  compiledFindingFailures.length > 0 ||
  catalogPolicyFailureCount > 0 ||
  docsStale;

if (argv.has("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`self-fixtures: ${selfCheck.length - selfCheckFailures.length}/${selfCheck.length} passed`);
  for (const failure of selfCheckFailures) {
    console.log(`  FAIL ${failure.name} expected ${failure.expect}`);
  }
  console.log(
    `registries: ${result.registries.atoms} atoms, ${result.registries.roles} roles, ` +
      `${result.registries.visualStates} visual states, ${result.registries.composites} composites, ` +
      `${result.registries.assets} assets, ${result.registries.imageAliases} image aliases, ` +
      `${result.registries.sourceTraces} source traces`,
  );
  console.log(`violations: ${violations.length}`);
  for (const [rule, count] of Object.entries(result.violations.byRule).sort()) {
    console.log(`  ${rule}: ${count}`);
  }
  if (comparison.missingBaseline) {
    console.log(`baseline missing: run --write-baseline`);
  } else {
    console.log(
      `baseline: ${comparison.added.length} new, ${comparison.changed.length} changed fingerprint, ` +
        `${comparison.resolved.length} resolved`,
    );
    for (const violation of comparison.added.slice(0, displayLimit)) console.log(`  NEW ${violation.id}`);
    if (comparison.added.length > displayLimit) {
      console.log(
        `  ${comparison.added.length - displayLimit} additional NEW entries omitted; ` +
          `rerun with --json or a larger --limit=N for the complete list.`,
      );
    }
    for (const violation of comparison.changed.slice(0, displayLimit)) {
      console.log(`  CHANGED ${violation.id} (baselined action was edited without adding an atom identity)`);
    }
    if (comparison.changed.length > displayLimit) {
      console.log(
        `  ${comparison.changed.length - displayLimit} additional CHANGED entries omitted; ` +
          `rerun with --json or a larger --limit=N for the complete list.`,
      );
    }
  }
  if (compiledDiagnostics) {
    const counts = compiledDiagnostics.findings.counts;
    console.log(
      `compiled witness contexts: ${compiledDiagnostics.coverage.compiledContextCount}/${compiledDiagnostics.coverage.attemptedContextCount} attempted, ` +
      `${compiledDiagnostics.coverage.evaluatedNodeContextCount} evaluated node contexts, ` +
      `${counts.uniqueRawAuthoringFindings} unique raw authoring findings, ${counts.uniqueCompiledContextFindings} context findings`,
    );
    console.log(
      `  bundled catalog policy (${compiledDiagnostics.catalogPolicy.evaluationMode}): ${compiledDiagnostics.catalogPolicy.raw.transitionFindings.length} transition-allowed existing findings, ` +
      `${compiledDiagnostics.catalogPolicy.failureCount} blocking or stale finding(s)`,
    );
    console.log(`  raw composition findings routed: ${routedRawViolations.length}`);
    console.log(`  raw composition findings retained with explicit scope: ${retainedRawCompositionViolations.length}`);
    for (const [status, count] of Object.entries(compiledDiagnostics.coverage.byStatus).sort()) {
      console.log(`  ${status}: ${count}`);
    }
    for (const probe of compiledDiagnostics.probes) {
      console.log(`  probe ${probe.id}: ${probe.status}, ${probe.evaluatedContextCount} contexts, ${probe.staticFindingCount} static findings`);
    }
    if (compiledIntegrityFailures.length > 0) {
      console.log(`  compiled integrity failures: ${compiledIntegrityFailures.length}`);
    }
    if (compiledFindingFailures.length > 0) {
      console.log(`  compiled finding failures: ${compiledFindingFailures.length}`);
    }
  } else {
    console.log("compiled contexts: not requested (raw/template-only invocation)");
  }
  console.log(`documentation ${DOCS_PATH}: ${docsStale ? "STALE — run --write-docs" : "up to date"}`);
}

process.exit(failed ? 1 : 0);
