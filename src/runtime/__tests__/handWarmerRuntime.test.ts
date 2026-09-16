import { describe, expect, it } from "vitest";
import { emptyContents, type TechniqueDefinition } from "../../domain/types";
import { createRuntimeState, performRuntimeAction, resolveInteractionIntent } from "../index";

const action = (
  id: string,
  verb: TechniqueDefinition["actions"][number]["verb"],
  parameters: TechniqueDefinition["actions"][number]["parameters"],
): TechniqueDefinition["actions"][number] => ({
  id,
  verb,
  label: id,
  parameters,
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: `${id} complete`, invalid: `${id} invalid` },
  evidence: [verb],
});

const definition: TechniqueDefinition = {
  id: "thermal-runtime-test",
  title: "Thermal runtime test",
  learningGoal: "Exercise generic calorimetry runtime behavior.",
  requiredEquipment: ["beaker-150ml", "hot-plate-stirrer"],
  initialState: {
    equipment: [
      {
        id: "beaker",
        definitionId: "beaker-150ml",
        label: "Beaker",
        location: "workbench",
        contents: {
          ...emptyContents(),
          kind: "liquid",
          label: "Water",
          volumeMl: 100,
          temperatureC: 21,
          wetState: "wet",
          visualState: "clear-liquid",
        },
      },
      {
        id: "stirrer",
        definitionId: "hot-plate-stirrer",
        label: "Hot plate stirrer",
        location: "workbench",
        contents: emptyContents(),
      },
    ],
  },
  actions: [
    action("heat-water", "heat", {
      sourceInstanceId: "beaker",
      targetInstanceId: "stirrer",
      thermalMode: "targetTemperature",
      targetTemperatureC: 50,
      temperatureC: 50,
      toleranceC: 3,
    }),
    action("stir-water", "observe", {
      targetInstanceId: "stirrer",
      controlType: "stirrer",
      stirLevel: 4,
      splashThreshold: 7,
    }),
    action("record-peak", "observe", {
      sourceInstanceId: "beaker",
      temperatureEvidenceKind: "peak",
      temperatureC: 50,
      evidenceId: "peak",
    }),
    action("wait-15", "observe", {
      timerId: "calibration-timer",
      waitSeconds: 15,
      requiredSeconds: 15,
    }),
  ],
  process: {
    startNodeId: "heat",
    nodes: [
      {
        id: "heat",
        type: "action",
        title: "Heat",
        description: "Heat water.",
        actionId: "heat-water",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "done", retry: "retry" },
      },
      {
        id: "stir",
        type: "action",
        title: "Stir",
        description: "Stir water.",
        actionId: "stir-water",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "done", retry: "retry" },
      },
      {
        id: "peak",
        type: "action",
        title: "Peak",
        description: "Record peak.",
        actionId: "record-peak",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "done", retry: "retry" },
      },
      {
        id: "timer",
        type: "action",
        title: "Timer",
        description: "Wait.",
        actionId: "wait-15",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "done", retry: "retry" },
      },
    ],
    edges: [
      { from: "heat", to: "stir", label: "next", condition: { type: "always" } },
      { from: "stir", to: "peak", label: "next", condition: { type: "always" } },
      { from: "peak", to: "timer", label: "next", condition: { type: "always" } },
    ],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "1.0.0",
    author: "Lab Studio",
    updatedAt: "2026-07-27T00:00:00.000Z",
    tags: ["test"],
  },
};

const finePourDefinition: TechniqueDefinition = {
  id: "fine-pour-runtime-test",
  title: "Fine-pour runtime test",
  learningGoal: "Exercise a calibrated graduated-cylinder top-up.",
  requiredEquipment: ["distilled-water-bottle", "graduated-cylinder"],
  initialState: {
    equipment: [
      {
        id: "water-source",
        definitionId: "distilled-water-bottle",
        label: "Distilled water",
        location: "workbench",
        contents: {
          ...emptyContents(),
          kind: "liquid",
          label: "Distilled water",
          volumeMl: 1905,
          wetState: "wet",
          visualState: "clear-liquid",
        },
      },
      {
        id: "cylinder",
        definitionId: "graduated-cylinder",
        label: "Graduated cylinder",
        location: "workbench",
        contents: {
          ...emptyContents(),
          kind: "liquid",
          label: "Distilled water",
          volumeMl: 95,
          wetState: "wet",
          visualState: "clear-liquid",
        },
      },
    ],
  },
  actions: [
    {
      ...action("reduce-pour-rate", "measureVolume", {
        sourceInstanceId: "water-source",
        sourceDefinitionId: "distilled-water-bottle",
        targetInstanceId: "cylinder",
        targetDefinitionId: "graduated-cylinder",
        targetVolumeMl: 99,
        measurementId: "fine-pour-volume",
      }),
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "distilled-water-bottle",
        targetDefinitionId: "graduated-cylinder",
        accessibleLabel: "Pour slowly to the near-line checkpoint.",
      },
    },
  ],
  process: {
    startNodeId: "fine-pour",
    nodes: [
      {
        id: "fine-pour",
        type: "action",
        title: "Reduce pour rate",
        description: "Top up near the graduation.",
        actionId: "reduce-pour-rate",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "done", retry: "retry" },
      },
    ],
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: {
    version: "1.0.0",
    author: "Lab Studio",
    updatedAt: "2026-08-11T00:00:00.000Z",
    tags: ["test"],
  },
};

const recordedTemperatureDefinition: TechniqueDefinition = {
  ...definition,
  id: "recorded-temperature-runtime-test",
  actions: [
    action("record-initial-temperature", "observe", {
      inputMode: "numeric",
      inputRole: "studentResponse",
      inputRequired: true,
      unit: "°C",
      measurementId: "initial-temperature",
      temperatureTargetInstanceId: "beaker",
      recordedTemperatureTargetInstanceId: "beaker",
      recordedTemperatureLabel: "Recorded initial temperature",
      recordedTemperaturePrecision: 1,
    }),
  ],
  process: {
    startNodeId: "record-initial-temperature-node",
    nodes: [
      {
        id: "record-initial-temperature-node",
        type: "action",
        title: "Record initial temperature",
        description: "Record the initial temperature.",
        actionId: "record-initial-temperature",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "done", retry: "retry" },
      },
    ],
    edges: [],
  },
};

const run = (
  state: ReturnType<typeof createRuntimeState>,
  id: string,
  verb: TechniqueDefinition["actions"][number]["verb"],
) => performRuntimeAction(definition, state, { actionId: id, verb });

describe("generic calorimetry runtime", () => {
  it("supports independent heating, safe stirring, peak evidence, and an exact timer", () => {
    let state = createRuntimeState(definition);
    state = run(state, "heat-water", "heat");
    expect(state.equipmentInstances.find((item) => item.id === "beaker")?.contents.temperatureC).toBe(50);
    state = run(state, "stir-water", "observe");
    expect(state.thermalControls.stirrer).toMatchObject({ heatOn: false, stirOn: true, stirLevel: 4 });
    state = run(state, "record-peak", "observe");
    expect(state.temperatureEvidence).toEqual([
      expect.objectContaining({ id: "peak", kind: "peak", valueC: 50, scopeId: "scope-1" }),
    ]);
    state = run(state, "wait-15", "observe");
    expect(state.thermalControls["calibration-timer"].elapsedSeconds).toBe(15);
  });

  it("rejects splashing and preserves accepted evidence across a physical reset", () => {
    let state = createRuntimeState(definition);
    state = run(state, "heat-water", "heat");
    state = run(state, "stir-water", "observe");
    state = run(state, "record-peak", "observe");
    const rejected = performRuntimeAction(definition, { ...state, currentNodeId: "stir" }, {
      actionId: "stir-water",
      verb: "observe",
      parameters: { stirLevel: 9 },
    });
    expect(rejected.thermalControls.stirrer.stirLevel).toBe(4);
    const reset = performRuntimeAction(definition, state, {
      verb: "reset",
      parameters: { scope: "physical", nextScopeId: "trial-2", resumeNodeId: "heat" },
    });
    expect(reset.evidenceScopeId).toBe("trial-2");
    expect(reset.temperatureEvidence).toHaveLength(1);
    expect(reset.equipmentInstances.find((item) => item.id === "beaker")?.contents.temperatureC).toBe(21);
  });

  it("tops up a graduated cylinder by the fine-pour increment and conserves the source volume", () => {
    const initial = createRuntimeState(finePourDefinition);
    const resolved = resolveInteractionIntent(finePourDefinition, initial, {
      type: "pourIntent",
      origin: "keyboard",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error(resolved.feedback.message);
    const state = performRuntimeAction(finePourDefinition, initial, resolved.request);

    expect(state.equipmentInstances.find((item) => item.id === "cylinder")?.contents.volumeMl).toBe(99);
    expect(state.equipmentInstances.find((item) => item.id === "water-source")?.contents.volumeMl).toBe(1901);
    expect(state.measurements).toContainEqual(
      expect.objectContaining({ id: "fine-pour-volume", value: 99, unit: "mL", equipmentInstanceId: "cylinder" }),
    );
  });

  it("imprints only an accepted student-recorded initial temperature", () => {
    const before = createRuntimeState(recordedTemperatureDefinition);
    expect(before.equipmentInstances.find((item) => item.id === "beaker")?.contents.recordedTemperature).toBeUndefined();

    const after = performRuntimeAction(recordedTemperatureDefinition, before, {
      actionId: "record-initial-temperature",
      verb: "observe",
      value: 20,
    });

    const beaker = after.equipmentInstances.find((item) => item.id === "beaker");
    expect(beaker?.contents.temperatureC).toBe(20);
    expect(beaker?.contents.recordedTemperature).toEqual({
      label: "Recorded initial temperature",
      valueC: 20,
      precision: 1,
      provenance: "student-recorded",
    });
    expect(after.measurements).toContainEqual(
      expect.objectContaining({ id: "initial-temperature", value: 20, unit: "°C" }),
    );
  });
});
