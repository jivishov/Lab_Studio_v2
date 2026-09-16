# Step and Image Consistency Audit

Cycle 01 of the atomic-step and equipment fidelity remediation
(`atomic_remediation_plan/CONTINUATION_CYCLE_01.md`).

This document is the evidence base every later cycle must cite before changing a physical action,
a visual state, an asset, or a composite. It records **what is true today**, not what should
change. No application behaviour or content was remediated in this cycle.

- Audit date: 2026-08-04
- Working tree: dirty (`git status --short` reports 289 entries, most of them unrelated to
  `Lab_studio/`). No unrelated file was modified, staged, reset, or cleaned.
- Machine-readable companion: `scripts/content-consistency-baseline.json`
- Reproduction command: `node scripts/auditContentInventory.mjs`

---

## 1. How to reproduce every number in this document

```bash
node scripts/auditContentInventory.mjs
```

`--full` prints the complete report including every per-owner row; `--write-baseline` regenerates
`scripts/content-consistency-baseline.json`. The script is read-only apart from that one flag, has
no dependencies, and reads only:

- `public/labs/*.json`, `public/labs/index.json`
- `public/techniques/*.json`, `public/techniques/index.json`
- `src/equipment/catalog.ts`, `src/equipment/visualCatalog.ts`
- `src/equipment/liquidRendering/styles.ts`
- `src/player/EquipmentView.tsx`, `src/trials/realisticEquipmentAssets.ts`
- `src/investigations/**/*.ts{,x}`
- `public/assets/equipment-realistic/v1/`

Facts derived from TypeScript are extracted by targeted static text matching, never by executing
the app. Every such extraction is either a literal object map (`realisticAssetById`,
`LIQUID_STYLES`) or is guarded by a marker assertion that reports `verifiedInSource: false` if the
source stops matching. Treat a `verifiedInSource: false` row as a stale audit, not as a passing
check.

---

## 2. Definition owner model

The audit never merges scopes. A **definition owner** is one of three kinds:

| Owner form | Scope key | Executed by the runtime player? |
|---|---|---|
| `lab:<id>` | `labRoot` | Yes — `getProcess`/`getActions` read only the root process and root actions |
| `lab:<id>/technique:<tid>` | `labEmbeddedTechnique` | **No** |
| `technique:<id>` | `standaloneTechnique` | Yes, on `#/technique/<id>` |

Evidence for the embedded-technique exclusion:

- `src/runtime/createRuntime.ts:18` — `getProcess` returns `definition.process` only.
- `src/runtime/createRuntime.ts:22-27` — `getActions` returns `resolveTitrationActions(definition, definition.actions)`; embedded technique actions are never merged.
- `src/runtime/createRuntime.ts:56-78` — embedded techniques contribute `initialState.equipment` **only when the lab has no own `initialState`**.
- `src/domain/titrationModels.ts:142`, `src/runtime/reducer.ts:218`, `src/runtime/reducer.ts:233` — a code path exists for embedded techniques to contribute titration, chromatography, and kinetics models. No embedded technique currently uses it.

So an embedded technique can contribute models, and equipment when the lab has no `initialState`,
and nothing else. Its `process`, `edges`, `actions`, `successCriteria`, and `commonMistakes` are
inert in the player. `src/studio/studioArtifact.ts:116` does read `technique.actions` when
exporting a technique artifact, so the data is not literally unreachable — it is unreachable *from
the student player*.

Measured against that rule, of the 34 embedded techniques:

| Payload status | Count | Which |
|---|---|---|
| **Consumed** — deleting it would change player behaviour | **4** | `acid-base-titration/acid-base-titration-state`, and `measuring-volume`, `transfer`, `filtration` in `intro-filtration-demo` |
| Shadowed — declares `initialState.equipment` that the lab's own `initialState` overrides | 20 | see `shadowedPayload` in the baseline |
| Carries nothing the runtime reads | 10 | enumerated in §6 |

Only those 4 constrain a migration. The other 30 can lose their process and actions without any
runtime effect. Every lab that has models declares them at the lab level.

Owner totals: **91** (17 `labRoot`, 34 `labEmbeddedTechnique`, 40 `standaloneTechnique`).

---

## 3. Comparison methods

Three normalizations are used. They are never mixed, and every duplicate count below names the one
it used.

**Canonicalization (shared by all three):** recursively sort object keys; preserve array order;
`JSON.stringify` the result.

| Name | Fields removed before canonicalization | Question it answers |
|---|---|---|
| `exactWithId` | none | Are these records byte-identical, identity included? |
| `exactWithoutId` | `id` | Are these the same record under a different identifier? |
| `semantic` (nodes) | `id`, `title`, `description`, `hints`, `feedback`, `layout` | Same behaviour under different presentation? |
| `semantic` (actions) | `id`, `label`, `feedback` | Same behaviour under different learner-facing wording? |

The `semantic` normalization removes **only** the named presentation fields. It never removes
`type`, `actionId`, `config`, `validation`, `verb`, `parameters`, `interaction`, `prerequisites`,
`stateChanges`, `invalidCases`, or `evidence`. Quantities, units, tolerances, and state transitions
are therefore always compared.

`distinct` counts unique canonical strings. `repeats = total - distinct`.

---

## 4. Catalog inventory

Indexed entries and files on disk are inventoried separately and reported separately.

| Folder | Index entries | `.json` files (excl. index) | Definition-shaped files | Indexed but file missing | Definition file not indexed | Non-definition files |
|---|---|---|---|---|---|---|
| `public/labs` | 17 | 18 | 17 | 0 | 0 | 1 |
| `public/techniques` | 40 | 40 | 40 | 0 | 0 | 0 |

The single non-definition lab file is `public/labs/acid-base-titration-curves-config.json`, the
teacher configuration payload for the custom titration-curves route. It is recorded as an
**intentional non-definition file** in the baseline's `toleratedDifferences`, not as an orphan.

There are no index omissions and no orphan definition files in either folder.

### 4.1 Custom routes

Two labs never run their public process through `StudentPlayer`:

| Lab | Route behaviour | Evidence |
|---|---|---|
| `acid-base-titration-curves` | `#/play/acid-base-titration-curves` renders `AcidBaseTitrationCurvesInvestigation` without loading the definition | `src/App.tsx:634-640` |
| `green-chemistry-mixture-purification` | definition is loaded and validated, then replaced by `PurifyMixtureGreenChemistryPlayer` | `src/App.tsx:609-611` |

Both public definitions contain exactly one process node and one action. They are catalog stubs.
Both are recorded as `intentional-custom-route` tolerated differences and are excluded from
shared process-node deduplication.

---

## 5. Corpus counts and duplication

> Every count in §5 and §6 is the **pre-Cycle-03 corpus**, measured on 2026-08-04 before the
> `intro-filtration-demo` migration. §16.8 records what that migration moved and re-states the
> totals. The comparison methods in §3 are unchanged.

### 5.1 Process nodes

Total authored process-node records: **2,905**.

| Scope | Nodes |
|---|---|
| `labRoot` | 1,155 |
| `labEmbeddedTechnique` | 828 |
| `standaloneTechnique` | 922 |

| Normalization | Total | Distinct | Repeats |
|---|---|---|---|
| `exactWithId` | 2,905 | 1,464 | 1,441 |
| `exactWithoutId` | 2,905 | 1,464 | 1,441 |
| `semantic` | 2,905 | 1,464 | 1,441 |

**All three normalizations give the same answer.** That is itself a finding: the 1,441 repeats are
not near-duplicates that differ in wording or layout, and no two nodes differ only by `id`. Every
repeated node is a byte-identical copy of another node, identity included. Duplication in this
corpus is verbatim copying, not paraphrase.

Repeats occurring twice inside a single owner: **0**. Every repeat crosses an owner boundary.

Largest duplicate groups by owner set (`exactWithId`):

| Repeats | Owner set |
|---|---|
| 482 | `lab:hand-warmer-calorimetry` ‖ its embedded `hand-warmer-calorimetry` ‖ `technique:hand-warmer-calorimetry` |
| 322 | `lab:equilibrium-rainbow-display` ‖ its embedded `equilibrium-rainbow-inquiry` ‖ `technique:equilibrium-rainbow-inquiry` |
| 112 | `lab:blue1-spectroscopy` ‖ its embedded `blue1-standard-dilutions` ‖ `technique:blue1-standard-dilutions` |
| 78 | `lab:crystal-violet-rate-law` ‖ its embedded `crystal-violet-spectrophotometer-calibration` ‖ `technique:crystal-violet-spectrophotometer-calibration` |
| 66 | `lab:hard-water-analysis`'s embedded `hard-water-two-sample-inquiry` ‖ `technique:hard-water-two-sample-inquiry` |

### 5.2 Actions

Total authored action records: **2,913** (1,163 `labRoot`, 828 `labEmbeddedTechnique`,
922 `standaloneTechnique`).

| Normalization | Total | Distinct | Repeats |
|---|---|---|---|
| `exactWithId` | 2,913 | 1,446 | 1,467 |
| `exactWithoutId` | 2,913 | 1,315 | 1,598 |
| `semantic` | 2,913 | 1,314 | 1,599 |

Unlike nodes, actions **do** collapse further when identity is removed: 131 additional action
records are the same behaviour under a different action id, and 1 more collapses when learner-facing
wording is also removed. Distinct action ids: **1,425**.

### 5.3 Action-id collisions

824 action ids appear in more than one owner. 805 of those are byte-identical copies. The
remaining **19 ids carry conflicting definitions**:

| Action id | Owners |
|---|---|
| `add-indicator` | `lab:acid-base-titration`, `technique:titration-endpoint` |
| `add-solvent` | `technique:making-solution`, `technique:paper-chromatography` |
| `calculate-absorbance` | `technique:beers-law-calibration`, `technique:transmittance-dilution` |
| `calculate-acid-molarity` | `lab:acid-base-titration`, `technique:titration-endpoint` |
| `calculate-hardness` | `lab:hard-water-demo` (+ embedded), `technique:hard-water-calculation`, `technique:hard-water-gravimetry` |
| `dry-precipitate` | `lab:hard-water-demo` (+ embedded), `technique:drying`, `technique:hard-water-gravimetry` |
| `filter-mixture` | `lab:hard-water-demo`, `lab:intro-filtration-demo` (+ embedded), `technique:filtration` |
| `measure-stock-dye` | `technique:beers-law-calibration`, `technique:transmittance-dilution` |
| `place-filtration-receiver` | `lab:hard-water-demo`, `lab:intro-filtration-demo` (+ embedded), `technique:filtration` |
| `place-ring-stand` | `technique:thermal-decomposition-mass-loss`, `technique:titration-endpoint` |
| `place-spectrophotometer` | `technique:beers-law-calibration`, `technique:transmittance-dilution` |
| `record-final-burette` | `lab:acid-base-titration`, `technique:titration-endpoint` |
| `record-initial-burette` | `lab:acid-base-titration`, `technique:titration-endpoint` |
| `record-percent-transmittance` | `technique:beers-law-calibration`, `technique:transmittance-dilution` |
| `record-teacher-approval` | `lab:beverage-acidity`, `lab:hydrogen-peroxide-redox-titration` |
| `rinse-precipitate` | `lab:hard-water-demo`, `lab:intro-filtration-demo` (+ embedded), `technique:filtration`, `technique:hard-water-gravimetry` |
| `transfer-sample` | `lab:hard-water-demo`, `lab:intro-filtration-demo` (+ embedded), `technique:transfer` |
| `weigh-dry-precipitate` | `lab:hard-water-demo` (+ embedded), `technique:drying`, `technique:hard-water-gravimetry` |
| `write-cer-conclusion` | `lab:marble-statue-kinetics`, `lab:paper-chromatography` |

These are the ids a version-pinned `TechniqueActionRef` import would silently disagree about.
Cycle 02 owns their identity contract; Cycles 03-04 own the import behaviour.

### 5.4 Process-to-action references

Unresolved `node.actionId` references: **0**, in every owner, under the same root-scoped
resolution rule the validator uses (`src/domain/validation.ts:1267`, `:1364` collect action ids
from `input.actions` only; `:1014-1016` enforces the reference).

Actions declared but never referenced by any node in the same owner: **8**, in 3 owners.

| Owner | Unreferenced action ids |
|---|---|
| `lab:crystal-violet-rate-law` | `cv11-extension-approval-gate`, `cv11-extension-design-hydroxide-series`, `cv11-extension-determine-z-and-k` |
| `lab:intro-filtration-demo` | `observe-transfer`, `place-beaker`, `place-cylinder`, `record-volume` |
| `lab:hard-water-demo` | `place-cylinder` |

The three `cv11-extension-*` actions correspond to the crystal-violet source's optional `z`/`k`
extension (confirmation point 5), which is currently carried by the lab-local embedded technique
`crystal-violet-hydroxide-order-extension`. Retaining them is source-faithful; wiring them is a
Cycle 06 decision that depends on an unresolved `C` point.

### 5.5 Node-id collisions inside one lab file

Three embedded techniques, all in `hard-water-demo`, covering seven node ids that mean one thing in
the root process and something else in the embedded technique:

| Lab | Embedded technique | Colliding node ids |
|---|---|---|
| `hard-water-demo` | `measuring-volume` | `measure-sample-node`, `record-volume-node` |
| `hard-water-demo` | `transfer` | `transfer-sample-node` |
| `hard-water-demo` | `filtration` | `assemble-funnel-stand-node`, `place-filter-node`, `wet-filter-node`, `place-receiver-node` |

Because the embedded process is not executed, this does not break the player today. It does mean
`hard-water-demo` cannot be migrated by id alone.

---

## 6. Embedded technique inventory

Every `lab:<id>/technique:<tid>` owner, with its relationship to the lab root process and to the
standalone technique of the same id.

| Lab | Embedded technique | Nodes | Actions | Nodes identical to lab root | Standalone nodes | Nodes identical to standalone |
|---|---|---|---|---|---|---|
| `acid-base-titration-curves` | `titration-curves-custom-experience-entry` | 1 | 1 | 1 | none | n/a |
| `acid-base-titration` | `acid-base-titration-state` | 1 | 1 | 0 | none | n/a |
| `beverage-acidity` | `beverage-acidity-inquiry-context` | 1 | 1 | 0 | none | n/a |
| `blue1-spectroscopy` | `blue1-standard-dilutions` | 56 | 56 | 56 | 56 | 56 |
| `blue1-spectroscopy` | `blue1-percent-transmittance` | 36 | 36 | 36 | 36 | 36 |
| `blue1-spectroscopy` | `blue1-class-calibration` | 23 | 23 | 23 | 23 | 23 |
| `bonding-unknown-solids` | `unknown-solids-configured-starting-state` | 1 | 1 | 0 | none | n/a |
| `crystal-violet-rate-law` | `crystal-violet-micromolar-dilution-series` | 21 | 21 | 21 | 21 | 21 |
| `crystal-violet-rate-law` | `crystal-violet-spectrophotometer-calibration` | 39 | 39 | 39 | 39 | 39 |
| `crystal-violet-rate-law` | `crystal-violet-kinetics` | 38 | 38 | 38 | **6** | **0** |
| `crystal-violet-rate-law` | `crystal-violet-integrated-rate-law-comparison` | 8 | 8 | 8 | 8 | 8 |
| `crystal-violet-rate-law` | `crystal-violet-waste-treatment` | 5 | 5 | 5 | 5 | 5 |
| `crystal-violet-rate-law` | `crystal-violet-hydroxide-order-extension` | 3 | 3 | 0 | none | n/a |
| `equilibrium-rainbow-display` | `equilibrium-rainbow-inquiry` | 161 | 161 | 161 | 161 | 161 |
| `hand-warmer-calorimetry` | `hand-warmer-calorimetry` | 241 | 241 | 241 | 241 | 241 |
| `hard-water-analysis` | `hard-water-practice-preparation` | 26 | 26 | 0 | 26 | 26 |
| `hard-water-analysis` | `gravimetric-vacuum-filtration` | 12 | 12 | 0 | 12 | 12 |
| `hard-water-analysis` | `two-stage-precipitate-drying` | 19 | 19 | 0 | 19 | 19 |
| `hard-water-analysis` | `inquiry-plan-approval` | 8 | 8 | 0 | 8 | 8 |
| `hard-water-analysis` | `hard-water-two-sample-inquiry` | 66 | 66 | 0 | 66 | 66 |
| `hard-water-demo` | `measuring-volume` | 3 | 3 | 0 | 3 | 3 |
| `hard-water-demo` | `transfer` | 3 | 3 | 0 | 3 | 3 |
| `hard-water-demo` | `filtration` | 6 | 6 | 0 | 6 | **5** |
| `hard-water-demo` | `drying` | 3 | 3 | 0 | 3 | 3 |
| `hard-water-demo` | `hard-water-calculation` | 1 | 1 | 0 | 1 | 1 |
| `intro-filtration-demo` | `measuring-volume` | 3 | 3 | 0 | 3 | 3 |
| `intro-filtration-demo` | `transfer` | 3 | 3 | 0 | 3 | 3 |
| `intro-filtration-demo` | `filtration` | 6 | 6 | 0 | 6 | 6 |
| `marble-statue-kinetics` | `marble-statue-kinetics-state` | 1 | 1 | 0 | none | n/a |
| `paper-chromatography` | `chromatography-inquiry-guardrails` | 1 | 1 | 0 | none | n/a |
| `quick-ache-relief-separation` | `quick-ache-property-evidence` | 6 | 6 | 6 | 6 | 6 |
| `quick-ache-relief-separation` | `quick-ache-design-approval` | 3 | 3 | 3 | 3 | 3 |
| `quick-ache-relief-separation` | `quick-ache-extraction-recovery` | 14 | 14 | 14 | 14 | 14 |
| `quick-ache-relief-separation` | `quick-ache-analysis-report` | 9 | 9 | 9 | 9 | 9 |

The three `intro-filtration-demo` rows were removed by Cycle 03 (§16), leaving 31. Cycle 04 removed
24 more (§17.1): every `root-identical-copy` and `root-divergent-copy` row belonging to
`blue1-spectroscopy`, `crystal-violet-rate-law`, `equilibrium-rainbow-display`,
`hand-warmer-calorimetry`, `hard-water-analysis`, `hard-water-demo`, and
`quick-ache-relief-separation`. **The 7 `lab-local-state-carrier` rows all remain**, including
`crystal-violet-hydroxide-order-extension`, which Cycle 04 removed in error and restored; see
§17.4.1. The table below describes the pre-Cycle-03 corpus.

Three roles emerge (`role` in the report and the baseline):

1. **`root-identical-copy` — 14 entries**, across five source-derived labs (`blue1-spectroscopy`,
   `crystal-violet-rate-law`, `equilibrium-rainbow-display`, `hand-warmer-calorimetry`,
   `quick-ache-relief-separation`). The lab root process contains a byte-identical copy of every
   embedded node, and the standalone technique file contains a third byte-identical copy.
2. **`root-divergent-copy` — 13 entries**, across `hard-water-analysis`, `hard-water-demo`, and
   `intro-filtration-demo`. The embedded nodes match the standalone technique but appear nowhere
   in the lab root process.
3. **`lab-local-state-carrier` — 7 entries** with no standalone counterpart:
   `titration-curves-custom-experience-entry`, `acid-base-titration-state`,
   `beverage-acidity-inquiry-context`, `unknown-solids-configured-starting-state`,
   `crystal-violet-hydroxide-order-extension`, `marble-statue-kinetics-state`,
   `chromatography-inquiry-guardrails`.

The name "state carrier" is only accurate for one of the seven. Cross-referencing the roles against
the payload rule in §2:

- Exactly one state carrier, `acid-base-titration/acid-base-titration-state`, actually holds
  equipment the runtime consumes. It is the only lab in the set with no lab-level `initialState`.
- The other six state carriers hold **nothing the runtime reads** — one node, one action, no
  equipment, no models. So do four of the copies: `blue1-class-calibration`,
  `crystal-violet-integrated-rate-law-comparison`, `quick-ache-design-approval`, and
  `quick-ache-analysis-report`.
- The only other consumed payload is in `intro-filtration-demo`, whose three
  `root-divergent-copy` embeds supply the lab's starting equipment.

So the migration constraint is narrow: 4 entries of 34 carry something a Cycle 03-04 change must
preserve. The rest can lose their process and actions with no runtime effect. The baseline records
`role`, `runtimePayload`, and `shadowedPayload` on every entry precisely so a later cycle does not
delete a carrier to shrink a count.

---

## 7. Source crosswalk

All fourteen dated specifications under
`C:\Users\EmilJivishov\Projects\AP_CHEM_LABS\atomic_steps\` are dated `2026-07-27` and carry the
same `M` / `F` / `R` / `C` legend. Every one has a current implementation.

| Inv. | Source file | Phase rows | `C` confirmation points | Lab | Standalone techniques | Remediation cycle |
|---|---|---|---|---|---|---|
| 1 | `sports-drink-blue-dye-spectroscopy` | 24 | 6 | `blue1-spectroscopy` | `blue1-standard-dilutions`, `blue1-percent-transmittance`, `blue1-class-calibration` | 06 |
| 2 | `how-can-color-determine-copper-in-brass` | 44 | 8 | `brass-colorimetry` | `brass-spectrophotometry` | 07 |
| 3 | `what-makes-hard-water-hard` | 59 | 10 | `hard-water-analysis` | `hard-water-practice-preparation`, `gravimetric-vacuum-filtration`, `two-stage-precipitate-drying`, `inquiry-plan-approval`, `hard-water-two-sample-inquiry` | 08 |
| 4 | `acid-in-fruit-juice-and-soft-drinks` | 23 | 6 | `beverage-acidity` | `beverage-ph-volume-titration` | 09 |
| 5 | `sticky-question-paper-chromatography` | 45 | 10 | `paper-chromatography` | `paper-chromatography` | 10 |
| 6 | `bonding-in-unknown-solids` | 18 | 6 | `bonding-unknown-solids` | `bonding-solids-tests` | 11 |
| 7 | `purify-a-mixture-green-chemistry` | 35 | 7 | `green-chemistry-mixture-purification` (custom route) | `thermal-decomposition-mass-loss` | 10 |
| 8 | `hydrogen-peroxide-redox-titration` | 22 | 6 | `hydrogen-peroxide-redox-titration` | `redox-titration` | 09 |
| 9 | `quick-ache-relief-component-separation` | 23 | 6 | `quick-ache-relief-separation` | `quick-ache-property-evidence`, `quick-ache-design-approval`, `quick-ache-extraction-recovery`, `quick-ache-analysis-report` | 10 |
| 10 | `how-long-will-that-marble-statue-last` | 48 | 10 | `marble-statue-kinetics` | `marble-gas-syringe-kinetics` | 11 |
| 11 | `crystal-violet-rate-law` | 27 | 6 | `crystal-violet-rate-law` | `crystal-violet-micromolar-dilution-series`, `crystal-violet-spectrophotometer-calibration`, `crystal-violet-integrated-rate-law-comparison`, `crystal-violet-waste-treatment` | 06 |
| 12 | `hand-warmer-design-challenge` | 40 | 8 | `hand-warmer-calorimetry` (generated) | `hand-warmer-calorimetry` (generated) | 12 |
| 13 | `equilibrium-rainbow-display` | 62 | 10 | `equilibrium-rainbow-display` | `equilibrium-rainbow-inquiry` | 12 |
| 14 | `acid-base-titration-curves` | 33 | 6 | `acid-base-titration-curves` (custom route) | `titration-curve-analysis` | 09 |

Totals: **505 phase rows**, **105 `C` confirmation points**. None of the 105 may be decided by an
implementation cycle; each must either remain teacher-configurable or block the affected behaviour.

### 7.1 Implementation content not authored from a dated source

Two groups. Neither may be treated as source-faithful.

**(a) Demo and reference content that predates the specifications.**

- Labs: `intro-filtration-demo`, `hard-water-demo`, `acid-base-titration`.
- Techniques: `weighing`, `measuring-volume`, `making-solution`, `dilution`, `transfer`,
  `filtration`, `drying`, `hard-water-calculation`, plus the two simulator-generated techniques
  `transmittance-dilution` and `thermal-decomposition-mass-loss`.

**(b) Generator stubs named after an investigation.** The ten technique files written by
`scripts/generateApChemTechniqueFragments.mjs` (§7.2) are short procedural sketches produced from
the generator's own tables, not from the dated plans: `beers-law-calibration`,
`brass-spectrophotometry`, `hard-water-gravimetry`, `titration-endpoint`, `bonding-solids-tests`,
`redox-titration`, `tablet-separation`, `crystal-violet-kinetics`, `hand-warmer-calorimetry`,
`titration-curve-analysis`. Nine of the ten are currently on disk in generator form; the tenth,
`hand-warmer-calorimetry`, has been overwritten by the other generator.

### 7.2 Generator ownership

Three generators write into `public/techniques/`:

| Generator | Writes | Also rewrites |
|---|---|---|
| `scripts/generateApChemTechniqueFragments.mjs:1044-1064` | `beers-law-calibration`, `brass-spectrophotometry`, `hard-water-gravimetry`, `titration-endpoint`, `bonding-solids-tests`, `redox-titration`, `tablet-separation`, `crystal-violet-kinetics`, `hand-warmer-calorimetry`, `titration-curve-analysis` | `public/techniques/index.json` |
| `scripts/generateSimulatorTechniqueDefinitions.mjs:751-761` | `paper-chromatography`, `transmittance-dilution`, `thermal-decomposition-mass-loss` | — |
| `scripts/generateHandWarmerCalorimetry.mjs:919-948` | `public/techniques/hand-warmer-calorimetry.json`, `public/labs/hand-warmer-calorimetry.json` | both index files |

`scripts/applyProEquipmentRealismContent.mjs:224-227` additionally patches
`public/techniques/filtration.json`, `public/labs/hard-water-demo.json`,
`public/labs/intro-filtration-demo.json`, and `public/labs/acid-base-titration.json` in place.

**Two generators own `public/techniques/hand-warmer-calorimetry.json`.** The file on disk today is
the 241-node version from `generateHandWarmerCalorimetry.mjs`; running
`generateApChemTechniqueFragments.mjs` would replace it with a 6-node stub and rewrite the index
entry. The same generator would also overwrite `crystal-violet-kinetics.json`, whose
6-node stub already conflicts with the 38-node technique of the same id embedded in
`lab:crystal-violet-rate-law` (0 nodes in common — see §6).

This conflict is visible in the dirty worktree: the ten `public/techniques/ap-*.json` files are
deleted and the un-prefixed ids now collide. Cycle 04 owns generator ownership; the hand-warmer
generator must be updated rather than its output hand-edited.

Cycle 04 updated `generateHandWarmerCalorimetry.mjs` and regenerated through it (§17.7). **The
dual-ownership conflict is not resolved.** `generateApChemTechniqueFragments.mjs` still declares
`hand-warmer-calorimetry` and `crystal-violet-kinetics`, and running it would still replace the
241-node technique with a 6-node stub — which would now also break
`public/labs/hand-warmer-calorimetry.json`, because that lab pins `hand-warmer-calorimetry@2.1.0` and
a stub would fail the version check instead of silently degrading. That is a strictly better failure
mode, but the two generators still contend for one file.

### 7.3 Fallback fixtures

`src/data/loadBundledLabs.ts:94-100` and `src/data/loadBundledTechniques.ts:83-89` catch **every**
error from the public fetch path — including a failed `validateLabDefinition`, an id mismatch, and
a missing index entry — and silently substitute the in-repo fixture from `src/domain/fixtures.ts`
when one exists with that id. Invalid public content is therefore masked rather than reported.
`src/domain/fixtures.ts:992` exposes only `demoLab` and `hardWaterDemoLab`, so the masking applies
to the labs `intro-filtration-demo` and `hard-water-demo`, plus the ten fixture techniques listed
at `src/domain/fixtures.ts:738` (`weighing`, `measuring-volume`, `making-solution`, `dilution`,
`transmittance-dilution`, `transfer`, `filtration`, `drying`,
`thermal-decomposition-mass-loss`, `hard-water-calculation`). Cycle 03 owns restricting fallback
to genuine resource unavailability.

**Resolved by Cycle 03.** Line numbers above describe the pre-Cycle-03 loaders. Both now classify
every failure as `BundleResourceError` or `BundleContentError` and fall back only on the former; see
§16.5.

---

## 8. Interaction coverage

Interaction types are split into **apparatus manipulation** (`dragToZone`, `snapIntoTarget`,
`pourInto`, `dispenseDrops`, `spotOnto`, `rinseTarget`, `placeInInstrument`, `readInstrument`,
`recordTimeSeries`) and **evidence recording** (`recordNotebook`, `submitCalculation`).

"Physical verb" means one of `place`, `weigh`, `measureVolume`, `transfer`, `dissolve`,
`precipitate`, `dilute`, `filter`, `spotSample`, `developChromatogram`, `rinse`, `dry`, `heat`,
`cool`, `stressEquilibrium`.

### 8.1 Operand completeness

**0 gaps.** The requirement rule is a direct mirror of `requiresSource` and `requiresTarget` in
`src/runtime/interactionIntents.ts:258-278`, not an independent guess at what an interaction
"should" carry. Getting this wrong in either direction produces a false finding, so the exact rule
is recorded here.

| Interaction type | Count | Requires authored source | Requires authored target | Missing | Carries zone/station |
|---|---|---|---|---|---|
| `recordNotebook` | 822 | 0 | 0 | 0 | 36 |
| `pourInto` | 283 | 0 | 283 | 0 | 0 |
| `dragToZone` | 122 | 122 | 0 | 0 | 122 |
| `snapIntoTarget` | 93 | 93 | 93 | 0 | 93 |
| `submitCalculation` | 84 | 0 | 0 | 0 | 2 |
| `readInstrument` | 74 | 74 | 0 | 0 | 74 |
| `placeInInstrument` | 28 | 28 | 28 | 0 | 28 |
| `rinseTarget` | 24 | 0 | 24 | 0 | 0 |
| `spotOnto` | 3 | 3 | 3 | 0 | 0 |
| `dispenseDrops` | 2 | 2 | 2 | 0 | 0 |

Four rules that a plausible-looking check gets wrong:

- **A snap zone is never required.** `interactionIntents.ts:499-500` reads
  `if (snapZone && ...)`, so a missing `snapZoneId` cannot fail. The `carriesZoneOrStation` column
  is coverage, not compliance. Treating it as a requirement would have manufactured a finding
  against `pourInto`, `rinseTarget`, `spotOnto`, and `dispenseDrops`, none of which carry one.
- **`pourInto` does not require an authored source**, only a target. It is absent from
  `requiresSource`.
- **`dragToZone` does not require a target.** It targets a snap zone or a station.
- **`readInstrument` requires a target only when one is already present**
  (`interactionIntents.ts:278`), so it can never be a target gap. 20 of 74 omit it legitimately.

The authored source resolves through three fallbacks, not two:
`interaction.sourceDefinitionId` → `parameters.sourceDefinitionId` →
`parameters.equipmentDefinitionId` (`interactionIntents.ts:443-447`). A check that stops at the
first two is stricter than the runtime.

One limit on this result: `requiresSource` and `requiresTarget` can also be satisfied at run time
by the user's own selection (`intent.sourceInstanceId`, `intent.targetInstanceId`). A static audit
can only confirm that the authored operands are present, which they are in every case. It cannot
prove the runtime resolves them to a real instance on the bench.

### 8.2 Apparatus-manipulation coverage per lab

| Lab | Root actions | With manipulation interaction | Share |
|---|---|---|---|
| `acid-base-titration-curves` | 1 | 0 | 0% |
| `bonding-unknown-solids` | 42 | 0 | 0% |
| `brass-colorimetry` | 128 | 0 | 0% |
| `green-chemistry-mixture-purification` | 1 | 0 | 0% |
| `hydrogen-peroxide-redox-titration` | 42 | 2 | 5% |
| `beverage-acidity` | 17 | 1 | 6% |
| `quick-ache-relief-separation` | 32 | 2 | 6% |
| `blue1-spectroscopy` | 131 | 10 | 8% |
| `marble-statue-kinetics` | 31 | 5 | 16% |
| `hand-warmer-calorimetry` | 241 | 51 | 21% |
| `paper-chromatography` | 54 | 16 | 30% |
| `crystal-violet-rate-law` | 114 | 58 | 51% |
| `hard-water-analysis` | 131 | 68 | 52% |
| `equilibrium-rainbow-display` | 161 | 95 | 59% |
| `acid-base-titration` | 9 | 6 | 67% |
| `intro-filtration-demo` | 13 | 9 | 69% |
| `hard-water-demo` | 15 | 11 | 73% |

The two 0% single-action labs are the custom routes and are expected. `bonding-unknown-solids` has
42 actions and **zero physical verbs**: every step is `observe`/`record`/`calculate` with a
`recordNotebook` interaction, even though its source (Inv. 6) requires conductivity, solubility,
melting-point, and magnetism testing.

### 8.3 Physical-verb actions with no interaction at all

| Owner | Physical-verb actions | Without any interaction |
|---|---|---|
| `lab:blue1-spectroscopy` | 37 | 37 |
| `technique:blue1-standard-dilutions` | 28 | 28 |
| `lab:brass-colorimetry` | 25 | 25 |
| `technique:thermal-decomposition-mass-loss` | 14 | 12 |
| `technique:transmittance-dilution` | 11 | 9 |
| `technique:blue1-percent-transmittance` | 9 | 9 |
| `technique:redox-titration` | 6 | 6 |
| `technique:titration-endpoint` | 6 | 6 |
| `technique:beers-law-calibration` | 5 | 5 |
| `technique:titration-curve-analysis` | 4 | 4 |
| `technique:brass-spectrophotometry` | 4 | 4 |
| `technique:crystal-violet-kinetics` | 3 | 3 |
| `technique:hard-water-gravimetry` | 3 | 3 |
| `technique:bonding-solids-tests` | 2 | 2 |
| `technique:tablet-separation` | 2 | 2 |
| `technique:dilution`, `technique:making-solution`, `technique:transfer`, `technique:weighing` | 2 each | 2 each |
| `lab:hand-warmer-calorimetry` / `technique:hand-warmer-calorimetry` | 53 | 2 |
| `lab:intro-filtration-demo` | 11 | 2 |
| `technique:measuring-volume` | 2 | 1 |
| `lab:hard-water-demo` | 12 | 1 |

16 standalone techniques declare **no interaction spec at all**, in three groups:

- 9 AP-fragment generator stubs (§7.1b): `beers-law-calibration`, `bonding-solids-tests`,
  `brass-spectrophotometry`, `crystal-violet-kinetics`, `hard-water-gravimetry`, `redox-titration`,
  `tablet-separation`, `titration-curve-analysis`, `titration-endpoint`.
- 2 source-derived Blue #1 techniques: `blue1-standard-dilutions` (28 physical-verb actions),
  `blue1-class-calibration` (analysis only).
- 5 original demo techniques: `dilution`, `making-solution`, `transfer`, `weighing`,
  `hard-water-calculation`.

The only owners with physical actions carrying an *evidence-only* interaction are
`lab:equilibrium-rainbow-display` and `technique:equilibrium-rainbow-inquiry`, 6 each.

### 8.4 Spectroscopy instrument lifecycle

| Owner | Spectrophotometer/cuvette actions | Interaction types used |
|---|---|---|
| `lab:crystal-violet-rate-law` | 40 | `dragToZone` 7, `snapIntoTarget` 7, `readInstrument` 14, `recordNotebook` 6, `pourInto` 6 |
| `technique:crystal-violet-spectrophotometer-calibration` | 29 | `dragToZone` 7, `snapIntoTarget` 6, `readInstrument` 6, `recordNotebook` 5, `pourInto` 5 |
| `lab:blue1-spectroscopy` | 28 | none 18, `readInstrument` 10 |
| `technique:blue1-percent-transmittance` | 27 | none 18, `readInstrument` 9 |
| `lab:brass-colorimetry` | 128 | none 128 |
| `technique:transmittance-dilution` | 7 | none 5, `readInstrument` 1, `snapIntoTarget` 1 |
| `technique:beers-law-calibration` | 2 | none 2 |
| `technique:brass-spectrophotometry` | 1 | none 1 |
| `technique:crystal-violet-kinetics` | 2 | none 2 |

Only the crystal-violet family implements the full place → insert → blank/read cycle. Blue #1 reads
an instrument that was never loaded. Brass has no instrument interaction of any kind.

---

## 9. Visual states

### 9.1 Authored states

Keys scanned: any key ending in `visualState` (`visualState`, `resultVisualState`,
`preEndpointVisualState`, `endpointVisualState`, `overshootVisualState`) plus the list-valued
`visualStateChoices`.

- Distinct authored states: **60**
- Styles defined in `LIQUID_STYLES` (`src/equipment/liquidRendering/styles.ts:12-206`): **29**
- State assets registered in `v1VisualCatalog` (`src/equipment/visualCatalog.ts:1214`): **13**
  (`CAL-00`…`CAL-12` on `hand-warmer-calorimeter`; no other equipment declares `stateAssets`)

### 9.2 Authored states with neither a style nor a state asset — 42

`blue1-0-10`, `blue1-1-9`, `blue1-10-0`, `blue1-2-8`, `blue1-3-7`, `blue1-4-6`, `blue1-6-4`,
`blue1-8-2`, `brass-sample`, `broken-dry-precipitate`, `cloudy-blue-precipitate`,
`cooled-dry-precipitate`, `copper-blue-solution`, `copper-blue-solution-at-mark`,
`damp-precipitate`, `diluted-solution`, `dissolving-solid`, `dry-solid`, `emulsion`,
`equilibrium-pale-yellow`, `equilibrium-yellow-orange`, `filter-cake`, `granular-solid`,
`paper-unspotted`, `partially-dry-precipitate`, `permanganate-faint-pink`,
`permanganate-overshoot-purple`, `permanganate-solution`, `powder`, `purple-solution`,
`redox-colorless-solution`, `solid`, `syringe-empty`, `syringe-extended`, `syringe-filled`,
`syringe-gas-expelled`, `syringe-inverted`, `syringe-valve-closed`,
`teacher-configured-beverage`, `two-layer-extraction`, `white-powder`, `white-solid`.

Scientific consequence, by family:

- The eight `blue1-*-*` states are the perceptually ordered dilution series the Inv. 1 spec asks to
  confirm ("whether current liquid renderer supports a perceptually ordered blue series"). They all
  render as the default pale blue today, so the series carries no information (Cycle 06).
- `equilibrium-pale-yellow` and `equilibrium-yellow-orange` are authored but absent from
  `LIQUID_STYLES`, while `equilibrium-yellow-green`, `equilibrium-pale-red`, and
  `equilibrium-deep-red` are styled but never authored — the rainbow palette and the content
  disagree in both directions (Cycle 12).
- The four `permanganate-*` states and `redox-colorless-solution` mean the Inv. 8 endpoint colour
  change is invisible (Cycle 09).
- The six `syringe-*` states have matching unused assets — see §10.3 (Cycle 12).

### 9.3 Styles defined but never authored — 13

`acid`, `equilibrium-deep-red`, `equilibrium-pale-red`, `equilibrium-yellow-green`,
`measured-liquid`, `naoh`, `phenolphthalein`, `sample-bottle-water`, `titration-clear`,
`titration-dark-pink`, `titration-pale-pink`, `unknown-sample`, `waste`.

Most of these are reachable *only* through the heuristics in §9.4 or through runtime-set states
(`titration-*` from `titrationVisualState`, `src/runtime/reducer.ts:459`), not through authored
content. They are not dead code, but they are also not addressable by authors.

### 9.4 Authored visual states overridden by label heuristics — 65

`resolveLiquidStyle` (`src/equipment/liquidRendering/styles.ts:243-264`) honours an explicit
`visualState` only when it starts with `titration-` or when the content label contains `+`.
Otherwise three definition-id overrides and then a reagent-name heuristic derived from
`${definition.label} ${contents.label}` take precedence over the authored state.

**65 authored initial-state instances lose their explicit state this way**, 47 of them in
runtime-executed owners (the other 18 are the embedded-technique copies of the same instances).
Representative cases:

| Owner | Instance | Definition | Authored `visualState` | Style actually used | Cause |
|---|---|---|---|---|---|
| `lab:blue1-spectroscopy` | `i1-unknown-sample` | `sample-bottle` | `blue-dye-solution` | `sample-bottle-water` | definition-id override |
| `technique:paper-chromatography` | `sample-bottle-1` | `sample-bottle` | `blue-dye-solution` | `sample-bottle-water` | definition-id override |
| `technique:beers-law-calibration` | `sample-bottle-1` | `sample-bottle` | `blue-dye-solution` | `sample-bottle-water` | definition-id override |
| `lab:equilibrium-rainbow-display` | `concentrated-hcl` | `dropper-bottle` | `clear-solution` | `acid` | label heuristic |
| `lab:acid-base-titration` (embedded) | `burette-50ml-1` | `burette-50ml` | `clear-solution` | `naoh` | label heuristic |
| `lab:hard-water-analysis` | `unknown-c-bottle` | `sample-bottle` | `clear-liquid` | `sample-bottle-water` | definition-id override |

The `sample-bottle` cases are the scientifically significant ones: three separate dye/analyte
samples are drawn as plain water because the *container* is a sample bottle. The full list is in
`scripts/content-consistency-baseline.json` under
`authored-initial-state-visual-state-overridden-by-heuristic`, each entry carrying a
`runtimeExecuted` flag. Cycle 05 owns making the explicit state authoritative.

**Scope limit.** This analysis covers authored `initialState.equipment` only. States the reducer
assigns during play (`resultVisualState` on equilibrium stresses, `titrationVisualState`, the
filter/dry/heat transitions) pass through the same `resolveLiquidStyle` call, but their content
label is computed at run time, so no static check can decide whether the heuristic wins. The 65 is
a floor, not a total.

> **Resolved by Cycle 05.** §9 describes the pre-Cycle-05 renderer. An authored state the registry can
> render now wins outright and the two heuristics apply only where no state is authored, so the
> run-time scope limit above no longer matters: the precedence does not depend on the content label at
> all. §19.1 gives the new precedence and the static rules that hold it in place; §19.2 records the ten
> states of §9.2 that were resolved and the twelve that were re-owned.

---

## 10. Assets

Directory: `public/assets/equipment-realistic/v1` — **119 SVG**, **120 PNG**.

### 10.1 PNG/SVG pairing

Every SVG has a same-named PNG. One PNG has no SVG wrapper: **`burette-50ml-enhanced.png`**. Under
the `AGENTS.md` asset rules an SVG wrapper is required only for assets the app renders; this PNG is
referenced by nothing, so it is recorded as an unreferenced source PNG rather than a broken pair.

### 10.2 Disposition of every SVG

| Disposition | Count |
|---|---|
| `player-base` + `gallery` | 37 |
| `player-base` only | 29 |
| `gallery` only | 19 |
| `visual-catalog` only — the 12 unreachable `hand-warmer-calorimeter-cal-01`…`-12` state assets | 12 |
| `composite-branch` | 6 |
| `player-base` + `custom-route` + `gallery` | 4 |
| `player-base` + `visual-catalog` | 3 |
| `custom-route` only — `titration-curves-rig`, `mixture-purification-ring-stand-clay-triangle-crucible-lid-askew` | 2 |
| `player-base` + `custom-route` | 1 |
| **unclassified** | **6** |
| **Total** | **119** |

Reachability sources are: the `realisticAssetById` map (`src/equipment/catalog.ts:8-86`), explicit
paths and generated `stateAssets` in `src/equipment/visualCatalog.ts`, composite paths in
`src/player/EquipmentView.tsx`, the two custom investigation players, and the equipment gallery
`src/trials/realisticEquipmentAssets.ts`. The custom-route players build paths through a
`publicAsset()` helper rather than a literal directory path, so bare `"<name>.svg"` / `"<name>.png"`
literals matching a known asset are also counted — without that rule those two assets would be
misreported as unreachable.

The 19 gallery-only assets (`centrifuge-tube`, `condenser`, `desiccator`, `dixie-cup`,
`evaporating-dish`, `forceps`, `funnel-filter-paper`, `glass-slide`, `hot-plate`, `lab-scoop`,
`magnetic-stirrer`, `mortar-pestle`, `petri-dish`, `pipette-bulb`, `round-bottom-flask-250ml`,
`stir-bar`, `test-tube-holder`, `volumetric-pipette-10ml`, `wooden-calorimeter-lid`) are recorded
as an **intentional** disposition, not debt.

### 10.3 Unclassified assets — 6

`luer-lock-syringe-extended`, `luer-lock-syringe-filled`, `luer-lock-syringe-gas-expelled`,
`luer-lock-syringe-inverted`, `luer-lock-syringe-nail-locked`, `luer-lock-syringe-valve-closed`.

These are the only realistic assets no code path can reach. They correspond one-for-one to the six
`syringe-*` visual states authored in `equilibrium-rainbow-display` and
`equilibrium-rainbow-inquiry` (§9.2). The base assets `luer-lock-syringe-empty` and
`luer-lock-syringe-locked` *are* wired, as the `luer-lock-syringe` and `luer-lock-syringe-locked`
equipment definitions. Cycle 12 owns the wiring; no new asset generation is required.

### 10.4 State assets registered but never authored — 12

`CAL-01` … `CAL-12` on `hand-warmer-calorimeter`. Only `CAL-00` is ever set as a `visualState`
in content. The strings `CAL-01`…`CAL-05` do appear throughout
`public/labs/hand-warmer-calorimetry.json`, but as action ids, node ids, evidence tags, and
`traceabilityId` values — not as visual states. This is a naming coincidence, not wiring: the
calorimeter never changes appearance as it is assembled. Cycle 12 owns this.

### 10.5 Documented image aliases — 3

| Shared asset | Equipment definitions |
|---|---|
| `beaker-250ml` | `beaker-250ml`, `waste-beaker` |
| `dropper-bottle` | `dropper-bottle`, `phenolphthalein-dropper` |
| `reagent-bottle` | `naoh-bottle`, `reagent-bottle`, `unknown-acid-bottle` |

All three are legitimate physical aliases: the objects genuinely look alike. Each definition keeps
its own `label` and `accessibleName`, and `EquipmentView` renders `aria-label={label, contents}`
(`src/player/EquipmentView.tsx:650`), so the semantic distinction survives. Recorded as tolerated
differences. They must not be "fixed" by generating distinct art.

All 78 equipment definitions have a realistic asset mapping; there are no unmapped definitions and
no map keys without a definition.

> **Updated by Cycle 05.** The `composite-branch` disposition in §10.2 was derived by scanning
> `EquipmentView.tsx` for asset filenames. Those literals are gone; both tools now derive it from
> `src/equipment/compositeRegistry.json`, and the counts are unchanged. §19.5 adds the wrapper
> measurement and the rule that enforces it; §19.6 records the reachability change.

---

## 11. Composites

Two independent mechanisms decide how attached equipment is drawn.

**Mechanism A — layer composition.** `src/player/resolveWorkbenchScene.ts:190-206, 234, 265` builds
render layers from `AttachmentRelation.renderMode` (`delegated` / `layered` / `independent`),
derived from `InteractionZone.relationType` in `src/domain/interactionZones.ts`. It decides which
child instances stop rendering independently.

**Mechanism B — composite art and child suppression.** `src/player/EquipmentView.tsx:607-639`
hard-codes six parent/child combinations, each with its own asset override and its own
child-suppression rule.

| Composite | Parent | Children | Snap-zone prerequisite | Result asset | Suppresses children |
|---|---|---|---|---|---|
| `funnel-stand-with-filter-paper` | `funnel-stand` | `filter-paper` | **none** | `funnel-paper-stand` | yes, plus a `FunnelCompositeOverlay` filter-cake overlay |
| `chromatography-chamber-with-paper` | `chromatography-chamber` | `chromatography-paper` | `chromatography-chamber-paper-slot` | `chromatography-chamber-with-paper` | yes |
| `volumetric-flask-stoppered` | `volumetric-flask` | `rubber-stopper-set` | `volumetric-flask-stopper-seat` | `volumetric-flask-stoppered` | yes |
| `spectrophotometer-cuvette-inserted` | `spectrophotometer` | `cuvette` | `spectrophotometer-cuvette-slot` | `spectrophotometer-cuvette-inserted` | yes |
| `ring-stand-clay-triangle` | `ring-stand` | `clay-triangle` | `ring-stand-clay-triangle-seat` | `ring-stand-clay-triangle` | yes |
| `ring-stand-clay-triangle-crucible-lid-ajar` | `ring-stand` | `clay-triangle`, `crucible-with-lid` | `ring-stand-crucible-seat` | `ring-stand-clay-triangle-crucible-lid-ajar` | yes |

All six were verified present in the current `EquipmentView.tsx`.

Asset-selection precedence inside `assetOverrideForLayer`
(`src/player/EquipmentView.tsx:607-632`), highest first:

1. `visualCatalog.stateAssets[instance.contents.visualState]`
2. funnel-stand composite
3. chromatography-chamber composite
4. volumetric-flask composite
5. spectrophotometer composite
6. ring-stand + clay-triangle + crucible composite
7. ring-stand + clay-triangle composite
8. `equipmentDefinition.asset`

Three structural observations:

- **The funnel composite has no snap-zone prerequisite.** The other five require the child to be in
  a named snap zone; the funnel branch fires as soon as a `filter-paper` layer with any instance is
  present on the bench. It is the odd one out.
- **A state asset silently defeats a composite, but not its child suppression.**
  `suppressAssetForLayer` (`:633-639`) is computed independently of `assetOverrideForLayer`. If a
  composite parent ever gains a `stateAssets` entry, the parent would render its state art while
  the child stays hidden, showing an assembly that is missing a part. No composite parent has state
  assets today, so this is **latent**, not active. Recorded as `deferred` and owned by Cycle 05.
- **Neither mechanism defines detach, recovery, or reset behaviour** for a composite. Detachment is
  handled generically in `src/runtime/attachments.ts:155-254` with no composite awareness.

> **Resolved by Cycle 05.** §11 describes Mechanism B as it was. All six branches are gone;
> `src/equipment/composites.ts` evaluates the registry for both the renderer and the reducer. All three
> structural observations are closed: the funnel composite now names its snap zone, every composite
> declares composite-aware detach, recovery, and reset, and the state-asset hazard is handled by
> explicit precedence instead of being latent. §11 also missed a **seventh** composite — the reducer's
> `compositeDefinitionId` instance swap — which is now registered. Mechanism A is untouched: layer
> composition from `AttachmentRelation.renderMode` is a different concern and remains in
> `resolveWorkbenchScene.ts`. See §19.3.
>
> **Correction, from the Cycle 05 self-review.** The sentence above describes Mechanism A more
> narrowly than the file does. `childLayerForAttachment`
> (`src/player/resolveWorkbenchScene.ts:87-150`) is not only `renderMode` dispatch: it holds **seven**
> hard-coded `(zoneId, definitionId)` pairs, six of which are exactly the composite participants now
> in the registry — `funnel-stand-paper-seat`/`filter-paper`,
> `chromatography-chamber-paper-slot`/`chromatography-paper`,
> `volumetric-flask-stopper-seat`/`rubber-stopper-set`,
> `spectrophotometer-cuvette-slot`/`cuvette`, `ring-stand-clay-triangle-seat`/`clay-triangle`,
> `ring-stand-crucible-seat`/`crucible-with-lid` — plus `ring-stand-burette-clamp`/`burette-50ml`,
> which is not a composite at all. So a reader counting apparatus-specific branches in the render
> pipeline finds seven, not zero.
>
> They are **placement**, not recognition or suppression, which is why Cycle 05 left them and why they
> do not contradict the acceptance criterion (it names `EquipmentView.tsx` and the reducer). Five of
> the six composite branches are also the same rule written five times — take the zone's box as the
> child's box, at z-index 2 or 3 — differing only in the fallback constants used when the visual
> profile declares no zone. Generalizing them needs a participant-level layout contract the composite
> registry does not have, and changing render geometry is exactly the work this policy cannot verify
> without a browser. Recorded here rather than attempted: **owner Cycle 13**.

---

## 12. Findings ledger

Each row records the claim, its status against current evidence, where the evidence is, the
comparison method used, the scientific consequence, and the cycle that owns remediation.

| # | Claim | Status | Evidence | Method | Consequence | Owner |
|---|---|---|---|---|---|---|
| F-01 | 2,905 process-node records; 1,464 distinct; 1,441 exact repeats | **confirmed** | §5.1 | `exactWithId` | Baseline is safe to enforce against | 02 |
| F-02 | Eight labs duplicate reusable technique behaviour, but their root graphs carry lab-specific order, wording, feedback, and presentation | **corrected** | §5.1, §6 | `exactWithId`, `semantic` | The count of eight is right; the characterization is wrong. Five labs' root nodes are byte-identical to the embedded copies (`blue1-spectroscopy`, `crystal-violet-rate-law`, `equilibrium-rainbow-display`, `hand-warmer-calorimetry`, `quick-ache-relief-separation`); three diverge (`hard-water-analysis`, `hard-water-demo`, `intro-filtration-demo`). `semantic` finds no additional near-duplicates at all, so there is no lab-specific wording layer to preserve in the five | 03-04 |
| F-03 | Technique reuse must import actions only | **deferred** | §2 | source review | Design constraint for Cycles 03-04. Today embedded technique processes and actions are inert in the player, so removing them cannot change player behaviour | 03-04 |
| F-04 | `ActionDefinition` has no atomic identity or equipment-role binding | **confirmed** | `src/domain/types.ts:236-250` | source review | Similar operations can only be inferred from prose and heterogeneous parameters | 02 |
| F-05 | Equipment image selection is driven mainly by definition id, plus state assets and hard-coded composites | **resolved by Cycle 05** | §10.2, §11, §19.1, §19.3 | static extraction | Was confirmed: three mechanisms, one precedence chain, no registry. Selection is now one registry-driven path — `src/equipment/visualStateRegistry.json` for state and reagent-fallback appearance, `src/equipment/compositeRegistry.json` for assemblies, both evaluated in `src/equipment/composites.ts` | 05 |
| F-06 | Some shared images are legitimate physical aliases | **confirmed** | §10.5 | static extraction | 3 aliases; all preserve distinct labels and accessible names. Not debt | — |
| F-07 | Explicit visual states can be ignored or overridden by label heuristics | **resolved by Cycle 05** | §9.4, §19.1 | simulated `resolveLiquidStyle` | Was confirmed: 65 authored instances lost their state, 52 of them baselined, and three dye/analyte samples rendered as plain water. An authored renderable state now wins outright; the measured count is 0, and it is 0 by construction, so `mirror/authored-state-not-first` rather than the count is the guard | 05 |
| F-08 | State assets include active-flow candidates not wired into the player | **confirmed** | §10.3, §10.4 | static extraction | 6 syringe assets unreachable with matching authored states; 12 calorimeter state assets never authored | 12 |
| F-09 | No standalone content-consistency command exists | **resolved by Cycle 02** | `package.json`, `.github/workflows/pages.yml` | source review | Was confirmed: `scripts/checkBundledCatalogs.mts` is wired to no npm script and no workflow. Cycle 02 added `npm run content:check` (`scripts/checkContentConsistency.mjs`) and a CI step before typecheck/test/build. `checkBundledCatalogs.mts` remains unwired | 02 |
| F-10 | Action ids are unique enough to import by id | **rejected** | §5.3 | `exactWithId` | 19 ids carry conflicting definitions across owners; an id-based import would silently pick one | 02, 03-04 |
| F-11 | Each generated technique has one generator | **rejected** | §7.2 | source review | Two generators write `public/techniques/hand-warmer-calorimetry.json` and both rewrite `index.json`; one would replace 241 nodes with 6 | 04 |
| F-12 | A technique id identifies one technique | **rejected** | §6 | `exactWithId` | `crystal-violet-kinetics` names a 38-node lab-embedded technique and a 6-node standalone file with **0 nodes in common** | 03-04, 06 |
| F-13 | Node ids are unique inside one lab file | **rejected** | §5.5 | `exactWithId` | 7 node ids in `hard-water-demo` mean different things in the root process and in an embedded technique | 03-04 |
| F-14 | Spectroscopy instrument lifecycle is incomplete | **corrected** | §8.4 | interaction-type tally | Not uniform. Crystal violet implements the full lifecycle; Blue #1 reads an instrument it never loads; brass has no instrument interaction among 128 actions | 06, 07 |
| F-15 | Hard-water physical-step coverage is incomplete | **rejected** | §8.2, §8.3 | verb + interaction-type tally | `lab:hard-water-analysis` has 68 physical-verb actions and **all 68** carry apparatus-manipulation interactions — the second-best coverage of any source-derived lab. The coverage gap is in Blue #1, brass, redox, beverage, bonding, and quick-ache | 08 (re-scoped) |
| F-16 | Interaction operands are incomplete | **rejected** | §8.1 | operand rules mirrored from `requiresSource`/`requiresTarget` | 0 gaps across all 1,535 authored interactions in runtime-executed owners. A static audit cannot prove the runtime resolves each operand to a bench instance, only that the authoring is complete | — |
| F-22 | Embedded techniques hold equipment and models the runtime needs | **corrected** | §2, §6 | payload rule from `createRuntime.ts:56-78` | Only 4 of 34 carry a consumed payload (`acid-base-titration-state` and the three `intro-filtration-demo` embeds). 20 are shadowed by a lab-level `initialState`; 10 carry nothing at all; none declares a model. The migration constraint is far narrower than the plan assumed | 03-04 |
| F-17 | Seven lab/technique families diverge | **corrected** | §8.3, §7.1, §6 | interaction-type tally | The measured number is 16 standalone techniques with no interaction spec at all: 9 AP-fragment generator stubs, the 2 source-derived Blue #1 techniques, and the 5 original demo techniques. "Seven" is not reproducible under any comparison method used here | 06-12 |
| F-18 | Fallback fixtures are restricted to resource unavailability | **rejected** | §7.3 | source review | The `catch` swallows validation failures and id mismatches too | 03 |
| F-19 | Composite recognition is consistent | **resolved by Cycle 05** | §11, §19.3 | marker-verified static extraction, then registry read | Was corrected: five composites required a snap zone and the funnel composite did not, and none defined detach, recovery, or reset. All seven — the six visual branches plus the reducer's previously unrecorded instance swap — now declare participants with snap zones and composite-aware detach, recovery, and reset | 05 |
| F-20 | A state asset on a composite parent would break child suppression | **resolved by Cycle 05** | §11, §19.3 | source review | Was deferred as latent. Suppression and the asset override are now decided together in one pass: a parent with a state asset keeps its state art and the evaluator draws no composite, so an assembly missing a part cannot be rendered. `composite/parent-has-state-assets` still forbids the situation | 05 |
| F-21 | All fourteen dated source plans have an implementation | **confirmed** | §7 | crosswalk | 505 phase rows, 105 `C` confirmation points, none of which an implementation cycle may decide | 06-12 |

### 12.1 Diagnostics, not targets

The following numbers are recorded so later cycles can detect unintended change. They are **not**
optimization targets, and a cycle that lowers one without a source justification has broken
something:

- 2,905 process nodes / 2,913 actions
- 1,018 `observe`-verb actions, i.e. 49% of the 2,085 runtime-executed action records
- 822 `recordNotebook` interactions of 1,535 total
- apparatus-manipulation share per lab (§8.2)

---

## 13. Machine-readable baseline

`scripts/content-consistency-baseline.json` (schema
`lab-studio/content-consistency-baseline@1`) records every current violation **by stable
identifier**, not by count. Regenerate with:

```bash
node scripts/auditContentInventory.mjs --write-baseline
```

| Category | Entries | Owning cycle |
|---|---|---|
| `authored-initial-state-visual-state-overridden-by-heuristic` | 65 | 05 |
| `authored-visual-state-without-style-or-asset` | 42 | 05 |
| `runtime-unreachable-embedded-technique` | 34 | 03-04 |
| `physical-action-without-equipment-interaction` | 24 | 06-12 |
| `action-id-collision` | 19 | 02 |
| `state-asset-never-authored` | 12 | 12 |
| `unclassified-realistic-asset` | 6 | 05 |
| `node-id-collision-within-lab-file` | 3 | 03-04 |
| `declared-but-unreferenced-action` | 3 | 02 |
| **Total debt** | **208** | |

Cycle 03 regenerated this file: 204 entries, `runtime-unreachable-embedded-technique` down to 31,
`physical-action-without-equipment-interaction` to 23, `declared-but-unreferenced-action` to 2, and
a new `imported-but-unreferenced-action` category with 1 entry. §16.8 itemizes every delta.

`toleratedDifferences` holds 7 entries that are **not** debt and must not be removed by a later
cycle without amending this document: three image aliases, two intentional custom routes, the
teacher-configuration file in `public/labs`, and the gallery-only asset disposition.

Baseline policy: later cycles may **remove** entries. Adding an entry requires updating the
rationale in this document in the same change.

Cycle 02 added a **second, separate** baseline for the rules it introduced,
`scripts/content-consistency-lint-baseline.json`. The two are not merged and are regenerated by
different commands: this one by `node scripts/auditContentInventory.mjs --write-baseline`, the other
by `node scripts/checkContentConsistency.mjs --write-baseline`. See §15.1.

Two fields exist to stop a later cycle from clearing an entry the wrong way:

- `runtime-unreachable-embedded-technique` entries carry `role`, `runtimePayload`, and
  `shadowedPayload`. An entry with a non-empty `runtimePayload` is cleared by **migrating** that
  payload into the lab, never by deleting the technique. Four of the 34 are in that state (§2).
- `authored-initial-state-visual-state-overridden-by-heuristic` entries carry `runtimeExecuted`.
  Clearing an entry means making the authored state win, not deleting the authored state.

---

## 14. Validation performed, and validation intentionally not run

Run in this cycle:

| Command | Result |
|---|---|
| `git status --short` | 289 entries recorded before any edit in this cycle. This cycle adds exactly three repository paths (`docs/step-and-image-consistency-audit.md`, `scripts/auditContentInventory.mjs`, `scripts/content-consistency-baseline.json`) and edits two files inside the already-untracked `atomic_remediation_plan/` package. Every other dirty file is untouched |
| `node --check scripts/auditContentInventory.mjs` | pass |
| `node scripts/auditContentInventory.mjs` | pass; totals match §4-§11 |
| `node scripts/auditContentInventory.mjs --full` | pass |
| `node scripts/auditContentInventory.mjs --write-baseline` | wrote `scripts/content-consistency-baseline.json` (208 debt, 7 tolerated) |
| `node -e "JSON.parse(fs.readFileSync('scripts/content-consistency-baseline.json','utf8'))"` | parsed with a dependency-free JSON parser: 208 debt entries, 7 tolerated |
| `git diff --check -- docs/step-and-image-consistency-audit.md scripts/auditContentInventory.mjs scripts/content-consistency-baseline.json` | exit 0. All three paths are new and untracked, so this check has nothing to inspect; it is recorded for completeness, not as evidence of formatting |

### 14.1 Fidelity review of the audit tooling

`scripts/auditContentInventory.mjs` was reviewed against the source it models, and four defects
were corrected before this document was finalised. All headline counts were unchanged by the
corrections; the *methods* were wrong, which would have misled later cycles.

| Defect | Effect if left | Fix |
|---|---|---|
| Operand rules were invented rather than mirrored from `requiresSource`/`requiresTarget`: a snap zone was treated as required, `pourInto` was required to carry a source, and the `parameters.equipmentDefinitionId` source fallback was missed | The rule was stricter than the runtime in three ways. It passed today, but the first authored action that legitimately omits a snap zone would have been reported as broken | Rules now mirror `interactionIntents.ts:258-278` and `:443-447` exactly; zone/station reported as coverage only (§8.1) |
| Embedded-technique `role` compared a count to an array (`identicalToRoot === nodes`), which is always false | All 14 root-identical copies were misclassified as `partial-root-overlap`, hiding the single most important structural fact in the corpus | Compare against `nodes.length` |
| A lab root inherited every visual state authored by its embedded techniques, because the walk descended into `lab.techniques` | Evidence trails named the wrong owner; a Cycle 05 fix would have been applied to the wrong file | The walk skips `techniques` for `labRoot` owners and visits each embedded technique as its own owner |
| Operand presence used a truthiness test, and `stateAssetBindings` reported the `options` parameter of the shared `profile()` helper as a real state-asset map | A literal `0` or `false` operand would count as absent; the report implied a second state-asset registration that does not exist | Explicit `!== undefined / null / ""` check; helper plumbing filtered out |

The review also produced a substantive correction to this document: §2 and §6 previously described
the seven lab-local techniques as existing "to hold `initialState.equipment` … or models". Measuring
the payload rule directly shows that is true of exactly one of them, and that only 4 of all 34
embedded techniques carry anything the runtime consumes.

Intentionally **not** run, under the `AGENTS.md` repository validation policy:

- `npm test` / Vitest, in any form
- `npm run build`, `npm run typecheck`, and every other `tsc` target
- Playwright, `npm run smoke:e2e`, and any browser or E2E matrix
- Camera and gesture verification
- Performance and mobile QA
- Visual inspection of rendered PNG or SVG output (no asset was created or changed in this cycle)

No TypeScript contract changed in this cycle, so no typecheck was required. The one new file is a
plain `.mjs` script, covered by `node --check`.

---

## 15. Cycle 02 addendum

Added 2026-08-04 by Cycle 02. Cycle 01's numbers are unchanged; the entries below record what a
later cycle measured while turning this evidence into enforcement.

### 15.1 The Cycle 02 lint baseline

`scripts/content-consistency-lint-baseline.json` (schema
`lab-studio/content-consistency-lint-baseline@1`) is a **second, separate** baseline. It records the
violations of the *rules* Cycle 02 introduced, by stable identifier. Cycle 01's
`scripts/content-consistency-baseline.json` stays the audit's inventory and is not regenerated by
the checker.

| Rule | Entries | Relationship to Cycle 01 |
|---|---|---|
| `action/atom-identity-missing` | 770 | New measurement: physical-verb actions in runtime-executed owners, none of which carries an `atomId` yet |
| `visual-state/unresolved` | 42 | Same set as §9.2 |
| `corpus/action-id-collision` | 19 | Same set as §5.3 |
| `visual-state/registered-but-never-authored` | 12 | Same set as §10.4 |
| `action/declared-but-unreferenced` | 8 | Same 8 actions as §5.4, reported per action rather than per owner |
| `source-trace/serialized-in-public-json` | 8 | **New** — see §15.2 |
| `asset/remediation-candidate` | 6 | Same set as §10.3 |
| `composite/recovery-undeclared` | 6 | §11, third structural observation |
| `composite/reset-not-composite-aware` | 6 | §11, third structural observation |
| `composite/missing-snap-prerequisite` | 1 | §11, first structural observation (funnel composite) |
| **Total** | **878** | |

Entries for `action/atom-identity-missing` carry a 12-hex content fingerprint. The exemption holds
only while the action is unchanged, so *editing* a baselined action re-raises the violation. That is
how "new **or modified** physical actions require an atom identity" is enforced against a corpus
that cannot be backfilled in one cycle.

**No public lab or technique JSON was modified in Cycle 02.** Adding an `atomId` to one copy of a
duplicated action would have shifted the exact-duplicate counts in §5.1 and §5.2 and made this
document stale. Seeding therefore happens in the registries, and the corpus is carried on the
baseline.

### 15.2 New finding: source-trace data is already serialized into public JSON

| # | Claim | Status | Evidence | Consequence | Owner |
|---|---|---|---|---|---|
| F-23 | Source-trace data is only ever a build-time contract | **rejected** | 8 owners across 6 files | Three different inline conventions already ship M/F/R/C basis labels to the client | 07, 12 |

| Convention | Owners | Note |
|---|---|---|
| `parameters.sourceBasis` | `lab:brass-colorimetry`, `lab:equilibrium-rainbow-display`, `lab:green-chemistry-mixture-purification`, `technique:equilibrium-rainbow-inquiry` (+ the embedded copy) | Basis label with no step id |
| `parameters.traceabilityBasis` with `process.nodes[].config.traceabilityId` | `lab:hand-warmer-calorimetry`, `technique:hand-warmer-calorimetry` (+ the embedded copy) | Carries step ids, but the generator's own scheme |

A third key, `basis`, is ambiguous and is deliberately excluded from the rule. In the hand-warmer
files it duplicates `traceabilityBasis` inside `process.nodes[].config`; in `crystal-violet-rate-law`
and `crystal-violet-integrated-rate-law-comparison` it appears three times carrying free prose
("linearity of the three integrated-rate-law plots"), which is not a source trace at all. Matching on
it would report the crystal-violet rows falsely, so the rule matches only `sourceBasis` and
`traceabilityBasis`.

The hand-warmer step ids do not match its dated plan. The lab uses `SAF-*`, `CAL-*`, `VOL-*`, `P1-*`,
`P2-*`, and `CER-*`; `hand-warmer-design-challenge_2026-07-27.md` uses `PR-*`, `CA-*`, `IN-*`, and
`CAL-*`. Only `CAL-01`…`CAL-05` coincide. The inline data therefore could **not** be bulk-converted
into the source-trace registry, and `docs/architecture/source-trace-registry.json` was seeded by
hand with 30 verified traces instead. Cycle 12 reconciles the schemes through
`scripts/generateHandWarmerCalorimetry.mjs`, not by hand-editing generated output.

`forbiddenPublicJsonFields` was deliberately **not** extended with these keys: doing so would fail
publishing validation for six files that Cycle 02 is not authorized to rewrite.

### 15.3 Correction to §10: the asset directory is not flat

`public/assets/equipment-realistic/v1` contains a subdirectory, `blender-lab-bench`, holding
`beaker-250ml.png` and `erlenmeyer-flask-250ml.png` Blender render sources. Cycle 01's counts (119
SVG, 120 PNG) covered only the top-level image files and are correct as stated; the directory itself
was not reported. It is now recorded in `src/equipment/assetDispositionRegistry.json` under
`nonAssetEntries`, and the checker fails on any undocumented directory entry so that a future asset
cannot hide inside one.

### 15.4 F-20 is no longer latent-and-unguarded

§11 recorded that a state asset on a composite parent would defeat the composite art without
defeating child suppression. `composite/parent-has-state-assets` now fails the moment any composite
parent gains a `stateAssets` entry. The defect stays unreachable; the guard makes it stay that way.

### 15.5 Citing a dated plan: the two table kinds

The dated plans contain two differently shaped tables, and they are **not** interchangeable as
citations.

| Kind | Columns | Basis |
|---|---|---|
| `phase` | `ID \| Atomic student action \| Basis \| Expected evidence \| Proposed interaction` | Explicit column, copied verbatim |
| `apparatus` | `State \| Atomic action \| Resulting composite \| Validation \| Asset disposition` | **No column at all** |
| `safety` | Numbered safety prerequisite (`S-NN`) | Inline M/F/R/C marker, copied verbatim |

Citing an apparatus row with basis `M` asserts that the manual states that exact step, which it does
not. An apparatus row is table-supported, so its basis must include `F`, compounded with any marker
the row carries inline (`CHR-03` carries `R/C`; `SPEC-01` carries `C`). Where a phase row states the
same step, the phase row is preferred.

Both registries therefore carry `sourceTable` on every citation, and the checker enforces three
rules: the kind must be `phase`, `apparatus`, or `safety`; an `apparatus` citation's basis must
include `F`; and citations agree on basis and table kind because those are properties of the source
row rather than of the citation. Safety and phase IDs are separate namespaces even when both use
text such as `S-08`.

### 15.6 Corrections found by reviewing the Cycle 02 seed

The first pass of the seed was reviewed against the dated plans line by line. It contained three
classes of error, all corrected, and each is now covered by a rule and a self-fixture rather than by
care alone.

| Class | Instances | Correction |
|---|---|---|
| Apparatus rows cited as manual-stated | 15 | `GRAV-00`→`F/C`, `GRAV-01`→`F/C`, `GRAV-02`/`GRAV-03`/`GRAV-04`→`F`, `CHR-01`/`CHR-04`→`F`, `CHR-03`→`F/R/C`, `GAS-03`→`F`, `BATH-02`→`F`, `BRASS-00`→`F/R`, `SPEC-01`→`F/C`, `SPEC-02`→`F`, `CAL-01`/`CAL-04` already `F/R` |
| Wrong step cited | 4 | `C-09` ("Observe color/state change") → `C-08` ("Apply one approved stress dropwise"); `DRY-05` → `FD-19` (weigh) and `FD-18` (cool); `DRY-02` → `FD-17` (second drying stage) |
| Basis letter transcribed wrong | 5 | `P-08` `M/C`→`R/C`, `P-09` `M`→`M/R`, `C-06` `M`→`M/C`, `C-07` `M`→`M/R`, `K-04` `M`→`R/C` |

The `C-09` error is the substantive one: it attributed a physical stress-application atom to an
observation step. The `K-04` and `P-08` errors ran the other way, recording a teacher-configuration
point as manual-stated — the exact failure mode the `C` label exists to prevent.

Three code defects were fixed in the same review:

1. **`process/unresolved-action-reference` false-positived on `techniqueRefs`.** A lab importing an
   action and referencing it from a process node was reported as having an unresolved node and an
   unreferenced action. Cycle 03's first migration would have failed CI for doing exactly what it is
   chartered to do. Node references now resolve through `techniqueRefs`, and a positive fixture
   guards it.
2. **Structural rules skipped runtime-unreachable owners.** Unresolved references, unreferenced
   actions, operand completeness, and interaction/verb compatibility now run on all 91 owners rather
   than the 57 runtime-executed ones. Measured cost: **zero** additional baseline entries. Atomic
   identity, role bindings, and source traceability stay scoped to runtime-executed owners, because
   requiring them on the 34 embedded techniques would add ~327 entries for content Cycles 03-04 are
   chartered to migrate or delete.
3. **Composite source verification checked one weak marker.** It confirmed only that the result
   asset filename appeared in `EquipmentView.tsx`. It now requires the parent, every child, and the
   snap-zone prerequisite as well — the parts the registry actually claims to record. All six
   composites still pass, which is what makes §11's transcription trustworthy rather than merely
   asserted.

### 15.7 Validation run by Cycle 02

| Command | Result |
|---|---|
| `node --check scripts/checkContentConsistency.mjs` | pass |
| `node scripts/checkContentConsistency.mjs` | pass, exit 0: 24/24 self-fixtures, 878 violations, 0 new, 0 changed fingerprint, 0 resolved, documentation up to date |
| `npm run content:check` | same, through the new npm script |
| `node scripts/checkContentConsistency.mjs --write-docs` | wrote `docs/atomic-steps.md` (762 lines) |
| `node scripts/checkContentConsistency.mjs --write-baseline` | wrote `scripts/content-consistency-lint-baseline.json` (878 entries) |
| `npm run typecheck` (`tsc -b`) | pass; run because `ActionDefinition` and two new typed readers changed |
| baseline tamper check | removing one baselined id made the run exit 1 with `NEW`; corrupting one fingerprint made it exit 1 with `CHANGED`; both restored by regenerating |
| `git diff --check` on the four modified tracked files | exit 0 |

Intentionally **not** run, under the `AGENTS.md` repository validation policy: `npm test` / Vitest in
any form (including the two test files this cycle authored), `npm run build`, Playwright and any
browser or E2E matrix, camera and gesture verification, performance and mobile QA. No asset was
created or changed, so no visual inspection was required.

---

## 16. Cycle 03 addendum

Added by Cycle 03 (`atomic_remediation_plan/CONTINUATION_CYCLE_03.md`) on 2026-08-04. This cycle
introduced version-pinned action-only technique hydration and migrated one lab,
`intro-filtration-demo`, to prove the contract. No other lab was migrated and no activity behaviour
was remediated.

### 16.1 The two contracts

A file under `public/labs/` is now a **bundled lab source**, not a `LabDefinition`. Its `process`
may reference actions that only a referenced technique publishes, so it is checked by
`validateBundledLabSource` on disk and by `validateLabDefinition` again after hydration. Every rule
the raw contract relaxes — action-id resolution when a reference selects `"all"` — is re-applied to
the array the runtime actually receives.

| Stage | Contract | Owner |
|---|---|---|
| on disk | `validateBundledLabSource` (`src/domain/validation.ts`) | shape of `techniqueRefs`, plus the lab contract with imported ids seeded |
| resolution | `hydrateBundledLab` (`src/data/hydrateBundledLab.ts`) | version, selection, collisions, imported dependencies, node resolution |
| resolved | `validateLabDefinition` | the existing self-contained lab contract |

Referenced techniques contribute **actions only**. Hydration copies no process node, edge, equipment
instance, model, success criterion, or presentation string, and the resolved definition carries no
`techniqueRefs` key, so runtime, Studio, and exported artifacts never see an unresolved reference.

Imported actions are `structuredClone`d, never aliased. `loadBundledTechnique` memoizes one
`TechniqueDefinition` per id, so handing its action objects straight to a lab would make every lab
that imports a technique share mutable state with the cache and with each other — a coupling that
would first bite once Cycle 04 migrates eight more labs. "Self-contained" has to mean the object
graph, not just the absence of a `techniqueRefs` key.

### 16.2 The `intro-filtration-demo` pilot, before and after

The §6 row for this lab said its three embedded techniques were `root-divergent-copy` entries whose
nodes appear nowhere in the lab root process, and that they were one of only two embedded payloads
the runtime consumes — here, the lab's starting equipment, because the lab had no `initialState`.
Both facts shaped the migration.

| | Before | After |
|---|---|---|
| lab root `actions` | 13 | 3 lab-local (`transfer-sample`, `precipitate-caco3`, `filter-mixture`) |
| resolved actions at runtime | 13 | 13 (10 imported + 3 lab-local) |
| embedded `techniques` | 3 (12 nodes, 12 actions) | `[]` |
| `initialState.equipment` | absent; derived from the embedded techniques | 9 instances, byte-identical to what was derived |
| root process nodes / edges / `startNodeId` | 9 / 8 / `demo-measure-node` | unchanged, byte-identical |
| `equipment`, `assessments`, `metadata`, all node titles, hints, feedback, layout | — | unchanged, byte-identical |

Selected references:

```json
[
  { "techniqueId": "measuring-volume", "version": "1.0.0",
    "actionIds": ["place-cylinder", "measure-20ml", "record-volume"] },
  { "techniqueId": "transfer", "version": "1.0.0",
    "actionIds": ["place-beaker", "observe-transfer"] },
  { "techniqueId": "filtration", "version": "1.0.0",
    "actionIds": ["assemble-funnel-stand", "place-filter-paper", "wet-filter-paper",
                  "place-filtration-receiver", "rinse-precipitate"] }
]
```

Each of the ten imported actions was byte-identical to the standalone technique's action before the
migration, so importing changes nothing a student sees. The resolved set is the same thirteen
actions with the same content; only the array **order** changes, because hydration is defined as
imports-then-locals:

```
before:   place-cylinder, measure-20ml, record-volume, place-beaker, transfer-sample,
          observe-transfer, precipitate-caco3, assemble-funnel-stand, place-filter-paper,
          wet-filter-paper, place-filtration-receiver, filter-mixture, rinse-precipitate
resolved: place-cylinder, measure-20ml, record-volume, place-beaker, observe-transfer,
          assemble-funnel-stand, place-filter-paper, wet-filter-paper,
          place-filtration-receiver, rinse-precipitate, transfer-sample, precipitate-caco3,
          filter-mixture
```

Array order is read in exactly one place: `actionForIntent` in `src/runtime/interactionIntents.ts`
falls back to the first action whose interaction type matches the intent, but only when the current
node declares no `actionId`. All nine nodes of this lab declare one, so the reordering is
unreachable here. Cycles 04+ must re-check this for any lab with an action-less node.

### 16.3 Three actions deliberately stayed lab-local

`transfer-sample` and `filter-mixture` are **not** imported. Both differ from the standalone
technique's version, and only in learner-facing wording:

| Action | Field | `public/techniques/` | `intro-filtration-demo` |
|---|---|---|---|
| `transfer-sample` | `feedback.success` | "The sample is transferred to the beaker." | "The 20 mL sample is transferred to the beaker." |
| `transfer-sample` | `interaction` | absent | authored `pourInto` spec |
| `filter-mixture` | `interaction.successCue` | "Precipitate remains on the filter paper." | "The precipitate remains on the seated filter paper." |
| `filter-mixture` | `interaction.invalidCue` | "The funnel must contain seated, wetted paper before filtering." | "Use the beaker as the source and the prepared funnel with filter paper as the target." |

Importing them would have rewritten the lab's own feedback, which Cycle 03 is explicitly forbidden
to do. `precipitate-caco3` has no standalone counterpart at all. This is the sense in which the
acceptance criterion is met: **behavioural** action duplication dropped by ten, and the remaining
three copies are presentation differences that are now documented rather than hidden.

### 16.4 Four imported actions the lab does not use

`place-cylinder`, `record-volume`, `place-beaker`, and `observe-transfer` are referenced by no
process node and no assessment. They were carried across deliberately, so that the resolved action
set is exactly the pre-migration set and the pilot proves hydration in isolation from any content
decision. Removing them is a content change with its own evidence requirement, not a side effect of
a mechanical migration.

They were already baselined as `action/declared-but-unreferenced`. Migrating them out of `actions`
would have retired that rule for them silently, so Cycle 03 added `action/imported-but-unreferenced`
with the same reach and moved the four entries to it. The baseline shows this as four resolved
entries and four new ones; the rationale is this paragraph. Cycle 04 or a later content cycle may
drop them, which drops the four entries too.

### 16.5 The fallback boundary is now explicit

Before this cycle, `loadBundledLab` and `loadBundledTechnique` fell back to the `src/domain/fixtures.ts`
copy on **any** error. A lab whose public JSON failed validation therefore rendered the fixture
instead — the app looked healthy while serving content nobody had edited. Failures are now
classified once, in `src/data/bundleErrors.ts`:

- `BundleResourceError` — the bytes could not be obtained (network failure, non-OK status,
  unparseable JSON). A fixture may stand in.
- `BundleContentError` — the bytes arrived and are wrong (schema, reference, version, id mismatch).
  It surfaces; the route shows "Definition unavailable".

The boundary is drawn once more inside `loadBundledLab`: once the index and the lab's own JSON have
loaded, the public bundle is demonstrably reachable, so a technique that will not resolve is a
broken bundle rather than an offline client, and it may not fall back either.

### 16.6 What Cycle 03 enforces statically

`scripts/checkContentConsistency.mjs` gained the static half of the same contract, so a bad
reference fails CI rather than only the browser. New rules:
`technique-ref/unsupported-owner`, `technique-ref/duplicate-technique`,
`technique-ref/version-not-pinned`, `technique-ref/empty-selection`,
`technique-ref/imported-equipment-undeclared`, `technique-ref/imported-model-undeclared`, and
`action/imported-but-unreferenced`. Self-fixtures went from 24 to 32; each new rule has a negative
fixture. One reporting bug was fixed while adding them: the text output printed `NEW [object
Object]` instead of the violation id, which had never been visible because Cycle 02 ended with zero
new violations.

**`mirror/drift` — a claim made true.** The checker cannot import TypeScript, so it hand-copies four
vocabularies from source: `actionVerbs`, `compatibleInteractionVerbs` and
`interactionOperationTypes`, the unconditional clauses of `requiresSource` / `requiresTarget`, and
(new in Cycle 03) `actionEquipmentParameterKeys` / `actionModelParameterKeys`. Its header claimed
"the checker verifies the mirrors against the source"; **it did not** — nothing read
`src/domain/types.ts`, `src/domain/interactions.ts`, `src/runtime/interactionIntents.ts`, or
`src/domain/validation.ts`. Cycle 03 added the mirror copy and would have compounded an unverified
claim, so `checkVocabularyMirrors` now re-reads each declaration and reports `mirror/drift`.
`PHYSICAL_VERBS` and a new `NON_PHYSICAL_VERBS` must partition `actionVerbs` exactly, so adding a
verb to `types.ts` forces an explicit classification instead of silently landing in the set that
needs no atom identity. All four mirrors currently agree: **0 violations**. Drift detection was
tamper-tested against the real sources (§16.9), not only against a fixture.

The parsers read the shapes those declarations use today. If one is rewritten into a shape they
cannot read, the parsed set comes back different and the rule fires — a false alarm that forces a
human to look, never a silent pass.

### 16.7 New finding: `lab.initialState` is not validated at all

`validateLabDefinition` checks `id`, `title`, `description`, `audience`, `learningGoals`,
`safetyNotes`, `equipment`, the three model arrays, `techniques`, `actions`, `process`,
`assessments`, and `metadata`. It **never validates `lab.initialState`**. `validateTechniqueDefinition`
does validate `technique.initialState.equipment` — instance id, definition id against the catalog,
location enum, snap-zone resolution and acceptance, numeric position fields, interaction-status
enum, contents shape — roughly 40 lines that have no lab-level counterpart.

Fourteen public labs now carry a lab-level `initialState`, together holding 356 equipment
instances. Thirteen of them — 347 instances — have never been checked by any contract. This is
pre-existing and was not introduced by Cycle 03, but Cycle 03 is the first change to *depend* on the
field, so it is recorded here rather than left implicit.

The pilot's own nine instances are not in that unchecked set. They are byte-identical to the
instances of the three embedded techniques, and those were validated before the migration:
`validateLabDefinition` → `validateTechniqueDefinition(technique)` → the `initialState.equipment`
block above. Every instance in the union appears in at least one of the three, so the pilot's
`initialState` carries inherited validation evidence.

Not fixed here. Extending the contract to labs would apply an unexercised rule to thirteen labs this
cycle is forbidden to touch, with no content evidence in hand for whatever it finds. It belongs to
Cycle 05, which already owns the visual-state and equipment-instance foundations; the shared block
should be extracted rather than copied.

### 16.8 What the migration moved in the Cycle 01 baselines

Removing three embedded techniques changes the corpus §5 measured, so `§5` and the §6 table now
describe the pre-Cycle-03 corpus. Re-running `node scripts/auditContentInventory.mjs` gives:

| Measure | Cycle 01 (§5) | After the pilot |
|---|---|---|
| owners | 91 (17 lab roots, 34 embedded, 40 standalone) | 88 (17 / **31** / 40) |
| authored process-node records | 2,905 (1,155 / 828 / 922) | **2,893** (1,155 / **816** / 922) |
| distinct nodes, `exactWithId` | 1,464 | 1,464 |
| exact node repeats | 1,441 | **1,429** |
| authored action records | 2,913 (1,163 / 828 / 922) | **2,891** (**1,153** / **816** / 922) |
| distinct actions, `exactWithId` | 1,446 | 1,446 |
| exact action repeats | 1,467 | **1,445** |
| distinct action ids | 1,425 | 1,425 |

Both distinct counts are unchanged, which is the point: the 12 removed nodes and 22 removed action
records were all exact repeats of records that still exist in the standalone technique files.
Nothing distinct was lost. The action delta is 12 embedded plus the 10 lab-root copies the
references replaced; the node delta is the 12 embedded nodes only, because the lab root process was
not touched.

`scripts/content-consistency-baseline.json` was regenerated: 208 debt entries to 204. Every delta:

| Change | Entry | Why |
|---|---|---|
| −3 | `embedded-technique:intro-filtration-demo/{measuring-volume,transfer,filtration}` | resolved; this was the migration |
| −1 | `physical-actions-without-interaction:lab:intro-filtration-demo` | its two actions, `place-cylinder` and `place-beaker`, are still counted under `technique:measuring-volume` and `technique:transfer`. A duplicate row went away, not the debt |
| −1 / +1 | `unused-actions:lab:intro-filtration-demo` → `unused-imported-actions:lab:intro-filtration-demo` | same four ids, new category (§16.4) |
| −1 / +1 | `visual-state-overridden:lab:intro-filtration-demo/technique:measuring-volume:sample-bottle-1` → `…:lab:intro-filtration-demo:sample-bottle-1` | the `sample-bottle-1` instance moved to the lab's own `initialState`; still Cycle 05's |
| evidence only | four `action-id-collision:*` rows | owner lists no longer name the removed embedded techniques |

`scripts/auditContentInventory.mjs` needed two changes to stay truthful: it now resolves process
node references through `techniqueRefs` (without it, the pilot's six imported-action nodes were
reported as unresolved references, which they are not), and it records
`unusedImportedActions` / `imported-but-unreferenced-action` so migrating an unused action out of
`actions` cannot retire that debt silently.

### 16.9 Validation run by Cycle 03

| Command | Result |
|---|---|
| `node --check` on `checkContentConsistency.mjs` and `auditContentInventory.mjs` | pass |
| `npm run content:check` | pass, exit 0: 32/32 self-fixtures, 870 violations, 0 new, 0 changed fingerprint, 0 resolved, documentation up to date |
| mirror tamper check | four edits to real source — a verb added to `actionVerbs`, a key removed from `actionEquipmentParameterKeys`, a verb added to `compatibleInteractionVerbs.dispenseDrops`, a clause removed from `requiresTarget` — each produced the matching `mirror/drift` id; all three files restored and verified byte-identical with `cmp` |
| `node scripts/checkContentConsistency.mjs --write-baseline` | wrote `scripts/content-consistency-lint-baseline.json` (870 entries) after review of the 12 resolved and 4 new ids |
| `npm run typecheck` (`tsc -b`) | pass; run because `types.ts`, `validation.ts`, the loaders, and Studio export changed |
| `git diff --check` on the Cycle 03 files | exit 0 |
| content parity of the pilot | scripted comparison against `git show HEAD:…/intro-filtration-demo.json`: same 13 action ids, each byte-identical; `process`, `equipment`, `assessments`, `metadata` byte-identical; derived initial equipment byte-identical |

Intentionally **not** run, under the `AGENTS.md` repository validation policy: `npm test` / Vitest in
any form, including the three test files this cycle authored or updated
(`src/data/__tests__/hydrateBundledLab.test.ts`, `src/data/__tests__/bundleFallback.test.ts`,
`src/data/__tests__/bundles.test.ts`) and the Studio export cases in
`src/studio/__tests__/importExport.test.ts`; `npm run build`; Playwright and any browser or E2E
matrix; camera and gesture verification; performance and mobile QA. No asset was created or changed.

**Consequence to carry forward:** the hydrator's *runtime* behaviour is unexecuted. Everything above
is established by type checking, static rules, and content comparison. The first authorized dynamic
run should start with `src/data/__tests__`.

---

## 17. Cycle 04 addendum

Added by Cycle 04 (`atomic_remediation_plan/CONTINUATION_CYCLE_04.md`) on 2026-08-04. This cycle
migrated the seven remaining duplicated labs to the Cycle 03 contract. No activity behaviour, visual
state, asset, or composite was remediated.

### 17.1 What each lab now imports

All eight labs in the migration set — the Cycle 03 pilot plus these seven — are bundled sources with
`techniques: []`, an explicit `initialState.equipment`, and version-pinned action-only
`techniqueRefs`. The **resolved** action count is the pre-migration authored root-action count in
every case, so nothing was dropped; behaviour moved from a lab-root copy to the one shared identity.

| Lab | Refs | Selection | Imported | Lab-local | Resolved | Nodes |
|---|---|---|---|---|---|---|
| `intro-filtration-demo` | 3 | explicit × 3 (Cycle 03) | 10 | 3 | 13 | 9 |
| `hard-water-demo` | 3 | `measuring-volume` all, `filtration` 4 of 6, `drying` all | 10 | 5 | 15 | 14 |
| `quick-ache-relief-separation` | 4 | all × 4 | 32 | 0 | 32 | 32 |
| `hard-water-analysis` | 5 | all × 5 | 131 | 0 | 131 | 131 |
| `blue1-spectroscopy` | 3 | all × 3 | 115 | 16 | 131 | 131 |
| `crystal-violet-rate-law` | 4 | all × 4 | 73 | 41 | 114 | 111 |
| `equilibrium-rainbow-display` | 1 | all (`@2.0.0`) | 161 | 0 | 161 | 161 |
| `hand-warmer-calorimetry` | 1 | all (`@2.1.0`) | 241 | 0 | 241 | 241 |

`"all"` was used only where the lab consumes the pinned technique's full published set. That holds
exactly for every `"all"` above, with one knowing exception: `hard-water-demo` imports
`measuring-volume`'s `place-cylinder`, which no node uses, so its resolved set stays exactly the
pre-migration set (see §17.5). `hard-water-demo`'s `filtration` entry is the only explicit subset in
the set, because the lab keeps divergent copies of the other two (§17.3).

Every migrated lab has **0 nodes without an `actionId`**, so §16.2's caveat — hydration's
imports-then-locals array order is read only by `actionForIntent`'s no-`actionId` fallback — is
unreachable in all eight. That re-check was Cycle 03's explicit hand-off to Cycle 04.

### 17.2 `hard-water-analysis` adopted the shared identity by dropping a prefix

This lab was the only one whose root actions did not already use the reusable ids. All 131 carried a
`<techniqueId>--` prefix (`hard-water-practice-preparation--weigh-sodium-carbonate`), and each was
byte-identical to the standalone technique's action once the prefix was removed from `id` alone. §5.5
recorded that the lab "cannot be migrated by id alone"; the resolution was to make the unprefixed id
the one stable shared identity and rebind the lab's own references to it.

Rebound: 131 `process.nodes[].actionId`, 131 `process.nodes[].validation[].actionId`, and 5
`assessments[].actionId`. Node ids keep their prefixes — they are lab-owned and were never in
conflict. The 131 bare ids are unique across the five pinned techniques (0 collisions), so no
identity had to be renamed or merged.

### 17.3 Five actions deliberately stayed lab-local in `hard-water-demo`

The same reason as §16.3: importing them would rewrite the lab's own learner-facing text.

| Action | How it differs from `public/techniques/` |
|---|---|
| `transfer-sample` | success feedback names the 20 mL volume; the lab authors a `pourInto` interaction the technique has none of |
| `place-filtration-receiver` | different invalid feedback, an authored `invalidCases` array the technique leaves empty, and a different `stateChanges` string |
| `filter-mixture` | different `interaction.invalidCue` |
| `calculate-hardness` | extra `evidence` kinds, four authored `prerequisites`, different invalid feedback, and `parameters` without the technique's `precipitateMassG` / `sampleVolumeMl` |
| `precipitate-caco3` | no standalone counterpart at all |

`transfer` is referenced by no `techniqueRefs` entry: `transfer-sample` is the only one of its three
actions this lab uses, and it is divergent. `hard-water-calculation` likewise gets no ref.

In `crystal-violet-rate-law`, 41 actions stay lab-local: the 38 kinetics actions, whose standalone
`crystal-violet-kinetics` technique has 6 nodes with **none** in common (§6), and the three
`cv11-extension-*` actions of §5.4. In `blue1-spectroscopy`, 16 stay lab-local — the unknown-sample,
inquiry-approval, and post-lab reasoning steps that no technique publishes.

### 17.4 What removing the embedded copies cost, including one loss

24 embedded techniques were removed, leaving 7 — exactly the `lab-local-state-carrier` entries of §6.
Re-running `node scripts/auditContentInventory.mjs`:

| Measure | After Cycle 03 | After Cycle 04 |
|---|---|---|
| owners | 88 (17 lab roots / 31 embedded / 40 standalone) | **64** (17 / **7** / 40) |
| authored process-node records | 2,893 (1,155 / 816 / 922) | **2,086** (1,155 / **9** / 922) |
| distinct nodes, `exactWithId` | 1,464 | **1,463** |
| exact node repeats | 1,429 | **623** |
| authored action records | 2,891 (1,153 / 816 / 922) | **1,321** (**390** / **9** / 922) |
| distinct actions, `exactWithId` | 1,446 | **1,315** |
| exact action repeats | 1,445 | **6** |
| distinct action ids | 1,425 | **1,294** |
| node-id collisions within one lab file | 3 | **0** |

The action figures need care. 1,570 action records went away and the *distinct* count fell by 131 —
but those 131 are not lost definitions: they are `hard-water-analysis`'s prefixed ids, which were
distinct only because of the prefix (§17.2). Each survives under its unprefixed identity in the
standalone technique. Distinct action **ids** fell by the same 131 for the same reason.

**The node figures record a loss of one distinct record.** A second loss occurred mid-cycle and was
repaired:

- **1 node, `hard-water-demo/filtration:place-receiver-node`** — deliberate. Recoverable from
  `git show HEAD:` and inspected: it differs from the standalone's node only in generated
  boilerplate — a generic validation label (`Action place-filtration-receiver was completed.` versus
  `Receiving flask has been placed.`), an empty `hints` array where the standalone authors one, and
  generic feedback. The standalone keeps a strictly better-authored version of the same step.
- **3 nodes, `crystal-violet-hydroxide-order-extension` — removed in error, then restored.** §5.4
  states these carry the crystal-violet source's optional `z`/`k` extension, an unresolved `C`
  confirmation point, and that "retaining them is source-faithful". The embedded technique is a
  `lab-local-state-carrier` with no standalone counterpart, so it was never a duplicate and belonged
  with the other six carriers. Cycle 04's migration emptied `techniques` wholesale and took it too.
  See §17.4.1 for the repair; the counts above are post-repair.

#### 17.4.1 Repairing the carrier

`public/labs/crystal-violet-rate-law.json` is untracked, so `git` held no copy. The carrier was
recovered from an untracked historical worktree that still contains the `ap-`-prefixed generation of
the same lab:

```
C:\Users\EmilJivishov\.codex\worktrees\a436\Projects\Lab_studio\public\labs\
  ap-chem-investigation-11-crystal-violet-rate-law.json
```

Its `techniques[ap-investigation-11-hydroxide-order-extension]` has canonical SHA-256
`cdfb63cc0ecdcda1227fe2e1685a9a1612119633d4a4fa1fbcfc34f3ff385670`. It was restored **verbatim except for two
fields**: `id` became `crystal-violet-hydroxide-order-extension`, and `metadata.tags` had its shared
3-token prefix swapped. The id is not a guess — §6's table, §5.4's prose, and the Cycle 01 debt entry
all name `techniques[crystal-violet-hydroxide-order-extension]`. The tag swap is justified below.

What makes the recovery faithful:

| Recorded fact about the deleted carrier | Recovery source |
|---|---|
| 3 actions, `cv11-extension-{approval-gate,design-hydroxide-series,determine-z-and-k}` | present, and **byte-identical** to the three surviving lab-local actions |
| 3 nodes, `nodesIdenticalToLabRoot` = 0 | 3 nodes, 0 identical to the current lab root |
| `runtimePayload` = `[]`, `shadowedPayload` = `[]` | `initialState.equipment` is empty; no titration, chromatography, or kinetics model |
| `standaloneExists` = false | no `public/techniques/crystal-violet-hydroxide-order-extension.json` |

The decisive check is the regenerated debt entry: `node scripts/auditContentInventory.mjs
--write-baseline` reproduces
`embedded-technique:crystal-violet-rate-law/crystal-violet-hydroxide-order-extension` **byte-identical
to the Cycle 01 entry**, including `role`, `runtimePayload`, `shadowedPayload`, `nodes`, `actions`,
`nodesIdenticalToLabRoot`, `standaloneExists`, and `nodesIdenticalToStandalone`. Every property the
audit ever measured about the deleted carrier holds for the restored one.

The same worktree holds the generator that produced this lab,
`scripts/generateCrystalVioletRateLawInvestigation.mjs` — the only copy in any worktree, and absent
from `Projects/`. Its `extensionTechnique` block (`:1072-1080`) matches the recovered carrier field for
field, which independently confirms the recovery source is generator output rather than a hand edit.

**One field is derivable, one is not.** The rename pass that produced the current unprefixed lab
changed `id`, `title`, and `metadata.tags` together for all five renamed siblings, so it certainly
touched the carrier's too.

- **`metadata.tags` — transformed, from a verified rule.** The generator emits
  `["technique", "ap-chemistry", "investigation-11", ...ownTags]` from one shared helper (`:246`) for
  all six embedded techniques, and all 4 comparable siblings now carry
  `["technique", "chemistry", "crystal-violet", ...same ownTags]`. Only that 3-token prefix moves, so
  the carrier's tags were swapped the same way. Its own four tags — `optional`,
  `teacher-approval-required`, `order-z`, `rate-constant-k` — are untouched.
- **`title` — kept as the recovery source's.** The title change is editorial with no derivable rule
  ("Investigation 11 Integrated-Rate-Law Comparison" → "Integrated Rate-Law Comparison", but
  "Investigation 11 Spectrophotometer Calibration" → "Crystal Violet Spectrophotometer Calibration").
  Rather than invent one, the carrier keeps `"Investigation 11 Optional Hydroxide-Order Extension"`.
  It is a technique-level label on a runtime-unreachable owner and is not learner-facing: the lab root
  process is untouched and an embedded technique's process is never executed
  (`src/runtime/createRuntime.ts:18-27`). A later cycle may re-title it with evidence.

**The original generator's own test corroborates both structural decisions.**
`src/domain/__tests__/crystalVioletRateLawDefinition.test.ts` in that worktree asserts that no lab
root node references a `cv11-extension-` action (`:189`) and that the carrier is absent from
`techniques/index.json` (`:191`). So keeping the extension out of the root process and out of the
technique index is the authors' recorded intent, not a Cycle 04 judgement call. Both are now enforced
by `scripts/verifyCycle04Migration.mjs` and asserted in `src/data/__tests__/cycle04Migrations.test.ts`.

**The nodes were not appended to the lab root process, and must not be.** The extension is gated on
teacher approval and is optional; putting its three nodes in the root graph would convert an optional
branch into required student flow and pre-empt the `C` point. The lab root keeps its 111 nodes, and
the three `cv11-extension-*` actions stay declared-but-unreferenced — which is exactly the state
§5.4 describes and the shape Cycle 06 needs. `scripts/verifyCycle04Migration.mjs` now enforces five
properties: the carrier is present, its nodes are absent from the root process, no root node
references a carrier action, it contributes no runtime payload, and it is not published into
`techniques/index.json`. Each was tamper-tested with a byte-identical restore afterwards.

### 17.5 Baseline movement, itemized

`scripts/content-consistency-baseline.json`: **204 → 161**. One entry added, 44 removed, 37 changed
in evidence only.

| Change | Entries | Why |
|---|---|---|
| −24 | `embedded-technique:*` in the seven migrated labs | resolved; this was the migration. All 24 were duplicate copies. `crystal-violet-hydroxide-order-extension` is **not** among them: its entry regenerated byte-identical after the §17.4.1 repair |
| −3 | `node-id-collision:lab:hard-water-demo/{measuring-volume,transfer,filtration}` | §5.5's seven colliding node ids exist once again; the category is now empty |
| −13 | `visual-state-overridden:*/technique:*` | **duplicate rows, not debt.** Every one of the 13 instances still has a surviving row under the standalone technique owner and under the lab's own `initialState`; checked pairwise. Cycle 05's real debt is unchanged |
| −3 | `physical-actions-without-interaction:lab:{blue1-spectroscopy,hand-warmer-calorimetry,hard-water-demo}` | **duplicate rows.** The same actions are still counted under `technique:blue1-standard-dilutions` (28/28), `technique:blue1-percent-transmittance` (9/9), `technique:hand-warmer-calorimetry` (53/2), and `technique:measuring-volume` (2/1). Cycles 06-12 own the same work |
| −1 / +1 | `unused-actions:lab:hard-water-demo` → `unused-imported-actions:lab:hard-water-demo` | same id, `place-cylinder`, new category, exactly as §16.4 did for the pilot |
| evidence only | 7 `action-id-collision:*`, 30 `visual-state-unresolved:*` | owner lists no longer name the removed embedded techniques |

`unused-actions:lab:crystal-violet-rate-law` survives with its three `cv11-extension-*` ids. That is
deliberate: it is the surviving marker for the `C` point discussed in §17.4.

`scripts/content-consistency-lint-baseline.json`: **870 → 561**, with 32/32 self-fixtures still
passing.

| Change | Entries | Why |
|---|---|---|
| −306 | `action/atom-identity-missing:lab:*` across the seven labs | **duplicate rows.** Each of the 306 was verified to have a surviving entry for the same identity under its technique owner; 0 uncovered |
| −3 | `source-trace/serialized-in-public-json` | the two embedded-technique owners are gone, and `lab:hand-warmer-calorimetry` no longer declares actions. F-23's substance is untouched: `technique:hand-warmer-calorimetry/traceabilityBasis`, `technique:equilibrium-rainbow-inquiry/sourceBasis`, `lab:equilibrium-rainbow-display/sourceBasis`, `lab:brass-colorimetry` and `lab:green-chemistry-mixture-purification` remain. Cycles 07 and 12 still own the removal |
| −1 / +1 | `action/declared-but-unreferenced` → `action/imported-but-unreferenced` for `hard-water-demo/place-cylinder` | as above |
| evidence only | 7 `corpus/action-id-collision:*` | owner lists |

### 17.6 Registry citations follow the identity

`src/domain/atomRegistry.json` and `docs/architecture/source-trace-registry.json` cite an owner plus
an action id, so 45 citations — 26 atom `contentExamples` and 19 traces — named a lab that no longer
declares the action. Each was repointed to the technique that publishes it, dropping the
`hard-water-analysis` prefix where §17.2 applies. Nothing else changed: the atom, dated source file,
table kind, step, and basis are properties of the source row, not of the owner, and were copied
verbatim. `docs/atomic-steps.md` was regenerated from the atom registry; its diff is owner labels
only. Without this the checker reported 23 `registry/atom-content-example-missing` and 16
`source-trace/unknown-action` violations; both are back to 0.

### 17.7 The hand-warmer generator now emits a bundled source

`scripts/generateHandWarmerCalorimetry.mjs` owns both `public/techniques/hand-warmer-calorimetry.json`
and `public/labs/hand-warmer-calorimetry.json`, so the lab was regenerated rather than hand-edited.
The generator now emits `techniqueRefs`, `techniques: []`, `actions: []`, and an explicit
`initialState`, and asserts three invariants that previously lived only in prose: 143 traceability
rows (pre-existing), 241 actions/nodes/assessments, and that `"all"` is fully consumed by the process.

The technique file it wrote is **byte-identical** to the previous one, which is what makes the
`@2.1.0` pin valid. `public/techniques/index.json` is byte-identical. The lab file differs from its
pre-run content in the three migration keys and in one more place:

- `description` changed from `"An Chemistry calorimetry investigation…"` to `"A calorimetry
  investigation…"`. The generator and `public/labs/index.json` had drifted, and the first generator
  run overwrote the index's (uncommitted) wording. The generator's string was corrected to the
  index's instead, so all three now agree and the generator is idempotent. This is a one-string
  visible-text change made to preserve uncommitted work, not a content decision.

F-23 is untouched here: `traceabilityBasis` is still serialized into the technique's action
parameters, as Cycle 12 requires.

### 17.8 Evidence quality, and where it is weaker than Cycle 03's

Cycle 03 proved the pilot's parity with `git show HEAD:`. That was available for only one lab this
cycle. `blue1-spectroscopy`, `crystal-violet-rate-law`, `hard-water-analysis`, and
`quick-ache-relief-separation` are **untracked**, and `equilibrium-rainbow-display`'s and
`hand-warmer-calorimetry`'s pre-migration states were uncommitted work, so no stored copy of the
pre-migration bytes exists. Cycle 04 did not snapshot them before editing, so that comparison cannot
be reproduced. Three tiers of evidence stand in:

| Tier | Method | Coverage |
|---|---|---|
| A | full `git show HEAD:` key-by-key comparison plus resolved-action byte comparison | `hard-water-demo` only: every key byte-identical except `techniques`/`actions`/`techniqueRefs`, and 15/15 resolved actions byte-identical |
| A′ | comparison against a pre-run file copy | `hand-warmer-calorimetry`: every key byte-identical except the three migration keys and `description` (§17.7), and 241/241 imported actions byte-identical to the pre-run lab's |
| B | recomputing the **Cycle 03 fingerprints** from the pinned technique's action. Cycle 03's lint baseline recorded a content fingerprint per pre-migration lab-root action, so a match proves the lab copy and the technique copy were the same bytes without needing the lab file | every archived entry of all eight migrated labs, whether the action was replaced by an import or deliberately kept lab-local: `hard-water-analysis` 68, `blue1-spectroscopy` 37, `equilibrium-rainbow-display` 101, `crystal-violet-rate-law` 44, `hard-water-demo` 12, `hand-warmer-calorimetry` 53, `intro-filtration-demo` 3, `quick-ache-relief-separation` 2 — **320 matches, 0 mismatches** |
| B′ | the same recomputation over the 442 archived entries **outside** the migration set | 388 standalone-technique actions and 54 actions in the nine labs Cycle 04 never touched, all unchanged. This is the no-collateral-damage evidence; a per-lab check cannot produce it |
| C | a scripted full-action comparison run **before** the edit | every replaced action in all seven (32, 115, 73, 131 after unprefixing, 161, 241, 10). Reported in the Cycle 04 hand-off; **not re-runnable** against the repository |

Tier B is the reproducible one, and keeping it that way took an extra artifact: regenerating the lint
baseline removes the very entries the check reads. The fingerprints are therefore archived verbatim in
`docs/architecture/cycle03-action-fingerprints.json` (762 entries), and both Tier B and §17.1's
resolution checks re-run from the repository with:

```bash
node scripts/verifyCycle04Migration.mjs
```

**The sweep covers all 762 archived entries, not only the migrated labs.** A self-review of the
verifier found it was reading just the 320 lab entries for the eight migrated labs and ignoring the
other 442 — 388 standalone-technique actions and 54 actions in labs Cycle 04 never touched. Those 442
are the only evidence that the cycle altered nothing outside its scope, which no per-lab check can
establish, so every entry is now swept: it must resolve to an action with an identical fingerprint at
its original owner, or, for a migrated lab only, at the pinned technique that now publishes it. The
same review found 14 archived entries being counted as `still-lab-local` and then skipped without
comparison — the deliberately divergent actions of §17.3. They are now fingerprint-checked too, which
is what raises the per-lab match total from 306 to **320**, the full set of migrated-lab entries.

**Coverage limit, measured.** The archive reaches only actions the `action/atom-identity-missing` rule
reached, which is physical verbs: **456 of the 1,312 root-owner action records (35%)**. The 856
uncovered are `observe` (639), `record` (111), `calculate` (106) and similar. A tamper test that
deleted a non-physical action from a non-migrated lab was **not** detected — expected, and the reason
§17.8 grades this Tier B rather than treating it as complete parity.

Detection was tamper-tested nine times, each followed by a byte-identical restore. Repinning one
`techniqueRefs` version to a nonexistent `9.9.9` produced the version mismatch, the resolved-count
drop, and the unresolved-reference failures. Deleting the retained carrier, folding one of its nodes
into the lab root process, giving it `initialState.equipment`, pointing a root node at one of its
actions, and publishing it into `techniques/index.json` each produced their own failure. Editing an
action in `technique:weighing`, deleting `weigh-brass-action` from `lab:brass-colorimetry`, and editing
the deliberately-kept lab-local `transfer-sample` each produced the matching archive or lab-local
failure. Adding a key to `actionEquipmentParameterKeys` in `src/domain/validation.ts` produced
`mirror/drift`.

**The verifier's own mirrors are now verified rather than asserted.** Its equipment- and
model-parameter key lists are hand copies of `actionEquipmentParameterKeys` and
`actionModelParameterKeys`. §16.6 records Cycle 03 catching `checkContentConsistency.mjs` claiming to
verify such mirrors when nothing did; this script would have repeated that, silently narrowing the
imported-dependency check whenever a key was added to source. It now re-reads both declarations and
fails on drift.

Tiers B and B′ cover only physical-verb actions — 35% of root-owner action records, measured above —
because that is what `action/atom-identity-missing` reaches. Non-physical actions in the five files
without a stored copy rest on Tier C alone. Anyone re-auditing should treat §17.1's resolved counts and
Tiers B/B′ as the durable evidence and Tier C as a recorded, unrepeatable observation.

### 17.9 Validation run by Cycle 04

| Command | Result |
|---|---|
| `node --check scripts/generateHandWarmerCalorimetry.mjs` | pass |
| `node scripts/generateHandWarmerCalorimetry.mjs` | pass: 143 rows, 241 actions; wrote the lab; technique and both index files byte-identical; re-run produced an identical lab file |
| `npm run content:check` | pass, exit 0: 32/32 self-fixtures, 561 violations, 0 new, 0 changed fingerprint, 0 resolved, documentation up to date |
| `node scripts/checkContentConsistency.mjs --write-docs` | regenerated `docs/atomic-steps.md` (owner labels only) |
| `node scripts/checkContentConsistency.mjs --write-baseline` | 870 → 561 entries after reviewing the 310 resolved and 1 new id |
| `node scripts/auditContentInventory.mjs --write-baseline` | 204 → 161 entries, itemized in §17.5. Re-run after the §17.4.1 repair; it reproduced the Cycle 01 carrier entry byte-identically |
| `npm run typecheck` (`tsc -b`) | pass, run twice; tamper-tested by adding a type error to the new test file, which `tsc -b` reported, then restored |
| `git diff --check` on the Cycle 04 files | exit 0 |
| `node --check scripts/verifyCycle04Migration.mjs` | pass |
| `node scripts/verifyCycle04Migration.mjs` | pass, exit 0. Both vocabulary mirrors agree with `src/domain/validation.ts`. All 8 labs: pinned versions resolve, selections exist, no duplicate identity, every imported action's equipment is lab-declared and its models lab-owned, every lab-owned `actionId` resolves and the carrier's resolve against its own actions, resolved count equals the pre-migration root count, 0 nodes without an `actionId`, the declared local carrier satisfies all five §17.4.1 properties. Archive sweep: 762/762 entries — 320 in migrated labs, 442 elsewhere unchanged, 0 mismatches. Nine tamper tests (§17.8) |

Intentionally **not** run, under the `AGENTS.md` repository validation policy: `npm test` / Vitest in
any form, including the two files this cycle authored
(`src/data/__tests__/cycle04Migrations.test.ts`,
`scripts/__tests__/handWarmerCalorimetryGenerator.test.mjs`); `npm run build`; Playwright and any
browser or E2E matrix; camera and gesture verification; performance and mobile QA. No asset was
created or changed.

**Consequence to carry forward:** eight labs now depend on hydration at runtime and none of it has
been executed. `src/data/__tests__` is where the first authorized dynamic run must start, and it is
now materially more load-bearing than it was after Cycle 03.

---

## 18. What this audit does not settle

- Whether any specific action *should* become an equipment interaction. §8 measures what exists;
  the source plan for that investigation decides what is required. Cycles 06-12 must cite both.
- Any of the 105 `C` confirmation points. None were resolved here, and none may be resolved by
  implementation. Cycle 04 briefly deleted the crystal-violet `z`/`k` extension point's authored
  process nodes and restored them (§17.4.1); the point is untouched and Cycle 06 still owns it.
- Whether the seven `lab-local-state-carrier` embedded techniques should stay. Cycle 04 settled the
  question for the five root-identical labs — the copies are gone (§17.1) — and left every carrier in
  place.
- Runtime behaviour of any kind. Every statement here is derived from source and content text.

---

## 19. Cycle 05 addendum

Cycle 05 owned the shared visual and composite runtime foundation: F-05, F-07, F-19, and the latent
F-20. It changed no lab or technique content and created no asset.

### 19.1 The palette moved into the registry, and precedence inverted

`src/equipment/visualStateRegistry.json` went from schema `@1` to `@2`. It now carries the 29 liquid
styles themselves — copied out of `LIQUID_STYLES` byte-for-byte — so a colour cannot be defined in
one file and documented in another. `src/equipment/liquidRendering/styles.ts` builds its table from
`liquidStylesByState` and holds no colour of its own; if the registry's `defaultLiquidState` is
missing it throws at module load rather than falling back to a literal copy that would drift.

Three fields were added to every entry:

| Field | Purpose |
|---|---|
| `evidenceKind` | `source-observed`, `measurement-derived`, `simulator-configured`, `qualitative`, or `presentation-only`. What stands behind the appearance. |
| `selectors` | `authored`, `definition-id`, `reagent-heuristic`, `runtime-assigned`. How the state can be reached. A renderable entry no selector reaches is debt with an owning cycle. |
| `sharesAppearanceWith` | Declared when two distinct states render identically, so it cannot read as an accident. |

The container and reagent heuristics moved into a `fallbacks` block: the three definition-id overrides
(`waste-beaker`, `phenolphthalein-dropper`, `sample-bottle`) and the six ordered reagent keyword rules,
verbatim. They are data now, and reviewable.

`resolveLiquidStyle`'s precedence before and after:

| | Before | After |
|---|---|---|
| 1 | `visualState` starting `titration-`, if styled | authored/assigned `visualState` the registry can render |
| 2 | `visualState` when the content label contains `+`, if styled | `fallbacks.definitionIdStates` |
| 3 | definition-id override | `fallbacks.reagentKeywordStates` |
| 4 | reagent-name heuristic on `${definition.label} ${contents.label}` | `fallbacks.defaultLiquidState` |
| 5 | `visualState`, if styled | — |
| 6 | default | — |

**Measured effect on F-07.** `node scripts/auditContentInventory.mjs` reports
`overriddenByHeuristic: 0`, down from 52 baselined entries. Be precise about what that means: the
count is now zero **by construction**, not by measurement — the detector can only fire when a
heuristic beats an authored renderable state, and the new precedence makes that unreachable. The
load-bearing guards are therefore static, not statistical:

- `mirror/authored-state-not-first` re-reads `resolveLiquidStyle` and fails if either fallback table's
  first mention precedes the authored-state read. Tamper-tested by moving the fallbacks above the
  authored read in the real source; the rule fired.
- `mirror/palette-literal-colour` fails on a single `rgba(` in either appearance module. Tamper-tested
  by adding one to `styles.ts`; the rule fired.
- `mirror/palette-not-registry-driven` fails if a module stops reading its registry map.

**Two behaviour changes worth stating plainly.** An authored state the registry *cannot* render now
falls to `clear-liquid` rather than to a container or reagent style. For the 32 remaining unresolved
states that is a different wrong colour, not a right one — but it is a wrong colour that
`visual-state/unresolved` reports, instead of one a heuristic hides. And `nonvisual` (`empty`) is
deliberately *not* authoritative: it says the contents have no appearance, so the container fallbacks
still describe the vessel, exactly as before.

### 19.2 Ten unresolved states resolved, twelve re-owned

A fifth disposition, `solid-style`, was added, with `src/equipment/solidRendering.ts` as its resolver.
Before this cycle a solid had one appearance hard-coded in three places: `SolidLayer`'s SVG fills,
`.equipment-region-solid`, and `.equipment-precipitate`. All three now read the registry. The `powder`
entry carries `SolidLayer`'s previous values verbatim, so the most common authored solid state did not
change appearance; the two CSS layers had a *third*, different palette and now follow the registry, so
their appearance did change slightly. That was the point of consolidating them.

Resolved as generic, cross-lab appearance (10): `powder`, `solid`, `granular-solid`, `white-solid`,
`dry-solid`, `filter-cake`, and the four Inv. 4 dryness stages `damp-precipitate` →
`partially-dry-precipitate` → `broken-dry-precipitate` / `cooled-dry-precipitate`. The dryness stages
carry `quantitativeClaim: "ordinal"` and are monotonically lighter in fill luminance
(191.5 → 213.5 → 233.8); mass still comes from the balance. `cooled-dry-precipitate` is *deliberately*
identical to `broken-dry-precipitate`, declared through `sharesAppearanceWith`: temperature has no
honest visual signature, so Cycle 08 must carry the cooled/uncooled distinction in state and labels
rather than colour.

Re-owned rather than decided, because Cycle 05 builds the contract and Cycles 06-12 populate their own
procedure states (12):

| State | New owner | Why Cycle 05 may not decide it |
|---|---|---|
| `purple-solution` | 06 | Inv. 11 crystal-violet colour |
| `brass-sample`, `white-powder` | 07 | Inv. 2 preparation appearance |
| `copper-blue-solution`, `copper-blue-solution-at-mark` | 07 | Inv. 2 determines mass percent copper by matched colour depth, so the colour is part of a measurement method. Both are marked `measurement-derived` |
| `teacher-configured-beverage` | 09 | Inv. 3 beverage identity is teacher-configured; no fixed appearance may be invented |
| `emulsion`, `two-layer-extraction` | 10 | Inv. 6 extraction stages |
| `paper-unspotted` | 10 | Inv. 10 chromatography paper stage |
| `cloudy-blue-precipitate` | 12 | Inv. 13 copper hydroxide observation |
| `diluted-solution`, `dissolving-solid` | 12 | Inv. 12 calorimetry stages |

No `unresolved` entry is owned by Cycle 05 any more, and a registries test asserts it.

**Correction to §9.2's family notes.** The Inv. 4 dryness sequence is stated at basis `M` (manual step
7: dry 10-15 min at 110-120 °C, break up, dry 5 more min, cool, weigh), but the manual states no
colour for any stage — `grep -niE "cloudy|damp|cake|white|granular"` over
`what-makes-hard-water-hard_2026-07-27.md` returns nothing. Those entries are therefore
`qualitative`, not `source-observed`. The same check *did* confirm the source colours behind Inv. 8's
permanganate states ("faint persistent pink … colorless … dark red/purple", basis `M`), Inv. 13's six
required display colours (basis `M`), and Inv. 2's colour-depth method.

### 19.3 One composite path, seven composites

`src/equipment/compositeRegistry.json` went to schema `@2` and `src/equipment/composites.ts` is the
only evaluator. `EquipmentView.tsx` asks it for an asset override, a suppression set, and an overlay
id; `reducer.ts` asks it to resolve an instance swap. Neither names an apparatus.

`childDefinitionIds`, `suppressedChildDefinitionIds`, `snapZonePrerequisite`, and
`availableSnapZoneId` were replaced by one `participants` array, so the same fact is no longer stored
twice. Each participant declares `role`, `roleKind` (the shared six-value vocabulary from the
equipment-role registry), `equipmentRoleId` or an explicit `null`, `definitionId`, `snapZoneId`,
`parent`, and `suppressed`. The checker verifies that a named role exists **and** permits that
equipment, that the snap zone exists, is owned by the parent, and accepts the participant.

Three role bindings are `null` because no role in `src/domain/equipmentRoleRegistry.json` fits —
`rubber-stopper-set`, `ring-stand` as a *heating* support, and `clay-triangle`. Each is recorded as a
`deviations` entry (`no-equipment-role-for-closure`, `no-equipment-role-for-heating-support`) rather
than bound to a role that would misdescribe it; `filtration-support` does allow `ring-stand`, and
borrowing it would have been the wrong kind of green.

| Composite | Kind | Change from Cycle 02's record |
|---|---|---|
| `funnel-stand-with-filter-paper` | visual | **Snap prerequisite closed.** The branch used to fire on the presence of any `filter-paper` layer with an instance; the participant now names `funnel-stand-paper-seat`, like the other five. Overlay dispatched by id `funnel-filter-cake` |
| `chromatography-chamber-with-paper` | visual | unchanged behaviour |
| `volumetric-flask-stoppered` | visual | unchanged behaviour |
| `spectrophotometer-cuvette-inserted` | visual | unchanged behaviour |
| `ring-stand-clay-triangle` | visual | unchanged behaviour |
| `ring-stand-clay-triangle-crucible-lid-ajar` | visual | now declares the clay triangle as a participant, so detaching the crucible falls back to `ring-stand-clay-triangle` through precedence rather than branch order |
| `funnel-stand-assembly` | **instance-swap** | **New entry.** Cycle 02 never recorded it: it lived only in the reducer's `compositeDefinitionId` branch |

**The seventh composite is the one Cycle 02 missed.** `src/runtime/reducer.ts`'s `place` handler
swapped `funnel` + `ring-stand` into an assembled `funnel-stand` instance whenever an action carried a
`compositeDefinitionId` parameter, and it carried one apparatus's recovery prose — "Use the funnel with
the circular ring stand support." — for every apparatus that would ever use the mechanism.
`public/techniques/filtration.json`'s `assemble-funnel-stand` is its only consumer. The reducer now
resolves the composite from the participants and the snap zone; an unregistered pair fails with a
generic message instead of swapping in whatever the parameter named, and the invalid text comes from
the registry entry.

**F-20 is closed rather than left latent.** Every composite declares `detach`, `recovery`, and `reset`
with `compositeAware: true` and real evidence. Recognition is re-derived from live attachments on every
render, so detaching a participant restores both the parent's base art and the participant's own art
with no bookkeeping; the scoped reset at `reducer.ts:905-940` drops the attachments of every reset
instance, and the physical reset at `:2952-2982` returns a fresh state. The state-asset-versus-composite
hazard is now handled by explicit precedence: if a composite parent ever gains a state asset, the
evaluator keeps the state art **and** draws no composite at all, so an assembly missing a part is never
rendered. The invariant still forbids the situation, and `composite/parent-has-state-assets` still
fails on it — the precedence is a floor, not a licence.

`funnel-stand-assembly` keeps a declared `one-way-assembly` deviation: the swap is not reversible in
place, and recovery is a reset that must name all three instances. That is a documented gap, not a
silent one.

### 19.4 Two non-composite apparatus branches were also removed

`EquipmentView.tsx` had two more definition-id tests unrelated to composites. Both became data, so the
renderer now names no apparatus at all: the capillary-spotter content-badge suppression is a
`hideContentBadgeOnBench` flag on its visual profile, and the chromatogram overlay is dispatched
through `contentOverlayByDefinitionId` in the new `src/player/equipmentOverlays.tsx`, alongside the
composite overlay map. Every overlay there is `aria-hidden` and non-interactive; the accessible name
and the interaction target stay on the equipment button, and no focusable element was added to a
decorative layer.

### 19.5 All 119 wrappers were measured, and the contract is now enforced

Every realistic SVG wrapper satisfies the `AGENTS.md` contract today: one embedded PNG, `width`,
`height`, and `viewBox` equal to the PNG's IHDR dimensions, `preserveAspectRatio="xMidYMid meet"`,
`role="img"`, and a non-empty `aria-label`. That was previously trusted; it is now a rule
(`asset/wrapper-*`), and the Vitest side was extended to cover the two halves it was missing.

Two measurement notes for anyone repeating this. `preserveAspectRatio` is on the `<image>`, not the
root `<svg>` — a probe that reads only the root tag reports all 119 as non-compliant. And attribute
order varies: 9 wrappers put the `<image>`'s `width`/`height` *after* the base64 payload, so a reader
that only looks at the first few hundred bytes of the element reports 9 false dimension mismatches.
Both mistakes were made and corrected while writing the rule.

Asset dispositions are unchanged at 120 classified, one each, with the 6 `luer-lock-syringe-*`
remediation candidates still owned by Cycle 12. The 3 documented aliases are unchanged; the alias rule
now also fails if a rationale is missing, if `labelsMustStayDistinct` is waived, or if the shared
wrapper has no `aria-label`.

An observation recorded, not fixed: 13 wrapper `aria-label`s describe their own art as a "placeholder"
— `beaker-150ml`, `magnetic-stir-bar`, `probe-thermometer`, `wooden-calorimeter-cover`, and
`hand-warmer-calorimeter-cal-04` … `-12`
(`grep -l 'aria-label="[^"]*placeholder' *.svg | wc -l`). The labels are accurate; the art is
placeholder-grade. That makes it an asset-fidelity item — twelve of the thirteen belong to Cycle 12's
calorimeter work, and `beaker-150ml` is a loose end for Cycle 13 — not a labelling defect.

### 19.6 Reachability now comes from the registry, in both tools

`buildReachability` in the checker and `dispositions` in `auditContentInventory.mjs` both derived the
`composite-branch` tag by scanning `EquipmentView.tsx` for asset filenames. With the branches gone that
scan finds nothing, and the first `--write-baseline` run of this cycle reported all 6 composite assets
as unclassified debt — a self-inflicted regression, caught by the baseline diff and fixed by reading
the registry instead. Both tools now do.

`auditContentInventory.mjs` also had to be updated where it hand-declared the six branches and
verified them against the renderer's text. That section now reads the registry and verifies the
opposite property: that no composite's result asset appears in `EquipmentView.tsx`, and that both
callers still reach the evaluator. Its `resolveStyleKey` mirror of the runtime precedence was rewritten
to match; it remains a hand-copy, which is the weakness §16.6 records twice before, and
`mirror/authored-state-not-first` is the guard that makes the copy safe on the property that matters.

### 19.7 Baseline movement, itemized

Debt baseline **161 → 99**. 62 entries removed, 0 added, 0 changed:

| Category | Before | After | Why |
|---|---|---|---|
| `authored-initial-state-visual-state-overridden-by-heuristic` | 52 | 0 | §19.1. Structurally unreachable, not merely unobserved |
| `authored-visual-state-without-style-or-asset` | 42 | 32 | §19.2's ten `solid-style` entries |
| all other categories | 67 | 67 | unchanged |

Lint baseline **561 → 542**. 23 resolved, 4 new:

| Rule | Δ | Detail |
|---|---|---|
| `visual-state/unresolved` | −10 | the ten states in §19.2 |
| `composite/recovery-undeclared` | −6 | every composite now declares composite-aware recovery |
| `composite/reset-not-composite-aware` | −6 | as above for reset |
| `composite/missing-snap-prerequisite` | −1 | the funnel composite |
| `visual-state/registered-but-never-authored` | +4 | `equilibrium-deep-red`, `equilibrium-pale-red`, `equilibrium-yellow-green` (owner 12), `measured-liquid` (owner 13) |

The +4 is new visibility, not new debt. The rule used to fire only on `state-asset` entries with
`authoredToday: false`; it now fires on any renderable entry no selector reaches, which is what §9.3's
"styled but not addressable by authors" observation actually described. `measured-liquid` is reached by
nothing at all — no content authors it, no fallback names it, the runtime never assigns it. Cycle 05
recorded it with owner 13 rather than delete a palette entry it did not author; Cycle 13 decides
whether to author or retire it.

44 rules were added and 2 retired (`composite/source-branch-missing` and
`composite/suppresses-non-child`, both of which described the deleted branches), with 17 new
self-fixtures — 32 → 49. Every new rule category has a negative fixture, and the six that read real
source were additionally tamper-tested (§19.8).

### 19.8 Validation run by Cycle 05

| Command | Result |
|---|---|
| `npm run content:check` | pass, exit 0: 49/49 self-fixtures, 542 violations, 0 new, 0 changed fingerprint, 0 resolved, documentation up to date |
| `npm run typecheck` (`tsc -b`) | pass. Run after each contract change; the first run caught the four Cycle 02 registry-test assertions the composite schema change invalidated, which is how the schema migration stayed honest |
| `node --check scripts/checkContentConsistency.mjs` | pass |
| `node --check scripts/auditContentInventory.mjs` | pass |
| `node scripts/auditContentInventory.mjs` | pass: 32 authored states without style or asset, 0 overridden by heuristic, 6 unclassified assets, 7 composites (6 visual + 1 instance-swap), 0 unverified, 0 evaluator consumers missing |
| `node scripts/checkContentConsistency.mjs --write-baseline` | 561 → 542 after reviewing all 27 deltas |
| `node scripts/auditContentInventory.mjs --write-baseline` | 161 → 99, itemized in §19.7 and diffed entry-by-entry against `git show HEAD:./scripts/content-consistency-baseline.json` |
| `git diff --check -- src/ scripts/ docs/ public/` | exit 0 |
| `tsc --noUnusedLocals` over the app project | 16 pre-existing findings, none in any file this cycle touched |
| Tamper tests | 6, each fired then was restored and re-verified clean: a composite result-asset literal reinserted into `EquipmentView.tsx`; `reducer.ts` no longer calling `instanceSwapCompositeFor`; an `rgba(` literal added to `styles.ts`; the fallback tables moved above the authored-state read; `preserveAspectRatio="none"` on `cuvette.svg`; `aria-label` removed from `cuvette.svg`. Both asset tampers were restored byte-identically, confirmed by an empty `git diff` on the tracked file |

Intentionally **not** run, under the `AGENTS.md` repository validation policy: `npm test` / Vitest in
any form, including the file this cycle authored (`src/equipment/__tests__/composites.test.ts`) and the
four it updated (`src/equipment/__tests__/registries.test.ts`,
`src/equipment/__tests__/liquidRendering.test.ts`, `src/equipment/__tests__/visualCatalog.test.ts`,
`src/runtime/__tests__/runtime.test.ts`); `npm run build`; Playwright and any browser or E2E matrix;
camera and gesture verification; performance and mobile QA.

**No PNG or SVG was created or changed** — `git status --short -- public/` is empty — so the
"visually inspect each changed asset" step had nothing to inspect. The appearance changes this cycle
made are in code and registry data: the ten new `solid-style` entries and the two CSS solid layers.
Those were verified numerically (fill luminance ordering, §19.2) and not visually, because rendering
verification is browser work this policy defers.

**Consequence to carry forward.** The composite evaluator, the solid resolver, and the inverted
precedence are all unexecuted. `src/equipment/__tests__/composites.test.ts` and the funnel-assembly
tests in `src/runtime/__tests__/runtime.test.ts` are where the first authorized dynamic run should
start, together with the Cycle 03/04 hydration tests that are already waiting there.

### 19.9 A commit landed from outside this cycle, mid-cycle

`4810710` — "Commit the remaining Lab Studio GitHub Pages runtime sources", 453 files — appeared at
`HEAD` while Cycle 05 was in progress. Cycle 05 did not create it and ran no `git` write command. It
swept the roughly twenty Lab_studio files that were dirty at the start of the cycle into version
control, which is why a status comparison across the cycle shows them going clean.

Checked, because the cycle's evidence rests on `HEAD`:

- It contains **none** of Cycle 05's work. `evaluateCompositeScene`, `solidStylesByState`, and
  `instanceSwapCompositeFor` all appear 0 times in `git show HEAD:` for `EquipmentView.tsx`,
  `reducer.ts`, and `registries.ts`; the four new files are still untracked.
- It changed **nothing** this cycle compares against. `git diff --stat be4a0c8 HEAD` is empty for both
  baselines, both registries, this audit, and `meta_plan.md`, so §19.7's 161 → 99 and 561 → 542 hold
  against either commit.
- It touched seven files Cycle 05 also edits, but only by committing their pre-existing on-disk
  content — the content Cycle 05 built on. Nothing was overwritten and no edit was lost.

One side effect is helpful: because those files are now committed, `git diff` finally isolates Cycle
05's own delta for them. `git diff --stat` over `src/`, `scripts/`, `docs/`, and
`atomic_remediation_plan/` is 19 files, +3,009 / −1,763, and every one of the 19 is Cycle 05 scope.

### 19.10 Cycle 05 self-review, and the six defects it found

Cycle 05's own code was reviewed against §19's claims after the cycle reported complete. Five defects
were fixed and one was recorded. None changes the cycle's headline results: `npm run content:check`
still reports **542 violations, 0 new, 0 changed fingerprint, 0 resolved**, both baselines regenerate
byte-identically, `npm run typecheck` passes, and `git diff --check` over `src/`, `scripts/`, `docs/`,
and `public/` exits 0.

**1. A second palette had grown back inside the cycle's own new file.** `FunnelFilterCakeOverlay` in
`src/player/equipmentOverlays.tsx` drew the filter cake with `fill="#d8c45f"` and
`rgba(255,255,255,0.28)` — hard-coded, while `filter-cake` is a registered `solid-style` entry
(`rgba(214, 206, 176, 0.95)`). That is F-07's exact defect, in a file created by the cycle that closed
F-07, and `mirror/palette-literal-colour` did not see it because `PALETTE_MODULES` listed only
`styles.ts` and `solidRendering.ts`. The overlay now calls `resolveSolidStyle` on the paper's own
contents, and `equipmentOverlays.tsx` is a palette module. **Appearance change**, of the same class as
§19.2's two CSS layers: the cake goes from a saturated yellow to the registry's beige. Calcium
carbonate — the only content that authors `filter-cake`
(`public/labs/hard-water-analysis.json:365`, `public/techniques/two-stage-precipitate-drying.json:58`,
`public/techniques/quick-ache-extraction-recovery.json:878`) — is white, so the registry value is the
more faithful of the two. Not visually verified, for the reason §19.8 gives. The `rgba(` rule still
does not see the chromatogram overlay's four hex literals; those are measurement chrome, not a visual
state, and are left as they were.

**2. The overlay was handed the suppressed layers and called them participants.** `EquipmentView`
passed `renderLayers.filter(layer => scene.suppressedLayerIds.has(layer.id))` as `participantLayers`,
and the overlay read `participantLayers[0]`. Those are the same layer today only because the funnel
composite has exactly one suppressed child; the order came from render order, not from the registry.
`CompositeScene` now carries `layerIdByRole`, every matched participant keyed by its declared `role`,
parent included, and the overlay asks for `filter-medium`.

**3. The overlay hard-coded a participant's snap zone.** `"funnel-stand-paper-seat"` appeared twice in
`equipmentOverlays.tsx` — the same literal the registry participant declares — and
`COMPOSITE_FREE_SOURCES` did not cover the file, so removing it from `EquipmentView.tsx` had moved it
rather than deleted it. The overlay now takes the zone from `compositeParticipantByRole(composite,
"filter-medium").snapZoneId`, and `equipmentOverlays.tsx` is a composite-free source for
`snapZoneId` and `resultAsset` literals. It is deliberately *not* checked for `definitionId`
literals: `contentOverlayByDefinitionId` is keyed by definition id, so that is its contract.

**4. The registry's `invalidFeedback` was unreachable, and the reducer still named an apparatus.**
§19.3 said "the invalid text comes from the registry entry". It did not. The composite branch's
`if (!attachmentCheck?.ok)` sat *after* `reducer.ts`'s pre-existing
`if (attachmentCheck && !attachmentCheck.ok)` early return, so it was structurally dead — dead before
Cycle 05 too, with the funnel prose in it, which is how the prose survived being read. The swap
resolution is now hoisted above that early return and supplies the recovery line for a failed
composite seating, so `invalidFeedback.recovery` is reached. And the `!composite` branch still read
"Reset the lab so the assembled **funnel stand** can be restored." — one apparatus's name in the
generic path, the defect §19.3 claims to have removed. It is now apparatus-neutral.

**Stated plainly, because it is a live gap:** `invalidFeedback.message` is declared and still not
displayed. `canAttach` diagnoses the failure first and more precisely ("That snap zone is already
occupied", "That equipment is already attached elsewhere"), and replacing that diagnosis with the
composite's flatter "The apparatus pieces do not fit that support zone." would lose information. The
reducer therefore keeps `canAttach`'s message and takes the registry's recovery. The unregistered-pair
and mismatched-`compositeDefinitionId` failures deliberately do not speak through the registry either:
those are authoring errors where the pieces may fit perfectly, which is not what the entry describes.

**5. The state-asset precedence test passed vacuously.** `composites.test.ts`'s "lets a state asset
win the override and then draws no partial assembly" used `hand-warmer-calorimeter` and
`filter-paper` — no composite has a calorimeter parent, so `matchVisualComposite` returned nothing and
the assertions held for the wrong reason. This is the defect class §17's Cycle 04 self-review found in
the hand-warmer generator test. The `stateAssetWins` branch **cannot** be exercised against the real
registry, because the invariant forbids a composite parent from owning state assets. The test now
asserts what is actually true — the override lands, nothing assembles — and a second test asserts the
invariant itself, that no composite parent appears in `visualCatalog`'s `stateAssets`. The branch is a
floor for a state the registry does not permit, and the test says so instead of implying coverage.

**6. Recognition held the parent to a weaker rule than its participants.** `matchVisualComposite`
found the parent with a bare `definitionId` match while every child went through `layerSatisfies`, so
the documented "a layer with no instance is a decorative preview" rule did not apply to the parent.
The parent now goes through `layerSatisfies` too. `visualCompositesInPrecedenceOrder` and the
state-asset precedence flag were also hoisted to module constants; they were being recomputed on every
render.

Also recorded, not fixed: §11's Mechanism A disclaimer understated what is still in the render
pipeline. See the correction appended to §11 — seven hard-coded `(zoneId, definitionId)` pairs in
`resolveWorkbenchScene.childLayerForAttachment`, which are placement rather than recognition, and are
handed to Cycle 13.

**Verification for this review.** `npm run content:check` (49/49 self-fixtures, 542, 0 new);
`npm run typecheck`; `node --check scripts/checkContentConsistency.mjs`;
`node scripts/auditContentInventory.mjs` (unchanged: 32 authored without style or asset, 0 overridden
by heuristic, 6 unclassified, 7 composites, 0 unverified, 0 evaluator consumers missing); both
`--write-baseline` writers, each a no-op; `git diff --check` clean. Three tamper tests against the
newly covered file, each fired and then was restored byte-identically from a copy taken first:
`"funnel-stand-paper-seat"` reinserted → `composite/hard-coded-branch`; an `rgba(` literal added →
`mirror/palette-literal-colour`; the `compositeParticipantByRole` import removed →
`composite/evaluator-not-consumed`. **Still not run**, unchanged from §19.8: Vitest in any form —
including the tests this review edited — builds, Playwright, browser/E2E, camera and gesture,
performance, and mobile QA. The composite evaluator, the solid resolver, the inverted precedence, and
now the overlay's registry-driven cake all remain unexecuted.
## 20. Cycle 08 addendum

Cycle 08 remediated Investigation 3, `what-makes-hard-water-hard_2026-07-27.md`: the
`hard-water-analysis` lab and the five techniques it pins. Reproduce every number below with
`node scripts/verifyCycle08Gravimetry.mjs`, `npm run content:check`, and
`node scripts/verifyCycle04Migration.mjs`.

**Executed out of order.** The ledger had Cycle 05 as last completed, Cycle 06 `ready`, and Cycles
07 and 08 `pending`; this cycle's own preconditions require Cycles 01-07 complete. The user
authorized Cycle 08 anyway. Cycles 06 and 07 remain outstanding and Cycle 09 was **not** set ready.
Content-wise the dependency was satisfiable: 06 and 07 are spectroscopy investigations that share no
owner, atom, role, or visual state with Investigation 3, which §20.9 measures rather than assumes.

### 20.1 What was already there, and what was not

The five techniques already carried a source-faithful **shape**: separate weighing of both practice
solids, two dissolution loops, four incremental carbonate portions each with its own observation,
the extra stirring period, separate filter-paper and watch-glass tares, two timed drying stages,
cooling, two-sample inquiry, class pooling, ranking, and a client letter. Cycle 08 changed none of
that structure.

What was missing was that almost none of it was **enforced**, and three parts of it could not run:

| Finding | Evidence | Status |
|---|---|---|
| F-HW-01 | The `dry` handler hard-coded `visualState: "dry-precipitate"`, so both authored stage states were discarded. | Fixed |
| F-HW-02 | The `dry` handler always set `dryness: "dry"` and `wetState: "dry"`, so the first 12-minute stage reported a fully dried solid. | Fixed |
| F-HW-03 | The `dry` handler never set `temperatureC`, so `cool` failed unconditionally with "The crucible is not hot." **The practice phase could not be completed.** | Fixed |
| F-HW-04 | With no temperature carried, `weigh`'s `maxSafeTemperatureC` gate was unreachable: the cooling step was prose. | Fixed |
| F-HW-05 | Templates `gravimetricPrecipitateMass` and `calciumCarbonateTheoreticalMass` had **no implementation**. Both fell through to `Number(action.value ?? params.expected ?? 0)` - value 0, expected 0, tolerance 0.001, `passed: true`. Five calculation steps advanced on a fabricated zero. | Fixed |
| F-HW-06 | `hardnessMgLAsCaCO3` read only the hard-coded ids `sample-volume` and `dry-precipitate-mass` and ignored `sampleVolumeMeasurementId`, `precipitateMassCalculationId`, and `preconcentrationFactor`. **Both inquiry hardness calculations were blocked.** | Fixed |
| F-HW-07 | 68 physical actions had no atom identity, no role bindings, and no source trace. | Fixed |
| F-HW-08 | Every action carried `prerequisites: []`. Tare, seating, wetting, breakup, and cooling order lived only in process edges. | Fixed |
| F-HW-09 | Confirmation points 1 and 2 were decided in prose. The content said "the teacher-approved Buchner funnel" while no configuration recorded any approval. | Fixed |
| F-HW-10 | Eight visual states the reducer assigns were in no registry, and `measured-liquid`'s entry asserted the runtime never assigns it. | Fixed for the four in scope; four re-owned |
| F-HW-11 | Four dryness states' provenance said "Inv. 4". Hard water is Investigation 3; Inv. 4 has no drying sequence. `cooled-dry-precipitate` was also labelled stage 3, the same as `broken-dry-precipitate`. | Corrected |
| F-HW-12 | `atom.place.filtration-funnel` required a `filtration-support`, which only the gravity configuration has - the atom decided the confirmation point its own constraint says must stay open. | Corrected |
| F-HW-13 | Sample C and Sample D shared the notebook tags `unknown-precipitation-observation` and `uncertainty`, so one sample's observation satisfied the other's gate. | Fixed |

F-HW-03, F-HW-05, and F-HW-06 together mean the pre-Cycle-08 lab **could not be completed**: the
practice phase stopped at cooling, and had it not, the collected-mass step would have passed with
0.000 g. That was invisible to every static check, because the content was authored against a
parameter contract the runtime had never implemented. All five calculation actions already named the
operands this cycle implemented - `combinedMassMeasurementId`, `watchGlassMassMeasurementId`,
`filterPaperMassMeasurementId`, `sodiumCarbonateMassMeasurementId`,
`calciumChlorideMassMeasurementId`, `sampleVolumeMeasurementId`, `precipitateMassCalculationId`,
`preconcentrationFactor` - which is the evidence that the implementation matches the authors' intent
rather than inventing one.

### 20.2 Atom identity, roles, and traces

All **68** physical actions across the four procedure techniques now carry an `atomId` and every
role the atom requires; `inquiry-plan-approval` has none, because all eight of its actions are
`observe`.

| Owner | Physical actions | With atom identity | With prerequisites |
|---|---|---|---|
| `technique:hard-water-practice-preparation` | 15 | 15 | 9 |
| `technique:gravimetric-vacuum-filtration` | 9 | 9 | 9 |
| `technique:two-stage-precipitate-drying` | 6 | 6 | 6 |
| `technique:hard-water-two-sample-inquiry` | 38 | 38 | 38 |
| `technique:inquiry-plan-approval` | 0 | - | 0 |

Seven atoms were added, each because an operation Investigation 3 states had no existing identity:
`atom.transfer.solid-portion`, `atom.dissolve.solid-in-solvent`,
`atom.transfer.precipitating-reagent`, `atom.precipitate.form-gravimetric-solid`,
`atom.weigh.filter-medium-tare`, `atom.place.transfer-medium-to-drying-vessel`, and
`atom.place.filtration-vacuum-source`. Four roles were added: `solid-reagent-source`,
`precipitating-reagent-source`, `precipitation-vessel`, and `filtration-vacuum-source`.
`precipitation-vessel` exists rather than reusing `reaction-vessel` because the latter carries
Investigation 10's gas-collection sealing constraint. 36 atoms became 43, 42 roles became 46.

60 source traces were added and one corrected. The correction: `weigh-sodium-carbonate` cited PR-03,
"Add about 2 g Na2CO3" (M). The content splits that operation the way the source does - PR-03 adds
the solid, PR-04 reads its mass (M/R) - so the transfer action took the PR-03 citation and the weigh
action moved to PR-04. 30 traces became 90.

**Every inquiry action cites INQ-06 or INQ-07, not an FD-\* row.** The source does not enumerate the
unknown analysis; it says "execute approved workflow independently for sample 1 / sample 2" and
leaves the steps to the student's approved plan within §10's mandatory constraints. Citing FD-\* rows
would claim the manual states an inquiry procedure it deliberately does not.

### 20.3 The two confirmation points, configured rather than decided

**Confirmation point 1 - gravity versus vacuum.** A new action,
`gravimetric-vacuum-filtration/select-filtration-configuration`, records which configuration the
teacher selected, names both admissible ones, and carries
`configurationProvenance: "teacher-configured"`. `place-practice-buchner` and
`place-practice-vacuum` now require its notebook entry, so no apparatus can be assembled before the
choice is on record; the two inquiry samples are gated the same way on `select-inquiry-apparatus`'s
`materials-plan` entry. The prose that claimed approval the content did not hold -
"the teacher-approved Buchner funnel", "the teacher-approved vacuum source" - now says "named by the
recorded filtration configuration".

The technique keeps its id and its learning goal, both of which name the vacuum configuration. That
is deliberate: this technique *is* the vacuum configuration. The gravity configuration is published
separately as `technique:filtration`, which `hard-water-demo` and `intro-filtration-demo` already
pin. Switching configurations is therefore a content-level re-pin, not a runtime toggle, and §20.10
records that as a limitation rather than presenting it as a choice the player offers.

**Confirmation point 2 - balance readability.** `review-practice-safety` now carries
`balanceReadabilityG: 0.001`, `allowedBalanceReadabilityG: [0.001, 0.0001]` - the two resolutions
the manual lists and no others - and `precisionProvenance: "teacher-configured"`. Every one of the
13 hard-water `weigh` actions has a `tolerance` equal to the configured readability, which
`verifyCycle08Gravimetry.mjs` checks rather than assumes, and the first read of each phase requires
the configuration's notebook entry.

**Confirmation points 3, 4, and 6 stay unresolved.** Constant-mass repetitions beyond the stated two
stages remain an instructor decision in `define-inquiry-quality-choices`; the optional Practice
Question 2 rerun stays a branch; reagent excess, replicate count, and tolerance stay in the approved
plan. The 200x preconcentration factor is now applied from a declared parameter that defaults to 1,
so an undeclared factor means "this aliquot is the sample" rather than an assumed 200. The corrupted
ppm expression the source warns about is used nowhere.

### 20.4 Chronology that cannot be bypassed

62 actions gained `prerequisites`, evaluated by `performRuntimeAction` on the same central path that
pointer, keyboard, accessible process controls, and the gesture bridge all reach. They are
complementary to the physical guards the reducer already had, not duplicates of them: the reducer
knows the paper is seated, but only the evidence gates know the tare was *recorded* before the paper
was seated - and once the paper and solid are on the watch glass, neither tare can be taken again.

The drying chain is now four distinguishable states plus a temperature. The first stage declares
`drynessResult: "damp"` and leaves `wetState: "wet"` and `temperatureC: 115`; the second declares
`"dry"` and requires the breakup notebook entry; `cool` drops the temperature to 25 C and renders
`cooled-dry-precipitate`; the combined weighing requires the cooling evidence, both tare entries,
`maxSafeTemperatureC: 40`, and the newly generalized `requiresDryPrecipitate` gate. Cycle 05 handed
Cycle 08 the note that `cooled-dry-precipitate` and `broken-dry-precipitate` are deliberately
identical in appearance because temperature has no honest visual signature; the distinction is now
carried where it belongs - the warm assembly and the cooled one differ by what the balance accepts.

The breakup itself (FD-16, "break precipitate into small pieces with metal scoop") stays an
observation. **This is a recorded limitation, not an oversight.** No verb in `actionVerbs` models
comminution, and adding one would change `src/domain/types.ts`, `interactions.ts`, the checker's
verb mirrors, and the reducer for one step. Its *consequence* is enforced instead: the second drying
stage cannot run without the breakup evidence.

### 20.5 Calculation provenance

`calculateGravimetricPrecipitateMassG` subtracts every named tare from the cooled combined mass and
throws when a tare is missing or the difference is not positive.
`calculateCalciumCarbonateTheoreticalMassG` takes the limiting reactant of the 1:1:1
Na2CO3 + CaCl2 to CaCO3 reaction from the two recorded masses, using anhydrous molar masses - which
the action's own instruction already flagged for instructor change if a hydrate is supplied.
`calculateHardnessMgLAsCaCO3` gained a third parameter defaulting to 1.

The authored mass sets are internally consistent to five decimal places, which is what makes them
usable as evidence rather than decoration: practice 35.376 - 32.842 - 0.824 = 1.710 g against the
authored precipitate state of 1.71 g; Sample C 32.875 - 31.744 - 0.811 = 0.320 g against 0.32 g,
giving 80.0 mg/L as CaCO3 after the 200x division; Sample D 0.560 g and 140.0 mg/L. The theoretical
practice yield is 1.809 g, so the collected 1.710 g is a 94.5 % recovery - a comparison a student can
argue about, which is what FD-21 asks for.

No calculation carries a literal `expected`. These are derivations, so their gate is operand
completeness rather than a stored answer key; inventing an expected mass would be fabricating a
measurement. `verifyCycle08Gravimetry.mjs` enforces the absence of the answer key as well as the
presence of the operands.

### 20.6 A third way a visual state becomes reachable

Cycle 05 classified what content authors and what the two fallback tables name. Nothing classified
what the reducer assigns by itself. Measured: **eight** assigned states were in no registry -
`chromatogram-developed`, `cooled-residue`, `dry-precipitate`, `heated-liquid`, `heated-residue`,
`paper-spotted`, `rinsed-precipitate`, `wet-equipment` - and seven more were registered as `authored`
only although the reducer also assigns them as defaults. `measured-liquid` was worse: its provenance
stated that the runtime never assigns it, and `src/runtime/reducer.ts` does.

`mirror/runtime-assigned-state-unregistered` and `mirror/runtime-assigned-state-selector-missing`
now read the reducer with brace-balanced parsing of each `visualState:` assignment, so a bare
literal, a ternary, and a multi-line `?? "default"` chain are all seen. Both were tamper-tested
against the real reducer: renaming `"dry-precipitate"` to an invented state fired the first rule,
and the file was then restored byte-identically.

Four of the eight are Cycle 08's and are resolved: `dry-precipitate` and `rinsed-precipitate` as
`solid-style`, `wet-equipment` as `nonvisual` (a rinsed empty vessel has no contents to render;
wetness rides on `wetState`, which is what the filter handler checks). The other four are re-owned
with their reason - `cooled-residue`, `heated-residue`, `paper-spotted`, and `chromatogram-developed`
to Cycle 10, `heated-liquid` to Cycle 12 - and appear as five new `visual-state/unresolved` baseline
entries. That is visibility, not new debt: the states were always reachable, and nothing recorded
them.

The Inv. 4 to Inv. 3 correction covers `damp-precipitate`, `partially-dry-precipitate`,
`broken-dry-precipitate`, and `cooled-dry-precipitate`; the last is stage 4, not stage 3.
85 states became 93.

**Correction, found by re-reviewing this cycle's own code.** The two rules above check *which* states
the reducer can assign, and nothing checked *how*. Four entries said their literal applies "when the
action declares no state", and `filter-cake` and `clear-filtrate` carried both `authored` and
`runtime-assigned` selectors — claims that hold only while the handler reads an authored value
first. A review pass then removed the `filter` and `rinse` override chains as apparently unused, on
the evidence that no file under `public/` authors those parameters. That evidence was the wrong
test: the consumer of an override chain is this registry's reachability contract, not a content
file. All four claims silently became false and no rule fired.

Every `runtime-assigned` state now also declares `runtimeAssignment` — `default` when an authored
value wins and the literal is only the fallback, `unconditional` when the reducer decides and no
authored value reaches that site — and `mirror/runtime-assignment-undeclared` and
`mirror/runtime-assignment-mismatch` re-read the reducer and fail when the two disagree. The parser
was extended to follow a `*VisualState` helper's `return` literals, so the three `titration-*`
states are declared on evidence rather than on trust. Measured against the restored reducer: 13
`default`, 6 `unconditional`. Two entries needed a prose correction rather than a code one —
`clear-liquid` and `cloudy-precipitate` claimed a fallback the reducer never offered, and now record
those sites as unconditional.

Both directions are tamper-tested against the real reducer. Deleting the `rinse` override chain —
the exact mistake above — fired `mirror/runtime-assignment-mismatch` for `rinsed-precipitate` and
`wet-equipment`; adding an override to the unconditional `chromatogram-developed` assignment fired
it the other way. `src/runtime/reducer.ts` was restored byte-identically after each.

### 20.7 Baseline movement, itemized

**Lint baseline 542 to 478.** 69 resolved, 5 new.

- **68 resolved** `action/atom-identity-missing`, one per action in §20.2's table. None is a
  duplicate row disappearing: every one is an action that now carries an identity, its role
  bindings, and a source trace.
- **1 resolved** `visual-state/registered-but-never-authored:measured-liquid` - it has a selector now
  because the reducer assigns it, which Cycle 05 recorded as untrue.
- **5 new** `visual-state/unresolved`, all runtime-assigned states owned by Cycles 10 and 12 (§20.6).
- 60 `action/source-trace-missing` violations appeared and were closed inside the cycle, which is the
  rule working: an atom identity without a trace is not a completed binding.

**Debt baseline 99 to 99, byte-identical.** `node scripts/auditContentInventory.mjs --write-baseline`
reproduced the file exactly. Nothing Cycle 08 changed is in a category that baseline measures: the
hard-water physical actions already had equipment interactions, and the states this cycle registered
are runtime-assigned rather than authored, which is the population that baseline counts.

**Checker: 49 to 54 self-fixtures, 4 rules added, 0 retired.** Every new rule has a negative fixture,
and all four were additionally tamper-tested against the real reducer.

### 20.8 The Cycle 04 archive, and a declared exemption

`docs/architecture/cycle03-action-fingerprints.json` is Cycle 03's record of what each action was
before Cycle 04 relocated it, and its value is proving relocation was not an edit. Cycle 08 is
chartered to edit 68 of those actions, so `scripts/verifyCycle04Migration.mjs` now carries an
explicit, itemized declaration rather than a loosened comparison: the four owning techniques and the
exact count of atom-identity-carrying actions each must hold. A declared action must still exist,
must actually differ from the archive - a declaration for an action nobody touched fails as a stale
claim, which was tamper-tested - and every action no cycle has claimed is still compared verbatim.
The sweep now reports 374 unchanged elsewhere and 136 changed by a declared later cycle (68 seen
through the technique, the same 68 seen through `hard-water-analysis`), with 0 failures.
`hard-water-analysis`'s expected resolved count moved 131 to 132 for the configuration action.

### 20.9 What did not change

Byte-identical across all five techniques: `initialState`, `requiredEquipment`, `successCriteria`,
`commonMistakes`, `title`, `learningGoal`. Byte-identical in the lab: `equipment`, `initialState`,
`techniques`, `actions`, `assessments`, `learningGoals`, `safetyNotes`, `title`, `description`,
`audience`. Process nodes and edges are unchanged except for the one inserted configuration node and
the one edge it splits - 131 nodes to 132, 130 edges to 131 in the lab; 12 to 13 and 11 to 12 in
`gravimetric-vacuum-filtration`. Every `startNodeId` is unchanged. All five techniques went 1.0.0 to
1.1.0 and the lab's five pins moved with them.

No lab or technique outside Investigation 3 was touched, which the Cycle 04 sweep measures over 374
fingerprints rather than asserting. The reducer changes are additive for every other owner:
`drynessResult`, `temperatureC`, `visualState`, `retainedVisualState`, `filtrateVisualState`, and
`requiresDryPrecipitate` all keep the pre-Cycle-08 behaviour when a caller declares none, and a
corpus-wide scan confirms only hard-water content declares them. The one deliberate behaviour change
outside Investigation 3 is prose: `cool` and the warm-weighing failure now name the object being
cooled or weighed instead of saying "crucible", which Investigation 7 supplies as
`cooledObjectLabel` and Investigation 3 needed because it cools a watch-glass assembly.

### 20.10 Limitations, recorded rather than hidden

1. **The filtration configuration is recorded, not selected in play.** The player has no control
   that switches the lab between the gravity and vacuum apparatus; the choice is expressed by which
   technique the lab pins, and the new action records it. This is the honest floor of what content
   plus the existing runtime can express, and it is more than the prose assertion it replaced.
2. **Displayed rounding is not separated from the raw value.** The cycle's task list asks for raw
   measurement, displayed rounding, and derived mass to be distinguishable. Raw and derived now are;
   display rounding is not implemented anywhere in the runtime, and adding an unconsumed
   `displayedDecimals` parameter would have been decoration. Deferred, unowned.
3. **The quantitative-transfer rinse conserves nothing, because there is nothing to conserve.** The
   `filter` handler empties the source vessel completely, so FD-07's beaker rinse recovers no
   residue. Modelling a residual fraction would mean inventing a recovery the source does not state.
   What §20.5 does enforce is that the mass which reaches the balance is the mass the precipitation
   produced. The 5 mL of wash water still vanishes rather than reaching the receiver; that is a
   pre-existing runtime property Cycle 08 did not change and does not claim to have fixed.
4. **The breakup step has no physical verb.** See §20.4.
5. **`atom.weigh.solid-portion` binds `weighed-vessel: beaker-250ml`.** Investigation 3 weighs the
   solid in the beaker it will be dissolved in, which is what the manual describes; the role's
   `mustBeDryBeforeTare` constraint is not machine-checked against the instance.

### 20.11 Validation run by Cycle 08

Run: `node --check` on all four changed `.mjs` scripts; `npm run content:check` (54/54
self-fixtures, 478 violations, 0 new against the regenerated baseline, `docs/atomic-steps.md` up to
date); `npm run typecheck`, tamper-tested by introducing a type error in `src/runtime/reducer.ts`
and observing `TS2322`, then restoring; `node scripts/verifyCycle08Gravimetry.mjs` (131/131), whose
checks were tamper-tested with ten simultaneous mutations against the real content - dropped cooling
prerequisite, first stage marked dry, ungated apparatus placement, a disagreeing balance tolerance,
an added answer key, a broken combined-mass sum, the practice recipe substituted into the inquiry, a
decorated client letter, a dropped preconcentration factor, a stripped node configuration - which
produced exactly ten failures, one per mutation, before every file was restored from a copy taken
first; `node scripts/verifyCycle04Migration.mjs` (0 failures, stale-declaration guard
tamper-tested); both baseline writers; `npm run content:docs`; `git diff --check` clean over the
cycle's paths.

**Intentionally not run**, under the `AGENTS.md` validation policy: Vitest in any form, builds,
Playwright, browser/E2E, camera and gesture checks, performance tests, and mobile QA. Two test files
were authored and not executed - `src/runtime/__tests__/cycle08Gravimetry.test.ts` and
`src/equipment/__tests__/runtimeAssignedStates.test.ts`. **Consequently the entire drying, cooling,
and calculation chain this cycle repaired is unexecuted.** The static evidence establishes that the
content declares the right operands, that the handlers read them, and that the types agree; it does
not establish that a student can now finish the lab. Given that F-HW-03, F-HW-05, and F-HW-06 were
each a completion-blocking or silently-wrong runtime defect that no static check had caught, a single
Vitest run of the two authored files is the highest-value verification still outstanding for this
investigation.

No PNG or SVG was created or changed, so the asset-inspection step had nothing to inspect. The three
appearance decisions this cycle made - `dry-precipitate`, `rinsed-precipitate`, `wet-equipment` -
reuse existing registry values verbatim or declare no appearance at all, so no colour was invented.

## 21. Cycle 06 addendum


Cycle 06 remediated Investigation 1, `sports-drink-blue-dye-spectroscopy_2026-07-27.md`
(`blue1-spectroscopy` and its three techniques), and Investigation 11,
`crystal-violet-rate-law_2026-07-27.md` (`crystal-violet-rate-law` and its four techniques).
Reproduce every number below with `node scripts/verifyCycle06Spectroscopy.mjs`,
`npm run content:check`, and `node scripts/verifyCycle04Migration.mjs`.

**Executed in parallel.** Cycles 06, 09, 10, and 11 ran concurrently under
`atomic_remediation_plan/_WAVE_A_CONTRACT.md`. Every global count in this section is therefore a
moving target and is reported per owner instead; where a corpus total appears it is labelled as such
and is not attributable to this cycle alone.

### 21.1 What was already there, and what was not

Both investigations already carried a source-faithful **shape**. Blue #1 had all eight assigned
ratios with their own labelled tubes, a separate reading and central-table entry per ratio, the
class-pooling rows, the four transformation plots, the `1 x 10^T` ambiguity note, and a full
student-designed sports-drink branch. Crystal violet had the four standards plus stock, the
blank/zero, a per-standard condition/fill/insert/read/record/remove cycle, an eight-point timed
kinetic run with a recorded dead time, the integrated-rate-law comparison, and the two-stage waste
treatment. Cycle 06 changed none of that structure.

What was missing was that almost none of it was **enforced**, and three parts of it were false.

| Finding | Evidence | Status |
|---|---|---|
| F-SP-01 | `blue1-percent-transmittance` had **no cuvette insertion or removal action anywhere**. Every ratio was filled on the shelf and read while the sample compartment was empty. § 8.4 recorded the symptom — "Blue #1 reads an instrument that was never loaded" — without a mechanism. | Fixed |
| F-SP-02 | Nothing checked that the instrument had been placed, that a wavelength was configured, or that the zero had been taken. `i1-zero-instrument` was a notebook sentence whose absence blocked nothing. | Fixed |
| F-SP-03 | The template `dilutedConcentrationMicromolar` had **no implementation**. All eight Blue #1 standards fell through to `Number(action.value ?? params.expected ?? 0)`: value 0, expected 0, tolerance 0, `passed: true`. The teacher-supplied stock concentration the content already named in `stockConcentrationMeasurementId` was read by nothing. | Fixed |
| F-SP-04 | `cv11-record-absorbance-*` and `cv11-record-kinetic-absorbance-*` carried the absorbance as a `value` parameter, while `cv11-read-absorbance-*` produced no evidence at all. A student could file thirteen readings without ever taking one, and the "reading and recording are distinct events" contract was cosmetic. | Fixed |
| F-SP-05 | C-05, "Set approved wavelength" (M), had **no action**. `cv11-approve-wavelength-and-blank` named a wavelength that nothing configured and no reading depended on. | Fixed |
| F-SP-06 | 81 physical actions across six owners had no atom identity, no role bindings, and no source trace. `blue1-standard-dilutions`' 28 and `blue1-percent-transmittance`' 9 carried **no interaction spec at all** (§ 8.3). | Fixed |
| F-SP-07 | Every action in both investigations carried `prerequisites: []`. Chronology lived only in process edges, which no input path is obliged to follow. | Fixed |
| F-SP-08 | Percent transmittance, decimal transmittance, and absorbance were stored in identically shaped fields with authored unit strings nothing checked. `calculateAbsorbanceFromPercentT` was the only absorbance entry point, so no guard existed against applying `-log10` to a percent. | Fixed |
| F-SP-09 | The eight `blue1-*-*` states and `purple-solution` were `unresolved`, so the whole dilution series rendered as one default pale blue and the crystal violet as a colour it never is (§ 9.2, § 19.2). | Fixed |
| F-SP-10 | `i1-calculate-original-molarity` and `i1-calculate-mass-500ml` — the investigation's two inquiry results — declared no `studentValueRequired`, so a submission with no value computed 0, compared 0 against 0, and passed. | Fixed |
| F-SP-11 | The kinetic cuvette was never removed from the instrument; nothing in the corpus freed the sample compartment after the run. | Fixed |

F-SP-01, F-SP-03, and F-SP-04 together describe content that produced numbers nothing had measured.
Stated precisely, because the first draft of this section overstated it: Blue #1's eight standard
concentrations were a fabricated zero that passed at tolerance 0; its eight reads succeeded while
producing no evidence at all, so the investigation then **stalled at the record step**, where the
player needs either a pending measurement or a supplied value and had neither; and crystal violet's
thirteen absorbances were parameters on the `record` actions, filed without a reading. As in § 20,
this was invisible to every static check because the content was authored against a parameter
contract the runtime had never implemented — `stockConcentrationMeasurementId` was already in the
JSON before this cycle read it.

Two further findings come from reviewing this cycle's own code, and § 21.15 records them in full.

| Finding | Evidence | Status |
|---|---|---|
| F-SP-12 | **Introduced by this cycle.** `i1-record-wavelength`, `i1-record-stock-concentration`, and `cv11-set-approved-wavelength` declare a `measurementId`, a numeric `inputMode`, and a unit, but the generic `observe` path writes a notebook entry and **no measurement**. Every gate this cycle added consumes one of those three, so the first version of Cycle 06 replaced a lab that computed fabricated zeros with a lab that could not be started at all. | Fixed |
| F-SP-13 | Pre-existing, missed in the first pass. `technique:blue1-class-calibration` consumes eight `i1-r*-percent-t` measurements that only its sibling `blue1-percent-transmittance` writes, so the standalone technique can never compute a decimal transmittance. It resolves in the lab, which imports both. | Recorded as a declared dependency and now enforced |

### 21.2 The photometer gate

The reducer's `observe`/`readInstrument` branch gained one block, entered only when an action
declares `photometerOperation`. Content that declares none behaves exactly as before, which a
corpus-wide scan confirms is every owner outside Investigations 1 and 11.

`photometerOperation: "zero"` and `photometerOperation: "read"` both require, in this order:

1. the named instrument to exist and to be off the shelf;
2. a wavelength **measurement** on record when the action names one — the runtime supplies no
   default, because the wavelength is an open confirmation point in both plans;
3. an occupant of the instrument's cuvette slot, resolved from `attachments` through
   `zoneOccupancy`, which must be the cuvette the action names and must not be empty.

A `read` additionally requires the zero's notebook tag, a declared photometric quantity, and a
measurement id, and then validates the value against the range that quantity can physically take.
The zero produces a notebook entry and no measurement, because a zero is not a reading.

**Over-range readings are recorded and flagged, not rejected.** `reliableMaximum` is teacher
configuration, and both sources branch on exceeding it — Investigation 1 to an approved dilution and
back-calculation (I-05), Investigation 11 to a wavelength or range redesign (finding 3.4, § 9). The
branch argues from the out-of-range number, so the reading is stored and its notebook entry carries
an `over-range` tag.

### 21.3 Three quantities, three units, one conversion each

`src/runtime/calculations.ts` gained `PHOTOMETRIC_UNITS` — `percentTransmittance` → `%T`,
`decimalTransmittance` → `T`, `absorbance` → `absorbance` — and the reducer derives a photometric
measurement's unit from its quantity rather than from an authored string, the same way it already
derives `mg/L as CaCO3` for hardness. An authored unit that disagrees is now a rule failure rather
than a mislabelled number in a table.

`calculateAbsorbanceFromDecimalT` is new and accepts only `0 < T <= 1`. The defect it prevents is
concrete: `-log10(42)` is `-1.6232`, a negative absorbance that reads as a plausible number and that
no previous check would question. The two entry points now differ by exactly which quantity they
take, and the `absorbanceFromDecimalT` template reads a separate operand
(`decimalTransmittanceMeasurementId` or `decimalTransmittanceCalculationId`) so a `%T` reading cannot
reach the logarithm by sharing a parameter name.

Investigation 1's chain is now `%T` (read, P-10) → `T` (`decimalTransmittance`, M) → `-log T`
(`absorbanceFromDecimalT`, A-03), each step consuming the previous quantity by id. **The
transformation choice is still open.** Finding 3.4 lists four candidates and finding 3.5 records that
the manual's "positive slope through zero" and the standard `A = -log T` disagree; computing the
assigned transform is A-03 (M), while `i1-record-source-ambiguity` and
`i1-record-confirmed-calibration` still hold confirmation points 2 and 4. Nothing in this cycle
decides which plot is linear.

`calculateDilutedConcentrationMicromolar` applies the micromolar conversion **before** rounding.
Routing it through `calculateDilutedConcentration`'s six-decimal molar rounding would have quantised
the series at 1 µM and sent a 0.1 µM standard to zero.

### 21.4 Reading provenance, and why the two investigations differ

The configured instrument response moved off the `record` action and onto the `read` that produces
it. This is the difference between an instrument output a student then writes down, and a number the
notebook step supplies to itself.

- **Investigation 11 reads are instrument-supplied.** Each `cv11-read-*` carries
  `instrumentReadingValue` — the same number the record action used to carry — plus
  `readingProvenance: "teacher-approved simulator calibration profile"`, which is the provenance the
  content already declared. Nothing was invented; it was relocated to the event that earns it.
- **Investigation 1 reads have no shipped response, and that is the honest floor.** The plan
  withholds the stock molarity and the wavelength (finding 3.1, "do not invent these"), so no `%T`
  can be derived without inventing an absorptivity the source does not state. Those eight reads
  declare no `instrumentReadingValue`, and the runtime blocks them naming what is missing.

  **Corrected from the first draft of this section, which called them "student-entered".** They are
  not, because there is no path by which a student could enter one: `ProcessSidebar` collects no
  numeric input for an `observe`, exactly as it collects no free text — the same gap the reducer
  already records beside `studentResponseRequired`. Calling the provenance "student-read" asserted a
  capability the player does not have. Those 17 actions now declare
  `readingProvenance: "classroom-configured-instrument-response"`, against the 26 that declare
  `"teacher-approved simulator calibration profile"` because a profile has already supplied their
  number. The two investigations differ only in whether that profile exists yet, not in who reads
  the instrument.

Both are gated identically. `atom.observe.read-photometer`'s constraint that "the reading is
simulator output and the record is student evidence" is amended by a third constraint naming the two
admissible sources — a configured classroom response, or a value supplied by a caller such as Studio
— rather than being quietly broadened to include one that does not exist.

Every `record` bound to `atom.record.photometer-reading` now carries no `value` and requires a
`measurementRecorded` prerequisite on the read's measurement id, so recording a reading nobody took
fails with "No measurement is available to record."

### 21.5 Atom identity, roles, and traces

**All 102 physical actions** across the seven remediated owners now carry an `atomId`, every role the
atom requires, and a source trace. 177 actions of any verb carry prerequisites, where before this
cycle every action in both investigations carried `prerequisites: []`.

| Owner | Actions | Physical | With atom identity | With prerequisites |
|---|---|---|---|---|
| `technique:blue1-standard-dilutions` | 56 | 28 | 28 | 36 |
| `technique:blue1-percent-transmittance` | 54 | 27 | 27 | 43 |
| `technique:blue1-class-calibration` | 31 | 0 | – | 16 |
| `lab:blue1-spectroscopy` | 18 | 2 | 2 | 5 |
| `technique:crystal-violet-micromolar-dilution-series` | 21 | 16 | 16 | 20 |
| `technique:crystal-violet-spectrophotometer-calibration` | 40 | 18 | 18 | 31 |
| `technique:crystal-violet-waste-treatment` | 5 | 3 | 3 | 2 |
| `lab:crystal-violet-rate-law` | 42 | 8 | 8 | 24 |
| **Total** | **267** | **102** | **102** | **177** |

`crystal-violet-integrated-rate-law-comparison` is absent because it is unchanged; see § 21.12.

Nine atoms were added. Five extend **spectrophotometry** (5 → 10), which this cycle owns:

- `atom.observe.configure-photometer` — the wavelength and the measured quantity, recorded as
  configuration and never derived from the sample.
- `atom.observe.prepare-cuvette-optical-faces` — conditioning, wiping, and orientation.
- `atom.place.remove-cuvette` — the removal every insertion the source states implies.
- `atom.record.photometer-reading` — the record that consumes a read and may not carry a value.
- `atom.measure.photometric-aliquot` — K-04's time-coupled draw from the reacting mixture.

Four are outside the family, each because no existing atom fits and the operation is source-stated:
`atom.dilute.to-final-volume` (measurement), `atom.transfer.initiate-timed-reaction` (kinetics), and
`atom.transfer.route-to-waste-treatment` and `atom.transfer.treat-waste-to-endpoint` in a new
**waste-treatment** family. One role was added, `photometric-aliquot-tool`, because K-04's transfer
tool is chosen by the approved plan and the source assigns the step no measurement — binding it to
`variable-volume-measuring-device` would have asserted a precision the manual does not state.

**Conditioning was deliberately not made a `rinse`.** Investigation 1 finding 3.8 and Investigation
11 finding 3.7 both leave conditioning, orientation, and wiping unspecified (R/C).
`atom.observe.prepare-cuvette-optical-faces` records the classroom rule and carries an explicit
constraint forbidding a stated rinse volume, because turning an R practice into a manual-stated
requirement is exactly what CONTINUATION_CYCLE_06.md's first task forbids.

**One existing binding was retargeted.** Cycle 02's seed bound `atom.observe.blank-photometer` to
`cv11-prepare-approved-blank`, which prepares a cuvette and has no instrument interaction. The blank
preparation now carries `atom.observe.prepare-cuvette-optical-faces` and the zero itself carries
`atom.observe.blank-photometer`. Both still cite C-06 (M/C); only the atom moved.

**158 source traces** were added and 5 replaced, all for Cycle 06's own owners, bringing this
cycle's owners from 5 traces to 163. Every citation is a
phase-table row from one of the two dated plans, with the basis letters copied verbatim: Investigation
1's P-01 (M) through P-11 (M) plus I-04 (M), and Investigation 11's C-02 (M) through C-07 (M/R),
K-01 (M/R) through K-07 (M/C), and W-01 (M)/W-02 (M/C).

### 21.6 Teacher configuration that cannot be filled in silently

Every open confirmation point in the two plans now has an action that records it and declares it
unresolved, and `cycle06/confirmation-point-resolved` fails if a later cycle removes the
declaration.

| Plan | Point | Where it lives |
|---|---|---|
| Inv. 1 | 1 — stock concentration, dilution assignments, wavelength | `i1-record-stock-concentration`, `i1-record-dilution-assignments`, `i1-record-wavelength` |
| Inv. 1 | 2 — the `1 x 10^T` ambiguity and the linearity criterion | `i1-record-source-ambiguity` (`candidateTransformations` keeps all four verbatim), `i1-record-confirmed-calibration` |
| Inv. 1 | 3 — blank, cuvette rule, instrument range, replicates | `i1-record-blank-cuvette-rule`, and `i1-record-over-range-response` for the range branch |
| Inv. 1 | 4 — class-data quality and outlier handling | `i1-record-confirmed-calibration` |
| Inv. 1 | 5 — Blue #1 molar-mass convention | `i1-record-molar-mass-reference` |
| Inv. 11 | 1 — device, wavelength, blank composition | `cv11-set-approved-wavelength`, `cv11-prepare-approved-blank` |
| Inv. 11 | 2 — volumes, mixing, time zero, interval, replicates | `cv11-design-kinetic-volumes`, `cv11-design-timing-and-stop-rule`, `cv11-approve-kinetic-design` |
| Inv. 11 | 4 — percent-completion stop rule and dead time | `cv11-confirm-percent-completion-stop`, `cv11-record-dead-time` |
| Inv. 11 | 6 — acid, pH target, disposal rule | `cv11-neutralize-excess-base`, `cv11-verify-neutralization-and-disposal` |

Investigation 1's assigned ratios are stored as data (`assignedRatios`) rather than asserted in
prose, and every one of the eight totals 10 mL, which the verifier checks rather than assumes.
Investigation 11's printed `10. mL` precision is preserved verbatim as `statedFinalVolume` on each
dilution and on the kinetic design; the verifier fails if it is rounded to `10 mL`.

**Confirmation points 3 and 5 of Investigation 11 stay unresolved and unowned by this cycle.** The
absorbance-reliability and calibration-fit thresholds remain `"teacher-configured"` strings, and the
optional `z`/`k` extension stays gated — see § 21.9.

### 21.7 Visual states

The nine states Cycle 05 re-owned to Cycle 06 are resolved (§ 19.2). All nine are `liquid-style`.

The eight `blue1-*-*` ratios are one monotonic alpha ladder over the stock's own blue, scaled by the
assigned stock fraction of the ten-millilitre standard. `quantitativeClaim` is `"ordinal"` for all
eight and the provenance says why it can never be more: the manual states no colour for any standard,
and the stock molarity is teacher-supplied, so no alpha could stand for a concentration even in
principle. Every quantitative claim in the investigation comes from the `%T` reading and the
`M1V1 = M2V2` calculation.

`blue1-10-0` came out byte-identical to `blue-dye-solution`, which is correct rather than
coincidental — the 10 mL stock / 0 mL water standard *is* the undiluted stock — so both entries
declare it through `sharesAppearanceWith` rather than leaving it to read as an accident.

`purple-solution` is one colour for the dye, not a series. **No intermediate fade states were
added.** Investigation 11 § 9 requires the run to stop at an approved percent-completion threshold
"not when the solution merely 'looks colorless'", so a fade ladder would have created exactly the
appearance-as-evidence path the source forbids. The stop rule is carried by
`cv11-confirm-percent-completion-stop`, and `quantitativeClaim` is `"none"`.

### 21.8 Static enforcement

`scripts/checkContentConsistency.mjs` gained one rule function, `checkCycle06Photometry`, inside the
`CYCLE 06 RULES` block, reporting **19 rule ids**, and 15 negative self-fixtures (54 → 77). The rules
are keyed on atom ids and declared parameters rather than on owner ids, so Cycle 07's brass work
inherits them.

| Rule | What it prevents |
|---|---|
| `mirror/photometric-unit-drift` | The checker's unit table drifting from `src/runtime/calculations.ts` |
| `cycle06/photometric-quantity-unknown` | A fourth quantity or mode appearing by typo |
| `cycle06/photometric-unit-mismatch` | An absorbance filed as `%T` |
| `cycle06/photometric-quantity-on-non-storing-action` | `photometricQuantity` on a step that stores no reading, which would take it outside the unit rule |
| `cycle06/configuration-measurement-unstored` | A configuration value with no measurement id or unit to be stored under |
| `cycle06/photometer-wavelength-unproduced` | A wavelength gate naming a measurement no resolved action writes — the F-SP-12 defect |
| `cycle06/photometer-read-ungated` | A read with no wavelength, zero, cuvette, or measurement id — including one bound to the read atom that declares no `photometerOperation` at all, which the runtime block would never see |
| `cycle06/photometer-zero-ungated` | A zero with no wavelength or blank |
| `cycle06/photometer-operation-unknown` | A third operation the reducer does not implement |
| `cycle06/photometer-reading-prepopulated` | F-SP-04 growing back |
| `cycle06/photometer-record-without-read` | A record that does not consume its read's measurement |
| `cycle06/transmittance-operand-confused` | `-log10` reaching a percent transmittance |
| `cycle06/cuvette-slot-unbalanced`, `cycle06/cuvette-lifecycle-unnamed` | An insertion with no matching removal, which the runtime's slot check turns into a dead end |
| `cycle06/confirmation-point-resolved` | A later cycle quietly filling in one of § 21.6's twelve markers |
| `cycle06/hydroxide-extension-promoted`, `-missing`, `-carrier-missing` | § 17.4.1 being undone |

All of them were tamper-tested **against real content**, not only against fixtures, in two rounds.
Eight simultaneous mutations of the live files — a dropped zero gate, a reading put back on a record
action, a deleted removal, a resolved confirmation point, a percent operand fed to the decimal
logarithm, an absorbance filed as `%T`, the hydroxide extension appended to the root process, and a
drifted unit in `calculations.ts` — produced exactly eight failures, one per mutation. The
self-review's four rules were then tamper-tested the same way: removing `configurationQuantity` from
`i1-record-wavelength` reproduced the shipped defect's exact signature, ten unreachable reads plus
the zero. Every file was restored byte-identically from a copy taken first.

`scripts/verifyCycle06Spectroscopy.mjs` enforces **470** investigation-specific invariants the
generic rules cannot express: ratio completeness and the 10 mL total, per-ratio volume agreement
between the measure, the transfer, and the calculation, the `%T` → `T` → `-log T` operand chain, the
five calibration standards against the 25.0 µM stock, the kinetic chronology from armed timer through
dead time to a freed slot, the two waste verifications, every version pin on both sides, and — added
by the self-review — a full measurement-provenance closure over both labs and all seven techniques.
It was tamper-tested twice: six simultaneous mutations produced exactly six failures, and a second
round removing a `configurationQuantity` and adding a shipped `configuredValue` produced exactly the
four the provenance section is there to catch.

`scripts/verifyCycle04Migration.mjs` carries an itemized Cycle 06 declaration in the same form Cycle
08 introduced: seven owners with the exact count of physical actions each must hold, the two labs
included because their action ids carry no technique prefix and because Investigation 11's whole
kinetic run is lab-local. A declaration that reaches an action nobody touched still fails as a stale
claim. The two labs' expected resolved counts moved 131 → 159 and 114 → 116.

### 21.9 The optional hydroxide-order extension

§ 17.4.1 handed Cycle 06 an obligation rather than a task: the three `cv11-extension-*` actions must
stay declared-but-unreferenced, the carrier must stay embedded, and its nodes must stay out of the
lab root process, because appending them would convert an optional teacher-approved branch into
required student flow and pre-empt Investigation 11's confirmation point 5.

**Cycle 06 changed nothing about it, and now guards it.** The carrier is untouched, the three
actions are untouched, `unused-actions:lab:crystal-violet-rate-law` survives in the debt baseline
with the same three ids, and `cycle06/hydroxide-extension-promoted` plus five verifier invariants
fail if any of the three properties is broken by a later cycle. The lab's process grew from 111 to
113 nodes and none of the two new ones is an extension node.

### 21.10 Baseline movement, measured but not written

Both baseline files are coordinator-owned under the Wave A contract. Neither was written; both
deltas below were measured with the read-only tools.

**Lint baseline: 90 entries resolved in Cycle 06's scope, 0 added.**

- **81 resolved** `action/atom-identity-missing`, one per pre-existing physical action in § 21.5's
  table. None is a duplicate row disappearing: each is an action that now carries an identity, its
  role bindings, and a source trace. The 30 actions this cycle created were never baselined and so
  appear in neither column.
- **9 resolved** `visual-state/unresolved` — the eight Blue #1 ratios and `purple-solution`.
- **0 new.** The corpus-wide report shows 24 new entries; every one belongs to a Wave A sibling
  (`quick-ache-extraction-recovery`, the titration owners, `syringe-nail-locked`).

**Debt baseline: 11 of the 99 entries would clear on regeneration.** The two
`physical-actions-without-interaction` rows for `blue1-percent-transmittance` (9/9) and
`blue1-standard-dilutions` (28/28) — the largest single interaction gap in the corpus — and the nine
`visual-state-unresolved` rows. Three in-scope entries survive deliberately: the
`crystal-violet-hydroxide-order-extension` carrier, the three `cv11-extension-*` unused actions, and
`crystal-violet-kinetics`' three uninteracted physical actions, which stay as the marker for an
orphan this cycle keeps orphaned (§ 21.11).

**Self-fixtures: 54 → 64. Rules added: 12 in one function. Rules retired: 0.**

### 21.11 Orphan dispositions

All three are **kept orphaned**, with rationale, rather than retired. The Wave A contract's default
permits either; retiring would require removing a file, which the session's standing instruction
places behind explicit confirmation, and in all three cases the recorded rationale is worth more
than the deletion.

| Orphan | Actions | Disposition | Rationale |
|---|---|---|---|
| `crystal-violet-kinetics` | 6 | **Keep orphaned** | Shares **zero** action ids with the lab's 38 lab-local kinetics actions (meta_plan Cycle 01 and Cycle 04). Adopting it would rebind Investigation 11's kinetic flow to a 6-action generator stub with no timed series, no dead time, and no stop rule. It declares no interaction spec at all (§ 8.3), is already listed in `nonSourceDerivedOwners`, and its `calculate-rate-constant` carries a literal `expected: 0.12 min^-1` while the source derives `k*` in `s^-1`. Its three uninteracted physical actions stay in the debt baseline as the marker. Candidate for Cycle 13's closure pass. |
| `beers-law-calibration` | 7 | **Keep orphaned; flagged for Cycle 07** | Shares zero action ids with any `blue1-*` or `brass-*` owner. Its `record-percent-transmittance` carries its own `value` and its `calculate-absorbance` a literal `expected: 0.2041` — the two shapes this cycle removed from live content. Adopting it into `blue1-spectroscopy` would mean rebinding 141 imported ids to a stub with no per-ratio identity, no slot lifecycle, and no teacher configuration. Cycle 07 meets it again: it is the nearest generator sibling of `brass-spectrophotometry`, which brass actually pins. |
| `transmittance-dilution` | 20 | **Keep orphaned; flagged for Cycle 13** | The closest orphan to live content: it held the corpus's only pre-Cycle-06 `fill-blank-cuvette` → `wipe-blank-cuvette` → `zero-with-blank` → `wipe-orient-sample-cuvette` → `insert-sample-cuvette` sequence, which is the shape Cycle 06 has now authored in source-traced form into `blue1-percent-transmittance`. It shares zero action ids with any live owner, dilutes in a `volumetric-flask` rather than by Investigation 1's test-tube ratios, and all three of its calculations carry literal expected values. Its value is now historical. |

No entry in `public/techniques/index.json` changes as a result. The intended change is **none**.

### 21.12 What did not change

Byte-identical across all seven techniques: `initialState`, `requiredEquipment`, `commonMistakes`,
`title`, `learningGoal`, `resetBehavior`. Byte-identical in both labs: `equipment`, `initialState`,
`techniques`, `learningGoals`, `safetyNotes`, `title`, `description`, `audience`. Every
`startNodeId` is unchanged and every process remains one linear chain of `validationPassed` edges.

`crystal-violet-integrated-rate-law-comparison` is **unchanged and still pinned at 1.0.0**. Its six
calculations carry literal expected values, which § 21.13 records as a limitation rather than
papering over; adding operand prerequisites there would have required naming measurements the
standalone technique's own process cannot produce, and Cycle 08's pattern is that a technique's
prerequisites stay satisfiable by that technique.

Brass spectroscopy was not touched. `technique:brass-spectrophotometry`, `lab:brass-colorimetry`, and
every atom, role, and visual state they use are unchanged, which
`node scripts/verifyCycle04Migration.mjs` measures rather than asserts.

**One deliberate change reaches outside Cycle 06's owners.** The `decimalTransmittance` and
`absorbanceFromPercentT` templates now take their unit from the quantity rather than from an authored
parameter. That changes the stored unit string for two orphan techniques —
`transmittance-dilution` (`-` → `T`, `A` → `absorbance`) and `beers-law-calibration`
(`absorbance` → `absorbance`, unchanged in value). Both are referenced by no lab, so no runtime
behaviour changes; the alternative was to leave two of the three quantities able to carry any unit an
author typed.

The reducer's other additions are additive for every other owner: `photometerOperation`,
`photometricQuantity`, `wavelengthMeasurementId`, `requiresZeroNotebookTag`, `cuvetteInstanceId`,
`cuvetteSlotZoneId`, `instrumentReadingValue`, `reliableMaximum`,
`stockConcentrationMeasurementId`, `decimalTransmittanceMeasurementId`, and
`decimalTransmittanceCalculationId` all keep the pre-Cycle-06 behaviour when a caller declares none.

### 21.13 Limitations, recorded rather than hidden

1. **There is no instrument-state object.** The wavelength, the zero, and the slot occupancy are
   carried by a measurement, a notebook tag, and an attachment respectively — all real runtime
   state, all checked before a reading — but `RuntimeState` has no `instrumentSettings` map, so the
   instrument cannot report its own configuration and a zero cannot be invalidated by changing the
   wavelength afterwards. Adding one would change `src/domain/types.ts` and `createRuntime.ts`,
   which the Wave A contract puts beyond an activity cycle. Deferred, unowned.
2. **The integrated-rate-law fits carry stored answers.** `cv11-fit-zero-order`,
   `-first-order`, `-second-order`, `cv11-select-order-w`, and `cv11-calculate-k-star` compare a
   value to itself, so the central result of Investigation 11 is still asserted rather than derived.
   Deriving it needs a least-squares implementation over the recorded `(time, absorbance)` pairs and
   a concentration series from the calibration line — a subsystem no Cycle 06 task lists, and one
   that would be worth doing only together with `cv11-fit-calibration`, which has the same shape.
   Deferred; the natural owner is Cycle 13.
3. **Displayed rounding is still not separated from the raw value.** § 20.10's second limitation is
   unchanged. Readings are stored unrounded with their unit; no `displayedDecimals` contract exists
   anywhere in the runtime, and adding an unconsumed parameter would have been decoration.
4. **`instrumentReadingValue` is a configured response, not a model.** Investigation 11's thirteen
   readings come from the teacher-approved simulator profile the content already declared. The
   simulator does not compute absorbance from the cuvette's contents, so changing a standard's
   concentration would not change what the instrument reports. This is the honest floor of what
   content plus the existing runtime can express, and it is strictly more than the record-side
   parameter it replaced.
7. **Both investigations now require a classroom profile before any apparatus step, and Investigation
   1 requires more of one than Investigation 11.** This is the visible consequence of § 21.15's first
   finding and it is deliberate, not a regression to be defaulted away. Investigation 11 needs one
   configured value — the approved wavelength — after which its thirteen reads have responses and the
   run completes. Investigation 1 needs the wavelength, the stock concentration, **and** a response
   for each of its eight `%T` reads, because finding 3.1 withholds all of them; with none supplied it
   blocks at the first configuration step with a message naming the missing value. Before this cycle
   it advanced past reads that produced nothing and stalled at the record step with no diagnostic at
   all. A classroom profile that supplies `configuredValue` and `instrumentReadingValue` makes both
   investigations completable; inventing those numbers here would be the one thing the source
   explicitly forbids.
8. **The Student Player has no numeric or free-text capture for an `observe`.** `ProcessSidebar`
   derives a record's value from a pending measurement or from the action's own parameter and
   collects nothing of its own, which is why § 21.4's "student-entered" claim was withdrawn. Cycle 06
   did not add a capture control — that is player work, outside an activity cycle — but it is now the
   single change that would let a teacher configure these values in play rather than in content.
   Deferred; the natural owner is Cycle 13.
5. **Replicate policy is recorded, not enforced.** Both plans leave the replicate count to the
   teacher (Inv. 1 § 9, Inv. 11 § 10). `replicatePolicy: "teacher-configured"` records that; nothing
   makes the player run a second trial.
6. **The `over-range` tag is reachable only when content declares a numeric `reliableMaximum`.** Both
   investigations leave the reliable range teacher-configured as a string, so in the shipped content
   the tag never fires. The mechanism is tested and the parameter is documented; the value is a
   classroom decision.

### 21.14 Validation run by Cycle 06

Run: `node --check` on all three changed `.mjs` scripts; `npm run content:check` (77/77
self-fixtures, 0 new violations in Cycle 06's scope, 90 resolved); `npm run typecheck`,
tamper-tested by changing `calculateAbsorbanceFromDecimalT`'s parameter type and observing `TS2365`
and `TS2345` in three files, then restoring; `node scripts/verifyCycle06Spectroscopy.mjs` (470/470),
tamper-tested in two rounds producing exactly six and exactly four failures; the 19 checker rule ids
tamper-tested against real content in two rounds producing exactly eight and exactly four failures;
`node scripts/verifyCycle04Migration.mjs` (0 failures for Cycle 06's owners; those that remain all
belong to Wave A siblings that have not yet declared their own changes); a corpus-wide scan for
`observe` actions declaring a `measurementId` the runtime does not write, which returned three — all
Cycle 06's, all fixed; `git diff --check` clean over the cycle's paths. Every tampered file was
restored from a copy taken first and compared byte-for-byte afterwards.

**The self-review re-ran all of it.** § 21.15's six findings came from reading this cycle's own code
against this section's claims after every check above was already green, which is the point: none of
those checks could see a gate whose measurement nothing writes, because that is what the checks now
do.

**Not run, and deliberately so.** Neither baseline writer, and not `npm run content:docs`: both
baselines and `docs/atomic-steps.md` are coordinator-owned under the Wave A contract.
`docs/atomic-steps.md` was already reported stale before this cycle began — a sibling's atom appends
caused that — and Cycle 06's nine atoms leave it stale. The coordinator regenerates it once after
Wave A.

**Intentionally not run**, under the `AGENTS.md` validation policy: Vitest in any form, builds,
Playwright, browser/E2E, camera and gesture checks, performance tests, and mobile QA. Two test files
were authored and not executed — `src/runtime/__tests__/cycle06Spectroscopy.test.ts` and
`src/equipment/__tests__/cycle06VisualPrecedence.test.ts`. **Consequently the photometer gate, the
three conversions, and the micromolar dilution template this cycle implemented are all unexecuted.**
The static evidence establishes that the content declares the right operands, that the handlers read
them, and that the types agree; it does not establish that a student can now complete either
investigation. Given that F-SP-03 was a silently-wrong calculation of exactly the class § 20 found in
Investigation 3, and that F-SP-01 and F-SP-04 are completion-integrity defects no static check had
caught, a single Vitest run of those two files is the highest-value verification still outstanding
for Investigations 1 and 11.

No PNG or SVG was created or changed. The nine visual states resolved here are render styles rather
than assets, so the asset-inspection step had nothing to inspect; the ladder's monotonicity was
verified numerically by fill alpha, not visually.

### 21.15 Cycle 06 self-review, and the six findings it produced

Reviewing this cycle's own code against § 21's claims found six defects. Four are fixed, one is
recorded as a declared dependency, and one is a claim this section had to withdraw.

**(1) The three configuration values were never stored. This is the serious one.**
`i1-record-wavelength`, `i1-record-stock-concentration`, and `cv11-set-approved-wavelength` are
`observe` actions declaring a `measurementId`, `inputMode: "numeric"`, and a unit. Only six verbs
write a measurement — `weigh`, `measureVolume`, `dilute`, `developChromatogram`, `record`, and
`observe` from its chromatography-ruler or photometric-read branch — so the generic `observe` path
these three take wrote a notebook entry and nothing else. Measured over the corpus, exactly three
actions were in that state and all three are Cycle 06's.

Every gate this cycle added consumes one of them. The consequence, measured rather than estimated:
`i1-wavelength` was consumed by 11 actions and produced by none, `i1-stock-concentration` by 30 and
produced by none, `cv11-approved-wavelength-nm` by 15 and produced by none. **Every Blue #1 zero and
read, every Blue #1 stock measurement, every Blue #1 concentration calculation, and every
crystal-violet zero and read would have failed.** The first version of this cycle had replaced a lab
that computed fabricated zeros with a lab that could not be started — strictly worse for a student,
and the same class of defect § 20 records as F-HW-03.

The fix is a `configurationQuantity` block in the `observe` handler, entered only when an action
declares it, which stores the value as a measurement and keeps the notebook entry so the existing
`notebookEntry` gates continue to fire. The value comes from a declared `configuredValue`, because
this is teacher configuration rather than a student reading. **The shipped content declares none**,
so the step blocks naming the missing classroom value — which is what meta_plan requires of an
unresolved `C` point, and what Investigation 1 finding 3.1 means by "do not invent these".

**(2) "Student-entered" was a provenance the player cannot deliver.** § 21.4 claimed Investigation
1's eight `%T` reads were student-entered, in contrast to Investigation 11's configured responses.
`ProcessSidebar` collects no numeric input for an `observe` — it derives a record's value from a
pending measurement or from the action's own parameter, and nothing else — so no student could ever
supply one. A sibling cycle's comment beside `studentResponseRequired` records the same gap for free
text. The claim is withdrawn, the parameter on all 17 affected actions now reads
`classroom-configured-instrument-response`, and the runtime's failure message names the two sources
that do exist instead of telling a student to type a number they cannot type.

**(3) The provenance closure check that would have caught (1) did not exist, and now does.** A gate
naming a measurement id nothing writes reads exactly like a working gate in the JSON, which is why
neither the checker nor the verifier noticed. `cycle06/photometer-wavelength-unproduced` mirrors the
reducer's measurement-writing sites and fails when a declared wavelength id is unreachable; the
verifier adds a full closure over both labs and all seven techniques. Tamper-tested by deleting
`configurationQuantity` from `i1-record-wavelength`, which reproduced the shipped defect's exact
signature — ten unreachable reads and the zero.

**(4) The first version of that rule was itself wrong, and running it is what showed that.** It built
its produced-id set from `entry.definition.actions`, which for a bundled lab source holds only the
lab-local actions. Both labs import the configuration step that writes the wavelength, so the rule
reported nine false positives on its first run. It now uses the resolved set, mirroring what
`checkActions` already does for reference resolution. The lesson is the cycle's own: a rule reasoned
about is not a rule tested.

**(5) `technique:blue1-class-calibration` cannot be completed standalone, and that is correct rather
than broken.** It consumes eight `i1-r*-percent-t` measurements that only `blue1-percent-transmittance`
writes, because the source separates measuring `%T` (P-10, P-11) from pooling and plotting it (A-01
to A-04). It resolves in the lab, which imports both. This was pre-existing and the first pass missed
it. Rather than invent reads the source does not give this technique, the verifier now states the
dependency as an invariant: a technique may consume an id a sibling writes **only if** some lab
pinning it produces that id, so the operand is unreachable nowhere.

**(6) Two smaller corrections.** The first version renamed `cv11-standard-NN-dilution` to
`cv11-standard-NN-stock-volume`; nothing referenced the old ids, so the rename bought nothing and
only enlarged the Cycle 04 fingerprint diff — reverted. And `cycle06/photometric-unit-mismatch` was
shaped around its own false positive: it reached configuration steps through `photometricQuantity`
and needed a verb-and-operation exception to stay quiet. `photometricQuantity` now means only "the
quantity this action stores", configuration steps declare `photometricMode` instead, and
`cycle06/photometric-quantity-on-non-storing-action` fails if the two are confused again.

**One thing the review confirmed rather than corrected.** Renaming `cv11-approve-kinetic-design`'s
notebook tag from `teacher-approval` to `kinetic-approval` was load-bearing, not cosmetic:
`cv11-approve-wavelength-and-blank` already used `teacher-approval`, so the kinetic gates would have
been satisfiable by the wavelength approval — the F-HW-13 defect of § 20.1, in a different
investigation. A scan for gate tags shared by more than one action in the same resolved owner now
reports none.

## 22. Cycle 09 — redox and acid-base titration workflows

Investigations 4, 8, and 14. This section is the merged Wave A record.

Reproduce with `node scripts/verifyCycle09Titration.mjs` and `npm run content:check`.

### 22.1 What was wrong

Every finding below was present in content that every rule in `checkContentConsistency.mjs`
accepted, and none of it was reachable by any check the repository had.

1. **Three calculation templates had no implementation at all.**
   `public/labs/hydrogen-peroxide-redox-titration.json` authored `permanganateMolarityFromIron`,
   `hydrogenPeroxidePercent`, and `meanOfCalculations`. None existed in `src/runtime/calculations.ts`
   or in the reducer's template chain, so all twelve of the lab's calculation steps fell through to
   `Number(action.value ?? params.expected ?? 0)`, computed the teacher's own `expected` value,
   compared it against itself, and passed. The lab's central result — percent H2O2 by mass — was the
   answer key, restated. This is the same class of defect Cycle 08 found in
   `gravimetricPrecipitateMass` (§20).

2. **Burette readings were authored constants.** Twenty-one `record` actions in Investigation 8
   carried `value:` — `0.12`, `9.95`, `0.27`, `34.83` and so on — as did
   `acid-base-titration`'s `record-initial-burette` (`0.2`), `titration-endpoint`'s two record
   actions (`0.12`, `23.74`), `redox-titration`'s two (`0.2`, `18.6`), and
   `titration-curve-analysis`'s initial pH (`2.8`) and equivalence volume (`24.8`). The student
   filed numbers nobody read.

3. **There was no way to read a burette.** `atom.measure.read-burette` was declared by Cycle 02 as
   `measureVolume` + `readInstrument`, but every `measureVolume` in the reducer was a pour, and
   `validateLabDefinition` required both a source and a target for that verb. The atom was
   unauthorable, which is why finding 2 existed.

4. **A dispense counted from a placeholder.** `dispenseRecordFor` fell back to
   `numberSetting(params, "initialBuretteReadingMl", 0)`, so a dispense whose initial measurement was
   absent silently started from a fabricated 0.00 mL.

5. **Nothing gated a dispense.** `executeDropDispense` checked only that the source and target
   existed and that the source was pourable. An unmounted burette, an empty receiver, and an
   unrecorded initial reading were all acceptable.

6. **The endpoint was disclosed in prose.** `acid-base-titration`'s dispense node said "click the
   stopcock 496 times to add 24.80 mL of NaOH", which is the measurement the lab exists to teach.

7. **Delivery volume was a setting.** `redox-titration/deliver-permanganate` poured a fixed 18.4 mL
   and `titration-curve-analysis/deliver-curve-titrant` a fixed 24.8 mL, as `transfer` actions with a
   `volumeMl`. Neither was a titration.

8. **Authored endpoint colours were inert, and the narration was acid-base only.**
   `titrationVisualState` returned `titration-clear` / `titration-pale-pink` / `titration-dark-pink`
   unconditionally, so the four registered permanganate states Investigation 8's content already
   authored — `redox-colorless-solution`, `permanganate-faint-pink`, `permanganate-overshoot-purple`,
   `permanganate-solution` — never reached the screen. This is F-07 (an unauthored default beating an
   authored state) surviving inside the reducer. The same three code paths hard-coded "excess NaOH
   and an alkaline solution" and the mixture label "Titrating acid mixture", so a permanganate
   overshoot, in a system with no base in it, was reported to the learner as alkaline.

9. **Endpoint evidence was corpus-wide.** The `observe` handler's overshoot narration searched every
   `dropDispenses` record, so in a lab with replicates one trial's overshoot would be reported on
   another trial's endpoint observation. This is the cross-sample evidence leak Cycle 08 found in the
   dry handler (§20.6), in a different handler.

10. **`acid-base-titration` was the last load-bearing embedded technique.** Its
    `acid-base-titration-state` embed supplied all nine of its equipment instances and the lab had no
    `initialState.equipment` of its own, so it was the only remaining embed whose payload the runtime
    consumed (`_WAVE_A_CONTRACT.md`, "Embedded techniques — one is load-bearing").

### 22.2 What changed

### Runtime, additive

- `src/domain/types.ts` — `TitrationModelBase`, `AcidBaseTitrationModel`, and a new
  `RedoxTitrationModel`. The redox model adds only `analyteMolarMassGPerMol` and
  `sampleDensityGPerMl`, the two things a percent-by-mass result needs; an acid-base model may not
  declare either, and `validateTitrationModels` rejects it if it does.
- `src/domain/titrationModels.ts` — `deriveTitrationDropPlan` accepts `redox`. The drop-plan geometry
  was already general: the equivalence volume is
  `(analyteM × analyteV × ratio.titrant) / (titrantM × ratio.analyte)` for either chemistry, so the
  5 Fe(II) : 1 MnO4- and 5 H2O2 : 2 MnO4- ratios are configuration rather than code. Two new
  parameter injectors carry the model into the redox standardization and percent templates.
- `src/runtime/calculations.ts` — `calculatePermanganateMolarityFromIron`,
  `calculateHydrogenPeroxidePercent`, `calculateMeanOfValues`, and
  `HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL`, appended after the existing group. Each derives from named
  evidence and throws rather than returning a placeholder. `calculateMeanOfValues` also enforces the
  configured replicate spread: the source requires acceptable precision and never states a number, so
  a run outside the configured range is rejected instead of averaged away.
- `src/runtime/reducer.ts`, inside existing handlers only:
  - `measureVolume` gains a `readInstrument` branch. It reads the instrument and moves nothing. The
    scale direction is declared by the action: the default is the upward "how much is in it" reading,
    and a burette, which is graduated downwards from 0 at the top, declares
    `scaleReadsDownward: true` and reads `capacity − contents`. Precision is the equipment
    definition's unless the content configures one of the resolutions its plan lists.
  - `executeDropDispense` gains three gates, evaluated only while a dispense is still being set up so
    that accepting an endpoint mid-run cannot be blocked by them: the burette must be clamped
    (`attachmentsForChild`), the receiver must hold analyte, and the initial reading must exist as a
    recorded measurement. **A gate in a shared handler is a new obligation on every owner that
    reaches it** — see §22.5.1 for what that cost this cycle.
  - `record` honours `studentValueRequired`, which previously only `calculate` did.
  - `recordedInitialBuretteReading` replaces the `initialBuretteReadingMl` fallback. There is no
    fallback now.
  - `titrationVisualState`, the mixture label, the endpoint and overshoot prose, and the `observe`
    overshoot narration all read authored parameters with the previous literals as defaults.
  - The overshoot narration recognises per-trial `<trial>-endpoint` tags and, when the observation
    names its own `dispenseActionId`, scopes to that dispense.
  - The whole calculation-value expression is wrapped in one try/catch, so a template that rejects
    its operands — the replicate-spread rejection is ordinary play — surfaces as feedback instead of
    escaping the reducer.
- `src/domain/validation.ts` — `validateTitrationModels` accepts `redox`;
  `validateAuthoredActionEndpoints` exempts a `measureVolume` whose interaction is `readInstrument`
  from the target requirement. The source stays required. **This file is a Wave A single-writer
  file; see the handoff.**

Every runtime change is additive: content that declares none of the new parameters behaves exactly as
before. The one deliberate wording change to existing behaviour is the acid-base overshoot sentence,
which now reads "Endpoint accepted after 1 extra drop; darker pink shows excess NaOH and an alkaline
solution." rather than "…; the darker pink color indicates excess NaOH and an alkaline solution."

### Content

| Owner | Before | After |
| --- | --- | --- |
| `lab:acid-base-titration` | 9 actions, 9 nodes, 0 lab equipment, 1 load-bearing embed | 1 lab-local action, 12 imported, 13 nodes, 9 lab equipment instances, embed preserved and now inert |
| `technique:titration-endpoint` | orphan, 9 actions, 4 with hard-coded values | **adopted**, 12 actions @2.0.0, conditioning and instrument reads added |
| `lab:hydrogen-peroxide-redox-titration` | 42 actions, 2 physical, 21 authored readings | 106 actions, 8 fully physical trials, 0 authored readings |
| `technique:redox-titration` | orphan, 6 unatomised physical actions, fixed 18.4 mL pour | 10 actions @1.1.0, model-driven dispense, instrument read |
| `technique:titration-curve-analysis` | orphan, 4 unatomised, authored pH and equivalence volume | 11 actions @1.1.0, probe placement, pH read, model-driven dispense |
| `technique:beverage-ph-volume-titration` | orphan, 1 unatomised physical action | 10 actions @1.1.0, probe placement is a real `place` |
| `lab:beverage-acidity` | 17 actions, 1 physical | 18 actions, probe placement added |
| `lab:acid-base-titration-curves`, `…-config.json` | custom route | **unchanged** |

`acid-base-titration` is now a bundled lab source with a version-pinned, action-only
`techniqueRefs` entry (`titration-endpoint@2.0.0`, `actionIds: "all"`). Its nine equipment instances
were copied out of the embed verbatim, except the burette, which no longer starts prefilled: the
technique conditions and fills it, and the initial reading is a consequence of that fill. The embed
itself is preserved and is now inert, because `getInitialEquipment` prefers the lab's own
`initialState.equipment`.

Investigation 8 now runs eight physical trials — one practice, three standardization, two per
assigned sample — each with its own aliquot, acidification, burette fill where the level requires
one, instrument read, recorded reading, dispense, endpoint observation, final reading, calculation,
and discard to the designated waste receiver. Every evidence identity is per-trial. The reaction
mixture is built by the student rather than pre-charged: the flask and the burette both start empty,
and a new `permanganate-stock-1` reagent bottle is the titrant source.

The hidden true titrant concentration is 1/49 M. It is chosen so the Fe(II) equivalence volume falls
exactly on a whole 0.2 mL increment (9.80 mL = 49 portions), which keeps the quantisation of a
portion-wise addition out of the student's result; it sits inside the 10 mL practice allocation the
manual states; and it is exactly what the standardization determines. No content string reveals it.

### Registries

- `src/domain/atomRegistry.json` — the titration family goes 5 → 12. Added:
  `atom.place.burette-support` (TIT-00/TIT-01), `atom.place.titration-receiver` (TIT-03),
  `atom.transfer.fill-burette` (T-02, ST-01 — filling is not conditioning),
  `atom.transfer.acidify-analyte` (PA-03, HP-02), `atom.place.immersed-ph-probe` (TIT-04, T-04),
  `atom.observe.read-titration-ph` (T-08, T-07), and `atom.transfer.discard-titrated-mixture`
  (ST-06). Each exists because an operation the dated plans state had no identity in any family.
- `src/domain/equipmentRoleRegistry.json` — one new role, `acidifying-reagent-source`, whose
  `mustNotContactSolidOxidiser` constraint records S-05. `immersed-probe-vessel` widened to admit
  `beaker-150ml` and `erlenmeyer-flask-250ml` on the strength of TIT-03/TIT-04 and T-02/T-04.
- `src/equipment/visualStateRegistry.json` — the five states Cycles 05 and 08 re-owned to Cycle 09
  are resolved. Four permanganate states become `liquid-style`; Investigation 8 finding 6 states all
  three appearances outright, so they are source-observed rather than invented.
  `teacher-configured-beverage` becomes `nonvisual` — a decision, not deferred debt. The beverage is
  teacher configuration and confirmation point 4 leaves colour interference with the indicator
  endpoint open, so any rendered colour would assert both an identity the teacher owns and an
  interference the source does not settle.
- `docs/architecture/source-trace-registry.json` — 153 → 382 traces, all appended under Cycle 09's
  own owners. `lab:acid-base-titration` and `technique:titration-endpoint` are in
  `nonSourceDerivedOwners` and correctly carry none; see §22.5.

### 22.3 The Erlenmeyer/beaker receiver exception

Recorded in `analyte-receiver.receiverSelection` rather than resolved by flattening the vessels.

An Erlenmeyer is the receiver whenever the endpoint is read from an indicator colour change while
swirling: the narrow neck is what makes vigorous swirling safe under a burette tip, and that is the
operation Investigation 4 PR-03/T-07 and Investigation 8 ST-03 describe. A beaker is admissible only
where an immersed pH probe is the measuring instrument — Investigation 14 TIT-03 puts a
"flask/beaker" below the tip and TIT-04 then requires the bulb immersed and clear of the stir bar, a
geometry the Erlenmeyer neck fights. `titration-curve-analysis` therefore keeps its `beaker-250ml`
and says why in the action itself.

Collapsing the two would have silently decided Investigation 14 confirmation point 5 — whether an
indicator is used in formal trials at all. `cycle09/receiver-exception-undocumented` fails if the
record is removed.

### 22.4 Enforcement

Thirteen rules in a `// === CYCLE 09 RULES ===` block, keyed on atom ids and declared parameters rather
than owner ids, so any owner that adopts the titration atoms inherits them:

| Rule | What it stops |
| --- | --- |
| `cycle09/authored-burette-reading` | a `record` supplying the reading the student is meant to take |
| `cycle09/authored-delivered-volume` | a delivery step carrying the volume it should produce |
| `cycle09/delivery-without-model` | a dispense whose endpoint is not model-derived |
| `cycle09/initial-reading-not-instrument-derived` | a dispense counting from a reading no instrument produced |
| `cycle09/calculation-operand-unnamed` | a titration calculation that does not name its readings |
| `cycle09/calculation-carries-answer` | a calculation carrying a stored `value` |
| `cycle09/authored-ph-reading` | a pH read reporting a pH the runtime does not model |
| `cycle09/shared-endpoint-tag` | replicates sharing one `endpoint` notebook tag |
| `cycle09/dispense-ungated` | a dispense not gated, through its transitive `actionEvidence` closure, on all three of the reducer's conditions: a mounted burette, a charged receiver, and a recorded initial reading |
| `cycle09/dispense-unreachable` | an owner that publishes a dispense but no action that can mount the burette or charge the receiver — the gate is then unsatisfiable, whatever the prerequisites claim |
| `cycle09/burette-read-scale-undeclared` | a burette read that does not say which way its scale runs |
| `cycle09/endpoint-disclosed-in-prose` | learner-facing text spelling out the endpoint |
| `cycle09/receiver-exception-undocumented` | the vessel exception losing its record |

All thirteen were tamper-tested against real content with fifteen mutations — three of them for the
three clauses of `cycle09/dispense-ungated` — and each produced its own rule while the clean run
reports none. Every restore is verified byte-identical against the original: an earlier run left a
mutation behind when a Windows file lock made a restore fail silently, and
`cycle09/calculation-carries-answer` is what caught it.

`scripts/verifyCycle09Titration.mjs` answers the question no static rule can — whether a student can
finish these runs. It re-derives the drop plan, the burette-level history, and every calculation
result independently of `titrationModels.ts` and `calculations.ts`, which it deliberately does not
import, and compares each against the declared `expected` and tolerance. It also walks, per owner,
the same three conditions the reducer walks before a dispense. **283 invariants pass.** It was
tamper-tested and detected each of: prefilled burette, coarse increment breaking the standardization
close, endpoint beyond burette capacity, shared evidence id, unscoped endpoint observation, stale
version pin, lost equipment migration, underfilled burette.

The rule and the verifier check the reachability of a dispense two different ways on purpose. The
rule reads what the content declares; the verifier walks what it publishes. §22.5.1 is why: a check
that only reads declarations cannot see a gate nothing can satisfy.

### 22.5 Self-review corrections to Cycle 09

Reviewing this cycle's own output against §22.1 found six defects. Five are fixed and tamper-tested;
one is recorded.

1. **The cycle made two techniques unfinishable, and nothing caught it.** Adding the clamped-burette
   gate to `executeDropDispense` created an obligation on every owner that reaches the handler.
   `technique:redox-titration` and `technique:titration-curve-analysis` both deliver titrant and
   **neither had a burette-mount action at all** — not before this cycle and not after it. Both
   dispenses would have failed unconditionally with "the burette is not clamped to its support". The
   nine Cycle 09 rules accepted it, `verifyCycle09Titration.mjs` accepted it, `content:check`
   accepted it, and `typecheck` accepted it, because every one of them was checking what the content
   *declares* rather than whether the run can *reach* its own dispense. This is the same shape as
   Cycle 08's finding that `hard-water-analysis` could not be completed (§20).
   *Fixed:* `mount-permanganate-burette` and `mount-curve-burette` added, with nodes, prerequisites,
   and source traces. *Guarded:* `cycle09/dispense-unreachable` fires when an owner publishes a
   dispense but no mount or no charging action, `cycle09/dispense-ungated` now checks all three of
   the reducer's conditions through the transitive `actionEvidence` closure rather than only the
   initial reading, and the verifier gained an owner-by-owner reachability block. The rule and the
   verifier check the same thing two different ways, deliberately: the rule reads declarations, the
   verifier walks published order.
2. **The burette-read scale direction defaulted the dangerous way.** `scaleReadsDownward` defaulted
   to `true`, so any future `readInstrument` measureVolume that forgot to declare it — a graduated
   cylinder, a pipette — would have reported `capacity − contents`, wrong by the full capacity of the
   instrument and wrong in a direction that still looks like a plausible volume. The default is now
   the upward "how much is in it" reading, all four burette reads declare
   `scaleReadsDownward: true` explicitly, and `cycle09/burette-read-scale-undeclared` fails a burette
   read that leaves it unsaid.
3. **A declared flag was decorative.** `record-initial-ph` and `record-equivalence-volume` carry
   `studentValueRequired: true`, but only the `calculate` handler honoured the flag; the `record`
   handler happened to reach the same outcome through a different guard, so the declaration read as
   enforcement while enforcing nothing. `record` now honours it. Corpus-wide scan: those two actions
   are the only `record` steps that declare it, so no other cycle's content changes behaviour.
4. **The cycle introduced an action-id collision.** `mount-redox-burette` was added to
   `technique:redox-titration` while `lab:hydrogen-peroxide-redox-titration` already published a
   different action under that id. meta_plan records 19 such collisions as tolerated legacy debt;
   adding a twentieth is not the same thing. Renamed to `mount-permanganate-burette`.
5. **Two source-stated gates were only enforced by process order.** PB-02 ("all procedures and later
   modifications require teacher review", M) and finding 4 ("all standardization is complete before
   any H2O2 analysis", M) held because the nodes are in that order and because the reducer's
   `hydrogenPeroxidePercent` guard refuses a missing standardization — neither of which is a
   declaration. Both are now `prerequisites` on the seven trials they govern, so they hold on any
   input path, including the gesture bridge.
6. **Recorded, not fixed.** `atom.place.titration-receiver` lists `burette-support` as an optional
   role and `technique:redox-titration/place-redox-flask` binds it. The receiver is not on the
   stand; the binding expresses "the tip this vessel sits under". It reads loosely and a later cycle
   may want a distinct slot for it, but changing an atom's role contract to sharpen wording is not
   worth the churn mid-wave.

The tamper suite covers all thirteen rules with fifteen mutations (three of them for the three clauses
of `cycle09/dispense-ungated`), and each restore is verified byte-identical against the original —
one earlier run left a mutation behind when a Windows file lock made the restore fail silently, and
`cycle09/calculation-carries-answer` is what caught it.

### 22.6 Recorded, not fixed

1. **`technique:titration-endpoint`'s `nonSourceDerivedOwners` entry is now stale.** It reads "AP-fragment
   generator stub", but the technique is now authored against Investigation 14's T-01…T-10 and
   Investigation 4's PR/T rows. It therefore carries no source traces, which is the one place this
   cycle's content is less traceable than the rest. `nonSourceDerivedOwners` is coordinator-owned and
   was not edited. The intended change is stated in the handoff.
2. **`expectedFinalBuretteReadingMl` is now decorative.** `resolveActionTitrationParameters` still
   derives it from an `initialBuretteReadingMl` action parameter that no content may carry any more,
   so it is always just the delivered volume. Nothing reads it. Removing it touches the shared
   injector and was left alone.
3. **Endpoint persistence is configured but not simulated.** Investigation 8 finding 6 says the
   endpoint is a pink that *persists* and explicitly does not state for how long.
   `endpointPersistenceSeconds` is carried as teacher configuration and named in the learner-facing
   text; the runtime has no clock on a dispense, so persistence is not enforced in play.
4. **The pH curve is not modelled.** Nothing in the runtime computes a titration pH, so
   `read-initial-ph` produces an observation and the student supplies the number. Inventing a pH
   model would have invented the chemistry Investigation 14's analysis is about. Consequently the
   pH-volume series in `beverage-ph-volume-titration` and `beverage-acidity` remains evidence work
   rather than instrumented work, and `record-ph-volume-color-series`,
   `condition-fill-and-read-burette`, and `prepare-quantitative-aliquot` still describe physical work
   in prose.
5. **Percent-by-mass tolerance is loose by design.** The trial tolerance is 0.15 percentage points
   and the mean is compared against the label claim, because AN-02 asks the student to compare their
   mean *with* the label. Making the label the tolerance target would make that comparison
   unfalsifiable; `labelClaimPercent` names it for what it is.
6. **The three dispense gates are unconditional.** `dispenseDrops` is used by exactly two labs today,
   both Cycle 09's, so no other cycle's content is affected. A future flow that legitimately
   dispenses from an unclamped device would need the gates parameterised.
7. **Nothing here was executed.** No Vitest, build, browser, E2E, gesture, performance, or mobile
   check was run. `src/runtime/__tests__/cycle09Titration.test.ts` was authored and not run. Because
   two of this cycle's findings were silently-wrong runtime defects that no static check had caught,
   running that file is the highest-value verification still outstanding for Investigations 4, 8,
   and 14.

## 23. Cycle 10 addendum

Cycle 10 remediated Investigation 5, `sticky-question-paper-chromatography_2026-07-27.md`, and
Investigation 9, `quick-ache-relief-component-separation_2026-07-27.md`. Reproduce every number below
with `node scripts/verifyCycle10Separation.mjs`, `npm run content:check`, and `npm run typecheck`.

**Executed as part of Wave A.** Cycles 06, 09, 10, and 11 ran concurrently under
`atomic_remediation_plan/_WAVE_A_CONTRACT.md`, which supersedes the sequential chain for those four.
Cycles 01–05 and 08 were complete; 06, 09, and 11 were in progress in other sessions while this one
ran, so several shared registries moved underneath this cycle and §23.8 separates what Cycle 10
changed from what it merely observed.

### 23.1 What was already there, and what was not

Both investigations already carried a source-faithful **shape**. Investigation 5 had two labelled
solvent trials with their own chambers and strips, a pencil origin, a spotting step, drying steps
before and after development, a prompt front mark, per-band identification, per-band records, an Rf
calculation per trial, a separation comparison, a green-chemistry evaluation, a CER, and
solvent-class disposal. Investigation 9 had the consumer hypotheses, a pure-component property
matrix, a flowchart, a safety audit, a teacher-approval gate, and every execution stage named in
E-01 through E-13. Cycle 10 changed none of that structure.

What was missing is that almost none of it was **enforced**, and one of the two labs could not run at
all.

| Finding | Evidence | Status |
|---|---|---|
| F-CH-01 | `developChromatogram` wrote the solvent-front distance and every band distance into `state.measurements` itself, under exactly the ids the `record-*` steps name and `calculate-*-rf` consumes. **Rf was available the instant the strip developed** — before the front was marked, before the paper dried, and before a ruler existed on the bench. TR-10 through TR-17 were ceremony. | Fixed |
| F-CH-02 | `recordMeasurementsOnDevelop: false` was authored on both development actions and read by nothing. So were `requireDrySpot`, `trackWetState`, `originAboveSolvent`, `chamberSealed`, `baselineHeightMm`, `solventDepthMm`, `requiresDrying`, `sampleProvenance`, `originDistanceMm`, `spotVolumeMl`, `rulerPrecisionMm`, `measurementToleranceMm`, `measurementPoint`, `chromatographyMeasurementType`, `chromatographyBandId`, `chromatographyOperation`, and `requireRecordedMeasurements` — seventeen parameters authored against a contract the runtime never implemented. | Fixed |
| F-CH-03 | `chromatographyRf` fell back to `model.solventFrontMm` and `band.distanceMm` whenever a measurement was absent, so even without F-CH-01 the calculation checked the answer key against itself. | Fixed |
| F-CH-04 | `spotSample` set `wetState: "dry"` at the moment of spotting and asserted `baselineMarked: true` itself. The origin was a notebook sentence, the spot was never wet, and the developed strip inherited the dry state — so "mark the front while the paper is wet, then dry it" had no state to check in either direction. | Fixed |
| F-CH-05 | No runtime path could turn a developed strip into a distance. `record` accepts a value or an existing measurement; nothing produced one. That absence is *why* F-CH-01 existed. | Fixed |
| F-CH-06 | 22 physical actions across the lab and the technique had no atom identity, no role bindings, and no source trace. Every action carried `prerequisites: []`. | Fixed |
| F-CH-07 | `atom.transfer.charge-developing-chamber` required a `measured-solvent-source`, a role that explicitly **prohibits** `distilled-water-bottle` — and both trials poured straight from a stock bottle. Investigation 5 lists no measuring device at all and §3.6 leaves the solvent depth open, so the atom was deciding a configuration point its own constraint says stays open. | Corrected |
| F-QA-01 | `qar-record-starting-mass` had no `expectedMassG` and the unknown sample had no `massG`, so `weigh`'s expected chain reached `0`, `action.value ?? 0` was 0, `isWithinTolerance(0, 0, 0.005)` passed, and **the starting mass recorded 0.000 g**. Every percentage would have divided by it. | Fixed |
| F-QA-02 | `qar-filter-recovered-solid` named a source beaker that nothing ever filled and a funnel that nothing ever assembled. `filter` requires a precipitate in the source, filter paper seated *and* wetted, and a receiver attached. None existed, so the action failed unconditionally: **the lab could not be completed.** | Fixed |
| F-QA-03 | The four composition and recovery calculations carried no `template`, so each fell through to `Number(action.value ?? params.expected ?? 0)`: value 0, expected 0, default tolerance 0.5, `passed: true`. All four reported a composition of nothing and passed. | Fixed |
| F-QA-04 | Twelve of the fourteen execution actions were `recordNotebook` observations. The separatory funnel was never loaded, mixed, settled, or drained; nothing was acidified, precipitated, filtered, dried, cooled, or weighed. The authored `prompt` never reached the notebook either — every entry read "Observation recorded." | Fixed |
| F-QA-05 | `visualStateChoices: ["two-layer-extraction", "emulsion"]` was authored and read by nothing, so reporting an emulsion and reporting a clean separation were the same notebook sentence and both allowed the drain to proceed. | Fixed |
| F-QA-06 | The `precipitate` handler hard-coded "Calcium carbonate" as the substance, the solute id, and the mixture label. Any investigation recovering a solid by precipitation would have had it identified as CaCO3. | Fixed |
| F-QA-07 | Every reagent bottle carried `kind: "liquid"` with no `volumeMl`, so any measured delivery out of one would have failed the source-volume check. | Fixed |
| F-QA-08 | **Found by this cycle's self-review, and not introduced by it.** Every `observe` + `recordNotebook` action in all four `quick-ache-*` techniques carried a `prompt` and no `note`. `ProcessSidebar`'s `canRecordObservation` enables the record control only when `action.parameters.note` is a non-empty string and supplies no note of its own, so **26 observation steps could not be performed through any input path** — a fourth, independent reason the investigation could not be completed. | Fixed |
| F-QA-09 | **Found by this cycle's self-review.** `precipitate` replaced the target's whole solute list with the single precipitated entry. Correct for Investigation 3, which recovers one product; fatal for a multistage separation, because recovering the acidic component wiped the other two components out of the fraction and the next stage then found nothing to recover. | Fixed |

F-QA-01, F-QA-02, F-QA-03, and F-QA-08 together mean the pre-Cycle-10 `quick-ache-relief-separation`
**could not be completed**, and had it been, its central result would have been a composition of
0 % from a starting mass of 0.000 g. F-CH-01 and F-CH-03 mean `paper-chromatography` could be
completed but its Rf values were the model's own numbers echoed back. Neither was visible to any
static check, because in both cases the content had been authored against a parameter contract the
runtime had never implemented — the same class of defect §20.1 records for Investigation 3, and the
same evidence that the implementations here match the authors' intent rather than inventing one:
every operand name the fix consumes was already in the JSON.

### 23.2 Chronology that cannot be bypassed

The chromatography chain is now six state transitions on the strip itself, each gated on the last.

| Step | Source | What changes on the strip | What refuses to run |
|---|---|---|---|
| Draw the pencil origin | TR-03, M | `chromatogram.baselineMarked`, `originDistanceMm` | a second origin on an already-spotted strip |
| Apply the spot | TR-04, M/R | `spotted`, `sampleProvenance`, `wetState: "wet"` | a spot on unmarked paper, or on a developed strip |
| Dry the spot | TR-05, R/C | `wetState: "dry"` | drying a strip that carries no spot |
| Develop | TR-06, M/R | `solventFrontMm`, `bands`, `solventFrontMarked: false`, `wetState: "wet"` | a wet spot; an origin at or below the solvent depth; an unspotted strip; an empty chamber |
| Mark the front | TR-10, M/R | `solventFrontMarked: true` | **a strip that has already dried** — the front is gone and the trial must be repeated |
| Dry the chromatogram | §7 | `wetState: "dry"` | drying before the front is marked |
| Read the ruler | TR-12 / TR-14, M | produces the measurement | an undeveloped strip; an unmarked front; a wet strip; a band the trial did not resolve; a reading that is not what the ruler shows |

`spotSample` and `developChromatogram` are the two verbs Cycle 10 owns exclusively. Every other
handler change is an additive branch keyed on a parameter, so an owner that declares nothing behaves
exactly as it did before — which `keeps the legacy fallback for content that does not ask for
recorded distances` asserts directly in the authored test file.

The 62 lab actions include 17 physical actions, all 17 with an atom identity and its required role
bindings, and 43 actions with runtime `prerequisites`. The technique has 8 physical actions of 21,
all with identity, and 18 with prerequisites. Prerequisites are evaluated centrally in
`performRuntimeAction`, so pointer, keyboard, accessible process controls, and the gesture bridge all
reach the same gates.

### 23.3 Rf now has a denominator the student produced

Reading the ruler and writing the number down are two actions in the source (TR-12/TR-13 and
TR-14/TR-15), and only the read produces evidence. Cycle 10 added one reading step per distance —
seven in the lab, four in the technique — each an `observe` with a `readInstrument` interaction whose
source is the strip and whose target is the metric ruler, plus one `place` step that brings the ruler
to the bench.

The value comes from the strip's own developed state, never from the action's parameters, so no
authored content can pre-supply a distance. The student's reading is quantised to the declared ruler
division and checked against the strip within `measurementToleranceMm`; a reading that is not what
the ruler shows fails. The `record-*` steps are unchanged in kind — `record` already refused to write
a notebook entry for a measurement that does not exist, which is exactly the gate that F-CH-01 had
made unreachable. They keep their measurement descriptors, because those describe the value being
written down, and they now name the reading that produced it through `readActionId`, which the
checker and the verifier both require.

`chromatographyRf` computes from recorded distances only when the action declares
`requireRecordedMeasurements`, and no chromatography calculation carries an `expected` value: Rf is
band distance over front distance, so its expectation is derivable from the same model that places
the bands, and storing one would be an answer key. Both trials' models are unchanged; the water
trial's 59 mm and 66 mm against an 80 mm front still give 0.7375 and 0.825, and the unresolved purple
region is still recorded as one overlap rather than split into assumed components.

### 23.4 Multistage separation with real transfers

Investigation 9's execution phase went from 2 physical actions out of 14 to **37 physical actions out
of 50**, all 37 with an atom identity, its required role bindings, and a source trace. The chain is:

1. read the starting mass off the balance;
2. transfer the whole weighed portion into the labelled beaker;
3. measure the approved solvent volume into the cylinder, then add it to the portion;
4. charge the separatory funnel with the organic phase, then with the approved aqueous phase;
5. mix and vent, then observe the settling;
6. identify each layer from physical evidence;
7. drain the lower layer to one labelled receiver and the retained upper layer to another;
8. acidify the selected fraction and let it give up its solid;
9. add the drying agent to the organic fraction;
10. place the Buchner funnel, tare the paper, seat it, wet it, place the side-arm flask, connect the
    vacuum, inspect the assembly, filter, and wash the collected solid;
11. per fraction: tare a labelled watch glass, recover the solid, wash it, dry it, cool it with the
    tongs, and read the dry mass.

Every transfer names an explicit source instance and target instance, and the verifier checks the six
extraction transfers move between the vessels the plan says they do. Identity is conserved by the
existing `transfer` handler's content merge; the sample's components survive the solvent addition
rather than being replaced, which is why the recovery steps can find them later.

**The issued sample's composition is declared exactly once**, on the unknown's own solutes: 0.450 g
sucrose binder, 2.400 g acetaminophen, and 0.150 g of an unidentified acidic component, summing to
the 3.000 g the source states as the starting amount (E-01, M/R). No action anywhere carries a
component mass. `precipitate` gained `precipitateSoluteSourceId`, which reads the mass from the named
solute already in the fraction — so a recovered mass is the mass that was there, and a fraction that
never held the named component yields nothing. That is how a genuine non-detection stays expressible:
the Team A case, where no aspirin is present, produces no solid and a recorded 0.000 g rather than a
fabricated recovery. `precipitate`'s hard-coded calcium carbonate is now a default, byte-identical
for content that names nothing.

### 23.5 Uncertainty that is preserved rather than resolved

Four things the source leaves open stay open, and are now enforced as open.

**The percent-composition formula.** Finding 3.7 records that the manual's Data Collection sentence
describes total percent recovery while the task asks for per-component composition. Cycle 10 does not
silently correct it: `componentMassPercent` and `totalPercentRecovery` are two separate templates,
each refuses to run until the action states which convention the instructor confirmed, and
`qar-confirm-composition-formula` carries the ambiguity verbatim in a `sourceAmbiguity` parameter.
Neither template accepts a stored `expected`; both derive one from the recorded masses while the
student still submits their own figure, so the derivation is a check rather than the answer.
What closes F-QA-03 is the derivation itself: both templates compute from the recorded starting mass
and the recorded recovered masses, and refuse to run when either is missing, so a missing measurement
fails where it used to produce 0.

**Component identity.** No recovered fraction is named after an expected ingredient. The acidic
fraction is "Recovered acidic component" and its `identityLimit` says that bicarbonate extraction and
re-acidification establish acidity, not identity; the other two are named for the solubility
behaviour that produced them. Both the checker and the verifier fail on a `precipitateSubstance`
containing "aspirin", "acetaminophen", or "sucrose". The label comparison keeps the source's stated
reference (15 % binder, 85 % acetaminophen) and its "reasonably accurate" range (12–18 % and 82–88 %)
as declared parameters, and records that a comparison is between the label's claim and the fractions
actually recovered.

**The emulsion.** Reporting an emulsion no longer passes. The settling node's validation now requires
the clean-separation tag, so an emulsion fails it, a `retry` edge routes to
`qar-recover-from-emulsion`, and an edge returns to the settling observation; the straight-through
`validationPassed` edge skips the recovery step. Layer identity is gated on the clean separation, and
draining is gated on recorded layer identity, so a wrong-layer drain is a relabel-or-recombine
decision rather than a silent success. This is a real process branch, expressible with existing
edge conditions and no runtime change.

**Solvent choice and every teacher configuration.** Investigation 5's five-solvent inquiry is
untouched: the hypothesis, the multi-select, the rationale, the procedure design, the data-table
design, and the approval gate all still precede any trial, and every apparatus action is gated on the
`procedure-approved` notebook entry. Solvent depth, baseline height, drying interval, stop condition,
spotting tool, ruler division, and the disposal streams all carry a `*Provenance` marker naming them
as configured. Investigation 9's nine `teacherConfigKey` declarations are preserved and extended to
the new physical steps.

### 23.6 Registry movement

Twelve atoms were added, each because an operation the two sources state had no existing identity,
and one was corrected. Six extend the chromatography family (3 → 9): placing the chamber, laying out
the strip, loading the spotting tool, removing the developed strip, bringing out the ruler, and
routing solvent waste. Six open a **separation** family: transferring a weighed portion, charging the
extraction funnel, draining a settled phase, decanting a collected fraction, washing a recovered
fraction, and adding a drying agent. The correction is F-CH-07: `atom.transfer.charge-developing-chamber`
now requires a bulk `liquid-source` with `measured-solvent-source` optional, and validates the depth
against the origin height on the strip rather than against a delivered volume.

Six roles were added: `distance-measuring-instrument`, `extraction-funnel`, `extraction-phase-source`,
`phase-receiver`, `weighed-sample-source`, and `drying-agent-source`. Sixteen atoms this cycle reuses
rather than adds — the whole vacuum-filtration, drying, cooling, and gravimetry chain Cycle 08 settled
— gained content examples instead.

62 source traces were added: 17 for the chromatography lab, 8 for the chromatography technique, and
37 for the extraction technique. Every Investigation 9 execution trace cites E-01 through E-13, never
a step the manual does not enumerate, which is the discipline §20.2 records for the hard-water
inquiry. Apparatus citations carry `F` compounded with whatever marker the row holds inline: CHR-00
and CHR-02 are `F`, CHR-03 is `F/R/C` because its asset-disposition cell marks the capillary R/C.

The seven `visual-state/unresolved` entries Cycles 05 and 08 re-owned to Cycle 10 are resolved.
`paper-unspotted`, `paper-spotted`, and `chromatogram-developed` are **`nonvisual`**, and the
provenance says why rather than inventing a style: a strip's appearance is not carried by
`visualState` at all — `contentOverlayByDefinitionId["chromatography-paper"]` draws the origin, the
spot, the front mark, and every band from `contents.chromatogram`, which is the object the two
exclusive handlers build. Registering a second, competing description of the strip would have been
decoration. `two-layer-extraction` and `emulsion` are `liquid-style`: settled-and-clear versus cloudy
is a claim a single-body renderer can make honestly, and the phase boundary itself is not drawn, so
the drainage gate reads the evidence rather than the colour. `heated-residue` and `cooled-residue` are
`solid-style` and deliberately identical, declared through `sharesAppearanceWith`, for the reason
Cycle 05 recorded for `cooled-dry-precipitate`: temperature has no honest visual signature, and the
distinction is carried by `temperatureC` and by what the balance accepts.

### 23.7 What the checker and the verifier now enforce

Eleven rules were added inside the delimited `CYCLE 10 RULES` block, with nine negative self-fixtures
(64 → 73).

Five read `src/runtime/reducer.ts` and are skipped for the fixture worlds, so they were tamper-tested
against the real file instead: `cycle10/develop-writes-measurements-unconditionally`,
`cycle10/rf-falls-back-to-model`, `cycle10/no-ruler-reading-path`, `cycle10/spot-dries-instantly`, and
`cycle10/precipitate-discards-other-components`. Each mutation fired exactly its own rule and the
reducer was restored byte-identically after each.

**A correction found by tamper-testing this cycle's own rules.** The first draft searched the raw
reducer source, and all four survived a tamper test that replaced the actual read with a constant:
the explanatory comment above each read still contained the parameter name, so `includes` kept
returning true. A rule a comment can satisfy is not enforcement. The rules now strip line and block
comments — preserving strings, which is where the parameter names live — and match the read
expression rather than the bare name.

Six are content rules with fixtures: `rf-without-recorded-measurement-gate`,
`rf-carries-authored-distance`, `recorded-distance-has-no-reading`,
`development-chronology-undeclared`, `recovered-mass-is-a-literal`,
`recovered-fraction-named-after-expected-component`, `composition-formula-unconfirmed`,
`composition-carries-answer-key`, and `composition-without-starting-mass`.

`scripts/verifyCycle10Separation.mjs` enforces **685** investigation-specific invariants: the
chronology as a transitive prerequisite graph rather than a node order, trial independence across the
two solvent trials, disposal branching by solvent class after the trial's Rf, one declared sample
composition summing to the declared mass, three complete tare→dry→cool→weigh chains with their
gates, the six extraction transfers between named vessels, the emulsion branch in both the technique
and the lab, the filtration assembly order, the composition templates' confirmed convention, and the
version pins, the handler preconditions below, and that every observation carries a recordable note.
It was tamper-tested with nineteen simultaneous mutations against the real content, which produced
twenty-one failures — one per mutation, plus two for mutations that legitimately break two invariants
each — before all five files were restored from copies taken first and verified byte-identical.

**Two verifier bugs the first run exposed, both fixed.** The reading checks matched the `record`
steps' retained measurement descriptors and demanded a `readInstrument` interaction of them; they now
match only actions that actually read the instrument, and assert instead that a descriptor-carrying
record step names its reading. And the chronology check demanded a *direct* prerequisite edge, which
rejected the correct chain — the front mark requires the removal, which requires the development — so
it now walks the prerequisite graph transitively.

### 23.8 Baseline movement, and what moved from outside this cycle

`npm run content:check` reports **301** violations against the current baseline: **1 new, 0 changed
fingerprint, 178 resolved**. Neither baseline file was written, per the Wave A contract.

Cycle 10's own contribution to the resolved set is **32** entries: 22 `action/atom-identity-missing`
in the chromatography lab and technique, 2 in the extraction technique, 7 `visual-state/unresolved`,
and 1 `corpus/action-id-collision` — `add-solvent`, which the chromatography technique shared with
`technique:making-solution` and which is now `charge-chromatography-chamber`. The other 146 resolved
entries and the 1 new one belong to Cycles 06, 09, and 11, which were writing the same shared files
concurrently; the new entry is `visual-state/registered-but-never-authored:syringe-nail-locked`, and
the contract assigns all syringe states to Cycle 11.

Three baseline entries in Cycle 10's scope are **deliberately not resolved**:

- `source-trace/serialized-in-public-json:lab:green-chemistry-mixture-purification/sourceBasis` —
  finding F-23. `meta_plan.md` assigns F-23's removal to "Cycles 07 and 12", neither of which owns
  `green-chemistry-mixture-purification`. Cycle 10 did not remove it and reports it as unowned debt.
- the two `action/atom-identity-missing` entries under `technique:tablet-separation`, an orphan this
  cycle rules on but does not adopt (§23.10).

`docs/atomic-steps.md` was not written by this cycle. `--write-docs` was run twice as a
write-then-restore measurement. The first produced a byte-identical file — a sibling session had
already regenerated it, and its output already covers Cycle 10's registry appends. The second, after
the self-review, showed a one-line drift, and that line is Cycle 11's `bonding-test-vessel` role.
**Zero drift lines are attributable to Cycle 10**, and the file is left as found for the coordinator to
regenerate once after the wave. `_CYCLE_STATUS.json`, `meta_plan.md`, this audit's main file, both
baselines, and `public/techniques/index.json` were not touched by this cycle;
`public/techniques/index.json` and both green-chemistry and tablet-separation files have no working-
tree diff at all.

### 23.9 What did not change

Byte-identical: `public/labs/green-chemistry-mixture-purification.json`,
`public/techniques/tablet-separation.json`, `public/techniques/index.json`,
`public/techniques/quick-ache-property-evidence.json`, and
`public/techniques/quick-ache-design-approval.json`.

`scripts/generateSimulatorTechniqueDefinitions.mjs` owns three files. It was verified idempotent
before any edit, and `transmittance-dilution.json` and `thermal-decomposition-mass-loss.json` — which
belong to Cycles 06 and 11's scopes — are byte-identical after every run, which is why the version and
timestamp overrides are per-definition rather than shared constants.

In the chromatography lab: `equipment`, `initialState`, `chromatographyModels`, `techniques`,
`assessments`, `learningGoals`, `safetyNotes`, `title`, `description`, and `audience` are unchanged,
and the embedded `chromatography-inquiry-guardrails` technique is preserved intact. The eight new
nodes are inserted into the existing linear chain and the edge list is rebuilt from node order; every
pre-existing action keeps its id, prose, feedback, and invalid cases and only gains fields. Nothing
was removed anywhere: no file, equipment instance, action, node, edge, band, model, asset, or
assessment. The only parameter relocation is that measurement descriptors on the `record` steps are
now also carried by the reading steps that produce the values, and both remain.

The reducer changes are additive for every other owner. `recordMeasurementsOnDevelop`,
`requireDrySpot`, `trackWetState`, `requiresDrying`, `requiresBaselineMarked`, `originDistanceMm`,
`spottedLabel`, `developedLabel`, `solventDepthMm`, `baselineHeightMm`, `chromatographyOperation`,
`chromatographyMeasurementType`, `requireRecordedMeasurements`, `studentResponseRequired`,
`studentValueRequired`, `observedVisualState`, `visualStateTargetInstanceId`,
`precipitateSubstance`, `precipitateSoluteId`, `precipitateMixtureLabel`, and
`precipitateSoluteSourceId` all keep the pre-Cycle-10 behaviour when a caller declares none. A
corpus-wide scan confirms only Investigation 5 and Investigation 9 content declares them, except
`studentResponseRequired` and `studentValueRequired`, which only Investigation 9 has ever declared.
No shared helper in `calculations.ts` was changed; the three new functions are appended after the
chromatography group.

`src/runtime/interactionIntents.ts`, `src/domain/interactions.ts`, `src/domain/validation.ts`, and the
checker's vocabulary mirror blocks are **unchanged**. No verb, interaction type, or operand
requirement was added: the operand work was satisfied by making authored content conform to the
existing tables, which is what meta_plan's rejected interaction-operand finding predicts.

### 23.10 Orphan dispositions

- **`technique:paper-chromatography` (15 actions before, 21 after): kept, and repaired.** It is not
  adoptable and it is not unreferenced. `src/domain-packs/chemistry/capabilityFragment.ts` names it
  as the artifact behind `chemistry.example.paper-chromatography`, so retiring it would break a
  published capability example. Adoption is impossible in a different way: it publishes a
  single-trial, single-instance-set walkthrough, and the lab runs two labelled parallel trials with
  distinct chamber and strip instances per solvent so per-trial provenance survives the comparison.
  No imported action can serve both trials without losing instance identity, and the two share zero
  action ids, so adoption would mean rebinding all 62 lab node `actionId`s to ids that only cover one
  trial. It carries the same defects as the lab and is repaired through its generator.
- **`technique:tablet-separation` (7 actions): recommend retiring the index entry; file preserved.**
  It is registered in `nonSourceDerivedOwners` as an AP-fragment generator stub (§7.1b) and is not
  Investigation 9 content: it tests a powdered tablet with a **magnet**, which no component of
  sucrose, acetaminophen, or aspirin responds to; five of its seven actions have no `interaction` at
  all; its residue mass is the literal `0.82` g and its answer the literal `27.3 %`. It shares zero
  action ids with the four `quick-ache-*` techniques. It is owned by
  `scripts/generateApChemTechniqueFragments.mjs`, the generator meta_plan warns would replace 241
  hand-warmer nodes with 6, so it was not edited and that generator was not run. The intended
  `public/techniques/index.json` change is stated in the handoff and not applied.

### 23.11 Limitations, recorded rather than hidden

1. **The chamber lid is not equipment.** S-07 and CHR-05 require the lid closed during development.
   No lid instance exists, so a student cannot leave it open and `chamberSealed` is an authored
   assertion rather than a checked state. What is enforced is the recovery prose and the geometry and
   dryness gates that share the same step. Modelling the lid means a new equipment definition, a snap
   zone, and an asset; deferred, unowned.
2. **Venting has no verb.** E-04's inversion and pressure release are `R/C` and no verb in
   `actionVerbs` models them, the same situation §20.4 records for Investigation 3's breakup step. Its
   consequence is enforced instead: settling cannot be observed without the venting evidence, and
   draining cannot happen without the settling evidence.
3. **Solvent removal is expressed as the component leaving solution.** No verb removes a solvent, so
   the two fractions whose component is dissolved rather than suspended are recovered with
   `precipitate` plus a named solute. The mass is right and traces to the declared composition, but
   the operation is a modelling compromise and the action labels say "remove the solvent so the
   component separates as a solid" rather than pretending otherwise.
4. **The model conserves mass exactly, so total recovery is 100.00 %.** Real recovery has losses;
   inventing a loss fraction would invent a number the source does not state. A-02 is still a real
   calculation from recorded masses, and `qar-analyze-uncertainty` is where the losses a bench run
   would show are discussed. This is the same boundary §20.10 item 3 draws for the quantitative-
   transfer rinse.
5. **The component masses are read directly, not derived by difference from the tares.** `weigh` on a
   dried assembly reports the precipitate mass, so the two tares each fraction requires are recorded
   evidence for the report rather than operands of a subtraction. Investigation 3 derives its mass by
   difference because it weighs a combined assembly; this content does not, and adding a combined-mass
   read would have meant authoring a second literal.
6. **The chromatogram overlay's four hex colours are outside every palette guard.** Cycle 05's
   `openRisk` records that `mirror/palette-literal-colour` only detects `rgba(` literals. Cycle 10
   confirms the four are still there and did not move them: doing so needs a new registry field and a
   resolver on a schema Cycle 05 owns and Cycle 13 inherits. Unowned; recommended for Cycle 13
   alongside `resolveWorkbenchScene`'s hard-coded participant pairs.
7. **The property-evidence technique stays semantic, deliberately.** P-02's amounts are `R/C` and
   confirmation point 3 leaves them to the teacher, and the property tests are not in this cycle's
   task list. It gained the `note` values F-QA-08 required and a version bump, but no physical action.
8. **`studentResponseRequired` and `studentValueRequired` are declarations no input path can satisfy.**
   `ProcessSidebar` reads `action.parameters.note` and passes none of its own, and
   `StudentPlayer.submitCalculation` sends `{type: "calculationSubmitIntent"}` with no value. Enforcing
   either as a hard gate would make every step that declares it unreachable, so neither is enforced: a
   supplied note or value still wins where one exists, and the composition figures derive from recorded
   masses instead. Making them load-bearing needs a free-text and a numeric capture control in the
   player. Deferred, unowned. This cycle's first pass *did* enforce both and would have replaced
   "passes with 0" with "cannot run at all" — see §23.13.
9. **A fraction's solute list is not evidence of what partitioned into it.** `transfer` clones the
   source's solutes rather than partitioning them across phases, so after the drains both fractions
   carry all three components. Each recovery step names a different one and consumes only that, so
   every recovered mass is correct and distinct; what the state does not model is a partition
   coefficient, and inventing one would invent chemistry the source does not state. The verifier checks
   that the three recoveries name three different declared components and cover all of them, which is
   the property that makes the design sound without the partition model.

### 23.12 Validation run by Cycle 10

Run: `node --check` on all three changed `.mjs` scripts; `npm run content:check` (73/73
self-fixtures, 301 violations, 1 new — Cycle 11's — 0 changed fingerprints, 178 resolved,
documentation up to date); `npm run typecheck`; `node scripts/verifyCycle10Separation.mjs` (685/685),
tamper-tested with nineteen simultaneous content mutations producing twenty-one failures with every
file restored byte-identically; five reducer-reading checker rules tamper-tested individually against
the real `src/runtime/reducer.ts`, restored byte-identically after each;
`node scripts/generateSimulatorTechniqueDefinitions.mjs` (idempotent before the edit, and its two
out-of-scope outputs byte-identical after); `git diff --check` clean over the cycle's paths; and two
write-then-restore measurements of `docs/atomic-steps.md`, the second attributing its single drift line
to Cycle 11 rather than to this cycle.

**Intentionally not run**, under the `AGENTS.md` validation policy: Vitest in any form, builds,
Playwright, browser/E2E, camera and gesture checks, performance tests, and mobile QA. One test file
was authored and not executed — `src/runtime/__tests__/cycle10Separation.test.ts`, 43 cases across
the pure calculations, the chromatography chronology, the ruler reading, the Rf gate, the recovered
mass, and the composition templates, including one case that asserts the pre-Cycle-10 fallback still
holds for content that declares nothing.

**Consequently the entire chronology, ruler-reading, extraction, recovery, drying, and composition
chain this cycle built is unexecuted.** The static evidence establishes that the content declares the
right operands, that the handlers read them, that the types agree, and that 580 investigation-specific
invariants hold; it does not establish that a student can now finish either lab. Given that F-QA-01,
F-QA-02, F-QA-03, F-QA-08, and F-QA-09 were each a completion-blocking or silently-wrong defect that
no static check had caught — and that three of them were found only by reviewing this cycle's own work — exactly as §20.11 says of Investigation 3 — a single Vitest run of the authored
file is the highest-value verification still outstanding for these two investigations.

No PNG or SVG was created or changed, so the asset-inspection step had nothing to inspect. Two
appearance decisions were made: `two-layer-extraction` and `emulsion` are new `liquid-style` values,
and `heated-residue`/`cooled-residue` are a new `solid-style` pair. None reuses another entry's
values, so no existing appearance changed, and none was verified visually.

### 23.13 Cycle 10 self-review, and the five defects it found

Reviewing this cycle's own code against §23's claims found five defects. Four are fixed; the fifth is
a rule-precision correction to the review's own tooling.

1. **Both new enforcement gates were completion-blocking.** `studentResponseRequired` was enforced in
   the `observe` handler and `studentValueRequired` in the `calculate` handler, on the reasoning that
   an authored declaration nothing reads is decoration. Neither is satisfiable: reading
   `src/player/ProcessSidebar.tsx` and `src/player/StudentPlayer.tsx` shows the player passes no note
   and no calculation value. Enforcing them would have made all 26 Quick Ache observations and all
   four composition calculations unreachable — replacing "silently passes with 0" with "cannot run at
   all", which is a worse defect than the one being fixed. Both gates are removed; the composition
   templates derive from recorded masses instead, which is the gate §20.5 established, and §23.11
   item 8 records what a player control would need to add.
2. **F-QA-08, found while checking the above.** The same read of `ProcessSidebar` showed
   `canRecordObservation` requires `action.parameters.note` to be a non-empty string. All 26
   `observe` + `recordNotebook` actions across the four `quick-ache-*` techniques carried only a
   `prompt`, so none of them could be performed at all. This predates Cycle 10 and had not been found
   by any cycle. Each now carries a `note` — the evidence line, distinct from the prompt that asks for
   it — which is why `quick-ache-property-evidence` and `quick-ache-design-approval` moved to 1.1.0
   after all, and why all four lab pins moved rather than two.
3. **F-QA-09: the aqueous recovery chain could not complete.** Hand-tracing the handlers had
   established that all three recovery chains ran. It was wrong. `precipitate` replaced the target's
   whole solute list, so recovering the acidic component erased sucrose and acetaminophen from the
   fraction; `filter` then carried an empty solute list into the receiver, and
   `qar-recover-aqueous-component` found nothing, failed, and left `qar-record-dry-component-masses`
   permanently ungated. The handler now consumes only the solute the content names — which is also
   what physically happens — and the reducer-reading rule
   `cycle10/precipitate-discards-other-components` fails if that is reverted.
4. **The recording step was satisfiable without recording.** Every `record-*` node validated
   `measurementRecorded` on the id the new reading step produces, so the reading satisfied the
   recording and TR-13/TR-15 became a no-op gate — the develop-time write's weakness moved one step
   later rather than removed. Recording nodes now validate `actionEvidence` on their own action, in
   both the lab and the generator, and the verifier checks it.
5. **Three authored volumes did not follow the vessel ledger**, and the ruler tolerance defaulted to a
   full division. The acidified fraction holds 25 mL, not the 45 authored on its `finalVolumeMl`, and
   the decant and the aqueous recovery inherited the same error; a `finalVolumeMl` above what the
   vessel holds invents liquid, which is the same class of fabrication as a literal mass. The
   verifier now derives the expected volume from the drain and acid volumes rather than asserting a
   literal. Separately, `measurementToleranceMm` defaulted to one full division, and
   `isWithinTolerance` is inclusive, so an undeclared tolerance would have accepted a reading a whole
   millimetre off; the default is now half a division.

**A correction to the review's own tooling.** `cycle10/precipitate-discards-other-components` first
searched the handler for the identifier `remainingSolutes` and **did not fire** when the tamper removed
the spread but left the declaration standing. That is the same failure mode as the comment bug in
§23.7 — matching a name rather than a behaviour — and the rule now matches `...remainingSolutes`. Both
were caught only because the tamper test was run against the real file rather than assumed to work.

The self-review re-ran every check: `npm run content:check` (73/73 fixtures, 301 violations, 1 new,
178 resolved), `npm run typecheck`, `node scripts/verifyCycle10Separation.mjs` (580 → **685** checks,
all passing), the nineteen-mutation content tamper test, and five individual reducer tamper tests. It
ran no Vitest, build, browser, E2E, gesture, performance, or mobile check either, so everything §23.12
records as unexecuted remains unexecuted.

## 24. Cycle 11 addendum

Cycle 11 remediated Investigation 10, `how-long-will-that-marble-statue-last_2026-07-27.md`
(`marble-statue-kinetics` and `marble-gas-syringe-kinetics`), and Investigation 6,
`bonding-in-unknown-solids_2026-07-27.md` (`bonding-unknown-solids`). It also took ownership of the
whole `syringe-*` visual-state family, which the Wave A contract moved from Cycle 12 to this cycle so
that one session names the family and a second extends it.

Reproduce every number below with `npm run content:check --` against
`scripts/content-consistency-lint-baseline.json` as it stood at 478 entries, and with
`node scripts/checkContentConsistency.mjs --json`.

**Executed as one of four concurrent Wave A sessions.** `atomic_remediation_plan/_WAVE_A_CONTRACT.md`
supersedes the strict `01 -> … -> 13` chain for Cycles 06, 09, 10 and 11. `_CYCLE_STATUS.json` still
records Cycles 09, 10 and 11 as `pending` and Cycle 06 as `ready`; the contract, not the ledger, is
the authorization, and the coordinator owns reconciling the two. Cycles 06, 09 and 10 were writing to
the same shared registries while this cycle ran, which §24.8 quantifies rather than assumes.

### 24.1 What was already there, and what was not

Investigation 10's lab was a well-developed guided route: nine kinetics conditions across three
independent variables, an inquiry-design phase with two teacher gates, a revision requirement, a
provenance audit, and a transfer task that already refused to overstate a real monument lifetime.
Investigation 6's lab was equally careful in prose: every record action already said what not to
invent, kept "not selected" available, named the instrument, and preserved blind identities.

What was missing in both was that the apparatus did nothing, and in Investigation 10 that the
apparatus order was physically impossible.

| Finding | Evidence | Status |
|---|---|---|
| F-K-01 | The marble lab sealed the reaction flask (`assemble-gas-apparatus`) **before** measuring the acid, transferring it, or weighing the CaCO3. Phase B runs T-03 measure, T-05 transfer, T-07 weigh, T-11 add solid, T-12 seal. Acid was therefore poured into a stoppered flask and the marble was weighed against a closed vessel. | Fixed |
| F-K-02 | **No action ever moved the marble.** `record-synchronized-reaction-start` was an `observe` whose own note admitted it "does not claim a physical transfer occurred", so the reaction had no physical start and the flask never contained CaCO3. | Fixed |
| F-K-03 | The gas syringe was never zeroed as a separate read. T-10 zeroes the device before T-11 initiates the reaction, and the `gas-collection-instrument` role has carried `mustBeZeroedBeforeCollection: true` since Cycle 02 with nothing to satisfy it. | Fixed |
| F-K-04 | The leak check (`verify-safe-gas-path`) carried **no interaction at all** and ran after the flask was already sealed, so S-06's "inspect … before reaction" was prose. | Fixed |
| F-K-05 | `atom.place.gas-collection-apparatus` required `reaction-vessel`, `gas-delivery-connector` and `gas-collection-instrument`, and named both `assemble-gas-apparatus` and `connect-gas-syringe` as content examples. Neither action can bind all three: one has no syringe operand and the other no flask operand. The atom conflated assembling the train with sealing the vessel. | Corrected |
| F-K-06 | The four `record-*-run` actions carried verb `record` with **no interaction**, although `atom.record.timed-gas-volume` permits `recordTimeSeries` only, so the atom had no conformant consumer anywhere. | Fixed |
| F-K-07 | Three rate calculations carried a literal `expected` (1.7, 2.62, 3.253) and the technique carried a fourth (2.62). Each is an exact copy of what the deterministic model produces, so the "calculation" compared the model against itself, and a teacher changing `rateFactor` or `timepointsS` would have broken the gate silently. | Fixed |
| F-K-08 | `create-kinetics-graph` stated the answer ("the steepest early curve belongs to 6.0 M HCl"), `write-cer-conclusion` stated the three rate values the student is asked to produce, and four node hints told the student what to conclude. §10 requires the simulator to compile approved choices "while keeping outcomes hidden". | Fixed |
| F-B-01 | `bonding-unknown-solids` drove **35 realistic equipment instances with zero physical verbs**: all 42 actions were `observe` with `recordNotebook`. §8.2 recorded this as the corpus's largest interaction gap. | Fixed |
| F-B-02 | Every one of those 42 actions carried `prerequisites: []`, so the approved order — including "identity must not be revealed before classification" (finding 7) — lived only in process edges and was reachable out of order through any direct input path. | Fixed |
| F-B-03 | Neither waste beaker was ever used, so S-05's labelled-container rule and K-06's approved-stream branch were prose, and the two streams were indistinguishable. | Fixed |
| F-S-01 | All six `syringe-*` states were `unresolved` with six matching realistic assets classified as `remediation-candidate` and reachable by no code path (§9.2, §10.3). | Fixed |
| F-S-02 | `assetDispositionRegistry.json` claimed `matchingVisualState: "syringe-nail-locked"` for `luer-lock-syringe-nail-locked`, and **no such state was registered anywhere**. The registry named a state that did not exist. | Corrected |
| F-S-03 | `parseStateAssets` in the content checker recognised only the generated `handWarmerCalorimeterStateAssets` pattern, so a hand-written `stateAssets` map on any other profile was invisible to `visual-state/state-asset-missing`. Its sibling loop in `buildReachability` also derived a `hand-warmer-calorimeter-<state>` asset name for every entry in the map, which would have fabricated names once a second profile used the field. | Fixed |

### 24.2 The corrected chronology, and the artifact that corroborates it

The order below is the only one that satisfies T-11 before T-12 (solid in, then seal), S-06 before
T-11 (inspect the collection device before reaction), and physical reality (a stoppered flask cannot
be charged, and a solid cannot pass through a seated delivery stopper).

| # | Action | Source row | Basis |
|---|---|---|---|
| 1 | `connect-gas-syringe` — build the train off the flask | GAS-02 | F |
| 2 | `zero-gas-syringe` — read and record the baseline | T-10 | R |
| 3 | `verify-safe-gas-path` — leak-check the connected train | GAS-04 / S-06 | F |
| 4 | `measure-practice-acid` | T-03 | M/C |
| 5 | `transfer-practice-acid` — charge the open flask | T-05 | M |
| 6 | `weigh-practice-marble` | T-07 | M |
| 7 | `transfer-practice-marble` — reaction start | T-11 | M/R |
| 8 | `assemble-gas-apparatus` — seal the charged flask | T-12 / T-02 | M |
| 9 | `record-synchronized-reaction-start` — time zero | T-13 | R/C |
| 10 | `record-practice-run` | T-15 | M |

This was not derived from the plan alone. `technique:marble-gas-syringe-kinetics` — one of the three
orphans this cycle had to rule on — **already ran acid and marble before the stopper** in its own
process (`measure-acid -> transfer-acid -> weigh-marble -> seat-stopper -> connect-syringe ->
check-path -> synchronize-start`). Two independently authored artifacts disagreeing about the same
apparatus is what made the lab's order a defect rather than a reading. The technique had the same two
holes as the lab, though: no zeroing read and no marble transfer, and its leak check sat after the
seal. Both are now fixed in both owners, and the technique's version moved 1.0.0 to 1.1.0.

`atom.place.gas-collection-apparatus` now describes the seal only, and a new
`atom.place.gas-delivery-train` describes the train. That split is why F-K-05's impossible role
binding disappears rather than being waived.

### 24.3 Investigation 6: what became physical, and what deliberately did not

24 new actions — 12 per phase, applied identically to the knowns and the blind unknowns because §9
repeats the panel across one set and then independently across the other. Three test lines, each with
its own vessel and its own fresh microsample:

| Line | Vessel (known / unknown) | Actions | Source rows |
|---|---|---|---|
| Aqueous | `test-tube-1` / `test-tube-4` | dispense microsample, add distilled water, read conductivity, read pH paper, dispose to the aqueous stream | K-02, K-03, K-04 ×2, K-06 |
| Organic | `test-tube-2` / `test-tube-5` | dispense microsample, add ethanol, dispose to the organic stream | K-02, K-03, K-06 |
| Dry | `test-tube-3` / `test-tube-6` | dispense microsample, stage at the melting-point apparatus, read melting behaviour, test magnetic response | K-02, K-03, K-04 ×2 |

**The 42 existing record actions were not converted.** They are K-05 ("record result before
cleanup"), and K-04 and K-05 are separate source rows; the observation, the category, the
classification and the confidence argument all stay with them, unchanged in wording. What changed
about them is that all 41 downstream actions gained an `actionEvidence` prerequisite naming their
predecessor, so the approved order is enforced on the central path that pointer, keyboard, accessible
process controls and the gesture bridge all reach — not only in the edges. `inv6-release-identities`
additionally requires `inv6-classify-unknowns`, and `inv6-match-identities` requires the release, so
no input path reaches the instructor identity list before the blind claims are on record (finding 7).

**The instrument reads produce nothing.** `observe` + `readInstrument` in `src/runtime/reducer.ts`
verifies that the named sample and the named instrument are both on the bench and then records the
student's own note. It invents no conductivity value, no pH and no melting temperature. That is
exactly what Investigation 6 needs: apparatus that must be correctly set up for the read to be
accepted, and a result that stays the student's. Equipment presence discloses nothing, because every
sample is staged through the same three lines whatever it turns out to be.

Four source-supported tests stay semantic, each for a stated reason rather than for convenience:

- **Solid conductivity.** Finding 4 restricts the tester to metals and aqueous solutions and finding 3
  warns against arbitrary dry nonmetal testing. Wiring a solid-phase read would either imply that
  every unknown may be tested dry, or gate it on metallic appearance and thereby leak the category.
- **Hexanes solubility.** Finding 5 keeps hexanes and iodine in the hood under teacher control, and
  §12 lists the hood station as a new asset that does not exist. An unhooded pour would contradict
  S-04.
- **0.1 M HCl and 0.1 M NaOH reaction.** The transfers are expressible, but their *evidence* is gas
  evolution or dissolution that no runtime model produces, and the lab has no labelled container for
  the resulting stream distinct from the aqueous one. Wiring the pour without either would be a
  decorative interaction, which the cycle's acceptance criteria forbid.
- **Colour and appearance.** Purely observational; there is nothing to manipulate.

Nine equipment instances therefore remain unused: `sample-rack`, `beaker-250ml`, `reagent-bottle-hcl`,
`naoh-bottle-1`, `reagent-bottle-hexanes`, `thermometer-1`, `stirring-rod-1`, `spatula-1` (declared as
an optional role binding but never the interaction source), and `watch-glass-1`. That is a smaller
inventory gap than the 35 the cycle started with, and it is recorded rather than closed by inventing
operations.

### 24.4 The syringe state family

Cycle 11 owns all `syringe-*` states so that Cycle 12 extends the family rather than renaming it. The
family fixes three independent axes, documented on every entry and in
`src/equipment/visualCatalog.ts`: `barrelContents` (empty | filled | gas), `plunger` (home | extended
| nail-locked), and `closure` (open | valve-closed). The names are body-agnostic on purpose.

| State | Axis values | Asset | Authored today |
|---|---|---|---|
| `syringe-empty` | empty, home, open | `luer-lock-syringe-empty` | yes |
| `syringe-filled` | filled, home, open | `luer-lock-syringe-filled` | yes |
| `syringe-extended` | gas, extended, open | `luer-lock-syringe-extended` | yes |
| `syringe-gas-expelled` | empty, home, open, reached by expelling | `luer-lock-syringe-gas-expelled` | yes |
| `syringe-inverted` | filled, home, open, inverted | `luer-lock-syringe-inverted` | yes |
| `syringe-valve-closed` | gas, extended, valve-closed | `luer-lock-syringe-valve-closed` | yes |
| `syringe-nail-locked` | gas, nail-locked, open | `luer-lock-syringe-nail-locked` | **no** |

All seven are now `state-asset` entries bound to `luer-lock-syringe`, whose visual profile gained the
matching `stateAssets` map. Six went from `unresolved`, and `syringe-nail-locked` is new — it existed
only as a dangling `matchingVisualState` claim in the asset registry (F-S-02). It is registered,
reachable and deliberately unauthored, so it reports one `visual-state/registered-but-never-authored`
entry with owner Cycle 12; the locking nail seats in `luer-lock-syringe-plunger-hole`, so the state is
procedurally real and Cycle 12 has only to author it on its locking step. All six
`remediation-candidate` assets became `state-active`, which empties that disposition.

**The Investigation 10 gas syringe deliberately gets no visual state.** It is a different body with no
state art, and `meta_plan.md`'s registry rule is explicit: appearance alone must not imply a
quantitative value. A rendered plunger position for a CO2 volume the student is supposed to read off
the barrel would do exactly that. Its procedural state is carried where it can be checked instead: the
attachment to the delivery tube, the recorded baseline, and the recorded series. The brief's
"connected, zeroed … gas-collected" states are therefore not registered, under its own "only where
physically and procedurally correct" qualifier, and no PNG or SVG was created.

**No duplicate child rendering.** The train is flask (`inserted`) ← stopper (`mounted`) ← syringe.
Both relations resolve to a non-`independent` `renderMode` through `AttachmentRelation`, so each child
stops drawing itself; no composite registry entry is required and none was added.

### 24.5 Registries and traces

- **Atoms 43 → 55 for this cycle's part of the total.** Four kinetics atoms —
  `atom.place.gas-delivery-train`, `atom.observe.zero-gas-collection-instrument`,
  `atom.weigh.solid-reactant-portion`, `atom.transfer.initiate-solid-reactant-contact` — and a new
  `qualitative-analysis` family of eight for Investigation 6. A new family rather than an existing one
  because no Wave A sibling owns it, so the append cannot collide.
  `atom.weigh.solid-reactant-portion` permits `readInstrument` only, which writes Cycle 08's settled
  weighing contract into the atom rather than restating it in prose.
- **Roles 46 → 52 for this cycle's part.** `reactant-solid-source`, `bonding-test-vessel`,
  `bonding-test-solvent-source`, `melting-point-instrument`, `ph-indicator-medium`,
  `magnetic-response-tool`. `bonding-test-vessel` exists rather than reusing `reaction-vessel` for the
  same reason Cycle 08 created `precipitation-vessel`: the latter carries Investigation 10's
  `mustBeSealedForGasCollection` constraint, which misdescribes an open test tube.
- **39 source traces added and one corrected.** 11 on the marble lab, 8 on the marble technique, 24 on
  the bonding lab. The correction: `connect-gas-syringe` cited `atom.place.gas-collection-apparatus`
  at phase row T-02; it now cites `atom.place.gas-delivery-train` at apparatus row GAS-02, basis `F`,
  because an apparatus row has no Basis column. Every row cited twice agrees on table kind and basis,
  which the existing citation rule enforces.
- **Two additive catalog affordances.** `marble-chips` gained `pourable`, because the reducer's
  solid-transfer branch rejects a source without it and T-11 tips the chips into the acid; `test-tube`
  gained `solid` in `allowedContents`, because K-02 puts a dry microsample in before K-03 adds any
  solvent. No existing content used marble chips as a transfer source or a test tube as a solid
  container, so neither addition changes existing behaviour.

### 24.6 Sixteen new rules, all tamper-tested

`checkCycle11Protocols` lives in the delimited `CYCLE 11 RULES` block and is registered as one entry
in `RULES`. Every rule is keyed on **atom ids, not owner ids**, so it holds for any owner that adopts
these atoms rather than only for the two labs this cycle touched.

| Rule | What it refuses |
|---|---|
| `cycle11/gas-seal-without-reactant-contact` | a seal that does not require the contact evidence — F-K-01 exactly |
| `cycle11/gas-collection-instrument-never-zeroed` | an owner that seals a collection path but publishes no zeroing action |
| `cycle11/kinetics-chronology-out-of-order` | train → zero → contact → seal → series appearing in any other order in the process walk |
| `cycle11/reactant-preparation-after-contact` | measuring, transferring or weighing that is not complete before the reaction starts |
| `cycle11/reactant-contact-without-path-check` | contact that is not gated on the leak-and-baseline notebook entry (S-06) |
| `cycle11/weigh-not-instrument-read` | a reactant weigh using anything but `readInstrument` |
| `cycle11/timed-series-not-time-series-interaction` | a timed-series action without `recordTimeSeries` |
| `cycle11/timed-series-provenance-undeclared` | a generated series that does not say it is generated |
| `cycle11/rate-calculation-stores-answer` | a literal `expected` on an `initialRateMlPerS` calculation |
| `cycle11/aqueous-read-without-test-solution` | a conductivity or pH read not gated on the solvent application (§9's branch) |
| `cycle11/disposal-without-recorded-result` | cleanup that does not require the record (K-05 before K-06) |
| `cycle11/disposal-precedes-record` | a prerequisite record that the walk reaches only after the disposal |
| `cycle11/test-vessel-shared-between-samples` | two microsample transfers naming one vessel |
| `cycle11/sample-instance-unnamed` | a qualitative-analysis action that leaves the runtime to take the first matching instance |
| `cycle11/syringe-state-unresolved` | any `syringe-*` state left unresolved |
| `cycle11/syringe-state-asset-unbound` | a `state-asset` syringe state naming no equipment |

**All sixteen were tamper-tested against the real content**, each by a mutation that reproduces the
defect the rule describes — including replaying F-K-01 and F-K-07 verbatim, and moving the seal node
back to where the pre-cycle lab had it. All sixteen fired; every file was restored byte-identically
from a copy taken first, and the repository reports zero `cycle11/*` violations before and after.
`cycle11/rate-calculation-stores-answer` earned its place during authoring: it caught the marble
*technique*'s stored `expected: 2.62`, which the manual review of the lab had missed.

**No self-fixtures were added, and this is a gap.** Repository convention is that every new rule
category also has a negative fixture, but the fixture list and the fixture world builder are outside
the delimited block the Wave A contract confines this cycle to. The tamper tests are stronger evidence
per rule — they run against real content rather than a synthetic world — but they are not run by
`npm run content:check`, so they do not protect the rules from a later refactor. Recorded for the
serialized post-Wave-A pass.

### 24.7 Two checker changes outside the delimited block

Both were required to make a registry claim checkable at all, and both are additive.

1. **`parseStateAssets`** now also scans an inline `stateAssets: { … }` object literal and the
   definition id of the `profile(` call that owns it. Without it, wiring the syringe states would have
   produced six `visual-state/state-asset-missing` violations describing work that had in fact been
   done. The generated calorimeter branch is untouched, and no profile other than the calorimeter's
   used the field before, so no existing result can change.
2. **`buildReachability`** gained `parseInlineStateAssetNames()` for the same reason — asset
   reachability is derived from filenames carrying an extension, and `asset("luer-lock-syringe-…")`
   carries none — and its calorimeter loop is now guarded to `CAL-NN` state ids. Before this cycle
   every entry in the map was a `CAL-NN`, so the guard changes nothing for the calorimeter; without it
   the loop invents a `hand-warmer-calorimeter-syringe-empty` asset name for every syringe state.

The Wave A contract confines rule additions to the delimited block and says nothing about the world
builder. This is recorded as a deviation rather than presented as compliant.

### 24.8 Baseline movement, itemized against a moving corpus

Three sibling Wave A sessions were writing to the same registries throughout. Both baseline files were
byte-identical at the start and the end of this session (verified by comparison against a copy taken
before the first edit), so the comparison point is sound, but the *totals* the checker prints are not
attributable to any one cycle. The registries went 43 → 81 atoms and 46 → 60 roles during the session;
12 atoms and 6 roles of that are Cycle 11's.

Filtered to Cycle 11's owners, states and assets:

| Rule | Δ | Detail |
|---|---|---|
| `action/atom-identity-missing` | −10 | the five pre-existing physical actions in each marble owner. Not duplicate rows disappearing: each now carries an identity, its role bindings and a source trace |
| `visual-state/unresolved` | −6 | the six authored `syringe-*` states |
| `asset/remediation-candidate` | −6 | the six wired Luer-lock assets; the disposition is now empty |
| `visual-state/registered-but-never-authored` | +1 | `syringe-nail-locked` (§24.4), owner Cycle 12 |

**22 resolved, 1 added.** The bonding lab contributes no `action/atom-identity-missing` resolution
because all 42 of its pre-existing actions are `observe`, which needs no atom identity; its 24 new
physical actions were born with identities, role bindings and traces, so they never entered the
baseline. `cycle11/*` reports 0 against the remediated content. Neither baseline file was rewritten.

### 24.9 Orphan dispositions

| Orphan | Actions | Ruling |
|---|---|---|
| `marble-gas-syringe-kinetics` | 10 → 12 | **kept orphaned, remediated in place** |
| `bonding-solids-tests` | 8 | **kept orphaned, untouched** |
| `thermal-decomposition-mass-loss` | 19 | **deferred to Cycle 13, untouched** |

`marble-gas-syringe-kinetics` is not retired, because §5 of Investigation 10 marks four of its
constituent techniques reusable and it is the artifact that corroborates the corrected chronology
(§24.2). It is not adopted either: its actions bind `kineticsModelId: "marble-gas-syringe-model"`,
which the lab does not own, so an action-only import would fail hydration unless the lab also carried
a second kinetics model beside the nine-condition one it already publishes — a model duplication, not
a de-duplication. Its 10 action ids share zero ids with the lab, so adoption would cost a full
rebinding for no shared identity. It was remediated in place instead, so the repository no longer holds
an artifact teaching the wrong order.

`bonding-solids-tests` is **generator-owned**: `scripts/generateApChemTechniqueFragments.mjs:604`
emits it, and `scripts/generateHandWarmerCalorimetry.mjs:976` lists it. Hand-editing it would recreate
the dual-ownership hazard §7.2 records as unresolved and Cycle 04 declined to resolve. It stays
untouched and orphaned. §5 of Investigation 6 does mark its solubility, conductivity and pH screens
reusable, so Cycle 13 may republish it as a source-derived technique through its generator.

`thermal-decomposition-mass-loss` is **not** Investigation 10's content, checked as the brief
required. Its title is "Heat and Reweigh a Carbonate Mixture", it heats a carbonate mixture to
constant mass over a Bunsen burner, and its live runtime support
(`calculateCarbonateMassLossComposition`) computes a **sodium bicarbonate / sodium carbonate** mass
percent from thermal mass loss. Investigation 10 is CaCO3 + HCl gas-collection kinetics; its only
mention of mass loss is a balance during optional exploratory observations, not a decomposition. No
dated plan filename matches, and `scripts/generateSimulatorTechniqueDefinitions.mjs:700` owns the
file, which makes it a generator-owned simulator demo. **Deferred to Cycle 13. Not deleted.**

### 24.10 Limitations, recorded rather than hidden

1. **The guided route stages one sample per test line, not four to six.** §9 repeats the panel across
   every assigned known and then every unknown, and the runtime has no loop construct. Each new action
   says so in its own note, and the existing evidence-matrix actions remain the coverage gate. Testing
   K1 and U1 does not complete the matrix and the content does not claim it does.
2. **Staging at the melting-point apparatus is a workbench move.** `stationToLocation` maps only
   `heating`, `oven`, `drying-oven` and `placeInInstrument` to the `oven` location, so a
   `melting-point-apparatus` station resolves to `workbench`. The staging is real as recorded action
   evidence and the subsequent read still requires both the tube and the apparatus to be present, but
   the runtime does not model "inside the apparatus". Confirmation point 3 leaves the method and
   temperature limits open anyway, so no heating model may run.
3. **No solid-waste stream.** S-05 routes solids as well as liquids to labelled containers, and the
   lab has an aqueous and an organic beaker but none for a dry unreacted solid. The dry test line
   therefore has no disposal action. Inventing a destination would invent a waste rule.
4. **The rate calculations now always pass once their evidence exists.** Removing the stored `expected`
   means the reducer takes `expected = value`, so `calculationWithinTolerance` gates on operand
   completeness — the pattern §20.5 established for derivations. Behaviourally nothing is lost, because
   the model is deterministic and always matched, but the check is now about evidence rather than
   agreement, and that is a weaker claim than the numbers implied.
5. **The syringe baseline is a notebook entry, not a measurement.** `observe` records no measurement,
   so the recorded zero cannot be consumed as a numeric operand by a later calculation. Making it one
   would need either a `measureVolume` that pours, or a new evidence kind in the reducer — a shared
   runtime change this cycle is not authorized to make.
6. **`docs/atomic-steps.md` is stale.** It is generated from the atom registry and is
   coordinator-owned, so this cycle did not regenerate it. `npm run content:docs` after Wave A merges
   is the fix; until then `npm run content:check` reports `STALE` for every session.

### 24.11 Validation run by Cycle 11

| Command | Result |
|---|---|
| `node --check scripts/checkContentConsistency.mjs` | pass |
| `npm run content:check` | 64/64 self-fixtures; 0 `cycle11/*` violations; 22 Cycle 11 baseline entries resolved, 1 added (§24.8) |
| `node scripts/checkContentConsistency.mjs --json` | used for the itemized delta, so the attribution is measured rather than read off a printed total a sibling also moved |
| `npm run typecheck` (`tsc -b`) | pass, including the authored test file |
| `git diff --check` over the cycle's paths | exit 0 |
| Tamper tests | **16**, one per rule id, each fired and then restored byte-identically; the repository reports 0 `cycle11/*` before and after (§24.6) |
| Structural assertions inside the authoring scripts | process graphs re-walked from `startNodeId`, unique action and node ids, no dangling edge, one outgoing edge per node, and every ordering claim in §24.2 and §24.3 asserted rather than eyeballed |

**Intentionally not run**, under the `AGENTS.md` validation policy: Vitest in any form, `npm run
build`, Playwright, browser and E2E matrices, camera and gesture verification, performance tests, and
mobile QA. One test file was authored and not executed:
`src/runtime/__tests__/cycle11Kinetics.test.ts`.

**Consequently the entire corrected chronology is unexecuted.** The static evidence establishes that
the content declares the right operands in the right order, that the handlers read them, that the
affordances the transfers need are present, and that the types agree. It does not establish that a
student can now finish either lab. Two specific risks follow from that, and both are what the authored
tests target first: the marble transfer is the first content anywhere to use `marble-chips` as a pour
source, and `stage-melting-sample` is the first to use a `dragToZone` station that
`stationToLocation` does not special-case.

**No PNG or SVG was created or changed**, so the asset-inspection step had nothing to inspect. The
syringe wiring points existing, already-reviewed art at existing state names; it invented no artwork
and no colour.

### 24.12 Cycle 11 self-review, and the five defects it found

Cycle 11's own output was reviewed against § 24's claims after the cycle reported complete. Five
defects were found and all five are fixed. None changes a headline result: `npm run content:check`
still reports 0 `cycle11/*` violations, `npm run typecheck` passes, `git diff --check` exits 0, and the
baseline delta is unchanged at 22 resolved and 1 added.

**1. The magnet test read a sample that had already been staged for melting.** The dry test line runs
two tests on one microsample portion, and the first pass scheduled
`test-magnetic-response` *after* `stage-melting-sample` and `read-melting-behavior` — so a student
following the process would bring the magnet to a solid that had been at the melting apparatus,
possibly melted or decomposed. Magnetism is the non-destructive test of the two, so it now runs first
in both phases: dispense → magnet read → melting stage → melting read, with the two K-05 records
staying where the authored order put them. The action carries a new `magnet-after-heating` invalid case
and says in its note why it precedes the melting stage. A new rule,
`cycle11/magnet-read-after-melting-stage`, refuses the original arrangement; its tamper test replays
exactly what the first pass authored.

**2. A role constraint this cycle wrote was contradicted by the content that same cycle wrote.**
`bonding-test-vessel` declared `freshVesselPerTest: true`, and the dry line legitimately runs two tests
in one vessel. §9 of Investigation 6 constrains the *microsample*, not the vessel count. The constraint
is now `freshMicrosamplePerTestLine` plus `nonDestructiveTestsPrecedeDestructive`, and the rationale
states the ordering rule that makes sharing admissible.

**3. The marble transfers authored another cycle's unresolved state.** Both carried
`visualState: "dissolving-solid"`, which is `unresolved` with `ownerCycle: "12"` and an `owners` list
naming only the hand-warmer content. Two things were wrong with that: the state cannot render, so §19.1
falls it back to `clear-liquid`; and the registry's `owners` list silently became incomplete, which no
rule checks. Its `runtimeAssignment` is `default`, meaning the reducer assigns this exact literal when
an action declares nothing — so **the parameter changed no appearance at all** and its only effect was
the stale owners list. Removed from both owners. The bonding transfers keep
`visualState: "granular-solid"`, which is resolved, `solid-style`, and already owned by that lab.

**4. The documented syringe axis values were written from the state names rather than from the source,
and four of the seven were wrong.** This is the one defect that would have propagated: the whole point
of documenting the axes is that Cycle 12 extends the family without renaming, so a wrong tuple misleads
exactly the reader it is written for. Re-derived from Investigation 13's apparatus rows SYR-00 to
SYR-06 and finding 11 (basis `M/F`), which the first pass had not read:

| | First pass | Corrected, from the source rows |
|---|---|---|
| `syringe-filled` | barrel = filled | SYR-01 draws 10 mL into a ≥60 mL barrel, so **liquid-plus-gas** |
| `syringe-inverted` | barrel = filled | SYR-02 inverts *because* gas is trapped, so **liquid-plus-gas**, orientation inverted |
| `syringe-gas-expelled` | "same axis values as syringe-empty" | SYR-03 depresses the piston until the headspace is gone: **liquid**, still inverted. It collides with nothing |
| `syringe-extended` | barrel = gas, closure = open | SYR-05 pulls the piston *against a closed valve* — that is what lowers the pressure — so **liquid-plus-gas, valve-closed** |
| `syringe-nail-locked` | closure = open | SYR-06 locks the extended, valve-closed state, so **valve-closed** |

A fourth axis, `orientation`, was added because SYR-02 and SYR-03 are distinguished by it. All seven
tuples are now distinct, the mapping onto SYR-00 to SYR-06 is one-for-one, and the provenance cites the
rows rather than asserting the reading. SYR-07, the shaken colour shift, is recorded as deliberately
**not** a member: it is a liquid colour, not a syringe body state.

**5. Eight of the authored tests would have failed for the wrong reason.**
`performRuntimeAction` refuses any action that is not the current node's, before the handler runs at
all. The first draft used one large fixture per area and then invoked actions out of that fixture's
process order, so eight assertions would have met "That action is not expected at this point in the
process" instead of the behaviour they name — the same defect class §17 and §19.10 record for the
hand-warmer generator test and the state-asset precedence test. Every fixture now contains exactly the
actions its test performs, in the order it performs them, and a `drive` helper **asserts that
correspondence** so a future reordering is an authoring error rather than a silent wrong-order pass.
The rewrite also replaced a vacuous reset test — it asserted only that a fresh state is fresh — with
two that exercise the real reset paths, including the physical-scope reset that §9 of Investigation 10
requires to retain a failed run's record. Three tests were added for the process gate itself, since
the corrected chronology depends on it. Still not executed, under the same policy.

Also fixed while reviewing, all smaller: the four run actions now declare `modelDisplayDecimals: 1` and
say in their notes that the model reports a tenth of a millilitre from a barrel graduated in whole
millilitres, so the extra digit is model resolution and not read precision (the first pass declared the
graduation and then printed a tenth, which is a contradiction the reader had to notice); the marble
transfer declares `massMeasurementId` against the balance reading it means, with three new rules
(`cycle11/reactant-mass-measurement-undeclared`, `-unmatched`, `-decoupled-from-balance`) holding the
transferred mass equal to the weighed mass, because the reducer takes `massG` as a literal and cannot
consume a measurement id; `create-kinetics-graph` required only two of the three condition series while
its own text asked for all of them, and now requires all three; and `cycle11ProcessOrder`'s
empty-map-on-a-branching-graph behaviour is now documented as a deliberate floor rather than left for a
reader to discover, since every ordering rule goes quiet rather than wrong if a later cycle branches
one of these processes.

**Verification for this review.** `node --check scripts/checkContentConsistency.mjs`;
`npm run content:check` (73/73 self-fixtures, 0 `cycle11/*`); `npm run typecheck`;
`git diff --check` clean; the bonding process re-walked and every dry-line ordering pair asserted; and
the tamper suite re-run and extended from 16 to **20 rules, all 20 firing**, with every file restored
byte-identically and the repository clean before and after. **Still not run**, unchanged from § 24.11:
Vitest in any form including the rewritten file, builds, Playwright, browser and E2E, camera and
gesture, performance, and mobile QA.

## 25. Cycle 07 — brass spectroscopy and hazardous preparation closure

Cycle 07 is complete in two coordinated parts. The shared session-input path now carries teacher
configuration and student numeric, calculation, and text responses without placing build-time source
provenance in client-visible state. The brass investigation is version `1.2.0`, has 129 actions, and
all 26 physical actions have an interaction, atom identity, required role bindings, and canonical
source trace. The blank is inserted and removed as two distinct physical operations, the digest and
four rinses preserve quantitative transfer, each standard records its stock aliquot and final-volume
dilution, and the color-depth comparison remains qualitative evidence rather than a fabricated
concentration result.

`parameters.sourceBasis` was removed from the public brass definition. The authoritative `M/F/R/C`
evidence remains in `docs/architecture/source-trace-registry.json`, which is build-time only. Basic
static verification reports `Cycle 07 brass checks: 102/102 passed`.

## 26. Cycle 12 — equilibrium and hand-warmer state completion

The equilibrium technique remains version `2.2.0` with 162 actions and 162 process nodes. Its 101
physical actions all have executable interactions, atom identities, role bindings, and dated source
traces. The final teacher presentation is correctly modeled as an observation rather than an
equilibrium stress. New atomic distinctions cover working/display racks, system-specific reagent
trays, equilibrium vessels, thermal baths and thermometer placement, measured transfers, reagent
stresses, pressure-syringe manipulation, the locking pin, and evidence-tube display slots. Explicit
result visual states remain authoritative and do not encode a quantitative concentration.

The hand-warmer technique is generator-owned and was regenerated only through
`scripts/generateHandWarmerCalorimetry.mjs` version `2.3.0`. It has 241 actions, 53 physical actions,
and no interaction gap. The generated flow uses teacher session inputs for unresolved configuration,
student-entered measurements and calculations, source-faithful timing, real balance reads for the
solid portions, and the registered assembled calorimeter proxy/state assets. Public
`traceabilityBasis` and node `traceabilityId` fields were removed; the generator now keeps provenance
only in the canonical build-time registry. Basic static verification reports `180/180` Cycle 12
checks passed.

## 27. Cycle 13 — static closure and deferred dynamic QA

The final catalog inventory is 17 labs, 40 techniques, and 1,498 authored actions. The registry has
109 atoms, 70 equipment roles, 91 visual states, 7 composites, 120 realistic-asset dispositions, 3
image aliases, and 591 canonical source traces. Every realistic asset is classified, every authored
visual state resolves intentionally, composite handling remains registry-driven, and no public lab or
technique serializes `sourceBasis`, `traceabilityBasis`, or `traceabilityId`.

`npm run content:check` now reports 77/77 self-fixtures, 0 new findings, 0 changed fingerprints, and
387 resolved baseline entries. The retained 91 findings are classified historical content debt:

- 69 atomless physical actions: 50 in unreferenced legacy/catalog techniques and 19 confined to the
  two legacy demonstration labs plus their imported generic techniques;
- 3 deliberately declared but unreferenced actions in the optional crystal-violet extension;
- 5 imports retained by demonstration/presentation definitions but not referenced by their local
  process graphs; and
- 14 owner-local action-ID collisions whose owner-qualified identities remain unambiguous.

There is therefore no active-flow or unclassified debt in the remediated Investigations 1–6 and
8–14. Investigation 7's `thermal-decomposition-mass-loss` remains explicitly classified legacy
catalog content and is not imported by the active green-chemistry lab; its 14 atomless actions are not
hidden by rewriting the baseline.

The detailed source crosswalk, retained-debt disposition, and deferred interaction matrix are in
`docs/atomic-remediation-static-closure-and-deferred-qa.md`. Under the repository validation policy,
Vitest, full tests, build, browser/Playwright/E2E, camera/gesture, performance, and mobile QA were not
run. Static evidence verifies authored contracts and consistency; it does not claim that every
student route has been completed interactively.
