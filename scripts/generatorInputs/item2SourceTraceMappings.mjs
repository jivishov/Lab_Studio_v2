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

// Historical atom-level decisions are retained for audit comparison only.  They are not a
// fallback: reviewedDecisionFor requires an owner/atom/source mapping below.
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
    reviewId: "item2-configured-solid-inventory-v3",
    sourceSupports: "The green EX-06 row supports transferring a planned mixture mass into the crucible; this retained historical entry is not a fallback for any owner.",
    transferValidity: "The owner action is explicitly teacherConfiguration/sourceInventory setup, not a learner balance reading; the mapping preserves that distinction and the named container.",
    quantityAndConfigurationLimits: "Keep the teacher-supplied mass, sourceInventory metadata and action configuration. Do not copy a source quantity into the configured stock value.",
    notSupported: "The citation does not establish a universal stock amount, balance tolerance, runtime heating result, scientific yield or classroom acceptance.",
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

// Item-2 closure review for the previously unreviewed groups.  Every entry below names the
// operation supported by the exact local dated atomic-step row and the boundary that remains
// authored/configured in the owner action.  These are deliberately explicit maps: a new owner,
// atom, action or locator must not inherit an affirmative decision from an atom label.
const planRow = (sourceFile, sourceTable, step, basis) => locator(sourceFile, sourceTable, step, basis);
const fruitT03 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-03", "R/C");
const fruitT02 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-02", "M/R");
const fruitT04 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-04", "M");
const fruitT06 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-06", "M/C");
const fruitT07 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-07", "M");
const fruitT08 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-08", "M");
const fruitT09 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-09", "M/C");
const fruitPR02 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "PR-02", "M");
const fruitPR03 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "PR-03", "M");
const fruitPR04 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "PR-04", "M");
const fruitIQ06 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "IQ-06", "M");
const fruitA01 = planRow("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "A-01", "M");
const acidT01 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "T-01", "M");
const acidT02 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "T-02", "M/R");
const acidT03 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "T-03", "M");
const acidT06 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "T-06", "M/C");
const acidT08 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "T-08", "M");
const acidT09 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "T-09", "M");
const acidT10 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "T-10", "M/C");
const acidPR05 = planRow("acid-base-titration-curves_2026-07-27.md", "phase", "PR-05", "M");
const acidTIT00 = planRow("acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-00", "F");
const acidTIT02 = planRow("acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-02", "F");
const acidTIT03 = planRow("acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-03", "F");
const acidTIT04 = planRow("acid-base-titration-curves_2026-07-27.md", "apparatus", "TIT-04", "F/R/C");
const redoxPA02 = planRow("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "PA-02", "M");
const redoxST01 = planRow("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-01", "R/C");
const redoxST04 = planRow("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-04", "M");
const redoxST06 = planRow("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-06", "M/C");
const blueP06 = planRow("sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-06", "M/R");
const blueP03 = planRow("sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-03", "M");
const blueP04 = planRow("sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-04", "M");
const brassB07 = planRow("how-can-color-determine-copper-in-brass_2026-07-27.md", "phase", "B-07", "M");
const blueP09 = planRow("sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-09", "M/R");
const blueP10 = planRow("sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-10", "M");
const blueP11 = planRow("sports-drink-blue-dye-spectroscopy_2026-07-27.md", "phase", "P-11", "M");
const hardFD04 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-04", "M");
const hardFD05 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-05", "M");
const hardFD06 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-06", "M");
const hardFD07 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-07", "M");
const hardFD08 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-08", "M");
const hardFD14 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-14", "M");
const hardFD18 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-18", "M");
const hardFD19 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-19", "M");
const hardINQ06 = planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "INQ-06", "M");
const paperCHR00 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "apparatus", "CHR-00", "F");
const paperCHR02 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "apparatus", "CHR-02", "F");
const paperCHR03 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "apparatus", "CHR-03", "F/R/C");
const paperTR02 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-02", "M/C");
const paperTR03 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-03", "M");
const paperTR04 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-04", "M/R");
const paperTR05 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-05", "R/C");
const paperTR06 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-06", "M/R");
const paperTR07 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-07", "M");
const paperTR08 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-08", "M/C");
const paperTR09 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-09", "R");
const paperTR10 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-10", "M/R");
const paperTR19 = planRow("sticky-question-paper-chromatography_2026-07-27.md", "phase", "TR-19", "M");
const quickE03 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-03", "R/C");
const quickE04 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-04", "R/C");
const quickE05 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-05", "R");
const quickE07 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-07", "R/C");
const quickE09 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-09", "C");
const quickE10 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-10", "M/C");
const quickE11 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-11", "M/C");
const quickE12 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-12", "M");
const quickE13 = planRow("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-13", "M");
const greenEX06 = planRow("purify-a-mixture-green-chemistry_2026-07-27.md", "phase", "EX-06", "M");

const reviewedOperation = ({
  owners,
  atomIds,
  source,
  reviewId,
  sourceSupports,
  quantityAndConfigurationLimits,
  notSupported,
  reviewStatus = "reviewed-static-source-mapping",
  decisionDisposition = "reviewed-contextual",
}) => {
  setFor(owners, atomIds, source);
  const row = `${source.sourceFile} ${source.sourceTable} ${source.step} (basis ${source.basis})`;
  setMappingDecision(owners, atomIds, source, {
    reviewId,
    reviewStatus,
    decisionDisposition,
    sourceSupports: `The local dated atomic-step plan row ${row} supports ${sourceSupports}.`,
    transferValidity: "The owner action remains authoritative for its named material, equipment instances, quantities, configuration and evidence contract; this contextual mapping transfers only the stated operation boundary.",
    quantityAndConfigurationLimits,
    notSupported: notSupported ?? `The ${row} citation does not establish owner-specific material identity, runtime behavior, scientific result, classroom safety acceptance or a verbatim prescription for the generated action.`,
  });
};
const reviewedAction = (options) => {
  const { owner, atomId, actionIds, source, ...decision } = options;
  for (const actionId of actionIds) selections[`${owner}|${atomId}|action:${actionId}`] = source;
  reviewedOperation({ owners: [owner], atomIds: [atomId], source, ...decision });
};

// Beverage and single-trial pH-volume actions: the broad T-03-through-T-09 citation is
// replaced with the actual operation row.  A-01/IQ-06 and the practice rows are intentional
// source-plan boundaries for calculation, teacher review and practice recovery respectively.
for (const owner of [beverage, phVolume]) {
  reviewedOperation({ owners: [owner], atomIds: ["atom.calculate.titration-calculate-curve"], source: fruitA01, reviewId: "item2-fruit-concentration-calculation-v3", sourceSupports: "calculating concentration from the recorded titration dataset", quantityAndConfigurationLimits: "Keep the owner's aliquot, burette readings, stoichiometry, accepted equivalence and student-response tolerance; A-01 supplies the calculation activity, not a concentration or endpoint value." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.mix.titration-practice-mix"], source: fruitT07, reviewId: "item2-fruit-practice-mixing-v3", sourceSupports: "mixing the current addition before the observation", quantityAndConfigurationLimits: "Keep the practice receiver, addition amount and persistence in the owner contract; no source timing or quantity is copied." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.burette-tip-inspection"], source: acidT02, reviewId: "item2-titration-tip-inspection-v3", sourceSupports: "the fill/read preparation row's explicit removal of tip air before the initial reading; the visible inspection is an authored recovery check", quantityAndConfigurationLimits: "Keep the owner purge node, tip state and retry control; do not turn the source's R marker into a universal air-bubble threshold." , reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.titration-approve-equivalence"], source: fruitIQ06, reviewId: "item2-fruit-equivalence-teacher-review-v3", sourceSupports: "an instructor approval gate before executing the approved workflow; the equivalence choice itself remains a teacher-reviewed inference", quantityAndConfigurationLimits: "Keep the teacher configuration, trial evidence, endpoint window and selected equivalence volume; IQ-06 supplies no numerical endpoint or concentration." , reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.titration-archive-retry"], source: fruitT09, reviewId: "item2-fruit-retry-boundary-v3", sourceSupports: "repeating the curve through and after the endpoint under an approved plan; the action's selective archive/reset is an authored recovery decomposition", quantityAndConfigurationLimits: "Keep the owner trial node list and full-reset semantics; a rejected trial is not rewound and no source retry count is inferred.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.titration-decide"], source: fruitT09, reviewId: "item2-fruit-continue-accept-restart-v3", sourceSupports: "the controlled repeat/stop boundary for an approved curve", quantityAndConfigurationLimits: "Keep the owner persistence, increment, endpoint and restart configuration; the source does not define a universal acceptance threshold.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.titration-observe"], source: fruitT07, reviewId: "item2-fruit-observation-boundary-v3", sourceSupports: "mixing, reading pH and observing color after each addition", quantityAndConfigurationLimits: "Keep the owner pH/color evidence fields and indicator configuration; do not copy a source color or pH value." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.titration-read-initial"], source: fruitT03, reviewId: "item2-fruit-initial-burette-read-v3", sourceSupports: "conditioning/filling the buret and reading the initial volume", quantityAndConfigurationLimits: "Keep the owner burette instance, reading field and configured precision; no source volume is copied." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.titration-read-ph"], source: fruitT07, reviewId: "item2-fruit-ph-read-v3", sourceSupports: "reading pH after mixing the current addition", quantityAndConfigurationLimits: "Keep the owner probe instance, stabilization/persistence rule and reading evidence; no source pH is copied." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.observe.titration-select-equivalence"], source: fruitT09, reviewId: "item2-fruit-equivalence-selection-v3", sourceSupports: "continuing the curve through the endpoint so an equivalence region can be selected from evidence", quantityAndConfigurationLimits: "Keep the owner's recorded curve, teacher-approved equivalence selection and calculation contract; the source does not prescribe a selected volume.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.place.burette-filling-funnel", "atom.place.remove-burette-filling-funnel"], source: redoxST01, reviewId: "item2-burette-funnel-apparatus-boundary-v3", sourceSupports: "the titrant-ready condition/fill preparation boundary; funnel seating/removal is an authored apparatus decomposition rather than a claim that ST-01 names a funnel", quantityAndConfigurationLimits: "Keep the owner attachment child, snap zone and removal order; no source funnel geometry or fill amount is copied.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.place.burette-support"], source: acidTIT00, reviewId: "item2-burette-support-apparatus-v3", sourceSupports: "placing the utility/ring stand as a stable support for the buret assembly", quantityAndConfigurationLimits: "Keep the owner stand/clamp identity and height configuration; TIT-00 does not prescribe simulator coordinates." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.place.immersed-ph-probe"], source: fruitT04, reviewId: "item2-fruit-probe-immersion-v3", sourceSupports: "inserting the pH probe as part of the observable titration system", quantityAndConfigurationLimits: "Keep the owner probe instance, immersion/safety constraints and teacher calibration rule; no source depth or calibration value is copied." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.place.mount-burette"], source: acidTIT02, reviewId: "item2-burette-mount-apparatus-v3", sourceSupports: "seating the buret vertically with the stopcock accessible", quantityAndConfigurationLimits: "Keep the owner clamp, height and snap-zone contract; TIT-02 does not establish pixel coordinates or a learner quantity." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.place.probe-instrument"], source: acidTIT04, reviewId: "item2-ph-instrument-apparatus-v3", sourceSupports: "the supported pH-probe measurement assembly; workbench placement is an authored decomposition", quantityAndConfigurationLimits: "Keep the owner meter instance, probe compatibility and hit targets; TIT-04 does not prescribe simulator layout.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.place.titration-receiver"], source: acidTIT03, reviewId: "item2-titration-receiver-apparatus-v3", sourceSupports: "positioning the flask/beaker below the buret tip", quantityAndConfigurationLimits: "Keep the owner receiving vessel and alignment snap zone; TIT-03 does not establish vessel volume or coordinates." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.record.titration-record-final"], source: fruitT08, reviewId: "item2-fruit-final-record-v3", sourceSupports: "recording cumulative volume and the accompanying pH/color data row; the final buret value is an authored decomposition of that record", quantityAndConfigurationLimits: "Keep the owner final-reading field, trial identity and evidence-derived calculation; no source final volume is copied.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
  reviewedOperation({ owners: [owner], atomIds: ["atom.record.titration-record-initial"], source: fruitT03, reviewId: "item2-fruit-initial-record-v3", sourceSupports: "reading and recording the initial buret volume during titrant-ready preparation", quantityAndConfigurationLimits: "Keep the owner initial-reading field and precision; no source starting volume is copied." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.record.titration-record-point"], source: fruitT08, reviewId: "item2-fruit-curve-record-v3", sourceSupports: "recording each cumulative volume, pH and color row", quantityAndConfigurationLimits: "Keep the owner trial/row identity and recorded evidence; T-08 does not prescribe the simulator's table schema beyond the operation." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.rinse.condition-burette"], source: fruitT03, reviewId: "item2-fruit-burette-conditioning-v3", sourceSupports: "conditioning/filling the buret before the initial reading", quantityAndConfigurationLimits: "Keep the owner titrant, conditioning volume and waste receiver; no source rinse volume is copied." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.transfer.add-indicator"], source: fruitPR02, reviewId: "item2-fruit-indicator-addition-v3", sourceSupports: "adding a few drops of phenolphthalein before the practice/measurement state", quantityAndConfigurationLimits: "Keep the owner teacher-selected indicator and configured amount; the plan does not establish a universal drop count." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.transfer.fill-burette"], source: acidT02, reviewId: "item2-burette-fill-v3", sourceSupports: "filling the buret, removing tip air under the stated R/C boundary, and reading the initial state", quantityAndConfigurationLimits: "Keep the owner titrant, attachment state and teacher-configured air-removal rule; no source fill volume is copied." });
  reviewedOperation({ owners: [owner], atomIds: ["atom.transfer.titration-deliver"], source: fruitT06, reviewId: "item2-fruit-titrant-delivery-v3", sourceSupports: "adding one controlled NaOH increment", quantityAndConfigurationLimits: "Keep the owner increment input, endpoint window, maximum delivery and post-endpoint branch; the source does not prescribe those simulator limits." });
}
reviewedOperation({ owners: [beverage], atomIds: ["atom.observe.titration-practice-archive-retry"], source: fruitPR04, reviewId: "item2-practice-fresh-retry-v3", sourceSupports: "repeating the practice with a fresh acid portion", quantityAndConfigurationLimits: "Keep the owner fresh-aliquot reset and practice evidence; PR-04 does not establish a retry count.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [beverage], atomIds: ["atom.observe.titration-practice-decide", "atom.observe.titration-practice-observe", "atom.observe.titration-practice-read-initial", "atom.record.titration-practice-record-point", "atom.transfer.titration-practice-deliver", "atom.mix.titration-practice-mix"], source: fruitPR03, reviewId: "item2-practice-drop-count-boundary-v3", sourceSupports: "the dropwise practice loop, stop-at-color-change observation and drop-count evidence", quantityAndConfigurationLimits: "Keep the owner uncalibrated practice label, teacher-selected indicator and maximum practice delivery; PR-03 does not establish a universal drop volume, classroom quantity or retry rule.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedAction({ owner: beverage, atomId: "atom.transfer.add-practice-indicator", actionIds: ["practice-hcl-indicator"], source: fruitPR02, reviewId: "item2-practice-hcl-indicator-v3", sourceSupports: "adding a few drops of phenolphthalein before the HCl practice titration", quantityAndConfigurationLimits: "Keep the owner-selected indicator, teacher-configured amount and student-response contract; PR-02 does not establish a universal drop count or classroom quantity.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedAction({ owner: beverage, atomId: "atom.transfer.add-practice-indicator", actionIds: ["practice-acetic-indicator"], source: fruitPR04, reviewId: "item2-practice-acetic-indicator-v3", sourceSupports: "repeating the practice with acetic acid and a student-selected indicator", quantityAndConfigurationLimits: "Keep the owner-selected indicator, teacher-configured amount and fresh-acid reset; PR-04 does not establish a universal drop count or classroom quantity.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });

// The formal trial keeps the same operation distinctions but has its own plan rows and an
// authored observation split: prepared-analyte inspection is not the same claim as reading pH.
reviewedOperation({ owners: [formal], atomIds: ["atom.observe.burette-tip-inspection"], source: acidT02, reviewId: "item2-formal-tip-inspection-v3", sourceSupports: "the fill/read row's explicit tip-air preparation boundary; the visible inspection is an authored recovery check", quantityAndConfigurationLimits: "Keep the owner purge node and retry branch; no universal bubble threshold is inferred.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [formal], atomIds: ["atom.observe.titration-archive-retry"], source: acidT10, reviewId: "item2-formal-retry-loop-v3", sourceSupports: "repeating the approved titration points with smaller increments near the steep region", quantityAndConfigurationLimits: "Keep the owner selective reset and fresh-trial semantics; T-10 does not define UI reset scope.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedAction({ owner: formal, atomId: "atom.observe.titration-observe", actionIds: ["formal-trial-deliver-titrant-observe"], source: acidT08, reviewId: "item2-formal-observe-ph-boundary-v3", sourceSupports: "the pH measurement boundary for the mixed titration state", quantityAndConfigurationLimits: "Keep the owner observation field and probe identity; T-08 supplies no runtime value." });
reviewedAction({ owner: formal, atomId: "atom.observe.titration-observe", actionIds: ["formal-trial-inspect-prepared-analyte"], source: acidPR05, reviewId: "item2-formal-prepared-analyte-observation-v3", sourceSupports: "combining the prepared portions and observing the resulting state", quantityAndConfigurationLimits: "Keep the owner analyte identity and no-indicator configuration; PR-05 does not establish a pH or endpoint." , reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [formal], atomIds: ["atom.observe.titration-read-initial"], source: acidT02, reviewId: "item2-formal-initial-read-v3", sourceSupports: "reading and recording the initial buret volume", quantityAndConfigurationLimits: "Keep the owner buret instance and precision; no source reading is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.observe.titration-read-ph"], source: acidT08, reviewId: "item2-formal-ph-read-v3", sourceSupports: "reading pH during the curve", quantityAndConfigurationLimits: "Keep the owner probe, persistence and evidence contract; no source pH value is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.place.burette-filling-funnel", "atom.place.remove-burette-filling-funnel"], source: redoxST01, reviewId: "item2-formal-funnel-boundary-v3", sourceSupports: "the titrant-ready conditioning/fill boundary; funnel seating/removal is an authored apparatus decomposition", quantityAndConfigurationLimits: "Keep the owner attachment state and removal order; no source funnel geometry is copied.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [formal], atomIds: ["atom.place.burette-support"], source: acidTIT00, reviewId: "item2-formal-support-apparatus-v3", sourceSupports: "placing the stable utility/ring stand", quantityAndConfigurationLimits: "Keep owner stand/clamp identity and height configuration; no simulator coordinates are inferred." });
reviewedOperation({ owners: [formal], atomIds: ["atom.place.immersed-ph-probe"], source: acidTIT04, reviewId: "item2-formal-probe-immersion-v3", sourceSupports: "inserting the supported pH probe with the bulb immersed and protected from the stir bar", quantityAndConfigurationLimits: "Keep owner probe compatibility and safety constraints; no source depth is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.place.mount-burette"], source: acidTIT02, reviewId: "item2-formal-burette-mount-v3", sourceSupports: "seating the buret vertically with the stopcock accessible", quantityAndConfigurationLimits: "Keep owner clamp and snap-zone configuration; no source coordinates are copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.place.probe-instrument"], source: acidTIT04, reviewId: "item2-formal-meter-placement-v3", sourceSupports: "the supported pH measurement assembly; workbench placement is an authored decomposition", quantityAndConfigurationLimits: "Keep owner meter/probe identity and hit targets; no layout is source-prescribed.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [formal], atomIds: ["atom.place.titration-receiver"], source: acidTIT03, reviewId: "item2-formal-receiver-apparatus-v3", sourceSupports: "positioning the receiver below the buret tip", quantityAndConfigurationLimits: "Keep owner receiver identity and alignment zone; no vessel quantity is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.record.titration-record-final", "atom.record.titration-record-initial", "atom.record.titration-record-point"], source: acidT09, reviewId: "item2-formal-curve-record-v3", sourceSupports: "recording cumulative volume and pH as curve rows; the initial/final buret fields are owner-authored decompositions around that data boundary", quantityAndConfigurationLimits: "Keep owner reading fields, trial identity and evidence-derived calculations; T-09 does not provide a final-reading value.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [formal], atomIds: ["atom.rinse.condition-burette"], source: acidT01, reviewId: "item2-formal-burette-conditioning-v3", sourceSupports: "rinsing the buret with titrant", quantityAndConfigurationLimits: "Keep owner titrant, rinse amount and waste receiver; no source rinse volume is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.transfer.fill-burette"], source: acidT02, reviewId: "item2-formal-fill-burette-v3", sourceSupports: "filling the buret and removing tip air before the initial reading", quantityAndConfigurationLimits: "Keep owner attachment state and teacher-configured air-removal rule; no source fill volume is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.transfer.titration-deliver"], source: acidT06, reviewId: "item2-formal-titrant-delivery-v3", sourceSupports: "adding one approved titrant increment", quantityAndConfigurationLimits: "Keep owner increment, endpoint and persistence configuration; T-06 supplies no universal numeric limit." });

// Redox groups preserve the distinction between the ST-01 preparation boundary, ST-04 endpoint
// evidence and ST-06 repetition.  Receiver placement uses the acid-base apparatus row because
// redox ST-02 is an analyte-preparation row, not a flask-position row.
reviewedOperation({ owners: [redox], atomIds: ["atom.observe.burette-tip-inspection"], source: redoxST01, reviewId: "item2-redox-tip-inspection-v3", sourceSupports: "the condition/fill/read preparation boundary; the visible air-bubble choice is an authored recovery check", quantityAndConfigurationLimits: "Keep owner purge node, inspection options and retry path; ST-01 does not set a bubble threshold.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [redox], atomIds: ["atom.observe.titration-archive-retry", "atom.observe.titration-decide"], source: redoxST06, reviewId: "item2-redox-repeat-decision-v3", sourceSupports: "repeating fresh standardization trials and averaging under the approved plan", quantityAndConfigurationLimits: "Keep owner fresh-trial nodes, endpoint persistence and teacher acceptance; ST-06 does not define a UI reset scope or concordance threshold.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [redox], atomIds: ["atom.observe.titration-observe"], source: redoxST04, reviewId: "item2-redox-endpoint-observation-v3", sourceSupports: "observing the faint-pink endpoint", quantityAndConfigurationLimits: "Keep owner endpoint persistence and color evidence; no source color threshold or volume is copied." });
reviewedOperation({ owners: [redox], atomIds: ["atom.place.burette-filling-funnel", "atom.place.remove-burette-filling-funnel"], source: redoxST01, reviewId: "item2-redox-funnel-boundary-v3", sourceSupports: "the condition/fill preparation boundary; funnel seating/removal is an authored apparatus decomposition", quantityAndConfigurationLimits: "Keep owner attachment state and removal order; no funnel dimensions or fill amount are copied.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [redox], atomIds: ["atom.place.titration-receiver"], source: acidTIT03, reviewId: "item2-redox-receiver-apparatus-v3", sourceSupports: "positioning the receiving vessel below the delivery tip", quantityAndConfigurationLimits: "Keep owner receiver identity and alignment zone; redox ST-02 remains an analyte-preparation row and is not used for receiver placement." });
reviewedOperation({ owners: [redox], atomIds: ["atom.record.titration-record-final", "atom.record.titration-record-initial", "atom.record.titration-record-point"], source: redoxST04, reviewId: "item2-redox-record-boundary-v3", sourceSupports: "recording the delivered-volume/endpoint evidence; initial and point rows are owner-authored decompositions around the same trial record", quantityAndConfigurationLimits: "Keep owner trial identity, reading fields and calculation references; ST-04 does not prescribe a source reading value.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [redox], atomIds: ["atom.transfer.fill-burette"], source: redoxST01, reviewId: "item2-redox-fill-burette-v3", sourceSupports: "conditioning/filling the buret for a titrant-ready trial", quantityAndConfigurationLimits: "Keep owner titrant, attachment and teacher-configured air-removal rules; no source fill amount is copied." });

// Blue #1's optical-face preparation and cuvette removal are authored instrument-state
// decompositions around P-09; P-08 is the blank/calibration boundary and is not cited for them.
const blue = "technique:blue1-percent-transmittance";
reviewedOperation({ owners: [blue], atomIds: ["atom.dilute.to-final-volume"], source: blueP06, reviewId: "item2-blue-dilution-v3", sourceSupports: "adding water and mixing the assigned dilution", quantityAndConfigurationLimits: "Keep the owner assigned stock/water volumes and M1V1=M2V2 calculation; P-06's illustrative 10 mL is not copied." });
reviewedOperation({ owners: [blue], atomIds: ["atom.observe.prepare-cuvette-optical-faces"], source: blueP09, reviewId: "item2-blue-cuvette-face-preparation-v3", sourceSupports: "the filled/inserted sample-cuvette measurement state; optical-face wiping is an authored preparation detail", quantityAndConfigurationLimits: "Keep the owner wipe/face state, cuvette identity and teacher instrument rule; P-09 does not establish a wipe count or fill fraction.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [blue], atomIds: ["atom.observe.read-photometer"], source: blueP10, reviewId: "item2-blue-percent-t-read-v3", sourceSupports: "reading percent transmittance from the instrument", quantityAndConfigurationLimits: "Keep owner wavelength/instrument configuration and raw reading evidence; no source %T value is copied." });
reviewedAction({ owner: blue, atomId: "atom.place.insert-cuvette", actionIds: ["i1-insert-diluted-unknown-cuvette"], source: blueP09, reviewId: "item2-blue-cuvette-insert-v3", sourceSupports: "filling/inserting the assigned sample cuvette", quantityAndConfigurationLimits: "Keep owner cuvette identity and orientation snap zone; no source coordinate is copied." });
reviewedAction({ owner: blue, atomId: "atom.place.remove-cuvette", actionIds: ["i1-remove-diluted-unknown-cuvette"], source: blueP09, reviewId: "item2-blue-cuvette-remove-v3", sourceSupports: "the assigned cuvette measurement state; removal is an authored teardown boundary", quantityAndConfigurationLimits: "Keep owner removal order and sample preservation rule; P-09 does not prescribe a removal gesture.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [blue], atomIds: ["atom.record.photometer-reading"], source: blueP11, reviewId: "item2-blue-percent-t-record-v3", sourceSupports: "recording %T and decimal T in the central table", quantityAndConfigurationLimits: "Keep owner row provenance and conversion/evidence fields; no source reading is copied." });
reviewedOperation({ owners: [blue], atomIds: ["atom.transfer.fill-cuvette"], source: blueP09, reviewId: "item2-blue-cuvette-fill-v3", sourceSupports: "filling/inserting the assigned sample cuvette", quantityAndConfigurationLimits: "Keep owner sample identity, fill-state and teacher-configured amount; no source fill fraction is copied." });

// Bonding and filtration groups use their exact operation rows rather than atom-name fallback.
const bonding = "technique:bonding-solids-tests";
reviewedOperation({ owners: [bonding], atomIds: ["atom.observe.read-ph-indicator"], source: planRow("bonding-in-unknown-solids_2026-07-27.md", "phase", "K-04", "M"), reviewId: "item2-bonding-read-result-v3", sourceSupports: "observing/reading the selected property-test result", quantityAndConfigurationLimits: "Keep owner test identity and evidence format; K-04 does not establish a result value or classification." });
reviewedOperation({ owners: [bonding], atomIds: ["atom.transfer.apply-test-solvent"], source: planRow("bonding-in-unknown-solids_2026-07-27.md", "phase", "K-03", "M/C"), reviewId: "item2-bonding-apply-test-v3", sourceSupports: "applying the selected solvent, reagent or instrument", quantityAndConfigurationLimits: "Keep owner selected test, sample identity and teacher-approved amount; no source reagent or quantity is copied." });
reviewedOperation({ owners: [bonding], atomIds: ["atom.transfer.dispose-to-waste-stream"], source: planRow("bonding-in-unknown-solids_2026-07-27.md", "phase", "K-06", "M/C"), reviewId: "item2-bonding-disposal-v3", sourceSupports: "disposing/resetting the test station by the approved stream", quantityAndConfigurationLimits: "Keep owner material identity, waste stream and reset state; K-06 does not authorize a universal container." });
reviewedOperation({ owners: [bonding], atomIds: ["atom.transfer.microsample-portion"], source: planRow("bonding-in-unknown-solids_2026-07-27.md", "phase", "K-02", "R/C"), reviewId: "item2-bonding-microsample-v3", sourceSupports: "transferring the approved sample amount before the separate test-application step", quantityAndConfigurationLimits: "Keep owner sample portion and destination; K-02 supplies no source amount." });

const filtrationOwners = ["technique:gravimetric-vacuum-filtration", "technique:hard-water-two-sample-inquiry"];
reviewedOperation({ owners: filtrationOwners, atomIds: ["atom.filter.pour-through-medium"], source: hardFD06, reviewId: "item2-hardwater-filter-pour-v3", sourceSupports: "slowly pouring the mixture without overflow while retaining precipitate", quantityAndConfigurationLimits: "Keep owner source/receiver identities and controlled-pour limits; FD-06 supplies no simulator volume." });
reviewedOperation({ owners: filtrationOwners, atomIds: ["atom.place.filter-medium"], source: hardFD04, reviewId: "item2-hardwater-filter-paper-v3", sourceSupports: "inserting the filter paper", quantityAndConfigurationLimits: "Keep owner filter identity and snap zone; no source paper dimensions are copied." });
reviewedOperation({ owners: filtrationOwners, atomIds: ["atom.place.filtration-funnel"], source: planRow("what-makes-hard-water-hard_2026-07-27.md", "apparatus", "GRAV-01", "F/C"), reviewId: "item2-hardwater-funnel-apparatus-v3", sourceSupports: "attaching the funnel or vacuum funnel as the teacher-approved filtration apparatus", quantityAndConfigurationLimits: "Keep owner funnel choice, support and vacuum suitability boundary; GRAV-01 does not prove physical vacuum behavior." });
reviewedOperation({ owners: filtrationOwners, atomIds: ["atom.place.filtration-receiver"], source: planRow("what-makes-hard-water-hard_2026-07-27.md", "apparatus", "GRAV-04", "F"), reviewId: "item2-hardwater-receiver-apparatus-v3", sourceSupports: "placing the receiving vessel with its outlet aligned", quantityAndConfigurationLimits: "Keep owner receiver identity and alignment; no source capacity or simulator coordinate is copied." });
reviewedOperation({ owners: filtrationOwners, atomIds: ["atom.rinse.quantitative-transfer"], source: hardFD07, reviewId: "item2-hardwater-quantitative-rinse-v3", sourceSupports: "rinsing remaining precipitate from the beaker with small water quantities", quantityAndConfigurationLimits: "Keep owner rinse loop, water identity and teacher-approved amount; FD-07 does not define a universal volume." });
reviewedOperation({ owners: filtrationOwners, atomIds: ["atom.rinse.wash-precipitate"], source: hardFD08, reviewId: "item2-hardwater-precipitate-wash-v3", sourceSupports: "washing the collected precipitate with additional water", quantityAndConfigurationLimits: "Keep owner wash amount, material identity and completion evidence; no source quantity is copied." });
reviewedOperation({ owners: filtrationOwners, atomIds: ["atom.rinse.wet-filter-medium"], source: hardFD05, reviewId: "item2-hardwater-wet-filter-v3", sourceSupports: "wetting the filter paper with deionized water", quantityAndConfigurationLimits: "Keep owner water identity and wetting state; no source volume is copied." });
reviewedOperation({ owners: ["technique:hard-water-two-sample-inquiry"], atomIds: ["atom.cool.before-weighing"], source: hardFD18, reviewId: "item2-hardwater-cooling-v3", sourceSupports: "removing the assembly and setting it aside to cool", quantityAndConfigurationLimits: "Keep owner cooling prerequisite and teacher timing; FD-18 does not prove a physical temperature sensor or duration." });
reviewedOperation({ owners: ["technique:hard-water-two-sample-inquiry"], atomIds: ["atom.dry.oven-stage"], source: hardFD14, reviewId: "item2-hardwater-drying-v3", sourceSupports: "drying the assembly for the stated source interval", quantityAndConfigurationLimits: "Keep owner drying configuration and qualitative state; the source interval is not a universal runtime or scientific endpoint." });
reviewedOperation({ owners: ["technique:hard-water-two-sample-inquiry"], atomIds: ["atom.weigh.dry-assembly"], source: hardINQ06, reviewId: "item2-hardwater-inquiry-workflow-v3", sourceSupports: "executing the approved workflow independently for sample 1; the actual cool/read mass operation remains owner-authored", quantityAndConfigurationLimits: "Keep owner balance identity, sample branch and measurement evidence; INQ-06 does not prescribe a mass or prove balance behavior.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: ["technique:two-stage-precipitate-drying"], atomIds: ["atom.cool.before-weighing"], source: hardFD18, reviewId: "item2-two-stage-cooling-v3", sourceSupports: "setting the dried assembly aside to cool before weighing", quantityAndConfigurationLimits: "Keep owner cooling state and timing configuration; no physical temperature or duration is inferred.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: ["technique:two-stage-precipitate-drying"], atomIds: ["atom.dry.oven-stage"], source: hardFD14, reviewId: "item2-two-stage-drying-v3", sourceSupports: "drying the assembly for the source-stated interval", quantityAndConfigurationLimits: "Keep owner cycle count and qualitative heated-product state; no independent drying endpoint is claimed.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: ["technique:two-stage-precipitate-drying"], atomIds: ["atom.weigh.dry-assembly"], source: hardFD19, reviewId: "item2-two-stage-weighing-v3", sourceSupports: "reading the mass when the assembly is cool", quantityAndConfigurationLimits: "Keep owner balance identity, tare convention and cool prerequisite; FD-19 does not establish a measured value or physical balance validation." });

// Paper chromatography rows are operation-specific, including the explicit R/C wait and the
// waste branch.  The separate authored developed-paper drying action remains an intentional
// source-trace residual elsewhere in the catalog.
const paper = "technique:paper-chromatography";
const paperOperations = [
  ["atom.developChromatogram.develop-strip", paperTR08, "item2-paper-development-v3", "allowing solvent to rise to the approved stop condition", "Keep owner stop condition, solvent identity and evidence; TR-08 does not supply a runtime duration."],
  ["atom.observe.close-developing-chamber", paperTR07, "item2-paper-chamber-close-v3", "closing the chamber lid", "Keep owner lid identity and sealed-state check; no source geometry is copied."],
  ["atom.observe.dry-chromatography-spot", paperTR05, "item2-paper-spot-drying-v3", "allowing the spot to dry when the approved plan requires it", "Keep owner qualitative dry-state and teacher timing; TR-05 does not establish a physical drying method."],
  ["atom.observe.mark-chromatography-baseline", paperTR03, "item2-paper-baseline-v3", "drawing the pencil baseline", "Keep owner strip identity and baseline placement rule; no source coordinate is copied."],
  ["atom.observe.mark-chromatography-solvent-front", paperTR10, "item2-paper-solvent-front-v3", "marking the solvent front", "Keep owner developed-strip identity and evidence field; no source distance is copied."],
  ["atom.observe.open-developing-chamber", paperTR09, "item2-paper-open-chamber-v3", "removing the developed strip/opening the chamber", "Keep owner lid/strip order and safety state; TR-09 does not prescribe a UI gesture."],
  ["atom.place.developing-chamber", paperCHR00, "item2-paper-chamber-apparatus-v3", "placing the empty chamber", "Keep owner chamber identity and trial binding; CHR-00 does not provide simulator coordinates."],
  ["atom.place.insert-strip-into-chamber", paperTR06, "item2-paper-strip-insert-v3", "inserting the paper with its lower edge in solvent and spot above solvent", "Keep owner geometry/snap validation; TR-06 does not prescribe paper dimensions."],
  ["atom.place.remove-developed-strip", paperTR09, "item2-paper-strip-remove-v3", "removing the paper", "Keep owner developed-strip identity and post-removal state; no source gesture is copied."],
  ["atom.place.stationary-phase", paperCHR02, "item2-paper-stationary-phase-v3", "marking the pencil baseline on the paper as the stationary phase setup boundary", "Keep owner paper asset and baseline state; CHR-02 does not prescribe paper dimensions."],
  ["atom.spotSample.apply-baseline-spot", paperTR04, "item2-paper-spot-application-v3", "applying a small sample spot to the baseline", "Keep owner sample identity and spot-size validation; no source amount is copied."],
  ["atom.transfer.charge-developing-chamber", paperTR02, "item2-paper-solvent-charge-v3", "adding the approved amount of selected solvent to the chamber", "Keep owner solvent choice and teacher-approved amount; no source volume is copied."],
  ["atom.transfer.load-spotting-tool", paperCHR03, "item2-paper-spotting-tool-v3", "using the existing capillary/spotting tool at the baseline", "Keep owner tool identity and spot evidence; CHR-03 does not prescribe tool geometry."],
  ["atom.transfer.route-solvent-waste", paperTR19, "item2-paper-waste-route-v3", "disposing of solvent through the correct branch", "Keep owner solvent identity and teacher-designated waste route; TR-19 does not authorize a universal container."],
];
for (const [atomId, source, reviewId, sourceSupports, quantityAndConfigurationLimits] of paperOperations) {
  reviewedOperation({ owners: [paper], atomIds: [atomId], source, reviewId, sourceSupports, quantityAndConfigurationLimits });
}

// Quick Ache recovery uses exact extraction/filtration rows.  E-09--E-13 is not retained as a
// fake single row: actions that are not stated verbatim are marked as reviewed authored
// decompositions with their nearest bounded recovery phase and explicit limits.
const quick = "technique:quick-ache-extraction-recovery";
reviewedOperation({ owners: [quick], atomIds: ["atom.cool.fraction-observe-cooling"], source: quickE12, reviewId: "item2-quick-cooling-boundary-v3", sourceSupports: "the dry-mass read boundary that follows approved drying; cooling before that read is an authored safety/state prerequisite", quantityAndConfigurationLimits: "Keep owner cool-state, timing and qualitative recovery contract; E-12 does not specify a cooling method or temperature.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.dry.fraction-observe-dryness"], source: quickE11, reviewId: "item2-quick-drying-boundary-v3", sourceSupports: "drying a fraction by an approved method", quantityAndConfigurationLimits: "Keep owner qualitative dry-state and teacher-approved method; E-11 supplies no duration, temperature or physical endpoint.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.dry.fraction-remove-solvent"], source: quickE11, reviewId: "item2-quick-solvent-removal-boundary-v3", sourceSupports: "drying the fraction by the approved method; solvent removal is an authored decomposition of that drying phase", quantityAndConfigurationLimits: "Keep owner solvent identity, qualitative dry state and teacher method; no source evaporation rate or endpoint is invented.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.filter.pour-through-medium"], source: quickE10, reviewId: "item2-quick-filter-pour-v3", sourceSupports: "assembling filtration and filtering one recovered solid", quantityAndConfigurationLimits: "Keep owner recovered-solid identity, filter and receiver; E-10 supplies no volume or vacuum performance claim." });
reviewedOperation({ owners: [quick], atomIds: ["atom.mix.extraction-funnel"], source: quickE04, reviewId: "item2-quick-mix-vent-v3", sourceSupports: "mixing and venting the separatory funnel per an approved sequence", quantityAndConfigurationLimits: "Keep owner venting controls, pressure/recovery state and teacher-approved sequence; no source shake count is copied." });
reviewedAction({ owner: quick, atomId: "atom.observe.fraction-observe-residue", actionIds: ["plan-gravity-qar-precipitate-recovered-component"], source: quickE09, reviewId: "item2-quick-precipitate-observation-v3", sourceSupports: "acidifying/basicifying the selected fraction to the approved endpoint and observing the recovered component", quantityAndConfigurationLimits: "Keep owner endpoint, fraction identity and evidence; E-09 does not prescribe a pH or reagent amount." });
reviewedAction({ owner: quick, atomId: "atom.observe.fraction-observe-residue", actionIds: ["plan-gravity-qar-wash-aqueous-solid"], source: quickE11, reviewId: "item2-quick-wet-solid-observation-v3", sourceSupports: "the wet/dry fraction state around the approved drying operation", quantityAndConfigurationLimits: "Keep owner fraction identity and qualitative state; E-11 does not prescribe a wash amount or drying method.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.place.filter-medium", "atom.place.filtration-funnel", "atom.place.filtration-receiver", "atom.rinse.wet-filter-medium"], source: quickE10, reviewId: "item2-quick-filtration-assembly-v3", sourceSupports: "assembling filtration and filtering one recovered solid", quantityAndConfigurationLimits: "Keep owner funnel/filter/receiver identities and wetting state; E-10 does not prescribe apparatus coordinates or a water volume." });
reviewedOperation({ owners: [quick], atomIds: ["atom.place.transfer-medium-to-drying-vessel", "atom.rinse.wash-precipitate"], source: quickE11, reviewId: "item2-quick-drying-vessel-boundary-v3", sourceSupports: "drying the recovered fraction by the approved method; transfer/wash details are authored decompositions of the wet-solid preparation", quantityAndConfigurationLimits: "Keep owner solid identity, drying vessel, rinse amount and teacher method; E-11 does not prescribe those quantities.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.settle.extraction-funnel"], source: quickE05, reviewId: "item2-quick-layer-settle-v3", sourceSupports: "allowing the layers to separate", quantityAndConfigurationLimits: "Keep owner wait/observation condition and teacher-approved timing; E-05 does not set a universal duration." });
reviewedOperation({ owners: [quick], atomIds: ["atom.transfer.charge-extraction-funnel"], source: quickE03, reviewId: "item2-quick-charge-funnel-v3", sourceSupports: "adding phases and closing the funnel", quantityAndConfigurationLimits: "Keep owner phase identities, quantities and closure snap state; E-03 does not prescribe source volumes." });
reviewedOperation({ owners: [quick], atomIds: ["atom.transfer.decant-recovered-fraction"], source: quickE13, reviewId: "item2-quick-decant-recovery-v3", sourceSupports: "repeating recovery/drying/weighing for each component; decanting is the owner's transfer decomposition", quantityAndConfigurationLimits: "Keep owner source/target fraction identities and evidence; E-13 supplies no decant volume.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.transfer.drain-separated-phase"], source: quickE07, reviewId: "item2-quick-drain-phase-v3", sourceSupports: "draining one separated layer to its labeled vessel and retaining the other", quantityAndConfigurationLimits: "Keep owner layer identity, destination and stopcock controls; E-07 does not prescribe a phase volume." });
reviewedOperation({ owners: [quick], atomIds: ["atom.transfer.fraction-collect-residue"], source: quickE13, reviewId: "item2-quick-collect-recovery-v3", sourceSupports: "repeating recovery/drying/weighing for each component; collection is the owner-local recovery decomposition", quantityAndConfigurationLimits: "Keep owner fraction identity, destination and qualitative recovery evidence; E-13 does not prescribe a collected mass.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedAction({ owner: quick, atomId: "atom.transfer.fraction-dispose", actionIds: [
  "cleanup-qar-acidic-recovery-watch-glass-dispose-contents",
  "cleanup-qar-aqueous-recovery-watch-glass-dispose-contents",
  "cleanup-qar-organic-fraction-flask-dispose-contents",
  "cleanup-qar-organic-recovery-watch-glass-dispose-contents",
], source: quickE13, reviewId: "item2-quick-solid-waste-authored-boundary-v4", sourceSupports: "repeating recovery, drying and weighing for each recovered component; these solid-fraction cleanup actions are an authored, teacher-configured cleanup decomposition", quantityAndConfigurationLimits: "Keep each owner fraction identity, solid target and teacher-provided liquid/solid waste destinations. Quick Ache S-05 only establishes liquid waste in a teacher-designated container; it does not establish a solid destination, universal container or volume.", notSupported: "E-13 does not prescribe disposal, a container, a volume or physical disposal acceptance; the owner action remains an authored simulator boundary and must not be presented as source-authorized physical waste handling.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.transfer.fraction-remove-drying-agent"], source: quickE11, reviewId: "item2-quick-drying-agent-boundary-v3", sourceSupports: "drying the fraction by an approved method; removal of drying agent is an authored cleanup decomposition", quantityAndConfigurationLimits: "Keep owner drying-agent identity and qualitative state; E-11 does not prescribe a removal method or amount.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });
reviewedOperation({ owners: [quick], atomIds: ["atom.transfer.precipitating-reagent"], source: quickE09, reviewId: "item2-quick-precipitating-reagent-v3", sourceSupports: "acidifying/basicifying the selected fraction to the approved endpoint if planned", quantityAndConfigurationLimits: "Keep owner reagent identity, endpoint and teacher configuration; E-09 does not prescribe a concentration or volume." });
reviewedOperation({ owners: [quick], atomIds: ["atom.vent.extraction-funnel"], source: quickE04, reviewId: "item2-quick-vent-funnel-v3", sourceSupports: "venting the separatory funnel during the approved mixing sequence", quantityAndConfigurationLimits: "Keep owner venting direction, pressure state and teacher-approved sequence; E-04 does not establish hardware validation." });

// This source-derived owner is green-chemistry work.  BRASS-01 is a different operation; EX-06
// is the correct nearby source boundary for a planned mixture transfer, while the finite stock
// quantity remains a teacher-configured simulator input.
reviewedOperation({ owners: ["technique:thermal-decomposition-mass-loss"], atomIds: ["atom.observe.configure-solid-stock-inventory"], source: greenEX06, reviewId: "item2-configured-solid-inventory-v3", sourceSupports: "transferring the planned mixture mass into the crucible", quantityAndConfigurationLimits: "Keep the teacher-supplied mass, sourceInventory metadata and action configuration; EX-06 does not prescribe the operational stock quantity or turn setup into a learner balance reading.", notSupported: "The EX-06 citation does not establish a universal stock amount, balance tolerance, runtime heating result, scientific yield or classroom acceptance.", reviewStatus: "reviewed-authored-simulator-boundary", decisionDisposition: "reviewed-authored-boundary" });

// These five legacy atom-level decisions were already represented in the reviewed catalog, but
// they must still be keyed by owner and exact source locator.  Keeping them explicit prevents a
// future owner from inheriting an affirmative decision merely because it reuses an atom id.
reviewedOperation({ owners: [beverage], atomIds: ["atom.measure.variable-volume"], source: planRow("what-makes-hard-water-hard_2026-07-27.md", "phase", "PR-07", "M"), reviewId: "item2-beverage-variable-volume-v3", sourceSupports: "measuring the selected aliquot with a graduated device", quantityAndConfigurationLimits: "Keep the owner aliquot, device, reading field and configured tolerance; no source volume or analyte identity is copied." });
reviewedOperation({ owners: ["technique:blue1-percent-transmittance"], atomIds: ["atom.measure.variable-volume"], source: blueP03, reviewId: "item2-blue-variable-volume-v3", sourceSupports: "measuring the assigned dilution volume", quantityAndConfigurationLimits: "Keep the owner dilution configuration, device and input contract; no source volume is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.measure.variable-volume"], source: acidT03, reviewId: "item2-formal-variable-volume-v3", sourceSupports: "measuring the analyte aliquot", quantityAndConfigurationLimits: "Keep the owner aliquot, receiving vessel and precision; no source volume is copied." });
reviewedOperation({ owners: [phVolume], atomIds: ["atom.measure.variable-volume", "atom.transfer.measured-liquid"], source: fruitT02, reviewId: "item2-ph-volume-measured-aliquot-v3", sourceSupports: "measuring and transferring the prepared aliquot into the receiving vessel", quantityAndConfigurationLimits: "Keep the owner aliquot, source/target identity and configured amount; no source liquid identity or quantity is copied." });
reviewedOperation({ owners: ["technique:redox-titration"], atomIds: ["atom.measure.variable-volume"], source: redoxPA02, reviewId: "item2-redox-variable-volume-v3", sourceSupports: "measuring the prepared redox aliquot", quantityAndConfigurationLimits: "Keep the owner aliquot, measuring device and trial evidence; no source volume or analyte identity is copied." });
reviewedOperation({ owners: [beverage], atomIds: ["atom.transfer.measured-liquid"], source: blueP04, reviewId: "item2-beverage-measured-liquid-v3", sourceSupports: "transferring an already measured liquid into the receiving vessel", quantityAndConfigurationLimits: "Keep the owner liquid, source/target instances and configured amount; no source quantity is copied." });
reviewedOperation({ owners: ["technique:blue1-percent-transmittance"], atomIds: ["atom.transfer.measured-liquid"], source: blueP04, reviewId: "item2-blue-measured-liquid-v3", sourceSupports: "transferring the assigned measured dilution into the sample vessel", quantityAndConfigurationLimits: "Keep the owner sample identity, source/target and configured amount; no source quantity is copied." });
reviewedOperation({ owners: ["technique:brass-spectrophotometry"], atomIds: ["atom.transfer.measured-liquid"], source: brassB07, reviewId: "item2-brass-measured-liquid-v3", sourceSupports: "transferring the measured solution for the optical measurement", quantityAndConfigurationLimits: "Keep the owner solution identity, source/target and configured amount; no source quantity or concentration is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.transfer.measured-liquid"], source: acidT03, reviewId: "item2-formal-measured-liquid-v3", sourceSupports: "transferring the measured aliquot into the titration receiver", quantityAndConfigurationLimits: "Keep the owner aliquot, source/target identity and configured amount; no source quantity is copied." });
reviewedOperation({ owners: ["technique:redox-titration"], atomIds: ["atom.observe.titration-review-standardization"], source: redoxST06, reviewId: "item2-redox-standardization-review-v3", sourceSupports: "repeating fresh standardization trials and averaging the accepted readings", quantityAndConfigurationLimits: "Keep the owner trial references, calculation fields and teacher acceptance; ST-06 does not prescribe a concordance threshold." });
reviewedOperation({ owners: [beverage, phVolume], atomIds: ["atom.observe.titration-decide-curve"], source: fruitT09, reviewId: "item2-titration-curve-decision-v3", sourceSupports: "continuing the curve through and after the endpoint so the approved record can be assessed", quantityAndConfigurationLimits: "Keep the owner increment, endpoint, persistence and teacher configuration; no source stop threshold, pH or volume is copied." });
reviewedOperation({ owners: [formal], atomIds: ["atom.observe.titration-decide-curve"], source: acidT10, reviewId: "item2-formal-curve-decision-v3", sourceSupports: "repeating curve points with smaller increments near the steep region until the record is sufficient", quantityAndConfigurationLimits: "Keep the owner increment, endpoint, persistence and teacher configuration; T-10 does not prescribe a universal stop threshold." });

// Keep the selection table in lockstep with the explicit decision table.  A future owner/atom
// pair must be added deliberately instead of inheriting a source row from an atom label.
export const REVIEWED_SOURCE_SELECTIONS = Object.freeze({ ...selections, ...sameOwnerSelections });

export const REVIEWED_MAPPING_DECISIONS = Object.freeze({ ...mappingDecisions });

const unresolvedDecision = ({ atom, owner, sourceTrace }) => reviewedDecision({
  reviewId: `item2-unresolved-${String(owner ?? "unknown-owner").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${String(atom.id).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v1`,
  reviewStatus: "unresolved-source-review",
  decisionDisposition: "unresolved-source-review",
  sourceSupports: `No explicit owner/atom/source review is recorded for ${owner ?? "unknown owner"} / ${atom.documentationLabel ?? atom.id}${sourceTrace ? ` at ${locatorKey(sourceTrace)}` : ""}; the generated mapping remains visibly unresolved pending review.`,
  transferValidity: "No operation transfer is asserted by this disposition. The owner action remains authoritative for its own equipment, material, parameters and evidence contract.",
  quantityAndConfigurationLimits: "Do not copy source quantities, concentrations, timing, configuration, material identity or acceptance criteria until an explicit owner/atom/source review is recorded.",
  notSupported: "This unresolved disposition does not establish operation equivalence, owner-specific science, runtime behavior, classroom safety acceptance or a verbatim source prescription.",
});

export const reviewedDecisionFor = ({ atom, owner, sourceTrace }) => {
  const mapping = sourceTrace
    ? REVIEWED_MAPPING_DECISIONS[`${owner}|${atom.id}|${locatorKey(sourceTrace)}`]
    : null;
  return mapping ?? unresolvedDecision({ atom, owner, sourceTrace });
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
