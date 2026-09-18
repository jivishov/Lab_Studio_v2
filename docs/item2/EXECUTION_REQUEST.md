# Item 2 pending evidence execution request

## Status

Item 2 remains **incomplete**. Catalog/source/configuration records have been corrected, and the 46 historical dependencies are locally restored with 46/46 SHA-256 matches, but they are not present on the GitHub branch. The named evidence phase has not been authorized in a separate instruction.

## Preconditions

1. Receive the optional evidence-pipeline exception as a **separate user instruction**. The attached OPTIONAL_EVIDENCE_AUTHORIZATION.txt is proposed permission text, not authorization by attachment.
2. Use an upload-capable writable checkout of `codex/item2-catalog-reconciliation`.
3. Copy the 46 manifest-listed files from the verified local/package source into their exact repository-relative `planning/...` paths and re-verify every SHA-256 against `BUNDLE_MANIFEST.json`.
4. Commit/freeze every intended tracked source/ledger/report change **before** the accepted final verification run.

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
