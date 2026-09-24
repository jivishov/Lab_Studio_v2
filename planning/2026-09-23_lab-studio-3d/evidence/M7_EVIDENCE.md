# M7 evidence note: the shared gesture bridge and Player3D hand control

Branch `claude/lab-studio-3d`, on top of `93d80f8`: built in `e60293d`, refined after a second
fidelity review in `d03e754` (section "Fidelity review (second pass)"). Written 2026-09-24. Committed
locally, not pushed.

Plan §7 row M7: "D6 bridge extraction (no 2D behaviour change) and the raycast resolver; `AGENTS.md`
gesture section corrected." Static exit: "Bridge unit tests; 2D selectors and rules unchanged by
review." Authorised exit: G3 (real webcam). The UI handoff adds the hand-control panel (build order
"M7: Hand-control panel", §5.15) and the static design review.

You gave the go-ahead at the start of the session and made three wording and scope decisions. They
are recorded in `DECISIONS.md`:
- the help wording swaps only control names;
- the `AGENTS.md` edit covers line 88 and the file list;
- the panel shows only the four items §5.15 lists.

## What M7 delivers

| Part | Where | What |
|---|---|---|
| 1. The shared bridge | `src/player/gesture/bridge/gestureBridge.ts` | `GestureBridge`: pinch start grabs, a held pinch previews, release commits once; cancel and re-arm (120 ms of tracked open hand); whitelisted action buttons (8 px release tolerance, 450 ms repeat guard); held tracking, lost hand and stale samples; open-hand scrolling and its arbitration. It knows nothing about what is grabbed: a player supplies a **target resolver** (`GestureTargetResolver`: `elementAt`, `contains`, `grabAt`, `hoverAt`) and **grab handlers** (`begin`, `move`, `release`, `clear`). A clock can be injected for tests. |
| | `bridge/domTargetResolver.ts` | The DOM resolver: `document.elementFromPoint`, root containment, the `is-gesture-hovered` cue, and the Student Player's selectors as named constants. |
| | `bridge/useGestureBridge.tsx` | One bridge per player, the pointer/touch/keyboard takeover (capture listeners while camera control is on), clean-up and camera stop on unmount, and the fixed `.gesture-cursor` overlay moved from `StudentPlayer.tsx`. |
| | `src/player/StudentPlayer.tsx` | Now keeps only what is 2D: what each selector's element picks up (`resolveVisionGrab`, line 1172), the preview (`moveVisionGrab`, 1363) and the commit through the existing paths (`releaseVisionGrab`, 1280). It assigns the bridge's host each render (1418), where it used to assign its frame handler. |
| 2. Raycast resolver | `src/studio3d/bench/input/targetResolver.ts` | The DOM resolver for the page (tray tiles, whitelisted buttons). When the element under the cursor is the bench canvas, a raycast through `BenchEngine.pick` finds the item. It only resolves targets. `benchCanvasUnder` says whether the canvas itself, not a panel over it, is under a point. |
| | `src/studio3d/bench/input/useBenchCarry.ts` | A gesture carry on the existing carry: `startGestureCarry`, `startGestureTrayCarry`, `gestureCarryTo`, `releaseGesture`, `cancelGesture`, `canCarry`. Over the bench (the canvas is the element under the pinch point) the carry follows; a release there runs the pointer's own `release()` (`resolveRelease` in the 2D order, then `runIntent`, `refuse`, `freeMove` or `dropFromTray`), with the intents tagged `origin: "vision"` as in 2D. Off the bench, the item waits where it last was with no ring, callout or pour cue, and a release changes nothing. Pointer handlers now drive only pointer carries, so a mouse move cannot steer a hand carry. |
| 3. Hand-control panel | `src/studio3d/player/HandControlPanel.tsx`, `Player3D.tsx`, `studio3d.css` | The "Hand control" dock button (between Examine and Auto view, as in the mock-up dock), and a floating panel with the four §5.15 items: camera preview (mirrored, as in 2D), set-up state, gesture cards, and Cursor response. Also: the privacy note and a "More about hand control" disclosure with the rest of the 2D help. See below. |
| 4. `AGENTS.md` | line 89 (was 88) and the source-of-truth list | Corrected against the source; see below. |

### What Player3D adds, in full

§5.15 and G-10 say the Player adds a raycast resolver and nothing else. Everything Player3D gained
is listed here, so you can check that nothing gives a gesture its own meaning:
- the raycast resolver above;
- grab handlers that call the bench's existing carry;
- a decorative `.gesture-drag-preview` thumbnail for tray items (see interpretation 1);
- the dock button and panel;
- the blocking-dialog rule (help, the confirm dialog, results), as the 2D About and Camera Help dialogs block;
- Restart stopping the camera, as 2D Reset does;
- opt-ins that `AGENTS.md` requires:
  - `data-gesture-action` on the step card's Confirm (`confirm-accessible-action`), Record (`record-evidence`) and calculation submit (`submit-calculation`), the same names as `ProcessSidebar`;
  - `data-gesture-scroll-region="vertical"` on the step card body, the tray tiles, the Bench list, the notebook body and the panel body;
  - `data-definition-id` on tray tiles;
- a `keepMounted` option on `FloatPanel`, so a collapsed panel keeps its video, as the 2D panel's `hidden` body does;
- `"hand"` added to the remembered panel ids;
- an optional `origin` on the release adapter (`ReleaseContext.origin`, `resolveTrayDrop`, `dropFromTray`), default `"pointer"`, so hand releases are tagged `"vision"`;
- `pointer-events: none` on the hint and on the Player's toast, which only inform, so they do not hide the bench from a pinch (the Studio's toast keeps its buttons);
- in the Studio preview, the panel sits above the raised dock.

## Review: the 2D selectors and rules are unchanged

**Mechanical comparison.** A review script (session scratchpad, not committed) compared eight pieces
of `StudentPlayer.tsx` at `93d80f8` with `GestureBridge` at `e60293d`: the frame handler, scroll
arbitration, the scroll frame, cancel, button activation, scroll cancel, edge-scroll cancel and the
scroll cue. It mapped renamed identifiers first. Every remaining difference is an indirection:

| Before (in the 2D player) | After (in the bridge) |
|---|---|
| `aboutOpen \|\| cameraHelpOpen` | `host.blocked`; the 2D player sets it to exactly that |
| `setGestureArbitrationMessage("Open your hand briefly to re-arm camera control.")` / `(undefined)` | `host.onRearmChange(true / false)`; the 2D player maps it to the same string |
| `setVisionDragPreview(undefined)` | `host.grabs.clear()`; the 2D player maps it to exactly that |
| `updateVisionDragPreviewPosition(current)` | `if (active is a grab) grabs.move(...)`; the old function returned at once for no grab or a button |
| `playerRootRef.current` (scroll root, button containment) | `host.scrollRoot()`, `resolver.contains()`, both read at call time |
| Literals `8` and `450` | `gestureActionReleaseTolerancePx`, `gestureActionRepeatGuardMs` |
| `performance.now()`, `requestAnimationFrame` | The injected clock, whose default is exactly those |

**Pinch start and release.** These were restructured, so they were reviewed by hand.
- The order is kept at pinch start:
  1. the element under the cursor, which must be in the player;
  2. shelf equipment, if not disabled;
  3. probe handle;
  4. attached child;
  5. bench item;
  6. a whitelisted, enabled action button.
- Each equipment branch that found its element but could not build a grab used to stop with no button check. It now returns `blocked`, which also stops.
- On release the order is kept too: the release time is recorded, the active gesture and the button cue are cleared, the preview is cleared, and then the commit runs.
  - Shelf equipment is placed only over the bench surface.
  - Bench items are resolved in the order expected station, valid overlap (snap-aligned), invalid overlap, then free move. Probes never free-move.
  - Buttons use the same activation rule.

**Checks that passed (43 of 43):**
- **Selectors.** The shelf, workbench, probe, attached-child, hover and `button[data-gesture-action]` selectors are byte for byte the same as at `93d80f8`.
- **Targeting.** `elementFromPoint` is still used.
- **Cue classes.** `is-gesture-hovered` and `is-gesture-armed`.
- **Cursor classes.** `gesture-cursor`, `is-pinching`, `is-grabbing`, `is-tracking-held` and `is-rearm-required`.
- **2D preview.** The preview tokens appear as often as before.
- **Timings.** Re-arm 120 ms, tolerance 8 px, repeat guard 450 ms.
- **Messages and interrupts.** The 2D re-arm message and the three capture-phase interrupts are unchanged.
- **Untouched files** (none changed between the two commits):
  - `Workbench.tsx`, `EquipmentShelf.tsx`, `EquipmentView.tsx`, `ProcessSidebar.tsx`;
  - every engine file in `src/player/gesture/` (`gestureMath`, `gestureWorker`, `useGestureRecognition`, `gestureScroll`, `gestureTypes`, `gestureAssets`);
  - `docs/gesture-control.md`, `src/styles/app.css` and `StudentPlayer.test.tsx`.

**The existing 2D gesture tests.** `StudentPlayer.test.tsx` drives the bridge through the cursor
overlay with a fake controller. It is untouched, and was read against the new code.
- The overlay still calls the bridge and then styles the cursor on every `frames` change.
- The "stops camera control on reset and unmount" count stays at one stop for Reset and one for unmount.
- Every selector, class and message those tests query is unchanged.

They were not run (validation policy).

## `AGENTS.md` correction

| Claim at `93d80f8` (line 88) | Source | Now |
|---|---|---|
| "pinch start `0.055`" | `gestureMath.ts:110` `pinchStartRatio = 0.3` | pinch start ratio `0.3` |
| "pinch release `0.085`" | `gestureMath.ts:111` `pinchReleaseRatio = 0.5` | pinch release ratio `0.5` |
| (not stated) | `gestureMath.ts:112` `minimumPalmSpanPx = 32`, `:113` `pinchTrackingGraceMs = 160`; the ratio divides thumb-to-index distance by the median wrist-to-MCP span (`docs/gesture-control.md`) | stated |
| "minimum confidence `0.35`", "live in `gestureMath.ts`" | `0.35` appears nowhere in `src/player/gesture/`. `gestureWorker.ts:110–112` and `:132–134` set detection, presence and tracking confidence to `0.5`, and `:130` sets the fallback's canned-gesture `scoreThreshold` to `0.3`. | `0.5` in `gestureWorker.ts`, plus the fallback's `0.3` |
| Edge margins `0.08` / `0.06` | `gestureMath.ts:116–117` | unchanged (they matched) |

`src/player/gesture/bridge/` joins the source-of-truth list. No other rule was edited.

## The panel's wording (decision: swap only the names)

| 2D (camera help dialog, status panel) | Player3D panel |
|---|---|
| Requirements: "Use localhost or HTTPS, allow webcam permission, keep one hand visible, and use steady lighting with enough contrast." | The four set-up lines, the same words, one per line. The first is marked from the browser's secure context; the next two from the engine's `status` (done, now, needs attention, not yet). Lighting cannot be checked, so it has no mark. |
| Gestures: "Steer with your index fingertip. Pinch thumb and index finger to grab or activate, then release over the target. Hold four fingers extended together and wave over a panel to scroll it. Edge-hover scrolling remains available as a fallback." | Three cards (Steer, Pinch, Scroll) carrying the first three sentences. The card titles are UI chrome. **The fallback sentence is not shown**, because it is not true in Player3D (interpretation 8). |
| Controls: "Click **Camera control** to start or stop. Use Cursor response to balance precision and speed. **Reset** and leaving the player both stop the camera tracks." | "Click **Hand control** to start or stop. … **Restart** and leaving the player both stop the camera tracks." Both are true: the dock button toggles, and Restart (Menu or Play again, after confirmation) and unmount stop the camera. |
| Where it works: "**Camera control** is limited to **shelf** placement, bench item movement or interactions, and whitelisted current-step controls." | "**Hand control** is limited to **tray** placement, …" |
| Privacy: "Frames are processed locally in the browser. They are not saved, exported, serialized to lab state, or sent to the backend." | Verbatim |
| Fallbacks: "Mouse, touch, and keyboard stay available. No-hand and unstable-tracking frames do not count as assessment failures. Switching input modes safely cancels an unfinished camera gesture." | Verbatim |
| Status panel: "Tracking state", status label, engine message, "Open your hand briefly to re-arm **camera control**." | The same, with "…re-arm **hand control**." The engine's own messages (for example "Camera cursor ready.") come from the shared hook and are shown as they are. |
| "Cursor response" slider, 1–5, value label | The same control, the same `setCursorSpeed`, and the same single stored preference `lab-studio:v1:camera-cursor-speed`. |
| Button title when unsupported: "Camera control requires localhost or HTTPS." | "Hand control requires localhost or HTTPS." |

The runtime metrics (FPS, inference time, frames skipped) are not shown, by your decision.

## Interpretations and possible conflicts, reported rather than designed around

1. **The drag preview in 3D.** `AGENTS.md` asks for a fixed `.gesture-drag-preview` that follows the cursor "using the original grab offset", with "bench-sized dimensions". That rule is written for the 2D DOM.
   - **Tray items** get a decorative, non-focusable `.gesture-drag-preview` with the model's Blender thumbnail (label fallback), the grip offset from the tile, and the tile dimmed with `is-gesture-grabbed`. It is a fixed 72 px, not bench-sized: a tray item has no model on the bench to measure until it is placed.
   - **Bench items** are carried as the objects themselves, as handoff §5.6 asks, not as a copy. The lifted model follows the pinch exactly as the 3D pointer carry follows the pointer: its footprint centres on the bench point under the cursor, with no grab offset. Keeping the offset would make hand carries differ from pointer carries in 3D.
2. **Where a release counts.** A hand release commits only where the bench canvas itself is under the pinch point: the 3D form of the 2D bridge's "release over the workbench". The canvas fills the player and the floating panels sit over it, so its rectangle alone would count a release over the tray as a release on the bench.
   - Released over a panel, the tray or the dock, a hand carry changes nothing, and the item springs back or the tray item stays. In 2D, releasing a shelf item over the shelf does nothing either.
   - While the pinch is off the bench, the item waits where it last was, with no ring, callout or pour cue, as the 2D preview shows no overlap off the workbench.
   - The 3D pointer release has no such check: it commits wherever the ray meets the bench plane, under a panel too. That is M4 behaviour and is unchanged.
3. **The panel's layout is remembered.**
   - Handoff §5.1 lists hand control among the floating panels with a remembered layout, so its box and collapsed state are stored with the other panels under `lab-studio:3d:v1:player-ui`.
   - `AGENTS.md` says cursor speed is "the only gesture preference stored in localStorage".
   - I read the panel's position as a UI layout preference, not a gesture preference. Nothing about the camera, landmarks or tracking is stored. If you read the rule more strictly, the hand panel can be left out of the stored layout.
4. **Opening the panel starts the camera.**
   - The dock button works as the 2D Camera control toggle: it starts or stops hand control, and the panel shows while it is on (the 2D status panel shows while the status is not `off`).
   - This satisfies "opened from the dock" and makes "Click Hand control to start or stop" true.
   - As a result, the panel cannot be opened to read the privacy text before the browser asks for the camera. In 2D that text is in a separate Help dialog.
5. **The Studio's preview Restart does not stop the camera.** The Studio's preview toolbar calls `player.restart()` directly, so it does not stop the camera. Only Player3D's own Restart and leaving the player do.
6. **Cue colours.** Player3D's hover and armed cues use `--guide`, so they reach 3:1. The 2D cues are a 55 % teal (about 2.3:1 on white) and stay as they were. The gesture cursor itself is the shared 2D cursor.
7. **Parking after a hand pour.** A hand release goes through the 3D pointer release, which parks the source after a pour, as handoff §5.6 asks and as `AGENTS.md` asks ("the same object interaction path as pointer drag"). The 2D camera path does not park: parking lives in `Workbench.finishMove`, which only the 2D pointer uses. So after a hand pour the source rests where the 2D pointer would leave it, not where the 2D camera path leaves it.
8. **A reused sentence that is not true in Player3D (a conflict with the wording decision).**
   - You decided to keep the 2D sentences verbatim. One of them, "Edge-hover scrolling remains available as a fallback.", is false in Player3D.
   - The shared engine's edge scrolling (`gestureScroll.resolveGestureScrollIntent`) knows only the 2D `.bench-viewport`, `.workbench` and `.equipment-shelf-scroll` and a scrolling document. Player3D's page does not scroll, and its panels scroll only by the four-finger wave.
   - I withheld the sentence rather than show a false instruction.
   - The options are to keep it withheld, or to make edge-hover scrolling reach explicit `data-gesture-scroll-region` elements. That would be a reviewed change to the shared engine, and it would also change the 2D player, whose process and status regions do not edge-scroll today.
9. **Restart and an engine that is off.** Player3D's Restart stops the engine only when it is not already off. In a browser that cannot run the camera, stopping an idle engine reports "Unavailable", which would open the panel after every Restart. The 2D Reset calls `stop()` unconditionally and shows its status panel in that case. It is unchanged (no 2D behaviour change).

## Fidelity review (second pass, same day)

The M7 code was re-read against the 2D bridge it mirrors, handoff §5.1, §5.6 and §5.15, and `AGENTS.md`.
Differences found and fixed in `d03e754`:

| Difference | Fix |
|---|---|
| Hand releases were tagged `origin: "pointer"`; the 2D player tags its camera releases `"vision"` (`StudentPlayer.tsx` `dropEquipment`, `dragPlacedEquipmentToZone`, `runObjectInteraction`). The runtime does not read `origin` today; the intents should still match 2D's. | `ReleaseContext.origin`, `resolveTrayDrop(…, origin)` and `dropFromTray(…, origin)`, default `"pointer"`; a gesture carry releases with `"vision"`. Keyboard carries keep `"pointer"`, as in M4. |
| "Over the bench" was the canvas rectangle. The canvas fills the player and the panels float over it, so a tray item pinched and released back over the tray was dropped on the bench under the tray panel. In 2D a shelf release over the shelf does nothing. | Over the bench now means the canvas is the element under the pinch point (`benchCanvasUnder`). Off the bench the item waits with no ring, callout or pour cue (interpretation 2). |
| The hint and the Player's toast float over the bench and would have hidden it from that check. | `pointer-events: none` on both. The rule is scoped to the Player's toast; the Studio's toast has Undo and Dismiss buttons. |
| "Edge-hover scrolling remains available as a fallback." is not true in Player3D. | Withheld; reported as interpretation 8. |
| "Use localhost or HTTPS" was marked from the engine's `supported`, which also needs a worker, `createImageBitmap` and `getUserMedia`. | Marked from `window.isSecureContext`, the fact the sentence states. |
| Restart called `gesture.stop()` on an engine that was already off; where the camera cannot run, that opened an "Unavailable" panel. | Stop only when the engine is not off (interpretation 9). |
| In the Studio preview the dock is raised to 70 px, and the panel's 84 px bottom overlapped it. | The panel sits at 146 px in the preview. |
| No test covered Player3D's own wiring. | `player3DHandControl.test.tsx` (below). |

Reviewed and kept, with the reason:
- Parking after a hand pour (interpretation 7).
- The 72 px tray preview (interpretation 1).
- The dock button starting the camera (interpretation 4).
- The engine's own messages, shown as the shared hook writes them. Changing them would change the 2D player.

## Static design review (UI handoff, after the build order)

| # | Item | M7 result |
|---|---|---|
| 1 | Token contrast computed; every pair passes | `node scripts/studio3d/checkTokenContrast.mjs`: **39 of 39 pass**, including five new pairs: white on OK, guide and error (set-up marks); guide cue on the panel and on the floating panel over the stage. Table in `evidence/M7_TOKEN_CONTRAST.md`. The panel's chips reuse listed pairs (OK, warn and error tints; the neutral chip). |
| 2 | Every on-screen value renders through the provenance chip | The panel shows no lab values; the Cursor response label is a preference. Nothing changed elsewhere. |
| 3 | Instrument displays show only settings/status, simulated readouts, "Your entry" | Unchanged by M7. |
| 4 | Guidance components check `mode === "guided"` | The panel is not guidance and is available in both modes (§5.18). Hand carries use the carry's callouts, which already switch to neutral text in assessment mode. |
| 5 | Drop resolver in the 2D order; the free-move path never calls `recordAssessmentFailure` | Hand releases go through the same `release()` → `resolveRelease`. No new code calls `recordAssessmentFailure` (grep over `src/studio3d/bench`, `HandControlPanel.tsx`, `src/player/gesture/bridge`). |
| 6 | No audio API | Grep for `AudioContext`, `new Audio`, `<audio` over `src/studio3d` and the bridge: none. |
| 7 | Reduced-motion branches for every §3.5 item | M7 adds no motion: the preview follows by transform, and there are no transitions. The known gaps (snap 150 ms, settle 120 ms, the ✓ animation) remain from M4–M5. |
| 8 | UI storage keys hold preferences only | The hand panel's box and collapsed state go into `player-ui` (interpretation 3). Cursor speed stays the engine's single key. No frames, landmarks or model output are stored. |
| 9 | Keyboard maps implemented; single letters scoped to focus | M7 adds no keys. The panel's controls are a native range input and buttons. Any key inside the player cancels an unfinished gesture. |

## Static exit

- `npx tsc -p tsconfig.app.json --noEmit`: exit 0, after the last code edit of `d03e754` (it includes the new tests).
- `npx tsc -b`: exit 0, at the same point.
- `node scripts/studio3d/checkTokenContrast.mjs`: exit 0 (39 of 39 pairs).
- The bridge equivalence review above: 43 of 43 checks, re-run against the working tree after the second pass (the refinements touch no 2D file).
- `validate_equipment3d.py` was not needed: M7 changes no assets.

**Tests written, not run** (validation policy):
- `src/player/gesture/bridge/__tests__/gestureBridge.test.ts` covers:
  - grab, preview and a single commit;
  - nothing committed while held;
  - outside the player;
  - blocked equipment;
  - whitelisted, plain and disabled buttons;
  - a different button on release, and the release tolerance;
  - the repeat guard;
  - a blocking dialog mid-pinch;
  - the 120 ms re-arm and its reset by a pinch;
  - held tracking;
  - a lost hand;
  - stale samples when pinching and when idle;
  - the hover cue's once-per-target rule;
  - `cancel(false)` and `resetRearm`;
  - `dispose`;
  - wave scrolling, blocked and within the release pause;
  - a pinch taking priority over a scroll cue.
- `src/player/gesture/bridge/__tests__/domTargetResolver.test.ts` covers:
  - the selectors, byte for byte;
  - `elementFromPoint`;
  - containment;
  - the hover cue class;
  - no cue outside the player;
  - `grabAt` passing through to the player's rule.
- `src/studio3d/__tests__/handControl.test.ts` covers:
  - the tray and hover selectors;
  - a raycast grab, blocked and empty;
  - a tray-tile grab with its grip;
  - blocked while a pour is drawn;
  - buttons left to the bridge;
  - the bench hover label and page cues;
  - the set-up lines' wording and states, from the secure context and the status;
  - the canvas-under check;
  - the `hand` panel in the stored layout.
- `src/studio3d/__tests__/player3DHandControl.test.tsx` (new in `d03e754`) renders Player3D in jsdom with a fake engine. There is no WebGL, so the bench shows its fallback. It covers:
  - the dock button starting and stopping, as the 2D Camera control does, with the panel shown only while on;
  - the disabled button and its reason;
  - the four items and the 2D wording, without the edge-hover sentence or runtime metrics;
  - cursor response;
  - the video staying mounted when collapsed;
  - the re-arm prompt when a dialog opens;
  - Restart stopping the camera, and an idle engine left alone;
  - leaving the player stopping the camera;
  - Confirm's `data-gesture-action`.
- New cases in `src/studio3d/__tests__/sceneToIntent.test.ts`: hand releases and tray drops tagged `"vision"`, and `"pointer"` by default.

**Intentionally not run:** any test suite, the 2D `StudentPlayer.test.tsx` gesture flows, and
`content:check`. Not written: the mocked-camera Playwright route coverage that `AGENTS.md` QA
describes, because e2e is outside the validation policy (available on request). Also not run:
**G3 (real webcam)**, G1, G2 and G4. G3 needs your authorisation; no webcam or browser was used in M7.

## Open after M7

- G3, when you authorise it:
  - the 2D technique routes in `docs/gesture-control.md` (Manual QA);
  - `#/3d/technique/<id>` for a tray pinch onto the bench, a tray pinch released back over the tray (nothing happens), a bench pinch onto a pour target, a refusal, Confirm by pinch, open-hand scrolling of the Bench list, the re-arm after a mouse takeover, and Restart stopping the camera.
- Interpretations 1–5 and 7–9 above, for your confirmation. Interpretation 8 is a conflict with your wording decision.
- Possible follow-ups:
  - add `src/studio3d/bench/input/targetResolver.ts` to the `AGENTS.md` source-of-truth list, if you want Player3D's resolver named there;
  - dock tooltips below 1100 px (§7), which none of the dock buttons have yet.
- Still open from the handoff:
  - provisional decisions D8, Q4, Q6, U2 and U4–U8 (Q5 effectively settled);
  - the `[` `]` candidate-target choice at M8;
  - the two unpushed handoff commits, now joined by this milestone's commits (`e60293d`, `110267c`, `d03e754` and the commit that adds this section).
