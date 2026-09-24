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
- **Starting contents** show read-only, with a swatch in the palette colour. The handoff says
  starting contents are "edited in the existing inspector fields"; Studio 3D points to the original
  Studio's fields for that, since M6 adds no contents editor. Please confirm this reading.

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

## Open issues found

1. **Weighing cannot be configured in Studio 3D either.** Applying its setup returns the core's
   refusal: "Configured technique is not valid: technique.actions repeats structured output
   `weighing-copy-standalone-mass-measurement-id`." This is the content defect already reported in
   M5 (`record-solid-mass` lacks `parameters.copyExistingMeasurementOnly: true`). The fix is a
   content change and needs your decision.
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
