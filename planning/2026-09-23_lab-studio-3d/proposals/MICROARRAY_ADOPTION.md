# Adopting the microarray lab's environment, bench view, mouse and hand control (port brief, 2026-10-03)

**Decided by you, 2026-10-03:** "Definitely the lab env, bench view and mouse control of the bench (right and left clicks and moving/repositioning the bench), the hand gesture controlling the equipment must be used from here : C:\Users\EmilJivishov\Projects\virtual_lab\experiments\dna-microarray-3d\microarray-3d.html".

This brief is the plan for carrying that out. Nothing is built yet.
- **How it was written:** from three read-only studies of the microarray lab and of Lab Studio 3D, with the key lines re-checked by hand.
- **Line references:** to `virtual_lab\experiments\dnamicroarray_v2\3d-v3\` unless another file is named; they were read on 2026-10-03.
- **(confirm):** marks my defaults, listed again in §9 for your answer before the work they affect starts.

## 1. Source

- **The folder you named holds the published code.**
  - `experiments\dna-microarray-3d` has no git history.
  - It has the same content as the published `experiments\dnamicroarray_v2` (virtual_lab commit `9495489`, 2026-09-28). The 12 files that `diff` reports differ only in line endings, because the virtual_lab checkout uses `core.autocrlf=true`.
  - Line numbers hold in both copies. Neither copy is edited.
- **Layout.**
  - `microarray-3d.html` loads 14 classic scripts from `3d-v3\`, each an IIFE that sets a global: protocol, analysis, session, hand-core, interaction, renderer, liquid, scene, framing, camera, hand-tuning, panels, notebook-ui, app. About 250 KB of JavaScript.
  - `3d-v3\README.md` and `FIDELITY-REVIEW.md` describe the design.
  - `3d-v3\tests\` holds 63 node tests.
- **Licence.**
  - The code is yours, MIT ("Copyright (c) 2025 jivishov", the virtual_lab root `LICENSE`).
  - The vendored MediaPipe carries no licence text. MediaPipe is Apache-2.0 upstream (general knowledge, not stated in the folder).
- **A worked example exists.** virtual_lab commit `08e7ac0` (2026-09-28) restyled the ELISA 3D lab after the microarray lab and ported its hand control (`experiments\elisa_assay\3d-classroom\`).
  - ELISA took the custom renderer wholesale.
  - It extended the interaction controller with actions the microarray lacks. Turning the palm over inverts a held strip (`elisa_assay\3d-classroom\interaction.js:177-180`): inverted past 1.92 rad of palm turn from the pick-up pose, upright again below 1.05.
  - It also added lock-to-touch labelling and towel taps.
- **Lab Studio's own handoff already points here.** `UI_UX_HANDOFF.md` line 7 says Player3D "takes the beauty and functionality of `…\dna-microarray-3d\microarray-3d-v3.html`". That file now redirects to `microarray-3d.html`.
  - Until now only its patterns were re-implemented (§0, line 17).
  - Now its look, its camera and mouse handling, and its hand pipeline are used.

## 2. Scope

**Taken, as you listed them:**
1. **Lab environment:** the room, the bench and the lighting look.
2. **Bench view:** the camera model, its limits and presets, and auto-framing.
3. **Mouse control:**
   - the left button on equipment;
   - right-drag pans and tilts;
   - Shift or Alt + right-drag, or middle-drag, orbits;
   - the wheel zooms toward the pointer.
4. **Hand-gesture control of equipment:** the MediaPipe pipeline, the cursor, the gestures, the thumb-plunger calibration, aim assist, lock-on and insertion.

**Not taken** (not in the decision):
- the microarray's protocol model, step card, panels, notebook, Run/Pause/Stop and clock, analysis and saved sessions;
- its apparatus: QuickStrip, card, tube rack, tip box, incubator, UV area, pipette stand.

**Lab Studio keeps:**
- its runtime and content;
- its GLB equipment, step card, floating panels, tray and Bench list (the "Targets" twin, G-6);
- the notebook, results, provenance and keyboard maps;
- free moves, drop mode, eye level, inversion and TARE;
- every guardrail except G-10, which no longer applies to 3D.

## 3. Lab environment

### 3.1 The microarray lab
- **Its own WebGL2 renderer, not three.js** (`renderer.js:1-5`, "adapted from the existing ELISA WebGL2 renderer").
  - Geometry is procedural only (`box`, `bevelBox`, `lathe`, `cylinder`, `sphere`, `torus`, `plane`; `renderer.js:10`).
  - There are no model or image files. Labels and signs are canvas textures.
- **Shading** (`renderer.js:20-87`):
  - GGX specular with Schlick Fresnel, and Lambert diffuse;
  - hemisphere ambient, a shadowed key light and an unshadowed fill;
  - analytic environment lobes for reflections: a window, a ceiling panel and a strip (`:33-38`);
  - rim darkening (`:77`);
  - ground occlusion, which darkens vertical faces within .34 units of the bench (`:66`);
  - procedural surface patterns: resin specks on the bench, paper fibre, brushed steel, polypropylene (`:54-62`);
  - double-sided materials throughout.
- **Frame** (`renderer.js:94-112`): RGBA16F HDR with 4× MSAA; bloom (threshold 1.05, knee .5, strength .45); Narkowicz ACES at exposure 1.0; a vignette; output gamma 1/2.2; dither.
- **Quality tiers** (`renderer.js:114`):

  | Tier | DPR cap | MSAA | Shadow map | Bloom and HDR |
  |---|---|---|---|---|
  | high | 1.6 | 4 | 2048 | yes |
  | balanced (default) | 1.25 | 4 | 2048 | yes |
  | low | 1 | none | 1024 | no |

- **Room** (`scene.js:57-84`). Hex colours are linearised with a plain 2.2 gamma.

  | Element | Size (scene units) | Material |
  |---|---|---|
  | Worktop | 15 × .22 × 10, top at y −.02 | slate-blue resin `#5e6a71`, rough .5, speckled pattern |
  | Front lip | 15 × .08 × .14 | wood `#a47a50` |
  | Cabinet front below the lip | 15 × 3.2, four door gaps, eight handles | `#c9c3b6`; handles steel `#c3c8ca`, metal .85 |
  | Back wall | 15 × 4.4, at z −4.6 | cream `#dcd3c2`, rough .92 |
  | Skirting rail, window bars and sill | — | trim `#e7e4dd` |
  | Window | 4.6 × 2.1 pane, emission 1.9; three mullions, three transoms | `#e3ecef` |
  | Shelf with five bottles | 3.8 × .07 × .42, at y 2.45 | wood `#b08a60`; amber, clear and white bottles |
  | Wall text "MOLECULAR BIOLOGY · TEACHING LAB"; a UV warning sign | decals | — |

  There is no floor, ceiling or side wall; a grey clear colour fills the rest.
- **Lights** (`renderer.js:122, 126, 163-170`):
  - key: directional `[3.0,2.82,2.55]` from (−6, 9, 3.5), with a 2048 shadow map, 5×5 PCF and 22% of the key light left in shadow;
  - fill: `[.55,.68,.84]` from (6, 4, −2);
  - hemisphere: sky `[.26,.27,.29]`, ground `[.11,.10,.09]`.
- **Units are arbitrary and not to scale** (`scene.js:1`; `FIDELITY-REVIEW.md:53`): roughly 6–10 cm per unit.

### 3.2 Lab Studio now
- **Units and bench.**
  - three.js 0.184, metres, Y up.
  - The bench is `BENCH_MM` 1400 × 700 mm, mapped to the runtime's 760 × 520 px bench (`src/studio3d/adapters/benchCoordinates.ts:23-33`).
  - The GLB equipment is at real size.
- **Look** (`src/studio3d/bench/BenchEngine.ts:156-228`):
  - Khronos PBR Neutral tone mapping;
  - the "room" is a blurred PMREM of a synthetic box (`bench/look/environment.ts`), used as both environment and background;
  - a 1.4 × 0.7 m worktop with procedural resin maps;
  - one directional light and contact shadows;
  - a composer with a vignette and no bloom (`bench/look/composer.ts`).
- **Tiers** high, balanced and low (`BenchEngine.ts:85-89`).
- **Materials tuned to this lighting:** glass, liquids and instrument enclosures (`bench/look/materials.ts`, `equipment3d/viewerMaterials.json`).

### 3.3 Port
- **Keep three.js (confirm).** Lab Studio's GLB equipment, PBR glass and liquids, contact shadows, picking and animations are all built on it, and the custom renderer loads no models. ELISA could take the renderer wholesale because all its apparatus was procedural.
- **Rebuild the room as real geometry:**
  - Transcribe `bevelBox` and `lathe` exactly. three.js's `RoundedBoxGeometry` and `LatheGeometry` differ in topology and normals.
  - Build the room table above, with the window and shelf.
  - Keep Lab Studio's worktop and `BENCH_MM`, which is the runtime mapping.
  - Scale the room around the worktop by one factor. Fitting the 15-unit worktop to 1.4 m gives about 0.093 m per unit. Record the value used.
- **Match the look:**
  - the linearised colours;
  - the three lights mapped to three.js, with the shadow box scaled;
  - an output pass in place of `OutputPass`: Narkowicz ACES, exposure 1, the vignette, gamma 1/2.2 and dither. three's own ACES and sRGB output differ.
  - bloom with the same threshold and knee;
  - ground occlusion and rim darkening through `onBeforeCompile`, if the look needs them;
  - an environment map for reflections generated from the new room. It only approximates the analytic lobes.
- **Scenery (confirm):**
  - keep the wall, window, shelf and bottles, cabinet front and lip;
  - drop the UV warning sign;
  - the wall text becomes "CHEMISTRY · TEACHING LAB".
  
  Scenery stays out of the runtime (G-8). The microarray's apparatus is not environment and is not ported.
- **Retune** the glass, liquid and enclosure materials under the new light, and check one technique's look (G1).
- **Tiers:** the microarray's DPR, MSAA, shadow and bloom settings, under Lab Studio's existing preference (`lab-studio:3d:v1:player-ui`).

**Replaces:**
- `UI_UX_HANDOFF.md` §3.7 "Look" (lines 224-230: PBR Neutral, no bloom, a soft-focus room);
- `IMPLEMENTATION_PLAN.md` §6.2 "Viewer lighting" (line 418).

## 4. Bench view

### 4.1 The microarray lab
- **Camera model** (`renderer.js:12`):
  - It orbits a look-at point `at` by yaw, pitch and distance. The eye is `at + (sin yaw·cos pitch, sin pitch, cos yaw·cos pitch)·distance`.
  - Vertical FOV 42°, near .04, far 80. On viewports narrower than 1.1:1, the distance grows by `1.10/aspect`. There is no roll.
- **Default** `{at:[0,.35,.65], yaw:0, pitch:.72, distance:11.2}` (`renderer.js:119`). Start-up auto-frames at once (`app.js:481`).
- **Limits for manual input** (`app.js:125-149`):
  - pitch .35–1.55 rad (20°–89°);
  - distance 3.2–20;
  - `at.x` ±7 and `at.z` ±4.5;
  - yaw unbounded.
  
  Presets and auto-framing do not clamp.
- **Presets** (`app.js:104-110`; html:95-96):
  - Whole bench: at [0,.24,−.6], pitch .89, distance 15.5;
  - Top: pitch 1.535, distance 14.8;
  - three zone views;
  - "Auto · follow the step";
  - "Show me", which turns auto-framing back on.
- **Auto-framing** (`framing.js`):
  - **Fit.** The step's working set is fitted into the largest free rectangle around the open panels (`safeRects`, `app.js:81-97`). It takes up to 14 projection iterations at yaw 0 and a pitch set per step (`framing.js:29-50`).
  - **Tween.** 650 ms, easeInOutCubic; instant under reduced motion (`framing.js:71-83`).
  - **When it reframes.** When the step's state key changes; when Auto or Show me is chosen; and when panels, the notebook or the canvas size change. It waits while a stroke is in progress.
  - **Manual moves** suspend it until the state key next changes (`framing.js:84`).
- **No damping or inertia.**

### 4.2 Lab Studio now
- **Camera.** `PerspectiveCamera` with a 32° FOV; home pose from (0, .62, 1.05) looking at (0, .06, 0) (`BenchEngine.ts:101, 147`).
- **Controls.** three's OrbitControls (`BenchEngine.ts:181-198`): azimuth ±70°, elevation 12°–70°, distance .22–2.4 m, zoom to cursor, no damping.
- **Auto-framing.** `frameBox` (`BenchEngine.ts:1465-1479`) keeps the current view direction and fits a bounding sphere, with side insets from `coveredSides` (`player/panelLayout.ts:96-108`).
- **Views.** The menu offers Auto, Whole bench, Selected item and Overhead, plus Reset view and the `A` and `Home` keys. Examine and eye level (`BenchEngine.ts:1440-1463`) are used by drop mode.
- **Eye-level distance clamp (inference).** Drop mode asks for eye-level distances of 0.16 m and 0.2 m, but OrbitControls' clamp holds them at 0.22 m.

### 4.3 Port
- **Camera.** Replace OrbitControls with the microarray camera model and its clamps. Don't substitute OrbitControls: its button roles, its panning and its damping all differ.
  - Scale the distance and pan clamps by the factor in §3.3. Keep FOV 42°.
- **Programmatic views stay outside the manual clamps,** as the microarray's presets do: eye level needs a pitch near 0°, below the 20° manual minimum. Manual input re-clamps.
- **Auto-framing.** Port `fit()` and the safe-rectangle search, fed by:
  - Lab Studio's working set: the step's source, target and tool, and their holders, as now;
  - the open panels.
  
  Pitch .9 unless a step needs another.
- **Views.**
  - Take Whole bench and Top from the microarray, and keep Selected item, Auto and Show me.
  - Keep `A`, `Home`, Examine and eye level as engine methods with their current signatures, so drop mode and Examine keep working.
- **Yaw (confirm).** Auto-framing turns the short way back to the front. The source can spin back through every full orbit made by hand.

**Replaces:**
- `UI_UX_HANDOFF.md` §5.9 mouse and touch camera (lines 688-696: right-drag orbits within ±70° and 12–70°, Shift + right or middle pans, one finger orbits);
- `IMPLEMENTATION_PLAN.md` §5.2 "right-drag to orbit" (line 386).

## 5. Mouse control of the bench

### 5.1 The microarray lab (`app.js:111-152`, re-checked)

| Input | Effect |
|---|---|
| Left press | Acts at once on the equipment under the pointer; there is no click/drag threshold. The left button never moves the camera. |
| Right-drag | Sideways movement pans the bench, keeping the bench point under the pointer under it. Up/down tilts the view. |
| Shift or Alt + right-drag, or middle-drag | Orbits: yaw .006 rad per px, pitch .005 rad per px. |
| Right click (under 3 px of movement) | Cancels a motion in progress. No context menu. |
| Wheel | Zooms toward the bench point under the pointer: distance × e^(deltaY·.0012). |
| Keyboard | No camera keys. |

- Camera drags start after 3 px.
- Any mouse press or wheel stops hand control (`useMouse`, `app.js:78`). Pointer moves are ignored while the webcam runs.
- "Moving and repositioning the bench" is this camera navigation. Nothing moves the bench itself.

### 5.2 Lab Studio now
- **Camera** (OrbitControls): right-drag orbits; Shift, Ctrl or Meta + right-drag, or middle-drag, pans; the wheel zooms toward the pointer.
- **Left button** (`bench/input/useBenchCarry.ts:527-620`; `player/Player3D.tsx:508-566`):
  - a press on an item becomes a carry after 4 px or 120 ms;
  - a left press on empty bench does nothing;
  - a click selects, and a double-click opens Examine;
  - a press on TARE acts on release.

### 5.3 Port
- **Camera:** the table in §5.1, built in BenchEngine.
- **Touch (confirm).** The source has no touch camera; a touch acts as a left press. Tablets are in scope (G-12), so:
  - one finger on empty bench pans and tilts, as a right-drag does;
  - a pinch zooms;
  - a two-finger drag orbits.
- **The left button:** §6.
- **Copy to rewrite:** the Help table (`player/panels.tsx:285-309`) and the hints (`player/Player3D.tsx:673-679`). The approved mock-ups stay as the record.

## 6. Moving equipment: the left button

### 6.1 The microarray lab
- **Picking is screen-space** (`app.js:23-45`). Each target is an anchor point with a world radius, projected to pixels. The nearest target within its radius wins. There is no mesh raycast.
  - Minimum radius: 11 px for wells and spots, 14 px otherwise.
  - For the hand, the radius is ×1.5 with a 22 px minimum.
- **The tool model** (`interaction.js:54-62`; `scene.js:349-371`):
  - a press on a tool picks it up, and it then follows the pointer, hovering .32 units above the surface under it, without tilting;
  - a press on a target acts;
  - a carried card snaps to a station under the pointer, and a press places it;
  - tools go back through the dock's "Return tool" or "View", without animation.
- **Insertion with the mouse** (`hand-core.js:48`; `interaction.js:156-211`; `scene.js:360-365`):
  - press on the target and drag down: 28 px is full depth;
  - depth .85 delivers or draws, and .95 fits a tip;
  - dragging 32 px back up withdraws;
  - the tip descends between a high and a low point as depth grows.
- **Mouse and hand share one controller.** Both produce a "frame" `{x, y, now, source, …}` that goes to `Interaction.feed`.
  - Mouse presses arrive through `mouseDown` and `mouseUp`. Hand presses come from the plunger gate (`app.js:79, 361-369`).
  - The same picker, insertion logic and pose serve both.

### 6.2 Lab Studio now
- **Drag and release** (`useBenchCarry.ts`):
  - picking is a raycast, with pick proxies for slender items;
  - the item lifts 16 mm and follows the pointer.
- **On release,** the 2D release order decides the intent (`adapters/sceneToIntent.ts:120-153`):
  - place, pour, snap, tool transfer, pipette draw or delivery;
  - drop mode through hold-over;
  - or a free move.
  
  A refusal springs the item back.

### 6.3 Port (confirm the model)
- **Recommended: the microarray model for 3D.** Your decision names the left button, and in the source the hand uses the same controller.
  - **Picking up and acting.**
    - A press picks an item up, and it follows the pointer, lifted above the surface under it.
    - A press over a target acts on it.
    - A press over empty bench sets the item down there. This is Lab Studio's free move, which the microarray lacks; handoff line 7 says Player3D "goes further … moving objects around freely".
    - Esc or a right click puts it back.
  - **Insertion-like actions** work as the microarray inserts a tip: press on the target and drag down to depth. They include a pipette into liquid, a stopper or funnel into a neck, a cuvette into the photometer, and the spatula into the solid.
  - **What stays Lab Studio's:** the intents, their checks and the order they are resolved in (`sceneToIntent.ts`). Only what triggers them changes.
  - **Picking:** one picker serves mouse and hand, as in the source. Targets are anchor points and radii taken from the registry: an item's grip point and footprint, and zone and seat anchors. Keep raycasting where it is better, such as hover labels and seeing through enclosure glass; decide in P3 with a look.
- **Alternative:** keep drag-and-release for the mouse and use the microarray controller only for the hand. Fewer changes, but two models.
- **Replaces,** if the recommended model is chosen:
  - `UI_UX_HANDOFF.md` §2.2 "Do not take: the tool-selection model … Lab Studio's interactions are drag-based" (line 114);
  - §5.6's "press on the item and move 4 px, or hold for 120 ms" (line 613).
- **Kept either way:**
  - the keyboard carry (Enter, arrows, `[` and `]`);
  - the tray (a press on a tile picks the item up);
  - the Bench list actions and double-click Examine;
  - drop mode's press for a drop, and the inversion tap.

## 7. Hand control

### 7.1 The microarray lab (re-checked against `camera.js`, `hand-core.js`, `interaction.js`, `hand-tuning.js`)
- **Pipeline** (`camera.js:9-188`):
  - **Model:** MediaPipe Tasks `HandLandmarker` 0.10.17 (`vendor\mediapipe`, about 17.7 MB with the model). VIDEO mode; two hands detected and one used; all confidences .5.
  - **Where it runs:** in a worker, built by turning functions into a string (`camera.js:110`), with a main-thread fallback; GPU first, then CPU.
  - **Frames:** 640 × 480 at up to 30 fps, at most one every 31 ms. Packets older than 400 ms are dropped.
- **Cursor:**
  - **Driving point:** the palm point, the mean of landmarks 0, 5 and 17, so a thumb press never moves it (`hand-core.js:28-29`).
  - **Mapping:** centred on a "home" taken as the median of the first 20 frames; gain 2.2 (×1.3 vertically); clamped to the canvas.
  - **Smoothing:** One Euro filtered, with min cutoff 3.2−2.8·smoothing and beta 9−6·smoothing (`hand-tuning.js:17`).
  - **The ring:** a 22 px DOM ring, teal while aiming, enlarged with a teal depth fill when locked. The in-scene focus ring turns gold when locked.
- **Gestures** (`hand-core.js:25-46`; `camera.js:258-289`):
  - **Pick up:** a closed grip held 350 ms over a tool (`interaction.js:138-141`).
  - **Put away:** an open palm held 450 ms at the tool's stand (`HANG_MS`, `interaction.js:151`). It is refused while the tip holds liquid. An open hand anywhere else cancels the motion.
  - **The card:** placed with a 350 ms grip-dwell over a station (`interaction.js:59-60`).
  - **Thumb plunger** (the default mode):
    - a press counts at 55% of the calibrated Rest→Press travel, and a release below 30% (`camera.js:10-11`);
    - 65 ms and 75 ms debounces, with a dead band between.
  - **Pinch** (optional mode, no calibration): press below a pinch ratio of about .43, release above .61.
  - **Insert and withdraw:** lowering the palm inserts (depth = drop ÷ .042, counted as inserted at .85); lifting or sliding away withdraws (`hand-core.js:31-46`).
- **Calibration** (`camera.js:195-224`):
  - Capture Rest, then Capture Press, each taking about 3 s of a relaxed and then a pressed thumb;
  - at least 5 stable frames;
  - held in memory only, never stored.
- **Aim assist and lock-on** (`interaction.js:16, 71-127`; `app.js:23-45`):
  - **Assist:** the current target is preferred (its distance ×.72), and the next expected target snaps within 76 px when nothing is under the cursor.
  - **Locking:** a 160 ms pause within 8 px, or an 80 ms pause followed by a .006 palm drop.
  - **Sway:** tolerated for 300 ms.
  - **Leaving:** before the tip passes .35 it just unlocks; later, it cancels the stroke with nothing transferred.
- **Technique check:** pressing the plunger with an empty tip already immersed blows "bubbles", which is logged (`interaction.js:158-182`). Each stroke is tried on a copy first, so nothing is partly transferred.
- **Settings** (`hand-tuning.js`), saved in localStorage; the thresholds stay fixed:
  - plunger gesture (thumb or pinch);
  - cursor speed 1–4, default 2.2;
  - smoothing 0–1, default .5;
  - aim assist.
- **Panel** (html:156-189; `app.js:370-427`):
  - the dock's Hand control opens a floating panel, with Start camera inside it;
  - a set-up tracker: start → hand → rest → press;
  - the Rest and Press buttons and their guide text;
  - inference stats;
  - handedness: Auto, Right or Left.
- **Mouse and hand exclude each other** (`app.js:78, 113, 147`).
- **Tests:** `tests\hand-aim.test.cjs` (20) and `camera-lifecycle.test.cjs` (12) pin the lock, sway, plunger, calibration and lifecycle behaviour.

### 7.2 Lab Studio now
- **Shared with 2D.** Player3D uses the 2D engine and bridge (`src/player/gesture/**`, M7):
  - pinch to grab, and release to commit;
  - an open hand steers;
  - a four-finger wave scrolls.
- **The 3D resolver:** a raycast (`src/studio3d/bench/input/targetResolver.ts`).
- **MediaPipe:**
  - `@mediapipe/tasks-vision` is unpinned ("latest"; installed 1.0.1), run in a module worker (`gestureWorker.ts`);
  - the models are in `public/mediapipe/models/`, and `hand_landmarker.task` is byte-identical to the microarray's.
- **Gaps found in the code review** (not seen live):
  - a pinch on the balance carries it instead of pressing TARE;
  - drops cannot be added by hand;
  - inverting works only through the step card's button;
  - the hand cannot move the camera, and neither can the microarray's.

### 7.3 Port
- **3D-only modules,** for example `src/studio3d/hand/`. Transcribe into TypeScript:
  - `hand-core.js`;
  - the per-frame part of `camera.js`: result, stabilise and the calibration statistics;
  - `interaction.js`'s lock, contact and sway logic;
  - `hand-tuning.js`.
- **The worker.** Replace the string-built worker with a module worker.
  - It imports `@mediapipe/tasks-vision` from the package and loads `public/mediapipe/models/hand_landmarker.task`.
  - Check the installed 1.0.1 against the source's 0.10.17 behaviour. Pinning the package is a change for you to approve.
- **The 2D player stays unchanged.** Don't edit `src/player/**` (the gesture engine, the bridge and `StudentPlayer.tsx`) or `src/styles/app.css`. Player3D stops importing them.
- **Controller actions become Lab Studio intents** through `sceneToIntent.ts`, with origin `"vision"`. The runtime's refusals take the place of the microarray's protocol errors.
- **The panel (confirm).**
  - Run the microarray's flow inside Lab Studio's floating "hand" panel: its set-up tracker, the Rest and Press calibration, and Hand settings.
  - Keep Lab Studio's privacy wording.
  - The two apps already agree on the rest: the panel opens first, Start camera is inside it, and closing it stops the camera (`DECISIONS.md` line 23).
- **Exclusive input (confirm):** a mouse press or wheel stops the camera, as in the source.
- **Gestures for Lab Studio's actions:** §8, for your confirmation before this part is built.

**Replaces, for the 3D player only:**
- `UI_UX_HANDOFF.md`:
  - §0 line 17 (the code and hand pipeline "are not used");
  - §2.2 line 117 (aim assist and lock-on "in the shared bridge … or nowhere");
  - G-10 (line 34);
  - §5.15 line 776 and §5.18 line 825 ("the shared bridge").
- `IMPLEMENTATION_PLAN.md`: D6 (line 199), §5.3 (line 398) and the M7 row (line 452).
- The M7 rows in `DECISIONS.md` (lines 19-26 and 41), where they conflict.

**Also conflicts: the repo's `AGENTS.md` gesture section.**
- Line 59: one shared Student Player gesture system, with no per-lab systems.
- Line 127: no new camera stack.
- Line 152: no second drag-and-drop system for gesture input.

It needs a 3D amendment, which you approve (§9).

## 8. Gestures for Lab Studio's actions (proposal, confirm before building)

The microarray has pick-up, put-away, insertion, and plunger press and release. It has nothing for tilting, inverting, swirling or pressing keys; the ELISA port added a palm turn.

| Lab Studio action | Hand | Mouse (§6.3) | Basis |
|---|---|---|---|
| Pick up an item | Closed grip held 350 ms over it | Press on it | microarray |
| Set it down on a zone or a free spot (`placeIntent`, free move) | Open palm held 450 ms over the spot | Press on the spot | the microarray's put-away at the stand, generalised; its card uses a grip-dwell instead |
| Pour into a vessel (`pourIntent`) | Lock on the target, then turn the palm: the pour starts past about 60°, and turning back upright ends it | Press on the target and drag down to tilt | ELISA's palm turn; new |
| Seat into a slot or neck: stopper, funnel, cuvette, the glass on the pan (`snapIntent`) | Lock on the seat and lower the palm | Press on the seat and drag down | microarray insertion |
| Draw into a pipette (Beral, or graduated with the pump) | Press the plunger (squeeze) above the liquid, lower in, release to draw | Press on the liquid, drag down, release | the microarray's draw, which is the real technique |
| Deliver drop by drop (`dispenseDropIntent`) | Lock over the vessel; each plunger press is one drop, and a held press runs | A press for a drop, held to run (as now) | the microarray plunger, in drop mode |
| At the line (`dispenseCompleteIntent`) | Grip-dwell on the panel's "At the line" | Enter or the button (as now) | — |
| Invert to mix | With the stoppered flask held, turn the palm over and back; that is one inversion | Click the flask (as now) | ELISA's palm turn |
| Press TARE | Lock on the key and press the plunger | Click the key (as now) | new |
| Spatula: dip, then tip into the glass | Lower into the solid, then turn the palm over the glass | Press and drag down, then press on the glass | microarray insertion plus ELISA's turn |

- Calculation and record steps stay on the step card.
- Swirling (Make a Solution) is designed with that technique.

## 9. Choices for you (the defaults are followed unless you say otherwise)

1. **Renderer:** keep three.js, and rebuild the microarray room and look in it (§3.3).
2. **Scenery:** keep the room, shelf and bottles; drop the UV sign; the wall text becomes "CHEMISTRY · TEACHING LAB".
3. **Scale:** Lab Studio's bench and runtime mapping stay; the room scales by about 0.093 m per microarray unit.
4. **Left button:** the microarray model for 3D: press to pick up, press to act or set down, drag down to insert (§6.3).
5. **Touch:** one finger on empty bench pans and tilts; a pinch zooms; a two-finger drag orbits.
6. **Exclusive input:** mouse and hand exclude each other, as in the source.
7. **Gestures:** the table in §8.
8. **Hand panel:** the microarray's calibration flow and settings, with Lab Studio's privacy wording (§7.3).
9. **Studio 3D:** it shares the engine.
   - The Starting bench and the Preview get the new room and camera.
   - The Starting bench keeps its drag-to-arrange.
   - The turntable keeps its auto-rotate.
10. **`AGENTS.md`:** limit "Student Player Camera Gesture Control Rules" to the 2D player, and add a short Player3D hand-control section naming the 3D modules.
11. **Yaw:** auto-framing takes the short way round.
12. **Code:** transcribe the microarray code into TypeScript, as your decision allows, naming the source file in each module's header comment.

## 10. Order of work

- **P0: confirm §9** in one message, and record the answers in `DECISIONS.md`.
- **P1: environment and look.**
  - Exit: typecheck; the equipment validator; one look (G1) at a technique under the new room; a commit.
- **P2: camera and mouse camera** (right-drag, Shift/Alt/middle, wheel, presets, auto-framing).
  - Exit: typecheck; narrow tests of the pure math (fit, pan, zoom to cursor), written and not run; one look; a commit.
- **P3: the left button on the ported controller,** fed by mouse frames and producing Lab Studio's intents. Drop mode, inversion, TARE, the tray and the keyboard path still work.
  - Exit: typecheck; the narrow validators; tests written; one pane run of one technique with reduced motion; one look; a commit.
- **P4: hand control:** the pipeline, cursor, gestures, calibration, panel and the §8 mapping.
  - Exit: typecheck; the source's hand-aim and camera-lifecycle tests transcribed and adapted, written and not run; a commit.
  - G3 by you, or through Claude in Chrome.
  - A headless fake-camera smoke (Chromium `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`) only if you allow it.
- **P5: records:**
  - `DECISIONS.md` rows for what was replaced;
  - `evidence/MICROARRAY_ADOPTION_EVIDENCE.md`;
  - `SESSION_HANDOFF.md`;
  - `AGENTS.md`, per item 10.

Make a Solution follows, built on the new controller.

## 11. Where the changes go in Lab Studio

Line numbers as read on 2026-10-03; re-check before editing.
- **Environment:**
  - `bench/BenchEngine.ts`: the constructor (:156-174), `addBench` (:203-228), `QUALITY` (:85-89);
  - `bench/look/environment.ts`, `composer.ts`, `textures.ts` (the worktop maps) and the `materials.ts` values;
  - the `.bench3d` background (`styles/studio3d.css:19-24`).
- **Camera:**
  - `BenchEngine.ts`: the camera and controls (:67-69, 101, 147, 181-198), the tween (:301-311, 1499-1503), the view methods (:1389-1497) and `holdCameraInput`;
  - `player/Player3D.tsx`: framing and views (:385-428, 568-575, 770-783).
- **Equipment control:**
  - `bench/input/useBenchCarry.ts`: the pointer handlers (:527-620), the carry (:177-358) and the gesture API (:629-696);
  - `BenchEngine.ts`: picking and the carry preview (:505-556, 807-833, 1003-1069);
  - `Player3D.tsx`: tap, control press, drop mode and inversion (:249-378, 554-566).
- **Hand:**
  - `Player3D.tsx` (:140-152, 586-664, 759-768, 829-838);
  - `player/HandControlPanel.tsx` and `bench/input/targetResolver.ts`;
  - `styles/studio3d.css:190-227`;
  - the `"hand"` panel id (`player/panelLayout.ts:6-7`).
- **Must stay:**
  - the runtime and `usePlayer3D.ts`;
  - the resolution order in `sceneToIntent.ts`;
  - `footprints.ts` and `benchCoordinates.ts`;
  - the step card, panels, tray, Bench list and notebook;
  - the keyboard twins, the reduced-motion branches and provenance.
- **Tests that pin today's behaviour,** to update (written, not run):
  - `__tests__/handControl.test.ts`;
  - `player3DHandControl.test.tsx`;
  - `sceneToIntent.test.ts` (the origin tags, :186-209).
  
  The 2D tests (`src/player/__tests__/StudentPlayer.test.tsx`, `tests/lab-studio.smoke.e2e.ts`) stay untouched and valid.

## 12. Risks

- **Look parity.** The custom shading can only be approximated in three.js, and the GLB materials were tuned for the current light. Expect a tuning pass checked by looks.
- **Scale.** Every world constant needs the scale factor: clamps, hover heights, radii and the shadow box. Pixel constants carry over unchanged.
- **MediaPipe version.** The package is unpinned (1.0.1 installed), but the source was tuned on 0.10.17.
- **No webcam here.** The built-in browser pane blocks the camera, so G3 needs you or Claude in Chrome.
- **The 2D player.** It must not change: nothing under `src/player/**` or in `src/styles/app.css` is edited.
