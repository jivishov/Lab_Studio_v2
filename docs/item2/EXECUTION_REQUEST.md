# Item 2 evidence execution record

## Status

Item 2 is **complete for the authorized isolated source/current-evidence scope with explicit static limitations**. Catalog/source/configuration records were corrected, the 46 historical dependencies were restored into the isolated checkout with 46/46 SHA-256 matches, and the named evidence phase was executed as Run B. The branch was not pushed or merged.

## Preconditions

1. The optional evidence-pipeline exception was supplied as a separate task instruction.
2. The evidence ran in the prepared writable checkout of `codex/item2-catalog-reconciliation`.
3. The 46 manifest-listed files were copied into their exact repository-relative `planning/...` paths and re-verified: 46/46 SHA-256 matches.
4. Source repairs and discovery evidence were committed before Run B; current triage/report edits are followed by a final freshness run when needed.

## Evidence freshness rule

`docs/item2/FINDING_TRIAGE.json`, `docs/item2/ITEM2_REPORT.md`, catalog/configuration ledgers, implementation source and tests are part of the tracked source snapshot. **Do not modify any of those tracked files after the accepted run's source identity is initialized and then present that same run as evidence for the modified tree.**

Generated phase outputs may change only where the recorder explicitly treats them as replaceable evidence outputs.

Because fresh diagnostics are needed to finish tracked triage/reporting, use a two-run protocol:

### Run A — discovery/current-diagnostics run

After dependency restoration and a clean tracked source freeze, run:

```text
node scripts/recordCurrentVerificationRun.mjs --initialize --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-compiler-witness --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-reconciliation --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle09-overlay-refresh --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle09-overlay-check --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-reconciliation-check --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-static-verifier --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase repository-content-check --run-id <discovery-run-id>
node scripts/recordCurrentVerificationRun.mjs --check --run-id <discovery-run-id>
node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/checkContentConsistency.mjs --compiled --json
```

Capture stdout, stderr and exit status for every command.

Use Run A only to obtain fresh witness/reconciliation/overlay/content diagnostics. Prepare the new activity/finding dispositions from those results **outside the tracked source tree first**.

### Finalize tracked records

Update tracked `docs/item2/FINDING_TRIAGE.json`, `ITEM2_REPORT.md`, ledgers or source only if the fresh Run-A evidence requires it. Commit those changes.

If nothing tracked changes after Run A, Run A may be accepted as final evidence. If any tracked file changes, Run A is discovery evidence only.

### Run B — accepted final run when tracked source changed

Against the finalized commit, use a **new run id** and repeat the complete ordered pipeline plus the complete JSON content check. The accepted final evidence must identify the final source commit and must pass the recorder's final source/integrity check for that commit.

Do not edit tracked reports/triage again after Run B unless you are prepared to make another commit and repeat the final run.

## Required outputs

Return the final source commit, exact command logs/exit statuses, refreshed compiler witness/reconciliation/overlays, fresh content-check JSON, final per-finding dispositions, and the final recorder source/integrity result. Keep current raw diagnostics separate from historical findings.

Do not merge to `main` unless separately requested.

## Current execution result

- Discovery runs remain historical: Run A `item2-597c060-run-a`, Run B `item2-f9c9229-run-b`, and Run C `item2-646169f-run-c` are not used as the final identity for this repaired tree.
- Final run: `item2-luna-final3-20260918`; source commit and source snapshot identity are recorded in its `CURRENT_VERIFICATION_RUN.json`.
- Core chain: **5/5 passed**; supplemental static verifier passed; repository-content-check exited 1 and retained only 21 justified nonblocking source-trace residuals.
- Complete current diagnostic: 882 grouped source-trace members, 21 residuals, three prior Crystal Violet rows resolved by compiled static routing, 30 compiled witnesses, 6278 node contexts, 0 compiled-context findings, and 37 fixed-role plus 1 not-applicable configuration resolutions.
- The final recorder receipt records the source/integrity result and exact command outcomes; the source/static boundary remains explicit and no runtime, scientific, browser, classroom, safety or release acceptance is claimed.
