import { canonicalSerializeJson } from "../../../platform/procedure-ir/canonical";
import {
  assayObservationImportSchemaId,
  assayObservationImportSchemaVersion,
  type AssayImportDiagnostic,
  type AssayLensBridgePort,
  type AssayLensImportContext,
  type AssayLensObservationPackage,
  type AssayLensObservationRequest,
  type AssayObservationImport,
} from "./types";
import { validateStructuredFileBoundary } from "./security";
import {
  validateAssayLensObservationPackage,
  validateAssayLensObservationRequest,
} from "./schema";

const parseJson = (contents: string): unknown => {
  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error(error instanceof Error
      ? `Invalid Assay Lens JSON: ${error.message}`
      : "Invalid Assay Lens JSON.");
  }
};

const validationError = (
  label: string,
  diagnostics: readonly { path: string; message: string }[],
): Error => new Error(
  `${label} is invalid:\n${diagnostics.map(({ path, message }) => `${path}: ${message}`).join("\n")}`,
);

export const serializeAssayLensObservationRequest = (
  request: AssayLensObservationRequest,
): string => {
  const validation = validateAssayLensObservationRequest(request);
  if (!validation.ok) throw validationError("Assay Lens request", validation.diagnostics);
  return canonicalSerializeJson(validation.value);
};

export const parseAssayLensObservationRequest = (
  contents: string,
): AssayLensObservationRequest => {
  const boundary = validateStructuredFileBoundary(
    new TextEncoder().encode(contents).byteLength,
    "application/json",
  );
  if (boundary.length > 0) {
    throw new Error(boundary.map(({ message }) => message).join(" "));
  }
  const validation = validateAssayLensObservationRequest(parseJson(contents));
  if (!validation.ok) throw validationError("Assay Lens request", validation.diagnostics);
  return structuredClone(validation.value);
};

export const serializeAssayLensObservationPackage = (
  packageValue: AssayLensObservationPackage,
): string => {
  const validation = validateAssayLensObservationPackage(packageValue);
  if (!validation.ok) throw validationError("Assay Lens observation package", validation.diagnostics);
  return canonicalSerializeJson(validation.value);
};

export const parseAssayLensObservationPackage = (
  contents: string,
): AssayLensObservationPackage => {
  const boundary = validateStructuredFileBoundary(
    new TextEncoder().encode(contents).byteLength,
    "application/json",
  );
  if (boundary.length > 0) {
    throw new Error(boundary.map(({ message }) => message).join(" "));
  }
  const validation = validateAssayLensObservationPackage(parseJson(contents));
  if (!validation.ok) throw validationError("Assay Lens observation package", validation.diagnostics);
  return structuredClone(validation.value);
};

export const importAssayLensObservationPackage = (
  contents: string,
  context: AssayLensImportContext,
): AssayObservationImport => {
  const packageValue = parseAssayLensObservationPackage(contents);
  const corrections = new Map(packageValue.manualCorrections.map((correction) => [
    correction.well,
    correction,
  ]));
  return {
    schema: assayObservationImportSchemaId,
    schemaVersion: assayObservationImportSchemaVersion,
    id: context.importId,
    sourceType: "image-derived",
    sourceName: "Assay Lens reviewed file bridge",
    sourceVersion: packageValue.analysis.methodVersion,
    mapping: {
      format: "assay-lens",
      orientation: "A1-top-left",
      plateId: context.plateId,
      unit: context.unit,
      ...(context.channel ? { channel: context.channel } : {}),
    },
    rows: packageValue.observations.map((observation, index) => {
      const upstreamCorrection = corrections.get(observation.well);
      const rawValue = upstreamCorrection?.acceptedValue ?? observation.rawSignal;
      const flags = [
        ...observation.flags,
        ...(upstreamCorrection ? ["assay-lens-manual-correction"] : []),
      ];
      return {
        rowNumber: index + 1,
        plateId: context.plateId,
        wellId: `${context.plateId}:${observation.well}`,
        rawValue,
        unit: context.unit,
        ...(context.channel ? { channel: context.channel } : {}),
        status: "mapped" as const,
        ...(observation.normalizedSignal
          ? { sourceNormalizedValue: observation.normalizedSignal }
          : {}),
        sourceFlags: flags,
        ...(upstreamCorrection ? {
          sourceCorrection: structuredClone(upstreamCorrection),
        } : {}),
        diagnostics: upstreamCorrection ? [{
          code: "assay.ingestion.upstream-correction",
          severity: "warning" as const,
          row: index + 1,
          message: `Assay Lens reports a reviewed upstream correction for ${observation.well}; Assay Studio review is still required.`,
        }] : [],
        observation: {
          id: `${context.importId}:${observation.well}`,
          plateId: context.plateId,
          wellId: `${context.plateId}:${observation.well}`,
          sourceType: "image-derived" as const,
          rawValue,
          unit: context.unit,
          ...(context.channel ? { channel: context.channel } : {}),
          ...(observation.confidence ? { confidence: observation.confidence } : {}),
          capturedAt: context.importedAt,
          provenance: {
            sourceId: context.importId,
            sourceVersion: packageValue.analysis.methodVersion,
            methodId: packageValue.analysis.methodId,
            methodVersion: packageValue.analysis.methodVersion,
            description: [
              context.sourceDescription,
              "Image-derived signal; not equivalent to absorbance or an instrument export.",
              flags.length > 0 ? `Flags: ${flags.join(", ")}.` : "",
              upstreamCorrection?.reason ? `Upstream correction reason: ${upstreamCorrection.reason}.` : "",
            ].filter(Boolean).join(" "),
          },
          reviewStatus: "unreviewed" as const,
        },
      };
    }),
    diagnostics: [{
      code: "assay.ingestion.image-review-required",
      severity: "warning",
      message: "Every image-derived observation remains unreviewed until explicitly accepted, corrected, or rejected in Assay Studio.",
    }],
    createdAt: context.importedAt,
  };
};

export const fileAssayLensBridge: AssayLensBridgePort = {
  mode: "file",
  exportRequest: serializeAssayLensObservationRequest,
  importPackage: importAssayLensObservationPackage,
};

export class DisabledAssayLensNetworkBridge implements AssayLensBridgePort {
  readonly mode = "network-disabled" as const;

  exportRequest(request: AssayLensObservationRequest): string {
    return serializeAssayLensObservationRequest(request);
  }

  importPackage(contents: string, context: AssayLensImportContext): AssayObservationImport {
    return importAssayLensObservationPackage(contents, context);
  }

  async send(): Promise<never> {
    throw new Error(
      "Assay Lens network transport is disabled: no authorized, contract-tested endpoint is configured. Use the file bridge.",
    );
  }
}

export const assayLensImportDiagnostics = (
  imported: AssayObservationImport,
): AssayImportDiagnostic[] => structuredClone(imported.diagnostics);
