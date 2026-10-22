# Drag and drop, and no overlap on the bench: evidence (2026-10-22)

You asked, with two screenshots of Water hardness where the balance stood in the sink and against the drying oven:
"ensure that the objects do not overlap with each other as the balance overlaps with the sink and the incubator.
Also, when moving objects adapt the smooth drag and drop instead of current click-required pick up and drop off of any
object." You answered "Act on release (Recommended)" for the mouse's strokes and "Nudge to nearest clear spot
(Recommended)" for overlap (`DECISIONS.md`, the 2026-10-22 row). 3D only; nothing in 2D changed.

## Why items overlapped

- **The layout:** `stableBench.ts` stood items with no position of their own on 2D's slot grid (five a row, about
  257 × 191 mm a slot on the 3D bench). It tested clashes with the 2D pictures' boxes, not the 3D footprints. A balance
  (220 × 330 mm), a sink (360 × 280) and an oven (420 × 380) spill well past a slot.
- **Set-downs:** the nudge after a move or a shelf drop (`nearestFreeSpot`) counted a spot as free under 5 %
  overlap, 2D's rule.
- **The nudge's units:** a spot found in millimetres was stored in runtime units, which keep an item's art on the
  bench (`x ≥ 0`, `y ≥ 0`) and round. A spot near the left or back edge could move back into a clash.

## What was built

| # | Change | Where |
|---|---|---|
| 1 | **Spacing.** Two footprints clash when they come within `SPACING_MM` (10 mm) of each other, overlap included; the 5 % rule is gone from 3D. | `adapters/footprints.ts` (`footprintsClash`, `SPACING_MM`) |
| 2 | **The run's plan.** Every item of the run gets a spot once, whether or not it is on the bench, so nothing jumps as items come and go (the 2026-10-11 rule). The largest footprints are planned first, so small items spread over the slots cannot leave the oven no room. Each item takes its own slot when clear of every spot planned before it, else the first clear slot no item owns, else the first clear slot, else the nearest clear spot. | `adapters/stableBench.ts` (`runPlan`) |
| 3 | **On the bench.** An item stands at its planned spot unless an item with a position of its own (a student's move) is in the way. Then it takes the first clear unowned slot, else the nearest clear spot. A tray click or the Shelf list's Enter goes to the planned spot when clear (a ring stand tries 2D's back spot first). | `stableWorkbenchNodes`, `stablePlacementPoint` |
| 4 | **Every set-down slides clear.** A free move, a shelf drop and a pour source's park after the pour each go to `nearestClearPoint`. It tests each candidate where it would stand after conversion to runtime units, so the stored point is clear as drawn. | `stableBench.ts` (`nearestClearPoint`); `player/usePlayer3D.ts` (`freeMove`, `dropFromTray`, `parkAfterPour`); `footprints.ts` (`nearestFreeSpot`'s `accepts`) |
| 5 | **Drag and drop.** Replaces the microarray lab's click-carry (choice 4, 2026-10-04). A mouse press selects (or works the item at an invert, swirl, stir, oven or burner step, as a click did). A move past `DRAG_START_PX` (4 px) starts the carry, and the item follows the pointer. Letting go acts: set down (sliding clear), seat, pour, deliver, draw or grip. There is no drag-down stroke. Letting go back over the shelf puts a shelf item back; over a panel or the dock, nothing changes. Esc or a right click while dragging puts it back. Tools load as they pass over the source (the spatula scoops, the tongs grip). Touch keeps its 300 ms hold; hand control keeps its own strokes. | `bench/input/useBenchCarry.ts` |
| 6 | **Words.** The hints for every step's drag, the bottom hint while carrying, and the Controls panel's Mouse rows. | `player/Player3D.tsx`, `player/panels.tsx`; `AGENTS.md` |
| 7 | **Units module.** `toBench`, `fromBench` and the bench constants move to `benchUnits.ts`, so the layout converts units without an import cycle. `benchCoordinates.ts` re-exports them. | `adapters/benchUnits.ts` (new), `benchCoordinates.ts` |

## Checked

- tsc (`tsc -b`) is clean.
- The 3D tests pass: 37 files, 398 tests. They include new tests that no two of Water hardness's 21 items come within
  the spacing, either all on the bench or with a third on the shelf. They also test that the 16th item onward gets a
  spot of its own, and that a set-down's nudge keeps the spacing. In `shelfCarry.test.tsx`, a mouse drag takes a shelf
  item and a click places it. A press that moves under 4 px stays a click. Letting go over the shelf puts it back.
  A bench item dragged past 4 px moves.
- `content:check` is at its baseline of 22, and `node scripts/practice3d/build.mjs --check` exits 0.
- No file under `src/player/`, `src/styles/app.css`, `public/techniques/` or `public/labs/` changed.
- **Look (G1):** a headless Chromium with SwiftShader at 1400 × 860, Water hardness, guided. The pane in the app was
  422 px wide, too narrow to see the bench. Every shelf item was placed through the Shelf list's own path: 20 on the
  bench, with no footprint pair within 10 mm. The oven stands at the left, the sink in the middle and the balance at
  the right. A click on the filter paper moved nothing. A drag (20 steps) carried it with the "Let go where it
  goes…" hint, and letting go set it down where it was let go, with no clash afterwards. A drag let go over the oven
  (not this step's target) was refused, and nothing moved.
  - `renders/DRAG_dragging_1400.jpg`: mid-drag, Overhead.
  - `renders/DRAG_dropped_1400.jpg`: after the drop.

## Not checked

- A real mouse in the app's own pane, and touch on a tablet.
- Hand control. Its path is unchanged, and its tests pass.
- Each step's tool drags in a playthrough: the pipette, the capillary, the spatula, the tongs, the pencil and the
  dropping pipette. The unit tests cover the release paths, but no playthrough was run (G1 playthroughs stay closed).
- A full bench with a student's own moves. If no clear spot exists, an item stands at the nearest point; the bench
  is not full in any lab today.

## Known limits

- The ring and funnel stands' 2D pictures are 468 px tall, so their bench depth maps to the front edge, as before;
  their bases may reach a little past the 40 mm edge margin.
- `npx vite build` fails on `src/studio3d/bench/look/textures.ts`, which has a Latin-1 `×` (byte 0xD7) in a comment
  since `481af48`. This change does not touch it, and the dev server serves the file. It is a one-byte fix, left for you
  to approve.
