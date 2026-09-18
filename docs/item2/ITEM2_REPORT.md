# Item 2 — Lab Studio catalog reconciliation status

## Current status

- Branch: `codex/item2-catalog-reconciliation`
- Current main/preparation baseline: `f7c2b863f641090d9abc5c08ee22da72702fdfd6`
- Indexed catalog accounted: **17 labs + 42 techniques = 59**
- Hosted source configuration accounted: **66 / 66**
- Historical dependency set locally restored: **46 / 46 files, 39,500,058 bytes, 46/46 SHA-256 matches**
- Historical dependencies on GitHub branch: **not restored**
- Fresh current evidence pipeline: **Run B diagnostic capture plus Run C final freshness receipt; six core phases passed; supplemental content check exited 1 and is fully triaged**
- Source-level reconciliation closure: **current static reconciliation recorded; runtime/scientific/release closure not claimed**
- Full Item 2: **complete for the authorized source/current-evidence scope, with explicit static limitations**
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

The authorized item-2 evidence phase is now recorded in Run B. The remaining unrun checks are deliberately outside the repository validation policy and this scoped request.


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

These changes improve static specification fidelity only. Item 2 remains incomplete pending repository-workspace restoration and separately authorized fresh evidence.


## Final targeted scenario corrections

A subsequent source review corrected two remaining scenario-contract errors.

**Green Chemistry:** the scenario no longer requires a numerical recovered-product mass. Heated-product recovery is qualitative provenance; composition is supported by empty/loaded/thermal-cycle/constant-final balance evidence; atom economy is calculated from the teacher-assigned report convention. Both supported tare conventions remain separate cases.

**Quick Ache analysis:** retry/recalculation may reuse still-valid source measurements; an upstream physical recovery requires reacquiring measurements invalidated by that physical branch; full player Reset creates fresh state and clears both measurements and calculations.

No runtime/evidence pipeline was executed for those documentation corrections before the authorized current-evidence pass.

## Fresh current evidence — Run B

- Run ID: `item2-f9c9229-run-b`
- Source commit at initialization: `f9c9229`
- Source snapshot payload SHA-256: `f14055d751a2bfbbe604d0c92f5995b4dabcc64942ed3b73a2fe5019731cedd0`
- Core chain: **6/6 passed** — compiler witness, reconciliation, Cycle 09 overlay refresh/check, reconciliation check and static verifier.
- Recorder `--check`: **source current; integrity passed; complete-current-run-with-supplemental-failures**.
- Complete content JSON: `delivery/run-b-content-check-compiled-json.stdout.json` (SHA-256 `e5b849bfe6893b9cf7570aacab34a1737eeebc016d15cd4872ab92013b501e02`; exit 1).

The content result retains 906 static findings: 903 source-trace registry gaps, two inconclusive cuvette-composition rows and one inconclusive configured-wavelength row. One raw composition row was routed to compiled-context evaluation and produced no compiled finding. The compiled campaign covered 30/30 attempted witnesses and 6,278 node contexts, with zero compiled-context findings; 38 declared configurations remain unrepresented in the static witness set. Every retained finding, routed row and coverage limitation has a stable identity and explicit disposition in `docs/item2/FINDING_TRIAGE.json`.

These results are source/static evidence only. No runtime, browser, scientific, classroom, safety or release acceptance is claimed, and no push/merge/deployment was performed.

The tracked triage and report updates were then frozen in the local final candidate. Run C (`item2-646169f-run-c`) is the final freshness receipt for that exact tree; its source snapshot and recorder `--check` are the authoritative final identity.
