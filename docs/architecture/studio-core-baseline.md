# Studio Core Compatibility Baseline

**Baseline date:** 2026-07-18  
**Cycle:** Refined Plan Continuation Cycle 01  
**Branch:** `codex/project-relay`  
**Machine-readable inventory:** `src/test/fixtures/compatibility-baseline.v1.json`

## Compatibility boundary

This baseline freezes the chemistry application before Studio Core extraction. It is internal characterization evidence, not a new public artifact API. Existing chemistry JSON, hash routes, Student Player behavior, Studio transactions, assistant actions, persistence keys, sanitization, and export filenames remain authoritative.

No previous refined cycle implementation was present when this inventory was captured. No `src/platform/` implementation, domain-pack adapter, assay runtime, Causalyst product, or MCP server existed. Cycle 01 adds only default-off flags, characterization evidence, and this inventory.

## Authoritative sources

- Routes and default navigation: `src/routes.ts`, `src/App.tsx`.
- Chemistry artifact types and unions: `src/domain/types.ts`.
- Artifact and public-JSON validation: `src/domain/validation.ts`.
- Bundled loaders and indexes: `src/data/loadBundledLabs.ts`, `src/data/loadBundledTechniques.ts`, `public/labs/index.json`, `public/techniques/index.json`.
- Runtime initialization: `src/runtime/createRuntime.ts`.
- Equipment and visuals: `src/equipment/catalog.ts`, `src/equipment/visualCatalog.ts`.
- Assistant actions: `src/assistant/actionCatalog.json`.
- Studio import/export and sanitization: `src/studio/importExport.ts`, `src/studio/runtimeOnlyFields.ts`, `src/studio/studioArtifact.ts`.
- Browser persistence: `src/studio/persistence.ts`, `src/studio/TeacherStudio.tsx`, `src/assistant/client.ts`, `src/player/gesture/gestureMath.ts`.

## Frozen inventory

- Eight route shapes: home, Studio, labs, techniques, play, technique, case, and trial. Unknown assay/Causalyst hashes still resolve to home.
- Two chemistry artifact shapes: `LabDefinition` and `TechniqueDefinition`. They have no top-level `schema` discriminator. Import attempts Lab validation first, then Technique validation; the structural markers are `audience` and `learningGoal` respectively.
- Nineteen action verbs, eleven interaction types, and seven validation types.
- Sixty-three equipment definitions and sixty-three matching visual profiles.
- Six public labs and twenty-one public techniques, all indexed by explicit ID/file pairs.
- Twenty Studio assistant actions.
- Six browser persistence keys. Feature flags are not persisted and do not read query parameters.
- Lab exports use `.lab.json`; technique exports use `.technique.json`. Both use two-space JSON indentation, no trailing newline, and `application/json` downloads.
- The public validator and exporter share the same fourteen runtime-only/provider key names. Export preserves ordinary authored values while removing those keys recursively.

The exact ordered values are checked in `compatibility-baseline.v1.json` and drift-tested by `src/test/compatibilityBaseline.test.ts`.

## Representative runtime initialization

The characterization suite loads every indexed artifact through the same async loaders used by application routes and initializes runtime state for every definition. The release-required representative set explicitly includes:

- titration: `acid-base-titration`;
- chromatography: `ap-chem-investigation-5-chromatography`;
- kinetics: `marble-statue-kinetics`;
- equilibrium: `equilibrium-rainbow-display`.

Initialization must retain the authored start node, create at least one equipment instance, and begin with no completed nodes.

## Known coupling risks

1. Artifact kind detection is structural rather than discriminator-based. Adding future schemas must not make them accidentally validate as chemistry artifacts.
2. Public loaders cache promises and fall back to TypeScript fixtures after fetch failures. Tests must exercise the public index/file path and verify the loaded ID matches the index.
3. Action verbs are coupled across validation, interaction inference, the reducer, evidence, Studio blueprints, and authored JSON. Extending one list without the others can create false runnable behavior.
4. Runtime initialization resolves model-backed actions and derives legacy attachments. Shared adapters must remain read-only and must not create a second chemistry reducer.
5. Equipment IDs couple definitions, visual profiles, assets, snap zones, initial state, interactions, and authored content.
6. Routes are a hand-written hash parser plus explicit `App` branches. Default-off extension flags must not add navigation or change unknown-route fallback.
7. Runtime-only key lists exist in both validation and export modules. They must remain identical until a later cycle intentionally centralizes them.
8. Persistence keys are distributed across Studio, assistant, and gesture modules. Studio Core flags must not silently introduce another durable key.
9. Import normalization intentionally backfills older interaction specs. Canonical export and sanitization must preserve that compatibility behavior.
10. Runtime startup feedback includes the current timestamp, so characterization asserts semantic fields rather than snapshotting incidental time.

## Pre-edit verification record

- `npm run typecheck`: initially failed because dependencies were absent; after `npm install --no-save --package-lock=false`, passed with exit 0.
- `npm test`: under the shell's unsupported Node 23 runtime, 61 assertions passed but Vitest exited 1 with 21 worker-start timeouts. A supported bundled Node 24 single-fork run completed 403 assertions: 402 passed and the realistic SVG wrapper scan hit its existing 5-second timeout.
- `npm run build`: passed with exit 0; Vite transformed 2,094 modules.
- `npm run smoke:e2e`: initially could not launch because the Playwright Chromium binary was absent. After `npx playwright install chromium`, the pre-edit run completed with 29 passed, 5 configured skips, and 4 failures: two Studio header/template timeouts and two gesture edge-scroll assertions.

These failures predate Cycle 01 source changes and are not acceptance evidence for later behavior. Post-edit commands and results are recorded in the Cycle 01 handoff.
