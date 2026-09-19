import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  refineHandWarmerLab,
  refineHandWarmerTechnique,
} from "./generatorInputs/handWarmerCalorimetry.mjs";
import { applyStockSupplyVolumes } from "./generatorInputs/stockSupplyVolumes.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const traceabilityPath = join(
  root,
  "experiments/lab-studio/docs/hand-warmer-calorimetry/source-traceability.md",
);
const text = readFileSync(traceabilityPath, "utf8");
const rows = [...text.matchAll(/^\| ([A-Z][A-Z0-9-]+) `([^`]+)` \| ([^|]+) \|/gm)].map(
  ([, id, basis, instruction]) => ({ id, basis, instruction: instruction.trim() }),
);

if (rows.length !== 143) {
  throw new Error(`Expected 143 traceability rows; found ${rows.length}.`);
}

const empty = () => ({
  kind: "empty",
  label: "empty",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
});

const liquid = (label, volumeMl, temperatureC) => ({
  ...empty(),
  kind: "liquid",
  label,
  volumeMl,
  temperatureC,
  wetState: "wet",
  visualState: "clear-liquid",
});

const solid = (id, label, massG) => ({
  ...empty(),
  kind: "solid",
  label,
  massG,
  solutes: [{ id, label, amount: massG, unit: "g" }],
  visualState: "powder",
});

const equipment = (id, definitionId, label, contents = empty(), location = "shelf") => ({
  id,
  definitionId,
  label,
  location,
  contents,
});

const commonInvalidCases = [
  {
    id: "wrong-sequence",
    when: "current node expects a different action",
    message: "That action is out of sequence.",
    recovery: "Complete the highlighted atomic action first.",
  },
  {
    id: "stale-evidence",
    when: "evidence belongs to an earlier trial or determination",
    message: "Earlier evidence cannot satisfy a fresh trial.",
    recovery: "Collect a new measurement in the active scope.",
  },
  {
    id: "unsafe-state",
    when: "PPE, heat, splash, ignition, or disposal constraints are not satisfied",
    message: "The current state is not safe for this action.",
    recovery: "Correct the highlighted safety condition before continuing.",
  },
];

const sourceIdFor = (row) => row.sourceId ?? row.id;

const derivedRow = (sourceRow, id, instruction) => ({
  ...sourceRow,
  id,
  instruction,
  sourceId: sourceIdFor(sourceRow),
});

const observation = (row, extra = {}) => ({
  id: row.id,
  verb: "observe",
  label: row.instruction.replace(/[.]$/, ""),
  parameters: {
    tag: row.id,
    note: row.instruction,
    ...extra,
  },
  interaction: {
    type: "recordNotebook",
    accessibleLabel: row.instruction,
    successCue: `${row.id} recorded.`,
    invalidCue: "Complete this atomic action using the current apparatus state.",
  },
  prerequisites: [],
  stateChanges: [`${row.id}: ${row.instruction}`],
  invalidCases: commonInvalidCases,
  feedback: {
    success: `${row.id} complete.`,
    invalid: `${row.id} is not complete.`,
  },
  evidence: ["notebook"],
});

const physicalMappings = {
  "CAL-01": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "hot-plate-stirrer-1",
      equipmentDefinitionId: "hot-plate-stirrer",
      targetInstanceId: "hand-warmer-calorimeter-1",
      targetDefinitionId: "hand-warmer-calorimeter",
      location: "snapZone",
      snapZoneId: "hand-warmer-stirrer-base",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-01",
    },
    atomId: "atom.place.assemble-calorimeter",
    equipmentRoleBindings: {
      "calorimeter-vessel": "hand-warmer-calorimeter",
      "stirring-device": "hot-plate-stirrer",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "hot-plate-stirrer",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-stirrer-base",
      accessibleLabel: "Place the magnetic stirrer beneath the support ring with heating off.",
    },
  },
  "CAL-02": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "outer-cup-1",
      equipmentDefinitionId: "polystyrene-cup-8oz",
      targetInstanceId: "hand-warmer-calorimeter-1",
      targetDefinitionId: "hand-warmer-calorimeter",
      location: "snapZone",
      snapZoneId: "hand-warmer-cup-support-ring",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-02",
    },
    atomId: "atom.place.assemble-calorimeter",
    equipmentRoleBindings: {
      "calorimeter-vessel": "hand-warmer-calorimeter",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "polystyrene-cup-8oz",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-cup-support-ring",
      accessibleLabel: "Lower the outer polystyrene cup through the support ring.",
    },
  },
  "CAL-03": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "inner-cup-1",
      equipmentDefinitionId: "polystyrene-cup-8oz",
      targetInstanceId: "hand-warmer-calorimeter-1",
      targetDefinitionId: "hand-warmer-calorimeter",
      location: "snapZone",
      snapZoneId: "hand-warmer-inner-cup-nest",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-03",
    },
    atomId: "atom.place.assemble-calorimeter",
    equipmentRoleBindings: {
      "calorimeter-vessel": "hand-warmer-calorimeter",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "polystyrene-cup-8oz",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-inner-cup-nest",
      accessibleLabel: "Nest the second cup inside the supported outer cup.",
    },
  },
  "CAL-04": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "wooden-cover-1",
      equipmentDefinitionId: "wooden-calorimeter-cover",
      targetInstanceId: "hand-warmer-calorimeter-1",
      targetDefinitionId: "hand-warmer-calorimeter",
      location: "snapZone",
      snapZoneId: "hand-warmer-cover-seat",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-04",
    },
    atomId: "atom.place.assemble-calorimeter",
    equipmentRoleBindings: {
      "calorimeter-vessel": "hand-warmer-calorimeter",
      "calorimeter-cover": "wooden-calorimeter-cover",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "wooden-calorimeter-cover",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-cover-seat",
      accessibleLabel: "Seat the wooden cover on the inner cup.",
    },
  },
  "CAL-05": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "probe-thermometer-1",
      equipmentDefinitionId: "probe-thermometer",
      targetInstanceId: "hand-warmer-calorimeter-1",
      targetDefinitionId: "hand-warmer-calorimeter",
      location: "snapZone",
      snapZoneId: "hand-warmer-probe-hole",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-05",
    },
    atomId: "atom.place.assemble-calorimeter",
    equipmentRoleBindings: {
      "calorimeter-vessel": "hand-warmer-calorimeter",
      "immersed-probe-instrument": "probe-thermometer",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "probe-thermometer",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-probe-hole",
      accessibleLabel: "Insert the probe through the cover without touching the cup.",
    },
  },
  "VOL-01": {
    verb: "place",
    parameters: { equipmentDefinitionId: "graduated-cylinder", location: "workbench" },
    atomId: "atom.place.calorimetry-volume-device",
    equipmentRoleBindings: {
      "variable-volume-measuring-device": "graduated-cylinder",
    },
    interaction: {
      type: "dragToZone",
      sourceDefinitionId: "graduated-cylinder",
      stationId: "workbench",
      accessibleLabel: "Place the clean graduated cylinder upright on the bench.",
    },
  },
  "VOL-02": {
    verb: "measureVolume",
    parameters: {
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "scope-water-volume",
      // C: These intermediate levels are simulator checkpoints, not a source-stated
      // measurement. The traced procedure states only the final 100.0 mL endpoint;
      // staging the approach makes the slow-pour action visibly and physically meaningful.
      volumeMl: 95,
      tolerance: 0.1,
    },
    atomId: "atom.measure.variable-volume",
    equipmentRoleBindings: {
      "variable-volume-measuring-device": "graduated-cylinder",
      "liquid-source": "distilled-water-bottle",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      valueParameter: "volumeMl",
      accessibleLabel: "Pour water into the graduated cylinder toward 100.0 mL.",
    },
  },
  "VOL-03": {
    verb: "measureVolume",
    parameters: {
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "scope-water-volume",
      targetVolumeMl: 99,
      tolerance: 0.1,
    },
    atomId: "atom.measure.variable-volume",
    equipmentRoleBindings: {
      "variable-volume-measuring-device": "graduated-cylinder",
      "liquid-source": "distilled-water-bottle",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      accessibleLabel: "Pour slowly from the distilled-water bottle into the graduated cylinder near the line.",
    },
  },
  "VOL-05": {
    verb: "measureVolume",
    parameters: {
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "scope-water-volume",
      targetVolumeMl: 100,
      tolerance: 0.1,
    },
    atomId: "atom.measure.variable-volume",
    equipmentRoleBindings: {
      "variable-volume-measuring-device": "graduated-cylinder",
      "liquid-source": "distilled-water-bottle",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      accessibleLabel: "Pour to the 100.0 milliliter mark at the bottom of the meniscus.",
    },
  },
  "P1-04": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "hand-warmer-calorimeter-1",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "hand-warmer-calorimeter",
      volumeMl: 100,
      targetLabel: "Measured water in calorimeter",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-06",
    },
    atomId: "atom.transfer.measured-liquid",
    equipmentRoleBindings: {
      "measured-solvent-source": "graduated-cylinder",
      "receiving-vessel": "hand-warmer-calorimeter",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "hand-warmer-calorimeter",
      valueParameter: "volumeMl",
      accessibleLabel: "Pour the entire measured water sample into the inner cup.",
    },
  },
  "P1-11": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "magnetic-stir-bar-1",
      targetInstanceId: "hand-warmer-calorimeter-1",
      equipmentDefinitionId: "magnetic-stir-bar",
      targetDefinitionId: "hand-warmer-calorimeter",
      location: "snapZone",
      snapZoneId: "hand-warmer-stir-bar-well",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-07",
    },
    atomId: "atom.place.assemble-calorimeter",
    equipmentRoleBindings: {
      "calorimeter-vessel": "hand-warmer-calorimeter",
      "stirring-device": "magnetic-stir-bar",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "magnetic-stir-bar",
      targetDefinitionId: "hand-warmer-calorimeter",
      snapZoneId: "hand-warmer-stir-bar-well",
      accessibleLabel: "Add one clean magnetic stir bar to the water.",
    },
  },
  "P1-13": {
    verb: "observe",
    parameters: {
      controlType: "stirrer",
      targetInstanceId: "hot-plate-stirrer-1",
      stirLevel: 3,
      splashThreshold: 7,
      note: "Magnetic stirring is on; heating remains off.",
    },
  },
  "P1-14": {
    verb: "observe",
    parameters: {
      controlType: "stirrer",
      targetInstanceId: "hot-plate-stirrer-1",
      stirLevel: 5,
      splashThreshold: 7,
      note: "Stirring is steady without splashing.",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-08",
    },
  },
  "P1-21": {
    verb: "observe",
    parameters: {
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-09",
    },
  },
  "P1-15": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "weigh-boat-1",
      targetInstanceId: "analytical-balance-1",
      equipmentDefinitionId: "weigh-boat",
      targetDefinitionId: "analytical-balance",
      location: "snapZone",
      snapZoneId: "analytical-balance-pan",
    },
    atomId: "atom.place.calorimetry-weighing-vessel",
    equipmentRoleBindings: {
      "balance-instrument": "analytical-balance",
      "weighed-vessel": "weigh-boat",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "weigh-boat",
      targetDefinitionId: "analytical-balance",
      snapZoneId: "analytical-balance-pan",
      accessibleLabel: "Place the empty weighing boat on the analytical balance.",
    },
  },
  "P1-17": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "magnesium-sulfate-1",
      targetInstanceId: "weigh-boat-1",
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "weigh-boat",
      massG: 4.5,
      targetLabel: "Anhydrous magnesium sulfate sample",
    },
    atomId: "atom.transfer.calorimetry-solid-portion",
    equipmentRoleBindings: {
      "solid-reagent-source": "reagent-bottle",
      "weighed-vessel": "weigh-boat",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "weigh-boat",
      valueParameter: "massG",
      accessibleLabel: "Scoop anhydrous magnesium sulfate into the weighing boat.",
    },
  },
  "P1-18": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "magnesium-sulfate-1",
      targetInstanceId: "weigh-boat-1",
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "weigh-boat",
      massG: 0.5,
      targetLabel: "5.00 g anhydrous magnesium sulfate sample",
    },
    atomId: "atom.transfer.calorimetry-solid-portion",
    equipmentRoleBindings: {
      "solid-reagent-source": "reagent-bottle",
      "weighed-vessel": "weigh-boat",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "weigh-boat",
      valueParameter: "massG",
      accessibleLabel: "Add a small final portion to reach 5.00 grams.",
    },
  },
  "P1-19": {
    verb: "weigh",
    parameters: {
      sourceInstanceId: "weigh-boat-1",
      sourceDefinitionId: "weigh-boat",
      targetInstanceId: "analytical-balance-1",
      targetDefinitionId: "analytical-balance",
      instrumentDefinitionId: "analytical-balance",
      measurementId: "part1-trial-1-magnesium-sulfate-mass",
      expectedMassG: 5,
      tolerance: 0.01,
    },
    atomId: "atom.weigh.solid-portion",
    equipmentRoleBindings: {
      "balance-instrument": "analytical-balance",
      "weighed-vessel": "weigh-boat",
    },
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "weigh-boat",
      targetDefinitionId: "analytical-balance",
      stationId: "analytical-balance",
      valueParameter: "expectedMassG",
      accessibleLabel: "Read and confirm the stable magnesium sulfate mass on the balance.",
    },
  },
  "P1-22": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "weigh-boat-1",
      targetInstanceId: "hand-warmer-calorimeter-1",
      sourceDefinitionId: "weigh-boat",
      targetDefinitionId: "hand-warmer-calorimeter",
      massG: 5,
      targetLabel: "Dissolving magnesium sulfate solution",
      visualState: "dissolving-solid",
      thermalResponseMode: "dissolution",
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputKey: "hand-warmer-practice-peak-temperature-c",
      inputLabel: "Configured simulator peak temperature for the MgSO4 practice profile",
      inputMin: -20,
      inputMax: 100,
      inputStep: 0.1,
      inputRequired: true,
      configurationParameter: "idealPeakTemperatureC",
      unit: "°C",
      dataSeriesId: "part1-trial-1-temperature-response",
      dataSeriesLabel: "Part 1 trial 1 temperature response",
      responseSeed: 12,
      durationS: 120,
      sampleEveryS: 1,
      lagSeconds: 8,
      peakTimeS: 24,
      coolingTimeConstantS: 100,
      noiseAmplitudeC: 0.05,
      precisionC: 0.1,
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-10",
    },
    atomId: "atom.transfer.weighed-sample-to-vessel",
    equipmentRoleBindings: {
      "weighed-sample-source": "weigh-boat",
      "receiving-vessel": "hand-warmer-calorimeter",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "weigh-boat",
      targetDefinitionId: "hand-warmer-calorimeter",
      valueParameter: "massG",
      accessibleLabel: "Quickly transfer the entire magnesium sulfate sample into the calorimeter.",
    },
  },
  "P1-24": {
    verb: "observe",
    parameters: {
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-11",
    },
  },
  "P1-26": {
    verb: "observe",
    parameters: {
      sourceInstanceId: "hand-warmer-calorimeter-1",
      temperatureEvidenceKind: "peak",
      dataSeriesId: "part1-trial-1-temperature-response",
      evidenceId: "part1-peak-temperature",
      note: "Actual highest temperature reached is captured.",
    },
  },
  "P1-29": {
    verb: "observe",
    parameters: {
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-12",
    },
  },
  "P1-D03": {
    verb: "dilute",
    parameters: {
      sourceInstanceId: "wash-bottle-1",
      sourceDefinitionId: "wash-bottle",
      targetInstanceId: "hand-warmer-calorimeter-1",
      targetDefinitionId: "hand-warmer-calorimeter",
      finalVolumeMl: 150,
      visualState: "diluted-solution",
    },
    atomId: "atom.dilute.used-calorimetry-solution",
    equipmentRoleBindings: {
      "liquid-source": "wash-bottle",
      "calorimeter-vessel": "hand-warmer-calorimeter",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "wash-bottle",
      targetDefinitionId: "hand-warmer-calorimeter",
      valueParameter: "finalVolumeMl",
      accessibleLabel: "Add water to dilute the magnesium sulfate solution without overflowing.",
    },
  },
  "P1-D04": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "hand-warmer-calorimeter-1",
      targetInstanceId: "waste-beaker-1",
      sourceDefinitionId: "hand-warmer-calorimeter",
      targetDefinitionId: "waste-beaker",
      volumeMl: 150,
    },
    atomId: "atom.transfer.dispose-calorimetry-waste",
    equipmentRoleBindings: {
      "calorimeter-vessel": "hand-warmer-calorimeter",
      "waste-receiver": "waste-beaker",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "hand-warmer-calorimeter",
      targetDefinitionId: "waste-beaker",
      valueParameter: "volumeMl",
      accessibleLabel: "Dispose of the diluted solution in the teacher-designated waste beaker.",
    },
  },
  "P1-D07": {
    verb: "observe",
    parameters: {
      beginEvidenceScopeId: "part1-trial-2",
      resetEquipmentInstanceIds: [
        "graduated-cylinder-1",
        "weigh-boat-1",
        "magnetic-stir-bar-1",
        "waste-beaker-1",
      ],
      clearRecordedTemperatureInstanceIds: ["hand-warmer-calorimeter-1"],
      note: "Reusable equipment is restored while the accepted Trial 1 record remains available.",
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-05",
    },
  },
  "P1-C08": {
    verb: "observe",
    parameters: {
      beginEvidenceScopeId: "part1-retry-1",
      resetEquipmentInstanceIds: [
        "graduated-cylinder-1",
        "weigh-boat-1",
        "magnetic-stir-bar-1",
        "waste-beaker-1",
      ],
      clearContentsInstanceIds: [
        "hand-warmer-calorimeter-1",
        "graduated-cylinder-1",
        "weigh-boat-1",
      ],
      clearRecordedTemperatureInstanceIds: ["hand-warmer-calorimeter-1"],
      visualProxyInstanceId: "hand-warmer-calorimeter-1",
      visualProxyVisualState: "CAL-05",
      note: "A fresh retry scope is open; earlier trial evidence remains visible but cannot satisfy retry actions.",
    },
  },
  "P2-H01": {
    verb: "place",
    parameters: {
      beginEvidenceScopeId: "calibration-determination-1",
      resetEquipmentInstanceIds: [
        "magnetic-stir-bar-1",
        "weigh-boat-1",
      ],
      clearContentsInstanceIds: [
        "graduated-cylinder-1",
        "beaker-150ml-1",
        "hand-warmer-calorimeter-1",
      ],
      equipmentInstanceId: "beaker-150ml-1",
      equipmentDefinitionId: "beaker-150ml",
      location: "workbench",
    },
    atomId: "atom.place.select-clean-dry-receiving-vessel",
    equipmentRoleBindings: {
      "receiving-vessel": "beaker-150ml",
    },
    interaction: {
      type: "dragToZone",
      sourceDefinitionId: "beaker-150ml",
      stationId: "workbench",
      accessibleLabel: "Select and place a clean, dry 150 milliliter beaker on the bench.",
    },
  },
  "P2-H02": {
    verb: "measureVolume",
    parameters: {
      sourceInstanceId: "distilled-water-bottle-1",
      targetInstanceId: "graduated-cylinder-1",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "calibration-hot-water-volume",
      volumeMl: 100,
      tolerance: 0.1,
    },
    atomId: "atom.measure.variable-volume",
    equipmentRoleBindings: {
      "variable-volume-measuring-device": "graduated-cylinder",
      "liquid-source": "distilled-water-bottle",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      valueParameter: "volumeMl",
      accessibleLabel: "Measure exactly 100.0 milliliters of water for heating.",
    },
  },
  "P2-H03": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "beaker-150ml-1",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "beaker-150ml",
      volumeMl: 100,
    },
    atomId: "atom.transfer.measured-liquid",
    equipmentRoleBindings: {
      "measured-solvent-source": "graduated-cylinder",
      "receiving-vessel": "beaker-150ml",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "beaker-150ml",
      valueParameter: "volumeMl",
      accessibleLabel: "Pour the measured water into the clean, dry beaker.",
    },
  },
  "P2-H04": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "beaker-150ml-1",
      targetInstanceId: "hot-plate-stirrer-1",
      equipmentDefinitionId: "beaker-150ml",
      targetDefinitionId: "hot-plate-stirrer",
      location: "snapZone",
      snapZoneId: "hot-plate-stirrer-deck",
    },
    atomId: "atom.place.calorimetry-heating-vessel",
    equipmentRoleBindings: {
      "heated-liquid-vessel": "beaker-150ml",
      "heating-instrument": "hot-plate-stirrer",
    },
    interaction: {
      type: "snapIntoTarget",
      sourceDefinitionId: "beaker-150ml",
      targetDefinitionId: "hot-plate-stirrer",
      snapZoneId: "hot-plate-stirrer-deck",
      accessibleLabel: "Place the hot-water beaker on the hot plate.",
    },
  },
  "P2-H09": {
    verb: "heat",
    parameters: {
      thermalMode: "targetTemperature",
      sourceInstanceId: "beaker-150ml-1",
      targetInstanceId: "hot-plate-stirrer-1",
      sourceDefinitionId: "beaker-150ml",
      targetDefinitionId: "hot-plate-stirrer",
      targetTemperatureC: 50,
      temperatureC: 50,
      toleranceC: 3,
      elapsedSeconds: 180,
    },
    atomId: "atom.heat.calorimetry-liquid-to-target",
    equipmentRoleBindings: {
      "heated-liquid-vessel": "beaker-150ml",
      "heating-instrument": "hot-plate-stirrer",
    },
    interaction: {
      type: "placeInInstrument",
      sourceDefinitionId: "beaker-150ml",
      targetDefinitionId: "hot-plate-stirrer",
      stationId: "heating",
      accessibleLabel: "Heat the stirred water to approximately 50 degrees Celsius.",
    },
  },
  "P2-H10": {
    verb: "place",
    parameters: {
      equipmentInstanceId: "beaker-150ml-1",
      equipmentDefinitionId: "beaker-150ml",
      location: "workbench",
    },
    atomId: "atom.place.remove-calorimetry-heating-vessel",
    equipmentRoleBindings: {
      "heated-liquid-vessel": "beaker-150ml",
    },
    interaction: {
      type: "dragToZone",
      sourceDefinitionId: "beaker-150ml",
      stationId: "workbench",
      accessibleLabel: "Remove the hot-water beaker from the hot plate and place it on the bench.",
    },
  },
  "P2-C02": {
    verb: "measureVolume",
    parameters: {
      sourceInstanceId: "distilled-water-bottle-1",
      targetInstanceId: "graduated-cylinder-1",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: "calibration-cool-water-volume",
      volumeMl: 100,
      tolerance: 0.1,
    },
    atomId: "atom.measure.variable-volume",
    equipmentRoleBindings: {
      "variable-volume-measuring-device": "graduated-cylinder",
      "liquid-source": "distilled-water-bottle",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "distilled-water-bottle",
      targetDefinitionId: "graduated-cylinder",
      valueParameter: "volumeMl",
      accessibleLabel: "Measure exactly 100.0 milliliters of cool water.",
    },
  },
  "P2-C04": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "graduated-cylinder-1",
      targetInstanceId: "hand-warmer-calorimeter-1",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "hand-warmer-calorimeter",
      volumeMl: 100,
    },
    atomId: "atom.transfer.measured-liquid",
    equipmentRoleBindings: {
      "measured-solvent-source": "graduated-cylinder",
      "receiving-vessel": "hand-warmer-calorimeter",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "hand-warmer-calorimeter",
      valueParameter: "volumeMl",
      accessibleLabel: "Pour the measured cool water into the clean, dry calorimeter.",
    },
  },
  "P2-M10": {
    verb: "transfer",
    parameters: {
      sourceInstanceId: "beaker-150ml-1",
      targetInstanceId: "hand-warmer-calorimeter-1",
      sourceDefinitionId: "beaker-150ml",
      targetDefinitionId: "hand-warmer-calorimeter",
      volumeMl: 100,
      inputMode: "numeric",
      inputRole: "teacherConfiguration",
      inputKey: "hand-warmer-simulator-calorimeter-constant",
      inputLabel: "Configured simulator calorimeter constant",
      inputMin: 0,
      inputStep: 0.1,
      inputRequired: true,
      configurationParameter: "calorimeterConstantJPerC",
      unit: "J/°C",
      targetLabel: "Mixed calibration water",
    },
    atomId: "atom.transfer.measured-liquid",
    equipmentRoleBindings: {
      "measured-solvent-source": "beaker-150ml",
      "receiving-vessel": "hand-warmer-calorimeter",
    },
    interaction: {
      type: "pourInto",
      sourceDefinitionId: "beaker-150ml",
      targetDefinitionId: "hand-warmer-calorimeter",
      valueParameter: "volumeMl",
      accessibleLabel: "Immediately pour all hot water into the cool water.",
    },
  },
  "P2-M13": {
    verb: "observe",
    parameters: {
      timerId: "calibration-timer",
      waitSeconds: 15,
      requiredSeconds: 15,
      note: "Exactly 15 seconds elapsed after mixing.",
    },
  },
  "P2-M14": {
    verb: "observe",
    parameters: {
      sourceInstanceId: "hand-warmer-calorimeter-1",
      temperatureEvidenceKind: "timed",
      evidenceId: "calibration-mixture-temperature",
      elapsedSeconds: 15,
      requiredSeconds: 15,
      note: "Mixture temperature read at 15 seconds.",
    },
  },
};

const recordIds = new Set(
  rows
    .filter(({ instruction }) => /\bRecord\b/i.test(instruction))
    .map(({ id }) => id),
);

const numericCalculationUnits = new Map([
  ["P1-C01", "°C"],
  ["P1-C02", "°C/g"],
  ["P1-C03", "°C"],
  ["P1-C04", "°C/g"],
  ["P1-C05", "°C/g"],
  ["P1-C06", "%"],
  ["DA-CAL-01", "J"],
  ["DA-CAL-03", "J"],
  ["DA-CAL-05", "J"],
  ["DA-CAL-06", "J/°C"],
  ["DA-CAL-07", "J/°C"],
  ["DA-SOL-01", "J"],
  ["DA-SOL-02", "J"],
  ["DA-SOL-03", "J"],
  ["DA-SOL-04", "kJ/mol"],
  ["DA-AMT-01", "g"],
]);

const numericObservationParameters = {
  "P1-09": {
    measurementId: "part1-trial-1-initial-temperature",
    temperatureTargetInstanceId: "hand-warmer-calorimeter-1",
    recordedTemperatureTargetInstanceId: "hand-warmer-calorimeter-1",
    recordedTemperatureLabel: "Recorded initial temperature",
    recordedTemperaturePrecision: 1,
  },
  "P1-27": {
    measurementId: "part1-trial-1-peak-temperature",
    temperatureEvidenceId: "part1-peak-temperature",
    measurementTolerance: 0.05,
  },
  "P2-M04": {
    measurementId: "calibration-determination-1-first-initial-temperature",
  },
  "P2-M08": {
    measurementId: "calibration-determination-1-second-initial-temperature",
  },
  "P2-M15": {
    measurementId: "calibration-determination-1-mixture-temperature",
    temperatureEvidenceId: "calibration-mixture-temperature",
    measurementTolerance: 0.05,
  },
};

const teacherConfigurationParameters = {
  "SAF-04": {
    inputMode: "text",
    inputLabel: "Teacher-designated waste location and route",
    inputKey: "hand-warmer-waste-route",
  },
  "P2-H05": {
    inputMode: "choice",
    inputLabel: "Configured calibration stirring method",
    inputOptions: ["Magnetic stir bar", "Stirring rod"],
    inputKey: "hand-warmer-calibration-stirring-method",
  },
  "INV-D10": {
    inputMode: "choice",
    inputLabel: "Teacher review of the inquiry plan",
    inputOptions: ["Teacher approved the inquiry plan"],
    inputKey: "hand-warmer-inquiry-plan-approval",
  },
};

const textResponseIds = new Set([
  "DA-CAL-02",
  "DA-CAL-04",
  "DA-CMP-01",
  "DA-SEL-01",
  "CER-01",
  "CER-02",
  "CER-03",
]);

const requiresStructuredStudentResponse = (row) =>
  recordIds.has(sourceIdFor(row)) ||
  textResponseIds.has(sourceIdFor(row)) ||
  /^INV-(S0[2-5]|C0[2-5]|D0[1-9]|X01|X10)$/.test(sourceIdFor(row));

const makeAction = (row, mapped = physicalMappings[sourceIdFor(row)]) => {
  if (mapped) {
    const base = observation(row, mapped.parameters);
    const interaction = Object.hasOwn(mapped, "interaction")
      ? mapped.interaction
      : base.interaction;
    return {
      ...base,
      verb: mapped.verb,
      parameters: { ...base.parameters, ...mapped.parameters },
      interaction,
      ...(mapped.atomId ? { atomId: mapped.atomId } : {}),
      ...(mapped.equipmentRoleBindings
        ? { equipmentRoleBindings: mapped.equipmentRoleBindings }
        : {}),
      evidence: [mapped.verb],
    };
  }
  const sourceId = sourceIdFor(row);
  const teacherConfiguration = teacherConfigurationParameters[sourceId];
  if (teacherConfiguration) {
    return observation(row, {
      configurationRequired: true,
      unlocked: false,
      inputRole: "teacherConfiguration",
      inputRequired: true,
      ...teacherConfiguration,
    });
  }
  const numericObservation = numericObservationParameters[sourceId];
  if (numericObservation) {
    return observation(row, {
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputLabel: row.instruction,
      inputRequired: true,
      inputStep: 0.1,
      unit: "°C",
      ...numericObservation,
    });
  }
  if (numericCalculationUnits.has(sourceId)) {
    const isInstructorToleranceCheck = sourceId === "P1-C06";
    return {
      ...observation(row),
      verb: "calculate",
      parameters: {
        calculationId: row.id.toLowerCase(),
        unit: numericCalculationUnits.get(sourceId),
        assessmentMode: "teacherReview",
        teacherReviewRequired: true,
        inputMode: "numeric",
        inputRole: isInstructorToleranceCheck ? "teacherConfiguration" : "studentResponse",
        inputLabel: isInstructorToleranceCheck
          ? "Instructor-entered absolute percent deviation from the configured comparison target"
          : row.instruction,
        inputRequired: true,
        requireStudentValue: true,
        ...(isInstructorToleranceCheck
          ? {
              configurationRequired: true,
              unlocked: false,
              inputKey: row.id.toLowerCase(),
              inputMin: 0,
              inputStep: 0.1,
            }
          : {}),
      },
      interaction: {
        type: "submitCalculation",
        valueParameter: "value",
        accessibleLabel: isInstructorToleranceCheck
          ? "Enter the instructor's absolute percent deviation and apply the inclusive 10 percent criterion."
          : row.instruction,
      },
      evidence: ["calculation"],
    };
  }
  if (requiresStructuredStudentResponse(row)) {
    return observation(row, {
      recordKind: "trial-scoped",
      inputMode: "text",
      inputRole: "studentResponse",
      inputLabel: row.instruction,
      inputRequired: true,
    });
  }
  return observation(row);
};

const trialTwoVolumeMapping = {
  ...physicalMappings["VOL-02"],
  parameters: {
    ...physicalMappings["VOL-02"].parameters,
    // Trial 2 has no separate coarse/fine volume substeps, so it retains the
    // single final-volume transfer used by the existing generated workflow.
    volumeMl: 100,
    measurementId: "part1-trial-2-water-volume",
  },
  interaction: {
    ...physicalMappings["VOL-02"].interaction,
    accessibleLabel: "Measure a fresh 100.0 milliliter water sample for Part 1 Trial 2.",
  },
};

const trialTwoRows = rows.slice(
  rows.findIndex(({ id }) => id === "P1-02"),
  rows.findIndex(({ id }) => id === "P1-D07") + 1,
);

const scopedParameters = (parameters, replacements, tagSuffix, responseSeedOffset = 0) =>
  Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => {
      if (key === "tag") return [key, `${value}${tagSuffix}`];
      if (key === "responseSeed" && typeof value === "number") {
        return [key, value + responseSeedOffset];
      }
      if (typeof value !== "string") return [key, value];
      return [key, replacements.reduce(
        (next, [from, to]) => next.replaceAll(from, to),
        value,
      )];
    }),
  );

const trialTwoParameters = (parameters) => scopedParameters(
  parameters,
  [
    ["trial-1", "trial-2"],
    ["part1-peak-temperature", "part1-trial-2-peak-temperature"],
  ],
  "-T2",
  1,
);

const actionPrerequisite = (actionId, label) => ({
  id: `${actionId}-required`,
  type: "actionEvidence",
  actionId,
  label,
});

const entry = (row, action, options = {}) => ({ row, action, options });

const cleanupItems = [
  ["CUP", "calorimeter cup", "hand-warmer-calorimeter-1"],
  ["PROBE", "temperature probe", "probe-thermometer-1"],
  ["CYLINDER", "graduated cylinder", "graduated-cylinder-1"],
  ["CONTAINER", "weighing container", "weigh-boat-1"],
];

const cleanupEntries = (
  sourceRow,
  { suffix = "", titlePrefix = "", evidenceScope = "part1-trial", conditionalBranch } = {},
) => cleanupItems.map(([code, itemLabel, equipmentInstanceId], index) => {
  const id = `${sourceRow.id}-${code}${suffix}`;
  const row = derivedRow(
    sourceRow,
    id,
    `${titlePrefix}Complete the teacher-directed cleanup for the ${itemLabel}.`,
  );
  const action = observation(row, {
    recordKind: "equipment-scoped-cleanup",
    equipmentInstanceId,
    cleanupItem: itemLabel,
    inputMode: "choice",
    inputRole: "studentResponse",
    inputLabel: `Cleanup outcome for the ${itemLabel}`,
    inputOptions: [
      "Rinsed as directed",
      "Replaced as directed",
      "No action required by the teacher",
    ],
    inputRequired: true,
    ...(conditionalBranch ? { conditionalBranch } : {}),
  });
  action.prerequisites = index === 0
    ? [actionPrerequisite(`P1-D05${suffix}`, "The stir bar has been recovered.")]
    : [actionPrerequisite(`${sourceRow.id}-${cleanupItems[index - 1][0]}${suffix}`, "The previous cleanup item is complete.")];
  action.evidence = ["cleanup", "equipment-scoped"];
  return entry(row, action, { evidenceScope });
});

const diagnosticItems = [
  ["MEASUREMENT", "measurement method and entered values"],
  ["PROBE", "probe placement"],
  ["SPLASHING", "possible splashing or material loss"],
  ["DISSOLUTION", "whether dissolution was complete"],
];

const diagnosticEntries = (sourceRow) => diagnosticItems.map(([code, itemLabel], index) => {
  const id = `${sourceRow.id}-${code}`;
  const row = derivedRow(sourceRow, id, `Review ${itemLabel} before opening a retry.`);
  const action = observation(row, {
    recordKind: "diagnostic-checklist-item",
    diagnosticItem: itemLabel,
    inputMode: "choice",
    inputRole: "studentResponse",
    inputLabel: `Diagnostic review: ${itemLabel}`,
    inputOptions: [
      "Reviewed — no issue identified",
      "Reviewed — possible issue identified",
    ],
    inputRequired: true,
    conditionalBranch: "part1-tolerance-retry",
  });
  action.prerequisites = index === 0
    ? [actionPrerequisite("P1-C06", "The instructor check requires a retry.")]
    : [actionPrerequisite(`P1-C07-${diagnosticItems[index - 1][0]}`, "The previous diagnostic item is reviewed.")];
  action.evidence = ["diagnostic-review", "checklist-item"];
  return entry(row, action, { evidenceScope: "part1-retry-review" });
});

const inquiryMeasurementSpecs = {
  "INV-X02": { quantity: "water volume", unit: "mL" },
  "INV-X03": { quantity: "solid mass", unit: "g" },
  "INV-X04": { quantity: "starting temperature", unit: "°C" },
};

const inquiryMeasurementEntries = (sourceRow) => {
  const { quantity, unit } = inquiryMeasurementSpecs[sourceRow.id];
  const measurementId = `${sourceRow.id.toLowerCase()}-planned-measurement`;
  const measureRow = derivedRow(
    sourceRow,
    `${sourceRow.id}-MEASURE`,
    `Measure the planned ${quantity} for the active solid and trial.`,
  );
  const measure = observation(measureRow, {
    measurementId,
    inputMode: "numeric",
    inputRole: "studentResponse",
    inputLabel: `Measured ${quantity}`,
    inputRequired: true,
    inputStep: 0.01,
    unit,
    recordKind: "plan-scoped-measurement",
  });
  measure.evidence = ["measurement", "plan-scoped"];
  measure.prerequisites = [
    actionPrerequisite("INV-X01", "The active solid and trial are identified."),
  ];

  const recordRow = derivedRow(
    sourceRow,
    `${sourceRow.id}-RECORD`,
    `Record the measured ${quantity} for the active solid and trial.`,
  );
  const record = {
    ...observation(recordRow),
    verb: "record",
    parameters: {
      tag: recordRow.id,
      note: recordRow.instruction,
      measurementId,
      label: `Planned ${quantity}`,
      unit,
      copyExistingMeasurementOnly: true,
      recordKind: "plan-scoped-measurement",
    },
    interaction: {
      type: "recordNotebook",
      valueParameter: "measurementId",
      accessibleLabel: `Copy the measured ${quantity} into the active trial record.`,
    },
    prerequisites: [
      {
        id: `${measurementId}-required`,
        type: "measurementRecorded",
        measurementId,
        label: `The ${quantity} has been measured.`,
      },
    ],
    evidence: ["record", "measurement", "plan-scoped"],
  };
  return [
    entry(measureRow, measure, { evidenceScope: "inquiry-trial" }),
    entry(recordRow, record, { evidenceScope: "inquiry-trial" }),
  ];
};

const periodicCalibrationEntry = (sourceRow, determination) => {
  const isStir = sourceRow.id === "P2-H07";
  const actionKind = isStir ? "STIR" : "READ";
  const id = `${sourceRow.id}-D${determination}-${actionKind}-01`;
  const instruction = isStir
    ? `Determination ${determination}: perform one required occasional-stir event without splashing.`
    : `Determination ${determination}: take the next required periodic water-temperature reading.`;
  const row = derivedRow(sourceRow, id, instruction);
  const parameters = isStir
    ? {
        note: "One configured occasional-stir event was completed without splashing.",
        inputMode: "choice",
        inputRole: "studentResponse",
        inputLabel: `Determination ${determination} stirring event`,
        inputOptions: [
          "Configured magnetic-stirrer event completed",
          "Configured stirring-rod event completed",
        ],
        inputRequired: true,
      }
    : {
        sourceInstanceId: "beaker-150ml-1",
        sourceDefinitionId: "beaker-150ml",
        targetInstanceId: "probe-thermometer-1",
        targetDefinitionId: "probe-thermometer",
        temperatureEvidenceKind: "live",
        evidenceId: `calibration-d${determination}-hot-water-periodic-reading-1`,
        note: "One configured periodic temperature reading was taken.",
      };
  const action = {
    ...observation(row, {
      ...parameters,
      repeatGroupId: `calibration-d${determination}-${isStir ? "stir" : "temperature-read"}-events`,
      repeatIteration: 1,
      repeatMode: "teacher-configured-reusable-iteration",
      configuredRepeatCountRequired: true,
    }),
    interaction: isStir
      ? {
          type: "recordNotebook",
          accessibleLabel: instruction,
          successCue: "One occasional-stir event is complete.",
          invalidCue: "Stir safely without splashing, then confirm this event.",
        }
      : {
          type: "readInstrument",
          sourceDefinitionId: "beaker-150ml",
          targetDefinitionId: "probe-thermometer",
          stationId: "heating",
          accessibleLabel: instruction,
        },
    evidence: [isStir ? "stir-event" : "temperature-reading", "configured-repeat-iteration"],
  };
  action.prerequisites = [
    actionPrerequisite(
      isStir
        ? `P2-H06${determination === 1 ? "" : `-D${determination}`}`
        : `P2-H07-D${determination}-STIR-01`,
      isStir
        ? "Heating has begun for this determination."
        : "At least one configured stir event is complete.",
    ),
  ];
  return entry(row, action, { evidenceScope: `calibration-determination-${determination}` });
};

const repeatedCalculationEntries = (sourceRow, kind) => {
  const isCalibration = kind === "calibration";
  const scopePrefix = isCalibration ? "Determination" : "Assigned solid";
  const suffixPrefix = isCalibration ? "D" : "S";
  const groupScope = isCalibration ? "calibration" : "assigned-solid-analysis";
  return [1, 2, 3].map((iteration) => {
    const id = `${sourceRow.id}-${suffixPrefix}${iteration}`;
    const instruction = `${scopePrefix} ${iteration}: ${sourceRow.instruction
      .replace(/ for each accepted determination/i, "")
      .replace(/ for each determination/i, "")
      .replace(/ for each solid/i, "")}`;
    const row = derivedRow(sourceRow, id, instruction);
    const action = makeAction(row);
    action.parameters = {
      ...action.parameters,
      calculationId: id.toLowerCase(),
      inputLabel: instruction,
      repeatGroupId: `${sourceRow.id.toLowerCase()}-${groupScope}`,
      repeatIteration: iteration,
      repeatCount: 3,
      repeatIterationComplete: true,
      evidenceScopeId: isCalibration
        ? `calibration-determination-${iteration}`
        : `assigned-solid-${iteration}`,
    };
    if (isCalibration) {
      const determinationSuffix = iteration === 1 ? "" : `-D${iteration}`;
      action.prerequisites = sourceRow.id === "DA-CAL-01" || sourceRow.id === "DA-CAL-03"
        ? [actionPrerequisite(`P2-M15${determinationSuffix}`, `Determination ${iteration} measurements are complete.`)]
        : sourceRow.id === "DA-CAL-05"
          ? [
              actionPrerequisite(`DA-CAL-01-D${iteration}`, `Determination ${iteration} cold-water heat is calculated.`),
              actionPrerequisite(`DA-CAL-03-D${iteration}`, `Determination ${iteration} hot-water heat is calculated.`),
            ]
          : [actionPrerequisite(`DA-CAL-05-D${iteration}`, `Determination ${iteration} calorimeter heat is calculated.`)];
    } else {
      action.prerequisites = sourceRow.id === "DA-SOL-01"
        ? [actionPrerequisite("INV-X12", "The approved inquiry execution is complete.")]
        : sourceRow.id === "DA-SOL-02"
          ? [
              actionPrerequisite("DA-CAL-07", "The accepted calorimeter constant is available."),
              actionPrerequisite(`DA-SOL-01-S${iteration}`, `Assigned solid ${iteration} sensible heat is calculated.`),
            ]
          : sourceRow.id === "DA-SOL-03"
            ? [
                actionPrerequisite(`DA-SOL-01-S${iteration}`, `Assigned solid ${iteration} sensible heat is calculated.`),
                actionPrerequisite(`DA-SOL-02-S${iteration}`, `Assigned solid ${iteration} calorimeter correction is calculated.`),
              ]
            : [actionPrerequisite(`DA-SOL-03-S${iteration}`, `Assigned solid ${iteration} dissolution heat is calculated.`)];
    }
    action.evidence = ["calculation", isCalibration ? "determination-scoped" : "assigned-solid-scoped"];
    return entry(row, action, {
      evidenceScope: isCalibration
        ? `calibration-determination-${iteration}`
        : `assigned-solid-${iteration}`,
    });
  });
};

const calibrationCalculationIds = new Set(["DA-CAL-01", "DA-CAL-03", "DA-CAL-05", "DA-CAL-06"]);
const solidCalculationIds = new Set(["DA-SOL-01", "DA-SOL-02", "DA-SOL-03", "DA-SOL-04"]);

const baseEntriesForRow = (row) => {
  if (row.id === "P1-01") return [];
  if (row.id === "P1-D06") return cleanupEntries(row);
  if (row.id === "P1-C07") return diagnosticEntries(row);
  if (row.id === "P1-C08") {
    const atomicRow = derivedRow(
      row,
      row.id,
      "Open a fresh retry scope and reset reusable apparatus while preserving prior evidence.",
    );
    const action = makeAction(atomicRow);
    action.parameters = { ...action.parameters, conditionalBranch: "part1-tolerance-retry" };
    action.prerequisites = [
      actionPrerequisite("P1-C07-DISSOLUTION", "Every diagnostic checklist item is reviewed."),
    ];
    action.evidence = ["scope-reset", "retry"];
    return [entry(atomicRow, action, { evidenceScope: "part1-retry-1" })];
  }
  if (row.id === "P1-C06") {
    const atomicRow = derivedRow(
      row,
      row.id,
      "Apply the instructor's inclusive 10% check to the accepted two-trial average.",
    );
    const action = makeAction(atomicRow);
    action.prerequisites = [
      actionPrerequisite("P1-C05", "The accepted two-trial average is calculated."),
    ];
    return [entry(atomicRow, action, { evidenceScope: "part1-comparison" })];
  }
  if (row.id === "P2-H07" || row.id === "P2-H08") {
    return [periodicCalibrationEntry(row, 1)];
  }
  if (inquiryMeasurementSpecs[row.id]) return inquiryMeasurementEntries(row);
  if (calibrationCalculationIds.has(row.id)) return repeatedCalculationEntries(row, "calibration");
  if (solidCalculationIds.has(row.id)) return repeatedCalculationEntries(row, "solid");
  const action = makeAction(row);
  if (row.id === "P1-D07") {
    action.parameters.repeatGroupId = "part1-practice-trials";
    action.parameters.repeatIteration = 1;
    action.parameters.repeatCount = 2;
    action.parameters.repeatIterationComplete = true;
    action.prerequisites = [
      actionPrerequisite("P1-D06-CONTAINER", "Every configured cleanup item is complete."),
    ];
  }
  return [entry(row, action)];
};

const trialTwoEntries = trialTwoRows.flatMap((row) => {
  if (row.id === "P1-D06") {
    return cleanupEntries(row, {
      suffix: "-T2",
      titlePrefix: "Trial 2: ",
      evidenceScope: "part1-trial-2",
    });
  }
  const mapped = row.id === "P1-02" ? trialTwoVolumeMapping : physicalMappings[row.id];
  const action = makeAction(row, mapped);
  const atomicRow = derivedRow(
    row,
    `${row.id}-T2`,
    row.id === "P1-D07"
      ? "Trial 2: restore reusable apparatus after the completed trial."
      : `Trial 2: ${row.instruction}`,
  );
  const trialTwoAction = {
    ...action,
    id: atomicRow.id,
    label: atomicRow.instruction.replace(/[.]$/, ""),
    parameters: trialTwoParameters(action.parameters),
    evidence: [...action.evidence, "part1-trial-2"],
  };
  if (row.id === "P1-D07") {
    trialTwoAction.parameters.note =
      "Reusable equipment is restored while accepted Trial 1 and Trial 2 evidence remains available.";
    trialTwoAction.parameters.beginEvidenceScopeId = "post-part1-trial-2";
    trialTwoAction.parameters.repeatGroupId = "part1-practice-trials";
    trialTwoAction.parameters.repeatIteration = 2;
    trialTwoAction.parameters.repeatCount = 2;
    trialTwoAction.parameters.repeatIterationComplete = true;
    trialTwoAction.prerequisites = [
      actionPrerequisite("P1-D06-CONTAINER-T2", "Every Trial 2 cleanup item is complete."),
    ];
  }
  return [entry(atomicRow, trialTwoAction, { evidenceScope: "part1-trial-2" })];
});

const calibrationRows = rows.slice(
  rows.findIndex(({ id }) => id === "P2-H01"),
  rows.findIndex(({ id }) => id === "P2-M15") + 1,
);
const calibrationDeterminations = [2, 3];
const calibrationParameters = (parameters, determination) =>
  Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => {
      if (key === "tag") return [key, `${value}-D${determination}`];
      if (typeof value !== "string") return [key, value];
      return [
        key,
        value
          .replaceAll("calibration-determination-1", `calibration-determination-${determination}`)
          .replaceAll("calibration-hot-water-volume", `calibration-d${determination}-hot-water-volume`)
          .replaceAll("calibration-cool-water-volume", `calibration-d${determination}-cool-water-volume`)
          .replaceAll("calibration-mixture-temperature", `calibration-d${determination}-mixture-temperature`),
      ];
    }),
  );
const repeatedCalibrationEntries = calibrationDeterminations.flatMap((determination) =>
  calibrationRows.flatMap((row) => {
    if (row.id === "P2-H07" || row.id === "P2-H08") {
      return [periodicCalibrationEntry(row, determination)];
    }
    const action = makeAction(row);
    const atomicRow = derivedRow(
      row,
      `${row.id}-D${determination}`,
      `Calibration determination ${determination}: ${row.instruction}`,
    );
    return [entry(atomicRow, {
      ...action,
      id: atomicRow.id,
      label: atomicRow.instruction.replace(/[.]$/, ""),
      parameters: calibrationParameters(action.parameters, determination),
      evidence: [...action.evidence, `calibration-determination-${determination}`],
    }, { evidenceScope: `calibration-determination-${determination}` })];
  }),
);

const retryRows = rows.slice(
  rows.findIndex(({ id }) => id === "P1-02"),
  rows.findIndex(({ id }) => id === "P1-D07") + 1,
);

const retryParameters = (parameters) => scopedParameters(
  parameters,
  [
    ["trial-1", "retry-1"],
    ["trial-2", "retry-1"],
    ["part1-peak-temperature", "part1-retry-1-peak-temperature"],
  ],
  "-R1",
  2,
);

const retryEntries = retryRows.flatMap((row) => {
  if (row.id === "P1-D06") {
    return cleanupEntries(row, {
      suffix: "-R1",
      titlePrefix: "Retry 1: ",
      evidenceScope: "part1-retry-1",
      conditionalBranch: "part1-tolerance-retry",
    });
  }
  const mapped = row.id === "P1-02"
    ? {
        ...trialTwoVolumeMapping,
        parameters: {
          ...trialTwoVolumeMapping.parameters,
          measurementId: "part1-retry-1-water-volume",
        },
      }
    : physicalMappings[row.id];
  const sourceAction = makeAction(row, mapped);
  const atomicRow = derivedRow(
    row,
    `${row.id}-R1`,
    row.id === "P1-D07"
      ? "Retry 1: restore reusable apparatus after the completed retry."
      : `Retry 1: ${row.instruction}`,
  );
  const action = {
    ...sourceAction,
    id: atomicRow.id,
    label: atomicRow.instruction.replace(/[.]$/, ""),
    parameters: {
      ...retryParameters(sourceAction.parameters),
      conditionalBranch: "part1-tolerance-retry",
    },
    evidence: [...sourceAction.evidence, "part1-retry-1"],
  };
  if (row.id === "P1-02") {
    action.prerequisites = [
      actionPrerequisite("P1-C08", "The fresh retry scope is open."),
    ];
  }
  if (row.id === "P1-D07") {
    action.parameters.note =
      "Reusable equipment is restored while all accepted practice and Retry 1 evidence remains available.";
    action.parameters.beginEvidenceScopeId = "post-part1-retry-1";
    action.parameters.repeatGroupId = "part1-tolerance-retry";
    action.parameters.repeatIteration = 1;
    action.parameters.repeatCount = 1;
    action.parameters.repeatIterationComplete = true;
    action.prerequisites = [
      actionPrerequisite("P1-D06-CONTAINER-R1", "Every Retry 1 cleanup item is complete."),
    ];
  }
  return [entry(atomicRow, action, { evidenceScope: "part1-retry-1" })];
});

const retryCalculationEntries = ["P1-C01", "P1-C02", "P1-C06"].map((sourceId) => {
  const sourceRow = rows.find((row) => row.id === sourceId);
  if (!sourceRow) throw new Error(`Missing retry calculation source row ${sourceId}.`);
  const instruction = sourceId === "P1-C01"
    ? "Retry 1: calculate the fresh trial temperature change."
    : sourceId === "P1-C02"
      ? "Retry 1: divide the fresh temperature change by the fresh MgSO4 mass."
      : "Retry 1: submit the fresh normalized result for the instructor's 10% recheck.";
  const row = derivedRow(sourceRow, `${sourceId}-R1`, instruction);
  const action = makeAction(row);
  action.parameters = {
    ...action.parameters,
    calculationId: `${sourceId.toLowerCase()}-r1`,
    inputLabel: sourceId === "P1-C06"
      ? "Instructor-entered absolute percent deviation after Retry 1"
      : instruction,
    conditionalBranch: "part1-tolerance-retry",
  };
  action.prerequisites = [
    actionPrerequisite(
      sourceId === "P1-C01"
        ? "P1-D07-R1"
        : sourceId === "P1-C02"
          ? "P1-C01-R1"
          : "P1-C02-R1",
      sourceId === "P1-C01"
        ? "The fresh retry trial and cleanup are complete."
        : "The preceding retry calculation is complete.",
    ),
  ];
  action.evidence = ["calculation", "part1-retry-1"];
  return entry(row, action, { evidenceScope: "part1-retry-1" });
});

const insertAfterAction = (entries, actionId, additions) => {
  const index = entries.findIndex(({ action }) => action.id === actionId);
  if (index < 0) throw new Error(`Cannot insert after missing action ${actionId}.`);
  return [...entries.slice(0, index + 1), ...additions, ...entries.slice(index + 1)];
};

let orderedEntries = rows.flatMap((row) => baseEntriesForRow(row));
orderedEntries = insertAfterAction(orderedEntries, "P1-D07", trialTwoEntries);
orderedEntries = insertAfterAction(
  orderedEntries,
  "P1-C08",
  [...retryEntries, ...retryCalculationEntries],
);
orderedEntries = insertAfterAction(orderedEntries, "P2-M15", repeatedCalibrationEntries);

const actions = orderedEntries.map(({ action }) => action);

const makeNode = (
  row,
  {
    actionId = row.id,
    nodeId = `${row.id.toLowerCase()}-node`,
    evidenceScope,
    titlePrefix = "",
  } = {},
) => ({
  id: nodeId,
  type:
    row.id.startsWith("DA-") ? "calculation" :
    row.id.startsWith("CER-") ? "observation" :
    "action",
  title: `${titlePrefix}${row.id} · ${row.instruction.replace(/[.]$/, "")}`,
  description: row.instruction,
  actionId,
  config: {
    evidenceScope:
      evidenceScope ??
      (
        row.id.startsWith("P1-") ? "part1-trial" :
        row.id.startsWith("P2-") ? "calibration-determination" :
        row.id.startsWith("INV-X") ? "inquiry-trial" :
        "global"
      ),
  },
  validation: [{ id: `${actionId}-evidence`, type: "actionEvidence", label: `${actionId} completed`, actionId }],
  hints: [],
  feedback: { success: `${actionId} complete.`, retry: `Complete ${actionId} before continuing.` },
});

const nodes = orderedEntries.map(({ row, action, options }) => makeNode(row, {
  actionId: action.id,
  nodeId: `${action.id.toLowerCase()}-node`,
  ...options,
}));

const sequentialEdges = nodes.slice(0, -1).map((node, index) => ({
  from: node.id,
  to: nodes[index + 1].id,
  label: "Next atomic action",
  condition: { type: "validationPassed" },
}));

const toleranceCheckNodeId = "p1-c06-node";
const edges = [
  ...sequentialEdges.filter((edge) => edge.from !== toleranceCheckNodeId),
  {
    from: toleranceCheckNodeId,
    to: "p2-h01-node",
    label: "Within the inclusive 10% criterion — continue",
    condition: {
      type: "calculationResult",
      calculationId: "p1-c06",
      min: 0,
      max: 10,
    },
  },
  {
    from: toleranceCheckNodeId,
    to: "p1-c07-measurement-node",
    label: "Outside the 10% criterion — review and retry",
    condition: {
      type: "calculationResult",
      calculationId: "p1-c06",
      // Both branch predicates include 10, but the inclusive-pass edge is ordered first;
      // this avoids a floating-point gap immediately above the source's inclusive boundary.
      min: 10,
    },
  },
];

const requiredEquipment = [
  "hand-warmer-calorimeter",
  "ring-stand",
  "hot-plate-stirrer",
  "polystyrene-cup-8oz",
  "wooden-calorimeter-cover",
  "probe-thermometer",
  "magnetic-stir-bar",
  "beaker-150ml",
  "graduated-cylinder",
  "analytical-balance",
  "weigh-boat",
  "stirring-rod",
  "spatula",
  "wash-bottle",
  "waste-beaker",
  "distilled-water-bottle-2l",
  "reagent-bottle",
];

const initialEquipment = [
  equipment("hand-warmer-calorimeter-1", "hand-warmer-calorimeter", "Hand-warmer calorimeter", {
    ...empty(),
    visualState: "CAL-00",
  }, "workbench"),
  equipment("ring-stand-1", "ring-stand", "Ring stand with support ring", empty(), "storage"),
  equipment("hot-plate-stirrer-1", "hot-plate-stirrer", "Hot plate and magnetic stirrer"),
  equipment("outer-cup-1", "polystyrene-cup-8oz", "Outer 8 ounce polystyrene cup"),
  equipment("inner-cup-1", "polystyrene-cup-8oz", "Inner 8 ounce polystyrene cup"),
  equipment("wooden-cover-1", "wooden-calorimeter-cover", "Wooden calorimeter cover"),
  equipment("probe-thermometer-1", "probe-thermometer", "Probe thermometer"),
  equipment("magnetic-stir-bar-1", "magnetic-stir-bar", "Magnetic stir bar"),
  equipment("beaker-150ml-1", "beaker-150ml", "150 mL beaker"),
  equipment("graduated-cylinder-1", "graduated-cylinder", "100 mL graduated cylinder"),
  equipment("analytical-balance-1", "analytical-balance", "Analytical balance"),
  equipment("weigh-boat-1", "weigh-boat", "Weighing boat"),
  equipment("stirring-rod-1", "stirring-rod", "Stirring rod"),
  equipment("spatula-1", "spatula", "Spatula"),
  equipment("wash-bottle-1", "wash-bottle", "Wash bottle", liquid("Water", 500, 20)),
  equipment("waste-beaker-1", "waste-beaker", "Teacher-designated waste beaker"),
  equipment("distilled-water-bottle-1", "distilled-water-bottle", "Distilled water", liquid("Distilled water", 2000, 20)),
  equipment("magnesium-sulfate-1", "reagent-bottle", "Anhydrous magnesium sulfate", solid("magnesium-sulfate", "Anhydrous magnesium sulfate", 50)),
  equipment("calcium-chloride-1", "reagent-bottle", "Calcium chloride", solid("calcium-chloride", "Calcium chloride", 30)),
  equipment("ammonium-nitrate-1", "reagent-bottle", "Ammonium nitrate", solid("ammonium-nitrate", "Ammonium nitrate", 30)),
  equipment("sodium-acetate-1", "reagent-bottle", "Sodium acetate", solid("sodium-acetate", "Sodium acetate", 30)),
];

const technique = refineHandWarmerTechnique(applyStockSupplyVolumes({
  id: "hand-warmer-calorimetry",
  title: "Hand-Warmer Calorimetry",
  learningGoal: "Calibrate a nested-cup calorimeter, compare candidate salts, and defend an evidence-based hand-warmer design.",
  requiredEquipment,
  initialState: { equipment: initialEquipment },
  actions,
  process: { startNodeId: nodes[0].id, nodes, edges },
  successCriteria: actions
    .filter((action) => action.parameters.conditionalBranch !== "part1-tolerance-retry")
    .map((action) => ({
    id: `${action.id}-success`,
    type: "actionEvidence",
    label: `${action.id} completed`,
    actionId: action.id,
  })),
  commonMistakes: commonInvalidCases,
  resetBehavior: "resetTechnique",
  metadata: {
    version: "2.4.0",
    author: "Lab Studio",
    updatedAt: "2026-08-05T00:00:00.000Z",
    tags: [
      "calorimetry",
      "hand-warmer",
      "143-action-traceability",
      "two-part1-trials-runtime",
      "three-calibration-determinations-default",
      "three-calibration-determinations-runtime",
      "teacher-reviewed-calculations",
      "teacher-configurable-cleanup-stirring-notation",
      "session-configured-thermal-profiles",
      "student-entered-evidence",
    ],
  },
}));

const lab = refineHandWarmerLab(applyStockSupplyVolumes({
  id: "hand-warmer-calorimetry",
  title: "Designing an Effective Hand Warmer",
  // Matches the wording already published in public/labs/index.json, which the generator also
  // writes. The two had drifted; running the generator would otherwise overwrite the index copy.
  description: "A calorimetry investigation with practice trials, calorimeter calibration, student-designed comparison, analysis, and CER.",
  audience: "Chemistry",
  learningGoals: [
    "Use a nested-cup calorimeter safely and accurately.",
    "Determine and apply a calorimeter constant.",
    "Use experimental, cost, safety, and environmental evidence to design a hand warmer.",
  ],
  safetyNotes: [
    "Wear splash-proof goggles and protective gloves.",
    "Calcium chloride can cause skin burns.",
    "Keep ammonium nitrate away from heat and ignition sources.",
    "Use the teacher-designated disposal method.",
  ],
  equipment: requiredEquipment,
  // Cycle 04: the lab is a bundled *source*. It imports the technique's actions by exact version
  // instead of carrying a third byte-identical copy of them, and no longer embeds the technique at
  // all. Its own process, layout, and assessments stay lab-owned, and `initialState` becomes
  // explicit because `getInitialEquipment` can no longer derive it from an embedded technique.
  techniqueRefs: [
    {
      techniqueId: technique.id,
      version: technique.metadata.version,
      actionIds: "all",
    },
  ],
  techniques: [],
  initialState: technique.initialState,
  actions: [],
  process: technique.process,
  assessments: technique.successCriteria,
  metadata: {
    ...technique.metadata,
    tags: ["lab", ...technique.metadata.tags],
  },
}));

const uniqueActionIds = new Set(actions.map((action) => action.id));
const uniqueNodeIds = new Set(nodes.map((node) => node.id));
const techniqueReferencedActionIds = new Set(
  technique.process.nodes.map((node) => node.actionId),
);
const unreferencedTechniqueActions = actions.filter(
  (action) => !techniqueReferencedActionIds.has(action.id),
);
if (
  actions.length !== 310 ||
  nodes.length !== 310 ||
  technique.successCriteria.length !== 264 ||
  uniqueActionIds.size !== actions.length ||
  uniqueNodeIds.size !== nodes.length ||
  unreferencedTechniqueActions.length > 0
) {
  throw new Error(
    `Expected the generated technique to own 310 unique actions/nodes and 264 mandatory-path criteria; found ` +
      `${actions.length}/${nodes.length}/${technique.successCriteria.length} with ` +
      `${uniqueActionIds.size}/${uniqueNodeIds.size} unique ids and ` +
      `${unreferencedTechniqueActions.length} unreferenced technique action(s).`,
  );
}

const isCompositionSource =
  Array.isArray(lab.techniqueInstances) &&
  lab.compositionStart &&
  Array.isArray(lab.compositionConnections) &&
  Array.isArray(lab.reachabilityWitnesses);

if (isCompositionSource) {
  if ("techniqueRefs" in lab) {
    throw new Error("A hand-warmer composition source must not retain techniqueRefs.");
  }
  if (!Array.isArray(lab.actions) || !Array.isArray(lab.process?.nodes) || !Array.isArray(lab.process?.edges) || !Array.isArray(lab.assessments)) {
    throw new Error("A hand-warmer composition source must declare its lab-local actions, process, and assessments as arrays.");
  }
  const pinnedInstance = lab.techniqueInstances.find(
    (instance) =>
      instance.techniqueId === technique.id &&
      instance.version === technique.metadata.version,
  );
  if (!pinnedInstance) {
    throw new Error(
      `A hand-warmer composition source must pin ${technique.id}@${technique.metadata.version}.`,
    );
  }
  const localActionIds = new Set(lab.actions.map((action) => action.id));
  const duplicateLocalActionIds = lab.actions
    .filter((action) => uniqueActionIds.has(action.id))
    .map((action) => action.id);
  const copiedTechniqueNodes = lab.process.nodes
    .filter((node) => techniqueReferencedActionIds.has(node.actionId))
    .map((node) => node.id);
  const unresolvedLocalNodes = lab.process.nodes
    .filter((node) => !localActionIds.has(node.actionId))
    .map((node) => node.id);
  const techniqueCriterionIds = new Set(
    technique.successCriteria.map((criterion) => criterion.id),
  );
  const copiedCriteria = lab.assessments
    .filter((criterion) => techniqueCriterionIds.has(criterion.id))
    .map((criterion) => criterion.id);
  if (
    duplicateLocalActionIds.length > 0 ||
    copiedTechniqueNodes.length > 0 ||
    unresolvedLocalNodes.length > 0 ||
    copiedCriteria.length > 0
  ) {
    throw new Error(
      `Composition-source rows must remain lab-local and must not copy technique rows; found ` +
        `${duplicateLocalActionIds.length} duplicate action(s), ` +
        `${copiedTechniqueNodes.length} copied process node(s), ` +
        `${unresolvedLocalNodes.length} unresolved local node(s), and ` +
        `${copiedCriteria.length} copied criterion/criteria.`,
    );
  }
} else {
  // Legacy sources select the technique's complete published action set. Keep the original guard
  // so a later action that is absent from the copied process cannot be serialized silently.
  const referencedActionIds = new Set(lab.process.nodes.map((node) => node.actionId));
  const unreferenced = actions.filter((action) => !referencedActionIds.has(action.id));
  if (unreferenced.length > 0) {
    throw new Error(
      `techniqueRefs selects "all", but ${unreferenced.length} action(s) are referenced by no process node: ${unreferenced
        .map((action) => action.id)
        .join(", ")}.`,
    );
  }
  if (lab.assessments.length !== 264) {
    throw new Error(
      `Expected the legacy lab to copy 264 mandatory-path assessments; found ${lab.assessments.length}.`,
    );
  }
}

const techniquePath = join(root, "public/techniques/hand-warmer-calorimetry.json");
const labPath = join(root, "public/labs/hand-warmer-calorimetry.json");
writeFileSync(techniquePath, `${JSON.stringify(technique, null, 2)}\n`);
writeFileSync(labPath, `${JSON.stringify(lab, null, 2)}\n`);

const updateIndex = (path, entry, preferredIds) => {
  const index = JSON.parse(readFileSync(path, "utf8"));
  const order = new Map(preferredIds.map((id, index) => [id, index]));
  const next = [...index.filter((item) => item.id !== entry.id), entry]
    .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
};

const noIndex = process.argv.includes("--no-index");

if (!noIndex) updateIndex(join(root, "public/techniques/index.json"), {
  id: technique.id,
  title: technique.title,
  description: technique.learningGoal,
  file: "hand-warmer-calorimetry.json",
  tags: technique.metadata.tags,
}, [
  "weighing", "measuring-volume", "making-solution", "dilution",
  "transmittance-dilution", "transfer", "hard-water-precipitation", "filtration", "drying",
  "thermal-decomposition-mass-loss", "paper-chromatography",
  "hard-water-calculation", "beers-law-calibration",
  "brass-spectrophotometry", "hard-water-gravimetry",
  "titration-endpoint", "bonding-solids-tests", "redox-titration",
  "tablet-separation", "crystal-violet-kinetics",
  "hand-warmer-calorimetry", "titration-curve-analysis",
]);
if (!noIndex) updateIndex(join(root, "public/labs/index.json"), {
  id: lab.id,
  title: lab.title,
  description: lab.description,
  file: "hand-warmer-calorimetry.json",
  tags: lab.metadata.tags,
}, [
  "intro-filtration-demo", "hard-water-demo", "acid-base-titration",
  "marble-statue-kinetics", "paper-chromatography",
  "equilibrium-rainbow-display", "hand-warmer-calorimetry",
]);

console.log(
  `Generated ${technique.id} and ${lab.id} with ${rows.length} traced requirements and ${actions.length} executable actions ` +
    `(lab imports all ${actions.length} from ${technique.id}@${technique.metadata.version}; indexes ${noIndex ? "unchanged" : "updated"}).`,
);
