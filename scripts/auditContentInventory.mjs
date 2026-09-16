/**
 * Cycle 01 read-only content inventory for the atomic-step and equipment fidelity remediation.
 *
 * The script never writes repository content. It only reads public lab/technique JSON plus a
 * small number of source files, and prints a machine-readable report. `--write-baseline` is the
 * one exception: it writes the baseline file that later cycles shrink.
 *
 * Usage:
 *   node scripts/auditContentInventory.mjs                 # summary JSON
 *   node scripts/auditContentInventory.mjs --full          # full report JSON
 *   node scripts/auditContentInventory.mjs --write-baseline
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = new Set(process.argv.slice(2));

const readText = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const listFiles = (relativePath) => readdirSync(join(root, relativePath));

/* ------------------------------------------------------------------ *
 * Normalization algorithms (documented in
 * docs/step-and-image-consistency-audit.md; keep the two in sync).
 * ------------------------------------------------------------------ */

/** Recursively sorts object keys and preserves array order. */
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
};

const keyWithout = (record, omitted) => {
  const copy = { ...record };
  for (const field of omitted) delete copy[field];
  return JSON.stringify(canonical(copy));
};

/** Node normalizations. `semantic` drops identity plus the named presentation fields only. */
const NODE_NORMALIZATIONS = {
  exactWithId: [],
  exactWithoutId: ["id"],
  semantic: ["id", "title", "description", "hints", "feedback", "layout"],
};

/** Action normalizations. `semantic` drops identity plus learner-facing wording only. */
const ACTION_NORMALIZATIONS = {
  exactWithId: [],
  exactWithoutId: ["id"],
  semantic: ["id", "label", "feedback"],
};

const duplicateReport = (records, normalizations, pick) => {
  const report = {};
  for (const [name, omitted] of Object.entries(normalizations)) {
    const distinct = new Set(records.map((record) => keyWithout(pick(record), omitted)));
    report[name] = {
      total: records.length,
      distinct: distinct.size,
      repeats: records.length - distinct.size,
      omittedFields: omitted,
    };
  }
  return report;
};

/* ------------------------------------------------------------------ *
 * 1. Catalog inventory: indexed entries vs files on disk.
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

const inventoryFolder = (folder) => {
  const index = readJson(`public/${folder}/index.json`);
  const files = listFiles(`public/${folder}`).filter(
    (file) => file.endsWith(".json") && file !== "index.json",
  );

  const indexedFiles = new Set(index.map((entry) => entry.file ?? `${entry.id}.json`));
  const definitionFiles = [];
  const nonDefinitionFiles = [];
  for (const file of files) {
    const value = readJson(`public/${folder}/${file}`);
    (isDefinitionShape(value, folder) ? definitionFiles : nonDefinitionFiles).push(file);
  }

  return {
    indexEntries: index.length,
    indexIds: index.map((entry) => entry.id),
    filesOnDisk: files.length,
    definitionFiles: definitionFiles.length,
    indexedMissingFile: index
      .filter((entry) => !files.includes(entry.file ?? `${entry.id}.json`))
      .map((entry) => entry.id),
    unindexedDefinitionFiles: definitionFiles.filter((file) => !indexedFiles.has(file)),
    nonDefinitionFiles,
  };
};

/* ------------------------------------------------------------------ *
 * 2. Owner model.
 *
 * A definition "owner" is one of:
 *   lab:<id>                      root process + root actions (the only lab scope the runtime executes)
 *   lab:<id>/technique:<tid>      technique embedded inside a lab file
 *   technique:<id>                standalone public technique file
 * ------------------------------------------------------------------ */

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

const nodesOf = (definition) => definition.process?.nodes ?? [];
const actionsOf = (definition) => definition.actions ?? [];

/* ------------------------------------------------------------------ *
 * 3. Interaction classification.
 * ------------------------------------------------------------------ */

const PHYSICAL_VERBS = new Set([
  "place",
  "weigh",
  "measureVolume",
  "transfer",
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

/** Interaction types that record evidence rather than manipulate apparatus. */
const SEMANTIC_INTERACTION_TYPES = new Set(["recordNotebook", "submitCalculation"]);

/**
 * Faithful mirror of `requiresSource` and `requiresTarget` in
 * src/runtime/interactionIntents.ts:258-278. Do not add requirements the runtime does not make.
 *
 * Notes the runtime imposes, and this audit must not contradict:
 * - `pourInto` does NOT require an authored source; only a target.
 * - `dragToZone` does NOT require a target; it targets a snap zone or a station.
 * - `readInstrument` requires a source, and requires a target only when `targetDefinitionId` is
 *   already present — so it can never be a target gap.
 * - A snap zone is optional everywhere. `interactionIntents.ts:499-500` only checks
 *   `if (snapZone && ...)`, so a missing `snapZoneId` is not an operand gap. Zone and station
 *   presence is reported as coverage, never as a requirement.
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

/** A value counts as present unless it is absent or blank; `0` and `false` are present. */
const present = (value) => value !== undefined && value !== null && value !== "";

const firstPresent = (...values) => values.find(present);

/**
 * Authored operand resolution, matching `expectedSourceDefinitionId` /
 * `expectedTargetDefinitionId` in interactionIntents.ts:443-449. Note the third source fallback
 * onto `parameters.equipmentDefinitionId`, which a naive check misses.
 */
const authoredSourceDefinitionId = (action) =>
  firstPresent(
    action.interaction?.sourceDefinitionId,
    action.parameters?.sourceDefinitionId,
    action.parameters?.equipmentDefinitionId,
  );

const authoredTargetDefinitionId = (action) =>
  firstPresent(action.interaction?.targetDefinitionId, action.parameters?.targetDefinitionId);

const authoredZoneOrStation = (action) =>
  firstPresent(
    action.interaction?.snapZoneId,
    action.parameters?.snapZoneId,
    action.interaction?.stationId,
    action.parameters?.stationId,
  );

/* ------------------------------------------------------------------ *
 * 4. Visual state and asset extraction.
 * ------------------------------------------------------------------ */

/**
 * Any key ending in `visualState` carries a single state id; `visualStateChoices` carries a list.
 * Both forms are authored in public content today.
 */
const isVisualStateKey = (key) => /[Vv]isualState$/.test(key);
const VISUAL_STATE_LIST_KEYS = new Set(["visualStateChoices"]);

const collectAuthoredVisualStates = (owners) => {
  const states = new Map();
  const record = (state, source) => {
    if (typeof state !== "string" || !state) return;
    if (!states.has(state)) states.set(state, new Set());
    states.get(state).add(source);
  };
  const walk = (value, source, skipKeys) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, source, skipKeys);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (skipKeys?.has(key)) continue;
      if (isVisualStateKey(key)) record(child, source);
      else if (VISUAL_STATE_LIST_KEYS.has(key) && Array.isArray(child)) {
        for (const item of child) record(item, source);
      } else walk(child, source, skipKeys);
    }
  };
  // A lab root must not be credited with states its embedded techniques author. Those techniques
  // are walked as their own owners, so descending into lab.techniques here would attribute the
  // same state to two owners and make the evidence trail wrong.
  const labRootSkip = new Set(["techniques"]);
  for (const entry of owners) {
    walk(entry.definition, entry.owner, entry.scope === "labRoot" ? labRootSkip : undefined);
  }
  return states;
};

/**
 * The palette lived in `styles.ts` until Cycle 05 moved it into the visual-state registry, where each
 * colour carries a disposition and a provenance sentence. Read it from there: parsing the TypeScript
 * would now find nothing and silently report every authored state as unstyled.
 */
const readVisualStateRegistry = () => readJson("src/equipment/visualStateRegistry.json");

const parseStyledStates = (registry) => ({
  liquid: new Set(
    registry.states.filter((s) => s.disposition === "liquid-style").map((s) => s.renderStyleKey ?? s.id),
  ),
  solid: new Set(registry.states.filter((s) => s.disposition === "solid-style").map((s) => s.id)),
});

/**
 * Mirrors the precedence in src/equipment/liquidRendering/styles.ts `resolveLiquidStyle`.
 * Returns the style key the renderer actually uses for an authored instance, so authored
 * `visualState` values that lose to a heuristic can be listed with evidence.
 */
const parseReagentBottleLabels = () => {
  const source = readText("src/equipment/catalog.ts");
  const catalogBlock = source.slice(
    source.indexOf("export const v1EquipmentCatalog"),
    source.indexOf("export const equipmentById"),
  );
  return Object.fromEntries(
    [...catalogBlock.matchAll(/equipment\(\s*"([a-z0-9-]+)",\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
};

/** The reagent and container fallback tables, read from the registry that now owns them. */
const parseFallbacks = (registry) => {
  const fallbacks = registry.fallbacks ?? {};
  return {
    definitionIdStates: Object.fromEntries(
      (fallbacks.definitionIdStates ?? []).map((entry) => [entry.definitionId, entry.state]),
    ),
    reagentKeywordStates: fallbacks.reagentKeywordStates ?? [],
    defaultLiquidState: fallbacks.defaultLiquidState,
  };
};

const normalizeReagentKey = (label, reagentKeywordStates) => {
  const value = (label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!value) return undefined;
  for (const entry of reagentKeywordStates) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) return entry.state;
  }
  return undefined;
};

/**
 * Cycle 05 inverted this precedence. An authored state the registry can render now wins outright; the
 * container and reagent tables apply only when no state is authored, or when the authored state is
 * registered `nonvisual`. An authored state the registry cannot render falls to the default rather
 * than to a heuristic, so this function can still show which authored states lose their appearance —
 * it is just that none of them lose it to a *heuristic* any more.
 */
const resolveStyleKey = (definitionId, contents, styled, equipmentLabels, fallbacks, registryById) => {
  const visualKey = contents.visualState ?? "";
  const label = contents.label ?? "";
  const entry = registryById.get(visualKey);
  if (entry?.disposition === "liquid-style") return entry.renderStyleKey ?? entry.id;
  if (entry?.disposition === "solid-style") return entry.id;
  // Any other authored state — unresolved, unregistered, or state-asset — blocks the fallbacks.
  if (visualKey && entry?.disposition !== "nonvisual") return fallbacks.defaultLiquidState;

  const override = fallbacks.definitionIdStates[definitionId];
  if (override && styled.liquid.has(override)) return override;
  const reagentKey = normalizeReagentKey(
    `${equipmentLabels[definitionId] ?? ""} ${label}`,
    fallbacks.reagentKeywordStates,
  );
  if (reagentKey && styled.liquid.has(reagentKey)) return reagentKey;
  return fallbacks.defaultLiquidState;
};

const collectVisualStateOverrides = (owners, styled, registry) => {
  const equipmentLabels = parseReagentBottleLabels();
  const fallbacks = parseFallbacks(registry);
  const registryById = new Map(registry.states.map((state) => [state.id, state]));
  const overrides = [];
  for (const entry of owners) {
    for (const instance of entry.definition.initialState?.equipment ?? []) {
      const contents = instance.contents ?? {};
      const authored = contents.visualState;
      if (!authored || !(styled.liquid.has(authored) || styled.solid.has(authored))) continue;
      const resolved = resolveStyleKey(
        instance.definitionId,
        contents,
        styled,
        equipmentLabels,
        fallbacks,
        registryById,
      );
      if (resolved === authored) continue;
      overrides.push({
        owner: entry.owner,
        runtimeExecuted: entry.runtimeExecuted,
        instanceId: instance.id,
        definitionId: instance.definitionId,
        authoredVisualState: authored,
        renderedStyleKey: resolved,
        contentLabel: contents.label ?? "",
        reason: fallbacks.definitionIdStates[instance.definitionId]
          ? "definition-id override"
          : "label reagent heuristic",
      });
    }
  }
  return overrides;
};

const parseStateAssets = () => {
  const source = readText("src/equipment/visualCatalog.ts");
  const states = {};
  const stateAssetAssetNames = new Set();
  // The only stateAssets map today is generated: CAL-00..CAL-12 for hand-warmer-calorimeter.
  const generated = source.match(
    /handWarmerCalorimeterStateAssets = Object\.fromEntries\(\s*Array\.from\(\{ length: (\d+) \}/,
  );
  if (generated) {
    const count = Number(generated[1]);
    states["hand-warmer-calorimeter"] = Array.from({ length: count }, (_, index) =>
      `CAL-${String(index).padStart(2, "0")}`,
    );
    for (const state of states["hand-warmer-calorimeter"]) {
      stateAssetAssetNames.add(`hand-warmer-calorimeter-${state.toLowerCase()}`);
    }
  }
  // Cycle 11 added an inline stateAssets object for the realistic Luer-lock syringe. Keep the
  // inventory parser aligned with the content checker: the state id establishes reachability, while
  // the asset() argument is the realistic-asset basename whose disposition must become visual-catalog.
  for (const match of source.matchAll(/stateAssets:\s*\{([\s\S]*?)\n\s*\},/g)) {
    const profileMatches = [
      ...source.slice(0, match.index).matchAll(/"([^"]+)":\s*profile\(/g),
    ];
    const definitionId = profileMatches.at(-1)?.[1];
    if (!definitionId) continue;
    const entries = [...match[1].matchAll(/"([^"]+)":\s*asset\("([^"]+)"\)/g)];
    if (entries.length === 0) continue;
    states[definitionId] = entries.map((entry) => entry[1]);
    for (const entry of entries) stateAssetAssetNames.add(entry[2]);
  }
  // `stateAssets: options.stateAssets` inside the shared `profile()` helper is plumbing, not a
  // binding. Only named maps count as real state-asset registrations.
  const stateAssetBindings = [
    ...new Set(
      [...source.matchAll(/stateAssets:\s*([A-Za-z0-9_]+)\s*,/g)]
        .map((match) => match[1])
        .filter((name) => name !== "options"),
    ),
  ];
  return { states, stateAssetBindings, stateAssetAssetNames };
};

const REALISTIC_DIR = "public/assets/equipment-realistic/v1";

const collectAssetReferences = (relativePath, assetBaseNames) => {
  const source = readText(relativePath);
  const found = new Set();
  for (const match of source.matchAll(/assets\/equipment-realistic\/v1\/([A-Za-z0-9._-]+)\.(svg|png)/g)) {
    found.add(match[1]);
  }
  // Investigation and gallery modules build paths through helpers, so also accept bare
  // "<known-asset>.svg" / "<known-asset>.png" string literals.
  for (const match of source.matchAll(/["'`]([A-Za-z0-9._-]+)\.(svg|png)["'`]/g)) {
    if (assetBaseNames.has(match[1])) found.add(match[1]);
  }
  return found;
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

const parseEquipmentAssetMap = () => {
  const source = readText("src/equipment/catalog.ts");
  const mapBlock = source.slice(
    source.indexOf("const realisticAssetById"),
    source.indexOf("export const publicAssetPath"),
  );
  const map = Object.fromEntries(
    [...mapBlock.matchAll(/"([a-z0-9-]+)":\s*"([a-z0-9-]*)"/g)].map((m) => [m[1], m[2]]),
  );
  const catalogBlock = source.slice(
    source.indexOf("export const v1EquipmentCatalog"),
    source.indexOf("export const equipmentById"),
  );
  const equipmentIds = [...catalogBlock.matchAll(/equipment\(\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  return { map, equipmentIds };
};

/* ------------------------------------------------------------------ *
 * 5. Composite mechanisms.
 *
 * Cycle 02 declared the six hard-coded EquipmentView.tsx branches here as data and verified each
 * against the source text. Cycle 05 deleted the branches: src/equipment/compositeRegistry.json is now
 * the source and src/equipment/composites.ts the only evaluator, so this section reads the registry
 * and verifies the opposite property — that neither the renderer nor the reducer recognises a
 * composite on its own.
 * ------------------------------------------------------------------ */

const COMPOSITE_CONSUMERS = [
  { file: "src/player/EquipmentView.tsx", callsEvaluator: "evaluateCompositeScene" },
  { file: "src/runtime/reducer.ts", callsEvaluator: "instanceSwapCompositeFor" },
];

const verifyComposites = () => {
  const registry = readJson("src/equipment/compositeRegistry.json");
  const renderer = readText("src/player/EquipmentView.tsx");
  return registry.composites.map((composite) => ({
    id: composite.id,
    kind: composite.kind,
    parent: composite.parentDefinitionId,
    children: composite.participants
      .filter((participant) => !participant.parent)
      .map((participant) => participant.definitionId),
    requiresSnapZone: composite.participants
      .filter((participant) => !participant.parent)
      .map((participant) => participant.snapZoneId),
    resultAsset: composite.resultAsset,
    resultInstanceDefinitionId: composite.resultInstanceDefinitionId,
    suppressesChildren: composite.participants.some((participant) => participant.suppressed),
    extraOverlay: composite.extraOverlay,
    // The Cycle 02 field, inverted: a composite is correctly *absent* from the renderer source.
    verifiedInSource: !renderer.includes(`${composite.resultAsset}.svg`),
    unverifiedMarkers: renderer.includes(`${composite.resultAsset}.svg`)
      ? [`${composite.resultAsset}.svg reappeared in src/player/EquipmentView.tsx`]
      : [],
  }));
};

const verifyCompositeConsumers = () =>
  COMPOSITE_CONSUMERS.map(({ file, callsEvaluator }) => ({
    file,
    callsEvaluator,
    consumesEvaluator: readText(file).includes(callsEvaluator),
  }));

/** Asset-selection precedence, read from the registry that now declares it. */
const rendererPrecedence = () =>
  readJson("src/equipment/compositeRegistry.json").rendererPrecedence;

/* ------------------------------------------------------------------ *
 * Report assembly.
 * ------------------------------------------------------------------ */

const buildReport = () => {
  const owners = collectOwners();

  const nodeRecords = [];
  const actionRecords = [];
  for (const entry of owners) {
    for (const node of nodesOf(entry.definition)) nodeRecords.push({ ...entry, node });
    for (const action of actionsOf(entry.definition)) actionRecords.push({ ...entry, action });
  }

  const countByScope = (records) =>
    records.reduce((totals, record) => {
      totals[record.scope] = (totals[record.scope] ?? 0) + 1;
      return totals;
    }, {});

  /* --- duplicate groups by owner set (exactWithId) --- */
  const groupOwnerSets = (records, pick) => {
    const groups = new Map();
    for (const record of records) {
      const key = keyWithout(pick(record), []);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record.owner);
    }
    const ownerSets = new Map();
    let repeatsWithinOneOwner = 0;
    for (const ownerList of groups.values()) {
      if (ownerList.length < 2) continue;
      const unique = [...new Set(ownerList)].sort();
      if (unique.length === 1) {
        repeatsWithinOneOwner += ownerList.length - 1;
        continue;
      }
      const key = unique.join(" || ");
      ownerSets.set(key, (ownerSets.get(key) ?? 0) + ownerList.length - 1);
    }
    return {
      repeatsWithinOneOwner,
      ownerSets: [...ownerSets.entries()]
        .map(([owners, repeats]) => ({ owners: owners.split(" || "), repeats }))
        .sort((a, b) => b.repeats - a.repeats),
    };
  };

  /* --- action id collisions --- */
  const actionsById = new Map();
  for (const record of actionRecords) {
    if (!actionsById.has(record.action.id)) actionsById.set(record.action.id, []);
    actionsById.get(record.action.id).push(record);
  }
  const actionIdCollisions = [];
  let actionIdsSharedIdentically = 0;
  for (const [id, records] of actionsById) {
    if (records.length < 2) continue;
    const variants = new Set(records.map((record) => keyWithout(record.action, [])));
    if (variants.size === 1) {
      actionIdsSharedIdentically += 1;
      continue;
    }
    actionIdCollisions.push({
      actionId: id,
      variants: variants.size,
      owners: [...new Set(records.map((record) => record.owner))].sort(),
    });
  }
  actionIdCollisions.sort((a, b) => a.actionId.localeCompare(b.actionId));

  /* --- node id collisions inside one owner and inside one lab file --- */
  const nodeIdCollisionsWithinOwner = [];
  const nodeIdCollisionsWithinLabFile = [];
  const byOwner = new Map();
  for (const record of nodeRecords) {
    if (!byOwner.has(record.owner)) byOwner.set(record.owner, []);
    byOwner.get(record.owner).push(record.node);
  }
  for (const [owner, nodes] of byOwner) {
    const seen = new Map();
    for (const node of nodes) seen.set(node.id, (seen.get(node.id) ?? 0) + 1);
    const repeated = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    if (repeated.length) nodeIdCollisionsWithinOwner.push({ owner, nodeIds: repeated });
  }
  for (const entry of owners.filter((candidate) => candidate.scope === "labRoot")) {
    const rootNodes = new Map(nodesOf(entry.definition).map((node) => [node.id, node]));
    for (const technique of entry.definition.techniques) {
      const conflicts = nodesOf(technique)
        .filter((node) => rootNodes.has(node.id))
        .filter((node) => keyWithout(node, []) !== keyWithout(rootNodes.get(node.id), []))
        .map((node) => node.id);
      if (conflicts.length) {
        nodeIdCollisionsWithinLabFile.push({
          lab: entry.owner,
          embeddedTechnique: technique.id,
          nodeIds: conflicts,
        });
      }
    }
  }

  const standaloneById = new Map(
    owners
      .filter((entry) => entry.scope === "standaloneTechnique")
      .map((entry) => [entry.definition.id, entry.definition]),
  );

  /* --- process -> action resolution and unused actions --- */
  // Since Cycle 03 a lab may import actions through version-pinned `techniqueRefs` instead of
  // declaring them, so a node referencing an imported action is resolved, not unresolved. Selection
  // is read permissively here (a bad version still contributes its ids); the content checker owns
  // reporting the reference itself as broken.
  const importedActionIds = (definition) => {
    const ids = new Set();
    for (const ref of definition.techniqueRefs ?? []) {
      const technique = standaloneById.get(ref.techniqueId);
      if (ref.actionIds === "all") {
        for (const action of actionsOf(technique ?? {})) ids.add(action.id);
      } else {
        for (const actionId of ref.actionIds ?? []) ids.add(actionId);
      }
    }
    return ids;
  };

  const unresolvedActionRefs = [];
  const unusedActions = [];
  const unusedImportedActions = [];
  for (const entry of owners) {
    const declared = new Set(actionsOf(entry.definition).map((action) => action.id));
    const imported = importedActionIds(entry.definition);
    const used = new Set();
    for (const node of nodesOf(entry.definition)) {
      if (!node.actionId) continue;
      used.add(node.actionId);
      if (!declared.has(node.actionId) && !imported.has(node.actionId)) {
        unresolvedActionRefs.push({ owner: entry.owner, nodeId: node.id, actionId: node.actionId });
      }
    }
    const dead = [...declared].filter((id) => !used.has(id));
    if (dead.length) unusedActions.push({ owner: entry.owner, actionIds: dead.sort() });
    const deadImports = [...imported].filter((id) => !declared.has(id) && !used.has(id));
    if (deadImports.length) {
      unusedImportedActions.push({ owner: entry.owner, actionIds: deadImports.sort() });
    }
  }

  /* --- embedded technique relationship to root and to standalone --- */
  const embeddedTechniques = [];
  for (const entry of owners.filter((candidate) => candidate.scope === "labRoot")) {
    const rootKeys = new Set(nodesOf(entry.definition).map((node) => keyWithout(node, [])));
    for (const technique of entry.definition.techniques) {
      const nodes = nodesOf(technique);
      const standalone = standaloneById.get(technique.id);
      const standaloneKeys = standalone
        ? new Set(nodesOf(standalone).map((node) => keyWithout(node, [])))
        : undefined;
      const identicalToRoot = nodes.filter((node) => rootKeys.has(keyWithout(node, []))).length;

      // The runtime payload an embedded technique really contributes. A migration may delete its
      // process and actions freely, but deleting a *consumed* payload changes player behaviour.
      const runtimePayload = [];
      const shadowedPayload = [];
      if ((technique.initialState?.equipment ?? []).length > 0) {
        // Only consumed when the lab itself has no initialState (createRuntime.ts:56-78).
        (entry.definition.initialState?.equipment ? shadowedPayload : runtimePayload).push(
          "initialState.equipment",
        );
      }
      for (const modelKey of ["titrationModels", "chromatographyModels", "kineticsModels"]) {
        if ((technique[modelKey] ?? []).length > 0) runtimePayload.push(modelKey);
      }

      const role = !standalone
        ? "lab-local-state-carrier"
        : nodes.length > 0 && identicalToRoot === nodes.length
          ? "root-identical-copy"
          : identicalToRoot === 0
            ? "root-divergent-copy"
            : "partial-root-overlap";

      embeddedTechniques.push({
        lab: entry.definition.id,
        techniqueId: technique.id,
        role,
        runtimePayload,
        shadowedPayload,
        nodes: nodes.length,
        actions: actionsOf(technique).length,
        nodesIdenticalToLabRoot: identicalToRoot,
        standaloneExists: Boolean(standalone),
        standaloneNodes: standalone ? nodesOf(standalone).length : null,
        nodesIdenticalToStandalone: standaloneKeys
          ? nodes.filter((node) => standaloneKeys.has(keyWithout(node, []))).length
          : null,
      });
    }
  }

  /* --- interaction coverage --- */
  const runtimeOwners = owners.filter((entry) => entry.runtimeExecuted);
  const interactionByVerb = {};
  const interactionByType = {};
  const operandGaps = [];
  const coverage = [];
  for (const entry of runtimeOwners) {
    const actions = actionsOf(entry.definition);
    const physical = actions.filter((action) => PHYSICAL_VERBS.has(action.verb));
    coverage.push({
      owner: entry.owner,
      actions: actions.length,
      actionsWithInteraction: actions.filter((action) => action.interaction).length,
      physicalVerbActions: physical.length,
      physicalWithoutInteraction: physical.filter((action) => !action.interaction).length,
      physicalWithSemanticInteractionOnly: physical.filter(
        (action) => action.interaction && SEMANTIC_INTERACTION_TYPES.has(action.interaction.type),
      ).length,
    });
    for (const action of actions) {
      const verb = (interactionByVerb[action.verb] ??= { total: 0, withInteraction: 0 });
      verb.total += 1;
      if (!action.interaction) continue;
      verb.withInteraction += 1;
      const interactionType = action.interaction.type;
      const type = (interactionByType[interactionType] ??= {
        total: 0,
        requiresAuthoredSource: 0,
        requiresAuthoredTarget: 0,
        missingRequiredOperands: 0,
        carriesZoneOrStation: 0,
      });
      type.total += 1;
      if (present(authoredZoneOrStation(action))) type.carriesZoneOrStation += 1;

      const missing = [];
      if (REQUIRES_AUTHORED_SOURCE.has(interactionType)) {
        type.requiresAuthoredSource += 1;
        if (!present(authoredSourceDefinitionId(action))) missing.push("sourceDefinitionId");
      }
      if (REQUIRES_AUTHORED_TARGET.has(interactionType)) {
        type.requiresAuthoredTarget += 1;
        if (!present(authoredTargetDefinitionId(action))) missing.push("targetDefinitionId");
      }
      if (missing.length) {
        type.missingRequiredOperands += 1;
        operandGaps.push({
          owner: entry.owner,
          actionId: action.id,
          interactionType,
          missing,
        });
      }
    }
  }

  /* --- visual states --- */
  const authoredStates = collectAuthoredVisualStates(owners);
  const visualStateRegistry = readVisualStateRegistry();
  const styled = parseStyledStates(visualStateRegistry);
  const styledStates = new Set([...styled.liquid, ...styled.solid]);
  const { states: stateAssets, stateAssetBindings, stateAssetAssetNames } = parseStateAssets();
  const stateAssetIds = new Set(Object.values(stateAssets).flat());
  const authoredList = [...authoredStates.keys()].sort();
  const authoredWithoutStyleOrAsset = authoredList.filter(
    (state) => !styledStates.has(state) && !stateAssetIds.has(state) && state !== "empty",
  );
  const styledNeverAuthored = [...styledStates].filter((state) => !authoredStates.has(state)).sort();
  const stateAssetsNeverAuthored = [...stateAssetIds]
    .filter((state) => !authoredStates.has(state))
    .sort();
  const visualStateOverrides = collectVisualStateOverrides(owners, styled, visualStateRegistry);

  /* --- assets --- */
  const assetFiles = listFiles(REALISTIC_DIR);
  const svgBaseNames = assetFiles.filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
  const pngBaseNames = assetFiles.filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));
  const svgSet = new Set(svgBaseNames);
  const pngSet = new Set(pngBaseNames);
  const knownBaseNames = new Set([...svgBaseNames, ...pngBaseNames]);

  const { map: realisticAssetById, equipmentIds } = parseEquipmentAssetMap();
  const playerBaseAssets = new Set(Object.values(realisticAssetById).filter(Boolean));
  const visualCatalogAssets = collectAssetReferences("src/equipment/visualCatalog.ts", knownBaseNames);
  for (const stateAssetName of stateAssetAssetNames) visualCatalogAssets.add(stateAssetName);
  // Composite result assets were literals in EquipmentView.tsx until Cycle 05 moved them into the
  // registry, so reachability is read from the registry. Reading the renderer would now report all
  // six composite assets as unreachable.
  const compositeAssets = new Set(
    readJson("src/equipment/compositeRegistry.json")
      .composites.filter((composite) => composite.kind === "visual")
      .map((composite) => composite.resultAsset),
  );
  const customRouteAssets = new Set();
  for (const file of walkSourceFiles("src/investigations")) {
    for (const asset of collectAssetReferences(file, knownBaseNames)) customRouteAssets.add(asset);
  }
  const galleryAssets = collectAssetReferences("src/trials/realisticEquipmentAssets.ts", knownBaseNames);

  const dispositions = {};
  for (const base of svgBaseNames) {
    const tags = [];
    if (playerBaseAssets.has(base)) tags.push("player-base");
    if (visualCatalogAssets.has(base)) tags.push("visual-catalog");
    if (compositeAssets.has(base)) tags.push("composite-branch");
    if (customRouteAssets.has(base)) tags.push("custom-route");
    if (galleryAssets.has(base)) tags.push("gallery");
    dispositions[base] = tags;
  }
  const unclassifiedAssets = Object.entries(dispositions)
    .filter(([, tags]) => tags.length === 0)
    .map(([base]) => base)
    .sort();
  const galleryOnlyAssets = Object.entries(dispositions)
    .filter(([, tags]) => tags.length === 1 && tags[0] === "gallery")
    .map(([base]) => base)
    .sort();

  const assetAliases = [];
  const byAsset = new Map();
  for (const [equipmentId, asset] of Object.entries(realisticAssetById)) {
    if (!asset) continue;
    if (!byAsset.has(asset)) byAsset.set(asset, []);
    byAsset.get(asset).push(equipmentId);
  }
  for (const [asset, ids] of byAsset) {
    if (ids.length > 1) assetAliases.push({ asset, equipmentIds: ids.sort() });
  }
  assetAliases.sort((a, b) => a.asset.localeCompare(b.asset));

  return {
    generatedBy: "scripts/auditContentInventory.mjs",
    catalogInventory: {
      labs: inventoryFolder("labs"),
      techniques: inventoryFolder("techniques"),
    },
    owners: {
      total: owners.length,
      byScope: countByScope(owners),
      runtimeExecutedScopes: ["labRoot", "standaloneTechnique"],
      runtimeUnreachableScopes: ["labEmbeddedTechnique"],
    },
    processNodes: {
      total: nodeRecords.length,
      byScope: countByScope(nodeRecords),
      duplicates: duplicateReport(nodeRecords, NODE_NORMALIZATIONS, (record) => record.node),
      duplicateOwnerSets: groupOwnerSets(nodeRecords, (record) => record.node),
      idCollisionsWithinOwner: nodeIdCollisionsWithinOwner,
      idCollisionsWithinLabFile: nodeIdCollisionsWithinLabFile,
    },
    actions: {
      total: actionRecords.length,
      byScope: countByScope(actionRecords),
      duplicates: duplicateReport(actionRecords, ACTION_NORMALIZATIONS, (record) => record.action),
      distinctActionIds: actionsById.size,
      actionIdsSharedIdentically,
      actionIdCollisions,
      unresolvedActionRefs,
      unusedActions,
      unusedImportedActions,
    },
    embeddedTechniques,
    interactions: {
      coverage: coverage.sort((a, b) => b.actions - a.actions),
      byVerb: interactionByVerb,
      byType: interactionByType,
      operandGaps,
    },
    visualStates: {
      authoredCount: authoredStates.size,
      authored: authoredList.map((state) => ({
        state,
        owners: [...authoredStates.get(state)].sort(),
        styled: styledStates.has(state),
        hasStateAsset: stateAssetIds.has(state),
      })),
      styledCount: styledStates.size,
      stateAssets,
      stateAssetBindings,
      authoredWithoutStyleOrAsset,
      styledNeverAuthored,
      stateAssetsNeverAuthored,
      // Scope: authored `initialState.equipment` only. States the reducer sets at run time cannot
      // be resolved statically, because `resolveLiquidStyle` also reads the run-time content label.
      overriddenByHeuristic: visualStateOverrides,
      overriddenByHeuristicInRuntimeOwners: visualStateOverrides.filter(
        (override) => override.runtimeExecuted,
      ).length,
    },
    assets: {
      directory: REALISTIC_DIR,
      svgCount: svgBaseNames.length,
      pngCount: pngBaseNames.length,
      svgWithoutPng: svgBaseNames.filter((base) => !pngSet.has(base)).sort(),
      pngWithoutSvg: pngBaseNames.filter((base) => !svgSet.has(base)).sort(),
      equipmentDefinitions: equipmentIds.length,
      dispositions,
      unclassifiedAssets,
      galleryOnlyAssets,
      assetAliases,
    },
    composites: {
      rendererPrecedence: rendererPrecedence(),
      registryComposites: verifyComposites(),
      evaluatorConsumers: verifyCompositeConsumers(),
      secondMechanism:
        "src/player/resolveWorkbenchScene.ts still composes render layers from AttachmentRelation.renderMode; that is layer composition, not composite art. Since Cycle 05 the art and suppression decision is src/equipment/composites.ts alone, driven by src/equipment/compositeRegistry.json.",
    },
  };
};

const summarize = (report) => ({
  labs: report.catalogInventory.labs,
  techniques: report.catalogInventory.techniques,
  owners: report.owners,
  processNodes: {
    total: report.processNodes.total,
    byScope: report.processNodes.byScope,
    duplicates: report.processNodes.duplicates,
    idCollisionsWithinLabFile: report.processNodes.idCollisionsWithinLabFile.length,
  },
  actions: {
    total: report.actions.total,
    byScope: report.actions.byScope,
    duplicates: report.actions.duplicates,
    distinctActionIds: report.actions.distinctActionIds,
    actionIdCollisions: report.actions.actionIdCollisions.length,
    unresolvedActionRefs: report.actions.unresolvedActionRefs.length,
    unusedActions: report.actions.unusedActions.reduce(
      (total, entry) => total + entry.actionIds.length,
      0,
    ),
    unusedImportedActions: report.actions.unusedImportedActions.reduce(
      (total, entry) => total + entry.actionIds.length,
      0,
    ),
  },
  visualStates: {
    authoredCount: report.visualStates.authoredCount,
    styledCount: report.visualStates.styledCount,
    authoredWithoutStyleOrAsset: report.visualStates.authoredWithoutStyleOrAsset.length,
    styledNeverAuthored: report.visualStates.styledNeverAuthored.length,
    stateAssetsNeverAuthored: report.visualStates.stateAssetsNeverAuthored.length,
    overriddenByHeuristic: report.visualStates.overriddenByHeuristic.length,
    overriddenByHeuristicInRuntimeOwners:
      report.visualStates.overriddenByHeuristicInRuntimeOwners,
  },
  assets: {
    svgCount: report.assets.svgCount,
    pngCount: report.assets.pngCount,
    unclassified: report.assets.unclassifiedAssets.length,
    galleryOnly: report.assets.galleryOnlyAssets.length,
    aliases: report.assets.assetAliases.length,
  },
  composites: {
    registered: report.composites.registryComposites.length,
    byKind: report.composites.registryComposites.reduce(
      (counts, entry) => ({ ...counts, [entry.kind]: (counts[entry.kind] ?? 0) + 1 }),
      {},
    ),
    // Non-zero means a composite's art decision reappeared in the renderer.
    unverified: report.composites.registryComposites.filter((entry) => !entry.verifiedInSource).length,
    evaluatorConsumersMissing: report.composites.evaluatorConsumers.filter(
      (entry) => !entry.consumesEvaluator,
    ).length,
  },
});

const buildBaseline = (report) => {
  const entries = [];
  const push = (id, category, ownerCycle, evidence, detail) =>
    entries.push({ id, category, ownerCycle, evidence, ...detail });

  for (const entry of report.embeddedTechniques) {
    push(
      `embedded-technique:${entry.lab}/${entry.techniqueId}`,
      "runtime-unreachable-embedded-technique",
      "03-04",
      `public/labs/${entry.lab}.json techniques[${entry.techniqueId}]`,
      {
        role: entry.role,
        // Deleting an entry that still lists a runtimePayload changes player behaviour. Clearing
        // such an entry means migrating the payload to the lab, not removing the technique.
        runtimePayload: entry.runtimePayload,
        shadowedPayload: entry.shadowedPayload,
        nodes: entry.nodes,
        actions: entry.actions,
        nodesIdenticalToLabRoot: entry.nodesIdenticalToLabRoot,
        standaloneExists: entry.standaloneExists,
        nodesIdenticalToStandalone: entry.nodesIdenticalToStandalone,
      },
    );
  }
  for (const collision of report.actions.actionIdCollisions) {
    push(
      `action-id-collision:${collision.actionId}`,
      "action-id-collision",
      "02",
      collision.owners.join(" | "),
      { variants: collision.variants },
    );
  }
  for (const collision of report.processNodes.idCollisionsWithinLabFile) {
    push(
      `node-id-collision:${collision.lab}/${collision.embeddedTechnique}`,
      "node-id-collision-within-lab-file",
      "03-04",
      `${collision.lab} vs embedded ${collision.embeddedTechnique}`,
      { nodeIds: collision.nodeIds },
    );
  }
  for (const entry of report.actions.unusedActions) {
    push(
      `unused-actions:${entry.owner}`,
      "declared-but-unreferenced-action",
      "02",
      entry.owner,
      { actionIds: entry.actionIds },
    );
  }
  // Migrating an unused action into `techniqueRefs` must not retire this debt; it only changes
  // where the action lives. Mirrors `action/imported-but-unreferenced` in the content checker.
  for (const entry of report.actions.unusedImportedActions) {
    push(
      `unused-imported-actions:${entry.owner}`,
      "imported-but-unreferenced-action",
      "03-04",
      entry.owner,
      { actionIds: entry.actionIds },
    );
  }
  for (const state of report.visualStates.authoredWithoutStyleOrAsset) {
    const detail = report.visualStates.authored.find((item) => item.state === state);
    push(
      `visual-state-unresolved:${state}`,
      "authored-visual-state-without-style-or-asset",
      "05",
      (detail?.owners ?? []).join(" | "),
      {},
    );
  }
  for (const override of report.visualStates.overriddenByHeuristic) {
    push(
      `visual-state-overridden:${override.owner}:${override.instanceId}`,
      "authored-initial-state-visual-state-overridden-by-heuristic",
      "05",
      `${override.owner} instance ${override.instanceId} (${override.definitionId})`,
      {
        authoredVisualState: override.authoredVisualState,
        renderedStyleKey: override.renderedStyleKey,
        reason: override.reason,
        runtimeExecuted: override.runtimeExecuted,
      },
    );
  }
  for (const state of report.visualStates.stateAssetsNeverAuthored) {
    push(
      `state-asset-unreachable:${state}`,
      "state-asset-never-authored",
      "12",
      "src/equipment/visualCatalog.ts handWarmerCalorimeterStateAssets",
      {},
    );
  }
  for (const asset of report.assets.unclassifiedAssets) {
    push(
      `asset-unclassified:${asset}`,
      "unclassified-realistic-asset",
      "05",
      `${REALISTIC_DIR}/${asset}.svg`,
      {},
    );
  }
  for (const gap of report.interactions.operandGaps) {
    push(
      `interaction-operand-gap:${gap.owner}:${gap.actionId}`,
      "incomplete-interaction-operands",
      "05",
      `${gap.owner} action ${gap.actionId}`,
      { interactionType: gap.interactionType, missing: gap.missing },
    );
  }
  for (const entry of report.interactions.coverage) {
    if (entry.physicalWithoutInteraction === 0) continue;
    push(
      `physical-actions-without-interaction:${entry.owner}`,
      "physical-action-without-equipment-interaction",
      "06-12",
      entry.owner,
      {
        physicalVerbActions: entry.physicalVerbActions,
        physicalWithoutInteraction: entry.physicalWithoutInteraction,
      },
    );
  }

  return {
    schema: "lab-studio/content-consistency-baseline@1",
    generatedBy: "node scripts/auditContentInventory.mjs --write-baseline",
    audit: "docs/step-and-image-consistency-audit.md",
    policy:
      "Later cycles may remove entries. Adding an entry requires updating the audit rationale in the same change.",
    counts: {
      debt: entries.length,
      byCategory: entries.reduce((totals, entry) => {
        totals[entry.category] = (totals[entry.category] ?? 0) + 1;
        return totals;
      }, {}),
    },
    toleratedDifferences: TOLERATED_DIFFERENCES,
    debt: entries.sort((a, b) => a.id.localeCompare(b.id)),
  };
};

/**
 * Documented, intentional differences. These are NOT debt and must not be "fixed" by a later
 * cycle without an audit change.
 */
const TOLERATED_DIFFERENCES = [
  {
    id: "alias:reagent-bottle",
    category: "documented-image-alias",
    rationale:
      "naoh-bottle, reagent-bottle, and unknown-acid-bottle are the same physical bottle. Labels and accessible names stay distinct.",
  },
  {
    id: "alias:dropper-bottle",
    category: "documented-image-alias",
    rationale: "phenolphthalein-dropper and dropper-bottle are the same physical dropper bottle.",
  },
  {
    id: "alias:beaker-250ml",
    category: "documented-image-alias",
    rationale: "waste-beaker is a 250 mL beaker designated for waste; the art is correctly shared.",
  },
  {
    id: "custom-route:acid-base-titration-curves",
    category: "intentional-custom-route",
    rationale:
      "src/App.tsx routes #/play/acid-base-titration-curves to AcidBaseTitrationCurvesInvestigation. The one-node public definition is a catalog stub, not a played process.",
  },
  {
    id: "custom-route:green-chemistry-mixture-purification",
    category: "intentional-custom-route",
    rationale:
      "src/App.tsx replaces the loaded definition with PurifyMixtureGreenChemistryPlayer. The one-node public definition is a catalog stub, not a played process.",
  },
  {
    id: "orphan-file:public/labs/acid-base-titration-curves-config.json",
    category: "intentional-non-definition-file",
    rationale: "Teacher configuration payload for the custom route; deliberately not a lab definition.",
  },
  {
    id: "gallery-only-assets",
    category: "intentional-gallery-asset",
    rationale:
      "Assets referenced only by src/trials/realisticEquipmentAssets.ts are the equipment art gallery. They are intentionally not player-reachable.",
  },
];

const report = buildReport();

if (argv.has("--write-baseline")) {
  const baseline = buildBaseline(report);
  const target = join(root, "scripts", "content-consistency-baseline.json");
  writeFileSync(target, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`wrote ${relative(root, target).split(sep).join("/")}`);
  console.log(JSON.stringify(baseline.counts, null, 2));
} else {
  console.log(JSON.stringify(argv.has("--full") ? report : summarize(report), null, 2));
}
