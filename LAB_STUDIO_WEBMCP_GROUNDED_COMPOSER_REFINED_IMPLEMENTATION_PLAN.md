# Lab Studio WebMCP Grounded Experiment Composer
## Refined Codex implementation plan and execution contract — R002

**Repository:** `jivishov/Lab-Studio`  
**Verified baseline commit:** `1af142027ffde447b0da96f515d8bc0d948ecd1f`  
**Recommended branch:** `feature/webmcp-grounded-composer`  
**Implementation target:** one complete, inventory-aware, WebMCP-driven acid–base titration vertical slice  
**Primary viewport:** 15-inch laptop, approximately 1440 × 900; also verify 1366 × 768 and 1024 × 768 tablet  
**Deployment:** preserve the static React + TypeScript + Vite + GitHub Pages architecture  
**Challenge deadline:** September 3, 2026 at 1:00 PM Pacific / 3:00 PM Central

---

# 0. Codex directive

Implement this plan directly. Do not return another proposal unless a verified repository fact makes a required item impossible.

The result must be a coherent challenge product, not a general chemistry-platform rewrite. The challenge critical path is:

```text
user goal + current physical-lab inventory
                ↓
browser agent calls WebMCP tools
                ↓
Lab Studio validates and stages one supported experiment family
                ↓
human reviews the staged experiment
                ↓
agent rehearses it through the ordinary simulator runtime
                ↓
Lab Studio runs a deterministic Protocol Check
                ↓
human explicitly applies or discards the staged experiment
```

## Start by reading

Read the actual current files before editing:

- `README.md`
- `package.json`
- `tsconfig.app.json`
- `src/App.tsx`
- `src/domain/types.ts`
- `src/domain/validation.ts`
- `src/domain/interactions.ts`
- `src/domain/titrationModels.ts`
- `src/equipment/catalog.ts`
- `src/runtime/createRuntime.ts`
- `src/runtime/interactionIntents.ts`
- `src/runtime/reducer.ts`
- `src/runtime/validation.ts`
- `src/player/StudentPlayer.tsx`
- `src/player/usePlayerRuntime.ts`
- `src/studio/TeacherStudio.tsx`
- `src/studio/studioState.ts`
- `src/studio/studioValidation.ts`
- `src/assistant/actionCatalog.ts`
- `src/assistant/actionCatalog.json`
- `src/assistant/studioPageAdapter.ts`
- `public/labs/acid-base-titration.json`
- relevant unit and React tests
- `tests/lab-studio.smoke.e2e.ts`

## Establish and record the baseline

Run:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run the existing Playwright smoke suite only if the local browser dependencies are already available or can be installed without delaying the implementation. Record any pre-existing failure before changing code.

Create the feature branch only after recording the baseline.

## First-day WebMCP proof

Before building the Composer, implement a temporary minimal tool using the exact imperative API:

```ts
document.modelContext.registerTool(...)
```

Deploy or run the app in a WebMCP-capable browser and verify that the tool is discoverable and executable. Test in:

1. ChatGPT's in-app browser, if available;
2. Chrome 149+ with `chrome://flags/#enable-webmcp-testing` as the secondary path.

Remove the temporary tool once the production registry is working. Do not postpone real-browser WebMCP verification until the final day.

---

# 1. Critical review decisions that replace the previous plan

The earlier implementation plan was scientifically cautious but too broad for the remaining challenge period. Apply the following corrections.

## 1.1 Restrict P0 to one experiment family

P0 supports only:

> **Estimating the molarity of a synthetic monoprotic-acid sample by titration with standardized NaOH, using a phenolphthalein endpoint.**

This is a generated, parameterized experiment family—not unrestricted chemistry generation.

Do not implement in P0:

- arbitrary reactions;
- chromatography, spectroscopy, calorimetry, electrochemistry, kinetics, extraction, or biological workflows;
- general SDS retrieval;
- a chemical-compatibility engine;
- arbitrary SOP ingestion;
- regulatory qualification or training certification;
- full acid–base equilibrium or pH-curve simulation.

An optional procedural pH-meter confirmation module may be included only after the indicator-only journey passes every P0 gate. It must be labeled as procedural confirmation, not a quantitative pH model.

## 1.2 Separate the agent request from the scientific blueprint

The browser agent must not be asked to provide engine internals such as:

- hidden analyte molarity;
- stoichiometric ratio;
- burette drop volume;
- endpoint drop count;
- endpoint offset;
- maximum over-titration drops;
- derived expected result;
- fidelity assumptions or limitations.

Those fields are derived by Lab Studio from its verified family definition, equipment catalog, inventory, and synthetic sample preset.

The public agent-facing object is an `ExperimentRequest`. The internal compiler creates a richer `CompiledExperimentBlueprint`.

## 1.3 Use a small, non-overlapping tool surface

Do not expose the existing low-level assistant patch tools as the challenge interface. Do not create separate tools for validation and staging when one coherent preview operation can perform both.

Register a stable Studio tool set while the Studio surface is active and a stable rehearsal tool set while the rehearsal surface is active. Do not unregister and immediately re-register the same tool names after every process step; the current WebMCP draft explicitly warns that rapid abort/re-registration can race with discovery and execution.

## 1.4 Preserve one-drop reducer semantics

Do not introduce a new coarse-dispense mode deep inside the reducer unless absolutely required. Keep the existing single-drop behavior authoritative.

Implement coarse delivery as a bounded sequence of existing validated drop intents, applied through the same resolver and reducer in one state transaction. This reduces regression risk and proves that the agent uses the same laboratory semantics as the human UI.

## 1.5 Keep human authority explicit

WebMCP may:

- inspect capabilities and inventory;
- replace the reversible inventory profile;
- validate and stage an experiment;
- open a transient rehearsal;
- operate the guided rehearsal;
- run Protocol Check.

WebMCP must not:

- apply the staged definition to the Teacher Studio draft;
- save, export, or publish it;
- switch an assessment into guided mode;
- mark Protocol Check as passed without executing its checks.

Only a visible human click can apply or discard the staged experiment.

## 1.6 Treat safety as declared readiness, not certification

The system may check whether the user declared required equipment, PPE, emergency facilities, and waste handling. It must not claim to have completed a comprehensive safety review.

For a request intended to mirror a physical lab:

- missing required declarations prevent a “ready to mirror physically” status;
- the system may still stage a virtual-only rehearsal if the user selects that context;
- it must not silently change a physical-mirroring request into a virtual-only request.

## 1.7 Do not claim secure hidden answers in a static client

The learner-facing UI and WebMCP rehearsal tools must not return the synthetic ground-truth molarity or endpoint drop count. However, this is a static client-side app; a technically sophisticated user can inspect JavaScript or application state. Therefore:

- describe the value as **not shown in the learner UI or tool output**, not cryptographically secret;
- label the generated assessment as practice/training, not a secure high-stakes assessment;
- include this limitation in the fidelity manifest and README.

## 1.8 Make agent evals a required deliverable

Unit tests alone do not establish a good WebMCP experience. P0 requires a small recorded agent-evaluation set that checks tool discovery, selection, argument construction, recovery from descriptive errors, and completion of the end-to-end journey.

---

# 2. Product outcome and truthful positioning

Implement **Lab Studio Grounded Experiment Composer**:

> A teacher or trainer describes the learning objective and the laboratory resources they actually have. Their browser agent uses WebMCP to inspect Lab Studio's supported experiment families, map the inventory into structured roles, stage a virtual experiment, rehearse it through the same simulator runtime used by learners, and run a deterministic Protocol Check. Lab Studio clearly states what is modeled, what is only procedural, and what remains unsupported.

## P0 audience

Primary audience:

- high-school or introductory-college chemistry teachers preparing a guided pre-lab;
- secondary audience: a laboratory trainer creating a non-regulatory procedural rehearsal.

## P0 scientific claim

Use **estimate molarity**, not “determine with analytical accuracy,” because the current supported aliquot measurement uses a graduated cylinder rather than a modeled volumetric pipette.

The generated lab may teach:

- apparatus setup;
- aliquot measurement;
- transfer order;
- indicator use;
- initial and final burette evidence;
- endpoint recognition;
- molarity calculation;
- recovery from supported mistakes.

It must disclose that it does not model:

- a full pH curve;
- indicator equilibrium;
- temperature effects;
- activity coefficients;
- glassware calibration uncertainty;
- parallax or meniscus-reading error beyond configured tolerances;
- the actual concentration of an external physical sample.

## Supported delivery contexts

### `virtual_training`

The sample is a synthetic Lab Studio preset. The scientific model and expected result are internally coherent within the declared simplifications.

Expected fidelity status: `modeled_and_executable`.

### `physical_procedure_rehearsal`

The simulation rehearses the procedure for a physical unknown supplied by the user. The virtual synthetic sample does not characterize the physical sample.

Expected fidelity status: `procedurally_executable` unless the user supplies a separately reviewed physical reference value outside this P0 feature.

---

# 3. Required user journey

The final deployed app must support this exact journey.

## 3.1 Agent inspects Lab Studio

The user opens `#/studio` and asks the browser agent:

> Build a 45-minute guided pre-lab for estimating the molarity of a synthetic unknown monoprotic acid with standardized 0.100 M NaOH. We have a burette, ring stand and clamp, graduated cylinder, Erlenmeyer flask, phenolphthalein, waste beaker, goggles, eyewash, and a base-waste container.

The agent calls:

1. `inspect_lab_capabilities`
2. `inspect_lab_inventory`

The response includes only compact, relevant IDs, aliases, supported ranges, and limitations.

## 3.2 Agent updates inventory

The agent calls `replace_lab_inventory` using catalog IDs returned by inspection.

Lab Studio visibly updates the inventory state and revision. Unknown IDs or stale revisions produce descriptive, recoverable errors.

## 3.3 Agent stages the experiment

The agent calls `preview_lab_experiment`.

The tool:

1. validates the request against the current inventory revision;
2. selects the verified acid–base family;
3. derives internal model values;
4. compiles a complete `LabDefinition`;
5. validates the definition and interactions;
6. creates a staged preview only if there are no blockers;
7. opens the staged review UI.

The current Teacher Studio draft remains unchanged.

## 3.4 Human reviews

The staged review must show:

- objective and audience;
- delivery context;
- required inventory roles and resolved items;
- generated module sequence;
- calculated working volumes;
- fidelity classification;
- blockers and warnings;
- assumptions and limitations;
- **Run Protocol Check**;
- **Open rehearsal**;
- **Apply to Studio**;
- **Discard**.

Apply and discard are human controls. A staged experiment may be rehearsed and checked before it is applied.

## 3.5 Agent rehearses through the real runtime

When rehearsal opens, Studio tools are replaced with the stable rehearsal tool set. The agent:

1. inspects the current step;
2. makes one intentional invalid attempt;
3. receives existing runtime recovery feedback;
4. completes setup and measurement steps;
5. attempts premature endpoint acceptance and is rejected;
6. uses coarse delivery to approach the endpoint;
7. uses one-drop delivery near the endpoint;
8. accepts the endpoint;
9. records evidence;
10. submits the calculation.

Every state-changing rehearsal call must pass through `resolveInteractionIntent()` and `performRuntimeAction()` or a pure sequence composed from those same functions.

## 3.6 Protocol Check

The agent or human runs Protocol Check against the staged definition. The report appears visibly and contains only substantiated checks.

After a passing report, the human may click **Apply to Studio**. Applying replaces the current draft with the compiled staged definition and retains the normal Studio editing, save, import, export, and preview behavior.

---

# 4. P0, P1, and explicit exclusions

## P0 — required before challenge polish

1. One verified synthetic monoprotic-acid/NaOH family.
2. Compact equipment, chemical, facility, and inventory types.
3. One default challenge inventory.
4. Agent-facing `ExperimentRequest` schema.
5. Internal family compiler producing a valid `LabDefinition`.
6. Staged review with human-only Apply and Discard.
7. Direct imperative WebMCP registration in repository source.
8. Stable Studio and rehearsal tool sets.
9. Guided agent rehearsal through existing interaction/runtime paths.
10. Coarse-to-fine titration using a sequence of ordinary drop intents.
11. Deterministic Protocol Check.
12. One end-to-end automated smoke journey.
13. Manual WebMCP testing in at least one supported agent/client.
14. Recorded agent-evaluation cases.
15. Challenge-focused README, lineage, fidelity, and testing instructions.

## P1 — only after P0 works end to end

- optional procedural pH-meter confirmation module;
- a second synthetic sample preset;
- human editing of a staged request followed by recompile;
- more polished activity timeline;
- downloadable Protocol Check JSON;
- a second inventory preset demonstrating an unsupported request.

## Do not begin before submission

- general experiment-family authoring UI;
- dynamic third-party module loading;
- volumetric-pipette aspiration or release simulation;
- broad chemical database integration;
- arbitrary method generation;
- technician certification records;
- LMS, roster, or backend persistence;
- extensive visual regression, adversarial testing, or broad Playwright suites.

---

# 5. Architecture

Add two isolated layers around the existing app rather than rewriting the simulator.

```text
src/experimentComposer
    bounded inventory + request contracts
    verified family/module catalog
    request validation and compilation
    fidelity manifest
    staged session reducer

src/webmcp
    feature detection
    direct registerTool lifecycle
    compact schemas and result envelopes
    Studio tool adapter
    rehearsal tool adapter
```

The existing `LabDefinition`, validator, interaction resolver, and reducer remain authoritative.

## 5.1 Recommended source layout

Create only the files that remain useful after the challenge:

```text
src/experimentComposer/
  types.ts
  schemas.ts
  catalogs.ts
  validateExperimentRequest.ts
  compileAcidBaseTitration.ts
  fidelity.ts
  useComposerSession.ts
  __tests__/
    validateExperimentRequest.test.ts
    compileAcidBaseTitration.test.ts

src/webmcp/
  registerToolSet.ts
  result.ts
  toolSchemas.ts
  studioTools.ts
  rehearsalTools.ts
  useWebMCPRegistry.ts
  __tests__/
    registerToolSet.test.ts
    studioTools.test.ts
    rehearsalTools.test.ts

src/protocolCheck/
  runProtocolCheck.ts
  driveAcidBaseTitration.ts
  types.ts
  __tests__/
    runProtocolCheck.test.ts

src/studio/
  ExperimentComposerDrawer.tsx
  StagedExperimentReview.tsx
  ProtocolCheckPanel.tsx

src/player/
  GuidedRehearsalOverlay.tsx

src/runtime/
  interactionSequence.ts
  contentTransfer.ts
```

If two proposed files remain trivial, combine them. Do not create empty abstraction layers merely to match this tree.

## 5.2 Existing files to modify

### `package.json`

- add the WebMCP declaration package as a pinned development dependency;
- at the plan date, the official package is `webmcp-types@0.1.3`;
- do not add a runtime WebMCP wrapper unless direct registration proves incompatible;
- preserve all existing scripts;
- optionally add a focused `test:webmcp` script if useful.

### `tsconfig.app.json`

Activate `webmcp-types` using the least disruptive supported method. Prefer a single inline reference in the WebMCP entry file if modifying `compilerOptions.types` would remove existing ambient types.

### `src/studio/TeacherStudio.tsx`

- mount the Composer drawer and session hook;
- supply draft apply callback;
- open staged rehearsal overlay;
- register Studio tools through the dedicated hook;
- do not merge Composer logic into the already large component.

### `src/player/StudentPlayer.tsx`

- accept an optional rehearsal bridge or callbacks;
- expose existing runtime snapshot and validated operations to the rehearsal adapter;
- add a coarse-to-fine control only in guided rehearsal or where it improves the ordinary titration UX;
- do not expose agent completion controls in assessment mode.

### `src/player/usePlayerRuntime.ts`

Add a method that applies one or more validated interaction intents through a pure sequence helper and returns a structured outcome. Keep existing public behavior unchanged.

### `src/runtime/reducer.ts`

Avoid broad changes. If implementing solution-content conservation requires edits, limit them to ordinary liquid/solution `measureVolume` and `transfer` paths with no precipitate. Do not modify filtration, rinsing, drying, or hard-water-specific behavior.

### `src/styles/app.css`

Add isolated Composer, staged-review, WebMCP-status, rehearsal, and Protocol Check styles. Preserve the current 15-inch laptop layout. The Composer should overlay or use a drawer rather than permanently compressing both existing Studio panes.

### `README.md`

Add:

- challenge summary;
- exact WebMCP testing instructions;
- supported and unsupported scope;
- what existed before August 25 and what was added during the challenge;
- one copyable agent prompt;
- static-client assessment limitation;
- link to fidelity and agent-eval documentation.

---

# 6. Domain contracts

Use strict TypeScript types and AJV schemas. The examples below specify required semantics; names may be adjusted only when the existing codebase requires it.

## 6.1 Agent-facing experiment request

```ts
export type AudienceLevel =
  | "high_school"
  | "intro_college"
  | "technician_onboarding";

export type ExperienceLevel = "novice" | "intermediate";

export type DeliveryContext =
  | "virtual_training"
  | "physical_procedure_rehearsal";

export type EndpointEvidence = "phenolphthalein";

export interface ExperimentRequest {
  schemaVersion: "1";
  familyId: "acid_base_titration_v1";
  expectedInventoryRevision: number;
  objective: string;
  title?: string;
  audience: AudienceLevel;
  experience: ExperienceLevel;
  durationMinutes: number;
  deliveryContext: DeliveryContext;
  aliquotVolumeMl: 10 | 20 | 25;
  endpointEvidence: EndpointEvidence;
  sampleLabel?: string;
}
```

Constraints:

- `objective`: 1–300 characters after trimming;
- `title`: at most 100 characters;
- `durationMinutes`: 20–120;
- `familyId` and all option values must be explicitly advertised by `inspect_lab_capabilities`;
- `expectedInventoryRevision` must equal the current inventory revision;
- objective/title text is data only and must never be interpolated into code, HTML, tool descriptions, or validation expressions.

## 6.2 Inventory

```ts
export interface EquipmentInventoryItem {
  definitionId: string;
  count: number;
}

export interface ChemicalInventoryItem {
  chemicalId:
    | "synthetic_unknown_acid_a"
    | "standardized_naoh"
    | "phenolphthalein_indicator";
  quantityMl: number;
  concentrationM?: number;
  containerDefinitionId: string;
}

export interface FacilityInventory {
  splashGoggles: boolean;
  eyewash: boolean;
  spillResponseMaterials: boolean;
  compatibleBaseWasteContainer: boolean;
}

export interface LabInventoryProfile {
  schemaVersion: "1";
  revision: number;
  equipment: EquipmentInventoryItem[];
  chemicals: ChemicalInventoryItem[];
  facilities: FacilityInventory;
}
```

Rules:

- equipment IDs must exist in `equipmentById` and in the Composer allowlist;
- counts must be small positive integers;
- a chemical item's `containerDefinitionId` represents one available reagent container and need not be duplicated in the equipment array; role resolution must avoid creating duplicate container inventory;
- NaOH concentration is required and bounded to the supported family range, recommended P0 range `0.05–0.20 M`;
- synthetic unknown concentration is owned by the preset and cannot be supplied or overridden by the agent;
- phenolphthalein concentration is not required by the current model;
- inventory replacement increments revision exactly once;
- staged artifacts retain the inventory revision from which they were compiled.

## 6.3 Internal family definition

```ts
export interface VerifiedExperimentFamily {
  id: "acid_base_titration_v1";
  version: "1.0.0";
  supportedObjectives: string[];
  parameterBounds: {
    aliquotVolumeMl: readonly [10, 20, 25];
    titrantMolarityM: { min: number; max: number };
  };
  requiredRoles: readonly string[];
  optionalRoles: readonly string[];
  moduleIds: readonly string[];
  modelLimitations: readonly string[];
}
```

## 6.4 Internal compiled blueprint

```ts
export interface CompiledExperimentBlueprint {
  id: string;
  familyId: "acid_base_titration_v1";
  familyVersion: "1.0.0";
  request: ExperimentRequest;
  sourceInventoryRevision: number;
  selectedSamplePresetId: "synthetic_unknown_acid_a";
  resolvedRoles: Record<string, string>;
  moduleIds: string[];
  model: {
    analyteMolarityM: number;
    analyteVolumeMl: number;
    titrantMolarityM: number;
    stoichiometricRatio: { analyte: 1; titrant: 1 };
    dropVolumeMl: number;
    endpointOffsetDrops: number;
    maxExtraDrops: number;
  };
  fidelity: FidelityManifest;
}
```

This object is internal. Do not return the hidden model fields through learner/rehearsal tools.

## 6.5 Fidelity manifest

```ts
export type FidelityStatus =
  | "modeled_and_executable"
  | "procedurally_executable"
  | "design_only"
  | "unsupported";

export interface FidelityManifest {
  status: FidelityStatus;
  modeled: string[];
  proceduralOnly: string[];
  assumptions: string[];
  limitations: string[];
  safetyDeclarations: string[];
  warnings: string[];
}
```

Generate this manifest in code. The agent must not author it.

Required limitations include:

- synthetic sample model;
- graduated-cylinder aliquot precision;
- no full pH/equilibrium model;
- no physical-sample characterization;
- client-side answer is not secure against source inspection;
- declared safety readiness is not a comprehensive safety review.

## 6.6 Staged artifact

```ts
export interface StagedExperiment {
  stageId: string;
  stageRevision: number;
  createdAt: string;
  sourceInventoryRevision: number;
  sourceDraftFingerprint: string;
  request: ExperimentRequest;
  blueprint: CompiledExperimentBlueprint;
  definition: LabDefinition;
  validation: {
    schemaErrors: string[];
    interactionWarnings: string[];
    inventoryErrors: string[];
  };
  staleReasons: Array<"inventory_changed" | "draft_changed">;
}
```

The definition exists in memory until the human applies it. It need not be written to `public/labs`. `sourceDraftFingerprint` must be computed from a stable serialization of the current draft when the stage is created. Recompute stale reasons at inspection, rehearsal, Protocol Check, and Apply time; do not rely only on a flag set during one event.

## 6.7 Tool result envelope

Keep outputs compact and consistent:

```ts
export interface WebMCPResult<T = unknown> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
  state: {
    surface: "studio" | "rehearsal";
    revision: number;
  };
}
```

Targets:

- tool descriptions below 500 characters;
- parameter descriptions below 150 characters;
- normal tool outputs below approximately 1,500 characters;
- large definitions must never be returned in full.

For Studio tools, `state.revision` is the Composer session revision. For rehearsal tools, it is a local rehearsal-bridge revision incremented after every successful or rejected operation and reset when a new rehearsal opens. It is informational; inventory concurrency continues to use the explicit inventory revision.

---

# 7. Capability, module, chemical, and inventory catalogs

## 7.1 Capability inspection output

`inspect_lab_capabilities` should return a compact structure such as:

```json
{
  "families": [
    {
      "id": "acid_base_titration_v1",
      "label": "Synthetic monoprotic acid titration",
      "aliquotOptionsMl": [10, 20, 25],
      "endpointOptions": ["phenolphthalein"],
      "contexts": ["virtual_training", "physical_procedure_rehearsal"]
    }
  ],
  "requiredEquipment": [
    {"id":"burette-50ml","aliases":["burette","50 mL burette"]},
    {"id":"ring-stand-clamp","aliases":["ring stand and clamp"]},
    {"id":"graduated-cylinder","aliases":["graduated cylinder"]},
    {"id":"erlenmeyer-flask-250ml","aliases":["Erlenmeyer flask"]},
    {"id":"waste-beaker","aliases":["waste beaker"]}
  ],
  "chemicals": [
    {
      "id":"synthetic_unknown_acid_a",
      "defaultContainerId":"unknown-acid-bottle",
      "concentrationInput":"preset_hidden"
    },
    {
      "id":"standardized_naoh",
      "defaultContainerId":"naoh-bottle",
      "concentrationInput":"required"
    },
    {
      "id":"phenolphthalein_indicator",
      "defaultContainerId":"phenolphthalein-dropper",
      "concentrationInput":"not_required"
    }
  ],
  "requiredFacilityDeclarations": [
    "splashGoggles",
    "eyewash",
    "spillResponseMaterials",
    "compatibleBaseWasteContainer"
  ],
  "limitations": [
    "Only the listed acid-base family is compiled in this challenge build."
  ]
}
```

Do not return the hidden sample concentration.

## 7.2 Verified module sequence

Implement these versioned modules in a small registry or builder map:

1. `mount_burette_v1`
2. `measure_aliquot_cylinder_v1`
3. `record_aliquot_v1`
4. `transfer_aliquot_v1`
5. `add_indicator_v1`
6. `record_initial_burette_v1`
7. `dispense_titrant_v1`
8. `observe_indicator_endpoint_v1`
9. `record_final_burette_v1`
10. `calculate_molarity_v1`
11. optional P1 `procedural_ph_confirmation_v1`

For P0, `observe_indicator_endpoint_v1` must use the existing notebook/evidence pathway to record the persistent pale-pink observation; it must not depend on a pH meter.

Each module builder must declare:

- required role IDs;
- produced action/node IDs;
- prerequisites;
- validation/evidence contract;
- known limitation text;
- version.

The compiler composes the selected module builders into one linear process graph. This proves modular generation without creating a general module-authoring framework.

## 7.3 Default challenge inventory

Provide a safe, one-click default profile for demo recovery. Use the existing reference sample as the internal P0 preset: `synthetic_unknown_acid_a` has a model concentration of `0.0992 M` and `120 mL` starting quantity. This value is available only to compiler/runtime code and is omitted from learner-facing and WebMCP inspection output. Family defaults are a 1:1 reaction ratio, `0.00 mL` initial burette reading, zero endpoint offset, five maximum extra drops, and a ten-drop fine window.

The profile contains:

- one 50 mL burette;
- one ring stand and clamp;
- one graduated cylinder;
- one 250 mL Erlenmeyer flask;
- one phenolphthalein dropper;
- one waste beaker;
- one synthetic unknown-acid bottle;
- standardized 0.100 M NaOH with sufficient volume;
- phenolphthalein indicator;
- splash goggles, eyewash, spill materials, compatible waste container declared.

The UI must state that this is a simulation inventory profile, not proof that a physical room contains the items.

---

# 8. Request validation and compilation

## 8.1 Validation order

`preview_lab_experiment` must validate in this order:

1. JSON Schema;
2. current inventory revision;
3. supported family and request values;
4. equipment role resolution;
5. chemical quantity/concentration;
6. facility declarations appropriate to delivery context;
7. capacity and burette-volume feasibility;
8. titration-model derivation;
9. compiled `LabDefinition` schema;
10. Studio interaction warnings.

No stage is created when blockers remain.

Return errors that allow the agent to self-correct, for example:

```json
{
  "ok": false,
  "code": "MISSING_BURETTE",
  "message": "A 50 mL burette is required. Add equipment definitionId 'burette-50ml' and retry.",
  "state": {"surface":"studio","revision":4}
}
```

## 8.2 Derived science values

Use existing `deriveTitrationDropPlan()` as the authoritative derivation for:

- theoretical equivalence volume;
- exact and whole-drop equivalence count;
- endpoint drop count;
- expected final burette reading;
- expected analyte molarity;
- maximum extra drops.

Derive internally:

- sample ground truth from the synthetic preset;
- NaOH molarity from inventory;
- 1:1 stoichiometry from the P0 family;
- drop volume from the modeled burette family/default;
- calculation tolerance from a reviewed family default;
- fine-window size from a fixed implementation constant, not agent input.

## 8.3 Capacity and quantity gates

At minimum validate:

- aliquot fits the graduated cylinder;
- aliquot plus indicator plus endpoint titrant volume fits the Erlenmeyer flask;
- modeled burette fill does not exceed 50 mL;
- NaOH quantity supports modeled burette fill plus a small declared reserve;
- acid quantity supports aliquot plus a declared reserve;
- indicator quantity is sufficient;
- required equipment counts are at least one.

Do not pretend to optimize reagent use beyond these bounded checks.

## 8.4 Initial chemical state

Correctly compute initial solute amounts:

```text
moles = concentration mol/L × volume L
```

Do not repeat the current reference JSON pattern that stores concentration itself as molar amount.

Allocate NaOH without double-counting inventory. If the compiled lab includes both a reagent bottle and a prefilled burette, the combined volumes must not exceed the inventory quantity.

## 8.5 Definition generation

Generate a full valid `LabDefinition` with:

- unique deterministic IDs scoped to the stage;
- objective, audience, goals, safety notes, equipment, metadata;
- initial equipment and content state;
- one titration model;
- actions and process nodes from module builders;
- validation prerequisites;
- assessments requiring aliquot, initial reading, endpoint evidence, final reading, and molarity calculation;
- module provenance in metadata tags or a Composer-specific non-public runtime field kept outside serialized `LabDefinition` if necessary.

Run `validateLabDefinition()` and `collectStudioInteractionIssues()` before staging.

---

# 9. Narrow runtime fidelity changes

## 9.1 Solution-content conservation

The current runtime can copy complete solute amounts during partial transfers. For generated titration content, add a tested helper for ordinary liquid/solution transfer:

```ts
splitContentForVolume(sourceContents, transferredVolumeMl)
  -> { transferredContents, remainingContents }
```

For contents without precipitate:

- scale each solute amount by transferred/source volume;
- preserve concentration when appropriate;
- reduce the source volume and solute amounts proportionally;
- return empty contents when source volume reaches zero;
- combine same-solute entries by ID and unit when merging solutions.

Do not route precipitate, filtration, rinsing, or drying content through this helper.

If this change causes broad regressions and cannot be corrected quickly, preserve the existing runtime and disclose that molecular content bookkeeping is simplified. Do not risk the complete challenge journey for a broad reducer rewrite.

## 9.2 Validated interaction sequence

Add a pure runtime helper:

```ts
runInteractionSequence(
  definition,
  initialState,
  intents,
): InteractionSequenceResult
```

For each intent:

1. call `resolveInteractionIntent(definition, currentState, intent)`;
2. stop and return structured feedback when resolution fails;
3. call `performRuntimeAction(definition, currentState, resolved.request)`;
4. continue from the returned state;
5. support `AbortSignal` checks between iterations.

Expose this through `usePlayerRuntime` with a single state update, so tool execution can return the resulting summary without relying on stale React closures.

## 9.3 Coarse-to-fine titration

Keep ordinary single-drop execution unchanged.

`operate_titration` supports:

- `mode: "coarse"` — repeatedly invokes the ordinary drop intent until the configured fine window before endpoint;
- `mode: "drop"` — invokes exactly one ordinary drop intent;
- `mode: "accept"` — invokes the ordinary endpoint-accept intent.

Coarse rules:

- never cross into or past the endpoint;
- stop at `endpointDropCount - FINE_WINDOW_DROPS`;
- if already inside the fine window, return `USE_SINGLE_DROP_MODE`;
- cap sequence length defensively;
- return drops added, delivered volume, visual state, and the next recommended mode;
- never return endpoint drop count or hidden analyte molarity to the rehearsal agent.

The human UI should use the same helper rather than a separate shortcut.

---

# 10. Composer session and human control

## 10.1 Session reducer

Do not add many unrelated state variables to `TeacherStudio`. Implement one focused `useComposerSession()` hook using `useReducer`.

Suggested state:

```ts
interface ComposerSessionState {
  revision: number;
  webmcpStatus: "unsupported" | "registering" | "ready" | "error";
  inventory: LabInventoryProfile;
  staged?: StagedExperiment;
  rehearsal?: {
    stageId: string;
    open: boolean;
  };
  protocolReport?: ProtocolCheckReport;
  activity: ComposerActivityEntry[];
}
```

Required transitions:

- replace inventory;
- stage experiment;
- derive stage staleness when inventory revision or current-draft fingerprint changes;
- discard stage;
- open/close rehearsal;
- store/clear Protocol Check report;
- apply stage completed;
- update WebMCP status.

## 10.2 Human-only apply

The WebMCP adapters must not receive the apply callback.

The visible Apply button:

1. recomputes staleness from the current inventory revision and a stable fingerprint of the current draft;
2. refuses a stale stage;
3. optionally requires a passing Protocol Check for the physical-rehearsal context, while allowing an explicit human override only if clearly labeled;
4. calls `setDraft()` with the staged definition;
5. selects the new start node;
6. records a visible status message;
7. clears or marks the stage applied.

P0 may require a passing Protocol Check for all applies if that simplifies and strengthens the product. Use the existing stable lab serialization helper when possible; do not add a cryptographic dependency merely for the fingerprint. A deterministic normalized JSON string or small in-repo hash is sufficient for change detection.

## 10.3 UI layout

Add a fixed or overlay Composer drawer rather than a permanent fourth column.

At 1440 × 900 and 1366 × 768:

- existing process map and preview remain usable;
- drawer width is approximately 400–480 px;
- long limitations scroll inside the drawer rather than forcing page overflow;
- rehearsal may use a large modal/overlay containing Student Player;
- all controls remain keyboard accessible.

At 1024 × 768:

- drawer may become near-full-width;
- no mobile layout work is required for the challenge.

---

# 11. WebMCP implementation

## 11.1 Use the current standard surface directly

The repository must visibly contain production code that calls:

```ts
await document.modelContext.registerTool(
  {
    name,
    title,
    description,
    inputSchema,
    annotations,
    execute,
  },
  { signal: registrationController.signal },
);
```

Requirements:

- feature-detect `document.modelContext`;
- treat WebMCP as progressive enhancement;
- use an `AbortController` to own the registration lifetime;
- honor the execution callback's `AbortSignal` for loops or expensive checks;
- return plain JSON-serializable objects;
- validate all inputs again in application code with AJV;
- do not use deprecated `navigator.modelContext` in production challenge code;
- do not use `exposedTo` for the same-origin challenge app;
- do not register tools in assessment mode.

## 11.2 Avoid stale closures

`useWebMCPRegistry` should register tools only when the major surface changes:

- Studio tool set while `surface === "studio"`;
- rehearsal tool set while `surface === "rehearsal"`.

Tool handlers should read current state through stable refs or a controller object. Do not re-register tools on every inventory edit, stage update, or process-node transition.

Use a two-phase major-surface swap because `start_lab_rehearsal` itself executes from the Studio registry:

1. create a new controller for the destination surface;
2. register and await the destination tool set first—the Studio and rehearsal names are intentionally different;
3. only after successful destination registration, abort the previous controller;
4. update the visible ready/error status;
5. if destination registration fails, keep the previous registry active and roll back the surface transition.

`start_lab_rehearsal` must not report success until the rehearsal tool set is ready. Human close performs the same two-phase activation in reverse. Never rapidly replace the same tool name.

## 11.3 UI update semantics

State-changing tools must update the visible app before reporting success whenever practical.

Use one of these conservative approaches:

- `flushSync()` around the Composer reducer dispatch for synchronous tool mutations; or
- dispatch followed by a tested `waitForUiRevision(expectedRevision, signal)` that resolves after the revision is rendered.

Do not depend on an unbounded timeout or an arbitrary multi-second sleep.

If domain state succeeds but visual acknowledgement times out, return a warning code rather than replaying the mutation.

## 11.4 Annotations

Use only current standardized hints:

- `readOnlyHint: true` for inspection tools;
- `untrustedContentHint: true` when output includes user-authored objective/title or other external/user-provided content.

Mutation tools use `readOnlyHint: false` or omit it according to the current type definition.

Do not invent standardized annotations such as `guarded`, `destructiveHint`, or custom confirmation metadata. Human confirmation remains an application UI behavior.

---

# 12. Studio tool contracts

Register these seven tools while the Teacher Studio surface is active. Keep names and parameter names under the Chrome-recommended budgets.

## 12.1 `inspect_lab_capabilities`

Purpose: return the one supported family, request options, catalog IDs/aliases, and principal limitations.

- no input;
- read-only;
- output is compact;
- never expose sample ground truth.

## 12.2 `inspect_lab_inventory`

Purpose: return current structured inventory and revision.

- no input;
- read-only;
- `untrustedContentHint: true` if inventory includes user labels;
- return only fields needed for the next call.

## 12.3 `replace_lab_inventory`

Purpose: replace the reversible Composer inventory profile visible in the drawer.

Input:

```ts
{
  expectedRevision: number;
  equipment: Array<{ definitionId: string; count: number }>;
  chemicals: Array<{
    chemicalId: string;
    quantityMl: number;
    concentrationM?: number;
    containerDefinitionId: string;
  }>;
  facilities: FacilityInventory;
}
```

Behavior:

- validate supported IDs and bounds;
- reject stale revision;
- increment revision once;
- make any existing stage stale with reason `inventory_changed`;
- update visible inventory and activity log;
- do not mutate the Teacher Studio draft.

## 12.4 `preview_lab_experiment`

Purpose: validate one bounded request, compile it, and visibly stage the preview.

Input: `ExperimentRequest` without any internal model fields.

Behavior:

- no separate stage call is needed;
- on blockers, return compact errors and do not alter the existing stage unless explicitly designed to clear it;
- on success, store `StagedExperiment`, open staged review, and return stage ID, status, module labels, warnings, and limitations summary;
- do not return the full `LabDefinition` or ground truth.

## 12.5 `inspect_lab_preview`

Purpose: inspect the current stage, validation, fidelity, and staleness.

- no input;
- read-only;
- `untrustedContentHint: true` because objective/title may be user supplied;
- no full definition or hidden model fields.

## 12.6 `start_lab_rehearsal`

Purpose: open a transient guided rehearsal for the current non-stale stage.

Input:

```ts
{ stageId: string }
```

Behavior:

- refuse missing/stale stage;
- reset a new rehearsal runtime;
- visibly open the rehearsal overlay;
- switch the active WebMCP surface to rehearsal;
- do not apply the stage to the Studio draft.

## 12.7 `run_lab_protocol_check`

Purpose: run the deterministic check suite against the current stage and show the report.

Input:

```ts
{ stageId: string }
```

Behavior:

- refuse missing/stale stage;
- run isolated checks with no mutation of the human rehearsal attempt;
- store and display the report;
- return counts, failed check IDs, fidelity status, and limitation count;
- do not return hidden expected values.

No WebMCP tool may apply, save, export, publish, or discard a stage.

---

# 13. Rehearsal tool contracts

Register these six stable tools for the entire guided rehearsal. The handlers revalidate the current step at execution time.

## 13.1 `inspect_rehearsal`

Returns:

- lab title and objective;
- current node ID/title;
- expected interaction type;
- available visible equipment instances with IDs and labels;
- evidence currently available;
- latest feedback/recovery;
- completion status;
- recommended next operation category.

Do not return:

- analyte ground truth;
- endpoint drop count;
- expected final molarity;
- a full future-step answer sequence.

Read-only; use `untrustedContentHint` when returning user-authored objective text.

## 13.2 `act_current_step`

Purpose: attempt the configured non-titration physical interaction.

Input:

```ts
{
  sourceInstanceId?: string;
  targetInstanceId?: string;
}
```

Behavior:

- resolve the current action interaction;
- reject when the current step is evidence, calculation, or drop titration and name the appropriate tool;
- construct the ordinary `RuntimeInteractionIntent`;
- pass through `resolveInteractionIntent()`;
- execute the resolved request with the existing reducer;
- return existing feedback and current-node summary.

Accepting source/target IDs allows the agent to make a visible wrong-target mistake and receive normal recovery feedback.

## 13.3 `operate_titration`

Purpose: operate the titration step without hundreds of separate agent calls.

Input:

```ts
{
  mode: "coarse" | "drop" | "accept";
}
```

Behavior:

- valid only for the configured dispense interaction;
- `coarse` uses the sequence helper and stops before the fine window;
- `drop` executes exactly one drop;
- `accept` executes the existing endpoint acceptance path;
- premature accept is rejected by the ordinary runtime;
- return visible color state, drops/volume added by this call, and recommended next mode;
- hide endpoint count and ground truth.

## 13.4 `record_step_evidence`

Purpose: record the evidence available for the current record/observation step.

- no input unless the current UI genuinely requires a learner-entered value;
- use the existing notebook/record intent path;
- refuse when no recordable evidence exists;
- do not fabricate measurements.

## 13.5 `submit_step_calculation`

Purpose: submit the current calculation using evidence already collected by the runtime.

Input may be empty if the existing calculation action computes from recorded evidence. If the Student Player currently expects user entry, accept only that explicit numeric value.

- use the ordinary calculation intent and reducer;
- premature submission must be rejected;
- return pass/fail and units, but not hidden expected values.

## 13.6 `reset_rehearsal`

Purpose: reset the transient guided attempt to the staged definition's initial state.

- no input;
- visible effect;
- return current start node and cleared evidence counts.

When the human closes rehearsal, abort the rehearsal registry and restore the Studio registry.

---

# 14. Deterministic Protocol Check

Protocol Check verifies declared workflow and supported model behavior. It is not scientific, safety, regulatory, or pedagogical certification.

## 14.1 Required checks

Run these isolated checks:

1. `schema_valid` — `validateLabDefinition()` passes.
2. `interaction_contracts_valid` — no blocking Studio interaction issues.
3. `inventory_roles_resolved` — all required roles and quantities resolve.
4. `titration_model_derives` — the existing model derives a feasible plan.
5. `happy_path_completes` — a pure driver completes the generated process through ordinary intents/reducer.
6. `wrong_target_rejected` — one intentionally incorrect target is rejected without advancing the node.
7. `early_endpoint_rejected` — endpoint acceptance before endpoint is rejected.
8. `premature_calculation_rejected` — calculation before required evidence is rejected.
9. `reset_restores_initial_state` — reset clears progress/evidence and restores initial equipment state.
10. `limitations_present` — required fidelity limitations are not empty.

P0 passes only when all mandatory checks pass. Warnings may remain for explicitly procedural limitations.

## 14.2 Pure driver

The driver may understand the compiled acid–base module IDs, but it must operate actions through:

- `resolveInteractionIntent()`;
- `performRuntimeAction()`;
- the same titration sequence helper used by rehearsal.

Do not mutate React state and do not reuse a previous test's state.

## 14.3 Report

```ts
export interface ProtocolCheckResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "warning";
  message: string;
}

export interface ProtocolCheckReport {
  reportId: string;
  stageId: string;
  createdAt: string;
  passed: boolean;
  checks: ProtocolCheckResult[];
  fidelityStatus: FidelityStatus;
  limitations: string[];
}
```

The visible report should make the distinction clear:

```text
Protocol Check: 10/10 declared checks passed
Scientific scope: simplified monoprotic acid titration model
Not verified: external sample identity, comprehensive safety, or real laboratory accuracy
```

---

# 15. Tests and evals

Keep testing concentrated on the challenge claim.

## 15.1 Unit tests

### Request and inventory

- default inventory validates;
- unknown equipment ID is rejected;
- missing burette produces a specific error;
- missing indicator is rejected for the indicator family;
- stale inventory revision is rejected;
- synthetic sample concentration cannot be overridden;
- physical-procedure context without declarations is not classified as physically ready;
- unsupported `familyId` produces `UNSUPPORTED_EXPERIMENT_FAMILY`; semantic misuse of the supported family is covered by agent evals rather than brittle keyword matching.

### Compiler

- output passes `validateLabDefinition()`;
- required module IDs are present in order;
- P0 indicator endpoint does not require a pH meter;
- model values are derived rather than copied from agent input;
- initial solute moles are correct;
- NaOH inventory is not double-counted;
- capacities are feasible;
- learner-facing summaries omit ground truth.

### Runtime

- ordinary one-drop behavior remains unchanged;
- coarse sequence stops before fine window;
- coarse mode never crosses endpoint;
- early accept remains rejected;
- sequence abort stops safely;
- proportional content transfer works for ordinary solutions if implemented;
- existing hard-water, filtration, and titration regression tests still pass.

### Protocol Check

- valid compiled stage passes all required checks;
- a deliberately broken prerequisite causes the correct failure;
- report does not expose hidden expected values.

## 15.2 WebMCP deterministic tests

Mock `document.modelContext` and verify:

- tools register through `document.modelContext.registerTool`;
- registration uses one AbortSignal owner;
- cleanup aborts the registry;
- no tools register when API is unavailable;
- Studio and rehearsal tool names do not overlap;
- handlers use current state rather than registration-time snapshots;
- AJV rejects malformed arguments;
- read-only and untrusted annotations are accurate;
- no Apply/Save/Export/Publish tool is registered;
- inspection outputs stay within compact budgets;
- rehearsal outputs omit sample ground truth and endpoint count.

Invoke each registered callback directly in tests to verify UI/controller side effects and result envelopes.

## 15.3 React tests

Test only high-value UI behavior:

- Composer opens and shows WebMCP support state;
- inventory replacement updates visible state;
- successful preview opens staged review without changing the current draft;
- inventory or draft changes make the stage stale and disable apply/rehearsal/check;
- human Apply replaces the draft;
- rehearsal opens and closes while tool surface changes;
- Protocol Check report renders.

## 15.4 One targeted Playwright journey

Add one challenge journey, not a broad suite:

1. open Studio;
2. inject/mock `document.modelContext` before app load;
3. call inspection tools;
4. replace inventory;
5. preview the experiment;
6. verify staged review appears and current draft is unchanged;
7. open rehearsal through the registered tool;
8. make one invalid interaction;
9. execute valid steps including coarse/drop/accept;
10. complete calculation;
11. close rehearsal;
12. run Protocol Check;
13. click human Apply;
14. verify generated title/process appears in Studio.

## 15.5 Real agent eval set

Create `docs/AGENT_EVALS.md` and run at least these cases in a real supported client:

| Case | User intent | Expected result |
|---|---|---|
| E1 | Direct valid titration request | Agent inspects, sets inventory, stages successfully |
| E2 | Natural-language equipment synonyms | Agent maps aliases to returned IDs |
| E3 | Missing burette | Preview fails with actionable correction |
| E4 | Unsupported chromatography request | Agent reports unsupported family; no fake lab staged |
| E5 | Physical-lab rehearsal missing eyewash/waste declaration | Not classified physically ready; no silent downgrade |
| E6 | User changes inventory or edits the Studio draft after staging | Stage becomes stale; agent must re-preview |
| E7 | Agent attempts endpoint acceptance early | Runtime rejects and agent recovers |
| E8 | Agent attempts to apply/save through WebMCP | No such tool exists; human remains in control |
| E9 | Objective contains text resembling instructions | Treated as data; tool behavior unchanged |
| E10 | Complete challenge prompt | End-to-end journey succeeds |

For each record:

- date;
- deployed commit;
- browser/client and model;
- prompt;
- observed tool sequence;
- success/failure;
- correction made to tool name, description, schema, or code.

This document is part of the submission evidence, not optional notes.

---

# 16. Implementation phases and gates

Do not start a later phase while an earlier hard gate is failing.

## Phase 0 — baseline and real-browser handshake

Tasks:

1. record baseline command results;
2. create feature branch;
3. add direct temporary WebMCP tool;
4. verify discovery/execution in ChatGPT in-app browser or Chrome;
5. add/pin `webmcp-types` and production registration helper;
6. remove temporary tool.

Hard gate:

- app still builds without WebMCP;
- at least one real browser/client discovers and executes a tool;
- production source directly calls `document.modelContext.registerTool`.

Suggested commit:

```text
feat(webmcp): establish typed browser tool registry
```

## Phase 1 — bounded Composer domain and compiler

Tasks:

1. add request/inventory/fidelity contracts;
2. add AJV schemas;
3. add catalogs and one family/module registry;
4. implement validation and role resolution;
5. compile acid–base `LabDefinition`;
6. run existing validators;
7. add focused domain tests;
8. add narrow content-conservation helper if safe.

Hard gate:

- valid request compiles;
- missing inventory fails descriptively;
- compiled definition validates;
- hidden/internal fields do not appear in public summary;
- existing tests pass.

Suggested commits:

```text
feat(composer): add bounded experiment and inventory contracts
feat(composer): compile verified acid-base titration family
fix(runtime): conserve ordinary solution content during partial transfer
```

The runtime commit is optional if the fallback limitation is used.

## Phase 2 — staged UI and Studio tools

Tasks:

1. implement Composer session reducer;
2. implement overlay drawer and staged review;
3. implement human Apply/Discard;
4. add Studio WebMCP adapters and schemas;
5. register stable Studio tool set;
6. add visible activity/status feedback;
7. add unit and React tests.

Hard gate:

- agent can inspect, replace inventory, and stage a lab;
- current draft remains unchanged until human Apply;
- no apply tool exists;
- inventory or current-draft changes invalidate the stage;
- UI remains usable at target viewports.

Suggested commit:

```text
feat(studio): add WebMCP-grounded staged experiment composer
```

## Phase 3 — guided rehearsal and stable rehearsal tools

Tasks:

1. implement pure interaction-sequence helper;
2. expose sequence method from player runtime;
3. implement rehearsal overlay/bridge;
4. implement stable rehearsal tool set;
5. implement coarse/drop/accept using ordinary intents;
6. sanitize all rehearsal outputs;
7. add focused runtime/WebMCP tests.

Hard gate:

- valid agent path completes generated lab;
- intentional wrong target and early accept are rejected visibly;
- assessment mode exposes no action tools;
- hidden answer fields are absent from tool output;
- existing player paths still pass.

Suggested commit:

```text
feat(player): enable WebMCP guided rehearsal through validated intents
```

## Phase 4 — Protocol Check, evals, deployment, and submission evidence

Tasks:

1. implement pure Protocol Check driver/report;
2. render report in Composer;
3. add one targeted Playwright journey;
4. run real agent eval cases and refine tools;
5. write README and focused docs;
6. deploy and verify live URL;
7. record under-three-minute demo with audio;
8. freeze submitted branch/site at deadline.

Hard gate:

- Protocol Check passes generated challenge example;
- automated and manual journey both pass;
- live URL works in a supported WebMCP browser;
- README contains copyable testing prompt and exact instructions;
- challenge lineage clearly distinguishes pre-existing Lab Studio from new work;
- video shows functioning WebMCP interaction in the first 10–15 seconds.

Suggested commits:

```text
feat(protocol-check): verify generated titration behavior
test(webmcp): cover complete human-agent challenge journey
docs(challenge): add WebMCP testing, fidelity, evals, and lineage
```

Use a conventional `test(...)` commit without the leading space.

---

# 17. Acceptance criteria

## Product

- A natural-language goal and inventory can be converted by a browser agent into a staged, executable titration lab.
- The human sees and controls the staged artifact.
- The generated lab is visibly different when supported request parameters or inventory options change.
- Unsupported experiment families are refused rather than approximated silently.

## WebMCP leverage

- Direct imperative registration is present and functioning.
- Tools manipulate the same live application state the human sees.
- Studio and rehearsal expose different relevant capabilities.
- Tool descriptions, schemas, validation, errors, and outputs support self-correction.
- The journey is materially more reliable than DOM scraping or canvas clicking.
- A real browser agent completes the documented journey.

## Scientific and operational fidelity

- All model internals are compiler-derived.
- Compiled definitions pass current validators.
- Existing titration model derives a feasible endpoint plan.
- Capacity and quantity checks pass.
- Evidence prerequisites are enforced.
- Coarse delivery cannot cross endpoint.
- Single-drop and endpoint acceptance use existing runtime behavior.
- Limitations are visible and specific.

## Human control and trust

- Agent cannot apply, save, export, or publish.
- Stage becomes stale after inventory or current-draft changes.
- User-authored text is treated as untrusted data.
- Rehearsal output does not reveal internal answer fields.
- Physical-lab readiness is not claimed from simulation alone.

## Regression

Required final commands:

```bash
npm run typecheck
npm test
npm run build
```

Run the targeted challenge Playwright test. Run the existing smoke suite if available. Document any skipped command and the concrete reason; do not claim it passed.

---

# 18. Demo target

The required public video is under three minutes and includes audio. Build toward this sequence.

## 0:00–0:15 — show it working immediately

Show the deployed Studio in ChatGPT's in-app browser. Ask the agent to inspect capabilities and inventory. Display the WebMCP activity/status in Lab Studio as the tools run.

Narration:

> Lab Studio exposes its scientific capabilities directly to the browser agent, so the agent does not guess at the process-map or simulator UI.

## 0:15–0:50 — goal and inventory become a staged lab

Give the flagship request. Show:

- inventory update;
- generated module sequence;
- fidelity status and limitations;
- staged review;
- unchanged original draft.

Narration:

> The agent cannot invent arbitrary chemistry. It compiles the request only through Lab Studio's verified titration family and the inventory actually declared by the user.

## 0:50–1:15 — human control

Point out that Apply is a visible human-only button. Open the transient rehearsal without applying the draft.

## 1:15–2:20 — agent acts as a learner

Show:

- one wrong-target attempt and recovery;
- premature endpoint acceptance rejection;
- coarse delivery near endpoint;
- one-drop endpoint approach;
- evidence recording and calculation completion;
- visible apparatus/process changes.

Narration:

> Every agent action uses the same interaction resolver and reducer as a learner; there is no complete-step bypass.

## 2:20–2:45 — Protocol Check

Show 10/10 declared checks passing and the scientific limitations immediately below.

## 2:45–2:58 — human applies

Click Apply and show the generated process in Teacher Studio.

Closing sentence:

> Lab Studio lets an agent compose and rehearse the best experiment the application can substantiate, while the teacher keeps final authority.

---

# 19. Documentation deliverables

Keep documentation focused.

## `README.md`

Required sections:

- what the app does;
- why WebMCP is essential;
- live test instructions;
- one copyable agent prompt;
- current supported family;
- human-only Apply rule;
- scientific and static-client limitations;
- development commands;
- challenge lineage summary;
- links to the documents below.

## `docs/WEBMCP.md`

Document:

- direct API integration;
- tool list by surface;
- lifecycle and AbortSignal handling;
- annotations;
- input validation;
- progressive enhancement;
- how to inspect tools in ChatGPT/Chrome;
- why no backend MCP server is needed.

## `docs/FIDELITY.md`

Document:

- modeled behavior;
- procedural-only behavior;
- inventory and facility declaration semantics;
- physical-sample limitation;
- graduated-cylinder precision limitation;
- client-side answer visibility limitation;
- exact scope of Protocol Check.

## `docs/AGENT_EVALS.md`

Record real eval results as specified above.

## `docs/CHALLENGE_LINEAGE.md`

Document:

- pre-existing baseline commit and features;
- files and capabilities added after August 25, 2026;
- dated commit list;
- concise statement that judges should evaluate the WebMCP Composer extension.

Do not create six overlapping design documents. The implementation and README should remain the primary source of truth.

---

# 20. Stop and pivot rules

1. **WebMCP not discoverable in a real supported browser:** stop domain expansion and resolve deployment/origin/registration first.
2. **Compiled definition cannot complete through existing runtime:** simplify the compiler to match the existing acid-base reference; do not add a new chemistry engine.
3. **Content-conservation refactor breaks unrelated labs:** revert it, add the explicit limitation, and preserve the working challenge journey.
4. **Optional pH module delays P0:** omit it.
5. **Drawer harms the current Studio layout:** use an overlay modal/drawer rather than reflowing the core columns.
6. **Too many tools confuse the agent:** improve names/descriptions or combine overlapping operations; do not add routing instructions to the prompt as a substitute for better tools.
7. **Agent repeatedly exposes or asks for ground truth:** remove those fields from inspection schemas/results and strengthen code-level sanitization.
8. **Protocol Check becomes a second simulator implementation:** stop and route it through existing resolver/reducer functions.
9. **Schedule pressure:** prioritize in this order:
   - real WebMCP handshake;
   - valid compiler;
   - staging and human control;
   - rehearsal;
   - Protocol Check;
   - agent evals and README;
   - visual polish;
   - all P1 items last.

---

# 21. Codex final delivery report

At completion, return a concrete report with these headings.

## Baseline

- baseline commit;
- baseline command results;
- branch created.

## Implemented

- exact user-visible capabilities;
- exact WebMCP tool names;
- generated family/modules;
- human-only controls;
- runtime changes;
- Protocol Check cases.

## Verification

For each command, state pass/fail and key counts:

```text
npm run typecheck
npm test
npm run build
targeted Playwright journey
existing smoke suite, if run
```

Also report:

- WebMCP-capable browsers/clients tested;
- deployed URL tested;
- agent eval pass/fail summary.

## Fidelity

State:

- what is scientifically modeled;
- what is procedural only;
- what is unsupported;
- whether content conservation was implemented or disclosed as simplified;
- whether optional pH confirmation was included;
- static-client answer limitation.

## Changed files and commits

- concise changed-file list;
- commit SHAs and messages;
- challenge-lineage evidence.

## Remaining risks

List only real remaining risks. Do not use a generic “looks good” conclusion.

---

# 22. Authoritative references for implementation

Review these current primary sources before finalizing WebMCP code:

- WebMCP Draft Community Group Report, 26 August 2026: `https://webmachinelearning.github.io/webmcp/`
- Chrome WebMCP guide: `https://developer.chrome.com/docs/ai/webmcp`
- Chrome WebMCP best practices: `https://developer.chrome.com/docs/ai/webmcp/best-practices`
- Chrome WebMCP tool security: `https://developer.chrome.com/docs/ai/webmcp/secure-tools`
- Chrome WebMCP evals: `https://developer.chrome.com/docs/ai/webmcp/evals`
- official type declarations: `https://www.npmjs.com/package/webmcp-types`
- OpenAI challenge page: `https://openai.com/webmcp-challenge/`
- Devpost challenge requirements and rules: `https://webmcp.devpost.com/`

The WebMCP draft is experimental and may change. Keep all browser-API-specific code isolated under `src/webmcp`, pin the type declaration version used for submission, and document the tested browser/client versions.
