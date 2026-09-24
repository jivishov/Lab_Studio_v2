# M4 evidence note: moving things on the 3D bench

Branch `claude/lab-studio-3d`, on top of `a0a829a`. Everything below is **uncommitted** working-tree
work; nothing has been staged, committed or pushed. Written 2026-09-23 after the session moved
to a new account (see the recovery note outside the repository).

## What M4 delivers (plan §7, handoff §5.6–§5.7)

| Piece | Where | State |
|---|---|---|
| Pure intent mapping and release order | `adapters/sceneToIntent.ts` (committed in `b368d8c`) | Done. A release resolves in the 2D order: expected drag-to-zone station, valid overlap, invalid overlap (a refusal that counts as an attempt), then a free move. |
| Snap alignment | `sceneToIntent.snapReleasePoint` | Added in this session. A snap is sent at the point the 2D helper `snapPointAligningSourceAnchor` gives, so both players record the same seat. Before this, the 3D release sent the raw drop point. |
| Footprints and overlap | `adapters/footprints.ts` | Done. Overlap is classified by the 2D `resolveBenchOverlap`; set-down slides to the nearest spot under 5 % overlap. Snaps follow the 2D rule since the fidelity review below. |
| Pointer carry | `bench/input/useBenchCarry.ts` | Written in the earlier session: 4 px or 120 ms to lift (300 ms on touch), lifted preview with footprint, ring and callout, Esc cancels. |
| Keyboard carry | same file, `bench/input/keyboard.ts` | Added in this session. Enter on a selected bench item, or Move… in the Bench list, lifts it where it stands. Arrows move it 10 mm (50 mm with Shift) and stay on the bench. `[` and `]` step through the other bench items as candidate targets and show their ring. Enter sets it down through the same release path as the pointer; Esc or leaving the bench cancels without committing. |
| Arrow selection | `Player3D.tsx`, `keyboard.spatialNeighbour` | Changed in this session: arrows now move the selection to the nearest item in that direction (handoff §5.19 "in spatial order"). It used to step through the list order with Left and Right only. |
| Parking after a pour | `usePlayer3D.parkAfterPour`, `adapters/twoDPlacement.ts` | The 2D `Workbench.parkAfterInteraction`, for pointer releases only, as in 2D (fidelity review below). |

Both ways of carrying share one core (`carryTo` and `release`), so the keyboard cannot resolve a
drop differently from the mouse.

## Static exit

- `npx tsc -b`: exit 0 (run after the last edit of this session).
- Tests written, **not run** (repository validation policy):
  - `__tests__/sceneToIntent.test.ts`: the six Pack 1 handlers, the release order, tray drops, the input merge, footprints; new cases for the snap release point against the 2D helper.
  - `__tests__/keyboard.test.ts` (new): arrow mapping, 10 and 50 mm steps, bench bounds, target cycling, spatial selection.
- Source review against `runIntent`: the step input is merged by `mergeActionInput`, refusals call `recordAssessmentFailure` through `usePlayer3D.refuse`, and free moves never do.

## G1 spot check (authorised: one look per change while building M3–M5)

`#/3d/technique/making-solution`, 1280 × 720, after step 1. The Bench list's Move… on the flask
focused the bench and started a carry: the hint, the callout ("Release to set down") and the
screen-reader line all changed. Six Shift+Right presses changed nothing in the runtime (the Bench
list still said "middle left"). Enter committed one free move: "Volumetric flask moved to the
middle centre". No correction appeared, no attempt was recorded, and the step stayed at 2 of 3.

The built-in browser pane could not draw frames during this session (`requestAnimationFrame`
never fired, and screenshots timed out), so the lifted preview, the rings and the pointer carry on
the canvas were **not** looked at. The pointer carry was not exercised at all in this session.

## Fidelity review (second pass, same day)

The M4 code, the earlier session's and this session's, was compared line by line with the 2D
sources it mirrors (`StudentPlayer.runIntent`, `runKeyboardFlow`, `placeShelfEquipment`,
`movePlacedEquipment`, `Workbench.finishMove`, `benchTargeting`, `benchOverlap`) and with handoff
§5.6. Differences found and fixed:

| Difference | Fix |
|---|---|
| Snaps counted any overlap with the target's footprint. 2D shrinks the carried item to a 4-unit box at its snap anchor and the target to its zone, when the step names a zone. | `footprints.snapClassification` does the same with the model's registry anchor. No Pack 1 snap names a zone, so Pack 1 behaves as before, as it does in 2D. |
| Parking after a pour used a 3D rule (beside the target). The handoff asks for the 2D `parkAfterInteraction`, which works from the release point. | The 2D rule, copied into `adapters/twoDPlacement.ts` with the tray's `nextPlacementPoint`; occupied bounds come from the exported 2D helpers. |
| A drop over a valid target that the runtime refused (for example, a missing input) left the item where it was dropped. | Every release the runtime does not accept re-syncs, so the item springs back (G-3, G-4). |
| An error the reducer raised after an accepted intent would have shown as a success toast; a refused free move was detected by comparing positions and only announced. | Each commit is judged by the feedback and failed attempts it added: errors show as a correction, "Recorded as an attempt." appears only when an attempt was recorded. |
| Typing in the input cleared the correction; a free move did not, while 2D clears feedback on every move. | Handoff §5.13 and 2D parity. |
| The expected drag-to-zone station showed "Release to set down". | "Release to place" in guided mode, neutral in assessment (§5.6). |
| A touch carry also orbited the camera. | Orbiting is held while an item is held. |
| Items locked to the carried item stayed behind in the preview. | They follow it, as `moveLockedChildren` moves them on commit. |
| `EquipmentInstance.rotation` turned items in 3D, though no runtime action sets it and the 2D workbench draws none. | Ignored, so both players show the same bench (decision U6 keeps turning in Examine). |
| Picking, hover labels and framing could read item positions from before the last sync until the next frame was drawn. | World matrices are refreshed whenever the engine moves an item. |

Checked once in the built-in browser (`making-solution`, 1280 × 720, reduced motion on), with
synthetic pointer events on the canvas:
- dragging the wash bottle over the flask showed "Release to pour 50 mL from the wash bottle into
  the volumetric flask."; release poured (toast "Solvent is in the flask.", step 2) and parked the
  bottle by the 2D rule;
- dragging it over the flask again in step 2 showed "Not the target for this step"; release showed
  "Wash bottle is not the expected source for this step." and the bottle sprang back; no attempt
  line in guided mode.

Tests written, not run: new cases in `__tests__/sceneToIntent.test.ts` (snap zone placement and
turn, zone-only judgement, the no-zone fallback, 2D parking) and `__tests__/adapters.test.ts`
(no turn from `rotation`).

## Pour animation fix (user report: "no animation of liquid transfer/pouring")

The earlier check ran with reduced motion on, which skips pours, so this was not seen. Causes:

- The committed pour animated only when both vessels were already on the bench in the scene
  from before the pour. A step's pour usually brings its target off the tray, and the runtime
  pours from a wash bottle, cylinder or reagent bottle where it stands on the shelf, so the
  animation was skipped in every Pack 1 pour driven from the step card.
- The motion tipped the source about its base, which put the lip past the target and below its rim.

The fix:

- `pourStagingScene` stages the animation on the committed layout, with the source's and target's
  contents from before the pour. A shelf source is stood beside the target in that description
  alone. The sync afterwards returns the bench to runtime state (G-3), and the source to the tray.
- The engine animates in the render loop (`bench/scene/pour.ts` holds the geometry):
  1. The source carries in beside the target.
  2. It turns its lip to the target and tips about the lip over the mouth, until its liquid
     reaches the lip.
  3. It pours for 600–1400 ms scaled by volume (§3.5). The stream (or a squeeze jet) is in the
     source's palette colour. The levels go between the runtime's before and after volumes, and
     the source's liquid is cut level by a world-horizontal plane as it tips.
  4. It rights itself and is set down where the runtime has it (the 2D park spot after a drag).
- A drag starts the pour from where it was released. The drag's pour cue (lip turned to the
  target, about 30° tilt, no stream; §3.7) was missing and is added.
- The camera frames the pour unless the learner has taken it.
- Nothing can be picked up while a pour is drawn.
- Reduced motion still skips the animation (§3.5).

Spot check (one look, built-in browser, motion on):
- `making-solution` step 1: the wash bottle's jet goes into the flask neck and the level rises.
- `dilution` step 1: the cylinder tips at its lip over the neck, its liquid stays level at the
  lip, and the flask fills.
- Step 2 of `making-solution` tips the reagent bottle, but no powder falls. The runtime holds
  that bottle `empty`; the dissolve action supplies the solute itself. So there is no runtime
  solid to draw, and the handoff's powder fall (§6) needs a content decision first.
- Not looked at: the drag path and the pour cue.

Tests written, not run: `__tests__/pourAnimation.test.ts`.

## Still open for M4

- A snap (the cuvette into the photometer in `transmittance-dilution`) seen seating in 3D.
- `[` and `]` offer every other bench item as a candidate; the handoff's wording ("candidate targets") could also be read as only the step's targets. Offering all of them keeps assessment mode from hinting; this is a presentation choice to confirm at M8.
