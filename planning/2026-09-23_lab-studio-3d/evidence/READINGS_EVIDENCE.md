# Teacher-prepared readings: evidence (2026-09-25)

What was built from `proposals/TEACHER_PREPARED_READINGS.md` (revision 2, approved 2026-09-25, with "Sodium carbonate amount with no default"), the corrections found while building it, and the checks.

## What changed

**Weighing: five steps**, hand-edited in `public/techniques/weighing.json`; the version stays `1.2.0`:
1. Place the watch glass on the balance pan.
2. Zero the balance. This is a new notebook step (`balanceOperation: "zero"`). It is atomless, with a `legacyActionEffects` entry, as brass's zero step is.
3. Transfer the sodium carbonate to the watch glass. This is new, taken from the built-in copy in `src/domain/fixtures.ts`: `atom.transfer.solid-portion`, `massG` from the teacher's `solidMassG`.
4. Weigh solid. It now uses `atom.weigh.vessel-supported-balance-display`, as the built-in copy does once the transfer is its own step.
5. Record mass.

The setup slots are:
- `solidMassG`, with no default;
- `supportEmptyMassG`, default 30;
- `reagentStockMassG`, default 10, bound in the starting contents.

The composition gains the roles `solid-reagent-source` and `receiving-vessel`. The transfer's instruction states the amount: "Transfer 2.037 g of sodium carbonate from the reagent bottle onto the watch glass."

**transmittance-dilution**, through its generator input, `scripts/generatorInputs/simulator/transmittanceDilution.mjs`, regenerated with `--only transmittance-dilution`:
- The three volumes typed during play are now setup slots: `stockAliquotVolumeMl`, `waterVolumeMl` and `finalVolumeMl`, each through a `literal` volume contract. Later steps still get their named measurements.
- The read step carries `teacherPreparedReading`, taken from `samplePercentTransmittance`.
- Five step instructions state the teacher's values: the concentration, three volumes and the wavelength. The prepared %T appears in none of them.

**Core** (shared with 2D):
- `techniqueConfiguration.ts`: setup discovery also scans `initialState`, so a stock can be a teacher quantity. The unit `%T` is added for `…PercentTransmittance` slots.
- `standaloneConfigurationSemantics.ts`:
  - a teacher-set solid portion cannot exceed its source's starting mass;
  - a literal volume must fit its receiver;
  - %T must be greater than 0 and at most 100;
  - in transmittance-dilution, the final volume must exceed the aliquot, and the water must cover the difference.
- `validation.ts`: a literal `valueMl` may be a `{{config.<slot>}}` reference, as `parameters.massG` already may. The configured definition is validated again with its number.
- `interactionIntents.ts`: the pour pre-check reads a typed volume contract as the reducer's `resolveContractedVolume` does (next section).

**3D player:**
- **Displays** (`instrumentDisplay.ts`, `displays.ts`, `displayPolicies.json`, keeping the policy ids):
  - The balance shows the load on its pan: each vessel's empty mass (the technique's setting, or the approved default) plus its solid contents, less the zero taken with the empty support. Its precision comes from the weighing step's input step.
  - The photometer shows 100 %T for the blank once zeroed, and the teacher's value for a sample.
  - A reading is a plain number, and Examine names its source.
- **Targeting** (`useBenchCarry.ts`, `BenchEngine.ts`): items seated on another item are drop targets at their seat, so the glass on the pan receives the transfer. The carry aim sees through an instrument's enclosure glass to an item seated inside.
- **Step card** (`StepCard.tsx`):
  - a value the teacher set (`configuredValue`) is shown read-only with "Teacher setting", instead of an empty field;
  - the zero step's button reads "Zero";
  - the U4 line is removed.
- **Results** (`panels.tsx`, `usePlayer3D.ts`): "Display showed 2.037 g" appears beside the student's entry. It is captured when the reading commits, as session state only, and nothing judges the two against each other.
- **Wording:** the Help and Examine text describes teacher-prepared readings.
- **Setup page** (`Technique3DRoute.tsx`): the note says "Approved defaults are filled in; change any value you need." when a slot has a default. It keeps the mock-up's "Nothing is filled in for you." when none has one.
- **Labels:** the U10 map (`slotLabels.ts`) gains labels for the seven new slots.

## Corrections found while building

| Revision 2 said | Found | Built |
|---|---|---|
| The balance shows 0.001 g "from the catalogue" | The catalogue gives the balance 0.001 **mL**: precision units follow the category, which is the U9 finding. | The precision comes from the weighing step's own `inputStep` (0.001 g). That is authored content, as the atom's "the displayed precision stays teacher-configured" asks. |
| `displayPolicies.json` has a garbled "Â§" to fix | The file holds a correct "§". My first read decoded it with the wrong encoding. | Nothing to fix. |
| Turning the volumes into `literal` contracts is content-only | The published file failed validation: a literal `valueMl` had to be a number before setup. | A one-line core rule, from the existing `massG` precedent. |
| (not foreseen) | **A core bug that predates this work.** The pour pre-check (`preflightPour`) ignored typed volume contracts and judged a pour by the source's whole volume. Measuring the teacher's 5 mL from the 1 L stock was refused as an overflow. transmittance-dilution's two cuvette fills (75 % of a 4 mL cuvette, from 1 L sources) would have been refused the same way in 2D and 3D, before this work. | `contractedDeliveryMl` reads the contract as the reducer does. A typed value still takes precedence, and the existing overflow test (value 300) is unaffected. |
| (not foreseen) | The setup page said "Nothing is filled in for you." with defaults prefilled. | The wording is conditional (above). |

## Checks

- **Narrow validator, `weighing.json`: 32 of 32.**
  - the published and configured technique;
  - the order of the five steps;
  - slot kinds, units and defaults, including the stock found in the starting contents;
  - refusals for a missing amount, one above the stock, and zero;
  - the configured values in place, and the instruction text;
  - the evidence audit, effect contracts, atom verbs, interactions and roles;
  - `legacyActionEffects` coverage, and the composition contract;
  - two configured Studio workflows, each with its own stock and no template left.
- **Narrow validator, `transmittance-dilution.json`: 28 of 28.**
  - the published and configured technique, and the composition contract;
  - the four new slots, with their kinds and units;
  - the literal volumes, and no play-time field on the three volume steps;
  - the prepared %T on the read step, while the student still enters theirs;
  - the instructions, with the %T in none of them;
  - five refusals, and 100 %T accepted;
  - effect contracts and atoms;
  - a configured Studio workflow;
  - **byte parity**: the generator reproduces the committed file from its input.
- `npx tsc -p tsconfig.app.json --noEmit`: exit 0, tests included.
- `python tools/blender/validate_equipment3d.py --pack 1`: PASS, 14 definitions, 0 failures (the policy file changed).
- One accidental full run of the simulator generator (an unknown `--help` flag) rewrote three files byte-identically. Nothing changed.

**In the pane** (G1 spot checks):
- **Weighing, standalone** (`#/3d/technique/weighing`):
  - The intro lists five steps: "A teacher sets 3 classroom values".
  - Setup refuses 12 g ("exceeds the reagent-bottle-1 starting mass of 10 g") and accepts 2.037 g.
  - On the bench the balance reads 0.000 g, then 30.000 g with the glass seated, then 0.000 g after **Zero**.
  - Dragging the bottle onto the glass on the pan transfers it: "Sodium carbonate is on the watch glass, ready to weigh", and the display reads 2.037 g.
  - An entry of 2.07 is accepted.
  - The results show "Solid mass 2.070 g · Your entry · Display showed 2.037 g".
  - No console errors.
- **transmittance-dilution:**
  - The setup page lists six values with units, and "Nothing is filled in for you."
  - Step 1 shows the concentration read-only ("0.2 M · Teacher setting").
  - Steps 4 to 7 ("Measure 5 mL of the stock dye…", the transfer, "Measure 10 mL of water…", "…mix to a final volume of 15 mL") complete, after the pre-check fix. The run stopped at step 8 of 23.
  - No console errors.

**Not exercised in the pane:**
- the photometer's readouts (steps 9 to 16);
- the fixed cuvette fills.

Reaching them is most of a full playthrough, which needs your go-ahead. Both are covered by tests written but not run.

## Tests written, not run

- **New:**
  - `src/studio3d/__tests__/teacherPreparedReadings.test.ts`: the balance readings (empty, the setting, the zero, the solid, negative when lifted, the default mass, a liquid unknown), the reading captured for the results, and the photometer (not zeroed, the blank, the sample, an empty slot).
  - `src/data/__tests__/teacherPreparedConfiguration.test.ts`: slot discovery in the starting contents, the refusals, the configured values and instructions, the literal volumes, and the validation rule.
  - `src/runtime/__tests__/contractedPourPreflight.test.ts`: the literal aliquot, the fill-fraction cuvette, and an overflow still refused.
- **Updated:**
  - `adapters.test.ts`: weighing's five steps and its readings;
  - `techniqueConfiguration.test.ts`, `workflowConfiguration.test.ts` and `provenance.test.ts`: weighing now needs `solidMassG`;
  - `studio3d.test.ts`: weighing now needs setup.

## Notes, not changed

- The results still round a measurement ("2.070 g") but not the notebook copy ("2.07 g"). This predates the work, as noted on 2026-09-25.
- At 1024 px, transmittance-dilution's long title overlaps the "Step n of 23" counter in the top bar. This predates the work.
- The 2D player plays the new steps with nothing to read, because 2D is out of scope (your decision).
- `AGENTS.md`'s 3D rule "Measurement-neutral instruments… never an invented reading" still holds in substance (nothing is invented), but its heading is now dated. It is left for you to reword.
