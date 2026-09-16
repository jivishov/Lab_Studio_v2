# Studio Process Stage Design QA

Date: 2026-08-23
Visual source: `exec-8e8d5e8e-67da-42fc-ab94-48616811249d.png`

## Review evidence

| Viewport | Result | Evidence reviewed |
|---|---|---|
| 1586 × 992 direct mock comparison | Pass after independent refinement | 64 px command header; 396 px outline; 52 px canvas toolbar; 472.8 px graph; 347.2 px selected-step editor beginning at y = 644.8; fitted nodes 204 × 64.8 px in three rows at y = 222.5 / 376.1 / 529.7. Direct snake-path handles preserve actual authored edges. Document remains exactly 1586 × 992. |
| 1440 × 900 primary laptop | Pass after independent refinement | Stage group begins at x = 344 and spans 422.6 px; inline Saved state begins at x = 782.6. The graph/editor boundary is y = 585, fitted nodes are approximately 192.5 × 61.1 px, and the collapsed editor remains a 1044 × 48 px persistent dock. No document scroll. |
| 1366 × 768 compact laptop | Pass after independent refinement | 64 px command header; 360 px outline; 52 px canvas toolbar; 360 px graph; 236 px internally scrolling selected-step editor; fitted nodes approximately 177.4 × 56.3 px. No document scroll. |
| 1024 × 768 tablet | Pass after independent refinement | Two-row 96 px command header; 264 px outline; 52 px toolbar; 564 px canvas; 360 × 616 px selected-step right drawer. Library becomes a 420 × 712 px modal drawer; the collapsed editor becomes a 760 × 48 px persistent bottom dock. Escape and focus restoration pass; no document scroll. |

## Findings

| Priority | Finding | Resolution/status |
|---|---|---|
| P1 | Collapsing the selected-step editor unmounted the entire dock, expanded the canvas to the bottom edge, and left no visible recovery control. | Resolved. The editor remains mounted behind a 48 px header-first dock strip containing step position, title, and a labeled **Expand editor** control. Selection and active inspector tab persist; collapse and expansion transfer focus predictably. |
| P2 | Control chrome remained oversized: the command bar was 76 px, command action group 492 px, canvas toolbar 64 px, contextual strip 62 px / 505 px, and outline rows 59 px. | Resolved. These are now 64 px, 424 px, 52 px, 50 px / 461 px, and 54 px respectively. Visible controls use reduced padding and 4–8 px group gaps while retaining 40 px primary and icon-only hit targets. |
| P1 | The stage group drifted far right of the mock, the Saved state looked like another pill, and the direct command hierarchy contained a large visual discontinuity. | Resolved. Desktop grid ownership now anchors the stages immediately after draft identity and renders Saved as an inline check-and-text status without changing save semantics. |
| P1 | ReactFlow always used top targets and bottom sources, producing large looped connectors unlike the mock's direct three-row process. | Resolved without changing the graph. Handle positions are derived from each node's actual persisted layout and first authored non-retry incoming/outgoing edge; nodes, edges, labels, dragging, selection, layout, fit, and connection editing remain source-authoritative. |
| P1 | The library footer looked actionable but was not interactive, and the initial popover exposed the whole catalog instead of contextual suggestions. | Resolved. The default view shows four actual step templates and two actual workflows, the footer is a real **Browse all** button, and search/Browse reveal the complete source-backed catalog. No illustrative mock labels were copied into draft data. |
| P2 | Canvas pointer handling prevented outside-click library dismissal, and Connections did not close with Escape. | Resolved. The picker uses capture-phase pointer dismissal; both panels restore focus to their invoker after Escape/dismissal. |
| P1 | The selected-step inspector initially rendered closed, allowing ReactFlow fit to enlarge nodes to approximately 267 × 81 px and leaving the inspector below the primary workflow. | Resolved. The selected start step opens initially; final fitted nodes are approximately 192.5 × 61.1 px at 1440 × 900 and the inspector begins at y = 585. |
| P2 | Studio headings, node labels, readiness copy, outline rows, and controls inherited 800–900 weights, making nominally compact text visually oversized and bulky. | Resolved. The Process workbench now uses a fixed 11 / 12 / 13 / 15 / 18 px role scale with 400 / 500 / 600 emphasis, while primary targets remain 40–44 px. |
| P2 | Stored split-preview preference can reopen the preview on first load, narrowing the canvas compared with the visual source. | Accepted compatibility behavior. A new user with no stored preference starts authoring-only; the labeled **Show preview** control restores or hides the existing optional split. |
| P2 | The mock shows generic template labels that are not authored in the current Studio catalog. | Resolved by rendering the actual source-backed step, workflow, and lab templates. No template semantics were invented. |
| P3 | At 1024 px, the selected-step action row horizontally scrolls inside the drawer when every contextual action is visible. | Accepted. All actions retain 40 px targets and remain keyboard reachable without forcing document scrolling. |
| P3 | At the mock's native 1586 px width, its outline is approximately 439 px while the implementation holds 396 px. | Accepted to honor the prompt's 1440-first priority: 396 px is the proportional mock width at 1440 and preserves more canvas at the primary laptop viewport. |
| P3 | The mock's illustrative connector topology and exact row spacing do not equal the current draft's authored sequence/layout data. | Accepted compatibility boundary. The presentation now uses direct geometry-aware paths, but it does not fake branches or rewrite persisted coordinates merely to copy the sample image. |

## Intentionally unrun

Full Vitest, E2E/browser matrices, performance testing, mobile testing, deployment, and broad accessibility certification were not run under the repository validation policy.

## Setup, Preview, and resizable-workbench follow-up

Date: 2026-08-23

### Critical audit and resolution

| Priority | Finding | Resolution/status |
|---|---|---|
| P1 | **Preview & validate** retained the Process authoring surface in layout, leaving a graph sliver above a large blank region and separating runtime controls from the Student Player. | Resolved. The Preview stage now owns the full 780 px workbench below the command header: a compact 396 px validation rail, 8 px separator, and 1036 px runtime surface at 1440 × 900. The authoring pane is semantically hidden and consumes 0 px. |
| P1 | **Setup** was a 897 px document-like panel with a 438 px equipment section and document overflow. | Resolved. Setup is a fixed-height workbench with a 52 px stage header, 396 px internally scrolling configuration rail, 8 px separator, and dominant 1036 px internally scrolling equipment surface. Every existing field, readiness category, conversion action, catalog action, and starting-item control remains present. |
| P2 | The old **Show preview** label appeared to duplicate the dedicated stage, while its actual split-editing purpose was not communicated and became unusably narrow. | Resolved by retaining the distinct simultaneous edit-and-observe workflow as **Split preview**. It is optional, explicitly labeled as in-context, clamped to 56–68% authoring width, and unavailable at the 1024 px drawer breakpoint where the dedicated Preview stage is the coherent runtime view. |
| P2 | Outline, split preview, and expanded bottom editor used fragmented or missing resize behavior without complete separator semantics. | Resolved with one reusable separator implementation: pointer capture, direct clamped updates, Arrow-key resizing, Home/End limits, double-click reset, full value semantics, and a subtle 8 px grip. Tablet drawers take precedence and hide desktop handles. |
| P2 | Collapsing the bottom editor could lose the recovery affordance after layout changes. | Preserved and reverified. The collapsed dock remains a fixed 48 px recovery strip, retains selection/tab state, and restores focus to the expanded editor. |
| P3 | Very long metadata, readiness diagnostics, equipment catalogs, and runtime content could force full-document scrolling. | Resolved for the reviewed draft: each owning rail/surface scrolls internally while the document remains exactly the viewport height at 1440 × 900, 1366 × 768, and 1024 × 768. Extreme authored-content and zoom combinations remain a bounded future visual check. |

### Authored dimensions

| Region | Minimum | Default | Maximum |
|---|---:|---:|---:|
| Process / Setup / Preview left rail | 300 px | 396 px | 480 px |
| Process rail while split preview is open | 300 px | 300 px | 300 px |
| In-context split authoring pane | 56% | 60% | 68% |
| Expanded selected-step editor | 200 px | 315 px | min(480 px, workbench height - 300 px canvas) |
| Collapsed selected-step editor | 48 px | 48 px | 48 px |

The rail and bottom-dock sizes are session-only. The split continues to reuse `lab-studio:v2:studio-split`; no schema, artifact, route, or new persistence key was introduced.

### Bounded live evidence

| Viewport/stage | Result |
|---|---|
| 1440 × 900 Setup | 1440 × 900 document; 780 px stage workbench; 52 px header; 396 / 8 / 1036 px workbench columns; metadata and equipment own their overflow. |
| 1440 × 900 Process split | 922 / 8 / 510 px authoring-separator-preview composition; 300 / 8 / 614 px outline-separator-main composition; toolbar client and scroll widths both 625 px after compact readiness treatment. |
| 1440 × 900 Preview & validate | Hidden authoring pane is 0 × 0; 396 / 8 / 1036 px validation-separator-runtime composition; Student Player mode, camera, help, reset, equipment, workbench, and diagnostics remain colocated. |
| 1440 × 900 bottom dock | 315 px default, keyboard-resized to 327 px; collapsed strip measured 48 px and restored to the prior expanded size with focus retained. |
| 1024 × 768 tablet | 264 px fixed rails and existing accessible inspector drawer; desktop separators and split-preview toggle hidden; Setup, Process, and Preview keep internal scrolling with no document scroll. |

### Review limits

Source review, scoped whitespace checks, `npm run typecheck`, keyboard separator behavior, collapse/restore, and bounded live layout review were completed. Pointer-resize code was source-reviewed but a real pointer-device drag was not conclusively exercised by the browser-control harness. Vitest, full E2E/browser matrices, performance, mobile, deployment, camera-hardware validation, and broad accessibility certification remain intentionally unrun.

---

# Student Player Hybrid Design QA

Date: 2026-08-23  
Visual source: `exec-6fb83b60-0994-4029-8b3a-0587e12f596d.png`  
Route: `#/play/hard-water-demo`

## Review evidence

| Viewport/state | Result | Evidence reviewed |
|---|---|---|
| 1440 × 900 Guided start | Pass | One-viewport document; 244 / 800 / 352 px Equipment, Workbench, and Inspector columns; 798 px usable Workbench with no horizontal overflow; one 44 px primary action. |
| 1366 × 768 Guided and Assessment | Pass | One-viewport document; 224 / 782 / 320 px columns; 780 px usable Workbench with no horizontal overflow; Guided Needed-now context and Assessment suppression/blocked recovery both rendered. |
| 1366 × 768 first step complete | Pass | Bottle changed from 120 mL to 100 mL, cylinder changed from empty to 20 mL, progress advanced to step 2 with 1 completed, and Results increased to 1. |
| 1024 × 768 tablet reflow | Pass | One-viewport document; 760 px usable Workbench plus 232 px docked Now panel; 296 px Equipment drawer and 360 px Process drawer open without changing Workbench coordinates. |
| Independent collapse | Pass | Inspector collapse produced 224 / 1058 / 44 px columns; both collapsed produced 44 / 1238 / 44 px columns; Workbench state remained mounted and document height remained one viewport. |

## Findings

| Priority | Finding | Resolution/status |
|---|---|---|
| P2 | Raw evidence tags remained visible below the closed Action details disclosure in the first render. | Resolved. Technical evidence remains available inside Action details and is removed from the primary Now surface. |
| P2 | The initial 1024 px reflow lost 2 px of usable Workbench width to its border and the collapsed Equipment rail covered the Workbench title. | Resolved. Tablet reserves a 762 px outer column for a 760 px Workbench and moves the collapsed opener clear of the title. |
| P3 | Runtime-authored initial equipment positions do not center the bottle and cylinder exactly like the illustrative mock. | Accepted compatibility behavior. Existing pixel coordinates, placement, layering, hit boxes, snap zones, and accumulated state remain authoritative. |
| P3 | The mock's simultaneous collapse labels are not reproduced as permanently open labels. | Resolved as transient hover/focus tooltips, one control at a time. |

## Intentionally unrun

Vitest, full test suites, broad E2E/browser matrices, camera or gesture hardware testing, performance testing, mobile testing, deployment, and broad accessibility certification were not run under the repository validation policy.

---

# Student Player Hybrid Independent Fidelity Review — After Refinement

Date: 2026-08-23  
Visual source: `exec-6fb83b60-0994-4029-8b3a-0587e12f596d.png`  
Route inspected live: `#/play/acid-base-titration`

Sequence note: the fresh independent baseline appears later in this append-only file because previously recorded QA entries were preserved in place.

## Design health score after this pass

| # | Nielsen heuristic | Before | After | Refinement evidence |
|---|---|---:|---:|---|
| 1 | Visibility of system status | 4 | 4 | Global and local progress, readiness, placed state, utility counts, and immediate status remain visible. |
| 2 | Match between system and real world | 3 | 4 | The action now reads as a directional source-to-target lab operation within a pale equipment stage. |
| 3 | User control and freedom | 3 | 3 | Existing modes, reset, tabs, independent panel collapse, drawers, and input paths remain intact. |
| 4 | Consistency and standards | 3 | 4 | Mode selection, tabs, utility selection, primary action, and collapse handles now use distinct, consistent visual roles. |
| 5 | Error prevention | 4 | 4 | Readiness gates, disabled states, runtime validation, Assessment suppression, and attempt accounting were not changed. |
| 6 | Recognition rather than recall | 3 | 4 | Bordered Needed-now items, category icons, the source-to-target cue, and local progress reduce translation work. |
| 7 | Flexibility and efficiency | 4 | 4 | Pointer, keyboard, accessible action, drag/drop, gesture, tabs, and collapse paths remain available. |
| 8 | Aesthetic and minimalist design | 2 | 3 | The Workbench is lighter and more dominant; borders, radii, modes, disclosure, and hierarchy are restrained and purposeful. |
| 9 | Error recognition and recovery | 3 | 3 | Existing adjacent feedback and recovery behavior remains visible without creating another action. |
| 10 | Help and documentation | 3 | 3 | About, Help, Guided copy, and Action details remain available in their existing locations. |
| **Total** |  | **32/40** | **36/40** | **All actionable P0-P2 visual-fidelity discrepancies from the independent baseline are resolved.** |

### After-state critique

- **AI-slop verdict: pass.** The interface now has an authored scientific hierarchy rather than a generic field of pills, thin lines, and equally weighted shells. It retains one teal primary action, one pale technical stage, restrained secondary controls, and equipment-led visual interest.
- **Cognitive-load result: 1 of 8 failures — low.** Grouping and current-step orientation now pass. Guided category retention can still expose previously expanded groups after step changes, but this is controlled inside the shelf and preserves the existing auto-reveal/manual expansion contract.
- **First-time student:** Needed now, Browse, instruction, source/target, and one primary action form a clear path. The local progress row prevents orientation from depending on the global header.
- **Keyboard/accessibility-dependent student:** Live DOM inspection confirmed native button activation with Enter and Space, a visible 3px focus outline with 2px offset, 40 × 64px laptop collapse targets, changing `aria-expanded`, updated Expand/Collapse labels, and focus retention on the recovery control.
- **Experienced student:** Independently collapsing Equipment and Inspector expands the Workbench from 782px to 962px and then 1,238px at 1366px without remounting runtime state or creating document overflow. Process and Evidence remain separate tab panels, and the current-step primary action is not duplicated in Evidence.

## Discrepancy closure

| Priority | Baseline discrepancy | Resolution/evidence |
|---|---|---|
| P1 | Workbench was materially darker and greener than the mock. | Resolved with a scoped pale teal-white stage and quieter grid; realistic equipment, authored geometry, hit boxes, and overlays were not touched. |
| P1 | Equipment guidance was flat and under-specified. | Resolved with bounded Needed-now rows, inset Browse control, compact domain-icon categories, placed signifiers, and silent deduplication of the pinned current item. |
| P2 | Guided/Assessment used a generic filled-pill active state. | Resolved with restrained outlined mode controls and a non-color-only radio-like state marker. |
| P2 | Collapse controls looked detached from their panel edges. | Resolved on laptop layouts with teal edge handles; tablet retains the existing drawer-sized control. Both remain collapse-only, independently keyboard operable, and focus visible. |
| P2 | Now lacked local progress. | Resolved with source-backed step/completed values and a native progress element. No runtime state was added. |
| P2 | Placed count was detached from Workbench heading. | Resolved by grouping the count directly beside the heading. |
| P2 | Source/target lacked direction and Action details lacked a bounded disclosure cue. | Resolved with a decorative directional cue and one restrained disclosure boundary. Tablet and compact preview hide the cue where width is insufficient. |
| P3 | Essential labels felt undersized and header groups ran together. | Resolved selectively for headings/action copy/category roles and with quiet Camera/Help/Reset separators; metadata stays compact. |

## Confirmed live geometry after refinement

| Viewport/state | Document | Workbench stage | Side regions | Action and controls |
|---|---|---|---|---|
| 1440 × 900 Guided | 1440 × 900 | 798 × 666; no horizontal overflow | 244px Equipment / 352px Inspector | Primary action 262.7 × 44px; 40px header targets; 40 × 64px collapse handles |
| 1366 × 768 Guided | 1366 × 768 | 780 × 542; no horizontal overflow | 224px Equipment / 320px Inspector | Primary action 230.7 × 53.2px; 40px header targets; 40 × 64px collapse handles |
| 1366 × 768 Assessment | 1366 × 768 | 780 × 542; no horizontal overflow | Needed-now guidance suppressed | Blocked recovery shown; inaccessible action remains disabled |
| 1024 × 768 tablet | 1024 × 768 | 760 × 522; no horizontal overflow | 44px Equipment rail / 232px docked Now | Current action remains visible; narrow source/target reflow avoids mid-word breaks |
| 1024 × 768 Equipment drawer | 1024 × 768 | Workbench geometry remains 760px | 296 × 612px overlay drawer, `aria-expanded=true` | Focus remains on the Collapse equipment control; no document overflow |

## Accepted P3 differences and verification gaps

- The selected mock illustrates a different authored lab state and equipment arrangement. Actual runtime equipment identity, placed coordinates, layering, snap zones, target geometry, and accumulated state remain authoritative and were not hard-coded to the screenshot.
- Guided auto-reveal can retain a category the student previously expanded as the process advances. Closing it automatically would alter the existing shelf contract and focused compatibility coverage, so it remains an internally scrolling P3 difference.
- The Needed-now status badge remains owned by the shared `EquipmentView` so shelf, Workbench, gesture-drag identity, and placed-state semantics do not diverge.
- At 1024px, Now may scroll internally when long authored action copy requires it. The document and Workbench do not scroll, and the current action remains usable.

## Verification evidence

- `student-player-fidelity-1440x900.png`
- `student-player-fidelity-1440x900-step3.png`
- `student-player-fidelity-1366x768.png`
- `student-player-fidelity-1366x768-assessment.png`
- `student-player-fidelity-1024x768.png`
- `student-player-fidelity-1024x768-equipment-open.png`
- `git diff --check` for the six relevant source/test files: pass.
- `npm run typecheck`: pass.

## Intentionally unrun

Vitest and other detailed tests, full suites, broad E2E/browser matrices, camera or gesture hardware testing, performance testing, mobile testing, deployment, and broad accessibility certification remain intentionally unrun under the repository validation policy.

---

# Student Player Hybrid Independent Fidelity Review

Date: 2026-08-23  
Runtime evidence: `codex-clipboard-0b6b7c27-cdaa-44b8-9de0-bf7688f3781b.png`  
Visual source: `exec-6fb83b60-0994-4029-8b3a-0587e12f596d.png`  
Route inspected live: `#/play/acid-base-titration`

## Fresh baseline

The current implementation is structurally sound and substantially better than the pre-hybrid Player, but it is not yet a high-fidelity match to the selected mock. It reads as a flattened generic workbench rather than the mock's calm, purposefully layered student lab. The most important task remains visible, yet the mock's visual hierarchy has been weakened by an overly dark stage, uniformly thin panel treatment, detached circular collapse controls, a visually under-specified Equipment guide, and missing local progress inside **Now**.

### Design health score before this pass

| # | Nielsen heuristic | Score | Baseline finding |
|---|---|---:|---|
| 1 | Visibility of system status | 4 | Global progress, placed count, readiness, and evidence counts are visible. |
| 2 | Match between system and real world | 3 | Apparatus and lab language are credible; the action presentation still feels more like a generic control card than a physical lab sequence. |
| 3 | User control and freedom | 3 | Reset, independent panel collapse, modes, tabs, and drawers are available; collapse affordances are visually detached from their panels. |
| 4 | Consistency and standards | 3 | Interaction paths are consistent, but Guided mode, utility selection, tabs, and collapse controls use competing active-state languages. |
| 5 | Error prevention | 4 | Runtime gating, disabled actions, source/target requirements, snap zones, and Assessment accounting remain strong. |
| 6 | Recognition rather than recall | 3 | Needed-now and current action are visible, but the category placeholder and plain-text source/target block add translation effort. |
| 7 | Flexibility and efficiency | 4 | Pointer, keyboard, accessible action, drag/drop, gesture, tabs, and collapse paths coexist. |
| 8 | Aesthetic and minimalist design | 2 | The hierarchy is flatter than the mock; tinted surfaces, counts, borders, and blank inspector space do not yet form a deliberate rhythm. |
| 9 | Error recognition and recovery | 3 | Recovery is adjacent and explicit, but the active-action region does not yet create the mock's clear instruction-to-action-to-status sequence. |
| 10 | Help and documentation | 3 | About, Help, Guided copy, and Action details are available without leaving the task. |
| **Total** |  | **32/40** | **Good foundation; significant flagship-fidelity refinement remains.** |

### AI-slop verdict

**Borderline fail.** The interface avoids gradients, glassmorphism, neon dark mode, and metric-card grids, but it still carries generic generated-app tells: Inter everywhere, repeated pill counts, evenly weighted teal selection lines, uniform white panel shells, and a large tinted stage with mechanically distributed controls. The scientific equipment itself is distinctive; the surrounding UI needs more authored hierarchy and less token-repetition.

### Cognitive-load checklist

- Pass: single primary task, one action at a time, minimal decision count, current context retained, and progressive disclosure through tabs/details.
- Fail: grouping is weak in Needed now and source/target; visual hierarchy is too flat between mode, tabs, utility selection, readiness, and action.
- Result: **2 of 8 failures — moderate cognitive load.**

### Persona walkthroughs

- **First-time student:** The empty-stage prompt and Needed-now label identify where to begin, but the flat Needed-now row and category message `Current item shown above` look like separate instructions. The solid Guided pill, teal tab underline, active Feedback surface, and teal primary action all compete for what is “current.”
- **Keyboard/accessibility-dependent student:** Live source confirms 40px header controls, a keyboard action fallback, ARIA tabs, panel expansion state, and source/target text. Visual focus was not certified end to end. The circular controls overlap panel edges and their purpose depends heavily on icon recognition before tooltip/focus.
- **Experienced student:** The fixed Workbench and collapsible side regions support fast operation. However, the missing in-panel step progress and over-wide blank inspector after the action make scanning less efficient than the mock's compact action column.

## Baseline discrepancies

| Priority | Finding | Planned correction |
|---|---|---|
| P0 | None confirmed. | Preserve all runtime and interaction contracts. |
| P1 | The Workbench stage is materially darker and greener than the mock, making the apparatus and guidance outlines feel submerged rather than dominant. | Retune only the scoped Player stage and grid to a pale teal-white evidence surface with quieter lines. |
| P1 | The Equipment guidance hierarchy no longer matches the mock: Needed-now items are borderless, Browse is a full-width flat row, categories lack domain icons, and an expanded deduplicated category emits `Current item shown above`. | Restore subtle guided-item boundaries, an inset Browse control, icon-led compact categories, and silent deduplication while preserving Guided auto-open/reveal. |
| P2 | The active Guided/Assessment mode is a filled teal pill instead of the mock's restrained outlined state with a radio-like state signifier. | Give only the two mode buttons an outlined selected treatment and explicit dot signifier; keep Camera/Help/Reset secondary. |
| P2 | Circular floating collapse buttons do not match the mock's compact teal edge handles and look detached from the panels they control. | Use solid teal vertical edge handles on laptop layouts while keeping 40px keyboard targets and tablet drawer affordances. |
| P2 | Now omits the mock's local progress row/bar, weakening orientation once attention moves from the global header into the inspector. | Add a source-backed current-step progress row and bar without changing runtime state. |
| P2 | Workbench placed count is pushed to the far edge; the mock groups it with the Workbench heading. | Align the count directly beside the title. |
| P2 | Action details is visually reduced to a divider although the mock treats it as one bounded disclosure; the source/target block lacks the directional cue shown in the mock. | Restore one restrained disclosure boundary and add a decorative direction cue without changing endpoint semantics. |
| P3 | Several essential Player labels remain at 12–13px, producing a small-text impression at 1× capture scale. | Raise only key panel/action/category roles while retaining compact metadata. |
| P3 | Header controls lack the mock's subtle grouping separators. | Add quiet separators before Camera, Help, and Reset without increasing header height. |

## Confirmed live geometry before refinement

| Viewport | Document | Workbench stage | Inspector | Primary action | Header targets |
|---|---|---|---|---|---|
| 1440 × 900 | 1440 × 900 | 798 × 666, no horizontal overflow | 352 × 768 | 262.7 × 44 | All 40px high |
| 1366 × 768 | 1366 × 768 | 780 × 542, no horizontal overflow | 320 × 640 | 230.7 × 53.2 due text wrap | All 40px high |
| 1024 × 768 | 1024 × 768 | 760 × 522, no horizontal overflow | 232 × 612 docked Now | 142.7 × 72.7 due narrow wrap | All 40px high |

## Baseline verification gaps

Camera/gesture hardware, full keyboard traversal, screen-reader output, measured contrast, 200% zoom, mobile, performance, broad browser behavior, Vitest, full suites, and deployment were not verified in this baseline. The supplied runtime screenshot is visual evidence only; hover, focus, disabled, and recovery behavior was checked from source and narrow DOM inspection rather than inferred from the image.

---

# Student Player Hybrid Visual Refinement QA

Date: 2026-08-23  
Runtime evidence: `codex-clipboard-9caa6c6e-8c12-4936-808f-27837528d746.png`  
Comparison source: `exec-6fb83b60-0994-4029-8b3a-0587e12f596d.png`  
Route: `#/play/acid-base-titration`

## Review evidence

| Viewport/state | Result | Evidence reviewed |
|---|---|---|
| 1440 × 900 Guided start | Pass | Document and Player both remain one viewport; Workbench is 798 px wide with no horizontal overflow. Refined type hierarchy, flattened Equipment and Now groups, one primary action, aligned utility strip, and restrained collapse controls are visible in `student-player-refined-1440x900.png`. |
| 1366 × 768 Guided start | Pass | Document remains 1366 × 768; Workbench client/scroll width is 780/780 px. The current action and recovery area remain visible without document scrolling in `student-player-refined-1366x768.png`. |
| 1024 × 768 tablet default | Pass | Document remains 1024 × 768; Workbench client/scroll width is 760/760 px and docked Now remains usable in `student-player-refined-1024x768.png`. |
| 1024 × 768 Equipment drawer open | Pass | Equipment drawer opens at 296 × 612 px, reports `aria-expanded=true`, preserves the 760 px Workbench geometry, and causes no document overflow in `student-player-refined-1024x768-equipment-open.png`. |

## Findings

| Priority | Finding | Resolution/status |
|---|---|---|
| P1 | The implemented hybrid inherited 700–850 weight text across nearly every label and control, flattening the reading hierarchy. | Resolved with scoped full/tablet Player weights: strong title/current action, medium controls, and regular supporting copy. Essential text remains at least 12 px. |
| P1 | Needed-now context appeared in the section title, item badge, category badge, expanded category, and duplicate item tile. | Resolved. The actionable equipment appears once in the pinned Needed-now list; its redundant browse tile is visually suppressed while the Guided auto-open/reveal path resolves to the visible category header. |
| P2 | Nested outlined cards made instruction, readiness, source/target, primary action, and Action details feel equally heavy. | Resolved. Readiness is an inline semantic state, instruction uses simple dividers, only the actionable control receives a quiet tinted surface, and Action details is a flat disclosure. |
| P2 | Filled edge tabs and text-filled category collapse pills were visually oversized. | Resolved. Panel toggles now retain 40 px targets with a compact 16 px icon and quiet circular surface; category controls retain 44 px targets with a single chevron and screen-reader label. |
| P2 | The outlined current action read as secondary, while the utility strip lacked consistent distribution. | Resolved. The enabled current action is the sole filled teal control; utility actions use equal columns, subdued counts, and a distinct immediate-status region. |
| P3 | The tablet Equipment drawer intentionally overlays the left Workbench area while open. | Accepted compatibility behavior. It is session-only, reversible, keyboard-addressable, and opening it does not modify Workbench coordinates or persisted equipment state. |

## Intentionally unrun

Vitest, full test suites, broad E2E/browser matrices, camera or gesture hardware testing, performance testing, mobile testing, deployment, and broad accessibility certification were not run under the repository validation policy.

---

# Student Player Open Collapse-Tab Micro-Fidelity

Date: 2026-08-23  
Visual source: `exec-6fb83b60-0994-4029-8b3a-0587e12f596d.png`  
Route inspected live: `#/play/acid-base-titration`

| Priority | Finding | Resolution and evidence |
|---|---|---|
| P2 | The open-state Equipment and Inspector handles still painted their full 40 × 64px hit boxes, producing wide blocks between the side regions and Workbench. | Resolved with mirrored divider tabs: the accessible target remains at least 44px wide, while only a 24 × 72px silhouette is painted at 1440 × 900 and approximately 22.8 × 68.3px at 1366 × 768. The existing `#087b7f` teal, collapse-only labels, `aria-expanded`, `aria-controls`, tooltips, keyboard activation, and focus retention remain intact. |
| P3 | The previous left/right radii described the side panels rather than the Workbench divider and made the handles feel like protruding badges. | Resolved by attaching each straight edge to the Workbench divider and rounding only the exposed outer corners. The 14px icons are optically centered; shadows and borders were removed from the painted silhouette. |

## Live verification

- `student-player-collapse-tabs-1440x900.png`: 44 × 72px hit targets, 24 × 72px painted tabs, 14 × 14px icons, 800px Workbench, and 1440 × 900 document.
- `student-player-collapse-tabs-1366x768.png`: 44 × 68.3px hit targets, approximately 22.8 × 68.3px painted tabs, 14 × 14px icons, 782px Workbench, and 1366 × 768 document.
- Both controls expose transient hover tooltips, a 2px focus outline with 2px offset, distinct hover/active teal states, and no transition under reduced motion.
- Enter collapsed and recovered Equipment; Space collapsed and recovered Inspector. Focus stayed on each control, labels changed between Collapse/Expand, and collapsed rails remained present.
- Collapsed recovery controls and 44px rail widths retained their previous geometry. Tablet, preview, and mobile selectors were not changed.
- `git diff --check -- src/styles/app.css design-qa.md`: pass.
- `npm run typecheck`: pass.

## Intentionally unrun

Vitest, full suites, broad E2E/browser matrices, camera or gesture hardware, performance, mobile, deployment, and broad accessibility certification remain intentionally unrun under the repository validation policy.

---

# Student Player Action Details and Drag-to-Zone Repair

Date: 2026-08-23
Route inspected live: `#/play/acid-base-titration`
Visual source: `exec-6fb83b60-0994-4029-8b3a-0587e12f596d.png`

## Root cause and resolution

- At 1366 × 768, the hybrid inspector measured 638px client height and 737px scroll height, but a later legacy desktop selector overrode its owning overflow to `visible`. Expanded Action details ended at y=816.23 beneath the inspector's y=756 bottom and was clipped by the viewport-bound Player grid.
- The legacy sticky/visible rule is now isolated to `.process-sidebar.is-legacy-layout`. The hybrid Now inspector retains its existing `height: 100%` and `overflow: auto`, owns the necessary vertical scroll, contains overscroll, and keeps the document at one viewport.
- At 1440 × 900, expanded details fit without inspector scrolling. At 1366 × 768, 84px of inspector scroll brings the full details body and final completion rule above the inspector bottom. At 1024 × 768, 246px of inspector scroll exposes the full expanded body while the workbench and document remain fixed.

## Drag-to-zone mock comparison

| Mock characteristic | Implemented decision |
|---|---|
| Student instruction leads into source → target → primary action. | Preserved the authored instruction first, then kept source and target in runtime order with the existing directional cue on laptops and exactly one existing accessible primary action. |
| Equipment identity is visual as well as textual. | Added decorative art from the current equipment catalog only when the runtime-selected or Guided-required definition is available. Assessment does not receive expected-equipment art before selection. |
| The target is represented by the real current state. | The live first target is the Workbench station, not equipment. It uses a restrained workbench-zone grid rather than inventing the mock's graduated-cylinder target. |
| Readiness sits next to the action. | Added a non-live adjacent readiness/recovery line derived from the existing step status; the established live status and workbench utility status remain authoritative. |
| Technical metadata is progressive disclosure. | Removed the visible `drag to zone` interaction kicker from the primary task block. The interaction label remains once inside native Action details with evidence, prerequisites, and completion metadata. |
| Narrow layouts remain readable. | The 1024px inspector stacks Source then Target and uses one-column Action-details metadata. Laptop layouts retain the compact horizontal source-to-target flow. |

Intentional visual deviations: the mock's hard-water bottle, graduated cylinder, sample copy, and action label are illustrative and were not copied. The acid-base runtime supplies Ring stand and clamp → Workbench plus its authored action label. The existing keyboard icon, `data-gesture-action="confirm-accessible-action"`, callback, disabled state, assessment gating, and button order were retained instead of replacing the control with a mock-only interaction.

## Rendered evidence

- `student-player-action-details-baseline-1440x900.png`
- `student-player-action-details-baseline-1366x768.png`
- `student-player-action-repair-1440x900.png`
- `student-player-action-repair-1440x900-details-expanded.png`
- `student-player-action-repair-1366x768.png`
- `student-player-action-repair-1366x768-details-expanded.png`
- `student-player-action-repair-1366x768-assessment.png`
- `student-player-action-repair-1024x768.png`
- `student-player-action-repair-1024x768-details-expanded.png`

## Checks and limits

- `npm run typecheck`: pass.
- Bounded Chromium inspection at 1440 × 900, 1366 × 768, and 1024 × 768: document client/scroll dimensions matched at every viewport; 1366 Workbench client/scroll width remained 780/780px; 1024 Workbench remained 760/760px; expanded completion content was visible after inspector-only scroll.
- Bounded 1366px Assessment inspection: one primary action remained disabled, no expected source art was exposed, missing-selection recovery remained visible, and the document remained 1366 × 768.
- Bounded keyboard check: the Action details summary matched `:focus-visible` with a 2px teal outline; Enter opened the native disclosure and retained focus on its summary.
- Source review confirms the native keyed `<details>/<summary>` structure, tab order, reduced-motion rules, StudentPlayer props, compact-preview selectors, and gesture action attribute/callback were not replaced.

## Intentionally unrun

Vitest and all other test suites, broad E2E/browser matrices, camera or gesture hardware testing, performance testing, mobile testing, deployment, and broad accessibility certification were intentionally not run under the repository validation policy.

---

# Studio Setup and Preview Independent Elegance Review

Date: 2026-08-23
Route: `#/studio`
Primary viewport: 1440 × 900
Tablet reflow: 1024 × 768
Visual references: `exec-8e8d5e8e-67da-42fc-ab94-48616811249d.png`, `codex-clipboard-6264cc62-8d3b-4be4-a0a6-e3984210ed40.png`, `codex-clipboard-7d2824d7-05b1-4c3a-acfe-8c12d0e7d72f.png`, and `codex-clipboard-1c81e00a-a3ec-42e8-9eb5-4cb77494e4e2.png`

## Independent audit

| Priority | Finding | Resolution/status |
|---|---|---|
| P0 | None confirmed. | Draft, transaction, runtime, gesture, route, storage, and resizing contracts remain unchanged. |
| P1 | The dedicated Preview grid allowed its Workbench and inspector tracks to shrink to about 250px even though their children required 310px and 432px. The inspector consequently intruded 51.2px into the Workbench, reproducing the supplied apparatus/image overlap. | Resolved with Preview-stage-only max-content rows, a fixed 358px Workbench shell (310px Workbench plus 48px utility strip), a bounded 360px internally scrolling inspector, and one owning vertical scroll region. The inspector now begins 57.1px below the bench surface. |
| P2 | Setup repeated ten 246 × 180px equipment cards, 161px-wide Add starting item controls, heavy bordered delete chrome, and 62px two-line empty states. | Resolved. Representative cards are 247.8 × 129.6px, Add starting item is 135.4 × 40px, delete remains a true 40 × 40px target with transparent resting chrome and explicit accessible/title text, and the empty state is a single 16px line. |
| P2 | Preview shelf apparatus used nominal equipment geometry inside a 46px clipped art region, creating inconsistent blank/cropped imagery. | Resolved only inside the dedicated Preview equipment row. Cards are 112 × 112px with a 60px containment region; all nine visible definition layers measured inside their art bounds at 1440 and 1024 without changing generated assets or Workbench geometry. |
| P3 | The Setup catalog header and grid had more padding and gap than the finished Process stage. | Resolved with a 75px sticky header, 7px grid gaps, 9px cards, smaller hierarchy metadata, and overflow-safe equipment IDs. |
| P3 | At 1024 the current stage design uses fixed 264px internal rails instead of modal Setup/Preview drawers. | Accepted. The resizers intentionally hide at this breakpoint, the main regions retain 760px, both rails and content scroll internally, and no document or horizontal overflow is introduced. A drawer rewrite is not justified by the supplied evidence and would expand scope. |

## Live interaction and geometry evidence

- 1440 Setup: document 1440 × 900; stage Workbench 1440 × 728; rail 396px; equipment region 1036px; four-column card grid; add/remove actions remained keyboard-focusable and 40px high. Add starting item created one transaction-backed instance while focus remained on the invoking control; the compact remove action deleted it. Collapse removed the workbench and exposed the Expand recovery control; Expand restored it.
- 1440 Preview: document 1440 × 900; Preview grid client/scroll height 708/936px; equipment shelf 174px; Workbench shell 358px; bench surface 272px; inspector 360px with its own 428/358px scrollable content. Two representative real apparatus items were placed through the normal shelf path and remained fully inside the bench: sample bottle 92 × 124px and graduated cylinder 128 × 178px.
- 1024 Setup: document 1024 × 768 with no horizontal or document overflow; rail 264px; main content 760px; three-column 237px cards; independent rail/content scrolling retained.
- 1024 Preview: document 1024 × 768 with no horizontal or document overflow; rail 264px; Preview 760px; equipment-row client/scroll width 722/1072px; all nine art layers contained; Workbench and inspector retained a 57.1px non-overlap gap in the owning vertical scroll region.
- The distinct Process Split preview was not restyled or removed. All selectors added for imagery and vertical composition are scoped to `.preview-panel.is-stage-preview`.

## Bounded static verification

- `npm run typecheck`: pass.
- `git diff --check -- src/studio/TeacherStudio.tsx`: pass.
- No-index `git diff --check` reported no whitespace diagnostics for the two relevant untracked code/test files. The untracked aggregate `design-qa.md` still contains older, unrelated Markdown hard-break whitespace; the new Studio Setup/Preview entry adds none.

## Remaining verification gaps

- The browser session reported pre-existing ReactFlow SVG `NaN` console errors when the hidden Process canvas was mounted. They were not introduced by these Setup/Preview selectors and were not expanded into an unrelated Process repair.
- 1366px was not separately rendered because the 1440 and 1024 measurements showed no material breakpoint-specific difference requiring another review.

## Intentionally unrun

Vitest, full suites, broad E2E/browser matrices, camera or gesture hardware, performance, mobile, deployment, and broad accessibility certification remain intentionally unrun under the repository validation policy.

---

# Student Player Open Collapse-Tab 0.60 Scale Micro-Fidelity

Date: 2026-08-23  
Visual source: `codex-clipboard-d9e14d32-74f2-415e-b2a7-a02007d76730.png`  
Route inspected live: `#/play/acid-base-titration`

| Viewport | Before | After | Result |
|---|---|---|---|
| 1440 × 900 | 44 × 72px hit box; 24 × 72px paint; 14px icon; 10px source radius | 44 × 44px hit box; 14.4 × 43.2px paint; 8.4px icon; 6px painted radius | Pass. `result = source × 0.60`; diagonal changed from 75.895px to 45.537px. |
| 1366 × 768 | 44 × 68.297px hit box; 22.766 × 68.297px paint; 14px icon | 44 × 44px hit box; 13.659 × 40.978px paint; 8.4px icon | Pass. Diagonal changed from 71.991px to 43.195px. |

- The Equipment tab scales from its straight right edge and the Inspector tab from its straight left edge. Their painted divider deltas are 0px at 1440 and ±0.008px at 1366 after browser subpixel rounding.
- The two silhouettes remain true mirrors. Painted icon inset changes from 5px to 3px at 1440 and from 4.383px to 2.630px at 1366.
- Enter collapsed and recovered Equipment; Space collapsed and recovered Inspector. Focus remained on each control, `aria-expanded` and accessible names changed correctly, and both collapsed recovery rails remained 44px.
- The visible focus ring follows the compact silhouette; hover/active alter color only; reduced-motion reports a 0s silhouette transition.
- Document dimensions, 800/782px Workbench shell widths, and 798/780px Workbench client/scroll widths were unchanged with no document or Workbench overflow.
- Evidence: `student-player-collapse-tabs-scale60-1440x900.png`, `student-player-collapse-tabs-scale60-1366x768.png`, and `student-player-collapse-tabs-scale60-focus-1440x900.png`.
- `git diff --check -- src/styles/app.css design-qa.md`: pass.
- `npm run typecheck`: pass.

## Intentionally unrun

Vitest, full suites, broad E2E/browser matrices, camera or gesture hardware, performance, mobile, deployment, and broad accessibility certification remain intentionally unrun under the repository validation policy.
