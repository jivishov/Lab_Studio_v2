# Dilute a Stock Solution, atomized: evidence (2026-10-02)

Built from `proposals/PACK1_ATOMIZATION.md` with your choices:
- drop by drop to the mark;
- a graduated pipette with a pump for the aliquot.

This is the first of the two techniques; Make a Solution follows, reusing the shared pieces built here.

## What changed

**Content** (`public/techniques/dilution.json`, hand-edited as weighing is; D4 exception 8). Three steps become twelve:

| # | Step | What the student does | Building block |
|---|---|---|---|
| 1 | Place the volumetric flask | Carries the 100 mL flask to the bench | `atom.place.select-clean-dry-receiving-vessel` |
| 2 | Pour the stock into a beaker | Pours about 20 mL from the stock bottle | `atom.transfer.working-portion` |
| 3 | Fit the pipette pump | Seats the pump on the pipette | `atom.place.pipette-filler` (new) |
| 4 | Fill the pipette to zero | Dips the pipette in the beaker; it fills to the 0 mark | `atom.transfer.fill-pipette-to-zero-mark` (new) |
| 5 | Deliver the aliquot | Holds the pipette over the flask; runs it, then drops, to the aliquot line | `atom.transfer.deliver-pipette-to-line` (new) |
| 6 | Fill to below the mark | Pours from the wash bottle to just below the mark | `atom.transfer.unmeasured-solvent` |
| 7 | Fill a dropping pipette | Draws water from a beaker of deionized water | `atom.transfer.draw-into-transfer-pipette` |
| 8 | Bring to the mark | Drop by drop until the meniscus touches the mark | `atom.dilute.dropwise-to-mark` (new) |
| 9 | Stopper the flask | Seats the stopper | `atom.place.stopper-vessel` (new) |
| 10 | Invert to mix | Inverts ten times | `atom.mix.invert-stoppered-vessel` (new) |
| 11 | Calculate the dilution factor | Final ÷ aliquot, from the two recorded volumes | (calculation) |
| 12 | Calculate the diluted concentration | From the stock concentration and the dilution | (calculation) |

- **Settings:** the aliquot (more than 0, at most 10 mL, the pipette's capacity) and the stock concentration (more than 0). The final volume is the flask's 100 mL, and the dilution factor is calculated, so the old `finalVolumeMl`, `dilutionFactor` and `dilutionEvidenceId` settings are gone.
- **Stock:** the bottle is "Blue dye stock (0.2 M)", its concentration taken from setup.
- **Equipment:** the flask, the stock bottle, two 150 mL beakers, the 10 mL graduated pipette with its pump, the wash bottle, a Beral pipette and the stopper. The old cylinder pre-filled with the aliquot is gone.
- **Atoms and roles:** six new atoms and two new roles (`pipette-filler`, `vessel-stopper`). Like the earlier new atoms, they cite no source document and record your decision as their basis.

**Core:**
- **Drop to a line** (`reducer.ts`, `executeMarkDispense`), a `dispenseDrops` handler separate from titration's burette:
  - each request is one drop (0.05 mL) or a short run of drops (`dropCount`);
  - "at the line" is judged within one drop;
  - accepting too early is refused ("The meniscus has not reached the line yet.");
  - going past the line is kept, and accepting is then refused ("The meniscus is past the line.", with "…this solution would be remade" as the recovery);
  - on acceptance the line's value is recorded as a measurement, which completes the step;
  - repeated drops do not lengthen the vessel's name, and water dropped into a solution leaves a solution.
- **Invert to mix** (`executeInversion`): each request is one inversion, and ten complete the step. The stopper is required through the action's attachment gate.
- **Wiring:**
  - `validation.ts` accepts a mix with `mixOperation: "invert"`;
  - `atomRegistry.ts` gives it a typed physical effect;
  - the evidence audit counts the line's recorded value as produced;
  - the setup rules are rewritten for the two new settings;
  - `RuntimeState` gains the optional `markDispenses` and `mixInversions`.
- **Catalogue:** a pump seat on the graduated pipette (catalogue, visual catalogue, interaction zones).
- **Calculation:** the existing `dilutionFactorFromVolumes` template is used. I first wrote a duplicate, then found the existing one and removed mine.

**Models** (`tools/blender/equipment/`):
- `graduated_pipette_10ml.py` (52 KB): a serological pipette with 0.1 mL lines, the 0 mark at the top and numbers rising toward the tip; the pump-seat anchor; it lies flat at rest and is carried by its tip;
- `pipette_pump.py` (56 KB): a green thumbwheel pump that lies at rest and seats upright on the pipette;
- the Beral pipette is rebuilt with the new `carriedByTip` flag;
- a new material, "Pipette pump green".

The Pack 1 validator passes: 20 definitions, 2.1 MB.

**3D:**
- **Pipettes:** they are recognised by the registry's `carriedByTip`, so the graduated pipette draws as the Beral does.
- **Seated parts follow their parent's whole orientation:** a pump on a pipette lying on the bench lies with it, and is re-posed when the pipette is carried upright or dips.
- **Drop mode:**
  - carry the step's pipette over its vessel ("Release to hold the pipette over the 100 mL volumetric flask"), or press the card's "Hold the pipette over it";
  - the pipette is held upright over the mouth, and the hold outlasts every drop's redraw;
  - the camera goes to eye level with the line: the flask's calibration ring, or the pipette's aliquot line;
  - a panel offers One drop, Hold to run, At the line, and Put the pipette down; keys: Space tapped or held, Enter, Esc; on the bench, a click is one drop and a held press runs;
  - each drop is drawn falling;
  - no volume is shown: the student reads the line.
- **The eye-level camera avoids occluders:** it tries the current direction, then turned ones, until nothing stands between the eye and the line. This was found in the spot check: the wash bottle hid the neck.
- **Inverting:** a tap on the stoppered flask (or Enter on it), or the card's "Invert (n of 10)", counts one inversion; each is then drawn, the flask lifted, turned over and back, the stopper with it.

## Checks

- **Runtime probe:** the full run completes 12 of 12, with a dilution factor of 20 x and 0.01 M. An overshoot of 3 drops is refused; an early "at the line" is refused. Validation, the composition contract and the evidence audit are clean.
- **Catalogue policy:** accepted for all five Pack 1 techniques.
- **Narrow validators:** weighing 32 of 32, transmittance-dilution 28 of 28.
- `npx tsc -p tsconfig.app.json --noEmit`: exit 0.

**In the pane** (hidden, so with reduced motion on to let the commits through):
- all twelve steps, using bench carries, drop mode and the card's Invert;
- the early refusal shown;
- results: "Aliquot delivered 5.0 mL", "Final volume 100.0 mL", "20.00x", "0.01 M";
- no console errors;
- reduced motion was switched back off afterwards.

**Visual spot check** (one headless Chromium run with SwiftShader, since the pane could not draw):
- the pump fitted on the lying pipette;
- the eye-level close-up of the pipette's scale, with the meniscus at the "5" line after 99 drops;
- after the occlusion fix, the flask's neck at eye level with the mark ring and the level just below it;
- the stoppered flask lifting during an inversion.

**Not seen:**
- the flask upside down: the headless frames were too sparse;
- assessment mode;
- hand control;
- the pane with normal motion.

## Found after the build (2026-10-02)

You saw the pump floating above the bench, detached from the pipette, at step 5. When a tool's draw or tip animation ended, the tool was put back where the runtime keeps it, but what was seated on it was not re-posed. The pump kept its last mid-dip position, upright above the beaker. Both "put back" points now re-pose seated parts: the tool deposit and, for safety, the set-on animation. A headless look after the step 4 draw shows the pump on the end of the filled pipette lying on the bench.

## Tests written, not run

- `src/runtime/__tests__/markDispense.test.ts`: delivering to the line; an early refusal; an overshoot refused and not undoable; acceptance within one drop; inversions counted to ten; the whole dilution (20 x, 0.01 M).
- `src/studio3d/__tests__/toolTransfer.test.ts`: `markStepFor`, pipette recognition, the graduated pipette's draw.
- **Updated** for the new settings: `standaloneConfigurationSemantics.test.ts`, `techniqueConfiguration.test.ts`, `studioReadiness.test.ts`.

## Notes, not changed

- **2D.** The 2D player has no drop mode and does not enable the Invert record button, so Dilute a Stock Solution is a 3D-first technique now (2D is out of scope, by your decision).
- **Tray grouping.** The tray groups the two beakers on one tile ("Stock beaker × 2"); a tap places the stock beaker first. This is the same per-item tile question as before.
- **Flask label.** The flask's contents read "Blue dye stock + Deionized water". Water poured from the wash bottle goes through the ordinary pour, which still labels the result a mixture.
- **Headless verification.** A hidden pane stops animations, which blocks carries until the pour finishes drawing. That is why reduced motion, and the headless browser, were used.
