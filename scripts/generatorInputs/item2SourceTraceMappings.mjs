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

const selections = {};
const setFor = (owners, atomIds, source) => {
  for (const owner of owners) {
    for (const atomId of atomIds) selections[`${owner}|${atomId}`] = source;
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
  "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-07", "M",
));
setFor([beverage], [
  "atom.transfer.burette-rinsate-to-waste",
  "atom.transfer.discard-titrated-mixture",
], locator("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-06", "M/C"));
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
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-07", "R/C",
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
  "atom.observe.titration-read-final",
  "atom.observe.titration-read-ph",
], locator("acid-base-titration-curves_2026-07-27.md", "phase", "T-08", "M"));
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
  "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-07", "M",
));
setFor([formal], ["atom.rinse.condition-burette"], locator(
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-01", "R/C",
));
setFor([formal], [
  "atom.transfer.burette-rinsate-to-waste",
  "atom.transfer.discard-titrated-mixture",
], locator("hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-06", "M/C"));
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
  "what-makes-hard-water-hard_2026-07-27.md", "phase", "FD-07", "M",
));
setFor([phVolume], [
  "atom.transfer.burette-rinsate-to-waste",
  "atom.transfer.discard-titrated-mixture",
], locator("acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-03", "R/C"));
setFor([phVolume], ["atom.transfer.fill-burette"], locator(
  "acid-base-titration-curves_2026-07-27.md", "phase", "T-02", "M/R",
));
setFor([phVolume], ["atom.transfer.measured-liquid"], locator(
  "acid-in-fruit-juice-and-soft-drinks_2026-07-27.md", "phase", "T-02", "M/R",
));

setFor(["technique:hard-water-two-sample-inquiry"], [
  "atom.rinse.fraction-remove-label",
  "atom.transfer.fraction-dispose",
], locator("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-09 to E-13", "R/C"));
setFor(["technique:two-stage-precipitate-drying"], [
  "atom.rinse.fraction-remove-label",
  "atom.transfer.fraction-dispose",
], locator("quick-ache-relief-component-separation_2026-07-27.md", "phase", "E-09 to E-13", "R/C"));
setFor(["technique:quick-ache-property-evidence"], [
  "atom.transfer.apply-test-solvent",
  "atom.transfer.microsample-portion",
], locator("bonding-in-unknown-solids_2026-07-27.md", "phase", "K-03", "M/C"));

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
  "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-06", "M/C",
));
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
    "hydrogen-peroxide-redox-titration_2026-07-27.md", "phase", "ST-06", "M/C",
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
}) => ({
  reviewId,
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

export const reviewedDecisionFor = (atom) => REVIEWED_ATOM_DECISIONS[atom.id] ?? reviewedDecision({
  reviewId: `item2-shared-${String(atom.id).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v1`,
  sourceSupports: `The cited row is reviewed as an operation-level exemplar for ${atom.documentationLabel ?? atom.id}.`,
  transferValidity: `The owner action keeps the ${atom.id} contract and its own equipment, material and evidence bindings; only the shared operation boundary is transferred.`,
  quantityAndConfigurationLimits: `Use each member action's authored parameters and configuration. The cited source values are not copied into generated owner actions.`,
  notSupported: "This contextual mapping does not prove owner-specific quantities, concentrations, timing, material identity, result values, runtime behavior or scientific acceptance.",
});

export const selectionFor = ({ owner, atomId, actionBasis }) => ({
  locator: REVIEWED_SOURCE_SELECTIONS[`${owner}|${atomId}|${actionBasis}`]
    ?? REVIEWED_SOURCE_SELECTIONS[`${owner}|${atomId}`]
    ?? null,
  selectionKey: REVIEWED_SOURCE_SELECTIONS[`${owner}|${atomId}|${actionBasis}`]
    ? `${owner}|${atomId}|${actionBasis}`
    : REVIEWED_SOURCE_SELECTIONS[`${owner}|${atomId}`]
      ? `${owner}|${atomId}`
      : null,
});
