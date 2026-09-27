# transmittance-dilution: funnel, beaker and transfer pipettes: evidence (2026-09-26)

You asked:
1. "There should be funnel for the liquid transfer in the grad. cylinder."
2. "One can't fill the cuvette from the bottle. One must dispose from the bottle in about 200 mL beaker. Then aspire with a plastic disposable pipette and deliver to the cuvette."

You chose:
- **Pipettes for the blank and the sample.** The blank goes from the bottle into a beaker, is drawn up with a Beral pipette and delivered. The sample is drawn from the dilution test tube with a fresh pipette.
- **The 150 mL beaker.** The catalogue has none at 200 mL.
- **Seat, pour, remove the funnel.**
- **The 25 mL cylinder**, in place of the 100 mL one, for 5 mL and 10 mL.

## What changed

**Content** (`scripts/generatorInputs/simulator/transmittanceDilution.mjs`, regenerated with `--only transmittance-dilution`; D4 exception 7). The run goes from 23 steps to 28:

| New step | What it does |
|---|---|
| 4. Seat the filling funnel | The funnel snaps into the cylinder's `graduated-cylinder-funnel-seat` |
| 5. Measure the stock dye | Now reads "Pour 5 mL of the stock dye through the funnel into the graduated cylinder." |
| 6. Remove the filling funnel | "…set it on the bench before you read the volume." The funnel is detached and on the workbench |
| 12. Pour the blank into a beaker | 20 mL from the 1 L blank bottle into the 150 mL beaker (a literal volume) |
| 13. Draw the blank into a pipette | Fills the blank pipette (3 mL, to capacity) |
| 14. Fill the blank cuvette | From the blank pipette, 75 % of 4 mL |
| 19. Draw the sample into a pipette | A fresh pipette, 3 mL from the test tube |
| 20. Fill the sample cuvette | From the sample pipette |

- The instance `graduated-cylinder-1` is now a `graduated-cylinder-25ml` (label "25 mL graduated cylinder").
- New shelf items: `funnel-1`, `blank-beaker-1`, `blank-pipette-1` and `sample-pipette-1`.
- The two cuvette fills keep `atom.transfer.fill-cuvette`, with `sample-source: beral-pipette`.
- No setting changes. The teacher's values (5, 10 and 15 mL, and the %T) are as before.

**Core** (shared with 2D):
- **Catalogue** (`catalog.ts`, `visualCatalog.ts`, `interactionZones.ts`): the 25 mL cylinder gains a funnel seat. The zone is mounted and accepts `funnel`.
- **Atoms** (`src/domain/atomRegistry.json`; `docs/atomic-steps.md` regenerated with `scripts/generateAtomicStepsDocs.mjs`):
  - `atom.place.cylinder-filling-funnel`;
  - `atom.place.remove-cylinder-filling-funnel`;
  - `atom.transfer.working-portion`;
  - `atom.transfer.draw-into-transfer-pipette`.
- **Roles** (`src/domain/equipmentRoleRegistry.json`): `cylinder-filling-funnel`, `working-portion-vessel`, `pipette-liquid-source` and `transfer-pipette`.
- **Provenance:** the new atoms cite no source example, as 11 existing atoms don't (among them `atom.place.variable-volume-device`, which this technique already uses). Each records the basis instead: decided by the teacher on 2026-09-26. transmittance-dilution is a simulator-generated technique with no dated plan, and none of the 14 source documents states these practices. Citing one would have been false.

**Models** (`tools/blender/equipment/`), built, packed and validated:

| Model | Size | Notes |
|---|---|---|
| `graduated_cylinder_25ml.py` | 108 KB | 0.5 mL ticks, numbered every 5 mL; funnel-seat anchor |
| `funnel.py` | 81 KB | 60°, 55 mm; origin at the stem tip |
| `beaker_150ml.py` | 113 KB | Griffin 60 × 80 mm; "150 mL" print only |
| `beral_pipette.py` | 76 KB | LDPE, 155 mm; origin at the tip |

- `_fits.py` gains the cylinder and funnel dimensions. The seat anchor is computed from where the funnel's cone meets the rim.
- The Pack 1 validator passes: 18 definitions, 0 failures, models 2,002,996 bytes (budget 4,000,000).

**3D:**
- **A new registry field, `benchRest`,** for models authored in their working pose. The funnel rests mouth-down; the pipette lies flat along the bench's depth. Both are carried upright, and the funnel is seated upright. The engine turns, lifts and shifts them at rest. `basePosition` reports the footprint centre on the bench, so rings and beacons sit where the item is.
- **A pipette step** (`pipetteStepFor` and `resolvePipetteRelease` in `sceneToIntent.ts`): a `pourInto` whose target is a fillable tool is a *draw*, and one whose source is a fillable tool is a *delivery*. Either way the pipette is what's carried, upright and judged by its tip. Released over the liquid (draw) or the step's named cuvette (delivery), it sends the step's own pour, and is drawn dipping 12 mm and back (`motion: "dip"`). A beaker poured onto the pipette is refused with a correction, not an attempt, like the bottle tipped for the spatula.
- **Callouts:**
  - "Release to draw up from the blank beaker";
  - "Release to empty the pipette into the blank cuvette";
  - "Carry the pipette to the …" (guided);
  - "Draw it up with the pipette" (guided).
- **Confirm** records the same step without a pour animation.
- **Guided mode:** the beacon marks the pipette, then the liquid; Show me moves the pipette to the liquid.

**Generated docs.** Regenerating `docs/atomic-steps.md` also brought in source-example changes the registry already had: `21006aa` ("Repair item2 source mappings and identity records") updated the registry without regenerating the docs. The file is generated and never hand-edited, so the regenerated one is kept.

## Checks

- A runtime probe (the Confirm path, step by step, with the teacher's values) passes all 28 steps:
  - the funnel is seated at step 4 and detached at step 6;
  - the cylinder holds 5 mL, then the test tube 5 mL, then 15 mL;
  - the beaker holds 20 mL, the blank pipette 3 mL (beaker 17 mL), then the blank cuvette 3 mL;
  - the sample pipette takes 3 mL (test tube 12 mL), then the sample cuvette 3 mL;
  - the cuvettes seat in the photometer.
- The bundled-catalogue policy (`assessBundledTechniqueCatalogPolicy`, as the loader applies it) accepts transmittance-dilution and weighing with no findings. Before the atoms were added, it refused the five atomless physical steps, which is how that requirement was found.
- The narrow validator passes 28 of 28, including byte parity with the generator; the instruction check is updated for the new wording.
- `npx tsc -p tsconfig.app.json --noEmit`: exit 0.

**In the pane**, a full run of 28 steps, with the funnel, dye bottle, beaker and pipette steps carried by keyboard:
- "Release to seat the filling funnel in the graduated cylinder"; the funnel shows seated in the cylinder;
- the dye poured through it; the funnel later appears mouth-down on the bench;
- the blank beaker holds 20 mL, and the blank pipette 3 mL;
- "Release to empty the pipette into the blank cuvette": the pipette stands tip-down over the cuvette, which then shows its liquid;
- "Release to draw up from the clean labelled prepared-sample receiver", then "Release to empty the pipette into the sample cuvette";
- the results: "42.5 %T · Your entry · Display showed 42.5 %T", 0.425 T, 0.3716, and 0.066667 M;
- no console errors.

**Found and fixed in the pane:** the delivery callout named the first cuvette on the bench ("…into the sample cuvette") instead of the step's own. It now uses the step's named vessel.

**Not seen:**
- the pour through the funnel frame by frame, and the dip animation up close;
- assessment mode and reduced motion;
- hand control.

## Tests written, not run

- `runtime.test.ts`: the transmittance sequence now includes seating and removing the funnel.
- `contractedPourPreflight.test.ts`: the 25 mL cylinder, and the 20 mL working portion into the beaker (it replaces the bottle-to-cuvette fill).

## Notes, not changed

- **A stale test that predates this work.** `runtime.test.ts`'s "completes ungated techniques" expects the unconfigured transmittance-dilution to stall at the dye measurement. It stalls at step 1: the stock concentration has no configured value. Left as it was.
- **The reading happens with the funnel still seated.** `measureVolume` both pours and records the volume, so the reading is taken at step 5, before step 6 removes the funnel; the instruction tells the student to remove it before reading. Making the reading a step of its own would be a larger content change.
- **Tray grouping.** The tray groups the two cuvettes, and the two pipettes, under one tile ("Sample cuvette × 2", "Blank pipette × 2"); a tap places the first. This predates the work, but more pairs are now grouped. Labelling each tile by its instance is a small UI change for you to decide.
- **2D.** The 2D player has no art for a funnel in a 25 mL cylinder (out of scope, by your decision).
- **beers-law-calibration** keeps both cuvette defects and fills from the bottle (left for later, by decision).
