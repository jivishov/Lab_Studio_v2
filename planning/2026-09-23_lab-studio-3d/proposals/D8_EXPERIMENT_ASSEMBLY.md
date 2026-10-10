# D8: how experiments are assembled from the atomic steps (brief)

Prepared 2026-10-10 for the discussion the user asked for (`NEXT_THREAD_PROMPT.md`). Nothing is built.
Every fact below was read from the code, or run with a probe in this worktree, on 2026-10-10. Probes:
`probes/probe-d8-compile.mts` (a bundled lab through the loader's seam) and `probes/probe-d8-twins.mts`
(option (iv) below, compiled and played).

## Facts

**How a published experiment is made today.**
- A lab in `public/labs/` is a composition source:
  - `techniqueInstances`: each names a technique and its version, and carries `bindings` (role → lab-owned
    equipment instance, and configuration values) and `preserveIds`;
  - `compositionStart`, `compositionConnections` and `reachabilityWitnesses`.
- `loadBundledLab` (`src/data/loadBundledLabs.ts`) applies a lab setup (`applyLabSetup`), then calls
  `compileBundledLabCompositionWithPolicy` (`src/data/bundledCatalogPolicyBoundary.ts`), which:
  1. checks the catalogue policy on the source;
  2. runs `compileLabComposition` with a **technique resolver the caller supplies**;
  3. checks the policy on the compiled lab.
  
  The policy uses the artifact path only as a label.
- **The result is one ordinary `LabDefinition`:** one process, one bench, every `{{config.*}}` value filled in,
  plus a `compositionManifest`.
  - `intro-filtration-demo` compiles to 13 steps on 10 bench items; `hard-water-demo` to 21 steps on 15 items.
  - The manifest records each instance's evidence outputs and exit nodes, and for each action, the instance it
    came from (`origins`). So the boundaries between techniques are known after compiling.
- **Player3D** takes a `RuntimeDefinition` (`LabDefinition | TechniqueDefinition`). Two things in it assume a
  technique:
  - the route that loads it (`Technique3DRoute`, `practice.ts`);
  - the provenance chips (`player/provenance.ts`), which mark a value as the teacher's when the *authored*
    definition still holds `{{config.*}}`. A compiled lab holds none.
- **The step clock** is computed from each action's parameters (`stepClockSeconds`), so it does not depend on
  techniques.
- **The play route** `#/3d/play/<labId>` exists and shows "This route does not run anything yet."
  (`Studio3DApp.tsx`).
- **3D models.**
  - Every equipment definition of `intro-filtration-demo`, `hard-water-demo` and
    `green-chemistry-mixture-purification` has a 3D model.
  - `paper-chromatography` lacks 8 models and `brass-colorimetry` 6.
- **2D lab setup forms** (`src/App.tsx`):
  - none for `intro-filtration-demo` or `hard-water-demo`;
  - `paper-chromatography` has `PaperSetupForm`;
  - green chemistry refuses to start without a setup (`LabSetupRequired`).

**Studio.**
- Studio 3D's experiment drafts flatten (`Inspector.tsx`: "Techniques are copied with their own equipment…").
- The 2D Studio can open a compiled published lab (`TeacherStudio.tsx`, `loadBundledLab`) but cannot compile a
  draft. An edit detaches the draft (`markCompositionDetached`).
- Studio 3D does not list the practice versions.

**Pack 2's practice versions don't compose as they are.**
- **The disposition.** `validateInstanceBindings` (`src/domain/compositionValidation.ts`, unchanged since GitHub
  main `1d28429`) allows only `composable` and `lab-scoped`. The practice versions are `standalone-practice`.
- **The contracts.** Swapping `filtration` for `filtration-practice` in `intro-filtration-demo` fails on:
  - the disposition;
  - four missing roles: the balance, stirring device, rinsed vessel and receiving vessel;
  - two missing and two undeclared configuration slots;
  - every `preserveIds` entry.
- **All five differ from their originals:**
  - Transfer: 3 steps → 4, 2 roles → 5;
  - Precipitation: 1 step → 11, 2 roles → 7, with the entry and exit both moved;
  - Filtration: 6 roles → 10;
  - Drying: 7 steps → 26, with the entry and exit moved;
  - Heat and Reweigh: 31 → 36, without the original's approval gate.
- **Stand-in steps.** A practice version plays alone, so a step can stand in for a technique that comes before
  it. Drying's first step, "Note the paper's mass", records the teacher's value; in a lab, Filtration has just
  weighed the paper. Transfer, Precipitation and Filtration have none (probe).
- **Starting contents** are dropped when a technique is composed, because the lab supplies the bench.
  - The slots that only fill those contents are still required, even though nothing in the lab uses them:
    Filtration's `precipitateMassG` and `paperMassG`.
  - Three of Precipitation's slots (the reagent volume and two observations) have no default, and the 2D lab
    binds none of them.
- **One more core use of `standalone-practice`:** the starting-volume check in
  `standaloneConfigurationSemantics.ts`.

**Option (iv) works without a core change.** For the probe, the three Pack 2 practice versions were copied with
`catalogDisposition: "composable"` and composed with Pack 1's unchanged `measuring-volume`. The bindings were
derived mechanically and the teacher's values set in the source.
- The source compiles through `compileBundledLabCompositionWithPolicy` with a resolver that reads the 3D
  versions first. Both policy checks pass.
- It gives 31 steps (3 + 4 + 11 + 13) on 13 bench items.
- In the runtime, the measured sample is poured into the beaker, precipitated there, and the paper is
  weighed, folded and seated. The run reaches step 29, the pour through the filter.

**A defect in Pack 2 that the probe found (live on the site).**
- `filterInPortions` (`src/runtime/reducer.ts`) rounds the last portion to 10 decimals. When the liquid left is
  `6.049999999999997` mL, the portion becomes 6.05 mL, more than is left, and `splitContentForVolume` throws
  "Transferred volume must be between zero and the source volume."
- In the lab, the beaker holds 54.05 mL (20 mL of sample plus the reagent and the rinses), so the pour throws.
- The published standalone Filter a Precipitate throws the same way when a teacher sets a mixture volume of
  54.05 mL (`probe-practice.mts`). Its default, 30 mL, is safe.
- The fix is one line, in core code from this branch.

**What the composition machinery cannot do.**
- `variants` only switch a whole instance on or off (`witnessEnablesInstance`, `compileLabComposition.ts`); they
  cannot choose between two procedures inside one technique.
- `orderedProcedure` selects repeated test groups (chromatography, kinetics, bonding).
- A technique with variants or approval gates is refused as a Studio workflow
  (`compositionTechniqueConfigurationBlocker`).

**The labs at stake.**

| Lab | Instances | Where its techniques stand in 3D |
|---|---|---|
| `intro-filtration-demo` | measuring-volume, transfer, hard-water-precipitation and filtration, with 3 connections | All four exist: Measure Liquid Volume is Pack 1's unchanged original, and the other three have Pack 2 practice versions |
| `hard-water-demo` | the same four, plus drying and hard-water-calculation, with 5 connections | Drying has a Pack 2 practice version; hard-water-calculation is in Pack 3. The lab can't be finished in 2D: Drying stores `ovenTemperatureC` but the cooling handler reads `temperatureC`, and the record looks for `drying--dry-precipitate-mass` while the weighing saves `dry-precipitate-mass` |
| `green-chemistry-mixture-purification` | thermal-decomposition-mass-loss, with 1 connection, 3 lab steps, and 3 witnesses built on the original's approval gate and its tare-convention setting | Pack 2. The practice version has no approval gate, so the witnesses need redesigning |
| `paper-chromatography`, `brass-colorimetry` | one technique each (428 and 314 steps), plus 15 and 28 lab steps | Pack 3; models are missing |

## Question 1: which steps the 3D experiments use

| Option | Duplication | Core change | Effect on 2D | Drift risk |
|---|---|---|---|---|
| **(iv) Twins from one module (recommended).** Each `scripts/practice3d/*` module also writes a `composable` lab version, its *twin*: the same steps, minus any stand-in steps and the slots that only fill the practice bench. 3D labs live in `public/labs-3d/`, written by the same build (with `--check`). The 3D loader's resolver reads `techniques-3d/` first. | One more generated file per technique and per lab, from one source module each | **None** (probe) | None | Low: the twin and the practice version come from one module, and the labs are generated and checked |
| (i) Compose the practice versions themselves | One 3D lab file per lab | An opt-in so the compiler accepts `standalone-practice` when the 3D loader asks | None | Low, but stand-in steps (Drying's) play inside the lab, and slots that fill nothing must still be bound |
| (ii) The originals become the atomized steps | None | None | The three 2D labs very likely become unfinishable in 2D, reversing Pack 2's choice | None |
| (iii) One technique carries both procedures | None | A new mechanism: variants cannot choose a procedure, so both graphs would share one process behind a configuration branch | Every original gets a new version; its 2D labs must bind the union of roles; it stops being a Studio workflow | Medium: two procedures in one file |

**Recommendation: (iv).**
- It needs no core change and doesn't touch 2D.
- It keeps one source per technique.
- It drops stand-in steps honestly.
- For `intro-filtration-demo`, the three twins are just the practice versions marked `composable`, with
  Filtration's two unused slots dropped.

(i) is the fallback, at the price of a core change.

## Question 2: how a 3D experiment plays

**Recommendation:** `#/3d/play/<labId>` loads `public/labs-3d/<labId>.json` and compiles it through
`compileBundledLabCompositionWithPolicy`, with the 3D resolver. That is the same path as `loadBundledLab`, not a
copy of it. Player3D then plays the compiled lab. The compiler already gives one process on one bench, so these
are the gaps:

| Gap | What it needs | Note |
|---|---|---|
| Loader and route | `src/studio3d/labs3d.ts`, like `practice.ts`; the play route, with an intro page | 3D only |
| Technique boundaries | Group the steps by `compositionManifest.origins[].instanceId`, e.g. "Part 2 of 4 · Transfer" on the step card | Play needs no UI for ports |
| Vessels carried on one bench | Already done by the compiler's bindings (probe); a 3D layout check for 13 to 20 items | Crowding on the bench is the real risk |
| Lab setup (teacher-prepared values) | A 3D setup page over the lab's teacher values, applied to the source before compiling (3D only) | `intro-filtration-demo` needs five values that its 2D lab doesn't bind. Green chemistry and paper chromatography need their own forms (E4) |
| Provenance chips | Mark teacher values from the source's instance bindings and the manifest's origins, since a compiled lab keeps no `{{config.*}}` | 3D only |
| Switcher | An "Experiments" group | 3D only |
| Step clock | Computed per action, so it should work as is | Check it in the first look |

## Question 3: Studio authoring (the plan's D8)

- **(a) only, for now (recommended).**
  - Published 3D experiments are generated sources, so the Studio is not on the critical path.
  - Decide (b) again after the first 3D experiment plays.
  - Studio 3D keeps not listing the practice versions.
- **(b) now, as Phase B's centre** (plan E0, E1): new Studio operations for instances, bindings, connections and
  compiling. A core change, larger than (iv) itself.
- **List the practice versions in Studio 3D** as techniques to open and copy. It is small and 3D-only, but it
  gives drafts in which vessels don't carry across techniques. Not recommended until (b).

## Question 4: order

1. **E0, a short design step:**
   - the twin format;
   - the stand-in audit of the five Pack 2 modules;
   - the format of the 3D lab modules;
   - the resolver;
   - the setup page's values and the provenance rule.
2. **E3: `intro-filtration-demo` in 3D.** Measure Liquid Volume becomes playable.
3. **`hard-water-demo`,** after Pack 3 delivers Calculate Hardness, with Drying's twin.
4. **`green-chemistry-mixture-purification`** later (E4): its custom route, its setup, and witnesses redesigned
   without the approval gate.

**How this changes Pack 3's first decision.**
- Its three lab-bound techniques follow Pack 2's route: each module writes a practice version and a twin, so
  the labs follow by generation.
- Beer's Law and Hard Water Gravimetry are composed by no lab, so they may still take Pack 1's route.

## Question 5: `hard-water-demo`'s 2D faults

**Recommendation: out of scope.** Its 3D version composes Drying's twin, not the original, so the faults don't
reach 3D. Fixing them is a 2D content change (two keys), a separate decision.

## Question 6: the `filterInPortions` defect (found in the review)

**Recommendation: fix it first in the build thread, as a small core fix with a test.** For example, the last
portion pours exactly what is left. It is live on the site for some teacher volumes, and E3 can't finish without
it. Republish only when you ask.

## What each recommendation commits us to

- **Core:** the one-line `filterInPortions` fix (Question 6); nothing for D8 itself.
- **Content (3D only):**
  - twin outputs from `scripts/practice3d/*`;
  - `public/labs-3d/`;
  - their `--check`.
- **3D code:**
  - `labs3d.ts` and the play route;
  - the part labels;
  - the lab setup page and the provenance rule;
  - the switcher group.
- **Untouched:** `src/player/**`, `src/styles/app.css`, `public/labs/`, `public/techniques/`, and the 2D Studio.

## What stays open

- (b), composition-source authoring, after E3.
- Lab setup forms for green chemistry and paper chromatography, and green chemistry's witnesses (E4).
- `hard-water-demo`'s 2D faults.

## Review log (2026-10-10, before the discussion)

1. **Policy and path.** The first draft left open whether the policy accepts a `labs-3d` artifact. The policy uses
   the path only as a label, and the twin probe passes both policy checks. "None expected" became "None".
2. **The twins were proved, not assumed.** `probe-d8-twins.mts` compiles and plays the 3D
   `intro-filtration-demo` from twins. The draft had not run one.
3. **A defect found.** The probe's run stopped at the filter pour: `filterInPortions`. The published standalone
   version fails the same way at 54.05 mL. Added to the facts as Question 6.
4. **Provenance.** The draft said nothing in the player but the route was specific to techniques. The
   provenance chips are too, because a compiled lab keeps no `{{config.*}}`. Added as a gap.
5. **Teacher values.** The draft said `intro-filtration-demo` "can start with the lab's own values". It can't:
   five twin slots have no value in the 2D lab. Corrected.
6. **Stand-in steps measured.** Transfer, Precipitation and Filtration have none; Drying's paper-mass step is
   one. Twins also drop the slots that only fill the practice bench.
7. **Order.** The draft offered green chemistry as the second lab. Its witnesses depend on an approval gate the
   practice version dropped, so it moves after `hard-water-demo`, to E4.
8. **Counts.** Transfer's 3 → 4 steps was added. Heat and Reweigh's missing approval gate is noted.

## Decisions (you, 2026-10-10, in two rounds)

1. **Which steps: the real atomized steps, beside 2D (option iv).**
   - Your words: "I need real atomized steps to use in 3D. Ignore the 2D version at all."
   - Asked where the lab versions live, you chose "Beside 2D". 3D experiments compose twins written by the
     practice modules, in `public/techniques-3d/`, and 3D labs in `public/labs-3d/`.
   - 2D is neither read nor written, and it never constrains a 3D design.
2. **How it plays: compile, then Player3D.** `#/3d/play/<labId>` goes through
   `compileBundledLabCompositionWithPolicy` with the 3D resolver. It adds the part labels, a 3D lab setup page
   for the teacher's values, provenance from the bindings, and an "Experiments" group in the switcher.
3. **Studio: (a) only for now.**
   - (b) is decided again after the first 3D experiment plays.
   - Studio 3D keeps not listing the practice versions.
4. **Order: intro filtration first.**
   1. E0, a short design step.
   2. E3: `intro-filtration-demo`.
   3. `hard-water-demo`, after Pack 3.
   4. Green chemistry (E4).
5. **`hard-water-demo`'s 2D faults:** left as they are.
6. **The `filterInPortions` defect:** fixed in the build thread, first, as a core fix with a test. It is
   republished only when you ask.

## For the build thread

The prompt is `NEXT_THREAD_PROMPT.md` (2026-10-10). In order:
1. **The `filterInPortions` fix:**
   - the last portion pours exactly what is left;
   - a test at 54.05 mL;
   - `probe-practice.mts` at 54.05 mL runs to the end.
2. **E0, written into this file under "E0 design" and put to you in line before any build:**
   - the twin format: which slots and steps each Pack 2 twin drops;
   - the twin naming;
   - the 3D lab module format and the `--check`;
   - the resolver order;
   - the setup page's values for `intro-filtration-demo`: the five unbound slots and which existing values the
     teacher may change;
   - the provenance rule;
   - the part labels.
3. **E3, `intro-filtration-demo` in 3D:**
   - twins and the lab from `scripts/practice3d/`;
   - `src/studio3d/labs3d.ts`;
   - the play route, the intro and setup pages;
   - the part labels, provenance and the switcher group.

   Exit:
   - the twin probe runs all 31 steps without its workaround;
   - tests;
   - one G1 look of the whole run.
4. **Then the Pack 3 proposal** (`PACK3_PROPOSAL_PROMPT.md`, with its D8 note).

## E0 design (2026-10-10, before the E3 build)

Written in the build thread after the `filterInPortions` fix (`353f159`). Every fact below was read from the
modules and core code, or run, on 2026-10-10. Once the fix is in, `probe-d8-twins.mts` plays all 31 steps
without `PROBE_ROUND`.

### 1. The twins

**How a module writes its twin.**
- `common.mjs` gets one helper, `twinOf(practice, { id, dropSteps, dropSlots })`. A module exports its
  practice version as now (default export) and its twin as a named export, `twin`.
- The helper deep-copies the practice version, then:
  - sets `catalogDisposition: "composable"`;
  - removes the dropped steps' actions and nodes, joins the process edges again, and moves the entry or exit
    port if it pointed at a dropped node;
  - removes the dropped slots;
  - removes evidence outputs, legacy effects and required evidence that name a dropped action.
- **The starting items stay.** They are the source instances of the twin's roles, and a lab binds each one to
  its own item. The compiler then drops the technique's bench, so contents never reach a lab. Contents that
  name a dropped slot are emptied.
- **The build checks each twin** and fails when:
  - a dropped slot is used anywhere other than the starting bench or a dropped step;
  - a `{{config.*}}` is left that no slot declares;
  - the twin fails validation, the composition contract or the catalogue policy (the same checks as a
    practice version).
- **Naming.**
  - Id `<original>-3d`, for example `filtration-3d` and `hard-water-precipitation-3d`. The title is the
    practice version's. Tag `twin-3d`.
  - The file is `public/techniques-3d/<id>.json`.
  - The twins are listed in a new `public/techniques-3d/twins.json` (id, file, practice id, original id).
    They are never in the practice list `index.json`, so the switcher never offers a twin, which cannot play
    alone.

**What each twin drops.** The audit read every `{{config.*}}` use in the five practice files.

| Technique | Stand-in steps dropped | Slots dropped (they only fill the practice bench) | Slots kept (a step uses them) |
|---|---|---|---|
| Transfer Liquid → `transfer-3d` | none | none | `transferVolumeMl` (the pour), `transferObservation` |
| Precipitation → `hard-water-precipitation-3d` | none | `sampleVolumeMl`, `reagentStockVolumeMl` | `reagentVolumeMl`, `precipitateMassG` (the model's mass), `precipitateObservation`, `completenessObservation` |
| Filter a Precipitate → `filtration-3d` | none | `mixtureVolumeMl`, `precipitateMassG` | **`paperMassG`** |
| Dry and Weigh → `drying-3d` | "Note the paper's mass" (`note-paper-mass`): in a lab, Filtration has just weighed and recorded it | `precipitateMassG` | `paperMassG` (the combined reading on the glass), `watchGlassMassG`, `firstDryingMinutes` |
| Heat and Reweigh → `thermal-decomposition-mass-loss-3d` | none | `issuedMassG` (the vial's contents) | the other six |

**Two corrections to the brief:**
- **Filtration's `paperMassG` is not bench-only.** It is the mass the balance shows for the paper
  (`place-paper-on-balance`, `supportEmptyMassG`). The twin keeps it, and the lab binds it as a teacher value.
- **Three slots that only fill the bench were not counted.** Filtration's `mixtureVolumeMl` was missed
  because it has a default; Precipitation's `sampleVolumeMl` and `reagentStockVolumeMl` were also missed.
  All three are dropped. A lab supplies its own contents.

**Choice A: which twins are written now.**
- **(recommended)** Only the three that `intro-filtration-demo` composes. Drying's twin comes with
  `hard-water-demo`, and Heat and Reweigh's with green chemistry. Each twin is then proved by a lab that plays
  it.
  - Drying's open question belongs to its lab: whether its by-difference calculation finds Filtration's
    `filter-paper-mass` once compiled.
  - `hard-water-demo` failed in 2D on exactly such a reference (`drying--dry-precipitate-mass`).
- All five now. The two unused twins pass the static checks, but no lab plays them.

### 2. The 3D lab modules

**Format.** One module per lab, `scripts/practice3d/labs/<labId>.mjs`, written by a new `lab()` helper in
`common.mjs`. It declares:
- the title, description and learning goals (its own words; the 2D lab is not read);
- **the bench:** the lab's own items and starting contents;
- **the parts,** in order: each names its technique (a twin, or a Pack 1 original from `techniques/`) and an
  explicit **item map**, from each of the technique's starting items to a lab item. For example, Transfer's
  is `graduated-cylinder-1 → graduated-cylinder-1`, `beaker-250ml-1 → beaker-250ml-1` and
  `wash-bottle-1 → wash-bottle-1`.
- **the configuration of each part:** a fixed value, or `setup("<field>")`, which names a field of the setup
  page.
- **the setup fields:** label, unit, kind, default if any, bounds, and where each value goes (part slots, or a
  bench item's starting volume).

**What the build does with a lab:**
- It derives every role binding from the item map and the technique's own roles (`sourceInstanceId`,
  `definitionId` and the lab's `instanceId`). It fails on a role whose item is not mapped, a definition that
  differs, or a slot left unbound. This replaces the probe's mechanical "k-th item of a definition" mapping:
  every binding is written down and reviewed.
- It chains the parts' exit and entry ports in order, and gives the source one default reachability witness.
- **It writes:**
  - `public/labs-3d/<labId>.json`: a plain composition source, with the setup fields' defaults filled in, so
    it compiles as it stands;
  - `public/labs-3d/index.json`: one entry per lab, with id, title, description, file, the parts (instance id,
    technique id, title) and the setup fields.
- **`--check`** covers `techniques-3d/` and `labs-3d/` alike. A test compiles each lab through
  `compileBundledLabCompositionWithPolicy`, with the 3D resolver's order, and plays it.

**The bench of `intro-filtration-demo`** (13 items, as the probe found):

| Item | Starting contents | Where it starts |
|---|---|---|
| `sample-bottle-1` (sample bottle) | Hard water sample, 120 mL | bench |
| `graduated-cylinder-1` (100 mL) | empty | tray |
| `beaker-250ml-1` | empty | tray |
| `wash-bottle-1` | Deionized water, 500 mL | bench |
| `reagent-beaker-1` (150 mL beaker) | Sodium carbonate solution, the working portion (setup; 50 mL) | bench |
| `stirring-rod-1`, `beral-pipette-1` | empty | tray |
| `analytical-balance-1` | — | bench |
| `ring-stand-1`, `funnel-1`, `filter-paper-1`, `erlenmeyer-flask-250ml-1` | empty | tray |
| `funnel-stand-1` | — | storage (created when the funnel is seated) |

- **The rule for where an item starts:** an item that a step places starts on the tray; an item that no step
  places starts on the bench, as in the practice versions.
- **The 150 mL reagent beaker is checked.** It is Precipitation's working portion (Pack 2 interpretation,
  confirmed 2026-10-06: the dropping pipette never enters a stock bottle). The probe took it from the twin's
  own bench, not from the 2D lab, which has a 20 mL reagent bottle. 50 mL holds three portions of 20 mL with
  10 mL left for the 1 mL pipette fill. The lab keeps it, and its volume becomes a setup field.
- **Measure Liquid Volume** is Pack 1's unchanged original from `techniques/` (Pack 1 decision: unchanged), with
  a 1 mL tolerance and its measurement id fixed by the lab.

### 3. The resolver and the loader

- **`src/studio3d/labs3d.ts`**, modelled on `practice.ts`:
  - `loadLab3DSummaries()` reads `labs-3d/index.json`; a failed read is not cached;
  - `resolve3DTechnique(id)`: a twin in `twins.json` is read from `techniques-3d/`, then validated and checked
    against the policy, as a practice version is. Anything else goes to `loadBundledTechnique` (`techniques/`).
    It never fetches blindly, so there are no 404s;
  - `loadLab3D(id, values)`:
    1. reads and validates the source;
    2. applies the setup values to a copy (the part slots and bench volumes the index names);
    3. compiles through `compileBundledLabCompositionWithPolicy({ authority: "public-bundle", artifact:
       "public/labs-3d/<file>", catalogSource: source, compilationSource: configured, resolveTechnique:
       resolve3DTechnique })`;
    4. returns the compiled lab, the parts and the authored view (§6).
- **2D is neither read nor written.**
  - The resolver reads `techniques/` only for Pack 1's measuring-volume (decided).
  - The fallback link is `#/play/<labId>`, the existing 2D route for the same id, as for techniques.

### 4. The setup page (3D only)

It is the technique route's pattern:
- an intro with the journey in parts;
- then "Classroom values", with approved defaults filled in, an approval box, and "Save setup and start".

The values are checked before compiling, against the lab's capacities:
- the cylinder holds 100 mL;
- the beaker holds 250 mL, and it takes the sample, the reagent, the 9 mL cylinder rinse and the 5 mL rod rinse;
- the flask holds 250 mL, and it takes all of that, plus 18 mL of rinses and washes;
- the working portion must hold the reagent plus the 1 mL pipette fill.

| Field | Goes to | Default |
|---|---|---|
| Sample volume (mL) | measuring-volume `targetVolumeMl`, transfer `transferVolumeMl` | 20 |
| Transfer observation | transfer `transferObservation` | see choice B |
| Sodium carbonate working portion (mL) | `reagent-beaker-1` starting volume | 50 |
| Sodium carbonate added (mL) | precipitation `reagentVolumeMl` | see choice B |
| Precipitate mass, the model's value (g) | precipitation `precipitateMassG` | see choice B |
| Observation after the first portion | precipitation `precipitateObservation` | see choice B |
| Observation at the drop test | precipitation `completenessObservation` | see choice B |
| Dry filter paper's mass (g) | filtration `paperMassG` | see choice B |

These are fixed by the lab and not offered:
- the volume tolerance (1 mL);
- record ids;
- the sample bottle (120 mL) and wash bottle (500 mL);
- the pour portion (8 mL) and the residue (5 %), which belong to the technique.

**Choice B: defaults.**
- **(recommended)** As in the practice versions, which the user confirmed on 2026-10-06:
  - defaults only where a practice version has one: the sample (20 mL) and the working portion (50 mL);
  - the teacher enters the reagent volume, the precipitate mass, the paper's mass and the three observations
    (teacher-prepared values).
- Fill in every field with a proposed default, so the lab starts after one approval:
  - 20 mL of reagent and 0.0075 g of precipitate;
  - 0.553 g for the paper: a 9 cm grade 1 paper, at 87 g/m², weighs about 0.55 g. The probe's 0.912 g is
    heavy for that paper;
  - short observation texts.

### 5. Part labels and the switcher

- **Parts** come from `compositionManifest.origins` (node → `instanceId`) and the index's part titles:
  "Measure Liquid Volume", "Transfer Liquid", "Hard-Water Calcium Carbonate Precipitation" and "Filter a
  Precipitate".
- **Choice C: where the parts show.**
  - **(recommended)** On the step card's eyebrow ("Part 2 of 4 · Transfer Liquid · Step 5 of 31"), and as
    headings in the intro's journey.
  - The step card only.
- **Switcher.**
  - An "Experiments" group after the packs, listing `labs-3d/index.json`. Choosing one opens
    `#/3d/play/<id>`.
  - The top bar's source tag reads "EXPERIMENT".
  - Leaving a run in progress asks first, as now.

### 6. The provenance rule

A compiled lab keeps no `{{config.*}}`. The loader gives Player3D an **authored view** of the lab instead:
- the compiled lab, where each action's parameters are replaced by those of the action it came from, as its
  technique authored them;
- the actions are matched through `compositionManifest.origins` (`actionId` → `instanceId`, `sourceActionId`)
  and the resolved techniques.

A value that a technique binds to a slot (`{{config.x}}`) is then a teacher value. This is the same rule as for
a technique, whether the lab fixes the value or the setup page sets it.
- `player/provenance.ts` is unchanged.
- Player3D already takes `authoredDefinition`, and uses it only for provenance.

### 7. Not in E3

- Studio (b).
- `hard-water-demo` and green chemistry.
- The other two twins, if choice A is taken.
- Any 2D file.
- **Core changes: none.** The `filterInPortions` fix is done.

### Review for fidelity (before putting it to you)

1. **The paper's mass.** The brief would have dropped `paperMassG`, leaving the balance with no reading for the
   paper. It is kept.
2. **Bench-only slots.** Three were missed (above). Without dropping them, a lab would have to bind values that
   fill nothing.
3. **Drying's twin.** Dropping "Note the paper's mass" moves the paper's mass to Filtration's measurement. Whether
   the compiled calculation finds it is not proved, so the twin waits for its lab (choice A).
4. **The reagent.** The lab uses the working portion, not the 2D lab's stock bottle. This keeps the
   teacher's rule of 2026-09-26.
5. **Capacities.**
   - The setup's bounds follow the volumes the runtime actually adds: the 3 mL squirts and the 5 mL rod
     rinse.
   - The 54.05 mL found in the probe was 20 mL of sample, 20 mL of reagent, 14 mL of rinses and one 0.05 mL
     drop.
6. **Float noise elsewhere.** After the washes the flask reads 72.0500000001 mL (`roundToRuntimeMl` adds at 10
   decimals). It throws nothing. Whether a panel shows the noise is checked in the G1 look. It is not fixed here: it is
   core, and outside the decided fix.

### E0 decisions (you, 2026-10-10, in line)

- **A. Twins:** only the three that E3 uses (recommended). Drying's comes with `hard-water-demo`, Heat and
  Reweigh's with green chemistry.
- **B. Defaults: fill in every field** (not the recommendation). The setup page proposes a default for each field:
  - 20 mL sample;
  - 50 mL working portion;
  - 20 mL of reagent added;
  - 0.0075 g of precipitate (the model's value);
  - 0.553 g for the paper;
  - short observation texts.

  The teacher approves them or changes any.
- **C. Part labels:** on the step card's eyebrow and as headings in the intro's journey (recommended).
