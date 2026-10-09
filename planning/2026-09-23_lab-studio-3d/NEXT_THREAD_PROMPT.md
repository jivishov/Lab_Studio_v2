# Prompt for the next thread (2026-10-08: the D8 discussion)

Paste everything below the line into a fresh Claude Code thread. Every fact in it was checked against the repository on 2026-10-08, by reading the code; re-check before relying on any of it. The Pack 3 proposal comes after this, from `PACK3_PROPOSAL_PROMPT.md`.

---

Continue Lab Studio 3D. The next step is **D8: how experiments are assembled from the atomic steps**.
- On 2026-10-05 I confirmed every other open decision at its default and said D8 "will be decided later in a separate discussion with you."
- On 2026-10-08 I chose to settle it before the Pack 3 proposal, because three of Pack 3's five techniques run only inside 2D labs.

**Your job:** prepare the discussion, hold it with me, and record what I decide. Don't build anything.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** `origin/claude/lab-studio-3d` is still at `713c248`, and every later commit is local. Push only when I ask.
- **Live site:** Pack 1 and Pack 2 are published at https://virtuallab.az/experiments/lab-studio-3d/ (virtual_lab `e2ab6c2`, built from `97e791d`). Don't republish unless I ask.

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `SESSION_HANDOFF.md`, section "State on 2026-10-04". Its items 4 to 8 are the latest.
2. `DECISIONS.md`:
   - the D8 row of the open-decisions table;
   - the confirmation of 2026-10-05 above that table;
   - the Pack 2 row: practice versions, with the labs untouched "until D8".
3. `IMPLEMENTATION_PLAN.md`:
   - §2.2 (the two ways experiments are built);
   - §2.7 (which experiments each pack unlocks);
   - §4.6 (Studio 3D against the existing mechanism; the "D8 b" row);
   - §8 (Phase B, E0 to E4);
   - §13, item 2;
   - Appendix A, row 4.
4. `UI_UX_HANDOFF.md`: how the plan presents the two options:
   - the "Flattened experiment draft (D8 a)" pattern and mock-up S8;
   - the group frame with entry and exit ports for compiled drafts (D8 b).

   Never edit this file or the plan.
5. `proposals/PACK2_ATOMIZATION.md`:
   - "The first decision" (options A, B and C);
   - item 1 of "Fidelity review (revision 2)".
6. `evidence/PACK2_EVIDENCE.md`:
   - "Found, not changed" (`hard-water-demo` cannot be finished in 2D);
   - the line "Studio 3D does not list the practice versions until D8".

**What D8 has become.** The plan framed D8 as a Studio question:
- **(a)** keep flattening techniques into experiment drafts;
- **(b)** add composition-source authoring, compiled by the same compiler the published experiments use.

Since then the question has grown. This is what I found on 2026-10-08:

- **(a) is built.** Studio 3D's experiment drafts flatten techniques, with the note "Techniques are copied with their own equipment. A vessel does not carry across techniques." (`ExperimentSummary` in `src/studio3d/studio/Inspector.tsx`).
- **Published experiments compile when they load.**
  - The path: `loadBundledLab` (`src/data/loadBundledLabs.ts`) → `compileBundledLabCompositionWithPolicy` (`src/data/bundledCatalogPolicyBoundary.ts`) → `compileLabComposition` (`src/data/compileLabComposition.ts`).
  - The 2D Studio can open a published experiment that is already compiled: `loadBundledLab` in `src/studio/TeacherStudio.tsx`. It cannot compile a draft it has authored.
  - An edit marks a compiled draft "detached" (`markCompositionDetached`, `src/studio/studioTransactions.ts`).
- **No experiment plays in 3D.** The route `#/3d/play/<labId>` exists, but shows "This route does not run anything yet." (`src/studio3d/Studio3DApp.tsx`).
- **Pack 2 added a second question: which steps the experiments use.**
  - Pack 2's atomized steps live in the practice versions in `public/techniques-3d/`, whose `catalogDisposition` is `standalone-practice`. The 2D labs compose the unchanged originals.
  - **The compiler refuses to compose a `standalone-practice` technique.** Only `composable` and `lab-scoped` are allowed (`src/domain/compositionValidation.ts`, "cannot compose technique … with catalog disposition"). That disposition was in the core before this branch.
  - **The practice contracts differ from the originals'.** Take Filter a Precipitate:
    - its entry and exit nodes differ;
    - it has 10 equipment roles against 6, adding the balance, stirring device, rinsed vessel and receiving vessel;
    - its evidence outputs are `filter-paper-reading`, `filter-paper-mass` and `mixture-filtered`, against `filtration-complete` and `rinse-complete`.

    So a lab's bindings and connections, written for the original, would not fit.
  - **Each practice version brings its own starting bench.** A composed lab supplies one bench, and its equipment bindings carry vessels across techniques.
- **The labs at stake:**
  - **From Packs 1 and 2:**
    - `intro-filtration-demo`: Measure Liquid Volume, Transfer, Precipitation and Filter a Precipitate, with 3 connections;
    - `hard-water-demo`: the same four, plus Dry and Weigh and Calculate Hardness, with 5 connections;
    - `green-chemistry-mixture-purification`: Heat and Reweigh only, on a custom route.
  - **From Pack 3:** `paper-chromatography`, `brass-colorimetry`, and the last technique of `hard-water-demo`.
  - **Measure Liquid Volume** can play only inside the first two labs.
  - **`hard-water-demo` cannot be finished in 2D today,** because of two content faults found in the Pack 2 review and left as they are.

**Decisions any option must respect:**
- 3D is independent of 2D, and the 2D player's code doesn't change: nothing under `src/player/**` or `src/styles/app.css`.
- Pack 2's choice to keep the working 2D labs working.
- The atomization policy and teacher-prepared values.
- Core changes, including to the composition contract, the compiler and the catalogue policy, need my decision.

**What the discussion should settle.** For each question, the brief gives the options, their costs and a recommendation. Don't decide for me.
1. **Which steps 3D experiments use.** For example:
   - **(i)** 3D experiments compose the practice versions:
     - a 3D lab list parallel to `public/labs/`, generated like `public/techniques-3d/`;
     - a core change so the compiler accepts practice versions in 3D labs only;
     - the 2D labs unchanged.
   - **(ii)** The labs move to the atomized steps: the originals change once (Pack 1's route), and those 2D labs stop being finishable in 2D.
   - **(iii)** One technique carries both procedures, and each player picks its own. Weigh this against the existing composition machinery (`variants`, `orderedProcedure`) and its effect on 2D content.
   - **(iv)** Anything better that your research shows.

   For each, give the duplication, the core changes, the effects on 2D and the risk of the versions drifting apart.
2. **How a 3D experiment plays.** For example, compile through the same path as `loadBundledLab` and play the compiled lab in Player3D at `#/3d/play/<labId>`. List what Player3D lacks for a compiled lab:
   - technique boundaries and ports;
   - carried vessels on one bench;
   - lab setup forms;
   - the switcher;
   - the step clock across techniques.
3. **Studio authoring, which is the plan's D8 itself.** Keep (a) only, or build (b), composition-source authoring, as Phase B's centre (E0, E1). Also decide whether Studio 3D lists the practice versions.
4. **Order.** Say which experiment comes first; the plan's E3 is `intro-filtration-demo` after Pack 2. Say how the answer changes Pack 3's first decision.
5. **`hard-water-demo`'s 2D faults.** Do they stay out of scope, or get fixed when its 3D version is built? A 2D content fix needs my decision.

**How to work:**
- **Research first.** Read the code paths above, and confirm every fact in this prompt.
  - A narrow probe may compile a lab, for example `intro-filtration-demo`, to show the compiled manifest, the way the probes in `probes/` load techniques. Put probes in your scratchpad or in `probes/`.
  - `tools/blender/inventory_pack.ts --pack 2` gives the evaluated inventory where it helps.
- **Write the brief:** `proposals/D8_EXPERIMENT_ASSEMBLY.md`, with LF line endings, kept short. It holds:
  - the facts;
  - the options for each question, with their costs;
  - your recommendations;
  - what each recommendation commits us to: core changes, files and order;
  - what stays open.
- **Review the brief before showing it to me.** Check it critically for fidelity against the code and the records, fix what you find, and log the changes in it.
- **Hold the discussion.** Put the questions to me in line with AskUserQuestion, recommended option first, in one or two rounds. I may want to talk some of them through in prose; follow my lead.
- **Record the outcome:**
  - the decision, in `DECISIONS.md`: update the D8 row. The file is CRLF, so use a byte-aware script.
  - the brief's "Decisions" section;
  - the state in `SESSION_HANDOFF.md`;
  - a note at the top of `PACK3_PROPOSAL_PROMPT.md` saying how D8 changes Pack 3's first decision.
- **If the decision leads to work** (the E0 design, a core change), end the brief with "For the build thread" and write the next prompt, but don't start the work.
- **Commit locally,** then report briefly.

**Standing constraints:**
- **Validation.** The test suite and `content:check` are authorised (2026-10-05). A brief needs neither. For later builds:
  - `npx tsc -p tsconfig.app.json --noEmit`;
  - `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` (the default worker count times out);
  - `npm run content:check`: its baseline is 22 findings, the same as GitHub main.
- **Gates:**
  - G1: one browser look per change is fine.
  - G3 (webcam hand control) is set aside.
  - No G2. No publishing unless I ask.
- **Git:**
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:**
  - Tablet, laptop and larger only; no mobile layouts.
  - Core or content changes need my decision first.
- **Hands off:**
  - the authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees;
  - the main checkout `...\tmp\github-export\Lab_Studio_v2`;
  - the microarray lab's folders;
  - `AP_CHEM_LABS`, which you may read;
  - `virtual_lab`, except through `PAGES_3D_PUBLISH.md` and only when I ask;
  - unselected projects (the Projects `AGENTS.md` sync boundary).
- **Line endings:** check every file before editing it. These are CRLF:
  - `BenchEngine.ts`, `Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts`, `Technique3DRoute.tsx`, `studio3d.css` and `DECISIONS.md`;
  - the rest listed under "Gotchas" in `SESSION_HANDOFF.md`.

**Open items outside this task.** Don't start any of them:
- the Pack 3 proposal, which comes next;
- G3;
- Dilute a Stock Solution and transmittance-dilution can't be finished in 2D, which is accepted.

Start by reading the files above and checking the facts, then write the brief and review it. Ask me the questions after the review.
