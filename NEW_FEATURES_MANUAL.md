# Lab Studio Cycles 1–16 Feature Access and Evaluation Manual

This manual explains how to find and evaluate the additive capabilities delivered in Cycles 1–16. It does not change their release status.

Completing Cycle 16 means that the planned implementation sequence is complete. It does **not** mean that every candidate is enabled or approved for production use. All eight extension flags remain `false` by default.

## Release and access status

| Surface | Status | How it is accessed |
|---|---|---|
| Existing Lab Studio chemistry runtime | Existing compatible chemistry runtime | Start the application normally; no new feature flag is required |
| Studio Core contracts, manifests, evidence, adapters, and conformance code | Internal/developer capability | Source modules, generated capability manifest, direct TypeScript services, and static checks |
| Chemistry planning and MCP | Internal/developer capability | Direct services or the separately built MCP server |
| Assay Studio | Limited Assay Studio release candidate, default off | Local browser evaluation with `VITE_ASSAY_STUDIO_V1=true`, or assay MCP tools |
| Causalyst local mode | Limited local candidate, default off | Local browser evaluation with `VITE_CAUSALYST_LOCAL_V1=true` |
| Causalyst prompt assistance | Optional local candidate, default off | Causalyst local mode, the assistant server, and `VITE_CAUSALYST_PROMPT_BUILD_V1=true` |
| LTI 1.3 and Deep Linking | Institutional implementation candidate, default off | A configured Learning Integration Service and a valid launch from a named LMS |
| AGS score return | Disabled for release | Only after named-platform validation, explicit teacher approval, and all server/assignment gates |
| QTI 2.2 companion export | Disabled pending interoperability validation | Developer inspection behind `VITE_CAUSALYST_QTI_EXPORT_V1=true` |
| QTI 3.0 companion export | Not implemented | No flag, serializer, or access path exists |

## Start the application with local candidates

From File Explorer, double-click:

```text
launch-lab-studio.bat
```

The launcher enables the two locally inspectable candidates:

- `VITE_ASSAY_STUDIO_V1=true`
- `VITE_CAUSALYST_LOCAL_V1=true`

It then starts Vite at `http://127.0.0.1:5175` and opens the application in the default browser. If a server is already responding on that address, the launcher reuses it only when both local flags are already active. Otherwise it asks you to close the stale **Lab Studio Dev Server** window and run the launcher again.

QTI, prompt assistance, LTI, and AGS remain off.

Feature flags are read when Vite starts. Query parameters and browser storage cannot enable them.

## Evaluate Assay Studio and Causalyst locally

These two candidates can be inspected locally without enabling QTI, LTI, AGS, or model-assisted authoring. The root launcher now performs this setup automatically.

To start them manually instead:

1. Stop any existing Lab Studio Vite server.
2. Open PowerShell in the repository root.
3. Run:

```powershell
$env:VITE_ASSAY_STUDIO_V1 = "true"
$env:VITE_CAUSALYST_LOCAL_V1 = "true"
.\launch-lab-studio.bat
```

The child command window inherits these environment values. They apply only to processes started from that PowerShell session; the source-controlled application defaults remain off.

The recommended command intentionally omits:

- `VITE_STUDIO_CORE_V1`, because Studio Core does not add an independent navigation surface.
- `VITE_ASSAY_IMAGE_IMPORT_V1`, because it does not currently add an independent production route. The reviewed observation-ingestion surface is reached through Assay Studio.

### Verified entry routes

| Feature | Navigation | Direct entry route |
|---|---|---|
| Assay library | **Assays** | `http://127.0.0.1:5175/#/assays` |
| Assay Studio workspace | **Assay Studio** | `http://127.0.0.1:5175/#/assay-studio` |
| Causalyst library | **Causalyst** | `http://127.0.0.1:5175/#/causalyst` |
| New Causalyst assessment | Causalyst authoring action | `http://127.0.0.1:5175/#/causalyst-author` |

Other routes contain saved object identifiers:

- `#/assay/{assayId}`
- `#/assay-results/{assayId}`
- `#/causalyst-author/{assessmentId}`
- `#/causalyst-preview/{assessmentId}`
- `#/causalyst-attempt/{assessmentId}`
- `#/causalyst-review/{submissionId}`

Use the normal buttons and links in the application to reach these routes. Do not invent an ID: an unknown ID can return a missing-record state or fall back to the home route.

## Assay Studio walkthrough

### Open or create an assay

1. Select **Assays**.
2. Choose a starting template, import a valid `.assay.json` file, or open a saved/session assay.
3. Select **Open plate map** for an existing assay.

The Assay Studio workspace exposes the plate editor and the cycle-added workflow surfaces. Depending on the selected assay and stage, these include:

- an accessible 96-well grid and table representation;
- deterministic single-channel and 8-channel pipetting;
- serial-dilution operations and exact formula traces;
- control and replicate assignments;
- QC evaluation, evidence, and text/table parity;
- material, tip, reagent, batch, capacity, and schedule planning;
- reviewed observation ingestion;
- XTT and educational/research inhibition profiles;
- validation, release review, and export.

Use **Export .assay.json** to download the current assay definition. Use the results action created by the normal workflow rather than constructing an `assay-results` URL manually.

### Import observations

The **Import observations** surface supports:

- explicit long-form or matrix CSV mapping;
- direct manual scalar entry;
- a transient local image preview for manual extraction;
- export of a versioned Assay Lens request file;
- import of a reviewed Assay Lens result file.

Every external observation remains a review candidate until it is explicitly accepted or corrected and committed. Assay Studio does not guess columns, units, channels, decimal separators, or image values.

The local image preview performs no computer vision. Image pixels, file paths, EXIF data, hashes, and provider handles are not added to the assay artifact. The Assay Lens bridge is file-based; its network transport is disabled.

### Scientific interpretation

- XTT is a protocol-dependent metabolic-activity proxy. It is not a direct cell count.
- MIC/inhibition output is bound to an explicit profile and is educational/research-oriented, not clinical.
- Do not infer wavelength, incubation, endpoint, organism, compound, threshold, breakpoint, susceptibility category, calibration, or treatment meaning when the selected profile does not author it.

## Causalyst local walkthrough

### Author and preview an assessment

1. Select **Causalyst**, then open the assessment authoring workflow.
2. Choose the registered chemistry or assay domain pack and its version-pinned executable artifact.
3. Review the allowed capabilities, required fidelity, locked parameters, evidence selectors, explanation prompts, and rubric.
4. Select **Save local assessment** to place it in the local assessment library.
5. Select **Show learner preview** to inspect the learner-facing structure.
6. Use **Export assessment** for deterministic assessment JSON or **Export portable package** for the portable assessment package.

The authoring workflow does not invent domain semantics. It references registered domain packs, validated artifacts, capability contracts, and pinned evidence versions.

### Complete a local learner attempt

1. Open a saved assessment from the Causalyst library.
2. Follow the assessment's teacher-selected authoring mode.
3. Review and validate the executable candidate before opening the pinned simulation.
4. Complete the simulation through its normal pointer, keyboard, or accessible controls.
5. Confirm the run and provide the required explanations.
6. Select **Validate and export local submission**.

The downloaded `.causalyst-submission-package.json` is designed to be identity-free and portable. It contains version pins, semantic evidence and traces, learner responses, and integrity information—not a final grade.

### Review a submission as a teacher

1. Enter teacher review through the Causalyst workflow.
2. Under **Import submission**, select a validated Causalyst submission package.
3. Inspect the artifact pins, evidence, semantic event replay, explanations, integrity result, and provisional rubric mapping.

Local teacher review does not return a score to an LMS. Provisional rubric mapping is not an automatic or model-final grade.

## QTI 2.2 companion inspection

> **Release boundary:** QTI 2.2 is an implementation candidate that remains disabled pending external interoperability validation. Do not enable it for routine or production use based on the internal structural checks alone.

### Expose the authoring action for developer inspection

1. Stop the existing Vite server.
2. In PowerShell, enable Causalyst local mode and the QTI inspection flag:

```powershell
$env:VITE_CAUSALYST_LOCAL_V1 = "true"
$env:VITE_CAUSALYST_QTI_EXPORT_V1 = "true"
.\launch-lab-studio.bat
```

3. Open **Causalyst** and create or open a valid assessment.
4. In the authoring page, select **Export QTI 2.2 companion**.
5. Open the downloaded `.qti22-companion.zip`.
6. Read `package-report.json` before attempting any external evaluation.

### How the questions and package are generated

The final QTI package is generated by deterministic conversion code, not by an LLM:

1. The authoring UI starts from the validated, version-pinned Causalyst assessment.
2. If the assessment requires a prediction before the run, the converter creates one required extended-text **Prediction** item.
3. Each authored explanation prompt becomes an extended-text **Explanation** item. Its required state and evidence-selector references come from the assessment.
4. The companion model is validated.
5. Deterministic serializers create QTI item XML, `assessment.xml`, and `imsmanifest.xml`.
6. Security checks reject unsafe XML, active content, unsafe URLs and paths, missing assets, and other invalid companion data.
7. The package builder adds `package-report.json` and writes the ZIP.

The broader `causalyst.qti-companion-model` `1.0` contract supports:

- single choice;
- multiple response;
- numeric response with exact authored tolerance;
- extended text;
- accessible static PNG and JPEG assets.

The current **Export QTI 2.2 companion** button does not use an LLM to synthesize those additional question forms. Its default derivation produces prediction and explanation extended-text items from existing assessment fields.

The generated timestamp is an explicit package input. Deterministic claims mean that identical validated inputs—including that timestamp—produce identical package bytes.

### What the QTI package does not contain

The ZIP does not embed or replay:

- the Lab Studio or Assay Studio executable simulation;
- the Causalyst evidence bundle or semantic trace;
- run replay;
- teacher review;
- learner identity;
- the AGS score-return workflow.

The internal package report records structural checks, but it is not QTI XSD validation or proof of LMS compatibility. Before any release decision changes, the package must be validated against the applicable QTI 2.2 XSD/profile, imported and rendered in a named target LMS, and checked by an independent validator/test platform.

## Chemistry and Assay MCP

The MCP server is a separate, tools-first service. It is stateless and has no database, draft store, assignment API, student identity, purchasing action, arbitrary URL fetcher, or student-data persistence.

### Build and start HTTP transport

```powershell
npm run mcp:build
npm run mcp:start
```

The default Streamable HTTP endpoint is:

```text
POST http://127.0.0.1:8787/mcp
```

To select another port before starting the built server:

```powershell
$env:LAB_STUDIO_MCP_PORT = "8788"
npm run mcp:start
```

`LAB_STUDIO_MCP_ALLOWED_ORIGINS` can contain a comma-separated exact origin allowlist. Server-to-server clients without an `Origin` header and localhost origins are accepted by default.

### Start stdio transport

Build first, then run:

```powershell
npm run mcp:stdio
```

### Registered chemistry tools

- `labstudio.search_capabilities`
- `labstudio.assess_procedure`
- `labstudio.compose_draft`
- `labstudio.validate_artifact`
- `labstudio.plan_class_run`

### Registered assay tools

- `assaystudio.search_capabilities`
- `assaystudio.assess_protocol`
- `assaystudio.compose_assay`
- `assaystudio.validate_assay`
- `assaystudio.plan_run`
- `assaystudio.ingest_observations`

MCP composition is bounded by registered domain services. Observation ingestion returns an uncommitted review candidate. MCP output excludes credentials, student data, local paths, hashes, vendor handles, raw provider responses, hidden reasoning, and runtime-only state.

## Optional prompt-assisted Causalyst authoring

Prompt assistance is optional. Structured manual authoring remains available independently of model access.

The assistant process requires a server-only `OPENAI_API_KEY` configured through an approved secure environment process. Never put that key in a `VITE_` variable, browser storage, an artifact, or source control.

1. Configure the server-only credential.
2. Start the assistant server in one PowerShell window:

```powershell
npm run assistant:server
```

3. Stop any existing Vite server.
4. In a second PowerShell window, enable local Causalyst and prompt assistance:

```powershell
$env:VITE_CAUSALYST_LOCAL_V1 = "true"
$env:VITE_CAUSALYST_PROMPT_BUILD_V1 = "true"
.\launch-lab-studio.bat
```

The assistant server defaults to port `8787`, the same default as MCP. To run both simultaneously, leave the assistant on `8787` and start MCP on another port, for example:

```powershell
$env:LAB_STUDIO_MCP_PORT = "8788"
npm run mcp:start
```

A prompt-produced ProcedureIR is untrusted candidate data. It cannot become an executable artifact until deterministic domain resolution, compilation, validation, learner review, and the assessment's version-pinned evidence contracts all succeed. The model does not author raw executable artifacts or final grades.

## LTI 1.3 and Deep Linking

> **Release boundary:** LTI is a default-off institutional implementation candidate. These are administrator prerequisites for an authorized named-platform validation, not a general local quick start.

The Learning Integration Service is a separate, stateful boundary under `server/learning/`. It does not share storage with MCP.

An administrator must:

1. Apply `server/learning/migrations/001_learning_integration.sql` using a migration identity.
2. Mirror each reviewed static registration and deployment into the administrative metadata tables.
3. Create a restricted runtime configuration based on `server/learning/config/learning.example.json`.
4. Keep the private signing key and pseudonym secret outside source control.
5. Set:

```text
CAUSALYST_DATABASE_URL
CAUSALYST_LEARNING_CONFIG
```

Optional service settings are:

```text
CAUSALYST_LEARNING_PORT
CAUSALYST_DATABASE_POOL_SIZE
CAUSALYST_DATABASE_SSL
```

The Learning Integration Service defaults to port `8791`.

6. Enable `causalystLtiV1` only in the reviewed server configuration and enable only the matching static platform registration/deployment.
7. Build and start the service:

```powershell
npm run learning:build
npm run learning:start
```

8. Build/start the browser with `VITE_CAUSALYST_LTI_V1=true` only for the same authorized validation environment.
9. Initiate the launch from the configured LMS.

The LMS launch supplies a one-time URL-fragment code. The browser exchanges it for a short-lived session and removes the code from the URL. Opening `#/causalyst-lti` directly is not a standalone login or test path; without a fresh LMS launch it reports that the launch is missing or already exchanged.

Registrations are static and administrator-controlled. Identity is pseudonymous and scoped by issuer, deployment, and LTI subject. Name, email, roster, accommodations, and unrelated LMS claims are neither requested nor stored.

## AGS score return

> **Release boundary:** AGS is disabled for release.

The source declares `VITE_CAUSALYST_AGS_V1`, but it does not provide an independent route or by itself authorize score return. The enforceable gates are in the Learning Integration Service and the deployment-scoped assignment:

- server configuration `causalystAgsV1` must be enabled after named-platform validation;
- the static platform registration must allow the required service and scopes;
- the assignment must be gradable and explicitly AGS-enabled;
- the LMS must provide a valid line item;
- an authorized teacher must review the submission and create a separate approval record;
- the return must use a stable idempotency key;
- issuer, client, deployment, assignment, and authorization scope must all match.

Only after those gates does the instructor UI expose **Return approved score to LMS**. Recording **Record explicit teacher approval** does not itself send a score. No model-authored, provisional, or automatic score may be returned.

## Cycle-by-cycle access guide

| Cycle | Delivered capability | Access surface | Required flag or service | Release limitation |
|---:|---|---|---|---|
| 01 | Compatibility baseline and eight extension guardrails | Internal source and architecture records | None | No new browser behavior |
| 02 | ProcedureIR, process graph, and domain-pack contracts | Internal TypeScript contracts | None | Candidate data is not executable |
| 03 | Capability Manifest v2, fidelity ladder, and evidence registry | `public/capabilities/v2/manifest.json` and internal services | None | Claims remain proof- and fidelity-bound |
| 04 | Chemistry domain-pack adapter and conformance boundary | Direct services and existing chemistry runtime | None | Existing chemistry behavior remains canonical |
| 05 | Exact-decimal planning, artifact packaging, and chemistry MCP | Direct services or five `labstudio.*` tools | Built MCP server for tool access | Stateless; metadata gaps produce incomplete diagnostics |
| 06 | Assay schema, canonical 96-well state, and UI foundation | Assays and Assay Studio | `VITE_ASSAY_STUDIO_V1=true` | Default off |
| 07 | Pipetting and serial-dilution runtime | Assay Studio plate workflow | Assay Studio flag | Deterministic, authored operations only |
| 08 | Controls, replicates, QC, and assay evidence | Assignment, QC, charts/tables, evidence | Assay Studio flag | Thresholds must come from explicit profiles |
| 09 | Materials, capacity, batches, and run planning | Assay planning surface and exports | Assay Studio flag or assay MCP | Planning only; no purchasing |
| 10 | CSV mapping, manual entry, image review, and Assay Lens file exchange | Import observations | Assay Studio flag | No built-in vision or network bridge |
| 11 | XTT and MIC/inhibition profiles | Protocol analysis and results | Assay Studio flag | Metabolic proxy; profile-bound and non-clinical |
| 12 | Integrated Assay Studio candidate and assay MCP | Browser plus six `assaystudio.*` tools | Assay flag or built MCP server | Limited candidate; default off |
| 13 | Assessment, evidence-selector, and rubric authoring | Causalyst author and preview | `VITE_CAUSALYST_LOCAL_V1=true` | Limited local candidate |
| 14 | Optional prompt candidates, attempts, traces, replay, submissions, and teacher review | Causalyst local workflow | Local flag; prompt flag/server only when wanted | Identity-free portable packages; no final automatic score |
| 15 | LTI, Deep Linking, governed persistence, and approved-AGS contracts | Named-LMS launch and Learning Integration Service | Static admin config, database, service and browser flags | LTI candidate; AGS disabled |
| 16 | QTI 2.2 companion, integrated static evaluation, and release decisions | Causalyst author inspection and evaluation reports | Local flag plus QTI flag | QTI disabled pending interoperability validation |

## Data, privacy, and authorization boundaries

Portable artifacts, traces, submissions, and QTI packages must not contain:

- credentials, private keys, API keys, or raw tokens;
- raw student identity;
- local file paths or hashes;
- provider file identifiers or raw provider responses;
- hidden model reasoning;
- pointer coordinates or unrelated browser events;
- camera frames, gesture landmarks, or gesture data.

MCP remains stateless and student-data-free. The Learning Integration Service is the only stateful LMS boundary, and its records remain pseudonymous and deployment-scoped.

## Features not implemented or not authorized

Cycles 1–16 do not add:

- QTI 3.0 serialization;
- embedded or custom-interaction QTI simulations;
- NRPS or roster dependency;
- dynamic LTI registration;
- name/email identity storage;
- automatic or model-final scoring;
- score return before explicit teacher approval;
- universal LMS compatibility;
- clinical interpretation or susceptibility categories;
- calibrated wet-lab equivalence;
- autonomous purchasing or hardware control.

## Troubleshooting

### Assay or Causalyst navigation is missing

The relevant flag was not present when Vite started. Stop the existing dev-server window, set the flag in PowerShell, and run the launcher again. Reloading the browser or adding a query parameter is insufficient.

### The launcher opens an old feature configuration

The launcher now checks the served Vite environment before reusing port `5175`. If it reports a stale configuration, close the existing **Lab Studio Dev Server** window and run the launcher again.

### Port 5175 is already in use

The `dev` script uses strict port `5175` and will not silently choose another port. Close the process already using it, or deliberately start Vite with a reviewed alternative command and use the matching URL.

### MCP and the assistant cannot start together

Both default to `8787`. Set `LAB_STUDIO_MCP_PORT=8788` before `npm run mcp:start`, or assign the assistant a deliberate alternative with `LAB_STUDIO_ASSISTANT_PORT`.

### Prompt authoring reports missing credentials

The assistant process does not have a server-only `OPENAI_API_KEY`. Configure it securely in the assistant server's environment and restart that process. Do not expose it through Vite or the browser.

### A parameterized route cannot find its record

Return to the Assay or Causalyst library and open the record through the normal UI. IDs are created or saved by the application; they are not example placeholders to type literally.

### Direct Causalyst LTI access fails

This is expected without a fresh LMS launch. `#/causalyst-lti` consumes a one-time launch code issued through the configured LTI flow. Relaunch from the named LMS.

### A QTI ZIP does not import into an LMS

No named LMS import or external QTI XSD/profile validation has been claimed. Keep the feature disabled, preserve the ZIP and `package-report.json`, and evaluate it against the named platform and independent validator before changing the release decision.

## Validation record for this manual

This manual was cross-checked against current feature flags, routes, package scripts, UI labels, MCP documentation, Learning Integration Service documentation, QTI source, and the Cycle 16 handoff and release decisions.

It does not claim that the following were run for this documentation change:

- Vitest or any detailed test suite;
- an application build;
- browser, accessibility-runtime, or mobile QA;
- live MCP, assistant, PostgreSQL, LTI, Deep Linking, or AGS flows;
- QTI XSD/profile validation;
- named-LMS import or rendering;
- an independent QTI validator.

Those omitted checks are not passes.
