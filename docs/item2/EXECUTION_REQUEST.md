# Item 2 pending execution request

## Status

Item 2 is **not fully complete**. Source-level catalog/configuration/finding reconciliation is complete within the authorized basic-static scope, but current evidence is pending.

Two prerequisites remain:

1. The user must send the optional evidence-pipeline exception as a **separate instruction**. `OPTIONAL_EVIDENCE_AUTHORIZATION.txt` in the package is proposed permission text, not authorization.
2. The execution environment must be able to restore the 46 manifest-listed planning dependencies byte-for-byte from the attached package into this branch. The current web GitHub connector cannot upload the local 39.5 MB dependency set directly.

## Branch to continue

`codex/item2-catalog-reconciliation`

Start from the then-current head of that branch. Do not merge to `main`.

## Restore before executing

Copy exactly the manifest-listed repository files from the attached package into their repository-relative `planning/...` paths. Verify each SHA-256 against `BUNDLE_MANIFEST.json`. Do not normalize or regenerate the historical files.

## Exact authorized pipeline order

Only after the separate authorization is received and the dependencies are restored:

```text
node scripts/recordCurrentVerificationRun.mjs --initialize --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-compiler-witness --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-reconciliation --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle09-overlay-refresh --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle09-overlay-check --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-reconciliation-check --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase cycle12-static-verifier --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --run-phase repository-content-check --run-id <run-id>
node scripts/recordCurrentVerificationRun.mjs --check --run-id <run-id>
```

Then capture the complete JSON diagnostic result:

```text
node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/checkContentConsistency.mjs --compiled --json
```

Capture stdout, stderr and exit status for every command. Refresh witness/reconciliation/overlay artifacts only from that run, update `FINDING_TRIAGE.json` from the fresh raw diagnostics, and keep source-repair status separate from current-evidence status.
