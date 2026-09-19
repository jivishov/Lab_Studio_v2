/**
 * Reviewed source selections for generated item-2 contextual traces.
 *
 * The generated groups are intentionally contextual: a cited source row supports the shared
 * operation boundary, while the owner action remains authoritative for its own material identity,
 * quantities, configuration and evidence contract.  Keep selections here instead of relying on
 * array order in the source registry or atom examples.
 */

const locator = (sourceFile, sourceTable, step, basis) => ({
  sourceFile,
  sourceTable,
  step,
  basis,
});
const locatorKey = (source) => [source.sourceFile, source.sourceTable, source.step, source.basis].join("|");

const selections = {};
const setFor = (owners, atomIds, source) => {
  for (const owner of owners) {
    for (const atomId of atomIds) selections[`${owner}|${atomId}`] = source;
  }
};
const setForActionPrefixes = (owners, atomIds, actionPrefixes, source) => {
  for (const owner of owners) {
    for (const atomId of atomIds) {
      for (const actionPrefix of actionPrefixes) {
        selections[`${owner}|${atomId}|action-prefix:${actionPrefix}`] = source;
      }
    }
  }
};

const beverage = "technique:beverage-ph-volume-titration";
const formal = "technique:ph-volume-formal-titration-trial";
const phVolume = "technique:ph-volume-titration-trial";
const redox = "technique:redox-titration";

// The reviewed cross-activity families identified in the item-2 repair.  These are operation
// boundaries only; none of these entries transfers the cited experiment's analyte or quantity.
setFor([beverage], ["atom.measure.variable-volume"], locator(
  "what-makes-hard-water-hard_2026-07-27.md", "phase", "PR-07", "M",
));
setFor([beverage], [
  "atom.place.burette-filling-funnel",
  "atom.place.remove-burette-filling-funnel",
  "atom.rinse.condition-burette",
], locator("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-01", "R/C"));
setFor([beverage], ["atom.place.burette-support"], locator(
  "acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-00", "F",
));
setFor([beverage], ["atom.place.probe-instrument"], locator(
  "acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-04", "F/R/C",
));
setFor([beverage], ["atom.place.titration-receiver"], locator(
  "acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-03", "F",
));
setFor([beverage], ["atom.rinse.clean-titration-receiver"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "safety", "S-05", "M/C",
));
setFor([beverage], [
  "atom.transfer.burette-rinsate-to-waste",
  "atom.transfer.discard-titrated-mixture",
  "atom.transfer.discard-practice-mixture",
], locator("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "safety", "S-05", "M/C"));
setFor([beverage], ["atom.mix.titration-mix"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-07", "M",
));
setFor([beverage], ["atom.observe.titration-read-final"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-08", "M",
));
setFor([beverage], ["atom.transfer.fill-burette"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-02", "M/R",
));
setFor([beverage], ["atom.transfer.measured-liquid"], locator(
  "sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-04", "M",
));

setFor([formal], ["atom.measure.variable-volume"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-03", "M",
));
setFor([formal], ["atom.mix.titration-mix"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-04", "M/R",
));
setFor([formal], ["atom.observe.burette-tip-inspection"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-02", "M/R",
));
setFor([formal], [
  "atom.observe.titration-archive-retry",
  "atom.observe.titration-decide-curve",
], locator("acid-base-titration-curves_2026-07-27.md", "phase", "T-10", "M/C"));
setFor([formal], [
  "atom.observe.titration-observe",
  "atom.observe.titration-read-ph",
], locator("acid-base-titration-curves_2026-07-27.md", "phase", "T-08", "M"));
setFor([formal], ["atom.observe.titration-read-final"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-09", "M",
));
setFor([formal], ["atom.observe.titration-read-initial"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-02", "M/R",
));
setFor([formal], ["atom.place.burette-filling-funnel", "atom.place.remove-burette-filling-funnel"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-01", "R/C",
));
setFor([formal], ["atom.place.mount-burette"], locator(
  "acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-02", "F",
));
setFor([formal], [
  "atom.record.titration-record-final",
  "atom.record.titration-record-initial",
  "atom.record.titration-record-point",
], locator("acid-base-titration-curves_2026-07-27.md", "phase", "T-09", "M"));
setFor([formal], ["atom.rinse.clean-titration-receiver"], locator(
  "acid-base-titration-curves_2026-07-27.md", "safety", "S-07", "M/C",
));
setFor([formal], ["atom.rinse.condition-burette"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-01", "R/C",
));
setFor([formal], [
  "atom.transfer.burette-rinsate-to-waste",
  "atom.transfer.discard-titrated-mixture",
  "atom.transfer.discard-practice-mixture",
], locator("acid-base-titration-curves_2026-07-27.md", "safety", "S-07", "M/C"));
setFor([formal], ["atom.transfer.measured-liquid"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-03", "M",
));
setFor([formal], ["atom.transfer.titration-deliver"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-06", "M/C",
));

setFor([phVolume], ["atom.measure.variable-volume"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-02", "M/R",
));
setFor([phVolume], [
  "atom.place.burette-filling-funnel",
  "atom.place.remove-burette-filling-funnel",
  "atom.rinse.condition-burette",
], locator("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-03", "R/C"));
setFor([phVolume], ["atom.place.burette-support"], locator(
  "acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-00", "F",
));
setFor([phVolume], ["atom.place.probe-instrument"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-04", "M",
));
setFor([phVolume], ["atom.place.titration-receiver"], locator(
  "acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-03", "F",
));
setFor([phVolume], ["atom.rinse.clean-titration-receiver"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "safety", "S-05", "M/C",
));
setFor([phVolume], [
  "atom.transfer.burette-rinsate-to-waste",
  "atom.transfer.discard-titrated-mixture",
  "atom.transfer.discard-practice-mixture",
], locator("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "safety", "S-05", "M/C"));
setFor([phVolume], ["atom.mix.titration-mix"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-07", "M",
));
setFor([phVolume], ["atom.observe.titration-read-final"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-08", "M",
));
setFor([phVolume], ["atom.transfer.fill-burette"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-02", "M/R",
));
setFor([phVolume], ["atom.transfer.measured-liquid"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-02", "M/R",
));

setFor(["technique:quick-ache-property-evidence"], [
  "atom.transfer.apply-test-solvent",
], locator("bonding-in-unknown-solids_2026-07-27.md", "phase", "K-03", "M/C"));
setFor(["technique:quick-ache-property-evidence"], ["atom.transfer.microsample-portion"], locator(
  "bonding-in-unknown-solids_2026-07-27.md", "phase", "K-02", "R/C",
));

// Cleanup actions are split by material and destination.  The source plans do not authorize a
// single generic fraction-disposal citation: hard-water solids go to S-08, source-approved
// liquids use S-07, and marker removal uses S-09.  The quick-ache S-05 row is retained only as a
// teacher-designated liquid-waste boundary; it does not establish a solid-specific destination.
setForActionPrefixes(["technique:hard-water-two-sample-inquiry"], ["atom.rinse.fraction-remove-label"], [
  "cleanup-unknown-c-watch-remove-marker",
  "cleanup-unknown-d-watch-remove-marker",
], locator("what-makes-hard-water-hard_2026-07-27.md", "safety", "S-09", "M"));
setForActionPrefixes(["technique:hard-water-two-sample-inquiry"], ["atom.transfer.fraction-dispose"], [
  "cleanup-unknown-c-watch-dispose",
  "cleanup-unknown-d-watch-dispose",
  "cleanup-unknown-c-paper-dispose",
  "cleanup-unknown-d-paper-dispose",
], locator("what-makes-hard-water-hard_2026-07-27.md", "safety", "S-08", "M"));
setForActionPrefixes(["technique:hard-water-two-sample-inquiry"], ["atom.transfer.fraction-dispose"], [
  "cleanup-unknown-c-flask-dispose",
  "cleanup-unknown-d-flask-dispose",
  "cleanup-unknown-c-gravity-receiver-dispose",
  "cleanup-unknown-d-gravity-receiver-dispose",
], locator("what-makes-hard-water-hard_2026-07-27.md", "safety", "S-07", "M"));
setForActionPrefixes(["technique:two-stage-precipitate-drying"], ["atom.rinse.fraction-remove-label"], [
  "cleanup-practice-watch-glass-remove-marker",
], locator("what-makes-hard-water-hard_2026-07-27.md", "safety", "S-09", "M"));
setForActionPrefixes(["technique:two-stage-precipitate-drying"], ["atom.transfer.fraction-dispose"], [
  "cleanup-practice-watch-glass-dispose",
  "cleanup-practice-dry-paper-dispose",
], locator("what-makes-hard-water-hard_2026-07-27.md", "safety", "S-08", "M"));
setForActionPrefixes(["technique:two-stage-precipitate-drying"], ["atom.transfer.fraction-dispose"], [
  "dispose-practice-filtrate",
  "cleanup-practice-gravity-receiver-dispose",
], locator("what-makes-hard-water-hard_2026-07-27.md", "safety", "S-07", "M"));
setForActionPrefixes(["technique:quick-ache-extraction-recovery"], ["atom.transfer.fraction-dispose"], [
  "cleanup-qar-",
], locator("quick-ache-relief-component-separation_2026-07-27.md", "safety", "S-05", "M/C"));

setFor([redox], ["atom.mix.titration-mix"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-03", "M",
));
setFor([redox], ["atom.observe.burette-tip-inspection"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-01", "R/C",
));
setFor([redox], ["atom.observe.titration-archive-retry", "atom.observe.titration-decide"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-06", "M/C",
));
setFor([redox], ["atom.observe.titration-observe", "atom.observe.titration-read-final"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-04", "M",
));
setFor([redox], ["atom.observe.titration-review-standardization"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-06", "M/C",
));
setFor([redox], ["atom.place.titration-receiver"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-02", "M/C",
));
setFor([redox], [
  "atom.record.titration-record-final",
  "atom.record.titration-record-initial",
  "atom.record.titration-record-point",
], locator("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-04", "M"));
setFor([redox], ["atom.rinse.clean-titration-receiver"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "safety", "S-08", "M/C",
));
setFor([redox], [
  "atom.transfer.burette-rinsate-to-waste",
  "atom.transfer.discard-titrated-mixture",
], locator("hydrogen-peroxide-redox-titration_2026-07-27.md", "safety", "S-08", "M/C"));
setFor(["technique:thermal-decomposition-mass-loss"], ["atom.observe.configure-solid-stock-inventory"], locator(
  "how-can-color-determine-copper-in-brass_2026-07-27.md", "apparatus", "BRASS-01", "F",
));

// Ambiguous same-owner selections are also explicit.  These retain the operation-specific source
// row rather than taking the first direct trace or the first atom example.
const sameOwnerSelections = {
  [`technique:blue1-percent-transmittance|atom.place.insert-cuvette|R/C`]: locator(
    "sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-08", "R/C",
  ),
  [`technique:blue1-percent-transmittance|atom.observe.read-photometer|M`]: locator(
    "sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-10", "M",
  ),
  [`technique:blue1-percent-transmittance|atom.place.remove-cuvette|R/C`]: locator(
    "sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-08", "R/C",
  ),
  [`technique:gravimetric-vacuum-filtration|atom.place.filter-medium|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-04", "M",
  ),
  [`technique:gravimetric-vacuum-filtration|atom.rinse.wet-filter-medium|C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-05", "M",
  ),
  [`technique:two-stage-precipitate-drying|atom.dry.oven-stage|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-14", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.weigh.dry-assembly|M`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "INQ-06", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.dry.oven-stage|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-14", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.cool.before-weighing|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-18", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.place.filtration-funnel|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "apparatus", "GRAV-01", "F/C",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.place.filter-medium|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-04", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.place.filtration-receiver|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "apparatus", "GRAV-04", "F",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.rinse.wet-filter-medium|C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-05", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.filter.pour-through-medium|R/C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-06", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.rinse.quantitative-transfer|C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-07", "M",
  ),
  [`technique:hard-water-two-sample-inquiry|atom.rinse.wash-precipitate|C`]: locator(
    "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-08", "M",
  ),
  [`technique:paper-chromatography|atom.transfer.charge-developing-chamber|R/C`]: locator(
    "sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-02", "M/C",
  ),
  [`technique:paper-chromatography|atom.transfer.load-spotting-tool|R/C`]: locator(
    "sticky-question-paper-chromatography_2026-07-27.md", "apparatus", "CHR-03", "F/R/C",
  ),
  [`technique:paper-chromatography|atom.spotSample.apply-baseline-spot|R/C`]: locator(
    "sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-04", "M/R",
  ),
  [`technique:paper-chromatography|atom.place.insert-strip-into-chamber|R/C`]: locator(
    "sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-06", "M/R",
  ),
  [`technique:paper-chromatography|atom.place.remove-developed-strip|R/C`]: locator(
    "sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-09", "R",
  ),
  [`technique:redox-titration|atom.measure.variable-volume|R/C`]: locator(
    "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "PA-02", "M",
  ),
  [`technique:redox-titration|atom.measure.variable-volume|C`]: locator(
    "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "PA-02", "M",
  ),
  [`technique:redox-titration|atom.transfer.discard-titrated-mixture|R/C`]: locator(
    "hydrogen-peroxide-redox-titration_2026-07-27.md", "safety", "S-08", "M/C",
  ),
  [`technique:ph-volume-formal-titration-trial|atom.place.burette-support|R/C`]: locator(
    "acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-00", "F",
  ),
};

export const REVIEWED_SOURCE_SELECTIONS = Object.freeze({ ...selections, ...sameOwnerSelections });

const reviewedDecision = ({
  reviewId,
  sourceSupports,
  transferValidity,
  quantityAndConfigurationLimits,
  notSupported,
  reviewStatus = "reviewed-static-source-mapping",
  decisionDisposition = "reviewed-contextual",
}) => ({
  reviewId,
  reviewStatus,
  decisionDisposition,
  sourceSupports,
  transferValidity,
  quantityAndConfigurationLimits,
  notSupported,
});

export const REVIEWED_ATOM_DECISIONS = Object.freeze({
  "atom.measure.variable-volume": reviewedDecision({
    reviewId: "item2-shared-variable-volume-v2",
    sourceSupports: "The cited row supports measuring a liquid with a graduated device and treating the reading as a measured-volume operation.",
    transferValidity: "The owner action retains its own source and target instances, read/evidence contract, tolerance and configured volume; only the shared measurement operation is transferred.",
    quantityAndConfigurationLimits: "Preserve the owner action's volumeMl, tolerance, unit, configurationParameter and sourceInventory rules. A cited about-20-mL or other source quantity is not copied into the owner action.",
    notSupported: "The citation does not establish the owner's analyte identity, concentration, aliquot value, stock volume, trial count or analytical result.",
  }),
  "atom.transfer.measured-liquid": reviewedDecision({
    reviewId: "item2-shared-measured-liquid-v2",
    sourceSupports: "The cited row supports transferring an already measured liquid into a receiving vessel as a distinct operation.",
    transferValidity: "The owner action keeps measurement and transfer separate and names its own source/target instances; the mapping does not merge the two operations.",
    quantityAndConfigurationLimits: "Use the owner's volumeMl or configured amount and its source/target identity. Do not copy the cited liquid, concentration or quantity.",
    notSupported: "The citation does not establish the owner's material identity, vessel capacity, analytical result or downstream chemistry.",
  }),
  "atom.observe.titration-review-standardization": reviewedDecision({
    reviewId: "item2-redox-standardization-review-v2",
    sourceSupports: "The redox ST-06 row supports repeated fresh standardization trials and averaging as the source boundary for reviewing concordance.",
    transferValidity: "The owner action remains tied to its named standardization trials, calculations and teacher choice; the source row supplies the repeat-and-review context only.",
    quantityAndConfigurationLimits: "Preserve the owner action's trialReferenceIds, calculationIds, standardizationRangeM and teacher-configured persistence and disposal settings.",
    notSupported: "The citation does not prescribe a concordance threshold, a particular molarity, an endpoint volume or the acceptance choice for this simulator action.",
  }),
  "atom.observe.titration-decide-curve": reviewedDecision({
    reviewId: "item2-titration-curve-decision-v2",
    sourceSupports: "The acid-base T-10 row supports repeating measured curve points through the post-equivalence region and deciding when the curve is sufficient.",
    transferValidity: "The owner action consumes its own named trial and recorded pH-volume evidence; the mapping transfers only the loop/decision boundary.",
    quantityAndConfigurationLimits: "Keep the owner's increment, stability, endpoint, identity and teacher-configuration parameters. The source row does not replace those values.",
    notSupported: "The citation does not establish a universal stop threshold, pH value, volume limit or accepted curve for the owner.",
  }),
  "atom.observe.configure-solid-stock-inventory": reviewedDecision({
    reviewId: "item2-configured-solid-inventory-v2",
    sourceSupports: "The BRASS-01 apparatus row supports the named brass material and its source-level apparatus context; it is used here only as the closest source boundary for finite stock setup.",
    transferValidity: "The owner action is explicitly teacherConfiguration/sourceInventory setup, not a learner balance reading; the mapping preserves that distinction and the named container.",
    quantityAndConfigurationLimits: "Keep the teacher-supplied mass, sourceInventory metadata and action configuration. Do not copy the BRASS-01 1-2 g sample range into the configured stock value.",
    notSupported: "The citation does not establish the green-chemistry stock amount, a learner measurement, a capacity, a scan quantity or an analytical result.",
  }),
});

const mappingDecisions = {};
const setMappingDecision = (owners, atomIds, source, decision) => {
  for (const owner of owners) {
    for (const atomId of atomIds) {
      mappingDecisions[`${owner}|${atomId}|${locatorKey(source)}`] = reviewedDecision(decision);
    }
  }
};

const safetyBoundaryDecision = ({ reviewId, sourceStep, sourceSupports, operationLimits }) => ({
  reviewId,
  sourceSupports,
  transferValidity: "The source selection is reviewed only as the named safety or waste boundary. The owner action retains its own source/target instances, quantities, configuration and evidence contract.",
  quantityAndConfigurationLimits: operationLimits,
  notSupported: `The ${sourceStep} citation does not establish owner-specific material identity, concentration, volume, timing, runtime behavior, scientific result or classroom acceptance.`,
});

setMappingDecision([beverage, phVolume], ["atom.rinse.clean-titration-receiver"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "safety", "S-05", "M/C",
), safetyBoundaryDecision({
  reviewId: "item2-titration-receiver-cleanup-safety-boundary-v2",
  sourceStep: "acid-in-fruit-juice-and-soft-drinks S-05",
  sourceSupports: "Safety S-05 supplies the teacher-directed disposal boundary for titrated beverage/NaOH mixtures; it does not prescribe how an emptied receiver is rinsed.",
  operationLimits: "Keep rinse volume, rinse-water identity, receiver identity and waste routing in the owner configuration. Do not copy a beverage quantity into the rinse action.",
}));
setMappingDecision([formal], ["atom.rinse.clean-titration-receiver"], locator(
  "acid-base-titration-curves_2026-07-27.md", "safety", "S-07", "M/C",
), safetyBoundaryDecision({
  reviewId: "item2-formal-receiver-cleanup-safety-boundary-v2",
  sourceStep: "acid-base-titration-curves S-07",
  sourceSupports: "Safety S-07 supplies the instructor-directed waste boundary for formal titration waste; it does not prescribe how an emptied receiver is rinsed.",
  operationLimits: "Keep rinse volume, rinse-water identity, receiver identity and waste routing in the owner configuration. Do not infer a rinse amount from the source.",
}));
setMappingDecision([redox], ["atom.rinse.clean-titration-receiver"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "safety", "S-08", "M/C",
), safetyBoundaryDecision({
  reviewId: "item2-redox-receiver-cleanup-safety-boundary-v2",
  sourceStep: "hydrogen-peroxide-redox-titration S-08",
  sourceSupports: "Safety S-08 supplies the local/instructor chemical-waste boundary for redox work; it does not prescribe how an emptied receiver is rinsed.",
  operationLimits: "Keep rinse volume, rinse-water identity, receiver identity and waste routing in the owner configuration. Do not infer a rinse amount from the source.",
}));

for (const [owners, source, sourceStep, reviewId] of [
  [[beverage, phVolume], "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "S-05", "item2-beverage-waste-safety-boundary-v2"],
  [[formal], "acid-base-titration-curves_2026-07-27.md", "S-07", "item2-formal-waste-safety-boundary-v2"],
  [[redox], "hydrogen-peroxide-redox-titration_2026-07-27.md", "S-08", "item2-redox-waste-safety-boundary-v2"],
]) {
  const sourceStepText = sourceStep === "S-05"
    ? "Safety S-05 supports disposal of titrated beverage/NaOH mixtures per instructor direction."
    : sourceStep === "S-07"
      ? "Safety S-07 supports the configured disposal route for formal titration waste."
      : "Safety S-08 supports the local/instructor chemical-waste procedure for redox work.";
  const fileLabel = source.replace("_2026-07-27.md", "");
  for (const atomId of [
    "atom.transfer.burette-rinsate-to-waste",
    "atom.transfer.discard-titrated-mixture",
  ]) setMappingDecision(owners, [atomId], locator(source, "safety", sourceStep, "M/C"), safetyBoundaryDecision({
    reviewId,
    sourceStep: `${fileLabel} ${sourceStep}`,
    sourceSupports: sourceStepText,
    operationLimits: "Keep the owner waste receiver, material identity, volume and teacher/instructor routing configuration. The source row does not define a universal waste container or quantity.",
  }));
}
setMappingDecision([beverage, formal, phVolume], ["atom.transfer.discard-practice-mixture"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "safety", "S-05", "M/C",
), safetyBoundaryDecision({
  reviewId: "item2-practice-mixture-waste-safety-boundary-v2",
  sourceStep: "acid-in-fruit-juice-and-soft-drinks S-05",
  sourceSupports: "Safety S-05 supplies the instructor-directed waste boundary for a spent beverage/NaOH practice mixture.",
  operationLimits: "Keep the practice receiver, mixture identity and configured waste route in the owner action.",
}));

setMappingDecision([formal], ["atom.mix.titration-mix"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-04", "M/R",
), reviewedDecision({
  reviewId: "item2-formal-titration-mixing-boundary-v2",
  sourceSupports: "Phase T-04 supports preparing the pH probe and starting continuous mixing during the formal titration.",
  transferValidity: "The owner action's swirl/mix event remains its own runtime decomposition; T-04 supplies the source-level mixing boundary only.",
  quantityAndConfigurationLimits: "Preserve the owner receiver, mixing method, persistence and teacher-configured parameters. T-04 does not supply a universal swirl count or duration.",
  notSupported: "The citation does not establish owner-specific volumes, pH values, endpoint decisions, runtime behavior or scientific acceptance.",
}));
setMappingDecision([beverage, phVolume], ["atom.mix.titration-mix"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-07", "M",
), reviewedDecision({
  reviewId: "item2-fruit-titration-mixing-boundary-v2",
  sourceSupports: "Phase T-07 supports mixing the current addition before reading/observing the titration state.",
  transferValidity: "The owner action keeps its own receiver, increment and runtime evidence; the source supplies the shared mix/read boundary only.",
  quantityAndConfigurationLimits: "Preserve the owner increment, receiver identity, mixing behavior and evidence fields. No source volume or timing is copied.",
  notSupported: "The citation does not establish owner-specific concentrations, endpoint values, runtime behavior or scientific acceptance.",
}));
setMappingDecision([redox], ["atom.mix.titration-mix"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-03", "M",
), reviewedDecision({
  reviewId: "item2-redox-titration-mixing-boundary-v2",
  sourceSupports: "Phase ST-03 supports titrating the measured analyte while mixing, with smaller additions near the endpoint.",
  transferValidity: "The owner action retains its own receiver, titrant increment and endpoint evidence; the source supplies the mixing/titration boundary only.",
  quantityAndConfigurationLimits: "Preserve the owner increment, receiver identity, endpoint persistence and teacher-configured limits. No source volume or endpoint threshold is copied.",
  notSupported: "The citation does not establish owner-specific concentrations, endpoint volume, runtime behavior or scientific acceptance.",
}));
setMappingDecision([formal], ["atom.observe.titration-read-final"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-09", "M",
), reviewedDecision({
  reviewId: "item2-formal-final-burette-read-boundary-v2",
  sourceSupports: "Phase T-09 is the source data-recording boundary for cumulative volume/pH points; the source plan's data-collection section also calls for initial and final burette readings.",
  transferValidity: "The owner action is an authored decomposition that reads the final burette level before its separate record action; it is not a pH read and does not claim T-09 is a verbatim final-read row.",
  quantityAndConfigurationLimits: "Preserve the owner burette instance, final-reading evidence field and configured trial state. Do not copy a pH value or volume from the source.",
  notSupported: "The citation does not provide a dedicated final-level phase, runtime reading, result value or acceptance rule for this owner action.",
}));
setMappingDecision([beverage, phVolume], ["atom.observe.titration-read-final"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-08", "M",
), reviewedDecision({
  reviewId: "item2-fruit-final-burette-read-boundary-v2",
  sourceSupports: "Phase T-08 supports recording cumulative volume/pH data, while the source data-collection requirements include initial and final burette readings.",
  transferValidity: "The owner action is an authored decomposition that reads the final burette level before its separate record action; it is not a pH read.",
  quantityAndConfigurationLimits: "Preserve the owner burette instance, final-reading evidence field and configured trial state. Do not copy a pH value or volume from the source.",
  notSupported: "The citation does not provide a dedicated final-level phase, runtime reading, result value or acceptance rule for this owner action.",
}));
setMappingDecision([redox], ["atom.observe.titration-read-final"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-04", "M",
), reviewedDecision({
  reviewId: "item2-redox-final-burette-read-boundary-v2",
  sourceSupports: "Phase ST-04 explicitly supports observing the faint-pink endpoint and recording the final burette reading.",
  transferValidity: "The owner action retains its own trial and final-reading evidence; the source supplies the endpoint/final-reading boundary.",
  quantityAndConfigurationLimits: "Preserve the owner burette instance, endpoint persistence and configured trial state. No source volume or color threshold is copied.",
  notSupported: "The citation does not establish owner-specific concentrations, endpoint volume, runtime behavior or scientific acceptance.",
}));

setMappingDecision(["technique:hard-water-two-sample-inquiry", "technique:two-stage-precipitate-drying"], ["atom.rinse.fraction-remove-label"], locator(
  "what-makes-hard-water-hard_2026-07-27.md", "safety", "S-09", "M",
), reviewedDecision({
  reviewId: "item2-hardwater-marker-removal-safety-v2",
  sourceSupports: "Safety S-09 explicitly supports using rubbing alcohol to remove marker from the watch glass at cleanup.",
  transferValidity: "The owner action retains its own watch-glass instance and teacher-supplied cleaning material; the source supplies the cleanup operation only.",
  quantityAndConfigurationLimits: "Keep the owner watch-glass identity and teacher-supplied alcohol configuration. No volume, timing or result is copied.",
  notSupported: "The citation does not establish the owner's complete cleanup sequence, waste routing, runtime behavior or scientific result.",
}));
setMappingDecision(["technique:hard-water-two-sample-inquiry", "technique:two-stage-precipitate-drying"], ["atom.transfer.fraction-dispose"], locator(
  "what-makes-hard-water-hard_2026-07-27.md", "safety", "S-08", "M",
), reviewedDecision({
  reviewId: "item2-hardwater-solid-disposal-safety-v2",
  sourceSupports: "Safety S-08 explicitly supports putting filter paper and precipitate in the wastebasket after analysis.",
  transferValidity: "The owner action retains its own solid source, waste receiver and cleanup evidence; the source supplies the solid-waste boundary only.",
  quantityAndConfigurationLimits: "Keep the owner source instance, waste receiver and configured cleanup choice. Do not infer that every retained fraction is a solid precipitate.",
  notSupported: "The citation does not establish liquid disposal, owner-specific material identity, runtime behavior or scientific acceptance.",
}));
setMappingDecision(["technique:hard-water-two-sample-inquiry", "technique:two-stage-precipitate-drying"], ["atom.transfer.fraction-dispose"], locator(
  "what-makes-hard-water-hard_2026-07-27.md", "safety", "S-07", "M",
), reviewedDecision({
  reviewId: "item2-hardwater-liquid-disposal-safety-v2",
  sourceSupports: "Safety S-07 explicitly limits source-approved solution disposal to the configured drain action.",
  transferValidity: "The owner action retains its own liquid source, waste/disposal target and configuration; the source supplies the liquid-waste boundary only.",
  quantityAndConfigurationLimits: "Keep the owner solution identity, configured disposal action and teacher-approved volume. Do not apply S-07 to solids or infer a universal drain route.",
  notSupported: "The citation does not establish solid disposal, owner-specific chemistry, runtime behavior or scientific acceptance.",
}));
setMappingDecision(["technique:quick-ache-property-evidence"], ["atom.transfer.apply-test-solvent"], locator(
  "bonding-in-unknown-solids_2026-07-27.md", "phase", "K-03", "M/C",
), reviewedDecision({
  reviewId: "item2-bonding-test-application-v2",
  sourceSupports: "Phase K-03 supports applying the selected solvent, reagent or instrument during a property test.",
  transferValidity: "The owner action retains its own selected test, sample and evidence contract; the source supplies the application boundary only.",
  quantityAndConfigurationLimits: "Preserve the owner test configuration, sample identity and teacher-approved amount. No source reagent or quantity is copied.",
  notSupported: "The citation does not establish the owner's sample identity, observed property, runtime behavior or scientific conclusion.",
}));
setMappingDecision(["technique:quick-ache-property-evidence"], ["atom.transfer.microsample-portion"], locator(
  "bonding-in-unknown-solids_2026-07-27.md", "phase", "K-02", "R/C",
), reviewedDecision({
  reviewId: "item2-bonding-microsample-transfer-v2",
  sourceSupports: "Phase K-02 supports transferring an approved sample portion before the separate test application step.",
  transferValidity: "The owner action keeps sample identity, destination and evidence separate from K-03 test application.",
  quantityAndConfigurationLimits: "Preserve the owner sample portion, source/target instances and teacher-approved quantity. No source amount is copied.",
  notSupported: "The citation does not establish the owner's material identity, test result, runtime behavior or scientific conclusion.",
}));

export const REVIEWED_MAPPING_DECISIONS = Object.freeze({ ...mappingDecisions });

const unreviewedDecision = (atom) => reviewedDecision({
  reviewId: `item2-context-only-${String(atom.id).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v1`,
  reviewStatus: "unreviewed-nonblocking-source-boundary",
  decisionDisposition: "unreviewed-nonblocking",
  sourceSupports: `No atom-specific semantic review is recorded for ${atom.documentationLabel ?? atom.id}; retain the cited row only as a contextual source boundary pending review.`,
  transferValidity: "No operation transfer is asserted by this disposition. The owner action remains authoritative for its own equipment, material, parameters and evidence contract.",
  quantityAndConfigurationLimits: "Do not copy source quantities, concentrations, timing, configuration, material identity or acceptance criteria from this contextual locator.",
  notSupported: "This disposition does not establish operation equivalence, owner-specific science, runtime behavior, classroom safety acceptance or a verbatim source prescription.",
});

export const reviewedDecisionFor = ({ atom, owner, sourceTrace }) => {
  const mapping = sourceTrace
    ? REVIEWED_MAPPING_DECISIONS[`${owner}|${atom.id}|${locatorKey(sourceTrace)}`]
    : null;
  return mapping ?? REVIEWED_ATOM_DECISIONS[atom.id] ?? unreviewedDecision(atom);
};

export const selectionFor = ({ owner, atomId, actionBasis, actionId }) => {
  const exactActionKey = `${owner}|${atomId}|action:${actionId}`;
  if (actionId && REVIEWED_SOURCE_SELECTIONS[exactActionKey]) {
    return { locator: REVIEWED_SOURCE_SELECTIONS[exactActionKey], selectionKey: exactActionKey };
  }
  const prefixEntries = Object.entries(REVIEWED_SOURCE_SELECTIONS)
    .filter(([key]) => key.startsWith(`${owner}|${atomId}|action-prefix:`))
    .sort(([left], [right]) => right.length - left.length);
  const prefixEntry = prefixEntries.find(([key]) => actionId?.startsWith(key.slice(`${owner}|${atomId}|action-prefix:`.length)));
  if (prefixEntry) return { locator: prefixEntry[1], selectionKey: prefixEntry[0] };
  const basisKey = `${owner}|${atomId}|${actionBasis}`;
  if (REVIEWED_SOURCE_SELECTIONS[basisKey]) return { locator: REVIEWED_SOURCE_SELECTIONS[basisKey], selectionKey: basisKey };
  const ownerAtomKey = `${owner}|${atomId}`;
  if (REVIEWED_SOURCE_SELECTIONS[ownerAtomKey]) return { locator: REVIEWED_SOURCE_SELECTIONS[ownerAtomKey], selectionKey: ownerAtomKey };
  return { locator: null, selectionKey: null };
};
