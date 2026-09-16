import { compareDecimal, isNonNegativeDecimal, parseDecimal } from "../../../platform/planning/decimal";
import { convertQuantity, quantitiesAreCompatible } from "../../../platform/planning/units";
import type {
  AssayQuantity,
  PlateDefinition,
  PlateRuntimeState,
  WellDefinition,
  WellState,
} from "../types/types";
import {
  isCanonical96WellCoordinate,
  WELL_COLUMNS_96,
  WELL_COORDINATES_96,
  WELL_ROWS_96,
  type WellCoordinate96,
} from "./coordinates";

export type PlateInvariantCode =
  | "assay.plate.coordinate.invalid"
  | "assay.plate.coordinate.missing"
  | "assay.plate.coordinate.immutable"
  | "assay.plate.volume.invalid-unit"
  | "assay.plate.volume.negative"
  | "assay.plate.volume.capacity-exceeded";

export class PlateInvariantError extends Error {
  constructor(
    readonly code: PlateInvariantCode,
    message: string,
  ) {
    super(message);
    this.name = "PlateInvariantError";
  }
}

const volumeUnits = new Set(["uL", "mL", "L"]);

const assertVolumeQuantity = (quantity: AssayQuantity, path: string): void => {
  if (!volumeUnits.has(quantity.unit)) {
    throw new PlateInvariantError("assay.plate.volume.invalid-unit", `${path} must use uL, mL, or L.`);
  }
  let value;
  try {
    value = parseDecimal(quantity.value);
  } catch {
    throw new PlateInvariantError("assay.plate.volume.negative", `${path} must be a non-negative decimal string.`);
  }
  if (!isNonNegativeDecimal(value)) {
    throw new PlateInvariantError("assay.plate.volume.negative", `${path} cannot be negative.`);
  }
};

export const assertWellWithinCapacity = (
  well: WellState,
  capacity: AssayQuantity,
): void => {
  assertVolumeQuantity(capacity, "Plate capacity");
  assertVolumeQuantity(well.volume, `Well ${well.coordinate} volume`);
  if (!quantitiesAreCompatible(well.volume, capacity)) {
    throw new PlateInvariantError(
      "assay.plate.volume.invalid-unit",
      `Well ${well.coordinate} volume is not compatible with plate capacity.`,
    );
  }
  const normalizedWell = convertQuantity(well.volume, "uL");
  const normalizedCapacity = convertQuantity(capacity, "uL");
  if (compareDecimal(parseDecimal(normalizedWell.value), parseDecimal(normalizedCapacity.value)) > 0) {
    throw new PlateInvariantError(
      "assay.plate.volume.capacity-exceeded",
      `Well ${well.coordinate} volume ${well.volume.value} ${well.volume.unit} exceeds plate capacity ${capacity.value} ${capacity.unit}.`,
    );
  }
};

export interface Create96WellPlateDefinitionOptions {
  id: string;
  maxWellVolume?: AssayQuantity;
  recommendedWorkingVolume?: PlateDefinition["recommendedWorkingVolume"];
  wellFactory?: (coordinate: WellCoordinate96) => Partial<Omit<WellDefinition, "id" | "coordinate">>;
}

const createDefaultWell = (plateId: string, coordinate: WellCoordinate96): WellDefinition => ({
  id: `${plateId}:${coordinate}`,
  coordinate,
  role: "unused",
  conditionRefs: [],
  replicateGroupRefs: [],
  plannedComponents: [],
  expectedFinalVolume: { value: "0", unit: "uL" },
  labels: [],
});

export const create96WellPlateDefinition = (
  options: Create96WellPlateDefinitionOptions,
): PlateDefinition => {
  if (!options.id.trim()) throw new Error("Plate id must be a non-empty string.");
  const maxWellVolume = options.maxWellVolume ?? { value: "300", unit: "uL" };
  assertVolumeQuantity(maxWellVolume, "Plate capacity");
  const wells = WELL_COORDINATES_96.map((coordinate) => {
    const defaults = createDefaultWell(options.id, coordinate);
    const override = options.wellFactory?.(coordinate) ?? {};
    return {
      ...defaults,
      ...structuredClone(override),
      id: defaults.id,
      coordinate,
    };
  });
  return {
    id: options.id,
    format: 96,
    rowCount: WELL_ROWS_96.length,
    columnCount: WELL_COLUMNS_96.length,
    rowLabels: [...WELL_ROWS_96],
    columnLabels: WELL_COLUMNS_96.map(String),
    orientation: "A1-top-left",
    maxWellVolume: structuredClone(maxWellVolume),
    ...(options.recommendedWorkingVolume
      ? { recommendedWorkingVolume: structuredClone(options.recommendedWorkingVolume) }
      : {}),
    wells,
    regions: [],
  };
};

const createEmptyWellState = (coordinate: WellCoordinate96): WellState => ({
  coordinate,
  volume: { value: "0", unit: "uL" },
  components: [],
  mixed: false,
  contaminationTags: [],
  status: "empty",
  observations: [],
  warnings: [],
});

export const create96WellPlateState = (plate: PlateDefinition): PlateRuntimeState => {
  if (plate.format !== 96 || plate.orientation !== "A1-top-left") {
    throw new PlateInvariantError(
      "assay.plate.coordinate.invalid",
      "Cycle 06 runtime state supports only a 96-well plate in A1-top-left orientation.",
    );
  }
  assertVolumeQuantity(plate.maxWellVolume, "Plate capacity");
  return {
    plateId: plate.id,
    format: 96,
    orientation: "A1-top-left",
    maxWellVolume: structuredClone(plate.maxWellVolume),
    wells: WELL_COORDINATES_96.map(createEmptyWellState),
  };
};

export type WellStateUpdater = (current: Readonly<WellState>) => WellState;

export const updateWellState = (
  state: Readonly<PlateRuntimeState>,
  coordinate: string,
  updater: WellStateUpdater,
): PlateRuntimeState => {
  if (!isCanonical96WellCoordinate(coordinate)) {
    throw new PlateInvariantError("assay.plate.coordinate.invalid", `Invalid 96-well coordinate: ${coordinate}`);
  }
  const index = state.wells.findIndex((well) => well.coordinate === coordinate);
  if (index < 0) {
    throw new PlateInvariantError("assay.plate.coordinate.missing", `Plate state is missing well ${coordinate}.`);
  }
  const current = structuredClone(state.wells[index]);
  const next = structuredClone(updater(current));
  if (next.coordinate !== coordinate) {
    throw new PlateInvariantError(
      "assay.plate.coordinate.immutable",
      `Well coordinate cannot change from ${coordinate} to ${next.coordinate}.`,
    );
  }
  assertWellWithinCapacity(next, state.maxWellVolume);
  const wells = state.wells.map((well, wellIndex) =>
    wellIndex === index ? next : structuredClone(well));
  return {
    ...structuredClone(state),
    wells,
  };
};

