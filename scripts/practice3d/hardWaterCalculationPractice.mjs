import { action, emptyContents, item, node, technique, twinOf } from "./common.mjs";

/**
 * Calculate Hardness, 3D practice version (Pack 3, decided 2026-10-10; `proposals/PACK3_ATOMIZATION.md`, "Calculate
 * Hardness"; decisions 1, 7 and 9). Not source-derived (the registry: "Original demo technique"): its step is the
 * teacher's (T), with Investigation 3's INQ-08 as context; the demo does not preconcentrate, so the runtime's
 * `preconcentrationFactor` stays 1.
 *
 * Six steps. The first five stand in for the techniques played before it in `hard-water-demo`: the student notes the
 * sample's volume, the watch glass's, the paper's and the dry assembly's masses, and works out the precipitate's mass
 * by difference as Dry and Weigh's last step does (`gravimetricPrecipitateMass`). The sixth is the hardness in mg/L as
 * CaCO3, entered by the student (`requireStudentValue`) and judged against the template (g × 10⁶ ÷ mL; 375 mg/L for
 * 0.0075 g in 20 mL) within 0.5 mg/L. The bench is the drained cylinder and the watch glass with the dry solid on its
 * paper, so the numbers have a source in front of the student; nothing on it is weighed.
 *
 * The hardness reads the sample volume through `sampleVolumeMeasurementId` and the precipitate's mass, a calculation,
 * through `precipitateMassCalculationId`; its own result id, `hardness-mg-l`, stays literal, so a lab scopes the
 * action and its rule alike. The steps that produce those two read them through the same slots, so the practice
 * version produces what its hardness consumes.
 */
const DRY_SOLID_G = 0.0075; // the dry solid as the bench shows it (the default sample's); no step weighs it here

const drySolid = {
  kind: "precipitate",
  label: "Calcium carbonate",
  massG: DRY_SOLID_G,
  solutes: [],
  precipitate: { substance: "Calcium carbonate", massG: DRY_SOLID_G, rinsed: true, dryness: "dry", dryMassG: DRY_SOLID_G },
  contamination: [],
  wetState: "dry",
  visualState: "cooled-dry-precipitate",
};

const equipment = [
  item("graduated-cylinder-1", "graduated-cylinder-25ml", "25 mL graduated cylinder", { ...emptyContents(), wetState: "wet" }, "workbench"),
  item("watch-glass-1", "watch-glass", "Labelled watch glass", undefined, "workbench"),
  { ...item("filter-paper-1", "filter-paper", "Filter paper", drySolid), location: "snapZone", snapZoneId: "watch-glass-paper-seat" },
];

/** A noted value: a teacher's number standing in for a reading taken in an earlier technique. */
const note = (id, measurementId, label, inputLabel, unit, slotId, quantity) => action(id, "observe", label, {
  measurementId,
  inputMode: "numeric",
  inputRole: "teacherConfiguration",
  inputLabel,
  inputMin: 0,
  inputMinExclusive: true,
  unit,
  configuredValue: `{{config.${slotId}}}`,
  configurationQuantity: quantity,
  configurationProvenance: "teacher-configured",
  tag: `${id}-done`,
}, { atomId: "atom.observe.record-teacher-configured-numeric-value", evidence: ["observe", "notebook"], success: `${quantity[0].toUpperCase()}${quantity.slice(1)} noted.` });

const actions = [
  note("note-sample-volume", "{{config.sampleVolumeMeasurementId}}", "Note the sample's volume", "Sample volume, read on the cylinder (mL)", "mL", "sampleVolumeMl", "sample volume"),
  note("note-watch-glass-mass", "watch-glass-mass", "Note the watch glass's mass", "Empty watch glass, weighed before drying (g)", "g", "watchGlassMassG", "watch glass mass"),
  note("note-paper-mass", "filter-paper-mass", "Note the filter paper's mass", "Filter paper, weighed dry before filtering (g)", "g", "paperMassG", "filter paper mass"),
  note("note-combined-mass", "combined-mass", "Note the dry assembly's mass", "Watch glass, paper and dry precipitate, weighed cool (g)", "g", "combinedMassG", "dry assembly mass"),
  action("precipitate-by-difference", "calculate", "Work out the precipitate's mass", {
    calculationId: "{{config.precipitateMassCalculationId}}",
    template: "gravimetricPrecipitateMass",
    combinedMassMeasurementId: "combined-mass",
    watchGlassMassMeasurementId: "watch-glass-mass",
    filterPaperMassMeasurementId: "filter-paper-mass",
    tolerance: 0.001,
  }, { evidence: ["calculate"], success: "Precipitate mass worked out." }),
  action("calculate-hardness", "calculate", "Calculate the hardness", {
    calculationId: "hardness-mg-l",
    template: "hardnessMgLAsCaCO3",
    sampleVolumeMeasurementId: "{{config.sampleVolumeMeasurementId}}",
    precipitateMassCalculationId: "{{config.precipitateMassCalculationId}}",
    tolerance: "{{config.calculationTolerance}}",
    requireStudentValue: true,
    unit: "mg/L as CaCO3",
  }, { evidence: ["calculate"], success: "The hardness is within tolerance." }),
];

const nodes = [
  node("note-sample-volume", "Note the sample's volume", "Note the volume of the water sample you measured in the cylinder.", { measurementId: "{{config.sampleVolumeMeasurementId}}" }, "observation"),
  node("note-watch-glass-mass", "Note the watch glass's mass", "Note the empty watch glass's mass, which you weighed before drying.", { measurementId: "watch-glass-mass" }, "observation"),
  node("note-paper-mass", "Note the paper's mass", "Note the dry filter paper's mass, which you weighed before filtering.", { measurementId: "filter-paper-mass" }, "observation"),
  node("note-combined-mass", "Note the dry assembly's mass", "Note the mass of the cool watch glass with the paper and the dry precipitate.", { measurementId: "combined-mass" }, "observation"),
  node("precipitate-by-difference", "Work out the precipitate's mass",
    "Subtract the watch glass's mass and the paper's mass from the combined mass.", { calculationId: "{{config.precipitateMassCalculationId}}" }, "calculation"),
  node("calculate-hardness", "Calculate the hardness",
    "Calculate the water's hardness in mg/L as CaCO3: the precipitate's mass in grams × 1,000,000 ÷ the sample's volume in millilitres. Enter it.",
    { calculationId: "hardness-mg-l" }, "calculation"),
];

const practice = technique({
  id: "hard-water-calculation-practice",
  title: "Calculate Hardness",
  learningGoal: "Calculate a water sample's hardness in mg/L as CaCO3 from the precipitate's mass and the sample's volume.",
  equipment,
  actions,
  nodes,
  slots: [
    { id: "sampleVolumeMl", valueType: "number", required: true, defaultValue: 20 },
    { id: "watchGlassMassG", valueType: "number", required: true, defaultValue: 30 },
    { id: "paperMassG", valueType: "number", required: true, defaultValue: 0.553 },
    { id: "combinedMassG", valueType: "number", required: true, defaultValue: 30.5605 },
    { id: "sampleVolumeMeasurementId", valueType: "string", required: true, defaultValue: "sample-volume" },
    { id: "precipitateMassCalculationId", valueType: "string", required: true, defaultValue: "precipitate-mass" },
    { id: "calculationTolerance", valueType: "number", required: true, defaultValue: 0.5 },
  ],
  evidenceOutputs: [
    { id: "precipitate-mass", kind: "calculation", actionId: "precipitate-by-difference", referenceId: "{{config.precipitateMassCalculationId}}" },
    { id: "hardness-mg-l", kind: "calculation", actionId: "calculate-hardness", referenceId: "hardness-mg-l" },
  ],
  successActionId: "calculate-hardness",
  tags: ["calculation", "gravimetry", "hard-water"],
  legacyActionEffects: [
    { actionId: "precipitate-by-difference", effect: { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] } },
    { actionId: "calculate-hardness", effect: { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] } },
  ],
});
// The technique is done when the hardness is right, not merely submitted (a wrong one is corrected in the step).
practice.successCriteria = [{ id: `${practice.id}-success`, type: "calculationWithinTolerance", label: "The hardness is within tolerance.", calculationId: "hardness-mg-l" }];

export default practice;

/**
 * The composable twin `hard-water-demo` composes: the hardness step alone. The five stand-ins and the values that only
 * fill them go; the two ids the lab binds and the tolerance stay.
 */
export const twin = twinOf(practice, {
  id: "hard-water-calculation-3d",
  dropSteps: ["note-sample-volume", "note-watch-glass-mass", "note-paper-mass", "note-combined-mass", "precipitate-by-difference"],
  dropSlots: ["sampleVolumeMl", "watchGlassMassG", "paperMassG", "combinedMassG"],
});
