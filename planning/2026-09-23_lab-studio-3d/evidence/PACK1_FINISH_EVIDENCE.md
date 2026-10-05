# Finishing Pack 1: evidence (2026-10-05)

Your request: "Finish pack 1." Your answers the same day:
- **Rinses:** "Three squirts per step";
- **Hand rinse:** "Keep lock, then squeeze";
- **Tests:** "Yes, run both", meaning the test suite and `npm run content:check`.

The work is the plan's remaining Pack 1 items: the two small additions, the two open interface items, and the Make a Solution rinse question. It ends with the first run of the tests and the content check.

## What changed

**1. Make a Solution: each rinse takes three squirts** (D4 exception 10).
- **Content:** the boat and funnel rinse steps carry `rinsePortions: 3`. Each step has its own notebook tag (`boat-rinsed-into-flask`, `funnel-rinsed-into-flask`) and is judged by it. The two steps tell the student to rinse "with three small squirts".
- **Runtime:**
  - Each rinse request is one squirt. A squirt short of the count is progress within the step, as an inversion is: no retry message.
  - The last squirt records "Rinsed with 3 squirts; the washings ran into the 100 mL volumetric flask."
  - A squirt is about 3 mL, a runtime default rather than a stated measured quantity, as `atom.rinse.quantitative-transfer` requires. The flask holds 18 mL after both rinses. It is still filled to half (50 mL) and to the mark (100 mL), and ends at 25.000 g/L for 2.5 g.
  - A rinse once done is refused.
- **Validation:** `rinsePortions` must be a whole number from 1 to 10, and only on rinse actions. The rinse atom says squirts may be counted.
- **3D:**
  - The step card's button reads "Rinse (1 of 3)".
  - Each squirt is drawn as before: the wash bottle comes over, and with the boat, the boat is held over the funnel.
  - By hand, each squirt is the same lock, then squeeze (kept).

**2. transmittance-dilution: the test tube is stoppered, inverted and opened** (D4 exception 11).
- **Three new steps** after "Dilute to the configured final volume" (it is now 31 steps):
  1. stopper the test tube (`atom.place.stopper-vessel`);
  2. invert it ten times (`atom.mix.invert-stoppered-vessel`, refused unless the stopper is seated);
  3. take the stopper out and set it on the bench (new `atom.place.remove-stopper`).
- **Why the third step:** the sample is drawn from that tube a few steps later, and the stopper has to come out first. Nothing in the runtime stopped a pipette drawing through a seated stopper.
- **The water step** no longer says "and mix": its label, title and description now say "Dilute to the configured final volume" and "Add the measured water to the test tube, to a final volume of … mL".
- **Generator:** `scripts/generatorInputs/simulator/transmittanceDilution.mjs`, regenerated with `--only`. It gains the roles `final-volume-vessel` (the test tube) and `vessel-stopper`.
- **Catalogue:**
  - a `test-tube-stopper-seat` zone (inserted, accepts the rubber stopper), in `catalog.ts`, `interactionZones.ts` and the 2D `visualCatalog.ts`.
- **Model:**
  - `test_tube.py` has the stopper seat anchor at 146.25 mm, where the #0 stopper's 13–17 mm taper meets the tube's 13.6 mm bore (`_fits.stopper_seat_depth`).
  - A review composite, `test-tube-with-stopper`, shows the stopper wedged in the mouth.
  - Rebuilt and packed (46,748 bytes); the Pack 1 validator passes.
- **3D:** the inversion hint names the test tube; the hand guide says "invert it once" and the gesture card "Grip the stoppered flask or tube".

**3. Weigh a Solid's zero step has its own atom** (D4 exception 12).
- `atom.observe.zero-balance` (roles `balance-instrument` and `weighed-vessel`, through the process control) records that the balance was zeroed with the named vessel. It acquires no reading and asserts no precision.
- The zero step binds it, and its legacy effect entry is gone.

**4. One tray tile per item.**
- Two of a kind are now two named tiles: the blank and sample cuvettes, the blank and sample pipettes, and the stock and blank-source bottles.
- Each tile places its own item, whether by a click, a drag, Enter or a hand grab. The tray drop carries the item's id to the runtime (`placeIntent.sourceInstanceId`, or the free move's `sourceInstanceId`).
- Before, a pair shared one tile with "× 2", and every way of using it placed the first.

**5. The top bar no longer lets a long title run under the step counter.**
- It is a three-column grid. The counter stays centred while there is room, and the buttons on the right keep their width.
- A title too long for its column ends in an ellipsis; its full text is in its tooltip.
- The "TECHNIQUE · PACK 1" label hides below 1440 px. Measured headless:
  - every title shows in full at 1024, 1280, 1440 and 1600 px;
  - the counter never overlaps the title.

## Tests and content check (first run, with your permission)

**`npm run content:check`:**
- **The first run had 45 new findings.** 23 came from this branch, and all are fixed:
  - **the lint's copy of `actionEquipmentParameterKeys`** lacked `washingsReceiverDefinitionId` (from the Make a Solution fidelity review);
  - **`atom.dilute.unmeasured-solvent-to-mark`** still cited Dilute a Stock Solution's `dilute-to-mark`, which D4 exception 8 removed. The citation is gone; the atom stays, used by the runtime fixture;
  - **18 burette-titration findings on the drop-to-the-line steps** of the two dilutions. The lint now skips a `markDispense` step, as the reducer sends it to its own handler before any titration branch.
- **The 22 left are the same on GitHub main:** 21 missing source traces in paper-chromatography, blue1-percent-transmittance and brass-spectrophotometry, and one alias label collision (`distilled-water-bottle-2l`). The branch has not changed any of their files. The lint baseline is stale: it also reports 478 resolved entries. Refreshing it is left for you to decide.

**The test suite (vitest):**
- **The first run:** 140 of 1,652 failed, in 55 files.
- **Compared with GitHub main:** the same files were run on a clean export of `origin/main`, outside the repository. Main fails 135 tests in them (2D player, assay, Causalyst, MCP, compatibility and baseline-script tests).
- **The 9 failures only on this branch:**
  - 4 in this round's own new tests (fixed: a receiver kind the technique has; a refusal that comes from the intent check; a run that types the step inputs);
  - 4 in tests written in earlier sessions and never run, each fixed in the test:
    - the hand-insertion depth was compared exactly in floating point;
    - the hand-tracker packet helper turned `world: undefined` into a default skeleton;
    - the registry test assumed its first entry had a pour lip;
    - the liquid-rendering list still named Dilute a Stock Solution's old pre-filled cylinder;
  - 1, the assay plate editor, was flaky: it passes alone.
- **The re-run after the fixes:** 129 of 1,652 failed, in 49 files. Every one also fails on GitHub main, except the assay run planner, which passes alone and is in code this branch never touched (load-sensitive, like the plate editor). The pre-existing failures on main are mostly the 2D player's `StudentPlayer`, `EquipmentShelf` and readout tests, assay, Causalyst and MCP tests, and baseline-script tests that need a `file:` URL. They are left as they are.

## Checks

- **Runtime probes:**
  - Make a Solution 14 of 14 at 25.000 g/L, the rinses "ok / ok / rinsed";
  - transmittance-dilution 31 of 31 through the Confirm path, the stopper attached at step 10 and detached at step 12;
  - `validate-transmittance` 30 of 30, including the new order;
  - `validate-weighing` 33 of 33;
  - the catalogue policy accepts all five Pack 1 techniques.
- **Static:** the typecheck exits 0; the Pack 1 validator passes (20 definitions); the atom docs are regenerated.
- **One headless look** (SwiftShader), with no console errors:
  - the per-item tray tiles and the top bar at 1024 px;
  - transmittance-dilution to step 10 by the step card, then the stopper carried into the tube in its rack;
  - the tube lifted mid-inversion and "Invert (1 of 10)" through ten;
  - the stopper carried out ("The stopper is out of the test tube and on the bench.");
  - Make a Solution's boat rinse counting "Rinse (0 of 3)", "(1 of 3)", "(2 of 3)", then moving to the funnel.
- **Not seen:** hand control with a camera (G3), and assessment mode.

## Interpretations to confirm

1. **A squirt is about 3 mL,** as a runtime default.
2. **The test tube is inverted ten times,** as the flask is, because the stopper atom says "about ten times".
3. **A third step takes the stopper out** before the sample is drawn.
4. **The zero step records evidence only:** it takes no reading.
5. **The source label hides below 1440 px.**
