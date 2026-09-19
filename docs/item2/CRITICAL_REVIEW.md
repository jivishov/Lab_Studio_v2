# Item 2 critical review — revision after external review

## Identity

- Model setting: GPT-5.6 Luna, Max reasoning (the requested continuation setting).
- Runtime attestation: a separate model/effort attestation was not exposed; no stronger claim is made.
- Review type: same-session critical review of the repaired source and current evidence; no independent reviewer is claimed.

## External-review findings and disposition

### 1. Generic activity justification — corrected

Confirmed. The previous ledger had 59 records but its scenarios and historical-finding treatment were too generic to support a reconciliation-closure claim.

Correction:
- all 59 entries now receive activity-specific scientific and scenario descriptions;
- historical finding-bearing entries list rule families, counts, representative scopes, historical evaluation scope and a present disposition;
- no activity is declared clean merely because its direct historical count is zero;
- historical counts are not treated as current bug counts or fixed counts.

The source-level closure claim is withdrawn. The narrower claim is inventory/static-rationale accounting; final recorder/current/source-integrity/core evidence remains pending; runtime/scientific/browser/release acceptance remains unclaimed.

### 2. Evidence freshness — corrected

Confirmed. Updating tracked `FINDING_TRIAGE.json` after a final verification check would change the source snapshot the run was meant to attest to.

Correction:
- the execution request now freezes tracked reports/ledgers before an accepted run;
- Run A may be used as discovery evidence;
- if Run A causes tracked triage/report/source changes, those changes are committed and a complete Run B with a new run id is required;
- no accepted run is reused after tracked source changes.

### 3. Paper-chromatography coverage contradiction — corrected

Confirmed. The previous record incorrectly retained `requiredSlotsKnown: false` and a stale “not-assessed” marker even though the setup path had already been source-traced.

Correction:
- `requiredSlotsKnown: true`;
- all seven required values are named;
- the pre-setup missing set is explicit;
- after supported teacher setup, missing required slots are zero.

## Dependency restoration

The 46 dependencies are now restored locally and re-hashed: 39,500,058 bytes, 46/46 matches. They remain absent from the GitHub branch because the available GitHub mutation interface cannot upload a local file snapshot. This is an execution-workspace transfer blocker, not a package-integrity blocker.

## Remaining acceptance boundary

The current evidence phase is prepared for the authorized source/static scope; final recorder/current/source-integrity/core acceptance remains pending, and runtime, scientific, browser, classroom, safety and release acceptance remain unclaimed.


## Final scenario review correction

The remaining external-review finding is confirmed and corrected.

The previous revision made scientific focus and ordinary cases activity-specific, but recovery/evidence cases still reused common sentence templates and the older generic `scenarioAssignments` remained. This was insufficient.

The catalog now has:
- 59 distinct recovery/reset cases;
- 59 distinct evidence cases;
- zero legacy `scenarioAssignments` properties;
- a corrected `titration-curve-analysis` refusal case that recognizes the defaulted `analysisMode=recorded-evidence-only` and instead tests absence of the recorded analyte aliquot/equivalence measurements.

`SCENARIO_AUDIT.json` records these invariants. Scenario closure is source-specification closure only; it is not execution evidence.


## Self-critical refinement

After the external-review fixes, an additional audit found contradictory top-level evidence wording, 20 residual generic refusal cases, 51 generated ordinary-case grammar defects, and ambiguous local-vs-repository dependency-restoration wording. It also confirmed that scenario identity must use kind + id because lab and technique namespaces share some ids.

All are corrected in catalog schema version 5 / scenario-audit schema version 2. All four scenario dimensions are now 59/59 distinct and kind-scoped. This remains non-executed source review; it does not add a current-evidence acceptance claim.


## External-review corrections: Green Chemistry and Quick Ache reset semantics

Two remaining scenario defects were confirmed and corrected.

### Green Chemistry

The previous scenario incorrectly required recovered-product masses/recovery calculations. The route contract deliberately does **not** weigh the heated recovered product: heated-product recovery is provenance evidence, while composition is derived from recorded thermal balance evidence. Atom economy is validated from the teacher-assigned report's stoichiometric convention. Catalog schema version 6 now reflects those distinctions and preserves the two tare conventions as separate witnesses.

### Quick Ache analysis reset

The previous scenario incorrectly described Reset as clearing report calculations while preserving measurements. The corrected scenario distinguishes:
- calculation retry/recalculation, which may reuse still-valid recorded measurements;
- upstream physical recovery/reset, which requires reacquisition of any measurements invalidated by that physical recovery; and
- full activity Reset through `usePlayerRuntime.reset()`, which creates fresh runtime state and therefore clears both measurements and calculations.

Those documentation/source-contract corrections were source-only; the current evidence result is recorded separately below.

## Current-evidence preparation — item2-luna-local-20260918-r2

- Run ID: `item2-luna-local-20260918-r2` is prepared for the new final sequence; the future recorder receipt is expected under `planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current-runs/item2-luna-local-20260918-r2/CURRENT_VERIFICATION_RUN.json`, with the future summary at `../delivery/item2-luna-local-20260918-r2/FINAL_SUMMARY.json`.
- Current source/static preparation covers **882 exact action members** in **197 reviewed contextual groups** and retains **21 explicit residuals** (17 authored paper-drying operations and 4 teacher-configured inventory actions).
- The final recorder/current/source-integrity/core result is **pending**. It must be read from the structured recorder result; it is not inferred from the content-check exit.
- The tracked input tree must remain unchanged after the source-freeze manifest commit; only permitted generated evidence artifacts may be added after the final run.

This is preparation evidence only. It does not claim a current run, source integrity, core completion, runtime behavior, scientific validity, classroom safety or release readiness.
