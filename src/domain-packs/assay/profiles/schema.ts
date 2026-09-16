import { compileJsonSchemaValidator, validateWithJsonSchema } from "../../../platform/validation/jsonSchema";
import type { AssayProtocolAnalysis, AssayProtocolProfile } from "./types";

const decimal = { type: "string", pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" };
const nonEmptyStrings = { type: "array", minItems: 1, items: { type: "string", minLength: 1 } };
const expression: Record<string, unknown> = {
  oneOf: [
    {
      type: "object", additionalProperties: false, required: ["type", "input"],
      properties: {
        type: { const: "input" },
        input: { enum: ["observed", "blankMean", "referenceMean"] },
      },
    },
    {
      type: "object", additionalProperties: false, required: ["type", "value"],
      properties: { type: { const: "constant" }, value: decimal },
    },
    {
      type: "object", additionalProperties: false, required: ["type", "left", "right"],
      properties: {
        type: { enum: ["add", "subtract", "multiply", "divide"] },
        left: { $ref: "#/$defs/expression" },
        right: { $ref: "#/$defs/expression" },
      },
    },
  ],
};

export const assayProtocolProfileSchema = {
  $id: "https://lab-studio.local/schemas/assay-studio.protocol-profile/1.0",
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "id", "version", "title", "workflow", "useBoundary",
    "sourceReferences", "requiredControls", "readouts", "metricRules", "endpointRules",
    "roundingPolicy", "validityRange", "materialDefaults", "limitations",
  ],
  properties: {
    schema: { const: "assay-studio.protocol-profile" },
    schemaVersion: { const: "1.0" },
    id: { type: "string", minLength: 1 },
    version: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    title: { type: "string", minLength: 1 },
    workflow: { enum: ["xtt-metabolic-activity", "broth-microdilution"] },
    useBoundary: { enum: ["education", "research-planning"] },
    sourceReferences: {
      type: "array", minItems: 1, items: {
        type: "object", additionalProperties: false,
        required: ["id", "title", "organization", "url", "versionOrAccessDate", "supports"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          organization: { type: "string", minLength: 1 },
          url: { type: "string", pattern: "^https://" },
          versionOrAccessDate: { type: "string", minLength: 1 },
          supports: nonEmptyStrings,
        },
      },
    },
    requiredControls: {
      type: "array", minItems: 1, items: {
        type: "object", additionalProperties: false, required: ["role", "minimumCount"],
        properties: {
          role: { enum: ["sample", "standard", "blank", "negativeControl", "positiveControl", "vehicleControl", "growthControl", "sterilityControl", "qualityControl", "edgeBuffer", "unused"] },
          minimumCount: { type: "integer", minimum: 1 },
          expectedSignal: { enum: ["high", "low", "zero", "growth", "no-growth"] },
        },
      },
    },
    readouts: {
      type: "array", minItems: 1, items: {
        type: "object", additionalProperties: false,
        required: ["id", "label", "kind", "allowedUnits", "allowedSourceTypes", "channelRequirement", "interpretation"],
        properties: {
          id: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 },
          kind: { enum: ["continuous-signal", "binary-growth"] },
          allowedUnits: nonEmptyStrings,
          allowedSourceTypes: { type: "array", minItems: 1, items: { enum: ["instrument-export", "image-derived", "manual", "synthetic"] } },
          channelRequirement: { enum: ["required", "optional"] },
          interpretation: { type: "string", minLength: 1 },
        },
      },
    },
    blankControlRole: { type: "string" },
    referenceControlRole: { type: "string" },
    metricRules: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["id", "label", "unit", "expression", "interpretation"],
        properties: {
          id: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 },
          unit: { enum: ["1", "%"] }, expression: { $ref: "#/$defs/expression" },
          interpretation: { type: "string", minLength: 1 },
        },
      },
    },
    endpointRules: {
      type: "array", items: {
        oneOf: [
          {
            type: "object", additionalProperties: false,
            required: ["id", "type", "concentrationComponentRef", "growthValue", "noGrowthValue", "terminology", "requireMonotonic"],
            properties: {
              id: { type: "string" }, type: { const: "lowest-no-growth-concentration" },
              concentrationComponentRef: { type: "string" }, growthValue: decimal, noGrowthValue: decimal,
              terminology: { type: "string", minLength: 1 }, requireMonotonic: { const: true },
            },
          },
          {
            type: "object", additionalProperties: false,
            required: ["id", "type", "metricRuleRef", "concentrationComponentRef", "comparator", "threshold", "terminology", "requireMonotonic"],
            properties: {
              id: { type: "string" }, type: { const: "lowest-metric-threshold-concentration" },
              metricRuleRef: { type: "string" }, concentrationComponentRef: { type: "string" },
              comparator: { const: "greater-than-or-equal" }, threshold: decimal,
              terminology: { const: "protocol-defined inhibition endpoint" }, requireMonotonic: { const: true },
            },
          },
        ],
      },
    },
    roundingPolicy: {
      type: "object", additionalProperties: false, required: ["mode", "decimalPlaces", "tieBreaking"],
      properties: { mode: { const: "round" }, decimalPlaces: { type: "integer", minimum: 0, maximum: 12 }, tieBreaking: { enum: ["half-up", "half-even"] } },
    },
    validityRange: nonEmptyStrings,
    materialDefaults: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["resourceClass", "label", "quantityStatus", "note"],
        properties: {
          resourceClass: { enum: ["reagent", "consumable", "instrument"] },
          label: { type: "string" }, quantityStatus: { const: "protocol-supplied-required" }, note: { type: "string" },
        },
      },
    },
    limitations: nonEmptyStrings,
  },
  $defs: { expression },
} as const;

export const assayProtocolAnalysisSchema = {
  $id: "https://lab-studio.local/schemas/assay-studio.protocol-analysis/1.0",
  type: "object",
  required: [
    "schema", "schemaVersion", "id", "assayId", "observationSetId", "profileRef",
    "workflow", "status", "dataSources", "readoutRef", "readoutUnit", "controlStatus",
    "wellResults", "replicateSummaries", "formulaTraces", "diagnostics", "limitations",
    "scientificBoundary",
  ],
  properties: {
    schema: { const: "assay-studio.protocol-analysis" },
    schemaVersion: { const: "1.0" },
    status: { enum: ["complete", "indeterminate"] },
    controlStatus: { enum: ["valid", "invalid", "indeterminate"] },
  },
} as const;

const validateProfile = compileJsonSchemaValidator<AssayProtocolProfile>(assayProtocolProfileSchema);
const validateAnalysis = compileJsonSchemaValidator<AssayProtocolAnalysis>(assayProtocolAnalysisSchema);
export const validateAssayProtocolProfileSchema = (input: unknown) => validateWithJsonSchema(validateProfile, input);
export const validateAssayProtocolAnalysisSchema = (input: unknown) => validateWithJsonSchema(validateAnalysis, input);
