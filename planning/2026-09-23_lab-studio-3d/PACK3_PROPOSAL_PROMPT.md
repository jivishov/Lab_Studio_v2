# Prompt for the next thread (2026-10-08: the Pack 3 proposal)

Paste everything below the line into a fresh Claude Code thread. Every fact in it was checked against the repository on 2026-10-08, by running the code where possible; re-check before relying on any of it.

**Run this after the D8 discussion** (`NEXT_THREAD_PROMPT.md`; on 2026-10-08 the user chose to settle D8 first). It was written while D8 was open. Where it says D8 is open, read the D8 row in `DECISIONS.md` and the note the D8 session adds below this one. The D8 decision replaces the options in decision 1 here.

**D8 note (2026-10-10).** D8 is decided (`proposals/D8_EXPERIMENT_ASSEMBLY.md`, "Decisions"). Run this proposal after the build thread that fixes `filterInPortions` and builds E3 (`intro-filtration-demo` in 3D); the user put intro filtration first.
- **What replaces decision 1.** The user's words: "I need real atomized steps to use in 3D. Ignore the 2D version at all." So:
  - 3D uses only the real atomized steps.
  - 2D is neither read nor written, and it never constrains a 3D design.
  - Options that keep a 2D lab working are no longer a reason to choose them.
- **For the three lab-bound techniques** (Paper Chromatography, Calculate Hardness and Brass Spectrophotometry):
  - Follow Pack 2's route: one module per technique in `scripts/practice3d/` writes a 3D practice version and a `composable` twin.
  - Their 3D labs (`paper-chromatography`, `brass-colorimetry`, `hard-water-demo`) are generated in `public/labs-3d/`.
  - Propose the twins' stand-in steps and dropped slots too.
- **Beer's Law and Hard Water Gravimetry** are composed by no lab. Changing them in place (Pack 1's route) is still possible, but now offers nothing over the practice route except a single file. Recommend between the two.
- **Holding Pack 3 until D8** is no longer an option.
- **Calculate Hardness** (decision 3) is now needed: `hard-water-demo` in 3D composes its twin.
- **Lab setup and models.** Paper chromatography's lab needs a 3D setup page. 14 of those two labs' equipment definitions have no 3D model yet: 8 for chromatography and 6 for brass (`equipment3d/registry.json`, checked 2026-10-10). Count them in the size and order (decision 5).

---

Continue Lab Studio 3D. The next step is **the Pack 3 proposal**. Propose it, but don't build anything yet. Pack 2 went through the same stages: proposal, a fidelity review, my decisions, then a separate build thread.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** `origin/claude/lab-studio-3d` is still at `713c248`, and every later commit is local. Push only when I ask.
- **Live site:** Pack 1 and Pack 2 are published at https://virtuallab.az/experiments/lab-studio-3d/. That is virtual_lab commit `e2ab6c2`, built from `97e791d`.
  - Don't republish unless I ask.
  - When I do ask, follow `planning/2026-09-23_lab-studio-3d/PAGES_3D_PUBLISH.md`, section 9.

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `SESSION_HANDOFF.md`, section "State on 2026-10-04". Its items 5 to 8 are the latest: Pack 2, the publication, D8 and this task.
2. `DECISIONS.md`: every decision. D8 is still open.
3. `proposals/PACK2_ATOMIZATION.md`: the model for this proposal. Follow its sections:
   - "The first decision";
   - "What the five do today";
   - "Proposed sequences", with the M/F/R/C basis labels;
   - "Shared new capabilities";
   - "New models";
   - "Not proposed";
   - "Order of work";
   - "Decisions";
   - "For the build thread";
   - "Fidelity review (revision 2)".
4. `evidence/PACK2_EVIDENCE.md`: what Pack 2 built and the interpretations I answered. It covers:
   - the bench operations;
   - the practice versions in `public/techniques-3d/index.json`, built by `scripts/practice3d/`;
   - the step clock, oven, tongs and flames;
   - the zero check.
5. `IMPLEMENTATION_PLAN.md`:
   - §2.7 (which experiments each pack unlocks) and §9 (the technique-pack recipe);
   - with `UI_UX_HANDOFF.md`, never edit either document.
6. `probes/README.md`.

**First, inventory by evaluation** (plan §9, step 1). Run this from the worktree root:
`node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs tools/blender/inventory_pack.ts --pack 3 --markdown <file in your scratchpad>`.
It reports, for each technique:
- steps and interactions;
- both configuration blockers;
- configuration slots and host labs;
- value sources, equipment and zones.

It writes only the file you name. The source of each technique is in `docs/architecture/source-trace-registry.json`: `sourceDerivedOwners` and `nonSourceDerivedOwners`, with each step's trace under `traces`.

**Pack 3** is the next five techniques in catalogue order (Q4), items 11–15 of `public/techniques/index.json`. Below is what that inventory and the registry gave on 2026-10-08:

| # | Technique | Steps | Plays alone? | 2D lab that composes it | Source | Equipment with no registry model yet |
|---|---|---|---|---|---|---|
| 11 | `paper-chromatography` | 428 | No | `paper-chromatography` | `sticky-question-paper-chromatography_2026-07-27.md` (Investigation 5) | chromatography chamber, chromatography paper, distilled-water bottle, propanol bottle, capillary spotter, pencil, metric ruler, waste beaker |
| 12 | `hard-water-calculation` | 1 (a calculation) | No | `hard-water-demo` | none: an original demo technique | none (the balance only) |
| 13 | `beers-law-calibration` | 18 | Yes | none | none: a generator stub, not from a dated plan | data-collection interface |
| 14 | `brass-spectrophotometry` | 314 | No | `brass-colorimetry` | `how-can-color-determine-copper-in-brass_2026-07-27.md` (Investigation 2) | data-collection interface, fume-hood digestion, colour-depth comparison, sample rack (a test-tube rack exists only as scenery, D9), pH paper, waste beaker (14 of its 20 already have models) |
| 15 | `hard-water-gravimetry` | 25 | Yes | none | none: a generator stub | Büchner funnel, side-arm filter flask, vacuum source, permanent marker |

What the table doesn't show:
- **Paper chromatography's 428 steps are 17 trial groups** of 23 to 27 actions each, across five solvent families: water, 2-propanol, ethanol, acetone and a chromatography solvent.
  - The lab chooses which trials run: `selectedProcedure` is a host-only slot, and at least 2 trials are required.
  - Its composition blocker is the ordered-procedure contract.
  - It needs the `spotOnto` interaction, which the plan's §9 names as a later-pack handler.
- **Brass's 314 steps** are parts with 24 entry and exit ports, which the lab puts in order. They are not one sequence. The parts:
  - weighing the brass;
  - transferring the completed digest. The source has the teacher do the nitric-acid digestion in the fume hood and add the 50 mL of water (DIGEST-01/02, B-07).
  - four rinses of the digest beaker, then diluting the unknown to 100.0 mL;
  - five standards from 0.400 to 0.0250 M;
  - blanking;
  - a scan of salts A and B at 16 wavelengths, 400 to 700 nm. This is 138 of the 314 steps.
  - waste treatment.
- **The two stubs have dated, source-traced counterparts later in the catalogue:**
  - for Beer's Law, `blue1-standard-dilutions`, `blue1-percent-transmittance` and `blue1-class-calibration` (items 23–25; Investigation 1, `sports-drink-blue-dye-spectroscopy_2026-07-27.md`);
  - for Hard Water Gravimetry, `gravimetric-vacuum-filtration` and `two-stage-precipitate-drying` (items 27–28; Investigation 3, `what-makes-hard-water-hard_2026-07-27.md`, composed by `hard-water-analysis`).
- **Generated content.** Content changes go through the generators, never by hand-editing the JSON:
  - `paper-chromatography`: `scripts/generatorInputs/simulator/paperChromatography.mjs`, with `generateSimulatorTechniqueDefinitions.mjs`;
  - Beer's Law and Brass: `scripts/generatorInputs/apChem/spectroscopy.mjs`, with `generateApChemTechniqueFragments.mjs`;
  - Hard Water Gravimetry: `scripts/generatorInputs/apChem/gravimetrySeparation.mjs`, with the same script.
  
  I found no generator for `hard-water-calculation`; confirm.
- **The plan's purpose for Pack 3** (§2.7): it delivers the last techniques of `hard-water-demo`, `paper-chromatography` and `brass-colorimetry`. Playing those labs in 3D is Phase B, which waits for D8.

The source plans are in `C:\Users\EmilJivishov\Projects\AP_CHEM_LABS\atomic_steps`. Read them, but never edit anything there.

**What the proposal must settle:**
1. **The first decision: what Pack 3 is while D8 is open.** Three of the five run only inside a 2D lab, and the plan's payoff from Pack 3 is those three labs.
   - Lay out the options as Pack 2's proposal did, and recommend one:
     - 3D practice versions, with the 2D labs untouched (Pack 2's route);
     - changing the two standalone techniques in place, Pack 1's route through D4-style exceptions. No lab composes them, so only their own 2D play is affected.
     - holding Pack 3, or part of it, until D8 is decided.
   - Say plainly what each option delivers.
2. **The stubs.** Say whether Beer's Law and Hard Water Gravimetry get atomized as they are, rebased on the nearest dated plan (marking what that plan does not state as R or as the teacher's decision), or deferred in favour of their source-traced counterparts. I decide.
3. **Calculate Hardness.** It is a single calculation, bound to its lab. Say whether it gets a 3D version at all, and if so, what the bench shows.
4. **Atomized steps.** Break each technique you propose to build into the real physical actions, with source step IDs and basis labels.
   - Records and calculations may keep their legacy effects.
5. **Size and order.** The five total 786 steps today, against Pack 2's 90 after atomization. Propose:
   - whether to split the pack;
   - which trials a paper-chromatography practice version would fix;
   - whether brass's repeated standards and its 16-wavelength scan can be reduced in 3D;
   - the build order.
6. **Teacher-prepared values.** The teacher sets every reading before play: %T and absorbance, Rf distances, masses. Instruments stay measurement-neutral (G-1).
7. **Models.**
   - List each new model, with its realism points, following the `AGENTS.md` asset rules for procedural Blender models.
   - List which existing models are reused, and which of them need changes. For example, the spectrophotometer was built for transmittance-dilution, and Beer's Law calls it the photometer.
8. **Core changes.** List:
   - new bench operations, atoms, roles and interaction handlers;
   - new runtime or core changes;
   - every effect on 2D. Any effect on 2D needs my decision.
9. **Interpretations.** List the ones for me to confirm, ready to ask in line.

**How to work:**
- **Write the proposal only:** `proposals/PACK3_ATOMIZATION.md`, with LF line endings. No code, content or model changes.
- **Review before asking.** Critically review the draft for fidelity against:
  - the content JSON;
  - the inventory;
  - the source-trace registry;
  - the source plans.

  Fix what you find, and log the changes as Pack 2's "Fidelity review (revision 2)" does. Do this before I decide, so I decide on corrected recommendations.
- **Ask in line.** Put the "(you)" decisions to me with AskUserQuestion, recommended option first.
  - Record my answers in the proposal's "Decisions" section and as a `DECISIONS.md` row.
  - `DECISIONS.md` is CRLF: edit it with a byte-aware script.
- **End the proposal** with "For the build thread". It must include two things the build will meet:
  - The 3D switcher lists only Pack 1's catalogue techniques and the practice versions (`loadSimulations3D` in `src/studio3d/practice.ts`), so a Pack 3 technique changed in place would not appear there without a change.
  - Run `validate_equipment3d.py --pack 3`.
- **Commit locally,** then report briefly.

**Standing constraints:**
- **Validation.** The test suite and `content:check` are authorised (2026-10-05). A proposal needs only the inventory. For later builds:
  - `npx tsc -p tsconfig.app.json --noEmit`;
  - `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` (the default worker count times out);
  - `npm run content:check`: its baseline is 22 findings, the same as GitHub main;
  - `python tools/blender/validate_equipment3d.py --pack <n>`.
- **Gates:**
  - G1: one browser look per change is fine.
  - G3 (webcam hand control) is set aside.
  - No G2. No publishing unless I ask.
- **Git:**
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:**
  - 3D is independent of 2D, and the 2D player must not change: nothing under `src/player/**` or `src/styles/app.css`.
  - Tablet, laptop and larger only; no mobile layouts.
  - Core or content changes need my decision first.
- **Hands off:**
  - the authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees;
  - the main checkout `...\tmp\github-export\Lab_Studio_v2`;
  - the microarray lab's folders;
  - `AP_CHEM_LABS`;
  - `virtual_lab`, except through the publishing instructions and only when I ask;
  - unselected projects (the Projects `AGENTS.md` sync boundary).
- **Policies:**
  - Atomize to real physical actions within reason, to build "muscle memory".
  - New atoms not cited in the AP lab documents are fine; record the teacher's decision as their basis.
  - Prefer gestures that reproduce the real action, and modestly boost faint visuals.
  - Keep the science guardrails G-1, G-3, G-8, G-9 and G-11.
- **Line endings:** check every file before editing it. These are CRLF:
  - `BenchEngine.ts`, `Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts`, `Technique3DRoute.tsx`, `studio3d.css` and `DECISIONS.md`;
  - the rest listed under "Gotchas" in `SESSION_HANDOFF.md`.

**Open items outside this task.** Don't start any of them; mention one only where it bears on Pack 3:
- D8 (how experiments are assembled from the atomic steps): a separate discussion with me. It bears on Pack 3 directly, through decision 1.
- G3.
- Measure Liquid Volume: it is host-bound, so 3D shows only its gate.
- `hard-water-demo`, dilution and transmittance-dilution can't be finished in 2D.

Start by reading the files above and running the inventory, then draft the proposal and review it. Ask me the decisions after the review.
