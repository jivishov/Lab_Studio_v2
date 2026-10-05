# Make a Solution, atomized: evidence (2026-10-04)

Built from `proposals/PACK1_ATOMIZATION.md` with the choices decided on 2026-10-02 (a pre-weighed boat,
swirling in the flask, drop by drop to the mark, a stopper, inverting) and your answers of 2026-10-04
("For task B: yes to all."):
1. **Rinses are real steps.** Each rinse sends its water into a named receiver, the flask.
2. **Generic funnel atoms.** The two cylinder-funnel atoms become atoms for a filling funnel in any narrow-necked vessel. transmittance-dilution's generator changes ids and role names only.
3. **One swirl dissolves the solid.** It is a click on the flask, the step card's Swirl, or a closed hand moved in a circle. The runtime's dissolve uses the solid already in the flask, which is a core change.
4. **Defaults.** Each rinse is 5 mL, "about half full" is 50 %, tipping moves all the solid, and the boat starts in the tray holding the set mass.

This is D4 exception 9. Dilute a Stock Solution (exception 8) built the shared pieces reused here: the drop to the mark, the stopper and the inversion.

## What changed

**Content** (`public/techniques/making-solution.json`, hand-edited as dilution is). Three steps become fourteen:

| # | Step | What the student does | Building block |
|---|---|---|---|
| 1 | Place the volumetric flask | Carries the 100 mL flask to the bench | `atom.place.select-clean-dry-receiving-vessel` |
| 2 | Seat the funnel | Seats the filling funnel in the flask's neck | `atom.place.filling-funnel` (generalized) |
| 3 | Tip in the solid | Tips all of the weighed sodium carbonate from the boat into the funnel | `atom.transfer.weighed-solid-through-funnel` (new) |
| 4 | Rinse the boat | Rinses the boat into the funnel with the wash bottle | `atom.rinse.quantitative-transfer` |
| 5 | Rinse the funnel | Rinses the funnel into the flask | `atom.rinse.quantitative-transfer` |
| 6 | Remove the funnel | Lifts the funnel out and sets it on the bench | `atom.place.remove-filling-funnel` (generalized) |
| 7 | Fill about half full | Adds water from the wash bottle to about half full | `atom.transfer.unmeasured-solvent` |
| 8 | Swirl to dissolve | Swirls until no solid is left | `atom.dissolve.swirl-to-dissolve` (new) |
| 9 | Fill to below the mark | Adds water to just below the mark | `atom.transfer.unmeasured-solvent` |
| 10 | Fill a dropping pipette | Draws water from a beaker of deionized water | `atom.transfer.draw-into-transfer-pipette` |
| 11 | Bring to the mark | Adds water drop by drop until the meniscus touches the mark | `atom.dilute.dropwise-to-mark` |
| 12 | Stopper the flask | Seats the stopper | `atom.place.stopper-vessel` |
| 13 | Invert to mix | Inverts ten times | `atom.mix.invert-stoppered-vessel` |
| 14 | Record the solution's appearance | Records the teacher's observation, as before | (observation) |

- **Settings:** the solid's mass, `soluteMassG`, stays a teacher setting, and so does the observation. `initialSolventVolumeMl` and `finalVolumeMl` are gone: the final volume is the flask's 100 mL. The setup rule now refuses more than 10 g, so the solid dissolves in the half-full flask (below).
- **Equipment:**
  - the flask;
  - a weighing boat holding the set mass of sodium carbonate. It is the same stock as Weigh a Solid: "Sodium carbonate", solute `sodium-carbonate`, drawn as "powder". It is labelled "Weighing boat"; its contents carry the solid and its mass (see the fidelity review).
  - the funnel, the wash bottle, a 150 mL beaker of deionized water, a Beral pipette and a stopper.

  The empty reagent bottle and the stirring rod are gone. A stirring rod is never put into a volumetric flask; the step text says so.
- **Rinse water:** each rinse uses the runtime's default 5 mL. Content states no volume, as `atom.rinse.quantitative-transfer` requires. The flask therefore holds 10 mL before it is filled to half full.
  - **Superseded 2026-10-05** (D4 exception 10, `PACK1_FINISH_EVIDENCE.md`): each rinse step is three squirts of about 3 mL, so the flask holds 18 mL before it is filled to half full.
- **Version:** stays `1.2.0`. The learning goal is unchanged.

**Atoms and roles** (`src/domain/atomRegistry.json`, `src/domain/equipmentRoleRegistry.json`; `docs/atomic-steps.md` regenerated):
- **Generalized:**
  - `atom.place.cylinder-filling-funnel` is now `atom.place.filling-funnel`, and `atom.place.remove-cylinder-filling-funnel` is now `atom.place.remove-filling-funnel`.
  - Both now require the new role `narrow-necked-vessel` (the 25 mL cylinder or the flask) and the role `filling-funnel` (formerly `cylinder-filling-funnel`).
  - transmittance-dilution's generator input changes only these atom ids, the two bindings on each funnel action, and the role entries in its composition. It is regenerated with `--only transmittance-dilution`.
- **New:**
  - `atom.transfer.weighed-solid-through-funnel`, with roles `weighed-sample-source`, `narrow-necked-vessel` and `filling-funnel`.
  - `atom.dissolve.swirl-to-dissolve`, with role `final-volume-vessel`, done through the process control.

  Like the earlier new atoms, they cite no source document and record your decision as their basis.
- **Widened:**
  - `atom.rinse.quantitative-transfer` gains the optional role `receiving-vessel`, and a constraint saying where its washings go when a receiver is named.
  - `rinsed-vessel` now allows `weigh-boat`; the role's rationale says why.

**Core:**
- **Dissolve the solid that is there** (`reducer.ts`, `dissolveSolidInTarget`):
  - A dissolve that names its solid (`dissolveSoluteId`) dissolves the gram solute already in the vessel, in the liquid already there, at the vessel's current volume.
  - It keeps the solute's identity and mass, clears `massG` (the solid is now dissolved), and sets a g/L concentration.
  - It refuses a vessel with no such solid ("There is no sodium carbonate in the … to dissolve.") or with no liquid ("There is no water in the … to dissolve the sodium carbonate in."). It also refuses one already dissolved.
  - Any other solid in the vessel stays undissolved, and the vessel stays a mixture holding it. No content tips in two solids today.
  - A swirl records "Swirled the 100 mL volumetric flask until the sodium carbonate dissolved." under its tag.
  - Content that names no solid keeps the original "Prepared solute" path; hard-water-practice-preparation and the runtime fixture still use it.
- **Rinse into a receiver** (`washingsReceiverInstanceId`):
  - The rinse water, split from the wash bottle, runs into the named receiver, and so does any dry residue left on the rinsed item. The rinsed item is left rinsed.
  - Water on a solid makes a wet mixture, drawn as "dissolving-solid". Water the receiver's name already lists is not named again.
  - A rinse that names a receiver always takes its water from its source, whatever its atom.
  - The rinse refuses a missing receiver, a receiver of another kind than `washingsReceiverDefinitionId` names, a receiver that is also the rinsed item or its source, and a receiver that would overflow.
  - Validation refuses a rinse that both keeps its washings (`collectRinseVolume`) and sends them away, and checks `washingsReceiverDefinitionId` as an equipment reference. Composition remaps both parameters like every `…InstanceId` and `…DefinitionId`.
  - The receiver's "dissolving-solid" is a default: content can name another state with `washingsVisualState`.
- **Adding solvent** (`solventAddition`, opt-in on the two pours and the drops):
  - Water added to a solution leaves a solution of the same name, its concentration diluted by the ratio of the volumes, whatever its unit. The flask therefore ends as "Sodium carbonate solution" at 25.000 g/L for 2.5 g.
  - Water added to a vessel whose name already lists it is not named again.
  - Other content is unchanged: dilution's flask still ends as "Blue dye stock + Deionized water".
- **Wiring:**
  - `interactions.ts` lets `dissolve` use the process control (`recordNotebook`), and so does the content lint's copy of that table (`scripts/checkContentConsistency.mjs`).
  - `validation.ts` requires that form to be `mixOperation: "swirl"`, naming its solid and target, and needs no source for it.
  - `atomRegistry.ts` gives the swirl a typed physical-and-recorded effect.
- **Catalogue:**
  - The flask gains a funnel seat (`volumetric-flask-funnel-seat`, mounted, accepts `funnel`) in the catalogue, the visual catalogue and the interaction zones.
  - The flask may now hold `solid` and `mixture`: the solid is tipped into the dry flask, then wetted.
- **Setup** (`standaloneConfigurationSemantics.ts`): the old initial-versus-final volume rule is replaced by "at most 10 g". The existing rule refuses zero.

**Models** (`tools/blender/equipment/`), built, packed and validated:
- `weigh_boat.py` (28 KB packed):
  - a medium square antistatic polystyrene boat, 89 × 89 mm at the rim, a 64 mm flat floor, 25 mm deep, with 0.6 mm walls;
  - a solid rest on its floor, and a pour lip at a top corner (70° tilt);
  - a new material, "Polystyrene antistatic white".
- `volumetric_flask.py`:
  - The funnel-seat anchor is computed in `_fits.py` (`flask_funnel_seat_depth`) where the funnel's cone meets the 14.5 mm bore, at z = 118.5 mm. The stem tip then hangs in the neck, about 5 mm below the mark.
  - It has a solid rest on the bulb's flat floor.
  - The existing funnel fits; it is unchanged.
- The Pack 1 validator passes: 20 definitions, 0 failures, 2,129,904 bytes. The weighing boat replaces the stirring rod in Pack 1; the validator notes the rod's model is now outside it.

**3D:**
- **The tip** is the existing pour, with the boat as a solid source: a powder stream in the solid's own colour, the boat's heap gone as it tips, and the heap in the flask appearing as the powder lands.
- **A pour or rinse into a vessel with a seated filling funnel aims at the funnel's rim,** not the vessel's mouth, which the funnel stands above. This also applies to transmittance-dilution's pour into the 25 mL cylinder.
- **A jet** (the wash bottle's) leaves its nozzle along the bottle's own direction and passes through the point it is aimed at, so it goes into a narrow mouth: the funnel, or the flask's neck when it is filled.
- **A rinse with a receiver** is drawn as the wash bottle squirting into the rinsed item over the receiver, whose level rises:
  - the funnel is rinsed where it is seated;
  - the boat is lifted clear of the funnel, carried across and lowered, tipped to its registered pour tilt (70°) with its pour corner just inside the funnel's rim. The jet goes into the boat, the washings run from its corner down through the funnel, and the boat goes back the same way;
  - the flask keeps its solid in view until the water lands;
  - the camera frames all three.

  The mouse clicks the rinse target ("Click to rinse the weighing boat into the funnel").
- **The undissolved solid** lies as a heap under the water while the flask's registered state has visible particles ("dissolving-solid"). Its colour comes from the solid palette (G-9).
- **The swirl:**
  - It is triggered by a click or Enter on the flask, or the step card's Swirl.
  - The flask is drawn lifted and held by its neck while its bulb circles three times round, leaning up to 8°. The solid clears in the last turn.
  - Under reduced motion the end state shows at once.
- **Hand control:**
  - At a swirl step, gripping the flask holds it; moving the closed hand once round a circle of at least 10 px swirls it. Once the step has moved on, the grip counts nothing more and lasts until the hand opens; the guide says "Done. Open your hand to let go of the flask." The inversion grip does the same.
  - A wash bottle over what it rinses locks there and squirts on the plunger (a thumb press or a pinch), as a wash bottle is squeezed.
  - The guide lines, the gesture cards (Rinse, Swirl) and the callouts say so.
  - These are new thresholds: 10 px radius, 1.8π swept, a centre that follows the hand at 6 % per frame (`SWIRL` in `handController.ts`).
- **Help** gains "Click the flask at a swirl or invert step".

## Checks

- **Runtime probe** (`probes/probe-making-solution.mts`):
  - all 14 of 14 steps run;
  - the funnel seats and detaches;
  - the boat empties into the dry flask (a solid, 2.5 g); the rinses take the flask to 10 mL ("Sodium carbonate + Deionized water"); half full is 50 mL with the solid undissolved;
  - the swirl gives "Sodium carbonate solution" at 50 g/L; below the mark is 99 mL; at the mark 100 mL and 25.000 g/L;
  - the wash bottle goes from 500 to 401 mL;
  - three drops past the mark are refused;
  - setup refuses 0 g and 12 g;
  - validation, the composition contract, the derived effects and the evidence audit are clean, and the catalogue policy accepts it.
- **Catalogue policy:** accepted for all five Pack 1 techniques.
- **Narrow validators:** weighing 32 of 32; transmittance-dilution 28 of 28, including byte parity with the regenerated generator. Dilute a Stock Solution is unchanged: 12 of 12, 20 x, 0.01 M, its flask labelled as before.
- **Static checks:** `npx tsc -p tsconfig.app.json --noEmit` exits 0; the Pack 1 validator exits 0.

**One headless look** (`probes/look-making-solution.cjs`, Chromium with SwiftShader at Low). All 14 steps ran by keyboard carries and the step card, with no console errors. Seen:
- the funnel seated in the neck;
- the boat tipping at the flask, then empty;
- the boat held tipped over the funnel during its rinse;
- the white undissolved solid under the half-full water;
- the flask leaning mid-swirl, then the clear solution;
- the mark at eye level with the pipette held over the flask;
- the results: 14 of 14 steps, final volume 100.0 mL, the two rinse records, the swirl record, ten inversions, and the teacher's observation.

**Not seen:**
- the wash bottle's jet mid-squirt: SwiftShader draws too few frames;
- assessment mode;
- hand control (G3);
- the pane with normal motion.

## Tests written, not run

- `src/runtime/__tests__/makingSolution.test.ts` (new):
  - the tip through the seated funnel, and its refusal without the funnel;
  - both rinses into the flask;
  - the half-fill named once;
  - the dissolve of the solid in the flask, and its two refusals;
  - the solution kept named, with a true concentration, to the mark;
  - the original dissolve kept for content that names no solid;
  - the swirl's effect and validation; the rinse receiver's validation.
- `src/studio3d/__tests__/makingSolutionScene.test.ts` (new): every item has a model; the seated funnel; the solid heap; the sediment under the water until the swirl.
- `handControl.test.ts`: the swirl by a circle, not by jitter; the rinse by a squeeze once locked, not by an open palm.
- `clickCarry.test.ts`: the rinse's mouse and hand wording.
- `player3DHandControl.test.tsx`: the swirl and rinse guide lines and gesture cards.
- **Updated:**
  - `standaloneConfigurationSemantics.test.ts`: the new setup rule.
  - `studio3d.test.ts`: the Flow view's first step is now placing the flask.
  - `provenance.test.ts`: the new settings.
  - `adapters.test.ts` and `pourAnimation.test.ts`: these used the old first step's shelf-to-shelf pour, so they now use the same pour in the runtime fixture.

## Fidelity review (2026-10-04)

Your request: "Critically review your work for fidelity and refine where needed." Two reviewers read the build, one the runtime and one the 3D, and I checked their findings against the code before changing it.

**3D, fixed:**
1. **A hand still swirling or inverting could act on the next step.** The grip went on counting circles and turns after its step was done. Now a grip counts nothing once its step has moved on, and holds the flask until the hand opens (`handController.ts`, `Player3D.tsx`, `HandControlPanel.tsx`).
2. **The flask's solid vanished during the tip and the rinses.** Until liquid rose in it, the flask was drawn from its after-state with no liquid, which drew nothing. Now it shows what it held until the stream lands, and a tipped solid appears as it lands (`BenchEngine.planPour`).
3. **The held boat could not drain, and its path cut through the funnel.** It was held at 30°, less than its walls' slope, and moved straight from the bench to the funnel. Now it is posed by its registered pour corner and 70° tilt, and lifted, carried across and lowered.
4. **The jet missed narrow mouths.** It left the nozzle at a fixed offset and bent toward wherever it landed, so it could strike the funnel's or the flask's outside. This was already so before Make a Solution, for the flask fills too. Now the nozzle stands back along the bottle's own direction, and the stream passes through the point it is aimed at (`streamGeometry`'s `through` point).
5. **A keyboard carry could pick up the swirling flask.** Carries are now refused while any committed animation is drawn (`useBenchCarry.ts`).
6. **At the mark, the parked wash bottle could fill half the view.** The eye-level camera now prefers a direction whose line of sight and a fan of four rays around it are clear, then falls back to the old rule. Not yet seen: the look after the review caught the camera still turning toward eye level (below).

**Runtime, fixed:**
1. **`npm run content:check` would gain failures.** The lint's copy of the verb table lacked `dissolve`, and the rinse assigned "dissolving-solid" unconditionally while the registry calls it a default. Both are fixed. The lint's titration hits on the drops were already there with dilution. `content:check` itself was not run: it needs your go-ahead. A scratch copy of its visual-state parse finds 21 states the reducer assigns and no mismatch.
2. **A receiver could be given water the source never lost.** A rinse that named a receiver, but was not otherwise a liquid rinse, sent water into the receiver without taking it from the wash bottle. A named receiver now always makes the rinse take its water from the source.
3. **`washingsReceiverDefinitionId` was neither checked nor compared.** It is now an equipment reference that validation and the lab import check, and the rinse refuses a receiver of another kind.
4. **Added water recomputed only a g/L concentration.** Now any concentration is diluted by the volume ratio.
5. **The dissolve would drop any other solid in the flask.** Now another solid stays undissolved, and the flask stays a mixture holding it.

**Mine:**
- The boat's label named the set mass. A label is fixed for the whole run, so after the tip it named sodium carbonate in an empty, rinsed boat. It is now "Weighing boat"; the contents carry the solid and its mass. Interpretation 10 is withdrawn.
- The swirl carried a `vesselInstanceId` that nothing reads. Removed.

**Accepted, not changed:** 2D cannot finish Make a Solution, as it cannot finish Dilute a Stock Solution. The wash bottle's two hand gestures (lock, then squeeze) stay as interpretation 5.

**Tests written, not run:**
- `makingSolution.test.ts`: a receiver of another kind refused; a named receiver's water taken from the source whatever the rinse's atom; a molar concentration diluted by volume; a second solid left undissolved.
- `handControl.test.ts`: a swirl or inversion counting nothing once its step has moved on, and the grip kept until the hand opens.
- `player3DHandControl.test.tsx`: the "Done. Open your hand…" guide line.

**Checks after the review:**
- the typecheck exits 0;
- the probe runs 14 of 14 at 25.000 g/L, the wash bottle from 500 to 401 mL, with the overshoot, the out-of-sequence swirl and the setup rules refused as before;
- transmittance-dilution 28 of 28 and weighing 32 of 32;
- Dilute a Stock Solution 12 of 12;
- the catalogue policy accepts all five Pack 1 techniques;
- the Pack 1 validator passes, 20 definitions;
- line endings are unchanged, and nothing under `src/player/**` or `src/styles/app.css` changed.

**One headless look after the review** (`probes/look-making-solution.cjs`, as before). All 14 steps ran, with no console errors, and the results were as before: 14 of 14, 100.0 mL, the two rinse records, the swirl record, ten inversions and the teacher's observation. Seen:
- the white solid in the flask once the tip had landed;
- the boat held tipped at the funnel's rim while the wash bottle came over, then set back empty;
- the flask with 5 mL of water over its solid after the boat's rinse;
- the solid under the half-full water, the flask mid-swirl, then the clear solution.

**Not seen:**
- the eye-level view after the fan change: the frame at the mark was taken while the camera was still turning toward it. One path moves the camera there, once, so this is most likely SwiftShader's slow frames during the twenty drops.
- the runoff and the jet mid-squirt at normal speed. A frame-stepped capture before these records showed the boat tipped steeply at the funnel's rim, the runoff through the funnel, and the flask keeping its solid until the water landed.

## Interpretations to confirm

These are my choices within your decisions:
1. **Mass limit:** the teacher's mass is at most 10 g, because sodium carbonate dissolves to about 21 g per 100 mL at 20 °C and is dissolved here in about 50 mL.
2. **Adding solvent:** `solventAddition` is opt-in on Make a Solution's two pours and its drops, so the flask ends named "Sodium carbonate solution" with a true g/L concentration. Dilute a Stock Solution keeps its "… + Deionized water" label.
3. **The tip has its own atom.** `atom.transfer.weighed-sample-to-vessel` exists, but its constraints don't hold here: the student records the starting mass, and the amount is the student's choice.
4. **The rinse reuses `atom.rinse.quantitative-transfer`,** with an optional receiving vessel added, rather than a new rinse atom.
5. **Rinse by mouse and hand:** a click with the mouse; by hand, a lock on the item and then a squeeze.
6. **Swirl by hand:** grip the flask and move the closed hand once round a small circle; one swirl dissolves the solid.
7. **The swirl writes a notebook entry,** and its step completes on that tag, as the inversion's does.
8. **The undissolved solid is drawn** as a heap under the liquid wherever a registered state has visible particles and the model has a solid rest.
9. **Pours and rinses into a vessel with a seated funnel aim at the funnel's rim.** This changes how transmittance-dilution's pour into its cylinder is drawn.

## Notes, not changed

- **2D.** The 2D player does not enable the swirl's Record button, as it does not for the inversion, and it has no art for a funnel in the flask. 2D is out of scope, by your decision.
- **The content baseline** still lists the three removed actions, and the `initialSolventVolumeMl` slot label is no longer used. Both are left for the content-baseline refresh.
- **Model hashes.** `labeq/materials.py` changed, so the source hash of every model would change if rebuilt. Only the flask and the boat were rebuilt, as when the pump's material was added on 2026-10-02.
- **Model status.** The stirring rod's model stays in the registry, outside Pack 1.
