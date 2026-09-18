# Lab Studio catalog fidelity follow-up

Date: 2026-09-08. Reviewed source HEAD: `2468e47`.

Status: proposed implementation plan; no implementation or execution acceptance is claimed.

This is a separate follow-up package, with cycles F01–F08. It does not renumber, reopen, or rewrite the completed twelve-cycle ledger. The existing untracked `CONTINUATION_POST_CYCLE_12_RESIDUAL_DEBT.md` is preserved.

## Corrected verdict and evidence boundary

The twelve cycles delivered a substantial composition migration. Their recorded compiler witnesses and reconciliation support structural acceptance under the declared configurations. They do not establish complete scientific fidelity, runtime completion, or satisfaction of every original requirement. Physical atomic identity and evidence continuity were original requirements, not merely unrelated maintenance debt.

This review used native file/shell reads. No skills, MCP servers, tests, builds, browser checks, generators, or reconciliation commands were run. The attached report's numerical execution claims have not been independently reproduced. Historical counts are starting references, not acceptance targets. This document is the only new artifact from this review.

Corrections to the preceding assistant verdict:

1. **Existing effect enforcement was understated.** `src/domain/atomRegistry.ts::deriveActionEffectContract` already derives effects from atoms and handlers. `src/domain/compositionValidation.ts` checks legacy effect declarations against those derived effects. Extend those mechanisms; do not create a second classifier. The demonstrated hole is acceptance of physical/acquisitive atomless technique actions with matching legacy metadata, combined with the content checker's verb-based identity rule.
2. **Restoring equilibrium tests is not a traversal proof.** `src/runtime/__tests__/equilibriumStress.test.ts` reads the raw lab at module scope, but its action helper also assigns `currentNodeId` directly. Repairing loading restores useful selected-action coverage; it does not prove a learner can reach those actions through the process.
3. **Witness coverage is finite.** The collector compiles declared witnesses and supplies illustrative setup values, including special green-chemistry overrides. This establishes selected configurations, not all possible teacher settings. An unobserved branch cannot be pronounced dead merely because no current witness selects it.
4. **Traceability totals were characterized too narrowly.** `action/source-trace-missing` applies to qualifying atom-backed actions, not exclusively measurement acquisition. Missing entries do not prove absent source authority; source overlays and the designated plans must be checked first. Adding missing atoms may expose additional missing traces, so a temporary increase in findings is not automatically a regression.
5. **Strict validation needs a compatibility boundary.** The original plan retains legacy/self-contained imports. A global atom requirement in the generic reader could break that promise. Strict bundled-catalog acceptance and legacy readability must remain separate.
6. **The generator defect is an evidence gap, not proof of unauthorized writes.** Its dependency copy is incomplete; its snapshots inspect only `public/` and compute changes from the after-file list. Fix deletions and scope coverage. A before/after snapshot still cannot prove no transient write occurred and was reverted; call it final filesystem-delta evidence unless actual write tracing is added.
7. **Evidence categories must not be conflated.** The closure already discloses static-only reachability, 99 atomless physical/acquisitive rows, 19 unbound weighing actions, and the 42-index/41-owner relationship. Its blanket pre-existing-debt wording needs correction, but it does not claim a clean runtime release. A source manual basename in `sourceBoundary` is public provenance data to assess against policy, not automatically a secret or an absolute local-path leak.
8. **The previous cycle grouping was too broad.** It combined strict enforcement with a large content migration, deferred source work too long, and lacked a safe transition. The cycles below have narrower dependencies and explicit stop conditions.

## Governing decisions

- Preserve the current compiler, flat runtime representation, exact-version references, public IDs, and custom-route adapters unless a confirmed defect requires a bounded change.
- Work only within Lab Studio. Preserve sibling projects and unrelated dirty files. No commit, push, deployment, cleanup deletion, or historical evidence rewriting is implied.
- Use sequential cycles by default. A planning ledger's historical separate-review requirement is not authorization to create tasks or delegate in this review.
- Generated content changes through its authoritative generator/input. Update referenced versions and regenerate affected consumers when the repository's version contract requires it; do not edit generated JSON alone.
- Keep strict catalog acceptance separate from legacy import compatibility. Do not let public JSON opt out of strict catalog checks through a self-declared flag.
- Do not write a fresh baseline to hide findings. Record genuine repairs, newly detected existing issues, semantic regressions, false positives, and unresolved source decisions separately.
- Physical source decisions use the designated plans and their M/F/R/C classifications. Inspect local authority first. If the exact instrument manual or required source is unavailable, identify it and block only the dependent scientific decision; do not invent it.

## Validation policy

The current repository policy permits source review and basic static checks/basic linting. This request does not authorize detailed tests or broad validation.

Each cycle records implementation state and verification state separately. Suggested states are `planned`, `implemented-static-reviewed`, `verification-pending`, `verified-with-explicit-scope`, and `blocked-for-source`. Record the actual checks, environment, exit status, and limitations. A cycle requiring runtime evidence cannot claim runtime acceptance while those checks remain unrun.

Future, explicit execution authorization should name maintained checks and affected tests. Full-suite runs and browser checks remain separately scoped. Test execution must have bounded duration and honest collection accounting; do not repeat an unbounded run merely to obtain a green headline. A hung run is incomplete, not passing. Browser checks, if later authorized, target tablet/laptop/desktop only and only the changed interaction paths.

Generator scenario execution is a behavioral check, even if launched through a script named `check`. Witness generation writes evidence. Run such commands only within the authorized future cycle's scope; do not treat all scripts as read-only lint.

## F01 — Restore trustworthy checks and production test loading

**Dependencies:** none.

**Primary surfaces:** `vite.config.ts`, `package.json` only as needed, `scripts/checkCycle04GeneratorContracts.mjs`, `src/data/compositionStaticFixtures.ts`, a shared test-support module, and the individually affected test files.

**Work:**

- Inventory maintained tests and check scripts without assuming the attachment's 138 files or 30 scripts are the correct live denominator. Give each a purpose, owner, invocation, historical/current classification, and expected evidence scope.
- Set explicit test discovery for maintained paths, preserving intentional script tests and existing test categories. Exclude the stale nested project from discovery without deleting it. Report discovered, collected, executed, skipped, collection-failed, worker-failed, and incomplete files separately.
- Separate test-runner startup/resource failures from content assertions. Adjust worker settings only against evidence; do not promise one concurrency setting cures every failure.
- Repair generator sandbox dependencies with a documented dependency inventory. Compare the union of before/after paths, including deletions, across the copied sandbox scope. Allow only named intended output deltas. Keep full-default parity and targeted-generation ownership as different assertions. Preserve historical proofs at their historical revisions rather than simply re-pinning them to new output.
- Replace the future-version fixture's now-supported `1.6` with an actually unsupported version, keeping positive checks for supported versions. Ensure a failure does not misleadingly imply all remaining assertions ran.
- Add a test harness that calls the production `loadBundledLab` with controlled public-resource fetches and explicit setup fixtures. Address module-scope loading and cache isolation. Preserve separate raw-source validation and legacy hydration tests.
- Migrate Protocol Check, bundle/migration, and equilibrium consumers one at a time. Preserve test intent, including expected-answer isolation, invalid setup, offline fallback boundaries, and exact-version failure behavior. Do not replace them with compilation-only assertions.

**Acceptance:** source/static review confirms the architecture and discovery boundary. When execution is authorized, every discovered maintained file has an explicit outcome; no startup or collection failure disappears into a pass count. Loading fixes do not waive teacher approval. Residual assertion failures are individually classified; no blanket promise that a helper restores entire suites.

## F02 — Make content diagnostics composition-aware

**Dependencies:** F01's setup fixture and loader contract decisions.

**Primary surfaces:** `scripts/checkContentConsistency.mjs`, `scripts/collectCycle12CompileWitness.mjs`, `scripts/reconcileCycle12Catalog.mjs`, and the existing composition APIs.

**Work:**

- Retain raw/template checks for unresolved template structure, registry validity, owner/source pointers, and authoring requirements. Evaluate concrete bindings, evidence references, equipment identity, and order-dependent rules on compiled instances.
- Reuse production compiler/setup semantics. Extract reusable collection logic from the witness script if needed; do not import a command whose top level writes an artifact.
- Give compiled findings a lab ID, configuration/witness ID, instance ID, exact technique version, original action ID, and compiled action/node IDs. Report unique authoring defects separately from affected compiled instances.
- Review declared branch coverage. Add representative missing variants only where valid setup is known. For numeric settings, label boundary/representative coverage rather than claiming exhaustive coverage. Keep unresolved and unrepresented variants visible.
- Use the report's retracted cases as targeted diagnostic examples: wavelength substitution, blanking order in calibration, cuvette identity, and solvent-before-reading order. Confirm each from current compiled semantics before recording an expected result.
- Preserve checker self-fixtures, but do not use a generated audit to prove its own correctness. Include independently authored small failing/passing examples for changed rules.

**Acceptance:** each composition-dependent finding identifies the concrete evaluated configuration or is explicitly inconclusive. Findings do not disappear merely because a technique has no current lab consumer. Declared witness coverage and its limits are recorded.

## F03 — Close the identity and mass-contract gaps safely

**Dependencies:** F02 classification and impact inventory.

**Primary surfaces:** `src/domain/atomRegistry.ts`, `src/domain/compositionValidation.ts`, `src/domain/validation.ts`, and shared checker integration.

**Work:**

- Add a reusable bundled-content policy check around existing effect derivation. Require a valid atom for physical/acquisitive bundled actions, including `observe` and `reset` when their actual handler semantics require it. Preserve legitimate nonphysical legacy effect declarations.
- Promote weighing output checks from lane scripts into the shared contract. Validate output identity, mass unit, and whether downstream consumers reference the same scoped evidence. Keep source-approved unsupported capability blocks explicit and non-executable where execution cannot be supported.
- Stage rollout: first expose complete diagnostics and fail on new or materially changed unresolved violations; retain an explicit owner-scoped migration list for existing cases. This list is internal migration evidence, not a rewritten content baseline or a public bypass.
- After F04/F05 repairs, switch strict bundled acceptance to reject all remaining unapproved physical identity/mass-output gaps. Preserve generic legacy import readability and detached-export semantics.

**Acceptance:** no second verb/prose classifier is introduced. Existing legacy declarations continue to be checked against derived effects. The transition has exact owned entries and a removal condition, rather than permanently granting blanket exemptions. Affected labs are not inadvertently made unloadable halfway through migration.

## F04 — Repair measured mass from acquisition through consumption

**Dependencies:** F03 diagnostic contract; source review for the affected operation.

**Primary surfaces:** marble kinetics generator/input and technique; the remaining weighing owners; `src/runtime/reducer.ts` only if a shared runtime defect is demonstrated.

**Work:**

- Repair marble's weighing output and replace its unused `massMeasurementId` convention with the existing typed `mass` contract. Its measured value must drive the transfer, stock depletion, and downstream model where the procedure depends on that mass.
- Review the existing resolver: it currently resolves measurement references by ID and gram units, not by a general freshness/producer check. Verify scoped identity, reset/repeat behavior, and producer ordering before claiming stale/wrong-trial protection.
- Verify that Student Player controls submit learner input through the normal runtime path. Do not make a measurement appear by directly inserting it into state.
- Remove hard-coded configurable quantities from marble instructions and hints using existing presentation binding mechanisms. Derive time-window language from the selected series, not a fixed 15 seconds.
- Repair the other recorded weighing gaps in separate owner batches. Prioritize green chemistry and live consumers, then indexed standalone practices. An unused standalone technique remains a supported catalog surface unless formally deprecated.

**Acceptance:** a permitted measured mass different from the teacher target is preserved end-to-end; missing/invalid evidence rejects; source depletion is consistent; repeated trials cannot silently consume a prior trial's evidence. Add focused coverage, executing it only under the explicit validation scope. Counts of unbound outputs reflect repairs, not substitutions with arbitrary defaults.

## F05 — Repair scientific operations, identities, and compatibility

**Dependencies:** F02/F03; F04 where quantities feed these operations.

**Primary surfaces:** affected generator inputs, technique files, atom/role registry entries, import/export paths only as required.

**Work in bounded batches:**

1. Bind remaining physical/acquisitive actions to truthful atoms, starting with live consuming labs. Do not reuse an atom solely to reduce the missing-identity count. Recheck whether newly atom-backed actions now expose traceability gaps.
2. Inspect the designated spectroscopy procedure and instrument assumptions. Specify the required blank/reference conditioning and invalidation when wavelength changes. Add steps or a justified method-specific exemption only after that decision. Preserve already-correct calibration order.
3. Correct disposal destination roles and product-recovery operation semantics. Repair stale operation examples against current owner/action/version identities, preserving deliberate legacy aliases.
4. Resolve the chromatography source disagreement with an explicit source location and M/F/R/C disposition. Missing authority blocks that decision alone.
5. Trace crystal-violet embedded content through real import/export behavior. Generate compatible copies from one authority or remove unused carriers only after compatibility is established. Preserve approval gates and ID scope; corpus-level repeated IDs are not automatically compiled collisions.
6. Review `sourceBoundary` publication against the intended public provenance contract. Keep useful human-readable citations if allowed; move internal source filenames/paths to internal trace metadata where required. Check actual serialized surfaces. Do not equate a basename with an exposed filesystem path.

**Acceptance:** every batch lists affected owners, source decisions, generated outputs, reference/version updates, and remaining blocks. F03's strict bundled acceptance becomes enforceable only after the impacted migration set is repaired or explicitly source-blocked with truthful non-runnable status.

## F06 — Unify green-chemistry setup and establish bounded execution evidence

**Dependencies:** F01; F04/F05 fixes needed for the selected path. This cycle does not depend on clearing all editorial/provenance debt.

**Primary surfaces:** `src/data/labSetup.ts`, `src/investigations/purifyMixtureGreenChemistry/configuredComposition.ts`, its existing route/configuration UI, and runtime/adapter tests.

**Work:**

- Extract or reuse the existing approved-configuration type and validator through a dependency-safe shared module. Harden runtime validation of untrusted input, including text types and the tare-convention enum; TypeScript types alone are insufficient.
- Make the shared loader reject missing or placeholder setup and compile complete approved configuration. Route and shared-loader paths must apply the same binding rules. Reuse the existing route UI unless an actual additional entry path needs another form.
- Remove the witness collector's green-specific bypass once shared setup can represent the same illustrative fixture. Keep fixture values out of authored defaults and learner measurements.
- Add selected process traversal checks that start from legitimate initial state and reach the target through actual runtime intents. Keep isolated tests that jump to nodes, but label them as isolated action coverage.
- Cover producer/consumer continuity, prerequisite rejection, branch approval, reset/repeat isolation, and custom-route completion for the changed paths. Trace measurement, notebook, calculation, and action evidence separately. Unknown dependency semantics remain unverified, not inferred as a pass.

**Acceptance:** missing, malformed, and placeholder configuration cannot reach execution. Valid approved configuration produces equivalent bindings through both entry paths. Traversal evidence never pre-populates the evidence it claims the learner produced. No claim of all-lab playability follows from a few selected paths.

## F07 — Resolve provenance and student-facing presentation in owner batches

**Dependencies:** F02 for trustworthy trace inventory. Source gathering starts during F02 and feeds F04/F05; it is not postponed until this cycle.

**Primary surfaces:** `docs/architecture/source-trace-registry.json`, existing source overlays and generators, instruction/hint content, and affected visual-state registrations.

**Work:**

- First reconcile existing source overlays and preserved IDs; only then research genuinely missing authority. A procedural source step can support multiple meaningful atomic steps when each mapping is justified. Do not fabricate one citation per generated step or blanket-exempt owners as non-source-derived.
- Partition findings into missing locator, stale owner/action mapping, conflicting source interpretation, declared inference, teacher configuration, and unsupported scientific claim. Record named owners and dispositions.
- Reconcile the instruction rule with legitimate lab language. Separate the action instruction from rationale, teacher notes, hints, and scientific limitations. Do not mechanically move safety-critical instructions out of the student's immediate view.
- Repair missing visual-state registration for wet/dry residue and other confirmed fallback states. Reuse appropriate existing assets before proposing new generation. If new realistic assets are later authorized, follow the repository PNG/SVG consistency requirements and inspect them; this plan does not invoke an image service.
- Every batch has a finite owner/file/row list; no open-ended catalog prose rewrite. Resolve source conflicts before cosmetically rewriting their instructions.

**Acceptance:** supported actions have meaningful trace mappings; unresolved scientific cases stay explicit. Instruction clarity is assessed separately from punctuation. State changes remain distinguishable without claiming that visual feedback proves physical chemistry.

## F08 — Reconcile current evidence and close honestly

**Dependencies:** all preceding cycles' implemented scope and explicit dispositions.

**Primary surfaces:** current reconciliation/checker outputs, closure generator/documentation, this follow-up status evidence, catalog disposition records.

**Work:**

- Regenerate current witnesses and audits in their documented dependency order after authorized content changes; retain frozen predecessor snapshots. Check source identity, freshness, and deterministic agreement, not only total counts. Handle the existing Cycle 09 overlay/audit dependency explicitly.
- Replace fixed repository-health prose with current evidence input or an explicit unknown/stale status. Include command, environment, source identity, collection completeness, and check category. Keep internal hashes out of public runtime state.
- Reconcile current ownership, indexed carriers, deprecated/unindexed files, and the revision-10 amendment impact record without rewriting historical revision identities or inventing historical checksums. If original evidence cannot be recovered, mark the historical proof unreproducible and issue a new current proof.
- Classify the unused carrier, settings file, screenshots, and nested backup. Exclude non-runtime artifacts from applicable discovery. Deletion or relocation of user files is a separately named cleanup decision, not a prerequisite for fidelity acceptance.
- Report structural composition, atomic identity, evidence continuity, scientific provenance, setup/import compatibility, visual/editorial status, and executed verification independently.

**Acceptance:** no residual requirement is renamed unrelated merely because a previous cycle lacked ownership. No all-tests-passing claim includes collection failures or unexecuted files. No all-configurations claim is based only on declared witnesses. Each open item has a concrete owner, impact, reason, next action, and verification limit.

## Coverage of the attached report

| Report item | Planned disposition |
|---|---|
| 1. Runner and stale test loading | F01; actual traversal evidence in F06 |
| 2. Broken/historical checks | F01; current/historical evidence separation in F08 |
| 3. Pre-composition false positives | F02 |
| 4. Debt attribution | F02/F07 classification; F08 wording |
| 5. Atomic identity loophole | F03 policy; F05 migration |
| 6. Scan conditioning | F05 source-gated decision |
| 7. Marble mass and fixed instructions | F04 |
| 8. Crystal-violet duplicate | F05 compatibility review and repair |
| 9. Instructions | F07 |
| 10. Registry examples, disposal, recovery, source disagreement | F05 |
| 11. Executable reachability | F02 coverage accounting; F06 bounded traversal |
| 12. Inventory, ledgers, visuals, public metadata, clutter | F05/F07/F08; no automatic deletion |
| Existing handoff: all weighing gaps, green setup, wider provenance | F04/F06/F07 |

## Per-cycle handoff requirements

Record the initial source identity and scoped dirty state, exact allowed files and generators, confirmed finding IDs, implementation decisions, version/reference changes, source dispositions, verification performed, verification withheld by policy, and residual blockers. A source-blocked item does not block unrelated batches. The final review must evaluate behavior and semantics, not merely agreement among generated documents.

Recommended starting scope: F01 only, followed by F02. Do not activate every proposed cycle or alter the original completed ledger merely because this plan exists.
