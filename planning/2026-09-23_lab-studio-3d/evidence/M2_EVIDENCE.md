# M2 evidence note: Pack 1 equipment models

Branch `claude/lab-studio-3d`. Blender 5.2.2 LTS and gltfpack 1.2 (flags `-cc -kn -km -kv -vn 12 -vtf -vpf`).

## Models

| Definition | Triangles | Packed GLB (bytes) | Zone anchors | Display policy |
|---|---|---|---|---|
| `analytical-balance` | 5,132 | 49,328 | `analytical-balance-pan` | `balance-status-and-entry` |
| `cuvette` | 220 | 9,852 | — | — |
| `graduated-cylinder` | 22,388 | 145,308 | — | — |
| `reagent-bottle` | 44,793 | 242,548 | — | — |
| `rubber-stopper-set` | 2,304 | 16,048 | — | — |
| `sample-bottle` | 44,517 | 239,128 | — | — |
| `sample-bottle-1l` | 41,601 | 229,056 | — | — |
| `spatula` | 3,672 | 26,944 | — | — |
| `spectrophotometer` | 1,126 | 20,296 | `spectrophotometer-cuvette-slot` (yaw 90°) | `photometer-settings-status-and-entry` |
| `stirring-rod` | 1,152 | 10,556 | — | — |
| `test-tube` | 7,680 | 46,884 | — (`requiresSupport: test-tube-rack`) | — |
| `volumetric-flask` | 41,701 | 222,360 | `volumetric-flask-stopper-seat` | — |
| `wash-bottle` (M1) | 43,631 | 235,984 | — | — |
| `watch-glass` | 20,800 | 111,484 | `watch-glass-paper-seat` | — |
| `test-tube-rack` (scenery, D9) | 584 | 12,492 | seats for `test-tube` | — |
| **Total** | | **1,618,892** after the final pack (budget 4,000,000) | | |

## Fidelity decisions recorded in the modules

- **Real dimensions shared by parts that fit together** (`tools/blender/equipment/_fits.py`):
  - A #0 stopper (13 → 17 mm taper) in the flask's 14.5 mm bore seats with its small end 9.4 mm below the mouth.
  - The cuvette well is 12.9 mm square and 30 mm deep, so a seated cuvette stands 15 mm above the well surround.
  - Each anchor is computed from these numbers.
- **Volumetric flask.** The calibration ring sits where the model's own inner profile holds 100 mL (123.7 mm above the base, on the neck), and the validator re-derives it from the fill profile. No tolerance class is printed.
- **Graduated cylinder.** Graduations are placed from the bore profile, at 1 mL, 5 mL and numbered 10 mL steps. They match the catalogue's 1 mL precision, as the validator checks.
- **Bottles** (one parametric builder for the reagent, sample and 1 L bottles).
  - They are shown uncapped: the runtime has no closure state for them, and their Pack 1 roles need an open mouth.
  - Only the capacity is printed: the same definitions hold different reagents in different techniques.
- **Instruments.**
  - Display faces are blank glass. The registry names each display's policy, centre and size; the viewer draws only what the policy allows (G-1).
  - The balance claims no readability (the catalogue precision is recorded in mL; decision U9). Its right draft-shield door is shown open.
  - The spectrophotometer's lid is shown raised, and the seated cuvette is turned 90° so its clear faces meet the beam.
- **Test tube and rack (D9).** The tube records `requiresSupport: test-tube-rack`. The rack is a scenery entry, `test-tube-rack`, not a catalogue id, with four seats. `runtimeToScene` draws it under a bench tube and never as an instance.
- **Budgets.** Met by tessellation only: the 1 L bottle went from 176 to 148 lathe segments, and the flask bulb arc from 40 to 28 samples. No real dimension changed.

## Review renders (Cycles, 1200 × 1500, `tools/blender/.build/review/`)

The first-pass review found, and fixed, four defects:
1. The rubber stopper fell inside the camera's default 0.1 m near clip. The clip start is now 2 mm.
2. The spatula's spoon was 12 mm clear of its shaft. The shaft now meets both ends.
3. The spectrophotometer's raised lid floated 4 mm above the deck. It now stands on the deck.
4. Both displays read mid-grey from studio reflections. Display glass and the dark housing were darkened.

After the fixes, the re-rendered items were inspected again (`renders/M2_items_review.jpg`).

**Composite states** (`renders/M2_composites_review.jpg`, rendered by `build_equipment3d.py --composites` from the parent's own registry anchor):

| Composite | Child placed at | Inspected result |
|---|---|---|
| Balance with watch glass | `analytical-balance-pan` (0, 40, 90) | The glass sits flat on the pan, inside the draft shield |
| Spectrophotometer with cuvette | `spectrophotometer-cuvette-slot` (-80, 45, 94), yaw 90° | The cuvette stands in the well, with its top protruding and its frosted faces toward the viewer |
| Volumetric flask with stopper | `volumetric-flask-stopper-seat` (0, 0, 160.6) | The stopper is wedged in the neck mouth |
| Test tube in rack (D9) | seat 1 of `test-tube-rack` (-11, 0, 6) | The tube passes through the second hole and rests on the lower plate |

## Static exit

- `py tools/blender/validate_equipment3d.py --pack 1`: **PASS** (14 definitions, 0 failures, models 1,618,892 bytes).
- `npx tsc -b`: exit 0.

## Pipeline notes

- **gltfpack on Windows.** gltfpack under Node 23 on Windows aborts in libuv teardown (`async.c` `UV_HANDLE_CLOSING`) after writing small outputs; here it happened on the cuvette. `pack_models.py` accepts a non-zero exit only when the output is verifiably complete: GLB magic, declared length equal to the file size, parseable JSON with meshes, and written during this run. It then logs a warning.
- **Validator.** `validate_equipment3d.py` now also checks:
  - scenery entries (files, materials, budget, and that the id is not a catalogue definition);
  - that each `requiresSupport` names a scenery entry;
  - that calibration rings agree with the fill profile;
  - box fill profiles (the cuvette).
