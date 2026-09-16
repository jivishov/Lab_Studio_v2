import type { EvidenceTypeDescriptorDocument } from "../../../platform/evidence";
import { forbiddenEvidenceDataCategories } from "../../../platform/evidence/security";
import type {
  AssayIngestedObservationEvidencePayload,
  AssayObservationImport,
  AssayObservationReview,
} from "./types";

export const ASSAY_INGESTED_OBSERVATION_EVIDENCE = "assay.ingested-observation" as const;
export const ASSAY_INGESTED_OBSERVATION_EVIDENCE_VERSION = "1.0.0" as const;

const id = { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" } as const;
const nonEmpty = { type: "string", minLength: 1 } as const;
const decimal = { type: "string", pattern: "^[+-]?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;

export const assayIngestedObservationEvidenceDescriptor: EvidenceTypeDescriptorDocument = {
  id: ASSAY_INGESTED_OBSERVATION_EVIDENCE,
  version: ASSAY_INGESTED_OBSERVATION_EVIDENCE_VERSION,
  domainPackId: "assay",
  title: "Reviewed external assay observation",
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "observationId", "plateId", "wellId", "sourceType", "value", "unit",
      "reviewStatus", "methodId", "methodVersion", "sourceId", "sourceVersion", "flags",
    ],
    properties: {
      observationId: id,
      plateId: id,
      wellId: id,
      sourceType: { enum: ["instrument-export", "image-derived", "manual"] },
      value: decimal,
      unit: nonEmpty,
      channel: nonEmpty,
      confidence: { type: "string", pattern: "^(?:0(?:\\.[0-9]+)?|1(?:\\.0+)?)$" },
      sourceNormalizedValue: decimal,
      reviewStatus: { enum: ["accepted", "corrected", "rejected"] },
      methodId: id,
      methodVersion: nonEmpty,
      sourceId: id,
      sourceVersion: nonEmpty,
      flags: { type: "array", uniqueItems: true, items: nonEmpty },
      correctionRef: id,
      upstreamCorrection: {
        type: "object",
        additionalProperties: false,
        required: ["acceptedValue"],
        properties: {
          previousValue: decimal,
          acceptedValue: decimal,
          reason: nonEmpty,
        },
      },
    },
  },
  producerIds: ["assay.ingestion.review"],
  consumerIds: ["assay.qc.engine", "assay.results", "causalyst.rubric"],
  accessibleRepresentation: "table",
  retentionClass: "submission",
  sensitivity: "none",
  redaction: {
    policyId: "assay.ingested-observation.allowlist.v1",
    strategy: "allowlist",
    excludedDataCategories: [...forbiddenEvidenceDataCategories],
  },
};

const flagsForObservation = (
  imported: AssayObservationImport,
  observationId: string,
): string[] => {
  const row = imported.rows.find(({ observation }) => observation?.id === observationId);
  return [...new Set([
    ...(row?.sourceFlags ?? []),
    ...(row?.diagnostics.map(({ code }) => code) ?? []),
  ])].sort();
};

export const projectIngestedObservationEvidence = (
  review: AssayObservationReview,
): AssayIngestedObservationEvidencePayload[] => review.observations
  .filter(({ reviewStatus }) => reviewStatus !== "unreviewed")
  .map((observation) => {
    const correction = review.manualCorrections.find(
      ({ observationId }) => observationId === observation.id,
    );
    const sourceRow = review.importCandidate.rows.find(
      ({ observation: candidate }) => candidate?.id === observation.id,
    );
    return {
      observationId: observation.id,
      plateId: observation.plateId,
      wellId: observation.wellId,
      sourceType: observation.sourceType as "instrument-export" | "image-derived" | "manual",
      value: correction?.acceptedValue ?? observation.rawValue,
      unit: observation.unit,
      ...(observation.channel ? { channel: observation.channel } : {}),
      ...(observation.confidence ? { confidence: observation.confidence } : {}),
      ...(sourceRow?.sourceNormalizedValue
        ? { sourceNormalizedValue: sourceRow.sourceNormalizedValue }
        : {}),
      reviewStatus: observation.reviewStatus as "accepted" | "corrected" | "rejected",
      methodId: observation.provenance.methodId,
      methodVersion: observation.provenance.methodVersion,
      sourceId: observation.provenance.sourceId,
      sourceVersion: observation.provenance.sourceVersion,
      flags: flagsForObservation(review.importCandidate, observation.id),
      ...(correction ? { correctionRef: correction.id } : {}),
      ...(sourceRow?.sourceCorrection
        ? { upstreamCorrection: structuredClone(sourceRow.sourceCorrection) }
        : {}),
    };
  });
