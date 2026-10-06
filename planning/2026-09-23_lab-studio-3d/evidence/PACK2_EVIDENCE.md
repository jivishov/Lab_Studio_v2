# Pack 2: evidence (2026-10-05 to 2026-10-06)

Your request: "Build Pack 2 as decided in planning/2026-09-23_lab-studio-3d/proposals/PACK2_ATOMIZATION.md. Start with its "For the build thread" section." Then: "continue".

All ten decisions and the four further choices in the proposal were already made. This note lists what was built, the checks, the interpretations that need your confirmation, and what was not seen.

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

**2. Hard-Water Calcium Carbonate Precipitation** (`hard-water-precipitation-practice`, 10 steps; decisions 6 and 7; commit `265f7ef`).
1. Stand the stirring rod in the beaker.
2. Add the first of three portions of sodium carbonate solution while the rod stirs.
3. Record what forms.
4. Add the second portion.
5. Add the third portion.
6. Keep stirring for 2 minutes (PR-15).
7. Lift the rod out.
8. Let the precipitate settle.
9. Fill a dropping pipette from the working portion.
10. Add one drop to the clear liquid and look (the complete-precipitation test).

**3. Filter a Precipitate** (`filtration-practice`, 12 steps; decisions 3–5; commit `422d000`).
1. Stand the ring stand on the bench.
2. Seat the funnel in its ring.
3. Lay the dry paper on the balance pan.
4. Read the paper's mass.
5. Record it.
6. Fold the paper.
7. Open it into the funnel.
8. Wet it.
9. Put the flask under the stem.
10. Pour down the rod in portions the paper cone holds, the clear liquid first and the solid last. A pour that would rise above the paper is refused.
11. Rinse the beaker into the funnel, three squirts.
12. Wash the solid, three squirts.

**4. Dry and Weigh a Precipitate** (`drying-practice`, 22 steps; decisions 8 and 9; the manual's two timed stages; commit `be59017`).
1. Note the paper's mass from filtration.
2. Put the labelled watch glass on the pan.
3. Read its mass.
4. Record it.
5. Lift the paper with its solid onto the glass.
6. Pour the filtrate down the sink.
7. Set the oven (110–120 °C).
8. Open the door.
9. Put the glass on the shelf.
10. Close the door and dry 10–15 minutes on the step clock.
11. Open the door.
12. Lift the glass out with tongs onto the heat-safe pad.
13. Break up the solid with the metal scoop.
14. Put it back with the tongs.
15. Dry 5 more minutes.
16. Open the door.
17. Lift the glass out onto the pad.
18. Let it cool.
19. Put it on the pan.
20. Read the combined mass.
21. Record it.
22. Work out the precipitate's mass by difference.

The oven is not opened before a stage's clock has run.

**5. Heat and Reweigh a Carbonate Mixture** (`thermal-decomposition-mass-loss-practice`, 33 steps; decision 10; the renamed step; commit `c17c1d1`).
- **Weighing:** weigh the empty crucible and lid, then record it; tip the mixture portion in; weigh the loaded crucible, then record it.
- **The support:** stand the ring stand; seat the clay triangle; stand the burner beneath the ring; set the crucible in the triangle; set the lid askew.
- **The burner:** light it (air collar nearly closed, gas on, striker at the top of the barrel: a yellow flame); open the air collar to a blue flame with an inner cone.
- **The first heating:** "Warm the mixture gently with the lid askew"; heat; turn the burner off; move the crucible with tongs onto the heat-safe pad; let it cool; weigh and record.
- **The second heating:** set it back in the triangle; light; set the flame; heat again; turn off; tongs to the pad; cool; weigh and record the constant final mass.
- **The end:** tip the product into its labelled beaker; work out the composition.

The records and the calculation keep their legacy effects.

**Core changes (all five).**
- **Bench operations** (`src/domain/benchOperations.ts`): a step names one, and the reducer's handler performs it. Each has its own verb and atom, which imply each other, is done through the process control and is judged on its own tag. There are fourteen: stir, settle, the drop test, fold the paper, set the oven, open its door, dry in it, break up the solid, cool on the pad, set the lid askew, light the burner, set the flame, heat the crucible and turn the burner off.
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
  - a required form (`requiredForm`).
- **Transactional refusals:** bench operations, and placements that let go of a holder, are now transactional, so a refusal leaves the bench exactly as it was. Before, a refused placement after `moveFromHolder` could leave the item unseated.
- **Heating:** heating over the burner needs the lid askew, the burner in its bay under the ring and a blue flame. A gentle warming changes no mass; a heating stage leaves the configured sodium carbonate residue.
- **Atoms and roles:** 21 new atoms; `atom.place.thermal-heating-instrument` also allows `snapIntoTarget`; `rinsed-vessel` allows the graduated cylinder; `receiving-vessel` allows the funnel stand; new roles `cooling-surface` and `waste-drain`.
- **Catalogue:**
  - a stirring-rod rest on the 250 mL beaker;
  - the balance pan takes a filter paper;
  - a burner bay on the ring stand;
  - the heat-safe pad and the sink.
- **Setup:** a teacher-set starting volume must fit the item that holds it.
- **Verbs:** `heat` may use the process control, only as a bench operation.

**3D.**
- **15 new models, and the stirring rod remodelled upright:**
  - glassware: 250 mL beaker, 250 mL Erlenmeyer flask, small vial;
  - stands: ring stand, funnel stand, clay triangle;
  - other items: filter paper (flat, folded, cone), crucible with lid (closed or askew), crucible tongs, scoopula, heat-safe pad;
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

## Interpretations to confirm

1. **Transfer:** the cylinder's drain is part of the pour (held over the beaker), not a step of its own.
2. **Precipitation:**
   - the observation after the first portion is its own step;
   - the reagent comes from a 150 mL working portion, so the dropping pipette is not filled from a stock bottle;
   - the settling is its own step, of 2 minutes on the clock.
3. **Filtration:**
   - a 9 cm paper (the manual's 7 cm would not cover the funnel's cone), and a 48 mm ring;
   - 5 % of the solid stays on the beaker until the rinses (`residueFraction` 0.05);
   - the balance is taken as zeroed for the paper.
4. **Default settings** (teachers can change them): Transfer 20 mL; Precipitation a 20 mL sample and 50 mL reagent stock; Filtration 30 mL of mixture; Dry and Weigh a 30 g watch glass and a 12-minute first stage; Heat and Reweigh a 25 g crucible and lid, a 2.000 g sample, a 1.557 g residue, 2 minutes' warming, 10 minutes' heating, strong heating.
5. **Dry and Weigh:**
   - the sink's basin is raised to the bench;
   - cooling takes 10 minutes;
   - the oven door is opened and closed as steps of their own.
6. **Heat and Reweigh:**
   - one replicate from a prepared portion: the plan approval, the master stock, the unused-sample recovery, the replicate bookkeeping and the uncertainty record stay with the lab-bound original;
   - two heatings, the first reaching the residue, so the second reading matches it (constant mass); the repeat-until-constant loop and its settings (`constantMassToleranceG`, `maximumHeatCycles`) stay with the original;
   - the burner stands in a bay on the ring stand's base, its inner cone's tip about 9 mm below the crucible;
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
