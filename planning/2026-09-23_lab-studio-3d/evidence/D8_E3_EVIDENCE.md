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
3. **Measure Liquid Volume is the Pack 1 original, in its 2D wording.** Step 3 reads "Record the the configured volume sample volume in the notebook."; the pour's callout and feedback say "the configured sample" and "the configured volume". The text is in `public/techniques/measuring-volume.json`, which D8 leaves to 2D. Its steps are also not atomized (place the cylinder, one pour to the volume, record), unlike the Pack 2 parts. A 3D twin of it (corrected wording, and a drop-to-the-line finish like Dilute a Stock Solution's) would fix both inside 3D; it is a content change, so it needs your decision. **Decided and built (2026-10-10):** the twin `measuring-volume-3d`, five atomized steps; see the section below.
4. **"Sample volume" appears twice in the results** (the cylinder's reading, 20.0 mL, and the recorded row, 20 mL). This is how Pack 1's technique records it. A twin as in 3 could record it once. **2026-10-10:** with the twin, the two rows agree: the typed reading, "20.0 mL", chipped "Your entry" on both. It is still listed twice, as the measurement and as its notebook entry, as every record step lists its value (the paper's mass too).
5. **The step card's Source list names the catalogue item** ("250 mL beaker") where the bench says "Sample beaker". The practice versions do the same; not new in E3.
6. **The eyebrow wraps to three lines** for the longest part title ("Hard-Water Calcium Carbonate Precipitation") at 1280 px. It stays readable; a short part title per lab part would keep it to two lines, if you want one. **Decided and built (2026-10-10):** "Part 1 of 4 · Measure the sample · Step 1 of 33" takes two lines.

**Checked and found right:** the paper's mass is the balance reading the student types (`paperMassG` kept in the twin, not shown as a teacher's value); the precipitate's mass is never shown; the drop test draws from the working portion, which the setup rule keeps 1 mL above the reagent added; every bench item is used by a part; nothing in `public/labs/`, `public/techniques/`, `src/player/**` or `src/styles/app.css` changed.

## Measure Liquid Volume twin and short part titles (2026-10-10)

Your decisions, the same day: "Build 3D twin of measure liquid volume, ensure to have atomized steps." and "Use short part title, as you suggest." They answer review items 3, 4 and 6 above. `DECISIONS.md`, the D8 row, records them as (8).

### What was built

**The twin.** `scripts/practice3d/measuringVolumeTwin.mjs` writes `public/techniques-3d/measuring-volume-3d.json`. `build.mjs` lists it in `twins.json` through a new `TWINS` list, with `basedOn: "measuring-volume"` and no `practiceId`: it is a twin only, with no practice version. Pack 1's original (place, one pour to the volume, record the cylinder's volume) stays in `public/techniques/` for 2D and for Pack 1 in 3D. The twin's five steps:

| # | Step | Atom | What the student does |
|---|---|---|---|
| 1 | Stand the cylinder | `atom.place.variable-volume-device` | Brings the 100 mL cylinder from the tray to the bench. |
| 2 | Pour to below the line | `atom.transfer.fill-below-graduation` (new) | Pours from the sample bottle. The runtime pours `pourVolumeMl`, 1 mL under the line. |
| 3 | Fill the dropping pipette | `atom.transfer.draw-into-transfer-pipette` | Draws from "Sample for the dropper", a 150 mL beaker holding 10 mL. A pipette draws from an open vessel, never the bottle (2026-09-26). |
| 4 | Add drops to the line | `atom.transfer.dropwise-to-graduation` (new) | Holds the pipette over the cylinder at eye level with the line: One drop, Hold to run, then At the line. Judged within 0.2 mL. |
| 5 | Read the volume | none (a record step, as in every practice version) | Reads at eye level and types the volume to 0.1 mL. It is recorded as typed and never checked (2026-09-25). |

**Two atoms.** This is a core registry change, made by your decision: `src/domain/atomRegistry.json` now has 244 atoms, and `docs/atomic-steps.md` is regenerated. `atom.dilute.dropwise-to-mark` needs a final-volume vessel (a flask's mark), but a cylinder is a variable-volume device, so the cylinder needed atoms of its own:
- `fill-below-graduation`: pour to just below the graduation; no volume is read.
- `dropwise-to-graduation`: finish drop by drop; the level is judged within the graduation's reading tolerance, then read.

No dated plan states these steps, so neither atom cites a source example. Their constraint text records the basis: your decision.

**Tolerance.** A 0.05 mL drop lifts the meniscus about 0.09 mm in the 100 mL cylinder (inner radius 13.4 mm). At the drop mode's 0.2 m that is under half a pixel, so judging to one drop would ask for a level the student cannot see. `markToleranceMl` is 0.2, a fifth of the cylinder's 1 mL division. The setup's first rule (the 250 mL flask) adds the 0.2 mL.

**Setup offset.** `sampleVolumeMl` fills two slots:
- `targetVolumeMl`, the line;
- `pourVolumeMl`, the line less 1 mL, through `setup("sampleVolumeMl", -1)`.

The index keeps the offset on the target, and the loader applies it rounded to 1e-6 (`common.mjs`, `composeLab.mjs`, `labs3dSetup.ts`). The field's help reads "The line the student fills the 100 mL cylinder to: poured to 1 mL below it, then drop by drop."

**Transfer pours all the cylinder holds** (`transfer-practice` and `transfer-3d`; `transferVolumeMl` is dropped from the twin). Before, it poured the configured volume. A level accepted at 20.15 mL would then have left 0.15 mL in the cylinder, and a level accepted at 19.9 mL would have been refused at the pour.

**Short part titles.** In `composeLab.mjs`, a part has its own `title`, and the index keeps the technique's as `techniqueTitle`. The four parts are "Measure the sample", "Transfer the sample", "Precipitate the calcium" and "Filter the precipitate". The step card's eyebrow and the intro's headings use them.

**The bench has 15 items.** Two are new: `sample-portion-1` ("Sample for the dropper") and `sample-pipette-1` ("Dropping pipette (sample)"). The carbonate pipette is renamed "Dropping pipette (carbonate)", so the bench list tells the two apart.

### Fidelity review

**Fixed, in 3D:**
1. **Compiled step text kept `{{config.*}}`.** The composition compiler binds configuration in the parameters but not in a node's text. Two step cards were affected:
   - the new pour step would read "just below the {{config.targetVolumeMl}} mL line";
   - E3's step 11 already read "Pour a third of the {{config.reagentVolumeMl}} mL…". It shipped in E3, and its look logged titles only.

   `labs3d.ts` `fillStepText` now fills each node's title and description from its part's configured values. `probe-lab3d.mts` lists what the compiler leaves. Test: no `{{` in any step, with the defaults and with the teacher's values (50 mL and 30 mL).
2. **The pour's callout gave the amount** ("Release to pour 19 mL from the sample bottle…"). The student pours by eye to just below the line, so the step carries its own label: "Release to pour the sample to just below the line". Transfer's callout had become "pour the requested volume" and now reads "pour the sample into the beaker".
3. **The reading step framed the whole bench,** too far away to read a meniscus. `stepRules.readingVesselId` names the vessel a reading step reads: a record step taking the student's reading of a measurement made on a vessel. The auto view then puts the eye level with its liquid (`BenchEngine.eyeLevel`, 0.2 m). Other record steps, such as the balance's mass, are unaffected, and a view the student set is kept.
4. **The level's interim value was chipped "Your entry"** before the student had read anything. The level step records the line under the reading's id, and the chip took the first action naming that id, which was the reading. `measurementProvenance` now takes the step that wrote the value (`MeasurementRecord.nodeId`):
   - a level judged at a line bound to setup is a teacher setting;
   - the reading that replaces it is "Your entry".
5. **Notebook rows read "20 mL" beside the measurement's "20.0 mL".** A notebook row that records a measurement now reads as the measurement does (`panels.tsx` `entryValue`), as long as the two agree.

**Left for you (core):**

6. **The overshoot message.** Once the level is more than 0.2 mL past the line, "At the line" is refused for good, with "The meniscus is past the line." and "In the lab this solution would be remade. Restart the technique, and stop adding when the bottom of the meniscus touches the line." (`src/runtime/reducer.ts`, `executeMarkDispense`). That is right for a volumetric flask. For a cylinder it is wrong: the excess is drawn back out with the pipette, and in a lab "restart" means the whole 33-step run. The options:
   - (a) leave it;
   - (b) a message for a graduation, a core string;
   - (c) let the pipette draw the excess back at a graduation, core behaviour with a new atom.

   (c) is what a student would do; (b) is the smallest change.

   **Decided and built the same day:** (c), in the 25 mL cylinder ("Draw-back and the 25 mL cylinder", below).

**Checked and found right:**
- The reading is recorded as typed: 20.1 mL with the line at 20 mL (test).
- The pipette draws from the small beaker, never from the bottle.
- The flask receives what the cylinder held: 72.2 mL with three drops over the line (test).
- A 5 mL sample plays through. So does a 100 mL sample with four drops over: 100.2 mL in the cylinder, then 152.25 mL in the flask.
- The reading step has no atom, like every practice version's record steps.
- The level step's "accept" finishes the step, judged by its recorded measurement, never by `actionEvidence`.
- 2D is untouched: `public/labs/`, `public/techniques/`, `src/player/**` and `src/styles/app.css`.

### Checks

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 0 errors |
| `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` | 24 files, 251 tests pass |
| `npm run content:check` | 22 violations, equal to the baseline (exit 1, as on main) |
| `node scripts/practice3d/build.mjs --check` | 0 |
| `probes/probe-lab3d.mts` | 33/33 with the defaults (72.05 mL in the flask). With `PROBE_DROPS_OFF` ±3 the level is accepted (72.2 and 71.9 mL); at +5 it is refused as past the line, at −5 as not yet at it. A 20.3 mL sample gives 33/33 and records 20.3 mL. 5 mL and 100 mL (+4 drops) give 33/33. |

`lab3d.test.ts` gains or changes these cases:
- four twins, one with no practice version;
- the twin's five steps and their atoms;
- `transferVolumeMl` dropped;
- short titles, with the technique titles kept;
- 33 steps on 15 items, parts of 5, 4, 11 and 13;
- the pour 1 mL under the line (19, and 49 for a 50 mL sample);
- step text filled;
- the level's tolerance both ways;
- the reading as typed;
- the chips for the level and for the reading;
- the reading's vessel.

Three files outside `src/studio3d`, which the policy's run does not cover, fail without any change of ours:
- `techniqueConfiguration.test.ts`: paper chromatography's slots;
- `atomRegistry.test.ts`: a `sample-bottle-1l` binding; it fails the same way with the committed registry;
- `bundles.test.ts`: a harness URL error.

### G1 look

One headless look (`probes/look-lab3d.cjs`, Playwright with SwiftShader at 1280 × 800), by keyboard carries, the drop panel and the step card, with the setup's defaults:
- **Intro:** "Before you start · 4 parts, 33 steps", headed "Part 1 · Measure the sample", "Part 2 · Transfer the sample", "Part 3 · Precipitate the calcium" and "Part 4 · Filter the precipitate". Part 1 shows four of its steps and "and 1 more".
- **Eyebrows:** "Part 1 of 4 · Measure the sample · Step 1 of 33" takes two lines; Part 2 begins at step 6, Part 3 at step 10 and Part 4 at step 21.
- **Part 1:**
  - The pour's callout reads "Release to pour the sample to just below the line".
  - The pipette's reads "Release to draw up from the sample for the dropper"; held over the cylinder, it opens the drop panel.
  - Twenty "One drop"s, then "At the line": "The bottom of the meniscus is on the line."
  - At "Read the volume" the auto view stands with the eye level with the cylinder's 20 mL line (screenshot `2d`).
  - Before the reading, the notebook's "Sample volume" reads 20.0 mL, "Teacher setting". After 20.0 is typed and recorded, both rows read 20.0 mL, "Your entry".
- **Part 2:** "Release to pour the sample into the beaker", then the cylinder rinsed with three squirts.
- **Run:** 33 of 33, "Precipitate and Filter Calcium Carbonate · complete", with no page errors. The filter takes seven pours. The results list "Sample volume 20.0 mL, Your entry" first; a scan with the results, the notebook and the bench list open found no number with five or more decimals.
- **The look's own fixes (tooling only):**
  - The first full run stopped at step 33. Under SwiftShader, with the tests running alongside, a squirt's Rinse button stayed disabled past the look's two fixed clicks. The look now clicks Rinse until the step moves on.
  - The second run stopped at step 8 on that helper's own error: a function sent into the page lost its patterns. They now go in as their sources.
  - The third run finished.

## Draw-back and the 25 mL cylinder (2026-10-10)

Your decisions, the same day: "Go with (c), the pipette draw-back." Then, asked about the pipette's reach, "25 mL cylinder (Recommended)". They answer review item 6 above. `DECISIONS.md`, the D8 row, records them as (9). Where this section differs from the one above (the 100 mL cylinder, the tolerance's figures, the field's help), it replaces it.

### The reach

The dropping pipette is 154 mm long, its bulb 108 to 154 mm from the tip. In the 100 mL cylinder (rim 212 mm, bore 26.8 mm) a 20 mL level is 166 mm below the rim, out of the tip's reach. A lab measures 20 mL in the smallest cylinder that holds it, the 25 mL one (rim 150 mm, bore 18.4 mm): there a 20 mL level is 65 mm below the rim and a 5 mL level 122 mm. The bulb, 15 mm across, fits the bore, so even at 5 mL the tip reaches the liquid while the bulb is squeezed at the rim.

### What was built

**Runtime (core, by your decision):**
- A drop-to-the-line step at a target's graduation can be marked `markDrawBack` (`src/runtime/reducer.ts`, `executeMarkDispense`). The runtime reads it from the step as authored, never from the request. There an overshoot is not kept: "At the line" judges the level as it stands. Refused past the line, the student reads "Draw the excess back up into the pipette, then bring the level back to the line a drop at a time."
- `dispenseDrawBackIntent` (`src/runtime/interactionIntents.ts`, `dispenseMode: "drawBack"`) moves a drop's worth, or a run (`dropCount`, at most 40), from the vessel back into the pipette, as far as the pipette has room, with the liquid's content conserved. It is refused on any other step ("Nothing is drawn back at this step.") and when the pipette is full. Like a drop, it is progress within the step, with no "try again".
- `MarkDispenseRecord.deliveredMl` is net of what was drawn back.
- A flask's mark and a graduated pipette's line are unchanged: past them is still final, with the original message (test).

**Registries (core, by your decision):**
- `atom.transfer.dropwise-to-graduation` gains two procedural constraints, the draw-back and the smallest cylinder. It is not a new atom. In a lab, drawing back is part of bringing the level to the line: the same step, with the same pipette. My report before your decision called it a new step; folding it in keeps the step as the student does it.
- `rinsed-vessel` allows `graduated-cylinder-25ml`, which Transfer's twin rinses.
- `docs/atomic-steps.md` is regenerated.

**Content:**
- The twin and the lab use the 25 mL cylinder. The bench item reads "25 mL graduated cylinder", and the first step "Stand the clean, dry 25 mL graduated cylinder upright on the bench."
- The drops step adds "If it goes past, draw the excess back up with the pipette."
- `twinOf` gains `swapEquipment`. Transfer's twin pours from the 25 mL cylinder; `transfer-practice` keeps the 100 mL one, and its file is unchanged.
- The sample volume is set from 5 to 25 mL (was 5 to 100), default 20. The help reads "The line the student fills the 25 mL cylinder to: poured to 1 mL below it, then drop by drop."
- The setup's flask rule can no longer be broken within the bounds (25 mL, 140 mL and the rinses fit in 250 mL). It stays as a guard; a test shows it still names the problem under a lower limit.
- The tolerance stays 0.2 mL. In the 25 mL cylinder a drop lifts the meniscus about 0.19 mm, about a pixel at the drop view; 0.2 mL is 0.75 mm, about 4 px, under half the 0.5 mL division.

**3D:**
- `MarkStep.drawBack` (`sceneToIntent.ts`) and `usePlayer3D`'s `drawBack`.
- The drop panel's **Draw back** (`DropPanel.tsx`) is there at every such step, past the line or not, so it never tells where the level is. A tap is a drop's worth. A press held 300 ms runs, three drops' worth every 140 ms, until it is let go or the pipette is full (`usePlayer3D`'s `drawBack` says whether it can take more). Space or Enter does the same while it has focus. Hand control's grip over it is a tap (`data-hand-press="draw-back"`). The panel's help, the hint line and the hand guide name it at such steps only.
- **The dip** (`BenchEngine.dipHeld`). The held pipette's tip goes 3 mm under the surface over 0.22 s, never closer than 2 mm to the floor. It follows the level down as it is drawn back, and rises over the line 0.45 s after a tap's draw (0.3 s after a run). The runtime is asked only once the tip is in, since `dipHeld` resolves on arrival. Putting the pipette down cancels a dip still on its way. Under reduced motion the pose is set at once. While it is held over the vessel, the pipette has no beacon or selection ring (`BenchEngine.ringAt`).

### Fidelity review

**Fixed:**
1. **The dip was timed by the clock.** In the first look, under SwiftShader's slow frames, the screenshot caught the tip still on its way down when the draw-back was due. `dipHeld` now resolves when the tip arrives, and the draw-back waits for it.
2. **A draw-back showed "Review Add drops to the line and try again."** That is the runtime's retry feedback, which a drop is spared. A draw-back is now spared too: a core line, part of the behaviour you decided (test).
3. **The atom said the bulb is squeezed above the liquid.** With sample in the pipette, a firm squeeze there would add liquid. When the bulb is released after a drop, it draws a little air into the tip. The constraint now says the bulb is squeezed gently, only enough to push that air out, before the tip goes in. A tap's single drop's worth matches that small stroke.
4. **The atom said the bulb stays above the rim.** At 5 mL it is partly inside the bore. It now reads "at or above the rim".
5. **A draw-back limited by the pipette's room said "40 drops' worth drawn back."** It now says "Drawn back until the Dropping pipette is full." (test).
6. **A band across the drop view after the first dip** (G1 look). The guidance beacon follows the pipette's root, its tip. With the tip at the surface it lay at eye level, and the pipette's footprint is its length on the bench, so the ring was about 8 cm across the vessel, seen edge-on. It stayed after the lift, as rings are placed at each sync. A pipette held over a vessel is in the hand, so it now has no beacon or selection ring; the sync puts them back when it is put down. Before the dip the same ring floated at the rim, out of the drop view.
7. **A held Draw back went on past a full pipette.** Each request after that was refused and recorded as an attempt ("The Dropping pipette (sample) is full."). A run now ends by itself once the pipette is full and lifts the pipette. A tap on a full pipette is still refused, as One drop is on an empty one.

**Not drawn:** the bulb is not shown squeezing. The dip, the falling level and the pipette's rising fill show the draw-back.

**Checked and found right:**
- The flask still receives what the cylinder held: 72.05 mL after ten drops over and ten back, and 71.85 mL after fourteen back, 0.2 mL under (tests).
- Five back from ten over (0.25 mL over) is refused as past the line, and sixteen back (0.3 mL under) as not yet at it (tests).
- What was drawn back is in the pipette again (test).
- 2D is untouched: `public/labs/`, `public/techniques/`, `src/player/**` and `src/styles/app.css`.

### Checks

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | 0 errors |
| `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d src/runtime/__tests__/markDispense.test.ts src/runtime/__tests__/makingSolution.test.ts` | 26 files, 277 tests pass |
| `src/domain/__tests__/atomRegistry.test.ts` | 33 of 34 pass; the one failure is the `sample-bottle-1l` binding listed above, unchanged |
| `npm run content:check` | 22 violations, equal to the baseline (exit 1, as on main) |
| `node scripts/practice3d/build.mjs --check` | 0 |
| `probes/probe-lab3d.mts` | 33/33 with the defaults (72.05 mL in the flask). Ten drops over, then: ten back is accepted (72.05 mL); fourteen back is accepted 0.2 mL under (71.85 mL); five back is refused as past the line, sixteen back as not yet at it. Twenty over and twenty back (two requests) is accepted. A 25 mL sample gives 33/33 (77.05 mL), a 5 mL sample 33/33 (57.05 mL), and 26 mL is refused: "Sample volume must be at most 25 mL." |

### G1 look

`look-lab3d.cjs`, headless Chromium with SwiftShader, at 1280 × 800:
- **Run:** 33 of 33, "Precipitate and Filter Calcium Carbonate · complete", with no page errors. A scan with the results, the notebook and the bench list open found no number with five or more decimals.
- **Part 1:** Draw back is on the drop panel before any overshoot. Twenty-eight drops, then "At the line", is refused: "The meniscus is past the line. Draw the excess back up into the pipette, then bring the level back to the line a drop at a time. Recorded as an attempt." Eight drops' worth drawn back by taps brings the meniscus to the 20 mL line, with no retry message. "At the line" is accepted, and the reading, typed 20.0, is chipped "Your entry".
- **The dip:** one shot catches the tip just under the surface. That run's shots after the dip showed fix 6's band, and the rerun of part 1 has none.
- **A held Draw back** (a short look of part 1 only): held, the tip is under the surface. Let go after the pipette is full, the run has stopped by itself, the pipette is lifted, the level is under the line, and there is no correction (fix 7).
- **Tooling:** a function the look sends to the page must not use the look's own names; the draw-back tap is installed as a page helper (`window.__drawBack`).

## For later

- **Drying and `hard-water-demo`.** Compiled measurement ids are scoped by instance (`filtration--filter-paper-mass`). Drying's twin will need its calculation to find Filtration's paper mass across parts: `preserveIds.references` on that instance, or an explicit binding. Decide it when the Drying twin is built.
- **Float noise.** The runtime leaves the working portion at 28.999999999899995 mL and the flask at 72.0500000001 mL after the run. Nothing throws (the stage 1 fix covers the filter), and the G1 look's scan found no long numbers on screen.
