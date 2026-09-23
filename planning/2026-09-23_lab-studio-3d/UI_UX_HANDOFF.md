# Lab Studio 3D: UI/UX handoff

Revision 1, 2026-09-23. This is the companion to `IMPLEMENTATION_PLAN.md` (revision 2.1) in this folder. It is a planning document only: writing it changed no Lab Studio source, content or build.

The brief:
- **Studio 3D** takes the **clarity** of `Lab_studio\v2\Lab_Studio_Photoreal_Bench\index.html`.
- **Player3D** takes the **beauty and functionality** of `virtual_lab\experiments\dna-microarray-3d\microarray-3d-v3.html`. It goes further on engagement, starting with **moving objects around freely**.

## 0. Precedence and how to read this

- **Division of responsibility.**
  - The plan governs scope, architecture and scientific fidelity.
  - This handoff governs layout, visual design, interaction and copy.
  - If the two conflict, the guardrails in section 1 win. The conflict is reported, not designed around.
- **The two references are design references only.** Neither is imported (plan §12).
  - `Lab_Studio_Photoreal_Bench` is a 2.5D arrangement demo built from adapted, AI-generated concept artwork. Its labels and graduations are unverified (`ASSET_PROVENANCE.json`), so its imagery must not be reused.
  - `microarray-3d-v3` belongs to another project (`virtual_lab`). Its patterns are re-implemented here. Its code, protocol model and MediaPipe hand pipeline are not used.
- **Source facts.** Facts marked **(2D)** come from the source snapshot the plan uses (main `1d28429`); the appendix gives file and line for each. `reducer.ts`, `attachments.ts` and several player files differ in the authoritative working copy (plan §2.8). Every (2D) fact must therefore be re-checked against the baseline reconciled in M0 (plan D1).
- **Placeholders.** Text in angle brackets, such as `<step instruction>`, stands for authored content that is shown verbatim. This handoff never supplies example instructions, readings or values.

## 1. Guardrails that shape the UI

| # | Rule | Source | What it means on screen |
|---|---|---|---|
| G-1 | Instruments are measurement-neutral | plan §2.4, D7 | A display may show configured settings, status, a `simulator-generated` readout where one exists (the pH meter, in later packs), or the learner's own entry labelled "Your entry". The balance shows no mass and the photometer shows no %T. |
| G-2 | Values come only from the step's input field | plan §2.4 | There is no "pour to the mark" control and no draggable volume. The input field sits above the action and is filled first. |
| G-3 | The resting scene equals runtime state | plan §2.4, §4.4 | Tilts, ghosts and footprints are cues shown during a drag. When motion stops, every object is where the runtime has it. |
| G-4 | A refusal changes nothing | plan §4.5 | The UI shows the runtime's `message` and `recovery` and calls `recordAssessmentFailure`. The object springs back to where it was. |
| G-5 | Nothing commits during a drag | plan §4.5 | A drag commits on release, and a keyboard move on Enter. Esc cancels either. |
| G-6 | Every step can be done without the canvas | plan §2.3, §5.3 | The step card carries the accessible action flow (Source, Target, Confirm), with `ProcessSidebar`'s enabling rules, and the Bench list selects equipment (section 5.11). |
| G-7 | Guidance is for guided mode only | (2D) `showGuidance = runtime.mode === "guided"` | The beacon, Show me, expected source and target highlights, tray "needed now" dots and step-focused framing appear only in guided mode. Drag-overlap feedback (valid or invalid ring, pour cue) shows in **both** modes, as the 2D workbench does. |
| G-8 | Physical plausibility never creates runtime objects | plan D9 | Scenery such as a test-tube rack is drawn but not selectable, is not listed as equipment, and is labelled "Scenery" in Examine. |
| G-9 | There is one liquid palette | plan §2.5 | Liquids take their colour from `resolveLiquidStyle`. UI highlights avoid liquid hues and always pair colour with an icon. |
| G-10 | There is one gesture system | plan D6 | The hand-control panel presents the shared bridge. It adds no gesture meaning of its own. |
| G-11 | No sound | handoff constraints | There are no audio cues anywhere. |
| G-12 | Laptop, tablet and larger only | handoff constraints | Layouts start at 768 px (section 7). There is no phone layout. |
| G-13 | UI state is stored separately from runtime state | plan §4.7 | UI preferences use their own keys (section 3.8). The Player persists no run state, and neither does the 2D player. |

## 2. What to take from each reference

### 2.1 Studio 3D from the Photoreal Bench: clarity

Observed in `source/page.html`, `source/style.css` and the screenshot `tests/final_1440.png`:

- **Frame.**
  - A 69 px top bar holds the brand mark, product name, a divider and the context, with status and help on the right.
  - A heading band holds an eyebrow breadcrumb, a 26 px title with a status pill and a one-line description, with two quiet actions on the right.
  - The workspace has three columns (`192px | 1fr | 250px`) with 11 px gaps and 13 px radii, and its height is `100dvh − 216px`. A one-line footer closes the page.
- **Left: the catalogue.** A title with a count, a search field and category chips sit above two-column thumbnail cards (name plus one detail line). A footer tip reads "Drag onto the bench. Drag back here to return."
- **Centre: the work surface.** It is the only dark, photographic element on the page, with five overlays:
  - a translucent badge at top left ("BENCH 01 · 11 objects · drag to rearrange");
  - an expand button at top right;
  - a dark floating toolbar at bottom centre: mode, then Snap, Depth and Labels, then zoom;
  - hover callouts on objects;
  - an empty-state card that teaches the first action.
- **Right: the inspector.** It has three tabs (Object, Guide, Scene).
  - The object view shows a preview, the name, a detail line, a property list, a nudge pad, actions and a short honest note ("Connected, not baked in.").
  - The footer carries a status line and undo/redo.
- **Behaviour.**
  - Snapping is magnetic: a green target appears, and Alt bypasses it. Supported items follow their support.
  - A Scene list reaches obscured items. There is also an activity log, plus save and open.
  - The Guide tab lists a full keyboard map.

"Clarity", as rules for Studio 3D:

1. **One job per region:** find on the left, make in the centre, understand and adjust on the right.
2. **The work surface dominates.** It is the largest element and the only high-contrast one. Chrome stays pale, with hairline borders.
3. **One primary button per region at most.** Everything else is an outline or icon button.
4. **Status is always visible in two places:** the stage badge (what, and how many) and the inspector footer (last change, undo and redo).
5. **Direct manipulation shows its result before release**, through a target, an insertion marker or a ghost.
6. **Short honest notes** sit wherever a misunderstanding is likely.
7. **Anything hidden on the surface can be reached from a list.**
8. **The empty state teaches the first action.**

Do not take:
- the photographic background or product imagery (provenance);
- 2.5D depth scaling: the Studio stage is either a flow canvas or the real 3D bench;
- its 9–10 px greys (`#74807a` is about 4.1:1 and `#8a938c` about 3.1:1 on its panels, both below WCAG AA; section 3 fixes this);
- "Copy" as a bench action: a new starting instance comes from the library instead.

### 2.2 Player3D from microarray v3: beauty and function

Observed in `microarray-3d-v3.html`, `3d-v3/style.css` and `3d-v3/README.md`:

- **Full-bleed scene.** Below a 52 px top bar, the bench fills the window.
  - Everything else floats in small translucent panels (`#fafdfaf2`, blur 6 px, radius 12 px).
  - Panels can be dragged by the header, resized from any corner and collapsed.
  - The layout is remembered, and the menu can reset it.
- **Step card** (top left, 372 px wide). From the top:
  - step badge and a "Step n of N" eyebrow;
  - title;
  - segmented progress strip;
  - **the next action in 17 px semibold, on a tinted band with a teal rule** (aria-live);
  - "Show me";
  - a correction block that names the mistake and gives a hint, is dismissible, and stays until the next success;
  - step-specific controls;
  - "About this step".
  
  The card collapses to one line.
- **Guidance in the world.**
  - A soft double-ring beacon marks the next target, and can be switched off.
  - A dark label sits under the target.
  - Auto-framing fits the step's working set into the free area around open panels. It tweens over 650 ms, never moves during a stroke, and yields to manual camera control until the next step.
- **Dock and help panels.**
  - The dock sits at bottom centre, with 56 px buttons and a one-line hint above it.
  - Camera views sit behind a menu: "Auto · follow the step", whole bench, zone views and overhead.
  - **Targets** is the accessible twin of the canvas: "the same checks apply".
- **Notebook** as a resizable side sheet, so the bench stays visible.
- **Around the run.** A debrief shows corrections by area. A help dialog states the model's limits and sources. A loader offers a 2D fallback link.
- **Colour** comes from real objects. Large surfaces stay low-saturation and mid-tone, and saturated colour is reserved for meaningful signals.

Do not take:
- **Run, Pause, Stop and the clock.** Pack 1 has no timed steps (section 5.4).
- **The tool-selection model** (micropipette, return tool). Lab Studio's interactions are drag-based.
- **Save and resume.** The 2D player persists no run state, and resuming would need a validated restore (decision U8).
- **The safety checklist.** It is that experiment's content, and nothing is invented for Lab Studio.
- **Its hand-control tuning** (aim assist, lock-on). That belongs in the shared bridge, as a reviewed change, or nowhere (G-10).
- **Its focus gold `#c7982a`.** It is about 2.6:1 on light panels, below the 3:1 that focus indicators need (section 3.1).

## 3. Shared design system

Both apps use one token set in `src/studio3d/styles/tokens.css` (plan §4.2). The Studio and the Player differ in layout, not in vocabulary.

### 3.1 Colour

```css
:root {
  /* Foundation, after the Photoreal Bench, with the greys darkened to reach AA */
  --bg: #f5f6f1;  --panel: #fdfefb;  --panel-solid: #ffffff;
  --line: #e0e5db;  --line-strong: #cad5c7;
  --ink: #233934;  --ink-2: #44574f;  --muted: #5d6b64;     /* on --panel: 12.2:1, 7.6:1, 5.5:1 */
  /* Brand: selection, primary buttons, active states (Photoreal Bench) */
  --brand: #2a5a49;  --brand-hover: #224838;  --brand-tint: #ecf3ed;   /* white on --brand: 7.9:1 */
  /* Guidance: next action, beacon, Show me, progress (microarray) */
  --guide: #197b7b;  --guide-strong: #126767;  --guide-tint: #e3f1ec;  --guide-band: #eef6f1;
  /* Semantics */
  --ok: #2d7960;     --ok-tint: #e5f2ec;
  --error: #9a4b37;  --error-tint: #fbeee8;                  /* 5.4:1 */
  --warn: #7d5a12;   --warn-tint: #fbf3df;                   /* 5.7:1 */
  --focus: #a8791a;  /* 3 px outline with a 3 px offset: 3.8:1 on --panel, 3.1–3.6:1 across the dark toolbar */
  /* Over the 3D stage */
  --glass: #f7faf2cc;   --glass-line: #ffffff6b;             /* badges; blur 15 px */
  --float: #fafdfaf2;   --float-line: #cfe0d6;               /* floating panels; blur 6 px */
  --toolbar: linear-gradient(160deg, #283b32f2, #1c3027eb);  --toolbar-ink: #f0f4ed;
  --label-bg: #183c43e6; --label-ink: #ffffff;               /* hover and target labels */
  --canvas: #f7f8f4;    --canvas-dot: #dfe4da;               /* flow canvas */
}
```

- **Brand vs guidance.** Brand green means "you chose this" (selection, primary action). Guidance teal means "the lab suggests this" (next action, beacon, Show me). They are not interchangeable.
- **Liquid hues.** Liquid colours never appear in chrome (G-9). Chrome avoids indicator-like pinks, purples and saturated blues.
- **Verification.** The M0 token review recomputes every contrast pair listed here: text at least 4.5:1, UI and focus at least 3:1.

### 3.2 Value provenance chips

This is the most important new component. Any value that appears on screen carries one of these chips. That covers input fields, the notebook, results, instrument close-ups and the Studio inspector.

| Chip (learner wording) | Studio tooltip | Background / ink | Glyph | Plan §2.4 source |
|---|---|---|---|---|
| Teacher setting | `teacherConfiguration` input or setup slot | `#e8eef6` / `#2f4a6e` | clipboard | Teacher configuration |
| Your entry | `studentResponse` input | `#f4efe4` / `#5b4a24` | pencil | Learner observation |
| From the bench | runtime state | `#edf1ec` / `#44574f` | flask | Runtime state |
| Simulated | `instrumentReadout`, `provenance: "simulator-generated"` | `#eee9f6` / `#4f3d78` | chip | Simulator readout |
| Calculated | calculation evidence | `#e3f0ee` / `#1f5a57` | equals | Calculation |

A chip always carries its text label; colour is never the only signal. Numbers and units use the mono face, with a thin space before the unit.

### 3.3 Type

- **Family.** IBM Plex Sans 400, 500 and 600 for text; IBM Plex Mono 400 and 500 for values, units and ids; tabular numerals. Fonts are bundled locally, under the SIL OFL. This is decision U1; the alternative is Inter, as in the Photoreal Bench. Check the licence as plan §6.3 requires.
- **Scale** (px / line-height / weight):

| Role | Spec |
|---|---|
| Eyebrow | 10 / 1.5 / 600, caps, +1.4 px tracking |
| Chip and label | 11 / 1.4 / 500 |
| Small | 12 / 1.5 / 400 |
| Body | 13 / 1.55 / 400 |
| UI base | 14 / 1.45 / 400–500 |
| Panel title | 16 / 1.4 / 600 |
| Next action | 17 / 1.4 / 600 |
| Dialog title | 20 / 1.3 / 600 |
| Page title | 26 / 1.25 / 600, −0.9 px tracking |

- **Minimum size.** No text is smaller than 11 px. The Photoreal Bench's 9–10 px labels are raised.

### 3.4 Space, shape, depth, layers

- **Spacing.** A 4 px grid. Panel padding is 12 or 16 px, and region gaps are 11 px (Photoreal Bench).
- **Radii.** 6 px for inputs and chips, 8 px for buttons and cards, 12 px for panels, the stage and dialogs.
- **Elevation.**
  - Docked panels: `0 4px 18px #20342608`.
  - Floating panels: `0 10px 30px #1b3a3322, 0 2px 6px #1b3a3314`.
  - Dark toolbar: `0 7px 28px #111e1860`.
- **Layers**, from the bottom: scene 0, scene labels 10, panels 20, top bar and dock 30, toasts 40, dialogs 50, drag ghost 60.

### 3.5 Motion

| Event | Duration | Easing | Reduced motion |
|---|---|---|---|
| Hover, press | 120 ms | ease-out | unchanged |
| Panel collapse or expand | 200 ms | standard | instant |
| Snap into an anchor | 150 ms | ease-out | instant |
| Set-down settle (a 2–3 mm drop) | 120 ms | ease-out | instant |
| Camera framing | 650 ms | ease-in-out | cut |
| Pour | 600–1400 ms, scaled by volume | ease-in-out | skipped: levels jump to the committed state |
| Step complete (progress sweep and ✓) | 400 ms | ease-out | ✓ only |
| Beacon | 1.6 s loop | sine | static ring |
| Toast | 160 ms in; 4 s, or until dismissed for errors | ease-out | fade only |

The standard easing is `cubic-bezier(.2,.7,.2,1)`. Reduced motion follows `prefers-reduced-motion`, and the Player's Menu can also switch it on.

### 3.6 Icons

The icons are stroke icons on a 24 px grid, 1.7 px stroke, with round caps and joins, like the Photoreal Bench's symbol set.

| Icon family | Icon for each item |
|---|---|
| Node types | technique: stacked cards; action: the interaction icon; checkpoint: flag; decision: split arrow; calculation: equals; observation: eye; teacher note: note |
| Interactions | `dragToZone`: move; `snapIntoTarget`: seat; `pourInto`: pour; `readInstrument`: gauge; `recordNotebook`: pencil; `submitCalculation`: calculator |

### 3.7 The 3D look and in-scene signals

- **Look.** The scene uses the prototype look layer (plan §6.2):
  - bright sources near bench height;
  - contact shadows;
  - Khronos PBR Neutral tone mapping;
  - no bloom;
  - a low-saturation bench surface;
  - a soft-focus room with a slight vignette.
- **Signals.** An in-scene signal never relies on colour alone:

| Signal | Look | Shown |
|---|---|---|
| Beacon | Soft white double ring with a teal edge at the item's base; pulses | Guided mode, unless switched off |
| Hover label | Dark pill under the item: its label and the contents text the 2D player shows (`contentDisplay`). No extra numbers. | After 250 ms of hover; hidden while dragging, except on targets |
| Selected | 2 px brand outline plus a base ring | Always |
| Footprint | Hairline disc on the bench where the carried item will stand | While carrying |
| Valid target | Teal ring with ✓ at the anchor or footprint | Both modes (G-7) |
| Invalid target | Terracotta ring with ✕ | Both modes (G-7) |
| Pour cue | Source turns its lip to the target and tilts to about 30°; no stream | Both modes, during a drag |
| Detach warning | Callout: "Release to take it off `<holder>`" | While carrying a held item |
| Scenery | Never highlighted; labelled "Scenery" in Examine | Always |

### 3.8 UI storage keys

These keys store **UI preferences only, never runtime state**. Every read and write is wrapped in try/catch, and both apps work without storage.

| Key | Holds |
|---|---|
| `lab-studio:3d:v1:draft` | Studio 3D draft (plan §4.7) |
| `lab-studio:3d:v1:studio-ui` | stage view, column widths, toggles |
| `lab-studio:3d:v1:player-ui` | floating panel layout, beacon, auto view, graphics quality, reduced motion |

### 3.9 Shared components

These are proposed for `src/studio3d/ui/`, an addition to the presentation layer in plan §4.2:

- **Controls:**
  - `Button` (primary, secondary, quiet, icon, danger);
  - `SegmentedControl`;
  - `Chip` (status, provenance, count);
  - `KeyHint`.
- **Containers:**
  - `Card` (library, equipment);
  - `DockedPanel`;
  - `FloatingPanel` (drag by the header, four-corner resize, collapse, remembered);
  - `Tabs`;
  - `InspectorSection`, collapsible;
  - `Dialog` and `Sheet`.
- **Stage overlays:**
  - `GlassBadge`;
  - `StageToolbar` (dark);
  - `Callout`, for hover and drag;
  - `Toast`.
- **Step guidance:**
  - `NextActionBand`;
  - `ProgressStrip`;
  - `CorrectionBlock`;
  - `EmptyState`;
  - `NudgePad`.

## 4. Studio 3D

### 4.1 Frame (1440 × 900 and wider)

```
+----------------------------------------------------------------------------------------------------+
| [#] Lab Studio | Studio 3D        Saved in this browser   (o Ready)   [Preview]   Export   ?   ... |  60
+----------------------------------------------------------------------------------------------------+
| TECHNIQUE / PACK 1                                                                                 |
| <Title>  (3D-ready)                                                             [Open...]  [New v] |  88
| <one-line learning goal>                                                                           |
+---------------------+--------------------------------------------------------+---------------------+
| Library        (24) | (PROCESS . 3 steps . 0 issues) [Flow|Bench|Preview] [x]|Selected|Setup|Checks|
| [ Find...         ] |                                                        |---------------------|
| (Steps) (Equipment) |    +-----------+     +-----------+     +-----------+   | ACTION . <VERB>     |
| +-------+ +-------+ |    | ACTION    |---->| ACTION    |---->| OBSERV.   |   | <step title>        |
| | thumb | | thumb | |    | <title>   |     | <title>   |     | <title>   |   | > Step              |
| | name  | | name  | |    | [eq][eq]  |     | [eq]      |     | [chip]    |   | > Action & interact.|
| +-------+ +-------+ |    +-----------+     +-----------+     +-----------+   | > Validation        |
| ...                 |                                                        | > Evidence          |
|                     |  +-------------------------------------------------+   | > Connections       |
| Drag onto the flow. |  | Select Connect | Snap Layout Map | - 100% + Fit |   | [Preview from here] |
| Click adds after... |  +-------------------------------------------------+   | o <last change> < > |
+---------------------+--------------------------------------------------------+---------------------+
   248 px                  minmax(560px, 1fr)                                        320 px
```

- **Heights.** The top bar is 60 px, the heading 88 px and the footer 28 px. The workspace is `calc(100dvh − 204px)`, with a 520 px minimum.
- **Widths.** The columns are `248px | minmax(560px, 1fr) | 320px`, with 11 px gaps.
- **Colour weight.** The stage is the only high-contrast region. Everything else uses `--panel` with hairline borders.

### 4.2 Top bar and heading

- **Top bar, left:** brand mark, then "Lab Studio", a divider, and the context "Studio 3D".
- **Top bar, right, in order:**
  - save status: "Saved in this browser", "Saving…", or "Not saved: storage is unavailable";
  - readiness chip ("Ready" or "n issues"), which opens the Checks tab;
  - **Preview**, the region's primary button, which switches the stage to Preview;
  - Export;
  - help (?), which holds the how-to and the keyboard map (the Photoreal Bench's Guide tab moves here, so the inspector stays about the draft);
  - overflow: Import, "Open in the original Studio…" and "Keyboard shortcuts".
- **Heading:**
  - an eyebrow for kind and context: `TECHNIQUE / PACK 1` or `EXPERIMENT / DRAFT`;
  - the title, editable inline through `updateTechniqueSettings` or `updateLabSettings`;
  - a status pill: `3D-ready`, `Needs setup`, `Host-bound`, `Detached from compiler` or `Read-only`;
  - a one-line description, which is the learning goal;
  - on the right, "Open…" and "New ▾" (Technique or Experiment).
- **Refinement of plan §5.1.** The "mode switch" is the draft's artifact kind. It shows in the eyebrow and pill, and chooses what the library offers. **An open draft's kind is never flipped in place.** "New" creates the other kind.

### 4.3 Library (left)

- **Header:** "Library" with a count, a search field, and chips for `Techniques` (experiment drafts only), `Steps` and `Equipment`.
- **Technique cards:**
  - Blender composite thumbnail, name, and a detail line ("<n> steps");
  - a status chip: `3D-ready`, `Needs setup`, `Not yet in 3D`, or `Host-bound`;
  - a host-bound card also lists its host experiments as links: `intro-filtration-demo` and `hard-water-demo` for `measuring-volume`.
- **Step template cards** are grouped by verb and carry the verb icon: "Weigh item", "Measure volume", "Make solution", "Dilution", and so on (plan §2.1: these are the generic templates).
- **Equipment cards:** a Blender thumbnail, the name, capacity and precision from the catalogue, and a `3D` or `2D only` chip.
- **Adding from the library:**
  - drag a step or technique onto the Flow, or equipment onto the Starting bench;
  - click or Enter adds at the default place: after the selected step, or at the next free bench spot;
  - a "+" appears on the card's corner on hover, as in the Photoreal Bench;
  - the footer tip changes with the stage view.

### 4.4 Stage: Flow view

- **Canvas and chrome.**
  - The canvas is `--canvas` with a 24 px dot grid.
  - A glass badge at top left reads `PROCESS · <n> steps · <n> issues`.
  - A segmented control at top centre switches between `Flow`, `Starting bench` and `Preview`.
  - An expand button sits at top right; Esc leaves expanded mode.
- **The dark toolbar** has four groups:
  1. `Select` or `Connect`;
  2. `Snap to grid`, `Auto-layout`, `Minimap` and `Details` (compact or full);
  3. zoom: `−`, `100%`, `+`;
  4. `Fit`.
  
  The minimap sits at the bottom right, above the toolbar.

**Nodes** are 232 px wide:
- **Header row:** type icon, eyebrow (`ACTION · WEIGH`) and an issue badge.
- **Title:** 14/600, at most two lines. The full text appears in a hover callout.
- **Equipment strip:** up to three 28 px Blender thumbnails, then "+n".
- **Chips:** validation type, the input role as a provenance chip, and evidence.
- **Hint marker:** shown when the step has hint text.
- **Start step:** a "START" flag on the left edge.
- **States:** selected nodes get a 2 px brand outline and a soft glow. A node with issues gets a terracotta left rule and a count.

| Node type | Distinguishing cue (shape and icon, not colour) |
|---|---|
| `technique` | Stacked-card shadow. In Phase B compiled drafts, a group frame with entry and exit ports (D8 b). |
| `action` | Standard card with the interaction icon |
| `checkpoint` | Flag on the header |
| `decision` | Labelled out-handles, one per outgoing condition |
| `calculation` | Tolerance chip |
| `observation` | Notebook chip |
| `teacherNote` | Pale note card with a dashed border; the eyebrow says "not played" |

**Edges** are styled by condition:

| Condition | Line | Badge |
|---|---|---|
| `always` | 1.5 px `--ink` at 45 % | none |
| `validationPassed` | 1.5 px `--brand` | ✓ |
| `retry` | 1.5 px dashed `--warn`, routed back | ↺ |
| `calculationResult` | 1.5 px dotted slate | = |

A label pill appears at the midpoint of an edge on hover or selection.

**Magnetic editing** (the Photoreal Bench's green target, applied to the graph):
- **Insert on an edge.** Dragging a library step over an edge brightens it and shows a "+" insertion marker. Release inserts the step with `appendTemplateStep` (anchor and placement). A step dropped on empty canvas goes after the selected step.
- **Connect.** In Connect mode, or when dragging from an out-handle, compatible in-handles show a teal ring. Release opens a two-item menu, Branch or Retry, which calls `addBranchEdge` or `addRetryEdge`.
- **Alt** bypasses grid snapping.
- **One change, one transaction.** Every committed change is a single transaction with a readable label, and the footer status line and the Activity list show that label.

**States:**
- **Empty:** a centred glass card, "Build your technique". It says "Drag a step from the library, or open a published technique." and has the primary button "Open a published technique".
- **Read-only** (a published technique): the banner "Published technique · read-only", with "Edit a copy", which calls `labDraftFromTechnique` and `replaceDraft`.
- **Detached** (a compiled experiment after an edit): the banner "Detached from the compiler. Edits are not compiled until the compiler runs again." This is the existing rule. The Studio cannot recompile until Phase B (plan E0, E1).
- **Flattened experiment draft** (D8 a):
  - The badge reads `EXPERIMENT · FLATTENED`.
  - The inspector note reads "Techniques are copied with their own equipment. A vessel does not carry across techniques. The compiled path in Phase B does this."
  - Where the draft records which technique each step came from, faint group frames show it; the frames cannot be edited.

### 4.5 Stage: Starting bench view

This view is the Photoreal Bench's interaction model on the real 3D bench, used to arrange `initialState.equipment`. It is new UI over existing operations (decision U3).

| Gesture | Operation |
|---|---|
| Drag equipment from the library onto the bench; or click or Enter on a card | `upsertInitialEquipment`: a new id from the Studio id allocator, location `workbench`, `x` and `y` through `benchCoordinates` |
| Drag an item on the bench | `upsertInitialEquipment` with the new `x` and `y`, on release |
| Drag between the bench and the **starting shelf strip** at the bottom of the stage | `upsertInitialEquipment` with location `workbench` or `shelf` |
| Delete | `removeInitialEquipment`, with undo |
| Drop onto a zone anchor (green target) | `upsertInitialEquipment` with location `snapZone` and `snapZoneId`, **only once M6 verifies** that `resolveAttachments` builds the relation from a starting instance. Until then, anchors show but are disabled, with the note "Starting an item seated is not supported yet." |

- **Toolbar:** `Arrange`, then `Snap to zones` and `Labels`, then camera presets `Front`, `Top` and `Reset`.
- **Alt** bypasses snapping.
- **Inspection.** Double-click or Enter opens the equipment inspection dialog (section 4.8).
- **Supported items** follow their support. Moving a seated item off its support shows the Photoreal Bench's note, "Moving detaches this item."
- **Nothing selected.** The inspector lists "On the bench" and "On the shelf", like the Photoreal Bench's Scene tab, so hidden items can be reached.
- **Positions note** (inspector): "Positions are stored in the units the 2D player uses, so this draft still plays there."
- **Contents** show as a read-only summary with a liquid swatch. Starting contents are edited in the existing inspector fields.

### 4.6 Stage: Preview view

- **Engine.** Player3D runs in preview chrome, with `focusNodeId` and `focusVersion`. It opens from "Preview from here" in the inspector, or from the stage switch.
- **Toolbar:** `Restart`, `Guided` or `Assessment`, `◂ Step ▸`, and `Open full player`.
- **Preview notice.** When earlier steps have not supplied a source, the preview shows the existing notice: "Preview uses current bench state; complete prior steps to supply this source."
- **Nothing is saved.** Preview runs are not persisted.
- **Split view** (1600 px wide and above): Flow on the left and Preview on the right. Selecting a node moves the preview to it.
- **Not 3D-ready.** If a draft is not 3D-ready, the view lists the missing models and links to the 2D preview route.

### 4.7 Inspector (right)

The plan's six inspector areas are grouped into three tabs. The content is unchanged; only the grouping is new.

- **Selected.** Its content depends on the selection:
  - **Step:**
    - **Step** section;
    - **Action & interaction** section: the verb, equipment roles with thumbnails, the resolved interaction (noted "derived from the verb" when it is not authored), the zone, and the input field with its role chip;
    - **Validation** section: the seven rule types;
    - **Evidence** section;
    - **Connections** section: outgoing edges, "Add branch", "Add retry" and "Set as start";
    - footer buttons: "Preview from here" and "Delete step".
  - **Edge:** source and target, a condition select for the four conditions, and Delete.
  - **Equipment:**
    - a 3D preview, capacity and precision, owned zones, and a contents summary;
    - its placement, with a nudge pad;
    - "Return to shelf" and "Remove".
  - **Technique instance** (experiments): source technique, configuration summary, ports and state.
  - **Nothing selected:** the step outline in Flow, or the bench list in Starting bench.
- **Setup:**
  - artifact settings;
  - configuration slots with teacher approval;
  - equipment roles;
  - required equipment (`updateEquipmentList`, `addEquipment`, `removeEquipment`);
  - a read-only summary of the technique's `composition` contract, with a D10 note until that fix lands.
- **Checks:**
  - readiness from `studioReadiness` and `studioValidation`, grouped into Blockers, Warnings and Notes, each linking to its node;
  - 3D readiness, meaning a model is present for each piece of equipment;
  - Activity: transaction labels, newest first;
  - Save and open, through `importExport`.
- **Footer**, on every tab: a status dot, the last change, and undo/redo, using the same snapshot approach as `TeacherStudio`.

### 4.8 Dialogs

- **Configure before append.** This opens when adding a technique to an experiment. It shows:
  - the thumbnail;
  - the configuration slots with units;
  - an approval checkbox;
  - any blockers: `measuring-volume` shows its host-bound message and links.
  
  "Add workflow" stays disabled until the form is valid. The layout follows `TeacherSetupLayout`.
- **Open and New.** Open lists published techniques by pack, and drafts. New creates a technique or an experiment.
- **Import and export.** Validation errors are listed with their JSON paths.
- **Equipment inspection.** A turntable of the model, its zones and capacities, and its provenance: Blender version and generator path.
- **Open in the original Studio.** This dialog explains that the two Studios store drafts separately (plan §11), and offers "Export draft".

### 4.9 Studio keyboard map

| Key | Flow | Starting bench |
|---|---|---|
| Arrows | Move the selection along edges | Move the selected item 10 mm |
| Shift + arrows | Nudge the node 8 px (1 px with Alt) | Move the item 50 mm |
| Enter | Open the selection in the inspector | Inspect |
| C | Start a connection from the selection | — |
| Delete | Remove, with an undo toast | Remove from the starting setup |
| Ctrl/⌘ Z, Ctrl/⌘ Shift Z | Undo, redo | Undo, redo |
| Esc | Cancel a drag or connection, or leave expanded mode | Cancel a drag |
| Home / F | Fit all / frame the selection | Reset view / frame the selection |
| Space + drag | Pan | — |

These single-letter keys work only while the canvas has focus (WCAG 2.1.4).

### 4.10 Studio at smaller widths

- **1280–1439 px:** the columns become `224px | 1fr | 296px`.
- **1024–1279 px:** the Library collapses to a 56 px icon rail with a flyout.
- **768–1023 px:**
  - the Library becomes a drawer, opened from the top bar;
  - the Inspector becomes a bottom sheet (40 % of the height, draggable), just as the Photoreal Bench moves its information panel below the bench on a tablet;
  - the stage keeps the full width.

## 5. Player3D

### 5.1 Frame (1280 px and wider)

```
+----------------------------------------------------------------------------------------------------+
| [#] <Technique>  TECHNIQUE . PACK 1        Step 2 of 3 . (Guided)              Notebook   ?   Menu |  52
+----------------------------------------------------------------------------------------------------+
| +----------------------------------+                                                               |
| | (2)  STEP 2 OF 3            [^]  |                                                               |
| | <step title>                     |                 live 3D bench                                 |
| | [=====|=====|     ]              |                 (full bleed)                                  |
| | #<step instruction, verbatim>    |                                                               |
| | <input label> [______ g]         |                 (( beacon ))                                  |
| |               (Your entry)       |                                                               |
| | Source [<item> v]                |                                                               |
| | Target [<item> v]   [Confirm]    |                                                               |
| | Show me      About this step     |                                                               |
| +----------------------------------+                                                               |
|                                                                                                    |
| +--------------+                 <control hint, one line>                                          |
| | Tray (3)     |      +--------------------------------------------------------------------+       |
| | [a] [b] [c]  |      | Tray  Bench list  Examine | Hand control | Auto view v  Reset view |       |
| +--------------+      +--------------------------------------------------------------------+       |
+----------------------------------------------------------------------------------------------------+
```

- **Default layout.**
  - The top bar is 52 px.
  - The step card sits at top left, inset 14 px, 372 px wide.
  - The tray sits at bottom left.
  - The Bench list opens at top right.
  - The notebook sheet docks on the right and is closed by default.
  - The dock sits at bottom centre.
- **Floating panels** (step card, tray, Bench list, hand control) have the microarray's behaviour:
  - drag by the header;
  - resize from any corner;
  - collapse;
  - remembered layout, with "Reset panel layout" in the Menu.
- **Auto-framing** fits the working set into the space left free by these panels (section 5.9).

### 5.2 Loader and fallback

- **Loading.** A neutral bench backdrop sits behind a glass card holding the title, "Preparing the bench…" and a progress bar. The bar counts the bytes of the technique's GLBs, taken from the registry.
- **Fallback link.** "Open the 2D version" is always visible. It **navigates** to `#/technique/:id` (plan D3).
- **No WebGL 2.** The card explains why the 3D view cannot run and offers the same navigation.

### 5.3 Setup gate ("Before you start")

This is a glass dialog on the right, following the microarray's two-page pattern. It has the same behaviour as the `#/technique/:id` route.

1. **Before you start.**
   - The title and learning goal.
   - A journey strip: the process steps in order, numbered, with at most 8 shown, then "and n more".
   - The setup status.
   - "Start".
2. **Setup**, only when standalone configuration is needed.
   - The configuration slots with teacher approval, and "Save setup and start".
   - When setup is **blocked**, the gate shows the blocker message and **no** start button.
   - `measuring-volume` shows its host-bound guidance, with links to its host experiments. These become playable after Packs 2 and 3 (plan E3).

Nothing is invented for the gate. It shows no safety checklist unless the definition carries one.

### 5.4 Top bar

- **Left:** brand mark, the technique title, and a source badge (`TECHNIQUE · PACK 1`).
- **Centre:** "Step n of N" and the mode chip (Guided or Assessment).
- **Right:**
  - "Notebook", which shows a dot when the current step needs it;
  - help ("Controls & model");
  - the Menu (section 5.16).
- **No clock yet.** Pack 1 has no clock, so there is no Run, Pause or Stop. A pack with timed steps (for example Pack 2's drying) adds a clock control here, designed with that pack.

### 5.5 Step card

1. **Header:**
   - step badge;
   - the eyebrow `STEP n OF N`, with the same count and order as the 2D player, over `process.nodes`;
   - a node-type chip when the step is not an action;
   - a collapse control.
2. **Title**, from the node.
3. **Progress strip.** Completed segments come from `completedNodes`. The current segment carries a soft pulse in guided mode.
4. **Next-action band.** The step's instruction, **verbatim**, at 17/600 on `--guide-band` with a 3 px `--guide` rule. It is `aria-live="polite"`.
5. **Input field**, when the action has one:
   - the authored label, as written;
   - a provenance chip: "Teacher setting" for `teacherConfiguration`, "Your entry" for `studentResponse`;
   - a unit suffix;
   - the existing validation message;
   - an optional note field.
   
   The field comes before the action (G-2).
6. **Accessible action flow.**
   - `Source [<item> ▾] → Target [<item> ▾]` and `Confirm`, with `ProcessSidebar`'s enabling rules.
   - The rules disable Confirm until the input is ready and prerequisites are met, and while a configuration lock applies.
   - In guided mode the chips show the expected equipment, as the 2D sidebar does. In assessment mode they read "Choose…".
7. **Show me** (guided only; section 5.9) and **About this step** (the node's description and hints only).
8. **Correction block** (section 5.13), when one is present.
9. **Collapsed state:** one line, "Step n · `<title>`".

### 5.6 Moving objects freely

This is the headline engagement feature. It is faithful because the 2D player already has it (2D): a free bench move is a runtime action, `place` with `parameters.benchMove: true`. The move carries `x`, `y` and `zIndex` (`movePlacedEquipment`).

**What the learner can do.** Pick up any item on the bench, carry it anywhere on the bench surface and set it down. The bench stays exactly as they left it, because the move is runtime state.

**Pick up.**
- Press on the item and move 4 px, or hold for 120 ms. On touch, press and hold for 300 ms.
- The item lifts by 12–20 mm, scaled to its grip height. Its contact shadow softens and widens, and a footprint disc appears where it would stand.
- Carrying uses the bench plane, plus the prototype's lift plane for targets above bench height (`dragPoint`).
- Items **supported by the carried item and locked to it** come along in the preview. This mirrors `moveLockedChildren`. Unlocked attached items stay where the runtime keeps them.

**While carrying.** Targets are resolved by `footprints` and `resolveBenchOverlap` (plan §4.1):

| Situation | Ring | Guided callout | Assessment callout |
|---|---|---|---|
| Valid target for the current step | teal ✓ | "Release to `<action>` `<target>`" | "Release to try this" |
| Invalid target | terracotta ✕ | "Not the target for this step" | "Release to try this" |
| Free spot | footprint only | "Release to set down" | same |
| Free spot, item currently held by something | footprint | "Release to take it off `<holder>`" | same |
| Expected drag-to-zone station | teal zone outline | "Release to place" | "Release to try this" |

The ring state shows in both modes, for parity with the 2D workbench (G-7, decision U7). The callout **text** stays neutral in assessment mode, so it does not coach.

**Release.** The UI resolves a release in **exactly the 2D order** (`Workbench.finishMove`):
1. If the release lands inside the expected drag-to-zone station, it sends a `placeIntent` for the step.
2. Otherwise, a **valid overlap** sends the interaction intent through `sceneToIntent`. For `snapIntoTarget`, the point is aligned to the anchor.
3. Otherwise, an **invalid overlap** is refused:
   - the runtime's message and recovery are shown;
   - `recordAssessmentFailure` is called;
   - the item springs back.
4. Otherwise, it is a **free move**: `place` with `benchMove: true`, bench-unit `x` and `y` from `benchCoordinates`, and `zIndex` set to the current maximum plus one. `zIndex` keeps the state valid for the 2D player.

**Rules:**
- **No interpenetration.** If the release point intersects an item that is not a target, the set-down point slides to the nearest free spot, using the same "under 5 % overlap" rule as 2D `nextPlacementPoint`, before the move is sent. The committed `x` and `y` are what the runtime stores (G-3).
- **The bench is bounded.** Items cannot be dropped off the bench; the point is clamped to the surface.
- **Free moves are never attempts.** They never call `recordAssessmentFailure` (parity).
- **Leaving a holder detaches.** Taking an item out of a holder detaches it (runtime rule), and the callout warns before release. Moving an item out of a closed chamber is refused by the runtime, and the UI shows that message.
- **Probes do not free-move** (parity). They move only as part of their interaction.
- **Parking after an interaction.** After a completed pour-type interaction, the source is set down beside the target, as 2D `parkAfterInteraction` does. That set-down is sent as a free move, so the resting scene equals runtime state. Snaps, instrument reads and probes are not parked.
- **No undo in the Player** (parity). A move is reversed by moving the item again. "Restart" stays in the Menu.
- **Items keep their facing.** A free move carries no rotation. `EquipmentInstance.rotation` exists, but the move does not set it, so the scene keeps each item's facing. To look at an item from another side, use Examine (section 5.8). Persistent turning would be a core change (decision U6).
- **Returning to the tray** is limited to what the 2D player does (decision U5). A bench item goes onto the tray only when the current step expects it there, through its drag-to-zone station.
- **No physics.** Nothing tips over, spills or breaks. Nothing happens that the runtime does not know about.

**Keyboard carry.**
1. Select an item (Tab, arrows, or the Bench list) and press Enter to pick it up.
2. Arrows move the ghost 10 mm, or 50 mm with Shift. `[` and `]` step through candidate targets, showing their ring states.
3. Enter sets the item down, using the same resolution order. Esc cancels.

### 5.7 Interactions, one by one

| Handler | Gesture | Cue before release | Commit | After an accepted commit |
|---|---|---|---|---|
| `dragToZone` | Carry from the tray or bench into the station | Zone outline | `placeIntent` | Settle, 120 ms |
| `snapIntoTarget` | Carry onto the zone anchor | Ring at the exact seat | `snapIntent` (target and zone id) | Magnetic ease into the anchor pose, 150 ms |
| `pourInto` | Carry the source over the target | Lip turns toward the target; tilt preview; **no stream** | `pourIntent`, with a value **only** from the input field | Tilt to `pour.tiltDeg`, stream in `resolveLiquidStyle` colour, levels animate from before to after using the fill profiles, then the source is parked |
| `readInstrument` | Fill the input, then activate the display or control, or press Confirm | Display highlight | `instrumentReadIntent`, with the input merged | The display shows "Your entry" (G-1) |
| `recordNotebook` | Fill the entry in the notebook sheet and press "Record" | — | `notebookRecordIntent` | The entry gains ✓ when accepted |
| `submitCalculation` | Calculation card: fill and submit | — | `calculationSubmitIntent` | Tolerance feedback from the runtime |

- **Refusals.** For every handler, a refusal returns the source to where it was. It also shows the correction and records an attempt in assessment mode (G-4).
- **Staged animations.** Animations play only **after** the runtime has accepted the action (G-3).
  - The weighing animation may set the vessel on the pan. The vessel then returns to where the runtime keeps it, because the runtime's `weigh` neither seats nor moves it (plan §2.4).
  - Under reduced motion, the end state appears at once.

### 5.8 Examine (presentation only)

- **Opening it.** Double-click, E, a double-tap on touch, or "Examine" in the dock or Bench list.
- **The camera moves, the item does not.** The camera flies in 650 ms to a lit close-up of the item, and the learner can orbit it within limits. The item never moves, so the resting scene still equals runtime state.
- **Info card:**
  - the name, and capacity and precision from the catalogue;
  - the contents text (`contentDisplay`) with a liquid swatch;
  - attachment status ("Seated on `<holder>`");
  - provenance: "3D model built in Blender" and the generator path.
- **Instruments** also show the display policy in plain words: "This display shows settings and status. Readings you record are your own entries."
- **Scenery** shows only its "Scenery" tag.
- **Eye level.** A glassware item with contents offers **Eye level**. This moves the camera to the height of the liquid surface, which is the correct way to read a meniscus and teaches parallax. The level itself is runtime state, drawn from the fill profile.
- **Closing it.** Esc or Close returns the camera to where it was.

### 5.9 Camera, framing and guidance

- **Mouse:**
  - right-drag orbits, with azimuth limited to ±70° and elevation to 12–70°;
  - Shift + right-drag or middle-drag pans;
  - the wheel zooms toward the cursor;
  - Home resets the view.
- **Touch:**
  - a one-finger drag on empty bench orbits;
  - a two-finger drag pans;
  - pinch zooms.
- **Auto-framing** (from the microarray):
  - The **working set** is the expected source, the expected target, and their holders or anchors, derived from `expectedInteraction` and attachments. It needs no authored data.
  - In **assessment** mode, the working set is every item on the bench, so the framing is not a hint.
  - The framing fits the working set into the free area around open panels, and refits when a panel is moved, resized or collapsed.
  - It tweens over 650 ms, and never moves during a drag or an animation.
  - A manual orbit or zoom suspends it until the next step, or until "Auto view" is chosen.
- **Camera menu:**
  - "Auto · follow the step";
  - "Whole bench";
  - "Selected item";
  - "Overhead".
- **Beacon** (guided mode): marks the expected source before pick-up, then the expected target while carrying. It can be switched off in the Menu.
- **Show me** (guided mode):
  1. frames the working set;
  2. pulses the source, then the target;
  3. plays a **ghost demo**: a translucent copy of the source travels to the target along the drag path and fades.
  
  The ghost commits nothing. Under reduced motion, only the pulses play.

### 5.10 Tray

- **Contents.** The tray is a floating panel at bottom left. It holds items whose location is `shelf`, which is what the 2D shelf shows. Items in `storage` are **not shown**, as in 2D (the plan's §4.4 row was corrected in revision 2.1).
- **Tiles.** Each tile has a Blender thumbnail, the name, and a count ("× 2") for repeated definitions. In guided mode, items the current step needs get a teal dot, as the 2D shelf's guidance does.
- **Drag** a tile onto the bench. The result is exactly what the 2D `placeShelfEquipment` produces:
  - a step `placeIntent` when the placement matches the current step;
  - otherwise, a free move from the shelf.
- **Click or Enter** places the item at the next free bench spot, as the 2D `placeEquipment` does.
- **Collapsed**, the tray becomes a pill: "Tray · n".

### 5.11 Bench list: the accessible twin

- **The panel.** A floating panel at top right, opened from the dock. It groups items as "On the bench", "Seated" (child and holder) and "On the shelf".
- **Rows.** Each row shows:
  - a 32 px thumbnail and the name;
  - the contents text;
  - a position in words: back, middle or front, and left, centre or right;
  - state chips.
- **Row actions.** Selecting a row selects and frames the item. The row's buttons are Examine, "Use as source", "Use as target" and "Move…", which starts the keyboard carry.
- **Footer:** "The same checks apply here as on the bench." The Source and Target buttons fill the step card's action flow, and Confirm runs the same resolution.
- **Live description.** A hidden `aria-live` region announces:
  - a step change (the title and instruction);
  - a committed action, using the runtime's own feedback message;
  - a refusal, using the runtime's message;
  - a free move ("`<label>` moved to the back left").
  
  Camera moves are not announced.

### 5.12 Notebook and calculation cards

- **The sheet.** A side sheet on the right: 420 px by default, resizable from 320 px to 50 vw. The bench stays visible and framing refits around it.
- **Sections.** It follows the existing notebook and evidence contracts: notebook entries, measurements, data series and calculations.
- **Values** are set in mono, and each carries its provenance chip.
- **Guided emphasis.** In guided mode, the current step's entry area is emphasised, and the "Notebook" button shows a dot.
- **Calculation cards** show the formula context the definition provides, the input, Submit, and the runtime's tolerance feedback.

### 5.13 Corrections, toasts, announcements

- **Refusals.** A refusal fills the step card's **correction block** with a terracotta rule and two parts:
  - "What happened": the runtime's `message`;
  - "Try this": the runtime's `recovery`.
  
  The block stays until the next successful action or until it is dismissed.
- **Assessment mode** adds a quiet line: "Recorded as an attempt." This is presentation only; the recording itself is `recordAssessmentFailure`.
- **Toasts** appear above the dock and carry the runtime's success feedback text, such as when a step completes. The UI never rewrites runtime messages.

### 5.14 Results

This sheet opens when the process completes. It follows the existing results contract and adds presentation only.
- **Content:**
  - steps completed;
  - evidence (measurements, notebook entries, calculations), each with its provenance chip;
  - the definition's declared limitations, where it has them;
  - in assessment mode, attempts per step, with their messages, and the number of steps done at the first try. Both come from `attemptHistory`.
- **Actions:** "Print", "Play again" (`reset`, after confirmation) and "Back to techniques".

### 5.15 Hand control

- **The panel** is a floating panel opened from the dock. It holds the camera preview, the set-up state, gesture cards and cursor speed, which is an existing 2D control.
- **Wording.** It reuses the 2D player's camera help and privacy wording.
- **Behaviour** comes entirely from the shared bridge (plan D6, M7). The Player adds a raycast resolver and nothing else (G-10).

### 5.16 Help and Menu

- **Help ("Controls & model")** covers:
  - the mouse, keyboard and touch tables;
  - what the simulation models, including the definition's declared limitations and the display policy (G-1);
  - the 3D model provenance.
- **Menu:**
  - Graphics quality: High, Balanced or Low (plan §11);
  - Next-target beacon, on or off (guided);
  - Reduced motion: follow the system, or on;
  - Reset panel layout;
  - Mode;
  - Restart;
  - Open the 2D version (navigates);
  - Exit.
- **Mode switching.**
  - Switching mode calls `setMode`, which keeps the state and changes the mode. It is confirmed first: "Switch to assessment? From now on, refused actions are recorded as attempts."
  - Restart calls `reset`, after confirmation.

### 5.17 Guided and assessment modes

| Element | Guided | Assessment |
|---|---|---|
| Step instruction and input label | shown | shown (parity) |
| Beacon, Show me, ghost demo | available | hidden |
| Expected Source and Target in the action flow | pre-filled | "Choose…" |
| Tray "needed now" dots | shown | hidden |
| Auto-framing working set | the step's source and target | the whole bench in use |
| Ring state while carrying | shown | shown (parity, decision U7) |
| Callout text while carrying | names the action | neutral |
| Refusal message and recovery | shown | shown, plus "Recorded as an attempt." |
| Free moves | allowed, never an attempt | same |
| Results | steps and evidence | adds attempts per step and first-try count |

### 5.18 Engagement features and their fidelity basis

| Feature | The learner… | Commits through | Modes |
|---|---|---|---|
| Free movement | picks up any bench item and sets it down anywhere | `place` with `benchMove` (2D `movePlacedEquipment`) | both |
| Tidy set-down | never sees objects overlap: they slide to the nearest free spot | same, with adjusted `x` and `y` | both |
| Natural pour | carries the source to the target; it turns and tilts at its lip; release pours | `pourIntent`, with the input value only | both |
| Magnetic seating | feels the cuvette or stopper ease into its seat | `snapIntent` | both |
| Examine and eye level | studies an item up close and reads a meniscus at eye level | nothing: camera only | both |
| Show me ghost | watches a translucent demonstration of the next move | nothing | guided |
| Beacon, auto-framing | always knows where to look | nothing | guided (framing in both) |
| Progress sweep | sees each step fill and tick | reads `completedNodes` | both |
| Results | sees first-try steps and evidence | reads runtime records | both |
| Hand control | moves items with hand gestures | the shared bridge | both |
| Personal layout | arranges panels; the layout is remembered | the UI storage key | both |

There is no sound, no physics, no score beyond the runtime's own records, and no invented content.

### 5.19 Player keyboard and touch

| Input | Action |
|---|---|
| Tab / Shift + Tab | Move between regions: step card, bench, dock, open panels |
| Arrows (bench focused) | Move the selection between items, in spatial order |
| Enter | Pick up, then set down (keyboard carry) |
| `[` `]` while carrying | Previous or next candidate target |
| E | Examine |
| S / T | Use the selection as Source / Target |
| N | Notebook |
| A | Auto view |
| Home | Reset view |
| Esc | Cancel a carry, or close Examine, a dialog or a panel |
| Touch: tap | Select. A second tap opens the item menu (Examine, Move, Source, Target) |
| Touch: hold for 300 ms, then drag | Carry |
| Touch: double-tap | Examine |

The single-letter keys work only while the bench has focus (WCAG 2.1.4).

## 6. Pack 1 moments

These follow plan §2.6. Step wording is authored content and is shown verbatim.

| Technique | What the learner does in 3D | Displays and values |
|---|---|---|
| `weighing` (3 steps: drag, read, notebook) | 1. Place the item the step names (drag to zone). 2. Read the balance: fill in the mass and confirm. 3. Record. The weighing animation may set the vessel on the pan, then returns it where the runtime keeps it. | Balance display: blank or status only. The 2D artwork's display is also blank. After entry: "Your entry · `<value>` g". See decision U4. |
| `measuring-volume` | Not playable on its own: the setup gate shows host-bound guidance and links to its hosts. | — |
| `making-solution` (pour, dissolve, notebook) | Pour. Dissolve: the solid leaves the reagent bottle as powder and becomes a solution coloured by `resolveLiquidStyle`. Record. | Teacher-set quantities carry the "Teacher setting" chip. |
| `dilution` (pour, dilute, notebook) | Pour, dilute, record. | As for `making-solution`. |
| `transmittance-dilution` (23 steps) | Carry items to their zones (×5) and pour (×6). Seat items in their zones (×2, for example the cuvette in the photometer slot). Read the photometer three times (the learner enters %T). Keep notebook entries (×4) and do three calculations. | Photometer: configured mode and wavelength, and blank status; the learner's %T appears only after entry. Test tubes stand in scenery (decision D9). |

## 7. Responsive summary

| Width | Studio 3D | Player3D |
|---|---|---|
| 1440 px and up | `248 / 1fr / 320`; split preview from 1600 px | Full layout; step card 372 px; dock labels shown |
| 1280–1439 px | `224 / 1fr / 296` | Same |
| 1024–1279 px | Library becomes a 56 px icon rail with a flyout | Step card 340 px; dock labels hidden below 1100 px, as in the microarray, with tooltips instead |
| 768–1023 px | Library drawer; inspector as a bottom sheet | The step card becomes a bottom sheet (40 % height, collapsible); the notebook becomes a full-height sheet over the bench; the tray and Bench list open as sheets |

## 8. Accessibility checklist (WCAG 2.2 AA)

- **Contrast.** Text is at least 4.5:1. UI parts and focus indicators are at least 3:1; the focus colour is `--focus` #a8791a, with a 3 px outline and a 3 px offset.
- **No colour-only signals.** Every ring, chip and edge style also has an icon, text or line pattern.
- **Keyboard.** Every step can be done with the keyboard alone, through the step card and the Bench list (G-6). The keyboard maps are in sections 4.9 and 5.19. Focus order is documented per screen in M0.
- **Target size.** Controls are at least 24 × 24 px; dock buttons are 56 px tall.
- **Live regions.** The next-action band, the correction block and the Bench list's scene announcements.
- **Reduced motion** covers camera moves, pours, tilts, snaps, the beacon and the ghost demo.
- **Names.** Canvases get an `aria-label` that describes their use, as the Photoreal Bench's canvas does. Items are named through the Bench list, not through the canvas.
- **Language.** Plain and short. Units always accompany values.

## 9. Copy

- **Voice.**
  - Learners are addressed in the second person, with imperative verbs.
  - Teachers get neutral, precise labels.
  - Wording is calm and never cute.
- **Authored text is shown verbatim**: instructions, input labels, runtime messages and recovery. The UI writes only its own chrome.
- **Never "measured" for learner entries.** Say "Your entry". Never show a value without its provenance chip.
- **UI-authored messages** follow "what happened · what to do", in at most two short sentences.
- **Honest notes** sit where they prevent a misunderstanding (for example, positions, detached drafts and display policy). There is at most one per panel.

## 10. Deliverables, milestones and review

**M0 mock-ups** (plan §7) must include these frames, at 1440 × 900 unless marked otherwise:

| Studio 3D | Player3D |
|---|---|
| S1 Flow view, weighing, nothing selected | P1 Loader, with the 2D fallback link |
| S2 Inserting a library step on an edge | P2 Setup gate, both pages |
| S3 Decision node with a retry edge; inspector on Connections | P3 Bench, guided, weighing step 1 |
| S4 Starting bench view with the shelf strip | P4 Carrying: valid target, invalid target, free spot |
| S5 Preview view, and split view at 1600 px | P5 Refusal with the correction block |
| S6 Configure-before-append: `making-solution` allowed, `measuring-volume` blocked | P6 A pour mid-animation |
| S7 Checks tab with blockers | P7 Examine of the balance, showing the display policy |
| S8 Flattened experiment draft (D8 a) | P8 Bench list and accessible action flow |
| S9 Tablet, 1024 × 768 | P9 Notebook open, with provenance chips |
| | P10 Results, assessment mode |
| | P11 Assessment mode bench: no beacon, neutral callouts |
| | P12 Host-bound gate for `measuring-volume` |
| | P13 Tablet, 1024 × 768 |

**Build order** follows plan §7:

| Milestone | What it builds |
|---|---|
| M0 | Tokens, components and the mock-ups above |
| M3 | Look layer and in-scene signals |
| M4 | Carrying, overlap cues, pour, seat, free move and keyboard carry |
| M5 | Player3D panels, gate, modes, tray, Bench list, notebook and results |
| M6 | Studio 3D, including the Starting bench (U3) |
| M7 | Hand-control panel |
| M8 | Design acceptance |

**Static design review**, part of each milestone's static exit, with no browser needed:
1. The token contrast table has been computed, and every pair passes.
2. Every on-screen value renders through the provenance chip component.
3. Instrument display components render only three things: configured settings and status, `simulator-generated` readouts, and "Your entry".
4. Guidance components check `mode === "guided"`.
5. The drop resolver follows the 2D order (section 5.6), and the free-move path never calls `recordAssessmentFailure`.
6. No audio API appears in the code (`AudioContext`, `new Audio`, `<audio>`).
7. Reduced-motion branches exist for every item in section 3.5.
8. The UI storage keys hold preferences only.
9. The keyboard maps are implemented and the single-letter keys are scoped to focus.

**G1** (authorised browser checks): each Pack 1 happy path, run twice (by mouse and by keyboard only), then one refusal and its recovery in each mode.

## 11. Decisions for you (UI)

| # | Decision | Recommendation |
|---|---|---|
| U1 | Font family | IBM Plex Sans with IBM Plex Mono: SIL OFL, already bundled in the sibling microarray project, with a mono face for values. The alternative is Inter, as in the Photoreal Bench. |
| U2 | One design system for both apps | Yes: one token set, with a sage brand colour for choices and teal for guidance. |
| U3 | Starting bench view in Studio 3D (M6) | Yes. It is new UI on existing operations, and seated starting items wait for the M6 verification. |
| U4 | Weighing: the input asks for "the mass displayed by the balance", but no route displays one | Add one neutral line under the input, from the display policy: "This simulation does not generate balance readings." Either way, no mass is shown. |
| U5 | Returning bench items to the tray | Parity for Pack 1: only when a step expects it. The reducer would accept `benchMove` to `shelf`, but the 2D player never sends it, so allowing it needs review. |
| U6 | Turning items | Examine only. Persistent rotation needs `benchMove` to carry `rotation`, which is a core change. |
| U7 | Overlap ring state in assessment mode | Keep parity (shown). Hiding it would make 3D stricter than 2D. |
| U8 | Resuming a run after reload | Not in Pack 1. The 2D player persists no run state. A validated save and restore, like the microarray's, would be a separate reviewed feature. |

## Appendix. Source facts checked for this handoff

All of these are from snapshot `1d28429`. Re-check them against the reconciled baseline (plan D1).

| Fact | Where |
|---|---|
| Free bench moves are runtime actions: `place` with `parameters.benchMove: true`, carrying `x`, `y` and `zIndex`, for bench items and for items coming from the shelf | `src/player/StudentPlayer.tsx:864–881`, `929–942` |
| The reducer handles a free move before any step check. It detaches the item from its holder unless the destination is a zone, moves locked children, and is refused for an item in a closed chamber. It sets location, `x`, `y`, `zIndex` and status, but not `rotation`. | `src/runtime/reducer.ts:7176–7223` |
| The drop order is: expected drag-to-zone station, then valid overlap, then invalid overlap (an assessment failure), then free move. Probes never free-move. After a completed interaction the source is parked, except after snaps and instrument reads. | `src/player/Workbench.tsx:676–741`; vision path `src/player/StudentPlayer.tsx:1483–1545` |
| Guidance shows only in guided mode. Overlap states show in both modes. | `src/player/StudentPlayer.tsx:490`; `src/player/Workbench.tsx:1077–1082`, `1220–1226` |
| The shelf shows `shelf` only. The bench shows `workbench` and `snapZone`. `storage` is hidden. | `src/player/StudentPlayer.tsx:527–544`; `src/domain/equipmentLocations.ts:3–4` |
| Automatic placement avoids spots with 5 % overlap or more | `src/player/StudentPlayer.tsx:804–820` |
| The 2D balance artwork has a blank display. Content overlays exist only for the pH meter, chromatography paper and the hand-warmer calorimeter. | `public/assets/equipment-realistic/v1/analytical-balance.png`; `src/player/equipmentOverlays.tsx:228–235` |
| The player persists no run state; only the view transform and gesture cursor speed are stored | `src/player/workbenchViewTransform.ts:74–88`; `src/player/gesture/useGestureRecognition.ts:234`, `388` |
| The mode can be switched mid-run and the state is kept. Failures are recorded only in assessment mode. | `src/player/usePlayerRuntime.ts:95–125` |
| Preview notice text | `src/player/StudentPlayer.tsx:545–548` |
| Starting equipment is edited as whole instances, and the initial state holds equipment only | `src/studio/TeacherStudio.tsx:1068–1090`; `src/domain/types.ts:326–338`, `764–766` |
| Photoreal Bench structure and styles | `Lab_studio\v2\Lab_Studio_Photoreal_Bench\source\page.html`, `source\style.css`, `tests\final_1440.png`, `ASSET_PROVENANCE.json` |
| Microarray v3 structure, styles and behaviour | `virtual_lab\experiments\dna-microarray-3d\microarray-3d-v3.html`, `3d-v3\style.css`, `3d-v3\README.md` |
