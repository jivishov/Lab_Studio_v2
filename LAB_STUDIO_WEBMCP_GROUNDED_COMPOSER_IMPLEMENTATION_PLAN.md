# Lab Studio WebMCP Grounded Experiment Composer
## Codex implementation plan and execution contract

**Repository:** `jivishov/Lab-Studio`  
**Target branch:** `feature/webmcp-grounded-experiment-composer`  
**Primary challenge deliverable:** a polished, inventory-aware acid–base titration vertical slice built with browser-native WebMCP tools  
**Challenge deadline:** September 3, 2026 at 1:00 PM Pacific / 3:00 PM Central  
**Default design viewport:** 15-inch laptop, approximately 1440 × 900; also verify 1366 × 768 and 1024 × 768 tablet layouts  
**Deployment constraint:** retain the current static Vite/GitHub Pages architecture

---

# 0. Codex operating directive

Implement the plan, not another planning document.

Begin by reading the existing source and tests, especially:

- `README.md`
- `package.json`
- `src/domain/types.ts`
- `src/domain/validation.ts`
- `src/domain/interactions.ts`
- `src/domain/titrationModels.ts`
- `src/equipment/catalog.ts`
- `src/runtime/createRuntime.ts`
- `src/runtime/interactionIntents.ts`
- `src/runtime/reducer.ts`
- `src/player/StudentPlayer.tsx`
- `src/player/usePlayerRuntime.ts`
- `src/player/goblinMode.ts`
- `src/studio/TeacherStudio.tsx`
- `src/studio/studioState.ts`
- `src/studio/studioValidation.ts`
- `src/assistant/actionCatalog.ts`
- `src/assistant/actionCatalog.json`
- `src/assistant/studioPageAdapter.ts`
- `public/labs/acid-base-titration.json`
- relevant tests under `src/**/__tests__`
- `tests/lab-studio.smoke.e2e.ts`

Before editing, run:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Record the baseline result in the implementation summary.

## Non-negotiable engineering rules

1. **Do not implement unrestricted “AI invents arbitrary chemistry.”**
   The browser agent may compose only from registered, versioned experiment families and verified procedural modules.

2. **Do not let WebMCP bypass Lab Studio’s runtime.**
   Agent rehearsal actions must pass through the same `resolveInteractionIntent()` and reducer paths used by human interactions.

3. **Do not expose arbitrary draft JSON mutation as the main WebMCP interface.**
   WebMCP tools must use coherent domain operations: inventory configuration, blueprint validation, blueprint staging, rehearsal, and protocol checking.

4. **Do not expose a WebMCP tool that silently applies a staged experiment.**
   Applying or replacing the current draft must require an explicit in-app human click.

5. **Do not add a backend, MCP transport, API key, OpenAI API call, SSE, or `stdio` transport.**
   WebMCP runs in the browser tab. The existing local AI assistant may remain, but this challenge feature must not depend on it.

6. **Do not use `eval`, generated JavaScript, arbitrary teacher code, or unsanitized HTML.**

7. **Do not overstate safety or scientific validity.**
   The application must distinguish:
   - modeled and executable;
   - procedurally executable;
   - design-only;
   - unsupported.

8. **Keep the current app working when WebMCP is unavailable.**
   WebMCP is progressive enhancement.

9. **Keep changes compact and maintainable.**
   Reuse AJV, current domain validation, equipment definitions, runtime state, and titration model. Do not add a state-management framework or schema-generation dependency.

10. **Testing should be focused.**
    Run typecheck, unit tests, build, and one targeted WebMCP/composer smoke journey. Do not spend the challenge window building broad adversarial or visual-regression infrastructure.

11. **Use logical commits.**
    Do not combine the entire implementation into one opaque commit.

---

# 1. Product outcome

Implement **Lab Studio Grounded Experiment Composer**:

> A teacher or trainer describes the experiment objective and the laboratory inventory. A browser agent inspects Lab Studio’s supported scientific capabilities, translates the user’s inventory into a structured profile, stages a verified experiment blueprint, shows the assumptions and limitations, rehearses the experiment through the same simulator runtime used by learners, and runs a deterministic protocol check. The human remains responsible for applying the staged experiment.

The challenge vertical slice supports one scientifically bounded family:

## Acid–base titration of a synthetic monoprotic-acid sample with standardized NaOH

Supported variants:

- phenolphthalein endpoint;
- phenolphthalein endpoint plus pH-meter confirmation when a pH meter is available.

The generated experiment must be parameterized by:

- audience;
- objective;
- virtual-only or physical-lab-mirroring context;
- analyte display name;
- hidden synthetic analyte molarity;
- analyte aliquot volume;
- titrant molarity;
- stoichiometric ratio;
- indicator/pH endpoint variant;
- calculation tolerance;
- available equipment, chemicals, quantities, and facilities.

The implementation must deliberately refuse or downgrade requests outside this model.

---

# 2. Current architecture to preserve and reuse

The current app already has the correct core separation:

```text
Teacher Studio
    edits LabDefinition
          ↓
schema and interaction validation
          ↓
Student Player
          ↓
resolveInteractionIntent()
          ↓
runtime reducer
          ↓
equipment, measurements, notebook, calculations, feedback
```

Reuse these existing strengths:

- `LabDefinition`, `TechniqueDefinition`, process nodes, actions, validation rules, and equipment contents;
- equipment capacities, precision, affordances, snap zones, and accessible names;
- `validateLabDefinition()`;
- `collectStudioInteractionIssues()`;
- `deriveTitrationDropPlan()`;
- `resolveInteractionIntent()`;
- `performRuntimeAction()`;
- Student Player’s pointer, keyboard, and programmatic intent bridge;
- existing local draft/import/export behavior;
- current acid–base titration as a reference implementation.

Do **not** simply expose the existing assistant action catalog as WebMCP. It is useful as an internal precedent, but it is too low-level and patch-oriented for the challenge product.

---

# 3. Target human-agent journey

The final challenge journey must work as follows.

## 3.1 User request

The user tells the browser agent something like:

> Create a 45-minute guided virtual pre-lab for estimating the molarity of a synthetic unknown monoprotic acid with 0.100 M NaOH. We have a 50 mL burette, ring stand and clamp, graduated cylinder, 250 mL Erlenmeyer flask, phenolphthalein, waste beaker, goggles, eyewash, and chemical-waste container. We do not have a pH meter. Students must record the aliquot, initial and final burette readings, endpoint observation, and molarity.

## 3.2 Agent inspects capabilities

The agent calls:

- `inspect_experiment_capabilities`
- `inspect_current_inventory`

Lab Studio returns the supported family, module list, allowed parameter bounds, equipment roles, known limitations, and current inventory.

## 3.3 Agent configures inventory

The agent calls `set_current_inventory` with only supported equipment and chemical identifiers.

Lab Studio visibly updates the inventory panel. Unsupported items are not silently accepted.

## 3.4 Agent validates and stages a blueprint

The agent calls:

- `validate_experiment_blueprint`
- `stage_experiment_blueprint`

Lab Studio compiles a complete staged `LabDefinition`, but does not replace the current draft.

## 3.5 Human reviews

The staged review panel shows:

- objective and audience;
- selected family and module sequence;
- equipment and chemical mapping;
- calculation/model summary;
- fidelity status;
- assumptions;
- limitations;
- blockers and warnings;
- “Apply staged experiment” and “Discard” buttons.

The human must click **Apply staged experiment**.

## 3.6 Agent rehearses

The agent calls `start_guided_rehearsal`.

In rehearsal mode, Lab Studio unregisters authoring mutation tools and exposes current-step simulator tools. The agent performs the experiment through the existing interaction resolver.

## 3.7 Agent tests an invalid path

At least one visible invalid interaction must be demonstrated, such as:

- wrong source;
- wrong target;
- accepting the endpoint too early;
- attempting evidence or calculation out of sequence.

The simulator must reject it without advancing the process.

## 3.8 Protocol Check

The agent calls `run_protocol_check`.

Lab Studio runs deterministic isolated checks and displays a report:

- schema valid;
- inventory satisfied;
- model internally consistent;
- capacities sufficient;
- happy path completed;
- wrong-target rejection passed;
- premature endpoint acceptance rejected;
- premature calculation rejected;
- final calculation passed;
- known limitations retained.

---

# 4. Scope priorities

## P0 — required challenge vertical slice

Implement all of the following before any optional work:

1. WebMCP progressive-enhancement adapter.
2. Structured inventory profile and editor.
3. Acid–base titration blueprint schema.
4. Versioned verified-module registry for the titration sequence.
5. Blueprint validation and compilation into `LabDefinition`.
6. Fidelity manifest and layered validation report.
7. Staged proposal UI with human-only apply/discard.
8. Dynamic Studio WebMCP tools.
9. Guided rehearsal overlay and dynamic Player WebMCP tools.
10. Coarse/fine titrant dispensing suitable for a short demo.
11. Deterministic Protocol Check.
12. Focused unit and smoke tests.
13. Challenge README and demo documentation.

## P1 — polish only after P0 passes all gates

- browser-agent activity ribbon;
- compact diff between current and staged lab;
- richer inventory editing;
- indicator-only versus indicator-plus-pH visual explanation;
- improved empty/error states;
- challenge landing-page copy;
- tool invocation examples and screenshots;
- Lighthouse registered-tools audit notes.

## P2 — explicitly post-challenge

- general solution-preparation family;
- density family;
- calorimetry;
- broader chemical registry;
- reviewed safety-rule registry;
- SOP ingestion;
- technician onboarding records;
- authentication, rosters, audit logs, or LMS integration;
- general reaction, equilibrium, kinetics, chromatography, or spectroscopy engines.

Do not allow P2 work to delay P0.

---

# 5. Proposed source layout

Use the following organization. Minor naming adjustments are acceptable, but preserve the separation of concerns.

```text
src/
  experimentComposer/
    types.ts
    schemas.ts
    inventory.ts
    capabilityCatalog.ts
    acidBaseTitrationFamily.ts
    validateBlueprint.ts
    compileBlueprint.ts
    validateCompiledExperiment.ts
    fidelity.ts
    persistence.ts
    __tests__/
      inventory.test.ts
      acidBaseTitrationFamily.test.ts
      compileBlueprint.test.ts
      fidelity.test.ts

  protocolCheck/
    types.ts
    programmaticDriver.ts
    runProtocolCheck.ts
    acidBaseChecks.ts
    __tests__/
      programmaticDriver.test.ts
      runProtocolCheck.test.ts

  webmcp/
    modelContext.d.ts
    types.ts
    result.ts
    toolSchemas.ts
    useWebMCPTools.ts
    activity.ts
    createStudioWebMCPAdapter.ts
    useStudioWebMCPTools.ts
    usePlayerWebMCPTools.ts
    __tests__/
      toolSchemas.test.ts
      useWebMCPTools.test.tsx
      studioAdapter.test.ts
      playerTools.test.tsx

  studio/
    ExperimentComposerPanel.tsx
    InventoryProfileEditor.tsx
    StagedExperimentReview.tsx
    ProtocolCheckPanel.tsx
    GuidedRehearsalOverlay.tsx

  player/
    ...existing files...
```

Avoid creating one file per tiny titration step during the challenge. Keep the initial verified modules together in `acidBaseTitrationFamily.ts`, but represent them as distinct versioned module definitions.

---

# 6. Domain contracts

## 6.1 Fidelity classification

Add:

```ts
export type ExperimentFidelityStatus =
  | "modeled_and_executable"
  | "procedurally_executable"
  | "design_only"
  | "unsupported";
```

Meaning:

- `modeled_and_executable`: Lab Studio has both procedural runtime coverage and an explicit scientific model for the expected result.
- `procedurally_executable`: the workflow can be rehearsed, but one or more scientific outcomes are scripted or externally supplied.
- `design_only`: a process map can be proposed, but the current runtime cannot execute it faithfully.
- `unsupported`: required capability, inventory, or reviewed model is missing.

Only the first status should receive a green “Modeled and executable” badge.

## 6.2 Inventory contracts

Implement a separate inventory model rather than treating `LabDefinition.equipment` as a complete physical inventory.

```ts
export type SupportedChemicalId =
  | "synthetic-monoprotic-acid-solution"
  | "sodium-hydroxide-solution"
  | "phenolphthalein-indicator"
  | "deionized-water";

export interface InventoryEquipmentItem {
  definitionId: string;
  count: number;
}

export interface InventoryChemicalItem {
  chemicalId: SupportedChemicalId;
  label: string;
  containerDefinitionId: string;
  quantity: {
    value: number;
    unit: "mL" | "g";
  };
  concentration?: {
    value: number;
    unit: "M";
  };
}

export interface FacilityInventory {
  goggles: boolean;
  gloves: boolean;
  eyewash: boolean;
  spillResponseMaterials: boolean;
  chemicalWasteContainer: boolean;
}

export interface InventoryProfile {
  schemaVersion: "1.0";
  id: string;
  title: string;
  source: "demo" | "user";
  equipment: InventoryEquipmentItem[];
  chemicals: InventoryChemicalItem[];
  facilities: FacilityInventory;
  updatedAt: string;
}
```

Validation requirements:

- `count` must be an integer from 0 through 20.
- quantities and concentrations must be finite and non-negative.
- equipment IDs must exist in `equipmentById`.
- chemical IDs must exist in the small supported chemical registry.
- each chemical’s container must be compatible with its state.
- duplicate equipment IDs must be normalized by summing counts.
- duplicate chemical IDs must be rejected unless they represent clearly distinct labeled lots; do not implement lots in P0.
- no arbitrary hazard or compatibility claims may be authored through WebMCP.

Persistence:

- persist the approved/current inventory profile in `localStorage`;
- key: `lab-studio:webmcp:inventory:v1`;
- use a safe default challenge profile if parsing fails;
- do not let malformed storage data crash Studio.

## 6.3 Acid–base blueprint

Use a discriminated union even though P0 has one family.

```ts
export type ExperimentBlueprint = AcidBaseTitrationBlueprint;

export interface AcidBaseTitrationBlueprint {
  schemaVersion: "1.0";
  familyId: "acid-base-titration";
  id: string;
  title: string;
  objective: string;
  audience: {
    level: "high-school" | "college-intro" | "technician-onboarding";
    experience: "novice" | "intermediate";
    mode: "guided" | "assessment";
  };
  deliveryContext: "virtual-only" | "mirrors-physical-lab";
  inventoryProfileId: string;
  durationMinutes: number;

  sample: {
    mode: "synthetic-virtual-unknown";
    displayName: string;
    virtualGroundTruthMolarityM: number;
    sourceVolumeMl: number;
    aliquotVolumeMl: number;
  };

  titrant: {
    chemicalId: "sodium-hydroxide-solution";
    molarityM: number;
    buretteInitialReadingMl: number;
  };

  stoichiometricRatio: {
    analyte: number;
    titrant: number;
  };

  endpoint: {
    mode: "phenolphthalein" | "phenolphthalein-plus-ph";
    dropVolumeMl: number;
    endpointOffsetDrops: number;
    maxExtraDrops: number;
    coarseIncrementMl: number;
    fineWindowMl: number;
  };

  evidence: {
    requireAliquotMeasurement: true;
    requireInitialBuretteReading: true;
    requireEndpointObservation: true;
    requireFinalBuretteReading: true;
    requireMolarityCalculation: true;
  };

  assessment: {
    calculationToleranceM: number;
    includeCommonMistakes: boolean;
  };

  assumptions: string[];
}
```

Use strict AJV schemas with `additionalProperties: false`.

Recommended bounds:

- `durationMinutes`: 10–180;
- analyte molarity: 0.01–0.5 M;
- analyte source volume: 10–500 mL;
- aliquot: 1–50 mL;
- titrant molarity: 0.01–1.0 M;
- initial burette reading: 0–10 mL;
- stoichiometric terms: positive finite values, maximum 10;
- drop volume: 0.01–0.2 mL;
- endpoint offset: integer 0–10;
- max extra drops: integer 0–20;
- coarse increment: 0.25–5 mL;
- fine window: 0.1–2 mL;
- calculation tolerance: positive and no larger than 0.05 M;
- title, objective, display name, and assumptions must have conservative length limits.

## 6.4 Versioned module contract

```ts
export interface VerifiedModuleRef {
  id: string;
  version: string;
}

export interface VerifiedModuleDefinition {
  id: string;
  version: string;
  familyId: "acid-base-titration";
  title: string;
  description: string;
  requiredEquipmentRoles: string[];
  requiredChemicalRoles: string[];
  producedEvidence: string[];
  build: (context: AcidBaseComposerContext) => {
    node: ProcessNode;
    action: ActionDefinition;
  };
}
```

P0 modules:

1. `mount-burette`
2. `measure-analyte-aliquot`
3. `transfer-analyte-to-flask`
4. `add-indicator`
5. `record-initial-burette-reading`
6. `dispense-titrant-to-endpoint`
7. `confirm-indicator-endpoint`
8. optional `confirm-endpoint-with-ph`
9. `record-final-burette-reading`
10. `calculate-analyte-molarity`

The family chooses one of modules 7 or 8 according to the endpoint mode and inventory.

Each generated node/action ID must be deterministic from blueprint ID plus module ID.

## 6.5 Composed artifact

```ts
export interface ComposedExperimentArtifact {
  blueprint: ExperimentBlueprint;
  inventorySnapshot: InventoryProfile;
  lab: LabDefinition;
  fidelity: FidelityManifest;
  validation: LayeredValidationReport;
  provenance: VerifiedModuleRef[];
  compiledAt: string;
}
```

The staged artifact is unapproved and must be held separately from `draft`.

Persist staged artifacts only in `sessionStorage`, not `localStorage`:

- key: `lab-studio:webmcp:staged-artifact:v1`;
- discard staged data when the user explicitly discards it;
- if restoration fails, clear it safely.

## 6.6 Layered validation report

```ts
export type ValidationSeverity = "error" | "warning" | "limitation" | "info";

export interface ComposerValidationIssue {
  code: string;
  severity: ValidationSeverity;
  category:
    | "schema"
    | "inventory"
    | "equipment"
    | "material"
    | "scientific-model"
    | "safety-prerequisite"
    | "pedagogy"
    | "runtime"
    | "fidelity";
  path?: string;
  message: string;
  recovery?: string;
}

export interface LayeredValidationReport {
  ok: boolean;
  fidelityStatus: ExperimentFidelityStatus;
  issues: ComposerValidationIssue[];
  checks: {
    schema: boolean;
    inventory: boolean;
    equipment: boolean;
    material: boolean;
    scientificModel: boolean;
    safetyPrerequisites: boolean;
    pedagogy: boolean;
    runtimeDefinition: boolean;
  };
}
```

Do not collapse warnings and limitations into generic “valid.”

## 6.7 Fidelity manifest

```ts
export interface FidelityManifest {
  status: ExperimentFidelityStatus;
  scientificModelIds: string[];
  moduleRefs: VerifiedModuleRef[];
  supportedClaims: string[];
  verifiedConstraints: string[];
  assumptions: string[];
  limitations: string[];
  localReviewRequired: string[];
}
```

For the acid–base family, always disclose at least:

- the analyte is a synthetic virtual unknown with predefined hidden molarity;
- the model is stoichiometric and does not calculate a full titration curve;
- activity coefficients and temperature effects are omitted;
- color change is a simplified endpoint state;
- optional pH-meter confirmation is procedural evidence only in P0; no quantitative pH curve or calibrated pH value is generated;
- the simulation does not validate manual meniscus/parallax skill;
- inventory and safety checks do not replace local SDS, SOP, or institutional review;
- physical accuracy depends on the precision of the equipment supplied in the inventory.

## 6.8 WebMCP result envelope

All tools return compact, JSON-serializable values:

```ts
export interface WebMCPToolResult<T = unknown> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
  context: {
    inventoryRevision: number;
    draftRevision: number;
    stagedRevision: number;
    surfaceMode: "studio" | "staged-review" | "rehearsal" | "protocol-report";
  };
}
```

Rules:

- no DOM nodes;
- no `Error` objects or stack traces;
- no full 30 KB lab JSON unless explicitly required;
- return a compact summary, issue list, and IDs;
- keep normal tool results below approximately 8 KB;
- use stable error codes to support agent recovery.

---

# 7. Capability and inventory catalogs

## 7.1 Capability catalog

Implement `capabilityCatalog.ts` with one P0 family:

```ts
{
  id: "acid-base-titration",
  version: "1.0.0",
  title: "Acid–base titration",
  status: "modeled_and_executable",
  supportedObjectives: [
    "practice titration sequence",
    "estimate or calculate synthetic analyte molarity",
    "practice endpoint evidence and burette readings"
  ],
  unsupportedObjectives: [
    "full pH-curve modeling",
    "polyprotic-acid equivalence analysis",
    "unknown real-sample identification",
    "method validation",
    "regulatory qualification"
  ],
  endpointVariants: [
    "phenolphthalein",
    "phenolphthalein-plus-ph"
  ]
}
```

The inspect tool must return concise module summaries and parameter bounds, not implementation internals.

## 7.2 Small supported chemical registry

Create only the challenge chemicals:

- synthetic monoprotic acid solution;
- standardized sodium hydroxide solution;
- phenolphthalein indicator;
- deionized water.

Each entry may contain:

- ID;
- display name;
- supported roles;
- compatible container definition IDs;
- supported concentration range;
- waste-stream label;
- a short internally reviewed training note;
- an explicit `safetyAuthority: "demo-only-not-a-substitute-for-sds"` marker.

Do not present the registry as comprehensive hazard data.

## 7.3 Challenge default inventory

Provide a valid default inventory containing:

- unknown-acid bottle;
- graduated cylinder;
- Erlenmeyer flask;
- phenolphthalein dropper;
- NaOH bottle;
- 50 mL burette;
- ring stand and clamp;
- waste beaker;
- optional pH meter;
- wash bottle if needed by the selected scenario;
- sufficient acid, NaOH, and indicator quantities;
- goggles, gloves, eyewash, spill-response materials, and chemical-waste container.

The inventory editor must allow the pH meter to be removed so the agent can adapt to the indicator-only variant.

---

# 8. Blueprint validation

Implement `validateBlueprint.ts` as a pure function.

Validation order:

1. AJV schema validation.
2. Inventory-profile ID matches the current inventory.
3. Required equipment-role resolution.
4. Required chemical-role resolution.
5. Chemical quantity sufficiency.
6. Burette capacity and initial-reading headroom.
7. Receiving-flask capacity.
8. endpoint variant availability.
9. titration model derivation.
10. measurement precision assessment.
11. safety-prerequisite declaration.
12. pedagogical evidence coverage.
13. final fidelity classification.

## Required calculations

Use `deriveTitrationDropPlan()` as the model source of truth.

Check:

```text
theoretical equivalence volume
+ initial burette reading
≤ burette capacity
```

Check:

```text
aliquot volume
+ endpoint delivered titrant volume
+ indicator volume
+ conservative headspace margin
≤ receiving-flask capacity
```

Check source quantities:

```text
acid inventory volume ≥ requested source/aliquot requirement
NaOH inventory volume ≥ the configured prefilled-burette volume
indicator inventory volume ≥ configured indicator use
```

The endpoint delivery is drawn from the prefilled burette and must not be double-counted. If the generated initial state also includes a stock NaOH bottle, subtract the burette fill from the stock quantity when creating its remaining contents.

## Endpoint variant logic

- `phenolphthalein` requires indicator but not pH meter.
- `phenolphthalein-plus-ph` requires indicator and pH meter.
- if the user omitted a pH meter and requested the plus-pH mode, return a recoverable error recommending the indicator-only variant;
- never silently change a requested mode during validation;
- the browser agent may submit a revised blueprint.

## Equipment precision logic

Use the catalog’s declared precision.

For physical-lab-mirroring mode:

- calculate approximate relative resolution for the aliquot instrument;
- if it is poor for quantitative analysis, return a warning or downgrade, not a false accuracy claim;
- do not fail virtual-only training solely because the physical instrument is approximate.

The challenge demo may use the existing graduated cylinder but must display the limitation.

## Safety-prerequisite logic

For `virtual-only`:

- safety notes remain in the generated lab;
- missing facilities are limitations, not physical execution approval.

For `mirrors-physical-lab`:

- missing goggles, eyewash, spill-response materials, or chemical-waste container is a blocking issue for this challenge profile;
- message: the virtual design can be reviewed, but it must not be labeled ready to mirror physically.

Avoid language such as “OSHA compliant,” “safe,” or “approved.”

---

# 9. Blueprint compiler

Implement `compileBlueprint.ts` as a pure or mostly pure compiler:

```ts
compileExperimentBlueprint(
  blueprint: ExperimentBlueprint,
  inventory: InventoryProfile
): CompilationResult
```

Workflow:

1. validate blueprint;
2. resolve equipment and chemical roles;
3. build correct initial equipment instances and content states;
4. create the `AcidBaseTitrationModel`;
5. build actions/nodes from the ordered verified modules;
6. build linear progression edges;
7. add retry edges only where useful and deterministic;
8. build assessments;
9. add metadata/provenance;
10. run `validateLabDefinition()`;
11. run `collectStudioInteractionIssues()`;
12. construct fidelity manifest;
13. return the composed artifact.

## 9.1 Correct initial material amounts

When constructing source contents, compute solute amount as actual amount, not concentration copied into the `amount` field.

For a solution:

```text
moles = molarity × volume in liters
```

Use that result in `SoluteState.amount`.

## 9.2 Generated titration model

Create:

```ts
{
  id: `${blueprint.id}-acid-base-model`,
  type: "acidBase",
  analyteMolarityM: blueprint.sample.virtualGroundTruthMolarityM,
  analyteVolumeMl: blueprint.sample.aliquotVolumeMl,
  titrantMolarityM: blueprint.titrant.molarityM,
  stoichiometricRatio: blueprint.stoichiometricRatio,
  dropVolumeMl: blueprint.endpoint.dropVolumeMl,
  endpointOffsetDrops: blueprint.endpoint.endpointOffsetDrops,
  maxExtraDrops: blueprint.endpoint.maxExtraDrops
}
```

All drop and expected-calculation parameters must be derived from this model rather than duplicated manually.

## 9.3 Generated module sequence

Recommended sequence:

1. mount burette;
2. measure analyte aliquot;
3. transfer analyte to flask;
4. add indicator;
5. record initial burette reading;
6. dispense titrant;
7. confirm endpoint;
8. record final burette reading;
9. calculate analyte molarity.

Each module supplies:

- action;
- process node;
- interaction spec;
- prerequisites;
- validation/evidence;
- success and recovery feedback;
- accessible interaction label.

## 9.4 Generated assessments

Require:

- aliquot measurement;
- initial burette measurement;
- endpoint notebook evidence;
- final burette measurement;
- calculation within tolerance;
- process completion.

Do not accept a calculation merely because the formula can be evaluated. Required evidence must be present.

## 9.5 Metadata and provenance

Extend `DefinitionMetadata` with an optional composer field:

```ts
composer?: {
  schemaVersion: "1.0";
  familyId: "acid-base-titration";
  blueprintId: string;
  moduleRefs: VerifiedModuleRef[];
  fidelityStatus: ExperimentFidelityStatus;
}
```

Update validation conservatively:

- accept the optional composer metadata;
- validate known fields when present;
- preserve backward compatibility with all existing labs.

---

# 10. Runtime fidelity refinement: content conservation

The current solution-transfer paths should not duplicate an entire solute amount into the target while leaving the same amount in the source.

Add a small, tested helper such as:

```text
src/runtime/contentTransfer.ts
```

Functions:

```ts
splitLiquidContentsByVolume(source, transferredVolumeMl)
mergeLiquidContents(target, transferred)
```

P0 behavior:

- support `liquid` and `solution` without precipitate;
- scale solute amounts by transferred-volume fraction;
- preserve concentration;
- decrement source volume and solute amounts;
- return empty contents when exhausted;
- keep existing specialized precipitate/filtration behavior unchanged;
- use the helper in `measureVolume`, ordinary `transfer`, and titrant coarse/drop delivery;
- keep acid–base reaction stoichiometry in the explicit titration model rather than pretending that the generic contents list is a complete equilibrium/speciation engine.

Do not attempt a general reaction engine.

Run all hard-water and titration regression tests after this change.

---

# 11. Runtime fidelity refinement: coarse and fine titrant dispensing

The existing one-drop-at-a-time implementation can require hundreds of interactions. That is unsuitable for a short agent demo and is less realistic than fast delivery away from endpoint followed by dropwise delivery near endpoint.

Extend the current `dispenseDrops` action parameters:

```ts
coarseIncrementMl
fineWindowMl
```

Extend the runtime request parameter:

```ts
dispenseMode: "coarse" | "drop" | "acceptEndpoint"
requestedVolumeMl?: number
```

## Coarse behavior

- allowed only before the fine window;
- requested volume bounded by the blueprint and tool schema;
- runtime converts volume to an integral number of configured drops;
- runtime caps the coarse delivery at the beginning of the fine window;
- it must never silently cross the endpoint;
- it updates source/target volume and `DropDispenseRecord`;
- return a clear message when the user must switch to single drops.

## Fine behavior

- keep existing single-drop behavior near endpoint;
- keep color-state transitions;
- keep early endpoint-acceptance rejection;
- keep maximum-extra-drop enforcement.

## Student UI

During a `dispenseDrops` step:

- while coarse delivery is permitted, show a guided “Dispense coarse volume” control;
- near endpoint, emphasize “Add one drop”;
- always show “Accept endpoint” but let runtime reject it when premature;
- assessment mode may provide less guidance.

## WebMCP player tools

Expose:

- `dispense_titrant_coarse` with `volumeMl`;
- `dispense_titrant_drop`;
- `accept_titration_endpoint`.

The agent must not be given a direct “complete titration” bypass.

---

# 12. WebMCP platform adapter

Use the imperative browser API directly. Do not add the experimental React package unless direct implementation proves impossible.

## 12.1 Type declaration

Create `src/webmcp/modelContext.d.ts` containing only the API surface used by Lab Studio:

```ts
interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

interface WebMCPExecuteOptions {
  signal: AbortSignal;
}

interface WebMCPToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    input: Record<string, unknown>,
    options: WebMCPExecuteOptions
  ) => Promise<unknown>;
  annotations?: WebMCPToolAnnotations;
}

interface WebMCPRegisterOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

interface WebMCPModelContext {
  registerTool(
    tool: WebMCPToolDefinition,
    options?: WebMCPRegisterOptions
  ): Promise<void>;
}

declare global {
  interface Document {
    modelContext?: WebMCPModelContext;
  }
}
```

Match the current draft API closely, but isolate it in one file so changes are easy if the draft evolves.

## 12.2 Feature detection

```ts
export const isWebMCPSupported = (): boolean =>
  typeof document !== "undefined" &&
  Boolean(document.modelContext?.registerTool);
```

No WebMCP support must mean:

- no registration attempt;
- no crash;
- Composer UI remains usable manually;
- status label says “Browser agent tools unavailable in this browser.”

## 12.3 Registration lifecycle

Implement `useWebMCPTools()`.

Requirements:

- create an `AbortController` for each registered surface/tool set;
- pass `controller.signal` to every `registerTool()` call;
- abort on unmount or surface-mode change;
- do not call a nonexistent `unregisterTool()`;
- suppress expected abort errors;
- report real registration errors in a small non-blocking status area;
- use refs for the latest adapter/state so tools do not need to be re-registered on every draft update;
- re-register only when the available tool set changes;
- honor the execution callback’s `options.signal`;
- call `signal.throwIfAborted()` when available, or explicitly check `signal.aborted`.

## 12.4 React state consistency

Mutation tools must resolve only after the relevant UI state is committed.

Provide a small helper:

```ts
await afterNextPaint();
```

Use one or two animation frames or a controlled promise resolved by an effect. Do not return success before the staged panel or rehearsal overlay exists.

## 12.5 Tool schemas

Keep schemas strict:

- `type: "object"`;
- all expected fields declared;
- explicit numeric bounds;
- `required`;
- `additionalProperties: false`;
- enums for family IDs, chemical IDs, endpoint modes, equipment IDs, and context modes.

Reuse AJV for local validation even though the browser agent should respect the schema.

## 12.6 Annotations

Use:

```ts
annotations: { readOnlyHint: true }
```

for inspection/validation tools that do not alter the experiment.

Use:

```ts
annotations: { untrustedContentHint: true }
```

when output includes user- or agent-authored objective, title, assumptions, or inventory labels.

Do not invent nonstandard annotations such as `guarded`.

## 12.7 Same-origin exposure

The challenge app is a single same-origin document. Do not set `exposedTo` in P0.

---

# 13. Dynamic WebMCP surface modes

Implement:

```ts
type AgentSurfaceMode =
  | "studio"
  | "staged-review"
  | "rehearsal"
  | "protocol-report";
```

## Studio mode

Register:

- capability inspection;
- inventory inspection/update;
- blueprint validation/staging;
- current/staged inspection;
- rehearsal start;
- protocol check.

## Staged-review mode

Keep read-only inspection and validation tools plus the ability to restage a revised blueprint.

Do not expose an apply/commit tool.

## Rehearsal mode

Abort/unregister authoring mutation tools.

Register:

- `inspect_rehearsal_state`;
- `reset_rehearsal`;
- exactly the action tools relevant to the current interaction.

## Assessment mode

Do not register action-completion WebMCP tools.

The challenge rehearsal must run in guided mode.

## Protocol-report mode

Expose read-only report inspection and a tool to return to the normal Studio surface if needed.

---

# 14. Studio WebMCP tools

Implement the following exact P0 tool surface.

## 14.1 `inspect_experiment_capabilities`

**Read-only**

Input:

```json
{
  "familyId": "acid-base-titration",
  "includeModules": true
}
```

Both fields optional.

Return:

- supported families;
- family version;
- supported objectives;
- endpoint variants;
- module IDs/titles/versions;
- parameter bounds;
- known limitations.

Do not return executable source code.

## 14.2 `inspect_current_inventory`

**Read-only; untrusted output when profile source is user**

Input: empty object.

Return:

- inventory profile ID/title;
- equipment IDs, labels, counts;
- chemical IDs, labels, quantities, concentration;
- facility booleans;
- unresolved unsupported entries, if any;
- inventory revision.

## 14.3 `set_current_inventory`

**Mutating**

Input:

```ts
{
  title: string;
  equipment: Array<{ definitionId: SupportedEquipmentId; count: number }>;
  chemicals: Array<InventoryChemicalItem>;
  facilities: FacilityInventory;
}
```

Behavior:

- validate;
- normalize;
- replace current session inventory;
- persist to localStorage;
- update visible panel;
- return concise summary and any warnings.

Do not accept unknown equipment or chemical IDs.

## 14.4 `validate_experiment_blueprint`

**Read-only**

Input: strict blueprint.

Behavior:

- validate against the current inventory;
- do not stage or alter draft;
- return fidelity status, blockers, warnings, limitations, derived equivalence volume, expected final burette reading, and selected endpoint variant.

Do not reveal hidden synthetic molarity in a student-facing field; tool output is teacher/agent context and may include it only under a clearly labeled model section.

## 14.5 `stage_experiment_blueprint`

**Mutating staged state only**

Input: strict blueprint.

Behavior:

- validate;
- compile;
- create `ComposedExperimentArtifact`;
- set staged artifact;
- open staged-review UI;
- leave current `draft` unchanged;
- persist staged artifact to sessionStorage;
- return module sequence, fidelity, and issue summary.

If validation has blocking errors, do not stage.

## 14.6 `inspect_staged_experiment`

**Read-only; untrusted output**

Input: empty object.

Return:

- staged blueprint summary;
- module sequence;
- equipment/chemical mapping;
- validation issues;
- fidelity manifest;
- whether the staged artifact is stale relative to current inventory/draft revisions;
- current human-review state.

## 14.7 `inspect_current_experiment`

**Read-only; untrusted output**

Input: empty object.

Return a compact current-draft summary:

- ID/title/objective/audience;
- equipment;
- node/action counts;
- process node titles;
- validation status;
- composer provenance if present;
- current fidelity status if known.

## 14.8 `start_guided_rehearsal`

**Mutating transient UI/runtime state**

Input:

```json
{
  "target": "staged"
}
```

`target` enum: `staged | current`.

Behavior:

- select the staged or current lab;
- create a fresh guided runtime;
- open the rehearsal overlay;
- set surface mode to `rehearsal`;
- return the first-step summary only after UI commit.

Do not apply a staged lab.

## 14.9 `run_protocol_check`

**Mutating report UI, not experiment definition**

Input:

```json
{
  "target": "staged",
  "checkSet": "challenge-core"
}
```

Behavior:

- run isolated deterministic checks;
- store/display report;
- do not alter the actual draft or active rehearsal state;
- return compact report summary.

---

# 15. Player WebMCP tools

Register tools according to current step.

## 15.1 Always available in guided rehearsal

### `inspect_rehearsal_state`

Return:

- lab title;
- current node ID/title;
- expected action ID/verb;
- expected interaction type;
- expected source/target definitions;
- progress count;
- latest feedback/recovery;
- current measurements;
- endpoint color state and whether coarse delivery remains allowed;
- completion status.

Do not return hidden endpoint drop count or synthetic ground-truth molarity as student-visible guidance.

### `reset_rehearsal`

Reset through the same runtime reset path.

## 15.2 Physical interaction step

### `attempt_current_interaction`

Input:

```ts
{
  sourceDefinitionId?: string;
  targetDefinitionId?: string;
}
```

Behavior:

- use the current expected interaction;
- resolve definition IDs to current instances;
- build the appropriate `RuntimeInteractionIntent`;
- call `resolveInteractionIntent()`;
- if successful, call normal runtime action;
- if rejected, preserve progress and return structured recovery feedback.

Do not accept arbitrary action IDs or verbs.

Applicable interactions:

- drag to zone;
- snap into target;
- pour;
- rinse;
- place/read instrument.

## 15.3 Titration dispense step

### `dispense_titrant_coarse`

Input:

```json
{ "volumeMl": 5 }
```

- runtime validates/caps delivery;
- no endpoint crossing;
- returns “switch to single drops” when appropriate.

### `dispense_titrant_drop`

Input: empty object.

### `accept_titration_endpoint`

Input: empty object.

- early call must fail;
- successful call records final burette measurement exactly as the normal runtime does.

## 15.4 Evidence step

### `record_current_evidence`

Input: empty object.

- use `notebookRecordIntent` or the current configured evidence action;
- do not let the agent write arbitrary notebook content in P0.

## 15.5 Calculation step

### `submit_current_calculation`

Input: empty object.

- use `calculationSubmitIntent`;
- calculation remains deterministic from recorded evidence and the registered model;
- no direct answer injection.

## 15.6 Completion

When the process is complete, register a read-only `inspect_rehearsal_result` tool returning:

- completion;
- attempts;
- measurements;
- calculation;
- evidence;
- failures and recovery;
- fidelity limitations.

---

# 16. Staged review and human control

## 16.1 Teacher Studio state

Add state without replacing the current architecture:

```ts
inventoryProfile
inventoryRevision
draftRevision
stagedArtifact
stagedRevision
composerPanelOpen
rehearsalTarget
rehearsalOpen
protocolCheckReport
surfaceMode
```

Increment revisions on meaningful changes.

A staged artifact stores the inventory/draft revision at compile time.

## 16.2 Staleness

If inventory changes after staging:

- mark staged artifact stale;
- disable “Apply staged experiment”;
- require restaging.

If the current draft changes after staging:

- display a replacement warning;
- applying still requires explicit human click;
- prefer requiring restage unless the implementation can clearly show that applying replaces current work.

## 16.3 Human-only actions

UI buttons:

- **Apply staged experiment**
- **Discard staged experiment**
- **Edit inventory**
- **Close rehearsal**
- **Return to Studio**

No WebMCP tool may invoke Apply.

When Apply is clicked:

1. verify staged artifact is valid and not stale;
2. replace `draft` with staged `lab`;
3. select the start node;
4. clear staged state;
5. show a clear status message;
6. do not automatically save to localStorage unless the user separately uses the existing Save action.

## 16.4 Layout

For the challenge desktop layout:

- preserve the existing process-map/live-preview split;
- present Composer as a right-side overlay/drawer or dedicated panel that does not shrink the process map below usability;
- make the staged review scroll internally;
- avoid page-level horizontal scroll;
- collapse detailed issues/limitations;
- use one visible fidelity badge and one issue count;
- keep the human Apply/Discard controls fixed within the panel footer.

Do not prioritize phone/mobile layout. Verify laptop and tablet sizes.

---

# 17. Guided rehearsal overlay

Create `GuidedRehearsalOverlay.tsx`.

Requirements:

- render the staged or current definition using `StudentPlayer`;
- use full rather than compact preview chrome;
- pass a prop such as:

```ts
webMcpMode="guided-rehearsal"
```

- keep the underlying Studio mounted so the current draft/staged state is preserved;
- disable Studio editing while overlay is active;
- provide a clear human Close button;
- display a small browser-agent status/activity line;
- tools register only after overlay is mounted;
- close unregisters all Player tools and restores Studio tools.

Modify `StudentPlayerProps` conservatively:

```ts
webMcpMode?: "disabled" | "guided-rehearsal";
onRehearsalSnapshot?: (snapshot: RehearsalSnapshot) => void;
```

Default remains disabled so all existing routes behave unchanged.

---

# 18. Programmatic driver and Protocol Check

## 18.1 General programmatic driver

Refactor the reusable part of Goblin-style execution into:

```text
src/protocolCheck/programmaticDriver.ts
```

Do not make Protocol Check depend on React.

Implement:

```ts
resolveProgrammaticStep(definition, state)
performProgrammaticStep(definition, state)
runProgrammaticHappyPath(definition, options)
```

Supported interactions:

- `dragToZone`
- `snapIntoTarget`
- `pourInto`
- `dispenseDrops`
- `rinseTarget`
- `placeInInstrument`
- `readInstrument`
- `recordNotebook`
- `submitCalculation`

The driver must still use:

- `resolveActionInteraction()`;
- `resolveInteractionIntent()`;
- `performRuntimeAction()`.

It must not mark nodes complete directly.

## 18.2 Titration driving

For `dispenseDrops`:

1. use coarse increments while allowed;
2. stop at the fine window;
3. dispense one drop at a time;
4. accept the endpoint only after the endpoint state is reached;
5. proceed to endpoint evidence and calculation.

Use a conservative step limit and return a clear failure if the process does not converge.

## 18.3 Protocol Check cases

Implement the P0 `challenge-core` check set.

### Static/layered checks

1. Lab schema validates.
2. No Studio interaction warnings.
3. All required inventory roles resolved.
4. Model derivation succeeds.
5. Burette capacity sufficient.
6. Flask capacity sufficient.
7. evidence contract complete.
8. fidelity limitations present.

### Isolated happy path

9. Fresh runtime starts at the configured start node.
10. Programmatic driver completes every node.
11. required measurements exist.
12. endpoint evidence exists.
13. final molarity calculation exists and passes tolerance.
14. process completion criteria pass.

### Isolated negative paths

15. wrong source for analyte measurement is rejected;
16. wrong target for analyte transfer is rejected;
17. endpoint acceptance before endpoint is rejected;
18. calculation before required evidence is rejected;
19. a rejected action does not advance the process;
20. reset restores initial state.

## 18.4 Report contract

```ts
export interface ProtocolCheckCaseResult {
  id: string;
  category:
    | "structure"
    | "inventory"
    | "model"
    | "happy-path"
    | "negative-path"
    | "fidelity";
  status: "pass" | "fail" | "limitation";
  summary: string;
  evidence?: Record<string, string | number | boolean>;
}

export interface ProtocolCheckReport {
  id: string;
  target: "staged" | "current";
  status: "pass" | "pass_with_limitations" | "fail";
  createdAt: string;
  cases: ProtocolCheckCaseResult[];
  metrics: {
    passCount: number;
    failCount: number;
    limitationCount: number;
    completedNodeCount: number;
    attemptedRuntimeSteps: number;
  };
}
```

The report must say **Protocol Check**, not “scientifically proven,” “safe,” or “certified.”

---

# 19. UI components

## 19.1 `InventoryProfileEditor`

Display:

- supported equipment with count;
- supported chemicals with quantity/concentration;
- facilities checkboxes;
- source indicator: demo or user;
- validation messages.

Allow manual human edits. WebMCP inventory changes must update the same controls.

## 19.2 `ExperimentComposerPanel`

Sections:

1. WebMCP status.
2. Current inventory summary.
3. Staged experiment summary.
4. validation/fidelity badge.
5. module sequence.
6. assumptions and limitations.
7. protocol report link/summary.
8. fixed Apply/Discard footer.

## 19.3 `StagedExperimentReview`

Display:

- title/objective/audience;
- endpoint variant;
- derived equivalence volume;
- expected final burette reading;
- instrument precision warning;
- module provenance;
- blockers/warnings/limitations;
- current-versus-staged summary.

Do not display raw JSON as the default view.

## 19.4 `ProtocolCheckPanel`

Display a concise checklist:

```text
✓ Schema valid
✓ Inventory satisfied
✓ Burette and flask capacity passed
✓ Happy path completed
✓ Wrong target rejected
✓ Early endpoint acceptance rejected
✓ Premature calculation rejected
△ Graduated-cylinder precision limits physical quantitative fidelity
```

## 19.5 WebMCP status/activity

P1 if necessary, but preferred for demo:

```text
Browser agent tools: connected
Surface: rehearsal
Registered tools: 5
Last action: wrong target rejected
```

Do not expose model/provider identity because WebMCP is agent-agnostic.

---

# 20. Detailed file modifications

## Existing files

### `src/domain/types.ts`

- add optional composer metadata;
- add coarse/fine dispense parameters only through action parameter maps unless a typed request field is useful;
- avoid breaking existing interfaces.

### `src/domain/validation.ts`

- validate optional composer metadata;
- retain backward compatibility;
- do not add broad chemical validation here—keep composer-specific validation in `experimentComposer`.

### `src/runtime/reducer.ts`

- use content-transfer helper for ordinary solution volume moves;
- extend dispense execution for coarse mode;
- retain all existing endpoint and capacity guards.

### `src/player/StudentPlayer.tsx`

- add guided-rehearsal WebMCP mode prop;
- add coarse-dispense handler/UI;
- invoke `usePlayerWebMCPTools`;
- do not register tools in ordinary player or assessment mode.

### `src/player/goblinMode.ts`

- either leave unchanged or reuse the new programmatic driver only if the refactor is low risk;
- do not let this work delay P0.

### `src/studio/TeacherStudio.tsx`

- integrate inventory/staged/rehearsal/protocol state;
- render Composer panel and rehearsal overlay;
- invoke `useStudioWebMCPTools`;
- preserve existing templates, import/export, preview, and assistant behavior.

### `src/styles/app.css`

- add namespaced Composer, staged review, protocol report, WebMCP status, and rehearsal overlay styles;
- target 1440 × 900 first;
- avoid global changes that disturb current routes.

### `src/test/setup.ts`

- install a minimal `document.modelContext` mock only where needed, or expose helper utilities for tests;
- do not make every unrelated test depend on WebMCP.

### `tests/lab-studio.smoke.e2e.ts`

Prefer a new targeted file rather than heavily enlarging the existing smoke test:

```text
tests/webmcp-composer.smoke.e2e.ts
```

### `README.md`

Add:

- Grounded Experiment Composer;
- WebMCP architecture;
- challenge flagship;
- supported versus unsupported claims;
- test instructions;
- browser testing instructions;
- human approval behavior.

## New docs

```text
docs/webmcp-grounded-composer.md
docs/webmcp-tool-contracts.md
docs/scientific-fidelity.md
docs/challenge-demo-script.md
docs/challenge-lineage.md
docs/submission-checklist.md
```

---

# 21. Implementation phases and hard gates

Proceed sequentially. Do not start later phases when the current gate is failing.

## Phase 1 — baseline and domain contracts

Implement:

- types;
- schemas;
- inventory;
- capability catalog;
- persistence;
- default profile.

Gate:

```bash
npm run typecheck
npm test
```

Required tests:

- inventory schema accepts default;
- unknown equipment rejected;
- duplicate normalization;
- malformed localStorage fallback;
- blueprint schema strictness.

## Phase 2 — acid–base family compiler

Implement:

- verified modules;
- family definition;
- blueprint validation;
- compilation;
- fidelity manifest;
- generated metadata.

Gate:

- default blueprint compiles;
- generated lab passes `validateLabDefinition`;
- zero `collectStudioInteractionIssues`;
- endpoint variants work;
- missing pH meter blocks only plus-pH mode;
- insufficient titrant/burette capacity fails clearly;
- fidelity limitations always present.

## Phase 3 — runtime refinements

Implement:

- liquid content conservation;
- coarse/fine dispensing;
- tests.

Gate:

- all existing runtime tests pass;
- current bundled hard-water and titration tests pass;
- coarse mode cannot cross endpoint;
- early endpoint acceptance still fails;
- single-drop mode still works.

## Phase 4 — staged Composer UI

Implement:

- inventory editor;
- staged artifact state;
- review panel;
- human Apply/Discard;
- staleness behavior.

Gate:

- staging never changes current draft;
- Apply requires human click;
- invalid/stale stage cannot be applied;
- existing Studio editing/import/export still works;
- no layout overflow at target desktop sizes.

## Phase 5 — Studio WebMCP tools

Implement:

- model-context typings;
- result envelope;
- schemas;
- registration hook;
- Studio adapter;
- dynamic Studio/staged-review registration.

Gate:

- no crash without WebMCP;
- tools register once per surface;
- abort on unmount/mode switch;
- invalid tool input rejected by AJV;
- stage tool opens UI after committed state;
- no apply/commit tool exists.

## Phase 6 — guided rehearsal WebMCP tools

Implement:

- rehearsal overlay;
- Player adapter;
- dynamic current-step tools;
- coarse/drop/accept tools;
- read-only state inspection.

Gate:

- all successful actions pass through interaction resolver;
- wrong source/target produces normal runtime feedback;
- tools unavailable in assessment mode;
- closing overlay aborts all Player registrations and restores Studio tools.

## Phase 7 — Protocol Check

Implement:

- programmatic driver;
- happy path;
- negative checks;
- report UI;
- `run_protocol_check`.

Gate:

- isolated run does not mutate actual draft or rehearsal;
- all challenge-core checks pass on the default composed titration;
- deliberate broken fixture produces a failed report;
- report retains limitations.

## Phase 8 — challenge polish and docs

Implement:

- status/activity presentation;
- README;
- demo script;
- lineage/fidelity docs;
- targeted e2e.

Final gate:

```bash
npm run typecheck
npm test
npm run build
npx playwright test tests/webmcp-composer.smoke.e2e.ts
```

Then manually test in:

- ChatGPT in-app browser;
- Chromium with WebMCP testing enabled;
- normal browser without WebMCP.

---

# 22. Test matrix

## 22.1 Blueprint and inventory unit tests

1. default inventory valid;
2. missing burette rejected;
3. missing indicator rejected;
4. no pH meter plus-PH rejected with recoverable recommendation;
5. no pH meter indicator-only accepted;
6. insufficient acid quantity rejected;
7. insufficient titrant quantity rejected;
8. endpoint volume exceeding burette capacity rejected;
9. total receiving volume exceeding flask capacity rejected;
10. physical mirror missing safety facility blocked;
11. virtual-only missing facility returns limitation rather than false approval;
12. strict schema rejects extra fields;
13. unsupported family cannot be staged.

## 22.2 Compiler tests

1. deterministic IDs;
2. deterministic module ordering;
3. correct initial material moles;
4. correct titration model;
5. aliquot parameter propagated to labels, action parameters, and model;
6. titrant molarity propagated;
7. endpoint variant selects correct module;
8. generated lab validates;
9. no interaction warnings;
10. required assessment evidence present;
11. provenance metadata present;
12. fidelity manifest contains mandatory limitations.

## 22.3 Runtime tests

1. solution transfer conserves volume and solute amount;
2. source decremented;
3. target receives proportional solute;
4. coarse dispense respects requested volume;
5. coarse dispense caps at fine window;
6. coarse dispense does not cross endpoint;
7. drop dispense reaches endpoint;
8. early accept rejected;
9. extra drops still constrained;
10. reset clears records.

## 22.4 WebMCP registration tests

Mock:

```ts
document.modelContext = {
  registerTool: vi.fn(async (...) => ...)
}
```

Test:

1. no registration without support;
2. correct Studio tools registered;
3. registration signal aborted on unmount;
4. mode switch aborts old tools;
5. adapter closures use latest state via refs;
6. read-only annotations correct;
7. untrusted-content annotations correct;
8. mutation resolves after UI commit;
9. malformed input returns structured error;
10. duplicate registration failure is nonfatal and visible.

## 22.5 Tool-adapter tests

Execute registered tool callbacks directly.

Journey:

1. inspect capabilities;
2. set inventory without pH meter;
3. validate indicator-only blueprint;
4. stage blueprint;
5. verify current draft unchanged;
6. inspect stage;
7. simulate human Apply;
8. inspect current experiment;
9. start rehearsal;
10. wrong-target attempt rejected;
11. execute current-step tools;
12. finish calculation;
13. inspect result;
14. run Protocol Check.

## 22.6 React tests

- inventory edits visible;
- WebMCP inventory update uses same controls;
- staged review renders;
- Apply/Discard behavior;
- stale stage disabled;
- rehearsal overlay lifecycle;
- protocol report checklist;
- existing Studio assistant still opens;
- existing preview still renders.

## 22.7 Targeted Playwright smoke

Use `page.addInitScript()` to install a browser mock that captures registered tools.

Test one full browser journey:

1. open `#/studio`;
2. find registered capability tool;
3. invoke inventory tool;
4. invoke stage tool;
5. assert staged review appears;
6. assert draft title has not changed;
7. click human Apply;
8. open rehearsal through tool;
9. invoke wrong-target interaction;
10. assert recovery feedback visible;
11. close rehearsal;
12. run protocol check;
13. assert report passes with limitations.

Add a second small test confirming Studio still works with no `document.modelContext`.

Do not build a large browser-agent emulator.

---

# 23. Security, trust, and fidelity requirements

## 23.1 Input security

- AJV validation for all tool inputs;
- `additionalProperties: false`;
- bounded arrays and strings;
- finite-number checks;
- no raw JSON patches;
- no arbitrary URLs;
- no file paths;
- no HTML;
- no executable expressions.

## 23.2 Human control

- stage is reversible;
- apply is human-only;
- save/export retain existing confirmations/controls;
- assessment mode exposes no action-completion tools.

## 23.3 Prompt-injection containment

Tool results containing user/agent-authored strings should use `untrustedContentHint`.

Do not interpret objective, title, assumptions, or inventory labels as instructions inside Lab Studio.

## 23.4 Scientific claims

Use these labels:

- “Modeled and executable”
- “Procedurally executable”
- “Design only”
- “Unsupported”
- “Protocol Check”
- “Local review required”

Do not use:

- “scientifically proven”
- “validated safe”
- “certified”
- “compliant”
- “approved for physical execution”

## 23.5 Safety

Generated safety notes are training prompts, not a substitute for:

- SDS review;
- site SOP;
- chemical hygiene plan;
- qualified instructor/supervisor review;
- institution-specific waste procedures.

Include this in both UI and documentation.

## 23.6 Privacy and secrets

- no API keys;
- no backend;
- no network upload of inventory or draft;
- local/session storage only;
- no model identity assumptions.

---

# 24. Acceptance criteria

The feature is complete only when all criteria below are true.

## WebMCP

- `document.modelContext.registerTool()` is used through a small isolated adapter.
- registration uses `AbortController.signal`.
- tools unregister on surface change/unmount by aborting the signal.
- execution cancellation is handled.
- app works without WebMCP.
- tools are dynamically scoped to Studio versus rehearsal.
- input schemas are strict.
- read-only/untrusted annotations are used accurately.
- no commit/apply tool exists.

## Composer

- agent can inspect supported capabilities;
- agent can set a visible supported inventory;
- agent can validate and stage a blueprint;
- staging does not alter current draft;
- human can apply or discard;
- generated lab derives from versioned modules;
- generated lab passes existing schema/interaction validation;
- fidelity manifest is visible.

## Science/runtime

- acid–base model is parameterized;
- endpoint and calculation derive from one model;
- inventory quantity/capacity checks work;
- ordinary solution transfer conserves content;
- coarse/fine titration is usable;
- no arbitrary chemistry claim;
- synthetic ground truth is clearly labeled;
- limitations are preserved.

## Rehearsal

- browser agent can perform current interactions;
- normal runtime rejects wrong source/target;
- agent cannot bypass evidence or calculation prerequisites;
- assessment mode does not expose completion tools;
- human sees the same state changes and feedback.

## Protocol Check

- isolated happy path completes;
- required negative paths are tested;
- actual draft/rehearsal remains unchanged;
- report distinguishes pass, fail, and limitation;
- no certification language.

## Regression

- existing typecheck passes;
- existing unit tests pass;
- build passes;
- current lab/technique routes remain functional;
- GitHub Pages static deployment remains functional;
- target desktop/tablet layouts have no destructive overflow.

---

# 25. Challenge demo script to implement toward

Target a concise demo that can be recorded without hidden setup.

## Scene 1 — request and capability inspection

User asks for a high-school synthetic acid titration using listed inventory and explicitly says there is no pH meter.

Agent calls capability and inventory tools.

Visible result:

```text
Supported family: Acid–base titration
Endpoint variants: indicator; indicator + pH
Current inventory: pH meter unavailable
```

## Scene 2 — inventory-aware composition

Agent sets inventory and stages indicator-only blueprint.

Visible staged panel:

```text
Modeled and executable
9 verified modules
Inventory satisfied
Synthetic virtual unknown
Physical precision limitation: graduated cylinder
Local safety review required
```

## Scene 3 — human control

Human clicks Apply, then makes a small visible manual refinement in the existing Studio—such as changing the title, objective wording, hint, or recovery feedback. The agent re-inspects or protocol-checks the live draft and observes the human edit.

Do not demonstrate a manual aliquot/model change unless the staged-blueprint editor has been implemented to recompile all dependent model parameters.

Emphasize that the agent staged the lab, but the human applied and refined it.

## Scene 4 — shared rehearsal

Agent opens guided rehearsal.

It first attempts one wrong target. Normal Student Player feedback rejects it.

Then it proceeds:

- measure;
- transfer;
- add indicator;
- record initial reading;
- coarse dispense;
- single drops;
- accept endpoint;
- record evidence;
- calculate.

Keep visible equipment and process progress on screen.

## Scene 5 — Protocol Check

Agent runs challenge-core Protocol Check.

End screen:

```text
Protocol Check: PASS WITH LIMITATIONS

✓ Schema and interactions
✓ Inventory and capacity
✓ Happy path
✓ Wrong target rejection
✓ Early endpoint rejection
✓ Premature calculation rejection
✓ Final molarity evidence
△ Training-grade aliquot precision
△ Simplified endpoint model
```

Closing message:

> Lab Studio does not let the agent invent chemistry. It lets the agent compile a user’s goal and real inventory into the best executable experiment the application can substantiate, then rehearse and verify that declared behavior with the human in control.

---

# 26. Documentation deliverables

## `docs/webmcp-grounded-composer.md`

Explain:

- product concept;
- client-side architecture;
- why WebMCP is necessary;
- shared live state;
- dynamic tool registration;
- human-only apply.

## `docs/webmcp-tool-contracts.md`

Document each tool:

- purpose;
- input;
- output;
- annotations;
- surface mode;
- mutation behavior;
- failure codes.

## `docs/scientific-fidelity.md`

Document:

- exact acid–base model;
- supported claims;
- inventory checks;
- assumptions;
- limitations;
- why it is not a general chemistry engine;
- why Protocol Check is not scientific certification.

## `docs/challenge-demo-script.md`

Provide exact user prompt, expected tool sequence, UI states, and fallback if the live agent chooses a different valid tool order.

## `docs/challenge-lineage.md`

Clearly distinguish:

- pre-existing Lab Studio architecture;
- WebMCP/composer/protocol additions;
- files added or materially changed for the challenge.

## `docs/submission-checklist.md`

Include:

- live deployment;
- source;
- license;
- README;
- demo video;
- tested browser;
- challenge deadline;
- final commit SHA;
- known limitations.

---

# 27. Suggested commit sequence

1. `feat(composer): add inventory and blueprint contracts`
2. `feat(composer): compile verified acid-base experiment family`
3. `fix(runtime): conserve solution contents during measured transfer`
4. `feat(runtime): add coarse and fine titrant dispensing`
5. `feat(studio): add staged experiment review and inventory panel`
6. `feat(webmcp): register dynamic Studio composer tools`
7. `feat(player): add WebMCP guided rehearsal tools`
8. `feat(protocol): add deterministic protocol check`
9. `test(webmcp): cover grounded composer agent journey`
10. `docs: add WebMCP challenge architecture and demo`

A different grouping is acceptable if commits remain reviewable.

---

# 28. Stop conditions and conservative decisions

Do not stop for minor ambiguity. Use these defaults:

- family: acid-base titration;
- context: virtual-only unless the user explicitly requests physical mirroring;
- endpoint: indicator-only if pH meter absent;
- model: synthetic monoprotic acid and standardized NaOH;
- stoichiometry: 1:1 unless blueprint explicitly supplies another positive ratio;
- guided mode for WebMCP rehearsal;
- no automated Apply;
- no new backend;
- no general chemical safety claims.

Stop and report a blocker only when:

- the current branch does not build before edits;
- WebMCP API shape has materially changed from the August 26, 2026 draft and cannot be isolated;
- existing runtime behavior makes the flagship impossible without a broad rewrite;
- tests reveal a conflict that would corrupt existing published labs.

Otherwise implement the conservative bounded version and document limitations.

---

# 29. Codex final delivery report

At completion, return:

## Implemented

- concise feature list;
- exact source files added/changed;
- tool names registered;
- challenge journey supported.

## Verification

```text
npm run typecheck: PASS/FAIL
npm test: PASS/FAIL, count
npm run build: PASS/FAIL
targeted Playwright: PASS/FAIL
manual ChatGPT browser test: PASS/NOT RUN
manual Chromium WebMCP test: PASS/NOT RUN
```

## Fidelity

- supported experiment family;
- scientific model;
- inventory constraints;
- known limitations;
- any behavior intentionally deferred.

## WebMCP

- registration lifecycle;
- dynamic surface behavior;
- annotations;
- no-WebMCP fallback;
- human-only apply confirmation.

## Deployment

- branch;
- final commit SHA;
- GitHub Pages result;
- any remaining submission action.

Do not conclude with a generic “looks good.” List concrete evidence and any residual risk.

---

# 30. Reference baseline to verify before coding

Codex should verify the current versions of:

- WebMCP Draft Community Group Report, dated August 26, 2026;
- Chrome WebMCP imperative API and best-practice guidance;
- OpenAI WebMCP Challenge page and submission requirements.

Implementation assumptions from the current draft:

- primary API: `document.modelContext.registerTool()`;
- registration cleanup: `AbortSignal`;
- execution cancellation: callback `AbortSignal`;
- current annotations: `readOnlyHint` and `untrustedContentHint`;
- WebMCP is browser/client-side and does not provide backend MCP resources or prompts;
- the app must remain functional when the experimental API is absent.

If the draft changes, update only the isolated `src/webmcp` adapter and this documentation unless a broader change is strictly required.
