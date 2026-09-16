# Scientific Fidelity and Protocol Check Boundary

Status: source reviewed and typechecked through Cycle 05; deterministic, browser, viewport, accessibility, and real-agent execution are **UNRUN** unless a cited Cycle 01 handshake explicitly says otherwise.

## Supported claim

Lab Studio can compile and rehearse one training family: estimate the molarity of a **synthetic monoprotic-acid sample** using standardized NaOH, a modeled 1:1 stoichiometric ratio, a graduated-cylinder aliquot, and a phenolphthalein endpoint.

Use “estimate molarity,” not “determine with analytical accuracy.” The supported family uses a modeled graduated cylinder rather than a volumetric pipette.

## M/F/R/C evidence ledger

- **M — project source:** the hydrated `acid-base-titration@2.2.1` definition, pinned `titration-endpoint@2.1.2`, current equipment catalog, runtime resolver/reducer, and current validators provide the verified implementation basis.
- **F — external figure/table:** none. No external figure or table supplies a hidden sample result.
- **R — disclosed reconstruction:** the Composer selects an indicator-only 12-node sequence, begins with a modeled prefilled burette, derives deterministic IDs/model values, and omits conditioning/filling/funnel and pH-confirmation branches.
- **C — current request/inventory:** audience, objective, duration, delivery context, aliquot choice, declared standardized NaOH concentration/quantity, apparatus counts, and facility declarations.

Configured values, simulator-generated state, learner-recorded evidence, and calculated molarity remain distinct. The synthetic preset is compiler-owned; it is not an external measurement.

## Modeled

- Deterministic 1:1 synthetic monoprotic-acid/NaOH equivalence and endpoint drop plan.
- Aliquot, initial/final burette evidence, persistent pale-pink endpoint evidence, and molarity calculation prerequisites.
- Capacity and inventory-quantity checks for the bounded family.
- Ordinary resolver/reducer acceptance, rejection, recovery, reset, and evidence transitions.
- Coarse titration as a bounded sequence of ordinary drop intents that stops at the fine-window boundary; one-drop and endpoint acceptance retain ordinary runtime semantics.

## Procedural only

For `physical_procedure_rehearsal`, the virtual sequence rehearses supported handling steps for an external unknown. It does **not** characterize the external sample, verify the physical room, approve a method, or authorize laboratory work.

Facility fields record what the user declared about splash goggles, eyewash, spill-response materials, and compatible base-waste handling. They are readiness inputs, not a comprehensive safety review, SDS review, SOP, regulatory finding, or certification.

## Unsupported or excluded

- Arbitrary reactions or experiment families.
- Full pH curve, acid-base equilibrium, indicator equilibrium, activity coefficients, and temperature effects.
- Quantitative pH-meter confirmation. The optional P1 pH module remains omitted.
- External physical-sample concentration or identity.
- Glassware calibration uncertainty and detailed parallax/meniscus skill beyond configured tolerances.
- Analytical validation, secure high-stakes assessment, comprehensive safety review, regulatory qualification, or physical authorization.

## Content conservation

Cycle 04 implemented proportional ordinary liquid/solution solute splitting for bounded `measureVolume`, ordinary liquid `transfer`, and titration-drop movement, including zero-volume handling and same-solute ID/unit merging. Specialized thermal, precipitate, filtration, rinse/dry, solid, chromatography, and kinetics branches retain their owning behavior and are intentionally excluded from the pivot.

This implementation is present in source, but its focused Vitest and unrelated-lab regression checks are **UNRUN**. Therefore conservation is an implemented source behavior, not yet executed release evidence.

## Static-client answer limitation

Learner UI and rehearsal outputs omit analyte ground truth, endpoint count, expected result, private fingerprints, and the full staged definition. A technically sophisticated user can still inspect bundled JavaScript or client state. The app makes no claim of cryptographic secrecy and positions the generated lab as practice/training rather than secure high-stakes assessment.

## Protocol Check

Protocol Check executes exactly ten declared cases against isolated fresh runtime state:

1. `schema_valid`
2. `interaction_contracts_valid`
3. `inventory_roles_resolved`
4. `titration_model_derives`
5. `happy_path_completes`
6. `wrong_target_rejected`
7. `early_endpoint_rejected`
8. `premature_calculation_rejected`
9. `reset_restores_initial_state`
10. `limitations_present`

Stateful cases use the ordinary intent resolver, reducer, and interaction-sequence helper. Protocol Check does not mutate the human rehearsal attempt. A passing report unlocks human Apply only when its complete private guard still matches the exact non-stale stage.

Protocol Check is not scientific proof, analytical certification, a comprehensive safety or pedagogical review, external-sample characterization, or authorization for physical work. The 10/10 default run is currently authored deterministic source and **UNRUN**.
