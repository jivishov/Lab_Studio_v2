# Pack 2: evidence (2026-10-05 to 2026-10-06, with the fidelity review)

Your request: "Build Pack 2 as decided in planning/2026-09-23_lab-studio-3d/proposals/PACK2_ATOMIZATION.md. Start with its "For the build thread" section." Then: "continue".

All ten decisions and the four further choices in the proposal were already made. This note lists what was built, the checks, the interpretations that need your confirmation, and what was not seen. The step lists below are as they stand after the fidelity review of 2026-10-06 and your answers on the interpretations the same day; both are listed at the end.

## What was built

**The practice list** (decision 1A, commit `55f183a`).
- The five lab-bound techniques each get a 3D practice version: a technique of its own, with its own id, starting bench and teacher settings.
- They are listed in `public/techniques-3d/index.json`, written with the techniques by `scripts/practice3d/build.mjs` from one module per technique (`--check` reports a stale file). Each entry names its pack (2) and the original it is based on (`basedOn`).
- They are never in `public/techniques/index.json`. The 2D catalogue, its pack order, the lab-bound originals and their three 2D labs are unchanged. Each has `catalogDisposition: "standalone-practice"`.
- The 3D route, the pack badge and the simulation switcher read the practice list through `src/studio3d/practice.ts`. The switcher shows the packs under headings. A practice version's 2D fallback is its original's route.

**1. Transfer Liquid** (`transfer-practice`, 4 steps; decision 2).
1. Place the 250 mL beaker.
2. Pour the measured sample in, holding the cylinder over the beaker to drain (the drain is part of the pour).
3. Rinse the cylinder into the beaker, three squirts.
4. Record the observation.

**2. Hard-Water Calcium Carbonate Precipitation** (`hard-water-precipitation-practice`, 11 steps; decisions 6 and 7; commit `265f7ef`; step 7 added in the review).
1. Stand the stirring rod in the beaker.
2. Add the first of three portions of sodium carbonate solution while the rod stirs.
3. Record what forms.
4. Add the second portion.
5. Add the third portion.
6. Keep stirring for 2 minutes (PR-15).
7. Rinse the rod into the beaker with the wash bottle.
8. Lift the rod out.
9. Let the precipitate settle.
10. Fill a dropping pipette from the working portion.
11. Add one drop to the clear liquid and look (the complete-precipitation test).

**3. Filter a Precipitate** (`filtration-practice`, 13 steps; decisions 3–5; commit `422d000`; step 3 added on 2026-10-06).
1. Stand the ring stand on the bench.
2. Seat the funnel in its ring.
3. Check the empty balance reads zero (TARE).
4. Lay the dry paper on the balance pan.
5. Read the paper's mass.
6. Record it.
7. Fold the paper.
8. Open it into the funnel.
9. Wet it.
10. Put the flask under the stem.
11. Pour down the rod in portions the paper cone holds, the clear liquid first and the solid last. A pour that would rise above the paper is refused.
12. Rinse the beaker and rod into the funnel, three squirts.
13. Wash the solid, three squirts.

**4. Dry and Weigh a Precipitate** (`drying-practice`, 26 steps; decisions 8 and 9; the manual's two timed stages; commit `be59017`; steps 2, 14, 16 and 21 added on 2026-10-06).
1. Note the paper's mass from filtration.
2. Check the empty balance reads zero (TARE).
3. Put the labelled watch glass on the pan.
4. Read its mass.
5. Record it.
6. Lift the paper with its solid onto the glass.
7. Pour the filtrate down the sink.
8. Set the oven (110–120 °C).
9. Open the door.
10. Put the glass on the shelf.
11. Close the door and dry 10–15 minutes on the step clock.
12. Open the door.
13. Lift the glass out with tongs onto the heat-safe pad.
14. Close the door, so the oven keeps its temperature.
15. Break up the solid with the metal scoop.
16. Open the door again.
17. Put the glass back with the tongs.
18. Dry 5 more minutes.
19. Open the door.
20. Lift the glass out onto the pad.
21. Close the door.
22. Let it cool.
23. Put it on the pan.
24. Read the combined mass.
25. Record it.
26. Work out the precipitate's mass by difference.

The oven is not opened before a stage's clock has run.

**5. Heat and Reweigh a Carbonate Mixture** (`thermal-decomposition-mass-loss-practice`, 36 steps; decision 10; the renamed step; commit `c17c1d1`; the balance choice and the Unused Sample return added in the review, the zero check on 2026-10-06).
- **Weighing:** put balance A on the bench and make every weighing on it (EX-01); check it reads zero with its pan empty (TARE); weigh the empty crucible and lid, then record it; tap about the planned mass from the issued mixture's vial into the crucible on the pan; weigh the loaded crucible, then record it; tip what is left in the vial into the "Unused Sample" beaker (EX-08, S-07).
- **The support:** stand the ring stand; seat the clay triangle; stand the burner beneath the ring; set the crucible in the triangle; set the lid askew.
- **The burner:** light it (air collar nearly closed, gas on, striker at the top of the barrel: a yellow flame); open the air collar to a blue flame with an inner cone.
- **The first heating:** "Warm the mixture gently with the lid askew"; heat; turn the burner off; move the crucible with tongs onto the heat-safe pad; let it cool; weigh and record.
- **The second heating:** set it back in the triangle; light; set the flame; heat again; turn off; tongs to the pad; cool; weigh and record the constant final mass.
- **The end:** tip the product into its labelled beaker; work out the composition.

The records and the calculation keep their legacy effects.

**Core changes (all five).**
- **Bench operations** (`src/domain/benchOperations.ts`): a step names one, and the reducer's handler performs it. Each has its own verb and atom, which imply each other, is done through the process control and is judged on its own tag. There are fifteen: stir, settle, the drop test, fold the paper, set the oven, open its door, close it (added on 2026-10-06), dry in it, break up the solid, cool on the pad, set the lid askew, light the burner, set the flame, heat the crucible and turn the burner off.
- **Apparatus states** (`apparatusStates`): a paper's form; the oven's setting and door; the burner's gas, air collar, flame and heat; the crucible's lid and glow.
- **Counted steps:**
  - reagent portions (`portionCount`, `portionIndex`);
  - filtering in portions (`pourPortionMl`, `residueFraction`);
  - rinses routed through a filter to the flask under it.
- **Placement:**
  - items placed inside an instrument's chamber, its door open;
  - a part lifted from one holder to another (`moveFromHolder`);
  - a target that must stand on the bench (`requireTargetUnseated`);
  - hot glassware moved only with tongs (`handledWithDefinitionId`; `refuseHotByHand` is opt-in);
  - a crucible not moved off a lit burner (`requireBurnerOffInstanceId`);
  - a required form (`requiredForm`);
  - the instance the step names, never another of its kind (`requireNamedTarget`, opt-in; added in the review for balance A).
- **Transactional refusals:** bench operations, and placements that let go of a holder, are now transactional, so a refusal leaves the bench exactly as it was. Before, a refused placement after `moveFromHolder` could leave the item unseated.
- **Heating:** heating over the burner needs the lid askew, the burner in its bay under the ring and a blue flame. A gentle warming changes no mass; a heating stage leaves the configured sodium carbonate residue.
- **Atoms and roles:** 24 new atoms (`atom.rinse.stirring-rod-into-vessel` added in the review; `atom.observe.zero-empty-balance` and `atom.observe.close-oven-door` on 2026-10-06); `atom.place.thermal-heating-instrument` also allows `snapIntoTarget`; `rinsed-vessel` allows the graduated cylinder; `receiving-vessel` allows the funnel stand; new roles `cooling-surface` and `waste-drain`.
- **Catalogue:**
  - a stirring-rod rest on the 250 mL beaker;
  - the balance pan takes a filter paper;
  - a burner bay on the ring stand;
  - the heat-safe pad and the sink.
- **Setup:** in a practice version, a teacher-set starting volume must fit the item that holds it.
- **Verbs:** `heat` may use the process control, only as a bench operation.

**3D.**
- **14 new models, and the stirring rod remodelled upright:**
  - glassware: 250 mL beaker and 250 mL Erlenmeyer flask (each with a printed approximate scale, for looks only, since 2026-10-06), small vial;
  - stands: ring stand, funnel stand, clay triangle;
  - other items: filter paper (flat, folded, cone, dished on the watch glass), crucible with lid (closed or askew), crucible tongs, scoopula, heat-safe pad;
  - instruments: drying oven (swinging door, dial, setpoint display), sink, Bunsen burner (yellow, blue and gentle flames, air ports).
- **Both validators pass:** Pack 1 (20 definitions) and Pack 2 (22 definitions).
- **The step clock:** runs stated minutes fast, `clamp(minutes × 1.5, 3, 8)` seconds.
- **Drawing from the runtime state:**
  - a rod standing in the beaker and stirring;
  - a pour down a guide rod;
  - the funnel draining between portions;
  - the settling precipitate;
  - one drop from a pipette;
  - a paper's forms and its wet look;
  - the oven's door;
  - the tongs gripping and carrying;
  - the scoop breaking up the solid;
  - parts shown by apparatus state (the crucible's lid, the burner's flames and air ports);
  - a dull red glow under strong heat;
  - a slight flame flicker.
- **New material roles:** porcelain, brass and flame (unlit, see-through, drawn somewhat stronger than a real flame against a pale bench).
- **A fix found in the looks:** the selection ring stayed where released tongs had been set down. It now follows its item after each sync.

## Checks

- **Runtime probes** (`probes/probe-practice.mts`, the process control with the student's free moves):
  - Transfer 4 of 4;
  - Precipitation 10 of 10;
  - Filtration 12 of 12 (the paper's 0.552 g kept through the filtration);
  - Dry and Weigh 22 of 22 (0.150 g by difference);
  - Heat and Reweigh 33 of 33 (mass loss 0.443 g; 60 % NaHCO3, 40 % Na2CO3 for the default 2.000 g sample and 1.557 g residue).
  All five validate, satisfy the composition contract and pass the catalogue policy.
- **Written tests** (`src/studio3d/__tests__/pack2Practice.test.ts`, 18):
  - the list holds the five, none in the 2D catalogue;
  - each validates, passes the policy and plays to completion;
  - Heat and Reweigh's composition;
  - the burner lit yellow, then blue, then off;
  - the glow and the residue;
  - refused: lighting with the lid not askew; heating over a yellow flame; moving the crucible off a lit burner (it stays seated); carrying the hot crucible by hand.
- **Static:** the typecheck exits 0; the practice files are current (`build.mjs --check`); the Pack 1 and Pack 2 model validators pass.
- **One G1 look per technique** (SwiftShader, headless), each with no console errors:
  - Transfer: pour, drain, three squirts;
  - Precipitation: rod, portions, settling, drop test;
  - Filtration: paper on the pan, fold, cone, pour down the rod, rinses;
  - Dry and Weigh: watch glass, sink, oven, tongs, pad, cooling, mass by difference;
  - Heat and Reweigh, to the first reweighing: the assembly, the yellow flame, the blue flame, the strong heating with the glow on the clock, the tongs to the pad, the askew lid on the cooling crucible.

**The test suite and `content:check`** (authorised 2026-10-05):
- **The first suite run:** 131 of 1,661 failed, in 49 files. The same 49 files were run on a clean export of this branch's pre-Pack-2 commit (`fce11c0`, outside the repository, sharing `node_modules`), where 128 fail.
- **Only on this branch:**
  - three were this branch's own and are fixed:
    - two runtime-assigned visual-state checks: the oven and pad handlers assign the partly dry, broken-up and cooled dryness stages by default, so those registry entries now say `runtime-assigned`, and a ternary's `"dry"` literal no longer reads as a state;
    - the visual catalogue had no 2D profile for the heat-safe pad and the sink: each has a plain 2D outline (`public/assets/equipment/heat-safe-pad.svg`, `lab-sink.svg`);
  - one, the assay run planner, passes alone: it is load-sensitive, as on Pack 1.
- **The re-run after the fixes:** 127 of 1,679 failed, in 47 files, and every one also fails on the base. They are mostly the 2D player, assay, Causalyst, MCP and baseline-script tests, and are left as they are.
- **`content:check`:**
  - two new findings from this branch, both fixed: the lint's copy of the verb–interaction table now lists `heat` under the process control, and `docs/atomic-steps.md` is regenerated;
  - the 22 left are the same as on GitHub main (21 missing source traces, one alias label collision);
  - the baseline is left as it is.

## Interpretations (your answers, 2026-10-06)

You confirmed every one of these as built, except where an item says it was changed. The changes are listed at the end of this note.


1. **Transfer:** the cylinder's drain is part of the pour (held over the beaker), not a step of its own.
2. **Precipitation:**
   - the observation after the first portion is its own step;
   - the reagent comes from a 150 mL working portion, so the dropping pipette is not filled from a stock bottle;
   - the settling is its own step, of 2 minutes on the clock.
3. **Filtration:**
   - a 9 cm paper (the manual's 7 cm would not cover the funnel's cone), and a 48 mm ring;
   - 5 % of the solid stays on the beaker until the rinses (`residueFraction` 0.05);
   - the balance is taken as zeroed for the paper. **Changed:** one check that the empty balance reads zero before each technique's first weighing (Filtration, Dry and Weigh, Heat and Reweigh);
   - the fold leaves out the proposal's torn corner (your choice, 2026-10-06): the paper is weighed before it is folded, so a corner torn off afterwards would change its recorded mass.
4. **Default settings** (teachers can change them): Transfer 20 mL; Precipitation a 20 mL sample and 50 mL reagent stock; Filtration 30 mL of mixture; Dry and Weigh a 30 g watch glass and a 12-minute first stage; Heat and Reweigh a 25 g crucible and lid, 2.5 g of mixture issued in the vial, a 2.000 g sample, a 1.557 g residue, 2 minutes' warming, 10 minutes' heating, strong heating.
5. **Dry and Weigh:**
   - the sink's basin is raised to the bench (kept; its description corrected);
   - cooling takes 10 minutes;
   - the oven door is opened as a step of its own. **Changed:** it is also closed as soon as the glass is out, and opened again to put it back.
6. **Heat and Reweigh:**
   - one replicate (your choice, 2026-10-06: the manual's physical steps restored): balance A is the one the steps name, and balance B stays a free move away on the tray; the plan approval, the master stock, the replicate bookkeeping and the uncertainty record stay with the lab-bound original;
   - two heatings, the first reaching the residue, so the second reading matches it (constant mass); the repeat-until-constant loop and its settings (`constantMassToleranceG`, `maximumHeatCycles`) stay with the original;
   - the burner stands in a bay on the ring stand's base, its inner cone's tip about 10 mm below the crucible;
   - the striker is not drawn;
   - the empty crucible is weighed on the pan, not on the bench;
   - the heating intensity is "moderate" or "strong"; only strong heating glows.
7. **Studio 3D** does not list the practice versions; only the player and its switcher do.

## Not seen

- Hand control with a camera (G3, set aside).
- The early-oven refusal's correction text and the overflow refusal's message on screen (timing in the headless browser); both are covered by the code paths the probes reach.
- Heat and Reweigh's second heating in 3D (the probe and the tests cover it).
- Assessment mode.
- The flame at close range: the look's camera framed the whole bench, where the blue flame shows as a small cone under the crucible.

## Fidelity review (2026-10-06)

Your request: "Critically review for fidelity the work done and review where needed." I checked the content against the proposal and the two source plans. Three reviewers read the rest: one the 3D player, one the models, one whether the 2D labs changed. I checked each of their findings against the code before changing anything.

Your choices on 2026-10-06:
- restore Heat and Reweigh's physical steps;
- rinse the stirring rod;
- leave the paper's torn corner out.

**Content:**
1. **Heat and Reweigh dropped eight of its original's 31 steps.** The proposal said "only these changes", and that the records keep their legacy effects. Two of the dropped steps are physical steps the manual states. Restored (your choice):
   - **EX-01:** both balances are in the tray. Balance A is put on the bench, and every weighing is made on it.
     - A weighing on balance B is refused: "Every weighing in this run is made on balance A."
     - Before, the runtime accepted the crucible on either balance of the same kind, so this needed a new opt-in placement rule, `requireNamedTarget`.
   - **EX-06, EX-08 and S-07:** the vial holds the mixture issued (`issuedMassG`, default 2.5 g). About the planned mass is tapped into the crucible on the pan. What is left goes to its own labelled "Unused Sample" beaker, apart from the product's.
   - **Left with the lab-bound original:** the plan approval, the master stock, the replicate bookkeeping and the uncertainty record.
   - The practice is now 35 steps (was 33).
2. **Precipitation laid the stirring rod on the bench with precipitate on it.** The rod is now rinsed back into the beaker with the wash bottle before it is lifted out (your choice; 11 steps). The rinse has an atom of its own, `atom.rinse.stirring-rod-into-vessel`, which binds the rod as the stirring device. Filtration's rinse becomes "Rinse the beaker and rod into the funnel", with no new step.
3. **The portion text did not match what the runtime pours.** It said "about a third of the sodium carbonate solution", from a beaker holding the whole 50 mL working portion, while the runtime pours a third of the teacher's reagent volume. The step now names the volume ("a third of the 15 mL").
4. **Heat and Reweigh's reweighing gave the result away.** It said "It should match the first cooled mass"; it now asks the student to compare the two (EX-15).
5. **The fold left out the proposal's torn corner without saying so.** It stays out (your choice); see interpretation 3.
6. **The new starting-volume capacity check reached every 2D technique's teacher setup.** It now applies only to the practice versions, so the 2D setups are as they were.

**Models** (rebuilt with Blender 5.2.2; both validators pass):

7. **The flames passed through the crucible.** They took no account of it: the yellow flame rose through the crucible and out above its lid, and the blue one filled its inside, which showed through the lid's gap.
   - The yellow and blue flames now spread under the crucible's foot and lick up the outside of its wall, never inside it. The yellow flame licks higher, as a luminous flame does.
   - The gentle warming flame stays clear of the crucible.
   - The inner cone's tip is about 1 cm below the foot.
8. **The flat paper on the watch glass ran through the glass.** The dish rises 9.7 mm at the paper's edge. A new `dished` form follows the dish's curve.
9. **The clay triangle's tubes sat 2.65 mm inside the ring's wire.** They now rest on it. The crucible's seat follows from where its wall meets the tubes (`_fits.crucible_foot_below_triangle`), 2.65 mm higher.
10. **The solid in the paper cone poked through the paper.** It was drawn wider than the cone at its height; it now rests higher in the cone.
11. **The askew lid cut into the crucible's rim.** Its lip went into the rim, and the lid hung tipped with nothing under one end. It now rests level on its lip where the lip crosses the rim, and the crescent gap (about 5.5 mm) stays open.
12. **The scoopula floated 2 mm above the bench.**
13. **The crucible's description was wrong.** It said "30 mL low-form", but its shape is high-form and it holds about 25 mL to the brim. Corrected.

**3D player** (each refusal is a correction, not an assessment attempt):

14. **The step card skipped the stir, settle and cooling clocks.** Only the next record button waited. Now every way to the next action waits for a timed stage's clock: "The N minutes are not up yet." That covers the step card's buttons and lists, Show me, keys, clicks, a tray tile and the hand.
15. **"Pour (n of m)" skipped the funnel's drain**, so the overflow refusal never showed from the step card. Every way of sending the next portion now gets the overflow correction while the last portion is still draining. The guide rod goes back to where it rested after each pour.
16. **Under reduced motion there was no clock and no oven refusal.** The clock now counts in numbers, without the face sweeping, and holds the next action. The bench jumps to the end.
17. **The clock face and the wait could disagree after a hidden tab.** One timer now moves both.
18. **Show me moved the hot item without the tongs at a tongs step.** It now shows the tongs going to the item, then to its place. The step card's Confirm still moves it without drawing the tongs, as Pack 1's spatula step does from the step card: there is no carry to draw from.
19. **The camera could leave the room.** With the clay triangle or burner put on the bench while the ring stand stood at the bench's front edge, Auto view aimed about 50 m off the bench and the view went empty. The pre-review code did this too with the new bench.
    - The cause is in the fit ported from the microarray lab: a point close behind the camera flips its projection.
    - A fit that runs out of the room is now dropped (`fitBest`, `benchCamera.ts`).
20. **A tray tile's Enter could put one item inside another.** It placed at the 2D default slot, whose picture sizes are not the 3D footprints; the ring stand stood in balance A. It now takes the nearest free 3D spot from that slot, as a drop with the pointer already did.
21. **Smaller fixes:**
    - a failed drawing could lock the bench; it is now always cleared;
    - Restart during a clock drew the old end state onto the reset bench;
    - the drain animation, and the replaced wet-paper and glow materials, were not disposed;
    - Enter on the oven at a door step carried the oven instead of working the door;
    - a failed practice-list fetch was cached, and could send a practice id to the 2D player. Until its original is known, the route now shows "2D version not available".

**Records:** the notes said 15 new models; there are 14 (the 13 the proposal named, plus the funnel-stand composite).

**Checked, no change needed:**
- **The 2D labs are unchanged.** The three 2D labs and the five lab-bound techniques were played through the 2D keyboard and pointer paths, on clean exports of the pre-Pack-2 commit and of this branch. The full runtime state after every step, the compiled labs and the 2D bench geometry are identical. The only difference needs a hand-built request the 2D player never sends: a filter paper onto the balance pan, which is now accepted.
- **Untouched:** the 2D player and `app.css`; the 2D catalogue and its pack order.
- **Confirmed:**
  - the build's counts of steps, atoms (21, now 22) and bench operations (14);
  - the composition: 60 % NaHCO3 from a 0.443 g loss;
  - the 8 mL filtering portion, about 1 cm below the paper's rim on the funnel's profile;
  - the line endings of every changed file.

**Found, not changed (it was there before Pack 2):** `hard-water-demo` cannot be finished in the 2D runtime.
- The cooling step refuses with "The Watch glass is not hot.": the drying step stores `ovenTemperatureC`, but the handler reads `temperatureC`.
- The dry-mass record looks for `drying--dry-precipitate-mass`, but the weighing saves `dry-precipitate-mass`.
- It is outside Pack 2, and the 2D labs are left as they are.

**Left as they are at the review** (each answered on 2026-10-06; see the next section):
- the sink stands on the bench; a real one is set into it;
- the zero step is not repeated before the paper, watch-glass and crucible weighings. Weigh a Solid's zero atom tares with the vessel on the pan, which would hide the very mass these weighings read;
- the oven door stays open while the solid is broken up between the stages; a real student would close it;
- no graduations on the 250 mL beaker and flask; the tongs drawn as round bars;
- under reduced motion, the filtration pour finishes at once, with no drain wait;
- the hand-control prompt says "close your hand to grip" for the tongs, but the grip is made with an open palm held still.

**Checks after the fixes:**
- **Runtime probes:** Transfer 4 of 4, Precipitation 11 of 11, Filtration 12 of 12, Dry and Weigh 22 of 22 (0.150 g by difference), Heat and Reweigh 35 of 35 (60 % NaHCO3; 0.5 g returned to Unused Sample). All five validate, satisfy the composition contract and pass the catalogue policy. A Heat and Reweigh setup whose sample exceeds the issued mixture is refused by the existing starting-mass rule.
- **Tests:** `pack2Practice.test.ts` 21 (3 new: the rod rinse keeps the precipitate; the leftover goes to Unused Sample apart from the product; a weighing on balance B is refused and leaves the crucible on the pad). `src/studio3d` 23 files, 237 tests, all passing; the default worker count timed out starting its workers, so the suite was run with three.
- **Static:** the typecheck exits 0; the practice files are current; the Pack 1 (20) and Pack 2 (22) model validators pass; the atom docs are regenerated; `content:check` has the same 22 findings as GitHub main. Every changed file keeps its line endings.
- **One G1 look per technique** (SwiftShader, headless), each with no console errors and every frame drawn:
  - Heat and Reweigh through the first reweighing: balance A from the tray; the Unused Sample return; the support; the yellow flame spread under the crucible and up its side, nothing above the lid; the blue flame; the glow under strong heat;
  - Dry and Weigh: the paper dished in the watch glass;
  - Filtration: the cone, the pour down the rod, "Rinse the beaker and rod";
  - Precipitation: the rod rinse, then the rod lifted out.
- **Not seen:** hand control with a camera (G3); assessment mode; Heat and Reweigh's second heating in 3D (the probe and tests cover it).

## Your answers on the interpretations (2026-10-06)

You: "Ask in line for the remaining interpretations." I asked in four rounds.

**Confirmed as built:**
- Transfer's drain is part of the pour.
- Precipitation:
  - the observation is its own step;
  - the reagent comes from a 150 mL working portion;
  - settling has its own 2-minute clock.
- Filtration: the 9 cm paper and 48 mm ring; 5 % of the solid left on the beaker until the rinses.
- Dry and Weigh: cooling takes 10 minutes; opening the door is a step of its own.
- Every default setting.
- Heat and Reweigh:
  - two heatings with equal readings;
  - the burner in a bay on the stand's base;
  - the striker not drawn;
  - the empty crucible weighed on the pan;
  - moderate or strong heating, with only strong heating glowing.
- Studio 3D does not list the practice versions until D8.
- The sink stays standing on the bench. Its script no longer calls it a cup sink with a drain grid.

**Changed:**
1. **One zero check per technique.** Before each technique's first weighing, the student checks that the empty balance reads 0.000 g and presses TARE if it does not: step 3 of Filtration, step 2 of Dry and Weigh, step 3 of Heat and Reweigh.
   - The check has an atom of its own, `atom.observe.zero-empty-balance`, binding only the balance. Weigh a Solid's zero atom tares with the vessel on the pan, which would hide the very mass these weighings read.
   - It names no vessel, so the balance's display keeps reading the full mass on the pan.
   - The 3D player lights the balance's TARE key for it, and the step card shows "Tare".
2. **The oven door is closed as soon as the glass is out** (a new bench operation, `close-oven-door`, with `atom.observe.close-oven-door`). It is closed after each removal, and opened again to put the glass back: 3 steps, not the 2 I first gave, since putting it back needs the door opened again. Dry and Weigh is 26 steps with the zero check.
3. **The drain wait under reduced motion.** A filtration portion's pour now stays open for the drain's 2.6 s with nothing drawn. The next portion gets the same overflow correction as with motion.
4. **Printed approximate scales on the 250 mL beaker and flask.** 50 to 200 mL in 25 mL steps, numbered every 50 mL, beside the "250 mL" print, each line where the inner profile holds that volume. They are for looks only: the registry claims no graduations, so they are never read as a measurement. Pack 1's 150 mL beaker now matches (you: "match the 150 ml beaker."): 25 to 125 mL, numbered at 50 and 100. All three use one helper, `tools/blender/equipment/_scales.py`; the 250 mL vessels were rebuilt from it unchanged, and both validators pass.
5. **The tongs' jaws bow about 38 mm apart near their tips**, to close around a crucible's body. Their tips still meet to pinch a rim, where the 3D player holds a gripped item.
6. **The hand-control prompt at a tongs step** now says to show the open palm and hold it to grip, matching the gesture.

**Checks after these changes:**
- **Runtime probes:** Filtration 13 of 13, Dry and Weigh 26 of 26 (0.150 g by difference, the door closed after each removal), Heat and Reweigh 36 of 36 (60 % NaHCO3). All three validate, satisfy the composition contract and pass the catalogue policy.
- **Tests:** `pack2Practice.test.ts` 23. The 2 new ones check that each weighing practice zeros the empty balance before its first weighing, and that the oven door is shut during the break-up and the cooling. `src/studio3d`: 23 files, 239 tests, all passing (run with three workers).
- **Static:**
  - the typecheck exits 0 and the practice files are current;
  - the Pack 1 (20) and Pack 2 (22) model validators pass;
  - the atom docs are regenerated;
  - `content:check` has the same 22 findings as GitHub main;
  - every changed file keeps its line endings.
- **G1 looks** (SwiftShader, headless; no console errors, every frame drawn):
  - Dry and Weigh through all 26 steps: the TARE step, the door closed after each removal and opened again;
  - Filtration through all 13 steps: the TARE step before the paper;
  - the scales seen on the beaker and on the flask under the funnel.
