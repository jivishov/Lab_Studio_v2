# Item 2 — Lab Studio catalog reconciliation status

## Current status

- Branch: `codex/item2-catalog-reconciliation`
- Current main/preparation baseline: `f7c2b863f641090d9abc5c08ee22da72702fdfd6`
- Indexed catalog accounted: **17 labs + 42 techniques = 59**
- Hosted source configuration accounted: **66 / 66**
- Historical dependency set locally restored: **46 / 46 files, 39,500,058 bytes, 46/46 SHA-256 matches**
- Historical dependencies on GitHub branch: **not restored**
- Prepared final evidence pipeline: **item2-luna-local-20260918-r2; recorder/current/source-integrity/core result pending; source/static preflight retains 21 justified nonblocking source-trace residuals**
- Source-level reconciliation closure: **source/static preparation recorded; final recorder/current/source-integrity/core result pending; runtime/scientific/release closure not claimed**
- Full Item 2: **incomplete pending the final recorder/current/source-integrity/core result, with explicit static limitations**
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

The attached package was extracted locally and the 46 repository planning dependencies were copied into the isolated checkout at `planning/...`. Every copied file was re-hashed: **46 matches, 0 mismatches**; total **39,500,058 bytes**. The exact restoration was committed locally; no push or merge was performed.

The branch remains isolated from `main`; this is a local evidence candidate, not a published release.

## Validation/run boundary

Performed in this continuation:
- source/JSON review of the three external-review findings;
- activity-specific historical disposition reconstruction from the supplied historical content-check artifact;
- source tracing of paper/hand-warmer/teacher setup paths;
- local byte-exact planning dependency restoration and SHA-256 verification;
- ledger/report corrections.

Not run:
- tests, including the new titration regression;
- typecheck/build/browser/runtime/E2E/broad lint.

The authorized item-2 evidence phase is prepared but not yet observed. The remaining unrun checks are deliberately outside the repository validation policy and this scoped request.


## Final external-review scenario correction

The remaining activity-scenario review finding is corrected in `CATALOG_DISPOSITIONS.json` schema version 4.

- 59/59 indexed activities have activity-specific recovery/reset cases.
- 59/59 indexed activities have activity-specific evidence cases.
- Recovery scenario strings are 59/59 unique.
- Evidence scenario strings are 59/59 unique.
- The older generic `scenarioAssignments` field is removed from all 59 entries.
- `titration-curve-analysis` no longer treats omitted `analysisMode` as a refusal. The approved `recorded-evidence-only` default is recognized; its refusal/recovery case instead requires missing `curve-analyte-volume` or `equivalence-volume` evidence to block `calculate-curve-molarity`.

These are scenario specifications only. They remain unexecuted until the separately authorized evidence phase.

## Independent restored-ZIP verification

The locally restored planning ZIP was independently reopened and checked directly against `BUNDLE_MANIFEST.json`:

- ZIP SHA-256: `8b5d1b207019eafd2100e520105537b37531b9aa405fe36fe168e3eec00e0968`
- ZIP size: 1,398,845 bytes
- repository planning members: 46 expected / 46 found
- uncompressed planning bytes: 39,500,058 expected / 39,500,058 found
- SHA-256 matches: 46
- missing: 0
- mismatches: 0
- extras: 0

The files remain absent from the GitHub branch; this verifies the local restoration artifact only.


## Self-critical refinement

A stricter consistency review found four remaining static-artifact defects and corrected them:

1. The catalog top-level `evidenceMode` still overstated source-level reconciliation even though the authoritative status correctly says closure is not claimed.
2. Twenty configuration/refusal scenarios still used the same generic invalid/out-of-sequence template.
3. Fifty-one ordinary-case strings contained generated grammar such as “path that measure/execute”.
4. The run ledger said dependencies were “not restored” without distinguishing verified local restoration from their absence in the writable repository execution workspace.

Catalog schema version 5 now has 59/59 distinct ordinary, configuration/refusal, recovery/reset, and evidence cases. Lab and technique namespaces are explicitly included in scenario wording so the two duplicated ids remain distinct. `SCENARIO_AUDIT.json` schema version 2 records zero legacy scenario assignments, zero old generic refusal templates, and zero old generated ordinary-case grammar defects.

That earlier source-only checkpoint remains historical; the preparation section below does not claim final recorder/current/source-integrity/core acceptance.


## Final targeted scenario corrections

A subsequent source review corrected two remaining scenario-contract errors.

**Green Chemistry:** the scenario no longer requires a numerical recovered-product mass. Heated-product recovery is qualitative provenance; composition is supported by empty/loaded/thermal-cycle/constant-final balance evidence; atom economy is calculated from the teacher-assigned report convention. Both supported tare conventions remain separate cases.

**Quick Ache analysis:** retry/recalculation may reuse still-valid source measurements; an upstream physical recovery requires reacquiring measurements invalidated by that physical branch; full player Reset creates fresh state and clears both measurements and calculations.

No runtime/evidence pipeline was executed for those documentation corrections before the authorized current-evidence pass.

## Pending final evidence — item2-luna-local-20260918-r2

- Run ID: `item2-luna-local-20260918-r2` is prepared for the new final sequence; the future recorder receipt is expected under `planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current-runs/item2-luna-local-20260918-r2/CURRENT_VERIFICATION_RUN.json`, with the future summary at `../delivery/item2-luna-local-20260918-r2/FINAL_SUMMARY.json`.
- Current source/static preparation covers **882 exact action members** in **197 reviewed contextual groups** and retains **21 explicit residuals** (17 authored paper-drying operations and 4 teacher-configured inventory actions).
- The final recorder/current/source-integrity/core result is **pending**. It must be read from the structured recorder result; it is not inferred from the content-check exit.
- The tracked input tree must remain unchanged after the source-freeze manifest commit; only permitted generated evidence artifacts may be added after the final run.

This is preparation evidence only. It does not claim a current run, source integrity, core completion, runtime behavior, scientific validity, classroom safety or release readiness.
