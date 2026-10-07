# Lab Studio 3D: session handoff

Written 2026-09-24 and updated 2026-10-04, so a fresh session can continue the Pack 1 build without
the previous conversation; checked claim by claim against the repository. Read this first, then the
governing documents it names.

## State on 2026-10-04 (read this first)

This section supersedes anything older below where they differ. `DECISIONS.md` has every decision;
the evidence notes have what was built and checked.

**Branch.** `origin/claude/lab-studio-3d` is at `713c248`. Every commit after it is local
(`git log --oneline 713c248..HEAD`): the build from `39fdab8` (M7 hand-panel decisions) to `7a63d86`
(the pump stays on the pipette), the handoff commits of 2026-10-03, then the microarray adoption of
2026-10-04 (`9798de1` P0 to the P5 records commit, and the fidelity review `b886175`), then Make a Solution
atomized (D4 exception 9, `63096ed`) and its fidelity review. Push only when the user asks.

**Pack 1, technique by technique:**

| Technique | State | Evidence |
|---|---|---|
| Weigh a Solid | 5 steps; teacher-prepared readings; the glass seats on the pan; TARE pressed on the balance; solid added with the spatula | `READINGS_EVIDENCE.md`, `TARE_SPATULA_EVIDENCE.md` |
| Analyze Transmittance of a Dilution | 28 steps; 25 mL cylinder with a filling funnel; working beaker and Beral pipettes for the cuvettes; cuvettes seat in the photometer | `READINGS_EVIDENCE.md`, `PIPETTE_FUNNEL_EVIDENCE.md` |
| Dilute a Stock Solution | 12 atomized steps: pipette pump, delivery to the line drop by drop, flask to the mark drop by drop, stopper, invert ×10, two calculations | `DILUTION_ATOMIZATION_EVIDENCE.md` |
| Make a Solution | 14 atomized steps: a pre-weighed weighing boat, a funnel in the flask's neck, the solid tipped in, the boat and funnel rinsed into the flask, half full, swirled to dissolve the solid in the flask, to the mark drop by drop, stopper, invert ×10, appearance recorded | `MAKE_SOLUTION_ATOMIZATION_EVIDENCE.md` |
| Measure Liquid Volume | Unchanged. Host-bound: it can't play on its own (its 3D route shows only the gate). It is composed into two labs, Precipitate and Filter Calcium Carbonate and the Hard-Water Reference Demo, so it waits for them (Phase B) | `proposals/PACK1_ATOMIZATION.md` |

Also built: the top bar's title is a switcher listing the five Pack 1 techniques (a slim bar does the
same on the intro and setup pages), and hover labels hang below items.

**The microarray adoption is built (2026-10-04;** `evidence/MICROARRAY_ADOPTION_EVIDENCE.md`). It covers:
- the room and look: `bench/look/room.ts`, `microarrayGeometry.ts`, `environment.ts` and `composer.ts`;
- the camera and mouse camera: `bench/camera/benchCamera.ts` and `BenchEngine.ts`;
- the left button on the microarray controller: `useBenchCarry.ts`, `PressAction` and `STROKE`;
- hand control: `src/studio3d/hand/` and `player/HandControlPanel.tsx`.

The 2D player is unchanged. A fidelity review the same day fixed twelve findings (the evidence note's
first section): the source's lighting model is now reproduced, mouse strokes act on release (G-5), camera
clamps are per input, and the hand controller keeps the source's remaining rules. Thirteen interpretations
wait for confirmation (`DECISIONS.md`, the "built" row). G3 has still not run.

**Standing policies (user decisions):**
- **Atomization:** break each step down to the real physical actions, within reason, to build
  "muscle memory". New atoms and roles not cited in the AP lab documents are expected; record the basis
  as the teacher's decision. Content changes still go to the user first and become D4 exceptions (nine
  so far).
- **Teacher-prepared values:** the teacher sets quantities and readings before play; the student
  follows the procedure and enters what they observe.
- **3D is independent of 2D:** the 2D player is out of scope; some atomized steps (drop to the line,
  invert) cannot be played in 2D, and that is accepted.
- **The microarray lab's environment, bench view, mouse and hand control are adopted for 3D**
  (decided 2026-10-03; choices confirmed 2026-10-04; built 2026-10-04). The plan and the rules it
  replaces are in `proposals/MICROARRAY_ADOPTION.md`; `AGENTS.md` has "Player3D Hand Control Rules".
- **Realistic gestures:** prefer gestures that reproduce the real action. In the microarray lab
  (2026-09-28) the user found pinching "very tricky" and preferred a calibrated thumb press on the
  plunger.

**Next, in order (recommended):**
1. **Done 2026-10-04: the microarray adoption** (P0–P5, then a fidelity review). It is open only for the
   thirteen interpretations to confirm and for G3.
2. **Done 2026-10-04: Make a Solution** (D4 exception 9; `evidence/MAKE_SOLUTION_ATOMIZATION_EVIDENCE.md`),
   on the new controller, with a weighing-boat model, a funnel seat in the flask, generic funnel atoms, rinses
   into a receiver and a dissolve of the solid in the flask. Reviewed for fidelity the same day: eleven findings
   fixed (evidence note, "Fidelity review"). It is open only for its nine interpretations to confirm, and for G3.
3. **Done 2026-10-05: Pack 1 finished** (`evidence/PACK1_FINISH_EVIDENCE.md`; D4 exceptions 10–12):
   Make a Solution's rinses in three squirts; transmittance-dilution's test tube stoppered, inverted ten
   times and opened (31 steps); weighing's zero atom; one tray tile per item; the top bar's long titles.
   The tests and `content:check` were run for the first time: the branch's own failures are fixed, and
   what remains fails the same way on GitHub main (the evidence note lists it).
   Reviewed for fidelity the same day (evidence note, "Fidelity review"): held squirts, the rack left
   standing, per-item tray drops, seated parts kept seated while a step needs them, and more.
4. **M8 acceptance.** On 2026-10-05 the provisional decisions and every interpretation were confirmed at
   their defaults (`DECISIONS.md`, "Open decisions"), and `content:check`'s baseline is left as it is.
   **D8 (how experiments are assembled from the atomic steps) is open for a separate discussion with the
   user**, so nothing in Phase B is built before it. Pre-existing failures that do not affect the 3D
   work are ignored. What remains is G3 (webcam), which needs the user or Claude in Chrome.
5. **Done 2026-10-06: Pack 2 built and reviewed for fidelity** (`evidence/PACK2_EVIDENCE.md`, with its "Fidelity
   review" section; `proposals/PACK2_ATOMIZATION.md`, revision 2): Transfer Liquid (4 steps), Precipitation (11),
   Filter a Precipitate (13), Dry and Weigh (26) and Heat and Reweigh (36), as 3D practice versions listed in
   `public/techniques-3d/index.json` (written by `scripts/practice3d/build.mjs`), never in the 2D catalogue; the
   lab-bound originals and their 2D labs are untouched until D8. Core: bench operations
   (`src/domain/benchOperations.ts`) and apparatus states; 3D: fourteen models, the step clock, the oven, tongs,
   flames. The review restored Heat and Reweigh's balance choice and Unused Sample return, added the rod rinse,
   fixed the flames, paper, triangle, lid and scoopula models, and made every path wait for the clock and the
   drain. The interpretations were all answered on 2026-10-06 (a zero check per technique, the oven door closed,
   the reduced-motion drain wait, printed scales, wider tong jaws; the rest confirmed). `hard-water-demo` cannot be
   finished in the 2D runtime (found in the review; before Pack 2 too). Hand control (G3) is set aside for now
   (user, 2026-10-05).

**How the work has been checked** (the user's validation policy: source review, `npx tsc -p
tsconfig.app.json --noEmit`, `python tools/blender/validate_equipment3d.py --pack 1`, and narrow
static validators; tests are written but not run):
- `probes/` holds the narrow validators and runtime probes; see `probes/README.md`.
- G1 is one browser look per change in the app's pane. A hidden pane stops animation frames, so pours
  never finish drawing and carries are blocked. Two workarounds:
  - switch on Menu → Reduced motion for logic, and switch it back off;
  - take one headless look with Playwright and SwiftShader: `probes/look-dilution.cjs`,
    `probes/look-making-solution.cjs` (all 14 steps; it retries a carry while an animation is drawn),
    `probes/look-room.cjs` (the room, at each tier and view), or `probes/run-weighing-mouse.cjs`.
    The last drives Weigh a Solid with real mouse events, finding items by sweeping the pointer and
    reading the hover label.
  - SwiftShader frames are slow, so allow seconds for a 650 ms camera tween.
- Dev server: `preview_start` "lab-studio-3d-dev" (port 5182), configured in the session folder's
  `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\lab-studio\.claude\launch.json`, which
  is temporary; remove it and stop the server when the work is done. It was not running at this handoff.
- To look at the microarray lab, add a static-server entry for its folder to the same launch file. The
  worktree's own `.claude/launch.json` has one, "microarray-reference" (port 8791).
- G3 (real webcam) was authorised on 2026-09-24 but has not run. The built-in pane blocks the webcam,
  and Claude in Chrome was not connected, so G3 needs the user, or Claude in Chrome once connected.

**Practicalities:**
- Models: `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P
  tools/blender/build_equipment3d.py -- --only <ids> --review`, then `python tools/blender/pack_models.py
  --only <ids>`, then the validator. Review renders land in `tools/blender/.build/review/`. New materials
  go in `tools/blender/labeq/materials.py` and `src/studio3d/equipment3d/viewerMaterials.json` (edit the
  latter as text; it is CRLF).
- Atom docs are generated: `node scripts/generateAtomicStepsDocs.mjs`. transmittance-dilution is
  generated from `scripts/generatorInputs/simulator/transmittanceDilution.mjs` (`node
  scripts/generateSimulatorTechniqueDefinitions.mjs --only transmittance-dilution`); weighing and dilution
  are edited by hand.
- Line endings differ from file to file, and git stores every file byte for byte (the shared
  `.git/info/attributes` has `* -text`). The checked list is under "Gotchas" below. Edit CRLF files with
  a byte-aware script (normalize to LF, assert one match, restore CRLF). Long bash heredocs have failed;
  write longer scripts to a file first.
- Physical-step rules found the hard way: every physical action needs a registry atom (the bundled
  catalogue policy refuses atomless ones); a `legacyActionEffects` entry must equal the handler-derived
  effect; a step that should finish only on acceptance must be validated by a recorded measurement or a
  notebook tag, not by `actionEvidence`.

## Where the work is

- **Our worktree:** `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
  - Branch `claude/lab-studio-3d`, tracking `origin/claude/lab-studio-3d`.
  - Remote `https://github.com/jivishov/Lab_Studio_v2.git`.
  - It was pushed up to `713c248`; see "State on 2026-10-03" for what is local only.
- **Its main checkout** is `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\github-export\Lab_Studio_v2`
  (`git rev-parse --git-common-dir`). The main checkout and our worktree share branches and the stash.
  Don't work in it, and don't change its branch.
- **Baseline:** GitHub main `1d28429` (decision D1).
- **Hands off.** Don't modify the authoritative working copy `C:\Users\EmilJivishov\Projects\Lab_studio`
  (Projects branch `codex/Lab_Studio`). The only exception is the git-ignored `tmp\` worktrees above,
  which `Lab_studio/.gitignore` (`tmp/`) keeps out of the Projects repository.
- **Local-only files in our worktree** (git-ignored):
  - `.env.development.local` sets `VITE_STUDIO_3D_V1=true`.
  - `.claude/launch.json` holds the user's own two reference-server configs (`microarray-reference`,
    `photoreal-bench-reference`). Keep them.

## Governing documents (in `planning/2026-09-23_lab-studio-3d/`)

| File | What it governs |
|---|---|
| `IMPLEMENTATION_PLAN.md` (rev 2.1) | Scope, architecture, scientific fidelity, milestones (§7), risks (§11) |
| `UI_UX_HANDOFF.md` (rev 1) | Layout, visual design, interaction and copy. When it conflicts with the plan, the guardrails G-1 to G-13 (§1) win, and the conflict is reported, not designed around (§0). |
| `DECISIONS.md` | Every decision the user made, and the provisional defaults still open |
| `evidence/*.md` | What each milestone and later change delivered, what was checked, and what was not (M0 to M7, then readings, TARE and spatula, pipettes and funnel, dilution) |
| `mockups/lab-studio-3d-mockups.html` | The approved mock-ups: 22 frames, S1–S9 and P1–P13 |

The user asked for **the highest fidelity** to the plan and the handoff.

## Milestones

| Milestone | State | Commit(s) |
|---|---|---|
| M0: shell, flag, routes, tokens, fonts, inventory, mock-ups | Done; mock-ups approved | `e59b397` … `35158f8` |
| M1: Blender pipeline, wash bottle | Done | `c73fc1b` |
| M2: the remaining 13 Pack 1 models, rack scenery (D9) | Done | `5d1960f` |
| M3/M4 pure layer: runtime adapters | Done | `b368d8c` |
| U10 teacher-facing setup slot labels | Done | `2f78a62` |
| `AGENTS.md` 3D asset rules; G1 spot-check authorisation | Recorded | `399c86f`, `b551414` |
| M3: live bench (BenchEngine, look layer) | Done | `a0a829a` |
| M4: carrying; M5: Player3D; animated pours | Done, with open items below | `9e8bc17` |
| D10 core fix; Studio persistence key | Done | `ba38e21` |
| M6: Studio 3D | Done, plus one critical fidelity review pass | `c97c812`, `de872b4` |
| Starting contents in Studio 3D (decision b) | Done | `049e471` |
| Weighing content fix (D4 exception) | Done | `e8d1d26` |
| M7: gesture bridge and hand-control panel | Done (static exit), with a second fidelity pass; G3 not run | `e60293d`, `d03e754`; `evidence/M7_EVIDENCE.md` |
| Teacher-prepared readings (balance and photometer; weighing in five steps) | Done; transmittance-dilution seen end to end after the cuvette fix (D4 exception 6) | `evidence/READINGS_EVIDENCE.md` |
| Dilute a Stock Solution atomized (12 steps: pipette pump, drop to the line, stopper, invert) | Done; seen in the pane and in a headless look | `evidence/DILUTION_ATOMIZATION_EVIDENCE.md` |
| transmittance-dilution: funnel, working beaker, transfer pipettes, 25 mL cylinder (28 steps) | Done; seen end to end in the pane | `evidence/PIPETTE_FUNNEL_EVIDENCE.md` |
| The balance's TARE key; the spatula for solids (dip, carry, tip) | Done; assessment mode, reduced motion and hand control not seen in the pane | `evidence/TARE_SPATULA_EVIDENCE.md` |
| The microarray lab's room, camera, mouse and hand control (P0–P5) | Done; looks headless, a mouse run of weighing; G3 not run | `9798de1` … P5; `evidence/MICROARRAY_ADOPTION_EVIDENCE.md` |
| Make a Solution atomized (14 steps: weighing boat, funnel in the flask, rinses, swirl, to the mark, invert) | Done, then reviewed for fidelity; headless looks of all 14 steps before and after the review; G3 not run | `evidence/MAKE_SOLUTION_ATOMIZATION_EVIDENCE.md` |
| Pack 1 finished: three-squirt rinses, the test tube stoppered and inverted, the zero atom, per-item tray tiles, the top bar | Done 2026-10-05; tests and `content:check` run; one headless look | `evidence/PACK1_FINISH_EVIDENCE.md` |
| **M8: Pack 1 acceptance** | **Next** | — |

## M7 (delivered 2026-09-24)

M7 is done at its static exit: see `evidence/M7_EVIDENCE.md` for what was built, the review showing the
2D selectors and rules unchanged, the interpretations to confirm, and what was not run. G3 was authorised
on 2026-09-24 but could not run (see "State on 2026-10-03"). The scope below is kept as the record it was
built against.

**Superseded for the 3D player on 2026-10-03.** The user decided that the 3D player takes the microarray
lab's hand-gesture control of equipment (and its lab environment, bench view and mouse control); see
`DECISIONS.md` and `proposals/MICROARRAY_ADOPTION.md`. Item 2's "nothing else" and item 3's "import
nothing, and don't copy its aim assist or lock-on" no longer hold for 3D. The 2D player, and the shared
bridge as the 2D player uses it, stay exactly as built.

The plan (D6, §4.2, §4.7, §7 M7 row) and the UI handoff (§1 G-10, §2.2, §5.15, build-order table)
together define it.

1. **Extract the interaction bridge.** Move grab, preview, `elementFromPoint` targeting, commit on
   release, re-arm and scroll arbitration out of `src/player/StudentPlayer.tsx`. They go into a shared,
   input-agnostic module (`src/player/gesture/bridge/`) with a target-resolver interface.
   - The 2D player keeps a DOM resolver (still `elementFromPoint`), with **no change in 2D behaviour**.
   - The gesture recognition engine stays in `src/player/gesture/` (`gestureMath.ts`, `gestureWorker.ts`,
     `useGestureRecognition.ts`, `gestureScroll.ts`, `gestureTypes.ts`, `gestureAssets.ts`).
   - `AGENTS.md` ("Student Player Camera Gesture Control Rules") names the source-of-truth files and the
     pinch, drag and release UX rules the extraction must preserve.
2. **Add the Player3D raycast resolver** behind the bench canvas (`BenchEngine.pick`). The Player adds a
   raycast resolver and nothing else (§5.15, G-10).
3. **Build the hand-control panel** (§5.15, build order "M7: Hand-control panel"). It is a floating panel
   opened from a "Hand control" dock button; Player3D's dock doesn't have that button yet (see mock-up
   dock and §5.1). The panel holds:
   - the camera preview;
   - the set-up state;
   - gesture cards;
   - cursor speed, the existing 2D control.

   It reuses the 2D player's camera help and privacy wording. Its behaviour comes entirely from the shared
   bridge. The microarray panel in `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\dna-microarray-3d`
   is a design reference only: import nothing, and don't copy its aim assist or lock-on (§2.2). Any such
   tuning belongs in the shared bridge as a reviewed change, or nowhere.
4. **Correct `AGENTS.md`**, line 88 of the gesture section.
   - It quotes "pinch start `0.055`, pinch release `0.085`, minimum confidence `0.35`".
   - `gestureMath.ts` actually has `pinchStartRatio = 0.3` and `pinchReleaseRatio = 0.5` (palm-relative,
     with `minimumPalmSpanPx = 32`) and `pinchTrackingGraceMs = 160`.
   - The edge margins 0.08/0.06 still match.
   - `0.35` doesn't appear anywhere in `src/player/gesture/`, so find where confidence is set before
     editing. `docs/gesture-control.md` already states the 160 ms grace.
5. **Exit** (plan §7):
   - bridge unit tests, written and not run;
   - a review showing the 2D selectors and rules are unchanged;
   - the static design review below;
   - an `evidence/M7_EVIDENCE.md`.

   This is a player refactor with regression risk (plan §11), so keep it behaviour-preserving.
6. **Gate G3** (real-webcam gestures) runs **only with the user's authorisation**. Ask before any webcam use.

**Static design review** (UI handoff, after the build order): part of every milestone's static exit, and
no browser is needed.
1. The token contrast table has been computed, and every pair passes.
2. Every on-screen value renders through the provenance chip component.
3. Instrument display components render only three things: configured settings and status,
   `simulator-generated` readouts, and "Your entry".
4. Guidance components check `mode === "guided"`.
5. The drop resolver follows the 2D order (§5.6), and the free-move path never calls
   `recordAssessmentFailure`.
6. No audio API appears in the code.
7. Reduced-motion branches exist for every item in §3.5.
8. The UI storage keys hold preferences only.
9. The keyboard maps are implemented, and the single-letter keys are scoped to focus.

## After M7: M8 (Pack 1 acceptance)

The plan's exit:
- type check;
- validators;
- content parity of the Pack 1 JSON and its generator against the reconciled baseline;
- `content:check` compared with the baseline;
- model size budgets;
- an evidence note.

G1 and G2 run only as the user authorises. Content parity must expect the nine recorded D4 exceptions:
in weighing, the record-step fix (M6), the seated placement (2026-09-25, which also adds `snapIntoTarget`
to `atom.place.weighed-vessel` in `src/domain/atomRegistry.json`), the five teacher-prepared steps, and
the TARE and spatula wording of the zero and transfer steps; in transmittance-dilution, the cuvette insert and remove steps and the funnel, beaker and pipette steps with the 25 mL cylinder (2026-09-26, which also add a catalogue zone, four atoms and four roles); in dilution, the atomized twelve steps (2026-10-02, with two runtime handlers, six atoms, two roles and a catalogue zone); in
making-solution, the atomized fourteen steps (2026-10-04, with the dissolve of the solid in the vessel, rinse washings into a
receiver and `solventAddition` in the runtime, two new and two generalized atoms, a new role and a renamed one, and the flask's
funnel seat, which also change transmittance-dilution's funnel atom ids and role names); also in
transmittance-dilution, the teacher-set volumes and %T, made through its generator input. The core changes
behind them are listed in `evidence/READINGS_EVIDENCE.md`. `npm run content:check` runs the content rule engine with `--compiled`, which adds
compiled-context diagnostics through the TypeScript composition loader. It is broader than a basic
static check, so ask before running it, given the validation policy. Its baseline covers only the raw
and template rules. `scripts/checkCycle04Foundations.mjs` can't run in this export: it needs
`CYCLE_01_BASELINE.json`, which is missing.

## Open decisions and items for the user

- **Provisional defaults** in `DECISIONS.md`, to confirm before M8:
  - D8 (flattened experiments now, the compiled path in Phase B), Q4 pack grouping, Q6 gates and linter,
    U2, and U4–U8.
  - Q5 (visual direction) was effectively settled when the mock-ups were approved, but the table still
    lists it.
  - U3 (Starting bench) is built, and seated starting items were verified in M6.
- **Presentation choice to confirm at M8** (M4 evidence): `[` and `]` step through every bench item, not
  only the step's targets.
- **Browser checks.** G1 spot checks were authorised as one built-in-browser look per change while
  building M3–M5. The user asked to see the Studio in M6, so looks were taken there too. Full G1
  playthroughs, G2 (performance), G3 (webcam) and G4 (publishing) stay closed without the user's go-ahead.
- **Pushing.** The user asks for pushes explicitly. Commit locally; push only when asked.

## Rules that apply to every change

- **Validation policy** (worktree `AGENTS.md`): source review plus basic static checks only.
  - Type check: `npx tsc -p tsconfig.app.json --noEmit`.
  - `python tools/blender/validate_equipment3d.py` is allowed as a static check (`AGENTS.md`).
  - The previous session also treated a narrow one-file validator script (the core's own setup plus
    validator on one JSON) as a basic static check.
  - Write narrow tests but **don't run** tests, suites, or e2e or browser matrices unless the user asks.
- **Projects sync boundary** (`C:\Users\EmilJivishov\Projects\AGENTS.md`): never stage or operate on
  unselected projects. Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree
  checkout from the Projects root.
- **Git.**
  - Never use bare `git stash`: the stash is shared with the main checkout.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Content (D4).** Pack 1 technique JSON and its generators stay unchanged except through the D4
  exceptions recorded in `DECISIONS.md` (nine by 2026-10-04). Any further content or core change needs
  the user's decision first, and becomes the next numbered exception.
- **Science.**
  - Instruments are measurement-neutral (G-1): no invented readings.
  - The resting scene equals runtime state (G-3).
  - Colours come only from `resolveLiquidStyle` / `resolveSolidStyle` (G-9).
  - Scenery never becomes a runtime object (G-8).
  - No sound (G-11).
- **Layout.** Tablet, laptop and larger only; no mobile layouts (G-12).
- **3D assets.** Follow "Lab Studio 3D Equipment Asset Rules" in `AGENTS.md`: procedural Blender, budgets,
  provenance, no contents or false labels baked in. `tools/blender/` holds the pipeline.

## Running the app

- Start Vite on a free port: `npx vite --host 127.0.0.1 --port 5182 --strictPort`. Another chat's server
  may hold 5181.
- For the built-in browser, add your own `.claude/launch.json` entry with `"autoPort": true` that passes
  `--port $env:PORT` through `pwsh`, because Vite ignores a `PORT` variable. Remove the entry when done.
- Routes:
  - `#/3d/studio` (Studio 3D);
  - `#/3d/technique/<id>`: `weighing`, `measuring-volume` (host-bound: gate only), `making-solution`,
    `dilution`, `transmittance-dilution`.
- A hidden or minimised app window pauses `requestAnimationFrame` and `ResizeObserver`. Screenshots
  then time out and React Flow can't measure. Check the DOM with `javascript_tool` instead. A hidden page
  can't take focus either, so dispatch `focusout` to trigger React's `onBlur`.

## Gotchas learned the hard way

- **PowerShell array-of-pairs replacements** mangle multi-line strings, because the comma binds tighter
  than `+`. Use the Edit tool for multi-line edits.
- **Git Bash's `sed -i` turns CRLF into LF** for the whole file (this happened to `Player3D.tsx` in P2 and
  was restored in P3). Never use it on a CRLF file; use the byte-aware script.
- **Never `cat >` without a heredoc** in a Bash call: it waits on stdin until the call times out.
- **Line endings.** Check each file before editing and match it; git keeps them as they are (`* -text`).
  - **CRLF** (checked 2026-10-03):
    - `src/studio3d/bench/BenchEngine.ts` and `BenchView.tsx`;
    - `src/studio3d/player/Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts` and `Technique3DRoute.tsx`;
    - `src/studio3d/Studio3DApp.tsx`, `src/studio3d/styles/studio3d.css`, `src/studio3d/copy/slotLabels.ts`;
    - `src/studio3d/equipment3d/loadModels.ts`, `readiness.ts` and `viewerMaterials.json`;
    - `src/studio3d/__tests__/adapters.test.ts`, `equipment3dRegistry.test.ts` and `slotLabels.test.ts`;
    - `tools/blender/labeq/materials.py`;
    - `DECISIONS.md`, `UI_UX_HANDOFF.md`, the mock-ups, `proposals/AGENTS_3D_ASSETS_SECTION.md` and
      `evidence/M2_EVIDENCE.md`.
  - **Mixed:** `src/App.tsx` (mostly CRLF) and `src/player/ProcessSidebar.tsx`.
  - **LF:**
    - `src/studio3d/bench/input/*`, `src/studio3d/bench/look/*`, `src/studio3d/bench/camera/*` and `src/studio3d/hand/*`;
    - `src/studio3d/adapters/*`;
    - `StepCard.tsx`, `panels.tsx`, `HandControlPanel.tsx` and `SimulationSwitcher.tsx`;
    - the rest of `src/player/**`, and the runtime (`src/runtime/*`);
    - `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, the other proposals and evidence notes, and this file.
- **React 19** `useRef` needs an explicit initial value.
- **React Flow (controlled nodes).** Keep the `dimensions` changes and give `measured` back to the nodes,
  or the minimap and fitting treat cards as unmeasured. Give the MiniMap its size through `style`.
- **Tracing sources.** `scripts/cycle04TechniqueCompositionTransform.mjs` is a one-time in-place
  migration, not a generator.

## Known limits and follow-ups (from the evidence notes)

- **M3:**
  - A state laid out by the 2D player can overlap in 3D; it is drawn as the runtime has it, never moved.
  - Flat glass reads faintly in real time.
- **M4:** a snap seating in 3D (the cuvette into the photometer) has not been observed.
- **M5:**
  - G1 playthroughs are unrun.
  - Looks the pane couldn't give: the beacon moving, the Show me ghost, panels restored after a reload.
    The pour has since been seen.
- **§3.5 motion gaps:**
  - the snap into an anchor (150 ms) and the set-down settle (120 ms) aren't animated;
  - the step-complete strip transitions, but has no ✓ animation.

  Item 7 of the static design review applies.
- **Duplicated rules.** `src/studio3d/player/stepRules.ts` copies `ProcessSidebar`'s enabling rules, and
  `studio/PreviewView.tsx` copies StudentPlayer's preview-notice rule. Both are drift risks; propose
  extracting them as a reviewed change.
- **M6:**
  - On a narrow stage the Player3D floating tray can crowd its dock.
  - The equipment inspector shows the Blender thumbnail; the equipment dialog has the live turntable.
  - Per-technique composite renders are an asset task; the cards compose item thumbnails for now.
  - Not browser-exercised: HTML drag and drop, the Connect menu, the turntable, the tablet widths, and the
    1600 px split view.
- **Cleanup.** At the 2026-09-24 handoff the temporary launch entry was removed and the dev server
  stopped. At the 2026-10-03 handoff the entry in
  `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\lab-studio\.claude\launch.json` was kept for the
  next thread, and no dev server was running. Remove the entry when the 3D work ends.
