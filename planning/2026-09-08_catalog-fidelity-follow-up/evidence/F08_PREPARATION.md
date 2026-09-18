# F08 preparation — current-evidence closure design

## Scope and present boundary

This is a read-only preparation record for F08. It maps the current evidence
surfaces and the eventual closure shape; it does **not** regenerate a witness,
audit, overlay, baseline, reconciliation report, closure document, or lane
artifact. It also does not run a checker, test, build, browser, runtime, or
generator scenario.

Preparation source identity (not an F08 acceptance snapshot):

- repository root: `C:/Users/EmilJivishov/Projects`
- Lab Studio branch: `codex/Lab_Studio`
- source `HEAD`: `2468e476bc0e4aac74252ac3e47565008868c2dd`
- currently tracked dirty paths are the reviewed/integrated F01 scope. They
  must be re-captured at F08 start rather than treated as the F08 input
  snapshot.

`ORCHESTRATION_STATUS.json` currently records F01 as
`integrated-static-reviewed-verification-pending`, F02 as implementation
running, F03--F06 as preparation-complete/implementation-pending, F07 as
source-reconnaissance-complete/implementation-pending, and F08 as
`source-preparation-running-implementation-pending`. Those are coordination
states, not evidence of later-cycle acceptance.

F08 must remain pending until F02--F07 have each completed their required
implementation, independent Sol/xhigh review/refinement, and authoritative
integration gate. F03's diagnostic implementation depends on accepted F02;
its **final strict bundled activation** also waits for the reviewed and
integrated F04/F05 migrations. A preparation note or a task final message is
not activation. F01's withheld execution verification stays withheld unless a
later authorization explicitly changes that boundary.

## Current evidence-generation graph

The old twelve-cycle coordinator has a write-producing graph. The following is
the exact currently implemented dependency direction; it is not authorization
to execute any node now.

```text
authoritative generator inputs / direct catalog owners / registries / indexes
                    |
                    | (owning F04--F07 generator or source changes first)
                    v
current public lab + technique JSON, indexes, source-trace and atom registries
                    |
                    +--> current lane overlays (05, 06, 07, 08, 09, 11, 10)
                    +--> frozen predecessor disposition (read only)
                    +--> ownership ledger + status ledger (read only)
                    |
                    v
`collectCycle12CompileWitness.mjs`
  writes `evidence/lane-12/COMPILED_LAB_WITNESS.json`
                    |
                    v
`reconcileCycle12Catalog.mjs`
  writes technique audit, lab audit, reconciliation report, and closure prose
                    |
                    +------> Cycle 09 overlay refresh feedback edge
                    |          `documentCycle09Composition.mjs` reads the
                    |          just-written audits and writes its three overlays
                    |                         |
                    |                         v
                    |          `checkCycle09Composition.mjs` checks the fresh
                    |          audit hashes and overlay coverage
                    |                         |
                    |                         v
                    +<----- `reconcileCycle12Catalog.mjs --check` must be
                               repeated after the Cycle 09 overlay refresh
                    |
                    v
current deterministic-output check and source/static verifier records
```

### Inputs and outputs by step

1. **Owning content/materialization work comes first.** Generated public JSON
   must be refreshed by its authoritative input/generator or migration, with
   any reference/version changes made by the owner. F08 must not repair public
   generated JSON by hand or reinterpret a historical lane result as a current
   generated result.

2. **Compiler witness:** `npm run cycle12:compile-witness` launches
   `scripts/collectCycle12CompileWitness.mjs`, which reads the public lab and
   technique indexes, each indexed source definition, `applyLabSetup`,
   `compileLabComposition`, declared reachability witnesses, and its finite
   illustrative fixtures. It writes only
   `planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json`.
   Its union is a declared-witness compiler view, not all teacher settings or
   runtime traversal.

3. **Coordinator reconciliation:**
   `node scripts/reconcileCycle12Catalog.mjs` reads the current public indexes
   and indexed definitions, `src/domain/atomRegistry.json`,
   `docs/architecture/source-trace-registry.json`, `CATALOG_OWNERSHIP.json`,
   the original `_CYCLE_STATUS.json`, the compiler witness, and overlays from
   lanes `05, 06, 07, 08, 09, 11, 10`. It also reads the immutable frozen
   predecessor projection. It writes these four current outputs:

   - `TECHNIQUE_ATOMICITY_AUDIT.json`
   - `LAB_COMPOSITION_AUDIT.json`
   - `evidence/lane-12/RECONCILIATION_REPORT.json`
   - `docs/technique-composition-closure.md`

4. **First deterministic check:**
   `node scripts/reconcileCycle12Catalog.mjs --check` compares each of those
   four current outputs with the expected result from the then-current inputs;
   it does not write an output.

5. **Cycle 09 feedback edge:** `scripts/documentCycle09Composition.mjs` is the
   documented writer for the Cycle 09 `source-trace-overlay`,
   `technique-atomicity-overlay`, and `lab-composition-overlay`. It reads the
   current technique/lab audits and records their hashes in
   `observedContractDependencies`. `scripts/checkCycle09Composition.mjs`
   compares those recorded hashes with the live audits and registry. Therefore
   an audit refresh can make previously valid Cycle 09 overlay evidence stale
   without changing a Cycle 09 row.

6. **Terminal static evidence:** after a Cycle 09 refresh, re-run the Cycle 09
   checker, then re-run reconciliation `--check`. The historical continuation
   documents the base coordinator sequence as witness -> reconciliation write
   -> reconciliation check -> verifier, followed by owner verifiers; its
   special Cycle 09 instruction is document -> reconciliation check again.
   For a final F08 record, identify whether `verifyCycle12ScientificActivities`
   was run before or after this refresh. It does not itself validate Cycle 09
   overlay hashes, so a pre-refresh verifier cannot prove final Cycle 09
   overlay freshness. A fully current terminal record needs a separately
   recorded post-refresh Cycle 09 checker and reconciliation check; repeat the
   verifier only if authorized and label its source identity.

7. **Other checks are independent evidence categories.** `content:check`,
   lane checkers, test accounting, typecheck, runtime traversal, browser, and
   build results must be recorded with their own command, environment, source
   identity, collection scope, exit state, and authorization state. They must
   not be folded into the coordinator result or inferred from old closure text.

## Preserved lineage versus current outputs

| Surface | F08 treatment | Reason |
|---|---|---|
| `planning/2026-08-30_lab-studio-technique-composition-remediation/_CYCLE_STATUS.json` and the original twelve-cycle ledger | Preserve; do not rewrite as F08 status. | The orchestration protocol reserves `ORCHESTRATION_STATUS.json` for the follow-up. |
| `evidence/lane-12/FROZEN_PREDECESSOR_SOURCE_DISPOSITION.json` | Immutable read-only predecessor input. Never regenerate. | The reconciler uses it to avoid reading its own regenerated audit back as a predecessor. |
| `evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json` and its prior-revision lineage | Historical reviewed-frozen identity; cite it as predecessor lineage, not as the current F08 source. | It pins the reviewed revision-9 worktree and its Cycle 07 review/interface record. |
| `scripts/content-consistency-lint-baseline.json` | Preserve; no baseline rewrite to suppress new or changed findings. | A baseline is a comparison control, not a closure mechanism. |
| Lane overlay packages | Preserve row decisions and historical identity. Do not hand-edit them in F08. | Reconciliation consumes owner-scoped overlays. The only documented current writer for the Cycle 09 hash refresh is `documentCycle09Composition.mjs`; if that writer is authorized later, record the refresh as a new current observation rather than rewriting its frozen predecessor claim. |
| `COMPILED_LAB_WITNESS.json`, the two audits, reconciliation report, and `docs/technique-composition-closure.md` | Regenerable current outputs, each tied to a fresh F08 source identity. | They are outputs of the current coordinator graph, not immutable history. |
| `CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json` and `CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json` | Preserve as historical candidate evidence; do not label either a frozen current baseline. | Both declare `state: candidate-not-frozen`. |

## Historical wording and arithmetic that F08 must not reuse as current fact

| Concern | Exact current source | Required F08 handling |
|---|---|---|
| Fixed health/status prose | `scripts/reconcileCycle12Catalog.mjs` hard-codes the old `generatedAt` date in the two audits and report, the fixed `broadRepositoryBaseline` wording, and closure template prose. The generated copies are `RECONCILIATION_REPORT.json` and `docs/technique-composition-closure.md`. | Replace fixed "current" health assertions with a run record, or mark the category `unknown`/`stale` when no matching current execution exists. Preserve the old document as historical evidence rather than silently relabelling it. |
| Historical check summaries | `CONTINUATION_CYCLE_12.md` completion and re-review sections contain old command outcomes, counts, and validation boundaries. | Retain them as historical evidence with their stated revision/date; do not copy an old pass/fail/count into an F08 current result. |
| Ownership arithmetic | `CATALOG_OWNERSHIP.json` is the live ownership source (`expectedTechniqueCount: 41`), while `public/techniques/index.json` is the live indexed-entry source. `reconcileCycle12Catalog.mjs` calculates the index/owner relationship dynamically and says that the old 40-technique wording is historical. `CONTINUATION_CYCLE_12.md` also contains the older 40-technique plan text. | Report a fresh three-way inventory: indexed definitions, owned definitions, and explicitly exempt/unindexed or non-definition files. Never subtract a carrier merely to make an old total match. |
| Revision-10 semantics | `CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json` and `CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json` explicitly describe a candidate-not-frozen, one-for-one index replacement. `SEPARATE_REVIEW_FORMAL_CONTRACT_AMENDMENT.md` says it was accepted for coordinator reconciliation while remaining candidate evidence until coordinator reissue. The current reconciler records revision 9 as its actual baseline and revision 10 as `reviewed-candidate-integrated-by-cycle-12`. | Preserve revision-10 identifiers, predecessor identities, and stated limitations exactly. F08 may issue a new current proof of the present catalog, but must not invent a historical checksum, declare revision 10 frozen retroactively, or rewrite revision 9/10 lineage. |

## Precise non-runtime inventory and disposition handling

| Item | Current observed classification | F08 inventory/disposition record | Discovery and cleanup boundary |
|---|---|---|---|
| `public/techniques/ph-volume-titration-trial.json` | Tracked, unindexed technique-shaped JSON (`ph-volume-titration-trial@3.0.1`). The revision-10 candidate record says the generated Cycle 07 carrier remains for direct generated-family consumers while the indexed route-only entry is `ph-volume-formal-titration-trial`. | Record separately as `unindexed-generated-carrier`, including ID/version, generator authority, known direct-consumer/compatibility status, public-index status, and whether F08's indexed compiler witness evaluated it. Its absence from an indexed witness is **not** retirement or a passing disposition. | Exclude it from indexed-catalog counts only after explaining the exclusion; preserve it. Any deletion/relocation requires a separate compatibility and cleanup decision. |
| `public/labs/acid-base-titration-curves-config.json` | Tracked non-definition teacher configuration payload. `auditContentInventory.mjs` already classifies it as intentional non-definition; the custom route, Cycle 10 verifier, and route-control map consume it. | Record `intentional-custom-route-settings`, with the route owner, configuration schema/source identity, and its inclusion in custom-route evidence despite exclusion from lab-definition/witness enumeration. | Do not treat it as an orphaned lab definition and do not delete it. It belongs in custom-route source identity and route coverage, not generic lab discovery. |
| `undefined/state-1024x600.png`, `undefined/state-1366x625.png`, `undefined/state-1920x945.png`, `undefined/state-900x700.png` | Four tracked root-level screenshots. No textual reference was found in the inspected `src`, `public`, `scripts`, or `docs` runtime/source scope; historical manifests can still list them as tracked files. | Record each as `tracked-nonruntime-screenshot` with path, tracked status, observed reference scope, owner/retention decision `unresolved`, and no fidelity outcome. | Exclude from runtime/catalog/witness discovery. Do not delete, move, or relabel them absent a named cleanup decision. |
| `hand_warmer/hand-warmer-calorimetry-phase16-complete-2026-07-27/phase7-work/` | Ignored nested project backup under `/hand_warmer/`; earlier continuation evidence identifies it as a stale full project copy that can contaminate broad test discovery. | Record `ignored-local-nested-backup`, its ignore rule, and a discovery-exclusion requirement. It is not an authoritative source, a catalog owner, or a current test denominator. | Never recurse into it for ordinary catalog/test discovery, modify it, or remove it in F08. Cleanup/replacement is a separately named user decision. |

The closure inventory must keep the following mutually exclusive dispositions:
`indexed-runtime-definition`, `indexed-route-only-carrier`,
`unindexed-generated-carrier`, `intentional-custom-route-settings`,
`tracked-nonruntime-screenshot`, `ignored-local-nested-backup`,
`historical-evidence`, `deprecated-pending-explicit-cleanup`, and
`unresolved-owner-decision`. Each row needs a path, tracked/ignored state,
discovery domain, owner, retention rationale, and a cleanup decision state.

## Proposed current closure record

F08 should create a new follow-up closure record rather than recasting the old
Cycle 12 closure. Its minimum shape is:

```text
closureRecord
  schema, generatedAt, followupPlanRevision
  sourceIdentity
    repository/root/branch/HEAD/tree-or-file-manifest identity
    trackedDirtyScope, allowed F08 paths, predecessor identities
  cycleStates[]
    cycle, implementationState, reviewGateState, integrationState,
    sourceDecisionState, verificationState, exact changed paths
  evidenceRuns[]
    category, command, environment, authorization, sourceIdentity,
    inputs, outputs, collection completeness, exitStatus, freshness,
    limitations
  inventory
    authoringCounts (indexed definitions, unindexed definitions, non-definition
                    payloads, historical/nonruntime artifacts)
    compiledImpact (witness compiles, union nodes, origin types, evaluated
                     configurations/instances, unrepresented configurations)
    dispositions[]
  outcomeCategories
    structuralComposition
    atomicIdentity
    evidenceContinuity
    scientificProvenance
    setupAndImportCompatibility
    visualAndEditorialStatus
    executedVerification
  openItems[]
    owner, impact, reason, nextAction, sourceDecision, verificationLimit
  historicalEvidence[]
    artifact, identity, scope, reproducibility:
      current-reproduced | historical-only | unreproducible
```

Rules for that record:

- **Source/static acceptance is separate from verification.** A category can be
  `accepted-source-static` while its runtime, test, or browser status is
  `not-run`, `withheld-by-policy`, or `unknown`; it cannot be called passing.
- **No current number is inherited.** Authoring counts describe source files
  and unique authoring defects; compiled impact describes instances/nodes under
  named declared witnesses. Neither is a substitute for the other, and neither
  is an exhaustive teacher-setting or runtime claim.
- **Collection failure is an outcome, not a zero.** Test accounting must
  distinguish discovered, collected, executed, skipped, collection-failed,
  worker-failed, incomplete, and unattempted files. An old total or a passing
  subset cannot be presented as all tests passing.
- **Freshness is identity-based.** A result is current only when its source
  identity and recorded inputs match the closure snapshot. Otherwise mark it
  stale; if an original proof cannot be recovered, retain the historic record
  as `unreproducible` and issue a separately labeled new proof rather than
  fabricating old hashes.
- **Public/runtime state stays clean.** Internal evidence identifiers and
  hashes belong in planning/evidence records, never serialized into public lab
  JSON or client durable state.

## F08 entry gate and handoff

Before any future F08 candidate work, capture a new authoritative input
snapshot after the accepted F01--F07 changes, verify every predecessor's
review/integration status from `ORCHESTRATION_STATUS.json`, and make the F08
candidate write scope explicit. The candidate then requires a new independent
Sol/xhigh review/refinement before any authoritative copy. It must report
source/static acceptance, pending runtime/test/browser verification, unresolved
source decisions, authoring counts versus compiled impact, and
historical-unreproducible evidence as separate fields.

This preparation has no current pass counts and does not alter the original
twelve-cycle ledger, baseline, overlay, audit, reconciliation, or closure.
