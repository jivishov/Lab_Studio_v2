import { action, evidenceEffect, item, node, technique } from "./common.mjs";

/**
 * Dry and Weigh a Precipitate, 3D practice version (PACK2_ATOMIZATION.md, "Dry and Weigh"; decisions 3, 8
 * and 9, and the manual's two timed stages with no constant-mass loop).
 *
 * The bench starts where filtration ends: the washed precipitate on its paper in the funnel, the filtrate
 * in the flask under it. The student notes the paper's mass from filtration, weighs the labelled watch
 * glass (its tare), lifts the paper onto it, pours the filtrate down the sink, sets the oven, and dries the
 * assembly in two timed stages (the door opened and closed, the hot glass moved with tongs onto a heat-safe
 * pad, the solid broken up between them), lets it cool, weighs it, records it, and works out the
 * precipitate's mass by difference, which Calculate Hardness (Pack 3) takes as its one precipitate mass.
 */
const OVEN = { ovenInstanceId: "drying-oven-1", ovenDefinitionId: "drying-oven" };
const ASSEMBLY = { vesselInstanceId: "watch-glass-1", precipitateCarrierInstanceId: "filter-paper-1" };
const washed = {
  kind: "precipitate",
  label: "Calcium carbonate",
  massG: "{{config.precipitateMassG}}",
  solutes: [],
  precipitate: { substance: "Calcium carbonate", massG: "{{config.precipitateMassG}}", rinsed: true, dryness: "wet" },
  contamination: [],
  wetState: "wet",
  visualState: "rinsed-precipitate",
};
const filtrate = { kind: "liquid", label: "Filtrate", volumeMl: 50, solutes: [], contamination: [], wetState: "wet", visualState: "clear-filtrate" };
const at = (instance, x, y) => ({ ...instance, x, y });
const inZone = (instance, zoneId) => ({ ...instance, location: "snapZone", snapZoneId: zoneId });

const equipment = [
  at(item("drying-oven-1", "drying-oven", "Drying oven", undefined, "workbench"), 56, 42),
  at(item("funnel-stand-1", "funnel-stand", "Funnel in the ring stand", undefined, "workbench"), 296, 0),
  inZone(item("filter-paper-1", "filter-paper", "Filter paper", washed), "funnel-stand-paper-seat"),
  inZone(item("erlenmeyer-flask-250ml-1", "erlenmeyer-flask-250ml", "Receiving flask", filtrate), "funnel-receiving-vessel-zone"),
  at(item("analytical-balance-1", "analytical-balance", "Analytical balance", undefined, "workbench"), 495, 198),
  at(item("heat-safe-pad-1", "heat-safe-pad", "Heat-safe pad", undefined, "workbench"), 212, 300),
  at(item("lab-sink-1", "lab-sink", "Sink", undefined, "workbench"), 604, 0),
  item("watch-glass-1", "watch-glass", "Labelled watch glass"),
  item("crucible-tongs-1", "crucible-tongs", "Crucible tongs"),
  item("scoopula-1", "scoopula", "Metal scoop"),
];

const glassOn = (id, zoneId, target, label, options, extra = {}) => action(id, "place", label, {
  equipmentDefinitionId: "watch-glass",
  equipmentInstanceId: "watch-glass-1",
  targetDefinitionId: target.definitionId,
  targetInstanceId: target.instanceId,
  location: "snapZone",
  snapZoneId: zoneId,
  moveFromHolder: true,
  ...extra,
}, options);
const BALANCE = { definitionId: "analytical-balance", instanceId: "analytical-balance-1" };
const OVEN_TARGET = { definitionId: "drying-oven", instanceId: "drying-oven-1" };
const PAD = { definitionId: "heat-safe-pad", instanceId: "heat-safe-pad-1" };

const openDoor = (id) => action(id, "observe", "Open the oven door", { benchOperation: "open-oven-door", ...OVEN, tag: `${id}-done` }, {
  atomId: "atom.observe.open-oven-door", evidence: ["observe", "notebook"],
  interaction: { type: "recordNotebook", valueParameter: "note" }, roles: { "drying-instrument": "drying-oven" }, success: "The door is open." });
// The first stage's time is the teacher's, within the manual's 10-15 minutes; the second is the manual's 5.
const dryStage = (id, minutes, dryness, provenance) => action(id, "dry", "Close the door and dry", {
  benchOperation: "dry-in-oven",
  ...OVEN,
  sampleInstanceId: "watch-glass-1",
  ...ASSEMBLY,
  durationMinutes: minutes,
  ...(provenance ? { durationProvenance: provenance } : {}),
  drynessResult: dryness,
  tag: `${id}-done`,
}, {
  atomId: "atom.dry.close-oven-and-dry",
  interaction: { type: "recordNotebook", valueParameter: "note" },
  roles: { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass" },
  success: dryness === "damp" ? "The first stage is done; the solid is still damp." : "The second stage is done; the solid is dry.",
});
const toPad = (id) => glassOn(id, "heat-safe-pad-surface", PAD, "Lift the watch glass out with tongs onto the pad", {
  atomId: "atom.place.hot-assembly-onto-pad",
  roles: { "dried-assembly": "watch-glass", "cooling-surface": "heat-safe-pad", "cooling-tool": "crucible-tongs", "drying-instrument": "drying-oven" },
  success: "The hot watch glass is on the pad.",
}, { handledWithDefinitionId: "crucible-tongs" });
const intoOven = (id, label, extra) => glassOn(id, "drying-oven-chamber", OVEN_TARGET, label, {
  atomId: "atom.place.drying-assembly-into-oven",
  roles: { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass", ...(extra.handledWithDefinitionId ? { "cooling-tool": "crucible-tongs" } : {}) },
  success: "The watch glass is on the oven's shelf.",
}, extra);

const actions = [
  action("note-paper-mass", "observe", "Note the filter paper's mass", {
    measurementId: "filter-paper-mass",
    inputMode: "numeric",
    inputRole: "teacherConfiguration",
    inputLabel: "Filter paper mass, weighed dry before filtering (g)",
    inputMin: 0,
    inputMinExclusive: true,
    unit: "g",
    configuredValue: "{{config.paperMassG}}",
    configurationQuantity: "filter paper mass",
    configurationProvenance: "teacher-configured",
    tag: "filter-paper-mass-noted",
  }, { atomId: "atom.observe.record-teacher-configured-numeric-value", evidence: ["observe", "notebook"], success: "Paper mass noted." }),
  glassOn("glass-on-balance", "analytical-balance-pan", BALANCE, "Put the watch glass on the balance pan", {
    atomId: "atom.place.weighed-vessel", roles: { "weighed-vessel": "watch-glass" }, success: "The watch glass is on the pan.",
  }, { supportEmptyMassG: "{{config.watchGlassMassG}}" }),
  {
    ...action("weigh-glass", "weigh", "Read the watch glass's mass", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-1",
      targetDefinitionId: "analytical-balance",
      targetInstanceId: "analytical-balance-1",
      instrumentDefinitionId: "analytical-balance",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Balance display for the empty watch glass (g)",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.001,
      inputRequired: true,
      unit: "g",
    }, { atomId: "atom.weigh.tare-vessel", roles: { "balance-instrument": "analytical-balance", "weighed-vessel": "watch-glass" }, success: "Reading taken." }),
    mass: { source: "action-input", outputMeasurementId: "watch-glass-mass" },
  },
  action("record-glass", "record", "Record the watch glass's mass", {
    measurementId: "watch-glass-mass", label: "Watch glass mass", unit: "g", copyExistingMeasurementOnly: true,
  }, { evidence: ["record", "notebook"], success: "Mass recorded.", interaction: { type: "recordNotebook", valueParameter: "measurementId" } }),
  action("paper-onto-glass", "place", "Lift the paper onto the watch glass", {
    equipmentDefinitionId: "filter-paper",
    equipmentInstanceId: "filter-paper-1",
    targetDefinitionId: "watch-glass",
    targetInstanceId: "watch-glass-1",
    location: "snapZone",
    snapZoneId: "watch-glass-paper-seat",
    moveFromHolder: true,
    requireTargetUnseated: true,
    supportEmptyMassG: "{{config.paperMassG}}",
  }, { atomId: "atom.place.transfer-medium-to-drying-vessel", roles: { "filter-medium": "filter-paper", "dried-assembly": "watch-glass" },
    success: "The paper lies open on the watch glass, the solid on it." }),
  action("filtrate-to-sink", "transfer", "Pour the filtrate down the sink", {
    sourceDefinitionId: "erlenmeyer-flask-250ml",
    sourceInstanceId: "erlenmeyer-flask-250ml-1",
    targetDefinitionId: "lab-sink",
    targetInstanceId: "lab-sink-1",
    toDrain: true,
    tag: "filtrate-disposed",
  }, {
    atomId: "atom.transfer.filtrate-to-drain",
    interaction: { type: "pourInto", sourceDefinitionId: "erlenmeyer-flask-250ml", targetDefinitionId: "lab-sink" },
    roles: { "filtration-receiver": "erlenmeyer-flask-250ml", "waste-drain": "lab-sink" },
    success: "The filtrate is down the sink.",
  }),
  action("set-oven", "observe", "Set the oven", {
    benchOperation: "set-oven-temperature",
    ...OVEN,
    inputMode: "numeric",
    inputRole: "studentResponse",
    inputLabel: "Oven setting (°C)",
    inputRequired: true,
    unit: "°C",
    temperatureMinC: 110,
    temperatureMaxC: 120,
    tag: "oven-set",
  }, {
    atomId: "atom.observe.set-drying-oven",
    evidence: ["observe", "notebook"],
    interaction: { type: "recordNotebook", valueParameter: "note" },
    roles: { "drying-instrument": "drying-oven" },
    success: "The oven is set.",
  }),
  openDoor("open-oven-1"),
  intoOven("glass-into-oven", "Put the watch glass in the oven", {}),
  dryStage("dry-first", "{{config.firstDryingMinutes}}", "damp", "Investigation 3 FD-14: dry within 10-15 minutes"),
  openDoor("open-oven-2"),
  toPad("first-to-pad"),
  action("break-up", "observe", "Break up the solid", {
    benchOperation: "break-up-precipitate",
    sourceDefinitionId: "scoopula",
    sourceInstanceId: "scoopula-1",
    ...ASSEMBLY,
    tag: "solid-broken-up",
  }, {
    atomId: "atom.observe.break-up-precipitate",
    evidence: ["observe", "notebook"],
    interaction: { type: "recordNotebook", valueParameter: "note" },
    roles: { "dried-assembly": "watch-glass", "solid-transfer-tool": "scoopula" },
    success: "The solid is in small pieces.",
  }),
  intoOven("glass-back-into-oven", "Put it back in the oven with tongs", { handledWithDefinitionId: "crucible-tongs" }),
  dryStage("dry-second", 5, "dry"),
  openDoor("open-oven-3"),
  toPad("second-to-pad"),
  action("cool", "cool", "Let it cool", {
    benchOperation: "cool-on-pad",
    sourceDefinitionId: "watch-glass",
    targetDefinitionId: "heat-safe-pad",
    ...ASSEMBLY,
    padInstanceId: "heat-safe-pad-1",
    coolMinutes: 10,
    cooledTemperatureC: 25,
    tag: "assembly-cooled",
  }, {
    atomId: "atom.cool.on-heat-safe-pad",
    interaction: { type: "recordNotebook", valueParameter: "note" },
    roles: { "dried-assembly": "watch-glass", "cooling-surface": "heat-safe-pad" },
    success: "It is cool enough to weigh.",
  }),
  glassOn("combined-on-balance", "analytical-balance-pan", BALANCE, "Put the watch glass on the balance pan", {
    atomId: "atom.place.weighed-vessel", roles: { "weighed-vessel": "watch-glass" }, success: "The assembly is on the pan.",
  }, { refuseHotByHand: true }),
  {
    ...action("weigh-combined", "weigh", "Read the combined mass", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-1",
      targetDefinitionId: "analytical-balance",
      targetInstanceId: "analytical-balance-1",
      instrumentDefinitionId: "analytical-balance",
      maxSafeTemperatureC: 40,
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Balance display for the watch glass, paper and dry solid (g)",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.001,
      inputRequired: true,
      unit: "g",
    }, { atomId: "atom.weigh.dry-assembly", roles: { "balance-instrument": "analytical-balance", "dried-assembly": "watch-glass" }, success: "Reading taken." }),
    mass: { source: "action-input", outputMeasurementId: "combined-mass" },
  },
  action("record-combined", "record", "Record the combined mass", {
    measurementId: "combined-mass", label: "Watch glass, paper and dry precipitate", unit: "g", copyExistingMeasurementOnly: true,
  }, { evidence: ["record", "notebook"], success: "Mass recorded.", interaction: { type: "recordNotebook", valueParameter: "measurementId" } }),
  action("precipitate-by-difference", "calculate", "Work out the precipitate's mass", {
    calculationId: "precipitate-mass",
    template: "gravimetricPrecipitateMass",
    combinedMassMeasurementId: "combined-mass",
    watchGlassMassMeasurementId: "watch-glass-mass",
    filterPaperMassMeasurementId: "filter-paper-mass",
    tolerance: 0.001,
  }, { evidence: ["calculate"], success: "Precipitate mass worked out." }),
];

const nodes = [
  node("note-paper-mass", "Note the paper's mass", "Note the dry filter paper's mass, which you weighed before filtering.", { measurementId: "filter-paper-mass" }, "observation"),
  node("glass-on-balance", "Put the watch glass on the balance", "Put the clean, dry, labelled watch glass on the balance pan."),
  node("weigh-glass", "Read its mass", "Read the balance and enter the empty watch glass's mass.", { measurementId: "watch-glass-mass" }),
  node("record-glass", "Record the mass", "Record the watch glass's mass in your notebook.", { measurementId: "watch-glass-mass" }),
  node("paper-onto-glass", "Lift the paper onto the glass", "Take the watch glass off the balance, then lift the paper with its solid out of the funnel and open it flat on the glass."),
  node("filtrate-to-sink", "Pour away the filtrate", "Pour the filtrate from the flask down the sink.", { notebookTag: "filtrate-disposed" }),
  node("set-oven", "Set the oven", "Turn the oven's control to between 110 and 120 °C, and enter the setting.", { notebookTag: "oven-set" }),
  node("open-oven-1", "Open the oven", "Open the oven door.", { notebookTag: "open-oven-1-done" }),
  node("glass-into-oven", "Put it in the oven", "Put the watch glass with the paper and solid on the oven's shelf."),
  node("dry-first", "Dry it", "Close the door and dry the solid for 10 to 15 minutes.", { notebookTag: "dry-first-done" }),
  node("open-oven-2", "Open the oven", "When the time is up, open the oven door.", { notebookTag: "open-oven-2-done" }),
  node("first-to-pad", "Take it out with tongs", "Lift the warm watch glass out with the crucible tongs and set it on the heat-safe pad."),
  node("break-up", "Break up the solid", "Break the solid into small pieces with the metal scoop.", { notebookTag: "solid-broken-up" }),
  node("glass-back-into-oven", "Put it back in the oven", "With the tongs, put the watch glass back on the oven's shelf."),
  node("dry-second", "Dry it again", "Close the door and dry for 5 more minutes.", { notebookTag: "dry-second-done" }),
  node("open-oven-3", "Open the oven", "When the time is up, open the oven door.", { notebookTag: "open-oven-3-done" }),
  node("second-to-pad", "Take it out with tongs", "Lift the watch glass out with the tongs and set it on the heat-safe pad."),
  node("cool", "Let it cool", "Leave it on the pad until it is cool enough to weigh.", { notebookTag: "assembly-cooled" }),
  node("combined-on-balance", "Put it on the balance", "Put the cool watch glass, with the paper and dry solid, on the balance pan."),
  node("weigh-combined", "Read the combined mass", "Read the balance and enter the combined mass.", { measurementId: "combined-mass" }),
  node("record-combined", "Record the combined mass", "Record the combined mass in your notebook.", { measurementId: "combined-mass" }),
  node("precipitate-by-difference", "Work out the precipitate's mass",
    "Subtract the watch glass's mass and the paper's mass from the combined mass.", { calculationId: "precipitate-mass" }, "calculation"),
];

export default technique({
  id: "drying-practice",
  title: "Dry and Weigh a Precipitate",
  learningGoal: "Dry a collected precipitate in two timed oven stages, handling it hot with tongs, and find its mass by difference once it is cool.",
  equipment,
  actions,
  nodes,
  slots: [
    { id: "precipitateMassG", valueType: "number", required: true },
    { id: "paperMassG", valueType: "number", required: true },
    { id: "watchGlassMassG", valueType: "number", required: true, defaultValue: 30 },
    { id: "firstDryingMinutes", valueType: "number", required: true, defaultValue: 12 },
  ],
  evidenceOutputs: [
    { id: "watch-glass-mass", kind: "measurement", actionId: "weigh-glass", referenceId: "watch-glass-mass" },
    { id: "combined-mass", kind: "measurement", actionId: "weigh-combined", referenceId: "combined-mass" },
    { id: "precipitate-mass", kind: "calculation", actionId: "precipitate-by-difference", referenceId: "precipitate-mass" },
  ],
  successActionId: "weigh-combined",
  tags: ["drying", "gravimetry", "hard-water"],
  legacyActionEffects: [evidenceEffect("record-glass"), evidenceEffect("record-combined"),
    { actionId: "precipitate-by-difference", effect: { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] } }],
});
