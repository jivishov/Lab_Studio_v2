import { action, item, node, technique } from "./common.mjs";

/**
 * Paper Chromatography, 3D practice version (Pack 3, decided 2026-10-10; `proposals/PACK3_ATOMIZATION.md`, "Paper
 * Chromatography"; decisions 3, 8, 10 and 12). The water trial.
 *
 * Pack 3a step 3 lists the bench, so the Pack 3 models are validated against it: the chamber with its blank label
 * tape, the 100 mL cylinder, a fresh strip, the pencil, the ruler, a capillary, the dye mixture in a small vial, the
 * distilled-water bottle and the sink. The sequence is step 4's; until then the version places the chamber and lays
 * the strip.
 */
const at = (instance, x, y) => ({ ...instance, x, y });
const water = { kind: "liquid", label: "Distilled water", volumeMl: 250, solutes: [], contamination: [], wetState: "wet", visualState: "clear-liquid" };
const dye = {
  kind: "mixture",
  label: "Food dye mixture",
  volumeMl: 5,
  solutes: [{ id: "teacher-food-dye-mixture", label: "Teacher-provided food dye mixture", amount: 1, unit: "mg" }],
  contamination: [],
  wetState: "wet",
  visualState: "blue-dye-solution",
};
const fresh = { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "paper-unspotted" };

const equipment = [
  at(item("lab-sink-1", "lab-sink", "Sink", undefined, "workbench"), 604, 0),
  item("chamber-1", "chromatography-chamber", "Chromatography chamber", { ...fresh, visualState: "empty", developingChamberClosed: false }),
  item("graduated-cylinder-1", "graduated-cylinder", "100 mL graduated cylinder"),
  item("paper-1", "chromatography-paper", "Fresh chromatography strip", fresh),
  item("pencil-1", "pencil", "Pencil"),
  item("ruler-1", "metric-ruler", "Metric ruler"),
  item("capillary-1", "capillary-spotter", "Capillary tube"),
  item("dye-vial-1", "small-vial", "Food dye mixture", dye),
  item("water-bottle-1", "distilled-water-bottle", "Distilled water", water),
];

const actions = [
  action("place-chamber", "place", "Place the chamber", {
    equipmentDefinitionId: "chromatography-chamber",
    equipmentInstanceId: "chamber-1",
    location: "workbench",
  }, { atomId: "atom.place.developing-chamber", roles: { "developing-chamber": "chromatography-chamber" }, success: "The chamber stands on the bench." }),
  action("place-paper", "place", "Lay the strip flat", {
    equipmentDefinitionId: "chromatography-paper",
    equipmentInstanceId: "paper-1",
    location: "workbench",
  }, { atomId: "atom.place.stationary-phase", roles: { "stationary-phase": "chromatography-paper" }, success: "The fresh strip lies flat." }),
];

const nodes = [
  node("place-chamber", "Place the chamber", "Stand the empty chamber upright on the bench."),
  node("place-paper", "Lay the strip flat", "Lay a fresh strip flat on the bench, ready for its pencil line."),
];

const practice = technique({
  id: "paper-chromatography-practice",
  title: "Paper Chromatography",
  learningGoal: "Separate a food-dye mixture on paper with water as the mobile phase, and measure each band's Rf.",
  equipment,
  actions,
  nodes,
  slots: [],
  evidenceOutputs: [],
  successActionId: "place-paper",
  tags: ["chromatography", "rf"],
});

export default practice;
