import type { EvidenceRegistryFragment, EvidenceTypeDescriptorDocument } from "./types";
import { forbiddenEvidenceDataCategories } from "./security";

const stringId = { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" } as const;
const nonEmptyString = { type: "string", minLength: 1 } as const;
const stringSet = { type: "array", uniqueItems: true, items: stringId } as const;
const finiteNumber = { type: "number" } as const;

const payloadSchema = (
  id: string,
  required: string[],
  properties: Record<string, unknown>,
): Record<string, unknown> => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: `https://lab-studio.local/schemas/evidence/${id}/1.0.0`,
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

export const coreEvidencePayloadSchemas = {
  "action.completed": payloadSchema("action.completed", ["actionId", "verb", "nodeId", "success"], {
    actionId: stringId, verb: stringId, nodeId: stringId, success: { type: "boolean" },
  }),
  "state.transition": payloadSchema("state.transition", ["subjectRef", "field", "nextValue"], {
    subjectRef: stringId, field: stringId,
    previousValue: { type: ["string", "number", "boolean", "null"] },
    nextValue: { type: ["string", "number", "boolean", "null"] },
  }),
  "measurement.scalar": payloadSchema("measurement.scalar", ["measurementId", "value", "unit"], {
    measurementId: stringId, value: finiteNumber, unit: nonEmptyString, uncertainty: { type: "number", minimum: 0 },
  }),
  "measurement.series": payloadSchema("measurement.series", ["seriesId", "xUnit", "yUnit", "points"], {
    seriesId: stringId, xUnit: nonEmptyString, yUnit: nonEmptyString,
    points: {
      type: "array", minItems: 1, maxItems: 10000,
      items: {
        type: "object", additionalProperties: false, required: ["sequence", "x", "y"],
        properties: { sequence: { type: "integer", minimum: 1 }, x: finiteNumber, y: finiteNumber },
      },
    },
  }),
  "calculation.result": payloadSchema("calculation.result", ["calculationId", "value", "unit", "formula", "inputs", "validityLimits"], {
    calculationId: stringId, value: finiteNumber, unit: nonEmptyString, formula: nonEmptyString,
    inputs: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name", "value"],
        properties: { name: stringId, value: finiteNumber, unit: nonEmptyString },
      },
    },
    validityLimits: { type: "array", minItems: 1, uniqueItems: true, items: nonEmptyString },
  }),
  "observation.text": payloadSchema("observation.text", ["observationId", "text", "tags"], {
    observationId: stringId, text: { type: "string", minLength: 1, maxLength: 10000 }, tags: stringSet,
  }),
  "observation.image-derived": payloadSchema("observation.image-derived", ["observationId", "value", "unit", "methodId", "methodVersion", "reviewStatus"], {
    observationId: stringId, value: finiteNumber, unit: nonEmptyString, methodId: stringId,
    methodVersion: nonEmptyString, confidence: { type: "number", minimum: 0, maximum: 1 },
    reviewStatus: { enum: ["unreviewed", "accepted", "corrected", "rejected"] },
  }),
  "artifact.snapshot": payloadSchema("artifact.snapshot", ["artifactId", "artifactSchema", "schemaVersion", "artifactVersion"], {
    artifactId: stringId, artifactSchema: stringId, schemaVersion: nonEmptyString, artifactVersion: nonEmptyString,
  }),
  "artifact.validation": payloadSchema("artifact.validation", ["artifactId", "valid", "diagnosticCodes"], {
    artifactId: stringId, valid: { type: "boolean" }, diagnosticCodes: stringSet,
  }),
  "procedure.coverage": payloadSchema("procedure.coverage", ["procedureId", "classification", "capabilityRefs", "limitations"], {
    procedureId: stringId, classification: { enum: ["runnable", "representable", "unsupported"] },
    capabilityRefs: stringSet, limitations: { type: "array", uniqueItems: true, items: nonEmptyString },
  }),
  "run.plan": payloadSchema("run.plan", ["planId", "status", "requirementCount", "limitations"], {
    planId: stringId, status: { enum: ["ready", "review-required", "blocked"] },
    requirementCount: { type: "integer", minimum: 0 }, limitations: { type: "array", uniqueItems: true, items: nonEmptyString },
  }),
  "explanation.response": payloadSchema("explanation.response", ["promptId", "responseText"], {
    promptId: stringId, responseText: { type: "string", minLength: 1, maxLength: 50000 },
  }),
  "rubric.mapping": payloadSchema("rubric.mapping", ["criterionId", "evidenceRefs", "status"], {
    criterionId: stringId, evidenceRefs: stringSet, suggestedLevel: stringId,
    status: { enum: ["matched", "missing", "review-required"] },
  }),
} as const;

const commonRedaction = {
  strategy: "allowlist" as const,
  excludedDataCategories: [...forbiddenEvidenceDataCategories],
};

const descriptor = (
  id: keyof typeof coreEvidencePayloadSchemas,
  title: string,
  producerIds: string[],
  consumerIds: string[],
  accessibleRepresentation: EvidenceTypeDescriptorDocument["accessibleRepresentation"],
  retentionClass: EvidenceTypeDescriptorDocument["retentionClass"],
  sensitivity: EvidenceTypeDescriptorDocument["sensitivity"],
): EvidenceTypeDescriptorDocument => ({
  id,
  version: "1.0.0",
  domainPackId: "core",
  title,
  jsonSchema: coreEvidencePayloadSchemas[id],
  producerIds,
  consumerIds,
  accessibleRepresentation,
  retentionClass,
  sensitivity,
  redaction: { policyId: `core.${id}.allowlist-v1`, ...commonRedaction },
});

export const coreEvidenceRegistryFragment: EvidenceRegistryFragment = {
  schema: "studio.evidence-registry-fragment",
  schemaVersion: "1.0",
  domainPackId: "core",
  version: "1.0.0",
  entries: [
    descriptor("action.completed", "Completed action", ["chemistry.runtime", "assay.runtime"], ["studio.trace", "causalyst.rubric"], "text", "submission", "none"),
    descriptor("state.transition", "Validated state transition", ["chemistry.runtime", "assay.runtime"], ["studio.trace", "causalyst.rubric"], "table", "submission", "none"),
    descriptor("measurement.scalar", "Scalar measurement", ["chemistry.runtime", "assay.runtime"], ["studio.results", "causalyst.rubric"], "table", "submission", "none"),
    descriptor("measurement.series", "Measurement series", ["chemistry.runtime", "assay.runtime"], ["studio.results", "causalyst.rubric"], "chart+table", "submission", "none"),
    descriptor("calculation.result", "Deterministic calculation result", ["chemistry.runtime", "assay.runtime"], ["studio.results", "causalyst.rubric"], "table", "submission", "none"),
    descriptor("observation.text", "Text observation", ["studio.notebook"], ["studio.results", "causalyst.rubric"], "text", "submission", "user-authored"),
    descriptor("observation.image-derived", "Reviewed image-derived observation", ["assay.ingestion"], ["assay.analysis", "causalyst.rubric"], "table", "submission", "user-authored"),
    descriptor("artifact.snapshot", "Artifact identity snapshot", ["studio.artifacts"], ["studio.trace", "causalyst.review"], "artifact", "submission", "none"),
    descriptor("artifact.validation", "Artifact validation result", ["studio.validation"], ["studio.artifacts", "causalyst.rubric"], "text", "submission", "none"),
    descriptor("procedure.coverage", "Procedure coverage result", ["studio.capabilities"], ["studio.composer", "causalyst.authoring"], "table", "submission", "none"),
    descriptor("run.plan", "Run-plan summary", ["studio.planning"], ["studio.planning", "causalyst.review"], "table", "submission", "none"),
    descriptor("explanation.response", "Learner explanation response", ["causalyst.attempt"], ["causalyst.rubric", "causalyst.review"], "text", "submission", "user-authored"),
    descriptor("rubric.mapping", "Rubric evidence mapping", ["causalyst.rubric"], ["causalyst.review"], "table", "audit", "educational-record"),
  ],
};
