import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../../../platform/validation/jsonSchema";
import type {
  AssayObservationSet,
  AssayQcEvaluation,
  AssayQcRuleSet,
} from "./types";

const id = { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" } as const;
const nonEmptyString = { type: "string", minLength: 1 } as const;
const stringSet = { type: "array", uniqueItems: true, items: nonEmptyString } as const;
const decimalString = { type: "string", pattern: "^[+-]?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;
const nonNegativeDecimal = { type: "string", pattern: "^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;
const status = { enum: ["pass", "warn", "fail", "indeterminate"] } as const;

const provenance = {
  type: "object",
  additionalProperties: false,
  required: ["sourceId", "sourceVersion", "methodId", "methodVersion", "description"],
  properties: {
    sourceId: id,
    sourceVersion: nonEmptyString,
    methodId: id,
    methodVersion: nonEmptyString,
    description: nonEmptyString,
  },
} as const;

const observation = {
  type: "object",
  additionalProperties: false,
  required: ["id", "plateId", "wellId", "sourceType", "rawValue", "unit", "provenance", "reviewStatus"],
  properties: {
    id,
    plateId: id,
    wellId: id,
    sourceType: { enum: ["instrument-export", "image-derived", "manual", "synthetic"] },
    rawValue: decimalString,
    unit: nonEmptyString,
    channel: nonEmptyString,
    confidence: nonNegativeDecimal,
    capturedAt: nonEmptyString,
    provenance,
    reviewStatus: { enum: ["unreviewed", "accepted", "corrected", "rejected"] },
  },
} as const;

const manualCorrection = {
  type: "object",
  additionalProperties: false,
  required: ["id", "observationId", "previousValue", "acceptedValue", "actorRole", "occurredAt", "provenance"],
  properties: {
    id,
    observationId: id,
    previousValue: decimalString,
    acceptedValue: decimalString,
    reason: nonEmptyString,
    actorRole: nonEmptyString,
    occurredAt: nonEmptyString,
    provenance,
  },
} as const;

export const assayObservationSetSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/assay-studio.observation-set/1.0",
  title: "Assay Studio Observation Set v1",
  type: "object",
  additionalProperties: false,
  required: ["schema", "schemaVersion", "id", "plateId", "orientation", "observations", "manualCorrections"],
  properties: {
    schema: { const: "assay-studio.observation-set" },
    schemaVersion: { const: "1.0" },
    id,
    plateId: id,
    orientation: { const: "A1-top-left" },
    observations: { type: "array", items: observation },
    manualCorrections: { type: "array", items: manualCorrection },
  },
};

const ruleBase = {
  id,
  title: nonEmptyString,
  violationSeverity: { enum: ["warn", "fail"] },
} as const;

const rule = {
  oneOf: [
    {
      type: "object", additionalProperties: false,
      required: ["id", "title", "violationSeverity", "type", "replicateGroupRefs", "metric", "maximum"],
      properties: {
        ...ruleBase,
        type: { const: "replicate-variability" },
        replicateGroupRefs: { type: "array", minItems: 1, uniqueItems: true, items: id },
        metric: { enum: ["sd", "cv", "range"] },
        maximum: nonNegativeDecimal,
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["id", "title", "violationSeverity", "type", "highControlRef", "lowControlRef", "minimumDifference"],
      properties: {
        ...ruleBase,
        type: { const: "control-direction" },
        highControlRef: id,
        lowControlRef: id,
        minimumDifference: nonNegativeDecimal,
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["id", "title", "violationSeverity", "type", "highControlRef", "lowControlRef", "minimum"],
      properties: {
        ...ruleBase,
        type: { const: "signal-window" },
        highControlRef: id,
        lowControlRef: id,
        minimum: nonNegativeDecimal,
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["id", "title", "violationSeverity", "type", "highControlRef", "lowControlRef", "minimum", "minimumReplicatesPerControl"],
      properties: {
        ...ruleBase,
        type: { const: "z-prime" },
        highControlRef: id,
        lowControlRef: id,
        minimum: decimalString,
        minimumReplicatesPerControl: { type: "integer", minimum: 2 },
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["id", "title", "violationSeverity", "type", "edgeWellIds", "interiorWellIds", "maximumAbsoluteDifference"],
      properties: {
        ...ruleBase,
        type: { const: "edge-effect" },
        edgeWellIds: { type: "array", minItems: 1, uniqueItems: true, items: id },
        interiorWellIds: { type: "array", minItems: 1, uniqueItems: true, items: id },
        maximumAbsoluteDifference: nonNegativeDecimal,
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["id", "title", "violationSeverity", "type", "wellIds", "axis", "maximumAbsoluteSlope"],
      properties: {
        ...ruleBase,
        type: { const: "drift" },
        wellIds: { type: "array", minItems: 2, uniqueItems: true, items: id },
        axis: { enum: ["row", "column"] },
        maximumAbsoluteSlope: nonNegativeDecimal,
      },
    },
    {
      type: "object", additionalProperties: false,
      required: ["id", "title", "violationSeverity", "type", "replicateGroupRefs", "maximumAbsoluteDeviation"],
      properties: {
        ...ruleBase,
        type: { const: "outlier-flag" },
        replicateGroupRefs: { type: "array", minItems: 1, uniqueItems: true, items: id },
        maximumAbsoluteDeviation: nonNegativeDecimal,
      },
    },
  ],
} as const;

export const assayQcRuleSetSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/assay-studio.qc-rule-set/1.0",
  title: "Assay Studio QC Rule Set v1",
  type: "object",
  additionalProperties: false,
  required: ["schema", "schemaVersion", "id", "title", "policySource", "requiredControls", "roundingPolicy", "rules"],
  properties: {
    schema: { const: "assay-studio.qc-rule-set" },
    schemaVersion: { const: "1.0" },
    id,
    title: nonEmptyString,
    policySource: {
      type: "object",
      additionalProperties: false,
      required: ["id", "version", "title", "sourceKind", "sourceReferences", "validityRange", "limitations"],
      properties: {
        id,
        version: nonEmptyString,
        title: nonEmptyString,
        sourceKind: { enum: ["protocol-profile", "author-supplied", "fixture"] },
        sourceReferences: { type: "array", minItems: 1, uniqueItems: true, items: nonEmptyString },
        validityRange: { type: "array", minItems: 1, uniqueItems: true, items: nonEmptyString },
        limitations: { type: "array", minItems: 1, uniqueItems: true, items: nonEmptyString },
      },
    },
    requiredControls: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "controlRef", "minimumCount"],
        properties: {
          id,
          controlRef: id,
          minimumCount: { type: "integer", minimum: 1 },
          maximumCount: { type: "integer", minimum: 1 },
        },
      },
    },
    blankCorrection: {
      type: "object",
      additionalProperties: false,
      required: ["controlRef", "aggregation"],
      properties: { controlRef: id, aggregation: { enum: ["mean", "median"] } },
    },
    normalization: {
      type: "object",
      additionalProperties: false,
      required: ["referenceControlRef", "mode"],
      properties: {
        referenceControlRef: id,
        mode: { enum: ["ratio-to-reference", "percent-of-reference", "percent-inhibition"] },
      },
    },
    roundingPolicy: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "decimalPlaces", "tieBreaking"],
      properties: {
        mode: { const: "round" },
        decimalPlaces: { type: "integer", minimum: 0, maximum: 12 },
        tieBreaking: { enum: ["half-up", "half-even"] },
      },
    },
    rules: { type: "array", minItems: 1, items: rule },
  },
};

const formulaTrace = {
  type: "object",
  additionalProperties: false,
  required: ["id", "policySourceRef", "formula", "inputRefs", "inputValues", "result", "unit", "rounding"],
  properties: {
    id,
    policySourceRef: id,
    formula: nonEmptyString,
    inputRefs: { type: "array", items: id },
    inputValues: { type: "array", items: decimalString },
    result: decimalString,
    unit: nonEmptyString,
    rounding: nonEmptyString,
  },
} as const;

export const assayQcEvaluationSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/assay-studio.qc-evaluation/1.0",
  title: "Assay Studio QC Evaluation v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "id", "assayId", "observationSetId", "ruleSetRef",
    "policySourceRef", "status", "unit", "wellResults", "replicateSummaries",
    "ruleResults", "formulaTraces", "outlierFlags", "limitations",
  ],
  properties: {
    schema: { const: "assay-studio.qc-evaluation" },
    schemaVersion: { const: "1.0" },
    id,
    assayId: id,
    observationSetId: id,
    ruleSetRef: {
      type: "object",
      additionalProperties: false,
      required: ["id", "version"],
      properties: { id, version: { const: "1.0" } },
    },
    policySourceRef: id,
    status,
    unit: nonEmptyString,
    wellResults: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["wellId", "coordinate", "observationId", "rawValue", "unit", "flags"],
        properties: {
          wellId: id,
          coordinate: { type: "string", pattern: "^[A-H](?:[1-9]|1[0-2])$" },
          observationId: id,
          rawValue: decimalString,
          correctedValue: decimalString,
          normalizedValue: decimalString,
          unit: nonEmptyString,
          flags: stringSet,
        },
      },
    },
    replicateSummaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "replicateGroupRef", "memberWellIds", "observedWellIds", "aggregation", "unit",
          "status", "formulaTraceRefs", "limitations",
        ],
        properties: {
          replicateGroupRef: id,
          memberWellIds: { type: "array", uniqueItems: true, items: id },
          observedWellIds: { type: "array", uniqueItems: true, items: id },
          aggregation: { enum: ["mean", "median", "none"] },
          aggregateValue: decimalString,
          variabilityMetric: { enum: ["sd", "cv", "range"] },
          variabilityValue: decimalString,
          unit: nonEmptyString,
          variabilityUnit: nonEmptyString,
          status: { enum: ["complete", "indeterminate"] },
          formulaTraceRefs: { type: "array", uniqueItems: true, items: id },
          limitations: { type: "array", uniqueItems: true, items: nonEmptyString },
        },
      },
    },
    ruleResults: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ruleId", "ruleType", "title", "status", "summary", "affectedWellIds", "formulaTraceRefs", "limitations"],
        properties: {
          ruleId: id,
          ruleType: {
            enum: [
              "replicate-variability", "control-direction", "signal-window", "z-prime",
              "edge-effect", "drift", "outlier-flag", "required-control", "observation-set",
            ],
          },
          title: nonEmptyString,
          status,
          summary: nonEmptyString,
          metricValue: decimalString,
          unit: nonEmptyString,
          threshold: decimalString,
          affectedWellIds: { type: "array", uniqueItems: true, items: id },
          formulaTraceRefs: { type: "array", uniqueItems: true, items: id },
          limitations: { type: "array", uniqueItems: true, items: nonEmptyString },
        },
      },
    },
    formulaTraces: { type: "array", items: formulaTrace },
    outlierFlags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ruleId", "wellId", "reason"],
        properties: { ruleId: id, wellId: id, reason: nonEmptyString },
      },
    },
    limitations: { type: "array", minItems: 1, uniqueItems: true, items: nonEmptyString },
  },
};

const observationSetValidator = compileJsonSchemaValidator<AssayObservationSet>(assayObservationSetSchema);
const ruleSetValidator = compileJsonSchemaValidator<AssayQcRuleSet>(assayQcRuleSetSchema);
const evaluationValidator = compileJsonSchemaValidator<AssayQcEvaluation>(assayQcEvaluationSchema);

export const validateAssayObservationSetSchema = (
  input: unknown,
): ContractValidationResult<AssayObservationSet> =>
  validateWithJsonSchema(observationSetValidator, input);

export const validateAssayQcRuleSetSchema = (
  input: unknown,
): ContractValidationResult<AssayQcRuleSet> =>
  validateWithJsonSchema(ruleSetValidator, input);

export const validateAssayQcEvaluationSchema = (
  input: unknown,
): ContractValidationResult<AssayQcEvaluation> =>
  validateWithJsonSchema(evaluationValidator, input);
