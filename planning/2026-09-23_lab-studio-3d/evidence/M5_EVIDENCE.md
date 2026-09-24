# M5 evidence note: Player3D

Branch `claude/lab-studio-3d`, on top of `a0a829a`. Everything below is **uncommitted**
working-tree work; nothing has been staged, committed or pushed. The earlier session wrote most of
Player3D; this session (2026-09-23, after the account switch) finished the items named below.

## What exists

| Piece | Where |
|---|---|
| Route, loader text, setup gate | `player/Technique3DRoute.tsx`: the same blockers and teacher approval as the 2D `#/technique/:id` route; `measuring-volume` shows its host-bound message and host links and no start button. |
| Controller | `player/usePlayer3D.ts`: the 2D runtime hook, `runIntent` with the input merge, refusals recorded as attempts, free moves, parking, tray drops, Confirm. |
| Step card | `player/StepCard.tsx`: count, title, progress, instruction verbatim, input field with its provenance chip, Source/Target/Confirm with the 2D enabling rules, Show me (guided), About, the correction block. |
| Panels | `player/panels.tsx`: tray, Bench list, Examine, notebook sheet, results. |
| Player shell | `player/Player3D.tsx`: top bar, dock, Menu, mode switch and restart with confirmation, toasts, live region, keyboard map. |

## Fixed in this session

### The missing flask

At 1280 × 720 in `making-solution` step 2 the bench showed no flask. Two causes, found in source
and confirmed in the browser:

1. **Wrong position.** The runtime's transfer takes the flask off the shelf with no `x` or `y`. The 2D
   workbench then stands it at its default slot for its render order (`resolveWorkbenchScene`,
   x 34, y 86 for the first item). The 3D adapter read the missing values as 0, which put the flask
   60 mm further left, at the back left edge of the bench. `benchCoordinates.runtimeBenchPoints` now
   reads positions from the 2D resolver itself, and `runtimeToScene`, the free-spot search and the
   pour parking all use it. No placement rule is copied.
2. **Framing ran against the wrong scene.** After a pour, the bench briefly redraws the scene from
   before the pour so that the pour can animate, and the flask is not on the bench in that scene.
   The step-2 framing waited for that redraw, found nothing to frame, and fell back to the
   whole-bench box at 2.4 m. Framing now waits for the pour to finish and for every model to load
   (`BenchEngine.settled`). The first step is also framed now: before, the first framing call ran
   before the engine existed and was never retried.

A new step also ends a manual-camera suspension, as handoff §5.9 says; before, one orbit turned
auto-framing off for the rest of the run.

Checked in the built-in browser, same route and viewport, historical setup values (100 mL final,
50 mL solvent, 1.06 g, "clear colourless solution"; reproducibility data only, not approved
defaults):

- The flask stands at x = −516 mm, the model is loaded, and the step-2 framing targets it at 1.0 m.
- At the end of the framing move the flask's centre projects to x ≈ 839 px, the middle of the area
  right of the step card (398–1280 px), from 262 to 451 px down the 720 px canvas.
- A one-frame render at that camera, diffed against the same frame with the flask hidden, puts
  the flask at 800–860 px across and 280–440 px down. A luminance readback shows the liquid-filled
  bulb clearly and the neck and rim as fainter outlines. Clear glass on the light bench stays
  subtle (the M3 note already records that flat glass reads faintly in real time).

The pane cannot run animation frames (see M4), so the 650 ms camera move itself was not watched.
The render was forced once from the page at the move's end point.

### The Source and Target overflow

The earlier session's CSS change holds. At 1280 × 720 no element inside the step card extends
past it (every descendant measured), both selects are 158 px, and the page has no horizontal
scroll.

### Movable panels

The step card, the tray and the Bench list are floating panels (`FloatPanel`, rules in
`player/panelLayout.ts`): drag by the header, resize from any corner, collapse to one line.
The grip is a button, so a panel also moves with the arrow keys (10 px, 50 px with Shift). The
layout is stored with the other UI preferences under `lab-studio:3d:v1:player-ui` (handoff §3.8),
read back field by field so a stale value falls back to its default, and never with run state.
The Menu has "Reset panel layout". Panels float from 1024 px up; below that the existing CSS
sheets apply and a stored layout is ignored. The auto view refits when a panel opens, closes,
moves, resizes or collapses, and it counts a panel as covering a side only when it is at least a
quarter of the canvas tall, wherever it has been moved.

Checked in the built-in browser at 1280 × 720 with synthetic pointer events (the pane's drag tool
needs a screenshot, which the pane could not take): the tray moved from (14, 573) to (814, 285)
and was stored; the step card's corner resize went from 372 × 331 to 432 × 411 with its top-left
corner fixed and no horizontal overflow; Shift+Left on the tray's grip moved it 50 px. Reloading to
see the stored layout come back was not checked.

### Keyboard carry and Move…

See `M4_EVIDENCE.md`. The Bench list's Move… now starts the keyboard carry, for seated items too
(they detach on set-down, as the runtime rules say); probes refuse with a spoken message.

### Enabling rules against `ProcessSidebar`

`player/stepRules.ts` copies the 2D sidebar's private rules. Compared line by line with
`src/player/ProcessSidebar.tsx` in this session:

- The rules for prerequisites, input readiness, the configuration lock, the endpoint labels, the
  required source and target, Confirm, Record and the calculation submit match.
- One difference was found and fixed: with no required target, 2D labels the Target by the
  step's station (`stationLabel`: "No target required", "Equipment shelf", "Workbench" or the
  equipment's name); the copy always said "Workbench".
- One difference is intended: in assessment mode an unselected required endpoint reads "Choose…"
  where 2D reads "Not selected" (handoff §5.5).
- Not copied: the drop-dispense and time-series controls. No Pack 1 action uses them.

**Drift risk.** The copy can fall behind when `ProcessSidebar` changes. The durable fix is to move
these rules into a shared module that both players import; that is a 2D refactor outside plan §4.7
and needs its own review, so it is proposed here, not done.

### Accessibility note on the setup checkbox

The earlier session's browser tool listed the approval checkbox as "on". That is the input's
value. The source wraps the checkbox in its label ("I approve these values for my classroom."),
which names it. No assistive-technology check was run; nothing here suggests a defect.

### Other handoff items finished in this session

Each was checked once in the built-in browser at 1280 × 720 through the page's own controls, reading
state from the DOM and the engine, because the pane could not draw frames.

| Item | What was done | What the look showed |
|---|---|---|
| Help, "Controls & model" (§5.16) | Top-bar help button and dialog: the mouse, keyboard and touch tables, what the bench shows and does not show (G-1, G-2), model provenance | Dialog opens with 17 control rows and the display-policy wording |
| Camera views (§5.9) | A caret beside Auto view opens Auto · follow the step, Whole bench, Selected item, Overhead | Four entries; Selected item disabled with nothing selected; Overhead goes to 70° elevation at 1.7 m |
| Examine (§5.8) | Saves the camera and returns to it on Close or Esc; "Seated on <holder>" names the holder; Eye level puts the camera level with the liquid surface (the orbit floor is relaxed only for that view); double-click an item to examine it | Eye level target 27 mm up the flask for 50 mL; Close returned to the saved view with the 78° orbit limit back |
| Show me (§5.9) | The engine pulses the source, a translucent copy travels to the target and fades, then the target pulses; nothing commits; reduced motion keeps only the pulses | The demo started on the flask; with the source still in the tray only the target pulses (fixed after the look showed a double pulse) |
| Beacon while carrying (§5.9) | Moves to the expected target during a carry, in guided mode | Not looked at (no frames in the pane) |
| Notebook (§5.12) | Resizable from the left edge, 320 px to half the window, by pointer or arrow keys on a focusable separator; width kept with the UI preferences; framing refits | 420 → 500 px with Shift+Left, capped at 640 px, stored |
| Values | Notebook and results use the 2D `formatEvidenceValue` decimals, with the handoff's thin space before the unit | — |
| Results (§5.14) | Evidence now lists calculations, data series and notebook entries as well as measurements; Print; Play again asks first | `making-solution` completed 3 of 3; Play again showed the restart confirmation and Cancel returned to the results |
| Provenance chips (§3.2) | New `player/provenance.ts`. A value bound to a setup slot (`{{config.x}}`) in the definition as written is a **Teacher setting**. Before, the teacher's configured observation in `making-solution` was chipped "From the bench" | The recorded observation now reads "Teacher setting" |
| Loader (§5.2) | A card with a bar that counts GLB bytes as they download, and the 2D link, until the first bench is drawn. The unused model-count `preload` was removed | Shown while loading, gone once drawn |
| Tray click (§5.10) | A click or Enter on a tile places the item at the slot the 2D `placeEquipment` would pick (`adapters/twoDPlacement.nextPlacementPoint`, a copy of the private 2D rule, with the same drift note as `stepRules.ts`). A click used to do nothing | The wash bottle went to the first slot (x = −504 mm) as a free move |
| Tap to select, touch item menu (§5.19) | A tap on an item selects it (a mouse click selected nothing before); on touch a second tap opens Examine, Move…, Use as source, Use as target | A tap selected the wash bottle; the touch menu was not exercised |

No Pack 1 definition declares limitations, so Help and Results show none; nothing is invented for
them.

## Fidelity review (second pass, same day)

Player3D was compared with the 2D player and handoff §5 once more. Besides the M4 items in
`M4_EVIDENCE.md`, these were fixed:

| Difference | Fix |
|---|---|
| The tray marked only the step's source as needed. 2D marks source, target and station (`currentStepEquipmentIds`). | Same rule, in `stepRules.ts`. `making-solution` step 1 now marks the flask as well as the wash bottle. |
| The pour stream took the mixed result's colour, even for a solid being dissolved; the source's level did not change. | What falls is the source's own contents: a liquid in its `resolveLiquidStyle` colour, a solid as powder in its `resolveSolidStyle` colour; the source's level falls as the target's rises. |
| The 3D liquid opacity added 0.25 and floored at 0.3, which could merge two faint states the palette keeps apart (15 registry states make ordinal claims, the Blue 1 series among them). | A strictly increasing mapping onto 0.25–1 (`liquidOpacity3D`), so every palette difference keeps its order. |
| Results counted completed nodes of every type against steps without teacher notes, and counted failed attempts from any mode. | One list for both counts; attempts as the 2D feedback panel counts them, in assessment mode. |
| The top bar's badge read "TECHNIQUE". | "TECHNIQUE · PACK 1" from catalogue order (`src/studio3d/packs.ts`, decision Q4, provisional); the inventory tool now imports the same `PACK_SIZE`. |
| Start was offered when models were missing, which would leave items undrawn. | The gate offers the 2D version instead (readiness is necessary, plan §2.7). |
| With no classroom values to enter, a setup failure opened an empty setup page. | The core's message stays on the start page. |
| The auto view's working set left out holders; closing Examine did not restore Auto view; the Menu's reduced-motion setting did not reach CSS transitions. | Holders included (§5.9); Auto view restored; a class applies the setting. |
| The bench canvas was announced as an image although it takes keys; the top bar and step card came after the bench in tab order. | `role="application"` with the roledescription "3D bench"; the top bar and step card come first (§5.19). |
| Screen-reader announcements waited for an animation frame, which is held back while a tab is hidden. | A short timer. |

Reviewed and left as they are, each for a stated reason:
- A free set-down slides to the nearest free spot; 2D does not. The handoff asks for it (§5.6, no
  interpenetration), and the committed point is what the runtime stores.
- `[` and `]` step through every other bench item; see `M4_EVIDENCE.md`.
- The balance display keeps the learner's entry after the vessel leaves the pan, as 2D keeps a
  recorded value; nothing in the runtime says otherwise.
- There is no separate note field: in 2D a text input's value is the note (`resolveActionInput`),
  and the 3D step card uses the same input.
- Recording in the notebook happens from the step card, not from the notebook sheet as §5.7 draws
  it; the enabling rule and the intent are the 2D ones. Moving the control is presentation only.

Checked once in the built-in browser (`making-solution`): badge "TECHNIQUE · PACK 1", canvas role
"application", tab order starting with the top bar and step card, both step-1 items marked
"needed now", no console errors.

Tests written, not run: `__tests__/liquidOpacity.test.ts` (new).

## Found in this session: `weighing` cannot start on its own, in either player

Pressing Start on `#/3d/technique/weighing` ends on the setup page with the core's message
"Configured technique is not valid: technique.actions repeats structured output
"standalone-mass-measurement-id"." The 2D route `#/technique/weighing` stops with the same message.
After setup, the weigh action's `mass.outputMeasurementId` and the record action's `measurementId`
are both `standalone-mass-measurement-id`, and `validateDefinition`'s duplicate-output rule
(`src/domain/validation.ts`, around line 983) refuses that. This branch has changed nothing under
`src/data`, `src/domain`, `src/runtime`, `src/equipment`, `src/player` or `public/techniques` since the
baseline `1d28429`, so the refusal belongs to the baseline. Fixing it is a core or content change
and is left for your decision. Until then, three of the four standalone techniques can start;
`dilution` and `transmittance-dilution` were not opened in this session. The weighing tests in
`__tests__/adapters.test.ts` call the same setup and will fail on this baseline when run.

## Static exit

- `npx tsc -b`: exit 0 after the last edit of this session.
- Tests written, **not run**: `__tests__/panelLayout.test.ts` (storage sanitising, bounds, corner
  resize, covered sides), `__tests__/stepRules.test.ts` (the station label),
  `__tests__/provenance.test.ts` (setup bindings, learner entries, bench records), new cases in
  `__tests__/sceneToIntent.test.ts` (snap point, tray click placement) and in
  `__tests__/adapters.test.ts` (the flask stands where the 2D workbench stands it after step 1 of
  `making-solution`; a placed item keeps its runtime coordinates).
- Not run: any test suite, `content:check`, G1 playthroughs, G2–G4.

## Test coverage the plan asks for and that is still missing

The M3 exit asks for adapter tests of each technique's initial **and final** state. Initial states
are covered for all five techniques, final states only for `weighing` (blocked on this baseline,
see above), plus step 1 of `making-solution`. Final states for `making-solution`, `dilution` and
`transmittance-dilution` are not written. `making-solution` ran to the end in the browser in this
session; its final-state test can be written from that run.

## Still open for M5

- G1 playthroughs of the standalone techniques (M5's authorised exit) have not been run; they need
  your go-ahead, and `weighing` first needs the fix above.
- Looks the pane could not give: the beacon moving to the target, the Show me ghost, the pour
  animation, and panels restored from storage after a reload.
- The hand-control panel waits for M7 (plan D6).
