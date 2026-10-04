# The microarray lab's environment, bench view, mouse and hand control: evidence (2026-10-04)

Built from `proposals/MICROARRAY_ADOPTION.md` with your choices of 2026-10-04: all twelve defaults of §9, MediaPipe kept at 1.0.1, and no fake-camera smoke test (`DECISIONS.md`). The source is `virtual_lab/experiments/dna-microarray-3d` (the same code as `dnamicroarray_v2` at `9495489`). Both copies were read and neither was edited.

| Phase | Commit | What |
|---|---|---|
| P0 | `9798de1` | Your §9 answers recorded |
| P1 | `c71ffa9` | Room and look |
| P2 | `8aac738` | Camera and mouse camera |
| P3 | `237b359` | The left button on the ported controller |
| P4 | `e11fada` | Hand control |
| P5 | this commit | Records |

## What changed

### P1: room and look (`bench/look/`)
- **Geometry.** `microarrayGeometry.ts` transcribes the source's `box`, `bevelBox`, `lathe`, `cylinder` and `plane`, with the same vertices, normals and UVs.
- **The room** (`room.ts`, from `scene.js:57-84`) includes:
  - the slate-blue resin worktop with its wooden lip;
  - the cabinets, with their door gaps and handles;
  - the back wall and skirting rail;
  - the window, emitting at 1.9;
  - the shelf with five bottles.
- **Scenery choices.** The wall text reads "CHEMISTRY · TEACHING LAB", and the UV sign and the microarray's apparatus are not taken.
- **Scale.** It is all one scenery group, scaled by 1.4/15 ≈ 0.0933 m per unit. The 15-unit worktop is therefore exactly the 1.4 m runtime bench; `BENCH_MM` and the runtime mapping are unchanged. Nothing in the room is pickable or a runtime object (G-8), and contact shadows are cast by equipment only.
- **Worktop texture.** The resin is the source's pattern 1, as a 0.2 m tile: the fbm, plus light specks in 1/240-unit cells and dark ones in 1/170-unit cells.
- **Lights.** The key is `[3.0, 2.82, 2.55]` from (−6, 9, 3.5), with the source's shadow box scaled and 22% of it left in shadow. The fill is `[0.55, 0.68, 0.84]` from (6, 4, −2).
- **Reflections and ambient.** The source's analytic `env()` (gradient plus window, panel and strip lobes) is evaluated into an equirectangular map and prefiltered by PMREM.
  - three.js lights diffuse surfaces from that same map, so it stands in for the source's hemisphere term at `environmentIntensity` 0.4.
  - Glass, clear plastic, metals and display glass get `envMapIntensity × 2.5` back. *Approximation:* facing up the ambient is 0.37 against the source's 0.27, and facing sideways 0.12 against 0.19.
- **Frame.**
  - Rendering is linear HDR with MSAA.
  - Bloom uses UnrealBloomPass: threshold 1.05, smooth width 0.5 standing in for the knee, strength 0.45.
  - The source's composite pass is ported as written: Narkowicz ACES, its vignette, gamma 1/2.2 and dither.
  - The renderer itself does no tone mapping.
- **Tiers.**

  | Tier | DPR cap | MSAA | Key shadow map | Bloom |
  |---|---|---|---|---|
  | High | 1.6 | 4 | 2048 | yes |
  | Balanced | 1.25 | 4 | 2048 | yes |
  | Low | 1 | none | 1024 | no |

  Contact-shadow and texture sizes stay Lab Studio's.
- **Background.** The clear colour is (0.55, 0.56, 0.55), and the page behind the canvas is `#d1d2d1`.

### P2: camera (`bench/camera/benchCamera.ts`, `BenchEngine.ts`)
- **The view.** OrbitControls is gone. The camera is the source's model:
  - an orbit about `at` by yaw, pitch and distance;
  - FOV 42°;
  - near 0.04 and far 80 units, scaled;
  - on viewports narrower than 1.1:1, the distance grows by 1.10/aspect.
- **Manual limits** (`app.js:125-149`, scaled): pitch 0.35–1.55, distance 3.2–20 units, `at.x` ±7 and `at.z` ±4.5; yaw is unbounded.
- **Mouse.**
  - Right-drag pans sideways, keeping the bench point under the pointer, and tilts with up and down.
  - Shift or Alt + right-drag, or middle-drag, orbits at 0.006 and 0.005 rad/px.
  - The wheel zooms by e^(Δ·0.0012) toward the bench point under the pointer.
  - Drags start after 3 px, and a right click without a drag is reported, which P3 uses.
- **Touch** (choice 5): one finger pans and tilts, a pinch zooms, and two fingers orbit. A touch that picks up an item holds the camera.
- **Auto-framing.**
  - The source's `fit()` (14 projections) is used, into the largest of the source's free rectangles around the open panels, above the hint and dock.
  - Pitch is 0.9, and yaw turns back to the front the short way (choice 11).
  - It tweens over 650 ms with easeInOutCubic, or cuts under reduced motion.
- **Views.**
  - Whole bench, Overhead and Home are the source's bench preset, Top preset and default view.
  - Examine and eye level remain programmatic views outside the manual limits (eye level is at pitch 0).
  - The Studio's Front, Top and Reset, and the turntable, use the same engine (choice 9).

### P3: the left button (`bench/input/useBenchCarry.ts`)
- **Picking up.** A mouse press on an item or a tray tile picks it up, and it follows the pointer with no button held.
- **What the next press does** (`PressAction`):
  - it acts at once to set down, place, tip a scoop, hold a pipette over a vessel, or be refused;
  - on a seat or a pour target it starts a stroke: the press is dragged down, 28 px is full depth, it acts at 0.85, and 32 px back up withdraws;
  - a pipette draws when the button is let go at depth;
  - the spatula scoops by a stroke into the solid.
- **Putting it back.** Esc or a right click puts the item back. A second press at once where it was picked up (a double-click) puts it back and opens Examine.
- **Unchanged.**
  - The release resolution, its 2D order and the intents (`sceneToIntent.ts`).
  - Touch's press-and-hold carry, the keyboard carry, tray Enter, drop mode, inversion and TARE.
- **Copy.** Callouts, hints and the Help table use the new wording ("Click to set down", "Press and drag down to place…").

### P4: hand control (`src/studio3d/hand/`)
Transcribed into TypeScript, each module naming its source (choice 12):
- `handCore.ts`: `hand-core.js`;
- `handTracker.ts` (with a module worker and `handDetector.ts`): `camera.js`;
- `handController.ts`: `interaction.js` and `app.js` picking;
- `handTuning.ts`: `hand-tuning.js`.

**MediaPipe.** HandLandmarker 1.0.1 in VIDEO mode, two hands, every confidence 0.5, GPU then CPU, with a main-thread fallback. The model is the bundled `public/mediapipe/models/hand_landmarker.task`, and no CDN is used.

**The gesture table**, as decided (§8):

| Action | Hand |
|---|---|
| Pick up an item or a tray item | Closed grip held 350 ms |
| Set down, place, or hold a pipette over a vessel | Open palm held 450 ms |
| Seat or deliver | Lock, then lower the palm (depth 0.85) |
| Pour, or tip the spatula's scoop | Lock, then turn the palm past 60° |
| Draw | Squeeze above the liquid, lower in, let go. Squeezing with the tip already in is "Bubbles!", and lifting out with the bulb still squeezed recovers it, as in the source |
| Scoop with the spatula | Lower into the solid |
| Drops (drop mode) | One per plunger press; a press held 300 ms runs |
| Invert | Grip the stoppered flask, turn the palm over (past 1.92 rad) and back (under 1.05): one inversion |
| TARE | Aim at the key and press the plunger |

**Panel buttons.**
- Buttons marked `data-hand-press` take a grip-dwell: At the line, Put the pipette down, and the step card's Confirm, Submit and Record.
- The step card's buttons had `data-gesture-action`, the 2D bridge's opt-in, and now carry `data-hand-press`.

**Other behaviour.**
- A mouse press or the wheel stops the camera (choice 6).
- The hand panel (choice 8) holds:
  - the preview with the tracked hand drawn;
  - a live guide line;
  - the set-up tracker (Start camera, Hand, Capture Rest, Capture Press; or Set centre and a first pinch in pinch mode);
  - the plunger meter;
  - gesture cards for these actions;
  - Hand settings: plunger gesture, cursor speed 1–4, smoothing, aim assist;
  - the status and inference line;
  - Lab Studio's privacy wording.
- **The cursor** is a ring: teal while aiming, and gold, filling with depth, when locked.

**Removed.** Player3D no longer imports the 2D gesture engine or bridge, and the 3D bridge resolver (`bench/input/targetResolver.ts`) is deleted.

**Untouched.** Nothing under `src/player/**` or in `src/styles/app.css` changed (checked with `git diff`).

### P5: records
- `AGENTS.md`: the Student Player gesture rules now say they govern the 2D player, and a "Player3D Hand Control Rules" section names the 3D modules (choice 10).
- `DECISIONS.md`: the build row, with the interpretations below.
- `SESSION_HANDOFF.md`: brought up to date.

## Interpretations made while building (to confirm)

1. **Ambient light** is the environment map at 0.4, with reflective materials boosted back (P1 above). It is not a separate hemisphere light.
2. **"All items" framing** also takes in the runtime bench, so a lone item is not shown as a close-up. Working-set framing grows the items' bounds by 1.6.
3. **A double-click puts the item back.** In the click model the first press of a double-click picks the item up, so an immediate second press there puts it back, and Examine opens.
4. **Touch keeps drag and release.** The source has no touch control of equipment.
5. **Aim assist only in guided mode.** It snaps to the step's next target, which is guidance (G-7).
6. **An open palm over a stroke target does nothing.** It does not let go over a seat, a liquid or a pour target; the guide says to lower or turn instead. Open-palm set-down is for "commit" spots.
7. **Inverting needs no carry.** The flask is gripped where it stands; the existing inversion animation draws each count.
8. **Panel buttons a hand may press** are At the line and Put down (§8), plus the step card's Confirm, Submit and Record, which the 2D bridge had already opted in.
9. **The panel shows the source's status and inference line.** This supersedes the M7 row "no runtime metrics".
10. **Hand settings** are stored under `lab-studio:3d:v1:hand`, a preference only. It is a fourth UI key beside handoff §3.8's three.

## Checks
- `npx tsc -p tsconfig.app.json --noEmit` exits 0 after every phase. Tests are included in that project.
- `python tools/blender/validate_equipment3d.py --pack 1`: PASS, 20 definitions, 2.1 MB (P1).
- Probes: `validate-weighing.mts` 32/32; `probe-catalog-policy.mts` accepted for all five Pack 1 techniques (P3).
- **Looks** (headless Chromium with SwiftShader, since the pane was hidden):
  - P1: Dilute a Stock Solution under the new room, at Low and Balanced; the microarray lab itself was also looked at, for comparison.
  - P2: the auto view, Whole bench and Overhead.
  - P4: the hand panel.
- **A mouse run of Weigh a Solid** (`probes/run-weighing-mouse.cjs`, reduced motion on, real mouse events), with no console errors:
  - four tray items clicked onto the bench;
  - a right click put a held bottle back;
  - the watch glass carried to the balance and pressed down onto the pan (step 1 → 2);
  - the TARE key clicked (2 → 3);
  - the spatula pressed down into the bottle ("Scooped from the reagent bottle"), then clicked onto the glass (3 → 4);
  - a double-click opened Examine.

## Tests written, not run
- `microarrayLook.test.ts`: geometry, scale, colours, lights, environment, bloom.
- `benchCamera.test.ts`: camera model, clamps, orbit, pan, zoom, front yaw, `fit`, `safeRects`, `fitBest`.
- `clickCarry.test.ts`: stroke depth and click callouts.
- `handControl.test.ts`, rewritten: hand core, picking, take and set down, aim and lock, sway, draw technique, drops, inverting, TARE. Adapted from the source's `hand-aim.test.cjs`.
- `handTracker.test.ts`: denial, stale packets, calibration, plunger edges, a draw through the controller, hand switching, pinch home and gain. Adapted from `camera-lifecycle.test.cjs`.
- `player3DHandControl.test.tsx`, rewritten: the panel, the tracker, pinch mode, gestures, collapse, `data-hand-press`, the guide line and badge.

## Not run or not seen
- **G3 (real webcam).** The built-in pane blocks the camera, and Claude in Chrome was not connected. Hand control has been checked only by source review, typecheck and the written tests.
- **The fake-camera smoke test,** not run as you decided.
- **Normal motion in the pane, and touch** (tablet pan, pinch and orbit).
- **Assessment mode, drop mode, pipette strokes and the pour stroke with the mouse.** The run covered weighing only.
- **The Studio's Starting bench and turntable** under the new camera.

## Notes
- **Line endings.** The P2 commit turned `Player3D.tsx` from CRLF to LF; Git Bash's `sed -i` did it. P3 restored CRLF. Edits now go through a byte-aware script only.
- **Room proportions.** At the agreed scale the room is to the microarray's proportions. Real-size Lab Studio glassware therefore looks small against the Whole bench view; the auto view frames the working set.
- **Leftover code.** `coveredSides` in `player/panelLayout.ts` is no longer used by Player3D (framing uses `safeRects`); its test still covers it.
