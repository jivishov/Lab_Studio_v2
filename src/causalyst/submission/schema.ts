import {
  compileJsonSchemaValidator,
  schemaErrorsToDiagnostics,
  type ContractValidationResult,
} from "../../platform/validation/jsonSchema";
import type { CausalystSubmission } from "./types";

const nonEmpty = { type: "string", minLength: 1 } as const;
const versionedRef = {
  type: "object",
  additionalProperties: false,
  required: ["id", "version"],
  properties: { id: nonEmpty, version: nonEmpty },
} as const;

export const causalystSubmissionJsonSchema = {
  $id: "https://lab-studio.local/schemas/causalyst.submission/1.0",
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "submissionId", "assessmentRef", "attemptNumber",
    "submittedAt", "artifactSnapshots", "runTraces", "evidenceBundle", "explanations",
    "usedCapabilityRefs", "rubricEvaluation", "integrity", "teacherApproval",
  ],
  properties: {
    schema: { const: "causalyst.submission" },
    schemaVersion: { const: "1.0" },
    submissionId: nonEmpty,
    assessmentRef: versionedRef,
    attemptNumber: { type: "integer", minimum: 1 },
    submittedAt: nonEmpty,
    artifactSnapshots: { type: "array", minItems: 1, items: { type: "object" } },
    procedureIRCandidates: { type: "array", items: { type: "object" } },
    runTraces: { type: "array", minItems: 1, items: { type: "object" } },
    evidenceBundle: { type: "object" },
    explanations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["promptId", "responseText", "submittedAt"],
        properties: { promptId: nonEmpty, responseText: nonEmpty, submittedAt: nonEmpty },
      },
    },
    promptRevisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["revisionNumber", "createdAt", "source", "diagnosticCodes"],
        properties: {
          revisionNumber: { type: "integer", minimum: 1 },
          createdAt: nonEmpty,
          promptText: nonEmpty,
          source: { enum: ["prompt", "manual"] },
          procedureRef: versionedRef,
          artifactRef: versionedRef,
          diagnosticCodes: { type: "array", uniqueItems: true, items: nonEmpty },
          learnerChangeReason: nonEmpty,
        },
      },
    },
    usedCapabilityRefs: { type: "array", items: { type: "object" } },
    rubricEvaluation: { type: "object" },
    integrity: {
      type: "object",
      additionalProperties: false,
      required: [
        "status", "assessmentVersion", "domainPackVersion", "capabilityManifestSchemaVersion",
        "evidenceRegistryVersion", "artifactRefs", "evidenceTypeRefs", "checkCodes",
      ],
      properties: {
        status: { enum: ["valid", "invalid"] },
        assessmentVersion: nonEmpty,
        domainPackVersion: nonEmpty,
        capabilityManifestSchemaVersion: { const: "2.0" },
        evidenceRegistryVersion: nonEmpty,
        artifactRefs: { type: "array", minItems: 1, items: versionedRef },
        evidenceTypeRefs: { type: "array", items: versionedRef },
        checkCodes: { type: "array", uniqueItems: true, items: nonEmpty },
      },
    },
    teacherApproval: {
      type: "object",
      additionalProperties: false,
      required: ["status", "gradeReturn"],
      properties: {
        status: { enum: ["pending", "approved-local", "changes-requested"] },
        reviewedAt: nonEmpty,
        reviewerNote: nonEmpty,
        approvedCriterionLevelIds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["criterionId", "levelId"],
            properties: { criterionId: nonEmpty, levelId: nonEmpty },
          },
        },
        gradeReturn: { const: false },
      },
    },
  },
} as const;

const validateSchema = compileJsonSchemaValidator<CausalystSubmission>(
  causalystSubmissionJsonSchema as unknown as Record<string, unknown>,
);

export const validateCausalystSubmissionSchema = (
  candidate: unknown,
): ContractValidationResult<CausalystSubmission> => validateSchema(candidate)
  ? { ok: true, value: candidate, diagnostics: [] }
  : { ok: false, diagnostics: schemaErrorsToDiagnostics(validateSchema.errors) };

