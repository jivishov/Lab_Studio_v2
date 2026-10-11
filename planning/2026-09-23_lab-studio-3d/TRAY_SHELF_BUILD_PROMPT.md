# Prompt for the next thread (2026-10-11: the shelf in place of the tray)

Paste everything between the two lines into a fresh Claude Code thread, or start it with:
"Implement the plan here: C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d\planning\2026-09-23_lab-studio-3d\TRAY_SHELF_BUILD_PROMPT.md".
Every fact in it was checked against the repository on 2026-10-11 (HEAD after `f07dab5`). Re-check before relying on any of it.

---

Continue Lab Studio 3D. The next step is **the shelf in place of the tray**: build `proposals/SHELF_INSTEAD_OF_TRAY.md`, option B, as I approved it on 2026-10-11 ("The full tray proposal is valid."). That approves every recommended answer to its four decisions:
1. **Option B:** a reagent shelf, a side station and a Shelf list.
2. **The large stations** (ring stand, analytical balance, Bunsen burner) stand at a side station at the bench's right end. In the runtime they are still on `shelf`.
3. **A text Shelf list** stays for keyboard and screen readers.
4. **The hand reaches the shelf** through a raised-hand tier mapping, not a separate shelf mode.

The tray is presentation only: the runtime location `shelf` is unchanged, and 2D (which draws `shelf` as its sidebar) is untouched. Build what was decided; don't redesign it.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** everything after `713c248` is local. Push only when I ask.
- **Live site:** Pack 1 and Pack 2 at https://virtuallab.az/experiments/lab-studio-3d/. Don't republish unless I ask (then `PAGES_3D_PUBLISH.md`, section 9).

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `proposals/SHELF_INSTEAD_OF_TRAY.md`, in full: the evaluation table, option B, the phases and the risks.
2. `DECISIONS.md`: the rows "Pack 3a follow-ups" and "The shelf in place of the tray" (the approval), and the D9 row (visual-only scenery).
3. `SESSION_HANDOFF.md`: "State on 2026-10-04", "Open decisions and items for the user", "Running the app" and "Gotchas learned the hard way".
4. `evidence/PACK3A_EVIDENCE.md`, "Follow-ups (2026-10-11)": the tile (the latest scenery, the pattern for the shelf) and the stable layout. Item 11 of its list (the tray covers the step card at 1024 × 700) is what this build settles.
5. `proposals/MODEL_REFINEMENT.md`: the standard for new models.
6. `probes/README.md`, the last three rows: the G1 scripts.

**What exists today, with where:**
- **The tray.** `runtimeToScene.ts` (`src/studio3d/adapters/`) pushes every `location === "shelf"` instance into `scene.tray` (`SceneTrayItem`: `instanceId`, `definitionId`, `label`, `model?`). `EquipmentTray` (`src/studio3d/player/panels.tsx:152`) draws it as the floating panel `"tray"` (`panelLayout.ts`, `PanelId`), mounted in `Player3D.tsx` around line 1191. Each tile:
  - shows a "needed now" dot (`currentStepEquipmentIds`, `currentStepInstanceIds`);
  - places with Enter or Space: `player.dropFromTray(definitionId, undefined, undefined, instanceId)`;
  - starts a carry on pointer-down (`carry.startTrayCarry`, `src/studio3d/bench/input/useBenchCarry.ts:1036`);
  - dims while the hand holds it (`gestureGrabbedInstanceId`);
  - has the label "…, needed now. Pick it up and set it on the bench, or press Enter to place it."
- **Placing.** `dropFromTray` (`usePlayer3D.ts:519`) starts from the item's stable slot (`stablePlacementPoint`, `src/studio3d/adapters/stableBench.ts`), finds the nearest free spot, then runs the expected step's intent or a move.
- **The Bench list** (`panels.tsx`, around line 232) already has "On the shelf · N" (`s3d-bl-shelf`), names only.
- **Stable spots.** `stableBench.ts` gives each item one slot for the whole run (15 slots, a fixed point for the ring stand, a student's own move wins). The shelf's spots follow the same rule, from the start order.
- **Scenery (D9).** The tile and the rack: a Blender module with `SCENERY = True`, drawn by `BenchEngine` through `this.models.instance`, named `scenery:<id>`, raycast off, added to `itemLayer` (`BenchEngine.ts`, around line 530). Never an instance (G-8).
- **The room.** `src/studio3d/bench/look/room.ts:154–166`: a decorative shelf with five bottles at `(3.1, 2.45, -4.33)`. The working shelf replaces it.
- **The camera.** `src/studio3d/bench/camera/benchCamera.ts`: `DEFAULT_VIEW` (Home), `MANUAL.atZ` (the slide's range), `FRAME_REACH`, `slideBy`. The beacon and the step framing follow `flow.source.instanceId` and `flow.target.instanceId` (`stepRules.ts`, `Endpoint`), picked in `Player3D.tsx` (`expectedSourceId`, `expectedTargetId`).
- **The hand.** `src/studio3d/hand/` (`handController.ts`, `handCore.ts`, `useHandControl.ts`) and `player/HandControlPanel.tsx`. A hand carry goes through `useBenchCarry.ts` and works in the bench plane.
- **What starts on the shelf:** at most 12 items (`hard-water-demo`), 11 in `paper-chromatography`, 3 to 10 in the techniques. Large items: `ring-stand` (5 uses), `analytical-balance` (2), `bunsen-burner` (1).

**The work, in the proposal's phases.** Commit each change on its own, with its tests.

1. **Draw.**
   - The shelf model as Blender scenery (a module under `tools/blender/equipment/`, as `white_tile.py`): two tiers on uprights along the back of the bench, about 1.2 m long and 180 mm deep, the tiers about 300 and 520 mm above the bench top. Within the caps (250,000 bytes per item). Remove the decorative shelf and its bottles from `room.ts`.
   - A deterministic spot per shelf item from the start order (a pure function beside `stableBench.ts`, unit-tested), small items on the tiers, and the side station at the bench's right end for the ring stand, balance and burner.
   - Items on `shelf` drawn on their spots as real models at true scale. Measure the load time before the first step, with and without (the proposal's open measurement).
   - Shelf-edge tags and hover names; an enlarged hit area for slender items (capillary, pencil, ruler), as the bench has; a modest boost where an item is faint.
   - The beacon and the framing on a shelf item when the step names one.
   - A Home view and a slide range that show the shelf and the bench together.
   - Tests: spots are stable and distinct; 12 items fit (Hard Water); the large items go to the side station.
2. **Take.**
   - Mouse and touch: picking a shelf item starts the bench's own carry (the `startTrayCarry` path), and setting it down runs the same intent or move as `dropFromTray`. Touch targets at least 44 px at the Home view.
   - The **Shelf list**: the Bench list's "On the shelf · N" becomes the keyboard and screen-reader path, with Enter to place (`dropFromTray(..., instanceId)`) and the "needed now" wording.
   - Remove `EquipmentTray` and its panel `"tray"` (the panel layout, the help text and the tests that name it), keeping the hand pinch's dimming where it still applies.
   - G1 at 1024 × 700 on `#/3d/play/paper-chromatography` (11 items) and `#/3d/play/hard-water-demo` (12), and one technique.
   - **Stop here for my look** (the proposal says so) before the hand work.
3. **Hand.** The raised-hand tier mapping in `src/studio3d/hand/`: raising the hand addresses the shelf tier, lowering it the bench; a pinch over a shelf item picks it up. Prove it with unit tests on the mapping; G3 (the webcam look) stays set aside unless I authorize it.
4. **Review.** A fidelity pass over every 3D technique and lab (each starts with its items on the shelf or the side station and plays as before), then the records.

**Risks to watch** (the proposal's): tall bench items hiding the shelf; more than about 14 shelf items in a future pack (a third tier or a second bay); tiny items staying hard to see even with tags. Report them; don't build past them without asking.

**Stop and ask** (AskUserQuestion, recommended option first), and record my answers in `DECISIONS.md`:
- any shared change: a catalogue definition, a reducer branch or a runtime parameter. Bring a test proving 2D unchanged;
- any effect on 2D;
- any departure from the approved option B or the decided sequences;
- any interpretation the build meets (for example which items count as large, or a lab whose items don't fit).

**Check and record:**
- `npx tsc -p tsconfig.app.json --noEmit`;
- `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` (297 pass on 2026-10-11; a worker start timeout under CPU load is the machine, re-run);
- `npm run content:check`: exits 1 with "violations: 22", the expected baseline; anything beyond it is the build's;
- `node scripts/practice3d/build.mjs --check`;
- `py tools/blender/validate_equipment3d.py --pack 3`;
- `git status` shows no 2D paths;
- one G1 look per change;
- `evidence/TRAY_SHELF_EVIDENCE.md`, with a fidelity review of what was built before you report;
- a "built" row in `DECISIONS.md`;
- `SESSION_HANDOFF.md` brought up to date.

**Tooling:**
- **Blender** (scenery is built and packed like any model):
  ```bash
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/blender/build_equipment3d.py -- --only <ids> --review
  py tools/blender/pack_models.py --only <ids>
  py tools/blender/validate_equipment3d.py --pack 3
  ```
  `pack_models.py` regenerates `registry.json`. Materials go in `tools/blender/labeq/materials.py`, and a new viewer role in `viewerMaterials.json` and `src/studio3d/bench/look/materials.ts`.
- **The preview for G1.** The desktop app's preview reads `.claude/launch.json` in the thread's working directory. Create it for the look and delete it afterwards:
  ```json
  { "version": "0.0.1", "configurations": [ { "name": "lab-studio-3d-dev", "runtimeExecutable": "pwsh",
    "runtimeArgs": ["-NoProfile", "-Command", "Set-Location 'C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d'; npx vite --host 127.0.0.1 --port $env:PORT --strictPort"],
    "port": 5182 } ] }
  ```
- **Headless looks** with Playwright from `probes/` (`play-steps.cjs`, `place-from-tray.cjs`, `slide-bench.cjs`), with `export NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`, against `http://127.0.0.1:5182/#/3d/...`.
  - A whole lab replay takes more than 10 minutes under SwiftShader: run it in the background, not under a 600 s timeout.
  - The camera tweens: a shot taken right after a step can catch it mid-move. Use `SEQSHOT` (timed shots) before calling anything missing.
  - `place-from-tray.cjs` targets the tray panel; the Shelf list needs its own selectors.

**Standing constraints:**
- **Gates:** G1, one browser look per change. G3 (webcam hand control) is set aside. No G2. No publishing unless I ask.
- **Git:**
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - The branch `claude/lab-studio-3d` is the final, authoritative code for the 3D version, kept completely separate from the 2D version. Never merge, fast-forward or push it into `main`, local or on GitHub, which is the 2D version.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:**
  - The 2D player must not change: nothing under `src/player/**` or `src/styles/app.css`.
  - Nothing writes `public/techniques/` or `public/labs/`.
  - The 2D generators are not touched.
  - Tablet, laptop and larger only; no mobile layouts (G-12).
  - Core or content changes beyond the decisions need my decision first.
- **Hands off:**
  - the authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees;
  - the main checkout `...\tmp\github-export\Lab_Studio_v2`;
  - the microarray lab's folders;
  - `AP_CHEM_LABS` (read only);
  - `virtual_lab`, except the temporary `.claude/launch.json` above and publishing when I ask;
  - unselected projects (the Projects `AGENTS.md` sync boundary);
  - `IMPLEMENTATION_PLAN.md` and `UI_UX_HANDOFF.md` (never edit).
- **Policies:**
  - Atomize to real physical actions within reason; prefer gestures that reproduce the real action (here: reach, lift from the shelf, set down on the bench).
  - Modestly boost faint visuals.
  - Keep the science guardrails G-1, G-3, G-8, G-9 and G-11. The shelf and the side station are scenery (G-8); the items on them are real instances.
- **Line endings:** git keeps each file's own (`* -text`). Count bytes before editing: `py -I -c "b=open(r'<file>','rb').read(); print(b.count(b'\r\n'), b.count(b'\n'))"`.
  - **CRLF** (byte-counted 2026-10-11): `BenchEngine.ts`, `Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts`, `styles/studio3d.css`, `adapters.test.ts`, `build_equipment3d.py`, `pack_models.py`, `validate_equipment3d.py`, `labeq/materials.py`, `viewerMaterials.json`, `DECISIONS.md`.
  - **LF:** `room.ts`, `panels.tsx`, `panelLayout.ts`, `benchCamera.ts`, `useBenchCarry.ts`, `src/studio3d/hand/*`, `HandControlPanel.tsx`, `runtimeToScene.ts`, `stableBench.ts` and its test, `bench/look/materials.ts`, `registry.json`, `white_tile.py`, `SESSION_HANDOFF.md`, the evidence notes and proposals.
  - Edit CRLF files with a byte-aware script (normalize to LF, assert one match per edit, restore CRLF). Git Bash's `sed -i` turns a CRLF file into LF.

**Open items outside this task.** Don't start any of them:
- publishing;
- G3;
- Pack 3b (brass);
- the glass draw-order issue (the polish pass);
- Heat and Reweigh's composition step accepting any typed value (shared runtime, my decision);
- the runtime's duplicate derived attachment (`withResolvedAttachments` / `deriveLegacyAttachments`, `src/runtime/attachments.ts`): 3D keeps each child's first relation (`adapters/heldRelations.ts`); a shared fix is my decision.

Start by reading the files above. Then confirm the facts under "What exists today", and build phase 1.

---
