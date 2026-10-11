# Prompt for the next thread (2026-10-11: the shelf in place of the tray)

Paste everything between the two lines into a fresh Claude Code thread, or start it with:
"Implement the plan here: C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d\planning\2026-09-23_lab-studio-3d\TRAY_SHELF_BUILD_PROMPT.md".
Every fact in it was checked against the repository on 2026-10-11 (at `1742ff1`), then reviewed for fidelity the same day (the corrections are listed at the end, under "Fidelity review"). Re-check before relying on any of it.

---

Continue Lab Studio 3D. The next step is **the shelf in place of the tray**: build `proposals/SHELF_INSTEAD_OF_TRAY.md`, option B, as I approved it on 2026-10-11 ("The full tray proposal is valid."). That approves every recommended answer to its four decisions:
1. **Option B:** a reagent shelf, a side station and a Shelf list.
2. **The large stations** stand at a side station at the bench's right end. In the runtime they are still on `shelf`.
3. **A text Shelf list** stays for keyboard and screen readers.
4. **The hand reaches the shelf** through a raised-hand tier mapping, not a separate shelf mode.

Read the proposal's "Notes after approval" with it: the fidelity review found a fourth large station (the spectrophotometer), a larger maximum (13 items), and that the hand picks in screen space.

The tray is presentation only: the runtime location `shelf` is unchanged, and 2D (which draws `shelf` as its sidebar) is untouched. Build what was decided; don't redesign it.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** `origin/claude/lab-studio-3d` is at `713c248`; every later commit is local. Push only when I ask.
- **Live site:** Pack 1 and Pack 2 at https://virtuallab.az/experiments/lab-studio-3d/. Don't republish unless I ask (then `PAGES_3D_PUBLISH.md`, section 9).

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `proposals/SHELF_INSTEAD_OF_TRAY.md`, in full, with its "Notes after approval".
2. `DECISIONS.md`: the rows "Pack 3a follow-ups" and "The shelf in place of the tray" (the approval), and D9 (visual-only scenery).
3. `SESSION_HANDOFF.md`: "State on 2026-10-04", "Open decisions and items for the user", "Running the app" and "Gotchas learned the hard way".
4. `evidence/PACK3A_EVIDENCE.md`, "Follow-ups (2026-10-11)": the tile (the latest scenery model) and the stable layout. Item 11 of its list (the lab's tray covers its step card at 1024 × 700) is what this build settles.
5. `UI_UX_HANDOFF.md`, the guardrail table (G-1 to G-13; read only, never edit).
6. `proposals/MODEL_REFINEMENT.md`: the standard for new models.
7. `probes/README.md`, the last three rows: the G1 scripts.

**What exists today, with where:**
- **The tray.**
  - `runtimeToScene.ts` (`src/studio3d/adapters/`) puts every `location === "shelf"` instance into `scene.tray` (`SceneTrayItem`: `instanceId`, `definitionId`, `label`, `model?`). `BenchEngine` never reads `scene.tray`, so shelf items' models load only when placed or carried.
  - `EquipmentTray` (`src/studio3d/player/panels.tsx:152`) draws it as the floating panel `"tray"` (`panelLayout.ts`, `PanelId`). Each tile:
    - shows a "needed now" dot, computed there from `currentStepEquipmentIds` and `currentStepInstanceIds`, guided mode only;
    - places with Enter or Space: `player.dropFromTray(definitionId, undefined, undefined, instanceId)`;
    - starts a mouse or touch carry on pointer-down (`carry.startTrayCarry`, `src/studio3d/bench/input/useBenchCarry.ts:1036`);
    - has the label "…, needed now. Pick it up and set it on the bench, or press Enter to place it."
  - In `Player3D.tsx`:
    - the panel state starts as `"tray"` (line 87), and the tray and the Bench list are exclusive (`panel`: `"tray" | "list" | "none"`, around line 1191);
    - the dock has a Tray button (line 1209);
    - hand control takes the tiles as targets (see "The hand").
  - Other mentions:
    - styles in `studio3d.css` (`.s3d-tray`, lines 155–156 and 347, and the carried thumbnail at 248);
    - the hand guide "Close your grip over an item or a tray item and hold" (`HandControlPanel.tsx:100`);
    - `panelLayout.test.ts:12` and `handControl.test.ts:124`.
  - A stored layout that still names `"tray"` is harmless: `sanitizeLayout` keeps only known panels.
- **Placing.** `dropFromTray` (`usePlayer3D.ts:519`) starts from the item's stable slot (`stablePlacementPoint`, `src/studio3d/adapters/stableBench.ts`), finds the nearest free spot, then runs the expected step's intent or a move.
- **Putting back.** Esc or a right-click while holding returns the item where it came from (the help's "Put it back"). A carry from the shelf goes back to the shelf.
- **Pours from a shelf source.** A pour whose source stays on the runtime shelf is staged beside its target (`pourStagingScene`, `runtimeToScene.ts:424`). Afterwards the source "goes back to the tray" (`Player3D.tsx`, around line 279).
- **The Bench list** (`panels.tsx`, around line 232) has "On the shelf · N" (`s3d-bl-shelf`), names only. It starts closed.
- **Stable spots.** `stableBench.ts` gives each item one slot for the whole run: `SLOT_COUNT = 15`, a fixed point for the ring stand, and a student's own move wins. The shelf's spots follow the same rule, from the start order.
- **Scenery (D9).** The tile and the rack are each tied to an item (`item.benchScenery`, `item.scenery`):
  - drawn by `BenchEngine` through `this.models.instance`;
  - raycast off;
  - named `scenery:<id>`;
  - the tile is added to `itemLayer` (`BenchEngine.ts`, around lines 514–537).

  The shelf and the side station are different: the bench's own furniture, present in every scene, tied to no item. That needs a new engine path, loaded once. `validate_equipment3d.py` checks every registry entry flagged `scenery` (no catalogue id; GLB and thumbnail present).
- **The room.** `src/studio3d/bench/look/room.ts:154–166`: a decorative wall shelf with five bottles, high on the back wall at the right, in room units (`shelf.position.set(3.1, 2.45, -4.33)`). The working shelf replaces it.
- **The camera.** `src/studio3d/bench/camera/benchCamera.ts`:
  - `DEFAULT_VIEW` (Home, through `BenchEngine.resetView`);
  - `MANUAL.atZ` (the slide's range);
  - `FRAME_REACH`;
  - `slideBy`.

  The beacon and the step framing follow `flow.source.instanceId` and `flow.target.instanceId` (`stepRules.ts`, `Endpoint`). `Player3D.tsx` picks them (`expectedSourceId`, `expectedTargetId`, from line 403), today only among bench items.
- **The hand** (`src/studio3d/hand/`, `player/HandControlPanel.tsx`).
  - **The cursor** is the palm's position in the camera image relative to a home point, with gain, mapped onto the whole canvas (`handTracker.ts`, around lines 431–446). Raising the hand already moves the cursor up the canvas.
  - **Targets are in screen space** (`handTargets`, `Player3D.tsx:170–191`):
    - bench items and instrument keys from `engine.screenTargets()`, filtered to the bench;
    - tray tiles from their DOM rectangles (`kind: "tile"`, picked through `pickUpTile` → `carry.startGestureTrayCarry`, `useBenchCarry.ts:1072`).
  - **Gestures** (`handController.ts`, the table at its top):
    - a pick-up is a closed grip held 350 ms over a target;
    - a pinch is the plunger;
    - "lower the palm" after a lock is the insertion depth (seat, deliver).
  - **The carry** moves in the bench plane.
  - **Tests:**
    - `handControl.test.ts`, a screen-space rig, includes the tray-tile pick-up;
    - `player3DHandControl.test.tsx` renders Player3D in jsdom with a fake engine.
  - The browser can't run the hand without a webcam (G3, set aside).
- **The 3D Studio** (`#/3d/studio`) uses the same `BenchView`, `BenchEngine` and room, through `src/studio3d/studio/BenchSetupView.tsx` (with "Return to shelf" and its own "On the shelf" group) and `EquipmentTurntable.tsx`. The shelf and the room change show there too.
- **What starts on the shelf** (counted from the runtime's start state, 2026-10-11):

  | Content | On the shelf | Large items among them |
  |---|---|---|
  | `transmittance-dilution` (Pack 1) | 13 | `spectrophotometer` (320 × 300 mm); two `sample-bottle-1l` (101 mm wide) |
  | `hard-water-demo` (lab) | 12 | `ring-stand` |
  | `paper-chromatography` (lab) | 11 | none |
  | `thermal-decomposition-mass-loss-practice` | 10 | two `analytical-balance`, `ring-stand`, `bunsen-burner` |
  | `intro-filtration-demo` (lab) | 9 | `ring-stand` |
  | the other techniques and practice versions | 0 to 9 | `analytical-balance` (`weighing`), `ring-stand` (filtration) |

  - **The side station** must hold up to four large items at once (Heat and Reweigh: two balances 220 × 330 mm, a ring stand and a burner).
  - **Long items** must lie along a tier, because they are longer than the 180 mm shelf is deep: the 10 mL graduated pipette (330 mm), the crucible tongs (230 mm), the stirring rod (200 mm), the pencil and the ruler (about 172 mm).
  - **Tall items** must fit the tier gap (about 220 mm between the tiers): the 1 L bottles, the 100 mL cylinder and the wash bottle. Check them against their models.

**The work, in the proposal's phases.** Commit each change on its own, with its tests. Hand control, the mouse, touch and the keyboard must each still work at every commit.

1. **Draw.**
   - **The shelf model** as Blender scenery (a module under `tools/blender/equipment/`, as `white_tile.py`, flagged `SCENERY = True`, never a catalogue id). Two tiers on uprights along the back of the bench, about 1.2 m long and 180 mm deep, the tiers about 300 and 520 mm above the bench top. It must fit within the 250,000-byte cap per item. Remove the decorative wall shelf and its bottles from `room.ts`.
   - **The side station** at the bench's right end, for every large station: the ring stand, the analytical balance, the Bunsen burner and the spectrophotometer. The spectrophotometer follows decision 2's rule; say so in the evidence. It must hold Heat and Reweigh's four.
   - **Spots.** A deterministic spot per shelf item from the start order: a pure function beside `stableBench.ts`, unit-tested. Long items lie along the tier, and tall ones go on the upper tier.
   - **Drawing.** Items on `shelf` are drawn on their spots as real models at true scale, raycast on, distinct from bench items. Measure the time to the first step on `transmittance-dilution` and `hard-water-demo`, with and without the shelf drawn (the proposal's open measurement).
   - **Tags and visibility.** Shelf-edge tags and hover names; an enlarged hit area for slender items (capillary, pencil, ruler), as the bench has; and a modest boost where an item is faint.
   - **The beacon and the framing** reach a shelf item when the step needs one. Today `expectedSourceId`, `expectedTargetId` and the tool and pipette ids look only at the bench (`Player3D.tsx:403–426`), and the hand's aim assist uses the same ids. Guided mode only (G-7).
   - **The Home view and the slide range** show the shelf, the side station and the bench together.
   - **Tests:** spots are stable and distinct; `transmittance-dilution`'s 13 fit (12 on the tiers, the spectrophotometer at the side station); Heat and Reweigh's four large items fit the side station; long items lie along the tier.
2. **Take.**
   - **Mouse and touch.** Picking a shelf item starts the bench's own carry (the `startTrayCarry` path). Setting it down runs the same intent or move as `dropFromTray`, and Put it back returns it to its own spot. Touch targets are at least 44 px at the Home view.
   - **Pours from a shelf source** leave from the source's shelf spot and go back to it, instead of appearing beside the target.
   - **The Shelf list.** The Bench list's "On the shelf · N" becomes the keyboard and screen-reader path. It has:
     - Enter to place (`dropFromTray(..., instanceId)`);
     - the "needed now" wording, moved from `EquipmentTray`, guided mode only.

     Every step must stay possible without the canvas (G-6).
   - **Remove `EquipmentTray`** and the panel `"tray"`: the panel id, the dock button, the styles, the hand guide's "tray item" wording, and the tests that name the panel. `scene.tray` can keep its name as the runtime-to-scene data.
   - **Keep the hand working in the same change.** Removing the tiles removes the hand's only way to take an item off the shelf. So the shelf items replace the tile targets in `handTargets`, at their drawn screen positions, through the same `pickUpTile` → `startGestureTrayCarry` path.
   - **Look (G1)** at 1024 × 700:
     - `#/3d/play/paper-chromatography` (11 items);
     - `#/3d/play/hard-water-demo` (12);
     - `#/3d/technique/transmittance-dilution` (13, with the spectrophotometer);
     - `#/3d/technique/thermal-decomposition-mass-loss-practice` (four large items);
     - `#/3d/studio`, the bench setup.
   - **Stop here for my look** (the proposal says so) before the hand work.
3. **Hand.** The raised-hand tier mapping. As the code stands it is screen-space reach: raising the hand moves the cursor up to the tier, and a closed grip held over a shelf item picks it up.
   - **What to make sure of:**
     - a comfortable raise reaches the upper tier at the Home view (the tracker's gain and home point);
     - aim assist snaps to the step's shelf item in guided mode (G-7);
     - the carried item shows as the 3D item itself, not a thumbnail;
     - the guide's wording names the shelf.
   - **What to avoid:**
     - Don't use the palm's lowering, which is the insertion depth.
     - Add no new gesture meaning (G-10).
     - If the mapping needs more than this, ask.
   - **Proof:**
     - unit tests in `handControl.test.ts` (shelf targets in its screen-space rig);
     - tests in `player3DHandControl.test.tsx`.

     The proposal's "G1 with the hand" can't be done in the browser without a webcam. That is G3, which stays set aside unless I authorize it; say so in the evidence.
4. **Review.** A fidelity pass over every 3D technique and lab (each starts with its items on the shelf or the side station and plays as before), then the records.

**Risks to watch** (the proposal's):
- tall bench items hiding the shelf;
- more than about 14 shelf items: Pack 3b's brass content has 29 on the 2D shelf, so it will need a third tier or a second bay;
- tiny items staying hard to see even with tags.

Report them; don't build past them without asking.

**Stop and ask** (AskUserQuestion, recommended option first), and record my answers in `DECISIONS.md`:
- any shared change: a catalogue definition, a reducer branch or a runtime parameter. Bring a test proving 2D unchanged;
- any effect on 2D;
- any departure from the approved option B or the decided sequences;
- any interpretation the build meets. Expect at least these:
  - which panel, if any, opens at the start and what the dock shows once the tray goes (today the tray opens at the start and the Bench list starts closed);
  - whether the canvas's arrow keys reach shelf items or stay on the bench (the Shelf list is the keyboard path either way);
  - an item that doesn't fit a tier or the side station.

**Check and record:**
- `npx tsc -p tsconfig.app.json --noEmit`;
- `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d`: 297 pass on 2026-10-11. A worker start timeout under CPU load is the machine; re-run;
- `npm run content:check`: exits 1 with "violations: 22" ("baseline: 22 new"), the expected baseline. Anything beyond it is the build's;
- `node scripts/practice3d/build.mjs --check`;
- `py tools/blender/validate_equipment3d.py --pack 3`;
- `git status` shows no 2D paths;
- one G1 look per change;
- `evidence/TRAY_SHELF_EVIDENCE.md`, with a fidelity review of what was built before you report;
- a "built" row in `DECISIONS.md`;
- `SESSION_HANDOFF.md` brought up to date.

**Tooling:**
- **Blender.** Scenery is built and packed like any model:
  ```bash
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tools/blender/build_equipment3d.py -- --only <ids> --review
  py tools/blender/pack_models.py --only <ids>
  py tools/blender/validate_equipment3d.py --pack 3
  ```
  - `pack_models.py` regenerates `registry.json`.
  - Materials go in `tools/blender/labeq/materials.py`.
  - A new viewer role goes in `viewerMaterials.json` and `src/studio3d/bench/look/materials.ts`.
- **The preview for G1.** The desktop app's preview reads `.claude/launch.json` in the thread's working directory. Create it for the look and delete it afterwards:
  ```json
  { "version": "0.0.1", "configurations": [ { "name": "lab-studio-3d-dev", "runtimeExecutable": "pwsh",
    "runtimeArgs": ["-NoProfile", "-Command", "Set-Location 'C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d'; npx vite --host 127.0.0.1 --port $env:PORT --strictPort"],
    "port": 5182, "autoPort": true } ] }
  ```
  Use the port the preview reports.
- **Headless looks** with Playwright, from `probes/`:
  - the scripts are `play-steps.cjs`, `place-from-tray.cjs` and `slide-bench.cjs`;
  - set `export NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`;
  - point them at `http://127.0.0.1:<port>/#/3d/...`.

  Things to know:
  - A whole lab replay takes more than 10 minutes under SwiftShader. Run it in the background, not under a 600 s timeout.
  - The camera tweens, so a shot taken right after a step can catch it mid-move. Use `SEQSHOT` (timed shots) before calling anything missing.
  - `play-steps.cjs` types Paper Chromatography's answers. Extend its `INPUTS` for other numeric steps.
  - `place-from-tray.cjs` targets the tray panel. The Shelf list needs its own selectors.

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
  - Atomize to real physical actions within reason. Prefer gestures that reproduce the real action; here that is reaching up, lifting from the shelf and setting down on the bench.
  - Modestly boost faint visuals.
  - Keep the science guardrails G-1, G-3, G-8, G-9 and G-11. For this build also mind:
    - G-6: every step without the canvas;
    - G-7: guidance in guided mode only;
    - G-10: one gesture system.

    The shelf and the side station are scenery (G-8). The items on them are real instances, drawn where the runtime has them (G-3).
- **Line endings:** git keeps each file's own (`* -text`). Count bytes before editing: `py -I -c "b=open(r'<file>','rb').read(); print(b.count(b'\r\n'), b.count(b'\n'))"`.
  - **CRLF** (byte-counted 2026-10-11):
    - `src/studio3d/`: `bench/BenchEngine.ts`, `bench/BenchView.tsx`, `player/Player3D.tsx`, `player/usePlayer3D.ts`, `player/stepRules.ts`, `styles/studio3d.css`, `equipment3d/loadModels.ts`, `equipment3d/viewerMaterials.json` and `__tests__/adapters.test.ts`;
    - `tools/blender/`: `build_equipment3d.py`, `pack_models.py`, `validate_equipment3d.py` and `labeq/materials.py`;
    - `DECISIONS.md`.
  - **LF:**
    - `src/studio3d/bench/`: `look/room.ts`, `look/materials.ts`, `camera/benchCamera.ts` and `input/useBenchCarry.ts`;
    - `src/studio3d/player/`: `panels.tsx`, `panelLayout.ts`, `HandControlPanel.tsx` and `SimulationSwitcher.tsx`;
    - `src/studio3d/hand/*`;
    - `src/studio3d/adapters/`: `runtimeToScene.ts`, `sceneToIntent.ts`, `stableBench.ts` and `footprints.ts`;
    - `src/studio3d/studio/`: `BenchSetupView.tsx` and `EquipmentTurntable.tsx`;
    - `equipment3d/registry.json`;
    - `src/studio3d/__tests__/`: `handControl.test.ts`, `player3DHandControl.test.tsx`, `panelLayout.test.ts`, `sceneToIntent.test.ts`, `stableBench.test.ts` and `lab3d.test.ts`;
    - `white_tile.py`;
    - `SESSION_HANDOFF.md`, the evidence notes and the proposals.
  - Edit CRLF files with a byte-aware script (normalize to LF, assert one match per edit, restore CRLF). Git Bash's `sed -i` turns a CRLF file into LF.

**Open items outside this task.** Don't start any of them:
- publishing;
- G3;
- Pack 3b (brass);
- the glass draw-order issue (the polish pass);
- Heat and Reweigh's composition step accepting any typed value (shared runtime, my decision);
- the runtime's duplicate derived attachment (`withResolvedAttachments` / `deriveLegacyAttachments`, `src/runtime/attachments.ts`). 3D keeps each child's first relation (`adapters/heldRelations.ts`); a shared fix is my decision.

Start by reading the files above. Then confirm the facts under "What exists today", and build phase 1.

---

## Fidelity review (2026-10-11)

The prompt was checked against the repository after it was written. Corrected:
1. **The counts.** It said at most 12 items (Hard Water) and 3 to 10 in the techniques. Pack 1's `transmittance-dilution` starts with 13; the techniques range from 0 to 13. Recounted from the runtime's start state, with the three labs compiled.
2. **The large stations.** The proposal named the ring stand, the balance and the burner. `transmittance-dilution` also has a spectrophotometer (320 × 300 mm), and Heat and Reweigh puts four large items on the shelf at once (two balances, a ring stand, a burner). Both are now named, with the side station's capacity, and the proposal has a note.
3. **Long and tall items.** Five items are longer than the shelf is deep; they are named. Three tall ones are named to check against the tier gap; their heights were not measured here.
4. **The hand.** It said the hand works in the bench plane and picks with a pinch. In fact:
   - the cursor and the targets are in screen space;
   - a pick-up is a closed grip held 350 ms (a pinch is the plunger);
   - lowering the palm is the insertion depth.

   The tier mapping is described in those terms.
5. **A gap between phases.** Removing the tray in phase 2 would have left hand control unable to take anything off the shelf until phase 3. Phase 2 now swaps the hand's tile targets for the shelf items.
6. **The hand's look.** The proposal's "G1 with the hand" can't run in the browser without a webcam (G3). Now unit and jsdom tests, with the gap said in the evidence.
7. **What else the tray touches:**
   - the panel state and the dock;
   - the styles and the guide wording;
   - pours from a shelf source;
   - Put it back;
   - the 3D Studio, which shares the engine and the room.

   The open interpretations (the start panel and the dock; the arrow keys) are listed under "Stop and ask".
8. **Scenery.** The tile and the rack are tied to items; the shelf is the bench's own furniture and needs its own engine path. Said so.
9. **The preview's launch entry** lacked `"autoPort": true`. Now added, with the reported port.
10. **Line endings.** Re-counted, with the test and Studio files the build may touch.
