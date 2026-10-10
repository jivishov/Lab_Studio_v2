import { action, emptyContents, evidenceEffect, item, node, technique, twinOf } from "./common.mjs";

/**
 * Measure Liquid Volume, the 3D twin (D8; you, 2026-10-10: "Build 3D twin of measure liquid volume, ensure to
 * have atomized steps."). Pack 1's original (`public/techniques/measuring-volume.json`, which 2D keeps) pours to
 * the volume in one step and records the cylinder's volume for the student. Here the student:
 * 1. stands the 25 mL cylinder on the bench: the smallest that holds the sample, as in a lab, and one whose
 *    liquid the dropping pipette reaches (you, 2026-10-10; in the 100 mL cylinder a 20 mL level is 166 mm below
 *    the rim, deeper than the 154 mm pipette);
 * 2. pours the sample from its bottle to just below the line (`pourVolumeMl`, set 1 mL under the line by the lab);
 * 3. fills a dropping pipette from a small beaker of the sample, never from the bottle (the teacher's rule of
 *    2026-09-26: a pipette draws from an open vessel);
 * 4. adds drops until the bottom of the meniscus sits on the line, judged within `markToleranceMl`. A drop of
 *    0.05 mL lifts the meniscus about 0.2 mm, about a pixel at the drop view; 0.2 mL (0.75 mm) is under half the
 *    cylinder's 0.5 mL division and can be seen. Past the line, the excess is drawn back up into the pipette
 *    (`markDrawBack`; you, 2026-10-10), as in a lab, and the level brought back a drop at a time;
 * 5. reads the volume at eye level and records it, as typed: the entry is never checked against the level
 *    (teacher-prepared readings, 2026-09-25).
 *
 * The level step records the line's volume under `sample-volume` so it can be judged at acceptance; the
 * reading replaces it. Twin only: no practice version is listed, and Pack 1 in 3D plays the original.
 */
const LINE_TOLERANCE_ML = 0.2;

const sample = (volumeMl) => ({
  ...emptyContents(), kind: "liquid", label: "Hard water sample", volumeMl, wetState: "wet", visualState: "clear-liquid",
});

const equipment = [
  item("graduated-cylinder-1", "graduated-cylinder-25ml", "25 mL graduated cylinder"),
  item("sample-bottle-1", "sample-bottle", "Hard water sample", sample(120), "workbench"),
  item("sample-portion-1", "beaker-150ml", "Sample for the dropper", sample(10), "workbench"),
  item("beral-pipette-1", "beral-pipette", "Dropping pipette"),
];

const actions = [
  action("place-cylinder", "place", "Stand the cylinder on the bench", {
    equipmentDefinitionId: "graduated-cylinder-25ml",
    equipmentInstanceId: "graduated-cylinder-1",
    location: "workbench",
  }, { atomId: "atom.place.variable-volume-device", roles: { "variable-volume-measuring-device": "graduated-cylinder-25ml" },
    success: "The cylinder stands on the bench." }),
  action("pour-below-line", "transfer", "Pour the sample to just below the line", {
    sourceDefinitionId: "sample-bottle",
    sourceInstanceId: "sample-bottle-1",
    targetDefinitionId: "graduated-cylinder-25ml",
    targetInstanceId: "graduated-cylinder-1",
    volumeMl: "{{config.pourVolumeMl}}",
  }, {
    atomId: "atom.transfer.fill-below-graduation",
    // The callout reads "Release to pour the sample to just below the line", not the 1 mL-short volume the
    // runtime pours: the student pours by eye (fidelity review, 2026-10-10).
    interaction: { type: "pourInto", sourceDefinitionId: "sample-bottle", targetDefinitionId: "graduated-cylinder-25ml" },
    roles: { "liquid-source": "sample-bottle", "variable-volume-measuring-device": "graduated-cylinder-25ml" },
    success: "The sample is just below the line.",
  }),
  {
    ...action("fill-pipette", "transfer", "Fill the dropping pipette with sample", {
      sourceDefinitionId: "beaker-150ml",
      sourceInstanceId: "sample-portion-1",
      targetDefinitionId: "beral-pipette",
      targetInstanceId: "beral-pipette-1",
    }, {
      atomId: "atom.transfer.draw-into-transfer-pipette",
      interaction: { type: "pourInto", sourceDefinitionId: "beaker-150ml", targetDefinitionId: "beral-pipette" },
      roles: { "pipette-liquid-source": "beaker-150ml", "transfer-pipette": "beral-pipette" },
      success: "The dropping pipette holds sample.",
    }),
    volume: { source: "target-fill-fraction", fraction: 1 },
  },
  action("drops-to-line", "transfer", "Add sample drop by drop to the line", {
    sourceDefinitionId: "beral-pipette",
    sourceInstanceId: "beral-pipette-1",
    targetDefinitionId: "graduated-cylinder-25ml",
    targetInstanceId: "graduated-cylinder-1",
    markDispense: "target",
    markVolumeMl: "{{config.targetVolumeMl}}",
    dropVolumeMl: 0.05,
    markToleranceMl: LINE_TOLERANCE_ML,
    // Past the line the excess is drawn back up into the pipette, not remade (you, 2026-10-10).
    markDrawBack: true,
    outputMeasurementId: "sample-volume",
    outputLabel: "Sample volume",
  }, {
    atomId: "atom.transfer.dropwise-to-graduation",
    interaction: { type: "dispenseDrops", sourceDefinitionId: "beral-pipette", targetDefinitionId: "graduated-cylinder-25ml" },
    roles: { "transfer-pipette": "beral-pipette", "variable-volume-measuring-device": "graduated-cylinder-25ml" },
    success: "The bottom of the meniscus is on the line.",
  }),
  action("read-volume", "record", "Read and record the volume", {
    measurementId: "sample-volume",
    label: "Sample volume",
    unit: "mL",
    inputMode: "numeric",
    inputRole: "studentResponse",
    inputLabel: "Volume at the bottom of the meniscus (mL)",
    inputMin: 0,
    inputMinExclusive: true,
    inputStep: 0.1,
    inputRequired: true,
    studentValueRequired: true,
  }, { evidence: ["record", "notebook"], success: "Volume recorded." }),
];

const nodes = [
  node("place-cylinder", "Stand the cylinder", "Stand the clean, dry 25 mL graduated cylinder upright on the bench."),
  node("pour-below-line", "Pour to below the line",
    "Pour the hard-water sample from its bottle into the cylinder until the level is just below the {{config.targetVolumeMl}} mL line."),
  node("fill-pipette", "Fill the dropping pipette", "Draw sample from the small beaker into the dropping pipette."),
  node("drops-to-line", "Add drops to the line",
    "Hold the pipette over the cylinder and add sample a drop at a time until, at eye level, the bottom of the meniscus sits on the line. If it goes past, draw the excess back up with the pipette.",
    { measurementId: "sample-volume" }),
  node("read-volume", "Read the volume",
    "With your eye level with the meniscus, read the volume at the bottom of the curve to the nearest 0.1 mL and record it.",
    { notebookTag: "sample-volume" }, "observation"),
];

const measuring = technique({
  id: "measuring-volume-3d",
  title: "Measure Liquid Volume",
  learningGoal: "Measure a liquid sample with a graduated cylinder: pour to just below the line, finish drop by drop, and read the bottom of the meniscus at eye level.",
  equipment,
  actions,
  nodes,
  slots: [
    { id: "targetVolumeMl", valueType: "number", required: true },
    { id: "pourVolumeMl", valueType: "number", required: true },
  ],
  evidenceOutputs: [{ id: "sample-volume", kind: "notebook", actionId: "read-volume", referenceId: "sample-volume" }],
  successActionId: "read-volume",
  tags: ["measurement", "volume"],
  legacyActionEffects: [evidenceEffect("read-volume")],
});

/** The composable twin a 3D lab composes. It drops nothing: both slots are used by its steps. */
export const twin = twinOf(measuring, { id: "measuring-volume-3d" });
