# Lab Studio 3D: implementation plan

Revision 2.1, 2026-09-23.
- **Revision 2** followed a fidelity review in which every factual claim of revision 1 was re-checked against source. Configuration blockers and interaction resolution were evaluated by running the real functions, not by reading JSON.
- **Revision 2.1** adds two corrections found while writing the companion `UI_UX_HANDOFF.md`: section 4.4 (`storage`) and section 4.5 (free bench moves).

Appendix A lists every change and the evidence for it.

This is a planning document only. Producing it changed no Lab Studio source, content or build.

## 1. Goal and scope

Build a new version of Lab Studio, **Lab Studio 3D**, with the following properties:

- Equipment is modelled in Blender and used as real 3D apparatus on a live bench.
- The Studio and the Student Player are redesigned.
- The existing way processes are built is kept: definitions whose steps form a flow diagram, edited through Studio transactions and executed by the shared scientific runtime.

The existing Studio already distinguishes the two phases you described, through its `StudioArtifactKind`:

- **Phase A, techniques**, is the Studio's `technique` artifact kind plus playing techniques. It is delivered in packs of five techniques in catalog order. Pack 1 is `weighing`, `measuring-volume`, `making-solution`, `dilution` and `transmittance-dilution`.
- **Phase B, experiments**, is the Studio's `lab` artifact kind. It covers experiments built from existing techniques, together with the published experiments compiled from them.

Pack 1 has three constraints from the source, established in section 2:

- **Standalone play.** Four of the five techniques can be played standalone after teacher setup. `measuring-volume` is host-bound: the core refuses both standalone setup and generic Studio composition for it, and sends users to its host experiments (`intro-filtration-demo`, `hard-water-demo`). It is therefore modelled and editable in Pack 1, but it can be played only inside those experiments, which Packs 2 and 3 unlock.
- **Instrument readings.** The balance mass and the photometer %T are **learner-entered observations**; the runtime does not simulate them. The 3D instruments must not display invented readings (section 2.4).
- **Composition.** Studio composition today flattens techniques into a draft. It is not the compiler that builds the published experiments. "Experiments compiled directly from techniques" in the Studio is therefore a new capability, and Phase B asks you to choose how to deliver it (decision D8).

Out of scope: changes to scientific behaviour, new chemistry, new published technique content, mobile layouts, and the original application's UI beyond the shared-shell hooks listed in section 4.7. The earlier photoreal and 2.5D prototypes remain reference material only (section 12).

## 2. Grounding: what the source provides

Source: the clean snapshot of GitHub main `1d28429b14b5d6c02ec48048ae1a2ef84dee6a6a` at `Lab_studio\tmp\photoreal-handoff-review-20260922`. Section 2.8 covers how the authoritative working copy differs from it.

### 2.1 Studio mechanism (kept)

- **Artifacts.** `StudioArtifactKind = "lab" | "technique"` (`src/studio/studioArtifact.ts`). A technique is authored as a one-technique lab draft: `labDraftFromTechnique` opens it, and `deriveTechniqueFromLabDraft` plus `serializeTechnique` export it.
  - **Defect:** the export does not carry the technique's `composition` contract (ports, equipment roles, configuration slots, evidence outputs, model slots). A technique opened and re-exported through the Studio can no longer be composed or configured.
- **Edits.** Every draft change goes through a typed `StudioOperation`, committed with `commitStudioTransaction` (base revision and idempotency key; `src/studio/studioTransactions.ts`). The operations are:
  - adding content: `appendTechnique`, `appendConfiguredWorkflow`, `configureWorkflow`, `appendTemplateStep`;
  - steps: `updateProcessNode`, `removeProcessNode`, `updateAction`, `replaceNodeValidation`;
  - connections: `updateProcessEdge`, `addBranchEdge`, `addRetryEdge`, `setStartNode`, `autoLayoutProcess`;
  - equipment: `updateEquipmentList`, `addEquipment`, `removeEquipment`, `upsertInitialEquipment`, `removeInitialEquipment`;
  - settings: `updateLabSettings`, `updateTechniqueSettings`, `renameTechnicalId`;
  - wholesale: `replaceDraft`, used by imports, template loads and the assistant's `commitDraftUpdater`.
- **Undo and redo already exist** in `TeacherStudio.tsx` as snapshot stacks around each committed transaction.
- **Graph vocabulary** (`src/domain/types.ts`):
  - seven node types: `technique`, `action`, `checkpoint`, `decision`, `calculation`, `observation`, `teacherNote`;
  - four edge conditions: `always`, `validationPassed`, `retry`, `calculationResult`;
  - seven validation types: `actionEvidence`, `measurementRecorded`, `dataSeriesRecorded`, `notebookEntry`, `calculationWithinTolerance`, `statePath`, `processCompleted`.
- **Flow diagram.** `ProcessMap.tsx` uses `@xyflow/react`. Nodes can be dragged to set their layout. Connections are edited through a side panel of source and target selects; drawing an edge between handles is not implemented today.
- **Library.** Of Pack 1, only `transmittance-dilution` is offered as a whole-workflow template. Weighing, measuring volume, making a solution and dilution appear only as generic single-step templates ("Weigh item", "Measure volume", "Make solution", "Dilution") built from blueprints, not as the published techniques.
- **Configure before append.** `workflowConfiguration.ts` applies `compositionTechniqueConfigurationBlocker` and requires teacher approval for classroom quantities.
- **Preview.** `PreviewPanel` renders the existing `StudentPlayer` in preview chrome. `usePlayerRuntime` accepts `focusNodeId` and `focusVersion`.
- **Other Studio features.** The Studio also hosts the WebMCP Experiment Composer, guided rehearsal and the Protocol Check.
- **Persistence.** Drafts are saved under the single `localStorage` key `lab-studio:v1:draft`.

### 2.2 How experiments are built today

There are two paths, and revision 1 conflated them.

1. **Published experiments are composition sources, compiled when they load.** The lab JSON carries `techniqueInstances` (with `bindings.equipment`, `bindings.configuration` and `preserveIds`), plus `compositionStart`, `compositionConnections` and `reachabilityWitnesses`. `loadBundledLab(id, setup)` applies the teacher's lab setup and compiles through `compileBundledLabCompositionWithPolicy`, which runs `compileLabComposition` (contract 1.6) and the bundled-catalog policy. Equipment bindings let one vessel continue across techniques.
2. **Studio experiments are flattened drafts.** `appendTechniqueToDraft` copies each technique with prefixed ids: its actions, nodes, completion rules and **its own separate equipment instances**, joined by a single "Next" connector edge. It creates no instances, bindings or connections, and never runs the compiler.
   - A compiled experiment opened in the Studio carries a `compositionManifest`, and any edit marks it `"detached"` ("until the author runs the compiler again").
   - The Studio has no way to run that compiler.

Two experiments bypass the shared loader with custom routes: `acid-base-titration-curves` and `green-chemistry-mixture-purification`. Teacher setup forms exist for the bonding, hard-water, paper, Quick Ache and titration experiments. Green chemistry is the only one the loader refuses to start without a setup (`LabSetupRequired`).

### 2.3 The runtime seam the 3D bench plugs into

- **Resolution.** User input becomes a `RuntimeInteractionIntent`. `resolveInteractionIntent` validates it against the current node, action, equipment, attachments and prerequisites, and returns a `RuntimeActionRequest` or refusal feedback (`reason`, `message`, `recovery`). `performRuntimeAction` then commits the request.
- **Interaction type.** Each action's interaction is authored, or derived from its verb by `defaultInteractionForAction`: `place` becomes `dragToZone`, or `snapIntoTarget` when it has a target; `measureVolume`, `transfer`, `dissolve` and `dilute` become `pourInto`; `weigh` becomes `readInstrument`; `record` and `observe` become `recordNotebook`; `calculate` becomes `submitCalculation`.
- **How the existing player drives it** (`StudentPlayer.tsx`, `runIntent`):
  - the step's input field (`currentActionInput`) is validated first, then merged into the intent: its value and note, `configurationApproved` for teacher-configuration inputs, and the configured runtime parameter;
  - a refused intent calls `runtime.recordAssessmentFailure(...)`, so it counts as a failed attempt in `assessment` mode (`RuntimeMode` is `guided` or `assessment`);
  - during the Studio's guided rehearsal, intents go through `rehearsalBridge` instead.
- **The existing non-drag path** is `ProcessSidebar`'s "Accessible action flow". It shows the resolved Source and Target, and a `confirm-accessible-action` button that is disabled until input is ready and prerequisites are met, and while a configuration lock applies.
- **Equipment state.**
  - `EquipmentInstance.location` is one of `shelf`, `workbench`, `snapZone`, `oven` or `storage`.
  - `interactionStatus` is one of `free`, `snapped`, `locked` or `inInstrument`.
  - `x`, `y` and `rotation` are **2D workbench pixel units** in a front-view picture: `y` is height on screen, not depth. Default spots are `x = 34 + (i % 5) * 148` and `y = 86 + ⌊i/5⌋ * 160`, and bench sizes come from `getBenchSize` in `visualCatalog.ts`. Mapping `y` onto 3D bench depth is therefore a presentation choice, made once in `benchCoordinates`.
  - The runtime moves attached children with their parent (`attachments.ts`), and some actions carry 2D `targetX`/`targetY` parameters.
- **Zones.** Two registries exist. The catalog `snapZones` hold 2D art positions. The semantic zones in `src/domain/interactionZones.ts` (`v1InteractionZones`: owner, accepted items, relation type, maximum occupancy) are what the runtime's attachment logic uses. Both use the same ids.
- **Targeting.** `benchOverlap.ts` (`resolveBenchOverlap`) is a pure function over 2D bounds. `benchTargeting.ts` works on 2D render nodes.
- **Camera gestures.** The recognition engine is modular in `src/player/gesture` (worker, hook, maths, scrolling). The **interaction bridge** (grab, preview, `elementFromPoint` targeting, commit on release, re-arm, scroll arbitration) lives inside `StudentPlayer.tsx`.
  - The source constants are pinch ratios 0.3/0.5 and a 160 ms tracking grace (`gestureMath.ts`).
  - The 0.055/0.085 thresholds quoted in `AGENTS.md` are stale.

### 2.4 Values and readings (governs every instrument and pour)

| Source of a value | Where it comes from | Pack 1 examples |
|---|---|---|
| Teacher configuration | Setup form slots (`classroom-quantity`), or a play-time input with `inputRole: "teacherConfiguration"` | `measuring-volume` target volume; `transmittance` stock aliquot and final volume; wavelength |
| Learner observation | Play-time input with `inputRole: "studentResponse"`. **Not simulated by the runtime.** | Weighing: "Enter the finite non-negative mass displayed by the balance"; `transmittance`: "Percent transmittance shown by the photometer (%T)" |
| Runtime state | Contents and volumes after actions; photometer calibration and blank readiness (`photometerCalibration`) | Liquid levels; blank or zero status |
| Simulator-generated readout | `contents.instrumentReadout` with `provenance: "simulator-generated"`. **Only the pH meter uses it.** | None in Pack 1 (titration packs) |

Consequences for Lab Studio 3D:

1. **Instruments are measurement-neutral.** A display may show runtime-backed information only:
   - configured settings, such as wavelength and mode;
   - status, such as blanked, zeroed or ready;
   - a `simulator-generated` readout, where one exists;
   - after entry, the learner's own value, labelled as theirs, as the 2D player does for recorded temperature.
   
   It never shows an invented mass or %T. Simulating those readings would be a scientific change that needs science review, and is out of scope.
2. **Pours carry values only from the action's input field**, exactly as the 2D player does.
   - For `measuring-volume` there is no input, so the runtime pours the configured target volume.
   - A skill-based "pour to the mark" that sent the poured amount would change the recorded measurement (`reducer.ts` uses `request.value` when it is present). It is excluded, and is listed as a possible future extension that would need review.
3. **Animations depict committed actions, and the resting scene equals runtime state.**
   - For example, the `weigh` branch reads the balance without attaching the watch glass to the pan or moving it.
   - The 3D view may show the glass on the pan during the weighing animation, but must return it to where the runtime has it.

### 2.5 Liquid appearance (reuse, do not re-palette)

`src/equipment/liquidRendering` owns liquid appearance. `deriveRenderableLiquid(contents)` classifies the contents, and `resolveLiquidStyle(contents, definition)` is the single palette, sourced from `visualStateRegistry.json`. Each registry entry carries a disposition, an evidence kind and a `quantitativeClaim` (`none` or `ordinal`), and the module explicitly forbids a second palette.

The 3D bench uses these functions for colour and style, and replaces only the 2D height calibration with 3D fill profiles.

### 2.6 Pack 1 inventory (evaluated with the real functions)

| Technique | Steps | Interactions (resolved) | Standalone setup | Studio composition | Setup inputs |
|---|---|---|---|---|---|
| weighing | 3 | drag, read instrument, notebook | allowed | allowed | 1 auto-derived identifier |
| measuring-volume | 3 | drag, pour, notebook | **blocked: host-bound** | **blocked: host-bound** | 2 quantities, 1 identifier |
| making-solution | 3 | pour, pour (dissolve), notebook | allowed | allowed | 4 quantities |
| dilution | 3 | pour, pour (dilute), notebook | allowed | allowed | 3 quantities, 1 identifier |
| transmittance-dilution | 23 | drag ×5, pour ×6, read ×3, snap ×2, notebook ×4, calculate ×3 | allowed | allowed | 2 quantities, 6 identifiers |

Pack 1 needs **six interaction handlers**: `dragToZone`, `snapIntoTarget`, `pourInto`, `readInstrument`, `recordNotebook` and `submitCalculation`. It needs **14 equipment definitions**:

| Definition | Catalog and zone facts | 3D notes |
|---|---|---|
| `analytical-balance` | zone `analytical-balance-pan` (placed on) | Draft shield, pan, display that is **measurement-neutral** (section 2.4) |
| `watch-glass` | zone `watch-glass-paper-seat` (placed on; used in Pack 2) | Dished glass; powder heap when it holds a solid |
| `reagent-bottle` | 250 mL; liquid, solution or solid | Holds solid sodium carbonate in Pack 1; dissolve pours solid |
| `spatula` | tool | Role-bound only: no Pack 1 step manipulates it |
| `graduated-cylinder` | 100 mL, 1 mL precision | Graduations and fill profile, so levels read correctly |
| `sample-bottle` | 125 mL | Pour source |
| `sample-bottle-1l` | stock-bottle variant | Pour source |
| `volumetric-flask` | 100 mL, 0.1 mL precision; zone `volumetric-flask-stopper-seat` (inserted) | Calibration ring mark |
| `wash-bottle` | 500 mL | Prototype model exists |
| `stirring-rod` | tool | Role-bound only |
| `test-tube` | 20 mL | **Cannot stand unsupported**; sample-rack zones exist, but Pack 1 definitions include no rack (decision D9) |
| `rubber-stopper-set` | tool; fits the flask seat | In `transmittance`'s starting equipment, but used by no step |
| `cuvette` | 4 mL | Optical and frosted faces; the orientation rule is recorded as a notebook step |
| `spectrophotometer` | zone `spectrophotometer-cuvette-slot` (inserted) | Display shows only configured mode and wavelength, blank status and the learner's entry (section 2.4) |

### 2.7 Which experiments each pack unlocks

Packs follow catalog order in fives. Having every composed technique delivered is **necessary but not sufficient**: an experiment can also need lab setup forms, custom routes (two experiments), specialised host models (titration, chromatography, kinetics) and lab-level equipment.

| Pack | Techniques (catalog order) | Experiments whose techniques are all delivered |
|---|---|---|
| 1 | weighing, measuring-volume, making-solution, dilution, transmittance-dilution | none |
| 2 | transfer, hard-water-precipitation, filtration, drying, thermal-decomposition-mass-loss | `intro-filtration-demo`; `green-chemistry-mixture-purification` (custom route and setup) |
| 3 | paper-chromatography, hard-water-calculation, beers-law-calibration, brass-spectrophotometry, hard-water-gravimetry | `hard-water-demo`, `brass-colorimetry`, `paper-chromatography` |
| 4 | titration-endpoint, bonding-solids-tests, redox-titration, tablet-separation, crystal-violet-kinetics | `acid-base-titration`, `bonding-unknown-solids`, `hydrogen-peroxide-redox-titration` |
| 5 | hand-warmer-calorimetry, titration-curve-analysis, blue1-standard-dilutions, blue1-percent-transmittance, blue1-class-calibration | `hand-warmer-calorimetry`, `blue1-spectroscopy` |
| 6–9 | the remaining 17 techniques | the remaining 7 experiments (including `acid-base-titration-curves`, custom route) |

`intro-filtration-demo` uses 10 equipment definitions:
- **covered by Pack 1:** sample bottle, graduated cylinder, reagent bottle, wash bottle;
- **existing in prototype form:** beaker, Erlenmeyer, ring stand, funnel, filter paper (the wash bottle is in both groups);
- **still to model:** `funnel-stand`.

### 2.8 Source divergence that Pack 1 depends on

The authoritative working copy (`Lab_studio`, HEAD `c32ba48`, 115 modified tracked files per the 2026-09-23 handoff inventory) modifies files Pack 1 runs on:

| Area | Files |
|---|---|
| Runtime seam | `src/runtime/interactionIntents.ts`, `reducer.ts`, `actionInputs.ts`, `attachments.ts` |
| Domain | `types.ts`, `validation.ts`, `atomRegistry.*`, `equipmentRoleRegistry.json` |
| Equipment | `catalog.ts`, `composites.ts`, `visualCatalog.ts`, `visualStateRegistry.json` |
| Studio | `studioState.ts`, `TeacherStudio.tsx` |
| Player and shell | `EquipmentView.tsx`, `contentDisplay.ts`, `App.tsx` |
| Content and generator | `public/techniques/transmittance-dilution.json`, `scripts/generatorInputs/simulator/transmittanceDilution.mjs` |

In that working copy, `techniqueConfiguration.ts`, `techniqueHosts.ts`, `TechniqueSetupForm.tsx` and `stockBottleVariants.json` are **untracked**, while main has committed versions of them. The lines evolved in parallel. Until they are reconciled, "the Pack 1 definitions" and "the core" are not single things.

### 2.9 Validation tooling as it exists

- `npm run typecheck` runs `tsc -b`. **There is no lint script and no ESLint dependency**, so the "basic linting" required by `AGENTS.md` is currently the typecheck alone.
- `npm run content:check` is recorded as **exiting 1 on the accepted baseline**, with 21 documented source-trace limitations. It can only be compared against that baseline; it is not a pass/fail gate.

## 3. Decisions

Recommended defaults, with the choices that are yours to make marked in section 13.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Core baseline | Reconcile **first**, for the files in section 2.8, into one agreed core baseline. Asset work (M1, M2) can proceed in parallel; adapter and interaction work (M3, M4) waits for the reconciled baseline. | The runtime seam itself differs between the two lines. Building adapters before reconciling would mean redoing them. |
| D2 | Location | Same repository, as an additive app `src/studio3d/` under `#/3d/…`, behind a `studio3dV1` flag. The flag follows the `featureFlags.ts` pattern: a default, a `VITE_STUDIO_3D_V1` environment variable, and a static read. | One scientific core and one Studio mechanism. The only shared-shell edits are listed in section 4.7. |
| D3 | Rendering | Live three.js bench (three `^0.184` is already a dependency). If WebGL 2 is unavailable, **navigate** to the existing route (`#/technique/:id` or `#/play/:labId`) rather than importing the old player. | The same GLBs serve preview, play and experiments. Navigation keeps the import boundary clean. |
| D4 | Content | Pack 1 technique JSON and its generator owner stay unchanged relative to the reconciled baseline. 3D data lives in an `equipment3d` registry keyed by definition id and **semantic zone id**. | No content churn; nothing new to validate scientifically. |
| D5 | Engine style | An imperative three.js `BenchEngine` inside a thin React component, synced from `RuntimeState`. No `@react-three/fiber`. | Deterministic sync; reuses the prototype code. |
| D6 | Camera gestures | **Extract** the interaction bridge from `StudentPlayer.tsx` into a shared module with a target-resolver interface. The 2D player keeps a DOM resolver (still `elementFromPoint`); Player3D adds a raycast resolver behind the canvas element. Gesture constants stay in `gestureMath.ts`, and `AGENTS.md` is corrected to match them. | Only compliant way to keep one gesture system. This is a refactor of the original player, so it carries regression risk (section 11). |
| D7 | Instrument displays | Measurement-neutral, per section 2.4. | Keeps teacher inputs, learner observations and simulator values distinct, as the handoff requires. |
| D8 | How experiments are "compiled from techniques" in the Studio | **Needs your choice.** (a) Keep today's flattening append for Studio experiments. (b) Add composition-source authoring (instances, equipment bindings, port connections), compiled by the same compiler and policy `loadBundledLab` uses. Recommended: (a) is available from M6 onward, and (b) is Phase B's main deliverable. | (b) matches "compiled directly with the existing techniques" and gives the same vessel continuity across techniques that published experiments have. It is new Studio core capability. |
| D9 | Test tube support | **Needs your choice.** (a) Render a visual-only rack as bench scenery, not an equipment instance. (b) Add `sample-rack` to the technique's equipment, which is a content change. (c) Render the tube lying down. Recommended: (a), clearly marked as scenery. | The runtime has no supported-tube state in Pack 1. Physical plausibility must not create runtime objects. |
| D10 | Technique artifact export | Fix `deriveTechniqueFromLabDraft` so exports carry the technique's `composition` contract, as a reviewed core change with a narrow test. | Without it, techniques edited in either Studio stop being composable, which undermines Phase B. |

## 4. Architecture

### 4.1 Layers

```
Shared core (imported, unchanged except the reviewed core changes in section 7)
  src/domain     types, validation, interactions, interactionZones, atom registry, equipment roles
  src/runtime    createRuntimeState, performRuntimeAction, resolveInteractionIntent, attachments, actionInputs
  src/data       loadBundledTechnique/Lab, compileLabComposition, techniqueConfiguration, techniqueHosts
  src/equipment  catalog, visualCatalog (getBenchSize), liquidRendering (resolveLiquidStyle), registries
  src/studio     studioState, studioTransactions, studioReadiness, studioValidation, workflowConfiguration,
                 studioArtifact, importExport, persistence (verified: none imports UI .tsx)

Adapters (new, pure, unit-testable)
  benchCoordinates   2D workbench pixel units <-> bench-plane millimetres, per-definition scale from getBenchSize
  runtimeToScene     instances, attachments, contents, calibration state -> scene description (section 4.4)
  sceneToIntent      gestures -> RuntimeInteractionIntent, with the action input merged the way runIntent does (4.5)
  footprints         3D footprints -> 2D bench bounds, reusing resolveBenchOverlap
  instrumentDisplay  measurement-neutral display text (section 2.4)

Presentation (new)
  bench/    BenchEngine (three.js): look, models, liquids, displays, input, animation
  player/   Player3D: step panel with the accessible action flow, input fields, notebook, results, modes
  studio/   Studio3D: library, React Flow canvas (7 node types), inspector, preview dock, setup forms

Assets (new)
  tools/blender                     procedural library, per-definition modules, export, thumbnails, validator
  public/assets/equipment-3d/v1     <definitionId>.glb, <definitionId>.meta.json, thumbs/<definitionId>.png
  src/studio3d/equipment3d/registry.json
```

Rule: new behaviour goes into adapters or presentation. A needed core change goes through a separate, reviewed change with its own narrow test. Section 7 lists the ones foreseen.

### 4.2 Module layout

```
src/studio3d/
  Studio3DApp.tsx, routes3d.ts         #/3d, #/3d/studio, #/3d/technique/:id, #/3d/play/:labId
  equipment3d/  registry.json, types.ts, loadModels.ts (GLTFLoader + MeshoptDecoder), readiness.ts
  adapters/     benchCoordinates.ts, runtimeToScene.ts, sceneToIntent.ts, footprints.ts, instrumentDisplay.ts
  bench/        BenchEngine.ts, BenchView.tsx
                look/   environment.ts, textures.ts, materials.ts, contactShadows.ts, composer.ts
                scene/  placement.ts, attachments.ts, contents.ts, displays.ts, scenery.ts (D9)
                input/  pointer.ts, dragLift.ts, pour.ts, targetResolver.ts, keyboard.ts
  player/       Player3D.tsx, StepPanel.tsx (accessible action flow), InputField.tsx, NotebookDrawer.tsx,
                CalculationCard.tsx, FeedbackToast.tsx, ResultsSheet.tsx, EquipmentTray.tsx, SetupGate.tsx
  studio/       Studio3D.tsx, LibraryPanel.tsx, FlowCanvas.tsx, nodes/<type>.tsx, edges/*.tsx,
                inspector/*.tsx, PreviewDock.tsx, setup/*.tsx
  styles/       tokens.css, studio3d.css
src/player/gesture/bridge/   (D6) extracted input-agnostic bridge + DOM resolver, shared by both players
tools/blender/
  labeq/        geometry, markings, uv, materials, anchors, export, render
  equipment/    one module per definition id (parametric where sizes vary)
  build_equipment3d.py, pack_models.py, validate_equipment3d.py, inventory_pack.ts (section 9, step 1)
```

### 4.3 The `equipment3d` registry contract

Each entry is keyed by the existing definition id. Anchors are keyed by semantic zone ids from `v1InteractionZones`, so nothing is renamed. The numbers below are illustrative:

```json
{
  "definitionId": "graduated-cylinder",
  "model": "graduated-cylinder.glb",
  "thumbnail": "thumbs/graduated-cylinder.png",
  "footprintMm": { "shape": "circle", "radius": 32 },
  "grip": { "heightMm": 150 },
  "pour": { "lipMm": [-12, 0, 262], "tiltDeg": 70 },
  "fill": { "innerProfileMm": [[0, 4.0], [11.8, 4.0], [11.8, 250.0]], "capacityMl": 100, "meniscus": "concave" },
  "graduations": { "unit": "mL", "minor": 1, "major": 10 },
  "anchors": {},
  "displays": [],
  "states": {},
  "provenance": { "blender": "5.2.2", "generator": "tools/blender/equipment/graduated_cylinder.py", "sourceHash": "…" }
}
```

- Instruments add `displays`: a display surface plus the `instrumentDisplay` policy id that decides what it may show.
- Zone owners add `anchors` keyed by zone id, for example `analytical-balance-pan`, `spectrophotometer-cuvette-slot` and `volumetric-flask-stopper-seat`.
- Stoppered or lidded items add `states`.

### 4.4 Runtime-to-scene rules

| Runtime fact | Scene result |
|---|---|
| `location: shelf` | Not on the bench; shown in the equipment tray, as the 2D shelf shows it. |
| `location: storage` | Not shown, as in the 2D player. |
| `location: workbench` with `x`, `y`, `rotation` | Placed through `benchCoordinates`. Runtime units are never rewritten, so states from the 2D player load unchanged. |
| `location: snapZone`, or an `AttachmentRelation` | Child placed at the parent's anchor for that zone; `renderMode` decides whether the child is drawn on its own or as part of a parent state. |
| `location: oven` | Inside the oven model (Pack 2). Not used in Pack 1. |
| `ContentState` | Level from the 3D fill profile; colour and style from `resolveLiquidStyle`; powder when solid; no contents means nothing is drawn. |
| Photometer calibration state, configured values, learner entries | `instrumentDisplay` only (section 2.4). |
| Animation | Depicts an action the runtime has already committed. The resting scene always equals runtime state. |

### 4.5 Scene-to-intent rules

The step panel shows the current action's input field first, as the 2D player does. The gesture then produces an intent into which `sceneToIntent` merges the validated input (value, note, `configurationApproved`, configured parameter), mirroring `runIntent`.

| Interaction | Gesture | Intent |
|---|---|---|
| `dragToZone` | Drag from the tray or bench onto the bench | `placeIntent` (bench-unit `x` and `y`) |
| `snapIntoTarget` | Drag over the target zone anchor; release | `snapIntent` (target and zone id) |
| `pourInto` | Drag the source over the target, which tilts at its pour lip; release | `pourIntent`, carrying a value **only** from the input field |
| `readInstrument` / `placeInInstrument` | Activate the instrument or its control | `instrumentReadIntent` |
| `recordNotebook` | Notebook entry | `notebookRecordIntent` |
| `submitCalculation` | Calculation card | `calculationSubmitIntent` |
| Free bench move (any step) | Drag a bench item, or a tray item the step does not expect, to a free spot | Not an intent: a direct `place` request with `parameters.benchMove: true` and bench-unit `x`, `y` and `zIndex`, exactly as the 2D `movePlacedEquipment` and `moveEquipmentToBench` do. It is never an assessment failure. |

- **Release order.** A release resolves in the 2D order (`Workbench.finishMove`):
  1. the expected drag-to-zone station;
  2. a valid overlap (interaction intent);
  3. an invalid overlap (refusal, which counts as an assessment failure);
  4. a free bench move.
  
  After a completed interaction the source is parked with a bench move, except after snaps and instrument reads. Probes never free-move. `UI_UX_HANDOFF.md` section 5.6 specifies the presentation.
- Refusals show the runtime's message and recovery, call `recordAssessmentFailure` (so they count in assessment mode), and change nothing.
- During the Studio's guided rehearsal, intents go through the rehearsal bridge, as today.
- Nothing is committed while a drag is in progress.

### 4.6 Studio 3D against the existing mechanism

| Studio 3D UI | Existing mechanism |
|---|---|
| New technique / open a published technique for editing | `createBlankStudioTechniqueLab` / `labDraftFromTechnique` + `replaceDraft`, artifact kind `technique`. Export needs D10. |
| Add a published technique as a workflow (library card) | `loadBundledTechnique` + `appendConfiguredWorkflow` (or `appendTechnique`); the dialog uses the configuration blockers. `measuring-volume` shows its host-bound blocker. |
| Insert a step template | `appendTemplateStep` with `{ anchorNodeId, placement }` |
| Draw an edge between handles; edit its condition | `addBranchEdge`; `updateProcessEdge` (new UI, existing operations) |
| Retry loop; start step; delete step; layout | `addRetryEdge`; `setStartNode`; `removeProcessNode`; `updateProcessNode` / `autoLayoutProcess` |
| Inspector (step, action, validation) | `updateProcessNode`, `updateAction`, `replaceNodeValidation` |
| Equipment; settings; configure a workflow | the equipment operations; `updateLabSettings` / `updateTechniqueSettings`; `configureWorkflow` |
| Undo and redo | the same snapshot approach `TeacherStudio` uses |
| Readiness; import and export | `studioReadiness` / `studioValidation`; `importExport` / `serializeStudioArtifact` |
| Preview at a step | Player3D with `focusNodeId` / `focusVersion` |
| Compiled experiment opened then edited | Shows the "detached" state honestly, as today |
| Composition-source authoring (D8 b) | **New operations**, a Phase B core change |

Deferred to later: the WebMCP Experiment Composer, guided-rehearsal authoring and the Protocol Check stay in the original Studio. Studio 3D links to it for them.

### 4.7 Shared-shell and core edits (the complete foreseen list)

| Change | Kind | Milestone |
|---|---|---|
| `routes.ts` / `App.tsx`: the `#/3d…` routes | Shell | M0 |
| `platform/featureFlags.ts`: `studio3dV1` | Shell | M0 |
| Studio 3D persistence under its own key (`lab-studio:3d:v1:draft`), through a key parameter or a thin wrapper around `persistence.ts` | Shell | M6 |
| D10: `deriveTechniqueFromLabDraft` keeps `composition` | Core, reviewed | M6 |
| D6: gesture bridge extraction, no change in 2D behaviour | Player refactor, reviewed | M7 |
| D8 (b): composition-source authoring operations | Core, reviewed | Phase B |

## 5. UI/UX redesign

Scope is laptop, tablet and larger screens. The design is agreed in M0 as mock-ups, before building.

The detailed specification is in **`UI_UX_HANDOFF.md`**, in this folder. It covers:
- design tokens;
- the Studio 3D layout, which takes the clarity of `Lab_Studio_Photoreal_Bench`;
- the Player3D layout, which takes the beauty and functionality of `microarray-3d-v3`, including moving objects freely;
- the M0 mock-up list and the UI decisions U1–U8.

That handoff governs look and interaction. This plan governs fidelity and architecture. The sections below are its summary.

### 5.1 Studio 3D

- **Mode switch** between Technique and Experiment, following the artifact kinds.
- **Library.** Published techniques as cards with Blender thumbnails and a status:
  - 3D-ready;
  - needs setup;
  - host-bound, with a link to its host experiment;
  - not yet in 3D.
  
  Step templates are grouped by verb, and the equipment list is searchable.
- **Flow canvas.** React Flow with a custom component for each of the seven node types. Each node shows its verb icon, the acting equipment's thumbnail, validation and evidence chips, and a hint marker. The canvas also has:
  - technique instances as grouped subflows showing their entry and exit ports;
  - edges styled by condition;
  - a minimap, keyboard navigation and a read-only mode.
- **Inspector.** Tabs for Step, Action and interaction, Validation (seven rule types), Evidence, Equipment roles and Configuration. The equipment view shows the 3D model, its zones and its capacities, read-only.
- **Preview dock.** Player3D running the draft; selecting a node starts the preview at that step. Readiness diagnostics sit alongside.
- **Setup forms.** Re-implemented against the same logic (`configurationSlots`, `applyTechniqueConfiguration`, the blockers, teacher approval), following the newer `TeacherSetupLayout` pattern.

### 5.2 Player3D

- **Bench:** most of the screen. Equipment tray; contact shadows; right-drag to orbit, wheel to zoom, "Reset view".
- **Step panel:** instruction, input field (teacher configuration or learner observation, labelled as in the source), and the **accessible action flow** (resolved Source, Target and Confirm, with the same enabling rules as `ProcessSidebar`). It also shows progress and evidence chips.
- **Setup gate:** the same standalone setup and blocker behaviour as the `#/technique/:id` route.
- **Modes:** guided and assessment, with failed attempts recorded.
- **Close-up view:** a zoomed, well-lit view of a meniscus or instrument panel. It shows the instrument's permitted state (section 2.4), never an invented reading.
- **Notebook, calculation cards and results** follow the existing contracts.

### 5.3 Accessibility

- Every step can be completed from the step panel without the 3D canvas, which matches the existing accessible action flow. Arrow-key nudging works on a focused bench.
- The bench provides a live text description of the scene.
- Reduced motion skips pour and tilt animations.
- Camera gestures work through the shared bridge (D6).

## 6. Blender equipment pipeline

### 6.1 Library

Port the prototype's procedural library into `tools/blender/labeq`. It includes:
- lathe and fillet profiles, bevel cuts, and markings wrapped onto curved surfaces;
- frosted writing spots and physical-unit UVs;
- thin versus thick glass material slots;
- the plastic, metal, coating and paper materials;
- the thumbnail rendering.

Each definition gets one module (parametric where only sizes differ) that returns its model, zone anchors, fill profile, displays and states.

### 6.2 Realism standard

- **Glass:** real wall thickness, fire-polished beads, thin and thick slots, enamel markings that follow the curved surface, frosted writing spots where the real item has them.
- **LDPE:** hollow, so its contents show through it.
- **Metals and coatings:** from tileable textures on physical-unit UVs.
- **Viewer lighting:** bright sources near bench height, contact shadows, Khronos PBR Neutral tone mapping, no bloom.
- **Known three.js traps:** glass must be front-sided and must not write depth; `gltfpack` must keep float positions. See Appendix A for why.
- **Physical plausibility never creates runtime objects** (D9). Anything added only for looks, such as a rack, is marked as scenery.

### 6.3 Outputs, budgets and provenance

- **Compression and loading:** GLBs are compressed with `gltfpack -cc -kn -km -kv -vn 12 -vtf -vpf`. `gltfpack` is added as a devDependency, unpinned per `AGENTS.md`. Models are decoded by three.js's bundled MeshoptDecoder, offline and without workers.
- **Size budget:** about 250 KB per ordinary item and 600 KB per instrument, and about 4 MB for all of Pack 1.
- **Thumbnails:** PNGs rendered in Cycles. SVG wrappers are needed only if a thumbnail is placed under `equipment-realistic/v1`, where the existing asset rules apply.
- **Provenance:** each `meta.json` records the Blender version (5.2.2 today; the 4.5 install is gone) and the generator path and hash. Any bench background image carries recorded provenance. The prototype's photograph is adapted AI concept imagery and must not be reused without saying so.
- **Font licence:** check the licence of the font used for baked markings.

### 6.4 Static validator (`validate_equipment3d.py`)

- Every definition used by the pack has a registry entry, GLB, meta and thumbnail.
- Every semantic zone the pack's equipment owns has an anchor.
- Each fill profile holds at least the catalog capacity, and graduations match capacity and precision.
- Every display declares a policy.
- Material names belong to the viewer's set.
- Sizes are within budget, and positions are float.

## 7. Milestones for Pack 1

Each milestone has two exits. The **static exit** is always performed: source review, typecheck, validators, and narrow tests written but not run. The **authorised exit** needs your go-ahead under a gate from section 10.

| M | Work | Static exit | Authorised exit |
|---|---|---|---|
| M0 | **Reconciliation gate** for the section 2.8 files, with a decision per file and the agreed core baseline recorded. Also: shell hooks (routes and flag, section 4.7); design mock-ups; a Pack 1 inventory script (section 9, step 1) run against the reconciled baseline. | Decisions and baseline recorded; mock-ups approved; typecheck passes with the flag on and off. | none |
| M1 | Blender library, registry schema, build, pack and validate tools; a proposed `AGENTS.md` section for 3D assets. | Wash bottle rebuilt through the pipeline, matching the prototype; validator passes. | none |
| M2 | The 13 remaining Pack 1 models, zone anchors, fill profiles, measurement-neutral displays, states, and D9 scenery. | Validator passes; Cycles review renders inspected (item and composite states). | none |
| M3 | `BenchEngine` and look layer; `runtimeToScene`, `benchCoordinates` and `instrumentDisplay` adapters. Starts after M0's baseline. | Adapter tests for each technique's initial and final state; display-policy tests. | G1: visual check |
| M4 | Interactions and `sceneToIntent` (input merge, refusals, assessment failures); `footprints`; keyboard path. | Intent-mapping tests for all six handlers; source review against `runIntent`. | G1 |
| M5 | Player3D with setup gate, modes, step panel and accessible flow; WebGL fallback by navigation. | Four standalone techniques wired; `measuring-volume` shows its host-bound guidance, as the 2D route does. | G1: playthroughs |
| M6 | Studio 3D: technique and experiment modes over the existing mechanism (section 4.6); separate persistence key; D10 core fix. | Operation-mapping review; export round-trip test keeps `composition`; import and export parity with the original Studio. | G1 |
| M7 | D6 bridge extraction (no 2D behaviour change) and the raycast resolver; `AGENTS.md` gesture section corrected. | Bridge unit tests; 2D selectors and rules unchanged by review. | G3: webcam |
| M8 | Pack 1 acceptance. | Typecheck; validators; content parity of Pack 1 JSON and its generator against the reconciled baseline; `content:check` compared to baseline; budgets; evidence note. | G1 and G2 as authorised |

Dependencies:
- M0 comes first;
- M1 and M2 can start at once, since they don't depend on the core baseline;
- M3 and M4 wait for M0's reconciliation;
- M5 follows M4;
- M6 can start after M3;
- M7 can run in parallel after M0;
- M8 comes last.

## 8. Phase B: experiments

| E | Work | Exit |
|---|---|---|
| E0 | Design for D8 (b): how the Studio authors `techniqueInstances`, equipment `bindings` (role → shared instance), configuration and `compositionConnections`, then compiles through the same path as `loadBundledLab` (`compileBundledLabCompositionWithPolicy`) and shows its findings. Instances in this mode are configured, bound and connected, not edited inside; editing inside detaches, as today. | Design approved; new operations specified as a core change. |
| E1 | Implement the E0 operations and the Studio 3D experiment builder: subflows with ports, 3D equipment pickers for role binding, connection drawing. | Operation tests; a draft compiled from Pack 1 techniques produces a compiled manifest. |
| E2 | Readiness gate. It checks that every technique is 3D-ready (necessary), and handles lab setup forms, custom routes, specialised models and lab-level equipment (sufficient). | Gate matches section 2.7, including its caveats. |
| E3 | `intro-filtration-demo` in 3D after Pack 2 (adds `funnel-stand`). `measuring-volume` becomes playable here. | Same evidence and completion as the 2D route (static exit plus G1). |
| E4 | Custom-route experiments (`green-chemistry-mixture-purification`, `acid-base-titration-curves`) and specialised hosts, each with a documented 3D route. They are never flattened into generic composition. | Per pack. |

A new experiment built only from Pack 1 techniques would be a Studio-authored draft: through (a) now, or (b) after E1. It is not new published content.

## 9. The repeatable technique-pack recipe

1. **Inventory by evaluation, not by reading JSON.** `inventory_pack.ts` runs the core functions (`resolveActionInteraction`, both configuration blockers, `configurationSlots`, `hostLabsForTechnique`, zone lookup) and reads the input roles and volume and mass contracts. It reports interactions, blockers, value sources (section 2.4), zones, visual states and host labs.
2. **Gap analysis** against the registry, interaction handlers, display policies and scenery.
3. **Equipment** (section 6) with review renders.
4. **Interactions.** Pack 2 adds `rinseTarget` (the `rinse` verb) and `placeInInstrument` (`dry`, `heat` and `cool`, and the `oven` location). Later packs add `dispenseDrops`, `spotOnto` and `recordTimeSeries`, and titration packs add the pH meter's simulator readout.
5. **Visual states** from `ContentState` through the existing registries only.
6. **Studio** library entries, node icons, setup forms and host presentation.
7. **Readiness**, then recompute the experiments in section 2.7.
8. **Acceptance** as in M8.

## 10. Validation and evidence

- **Default:** source review, `npm run typecheck`, the equipment validator and content parity. Adding a real linter (ESLint) would be a separate dependency decision for you.
- **`content:check`:** compared against its recorded baseline (exit 1, 21 documented limitations), never treated as pass/fail on its own.
- **Tests:** narrow tests are written for adapters, the registry, the operation mapping, D10 and the gesture bridge. They are run only if you authorise it.
- **Authorisation gates:**
  - G1: browser playthroughs, each technique's happy path plus one refusal and recovery;
  - G2: performance on a classroom laptop;
  - G3: real-webcam gestures;
  - G4: any publishing or deployment.
- **Evidence note** per milestone, recording the exact commit, what was checked, and what was intentionally not run.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The core baseline is ambiguous (section 2.8); the seam itself differs between lines | M0 reconciliation gate before adapter work |
| A 3D view invents readings or state the runtime lacks | Measurement-neutral displays (D7), value-source table, resting scene equals runtime state, display-policy tests |
| `measuring-volume` expectations | Host-bound behaviour shown as the 2D route shows it; playable after Pack 2 through its host experiment |
| Studio "experiments" are misread as compiled | D8 made explicit; the "detached" state shown honestly |
| Techniques edited in the Studio lose composition | D10 fix with a round-trip test |
| Gesture bridge extraction regresses the 2D player | Behaviour-preserving extraction, bridge tests, review of the 2D selectors, G3 only with your authorisation |
| 2D pixel coordinates versus 3D placement | Runtime units untouched; conversion only in `benchCoordinates` and `footprints`; `targetX` and `targetY` parameters treated as bench units |
| Two Studios overwrite each other's drafts | Separate persistence key; explicit import and export between them |
| Physical-plausibility additions become runtime objects | Scenery is marked visual-only (D9) |
| Weak GPUs | Render on demand, quality tiers, fallback by navigation |
| Asset scope grows | Registry-driven gap analysis; parametric modules |
| Licences and provenance | Font check; background provenance; three.js and meshoptimizer are MIT licensed |

## 12. Carry-over from the prototypes (reference only)

These are not imported as accepted UI:
- **Blender generator:** `virtual_lab\...\blender-equipment\build_equipment.py`, with the beaker, Erlenmeyer, funnel, filter paper, ring stand and wash bottle.
- **Live 3D demo:** `Lab_studio\v2\Lab_Studio_Opus55_Blender_3D_Filtration_Demo`, containing `source/look.js`, `source/main.js` (drag with lift, tilted-liquid caps) and `source/pack_models.py`.
- **2.5D sprite demo:** `Lab_studio\v2\Lab_Studio_Opus55_Blender_Sprites_Filtration_Demo`.

Two prototype conventions must **not** carry over:
- its "select, target, confirm" pattern: Lab Studio has its own accessible action flow;
- its readout-style instrument displays, which conflict with section 2.4.

## 13. Decisions for you

1. **D1 baseline.** Reconcile the authoritative working copy with main for the section 2.8 files before adapter work (recommended)? Or pick one line as the core as it stands?
2. **D8 experiments.** Build composition-source authoring (compiled, shared equipment) as Phase B's centre (recommended)? Or keep only today's flattening append?
3. **D9 test tube.** Visual-only rack scenery (recommended), a content change adding a rack, or a tube lying down?
4. **Pack grouping.** Catalog order (Pack 2 unlocks `intro-filtration-demo`), or group by the experiments you want first?
5. **Visual direction.** Any constraints for the redesign, or should M0 propose them?
6. **Gates.** Which of G1–G3 to exercise at Pack 1 acceptance. Also, whether to add a real linter.
7. **UI decisions U1–U8.** Font, design system, the Studio's Starting bench view, weighing display wording, returning items to the tray, turning items, assessment ring state and run resume. See `UI_UX_HANDOFF.md` section 11.

## Appendix A. Fidelity review log (revision 1 → revision 2)

| # | Revision 1 claim | Finding (evidence) | Change |
|---|---|---|---|
| 1 | "A student can play each one in the 3D Player" | `measuring-volume` is host-bound. `standaloneTechniqueConfigurationBlocker` and `compositionTechniqueConfigurationBlocker` both refuse it (evaluated with the real functions; `techniqueHosts.ts`: `intro-filtration-demo`, `hard-water-demo`). `App.tsx` shows a "composed setup required" page. | Four standalone; `measuring-volume` through its host experiments (sections 1, 2.6, M5, E3). |
| 2 | Balance "live display (mass to 0.001 g)"; photometer "live display (%T…)" | Balance mass and %T are `studentResponse` inputs ("Enter the finite non-negative mass displayed by the balance", `reducer.ts` around line 2170; the transmittance read action's `inputLabel`). The only simulator readout is the pH meter (`instrumentReadout`, `provenance: "simulator-generated"`, `types.ts` around line 314). | Measurement-neutral displays (section 2.4, D7). |
| 3 | "Student reads the meniscus in the loupe and enters it" | `measuring-volume` has no input; the runtime pours the configured target and would record `request.value` if one were sent (`reducer.ts`, `measureVolume` pour branch). Transmittance aliquots are `teacherConfiguration` inputs. | Values come only from input fields; the close-up view shows state (sections 2.4, 4.5). |
| 4 | Studio experiments "compile with `compileLabComposition`… same result as the original Studio" | The Studio flattens (`appendTechniqueToDraft`: prefixed copies, separate equipment, one connector). Compilation happens only for bundled composition sources in `loadBundledLab` → `compileBundledLabCompositionWithPolicy`. Edits detach compiled manifests (`markCompositionDetached`). | Two paths described (section 2.2); D8; E0 and E1. |
| 5 | (not addressed) | `deriveTechniqueFromLabDraft` drops `composition`; `serializeTechnique` serializes what it is given. | D10 core fix (M6). |
| 6 | "Undo/redo can be built on the transaction history" | Undo and redo already exist in `TeacherStudio.tsx` as snapshot stacks. | Reuse the approach (section 4.6). |
| 7 | "select an item, choose a target, confirm (the existing inspector pattern)" | That was the prototype's pattern. Lab Studio's is `ProcessSidebar`'s "Accessible action flow", with the `confirm-accessible-action` button and its enabling rules. | Section 5.2 corrected; the prototype pattern excluded (section 12). |
| 8 | (not addressed) | Refusals call `recordAssessmentFailure`; `RuntimeMode` is `guided` or `assessment`; the rehearsal bridge exists. | Modes and failure recording in sections 4.5 and 5.2. |
| 9 | Node types "include action and observation" | There are seven node types and seven validation types (`types.ts`, lines 47–93). | Section 2.1; custom node per type. |
| 10 | Locations `shelf` and `workbench` only | `EquipmentLocation` also includes `snapZone`, `oven` and `storage`. | Section 4.4. |
| 11 | "Bench coordinates are 2D bench units" (vague); reuse of snap alignment | Coordinates are 2D pixel units (`benchPointForIndex`, `getBenchSize`); snap alignment works on 2D art. The semantic `v1InteractionZones` are what the runtime uses. | Anchors keyed by semantic zone id; only overlap classification reused. |
| 12 | Colour "from the visual-state and solute registries" | The single palette is `resolveLiquidStyle` over `visualStateRegistry.json`, and a second palette is explicitly forbidden. | Named in sections 2.5 and 4.4. |
| 13 | "Add a pluggable target resolver" to the shared gesture bridge | The bridge is embedded in `StudentPlayer.tsx`; only the engine is modular. `AGENTS.md` thresholds are stale (source: 0.3/0.5, 160 ms). | D6 extraction as a reviewed refactor; `AGENTS.md` correction (M7). |
| 14 | Validation "tsc, lint" | There is no lint script or ESLint. `content:check` exits 1 on its baseline. | Section 2.9, section 10, and a linter decision (question 6). |
| 15 | Studio library "technique cards" for Pack 1 | Only `transmittance-dilution` is a workflow template; the other four exist only as generic step templates. | Library built from `loadBundledTechnique`, with the blockers shown (section 4.6). |
| 16 | "Pack 1 JSON byte-identical to baseline" | `transmittance-dilution.json` and its generator differ between the two lines. | Parity is measured against the **reconciled** baseline (D1, M0, M8). |
| 17 | Reconciliation "some files in mass and photometry contracts" | The seam itself (`interactionIntents.ts`), plus the reducer, catalog, types and Studio state, differ. The core setup files are untracked in the working copy. | Precise list (section 2.8); a hard gate before M3 and M4. |
| 18 | D3 fallback "to the existing 2D Student Player" versus "never imports old UI" | These contradicted each other. | Fallback by navigation (D3). |
| 19 | Studio persistence not considered | There is a single key, `lab-studio:v1:draft`. | Separate key (section 4.7). |
| 20 | "Experiments unlocked" read as sufficient | Setup forms, custom routes (two experiments), specialised models and lab-level equipment also matter; `intro-filtration-demo` needs `funnel-stand`. | "Necessary, not sufficient" (sections 2.7 and E2). |
| 21 | Weighing shown on the pan | `weigh` neither attaches nor moves the vessel. | Resting scene equals runtime state (section 2.4, item 3). |
| 22 | (not addressed) | A 2D test tube stands unsupported; Pack 1 has no rack; sample-rack zones exist. | D9. |
| 23 | Blender version unspecified | The 4.5 install was replaced by 5.2.2 during this work. | Version and generator hash recorded per asset (section 6.3). |
| 24 | "Pack 2 adds only derived paths" (already fixed at the end of revision 1) | `rinse` → `rinseTarget`; `dry`, `heat` and `cool` → `placeInInstrument`. | Kept in section 9. |
| 25 | (revision 2) "`shelf` or `storage`: shown in the equipment tray" | The 2D shelf counts only `location === "shelf"` (`StudentPlayer.tsx:527–544`). The bench shows `workbench` and `snapZone` (`equipmentLocations.ts:3–4`). `storage` is hidden. | Section 4.4 split into two rows (revision 2.1). |
| 26 | (revision 2) Scene-to-intent rules covered step interactions only | The 2D player moves bench items freely with a direct `place` request carrying `benchMove: true` (`StudentPlayer.tsx:864–942`). The reducer handles it before step checks: it detaches from holders, moves locked children and refuses closed chambers (`reducer.ts:7176–7223`). Releases resolve in a fixed order (`Workbench.tsx:676–741`). | Free-move row and release order added to section 4.5 (revision 2.1); presentation in `UI_UX_HANDOFF.md` section 5.6. |
