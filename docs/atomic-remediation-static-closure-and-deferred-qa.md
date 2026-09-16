# Atomic Remediation Static Closure and Deferred QA

Date: 2026-08-06

## Outcome

Cycles 06–13 are consolidated and implemented. The three previously non-implemented activity cycles
were connected to the plan's unresolved shared-input, scientific-state, and atomic-identity issues:
those issues were added to the owning remaining cycles and resolved during their implementation.
The remediated active flows now have complete interaction, atom, role, visual-state, and build-time
source-trace contracts. No baseline was regenerated to conceal retained historical findings.

## Final static inventory

| Item | Count |
|---|---:|
| Catalog labs | 17 |
| Catalog techniques | 40 |
| Authored actions | 1,498 |
| Atomic definitions | 109 |
| Equipment roles | 70 |
| Visual states | 91 |
| Composites | 7 |
| Realistic-asset dispositions | 120 |
| Image aliases | 3 |
| Canonical source traces | 591 |

The content checker reports 77/77 self-fixtures, 91 retained findings, 0 new findings, 0 changed
fingerprints, and 387 resolved baseline entries. Generated `docs/atomic-steps.md` is current.

## Retained-debt disposition

| Rule | Count | Classification |
|---|---:|---|
| `action/atom-identity-missing` | 69 | 50 actions are in unreferenced legacy/catalog techniques; 19 are confined to the two legacy demo labs and their generic imported techniques. None belongs to a remediated active investigation flow. |
| `action/declared-but-unreferenced` | 3 | Deliberate optional crystal-violet extension actions outside the required root process. |
| `action/imported-but-unreferenced` | 5 | Retained demonstration/presentation imports outside their local process graphs. |
| `corpus/action-id-collision` | 14 | Contextual owner-local IDs; owner-qualified identities are unambiguous. |

The 69 atomless actions are distributed as follows: `thermal-decomposition-mass-loss` 14,
`transmittance-dilution` 11, `filtration` 6, `beers-law-calibration` 5, `hard-water-demo` 4,
`brass-spectrophotometry` 4, `intro-filtration-demo` 3, `crystal-violet-kinetics` 3,
`hard-water-gravimetry` 3, and 2 each in `bonding-solids-tests`, `dilution`, `drying`,
`making-solution`, `measuring-volume`, `tablet-separation`, `transfer`, and `weighing`.

Investigation 7 is the one dated source whose corresponding legacy technique remains in this
classification: `thermal-decomposition-mass-loss` is not imported by the active
`green-chemistry-mixture-purification` lab. Its 14 entries remain visible baseline debt rather than
being retroactively assigned atoms without an implemented active workflow.

## Fourteen-investigation source crosswalk sample

The basis values below are copied verbatim from the build-time trace registry. `M` is manual-stated,
`F` is figure/table-supported, `R` is real-life implicit, and `C` is a configuration choice. Compound
bases are preserved; a `C` point stays configured or blocked rather than silently decided.

| Investigation | Dated source / sample step | Owner and action | Atom / basis | Fidelity constraint retained |
|---:|---|---|---|---|
| 1 | `sports-drink-blue-dye-spectroscopy_2026-07-27.md`, P-09 | `technique:blue1-percent-transmittance/i1-r10-0-fill-cuvette` | `atom.transfer.fill-cuvette`, M/R | Measured mixture and cuvette handling remain separate from inferred concentration. |
| 2 | `how-can-color-determine-copper-in-brass_2026-07-27.md`, BRASS-00 | `lab:brass-colorimetry/tare-empty-beaker-action` | `atom.weigh.tare-vessel`, F/R | Hazard approval, quantitative rinses, and student calculations stay explicit. |
| 3 | `what-makes-hard-water-hard_2026-07-27.md`, GRAV-04 | `technique:gravimetric-vacuum-filtration/attach-practice-filter-flask` | `atom.place.filtration-receiver`, F | Drying/cooling gates precede mass evidence; uncertainty is calculated from measurements. |
| 4 | `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md`, IQ-04 | `technique:beverage-ph-volume-titration/assemble-burette-setup` | `atom.place.mount-burette`, M | Beverage identity and procedure choices remain teacher-configured. |
| 5 | `sticky-question-paper-chromatography_2026-07-27.md`, TR-02 | `lab:paper-chromatography/add-water-solvent` | `atom.transfer.charge-developing-chamber`, M/C | Solvent choice is not invented; safety and chamber chronology are enforced. |
| 6 | `bonding-in-unknown-solids_2026-07-27.md`, K-02 | `lab:bonding-unknown-solids/inv6-known-dispense-aqueous-microsample` | `atom.transfer.microsample-portion`, R/C | Fresh microsamples and non-destructive-before-destructive ordering are preserved. |
| 7 | `purify-a-mixture-green-chemistry_2026-07-27.md` | `technique:thermal-decomposition-mass-loss` | no active canonical atom trace; classified legacy | The 14-action legacy technique is not imported by the active lab and remains visible debt pending a separately authorized implementation. |
| 8 | `hydrogen-peroxide-redox-titration_2026-07-27.md`, ST-01 | `lab:hydrogen-peroxide-redox-titration/place-redox-stand` | `atom.place.burette-support`, R/C | Reagent identity, acidification, endpoint evidence, and hazard configuration remain gated. |
| 9 | `quick-ache-relief-component-separation_2026-07-27.md`, E-01 | `technique:quick-ache-extraction-recovery/qar-record-starting-mass` | `atom.weigh.solid-portion`, M/R | Recovery evidence stays measurement-based; extraction choices and uncertainty remain explicit. |
| 10 | `how-long-will-that-marble-statue-last_2026-07-27.md`, T-02 | `lab:marble-statue-kinetics/assemble-gas-apparatus` | `atom.place.gas-collection-apparatus`, M | Trial controls, reactant mass linkage, gas evidence, and model precision are distinct. |
| 11 | `crystal-violet-rate-law_2026-07-27.md`, C-02 | `technique:crystal-violet-micromolar-dilution-series/cv11-measure-stock-05` | `atom.measure.variable-volume`, M | Calibration and rate-law conclusions derive from recorded inputs; optional branches require approval. |
| 12 | `hand-warmer-design-challenge_2026-07-27.md`, CAL-01 | `technique:hand-warmer-calorimetry/CAL-01` | `atom.place.assemble-calorimeter`, F/R | Calorimeter constant, temperatures, masses, time, and design decisions stay entered/configured rather than hard-coded. |
| 13 | `equilibrium-rainbow-display_2026-07-27.md`, CUCL-01 | `technique:equilibrium-rainbow-inquiry/copper-chloride-weigh-solid` | `atom.weigh.solid-source-vial`, M | Approximate mass language, approved stresses, qualitative color evidence, and teacher review are preserved. |
| 14 | `acid-base-titration-curves_2026-07-27.md`, T-03 | `technique:titration-curve-analysis/measure-curve-analyte` | `atom.measure.variable-volume`, M | Curve evidence remains tied to measured analyte/titrant data and configured acid/base context. |

## Basic validation executed

| Check | Result |
|---|---|
| `npm run content:docs` | Pass; generated atomic documentation is current. |
| `npm run content:check` | Pass; 77/77 self-fixtures, 0 new, 0 changed fingerprint, 387 resolved. |
| `node scripts/verifyCycle07Brass.mjs` | Pass; 102/102 checks. |
| `node scripts/verifyCycle12ScientificActivities.mjs` | Pass; 180/180 checks. |
| `node scripts/verifyCycle06Spectroscopy.mjs` | Pass; 470 invariants. |
| `node scripts/verifyCycle08Gravimetry.mjs` | Pass; 131/131 checks. |
| `node scripts/verifyCycle09Titration.mjs` | Pass; 315/315 checks. |
| `node scripts/verifyCycle10Separation.mjs` | Pass; 685/685 checks. |
| `node --check` for changed `.mjs` files | Pass; 12 changed scripts parsed successfully. |
| `npm run typecheck` | Pass; `tsc -b` exited 0. |
| `node scripts/auditContentInventory.mjs` | Pass; confirms 17 labs, 40 techniques, 1,498 actions, no unresolved action references, no unclassified assets, and no unverified composites. |
| Targeted JSON parse | Pass; status, registries, and all 57 public lab/technique JSON files parsed (64 files total). |
| Narrow `git diff --check` | Pass for remediation plan, audit/registry/docs, public labs/techniques, scripts, and `src`; only the existing CRLF-to-LF warning for `meta_plan.md` was printed. |

## Deferred dynamic QA matrix

Every cell below is intentionally **not run** under the repository validation policy.

| Route/workflow | Pointer | Keyboard/accessibility | Gesture | Invalid action | Reset | Browser/runtime | Visual |
|---|---|---|---|---|---|---|---|
| Blue 1 and crystal-violet spectroscopy | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Brass spectroscopy and hazardous preparation | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Hard-water gravimetry | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Redox and acid-base titration | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Chromatography and component separation | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Bonding tests and marble kinetics | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Equilibrium rainbow inquiry | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| Hand-warmer calorimetry | Not run | Not run | Not run | Not run | Not run | Not run | Not run |

No Vitest or other automated test was executed. No full test suite, build, browser, Playwright/E2E,
camera/gesture, performance, or mobile QA was executed. These are deferred release-confidence checks,
not implied passes.
