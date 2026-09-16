import {
  emptyContents,
  type ActionDefinition,
  type ActionVerb,
  type ContentState,
  type LabDefinition,
  type ProcessDefinition,
  type ProcessNode,
  type RuntimeInvalidCase,
  type TechniqueDefinition,
  type ValidationRule,
} from "./types";
import { createEquipmentInstance } from "../equipment/catalog";
import transmittanceDilutionTechniqueJson from "../../public/techniques/transmittance-dilution.json";
import thermalDecompositionTechniqueJson from "../../public/techniques/thermal-decomposition-mass-loss.json";

const updatedAt = "2026-05-12T00:00:00.000Z";

const metadata = (tags: string[]) => ({
  version: "1.0.0",
  author: "Lab Studio",
  updatedAt,
  tags,
});

const invalidCases: RuntimeInvalidCase[] = [
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

const action = (
  id: string,
  verb: ActionVerb,
  label: string,
  parameters: ActionDefinition["parameters"],
  success: string,
  evidence: string[] = [verb],
): ActionDefinition => ({
  id,
  verb,
  label,
  parameters,
  prerequisites: [],
  stateChanges: [`${verb} updates runtime state through structured equipment contents.`],
  invalidCases,
  feedback: {
    success,
    invalid: "The simulator could not complete that action. Review the step requirements.",
  },
  evidence,
});

const actionRule = (id: string, actionId: string): ValidationRule => ({
  id,
  type: "actionEvidence",
  label: `Action ${actionId} was completed.`,
  actionId,
});

const measurementRule = (id: string, measurementId: string): ValidationRule => ({
  id,
  type: "measurementRecorded",
  label: `Measurement ${measurementId} was recorded.`,
  measurementId,
});

const notebookRule = (id: string, notebookTag: string): ValidationRule => ({
  id,
  type: "notebookEntry",
  label: `Notebook entry ${notebookTag} was recorded.`,
  notebookTag,
});

const calculationRule = (
  id: string,
  calculationId: string,
  tolerance: number,
): ValidationRule => ({
  id,
  type: "calculationWithinTolerance",
  label: `Calculation ${calculationId} is within tolerance.`,
  calculationId,
  tolerance,
});

const node = (
  id: string,
  title: string,
  description: string,
  actionId: string | undefined,
  validation: ValidationRule[],
  type: ProcessNode["type"] = "action",
  config: ProcessNode["config"] = {},
): ProcessNode => ({
  id,
  type,
  title,
  description,
  actionId,
  config,
  validation,
  hints: [],
  feedback: {
    success: `${title} complete.`,
    retry: `Review ${title} and try again.`,
  },
});

const linearProcess = (nodes: ProcessNode[]): ProcessDefinition => ({
  startNodeId: nodes[0]?.id ?? "start",
  nodes,
  edges: nodes.slice(0, -1).map((processNode, index) => ({
    from: processNode.id,
    to: nodes[index + 1].id,
    label: "Next",
    condition: { type: "validationPassed" },
  })),
});

const liquid = (label: string, volumeMl: number): ContentState => ({
  kind: "liquid",
  label,
  volumeMl,
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState: "clear-liquid",
});

const solid = (label: string, massG: number): ContentState => ({
  kind: "solid",
  label,
  massG,
  solutes: [{ id: label.toLowerCase().replaceAll(" ", "-"), label, amount: massG, unit: "g" }],
  contamination: [],
  wetState: "dry",
  visualState: "powder",
});

const mixtureWithPrecipitate = (
  label: string,
  volumeMl: number,
  precipitateMassG: number,
): ContentState => ({
  kind: "mixture",
  label,
  volumeMl,
  solutes: [{ id: "calcium-carbonate", label: "Calcium carbonate", amount: precipitateMassG, unit: "g" }],
  precipitate: {
    substance: "Calcium carbonate",
    massG: precipitateMassG,
    rinsed: false,
    dryness: "wet",
  },
  contamination: [],
  wetState: "wet",
  visualState: "cloudy-precipitate",
});

const baseEquipment = (ids: string[]) =>
  ids.map((id) => {
    const instance = createEquipmentInstance(id);
    return id === "wash-bottle"
      ? { ...instance, contents: liquid("Deionized water", 500) }
      : instance;
  });

const withContents = (
  technique: TechniqueDefinition,
  instanceId: string,
  contents: ContentState,
): TechniqueDefinition => ({
  ...technique,
  initialState: {
    equipment: technique.initialState.equipment.map((item) =>
      item.id === instanceId ? { ...item, contents } : item,
    ),
  },
});

// Annotated like `measuringActions` and `hardWaterActions` below. Without the annotation the
// array is not contextually typed, so an inline `interaction.type` string widens to `string` and
// stops satisfying `ActionInteractionSpec`.
const weighingActions: ActionDefinition[] = [
  {
    ...action("place-watch-glass", "place", "Place watch glass", {
      equipmentDefinitionId: "watch-glass",
      location: "workbench",
    }, "The watch glass is on the workbench."),
    atomId: "atom.place.weighed-vessel",
    equipmentRoleBindings: { "weighed-vessel": "watch-glass" },
    interaction: {
      type: "dragToZone",
      sourceDefinitionId: "watch-glass",
      stationId: "workbench",
      accessibleLabel: "Place the watch glass on the workbench.",
    },
  },
  {
    // The balance read below observes the watch glass, so something has to put the sodium
    // carbonate there first. This is that step, and it is a real transfer through the shared
    // solid-transfer runtime: it debits reagent-bottle-1 and credits watch-glass-1 exactly once.
    // Seeding the solid onto the watch glass in `initialState` would show the learner a sample
    // that no one prepared, which is the defect this step exists to remove.
    ...action("transfer-sodium-carbonate-to-watch-glass", "transfer", "Transfer sodium carbonate to the watch glass", {
      sourceDefinitionId: "reagent-bottle",
      sourceInstanceId: "reagent-bottle-1",
      targetDefinitionId: "watch-glass",
      targetInstanceId: "watch-glass-1",
      // 2.5 g is this demonstration's own configured preparation target — the same authored
      // quantity the fixture already stocks in the bottle. It is neither a learner measurement
      // nor a value taken from any source document, and the balance reading recorded afterwards
      // is what becomes evidence.
      massG: 2.5,
      massIsPlanTargetNotMeasurement: true,
    }, "Sodium carbonate is on the watch glass, ready to weigh."),
    // The public preparation owner for this same reagent — hard-water-practice-preparation's
    // `add-sodium-carbonate-solid` — uses this atom with the same bottle-to-vessel roles and is
    // likewise followed by a balance read. The atom says the portion stays approximate and the
    // balance produces the mass, which is exactly what happens here; nothing claims the sample
    // was weighed before it moved.
    atomId: "atom.transfer.solid-portion",
    equipmentRoleBindings: {
      "solid-reagent-source": "reagent-bottle",
      "receiving-vessel": "watch-glass",
      "solid-transfer-tool": "spatula",
    },
    interaction: {
      type: "pourInto" as const,
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "watch-glass",
      accessibleLabel: "Transfer the sodium carbonate portion from the reagent bottle onto the watch glass.",
    },
    prerequisites: [actionRule("watch-glass-placed-before-transfer", "place-watch-glass")],
  },
  {
    ...action("weigh-solid", "weigh", "Weigh sodium carbonate", {
      sourceDefinitionId: "watch-glass",
      sourceInstanceId: "watch-glass-1",
      targetDefinitionId: "analytical-balance",
      targetInstanceId: "analytical-balance-1",
      instrumentDefinitionId: "analytical-balance",
      tolerance: 0.005,
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: "Balance display for the sodium carbonate watch glass (g)",
      inputMin: 0,
      inputMinExclusive: true,
      inputStep: 0.001,
      inputRequired: true,
      unit: "g",
    }, "Mass recorded from the analytical balance.", ["weigh", "measurement"]),
    // The reagent bottle supplies the sodium carbonate, the watch glass is the support that goes
    // on the balance, and the balance is the instrument — the three roles the node copy already
    // distinguishes. This identity covers only the reading: it moves no material and asserts no
    // tare. The transfer step above is what puts the solid on the support, and the prerequisite
    // below is what stops this read from completing before it has.
    atomId: "atom.weigh.vessel-supported-balance-display",
    equipmentRoleBindings: {
      "balance-instrument": "analytical-balance",
      "weighed-vessel": "watch-glass",
    },
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "analytical-balance",
      stationId: "analytical-balance",
      accessibleLabel: "Read the balance display for the sodium carbonate on the watch glass.",
    },
    mass: {
      source: "action-input",
      outputMeasurementId: "solid-mass",
      continuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "watch-glass-1",
      },
    },
    prerequisites: [actionRule("sodium-carbonate-on-watch-glass", "transfer-sodium-carbonate-to-watch-glass")],
  },
  {
    ...action("record-solid-mass", "record", "Record mass", {
      measurementId: "solid-mass",
      label: "Solid mass",
      unit: "g",
      copyExistingMeasurementOnly: true,
    }, "Mass evidence recorded in the notebook.", ["record", "notebook"]),
    interaction: {
      type: "recordNotebook",
      valueParameter: "measurementId",
      accessibleLabel: "Copy the sodium carbonate mass from the balance into the notebook.",
    },
  },
];

const weighingNodes = [
  node("place-watch-glass-node", "Place watch glass", "Place the watch glass on the workbench.", "place-watch-glass", [
    actionRule("placed-watch-glass", "place-watch-glass"),
  ]),
  node("transfer-sodium-carbonate-node", "Transfer sodium carbonate", "Transfer the 2.5 g sodium carbonate portion from the reagent bottle onto the watch glass.", "transfer-sodium-carbonate-to-watch-glass", [
    actionRule("transferred-sodium-carbonate", "transfer-sodium-carbonate-to-watch-glass"),
  ]),
  node("weigh-solid-node", "Weigh solid", "Read the analytical balance for the sodium carbonate on the watch glass.", "weigh-solid", [
    actionRule("weighed-solid", "weigh-solid"),
    measurementRule("solid-mass-recorded", "solid-mass"),
  ]),
  node("record-mass-node", "Record mass", "Record the sodium carbonate mass in the lab notebook.", "record-solid-mass", [
    actionRule("recorded-solid-mass", "record-solid-mass"),
  ], "observation"),
];

export const weighingTechnique: TechniqueDefinition = withContents(
  {
    id: "weighing",
    title: "Weigh a Solid",
    learningGoal: "Use an analytical balance to collect reproducible mass evidence.",
    requiredEquipment: ["analytical-balance", "watch-glass", "reagent-bottle", "spatula"],
    initialState: {
      equipment: baseEquipment(["analytical-balance", "watch-glass", "reagent-bottle", "spatula"]),
    },
    actions: weighingActions,
    process: linearProcess(weighingNodes),
    successCriteria: [measurementRule("solid-mass-success", "solid-mass")],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "weighing"]),
  },
  "reagent-bottle-1",
  solid("Sodium carbonate", 2.5),
);

const measuringActions: ActionDefinition[] = [
  {
    ...action("place-cylinder", "place", "Place graduated cylinder", {
      equipmentDefinitionId: "graduated-cylinder",
      location: "workbench",
    }, "The graduated cylinder is ready on the bench."),
    atomId: "atom.place.variable-volume-device",
    equipmentRoleBindings: { "variable-volume-measuring-device": "graduated-cylinder" },
    interaction: {
      type: "dragToZone",
      sourceDefinitionId: "graduated-cylinder",
      stationId: "workbench",
      accessibleLabel: "Place the graduated cylinder on the workbench.",
    },
  },
  {
    ...action("measure-20ml", "measureVolume", "Measure 20 mL sample", {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "sample-volume",
      volumeMl: 20,
      tolerance: 1,
    }, "The graduated cylinder contains 20 mL of sample.", ["measureVolume", "measurement"]),
    interaction: {
      type: "pourInto" as const,
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "graduated-cylinder",
      valueParameter: "volumeMl",
      accessibleLabel: "Pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 mL.",
      successCue: "The meniscus is at 20 mL in the graduated cylinder.",
      invalidCue: "Use the sample bottle as the source and the graduated cylinder as the measuring instrument.",
    },
    atomId: "atom.measure.variable-volume",
    equipmentRoleBindings: {
      "variable-volume-measuring-device": "graduated-cylinder",
      "liquid-source": "sample-bottle",
    },
  },
  action("record-volume", "record", "Record sample volume", {
    measurementId: "sample-volume",
    label: "Sample volume",
    unit: "mL",
  }, "Volume evidence recorded in the notebook.", ["record", "notebook"]),
];

export const measuringVolumeTechnique: TechniqueDefinition = withContents(
  {
    id: "measuring-volume",
    title: "Measure Liquid Volume",
    learningGoal: "Measure a fixed liquid volume using a calibrated cylinder.",
    requiredEquipment: ["sample-bottle", "graduated-cylinder"],
    initialState: {
      equipment: baseEquipment(["sample-bottle", "graduated-cylinder"]),
    },
    actions: measuringActions,
    process: linearProcess([
      node("place-cylinder-node", "Place cylinder", "Place the graduated cylinder on the workbench.", "place-cylinder", [
        actionRule("placed-cylinder", "place-cylinder"),
      ]),
      node("measure-sample-node", "Measure sample", "Pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 mL.", "measure-20ml", [
        actionRule("measured-sample", "measure-20ml"),
        measurementRule("sample-volume-evidence", "sample-volume"),
      ]),
      node("record-volume-node", "Record volume", "Record the 20 mL sample volume in the notebook.", "record-volume", [
        actionRule("recorded-volume", "record-volume"),
      ], "observation"),
    ]),
    successCriteria: [measurementRule("volume-success", "sample-volume")],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "volume"]),
  },
  "sample-bottle-1",
  liquid("Hard water sample", 120),
);

export const transferTechnique: TechniqueDefinition = withContents(
  {
    id: "transfer",
    title: "Transfer Liquid",
    learningGoal: "Move a measured liquid volume between containers without overflow.",
    requiredEquipment: ["graduated-cylinder", "beaker-250ml"],
    initialState: {
      equipment: baseEquipment(["graduated-cylinder", "beaker-250ml"]),
    },
    actions: [
      {
        ...action("place-beaker", "place", "Place beaker", {
          equipmentDefinitionId: "beaker-250ml",
          location: "workbench",
        }, "The beaker is ready."),
        atomId: "atom.place.select-clean-dry-receiving-vessel",
        equipmentRoleBindings: { "receiving-vessel": "beaker-250ml" },
        interaction: {
          type: "dragToZone",
          sourceDefinitionId: "beaker-250ml",
          stationId: "workbench",
          accessibleLabel: "Place the 250 mL beaker on the workbench.",
        },
      },
      {
        ...action("transfer-sample", "transfer", "Transfer measured sample", {
          sourceDefinitionId: "graduated-cylinder",
          targetDefinitionId: "beaker-250ml",
          volumeMl: 20,
        }, "The 20 mL sample is transferred to the beaker."),
        interaction: {
          type: "pourInto" as const,
          sourceDefinitionId: "graduated-cylinder",
          targetDefinitionId: "beaker-250ml",
          valueParameter: "volumeMl",
          accessibleLabel: "Pour 20 mL of sample from the graduated cylinder into the 250 mL beaker.",
          successCue: "The graduated cylinder is emptied into the beaker.",
          invalidCue: "Use the graduated cylinder as the source and the beaker as the receiving container.",
        },
        atomId: "atom.transfer.measured-liquid-aliquot",
        equipmentRoleBindings: {
          "measured-liquid-source": "graduated-cylinder",
          "receiving-vessel": "beaker-250ml",
        },
      },
      action("observe-transfer", "observe", "Observe transferred sample", {
        note: "Transferred sample is clear with no spill.",
        tag: "transfer-observation",
      }, "Observation recorded.", ["observe", "notebook"]),
    ],
    process: linearProcess([
      node("place-beaker-node", "Place beaker", "Place the 250 mL beaker on the workbench.", "place-beaker", [
        actionRule("placed-beaker", "place-beaker"),
      ]),
      node("transfer-sample-node", "Transfer sample", "Pour 20 mL of sample from the graduated cylinder into the 250 mL beaker.", "transfer-sample", [
        actionRule("transferred-sample", "transfer-sample"),
      ]),
      node("observe-transfer-node", "Observe transfer", "Record whether the transferred sample is clear and unspilled.", "observe-transfer", [
        actionRule("observed-transfer", "observe-transfer"),
      ], "observation"),
    ]),
    successCriteria: [actionRule("transfer-success", "transfer-sample")],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "transfer"]),
  },
  "graduated-cylinder-1",
  liquid("Measured water sample", 20),
);

export const solutionTechnique: TechniqueDefinition = withContents(
  withContents(
    {
    id: "making-solution",
    title: "Make a Solution",
    learningGoal: "Dissolve a weighed solid in solvent and track concentration state.",
    requiredEquipment: ["volumetric-flask", "reagent-bottle", "wash-bottle", "stirring-rod"],
    initialState: {
      equipment: baseEquipment(["volumetric-flask", "reagent-bottle", "wash-bottle", "stirring-rod"]),
    },
    actions: [
      {
        ...action("add-solvent", "transfer", "Add solvent", {
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "volumetric-flask",
          volumeMl: 80,
        }, "Solvent is in the flask."),
        atomId: "atom.transfer.unmeasured-solvent",
        equipmentRoleBindings: {
          "liquid-source": "wash-bottle",
          "receiving-vessel": "volumetric-flask",
        },
        interaction: {
          type: "pourInto",
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "volumetric-flask",
          valueParameter: "volumeMl",
          accessibleLabel: "Add deionized water from the wash bottle to the volumetric flask.",
        },
      },
      {
        ...action("transfer-solid-to-flask", "transfer", "Transfer solid to flask", {
          sourceDefinitionId: "reagent-bottle",
          sourceInstanceId: "reagent-bottle-1",
          targetDefinitionId: "volumetric-flask",
          targetInstanceId: "volumetric-flask-1",
          massG: 2.5,
          massIsPlanTargetNotMeasurement: true,
        }, "The planned solid portion is in the flask."),
        atomId: "atom.transfer.solid-portion",
        equipmentRoleBindings: {
          "solid-reagent-source": "reagent-bottle",
          "receiving-vessel": "volumetric-flask",
        },
        solidTransfer: { mode: "measured-portion", destinationRepresentation: "physical" },
        interaction: {
          type: "pourInto",
          sourceDefinitionId: "reagent-bottle",
          targetDefinitionId: "volumetric-flask",
          accessibleLabel: "Transfer the solid portion from the reagent bottle into the volumetric flask.",
        },
      },
      {
        ...action("dissolve-solid", "dissolve", "Dissolve solid", {
          sourceDefinitionId: "reagent-bottle",
          sourceInstanceId: "reagent-bottle-1",
          targetDefinitionId: "volumetric-flask",
          targetInstanceId: "volumetric-flask-1",
          soluteMassG: 2.5,
        }, "The solution is homogeneous."),
        atomId: "atom.dissolve.solid-in-solvent",
        equipmentRoleBindings: { "receiving-vessel": "volumetric-flask" },
        interaction: {
          type: "pourInto",
          sourceDefinitionId: "reagent-bottle",
          targetDefinitionId: "volumetric-flask",
          accessibleLabel: "Dissolve the solid portion in the solvent already in the volumetric flask.",
        },
      },
      {
        ...action("dilute-solution-to-mark", "dilute", "Dilute solution to mark", {
          sourceDefinitionId: "wash-bottle",
          sourceInstanceId: "wash-bottle-1",
          targetDefinitionId: "volumetric-flask",
          targetInstanceId: "volumetric-flask-1",
          finalVolumeMl: 100,
        }, "The solution reaches the volumetric mark."),
        atomId: "atom.dilute.unmeasured-solvent-to-mark",
        equipmentRoleBindings: {
          "liquid-source": "wash-bottle",
          "receiving-vessel": "volumetric-flask",
        },
        interaction: {
          type: "pourInto",
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "volumetric-flask",
          accessibleLabel: "Add deionized water until the solution reaches the volumetric mark.",
        },
      },
      action("observe-solution", "observe", "Observe solution", {
        note: "Solution is clear and fully dissolved.",
        tag: "solution-observation",
      }, "Observation recorded.", ["observe", "notebook"]),
    ],
    process: linearProcess([
      node("add-solvent-node", "Add solvent", "Add 80 mL of deionized water from the wash bottle to the volumetric flask.", "add-solvent", [
        actionRule("added-solvent", "add-solvent"),
      ]),
      node("transfer-solid-node", "Transfer solid", "Transfer the planned solid portion from the reagent bottle into the volumetric flask.", "transfer-solid-to-flask", [
        actionRule("transferred-solid", "transfer-solid-to-flask"),
      ]),
      node("dissolve-solid-node", "Dissolve solid", "Dissolve the transferred solid in the volumetric flask.", "dissolve-solid", [
        actionRule("dissolved-solid", "dissolve-solid"),
      ]),
      node("dilute-solution-node", "Dilute solution to mark", "Add deionized water until the solution reaches the volumetric mark.", "dilute-solution-to-mark", [
        actionRule("diluted-solution", "dilute-solution-to-mark"),
      ]),
      node("observe-solution-node", "Observe solution", "Record that the solution is clear and fully dissolved.", "observe-solution", [
        actionRule("observed-solution", "observe-solution"),
      ], "observation"),
    ]),
    successCriteria: [actionRule("solution-success", "dilute-solution-to-mark")],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
      metadata: metadata(["technique", "solution"]),
    },
    "reagent-bottle-1",
    solid("Prepared solid", 2.5),
  ),
  "wash-bottle-1",
  liquid("Deionized water", 500),
);

export const dilutionTechnique: TechniqueDefinition = withContents(
  {
    id: "dilution",
    title: "Dilute a Stock Solution",
    learningGoal: "Create a target dilution from an aliquot and final volume.",
    requiredEquipment: ["graduated-cylinder", "volumetric-flask", "wash-bottle"],
    initialState: {
      equipment: baseEquipment(["graduated-cylinder", "volumetric-flask", "wash-bottle"]),
    },
    actions: [
      {
        ...action("transfer-aliquot", "transfer", "Transfer aliquot", {
          sourceDefinitionId: "graduated-cylinder",
          sourceInstanceId: "graduated-cylinder-1",
          targetDefinitionId: "volumetric-flask",
          targetInstanceId: "volumetric-flask-1",
          volumeMl: 10,
        }, "Aliquot transferred."),
        atomId: "atom.transfer.measured-liquid-aliquot",
        equipmentRoleBindings: {
          "measured-liquid-source": "graduated-cylinder",
          "receiving-vessel": "volumetric-flask",
        },
        interaction: {
          type: "pourInto",
          sourceDefinitionId: "graduated-cylinder",
          targetDefinitionId: "volumetric-flask",
          valueParameter: "volumeMl",
          accessibleLabel: "Transfer 10 mL of stock solution from the graduated cylinder into the volumetric flask.",
        },
      },
      {
        ...action("dilute-to-mark", "dilute", "Dilute to mark", {
          sourceDefinitionId: "wash-bottle",
          sourceInstanceId: "wash-bottle-1",
          targetDefinitionId: "volumetric-flask",
          targetInstanceId: "volumetric-flask-1",
          finalVolumeMl: 100,
          dilutionFactor: 10,
        }, "Dilution factor recorded."),
        atomId: "atom.dilute.unmeasured-solvent-to-mark",
        equipmentRoleBindings: {
          "liquid-source": "wash-bottle",
          "receiving-vessel": "volumetric-flask",
        },
        interaction: {
          type: "pourInto",
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "volumetric-flask",
          accessibleLabel: "Add deionized water from the wash bottle to bring the volumetric flask to the mark.",
        },
      },
      action("record-dilution", "record", "Record dilution", {
        measurementId: "dilution-factor",
        label: "Dilution factor",
        value: 10,
        unit: "x",
      }, "Dilution evidence recorded.", ["record", "notebook"]),
    ],
    process: linearProcess([
      node("transfer-aliquot-node", "Transfer aliquot", "Pour 10 mL of stock solution from the graduated cylinder into the volumetric flask.", "transfer-aliquot", [
        actionRule("aliquot-transferred", "transfer-aliquot"),
      ]),
      node("dilute-to-mark-node", "Dilute to mark", "Add deionized water from the wash bottle to bring the volumetric flask to 100 mL.", "dilute-to-mark", [
        actionRule("diluted-to-mark", "dilute-to-mark"),
      ]),
      node("record-dilution-node", "Record dilution", "Record the 10x dilution factor in the notebook.", "record-dilution", [
        actionRule("recorded-dilution", "record-dilution"),
      ], "observation"),
    ]),
    successCriteria: [actionRule("dilution-success", "dilute-to-mark")],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "dilution"]),
  },
  "graduated-cylinder-1",
  {
    kind: "solution",
    label: "Stock solution",
    volumeMl: 10,
    solutes: [{ id: "stock-solute", label: "Stock solute", amount: 10, unit: "mg" }],
    concentration: { value: 1000, unit: "mg/L" },
    contamination: [],
    wetState: "wet",
    visualState: "clear-solution",
  },
);

export const transmittanceDilutionTechnique: TechniqueDefinition = transmittanceDilutionTechniqueJson as unknown as TechniqueDefinition;

export const filtrationTechnique: TechniqueDefinition = withContents(
  {
    id: "filtration",
    title: "Filter a Precipitate",
    learningGoal: "Collect a precipitate with filter paper, rinse it, and preserve evidence.",
    requiredEquipment: [
      "beaker-250ml",
      "ring-stand",
      "funnel",
      "filter-paper",
      "funnel-stand",
      "erlenmeyer-flask-250ml",
      "wash-bottle",
    ],
    initialState: {
      equipment: baseEquipment([
        "beaker-250ml",
        "ring-stand",
        "funnel",
        "filter-paper",
        "funnel-stand",
        "erlenmeyer-flask-250ml",
        "wash-bottle",
      ]).map((instance) =>
        instance.definitionId === "funnel-stand"
          ? { ...instance, location: "storage" as const }
          : instance,
      ),
    },
    actions: [
      {
        ...action("assemble-funnel-stand", "place", "Assemble funnel stand", {
          equipmentDefinitionId: "funnel",
          targetDefinitionId: "ring-stand",
          snapZoneId: "ring-stand-funnel-seat",
          compositeDefinitionId: "funnel-stand",
        }, "The funnel is seated in the circular support ring."),
        interaction: {
          type: "snapIntoTarget",
          sourceDefinitionId: "funnel",
          targetDefinitionId: "ring-stand",
          snapZoneId: "ring-stand-funnel-seat",
          accessibleLabel: "Seat the glass funnel in the circular support ring on the stand.",
          successCue: "The funnel is centered in the circular support ring.",
          invalidCue: "Use the circular support ring on the stand so the funnel cone rests evenly.",
        },
        atomId: "atom.place.filtration-funnel",
        equipmentRoleBindings: {
          "filtration-funnel": "funnel",
          "filtration-support": "ring-stand",
        },
      },
      {
        ...action("place-filter-paper", "place", "Place filter paper", {
          equipmentDefinitionId: "filter-paper",
          targetDefinitionId: "funnel-stand",
        }, "Filter paper is seated in the funnel."),
        interaction: {
          type: "snapIntoTarget",
          sourceDefinitionId: "filter-paper",
          targetDefinitionId: "funnel-stand",
          snapZoneId: "funnel-stand-paper-seat",
          accessibleLabel: "Seat the filter paper in the funnel.",
          successCue: "Filter paper is seated in the funnel.",
          invalidCue: "Align the paper with the funnel cone before releasing it.",
        },
        atomId: "atom.place.filter-medium",
        equipmentRoleBindings: {
          "filtration-funnel": "funnel-stand",
          "filter-medium": "filter-paper",
        },
      },
      {
        ...action("wet-filter-paper", "rinse", "Wet filter paper", {
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "filter-paper",
          rinseType: "pre-wet",
        }, "Filter paper is wetted and sealed.", ["rinse", "notebook"]),
        interaction: {
          type: "rinseTarget",
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "filter-paper",
          accessibleLabel: "Wet the seated filter paper with the wash bottle.",
          successCue: "Filter paper is wetted and sealed.",
          invalidCue: "Seat the filter paper in the funnel before wetting it.",
        },
        atomId: "atom.rinse.wet-filter-medium",
        equipmentRoleBindings: {
          "rinse-water-source": "wash-bottle",
          "filter-medium": "filter-paper",
        },
      },
      {
        ...action("place-filtration-receiver", "place", "Place receiving flask", {
          equipmentDefinitionId: "erlenmeyer-flask-250ml",
          targetDefinitionId: "funnel-stand",
          snapZoneId: "funnel-receiving-vessel-zone",
        }, "Receiving flask is under the funnel."),
        interaction: {
          type: "snapIntoTarget" as const,
          sourceDefinitionId: "erlenmeyer-flask-250ml",
          targetDefinitionId: "funnel-stand",
          snapZoneId: "funnel-receiving-vessel-zone",
          accessibleLabel: "Place the receiving flask under the funnel.",
          successCue: "Receiving flask is under the funnel.",
          invalidCue: "Use a beaker or Erlenmeyer flask under the funnel stem.",
        },
        atomId: "atom.place.filtration-receiver",
        equipmentRoleBindings: { "filtration-receiver": "erlenmeyer-flask-250ml" },
      },
      {
        ...action("filter-mixture", "filter", "Filter mixture", {
          sourceDefinitionId: "beaker-250ml",
          targetDefinitionId: "funnel-stand",
        }, "Precipitate remains on the filter paper."),
        interaction: {
          type: "pourInto",
          sourceDefinitionId: "beaker-250ml",
          targetDefinitionId: "funnel-stand",
          accessibleLabel: "Pour the beaker mixture through the prepared funnel with seated, wetted filter paper.",
          successCue: "Precipitate remains on the filter paper.",
          invalidCue: "Seat and wet the filter paper in the funnel before pouring the beaker mixture.",
        },
        atomId: "atom.filter.pour-through-medium",
        equipmentRoleBindings: {
          "mixture-source": "beaker-250ml",
          "filtration-funnel": "funnel-stand",
          "filtration-receiver": "erlenmeyer-flask-250ml",
        },
      },
      {
        ...action("rinse-precipitate", "rinse", "Rinse precipitate", {
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "filter-paper",
          rinseType: "precipitate",
        }, "Precipitate rinse evidence recorded.", ["rinse", "notebook"]),
        interaction: {
          type: "rinseTarget",
          sourceDefinitionId: "wash-bottle",
          targetDefinitionId: "filter-paper",
          accessibleLabel: "Rinse the collected filter cake on the filter paper with the wash bottle.",
          successCue: "Precipitate rinse evidence recorded.",
          invalidCue: "Collect precipitate in the funnel before rinsing it.",
        },
        atomId: "atom.rinse.wash-precipitate",
        equipmentRoleBindings: {
          "rinse-water-source": "wash-bottle",
          "filter-medium": "filter-paper",
        },
      },
    ],
    process: linearProcess([
      node("assemble-funnel-stand-node", "Assemble funnel stand", "Seat the glass funnel in the circular support ring on the stand.", "assemble-funnel-stand", [
        actionRule("assembled-funnel-stand", "assemble-funnel-stand"),
      ]),
      node("place-filter-node", "Place filter paper", "Seat the filter paper in the funnel.", "place-filter-paper", [
        actionRule("placed-filter-paper", "place-filter-paper"),
      ]),
      node("wet-filter-node", "Wet filter paper", "Wet the seated filter paper with the wash bottle.", "wet-filter-paper", [
        actionRule("wetted-filter-paper", "wet-filter-paper"),
      ]),
      node("place-receiver-node", "Place receiver", "Place the receiving flask under the funnel.", "place-filtration-receiver", [
        actionRule("placed-filtration-receiver", "place-filtration-receiver"),
      ]),
      node("filter-mixture-node", "Filter mixture", "Pour the beaker mixture through the prepared funnel with seated, wetted filter paper.", "filter-mixture", [
        actionRule("filtered-mixture", "filter-mixture"),
      ]),
      node("rinse-precipitate-node", "Rinse precipitate", "Rinse the collected filter cake on the filter paper with the wash bottle.", "rinse-precipitate", [
        actionRule("rinsed-precipitate", "rinse-precipitate"),
      ], "checkpoint"),
    ]),
    successCriteria: [actionRule("filtration-success", "filter-mixture")],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "filtration"]),
  },
  "beaker-250ml-1",
  mixtureWithPrecipitate("Calcium carbonate mixture", 40, 0.0075),
);

export const dryingTechnique: TechniqueDefinition = withContents(
  {
    id: "drying",
    title: "Dry and Weigh a Precipitate",
    learningGoal: "Dry a precipitate to stable mass and record the calculation evidence.",
    requiredEquipment: ["watch-glass", "drying-oven", "crucible-tongs", "analytical-balance"],
    initialState: {
      equipment: baseEquipment(["watch-glass", "drying-oven", "crucible-tongs", "analytical-balance"]),
    },
    actions: [
      {
        ...action("dry-precipitate", "dry", "Dry precipitate", {
          targetDefinitionId: "watch-glass",
          ovenDefinitionId: "drying-oven",
          dryMassG: 0.0075,
        }, "The precipitate is dry enough to weigh."),
        interaction: {
          type: "placeInInstrument",
          sourceDefinitionId: "watch-glass",
          targetDefinitionId: "drying-oven",
          stationId: "drying-oven",
          accessibleLabel: "Place the watch glass with rinsed precipitate in the drying oven.",
          successCue: "The precipitate is dry enough to weigh.",
          invalidCue: "Only a watch glass carrying rinsed precipitate belongs in the drying oven.",
        },
        atomId: "atom.dry.oven-stage",
        equipmentRoleBindings: {
          "drying-instrument": "drying-oven",
          "dried-assembly": "watch-glass",
        },
      },
      {
        ...action("weigh-dry-precipitate", "weigh", "Weigh dry precipitate", {
          sourceDefinitionId: "watch-glass",
          sourceInstanceId: "watch-glass-1",
          tolerance: 0.0005,
          inputMode: "numeric",
          inputRole: "studentResponse",
          inputLabel: "Balance display for the cooled dry watch glass (g)",
          inputMin: 0,
          inputMinExclusive: true,
          inputStep: 0.001,
          inputRequired: true,
          unit: "g",
        }, "Dry precipitate mass recorded.", ["weigh", "measurement"]),
        // Reading the balance value for the watch glass. This identity does not assert that an
        // oven-drying endpoint was reached, that a gross/net difference was taken, or that a
        // cooling prerequisite was satisfied — this fixture authors no cooling step at all, which
        // is recorded as pre-existing debt rather than resolved by the binding. The dry-precipitate
        // gate in the weigh handler still keys on the `dry-precipitate-mass` output id below.
        atomId: "atom.weigh.vessel-supported-balance-display",
        equipmentRoleBindings: {
          "balance-instrument": "analytical-balance",
          "weighed-vessel": "watch-glass",
        },
        interaction: {
          type: "readInstrument",
          sourceDefinitionId: "watch-glass",
          targetDefinitionId: "analytical-balance",
          stationId: "analytical-balance",
          accessibleLabel: "Place the dry watch glass on the analytical balance and record the mass.",
          successCue: "Dry precipitate mass recorded.",
          invalidCue: "Only dry precipitate on the watch glass should be weighed.",
        },
        mass: {
          source: "action-input",
          outputMeasurementId: "dry-precipitate-mass",
          continuity: {
            version: 1,
            quantityKind: "balance-display",
            measuredSupportInstanceId: "watch-glass-1",
          },
        },
      },
      {
        ...action("record-dry-mass", "record", "Record dry mass", {
          measurementId: "dry-precipitate-mass",
          label: "Dry precipitate mass",
          unit: "g",
          copyExistingMeasurementOnly: true,
        }, "Dry mass recorded in the notebook.", ["record", "notebook"]),
        interaction: {
          type: "recordNotebook",
          valueParameter: "measurementId",
          accessibleLabel: "Copy the dry precipitate mass from the balance into the notebook.",
        },
      },
    ],
    process: linearProcess([
      node("dry-precipitate-node", "Dry precipitate", "Place the watch glass with rinsed precipitate in the drying oven.", "dry-precipitate", [
        actionRule("dried-precipitate", "dry-precipitate"),
      ]),
      node("weigh-dry-node", "Weigh dry precipitate", "Place the dry watch glass on the analytical balance and record the mass.", "weigh-dry-precipitate", [
        actionRule("weighed-dry-precipitate", "weigh-dry-precipitate"),
        measurementRule("dry-mass-evidence", "dry-precipitate-mass"),
      ]),
      node("record-dry-node", "Record dry mass", "Record the stable dry precipitate mass in the notebook.", "record-dry-mass", [
        actionRule("recorded-dry-mass", "record-dry-mass"),
      ], "observation"),
    ]),
    successCriteria: [measurementRule("dry-mass-success", "dry-precipitate-mass")],
    commonMistakes: invalidCases,
    resetBehavior: "resetTechnique",
    metadata: metadata(["technique", "drying"]),
  },
  "watch-glass-1",
  {
    kind: "precipitate",
    label: "Wet calcium carbonate",
    massG: 0.0081,
    solutes: [],
    precipitate: {
      substance: "Calcium carbonate",
      massG: 0.0081,
      dryMassG: 0.0075,
      rinsed: true,
      dryness: "damp",
    },
    contamination: [],
    wetState: "rinsed",
    visualState: "damp-precipitate",
  },
);

export const thermalDecompositionTechnique: TechniqueDefinition = thermalDecompositionTechniqueJson as unknown as TechniqueDefinition;

export const calculationTechnique: TechniqueDefinition = {
  id: "hard-water-calculation",
  title: "Calculate Hardness",
  learningGoal: "Calculate mg/L hardness as CaCO3 from precipitate mass and sample volume.",
  requiredEquipment: ["analytical-balance"],
  initialState: {
    equipment: baseEquipment(["analytical-balance"]),
  },
  actions: [
    action("calculate-hardness", "calculate", "Calculate hardness", {
      calculationId: "hardness-mg-l",
      template: "hardnessMgLAsCaCO3",
      precipitateMassG: 0.0075,
      sampleVolumeMl: 20,
      expected: 375,
      tolerance: 0.5,
    }, "Hardness calculation is within tolerance.", ["calculate"]),
  ],
  process: linearProcess([
    node("calculate-hardness-node", "Calculate hardness", "Calculate hardness in mg/L as CaCO3 from the precipitate mass and sample volume.", "calculate-hardness", [
      calculationRule("hardness-calculation-valid", "hardness-mg-l", 0.5),
    ], "calculation"),
  ]),
  successCriteria: [calculationRule("hardness-success", "hardness-mg-l", 0.5)],
  commonMistakes: invalidCases,
  resetBehavior: "resetTechnique",
  metadata: metadata(["technique", "calculation", "hard-water-reference"]),
};

export const standaloneTechniques: TechniqueDefinition[] = [
  weighingTechnique,
  measuringVolumeTechnique,
  solutionTechnique,
  dilutionTechnique,
  transmittanceDilutionTechnique,
  transferTechnique,
  filtrationTechnique,
  dryingTechnique,
  thermalDecompositionTechnique,
  calculationTechnique,
];

export const hardWaterSamples = [
  { id: "sample-1", label: "Sample 1", precipitateMassG: 0.0075, hardnessMgL: 375 },
  { id: "sample-2", label: "Sample 2", precipitateMassG: 0.002, hardnessMgL: 100 },
  { id: "sample-3", label: "Sample 3", precipitateMassG: 0.005, hardnessMgL: 250 },
  { id: "sample-4", label: "Sample 4", precipitateMassG: 0.001, hardnessMgL: 50 },
  { id: "sample-5", label: "Sample 5", precipitateMassG: 0.0005, hardnessMgL: 25 },
  { id: "sample-6", label: "Sample 6", precipitateMassG: 0.009, hardnessMgL: 450 },
] as const;

const hardWaterCalculationAction: ActionDefinition = {
  ...calculationTechnique.actions[0],
  parameters: {
    calculationId: "hardness-mg-l",
    template: "hardnessMgLAsCaCO3",
    expected: 375,
    tolerance: 0.5,
  },
  prerequisites: [
    measurementRule("hardness-sample-volume-required", "sample-volume"),
    measurementRule("hardness-dry-mass-required", "dry-precipitate-mass"),
    notebookRule("hardness-volume-notebook-required", "sample-volume"),
    notebookRule("hardness-mass-notebook-required", "dry-precipitate-mass"),
  ],
  feedback: {
    success: "Hardness calculation is within tolerance.",
    invalid: "Record the sample volume and dry precipitate mass before calculating hardness.",
  },
  evidence: ["calculate", "measurement", "notebook"],
};

const hardWaterInitialEquipment = baseEquipment([
  "sample-bottle",
  "graduated-cylinder",
  "beaker-250ml",
  "reagent-bottle",
  "ring-stand",
  "funnel",
  "filter-paper",
  "funnel-stand",
  "erlenmeyer-flask-250ml",
  "wash-bottle",
  "watch-glass",
  "drying-oven",
  "crucible-tongs",
  "analytical-balance",
]).map((instance) => {
  if (instance.id === "sample-bottle-1") {
    return { ...instance, contents: liquid("Hard water sample", 120) };
  }
  if (instance.id === "reagent-bottle-1") {
    return { ...instance, contents: liquid("Carbonate reagent", 20) };
  }
  if (instance.definitionId === "funnel-stand") {
    return { ...instance, location: "storage" as const };
  }
  return instance;
});

const transferSampleAction = transferTechnique.actions.find(
  (candidate) => candidate.id === "transfer-sample",
)!;

const hardWaterActions: ActionDefinition[] = [
  ...measuringActions,
  transferSampleAction,
  {
    ...action("precipitate-caco3", "precipitate", "Precipitate calcium carbonate", {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "beaker-250ml",
      precipitateMassG: 0.0075,
      finalVolumeMl: 40,
    }, "Calcium carbonate precipitate is represented structurally."),
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "beaker-250ml",
      accessibleLabel: "Pour carbonate reagent from the reagent bottle into the beaker.",
      successCue: "Calcium carbonate precipitate is represented structurally.",
      invalidCue: "Add reagent to the beaker after measuring the water sample.",
    },
    atomId: "atom.precipitate.form-gravimetric-solid",
    equipmentRoleBindings: {
      "precipitation-vessel": "beaker-250ml",
      "precipitating-reagent-source": "reagent-bottle",
    },
  },
  ...filtrationTechnique.actions,
  ...dryingTechnique.actions,
  hardWaterCalculationAction,
];

const hardWaterNodes = [
  node("measure-sample-node", "Measure sample", "Pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 mL.", "measure-20ml", [
    actionRule("hw-measured-sample", "measure-20ml"),
    measurementRule("hw-volume", "sample-volume"),
  ]),
  node("record-volume-node", "Record sample volume", "Record the 20 mL sample volume in the notebook.", "record-volume", [
    actionRule("hw-recorded-volume", "record-volume"),
    notebookRule("hw-volume-notebook", "sample-volume"),
  ], "observation"),
  node("transfer-sample-node", "Transfer sample", "Pour 20 mL of sample from the graduated cylinder into the 250 mL beaker.", "transfer-sample", [
    actionRule("hw-transferred-sample", "transfer-sample"),
  ]),
  node("precipitate-node", "Precipitate calcium carbonate", "Pour carbonate reagent from the reagent bottle into the beaker to form calcium carbonate precipitate.", "precipitate-caco3", [
    actionRule("hw-precipitated", "precipitate-caco3"),
  ], "action", { reference: "hard-water" }),
  node("assemble-funnel-stand-node", "Assemble funnel stand", "Seat the glass funnel in the circular support ring on the stand.", "assemble-funnel-stand", [
    actionRule("hw-assembled-funnel-stand", "assemble-funnel-stand"),
  ]),
  node("place-filter-node", "Place filter paper", "Seat the filter paper in the funnel.", "place-filter-paper", [
    actionRule("hw-placed-filter-paper", "place-filter-paper"),
  ]),
  node("wet-filter-node", "Wet filter paper", "Wet the seated filter paper with the wash bottle.", "wet-filter-paper", [
    actionRule("hw-wetted-filter-paper", "wet-filter-paper"),
  ]),
  node("place-receiver-node", "Place receiver", "Place the receiving flask under the funnel.", "place-filtration-receiver", [
    actionRule("hw-placed-receiver", "place-filtration-receiver"),
  ]),
  node("filter-node", "Filter precipitate", "Pour the beaker mixture through the prepared funnel with seated, wetted filter paper.", "filter-mixture", [
    actionRule("hw-filtered", "filter-mixture"),
  ], "checkpoint"),
  node("rinse-node", "Rinse precipitate", "Rinse the collected filter cake on the filter paper with the wash bottle.", "rinse-precipitate", [
    actionRule("hw-rinsed", "rinse-precipitate"),
  ], "checkpoint"),
  node("dry-node", "Dry precipitate", "Place the watch glass with rinsed precipitate in the drying oven.", "dry-precipitate", [
    actionRule("hw-dried", "dry-precipitate"),
  ]),
  node("weigh-node", "Weigh dry precipitate", "Place the dry watch glass on the analytical balance and record the mass.", "weigh-dry-precipitate", [
    actionRule("hw-weighed-dry-mass", "weigh-dry-precipitate"),
    measurementRule("hw-dry-mass", "dry-precipitate-mass"),
  ]),
  node("record-dry-mass-node", "Record dry mass", "Record the dry precipitate mass in the notebook.", "record-dry-mass", [
    actionRule("hw-recorded-dry-mass", "record-dry-mass"),
    notebookRule("hw-dry-mass-notebook", "dry-precipitate-mass"),
  ], "observation"),
  node("calculate-node", "Calculate hardness", "Calculate hardness in mg/L as CaCO3 using the sample volume and dry precipitate mass.", "calculate-hardness", [
    calculationRule("hw-hardness", "hardness-mg-l", 0.5),
  ], "calculation"),
];

export const hardWaterDemoLab: LabDefinition = {
  id: "hard-water-demo",
  title: "Hard-Water Reference Demo",
  description:
    "A schema-authored gravimetric hard-water workflow used as reference content for reusable Lab Studio techniques.",
  audience: "General chemistry students",
  learningGoals: [
    "Measure a fixed sample volume.",
    "Collect and dry a precipitate.",
    "Calculate hardness as mg/L CaCO3.",
  ],
  safetyNotes: [
    "Wear goggles and follow local disposal guidance.",
    "Use tongs for hot glassware and let samples cool before weighing.",
  ],
  equipment: [
    "sample-bottle",
    "graduated-cylinder",
    "beaker-250ml",
    "reagent-bottle",
    "ring-stand",
    "funnel",
    "filter-paper",
    "funnel-stand",
    "erlenmeyer-flask-250ml",
    "wash-bottle",
    "watch-glass",
    "drying-oven",
    "crucible-tongs",
    "analytical-balance",
  ],
  initialState: {
    equipment: hardWaterInitialEquipment,
  },
  techniques: [
    measuringVolumeTechnique,
    transferTechnique,
    filtrationTechnique,
    dryingTechnique,
    calculationTechnique,
  ],
  actions: hardWaterActions,
  process: linearProcess(hardWaterNodes),
  assessments: [calculationRule("hard-water-demo-success", "hardness-mg-l", 0.5)],
  metadata: metadata(["lab", "demo", "hard-water-reference"]),
};

export const demoLab: LabDefinition = {
  id: "intro-filtration-demo",
  title: "Precipitate and Filter Calcium Carbonate",
  description: "An authored lab that precipitates calcium carbonate, prepares a funnel, filters the mixture, and collects filtrate evidence.",
  audience: "Introductory chemistry students",
  learningGoals: ["Measure a sample", "Transfer liquid", "Filter a precipitate"],
  safetyNotes: ["Wear eye protection.", "Clean spills immediately."],
  equipment: [
    "sample-bottle",
    "graduated-cylinder",
    "beaker-250ml",
    "reagent-bottle",
    "ring-stand",
    "funnel",
    "filter-paper",
    "funnel-stand",
    "erlenmeyer-flask-250ml",
    "wash-bottle",
  ],
  techniques: [measuringVolumeTechnique, transferTechnique, filtrationTechnique],
  actions: [
    ...measuringActions,
    ...transferTechnique.actions,
    hardWaterActions.find((candidate) => candidate.id === "precipitate-caco3")!,
    ...filtrationTechnique.actions,
  ],
  process: linearProcess([
    node("demo-measure-node", "Measure sample", "Pour water sample from the sample bottle into the graduated cylinder until the meniscus reaches 20 mL.", "measure-20ml", [
      actionRule("demo-measure", "measure-20ml"),
    ]),
    node("demo-transfer-node", "Transfer sample", "Pour 20 mL of sample from the graduated cylinder into the 250 mL beaker.", "transfer-sample", [
      actionRule("demo-transfer", "transfer-sample"),
    ]),
    node("demo-precipitate-node", "Precipitate calcium carbonate", "Pour carbonate reagent from the reagent bottle into the beaker to form calcium carbonate precipitate.", "precipitate-caco3", [
      actionRule("demo-precipitate", "precipitate-caco3"),
    ]),
    node("demo-assemble-funnel-stand-node", "Assemble funnel stand", "Seat the glass funnel in the circular support ring on the stand.", "assemble-funnel-stand", [
      actionRule("demo-assemble-funnel-stand", "assemble-funnel-stand"),
    ]),
    node("demo-place-filter-node", "Place filter paper", "Seat the filter paper in the funnel.", "place-filter-paper", [
      actionRule("demo-place-filter", "place-filter-paper"),
    ]),
    node("demo-wet-filter-node", "Wet filter paper", "Wet the seated filter paper with the wash bottle.", "wet-filter-paper", [
      actionRule("demo-wet-filter", "wet-filter-paper"),
    ]),
    node("demo-place-receiver-node", "Place receiver", "Place the receiving flask under the funnel.", "place-filtration-receiver", [
      actionRule("demo-place-receiver", "place-filtration-receiver"),
    ]),
    node("demo-filter-node", "Filter mixture", "Pour the beaker mixture through the prepared funnel with seated, wetted filter paper.", "filter-mixture", [
      actionRule("demo-filter", "filter-mixture"),
    ]),
    node("demo-rinse-node", "Rinse precipitate", "Rinse the collected filter cake on the filter paper with the wash bottle.", "rinse-precipitate", [
      actionRule("demo-rinse", "rinse-precipitate"),
    ]),
  ]),
  assessments: [actionRule("demo-success", "rinse-precipitate")],
  metadata: metadata(["lab", "demo", "filtration"]),
};

export const bundledLabs: LabDefinition[] = [demoLab, hardWaterDemoLab];

export const findTechniqueById = (id: string): TechniqueDefinition | undefined =>
  standaloneTechniques.find((technique) => technique.id === id);

export const findLabById = (id: string): LabDefinition | undefined =>
  bundledLabs.find((lab) => lab.id === id);
