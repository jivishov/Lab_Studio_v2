import { describe, expect, it } from "vitest";
import { emptyContents } from "../../domain/types";
import type { ActionDefinition, ProcessNode, RuntimeState, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState, performRuntimeAction } from "../index";

const scopedBlankTag = "repeated--1--instrument-blanked";

const action = (
  id: string,
  parameters: ActionDefinition["parameters"],
  interaction?: ActionDefinition["interaction"],
): ActionDefinition => ({
  id,
  verb: "observe",
  label: id,
  parameters,
  interaction,
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "ok", invalid: "no" },
  evidence: [],
});

const node = (actionId: string): ProcessNode => ({
  id: `${actionId}-node`,
  type: "action",
  title: actionId,
  description: actionId,
  actionId,
  config: {},
  validation: [],
  hints: [],
  feedback: { success: "ok", retry: "again" },
});

const fixture = (): TechniqueDefinition => {
  const actions = [
    action("configure-wavelength", {
      configurationQuantity: "measurement wavelength",
      measurementId: "fixture-wavelength",
      inputMode: "numeric",
      unit: "nm",
      tag: "fixture-wavelength-configured",
    }),
    action("zero-instrument", {
      photometerOperation: "zero",
      photometerInstanceId: "fixture-spectrophotometer",
      cuvetteInstanceId: "fixture-blank-cuvette",
      wavelengthMeasurementId: "fixture-wavelength",
      tag: scopedBlankTag,
    }, {
      type: "readInstrument",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      accessibleLabel: "Zero the photometer.",
    }),
    action("read-percent-transmittance", {
      photometerOperation: "read",
      photometerInstanceId: "fixture-spectrophotometer",
      cuvetteInstanceId: "fixture-blank-cuvette",
      wavelengthMeasurementId: "fixture-wavelength",
      requiresZeroNotebookTag: scopedBlankTag,
      photometricQuantity: "percentTransmittance",
      measurementId: "fixture-percent-t",
      unit: "%T",
    }, {
      type: "readInstrument",
      sourceDefinitionId: "cuvette",
      targetDefinitionId: "spectrophotometer",
      accessibleLabel: "Read percent transmittance.",
    }),
  ];

  return {
    id: "catalog04-notebook-tag-gate",
    title: "Catalog 04 notebook-tag gate",
    learningGoal: "Exercise the scoped zero/read reducer gate.",
    requiredEquipment: ["spectrophotometer", "cuvette"],
    initialState: {
      equipment: [
        {
          id: "fixture-spectrophotometer",
          definitionId: "spectrophotometer",
          label: "Fixture spectrophotometer",
          location: "workbench",
          contents: emptyContents(),
        },
        {
          id: "fixture-blank-cuvette",
          definitionId: "cuvette",
          label: "Fixture blank cuvette",
          location: "snapZone",
          snapZoneId: "spectrophotometer-cuvette-slot",
          contents: {
            ...emptyContents(),
            kind: "solution",
            label: "Approved blank",
            volumeMl: 3,
            wetState: "wet",
            visualState: "clear-liquid",
          },
        },
      ],
    },
    actions,
    process: {
      startNodeId: "configure-wavelength-node",
      nodes: actions.map((entry) => node(entry.id)),
      edges: [
        { from: "configure-wavelength-node", to: "zero-instrument-node", label: "Next", condition: { type: "validationPassed" } },
        { from: "zero-instrument-node", to: "read-percent-transmittance-node", label: "Next", condition: { type: "validationPassed" } },
      ],
    },
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: { version: "1.0.0", author: "Catalog 04 fixture", updatedAt: "2026-09-13", tags: [] },
  };
};

const lastFeedback = (state: RuntimeState) => state.feedbackQueue.at(-1)?.message ?? "";

describe("catalog 04 scoped notebook-tag photometer gate", () => {
  it("blocks before zeroing and accepts the read after the matching scoped producer", () => {
    const definition = fixture();
    const initial = createRuntimeState(definition);
    expect(initial.notebook.some((entry) => entry.tags.includes(scopedBlankTag))).toBe(false);

    const configured = performRuntimeAction(definition, initial, {
      actionId: "configure-wavelength",
      verb: "observe",
      measurementId: "fixture-wavelength",
      value: 630,
      unit: "nm",
    });
    const blocked = performRuntimeAction(definition, {
      ...configured,
      currentNodeId: "read-percent-transmittance-node",
    }, {
      actionId: "read-percent-transmittance",
      verb: "observe",
      value: 42,
    });
    expect(lastFeedback(blocked)).toMatch(/not been zeroed/i);
    expect(blocked.measurements.some((entry) => entry.id === "fixture-percent-t")).toBe(false);

    const zeroed = performRuntimeAction(definition, {
      ...configured,
      currentNodeId: "zero-instrument-node",
    }, {
      actionId: "zero-instrument",
      verb: "observe",
    });
    expect(zeroed.notebook.some((entry) => entry.tags.includes(scopedBlankTag))).toBe(true);

    const read = performRuntimeAction(definition, zeroed, {
      actionId: "read-percent-transmittance",
      verb: "observe",
      value: 42,
    });
    expect(read.measurements.find((entry) => entry.id === "fixture-percent-t")?.value).toBe(42);
  });
});
