import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { refinePaperChromatographyDefinition } from "./generatorInputs/simulator/paperChromatography.mjs";
import { refineThermalDecompositionMassLossDefinition } from "./generatorInputs/simulator/thermalDecompositionMassLoss.mjs";
import { refineTransmittanceDilutionDefinition } from "./generatorInputs/simulator/transmittanceDilution.mjs";

const outDir = fileURLToPath(new URL("../public/techniques/", import.meta.url));
const updatedAt = "2026-06-15T00:00:00.000Z";

const invalidCases = [
  {
    id: "wrong-order",
    when: "current node expects a different action",
    message: "That action is out of sequence for the current technique step.",
    recovery: "Check the process map and perform the highlighted step first.",
  },
  {
    id: "missing-source",
    when: "source equipment or contents are missing",
    message: "The selected source does not contain the material required for this action.",
    recovery: "Select equipment that contains the required liquid, solid, solution, or precipitate.",
  },
  {
    id: "overflow",
    when: "target capacity would be exceeded",
    message: "The target equipment cannot hold the requested volume.",
    recovery: "Use a larger container or transfer a smaller measured amount.",
  },
];

/**
 * `overrides` exists so one definition can be revised without restamping the other two files this
 * generator owns. Cycle 10 revises `paper-chromatography.json` only; `transmittance-dilution.json`
 * and `thermal-decomposition-mass-loss.json` must stay byte-identical, because they belong to other
 * cycles' scopes.
 */
const metadata = (tags, overrides = {}) => ({
  version: "1.0.0",
  author: "Lab Studio",
  updatedAt,
  tags,
  ...overrides,
});

const emptyContents = () => ({
  kind: "empty",
  label: "empty",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
});

const equipment = (id, definitionId, label, contents = emptyContents(), location = "shelf") => ({
  id,
  definitionId,
  label,
  location,
  contents,
});

/**
 * `extra` may carry `atomId`, `equipmentRoleBindings`, `prerequisites`, and additional
 * `invalidCases`. Every field is optional and omitting it reproduces the pre-Cycle-10 shape exactly,
 * so the two definitions this cycle does not revise are unaffected.
 */
const action = (id, verb, label, parameters, success, evidence = [verb], interaction, extra = {}) => ({
  id,
  verb,
  label,
  ...(extra.atomId ? { atomId: extra.atomId } : {}),
  ...(extra.equipmentRoleBindings ? { equipmentRoleBindings: extra.equipmentRoleBindings } : {}),
  parameters,
  ...(interaction ? { interaction } : {}),
  prerequisites: extra.prerequisites ?? [],
  stateChanges: [`${label}: ${success}`],
  invalidCases: extra.invalidCases ? [...invalidCases, ...extra.invalidCases] : invalidCases,
  feedback: {
    success,
    invalid: "The simulator could not complete that action. Review the step requirements.",
  },
  evidence,
});

const actionRule = (id, actionId) => ({
  id,
  type: "actionEvidence",
  label: `Action ${actionId} was completed.`,
  actionId,
});

const measurementRule = (id, measurementId) => ({
  id,
  type: "measurementRecorded",
  label: `Measurement ${measurementId} was recorded.`,
  measurementId,
});

const notebookRule = (id, notebookTag) => ({
  id,
  type: "notebookEntry",
  label: `Notebook entry ${notebookTag} was recorded.`,
  notebookTag,
});

const calculationRule = (id, calculationId, tolerance) => ({
  id,
  type: "calculationWithinTolerance",
  label: `Calculation ${calculationId} is within tolerance.`,
  calculationId,
  tolerance,
});

const node = (id, title, description, actionId, validation, type = "action") => ({
  id,
  type,
  title,
  description,
  actionId,
  config: {},
  validation,
  hints: [],
  feedback: {
    success: `${title} complete.`,
    retry: `Review ${title} and try again.`,
  },
});

const linearProcess = (nodes) => ({
  startNodeId: nodes[0]?.id ?? "",
  nodes,
  edges: nodes.slice(0, -1).map((current, index) => ({
    from: current.id,
    to: nodes[index + 1].id,
    label: "Next",
    condition: { type: "validationPassed" },
  })),
});

const liquid = (label, volumeMl, visualState = "clear-liquid") => ({
  kind: "liquid",
  label,
  volumeMl,
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState,
});

const blueDyeStock = (volumeMl) => ({
  kind: "solution",
  label: "Blue dye stock",
  volumeMl,
  solutes: [{ id: "blue-dye-1", label: "Blue dye #1", amount: 0.00000025, unit: "mol" }],
  concentration: { value: 0.00001, unit: "M" },
  contamination: [],
  wetState: "wet",
  visualState: "blue-dye-solution",
});

const carbonateMixture = {
  kind: "solid",
  label: "NaHCO3 and Na2CO3 mixture",
  massG: 1.5,
  solutes: [
    { id: "sodium-bicarbonate", label: "Sodium bicarbonate", amount: 0.84, unit: "g" },
    { id: "sodium-carbonate", label: "Sodium carbonate", amount: 0.66, unit: "g" },
  ],
  contamination: [],
  temperatureC: 25,
  wetState: "dry",
  visualState: "powder",
};

/**
 * Investigation 5, `sticky-question-paper-chromatography_2026-07-27.md`.
 *
 * Revised by Cycle 10. The pre-Cycle-10 definition collapsed four distinct physical operations into
 * notebook sentences and then let `developChromatogram` write the solvent-front and band distances
 * itself, so `calculate-rf-values` could run on the model's own answer key the moment the strip
 * developed. Here the chronology is real: origin, spot, dry, develop, remove, mark while wet, dry,
 * then read a ruler once per distance (TR-03 through TR-15). `record-*` copies a reading it cannot
 * invent, because `record` fails when no measurement exists.
 */
const paperChromatography = () => {
  const BASELINE_HEIGHT_MM = 15;
  const SOLVENT_DEPTH_MM = 5;
  const RULER_DIVISION_MM = 1;
  const PAPER_INSTANCE = "chromatography-paper-1";

  const RECOVERY = {
    submergedOrigin: {
      id: "submerged-origin",
      when: "the pencil origin sits at or below the solvent layer",
      message: "A submerged origin dissolves the sample into the mobile phase instead of letting it travel up the paper.",
      recovery: "Lower the solvent depth or raise the origin, then develop a fresh strip.",
    },
    wetSpot: {
      id: "wet-spot-developed",
      when: "development is attempted while the origin spot is still wet",
      message: "A wet origin spreads into the solvent and streaks instead of resolving into bands.",
      recovery: "Let the spot dry to a compact mark, then insert the paper.",
    },
    openChamber: {
      id: "chamber-not-sealed",
      when: "the chamber lid is left off during development",
      message: "An open chamber lets the mobile phase evaporate before it saturates the paper, so the front rises unevenly.",
      recovery: "Keep the lid closed for the whole development and reject a trial developed open.",
    },
    unmarkedFront: {
      id: "front-not-marked",
      when: "the paper dries before the solvent front is marked",
      message: "Once the solvent evaporates the front cannot be located, and every Rf in the trial loses its denominator.",
      recovery: "Mark the front in pencil as the strip leaves the chamber. If it dried unmarked, repeat the trial on fresh paper.",
    },
    wetMeasurement: {
      id: "measured-while-wet",
      when: "distances are measured before the marked paper dries",
      message: "Bands keep migrating and smearing while the paper is wet, so a wet reading is not the band centre.",
      recovery: "Let the marked strip dry flat, then align the ruler on the origin.",
    },
    inkMark: {
      id: "ink-baseline",
      when: "the origin or the solvent front is marked with ink instead of pencil",
      message: "Ink components separate in the mobile phase and add bands that did not come from the sample.",
      recovery: "Use the pencil for the origin and for the solvent front.",
    },
  };

  const measureAction = (id, measurementId, label, point, measurementType, bandId, extraPrereqs = []) =>
    action(
      id,
      "observe",
      label,
      {
        sourceDefinitionId: "chromatography-paper",
        sourceInstanceId: PAPER_INSTANCE,
        targetDefinitionId: "metric-ruler",
        targetInstanceId: "metric-ruler-1",
        measurementId,
        label,
        unit: "mm",
        chromatographyMeasurementType: measurementType,
        ...(bandId ? { chromatographyBandId: bandId } : {}),
        measurementPoint: point,
        rulerPrecisionMm: RULER_DIVISION_MM,
        measurementToleranceMm: 0.5,
        evidenceProvenance: "student ruler reading",
      },
      `${label} is read from the ruler to the nearest millimetre.`,
      ["observe", "measurement", measurementId],
      {
        type: "readInstrument",
        sourceDefinitionId: "chromatography-paper",
        targetDefinitionId: "metric-ruler",
        stationId: "metric-ruler",
        valueParameter: "measurementId",
        accessibleLabel: `Align the ruler zero on the pencil origin and read the distance to ${point}.`,
        successCue: `${label} is available as a student ruler reading.`,
        invalidCue: "Measure only a dry chromatogram whose solvent front is already marked.",
      },
      {
        prerequisites: [
          notebookRule("chromatogram-dried-before-measurement", "chromatogram-dried"),
          actionRule("ruler-placed-before-measurement", "place-measuring-ruler"),
          ...extraPrereqs,
        ],
        invalidCases: [RECOVERY.unmarkedFront, RECOVERY.wetMeasurement],
      },
    );

  const recordAction = (id, measurementId, label, readActionId) =>
    action(
      id,
      "record",
      label,
      {
        measurementId,
        label,
        unit: "mm",
        readActionId,
        evidenceProvenance: "student ruler reading",
      },
      `${label} is written into the data table.`,
      ["record", "measurement", "notebook"],
      undefined,
      {
        prerequisites: [measurementRule(`${measurementId}-read-first`, measurementId)],
        invalidCases: [RECOVERY.wetMeasurement],
      },
    );

  const actions = [
    action("place-chamber", "place", "Place chromatography chamber", {
      equipmentDefinitionId: "chromatography-chamber",
      location: "workbench",
    }, "The chromatography chamber is upright on the workbench.", ["place"], {
      type: "dragToZone",
      sourceDefinitionId: "chromatography-chamber",
      stationId: "workbench",
      accessibleLabel: "Place the empty chromatography chamber upright on the workbench.",
      successCue: "The chromatography chamber is upright on the workbench.",
      invalidCue: "Start with the chamber on the bench before adding solvent.",
    }, {
      atomId: "atom.place.developing-chamber",
      equipmentRoleBindings: { "developing-chamber": "chromatography-chamber" },
    }),
    action("charge-chromatography-chamber", "transfer", "Add shallow solvent", {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "chromatography-chamber",
      volumeMl: 10,
      solventDepthMm: SOLVENT_DEPTH_MM,
      depthProvenance: "teacher-configured",
    }, "A shallow solvent layer is below the future baseline.", ["transfer"], {
      type: "pourInto",
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "chromatography-chamber",
      valueParameter: "volumeMl",
      accessibleLabel: "Pour a shallow layer of solvent into the chamber, below where the paper baseline will sit.",
      successCue: "The solvent layer is shallow enough to stay below the baseline.",
      invalidCue: "Use the solvent bottle as the source and the chamber as the receiving vessel.",
    }, {
      atomId: "atom.transfer.charge-developing-chamber",
      equipmentRoleBindings: {
        "liquid-source": "reagent-bottle",
        "developing-chamber": "chromatography-chamber",
      },
      prerequisites: [actionRule("chamber-placed-before-charging", "place-chamber")],
      invalidCases: [RECOVERY.submergedOrigin],
    }),
    action("place-paper-flat", "place", "Lay chromatography paper flat", {
      equipmentDefinitionId: "chromatography-paper",
      equipmentInstanceId: PAPER_INSTANCE,
      location: "workbench",
    }, "The chromatography paper is flat on the bench for marking.", ["place"], {
      type: "dragToZone",
      sourceDefinitionId: "chromatography-paper",
      stationId: "workbench",
      accessibleLabel: "Place the chromatography paper flat on the workbench.",
      successCue: "The chromatography paper is flat on the bench.",
      invalidCue: "Place the paper on the bench before marking the baseline.",
    }, {
      atomId: "atom.place.stationary-phase",
      equipmentRoleBindings: { "stationary-phase": "chromatography-paper" },
    }),
    action("draw-pencil-baseline", "observe", "Draw pencil baseline", {
      note: "A light pencil baseline is drawn near the bottom edge; ink is avoided because it would dissolve in the solvent.",
      tag: "chromatography-baseline",
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: PAPER_INSTANCE,
      chromatographyOperation: "markBaseline",
      chromatographyModelId: "food-dyes-paper",
      baselineHeightMm: BASELINE_HEIGHT_MM,
      markingToolDefinitionId: "pencil",
      markingToolInstanceId: "pencil-1",
      baselineProvenance: "teacher-configured",
    }, "The pencil origin is on the paper and above the solvent level.", ["observe", "notebook"], {
      type: "recordNotebook",
      accessibleLabel: "Use the pencil to draw a light baseline near the bottom of the chromatography paper.",
      successCue: "The pencil baseline is marked.",
      invalidCue: "Use pencil, not ink, to mark the baseline.",
    }, {
      prerequisites: [actionRule("paper-flat-before-baseline", "place-paper-flat")],
      invalidCases: [RECOVERY.inkMark, RECOVERY.submergedOrigin],
    }),
    action("load-capillary", "transfer", "Load capillary spotter", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "capillary-spotter",
      volumeMl: 0.1,
      visualState: "blue-dye-solution",
      sampleProvenance: "teacher-provided food dye sample",
      toolProvenance: "inferred spotting tool, not listed in the source materials",
    }, "The capillary contains a small dye sample.", ["transfer"], {
      type: "pourInto",
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "capillary-spotter",
      valueParameter: "volumeMl",
      accessibleLabel: "Touch the capillary spotter to the dye sample so a small volume rises into the tube.",
      successCue: "The capillary contains a small dye sample.",
      invalidCue: "Load the capillary from the dye sample bottle.",
    }, {
      atomId: "atom.transfer.load-spotting-tool",
      equipmentRoleBindings: {
        "sample-source": "sample-bottle",
        "spotting-tool": "capillary-spotter",
      },
      prerequisites: [notebookRule("baseline-before-loading", "chromatography-baseline")],
    }),
    action("spot-sample", "spotSample", "Touch sample to baseline", {
      sourceDefinitionId: "capillary-spotter",
      targetDefinitionId: "chromatography-paper",
      targetInstanceId: PAPER_INSTANCE,
      chromatographyModelId: "food-dyes-paper",
      requiresBaselineMarked: true,
      requiresDrying: true,
      originDistanceMm: BASELINE_HEIGHT_MM,
      spottedLabel: "Food dye spot on the pencil origin",
    }, "A small dye spot is on the pencil baseline.", ["spotSample"], {
      type: "spotOnto",
      sourceDefinitionId: "capillary-spotter",
      targetDefinitionId: "chromatography-paper",
      accessibleLabel: "Touch the loaded capillary to the pencil baseline without scraping the paper.",
      successCue: "A small dye spot is on the baseline.",
      invalidCue: "Use the loaded capillary on the chromatography paper baseline.",
    }, {
      atomId: "atom.spotSample.apply-baseline-spot",
      equipmentRoleBindings: {
        "spotting-tool": "capillary-spotter",
        "stationary-phase": "chromatography-paper",
        "sample-source": "sample-bottle",
      },
      prerequisites: [
        notebookRule("baseline-before-spotting", "chromatography-baseline"),
        actionRule("capillary-loaded-before-spotting", "load-capillary"),
      ],
    }),
    action("dry-sample-spot", "observe", "Let the sample spot dry", {
      note: "The spot is allowed to dry so it stays compact before the paper is developed.",
      tag: "chromatography-spot-dry",
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: PAPER_INSTANCE,
      chromatographyOperation: "drySpot",
      dryingIntervalProvenance: "teacher-configured",
    }, "The compact sample spot is dry.", ["observe", "notebook"], {
      type: "recordNotebook",
      accessibleLabel: "Wait until the origin spot is dry and compact before developing the strip.",
      successCue: "The origin spot is dry.",
      invalidCue: "Apply the sample to the origin before drying it.",
    }, {
      prerequisites: [actionRule("spotted-before-drying", "spot-sample")],
      invalidCases: [RECOVERY.wetSpot],
    }),
    action("develop-paper", "developChromatogram", "Place paper into chamber", {
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: PAPER_INSTANCE,
      targetDefinitionId: "chromatography-chamber",
      targetInstanceId: "chromatography-chamber-1",
      snapZoneId: "chromatography-chamber-paper-slot",
      chromatographyModelId: "food-dyes-paper",
      baselineHeightMm: BASELINE_HEIGHT_MM,
      solventDepthMm: SOLVENT_DEPTH_MM,
      chamberSealed: true,
      requireDrySpot: true,
      trackWetState: true,
      recordMeasurementsOnDevelop: false,
      developedLabel: "Developed food dye chromatogram",
      stopConditionProvenance: "teacher-configured",
    }, "The paper is suspended in the chamber and the chromatogram develops.", ["developChromatogram"], {
      type: "snapIntoTarget",
      sourceDefinitionId: "chromatography-paper",
      targetDefinitionId: "chromatography-chamber",
      snapZoneId: "chromatography-chamber-paper-slot",
      accessibleLabel: "Place the spotted paper in the chamber with the solvent below the spot, then close the lid.",
      successCue: "The paper is suspended and the chromatogram develops in a closed chamber.",
      invalidCue: "Use spotted, dry chromatography paper and a chamber containing a shallow solvent layer.",
    }, {
      atomId: "atom.developChromatogram.develop-strip",
      equipmentRoleBindings: {
        "stationary-phase": "chromatography-paper",
        "developing-chamber": "chromatography-chamber",
      },
      prerequisites: [
        notebookRule("spot-dry-before-development", "chromatography-spot-dry"),
        actionRule("chamber-charged-before-development", "charge-chromatography-chamber"),
      ],
      invalidCases: [RECOVERY.submergedOrigin, RECOVERY.wetSpot, RECOVERY.openChamber],
    }),
    action("remove-developed-paper", "place", "Remove the developed paper", {
      equipmentDefinitionId: "chromatography-paper",
      equipmentInstanceId: PAPER_INSTANCE,
      location: "workbench",
    }, "The wet developed chromatogram is flat on the bench.", ["place"], {
      type: "dragToZone",
      sourceDefinitionId: "chromatography-paper",
      stationId: "workbench",
      accessibleLabel: "Lift the wet strip out of the chamber and lay it flat.",
      successCue: "The wet chromatogram is out of the chamber and ready for an immediate front mark.",
      invalidCue: "Develop the chromatogram before removing it.",
    }, {
      atomId: "atom.place.remove-developed-strip",
      equipmentRoleBindings: { "stationary-phase": "chromatography-paper" },
      prerequisites: [actionRule("developed-before-removal", "develop-paper")],
      invalidCases: [RECOVERY.unmarkedFront],
    }),
    action("mark-solvent-front", "observe", "Mark the solvent front", {
      note: "The solvent front is marked with pencil as soon as the paper leaves the chamber, before it can evaporate.",
      tag: "chromatography-solvent-front-marked",
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: PAPER_INSTANCE,
      chromatographyOperation: "markSolventFront",
      markingToolDefinitionId: "pencil",
      markingToolInstanceId: "pencil-1",
    }, "The solvent front is marked before it can evaporate.", ["observe", "notebook"], {
      type: "recordNotebook",
      accessibleLabel: "Mark the solvent front in pencil while the strip is still wet.",
      successCue: "The solvent front is marked.",
      invalidCue: "Mark the front while the paper is still wet; a dry strip no longer shows it.",
    }, {
      prerequisites: [actionRule("removed-before-marking", "remove-developed-paper")],
      invalidCases: [RECOVERY.unmarkedFront, RECOVERY.inkMark],
    }),
    action("dry-developed-paper", "observe", "Dry developed chromatogram", {
      note: "The developed paper is laid flat until the solvent evaporates before measurements are taken.",
      tag: "chromatogram-dried",
      sourceDefinitionId: "chromatography-paper",
      sourceInstanceId: PAPER_INSTANCE,
      chromatographyOperation: "dryDevelopedPaper",
    }, "The developed chromatogram is dry for measurement.", ["observe", "notebook"], {
      type: "recordNotebook",
      accessibleLabel: "Let the marked chromatogram dry flat before measuring any distance.",
      successCue: "The marked chromatogram is dry.",
      invalidCue: "Mark the solvent front before drying the paper.",
    }, {
      prerequisites: [notebookRule("front-marked-before-drying", "chromatography-solvent-front-marked")],
      invalidCases: [RECOVERY.unmarkedFront],
    }),
    action("place-measuring-ruler", "place", "Place the metric ruler", {
      equipmentDefinitionId: "metric-ruler",
      equipmentInstanceId: "metric-ruler-1",
      location: "workbench",
      rulerPrecisionMm: RULER_DIVISION_MM,
    }, "The metric ruler is on the bench for millimetre readings.", ["place"], {
      type: "dragToZone",
      sourceDefinitionId: "metric-ruler",
      stationId: "workbench",
      accessibleLabel: "Place the metric ruler on the workbench.",
      successCue: "The metric ruler is on the bench.",
      invalidCue: "Bring the ruler out before measuring a distance.",
    }, {
      atomId: "atom.place.measuring-ruler",
      equipmentRoleBindings: { "distance-measuring-instrument": "metric-ruler" },
    }),
    measureAction(
      "measure-solvent-front",
      "chromatography-solvent-front",
      "Solvent front distance",
      "the pencil solvent-front mark",
      "solventFront",
    ),
    recordAction(
      "record-solvent-front",
      "chromatography-solvent-front",
      "Solvent front distance",
      "measure-solvent-front",
    ),
    measureAction(
      "measure-blue-band",
      "chromatography-band-blue",
      "Blue band distance",
      "the centre of the blue band",
      "band",
      "blue",
      [measurementRule("front-before-blue", "chromatography-solvent-front")],
    ),
    recordAction("record-blue-band", "chromatography-band-blue", "Blue band distance", "measure-blue-band"),
    measureAction(
      "measure-red-band",
      "chromatography-band-red",
      "Red band distance",
      "the centre of the red band",
      "band",
      "red",
      [measurementRule("front-before-red", "chromatography-solvent-front")],
    ),
    recordAction("record-red-band", "chromatography-band-red", "Red band distance", "measure-red-band"),
    measureAction(
      "measure-yellow-band",
      "chromatography-band-yellow",
      "Yellow band distance",
      "the centre of the yellow band",
      "band",
      "yellow",
      [measurementRule("front-before-yellow", "chromatography-solvent-front")],
    ),
    recordAction(
      "record-yellow-band",
      "chromatography-band-yellow",
      "Yellow band distance",
      "measure-yellow-band",
    ),
    action("calculate-rf-values", "calculate", "Calculate Rf values", {
      calculationId: "chromatography-rf",
      template: "chromatographyRf",
      chromatographyModelId: "food-dyes-paper",
      bandIds: ["blue", "red", "yellow"],
      tolerance: 0.005,
      significantFigures: 2,
      requireRecordedMeasurements: true,
      evidenceProvenance: "student ruler readings only",
      interpretationLimit:
        "Rf is conditional on this solvent system and these conditions; a matching Rf does not prove identity.",
    }, "Rf values are calculated from the measured distances.", ["calculate", "measurement"], {
      type: "submitCalculation",
      stationId: "calculator",
      valueParameter: "rf",
      accessibleLabel:
        "For each band, divide the distance the band travelled by the distance the solvent front travelled.",
      successCue: "Rf values are calculated from the recorded distances.",
      invalidCue: "Read and record the solvent front and every band distance before calculating Rf.",
    }, {
      prerequisites: [
        measurementRule("front-recorded-for-rf", "chromatography-solvent-front"),
        measurementRule("blue-recorded-for-rf", "chromatography-band-blue"),
        measurementRule("red-recorded-for-rf", "chromatography-band-red"),
        measurementRule("yellow-recorded-for-rf", "chromatography-band-yellow"),
      ],
    }),
  ];

  return {
    id: "paper-chromatography",
    title: "Paper Chromatography",
    learningGoal: "Prepare, spot, develop, mark, measure, and calculate Rf values from a paper chromatogram.",
    requiredEquipment: [
      "chromatography-chamber",
      "chromatography-paper",
      "capillary-spotter",
      "metric-ruler",
      "reagent-bottle",
      "sample-bottle",
      "pencil",
    ],
    chromatographyModels: [{
      id: "food-dyes-paper",
      solventFrontMm: 80,
      bands: [
        { id: "blue", label: "Blue", color: "#2563eb", distanceMm: 64, expectedRf: 0.8 },
        { id: "red", label: "Red", color: "#dc2626", distanceMm: 48, expectedRf: 0.6 },
        { id: "yellow", label: "Yellow", color: "#facc15", distanceMm: 24, expectedRf: 0.3 },
      ],
    }],
    initialState: {
      equipment: [
        equipment("chromatography-chamber-1", "chromatography-chamber", "Chromatography chamber"),
        equipment("chromatography-paper-1", "chromatography-paper", "Chromatography paper", {
          ...emptyContents(),
          visualState: "paper-unspotted",
        }),
        equipment("capillary-spotter-1", "capillary-spotter", "Capillary spotter"),
        equipment("metric-ruler-1", "metric-ruler", "Metric ruler"),
        equipment("reagent-bottle-1", "reagent-bottle", "Solvent bottle", liquid("Chromatography solvent", 20, "clear-liquid")),
        equipment("sample-bottle-1", "sample-bottle", "Food dye sample", {
          kind: "mixture",
          label: "Food dye sample",
          volumeMl: 1,
          solutes: [{ id: "food-dye-mixture", label: "Food dye mixture", amount: 1, unit: "mg" }],
          contamination: [],
          wetState: "wet",
          visualState: "blue-dye-solution",
        }),
        equipment("pencil-1", "pencil", "Pencil"),
      ],
    },
    actions,
    process: linearProcess([
      node("place-chamber-node", "Place chamber", "Place the empty chamber upright on the workbench.", "place-chamber", [actionRule("placed-chamber", "place-chamber")]),
      node("add-solvent-node", "Add solvent", "Pour a shallow solvent layer into the chamber below the future baseline.", "charge-chromatography-chamber", [actionRule("solvent-added", "charge-chromatography-chamber")]),
      node("place-paper-node", "Lay paper flat", "Place the chromatography paper flat before marking.", "place-paper-flat", [actionRule("paper-placed", "place-paper-flat")]),
      node("draw-baseline-node", "Draw baseline", "Use the pencil to draw a light baseline near the bottom edge.", "draw-pencil-baseline", [notebookRule("baseline-recorded", "chromatography-baseline")], "observation"),
      node("load-capillary-node", "Load capillary", "Touch the capillary tip to the dye sample.", "load-capillary", [actionRule("capillary-loaded", "load-capillary")]),
      node("spot-sample-node", "Spot sample", "Touch the loaded capillary to the baseline.", "spot-sample", [actionRule("sample-spotted", "spot-sample")]),
      node("dry-spot-node", "Dry spot", "Observe the spot until it dries before development.", "dry-sample-spot", [notebookRule("spot-dried", "chromatography-spot-dry")], "observation"),
      node("develop-paper-node", "Develop paper", "Place the paper in the chamber with the solvent below the spot and the lid closed.", "develop-paper", [actionRule("paper-developed", "develop-paper")], "checkpoint"),
      node("remove-paper-node", "Remove paper", "Lift the wet strip out and lay it flat.", "remove-developed-paper", [actionRule("paper-removed", "remove-developed-paper")]),
      node("mark-front-node", "Mark solvent front", "Mark the solvent front in pencil while the strip is still wet.", "mark-solvent-front", [notebookRule("front-marked", "chromatography-solvent-front-marked")], "observation"),
      node("dry-developed-node", "Dry chromatogram", "Place the developed chromatogram flat to dry.", "dry-developed-paper", [notebookRule("chromatogram-dried", "chromatogram-dried")], "observation"),
      node("place-ruler-node", "Place ruler", "Bring out the millimetre ruler; the simulator supplies no distance.", "place-measuring-ruler", [actionRule("ruler-placed", "place-measuring-ruler")]),
      node("measure-front-node", "Measure solvent front", "Read the distance from the origin to the solvent-front mark.", "measure-solvent-front", [measurementRule("front-measured", "chromatography-solvent-front")], "observation"),
      node("record-front-node", "Record solvent front", "Write the solvent-front distance into the data table.", "record-solvent-front", [actionRule("front-written-down", "record-solvent-front")], "observation"),
      node("measure-blue-node", "Measure blue band", "Read the distance from the origin to the centre of the blue band.", "measure-blue-band", [measurementRule("blue-measured", "chromatography-band-blue")], "observation"),
      node("record-blue-node", "Record blue band", "Write the blue band distance into the data table.", "record-blue-band", [actionRule("blue-written-down", "record-blue-band")], "observation"),
      node("measure-red-node", "Measure red band", "Read the distance from the origin to the centre of the red band.", "measure-red-band", [measurementRule("red-measured", "chromatography-band-red")], "observation"),
      node("record-red-node", "Record red band", "Write the red band distance into the data table.", "record-red-band", [actionRule("red-written-down", "record-red-band")], "observation"),
      node("measure-yellow-node", "Measure yellow band", "Read the distance from the origin to the centre of the yellow band.", "measure-yellow-band", [measurementRule("yellow-measured", "chromatography-band-yellow")], "observation"),
      node("record-yellow-node", "Record yellow band", "Write the yellow band distance into the data table.", "record-yellow-band", [actionRule("yellow-written-down", "record-yellow-band")], "observation"),
      node("calculate-rf-node", "Calculate Rf", "Calculate Rf by dividing each band distance by the solvent-front distance.", "calculate-rf-values", [
        calculationRule("blue-rf-valid", "chromatography-rf-blue", 0.005),
        calculationRule("red-rf-valid", "chromatography-rf-red", 0.005),
        calculationRule("yellow-rf-valid", "chromatography-rf-yellow", 0.005),
      ], "calculation"),
    ]),
    successCriteria: [
      calculationRule("blue-rf-success", "chromatography-rf-blue", 0.005),
      calculationRule("red-rf-success", "chromatography-rf-red", 0.005),
      calculationRule("yellow-rf-success", "chromatography-rf-yellow", 0.005),
    ],
    commonMistakes: [
      { id: "ink-baseline", when: "baseline is marked with soluble ink", message: "Use pencil for the baseline so the line does not dissolve.", recovery: "Mark the baseline with pencil before spotting." },
      { id: "spot-under-solvent", when: "spot is below the solvent surface", message: "The sample spot must stay above the solvent.", recovery: "Use a shallow solvent layer and suspend the paper carefully." },
      { id: "front-not-marked", when: "the paper dries before the solvent front is marked", message: "An unmarked front leaves every Rf without a denominator.", recovery: "Mark the front as the strip leaves the chamber; otherwise repeat the trial." },
      { id: "measured-while-wet", when: "distances are read before the marked paper dries", message: "Wet bands keep migrating, so the reading is not the band centre.", recovery: "Dry the marked strip flat, then align the ruler on the origin." },
    ],
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "chromatography", "rf"], {
      version: "1.1.0",
      updatedAt: "2026-08-05T00:00:00.000Z",
    }),
  };
};
const transmittanceDilution = () => {
  const actions = [
    action("place-volumetric-flask", "place", "Place volumetric flask", {
      equipmentDefinitionId: "volumetric-flask",
      location: "workbench",
    }, "The volumetric flask is upright on the bench."),
    action("place-graduated-cylinder", "place", "Place graduated cylinder", {
      equipmentDefinitionId: "graduated-cylinder",
      location: "workbench",
    }, "The graduated cylinder is ready beside the flask."),
    action("measure-stock-dye", "measureVolume", "Measure stock dye aliquot", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "stock-dye-aliquot",
      volumeMl: 8,
      tolerance: 0.1,
      visualState: "blue-dye-solution",
    }, "Eight milliliters of stock dye are measured in the cylinder.", ["measureVolume", "measurement"]),
    action("transfer-dye-aliquot", "transfer", "Pour aliquot into flask", {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "volumetric-flask",
      volumeMl: 8,
    }, "The measured dye aliquot is in the volumetric flask."),
    action("add-water-below-mark", "transfer", "Add water below mark", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "volumetric-flask",
      volumeMl: 1.5,
      visualState: "blue-dye-solution",
    }, "Water is added below the calibration mark."),
    action("swirl-flask", "observe", "Swirl flask", {
      note: "The flask is swirled to mix the dye before the final meniscus adjustment.",
      tag: "dilution-swirl",
    }, "The partially diluted dye is swirled.", ["observe", "notebook"]),
    action("top-up-to-mark", "dilute", "Top up dropwise to mark", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "volumetric-flask",
      finalVolumeMl: 10,
      dilutionFactor: 1.25,
      visualState: "blue-dye-solution",
    }, "The bottom of the meniscus rests on the calibration mark.", ["dilute", "measurement"]),
    action("stopper-flask", "place", "Stopper flask", {
      equipmentDefinitionId: "rubber-stopper-set",
      targetDefinitionId: "volumetric-flask",
      snapZoneId: "volumetric-flask-stopper-seat",
    }, "The stopper is seated in the volumetric flask.", ["place"], {
      type: "snapIntoTarget",
      sourceDefinitionId: "rubber-stopper-set",
      targetDefinitionId: "volumetric-flask",
      snapZoneId: "volumetric-flask-stopper-seat",
      accessibleLabel: "Seat a rubber stopper in the volumetric flask neck.",
      successCue: "The stopper is seated in the flask.",
      invalidCue: "Use the stopper on the volumetric flask neck.",
    }),
    action("invert-to-mix", "observe", "Invert flask to mix", {
      note: "The stoppered flask is inverted several times so the dilution is uniform from neck to bulb.",
      tag: "dilution-inverted",
    }, "The dilution is mixed by inversion.", ["observe", "notebook"]),
    action("place-spectrophotometer", "place", "Place spectrophotometer", {
      equipmentDefinitionId: "spectrophotometer",
      location: "workbench",
    }, "The spectrophotometer is ready at 630 nm."),
    action("fill-blank-cuvette", "transfer", "Fill blank cuvette", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "cuvette",
      targetInstanceId: "blank-cuvette-1",
      volumeMl: 3,
      visualState: "clear-liquid",
    }, "The blank cuvette is filled with deionized water."),
    action("wipe-blank-cuvette", "observe", "Wipe blank cuvette", {
      note: "The outside of the blank cuvette is wiped so fingerprints and droplets do not scatter light.",
      tag: "blank-cuvette-wiped",
    }, "The blank cuvette is wiped clean.", ["observe", "notebook"]),
    action("zero-with-blank", "observe", "Insert blank and zero", {
      note: "The blank cuvette is inserted in the correct orientation and the instrument is zeroed to 100% transmittance.",
      tag: "spectrophotometer-zeroed",
      sourceInstanceId: "blank-cuvette-1",
      targetDefinitionId: "spectrophotometer",
    }, "The spectrophotometer is zeroed with the blank.", ["observe", "notebook"], {
      type: "readInstrument",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      stationId: "spectrophotometer",
      accessibleLabel: "Place the blank cuvette and zero the spectrophotometer.",
      successCue: "The spectrophotometer is zeroed with the blank.",
      invalidCue: "Use the blank cuvette with the spectrophotometer before reading the sample.",
    }),
    action("fill-sample-cuvette", "transfer", "Fill sample cuvette", {
      sourceDefinitionId: "volumetric-flask",
      targetDefinitionId: "cuvette",
      targetInstanceId: "sample-cuvette-1",
      volumeMl: 3,
      visualState: "blue-dye-solution",
    }, "The sample cuvette is filled with diluted dye."),
    action("wipe-orient-sample-cuvette", "observe", "Wipe and orient sample cuvette", {
      note: "The sample cuvette is wiped and oriented with the clear faces in the light path.",
      tag: "sample-cuvette-oriented",
    }, "The sample cuvette is clean and correctly oriented.", ["observe", "notebook"]),
    action("insert-sample-cuvette", "place", "Insert sample cuvette", {
      equipmentInstanceId: "sample-cuvette-1",
      equipmentDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
    }, "The sample cuvette is inserted in the spectrophotometer.", ["place"], {
      type: "snapIntoTarget",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
      accessibleLabel: "Place the filled sample cuvette into the spectrophotometer slot.",
      successCue: "The sample cuvette is inserted.",
      invalidCue: "Use the filled sample cuvette with the spectrophotometer slot.",
    }),
    action("record-percent-transmittance", "record", "Read percent transmittance", {
      measurementId: "percent-transmittance",
      label: "Percent transmittance at 630 nm",
      value: 42,
      unit: "%T",
    }, "Percent transmittance evidence recorded.", ["record", "measurement", "notebook"]),
    action("calculate-decimal-transmittance", "calculate", "Calculate decimal transmittance", {
      calculationId: "decimal-transmittance",
      template: "decimalTransmittance",
      percentTransmittanceMeasurementId: "percent-transmittance",
      expected: 0.42,
      tolerance: 0.001,
    }, "Decimal transmittance is within tolerance.", ["calculate", "transmittance"]),
    action("calculate-absorbance", "calculate", "Calculate absorbance", {
      calculationId: "absorbance",
      template: "absorbanceFromPercentT",
      percentTransmittanceMeasurementId: "percent-transmittance",
      expected: 0.3768,
      tolerance: 0.0001,
      unit: "A",
    }, "Absorbance is within tolerance.", ["calculate", "absorbance"]),
    action("calculate-diluted-concentration", "calculate", "Calculate diluted concentration", {
      calculationId: "diluted-concentration",
      template: "dilutedConcentration",
      stockConcentration: 10,
      stockVolumeMl: 8,
      finalVolumeMl: 10,
      expected: 8,
      tolerance: 0.01,
      unit: "uM",
    }, "Diluted concentration is within tolerance.", ["calculate", "dilution"]),
  ];
  actions.find((item) => item.id === "calculate-decimal-transmittance").prerequisites = [measurementRule("percent-transmittance-required", "percent-transmittance")];
  actions.find((item) => item.id === "calculate-absorbance").prerequisites = [measurementRule("percent-transmittance-required", "percent-transmittance")];

  return {
    id: "transmittance-dilution",
    title: "Analyze Transmittance of a Dilution",
    learningGoal: "Prepare one assigned dye dilution, blank and read a spectrophotometer, then relate transmittance, absorbance, and concentration evidence.",
    requiredEquipment: ["sample-bottle", "graduated-cylinder", "volumetric-flask", "wash-bottle", "rubber-stopper-set", "cuvette", "spectrophotometer"],
    initialState: {
      equipment: [
        equipment("sample-bottle-1", "sample-bottle", "Blue dye stock", blueDyeStock(25)),
        equipment("graduated-cylinder-1", "graduated-cylinder", "Graduated cylinder"),
        equipment("volumetric-flask-1", "volumetric-flask", "Volumetric flask"),
        equipment("wash-bottle-1", "wash-bottle", "Wash bottle", liquid("Deionized water", 500, "clear-liquid")),
        equipment("rubber-stopper-set-1", "rubber-stopper-set", "Rubber stopper"),
        equipment("blank-cuvette-1", "cuvette", "Blank cuvette"),
        equipment("sample-cuvette-1", "cuvette", "Sample cuvette"),
        equipment("spectrophotometer-1", "spectrophotometer", "Spectrophotometer"),
      ],
    },
    actions,
    process: linearProcess([
      node("place-flask-node", "Place flask", "Place the volumetric flask upright on the bench.", "place-volumetric-flask", [actionRule("flask-placed", "place-volumetric-flask")]),
      node("place-cylinder-node", "Place cylinder", "Place the graduated cylinder beside the flask.", "place-graduated-cylinder", [actionRule("cylinder-placed", "place-graduated-cylinder")]),
      node("measure-stock-node", "Measure stock dye", "Use the graduated cylinder to measure 8 mL of stock dye.", "measure-stock-dye", [actionRule("stock-measured", "measure-stock-dye"), measurementRule("stock-aliquot-measured", "stock-dye-aliquot")]),
      node("transfer-aliquot-node", "Transfer aliquot", "Pour the measured stock dye into the volumetric flask.", "transfer-dye-aliquot", [actionRule("aliquot-transferred", "transfer-dye-aliquot")]),
      node("add-water-node", "Add water below mark", "Add water below the calibration mark.", "add-water-below-mark", [actionRule("water-added-below-mark", "add-water-below-mark")]),
      node("swirl-node", "Swirl flask", "Use a gentle swirl to mix the partially diluted dye.", "swirl-flask", [notebookRule("swirl-recorded", "dilution-swirl")], "observation"),
      node("top-up-node", "Top up to mark", "Add water dropwise until the meniscus rests on the mark.", "top-up-to-mark", [actionRule("top-up-complete", "top-up-to-mark")]),
      node("stopper-node", "Stopper flask", "Seat a stopper in the volumetric flask.", "stopper-flask", [actionRule("flask-stoppered", "stopper-flask")]),
      node("invert-node", "Invert to mix", "Use repeated inversions to mix the stoppered flask.", "invert-to-mix", [notebookRule("inversion-recorded", "dilution-inverted")], "observation"),
      node("place-spectro-node", "Place spectrophotometer", "Place the spectrophotometer on the workbench.", "place-spectrophotometer", [actionRule("spectro-placed", "place-spectrophotometer")]),
      node("fill-blank-node", "Fill blank cuvette", "Add deionized water to the blank cuvette.", "fill-blank-cuvette", [actionRule("blank-filled", "fill-blank-cuvette")]),
      node("wipe-blank-node", "Wipe blank cuvette", "Use a wipe to clean the outside of the blank cuvette.", "wipe-blank-cuvette", [notebookRule("blank-wiped", "blank-cuvette-wiped")], "observation"),
      node("zero-node", "Zero instrument", "Place the blank in the instrument and zero it.", "zero-with-blank", [notebookRule("spectro-zeroed", "spectrophotometer-zeroed")], "observation"),
      node("fill-sample-node", "Fill sample cuvette", "Add diluted dye to the sample cuvette.", "fill-sample-cuvette", [actionRule("sample-cuvette-filled", "fill-sample-cuvette")]),
      node("wipe-sample-node", "Wipe sample cuvette", "Use a wipe to clean and orient the sample cuvette.", "wipe-orient-sample-cuvette", [notebookRule("sample-oriented", "sample-cuvette-oriented")], "observation"),
      node("insert-sample-node", "Insert sample", "Place the sample cuvette in the spectrophotometer.", "insert-sample-cuvette", [actionRule("sample-cuvette-inserted", "insert-sample-cuvette")]),
      node("record-transmittance-node", "Read %T", "Record the percent transmittance reading.", "record-percent-transmittance", [measurementRule("percent-transmittance-evidence", "percent-transmittance")], "observation"),
      node("decimal-node", "Calculate decimal T", "Convert percent transmittance to decimal transmittance.", "calculate-decimal-transmittance", [calculationRule("decimal-valid", "decimal-transmittance", 0.001)], "calculation"),
      node("absorbance-node", "Calculate absorbance", "Calculate absorbance using A = -log10(T).", "calculate-absorbance", [calculationRule("absorbance-valid", "absorbance", 0.0001)], "calculation"),
      node("concentration-node", "Calculate concentration", "Use M1V1 = M2V2 to calculate diluted dye concentration.", "calculate-diluted-concentration", [calculationRule("diluted-concentration-valid", "diluted-concentration", 0.01)], "calculation"),
    ]),
    successCriteria: [
      measurementRule("transmittance-success", "percent-transmittance"),
      calculationRule("absorbance-success", "absorbance", 0.0001),
      calculationRule("concentration-success", "diluted-concentration", 0.01),
    ],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "spectroscopy", "dilution", "transmittance"]),
  };
};

const thermalDecomposition = () => {
  const actions = [
    action("place-balance", "place", "Place analytical balance", {
      equipmentDefinitionId: "analytical-balance",
      location: "workbench",
    }, "The balance is ready for cooled mass readings."),
    action("place-empty-crucible", "place", "Place empty crucible and lid", {
      equipmentDefinitionId: "crucible-with-lid",
      location: "workbench",
    }, "The empty crucible and lid are on the bench."),
    action("add-carbonate-sample", "transfer", "Add carbonate sample", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "crucible-with-lid",
      massG: 1.5,
      targetLabel: "Crucible with NaHCO3 and Na2CO3 mixture",
      visualState: "powder",
    }, "The carbonate mixture is in the crucible."),
    action("weigh-initial-crucible", "weigh", "Weigh crucible and mixture", {
      sourceDefinitionId: "crucible-with-lid",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "crucible-initial-mass",
      expectedMassG: 24.5,
      tolerance: 0.0005,
      maxSafeTemperatureC: 40,
    }, "Initial crucible and sample mass recorded.", ["weigh", "measurement"]),
    action("record-initial-crucible-mass", "record", "Record initial mass", {
      measurementId: "crucible-initial-mass",
      label: "Initial crucible and mixture mass",
      unit: "g",
    }, "Initial mass recorded in the notebook.", ["record", "notebook"]),
    action("place-ring-stand", "place", "Place ring stand", {
      equipmentDefinitionId: "ring-stand",
      location: "workbench",
    }, "The ring stand is upright on the bench."),
    action("add-clay-triangle", "place", "Add clay triangle", {
      equipmentDefinitionId: "clay-triangle",
      targetDefinitionId: "ring-stand",
      snapZoneId: "ring-stand-clay-triangle-seat",
    }, "The clay triangle rests in the iron ring.", ["place"], {
      type: "snapIntoTarget",
      sourceDefinitionId: "clay-triangle",
      targetDefinitionId: "ring-stand",
      snapZoneId: "ring-stand-clay-triangle-seat",
      accessibleLabel: "Seat the clay triangle into the support ring on the stand.",
      successCue: "The clay triangle rests in the support ring.",
      invalidCue: "Use the clay triangle with the ring stand support.",
    }),
    action("place-bunsen-burner", "place", "Place Bunsen burner", {
      equipmentDefinitionId: "bunsen-burner",
      location: "workbench",
    }, "The Bunsen burner is under the support."),
    action("place-crucible-on-support", "place", "Place crucible on clay triangle", {
      equipmentDefinitionId: "crucible-with-lid",
      targetDefinitionId: "ring-stand",
      snapZoneId: "ring-stand-crucible-seat",
    }, "The crucible sits on the clay triangle with the lid slightly ajar.", ["place"], {
      type: "snapIntoTarget",
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "ring-stand",
      snapZoneId: "ring-stand-crucible-seat",
      accessibleLabel: "Place the crucible on the clay triangle with the lid slightly ajar.",
      successCue: "The crucible is supported on the clay triangle with the lid ajar.",
      invalidCue: "Set the crucible on the clay triangle support before heating.",
    }),
    action("warm-gently", "observe", "Warm gently with lid ajar", {
      note: "The crucible is warmed gently first so moisture and gas escape without spattering the solid.",
      tag: "gentle-heating",
    }, "Gentle heating habit recorded.", ["observe", "notebook"]),
    action("heat-carbonate-mixture", "heat", "Heat strongly to decompose", {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "bunsen-burner",
      heatSourceDefinitionId: "bunsen-burner",
      heatedMassG: 24.1899,
      productMassG: 1.1899,
      heatedTemperatureC: 650,
      productLabel: "Heated sodium carbonate residue",
    }, "The bicarbonate has decomposed and the crucible is hot.", ["heat"]),
    action("turn-off-burner", "observe", "Turn off burner", {
      note: "The flame is turned off before the crucible is moved with tongs.",
      tag: "burner-off",
    }, "The burner is off before cooling.", ["observe", "notebook"]),
    action("cool-crucible", "cool", "Cool crucible with tongs", {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "crucible-tongs",
      coolingToolDefinitionId: "crucible-tongs",
      cooledTemperatureC: 25,
    }, "The crucible has cooled enough to weigh.", ["cool"]),
    action("weigh-preliminary-final-mass", "weigh", "Weigh cooled crucible once", {
      sourceDefinitionId: "crucible-with-lid",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "crucible-preliminary-final-mass",
      expectedMassG: 24.1899,
      tolerance: 0.0005,
      maxSafeTemperatureC: 40,
    }, "First cooled mass reading recorded.", ["weigh", "measurement"]),
    action("repeat-heat-to-constant-mass", "heat", "Repeat heat to constant mass", {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "bunsen-burner",
      heatSourceDefinitionId: "bunsen-burner",
      heatedMassG: 24.1899,
      productMassG: 1.1899,
      heatedTemperatureC: 650,
      allowConstantMass: true,
      productLabel: "Heated sodium carbonate residue",
    }, "The reheated residue returns to the same mass target.", ["heat"]),
    action("cool-constant-mass-crucible", "cool", "Cool after repeat heat", {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "crucible-tongs",
      coolingToolDefinitionId: "crucible-tongs",
      cooledTemperatureC: 25,
    }, "The reheated crucible has cooled enough to reweigh.", ["cool"]),
    action("weigh-final-crucible", "weigh", "Reweigh cooled crucible", {
      sourceDefinitionId: "crucible-with-lid",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "crucible-final-mass",
      expectedMassG: 24.1899,
      tolerance: 0.0005,
      maxSafeTemperatureC: 40,
    }, "Final constant mass recorded.", ["weigh", "measurement"]),
    action("record-final-crucible-mass", "record", "Record final mass", {
      measurementId: "crucible-final-mass",
      label: "Final crucible and residue mass",
      unit: "g",
    }, "Final mass recorded in the notebook.", ["record", "notebook"]),
    action("calculate-carbonate-composition", "calculate", "Calculate carbonate composition", {
      calculationId: "carbonate-mass-loss",
      template: "carbonateMassLossComposition",
      initialMassMeasurementId: "crucible-initial-mass",
      finalMassMeasurementId: "crucible-final-mass",
      sampleMassG: 1.5,
      expected: 0.3101,
      tolerance: 0.0005,
      unit: "g",
    }, "Mass loss and carbonate composition are calculated.", ["calculate"]),
  ];

  return {
    id: "thermal-decomposition-mass-loss",
    title: "Heat and Reweigh a Carbonate Mixture",
    learningGoal: "Add a carbonate sample to a crucible, heat to constant mass, cool before weighing, and calculate composition from mass loss.",
    requiredEquipment: ["analytical-balance", "crucible-with-lid", "sample-bottle", "ring-stand", "clay-triangle", "bunsen-burner", "crucible-tongs"],
    initialState: {
      equipment: [
        equipment("analytical-balance-1", "analytical-balance", "Analytical balance"),
        equipment("crucible-with-lid-1", "crucible-with-lid", "Empty crucible with lid", {
          ...emptyContents(),
          massG: 23,
          temperatureC: 25,
        }),
        equipment("sample-bottle-1", "sample-bottle", "Carbonate mixture", carbonateMixture),
        equipment("ring-stand-1", "ring-stand", "Ring stand"),
        equipment("clay-triangle-1", "clay-triangle", "Clay triangle"),
        equipment("bunsen-burner-1", "bunsen-burner", "Bunsen burner"),
        equipment("crucible-tongs-1", "crucible-tongs", "Crucible tongs"),
      ],
    },
    actions,
    process: linearProcess([
      node("place-balance-node", "Place balance", "Place the analytical balance for cooled mass readings.", "place-balance", [actionRule("balance-placed", "place-balance")]),
      node("place-empty-crucible-node", "Place empty crucible", "Place the empty crucible and lid on the workbench.", "place-empty-crucible", [actionRule("empty-crucible-placed", "place-empty-crucible")]),
      node("add-sample-node", "Add sample", "Add the carbonate mixture to the crucible.", "add-carbonate-sample", [actionRule("sample-added", "add-carbonate-sample")]),
      node("weigh-initial-node", "Weigh initial mass", "Read the initial crucible and mixture mass.", "weigh-initial-crucible", [actionRule("weighed-initial", "weigh-initial-crucible"), measurementRule("initial-mass-evidence", "crucible-initial-mass")]),
      node("record-initial-node", "Record initial mass", "Record the initial mass in the notebook.", "record-initial-crucible-mass", [actionRule("recorded-initial", "record-initial-crucible-mass")], "observation"),
      node("place-ring-stand-node", "Place ring stand", "Place the ring stand upright on the bench.", "place-ring-stand", [actionRule("ring-stand-placed", "place-ring-stand")]),
      node("add-clay-triangle-node", "Add clay triangle", "Seat the clay triangle in the ring.", "add-clay-triangle", [actionRule("clay-triangle-added", "add-clay-triangle")]),
      node("place-burner-node", "Place burner", "Place the burner under the support.", "place-bunsen-burner", [actionRule("burner-placed", "place-bunsen-burner")]),
      node("place-crucible-support-node", "Place crucible on support", "Place the crucible on the clay triangle with lid ajar.", "place-crucible-on-support", [actionRule("crucible-supported", "place-crucible-on-support")]),
      node("warm-gently-node", "Warm gently", "Heat gently first to avoid spattering.", "warm-gently", [notebookRule("gentle-heat-recorded", "gentle-heating")], "observation"),
      node("heat-strongly-node", "Heat strongly", "Heat strongly to decompose the bicarbonate.", "heat-carbonate-mixture", [actionRule("heated-mixture", "heat-carbonate-mixture")]),
      node("burner-off-node", "Turn off burner", "Use the gas control to turn off the flame before moving the crucible.", "turn-off-burner", [notebookRule("burner-off-recorded", "burner-off")], "observation"),
      node("cool-crucible-node", "Cool crucible", "Use tongs and let the hot crucible cool.", "cool-crucible", [actionRule("cooled-crucible", "cool-crucible")]),
      node("weigh-preliminary-node", "Weigh once", "Weigh the cooled crucible once.", "weigh-preliminary-final-mass", [measurementRule("preliminary-mass-evidence", "crucible-preliminary-final-mass")]),
      node("repeat-heat-node", "Repeat heat", "Heat again to verify constant mass.", "repeat-heat-to-constant-mass", [actionRule("repeat-heat-complete", "repeat-heat-to-constant-mass")]),
      node("cool-repeat-node", "Cool again", "Cool the reheated crucible before weighing.", "cool-constant-mass-crucible", [actionRule("repeat-cool-complete", "cool-constant-mass-crucible")]),
      node("weigh-final-node", "Reweigh cooled crucible", "Weigh the cooled crucible again to constant mass.", "weigh-final-crucible", [measurementRule("final-mass-evidence", "crucible-final-mass")]),
      node("record-final-node", "Record final mass", "Record the final constant mass.", "record-final-crucible-mass", [actionRule("recorded-final", "record-final-crucible-mass")], "observation"),
      node("calculate-composition-node", "Calculate composition", "Calculate mass loss and carbonate composition.", "calculate-carbonate-composition", [calculationRule("carbonate-mass-loss-valid", "carbonate-mass-loss", 0.0005)], "calculation"),
    ]),
    successCriteria: [calculationRule("carbonate-composition-success", "carbonate-mass-loss", 0.0005)],
    commonMistakes: [
      { id: "hot-weighing", when: "hot crucible is placed on the balance", message: "A hot crucible should not be weighed.", recovery: "Cool the crucible before weighing." },
      { id: "no-constant-mass-check", when: "final mass is recorded after one heating only", message: "Thermal decomposition should be checked by reheating to constant mass.", recovery: "Repeat heat, cool, and weigh before recording the final mass." },
    ],
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "thermal-decomposition", "stoichiometry"]),
  };
};

const definitions = [
  ["paper-chromatography.json", refinePaperChromatographyDefinition(paperChromatography())],
  ["transmittance-dilution.json", refineTransmittanceDilutionDefinition(transmittanceDilution())],
  ["thermal-decomposition-mass-loss.json", refineThermalDecompositionMassLossDefinition(thermalDecomposition())],
];

const onlyIds = (() => {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === "--only") {
      const value = process.argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--only requires a comma-separated technique id list");
      values.push(value);
      index += 1;
    } else if (argument.startsWith("--only=")) {
      values.push(argument.slice("--only=".length));
    }
  }
  return new Set(values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean));
})();

const definitionById = new Map(definitions.map(([file, definition]) => [definition.id, [file, definition]]));
const unknownOnlyIds = [...onlyIds].filter((id) => !definitionById.has(id));
if (unknownOnlyIds.length > 0) throw new Error(`Unknown --only technique id(s): ${unknownOnlyIds.join(", ")}`);
const selectedDefinitions = onlyIds.size === 0
  ? definitions
  : [...onlyIds].map((id) => definitionById.get(id));

await mkdir(outDir, { recursive: true });
for (const [file, definition] of selectedDefinitions) {
  await writeFile(join(outDir, file), `${JSON.stringify(definition, null, 2)}\n`, "utf8");
  console.log(`wrote public/techniques/${file}`);
}
