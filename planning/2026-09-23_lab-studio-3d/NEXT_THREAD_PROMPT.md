# Prompt for the next thread (2026-10-03, refined after the microarray decision)

Paste everything below the line into a fresh Claude Code thread.

---

Continue the Lab Studio 3D Pack 1 build.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- Branch `claude/lab-studio-3d`; remote https://github.com/jivishov/Lab_Studio_v2.git.
- `origin/claude/lab-studio-3d` is at `713c248`. Every commit after it is local (`git log --oneline 713c248..HEAD`). Push only when I ask.

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `SESSION_HANDOFF.md`, section "State on 2026-10-03": the current state. It supersedes older text below it.
2. `proposals/MICROARRAY_ADOPTION.md`: the plan for task A, with the choices to put to me first (§9).
3. `DECISIONS.md`: every decision, including the 2026-10-03 microarray row, the eight D4 exceptions and the atomization policy.
4. `IMPLEMENTATION_PLAN.md` (rev 2.1) and `UI_UX_HANDOFF.md` (rev 1): the governing documents.
   - They are byte-for-byte copies of the authoritative plan. Never edit them; record changes in `DECISIONS.md`.
   - Work to them with high fidelity, except where `DECISIONS.md` replaces them. Report conflicts rather than designing around them.
5. `evidence/DILUTION_ATOMIZATION_EVIDENCE.md`: the latest finished work, and the pattern for evidence notes.
6. `probes/README.md`: the narrow checks used so far.

**Constraints (my standing instructions):**
- **Validation:** source review plus basic static checks only:
  - `npx tsc -p tsconfig.app.json --noEmit`;
  - `python tools/blender/validate_equipment3d.py --pack 1`;
  - narrow static validators and probes.
  
  Write narrow tests, but do not run tests, suites, or e2e/browser matrices unless I ask.
- **Gates:**
  - G1: one browser look per change is fine. No full G1 playthroughs without a go-ahead.
  - G3 (real webcam) is authorised (2026-09-24) but hasn't run: the built-in browser blocks the webcam. I run it, or you use Claude in Chrome if I connect it.
  - No G2 or G4 without a go-ahead.
- **Git:**
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:**
  - Core or content changes need my decision first. Each Pack 1 content change becomes the next D4 exception (9 is next).
  - Tablet, laptop and larger only; no mobile layouts.
  - 3D is independent of 2D, and the 2D player must not change. Don't edit anything under `src/player/**` (the gesture engine, the bridge, `StudentPlayer.tsx`) or `src/styles/app.css`.
- **Leave untouched:**
  - The authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees.
  - The main checkout `...\tmp\github-export\Lab_Studio_v2`: don't work in it or change its branch.
  - The microarray lab's folders, `virtual_lab\experiments\dna-microarray-3d` and `dnamicroarray_v2`: read them, never edit them.
  - Unselected projects (Projects `AGENTS.md` sync boundary).
- **Atomization policy (2026-10-02):** break steps down to the real physical actions, within reasonable limits, to build "muscle memory". New atoms not cited in the AP lab documents are expected. Prefer gestures that reproduce the real action.

**Tools and quirks:**
- **Dev server:** `preview_start` "lab-studio-3d-dev" (port 5182). It is defined in `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\lab-studio\.claude\launch.json`; create the entry in your session folder if it is missing.
  - It runs `pwsh -NoProfile -Command "Set-Location '<worktree>'; npx vite --host 127.0.0.1 --port $env:PORT --strictPort"`, with `"autoPort": true`.
  - It is not running now.
- **The microarray lab:** to look at it, add a static-server entry for `virtual_lab\experiments\dna-microarray-3d` to the same launch file. The worktree's own `.claude/launch.json` has one ("microarray-reference", port 8791).
- **The browser pane:** a hidden pane stops animation frames, so pours never finish drawing and carries are blocked.
  - For logic, use Menu → Reduced motion, then set it back.
  - For visuals, take one headless look with Playwright (`probes/look-dilution.cjs` is the template). Use `NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`, SwiftShader, and the player's quality set to Low.
- **Probes:** `node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs <probe>.mts`.
- **Models, generators and line endings:** see `SESSION_HANDOFF.md` → "Practicalities" and "Gotchas".
  - Line endings differ by file, and git keeps them byte for byte.
  - Edit CRLF files with a byte-aware script: normalize to LF, assert one match, restore CRLF.
  - Write longer scripts to a file rather than a heredoc.

**Pack 1 now:**

| Technique | State |
|---|---|
| Weigh a Solid | 5 steps; TARE and the spatula |
| Analyze Transmittance of a Dilution | 28 steps; funnel, working beaker, Beral pipettes |
| Dilute a Stock Solution | 12 atomized steps; pump, drop to the line, stopper, invert |
| Make a Solution | Still 3 old steps; atomization decided (task B) |
| Measure Liquid Volume | Host-bound (3D shows its gate only); waits for its two host labs |

**Task A, first: adopt the microarray lab's environment, bench view, mouse and hand control (decided).**

My decision (2026-10-03): "Definitely the lab env, bench view and mouse control of the bench (right and left clicks and moving/repositioning the bench), the hand gesture controlling the equipment must be used from here : C:\Users\EmilJivishov\Projects\virtual_lab\experiments\dna-microarray-3d\microarray-3d.html".

Follow `proposals/MICROARRAY_ADOPTION.md`:
- **P0, before building.** Put its §9 choices to me in one message, with your defaults marked, and record my answers in `DECISIONS.md`. The left-button model (§6.3) and the gesture table (§8) matter most.
- **P1 to P5:**
  - P1: environment and look;
  - P2: camera and mouse camera;
  - P3: the left button on the ported controller;
  - P4: hand control;
  - P5: records (`evidence/MICROARRAY_ADOPTION_EVIDENCE.md`, `DECISIONS.md`, `SESSION_HANDOFF.md`, and `AGENTS.md` as I decide).
- **After each phase:** typecheck; narrow tests written, not run; one G1 look; a local commit; a short report with a screenshot. Then carry on, unless something needs my decision.
- **Re-check line numbers.** The brief's line references were read on 2026-10-03; re-check one before relying on it.

**Task B, next: build Make a Solution** (decided; `proposals/PACK1_ATOMIZATION.md`), on the new controller:
- **Start:** the 100 mL volumetric flask, and a pre-weighed weigh boat holding the teacher's mass of sodium carbonate (a new weigh-boat model; none exists in 3D yet).
- **Transfer:**
  - a funnel seated in the flask's neck: a zone and anchor on the flask; generalize the two cylinder-funnel atoms to any narrow-necked vessel;
  - tip the solid into the funnel;
  - rinse the boat into the funnel, then rinse the funnel into the flask; remove the funnel.
- **Dissolve and fill:**
  - water to about half full;
  - swirl to dissolve in the flask. The runtime's dissolve must use the solid actually in the flask, and stay compatible with content that names no solid. Remove the stirring rod from the equipment.
  - water to just below the mark, then drop by drop to the mark (reuse `markDispense`);
  - stopper, invert ×10, and record the appearance.
- **Settings:** the solid's mass stays a teacher setting. The final volume is fixed at 100 mL, and "initial solvent volume" goes.
- **Records:** D4 exception 9, an evidence note, narrow tests (not run), one G1 look.

**Later:**
- a stopper and inversion for transmittance-dilution's test tube; an atom for weighing's zero step;
- per-item tray tiles; the long title overlapping the step counter at narrow widths;
- M8 acceptance (the provisional decisions listed in `SESSION_HANDOFF.md`).

Start by reading the files above, then send me the P0 questions.
