import { describe, expect, it } from "vitest";
import {
  format96WellCoordinate,
  isCanonical96WellCoordinate,
  move96WellCoordinate,
  parse96WellCoordinate,
  WELL_COORDINATES_96,
} from "../plate/coordinates";
import {
  create96WellPlateDefinition,
  create96WellPlateState,
  PlateInvariantError,
  updateWellState,
} from "../plate/state";
import {
  validatePlateDefinitionSchema,
  validatePlateRuntimeStateSchema,
  validateWellDefinitionSchema,
  validateWellStateSchema,
} from "../types/schema";
import {
  validatePlateDefinition,
  validatePlateRuntimeState,
} from "../types/validation";

describe("canonical 96-well coordinates", () => {
  it("generates every coordinate exactly once in row-major A1-top-left order", () => {
    expect(WELL_COORDINATES_96).toHaveLength(96);
    expect(new Set(WELL_COORDINATES_96).size).toBe(96);
    expect(WELL_COORDINATES_96.slice(0, 13)).toEqual([
      "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12", "B1",
    ]);
    expect(WELL_COORDINATES_96.at(-1)).toBe("H12");
  });

  it("parses, formats, and moves canonical coordinates without accepting aliases", () => {
    expect(parse96WellCoordinate("C7")).toEqual({ row: "C", rowIndex: 2, column: 7, columnIndex: 6 });
    expect(format96WellCoordinate("H", 12)).toBe("H12");
    expect(move96WellCoordinate("C7", -1, 2)).toBe("B9");
    expect(move96WellCoordinate("A1", -1, 0)).toBeNull();
    expect(move96WellCoordinate("H12", 0, 1)).toBeNull();
    for (const invalid of ["a1", "A0", "A01", "A13", "I1", " A1", "A1 ", ""]) {
      expect(isCanonical96WellCoordinate(invalid)).toBe(false);
      expect(parse96WellCoordinate(invalid)).toBeNull();
    }
  });
});

describe("96-well plate construction and immutable state", () => {
  const plate = create96WellPlateDefinition({
    id: "plate-test",
    maxWellVolume: { value: "0.3", unit: "mL" },
  });

  it("constructs a complete canonical definition and initial runtime state", () => {
    expect(validatePlateDefinitionSchema(plate).ok).toBe(true);
    expect(validatePlateDefinition(plate).ok).toBe(true);
    expect(validateWellDefinitionSchema(plate.wells[0]).ok).toBe(true);
    expect(plate.wells.map(({ coordinate }) => coordinate)).toEqual(WELL_COORDINATES_96);

    const state = create96WellPlateState(plate);
    expect(validatePlateRuntimeStateSchema(state).ok).toBe(true);
    expect(validatePlateRuntimeState(state).ok).toBe(true);
    expect(validateWellStateSchema(state.wells[0]).ok).toBe(true);
    expect(state.wells.every(({ status, volume }) => status === "empty" && volume.value === "0")).toBe(true);
  });

  it("updates one well without mutating source state or coordinate identity", () => {
    const source = create96WellPlateState(plate);
    const next = updateWellState(source, "A1", (well) => ({
      ...well,
      volume: { value: "200", unit: "uL" },
      status: "prepared",
    }));
    expect(source.wells[0].volume.value).toBe("0");
    expect(source.wells[0].status).toBe("empty");
    expect(next.wells[0].volume).toEqual({ value: "200", unit: "uL" });
    expect(next.wells[0].status).toBe("prepared");
    expect(next.wells[1]).toEqual(source.wells[1]);
    expect(next.wells).not.toBe(source.wells);

    expect(() => updateWellState(source, "A1", (well) => ({ ...well, coordinate: "A2" })))
      .toThrowError(PlateInvariantError);
  });

  it("rejects invalid coordinates, negative volumes, and capacity overflow", () => {
    const state = create96WellPlateState(plate);
    expect(() => updateWellState(state, "A0", (well) => ({ ...well }))).toThrowError(/Invalid 96-well coordinate/);
    expect(() => updateWellState(state, "A1", (well) => ({
      ...well,
      volume: { value: "-1", unit: "uL" },
      status: "prepared",
    }))).toThrowError(/cannot be negative/);
    expect(() => updateWellState(state, "A1", (well) => ({
      ...well,
      volume: { value: "301", unit: "uL" },
      status: "prepared",
    }))).toThrowError(/exceeds plate capacity/);
  });

  it("diagnoses duplicate/missing wells and definition/runtime capacity errors", () => {
    const duplicate = structuredClone(plate);
    duplicate.wells[95].coordinate = "A1";
    const duplicateResult = validatePlateDefinition(duplicate);
    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
        "assay.plate.coordinate.duplicate",
        "assay.plate.coordinate.missing",
      ]));
    }

    const overflow = structuredClone(plate);
    overflow.wells[0].expectedFinalVolume = { value: "301", unit: "uL" };
    const overflowResult = validatePlateDefinition(overflow);
    expect(overflowResult.ok).toBe(false);
    if (!overflowResult.ok) expect(overflowResult.diagnostics.some(({ code }) => code === "assay.plate.volume.capacity-exceeded")).toBe(true);

    const invalidState = create96WellPlateState(plate);
    invalidState.wells[0] = { ...invalidState.wells[0], volume: { value: "1", unit: "uL" } };
    const stateResult = validatePlateRuntimeState(invalidState);
    expect(stateResult.ok).toBe(false);
    if (!stateResult.ok) expect(stateResult.diagnostics.some(({ code }) => code === "assay.plate-state.empty.nonzero")).toBe(true);
  });
});

