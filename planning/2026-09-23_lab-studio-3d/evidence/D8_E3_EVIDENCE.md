# D8 E3: evidence (2026-10-10, with the fidelity review)

Your brief (2026-10-10): the D8 build in three stages: the `filterInPortions` fix, E0 (a short design, put to you), and E3, `intro-filtration-demo` playing in 3D. E0 was answered in line the same day (`proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 decisions"): A, the three twins E3 uses; B, every setup field filled in with an approved default; C, the part shown on the step card and as headings on the intro.

## Stage 1: the `filterInPortions` fix (commit `353f159`)

- `src/runtime/reducer.ts`: the last filter portion pours exactly the liquid that is left (it used to be rounded with `roundToRuntimeMl`, which could put it above what was in the beaker and throw "Transferred volume must be between zero and the source volume."). The decanted remainder is rounded once.
- The other portioned operations were checked and none can throw this way: reagent portions take `Math.min` with what is left, rinses refuse a source holding less than the rinse, and pours and transfers check before splitting. No other core change.
- Test: `pack2Practice.test.ts`, "Filter a Precipitate pours the last portion exactly … (54.05 mL)". It fails without the fix and passes with it.
- Probe: `probe-practice.mts filtration-practice '{"mixtureVolumeMl":"54.05","precipitateMassG":"0.0075","paperMassG":"0.912"}'` plays 13/13; `probe-d8-twins.mts` plays 31/31 without `PROBE_ROUND`.

## What E3 built (commit `1a955d5`, and the review commit)

**Twins** (`scripts/practice3d/common.mjs`, `twinOf`). Each composed practice module also exports a twin, written by `build.mjs` to `public/techniques-3d/<original>-3d.json` and listed in `public/techniques-3d/twins.json`, never in the practice list:
- `transfer-3d` drops nothing;
- `hard-water-precipitation-3d` drops the slots `sampleVolumeMl` and `reagentStockVolumeMl` (the lab's own bench carries the sample and the working portion);
- `filtration-3d` drops `mixtureVolumeMl` and `precipitateMassG` (the mixture and its precipitate come from the earlier parts) and keeps `paperMassG`, the balance reading.

`twinOf` marks the copy `composable`, renames the `practice-3d` tag `twin-3d`, removes the dropped steps and slots (edges, ports, evidence and legacy effects follow), and fails the build on a leftover use of a dropped slot, an undeclared reference or a kept slot nothing uses.

**The 3D lab** (`scripts/practice3d/labs/introFiltrationDemo.mjs`, `composeLab.mjs`). One module declares the bench (13 items: 4 on the workbench, 8 on the tray, the funnel-in-stand in storage), the four parts in order with an explicit item map each, the eight setup fields and two rules. `composeLab` derives every role binding from the item maps, requires each part's configured slots to equal its technique's, and fails on an unused bench item, a setup field that goes nowhere or a rule naming no field. `build.mjs` writes `public/labs-3d/intro-filtration-demo.json` (a composition source) and `public/labs-3d/index.json` (parts, setup fields with their targets, rules); `--check` covers them. The Pack 1 original `measuring-volume` is read from `public/techniques/`; no 2D lab is read.

**Loading** (`src/studio3d/labs3d.ts`, `labs3dSetup.ts`). `#/3d/play/<labId>` reads the index, validates the source (`validateBundledLabSource`, and it must be a composition source), puts the teacher's values into a copy (slots and the reagent beaker's starting volume), and compiles through `compileBundledLabCompositionWithPolicy` with the policy checked on the source as written. The resolver takes a twin listed in `twins.json` from `techniques-3d/` (validated and policy-checked like a practice version) and anything else from the bundled catalogue. The loader also returns the authored view (each compiled action's parameters as its technique authored them, matched through `compositionManifest.origins`), which the provenance chips read, and each compiled node's part.

**Route and player** (`player/Lab3DRoute.tsx`, `Studio3DApp.tsx`, `Player3D.tsx`, `StepCard.tsx`, `SimulationSwitcher.tsx`, `studio3d.css`).
- Intro: "Before you start · 4 parts, 31 steps", the journey under a heading per part (the first four steps of each, then "and N more").
- Setup: "Classroom values", the eight fields with their approved defaults, observations as text areas, the approval box, and the first refused value or broken rule named on the page.
- Run: Player3D with source tag EXPERIMENT; the step card's eyebrow reads "Part 2 of 4 · Transfer Liquid · Step 6 of 31"; the 2D fallback is `#/play/intro-filtration-demo`.
- The switcher lists an "Experiments" group after the packs, which opens `#/3d/play/<labId>`.

2D is untouched: `public/labs/`, `public/techniques/`, `src/player/**` and `src/styles/app.css` have no changes.

## Checks

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 0 errors |
| `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` | 24 files, 249 tests pass (new: `lab3d.test.ts`, 9 tests) |
| `npm run content:check` | 22 violations, equal to the baseline (exit 1, as on main) |
| `node scripts/practice3d/build.mjs --check` | 0 (the practice files unchanged) |
| `probes/probe-lab3d.mts` (successor of `probe-d8-twins.mts`, reading the generated files) | source valid; 31 steps on 13 items (3/4/11/13 per part); complete 31/31; no `PROBE_ROUND` |

`lab3d.test.ts` covers: the three twins (composable, valid, policy-clean, never listed as practice versions or in the 2D catalogue); the dropped and kept slots; the resolver's order (no `labs/` file fetched); the lab compiling with the defaults through the policy seam, 13 items ready in 3D, 3/4/11/13 steps per part; all 31 steps played with the defaults (0.0075 g on the paper, 72.05 mL in the flask, 29 mL left in the working portion); the teacher's values carried into the run (50 mL sample, 30 mL reagent from a 40 mL portion: 112.05 mL in the flask, 9 mL left); setup refusals (empty, not a number, out of bounds, each rule); and provenance through the authored view (the precipitate observation is a teacher's value; without the authored view it falls back to the bench; the paper's mass is not shown as a teacher's value).

## G1 look

One headless look (`probes/look-lab3d.cjs`, Playwright with SwiftShader at 1280 × 800, Low quality), by keyboard carries and the step card, with the setup's approved defaults:
- **Intro:** "Before you start · 4 parts, 31 steps", four part headings with their first steps ("and 7 more", "and 9 more"), "A teacher sets 8 classroom values…", the 2D link and "Next: setup".
- **Setup:** the eight fields filled in, units on the numbers, the three observations as text areas; a 60 mL reagent with the 50 mL portion is refused on the page with the rule's message (checked in the app's pane).
- **Run:** 31 of 31 steps, with no page errors. The eyebrow names the part at every part boundary ("Part 1 of 4 · Measure Liquid Volume · Step 1 of 31", Part 2 at step 4, Part 3 at step 8, Part 4 at step 19). The bench starts with 4 items out and 8 on the tray. The filter takes seven pours of the 54.05 mL mixture, the last one exactly what is left (the stage 1 fix, in the app). The results sheet reads "Precipitate and Filter Calcium Carbonate · complete", "31 of 31 steps".
- **Float noise:** a scan of the page with the results, the notebook and the bench list open found no number with five or more decimals.
- **Switcher:** Pack 1, "Pack 2 · practice", then "Experiments" with the lab; choosing it opens `#/3d/play/intro-filtration-demo` (checked in the app's pane).
- The first run stopped at step 29 because the look's own loop allowed six pours; the loop was raised and the second run finished.

## Fidelity review

Reviewed after the look, against the policies (atomization, teacher-prepared values, 3D independent of 2D) and E0.

**Fixed:**
1. **"Record volume" was chipped "Your entry" although the student types nothing.** Measure Liquid Volume's record step has no input field: it copies the cylinder's reading, which the teacher set. `player/provenance.ts` now gives a notebook row from a step with no field the chip of the measurement it records when that measurement is a teacher setting. A typed reading (Filter a Precipitate's paper mass) keeps "Your entry". Test: `lab3d.test.ts`, the provenance case. Look: both "Sample volume" rows read "Teacher setting" after part 1.
2. **The look's pour loop** allowed six pours; the default mixture needs seven. Raised to ten (tooling only).

**Seen and left, for your decision (each touches content outside E3's scope):**
3. **Measure Liquid Volume is the Pack 1 original, in its 2D wording.** Step 3 reads "Record the the configured volume sample volume in the notebook."; the pour's callout and feedback say "the configured sample" and "the configured volume". The text is in `public/techniques/measuring-volume.json`, which D8 leaves to 2D. Its steps are also not atomized (place the cylinder, one pour to the volume, record), unlike the Pack 2 parts. A 3D twin of it (corrected wording, and a drop-to-the-line finish like Dilute a Stock Solution's) would fix both inside 3D; it is a content change, so it needs your decision.
4. **"Sample volume" appears twice in the results** (the cylinder's reading, 20.0 mL, and the recorded row, 20 mL). This is how Pack 1's technique records it. A twin as in 3 could record it once.
5. **The step card's Source list names the catalogue item** ("250 mL beaker") where the bench says "Sample beaker". The practice versions do the same; not new in E3.
6. **The eyebrow wraps to three lines** for the longest part title ("Hard-Water Calcium Carbonate Precipitation") at 1280 px. It stays readable; a short part title per lab part would keep it to two lines, if you want one.

**Checked and found right:** the paper's mass is the balance reading the student types (`paperMassG` kept in the twin, not shown as a teacher's value); the precipitate's mass is never shown; the drop test draws from the working portion, which the setup rule keeps 1 mL above the reagent added; every bench item is used by a part; nothing in `public/labs/`, `public/techniques/`, `src/player/**` or `src/styles/app.css` changed.

## For later

- **Drying and `hard-water-demo`.** Compiled measurement ids are scoped by instance (`filtration--filter-paper-mass`). Drying's twin will need its calculation to find Filtration's paper mass across parts: `preserveIds.references` on that instance, or an explicit binding. Decide it when the Drying twin is built.
- **Float noise.** The runtime leaves the working portion at 28.999999999899995 mL and the flask at 72.0500000001 mL after the run. Nothing throws (the stage 1 fix covers the filter), and the G1 look's scan found no long numbers on screen.
