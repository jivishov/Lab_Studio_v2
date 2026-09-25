# Proposal: teacher-prepared instrument readings

Status: **proposal for your approval (2026-09-25).** Nothing described here is built.

## What you asked for

In a physical lab the teacher decides the quantities in advance and writes them into the protocol: how much solid to weigh, which wavelength to set, what the samples will read. The virtual lab should work the same way:

- The teacher prepares the lab in Studio before assigning it.
- The student follows the procedure. They never have to decide which value to use.
- The instruments show the prepared values in response to what the student does.
- The student records what they see. Whatever they type is their own result.

Decided on 2026-09-25:

| Question | Decision |
|---|---|
| The student types a value that differs from the display | **Accepted as typed.** The results show it next to the value the display showed. |
| What the balance shows with the empty glass on it, before taring | **The glass's own mass.** Each vessel has a default that the teacher can change. |
| How a display shows a prepared value | **A plain number**, like a real instrument. Examine, the results and Studio say the teacher set it. |
| Scope now | **The balance and the photometer** (Pack 1). The pattern is designed so other readings, such as burettes and thermometers, adopt it in their packs. |

## What already exists

Much of this is already in the core. The new parts are the readouts and two content changes.

- **Setup slots.** A technique declares `composition.configurationSlots`, optionally with a `defaultValue`. The teacher sets them in Studio, or on the pre-lab setup page before "Use approved setup and start".
- **Three Pack 1 techniques already follow your model.** Every amount in `measuring-volume`, `making-solution` and `dilution` comes from a setup slot, and the student only performs the steps.
- **A teacher-set transfer mass.** A transfer step can take its mass from teacher configuration (`mass.source: "configured-input"`). The runtime then really holds that amount in the receiving vessel.
- **The photometer display** already shows the teacher's wavelength and whether it has been zeroed on the blank, both taken from runtime state (`instrumentDisplay.ts`).

The gaps:

- **`weighing`**:
  - no amount is set anywhere;
  - no step puts the sodium carbonate on the glass, although the step's wording names it (the built-in copy in `src/domain/fixtures.ts` has that transfer step);
  - there is no tare;
  - the balance display has nothing to show.
- **`transmittance-dilution`**:
  - three volumes are typed by the player during play: "Measure the configured stock-dye aliquot (mL)", "Measure the configured water volume (mL)", and "Dilute and mix to the configured final volume: final volume (mL)";
  - the %T read has nothing to read.

## The model

The teacher sets three kinds of value in Studio, all as setup slots:

1. **Amounts the procedure moves:** a solid mass, or a volume. This is the existing mechanism.
2. **Properties an instrument reads:**
   - the empty mass of a vessel (new; defaults per vessel);
   - the %T of each prepared sample (new).
3. **Instrument settings,** such as the wavelength. This already exists.

A new shared core module, `src/runtime/instrumentReadout.ts`, computes what each instrument shows. It works from runtime state and those values, and records the source as `teacher-prepared`, next to the existing `simulator-generated` source of the pH meter. Both players draw its result, so 2D and 3D always agree.

The student's entry stays a student response. It is accepted as typed, and the results show "Balance showed 2.500 g · Your entry 2.500 g". When the two differ, the results show both without judging.

### Balance

- **What it shows:** the empty mass of each item on the pan, plus the mass of its contents, minus the tare. It is shown at the balance's precision, 0.001 g, and can go negative, as a real balance does when a tared vessel is lifted off.
- **Empty masses:** a default for each vessel the pan accepts, which the teacher can override per technique with a setup slot. The pan accepts the watch glass, weigh boat, 250 mL beaker and crucible with lid. The defaults need your approval:

  | Vessel | Suggested default | Note |
  |---|---|---|
  | `watch-glass` (100 mm) | 30.000 g | A typical 100 mm watch glass |
  | `weigh-boat` | 1.500 g | A typical medium plastic boat |
  | `beaker-250ml` | 100.000 g | A typical borosilicate 250 mL beaker |
  | `crucible-with-lid` | 25.000 g | A typical porcelain crucible and lid |

- **Contents mass:** from runtime state. It is the amount the teacher-set transfer moved.
- **Tare:** new runtime state on the balance (`tareG` per balance instance), set by a tare step. It stays until the next tare, as on a real balance.

### Photometer

- **Before zeroing, or with no cuvette in the slot:** the wavelength and status only, as today.
- **After zeroing on the blank at the set wavelength:**
  - with the blank in the slot, it shows 100.0 %T;
  - with a sample cuvette in the slot, it shows the teacher's %T for that sample.
- **Absorbance:** Pack 1 reads only %T. A technique that reads absorbance would show A = 2 − log₁₀(%T) from the same value. That is the definition, not a simulation.

## Content changes

### `weighing`: 3 steps become 5

| # | Step | Type | What the student sees |
|---|---|---|---|
| 1 | Place the watch glass on the balance pan (as now) | seat | The balance shows 30.000 g, the glass's mass |
| 2 | Tare the balance (new) | tare | 0.000 g |
| 3 | Add the sodium carbonate with the spatula (new) | transfer, teacher-set mass (`atom.transfer.solid-portion`, as in the built-in copy) | The teacher's amount, for example 2.500 g |
| 4 | Read the balance (the existing step and wording) | student entry | The same |
| 5 | Record the mass (as now) | notebook | — |

New setup slots:
- `solidMassG`, "Mass of sodium carbonate to weigh (g)", required;
- `supportEmptyMassG`, "Mass of the empty watch glass (g)", defaulting to the vessel default;
- the reagent bottle's stock, which must be at least the amount. It starts at 2.5 g today. **I recommend a slot with a 10.000 g default.**

Other changes: the step 3 wording follows the built-in copy, and the U4 sentence "This simulation does not generate balance readings." is removed. The version must stay `1.2.0`, because `checkCycle04Foundations.mjs` requires it.

### `transmittance-dilution`

- The three volumes typed during play become setup slots, as in `dilution`.
- A new slot sets the diluted sample's %T, from 0 to 100. The read step shows it, and the student enters what they read, as now.
- The stock concentration and wavelength are already slots. Their play-time fields show the teacher's value and cannot be changed.

### Other Pack 1 techniques

`measuring-volume`, `making-solution` and `dilution` already work this way and do not change.

## Other changes

**Core:**
- the readout module;
- the balance's tare state;
- validation of the new slots and their ranges: mass greater than 0 and within the bench stock; %T from 0 to 100;
- display policies: `balance-status-and-entry` becomes a balance readout, and the photometer adds its %T readout.

**Players:**
- The 3D displays draw the readout as a plain number.
- Examine says where the value came from, for example "Prepared by your teacher".
- The results show the display value next to the entry.
- The 2D player needs the same readout. Its balance and photometer artwork have blank displays, and the plan keeps the original UI out of scope apart from shared hooks, so this needs your decision (question 1).

**Studio:**
- the setup form and the Studio 3D inspector show the new slots, with friendly labels (the U10 label map), their defaults and their ranges.

## Plan rules this replaces (recorded in DECISIONS.md when you approve)

- **Plan §1 "Instrument readings" and §2.4, item 1.** "The 3D instruments must not display invented readings" stays. A teacher-prepared reading is not invented: it is a teacher value, in the plan's own "Teacher configuration" row. The rule "the balance shows no mass and the photometer shows no %T" is replaced by "instruments show teacher-prepared readouts".
- **Handoff G-1 and U4**, and the Examine sentence "The balance shows no mass and the photometer shows no transmittance…".
- **`docs/atomic-steps.md`.** Its rule "The configured mass is teacher-supplied classroom setup… never a learner balance reading" concerns stock inventory, and still holds: the reading is the student's own entry, made from a display derived from the prepared state. The wording would say so.
- **D4.** A third exception (`weighing`, 5 steps) and a fourth (`transmittance-dilution`). M8's content parity must expect them.

## Questions for you

1. **The 2D player.**
   - (a) It shows the same readout as text on or beside the instrument. **Recommended**, for parity. This is a small change to the original UI.
   - (b) It is not changed, and 2D students have nothing to read.
2. **The default empty masses** in the table above: approve them, or give your own.
3. **The reagent bottle's stock:** a setup slot with a 10.000 g default (recommended), or fixed.
4. **The results when an entry differs from the display:** shown the same way in guided and assessment modes (recommended). Otherwise, flag it only in assessment.

## Build order and checks

1. The core readout module, the tare and validation, with tests written but not run.
2. The content of `weighing` and `transmittance-dilution`, with a narrow validator on each file.
3. The 3D displays and Examine, and the 2D readout if approved.
4. The Studio setup fields.
5. Records: DECISIONS.md, the evidence note, and SESSION_HANDOFF.md.

Validation follows your policy: the type check, narrow static validators, and tests written but not run. Browser checks are one look per change.
