import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refineGravimetrySeparationDefinition } from "./generatorInputs/apChem/gravimetrySeparation.mjs";
import { refineKineticsDefinition } from "./generatorInputs/apChem/kinetics.mjs";
import { refineSpectroscopyDefinition } from "./generatorInputs/apChem/spectroscopy.mjs";
import { refineTitrationDefinition } from "./generatorInputs/apChem/titration.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "techniques");
const atomRegistry = JSON.parse(readFileSync(join(root, "src", "domain", "atomRegistry.json"), "utf8"));
const registeredAtomsById = new Map(atomRegistry.atoms.map((atom) => [atom.id, atom]));
const updatedAt = "2026-06-17T00:00:00.000Z";

const commonMistakes = [
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

const equipmentLabels = {
  "analytical-balance": "Analytical balance",
  "beaker-250ml": "250 mL beaker",
  "beral-pipette": "Beral pipette",
  "buchner-funnel": "Buchner funnel",
  "burette-50ml": "50 mL burette",
  "conductivity-tester": "Conductivity tester",
  "crucible-tongs": "Crucible tongs",
  "cuvette": "Cuvette",
  "data-collection-interface": "Data collection interface",
  "distilled-water-bottle": "Distilled water bottle",
  "drying-oven": "Drying oven",
  "erlenmeyer-flask-250ml": "250 mL Erlenmeyer flask",
  "filter-paper": "Filter paper",
  "foam-cup-calorimeter": "Foam cup calorimeter",
  "funnel": "Glass funnel",
  "graduated-cylinder": "Graduated cylinder",
  "graduated-pipette-10ml": "10 mL graduated pipette",
  "hot-plate-stirrer": "Hot plate stirrer",
  "magnet": "Magnet",
  "melting-point-apparatus": "Melting point apparatus",
  "naoh-bottle": "0.100 M NaOH",
  "permanent-marker": "Permanent marker",
  "phenolphthalein-dropper": "Phenolphthalein",
  "ph-meter": "pH meter",
  "ph-paper": "pH paper",
  "pipette-pump": "Pipette pump",
  "reagent-bottle": "Reagent bottle",
  "reagent-tray": "Reagent tray",
  "ring-stand-clamp": "Ring stand and clamp",
  "sample-bottle": "Sample bottle",
  "side-arm-filter-flask": "Side-arm filter flask",
  "small-vial": "Small vial",
  "spectrophotometer": "Spectrophotometer",
  "spatula": "Spatula",
  "stirring-rod": "Stirring rod",
  "stopwatch": "Stopwatch",
  "thermometer": "Thermometer",
  "test-tube": "Test tube",
  "unknown-acid-bottle": "Unknown acid",
  "vacuum-source": "Vacuum source",
  "volumetric-flask": "Volumetric flask",
  "waste-beaker": "Waste beaker",
  "wash-bottle": "Wash bottle",
  "watch-glass": "Watch glass",
};

const empty = () => ({
  kind: "empty",
  label: "empty",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
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

const solution = (label, volumeMl, concentration, unit = "M", visualState = "clear-liquid") => ({
  kind: "solution",
  label,
  volumeMl,
  solutes: [],
  concentration: { value: concentration, unit },
  contamination: [],
  wetState: "wet",
  visualState,
});

const solid = (label, massG) => ({
  kind: "solid",
  label,
  massG,
  solutes: [{ id: label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"), label, amount: massG, unit: "g" }],
  contamination: [],
  wetState: "dry",
  visualState: "powder",
});

const suspension = (label, volumeMl, precipitateMassG, precipitateSubstance) => ({
  kind: "mixture",
  label,
  volumeMl,
  solutes: [],
  precipitate: {
    substance: precipitateSubstance,
    massG: precipitateMassG,
    rinsed: false,
    dryness: "wet",
  },
  contamination: [],
  wetState: "wet",
  visualState: "cloudy-precipitate",
});

const equipment = (definitionId, suffix = "1", contents = empty(), label = equipmentLabels[definitionId]) => ({
  id: `${definitionId}-${suffix}`,
  definitionId,
  label,
  location: "shelf",
  contents,
});

const action = (id, verb, label, parameters, success, evidence = [verb]) => ({
  id,
  verb,
  label,
  parameters,
  prerequisites: [],
  stateChanges: [`${label}: ${success}`],
  invalidCases: commonMistakes,
  feedback: {
    success,
    invalid: "The simulator could not complete that action. Review the step requirements.",
  },
  evidence,
});

const withRuntime = (definition, {
  interaction,
  prerequisites = [],
  atomId,
  equipmentRoleBindings,
}) => ({
  ...definition,
  ...(atomId ? { atomId } : {}),
  ...(equipmentRoleBindings ? { equipmentRoleBindings } : {}),
  interaction,
  prerequisites,
});

const actionRequired = (actionId, label = `${actionId} is complete.`) => ({
  id: `${actionId}-required`,
  type: "actionEvidence",
  label,
  actionId,
});

const measurementRequired = (measurementId, label) => ({
  id: `${measurementId}-required`,
  type: "measurementRecorded",
  label,
  measurementId,
});

const notebookRequired = (notebookTag, label) => ({
  id: `${notebookTag}-required`,
  type: "notebookEntry",
  label,
  notebookTag,
});

const actionRule = (id, actionId) => ({
  id,
  type: "actionEvidence",
  label: `Action ${actionId} was completed.`,
  actionId,
});

const node = (id, title, description, actionId, type = "action") => ({
  id,
  type,
  title,
  description,
  actionId,
  config: {},
  validation: [actionRule(`${id}-done`, actionId)],
  hints: [],
  feedback: {
    success: `${title} complete.`,
    retry: `Review ${title} and try again.`,
  },
});

const linearProcess = (nodes) => ({
  startNodeId: nodes[0].id,
  nodes,
  edges: nodes.slice(0, -1).map((current, index) => ({
    from: current.id,
    to: nodes[index + 1].id,
    label: "Next",
    condition: { type: "validationPassed" },
  })),
});

const technique = ({
  id,
  title,
  learningGoal,
  requiredEquipment,
  initialEquipment,
  actions,
  nodes,
  tags,
  version = "1.0.0",
  definitionUpdatedAt = updatedAt,
}) => ({
  id,
  title,
  learningGoal,
  requiredEquipment,
  initialState: { equipment: initialEquipment },
  actions,
  process: linearProcess(nodes),
  successCriteria: nodes.map((item) => actionRule(`${item.id}-success`, item.actionId)),
  commonMistakes,
  resetBehavior: "resetTechnique",
  metadata: {
    version,
    author: "Lab Studio",
    updatedAt: definitionUpdatedAt,
    tags: ["technique", "chemistry", ...tags],
  },
});

const idsToEquipment = (ids) => ids.map((id) => equipment(id));

const onlyIds = (() => {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === "--only") {
      const value = process.argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--only requires a comma-separated technique id list");
      }
      values.push(value);
      index += 1;
    } else if (argument.startsWith("--only=")) {
      values.push(argument.slice("--only=".length));
    }
  }
  return new Set(values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean));
})();

const quickAcheSourceOwnedIds = new Set([
  "quick-ache-extraction-recovery",
  "quick-ache-property-evidence",
]);
const definitions = [];

// Quick Ache is source-owned in-place refinement input, not a second reproducible seed definition.
// Load it only for an explicitly selected, allowlisted target so unrelated AP-Chem generation has
// no dependency on these public JSONs and cannot rewrite them on a broad run.
for (const id of onlyIds) {
  if (!quickAcheSourceOwnedIds.has(id)) continue;
  definitions.push(JSON.parse(readFileSync(join(root, "public", "techniques", `${id}.json`), "utf8")));
}

{
  const actions = [
    action("place-spectrophotometer", "place", "Place spectrophotometer", {
      equipmentDefinitionId: "spectrophotometer",
      location: "workbench",
    }, "The spectrophotometer is ready on the workbench."),
    action("measure-stock-dye", "measureVolume", "Measure stock dye", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "stock-dye-volume",
      volumeMl: 5,
      tolerance: 0.1,
      visualState: "blue-dye-solution",
    }, "A stock dye aliquot is measured."),
    action("transfer-stock-dye", "transfer", "Transfer stock dye", {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "volumetric-flask",
      volumeMl: 5,
      visualState: "blue-dye-solution",
    }, "The stock dye aliquot is in the volumetric flask."),
    action("dilute-standard", "dilute", "Dilute standard", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "volumetric-flask",
      volumeMl: 95,
      finalVolumeMl: 100,
      dilutionFactor: 20,
    }, "The dye standard is diluted to the calibration mark."),
    action("transfer-standard-cuvette", "transfer", "Transfer standard to cuvette", {
      sourceDefinitionId: "volumetric-flask",
      targetDefinitionId: "cuvette",
      volumeMl: 3,
      visualState: "blue-dye-solution",
    }, "The cuvette contains diluted dye standard."),
    action("record-percent-transmittance", "record", "Record percent transmittance", {
      measurementId: "percent-transmittance",
      label: "Percent transmittance",
      value: 62.5,
      unit: "%T",
    }, "Percent transmittance evidence is recorded.", ["record", "measurement"]),
    action("calculate-absorbance", "calculate", "Calculate absorbance", {
      calculationId: "absorbance",
      template: "absorbanceFromPercentT",
      percentTransmittanceMeasurementId: "percent-transmittance",
      expected: 0.2041,
      tolerance: 0.02,
      unit: "absorbance",
    }, "Absorbance is calculated from transmittance.", ["calculate"]),
  ];
  definitions.push(technique({
    id: "beers-law-calibration",
    title: "Beer's Law Calibration",
    learningGoal: "Prepare a dye standard, measure transmittance, and convert it to absorbance evidence.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "volumetric-flask",
      "wash-bottle",
      "cuvette",
      "spectrophotometer",
      "data-collection-interface",
    ],
    initialEquipment: [
      equipment("sample-bottle", "1", solution("Blue dye stock", 25, 0.00001, "M", "blue-dye-solution")),
      ...idsToEquipment([
        "graduated-cylinder",
        "volumetric-flask",
        "wash-bottle",
        "cuvette",
        "spectrophotometer",
        "data-collection-interface",
      ]),
    ],
    actions,
    nodes: [
      node("place-spectrophotometer-node", "Place spectrophotometer", "Place the spectrophotometer on the workbench.", "place-spectrophotometer"),
      node("measure-stock-dye-node", "Measure stock dye", "Pour 5 mL of stock dye into the graduated cylinder.", "measure-stock-dye"),
      node("transfer-stock-dye-node", "Transfer stock dye", "Pour the measured dye into the volumetric flask.", "transfer-stock-dye"),
      node("dilute-standard-node", "Dilute standard", "Pour deionized water into the volumetric flask to the calibration mark.", "dilute-standard"),
      node("transfer-standard-cuvette-node", "Fill cuvette", "Pour the diluted standard into the cuvette.", "transfer-standard-cuvette"),
      node("record-percent-transmittance-node", "Record transmittance", "Record percent transmittance from the spectrophotometer.", "record-percent-transmittance", "observation"),
      node("calculate-absorbance-node", "Calculate absorbance", "Calculate absorbance from the recorded percent transmittance.", "calculate-absorbance", "calculation"),
    ],
    tags: ["spectroscopy", "beers-law"],
  }));
}

{
  const actions = [
    action("weigh-brass", "weigh", "Weigh brass sample", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "brass-mass",
      expectedMassG: 1.25,
      tolerance: 0.005,
    }, "The brass sample mass is recorded.", ["weigh", "measurement"]),
    action("observe-dissolution", "observe", "Observe teacher dissolution", {
      tag: "brass-dissolution",
      note: "The teacher-dissolved brass sample is ready for dilution after fume-hood nitric acid handling.",
    }, "The teacher-prepared brass solution is noted.", ["observe", "notebook"]),
    action("transfer-brass-solution", "transfer", "Transfer brass solution", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "volumetric-flask",
      volumeMl: 50,
      visualState: "copper-blue-solution",
    }, "The dissolved brass solution is in the volumetric flask."),
    action("dilute-brass-solution", "dilute", "Dilute brass solution", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "volumetric-flask",
      volumeMl: 50,
      finalVolumeMl: 100,
      dilutionFactor: 2,
    }, "The brass solution is diluted to volume."),
    action("transfer-brass-cuvette", "transfer", "Transfer brass sample to cuvette", {
      sourceDefinitionId: "volumetric-flask",
      targetDefinitionId: "cuvette",
      volumeMl: 3,
      visualState: "copper-blue-solution",
    }, "The cuvette contains the brass sample solution."),
    action("record-brass-absorbance", "record", "Record brass absorbance", {
      measurementId: "brass-absorbance",
      label: "Brass solution absorbance",
      value: 0.48,
      unit: "absorbance",
    }, "Brass sample absorbance is recorded.", ["record", "measurement"]),
    action("calculate-copper-percent", "calculate", "Calculate copper percent", {
      calculationId: "copper-percent",
      expected: 67.5,
      tolerance: 2,
      unit: "% Cu",
    }, "Copper percent is calculated from the calibration evidence.", ["calculate"]),
  ];
  definitions.push(technique({
    id: "brass-spectrophotometry",
    title: "Brass Spectrophotometry",
    learningGoal: "Prepare a diluted brass sample and record absorbance evidence for copper percent analysis.",
    requiredEquipment: [
      "analytical-balance",
      "watch-glass",
      "sample-bottle",
      "volumetric-flask",
      "wash-bottle",
      "cuvette",
      "spectrophotometer",
      "data-collection-interface",
    ],
    initialEquipment: [
      equipment("watch-glass"),
      equipment("sample-bottle", "1", solution("Teacher-prepared dissolved brass sample", 50, 0.2, "M", "copper-blue-solution")),
      ...idsToEquipment(["analytical-balance", "volumetric-flask", "wash-bottle", "cuvette", "spectrophotometer", "data-collection-interface"]),
    ],
    actions,
    nodes: [
      node("weigh-brass-node", "Weigh brass", "Weigh the brass sample on the analytical balance.", "weigh-brass"),
      node("observe-dissolution-node", "Observe dissolution", "Record that nitric acid dissolution is complete before dilution.", "observe-dissolution", "observation"),
      node("transfer-brass-solution-node", "Transfer brass solution", "Pour the dissolved brass solution into the volumetric flask.", "transfer-brass-solution"),
      node("dilute-brass-solution-node", "Dilute brass solution", "Pour deionized water into the brass solution to the calibration mark.", "dilute-brass-solution"),
      node("transfer-brass-cuvette-node", "Fill cuvette", "Pour the diluted brass sample into the cuvette.", "transfer-brass-cuvette"),
      node("record-brass-absorbance-node", "Record absorbance", "Record absorbance for the diluted brass solution.", "record-brass-absorbance", "observation"),
      node("calculate-copper-percent-node", "Calculate copper percent", "Calculate copper percent from the calibration curve and brass mass.", "calculate-copper-percent", "calculation"),
    ],
    tags: ["spectrophotometry", "brass"],
  }));
}

{
  const actions = [
    withRuntime(action("measure-water-sample", "measureVolume", "Measure water sample", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "sample-volume",
      volumeMl: 20,
      tolerance: 0.2,
    }, "A 20 mL water sample is measured.", ["measureVolume", "measurement"]), {
      atomId: "atom.measure.variable-volume",
      equipmentRoleBindings: {
        "variable-volume-measuring-device": "graduated-cylinder",
        "liquid-source": "sample-bottle",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "sample-bottle",
        targetDefinitionId: "graduated-cylinder",
        valueParameter: "volumeMl",
        accessibleLabel: "Measure the 20 mL hard-water aliquot in the graduated cylinder.",
      },
    }),
    withRuntime(action("transfer-water-sample", "transfer", "Transfer water sample", {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "beaker-250ml",
      volumeMl: 20,
    }, "The water sample is in the reaction beaker."), {
      atomId: "atom.transfer.measured-liquid",
      equipmentRoleBindings: {
        "measured-solvent-source": "graduated-cylinder",
        "receiving-vessel": "beaker-250ml",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "graduated-cylinder",
        targetDefinitionId: "beaker-250ml",
        valueParameter: "volumeMl",
        accessibleLabel: "Transfer the measured aliquot to the reaction beaker.",
      },
      prerequisites: [measurementRequired("sample-volume", "The 20 mL sample aliquot is measured.")],
    }),
    withRuntime(action("add-carbonate-reagent", "transfer", "Add carbonate reagent", {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "beaker-250ml",
      volumeMl: 15,
      visualState: "cloudy-precipitate",
      configurationProvenance: "teacher-approved aliquot for complete precipitation",
    }, "Carbonate reagent is mixed into the water sample."), {
      atomId: "atom.transfer.precipitating-reagent",
      equipmentRoleBindings: {
        "precipitating-reagent-source": "reagent-bottle",
        "precipitation-vessel": "beaker-250ml",
        "stirring-device": "stirring-rod",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "reagent-bottle",
        targetDefinitionId: "beaker-250ml",
        valueParameter: "volumeMl",
        accessibleLabel: "Add the teacher-approved carbonate portion while stirring.",
      },
      prerequisites: [actionRequired("transfer-water-sample", "The measured sample is in the reaction beaker.")],
    }),
    withRuntime(action("establish-hard-water-precipitate", "precipitate", "Establish wet precipitate state", {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "beaker-250ml",
      finalVolumeMl: 35,
      precipitateSoluteSourceId: "hard-water-calcium-carbonate-equivalent",
      precipitateSubstance: "Calcium carbonate",
      precipitateSoluteId: "calcium-carbonate",
      evidenceProvenance: "mass derives from the teacher-configured simulated sample profile; not student measurement evidence",
    }, "A wet calcium carbonate suspension is available for filtration.", ["precipitate", "simulated-state"]), {
      atomId: "atom.precipitate.form-gravimetric-solid",
      equipmentRoleBindings: {
        "precipitation-vessel": "beaker-250ml",
        "precipitating-reagent-source": "reagent-bottle",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "reagent-bottle",
        targetDefinitionId: "beaker-250ml",
        accessibleLabel: "Represent the wet precipitate suspension after the approved carbonate addition.",
      },
      prerequisites: [actionRequired("add-carbonate-reagent", "The approved carbonate portion has been added.")],
    }),
    withRuntime(action("observe-precipitate", "observe", "Record precipitate observation", {
      tag: "hard-water-precipitate",
      note: "Describe the observed suspension; do not claim precipitation is complete from appearance alone.",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Observed precipitate and uncertainty",
      inputRequired: true,
    }, "Precipitate formation is recorded.", ["observe", "notebook", "student-observation"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the precipitate observation and any uncertainty.",
      },
      prerequisites: [actionRequired("establish-hard-water-precipitate", "The wet precipitate suspension is present.")],
    }),
    withRuntime(action("weigh-hard-water-filter-paper-tare", "weigh", "Weigh dry filter paper", {
      sourceDefinitionId: "filter-paper",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "hard-water-filter-paper-mass",
      expectedMassG: 0.246,
      tolerance: 0.001,
      evidenceProvenance: "teacher-configured simulated balance output",
    }, "The dry filter-paper tare is available."), {
      atomId: "atom.weigh.filter-medium-tare",
      equipmentRoleBindings: { "balance-instrument": "analytical-balance", "filter-medium": "filter-paper" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "filter-paper",
        targetDefinitionId: "analytical-balance",
        stationId: "analytical-balance",
        valueParameter: "measurementId",
        accessibleLabel: "Read the mass of the dry filter paper before seating it.",
      },
      prerequisites: [actionRequired("observe-precipitate", "The precipitation observation is recorded.")],
    }),
    withRuntime(action("record-hard-water-filter-paper-tare", "record", "Record filter-paper tare", {
      measurementId: "hard-water-filter-paper-mass",
      label: "Dry filter-paper tare",
      unit: "g",
      copyExistingMeasurementOnly: true,
    }, "The filter-paper tare is recorded.", ["record", "measurement"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Copy the dry filter-paper tare into the notebook.",
      },
      prerequisites: [measurementRequired("hard-water-filter-paper-mass", "The filter-paper mass has been read.")],
    }),
    withRuntime(action("place-hard-water-buchner", "place", "Place Buchner funnel", {
      equipmentDefinitionId: "buchner-funnel",
      location: "workbench",
    }, "The Buchner funnel is on the workbench."), {
      atomId: "atom.place.filtration-funnel",
      equipmentRoleBindings: { "filtration-funnel": "buchner-funnel" },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "buchner-funnel",
        stationId: "workbench",
        accessibleLabel: "Place the Buchner funnel on the workbench.",
      },
      prerequisites: [measurementRequired("hard-water-filter-paper-mass", "The dry filter-paper tare is recorded.")],
    }),
    withRuntime(action("seat-hard-water-filter-paper", "place", "Seat filter paper", {
      equipmentDefinitionId: "filter-paper",
      targetDefinitionId: "buchner-funnel",
      snapZoneId: "buchner-funnel-paper-seat",
    }, "The filter paper is seated flat in the funnel."), {
      atomId: "atom.place.filter-medium",
      equipmentRoleBindings: { "filtration-funnel": "buchner-funnel", "filter-medium": "filter-paper" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "filter-paper",
        targetDefinitionId: "buchner-funnel",
        snapZoneId: "buchner-funnel-paper-seat",
        accessibleLabel: "Seat the filter paper flat on the Buchner funnel plate.",
      },
      prerequisites: [actionRequired("place-hard-water-buchner", "The Buchner funnel is placed.")],
    }),
    withRuntime(action("attach-hard-water-filter-flask", "place", "Attach side-arm receiver", {
      equipmentDefinitionId: "side-arm-filter-flask",
      targetDefinitionId: "buchner-funnel",
      snapZoneId: "buchner-funnel-receiver-neck",
    }, "The side-arm flask is aligned beneath the funnel."), {
      atomId: "atom.place.filtration-receiver",
      equipmentRoleBindings: { "filtration-receiver": "side-arm-filter-flask" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "side-arm-filter-flask",
        targetDefinitionId: "buchner-funnel",
        snapZoneId: "buchner-funnel-receiver-neck",
        accessibleLabel: "Attach the side-arm flask beneath the Buchner funnel.",
      },
      prerequisites: [actionRequired("place-hard-water-buchner", "The Buchner funnel is placed.")],
    }),
    withRuntime(action("place-hard-water-vacuum", "place", "Place vacuum source", {
      equipmentDefinitionId: "vacuum-source",
      location: "workbench",
    }, "The vacuum source is beside the side-arm flask."), {
      atomId: "atom.place.filtration-vacuum-source",
      equipmentRoleBindings: {
        "filtration-vacuum-source": "vacuum-source",
        "filtration-receiver": "side-arm-filter-flask",
      },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "vacuum-source",
        stationId: "workbench",
        accessibleLabel: "Place the vacuum source beside the side-arm filter flask.",
      },
      prerequisites: [actionRequired("attach-hard-water-filter-flask", "The side-arm receiver is attached.")],
    }),
    withRuntime(action("wet-hard-water-filter-paper", "rinse", "Wet and seal filter paper", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "filter-paper",
      rinseType: "pre-wet",
      volumeMl: 5,
    }, "The filter paper is wetted and sealed."), {
      atomId: "atom.rinse.wet-filter-medium",
      equipmentRoleBindings: { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" },
      interaction: {
        type: "rinseTarget",
        sourceDefinitionId: "wash-bottle",
        targetDefinitionId: "filter-paper",
        valueParameter: "volumeMl",
        accessibleLabel: "Wet the seated filter paper with deionized water.",
      },
      prerequisites: [
        actionRequired("seat-hard-water-filter-paper", "The paper is seated."),
        actionRequired("attach-hard-water-filter-flask", "The receiver is attached."),
      ],
    }),
    withRuntime(action("filter-hard-water-mixture", "filter", "Filter hard-water suspension", {
      sourceDefinitionId: "beaker-250ml",
      targetDefinitionId: "buchner-funnel",
      retainedVisualState: "filter-cake",
      filtrateVisualState: "clear-filtrate",
    }, "The precipitate is retained on the filter paper."), {
      atomId: "atom.filter.pour-through-medium",
      equipmentRoleBindings: { "mixture-source": "beaker-250ml", "filtration-funnel": "buchner-funnel" },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "beaker-250ml",
        targetDefinitionId: "buchner-funnel",
        accessibleLabel: "Pour the suspension slowly through the prepared Buchner funnel.",
      },
      prerequisites: [
        actionRequired("wet-hard-water-filter-paper", "The paper is wetted and sealed."),
        actionRequired("place-hard-water-vacuum", "The vacuum source is placed."),
      ],
    }),
    withRuntime(action("rinse-precipitate", "rinse", "Wash collected precipitate", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "buchner-funnel",
      rinseType: "precipitate",
      volumeMl: 5,
    }, "The collected precipitate is washed."), {
      atomId: "atom.rinse.wash-precipitate",
      equipmentRoleBindings: { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" },
      interaction: {
        type: "rinseTarget",
        sourceDefinitionId: "wash-bottle",
        targetDefinitionId: "buchner-funnel",
        valueParameter: "volumeMl",
        accessibleLabel: "Wash the collected precipitate with a small amount of deionized water.",
      },
      prerequisites: [actionRequired("filter-hard-water-mixture", "The suspension has been filtered.")],
    }),
    withRuntime(action("weigh-hard-water-watch-glass-tare", "weigh", "Weigh dry watch glass", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "hard-water-watch-glass-mass",
      expectedMassG: 33.42,
      tolerance: 0.001,
      evidenceProvenance: "teacher-configured simulated balance output",
    }, "The dry watch-glass tare is available."), {
      atomId: "atom.weigh.tare-vessel",
      equipmentRoleBindings: { "balance-instrument": "analytical-balance", "weighed-vessel": "watch-glass" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        stationId: "analytical-balance",
        valueParameter: "measurementId",
        accessibleLabel: "Read the mass of the clean, dry watch glass.",
      },
      prerequisites: [actionRequired("rinse-precipitate", "The precipitate has been washed.")],
    }),
    withRuntime(action("record-hard-water-watch-glass-tare", "record", "Record watch-glass tare", {
      measurementId: "hard-water-watch-glass-mass",
      label: "Dry watch-glass tare",
      unit: "g",
      copyExistingMeasurementOnly: true,
    }, "The watch-glass tare is recorded.", ["record", "measurement"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Copy the dry watch-glass tare into the notebook.",
      },
      prerequisites: [measurementRequired("hard-water-watch-glass-mass", "The watch-glass mass has been read.")],
    }),
    withRuntime(action("transfer-hard-water-paper-to-watch", "place", "Transfer paper and precipitate", {
      equipmentDefinitionId: "filter-paper",
      targetDefinitionId: "watch-glass",
      snapZoneId: "watch-glass-paper-seat",
      detachBeforeAttach: true,
    }, "The paper and precipitate are on the tared watch glass."), {
      atomId: "atom.place.transfer-medium-to-drying-vessel",
      equipmentRoleBindings: { "filter-medium": "filter-paper", "dried-assembly": "watch-glass" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "filter-paper",
        targetDefinitionId: "watch-glass",
        snapZoneId: "watch-glass-paper-seat",
        accessibleLabel: "Transfer the filter paper and precipitate to the tared watch glass.",
      },
      prerequisites: [measurementRequired("hard-water-watch-glass-mass", "The watch-glass tare is recorded.")],
    }),
    withRuntime(action("first-hard-water-drying", "dry", "Complete first drying stage", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "watch-glass",
      ovenDefinitionId: "drying-oven",
      precipitateSourceInstanceId: "filter-paper-1",
      dryMassG: 0.0075,
      drynessResult: "damp",
      temperatureC: 115,
      durationMinutes: 12,
      visualState: "partially-dry-precipitate",
      temperatureProvenance: "teacher-configured within 110-120 C",
      durationProvenance: "teacher-configured within 10-15 minutes",
    }, "The first drying stage is complete."), {
      atomId: "atom.dry.oven-stage",
      equipmentRoleBindings: { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass" },
      interaction: {
        type: "placeInInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "drying-oven",
        stationId: "drying-oven",
        accessibleLabel: "Place the watch-glass assembly in the teacher-configured oven for the first drying stage.",
      },
      prerequisites: [actionRequired("transfer-hard-water-paper-to-watch", "The paper and solid are on the watch glass.")],
    }),
    withRuntime(action("break-hard-water-precipitate", "observe", "Break precipitate into small pieces", {
      tag: "hard-water-breakup",
      note: "Break the partly dried precipitate into small pieces with the approved metal scoop before returning it to the oven.",
      inputMode: "choice",
      inputRole: "studentResponse",
      inputLabel: "Precipitate breakup",
      inputOptions: ["Broken into small pieces"],
    }, "The precipitate breakup is recorded.", ["observe", "notebook", "manipulation"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Confirm the precipitate was broken into small pieces.",
      },
      prerequisites: [actionRequired("first-hard-water-drying", "The first drying stage is complete.")],
    }),
    withRuntime(action("second-hard-water-drying", "dry", "Complete second drying stage", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "watch-glass",
      ovenDefinitionId: "drying-oven",
      precipitateSourceInstanceId: "filter-paper-1",
      dryMassG: 0.0075,
      drynessResult: "dry",
      temperatureC: 115,
      durationMinutes: 5,
      visualState: "broken-dry-precipitate",
      temperatureProvenance: "teacher-configured within 110-120 C",
    }, "The second drying stage is complete."), {
      atomId: "atom.dry.oven-stage",
      equipmentRoleBindings: { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass" },
      interaction: {
        type: "placeInInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "drying-oven",
        stationId: "drying-oven",
        accessibleLabel: "Return the broken precipitate assembly to the oven for five minutes.",
      },
      prerequisites: [notebookRequired("hard-water-breakup", "The precipitate was broken into small pieces.")],
    }),
    withRuntime(action("cool-hard-water-assembly", "cool", "Cool dried assembly", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "crucible-tongs",
      cooledTemperatureC: 25,
      cooledObjectLabel: "watch-glass, paper, and precipitate assembly",
      visualState: "cooled-dry-precipitate",
    }, "The dried assembly has cooled before weighing."), {
      atomId: "atom.cool.before-weighing",
      equipmentRoleBindings: { "dried-assembly": "watch-glass", "cooling-tool": "crucible-tongs" },
      interaction: {
        type: "placeInInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "crucible-tongs",
        stationId: "crucible-tongs",
        accessibleLabel: "Use heat-safe handling and set the dried assembly aside to cool.",
      },
      prerequisites: [actionRequired("second-hard-water-drying", "The second drying stage is complete.")],
    }),
    withRuntime(action("weigh-hard-water-combined", "weigh", "Read cooled combined mass", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "hard-water-combined-mass",
      expectedMassG: 33.6735,
      requiresDryPrecipitate: true,
      maxSafeTemperatureC: 40,
      tolerance: 0.001,
      evidenceProvenance: "teacher-configured simulated balance output",
    }, "The cooled combined mass is available."), {
      atomId: "atom.weigh.dry-assembly",
      equipmentRoleBindings: { "balance-instrument": "analytical-balance", "dried-assembly": "watch-glass" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        stationId: "analytical-balance",
        valueParameter: "measurementId",
        accessibleLabel: "Read the cooled combined mass on the analytical balance.",
      },
      prerequisites: [
        actionRequired("cool-hard-water-assembly", "The assembly has cooled."),
        measurementRequired("hard-water-watch-glass-mass", "The watch-glass tare is recorded."),
        measurementRequired("hard-water-filter-paper-mass", "The filter-paper tare is recorded."),
      ],
    }),
    withRuntime(action("record-hard-water-combined", "record", "Record cooled combined mass", {
      measurementId: "hard-water-combined-mass",
      label: "Cooled watch glass, filter paper, and precipitate mass",
      unit: "g",
      copyExistingMeasurementOnly: true,
    }, "The cooled combined mass is recorded.", ["record", "measurement"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Copy the cooled combined mass into the notebook.",
      },
      prerequisites: [measurementRequired("hard-water-combined-mass", "The combined mass has been read.")],
    }),
    withRuntime(action("calculate-hard-water-precipitate-mass", "calculate", "Calculate collected precipitate mass", {
      calculationId: "hard-water-precipitate-mass",
      template: "gravimetricPrecipitateMass",
      combinedMassMeasurementId: "hard-water-combined-mass",
      watchGlassMassMeasurementId: "hard-water-watch-glass-mass",
      filterPaperMassMeasurementId: "hard-water-filter-paper-mass",
      tolerance: 0.001,
      requireStudentValue: true,
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Collected precipitate mass",
      inputMin: 0,
      inputStep: 0.0001,
      unit: "g",
    }, "Collected precipitate mass is calculated.", ["calculate", "measurement-derived"]), {
      interaction: {
        type: "submitCalculation",
        valueParameter: "calculationId",
        accessibleLabel: "Subtract both the watch-glass and filter-paper tares from the cooled combined mass.",
      },
      prerequisites: [
        measurementRequired("hard-water-watch-glass-mass", "The watch-glass tare is recorded."),
        measurementRequired("hard-water-filter-paper-mass", "The filter-paper tare is recorded."),
        measurementRequired("hard-water-combined-mass", "The cooled combined mass is recorded."),
      ],
    }),
    withRuntime(action("calculate-hardness", "calculate", "Calculate water hardness", {
      calculationId: "hardness-mg-l",
      template: "hardnessMgLAsCaCO3",
      sampleVolumeMeasurementId: "sample-volume",
      precipitateMassCalculationId: "hard-water-precipitate-mass",
      requireStudentValue: true,
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Hardness as CaCO3",
      inputMin: 0,
      inputStep: 1,
      unit: "mg/L as CaCO3",
      tolerance: 5,
    }, "Water hardness is calculated from measured evidence.", ["calculate", "measurement-derived"]), {
      interaction: {
        type: "submitCalculation",
        valueParameter: "calculationId",
        accessibleLabel: "Calculate hardness from the measured sample volume and calculated precipitate mass.",
      },
      prerequisites: [measurementRequired("sample-volume", "The sample volume is recorded.")],
    }),
  ];
  definitions.push(technique({
    id: "hard-water-gravimetry",
    title: "Hard Water Gravimetry",
    learningGoal: "Precipitate, filter, dry, and weigh calcium carbonate to calculate water hardness.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "beaker-250ml",
      "reagent-bottle",
      "stirring-rod",
      "buchner-funnel",
      "side-arm-filter-flask",
      "vacuum-source",
      "filter-paper",
      "wash-bottle",
      "drying-oven",
      "watch-glass",
      "analytical-balance",
      "crucible-tongs",
      "permanent-marker",
    ],
    initialEquipment: [
      equipment("sample-bottle", "1", {
        ...liquid("Teacher-configured 20 mL hard-water sample", 20),
        solutes: [{
          id: "hard-water-calcium-carbonate-equivalent",
          label: "Calcium carbonate equivalent",
          amount: 0.0075,
          unit: "g",
        }],
      }),
      equipment("reagent-bottle", "1", solution("Sodium carbonate reagent", 50, 0.5, "M")),
      ...idsToEquipment([
        "graduated-cylinder",
        "beaker-250ml",
        "stirring-rod",
        "buchner-funnel",
        "side-arm-filter-flask",
        "vacuum-source",
        "filter-paper",
        "wash-bottle",
        "drying-oven",
        "watch-glass",
        "analytical-balance",
        "crucible-tongs",
        "permanent-marker",
      ]),
    ],
    actions,
    nodes: [
      node("measure-water-sample-node", "Measure water sample", "Pour 20 mL of water sample into the graduated cylinder.", "measure-water-sample"),
      node("transfer-water-sample-node", "Transfer water sample", "Pour the water sample into the reaction beaker.", "transfer-water-sample"),
      node("add-carbonate-reagent-node", "Add carbonate reagent", "Pour carbonate reagent into the water sample while stirring.", "add-carbonate-reagent"),
      node("establish-hard-water-precipitate-node", "Establish wet precipitate", "Represent the wet calcium carbonate suspension for filtration.", "establish-hard-water-precipitate"),
      node("observe-precipitate-node", "Observe precipitate", "Record the precipitate formed in the hard water sample.", "observe-precipitate", "observation"),
      node("weigh-hard-water-filter-paper-tare-node", "Read filter-paper tare", "Read the dry filter-paper mass before seating it.", "weigh-hard-water-filter-paper-tare"),
      node("record-hard-water-filter-paper-tare-node", "Record filter-paper tare", "Copy the dry filter-paper tare into the notebook.", "record-hard-water-filter-paper-tare", "observation"),
      node("place-hard-water-buchner-node", "Place funnel", "Place the Buchner funnel on the workbench.", "place-hard-water-buchner"),
      node("seat-hard-water-filter-paper-node", "Seat filter paper", "Seat the filter paper flat in the funnel.", "seat-hard-water-filter-paper"),
      node("attach-hard-water-filter-flask-node", "Attach receiver", "Attach the side-arm receiver beneath the funnel.", "attach-hard-water-filter-flask"),
      node("place-hard-water-vacuum-node", "Place vacuum source", "Place the vacuum source beside the filter flask.", "place-hard-water-vacuum"),
      node("wet-hard-water-filter-paper-node", "Wet filter paper", "Wet and seal the seated filter paper.", "wet-hard-water-filter-paper"),
      node("filter-hard-water-mixture-node", "Filter suspension", "Pour the suspension through the prepared apparatus.", "filter-hard-water-mixture"),
      node("rinse-precipitate-node", "Wash precipitate", "Wash the collected precipitate with a small water portion.", "rinse-precipitate"),
      node("weigh-hard-water-watch-glass-tare-node", "Read watch-glass tare", "Read the clean, dry watch-glass mass.", "weigh-hard-water-watch-glass-tare"),
      node("record-hard-water-watch-glass-tare-node", "Record watch-glass tare", "Copy the watch-glass mass into the notebook.", "record-hard-water-watch-glass-tare", "observation"),
      node("transfer-hard-water-paper-to-watch-node", "Transfer collected solid", "Move the filter paper and precipitate to the tared watch glass.", "transfer-hard-water-paper-to-watch"),
      node("first-hard-water-drying-node", "First drying stage", "Dry the assembly for the teacher-configured 10-15 minute stage.", "first-hard-water-drying"),
      node("break-hard-water-precipitate-node", "Break precipitate", "Break the partly dried precipitate into small pieces.", "break-hard-water-precipitate", "checkpoint"),
      node("second-hard-water-drying-node", "Second drying stage", "Return the assembly to the oven for five minutes.", "second-hard-water-drying"),
      node("cool-hard-water-assembly-node", "Cool assembly", "Set the dried assembly aside until safe to weigh.", "cool-hard-water-assembly"),
      node("weigh-hard-water-combined-node", "Read combined mass", "Read the cooled watch-glass, paper, and precipitate mass.", "weigh-hard-water-combined"),
      node("record-hard-water-combined-node", "Record combined mass", "Copy the cooled combined mass into the notebook.", "record-hard-water-combined", "observation"),
      node("calculate-hard-water-precipitate-mass-node", "Calculate precipitate mass", "Calculate collected precipitate mass by difference.", "calculate-hard-water-precipitate-mass", "calculation"),
      node("calculate-hardness-node", "Calculate hardness", "Calculate hardness in mg/L as CaCO3 from sample volume and precipitate mass.", "calculate-hardness", "calculation"),
    ],
    tags: ["gravimetry", "hard-water"],
    version: "1.1.0",
    definitionUpdatedAt: "2026-08-12T00:00:00.000Z",
  }));
}

{
  const actions = [
    action("place-ring-stand", "place", "Place burette stand", {
      equipmentDefinitionId: "ring-stand-clamp",
      location: "workbench",
    }, "The ring stand and clamp are ready."),
    action("measure-acid", "measureVolume", "Measure acid aliquot", {
      sourceDefinitionId: "unknown-acid-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "acid-aliquot-volume",
      volumeMl: 25,
      tolerance: 0.2,
    }, "The acid aliquot volume is measured.", ["measureVolume", "measurement"]),
    action("transfer-acid-flask", "transfer", "Transfer acid to flask", {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      volumeMl: 25,
    }, "The acid aliquot is in the Erlenmeyer flask."),
    action("add-indicator", "transfer", "Add indicator", {
      sourceDefinitionId: "phenolphthalein-dropper",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      volumeMl: 0.1,
    }, "Indicator is added to the acid sample."),
    action("fill-burette", "transfer", "Fill burette", {
      sourceDefinitionId: "naoh-bottle",
      targetDefinitionId: "burette-50ml",
      volumeMl: 45,
    }, "The burette is filled with sodium hydroxide."),
    action("record-initial-burette", "record", "Record initial burette", {
      measurementId: "burette-initial-volume",
      label: "Initial burette reading",
      value: 0.12,
      unit: "mL",
    }, "Initial burette reading is recorded.", ["record", "measurement"]),
    action("deliver-titrant", "transfer", "Deliver titrant", {
      sourceDefinitionId: "burette-50ml",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      volumeMl: 23.62,
    }, "Titrant is delivered to the endpoint."),
    action("record-final-burette", "record", "Record final burette", {
      measurementId: "burette-final-volume",
      label: "Final burette reading",
      value: 23.74,
      unit: "mL",
    }, "Final burette reading is recorded.", ["record", "measurement"]),
    action("calculate-acid-molarity", "calculate", "Calculate acid molarity", {
      calculationId: "acid-molarity",
      template: "acidBaseMolarity",
      analyteVolumeMeasurementId: "acid-aliquot-volume",
      initialBuretteMeasurementId: "burette-initial-volume",
      finalBuretteMeasurementId: "burette-final-volume",
      titrantMolarity: 0.1,
      expected: 0.0945,
      tolerance: 0.005,
    }, "Acid molarity is calculated.", ["calculate"]),
  ];
  definitions.push(technique({
    id: "titration-endpoint",
    title: "Titration Endpoint",
    learningGoal: "Assemble a titration setup, record burette evidence, and calculate acid molarity.",
    requiredEquipment: [
      "unknown-acid-bottle",
      "graduated-cylinder",
      "erlenmeyer-flask-250ml",
      "phenolphthalein-dropper",
      "naoh-bottle",
      "burette-50ml",
      "ring-stand-clamp",
      "waste-beaker",
    ],
    initialEquipment: [
      equipment("unknown-acid-bottle", "1", solution("Unknown acid", 100, 0.1, "M")),
      equipment("naoh-bottle", "1", solution("Standard sodium hydroxide", 250, 0.1, "M")),
      equipment("phenolphthalein-dropper", "1", liquid("Phenolphthalein indicator", 30)),
      ...idsToEquipment(["graduated-cylinder", "erlenmeyer-flask-250ml", "burette-50ml", "ring-stand-clamp", "waste-beaker"]),
    ],
    actions,
    nodes: [
      node("place-ring-stand-node", "Place burette stand", "Place the ring stand and burette clamp on the workbench.", "place-ring-stand"),
      node("measure-acid-node", "Measure acid", "Pour 25 mL of unknown acid into the graduated cylinder.", "measure-acid"),
      node("transfer-acid-flask-node", "Transfer acid", "Pour the acid aliquot into the Erlenmeyer flask.", "transfer-acid-flask"),
      node("add-indicator-node", "Add indicator", "Add phenolphthalein indicator to the acid sample.", "add-indicator"),
      node("fill-burette-node", "Fill burette", "Pour sodium hydroxide into the burette.", "fill-burette"),
      node("record-initial-burette-node", "Record initial burette", "Record the initial burette reading.", "record-initial-burette", "observation"),
      node("deliver-titrant-node", "Deliver titrant", "Pour titrant from the burette into the flask to the endpoint.", "deliver-titrant"),
      node("record-final-burette-node", "Record final burette", "Record the final burette reading.", "record-final-burette", "observation"),
      node("calculate-acid-molarity-node", "Calculate molarity", "Calculate acid molarity from the delivered titrant volume.", "calculate-acid-molarity", "calculation"),
    ],
    tags: ["titration", "acid-base"],
  }));
}

{
  const actions = [
    // K-04 (M): inspect appearance before any destructive test.
    withRuntime(action("inspect-solid-appearance", "observe", "Inspect solid appearance", {
      sourceDefinitionId: "small-vial",
      sourceInstanceId: "small-vial-1",
      note: "Inspect color, crystal form, luster, and visible heterogeneity before testing.",
      readingProvenance: "student-observed",
    }, "The solid's visible appearance is inspected.", ["observe", "visual-read"]), {
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "small-vial",
        stationId: "workbench",
        accessibleLabel: "Inspect the unknown solid's visible appearance before testing.",
      },
      prerequisites: [],
    }),
    // K-05 (M): record the appearance evidence after the visual read.
    withRuntime(action("record-solid-appearance", "record", "Record solid appearance", {
      tag: "solid-appearance",
      note: "Record appearance before any destructive test: color, crystal form, luster, and uncertainty.",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Appearance evidence",
      inputRequired: true,
    }, "Solid appearance is recorded.", ["record", "notebook", "student-observation"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the unknown solid's appearance before testing.",
      },
      prerequisites: [actionRequired("inspect-solid-appearance", "The solid's appearance was inspected.")],
    }),
    // K-01 (R): label the fresh aqueous-test location before transferring its microsample.
    withRuntime(action("label-aqueous-test-location", "observe", "Label aqueous test location", {
      tag: "aqueous-test-location,label",
      note: "Record the assigned sample/test-line label for the fresh aqueous-test location before transferring a microsample. Preserve the blind identity; do not infer or reveal a chemical identity.",
      inputKey: "bonding-aqueous-test-location-label",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Assigned aqueous test-location label",
      inputRequired: true,
    }, "The aqueous test-location label is recorded.", ["observe", "notebook", "label", "aqueous-test-location"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the assigned label for the fresh aqueous test location before transferring a microsample.",
      },
      prerequisites: [actionRequired("record-solid-appearance", "Appearance evidence is recorded.")],
    }),
    // K-02 (R/C): use a fresh, teacher-approved microsample for this test branch.
    withRuntime(action("dispense-aqueous-microsample", "transfer", "Dispense aqueous-test microsample", {
      sourceDefinitionId: "small-vial",
      sourceInstanceId: "small-vial-1",
      targetDefinitionId: "test-tube",
      targetInstanceId: "test-tube-1",
      massG: 0.05,
      amountProvenance: "teacher-configuration",
      visualState: "granular-solid",
      configurationParameter: "massG",
      configurationRequired: true,
      unlocked: false,
      inputKey: "bondingMicrosampleMassG",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher-approved microsample mass",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.01,
      unit: "g",
    }, "A fresh microsample is in the aqueous test tube."), {
      atomId: "atom.transfer.microsample-portion",
      equipmentRoleBindings: {
        "sample-source": "small-vial",
        "bonding-test-vessel": "test-tube",
        "solid-transfer-tool": "spatula",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "small-vial",
        targetDefinitionId: "test-tube",
        valueParameter: "massG",
        accessibleLabel: "Dispense a fresh teacher-approved microsample into the aqueous test tube.",
      },
      prerequisites: [actionRequired("label-aqueous-test-location", "The aqueous test location is labelled.")],
    }),
    // K-03 (M/C): apply the teacher-approved water amount to the aqueous-test portion.
    withRuntime(action("test-water-solubility", "transfer", "Apply water to microsample", {
      sourceDefinitionId: "distilled-water-bottle",
      sourceInstanceId: "distilled-water-bottle-1",
      targetDefinitionId: "test-tube",
      targetInstanceId: "test-tube-1",
      volumeMl: 2,
      volumeProvenance: "teacher-configuration",
      configurationParameter: "volumeMl",
      configurationRequired: true,
      unlocked: false,
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher-approved water volume",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.1,
      unit: "mL",
    }, "Water is applied to the fresh microsample."), {
      atomId: "atom.transfer.apply-test-solvent",
      equipmentRoleBindings: {
        "bonding-test-solvent-source": "distilled-water-bottle",
        "bonding-test-vessel": "test-tube",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "distilled-water-bottle",
        targetDefinitionId: "test-tube",
        valueParameter: "volumeMl",
        accessibleLabel: "Apply the teacher-approved water amount to the aqueous-test microsample.",
      },
      prerequisites: [actionRequired("dispense-aqueous-microsample", "A fresh aqueous-test microsample is present.")],
    }),
    // K-04 (M): inspect the aqueous-test mixture after applying water.
    withRuntime(action("inspect-water-solubility", "observe", "Inspect water solubility", {
      sourceDefinitionId: "test-tube",
      sourceInstanceId: "test-tube-1",
      note: "Inspect whether solid remains, dissolves, or gives an ambiguous intermediate state without inferring bonding type.",
      readingProvenance: "student-observed",
    }, "The aqueous-test mixture is inspected.", ["observe", "visual-read"]), {
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "test-tube",
        stationId: "workbench",
        accessibleLabel: "Inspect the aqueous-test mixture for visible solubility evidence.",
      },
      prerequisites: [actionRequired("test-water-solubility", "Water was applied to the microsample.")],
    }),
    // K-05 (M): record the solubility evidence after the visual read.
    withRuntime(action("record-water-solubility", "record", "Record water solubility", {
      tag: "water-solubility",
      note: "Record soluble, partially soluble, or insoluble, plus time and anomalies; do not infer bonding type yet.",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Water-solubility evidence",
      inputRequired: true,
    }, "Solubility evidence is recorded.", ["record", "notebook", "student-observation"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the water-solubility observation without adding a new test action.",
      },
      prerequisites: [actionRequired("inspect-water-solubility", "The aqueous-test mixture was inspected.")],
    }),
    // K-04 (M): read the conductivity test as its own instrument action.
    withRuntime(action("read-aqueous-conductivity", "observe", "Read aqueous conductivity", {
      sourceDefinitionId: "test-tube",
      sourceInstanceId: "test-tube-1",
      targetDefinitionId: "conductivity-tester",
      note: "Read only an aqueous test mixture. If no solution exists, record no-aqueous-sample rather than inventing a value.",
      readingProvenance: "student-measured",
    }, "The conductivity tester is read against the aqueous test mixture."), {
      atomId: "atom.observe.read-aqueous-conductivity",
      equipmentRoleBindings: {
        "immersed-probe-instrument": "conductivity-tester",
        "bonding-test-vessel": "test-tube",
      },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "test-tube",
        targetDefinitionId: "conductivity-tester",
        stationId: "conductivity-tester",
        accessibleLabel: "Read the conductivity tester against the aqueous test mixture.",
      },
      prerequisites: [
        actionRequired("test-water-solubility", "Water has been applied to the aqueous-test microsample."),
        actionRequired("record-water-solubility", "Solubility evidence is recorded."),
      ],
    }),
    // K-05 (M): record the conductivity evidence only after the read action.
    withRuntime(action("record-aqueous-conductivity", "observe", "Record aqueous conductivity", {
      tag: "aqueous-conductivity",
      note: "Record the reading with units or the approved category; record insoluble/no-aqueous-sample when appropriate.",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Conductivity evidence",
      inputRequired: true,
    }, "Aqueous conductivity evidence is recorded.", ["observe", "notebook", "student-observation"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the conductivity reading or approved category.",
      },
      prerequisites: [actionRequired("read-aqueous-conductivity", "The aqueous conductivity test was read.")],
    }),
    // K-01 (R): label the fresh dry-test location before transferring its microsample.
    withRuntime(action("label-dry-test-location", "observe", "Label dry test location", {
      tag: "dry-test-location,label",
      note: "Record the assigned sample/test-line label for the fresh dry-test location before transferring a microsample. Preserve the blind identity; do not infer or reveal a chemical identity.",
      inputKey: "bonding-dry-test-location-label",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Assigned dry test-location label",
      inputRequired: true,
    }, "The dry test-location label is recorded.", ["observe", "notebook", "label", "dry-test-location"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the assigned label for the fresh dry test location before transferring a microsample.",
      },
      prerequisites: [actionRequired("record-aqueous-conductivity", "Aqueous conductivity evidence is recorded.")],
    }),
    // K-02 (R/C): use a second fresh, teacher-approved microsample for dry tests.
    withRuntime(action("dispense-dry-microsample", "transfer", "Dispense dry-test microsample", {
      sourceDefinitionId: "small-vial",
      sourceInstanceId: "small-vial-1",
      targetDefinitionId: "test-tube",
      targetInstanceId: "test-tube-2",
      massG: 0.05,
      amountProvenance: "teacher-configuration",
      visualState: "granular-solid",
      configurationParameter: "massG",
      configurationRequired: true,
      unlocked: false,
      inputKey: "bondingMicrosampleMassG",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher-approved microsample mass",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.01,
      unit: "g",
    }, "A fresh microsample is in the dry test tube."), {
      atomId: "atom.transfer.microsample-portion",
      equipmentRoleBindings: {
        "sample-source": "small-vial",
        "bonding-test-vessel": "test-tube",
        "solid-transfer-tool": "spatula",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "small-vial",
        targetDefinitionId: "test-tube",
        valueParameter: "massG",
        accessibleLabel: "Dispense a separate dry microsample for magnetic and melting tests.",
      },
      prerequisites: [actionRequired("label-dry-test-location", "The dry test location is labelled.")],
    }),
    // K-04 (M): apply the magnetic test without combining it with the evidence record.
    withRuntime(action("test-magnetic-response", "observe", "Test magnetic response", {
      sourceDefinitionId: "test-tube",
      sourceInstanceId: "test-tube-2",
      targetDefinitionId: "magnet",
      note: "Bring the magnet near the contained dry microsample without touching or mixing it.",
      readingProvenance: "student-observed",
    }, "The magnetic response is observed."), {
      atomId: "atom.observe.test-magnetic-response",
      equipmentRoleBindings: { "magnetic-response-tool": "magnet", "bonding-test-vessel": "test-tube" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "test-tube",
        targetDefinitionId: "magnet",
        stationId: "magnet",
        accessibleLabel: "Bring the magnet near the contained dry microsample.",
      },
      prerequisites: [actionRequired("dispense-dry-microsample", "A fresh dry microsample is present.")],
    }),
    // K-05 (M): record the magnetic response after the physical test.
    withRuntime(action("record-magnetic-response", "observe", "Record magnetic response", {
      tag: "magnetism",
      note: "Record attraction, no attraction, or ambiguous response without forcing a bonding classification.",
      inputMode: "choice",
      inputRole: "studentResponse",
      inputLabel: "Magnetic response",
      inputOptions: ["Attraction", "No attraction", "Ambiguous"],
    }, "Magnetic-response evidence is recorded.", ["observe", "notebook", "student-observation"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the magnetic response.",
      },
      prerequisites: [actionRequired("test-magnetic-response", "The magnetic response was tested.")],
    }),
    // K-03 (M/C): stage the sample only after the teacher approves the local melting method.
    withRuntime(action("stage-melting-sample", "place", "Stage melting-test microsample", {
      equipmentDefinitionId: "test-tube",
      equipmentInstanceId: "test-tube-2",
      sourceDefinitionId: "test-tube",
      sourceInstanceId: "test-tube-2",
      targetDefinitionId: "melting-point-apparatus",
      methodProvenance: "teacher-configured",
      configurationRequired: true,
      unlocked: false,
      inputMode: "choice",
      inputRole: "teacherConfiguration",
      inputLabel: "Melting-method approval",
      inputOptions: ["Teacher approved"],
    }, "The dry microsample is staged at the melting-point apparatus."), {
      atomId: "atom.place.melting-point-sample",
      equipmentRoleBindings: {
        "melting-point-instrument": "melting-point-apparatus",
        "bonding-test-vessel": "test-tube",
      },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "test-tube",
        stationId: "melting-point-apparatus",
        accessibleLabel: "Stage the dry microsample at the melting-point apparatus.",
      },
      prerequisites: [actionRequired("record-magnetic-response", "Magnetic evidence is recorded before destructive testing.")],
    }),
    // K-04 (M): read melting behavior separately from recording it.
    withRuntime(action("read-melting-behavior", "observe", "Read melting behavior", {
      sourceDefinitionId: "test-tube",
      sourceInstanceId: "test-tube-2",
      targetDefinitionId: "melting-point-apparatus",
      note: "Use the teacher-approved method and read raw temperature, high/low category, decomposition, or no melt.",
      readingProvenance: "student-measured",
    }, "Melting behavior is read at the apparatus."), {
      atomId: "atom.observe.read-melting-behavior",
      equipmentRoleBindings: {
        "melting-point-instrument": "melting-point-apparatus",
        "bonding-test-vessel": "test-tube",
      },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "test-tube",
        targetDefinitionId: "melting-point-apparatus",
        stationId: "melting-point-apparatus",
        accessibleLabel: "Read the staged microsample at the melting-point apparatus.",
      },
      prerequisites: [actionRequired("stage-melting-sample", "The microsample is staged at the apparatus.")],
    }),
    // K-05 (M): record the melting evidence after the apparatus read.
    withRuntime(action("record-melting-behavior", "observe", "Record melting behavior", {
      tag: "melting-behavior",
      note: "Record the raw temperature or approved category, including decomposition or no melt when observed.",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Melting evidence",
      inputRequired: true,
    }, "Melting-behavior evidence is recorded.", ["observe", "notebook", "student-observation"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record the melting behavior read at the apparatus.",
      },
      prerequisites: [actionRequired("read-melting-behavior", "Melting behavior was read at the apparatus.")],
    }),
    // U-02/K-05 (M): synthesize a claim only from the completed evidence pattern.
    withRuntime(action("record-bonding-classification", "observe", "Record evidence-based classification", {
      tag: "bonding-classification",
      note: "Classify the unknown from the complete evidence pattern and state uncertainty or conflicting evidence.",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: "Classification, evidence, and uncertainty",
      inputRequired: true,
    }, "Bonding classification evidence is recorded.", ["observe", "notebook", "student-claim"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Record a classification supported by the collected evidence and uncertainty.",
      },
      prerequisites: [actionRequired("record-melting-behavior", "Melting evidence is recorded.")],
    }),
  ];
  definitions.push(technique({
    id: "bonding-solids-tests",
    title: "Bonding Solids Tests",
    learningGoal: "Collect appearance, solubility, conductivity, melting, and magnetism evidence for unknown solids.",
    requiredEquipment: [
      "small-vial",
      "reagent-tray",
      "conductivity-tester",
      "melting-point-apparatus",
      "hot-plate-stirrer",
      "spatula",
      "watch-glass",
      "magnet",
      "test-tube",
      "distilled-water-bottle",
      "ph-paper",
    ],
    initialEquipment: [
      equipment("small-vial", "1", solid("Unknown solid", 1)),
      equipment("distilled-water-bottle", "1", liquid("Distilled water", 500)),
      equipment("test-tube", "1"),
      equipment("test-tube", "2"),
      ...idsToEquipment(["reagent-tray", "conductivity-tester", "melting-point-apparatus", "hot-plate-stirrer", "spatula", "watch-glass", "magnet", "ph-paper"]),
    ],
    actions,
    nodes: [
      node("inspect-solid-appearance-node", "Inspect appearance", "Inspect the unknown's visible appearance before destructive testing.", "inspect-solid-appearance", "observation"),
      node("record-solid-appearance-node", "Record appearance", "Record the visible appearance and uncertainty.", "record-solid-appearance", "observation"),
      node("label-aqueous-test-location-node", "Label aqueous test location", "Record the assigned label for the fresh aqueous test location before transferring its microsample.", "label-aqueous-test-location", "observation"),
      node("dispense-aqueous-microsample-node", "Dispense aqueous microsample", "Transfer a fresh microsample into its aqueous test tube.", "dispense-aqueous-microsample"),
      node("test-water-solubility-node", "Apply water", "Apply the approved amount of water to the fresh microsample.", "test-water-solubility"),
      node("inspect-water-solubility-node", "Inspect solubility", "Inspect the aqueous-test mixture for visible solubility evidence.", "inspect-water-solubility", "observation"),
      node("record-water-solubility-node", "Record solubility", "Record the water-solubility observation and uncertainty.", "record-water-solubility", "observation"),
      node("read-aqueous-conductivity-node", "Read conductivity", "Read the tester only against an aqueous test mixture.", "read-aqueous-conductivity", "observation"),
      node("record-aqueous-conductivity-node", "Record conductivity", "Record the reading, units/category, or no-aqueous-sample.", "record-aqueous-conductivity", "observation"),
      node("label-dry-test-location-node", "Label dry test location", "Record the assigned label for the fresh dry test location before transferring its microsample.", "label-dry-test-location", "observation"),
      node("dispense-dry-microsample-node", "Dispense dry microsample", "Transfer a separate fresh microsample for dry tests.", "dispense-dry-microsample"),
      node("test-magnetic-response-node", "Test magnetism", "Bring the magnet near the contained dry microsample.", "test-magnetic-response", "observation"),
      node("record-magnetic-response-node", "Record magnetism", "Record attraction, no attraction, or ambiguous response.", "record-magnetic-response", "observation"),
      node("stage-melting-sample-node", "Stage melting sample", "Stage the dry microsample at the teacher-approved apparatus.", "stage-melting-sample"),
      node("read-melting-behavior-node", "Read melting behavior", "Read the staged sample using the teacher-approved method.", "read-melting-behavior", "observation"),
      node("record-melting-behavior-node", "Record melting behavior", "Record the temperature/category and anomalies.", "record-melting-behavior", "observation"),
      node("record-bonding-classification-node", "Record classification", "Record the bonding classification supported by the tests.", "record-bonding-classification", "observation"),
    ],
    tags: ["bonding", "qualitative-analysis"],
    version: "1.1.0",
    definitionUpdatedAt: "2026-08-12T00:00:00.000Z",
  }));
}

{
  const actions = [
    action("place-redox-flask", "place", "Place redox flask", {
      equipmentDefinitionId: "erlenmeyer-flask-250ml",
      location: "workbench",
    }, "The redox titration flask is ready."),
    action("measure-analyte", "measureVolume", "Measure redox analyte", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "redox-analyte-volume",
      volumeMl: 10,
      tolerance: 0.2,
    }, "The analyte volume is measured.", ["measureVolume", "measurement"]),
    action("transfer-analyte", "transfer", "Transfer redox analyte", {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      volumeMl: 10,
    }, "The analyte is in the flask."),
    action("acidify-analyte", "transfer", "Acidify analyte", {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      volumeMl: 10,
    }, "The analyte is acidified before titration."),
    action("fill-permanganate-burette", "transfer", "Fill permanganate burette", {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "burette-50ml",
      volumeMl: 35,
      visualState: "purple-solution",
    }, "The burette contains permanganate titrant."),
    action("record-redox-initial", "record", "Record redox initial burette", {
      measurementId: "redox-initial-burette",
      label: "Initial redox burette reading",
      value: 0.2,
      unit: "mL",
    }, "Initial redox burette reading is recorded.", ["record", "measurement"]),
    action("deliver-permanganate", "transfer", "Deliver permanganate", {
      sourceDefinitionId: "burette-50ml",
      targetDefinitionId: "erlenmeyer-flask-250ml",
      volumeMl: 18.4,
    }, "Permanganate is delivered to a persistent faint endpoint."),
    action("record-redox-final", "record", "Record redox final burette", {
      measurementId: "redox-final-burette",
      label: "Final redox burette reading",
      value: 18.6,
      unit: "mL",
    }, "Final redox burette reading is recorded.", ["record", "measurement"]),
    action("calculate-hydrogen-peroxide", "calculate", "Calculate hydrogen peroxide percent", {
      calculationId: "hydrogen-peroxide-percent",
      expected: 3,
      tolerance: 0.5,
      unit: "% H2O2",
    }, "Hydrogen peroxide percent is calculated.", ["calculate"]),
  ];
  definitions.push(technique({
    id: "redox-titration",
    title: "Redox Titration",
    learningGoal: "Standardize or apply permanganate titration evidence to estimate hydrogen peroxide percent.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "erlenmeyer-flask-250ml",
      "burette-50ml",
      "ring-stand-clamp",
      "reagent-bottle",
      "wash-bottle",
      "waste-beaker",
    ],
    initialEquipment: [
      equipment("sample-bottle", "1", solution("Hydrogen peroxide sample", 30, 0.88, "M")),
      equipment("reagent-bottle", "1", solution("Permanganate or acid reagent", 100, 0.02, "M", "purple-solution")),
      ...idsToEquipment(["graduated-cylinder", "erlenmeyer-flask-250ml", "burette-50ml", "ring-stand-clamp", "wash-bottle", "waste-beaker"]),
    ],
    actions,
    nodes: [
      node("place-redox-flask-node", "Place redox flask", "Place the Erlenmeyer flask on the workbench.", "place-redox-flask"),
      node("measure-analyte-node", "Measure analyte", "Pour 10 mL of redox analyte into the graduated cylinder.", "measure-analyte"),
      node("transfer-analyte-node", "Transfer analyte", "Pour the analyte into the Erlenmeyer flask.", "transfer-analyte"),
      node("acidify-analyte-node", "Acidify analyte", "Pour acid reagent into the analyte before titration.", "acidify-analyte"),
      node("fill-permanganate-burette-node", "Fill burette", "Pour permanganate titrant into the burette.", "fill-permanganate-burette"),
      node("record-redox-initial-node", "Record initial burette", "Record the initial redox burette reading.", "record-redox-initial", "observation"),
      node("deliver-permanganate-node", "Deliver titrant", "Pour permanganate titrant into the flask to a faint endpoint.", "deliver-permanganate"),
      node("record-redox-final-node", "Record final burette", "Record the final redox burette reading.", "record-redox-final", "observation"),
      node("calculate-hydrogen-peroxide-node", "Calculate peroxide", "Calculate hydrogen peroxide percent from titration evidence.", "calculate-hydrogen-peroxide", "calculation"),
    ],
    tags: ["redox", "titration"],
  }));
}

{
  const actions = [
    withRuntime(action("weigh-tablet-sample", "weigh", "Read starting sample mass", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-1",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "tablet-sample-mass",
      tolerance: 0.001,
      evidenceProvenance: "teacher-configured simulated balance output",
    }, "The starting sample mass is available from the balance.", ["weigh", "measurement"]), {
      atomId: "atom.weigh.solid-portion",
      equipmentRoleBindings: { "balance-instrument": "analytical-balance", "weighed-vessel": "watch-glass" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        stationId: "analytical-balance",
        valueParameter: "measurementId",
        accessibleLabel: "Read the starting sample mass on the analytical balance.",
      },
    }),
    withRuntime(action("record-tablet-sample-mass", "record", "Record starting sample mass", {
      measurementId: "tablet-sample-mass",
      label: "Starting sample mass",
      unit: "g",
      copyExistingMeasurementOnly: true,
    }, "The starting sample mass is recorded.", ["record", "measurement"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Copy the starting balance reading into the notebook.",
      },
      prerequisites: [measurementRequired("tablet-sample-mass", "The starting sample mass has been read.")],
    }),
    withRuntime(action("confirm-tablet-recovery-scope", "observe", "Confirm approved recovered fraction", {
      tag: "tablet-recovery-scope-approved",
      note: "Confirm that the supplied beaker contains the teacher-approved recovered fraction for this reusable technique. Its chemical identity remains unassigned.",
      inputMode: "choice",
      inputRole: "teacherConfiguration",
      inputLabel: "Recovered-fraction scope",
      inputOptions: ["Teacher approved recovered fraction"],
      inputRequired: true,
      configurationRequired: true,
      unlocked: false,
    }, "The teacher-approved recovered-fraction scope is recorded without assigning an identity.", ["configuration", "scope-boundary"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Confirm the teacher-approved recovered fraction before setting up filtration.",
      },
      prerequisites: [actionRequired("record-tablet-sample-mass", "The starting sample mass is recorded.")],
    }),
    withRuntime(action("place-tablet-buchner", "place", "Place Buchner funnel", {
      equipmentDefinitionId: "buchner-funnel",
      location: "workbench",
    }, "The Buchner funnel is on the workbench."), {
      atomId: "atom.place.filtration-funnel",
      equipmentRoleBindings: { "filtration-funnel": "buchner-funnel" },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "buchner-funnel",
        stationId: "workbench",
        accessibleLabel: "Place the Buchner funnel on the workbench.",
      },
      prerequisites: [actionRequired("confirm-tablet-recovery-scope", "The recovered-fraction scope is approved.")],
    }),
    withRuntime(action("seat-tablet-filter-paper", "place", "Seat filter paper", {
      equipmentDefinitionId: "filter-paper",
      targetDefinitionId: "buchner-funnel",
      snapZoneId: "buchner-funnel-paper-seat",
    }, "The filter paper is seated in the funnel."), {
      atomId: "atom.place.filter-medium",
      equipmentRoleBindings: { "filtration-funnel": "buchner-funnel", "filter-medium": "filter-paper" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "filter-paper",
        targetDefinitionId: "buchner-funnel",
        snapZoneId: "buchner-funnel-paper-seat",
        accessibleLabel: "Seat the filter paper in the Buchner funnel.",
      },
      prerequisites: [actionRequired("place-tablet-buchner", "The Buchner funnel is placed.")],
    }),
    withRuntime(action("attach-tablet-filter-flask", "place", "Attach side-arm receiver", {
      equipmentDefinitionId: "side-arm-filter-flask",
      targetDefinitionId: "buchner-funnel",
      snapZoneId: "buchner-funnel-receiver-neck",
    }, "The side-arm receiver is attached."), {
      atomId: "atom.place.filtration-receiver",
      equipmentRoleBindings: { "filtration-receiver": "side-arm-filter-flask" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "side-arm-filter-flask",
        targetDefinitionId: "buchner-funnel",
        snapZoneId: "buchner-funnel-receiver-neck",
        accessibleLabel: "Attach the side-arm receiver beneath the Buchner funnel.",
      },
      prerequisites: [actionRequired("place-tablet-buchner", "The Buchner funnel is placed.")],
    }),
    withRuntime(action("place-tablet-vacuum", "place", "Place vacuum source", {
      equipmentDefinitionId: "vacuum-source",
      location: "workbench",
    }, "The vacuum source is beside the filter flask."), {
      atomId: "atom.place.filtration-vacuum-source",
      equipmentRoleBindings: {
        "filtration-vacuum-source": "vacuum-source",
        "filtration-receiver": "side-arm-filter-flask",
      },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "vacuum-source",
        stationId: "workbench",
        accessibleLabel: "Place the vacuum source beside the side-arm flask.",
      },
      prerequisites: [actionRequired("attach-tablet-filter-flask", "The side-arm receiver is attached.")],
    }),
    withRuntime(action("wet-tablet-filter-paper", "rinse", "Wet and seal filter paper", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "filter-paper",
      rinseType: "pre-wet",
      volumeMl: 3,
      volumeProvenance: "teacher-approved rinse",
    }, "The filter paper is wetted and sealed."), {
      atomId: "atom.rinse.wet-filter-medium",
      equipmentRoleBindings: { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" },
      interaction: {
        type: "rinseTarget",
        sourceDefinitionId: "wash-bottle",
        targetDefinitionId: "filter-paper",
        valueParameter: "volumeMl",
        accessibleLabel: "Wet the seated paper with the approved rinse liquid.",
      },
      prerequisites: [actionRequired("seat-tablet-filter-paper", "The filter paper is seated.")],
    }),
    withRuntime(action("filter-tablet-mixture", "filter", "Filter approved recovered fraction", {
      sourceDefinitionId: "beaker-250ml",
      targetDefinitionId: "buchner-funnel",
      retainedVisualState: "filter-cake",
      filtrateVisualState: "clear-filtrate",
      fractionIdentity: "teacher-approved recovered solid fraction; chemical identity remains unassigned",
    }, "The recovered solid fraction is retained on the filter paper."), {
      atomId: "atom.filter.pour-through-medium",
      equipmentRoleBindings: { "mixture-source": "beaker-250ml", "filtration-funnel": "buchner-funnel" },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "beaker-250ml",
        targetDefinitionId: "buchner-funnel",
        accessibleLabel: "Filter the teacher-approved recovered fraction through the prepared apparatus.",
      },
      prerequisites: [
        actionRequired("wet-tablet-filter-paper", "The paper is wetted and sealed."),
        actionRequired("place-tablet-vacuum", "The vacuum source is placed."),
      ],
    }),
    withRuntime(action("wash-tablet-residue", "rinse", "Wash recovered solid", {
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "filter-paper",
      rinseType: "precipitate",
      volumeMl: 3,
      volumeProvenance: "teacher-approved rinse",
    }, "The recovered solid is washed before drying."), {
      atomId: "atom.rinse.wash-precipitate",
      equipmentRoleBindings: { "rinse-water-source": "wash-bottle", "filter-medium": "filter-paper" },
      interaction: {
        type: "rinseTarget",
        sourceDefinitionId: "wash-bottle",
        targetDefinitionId: "filter-paper",
        valueParameter: "volumeMl",
        accessibleLabel: "Wash the recovered solid with the teacher-approved rinse.",
      },
      prerequisites: [actionRequired("filter-tablet-mixture", "The recovered fraction has been filtered.")],
    }),
    withRuntime(action("weigh-tablet-watch-glass-tare", "weigh", "Tare recovery watch glass", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-2",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "tablet-watch-glass-mass",
      tolerance: 0.001,
    }, "The balance is tared with the clean, dry recovery watch glass."), {
      atomId: "atom.weigh.tare-vessel",
      equipmentRoleBindings: { "balance-instrument": "analytical-balance", "weighed-vessel": "watch-glass" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        stationId: "analytical-balance",
        valueParameter: "measurementId",
        accessibleLabel: "Tare the balance with the clean, dry recovery watch glass.",
      },
      prerequisites: [actionRequired("wash-tablet-residue", "The recovered solid has been washed.")],
    }),
    withRuntime(action("record-tablet-watch-glass-tare", "record", "Record recovery watch-glass tare", {
      measurementId: "tablet-watch-glass-mass",
      label: "Recovery watch-glass tare",
      unit: "g",
      copyExistingMeasurementOnly: true,
    }, "The recovery watch-glass tare is recorded.", ["record", "measurement"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Copy the recovery watch-glass tare into the notebook.",
      },
      prerequisites: [measurementRequired("tablet-watch-glass-mass", "The recovery watch-glass tare has been read.")],
    }),
    withRuntime(action("transfer-tablet-paper-to-watch", "place", "Transfer recovered solid to watch glass", {
      equipmentDefinitionId: "filter-paper",
      targetDefinitionId: "watch-glass",
      targetInstanceId: "watch-glass-2",
      snapZoneId: "watch-glass-paper-seat",
      detachBeforeAttach: true,
    }, "The recovered solid and filter paper are on the tared watch glass."), {
      atomId: "atom.place.transfer-medium-to-drying-vessel",
      equipmentRoleBindings: { "filter-medium": "filter-paper", "dried-assembly": "watch-glass" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "filter-paper",
        targetDefinitionId: "watch-glass",
        snapZoneId: "watch-glass-paper-seat",
        accessibleLabel: "Transfer the filter paper and recovered solid to the tared recovery watch glass.",
      },
      prerequisites: [measurementRequired("tablet-watch-glass-mass", "The recovery watch-glass tare is recorded.")],
    }),
    withRuntime(action("dry-tablet-residue", "dry", "Dry recovered solid", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-2",
      targetDefinitionId: "watch-glass",
      ovenDefinitionId: "drying-oven",
      precipitateSourceInstanceId: "filter-paper-1",
      drynessResult: "dry",
      endpointProvenance: "teacher-approved drying endpoint",
      dryMassProvenance: "derived from the teacher-configured recovered-fraction profile; not source fact or an authored answer",
      configurationParameter: "temperatureC",
      configurationRequired: true,
      unlocked: false,
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher-approved oven temperature",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 1,
      unit: "C",
    }, "The recovered solid reaches the approved dry endpoint."), {
      atomId: "atom.dry.oven-stage",
      equipmentRoleBindings: { "drying-instrument": "drying-oven", "dried-assembly": "watch-glass" },
      interaction: {
        type: "placeInInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "drying-oven",
        stationId: "drying-oven",
        accessibleLabel: "Dry the recovered solid to the teacher-approved endpoint.",
      },
      prerequisites: [actionRequired("transfer-tablet-paper-to-watch", "The recovered solid is on the tared watch glass.")],
    }),
    withRuntime(action("cool-tablet-residue", "cool", "Cool recovered solid", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-2",
      targetDefinitionId: "crucible-tongs",
      cooledTemperatureC: 25,
      cooledObjectLabel: "recovery watch-glass assembly",
    }, "The recovery assembly is cool enough to weigh."), {
      atomId: "atom.cool.before-weighing",
      equipmentRoleBindings: { "dried-assembly": "watch-glass", "cooling-tool": "crucible-tongs" },
      interaction: {
        type: "placeInInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "crucible-tongs",
        stationId: "crucible-tongs",
        accessibleLabel: "Use heat-safe handling and cool the recovery assembly before weighing.",
      },
      prerequisites: [actionRequired("dry-tablet-residue", "The recovered solid is dry.")],
    }),
    withRuntime(action("weigh-tablet-residue", "weigh", "Read dry recovered mass", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-2",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "tablet-residue-mass",
      requiresDryPrecipitate: true,
      maxSafeTemperatureC: 40,
      tolerance: 0.001,
    }, "The tared balance reports the dry recovered mass."), {
      atomId: "atom.weigh.dry-assembly",
      equipmentRoleBindings: { "balance-instrument": "analytical-balance", "dried-assembly": "watch-glass" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "watch-glass",
        targetDefinitionId: "analytical-balance",
        stationId: "analytical-balance",
        valueParameter: "measurementId",
        accessibleLabel: "Read the dry recovered mass on the tared balance.",
      },
      prerequisites: [
        actionRequired("cool-tablet-residue", "The recovery assembly has cooled."),
        measurementRequired("tablet-watch-glass-mass", "The recovery watch-glass tare is recorded."),
      ],
    }),
    withRuntime(action("record-tablet-residue", "record", "Record dry recovered mass", {
      measurementId: "tablet-residue-mass",
      unit: "g",
      label: "Dry recovered fraction mass",
      copyExistingMeasurementOnly: true,
    }, "The dry recovered fraction mass is recorded.", ["record", "measurement"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Copy the dry recovered fraction mass into the notebook.",
      },
      prerequisites: [measurementRequired("tablet-residue-mass", "The dry recovered mass has been read.")],
    }),
    withRuntime(action("calculate-tablet-component", "calculate", "Calculate recovered fraction percent", {
      calculationId: "tablet-component-percent",
      template: "componentMassPercent",
      startingMassMeasurementId: "tablet-sample-mass",
      componentMassMeasurementId: "tablet-residue-mass",
      compositionFormulaConfirmation: "component-mass-over-starting-mass",
      requireStudentValue: true,
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Recovered fraction percent by mass",
      inputMin: 0,
      inputMax: 100,
      inputStep: 0.1,
      tolerance: 0.5,
      unit: "%",
      identityLimit: "This percent describes a recovered fraction. It does not identify a tablet ingredient without independent evidence.",
    }, "Recovered fraction percent is calculated from measured masses.", ["calculate", "measurement-derived", "identity-boundary"]), {
      interaction: {
        type: "submitCalculation",
        valueParameter: "calculationId",
        accessibleLabel: "Calculate recovered fraction percent from the measured starting and dry recovered masses.",
      },
      prerequisites: [
        measurementRequired("tablet-sample-mass", "The starting sample mass is recorded."),
        measurementRequired("tablet-residue-mass", "The dry recovered mass is recorded."),
      ],
    }),
  ];
  definitions.push(technique({
    id: "tablet-separation",
    title: "Tablet Separation",
    learningGoal: "Filter one teacher-approved recovered tablet fraction, dry and cool it, and calculate its percent by mass without claiming an unsupported identity.",
    requiredEquipment: [
      "analytical-balance",
      "beaker-250ml",
      "buchner-funnel",
      "filter-paper",
      "side-arm-filter-flask",
      "vacuum-source",
      "wash-bottle",
      "watch-glass",
      "drying-oven",
      "crucible-tongs",
      "spatula",
    ],
    initialEquipment: [
      equipment("watch-glass", "1", solid("Simulated crushed tablet sample", 3)),
      equipment("watch-glass", "2"),
      equipment("beaker-250ml", "1", suspension("Teacher-approved simulated recovered tablet fraction", 30, 0.82, "Simulated recovered tablet solid fraction")),
      equipment("wash-bottle", "1", liquid("Teacher-approved rinse", 100)),
      ...idsToEquipment(["analytical-balance", "buchner-funnel", "side-arm-filter-flask", "vacuum-source", "filter-paper", "drying-oven", "crucible-tongs", "spatula"]),
    ],
    actions,
    nodes: [
      node("weigh-tablet-sample-node", "Read starting mass", "Read the starting sample mass on the balance.", "weigh-tablet-sample"),
      node("record-tablet-sample-mass-node", "Record starting mass", "Copy the starting mass into the notebook.", "record-tablet-sample-mass", "observation"),
      node("confirm-tablet-recovery-scope-node", "Confirm recovery scope", "Confirm the supplied beaker is the teacher-approved recovered fraction without assigning it an identity.", "confirm-tablet-recovery-scope", "teacherNote"),
      node("place-tablet-buchner-node", "Place funnel", "Place the Buchner funnel on the workbench.", "place-tablet-buchner"),
      node("seat-tablet-filter-paper-node", "Seat filter paper", "Seat the filter paper in the funnel.", "seat-tablet-filter-paper"),
      node("attach-tablet-filter-flask-node", "Attach receiver", "Attach the side-arm receiver beneath the funnel.", "attach-tablet-filter-flask"),
      node("place-tablet-vacuum-node", "Place vacuum source", "Place the vacuum source beside the receiver.", "place-tablet-vacuum"),
      node("wet-tablet-filter-paper-node", "Wet filter paper", "Wet and seal the seated filter paper.", "wet-tablet-filter-paper"),
      node("filter-tablet-mixture-node", "Filter recovered fraction", "Filter the teacher-approved recovered fraction.", "filter-tablet-mixture"),
      node("wash-tablet-residue-node", "Wash recovered solid", "Wash the recovered solid with the teacher-approved rinse.", "wash-tablet-residue"),
      node("weigh-tablet-watch-glass-tare-node", "Tare recovery vessel", "Tare the balance with the clean, dry recovery watch glass.", "weigh-tablet-watch-glass-tare"),
      node("record-tablet-watch-glass-tare-node", "Record recovery tare", "Copy the recovery watch-glass tare into the notebook.", "record-tablet-watch-glass-tare", "observation"),
      node("transfer-tablet-paper-to-watch-node", "Transfer recovered solid", "Move the filter paper and recovered solid to the tared watch glass.", "transfer-tablet-paper-to-watch"),
      node("dry-tablet-residue-node", "Dry recovered solid", "Dry the recovered solid to the teacher-approved endpoint.", "dry-tablet-residue"),
      node("cool-tablet-residue-node", "Cool recovered solid", "Cool the recovery assembly before weighing.", "cool-tablet-residue"),
      node("weigh-tablet-residue-node", "Read dry recovered mass", "Read the dry recovered fraction mass on the tared balance.", "weigh-tablet-residue", "observation"),
      node("record-tablet-residue-node", "Record dry recovered mass", "Copy the dry recovered fraction mass into the notebook.", "record-tablet-residue", "observation"),
      node("calculate-tablet-component-node", "Calculate recovered percent", "Calculate recovered fraction percent from measured masses.", "calculate-tablet-component", "calculation"),
    ],
    tags: ["separation", "tablet"],
    version: "1.1.0",
    definitionUpdatedAt: "2026-08-12T00:00:00.000Z",
  }));
}

{
  const actions = [
    withRuntime(action("configure-cv-wavelength", "observe", "Record approved wavelength", {
      measurementId: "cv-scheduled-wavelength-nm",
      configurationQuantity: "crystal violet measurement wavelength",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher-approved wavelength",
      inputMin: 350,
      inputMax: 750,
      inputStep: 1,
      unit: "nm",
      tag: "cv-scheduled-wavelength",
      note: "Record the teacher-approved wavelength; the source does not supply a universal value.",
    }, "The approved wavelength is recorded.", ["observe", "configuration", "measurement"]), {
      atomId: "atom.observe.configure-photometer",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer" },
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Record the teacher-approved wavelength for this scheduled reading.",
      },
    }),
    withRuntime(action("configure-cv-reading-time", "observe", "Record scheduled reading time", {
      measurementId: "cv-scheduled-time-s",
      configurationQuantity: "scheduled absorbance reading time",
      inputKey: "cvScheduledTimeSeconds",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher-approved scheduled reading time",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 1,
      unit: "s",
      tag: "cv-scheduled-time",
      note: "Record one teacher-approved scheduled time. The source does not supply a universal interval; the full investigation repeats read and record at every approved interval.",
    }, "The scheduled reading time is recorded.", ["observe", "configuration", "measurement"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Record the teacher-approved scheduled reading time.",
      },
      prerequisites: [measurementRequired("cv-scheduled-wavelength-nm", "The approved wavelength is recorded.")],
    }),
    withRuntime(action("place-cv-spectrophotometer", "place", "Place spectrophotometer", {
      equipmentDefinitionId: "spectrophotometer",
      location: "workbench",
    }, "The spectrophotometer is ready on the workbench."), {
      atomId: "atom.place.photometer",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer" },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "spectrophotometer",
        stationId: "workbench",
        accessibleLabel: "Place the spectrophotometer on the workbench.",
      },
      prerequisites: [measurementRequired("cv-scheduled-time-s", "The scheduled reading time is recorded.")],
    }),
    withRuntime(action("insert-cv-blank", "place", "Insert approved blank", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "cuvette-blank",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
    }, "The approved blank is seated in the spectrophotometer."), {
      atomId: "atom.place.insert-cuvette",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "cuvette",
        targetDefinitionId: "spectrophotometer",
        snapZoneId: "spectrophotometer-cuvette-slot",
        accessibleLabel: "Insert the approved blank cuvette into the spectrophotometer.",
      },
      prerequisites: [actionRequired("place-cv-spectrophotometer", "The spectrophotometer is on the workbench.")],
    }),
    withRuntime(action("zero-cv-spectrophotometer", "observe", "Zero spectrophotometer", {
      sourceDefinitionId: "cuvette",
      sourceInstanceId: "cuvette-blank",
      photometerOperation: "zero",
      photometerDefinitionId: "spectrophotometer",
      photometerInstanceId: "spectrophotometer-1",
      wavelengthMeasurementId: "cv-scheduled-wavelength-nm",
      cuvetteInstanceId: "cuvette-blank",
      tag: "cv-scheduled-instrument-blanked",
      note: "Zeroed with the teacher-approved blank at the recorded wavelength.",
    }, "The spectrophotometer is zeroed."), {
      atomId: "atom.observe.blank-photometer",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "cuvette",
        stationId: "spectrophotometer",
        accessibleLabel: "Zero the spectrophotometer with the inserted approved blank.",
      },
      prerequisites: [actionRequired("insert-cv-blank", "The approved blank is inserted.")],
    }),
    withRuntime(action("remove-cv-blank", "place", "Remove approved blank", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "cuvette-blank",
      location: "workbench",
    }, "The blank is back on the workbench and the sample slot is clear."), {
      atomId: "atom.place.remove-cuvette",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "cuvette",
        stationId: "workbench",
        accessibleLabel: "Remove the approved blank from the spectrophotometer.",
      },
      prerequisites: [notebookRequired("cv-scheduled-instrument-blanked", "The instrument is zeroed.")],
    }),
    withRuntime(action("insert-cv-reaction-cuvette", "place", "Insert prepared reaction cuvette", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "cuvette-reaction",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      snapZoneId: "spectrophotometer-cuvette-slot",
    }, "The prepared reaction cuvette is seated in the spectrophotometer."), {
      atomId: "atom.place.insert-cuvette",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
      interaction: {
        type: "snapIntoTarget",
        sourceDefinitionId: "cuvette",
        targetDefinitionId: "spectrophotometer",
        snapZoneId: "spectrophotometer-cuvette-slot",
        accessibleLabel: "Insert the prepared crystal-violet reaction cuvette.",
      },
      prerequisites: [actionRequired("remove-cv-blank", "The blank was removed and the sample slot is clear.")],
    }),
    withRuntime(action("wait-for-cv-scheduled-time", "observe", "Wait for scheduled reading time", {
      timerId: "stopwatch-1",
      configurationParameter: "waitSeconds",
      configurationRequired: true,
      unlocked: false,
      inputKey: "cvScheduledTimeSeconds",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Teacher-approved scheduled reading time",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 1,
      unit: "s",
      note: "Use the stopwatch to reach the approved scheduled reading point. This is one point, not a hidden time-series loop.",
      tag: "cv-scheduled-time-reached",
    }, "The scheduled reading time is reached.", ["observe", "timing"]), {
      interaction: {
        type: "recordNotebook",
        valueParameter: "note",
        accessibleLabel: "Advance the stopwatch to the teacher-approved scheduled reading point.",
      },
      prerequisites: [actionRequired("insert-cv-reaction-cuvette", "The prepared reaction cuvette is inserted.")],
    }),
    withRuntime(action("read-cv-scheduled-absorbance", "observe", "Read scheduled absorbance", {
      sourceDefinitionId: "cuvette",
      sourceInstanceId: "cuvette-reaction",
      photometerOperation: "read",
      photometerDefinitionId: "spectrophotometer",
      photometerInstanceId: "spectrophotometer-1",
      photometricQuantity: "absorbance",
      wavelengthMeasurementId: "cv-scheduled-wavelength-nm",
      requiresZeroNotebookTag: "cv-scheduled-instrument-blanked",
      cuvetteInstanceId: "cuvette-reaction",
      measurementId: "cv-scheduled-absorbance",
      label: "Crystal violet absorbance at the scheduled time",
      configurationParameter: "instrumentReadingValue",
      configurationRequired: true,
      unlocked: false,
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputLabel: "Simulated instrument absorbance for this scheduled point",
      inputMin: 0,
      inputStep: 0.001,
      unit: "absorbance",
      readingProvenance: "teacher-configured simulated instrument profile",
      scheduledTimeMeasurementId: "cv-scheduled-time-s",
    }, "The scheduled absorbance is available to record.", ["observe", "measurement", "simulator-output"]), {
      atomId: "atom.observe.read-photometer",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "cuvette",
        stationId: "spectrophotometer",
        accessibleLabel: "Read the inserted reaction cuvette at the scheduled time.",
      },
      prerequisites: [actionRequired("wait-for-cv-scheduled-time", "The scheduled reading time is reached.")],
    }),
    withRuntime(action("record-cv-scheduled-absorbance", "record", "Record scheduled absorbance", {
      measurementId: "cv-scheduled-absorbance",
      label: "Crystal violet absorbance at the scheduled time",
      unit: "absorbance",
      copyExistingMeasurementOnly: true,
    }, "The scheduled time/absorbance evidence row is recorded.", ["record", "measurement", "scheduled-point"]), {
      atomId: "atom.record.photometer-reading",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
      interaction: {
        type: "recordNotebook",
        valueParameter: "measurementId",
        accessibleLabel: "Copy the scheduled absorbance into the notebook with its approved scheduled time.",
      },
      prerequisites: [measurementRequired("cv-scheduled-absorbance", "The scheduled absorbance has been read.")],
    }),
    withRuntime(action("remove-cv-reaction-cuvette", "place", "Remove reaction cuvette", {
      equipmentDefinitionId: "cuvette",
      equipmentInstanceId: "cuvette-reaction",
      location: "workbench",
    }, "The reaction cuvette is removed and the instrument slot is clear."), {
      atomId: "atom.place.remove-cuvette",
      equipmentRoleBindings: { "photometer-instrument": "spectrophotometer", "photometer-sample-holder": "cuvette" },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: "cuvette",
        stationId: "workbench",
        accessibleLabel: "Remove the reaction cuvette after recording the scheduled reading.",
      },
      prerequisites: [actionRequired("record-cv-scheduled-absorbance", "The scheduled absorbance is recorded.")],
    }),
  ];
  definitions.push(technique({
    id: "crystal-violet-kinetics",
    title: "Crystal Violet Kinetics",
    learningGoal: "Complete one source-faithful scheduled absorbance read-and-record cycle for a prepared crystal violet reaction. Repeat this reusable technique at every approved interval to build a full kinetics series.",
    requiredEquipment: [
      "cuvette",
      "spectrophotometer",
      "stopwatch",
    ],
    initialEquipment: [
      equipment("cuvette", "blank", liquid("Teacher-approved photometric blank", 3)),
      equipment("cuvette", "reaction", liquid("Prepared crystal violet reaction mixture", 3, "purple-solution")),
      ...idsToEquipment(["spectrophotometer", "stopwatch"]),
    ],
    actions,
    nodes: [
      node("configure-cv-wavelength-node", "Set wavelength evidence", "Record the teacher-approved wavelength for this reading.", "configure-cv-wavelength", "teacherNote"),
      node("configure-cv-reading-time-node", "Set reading time", "Record the teacher-approved scheduled reading point.", "configure-cv-reading-time", "teacherNote"),
      node("place-cv-spectrophotometer-node", "Place spectrophotometer", "Place the spectrophotometer on the workbench.", "place-cv-spectrophotometer"),
      node("insert-cv-blank-node", "Insert blank", "Insert the approved blank cuvette.", "insert-cv-blank"),
      node("zero-cv-spectrophotometer-node", "Zero instrument", "Zero the spectrophotometer at the approved wavelength.", "zero-cv-spectrophotometer", "observation"),
      node("remove-cv-blank-node", "Remove blank", "Remove the blank and clear the sample slot.", "remove-cv-blank"),
      node("insert-cv-reaction-cuvette-node", "Insert reaction cuvette", "Insert the prepared reaction cuvette.", "insert-cv-reaction-cuvette"),
      node("wait-for-cv-scheduled-time-node", "Reach scheduled time", "Use the stopwatch to reach the teacher-approved scheduled reading point.", "wait-for-cv-scheduled-time", "observation"),
      node("read-cv-scheduled-absorbance-node", "Read absorbance", "Read one absorbance value at the scheduled time.", "read-cv-scheduled-absorbance", "observation"),
      node("record-cv-scheduled-absorbance-node", "Record absorbance", "Copy the scheduled absorbance into the notebook as one time/absorbance row.", "record-cv-scheduled-absorbance", "observation"),
      node("remove-cv-reaction-cuvette-node", "Remove reaction cuvette", "Remove the reaction cuvette after recording the point.", "remove-cv-reaction-cuvette"),
    ],
    tags: ["kinetics", "spectrophotometry", "scheduled-reading"],
    version: "1.1.0",
    definitionUpdatedAt: "2026-08-12T00:00:00.000Z",
  }));
}

{
  const actions = [
    action("place-calorimeter", "place", "Place calorimeter", {
      equipmentDefinitionId: "foam-cup-calorimeter",
      location: "workbench",
    }, "The foam cup calorimeter is ready."),
    action("measure-water", "measureVolume", "Measure water", {
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "calorimetry-water-volume",
      volumeMl: 50,
      tolerance: 1,
    }, "Water volume is measured.", ["measureVolume", "measurement"]),
    action("transfer-water-calorimeter", "transfer", "Transfer water to calorimeter", {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "foam-cup-calorimeter",
      volumeMl: 50,
    }, "Water is in the calorimeter."),
    action("weigh-calorimetry-solid", "weigh", "Weigh calorimetry solid", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "calorimetry-solid-mass",
      expectedMassG: 5,
      tolerance: 0.05,
    }, "Solid mass is recorded.", ["weigh", "measurement"]),
    action("record-initial-temperature", "record", "Record initial temperature", {
      measurementId: "initial-temperature",
      label: "Initial temperature",
      value: 21.4,
      unit: "C",
    }, "Initial temperature is recorded.", ["record", "measurement"]),
    action("dissolve-calorimetry-solid", "dissolve", "Dissolve calorimetry solid", {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "foam-cup-calorimeter",
      soluteMassG: 5,
      finalVolumeMl: 50,
    }, "The solid dissolves in the calorimeter."),
    action("record-final-temperature", "record", "Record final temperature", {
      measurementId: "final-temperature",
      label: "Final temperature",
      value: 35.6,
      unit: "C",
    }, "Final temperature is recorded.", ["record", "measurement"]),
    action("calculate-temperature-change", "calculate", "Calculate temperature change", {
      calculationId: "temperature-change",
      expected: 14.2,
      tolerance: 0.5,
      unit: "C",
    }, "Temperature change is calculated.", ["calculate"]),
  ];
  definitions.push(technique({
    id: "hand-warmer-calorimetry",
    title: "Hand-Warmer Calorimetry",
    learningGoal: "Assemble a foam-cup calorimeter, dissolve a salt, and record temperature-change evidence.",
    requiredEquipment: [
      "foam-cup-calorimeter",
      "thermometer",
      "analytical-balance",
      "watch-glass",
      "stirring-rod",
      "graduated-cylinder",
      "stopwatch",
      "distilled-water-bottle",
      "reagent-bottle",
    ],
    initialEquipment: [
      equipment("watch-glass", "1", solid("Candidate hand-warmer salt", 5)),
      equipment("reagent-bottle", "1", solid("Candidate hand-warmer salt", 10)),
      equipment("distilled-water-bottle", "1", liquid("Distilled water", 500)),
      ...idsToEquipment(["foam-cup-calorimeter", "thermometer", "analytical-balance", "stirring-rod", "graduated-cylinder", "stopwatch"]),
    ],
    actions,
    nodes: [
      node("place-calorimeter-node", "Place calorimeter", "Place the foam cup calorimeter on the workbench.", "place-calorimeter"),
      node("measure-water-node", "Measure water", "Pour 50 mL of water into the graduated cylinder.", "measure-water"),
      node("transfer-water-calorimeter-node", "Transfer water", "Pour measured water into the foam cup calorimeter.", "transfer-water-calorimeter"),
      node("weigh-calorimetry-solid-node", "Weigh solid", "Weigh the candidate hand-warmer salt on the analytical balance.", "weigh-calorimetry-solid"),
      node("record-initial-temperature-node", "Record initial temperature", "Record the initial water temperature.", "record-initial-temperature", "observation"),
      node("dissolve-calorimetry-solid-node", "Dissolve solid", "Dissolve the weighed solid in the calorimeter water.", "dissolve-calorimetry-solid"),
      node("record-final-temperature-node", "Record final temperature", "Record the final solution temperature.", "record-final-temperature", "observation"),
      node("calculate-temperature-change-node", "Calculate temperature change", "Calculate the temperature change for the hand-warmer trial.", "calculate-temperature-change", "calculation"),
    ],
    tags: ["calorimetry", "hand-warmer"],
  }));
}

{
  const actions = [
    action("observe-ph-paper", "observe", "Observe pH paper", {
      tag: "ph-paper-screen",
      note: "The acid and base are screened with pH paper before the titration curve run.",
    }, "pH paper screening is recorded.", ["observe", "notebook"]),
    action("measure-curve-analyte", "measureVolume", "Measure titration analyte", {
      sourceDefinitionId: "unknown-acid-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "curve-analyte-volume",
      volumeMl: 25,
      tolerance: 0.2,
    }, "The titration analyte volume is measured.", ["measureVolume", "measurement"]),
    action("transfer-curve-analyte", "transfer", "Transfer titration analyte", {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "beaker-250ml",
      volumeMl: 25,
    }, "The analyte is in the titration beaker."),
    action("fill-curve-burette", "transfer", "Fill curve burette", {
      sourceDefinitionId: "naoh-bottle",
      targetDefinitionId: "burette-50ml",
      volumeMl: 45,
    }, "The burette is filled with titrant."),
    action("record-initial-ph", "record", "Record initial pH", {
      measurementId: "initial-ph",
      label: "Initial pH",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Initial pH read from the meter (pH)",
      inputRequired: true,
      inputMin: 0,
      inputMax: 14,
      unit: "pH",
    }, "Initial pH is recorded.", ["record", "measurement"]),
    action("deliver-curve-titrant", "transfer", "Deliver curve titrant", {
      sourceDefinitionId: "burette-50ml",
      targetDefinitionId: "beaker-250ml",
      volumeMl: 24.8,
    }, "Titrant is delivered while pH is monitored."),
    action("record-equivalence-volume", "record", "Record equivalence volume", {
      measurementId: "equivalence-volume",
      label: "Equivalence volume",
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Equivalence volume identified from the recorded curve (mL)",
      inputRequired: true,
      inputMin: 0,
      inputMinExclusive: true,
      unit: "mL",
    }, "Equivalence volume is recorded.", ["record", "measurement"]),
    action("calculate-curve-molarity", "calculate", "Calculate curve molarity", {
      calculationId: "curve-molarity",
      template: "acidBaseMolarityFromEquivalenceVolume",
      titrationModelId: "curve-unknown-acid",
      tolerance: 0.005,
      unit: "M",
    }, "Unknown molarity is calculated from the titration curve.", ["calculate"]),
  ];
  definitions.push(technique({
    id: "titration-curve-analysis",
    title: "Titration Curve Analysis",
    learningGoal: "Screen acid-base behavior, monitor pH during titration, and calculate unknown molarity.",
    requiredEquipment: [
      "unknown-acid-bottle",
      "graduated-cylinder",
      "beaker-250ml",
      "burette-50ml",
      "ring-stand-clamp",
      "ph-meter",
      "ph-paper",
      "data-collection-interface",
      "naoh-bottle",
    ],
    initialEquipment: [
      equipment("unknown-acid-bottle", "1", solution("Unknown acid", 100, 0.1, "M")),
      equipment("naoh-bottle", "1", solution("Standard base", 250, 0.1, "M")),
      ...idsToEquipment(["graduated-cylinder", "beaker-250ml", "burette-50ml", "ring-stand-clamp", "ph-meter", "ph-paper", "data-collection-interface"]),
    ],
    actions,
    nodes: [
      node("observe-ph-paper-node", "Observe pH paper", "Record pH paper evidence for the acid and base.", "observe-ph-paper", "observation"),
      node("measure-curve-analyte-node", "Measure analyte", "Pour 25 mL of titration analyte into the graduated cylinder.", "measure-curve-analyte"),
      node("transfer-curve-analyte-node", "Transfer analyte", "Pour the titration analyte into the beaker.", "transfer-curve-analyte"),
      node("fill-curve-burette-node", "Fill burette", "Pour standard base into the burette.", "fill-curve-burette"),
      node("record-initial-ph-node", "Record initial pH", "Record the initial pH of the analyte.", "record-initial-ph", "observation"),
      node("deliver-curve-titrant-node", "Deliver titrant", "Pour titrant in measured portions while monitoring pH.", "deliver-curve-titrant"),
      node("record-equivalence-volume-node", "Record equivalence volume", "Record the equivalence-point volume from the titration curve.", "record-equivalence-volume", "observation"),
      node("calculate-curve-molarity-node", "Calculate molarity", "Calculate unknown molarity from the equivalence-point volume.", "calculate-curve-molarity", "calculation"),
    ],
    tags: ["titration", "ph-curve"],
  }));
}

const atomicContractExpectations = new Map([
  ["hard-water-gravimetry", {
    actionCount: 25,
    version: "1.1.0",
    requiredActionIds: [
      "place-hard-water-buchner",
      "seat-hard-water-filter-paper",
      "attach-hard-water-filter-flask",
      "place-hard-water-vacuum",
      "wet-hard-water-filter-paper",
      "filter-hard-water-mixture",
      "first-hard-water-drying",
      "break-hard-water-precipitate",
      "second-hard-water-drying",
      "cool-hard-water-assembly",
    ],
    forbiddenActionIds: ["filter-hard-water", "dry-precipitate"],
  }],
  ["bonding-solids-tests", {
    actionCount: 40,
    version: "1.2.0",
    requiredActionIds: [
      "label-test-locations",
      "inspect-solid-appearance",
      "record-solid-appearance",
      "dispense-water-microsample",
      "apply-water-solvent",
      "inspect-water-solubility",
      "record-water-solubility",
      "read-aqueous-conductivity",
      "record-aqueous-conductivity",
      "read-ph-indicator",
      "record-ph",
      "dispose-water-test-line",
      "dispense-ethanol-microsample",
      "apply-ethanol-solvent",
      "inspect-ethanol-solubility",
      "record-ethanol-solubility",
      "dispose-ethanol-test-line",
      "dispense-hexanes-microsample",
      "apply-hexanes-solvent",
      "inspect-hexanes-solubility",
      "record-hexanes-solubility",
      "dispose-hexanes-test-line",
      "dispense-dry-microsample",
      "test-magnetic-response",
      "record-magnetic-response",
      "stage-melting-sample",
      "read-melting-behavior",
      "record-melting-behavior",
      "dispose-dry-test-line",
      "dispense-hcl-microsample",
      "apply-hcl-reagent",
      "inspect-hcl-response",
      "record-hcl-response",
      "dispose-hcl-test-line",
      "dispense-naoh-microsample",
      "apply-naoh-reagent",
      "inspect-naoh-response",
      "record-naoh-response",
      "dispose-naoh-test-line",
      "complete-sample-matrix",
    ],
    forbiddenActionIds: [
      "place-reagent-tray",
      "observe-solid-appearance",
      "observe-solubility",
      "observe-conductivity",
      "observe-melting",
      "observe-magnetism",
      "label-aqueous-test-location",
      "dispense-aqueous-microsample",
      "test-water-solubility",
      "label-dry-test-location",
    ],
    forbiddenActionPrefixes: ["inv6-"],
    startNodeId: "label-test-locations-node",
    endNodeId: "complete-sample-matrix-node",
    orderedActionNodePairs: true,
    nodeIdPrefix: "",
    physicalRoleRequirements: {
      dispense: ["sample-source", "bonding-test-vessel", "solid-transfer-tool"],
      apply: ["bonding-test-solvent-source", "bonding-test-vessel"],
      dispose: ["bonding-test-vessel", "waste-receiver"],
      stage: ["bonding-test-vessel", "melting-point-instrument"],
      test: ["bonding-test-vessel", "magnetic-response-tool"],
    },
    requireAtomicEffectCoverage: true,
    qualitativeChoiceActionIds: [
      "inspect-solid-appearance", "inspect-water-solubility", "inspect-ethanol-solubility",
      "inspect-hexanes-solubility", "inspect-hcl-response", "inspect-naoh-response",
    ],
    measurementRecordPairs: [
      ["read-aqueous-conductivity", "record-aqueous-conductivity"],
      ["read-ph-indicator", "record-ph"],
      ["test-magnetic-response", "record-magnetic-response"],
      ["read-melting-behavior", "record-melting-behavior"],
    ],
    instrumentReadRequirements: {
      "read-aqueous-conductivity": { roles: ["immersed-probe-instrument", "bonding-test-vessel"], atomId: "atom.observe.read-aqueous-conductivity" },
      "read-ph-indicator": { roles: ["ph-indicator-medium", "bonding-test-vessel"], atomId: "atom.observe.read-ph-indicator" },
      "read-melting-behavior": { roles: ["melting-point-instrument", "bonding-test-vessel"], atomId: "atom.observe.read-melting-behavior" },
    },
    requiredConfigurationSlotIds: [
      "sampleIdentity", "sampleMode", "evidenceScopeId", "selectedTestPanel", "microsampleAmount",
      "waterAmount", "ethanolAmount", "hexanesAmount", "hclAmount", "naohAmount",
      "conductivityThresholds", "phThresholds", "meltingApparatusLimits", "hoodControl",
      "waterWasteDestination", "ethanolWasteDestination", "hexanesWasteDestination",
      "hclWasteDestination", "naohWasteDestination", "dryWasteDestination",
    ],
    configurationSlotUsage: {
      sampleIdentity: [["label-test-locations", "sampleIdentity"]],
      sampleMode: [["label-test-locations", "sampleMode"]],
      evidenceScopeId: [["label-test-locations", "evidenceScopeSlotId"], ["complete-sample-matrix", "evidenceScopeSlotId"]],
      selectedTestPanel: [["label-test-locations", "selectedTestPanel"], ["complete-sample-matrix", "selectedTestPanel"]],
      microsampleAmount: [
        ["dispense-water-microsample", "microsampleAmount"], ["dispense-ethanol-microsample", "microsampleAmount"],
        ["dispense-hexanes-microsample", "microsampleAmount"], ["dispense-dry-microsample", "microsampleAmount"],
        ["dispense-hcl-microsample", "microsampleAmount"], ["dispense-naoh-microsample", "microsampleAmount"],
      ],
      waterAmount: [["apply-water-solvent", "reagentAmount"]], ethanolAmount: [["apply-ethanol-solvent", "reagentAmount"]],
      hexanesAmount: [["apply-hexanes-solvent", "reagentAmount"]], hclAmount: [["apply-hcl-reagent", "reagentAmount"]],
      naohAmount: [["apply-naoh-reagent", "reagentAmount"]],
      conductivityThresholds: [["read-aqueous-conductivity", "conductivityThresholds"]],
      phThresholds: [["read-ph-indicator", "phThresholds"]],
      meltingApparatusLimits: [["stage-melting-sample", "meltingApparatusLimits"], ["read-melting-behavior", "meltingApparatusLimits"]],
      hoodControl: [["apply-hexanes-solvent", "hoodControl"]],
      waterWasteDestination: [["dispose-water-test-line", "wasteDestination"]],
      ethanolWasteDestination: [["dispose-ethanol-test-line", "wasteDestination"]],
      hexanesWasteDestination: [["dispose-hexanes-test-line", "wasteDestination"]],
      hclWasteDestination: [["dispose-hcl-test-line", "wasteDestination"]],
      naohWasteDestination: [["dispose-naoh-test-line", "wasteDestination"]],
      dryWasteDestination: [["dispose-dry-test-line", "wasteDestination"]],
    },
    forbidFixedProcedureLiterals: true,
    protectBlindIdentity: true,
  }],
  ["tablet-separation", {
    actionCount: 18,
    version: "1.1.0",
    requiredActionIds: [
      "confirm-tablet-recovery-scope",
      "place-tablet-buchner",
      "seat-tablet-filter-paper",
      "attach-tablet-filter-flask",
      "place-tablet-vacuum",
      "wet-tablet-filter-paper",
      "filter-tablet-mixture",
      "wash-tablet-residue",
      "dry-tablet-residue",
      "cool-tablet-residue",
    ],
    forbiddenActionIds: ["observe-magnetic-component", "add-extraction-solvent"],
  }],
  ["crystal-violet-kinetics", {
    actionCount: 11,
    version: "1.2.0",
    requiredActionIds: [
      "wait-for-cv-scheduled-time",
      "read-cv-scheduled-absorbance",
      "record-cv-scheduled-absorbance",
    ],
    forbiddenActionIds: ["observe-absorbance-series"],
  }],
]);

const laneRefiners = new Map([
  ["beers-law-calibration", refineSpectroscopyDefinition],
  ["brass-spectrophotometry", refineSpectroscopyDefinition],
  ["hard-water-gravimetry", refineGravimetrySeparationDefinition],
  ["bonding-solids-tests", refineGravimetrySeparationDefinition],
  ["tablet-separation", refineGravimetrySeparationDefinition],
  ["quick-ache-extraction-recovery", refineGravimetrySeparationDefinition],
  ["quick-ache-property-evidence", refineGravimetrySeparationDefinition],
  ["titration-endpoint", refineTitrationDefinition],
  ["redox-titration", refineTitrationDefinition],
  ["titration-curve-analysis", refineTitrationDefinition],
  ["crystal-violet-kinetics", refineKineticsDefinition],
]);

// The specialized hand-warmer generator owns both the technique and its parity-matched lab.
// Retain the legacy builder for full-default compatibility checks, but never let this shared AP
// driver overwrite the authoritative Cycle 09 output.
const externallyOwnedDefinitionIds = new Set(["hand-warmer-calorimetry"]);

const knownIds = new Set(definitions.map((item) => item.id));
const unknownOnlyIds = [...onlyIds].filter((id) => !knownIds.has(id));
if (unknownOnlyIds.length > 0) {
  throw new Error(`Unknown --only technique id(s): ${unknownOnlyIds.join(", ")}`);
}
const externallyOwnedOnlyIds = [...onlyIds].filter((id) => externallyOwnedDefinitionIds.has(id));
if (externallyOwnedOnlyIds.length > 0) {
  throw new Error(
    `Technique id(s) ${externallyOwnedOnlyIds.join(", ")} are owned by generateHandWarmerCalorimetry.mjs; ` +
      "run that generator with --no-index instead.",
  );
}

const selectedDefinitionIds = onlyIds.size > 0
  ? onlyIds
  : new Set(definitions.filter((item) => !externallyOwnedDefinitionIds.has(item.id)).map((item) => item.id));

for (let index = 0; index < definitions.length; index += 1) {
  const definition = definitions[index];
  if (!selectedDefinitionIds.has(definition.id)) continue;
  const refine = laneRefiners.get(definition.id);
  if (refine) definitions[index] = refine(definition);
}

const assertAtomicTechniqueContract = (definition, expectation) => {
  const actionIds = definition.actions.map((item) => item.id);
  const nodeIds = definition.process.nodes.map((item) => item.id);
  const actionIdSet = new Set(actionIds);
  const nodeIdSet = new Set(nodeIds);
  const nodeActionIds = definition.process.nodes.map((item) => item.actionId);
  const unknownNodeActions = nodeActionIds.filter((id) => !actionIdSet.has(id));
  const duplicatedNodeActions = nodeActionIds.filter((id, index) => nodeActionIds.indexOf(id) !== index);
  const invalidNodeValidations = definition.process.nodes.filter((item) =>
    item.validation.length !== 1 ||
    item.validation[0].type !== "actionEvidence" ||
    item.validation[0].actionId !== item.actionId
  );
  const actionsWithoutInteractions = definition.actions.filter((item) => !item.interaction);
  const actionsWithoutEvidence = definition.actions.filter(
    (item) => !Array.isArray(item.evidence) || item.evidence.length === 0,
  );
  const actionsWithUnknownAtoms = definition.actions.filter((item) => item.atomId && !registeredAtomsById.has(item.atomId));
  const effectActionIds = new Set((definition.composition?.legacyActionEffects ?? []).map((item) => item.actionId));
  const actionsWithoutAtomicEffectCoverage = expectation.requireAtomicEffectCoverage
    ? definition.actions.filter((item) => !item.atomId && !effectActionIds.has(item.id))
    : [];
  const physicalContractFailures = Object.entries(expectation.physicalRoleRequirements ?? {}).flatMap(([prefix, roleIds]) =>
    definition.actions
      .filter((item) => item.id.startsWith(`${prefix}-`))
      .filter((item) => {
        const bindings = item.equipmentRoleBindings;
        const expectedInteraction = prefix === "stage" ? "dragToZone" : prefix === "test" ? "readInstrument" : "pourInto";
        return !bindings || typeof bindings !== "object" || Array.isArray(bindings) ||
          roleIds.some((roleId) => typeof bindings[roleId] !== "string" || bindings[roleId].trim().length === 0) ||
          item.interaction?.type !== expectedInteraction || (!item.atomId && !effectActionIds.has(item.id));
      })
      .map((item) => item.id)
  );
  const invalidChoiceObservations = (expectation.qualitativeChoiceActionIds ?? []).filter((id) => {
    const action = definition.actions.find((item) => item.id === id);
    const options = action?.choiceObservation?.options;
    return !action || action.parameters?.inputMode !== "choice" || !Array.isArray(options) || options.length < 2 ||
      new Set(options.map((option) => option.tag)).size !== options.length ||
      typeof action.choiceObservation.outputCalculationId !== "string";
  });
  const invalidMeasurementRecordPairs = (expectation.measurementRecordPairs ?? []).filter(([readId, recordId]) => {
    const readAction = definition.actions.find((item) => item.id === readId);
    const recordAction = definition.actions.find((item) => item.id === recordId);
    const measurementId = readAction?.parameters?.measurementId;
    return readAction?.verb !== "observe" || recordAction?.verb !== "record" ||
      recordAction?.interaction?.type !== "recordNotebook" ||
      typeof measurementId !== "string" || measurementId.length === 0 ||
      readAction.parameters?.evidenceScopeSlotId !== "{{config.evidenceScopeId}}" ||
      recordAction?.parameters?.measurementId !== measurementId ||
      recordAction.parameters?.evidenceScopeSlotId !== "{{config.evidenceScopeId}}" ||
      recordAction.parameters?.copyExistingMeasurementOnly !== true;
  });
  const configurationSlots = new Map((definition.composition?.configurationSlots ?? []).map((slot) => [slot.id, slot]));
  const configurationPlaceholder = (slotId) => `{{config.${slotId}}}`;
  const configuredSlotId = (value) => {
    if (typeof value !== "string") return undefined;
    const match = /^\{\{config\.([A-Za-z0-9_-]+)\}\}$/.exec(value);
    return match?.[1];
  };
  const missingConfigurationSlots = (expectation.requiredConfigurationSlotIds ?? []).filter((id) =>
    configurationSlots.get(id)?.required !== true
  );
  const fixedProcedureLiterals = expectation.forbidFixedProcedureLiterals
    ? definition.actions.flatMap((item) => Object.entries(item.parameters ?? {})
      .filter(([key, value]) => /^(?:.*(?:amount|massG|volumeMl|thresholds?|limits?|endpoint))$/i.test(key) &&
        !configurationSlots.has(configuredSlotId(value)))
      .map(([key]) => `${item.id}.${key}`))
    : [];
  const slotsWithFixedDefaults = expectation.forbidFixedProcedureLiterals
    ? [...configurationSlots.values()].filter((slot) => ["default", "defaultValue", "value", "configuredValue", "initialValue"]
      .some((key) => Object.prototype.hasOwnProperty.call(slot, key)))
    : [];
  const collectInvalidConfigurationReferences = (value, path) => {
    if (typeof value === "string") {
      if (!value.includes("{{config.")) return [];
      const slotId = configuredSlotId(value);
      return slotId && configurationSlots.has(slotId) ? [] : [path];
    }
    if (!value || typeof value !== "object") return [];
    if (value.source === "configuration") return [path];
    return Object.entries(value).flatMap(([key, child]) => collectInvalidConfigurationReferences(child, `${path}.${key}`));
  };
  const invalidConfigurationReferences = expectation.forbidFixedProcedureLiterals
    ? definition.actions.flatMap((action) => collectInvalidConfigurationReferences(action.parameters ?? {}, `${action.id}.parameters`))
    : [];
  const parameterConsumesConfigurationSlot = (parameters, parameterKey, slotId) => {
    const value = parameters?.[parameterKey];
    return value === configurationPlaceholder(slotId);
  };
  const unusedConfigurationSlots = Object.entries(expectation.configurationSlotUsage ?? {}).filter(([slotId, bindings]) =>
    bindings.some(([actionId, parameterKey]) => {
      const action = definition.actions.find((item) => item.id === actionId);
      return !action || !parameterConsumesConfigurationSlot(action.parameters, parameterKey, slotId);
    })
  ).map(([slotId]) => slotId);
  const collectHardBoundScopeFields = (value, path = "definition") => {
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key, child]) => {
      const childPath = `${path}.${key}`;
      const isProtectedField = /^(?:sampleIdentity|sampleMode|evidenceScope|evidenceScopeId)$/i.test(key);
      const isConfiguredReference = configurationSlots.has(configuredSlotId(child));
      return [
        ...(isProtectedField && !isConfiguredReference ? [childPath] : []),
        ...collectHardBoundScopeFields(child, childPath),
      ];
    });
  };
  const hardBoundScopeFields = expectation.protectBlindIdentity
    ? collectHardBoundScopeFields({ actions: definition.actions, initialState: definition.initialState,
      configurationSlots: definition.composition?.configurationSlots })
    : [];
  const fixedSampleIdentities = expectation.protectBlindIdentity && /(?:\bK[1-6]\b|\bU[1-6]\b|expectedIdentity|revealedIdentity)/i
    .test(JSON.stringify({ actions: definition.actions, initialState: definition.initialState,
      configurationSlots: definition.composition?.configurationSlots }))
    ? ["fixed sample identity or identity reveal"]
    : [];
  const effectByActionId = new Map((definition.composition?.legacyActionEffects ?? []).map((item) => [item.actionId, item.effect]));
  const invalidInstrumentReads = Object.entries(expectation.instrumentReadRequirements ?? {}).filter(([actionId, requirement]) => {
    const action = definition.actions.find((item) => item.id === actionId);
    const pair = (expectation.measurementRecordPairs ?? []).find(([readId]) => readId === actionId);
    const recordAction = definition.actions.find((item) => item.id === pair?.[1]);
    const bindings = action?.equipmentRoleBindings;
    const effect = effectByActionId.get(actionId);
    const requiredMeasurementClass = "measurement-direct-observation-acquisition";
    const requiredMeasurementTargets = ["instrument", "measurement-observation"];
    const expectedAtom = requirement.atomId ? registeredAtomsById.get(requirement.atomId) : undefined;
    const expectedAtomContract = expectedAtom?.effectContract;
    const registeredMeasurementAtom = Boolean(requirement.atomId && action?.atomId === requirement.atomId &&
      expectedAtomContract?.classes?.includes(requiredMeasurementClass) &&
      requiredMeasurementTargets.every((domain) => expectedAtomContract.targets?.some((target) => target.domain === domain)));
    const reviewedMeasurementEffect = effect?.classes?.includes(requiredMeasurementClass) &&
      requiredMeasurementTargets.every((domain) => effect.targets?.some((target) => target.domain === domain));
    return !action || action.interaction?.type !== "readInstrument" ||
      requirement.roles.some((roleId) => typeof bindings?.[roleId] !== "string" || bindings[roleId].trim().length === 0) ||
      typeof action.parameters?.measurementId !== "string" || action.parameters.evidenceScopeSlotId !== configurationPlaceholder("evidenceScopeId") ||
      Boolean(action.atomId && !registeredAtomsById.has(action.atomId)) ||
      (!registeredMeasurementAtom && !reviewedMeasurementEffect) ||
      !recordAction || recordAction.verb !== "record" || recordAction.interaction?.type !== "recordNotebook" ||
      recordAction.parameters?.measurementId !== action.parameters.measurementId ||
      recordAction.parameters?.evidenceScopeSlotId !== configurationPlaceholder("evidenceScopeId") ||
      recordAction.parameters?.copyExistingMeasurementOnly !== true;
  }).map(([actionId]) => actionId);
  const unscopedActions = expectation.protectBlindIdentity
    ? definition.actions.filter((item) => item.parameters?.evidenceScopeSlotId !== configurationPlaceholder("evidenceScopeId"))
    : [];
  const sampleModeSlot = configurationSlots.get("sampleMode");
  const sampleIdentitySlot = configurationSlots.get("sampleIdentity");
  const blindIdentityContractValid = !expectation.protectBlindIdentity || (
    Array.isArray(sampleModeSlot?.allowedValues) && sampleModeSlot.allowedValues.includes("known") &&
    sampleModeSlot.allowedValues.includes("blind") && sampleIdentitySlot?.redactWhenBlind === true &&
    !/(?:known-k1|unknown-u1|expectedIdentity|revealedIdentity)/i.test(JSON.stringify(definition.actions))
  );
  const evidencePartitionByActionId = new Map(
    Object.entries(expectation.evidencePartitions ?? {}).flatMap(([partition, ids]) =>
      ids.map((id) => [id, partition])
    ),
  );
  const partitionedActions = definition.actions.filter((item) => evidencePartitionByActionId.has(item.id));
  const invalidPartitionEvidence = partitionedActions.filter((item) => {
    const partition = evidencePartitionByActionId.get(item.id);
    const opposite = partition === "known" ? "unknown" : "known";
    return !item.evidence.includes(partition) || item.evidence.includes(opposite);
  });
  const invalidPartitionNodes = expectation.evidencePartitions
    ? definition.process.nodes.filter((item) =>
      evidencePartitionByActionId.has(item.actionId) && item.config?.preservesBlindIdentity !== true
    )
    : [];
  const expectedActionNodePairs = expectation.orderedActionNodePairs
    ? expectation.requiredActionIds.map((actionId) => ({
      actionId,
      nodeId: `${expectation.nodeIdPrefix ?? "lab-"}${actionId}-node`,
    }))
    : [];
  const actualActionNodePairs = definition.actions.map((action, index) => ({
    actionId: action.id,
    nodeId: definition.process.nodes[index]?.id,
    nodeActionId: definition.process.nodes[index]?.actionId,
  }));
  const orderedActionNodePairsMatch = !expectation.orderedActionNodePairs ||
    JSON.stringify(actualActionNodePairs) === JSON.stringify(expectedActionNodePairs.map((pair) => ({
      ...pair,
      nodeActionId: pair.actionId,
    })));
  const expectedAdjacentEdges = expectedActionNodePairs.slice(1).map((pair, index) => ({
    from: expectedActionNodePairs[index].nodeId,
    to: pair.nodeId,
  }));
  const actualEdges = definition.process.edges.map((edge) => ({ from: edge.from, to: edge.to }));
  const adjacentEdgesMatch = !expectation.orderedActionNodePairs ||
    JSON.stringify(actualEdges) === JSON.stringify(expectedAdjacentEdges);
  const expectedPartitionCount = Object.values(expectation.evidencePartitions ?? {}).reduce((count, ids) => count + ids.length, 0);
  const missingRequired = expectation.requiredActionIds.filter((id) => !actionIdSet.has(id));
  const presentForbidden = expectation.forbiddenActionIds.filter((id) => actionIdSet.has(id));
  const presentForbiddenPrefixes = (expectation.forbiddenActionPrefixes ?? []).filter((prefix) =>
    actionIds.some((id) => id.startsWith(prefix))
  );
  const expectedEdgeCount = Math.max(0, definition.process.nodes.length - 1);

  const failures = [
    definition.metadata.version !== expectation.version
      ? `version ${definition.metadata.version} (expected ${expectation.version})`
      : undefined,
    definition.actions.length !== expectation.actionCount
      ? `${definition.actions.length} actions (expected ${expectation.actionCount})`
      : undefined,
    definition.process.nodes.length !== expectation.actionCount
      ? `${definition.process.nodes.length} nodes (expected ${expectation.actionCount})`
      : undefined,
    definition.process.edges.length !== expectedEdgeCount
      ? `${definition.process.edges.length} edges (expected ${expectedEdgeCount})`
      : undefined,
    expectation.startNodeId && definition.process.startNodeId !== expectation.startNodeId
      ? `start node ${definition.process.startNodeId} (expected ${expectation.startNodeId})`
      : undefined,
    expectation.endNodeId && definition.process.nodes.at(-1)?.id !== expectation.endNodeId
      ? `end node ${definition.process.nodes.at(-1)?.id} (expected ${expectation.endNodeId})`
      : undefined,
    !orderedActionNodePairsMatch ? "ordered action/node pairs differ from the source contract" : undefined,
    !adjacentEdgesMatch ? "process edges are not the exact adjacent source-contract sequence" : undefined,
    actionIdSet.size !== actionIds.length ? "duplicate action ids" : undefined,
    nodeIdSet.size !== nodeIds.length ? "duplicate node ids" : undefined,
    unknownNodeActions.length ? `unknown node action ids: ${unknownNodeActions.join(", ")}` : undefined,
    duplicatedNodeActions.length ? `actions reused by multiple nodes: ${duplicatedNodeActions.join(", ")}` : undefined,
    invalidNodeValidations.length
      ? `non-atomic node validation contracts: ${invalidNodeValidations.map((item) => item.id).join(", ")}`
      : undefined,
    actionsWithoutInteractions.length
      ? `actions without explicit interactions: ${actionsWithoutInteractions.map((item) => item.id).join(", ")}`
      : undefined,
    actionsWithoutEvidence.length
      ? `actions without evidence labels: ${actionsWithoutEvidence.map((item) => item.id).join(", ")}`
      : undefined,
    actionsWithUnknownAtoms.length
      ? `actions reference unregistered atoms: ${actionsWithUnknownAtoms.map((item) => `${item.id}:${item.atomId}`).join(", ")}`
      : undefined,
    actionsWithoutAtomicEffectCoverage.length
      ? `actions without atom/effect coverage: ${actionsWithoutAtomicEffectCoverage.map((item) => item.id).join(", ")}`
      : undefined,
    physicalContractFailures.length
      ? `physical interactions lack registered atom/effect or complete role bindings: ${physicalContractFailures.join(", ")}`
      : undefined,
    invalidChoiceObservations.length
      ? `qualitative observations lack typed choices: ${invalidChoiceObservations.join(", ")}`
      : undefined,
    invalidMeasurementRecordPairs.length
      ? `read/record evidence is not sample scoped and separately consumed: ${invalidMeasurementRecordPairs.map((pair) => pair.join(" -> ")).join(", ")}`
      : undefined,
    missingConfigurationSlots.length
      ? `missing required per-sample configuration: ${missingConfigurationSlots.join(", ")}`
      : undefined,
    fixedProcedureLiterals.length
      ? `fixed procedure literals remain: ${fixedProcedureLiterals.join(", ")}`
      : undefined,
    slotsWithFixedDefaults.length
      ? `required configuration slots contain fixed defaults: ${slotsWithFixedDefaults.map((slot) => slot.id).join(", ")}`
      : undefined,
    invalidConfigurationReferences.length
      ? `invalid, undeclared, or object-valued configuration references remain: ${invalidConfigurationReferences.join(", ")}`
      : undefined,
    unusedConfigurationSlots.length
      ? `required configuration slots are not consumed by their action semantics: ${unusedConfigurationSlots.join(", ")}`
      : undefined,
    hardBoundScopeFields.length
      ? `sample identity/mode/scope is hard bound: ${hardBoundScopeFields.join(", ")}`
      : undefined,
    fixedSampleIdentities.length ? fixedSampleIdentities.join(", ") : undefined,
    invalidInstrumentReads.length
      ? `instrument reads lack read interaction, role bindings, scoped measurement production, or reviewed effect: ${invalidInstrumentReads.join(", ")}`
      : undefined,
    unscopedActions.length
      ? `actions without sample evidence scope: ${unscopedActions.map((item) => item.id).join(", ")}`
      : undefined,
    !blindIdentityContractValid ? "blind sample identity is not protected" : undefined,
    invalidPartitionEvidence.length
      ? `known/unknown evidence partitions are not isolated: ${invalidPartitionEvidence.map((item) => item.id).join(", ")}`
      : undefined,
    invalidPartitionNodes.length
      ? `known/unknown nodes do not preserve blind identity: ${invalidPartitionNodes.map((item) => item.id).join(", ")}`
      : undefined,
    partitionedActions.length !== expectedPartitionCount
      ? `${partitionedActions.length} partitioned actions (expected ${expectedPartitionCount})`
      : undefined,
    missingRequired.length ? `missing required atomic actions: ${missingRequired.join(", ")}` : undefined,
    presentForbidden.length ? `legacy composite actions still present: ${presentForbidden.join(", ")}` : undefined,
    presentForbiddenPrefixes.length ? `obsolete action families still present: ${presentForbiddenPrefixes.join(", ")}` : undefined,
  ].filter(Boolean);

  if (failures.length > 0) {
    throw new Error(`${definition.id} atomic contract failed: ${failures.join("; ")}`);
  }
};

const fixtureValidationIndex = process.argv.indexOf("--validate-atomic-fixture");
if (fixtureValidationIndex >= 0) {
  const id = process.argv[fixtureValidationIndex + 1];
  const expectation = atomicContractExpectations.get(id);
  if (!expectation) throw new Error(`Unknown atomic fixture technique id: ${id ?? ""}`);
  const fixture = JSON.parse(readFileSync(0, "utf8"));
  if (fixture.id !== id) throw new Error(`Atomic fixture id ${fixture.id ?? ""} does not match ${id}.`);
  assertAtomicTechniqueContract(fixture, expectation);
  console.log(JSON.stringify({ ok: true, id, actions: fixture.actions.length, nodes: fixture.process.nodes.length,
    edges: fixture.process.edges.length }));
  process.exit(0);
}

for (const [id, expectation] of atomicContractExpectations) {
  if (!selectedDefinitionIds.has(id)) continue;
  const definition = definitions.find((item) => item.id === id);
  if (!definition) throw new Error(`Missing atomic-contract technique definition: ${id}`);
  assertAtomicTechniqueContract(definition, expectation);
}

mkdirSync(outDir, { recursive: true });

const selectedDefinitions = onlyIds.size > 0
  ? definitions.filter((item) => onlyIds.has(item.id))
  : definitions.filter((item) => !externallyOwnedDefinitionIds.has(item.id));

for (const item of selectedDefinitions) {
  writeFileSync(join(outDir, `${item.id}.json`), `${JSON.stringify(item, null, 2)}\n`);
  console.log(`wrote public/techniques/${item.id}.json`);
}

if (onlyIds.size === 0) {
  const indexPath = join(outDir, "index.json");
  const existingIndex = JSON.parse(readFileSync(indexPath, "utf8"));
  const generatedIds = new Set(selectedDefinitions.map((item) => item.id));
  const nextIndex = [
    ...existingIndex.filter((entry) => !generatedIds.has(entry.id)),
    ...selectedDefinitions.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.learningGoal,
      file: `${item.id}.json`,
      tags: item.metadata.tags,
    })),
  ];

  writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`);
  console.log("updated public/techniques/index.json");
} else {
  console.log("left public/techniques/index.json unchanged for targeted generation");
}
