# Atomic Steps

<!-- Generated from src/domain/atomRegistry.json and src/domain/equipmentRoleRegistry.json.
     Do not edit by hand. Regenerate with:
       node scripts/generateAtomicStepsDocs.mjs -->

`src/domain/atomRegistry.json` is the machine-readable source of truth for atomic identity. `docs/atomic-steps.md` is generated from it and must never be hand-edited. An atom constrains behaviour, allowed interaction types, required equipment roles, prerequisites, and evidence. It never constrains the learner-facing action label: documentationLabel is documentation, not required wording.

Seed scope: Cycle 02 seeds the families the plan names: filtration, weighing, measurement, spectrophotometry, titration, chromatography, kinetics, equilibrium, and calorimetry. It deliberately does not backfill every authored action; existing unannotated physical actions are carried as stable baseline identifiers in scripts/content-consistency-lint-baseline.json.

## Basis legend

| Label | Meaning |
|---|---|
| `M` | Manual-stated |
| `F` | Figure- or table-supported |
| `R` | Real-life implicit |
| `C` | Configuration choice |

A compound basis such as `M/F` or `R/C` is recorded verbatim and never simplified.

## Source table kinds

| Kind | Meaning |
|---|---|
| `phase` | A procedure-phase table (`ID | Atomic student action | Basis | ...`). It has an explicit Basis column, copied here verbatim. |
| `apparatus` | An apparatus-assembly table (`State | Atomic action | Resulting composite | Validation | Asset disposition`). It has NO Basis column, so citing one as `M` would assert the manual states that exact step. An apparatus row is table-supported: its basis must include `F`, compounded with any marker the row carries inline. The content checker enforces this. |
| `safety` | A numbered safety-prerequisite row (`S-NN`) whose inline M/F/R/C marker is copied verbatim. Safety IDs are a separate namespace from procedure-phase IDs with the same text. |

## Atoms

200 atoms across 15 families.

| Atom | Family | Verb | Interactions | Required roles |
|---|---|---|---|---|
| `atom.weigh.tare-vessel` | weighing | `weigh` | `readInstrument` | `balance-instrument`, `weighed-vessel` |
| `atom.weigh.solid-portion` | weighing | `weigh` | `readInstrument` | `balance-instrument`, `weighed-vessel` |
| `atom.weigh.vessel-supported-balance-display` | weighing | `weigh` | `readInstrument` | `balance-instrument`, `weighed-vessel` |
| `atom.weigh.dry-assembly` | gravimetry | `weigh` | `readInstrument` | `balance-instrument`, `dried-assembly` |
| `atom.dry.oven-stage` | gravimetry | `dry` | `placeInInstrument` | `drying-instrument`, `dried-assembly` |
| `atom.cool.before-weighing` | gravimetry | `cool` | `placeInInstrument` | `dried-assembly` |
| `atom.transfer.solid-portion` | gravimetry | `transfer` | `pourInto` | `solid-reagent-source`, `receiving-vessel` |
| `atom.dissolve.solid-in-solvent` | gravimetry | `dissolve` | `pourInto` | `receiving-vessel` |
| `atom.transfer.precipitating-reagent` | gravimetry | `transfer` | `pourInto` | `precipitating-reagent-source`, `precipitation-vessel` |
| `atom.precipitate.form-gravimetric-solid` | gravimetry | `precipitate` | `pourInto` | `precipitation-vessel` |
| `atom.weigh.filter-medium-tare` | gravimetry | `weigh` | `readInstrument` | `balance-instrument`, `filter-medium` |
| `atom.place.transfer-medium-to-drying-vessel` | gravimetry | `place` | `snapIntoTarget` | `filter-medium`, `dried-assembly` |
| `atom.measure.variable-volume` | measurement | `measureVolume` | `pourInto`, `readInstrument` | `variable-volume-measuring-device`, `liquid-source` |
| `atom.measure.fixed-volume-aliquot` | measurement | `measureVolume` | `pourInto` | `fixed-volume-delivery-device`, `liquid-source` |
| `atom.transfer.measured-liquid` | measurement | `transfer` | `pourInto` | `measured-solvent-source`, `receiving-vessel` |
| `atom.rinse.quantitative-transfer` | measurement | `rinse` | `rinseTarget` | `rinse-water-source`, `rinsed-vessel` |
| `atom.place.filtration-support` | filtration | `place` | `dragToZone`, `snapIntoTarget` | `filtration-support` |
| `atom.place.filtration-funnel` | filtration | `place` | `dragToZone`, `snapIntoTarget` | `filtration-funnel` |
| `atom.place.filter-medium` | filtration | `place` | `snapIntoTarget` | `filtration-funnel`, `filter-medium` |
| `atom.rinse.wet-filter-medium` | filtration | `rinse` | `rinseTarget` | `rinse-water-source`, `filter-medium` |
| `atom.place.filtration-receiver` | filtration | `place` | `dragToZone`, `snapIntoTarget` | `filtration-receiver` |
| `atom.filter.pour-through-medium` | filtration | `filter` | `pourInto` | `mixture-source`, `filtration-funnel` |
| `atom.rinse.wash-precipitate` | filtration | `rinse` | `rinseTarget` | `rinse-water-source`, `filter-medium` |
| `atom.place.filtration-vacuum-source` | filtration | `place` | `dragToZone`, `snapIntoTarget` | `filtration-vacuum-source` |
| `atom.place.photometer` | spectrophotometry | `place` | `dragToZone` | `photometer-instrument` |
| `atom.transfer.fill-cuvette` | spectrophotometry | `transfer` | `pourInto` | `sample-source`, `photometer-sample-holder` |
| `atom.place.insert-cuvette` | spectrophotometry | `place` | `snapIntoTarget` | `photometer-instrument`, `photometer-sample-holder` |
| `atom.observe.blank-photometer` | spectrophotometry | `observe` | `readInstrument` | `photometer-instrument`, `photometer-sample-holder` |
| `atom.observe.read-photometer` | spectrophotometry | `observe` | `readInstrument` | `photometer-instrument` |
| `atom.place.burette-filling-funnel` | titration | `place` | `snapIntoTarget` | `titrant-delivery-device`, `burette-filling-funnel` |
| `atom.place.remove-burette-filling-funnel` | titration | `place` | `dragToZone` | `titrant-delivery-device`, `burette-filling-funnel` |
| `atom.place.mount-burette` | titration | `place` | `snapIntoTarget` | `titrant-delivery-device`, `burette-support` |
| `atom.rinse.condition-burette` | titration | `rinse` | `rinseTarget` | `titrant-source`, `titrant-delivery-device` |
| `atom.transfer.add-indicator` | titration | `transfer` | `dispenseDrops`, `pourInto` | `indicator-source`, `analyte-receiver` |
| `atom.transfer.deliver-titrant` | titration | `transfer` | `dispenseDrops` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.measure.read-burette` | titration | `measureVolume` | `readInstrument` | `titrant-delivery-device` |
| `atom.transfer.discard-titrated-mixture` | titration | `transfer` | `pourInto` | `analyte-receiver`, `waste-receiver` |
| `atom.place.burette-support` | titration | `place` | `dragToZone`, `snapIntoTarget` | `burette-support` |
| `atom.place.titration-receiver` | titration | `place` | `snapIntoTarget`, `dragToZone` | `analyte-receiver` |
| `atom.transfer.fill-burette` | titration | `transfer` | `pourInto` | `titrant-source`, `titrant-delivery-device` |
| `atom.transfer.acidify-analyte` | titration | `transfer` | `pourInto` | `acidifying-reagent-source`, `analyte-receiver` |
| `atom.place.probe-instrument` | titration | `place` | `dragToZone` | `immersed-probe-instrument` |
| `atom.place.immersed-ph-probe` | titration | `place` | `snapIntoTarget`, `dragToZone` | `immersed-probe-instrument`, `immersed-probe-vessel` |
| `atom.observe.read-titration-ph` | titration | `observe` | `readInstrument` | `immersed-probe-instrument`, `immersed-probe-vessel` |
| `atom.transfer.charge-developing-chamber` | chromatography | `transfer` | `pourInto` | `liquid-source`, `developing-chamber` |
| `atom.spotSample.apply-baseline-spot` | chromatography | `spotSample` | `spotOnto` | `spotting-tool`, `stationary-phase` |
| `atom.developChromatogram.develop-strip` | chromatography | `developChromatogram` | `snapIntoTarget` | `stationary-phase`, `developing-chamber` |
| `atom.place.gas-collection-apparatus` | kinetics | `place` | `snapIntoTarget` | `reaction-vessel`, `gas-delivery-connector`, `gas-collection-instrument` |
| `atom.record.timed-gas-volume` | kinetics | `record` | `recordTimeSeries` | `gas-collection-instrument`, `timing-instrument` |
| `atom.stressEquilibrium.reagent-stress` | equilibrium | `stressEquilibrium` | `pourInto` | `stress-reagent-source`, `equilibrium-vessel` |
| `atom.stressEquilibrium.thermal-stress` | equilibrium | `stressEquilibrium` | `placeInInstrument` | `equilibrium-vessel`, `thermal-bath` |
| `atom.place.assemble-calorimeter` | calorimetry | `place` | `snapIntoTarget` | `calorimeter-vessel` |
| `atom.observe.read-immersed-probe` | calorimetry | `observe` | `readInstrument` | `immersed-probe-instrument`, `immersed-probe-vessel` |
| `atom.record.temperature-time-series` | calorimetry | `record` | `recordTimeSeries` | `immersed-probe-instrument`, `timing-instrument` |
| `atom.place.gas-delivery-train` | kinetics | `place` | `snapIntoTarget` | `gas-delivery-connector`, `gas-collection-instrument` |
| `atom.observe.zero-gas-collection-instrument` | kinetics | `observe` | `readInstrument` | `gas-collection-instrument` |
| `atom.weigh.solid-reactant-portion` | kinetics | `weigh` | `readInstrument` | `balance-instrument`, `reactant-solid-source` |
| `atom.transfer.initiate-solid-reactant-contact` | kinetics | `transfer` | `pourInto` | `reactant-solid-source`, `reaction-vessel` |
| `atom.transfer.microsample-portion` | qualitative-analysis | `transfer` | `pourInto` | `sample-source`, `bonding-test-vessel` |
| `atom.transfer.apply-test-solvent` | qualitative-analysis | `transfer` | `pourInto` | `bonding-test-solvent-source`, `bonding-test-vessel` |
| `atom.observe.read-aqueous-conductivity` | qualitative-analysis | `observe` | `readInstrument` | `immersed-probe-instrument`, `bonding-test-vessel` |
| `atom.observe.read-ph-indicator` | qualitative-analysis | `observe` | `readInstrument` | `ph-indicator-medium`, `bonding-test-vessel` |
| `atom.place.melting-point-sample` | qualitative-analysis | `place` | `dragToZone` | `melting-point-instrument`, `bonding-test-vessel` |
| `atom.observe.read-melting-behavior` | qualitative-analysis | `observe` | `readInstrument` | `melting-point-instrument`, `bonding-test-vessel` |
| `atom.observe.test-magnetic-response` | qualitative-analysis | `observe` | `readInstrument` | `magnetic-response-tool`, `bonding-test-vessel` |
| `atom.transfer.dispose-to-waste-stream` | qualitative-analysis | `transfer` | `pourInto` | `bonding-test-vessel`, `waste-receiver` |
| `atom.place.developing-chamber` | chromatography | `place` | `dragToZone` | `developing-chamber` |
| `atom.place.stationary-phase` | chromatography | `place` | `dragToZone` | `stationary-phase` |
| `atom.transfer.load-spotting-tool` | chromatography | `transfer` | `pourInto` | `sample-source`, `spotting-tool` |
| `atom.place.remove-developed-strip` | chromatography | `place` | `dragToZone` | `stationary-phase` |
| `atom.place.measuring-ruler` | chromatography | `place` | `dragToZone` | `distance-measuring-instrument` |
| `atom.transfer.route-solvent-waste` | chromatography | `transfer` | `pourInto` | `developing-chamber`, `waste-receiver` |
| `atom.transfer.weighed-sample-to-vessel` | separation | `transfer` | `pourInto` | `weighed-sample-source`, `receiving-vessel` |
| `atom.transfer.residual-solid-completion` | separation | `transfer` | `pourInto` | `weighed-sample-source`, `receiving-vessel` |
| `atom.transfer.charge-extraction-funnel` | separation | `transfer` | `pourInto` | `extraction-phase-source`, `extraction-funnel` |
| `atom.transfer.drain-separated-phase` | separation | `transfer` | `pourInto` | `extraction-funnel`, `phase-receiver` |
| `atom.transfer.add-drying-agent` | separation | `transfer` | `pourInto` | `drying-agent-source`, `phase-receiver` |
| `atom.observe.configure-photometer` | spectrophotometry | `observe` | `readInstrument`, `recordNotebook` | `photometer-instrument` |
| `atom.observe.set-active-photometer-wavelength` | spectrophotometry | `observe` | `readInstrument` | `photometer-instrument` |
| `atom.observe.prepare-cuvette-optical-faces` | spectrophotometry | `observe` | `recordNotebook` | `photometer-sample-holder` |
| `atom.place.remove-cuvette` | spectrophotometry | `place` | `dragToZone` | `photometer-instrument`, `photometer-sample-holder` |
| `atom.record.photometer-reading` | spectrophotometry | `record` | `recordNotebook` | `photometer-instrument` |
| `atom.measure.photometric-aliquot` | spectrophotometry | `measureVolume` | `pourInto` | `sample-source`, `photometric-aliquot-tool` |
| `atom.dilute.to-final-volume` | measurement | `dilute` | `pourInto` | `measured-solvent-source`, `receiving-vessel` |
| `atom.dilute.record-resulting-final-volume` | measurement | `dilute` | `pourInto` | `measured-solvent-source`, `receiving-vessel` |
| `atom.dilute.used-calorimetry-solution` | calorimetry | `dilute` | `pourInto` | `liquid-source`, `calorimeter-vessel` |
| `atom.transfer.initiate-timed-reaction` | kinetics | `transfer` | `pourInto` | `measured-solvent-source`, `reaction-vessel` |
| `atom.transfer.route-to-waste-treatment` | waste-treatment | `transfer` | `pourInto` | `liquid-source`, `waste-receiver` |
| `atom.transfer.dispose-calorimetry-waste` | calorimetry | `transfer` | `pourInto` | `calorimeter-vessel`, `waste-receiver` |
| `atom.transfer.treat-waste-to-endpoint` | waste-treatment | `transfer` | `pourInto` | `liquid-source`, `waste-receiver` |
| `atom.rinse.wash-recovered-fraction` | separation | `rinse` | `rinseTarget` | `rinse-water-source`, `rinsed-vessel` |
| `atom.transfer.decant-recovered-fraction` | separation | `transfer` | `pourInto` | `phase-receiver`, `receiving-vessel` |
| `atom.rinse.measured-quantitative-transfer` | measurement | `rinse` | `rinseTarget` | `rinse-water-source`, `rinsed-vessel` |
| `atom.transfer.quantitative-washings` | measurement | `transfer` | `pourInto` | `mixture-source`, `receiving-vessel` |
| `atom.place.select-clean-dry-receiving-vessel` | measurement | `place` | `dragToZone` | `receiving-vessel` |
| `atom.place.lock-syringe-plunger` | equilibrium | `place` | `snapIntoTarget` | `locking-pin`, `equilibrium-vessel` |
| `atom.place.calorimetry-volume-device` | calorimetry | `place` | `dragToZone` | `variable-volume-measuring-device` |
| `atom.place.calorimetry-weighing-vessel` | calorimetry | `place` | `snapIntoTarget` | `balance-instrument`, `weighed-vessel` |
| `atom.transfer.calorimetry-solid-portion` | calorimetry | `transfer` | `pourInto` | `solid-reagent-source`, `weighed-vessel` |
| `atom.place.calorimetry-heating-vessel` | calorimetry | `place` | `snapIntoTarget` | `heated-liquid-vessel`, `heating-instrument` |
| `atom.heat.calorimetry-liquid-to-target` | calorimetry | `heat` | `placeInInstrument` | `heated-liquid-vessel`, `heating-instrument` |
| `atom.place.remove-calorimetry-heating-vessel` | calorimetry | `place` | `dragToZone` | `heated-liquid-vessel` |
| `atom.dilute.brass-to-approved-final-volume` | spectrophotometry | `dilute` | `pourInto` | `liquid-source`, `final-volume-vessel` |
| `atom.transfer.brass-standard-stock-aliquot` | spectrophotometry | `transfer` | `pourInto` | `liquid-source`, `variable-volume-measuring-device`, `receiving-vessel` |
| `atom.transfer.prepare-photometric-blank` | spectrophotometry | `transfer` | `pourInto` | `liquid-source`, `photometer-sample-holder` |
| `atom.place.brass-color-depth-comparison` | spectrophotometry | `place` | `dragToZone` | `color-depth-comparison-apparatus` |
| `atom.transfer.brass-digest-to-volumetric-flask` | spectrophotometry | `transfer` | `pourInto` | `mixture-source`, `receiving-vessel` |
| `atom.place.equilibrium-rack` | equilibrium | `place` | `dragToZone` | `equilibrium-rack` |
| `atom.place.equilibrium-reagent-tray` | equilibrium | `place` | `dragToZone` | `equilibrium-reagent-tray` |
| `atom.place.equilibrium-vessel` | equilibrium | `place` | `dragToZone` | `equilibrium-vessel` |
| `atom.place.equilibrium-thermal-bath` | equilibrium | `place` | `dragToZone` | `thermal-bath` |
| `atom.place.equilibrium-bath-thermometer` | equilibrium | `place` | `dragToZone` | `thermal-bath-instrument`, `thermal-bath` |
| `atom.place.equilibrium-display-tube` | equilibrium | `place` | `snapIntoTarget` | `equilibrium-vessel`, `equilibrium-rack` |
| `atom.transfer.equilibrium-mixture-portion` | equilibrium | `transfer` | `pourInto` | `equilibrium-mixture-source`, `equilibrium-mixture-receiver` |
| `atom.stressEquilibrium.syringe-manipulation` | equilibrium | `stressEquilibrium` | `recordNotebook` | `equilibrium-vessel` |
| `atom.weigh.solid-source-vial` | equilibrium | `weigh` | `readInstrument` | `balance-instrument`, `solid-reagent-source` |
| `atom.place.weighed-vessel` | foundational | `place` | `dragToZone` | `weighed-vessel` |
| `atom.place.variable-volume-device` | foundational | `place` | `dragToZone` | `variable-volume-measuring-device` |
| `atom.transfer.unmeasured-solvent` | foundational | `transfer` | `pourInto` | `liquid-source`, `receiving-vessel` |
| `atom.place.precipitation-vessel` | foundational | `place` | `dragToZone` | `precipitation-vessel` |
| `atom.transfer.measured-liquid-to-precipitation-vessel` | foundational | `transfer` | `pourInto` | `measured-solvent-source`, `precipitation-vessel` |
| `atom.dilute.unmeasured-solvent-to-mark` | foundational | `dilute` | `pourInto` | `liquid-source`, `receiving-vessel` |
| `atom.place.remove-warm-drying-assembly` | foundational | `place` | `dragToZone` | `drying-instrument`, `dried-assembly`, `cooling-tool` |
| `atom.break.precipitate` | foundational | `place` | `dragToZone` | `dried-assembly`, `solid-transfer-tool` |
| `atom.rinse.condition-cuvette-with-sample` | spectrophotometry | `rinse` | `rinseTarget` | `sample-source`, `photometer-sample-holder` |
| `atom.rinse.prepare-cuvette-optical-faces` | spectrophotometry | `rinse` | `rinseTarget` | `photometer-sample-holder` |
| `atom.observe.dark-zero-photometer` | spectrophotometry | `observe` | `readInstrument` | `photometer-instrument` |
| `atom.transfer.return-cuvette-to-origin` | spectrophotometry | `transfer` | `pourInto` | `photometer-sample-holder`, `provenance-matched-sample-receiver` |
| `atom.transfer.adjust-color-depth-standard` | spectrophotometry | `transfer` | `pourInto` | `color-depth-comparison-apparatus` |
| `atom.observe.read-color-depth` | spectrophotometry | `observe` | `readInstrument` | `color-depth-comparison-apparatus` |
| `atom.transfer.treat-waste-with-solid-to-endpoint` | waste-treatment | `transfer` | `pourInto` | `solid-reagent-source`, `waste-receiver` |
| `atom.observe.read-waste-ph-indicator` | waste-treatment | `observe` | `readInstrument` | `ph-indicator-medium`, `waste-receiver` |
| `atom.mix.extraction-funnel` | separation | `mix` | `recordNotebook` | `extraction-funnel` |
| `atom.vent.extraction-funnel` | separation | `vent` | `recordNotebook` | `extraction-funnel` |
| `atom.settle.extraction-funnel` | separation | `settle` | `recordNotebook` | `extraction-funnel` |
| `atom.observe.mark-chromatography-baseline` | chromatography | `observe` | `recordNotebook` | `stationary-phase` |
| `atom.observe.dry-chromatography-spot` | chromatography | `observe` | `recordNotebook` | `stationary-phase` |
| `atom.observe.mark-chromatography-solvent-front` | chromatography | `observe` | `recordNotebook` | `stationary-phase` |
| `atom.observe.dry-developed-chromatography-paper` | chromatography | `observe` | `recordNotebook` | `stationary-phase` |
| `atom.dry.fraction-remove-solvent` | separation | `dry` | `recordNotebook` | `recovery-vessel` |
| `atom.observe.fraction-observe-residue` | separation | `observe` | `recordNotebook` | `recovery-vessel` |
| `atom.transfer.fraction-collect-residue` | separation | `transfer` | `recordNotebook` | `recovery-vessel` |
| `atom.dry.fraction-observe-dryness` | separation | `dry` | `recordNotebook` | `recovery-vessel` |
| `atom.cool.fraction-observe-cooling` | separation | `cool` | `recordNotebook` | `recovery-vessel` |
| `atom.transfer.fraction-dispose` | separation | `transfer` | `recordNotebook` | `recovery-vessel`, `waste-receiver` |
| `atom.rinse.fraction-remove-label` | separation | `rinse` | `recordNotebook` | `recovery-vessel` |
| `atom.transfer.fraction-remove-drying-agent` | separation | `transfer` | `recordNotebook` | `recovery-vessel` |
| `atom.record.titration-record-initial` | titration | `record` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.transfer.titration-deliver` | titration | `transfer` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.mix.titration-mix` | titration | `mix` | `recordNotebook` | `analyte-receiver` |
| `atom.observe.titration-observe` | titration | `observe` | `recordNotebook` | `analyte-receiver` |
| `atom.observe.titration-read-ph` | titration | `observe` | `recordNotebook` | `immersed-probe-instrument`, `immersed-probe-vessel` |
| `atom.record.titration-record-point` | titration | `record` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-decide` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-decide-curve` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.record.titration-record-final` | titration | `record` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-archive-retry` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-read-initial` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-read-final` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-practice-read-initial` | titration | `observe` | `recordNotebook` | `liquid-source`, `reaction-vessel` |
| `atom.transfer.titration-practice-deliver` | titration | `transfer` | `recordNotebook` | `liquid-source`, `reaction-vessel` |
| `atom.mix.titration-practice-mix` | titration | `mix` | `recordNotebook` | `reaction-vessel` |
| `atom.observe.titration-practice-observe` | titration | `observe` | `recordNotebook` | `reaction-vessel` |
| `atom.record.titration-practice-record-point` | titration | `record` | `recordNotebook` | `liquid-source`, `reaction-vessel` |
| `atom.observe.titration-practice-decide` | titration | `observe` | `recordNotebook` | `liquid-source`, `reaction-vessel` |
| `atom.observe.titration-practice-archive-retry` | titration | `observe` | `recordNotebook` | `liquid-source`, `reaction-vessel` |
| `atom.transfer.discard-practice-mixture` | titration | `transfer` | `pourInto` | `reaction-vessel`, `waste-receiver` |
| `atom.transfer.add-practice-indicator` | titration | `transfer` | `dispenseDrops`, `pourInto` | `indicator-source`, `reaction-vessel` |
| `atom.calculate.titration-calculate-curve` | titration | `calculate` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.transfer.burette-rinsate-to-waste` | titration | `transfer` | `pourInto` | `titrant-delivery-device`, `waste-receiver` |
| `atom.rinse.clean-titration-receiver` | measurement | `rinse` | `rinseTarget` | `rinse-water-source`, `rinsed-vessel` |
| `atom.observe.titration-review-standardization` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-select-equivalence` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.titration-approve-equivalence` | titration | `observe` | `recordNotebook` | `titrant-delivery-device`, `analyte-receiver` |
| `atom.observe.burette-tip-inspection` | titration | `observe` | `recordNotebook` | `titrant-delivery-device` |
| `atom.observe.record-teacher-configured-numeric-value` | foundational | `observe` | `recordNotebook` | — |
| `atom.observe.configure-liquid-stock-inventory` | foundational | `observe` | `recordNotebook` | `sample-source` |
| `atom.observe.configure-solid-stock-inventory` | foundational | `observe` | `recordNotebook` | `solid-reagent-source` |
| `atom.transfer.load-solid-onto-weighing-support` | weighing | `transfer` | `pourInto` | `solid-reagent-source`, `weighed-vessel` |
| `atom.observe.confirm-external-material-transition` | foundational | `observe` | `recordNotebook` | `receiving-vessel` |
| `atom.transfer.fill-color-depth-pair` | spectrophotometry | `transfer` | `pourInto` | `sample-source`, `color-depth-comparison-vessel` |
| `atom.transfer.collect-sample-for-treatment` | waste-treatment | `transfer` | `pourInto` | `sample-source`, `waste-receiver` |
| `atom.transfer.treated-waste-to-designated-destination` | waste-treatment | `transfer` | `pourInto` | `recovery-vessel`, `waste-receiver` |
| `atom.transfer.unheated-mixture-to-labeled-recovery` | separation | `transfer` | `pourInto` | `solid-reagent-source`, `recovery-vessel` |
| `atom.transfer.heated-product-to-labeled-recovery` | separation | `transfer` | `pourInto` | `weighed-vessel`, `recovery-vessel` |
| `atom.observe.control-calorimetry-stirrer` | calorimetry | `observe` | `recordNotebook` | `stirring-device` |
| `atom.observe.identify-temperature-peak` | calorimetry | `observe` | `recordNotebook` | `immersed-probe-instrument`, `immersed-probe-vessel` |
| `atom.observe.wait-calorimetry-interval` | calorimetry | `observe` | `recordNotebook` | `timing-instrument` |
| `atom.observe.read-timed-temperature` | calorimetry | `observe` | `readInstrument` | `immersed-probe-instrument`, `immersed-probe-vessel`, `timing-instrument` |
| `atom.observe.measure-chromatography-distance` | chromatography | `observe` | `readInstrument` | `stationary-phase`, `distance-measuring-instrument` |
| `atom.observe.extraction-layer-state` | separation | `observe` | `recordNotebook` | `extraction-funnel` |
| `atom.observe.identify-extraction-layers-from-evidence` | separation | `observe` | `recordNotebook` | `extraction-funnel` |
| `atom.observe.read-recovery-ph` | separation | `observe` | `readInstrument` | `recovery-vessel`, `immersed-probe-instrument`, `immersed-probe-vessel` |
| `atom.observe.record-property-test-result` | qualitative-analysis | `observe` | `recordNotebook` | `bonding-test-vessel` |
| `atom.transfer.measured-liquid-aliquot` | measurement | `transfer` | `pourInto` | `measured-liquid-source`, `receiving-vessel` |
| `atom.place.balance-instrument` | thermal-decomposition | `place` | `dragToZone` | `balance-instrument` |
| `atom.place.thermal-support` | thermal-decomposition | `place` | `dragToZone`, `snapIntoTarget` | `thermal-support` |
| `atom.place.thermal-heating-instrument` | thermal-decomposition | `place` | `dragToZone` | `thermal-heating-instrument` |
| `atom.place.thermal-crucible-assembly` | thermal-decomposition | `place` | `dragToZone`, `snapIntoTarget` | `weighed-vessel` |
| `atom.heat.thermal-decomposition-stage` | thermal-decomposition | `dry` | `placeInInstrument` | `thermal-heating-instrument`, `weighed-vessel` |
| `atom.control.thermal-burner` | thermal-decomposition | `reset` | `dragToZone` | `thermal-heating-instrument` |

### Family: calorimetry

#### `atom.place.assemble-calorimeter`

**Add one source-stated stage to the calorimeter assembly**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `calorimeter-vessel`
- Optional roles: `stirring-device`, `calorimeter-cover`, `immersed-probe-instrument`
- Evidence: the named component seated in the current calorimeter assembly stage
- Procedural constraints:
  - Assembly is ordered: stirrer, outer cup, nested inner cup, cover, then probe; each action records only the stage it physically adds.
  - The probe bulb must be immersed once liquid is added and must not touch the cup bottom or sides.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` apparatus step `CAL-01` (F/R)
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-01` (M/F)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `CAL-01`
  - `technique:hand-warmer-calorimetry` action `CAL-04`

#### `atom.observe.read-immersed-probe`

**Read an immersed probe**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `immersed-probe-instrument`, `immersed-probe-vessel`
- Optional roles: none
- Evidence: temperature reading tagged live, stable, peak, or timed
- Procedural constraints:
  - A reading taken before the value stabilises is a different measurement from a stable or peak reading; keep the evidence kinds distinct.
  - The probe must be immersed for the reading to be valid.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-04` (M)
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-09` (M)
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-05` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P1-08`

#### `atom.record.temperature-time-series`

**Record a temperature-time series**

- Verb: `record`
- Allowed interaction types: `recordTimeSeries`
- Required roles: `immersed-probe-instrument`, `timing-instrument`
- Optional roles: none
- Evidence: time-temperature series scoped to one trial
- Procedural constraints:
  - The sampling interval and trial count are teacher-configured.
  - Each point keeps the unit and the instrument precision it was read at.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-10` (M)

#### `atom.dilute.used-calorimetry-solution`

**Dilute a used calorimetry solution before disposal**

- Verb: `dilute`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `calorimeter-vessel`
- Optional roles: none
- Evidence: used calorimetry solution visibly diluted in the assembled vessel before disposal
- Procedural constraints:
  - The source requires dilution before disposal, but does not convert the wash bottle into a calibrated measuring device.
  - The action must preserve the calorimeter capacity limit and may not bypass the following designated-waste transfer.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-11` (M/C)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P1-D03`

#### `atom.transfer.dispose-calorimetry-waste`

**Dispose of diluted calorimetry solution in the designated receiver**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `calorimeter-vessel`, `waste-receiver`
- Optional roles: none
- Evidence: assembled calorimeter emptied into the designated waste receiver after dilution
- Procedural constraints:
  - The solution must be diluted before this transfer is accepted.
  - The destination is the teacher-designated waste receiver, never an inferred sink or ordinary receiving vessel.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-11` (M/C)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P1-D04`

#### `atom.place.calorimetry-volume-device`

**Place the clean graduated volume device for a calorimetry measurement**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `variable-volume-measuring-device`
- Optional roles: none
- Evidence: clean graduated device staged for the current calorimetry scope
- Procedural constraints:
  - The device is clean, upright, and empty before water is added.
  - Placement creates no volume evidence; the following measurement action must read the stated volume.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-02` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `VOL-01`

#### `atom.place.calorimetry-weighing-vessel`

**Place the empty weighing vessel on the balance**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `balance-instrument`, `weighed-vessel`
- Optional roles: none
- Evidence: empty weighing vessel seated on the balance pan
- Procedural constraints:
  - The configured disposable weighing vessel must be empty and dry.
  - Placement precedes taring and does not itself claim a mass.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-07` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P1-15`

#### `atom.transfer.calorimetry-solid-portion`

**Dispense the calorimetry solid into its weighing vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `solid-reagent-source`, `weighed-vessel`
- Optional roles: `solid-transfer-tool`
- Evidence: identified solid portion present in the weighing vessel for a balance read
- Procedural constraints:
  - The stock identity is preserved and the portion is adjusted in small increments.
  - The balance reading, not the transfer literal, becomes the trial mass evidence.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-07` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P1-17`

#### `atom.place.calorimetry-heating-vessel`

**Place the water-filled vessel on the heating instrument**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `heated-liquid-vessel`, `heating-instrument`
- Optional roles: none
- Evidence: water-filled vessel seated on the heating surface with heat initially off
- Procedural constraints:
  - The heating surface is off while the correctly identified water vessel is placed.
  - No assigned inquiry solid is present in the hot zone during calibration.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-02` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P2-H04`

#### `atom.heat.calorimetry-liquid-to-target`

**Heat and monitor the calibration water to its approved range**

- Verb: `heat`
- Allowed interaction types: `placeInInstrument`
- Required roles: `heated-liquid-vessel`, `heating-instrument`
- Optional roles: `stirring-device`, `immersed-probe-instrument`
- Evidence: heated water sample with heat stopped at the observed approved range
- Procedural constraints:
  - The approximately 50 degrees C endpoint remains a measured range, not a hidden exact answer.
  - Heat is stopped only after a current temperature reading reaches the teacher-configured tolerance.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-02` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P2-H09`

#### `atom.place.remove-calorimetry-heating-vessel`

**Remove the heated water vessel after heat is off**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `heated-liquid-vessel`
- Optional roles: none
- Evidence: heated water vessel on the bench, ready for the immediate temperature read and transfer
- Procedural constraints:
  - Heat must be off before the hot-water vessel leaves the instrument.
  - The vessel stays identified as the hot sample and begins no unrecorded mixing step.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-03` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P2-H10`

#### `atom.observe.control-calorimetry-stirrer`

**Control the calorimetry stirring device**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `stirring-device`
- Optional roles: `calorimeter-vessel`
- Evidence: configured stirring state without a splash
- Procedural constraints:
  - The control action must target the named stirring apparatus; a notebook entry alone cannot substitute for the apparatus state.
  - Heating remains off while the approved stirring condition is established.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-06` (M)

#### `atom.observe.identify-temperature-peak`

**Identify the true peak temperature from the probe stream**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `immersed-probe-instrument`, `immersed-probe-vessel`
- Optional roles: none
- Evidence: highest observed temperature in the named calorimetry series
- Procedural constraints:
  - Peak evidence must be selected from the named probe series, not replaced with a configured expected value or the first reading.
  - The probe must remain immersed in the named calorimetry vessel for the series.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-09` (M)

#### `atom.observe.wait-calorimetry-interval`

**Wait through the configured calorimetry interval**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `timing-instrument`
- Optional roles: `calorimeter-vessel`
- Evidence: configured calorimetry interval elapsed
- Procedural constraints:
  - The action completes only after the named timer reaches the approved interval; a written claim of elapsed time is not a substitute for the timing instrument.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-09` (M)

#### `atom.observe.read-timed-temperature`

**Read the temperature at the configured calorimetry time**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `immersed-probe-instrument`, `immersed-probe-vessel`, `timing-instrument`
- Optional roles: none
- Evidence: temperature reading at the configured calorimetry interval
- Procedural constraints:
  - The timed reading follows the named elapsed interval and remains distinct from a peak or live reading.
  - The probe must be immersed in the named vessel when the reading is acquired.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-10` (M)

### Family: chromatography

#### `atom.transfer.charge-developing-chamber`

**Add the approved solvent to the developing chamber**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `developing-chamber`
- Optional roles: `measured-solvent-source`
- Evidence: chamber holding a shallow mobile phase at the configured depth
- Procedural constraints:
  - The solvent depth is a configuration point and must stay below the baseline: it is validated against the origin height on the strip, not against the volume delivered.
  - The chamber is charged before the spotted paper is inserted.
  - The source lists no measuring device, so a stock container satisfies this atom; a measured delivery is admissible where the teacher configures an amount.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-02` (M/C)
  - `sticky-question-paper-chromatography_2026-07-27.md` apparatus step `CHR-01` (F)
- Content examples:
  - `technique:paper-chromatography` action `add-water-solvent`
  - `technique:paper-chromatography` action `add-propanol-solvent`

#### `atom.spotSample.apply-baseline-spot`

**Apply a sample spot to the pencil baseline**

- Verb: `spotSample`
- Allowed interaction types: `spotOnto`
- Required roles: `spotting-tool`, `stationary-phase`
- Optional roles: `sample-source`
- Evidence: spotted strip with a recorded origin
- Procedural constraints:
  - The baseline must already be drawn and must sit above the solvent level.
  - The spot stays small and centred; drying between applications is part of the approved plan, not an automatic effect.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-04` (M/R)
  - `sticky-question-paper-chromatography_2026-07-27.md` apparatus step `CHR-03` (F/R/C)
- Content examples:
  - `technique:paper-chromatography` action `spot-water-sample`
  - `technique:paper-chromatography` action `spot-propanol-sample`

#### `atom.developChromatogram.develop-strip`

**Develop the spotted strip in the chamber**

- Verb: `developChromatogram`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `stationary-phase`, `developing-chamber`
- Optional roles: none
- Evidence: developed chromatogram with a marked solvent front
- Procedural constraints:
  - Insertion geometry is validated: the lower edge is in solvent and the spot is above it.
  - The stop condition is a configuration point; the solvent front is marked promptly after removal.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-06` (M/R)
  - `sticky-question-paper-chromatography_2026-07-27.md` apparatus step `CHR-04` (F)
- Content examples:
  - `technique:paper-chromatography` action `develop-water-paper`
  - `technique:paper-chromatography` action `develop-propanol-paper`

#### `atom.place.developing-chamber`

**Stand the developing chamber on the bench**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `developing-chamber`
- Optional roles: none
- Evidence: an empty labelled chamber standing on the bench
- Procedural constraints:
  - Each solvent trial uses its own labelled chamber, so a comparison cannot lose which mobile phase produced which chromatogram.
  - The chamber is charged and the strip inserted only after it is standing upright.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` apparatus step `CHR-00` (F)
- Content examples:
  - `technique:paper-chromatography` action `place-water-chamber`
  - `technique:paper-chromatography` action `place-propanol-chamber`

#### `atom.place.stationary-phase`

**Lay a fresh strip out for marking and spotting**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `stationary-phase`
- Optional roles: none
- Evidence: an unmarked strip flat on the bench
- Procedural constraints:
  - Every trial uses fresh paper; a developed strip is never re-marked or re-spotted.
  - The strip must be narrow enough to fit the chamber and shorter than it, which is a configuration point.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` apparatus step `CHR-02` (F)
- Content examples:
  - `technique:paper-chromatography` action `place-water-paper`
  - `technique:paper-chromatography` action `place-propanol-paper`

#### `atom.transfer.load-spotting-tool`

**Load the spotting tool from the sample container**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `sample-source`, `spotting-tool`
- Optional roles: none
- Evidence: a spotting tool holding a small aliquot of the named sample
- Procedural constraints:
  - The sample is the teacher-supplied mixture; loading from a solvent container loses sample identity.
  - No spotting tool is listed in the source materials, so the tool itself stays a teacher-approved inference.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-04` (M/R)
  - `sticky-question-paper-chromatography_2026-07-27.md` apparatus step `CHR-03` (F/R/C)
- Content examples:
  - `technique:paper-chromatography` action `load-water-capillary`
  - `technique:paper-chromatography` action `load-propanol-capillary`

#### `atom.place.remove-developed-strip`

**Remove the developed strip from the chamber**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `stationary-phase`
- Optional roles: `developing-chamber`
- Evidence: a wet developed strip flat on the bench with its trial identity intact
- Procedural constraints:
  - The strip leaves the chamber wet, and the solvent front has to be marked before it evaporates.
  - Trial identity and orientation are preserved: a strip that loses either cannot be measured.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-09` (R)
  - `sticky-question-paper-chromatography_2026-07-27.md` apparatus step `CHR-07` (F)
- Content examples:
  - `technique:paper-chromatography` action `remove-water-paper`
  - `technique:paper-chromatography` action `remove-propanol-paper`

#### `atom.place.measuring-ruler`

**Bring the measuring ruler to the bench**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `distance-measuring-instrument`
- Optional roles: none
- Evidence: a millimetre ruler available on the bench
- Procedural constraints:
  - Distances are read by the student from this instrument; the simulator supplies no band or front distance.
  - The division the ruler is read to follows the configured strip length rather than being fixed by the atom.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-12` (M)
- Content examples:
  - `technique:paper-chromatography` action `place-metric-ruler`

#### `atom.transfer.route-solvent-waste`

**Route used mobile phase to its waste stream**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `developing-chamber`, `waste-receiver`
- Optional roles: none
- Evidence: used mobile phase in the receiver labelled for its solvent class
- Procedural constraints:
  - The destination branches by solvent class: water and food dye to the sink stream, acetone, ethanol, 2-propanol, and chromatography solvent to organic waste.
  - Disposal happens after every distance is read, because discarding the trial liquid ends the trial.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-19` (M)
- Content examples:
  - `technique:paper-chromatography` action `dispose-water-solvent`
  - `technique:paper-chromatography` action `dispose-propanol-solvent`

#### `atom.observe.mark-chromatography-baseline`

**Mark the chromatography baseline**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `stationary-phase`
- Optional roles: none
- Evidence: Mark the chromatography baseline
- Procedural constraints:
  - Requires the matching closed chromatographyOperation on the named paper; a notebook-only action cannot claim this physical operation. Drying remains a configured qualitative preparation, not modeled kinetics.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-03` (M)

#### `atom.observe.dry-chromatography-spot`

**Dry the chromatography spot under the approved plan**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `stationary-phase`
- Optional roles: none
- Evidence: Dry the chromatography spot under the approved plan
- Procedural constraints:
  - Requires the matching closed chromatographyOperation on the named paper; a notebook-only action cannot claim this physical operation. Drying remains a configured qualitative preparation, not modeled kinetics.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-05` (R/C)

#### `atom.observe.mark-chromatography-solvent-front`

**Mark the chromatography solvent front**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `stationary-phase`
- Optional roles: none
- Evidence: Mark the chromatography solvent front
- Procedural constraints:
  - Requires the matching closed chromatographyOperation on the named paper; a notebook-only action cannot claim this physical operation. Drying remains a configured qualitative preparation, not modeled kinetics.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-10` (M/R)

#### `atom.observe.dry-developed-chromatography-paper`

**Dry removed chromatography paper under the approved plan**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `stationary-phase`
- Optional roles: none
- Evidence: Dry removed chromatography paper under the approved plan
- Procedural constraints:
  - Requires the matching closed chromatographyOperation on the named paper; a notebook-only action cannot claim this physical operation. Drying remains a configured qualitative preparation, not modeled kinetics.

#### `atom.observe.measure-chromatography-distance`

**Measure a chromatography distance from baseline**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `stationary-phase`, `distance-measuring-instrument`
- Optional roles: none
- Evidence: student-read distance on the named chromatography strip
- Procedural constraints:
  - The ruler reading must name the developed strip and preserve the authored solvent-front or component-band measurement identity.
  - A generic length reading without the stationary phase is not a chromatography measurement.
- Source examples:
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-12` (M)
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-14` (M)
  - `sticky-question-paper-chromatography_2026-07-27.md` phase step `TR-16` (M)

### Family: equilibrium

#### `atom.stressEquilibrium.reagent-stress`

**Apply a reagent stress to an equilibrium**

- Verb: `stressEquilibrium`
- Allowed interaction types: `pourInto`
- Required roles: `stress-reagent-source`, `equilibrium-vessel`
- Optional roles: none
- Evidence: observed colour or state change attributed to the named stress
- Procedural constraints:
  - Dropwise addition with observation between additions is the source behaviour; a single bulk addition loses the shift evidence.
  - The observed colour is evidence. Never let the rendered colour imply a quantitative concentration.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `CUAM-02` (M)
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `C-08` (M)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `stress-btb-acid`
  - `technique:equilibrium-rainbow-inquiry` action `stress-iron-reactant`

#### `atom.stressEquilibrium.thermal-stress`

**Apply a thermal stress to an equilibrium**

- Verb: `stressEquilibrium`
- Allowed interaction types: `placeInInstrument`
- Required roles: `equilibrium-vessel`, `thermal-bath`
- Optional roles: `immersed-probe-instrument`
- Evidence: observed shift with the bath temperature recorded
- Procedural constraints:
  - The bath temperature is teacher-configured and must be observable rather than assumed.
  - The vessel returns to its prior state only if the source says the shift is reversible.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` apparatus step `BATH-02` (F)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `stress-cobalt-hot`

#### `atom.place.lock-syringe-plunger`

**Insert the locking pin through an extended sealed syringe plunger**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `locking-pin`, `equilibrium-vessel`
- Optional roles: none
- Evidence: locking pin seated in the extended plunger hole of the sealed syringe
- Procedural constraints:
  - The plunger is extended and the valve is closed before the pin can be inserted.
  - Successful seating updates the syringe body state; it does not itself claim a chemical color endpoint.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` apparatus step `SYR-06` (M/F)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `soda-insert-locking-nail`

#### `atom.place.equilibrium-rack`

**Place an equilibrium working or display rack**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `equilibrium-rack`
- Optional roles: none
- Evidence: named rack present in its assigned workbench zone
- Procedural constraints:
  - Keep the working and display racks distinct so trial order cannot silently become presentation evidence.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `R-06` (M)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `place-display-rack`

#### `atom.place.equilibrium-reagent-tray`

**Select or return one equilibrium reagent tray**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `equilibrium-reagent-tray`
- Optional roles: none
- Evidence: correct system-specific tray selected or returned
- Procedural constraints:
  - Only the tray for the active equilibrium system is present; return it before selecting the next system.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `C-02` (M)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `select-btb-tray`

#### `atom.place.equilibrium-vessel`

**Place an equilibrium stock, trial, or pressure vessel**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `equilibrium-vessel`
- Optional roles: none
- Evidence: named equilibrium vessel available in the work zone
- Procedural constraints:
  - Vessel identity stays tied to its named system and trial; placement alone does not assert a color or equilibrium shift.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `C-07` (M)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `place-tube-btb-acid`

#### `atom.place.equilibrium-thermal-bath`

**Place a teacher-approved thermal bath**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `thermal-bath`
- Optional roles: none
- Evidence: named hot- or ice-water bath present in the work zone
- Procedural constraints:
  - The bath temperature is checked separately; placing the beaker does not establish a temperature.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` apparatus step `BATH-01` (F)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `place-hot-bath`

#### `atom.place.equilibrium-bath-thermometer`

**Place a thermometer in an equilibrium thermal bath**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `thermal-bath-instrument`, `thermal-bath`
- Optional roles: none
- Evidence: thermometer available to verify the teacher-approved bath condition
- Procedural constraints:
  - Immerse the thermometer without treating an unobserved bath temperature as known.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` apparatus step `BATH-03` (F/R)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `place-thermometer`

#### `atom.place.equilibrium-display-tube`

**Seat a selected evidence tube in the equilibrium display rack**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `equilibrium-vessel`, `equilibrium-rack`
- Optional roles: none
- Evidence: selected evidence tube seated in the named display slot
- Procedural constraints:
  - The selected tube must be supported by recorded evidence and placed in its assigned color-order slot.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `R-06` (M)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `display-red-candidate`

#### `atom.transfer.equilibrium-mixture-portion`

**Transfer a prepared equilibrium mixture portion**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `equilibrium-mixture-source`, `equilibrium-mixture-receiver`
- Optional roles: none
- Evidence: receiving vessel contains the named prepared equilibrium mixture
- Procedural constraints:
  - Preserve qualitative portion language where the source does not specify an aliquot volume.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `C-07` (M)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `aliquot-tube-btb-acid`

#### `atom.stressEquilibrium.syringe-manipulation`

**Manipulate the sealed syringe pressure-equilibrium apparatus**

- Verb: `stressEquilibrium`
- Allowed interaction types: `recordNotebook`
- Required roles: `equilibrium-vessel`
- Optional roles: none
- Evidence: observed and recorded syringe apparatus state or qualitative pressure response
- Procedural constraints:
  - Preserve the source order: invert, expel gas, close the valve, pull and lock the plunger, then shake only if needed.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `P-02` (M/F)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `soda-invert-syringe`

#### `atom.weigh.solid-source-vial`

**Weigh an approximate solid portion supplied in a source vial**

- Verb: `weigh`
- Allowed interaction types: `readInstrument`
- Required roles: `balance-instrument`, `solid-reagent-source`
- Optional roles: none
- Evidence: recorded approximate solid mass from the named source vial
- Procedural constraints:
  - Preserve approximate source quantities such as about 2 g; the balance reading supplies the mass without reclassifying the reagent vial as laboratory glassware.
- Source examples:
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `CUCL-01` (M)
- Content examples:
  - `technique:equilibrium-rainbow-inquiry` action `copper-chloride-weigh-solid`
  - `technique:equilibrium-rainbow-inquiry` action `cobalt-weigh-solid`

### Family: filtration

#### `atom.place.filtration-support`

**Place the filtration support**

- Verb: `place`
- Allowed interaction types: `dragToZone`, `snapIntoTarget`
- Required roles: `filtration-support`
- Optional roles: none
- Evidence: stable support on the bench
- Procedural constraints:
  - The support must be stable and upright before anything is mounted on it.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` apparatus step `GRAV-00` (F/C)
- Content examples:
  - `technique:filtration` action `assemble-funnel-stand`

#### `atom.place.filtration-funnel`

**Place the filtration funnel of the selected configuration**

- Verb: `place`
- Allowed interaction types: `dragToZone`, `snapIntoTarget`
- Required roles: `filtration-funnel`
- Optional roles: `filtration-support`
- Evidence: funnel present in the configured filtration station
- Procedural constraints:
  - Gravity versus vacuum configuration is an unresolved confirmation point in Investigation 3; the apparatus choice must stay configurable rather than be decided here.
  - The support is optional for exactly that reason. A gravity funnel is seated in a ring or funnel stand, while a Buchner funnel seats on its receiving flask, so requiring a support would decide the confirmation point in favour of gravity. Corrected by Cycle 08.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` apparatus step `GRAV-01` (F/C)
- Content examples:
  - `technique:gravimetric-vacuum-filtration` action `place-practice-buchner`
  - `technique:quick-ache-extraction-recovery` action `qar-place-buchner-funnel`

#### `atom.place.filter-medium`

**Seat the filter medium in the funnel**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `filtration-funnel`, `filter-medium`
- Optional roles: none
- Evidence: paper correctly seated in the funnel
- Procedural constraints:
  - In a gravimetric procedure the medium must already be weighed before it is seated.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-04` (M)
  - `what-makes-hard-water-hard_2026-07-27.md` apparatus step `GRAV-02` (F)
- Content examples:
  - `technique:filtration` action `place-filter-paper`
  - `technique:gravimetric-vacuum-filtration` action `seat-practice-filter-paper`
  - `technique:quick-ache-extraction-recovery` action `qar-seat-filter-paper`

#### `atom.rinse.wet-filter-medium`

**Wet the seated filter medium**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `rinse-water-source`, `filter-medium`
- Optional roles: none
- Evidence: paper wetted and still seated
- Procedural constraints:
  - Wetting seals the paper against the funnel wall; the paper must already be seated.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-05` (M)
  - `what-makes-hard-water-hard_2026-07-27.md` apparatus step `GRAV-03` (F)
- Content examples:
  - `technique:filtration` action `wet-filter-paper`
  - `technique:gravimetric-vacuum-filtration` action `wet-practice-filter-paper`
  - `technique:quick-ache-extraction-recovery` action `qar-wet-filter-paper`

#### `atom.place.filtration-receiver`

**Align the filtrate receiver under the funnel outlet**

- Verb: `place`
- Allowed interaction types: `dragToZone`, `snapIntoTarget`
- Required roles: `filtration-receiver`
- Optional roles: none
- Evidence: complete filtration station
- Procedural constraints:
  - The receiver must be aligned under the outlet before any mixture is poured.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` apparatus step `GRAV-04` (F)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-place-side-arm-flask`

#### `atom.filter.pour-through-medium`

**Filter a mixture through the seated medium**

- Verb: `filter`
- Allowed interaction types: `pourInto`
- Required roles: `mixture-source`, `filtration-funnel`
- Optional roles: `filtration-receiver`
- Evidence: precipitate retained on the medium, filtrate in the receiver
- Procedural constraints:
  - The pour is slow and must not overflow the paper; overflow is an invalid case with a stated recovery, not a silent success.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-06` (M)
- Content examples:
  - `technique:gravimetric-vacuum-filtration` action `filter-practice-mixture`
  - `technique:quick-ache-extraction-recovery` action `qar-filter-recovered-solid`

#### `atom.rinse.wash-precipitate`

**Wash the collected precipitate**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `rinse-water-source`, `filter-medium`
- Optional roles: none
- Evidence: washed precipitate on the medium
- Procedural constraints:
  - Washing the collected solid is a separate step from rinsing the source beaker; the dated plan states both.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-08` (M)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-rinse-collected-solid`

#### `atom.place.filtration-vacuum-source`

**Place the vacuum source of a vacuum filtration station**

- Verb: `place`
- Allowed interaction types: `dragToZone`, `snapIntoTarget`
- Required roles: `filtration-vacuum-source`
- Optional roles: `filtration-receiver`
- Evidence: vacuum source present and recorded as part of the selected configuration
- Procedural constraints:
  - This atom belongs to the vacuum configuration only. It must never be required in the gravity configuration, because Investigation 3 leaves that choice to the teacher.
  - The manual names a vacuum filtration apparatus without enumerating its components, so the assembled station is a configured arrangement rather than a source-stated one.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` apparatus step `GRAV-01` (F/C)
- Content examples:
  - `technique:gravimetric-vacuum-filtration` action `place-practice-vacuum`
  - `technique:quick-ache-extraction-recovery` action `qar-place-vacuum-source`

### Family: foundational

#### `atom.place.weighed-vessel`

**Position the clean, dry weighing vessel before taking a mass.**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `weighed-vessel`
- Optional roles: none
- Evidence: Position the clean, dry weighing vessel before taking a mass.
- Procedural constraints:
  - Position the clean, dry weighing vessel before taking a mass.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-02` (R)
- Content examples:
  - `technique:weighing` action `place-watch-glass`

#### `atom.place.variable-volume-device`

**Position the graduated measuring device before filling it.**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `variable-volume-measuring-device`
- Optional roles: none
- Evidence: Position the graduated measuring device before filling it.
- Procedural constraints:
  - Position the graduated measuring device before filling it.
- Content examples:
  - `technique:measuring-volume` action `place-cylinder`

#### `atom.transfer.unmeasured-solvent`

**Add solvent without implying a calibrated delivered volume.**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `receiving-vessel`
- Optional roles: none
- Evidence: Add solvent without implying a calibrated delivered volume.
- Procedural constraints:
  - Add solvent without implying a calibrated delivered volume.
- Content examples:
  - `technique:making-solution` action `add-solvent`

#### `atom.place.precipitation-vessel`

**Position the precipitation vessel before adding measured sample or reagent.**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `precipitation-vessel`
- Optional roles: none
- Evidence: Position the precipitation vessel before adding measured sample or reagent.
- Procedural constraints:
  - Position the precipitation vessel before adding measured sample or reagent.
- Content examples:
  - `technique:transfer` action `place-beaker`

#### `atom.transfer.measured-liquid-to-precipitation-vessel`

**Transfer an already measured aliquot into the precipitation vessel.**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `measured-solvent-source`, `precipitation-vessel`
- Optional roles: none
- Evidence: Transfer an already measured aliquot into the precipitation vessel.
- Procedural constraints:
  - Transfer an already measured aliquot into the precipitation vessel.
- Content examples:
  - `technique:transfer` action `transfer-sample`

#### `atom.dilute.unmeasured-solvent-to-mark`

**Add unmeasured solvent until the configured final-volume mark is reached.**

- Verb: `dilute`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `receiving-vessel`
- Optional roles: none
- Evidence: Add unmeasured solvent until the configured final-volume mark is reached.
- Procedural constraints:
  - Add unmeasured solvent until the configured final-volume mark is reached.
- Content examples:
  - `technique:dilution` action `dilute-to-mark`

#### `atom.place.remove-warm-drying-assembly`

**Use the configured heat-safe tool to remove the warm assembly after the first drying stage without weighing it.**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `drying-instrument`, `dried-assembly`, `cooling-tool`
- Optional roles: none
- Evidence: Use the configured heat-safe tool to remove the warm assembly after the first drying stage without weighing it.
- Procedural constraints:
  - Use the configured heat-safe tool to remove the warm assembly after the first drying stage without weighing it.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-15` (M)
- Content examples:
  - `technique:drying` action `remove-warm-precipitate`

#### `atom.break.precipitate`

**Break the partially dried precipitate into small pieces before the second drying stage.**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `dried-assembly`, `solid-transfer-tool`
- Optional roles: none
- Evidence: Break the partially dried precipitate into small pieces before the second drying stage.
- Procedural constraints:
  - Break the partially dried precipitate into small pieces before the second drying stage.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-16` (M)
- Content examples:
  - `technique:drying` action `break-precipitate`

#### `atom.observe.record-teacher-configured-numeric-value`

**Record a teacher-configured numeric value as configuration evidence**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: none
- Optional roles: none
- Evidence: teacher-configured numeric measurement and its notebook evidence
- Procedural constraints:
  - The action records a named numeric configuration supplied by the teacher or source-supported classroom setup; it is not a learner-acquired instrument or sample reading.
  - The bound action must retain its own configuration quantity, unit, numeric bounds, provenance, and any unresolved confirmation point. This atom never supplies a default value, precision, or analytical result.
  - A source-stated endpoint or volume may be preserved as approved configuration evidence, but this atom does not turn that endpoint into a newly observed measurement or authenticate a teacher decision.
  - Active instrument configuration and physical stock initialization remain separate contracts because they also change instrument, equipment, or material state.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-01` (M)
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `I-04` (M)
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `I-07` (M)
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `B-11` (M)
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `D-03` (M)
- Content examples:
  - `technique:blue1-standard-dilutions` action `i1-record-stock-concentration`
  - `technique:blue1-percent-transmittance` action `i1-record-approved-unknown-replicate-count`
  - `technique:blue1-percent-transmittance` action `i1-record-minimum-usable-percent-t`
  - `technique:blue1-percent-transmittance` action `i1-record-molar-mass-reference`
  - `technique:blue1-percent-transmittance` action `i1-record-final-solution-volume`
  - `technique:brass-spectrophotometry` action `record-unknown-final-volume-action`
  - `technique:brass-spectrophotometry` action `record-standard-final-volume-action`

#### `atom.observe.configure-liquid-stock-inventory`

**Configure the finite liquid stock available in a named container**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `sample-source`
- Optional roles: none
- Evidence: teacher-configured starting volume for the named liquid stock container
- Procedural constraints:
  - The configured volume is externally supplied operational setup evidence in millilitres, not a learner-acquired instrument measurement.
  - The source instance and source definition remain explicitly named; the source must be a compatible liquid container with a positive mL capacity.
  - This atom does not authenticate teacher authorization, infer a measured reading, or define reset or stock-conservation policy.
  - The supplied protocols do not directly state pre-run stock initialization; this atom's configuration semantics are an explicit simulator contract inferred from the owner actions, not a source-example claim.
- Content examples:
  - `technique:brass-spectrophotometry` action `scan-configure-salt-a-inventory-action`
  - `technique:brass-spectrophotometry` action `scan-configure-salt-b-inventory-action`
  - `technique:blue1-percent-transmittance` action `i1-configure-unknown-operational-inventory`
  - `technique:blue1-percent-transmittance` action `i1-configure-unknown-dilution-water`

#### `atom.observe.configure-solid-stock-inventory`

**Configure the finite solid stock available in a named container**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `solid-reagent-source`
- Optional roles: none
- Evidence: teacher-configured starting mass for the named solid stock container
- Procedural constraints:
  - The configured mass is teacher-supplied classroom setup in grams. It is never a learner balance reading, and it is never compared against the container's volume capacity.
  - The stated sample range stays a range: the exact configured mass is a teacher decision, not a value an implementation may choose.
  - Setup precedes physical use of the container in the attempt; a stock the attempt has already consumed is not refilled.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` apparatus step `BRASS-01` (F/C)
- Content examples:
  - `technique:brass-spectrophotometry` action `configure-brass-sample-inventory-action`

#### `atom.observe.confirm-external-material-transition`

**Confirm the completed qualitative result of an externally performed operation**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `receiving-vessel`
- Optional roles: none
- Evidence: the named material recorded in its completed external state, with its established quantities preserved
- Procedural constraints:
  - The operation itself is performed outside learner control; this action asserts only that it is complete.
  - The confirmation follows the actual operation it describes and is gated on that operation's own evidence.
  - Only qualitative fields change. Volume, mass, solutes and concentration are carried through untouched, so no confirmation may create a chemical result.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `B-07` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `confirm-diluted-digest-material-action`

### Family: gravimetry

#### `atom.weigh.dry-assembly`

**Weigh a dried assembly after cooling**

- Verb: `weigh`
- Allowed interaction types: `readInstrument`
- Required roles: `balance-instrument`, `dried-assembly`
- Optional roles: none
- Evidence: recorded dry mass with the matching tare
- Procedural constraints:
  - A warm assembly must not be weighed; the cooling step is a prerequisite, not advice.
  - The tare mass of the assembly must already be recorded before the combined mass is read.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-19` (M)
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-12` (M)
- Content examples:
  - `technique:two-stage-precipitate-drying` action `weigh-practice-combined`
  - `technique:drying` action `weigh-dry-precipitate`
  - `technique:quick-ache-extraction-recovery` action `qar-weigh-acidic-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-weigh-organic-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-weigh-aqueous-solid`

#### `atom.dry.oven-stage`

**Dry an assembly in the oven for a timed stage**

- Verb: `dry`
- Allowed interaction types: `placeInInstrument`
- Required roles: `drying-instrument`, `dried-assembly`
- Optional roles: none
- Evidence: partially or fully dried solid, with the stage recorded
- Procedural constraints:
  - Investigation 3 states two stages separated by breaking up the solid; a single bulk dry is not source-faithful.
  - Oven temperature and stage duration stay teacher-configured within the source range.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-14` (M)
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-17` (M)
- Content examples:
  - `technique:two-stage-precipitate-drying` action `first-practice-drying`
  - `technique:drying` action `dry-precipitate`
  - `technique:quick-ache-extraction-recovery` action `qar-dry-acidic-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-dry-organic-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-dry-aqueous-solid`

#### `atom.cool.before-weighing`

**Cool a heated assembly before weighing**

- Verb: `cool`
- Allowed interaction types: `placeInInstrument`
- Required roles: `dried-assembly`
- Optional roles: `cooling-tool`
- Evidence: cooled assembly cleared for weighing
- Procedural constraints:
  - Cooling is a safety prerequisite and a mass-accuracy prerequisite; it must gate the weighing action rather than appear only as prose.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-18` (M)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-16` (M/C)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-12` (M/R)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-13` (M)
- Content examples:
  - `technique:two-stage-precipitate-drying` action `cool-practice-assembly`
  - `technique:quick-ache-extraction-recovery` action `qar-cool-acidic-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-cool-organic-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-cool-aqueous-solid`

#### `atom.transfer.solid-portion`

**Transfer an approximate portion of a solid reagent into a vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `solid-reagent-source`, `receiving-vessel`
- Optional roles: `solid-transfer-tool`
- Evidence: named solid present in the named vessel, mass still unread
- Procedural constraints:
  - "About 2 g" is the source's own precision. The portion transferred stays approximate, and the balance rather than this atom produces the mass.
  - Each solid in a multi-reagent preparation goes into its own vessel; two solids sharing one vessel is a procedure error, not a shortcut.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-03` (M)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-06` (M)
- Content examples:
  - `technique:hard-water-practice-preparation` action `add-sodium-carbonate-solid`

#### `atom.dissolve.solid-in-solvent`

**Dissolve a weighed solid in its own measured solvent portion**

- Verb: `dissolve`
- Allowed interaction types: `pourInto`
- Required roles: `receiving-vessel`
- Optional roles: `stirring-device`, `measured-solvent-source`
- Evidence: clear dissolved solution in the named vessel
- Procedural constraints:
  - The endpoint is the observed disappearance of the solid, not an elapsed time.
  - Investigation 3 states one dissolution loop per beaker; the loops stay separate so each solid keeps its own recorded mass.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-09` (M)
- Content examples:
  - `technique:hard-water-practice-preparation` action `dissolve-sodium-solid`

#### `atom.transfer.precipitating-reagent`

**Add a portion of precipitating reagent while stirring**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `precipitating-reagent-source`, `precipitation-vessel`
- Optional roles: `stirring-device`
- Evidence: precipitate forming in the vessel after the named portion
- Procedural constraints:
  - The addition is incremental: each portion is a separate step with its own fresh observation, never one bulk-mix control.
  - Reagent excess is an unresolved R/C choice in Investigation 3, so the portion count and amount stay teacher-approved and must not be presented as the source's recipe.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-11` (M)
- Content examples:
  - `technique:hard-water-practice-preparation` action `add-carbonate-portion-1`
  - `technique:hard-water-two-sample-inquiry` action `unknown-c-add-carbonate`
  - `technique:quick-ache-extraction-recovery` action `qar-acidify-recovered-fraction`

#### `atom.precipitate.form-gravimetric-solid`

**Establish the precipitated solid that will be collected gravimetrically**

- Verb: `precipitate`
- Allowed interaction types: `pourInto`
- Required roles: `precipitation-vessel`
- Optional roles: `precipitating-reagent-source`
- Evidence: wet precipitate suspension available for filtration
- Procedural constraints:
  - The configured solid mass is simulator state, not student measurement evidence; only the balance may produce a recorded mass.
  - Completeness of precipitation is the student's claim to justify, so the configured state must not be presented as proof that all the analyte precipitated.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-14` (M)
- Content examples:
  - `technique:hard-water-practice-preparation` action `establish-practice-precipitate-state`
  - `technique:hard-water-two-sample-inquiry` action `unknown-c-precipitate`

#### `atom.weigh.filter-medium-tare`

**Weigh the dry filter medium before it is used**

- Verb: `weigh`
- Allowed interaction types: `readInstrument`
- Required roles: `balance-instrument`, `filter-medium`
- Optional roles: none
- Evidence: recorded dry mass of the filter medium at the configured instrument precision
- Procedural constraints:
  - The medium is weighed dry, before it is seated or wetted; a wetted medium can no longer supply this tare.
  - This tare and the drying-vessel tare are separate recorded values in Investigation 3, and neither may stand in for the other.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-01` (M)
- Content examples:
  - `technique:gravimetric-vacuum-filtration` action `weigh-practice-filter-paper`
  - `technique:quick-ache-extraction-recovery` action `qar-weigh-filter-paper-tare`

#### `atom.place.transfer-medium-to-drying-vessel`

**Move the filter medium and collected solid onto the tared drying vessel**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `filter-medium`, `dried-assembly`
- Optional roles: none
- Evidence: medium and solid resting on the identified, pre-weighed drying vessel
- Procedural constraints:
  - The drying vessel's tare must already be recorded, because after this step the two masses can no longer be separated by weighing.
  - All retained solid moves with the medium; a transfer that drops solid is a loss the student must be able to see, not a silent success.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-11` (M)
  - `what-makes-hard-water-hard_2026-07-27.md` apparatus step `DRY-01` (F)
- Content examples:
  - `technique:two-stage-precipitate-drying` action `transfer-practice-paper-to-watch`
  - `technique:quick-ache-extraction-recovery` action `qar-transfer-solid-to-watch-glass`

### Family: kinetics

#### `atom.place.gas-collection-apparatus`

**Assemble the gas-collection apparatus**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `reaction-vessel`, `gas-delivery-connector`, `gas-collection-instrument`
- Optional roles: none
- Evidence: sealed collection path on a charged reaction vessel, syringe already zeroed and leak-checked
- Procedural constraints:
  - The vessel is sealed only after the reactants are in it: T-11 adds the solid, T-12 seals through the approved expanding or vented path.
  - The delivery train is already connected, zeroed and leak-checked when the seal is made; atom.place.gas-delivery-train and atom.observe.zero-gas-collection-instrument cover those steps.
  - The approved apparatus is a confirmation point; an alternate device is assembled one component at a time.
- Source examples:
  - `how-long-will-that-marble-statue-last_2026-07-27.md` apparatus step `GAS-03` (F)
  - `how-long-will-that-marble-statue-last_2026-07-27.md` phase step `T-02` (M)
- Content examples:
  - `lab:marble-statue-kinetics` action `assemble-gas-apparatus`
  - `technique:marble-gas-syringe-kinetics` action `gas-technique-seat-stopper`

#### `atom.record.timed-gas-volume`

**Record timed gas volume**

- Verb: `record`
- Allowed interaction types: `recordTimeSeries`
- Required roles: `gas-collection-instrument`, `timing-instrument`
- Optional roles: none
- Evidence: time-volume series with its condition identity
- Procedural constraints:
  - The timer starts at the defined reaction start; the sampling interval and stop rule come from the approved plan.
  - Each point is a student read paired with a time, not a generated curve.
- Source examples:
  - `how-long-will-that-marble-statue-last_2026-07-27.md` phase step `T-15` (M)
  - `how-long-will-that-marble-statue-last_2026-07-27.md` phase step `T-13` (R/C)
- Content examples:
  - `lab:marble-statue-kinetics` action `record-practice-run`
  - `lab:marble-statue-kinetics` action `record-acid-2m-run`
  - `lab:marble-statue-kinetics` action `record-acid-4m-run`
  - `lab:marble-statue-kinetics` action `record-acid-6m-run`
  - `technique:marble-gas-syringe-kinetics` action `gas-technique-record-series`

#### `atom.place.gas-delivery-train`

**Assemble the gas delivery train**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `gas-delivery-connector`, `gas-collection-instrument`
- Optional roles: none
- Evidence: delivery connector carrying a connected collection instrument
- Procedural constraints:
  - The train is assembled and verified away from the reaction vessel, because S-06 requires the tubing, stopper and collection device to be inspected before reaction and T-12 seals the vessel only after the reactants are in it.
  - Assembling the train is not the same operation as sealing the vessel with it; atom.place.gas-collection-apparatus covers the seal.
- Source examples:
  - `how-long-will-that-marble-statue-last_2026-07-27.md` apparatus step `GAS-02` (F)
  - `how-long-will-that-marble-statue-last_2026-07-27.md` apparatus step `GAS-03` (F)
- Content examples:
  - `lab:marble-statue-kinetics` action `connect-gas-syringe`
  - `technique:marble-gas-syringe-kinetics` action `gas-technique-connect-syringe`

#### `atom.observe.zero-gas-collection-instrument`

**Zero the gas collection instrument**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `gas-collection-instrument`
- Optional roles: none
- Evidence: recorded baseline reading at the instrument's own precision
- Procedural constraints:
  - The baseline is read from the instrument before any reactant contact; T-10 zeroes the device and T-11 initiates the reaction after it.
  - The zero is a student read, not a simulator assertion: the reading is recorded and nothing generates a starting volume.
- Source examples:
  - `how-long-will-that-marble-statue-last_2026-07-27.md` phase step `T-10` (R)
  - `how-long-will-that-marble-statue-last_2026-07-27.md` apparatus step `GAS-03` (F)
- Content examples:
  - `lab:marble-statue-kinetics` action `zero-gas-syringe`
  - `technique:marble-gas-syringe-kinetics` action `gas-technique-zero-syringe`

#### `atom.weigh.solid-reactant-portion`

**Weigh a solid reactant portion within an approved range**

- Verb: `weigh`
- Allowed interaction types: `readInstrument`
- Required roles: `balance-instrument`, `reactant-solid-source`
- Optional roles: `weighed-vessel`
- Evidence: recorded reactant mass at the configured balance precision
- Procedural constraints:
  - T-07 weighs within an approved range rather than to a single target; the 1.30 g midpoint is a configured value and confirmation point 5 keeps it open.
  - Reading the balance is the evidence path: this atom permits readInstrument only, never placeInInstrument.
- Source examples:
  - `how-long-will-that-marble-statue-last_2026-07-27.md` phase step `T-07` (M)
- Content examples:
  - `lab:marble-statue-kinetics` action `weigh-practice-marble`
  - `technique:marble-gas-syringe-kinetics` action `gas-technique-weigh-marble`

#### `atom.transfer.initiate-solid-reactant-contact`

**Add the weighed solid reactant to the liquid reactant**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `reactant-solid-source`, `reaction-vessel`
- Optional roles: none
- Evidence: weighed solid present in the liquid reactant, vessel still open
- Procedural constraints:
  - This is the reaction start. T-11 adds the CaCO3 to the acid, T-12 seals the vessel through the approved expanding path afterwards, and T-13 starts the timer at the contact event.
  - The vessel must be open when the solid is added, so the delivery train may not already be seated in it.
  - A retried trial consumes fresh configured reactants rather than reusing the mass already transferred.
- Source examples:
  - `how-long-will-that-marble-statue-last_2026-07-27.md` phase step `T-11` (M/R)
- Content examples:
  - `lab:marble-statue-kinetics` action `transfer-practice-marble`
  - `technique:marble-gas-syringe-kinetics` action `gas-technique-transfer-marble`

#### `atom.transfer.initiate-timed-reaction`

**Combine the reactants and start the clock**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `measured-solvent-source`, `reaction-vessel`
- Optional roles: `timing-instrument`
- Evidence: reacting mixture at its stated total volume, with time zero fixed
- Procedural constraints:
  - K-03 is time zero. The timer must already be armed (K-02) before this step runs, so arming cannot be back-filled once a reading exists.
  - Everything between this step and the first accepted reading is dead time, which Investigation 11 finding 9 requires the simulator to record rather than discard.
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `K-03` (M)
- Content examples:
  - `lab:crystal-violet-rate-law` action `cv11-start-reaction-with-naoh`

### Family: measurement

#### `atom.measure.variable-volume`

**Measure a liquid volume with a graduated device**

- Verb: `measureVolume`
- Allowed interaction types: `pourInto`, `readInstrument`
- Required roles: `variable-volume-measuring-device`, `liquid-source`
- Optional roles: `receiving-vessel`
- Evidence: measured volume at the device's precision
- Procedural constraints:
  - The student reads the graduation; the simulator must not report the volume without a read.
  - Preserve the source's stated precision language ("about 20 mL" versus "exactly 100.0 mL").
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-07` (M)
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-03` (M)
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-02` (M)
- Content examples:
  - `technique:measuring-volume` action `measure-20ml`
  - `technique:crystal-violet-micromolar-dilution-series` action `cv11-measure-stock-05`
  - `technique:quick-ache-extraction-recovery` action `qar-measure-approved-organic-volume`
  - `technique:titration-endpoint` action `measure-acid`
  - `technique:beverage-ph-volume-titration` action `practice-hcl-measure`
  - `technique:redox-titration` action `measure-practice-aliquot`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-measure-acid`

#### `atom.measure.fixed-volume-aliquot`

**Fill a fixed-volume vessel to its calibration mark**

- Verb: `measureVolume`
- Allowed interaction types: `pourInto`
- Required roles: `fixed-volume-delivery-device`, `liquid-source`
- Optional roles: none
- Evidence: vessel filled to the mark at the stated final volume
- Procedural constraints:
  - The endpoint is the calibration mark, not a scale reading.
  - Do not substitute a graduated device: the measurement claim the source makes depends on the fixed calibration.
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `C-03` (M)

#### `atom.transfer.measured-liquid`

**Transfer a measured liquid into a receiving vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `measured-solvent-source`, `receiving-vessel`
- Optional roles: none
- Evidence: receiving vessel holding the transferred volume
- Procedural constraints:
  - Measuring and transferring are separate atoms wherever the source states them as separate steps.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-04` (M)
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `PA-02` (M)
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `BTB-02` (M)
- Content examples:
  - `lab:marble-statue-kinetics` action `transfer-practice-acid`
  - `technique:quick-ache-extraction-recovery` action `qar-transfer-approved-solvent`
  - `technique:titration-endpoint` action `transfer-acid-flask`
  - `technique:beverage-ph-volume-titration` action `practice-hcl-transfer`
  - `technique:redox-titration` action `transfer-practice-aliquot`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-transfer-acid-flask`

#### `atom.rinse.quantitative-transfer`

**Rinse a vessel to complete a quantitative transfer**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `rinse-water-source`, `rinsed-vessel`
- Optional roles: none
- Evidence: residue transferred, source vessel visibly rinsed
- Procedural constraints:
  - The rinse volume is deliberately unstated in the source; do not attach a measured quantity to it.
  - A rinse-water source must never be a calibrated delivery device.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-07` (M)
- Content examples:
  - `technique:gravimetric-vacuum-filtration` action `rinse-practice-beaker`
  - `technique:filtration` action `rinse-precipitate`

#### `atom.dilute.to-final-volume`

**Dilute to a stated final volume**

- Verb: `dilute`
- Allowed interaction types: `pourInto`
- Required roles: `measured-solvent-source`, `receiving-vessel`
- Optional roles: none
- Evidence: solution at its stated final volume
- Procedural constraints:
  - The final volume is stated by the source and is the denominator of M1V1 = M2V2, so it belongs to the action rather than to a calculation that reads it back.
  - Investigation 11 prints '10. mL' and that precision is preserved; the atom does not round it.
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `C-03` (M)
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-06` (M/R)
- Content examples:
  - `technique:crystal-violet-micromolar-dilution-series` action `cv11-add-water-05`

#### `atom.dilute.record-resulting-final-volume`

**Dilute and record the resulting final volume**

- Verb: `dilute`
- Allowed interaction types: `pourInto`
- Required roles: `measured-solvent-source`, `receiving-vessel`
- Optional roles: none
- Evidence: solution at its resulting final volume
- Procedural constraints:
  - The action consumes an approved final-volume input, then records the resulting target volume as final evidence after the physical addition.
  - The resulting final-volume measurement is runtime evidence; it is not a graduated test-tube reading.
- Source examples: none; this is a runtime evidence variant of the stated-volume dilution atom.
- Content examples:
  - `technique:transmittance-dilution` action `transmittance-dilution-add-water-below-mark`

#### `atom.rinse.measured-quantitative-transfer`

**Rinse a source vessel with a stated volume for quantitative transfer**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `rinse-water-source`, `rinsed-vessel`
- Optional roles: none
- Evidence: source vessel rinsed with the stated volume and washings retained for transfer
- Procedural constraints:
  - Use this identity only when the source states the rinse volume; an unstated rinse belongs to atom.rinse.quantitative-transfer instead.
  - Each rinse remains a separate physical event so the stated three-to-four repetition can be evidenced rather than summarized.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `B-09` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `rinse-beaker-1-action`

#### `atom.transfer.quantitative-washings`

**Transfer retained washings into the quantitative receiving vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `mixture-source`, `receiving-vessel`
- Optional roles: none
- Evidence: retained rinse washings in the quantitative receiving vessel
- Procedural constraints:
  - The complete retained rinse portion moves to the same quantitative receiver as the bulk sample.
  - The transfer does not create a new measurement or change the source-stated rinse volume.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `B-10` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `transfer-rinse-1-action`

#### `atom.place.select-clean-dry-receiving-vessel`

**Select and place a clean, dry receiving vessel**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `receiving-vessel`
- Optional roles: none
- Evidence: source-stated clean, dry receiving vessel placed in the work area
- Procedural constraints:
  - The source-stated vessel size and clean, dry condition are prerequisites to measuring the sample into it.
  - This atom establishes the vessel; it does not claim that the later measured transfer has occurred.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `CA-01` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P2-H01`

#### `atom.rinse.clean-titration-receiver`

**Rinse an empty titration receiver with the approved rinse quantity**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `rinse-water-source`, `rinsed-vessel`
- Optional roles: none
- Evidence: residue transferred, source vessel visibly rinsed
- Procedural constraints:
  - The rinse volume is deliberately unstated in the source; do not attach a measured quantity to it.
  - A rinse-water source must never be a calibrated delivery device.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `FD-07` (M)
- Content examples:
  - `technique:titration-endpoint` action `dispose-reference-mixture-rinse`
  - `technique:beverage-ph-volume-titration` action `practice-hcl-dispose-rinse`
  - `technique:redox-titration` action `discard-practice-mixture-rinse`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-dispose-rinse`

#### `atom.transfer.measured-liquid-aliquot`

**Transfer a measured liquid aliquot while preserving its identity**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `measured-liquid-source`, `receiving-vessel`
- Optional roles: none
- Evidence: measured liquid aliquot in the named receiving vessel
- Procedural constraints:
  - The source volume has already been read by a calibrated device; this operation transfers that aliquot and does not relabel it as solvent.
  - Measuring and transferring remain distinct authored operations.

### Family: qualitative-analysis

#### `atom.transfer.microsample-portion`

**Transfer a microsample portion into a labelled test vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `sample-source`, `bonding-test-vessel`
- Optional roles: `solid-transfer-tool`
- Evidence: named sample portion present in the named test vessel
- Procedural constraints:
  - K-02 transfers the approved sample amount; the amount itself is confirmation point 2 and stays teacher-approved.
  - Each test consumes a fresh microsample in its own vessel, so one sample's portion never reaches another sample's test.
  - Moving a portion of a blind unknown must not change or disclose its identity.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-02` (R/C)

#### `atom.transfer.apply-test-solvent`

**Apply the selected test solvent or reagent to a microsample**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `bonding-test-solvent-source`, `bonding-test-vessel`
- Optional roles: none
- Evidence: test vessel holding the sample and the applied solvent, outcome unrecorded
- Procedural constraints:
  - K-03 applies the selected solvent or reagent. The identity and the amount come from the approved panel; the simulator supplies neither.
  - The resulting mixture is what section 9 branches on: aqueous conductivity and pH are reachable only once an aqueous test solution exists.
  - The solvent choice determines the waste stream, so the disposal step is not interchangeable between lines.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-03` (M/C)

#### `atom.observe.read-aqueous-conductivity`

**Read the conductivity tester on an aqueous test solution**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `immersed-probe-instrument`, `bonding-test-vessel`
- Optional roles: none
- Evidence: student-recorded reading or category, with the instrument named
- Procedural constraints:
  - Finding 4 restricts the conductivity tester to metals and aqueous solutions, so the read requires an aqueous test solution to exist and never implies arbitrary dry-powder testing.
  - Confirmation point 4 leaves calibration and allowable phases to the teacher, so the atom asserts no units, range or threshold.
  - The reading itself is the student's. This atom proves the instrument and the sample are the ones the step names; it produces no value.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-04` (M)

#### `atom.observe.read-ph-indicator`

**Read pH paper against an aqueous test solution**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `ph-indicator-medium`, `bonding-test-vessel`
- Optional roles: none
- Evidence: student-recorded pH or no-aqueous-sample, with the medium named
- Procedural constraints:
  - Section 9 branches to pH only when an aqueous test solution exists; an insoluble sample yields no-aqueous-sample rather than a pH.
  - The colour match is the student's reading. The simulator does not produce a pH.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-04` (M)

#### `atom.place.melting-point-sample`

**Stage a microsample at the melting-point apparatus**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `melting-point-instrument`, `bonding-test-vessel`
- Optional roles: none
- Evidence: microsample vessel positioned at the named instrument
- Procedural constraints:
  - Confirmation point 3 leaves the apparatus, method and temperature limits unresolved, so staging the sample is the whole of what may be implemented; no heating programme runs and no melting temperature is generated.
  - Staging is a separate step from reading, because K-03 and K-04 are separate rows.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-03` (M/C)

#### `atom.observe.read-melting-behavior`

**Read melting behaviour at the melting-point apparatus**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `melting-point-instrument`, `bonding-test-vessel`
- Optional roles: none
- Evidence: student-recorded temperature or high/low category, with the instrument named
- Procedural constraints:
  - The read requires the sample to be staged at the instrument. Decomposition and no-melt are outcomes the student may record; the atom does not rank them.
  - High versus low is the source's own resolution when a raw temperature is not available, and confirmation point 3 governs which is used.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-04` (M)

#### `atom.observe.test-magnetic-response`

**Test a contained microsample for magnetic response**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `magnetic-response-tool`, `bonding-test-vessel`
- Optional roles: none
- Evidence: student-recorded attraction, no attraction, or ambiguous response
- Procedural constraints:
  - The magnet is brought near a contained sample; samples are never mixed and the sample is not touched by the magnet.
  - Attraction, no attraction, and ambiguous are all admissible outcomes. An ambiguous response lowers confidence rather than forcing a label.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-04` (M)

#### `atom.transfer.dispose-to-waste-stream`

**Dispose of a spent test mixture through the approved waste stream**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `bonding-test-vessel`, `waste-receiver`
- Optional roles: none
- Evidence: spent mixture in the named waste receiver, test vessel empty
- Procedural constraints:
  - K-06 disposes by the approved stream and S-05 requires a properly labelled, SDS-defined container, so the aqueous and organic destinations are not interchangeable.
  - K-05 records the result before cleanup, so disposal must not be reachable before the observation is recorded.
  - The stream itself stays teacher-configured; the atom enforces that a named destination is used, not which one is correct for a given reagent.
- Source examples:
  - `bonding-in-unknown-solids_2026-07-27.md` phase step `K-06` (M/C)

#### `atom.observe.record-property-test-result`

**Record a direct visual property-test result**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `bonding-test-vessel`
- Optional roles: none
- Evidence: directly observed qualitative property-test result
- Procedural constraints:
  - The learner records the visible result in the named test vessel; no unprovided instrument reading or identity claim is implied.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `P-04` (M)

### Family: separation

#### `atom.transfer.weighed-sample-to-vessel`

**Transfer the pre-weighed sample portion into the working vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `weighed-sample-source`, `receiving-vessel`
- Optional roles: `solid-transfer-tool`
- Evidence: the weighed portion in a labelled working vessel with its starting mass on record
- Procedural constraints:
  - The starting mass is read and recorded before the portion moves, so every later percentage has a denominator that was measured rather than assumed.
  - The vessel and the amount are the student's approved choice; neither is fixed here.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-02` (M/C)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-transfer-weighed-sample`
  - `technique:brass-spectrophotometry` action `place-brass-in-beaker-action`

#### `atom.transfer.residual-solid-completion`

**Empty any remaining solid from the named support after its delivery**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `weighed-sample-source`, `receiving-vessel`
- Optional roles: none
- Evidence: the named support left free of remaining solid after its delivery, with no mass added to the record
- Procedural constraints:
  - This is a completeness step that follows an already completed delivery from the same support. It is not the delivery itself and must never be used to make the first one.
  - The behaviour is conditional and both outcomes are truthful: a support still carrying visible solid has that solid moved into the named receiver, and a support already emptied by its delivery completes with no transfer at all.
  - No amount is measured, entered, derived or asserted here. The support's own remaining inventory is the whole quantity, and this step produces no mass evidence of its own.
  - The source row this decomposes states one combined delivery. Splitting a residual sub-step out of it is a real-life-implicit and configuration-level authoring decomposition (R/C), not a separately manual-stated operation. The recorded basis stays the parent row's verbatim basis, because a basis letter describes the source row and not the derivation.
- Source examples:
  - `hand-warmer-design-challenge_2026-07-27.md` phase step `PR-08` (M)
- Content examples:
  - `technique:hand-warmer-calorimetry` action `P1-23`
  - `technique:hand-warmer-calorimetry` action `P1-23-T2`
  - `technique:hand-warmer-calorimetry` action `P1-23-R1`

#### `atom.transfer.charge-extraction-funnel`

**Load an approved phase into the extraction funnel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `extraction-phase-source`, `extraction-funnel`
- Optional roles: none
- Evidence: a closed funnel holding the approved phases with their labels intact
- Procedural constraints:
  - Only phases and volumes the approved plan names may be loaded; the sequence itself is the student's design.
  - The funnel is closed before it is inverted, and venting relieves pressure at the configured interval.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-03` (R/C)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-charge-funnel-aqueous-phase`
  - `technique:quick-ache-extraction-recovery` action `qar-charge-funnel-organic-phase`

#### `atom.transfer.drain-separated-phase`

**Drain one settled phase into its labelled receiver**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `extraction-funnel`, `phase-receiver`
- Optional roles: none
- Evidence: two labelled fractions whose provenance records the stage, the observed layer, and the retained material
- Procedural constraints:
  - The phases must have settled into two distinguishable layers first; an emulsion is a recoverable state, not a layer.
  - Layer identity comes from physical-property evidence, never from position alone, and a wrong-layer drain must be relabelled or recombined rather than silently succeeding.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-07` (R/C)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-drain-lower-layer`
  - `technique:quick-ache-extraction-recovery` action `qar-drain-upper-layer`

#### `atom.transfer.add-drying-agent`

**Dry a separated organic phase with a drying agent**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `drying-agent-source`, `phase-receiver`
- Optional roles: `solid-transfer-tool`
- Evidence: a labelled organic fraction dried to the configured endpoint
- Procedural constraints:
  - The amount and the visual endpoint are configuration points; the source states neither.
  - The drying agent is removed before the solvent is taken off, or it is weighed as product.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-11` (M/C)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-dry-organic-phase-with-mgso4`

#### `atom.rinse.wash-recovered-fraction`

**Wash a recovered solid in its own vessel**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `rinse-water-source`, `rinsed-vessel`
- Optional roles: none
- Evidence: a washed recovered solid still in its labelled vessel
- Procedural constraints:
  - A recovered solid is washed before it is dried, or residual reagent is weighed as product.
  - The rinse volume and the rule for it are configuration points; the source states neither.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-11` (M/C)

#### `atom.transfer.decant-recovered-fraction`

**Decant a collected fraction into a working vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `phase-receiver`, `receiving-vessel`
- Optional roles: none
- Evidence: the same labelled fraction in the vessel its next stage needs
- Procedural constraints:
  - The fraction keeps its label and provenance across the move; a decant is not a new fraction.
  - Nothing is left behind that the later mass evidence would then be missing.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-13` (M)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-decant-filtrate-to-beaker`

#### `atom.mix.extraction-funnel`

**Mix the extraction funnel under configured controls**

- Verb: `mix`
- Allowed interaction types: `recordNotebook`
- Required roles: `extraction-funnel`
- Optional roles: none
- Evidence: qualitative mix state on the named vessel
- Procedural constraints:
  - Requires its typed extractionOperation contract, named vessel and acquired teacher configuration. Mixing invalidates venting, settling and layer readiness; settling never asserts successful separation. No pressure or timing model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-04` (R/C)

#### `atom.vent.extraction-funnel`

**Vent the extraction funnel under configured controls**

- Verb: `vent`
- Allowed interaction types: `recordNotebook`
- Required roles: `extraction-funnel`
- Optional roles: none
- Evidence: qualitative vent state on the named vessel
- Procedural constraints:
  - Requires its typed extractionOperation contract, named vessel and acquired teacher configuration. Mixing invalidates venting, settling and layer readiness; settling never asserts successful separation. No pressure or timing model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-04` (R/C)

#### `atom.settle.extraction-funnel`

**Settle the extraction funnel under configured controls**

- Verb: `settle`
- Allowed interaction types: `recordNotebook`
- Required roles: `extraction-funnel`
- Optional roles: none
- Evidence: qualitative settle state on the named vessel
- Procedural constraints:
  - Requires its typed extractionOperation contract, named vessel and acquired teacher configuration. Mixing invalidates venting, settling and layer readiness; settling never asserts successful separation. No pressure or timing model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-05` (R/C)

#### `atom.dry.fraction-remove-solvent`

**Classroom fraction handling: remove-solvent**

- Verb: `dry`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-recover-organic-component`
  - `technique:quick-ache-extraction-recovery` action `qar-recover-aqueous-component`

#### `atom.observe.fraction-observe-residue`

**Classroom fraction handling: observe-residue**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)
- Content examples:
  - `technique:quick-ache-extraction-recovery` action `qar-precipitate-recovered-component`
  - `technique:quick-ache-extraction-recovery` action `qar-wash-organic-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-wash-aqueous-solid`

#### `atom.transfer.fraction-collect-residue`

**Classroom fraction handling: collect-residue**

- Verb: `transfer`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)

#### `atom.dry.fraction-observe-dryness`

**Classroom fraction handling: observe-dryness**

- Verb: `dry`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)

#### `atom.cool.fraction-observe-cooling`

**Classroom fraction handling: observe-cooling**

- Verb: `cool`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)

#### `atom.transfer.fraction-dispose`

**Classroom fraction handling: dispose**

- Verb: `transfer`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`, `waste-receiver`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)

#### `atom.rinse.fraction-remove-label`

**Classroom fraction handling: remove-label**

- Verb: `rinse`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)

#### `atom.transfer.fraction-remove-drying-agent`

**Classroom fraction handling: remove-drying-agent**

- Verb: `transfer`
- Allowed interaction types: `recordNotebook`
- Required roles: `recovery-vessel`
- Optional roles: none
- Evidence: Named fraction provenance and observed handling state
- Procedural constraints:
  - Requires typed fractionHandling, a named vessel, and actual classroom observations. No predicted identity, distribution or yield. No heating model.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09 to E-13` (R/C)

#### `atom.transfer.unheated-mixture-to-labeled-recovery`

**Return the remaining unheated mixture to its labelled recovery container**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `solid-reagent-source`, `recovery-vessel`
- Optional roles: none
- Evidence: the remaining unheated mixture in its labelled recovery container, the source vessel emptied, and no mass added to the record
- Procedural constraints:
  - EX-08 returns the mixture that was never heated, and S-07 gives it a collection container of its own, separately labelled from the heated product and with the instruction "do not discard or mix them". Sending this material to a waste stream, or into the heated-product container, is a fidelity error and not an acceptable substitute destination.
  - The whole remaining unheated inventory moves. No amount is measured, entered or derived here: EX-07 has already read and recorded the loaded mass, so the return needs no quantity of its own and produces no mass evidence.
  - Moving zero is a truthful outcome rather than a failure. When the issued working portion equals the planned portion there is nothing left over, and the step completes with the labelled "Unused Sample" container still genuinely empty.
  - EX-08 sits between EX-07 and EX-09, so the return follows the recorded loaded mass and precedes the lid, warming and heating steps. A return performed after ignition would put heated product into the unheated container.
  - The same identity also closes out the teacher master stock at the end of a run, where the source vessel is the stock bottle instead of the working vial. That closure is a real-life-implicit and configuration-level authoring decision (R/C), so no citation recorded here may claim the manual states it as a step of its own.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-08` (M)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` safety step `S-07` (M)
- Content examples:
  - `technique:thermal-decomposition-mass-loss` action `recover-unused-sample`
  - `technique:thermal-decomposition-mass-loss` action `finalize-unused-master-stock`

#### `atom.transfer.heated-product-to-labeled-recovery`

**Transfer the cooled heated product to its labelled recovery container**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `weighed-vessel`, `recovery-vessel`
- Optional roles: none
- Evidence: the cooled residue collected in its labelled product container, the crucible emptied, and the recovered product's physical mass left explicitly unknown
- Procedural constraints:
  - EX-19 delivers the heated product to the container labelled "Product Made from Heating Samples", which S-07 keeps separate from the unused mixture. The source saves this product for reuse, so a waste destination contradicts the stated procedure.
  - The recovered product's physical mass is unknown, and this atom must not require, produce or imply one. The source's data list records the empty crucible-and-lid mass, the loaded mass, each heat-cool cycle mass, the accepted final residue mass and the mass lost; it never records a product mass, so a product mass, yield or purity asserted here would be invented rather than measured.
  - The mass series and the composition calculation read the recorded balance readings, never this container's contents. Input-side bookkeeping about how much left the crucible stays bookkeeping: no consumer may read it back as a measured quantity.
  - The whole remaining residue leaves the crucible, and the source must actually hold it. EX-19 follows the accepted constant-mass residue, so an empty crucible at this point means the residue was already lost or moved, which is a real error and not a permitted no-op.
  - Runs only after the cooled constant-mass evidence for the crucible it empties (S-04 and the EX-13 to EX-16 loop). Emptying a warm crucible would also break the same-balance mass series the composition depends on.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-19` (M)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` safety step `S-07` (M)
- Content examples:
  - `technique:thermal-decomposition-mass-loss` action `recover-replicate-product`

#### `atom.observe.extraction-layer-state`

**Observe the settled extraction-layer state**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `extraction-funnel`
- Optional roles: none
- Evidence: observed settled-layer or emulsion state
- Procedural constraints:
  - This observation records whether layers are visibly settled or emulsified without assigning phase identity from position alone.
  - The named funnel must already have completed its settling operation.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-05` (R)

#### `atom.observe.identify-extraction-layers-from-evidence`

**Identify extraction layers from observed physical evidence**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `extraction-funnel`
- Optional roles: none
- Evidence: density-supported aqueous and organic layer identification
- Procedural constraints:
  - The layer identity is a conclusion from the recorded density or other approved physical evidence and may not precede the layer observation.
  - Position alone does not establish aqueous or organic identity.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-06` (M)

#### `atom.observe.read-recovery-ph`

**Read the pH of the recovered fraction**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `recovery-vessel`, `immersed-probe-instrument`, `immersed-probe-vessel`
- Optional roles: none
- Evidence: student-read pH of the recovered fraction
- Procedural constraints:
  - The pH reading is acquired from the named recovered fraction with the configured endpoint threshold; it does not itself assert a precipitate or identity.
  - The probe must be immersed in the recovery vessel when read.
- Source examples:
  - `quick-ache-relief-component-separation_2026-07-27.md` phase step `E-09` (C)

### Family: spectrophotometry

#### `atom.place.photometer`

**Place the photometer on the bench**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `photometer-instrument`
- Optional roles: none
- Evidence: instrument available at its station
- Procedural constraints:
  - The instrument must exist on the bench before any read; a read from an instrument that was never placed is a lifecycle defect.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-08` (R/C)
- Content examples:
  - `technique:blue1-percent-transmittance` action `i1-place-spectrophotometer`
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-place-spectrophotometer`

#### `atom.transfer.fill-cuvette`

**Fill a cuvette with the sample**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `sample-source`, `photometer-sample-holder`
- Optional roles: none
- Evidence: cuvette holding the named sample
- Procedural constraints:
  - Conditioning and orienting the cuvette are separate authored steps wherever the source states them.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-09` (M/R)
- Content examples:
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-fill-cuvette-05`
  - `technique:blue1-percent-transmittance` action `i1-r10-0-fill-cuvette`

#### `atom.place.insert-cuvette`

**Insert the cuvette into the photometer**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `photometer-instrument`, `photometer-sample-holder`
- Optional roles: none
- Evidence: cuvette seated in the instrument slot
- Procedural constraints:
  - The blank must have been read before a sample cuvette is inserted for a quantitative read.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` apparatus step `SPEC-02` (F)
  - `crystal-violet-rate-law_2026-07-27.md` phase step `K-04` (R/C)
- Content examples:
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-insert-cuvette-05`
  - `technique:blue1-percent-transmittance` action `i1-r10-0-insert-cuvette`

#### `atom.observe.blank-photometer`

**Blank and zero the photometer**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `photometer-instrument`, `photometer-sample-holder`
- Optional roles: none
- Evidence: instrument zeroed at the configured wavelength
- Procedural constraints:
  - The blank identity and wavelength are teacher-configured confirmation points in Investigations 1, 2, and 11.
  - Zeroing must be a state transition the later reads depend on, not a notebook note.
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `C-06` (M/C)
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` apparatus step `SPEC-01` (F/C)
- Content examples:
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-prepare-approved-blank`
  - `technique:blue1-percent-transmittance` action `i1-zero-instrument`
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-zero-spectrophotometer`

#### `atom.observe.read-photometer`

**Read the photometer**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `photometer-instrument`
- Optional roles: `photometer-sample-holder`
- Evidence: instrument reading with its unit and precision
- Procedural constraints:
  - Reading and recording are separate steps; the reading is simulator output and the record is student evidence.
  - Preserve the source's quantity: percent transmittance and absorbance are not interchangeable.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-10` (M)
  - `crystal-violet-rate-law_2026-07-27.md` phase step `C-07` (M/R)
- Content examples:
  - `technique:blue1-percent-transmittance` action `i1-r10-0-read-percent-t`
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-read-absorbance-05`

#### `atom.observe.configure-photometer`

**Configure the photometer wavelength and measured quantity**

- Verb: `observe`
- Allowed interaction types: `readInstrument`, `recordNotebook`
- Required roles: `photometer-instrument`
- Optional roles: none
- Evidence: recorded wavelength and measured quantity for the instrument
- Procedural constraints:
  - The measurement wavelength is an open confirmation point in Investigations 1, 2, and 11. This atom records the teacher's value; it never supplies a default and never derives one from the sample.
  - The configured quantity must be named as percent transmittance, decimal transmittance, or absorbance, and may not change between the blank and the reads it authorises.
  - This is a configuration, not a measurement of the sample: it produces no absorbance or transmittance evidence of its own.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-01` (M)
  - `crystal-violet-rate-law_2026-07-27.md` phase step `C-05` (M)
- Content examples:
  - `technique:blue1-percent-transmittance` action `i1-record-wavelength`
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-set-approved-wavelength`

#### `atom.observe.set-active-photometer-wavelength`

**Set the active photometer wavelength from its authored configuration**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `photometer-instrument`
- Optional roles: none
- Evidence: active photometer wavelength configuration with the prior calibration state cleared
- Procedural constraints:
  - Set the actual instrument wavelength only from existing authored configuration evidence: a scan step uses its named source-stated value, while an approved selected-wavelength step requires current teacher-approved evidence; this atom never chooses or supplies a value.
  - The named photometer must be available on the workbench, and changing its wavelength invalidates prior calibration readiness for that instrument.
  - This is an instrument-state configuration, not a sample measurement: it records the configured wavelength but produces no absorbance or transmittance reading.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `P-02` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `configure-approved-wavelength-action`
  - `technique:brass-spectrophotometry` action `scan-set-400-action`

#### `atom.observe.prepare-cuvette-optical-faces`

**Condition, wipe, and orient the cuvette**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `photometer-sample-holder`
- Optional roles: none
- Evidence: cuvette handled under the recorded teacher rule
- Procedural constraints:
  - Investigation 1 finding 3.8 and Investigation 11 finding 3.7 both leave conditioning, orientation, and wiping unspecified (R/C). This atom records the classroom rule and must not be implemented as a stated rinse volume or as a required physical step, which would turn an R practice into a manual-stated requirement.
  - The cuvette this step names is the one the following read must find in the sample compartment.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-08` (R/C)
  - `crystal-violet-rate-law_2026-07-27.md` phase step `C-07` (M/R)
- Content examples:
  - `technique:blue1-percent-transmittance` action `i1-r10-0-condition-orient-cuvette`
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-condition-cuvette-05`

#### `atom.place.remove-cuvette`

**Remove the cuvette from the photometer**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `photometer-instrument`, `photometer-sample-holder`
- Optional roles: none
- Evidence: empty sample compartment and the cuvette back on the bench
- Procedural constraints:
  - Every insertion the source states has a matching removal, because the next sample cannot be seated while the previous one occupies the slot.
  - The blank is removed before the first sample read; removing it does not discard the zero, which is recorded evidence rather than a property of the seated cuvette.
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `C-07` (M/R)
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-08` (R/C)
- Content examples:
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-remove-calibration-cuvette-05`
  - `technique:blue1-percent-transmittance` action `i1-r10-0-remove-cuvette`
  - `technique:brass-spectrophotometry` action `remove-blank-action`

#### `atom.record.photometer-reading`

**Record a photometer reading as evidence**

- Verb: `record`
- Allowed interaction types: `recordNotebook`
- Required roles: `photometer-instrument`
- Optional roles: `photometer-sample-holder`
- Evidence: notebook row carrying the read measurement and its unit
- Procedural constraints:
  - Investigation 1 separates reading the instrument (P-10) from entering the value in the central table (P-11), and Investigation 11 separates K-05 from K-06. The record consumes the measurement the read produced and must not carry a value of its own; an action that supplies its own reading lets a student write down a number without having taken one.
  - The stored unit is the one the read's quantity fixes, so a percent transmittance can never be filed as an absorbance.
- Source examples:
  - `sports-drink-blue-dye-spectroscopy_2026-07-27.md` phase step `P-11` (M)
  - `crystal-violet-rate-law_2026-07-27.md` phase step `K-06` (M)
- Content examples:
  - `technique:blue1-percent-transmittance` action `i1-r10-0-record-percent-t`
  - `technique:crystal-violet-spectrophotometer-calibration` action `cv11-record-absorbance-05`

#### `atom.measure.photometric-aliquot`

**Draw a time-coupled aliquot for a photometric reading**

- Verb: `measureVolume`
- Allowed interaction types: `pourInto`
- Required roles: `sample-source`, `photometric-aliquot-tool`
- Optional roles: none
- Evidence: aliquot of the reacting mixture held in the transfer tool
- Procedural constraints:
  - Investigation 11 finding 9 states that reaction start, mixing, transfer, insertion, and the timer are time-coupled and that the simulator must record dead time, so this step never stops the clock.
  - The aliquot volume is part of the approved plan (K-04, R/C); the atom fixes neither a volume nor a tolerance.
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `K-04` (R/C)
- Content examples:
  - `lab:crystal-violet-rate-law` action `cv11-measure-reacting-aliquot`

#### `atom.dilute.brass-to-approved-final-volume`

**Dilute a brass unknown or standard to its approved final volume**

- Verb: `dilute`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `final-volume-vessel`
- Optional roles: none
- Evidence: mixed brass unknown or labelled standard at its approved final-volume endpoint
- Procedural constraints:
  - The brass unknown uses the manual-stated 100.0 mL flask endpoint.
  - The four standards use the approved final volume without resolving the source plan confirmation point between 10.00 mL and 10.0 mL.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `B-11` (M)
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `D-03` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `dilute-unknown-to-mark-action`
  - `technique:brass-spectrophotometry` action `standard-0p200-dilute-action`

#### `atom.transfer.brass-standard-stock-aliquot`

**Measure and transfer the approved brass-standard stock aliquot**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `variable-volume-measuring-device`, `receiving-vessel`
- Optional roles: none
- Evidence: calculated stock aliquot transferred into its clean labelled standard tube
- Procedural constraints:
  - The aliquot is the student calculation result accepted for that target standard.
  - The graduated pipette supplies the measurement; the stock bottle alone never claims the volume.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `D-02` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `standard-0p200-stock-transfer-action`

#### `atom.transfer.prepare-photometric-blank`

**Fill the photometer sample holder with the approved blank liquid**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `photometer-sample-holder`
- Optional roles: none
- Evidence: clean sample holder filled with the approved blank liquid
- Procedural constraints:
  - The blank liquid and orientation remain part of the approved instrument method.
  - Filling the holder does not calibrate the instrument; insertion and the blanking control remain separate steps.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `S-04` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `prepare-blank-action`

#### `atom.place.brass-color-depth-comparison`

**Place the paired brass color-depth comparison over its white field**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `color-depth-comparison-apparatus`
- Optional roles: none
- Evidence: paired unknown and standard staged for qualitative color-depth matching
- Procedural constraints:
  - The unknown and 0.400 M standard remain separately identifiable and both depth scales remain readable.
  - Placement creates no concentration result; the student must make and record the qualitative match and both depths.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `V-01` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `place-color-depth-comparison-action`

#### `atom.transfer.brass-digest-to-volumetric-flask`

**Transfer the teacher-diluted brass digest into the quantitative flask**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `mixture-source`, `receiving-vessel`
- Optional roles: none
- Evidence: bulk brass digest transferred to the identified 100 mL volumetric flask
- Procedural constraints:
  - The complete teacher-diluted digest moves before any quantitative rinses begin.
  - This bulk transfer creates no new volume measurement; the later calibrated mark establishes the final 100.0 mL volume.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `B-08` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `transfer-digest-action`

#### `atom.rinse.condition-cuvette-with-sample`

**Condition a cuvette with its next sample**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `sample-source`, `photometer-sample-holder`
- Optional roles: none
- Evidence: sample holder conditioned with the provenance-matched next sample
- Procedural constraints:
  - Use the same named solution that will be measured; water or another sample is not an equivalent conditioning liquid.
  - The configured rinse count and approximate rinse portion must come from the source or instance binding; completing the rinse does not fill the cuvette for measurement.
  - Wrong-sample conditioning invalidates the holder for the next read. Recovery is to empty it into the teacher-configured destination and repeat conditioning with the correct sample.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `S-05` (M)

#### `atom.rinse.prepare-cuvette-optical-faces`

**Wipe and orient a filled cuvette for an optical read**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `photometer-sample-holder`
- Optional roles: none
- Evidence: filled sample holder with clean optical faces in the approved orientation
- Procedural constraints:
  - This physical operation is used only where the source states wiping and orientation; it does not replace the evidence-only classroom-rule atom for R/C handling.
  - The holder must already contain the named sample. Fingerprints, droplets, an incorrect fill, or an unpreserved optical orientation invalidate the preparation.
  - Recovery is to clean the optical faces without changing sample identity, restore the approved orientation, and repeat this preparation before insertion.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `S-06` (M)

#### `atom.observe.dark-zero-photometer`

**Set the photometer dark zero with an empty sample compartment**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `photometer-instrument`
- Optional roles: none
- Evidence: instrument dark-zeroed at 0 percent transmittance with the compartment empty
- Procedural constraints:
  - The sample compartment must be empty and closed; a seated blank or sample is an invalid dark-zero state.
  - This establishes 0 percent transmittance only. A separate blank-holder operation establishes 100 percent transmittance afterward.
  - Opening the compartment for the blank does not erase the recorded dark-zero evidence, but a reset or wavelength change requires calibration recovery under the configured method.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `S-03` (M)

#### `atom.transfer.return-cuvette-to-origin`

**Return cuvette contents to the provenance-matched original receiver**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `photometer-sample-holder`, `provenance-matched-sample-receiver`
- Optional roles: none
- Evidence: cuvette emptied into its provenance-matched original receiver without cross-contamination
- Procedural constraints:
  - The receiver must be the same labelled standard or unknown from which the cuvette contents originated.
  - Returning to another concentration, the blank, or an unlabeled receiver is cross-contamination and must be rejected before transfer.
  - If provenance cannot be proven, route the contents according to the teacher-configured waste rule; do not guess an origin.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `S-09` (M)

#### `atom.transfer.adjust-color-depth-standard`

**Remove solution only from the designated color-depth standard until intensities match**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `color-depth-comparison-apparatus`
- Optional roles: `waste-receiver`
- Evidence: one-sided standard depth adjusted to the student's qualitative intensity-match endpoint
- Procedural constraints:
  - Only the configured standard side may lose solution; removing solution from the unknown invalidates the comparison.
  - Adjustment is incremental and stops at the student's visual match. The atom contains no expected depth or concentration result.
  - Overshoot is not repaired by adding solution back under this contract; restart the paired comparison with source-backed portions.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `V-02` (M/F)

#### `atom.observe.read-color-depth`

**Acquire one named solution depth from a color-comparison scale**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `color-depth-comparison-apparatus`
- Optional roles: none
- Evidence: one named unknown-or-standard solution depth acquired from the matched comparison scale
- Procedural constraints:
  - One action acquires exactly one explicitly named side: unknown or matched standard. The two depths are separate evidence identities.
  - The qualitative match must precede both readings, and the apparatus must remain in that matched state between them.
  - No expected depth, ratio, or concentration may be embedded in the atom; recording and downstream calculation consume the acquired evidence separately.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `V-03` (M/F)

#### `atom.transfer.fill-color-depth-pair`

**Fill one arm of the paired color-depth comparison**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `sample-source`, `color-depth-comparison-vessel`
- Optional roles: none
- Evidence: one comparison arm filled from its own labelled sample tube
- Procedural constraints:
  - The unknown and the known standard each get their own comparison tube; the two arms never share a receiver.
  - The poured portion depletes the labelled sample tube it came from and stays within the comparison tube's capacity.
  - This is the initial fill only. Adjusting the standard arm until the intensities match is the separate later operation.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `V-01` (M)
- Content examples:
  - `technique:brass-spectrophotometry` action `fill-color-depth-unknown-action`
  - `technique:brass-spectrophotometry` action `fill-color-depth-standard-action`

### Family: thermal-decomposition

#### `atom.place.balance-instrument`

**Place the selected balance for the thermal route**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `balance-instrument`
- Optional roles: none
- Evidence: selected balance placed at the workbench
- Procedural constraints:
  - The balance is placed before the empty crucible reading and remains the locked instrument for the run.

#### `atom.place.thermal-support`

**Place the stable thermal support assembly**

- Verb: `place`
- Allowed interaction types: `dragToZone`, `snapIntoTarget`
- Required roles: `thermal-support`
- Optional roles: none
- Evidence: stable ring-stand or clay-triangle support
- Procedural constraints:
  - The support is stable before the burner and crucible are positioned.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` apparatus step `HEAT-00` (F/R)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` apparatus step `HEAT-02` (F/R)

#### `atom.place.thermal-heating-instrument`

**Place the Bunsen burner for the thermal route**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `thermal-heating-instrument`
- Optional roles: none
- Evidence: Bunsen burner placed at the heating station
- Procedural constraints:
  - The burner is placed beneath the support and remains off until the approved heating stage.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` apparatus step `HEAT-05` (F/R)

#### `atom.place.thermal-crucible-assembly`

**Place and seat the crucible assembly on its thermal support**

- Verb: `place`
- Allowed interaction types: `dragToZone`, `snapIntoTarget`
- Required roles: `weighed-vessel`
- Optional roles: `thermal-support`
- Evidence: crucible assembly positioned on the thermal support
- Procedural constraints:
  - The crucible is seated on the support and its lid position remains an explicit route condition; this atom does not infer a closed-lid heating state.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` apparatus step `HEAT-03` (F/R)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-09` (M/F)

#### `atom.heat.thermal-decomposition-stage`

**Apply the approved thermal decomposition heating stage**

- Verb: `dry`
- Allowed interaction types: `placeInInstrument`
- Required roles: `thermal-heating-instrument`, `weighed-vessel`
- Optional roles: none
- Evidence: thermal decomposition stage completed on the named crucible
- Procedural constraints:
  - Gentle warming, approved heating, and repeat heating are distinct route stages even though they share the same physical burner and vessel.
  - Duration, intensity, lid position, and constant-mass stopping remain authored route or teacher configuration.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-10` (M/C)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-16` (M/C)

#### `atom.control.thermal-burner`

**Extinguish the thermal decomposition burner before cooling**

- Verb: `reset`
- Allowed interaction types: `dragToZone`
- Required roles: `thermal-heating-instrument`
- Optional roles: none
- Evidence: burner extinguished before cooling
- Procedural constraints:
  - The burner must be off before the hot crucible is moved with tongs.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-11` (R)

### Family: titration

#### `atom.place.burette-filling-funnel`

**Seat a filling funnel in the burette opening**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `titrant-delivery-device`, `burette-filling-funnel`
- Optional roles: none
- Evidence: filling funnel seated upright in the mounted burette opening
- Procedural constraints:
  - The funnel is a temporary filling aid seated only after the burette is mounted and conditioned.
  - This operation is distinct from seating a filtration funnel in a support ring.
- Source examples:
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-01` (R/C)
- Content examples:
  - `technique:titration-endpoint` action `seat-burette-funnel`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-seat-burette-funnel`
  - `technique:redox-titration` action `fill-practice-burette-seat-funnel`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-seat-burette-funnel`

#### `atom.place.remove-burette-filling-funnel`

**Remove the filling funnel before reading the burette**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `titrant-delivery-device`, `burette-filling-funnel`
- Optional roles: none
- Evidence: filling funnel detached from the burette and placed on the workbench
- Procedural constraints:
  - The funnel is removed after filling and before the initial meniscus is read.
  - Set the detached funnel on the workbench so retained drops cannot enter after the reading sequence begins.
- Source examples:
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-01` (R/C)
- Content examples:
  - `technique:titration-endpoint` action `remove-burette-funnel`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-remove-burette-funnel`
  - `technique:redox-titration` action `fill-practice-burette-remove-funnel`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-remove-burette-funnel`

#### `atom.place.mount-burette`

**Mount the burette on its support**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`
- Required roles: `titrant-delivery-device`, `burette-support`
- Optional roles: none
- Evidence: burette clamped above the receiver
- Procedural constraints:
  - The burette must be clamped over the analyte receiver before any titrant is delivered.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `IQ-04` (M)
- Content examples:
  - `technique:titration-endpoint` action `mount-burette`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-mount-burette`
  - `technique:redox-titration` action `mount-redox-burette`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-mount-burette`

#### `atom.rinse.condition-burette`

**Condition the burette with titrant**

- Verb: `rinse`
- Allowed interaction types: `rinseTarget`
- Required roles: `titrant-source`, `titrant-delivery-device`
- Optional roles: `waste-receiver`, `burette-filling-funnel`
- Evidence: burette conditioned and filled, initial reading available
- Procedural constraints:
  - Conditioning uses the titrant itself, not rinse water; a water rinse left in the burette dilutes the titrant.
  - When a burette filling funnel is part of the authored setup, seat it before conditioning and keep it seated through filling.
  - The initial reading is recorded after conditioning and filling, never before.
- Source examples:
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-01` (R/C)
- Content examples:
  - `technique:titration-endpoint` action `condition-burette`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-condition-burette`
  - `technique:redox-titration` action `condition-redox-burette`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-condition-burette`

#### `atom.transfer.add-indicator`

**Add indicator to the analyte**

- Verb: `transfer`
- Allowed interaction types: `dispenseDrops`, `pourInto`
- Required roles: `indicator-source`, `analyte-receiver`
- Optional roles: none
- Evidence: analyte carrying the indicator's pre-endpoint colour
- Procedural constraints:
  - The source says a few drops and, in Investigation 4, lets the student select the indicator. Neither the count nor the identity may be fixed silently.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `PR-02` (M)
- Content examples:
  - `technique:titration-endpoint` action `add-indicator`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-add-indicator`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-add-indicator`

#### `atom.transfer.deliver-titrant`

**Deliver titrant to the analyte**

- Verb: `transfer`
- Allowed interaction types: `dispenseDrops`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: delivered volume and the current colour state
- Procedural constraints:
  - Delivery approaches the endpoint in progressively smaller additions; a single bulk addition is not the same operation.
  - Overshoot must remain reachable and recoverable rather than being prevented silently.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `PR-03` (M)
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-03` (M)

#### `atom.measure.read-burette`

**Read the burette**

- Verb: `measureVolume`
- Allowed interaction types: `readInstrument`
- Required roles: `titrant-delivery-device`
- Optional roles: none
- Evidence: burette reading at the instrument's precision
- Procedural constraints:
  - Initial and final readings are separate reads; the delivered volume is a calculation over them, not a directly reported number.
- Source examples:
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-04` (M)

#### `atom.transfer.discard-titrated-mixture`

**Discard the titrated mixture to the approved waste stream**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `analyte-receiver`, `waste-receiver`
- Optional roles: none
- Evidence: empty receiver and a spent mixture in the named waste receiver
- Procedural constraints:
  - A replicate is only a replicate if it starts from an empty receiver; ST-06 and HP-04 both say fresh trials, and a receiver still holding the previous titrand is the same trial continued.
  - The destination stays teacher-configured. Investigation 8 finding 9 and S-08 route waste through local and instructor procedure, and Investigation 14 S-07 additionally requires neutralisation and a pH test. The atom enforces that a named receiver is used, never which stream is correct.
  - The trial's own evidence is recorded before the mixture is discarded.
- Source examples:
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-06` (M/C)
- Content examples:
  - `technique:titration-endpoint` action `dispose-reference-mixture`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-dispose`
  - `technique:redox-titration` action `discard-practice-mixture`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-dispose`

#### `atom.place.burette-support`

**Set up the burette support**

- Verb: `place`
- Allowed interaction types: `dragToZone`, `snapIntoTarget`
- Required roles: `burette-support`
- Optional roles: none
- Evidence: upright stand with the clamp positioned
- Procedural constraints:
  - TIT-00 and TIT-01 are two source rows - the stand is set upright, then the clamp is attached at the right height - and both precede seating the burette. The support exists before anything is clamped to it.
  - This atom never asserts that a burette is present; that is atom.place.mount-burette.
- Source examples:
  - `acid-base-titration-curves_2026-07-27.md` apparatus step `TIT-00` (F)
  - `acid-base-titration-curves_2026-07-27.md` apparatus step `TIT-01` (F)
- Content examples:
  - `technique:titration-endpoint` action `place-ring-stand`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-place-ring-stand`
  - `technique:redox-titration` action `place-redox-stand`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-place-ring-stand`

#### `atom.place.titration-receiver`

**Position the receiving vessel under the burette tip**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`, `dragToZone`
- Required roles: `analyte-receiver`
- Optional roles: `burette-support`
- Evidence: receiving vessel seated under the burette tip
- Procedural constraints:
  - The tip must be over the vessel before any titrant is delivered; a receiver placed afterwards is a different, wrong sequence.
  - Which vessel is correct depends on the run: an Erlenmeyer is swirled under the tip for an indicator endpoint, and a beaker is admissible only where an immersed pH probe needs the depth and wall clearance. See analyte-receiver.receiverSelection in the role registry.
- Source examples:
  - `acid-base-titration-curves_2026-07-27.md` apparatus step `TIT-03` (F)
- Content examples:
  - `technique:titration-endpoint` action `position-flask-under-burette`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-position-flask-under-burette`
  - `technique:redox-titration` action `position-redox-receiver`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-position-flask-under-burette`

#### `atom.transfer.fill-burette`

**Fill the conditioned burette with titrant**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `titrant-source`, `titrant-delivery-device`
- Optional roles: `burette-filling-funnel`
- Evidence: burette holding titrant, ready to be read
- Procedural constraints:
  - Filling follows conditioning. A burette filled before it is conditioned still holds rinse water, which dilutes the titrant.
  - When a burette-filling-funnel role is bound, that funnel must be live-attached to the burette opening during the transfer and removed before the initial reading.
  - The initial reading is a separate read taken after the fill; the fill itself reports no number.
  - Tip air removal is real-life implicit (Investigation 14 finding 5, R) and stays a configuration point rather than a manual-stated step.
- Source examples:
  - `acid-base-titration-curves_2026-07-27.md` phase step `T-02` (M/R)
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-01` (R/C)
- Content examples:
  - `technique:titration-curve-analysis` action `fill-curve-burette`
  - `technique:titration-endpoint` action `fill-burette`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-fill-burette`
  - `technique:redox-titration` action `fill-practice-burette`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-fill-burette`

#### `atom.transfer.acidify-analyte`

**Acidify the analyte before titrating**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `acidifying-reagent-source`, `analyte-receiver`
- Optional roles: `variable-volume-measuring-device`
- Evidence: acidified analyte in the receiving vessel, with the acid volume recorded
- Procedural constraints:
  - The reaction mixture the titration acts on is analyte plus acid, not the undiluted stock; acidification is a step, never an implied property of the analyte bottle.
  - Investigation 8 bounds the practice acid at no more than 10 mL and leaves the full-run volume to the approved plan, so no exact volume may be fixed here.
  - S-05: solid KMnO4 must never meet H2SO4. This atom acidifies the analyte, never the titrant.
- Source examples:
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `PA-03` (M)
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `HP-02` (M)

#### `atom.place.probe-instrument`

**Place a probe instrument at the titration station**

- Verb: `place`
- Allowed interaction types: `dragToZone`
- Required roles: `immersed-probe-instrument`
- Optional roles: none
- Evidence: probe instrument available at the titration station
- Procedural constraints:
  - The instrument body must be stable at the station before its probe is immersed.
  - Placing the instrument does not assert that the probe is calibrated, rinsed, stable, or immersed.
- Source examples:
  - `acid-base-titration-curves_2026-07-27.md` apparatus step `TIT-04` (F/R/C)
- Content examples:
  - `technique:titration-endpoint` action `place-ph-meter-on-workbench`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-place-ph-meter-on-workbench`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-place-ph-meter-on-workbench`

#### `atom.place.immersed-ph-probe`

**Insert the pH probe into the titration vessel**

- Verb: `place`
- Allowed interaction types: `snapIntoTarget`, `dragToZone`
- Required roles: `immersed-probe-instrument`, `immersed-probe-vessel`
- Optional roles: `stirring-device`
- Evidence: probe immersed in the analyte with the burette overhead
- Procedural constraints:
  - The bulb must be immersed and must not be struck by the stir bar (TIT-04, R/C).
  - Probe calibration and rinsing are explicitly unresolved in both Investigation 4 and Investigation 14; this atom places the probe and never asserts that it is calibrated.
- Source examples:
  - `acid-base-titration-curves_2026-07-27.md` apparatus step `TIT-04` (F/R/C)
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-04` (M)
- Content examples:
  - `technique:titration-curve-analysis` action `place-curve-ph-probe`
  - `technique:titration-endpoint` action `immerse-endpoint-ph-probe`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-immerse-endpoint-ph-probe`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-immerse-endpoint-ph-probe`

#### `atom.observe.read-titration-ph`

**Read pH from the immersed probe**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `immersed-probe-instrument`, `immersed-probe-vessel`
- Optional roles: none
- Evidence: pH at a stated cumulative titrant volume, tagged live or stabilised
- Procedural constraints:
  - Reading and recording are separate steps (Investigation 14 section 11).
  - A reading taken before the pH settles is a different measurement from a stabilised one, and the stability criterion itself is unresolved (finding 4). The atom keeps the two evidence kinds distinct without choosing a number.
  - The indicator colour change and the curve-derived equivalence are distinct evidence and must not be collapsed into one endpoint.
- Source examples:
  - `acid-base-titration-curves_2026-07-27.md` phase step `T-08` (M)
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-07` (M)
- Content examples:
  - `technique:titration-curve-analysis` action `read-initial-ph`

#### `atom.record.titration-record-initial`

**Titration: record-initial**

- Verb: `record`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `record-initial-burette`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-record-initial-burette`
  - `technique:redox-titration` action `record-practice-initial-burette`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-record-initial-burette`

#### `atom.transfer.titration-deliver`

**Titration: deliver**

- Verb: `transfer`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `deliver-titrant`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-deliver-titrant`
  - `technique:redox-titration` action `dispense-practice-permanganate`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-deliver-titrant`

#### `atom.mix.titration-mix`

**Titration: mix**

- Verb: `mix`
- Allowed interaction types: `recordNotebook`
- Required roles: `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `deliver-titrant-mix`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-deliver-titrant-mix`
  - `technique:redox-titration` action `dispense-practice-permanganate-mix`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-deliver-titrant-mix`

#### `atom.observe.titration-observe`

**Titration: observe**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `deliver-titrant-observe`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-initial-color`
  - `technique:redox-titration` action `dispense-practice-permanganate-observe`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-initial-color`

#### `atom.observe.titration-read-ph`

**Titration: read-ph**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `immersed-probe-instrument`, `immersed-probe-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `read-endpoint-ph`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-initial-ph`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-initial-ph`

#### `atom.record.titration-record-point`

**Titration: record-point**

- Verb: `record`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `deliver-titrant-record-point`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-initial-row`
  - `technique:redox-titration` action `dispense-practice-permanganate-record-point`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-initial-row`

#### `atom.observe.titration-decide`

**Titration: decide**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `deliver-titrant-decide`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-deliver-titrant-decide`
  - `technique:redox-titration` action `dispense-practice-permanganate-decide`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-deliver-titrant-decide`

#### `atom.observe.titration-decide-curve`

**Titration: decide-curve**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-finish-curve`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-finish-curve`

#### `atom.record.titration-record-final`

**Titration: record-final**

- Verb: `record`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `record-final-burette`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-record-final-burette`
  - `technique:redox-titration` action `record-practice-final-burette`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-record-final-burette`

#### `atom.observe.titration-archive-retry`

**Titration: archive-retry**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `deliver-titrant-retry-reset`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-deliver-titrant-retry-reset`
  - `technique:redox-titration` action `dispense-standardization-1-permanganate-retry-reset`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-deliver-titrant-retry-reset`

#### `atom.observe.titration-read-initial`

**Titration: read-initial**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `read-initial-burette`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-read-initial-burette`
  - `technique:redox-titration` action `read-practice-initial-burette`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-read-initial-burette`

#### `atom.observe.titration-read-final`

**Titration: read-final**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:titration-endpoint` action `deliver-titrant-read-final`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-deliver-titrant-read-final`
  - `technique:redox-titration` action `dispense-practice-permanganate-read-final`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-deliver-titrant-read-final`

#### `atom.observe.titration-practice-read-initial`

**Titration: practice-read-initial**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `liquid-source`, `reaction-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-read-initial`

#### `atom.transfer.titration-practice-deliver`

**Titration: practice-deliver**

- Verb: `transfer`
- Allowed interaction types: `recordNotebook`
- Required roles: `liquid-source`, `reaction-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-deliver`

#### `atom.mix.titration-practice-mix`

**Titration: practice-mix**

- Verb: `mix`
- Allowed interaction types: `recordNotebook`
- Required roles: `reaction-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-mix`

#### `atom.observe.titration-practice-observe`

**Titration: practice-observe**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `reaction-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-observe`

#### `atom.record.titration-practice-record-point`

**Titration: practice-record-point**

- Verb: `record`
- Allowed interaction types: `recordNotebook`
- Required roles: `liquid-source`, `reaction-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-record-point`

#### `atom.observe.titration-practice-decide`

**Titration: practice-decide**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `liquid-source`, `reaction-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-decide`

#### `atom.observe.titration-practice-archive-retry`

**Titration: practice-archive-retry**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `liquid-source`, `reaction-vessel`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-archive-retry`

#### `atom.transfer.discard-practice-mixture`

**Discard the titrated mixture to the approved waste stream (test-tube practice)**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `reaction-vessel`, `waste-receiver`
- Optional roles: none
- Evidence: empty receiver and a spent mixture in the named waste receiver
- Procedural constraints:
  - A replicate is only a replicate if it starts from an empty receiver; ST-06 and HP-04 both say fresh trials, and a receiver still holding the previous titrand is the same trial continued.
  - The destination stays teacher-configured. Investigation 8 finding 9 and S-08 route waste through local and instructor procedure, and Investigation 14 S-07 additionally requires neutralisation and a pH test. The atom enforces that a named receiver is used, never which stream is correct.
  - The trial's own evidence is recorded before the mixture is discarded.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `PR-01 through PR-04` (M/R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-dispose`

#### `atom.transfer.add-practice-indicator`

**Add indicator to the analyte (test-tube practice)**

- Verb: `transfer`
- Allowed interaction types: `dispenseDrops`, `pourInto`
- Required roles: `indicator-source`, `reaction-vessel`
- Optional roles: none
- Evidence: analyte carrying the indicator's pre-endpoint colour
- Procedural constraints:
  - The source says a few drops and, in Investigation 4, lets the student select the indicator. Neither the count nor the identity may be fixed silently.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `PR-01 through PR-04` (M/R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `practice-hcl-indicator`

#### `atom.calculate.titration-calculate-curve`

**Titration: calculate-curve**

- Verb: `calculate`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-concentration`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-concentration`

#### `atom.transfer.burette-rinsate-to-waste`

**Route burette rinsate or tip purge to approved waste**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `titrant-delivery-device`, `waste-receiver`
- Optional roles: none
- Evidence: empty receiver and a spent mixture in the named waste receiver
- Procedural constraints:
  - A replicate is only a replicate if it starts from an empty receiver; ST-06 and HP-04 both say fresh trials, and a receiver still holding the previous titrand is the same trial continued.
  - The destination stays teacher-configured. Investigation 8 finding 9 and S-08 route waste through local and instructor procedure, and Investigation 14 S-07 additionally requires neutralisation and a pH test. The atom enforces that a named receiver is used, never which stream is correct.
  - The trial's own evidence is recorded before the mixture is discarded.
- Source examples:
  - `hydrogen-peroxide-redox-titration_2026-07-27.md` phase step `ST-06` (M/C)
- Content examples:
  - `technique:titration-endpoint` action `condition-burette-drain-residual`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-condition-burette-drain-residual`
  - `technique:redox-titration` action `condition-redox-burette-drain-residual`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-condition-burette-drain-residual`

#### `atom.observe.titration-review-standardization`

**Titration: review-standardization**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:redox-titration` action `review-standardization-concordance`

#### `atom.observe.titration-select-equivalence`

**Titration: select-equivalence**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-concentration-select-equivalence`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-concentration-select-equivalence`

#### `atom.observe.titration-approve-equivalence`

**Titration: approve-equivalence**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`, `analyte-receiver`
- Optional roles: none
- Evidence: An independently observable typed titration state transition or scoped evidence operation.
- Procedural constraints:
  - Use only the named trial and its current physical equipment and recorded evidence.
  - Teacher-approved quantities, persistence, and disposal remain configuration.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03 through T-09` (R)
- Content examples:
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-concentration-approve-equivalence`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-concentration-approve-equivalence`

#### `atom.observe.burette-tip-inspection`

**Inspect the prepared burette tip**

- Verb: `observe`
- Allowed interaction types: `recordNotebook`
- Required roles: `titrant-delivery-device`
- Optional roles: none
- Evidence: Learner records the observed tip condition.
- Procedural constraints:
  - Inspect after the separate tip purge.
- Source examples:
  - `acid-in-fruit-juice-and-soft-drinks_2026-07-27.md` phase step `T-03` (R/C)
- Content examples:
  - `technique:titration-endpoint` action `fill-burette-check-tip`
  - `technique:beverage-ph-volume-titration` action `beverage-a-sample-trial-1-fill-burette-check-tip`
  - `technique:redox-titration` action `fill-practice-burette-check-tip`
  - `technique:ph-volume-titration-trial` action `beverage-a-sample-trial-1-fill-burette-check-tip`

### Family: waste-treatment

#### `atom.transfer.route-to-waste-treatment`

**Route residual reagent into the treatment vessel**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `waste-receiver`
- Optional roles: none
- Evidence: residual reagent collected in the treatment vessel
- Procedural constraints:
  - Treatment happens in a named vessel, not in the sink: S-06 requires the crystal violet to be bleached and the excess base neutralised before anything is disposed of.
  - The disposal destination itself stays a teacher configuration (confirmation point 6).
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `W-01` (M)
- Content examples:
  - `technique:crystal-violet-waste-treatment` action `cv11-transfer-cv-waste`

#### `atom.transfer.treat-waste-to-endpoint`

**Add treatment reagent until an approved endpoint**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `liquid-source`, `waste-receiver`
- Optional roles: none
- Evidence: treated waste at the instructor-defined endpoint
- Procedural constraints:
  - The endpoint is verified rather than assumed. W-01 bleaches with sufficient hydroxide and W-02 neutralises with an approved acid; both endpoints are instructor-defined (confirmation point 6), so no pH target or volume is fixed here.
  - Decolorisation is an observation about the dye, never evidence about pH: the two verifications are separate steps.
- Source examples:
  - `crystal-violet-rate-law_2026-07-27.md` phase step `W-02` (M/C)
- Content examples:
  - `technique:crystal-violet-waste-treatment` action `cv11-bleach-waste-with-naoh`
  - `technique:crystal-violet-waste-treatment` action `cv11-neutralize-excess-base`

#### `atom.transfer.treat-waste-with-solid-to-endpoint`

**Add a solid treatment reagent incrementally until the observable endpoint**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `solid-reagent-source`, `waste-receiver`
- Optional roles: `solid-transfer-tool`
- Evidence: waste treated incrementally with solid reagent until active bubbling subsides
- Procedural constraints:
  - Add the solid in small portions and allow each reaction increment to subside before adding more; a single bulk charge is invalid and has no local undo, so retain the waste, stop, and follow teacher-directed recovery before any fresh restart.
  - Subsided bubbling is the observable treatment endpoint, not proof that the pH is acceptable. A separate endpoint-reading atom acquires pH evidence.
  - The atom never chooses the final disposal route; teacher direction remains required after the endpoint evidence is complete.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` safety step `S-08` (M/C)

#### `atom.observe.read-waste-ph-indicator`

**Read the treated waste endpoint with pH paper**

- Verb: `observe`
- Allowed interaction types: `readInstrument`
- Required roles: `ph-indicator-medium`, `waste-receiver`
- Optional roles: none
- Evidence: student-acquired pH-paper reading for treated waste, with pass or retreat disposition
- Procedural constraints:
  - Read only after incremental treatment has stopped active bubbling; reaction gas or untreated waste invalidates the paper reading.
  - The source-stated acceptable interval is 5 through 9. A reading outside that interval returns to incremental treatment and a fresh paper reading.
  - The pH evidence enables teacher-directed disposal but does not select or execute the disposal route.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` safety step `S-08` (M/C)

#### `atom.transfer.collect-sample-for-treatment`

**Collect a used solution into the shared treatment container**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `sample-source`, `waste-receiver`
- Optional roles: none
- Evidence: the used solution accumulated in the named treatment container, with its source tube emptied
- Procedural constraints:
  - Collection precedes treatment; it neither treats the waste nor decides its final destination.
  - Repeated collections accumulate in the shared receiver. An earlier portion is never overwritten or discarded.
  - Gathering the used solutions into one shared container is the local bench implementation of the stated pre-disposal treatment, not a manual-stated step of its own.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` safety step `S-08` (M/R/C)
- Content examples:
  - `technique:brass-spectrophotometry` action `collect-0p0250-waste-action`
  - `technique:brass-spectrophotometry` action `collect-unknown-waste-action`
  - `technique:brass-spectrophotometry` action `collect-color-depth-unknown-waste-action`

#### `atom.transfer.treated-waste-to-designated-destination`

**Hand treated waste to the teacher-designated destination**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `recovery-vessel`, `waste-receiver`
- Optional roles: none
- Evidence: treated waste delivered to the teacher-designated destination after the recorded safe endpoint
- Procedural constraints:
  - Runs only after the stated treatment endpoint is reached: bubbling subsided and the recorded pH inside the stated range.
  - The destination is supplied by local teacher configuration. No sewer, hazardous-waste stream or institutional category is ever hard-coded here.
  - The source treatment container and the destination receiver are distinct named vessels.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` safety step `S-08` (M/C)
- Content examples:
  - `technique:brass-spectrophotometry` action `transfer-treated-waste-to-destination-action`

### Family: weighing

#### `atom.weigh.tare-vessel`

**Tare an empty vessel on the balance**

- Verb: `weigh`
- Allowed interaction types: `readInstrument`
- Required roles: `balance-instrument`, `weighed-vessel`
- Optional roles: none
- Evidence: zeroed balance for the named vessel
- Procedural constraints:
  - The vessel must be clean and dry before the tare is accepted.
  - The displayed precision stays teacher-configured; do not assert a fixed number of decimal places.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-02` (R)
- Content examples:
  - `technique:brass-spectrophotometry` action `tare-empty-beaker-action`
  - `technique:quick-ache-extraction-recovery` action `qar-weigh-acidic-watch-glass-tare`
  - `technique:quick-ache-extraction-recovery` action `qar-weigh-organic-watch-glass-tare`
  - `technique:quick-ache-extraction-recovery` action `qar-weigh-aqueous-watch-glass-tare`

#### `atom.weigh.solid-portion`

**Weigh a portion of solid into a vessel**

- Verb: `weigh`
- Allowed interaction types: `readInstrument`
- Required roles: `balance-instrument`, `weighed-vessel`
- Optional roles: `solid-transfer-tool`
- Evidence: recorded mass at the configured instrument precision
- Procedural constraints:
  - An approximate source quantity such as "about 2 g" stays approximate; do not silently substitute an exact target.
  - Reading the balance and recording the value are separate steps in every dated plan that states both.
- Source examples:
  - `what-makes-hard-water-hard_2026-07-27.md` phase step `PR-03` (M)
  - `equilibrium-rainbow-display_2026-07-27.md` phase step `CUCL-01` (M)
- Content examples:
  - `technique:hard-water-practice-preparation` action `weigh-sodium-carbonate`
  - `technique:equilibrium-rainbow-inquiry` action `copper-chloride-weigh-solid`
  - `technique:quick-ache-extraction-recovery` action `qar-record-starting-mass`
  - `technique:brass-spectrophotometry` action `weigh-brass-action`

#### `atom.weigh.vessel-supported-balance-display`

**Read the balance value indicated for a vessel or support**

- Verb: `weigh`
- Allowed interaction types: `readInstrument`
- Required roles: `balance-instrument`, `weighed-vessel`
- Optional roles: none
- Evidence: the balance value indicated for the named vessel or support, at the configured instrument precision
- Procedural constraints:
  - The operation is observing and recording the value the balance indicates for the identified vessel or support. It does not place material, dispense stock, zero the instrument, infer a net mass, establish constant mass, or assert that a residue was oven-dried.
  - The tare convention is decided outside this atom and is not selected by it. A tared baseline legitimately indicates zero and an untared assembly legitimately indicates a positive gross mass; this contract asserts neither interpretation.
  - The quantity is the bound action's own finite non-negative balance-display contract. An action may add further source-supported input constraints; this atom adds none.
  - The displayed precision stays teacher-configured; do not assert a fixed number of decimal places.
  - Cool/dry state, prior-step order and balance selection remain obligations of the bound action's prerequisites and parameters. This contract does not by itself enforce any physical state, and no runtime enforcement may be claimed from it.
  - Reading the balance and recording the value are separate steps in every dated plan that states both.
- Source examples:
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-04` (R)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-07` (M/R)
  - `purify-a-mixture-green-chemistry_2026-07-27.md` phase step `EX-14` (M)
- Content examples:
  - `technique:thermal-decomposition-mass-loss` action `read-empty-crucible`
  - `technique:thermal-decomposition-mass-loss` action `weigh-initial-crucible`
  - `technique:thermal-decomposition-mass-loss` action `weigh-preliminary-final-mass`
  - `technique:thermal-decomposition-mass-loss` action `weigh-final-crucible`

#### `atom.transfer.load-solid-onto-weighing-support`

**Load a solid portion from its stock container onto the weighing support**

- Verb: `transfer`
- Allowed interaction types: `pourInto`
- Required roles: `solid-reagent-source`, `weighed-vessel`
- Optional roles: `solid-transfer-tool`
- Evidence: the solid portion resting on the named weighing support, with the stock container depleted by that portion
- Procedural constraints:
  - The portion has no recorded mass yet, so this transfer must not require or consume weighing evidence.
  - The delivered amount comes from the stock container's own inventory. Nothing here creates material.
  - The support must be the clean, dry vessel the balance reading will name.
- Source examples:
  - `how-can-color-determine-copper-in-brass_2026-07-27.md` phase step `B-01` (M/R)
- Content examples:
  - `technique:brass-spectrophotometry` action `load-brass-onto-weighing-support-action`

## Equipment roles

A role is a constraint, not a synonym for one apparatus id. Capacity, tolerance, fixed-versus-variable delivery, the source instruction, safety, and learning intent decide which equipment may fill it. Widening allowedEquipmentIds requires a source justification recorded in the entry's rationale.

| Role | Kind | Allowed equipment | Prohibited | Rationale |
|---|---|---|---|---|
| `balance-instrument` | instrument | `analytical-balance` | — | Investigation 3 lists the balance as +/-0.001 or +/-0.0001 g and leaves the choice to the teacher, so the role fixes the apparatus but never the displayed precision. |
| `weighed-vessel` | vessel | `beaker-150ml`, `beaker-250ml`, `crucible-with-lid`, `erlenmeyer-flask-250ml`, `test-tube`, `watch-glass`, `weigh-boat` | — | Any clean, dry container the procedure weighs directly. A warm vessel is a procedure error, not a different role. |
| `solid-transfer-tool` | tool | `scoopula`, `spatula` | — | Investigation 3 names a metal scoop; a spatula is the same manipulation at microscale. Neither delivers a measured quantity. |
| `variable-volume-measuring-device` | delivery | `beaker-150ml`, `burette-50ml`, `graduated-cylinder`, `graduated-cylinder-25ml`, `graduated-pipette-10ml`, `luer-lock-syringe` | `volumetric-flask`, `wash-bottle`, `beral-pipette` | Graduated apparatus can deliver any volume within its range and is read by the student. A volumetric flask holds one calibrated volume and cannot serve here; a wash bottle and a Beral pipette are not calibrated at all. |
| `fixed-volume-delivery-device` | delivery | `volumetric-flask` | `graduated-cylinder`, `graduated-cylinder-25ml`, `burette-50ml` | A single calibration mark defines the volume, so the student fills to the mark instead of reading a scale. Substituting a graduated device changes the measurement claim the source makes. |
| `measured-solvent-source` | delivery | `beaker-150ml`, `burette-50ml`, `graduated-cylinder`, `graduated-cylinder-25ml`, `graduated-pipette-10ml`, `volumetric-flask` | `wash-bottle`, `distilled-water-bottle` | Investigation 5 states an approved solvent amount for the developing chamber and Investigation 3 states about 20 mL of distilled water. Investigation 12 CA-07 transfers the already measured 100.0 mL hot-water sample from its 150 mL beaker into the calorimeter, so that beaker may carry measured-volume provenance forward. Delivering any of these from a wash bottle would present an unmeasured stream as a stated volume. |
| `rinse-water-source` | delivery | `distilled-water-bottle`, `wash-bottle` | `burette-50ml`, `graduated-cylinder`, `graduated-cylinder-25ml`, `volumetric-flask` | The manual rinses with small quantities of water and never assigns the rinse a volume. Using a calibrated device here would invent a quantity the source does not state. |
| `liquid-source` | delivery | `distilled-water-bottle`, `dropper-bottle`, `naoh-bottle`, `propanol-bottle`, `reagent-bottle`, `rubbing-alcohol-bottle`, `sample-bottle`, `unknown-acid-bottle`, `wash-bottle` | — | Stock containers and droppers from which a graduated device measures a stated volume. They originate the liquid but do not establish the measurement precision. |
| `solid-reagent-source` | delivery | `reagent-bottle`, `sample-bottle`, `small-vial` | — | Named solids may be supplied in a small vial or stock bottle. The source delivers the approximate portion; the balance produces the recorded mass. |
| `precipitating-reagent-source` | delivery | `beaker-150ml`, `beaker-250ml`, `burette-50ml`, `graduated-cylinder`, `graduated-cylinder-25ml`, `reagent-bottle` | — | The two Investigation 3 phases deliver carbonate from different vessels: PR-11 pours prepared Na2CO3 solution out of the practice beaker, INQ-02 draws 0.50 M Na2CO3 from a reagent container. Finding 12 (R/C) leaves the excess to the student within teacher-approved constraints, so the role admits both and fixes neither the vessel nor the amount. |
| `precipitation-vessel` | vessel | `beaker-150ml`, `beaker-250ml`, `erlenmeyer-flask-250ml` | — | PR-11 through PR-15 and INQ-06/INQ-07 form and age CaCO3 in the vessel that later feeds FD-06. It is distinct from reaction-vessel, whose gas-collection sealing constraint belongs to Investigation 10. |
| `receiving-vessel` | vessel | `beaker-150ml`, `beaker-250ml`, `crucible-with-lid`, `erlenmeyer-flask-250ml`, `hand-warmer-calorimeter`, `polystyrene-cup-8oz`, `side-arm-filter-flask`, `test-tube`, `volumetric-flask`, `watch-glass` | — | General destination for a transfer where the source does not constrain the vessel further. Investigation 12 PR-08 and CA-07 receive weighed solid or measured hot water in the inner nested cup; the hand-warmer-calorimeter definition is the runtime identity of that assembled vessel so its visible state, contents, and hit target remain one object. |
| `analyte-receiver` | vessel | `beaker-150ml`, `beaker-250ml`, `erlenmeyer-flask-250ml` | `foam-cup-calorimeter`, `polystyrene-cup-8oz`, `hand-warmer-calorimeter` | Holds the measured aliquot being titrated and must be swirlable under a burette tip. An insulated calorimeter cup is a thermal vessel, not a titration receiver. |
| `acidifying-reagent-source` | delivery | `graduated-cylinder`, `graduated-cylinder-25ml`, `graduated-pipette-10ml`, `reagent-bottle` | `wash-bottle`, `distilled-water-bottle`, `beral-pipette` | Investigation 8 PA-03 adds no more than 10 mL of 6 M H2SO4 to acidify the standard, and HP-02 acidifies each peroxide aliquot with the approved volume. The volume is bounded but never fixed, so the role requires a device that reads a volume and refuses uncalibrated streams. mustNotContactSolidOxidiser records S-05: the acid is delivered to the analyte, never to solid KMnO4. |
| `waste-receiver` | vessel | `waste-beaker` | — | Every dated plan routes waste through a named destination. The destination itself stays a configuration point. |
| `filtration-support` | support | `funnel-stand`, `ring-stand` | — | GRAV-00 in Investigation 3 places the support before any funnel or paper. |
| `filtration-funnel` | vessel | `buchner-funnel`, `funnel`, `funnel-stand` | — | Investigation 3 confirmation point S-04 leaves gravity versus vacuum filtration unresolved, so the role admits both apparatus families and the choice stays configured. |
| `filter-medium` | consumable | `filter-paper` | — | FD-01 weighs the dry paper before it is seated or wetted. |
| `filtration-receiver` | vessel | `beaker-150ml`, `beaker-250ml`, `erlenmeyer-flask-250ml`, `side-arm-filter-flask` | — | GRAV-04 aligns the receiver under the outlet before any pour. A side-arm flask is required only in the vacuum configuration. |
| `filtration-vacuum-source` | tool | `vacuum-source` | — | Investigation 3 lists a vacuum filtration apparatus but never illustrates or enumerates it (finding 3, M/C), and confirmation point 1 leaves gravity versus vacuum open. The role exists so the vacuum configuration can be assembled explicitly rather than implied, and it is unfilled in the gravity configuration. |
| `mixture-source` | delivery | `beaker-150ml`, `beaker-250ml`, `erlenmeyer-flask-250ml` | — | FD-06 requires a slow pour without overflow, so the source vessel is part of the validated behaviour. |
| `rinsed-vessel` | vessel | `beaker-150ml`, `beaker-250ml`, `erlenmeyer-flask-250ml`, `funnel`, `test-tube` | — | FD-07 rinses the beaker for quantitative transfer; the same role covers conditioning rinses elsewhere. |
| `drying-instrument` | instrument | `drying-oven` | — | FD-13 states 110-120 C. The range is source-stated; the exact setpoint stays configurable. |
| `dried-assembly` | vessel | `crucible-with-lid`, `watch-glass`, `weigh-boat` | — | DRY-00 and DRY-01 put the pre-weighed, labelled watch glass under the paper and precipitate. |
| `cooling-tool` | tool | `crucible-tongs` | — | S-05 and S-06 require heat-safe handling and full cooling before the assembly is weighed. |
| `photometer-instrument` | instrument | `spectrophotometer` | — | Investigations 1, 2, and 11 all leave the wavelength a confirmation point, and all three blank the instrument before the first sample read. |
| `photometer-sample-holder` | vessel | `cuvette` | — | SPEC-01 and SPEC-02 distinguish the blank cuvette from the sample cuvette; both are the same role filled at different times. |
| `sample-source` | delivery | `beral-pipette`, `distilled-water-bottle`, `graduated-pipette-10ml`, `reagent-bottle`, `sample-bottle`, `small-vial`, `test-tube` | — | The container or pipette a measured sample is drawn from when the source step does not constrain the delivery precision. A distilled-water bottle is included when the approved water volume is the measured source liquid. |
| `burette-filling-funnel` | vessel | `funnel` | — | ST-01 identifies a funnel among the titration filling apparatus (R/C). This role is limited to temporarily filling a burette and cannot satisfy the separate filtration-funnel role. |
| `titrant-delivery-device` | delivery | `burette-50ml` | — | ST-01 conditions and fills the burette and records an initial reading before any titrant is delivered. |
| `burette-support` | support | `ring-stand`, `ring-stand-clamp` | — | IQ-04 sketches the burette clamped over the flask; the stand and clamp are the same support role. |
| `titrant-source` | delivery | `naoh-bottle`, `reagent-bottle` | — | Investigation 4 leaves the NaOH concentration to the student's approved plan, so the stock label is configuration, not a fixed value. |
| `indicator-source` | delivery | `dropper-bottle`, `phenolphthalein-dropper` | — | PR-02 adds a few drops; PR-04 lets the student select the indicator. Neither states a volume. |
| `developing-chamber` | vessel | `chromatography-chamber` | — | CHR-01 and CHR-05 fix a configured depth and a closed lid before the front is allowed to rise. |
| `stationary-phase` | consumable | `chromatography-paper` | — | TR-06 requires the lower edge in solvent and the spot above it; the geometry is part of the role. |
| `spotting-tool` | tool | `capillary-spotter` | — | CHR-03 marks the capillary spotter R/C: real-life implicit and still a configuration choice. |
| `reaction-vessel` | vessel | `beaker-250ml`, `erlenmeyer-flask-250ml`, `test-tube` | — | GAS-00 places the reaction flask before the delivery stopper is inserted. |
| `gas-delivery-connector` | tool | `rubber-stopper-delivery-tube` | — | GAS-01 through GAS-04 insert, connect, and leak-check the delivery path before any timed reading. |
| `gas-collection-instrument` | instrument | `gas-syringe` | — | GAS-03 connects a zeroed gas syringe; a non-zero start invalidates the collected series. |
| `timing-instrument` | instrument | `data-collection-interface`, `stopwatch` | — | K-02 arms the timer or data collection before mixing; the sampling interval is part of the approved plan. |
| `stress-reagent-source` | delivery | `distilled-water-bottle`, `dropper-bottle`, `naoh-bottle`, `reagent-bottle`, `small-vial`, `unknown-acid-bottle` | — | Investigation 13 applies approved concentration stresses from labelled droppers, reagent containers, small vials, and distilled water; the reagent identity and amount remain source- or teacher-configured. |
| `equilibrium-vessel` | vessel | `beaker-250ml`, `luer-lock-syringe`, `luer-lock-syringe-locked`, `test-tube` | — | Investigation 13 prepares stock equilibria in 250 mL beakers, trials in test tubes, and the pressure demonstration in a Luer-lock syringe; the active vessel carries the mixture or pressure state without implying a quantitative concentration. |
| `thermal-bath` | vessel | `beaker-250ml` | — | BATH-01 through BATH-03 place the bath beaker, add hot or ice water, and insert a thermometer. |
| `calorimeter-vessel` | vessel | `foam-cup-calorimeter`, `hand-warmer-calorimeter`, `polystyrene-cup-8oz` | — | CAL-01 nests the cup calorimeter on the stirrer; the nested cups are the insulating boundary. |
| `calorimeter-cover` | tool | `wooden-calorimeter-cover` | — | CAL-04 places the wooden lid with holes aligned before CAL-05 inserts the thermometer. |
| `immersed-probe-instrument` | instrument | `conductivity-tester`, `ph-meter`, `probe-thermometer`, `thermometer` | — | CAL-03 and CAL-05 require the bulb immersed in the liquid and clear of the cup bottom and sides. |
| `immersed-probe-vessel` | vessel | `beaker-150ml`, `beaker-250ml`, `erlenmeyer-flask-250ml`, `foam-cup-calorimeter`, `hand-warmer-calorimeter`, `polystyrene-cup-8oz`, `test-tube` | — | Distinct from analyte-receiver: the constraint is liquid depth over the probe, not swirlability under a burette tip. Cycle 09 added beaker-150ml and erlenmeyer-flask-250ml on the strength of two source rows rather than convenience: Investigation 14 TIT-03 places a 'flask/beaker' under the tip and TIT-04 then immerses the probe in whichever was chosen, and Investigation 4 T-02/T-04 measures the beverage aliquot into a flask and inserts the probe there. A vessel that is both an analyte-receiver and an immersed-probe-vessel must satisfy both roles; see analyte-receiver.receiverSelection for which is correct for a given endpoint. |
| `stirring-device` | tool | `hot-plate-stirrer`, `magnetic-stir-bar`, `stirring-rod` | — | Investigation 3 says stir but does not name a tool (an R classification); Investigation 12 uses a magnetic stirrer. Both fill one role. |
| `reactant-solid-source` | delivery | `marble-chips`, `reagent-bottle`, `sample-bottle`, `small-vial` | — | T-06 and T-07 select a chip-size class and weigh CaCO3 within an approved range, and T-11 adds it to the acid. The role fixes where the solid comes from and leaves both the mass and the surface-area class to the student and the teacher, because Investigation 10 confirmation point 2 keeps the treatment ranges open. Distinct from solid-reagent-source, whose rationale is Investigation 3's bottled powders. |
| `bonding-test-vessel` | vessel | `test-tube`, `watch-glass` | — | K-01 labels one test location per sample and test line, and Investigation 6 section 9 consumes a fresh microsample for each line unless the teacher approves otherwise, so the vessel identity is part of the evidence. Two tests may share one line's portion only when the non-destructive one runs first: magnetism before a melting stage, never after it. Not reaction-vessel, which carries Investigation 10's mustBeSealedForGasCollection constraint and misdescribes an open test tube. |
| `bonding-test-solvent-source` | delivery | `distilled-water-bottle`, `naoh-bottle`, `reagent-bottle` | — | K-03 applies the selected solvent or reagent. Investigation 6 finding 3 lists water, ethanol, hexanes, 0.1 M HCl and 0.1 M NaOH as candidates and finding 5 keeps hexanes and iodine in the hood under teacher control, so the role names the container and leaves both the identity and the amount to the approved panel. |
| `melting-point-instrument` | instrument | `melting-point-apparatus` | — | Investigation 6 confirmation point 3 leaves the melting-point apparatus, method and temperature limits to the teacher, so the role fixes the apparatus and asserts no heating programme. The simulator stages a sample at the instrument and never produces a melting temperature. |
| `ph-indicator-medium` | tool | `ph-paper` | — | K-04 reads the pH screen. Investigation 6 section 9 branches to pH only when an aqueous test solution exists, so the role records that the medium is meaningless without one. Separate from immersed-probe-instrument, which describes a probe immersed in a liquid rather than paper touched to it. |
| `magnetic-response-tool` | tool | `magnet` | — | K-04 brings the magnet near a contained fresh microsample and records attraction, no attraction, or an ambiguous response. The constraint is the one the source states: the sample stays contained and samples are not mixed. |
| `distance-measuring-instrument` | instrument | `metric-ruler` | — | Investigation 5 lists a metric ruler and states every distance to the nearest millimetre (TR-12, TR-14). The apparatus is fixed; the useful division follows the configured strip length (confirmation point 3), so the role names the instrument and never the precision. |
| `extraction-funnel` | vessel | `separatory-funnel` | — | Investigation 9 supplies a separatory funnel for liquid-liquid and acid-base extraction. Finding 3.5 marks venting, layer labelling, and emulsion recovery R/C, so the role records that they are required and configured rather than fixing an interval. |
| `extraction-phase-source` | delivery | `beaker-250ml`, `erlenmeyer-flask-250ml`, `graduated-cylinder`, `graduated-cylinder-25ml`, `reagent-bottle` | — | E-03 and E-08 load approved phases and fresh washes into the funnel, and the source names no vessel for either: students choose the sequence and volumes (§10). The role admits any vessel the approved plan could have prepared the phase in and requires the phase to carry a label, which is what finding 3.5 asks for. |
| `phase-receiver` | vessel | `beaker-250ml`, `erlenmeyer-flask-250ml`, `side-arm-filter-flask`, `test-tube` | — | E-07 drains one layer into its labelled vessel and retains the other. §9 requires each fraction to keep identity and provenance, so the constraint is the label rather than the glassware. |
| `weighed-sample-source` | delivery | `reagent-bottle`, `sample-bottle`, `small-vial`, `watch-glass`, `weigh-boat` | — | E-01 records the starting Quick Ache Relief mass before E-02 begins, so the container the portion leaves is the one the balance already read. It is distinct from solid-reagent-source, which delivers an approximate portion from bulk stock with no recorded mass of its own. |
| `drying-agent-source` | delivery | `reagent-bottle`, `small-vial` | — | Investigation 9 supplies MgSO4 with no amount and no endpoint (finding 3.3, 3.5). The role exists so drying the organic phase is a real transfer, and leaves both the quantity and the visual endpoint configured. |
| `photometric-aliquot-tool` | delivery | `beral-pipette`, `graduated-pipette-10ml` | `wash-bottle` | K-04 fills and inserts the cuvette 'as approved without delaying unrecorded time', so the tool that moves a reacting sample into the cuvette is chosen by the approved plan rather than by a stated volume. It is distinct from variable-volume-measuring-device because the source assigns this step no measurement; the quantity that matters is the elapsed time, not the aliquot. |
| `locking-pin` | tool | `locking-nail` | — | Investigation 13 apparatus state SYR-06 inserts the nail through the extended plunger hole only after the syringe valve is closed. The role identifies that physical lock without treating the nail as a delivery or measurement device. |
| `heating-instrument` | instrument | `hot-plate-stirrer` | — | Investigation 12 CA-02 heats a water-filled beaker on the hot plate to approximately 50 degrees C. The role identifies the heater while leaving the accepted range and recovery rule teacher-configured. |
| `heated-liquid-vessel` | vessel | `beaker-150ml`, `beaker-250ml` | — | Investigation 12 CA-01 through CA-03 uses a clean, dry 150 mL beaker for the 100.0 mL hot-water sample. The broader beaker family remains valid for the reusable operation, but no role fixes a temperature. |
| `final-volume-vessel` | vessel | `test-tube`, `volumetric-flask` | — | Investigation 2 B-11 uses the 100.0 mL flask mark and D-03 uses the instructor-approved standard volume in the stated test-tube series. The role records the endpoint vessel without resolving the 10.00 mL versus 10.0 mL confirmation point. |
| `color-depth-comparison-apparatus` | instrument | `brass-color-depth-comparison` | — | Investigation 2 V-01 through V-03 compares the unknown beside the 0.400 M standard over a white field and records both depths. The apparatus supports that qualitative method and does not produce a concentration reading. |
| `equilibrium-rack` | vessel | `sample-rack` | — | C-07 and R-06 use racks to keep trial tubes organized and to present the final six-color evidence sequence. |
| `equilibrium-reagent-tray` | support | `reagent-tray` | — | C-02 and C-13 select and return one system-specific reagent tray at a time so reagents are not mixed across equilibrium systems. |
| `equilibrium-mixture-source` | delivery | `beaker-250ml`, `luer-lock-syringe` | — | C-07 and P-10 transfer a prepared equilibrium mixture from its stock beaker or syringe without inventing an unsupported aliquot volume. |
| `equilibrium-mixture-receiver` | vessel | `luer-lock-syringe`, `test-tube` | — | C-07 receives trial aliquots in test tubes and P-01 receives the soda-indicator mixture in the sealed syringe apparatus. |
| `thermal-bath-instrument` | instrument | `thermometer` | — | BATH-03 requires a thermometer to verify the teacher-approved bath condition rather than assuming a temperature. |
| `provenance-matched-sample-receiver` | vessel | `test-tube` | — | Investigation 2 S-09 returns each cuvette portion to the original standard or unknown test tube. The role requires the receiver identity to match the sample provenance instead of accepting any chemically compatible vessel. |
| `recovery-vessel` | vessel | `watch-glass`, `filter-paper`, `erlenmeyer-flask-250ml`, `beaker-250ml`, `side-arm-filter-flask`, `waste-beaker` | — | Physical handling retains the named fraction without inferring identity or yield. |
| `measured-liquid-source` | delivery | `beaker-150ml`, `beaker-250ml`, `graduated-cylinder`, `graduated-cylinder-25ml`, `graduated-pipette-10ml`, `sample-bottle`, `volumetric-flask` | — | A measured aliquot may be carried forward from a graduated source without calling it a solvent. The role preserves the authored volume provenance while leaving the liquid identity to the source vessel. |
| `thermal-support` | support | `ring-stand`, `clay-triangle` | — | The thermal route needs the ring stand and clay triangle as a stable support assembly before the crucible is heated. This role does not substitute for the burner or the weighed vessel. |
| `thermal-heating-instrument` | instrument | `bunsen-burner` | — | The approved thermal decomposition route uses a Bunsen burner for gentle warming and repeated heating. The exact intensity and duration remain configuration values. |
| `color-depth-comparison-vessel` | vessel | `test-tube` | — | Investigation 2 V-01 fills a dedicated comparison tube for each arm of the paired visual method, and V-02 then removes solution from the standard arm only. The receiving tube is a material endpoint distinct from the comparison apparatus that holds the pair over the white field, and distinct from the original labelled tube a measured cuvette portion is returned to at S-09. |

### Deliberate distinctions

- `rinse-water-source` must not be confused with `measured-solvent-source`.
- `solid-reagent-source` must not be confused with `liquid-source`.
- `precipitation-vessel` must not be confused with `reaction-vessel`.
- `analyte-receiver` must not be confused with `immersed-probe-vessel`.
- `acidifying-reagent-source` must not be confused with `titrant-source`, `rinse-water-source`.
- `filtration-vacuum-source` must not be confused with `filtration-support`.
- `immersed-probe-vessel` must not be confused with `analyte-receiver`.
- `extraction-phase-source` must not be confused with `measured-solvent-source`.
- `phase-receiver` must not be confused with `receiving-vessel`.
- `weighed-sample-source` must not be confused with `solid-reagent-source`.
- `photometric-aliquot-tool` must not be confused with `variable-volume-measuring-device`, `sample-source`.
- `provenance-matched-sample-receiver` must not be confused with `receiving-vessel`, `phase-receiver`.
- `measured-liquid-source` must not be confused with `measured-solvent-source`, `liquid-source`.
- `color-depth-comparison-vessel` must not be confused with `receiving-vessel`, `provenance-matched-sample-receiver`, `color-depth-comparison-apparatus`.
