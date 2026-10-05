# Pack 2: the next five techniques in 3D (proposal, 2026-10-05)

**Status:** proposal only; nothing is built. Your request: "Start with the Pack 2 proposal." Pack 2 is the next five techniques in catalogue order (Q4, confirmed 2026-10-05):
- Transfer Liquid;
- Hard-Water Calcium Carbonate Precipitation;
- Filter a Precipitate;
- Dry and Weigh a Precipitate;
- Heat and Reweigh a Carbonate Mixture.

It applies the policy decided on 2026-10-02 and used for Pack 1: each step is a real physical action a student performs, with new atoms where needed. The choices marked **(you)** are yours. The rest are my recommendations, which I will follow unless you say otherwise.

The real procedures come from the two source plans the content already cites:
- `what-makes-hard-water-hard_2026-07-27.md` (Investigation 3, steps PR-, FD-, GRAV- and DRY-);
- `purify-a-mixture-green-chemistry_2026-07-27.md` (Investigation 7, steps EX- and HEAT-).

Both are in `AP_CHEM_LABS/atomic_steps` and were only read.

## The first decision: none of the five plays on its own

Pack 1's techniques each have their own setup page, starting bench and teacher settings, so each plays alone. **Pack 2's do not.** The runtime refuses to play each one on its own and sends it to the lab that composes it:

| Technique | Composed into (2D labs) |
|---|---|
| Transfer Liquid | Precipitate and Filter Calcium Carbonate (`intro-filtration-demo`); Hard-Water Reference Demo (`hard-water-demo`) |
| Precipitation | the same two labs |
| Filter a Precipitate | the same two labs |
| Dry and Weigh | Hard-Water Reference Demo |
| Heat and Reweigh | Purifying a Mixture with Green Chemistry |

The labs import each technique by id and version, then bind its equipment roles, its steps and its evidence. Two consequences:
- **Playing Pack 2 in 3D** needs either a way for each technique to play alone, or the experiments, which is how labs are put together from techniques (D8). You want D8 discussed separately.
- **Changing a technique's steps changes the 2D lab built from it.** Pack 1 had the same issue with Measure Liquid Volume, which was left for its labs.

**(you) How to play Pack 2 in 3D before D8 is settled:**
- **A. Recommended: a practice route for each technique in 3D.**
  - Each technique gets its own starting bench and teacher settings, the way Pack 1's do. For example, Filter a Precipitate starts with a beaker of calcium carbonate mixture, as it already lists.
  - This lifts the play-alone block for these five in 3D only. The labs keep their route, and nothing about D8 is decided by it.
  - When the experiments come, the same steps run inside them.
- **B. Wait for D8.** Pack 2 is then built and seen only through its three labs, and nothing plays until the experiment work is done.

**(you) What happens to the 2D labs when a technique's steps change:**
- **A. Recommended: change the technique once, and let the labs follow.** This is what Pack 1's D4 exceptions did. The 2D player may not play some new 3D-only actions (as with the inversion); 2D is out of scope (your decision). I would check each lab's bindings still compile, and record each change as a D4 exception.
- **B. Freeze the labs on today's steps,** by keeping a copy of each technique at its current version for them. This keeps 2D as it is but leaves two versions to keep in step.

## What the five do today (read from the content)

| Technique | Today | Gaps against real practice |
|---|---|---|
| **Transfer Liquid** (3 steps) | Place the 250 mL beaker; pour the configured volume from the cylinder; record the teacher's observation. | The cylinder starts already holding 20 mL (in the labs, Measure Liquid Volume fills it first). The cylinder is not drained or rinsed. This one is close to real practice. |
| **Precipitation** (1 step) | "Add configured carbonate reagent and form CaCO3 precipitate": one pour from the reagent bottle, with the precipitate's mass and the final volume as teacher settings. | The manual adds the carbonate **in portions while stirring and observing**, then stirs "another couple of minutes" (PR-11 to PR-15). Here there is no stirring, no portions and no observation. |
| **Filter a Precipitate** (6 steps) | Seat the funnel on the ring stand; seat the filter paper; wet it; place the receiving flask; pour the mixture through; rinse the precipitate. | The paper is not folded into a cone. The beaker is not rinsed into the funnel, so solid is left in it (FD-07). The pour is not guided by a rod. The manual also weighs the dry filter paper first (FD-01, FD-02), which nothing here does. The source plan leaves gravity versus vacuum filtration open (its confirmation point 1). |
| **Dry and Weigh** (7 steps) | First oven stage; remove the warm watch glass with tongs; break up the solid with the scoopula; second oven stage; cool; weigh; record. | The watch glass starts holding the wet precipitate: there is no tare of the watch glass (FD-10) and no transfer of the paper and solid onto it (FD-11). The oven's 110–120 °C setting is not set by the student (FD-13). Cooling has no place: a warm glass is "cooled" by the tongs. The timed stages are instantaneous. |
| **Heat and Reweigh** (31 steps) | Already broken down from the source (plan approval, same balance, empty and loaded crucible masses, unused sample recovered, ring stand, clay triangle, burner, lid askew, gentle warming, heating, burner off, tongs, cooling, cooled masses until constant, recovery, calculation). | Close to the source. Lighting the burner and setting the flame are inside "heat". 9 of its 31 steps (approvals, records, the calculation) have no atom yet. The cooling surface is unspecified in the source (its point 6). |

## Proposed sequences

### Transfer Liquid (3 steps become 4 or 5)

1. Place the 250 mL beaker.
2. Pour the measured sample from the cylinder into the beaker.
3. Hold the cylinder over the beaker a few seconds so it drains. This would be a new `atom.transfer.drain-measuring-vessel`, or a pause folded into the pour; the pour is shown tipped fully either way.
4. **(you)** Rinse the cylinder into the beaker with the wash bottle: three squirts, reusing Make a Solution's counted rinse. *Recommended: yes*, because the sample's calcium has to reach the beaker in full for a gravimetric result. *Or no:* a graduated cylinder is read to contain, and the inquiry only asks for a 20 mL aliquot.
5. Record the observation, as now.

### Precipitation (1 step becomes about 6)

1. Place the beaker holding the sample. In the labs it is already on the bench from Transfer; on the practice route it starts there.
2. Pick up a stirring rod (the model exists, outside Pack 1).
3. **(you)** Add the carbonate reagent **in portions while stirring**. *Recommended: three portions*, counted like the rinses:
   - "Add (1 of 3)": each portion is one short pour from the reagent bottle;
   - the precipitate's white cloud grows with each portion;
   - the rod stirs between portions.

   *Or one pour, then stir*, which is simpler but not the manual's method.
4. Observe and record the change after the first portion (PR-13): "a white precipitate forms". The teacher's observation text is used, as now.
5. **(you)** Keep stirring "another couple of minutes" (PR-15). *Recommended: a short stir with a two-minute clock shown fast*; see "Time" below.
6. Set the rod down on the bench (or a watch glass).

The precipitate's mass stays a teacher setting. As today, it is the model's value and never a measurement.

### Filter a Precipitate (6 steps become about 11)

1. Place the ring stand. It carries its iron ring, as the catalogue's model does.
2. Seat the glass funnel in the ring.
3. **(you)** *Weigh the dry filter paper and record it* (FD-01, FD-02), so the precipitate's mass can be found by difference. *Recommended: yes*: it is a real, manual-stated step, and the balance and its steps exist from Weigh a Solid. *Or leave it to the teacher's configured value*, as the lab does today.
4. **(you)** *Fold the paper into a cone*: in half, in half again, open to a cone, and optionally tear a corner. *Recommended: one fold step* (a click, or the hand closing and opening), with the paper's model changing from flat to cone. *Or skip it*, with the paper arriving folded.
5. Seat the paper in the funnel.
6. Wet the paper with the wash bottle so it seals against the glass (as now).
7. Place the receiving flask under the funnel, with the stem touching its inner wall.
8. **(you)** Pour the mixture slowly. *Recommended: down a stirring rod held against the beaker's lip*, with the liquid kept below the paper's rim (an overflow is a real mistake and is refused). *Or a plain controlled pour.*
9. Rinse the beaker into the funnel with the wash bottle, three squirts, to bring the last solid across (FD-07; the counted rinse with a receiver).
10. Wash the collected solid on the paper with a little more water (FD-08; as now, now three squirts).
11. Let the funnel finish draining, which is shown, not a step.

**(you) Gravity or vacuum** (the source's open point). *Recommended: gravity*, which matches the catalogue's ring stand, funnel and flask, and both 2D labs. *Vacuum* needs a Büchner funnel, a filter flask, tubing and an aspirator: four new models and new atoms.

### Dry and Weigh (7 steps become about 14)

1. Place the clean, dry watch glass. Labelling it with a marker is FD-09; *recommended: shown as a pre-written label, not a step*.
2. Place it on the balance, read and record its mass (FD-10: the tare for the final calculation), reusing Weigh a Solid's steps.
3. Lift the filter paper with its precipitate out of the funnel and lay it on the watch glass (FD-11). In the labs the paper comes from Filtration; on the practice route it starts in a funnel on the stand.
4. **(you)** Pour the filtrate down the drain (FD-12). *Recommended: yes*, as a sink action: the flask is emptied into the sink, which is a small new bench station. *Or leave it.*
5. Set the oven to 110–120 °C (FD-13): a knob or display on the oven model, read as a setting.
6. Place the watch glass in the oven and close the door; dry 10–15 minutes (FD-14).
7. Open the oven and lift the warm watch glass out with tongs onto a heat-safe pad (FD-15).
8. Break the solid into small pieces with the metal scoop (FD-16; as now).
9. Return it to the oven for 5 minutes (FD-17).
10. Lift it out with tongs onto the heat-safe pad to cool (FD-18).
11. Wait until it is cool. The runtime already refuses weighing a warm assembly.
12. Place it on the balance and read the mass (FD-19).
13. Record the combined mass (FD-20; as now).

**(you) Time** (also used by Precipitation and Heat and Reweigh). *Recommended: a step clock shown fast.* The oven's 10–15 minutes run in a few seconds with the clock face showing the minutes, and the door cannot be opened early. *Or real minutes*, which are faithful but long for a class. *Or a "wait" button that completes the time at once.*

### Heat and Reweigh (31 steps; mostly 3D work)

The content already follows the source. I'd add only what is folded into other steps:
1. **Light the burner** (EX-10, the first half): with a striker, at the burner's base, before heating. A new `atom.control.light-burner`.
2. **(you)** **Set the flame** to the approved intensity: *Recommended: one step choosing gentle (warming) or strong (heating)*, the burner's air collar turning and the flame changing from yellow to blue. *Or keep the intensity in the heating steps as now.*
3. **A cooling place:** a heat-safe pad as the configured cooling surface (the source's point 6). *Recommended: the same pad as Dry and Weigh.*
4. **Atoms for the 9 atomless steps:**
   - approve the plan;
   - record each mass (an existing record atom family);
   - calculate the composition;
   - record the uncertainty;
   - confirm the recoveries.
   These are content-side atom bindings with no change to what the student does.

The 3D work is the larger part:
- the ring stand, clay triangle, burner with flame, crucible and lid (askew, and with its vent gap visible);
- the tongs carrying the hot crucible;
- a glow on the hot crucible;
- the balance reused from Pack 1.

## Shared new capabilities

| Capability | What the student does | What's needed |
|---|---|---|
| **Stirring rod** | Stir a beaker: a click, or a closed hand moved in a circle, as the swirl. Guide a pour down the rod. | A stir action (atom), and the rod model brought into the pack. A pour with a rod guide in 3D. |
| **Portions** | Add a reagent in counted portions. | The counted-step pattern from Make a Solution's rinses, applied to a pour (`pourPortions`). |
| **Fold the filter paper** | One fold step. | A flat and a cone state of the paper model, and an atom. |
| **Oven** | Set the temperature, open the door, place inside, close, wait, open, remove with tongs. | The oven model with a door, a setting control and an inside zone; the `placeInInstrument` path in 3D; a step clock. |
| **Tongs** | Pick up a hot vessel with tongs. | A tool carry, like the spatula: the tongs grip the watch glass or crucible. |
| **Heat-safe pad** | Set a hot item down to cool. | A pad model and a cooling zone. |
| **Burner** | Light it, set the flame, turn it off. | The burner model with a flame, a striker, and an air collar. |
| **Sink** (if chosen) | Pour the filtrate away. | A sink station at the bench edge. |
| **Step clock** | Watch timed stages pass. | A clock on the step card and over the oven or burner. |

## New models (11, plus 2 if chosen)

**Needed by the content:**
- 250 mL beaker;
- ring stand with iron ring;
- filter paper (flat and cone);
- 250 mL Erlenmeyer flask;
- drying oven (door, control, inside);
- crucible tongs;
- scoopula (metal scoop);
- crucible with lid (lid askew);
- clay triangle;
- Bunsen burner (with flame);
- small vial (Heat and Reweigh's working portion).

**If chosen:** a heat-safe pad (recommended) and a sink (if the filtrate is poured away). The stirring rod's model already exists. The funnel stand is the ring stand with the funnel seated, a composite.

## Order of work

1. **Models first.** They don't depend on the step choices: the beaker, flask, ring stand, paper, tongs and scoopula, then the oven, burner, crucible and triangle.
2. **Transfer Liquid and Precipitation**, which reuse the counted rinse and add the stirring rod and portions.
3. **Filter a Precipitate**: paper, funnel on the ring, rod-guided pour, counted rinses.
4. **Dry and Weigh**: oven, tongs, pad, step clock.
5. **Heat and Reweigh**: burner, crucible and lid, constant mass.
6. **Records.** Each changed technique becomes a D4 exception, with an evidence note and one G1 look per technique; each lab that composes it is checked to still compile.

## Your decisions, in one list

1. **How to play Pack 2 in 3D:** a practice route per technique (recommended), or wait for D8.
2. **The 2D labs:** change the techniques once and let the labs follow (recommended), or freeze the labs on today's steps.
3. **Transfer:** rinse the cylinder into the beaker (recommended) or not.
4. **Precipitation:** reagent in three portions with stirring (recommended), or one pour then stir.
5. **Filtration, paper:** weigh the dry paper (recommended); fold it as one step (recommended).
6. **Filtration, pour:** down a stirring rod (recommended), or a plain pour.
7. **Gravity filtration** (recommended) or vacuum.
8. **Drying:** pour the filtrate down a sink (recommended) or leave it.
9. **Time:** a fast step clock (recommended), real minutes, or a wait button.
10. **Heat and Reweigh:** a flame-setting step (recommended), or intensity inside the heating steps.
