# Pack 3a: evidence (2026-10-10 to 2026-10-11, with the fidelity review)

Your request: "Implement the plan here: …PACK3A_BUILD_PROMPT.md". The prompt builds what `proposals/PACK3_ATOMIZATION.md` (revision 3, decisions 1–12) decided for 3a:
- Calculate Hardness;
- Dry and Weigh's twin;
- Pack 2's balance at 0.0001 g;
- `hard-water-demo` in 3D;
- lab steps in 3D labs;
- Paper Chromatography, with its models and its lab.

Brass (3b) was not started.

This note lists:
- what was built, step by step;
- the checks and the browser looks;
- the interpretations made in the build;
- the fidelity review of what was built;
- what was not seen.

Every choice put to you during the build was answered with the recommended option. They are recorded in `DECISIONS.md`: the "Pack 3a build interpretations", "Pack 3a step 4" and "Pack 3a step 5" rows, and the "Pack 3a built" row.

## What was built

All five steps are committed locally on `claude/lab-studio-3d`. Nothing is pushed or published.

**Step 1: Determine Water Hardness in 3D** (`5123159`).
- **Calculate Hardness's practice version** (`hard-water-calculation-practice`, listed with `pack: 3`) has six steps:
  1. note the sample's volume;
  2. note the watch glass's mass;
  3. note the paper's mass;
  4. note the dry assembly's mass;
  5. work out the precipitate's mass by difference;
  6. calculate the hardness.

  The student enters the hardness, and the step refuses an entry more than 0.5 mg/L off. Its twin is `hard-water-calculation-3d`.
- **Dry and Weigh's twin** (`drying-3d`) takes the paper mass's record id as a slot, so it reads Filtration's weighing.
- **Pack 2's analytical-balance weighings** read to 0.0001 g (decision 9).
- **`hard-water-demo`** composes six parts in the 2D lab's order: measure, transfer, precipitate, filter, dry and weigh, calculate. It compiles to 59 steps on 21 items and plays to 375 mg/L with the defaults. The teacher's values carry into the hardness: 0.0150 g in 25 mL gives 600 mg/L.

**Step 2: Lab steps between parts** (`35b0919`).
- `composeLab.mjs` takes groups of lab steps (`labRecord`, `labCalculation`, `labApproval` in `common.mjs`). Each group is placed before the first part or after a named part, and connected into and out of the parts. Each step's effect names the parts' scoped ids.
- The index lists each group among the parts, so the step card labels a lab step by its group. The 3D loader numbers the compiled nodes in run order.
- Proved on a fixture of two parts (`__tests__/labSteps.test.ts`): a record, a calculation on the first part's reading and an approval, then the second part. A group naming a missing part is refused.

**Step 3: The chromatography models** (`2889a75`). Eight models, each named by its definition and built with the refined library. The pack measured 692,836 bytes, under 4 MB; every item is under 250,000 bytes.
- The chamber, with its lid and hook in three poses and a blank label tape.
- The strip: 110 mm, with a `stripFace` for the marks the viewer draws.
- The capillary: the real 1 mm bore tube, a transient fill (decided).
- The pencil.
- The clear 15 cm ruler, with a `scaleMm` giving its zero.
- The distilled-water and 2-propanol bottles.
- The waste beaker.

The registry gains `stripFace`, `scaleMm` and `liftedWithLidMm`. `validate_equipment3d.py --pack 3` passes on the listed practice version's bench. The 2-propanol bottle and the waste beaker were checked against the same rules by hand.

**Step 4: Paper Chromatography's practice version and twins** (`c22a503`).
- **One module, three outputs** (`scripts/practice3d/paperChromatographyPractice.mjs`):
  - `paper-chromatography-practice` (water, listed with `pack: 3`);
  - `paper-chromatography-water-3d`, 31 steps;
  - `paper-chromatography-propanol-3d`, 33 steps.
- **The steps, for water:**
  1. place the chamber;
  2. label it;
  3. measure the solvent;
  4. pour it in;
  5. lay the strip flat;
  6. draw the baseline;
  7. fill the capillary;
  8. spot 1 of 3;
  9. let it dry;
  10. spot 2 of 3;
  11. let it dry;
  12. spot 3 of 3;
  13. let it dry;
  14. hang the strip from the hook;
  15. lower the strip and seat the lid;
  16. let the solvent rise;
  17. lift the lid with the strip;
  18. unhook the strip and lay it flat;
  19. mark the front;
  20. let the strip dry;
  21. identify the bands;
  22. lay the ruler along the strip;
  23. read the front;
  24. record it;
  25. read the purple overlap band;
  26. record it;
  27. read the yellow band;
  28. record it;
  29. calculate each band's Rf;
  30. record the separation;
  31. pour the water into the sink-waste beaker.

  2-Propanol reads three bands (blue, red, yellow) and pours into the organic-waste beaker.
- **The new atom:** `atom.observe.label-developing-chamber` (decision 12), used by no 2D technique. `docs/atomic-steps.md` was regenerated.
- **No new bench operation:** the steps use the runtime's `chromatographyOperation` and `chamberOperation`.
- **Rf** keeps its legacy calculation with `requireRecordedMeasurements: true`. The ruler readings use `requireStudentValue`, judged within 0.5 mm.
- **3D presentation** (`stripMarks.ts`, `runtimeToScene.ts`, `BenchEngine.ts`, `Player3D.tsx`):
  - the pencil's baseline, the spot, the rising front, the bands and the front mark, all drawn from the runtime's state (G-3);
  - the tape's pencil label;
  - the lid closed, held up with the strip on its hook, or set aside;
  - the ruler laid beside the flat strip, its zero on the baseline (`alignWithInstanceId`);
  - the step clock extended to the chromatography operations (`sceneToIntent.ts`);
  - the step card performs each pencil, drying, lid and development step (`stepRules.ts`'s `typedNotebookOperation`);
  - a capillary hint.
- **The solvent depth** is worked out from the volume and the chamber's fill profile (`prepared3d.ts`, 3D only), and is never asked.

**Step 5: The Paper Chromatography lab** (`fe817ec`).
- **The lab** is `paper-chromatography` (`scripts/practice3d/labs/paperChromatography.mjs`). It has six parts and plays 81 steps:

  | Part | Steps |
  |---|---|
  | Safety and prelab | 3 |
  | Plan the trials | 6, ending with the teacher's approval |
  | Water trial | 31 |
  | 2-Propanol trial | 33 |
  | Compare and explain | 5 |
  | Conclude | 3 |

- **Its 17 lab steps** are the 2D lab's 15, with their ids, plus Prelab Part I's capillary demonstration and questions and the Postlab Assessment (revision 3). The proposal said about 18.
- **Bench:** 13 items. The cylinder, pencil, capillary, dye vial and ruler are shared by both trials. Each trial has its own chamber, strip, solvent bottle and waste beaker.
- **The setup page** has 13 fields:
  - the solvent volume, the baseline, the capillary's load, each touch, the three clocks;
  - the front;
  - the five band centres.

  Its rules refuse:
  - a front and baseline over 100 mm on the 110 mm strip;
  - three touches that need more dye than the capillary draws;
  - any band less than 1 mm below the front;
  - a volume that misses the strip or covers the baseline.
- **The prepared Rf** (decided: "3D transform in labs3d.ts"). `labs3dSetup.ts` gains a model target. `prepared3d.ts` works out each trial's solvent depth and each band's expected Rf (band ÷ front), and stops each development at the teacher's front (`withLabStopDistances`).
- **The twins** declare a model slot each (`composition.modelSlots`), which the lab binds to its own models. `composeLab.mjs` refuses an unbound slot.
- **The trials' readings keep their ids** (`preserveIds.references`), so the runtime's Rf finds them.

## Checks

Run on the final tree (`fe817ec`):
- **`npx tsc -p tsconfig.app.json --noEmit`:** clean.
- **`npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d`:** 26 files, 285 tests passed.
- **`npm run content:check`:** exits 1 with "baseline: 22 new, 0 changed fingerprint", the expected baseline. The build adds no finding beyond it.
- **`python tools/blender/validate_equipment3d.py --pack 3`:** PASS, 12 definitions, 0 failures, 692,836 bytes.
- **`node scripts/practice3d/build.mjs --check`:** clean.
- **2D unchanged:** nothing under `src/player/**`, `src/styles/app.css`, `public/techniques/` or `public/labs/` changed, and the 2D generators are untouched.

The tests that prove the build:
- **`pack3Practice.test.ts`:**
  - Calculate Hardness: six steps; 375 and 600 mg/L; refuses an entry over 0.5 mg/L off.
  - Chromatography: 31 and 33 steps; no new bench operation; the atom used by no 2D technique.
  - Each Rf from the recorded readings; the 2-propanol trial into the organic waste.
  - A reading over 0.5 mm off refused.
  - The step card's operations; the ruler's alignment.
- **`labSteps.test.ts`:** lab steps before, between and after parts.
- **`lab3d.test.ts`:**
  - `hard-water-demo` plays 59 steps to 375 mg/L.
  - `paper-chromatography` compiles to 81 steps and plays them with each Rf.
  - The teacher's values carry into the run: a 70 mm front stops both developments at 70 mm and gives water's expected Rf 0.7143 and 0.8714. The practice version's 80 mm readings are then refused, and 5 mL stands deeper than 4 mL.
  - The setup page refuses bad values.

## Browser looks (G1)

Headless Chromium with SwiftShader at 1024 × 700, driven through the step card (a Playwright script modelled on `probes/look-*.cjs`). One look per change:
- **Step 1:** `#/3d/play/hard-water-demo` opened in the app's pane. The full 59-step run is proved by the test, not in the browser.
- **Step 2:** a temporary fixture lab (two of `intro-filtration-demo`'s parts, with a record, a calculation and an approval between them) was written, looked at in the app, then removed. The lab steps were labelled by their group on the step card.
- **Step 3:** the eight models' review renders (`tools/blender/.build/review/`) and the ruler's thumbnail. They were then seen on the bench in step 4's play.
- **Step 4:** `#/3d/paper-chromatography-practice` played 31 of 31 to the results. Seen on the bench:
  - the tape reading "Water";
  - the baseline and the spot;
  - the closed chamber with its "Developing" clock, and the lid step held until it ends;
  - the bands on the lifted strip (the front and bands climb with the clock's progress, but at this size the climb
    could not be made out inside the closed chamber);
  - the lid raised with the strip (15 mm, subtle);
  - the ruler laid beside the flat strip.

  The pencil, lid and develop buttons had been disabled on the step card; this was fixed (`stepRules.ts`) and is covered by a test.
- **Step 5:** `#/3d/play/paper-chromatography`. The intro, then the setup page with its 13 fields, then all 81 steps to "Paper Chromatography · complete", with no console errors. Two things looked wrong in screenshots and were checked:
  - The flat 2-propanol strip seemed to lie on the organic-waste beaker. The scene's positions show the two apart: the strip at (236, −19) mm, the beaker at (259, −141) mm. A later shot confirms it.
  - A chamber seemed to lie on its side over the organic waste after "Pour the 2-propanol into the waste". The shot was taken 4 s after the click, during the pour animation; two steps later both chambers stand upright, their lids aside.

## Fidelity review (2026-10-11)

What was built was checked against the proposal's Paper Chromatography sequence, its "The lab" list, and decisions 1–12.

**As decided, but different from the proposal's text** (each answered in line):
1. **Place, then label.** The proposal's step 1 labels the chamber, then places it; the build places it first. A tape is written on a container standing on the bench.
2. **The lid and the hook are two steps.** The proposal's step 17, "Lift the lid with the strip out, and unhook the strip", became "Lift the lid with the strip" and "Unhook the strip and lay it flat". So water has 31 steps, not 30, and 2-propanol 33, not 32.
3. **Water is poured into a "Sink waste" beaker** (`wasteStream: sink`), as 2D does, not down a modelled sink. Adding `lab-sink` to the waste role was refused by `content:check` and the catalogue policy. S-03's point (water may go down the drain; 2-propanol may not) is kept by the two labelled beakers and their waste streams.
4. **The capillary.** The "Pack 3a build interpretations" row (a) says the practice version spots 0.01 mL three times. Step 4 settled on a 0.03 mL load and 0.005 mL touches, so three touches leave half the load. Row (a)'s figure is out of date; the step 4 row has the built values.

**Found, not fixed** (recorded for you):
5. **No tile under the strip.** The proposal's bench has "a fresh paper strip on a clean tile". The strip lies on the bench top. A tile would be a new equipment item, which the build was not to add.
6. **Bench items move between steps in the lab.** Items without a set position take 2D's default grid slot by their index among the items on the bench (`resolveWorkbenchScene`, shared code). So when an item leaves the tray, the items after it shift. For example, the sink-waste beaker stands at three different places during the water trial. Nothing overlaps, but a student sees items jump. It is M3's known limit ("drawn as the runtime has it, never moved"), now visible because the lab has 13 items. A 3D-only layout (fixed slots for a lab's bench) would be a change to propose.
7. **The glass draw-order issue** (model refinement, item 9) shows on the chamber and the bottles: glass writes no depth, so which surface shows depends on triangle order. Noted only, as the prompt says; it is for the polish pass.
8. **"Lifting the lid early is refused"** (the proposal's step 16) is not a refusal. Lifting early is impossible by order: the step clock holds the next step until development ends ("The next step waits for it"), and the lid step follows it. A shot at 3:27 of 10:00 shows the "Lift the lid" button disabled.
9. **The develop step's text** no longer names 80 mm, because the lab's teacher can change the stop distance. The practice version still stops at 80 mm. The second review reworded it (below).
10. **HP-05.** The bench always holds water and 2-propanol, a departure the proposal already marks **T**. The student still records a choice and its reasons ("Give a reason for each solvent").

**Guardrails** (as `UI_UX_HANDOFF.md` defines them; the first review's list had them wrong and was corrected in the second):
- **G-1, instruments are measurement-neutral:** the ruler shows only its scale, never a reading. The student reads the front and each band.
- **G-3, the resting scene equals the runtime state:** the tape, the baseline, the spot, the front, the bands, the front mark, the lid and the strip on its hook are all drawn from the runtime's state. The ruler lies along the strip only once the runtime has aligned it (`alignWithInstanceId`).
- **G-8, physical plausibility never creates runtime objects:** the two waste beakers are runtime items, placed by steps. No scenery was added. A tile under the strip could be scenery (item 5).
- **G-9, one liquid palette:** the solvents and the dye mixture come from `resolveLiquidStyle`. Since the second review the spot does too. The bands are dyes on paper, coloured by the chromatography model.
- **G-11, no sound:** none was added.
- **Faint visuals:** the bands and spot are drawn a little stronger than real dyes.

## Second fidelity review (2026-10-11)

You confirmed the step 5 interpretations as built ("Confirm the step 5 interpretations as built."). The whole session's work was then reviewed again for fidelity, and refined:
- **The spot's colour.** The spot was a fixed dark purple. It now takes the spotted liquid's colour from the one palette (G-9): the capillary's own contents, or the liquid it last drew up. The dark purple stays only as a fallback. A test checks the spot against the vial's palette colour, and the practice version was seen again with a blue spot on the baseline.
- **The capillary's limits.** The registry's capillary holds 0.059 mL (1 mm bore × 75 mm). The lab's load field allowed 0.06 mL; its maximum is now 0.05 mL, and its help names the 0.059 mL. The practice version had no such check. Its setup now refuses a load over the tube's capacity, or touches that need more than the load (three touches × the spot volume), naming the value to change. Both are tested.
- **The develop step's text** now reads "Leave the closed chamber undisturbed while the solvent climbs the strip, until its front reaches the stop distance." TR-08 calls for the approved stop condition.
- **The lab's texts, against the source and 2D's lab:**
  - **Safety:** goggles at all times; washing skin and the teacher's handling rules; 2-propanol is flammable; each chamber stays closed while it develops; the waste streams.
  - **Prelab Part I:** the teacher's demonstration of water creeping up paper, then the manual's questions 1 to 3, including baking powder's three parts.
  - **The structures review:** adds dipole-dipole attractions, and that structures are "evidence for a prediction, not a result".
  - **The procedure:** adds the strip's size, the baseline, the solvent's volume and depth, the spotting, the stop distance, and a fresh strip and fresh solvent for each trial.
  - **The data table:** adds the reason for each solvent, the settings, overlap and streaking, and notes.
  - **The approval:** checks that another student could repeat the procedure "without inventing a step".
  - **The analysis:** adds temperature to what an Rf depends on, and the structures and phases to the explanation. The drawing gains its terms, and the green-chemistry question names the 2011 GSK guide as a historical reference. The limits gain the solvent's composition and the Rf-identity note, and the postlab asks about pyridine and benzene as the manual does.
- **This record:** the guardrail list, item 8 and the step 4 look were corrected to match what was built and seen.

Found in the second review, not fixed (recorded for you):
11. **The lab's tray covers its step card at 1024 × 700.** The tray is anchored bottom-left and grows with its items. The lab has 11, so the tray reaches up over the lower half of the step card, even on short steps. The student can collapse or move either panel (handoff §5.1). A tray height limit or docking would be a shared 3D player change.
12. **The dye mixture is drawn blue.** Its contents use the shared palette state `blue-dye-solution` for a mixture of three dyes. Its own palette entry would be a shared change.

## Follow-ups (2026-10-11)

Your five points, answered in line ("Yes, all 3D (Recommended)", "Mixture colour, 3D only (Recommended)", "Slide the
bench (Recommended)", and for the tray an evaluation of a shelf over the bench). Items 11 and 12 above are settled by
them: 12 by the dye's own palette state, and 11 waits on the tray decision.

| Point | Built | Commit | Look (G1, 1024 × 700) |
|---|---|---|---|
| 4. The dye | The mixture is drawn dark brown-violet, through `food-dye-mixture` (3D content only; 2D keeps `blue-dye-solution`). | `d240373` | The practice's vial is dark brown-violet on the bench. |
| 5. The slide | A left-drag on empty bench slides the bench toward or away from you, over a wider range; the help lists it, and Home resets the view. | `fb11986` | Left-drags up, down and further down on empty bench, each sliding the view. |
| 2. The layout | Each item keeps one slot for the whole run (`stableBench.ts`); a student's own move wins. | `da07078` | Tray items placed with Enter land in their slots; the lab played to step 26 with no error. |
| 1. The tile | `white-tile` (D9 scenery, 150 × 150 × 6 mm) under a strip lying on the bench, with the ruler on it; left where the strip lay while the strip hangs. | this follow-up | Practice, after step 14 (hang the strip): the empty tile while the strip hangs; step 24: the strip and the ruler on the tile. Lab, after step 45: both strips on their own tiles, 257 mm apart; after step 55: the 2-propanol tile empty while its strip hangs. |
| 3. The tray | Not built: `proposals/SHELF_INSTEAD_OF_TRAY.md`. | — | — |

**The tile's colour.** The first colour, 0.74 grey-white, left the paper only 12 levels brighter than the tile in the
look, so white on white. It is now 0.64, a cool, glossy white; the paper reads 16 to 19 levels brighter, and the
tile still reads white under the room's lights.

**Found at these looks and fixed (3D only):**
1. **The 2-propanol strip in the water chamber.**
   - What was seen: while its own chamber was closed and opened (lab steps 55 and 57), the scene placed the strip in
     the water chamber.
   - The cause, in the runtime: on every action `withResolvedAttachments` merges in a relation derived from the
     strip's snap zone. `deriveLegacyAttachments` names the first instance of the zone's parent definition, which is
     the water chamber, even when the strip already holds its own relation. The scene took the last one listed.
   - The fix: the scene now keeps each child's first relation, its own (`adapters/heldRelations.ts`). The chamber's
     "strip hung" state and the balance's load use the same rule.
   - Tested in `adapters.test.ts` with two chambers. A probe through the lab's 81 steps showed the strip in the
     2-propanol chamber at steps 54 to 57.
   - Not changed: the runtime itself (shared). Whether 2D draws the same is not checked; a shared fix would need your
     decision.
2. **The beacon and framing on the water strip.**
   - What was seen: the guided beacon and the step's framing took the first item of a kind on the bench. So the
     2-propanol trial's steps marked the water strip and chamber, and the framing took in both strips and both
     chambers.
   - The fix: the step flow's endpoints now carry the instance the step names, or the student's own choice
     (`stepRules.ts`, `Endpoint.instanceId`). The beacon and the framing follow it when it is on the bench.
   - Tested in `lab3d.test.ts`. In the look after step 45 the beacon is on the new strip; at step 48 it is on the
     capillary. After step 55, once the bench settles, the step frames the labelled 2-propanol chamber with its strip
     inside and the lid on, as the practice frames its one chamber (a shot taken while the camera was still moving
     was off-centre).
3. **A missing tile in one look.** A first overview after step 46 showed no 2-propanol tile. It was the camera caught
   mid-move: the same view 2.5 to 18 s later shows both tiles, and the scene data placed them correctly throughout.

**Checks.**
- `tsc`: clean.
- 3D tests: 297 pass.
- `content:check`: 22, the known baseline.
- Practice build check: up to date.
- The Pack 3 asset validator: 0 failures, with `white-tile` noted as scenery.
- No 2D paths changed.

## Not seen

- Hand control (G3) on the chromatography gestures: set aside.
- Tablet widths: the looks were at 1024 × 700 only.
- The front and bands climbing inside the closed chamber during the step clock: seen only on the lifted strip.
- The 2-propanol practice object on its own: it is unlisted and plays only inside the lab, which was seen.
