# Item 2 — Lab Studio catalog reconciliation status

## Current status

- Branch: `codex/item2-catalog-reconciliation`
- Current main/preparation baseline: `f7c2b863f641090d9abc5c08ee22da72702fdfd6`
- Indexed catalog accounted: **17 labs + 42 techniques = 59**
- Hosted source configuration accounted: **66 / 66**
- Historical dependency set locally restored: **46 / 46 files, 39,500,058 bytes, 46/46 SHA-256 matches**
- Historical dependencies on GitHub branch: **not restored**
- Fresh current evidence pipeline: **not run**
- Source-level reconciliation closure: **not claimed**
- Full Item 2: **incomplete**
- Items 3–5: **not started**

## Record corrections after external review

### Activity-specific justification

The catalog ledger no longer treats a generic scenario sentence or historical finding count as a disposition. Every indexed activity now has a distinct scientific focus and ordinary, refusal/configuration, recovery/reset and evidence scenario. Every activity that owns historical findings also records the historical rule families, representative affected scopes, historical evaluation scope, present source-review disposition, and the boundary on what can be claimed before fresh current diagnostics.

Example: `brass-spectrophotometry` now separates its 35 supplied historical findings into:
- 32 `cycle06/photometer-read-ungated` rows. Current source contains the zero/configuration gating contract and focused regression coverage, so the source-level disposition is **source contract addressed, execution/current checker unverified**.
- 3 `action/source-trace-missing` rows. The migration source emits source-trace overlay data, but freshness/completeness is **pending the fresh overlay/content-check phase**.

Thus the ledger does not equate “35 historical findings” with 35 current bugs or with 35 fixed bugs.

### Configuration coverage

The contradictory paper-chromatography row is corrected. It now records these seven required hosted values:

`selectedProcedure`, `baselineHeightMm`, `solventDepthMm`, `spotVolumeMl`, `solventVolumeMl`, `spotterLoadVolumeMl`, and `stopCondition`.

`requiredSlotsKnown` is true. `src/data/labSetup.ts` is recorded as the setup materializer, and `selectedProcedure` remains intentionally host-composition-only.

The other formerly raw-missing configuration values remain source-accounted through their supported teacher-setup paths. This is 66/66 source-level host binding/setup accounting, **not compiled-witness acceptance**.

### Evidence freshness

The execution request now uses a freshness-safe two-run protocol. Fresh diagnostics may be used to update tracked triage/reporting only before a new accepted final run. A verification run is never presented as evidence for tracked source files edited after that run's source identity.

## Implementation repair retained

The item-2 source repair remains `titration-curve-analysis`: its molarity result is derived from recorded analyte/equivalence evidence via `acidBaseMolarityFromEquivalenceVolume`, rather than using the authored 0.099 M as a fallback answer. The public definition, generator, reducer and focused regression remain aligned. The regression is still intentionally unrun.

## Dependency restoration

The attached package was extracted locally and the 46 repository planning dependencies were copied into `/mnt/data/item2_local_restore/planning/...`. Every copied file was re-hashed: **46 matches, 0 mismatches**.

The web GitHub connector cannot upload those local file snapshots directly, so branch restoration remains pending an upload-capable writable checkout. The branch must not claim those dependencies are present until that copy is made in the actual execution workspace.

## Validation/run boundary

Performed in this continuation:
- source/JSON review of the three external-review findings;
- activity-specific historical disposition reconstruction from the supplied historical content-check artifact;
- source tracing of paper/hand-warmer/teacher setup paths;
- local byte-exact planning dependency restoration and SHA-256 verification;
- ledger/report corrections.

Not run:
- optional evidence pipeline;
- fresh compiled JSON content check;
- tests, including the new titration regression;
- typecheck/build/browser/runtime/E2E/broad lint.

The optional evidence phase still requires a separate user authorization.
