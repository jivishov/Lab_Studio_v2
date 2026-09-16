import { findForbiddenArtifactData } from "../../../platform/artifacts/security";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractDiagnostic,
  type ContractValidationResult,
} from "../../../platform/validation/jsonSchema";
import {
  ASSAY_IMAGE_MAX_BYTES,
  assayImageMimeTypes,
  assayLensBridgeSchemaVersion,
  assayLensObservationSchemaId,
  assayLensRequestSchemaId,
  assayObservationImportSchemaId,
  assayObservationImportSchemaVersion,
  type AssayObservationImport,
  type AssayLensObservationPackage,
  type AssayLensObservationRequest,
} from "./types";

const id = { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" } as const;
const nonEmpty = { type: "string", minLength: 1 } as const;
const decimal = { type: "string", pattern: "^[+-]?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;
const nonNegativeDecimal = { type: "string", pattern: "^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;
const timestampIsValid = (value: string): boolean =>
  value.includes("T") && Number.isFinite(Date.parse(value));
const point = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y"],
  properties: { x: { type: "number" }, y: { type: "number" } },
} as const;

const importMappingBase = {
  orientation: { const: "A1-top-left" },
} as const;

const importDiagnostic = {
  type: "object",
  additionalProperties: false,
  required: ["code", "severity", "message"],
  properties: {
    code: id,
    severity: { enum: ["error", "warning"] },
    row: { type: "integer", minimum: 1 },
    column: nonEmpty,
    message: nonEmpty,
  },
} as const;

const provenance = {
  type: "object",
  additionalProperties: false,
  required: ["sourceId", "sourceVersion", "methodId", "methodVersion", "description"],
  properties: {
    sourceId: id,
    sourceVersion: nonEmpty,
    methodId: id,
    methodVersion: nonEmpty,
    description: nonEmpty,
  },
} as const;

const plateObservation = {
  type: "object",
  additionalProperties: false,
  required: ["id", "plateId", "wellId", "sourceType", "rawValue", "unit", "provenance", "reviewStatus"],
  properties: {
    id,
    plateId: id,
    wellId: id,
    sourceType: { enum: ["instrument-export", "image-derived", "manual"] },
    rawValue: decimal,
    unit: nonEmpty,
    channel: nonEmpty,
    confidence: nonNegativeDecimal,
    capturedAt: nonEmpty,
    provenance,
    reviewStatus: { const: "unreviewed" },
  },
} as const;

export const assayObservationImportSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/assay-studio.observation-import/1.0",
  title: "Assay Studio Observation Import Candidate v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "id", "sourceType", "sourceName", "sourceVersion",
    "mapping", "rows", "diagnostics", "createdAt",
  ],
  properties: {
    schema: { const: assayObservationImportSchemaId },
    schemaVersion: { const: assayObservationImportSchemaVersion },
    id,
    sourceType: { enum: ["instrument-export", "manual", "image-derived"] },
    sourceName: nonEmpty,
    sourceVersion: nonEmpty,
    mapping: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: [
            "format", "delimiter", "decimalSeparator", "orientation",
            "plateIdColumn", "wellColumn", "signalColumn",
          ],
          properties: {
            ...importMappingBase,
            format: { const: "long" },
            delimiter: { enum: [",", ";", "\t"] },
            decimalSeparator: { enum: [".", ","] },
            plateIdColumn: nonEmpty,
            wellColumn: nonEmpty,
            signalColumn: nonEmpty,
            unitColumn: nonEmpty,
            channelColumn: nonEmpty,
            capturedAtColumn: nonEmpty,
            defaultPlateId: id,
            defaultUnit: nonEmpty,
            defaultChannel: nonEmpty,
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "format", "delimiter", "decimalSeparator", "orientation",
            "plateId", "unit", "rowLabelColumn",
          ],
          properties: {
            ...importMappingBase,
            format: { const: "matrix" },
            delimiter: { enum: [",", ";", "\t"] },
            decimalSeparator: { enum: [".", ","] },
            plateId: id,
            unit: nonEmpty,
            channel: nonEmpty,
            rowLabelColumn: nonEmpty,
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["format", "orientation", "plateId", "unit"],
          properties: {
            ...importMappingBase,
            format: { enum: ["manual", "assay-lens"] },
            plateId: id,
            unit: nonEmpty,
            channel: nonEmpty,
          },
        },
      ],
    },
    rows: {
      type: "array",
      maxItems: 10_000,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rowNumber", "status", "diagnostics"],
        properties: {
          rowNumber: { type: "integer", minimum: 1 },
          plateId: id,
          wellId: id,
          rawValue: decimal,
          unit: nonEmpty,
          channel: nonEmpty,
          capturedAt: nonEmpty,
          status: { enum: ["mapped", "unmapped", "error"] },
          observation: plateObservation,
          sourceNormalizedValue: decimal,
          sourceFlags: { type: "array", uniqueItems: true, items: nonEmpty },
          sourceCorrection: {
            type: "object",
            additionalProperties: false,
            required: ["acceptedValue"],
            properties: {
              previousValue: decimal,
              acceptedValue: decimal,
              reason: nonEmpty,
            },
          },
          diagnostics: { type: "array", items: importDiagnostic },
        },
      },
    },
    diagnostics: { type: "array", items: importDiagnostic },
    createdAt: nonEmpty,
  },
};

export const assayLensObservationRequestSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/assay-lens.observation-request/1.0",
  title: "Assay Lens Observation Request v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "requestId", "plate", "requestedChannels",
    "attachments", "createdAt", "limitations",
  ],
  properties: {
    schema: { const: assayLensRequestSchemaId },
    schemaVersion: { const: assayLensBridgeSchemaVersion },
    requestId: id,
    plate: {
      type: "object",
      additionalProperties: false,
      required: ["id", "format", "orientation"],
      properties: {
        id,
        format: { const: 96 },
        orientation: { const: "A1-top-left" },
      },
    },
    requestedChannels: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "unit"],
        properties: { id, unit: nonEmpty },
      },
    },
    attachments: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["attachmentId", "mimeType", "byteLength", "purpose"],
        properties: {
          attachmentId: id,
          mimeType: { enum: assayImageMimeTypes },
          byteLength: { type: "integer", minimum: 1, maximum: ASSAY_IMAGE_MAX_BYTES },
          purpose: { enum: ["manual-review", "assay-lens-analysis"] },
        },
      },
    },
    createdAt: nonEmpty,
    limitations: { type: "array", minItems: 1, uniqueItems: true, items: nonEmpty },
  },
};

export const assayLensObservationPackageSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/assay-lens.observation-package/1.0",
  title: "Assay Lens Observation Package v1",
  type: "object",
  additionalProperties: false,
  required: ["schema", "schemaVersion", "plate", "observations", "analysis", "manualCorrections"],
  properties: {
    schema: { const: assayLensObservationSchemaId },
    schemaVersion: { const: assayLensBridgeSchemaVersion },
    plate: {
      type: "object",
      additionalProperties: false,
      required: ["format", "orientation"],
      properties: {
        format: { const: 96 },
        orientation: { const: "A1-top-left" },
        detectedCorners: { type: "array", minItems: 4, maxItems: 4, items: point },
      },
    },
    observations: {
      type: "array",
      minItems: 1,
      maxItems: 96,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["well", "rawSignal", "flags"],
        properties: {
          well: { type: "string", pattern: "^[A-H](?:[1-9]|1[0-2])$" },
          rawSignal: decimal,
          normalizedSignal: decimal,
          confidence: nonNegativeDecimal,
          roi: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "width", "height"],
            properties: {
              x: { type: "number", minimum: 0 },
              y: { type: "number", minimum: 0 },
              width: { type: "number", exclusiveMinimum: 0 },
              height: { type: "number", exclusiveMinimum: 0 },
            },
          },
          flags: { type: "array", uniqueItems: true, items: nonEmpty },
        },
      },
    },
    analysis: {
      type: "object",
      additionalProperties: false,
      required: ["methodId", "methodVersion", "settings"],
      properties: {
        methodId: id,
        methodVersion: nonEmpty,
        settings: {
          type: "object",
          additionalProperties: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
            ],
          },
        },
      },
    },
    manualCorrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["well", "acceptedValue"],
        properties: {
          well: { type: "string", pattern: "^[A-H](?:[1-9]|1[0-2])$" },
          previousValue: decimal,
          acceptedValue: decimal,
          reason: nonEmpty,
        },
      },
    },
  },
};

const requestValidator = compileJsonSchemaValidator<AssayLensObservationRequest>(
  assayLensObservationRequestSchema,
);
const packageValidator = compileJsonSchemaValidator<AssayLensObservationPackage>(
  assayLensObservationPackageSchema,
);
const importValidator = compileJsonSchemaValidator<AssayObservationImport>(
  assayObservationImportSchema,
);

const secure = <T>(
  value: T,
  schemaResult: ContractValidationResult<T>,
): ContractValidationResult<T> => {
  if (!schemaResult.ok) return schemaResult;
  const diagnostics = findForbiddenArtifactData(value);
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : schemaResult;
};

export const validateAssayLensObservationRequest = (
  input: unknown,
): ContractValidationResult<AssayLensObservationRequest> => {
  const schemaResult = validateWithJsonSchema(requestValidator, input);
  if (!schemaResult.ok) return schemaResult;
  const duplicateChannels = schemaResult.value.requestedChannels
    .map(({ id: channelId }) => channelId)
    .filter((channelId, index, values) => values.indexOf(channelId) !== index);
  const duplicateAttachments = schemaResult.value.attachments
    .map(({ attachmentId }) => attachmentId)
    .filter((attachmentId, index, values) => values.indexOf(attachmentId) !== index);
  const diagnostics: ContractDiagnostic[] = [
    ...findForbiddenArtifactData(schemaResult.value),
    ...[...new Set(duplicateChannels)].map((channelId): ContractDiagnostic => ({
      code: "assay-lens.request.channel-duplicate",
      path: "/requestedChannels",
      message: `Duplicate requested channel ${channelId}.`,
      severity: "error",
    })),
    ...[...new Set(duplicateAttachments)].map((attachmentId): ContractDiagnostic => ({
      code: "assay-lens.request.attachment-duplicate",
      path: "/attachments",
      message: `Duplicate attachment id ${attachmentId}.`,
      severity: "error",
    })),
  ];
  if (!timestampIsValid(schemaResult.value.createdAt)) diagnostics.push({
    code: "assay-lens.request.created-at-invalid",
    path: "/createdAt",
    message: "createdAt must be an ISO-8601 timestamp.",
    severity: "error",
  });
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : schemaResult;
};

export const validateAssayObservationImport = (
  input: unknown,
): ContractValidationResult<AssayObservationImport> => {
  const schemaResult = validateWithJsonSchema(importValidator, input);
  if (!schemaResult.ok) return schemaResult;
  const imported = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [...findForbiddenArtifactData(imported)];
  if (!timestampIsValid(imported.createdAt)) diagnostics.push({
    code: "assay.ingestion.created-at-invalid",
    path: "/createdAt",
    message: "createdAt must be an ISO-8601 timestamp.",
    severity: "error",
  });
  const observationIds = new Set<string>();
  imported.rows.forEach((row, index) => {
    if (row.status === "mapped" && !row.observation) diagnostics.push({
      code: "assay.ingestion.mapped-observation-missing",
      path: `/rows/${index}/observation`,
      message: "A mapped row requires an unreviewed observation candidate.",
      severity: "error",
    });
    if (row.status !== "mapped" && row.observation) diagnostics.push({
      code: "assay.ingestion.unmapped-observation-present",
      path: `/rows/${index}/observation`,
      message: "Only mapped rows may carry an observation candidate.",
      severity: "error",
    });
    if (row.observation) {
      if (
        row.observation.confidence !== undefined
        && (Number(row.observation.confidence) < 0 || Number(row.observation.confidence) > 1)
      ) {
        diagnostics.push({
          code: "assay.ingestion.confidence-range",
          path: `/rows/${index}/observation/confidence`,
          message: "Confidence must be between 0 and 1.",
          severity: "error",
        });
      }
      if (row.observation.capturedAt && !timestampIsValid(row.observation.capturedAt)) {
        diagnostics.push({
          code: "assay.ingestion.captured-at-invalid",
          path: `/rows/${index}/observation/capturedAt`,
          message: "capturedAt must be an ISO-8601 timestamp.",
          severity: "error",
        });
      }
      if (observationIds.has(row.observation.id)) diagnostics.push({
        code: "assay.ingestion.observation-id-duplicate",
        path: `/rows/${index}/observation/id`,
        message: `Duplicate observation id ${row.observation.id}.`,
        severity: "error",
      });
      observationIds.add(row.observation.id);
      if (row.plateId !== row.observation.plateId || row.wellId !== row.observation.wellId) diagnostics.push({
        code: "assay.ingestion.row-observation-mismatch",
        path: `/rows/${index}/observation`,
        message: "Mapped row plate/well fields must match the observation candidate.",
        severity: "error",
      });
    }
  });
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : schemaResult;
};

export const validateAssayLensObservationPackage = (
  input: unknown,
): ContractValidationResult<AssayLensObservationPackage> => {
  const schemaResult = validateWithJsonSchema(packageValidator, input);
  if (!schemaResult.ok) return schemaResult;
  const packageValue = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [...findForbiddenArtifactData(packageValue)];
  const wells = packageValue.observations.map(({ well }) => well);
  wells.forEach((well, index) => {
    if (wells.indexOf(well) !== index) diagnostics.push({
      code: "assay-lens.observation.well-duplicate",
      path: `/observations/${index}/well`,
      message: `Duplicate Assay Lens observation for ${well}.`,
      severity: "error",
    });
  });
  packageValue.observations.forEach((observation, index) => {
    if (observation.confidence !== undefined) {
      const confidence = Number(observation.confidence);
      if (confidence < 0 || confidence > 1) diagnostics.push({
        code: "assay-lens.observation.confidence-range",
        path: `/observations/${index}/confidence`,
        message: "Confidence must be between 0 and 1.",
        severity: "error",
      });
    }
  });
  const observationWells = new Set(wells);
  const observationsByWell = new Map(
    packageValue.observations.map((observation) => [observation.well, observation]),
  );
  const correctionWells = packageValue.manualCorrections.map(({ well }) => well);
  correctionWells.forEach((well, index) => {
    if (!observationWells.has(well)) diagnostics.push({
      code: "assay-lens.correction.observation-missing",
      path: `/manualCorrections/${index}/well`,
      message: `Correction references missing observation well ${well}.`,
      severity: "error",
    });
    const observation = observationsByWell.get(well);
    if (observation && observation.rawSignal !== packageValue.manualCorrections[index].acceptedValue) {
      diagnostics.push({
        code: "assay-lens.correction.accepted-value-mismatch",
        path: `/manualCorrections/${index}/acceptedValue`,
        message: `Correction acceptedValue must match the packaged rawSignal for ${well}.`,
        severity: "error",
      });
    }
    if (correctionWells.indexOf(well) !== index) diagnostics.push({
      code: "assay-lens.correction.well-duplicate",
      path: `/manualCorrections/${index}/well`,
      message: `Duplicate Assay Lens correction for ${well}.`,
      severity: "error",
    });
  });
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : secure(packageValue, schemaResult);
};
