# Prompt for the next thread (2026-10-10: the Pack 3a build)

Paste everything between the two lines into a fresh Claude Code thread. Every fact in it was checked against the repository on 2026-10-10, then reviewed for fidelity the same day (the corrections are listed at the end, under "Fidelity review"). Re-check before relying on any of it.

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
   - both fidelity reviews, and the notes after revision 3 (items 28–31).
2. `DECISIONS.md`: the two Pack 3 rows and the D8 row.
3. `SESSION_HANDOFF.md`:
   - "State on 2026-10-04", items 5 to 11, and its "Practicalities";
   - "Running the app" and "Gotchas learned the hard way".
4. `proposals/D8_EXPERIMENT_ASSEMBLY.md` ("E0 design", with its table "What each twin drops") and `evidence/D8_E3_EVIDENCE.md`: how `intro-filtration-demo` was composed in 3D from twins. `scripts/practice3d/labs/introFiltrationDemo.mjs` is the pattern for a lab module.
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

**What the build scripts do today** (`scripts/practice3d/build.mjs`):
- Each `PRACTICE` entry is a module whose default export is the practice version and whose optional `twin` export is its one twin. `TWINS` holds twins with no practice version (`measuringVolumeTwin.mjs`). `LABS` lists the lab modules (today only `./labs/introFiltrationDemo.mjs`).
- `dryingPractice.mjs` has no `twin` export yet; `filtrationPractice.mjs:228` shows the pattern.
- Chromatography needs two twins from one module, which `build.mjs` can't write yet: extend it (for example a `twins` array export), keeping `--check`.

**The work, in this order** (the proposal's "Order of work", steps 1–5). Commit each step on its own, with its tests.

1. **`hard-water-demo` in 3D.**
   - **Calculate Hardness.** A module in `scripts/practice3d/` writes:
     - the practice version (6 steps; listed with `pack: 3`);
     - the twin `hard-water-calculation-3d` (the hardness step only).

     Follow the proposal's ids. Read the mass through `precipitateMassCalculationId` (`reducer.ts`, around line 7121), bound to Dry and Weigh's scoped calculation, and the sample volume through `sampleVolumeMeasurementId`. Keep its own result id `hardness-mg-l` literal. Use `requireStudentValue` with tolerance 0.5.
   - **Dry and Weigh's twin `drying-3d`.** `twins.json` lists `transfer-3d`, `hard-water-precipitation-3d`, `filtration-3d` and `measuring-volume-3d`; there is no `drying-3d` yet.
     - As D8's table says: drop "Note the paper's mass" (`note-paper-mass`) and the slot `precipitateMassG`; keep `paperMassG`, `watchGlassMassG` and `firstDryingMinutes`.
     - Make the paper-mass id a slot: today the by-difference step's `filterPaperMassMeasurementId` is the literal `filter-paper-mass` (`dryingPractice.mjs:246`). Default it to `filter-paper-mass` for the practice version; the lab binds it to `filtration--filter-paper-mass`.
   - **Decision 9.** Pack 2's 3D weighings read to 0.0001 g: Filtration's paper (`filtrationPractice.mjs:78`), and Dry and Weigh's watch glass and assembly (`dryingPractice.mjs:124` and `:232`), in the practice versions and the twins.
     - The balance takes its decimal places from the first `weigh` action on it, in action order (`balanceReadout`, `src/studio3d/adapters/instrumentDisplay.ts`). In the lab that is Filtration's paper.
     - Heat and Reweigh's crucible weighings (`heatReweighPractice.mjs:115`) aren't named by decision 9. Leave them at 0.001 g, and ask me if a reason to change them appears.
     - Update only the test values the change affects (for example `weigh-paper` and `weigh-combined` in `pack2Practice.test.ts`), and confirm all five practice versions still play. The `30.000 g` assertions in `teacherPreparedReadings.test.ts` and `adapters.test.ts` are Pack 1's Weighing, not affected.
   - **The lab module** `scripts/practice3d/labs/hardWaterDemo.mjs` (named as `introFiltrationDemo.mjs` is), added to `LABS`.
     - Its parts are the 2D lab's six, in its order, as 3D twins: Measure Liquid Volume, Transfer, Precipitation, Filtration, Dry and Weigh, and Calculate Hardness. That is `introFiltrationDemo.mjs`'s four parts, then `drying-3d` and `hard-water-calculation-3d`.
     - Use the 2D lab's instance ids: `measuring-volume`, `transfer`, `hard-water-precipitation`, `filtration`, `drying` and `hard-water-calculation`. The bindings follow them: `measuring-volume--sample-volume`, `filtration--filter-paper-mass`, `drying--precipitate-mass`. (The proposal's in-memory proof named the last part `hardness`.)
     - Give it a setup page with the teacher's values (the default precipitate is 0.0075 g, in 20 mL).
     - The proposal's in-memory proof played 59 steps (33 for the intro lab's parts, then the two new parts).
     - Prove with tests in `src/studio3d/__tests__/lab3d.test.ts`: it compiles, and it plays to 375 mg/L; a wrong hardness can be corrected.
   - **Tests that pin lists.** Extend these deliberately; don't loosen them:
     - `pack2Practice.test.ts:88–94` expects every practice entry to be Pack 2 and the ids to equal its `PLAYS`. Filter it to Pack 2.
     - `lab3d.test.ts:92` lists the four twins exactly, and `:152` the one lab. Add the new twins and labs in their order.
     - Pack 3's practice versions get their own test file, on `pack2Practice.test.ts`'s pattern: listed, validated, passing the catalogue policy, played to completion.
2. **Lab steps in `composeLab.mjs`.** Today it writes `actions: []`, `nodes: []` and only exit-to-entry connections. Add lab actions and their nodes, the connections into and out of them, and part labels for lab nodes (`labPartLabels`, `src/studio3d/labs3d.ts`).
   - Each lab action needs its effects, naming the parts' scoped ids.
   - An approval gate is checked only when compiling.
   - Prove it with a small fixture test: a record, a calculation and an approval between two parts. `hard-water-demo` can't prove it: its 2D lab has no lab steps (its safety notes are a field, not steps). The chromatography lab (step 5) is the first real use. Scripts and 3D only.
3. **Chromatography models** (the proposal's "New models", items 1–5 and 9), each named by its definition (`<definitionId>.glb`):
   - `chromatography-chamber`, with its lid, hook and label tape;
   - `chromatography-paper`, the strip and its states;
   - `capillary-spotter`, `pencil` and `metric-ruler`;
   - `distilled-water-bottle`, `propanol-bottle` and `waste-beaker` (the organic waste), each its own model.

   Already modelled, reused: `graduated-cylinder` (100 mL), `small-vial` (the dye) and `lab-sink` (the water's disposal).

   Build them to the refined standard, within the caps: 250,000 bytes per item, 4 MB for the pack.
   - **The validator.** `inventory_pack.ts --pack 3` evaluates only the listed practice versions with `pack: 3`, and after step 1 Calculate Hardness's is one. So list the chromatography practice version (step 4's module, at least its bench) before running `validate_equipment3d.py --pack 3` on the models.
   - The 2-propanol variant is unlisted, so check its bottle and the waste beaker by hand.
   - Note the glass draw-order issue; don't fix it.
4. **The chromatography practice version and twins.** Follow the proposal's sequence:
   - 30 steps for water and 32 for 2-propanol;
   - one module writes `paper-chromatography-practice` (water, listed with `pack: 3`), plus two twins, `paper-chromatography-water-3d` and `paper-chromatography-propanol-3d`.

   3D work it needs:
   - the pencil draw gesture;
   - a `spotOnto` handler, with spotting as six steps (decision 10);
   - the lid and the hook;
   - the step clock extended to the chromatography operations (`sceneToIntent.ts`);
   - the ruler reads with `requireStudentValue`.

   Use the runtime's existing `chromatographyOperation` and `chamberOperation`; add no new bench operations. Rf keeps its legacy calculation, with `requireRecordedMeasurements: true`.

   Add the tape-label atom by addition (decision 12) to `src/domain/atomRegistry.json`. Then regenerate `docs/atomic-steps.md` with `node scripts/checkContentConsistency.mjs --write-docs`; `content:check` fails while it is stale.
5. **The chromatography lab** (`paper-chromatography`, 3D).
   - The two trials, water then 2-propanol, as two parts with shared tools.
   - The lab steps around them. The 2D lab has 15, all records, around its one technique instance (`chromatography-trials`):
     - before (7): `review-challenge-safety`, `review-molecular-structures`, `record-imf-hypothesis`, `select-solvents`, `configure-repeatable-procedure`, `design-data-table`, `submit-procedure-approval`;
     - after (8): `compare-separation`, `evaluate-hypothesis`, `explain-phase-interactions`, `draw-process-model`, `evaluate-green-chemistry`, `write-cer-conclusion`, `record-interpretation-limits`, `complete-postlab-solubility`.

     The proposal's list (its Paper Chromatography sequence, "The lab") follows these and adds Prelab Part I and the Postlab Assessment (revision 3): about 18.
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
- `npm run content:check`. It exits 1 today with "baseline: 22 new"; that is the expected baseline, and any finding beyond it is the build's;
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
- **Line endings:** git keeps each file's own (`* -text`). Check every file before editing it by counting bytes, for example `py -I -c "b=open(r'<file>','rb').read(); print(b.count(b'\r\n'), b.count(b'\n'))"`. `grep -c $'\r$'` has given false readings here.
  - **CRLF** (byte-counted 2026-10-10), among the files 3a may touch:
    - `src/studio3d/bench/BenchEngine.ts` and `BenchView.tsx`;
    - `src/studio3d/player/Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts` and `Technique3DRoute.tsx`;
    - `src/studio3d/Studio3DApp.tsx`, `styles/studio3d.css`, `copy/slotLabels.ts`, `equipment3d/loadModels.ts` and `readiness.ts`;
    - `src/studio3d/__tests__/adapters.test.ts`, `equipment3dRegistry.test.ts` and `slotLabels.test.ts`;
    - `tools/blender/build_equipment3d.py`, `pack_models.py`, `validate_equipment3d.py`, and the other Blender files the handoff's "Gotchas" lists;
    - `DECISIONS.md`.
  - **LF:** `scripts/practice3d/**`, `src/studio3d/labs3d.ts`, `src/studio3d/adapters/*` (`sceneToIntent.ts` among them), `pack2Practice.test.ts`, `lab3d.test.ts`, `src/domain/atomRegistry.json`, `PACK3_ATOMIZATION.md` and `SESSION_HANDOFF.md`.
  - New files match their neighbours. Edit CRLF files with a byte-aware script (normalize to LF, assert one match, restore CRLF); Git Bash's `sed -i` turns a CRLF file into LF.

**Open items outside this task.** Don't start any of them:
- publishing the D8 experiment and Pack 2's changed practice versions, until I ask;
- G3;
- Pack 3b (brass), a later thread;
- the glass draw-order issue, for the polish pass;
- Heat and Reweigh's composition step accepts any typed value, in 2D and in its 3D practice version: the runtime's `carbonateMassLossComposition` branch (`reducer.ts`, around line 7606) computes from the masses and ignores the student's entry. It is shared runtime, so it is my decision, not this build's.

Start by reading the files above. Then confirm the facts in "For the build thread" that step 1 relies on (the scoping, the balance's places, the twins that exist), and build step 1.

---

## Fidelity review (2026-10-10)

The prompt was checked against the repository after it was written. Corrected:
1. **Lab steps' proof.** It offered `hard-water-demo`'s safety notes; the 2D lab has no lab steps. Now a fixture test, then the chromatography lab. The proposal's "Order of work" step 2 is corrected too (its item 28).
2. **Instance ids.** It assumed a part called `hardness`; the 2D lab calls it `hard-water-calculation`, and Precipitation's is `hard-water-precipitation`. Now the 2D lab's six (proposal item 29).
3. **The build script.** It can't write two twins from one module, and lists labs in `LABS`. Both are said now, with `dryingPractice.mjs` lacking a `twin` export.
4. **Dry and Weigh's twin.** Now names D8's table: the dropped step and slot, the kept slots, and where the paper-mass literal is.
5. **Tests that pin lists.** `pack2Practice.test.ts` expects every practice entry to be Pack 2, and `lab3d.test.ts` lists its twins and labs exactly. Named, to extend deliberately.
6. **Decision 9's reach.** Named the three `inputStep` lines; Heat and Reweigh is outside the decision; Pack 1's `30.000 g` tests are unaffected.
7. **The validator.** After step 1 it sees only listed Pack 3 practice versions, so the chromatography practice version is listed before its models are validated (proposal item 30).
8. **Models and twins.** Named by their definition ids; the reused models and the two chromatography twin ids are named.
9. **The 2D lab's 15 lab steps** are listed, with what revision 3 adds.
10. **The atom docs** are regenerated after the atom is added.
11. **`content:check`** exits 1 at its baseline; said so.
12. **Line endings.** The CRLF list is byte-counted, with the method, and the LF files 3a touches.
13. **Read first** adds the handoff's "Practicalities", "Running the app" and "Gotchas".
14. **Open items** add Heat and Reweigh's ignored entry.
