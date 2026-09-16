# Lab Studio V1 Authoring Model

Lab Studio separates authoring from execution. Lab Design Studio edits schema fields; Student Player executes the same schema through a reducer-driven simulator runtime.

## Process Nodes

Supported node types are:

- `technique`
- `action`
- `checkpoint`
- `decision`
- `calculation`
- `observation`
- `teacherNote`

Edges support linear progression, retry loops, and simple calculation-result conditions. V1 does not execute teacher-provided JavaScript.

Process nodes may include optional diagram layout metadata:

- `layout.x`
- `layout.y`
- `layout.lane`
- `layout.display`

Layout metadata is authored state for Lab Design Studio's diagram canvas. It is not required for legacy labs; Studio generates deterministic positions when it is missing and preserves authored positions during import/export.

## Validation

Validation rules are structured:

- `actionEvidence`
- `measurementRecorded`
- `dataSeriesRecorded`
- `notebookEntry`
- `calculationWithinTolerance`
- `statePath`
- `processCompleted`

Each rule produces feedback that can be rendered by Student Player or Lab Design Studio preview.

Action prerequisites use the same validation rule shape and are enforced before the runtime mutates equipment state. This keeps recovery paths declarative and testable.

## Interaction Specs

Actions may include an optional `interaction` object that describes the physical student operation expected before the reducer receives the action request. Supported operations are `dragToZone`, `snapIntoTarget`, `pourInto`, `rinseTarget`, `placeInInstrument`, `readInstrument`, `recordNotebook`, `recordTimeSeries`, and `submitCalculation`.

The interaction spec is schema data, not teacher code. It can reference source and target equipment definitions, a known station or instrument, a snap zone, optional value parameter, required state flags, success/invalid cues, and a required accessible label. Existing content that omits `interaction` remains valid; runtime helpers infer a conservative default from the action verb and parameters.

Lab Design Studio exposes these fields as structured controls in the Details panel. Template-added actions receive a default interaction spec and required equipment, while the schema panel warns about missing specs, broken equipment references, incompatible operation/action pairs, and missing accessible labels.

## Student Workflow

Student Player treats the interaction spec as the contract for each step. Pointer and touch users place equipment on the bench, drag sources onto targets, snap filter paper into the funnel, rinse targets, move samples into instruments, read measurements, and then use contextual notebook or calculation controls when evidence is ready.

The keyboard fallback uses the same runtime intent bridge. Students select source and target equipment, then confirm the accessible action for the current step. This fallback is intentionally secondary, but it must remain capable of completing the same workflow without `Perform step` or `Run selected action` controls.

Invalid actions are recoverable: the runtime returns structured feedback, Student Player shows the recovery message in the current-step card, and the reducer does not mutate lab progress for rejected intents.

## Equipment Contents

Equipment contents are modeled as structured state: kind, label, volume, mass, solutes, concentration, precipitate, contamination, temperature, wet/dry state, and derived visual state. Equipment visuals must derive from this content state rather than experiment-specific flags.

## Hard-Water Demo

The hard-water workflow is included as reference content. Its calculations use the reusable hardness formula:

```text
mg/L as CaCO3 = grams CaCO3 * 1,000,000 / sample volume in mL
```

The 20 mL reference values are 375, 100, 250, 50, 25, and 450 mg/L as CaCO3.

Hard-water is the first full interaction-first reference workflow. It completes by measuring sample volume, recording it, precipitating calcium carbonate, seating and wetting filter paper, filtering, rinsing, drying, weighing, recording dry mass, and submitting the hardness calculation through direct manipulation plus contextual evidence controls.

## Acid-Base Titration

`#/play/acid-base-titration` is the schema-backed flagship titration lab. It measures an acid aliquot, transfers it to an Erlenmeyer flask, adds indicator, records initial and final burette readings, confirms endpoint evidence with the pH meter, and calculates acid molarity with:

```text
M_acid = M_base * (final burette mL - initial burette mL) / acid aliquot mL
```

The visual `#/case/acid-base-titration` route is retained only as a historical prototype. Primary navigation points to the `#/labs` catalog, where the schema-backed titration lab opens through `#/play/acid-base-titration`.

## Kinetics Gas-Series Model

Kinetics labs may define `kineticsModels` on a lab or technique. The V1 model type is `gasSyringe`, with deterministic time points, a base maximum gas volume, a base rate constant, controlled defaults, and condition slots for `acidConcentration`, `chipSize`, or `temperature`.

`record` actions that include `kineticsModelId`, `conditionId`, and `dataSeriesId` infer the `recordTimeSeries` interaction. The runtime generates a `DataSeriesRecord` with `xUnit`, `yUnit`, points, source action id, node id, and condition metadata. Gas volume uses a saturating curve:

```text
volume mL = baseMaxVolumeMl * (1 - e^(-baseRateConstant * conditionRateFactor * timeSeconds))
```

Initial-rate calculations use the `initialRateMlPerS` template:

```text
initial rate = (gas volume at 15 s - gas volume at 0 s) / 15 s
```

`#/play/marble-statue-kinetics` is the first bundled kinetics lab. It keeps inquiry bounded: students record a variable choice and hypothesis, assemble a gas syringe apparatus, collect a practice run, run three guided conditions, graph CO2 volume versus time, calculate initial rates, and write a CER conclusion.

## Publishing Constraints

Published labs and techniques must remain plain JSON under `public/labs` or `public/techniques`. Interaction specs must reference equipment included by the definition, use supported operation/action combinations, include accessible labels, and avoid local runtime-only data such as local paths, hashes, or provider file handles.

Before publishing bundled content, run typecheck, unit tests, build, and the Playwright smoke suite so both interaction-first and keyboard fallback flows remain covered.

## Titration Prototype

`#/case/acid-base-titration` remains a visual prototype. The reusable workflow semantics are represented as public schema content at `#/play/acid-base-titration`, where the runtime validates measurement, transfer, endpoint, notebook, and calculation evidence without custom code.
