# Prompt for the next thread (2026-10-08: the Pack 3 proposal)

Paste everything below the line into a fresh Claude Code thread.

---

Continue Lab Studio 3D. The next step is **the Pack 3 proposal**. Propose it, but don't build anything yet; Pack 2 went through the same stages: proposal, my decisions, then a separate build thread.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** `origin/claude/lab-studio-3d` is still at `713c248`, and every later commit is local. Push only when I ask.
- **Live site:** Pack 1 and Pack 2 are published at https://virtuallab.az/experiments/lab-studio-3d/. That is virtual_lab commit `e2ab6c2`, built from `97e791d`.
  - Don't republish unless I ask.
  - When I do ask, follow `planning/2026-09-23_lab-studio-3d/PAGES_3D_PUBLISH.md`, section 9.

**Read first, in this order** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `SESSION_HANDOFF.md`, section "State on 2026-10-04". Its items 5 (Pack 2) and 6 (published) are the latest.
2. `DECISIONS.md`: every decision. D8 is still open.
3. `proposals/PACK2_ATOMIZATION.md`: the model for this proposal. Follow its structure:
   - the M/F/R/C basis labels;
   - "The first decision" about techniques that only run inside 2D labs;
   - the "(you)" decisions;
   - the fidelity-review log;
   - "For the build thread".
4. `evidence/PACK2_EVIDENCE.md`: what Pack 2 built and the interpretations I answered. It covers:
   - the bench operations;
   - the practice versions in `public/techniques-3d/index.json`, built by `scripts/practice3d/`;
   - the step clock, oven, tongs and flames;
   - the zero check.
5. `IMPLEMENTATION_PLAN.md` §9 (the technique-pack recipe) and `UI_UX_HANDOFF.md`. Never edit either of them.
6. `probes/README.md`.

**Pack 3** is the next five techniques in catalogue order (Q4), items 11–15 of `public/techniques/index.json`. My first look, on 2026-10-08, is below; verify every point before relying on it.

| # | Technique | First look | No 3D model yet (checked against `registry.json`) | 2D lab that composes it |
|---|---|---|---|---|
| 11 | `paper-chromatography`: Paper Chromatography | <ul><li>Chamber, paper, pencil origin, capillary spot, developing with the lid closed, the solvent front, ruler measurements, Rf.</li><li>The procedure repeats once per trial: about 25 steps each.</li><li>The configured variant sets the trials: water, 2-propanol, ethanol, acetone, the student's choices.</li></ul> | chromatography chamber, chromatography paper, distilled-water bottle, propanol bottle, capillary spotter, pencil, metric ruler, waste beaker | `paper-chromatography` |
| 12 | `hard-water-calculation`: Calculate Hardness | <ul><li>A calculation from the precipitate mass (`precipitateMassMeasurementId`).</li><li>Its only equipment is the balance.</li></ul> | none | `hard-water-demo` |
| 13 | `beers-law-calibration`: Beer's Law Calibration | Standards in test tubes, cuvettes, a spectrophotometer, a data-collection interface | data-collection interface | none found by id |
| 14 | `brass-spectrophotometry`: Brass Spectrophotometry | <ul><li>20 kinds of equipment, including fume-hood digestion, a volumetric flask, a graduated pipette with its pump, and pH paper.</li><li>14 of them already have 3D models.</li></ul> | data-collection interface, fume-hood digestion, colour-depth comparison, sample rack, pH paper, waste beaker | `brass-colorimetry` |
| 15 | `hard-water-gravimetry`: Hard Water Gravimetry | Vacuum filtration, a drying oven, tongs | Büchner funnel, side-arm filter flask, vacuum source, permanent marker | none found by id |

**The source plans** are in `C:\Users\EmilJivishov\Projects\AP_CHEM_LABS\atomic_steps`. Treat that folder as read-only.
- They are the basis for each step's ID and its basis label.
- The likely ones are:
  - `sticky-question-paper-chromatography_2026-07-27.md`;
  - `what-makes-hard-water-hard_2026-07-27.md`;
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md`;
  - `how-can-color-determine-copper-in-brass_2026-07-27.md`.
- Confirm each one against the technique's metadata and the lab that cites it.

**What the proposal must settle:**
1. **Where each technique can play.** Find whether it can play alone or only inside a 2D lab (the runtime's refusal, as Pack 2's proposal found it).
   - While D8 is open, the route for lab-bound techniques was decided for Pack 2: 3D practice versions, with the 2D labs untouched.
   - Recommend a route for each Pack 3 technique, and put the choice to me.
2. **Atomized steps.** Break each technique into the real physical actions, with source step IDs and basis labels.
   - Records and calculations may keep their legacy effects.
3. **Calculation-only work.** Calculate Hardness has no physical actions. Say whether it gets a 3D version at all, and if so, what the bench shows.
4. **Teacher-prepared values.** The teacher sets every reading before play: absorbances, Rf distances, masses. Instruments stay measurement-neutral (G-1).
5. **Models.**
   - List each new model, with its realism points, following the `AGENTS.md` asset rules for procedural Blender models.
   - List what Pack 1 and 2 models can be reused, and say which existing ones need changes. For example, the spectrophotometer was built for the transmittance technique.
6. **Core changes.** List:
   - new bench operations, atoms and roles;
   - new runtime or core changes;
   - every effect on 2D. Any effect on 2D needs my decision.
7. **Size and order.** Pack 3 is much bigger than Pack 2: paper chromatography alone runs to about 100 steps across its trials, and brass includes a digestion. Propose:
   - whether to split the pack;
   - whether the practice versions should repeat fewer trials;
   - the build order.
8. **Interpretations.** List the ones for me to confirm, ready to ask in line.

**How to work:**
- **Write the proposal only:** `proposals/PACK3_ATOMIZATION.md`, with LF line endings. No code, content or model changes.
- **Ask in line.** Once the draft is written, put the "(you)" decisions to me with AskUserQuestion, recommended option first.
  - Record my answers in the proposal's "Decisions" section and as a `DECISIONS.md` row.
  - `DECISIONS.md` is CRLF: edit it with a byte-aware script.
- **Review your own draft.** Critically review it for fidelity against the content JSON and the source plans, fix what you find, and log the changes, as Pack 2's revision log does.
- **End the proposal** with a "For the build thread" section.
- **Commit locally,** then report briefly.

**Standing constraints:**
- **Validation.** The test suite and `content:check` are authorised (2026-10-05). A proposal needs neither. For later builds:
  - `npx tsc -p tsconfig.app.json --noEmit`;
  - `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d` (the default worker count times out);
  - `npm run content:check`: its baseline is 22 findings, the same as GitHub main;
  - `python tools/blender/validate_equipment3d.py --pack 1|2`.
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
  - `AP_CHEM_LABS`, which is read-only;
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
- D8 (how experiments are assembled from the atomic steps): a separate discussion with me.
- G3.
- Measure Liquid Volume: it is host-bound, so 3D shows only its gate.
- `hard-water-demo`, dilution and transmittance-dilution can't be finished in 2D.

Start by reading the files above, then draft the proposal. Ask me the decisions once the draft is written.
