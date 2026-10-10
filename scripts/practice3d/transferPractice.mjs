import { action, evidenceEffect, item, node, technique, twinOf } from "./common.mjs";

/**
 * Transfer Liquid, 3D practice version (PACK2_ATOMIZATION.md, "Transfer Liquid"; decision 2).
 *
 * The cylinder starts holding the measured hard-water sample (in the labs, Measure Liquid Volume
 * fills it first). The student places the beaker, pours the sample in and holds the cylinder over
 * the beaker until it drains (one step: the drain is drawn as part of the pour), rinses the
 * cylinder into the beaker with three squirts, and records the observation. The pour takes all the
 * cylinder holds (D8, 2026-10-10): in a lab that is the volume measured, within the line's tolerance.
 */
const sample = {
  kind: "liquid",
  label: "Hard water sample",
  volumeMl: "{{config.transferVolumeMl}}",
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState: "clear-liquid",
};
const water = {
  kind: "liquid",
  label: "Deionized water",
  volumeMl: 500,
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState: "clear-liquid",
};

const equipment = [
  item("graduated-cylinder-1", "graduated-cylinder", "Graduated cylinder", sample, "workbench"),
  item("beaker-250ml-1", "beaker-250ml", "250 mL beaker"),
  item("wash-bottle-1", "wash-bottle", "Wash bottle", water),
];

const actions = [
  action("place-beaker", "place", "Place the 250 mL beaker", {
    equipmentDefinitionId: "beaker-250ml",
    equipmentInstanceId: "beaker-250ml-1",
    location: "workbench",
  }, { atomId: "atom.place.precipitation-vessel", roles: { "precipitation-vessel": "beaker-250ml" }, success: "The beaker is on the bench." }),
  action("transfer-sample", "transfer", "Pour the sample into the beaker", {
    sourceDefinitionId: "graduated-cylinder",
    sourceInstanceId: "graduated-cylinder-1",
    targetDefinitionId: "beaker-250ml",
    targetInstanceId: "beaker-250ml-1",
    drainMeasuringVessel: true,
  }, {
    atomId: "atom.transfer.measured-liquid-to-precipitation-vessel",
    // With no volume the default callout would read "pour the requested volume"; all of it is poured.
    interaction: { type: "pourInto", sourceDefinitionId: "graduated-cylinder", targetDefinitionId: "beaker-250ml" },
    roles: { "measured-solvent-source": "graduated-cylinder", "precipitation-vessel": "beaker-250ml" },
    success: "The sample is in the beaker; the cylinder has drained.",
  }),
  action("rinse-cylinder-into-beaker", "rinse", "Rinse the cylinder into the beaker", {
    sourceDefinitionId: "wash-bottle",
    sourceInstanceId: "wash-bottle-1",
    targetDefinitionId: "graduated-cylinder",
    targetInstanceId: "graduated-cylinder-1",
    washingsReceiverInstanceId: "beaker-250ml-1",
    washingsReceiverDefinitionId: "beaker-250ml",
    rinseType: "quantitative-transfer",
    rinsePortions: 3,
    tag: "cylinder-rinsed-into-beaker",
  }, {
    atomId: "atom.rinse.quantitative-transfer",
    interaction: { type: "rinseTarget", sourceDefinitionId: "wash-bottle", targetDefinitionId: "graduated-cylinder" },
    roles: { "rinse-water-source": "wash-bottle", "rinsed-vessel": "graduated-cylinder", "receiving-vessel": "beaker-250ml" },
    success: "The cylinder is rinsed into the beaker.",
  }),
  action("observe-transfer", "observe", "Record the transfer observation", {
    note: "{{config.transferObservation}}",
    tag: "transfer-observation",
  }, { evidence: ["observe", "notebook"], success: "Observation recorded." }),
];

const nodes = [
  node("place-beaker", "Place the beaker", "Place the clean 250 mL beaker on the bench."),
  node("transfer-sample", "Pour in the sample",
    "Pour the measured sample from the graduated cylinder into the beaker, then hold the cylinder upside down over the beaker for a few seconds so it drains."),
  node("rinse-cylinder-into-beaker", "Rinse the cylinder",
    "Rinse the inside of the cylinder into the beaker with three small squirts from the wash bottle, so the sample left on its walls goes in too.",
    { notebookTag: "cylinder-rinsed-into-beaker" }),
  node("observe-transfer", "Record the observation", "Record what you see in the beaker.", { action: "observe-transfer" }, "observation"),
];

const practice = technique({
  id: "transfer-practice",
  title: "Transfer Liquid",
  learningGoal: "Move a measured liquid sample completely into a beaker: pour, drain and rinse the measuring cylinder.",
  equipment,
  actions,
  nodes,
  slots: [
    { id: "transferVolumeMl", valueType: "number", required: true, defaultValue: 20 },
    { id: "transferObservation", valueType: "string", required: true },
  ],
  evidenceOutputs: [{ id: "transfer-observation", kind: "notebook", actionId: "observe-transfer", referenceId: "transfer-observation" }],
  successActionId: "transfer-sample",
  tags: ["transfer"],
  legacyActionEffects: [evidenceEffect("observe-transfer")],
});

export default practice;

/** The composable twin a 3D lab composes (D8 E0, 2026-10-10). It drops the sample volume, which only fills the practice bench: in a lab, the cylinder holds what Measure Liquid Volume measured. */
export const twin = twinOf(practice, { id: "transfer-3d", dropSlots: ["transferVolumeMl"] });
