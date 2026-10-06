import { action, evidenceEffect, item, node, technique } from "./common.mjs";

/**
 * Hard-Water Calcium Carbonate Precipitation, 3D practice version (PACK2_ATOMIZATION.md,
 * "Precipitation"; decisions 6 and 7).
 *
 * The sample is already in the beaker. The rod stands in it; the sodium carbonate solution goes in
 * three portions while the rod stirs, the first followed by the observation; the mixture is stirred
 * two more minutes (PR-15, on the fast step clock); the rod is rinsed back into the beaker, so the solid
 * on it is not lost, and comes out (decided 2026-10-06 in the Pack 2 fidelity review); the precipitate
 * settles; one drop of reagent from a dropping pipette on the clear liquid shows no new cloudiness.
 *
 * The reagent is a working portion in a 150 mL beaker, so the pipette never enters a stock bottle
 * (the teacher's rule of 2026-09-26). The precipitate's mass stays a teacher setting, the model's
 * value, never a measurement.
 */
const liquid = (label, volumeMl, solutes = []) => ({
  kind: "liquid",
  label,
  volumeMl,
  solutes,
  contamination: [],
  wetState: "wet",
  visualState: "clear-liquid",
});

const ROD_GATE = {
  requiredAttachmentState: "attached",
  attachmentParentDefinitionId: "beaker-250ml",
  attachmentChildDefinitionId: "stirring-rod",
  attachmentSnapZoneId: "beaker-250ml-stirring-rod-rest",
  attachmentParentInstanceId: "beaker-250ml-1",
  attachmentChildInstanceId: "stirring-rod-1",
};

const water = liquid("Deionized water", 500);

const equipment = [
  item("beaker-250ml-1", "beaker-250ml", "Sample beaker", liquid("Hard water sample", "{{config.sampleVolumeMl}}"), "workbench"),
  item("reagent-beaker-1", "beaker-150ml", "Sodium carbonate solution", {
    ...liquid("Sodium carbonate solution", "{{config.reagentStockVolumeMl}}"),
    kind: "solution",
    visualState: "clear-solution",
  }, "workbench"),
  item("stirring-rod-1", "stirring-rod", "Stirring rod"),
  item("beral-pipette-1", "beral-pipette", "Dropping pipette"),
  item("wash-bottle-1", "wash-bottle", "Wash bottle", water),
];

const portion = (index, label, success) => action(`add-reagent-portion-${index}`, "precipitate", label, {
  sourceDefinitionId: "beaker-150ml",
  sourceInstanceId: "reagent-beaker-1",
  targetDefinitionId: "beaker-250ml",
  targetInstanceId: "beaker-250ml-1",
  portionIndex: index,
  portionCount: 3,
  reagentVolumeMl: "{{config.reagentVolumeMl}}",
  precipitateMassG: "{{config.precipitateMassG}}",
  ...ROD_GATE,
}, {
  atomId: "atom.precipitate.add-reagent-in-portions",
  interaction: { type: "pourInto", sourceDefinitionId: "beaker-150ml", targetDefinitionId: "beaker-250ml" },
  roles: { "precipitating-reagent-source": "beaker-150ml", "precipitation-vessel": "beaker-250ml", "stirring-device": "stirring-rod" },
  success,
});

const actions = [
  action("place-stirring-rod", "place", "Stand the stirring rod in the beaker", {
    equipmentDefinitionId: "stirring-rod",
    equipmentInstanceId: "stirring-rod-1",
    targetDefinitionId: "beaker-250ml",
    targetInstanceId: "beaker-250ml-1",
    location: "snapZone",
    snapZoneId: "beaker-250ml-stirring-rod-rest",
  }, { atomId: "atom.place.stirring-rod-in-vessel", roles: { "stirring-device": "stirring-rod", "precipitation-vessel": "beaker-250ml" },
    success: "The rod stands in the beaker." }),
  portion(1, "Add the first portion while stirring", "The first portion is in: a white precipitate forms."),
  action("observe-precipitate", "observe", "Record what you see", {
    note: "{{config.precipitateObservation}}",
    tag: "precipitate-observation",
  }, { evidence: ["observe", "notebook"], success: "Observation recorded." }),
  portion(2, "Add the second portion while stirring", "The second portion is in; the precipitate grows."),
  portion(3, "Add the last portion while stirring", "All the reagent is in."),
  action("stir-two-minutes", "mix", "Keep stirring for two more minutes", {
    benchOperation: "stir",
    vesselInstanceId: "beaker-250ml-1",
    vesselDefinitionId: "beaker-250ml",
    stirMinutes: 2,
    tag: "stirred-two-more-minutes",
    ...ROD_GATE,
  }, {
    atomId: "atom.mix.stir-with-rod",
    interaction: { type: "recordNotebook", valueParameter: "note" },
    roles: { "precipitation-vessel": "beaker-250ml", "stirring-device": "stirring-rod" },
    success: "Stirred for two more minutes.",
  }),
  action("rinse-stirring-rod", "rinse", "Rinse the rod into the beaker", {
    sourceDefinitionId: "wash-bottle",
    sourceInstanceId: "wash-bottle-1",
    targetDefinitionId: "stirring-rod",
    targetInstanceId: "stirring-rod-1",
    washingsReceiverInstanceId: "beaker-250ml-1",
    washingsReceiverDefinitionId: "beaker-250ml",
    rinseType: "quantitative-transfer",
    tag: "stirring-rod-rinsed",
  }, {
    atomId: "atom.rinse.stirring-rod-into-vessel",
    interaction: { type: "rinseTarget", sourceDefinitionId: "wash-bottle", targetDefinitionId: "stirring-rod" },
    roles: { "rinse-water-source": "wash-bottle", "stirring-device": "stirring-rod", "receiving-vessel": "beaker-250ml" },
    success: "The solid on the rod is washed back into the beaker.",
  }),
  action("remove-stirring-rod", "place", "Lift the stirring rod out", {
    equipmentDefinitionId: "stirring-rod",
    equipmentInstanceId: "stirring-rod-1",
    location: "workbench",
  }, { atomId: "atom.place.remove-stirring-rod", roles: { "stirring-device": "stirring-rod", "precipitation-vessel": "beaker-250ml" },
    success: "The rod is on the bench." }),
  action("settle-precipitate", "settle", "Let the precipitate settle", {
    benchOperation: "settle-precipitate",
    vesselInstanceId: "beaker-250ml-1",
    vesselDefinitionId: "beaker-250ml",
    settleMinutes: 2,
    tag: "precipitate-settled",
  }, {
    atomId: "atom.settle.let-precipitate-settle",
    interaction: { type: "recordNotebook", valueParameter: "note" },
    roles: { "precipitation-vessel": "beaker-250ml" },
    success: "The solid has settled; the liquid above it is clear.",
  }),
  action("fill-dropping-pipette", "transfer", "Fill the dropping pipette with reagent", {
    sourceDefinitionId: "beaker-150ml",
    sourceInstanceId: "reagent-beaker-1",
    targetDefinitionId: "beral-pipette",
    targetInstanceId: "beral-pipette-1",
    volumeMl: 1,
  }, {
    atomId: "atom.transfer.draw-into-transfer-pipette",
    roles: { "pipette-liquid-source": "beaker-150ml", "transfer-pipette": "beral-pipette" },
    success: "The pipette holds a little reagent.",
  }),
  action("drop-test", "observe", "Add one drop and look", {
    benchOperation: "precipitation-drop-test",
    sourceDefinitionId: "beral-pipette",
    sourceInstanceId: "beral-pipette-1",
    vesselInstanceId: "beaker-250ml-1",
    vesselDefinitionId: "beaker-250ml",
    note: "{{config.completenessObservation}}",
    tag: "precipitation-complete-test",
  }, {
    atomId: "atom.observe.complete-precipitation-test",
    evidence: ["observe", "notebook"],
    interaction: { type: "recordNotebook", valueParameter: "note" },
    roles: { "transfer-pipette": "beral-pipette", "precipitation-vessel": "beaker-250ml" },
    success: "Observation recorded.",
  }),
];

const nodes = [
  node("place-stirring-rod", "Stand the rod in the beaker", "Stand the glass stirring rod in the beaker of hard-water sample, ready to stir."),
  node("add-reagent-portion-1", "Add the first portion (1 of 3)",
    "Pour a third of the {{config.reagentVolumeMl}} mL of sodium carbonate solution into the beaker while you stir with the rod."),
  node("observe-precipitate", "Record what you see", "Look at the mixture and record what forms.", { action: "observe-precipitate" }, "observation"),
  node("add-reagent-portion-2", "Add the second portion (2 of 3)", "Pour the next third in while you stir."),
  node("add-reagent-portion-3", "Add the last portion (3 of 3)", "Pour in the last third while you stir. Keep what is left in the working beaker for the test at the end."),
  node("stir-two-minutes", "Keep stirring", "Keep stirring the mixture for another couple of minutes.", { notebookTag: "stirred-two-more-minutes" }),
  node("rinse-stirring-rod", "Rinse the rod", "Lift the rod a little and rinse it down into the beaker with a squirt from the wash bottle, so the solid on it stays in the beaker.",
    { notebookTag: "stirring-rod-rinsed" }),
  node("remove-stirring-rod", "Lift the rod out", "Lift the rinsed rod out and lay it on the bench."),
  node("settle-precipitate", "Let it settle", "Leave the beaker still until the white solid has settled and the liquid above it is clear.",
    { notebookTag: "precipitate-settled" }),
  node("fill-dropping-pipette", "Fill a dropping pipette", "Draw a little of the sodium carbonate solution into the dropping pipette."),
  node("drop-test", "Test that it is complete",
    "Add one drop of the solution to the clear liquid above the solid and look closely. No new cloudiness means all the calcium has precipitated.",
    { notebookTag: "precipitation-complete-test" }),
];

export default technique({
  id: "hard-water-precipitation-practice",
  title: "Hard-Water Calcium Carbonate Precipitation",
  learningGoal: "Precipitate the calcium in a hard-water sample completely: add the carbonate in portions while stirring, then test that no more precipitate forms.",
  equipment,
  actions,
  nodes,
  slots: [
    { id: "sampleVolumeMl", valueType: "number", required: true, defaultValue: 20 },
    { id: "reagentStockVolumeMl", valueType: "number", required: true, defaultValue: 50 },
    { id: "reagentVolumeMl", valueType: "number", required: true },
    { id: "precipitateMassG", valueType: "number", required: true },
    { id: "precipitateObservation", valueType: "string", required: true },
    { id: "completenessObservation", valueType: "string", required: true },
  ],
  evidenceOutputs: [
    { id: "precipitate-observation", kind: "notebook", actionId: "observe-precipitate", referenceId: "precipitate-observation" },
    { id: "precipitation-complete-test", kind: "notebook", actionId: "drop-test", referenceId: "precipitation-complete-test" },
  ],
  successActionId: "add-reagent-portion-3",
  tags: ["hard-water", "precipitation"],
  legacyActionEffects: [evidenceEffect("observe-precipitate")],
});
