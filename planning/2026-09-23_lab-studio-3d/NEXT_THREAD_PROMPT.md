# Prompt for the next thread (2026-10-03)

Paste everything below the line into a fresh Claude Code thread.

---

Continue the Lab Studio 3D Pack 1 build.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- Branch `claude/lab-studio-3d`; remote https://github.com/jivishov/Lab_Studio_v2.git.
- `origin/claude/lab-studio-3d` is at `713c248`. About 27 local commits sit on top, none pushed. Push only when I ask.

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `SESSION_HANDOFF.md`: its section "State on 2026-10-03" is current and supersedes older text.
2. `DECISIONS.md`: every decision, including the D4 exceptions (eight so far) and the atomization policy.
3. `IMPLEMENTATION_PLAN.md` (rev 2.1) and `UI_UX_HANDOFF.md` (rev 1): the governing documents. Work to them with high fidelity, and report conflicts rather than designing around them.
4. `proposals/PACK1_ATOMIZATION.md` and `evidence/DILUTION_ATOMIZATION_EVIDENCE.md`: the latest finished work, and the pattern to follow.
5. `probes/README.md`: the narrow checks used so far.

**Constraints (my standing instructions):**
- **Validation:** source review plus basic static checks only:
  - `npx tsc -p tsconfig.app.json --noEmit`;
  - `python tools/blender/validate_equipment3d.py --pack 1`;
  - narrow static validators and probes.
  Write narrow tests, but do not run tests, suites, or e2e/browser matrices unless I ask.
- **Gates:**
  - G1: one browser spot check per change is fine. No full G1 playthroughs without a go-ahead.
  - G3 (real webcam) is approved, but you can't run it; I run it, or connect Claude in Chrome.
  - No G2 or G4 without a go-ahead.
- **Git:**
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:**
  - Core or content changes need my decision first. Each Pack 1 content change becomes a D4 exception.
  - Tablet, laptop and larger only; no mobile layouts.
  - 3D is independent of 2D; the 2D player is out of scope.
- **Leave untouched:**
  - The authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees.
  - The main checkout `...\tmp\github-export\Lab_Studio_v2`: don't work in it or change its branch.
  - Unselected projects (Projects `AGENTS.md` sync boundary).
- **Atomization policy (2026-10-02):** break steps down to the real physical actions, within reasonable limits, to build "muscle memory". New atoms not cited in the AP lab documents are expected.

**Tools and quirks:**
- **Dev server:** `preview_start` "lab-studio-3d-dev" (port 5182). It's defined in the session folder's `.claude/launch.json`; create that entry if the new session's folder lacks it.
  - It runs `pwsh -NoProfile -Command "Set-Location '<worktree>'; npx vite --host 127.0.0.1 --port $env:PORT --strictPort"`, with `"autoPort": true`.
  - The worktree's own `.claude/launch.json` has "microarray-reference" (port 8791, serving the `dna-microarray-3d` mirror), for looking at the microarray lab.
- **The browser pane:** when it is hidden, animation frames stop, so pours never finish drawing and carries are blocked.
  - For logic, use Menu → Reduced motion, and set it back afterwards.
  - For visuals, take one headless look with Playwright (`probes/look-dilution.cjs` is the template). Use `NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`, SwiftShader, and the player's quality set to Low.
- **Probes:** `node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs <probe>.mts`.
- **Models:** the Blender pipeline and material rules are in `SESSION_HANDOFF.md` → Practicalities.
- **CRLF files:** `BenchEngine.ts`, `Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts`, `studio3d.css`, `DECISIONS.md` and `viewerMaterials.json`, among others.
  - Edit them with a byte-aware script: normalize to LF, assert one match, restore CRLF.
  - Long bash heredocs fail, so write scripts to a file first.

**Pack 1 now:**

| Technique | State |
|---|---|
| Weigh a Solid | 5 steps; TARE and the spatula |
| Analyze Transmittance of a Dilution | 28 steps; funnel, working beaker, Beral pipettes |
| Dilute a Stock Solution | 12 atomized steps; pump, drop to the line, stopper, invert |
| Make a Solution | Still 3 old steps; next |
| Measure Liquid Volume | Waits for its 2D host labs |

**Task A, first: a study and proposal; build nothing.**

I'd like to adapt the bench design, the camera and object movement, and the hand-gesture control of the microarray lab: `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\dna-microarray-3d\microarray-3d.html`.
- The canonical, published copy is `virtual_lab\experiments\dnamicroarray_v2\`. The mirror `dna-microarray-3d` has no git history. Six code files differ: `hand-core.js`, `hand-tuning.js`, `interaction.js`, `liquid.js`, `session.js` and `analysis.js`. The published copy is the newer (commit `9495489`, 2026-09-28), so treat it as the reference and note what the mirror differs in. Read both; don't edit either.
- Its code is in `3d-v3/`: `scene.js`, `renderer.js`, `camera.js`, `interaction.js`, `hand-core.js`, `hand-tuning.js`, `framing.js`, `panels.js`.

Produce `planning/2026-09-23_lab-studio-3d/proposals/MICROARRAY_ADAPTATION.md`:
- **What it does,** with file and line references:
  - bench look (resin top, wall, trim, shelf, lighting);
  - camera (right-drag pan/tilt, Shift-orbit, zoom to cursor, auto-framing);
  - object motion;
  - hand control (thumb-plunger calibration, home-centred cursor and gain, One Euro smoothing, aim assist, lock/insert/leave, closed-grip pick-up and open-palm release).
- **What Lab Studio 3D does today,** for each of these (`src/studio3d/engine/BenchEngine.ts`, `src/studio3d/player/*`, `src/player/gesture/bridge/*`).
- **Options for each area,** with a recommendation, the effort, and how drop mode, the pipettes and inversion would map onto it.
- **The conflicts with recorded rules,** stated plainly for my decision:
  - `UI_UX_HANDOFF.md` line 17 says the microarray's "code, protocol model and MediaPipe hand pipeline are not used".
  - Line 117 says aim assist and lock-on belong "in the shared bridge, as a reviewed change, or nowhere (G-10)".
  - G-10 (line 34) and plan D6 make the shared 2D gesture bridge the one gesture system.
  - Weigh these against the 2026-09-25 decision that 3D is developed independently of 2D.
  - Re-implementing patterns is allowed; copying code is not, unless I decide otherwise.

Then ask me to decide.

**Task B, next unless I reorder: build Make a Solution** (decided; see `proposals/PACK1_ATOMIZATION.md`):
- **Start:** the 100 mL volumetric flask; a pre-weighed weigh boat holding the teacher's mass of sodium carbonate (new weigh-boat model).
- **Transfer:**
  - a funnel seated in the flask's neck (a zone and anchor; generalize the two cylinder-funnel atoms to any narrow-necked vessel);
  - tip the solid into the funnel;
  - rinse the boat, then the funnel; remove the funnel.
- **Dissolve and fill:**
  - water to about half full; swirl to dissolve. The runtime's dissolve must use the solid actually in the flask, compatible with content that names no solid. Remove the stirring rod from the equipment.
  - water to below the mark; drop by drop to the mark (reuse `markDispense`);
  - stopper; invert ×10; record the appearance.
- **Settings:** the final volume is fixed at 100 mL, and "initial solvent volume" goes.
- **Records:** D4 exception 9, an evidence note, narrow tests (not run), one G1 spot check.

**Later:**
- a stopper and inversion for transmittance-dilution's test tube; an atom for weighing's zero step;
- per-item tray tiles; the long title overlapping the step counter at narrow widths;
- M8 acceptance (the provisional decisions in `SESSION_HANDOFF.md`).

Start by reading the files above. Give me a short plan for task A, then do it.
