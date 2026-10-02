# Pack 1 atomization: the remaining techniques (proposal, 2026-10-02)

**Status:** Dilute a Stock Solution is built (`evidence/DILUTION_ATOMIZATION_EVIDENCE.md`). Make a Solution and the two additions are next.

**Decided 2026-10-02:** drop by drop to the mark; a 10 mL graduated pipette with a pipette pump for the aliquot; Make a Solution starts from a pre-weighed boat; the solid is dissolved by swirling in the flask. The remaining recommendations stand, as no change was asked for.

This applies the policy decided on 2026-10-02 to the three Pack 1 techniques not yet reviewed: steps are broken down to the real physical actions a student performs, with new atoms where needed. Nothing here is built yet. The choices marked **(you)** are yours; the rest are my recommendations, which I will follow unless you say otherwise.

## What the three techniques do today (checked by running them through the runtime)

| Technique | Today | Gaps against real practice |
|---|---|---|
| **Make a Solution** (3 steps; plays on its own) | 1. Add solvent from the wash bottle (teacher volume). 2. "Dissolve solid" from the reagent bottle. 3. Record the appearance. | The reagent bottle starts **empty**, yet step 2 adds 1.25 g of a generic "Prepared solute" from the step's settings. The same step takes the flask from 50 mL to its 100 mL mark with no water leaving the wash bottle. Nothing is weighed, nothing is brought to the mark, nothing is stoppered or mixed. The stirring rod is on the shelf but never used. The final volume is a free setting, although a 100 mL volumetric flask holds exactly 100 mL. |
| **Dilute a Stock Solution** (3 steps; plays on its own) | 1. Pour the aliquot from the cylinder into the volumetric flask. 2. Dilute to the mark from the wash bottle. 3. Record the dilution factor. | The cylinder **starts already holding** 10 mL of stock, so nothing is measured. A cylinder is poured into a 14.5 mm flask neck without a funnel. There's no approach to the mark, no stopper, no mixing. The stock has no identity ("Stock solute, 10 mg"). The dilution factor is the teacher's number, recorded, not worked out by the student. |
| **Measure Liquid Volume** (3 steps; **cannot play on its own**) | 1. Place the cylinder. 2. Pour to the configured volume. 3. Record. | No approach-then-adjust to the line. It's composed into two labs, *Precipitate and Filter Calcium Carbonate* and the *Hard-Water Reference Demo*, which bind its node ids and roles, so changing it changes those 2D labs too. |

## Proposed sequences

### Make a Solution (3 steps become about 13)

1. Place the 100 mL volumetric flask.
2. **(you)** *Start from a pre-weighed boat:* the weigh boat with the teacher's mass of the solid is on the bench (the weighing itself is the Weigh a Solid technique, so it isn't repeated). Or *include the weighing:* balance, boat, TARE, spatula and reading, as in Weigh a Solid (about 5 more steps).
3. Seat a funnel in the flask's neck.
4. Tip the solid from the boat into the funnel.
5. Rinse the boat into the funnel with the wash bottle (quantitative transfer).
6. Rinse the funnel into the flask, then remove the funnel.
7. Add deionized water to about half full.
8. **(you)** *Swirl to dissolve* in the flask (the stirring rod is removed: a rod is not used in a volumetric flask). Or *dissolve in a beaker with the stirring rod first*, then transfer quantitatively into the flask with rinses (about 3 more steps).
9. Add water to just below the mark.
10. **(you)** Bring the meniscus to the mark (see "To the mark" below).
11. Stopper the flask.
12. Invert to mix (about 10 inversions).
13. Record the solution's appearance (as now).

Settings:
- the solid's mass stays a teacher setting;
- the final volume is fixed at the flask's 100 mL, no longer a free setting;
- "initial solvent volume" goes (it becomes "about half full");
- the solid is named: sodium carbonate, the same stock as Weigh a Solid, unless you prefer another.

### Dilute a Stock Solution (3 steps become about 12)

1. Place the 100 mL volumetric flask.
2. Pour a working portion of the stock into a beaker (the new `atom.transfer.working-portion`), so no pipette enters the stock bottle.
3. **(you)** Measure the aliquot:
   - *Recommended: a 10 mL graduated pipette with a pipette pump.* Draw above the line, let it down to the teacher's volume, deliver into the flask. It handles any teacher-set aliquot up to 10 mL.
   - *A 10 mL volumetric pipette:* the most accurate, but always exactly 10 mL.
   - *Keep the graduated cylinder,* with a funnel into the cylinder and another into the flask, then rinse the cylinder into the flask.
4. Deliver the aliquot into the flask.
5. Add water to about three-quarters full and swirl.
6. Add water to just below the mark.
7. **(you)** Bring the meniscus to the mark.
8. Stopper the flask.
9. Invert to mix.
10. Calculate the dilution factor (final ÷ aliquot) as a student calculation, in place of recording the teacher's number.
11. Record.

The stock gets a name and a concentration as teacher settings (for example "Blue dye stock, 0.20 M"), so the diluted concentration can also be calculated.

### Measure Liquid Volume: wait for its labs

The real sub-steps are: pour to just below the line, bring it to the line with a Beral pipette, and read the bottom of the meniscus at eye level. The two labs that compose this technique would need their bindings and equipment changed at the same time, and those labs are 2D and Phase B work. **Recommended: leave it until its host labs are taken to 3D**, and use the same building blocks then.

### Two small additions to finished techniques

- **Transmittance-dilution:** its rubber stopper sits unused in the tray. Real practice is to stopper the test tube and invert to mix the dilution before taking a sample. This needs a stopper seat on the test tube (a new zone and model anchor).
- **Weigh a Solid:** the zero step is still atomless. Give it its own atom (`atom.observe.zero-balance`, roles balance and weighed vessel), as the policy now expects.

## Shared new capabilities (built once, used by both techniques)

| Capability | What the student does | What's needed |
|---|---|---|
| **To the mark** **(you)** | *Recommended:* drop by drop from a Beral pipette, watching the meniscus in a close-up of the neck. The student stops when the bottom of the meniscus touches the line. Overshooting is a real mistake: it's recorded, and the flask must be remade. *Simpler:* one "bring to the mark" step with the pipette, as delivery works today. | Recommended: a runtime handler that counts drops (about 0.05 mL each) against the flask's mark, accepts within one drop and refuses an overshoot; a squeeze-per-drop gesture; and a neck close-up. |
| **Stopper** | Carry the stopper to the flask's neck. | The zone and anchor already exist. One atom. |
| **Invert to mix** | Pick up the stoppered flask and hold to turn it over and back; each inversion is counted, and about 10 complete it. The step card has an "Invert" button for the keyboard and hand control (G-6). | A small runtime handler: mixing requires the stopper seated and marks the solution mixed. One atom; a 3D gesture and an animation. |
| **Funnel in a flask neck** | As in the cylinder. | A zone and anchor on the volumetric flask. I'd generalize yesterday's two cylinder-funnel atoms to "a filling funnel in a narrow-necked vessel" (cylinder or flask). |
| **Dissolve what is actually there** | Swirl. | The runtime's dissolve step should dissolve the solid already in the flask (its identity and mass) instead of creating it from settings. A core change, kept compatible with content that names no solid. |

## New models

- **Weigh boat**, if you choose the pre-weighed start; it's also useful later.
- **10 mL graduated pipette and pipette pump**, if you choose the recommended aliquot device. A volumetric pipette is not in the catalogue and would need a new catalogue entry as well.
- The funnel, beaker, Beral pipette, stopper and volumetric flask already exist.

## Order of work

1. The shared pieces, proved on **Dilute a Stock Solution** first (fewest new parts): working portion, pipette aliquot, to the mark, stopper, invert, calculation.
2. **Make a Solution**, reusing them, plus the funnel in the flask and the dissolve change.
3. The two small additions: the transmittance stopper and the weighing zero atom.
4. Records: each technique becomes a D4 exception, and the evidence notes as before. One G1 spot run per technique.

Each technique keeps its version number and is changed through its own file or generator input, as before.
