# Lab Studio 3D: handoff to a new Claude account (2026-10-19)

This is a self-contained starting point for a Claude Code session on a different Claude account. It does not rely
on the previous account's conversations, linked sessions, saved memory or scratchpad files: what those held is
written out here. It was checked against the repository on 2026-10-19.

It is an entry point, not the full record. `SESSION_HANDOFF.md` (the long handoff, updated through 2026-10-16) and
`DECISIONS.md` (every decision the user made) are in the same folder. Read this file first, then those two.

**Same computer only.** Every commit since 2026-09-24 exists only on this computer: the branch is 131 commits ahead
of its remote. A session on another computer will see none of this work until the branch is pushed, and pushing
waits for the user's explicit word.

---

## 1. The project

**Lab Studio** is a tool for authoring and playing AP Chemistry lab work:
- **Techniques** are made of atomized steps, the real physical actions.
- **Labs** (experiments) are composed from techniques.

The 2D app is on `main`.

**Lab Studio 3D** is built entirely on branch `claude/lab-studio-3d`, behind the flag `VITE_STUDIO_3D_V1=true`. It
is a three.js bench player (Player3D) and a Studio 3D, and it runs on the same runtime and content as 2D.

What it has so far:
- **Content:**
  - Pack 1: five techniques.
  - Pack 2: five practice versions.
  - Pack 3a: Calculate Hardness and Paper Chromatography.
  - Three labs: `intro-filtration-demo`, `hard-water-demo` and `paper-chromatography`.
- **Controls, taken from the DNA microarray 3D lab:** its room, camera, mouse control and hand-gesture control.
- **The look:**
  - a two-tier reagent shelf with a side station, in place of the old tray;
  - two themes, HUD (the default) and Light;
  - the lab hall (phase 1 of the lab room).
- **Camera views:** a level view adjustable by hand, and "At the bench" in the camera menu.
- **Glass:** glassware has its own look.

Pack 1 and Pack 2 were published on 2026-10-08 at https://virtuallab.az/experiments/lab-studio-3d/, built from
`97e791d`. Nothing since has been published.

## 2. Where things are

| What | Where / state on 2026-10-19 |
|---|---|
| Worktree | `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d` |
| Branch | `claude/lab-studio-3d`, HEAD `8494e46` "Record glassware's own look: decision and handoff" (2026-10-16) |
| Remote | `origin` = `https://github.com/jivishov/Lab_Studio_v2.git`. `origin/claude/lab-studio-3d` is at `713c248` (2026-09-24); the 131 commits after it are local only |
| Working tree | Clean: nothing modified, staged or stashed. Every earlier session's work is committed |
| The main checkout | `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\github-export\Lab_Studio_v2`, on `main` at `f5ea303` (the 2D version). It shares branches and the stash with the worktree. Don't work in it or change its branch |
| Records | `planning/2026-09-23_lab-studio-3d/` (paths below are relative to it unless they start with `src/`, `public/`, `scripts/` or `tools/`) |
| Local-only files in the worktree (git-ignored) | `.env.development.local` (sets `VITE_STUDIO_3D_V1=true`); `.claude/launch.json` (the user's own two reference servers, `microarray-reference` on 8791 and `photoreal-bench-reference` on 8792: keep them) |
| A temporary launch file | `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\lab-studio\.claude\launch.json`. It holds `lab-studio-3d-dev` (port 5182) and a stale `lab-studio-3d-baseline` (port 5184, whose worktree was removed on 2026-10-16). It belongs to the earlier sessions' folder; remove it when the 3D work ends |
| Dev servers | None running (ports 5181 to 5184 are free) |
| Playwright | Not installed in the worktree. Use `NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`; Chromium builds are in `%LOCALAPPDATA%\ms-playwright` |
| Blender | `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` |

**The documents** (in `planning/2026-09-23_lab-studio-3d/` unless noted):

| File | What it is |
|---|---|
| `SESSION_HANDOFF.md` | The long handoff: the state, items 1 to 15, rules, gotchas and known limits |
| `DECISIONS.md` | Every decision, with the user's words. The last rows (2026-10-16) are the lab room's, the level view's, At the bench's and glassware's |
| `IMPLEMENTATION_PLAN.md` (rev 2.1) | Scope, architecture, fidelity, milestones. **Never edit it** |
| `UI_UX_HANDOFF.md` (rev 1) | Layout, design, interaction and copy; its guardrails G-1 to G-13 win conflicts. **Never edit it** |
| `proposals/LAB_ROOM_LAYOUT.md` (rev 2) | The lab room plan, its five phases ("Phases") and decisions ("Decisions for you (revision 2)") |
| `LAB_ROOM_BUILD_PROMPT.md` | The prompt phase 1 was built from (done). A model for phase 2's prompt |
| `evidence/*.md` | One note per build: what was built, checked and not checked, and a fidelity review |
| `evidence/LAB_ROOM_EVIDENCE.md` | Phase 1's evidence, renders `evidence/renders/LR_*.jpg`, shots in `evidence/lab-room/` |
| `probes/README.md` | The static probes and the headless look scripts, with their options |
| `AGENTS.md` (worktree root) | The validation policy, the gesture rules, "Player3D Hand Control Rules" and "Lab Studio 3D Equipment Asset Rules" |
| `C:\Users\EmilJivishov\Projects\AGENTS.md` | The Projects workspace's sync boundary (the Projects folder is itself a Git repository) |

## 3. Rules for every change

### Branch and Git
- All 3D work is committed on `claude/lab-studio-3d`, in that worktree. **Never merge, fast-forward or push it into
  `main`**, local or on GitHub: `main` is the 2D version, kept completely separate (the user, 2026-10-10). On
  2026-10-10 local `main` was fast-forwarded by mistake and restored to `f5ea303`. If a request about "main" or
  "pushing" is ambiguous, ask which branch before moving any ref.
- Commit locally. **Push only when the user asks**, and publish to virtuallab.az only when asked
  (`PAGES_3D_PUBLISH.md`, section 9).
- Never use a bare `git stash`: the stash is shared with the main checkout.
- Never run `git clean -x`, a recursive `reset --hard` or a whole-worktree checkout from `C:\Users\EmilJivishov\Projects`:
  ignored local-only project folders live under it.
- Stage explicit paths. Never use `git add -A`, `git add .` or `git add -u`, above all while another session works in
  the same worktree.
- Earlier commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use the attribution line
  your own Claude Code session gives.

### Hands off
- The authoritative working copy `C:\Users\EmilJivishov\Projects\Lab_studio` (Projects branch `codex/Lab_Studio`).
  The one exception is its git-ignored `tmp\` worktrees.
- `tmp\github-export` (the main checkout).
- `virtual_lab`, except the temporary launch file above. This includes the microarray folders
  (`virtual_lab\experiments\dna-microarray-3d`, a local mirror guarded by a hook, and `dnamicroarray_v2`, the
  published copy): they are design references only.
- `AP_CHEM_LABS`, and any project not enrolled in the Projects workspace.
- **2D stays unchanged:**
  - nothing under `src/player/**` or `src/styles/app.css` changes;
  - nothing writes `public/techniques/` or `public/labs/`.

  3D content is generated into `public/techniques-3d/` and `public/labs-3d/` by `scripts/practice3d/build.mjs`.

### Content and science
- **D4 content rule:**
  - Pack 1's technique JSON and its generators change only through numbered D4 exceptions recorded in
    `DECISIONS.md`.
  - Any further content change, or a core change (the runtime, the atom or role registries), needs the user's
    decision first.
- **Atomization:**
  - Break each step down to the real physical actions, within reason, to build "muscle memory".
  - New atoms and roles not cited in the AP lab documents are expected; record their basis as the teacher's
    decision.
  - Still ask before changing content.
- **Teacher-prepared values:** the teacher sets the quantities and readings before play. The student follows the
  procedure and enters what they observe.
- **Guardrails:**
  - instruments are measurement-neutral, with no invented readings (G-1);
  - the resting scene equals the runtime's state (G-3);
  - colours come only from `resolveLiquidStyle` / `resolveSolidStyle` (G-9);
  - scenery never becomes a runtime object (G-8);
  - no sound (G-11);
  - tablet, laptop and larger screens only (G-12).
- **Real sizes:** equipment keeps its real size, with no display scale (lab room decision 5).
- **3D models:** follow `AGENTS.md`'s "Lab Studio 3D Equipment Asset Rules":
  - procedural Blender;
  - size budgets (250 KB an item);
  - provenance;
  - no contents or false labels baked in.

### Validation and gates
- **`AGENTS.md`'s default:** source review plus basic static checks. Write narrow tests, but don't run suites
  unless the user asks.
- **Tests and `content:check`:**
  - The user authorised the test suite and `content:check` on 2026-10-05.
  - The build prompts since then name them as checks.
  - When a task doesn't say, ask.
- **The gates:**
  - G1 is one browser look per change, and that is authorised.
  - Full G1 playthroughs, G2 (performance) and G4 (publishing) stay closed without the user's go-ahead.
  - G3 (a real webcam) was authorised on 2026-09-24 and has never run. The built-in pane blocks the webcam, so it
    needs the user, or Claude in Chrome once connected.

### How the user works (from the previous account's saved memory)
- **Decisions:**
  - They are asked in line: a few options, the recommended one first and marked "(Recommended)".
  - Each decision goes into a `DECISIONS.md` row, with the user's words and answers quoted exactly.
  - Each build gets an evidence note saying what was built, what was checked and what was not.
- **Each build or phase ends with one G1 look, then stops for the user's look.** Don't start the next phase
  unasked.
- **"Critically review … for fidelity" is a frequent request:**
  1. Compare the work against the governing documents, the source and any photos.
  2. List the findings.
  3. Fix them.
  4. Record them in the evidence note.
- **Realistic gestures over convenience.** For example, a calibrated thumb press on a plunger rather than a pinch.
  Make faint feedback a little more visible than reality where realism hides it.
- **The microarray port:** Lab Studio 3D ported the DNA microarray 3D lab's room, camera, mouse and hand control
  (`proposals/MICROARRAY_ADOPTION.md`). A change to those parts of the microarray lab matters for the port.
- **Connectors:** ignore the k12-education connectors' "needs authorization" notices (ASSISTments, Canva and the
  rest). Don't use those connectors unless the user asks.

### Line endings
Git stores every file byte for byte (`.git/info/attributes` has `* -text`), and line endings differ from file to
file. Check a file before editing it, and match what it has. `SESSION_HANDOFF.md`, "Gotchas", lists the files.
These are CRLF:
- `DECISIONS.md` and `UI_UX_HANDOFF.md`;
- `probes/look-room.cjs`;
- `src/studio3d/bench/BenchEngine.ts` and `BenchView.tsx`;
- `src/studio3d/player/Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts` and `Technique3DRoute.tsx`;
- `src/studio3d/Studio3DApp.tsx` and `src/studio3d/styles/studio3d.css`;
- `src/studio3d/equipment3d/viewerMaterials.json`;
- several `tools/blender/` modules.

These are LF:
- `src/studio3d/bench/look/*`, `bench/camera/*`, `bench/input/*`, `hand/*` and `adapters/*`;
- `SESSION_HANDOFF.md`, the evidence notes and `probes/README.md`.

Count line endings by bytes, for example in Python with `b.count(b"\r\n")` against `b.count(b"\n")`. Git Bash's
`grep -c $'\r$'` counts every line of an LF file too.

Git Bash's `sed -i` turns a CRLF file into LF. Edit CRLF files with a byte-aware script instead. The earlier one sat
in a scratchpad that a new account won't have, so here it is again. Save it outside the repository as
`crlf_edit.py`, then run `py crlf_edit.py <file> <edits.json>`, where `edits.json` is `[["old", "new"], …]` in LF text
and each `old` must match exactly once. Don't use it on a mixed file (`src/App.tsx`, `src/player/ProcessSidebar.tsx`).

```python
import json, sys
path, edits = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
raw = open(path, "rb").read()
crlf = b"\r\n" in raw
text = raw.decode("utf-8").replace("\r\n", "\n")
for old, new in edits:
    n = text.count(old)
    assert n == 1, f"{n} matches for {old[:60]!r}"
    text = text.replace(old, new)
if crlf:
    text = text.replace("\n", "\r\n")
open(path, "wb").write(text.encode("utf-8"))
```

## 4. Built and waiting for the user's look

None of these is pushed or published.

| Built | Commits | Record |
|---|---|---|
| **The lab room, phase 1** (2026-10-16): a teaching hall about 12 × 10 m around our island, with spine fittings, a neighbouring station, a far island, five windows, the end wall's fittings, a column, a stool, porcelain tiles, a ceiling grid and a cutaway of scenery in the camera's way. Scenery only: no slot, shelf spot, side station, `BENCH_MM` or Home moved | `aa21b14`, `481af48`, `f609a2a`, `8c9cc20`; records `0c75c38` | `evidence/LAB_ROOM_EVIDENCE.md`; `evidence/renders/LR_*.jpg`; `DECISIONS.md`, "The lab room, phase 1 built" |
| **The level view adjusted by hand**, and Eye level's line kept clear of the drop dialog | `67e94a9` | `DECISIONS.md`, "The level view adjusted by hand…" |
| **Glassware's own look** (empty vessels hold their shape against the windows). Bench glass at Home has not been looked at | `e59e848` | `DECISIONS.md`, "Glassware's own look" |
| **"At the bench"**, a working view in the camera menu. Not looked at in the app on bench items, only at the shelf | `6d186a5`; records `191f586`, `8494e46` | `DECISIONS.md`, "'At the bench', a working view…" |
| Older, built 2026-10-12/13: **the HUD step card and dock** | `583aad6`, `4ddb3f3`, `9fd4eb7` | `evidence/STEP_HUD_TOKEN_CONTRAST.md` |
| **The natural room**, the charcoal worktop and Home lowered to 0.45 rad | `4ba20ef`, `42c2fad` | `evidence/NATURAL_ROOM_EVIDENCE.md` |
| **The two themes**, Light and HUD | `f85c2aa` | `evidence/THEMES_EVIDENCE.md` |
| **Home fitted to the screen** and charcoal shelf boards, then Auto view's steady fit | `74ceed7`, `7e01cad` | `evidence/HOME_FIT_EVIDENCE.md` |
| **Right-drag moves the scene up and down** | `d38f9a1` | `evidence/RIGHT_DRAG_EVIDENCE.md` |

Phase 1 was checked at `8c9cc20`:
- tsc is clean;
- `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` passes, 36 files and 392 tests;
- `npm run content:check` exits 1 with "violations: 22", its accepted baseline;
- `node scripts/practice3d/build.mjs --check` exits 0;
- `py tools/blender/validate_equipment3d.py --pack 3` passes;
- no 2D path changed.

Home draws 754 calls per frame, against 771 before the hall. **The checks have not been re-run at `8494e46`**, the
commit after the level view, glassware and At the bench. Run them first.

**Still pending from phase 1:** the frame-time note, read once in the visible browser pane (section 6).

## 5. Open items for the user

- **The lab room's phases 2 to 5.** Each needs the user's go-ahead, and each ends with a look:
  - phase 2: the 1700 mm working area;
  - phase 3: the sight-line rule;
  - phase 4: Auto view's follow-ups;
  - phase 5: the records.
- **Auto view's two questions are already decided.**
  - The questions:
    - At a step whose items are all on the shelf, should Auto view go to Home?
    - Should Examine, the Selected view and picking from the Bench list use Auto view's steady framing?
  - Both were decided "yes" on 2026-10-16, in the lab room's decision 4 (`DECISIONS.md`, "The lab room" row).
  - They are built in phase 4.
  - `SESSION_HANDOFF.md` item 13 still lists them as waiting; correct that line when phase 4 lands.
- **The drying oven hides lower-tier items at Home:** three and half a fourth in `hard-water-demo`, one in Dry and
  Weigh. Phase 3's sight-line rule addresses it: no start spot behind a bench item taller than 300 mm, and the oven
  keeps its 2D slot.
- **Phase 1's fidelity review found a busy background at Home:** the far spine's service bar shows through the lower
  tier. The remedy offered is a back panel. It is the user's call.
- **The tier heights are a recorded difference:** they stay at 300 and 520 mm, against about 450 and 800 mm in the
  photos (decision 7).
- **A runtime question (2026-10-11):**
  - What happens: `withResolvedAttachments` merges in a relation derived from a child's snap zone that names the
    parent definition's first instance, even when the child already holds its own.
  - 3D works around it in `adapters/heldRelations.ts`.
  - Whether 2D draws the same is unchecked. A shared fix needs the user's decision.
- **Pack 3b (brass):** its 29 shelf items need a third tier or a second bay first.
- **Held until the user asks:** pushing, publishing, G3, Pack 3b, and Studio option (b) of D8.

## 6. What's next, in order

1. **The user's look, with the frame-time note.**
   1. Start the dev server (section 7).
   2. Open `#/3d/play/hard-water-demo` and `#/3d/play/paper-chromatography`, in both themes.
   3. Look at Home, Overhead, the orbits, At the bench and the level view.
   4. Read one frame time in the app's visible browser pane, never under SwiftShader. It is a note, not the G2
      gate.
      - Before reading, make sure the pane is showing (`document.hidden === false`).
      - The bench renders on demand, so a still scene draws nothing. Sample `requestAnimationFrame` intervals in
        the page while the camera moves, for example during a tween from Overhead back to Home, or a held drag.
      - Report the median and the slow tail, with the tier and the window size.
   5. Write the reading into `evidence/LAB_ROOM_EVIDENCE.md` in place of the "Frame time: pending" line under
      "Cost", and into `SESSION_HANDOFF.md` (item 14 and the lab room's "Known limits").
   6. Commit those two files by path.
2. **On the user's go-ahead: phase 2, the working area** (`proposals/LAB_ROOM_LAYOUT.md`, "Phases", and revision
   2's decision 2):
   - **What it builds:**
     - `BENCH_MM` 1700 × 700 mm, with the middle slot row staggered by half a column (slots 315 mm apart);
     - the wheel's farthest reach about 3.6 m;
     - Home fitting the working area and the rack's bays in use.
   - **Its tests:**
     - `toBench` / `fromBench` round-trip;
     - a saved 2D state loads unchanged;
     - Home fits at 1024 × 700 without the fallback;
     - no start item in the 14 routes stands directly behind one in the next row;
     - the hidden share of each start item at Home, before and after the stagger, is reported in the evidence.
   - **Its look:** the same views as phase 1, plus a slide and a zoom.
   - **The prompt first:** phase 1 was built from a build prompt checked against the code
     (`LAB_ROOM_BUILD_PROMPT.md`). The user then said "Implement the plan here: …". Offer to write phase 2's prompt
     the same way before building.
3. **Then phases 3, 4 and 5**, each on its own go-ahead.
4. **Pack 3b, publishing, pushing and G3** only when the user asks.

## 7. Running and checking

**The dev server** (PowerShell, from the worktree):

```powershell
npx vite --host 127.0.0.1 --port 5182 --strictPort
```

Vite ignores a `PORT` variable. So, for the app's built-in browser pane, add a `.claude/launch.json` entry in your
session's folder with `"autoPort": true` that passes the port through `pwsh`:

```json
{ "name": "lab-studio-3d-dev", "runtimeExecutable": "pwsh",
  "runtimeArgs": ["-NoProfile", "-Command", "Set-Location 'C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d'; npx vite --host 127.0.0.1 --port $env:PORT --strictPort"],
  "port": 5182, "autoPort": true }
```

Remove that entry and stop the server when the work ends.

**Routes:**
- `#/3d/studio`: Studio 3D. It opens on an empty draft; its tabs are Flow, Starting bench and Preview.
- `#/3d/technique/<id>`:
  - Pack 1: `weighing`, `measuring-volume` (host-bound: it shows only its gate), `making-solution`, `dilution`
    and `transmittance-dilution`;
  - the practice versions: `transfer-practice`, `hard-water-precipitation-practice`, `filtration-practice`,
    `drying-practice`, `thermal-decomposition-mass-loss-practice`, `paper-chromatography-practice` and
    `hard-water-calculation-practice`.
- `#/3d/play/<labId>`: `intro-filtration-demo` (33 steps), `hard-water-demo` (59) and `paper-chromatography` (81).

**Checks** (from the worktree):

| Check | Command | Expected |
|---|---|---|
| Types | `npx tsc -p tsconfig.app.json --noEmit` | Clean |
| 3D tests | `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` | All pass (36 files and 392 tests at `8c9cc20`). Under load a file can fail to start ("Timeout waiting for worker to respond"); re-run those files alone |
| Content | `npm run content:check` | Exit 1, "violations: 22" (the baseline; leave it) |
| Practice build | `node scripts/practice3d/build.mjs --check` | Exit 0 |
| Models | `py tools/blender/validate_equipment3d.py --pack 3` | Pass |
| 2D untouched | `git diff --stat <base> -- src/player src/styles/app.css public/techniques public/labs` | Empty |

**Models:**
1. Build: `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/blender/build_equipment3d.py -- --only <ids> --review [--composites]`.
2. Pack: `py tools/blender/pack_models.py --only <ids>`.
3. Run the validator.

Review renders land in `tools/blender/.build/review/`. New materials go in two places:
- `tools/blender/labeq/materials.py`;
- `src/studio3d/equipment3d/viewerMaterials.json`, which is CRLF.

**Generated files:**
- Atom docs: `node scripts/generateAtomicStepsDocs.mjs`.
- transmittance-dilution: `node scripts/generateSimulatorTechniqueDefinitions.mjs --only transmittance-dilution`.
- The 3D practice versions, twins and labs: `node scripts/practice3d/build.mjs`.

**Headless looks (G1)** are run from `planning/2026-09-23_lab-studio-3d/` with
`NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`. `probes/README.md` has every option. Examples:

```bash
LOOK_URL=http://localhost:5182/#/3d/play/hard-water-demo LOOK_VIEWPORT=1024x700 LOOK_THEME=hud LOOK_VIEWS="Overhead" LOOK_ORBITS="180,-90" node probes/look-room.cjs evidence/<folder>/<prefix> balanced
HOMESHOT=1 PLAY_THEME=light PLAY_QUALITY=high node probes/play-steps.cjs "http://localhost:5182/#/3d/play/paper-chromatography" evidence/<folder>/<outdir> 1 1
node probes/count-draws.cjs http://localhost:5182 hard-water-demo balanced 1024x700
```

They run under SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`).

## 8. Gotchas

- **SwiftShader is slow:**
  - At 1920 × 1080 a frame takes seconds, and the engine clamps a frame's dt to 0.1 s, so a 650 ms camera tween
    takes many seconds of wall time.
  - Screenshots can take minutes. Use `LOOK_SETTLE=4` and `LOOK_SHOT_TIMEOUT=420000`, and shoot each orbit in its
    own run.
  - Run headless looks one at a time, with nothing heavy alongside: concurrent runs, Blender builds and vitest
    caused timeouts.
  - Never read frame times from SwiftShader.
- **Orphaned headless Chrome:**
  - A stopped look can leave a `chrome-headless-shell` running with no parent, eating several cores.
  - Check with `Get-Process chrome-headless-shell` before a run.
  - Stop only one whose parent process is gone.
- **`play-steps.cjs` has a fixed wait:** it waits 3 s and then clicks the start button, so under load it can miss
  the setup page and time out on `.s3d-step__title`. Re-run it on a quiet machine. `look-room.cjs` already waits
  for the start button.
- **The Studio's "Starting bench" tab builds the 3D bench in its click handler.** Playwright's click times out
  there under SwiftShader, so `look-room.cjs`'s `LOOK_CLICK` clicks it from the page instead.
- **A hidden app window:**
  - It pauses `requestAnimationFrame` and `ResizeObserver`, so screenshots time out and React Flow can't measure.
  - Check the DOM with page scripts instead.
  - A hidden page can't take focus either; dispatch `focusout` to trigger React's `onBlur`.
  - A `<dialog>` close may not fire; dispatch `new Event('close')`.
- **The bench renders on demand:** after changing the scene from a page script, call `requestRender()` on the
  engine.
- **Shell pitfalls:**
  - Never run `cat >` without a heredoc in Bash; it waits on stdin.
  - Long Bash heredocs have failed, so write longer scripts to a file first.
  - In PowerShell, array-of-pairs replacements mangle multi-line strings; use an editor tool instead.
- **Runtime rules found the hard way:**
  - Every physical action needs a registry atom.
  - A `legacyActionEffects` entry must equal the handler-derived effect.
  - A step that should finish only on acceptance is validated by a recorded measurement or a notebook tag, not by
    `actionEvidence`.
- **Code gotchas:**
  - React 19's `useRef` needs an explicit initial value.
  - React Flow with controlled nodes must keep the `dimensions` changes and pass `measured` back.

## 9. A prompt to start the new session

Open Claude Code in `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d` and paste:

> You are continuing Lab Studio 3D in this worktree, branch `claude/lab-studio-3d`. Read
> `planning/2026-09-23_lab-studio-3d/NEW_ACCOUNT_HANDOFF.md` first, then `SESSION_HANDOFF.md` and `DECISIONS.md` in
> the same folder, and follow their rules:
> - never merge or push into `main`;
> - commit locally by explicit paths, and push only when I ask;
> - never use a bare `git stash`;
> - keep 2D unchanged;
> - ask me before any content or core change.
>
> Confirm the branch, HEAD and a clean `git status`, then tell me what is waiting for my look and what you recommend
> next. Don't start the lab room's phase 2 until I say so.
