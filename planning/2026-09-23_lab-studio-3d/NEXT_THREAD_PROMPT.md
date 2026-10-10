# Prompt for the next thread (2026-10-10: the D8 build, first experiment)

Paste everything below the line into a fresh Claude Code thread. Every fact in it was checked against the repository on 2026-10-10, by reading the code and running probes. Re-check before relying on any of it. The Pack 3 proposal comes after this, from `PACK3_PROPOSAL_PROMPT.md`.

---

Continue Lab Studio 3D. D8 is decided (2026-10-10). The next step is **the D8 build**, in three stages:
1. the `filterInPortions` fix;
2. E0, a short design that you put to me before building;
3. E3, `intro-filtration-demo` playing in 3D.

**Where.** Work only in the worktree `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
- **Branch:** `claude/lab-studio-3d`; the remote is https://github.com/jivishov/Lab_Studio_v2.git.
- **Unpushed commits:** `origin/claude/lab-studio-3d` is still at `713c248`, and every later commit is local. Push only when I ask.
- **Live site:** Pack 1 and Pack 2 are published at https://virtuallab.az/experiments/lab-studio-3d/ (virtual_lab `e2ab6c2`, built from `97e791d`). Don't republish unless I ask.

**Read first** (all under `planning/2026-09-23_lab-studio-3d/`):
1. `proposals/D8_EXPERIMENT_ASSEMBLY.md`, the whole file. Its "Decisions" and "For the build thread" sections govern this work.
2. `DECISIONS.md`: the D8 row.
3. `SESSION_HANDOFF.md`, section "State on 2026-10-04", items 5 to 9.
4. `evidence/PACK2_EVIDENCE.md`: how the practice versions are built, and the probes.
5. `probes/README.md`, and the two D8 probes:
   - `probes/probe-d8-compile.mts` compiles a bundled lab through the loader's seam;
   - `probes/probe-d8-twins.mts` composes the 3D `intro-filtration-demo` from twins, compiles it with the policy and plays it.

**What D8 decided** (you, 2026-10-10):
- **The steps.** 3D experiments use the real atomized steps, beside 2D. In your words: "I need real atomized steps to use in 3D. Ignore the 2D version at all."
  - Each `scripts/practice3d/*` module also writes a `composable` twin into `public/techniques-3d/`, without stand-in steps and without the slots that only fill the practice bench.
  - The 3D labs are generated into `public/labs-3d/` by the same build, with `--check`.
  - 2D is neither read nor written: `public/labs/`, `public/techniques/`, `src/player/**` and `src/styles/app.css` stay as they are.
- **Playing.** `#/3d/play/<labId>` compiles through `compileBundledLabCompositionWithPolicy` (`src/data/bundledCatalogPolicyBoundary.ts`), with a resolver that reads `techniques-3d/` first, then `techniques/`. Player3D plays the compiled lab, with:
  - part labels from `compositionManifest.origins`;
  - a 3D lab setup page for the teacher's values;
  - provenance from the source's bindings;
  - an "Experiments" group in the switcher.
- **Studio:** (a) only; Studio 3D still doesn't list the practice versions.
- **Order:** E0, then E3 `intro-filtration-demo`. Later: `hard-water-demo` after Pack 3, then green chemistry (E4).
- `hard-water-demo`'s 2D faults are left as they are.

**Stage 1: the `filterInPortions` fix** (a core change, decided).
- **The defect.** In `src/runtime/reducer.ts` (LF), `filterInPortions` computes `const moved = roundToRuntimeMl(last ? liquidMl : pourPortionMl);`. When `liquidMl` is `6.049999999999997`, `moved` becomes 6.05, and `splitContentForVolume` (`src/runtime/contentTransfer.ts`) throws "Transferred volume must be between zero and the source volume."
- **Where it shows:**
  - The published standalone `filtration-practice` throws at a teacher mixture volume of 54.05 mL.
  - The twin lab throws at its pour too, because the beaker carries 54.05 mL.
- **The fix.** The last portion pours exactly what is left. Look for the same rounding pattern in the other portioned operations (reagent portions, rinses, pours in portions), and fix only what can throw.
- **Tests and check:**
  - Add a test at 54.05 mL to `src/studio3d/__tests__/pack2Practice.test.ts`.
  - Rerun `probe-practice.mts filtration-practice` with `'{"mixtureVolumeMl":"54.05","precipitateMassG":"0.0075","paperMassG":"0.912"}'` (string values; the inputs and moves are in `probes/README.md`).

**Stage 2: E0.** Write it as a section "E0 design" in `proposals/D8_EXPERIMENT_ASSEMBLY.md`, review it for fidelity, then put its choices to me in line with AskUserQuestion, recommended option first. Don't build E3 before I answer. It covers:
- **The twins:**
  - how a module writes its twin;
  - the naming (for example `filtration-3d`);
  - for each of the five Pack 2 techniques, the stand-in steps and practice-only slots the twin drops. The probe found none in Transfer, Precipitation or Filtration besides Filtration's `precipitateMassG` and `paperMassG`; Drying's "Note the paper's mass" is a stand-in.
- **The 3D lab modules:**
  - the format, built from real bindings rather than the probe's mechanical mapping;
  - the lab's bench and its starting contents. The probe took them from the 2D lab where it had them, and its 150 mL reagent beaker needs checking;
  - the index, and `--check`.
- **The resolver** and the loader, `src/studio3d/labs3d.ts`, modelled on `practice.ts`.
- **The setup page:**
  - the five values the 2D lab doesn't bind: Precipitation's `reagentVolumeMl`, `precipitateObservation` and `completenessObservation`, and Filtration's two slots unless the twin drops them;
  - which of the lab's other values a teacher may change.
- **The provenance rule.** A compiled lab keeps no `{{config.*}}`, so `player/provenance.ts` can't tell teacher values apart.
- **The part labels** and the switcher group.

**Stage 3: E3.** Build what E0 decides.
- **Exit:**
  - `probe-d8-twins.mts`, or its successor reading the generated files, runs all 31 steps without `PROBE_ROUND`;
  - new tests;
  - one G1 look of the whole run;
  - an evidence note, `evidence/D8_E3_EVIDENCE.md`.
- **Then:** review the build critically for fidelity, fix what you find, and log it in the evidence note.
- **Record:** `DECISIONS.md` (CRLF, so use a byte-aware script), `SESSION_HANDOFF.md`, and the brief.
- **Commit locally,** then report briefly.

**Decisions any work must respect:**
- 3D is independent of 2D.
- The atomization policy: break each step into its real physical actions; new atoms are fine, with the teacher's decision recorded as their basis.
- Teacher-prepared values.
- **Core changes beyond the `filterInPortions` fix need my decision.** The twin approach needs none; the probe proved it.

**Standing constraints:**
- **Validation:**
  - `npx tsc -p tsconfig.app.json --noEmit`;
  - `npx vitest run --config vite.config.ts --maxWorkers=3 src/studio3d`. The default worker count times out.
  - `npm run content:check`: its baseline is 22 findings, the same as GitHub main.
  - `node scripts/practice3d/build.mjs --check`.
- **Gates:**
  - G1: one browser look per change is fine. Use the dev server `preview_start` "lab-studio-3d-dev" (port 5182; see `SESSION_HANDOFF.md`), or a headless look with Playwright (`probes/look-*.cjs`).
  - G3 (webcam hand control) is set aside.
  - No G2. No publishing unless I ask.
- **Git:**
  - Never use a bare `git stash`; the stash is shared with the main checkout.
  - Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree checkout from the Projects root.
  - Commit locally. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Scope:** tablet, laptop and larger only; no mobile layouts.
- **Hands off:**
  - the authoritative `C:\Users\EmilJivishov\Projects\Lab_studio`, apart from its git-ignored `tmp\` worktrees;
  - the main checkout `...\tmp\github-export\Lab_Studio_v2`;
  - the microarray lab's folders;
  - `AP_CHEM_LABS`, which you may read;
  - `virtual_lab`, except through `PAGES_3D_PUBLISH.md` and only when I ask;
  - unselected projects (the Projects `AGENTS.md` sync boundary).
- **Line endings:** check every file before editing it.
  - CRLF: `BenchEngine.ts`, `Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts`, `Technique3DRoute.tsx`, `Studio3DApp.tsx`, `studio3d.css` and `DECISIONS.md`, plus the rest listed under "Gotchas" in `SESSION_HANDOFF.md`.
  - LF: `reducer.ts`, `contentTransfer.ts`, `scripts/practice3d/*`, `practice.ts`, `SimulationSwitcher.tsx` and `provenance.ts`.

**Open items outside this task.** Don't start any of them:
- the Pack 3 proposal, which comes next;
- G3;
- `hard-water-demo`'s 2D faults;
- Dilute a Stock Solution and transmittance-dilution can't be finished in 2D, which is accepted;
- Studio (b).

Start by reading the files above and checking the facts. Then do Stage 1.
