# M6 evidence note: Studio 3D

Branch `claude/lab-studio-3d`. Plan §7 row M6: "Studio 3D: technique and experiment modes over the
existing mechanism (section 4.6); separate persistence key; D10 core fix." Exit: operation-mapping
review; export round-trip test keeps `composition`; import and export parity with the original
Studio.

## Core and shell changes (plan §4.7), one commit, reviewed here

| Change | Where | What it does |
|---|---|---|
| D10 | `src/studio/studioArtifact.ts` `deriveTechniqueFromLabDraft` | Carries `techniques[0].composition` into the exported technique, as authored; `validateTechniqueDefinition` checks it against the edited graph. |
| D10 (same defect) | `src/studio/studioTransactions.ts` `firstTechniqueForDraft` | Keeps `composition` when `updateTechniqueSettings` rebuilds the technique, so a settings edit cannot drop it before export. |
| Persistence key | `src/studio/persistence.ts` | `saveDraft`, `loadDraftArtifact`, `loadDraft`, `clearDraft` take an optional key. Every existing caller omits it and keeps `lab-studio:v1:draft`; Studio 3D uses `lab-studio:3d:v1:draft`. |

Narrow test, written and not run: `src/studio/__tests__/techniqueExportComposition.test.ts`, which covers:
- the round trip through open-for-editing, `serializeStudioArtifact` and `parseImportedJson`;
- a settings edit;
- a technique with no contract;
- key isolation.

## What M6 delivers (`src/studio3d/studio/`)

| Handoff | Piece |
|---|---|
| §4.1–4.2 frame, top bar, heading | `Studio3D.tsx`: 60 / 88 / 1fr / 28 rows, 248 · 1fr · 320 columns. Top bar right: save status, readiness chip (opens Checks), Preview, Export, help, overflow (Import, Open in the original Studio…, Keyboard shortcuts). Heading: kind eyebrow, inline-edited title, status pill, learning goal, Open… and New ▾. |
| §4.3 library | `LibraryPanel.tsx`, `techniqueCatalog.ts`. Techniques (experiment drafts only), Steps and Equipment. Search, drag, and click or Enter to add, with a "+" corner on hover. The footer tip changes with the stage view. |
| §4.4 Flow | `FlowView.tsx`, `flowModel.ts`. Custom node cards for the seven types and condition-styled edges with glyphs (see below). |
| §4.5 Starting bench | `BenchSetupView.tsx`. The real 3D bench, drawn from `createRuntimeState` (see below). |
| §4.6 Preview | `PreviewView.tsx`. Player3D in preview chrome with `focusNodeId` / `focusVersion` (see below). |
| §4.7 inspector | `Inspector.tsx`, `SetupSlotsForm.tsx`. Selected, Setup and Checks tabs (see below). Text fields commit once, when they are left. |
| §4.8 dialogs | `StudioDialogs.tsx`, `EquipmentTurntable.tsx` (see below). |
| §4.9 keyboard | Flow: arrows travel along connections; Shift+arrows nudge 8 px (1 px with Alt); Enter; C; Delete with an undo toast; Home and F; Esc; Space+drag pans. Bench: arrows move 10 mm, Shift 50 mm; Enter; Delete; Home and F. Undo and redo everywhere except in text fields. |
| §4.10 widths | 1280–1439: 224 · 1fr · 296. 1024–1279: a 56 px library rail with a flyout from the top-bar button. 768–1023: the library as a drawer and the inspector as a bottom sheet at 40 % of the height. |
| §3.8 storage | The draft under `lab-studio:3d:v1:draft`, and the stage view under `lab-studio:3d:v1:studio-ui`. Every read and write is wrapped. |

More detail on the larger pieces:

- **Library cards.**
  - A technique card shows its status: `3D-ready`, `Needs setup`, `Host-bound` (with host links) or `Not yet in 3D`.
  - Step templates are the generic blueprints (plan §2.1), grouped by the interaction their verb derives.
  - Equipment cards show capacity and precision under U9, and a `3D` or `2D only` chip.
- **Flow.**
  - Node cards carry the START flag, an issue badge with a terracotta rule, a hint marker, up to three thumbnails then "+n", the input-role provenance chip, validation-type and evidence chips, and labelled out-handles on decision nodes.
  - Edges are styled by condition, with glyphs; the label shows on hover or selection.
  - A library step dragged over an edge lights it with a "+" marker and a callout, and inserts there.
  - Connect mode, or dragging from a handle, opens a Branch or Retry menu.
  - The dark toolbar has Select/Connect, Snap to grid (Alt bypasses it), Auto-layout, Minimap, Details, zoom and Fit.
  - Also: the empty state, the read-only banner with "Edit a copy", the detached banner, and flattened-experiment group frames.
- **Starting bench.**
  - It is drawn from `createRuntimeState`, so it shows what the learner starts with, including the shelf items the runtime adds for required equipment.
  - Items can be dragged on the bench and between the bench and the shelf strip, dropped from the library, and nudged.
  - Toolbar: Arrange, Snap to zones, Labels, Front, Top and Reset.
  - The inspector shows the equipment view, or "On the bench / On the shelf" when nothing is selected.
- **Preview.**
  - Player3D runs in preview chrome, with `focusNodeId` / `focusVersion`.
  - Toolbar: Restart, Guided/Assessment, ◂ Step ▸, and Open full player (the stage expands to the full window).
  - It shows the 2D preview notice, and says so when the draft is not runnable or not 3D-ready.
- **Inspector tabs.**
  - **Selected:** Step, Action & interaction ("derived from the verb" when not authored), Validation (the seven rule types), Evidence, Connections, "Preview from here" and "Delete step". An edge shows its source, target, condition, label and Delete. Equipment shows its own view.
  - **Setup:** settings, configuration with approval, equipment roles, required equipment, and the composition contract (read-only, with the D10 note).
  - **Checks:** blockers, warnings and notes linking to their steps; 3D readiness; activity; save and open.
  - The footer carries the last change, undo and redo on every tab.
- **Dialogs.**
  - Configure before append, with the host-bound blocker verbatim and "Add workflow" disabled until the form is valid.
  - Open (published techniques by pack), import errors, "Open in the original Studio", and help with the keyboard map.
  - Equipment inspection: a turntable of the model, its zones and capacities, and its provenance.

## Operation-mapping review (plan §4.6)

Every edit is one `commitStudioTransaction`, labelled for the activity list (handoff §4.4: one change, one transaction).

| Studio 3D gesture | Operation |
|---|---|
| New technique or experiment | `replaceDraft` (`createBlankStudioTechniqueLab` / `createBlankStudioLab`); the kind is set, never flipped in place |
| Open a published technique | `replaceDraft(labDraftFromTechnique)`, read-only until "Edit a copy" (`replaceDraft` with `-copy` id and title) |
| Library step: click, Enter, drop on the canvas | `appendTemplateStep` after the selected step, or appended |
| Library step dropped on an edge | `appendTemplateStep { anchorNodeId: edge.from, placement: "after" }` |
| Technique card | `appendConfiguredWorkflow` through the configure dialog (blockers, approval) |
| Drag a node / Shift+arrows | `updateProcessNode` with the new layout |
| Branch | `addBranchEdge` |
| Retry to the same step | `addRetryEdge` |
| Retry to another step | `addBranchEdge` + `updateProcessEdge` (condition `retry`), one transaction; `addRetryEdge` only makes a self-loop |
| Edge condition, label, ends | `updateProcessEdge` |
| Delete a connection | `replaceDraft` with the edge removed, marked detached with `markCompositionDetached`. There is no edge-removal operation; this is the original Studio's draft-updater path. |
| Set as start; delete step; auto-layout | `setStartNode`; `removeProcessNode`; `autoLayoutProcess` |
| Step fields; action label and evidence; validation | `updateProcessNode`; `updateAction`; `replaceNodeValidation` |
| Title; settings; tags | `updateLabSettings`; `updateTechniqueSettings` |
| Configure a workflow | `configureWorkflow` |
| Required equipment | `addEquipment`, `removeEquipment` |
| Starting bench: place, move, shelf, seat, nudge | `upsertInitialEquipment` (location `workbench`, `shelf` or `snapZone`; `x`/`y` through `benchCoordinates.fromBench`) |
| Remove from the starting setup | `removeInitialEquipment` |
| Import | `replaceDraft` from `parseImportedJson` (a technique opens through `labDraftFromTechnique`) |
| Undo / redo | the `TeacherStudio` snapshot stacks |

Import and export use the original Studio's own functions (`parseImportedJson`,
`serializeStudioArtifact`, `studioArtifactFilename`, `downloadJson`), so parity holds by
construction. With D10, a technique exported from either Studio keeps its contract.

## Decisions and verifications made in M6

- **Seated starting items (§4.5, U3).** Verified from source that the runtime builds the relation
  from a starting instance: `createRuntime.ts:97` calls `deriveLegacyAttachments(equipmentInstances)`,
  which seats a `snapZone` instance on the **first** instance of the zone's owner. Zone drops are
  therefore enabled, but only when the owner is on the bench exactly once, so the result is never
  ambiguous. Test written: `studio3d.test.ts` ("is honoured by the runtime").
- **Flow layout units.** Stored layouts stay in the original Studio's units (its 230 × 128 grid).
  The Flow view draws them scaled (× 1.3, × 1.7) to fit 232 px cards and divides back on commit,
  as bench positions stay in 2D units.
- **Status pill.** "3D-ready" is shown only when the draft is runnable; otherwise the Studio's own
  readiness label. "Needs setup" counts classroom values only: derived record names are never asked
  for, as the 2D setup treats them.
- **"Open full player".** Drafts have no player route, so it expands the stage to the full window
  (Esc returns).
- **Starting contents** (decided 2026-09-24, option b). The bench shows a read-only summary with
  a swatch in the palette colour. The equipment inspector's "Starting contents" section offers the
  original Studio's fields: contents kind, label, volume mL, mass g, temperature °C, wet state, and
  the advanced raw equipment JSON with `TeacherStudio`'s merge rule. Each field commits one
  `upsertInitialEquipment`; TeacherStudio's `updateContents` is copied as written. A runtime-added
  item joins the starting setup when its contents are edited. Checked in the browser: the wash
  bottle's 500 mL changed to 250 mL as one transaction, the summary followed, and undo restored it.

## Spot check (built-in browser, 1440 × 900, one look)

You asked to see the Studio, so a spot check was taken under the M3–M5 terms.
- **Empty technique.** Layout matches frame S1; the empty state teaches the first action.
- **Open and copy.** Open dialog → "Weigh a Solid": read-only banner, three node cards with START,
  issue badges and chips, and ✓ edges. "Edit a copy" gives `TECHNIQUE / DRAFT COPY` and
  "Weigh a Solid (copy)".
- **Insert and undo.** Library "Measure volume" with a step selected inserts after it ("Insert
  Measure volume" in the footer; autosaved). Undo restores it.
- **Starting bench.** The runtime's four shelf items show. A library balance is placed on the bench
  with its label and ring, and the equipment inspector and nudge pad appear.
- **Setup and preview.** "Make a Solution (copy)": Setup with four slots and approval → one
  "Configure …" transaction, pill `3D-ready`. Preview runs Player3D in the stage at step 1.
- **Fixed during the look:**
  - the library's template icons (a stub action crashed `defaultInteractionForAction`);
  - node spacing (layout units);
  - the "3D-ready" pill on an empty draft;
  - "Apply setup" for identifier-only techniques;
  - the Starting bench camera (it now frames the bench);
  - the stage badge overlapping the view switcher.

## Fidelity review (second pass, 2026-09-24)

A critical re-read of the M6 code, and of the pour fix, against the handoff and the plan. What changed:

| Finding | Handoff / plan | Fix |
|---|---|---|
| The setup form did not follow `TeacherSetupLayout`. It had no Required/Optional marks and no hints, and boolean slots got a text box. | §4.8 ("the layout follows `TeacherSetupLayout`") | Numbered sections (1 Classroom values, 2 Instructor approval). Each field is marked Required or Optional with `TechniqueSetupForm.fieldHint`'s wording, and booleans get a select. "Required" means required with no published default, as in 2D. |
| Edge labels never opened on hover: the CSS sibling selector could not match React Flow's label portal. | §4.4 (label pill on hover or selection) | Edge hover is tracked through `onEdgeMouseEnter` / `onEdgeMouseLeave`. |
| No teal rings while dragging from an out-handle. | §4.4 Connect | `onConnectStart` / `onConnectEnd` light the compatible in-handles. |
| Connect mode could branch a step to itself. | — (correctness) | A connection back to the same step offers Retry only (`addRetryEdge`). |
| Equipment dropped on the Flow was accepted. | §4.3 (equipment goes onto the Starting bench) | The Flow accepts step and technique drags only. |
| The dot grid did not pan or zoom with the canvas. | §4.4 (24 px dot grid) | React Flow's `Background` (dots, 24 px). |
| The minimap was blank. The nodes are controlled, but their `dimensions` changes were dropped, so the minimap saw every card as unmeasured. Fitting ran before measurement and could clip the last card. | §4.4 (minimap) | Measured sizes are kept and given back to the nodes; fitting waits for `useNodesInitialized`. Verified from React Flow's source (`updateNodeInternals` → `triggerNodeChanges`). A live look was not possible because the app window was minimised. |
| The full title had only a native tooltip. | §4.4 (full text in a hover callout) | A styled callout for titles longer than about two card lines. |
| The calculation card's tolerance chip had no value. | §4.4 (tolerance chip) | It shows `± <tolerance>` from the step's `calculationWithinTolerance` rule, or the action's `tolerance`. |
| The flattened-experiment note sat in the footer. | §4.4 ("the inspector note reads …") | The inspector shows the note, the copied techniques and the group-frame sentence (frame S8). The footer keeps the positions note (§4.1). |
| No technique-instance view. | §4.7 ("Technique instance (experiments)") | Source technique, instance, steps, state, unset settings and ports, opened from the experiment summary. |
| No "Adding a step" inspector during a library drag. | Frame S2 | The inspector names `appendTemplateStep`, the anchor, the placement and the step it will come before. |
| New, Open and Import replaced a draft with content without asking. | §4.8; clarity rule 6 (short honest notes) | A confirmation says the draft is the one kept in this browser, with Export first / Cancel / Replace; undo still restores it. |
| Preview showed nothing while the draft was not runnable. The 2D `PreviewPanel` keeps the last runnable draft with a stale banner. | Plan §4.6 (parity) | The last runnable draft keeps playing, under the 2D banner wording. |
| The 1600 px split did not follow window resizes. | §4.6 | It reads a live window width. |
| Esc did not cancel a Starting-bench carry. | §4.9 | Esc drops the preview and redraws the draft. |
| Front used the player's close home pose. | §4.5 toolbar | Front, Reset and Home frame the whole bench from the front direction (`frameBench(insets, true)`). |
| The bench badge counted only authored items. | §4.5 | It counts the runtime's starting state, including items the runtime adds. |
| Toggles were not remembered. | §3.8 (`studio-ui` holds "stage view, column widths, toggles") | Flow Snap / Minimap / Details, bench Snap to zones / Labels, and the tablet sheet height are remembered in `studioUi.ts`. Column widths are fixed by §4.1, so there is nothing to store. |
| Open listed no drafts. | §4.8 ("lists published techniques by pack, and drafts") | A Drafts section: the draft kept in this browser, and Import a draft file. |
| Dialogs had no focus trap. | Accessibility (§8) | Tab cycles inside the dialog; focus returns on close. |
| The 1024–1279 px rail had no icons, and the tablet sheet was not draggable. | §4.10 | An icon rail (Techniques, Steps, Equipment) opens the flyout. The sheet has a grip (pointer, or arrow keys). |
| Technique cards used one item thumbnail. | §4.3 ("Blender composite thumbnail") | The first three model thumbnails composed. No per-technique composite render exists (the M2 composites are review states); rendering one is an asset task. |
| A new validation rule's id could collide. | — (correctness) | It comes from `createStudioIdAllocator`. |
| Under reduced motion a shelf source flashed beside the target for a frame. | §3.5 ("skipped: levels jump to the committed state") | Nothing is staged under reduced motion. |
| The pour's carry in and out took about 2 s around the pour. The pour was linear. | §3.5 (pour 600–1400 ms, ease-in-out) | The carry motions are shortened (0.3 s from a drag's drop point); the pour and its levels ease in and out. The tilt goes up to `pour.tiltDeg`, which an emptied source reaches (documented in `planPour`). |

Still a deviation, stated honestly: the equipment inspector shows the Blender thumbnail, not a
live 3D preview. The equipment dialog has the live turntable; a third WebGL view in the inspector
was not added.

## Open issues found

1. **Weighing could not be configured anywhere. Fixed on 2026-09-24 by decision** (DECISIONS.md, D4
   exception). Applying its setup returned the core's refusal: "Configured technique is not valid:
   technique.actions repeats structured output `…standalone-mass-measurement-id`."

   **Cause.** `weigh-solid` declares the balance reading as a typed output
   (`mass.outputMeasurementId`). `record-solid-mass` named the same measurement as a second
   producer. The validator skips `{{config.…}}` names, so the published file passed; setup made
   the two names equal.

   **Review of the first recommendation.** Before implementing, the recommendation was checked
   against the source and narrowed:
   - Don't copy the built-in fixture's label: it belongs to a different weighing variant.
   - Don't bump the version: `checkCycle04Foundations.mjs` requires `1.2.0`.
   - Don't edit the cycle-04 transform: it is a one-time in-place migration.

   **The fix.** `record-solid-mass` gains `copyExistingMeasurementOnly: true` and an authored
   `recordNotebook` interaction identical to the derived default. At runtime the step already
   took the weigh reading (`reducer.ts:5794`); it now also refuses a replacement value
   (`reducer.ts:5755`).

   **Checks.**
   - A narrow validator script (static, on the one file): the published file valid, standalone
     configured valid, two configured Studio workflows valid, and the interaction equal to the
     derived default.
   - Type check.
   - Browser: `#/3d/technique/weighing` starts and plays through. The record step copied 2.505 g,
     and the results show it as "Your entry".
   - `checkCycle04Foundations.mjs` cannot run in this export: it needs the missing
     `CYCLE_01_BASELINE.json`.

   **Tests.** The existing core tests that call weighing's setup
   (`techniqueConfiguration.test.ts` "keeps weighing bound…" and `workflowConfiguration.test.ts`
   "keeps typed mass output…") threw on main before this fix. A new case, written and not run,
   asserts the configured technique validates and the interaction is unchanged.
2. **Preview crowding.** On a stage narrower than a full window, Player3D's floating tray can
   crowd its dock. It is usable; a compact preview layout is a follow-up.
3. **Not exercised in the browser:** HTML drag and drop (library → edge insertion, bench and shelf
   drops), the Connect menu, the equipment turntable, the tablet widths, and the 1600 px split
   view. They are source-reviewed and type-checked only.

Tests written, not run: `src/studio/__tests__/techniqueExportComposition.test.ts` and
`src/studio3d/__tests__/studio3d.test.ts`. The second covers:
- the Flow reading of a draft;
- the diagnostics-to-node counts;
- arrow travel;
- library statuses;
- edge insertion and the two-step retry;
- seating rules and the runtime attachment;
- the preview-notice rule.

Deferred by the plan (§4.6), linked from Studio 3D to the original Studio: the WebMCP Experiment
Composer, guided rehearsal and the Protocol Check.
