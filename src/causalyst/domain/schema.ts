import { compileJsonSchemaValidator, schemaErrorsToDiagnostics } from "../../platform/validation/jsonSchema";
import type { ContractValidationResult } from "../../platform/validation/jsonSchema";
import type { CausalystAssessmentDefinition } from "./types";

const nonEmpty = { type: "string", minLength: 1 } as const;
const decimal = { type: "string", pattern: "^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;
const versionedRef = {
  type: "object",
  additionalProperties: false,
  required: ["id", "version"],
  properties: { id: nonEmpty, version: nonEmpty },
} as const;
const capabilityRef = {
  type: "object",
  additionalProperties: false,
  required: ["domainPackId", "kind", "id", "version"],
  properties: {
    domainPackId: { enum: ["chemistry", "assay"] },
    kind: { enum: ["object", "operation", "interaction", "model", "evidence", "planning", "export"] },
    id: nonEmpty,
    version: nonEmpty,
  },
} as const;
const stringArray = { type: "array", items: nonEmpty } as const;

export const causalystAssessmentDefinitionSchema = {
  $id: "https://lab-studio.local/schemas/causalyst.assessment-definition/1.0",
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "id", "title", "instructions", "audience",
    "learningObjectives", "domainPackRef", "contractPins", "executableArtifact",
    "authoringPolicy", "runPolicy", "evidencePlan", "rubric", "explanationPrompts",
    "attemptPolicy", "feedbackPolicy", "submissionPolicy", "metadata",
  ],
  properties: {
    schema: { const: "causalyst.assessment-definition" },
    schemaVersion: { const: "1.0" },
    id: nonEmpty,
    title: nonEmpty,
    instructions: nonEmpty,
    audience: nonEmpty,
    learningObjectives: stringArray,
    domainPackRef: {
      ...versionedRef,
      properties: { id: { enum: ["chemistry", "assay"] }, version: nonEmpty },
    },
    contractPins: {
      type: "object",
      additionalProperties: false,
      required: ["capabilityManifestSchemaVersion", "evidenceRegistryVersion"],
      properties: {
        capabilityManifestSchemaVersion: { const: "2.0" },
        evidenceRegistryVersion: nonEmpty,
      },
    },
    executableArtifact: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "artifactRef", "artifact"],
      properties: {
        mode: { const: "embedded" },
        artifactRef: versionedRef,
        artifact: { type: "object" },
      },
    },
    authoringPolicy: {
      type: "object",
      additionalProperties: false,
      required: [
        "mode", "allowedCapabilityRefs", "deniedCapabilityRefs", "requiredCapabilityRefs",
        "allowedParameterPaths", "lockedParameterPaths", "maximumProcessNodes",
        "maximumArtifactsPerAttempt", "requiredFidelity", "unsupportedStepPolicy",
      ],
      properties: {
        mode: { enum: ["configure", "approved-palette", "prompt-bounded"] },
        allowedCapabilityRefs: { type: "array", items: capabilityRef },
        deniedCapabilityRefs: { type: "array", items: capabilityRef },
        requiredCapabilityRefs: { type: "array", items: capabilityRef },
        allowedParameterPaths: stringArray,
        lockedParameterPaths: stringArray,
        maximumProcessNodes: { type: "integer", minimum: 1, maximum: 500 },
        maximumArtifactsPerAttempt: { type: "integer", minimum: 1, maximum: 20 },
        requiredFidelity: { enum: ["F0", "F1", "F2", "F3", "F4"] },
        unsupportedStepPolicy: { enum: ["block", "allow-representable-with-review"] },
      },
    },
    runPolicy: {
      type: "object",
      additionalProperties: false,
      required: [
        "requiredRuns", "allowReset", "requirePredictionBeforeRun",
        "requireComparisonAfterRun", "requiredEvidenceTypeIds", "traceRetention", "replayEnabled",
      ],
      properties: {
        requiredRuns: { type: "integer", minimum: 1, maximum: 50 },
        allowReset: { type: "boolean" },
        requirePredictionBeforeRun: { type: "boolean" },
        requireComparisonAfterRun: { type: "boolean" },
        requiredEvidenceTypeIds: stringArray,
        traceRetention: { enum: ["submission", "until-graded", "institution-policy"] },
        replayEnabled: { type: "boolean" },
      },
    },
    evidencePlan: {
      type: "object",
      additionalProperties: false,
      required: ["requiredEvidenceTypeRefs", "optionalEvidenceTypeRefs", "selectorVersion"],
      properties: {
        requiredEvidenceTypeRefs: { type: "array", items: versionedRef },
        optionalEvidenceTypeRefs: { type: "array", items: versionedRef },
        selectorVersion: { const: "1.0" },
      },
    },
    rubric: {
      type: "object",
      additionalProperties: false,
      required: ["id", "totalPoints", "criteria", "scoringPolicy"],
      properties: {
        id: nonEmpty,
        totalPoints: decimal,
        criteria: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id", "title", "description", "weight", "levels", "evidenceSelectors",
              "scoringMode", "missingEvidenceBehavior",
            ],
            properties: {
              id: nonEmpty,
              title: nonEmpty,
              description: nonEmpty,
              weight: decimal,
              levels: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "label", "description", "points"],
                  properties: { id: nonEmpty, label: nonEmpty, description: nonEmpty, points: decimal },
                },
              },
              evidenceSelectors: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "type"],
                  properties: {
                    id: nonEmpty,
                    type: { enum: ["evidence-type", "artifact-valid", "capability-used", "payload-equals"] },
                    evidenceTypeId: nonEmpty,
                    evidenceTypeVersion: nonEmpty,
                    minimumCount: { type: "integer", minimum: 1 },
                    expected: {},
                    capabilityRef,
                    path: { type: "string", pattern: "^/(?:[^/~]|~0|~1)+(?:/(?:[^/~]|~0|~1)+)*$" },
                  },
                },
              },
              scoringMode: { enum: ["manual", "deterministic", "rule-assisted"] },
              minimumEvidenceCount: { type: "integer", minimum: 1 },
              missingEvidenceBehavior: { enum: ["zero", "flag-for-review", "not-applicable"] },
            },
          },
        },
        scoringPolicy: {
          type: "object",
          additionalProperties: false,
          required: ["finalDecision", "allowDeterministicAutoCredit", "allowModelSuggestions"],
          properties: {
            finalDecision: { const: "teacher-required" },
            allowDeterministicAutoCredit: { type: "boolean" },
            allowModelSuggestions: { const: false },
          },
        },
      },
    },
    explanationPrompts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "prompt", "required", "evidenceSelectorIds"],
        properties: { id: nonEmpty, prompt: nonEmpty, required: { type: "boolean" }, evidenceSelectorIds: stringArray },
      },
    },
    attemptPolicy: {
      type: "object",
      additionalProperties: false,
      required: ["maximumAttempts", "allowDrafts"],
      properties: { maximumAttempts: { type: "integer", minimum: 1, maximum: 100 }, allowDrafts: { type: "boolean" } },
    },
    feedbackPolicy: {
      type: "object",
      additionalProperties: false,
      required: ["duringAttempt", "afterSubmission"],
      properties: {
        duringAttempt: { enum: ["none", "validation-only", "configured"] },
        afterSubmission: { const: "teacher-release" },
      },
    },
    submissionPolicy: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "requireValidArtifact", "requireTeacherReview"],
      properties: {
        mode: { const: "local-export" },
        requireValidArtifact: { type: "boolean" },
        requireTeacherReview: { const: true },
      },
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["version", "author", "updatedAt", "tags"],
      properties: {
        version: nonEmpty,
        author: nonEmpty,
        updatedAt: nonEmpty,
        tags: stringArray,
      },
    },
  },
} as const;

const validateSchema = compileJsonSchemaValidator<CausalystAssessmentDefinition>(
  causalystAssessmentDefinitionSchema as unknown as Record<string, unknown>,
);

export const validateCausalystAssessmentSchema = (
  candidate: unknown,
): ContractValidationResult<CausalystAssessmentDefinition> => validateSchema(candidate)
  ? { ok: true, value: candidate, diagnostics: [] }
  : { ok: false, diagnostics: schemaErrorsToDiagnostics(validateSchema.errors) };
