# Lab Studio 3D: session handoff

Written 2026-09-24 so a fresh session can continue the Pack 1 build without the previous
conversation, and checked claim by claim against the repository. Read this first, then the
governing documents it names.

## Where the work is

- **Our worktree:** `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
  - Branch `claude/lab-studio-3d`, tracking `origin/claude/lab-studio-3d`.
  - Remote `https://github.com/jivishov/Lab_Studio_v2.git`.
  - It was pushed up to `e8d1d26`; the handoff commits after that are local only.
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
| `evidence/M0_*` … `evidence/M6_EVIDENCE.md` | What each milestone delivered, what was checked, and what was not |
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
| M7: gesture bridge and hand-control panel | Done (static exit); G3 not run | `e60293d`; `evidence/M7_EVIDENCE.md` |
| **M8: Pack 1 acceptance** | **Next** | — |

## M7 (delivered 2026-09-24)

M7 is done at its static exit: see `evidence/M7_EVIDENCE.md` for what was built, the review showing the
2D selectors and rules unchanged, the interpretations to confirm, and what was not run (G3 needs the
user's authorisation). The scope below is kept as the record it was built against.

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

G1 and G2 run only as the user authorises. Content parity must expect the one recorded D4 exception, the
weighing fix. `npm run content:check` runs the content rule engine with `--compiled`, which adds
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
- **Content (D4).** Pack 1 technique JSON and its generators stay unchanged. The only exception is the
  weighing fix recorded in `DECISIONS.md`. Any other content or core change needs the user's decision
  first.
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
- **Line endings.** `BenchEngine.ts` started as CRLF and is now mixed after scripted edits; `App.tsx` is
  mixed too. Match what is there.
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
- **Cleanup.** The temporary `.claude/launch.json` in the `virtual_lab` worktree was removed at handoff,
  and the dev server was stopped.
