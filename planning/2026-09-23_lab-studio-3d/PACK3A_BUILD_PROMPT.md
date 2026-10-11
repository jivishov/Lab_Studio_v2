# Prompt for the next thread (2026-10-10: the Pack 3a build)

Paste everything below the line into a fresh Claude Code thread. Every fact in it was checked against the repository on 2026-10-10. Most were checked by compiling and playing in memory during the Pack 3 proposal's fidelity review (revision 3). Re-check before relying on any of it.

---

Continue Lab Studio 3D. The next step is **the Pack 3a build**. Pack 3 was proposed, reviewed for fidelity twice and decided on 2026-10-10 (`proposals/PACK3_ATOMIZATION.md`, revision 3; decisions 1–12, every one as recommended). 3a is:
- Calculate Hardness;
- Dry and Weigh's twin;
- Pack 2's balance at 0.0001 g;
- `hard-water-demo` in 3D;
- lab steps in 3D labs;
- Paper Chromatography with its models and its lab.

Brass (3b) is a later thread. Build what was decided; don't redesign it.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** `origin/claude/lab-studio-3d` is still at `713c248`, and every later commit is local. Push only when I ask.
- **Live site:** Pack 1 and Pack 2 are published at https://virtuallab.az/experiments/lab-studio-3d/ (virtual_lab commit `e2ab6c2`, built from `97e791d`).
  - Decision 9 changes Pack 2's published practice versions. That is expected; they reach the site only when I ask for a publication.
  - Don't republish unless I ask. When I do, follow `planning/2026-09-23_lab-studio-3d/PAGES_3D_PUBLISH.md`, section 9.

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `proposals/PACK3_ATOMIZATION.md`, in full. Start with "For the build thread", which lists what the build will meet, each fact with its proof. Then read:
   - the sequences for Paper Chromatography and Calculate Hardness;
   - "Shared new capabilities" and "New models";
   - "Core changes and effects on 2D" and "Teacher-prepared values";
   - "Decisions";
   - both fidelity reviews.
2. `DECISIONS.md`: the two Pack 3 rows and the D8 row.
3. `SESSION_HANDOFF.md`, section "State on 2026-10-04", items 5 to 11.
4. `proposals/D8_EXPERIMENT_ASSEMBLY.md` ("E0 design") and `evidence/D8_E3_EVIDENCE.md`: how `intro-filtration-demo` was composed in 3D from twins. `scripts/practice3d/labs/introFiltrationDemo.mjs` is the pattern for a lab module.
5. `evidence/PACK2_EVIDENCE.md`, and in `scripts/practice3d/`:
   - Pack 2's modules;
   - `common.mjs` (`twinOf`), `build.mjs` and `composeLab.mjs`.
6. `proposals/MODEL_REFINEMENT.md`: the standard for new models.
7. The sources (read only):
   - `C:\Users\EmilJivishov\Projects\AP_CHEM_LABS\atomic_steps\sticky-question-paper-chromatography_2026-07-27.md`;
   - `ap-chem-lab-manual-student-inv-5.pdf` in `AP_CHEM_LABS`, and `-inv-3.pdf` for the balance;
   - `docs/architecture/source-trace-registry.json`, for each step's trace and basis label.
8. `probes/README.md`.

**Already done, don't redo:** the 3D step card offers Submit again after a wrong calculation (`0fa32ee`, tested in `src/studio3d/__tests__/pack2Practice.test.ts`). The runtime always replaced a failed calculation on resubmission, but the card turned Submit off.

**The work, in this order** (the proposal's "Order of work", steps 1–5). Commit each step on its own, with its tests.

1. **`hard-water-demo` in 3D.**
   - **Calculate Hardness.** A module in `scripts/practice3d/` writes:
     - the practice version (6 steps; listed with `pack: 3`);
     - the twin `hard-water-calculation-3d` (the hardness step only).
     
     Follow the proposal's ids. Read the mass through `precipitateMassCalculationId`, bound to Dry and Weigh's scoped calculation, and the sample volume through `sampleVolumeMeasurementId`. Keep its own result id `hardness-mg-l` literal. Use `requireStudentValue` with tolerance 0.5.
   - **Dry and Weigh's twin.** There is no `drying-3d` yet: `twins.json` lists `transfer-3d`, `hard-water-precipitation-3d`, `filtration-3d` and `measuring-volume-3d`. Write it with the paper-mass id as a slot, default `filter-paper-mass`. The lab binds the slot to Filtration's scoped id.
   - **Decision 9.** Pack 2's 3D weighings read to 0.0001 g: Filtration's paper, and Dry and Weigh's watch glass and assembly, in the practice versions and the twins.
     - The balance takes its decimal places from the first weighing on it, so start with Filtration's paper.
     - Update the values Pack 2's tests assert (for example `weigh-paper` and `weigh-combined` in `pack2Practice.test.ts`), and confirm all five practice versions still play.
   - **The lab module** `scripts/practice3d/labs/hardWaterDemo.mjs` (named as `introFiltrationDemo.mjs` is).
     - Its parts are the 2D lab's six, in its order, as 3D twins: Measure Liquid Volume, Transfer, Precipitation, Filtration, Dry and Weigh, and Calculate Hardness.
     - The proposal's scoped ids assume the instance ids `measuring-volume`, `filtration`, `drying` and `hardness`. If you use other instance ids, the bindings follow them.
     - Give it a setup page with the teacher's values (the default precipitate is 0.0075 g).
     - Prove with a test that it compiles and plays to 375 mg/L, and that a wrong hardness can be corrected.
2. **Lab steps in `composeLab.mjs`.** Today it writes `actions: []`, `nodes: []` and only exit-to-entry connections. Add lab actions and their nodes, the connections into and out of them, and part labels for lab nodes (`labPartLabels`, `src/studio3d/labs3d.ts`).
   - Each lab action needs its effects, naming the parts' scoped ids.
   - An approval gate is checked only when compiling.
   - Prove it on `hard-water-demo`'s safety notes or on the chromatography lab. Scripts and 3D only.
3. **Chromatography models** (the proposal's "New models", items 1–5 and 9):
   - the chamber with its lid, hook and label tape;
   - the strip and its states;
   - the capillary, pencil and ruler;
   - the distilled-water and 2-propanol bottles and the organic-waste beaker, each its own model (there are no aliases).
   
   Build them to the refined standard, within the caps: 250,000 bytes per item, 4 MB for the pack. Write the practice entries before running `validate_equipment3d.py --pack 3`. The 2-propanol variant is unlisted, so check its bottle and the waste beaker by hand. Note the glass draw-order issue; don't fix it.
4. **The chromatography practice version and twins.** Follow the proposal's sequence:
   - 30 steps for water and 32 for 2-propanol;
   - one module writes `paper-chromatography-practice` (water, listed with `pack: 3`), plus two twins, water and 2-propanol.

   3D work it needs:
   - the pencil draw gesture;
   - a `spotOnto` handler, with spotting as six steps (decision 10);
   - the lid and the hook;
   - the step clock extended to the chromatography operations (`sceneToIntent.ts`);
   - the ruler reads with `requireStudentValue`.

   Use the runtime's existing `chromatographyOperation` and `chamberOperation`; add no new bench operations. Rf keeps its legacy calculation, with `requireRecordedMeasurements: true`. Add the tape-label atom by addition (decision 12).
5. **The chromatography lab** (`paper-chromatography`, 3D).
   - The two trials, water then 2-propanol, with shared tools. Around them go the lab steps, about 18: before, safety, Prelab Part I and HP-01 to HP-09; after, CP-02 to CP-08 and the Postlab Assessment.
   - The setup page holds the prepared distances and bands. The prepared Rf (band ÷ front) needs a 3D-only transform in `labs3d.ts`, or the distances fixed: decide which in line with me.
   - Prove with a test that the lab compiles and plays to completion.

**Stop and ask** (AskUserQuestion, recommended option first), and record my answers in `DECISIONS.md`:
- any shared change beyond decision 12's atoms: a catalogue definition, a reducer branch or a runtime parameter. Bring a test proving 2D unchanged;
- any effect on 2D;
- any departure from the decided sequences;
- any interpretation the build meets.

**Check and record:**
- `npx tsc -p tsconfig.app.json --noEmit`;
- `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d`;
- `npm run content:check` (baseline 22 findings);
- `python tools/blender/validate_equipment3d.py --pack 3`;
- `node scripts/practice3d/build.mjs --check`;
- one G1 look per change, using the probes as patterns;
- `evidence/PACK3A_EVIDENCE.md`, with a fidelity review of what was built before you report;
- a "built" row in `DECISIONS.md`;
- `SESSION_HANDOFF.md` brought up to date, with a 3b prompt if I ask for one.

**Standing constraints:**
- **Gates:**
  - G1: one browser look per change is fine.
  - G3 (webcam hand control) is set aside.
  - No G2. No publishing unless I ask.
- **Git:**
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - The branch `claude/lab-studio-3d` is the final, authoritative code for the 3D version, kept completely separate from the 2D version. Never merge, fast-forward or push it into `main`, local or on GitHub, which is the 2D version.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:**
  - The 2D player must not change: nothing under `src/player/**` or `src/styles/app.css`.
  - Nothing writes `public/techniques/` or `public/labs/`.
  - The 2D generators are not touched.
  - Tablet, laptop and larger only; no mobile layouts.
  - Core or content changes beyond the decisions need my decision first.
- **Hands off:**
  - the authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees;
  - the main checkout `...\tmp\github-export\Lab_Studio_v2`;
  - the microarray lab's folders;
  - `AP_CHEM_LABS` (read only);
  - `virtual_lab`, except through the publishing instructions and only when I ask;
  - unselected projects (the Projects `AGENTS.md` sync boundary);
  - `IMPLEMENTATION_PLAN.md` and `UI_UX_HANDOFF.md` (never edit).
- **Policies:**
  - Atomize to real physical actions within reason ("muscle memory"). New atoms not cited in the AP documents are fine; record the teacher's decision as their basis.
  - Prefer gestures that reproduce the real action, and modestly boost faint visuals.
  - Keep the science guardrails G-1, G-3, G-8, G-9 and G-11.
  - Teacher-prepared readings: instruments stay measurement-neutral.
- **Line endings:** check every file before editing it. These are CRLF:
  - `BenchEngine.ts`, `Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts`, `Technique3DRoute.tsx`, `studio3d.css` and `DECISIONS.md`;
  - the rest listed under "Gotchas" in `SESSION_HANDOFF.md`.
  
  Edit them with a byte-aware script.

**Open items outside this task.** Don't start any of them:
- publishing the D8 experiment and Pack 2's changed practice versions, until I ask;
- G3;
- Pack 3b (brass), a later thread;
- the glass draw-order issue, for the polish pass.

Start by reading the files above. Then confirm the facts in "For the build thread" that step 1 relies on (the scoping, the balance's places, the twins that exist), and build step 1.
