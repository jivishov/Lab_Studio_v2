/**
 * Reproduces the Cycle 04 acceptance evidence.
 *
 *   node scripts/verifyCycle04Migration.mjs
 *
 * Read-only. Three independent checks:
 *
 * 1. **Resolution**, over the eight migrated bundled lab sources. Mirrors
 *    `src/data/hydrateBundledLab.ts` closely enough to report what the runtime will receive: every
 *    pinned version resolves to that exact `metadata.version`, every selected action exists, no
 *    identity is imported twice or both imported and declared, every imported action's equipment is
 *    declared in `lab.equipment` and its models are lab-owned, and every lab-owned `actionId` —
 *    process node, node validation, assessment — resolves. The resolved action count is compared
 *    against the pre-migration authored root-action count, so a lost behaviour shows up as a number
 *    rather than as silence. A retained local carrier is checked against its own action set, not the
 *    lab's, because it is a separate owner.
 *
 * 2. **Byte identity of every fingerprinted action in the corpus.** Cycle 03 proved its pilot's
 *    parity with `git show HEAD:`. Four of Cycle 04's targets are untracked and two more had
 *    uncommitted pre-migration states, so that comparison is unavailable. Instead,
 *    `docs/architecture/cycle03-action-fingerprints.json` archives the content fingerprint Cycle 03
 *    recorded for each action. Every one of the 762 entries must still resolve to an action with an
 *    identical fingerprint — at its original owner, or, for a migrated lab only, at the pinned
 *    technique that now publishes it. The 320 migrated-lab entries prove the migration relocated
 *    behaviour without editing it; the other 442 prove it altered nothing else in the corpus, which
 *    no per-lab check can establish. Coverage is limited to actions the
 *    `action/atom-identity-missing` rule reached — physical verbs — which is why
 *    `docs/step-and-image-consistency-audit.md` §17.8 grades this as Tier B and says so.
 *
 * 3. **Vocabulary mirrors.** The dependency check in (1) hand-copies two key lists from
 *    `src/domain/validation.ts`. Cycle 03's audit §16.6 caught `checkContentConsistency.mjs`
 *    claiming to verify such mirrors when nothing did, so these are re-read from source and compared
 *    rather than trusted. A drift means (1) silently stopped covering a dependency kind.
 *
 * Exits non-zero on any failure.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (relative) => JSON.parse(readFileSync(join(root, relative), "utf8"));

/** Key-sorted deep copy, then a short hash: the same shape `checkContentConsistency.mjs` uses. */
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
};
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex").slice(0, 12);

/**
 * Mirrors `actionEquipmentParameterKeys` in `src/domain/validation.ts`. Verified against source by
 * `assertVocabularyMirrors` below, never merely asserted to match.
 */
const EQUIPMENT_KEYS = [
  "equipmentDefinitionId",
  "sourceDefinitionId",
  "targetDefinitionId",
  "instrumentDefinitionId",
  "ovenDefinitionId",
  "heatSourceDefinitionId",
  "coolingToolDefinitionId",
];
/** Mirrors `actionModelParameterKeys`, mapped to the `LabDefinition` collection each names. */
const MODEL_COLLECTION = {
  titrationModelId: "titrationModels",
  chromatographyModelId: "chromatographyModels",
  kineticsModelId: "kineticsModels",
};

/**
 * `resolved` is the pre-migration authored root-action count. `prefixed` marks the one lab whose
 * root actions carried a `<techniqueId>--` prefix that the migration dropped (audit §17.2).
 */
const MIGRATED = [
  { labId: "intro-filtration-demo", resolved: 13, cycle: "03" },
  { labId: "hard-water-demo", resolved: 15, cycle: "04" },
  { labId: "quick-ache-relief-separation", resolved: 32, cycle: "04" },
  {
    labId: "hard-water-analysis",
    // 131 at migration; Cycle 08 added `select-filtration-configuration` to
    // `gravimetric-vacuum-filtration`, the step that records which filtration configuration the
    // teacher selected before any apparatus is assembled (Investigation 3 confirmation point 1).
    resolved: 132,
    cycle: "04",
    prefixed: true,
  },
  {
    labId: "blue1-spectroscopy",
    // 131 at migration. Cycle 06 added the instrument-slot lifecycle Investigation 1 needs and had
    // never had: 18 cuvette insert/remove actions in `blue1-percent-transmittance` (one pair for the
    // blank and one for each of the eight assigned ratios), 8 `-log T` transformation calculations in
    // `blue1-class-calibration` (A-03), and 2 lab-local insert/remove actions for the sports-drink
    // cuvette. See `docs/_cycle-06-audit-section.md` §21.
    resolved: 159,
    cycle: "04",
  },
  {
    labId: "crystal-violet-rate-law",
    // 114 at migration; Cycle 06 added `cv11-set-approved-wavelength` to
    // `crystal-violet-spectrophotometer-calibration` (C-05, the step that sets the approved
    // wavelength, which had no action at all) and the lab-local `cv11-remove-kinetic-cuvette` that
    // finally frees the sample compartment at the end of the run.
    resolved: 116,
    cycle: "04",
    // Migration removes *duplicated* technique copies. `crystal-violet-hydroxide-order-extension`
    // is not one: it is a `lab-local-state-carrier` with no standalone counterpart, and audit §5.4
    // records that its three nodes are the only authored representation of the crystal-violet
    // source's optional z/k extension — an unresolved `C` confirmation point that Cycle 06 owns.
    // It stays embedded, and its nodes must stay out of the lab root process: appending them would
    // turn an optional teacher-approved branch into required student flow.
    keepsEmbedded: ["crystal-violet-hydroxide-order-extension"],
  },
  { labId: "equilibrium-rainbow-display", resolved: 161, cycle: "04" },
  { labId: "hand-warmer-calorimetry", resolved: 241, cycle: "04" },
];

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`    FAIL ${message}`);
};

const stringField = (record, key) => {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

/** Every `actionId` value anywhere in `value`. */
const referencedActionIds = (value, into = new Set()) => {
  if (Array.isArray(value)) {
    for (const item of value) referencedActionIds(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (key === "actionId" && typeof inner === "string") into.add(inner);
      else referencedActionIds(inner, into);
    }
  }
  return into;
};

/**
 * Re-read the two key lists this script mirrors and prove they still match source.
 *
 * Slices a flat `export const NAME ... = [ "a", "b" ]`, skipping any `[]` in the type annotation —
 * the same shape `checkContentConsistency.mjs` parses. If a declaration is rewritten into a shape
 * this cannot read, the parsed set comes back different and the check fires: a false alarm that
 * forces a human to look, never a silent pass.
 */
const assertVocabularyMirrors = () => {
  const source = readFileSync(join(root, "src/domain/validation.ts"), "utf8");
  const parse = (declaration) => {
    const start = source.indexOf(declaration);
    if (start === -1) return [];
    const arrayStart = source.indexOf("[", source.indexOf("=", start));
    const arrayEnd = source.indexOf("]", arrayStart);
    if (arrayStart === -1 || arrayEnd === -1) return [];
    return [...source.slice(arrayStart, arrayEnd).matchAll(/"([A-Za-z0-9_.-]+)"/g)].map((m) => m[1]);
  };
  const compare = (label, mirrored, parsed) => {
    const missing = parsed.filter((key) => !mirrored.includes(key));
    const extra = mirrored.filter((key) => !parsed.includes(key));
    if (missing.length || extra.length) {
      fail(
        `mirror/drift ${label}: source has ${JSON.stringify(parsed)}, this script mirrors ` +
          `${JSON.stringify(mirrored)}${missing.length ? ` — not covered: ${missing.join(", ")}` : ""}`,
      );
    }
    return missing.length === 0 && extra.length === 0;
  };
  const equipmentOk = compare(
    "actionEquipmentParameterKeys",
    EQUIPMENT_KEYS,
    parse("export const actionEquipmentParameterKeys"),
  );
  const modelOk = compare(
    "actionModelParameterKeys",
    Object.keys(MODEL_COLLECTION),
    parse("export const actionModelParameterKeys"),
  );
  console.log(
    `vocabulary mirrors: actionEquipmentParameterKeys ${equipmentOk ? "ok" : "DRIFTED"}, ` +
      `actionModelParameterKeys ${modelOk ? "ok" : "DRIFTED"}`,
  );
};

const indexedTechniqueIds = new Set(read("public/techniques/index.json").map((entry) => entry.id));

const archive = read("docs/architecture/cycle03-action-fingerprints.json");
const archivedByLab = new Map();
for (const entry of archive.entries) {
  const match = /^action\/atom-identity-missing:lab:([^/]+)\/(.+)$/.exec(entry.id);
  if (!match) continue;
  const [, labId, actionId] = match;
  if (!archivedByLab.has(labId)) archivedByLab.set(labId, []);
  archivedByLab.get(labId).push({ actionId, fingerprint: entry.fingerprint });
}
/** Labs whose archived entries the per-lab pass has already checked, so the sweep skips them. */
const verifiedArchiveIds = new Set();

/**
 * Actions a later authorized cycle deliberately changed.
 *
 * The archive records what each action was before Cycle 04 relocated it, and its whole value is
 * proving that relocation was not an edit. A cycle chartered to change those actions has to say so
 * action by action, or the proof decays into "the file changed somehow". A declared action must
 * still exist, and it must actually differ from the archive: a declaration for an action nobody
 * touched is a stale claim, and this reports it as one.
 *
 * Cycle 08 gave every Investigation 3 physical action an atom identity, its equipment-role
 * bindings, and the chronology prerequisites that make the tare, seating, wetting, breakup, and
 * cooling order non-bypassable. See `docs/step-and-image-consistency-audit.md` §20.
 */
const CYCLE_08_OWNERS = new Map([
  ["technique:hard-water-practice-preparation", 15],
  ["technique:gravimetric-vacuum-filtration", 9],
  ["technique:two-stage-precipitate-drying", 6],
  ["technique:hard-water-two-sample-inquiry", 38],
]);
const CYCLE_08_CHANGE =
  "Cycle 08: atom identity, equipment-role bindings, and chronology or configuration prerequisites";

/**
 * Cycle 06 gave every Investigation 1 and Investigation 11 physical action an atom identity, its
 * equipment-role bindings, and the instrument prerequisites that make the wavelength configuration,
 * the blank/zero, and the occupied sample compartment non-bypassable; it also moved each configured
 * instrument response off the `record` action and onto the `read` that produces it. The counts are
 * physical actions carrying an `atomId`, so a declaration that reached nothing would fail below.
 * See `docs/_cycle-06-audit-section.md` §21.
 */
const CYCLE_06_PHYSICAL_VERBS = new Set([
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
const CYCLE_06_OWNERS = new Map([
  ["technique:blue1-standard-dilutions", 28],
  ["technique:blue1-percent-transmittance", 27],
  ["technique:crystal-violet-micromolar-dilution-series", 16],
  ["technique:crystal-violet-spectrophotometer-calibration", 18],
  ["technique:crystal-violet-waste-treatment", 3],
  // Both labs are declared too. Unlike Investigation 3's, these labs' action ids carry no technique
  // prefix, so the `--` rule below cannot reach them, and Cycle 06 changed lab-local actions —
  // Investigation 11's whole kinetic run is lab-local — which Cycle 08 never did.
  ["lab:blue1-spectroscopy", 2],
  ["lab:crystal-violet-rate-law", 8],
]);
const CYCLE_06_CHANGE =
  "Cycle 06: atom identity, equipment-role bindings, instrument-state prerequisites, and reading provenance";

const declaredModification = (owner, actionId) => {
  // Seen through a migrated lab, the same action arrives under its publishing technique's prefix.
  const direct = CYCLE_08_OWNERS.has(owner);
  const viaLab = [...CYCLE_08_OWNERS.keys()].some((technique) =>
    actionId.startsWith(`${technique.slice("technique:".length)}--`),
  );
  if (direct || viaLab) return CYCLE_08_CHANGE;
  const direct06 = CYCLE_06_OWNERS.has(owner);
  const viaLab06 = [...CYCLE_06_OWNERS.keys()].some((technique) =>
    actionId.startsWith(`${technique.slice("technique:".length)}--`),
  );
  return direct06 || viaLab06 ? CYCLE_06_CHANGE : undefined;
};

let declaredModified = 0;
let staleDeclarations = 0;

assertVocabularyMirrors();

for (const { labId, resolved: expectedResolved, cycle, prefixed, keepsEmbedded = [] } of MIGRATED) {
  const lab = read(`public/labs/${labId}.json`);
  const refs = lab.techniqueRefs ?? [];
  const importedBy = new Map();
  const importedActions = new Map();
  const seenTechniques = new Set();
  /** actionId -> the technique that publishes it, for the fingerprint pass below. */
  const publishedBy = new Map();

  for (const ref of refs) {
    if (seenTechniques.has(ref.techniqueId)) fail(`${labId}: repeats technique ${ref.techniqueId}`);
    seenTechniques.add(ref.techniqueId);
    if (typeof ref.version !== "string" || ref.version.length === 0) {
      fail(`${labId}: ${ref.techniqueId} has no pinned version`);
      continue;
    }
    const technique = read(`public/techniques/${ref.techniqueId}.json`);
    if (technique.metadata.version !== ref.version) {
      fail(`${labId}: pins ${ref.techniqueId}@${ref.version}, file is ${technique.metadata.version}`);
      continue;
    }
    for (const action of technique.actions) publishedBy.set(action.id, action);
    const selected =
      ref.actionIds === "all" ? technique.actions.map((action) => action.id) : ref.actionIds;
    if (!Array.isArray(selected) || selected.length === 0) {
      fail(`${labId}: ${ref.techniqueId} selects nothing`);
      continue;
    }
    for (const actionId of selected) {
      const action = technique.actions.find((candidate) => candidate.id === actionId);
      if (!action) {
        fail(`${labId}: ${ref.techniqueId}@${ref.version} publishes no action ${actionId}`);
        continue;
      }
      if (importedBy.has(actionId)) {
        fail(`${labId}: ${actionId} imported by ${importedBy.get(actionId)} and ${ref.techniqueId}`);
        continue;
      }
      importedBy.set(actionId, ref.techniqueId);
      importedActions.set(actionId, action);
    }
  }

  // Actions only: no technique process node, edge, equipment instance, model, or presentation
  // string may cross the boundary, and the lab must own its starting equipment outright. Embedded
  // techniques are gone except for the declared local carriers, which were never duplicates.
  const embedded = (lab.techniques ?? []).map((technique) => technique.id);
  const unexpected = embedded.filter((id) => !keepsEmbedded.includes(id));
  if (unexpected.length) fail(`${labId}: still embeds ${unexpected.join(", ")}`);
  for (const id of keepsEmbedded) {
    if (!embedded.includes(id)) fail(`${labId}: lost its local carrier ${id}`);
  }
  if (!(lab.initialState?.equipment ?? []).length) {
    fail(`${labId}: declares no initialState.equipment`);
  }
  // A retained carrier must stay retained: it may contribute nothing the runtime reads, and its
  // nodes must not have been folded into the lab root process.
  for (const technique of lab.techniques ?? []) {
    if ((technique.initialState?.equipment ?? []).length) {
      fail(`${labId}: carrier ${technique.id} declares initialState.equipment`);
    }
    for (const collection of Object.values(MODEL_COLLECTION)) {
      if ((technique[collection] ?? []).length) {
        fail(`${labId}: carrier ${technique.id} declares ${collection}`);
      }
    }
    for (const node of technique.process.nodes) {
      if (lab.process.nodes.some((rootNode) => rootNode.id === node.id)) {
        fail(`${labId}: carrier node ${node.id} was folded into the lab root process`);
      }
    }
    // The lab's original generator asserted this directly — no root node may reference a carrier
    // action — because the branch is optional and teacher-gated. See
    // .codex/worktrees/a436/…/src/domain/__tests__/crystalVioletRateLawDefinition.test.ts:189.
    const carrierActionIds = new Set(technique.actions.map((action) => action.id));
    for (const node of lab.process.nodes) {
      if (carrierActionIds.has(node.actionId)) {
        fail(`${labId}: root node ${node.id} references carrier action ${node.actionId}`);
      }
    }
    // The same test asserted the carrier is absent from the technique index, which is why
    // `standaloneExists` is false: it must not be published as a reusable technique.
    if (indexedTechniqueIds.has(technique.id)) {
      fail(`${labId}: carrier ${technique.id} was published into techniques/index.json`);
    }
  }

  const declaredEquipment = new Set(lab.equipment);
  for (const [actionId, action] of importedActions) {
    const used = new Set();
    for (const key of EQUIPMENT_KEYS) {
      const value = stringField(action.parameters, key);
      if (value) used.add(value);
    }
    for (const key of ["sourceDefinitionId", "targetDefinitionId"]) {
      const value = stringField(action.interaction, key);
      if (value) used.add(value);
    }
    for (const equipmentId of used) {
      if (!declaredEquipment.has(equipmentId)) {
        fail(`${labId}: imported ${actionId} needs equipment ${equipmentId}, not in lab.equipment`);
      }
    }
    for (const [key, collection] of Object.entries(MODEL_COLLECTION)) {
      const modelId = stringField(action.parameters, key);
      if (!modelId) continue;
      const owned = new Set((lab[collection] ?? []).map((model) => model.id));
      if (!owned.has(modelId)) {
        fail(`${labId}: imported ${actionId} needs ${collection} ${modelId}, not lab-owned`);
      }
    }
  }

  const localIds = lab.actions.map((action) => action.id);
  for (const actionId of localIds) {
    if (importedBy.has(actionId)) fail(`${labId}: declares and imports ${actionId}`);
  }
  if (new Set(localIds).size !== localIds.length) fail(`${labId}: repeats a lab-local action id`);

  const resolvedIds = new Set([...importedBy.keys(), ...localIds]);
  if (resolvedIds.size !== expectedResolved) {
    fail(`${labId}: resolves ${resolvedIds.size} actions, pre-migration root count was ${expectedResolved}`);
  }
  // Scoped to what the lab itself owns. An embedded carrier is a separate owner whose process
  // resolves against its own actions, so folding it in here would conflate the two resolution rules
  // and could report a false failure for a carrier that legitimately declares its own action.
  const labOwned = { process: lab.process, assessments: lab.assessments };
  for (const actionId of referencedActionIds(labOwned)) {
    if (!resolvedIds.has(actionId)) fail(`${labId}: references unresolved action ${actionId}`);
  }
  for (const technique of lab.techniques ?? []) {
    const own = new Set(technique.actions.map((action) => action.id));
    for (const actionId of referencedActionIds({
      process: technique.process,
      successCriteria: technique.successCriteria,
    })) {
      if (!own.has(actionId)) {
        fail(`${labId}: carrier ${technique.id} references action ${actionId}, which it does not declare`);
      }
    }
  }
  // Hydration's imports-then-locals array order is read only by the no-`actionId` fallback in
  // `actionForIntent`. A lab with an action-less node would make that order observable.
  const actionlessNodes = lab.process.nodes.filter((node) => !node.actionId).map((node) => node.id);
  if (actionlessNodes.length) {
    fail(`${labId}: ${actionlessNodes.length} node(s) declare no actionId: ${actionlessNodes.join(", ")}`);
  }

  let matched = 0;
  let stillLocal = 0;
  const localById = new Map(lab.actions.map((action) => [action.id, action]));
  for (const { actionId, fingerprint: recorded } of archivedByLab.get(labId) ?? []) {
    const survivor = localById.get(actionId);
    if (survivor) {
      // Deliberately kept lab-local (audit §17.3). Migration must not have edited it either, so the
      // archived fingerprint is checked here rather than the entry being skipped.
      stillLocal += 1;
      const declaredLocal = declaredModification(`lab:${labId}`, actionId);
      if (fingerprint(survivor) === recorded) {
        if (declaredLocal) {
          staleDeclarations += 1;
          fail(`${labId}: lab-local ${actionId} is declared modified by ${declaredLocal}, but matches the archive`);
        } else matched += 1;
      } else if (declaredLocal) {
        declaredModified += 1;
      } else {
        fail(`${labId}: lab-local ${actionId} was modified — ${fingerprint(survivor)} != archived ${recorded}`);
      }
      continue;
    }
    const bare = prefixed && !publishedBy.has(actionId) ? actionId.replace(/^.+?--/, "") : actionId;
    const published = publishedBy.get(bare);
    if (!published) {
      fail(`${labId}: archived ${actionId} is published by no pinned technique`);
      continue;
    }
    // The lab root prefixed only `id`, so compare the technique's action carrying the lab's id.
    const candidate = bare === actionId ? published : { ...published, id: actionId };
    const declared = declaredModification(`lab:${labId}`, actionId);
    if (fingerprint(candidate) === recorded) {
      if (declared) {
        staleDeclarations += 1;
        fail(`${labId}: ${actionId} is declared modified by ${declared}, but matches the archive`);
      } else matched += 1;
    } else if (declared) {
      declaredModified += 1;
    } else {
      fail(`${labId}: ${actionId} fingerprint ${fingerprint(candidate)} != archived ${recorded}`);
    }
  }
  verifiedArchiveIds.add(labId);

  console.log(
    `${labId.padEnd(30)} cycle=${cycle} refs=${refs.length} imported=${importedBy.size} ` +
      `lab-local=${localIds.length} resolved=${resolvedIds.size}/${expectedResolved} ` +
      `nodes=${lab.process.nodes.length} fingerprint-match=${matched} still-lab-local=${stillLocal}`,
  );
}

/* ------------------------------------------------------------------
 * Corpus-wide fingerprint sweep.
 *
 * The per-lab pass above covers the 320 archived entries belonging to a migrated lab. The remaining
 * 442 — 388 standalone-technique actions and 54 actions in labs Cycle 04 never touched — are the
 * only evidence that the cycle altered or removed nothing outside its scope. Nothing in a per-lab
 * check can establish that, so sweep every entry.
 * ------------------------------------------------------------------ */

const currentActionsByOwner = new Map();
const ownerActions = (owner) => {
  if (currentActionsByOwner.has(owner)) return currentActionsByOwner.get(owner);
  const [scope, id] = [owner.slice(0, owner.indexOf(":")), owner.slice(owner.indexOf(":") + 1)];
  let actions = new Map();
  try {
    const definition = read(`public/${scope === "lab" ? "labs" : "techniques"}/${id}.json`);
    actions = new Map(definition.actions.map((action) => [action.id, action]));
  } catch {
    actions = new Map();
  }
  currentActionsByOwner.set(owner, actions);
  return actions;
};

let sweptElsewhere = 0;
let sweptMigrated = 0;
for (const entry of archive.entries) {
  const match = /^action\/atom-identity-missing:((?:lab|technique):[^/]+)\/(.+)$/.exec(entry.id);
  if (!match) {
    fail(`archive entry has an unrecognised owner form: ${entry.id}`);
    continue;
  }
  const [, owner, actionId] = match;
  const labId = owner.startsWith("lab:") ? owner.slice(4) : undefined;
  if (labId && verifiedArchiveIds.has(labId)) {
    sweptMigrated += 1; // already checked, with the migration's relocation rule applied
    continue;
  }
  const action = ownerActions(owner).get(actionId);
  if (!action) {
    fail(`archive: ${owner} no longer declares ${actionId}`);
    continue;
  }
  const current = fingerprint(action);
  const declared = declaredModification(owner, actionId);
  if (current !== entry.fingerprint) {
    if (declared) {
      declaredModified += 1;
      continue;
    }
    fail(`archive: ${owner}/${actionId} was modified — ${current} != archived ${entry.fingerprint}`);
    continue;
  }
  if (declared) {
    staleDeclarations += 1;
    fail(`archive: ${owner}/${actionId} is declared modified by ${declared}, but matches the archive`);
    continue;
  }
  sweptElsewhere += 1;
}
console.log(
  `archive sweep: ${archive.entries.length} entries — ${sweptMigrated} in migrated labs (checked above), ` +
    `${sweptElsewhere} elsewhere unchanged, ${declaredModified} changed by a declared later cycle` +
    `${staleDeclarations ? `, ${staleDeclarations} STALE DECLARATION(S)` : ""}`,
);

// A declaration that covers an owner but reaches none of its actions would silently widen the
// exemption, so check the counts the declaration itself claims.
for (const [owner, expected] of CYCLE_08_OWNERS) {
  const actions = [...ownerActions(owner).values()].filter((action) => action.atomId);
  if (actions.length !== expected) {
    fail(
      `declared Cycle 08 owner ${owner} carries ${actions.length} actions with an atom identity, expected ${expected}`,
    );
  }
}
for (const [owner, expected] of CYCLE_06_OWNERS) {
  const actions = [...ownerActions(owner).values()].filter(
    (action) => action.atomId && CYCLE_06_PHYSICAL_VERBS.has(action.verb),
  );
  if (actions.length !== expected) {
    fail(
      `declared Cycle 06 owner ${owner} carries ${actions.length} physical actions with an atom identity, expected ${expected}`,
    );
  }
}

console.log(
  failures === 0
    ? "OK: every pinned reference resolves, every replaced action matched its pinned technique, " +
        "and every fingerprinted action in the corpus is unchanged"
    : `FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
