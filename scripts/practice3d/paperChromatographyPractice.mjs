import { action, emptyContents, evidenceEffect, item, node, technique, twinOf } from "./common.mjs";

/**
 * Paper Chromatography, 3D practice version (Pack 3, decided 2026-10-10; `proposals/PACK3_ATOMIZATION.md`, "Paper
 * Chromatography"; decisions 3, 8, 10 and 12). One sequence, two trials: the practice version plays water, and the
 * module also writes the twins `paper-chromatography-water-3d` and `paper-chromatography-propanol-3d` for the lab, the
 * second from an unlisted 2-propanol practice object. The trials differ in structure, not values: water shows two
 * bands and goes to the sink-waste beaker; 2-propanol shows three and goes to the organic-waste beaker (S-03, S-04).
 *
 * Decided while building (Pack 3a step 4, 2026-10-11):
 * - the chamber is placed, then labelled: the pencil reaches it only on the bench;
 * - lifting the lid with the strip and unhooking the strip are two steps (the runtime opens the chamber, then
 *   removes the strip): 31 steps for water, 33 for 2-propanol;
 * - 4 mL of solvent, about 5 mm up the strip in the 27 mm chamber; the depth the runtime checks is worked out
 *   from the volume by the 3D setup (`prepared3d.ts`), never set apart from it;
 * - each solvent goes into its own waste beaker through `atom.transfer.route-solvent-waste`, as in the 2D lab:
 *   "Sink waste" for water, "Organic waste" for 2-propanol; no shared role changes (you, 2026-10-11);
 * - the step clock's minutes: 1 to dry a spot, 10 to develop, 5 to dry the strip.
 *
 * The strip shows the prepared distances (front and band centres, from the baseline); the student reads each on
 * the ruler and enters it, judged within half a millimetre (`requireStudentValue`). Rf keeps the legacy template,
 * worked from the recorded readings (`requireRecordedMeasurements`) and checked against the prepared Rf.
 */
const liquid = (label, volumeMl) => ({ ...emptyContents(), kind: "liquid", label, volumeMl, wetState: "wet", visualState: "clear-liquid" });
const dye = {
  ...emptyContents(),
  kind: "mixture",
  label: "Food dye mixture",
  volumeMl: 5,
  solutes: [{ id: "teacher-food-dye-mixture", label: "Teacher-provided food dye mixture", amount: 1, unit: "mg" }],
  wetState: "wet",
  visualState: "blue-dye-solution",
};
const freshStrip = { ...emptyContents(), visualState: "paper-unspotted" };

const SOLVENTS = {
  water: {
    prefix: "water",
    name: "distilled water",
    tapeLabel: "Water",
    bottle: { id: "water-bottle-1", definitionId: "distilled-water-bottle", label: "Distilled water", volumeMl: 250 },
    modelId: "water-food-dyes-paper",
    bands: [
      { id: "purple-overlap", label: "Purple unresolved overlap", color: "#7e22ce", distanceMm: 59, read: "the centre of the purple region" },
      { id: "yellow", label: "Yellow", color: "#facc15", distanceMm: 66, read: "the centre of the yellow band" },
    ],
    waste: { id: "sink-waste-1", label: "Sink waste", stream: "sink", rule: "water and food dye go to the sink stream" },
  },
  propanol: {
    prefix: "propanol",
    name: "2-propanol",
    tapeLabel: "2-Propanol",
    bottle: { id: "propanol-bottle-1", definitionId: "propanol-bottle", label: "2-Propanol", volumeMl: 200 },
    modelId: "propanol-food-dyes-paper",
    bands: [
      { id: "blue", label: "Blue", color: "#2563eb", distanceMm: 28, read: "the centre of the blue band" },
      { id: "red", label: "Red", color: "#dc2626", distanceMm: 49, read: "the centre of the red band" },
      { id: "yellow", label: "Yellow", color: "#facc15", distanceMm: 68, read: "the centre of the yellow band" },
    ],
    waste: { id: "organic-waste-1", label: "Organic waste", stream: "organic", rule: "never down the sink" },
  },
};

const FRONT_MM = 80;
const rf = (distanceMm) => Number((distanceMm / FRONT_MM).toFixed(4));
const PAPER = { "stationary-phase": "chromatography-paper" };
const CHAMBER = { "developing-chamber": "chromatography-chamber" };

/** One trial's practice object: its bench, its 31 (water) or 33 (2-propanol) steps, its slots and evidence. */
const trial = (solvent, id, title, learningGoal) => {
  const s = SOLVENTS[solvent];
  const { prefix } = s;
  const paper = { sourceDefinitionId: "chromatography-paper", sourceInstanceId: "paper-1" };
  const chamber = { targetDefinitionId: "chromatography-chamber", targetInstanceId: "chamber-1" };
  const frontId = `${prefix}-solvent-front`;
  const bandMeasurement = (band) => `${prefix}-band-${band.id}`;

  const equipment = [
    item("chamber-1", "chromatography-chamber", "Chromatography chamber", { ...emptyContents(), developingChamberClosed: false }),
    item("graduated-cylinder-1", "graduated-cylinder", "100 mL graduated cylinder"),
    item("paper-1", "chromatography-paper", "Fresh chromatography strip", freshStrip),
    item("pencil-1", "pencil", "Pencil"),
    item("capillary-1", "capillary-spotter", "Capillary tube"),
    item("dye-vial-1", "small-vial", "Food dye mixture", dye),
    item(s.bottle.id, s.bottle.definitionId, s.bottle.label, liquid(s.bottle.label, s.bottle.volumeMl)),
    item("ruler-1", "metric-ruler", "Metric ruler"),
    item(s.waste.id, "waste-beaker", s.waste.label, undefined, "workbench"),
  ];

  const spot = (n) => action(`spot-${n}`, "spotSample", `Spot ${n} of 3`, {
    sourceDefinitionId: "capillary-spotter",
    sourceInstanceId: "capillary-1",
    targetDefinitionId: "chromatography-paper",
    targetInstanceId: "paper-1",
    chromatographyModelId: s.modelId,
    sampleProvenance: "teacher-provided food dye mixture",
    originDistanceMm: "{{config.baselineHeightMm}}",
    spotVolumeMl: "{{config.spotVolumeMl}}",
    requiresDrying: true,
    requiresBaselineMarked: true,
    spottedLabel: `Food dye spot on the ${s.name} strip's baseline`,
  }, {
    atomId: "atom.spotSample.apply-baseline-spot",
    interaction: { type: "spotOnto", sourceDefinitionId: "capillary-spotter", targetDefinitionId: "chromatography-paper" },
    roles: { "spotting-tool": "capillary-spotter", ...PAPER, "sample-source": "small-vial" },
    success: n < 3 ? `Spot ${n} is on the baseline.` : "The third touch is on the same spot.",
  });
  const drySpot = (n) => action(`dry-spot-${n}`, "observe", `Let spot ${n} dry`, {
    ...paper,
    chromatographyOperation: "drySpot",
    tag: `${prefix}-spot-${n}-dry`,
    dryMinutes: "{{config.spotDryMinutes}}",
    dryingIntervalProvenance: "teacher-configured",
  }, { atomId: "atom.observe.dry-chromatography-spot", interaction: { type: "recordNotebook" }, roles: PAPER, success: `Spot ${n} is dry.` });

  const read = (actionId, measurementId, label, inputLabel, extra) => action(actionId, "observe", label, {
    ...paper,
    targetDefinitionId: "metric-ruler",
    targetInstanceId: "ruler-1",
    measurementId,
    label,
    unit: "mm",
    ...extra,
    rulerPrecisionMm: 1,
    measurementToleranceMm: 0.5,
    inputMode: "numeric",
    inputRole: "studentResponse",
    inputLabel,
    inputMin: 0,
    inputStep: 1,
    inputRequired: true,
    requireStudentValue: true,
    evidenceProvenance: "student ruler reading",
  }, {
    atomId: "atom.observe.measure-chromatography-distance",
    interaction: { type: "readInstrument", sourceDefinitionId: "chromatography-paper", targetDefinitionId: "metric-ruler", stationId: "metric-ruler",
      valueParameter: "measurementId" },
    roles: { ...PAPER, "distance-measuring-instrument": "metric-ruler" },
    evidence: ["observe", "measurement", measurementId],
    success: "Reading entered.",
  });
  const record = (actionId, measurementId, label) => action(actionId, "record", label, {
    measurementId,
    label,
    unit: "mm",
    ...paper,
    evidenceProvenance: "student ruler reading",
  }, { evidence: ["record", "measurement", measurementId], success: `${label} recorded.` });

  const actions = [
    action("place-chamber", "place", "Place the chamber", {
      equipmentDefinitionId: "chromatography-chamber",
      equipmentInstanceId: "chamber-1",
      location: "workbench",
    }, { atomId: "atom.place.developing-chamber", roles: CHAMBER, success: "The empty chamber stands on the bench." }),
    action("label-chamber", "observe", "Label the chamber", {
      ...chamber,
      tag: `${prefix}-chamber-labelled`,
      note: `Written on the chamber's tape in pencil: ${s.tapeLabel}.`,
      tapeLabel: s.tapeLabel,
      markingToolDefinitionId: "pencil",
    }, { atomId: "atom.observe.label-developing-chamber", interaction: { type: "recordNotebook" }, roles: CHAMBER,
      success: `The tape reads "${s.tapeLabel}".` }),
    action("measure-solvent", "measureVolume", "Measure the solvent", {
      sourceDefinitionId: s.bottle.definitionId,
      sourceInstanceId: s.bottle.id,
      targetDefinitionId: "graduated-cylinder",
      targetInstanceId: "graduated-cylinder-1",
      measurementId: `${prefix}-solvent-volume`,
      volumeMl: "{{config.solventVolumeMl}}",
      tolerance: 0.5,
    }, {
      atomId: "atom.measure.variable-volume",
      interaction: { type: "pourInto", sourceDefinitionId: s.bottle.definitionId, targetDefinitionId: "graduated-cylinder", valueParameter: "volumeMl" },
      roles: { "variable-volume-measuring-device": "graduated-cylinder", "liquid-source": s.bottle.definitionId },
      success: `The cylinder holds the ${s.name}.`,
    }),
    action("charge-chamber", "transfer", "Pour the solvent into the chamber", {
      sourceDefinitionId: "graduated-cylinder",
      sourceInstanceId: "graduated-cylinder-1",
      ...chamber,
      volumeMl: "{{config.solventVolumeMl}}",
      solventDepthMm: "{{config.solventDepthMm}}",
      solventIdentity: s.name,
      depthProvenance: "teacher-configured",
      drainMeasuringVessel: true,
    }, {
      atomId: "atom.transfer.charge-developing-chamber",
      interaction: { type: "pourInto", sourceDefinitionId: "graduated-cylinder", targetDefinitionId: "chromatography-chamber", valueParameter: "volumeMl" },
      // The bottle is the solvent's source and the cylinder measured it: the atom asks for both.
      roles: { "liquid-source": s.bottle.definitionId, "measured-solvent-source": "graduated-cylinder", ...CHAMBER },
      success: "A shallow layer of solvent covers the chamber's floor.",
    }),
    action("place-paper", "place", "Lay the strip flat", {
      equipmentDefinitionId: "chromatography-paper",
      equipmentInstanceId: "paper-1",
      location: "workbench",
    }, { atomId: "atom.place.stationary-phase", roles: PAPER, success: "The fresh strip lies flat." }),
    action("draw-baseline", "observe", "Draw the baseline", {
      ...paper,
      chromatographyOperation: "markBaseline",
      chromatographyModelId: s.modelId,
      baselineHeightMm: "{{config.baselineHeightMm}}",
      markingToolDefinitionId: "pencil",
      baselineProvenance: "teacher-configured",
      tag: `${prefix}-baseline`,
    }, { atomId: "atom.observe.mark-chromatography-baseline", interaction: { type: "recordNotebook" }, roles: PAPER,
      success: "A thin pencil line crosses the strip." }),
    action("load-capillary", "transfer", "Fill the capillary", {
      sourceDefinitionId: "small-vial",
      sourceInstanceId: "dye-vial-1",
      targetDefinitionId: "capillary-spotter",
      targetInstanceId: "capillary-1",
      volumeMl: "{{config.spotterLoadVolumeMl}}",
      sampleProvenance: "teacher-provided food dye mixture",
      toolProvenance: "inferred spotting tool, not listed in the source materials",
    }, {
      atomId: "atom.transfer.load-spotting-tool",
      interaction: { type: "pourInto", sourceDefinitionId: "small-vial", targetDefinitionId: "capillary-spotter", valueParameter: "volumeMl" },
      roles: { "sample-source": "small-vial", "spotting-tool": "capillary-spotter" },
      success: "Dye rises into the capillary.",
    }),
    spot(1), drySpot(1), spot(2), drySpot(2), spot(3), drySpot(3),
    action("hang-strip", "place", "Hang the strip from the lid's hook", {
      equipmentDefinitionId: "chromatography-paper",
      equipmentInstanceId: "paper-1",
      ...paper,
      ...chamber,
      snapZoneId: "chromatography-chamber-paper-slot",
      baselineHeightMm: "{{config.baselineHeightMm}}",
      solventDepthMm: "{{config.solventDepthMm}}",
    }, {
      atomId: "atom.place.insert-strip-into-chamber",
      interaction: { type: "snapIntoTarget", sourceDefinitionId: "chromatography-paper", targetDefinitionId: "chromatography-chamber",
        snapZoneId: "chromatography-chamber-paper-slot" },
      roles: { ...PAPER, ...CHAMBER },
      success: "The strip hangs from the hook under the lid.",
    }),
    action("close-chamber", "observe", "Lower the strip and seat the lid", {
      ...chamber,
      chamberOperation: "closeChamber",
      tag: `${prefix}-chamber-closed`,
    }, { atomId: "atom.observe.close-developing-chamber", interaction: { type: "recordNotebook" }, roles: CHAMBER,
      success: "The lid is on; the strip's foot is in the solvent and the spot above it." }),
    action("develop", "developChromatogram", "Let the solvent rise", {
      ...paper,
      ...chamber,
      snapZoneId: "chromatography-chamber-paper-slot",
      chromatographyModelId: s.modelId,
      measurementPrefix: prefix,
      baselineHeightMm: "{{config.baselineHeightMm}}",
      solventDepthMm: "{{config.solventDepthMm}}",
      stopCondition: `front-mm:${FRONT_MM}`,
      chamberSealed: true,
      originAboveSolvent: true,
      requireDrySpot: true,
      recordMeasurementsOnDevelop: false,
      trackWetState: true,
      developMinutes: "{{config.developMinutes}}",
      developedLabel: `Developed ${s.name} chromatogram`,
      stopConditionProvenance: "teacher-configured",
    }, { atomId: "atom.developChromatogram.develop-strip", interaction: { type: "recordNotebook" }, roles: { ...PAPER, ...CHAMBER },
      success: "The solvent front has reached the stop distance." }),
    action("open-chamber", "observe", "Lift the lid with the strip", {
      ...chamber,
      chamberOperation: "openChamber",
      tag: `${prefix}-chamber-opened`,
    }, { atomId: "atom.observe.open-developing-chamber", interaction: { type: "recordNotebook" }, roles: CHAMBER,
      success: "The lid is up, the wet strip hanging from it." }),
    action("remove-strip", "place", "Unhook the strip and lay it flat", {
      equipmentDefinitionId: "chromatography-paper",
      equipmentInstanceId: "paper-1",
      location: "workbench",
    }, { atomId: "atom.place.remove-developed-strip", roles: PAPER, success: "The wet strip lies flat." }),
    action("mark-front", "observe", "Mark the solvent front", {
      ...paper,
      chromatographyOperation: "markSolventFront",
      markingToolDefinitionId: "pencil",
      tag: `${prefix}-front-marked`,
    }, { atomId: "atom.observe.mark-chromatography-solvent-front", interaction: { type: "recordNotebook" }, roles: PAPER,
      success: "A pencil line marks the front." }),
    action("dry-strip", "observe", "Let the strip dry", {
      ...paper,
      chromatographyOperation: "dryDevelopedPaper",
      tag: `${prefix}-strip-dry`,
      dryMinutes: "{{config.stripDryMinutes}}",
    }, { atomId: "atom.observe.dry-developed-chromatography-paper", interaction: { type: "recordNotebook" }, roles: PAPER,
      success: "The strip is dry." }),
    action("identify-bands", "observe", "Identify the bands", {
      ...paper,
      tag: `${prefix}-bands-identified`,
      overlapPolicy: "record an unresolved overlap as one region; never split it into assumed components",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Each band's colour, from the baseline up; note any overlap",
      inputRequired: true,
    }, { evidence: ["observe", "notebook", `${prefix}-bands-identified`], success: "Bands recorded." }),
    action("place-ruler", "place", "Lay the ruler along the strip", {
      equipmentDefinitionId: "metric-ruler",
      equipmentInstanceId: "ruler-1",
      location: "workbench",
      rulerPrecisionMm: 1,
      alignWithInstanceId: "paper-1",
    }, { atomId: "atom.place.measuring-ruler", roles: { "distance-measuring-instrument": "metric-ruler" },
      success: "The ruler lies along the strip, its zero on the baseline." }),
    read("read-front", frontId, "Solvent front distance", "Solvent front, from the baseline (mm)",
      { chromatographyMeasurementType: "solventFront", measurementPoint: "the pencil solvent-front mark" }),
    record("record-front", frontId, "Solvent front distance"),
    ...s.bands.flatMap((band) => [
      read(`read-${band.id}`, bandMeasurement(band), `${band.label} distance`, `${band.label}, centre from the baseline (mm)`,
        { chromatographyMeasurementType: "band", chromatographyBandId: band.id, measurementPoint: band.read }),
      record(`record-${band.id}`, bandMeasurement(band), `${band.label} distance`),
    ]),
    action("calculate-rf", "calculate", "Calculate each band's Rf", {
      calculationId: `${prefix}-rf`,
      template: "chromatographyRf",
      chromatographyModelId: s.modelId,
      measurementPrefix: prefix,
      solventFrontMeasurementId: frontId,
      bandIds: s.bands.map((band) => band.id),
      bandMeasurementIds: s.bands.map(bandMeasurement),
      tolerance: 0.005,
      significantFigures: 2,
      requireRecordedMeasurements: true,
      interpretationLimit: "Rf comparisons are solvent-system and condition dependent; matching Rf alone does not prove identity.",
      evidenceProvenance: "student ruler readings only",
    }, { interaction: { type: "submitCalculation", stationId: "calculator", valueParameter: "rf" }, evidence: ["calculate", "rf", prefix],
      success: "Each band's Rf is worked out." }),
    action("record-quality", "observe", "Record the separation", {
      tag: `${prefix}-separation-quality`,
      inputMode: "choice",
      inputRole: "studentResponse",
      inputLabel: "How the bands separated",
      inputOptions: ["Resolved", "Overlapping", "Streaked"],
      inputRequired: true,
    }, { evidence: ["observe", "notebook", `${prefix}-separation-quality`], success: "Separation recorded." }),
    action("dispose-solvent", "transfer", `Pour the used ${s.name} into the ${s.waste.label.toLowerCase()}`, {
      sourceDefinitionId: "chromatography-chamber",
      sourceInstanceId: "chamber-1",
      targetDefinitionId: "waste-beaker",
      targetInstanceId: s.waste.id,
      volumeMl: "{{config.solventVolumeMl}}",
      wasteStream: s.waste.stream,
      disposalProvenance: "teacher-approved waste stream",
    }, {
      atomId: "atom.transfer.route-solvent-waste",
      interaction: { type: "pourInto", sourceDefinitionId: "chromatography-chamber", targetDefinitionId: "waste-beaker", valueParameter: "volumeMl" },
      roles: { ...CHAMBER, "waste-receiver": "waste-beaker" },
      success: `The used ${s.name} is in the ${s.waste.label.toLowerCase()}.`,
    }),
  ];

  const spotNode = (n) => node(`spot-${n}`, `Spot ${n} of 3`, n === 1
    ? "Touch the capillary's tip to the centre of the baseline, briefly, so the spot stays small."
    : "Touch the tip to the same spot again, briefly.");
  const dryNode = (n) => node(`dry-spot-${n}`, `Let spot ${n} dry`,
    "Leave the strip flat until the spot is dry. The clock runs the wait ({{config.spotDryMinutes}} min) fast.",
    { notebookTag: `${prefix}-spot-${n}-dry` });
  const calculateNode = node("calculate-rf", "Calculate each band's Rf",
    "Rf is the band's distance divided by the front's distance, both from the baseline. Work it out for each band from your recorded readings.",
    { calculationId: `${prefix}-rf-${s.bands[0].id}` }, "calculation");
  calculateNode.validation = s.bands.map((band) => ({
    id: `calculate-rf-node--${band.id}`, type: "calculationWithinTolerance", label: `${band.label} Rf is within tolerance.`,
    calculationId: `${prefix}-rf-${band.id}`, tolerance: 0.005,
  }));

  const nodes = [
    node("place-chamber", "Place the chamber", "Stand the clean, empty chamber upright on the bench."),
    node("label-chamber", "Label the chamber",
      `Write "${s.tapeLabel}" on the chamber's label tape with the pencil, so the trial keeps its solvent's name.`,
      { notebookTag: `${prefix}-chamber-labelled` }),
    node("measure-solvent", "Measure the solvent",
      `Pour {{config.solventVolumeMl}} mL of ${s.name} from its bottle into the graduated cylinder, reading the bottom of the meniscus.`),
    node("charge-chamber", "Pour the solvent into the chamber",
      "Pour it into the chamber and let the cylinder drain. The layer must stay below where the baseline will hang."),
    node("place-paper", "Lay the strip flat", "Lay a fresh strip flat on the bench. Handle it by its edges."),
    node("draw-baseline", "Draw the baseline",
      "Draw a thin pencil line across the strip {{config.baselineHeightMm}} mm above its lower edge. Pencil, not ink: graphite does not run.",
      { notebookTag: `${prefix}-baseline` }),
    node("load-capillary", "Fill the capillary", "Dip the capillary's tip into the dye mixture; it fills by capillary action."),
    spotNode(1), dryNode(1), spotNode(2), dryNode(2), spotNode(3), dryNode(3),
    node("hang-strip", "Hang the strip from the hook",
      "Hang the strip from the hook under the chamber's lid, spot end down, holding the lid above the chamber."),
    node("close-chamber", "Lower the strip and seat the lid",
      "Lower the strip in and seat the lid: its lower edge in the solvent, the spot above it, the strip clear of the walls.",
      { notebookTag: `${prefix}-chamber-closed` }),
    node("develop", "Let the solvent rise",
      `Leave the chamber closed while the solvent climbs to ${FRONT_MM} mm above the baseline. The clock runs the wait ({{config.developMinutes}} min) fast.`),
    node("open-chamber", "Lift the lid with the strip",
      "Lift the lid straight up; the strip comes out with it.", { notebookTag: `${prefix}-chamber-opened` }),
    node("remove-strip", "Unhook the strip and lay it flat", "Unhook the wet strip and lay it flat on the bench."),
    node("mark-front", "Mark the solvent front",
      "At once, before it evaporates, draw a pencil line along the wet edge the solvent reached.", { notebookTag: `${prefix}-front-marked` }),
    node("dry-strip", "Let the strip dry",
      "Leave it flat until it is dry: bands keep moving while it is wet. The clock runs the wait ({{config.stripDryMinutes}} min) fast.",
      { notebookTag: `${prefix}-strip-dry` }),
    node("identify-bands", "Identify the bands",
      "Record each band's colour, from the baseline up. Where bands run together, record the overlap as one region.",
      { notebookTag: `${prefix}-bands-identified` }, "observation"),
    node("place-ruler", "Lay the ruler along the strip", "Lay the ruler beside the strip with its zero on the baseline."),
    node("read-front", "Read the front", "Read the distance from the baseline to the front's pencil line, to the nearest millimetre, and enter it.",
      { measurementId: frontId }, "observation"),
    node("record-front", "Record the front", "Record the front's distance in your data table.", { action: "record-front" }, "observation"),
    ...s.bands.flatMap((band) => [
      node(`read-${band.id}`, `Read the ${band.label.toLowerCase()} band`,
        `Read the distance from the baseline to ${band.read}, to the nearest millimetre, and enter it.`,
        { measurementId: bandMeasurement(band) }, "observation"),
      node(`record-${band.id}`, `Record the ${band.label.toLowerCase()} band`, `Record the band and its distance in your data table.`,
        { action: `record-${band.id}` }, "observation"),
    ]),
    calculateNode,
    node("record-quality", "Record the separation", "Record how well the bands separated: resolved, overlapping or streaked.",
      { notebookTag: `${prefix}-separation-quality` }, "observation"),
    node("dispose-solvent", `Pour the ${s.name} into the waste`,
      `Pour the used ${s.name} into the ${s.waste.label.toLowerCase()} beaker: ${s.waste.rule}.`),
  ];

  const definition = technique({
    id,
    title,
    learningGoal,
    equipment,
    actions,
    nodes,
    slots: [
      { id: "solventVolumeMl", valueType: "number", required: true, defaultValue: 4 },
      { id: "solventDepthMm", valueType: "number", required: true, defaultValue: 5 },
      { id: "baselineHeightMm", valueType: "number", required: true, defaultValue: 15 },
      { id: "spotterLoadVolumeMl", valueType: "number", required: true, defaultValue: 0.03 },
      { id: "spotVolumeMl", valueType: "number", required: true, defaultValue: 0.005 },
      { id: "spotDryMinutes", valueType: "number", required: true, defaultValue: 1 },
      { id: "developMinutes", valueType: "number", required: true, defaultValue: 10 },
      { id: "stripDryMinutes", valueType: "number", required: true, defaultValue: 5 },
    ],
    evidenceOutputs: [
      { id: frontId, kind: "measurement", actionId: "read-front", referenceId: frontId },
      ...s.bands.map((band) => ({ id: bandMeasurement(band), kind: "measurement", actionId: `read-${band.id}`, referenceId: bandMeasurement(band) })),
      ...s.bands.map((band) => ({ id: `${prefix}-rf-${band.id}`, kind: "calculation", actionId: "calculate-rf", referenceId: `${prefix}-rf-${band.id}` })),
    ],
    successActionId: "dispose-solvent",
    tags: ["chromatography", "rf", prefix],
    legacyActionEffects: [
      evidenceEffect("identify-bands"),
      evidenceEffect("record-front"),
      ...s.bands.map((band) => evidenceEffect(`record-${band.id}`)),
      { actionId: "calculate-rf", effect: { classes: ["calculation-analysis"], targets: [{ domain: "analysis" }, { domain: "evidence" }] } },
      evidenceEffect("record-quality"),
    ],
  });
  // The strip's prepared values (the front and each band's centre, from the baseline): drawn on the strip, read by the
  // student. Numbers, as the validator requires: the lab's setup page changes them through its 3D transform (`labs3d.ts`).
  definition.chromatographyModels = [{
    id: s.modelId,
    solventFrontMm: FRONT_MM,
    bands: s.bands.map((band) => ({ id: band.id, label: band.label, color: band.color, distanceMm: band.distanceMm,
      expectedRf: rf(band.distanceMm) })),
  }];
  return definition;
};

const practice = trial("water", "paper-chromatography-practice", "Paper Chromatography",
  "Separate a food-dye mixture on paper with water as the mobile phase, and measure each band's Rf.");

/** The 2-propanol trial: unlisted, written only as the lab's twin. */
const propanol = trial("propanol", "paper-chromatography-propanol-practice", "Paper Chromatography (2-propanol)",
  "Separate a food-dye mixture on paper with 2-propanol as the mobile phase, and measure each band's Rf.");

export default practice;

/** The lab's two trials (decision 3, revision 3): each starts from an empty chamber, so no step or slot is dropped. */
export const twins = [
  twinOf(practice, { id: "paper-chromatography-water-3d" }),
  twinOf(propanol, { id: "paper-chromatography-propanol-3d" }),
];
