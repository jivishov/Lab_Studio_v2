import { action, evidenceEffect, item, node, technique } from "./common.mjs";

/**
 * Filter a Precipitate, 3D practice version (PACK2_ATOMIZATION.md, "Filter a Precipitate"; decisions 3,
 * 4 and 5: the dry paper weighed and folded, a guided pour decanting first, gravity filtration).
 *
 * The beaker starts with the settled calcium carbonate mixture (in the labs, from the precipitation).
 * The student stands the ring stand on the bench and seats the funnel in its ring; weighs the dry paper
 * flat on the balance and records it; folds it; opens it into the funnel; wets it; puts the flask under
 * the stem; pours the clear liquid, then the solid, down the stirring rod in portions the funnel can hold;
 * rinses the beaker into the funnel and washes the solid, three squirts each.
 */
const settledMixture = {
  kind: "mixture",
  label: "Calcium carbonate precipitate mixture",
  volumeMl: "{{config.mixtureVolumeMl}}",
  solutes: [{ id: "calcium-carbonate", label: "Calcium carbonate", amount: "{{config.precipitateMassG}}", unit: "g" }],
  precipitate: { substance: "Calcium carbonate", massG: "{{config.precipitateMassG}}", rinsed: false, dryness: "wet" },
  contamination: [],
  wetState: "wet",
  visualState: "settled-precipitate",
};
const water = { kind: "liquid", label: "Deionized water", volumeMl: 500, solutes: [], contamination: [], wetState: "wet", visualState: "clear-liquid" };

const equipment = [
  item("beaker-250ml-1", "beaker-250ml", "Sample beaker", settledMixture, "workbench"),
  item("stirring-rod-1", "stirring-rod", "Stirring rod", undefined, "workbench"),
  item("analytical-balance-1", "analytical-balance", "Analytical balance", undefined, "workbench"),
  item("ring-stand-1", "ring-stand", "Ring stand"),
  item("funnel-1", "funnel", "Glass funnel"),
  item("funnel-stand-1", "funnel-stand", "Funnel in the ring stand", undefined, "storage"),
  item("filter-paper-1", "filter-paper", "Filter paper"),
  item("erlenmeyer-flask-250ml-1", "erlenmeyer-flask-250ml", "Receiving flask"),
  item("wash-bottle-1", "wash-bottle", "Wash bottle", water),
];

const actions = [
  action("place-ring-stand", "place", "Stand the ring stand on the bench", {
    equipmentDefinitionId: "ring-stand",
    equipmentInstanceId: "ring-stand-1",
    location: "workbench",
  }, { atomId: "atom.place.filtration-support", roles: { "filtration-support": "ring-stand" }, success: "The ring stand is on the bench." }),
  action("seat-funnel", "place", "Seat the funnel in the ring", {
    equipmentDefinitionId: "funnel",
    equipmentInstanceId: "funnel-1",
    targetDefinitionId: "ring-stand",
    targetInstanceId: "ring-stand-1",
    location: "snapZone",
    snapZoneId: "ring-stand-funnel-seat",
    compositeDefinitionId: "funnel-stand",
  }, { atomId: "atom.place.filtration-funnel", roles: { "filtration-funnel": "funnel", "filtration-support": "ring-stand" },
    success: "The funnel rests in the ring." }),
  action("place-paper-on-balance", "place", "Lay the dry paper on the balance pan", {
    equipmentDefinitionId: "filter-paper",
    equipmentInstanceId: "filter-paper-1",
    targetDefinitionId: "analytical-balance",
    targetInstanceId: "analytical-balance-1",
    location: "snapZone",
    snapZoneId: "analytical-balance-pan",
    supportEmptyMassG: "{{config.paperMassG}}",
  }, { atomId: "atom.place.filter-medium-on-balance", roles: { "filter-medium": "filter-paper", "balance-instrument": "analytical-balance" },
    success: "The paper lies flat on the pan." }),
  {
    ...action("weigh-paper", "weigh", "Read the paper's mass", {
      sourceDefinitionId: "filter-paper",
      sourceInstanceId: "filter-paper-1",
      targetDefinitionId: "analytical-balance",
      targetInstanceId: "analytical-balance-1",
      instrumentDefinitionId: "analytical-balance",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Balance display for the dry filter paper (g)",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.001,
      inputRequired: true,
      unit: "g",
    }, { atomId: "atom.weigh.filter-medium-tare", roles: { "balance-instrument": "analytical-balance", "filter-medium": "filter-paper" },
      success: "Reading taken." }),
    mass: { source: "action-input", outputMeasurementId: "filter-paper-mass" },
  },
  action("record-paper-mass", "record", "Record the paper's mass", {
    measurementId: "filter-paper-mass",
    label: "Filter paper mass",
    unit: "g",
    copyExistingMeasurementOnly: true,
  }, { evidence: ["record", "notebook"], success: "Mass recorded.", interaction: { type: "recordNotebook", valueParameter: "measurementId" } }),
  action("fold-paper", "observe", "Fold the paper", {
    benchOperation: "fold-filter-paper",
    sourceDefinitionId: "filter-paper",
    sourceInstanceId: "filter-paper-1",
    tag: "filter-paper-folded",
  }, {
    atomId: "atom.observe.fold-filter-paper",
    evidence: ["observe", "notebook"],
    interaction: { type: "recordNotebook", valueParameter: "note" },
    roles: { "filter-medium": "filter-paper" },
    success: "The paper is folded in quarters.",
  }),
  action("seat-paper", "place", "Open the paper into the funnel", {
    equipmentDefinitionId: "filter-paper",
    equipmentInstanceId: "filter-paper-1",
    targetDefinitionId: "funnel-stand",
    targetInstanceId: "funnel-stand-1",
    location: "snapZone",
    snapZoneId: "funnel-stand-paper-seat",
    requiredForm: "folded",
    requiredFormRecovery: "Fold the paper in half and in half again first, then open it into a cone in the funnel.",
  }, { atomId: "atom.place.filter-medium", roles: { "filtration-funnel": "funnel-stand", "filter-medium": "filter-paper" },
    success: "The paper cone sits in the funnel." }),
  action("wet-paper", "rinse", "Wet the paper", {
    sourceDefinitionId: "wash-bottle",
    sourceInstanceId: "wash-bottle-1",
    targetDefinitionId: "filter-paper",
    targetInstanceId: "filter-paper-1",
    rinseType: "pre-wet",
  }, { atomId: "atom.rinse.wet-filter-medium", roles: { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" },
    interaction: { type: "rinseTarget", sourceDefinitionId: "wash-bottle", targetDefinitionId: "filter-paper" },
    success: "The wet paper seals against the glass." }),
  action("place-flask", "place", "Put the flask under the funnel", {
    equipmentDefinitionId: "erlenmeyer-flask-250ml",
    equipmentInstanceId: "erlenmeyer-flask-250ml-1",
    targetDefinitionId: "funnel-stand",
    targetInstanceId: "funnel-stand-1",
    location: "snapZone",
    snapZoneId: "funnel-receiving-vessel-zone",
  }, { atomId: "atom.place.filtration-receiver", roles: { "filtration-receiver": "erlenmeyer-flask-250ml" },
    success: "The stem touches the inside of the flask's neck." }),
  action("pour-through-filter", "filter", "Pour the mixture through the filter", {
    sourceDefinitionId: "beaker-250ml",
    sourceInstanceId: "beaker-250ml-1",
    targetDefinitionId: "funnel-stand",
    targetInstanceId: "funnel-stand-1",
    receiverInstanceId: "erlenmeyer-flask-250ml-1",
    filtrationMode: "gravity",
    pourPortionMl: 8,
    residueFraction: 0.05,
    tag: "mixture-filtered",
  }, {
    atomId: "atom.filter.pour-through-medium",
    interaction: { type: "pourInto", sourceDefinitionId: "beaker-250ml", targetDefinitionId: "funnel-stand" },
    roles: { "mixture-source": "beaker-250ml", "filtration-funnel": "funnel-stand", "filtration-receiver": "erlenmeyer-flask-250ml", "stirring-device": "stirring-rod" },
    success: "All the solid is on the paper.",
  }),
  action("rinse-beaker-into-funnel", "rinse", "Rinse the beaker into the funnel", {
    sourceDefinitionId: "wash-bottle",
    sourceInstanceId: "wash-bottle-1",
    targetDefinitionId: "beaker-250ml",
    targetInstanceId: "beaker-250ml-1",
    washingsReceiverInstanceId: "funnel-stand-1",
    washingsReceiverDefinitionId: "funnel-stand",
    rinseType: "quantitative-transfer",
    rinsePortions: 3,
    tag: "beaker-rinsed-into-funnel",
  }, {
    atomId: "atom.rinse.quantitative-transfer",
    interaction: { type: "rinseTarget", sourceDefinitionId: "wash-bottle", targetDefinitionId: "beaker-250ml" },
    roles: { "rinse-water-source": "wash-bottle", "rinsed-vessel": "beaker-250ml", "receiving-vessel": "funnel-stand" },
    success: "The last of the solid is in the funnel.",
  }),
  action("wash-precipitate", "rinse", "Wash the solid on the paper", {
    sourceDefinitionId: "wash-bottle",
    sourceInstanceId: "wash-bottle-1",
    targetDefinitionId: "funnel-stand",
    targetInstanceId: "funnel-stand-1",
    washingsReceiverInstanceId: "erlenmeyer-flask-250ml-1",
    washingsReceiverDefinitionId: "erlenmeyer-flask-250ml",
    rinseType: "precipitate",
    rinsePortions: 3,
    tag: "precipitate-washed",
  }, {
    atomId: "atom.rinse.wash-precipitate",
    interaction: { type: "rinseTarget", sourceDefinitionId: "wash-bottle", targetDefinitionId: "funnel-stand" },
    roles: { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" },
    success: "The solid is washed.",
  }),
];

const nodes = [
  node("place-ring-stand", "Set up the stand", "Stand the ring stand on the bench, its iron ring over the base."),
  node("seat-funnel", "Seat the funnel", "Rest the glass funnel in the iron ring."),
  node("place-paper-on-balance", "Put the paper on the balance", "Lay a dry filter paper flat on the balance pan."),
  node("weigh-paper", "Read the paper's mass", "Read the balance and enter the dry paper's mass.", { measurementId: "filter-paper-mass" }),
  node("record-paper-mass", "Record the mass", "Record the dry filter paper's mass in your notebook.", { measurementId: "filter-paper-mass" }),
  node("fold-paper", "Fold the paper", "Lift the paper off the pan onto the bench, then fold it in half and in half again.",
    { notebookTag: "filter-paper-folded" }),
  node("seat-paper", "Open it into the funnel", "Open the folded paper into a cone, three layers on one side, and seat it in the funnel."),
  node("wet-paper", "Wet the paper", "Wet the paper with a little water from the wash bottle so it seals against the glass."),
  node("place-flask", "Put the flask under the stem", "Stand the flask under the funnel, the stem touching the inside of its neck."),
  node("pour-through-filter", "Pour the mixture through",
    "Hold the stirring rod to the beaker's lip and pour down it: the clear liquid first, then the solid, a little at a time so the liquid stays about 1 cm below the paper's rim. Let the funnel drain between pours.",
    { notebookTag: "mixture-filtered" }),
  node("rinse-beaker-into-funnel", "Rinse the beaker", "Rinse the beaker into the funnel with three small squirts, bringing the last of the solid across.",
    { notebookTag: "beaker-rinsed-into-funnel" }),
  node("wash-precipitate", "Wash the solid", "Wash the solid on the paper with three small squirts of water.", { notebookTag: "precipitate-washed" }),
];

export default technique({
  id: "filtration-practice",
  title: "Filter a Precipitate",
  learningGoal: "Collect a precipitate by gravity filtration: weigh and fold the paper, pour without overflowing, and rinse every grain onto the paper.",
  equipment,
  actions,
  nodes,
  slots: [
    { id: "mixtureVolumeMl", valueType: "number", required: true, defaultValue: 30 },
    { id: "precipitateMassG", valueType: "number", required: true },
    { id: "paperMassG", valueType: "number", required: true },
  ],
  evidenceOutputs: [
    { id: "filter-paper-reading", kind: "measurement", actionId: "weigh-paper", referenceId: "filter-paper-mass" },
    { id: "filter-paper-mass", kind: "notebook", actionId: "record-paper-mass", referenceId: "filter-paper-mass" },
    { id: "mixture-filtered", kind: "notebook", actionId: "pour-through-filter", referenceId: "mixture-filtered" },
  ],
  successActionId: "pour-through-filter",
  tags: ["filtration", "gravimetry"],
  legacyActionEffects: [evidenceEffect("record-paper-mass")],
});
