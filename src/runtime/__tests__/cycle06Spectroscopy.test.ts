/**
 * Cycle 06 — Investigation 1 (Blue #1 percent transmittance) and Investigation 11 (crystal violet).
 *
 * These cover the runtime behaviour Cycle 06 changed and could not execute under the repository's
 * validation policy (`AGENTS.md`): the photometer gate that makes a reading depend on a placed
 * instrument, a configured wavelength, a recorded zero, and an occupied sample compartment; the
 * separation of percent transmittance, decimal transmittance, and absorbance; and the micromolar
 * dilution template that previously had no implementation and so derived 0 from nothing.
 *
 * Authored, not executed. See `docs/_cycle-06-audit-section.md` §21.
 */
import { describe, expect, it } from "vitest";
import { emptyContents } from "../../domain/types";
import type {
  ActionDefinition,
  ContentState,
  ProcessNode,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import {
  calculateAbsorbanceFromDecimalT,
  calculateAbsorbanceFromPercentT,
  calculateDecimalTransmittance,
  calculateDilutedConcentrationMicromolar,
  PHOTOMETRIC_UNITS,
  photometricValueInRange,
} from "../calculations";
import { createRuntimeState, performRuntimeAction } from "../index";

/* ------------------------------------------------------------------ *
 * Pure conversions: %T, T, and absorbance are three different numbers.
 * ------------------------------------------------------------------ */

describe("photometric quantity conversions", () => {
  it("converts a percent transmittance to a decimal transmittance", () => {
    expect(calculateDecimalTransmittance(42)).toBeCloseTo(0.42, 4);
  });

  it("refuses a percent transmittance outside the instrument's range", () => {
    expect(() => calculateDecimalTransmittance(0)).toThrow(/greater than 0/i);
    expect(() => calculateDecimalTransmittance(101)).toThrow(/at most 100/i);
  });

  it("applies A = -log10(T) to a decimal transmittance", () => {
    expect(calculateAbsorbanceFromDecimalT(0.42)).toBeCloseTo(0.3768, 4);
    expect(calculateAbsorbanceFromDecimalT(1)).toBeCloseTo(0, 6);
  });

  it("refuses to take -log10 of a percent transmittance", () => {
    // The defect this prevents: -log10(42) is -1.6232, a negative absorbance that reads as a number.
    expect(() => calculateAbsorbanceFromDecimalT(42)).toThrow(/not a decimal transmittance/i);
    expect(() => calculateAbsorbanceFromDecimalT(100)).toThrow(/not a decimal transmittance/i);
  });

  it("agrees with the percent-input conversion for the same beam", () => {
    expect(calculateAbsorbanceFromDecimalT(calculateDecimalTransmittance(42))).toBeCloseTo(
      calculateAbsorbanceFromPercentT(42),
      3,
    );
  });

  it("fixes one unit per quantity", () => {
    expect(PHOTOMETRIC_UNITS.percentTransmittance).toBe("%T");
    expect(PHOTOMETRIC_UNITS.decimalTransmittance).toBe("T");
    expect(PHOTOMETRIC_UNITS.absorbance).toBe("absorbance");
  });

  it("knows which values each quantity can physically take", () => {
    expect(photometricValueInRange("percentTransmittance", 42)).toBe(true);
    expect(photometricValueInRange("percentTransmittance", 101)).toBe(false);
    expect(photometricValueInRange("decimalTransmittance", 0.42)).toBe(true);
    expect(photometricValueInRange("decimalTransmittance", 42)).toBe(false);
    expect(photometricValueInRange("absorbance", 1.4)).toBe(true);
    expect(photometricValueInRange("absorbance", -0.01)).toBe(false);
  });
});

describe("micromolar dilution, the template that had no implementation", () => {
  it("applies M1V1 = M2V2 and reports micromolar", () => {
    // 1.0e-5 M stock, 8 mL into 10 mL, is 8.0e-6 M, which is 8 uM.
    expect(calculateDilutedConcentrationMicromolar(1e-5, 8, 10)).toBeCloseTo(8, 4);
    expect(calculateDilutedConcentrationMicromolar(1e-5, 0, 10)).toBeCloseTo(0, 4);
  });

  it("does not quantise a dilute standard to zero", () => {
    // Routing this through the molar six-decimal rounding would have returned 0.
    expect(calculateDilutedConcentrationMicromolar(1e-6, 1, 10)).toBeCloseTo(0.1, 4);
  });

  it("refuses an unrecorded stock concentration or an impossible final volume", () => {
    expect(() => calculateDilutedConcentrationMicromolar(Number.NaN, 8, 10)).toThrow(/stock/i);
    expect(() => calculateDilutedConcentrationMicromolar(1e-5, 8, 0)).toThrow(/final volume/i);
  });
});

/* ------------------------------------------------------------------ *
 * The photometer gate.
 * ------------------------------------------------------------------ */

const solution = (label: string, visualState: string): ContentState => ({
  ...emptyContents(),
  kind: "solution",
  label,
  volumeMl: 3,
  wetState: "wet",
  visualState,
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

const action = (
  id: string,
  verb: ActionDefinition["verb"],
  parameters: ActionDefinition["parameters"],
  extra: Partial<ActionDefinition> = {},
): ActionDefinition => ({
  id,
  verb,
  label: id,
  parameters,
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: "ok", invalid: "no" },
  evidence: [],
  ...extra,
});

const READ_PARAMS = {
  photometerOperation: "read",
  photometricQuantity: "percentTransmittance",
  photometerInstanceId: "fx-spec",
  photometerDefinitionId: "spectrophotometer",
  wavelengthMeasurementId: "fx-wavelength",
  requiresZeroNotebookTag: "instrument-blanked",
  cuvetteInstanceId: "fx-sample-cuvette",
  measurementId: "fx-percent-t",
};

/**
 * A four-step fixture: record the wavelength, seat the blank, zero, then read the sample.
 * `spectrophotometerLocation` and the seated cuvette are varied per test to exercise each gate.
 */
const photometerChain = (
  overrides: {
    instrumentOnShelf?: boolean;
    seatedCuvetteId?: string | null;
    emptyCuvette?: boolean;
  } = {},
): TechniqueDefinition => {
  const actions = [
    // `configurationQuantity` is what makes this store a measurement. Without it the generic
    // `observe` path writes a notebook entry alone, every gate below becomes unsatisfiable, and the
    // whole fixture fails at the zero — which is the defect the first version of this cycle shipped
    // and which this authored-but-unexecuted file would have caught on its first run.
    action("fx-set-wavelength", "observe", {
      configurationQuantity: "measurement wavelength",
      configuredValue: 630,
      measurementId: "fx-wavelength",
      inputMode: "numeric",
      unit: "nm",
      tag: "teacher-wavelength",
    }),
    action("fx-zero", "observe", {
      photometerOperation: "zero",
      photometerInstanceId: "fx-spec",
      wavelengthMeasurementId: "fx-wavelength",
      cuvetteInstanceId: "fx-blank-cuvette",
      tag: "instrument-blanked",
      note: "Zeroed against the approved blank.",
    }, {
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "cuvette",
        accessibleLabel: "Zero the instrument.",
      },
    }),
    action("fx-read", "observe", READ_PARAMS, {
      interaction: {
        type: "readInstrument",
        sourceDefinitionId: "cuvette",
        accessibleLabel: "Read the instrument.",
      },
    }),
    action("fx-record", "record", {
      measurementId: "fx-percent-t",
      label: "Central table %T",
      unit: "%T",
    }),
  ];

  const seatedId = overrides.seatedCuvetteId === undefined ? "fx-sample-cuvette" : overrides.seatedCuvetteId;

  return {
    id: "fx-photometry",
    title: "Fixture photometry",
    learningGoal: "Exercise the photometer gate.",
    requiredEquipment: ["spectrophotometer", "cuvette"],
    initialState: {
      equipment: [
        {
          id: "fx-spec",
          definitionId: "spectrophotometer",
          label: "Spectrophotometer",
          location: overrides.instrumentOnShelf ? "shelf" : "workbench",
          contents: emptyContents(),
        },
        {
          id: "fx-blank-cuvette",
          definitionId: "cuvette",
          label: "Blank cuvette",
          location: seatedId === "fx-blank-cuvette" ? "snapZone" : "workbench",
          snapZoneId: seatedId === "fx-blank-cuvette" ? "spectrophotometer-cuvette-slot" : undefined,
          contents: solution("Blank", "clear-liquid"),
        },
        {
          id: "fx-sample-cuvette",
          definitionId: "cuvette",
          label: "Sample cuvette",
          location: seatedId === "fx-sample-cuvette" ? "snapZone" : "workbench",
          snapZoneId: seatedId === "fx-sample-cuvette" ? "spectrophotometer-cuvette-slot" : undefined,
          contents: overrides.emptyCuvette ? emptyContents() : solution("Blue #1 standard", "blue1-8-2"),
        },
      ],
    },
    actions,
    process: {
      startNodeId: "fx-set-wavelength-node",
      nodes: actions.map((entry) => node(entry.id)),
      edges: actions.slice(1).map((entry, index) => ({
        from: `${actions[index].id}-node`,
        to: `${entry.id}-node`,
        label: "Next",
        condition: { type: "validationPassed" as const },
      })),
    },
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: { version: "1.0.0", author: "fixture", updatedAt: "2026-08-05T00:00:00.000Z", tags: [] },
  };
};

const lastMessage = (state: RuntimeState) =>
  state.feedbackQueue[state.feedbackQueue.length - 1]?.message ?? "";

const recordWavelength = (definition: TechniqueDefinition, nm = 630) =>
  performRuntimeAction(definition, createRuntimeState(definition), {
    actionId: "fx-set-wavelength",
    verb: "observe",
    measurementId: "fx-wavelength",
    value: nm,
    unit: "nm",
  });

describe("a configuration value is only real if the runtime stores it", () => {
  it("stores the configured wavelength as a measurement the gates can find", () => {
    const definition = photometerChain();
    const state = recordWavelength(definition, 630);
    const measurement = state.measurements.find((entry) => entry.id === "fx-wavelength");
    expect(measurement?.value).toBe(630);
    expect(measurement?.unit).toBe("nm");
  });

  it("blocks with the missing value named when no classroom configuration exists", () => {
    // Both dated plans withhold the wavelength and the stock concentration, so the shipped content
    // declares no `configuredValue`. Blocking here is what an unresolved C point requires; it is not
    // an error state to be defaulted away.
    const definition = photometerChain();
    const configure = definition.actions.find((entry) => entry.id === "fx-set-wavelength")!;
    delete configure.parameters.configuredValue;
    const after = performRuntimeAction(definition, createRuntimeState(definition), {
      actionId: "fx-set-wavelength",
      verb: "observe",
    });
    expect(lastMessage(after)).toMatch(/no configured measurement wavelength/i);
    expect(after.measurements.some((entry) => entry.id === "fx-wavelength")).toBe(false);
  });

  it("keeps the notebook tag, so gates that read evidence rather than measurements still fire", () => {
    const definition = photometerChain();
    const state = recordWavelength(definition);
    const entry = state.notebook[state.notebook.length - 1];
    expect(entry.tags).toContain("teacher-wavelength");
    expect(entry.tags).toContain("configuration");
  });
});

const zeroInstrument = (definition: TechniqueDefinition, state: RuntimeState) =>
  performRuntimeAction(definition, state, { actionId: "fx-zero", verb: "observe" });

const readSample = (definition: TechniqueDefinition, state: RuntimeState, value = 42) =>
  performRuntimeAction(definition, state, { actionId: "fx-read", verb: "observe", value });

describe("a photometric reading requires the instrument to be usable", () => {
  it("refuses to read an instrument still on the shelf", () => {
    const definition = photometerChain({ instrumentOnShelf: true });
    const after = zeroInstrument(definition, recordWavelength(definition));
    expect(lastMessage(after)).toMatch(/still on the shelf/i);
  });

  it("refuses to zero or read with no configured wavelength", () => {
    const definition = photometerChain({ seatedCuvetteId: "fx-blank-cuvette" });
    // Skipping the wavelength step entirely: the zero is the first action attempted.
    const state = createRuntimeState(definition);
    const after = performRuntimeAction(definition, { ...state, currentNodeId: "fx-zero-node" }, {
      actionId: "fx-zero",
      verb: "observe",
    });
    expect(lastMessage(after)).toMatch(/no configured measurement wavelength/i);
  });

  it("refuses to read with an empty sample compartment", () => {
    const definition = photometerChain({ seatedCuvetteId: null });
    let state = recordWavelength(definition);
    state = zeroInstrument(definition, state);
    expect(lastMessage(state)).toMatch(/sample compartment is empty/i);
  });

  it("refuses to read a cuvette that is not the one seated", () => {
    const definition = photometerChain({ seatedCuvetteId: "fx-blank-cuvette" });
    let state = recordWavelength(definition);
    state = zeroInstrument(definition, state);
    state = readSample(definition, state);
    expect(lastMessage(state)).toMatch(/not the cuvette this step reads/i);
  });

  it("refuses to read an empty cuvette", () => {
    const definition = photometerChain({ emptyCuvette: true });
    let state = recordWavelength(definition);
    // The blank is not seated in this fixture, so zero against the sample slot instead.
    state = performRuntimeAction(definition, state, {
      actionId: "fx-zero",
      verb: "observe",
      parameters: { cuvetteInstanceId: "fx-sample-cuvette" },
    });
    expect(lastMessage(state)).toMatch(/is empty/i);
  });

  it("refuses a sample read before the instrument has been zeroed", () => {
    const definition = photometerChain();
    const state = createRuntimeState(definition);
    const withWavelength = performRuntimeAction(definition, state, {
      actionId: "fx-set-wavelength",
      verb: "observe",
      measurementId: "fx-wavelength",
      value: 630,
      unit: "nm",
    });
    const after = performRuntimeAction(
      definition,
      { ...withWavelength, currentNodeId: "fx-read-node" },
      { actionId: "fx-read", verb: "observe", value: 42 },
    );
    expect(lastMessage(after)).toMatch(/not been zeroed/i);
  });
});

describe("a photometric reading is evidence, and the record consumes it", () => {
  const completeRun = () => {
    const definition = photometerChain({ seatedCuvetteId: "fx-blank-cuvette" });
    let state = recordWavelength(definition);
    state = zeroInstrument(definition, state);
    return { definition, state };
  };

  it("stores the reading with the unit its quantity fixes and the cuvette as provenance", () => {
    const definition = photometerChain();
    let state = recordWavelength(definition);
    // Zero against the seated sample cuvette so the chain can proceed in this fixture.
    state = performRuntimeAction(definition, state, {
      actionId: "fx-zero",
      verb: "observe",
      parameters: { cuvetteInstanceId: "fx-sample-cuvette" },
    });
    state = readSample(definition, state, 42);
    const measurement = state.measurements.find((entry) => entry.id === "fx-percent-t");
    expect(measurement?.value).toBe(42);
    expect(measurement?.unit).toBe("%T");
    expect(measurement?.equipmentInstanceId).toBe("fx-sample-cuvette");
  });

  it("tags the notebook entry with the quantity, so a table can never mix the three", () => {
    const definition = photometerChain();
    let state = recordWavelength(definition);
    state = performRuntimeAction(definition, state, {
      actionId: "fx-zero",
      verb: "observe",
      parameters: { cuvetteInstanceId: "fx-sample-cuvette" },
    });
    state = readSample(definition, state, 42);
    const entry = state.notebook[state.notebook.length - 1];
    expect(entry.tags).toContain("photometer-reading");
    expect(entry.tags).toContain("percentTransmittance");
    expect(entry.value).toBe("42 %T");
  });

  it("refuses a value the declared quantity cannot take", () => {
    const definition = photometerChain();
    let state = recordWavelength(definition);
    state = performRuntimeAction(definition, state, {
      actionId: "fx-zero",
      verb: "observe",
      parameters: { cuvetteInstanceId: "fx-sample-cuvette" },
    });
    state = readSample(definition, state, 140);
    expect(lastMessage(state)).toMatch(/not a possible %T value/i);
  });

  it("flags an over-range reading rather than rejecting it, so the dilution branch has evidence", () => {
    const definition = photometerChain();
    let state = recordWavelength(definition);
    state = performRuntimeAction(definition, state, {
      actionId: "fx-zero",
      verb: "observe",
      parameters: { cuvetteInstanceId: "fx-sample-cuvette" },
    });
    state = performRuntimeAction(definition, state, {
      actionId: "fx-read",
      verb: "observe",
      value: 95,
      parameters: { reliableMaximum: 90 },
    });
    const entry = state.notebook[state.notebook.length - 1];
    expect(entry.tags).toContain("over-range");
    expect(state.measurements.find((measurement) => measurement.id === "fx-percent-t")?.value).toBe(95);
  });

  it("needs a value: the simulator supplies none for a student-read instrument", () => {
    const definition = photometerChain();
    let state = recordWavelength(definition);
    state = performRuntimeAction(definition, state, {
      actionId: "fx-zero",
      verb: "observe",
      parameters: { cuvetteInstanceId: "fx-sample-cuvette" },
    });
    state = performRuntimeAction(definition, state, { actionId: "fx-read", verb: "observe" });
    expect(lastMessage(state)).toMatch(/instrument has no reading to report/i);
  });

  it("uses the configured instrument response when the content declares one", () => {
    const definition = photometerChain();
    let state = recordWavelength(definition);
    state = performRuntimeAction(definition, state, {
      actionId: "fx-zero",
      verb: "observe",
      parameters: { cuvetteInstanceId: "fx-sample-cuvette" },
    });
    state = performRuntimeAction(definition, state, {
      actionId: "fx-read",
      verb: "observe",
      parameters: { instrumentReadingValue: 37.5 },
    });
    expect(state.measurements.find((entry) => entry.id === "fx-percent-t")?.value).toBe(37.5);
  });

  it("cannot record a reading that was never taken", () => {
    const { definition, state } = completeRun();
    const after = performRuntimeAction(
      definition,
      { ...state, currentNodeId: "fx-record-node" },
      { actionId: "fx-record", verb: "record" },
    );
    expect(lastMessage(after)).toMatch(/No measurement is available to record/i);
  });
});

describe("the zero is a state the later reads depend on", () => {
  it("records the blank identity and the wavelength it was taken at", () => {
    const definition = photometerChain({ seatedCuvetteId: "fx-blank-cuvette" });
    const state = zeroInstrument(definition, recordWavelength(definition, 630));
    const entry = state.notebook[state.notebook.length - 1];
    expect(entry.tags).toContain("instrument-blanked");
    expect(entry.tags).toContain("photometer-zero");
    expect(entry.value).toMatch(/Blank cuvette|630 nm|approved blank/i);
  });

  it("produces no measurement: a zero is not a reading", () => {
    const definition = photometerChain({ seatedCuvetteId: "fx-blank-cuvette" });
    const state = zeroInstrument(definition, recordWavelength(definition));
    expect(state.measurements.some((entry) => entry.id === "fx-percent-t")).toBe(false);
  });
});
