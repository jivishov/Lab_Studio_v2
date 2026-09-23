# AGENTS.md

## Export Repository Authority (export adaptation)

- This independent repository checkout is the authority for work performed here. Use repository-relative paths and keep changes inside this checkout unless the user explicitly expands the scope.
- This repository was exported from a live Lab Studio working tree. The export preserves the application snapshot and does not claim that the source was clean, released, or fully verified.
- The source-specific Windows-path routing in the original AGENTS.md was intentionally replaced for this independent repository. The scientific, equipment, gesture-control, validation, and user-intent boundaries below are preserved.

## Repository Validation Policy

- For every implementation cycle in this repository, code carefully and validate with source review plus only basic static checks and basic linting.
- Never run detailed tests, full test suites, end-to-end or browser matrices, exhaustive runtime checks, performance tests, or similarly broad validation unless the user explicitly requests them in a later prompt.
- Do not run tests merely because a planning document, handoff template, acceptance checklist, or another section of this file prescribes them. Record those detailed checks as intentionally not run under this user-directed policy.
- Keep test coverage honest: add or update narrowly relevant tests when implementation requires it, but do not execute detailed tests under this policy.
- This repository-specific validation policy has highest priority over conflicting QA expectations elsewhere in this file.

## General LLM Integration Rules

- Keep provider/model capabilities centralized. Prefer a model catalog module over scattered string equality checks.
- Keep dependencies unpinned unless a repo explicitly requires pins. Do not add hidden pins elsewhere after simplifying `requirements.txt`.
- Runtime-only attachment data must stay server-side. Never serialize local file paths, SHA256 hashes, or vendor `file_id` values into client-visible state.
- Stage attachments locally first, upload lazily on the first provider call that needs them, cache remote file handles for reuse, and delete both local files and remote handles on reset/cleanup.
- For the web projects never check for mobile responsive formats, unless explicitly specified in the prompt to do so. Always implement responsiveness for tablet, laptop screens and above. Mobile screens are only when specified.

## Simulator Equipment Asset Rules

- Assets under `public/assets/equipment-realistic/v1` are expected to look like realistic lab apparatus, not flat icons or simplified instructional cartoons. Generated PNGs should use plausible glass, plastic, metal, rubber, paper, liquid, and ceramic materials with realistic transparency, highlights, shadows, texture, scale, orientation, and bench-ready proportions.
- Prefer simulator-useful photorealism over decorative drama: equipment must remain easy to identify, easy to hit-test visually, and readable at shelf and workbench sizes. Avoid dark cropped product-photo looks, exaggerated perspective, busy backgrounds, labels baked into the apparatus unless the real object needs them, and stylization that changes the scientific meaning.
- Preserve physical correctness in generated equipment states. Snap-zone composites, stopper orientation, inserted tools, liquid levels, menisci, and instrument readouts must match the authored procedure and real bench handling.
- For generated realistic equipment, the PNG is the visual source of truth. The matching SVG file must be a wrapper around that same PNG, not a redrawn vector approximation.
- PNG-backed SVG wrappers must keep the PNG dimensions in `width`, `height`, and `viewBox`, include exactly one embedded PNG `<image href="data:image/png;base64,...">`, use `preserveAspectRatio="xMidYMid meet"`, and expose an accurate singular/plural `aria-label`.
- Do not let a realistic PNG and same-named SVG diverge visually. Use the shared asset generator wrapper path, such as `write_png_wrapper()` or `write_asset()`, when creating or refreshing generated equipment assets.
- Add or update regression coverage when changing generated assets. At minimum, assert that the SVG wrapper dimensions match the PNG dimensions and that the wrapper is PNG-backed; add focused label, aspect-ratio, composite-suppression, or app-facing render assertions when the change affects a specific apparatus state.
- Visually inspect generated standalone PNGs and composite PNGs after regeneration. For combined apparatus states, confirm the composite includes only the intended child equipment and that `EquipmentView.tsx` suppresses duplicate child rendering when the combined asset already contains it.

## OpenAI Rules

- Prefer the Responses API for new work.
- For file inputs, use the Files API with `purpose="user_data"`.
- When a file is attached, place `{"type": "input_file", "file_id": ...}` before the user text block in the Responses API input.
- Reuse the same cached OpenAI `file_id` across subsequent rounds instead of re-uploading.
- Apply reasoning controls from the model catalog, not hard-coded conditionals.
- The GPT Pro model is the only OpenAI model in this workspace that requires an explicit UI confirmation gate before execution.

## Anthropic Rules

- Use plain `client.messages.create(...)` only when no file is attached.
- When a file is attached, use `client.beta.files.upload(...)` followed by `client.beta.messages.create(...)`.
- File-analysis requests should use:
  - `betas=["files-api-2025-04-14", "code-execution-2025-08-25"]`
  - `tools=[{"name":"code_execution","type":"code_execution_20250825","allowed_callers":["direct"]}]`
  - a user `content` array with `{"type":"container_upload","file_id": ...}` before the text block
- For Claude 4.6 and above models, use adaptive thinking plus catalog-driven effort values.
- Do not send `temperature`, `top_p`, or `top_k` with thinking-enabled Anthropic requests.
- For Haiku fallback flows, keep the simple enabled/disabled thinking shape with a fixed hidden budget.

## Student Player Camera Gesture Control Rules

Gesture control is a shared Student Player input mode. Do not create per-lab or per-template gesture systems. To apply gesture control to another lab, build the activity with the normal equipment, workbench, snap-zone, and interaction specs, then verify that the shared Student Player gesture bridge can operate it.

Source-of-truth files:
- `docs/gesture-control.md`
- `src/player/gesture/useGestureRecognition.ts`
- `src/player/gesture/gestureWorker.ts`
- `src/player/gesture/gestureMath.ts`
- `src/player/StudentPlayer.tsx`
- `src/player/Workbench.tsx`
- `src/player/EquipmentShelf.tsx`
- `src/player/EquipmentView.tsx`
- `src/player/ProcessSidebar.tsx`

### Recognition Engine

- Bundled default engine: MediaPipe Hand Landmarker in `VIDEO` mode, using 21 hand landmarks.
- Startup order: Hand Landmarker GPU, then Hand Landmarker CPU, then MediaPipe Gesture Recognizer CPU fallback.
- Worker init uses `handLandmarkerModelUrl` for `mediapipe/models/hand_landmarker.task` and `gestureRecognizerModelUrl` for `mediapipe/models/gesture_recognizer.task`.
- Recognition runs in a module worker with one frame in flight. Prefer `requestVideoFrameCallback`; fall back to `requestAnimationFrame`.
- Drop frames while the worker is busy instead of queueing stale frames.
- Camera control requires localhost or HTTPS, webcam permission, worker support, and `createImageBitmap`.
- The external precision hardware path is only a documented future option unless real hardware support is implemented and verified.

### Pinch Cursor Math

- Thumb tip landmark: `4`.
- Index tip landmark: `8`.
- Open-hand cursor uses the index tip.
- Pinching cursor uses the midpoint between thumb tip and index tip.
- Current thresholds live in `gestureMath.ts`: pinch start `0.055`, pinch release `0.085`, minimum confidence `0.35`.
- Mirror the X axis for natural camera movement.
- Current edge margins are `0.08` horizontal and `0.06` vertical.
- Cursor speed is the only gesture preference stored in localStorage, under `lab-studio:v1:camera-cursor-speed`.
- Never persist camera frames, landmarks, local file paths, hashes, model outputs, provider internals, or remote file IDs in lab JSON, localStorage, or client-visible durable state.

### Pinch, Hook, Drag, And Release UX

- When a user pinches a shelf item or workbench item, the grabbed object must visibly attach to the pinch point.
- While pinching, render a fixed `.gesture-drag-preview` that follows the cursor using the original grab offset: `preview position = cursor position - grab offset`.
- Preserve object identity while dragging: use the same equipment art/visual profile, bench-sized dimensions, and label fallback.
- Dim the source item with the grabbed state, such as `is-gesture-grabbed`.
- The gesture cursor must stay visible above the preview. Cursor and preview must use `pointer-events: none`.
- Drag previews must be decorative and non-focusable; do not render hidden focusable equipment buttons inside the preview.
- Do not commit placement, movement, or interaction state while the pinch is held. Commit only on pinch release.

### Runtime Interaction Bridge

- Pinch start should identify the UI under the cursor with `document.elementFromPoint(cursor.clientX, cursor.clientY)`.
- Supported gesture targets are shelf equipment, workbench equipment, and explicitly whitelisted action buttons.
- Shelf selector: `.equipment-shelf .equipment-view[data-definition-id]`.
- Workbench selector: `.bench-item[data-instance-id]`.
- Action buttons must opt in with `data-gesture-action`; do not make help, documentation, or unrelated controls gesture actions.
- Shelf release over the workbench places equipment through the same placement path used by pointer drag.
- Workbench release over a valid target runs the same object interaction path as pointer drag.
- Workbench release over an invalid target reports the normal invalid-overlap feedback.
- Workbench release with no valid interaction should move the item only when the normal runtime movement rules allow it.
- Reuse central overlap, snap-zone, assessment, feedback, and runtime intent logic. Do not bypass these paths for gesture input.

### Open-Hand Scrolling

- Open-hand scrolling is allowed only when the cursor is ready, the user is not pinching, no gesture target is active, blocking dialogs are closed, and the post-release cooldown has passed.
- Pinching always takes priority over scrolling.
- Keep scroll affordances on the existing document, shelf, and workbench edge-scroll behavior.

### Applying Gesture Control To New Activities

When asked to "apply gesture control" to a lab/template/technique:
- Do not add a new camera stack.
- Ensure the activity has normal equipment definitions, workbench render nodes, visual profiles, hit boxes, snap zones, and interaction specs.
- Use existing interaction types where possible, such as drag/drop placement, snap targets, object interactions, dispense/drop actions, recording evidence, time-series recording, and calculation submission.
- If a new interaction type is genuinely needed, extend the central interaction bridge and process-button whitelist rather than adding lab-specific gesture code.
- Keep pointer, keyboard, and accessible process controls working. Gesture control is an optional input mode, not the only way to complete the activity.

### QA Expectations

- Unit test gesture math and Student Player gesture flows when behavior changes.
- Use mocked-camera Playwright coverage for each new gesture-enabled route.
- Verify:
  - worker initialization receives both model URLs,
  - the status panel reaches Ready,
  - the fixed gesture cursor renders above the page,
  - pinching a shelf item creates a drag preview,
  - the preview follows the pinch point,
  - the source item is visibly grabbed/dimmed,
  - release commits placement or interaction through normal runtime logic,
  - invalid targets show normal feedback,
  - reset/camera stop clears cursor, active target, and preview state,
  - no runtime overlay or console error appears.
- Follow the repo's responsive-testing rule: do not add mobile-specific QA unless explicitly requested, but do not remove existing configured browser coverage.

### Anti-Patterns

- Do not build a second drag/drop system for gesture input.
- Do not move only the cursor while the grabbed object stays visually stationary.
- Do not commit state before pinch release.
- Do not serialize runtime-only camera or landmark data.
- Do not make decorative drag previews focusable.
- Do not bypass runtime validation, assessment feedback, snap zones, or overlap checks.

## Lab Studio 3D Equipment Asset Rules

These rules apply to `tools/blender/`, `public/assets/equipment-3d/v1/` and `src/studio3d/equipment3d/`. The rules for `public/assets/equipment-realistic/v1` (PNG-backed SVG wrappers) are unchanged, and apply only if a 3D thumbnail is ever placed there.

### Source of truth

- Every 3D model is generated by a Python module in `tools/blender/equipment/<definition_id>.py`, built with the shared procedural library `tools/blender/labeq/`. Models are never hand-edited in Blender, and a GLB is never committed without the module that produced it.
- One module per catalogue definition id. The module sets `DEFINITION_ID` to that id exactly. Sizes are real-world millimetres, and the geometry follows the real apparatus.
- `src/studio3d/equipment3d/registry.json` is generated by `tools/blender/pack_models.py` from each model's `meta.json`. Never edit it by hand.
- Registry anchors are keyed by semantic zone ids from `src/domain/interactionZones.ts`. Never invent a zone id or rename one.

### Scientific fidelity

- **No contents in models.** Liquids, powders, precipitates and any other contents are runtime state, drawn by the viewer inside the model's fill profile, with colour from `resolveLiquidStyle`. `viewerMaterials.json` lists no contents material, and the validator refuses any material not in that list.
- **No baked labels that could be false.** Print only what is true of the definition itself, such as a capacity mark or graduations. A contents name, concentration or hazard label comes from runtime state through the UI.
- **Measurement-neutral instruments.** Every display declares a policy from `displayPolicies.json`. A model's display surface is blank; the viewer draws only what the policy allows, and never an invented reading.
- **Scenery is visual only.** Bench scenery, such as the test-tube rack (decision D9), sets `SCENERY = True`, uses an id outside the catalogue, and is never an equipment instance.
- **Graduations and fill profiles match the catalogue.** A fill profile holds at least the catalogue capacity. Graduation steps follow the catalogue precision only where that precision is in mL (decision U9). Never change the catalogue to suit a model.

### Pipeline

Blender 5.2 or later must be on `PATH` as `blender`, or be called by its full path.

```
blender -b --factory-startup -P tools/blender/build_equipment3d.py -- --only <id>[,<id>] [--review]
python tools/blender/pack_models.py --only <id>[,<id>]
python tools/blender/validate_equipment3d.py --pack <n> [--only <id>[,<id>]]
```

- **gltfpack flags.** Always `-cc -kn -km -kv -vn 12 -vtf -vpf`. Positions must stay float: quantized positions flatten transmission thickness in three.js.
- **Budgets.** About 250 KB per ordinary item and 600 KB per instrument (an item with a display), and about 4 MB per pack. Reduce tessellation before any other change, and never change a real dimension.
- **Provenance.** Each `meta.json` records the Blender version, generator path, source hash and marking font. Baked text uses Inter from Blender's datafiles (SIL OFL 1.1).
- **Review.** Inspect the `--review` Cycles render of every new or changed model, including composite states, before committing.

### Validation

- Run `validate_equipment3d.py` for the affected pack and definitions. It must exit 0. It is a static check, allowed under the repository validation policy.
- The registry test (`src/studio3d/__tests__/equipment3dRegistry.test.ts`) is written and kept current, but is run only when the user asks.
