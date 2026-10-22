# Lab Studio 3D: session handoff

Written 2026-09-24 and updated through 2026-10-16, so a fresh session can continue the Pack 1 build without
the previous conversation; checked claim by claim against the repository. Read this first, then the
governing documents it names.

## State on 2026-10-04 (read this first)

This section supersedes anything older below where they differ. `DECISIONS.md` has every decision;
the evidence notes have what was built and checked.

**Branch.** `origin/claude/lab-studio-3d` is at `713c248`. Every commit after it is local
(`git log --oneline 713c248..HEAD`): the build from `39fdab8` (M7 hand-panel decisions) to `7a63d86`
(the pump stays on the pipette), the handoff commits of 2026-10-03, then the microarray adoption of
2026-10-04 (`9798de1` P0 to the P5 records commit, and the fidelity review `b886175`), then Make a Solution
atomized (D4 exception 9, `63096ed`) and its fidelity review, and everything since: the D8 draw-back
(`690a063`), then the model refinement (2026-10-10), the Pack 3 proposal (`9923202`, revision 3 `af50318`) and
the Submit fix (`0fa32ee`), then the Pack 3a build (`5123159` to `fe817ec`, 2026-10-11, its records commit
`9b45727`, and the second fidelity review's commit), then the Pack 3a follow-ups (2026-10-11: the dye `d240373`,
the slide `fb11986`, the stable layout `da07078`, then the tile with two fixes found at its look, and their records),
then the shelf in place of the tray (phases 1 and 2 and their review, 2026-10-11, `82be9f1` to `b857de6`), the HUD,
the natural room, the two themes and Home fitted to the screen (2026-10-12), Auto view's steady fit and right-drag
(2026-10-13), the shelf's phases 3 and 4 with their records (2026-10-16), the lab room's phase 1 (`aa21b14` to
`8c9cc20`, then its records commit, 2026-10-16), the level view adjusted by hand (`67e94a9`), glassware's own
look (`e59e848`) and At the bench (`6d186a5`, then the records commits, 2026-10-16); `git log -1` names the latest. Push only when the user asks.

**Pack 1, technique by technique:**

| Technique | State | Evidence |
|---|---|---|
| Weigh a Solid | 5 steps; teacher-prepared readings; the glass seats on the pan; TARE pressed on the balance; solid added with the spatula | `READINGS_EVIDENCE.md`, `TARE_SPATULA_EVIDENCE.md` |
| Analyze Transmittance of a Dilution | 28 steps; 25 mL cylinder with a filling funnel; working beaker and Beral pipettes for the cuvettes; cuvettes seat in the photometer | `READINGS_EVIDENCE.md`, `PIPETTE_FUNNEL_EVIDENCE.md` |
| Dilute a Stock Solution | 12 atomized steps: pipette pump, delivery to the line drop by drop, flask to the mark drop by drop, stopper, invert ×10, two calculations | `DILUTION_ATOMIZATION_EVIDENCE.md` |
| Make a Solution | 14 atomized steps: a pre-weighed weighing boat, a funnel in the flask's neck, the solid tipped in, the boat and funnel rinsed into the flask, half full, swirled to dissolve the solid in the flask, to the mark drop by drop, stopper, invert ×10, appearance recorded | `MAKE_SOLUTION_ATOMIZATION_EVIDENCE.md` |
| Measure Liquid Volume | Unchanged in Pack 1. Host-bound: it can't play on its own (its 3D route shows only the gate). Its 3D twin `measuring-volume-3d` (2026-10-10; five atomized steps in the 25 mL cylinder: stand the cylinder, pour to just below the line, fill a dropping pipette, drops to the line with any overshoot drawn back, a typed reading) is part 1 of the 3D Precipitate and Filter Calcium Carbonate | `proposals/PACK1_ATOMIZATION.md`, `evidence/D8_E3_EVIDENCE.md` |

Also built: the top bar's title is a switcher listing the five Pack 1 techniques (a slim bar does the
same on the intro and setup pages), and hover labels hang below items.

**The microarray adoption is built (2026-10-04;** `evidence/MICROARRAY_ADOPTION_EVIDENCE.md`). It covers:
- the room and look: `bench/look/room.ts`, `microarrayGeometry.ts`, `environment.ts` and `composer.ts`;
- the camera and mouse camera: `bench/camera/benchCamera.ts` and `BenchEngine.ts`;
- the left button on the microarray controller: `useBenchCarry.ts`, `PressAction` and `STROKE`;
- hand control: `src/studio3d/hand/` and `player/HandControlPanel.tsx`.

The 2D player is unchanged. A fidelity review the same day fixed twelve findings (the evidence note's
first section): the source's lighting model is now reproduced, mouse strokes act on release (G-5), camera
clamps are per input, and the hand controller keeps the source's remaining rules. Thirteen interpretations
wait for confirmation (`DECISIONS.md`, the "built" row). G3 has still not run.

**Standing policies (user decisions):**
- **Atomization:** break each step down to the real physical actions, within reason, to build
  "muscle memory". New atoms and roles not cited in the AP lab documents are expected; record the basis
  as the teacher's decision. Content changes still go to the user first and become D4 exceptions (nine
  so far).
- **Teacher-prepared values:** the teacher sets quantities and readings before play; the student
  follows the procedure and enters what they observe.
- **3D is independent of 2D:** the 2D player is out of scope; some atomized steps (drop to the line,
  invert) cannot be played in 2D, and that is accepted.
- **The microarray lab's environment, bench view, mouse and hand control are adopted for 3D**
  (decided 2026-10-03; choices confirmed 2026-10-04; built 2026-10-04). The plan and the rules it
  replaces are in `proposals/MICROARRAY_ADOPTION.md`; `AGENTS.md` has "Player3D Hand Control Rules".
- **Realistic gestures:** prefer gestures that reproduce the real action. In the microarray lab
  (2026-09-28) the user found pinching "very tricky" and preferred a calibrated thumb press on the
  plunger.

**Next, in order (recommended):**
1. **Done 2026-10-04: the microarray adoption** (P0–P5, then a fidelity review). It is open only for the
   thirteen interpretations to confirm and for G3.
2. **Done 2026-10-04: Make a Solution** (D4 exception 9; `evidence/MAKE_SOLUTION_ATOMIZATION_EVIDENCE.md`),
   on the new controller, with a weighing-boat model, a funnel seat in the flask, generic funnel atoms, rinses
   into a receiver and a dissolve of the solid in the flask. Reviewed for fidelity the same day: eleven findings
   fixed (evidence note, "Fidelity review"). It is open only for its nine interpretations to confirm, and for G3.
3. **Done 2026-10-05: Pack 1 finished** (`evidence/PACK1_FINISH_EVIDENCE.md`; D4 exceptions 10–12):
   Make a Solution's rinses in three squirts; transmittance-dilution's test tube stoppered, inverted ten
   times and opened (31 steps); weighing's zero atom; one tray tile per item; the top bar's long titles.
   The tests and `content:check` were run for the first time: the branch's own failures are fixed, and
   what remains fails the same way on GitHub main (the evidence note lists it).
   Reviewed for fidelity the same day (evidence note, "Fidelity review"): held squirts, the rack left
   standing, per-item tray drops, seated parts kept seated while a step needs them, and more.
4. **M8 acceptance.** On 2026-10-05 the provisional decisions and every interpretation were confirmed at
   their defaults (`DECISIONS.md`, "Open decisions"), and `content:check`'s baseline is left as it is.
   D8 (how experiments are assembled from the atomic steps) was left for a separate discussion with the
   user; it was decided on 2026-10-10 (item 7). Pre-existing failures that do not affect the 3D
   work are ignored. What remains is G3 (webcam), which needs the user or Claude in Chrome.
5. **Done 2026-10-06: Pack 2 built and reviewed for fidelity** (`evidence/PACK2_EVIDENCE.md`, with its "Fidelity
   review" section; `proposals/PACK2_ATOMIZATION.md`, revision 2): Transfer Liquid (4 steps), Precipitation (11),
   Filter a Precipitate (13), Dry and Weigh (26) and Heat and Reweigh (36), as 3D practice versions listed in
   `public/techniques-3d/index.json` (written by `scripts/practice3d/build.mjs`), never in the 2D catalogue; the
   lab-bound originals and their 2D labs are untouched until D8. Core: bench operations
   (`src/domain/benchOperations.ts`) and apparatus states; 3D: fourteen models, the step clock, the oven, tongs,
   flames. The review restored Heat and Reweigh's balance choice and Unused Sample return, added the rod rinse,
   fixed the flames, paper, triangle, lid and scoopula models, and made every path wait for the clock and the
   drain. The interpretations were all answered on 2026-10-06 (a zero check per technique, the oven door closed,
   the reduced-motion drain wait, printed scales, wider tong jaws; the rest confirmed). `hard-water-demo` cannot be
   finished in the 2D runtime (found in the review; before Pack 2 too). Hand control (G3) is set aside for now
   (user, 2026-10-05).
6. **Done 2026-10-08: Pack 1 and Pack 2 published** at https://virtuallab.az/experiments/lab-studio-3d/
   (virtual_lab `e2ab6c2`, built from `97e791d` by `PAGES_3D_PUBLISH.md`; republish with its section 9, only
   when the user asks). This branch is still unpushed past `713c248`.
7. **Done 2026-10-10: D8 decided** (`proposals/D8_EXPERIMENT_ASSEMBLY.md`, "Decisions"; `DECISIONS.md`, the D8
   row). 3D experiments compose the real atomized steps, beside 2D:
   - Each practice module also writes a `composable` twin in `public/techniques-3d/`.
   - The 3D labs are generated in `public/labs-3d/`, and 2D is neither read nor written.
   - `#/3d/play/<labId>` compiles through the loader's seam with a 3D resolver and plays in Player3D.
   - Studio stays (a) for now.
   - The order: E0, E3 `intro-filtration-demo`, `hard-water-demo` after Pack 3, then green chemistry.
   - `hard-water-demo`'s 2D faults are left as they are.
   - Probes: `probes/probe-d8-compile.mts` and `probes/probe-d8-twins.mts`. The second compiles and plays the 3D
     `intro-filtration-demo` from twins with no core change.
   - **Found:** `filterInPortions` (`src/runtime/reducer.ts`) can round the last filter portion above what is
     left and throw. The probe hit it in the lab at 54.05 mL, and it is live in the published standalone Filter a
     Precipitate for some teacher volumes. It is fixed first in the build thread.
8. **Done 2026-10-10: the D8 build** (`NEXT_THREAD_PROMPT.md`; `evidence/D8_E3_EVIDENCE.md`):
   - `filterInPortions` fixed (`353f159`): the last portion pours exactly what is left; test at 54.05 mL.
   - E0 answered in line (`proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 decisions"): three twins, every setup
     field filled in with an approved default, the part on the step card and the intro.
   - E3 built (`1a955d5`, then the review commit): `scripts/practice3d/build.mjs` writes the twins
     (`public/techniques-3d/*-3d.json`, `twins.json`) and the lab (`public/labs-3d/`), from
     `labs/introFiltrationDemo.mjs` through `composeLab.mjs`; `src/studio3d/labs3d.ts` and `labs3dSetup.ts`
     load it; `player/Lab3DRoute.tsx` is `#/3d/play/<labId>` (intro by part, setup, Player3D with the part
     eyebrow); the switcher has an "Experiments" group. 31 steps play in the app (G1, `probes/look-lab3d.cjs`)
     and in `probes/probe-lab3d.mts`; tests in `__tests__/lab3d.test.ts`.
   - The review fixed one chip (a record-only step copies its measurement's provenance) and left for the
     user: a 3D twin of Measure Liquid Volume, and short part titles.
   - **Both decided and built the same day** (the user: "Build 3D twin of measure liquid volume, ensure to have
     atomized steps." and "Use short part title, as you suggest."; `DECISIONS.md`, D8 (8); the evidence note's
     last section). Part 1 is the twin `measuring-volume-3d` (`scripts/practice3d/measuringVolumeTwin.mjs`,
     listed in `twins.json` with no `practiceId`), on two new atoms (`atom.transfer.fill-below-graduation`,
     `atom.transfer.dropwise-to-graduation`; a core registry change by that decision). A setup field can fill a
     slot with an offset (`setup("sampleVolumeMl", -1)` pours 1 mL under the line). Transfer pours all the
     cylinder holds. The parts read "Measure the sample", "Transfer the sample", "Precipitate the calcium",
     "Filter the precipitate". The lab plays 33 steps on 15 items.
   - That review fixed in 3D: `{{config.*}}` left in compiled step text (`labs3d.ts` `fillStepText`; E3's step 11
     had it too), a pour callout that named the amount, the reading step's view (eye level with the cylinder,
     `stepRules.readingVesselId`), the level's interim value chipped "Your entry", and notebook rows reading
     "20 mL" beside "20.0 mL". It left for the user (core) the overshoot message, which said the solution "would
     be remade. Restart the technique", wrong for a cylinder and, in a lab, a restart of the whole run.
   - **Decided and built the same day** (the user: "Go with (c), the pipette draw-back." and "25 mL cylinder
     (Recommended)"; `DECISIONS.md`, D8 (9); the evidence note's "Draw-back and the 25 mL cylinder"). Core, by
     that decision: a drop-to-the-line step marked `markDrawBack` keeps no overshoot; `dispenseDrawBackIntent`
     (refused on any other step) moves a drop's worth or a run from the vessel back into the pipette, as far as
     it has room, and a draw-back is progress within the step, as a drop is. A flask's mark and a graduated
     pipette's line are unchanged. `rinsed-vessel` allows `graduated-cylinder-25ml`. The draw-back is folded
     into `atom.transfer.dropwise-to-graduation` (no new atom). The sample is measured in the 25 mL cylinder
     (the 155 mm pipette cannot reach a 20 mL level in the 100 mL one, 166 mm below its rim); Transfer's twin
     pours from it (`twinOf`'s `swapEquipment`); the sample volume is set from 5 to 25 mL. In 3D the drop
     panel has Draw back at every such step, which lowers the tip just under the surface
     (`BenchEngine.dipHeld`) before drawing; a held run ends once the pipette is full. The G1 look found the
     held pipette's beacon ring lying at eye level once the tip dipped; a pipette held over a vessel now has
     no ring (`BenchEngine.ringAt`).
   - For Drying's twin later: compiled measurement ids are scoped by instance, so its calculation needs
     `preserveIds.references` or a binding to reach Filtration's paper mass.
   - Committed locally as `690a063` (the draw-back and the 25 mL cylinder), after `6463800` (the twin and
     short part titles). **Held by the user (2026-10-10):** publishing the D8 experiment to virtuallab.az, and
     G3 (the real-webcam test), both until the user asks.
9. **Done 2026-10-10: the 3D model review and refinement** (`proposals/MODEL_REFINEMENT.md`, with the
   decisions and a fidelity review of the build; `evidence/MODEL_REFINEMENT_EVIDENCE.md`; `DECISIONS.md`, the
   "Model refinement" row). All 36 models were rebuilt.
   - **Library** (`tools/blender/labeq/`): lathes and fillets by tolerance; a grey thumbnail cove; real holes;
     helical threads; composite states.
   - **Models:** a spectrophotometer with a hinged lid and a real well; a rack with real holes; tongs as
     riveted strips; GL and vial threads; details on the cuvette, balance, pump and burner.
   - **Viewer:** prints no longer show twice through glass.
   - **What it measured:** no registry value moved. Packed models are 40% smaller (3,279,008 → 1,964,188 bytes),
     so Pack 3 has about 163 KB for each new model.
   - **For the polish pass:** which glass surface shows depends on triangle order (glass writes no depth), so
     the GL bottles' shoulders now show the ceiling lights. Recorded in the proposal's UI issues.
   - V2 (edge legibility) was not built. Committed locally, not pushed.
10. **Done 2026-10-10: the Pack 3 proposal** (catalogue items 11–15; `proposals/PACK3_ATOMIZATION.md`, revision 3;
   `DECISIONS.md`, the two Pack 3 rows). Proposed, decided (decisions 1–8), then reviewed again for fidelity
   and corrected (revision 3, decisions 9–12), every decision as recommended. In short:
   - Beer's Law and Hard Water Gravimetry are deferred to Packs 5 and 6.
   - Paper Chromatography, Calculate Hardness and brass take Pack 2's route (practice versions and twins)
     into the 3D labs `paper-chromatography`, `hard-water-demo` and `brass-colorimetry`.
   - No new equipment definitions, bench operations or runtime changes; at most two atoms, by addition.
   - Pack 2's 3D weighings move to 0.0001 g (decision 9), so `hard-water-demo` reaches 375 mg/L.
   - Pack 3a first (hardness, `hard-water-demo`, chromatography), then 3b (brass, in six techniques).
   - Also fixed: the 3D step card offers Submit again after a wrong calculation (`0fa32ee`).
11. **Done 2026-10-11: the Pack 3a build** (`PACK3A_BUILD_PROMPT.md`; `evidence/PACK3A_EVIDENCE.md`, with its
   fidelity review; `DECISIONS.md`, the "Pack 3a build interpretations", "Pack 3a step 4", "Pack 3a step 5" and
   "Pack 3a built" rows). Five local commits, then the records and a second fidelity review, none pushed or
   published:
   - `5123159`: Calculate Hardness's practice version (6 steps, pack 3) and twin, Dry and Weigh's twin with the
     paper mass's id as a slot, Pack 2's weighings at 0.0001 g, and `hard-water-demo` (six parts, 59 steps, plays
     to 375 mg/L).
   - `35b0919`: lab steps (`labRecord`, `labCalculation`, `labApproval` in `common.mjs`) in groups before the first
     part or after a named part (`composeLab.mjs`); tests in `__tests__/labSteps.test.ts`.
   - `2889a75`: eight chromatography models (chamber with lid, hook and tape; strip; capillary as the real 1 mm
     tube; pencil; ruler; water and 2-propanol bottles; waste beaker). The registry gains `stripFace`, `scaleMm`
     and `liftedWithLidMm`.
   - `c22a503`: `paper-chromatography-practice` (water, 31 steps) and the twins `paper-chromatography-water-3d`
     (31) and `-propanol-3d` (33); the atom `atom.observe.label-developing-chamber`; the strip's marks and the
     tape drawn from runtime state (`bench/scene/stripMarks.ts`); the ruler aligned with the strip
     (`alignWithInstanceId`); the solvent depth worked out from the volume (`prepared3d.ts`).
   - `fe817ec`: the lab `paper-chromatography` (`#/3d/play/paper-chromatography`): six parts, 17 lab steps,
     81 steps in all, 13 items, a setup page with the prepared distances. A 3D-only transform
     (`preparedLab3DSource`, `withLabStopDistances`) sets each expected Rf and the stop distance from them.
   - The user confirmed the step 5 interpretations as built, then asked for a second fidelity review
     (evidence note, "Second fidelity review"). It fixed:
     - the spot now takes the dye mixture's palette colour (G-9);
     - the capillary's limits: at most 0.05 mL drawn, under the tube's 0.059 mL, and enough for three
       touches, now checked on the practice version too (`checkSpotting`, `prepared3d.ts`);
     - the develop step's text;
     - the lab's texts against the source and 2D's lab;
     - the evidence's guardrail list, its lid-early item and a step 4 look.
   - The four things it left for the user (the "Pack 3a built" row, "Still to decide") were each settled on
     2026-10-11 (`DECISIONS.md`, "Pack 3a follow-ups"):
     - no tile under the strip: the `white-tile` scenery is built;
     - bench items shifting between steps in a lab: each item keeps one slot for the whole run (`da07078`);
     - the lab's 11-item tray covering its step card at 1024 × 700: the shelf replaced the tray (item 12);
     - the dye mixture drawn blue: it is drawn in the mixture's own colour, 3D only.
12. **Done 2026-10-11 to 2026-10-16: the shelf in place of the tray** (`TRAY_SHELF_BUILD_PROMPT.md`;
   `evidence/TRAY_SHELF_EVIDENCE.md`; `DECISIONS.md`, "The shelf in place of the tray", "The shelf build's
   interpretations" and "The shelf built"). All four phases, 3D only, none pushed or published:
   - Phase 1 (`82be9f1`, `84f531b`): the two-tier reagent shelf (D9 scenery,
     `tools/blender/equipment/reagent_shelf.py`) behind the working area, a side station past its right end for the
     balances, the burner, the ring stand and the spectrophotometer, a stable spot per item
     (`adapters/shelfSpots.ts`), and the items drawn there with tags, hit boxes and the guided beacon.
   - Phase 2 (`b466757`, `f6d2039`, `c605551`) and its review (`32e2a82`, `177f5a5`, `b857de6`): items taken with
     the bench's own carry, pours leaving from the shelf spot, the Shelf list inside the Bench list (Enter places,
     G-6), the tray panel removed, and the shelf items as the hand's targets.
   - Phase 3 (`705ef23`): tests prove the hand's reach at Home (a raise of 0.15 of the webcam frame at the default
     gain), aim assist in guided mode only, the 3D item carried, and the guide's wording. The mapping is unchanged.
     G3 stays set aside, so no real hand has reached the shelf.
   - Phase 4 (`7e8b82f` to `09d39e5`): `__tests__/shelfLayout.ts` checks the shelf at the start and after every
     step of all 14 3D routes (`shelfRoutes.test.ts`, `pack2Practice`, `pack3Practice`, `lab3d`), and all 14 were
     looked at in the app at 1024 × 700. It fixed two things: a hand let go off the bench now says where the item
     went back, as the mouse does, and an announcement still pending when the player closes is cleared.
   - Reported, not built past: the drying oven, at the back of the bench, hides lower-tier items at Home (three
     and half a fourth in `hard-water-demo`, one in Dry and Weigh); Pack 3b's 29 shelf items need a third tier or a
     second bay; tiny items stay hard to see; at a step whose items are all on the shelf, Auto view keeps the
     previous view. Each is the user's call.
13. **Built 2026-10-12/13, waiting for the user's look** (each has its own `DECISIONS.md` row and evidence note):
   - the step card and dock as a sci-fi HUD (`583aad6`, `4ddb3f3`, `9fd4eb7`; `evidence/STEP_HUD_TOKEN_CONTRAST.md`);
   - the natural lab room, the charcoal epoxy worktop, and Home lowered to 0.45 rad (`4ba20ef`, `42c2fad`;
     `evidence/NATURAL_ROOM_EVIDENCE.md`);
   - two themes for all of 3D, Light and HUD (`f85c2aa`; `evidence/THEMES_EVIDENCE.md`);
   - Home fitted to the screen with charcoal shelf boards (`74ceed7`), then Auto view's steady fit (`7e01cad`,
     2026-10-13; both in `evidence/HOME_FIT_EVIDENCE.md`);
   - right-drag moves the scene up and down (`d38f9a1`, 2026-10-13; `evidence/RIGHT_DRAG_EVIDENCE.md`).

   Two questions from them wait for the user: what Auto view does at a step whose items are all on the shelf
   (recommended: go to Home), and whether Examine, the Selected view and picking from the Bench list take the
   steady fit too.
14. **Built 2026-10-16, waiting for the user's look: the lab room, phase 1** (`LAB_ROOM_BUILD_PROMPT.md`;
   `evidence/LAB_ROOM_EVIDENCE.md`, with renders `renders/LR_*.jpg` and a fidelity review; `DECISIONS.md`, "The lab
   room, phase 1 built"). 3D only, scenery only: no slot, shelf spot, the side station, `BENCH_MM` or Home moved.
   - `aa21b14`: the spine's fittings in the `reagent-shelf` model (perforated grey uprights, sockets, a service bar
     with valves and hoses, a gooseneck tap) and a new `spine-rods` scenery model.
   - `481af48`: the hall (`look/hall.ts`, about 12 × 10 m, ceiling 3.0 m above the floor): our island deepened to a
     far working side and run on to the left as an empty neighbouring station, cabinets on both sides, a column with
     the bench sign, a far island, five windows along the back wall, the end wall's fire hose cabinet, bell, door,
     tall cabinets and fume cupboard (the last two extrapolation), a stool, 600 mm porcelain tiles, the ceiling
     grid, the shadow box re-fitted, daylight across the window run, the occlusion rewritten, and `FAR` 17.0 m.
   - `f609a2a`: the cutaway (`look/cutaway.ts`: seven scenery groups fade over 200 ms through `alphaHash` while in a
     sight line from the eye to the bench) and the spines placed (`look/spines.ts`), with `labRoom.test.ts`.
   - `8c9cc20`: our own shelf section merged by material (Home draws 754 calls per frame, 771 before the hall), and
     the probes' new options (`probes/README.md`; `count-draws.cjs`).

   Checked at `8c9cc20`:
   - tsc is clean;
   - the 3D tests pass, 36 files and 392 tests;
   - `content:check` is at its baseline of 22;
   - the practice build check and the Pack 3 model validator pass.

   Frame time, read 2026-10-22 at `46cc944` in the visible browser pane (Intel Arc, 1091 × 862, DPR 1, HUD,
   Water hardness at Home, during the Overhead ⇄ Home tweens): High and Balanced both give a 16.7 ms median, a
   p99 of 33.3 ms and a max under 34 ms, so 60 Hz with only single missed frames (`evidence/LAB_ROOM_EVIDENCE.md`,
   "Cost"). It is a note, not G2.

   Pending: the user's look. Phases 2 to 5
   (the 1700 mm working area, the sight-line rule, Auto view's follow-ups, the records) each wait for the user.
15. **Next (only when the user asks):** Pack 3b (brass, in six techniques; the proposal's "Brass
   Spectrophotometry"), with a build prompt written first if the user asks for one. Its 29 shelf items need a
   third tier or a second bay first. Also held: publishing Pack 3, the D8 experiments and everything since,
   pushing, and G3.

**How the work has been checked** (the user's validation policy: source review, `npx tsc -p
tsconfig.app.json --noEmit`, `python tools/blender/validate_equipment3d.py --pack 1`, and narrow
static validators; tests are written but not run):
- `probes/` holds the narrow validators and runtime probes; see `probes/README.md`.
- G1 is one browser look per change in the app's pane. A hidden pane stops animation frames, so pours
  never finish drawing and carries are blocked. Two workarounds:
  - switch on Menu → Reduced motion for logic, and switch it back off;
  - take one headless look with Playwright and SwiftShader: `probes/look-dilution.cjs`,
    `probes/look-making-solution.cjs` (all 14 steps; it retries a carry while an animation is drawn),
    `probes/look-room.cjs` (the room, at each tier and view), or `probes/run-weighing-mouse.cjs`.
    The last drives Weigh a Solid with real mouse events, finding items by sweeping the pointer and
    reading the hover label.
  - SwiftShader frames are slow, so allow seconds for a 650 ms camera tween.
- Dev server: `preview_start` "lab-studio-3d-dev" (port 5182), configured in the session folder's
  `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\lab-studio\.claude\launch.json`, which
  is temporary; remove it and stop the server when the work is done. It was removed again after the 2026-10-11
  second fidelity review. To run the app again, re-create it with one configuration: `"name": "lab-studio-3d-dev"`,
  `"runtimeExecutable": "pwsh"`, `"runtimeArgs": ["-NoProfile", "-Command", "Set-Location
  'C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d'; npx vite --host 127.0.0.1 --port $env:PORT
  --strictPort"]`, `"port": 5182`, `"autoPort": true`. Headless G1 looks used Playwright with
  `NODE_PATH=C:/Users/EmilJivishov/Projects/Lab_studio/node_modules`, launched with `--use-angle=swiftshader
  --enable-unsafe-swiftshader` at 1024 x 700 (larger viewports time out on screenshots).
- To look at the microarray lab, add a static-server entry for its folder to the same launch file. The
  worktree's own `.claude/launch.json` has one, "microarray-reference" (port 8791).
- G3 (real webcam) was authorised on 2026-09-24 but has not run. The built-in pane blocks the webcam,
  and Claude in Chrome was not connected, so G3 needs the user, or Claude in Chrome once connected.

**Practicalities:**
- Models: `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P
  tools/blender/build_equipment3d.py -- --only <ids> --review [--composites]`, then `python tools/blender/pack_models.py
  --only <ids>`, then the validator. Review renders land in `tools/blender/.build/review/`. New materials
  go in `tools/blender/labeq/materials.py` and `src/studio3d/equipment3d/viewerMaterials.json` (edit the
  latter as text; it is CRLF).
- Atom docs are generated: `node scripts/generateAtomicStepsDocs.mjs`. transmittance-dilution is
  generated from `scripts/generatorInputs/simulator/transmittanceDilution.mjs` (`node
  scripts/generateSimulatorTechniqueDefinitions.mjs --only transmittance-dilution`); weighing and dilution
  are edited by hand.
- Line endings differ from file to file, and git stores every file byte for byte (the shared
  `.git/info/attributes` has `* -text`). The checked list is under "Gotchas" below. Edit CRLF files with
  a byte-aware script (normalize to LF, assert one match, restore CRLF). Long bash heredocs have failed;
  write longer scripts to a file first.
- Physical-step rules found the hard way: every physical action needs a registry atom (the bundled
  catalogue policy refuses atomless ones); a `legacyActionEffects` entry must equal the handler-derived
  effect; a step that should finish only on acceptance must be validated by a recorded measurement or a
  notebook tag, not by `actionEvidence`.

## Where the work is

- **Our worktree:** `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\lab-studio-3d`.
  - Branch `claude/lab-studio-3d`, tracking `origin/claude/lab-studio-3d`.
  - Remote `https://github.com/jivishov/Lab_Studio_v2.git`.
  - It was pushed up to `713c248`; see "State on 2026-10-03" for what is local only.
- **Its main checkout** is `C:\Users\EmilJivishov\Projects\Lab_studio\tmp\github-export\Lab_Studio_v2`
  (`git rev-parse --git-common-dir`). The main checkout and our worktree share branches and the stash.
  Don't work in it, and don't change its branch.
- **The authoritative 3D code** (the user, 2026-10-10: "keep everything final in lab-studio-3d and completely
  separate from 2D version"). The final code for the 3D version is branch `claude/lab-studio-3d` in this
  worktree, committed there.
  - `main`, local or on GitHub, is the 2D version. Never merge, fast-forward or push the 3D branch into it.
  - On 2026-10-10, local `main` was fast-forwarded to `5a46492` by mistake. It was put back at `f5ea303` the same
    day, with its checkout clean.
- **Baseline:** GitHub main `1d28429` (decision D1).
- **Hands off.** Don't modify the authoritative working copy `C:\Users\EmilJivishov\Projects\Lab_studio`
  (Projects branch `codex/Lab_Studio`). The only exception is the git-ignored `tmp\` worktrees above,
  which `Lab_studio/.gitignore` (`tmp/`) keeps out of the Projects repository.
- **Local-only files in our worktree** (git-ignored):
  - `.env.development.local` sets `VITE_STUDIO_3D_V1=true`.
  - `.claude/launch.json` holds the user's own two reference-server configs (`microarray-reference`,
    `photoreal-bench-reference`). Keep them.

## Governing documents (in `planning/2026-09-23_lab-studio-3d/`)

| File | What it governs |
|---|---|
| `IMPLEMENTATION_PLAN.md` (rev 2.1) | Scope, architecture, scientific fidelity, milestones (§7), risks (§11) |
| `UI_UX_HANDOFF.md` (rev 1) | Layout, visual design, interaction and copy. When it conflicts with the plan, the guardrails G-1 to G-13 (§1) win, and the conflict is reported, not designed around (§0). |
| `DECISIONS.md` | Every decision the user made, and the provisional defaults still open |
| `evidence/*.md` | What each milestone and later change delivered, what was checked, and what was not (M0 to M7, then readings, TARE and spatula, pipettes and funnel, dilution) |
| `mockups/lab-studio-3d-mockups.html` | The approved mock-ups: 22 frames, S1–S9 and P1–P13 |

The user asked for **the highest fidelity** to the plan and the handoff.

## Milestones

| Milestone | State | Commit(s) |
|---|---|---|
| M0: shell, flag, routes, tokens, fonts, inventory, mock-ups | Done; mock-ups approved | `e59b397` … `35158f8` |
| M1: Blender pipeline, wash bottle | Done | `c73fc1b` |
| M2: the remaining 13 Pack 1 models, rack scenery (D9) | Done | `5d1960f` |
| M3/M4 pure layer: runtime adapters | Done | `b368d8c` |
| U10 teacher-facing setup slot labels | Done | `2f78a62` |
| `AGENTS.md` 3D asset rules; G1 spot-check authorisation | Recorded | `399c86f`, `b551414` |
| M3: live bench (BenchEngine, look layer) | Done | `a0a829a` |
| M4: carrying; M5: Player3D; animated pours | Done, with open items below | `9e8bc17` |
| D10 core fix; Studio persistence key | Done | `ba38e21` |
| M6: Studio 3D | Done, plus one critical fidelity review pass | `c97c812`, `de872b4` |
| Starting contents in Studio 3D (decision b) | Done | `049e471` |
| Weighing content fix (D4 exception) | Done | `e8d1d26` |
| M7: gesture bridge and hand-control panel | Done (static exit), with a second fidelity pass; G3 not run | `e60293d`, `d03e754`; `evidence/M7_EVIDENCE.md` |
| Teacher-prepared readings (balance and photometer; weighing in five steps) | Done; transmittance-dilution seen end to end after the cuvette fix (D4 exception 6) | `evidence/READINGS_EVIDENCE.md` |
| Dilute a Stock Solution atomized (12 steps: pipette pump, drop to the line, stopper, invert) | Done; seen in the pane and in a headless look | `evidence/DILUTION_ATOMIZATION_EVIDENCE.md` |
| transmittance-dilution: funnel, working beaker, transfer pipettes, 25 mL cylinder (28 steps) | Done; seen end to end in the pane | `evidence/PIPETTE_FUNNEL_EVIDENCE.md` |
| The balance's TARE key; the spatula for solids (dip, carry, tip) | Done; assessment mode, reduced motion and hand control not seen in the pane | `evidence/TARE_SPATULA_EVIDENCE.md` |
| The microarray lab's room, camera, mouse and hand control (P0–P5) | Done; looks headless, a mouse run of weighing; G3 not run | `9798de1` … P5; `evidence/MICROARRAY_ADOPTION_EVIDENCE.md` |
| Make a Solution atomized (14 steps: weighing boat, funnel in the flask, rinses, swirl, to the mark, invert) | Done, then reviewed for fidelity; headless looks of all 14 steps before and after the review; G3 not run | `evidence/MAKE_SOLUTION_ATOMIZATION_EVIDENCE.md` |
| Pack 1 finished: three-squirt rinses, the test tube stoppered and inverted, the zero atom, per-item tray tiles, the top bar | Done 2026-10-05; tests and `content:check` run; one headless look | `evidence/PACK1_FINISH_EVIDENCE.md` |
| **M8: Pack 1 acceptance** | **Next** | — |

## M7 (delivered 2026-09-24)

M7 is done at its static exit: see `evidence/M7_EVIDENCE.md` for what was built, the review showing the
2D selectors and rules unchanged, the interpretations to confirm, and what was not run. G3 was authorised
on 2026-09-24 but could not run (see "State on 2026-10-03"). The scope below is kept as the record it was
built against.

**Superseded for the 3D player on 2026-10-03.** The user decided that the 3D player takes the microarray
lab's hand-gesture control of equipment (and its lab environment, bench view and mouse control); see
`DECISIONS.md` and `proposals/MICROARRAY_ADOPTION.md`. Item 2's "nothing else" and item 3's "import
nothing, and don't copy its aim assist or lock-on" no longer hold for 3D. The 2D player, and the shared
bridge as the 2D player uses it, stay exactly as built.

The plan (D6, §4.2, §4.7, §7 M7 row) and the UI handoff (§1 G-10, §2.2, §5.15, build-order table)
together define it.

1. **Extract the interaction bridge.** Move grab, preview, `elementFromPoint` targeting, commit on
   release, re-arm and scroll arbitration out of `src/player/StudentPlayer.tsx`. They go into a shared,
   input-agnostic module (`src/player/gesture/bridge/`) with a target-resolver interface.
   - The 2D player keeps a DOM resolver (still `elementFromPoint`), with **no change in 2D behaviour**.
   - The gesture recognition engine stays in `src/player/gesture/` (`gestureMath.ts`, `gestureWorker.ts`,
     `useGestureRecognition.ts`, `gestureScroll.ts`, `gestureTypes.ts`, `gestureAssets.ts`).
   - `AGENTS.md` ("Student Player Camera Gesture Control Rules") names the source-of-truth files and the
     pinch, drag and release UX rules the extraction must preserve.
2. **Add the Player3D raycast resolver** behind the bench canvas (`BenchEngine.pick`). The Player adds a
   raycast resolver and nothing else (§5.15, G-10).
3. **Build the hand-control panel** (§5.15, build order "M7: Hand-control panel"). It is a floating panel
   opened from a "Hand control" dock button; Player3D's dock doesn't have that button yet (see mock-up
   dock and §5.1). The panel holds:
   - the camera preview;
   - the set-up state;
   - gesture cards;
   - cursor speed, the existing 2D control.

   It reuses the 2D player's camera help and privacy wording. Its behaviour comes entirely from the shared
   bridge. The microarray panel in `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\dna-microarray-3d`
   is a design reference only: import nothing, and don't copy its aim assist or lock-on (§2.2). Any such
   tuning belongs in the shared bridge as a reviewed change, or nowhere.
4. **Correct `AGENTS.md`**, line 88 of the gesture section.
   - It quotes "pinch start `0.055`, pinch release `0.085`, minimum confidence `0.35`".
   - `gestureMath.ts` actually has `pinchStartRatio = 0.3` and `pinchReleaseRatio = 0.5` (palm-relative,
     with `minimumPalmSpanPx = 32`) and `pinchTrackingGraceMs = 160`.
   - The edge margins 0.08/0.06 still match.
   - `0.35` doesn't appear anywhere in `src/player/gesture/`, so find where confidence is set before
     editing. `docs/gesture-control.md` already states the 160 ms grace.
5. **Exit** (plan §7):
   - bridge unit tests, written and not run;
   - a review showing the 2D selectors and rules are unchanged;
   - the static design review below;
   - an `evidence/M7_EVIDENCE.md`.

   This is a player refactor with regression risk (plan §11), so keep it behaviour-preserving.
6. **Gate G3** (real-webcam gestures) runs **only with the user's authorisation**. Ask before any webcam use.

**Static design review** (UI handoff, after the build order): part of every milestone's static exit, and
no browser is needed.
1. The token contrast table has been computed, and every pair passes.
2. Every on-screen value renders through the provenance chip component.
3. Instrument display components render only three things: configured settings and status,
   `simulator-generated` readouts, and "Your entry".
4. Guidance components check `mode === "guided"`.
5. The drop resolver follows the 2D order (§5.6), and the free-move path never calls
   `recordAssessmentFailure`.
6. No audio API appears in the code.
7. Reduced-motion branches exist for every item in §3.5.
8. The UI storage keys hold preferences only.
9. The keyboard maps are implemented, and the single-letter keys are scoped to focus.

## After M7: M8 (Pack 1 acceptance)

The plan's exit:
- type check;
- validators;
- content parity of the Pack 1 JSON and its generator against the reconciled baseline;
- `content:check` compared with the baseline;
- model size budgets;
- an evidence note.

G1 and G2 run only as the user authorises. Content parity must expect the nine recorded D4 exceptions:
in weighing, the record-step fix (M6), the seated placement (2026-09-25, which also adds `snapIntoTarget`
to `atom.place.weighed-vessel` in `src/domain/atomRegistry.json`), the five teacher-prepared steps, and
the TARE and spatula wording of the zero and transfer steps; in transmittance-dilution, the cuvette insert and remove steps and the funnel, beaker and pipette steps with the 25 mL cylinder (2026-09-26, which also add a catalogue zone, four atoms and four roles); in dilution, the atomized twelve steps (2026-10-02, with two runtime handlers, six atoms, two roles and a catalogue zone); in
making-solution, the atomized fourteen steps (2026-10-04, with the dissolve of the solid in the vessel, rinse washings into a
receiver and `solventAddition` in the runtime, two new and two generalized atoms, a new role and a renamed one, and the flask's
funnel seat, which also change transmittance-dilution's funnel atom ids and role names); also in
transmittance-dilution, the teacher-set volumes and %T, made through its generator input. The core changes
behind them are listed in `evidence/READINGS_EVIDENCE.md`. `npm run content:check` runs the content rule engine with `--compiled`, which adds
compiled-context diagnostics through the TypeScript composition loader. It is broader than a basic
static check, so ask before running it, given the validation policy. Its baseline covers only the raw
and template rules. `scripts/checkCycle04Foundations.mjs` can't run in this export: it needs
`CYCLE_01_BASELINE.json`, which is missing.

## Open decisions and items for the user

- **Provisional defaults** in `DECISIONS.md`, to confirm before M8:
  - D8 (flattened experiments now, the compiled path in Phase B), Q4 pack grouping, Q6 gates and linter,
    U2, and U4–U8.
  - Q5 (visual direction) was effectively settled when the mock-ups were approved, but the table still
    lists it.
  - U3 (Starting bench) is built, and seated starting items were verified in M6.
- **Presentation choice to confirm at M8** (M4 evidence): `[` and `]` step through every bench item, not
  only the step's targets.
- **Browser checks.** G1 spot checks were authorised as one built-in-browser look per change while
  building M3–M5. The user asked to see the Studio in M6, so looks were taken there too. Full G1
  playthroughs, G2 (performance), G3 (webcam) and G4 (publishing) stay closed without the user's go-ahead.
- **Pushing.** The user asks for pushes explicitly. Commit locally; push only when asked.
- **The shelf (2026-10-11 to 2026-10-16).** `proposals/SHELF_INSTEAD_OF_TRAY.md` (a reagent shelf over the bench in
  place of the tray panel) was approved in full and is built, all four phases of `TRAY_SHELF_BUILD_PROMPT.md`
  (`evidence/TRAY_SHELF_EVIDENCE.md`; item 12 above). Still open: G3 for the hand at the shelf; the oven hiding
  lower-tier items; what Auto view does at a step whose items are all on the shelf; and Pack 3b's shelf room. Of
  the G1 scripts in `probes/`, `place-from-tray.cjs` targets the removed tray panel; the Shelf list needs its own
  selectors.
- **The lab room (2026-10-16, decided; phase 1 built, waiting for the user's look, item 14).** `proposals/LAB_ROOM_LAYOUT.md`, revision 2 (after a fidelity
  review against the code and the user's photos): open the closed room into a teaching hall around a long,
  double-sided island with a centre spine, widen the 3D working area (`BENCH_MM`) to 1700 mm with the middle slot
  row staggered, keep real equipment sizes, cut away scenery in the camera's way, and keep rack spots out of tall
  items' sight lines. It folds in
  the shelf's open questions above (the oven; Auto view at shelf-only steps; steadier framing for Examine, Selected
  and Bench list picks). Every decision of both revisions was answered as recommended (`DECISIONS.md`, two rows);
  the build waits for the user's go-ahead, phase by phase. Phase 1 (the open room at today's 1400 mm working area)
  has its build prompt, `LAB_ROOM_BUILD_PROMPT.md`, checked against the code at `9a68edd`; it adds the camera's far
  clip (7.47 m, too short for the hall), which the proposal missed. Phase 1 was built on 2026-10-16
  (`evidence/LAB_ROOM_EVIDENCE.md`); its frame-time note is still to be read in the visible pane. Then the level
  view adjusted by hand and At the bench, a working view in the camera menu (`DECISIONS.md`, two rows, 2026-10-16),
  and glassware's own look, so empty vessels hold their shape against the windows (one row), all waiting for the
  user's look.
- **A runtime question (2026-10-11).** On every action `withResolvedAttachments` merges in a relation derived from
  a child's snap zone that names the first instance of the parent's definition, even when the child already holds
  its own. With two chambers the 2-propanol strip was also listed in the water chamber. 3D now keeps each child's
  first relation (`adapters/heldRelations.ts`). Whether 2D draws the same is not checked; a shared fix needs the
  user's decision.

## Rules that apply to every change

- **Validation policy** (worktree `AGENTS.md`): source review plus basic static checks only.
  - Type check: `npx tsc -p tsconfig.app.json --noEmit`.
  - `python tools/blender/validate_equipment3d.py` is allowed as a static check (`AGENTS.md`).
  - The previous session also treated a narrow one-file validator script (the core's own setup plus
    validator on one JSON) as a basic static check.
  - Write narrow tests but **don't run** tests, suites, or e2e or browser matrices unless the user asks.
- **Projects sync boundary** (`C:\Users\EmilJivishov\Projects\AGENTS.md`): never stage or operate on
  unselected projects. Never run `git clean -x`, a recursive `reset --hard`, or a whole-worktree
  checkout from the Projects root.
- **Git.**
  - Never use bare `git stash`: the stash is shared with the main checkout.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Content (D4).** Pack 1 technique JSON and its generators stay unchanged except through the D4
  exceptions recorded in `DECISIONS.md` (nine by 2026-10-04). Any further content or core change needs
  the user's decision first, and becomes the next numbered exception.
- **Science.**
  - Instruments are measurement-neutral (G-1): no invented readings.
  - The resting scene equals runtime state (G-3).
  - Colours come only from `resolveLiquidStyle` / `resolveSolidStyle` (G-9).
  - Scenery never becomes a runtime object (G-8).
  - No sound (G-11).
- **Layout.** Tablet, laptop and larger only; no mobile layouts (G-12).
- **3D assets.** Follow "Lab Studio 3D Equipment Asset Rules" in `AGENTS.md`: procedural Blender, budgets,
  provenance, no contents or false labels baked in. `tools/blender/` holds the pipeline.

## Running the app

- Start Vite on a free port: `npx vite --host 127.0.0.1 --port 5182 --strictPort`. Another chat's server
  may hold 5181.
- For the built-in browser, add your own `.claude/launch.json` entry with `"autoPort": true` that passes
  `--port $env:PORT` through `pwsh`, because Vite ignores a `PORT` variable. Remove the entry when done.
- Routes:
  - `#/3d/studio` (Studio 3D);
  - `#/3d/technique/<id>`: `weighing`, `measuring-volume` (host-bound: gate only), `making-solution`,
    `dilution`, `transmittance-dilution`.
- A hidden or minimised app window pauses `requestAnimationFrame` and `ResizeObserver`. Screenshots
  then time out and React Flow can't measure. Check the DOM with `javascript_tool` instead. A hidden page
  can't take focus either, so dispatch `focusout` to trigger React's `onBlur`.

## Gotchas learned the hard way

- **PowerShell array-of-pairs replacements** mangle multi-line strings, because the comma binds tighter
  than `+`. Use the Edit tool for multi-line edits.
- **Git Bash's `sed -i` turns CRLF into LF** for the whole file (this happened to `Player3D.tsx` in P2 and
  was restored in P3). Never use it on a CRLF file; use the byte-aware script.
- **Never `cat >` without a heredoc** in a Bash call: it waits on stdin until the call times out.
- **Line endings.** Check each file before editing and match it; git keeps them as they are (`* -text`).
  - **CRLF** (checked 2026-10-03):
    - `src/studio3d/bench/BenchEngine.ts` and `BenchView.tsx`;
    - `src/studio3d/player/Player3D.tsx`, `usePlayer3D.ts`, `stepRules.ts` and `Technique3DRoute.tsx`;
    - `src/studio3d/Studio3DApp.tsx`, `src/studio3d/styles/studio3d.css`, `src/studio3d/copy/slotLabels.ts`;
    - `src/studio3d/equipment3d/loadModels.ts`, `readiness.ts` and `viewerMaterials.json`;
    - `src/studio3d/__tests__/adapters.test.ts`, `equipment3dRegistry.test.ts` and `slotLabels.test.ts`;
    - in `tools/blender/` (checked 2026-10-10): `labeq/geometry.py`, `markings.py`, `materials.py` and
      `render.py`; `build_equipment3d.py`, `pack_models.py` and `validate_equipment3d.py`; and the modules
      `analytical_balance.py`, `sample_bottle_1l.py`, `spatula.py`, `spectrophotometer.py`,
      `test_tube_rack.py` and `volumetric_flask.py` (the other modules and the helpers are LF);
    - `DECISIONS.md`, `UI_UX_HANDOFF.md`, the mock-ups, `proposals/AGENTS_3D_ASSETS_SECTION.md` and
      `evidence/M2_EVIDENCE.md`.
  - **Mixed:** `src/App.tsx` (mostly CRLF) and `src/player/ProcessSidebar.tsx`.
  - **LF:**
    - `src/studio3d/bench/input/*`, `src/studio3d/bench/look/*`, `src/studio3d/bench/camera/*` and `src/studio3d/hand/*`;
    - `src/studio3d/adapters/*`;
    - `StepCard.tsx`, `panels.tsx`, `HandControlPanel.tsx` and `SimulationSwitcher.tsx`;
    - the rest of `src/player/**`, and the runtime (`src/runtime/*`);
    - `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, the other proposals and evidence notes, and this file.
- **The bench renders on demand.** After changing the scene from a page script (hiding a mesh, reordering
  an index), call `requestRender()` on the engine, or the screenshot shows the previous frame.
- **React 19** `useRef` needs an explicit initial value.
- **React Flow (controlled nodes).** Keep the `dimensions` changes and give `measured` back to the nodes,
  or the minimap and fitting treat cards as unmeasured. Give the MiniMap its size through `style`.
- **Tracing sources.** `scripts/cycle04TechniqueCompositionTransform.mjs` is a one-time in-place
  migration, not a generator.

## Known limits and follow-ups (from the evidence notes)

- **M3:**
  - A state laid out by the 2D player can overlap in 3D; it is drawn as the runtime has it, never moved.
  - Flat glass reads faintly in real time.
- **M4:** a snap seating in 3D (the cuvette into the photometer) has not been observed.
- **M5:**
  - G1 playthroughs are unrun.
  - Looks the pane couldn't give: the beacon moving, the Show me ghost, panels restored after a reload.
    The pour has since been seen.
- **§3.5 motion gaps:**
  - the snap into an anchor (150 ms) and the set-down settle (120 ms) aren't animated;
  - the step-complete strip transitions, but has no ✓ animation.

  Item 7 of the static design review applies.
- **Duplicated rules.** `src/studio3d/player/stepRules.ts` copies `ProcessSidebar`'s enabling rules, and
  `studio/PreviewView.tsx` copies StudentPlayer's preview-notice rule. Both are drift risks; propose
  extracting them as a reviewed change.
- **M6:**
  - On a narrow stage the Player3D floating tray could crowd its dock. The tray is gone (the shelf, item 12).
  - The equipment inspector shows the Blender thumbnail; the equipment dialog has the live turntable.
  - Per-technique composite renders are an asset task; the cards compose item thumbnails for now.
  - Not browser-exercised: HTML drag and drop, the Connect menu, the turntable, the tablet widths, and the
    1600 px split view.
- **Model refinement (2026-10-10):**
  - Glass draw order, as in item 9 above.
  - V2 was not built: clear plastic and thin glass read faintly in real time.
  - The 10 mL pipette, Beral pipette, stirring rod and test tube lean 38° in their thumbnails only.
- **Pack 3a (2026-10-11):**
  - Glass draw order shows on the chromatography chamber and bottles (item 9); noted, not fixed.
  - In a 3D lab, items without a set position took 2D's grid slot by their order on the bench, so they shifted
    when an item left the tray. Settled: each keeps one slot for the whole run (`da07078`, 3D only).
  - No tile under the chromatography strip. Settled: the `white-tile` scenery (the "Pack 3a follow-ups" row).
  - Heat and Reweigh's carbonate issue is left as it was.
- **The shelf (2026-10-11 to 2026-10-16)** (`evidence/TRAY_SHELF_EVIDENCE.md`, "Risks"):
  - The drying oven starts at the back of the bench, in front of the shelf, and hides lower-tier items at Home
    (`hard-water-demo`, Dry and Weigh).
  - Pack 3b's brass content has 29 items on the 2D shelf; two tiers hold about 14.
  - Tiny items (cuvettes, stopper, pencil, capillary) stay hard to see at Home, most at 1024 × 700.
  - In Heat and Reweigh the side station's four stand close: at Home the ring stand stands in front of balance A
    and the burner in front of balance B.
  - `probes/place-from-tray.cjs` is stale (it targets the tray panel).
- **The lab room, phase 1 (2026-10-16)** (`evidence/LAB_ROOM_EVIDENCE.md`, "Known limits"):
  - Yaw is still unbounded and the walls single-sided; a manual zoom-out can take the eye past the front wall.
  - The oven still hides lower-tier items at Home (phase 3's sight-line rule).
  - The tiers stay at 300 and 520 mm; the photos' are about 450 and 800 mm (decision 7).
  - The tall cabinets and the fume cupboard are extrapolation, not in the photos.
  - Under SwiftShader at 1920 × 1080 the camera's tweens take many seconds of wall time (dt is clamped to 0.1 s) and
    the Light theme is slow to screenshot: use `look-room.cjs`'s `LOOK_SETTLE` and `LOOK_SHOT_TIMEOUT`, one run at a
    time.
  - The frame time was read on one machine only (Intel Arc, 1091 × 862, DPR 1; a 16.7 ms median while moving). A
    tablet, 1920 × 1080 and DPR 2 are unread and stay with G2.
- **Glassware's own look (2026-10-16)** (`DECISIONS.md`, "Glassware's own look"):
  - Bench glass with the new look has not been looked at; only the shelf view was.
  - The stirring rod on the shelf's top tier is still hard to see: it lies level behind the rail.
- **Cleanup.** At the 2026-10-11 Pack 3a handoff the dev server was stopped and the temporary launch entry was
  removed. At the 2026-09-24 handoff the temporary launch entry was removed and the dev server
  stopped. At the 2026-10-03 handoff the entry in
  `C:\Users\EmilJivishov\Projects\virtual_lab\experiments\lab-studio\.claude\launch.json` was kept for the
  next thread, and no dev server was running. At the 2026-10-10 model-refinement handoff the entry was kept
  and the dev server stopped. At the 2026-10-16 shelf records the dev server was stopped and the temporary entry
  removed. For the lab room's phase 1 looks (2026-10-16) a second worktree, `tmp/lab-studio-3d-baseline`, served
  `8c9cc20` on port 5184, apart from the camera work going on in this worktree; it and its server were removed after
  the records commit. The 5182 server and the launch entry were left to the session working on the camera. Remove
  the entry when the 3D work ends.
