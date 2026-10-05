# Pack 2: the next five techniques in 3D (proposal, revision 2, 2026-10-05)

**Status:** proposal only; nothing is built. Your requests:
- "Start with the Pack 2 proposal."
- "Critically review your pack 2 handoff for fidelity and refine it." The review's changes are listed at the end.

Pack 2 is the next five techniques in catalogue order (Q4, confirmed 2026-10-05):
- Transfer Liquid;
- Hard-Water Calcium Carbonate Precipitation;
- Filter a Precipitate;
- Dry and Weigh a Precipitate;
- Heat and Reweigh a Carbonate Mixture.

It applies the policy decided on 2026-10-02 and used for Pack 1: each step is a real physical action a student performs, with new atoms where needed. Records and calculations are not physical actions and may keep their legacy effects, as Weigh a Solid's record step does. The choices marked **(you)** are yours. The rest are my recommendations, which I will follow unless you say otherwise.

**Sources:** the two source plans the content already cites, both in `AP_CHEM_LABS/atomic_steps` and only read:
- `what-makes-hard-water-hard_2026-07-27.md`: Investigation 3, steps PR-, FD-, GRAV- and DRY-, and confirmation points 1–10;
- `purify-a-mixture-green-chemistry_2026-07-27.md`: Investigation 7, steps EX- and HEAT-, and points 1–7.

Each proposed step carries the source's basis label:
- **M**: stated in the manual;
- **F**: from a figure or table;
- **R**: real practice the manual leaves implicit;
- **C**: a configuration choice.

## The first decision: these five run only inside 2D labs

Pack 1's techniques each have their own setup page, starting bench and teacher settings, so each plays alone. **Pack 2's do not.** The runtime refuses to play each one alone and sends it to the lab that composes it:

| Technique | Composed into (2D labs) |
|---|---|
| Transfer Liquid | Precipitate and Filter Calcium Carbonate (`intro-filtration-demo`); Hard-Water Reference Demo (`hard-water-demo`) |
| Precipitation | the same two labs |
| Filter a Precipitate | the same two labs |
| Dry and Weigh | Hard-Water Reference Demo |
| Heat and Reweigh | Purifying a Mixture with Green Chemistry |

**How a lab uses its techniques:**
- It imports each technique by id and version, and binds its equipment roles, its steps and its evidence.
- **The lab carries its own starting bench.** So a technique's own starting state is used only when it plays alone, and never leaks into a lab.
- **A technique's steps do not belong to the lab.** Changing them changes every lab built from the technique.
- Most of Pack 2's new steps are actions the 2D player has no control for: the portions, the paper fold, the oven controls, lighting the burner. The same is true of the inversion, which already leaves Dilute a Stock Solution and transmittance-dilution unfinishable in 2D.

So changing these techniques would **very likely leave the three labs unfinishable in 2D.** They are the working 2D experiences today.

**(you) How to build Pack 2 while the assembly of experiments (D8) is open:**
- **A. Recommended: 3D practice versions, with the labs untouched.**
  - Each technique gets a 3D practice version with the proposed steps, its own starting bench and teacher settings. For example, Precipitation starts with the beaker already holding the hard-water sample.
  - The lab-bound techniques and the three 2D labs stay exactly as they are.
  - At D8 we decide whether the labs move to the practice versions' steps.
  - **Cost:**
    - Two versions of five techniques exist until D8.
    - The 3D list of simulations, which today counts its packs from the 2D catalogue order, needs its own list.
- **B. Change the five techniques once, and let the labs follow,** as Pack 1's D4 exceptions did. It is simpler and gives one version, but the three 2D labs very likely stop being finishable in 2D, which is out of scope (your decision).
- **C. Wait for D8,** and build Pack 2 only inside the experiments. Nothing in Pack 2 plays until then.

## What the five do today (read from the content)

| Technique | Today | Gaps against the source and real practice |
|---|---|---|
| **Transfer Liquid** (3 steps) | Place the 250 mL beaker; pour the configured volume from the cylinder; record the teacher's observation. | The cylinder starts holding 20 mL (in the labs, Measure Liquid Volume fills it first). It is not drained or rinsed. Otherwise close to the source: a 20 mL aliquot of each sample (its §10), measured, then poured into a beaker. |
| **Precipitation** (1 step) | One pour from the reagent bottle "forms" the precipitate. Its mass and the final volume are teacher settings. | No stirring, no portions, no observation, and no check that precipitation is complete. The inquiry asks the student to precipitate the calcium **completely** (INQ-02). |
| **Filter a Precipitate** (6 steps) | Seat the funnel in the ring stand's ring; seat the filter paper; wet it; place the receiving flask; pour the mixture through; rinse the solid on the paper. | The paper is not weighed first (FD-01, FD-02) or folded. The beaker is not rinsed into the funnel, so solid stays behind (FD-07). The pour is not slow or guided (FD-06). The source leaves gravity versus vacuum filtration open (its point 1). |
| **Dry and Weigh** (7 steps) | Two oven stages around a break-up with the scoopula; tongs; cool; weigh; record. | The watch glass starts holding the wet solid: no tare of the watch glass (FD-10), and no transfer of the paper onto it (FD-11). The oven's 110–120 °C is a teacher setting the student never sets (FD-13). "Cooling" is done by the tongs, with no place to cool. The timed stages pass instantly. |
| **Heat and Reweigh** (31 steps) | Already broken down from the source: plan approval, one balance, empty and loaded crucible masses, unused sample recovered, ring stand, clay triangle, burner, lid askew, gentle warming, heating, burner off, tongs, cooling, cooled masses until constant, recoveries, calculation. | Close to the source. Lighting the burner and setting its flame are inside "heat" (EX-10). The step "Warm the **covered** mixture gently" requires the lid **askew** (its own `lidPositionRequired`), so its title contradicts the source's rule never to heat a covered crucible (S-02). The cooling surface is already a teacher setting (`coolingSurface`) with nothing to show it. |

## Proposed sequences

### Transfer Liquid (3 steps become 4 or 5)

1. Place the 250 mL beaker. **M**
2. Pour the measured sample from the cylinder into the beaker. **M** (the inquiry's 20 mL aliquot, source §10)
3. Hold the cylinder over the beaker for a few seconds so it drains. **R** This would be a new `atom.transfer.drain-measuring-vessel`, or a pause folded into the pour.
4. **(you)** Rinse the cylinder into the beaker with the wash bottle, three squirts, reusing Make a Solution's counted rinse. **R**
   - *Recommended: yes.* The sample's calcium is what the result measures, and a rinse brings what clings to the cylinder across.
   - *Or no:* the source states no rinse, and the cylinder's own ±0.2 mL already limits the volume.
5. Record the observation, as now.

### Precipitation (1 step becomes 4 to 6)

The sample is already in the beaker: in the labs from Transfer, and on the practice route at the start.
1. Pick up the stirring rod (its model exists). **R** The manual says "stir" but lists no stirring tool (source §7).
2. **(you)** Add the sodium carbonate reagent while stirring.
   - *Recommended: in three portions*, counted like the rinses ("Add (1 of 3)"). The white precipitate grows with each portion, and the rod stirs between them.
   - The portions come from the manual's practice procedure (PR-11 to PR-14), which adds the carbonate solution to calcium chloride this way. For the hard-water sample the inquiry leaves the method to the student's approved plan (INQ-02). The portions are the stated technique applied to it.
   - *Or one pour, then stir.*
3. Observe and record the change after the first portion: "a white precipitate forms". **M** (PR-13) The teacher's observation text is used, as now.
4. **(you)** *Test that precipitation is complete.* **R**
   - Let the solid settle, add one more drop of reagent to the clear liquid above it, and look: no new cloudiness means all the calcium is precipitated.
   - *Recommended: yes*, as it is the real check behind INQ-02's "completely".
   - *Or no.*
5. **(you)** Keep stirring for "another couple of minutes" (PR-15). **M** *Recommended: a short stir with a two-minute clock shown fast* (see "Time").
6. Set the rod down. **R**

The precipitate's mass stays a teacher setting. As today, it is the model's value, never a measurement.

### Filter a Precipitate (6 steps become about 11)

1. Place the ring stand, with its iron ring. **M/F** (GRAV-00; the catalogue's ring stand has the ring seat.)
2. Seat the glass funnel in the ring. **M** (GRAV-01)
3. **(you)** Weigh the dry filter paper on the balance and record it. **M** (FD-01, FD-02; the source's "preweigh paper before wetting")
   - *Recommended: yes*, reusing Weigh a Solid's balance steps.
   - *Or keep the teacher's configured value*, as the labs do today.
4. **(you)** Fold the paper into a cone. **R**
   - The fold: in half, in half again, open into a cone, with a small corner torn off the outer fold so it seals.
   - *Recommended: one fold step* (a click, or a closed hand opening), the paper changing from flat to cone.
   - *Or skip it*, with the paper arriving folded.
5. Seat the paper in the funnel. **M** (FD-04)
6. Wet the paper with the wash bottle so it seals against the glass. **M** (FD-05; as now)
7. Place the receiving flask under the funnel, with the stem touching its inner wall. **R** (GRAV-04)
8. **(you)** Pour slowly, without overflow. **M** (FD-06)
   - *Recommended:* decant the clear liquid first, then the solid. Pour down a stirring rod held to the beaker's lip, and keep the liquid about 1 cm below the paper's rim. An overflow is a real mistake and is refused.
   - *Or a plain controlled pour.*
9. Rinse the beaker into the funnel with the wash bottle, three squirts, bringing the last solid across. **M** (FD-07; the counted rinse with a receiver)
10. Wash the solid on the paper with a little more water, three squirts. **M** (FD-08; as now)
11. The funnel finishes draining; this is shown, not a step.

**(you) Gravity or vacuum** (the source's point 1).
- *Recommended: gravity.* It matches the catalogue's ring stand, funnel and flask, and both 2D labs.
- *Vacuum* needs a Büchner funnel, a filter flask, tubing and an aspirator: four new models and new atoms.

### Dry and Weigh (7 steps become about 14)

1. Place the clean, dry watch glass, already labelled. **M** (FD-09; *recommended: the label shown, not written as a step*)
2. Weigh the watch glass and record it (FD-10, its tare), reusing Weigh a Solid's steps. **M**
3. Lift the filter paper with its solid out of the funnel and open it on the watch glass. **M** (FD-11)
4. **(you)** Pour the filtrate down the drain (FD-12; S-07 asks for a configured disposal). **M**
   - *Recommended: yes*, emptied into a sink at the bench edge, a small new station.
   - *Or leave it.*
5. Set the oven to 110–120 °C with its control. **M** (FD-13)
6. Place the watch glass in the oven, close the door, and dry 10–15 minutes. **M** (FD-14)
7. Open the oven and lift the warm watch glass out with tongs onto a heat-safe pad. **M/R** (FD-15; the pad is **R**)
8. Break the solid into small pieces with the metal scoop. **M** (FD-16; as now)
9. Return it to the oven for 5 minutes. **M** (FD-17)
10. Lift it out with tongs onto the pad to cool. **M** (FD-18)
11. Wait until it is cool. **M** The runtime already refuses to weigh it hot ("…is too hot to weigh").
12. Weigh it and read the combined mass. **M** (FD-19)
13. Record the combined mass. **M** (FD-20)
14. **Work out the precipitate's mass by difference:** combined, less the watch glass, less the filter paper. **M** (FD-21, first half)
    - This keeps Calculate Hardness (Pack 3) receiving the one precipitate mass it takes today (`precipitateMassMeasurementId`).
    - Needed only if the paper and the watch glass are weighed (decision 3 above and step 2 here). Otherwise the teacher's configured mass stays, as today.

**Constant mass** (the source's point 3): *recommended: the manual's two timed stages, no repeat-until-constant loop.* The manual states two stages, and Heat and Reweigh is where constant mass is taught.

### Heat and Reweigh (31 steps; mostly 3D work)

The content already follows the source, so only these changes:
1. **Light the burner** (EX-10, its first half), after the lid is set askew, as S-03 requires. **R** The burner is lit this way:
   - air collar nearly closed;
   - gas on;
   - a striker held at the **top** of the barrel.

   This would be a new `atom.control.light-burner`.
2. **(you)** **Set the flame** for the approved intensity (the existing `heatingIntensity` setting). **M/C**
   - *Recommended: one step:* opening the air collar turns the flame from yellow to blue with an inner cone. The crucible sits just above the cone's tip, the hottest part.
   - *Or keep the intensity inside the heating steps.*
3. **Rename the "covered" step** to "Warm the mixture gently with the lid askew", matching its own rule and S-02.
4. **Show the cooling surface:** a heat-safe pad as the 3D form of the existing `coolingSurface` setting, the same pad as Dry and Weigh. **R/C** (the source's point 6)
5. The approvals, records and the calculation keep their legacy effects; they are not physical actions.

**The 3D work is the larger part:**
- ring stand, clay triangle, burner and flame;
- crucible and lid (askew, the vent gap visible);
- tongs carrying the crucible;
- the balance, reused from Pack 1.

A dull red glow on the crucible is shown only under strong heating.

## Shared new capabilities

| Capability | What the student does | What's needed |
|---|---|---|
| **Stirring rod** | Stir a beaker: a click, or a closed hand moved in a circle, as the swirl. Guide a pour down the rod. | A stir action (atom); the rod model brought into the pack; a pour along a rod in 3D. |
| **Portions** | Add a reagent in counted portions. | Make a Solution's counted-step pattern applied to a pour (`pourPortions`), judged on its own tag. |
| **Complete-precipitation test** (if chosen) | One drop onto the settled mixture, then look. | An observe atom, and a visual state for "no new cloudiness". |
| **Fold the filter paper** | One fold step. | Paper states: flat, cone, seated and wet, with solid, opened on the watch glass (source §12). |
| **Oven** | Set the temperature, open the door, place inside, close, wait, open, remove with tongs. | The oven model with a door, a control and an inside zone; the `placeInInstrument` path in 3D; a step clock. |
| **Tongs** | Pick up a hot vessel with tongs. | A tool carry, like the spatula. |
| **Heat-safe pad** | Set a hot item down to cool. | A pad model and a cooling zone. |
| **Burner** | Light it, set the flame, turn it off. | The burner model with flame states, a striker and an air collar. |
| **Sink** (if chosen) | Pour the filtrate away. | A sink station at the bench edge. |
| **Step clock** | Watch timed stages pass. | A clock on the step card and over the oven or burner. |

**(you) Time** (the oven stages, the stirring, the heating):
- *Recommended: a step clock shown fast.* The minutes run in a few seconds with the clock face showing them, and opening the oven early is refused.
- *Or real minutes*, which are faithful but long for a class.
- *Or a "wait" button* that completes the time at once.

## New models (11, plus 2 if chosen)

**Needed by the content:**
- 250 mL beaker;
- ring stand with iron ring;
- filter paper, with the states above;
- 250 mL Erlenmeyer flask;
- drying oven (door, control, inside);
- crucible tongs;
- scoopula (metal scoop);
- crucible with lid (lid askew);
- clay triangle;
- Bunsen burner (flame states);
- small vial (Heat and Reweigh's working portion).

**If chosen:** a heat-safe pad (recommended) and a sink (if the filtrate is poured away).

The stirring rod's model exists. The funnel stand is the ring stand with the funnel seated, a composite.

## Not proposed

These are out of the techniques' scope here, as in Pack 1:
- goggles and other PPE (S-01);
- cleanup (paper to the wastebasket, S-08; marker removal, S-09);
- the inquiry design, class pooling and the client letter (INQ-01 to INQ-12), which belong to the inquiry and calculation techniques of later packs;
- the practice preparation of the two solutions (PR-01 to PR-10), which is the separate *Hard-Water Practice Preparation* technique.

## Order of work

1. **Models first.** They don't depend on the step choices: the beaker, flask, ring stand, paper, tongs and scoopula, then the oven, burner, crucible and triangle.
2. **Transfer Liquid and Precipitation**, which reuse the counted rinse and add the stirring rod and portions.
3. **Filter a Precipitate**: paper, funnel on the ring, the guided pour, counted rinses.
4. **Dry and Weigh**: oven, tongs, pad, step clock, mass by difference.
5. **Heat and Reweigh**: burner lighting and flame, crucible and lid, the renamed step.
6. **Records.** An evidence note and one G1 look per technique. Under decision 1A each practice version is new content; under 1B each changed technique is a D4 exception and its labs are checked to compile.

## Your decisions, in one list

1. **How to build Pack 2 while D8 is open:** 3D practice versions with the 2D labs untouched (recommended); change the techniques and let the labs follow; or wait for D8.
2. **Transfer:** rinse the cylinder into the beaker (recommended) or not.
3. **Filtration, paper:** weigh it dry (recommended; it brings the mass-by-difference step into Dry and Weigh); fold it as one step (recommended).
4. **Filtration, pour:** decant first and pour down a rod (recommended), or a plain pour.
5. **Gravity filtration** (recommended) or vacuum.
6. **Precipitation:** three portions while stirring (recommended), or one pour then stir.
7. **Precipitation:** the complete-precipitation drop test (recommended) or not.
8. **Drying:** pour the filtrate down a sink (recommended) or leave it.
9. **Time:** a fast step clock (recommended), real minutes, or a wait button.
10. **Heat and Reweigh:** a flame-setting step (recommended), or intensity inside the heating steps.

## Fidelity review (revision 2)

1. **The 2D labs.** Revision 1's recommended option ("let the labs follow") understated its cost: Pack 2's new actions are mostly ones the 2D player cannot play, so the three working 2D labs would very likely become unfinishable in 2D. The recommendation is now 3D practice versions with the labs untouched, until D8. The two first decisions are merged into one.
2. **The precipitate's mass.** Weighing the paper and the watch glass needs a mass-by-difference step, so Calculate Hardness keeps receiving one precipitate mass. Revision 1 did not connect them.
3. **Lighting the burner.** Revision 1 said "at the burner's base"; a burner is lit at the top of its barrel, then the air collar is opened.
4. **Heat and Reweigh's records.** Revision 1 listed atoms for its 9 atomless steps as a gap. They are records and a calculation, which the policy lets keep legacy effects. The point is withdrawn.
5. **The "covered" step.** The step "Warm the covered mixture gently" requires the lid askew; its title now matches the source (S-02).
6. **The cooling surface** is already a teacher setting (`coolingSurface`); the pad shows it.
7. **Precipitation:**
   - The portions are now labelled as the practice procedure's technique, applied to the hard-water sample, not as a stated step for it.
   - The complete-precipitation drop test is added.
   - Revision 1's spurious "place the beaker" step is gone: the sample is already in it.
8. **Transfer:**
   - the claim that a graduated cylinder is "read to contain" is removed; it is not reliably true;
   - the pour's basis is the inquiry's 20 mL aliquot, not PR-08, which is the practice preparation's water.
9. **Filtration:** decanting first, and the 1 cm margin below the paper's rim, are added. The tear and the stem against the wall are marked as real practice.
10. **Constant mass in Dry and Weigh** (the source's point 3) now has a recommendation.
11. **Source labels.** Every proposed step now carries its source's basis label (**M**, **F**, **R** or **C**).
12. **"Not proposed."** A new section lists what is left out and why.
