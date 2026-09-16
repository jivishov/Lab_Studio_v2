import type { AssayDefinition } from "../types";
import { validateAssayObservationSet } from "../qc";
import { validateAssayObservationImport } from "./schema";
import {
  assayObservationImportSchemaId,
  assayObservationImportSchemaVersion,
  type AssayImportDiagnostic,
  type AssayObservationCommitResult,
  type AssayObservationImport,
  type AssayObservationReview,
  type PlateObservation,
} from "./types";

const decimalPattern = /^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

const diagnostic = (
  code: string,
  message: string,
  row?: number,
): AssayImportDiagnostic => ({
  code,
  message,
  severity: "error",
  ...(row === undefined ? {} : { row }),
});

export const createObservationReview = (
  importCandidate: AssayObservationImport,
): AssayObservationReview => ({
  importCandidate: structuredClone(importCandidate),
  observations: importCandidate.rows.flatMap(({ observation }) =>
    observation ? [structuredClone(observation)] : []),
  manualCorrections: [],
});

export const reviewObservation = (
  review: AssayObservationReview,
  observationId: string,
  decision: "accepted" | "rejected" | "corrected",
  options?: {
    acceptedValue?: string;
    reason?: string;
    actorRole?: string;
    occurredAt?: string;
  },
): AssayObservationReview => {
  const observation = review.observations.find(({ id }) => id === observationId);
  if (!observation) throw new Error(`Unknown observation ${observationId}.`);
  const next = structuredClone(review);
  const nextObservation = next.observations.find(({ id }) => id === observationId)!;
  next.manualCorrections = next.manualCorrections.filter(
    ({ observationId: correctionObservationId }) => correctionObservationId !== observationId,
  );
  if (decision === "corrected") {
    const acceptedValue = options?.acceptedValue?.trim() ?? "";
    if (!decimalPattern.test(acceptedValue)) {
      throw new Error("Corrected observation value must be an explicit decimal string.");
    }
    const occurredAt = options?.occurredAt ?? new Date().toISOString();
    nextObservation.reviewStatus = "corrected";
    next.manualCorrections.push({
      id: `${observationId}:correction`,
      observationId,
      previousValue: nextObservation.rawValue,
      acceptedValue,
      ...(options?.reason?.trim() ? { reason: options.reason.trim() } : {}),
      actorRole: options?.actorRole?.trim() || "assay-reviewer",
      occurredAt,
      provenance: {
        sourceId: next.importCandidate.id,
        sourceVersion: next.importCandidate.sourceVersion,
        methodId: "assay-studio-explicit-review",
        methodVersion: "1.0",
        description: "Explicit manual correction made during Assay Studio import review.",
      },
    });
  } else {
    nextObservation.reviewStatus = decision;
  }
  return next;
};

export const acceptAllMappedObservations = (
  review: AssayObservationReview,
): AssayObservationReview => {
  const next = structuredClone(review);
  next.observations.forEach((observation) => {
    if (observation.reviewStatus === "unreviewed") observation.reviewStatus = "accepted";
  });
  return next;
};

export const createManualObservationImport = (input: {
  importId: string;
  plateId: string;
  coordinate: string;
  rawValue: string;
  unit: string;
  channel?: string;
  createdAt: string;
  sourceType?: "manual" | "image-derived";
  attachmentId?: string;
}): AssayObservationImport => {
  const coordinate = input.coordinate.trim().toUpperCase();
  const diagnostics: AssayImportDiagnostic[] = [];
  if (!/^[A-H](?:[1-9]|1[0-2])$/.test(coordinate)) diagnostics.push(diagnostic(
    "assay.ingestion.coordinate-invalid",
    `Coordinate ${coordinate || "(missing)"} is not valid for a canonical 96-well plate.`,
    1,
  ));
  if (!decimalPattern.test(input.rawValue.trim())) diagnostics.push(diagnostic(
    "assay.ingestion.signal-invalid",
    "Manual signal must be an explicit decimal string.",
    1,
  ));
  if (!input.unit.trim()) diagnostics.push(diagnostic(
    "assay.ingestion.unit-missing",
    "Manual signal unit is required.",
    1,
  ));
  const sourceType = input.sourceType ?? "manual";
  if (sourceType === "image-derived" && !input.attachmentId) diagnostics.push(diagnostic(
    "assay.ingestion.image-attachment-required",
    "Manual image extraction requires a validated transient image attachment id.",
    1,
  ));
  const observation: PlateObservation | undefined = diagnostics.length > 0 ? undefined : {
    id: `${input.importId}:${coordinate}`,
    plateId: input.plateId,
    wellId: `${input.plateId}:${coordinate}`,
    sourceType,
    rawValue: input.rawValue.trim(),
    unit: input.unit.trim(),
    ...(input.channel?.trim() ? { channel: input.channel.trim() } : {}),
    capturedAt: input.createdAt,
    provenance: {
      sourceId: input.attachmentId ?? input.importId,
      sourceVersion: "1.0",
      methodId: sourceType === "image-derived"
        ? "assay-studio-manual-image-review"
        : "assay-studio-manual-entry",
      methodVersion: "1.0",
      description: sourceType === "image-derived"
        ? "Manual scalar extraction from a transient local image; no built-in computer vision, path, EXIF, pixels, or absorbance equivalence is claimed."
        : "Manual scalar entry awaiting explicit review; no instrument or image method is claimed.",
    },
    reviewStatus: "unreviewed",
  };
  return {
    schema: assayObservationImportSchemaId,
    schemaVersion: assayObservationImportSchemaVersion,
    id: input.importId,
    sourceType,
    sourceName: sourceType === "image-derived"
      ? "Assay Studio manual image review"
      : "Assay Studio manual well entry",
    sourceVersion: "1.0",
    mapping: {
      format: "manual",
      orientation: "A1-top-left",
      plateId: input.plateId,
      unit: input.unit.trim(),
      ...(input.channel?.trim() ? { channel: input.channel.trim() } : {}),
    },
    rows: [{
      rowNumber: 1,
      ...(observation ? {
        plateId: input.plateId,
        wellId: observation.wellId,
        rawValue: observation.rawValue,
        unit: observation.unit,
        ...(observation.channel ? { channel: observation.channel } : {}),
        status: "mapped" as const,
        observation,
        ...(sourceType === "image-derived"
          ? { sourceFlags: ["manual-image-extraction", "no-built-in-cv"] }
          : {}),
      } : {
        status: "error" as const,
      }),
      diagnostics,
    }],
    diagnostics: [],
    createdAt: input.createdAt,
  };
};

export const commitObservationReview = (
  review: AssayObservationReview,
  assay: AssayDefinition,
): AssayObservationCommitResult => {
  const diagnostics: AssayImportDiagnostic[] = structuredClone(
    review.importCandidate.diagnostics,
  );
  const importValidation = validateAssayObservationImport(review.importCandidate);
  if (!importValidation.ok) diagnostics.push(...importValidation.diagnostics.map(
    ({ code, path, message }) => ({
      code,
      message: `${path}: ${message}`,
      severity: "error" as const,
    }),
  ));
  review.importCandidate.rows.forEach((row) => {
    if (row.status === "error") diagnostics.push(...row.diagnostics);
  });
  review.observations.forEach((observation) => {
    if (observation.reviewStatus === "unreviewed") diagnostics.push(diagnostic(
      "assay.ingestion.review-required",
      `Observation ${observation.id} must be accepted, corrected, or rejected before commit.`,
    ));
  });
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return { ok: false, diagnostics };
  }
  const observationSet = {
    schema: "assay-studio.observation-set" as const,
    schemaVersion: "1.0" as const,
    id: `${review.importCandidate.id}:reviewed`,
    plateId: assay.plate.id,
    orientation: "A1-top-left" as const,
    observations: structuredClone(review.observations),
    manualCorrections: structuredClone(review.manualCorrections),
  };
  const validation = validateAssayObservationSet(observationSet, assay);
  if (!validation.ok) return {
    ok: false,
    diagnostics: validation.diagnostics.map(({ code, message, path }) => ({
      code,
      message: `${path}: ${message}`,
      severity: "error",
    })),
  };
  return { ok: true, observationSet: validation.value, diagnostics: [] };
};
