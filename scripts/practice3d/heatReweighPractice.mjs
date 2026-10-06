import { action, evidenceEffect, item, node, technique } from "./common.mjs";

/**
 * Heat and Reweigh a Carbonate Mixture, 3D practice version (PACK2_ATOMIZATION.md, "Heat and Reweigh";
 * decisions 9 and 10, the renamed warming step, and the heat-safe pad as the cooling surface).
 *
 * The student weighs the empty crucible and lid, tips the working portion of the mixture in and weighs it
 * again; builds the support (ring stand, clay triangle, burner beneath); seats the crucible, sets the lid
 * askew, lights the burner and opens its air collar to a blue flame; warms gently, then heats; turns the
 * burner off, moves the crucible with tongs to the heat-safe pad to cool, and weighs it. A second heating
 * (relit, flame set) checks for constant mass. The product goes to its labelled beaker, and the mass loss
 * gives the mixture's composition. The plan approval, the master stock and the replicate bookkeeping stay
 * with the lab (the original technique); this practice runs one replicate from a prepared portion.
 */
const SEAT = "ring-stand-crucible-seat";
const BAY = "ring-stand-burner-bay";
const mixture = {
  kind: "solid",
  label: "NaHCO3 / Na2CO3 mixture",
  massG: "{{config.sampleMassG}}",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "powder",
};
const at = (instance, x, y) => ({ ...instance, x, y });

const equipment = [
  at(item("analytical-balance-1", "analytical-balance", "Analytical balance", undefined, "workbench"), 495, 198),
  at(item("heat-safe-pad-1", "heat-safe-pad", "Heat-safe pad", undefined, "workbench"), 212, 300),
  item("crucible-with-lid-1", "crucible-with-lid", "Crucible with lid"),
  item("working-sample-portion-1", "small-vial", "Mixture portion", mixture),
  item("ring-stand-1", "ring-stand", "Ring stand"),
  item("clay-triangle-1", "clay-triangle", "Clay triangle"),
  item("bunsen-burner-1", "bunsen-burner", "Bunsen burner"),
  item("crucible-tongs-1", "crucible-tongs", "Crucible tongs"),
  item("heated-product-recovery-1", "beaker-250ml", "Product Made from Heating Samples"),
];

const BURNER = { burnerInstanceId: "bunsen-burner-1", burnerDefinitionId: "bunsen-burner" };
const CRUCIBLE = { crucibleInstanceId: "crucible-with-lid-1", crucibleDefinitionId: "crucible-with-lid" };
const crucibleTo = (id, label, target, zoneId, options, extra = {}) => action(id, "place", label, {
  equipmentDefinitionId: "crucible-with-lid",
  equipmentInstanceId: "crucible-with-lid-1",
  targetDefinitionId: target.definitionId,
  targetInstanceId: target.instanceId,
  location: "snapZone",
  snapZoneId: zoneId,
  moveFromHolder: true,
  ...extra,
}, options);
const BALANCE = { definitionId: "analytical-balance", instanceId: "analytical-balance-1" };
const STAND = { definitionId: "ring-stand", instanceId: "ring-stand-1" };
const PAD = { definitionId: "heat-safe-pad", instanceId: "heat-safe-pad-1" };

const bench = (id, operation, atomId, label, parameters, roles, success, verb = "observe") => action(id, verb, label,
  { benchOperation: operation, ...parameters, tag: `${id}-done` },
  { atomId, evidence: [verb, "notebook"], interaction: { type: "recordNotebook", valueParameter: "note" }, roles, success });
const light = (id) => bench(id, "light-burner", "atom.control.light-burner", "Light the burner", { ...BURNER, ...CRUCIBLE },
  { "thermal-heating-instrument": "bunsen-burner", "weighed-vessel": "crucible-with-lid" }, "The burner is lit: a yellow flame.");
const setFlame = (id) => bench(id, "set-flame", "atom.control.set-burner-flame", "Open the air collar to a blue flame", { ...BURNER },
  { "thermal-heating-instrument": "bunsen-burner" }, "The flame is blue, with an inner cone.");
const heat = (id, label, minutes, intensity, extra, success) => bench(id, "heat-crucible", "atom.heat.crucible-over-burner", label,
  { sourceDefinitionId: "crucible-with-lid", targetDefinitionId: "bunsen-burner", ...BURNER, ...CRUCIBLE, burnerBayZoneId: BAY, crucibleSeatZoneId: SEAT, heatMinutes: minutes, heatIntensity: intensity, ...extra },
  { "thermal-heating-instrument": "bunsen-burner", "weighed-vessel": "crucible-with-lid", "thermal-support": "ring-stand" }, success, "heat");
const turnOff = (id) => bench(id, "turn-off-burner", "atom.control.turn-off-burner", "Turn off the burner", { ...BURNER, ...CRUCIBLE },
  { "thermal-heating-instrument": "bunsen-burner" }, "The gas is off.");
const toPad = (id) => crucibleTo(id, "Move the crucible with tongs onto the pad", PAD, "heat-safe-pad-surface", {
  atomId: "atom.place.hot-assembly-onto-pad",
  roles: { "dried-assembly": "crucible-with-lid", "cooling-surface": "heat-safe-pad", "cooling-tool": "crucible-tongs" },
  success: "The hot crucible is on the pad.",
}, { handledWithDefinitionId: "crucible-tongs", requireBurnerOffInstanceId: "bunsen-burner-1" });
const cool = (id) => action(id, "cool", "Let it cool", {
  benchOperation: "cool-on-pad",
  sourceDefinitionId: "crucible-with-lid",
  targetDefinitionId: "heat-safe-pad",
  vesselInstanceId: "crucible-with-lid-1",
  padInstanceId: "heat-safe-pad-1",
  coolMinutes: 10,
  cooledTemperatureC: 25,
  tag: `${id}-done`,
}, {
  atomId: "atom.cool.on-heat-safe-pad",
  interaction: { type: "recordNotebook", valueParameter: "note" },
  roles: { "dried-assembly": "crucible-with-lid", "cooling-surface": "heat-safe-pad" },
  success: "It is cool enough to weigh.",
});
const onBalance = (id, label, extra = {}) => crucibleTo(id, label, BALANCE, "analytical-balance-pan", {
  atomId: "atom.place.weighed-vessel", roles: { "weighed-vessel": "crucible-with-lid" }, success: "The crucible is on the pan.",
}, extra);
const read = (id, label, inputLabel, measurementId, extra = {}) => ({
  ...action(id, "weigh", label, {
    sourceDefinitionId: "crucible-with-lid",
    sourceInstanceId: "crucible-with-lid-1",
    targetDefinitionId: "analytical-balance",
    targetInstanceId: "analytical-balance-1",
    instrumentDefinitionId: "analytical-balance",
    maxSafeTemperatureC: 40,
    inputMode: "numeric",
    inputRole: "studentResponse",
    inputLabel,
    inputMin: 0,
    inputMinExclusive: true,
    inputStep: 0.001,
    inputRequired: true,
    unit: "g",
    ...extra,
  }, { atomId: "atom.weigh.vessel-supported-balance-display", roles: { "balance-instrument": "analytical-balance", "weighed-vessel": "crucible-with-lid" },
    success: "Reading taken." }),
  mass: { source: "action-input", outputMeasurementId: measurementId, continuity: { version: 1, quantityKind: "balance-display", measuredSupportInstanceId: "crucible-with-lid-1" } },
});
const record = (id, label, measurementId, measurementLabel) => action(id, "record", label, {
  measurementId, label: measurementLabel, unit: "g", copyExistingMeasurementOnly: true,
}, { evidence: ["record", "notebook"], success: "Mass recorded.", interaction: { type: "recordNotebook", valueParameter: "measurementId" } });
const onTriangle = (id, label, extra = {}) => crucibleTo(id, label, STAND, SEAT, {
  atomId: "atom.place.thermal-crucible-assembly", roles: { "weighed-vessel": "crucible-with-lid", "thermal-support": "ring-stand" },
  success: "The crucible stands in the clay triangle.",
}, extra);

const actions = [
  onBalance("crucible-on-balance", "Put the crucible and lid on the balance pan", { supportEmptyMassG: "{{config.crucibleMassG}}" }),
  read("read-empty-crucible", "Read the empty crucible and lid mass", "Balance display for the empty crucible and lid (g)", "empty-crucible-mass"),
  record("record-empty-crucible", "Record the empty crucible and lid mass", "empty-crucible-mass", "Empty crucible and lid"),
  action("add-sample", "transfer", "Tip the mixture portion into the crucible", {
    sourceDefinitionId: "small-vial",
    sourceInstanceId: "working-sample-portion-1",
    targetDefinitionId: "crucible-with-lid",
    targetInstanceId: "crucible-with-lid-1",
    massG: "{{config.sampleMassG}}",
    massIsPlanTargetNotMeasurement: true,
    targetLabel: "Crucible containing the carbonate mixture",
    visualState: "powder",
  }, { atomId: "atom.transfer.solid-portion", roles: { "solid-reagent-source": "small-vial", "receiving-vessel": "crucible-with-lid" },
    interaction: { type: "pourInto", sourceDefinitionId: "small-vial", targetDefinitionId: "crucible-with-lid" },
    success: "The mixture is in the crucible." }),
  read("read-loaded-crucible", "Read the loaded crucible and lid mass", "Balance display for the crucible, lid and mixture (g)", "loaded-crucible-mass"),
  record("record-loaded-crucible", "Record the loaded crucible and lid mass", "loaded-crucible-mass", "Crucible, lid and mixture"),
  action("place-ring-stand", "place", "Stand the ring stand on the bench", {
    equipmentDefinitionId: "ring-stand", equipmentInstanceId: "ring-stand-1", location: "workbench",
  }, { atomId: "atom.place.thermal-support", roles: { "thermal-support": "ring-stand" }, success: "The ring stand is on the bench." }),
  action("seat-triangle", "place", "Seat the clay triangle on the ring", {
    equipmentDefinitionId: "clay-triangle",
    equipmentInstanceId: "clay-triangle-1",
    targetDefinitionId: "ring-stand",
    targetInstanceId: "ring-stand-1",
    location: "snapZone",
    snapZoneId: "ring-stand-clay-triangle-seat",
  }, { atomId: "atom.place.thermal-support", roles: { "thermal-support": "clay-triangle" }, success: "The triangle rests on the ring." }),
  action("place-burner", "place", "Stand the burner beneath the ring", {
    equipmentDefinitionId: "bunsen-burner",
    equipmentInstanceId: "bunsen-burner-1",
    targetDefinitionId: "ring-stand",
    targetInstanceId: "ring-stand-1",
    location: "snapZone",
    snapZoneId: BAY,
  }, { atomId: "atom.place.thermal-heating-instrument", roles: { "thermal-heating-instrument": "bunsen-burner" },
    interaction: { type: "snapIntoTarget", sourceDefinitionId: "bunsen-burner", targetDefinitionId: "ring-stand" },
    success: "The burner stands under the ring." }),
  onTriangle("crucible-on-triangle", "Set the crucible in the clay triangle"),
  bench("set-lid-askew", "set-crucible-lid", "atom.observe.set-crucible-lid-askew", "Set the lid askew", { ...CRUCIBLE, crucibleSeatZoneId: SEAT },
    { "weighed-vessel": "crucible-with-lid", "thermal-support": "ring-stand" }, "The lid is askew; the gap is open."),
  light("light-burner-1"),
  setFlame("set-flame-1"),
  heat("warm-gently", "Warm the mixture gently with the lid askew", "{{config.warmMinutes}}", "gentle", {}, "The mixture is warm."),
  heat("heat-mixture", "Heat the mixture", "{{config.heatingMinutes}}", "{{config.heatingIntensity}}", { residueMassG: "{{config.residueMassG}}" },
    "The first heating is done."),
  turnOff("turn-off-1"),
  toPad("first-to-pad"),
  cool("cool-1"),
  onBalance("first-on-balance", "Put the crucible on the balance pan", { refuseHotByHand: true }),
  read("read-first-cycle", "Read the first cooled mass", "Balance display after the first heating (g)", "cooled-cycle-mass"),
  record("record-first-cycle", "Record the first cooled mass", "cooled-cycle-mass", "Crucible, lid and residue after the first heating"),
  onTriangle("crucible-back-on-triangle", "Set the crucible back in the clay triangle"),
  light("light-burner-2"),
  setFlame("set-flame-2"),
  heat("heat-again", "Heat it again", "{{config.heatingMinutes}}", "{{config.heatingIntensity}}", { residueMassG: "{{config.residueMassG}}" },
    "The second heating is done."),
  turnOff("turn-off-2"),
  toPad("second-to-pad"),
  cool("cool-2"),
  onBalance("second-on-balance", "Put the crucible on the balance pan", { refuseHotByHand: true }),
  read("read-final", "Read the second cooled mass", "Balance display after the second heating (g)", "final-cooled-crucible-mass"),
  record("record-final", "Record the constant final mass", "final-cooled-crucible-mass", "Crucible, lid and residue at constant mass"),
  action("recover-product", "transfer", "Tip the product into its labelled beaker", {
    sourceInstanceId: "crucible-with-lid-1",
    sourceDefinitionId: "crucible-with-lid",
    targetInstanceId: "heated-product-recovery-1",
    targetDefinitionId: "beaker-250ml",
    targetLabel: "Product Made from Heating Samples",
    massG: "{{config.residueMassG}}",
    massIsPlanTargetNotMeasurement: true,
  }, { atomId: "atom.transfer.heated-product-to-labeled-recovery", roles: { "weighed-vessel": "crucible-with-lid", "recovery-vessel": "beaker-250ml" },
    interaction: { type: "pourInto", sourceDefinitionId: "crucible-with-lid", targetDefinitionId: "beaker-250ml" },
    success: "The product is in its labelled beaker." }),
  action("calculate-composition", "calculate", "Work out the mixture's composition", {
    calculationId: "composition-analysis",
    template: "carbonateMassLossComposition",
    emptyMassMeasurementId: "empty-crucible-mass",
    initialMassMeasurementId: "loaded-crucible-mass",
    finalMassMeasurementId: "final-cooled-crucible-mass",
    sampleMassG: "{{config.sampleMassG}}",
    tolerance: 0.002,
    reactionEquation: "2 NaHCO3(s) -> Na2CO3(s) + CO2(g) + H2O(g)",
  }, { evidence: ["calculate"], success: "Composition worked out." }),
];

const nodes = [
  node("crucible-on-balance", "Put the crucible on the balance", "Put the clean, dry, cool crucible with its lid on the balance pan."),
  node("read-empty-crucible", "Read its mass", "Read the balance and enter the empty crucible and lid's mass.", { measurementId: "empty-crucible-mass" }),
  node("record-empty-crucible", "Record the mass", "Record the empty crucible and lid's mass in your notebook.", { measurementId: "empty-crucible-mass" }),
  node("add-sample", "Add the mixture", "Tip the mixture portion from its vial into the crucible."),
  node("read-loaded-crucible", "Read the loaded mass", "Read the balance and enter the crucible, lid and mixture's mass.", { measurementId: "loaded-crucible-mass" }),
  node("record-loaded-crucible", "Record the loaded mass", "Record the loaded mass in your notebook.", { measurementId: "loaded-crucible-mass" }),
  node("place-ring-stand", "Stand the ring stand", "Stand the ring stand on the bench."),
  node("seat-triangle", "Seat the clay triangle", "Rest the clay triangle on the iron ring."),
  node("place-burner", "Place the burner", "Stand the Bunsen burner on the base beneath the ring."),
  node("crucible-on-triangle", "Set the crucible on the support", "Take the crucible off the balance and stand it in the clay triangle."),
  node("set-lid-askew", "Set the lid askew", "Set the lid askew, leaving a gap. Never heat a fully covered crucible.", { notebookTag: "set-lid-askew-done" }),
  node("light-burner-1", "Light the burner", "Close the air collar almost fully, turn on the gas, and light it with the striker at the top of the barrel.", { notebookTag: "light-burner-1-done" }),
  node("set-flame-1", "Set the flame", "Open the air collar until the flame is blue, with an inner cone.", { notebookTag: "set-flame-1-done" }),
  node("warm-gently", "Warm the mixture gently with the lid askew", "Warm the crucible gently first.", { notebookTag: "warm-gently-done" }),
  node("heat-mixture", "Heat the mixture", "Heat the crucible for the set time.", { notebookTag: "heat-mixture-done" }),
  node("turn-off-1", "Turn off the burner", "Turn the gas off before you move the crucible.", { notebookTag: "turn-off-1-done" }),
  node("first-to-pad", "Move it with tongs", "Lift the hot crucible with the crucible tongs onto the heat-safe pad."),
  node("cool-1", "Let it cool", "Leave it on the pad until it is cool enough to weigh.", { notebookTag: "cool-1-done" }),
  node("first-on-balance", "Put it on the balance", "Put the cool crucible on the balance pan."),
  node("read-first-cycle", "Read the cooled mass", "Read the balance and enter the mass.", { measurementId: "cooled-cycle-mass" }),
  node("record-first-cycle", "Record the cooled mass", "Record the mass in your notebook.", { measurementId: "cooled-cycle-mass" }),
  node("crucible-back-on-triangle", "Set it back on the support", "Stand the crucible back in the clay triangle, the lid still askew."),
  node("light-burner-2", "Light the burner", "Light the burner again, the air collar almost closed.", { notebookTag: "light-burner-2-done" }),
  node("set-flame-2", "Set the flame", "Open the air collar to a blue flame.", { notebookTag: "set-flame-2-done" }),
  node("heat-again", "Heat it again", "Heat the crucible again for the same time.", { notebookTag: "heat-again-done" }),
  node("turn-off-2", "Turn off the burner", "Turn the gas off.", { notebookTag: "turn-off-2-done" }),
  node("second-to-pad", "Move it with tongs", "Lift the crucible with the tongs onto the heat-safe pad."),
  node("cool-2", "Let it cool", "Leave it on the pad until it is cool enough to weigh.", { notebookTag: "cool-2-done" }),
  node("second-on-balance", "Put it on the balance", "Put the cool crucible on the balance pan."),
  node("read-final", "Read the mass again", "Read the balance and enter the mass. It should match the first cooled mass: constant mass.", { measurementId: "final-cooled-crucible-mass" }),
  node("record-final", "Record the final mass", "Record the constant final mass in your notebook.", { measurementId: "final-cooled-crucible-mass" }),
  node("recover-product", "Recover the product", "Tip the cool product into the beaker labelled \"Product Made from Heating Samples\"."),
  node("calculate-composition", "Work out the composition",
    "From the mass lost, work out the masses of sodium hydrogen carbonate and sodium carbonate in the mixture.", { calculationId: "composition-analysis" }, "calculation"),
];

export default technique({
  id: "thermal-decomposition-mass-loss-practice",
  title: "Heat and Reweigh a Carbonate Mixture",
  learningGoal: "Heat a carbonate mixture in a vented crucible over a Bunsen flame, cool and reweigh it to constant mass, and find its composition from the mass lost.",
  equipment,
  actions,
  nodes,
  slots: [
    { id: "crucibleMassG", valueType: "number", required: true, defaultValue: 25 },
    { id: "sampleMassG", valueType: "number", required: true, defaultValue: 2 },
    { id: "residueMassG", valueType: "number", required: true, defaultValue: 1.557 },
    { id: "warmMinutes", valueType: "number", required: true, defaultValue: 2 },
    { id: "heatingMinutes", valueType: "number", required: true, defaultValue: 10 },
    { id: "heatingIntensity", valueType: "string", required: true, defaultValue: "strong", allowedValues: ["moderate", "strong"] },
  ],
  evidenceOutputs: [
    { id: "empty-crucible-mass", kind: "measurement", actionId: "read-empty-crucible", referenceId: "empty-crucible-mass" },
    { id: "loaded-crucible-mass", kind: "measurement", actionId: "read-loaded-crucible", referenceId: "loaded-crucible-mass" },
    { id: "final-cooled-crucible-mass", kind: "measurement", actionId: "read-final", referenceId: "final-cooled-crucible-mass" },
    { id: "composition-analysis", kind: "calculation", actionId: "calculate-composition", referenceId: "composition-analysis" },
  ],
  successActionId: "read-final",
  tags: ["thermal-decomposition", "constant-mass", "gravimetry"],
  legacyActionEffects: [evidenceEffect("record-empty-crucible"), evidenceEffect("record-loaded-crucible"), evidenceEffect("record-first-cycle"),
    evidenceEffect("record-final"),
    { actionId: "calculate-composition", effect: { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] } }],
});
