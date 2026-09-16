import type { DecimalString } from "../../../platform/procedure-ir/types";
import {
  ASSAY_IMPORT_MAX_CELL_LENGTH,
  ASSAY_IMPORT_MAX_COLUMNS,
  ASSAY_IMPORT_MAX_BYTES,
  ASSAY_IMPORT_MAX_ROWS,
  assayObservationImportSchemaId,
  assayObservationImportSchemaVersion,
  type AssayCsvDelimiter,
  type AssayCsvMapping,
  type AssayDecimalSeparator,
  type AssayImportDiagnostic,
  type AssayObservationImport,
  type AssayObservationImportRow,
} from "./types";

const decimalPattern = /^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const coordinatePattern = /^[A-H](?:[1-9]|1[0-2])$/;

const diagnostic = (
  code: string,
  message: string,
  severity: AssayImportDiagnostic["severity"] = "error",
  row?: number,
  column?: string,
): AssayImportDiagnostic => ({
  code,
  message,
  severity,
  ...(row === undefined ? {} : { row }),
  ...(column === undefined ? {} : { column }),
});

const stablePart = (value: string): string =>
  value.trim().replace(/[^A-Za-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";

export const parseDelimitedRows = (
  text: string,
  delimiter: AssayCsvDelimiter,
): { rows: string[][]; diagnostics: AssayImportDiagnostic[] } => {
  const rows: string[][] = [];
  const diagnostics: AssayImportDiagnostic[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let rowNumber = 1;

  const pushCell = () => {
    if (cell.length > ASSAY_IMPORT_MAX_CELL_LENGTH) diagnostics.push(diagnostic(
      "assay.ingestion.cell-too-long",
      `Cell exceeds ${ASSAY_IMPORT_MAX_CELL_LENGTH} characters.`,
      "error",
      rowNumber,
      String(row.length + 1),
    ));
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.length > ASSAY_IMPORT_MAX_COLUMNS) diagnostics.push(diagnostic(
      "assay.ingestion.too-many-columns",
      `Row exceeds ${ASSAY_IMPORT_MAX_COLUMNS} columns.`,
      "error",
      rowNumber,
    ));
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
    rowNumber += 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === "\"") {
        if (text[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === "\"" && cell.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      pushCell();
    } else if (character === "\n") {
      pushRow();
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (quoted) diagnostics.push(diagnostic(
    "assay.ingestion.csv-unclosed-quote",
    "CSV input ends inside a quoted field.",
    "error",
    rowNumber,
  ));
  if (cell.length > 0 || row.length > 0) pushRow();
  if (rows.length > ASSAY_IMPORT_MAX_ROWS + 1) diagnostics.push(diagnostic(
    "assay.ingestion.too-many-rows",
    `CSV input exceeds ${ASSAY_IMPORT_MAX_ROWS} data rows.`,
  ));
  return { rows: rows.slice(0, ASSAY_IMPORT_MAX_ROWS + 1), diagnostics };
};

const normalizeDecimal = (
  value: string,
  separator: AssayDecimalSeparator,
): DecimalString | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (separator === "," && trimmed.includes(".")) return undefined;
  const normalized = separator === "," ? trimmed.replace(",", ".") : trimmed;
  if (!decimalPattern.test(normalized)) return undefined;
  return normalized as DecimalString;
};

const headerIndex = (
  headers: readonly string[],
  name: string | undefined,
): number | undefined => {
  if (!name) return undefined;
  const index = headers.indexOf(name);
  return index < 0 ? undefined : index;
};

const observationRow = (
  importId: string,
  sourceVersion: string,
  rowNumber: number,
  plateId: string,
  coordinate: string,
  rawValue: DecimalString,
  unit: string,
  channel?: string,
  capturedAt?: string,
): AssayObservationImportRow => {
  const well = coordinate.toUpperCase();
  const observationId = [
    stablePart(importId),
    stablePart(plateId),
    stablePart(channel ?? "default"),
    well,
    rowNumber,
  ].join(":");
  return {
    rowNumber,
    plateId,
    wellId: `${plateId}:${well}`,
    rawValue,
    unit,
    ...(channel ? { channel } : {}),
    ...(capturedAt ? { capturedAt } : {}),
    status: "mapped",
    diagnostics: [],
    observation: {
      id: observationId,
      plateId,
      wellId: `${plateId}:${well}`,
      sourceType: "instrument-export",
      rawValue,
      unit,
      ...(channel ? { channel } : {}),
      ...(capturedAt ? { capturedAt } : {}),
      provenance: {
        sourceId: importId,
        sourceVersion,
        methodId: "csv-field-mapping",
        methodVersion: "1.0",
        description: "Explicit reviewed CSV field mapping; no columns or scientific meaning were inferred.",
      },
      reviewStatus: "unreviewed",
    },
  };
};

const rowError = (
  rowNumber: number,
  diagnostics: AssayImportDiagnostic[],
): AssayObservationImportRow => ({
  rowNumber,
  status: diagnostics.some(({ severity }) => severity === "error") ? "error" : "unmapped",
  diagnostics,
});

const mapLongRows = (
  parsed: string[][],
  mapping: Extract<AssayCsvMapping, { format: "long" }>,
  importId: string,
  sourceVersion: string,
): { rows: AssayObservationImportRow[]; diagnostics: AssayImportDiagnostic[] } => {
  const diagnostics: AssayImportDiagnostic[] = [];
  const headers = parsed[0]?.map((header) => header.trim()) ?? [];
  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) diagnostics.push(diagnostic(
    "assay.ingestion.header-duplicate",
    `Duplicate header names: ${[...new Set(duplicateHeaders)].join(", ")}.`,
  ));
  const required: Array<[string, string]> = [
    ["well", mapping.wellColumn],
    ["signal", mapping.signalColumn],
  ];
  if (!mapping.defaultPlateId) required.push(["plate", mapping.plateIdColumn]);
  if (!mapping.defaultUnit) required.push(["unit", mapping.unitColumn ?? ""]);
  required.forEach(([label, name]) => {
    if (!name || !headers.includes(name)) diagnostics.push(diagnostic(
      "assay.ingestion.header-missing",
      `Mapped ${label} column ${name || "(not supplied)"} is absent.`,
      "error",
      1,
      name,
    ));
  });
  const get = (cells: readonly string[], column: string | undefined): string => {
    const index = headerIndex(headers, column);
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };
  const rows = parsed.slice(1).map((cells, index) => {
    const rowNumber = index + 2;
    const plateId = get(cells, mapping.plateIdColumn) || mapping.defaultPlateId || "";
    const coordinate = get(cells, mapping.wellColumn).toUpperCase();
    const rawText = get(cells, mapping.signalColumn);
    const rawValue = normalizeDecimal(rawText, mapping.decimalSeparator);
    const unit = get(cells, mapping.unitColumn) || mapping.defaultUnit || "";
    const channel = get(cells, mapping.channelColumn) || mapping.defaultChannel || undefined;
    const capturedAt = get(cells, mapping.capturedAtColumn) || undefined;
    const rowDiagnostics: AssayImportDiagnostic[] = [];
    if (!plateId) rowDiagnostics.push(diagnostic("assay.ingestion.plate-missing", "Plate id is required.", "error", rowNumber));
    if (!coordinatePattern.test(coordinate)) rowDiagnostics.push(diagnostic(
      "assay.ingestion.coordinate-invalid",
      `Coordinate ${coordinate || "(missing)"} is not valid for a canonical 96-well plate.`,
      "error",
      rowNumber,
      mapping.wellColumn,
    ));
    if (!rawValue) rowDiagnostics.push(diagnostic(
      "assay.ingestion.signal-invalid",
      `Signal ${rawText || "(missing)"} is not a decimal using the selected separator.`,
      "error",
      rowNumber,
      mapping.signalColumn,
    ));
    if (!unit) rowDiagnostics.push(diagnostic("assay.ingestion.unit-missing", "Signal unit is required.", "error", rowNumber));
    if (capturedAt && !Number.isFinite(Date.parse(capturedAt))) rowDiagnostics.push(diagnostic(
      "assay.ingestion.timestamp-invalid",
      "Captured-at value must be an ISO-8601 timestamp.",
      "error",
      rowNumber,
      mapping.capturedAtColumn,
    ));
    return rowDiagnostics.length > 0 || !rawValue
      ? rowError(rowNumber, rowDiagnostics)
      : observationRow(importId, sourceVersion, rowNumber, plateId, coordinate, rawValue, unit, channel, capturedAt);
  });
  return { rows, diagnostics };
};

const mapMatrixRows = (
  parsed: string[][],
  mapping: Extract<AssayCsvMapping, { format: "matrix" }>,
  importId: string,
  sourceVersion: string,
): { rows: AssayObservationImportRow[]; diagnostics: AssayImportDiagnostic[] } => {
  const diagnostics: AssayImportDiagnostic[] = [];
  const headers = parsed[0]?.map((header) => header.trim()) ?? [];
  const rowLabelIndex = headers.indexOf(mapping.rowLabelColumn);
  if (rowLabelIndex < 0) diagnostics.push(diagnostic(
    "assay.ingestion.matrix-row-label-missing",
    `Matrix row-label column ${mapping.rowLabelColumn} is absent.`,
    "error",
    1,
    mapping.rowLabelColumn,
  ));
  const columnIndexes = new Map<number, number>();
  headers.forEach((header, index) => {
    if (/^(?:[1-9]|1[0-2])$/.test(header)) columnIndexes.set(Number(header), index);
  });
  if (columnIndexes.size !== 12) diagnostics.push(diagnostic(
    "assay.ingestion.matrix-columns",
    "Matrix format requires explicit columns 1 through 12.",
    "error",
    1,
  ));
  const rows: AssayObservationImportRow[] = [];
  parsed.slice(1).forEach((cells, rowIndex) => {
    const sourceRow = rowIndex + 2;
    const rowLabel = rowLabelIndex < 0 ? "" : (cells[rowLabelIndex] ?? "").trim().toUpperCase();
    if (!/^[A-H]$/.test(rowLabel)) {
      rows.push(rowError(sourceRow, [diagnostic(
        "assay.ingestion.matrix-row-invalid",
        `Matrix row label ${rowLabel || "(missing)"} must be A through H.`,
        "error",
        sourceRow,
        mapping.rowLabelColumn,
      )]));
      return;
    }
    for (let column = 1; column <= 12; column += 1) {
      const index = columnIndexes.get(column);
      const rawText = index === undefined ? "" : (cells[index] ?? "").trim();
      if (!rawText) {
        rows.push(rowError(sourceRow, [diagnostic(
          "assay.ingestion.matrix-value-missing",
          `No signal is mapped for ${rowLabel}${column}.`,
          "warning",
          sourceRow,
          String(column),
        )]));
        continue;
      }
      const rawValue = normalizeDecimal(rawText, mapping.decimalSeparator);
      if (!rawValue) {
        rows.push(rowError(sourceRow, [diagnostic(
          "assay.ingestion.signal-invalid",
          `Signal ${rawText} is not a decimal using the selected separator.`,
          "error",
          sourceRow,
          String(column),
        )]));
        continue;
      }
      rows.push(observationRow(
        importId,
        sourceVersion,
        sourceRow,
        mapping.plateId,
        `${rowLabel}${column}`,
        rawValue,
        mapping.unit,
        mapping.channel,
      ));
    }
  });
  return { rows, diagnostics };
};

export const mapAssayCsv = (
  text: string,
  mapping: AssayCsvMapping,
  options: {
    importId: string;
    sourceName: string;
    sourceVersion: string;
    createdAt: string;
  },
): AssayObservationImport => {
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > ASSAY_IMPORT_MAX_BYTES) {
    return {
      schema: assayObservationImportSchemaId,
      schemaVersion: assayObservationImportSchemaVersion,
      id: options.importId,
      sourceType: "instrument-export",
      sourceName: options.sourceName,
      sourceVersion: options.sourceVersion,
      mapping: structuredClone(mapping),
      rows: [],
      diagnostics: [diagnostic(
        "assay.ingestion.file-size",
        `CSV input must be at most ${ASSAY_IMPORT_MAX_BYTES} bytes.`,
      )],
      createdAt: options.createdAt,
    };
  }
  const parsed = parseDelimitedRows(text.replace(/^\uFEFF/, ""), mapping.delimiter);
  const diagnostics = [...parsed.diagnostics];
  if (mapping.orientation !== "A1-top-left") diagnostics.push(diagnostic(
    "assay.ingestion.orientation-unsupported",
    "Cycle 10 accepts only explicit A1-top-left orientation.",
  ));
  if (mapping.decimalSeparator === "," && mapping.delimiter === ",") diagnostics.push(diagnostic(
    "assay.ingestion.separator-ambiguous",
    "Comma decimal input requires semicolon or tab field delimiters.",
  ));
  const mapped = mapping.format === "long"
    ? mapLongRows(parsed.rows, mapping, options.importId, options.sourceVersion)
    : mapMatrixRows(parsed.rows, mapping, options.importId, options.sourceVersion);
  diagnostics.push(...mapped.diagnostics);
  const unique = new Map<string, AssayObservationImportRow>();
  mapped.rows.forEach((row) => {
    const observation = row.observation;
    if (!observation) return;
    const key = `${observation.plateId}\u0000${observation.wellId}\u0000${observation.channel ?? ""}`;
    const previous = unique.get(key);
    if (previous) {
      const duplicate = diagnostic(
        "assay.ingestion.observation-duplicate",
        `Duplicate plate/well/channel observation also appears on row ${previous.rowNumber}.`,
        "error",
        row.rowNumber,
      );
      row.diagnostics.push(duplicate);
      row.status = "error";
      delete row.observation;
    } else {
      unique.set(key, row);
    }
  });
  return {
    schema: assayObservationImportSchemaId,
    schemaVersion: assayObservationImportSchemaVersion,
    id: options.importId,
    sourceType: "instrument-export",
    sourceName: options.sourceName,
    sourceVersion: options.sourceVersion,
    mapping: structuredClone(mapping),
    rows: mapped.rows,
    diagnostics,
    createdAt: options.createdAt,
  };
};
