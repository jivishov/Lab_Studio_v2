# Item 2 — complete Lab Studio catalog reconciliation

## Status

- Branch: `codex/item2-catalog-reconciliation`
- Preparation baseline / current main: `f7c2b863f641090d9abc5c08ee22da72702fdfd6`
- Indexed catalog: **17 labs + 42 techniques = 59 activities**
- Source-level hosted configuration accounting: **66 / 66 represented or materialized by a supported setup path**
- Source-repair status: **complete within the source-review scope**
- Current-evidence status: **pending**
- Full Item 2 status: **incomplete**
- Items 3–5: **not started**

## Implementation

The in-scope source defect found during reconciliation was the indexed `titration-curve-analysis` calculation path. Its molarity calculation carried a static `0.099 M` expected value while the generic reducer could use that same authored value as the computed fallback. The branch now uses `acidBaseMolarityFromEquivalenceVolume`: the learner's recorded analyte aliquot and recorded equivalence volume are required, while the titration model supplies only titrant concentration and stoichiometry. The public definition, generator source, reducer and a focused regression were changed together. The regression was authored but **not run** under repository policy.

## Catalog ledger

`CATALOG_DISPOSITIONS.json` now records every one of the 59 indexed activities with its current file/blob identity, route/execution path, configuration/host context, individual rationale, planned scenario assignments, finding references, historical owner summary and source-review disposition.

The two special non-counted sources remain explicit:
- `public/techniques/ph-volume-titration-trial.json`: unindexed generated composition carrier, not a 43rd technique.
- `public/labs/acid-base-titration-curves-config.json`: custom investigation configuration/data contract, not an 18th lab.

`ph-volume-formal-titration-trial` remains the indexed 42nd technique that was absent from the historical 41-technique ownership map.

## Configuration reconciliation

The prior 17 missing-slot flags were pre-setup observations, not 17 application defects:

- Hard water: `applyLabSetup` validates/injects oven temperature, first drying duration and cooling temperature into both affected instances.
- Bonding: `applyLabSetup` injects the selected procedure, selected test panel and teacher thresholds/limits for all 14 known/blind instances.
- Quick Ache: `applyLabSetup` validates and injects the supported recovery methods, dryness/cooling/pH/density values, extraction count, selected procedure and approval flag.
- Paper chromatography: `applyLabSetup` validates classroom geometry/data/solvent choices and binds the host-only procedure, volumes and stop condition.
- Hand warmer: the authoritative generator declares exactly one required `wasteRoute` slot with `teacher-configured` default; the lab host already binds that value.

This closes source-level host/configuration accounting at 66/66. It does **not** claim current compiled-witness coverage; that remains pending the authorized pipeline.

## Findings

`FINDING_TRIAGE.json` separates:
- current source-review findings (including the repaired molarity defect and configuration-path resolutions),
- fresh raw diagnostics (**not generated**), and
- the attached preparation baseline's **973 historical findings**, retained only as historical comparison.

No historical finding is silently relabeled as current.

## Evidence dependency restoration

The package supplies the omitted manifest-listed planning evidence, but exact restoration is blocked in this web toolchain. The 46 repository planning files total **39,500,058 bytes** and include individual 3–12 MB JSON artifacts. They never existed in `Lab_Studio_v2` history, so there are no existing Git blobs to reattach. The current GitHub connector has text/blob mutation calls but no attachment/container-file upload handoff. A partial `planning/` tree was deliberately not committed.

See `EVIDENCE_DEPENDENCY_RESTORATION.json` for the exact blocker.

## Actual run / unrun record

Performed:
- Read and reconciled current `main` and branch state.
- Parsed current lab/technique indexes and ledgers.
- Source-traced routes, setup materialization, special carriers and the molarity calculation path.
- Verified the branch remains based on current `main`.
- Performed JSON parsing while constructing/re-reading the ledgers through the GitHub connector.

Intentionally not run:
- the named evidence pipeline;
- complete compiled content JSON check;
- unit/integration tests, including the new titration regression;
- typecheck;
- build;
- browser/runtime/E2E checks;
- broad lint/test suites.

Reasons: no separate optional-pipeline authorization, missing restored planning dependencies, no writable repository checkout/Node execution path in this web session, and the repository's basic-static validation ceiling.

## Pending phase

`EXECUTION_REQUEST.md` is the exact continuation request. After separate authorization and byte-exact dependency restoration, run the named phases in the handoff's order, capture every stdout/stderr/exit code, refresh current evidence, then update finding triage from the newly generated raw diagnostics.

No work from Items 3–5 is included.
