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
