# The microarray lab's environment, bench view, mouse and hand control: evidence (2026-10-04)

Built from `proposals/MICROARRAY_ADOPTION.md` with your choices of 2026-10-04: all twelve defaults of §9, MediaPipe kept at 1.0.1, and no fake-camera smoke test (`DECISIONS.md`). The source is `virtual_lab/experiments/dna-microarray-3d` (the same code as `dnamicroarray_v2` at `9495489`). Both copies were read and neither was edited. Line references below were checked against that folder on 2026-10-04.

| Phase | Commit | What |
|---|---|---|
| P0 | `9798de1` | Your §9 answers recorded |
| P1 | `c71ffa9` | Room and look |
| P2 | `8aac738` | Camera and mouse camera |
| P3 | `237b359` | The left button on the ported controller |
| P4 | `e11fada` | Hand control |
| P5 | `e32214b` | Records |
| Review | the commit after `e32214b` | The fidelity review below: fixes and these records corrected |

## Fidelity review (2026-10-04, after P5)

You asked for a critical review for fidelity. Each part was compared again with the source, the brief, the decisions and the guardrails. These were found and fixed:

| # | Found | Fixed |
|---|---|---|
| 1 | **Reflections were not restored.** P1 claimed glass and metal reflected the room at full strength (`envMapIntensity × 2.5`). three.js ignores a material's `envMapIntensity` unless the material has its own `envMap`, so every material reflected at the scene-wide 0.4 (checked in `WebGLRenderer.js`). | The source's lighting model is now reproduced instead of approximated (`look/roomLighting.ts`). Each material takes only the environment's reflections, at full strength (glass at the source's 0.62). The source's hemisphere light is the ambient again, and its rim darkening is applied. |
| 2 | **Mouse strokes committed mid-drag.** A seat, pour or delivery committed as the press reached depth, while the button was still held. That breaks guardrail G-5 ("a drag commits on release"); the source does commit there. | Every stroke now acts when the button is let go at depth; the gesture is unchanged. The callouts and Help say "press, drag down and let go". This conflict between the source and G-5 was resolved in favour of the guardrail. |
| 3 | **Manual clamps were too broad.** Every manual camera input clamped pitch, distance and the look-at point together, so the first pan after an eye-level view (0.16 m) jumped to 0.3 m. The source clamps only what each input changes. | Per-axis clamps, as in `app.js:125-126, 136, 148-149`. |
| 4 | **The hand controller missed four source rules:** an open hand drops a lock or squeeze (`interaction.js:108`); before insertion, sliding onto a neighbour hands the lock over (`slidOff`, `:71-77`); a stroke bound with the tip in is cancelled when the tip leaves (`:122-127`); a press needs a gripping hand (`:166`). | All four ported, with tests. |
| 5 | **A pipette delivery needed no squeeze.** It emptied on lowering alone. The source's delivery, like the real technique, needs the plunger pressed at depth. | It now needs the squeeze: lowered in then squeezed, or squeezed first and then lowered. |
| 6 | **TARE did not need a lock.** It acted on any press with the hand near the key; §8 says "lock on the key". | The aim must settle on the key (160 ms) before a press counts. |
| 7 | **The hand dropped its item when tracking was lost.** A short tracking loss, or a change to hand settings, put the carried item back. The source keeps the tool (`app.js:358`). | Only the motion in progress is dropped; Stop camera and closing the panel still put the item back. |
| 8 | **Mouse moves were not ignored while the camera ran** (`app.js:121`). | Ignored. |
| 9 | **The hand re-rendered the player at about 30 Hz.** The cursor and meter went through React state; the source moves them directly. | The cursor and meter are moved through refs. The guide refreshes every 150 ms (`app.js:367`). |
| 10 | **Hand carries showed drag wording.** Their callouts said "Release to …". | They now name the hand's action: "Open your palm to …", "Pause here, then lower your hand to …", "… turn your palm to …", "… lower in and squeeze to …". |
| 11 | **The Low tier was not the source's Low.** It added a vignette and dither that the source's Low path has none of (`renderer.js:46-50`). | Removed on Low. |
| 12 | **Smaller defects:** comments cited wrong source lines (up to 40 lines out); the environment map was 32-bit float, whose linear filtering needs an extension; touch camera gestures could lose a lifted finger; "Set centre here" gave no confirmation; `coveredSides` was left unused. | Fixed: line references corrected, half-float map, pointer capture, the source's "Centre set…" message, dead code removed. |

**Verified, no change needed:**
- The environment's orientation: a mirror sphere shows the window highlight upper-left, at (64, 71) against an expected (61, 82), so no flip.
- MediaPipe 1.0.1 returns `landmarks`, `worldLandmarks` and `handedness`, as the ported tracker reads them.
- The room's sizes, positions and colours against `scene.js:57-84`.

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
- **Worktop texture.** The resin is the source's pattern 1 (`renderer.js:58`), as a 0.2 m tile: the fbm, plus light specks in 1/240-unit cells and dark ones in 1/170-unit cells.
- **Lights** (`renderer.js:126, 163-170`):
  - key `[3.0, 2.82, 2.55]` from (−6, 9, 3.5), with the source's shadow box scaled and 22% of it left in shadow;
  - fill `[0.55, 0.68, 0.84]` from (6, 4, −2);
  - the hemisphere ambient, sky `[0.26, 0.27, 0.29]` and ground `[0.11, 0.10, 0.09]`, scaled by π for three.js.
- **Shading** (`roomLighting.ts`, the review's fix 1). As in `renderer.js:67-81`:
  - The ambient comes from the hemisphere light only.
  - Reflections come from the room's environment at full strength, and glass reflects at 0.62.
  - Rim darkening runs towards 60% at grazing angles (glass towards 62%).
  - three.js would also light diffuse surfaces from the environment map, so every material is patched to drop that term (`iblIrradiance`).
  - The source's ground occlusion is not reproduced; contact shadows do that work.
- **Environment** (`environment.ts`). The source's analytic `env()` is evaluated into a half-float equirectangular map (the gradient plus the window, panel and strip lobes), then prefiltered by PMREM.
- **Frame** (`composer.ts`):
  - linear HDR with MSAA;
  - bloom through UnrealBloomPass: threshold 1.05, smooth width 0.5 for the knee, strength 0.45;
  - the source's composite pass ported as written: Narkowicz ACES, vignette, gamma 1/2.2 and dither;
  - no tone mapping in the renderer itself.
- **Tiers:**

  | Tier | DPR cap | MSAA | Key shadow map | Bloom | Vignette and dither |
  |---|---|---|---|---|---|
  | High | 1.6 | 4 | 2048 | yes | yes |
  | Balanced | 1.25 | 4 | 2048 | yes | yes |
  | Low | 1 | none | 1024 | no | no (the source's Low path) |

  Contact-shadow and texture sizes stay Lab Studio's.
- **Background.** The clear colour is (0.55, 0.56, 0.55), and the page behind the canvas is `#d1d2d1`.

### P2: camera (`bench/camera/benchCamera.ts`, `BenchEngine.ts`)
- **The view.** OrbitControls is gone; the camera is the source's model (`renderer.js:12`):
  - an orbit about `at` by yaw, pitch and distance;
  - FOV 42°;
  - near 0.04 and far 80 units, scaled;
  - on viewports narrower than 1.1:1, the distance grows by 1.10/aspect.
- **Manual limits** (`app.js:121-151`, scaled): pitch 0.35–1.55, distance 3.2–20 units, `at.x` ±7 and `at.z` ±4.5; yaw is unbounded. Each input clamps only what it changes (fix 3).
- **Mouse.**
  - Right-drag pans sideways, keeping the bench point under the pointer, and tilts with up and down.
  - Shift or Alt + right-drag, or middle-drag, orbits at 0.006 and 0.005 rad/px.
  - The wheel zooms by e^(Δ·0.0012) toward the bench point under the pointer.
  - Drags start after 3 px; a right click without a drag puts a held item back.
- **Touch** (choice 5): one finger pans and tilts, a pinch zooms, and two fingers orbit. A touch that picks up an item holds the camera.
- **Auto-framing.**
  - The source's `fit()` (14 projections) fits into the largest of the source's free rectangles around the open panels (`safeRects`, `app.js:83-97`), above the hint and dock.
  - Pitch is 0.9, and yaw turns back to the front the short way (choice 11).
  - It tweens over 650 ms with easeInOutCubic, or cuts under reduced motion.
- **Views.**
  - Whole bench, Overhead and Home are the source's bench preset, Top preset and default view.
  - Presets tween over 650 ms, as Lab Studio's camera motion does (handoff §3.5); the source cuts to them.
  - Examine and eye level remain programmatic views outside the manual limits.
  - The Studio's Front, Top and Reset, and the turntable, use the same engine (choice 9).

### P3: the left button (`bench/input/useBenchCarry.ts`)
- **Picking up.** A mouse press on an item or a tray tile picks it up, and it follows the pointer with no button held.
- **What the next press does** (`PressAction`):
  - it acts at once to set down, place, tip a scoop, hold a pipette over a vessel, or be refused;
  - on a seat, a pour target or a liquid it starts a stroke: drag down, where 28 px is full depth and 0.85 acts, then let go at depth to act (G-5, fix 2); 32 px back up withdraws;
  - the spatula scoops by a stroke into the solid (a carry cue only, so it loads at depth).
- **Putting it back.** Esc or a right click puts the item back. A second press at once where it was picked up (a double-click) puts it back and opens Examine.
- **Picking stays Lab Studio's.** The mouse picks by raycast and judges targets by footprint overlap, as before. §6.3 left this to be decided in P3 with a look, and the mouse run showed it reaching raised seats, the TARE key and the slender spatula. The hand picks by screen-space anchors and radii, as the source does.
- **Unchanged.**
  - The release resolution, its 2D order and the intents (`sceneToIntent.ts`).
  - Touch's press-and-hold carry, the keyboard carry, tray Enter, drop mode, inversion and TARE.
- **Copy.** Callouts, hints and the Help table use the click model's wording ("Click to set down", "Press, drag down and let go to place…").

### P4: hand control (`src/studio3d/hand/`)
Transcribed into TypeScript, each module naming its source (choice 12):
- `handCore.ts`: `hand-core.js`;
- `handTracker.ts` (with a module worker and `handDetector.ts`): `camera.js`;
- `handController.ts`: `interaction.js` and `app.js` picking;
- `handTuning.ts`: `hand-tuning.js`.

**MediaPipe.** HandLandmarker 1.0.1 in VIDEO mode, two hands, every confidence 0.5, GPU then CPU, with a main-thread fallback. The model is the bundled `public/mediapipe/models/hand_landmarker.task`, and no CDN is used.

**The gesture table** (§8, with the review's fixes 5 and 6):

| Action | Hand |
|---|---|
| Pick up an item or a tray item | Closed grip held 350 ms |
| Set down, place, or hold a pipette over a vessel | Open palm held 450 ms |
| Seat (stopper, funnel, cuvette, glass on the pan, pump) | Lock, then lower the palm (depth 0.85) |
| Empty a pipette into a receiver | Lock, lower in, squeeze (or squeeze first, then lower in) |
| Pour, or tip the spatula's scoop | Lock, then turn the palm past 60° |
| Draw | Squeeze above the liquid, lower in, let go. Squeezing with the tip already in is "Bubbles!"; lifting out with the bulb still squeezed recovers it |
| Scoop with the spatula | Lower into the solid |
| Drops (drop mode) | One per plunger press; a press held 300 ms runs |
| Invert | Grip the stoppered flask, turn the palm over (past 1.92 rad) and back (under 1.05): one inversion |
| TARE | Pause on the key until it locks (160 ms), then press the plunger |

**Source rules kept.**
- An open hand drops a lock or squeeze.
- Sliding onto a neighbour before insertion hands the lock over.
- Leaving with a stroke bound and the tip in cancels it with nothing transferred.
- Sway and tremor are tolerated (exits must last 300 ms unless deliberate).
- Aim assist snaps to the step's next target within 76 px, in guided mode only.

**Panel buttons.** Buttons marked `data-hand-press` take a grip-dwell: At the line, Put the pipette down, and the step card's Confirm, Submit and Record.

**Other behaviour.**
- **Exclusive input.** A mouse press or the wheel stops the camera, and mouse moves are ignored while it runs (choice 6).
- **Tracking loss.** A loss, or a change of setting, drops only the motion in progress; Stop camera, closing the panel, Restart and leaving the player stop the camera and put a held item back.
- **The hand panel** (choice 8) holds:
  - the preview with the tracked hand drawn;
  - a live guide line, refreshed every 150 ms;
  - the set-up tracker: Start camera, Hand, then Capture Rest and Capture Press (or Set centre and a first pinch in pinch mode);
  - the plunger meter;
  - gesture cards for these actions;
  - Hand settings: plunger gesture, cursor speed 1–4, smoothing, aim assist;
  - the status and inference line;
  - Lab Studio's privacy wording.
- **The cursor** is a ring: teal while aiming, and gold, filling with depth, when locked. It and the meter are moved directly each frame.

**Removed.** Player3D no longer imports the 2D gesture engine or bridge. The 3D bridge resolver (`bench/input/targetResolver.ts`) is deleted.

**Untouched.** Nothing under `src/player/**` or in `src/styles/app.css` changed (checked with `git diff`).

### P5: records
- `AGENTS.md`: the Student Player gesture rules now say they govern the 2D player, and a "Player3D Hand Control Rules" section names the 3D modules (choice 10).
- `DECISIONS.md`: the build row, with the interpretations below.
- `SESSION_HANDOFF.md`: brought up to date.

## Interpretations made while building (to confirm)

1. **Ground occlusion is not reproduced.** The source darkens the lower sides of objects near the bench; Lab Studio's contact shadows stand in for it.
2. **"All items" framing** also takes in the runtime bench, so a lone item is not shown as a close-up. Working-set framing grows the items' bounds by 1.6.
3. **A double-click puts the item back.** In the click model the first press of a double-click picks the item up; an immediate second press there puts it back, and Examine opens.
4. **Touch keeps drag and release.** The source has no touch control of equipment.
5. **Aim assist only in guided mode.** It snaps to the step's next target, which is guidance (G-7).
6. **An open palm over a stroke target does nothing.** It does not let go over a seat, a liquid or a pour target; the guide says to lower or turn instead. Open-palm set-down is for "commit" spots.
7. **Inverting needs no carry.** The flask is gripped where it stands; the existing inversion animation draws each count.
8. **Panel buttons a hand may press** are At the line and Put down (§8), plus the step card's Confirm, Submit and Record, which the 2D bridge had already opted in.
9. **The panel shows the source's status and inference line.** This supersedes the M7 row "no runtime metrics".
10. **Hand settings** are stored under `lab-studio:3d:v1:hand`, a preference only. It is a fourth UI key beside handoff §3.8's three.
11. **The mouse keeps raycast picking and footprint overlap** (P3 above). The hand picks the source's way.
12. **Mouse strokes act on release** (G-5); the source commits a delivery on reaching depth.
13. **Presets tween** over 650 ms; the source cuts to them.

## Checks
- `npx tsc -p tsconfig.app.json --noEmit` exits 0 after every phase and after the review. Tests are included in that project.
- `python tools/blender/validate_equipment3d.py --pack 1`: PASS, 20 definitions, 2.1 MB (P1).
- Probes: `validate-weighing.mts` 32/32; `probe-catalog-policy.mts` accepted for all five Pack 1 techniques (P3).
- **Looks** (headless Chromium with SwiftShader, since the pane was hidden), with no console errors:
  - P1: Dilute a Stock Solution under the new room, at Low and Balanced; the microarray lab itself was also looked at, for comparison.
  - P2: the auto view, Whole bench and Overhead.
  - P4: the hand panel.
  - Review: the bench at Balanced under the reproduced shading (the shader patch compiles), and the hand panel.
- **The environment's orientation** was checked with a mirror sphere (see the review).
- **A mouse run of Weigh a Solid** (`probes/run-weighing-mouse.cjs`, reduced motion on, real mouse events), run after P3 and again after the review, with no console errors:
  - four tray items clicked onto the bench;
  - a right click put a held bottle back;
  - the watch glass carried to the balance, pressed down onto the pan and let go (step 1 → 2);
  - the TARE key clicked (2 → 3);
  - the spatula pressed down into the bottle ("Scooped from the reagent bottle"), then clicked onto the glass (3 → 4);
  - a double-click opened Examine.

## Tests written, not run
- `microarrayLook.test.ts`: geometry, scale, colours, lights, environment, the shading patch, bloom.
- `benchCamera.test.ts`: camera model, clamps (including per-axis), orbit, pan, zoom, front yaw, `fit`, `safeRects`, `fitBest`.
- `clickCarry.test.ts`: stroke depth, and the click and hand callouts.
- `handControl.test.ts`: adapted from the source's `hand-aim.test.cjs`. It covers:
  - the hand core and picking;
  - take and set-down;
  - aim, lock and sway;
  - the open-hand reset, the slide-off handover and the cancelled stroke;
  - the draw technique and delivery by squeeze;
  - drops, inverting, and the TARE lock.
- `handTracker.test.ts`: adapted from `camera-lifecycle.test.cjs`. It covers:
  - camera denial and stale packets;
  - calibration and plunger edges;
  - a draw through the controller;
  - hand switching;
  - pinch-mode home and gain.
- `player3DHandControl.test.tsx`: the panel and its tracker, pinch mode, the gestures, collapse, `data-hand-press`, the guide line and the badge.
- `panelLayout.test.ts`: the `coveredSides` case removed with the function.

## Not run or not seen
- **G3 (real webcam).** The built-in pane blocks the camera, and Claude in Chrome was not connected. Hand control has been checked only by source review, typecheck and the written tests.
- **The fake-camera smoke test,** not run as you decided.
- **Normal motion in the pane, and touch** (tablet pan, pinch and orbit).
- **Mouse strokes beyond the seat.** Assessment mode, drop mode, pipette strokes and the pour stroke with the mouse were not run; the run covered weighing only.
- **The Studio's Starting bench and turntable** under the new camera.

## Notes
- **Line endings.** The P2 commit turned `Player3D.tsx` from CRLF to LF; Git Bash's `sed -i` did it. P3 restored CRLF. Edits to CRLF files now go through a byte-aware script only.
- **Room proportions.** At the agreed scale the room is to the microarray's proportions. Real-size Lab Studio glassware therefore looks small against the Whole bench view; the auto view frames the working set.
- **Colour under ACES.** ACES shows the palette's colours a little darker and less saturated than PBR Neutral did. The palette itself (`resolveLiquidStyle`) is unchanged (G-9).
