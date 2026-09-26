# Proposal: teacher-prepared instrument readings

Status: **approved and built (2026-09-25)**, revision 2, with "Sodium carbonate amount with no default". What was built, the corrections found while building (the balance precision comes from the weighing step, not the catalogue; the policy file had no garbled text; a core pour pre-check bug), and the checks are in `evidence/READINGS_EVIDENCE.md`.

## What you asked for

In a physical lab the teacher decides the quantities in advance and writes them into the protocol: how much solid to weigh, which wavelength to set, what the samples will read. The virtual lab should work the same way:

- The teacher prepares the lab before assigning it.
- The student follows the procedure. They never decide which value to use.
- The instruments show the prepared values in response to what the student does.
- The student records what they see. Whatever they type is their own result.

Your decisions (2026-09-25):

| Question | Decision |
|---|---|
| The student types a value that differs from the display | **Accepted as typed.** The results show it next to the value the display showed, the same way in guided and assessment modes. |
| What the balance shows with the empty glass on it, before taring | **The glass's own mass.** Each vessel has a default that the teacher can change. |
| Default empty masses | **Approved:** watch glass 30.000 g, weigh boat 1.500 g, 250 mL beaker 100.000 g, crucible with lid 25.000 g. |
| The reagent bottle's stock | **A teacher setting**, defaulting to 10.000 g. |
| How a display shows a prepared value | **A plain number**, like a real instrument. Examine, the results and Studio say the teacher set it. |
| The 2D player | **Out of scope.** 3D is developed independently of 2D. |
| Scope now | **The balance and the photometer** (Pack 1). The pattern is designed so other readings, such as burettes and thermometers, adopt it in their packs. |

## What the review changed, and why

| # | Revision 1 said | Found | Revision 2 |
|---|---|---|---|
| 1 | A shared core module computes readouts for both players | 2D is out of scope. The only reader is Player3D. | The readout lives in the 3D adapter, `src/studio3d/adapters/instrumentDisplay.ts`, next to the photometer's existing "Zeroed on blank" status. |
| 2 | A new runtime tare state on the balance | The core deliberately does not model a balance zero. `brass-spectrophotometry` zeroes with a notebook step: "the simulator neither performs nor senses this zeroing". | The tare follows brass's pattern: a notebook step with a tag. The 3D display derives the zero from that record, as the photometer derives "Zeroed on blank" from its tag. No reducer change. |
| 3 | The transfer mass comes from `mass.source: "configured-input"` | That contract needs a teacher value typed during play (validation requires a `teacherConfiguration` input), which is the confusion you want to remove. | The transfer's `massG` parameter is bound to a setup slot. This is how `making-solution` binds `soluteMassG`, and how the built-in copy of weighing sets its 2.5 g. |
| 4 | Step 3: "Add the sodium carbonate with the spatula" | The runtime's transfer, and the built-in copy that has this step, move the solid from the bottle to the glass (`pourInto`). In 3D the bottle is tipped over the glass; no spatula is drawn. | The wording follows the built-in copy: "Transfer sodium carbonate to the watch glass". The spatula stays as the step's tool role. A spatula animation is an optional follow-up. |
| 5 | (not noticed) | In 3D only items standing on the bench are drop targets. The glass on the pan could receive the transfer only through Confirm, and aiming at it hits the draft shield's front pane first. | Items seated on another item become drop targets at their seat. The carry aim sees through enclosure glass to an item seated inside, as picking already does. |
| 6 | The bottle's stock is a setup slot | Setup finds teacher quantities only in steps, process, success criteria and assessments, never in the starting contents. A stock slot would be hidden from the teacher. A static probe showed a slot-bound starting mass validates and resolves to 10. | A small core change: slot discovery also scans `initialState`. |
| 7 | "The stock concentration and wavelength fields show the teacher's value and cannot be changed" (as if already so) | The input field does not know the setup value (`configuredValue`). The 3D step card shows an empty field the player must type into. | The 3D step card shows a setup value read-only ("Teacher setting · 600 nm"), with no field. |
| 8 | Edit `transmittance-dilution.json` | The file is generator-owned (`scripts/generateSimulatorTechniqueDefinitions.mjs`), and `checkCycle04GeneratorContracts.mjs` checks byte parity with it. | Edit its input, `scripts/generatorInputs/simulator/transmittanceDilution.mjs`, and regenerate with `--only transmittance-dilution`. |
| 9 | %T slot from 0 to 100; A = 2 − log₁₀(%T) | The chemistry pack defines %T as "greater than zero and at most 100 percent". The runtime keeps %T, decimal T and absorbance distinct ("not interchangeable"). | The %T slot's range is greater than 0 and at most 100. The teacher enters the value in the quantity the read step declares, with no conversion. |
| 10 | Photometer display precision not stated; balance at 0.001 g | The catalogue gives the balance 0.001 g. It gives the photometer no precision, and the tare atom says "the displayed precision stays teacher-configured". | The balance shows 0.001 g, from the catalogue. The photometer shows the teacher's value as entered. |
| 11 | "Examine says 'Prepared by your teacher'" | The existing provenance chip for a teacher value reads "Teacher setting" (handoff §3.2). | Use "Teacher setting". |
| 12 | "Validation of ranges" (unspecified) | Per-technique setup ranges and coherence live in `src/data/standaloneConfigurationSemantics.ts`. | New rules go there: the amount must be greater than 0 and at most the stock; the empty mass must be greater than 0; %T must be greater than 0 and at most 100. |
| 13 | Plan rules to replace: §1, §2.4, G-1, U4 | Plan D7 ("Measurement-neutral… keeps teacher inputs, learner observations and simulator values distinct") also names it. So do the handoff's Examine sentence (§5.8), its Pack 1 display column (§6), and `displayPolicies.json`. | All are listed below. D7's purpose, keeping the three sources distinct, is kept: the readout is labelled as a teacher setting and the entry as the student's. |

One consequence to know: **the content and the runtime stay shared with 2D.** The 2D player will play the new weighing and transmittance steps, with nothing to read on its blank instrument artwork. Keeping 2D fully untouched would need 3D-only copies of the content, which I don't recommend.

## Design

### Where the values come from

All the values are teacher-set before play. There are two places to set them: Studio 3D, for drafts, and the 3D setup page that a technique shows before play (`Technique3DRoute`, prefilled with the defaults). There are three kinds of value:

1. **Amounts the procedure moves:** a solid mass or a volume, bound to step parameters. This is the existing mechanism.
2. **Properties an instrument reads:** a vessel's empty mass, and a prepared sample's %T. Both are new, and bound to the step parameters that use them.
3. **Instrument settings:** the wavelength. This is the existing mechanism.

The approved empty masses are kept in one table in the 3D layer, keyed by vessel. A technique's slot uses the table's value as its default. The readout falls back to the table for an accepted vessel that has no slot.

### Balance readout

- **What it shows:** the empty mass of each item on the pan, plus the mass of its contents, minus the zero. It is shown at 0.001 g and can go negative, as a real balance does when a zeroed vessel is lifted off.
- **The zero** is the empty mass of the support named by the latest zero step. Pack 1 has one zero, with the empty glass. Zeroing again with contents on the pan is not modelled.
- **The contents mass** comes from runtime state: the amount the teacher-set transfer moved.
- **Examine** names the source: "Teacher setting". The student's entry keeps "Your entry".

### Photometer readout

- **Before zeroing, or with no cuvette in the slot:** the wavelength and status, as today.
- **After zeroing on the blank at the set wavelength:**
  - the blank in the slot reads 100 %T;
  - a sample cuvette reads the teacher's value for that sample, in the quantity the read step declares (%T in Pack 1).

### Results

When a read step commits, Player3D remembers what the display showed. This is session UI state and is not persisted (G-13). The results then show "Display showed 2.500 g · Your entry 2.500 g", with both values side by side and neither judged, in both modes.

## Content changes

### `weighing`: 3 steps become 5 (hand-edited file)

| # | Step | Building block and type | What the balance shows |
|---|---|---|---|
| 1 | Place watch glass (as now: seated on the pan) | `atom.place.weighed-vessel`, seat | 30.000 g |
| 2 | Zero the balance (new) | A notebook step with a tag, as brass does (atomless, with `legacyActionEffects`) | 0.000 g |
| 3 | Transfer sodium carbonate to the watch glass (new; from the built-in copy) | `atom.transfer.solid-portion`, `pourInto` from the bottle; `massG` from the slot | The teacher's amount, for example 2.500 g |
| 4 | Weigh solid (as now) | `atom.weigh.vessel-supported-balance-display`, as the built-in copy uses once the transfer is its own step | The same |
| 5 | Record mass (as now) | notebook | — |

Setup slots:

| Slot | Label | Default | Rule |
|---|---|---|---|
| `solidMassG` | Mass of sodium carbonate to weigh (g) | none: the teacher must set it | greater than 0, and at most the stock |
| `supportEmptyMassG` | Mass of the empty watch glass (g) | 30.000 | greater than 0 |
| `reagentStockMassG` | Sodium carbonate in the reagent bottle (g) | 10.000 | greater than 0 |

The version stays `1.2.0`, because `checkCycle04Foundations.mjs` requires it. The U4 line under the input ("This simulation does not generate balance readings.") is removed.

**One question:** should `solidMassG` have a default? I recommend none, so that weighing asks for your amount, as in a written protocol. The consequence: weighing moves from "starts directly" to "Needs setup" in the library, and shows the setup page before play.

### `transmittance-dilution` (through its generator input)

- The three volumes typed during play (stock aliquot, water and final volume) become setup slots, as in `dilution`.
- A new slot, `samplePercentTransmittance`, is the teacher's %T for the diluted sample: greater than 0 and at most 100. The read step shows it, and the student enters what they read, as now.
- The stock concentration and wavelength are shown read-only in the step card (review item 7).

### The other Pack 1 techniques

`measuring-volume`, `making-solution` and `dilution` already work this way and do not change.

## Other changes

- **Core:**
  - slot discovery scans `initialState` (review item 6);
  - the new ranges in `standaloneConfigurationSemantics.ts`.
- **3D player:**
  - the readouts;
  - seated items as drop targets, with the carry aim seeing through enclosure glass;
  - read-only setup values in the step card;
  - the results comparison;
  - Examine's wording.
- **3D display policies** (`displayPolicies.json`): the balance and photometer policies add a teacher-prepared readout. The policy ids stay as they are, because they are written into the models' metadata by the Blender pipeline. The file's garbled "Â§" is fixed while it is being edited.
- **Studio 3D:** the new slots get teacher-facing labels in the U10 label map.

## Plan and handoff rules this replaces (recorded in DECISIONS.md on approval)

- **Plan:**
  - §1 "Instrument readings";
  - §2.4, item 1, and the value-source table's "Learner observation" row;
  - D7;
  - risk-table row "A 3D view invents readings";
  - Appendix A's fidelity log, row 2.

  These change from "measurement-neutral" to "teacher-prepared readouts". What stays: nothing is simulated or invented, and the teacher's value and the student's entry are labelled apart.
- **Handoff:**
  - G-1;
  - U4;
  - the Examine policy sentence (§5.8);
  - the Pack 1 table's display column for weighing and transmittance-dilution (§6);
  - the Examine note in `panels.tsx`: "The balance shows no mass…".
- **`docs/atomic-steps.md`:** its rule "The configured mass… is never a learner balance reading" still holds. It concerns the stock inventory, and the reading remains the student's own entry.
- **D4:** a third exception (weighing's five steps) and a fourth (transmittance-dilution). M8's content parity must expect them.

## Build order and checks

1. **Core:** slot discovery and the ranges. Tests written, not run.
2. **Content:** `weighing` by hand; `transmittance-dilution` through its generator. A narrow validator on each, and a byte-parity comparison of the regenerated file.
3. **3D:**
   - readouts;
   - seated targets and the aim;
   - read-only setup values;
   - results;
   - Examine;
   - policies.

   Tests written, not run.
4. **Studio 3D labels.**
5. **Records:** DECISIONS.md, the evidence note, and SESSION_HANDOFF.md.
6. **Checks:** type check, `validate_equipment3d.py` (the policy file changes), and one browser look per change. Running the transmittance-dilution generator is part of step 2. I'll ask before any broader run, such as `content:check`.

Expected updates to existing tests (written, not run):
- `studio3d.test.ts` "does not ask a teacher to set a derived record name";
- `slotLabels.test.ts`;
- the weighing runs in `adapters.test.ts`;
- the configuration tests that call weighing's setup.
