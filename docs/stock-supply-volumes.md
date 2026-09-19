# Initial stock supply volumes

The user selected 1 L initial stock supplies for the previously unspecified liquid inventories. These are simulator setup quantities, not measured concentrations, analytical results or a claim about the source protocols.

- Blue #1 unknown sample and its dilution water: 1,000 mL each.
- Transmittance-dilution and Beer's-law stock and blank supplies: 1,000 mL each.
- Quick Ache property-test reagent supply: 1,000 mL.
- Hand-warmer calorimetry distilled-water supply: 2,000 mL in the dedicated `distilled-water-bottle-2l` stock variant. This is an operational simulator supply for the authored 100 mL practice/calibration stages, not a source-protocol measurement.
- Brass assigned-salt A and B sample tubes: 5 mL each in the existing 20 mL test tubes. The authored scan uses two 1 mL conditioning portions and a 3 mL cuvette fill, then returns the scan portion after the series. Five millilitres supplies that sequence without overfilling the tube. It is an operational starting amount, not a new protocol measurement.

Lab sources and standalone technique sources repeat some inventories: ten bottle states and four test-tube states are updated across eight files. Other initial equipment and quantities remain unchanged.

The three explicit `*-bottle-1l` equipment variants have 1,000 mL capacities, and the hand-warmer-only `distilled-water-bottle-2l` variant has a 2,000 mL capacity. Original sample, reagent and distilled-water bottle capacities remain unchanged. Named instance references, action equipment bindings, permitted composition roles and lab binding definitions follow the variants. Existing teacher configuration, confirmation, measurement and transfer rules remain in force; initial stock quantities do not complete those steps automatically.

The variants reuse ungraduated bottle-family silhouettes and clipped liquid geometry. Their labels and capacity data distinguish them; icon dimensions are illustrative and do not establish physical scale. No new photorealistic asset or physical-equipment validation is claimed.

`scripts/generatorInputs/stockSupplyVolumes.mjs` keeps maintained spectroscopy, transmittance, Quick Ache, and hand-warmer refiners consistent. It only changes the named inventories in this list. Blue #1 and Quick Ache in-place source definitions retain their updated source data. Historical one-shot migrations were not replayed or rewritten as current generators.

Historical validation note: the earlier static-only report for the eight-definition inventory change covered an older source snapshot. It remains historical evidence and does not validate this hand-warmer correction or any later Item 3 package bytes.

Current Item 3 validation for this correction is recorded in the packaged build README and build record after the hand-warmer generator test, liquid-rendering regression, production build, and bounded desktop smoke are run. That evidence is limited to the authorized local Windows human-test scope; it does not claim scientific, classroom, release, deployment, mobile, performance or security acceptance.
