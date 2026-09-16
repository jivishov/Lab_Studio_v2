import type { DecimalString } from "../../../platform/procedure-ir/types";
import type {
  AssayManualCorrection,
  AssayObservationProvenance,
  AssayObservationSet,
  PlateObservation,
} from "../qc";

export const assayObservationImportSchemaId = "assay-studio.observation-import" as const;
export const assayObservationImportSchemaVersion = "1.0" as const;
export const assayLensRequestSchemaId = "assay-lens.observation-request" as const;
export const assayLensObservationSchemaId = "assay-lens.observation-package" as const;
export const assayLensBridgeSchemaVersion = "1.0" as const;

export const ASSAY_IMPORT_MAX_BYTES = 1_048_576;
export const ASSAY_IMAGE_MAX_BYTES = 12_582_912;
export const ASSAY_IMPORT_MAX_ROWS = 10_000;
export const ASSAY_IMPORT_MAX_COLUMNS = 512;
export const ASSAY_IMPORT_MAX_CELL_LENGTH = 4_096;

export const assayCsvMimeTypes = [
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
] as const;

export const assayImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const assayJsonMimeTypes = [
  "application/json",
  "text/json",
  "text/plain",
] as const;

export type AssayCsvFormat = "long" | "matrix";
export type AssayCsvDelimiter = "," | ";" | "\t";
export type AssayDecimalSeparator = "." | ",";

export interface AssayLongCsvMapping {
  format: "long";
  delimiter: AssayCsvDelimiter;
  decimalSeparator: AssayDecimalSeparator;
  orientation: "A1-top-left";
  plateIdColumn: string;
  wellColumn: string;
  signalColumn: string;
  unitColumn?: string;
  channelColumn?: string;
  capturedAtColumn?: string;
  defaultPlateId?: string;
  defaultUnit?: string;
  defaultChannel?: string;
}

export interface AssayMatrixCsvMapping {
  format: "matrix";
  delimiter: AssayCsvDelimiter;
  decimalSeparator: AssayDecimalSeparator;
  orientation: "A1-top-left";
  plateId: string;
  unit: string;
  channel?: string;
  rowLabelColumn: string;
}

export type AssayCsvMapping = AssayLongCsvMapping | AssayMatrixCsvMapping;

export interface AssayImportDiagnostic {
  code: string;
  severity: "error" | "warning";
  row?: number;
  column?: string;
  message: string;
}

export interface AssayObservationImportRow {
  rowNumber: number;
  plateId?: string;
  wellId?: string;
  rawValue?: DecimalString;
  unit?: string;
  channel?: string;
  capturedAt?: string;
  status: "mapped" | "unmapped" | "error";
  observation?: PlateObservation;
  sourceNormalizedValue?: DecimalString;
  sourceFlags?: string[];
  sourceCorrection?: {
    previousValue?: DecimalString;
    acceptedValue: DecimalString;
    reason?: string;
  };
  diagnostics: AssayImportDiagnostic[];
}

export interface AssayObservationImport {
  schema: typeof assayObservationImportSchemaId;
  schemaVersion: typeof assayObservationImportSchemaVersion;
  id: string;
  sourceType: "instrument-export" | "manual" | "image-derived";
  sourceName: string;
  sourceVersion: string;
  mapping: AssayCsvMapping | {
    format: "manual" | "assay-lens";
    orientation: "A1-top-left";
    plateId: string;
    unit: string;
    channel?: string;
  };
  rows: AssayObservationImportRow[];
  diagnostics: AssayImportDiagnostic[];
  createdAt: string;
}

export interface AssayObservationReview {
  importCandidate: AssayObservationImport;
  observations: PlateObservation[];
  manualCorrections: AssayManualCorrection[];
}

export interface AssayObservationCommitResult {
  ok: boolean;
  observationSet?: AssayObservationSet;
  diagnostics: AssayImportDiagnostic[];
}

export interface AssayImageAttachmentDescriptor {
  attachmentId: string;
  mimeType: typeof assayImageMimeTypes[number];
  byteLength: number;
  purpose: "manual-review" | "assay-lens-analysis";
}

export interface AssayLensObservationRequest {
  schema: typeof assayLensRequestSchemaId;
  schemaVersion: typeof assayLensBridgeSchemaVersion;
  requestId: string;
  plate: {
    id: string;
    format: 96;
    orientation: "A1-top-left";
  };
  requestedChannels: Array<{
    id: string;
    unit: string;
  }>;
  attachments: AssayImageAttachmentDescriptor[];
  createdAt: string;
  limitations: string[];
}

export interface AssayLensObservationPackage {
  schema: typeof assayLensObservationSchemaId;
  schemaVersion: typeof assayLensBridgeSchemaVersion;
  plate: {
    format: 96;
    orientation: "A1-top-left";
    detectedCorners?: Array<{ x: number; y: number }>;
  };
  observations: Array<{
    well: string;
    rawSignal: DecimalString;
    normalizedSignal?: DecimalString;
    confidence?: DecimalString;
    roi?: { x: number; y: number; width: number; height: number };
    flags: string[];
  }>;
  analysis: {
    methodId: string;
    methodVersion: string;
    settings: Record<string, string | number | boolean>;
  };
  manualCorrections: Array<{
    well: string;
    previousValue?: DecimalString;
    acceptedValue: DecimalString;
    reason?: string;
  }>;
}

export interface AssayLensImportContext {
  importId: string;
  plateId: string;
  channel?: string;
  unit: string;
  importedAt: string;
  sourceDescription: string;
}

export interface AssayLensBridgePort {
  readonly mode: "file" | "network-disabled";
  exportRequest(request: AssayLensObservationRequest): string;
  importPackage(
    contents: string,
    context: AssayLensImportContext,
  ): AssayObservationImport;
}

export interface AssayIngestedObservationEvidencePayload {
  observationId: string;
  plateId: string;
  wellId: string;
  sourceType: PlateObservation["sourceType"];
  value: DecimalString;
  unit: string;
  channel?: string;
  confidence?: DecimalString;
  sourceNormalizedValue?: DecimalString;
  reviewStatus: PlateObservation["reviewStatus"];
  methodId: string;
  methodVersion: string;
  sourceId: string;
  sourceVersion: string;
  flags: string[];
  correctionRef?: string;
  upstreamCorrection?: {
    previousValue?: DecimalString;
    acceptedValue: DecimalString;
    reason?: string;
  };
}

export type { AssayManualCorrection, AssayObservationProvenance, AssayObservationSet, PlateObservation };
