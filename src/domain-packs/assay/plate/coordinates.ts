import type { PlateFormat } from "../types/types";

export const WELL_ROWS_96 = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const WELL_COLUMNS_96 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type WellRow96 = (typeof WELL_ROWS_96)[number];
export type WellColumn96 = (typeof WELL_COLUMNS_96)[number];
export type WellCoordinate96 = `${WellRow96}${WellColumn96}`;

export interface WellCoordinateParts96 {
  row: WellRow96;
  rowIndex: number;
  column: WellColumn96;
  columnIndex: number;
}

export const WELL_COORDINATES_96: readonly WellCoordinate96[] = Object.freeze(
  WELL_ROWS_96.flatMap((row) => WELL_COLUMNS_96.map((column) => `${row}${column}` as WellCoordinate96)),
);

const coordinateSet96 = new Set<string>(WELL_COORDINATES_96);

export const isCanonical96WellCoordinate = (value: unknown): value is WellCoordinate96 =>
  typeof value === "string" && coordinateSet96.has(value);

export const parse96WellCoordinate = (coordinate: string): WellCoordinateParts96 | null => {
  if (!isCanonical96WellCoordinate(coordinate)) return null;
  const row = coordinate[0] as WellRow96;
  const column = Number(coordinate.slice(1)) as WellColumn96;
  return {
    row,
    rowIndex: WELL_ROWS_96.indexOf(row),
    column,
    columnIndex: WELL_COLUMNS_96.indexOf(column),
  };
};

export const format96WellCoordinate = (row: WellRow96, column: WellColumn96): WellCoordinate96 => {
  const coordinate = `${row}${column}`;
  if (!isCanonical96WellCoordinate(coordinate)) throw new Error(`Invalid 96-well coordinate: ${coordinate}`);
  return coordinate;
};

export const move96WellCoordinate = (
  coordinate: string,
  rowDelta: number,
  columnDelta: number,
): WellCoordinate96 | null => {
  if (!Number.isInteger(rowDelta) || !Number.isInteger(columnDelta)) return null;
  const parsed = parse96WellCoordinate(coordinate);
  if (!parsed) return null;
  const row = WELL_ROWS_96[parsed.rowIndex + rowDelta];
  const column = WELL_COLUMNS_96[parsed.columnIndex + columnDelta];
  return row && column ? format96WellCoordinate(row, column) : null;
};

interface PlateDimensions {
  rows: readonly string[];
  columns: readonly number[];
}

const allRowLabels = "ABCDEFGHIJKLMNOP".split("");
const dimensionsByFormat: Record<PlateFormat, readonly [number, number]> = {
  6: [2, 3],
  12: [3, 4],
  24: [4, 6],
  48: [6, 8],
  96: [8, 12],
  384: [16, 24],
};

export const getCanonicalPlateDimensions = (format: PlateFormat): PlateDimensions => {
  const [rowCount, columnCount] = dimensionsByFormat[format];
  return {
    rows: allRowLabels.slice(0, rowCount),
    columns: Array.from({ length: columnCount }, (_, index) => index + 1),
  };
};

export const getCanonicalPlateCoordinates = (format: PlateFormat): string[] => {
  const { rows, columns } = getCanonicalPlateDimensions(format);
  return rows.flatMap((row) => columns.map((column) => `${row}${column}`));
};

