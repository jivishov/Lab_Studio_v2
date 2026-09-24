# Lab Studio 3D: session handoff

Written 2026-09-24 so a fresh session can continue the Pack 1 build without the previous
conversation. Read this first, then the governing documents it names.

## Where the work is

- **Worktree:** `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`. It is a git worktree of
  `jivishov/Lab_Studio_v2`, and `Lab_studio/.gitignore` (`tmp/`) keeps it out of the Projects repository.
- **Branch:** `claude/lab-studio-3d`, tracking `origin/claude/lab-studio-3d`. At `e8d1d26` it was up to
  date with the remote.
- **Baseline:** GitHub main `1d28429` (decision D1).
- **Do not modify** the authoritative working copy `C:\Users\EmilJivishov\Projects\Lab_studio` (Projects
  branch `codex/Lab_Studio`). Only this worktree is ours.

## Governing documents (in `planning/2026-09-23_lab-studio-3d/`)

| File | What it governs |
|---|---|
| `IMPLEMENTATION_PLAN.md` (rev 2.1) | Scope, architecture, fidelity, milestones (§7) |
| `UI_UX_HANDOFF.md` (rev 1) | Layout, visual design, interaction and copy; the guardrails G-1 to G-13 (§1) win over everything |
| `DECISIONS.md` | Every decision the user made, and the provisional defaults still open |
| `evidence/M0_*` … `evidence/M6_EVIDENCE.md` | What each milestone delivered, what was checked, and what was not |
| `mockups/lab-studio-3d-mockups.html` | The approved mock-ups (22 frames, S1–S9 and P1–P13) |

The user asked for **the highest fidelity** to the plan and the handoff. Report conflicts; don't
design around them.

## Milestones

| Milestone | State | Commit(s) |
|---|---|---|
| M0 shell, tokens, inventory, mock-ups | Done, approved | `e59b397`…`35158f8` |
| M1 Blender pipeline | Done | `c73fc1b` |
| M2 Pack 1 models | Done | `5d1960f` |
| M3 live bench | Done | `a0a829a` |
| M4 carrying, M5 Player3D, animated pours | Done | `9e8bc17` |
| D10 core fix, Studio persistence key | Done | `ba38e21` |
| M6 Studio 3D | Done, reviewed twice | `c97c812`, `de872b4`, `049e471` |
| Weighing content fix (D4 exception) | Done | `e8d1d26` |
| **M7 gesture bridge** | **Next** | — |
| M8 Pack 1 acceptance | After M7 | — |

## Next: M7 (plan D6, §4.7, §7)

- **Goal.** Extract the camera-gesture interaction bridge (grab, preview, `elementFromPoint` targeting,
  commit on release, re-arm, scroll arbitration) out of `src/player/StudentPlayer.tsx` into a shared,
  input-agnostic module (plan §4.2: `src/player/gesture/bridge/`) with a target-resolver interface.
  - The 2D player keeps a DOM resolver (still `elementFromPoint`), with **no change in 2D behaviour**.
  - Player3D adds a raycast resolver behind its canvas (`BenchEngine.pick`).
  - The gesture recognition engine stays in `src/player/gesture/` (`gestureMath.ts`, `gestureWorker.ts`,
    `useGestureRecognition.ts`, `gestureScroll.ts`, `gestureTypes.ts`).
- **Also.** Correct the gesture section of `AGENTS.md`: it quotes stale thresholds of 0.055/0.085. The
  source constants are pinch ratios 0.3/0.5 and a 160 ms tracking grace in `gestureMath.ts` (plan §2.3).
- **Exit.** Bridge unit tests (written, not run), and a review showing the 2D selectors and rules are
  unchanged. This is a player refactor with regression risk (plan §11), so keep it behaviour-preserving.
- **Gate G3.** Real-webcam checks happen **only if the user authorises them**. Ask before any webcam use.
- **Handoff G-10.** There is one gesture system; the Player3D hand-control panel presents the shared
  bridge and adds no gesture meaning of its own. Don't copy microarray's aim assist or lock-on.

## Open decisions and items for the user

- **Provisional defaults** in `DECISIONS.md` still need confirming before M8: D8 (flattened experiments
  now, the compiled path in Phase B), Q4 pack grouping, Q5, Q6 gates and linter, U2–U8.
- **G1 spot checks.** The user authorised one built-in-browser look per change while building M3–M5,
  and asked to see the Studio in M6, so looks were taken there too. Full G1 playthroughs, G2 (performance),
  G3 (webcam) and G4 (publishing) remain closed without the user's go-ahead.
- **Pushing.** The user asks for pushes explicitly. Commit locally; push only when asked.

## Rules that apply to every change

- **Validation policy** (worktree `AGENTS.md`): source review plus basic static checks only.
  - Type check: `npx tsc -p tsconfig.app.json --noEmit`.
  - Static validators are allowed, for example `python tools/blender/validate_equipment3d.py`, or a
    narrow one-file validator script.
  - Write narrow tests but **don't run** tests, suites, or e2e or browser matrices unless the user asks.
- **Projects sync boundary** (`C:\Users\EmilJivishov\Projects\AGENTS.md`): never stage or operate on
  unselected projects. Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree
  checkout from the Projects root.
- **Git.**
  - Never use bare `git stash`.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Content (D4).** Pack 1 technique JSON and its generators stay unchanged. The only exception so far is
  the weighing fix recorded in `DECISIONS.md`. Any other content or core change needs the user's decision.
- **Science.**
  - Instruments are measurement-neutral (G-1): no invented readings.
  - The resting scene equals runtime state (G-3).
  - Colours come only from `resolveLiquidStyle` / `resolveSolidStyle`.
- **Layout.** Tablet, laptop and larger only; no mobile layouts.

## Running the app

- `.env.development.local` in the worktree (git-ignored) sets `VITE_STUDIO_3D_V1=true`.
- Start Vite on a free port: `npx vite --host 127.0.0.1 --port 5182 --strictPort`. Another chat's server
  may hold 5181. For the built-in browser, add a `.claude/launch.json` entry with `"autoPort": true`
  that passes `--port $env:PORT` through `pwsh`, because Vite ignores a `PORT` variable.
- Routes:
  - `#/3d/studio` (Studio 3D);
  - `#/3d/technique/<id>`: `weighing`, `measuring-volume` (host-bound), `making-solution`, `dilution`,
    `transmittance-dilution`.
- A hidden or minimised app window pauses `requestAnimationFrame` and `ResizeObserver` in the built-in
  browser. Check the DOM with `javascript_tool` then, and don't rely on screenshots.

## Gotchas learned the hard way

- **PowerShell array-of-pairs replacements** mangle multi-line strings, because the comma binds tighter
  than `+`. Use the Edit tool for multi-line edits.
- **Line endings.** `BenchEngine.ts` uses CRLF; `App.tsx` has mixed endings.
- **React 19** `useRef` needs an explicit initial value.
- **React Flow (controlled nodes).** Keep the `dimensions` changes and give `measured` back to the nodes,
  or the minimap and fitting treat cards as unmeasured. Give the MiniMap its size through `style`.
- **Tracing sources.** `scripts/cycle04TechniqueCompositionTransform.mjs` is a one-time in-place
  migration, not a generator. `checkCycle04Foundations.mjs` needs `CYCLE_01_BASELINE.json`, which this
  export lacks.

## Known limits and follow-ups (recorded in the evidence notes)

- **Duplicated rules.** `src/studio3d/player/stepRules.ts` copies `ProcessSidebar`'s enabling rules, which
  is a drift risk; propose extracting them as a reviewed change. The same applies to the preview-notice
  rule copied from `StudentPlayer`.
- **Preview crowding.** On a narrow stage the Player3D floating tray can crowd its dock.
- **Equipment inspector.** It shows the Blender thumbnail; the equipment dialog has the live turntable.
- **Composite thumbnails.** Per-technique composite renders are an asset task; the cards compose item
  thumbnails for now.
- **Not browser-exercised:** HTML drag-and-drop paths, the Connect menu, the turntable, the tablet widths,
  and the 1600 px split view.
- **Temporary launch config.** The `virtual_lab` worktree once held a temporary `.claude/launch.json`;
  it was removed at handoff.
