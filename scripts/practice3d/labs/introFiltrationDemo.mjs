import { emptyContents, item, original, setup } from "../common.mjs";
import { twin as filtration } from "../filtrationPractice.mjs";
import { twin as precipitation } from "../precipitationPractice.mjs";
import { twin as transfer } from "../transferPractice.mjs";

/**
 * Precipitate and Filter Calcium Carbonate in 3D (D8, decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`,
 * "E0 design"): Pack 1's Measure Liquid Volume as it is, then the twins of Transfer Liquid, Precipitation
 * and Filter a Precipitate, on one bench. The 2D lab of the same id is not read.
 *
 * Every item a technique starts with is mapped, by hand, to a lab item (`items`); the build derives the
 * role bindings from the map. An item that a step places starts on the tray; one that no step places
 * starts on the bench, as in the practice versions. The reagent is the precipitation's working portion in
 * a 150 mL beaker, so the dropping pipette never enters a stock bottle (the teacher's rule of 2026-09-26).
 */
const liquid = (label, volumeMl, kind = "liquid", visualState = "clear-liquid") => ({
  ...emptyContents(), kind, label, volumeMl, wetState: "wet", visualState,
});

/** What the runtime adds to the sample beaker besides the sample and the reagent (mL). */
const CYLINDER_RINSE_ML = 9; // three 3 mL squirts (transfer)
const ROD_RINSE_ML = 5; // the rod rinsed back into the beaker (precipitation)
const DROP_TEST_ML = 0.05; // one drop at the completeness test
const BEAKER_RINSE_AND_WASH_ML = 18; // three squirts each into the funnel and onto the solid (filtration)
const PIPETTE_FILL_ML = 1; // the dropping pipette's fill from the working portion

export default {
  id: "intro-filtration-demo",
  title: "Precipitate and Filter Calcium Carbonate",
  description: "Measure a hard-water sample, pour it into a beaker, precipitate its calcium as calcium carbonate, and collect the solid by gravity filtration.",
  audience: "Introductory chemistry students",
  learningGoals: [
    "Measure a liquid sample with a graduated cylinder",
    "Transfer it completely into a beaker",
    "Precipitate calcium carbonate completely",
    "Collect the precipitate by gravity filtration",
  ],
  safetyNotes: [
    "Wear eye protection.",
    "Sodium carbonate solution irritates the eyes; rinse any splash with plenty of water.",
    "Wipe up spills at once.",
  ],
  bench: [
    item("sample-bottle-1", "sample-bottle", "Hard water sample", liquid("Hard water sample", 120), "workbench"),
    item("graduated-cylinder-1", "graduated-cylinder", "Graduated cylinder"),
    item("beaker-250ml-1", "beaker-250ml", "Sample beaker"),
    item("wash-bottle-1", "wash-bottle", "Wash bottle", liquid("Deionized water", 500), "workbench"),
    item("reagent-beaker-1", "beaker-150ml", "Sodium carbonate solution",
      liquid("Sodium carbonate solution", setup("workingPortionMl"), "solution", "clear-solution"), "workbench"),
    item("stirring-rod-1", "stirring-rod", "Stirring rod"),
    item("beral-pipette-1", "beral-pipette", "Dropping pipette"),
    item("analytical-balance-1", "analytical-balance", "Analytical balance", undefined, "workbench"),
    item("ring-stand-1", "ring-stand", "Ring stand"),
    item("funnel-1", "funnel", "Glass funnel"),
    item("funnel-stand-1", "funnel-stand", "Funnel in the ring stand", undefined, "storage"),
    item("filter-paper-1", "filter-paper", "Filter paper"),
    item("erlenmeyer-flask-250ml-1", "erlenmeyer-flask-250ml", "Receiving flask"),
  ],
  parts: [
    {
      instanceId: "measuring-volume",
      technique: original("measuring-volume"),
      items: { "graduated-cylinder-1": "graduated-cylinder-1", "sample-bottle-1": "sample-bottle-1" },
      configuration: { targetVolumeMl: setup("sampleVolumeMl"), volumeToleranceMl: 1, volumeMeasurementId: "sample-volume" },
    },
    {
      instanceId: "transfer",
      technique: transfer,
      items: { "graduated-cylinder-1": "graduated-cylinder-1", "beaker-250ml-1": "beaker-250ml-1", "wash-bottle-1": "wash-bottle-1" },
      configuration: { transferVolumeMl: setup("sampleVolumeMl"), transferObservation: setup("transferObservation") },
    },
    {
      instanceId: "hard-water-precipitation",
      technique: precipitation,
      items: {
        "beaker-250ml-1": "beaker-250ml-1",
        "reagent-beaker-1": "reagent-beaker-1",
        "stirring-rod-1": "stirring-rod-1",
        "beral-pipette-1": "beral-pipette-1",
        "wash-bottle-1": "wash-bottle-1",
      },
      configuration: {
        reagentVolumeMl: setup("reagentVolumeMl"),
        precipitateMassG: setup("precipitateMassG"),
        precipitateObservation: setup("precipitateObservation"),
        completenessObservation: setup("completenessObservation"),
      },
    },
    {
      instanceId: "filtration",
      technique: filtration,
      items: {
        "beaker-250ml-1": "beaker-250ml-1",
        "stirring-rod-1": "stirring-rod-1",
        "analytical-balance-1": "analytical-balance-1",
        "ring-stand-1": "ring-stand-1",
        "funnel-1": "funnel-1",
        "funnel-stand-1": "funnel-stand-1",
        "filter-paper-1": "filter-paper-1",
        "erlenmeyer-flask-250ml-1": "erlenmeyer-flask-250ml-1",
        "wash-bottle-1": "wash-bottle-1",
      },
      configuration: { paperMassG: setup("paperMassG") },
    },
  ],
  /** The teacher's values (E0 choice B, 2026-10-10: every field has a proposed default the teacher approves or changes). */
  setup: [
    { id: "sampleVolumeMl", label: "Sample volume", unit: "mL", kind: "number", defaultValue: 20, min: 5, max: 100,
      help: "Measured in the 100 mL cylinder and poured into the beaker." },
    { id: "transferObservation", label: "Observation after the transfer", kind: "text",
      defaultValue: "The sample is clear and colourless, and none was spilled." },
    { id: "workingPortionMl", label: "Sodium carbonate working portion", unit: "mL", kind: "number", defaultValue: 50, min: 5, max: 150,
      help: "Poured from the stock into the 150 mL beaker before class." },
    { id: "reagentVolumeMl", label: "Sodium carbonate added", unit: "mL", kind: "number", defaultValue: 20, min: 3, max: 140,
      help: "Added in three equal portions while stirring." },
    { id: "precipitateMassG", label: "Precipitate mass (the model's value)", unit: "g", kind: "number", defaultValue: 0.0075, min: 0.0001, max: 5,
      help: "The calcium carbonate the sample gives. It is never shown to the student as a measurement." },
    { id: "precipitateObservation", label: "Observation after the first portion", kind: "text",
      defaultValue: "A white precipitate forms where the carbonate meets the sample." },
    { id: "completenessObservation", label: "Observation at the drop test", kind: "text",
      defaultValue: "No new cloudiness where the drop meets the clear liquid." },
    { id: "paperMassG", label: "Dry filter paper's mass", unit: "g", kind: "number", defaultValue: 0.553, min: 0.1, max: 2,
      help: "What the balance shows for the dry 9 cm paper." },
  ],
  /** Checks across fields, in the volumes the runtime adds. */
  rules: [
    { fields: ["sampleVolumeMl", "reagentVolumeMl"], plus: CYLINDER_RINSE_ML + ROD_RINSE_ML + DROP_TEST_ML + BEAKER_RINSE_AND_WASH_ML, atMost: 250,
      message: "The sample, the reagent and the rinses must fit in the 250 mL receiving flask: lower the sample or the reagent." },
    { fields: ["reagentVolumeMl"], plus: PIPETTE_FILL_ML, atMost: "workingPortionMl",
      message: "The working portion must hold the reagent added and 1 mL more for the dropping pipette." },
  ],
};
