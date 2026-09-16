import { describe, expect, it } from "vitest";
import type { ActionDefinition, LabDefinition, RuntimeState } from "../../domain/types";
import { createEquipmentInstance } from "../../equipment/catalog";
import { createRuntimeState, performRuntimeAction, resolveInteractionIntent } from "../index";

const readEndpointPh: ActionDefinition = {
  id: "read-endpoint-ph",
  verb: "observe",
  label: "Read accepted-endpoint pH",
  parameters: {
    sourceDefinitionId: "ph-meter",
    targetDefinitionId: "erlenmeyer-flask-250ml",
    measurementId: "endpoint-ph",
    phReadingMode: "acceptedEndpoint",
    titrationModelId: "unknown-acid-naoh",
    dispenseActionId: "deliver-titrant",
    meterReadinessNotebookTag: "ph-meter-ready",
  },
  interaction: {
    type: "readInstrument",
    sourceDefinitionId: "ph-meter",
    targetDefinitionId: "erlenmeyer-flask-250ml",
    stationId: "ph-meter",
    accessibleLabel: "Read endpoint pH.",
  },
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "Read.", invalid: "Prepare the probe." },
  evidence: ["observe", "measurement"],
};

const recordEndpointPh: ActionDefinition = {
  id: "record-endpoint-ph",
  verb: "record",
  label: "Record accepted-endpoint pH",
  parameters: {
    measurementId: "endpoint-ph",
    unit: "pH",
    copyExistingMeasurementOnly: true,
    titrationModelId: "unknown-acid-naoh",
    phReadingMode: "acceptedEndpoint",
  },
  interaction: {
    type: "recordNotebook",
    valueParameter: "measurementId",
    accessibleLabel: "Copy endpoint pH.",
  },
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "Recorded.", invalid: "Read first." },
  evidence: ["record", "measurement"],
};

const endpointDefinition: LabDefinition = {
  id: "endpoint-ph-runtime",
  title: "Endpoint pH runtime",
  description: "Focused endpoint pH runtime fixture.",
  audience: "Test",
  learningGoals: [],
  safetyNotes: [],
  equipment: ["ph-meter", "erlenmeyer-flask-250ml"],
  titrationModels: [
    {
      id: "unknown-acid-naoh",
      type: "acidBase",
      analyte: {
        formula: "CH3COOH",
        role: "acid",
        strength: "weak",
        equilibriumConstant: 1.753e-5,
      },
      titrant: { formula: "NaOH", role: "base", strength: "strong" },
      analyteMolarityM: 0.0992,
      analyteVolumeMl: 25,
      titrantMolarityM: 0.1,
      temperatureC: 25,
      waterIonProduct: 1e-14,
      phPrecision: 2,
    },
  ],
  initialState: {
    equipment: [
      createEquipmentInstance("ph-meter", "1", "workbench"),
      {
        ...createEquipmentInstance("erlenmeyer-flask-250ml", "1", "workbench"),
        contents: {
          kind: "solution",
          label: "Accepted endpoint mixture",
          volumeMl: 49.8,
          solutes: [],
          contamination: [],
          wetState: "wet",
          visualState: "titration-pale-pink",
        },
      },
    ],
  },
  techniques: [],
  actions: [readEndpointPh, recordEndpointPh],
  process: {
    startNodeId: "read-node",
    nodes: [
      {
        id: "read-node",
        type: "observation",
        title: "Read",
        description: "Read pH.",
        actionId: "read-endpoint-ph",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "Read.", retry: "Read." },
      },
      {
        id: "record-node",
        type: "observation",
        title: "Record",
        description: "Record pH.",
        actionId: "record-endpoint-ph",
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "Recorded.", retry: "Record." },
      },
    ],
    edges: [
      { from: "read-node", to: "record-node", label: "Next", condition: { type: "always" } },
    ],
  },
  assessments: [],
  metadata: {
    version: "1.0.0",
    author: "Test",
    updatedAt: "2026-08-08T00:00:00.000Z",
    tags: ["test"],
  },
};

const acceptedState = (deliveredVolumeMl = 24.8): RuntimeState => {
  const state = createRuntimeState(endpointDefinition);
  const drops = Math.round(deliveredVolumeMl / 0.05);
  return {
    ...state,
    equipmentInstances: state.equipmentInstances.map((instance) =>
      instance.definitionId === "ph-meter"
        ? { ...instance, contents: { ...instance.contents, probeImmersedInInstanceId: "erlenmeyer-flask-250ml-1" } }
        : instance,
    ),
    dropDispenses: {
      "deliver-titrant": {
        actionId: "deliver-titrant",
        dropsDispensed: drops,
        dropVolumeMl: 0.05,
        deliveredVolumeMl,
        initialBuretteReadingMl: 0,
        currentBuretteReadingMl: deliveredVolumeMl,
        equivalenceDropCount: 496,
        endpointDropCount: 496,
        maxExtraDrops: 5,
        accepted: true,
        colorState: deliveredVolumeMl > 24.8 ? "darkPink" : "palePink",
      },
    },
    notebook: [
      {
        id: "ready",
        nodeId: "configuration",
        type: "observation",
        label: "Meter readiness",
        value: "Teacher confirmed.",
        tags: ["ph-meter-ready"],
        timestamp: "2026-08-08T00:00:00.000Z",
      },
    ],
  };
};

const read = (state: RuntimeState): RuntimeState =>
  performRuntimeAction(endpointDefinition, state, {
    actionId: "read-endpoint-ph",
    verb: "observe",
    sourceInstanceId: "ph-meter-1",
    targetInstanceId: "erlenmeyer-flask-250ml-1",
  });

describe("endpoint pH runtime", () => {
  it("blocks reading before probe immersion or endpoint acceptance", () => {
    const prepared = acceptedState();
    const withoutProbe = {
      ...prepared,
      equipmentInstances: prepared.equipmentInstances.map((instance) =>
        instance.definitionId === "ph-meter"
          ? { ...instance, contents: { ...instance.contents, probeImmersedInInstanceId: undefined } }
          : instance,
      ),
    };
    expect(read(withoutProbe).measurements.find((measurement) => measurement.id === "endpoint-ph")).toBeUndefined();

    const withoutAcceptance = { ...prepared, dropDispenses: {} };
    expect(read(withoutAcceptance).measurements.find((measurement) => measurement.id === "endpoint-ph")).toBeUndefined();
  });

  it("uses actual accepted volume and distinguishes overshoot from equivalence", () => {
    const equivalence = read(acceptedState(24.8));
    const overshoot = read(acceptedState(25.05));

    expect(equivalence.measurements.find((measurement) => measurement.id === "endpoint-ph")?.value).toBe(8.73);
    expect(overshoot.measurements.find((measurement) => measurement.id === "endpoint-ph")?.value).not.toBe(8.73);
    expect(overshoot.equipmentInstances.find((instance) => instance.definitionId === "ph-meter")?.contents.instrumentReadout)
      .toMatchObject({ acceptedTitrantVolumeMl: 25.05, idealEquivalenceVolumeMl: 24.8, idealEquivalencePh: 8.73 });
  });

  it("records the exact display value and clears the display on reset", () => {
    const measured = read(acceptedState());
    const rejectedReplacement = performRuntimeAction(endpointDefinition, measured, {
      actionId: "record-endpoint-ph",
      verb: "record",
      value: 7,
    });
    expect(rejectedReplacement.feedbackQueue.at(-1)?.message).toContain("must match");

    const copyIntent = resolveInteractionIntent(endpointDefinition, measured, {
      type: "notebookRecordIntent",
      origin: "programmatic",
    });
    expect(copyIntent.ok).toBe(true);
    if (!copyIntent.ok) throw new Error(copyIntent.feedback.message);
    expect(copyIntent.request.value).toBeUndefined();

    const recorded = performRuntimeAction(endpointDefinition, measured, copyIntent.request);
    expect(recorded.notebook.find((entry) => entry.tags.includes("endpoint-ph"))?.value).toContain("8.73");

    const reset = performRuntimeAction(endpointDefinition, measured, { verb: "reset" });
    expect(reset.equipmentInstances.find((instance) => instance.definitionId === "ph-meter")?.contents.instrumentReadout)
      .toBeUndefined();
    expect(
      reset.equipmentInstances.find((instance) => instance.definitionId === "ph-meter")?.contents
        .probeImmersedInInstanceId,
    ).toBeUndefined();
  });
});
