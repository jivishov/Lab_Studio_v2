# Initial stock supply volumes

The user selected 1 L initial stock supplies for the previously unspecified liquid inventories. These are simulator setup quantities, not measured concentrations, analytical results or a claim about the source protocols.

- Blue #1 unknown sample and its dilution water: 1,000 mL each.
- Transmittance-dilution and Beer's-law stock and blank supplies: 1,000 mL each.
- Quick Ache property-test reagent supply: 1,000 mL.
- Brass assigned-salt A and B sample tubes: 5 mL each in the existing 20 mL test tubes. The authored scan uses two 1 mL conditioning portions and a 3 mL cuvette fill, then returns the scan portion after the series. Five millilitres supplies that sequence without overfilling the tube. It is an operational starting amount, not a new protocol measurement.

Lab sources and standalone technique sources repeat some inventories: ten bottle states and four test-tube states are updated across eight files. Other initial equipment and quantities remain unchanged.

The three explicit `*-bottle-1l` equipment variants have 1,000 mL capacities. Original sample, reagent and distilled-water bottle capacities remain unchanged. Named instance references, action equipment bindings, permitted composition roles and lab binding definitions follow the variants. Existing teacher configuration, confirmation, measurement and transfer rules remain in force; initial stock quantities do not complete those steps automatically.

The variants reuse ungraduated bottle-family silhouettes and clipped liquid geometry. Their labels and capacity data distinguish them; icon dimensions are illustrative and do not establish physical scale. No new photorealistic asset or physical-equipment validation is claimed.

`scripts/generatorInputs/stockSupplyVolumes.mjs` keeps maintained spectroscopy, transmittance and Quick Ache refiners consistent. It only changes the named inventories in this list. Blue #1 and Quick Ache in-place source definitions retain their updated source data. Historical one-shot migrations were not replayed or rewritten as current generators.

Validation for this change: static schema/source checks for the eight definitions, initial-volume/capacity checks, unchanged unrelated initial equipment, generator inventory agreement, visual-profile validation and application TypeScript no-emit check passed. The existing liquid-rendering regression now also asserts that initial volumes fit their containers. Detailed tests, a full build and browser checks were not run under the repository validation policy. Prior verification results describe an older source snapshot and are not a fresh test pass for this change.
