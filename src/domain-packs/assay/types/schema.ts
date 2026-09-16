import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../../../platform/validation/jsonSchema";
import type {
  AssayDefinition,
  PlateDefinition,
  PlateRuntimeState,
  WellDefinition,
  WellState,
} from "./types";

const nonEmptyString = { type: "string", minLength: 1 } as const;
const id = { type: "string", minLength: 1, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$" } as const;
const idSet = { type: "array", uniqueItems: true, items: id } as const;
const stringSet = { type: "array", uniqueItems: true, items: nonEmptyString } as const;
const decimalString = { type: "string", pattern: "^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" } as const;
const controlledUnit = {
  enum: [
    "1", "%", "s", "min", "h", "uL", "mL", "L", "ug", "mg", "g", "kg",
    "umol", "mmol", "mol", "uM", "mM", "M", "degC", "K", "rpm", "nm", "AU", "OD", "pH",
  ],
} as const;

const definitions: Record<string, unknown> = {
  nonEmptyString,
  id,
  idSet,
  stringSet,
  decimalString,
  controlledUnit,
  quantity: {
    type: "object",
    additionalProperties: false,
    required: ["value", "unit"],
    properties: { value: decimalString, unit: controlledUnit },
  },
  quantityRange: {
    type: "object",
    additionalProperties: false,
    required: ["minimum", "maximum"],
    properties: {
      minimum: { $ref: "#/definitions/quantity" },
      maximum: { $ref: "#/definitions/quantity" },
    },
  },
  unitReference: {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "id"],
        properties: { kind: { const: "known" }, id: controlledUnit },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "raw", "reason"],
        properties: { kind: { const: "unknown" }, raw: nonEmptyString, reason: nonEmptyString },
      },
    ],
  },
  quantityIR: {
    type: "object",
    additionalProperties: false,
    required: ["value", "unit"],
    properties: {
      value: decimalString,
      unit: { $ref: "#/definitions/unitReference" },
      uncertainty: decimalString,
    },
  },
  scalarOrQuantity: {
    oneOf: [
      { type: "string" },
      { type: "boolean" },
      { $ref: "#/definitions/quantityIR" },
    ],
  },
  sourcePosition: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      line: { type: "integer", minimum: 0 },
      column: { type: "integer", minimum: 0 },
      offset: { type: "integer", minimum: 0 },
    },
  },
  sourceLocator: {
    type: "object",
    additionalProperties: false,
    required: ["sourceRef", "kind", "pointer"],
    properties: {
      sourceRef: id,
      kind: { enum: ["structured-step", "section", "paragraph", "table-cell", "page", "timestamp", "user-selection"] },
      pointer: nonEmptyString,
      start: { $ref: "#/definitions/sourcePosition" },
      end: { $ref: "#/definitions/sourcePosition" },
      quote: { type: "string" },
    },
  },
  evidenceRequirement: {
    type: "object",
    additionalProperties: false,
    required: ["id", "typeId", "description", "required", "sourceLocators"],
    properties: {
      id,
      typeId: id,
      description: nonEmptyString,
      required: { type: "boolean" },
      sourceLocators: { type: "array", items: { $ref: "#/definitions/sourceLocator" } },
    },
  },
  versionedRef: {
    type: "object",
    additionalProperties: false,
    required: ["id", "version"],
    properties: {
      id,
      version: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?$" },
    },
  },
  plannedWellComponent: {
    type: "object",
    additionalProperties: false,
    required: ["resourceRef", "role", "volume"],
    properties: {
      resourceRef: id,
      role: { enum: ["sample", "reagent", "diluent", "control", "other"] },
      volume: { $ref: "#/definitions/quantity" },
      concentration: { $ref: "#/definitions/quantity" },
    },
  },
  wellDefinition: {
    type: "object",
    additionalProperties: false,
    required: [
      "id", "coordinate", "role", "conditionRefs", "replicateGroupRefs", "plannedComponents",
      "expectedFinalVolume", "labels",
    ],
    properties: {
      id,
      coordinate: { type: "string", pattern: "^[A-P](?:[1-9]|1[0-9]|2[0-4])$" },
      role: {
        enum: [
          "sample", "standard", "blank", "negativeControl", "positiveControl", "vehicleControl",
          "growthControl", "sterilityControl", "qualityControl", "edgeBuffer", "unused",
        ],
      },
      sampleRef: id,
      conditionRefs: idSet,
      controlRef: id,
      replicateGroupRefs: idSet,
      plannedComponents: { type: "array", items: { $ref: "#/definitions/plannedWellComponent" } },
      expectedFinalVolume: { $ref: "#/definitions/quantity" },
      labels: stringSet,
    },
  },
  plateRegion: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "wellIds", "labels"],
    properties: { id, label: nonEmptyString, wellIds: idSet, labels: stringSet },
  },
  plateDefinition: {
    type: "object",
    additionalProperties: false,
    required: [
      "id", "format", "rowCount", "columnCount", "rowLabels", "columnLabels", "orientation",
      "maxWellVolume", "wells", "regions",
    ],
    properties: {
      id,
      format: { enum: [6, 12, 24, 48, 96, 384] },
      rowCount: { type: "integer", minimum: 1, maximum: 16 },
      columnCount: { type: "integer", minimum: 1, maximum: 24 },
      rowLabels: { type: "array", minItems: 1, maxItems: 16, uniqueItems: true, items: { type: "string", pattern: "^[A-P]$" } },
      columnLabels: { type: "array", minItems: 1, maxItems: 24, uniqueItems: true, items: { type: "string", pattern: "^(?:[1-9]|1[0-9]|2[0-4])$" } },
      orientation: { const: "A1-top-left" },
      maxWellVolume: { $ref: "#/definitions/quantity" },
      recommendedWorkingVolume: { $ref: "#/definitions/quantityRange" },
      wells: { type: "array", minItems: 1, maxItems: 384, items: { $ref: "#/definitions/wellDefinition" } },
      regions: { type: "array", items: { $ref: "#/definitions/plateRegion" } },
    },
  },
  assayResource: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "kind", "description", "labels"],
    properties: {
      id,
      label: nonEmptyString,
      kind: { enum: ["reagent", "buffer", "sample", "consumable", "instrument", "other"] },
      description: { type: "string" },
      stockConcentration: { $ref: "#/definitions/quantity" },
      availableVolume: { $ref: "#/definitions/quantity" },
      labels: stringSet,
    },
  },
  sample: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "description", "tags"],
    properties: { id, label: nonEmptyString, description: { type: "string" }, tags: stringSet },
  },
  condition: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "parameters"],
    properties: {
      id,
      label: nonEmptyString,
      parameters: { type: "object", additionalProperties: { $ref: "#/definitions/scalarOrQuantity" } },
    },
  },
  control: {
    type: "object",
    additionalProperties: false,
    required: ["id", "role", "label", "requiredByProfile", "interpretation"],
    properties: {
      id,
      role: { $ref: "#/definitions/wellDefinition/properties/role" },
      label: nonEmptyString,
      expectedDirection: { enum: ["high", "low", "zero", "growth", "no-growth"] },
      requiredByProfile: { type: "boolean" },
      interpretation: nonEmptyString,
    },
  },
  replicateGroup: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "memberWellIds", "minimumCount", "aggregation"],
    properties: {
      id,
      type: { enum: ["technical", "biological", "independent-run"] },
      memberWellIds: idSet,
      minimumCount: { type: "integer", minimum: 1 },
      aggregation: { enum: ["mean", "median", "none"] },
      variabilityMetric: { enum: ["sd", "cv", "range"] },
    },
  },
  equipment: {
    type: "object",
    additionalProperties: false,
    required: ["id", "equipmentType", "label"],
    properties: {
      id,
      equipmentType: { enum: ["microplate", "micropipette", "tip-box", "reservoir", "tube", "plate-reader"] },
      label: nonEmptyString,
      catalogRef: id,
    },
  },
  operation: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "label", "destinationRefs", "parameters", "limitations"],
    properties: {
      id,
      type: { enum: ["selectPipette", "setVolume", "attachTips", "aspirate", "dispense", "mix", "ejectTips", "wait", "readPlate", "recordNote", "recordCalculation"] },
      label: nonEmptyString,
      sourceRef: id,
      destinationRefs: idSet,
      volume: { $ref: "#/definitions/quantity" },
      parameters: { type: "object", additionalProperties: { $ref: "#/definitions/scalarOrQuantity" } },
      limitations: stringSet,
    },
  },
  processNode: {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "title", "description", "evidenceRequirementRefs", "hints"],
    properties: {
      id,
      type: { enum: ["operation", "checkpoint", "decision", "calculation", "observation", "reflection", "teacherNote"] },
      title: nonEmptyString,
      description: { type: "string" },
      operationRef: id,
      evidenceRequirementRefs: idSet,
      hints: stringSet,
      layout: {
        type: "object",
        additionalProperties: false,
        required: ["x", "y"],
        properties: {
          x: { type: "number" }, y: { type: "number" }, lane: { type: "string" },
          display: { enum: ["compact", "expanded"] },
        },
      },
    },
  },
  processEdgeCondition: {
    oneOf: [
      { type: "object", additionalProperties: false, required: ["type"], properties: { type: { enum: ["always", "completed"] } } },
      { type: "object", additionalProperties: false, required: ["type", "conditionRef"], properties: { type: { const: "condition" }, conditionRef: id, expected: { type: ["string", "boolean"] } } },
      { type: "object", additionalProperties: false, required: ["type", "branchKey"], properties: { type: { const: "branch" }, branchKey: id } },
      { type: "object", additionalProperties: false, required: ["type"], properties: { type: { const: "retry" }, maxAttempts: { type: "integer", minimum: 1 } } },
    ],
  },
  processEdge: {
    type: "object",
    additionalProperties: false,
    required: ["id", "from", "to", "label", "condition"],
    properties: { id, from: id, to: id, label: { type: "string" }, condition: { $ref: "#/definitions/processEdgeCondition" } },
  },
  process: {
    type: "object",
    additionalProperties: false,
    required: ["schema", "schemaVersion", "startNodeId", "nodes", "edges"],
    properties: {
      schema: { const: "studio.process-graph" },
      schemaVersion: { const: "1.0" },
      startNodeId: id,
      nodes: { type: "array", minItems: 1, items: { $ref: "#/definitions/processNode" } },
      edges: { type: "array", items: { $ref: "#/definitions/processEdge" } },
    },
  },
  analysisPlan: {
    type: "object",
    additionalProperties: false,
    required: ["id", "analysisType", "inputObservationRefs", "outputIds", "limitations"],
    properties: {
      id,
      analysisType: { enum: ["none", "xtt", "inhibition", "custom"] },
      profileRef: { $ref: "#/definitions/versionedRef" },
      inputObservationRefs: idSet,
      outputIds: idSet,
      limitations: stringSet,
    },
  },
  resourceSpec: {
    type: "object",
    required: ["id", "domainPackId", "label", "resourceClass", "quantity", "reviewFlags"],
    properties: {
      id,
      domainPackId: { const: "assay" },
      label: nonEmptyString,
      resourceClass: { enum: ["consumable", "durable", "instrument", "reagent", "sample", "service"] },
      quantity: { type: "object" },
      reviewFlags: { type: "array" },
    },
  },
  wellComponentState: {
    type: "object",
    additionalProperties: false,
    required: ["resourceRef", "volume", "sourceRefs"],
    properties: {
      resourceRef: id,
      volume: { $ref: "#/definitions/quantity" },
      concentration: { $ref: "#/definitions/quantity" },
      sourceRefs: idSet,
    },
  },
  runtimeWarning: {
    type: "object",
    additionalProperties: false,
    required: ["code", "severity", "message"],
    properties: { code: id, severity: { enum: ["warning", "blocking"] }, message: nonEmptyString },
  },
  wellState: {
    type: "object",
    additionalProperties: false,
    required: ["coordinate", "volume", "components", "mixed", "contaminationTags", "status", "observations", "warnings"],
    properties: {
      coordinate: { type: "string", pattern: "^[A-H](?:[1-9]|1[0-2])$" },
      volume: { $ref: "#/definitions/quantity" },
      components: { type: "array", items: { $ref: "#/definitions/wellComponentState" } },
      mixed: { type: "boolean" },
      contaminationTags: stringSet,
      status: { enum: ["empty", "prepared", "incubating", "ready", "read", "invalid"] },
      observations: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["id"], properties: { id } },
      },
      warnings: { type: "array", items: { $ref: "#/definitions/runtimeWarning" } },
    },
  },
  plateRuntimeState: {
    type: "object",
    additionalProperties: false,
    required: ["plateId", "format", "orientation", "maxWellVolume", "wells"],
    properties: {
      plateId: id,
      format: { const: 96 },
      orientation: { const: "A1-top-left" },
      maxWellVolume: { $ref: "#/definitions/quantity" },
      wells: { type: "array", minItems: 96, maxItems: 96, items: { $ref: "#/definitions/wellState" } },
    },
  },
};

export const assayDefinitionSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://lab-studio.local/schemas/assay-studio.assay-definition/1.0",
  title: "Assay Studio AssayDefinition v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "id", "title", "description", "audience", "learningGoals", "useBoundary",
    "safetyNotes", "protocolProfileRef", "plate", "resources", "samples", "conditions", "controls",
    "replicateGroups", "equipment", "operations", "process", "analysisPlan", "evidenceRequirements", "materials", "metadata",
  ],
  properties: {
    schema: { const: "assay-studio.assay-definition" },
    schemaVersion: { const: "1.0" },
    id,
    title: nonEmptyString,
    description: { type: "string" },
    audience: nonEmptyString,
    learningGoals: { type: "array", minItems: 1, items: nonEmptyString },
    useBoundary: { enum: ["education", "research-planning"] },
    safetyNotes: { type: "array", items: nonEmptyString },
    protocolProfileRef: { $ref: "#/definitions/versionedRef" },
    plate: { $ref: "#/definitions/plateDefinition" },
    resources: { type: "array", items: { $ref: "#/definitions/assayResource" } },
    samples: { type: "array", items: { $ref: "#/definitions/sample" } },
    conditions: { type: "array", items: { $ref: "#/definitions/condition" } },
    controls: { type: "array", items: { $ref: "#/definitions/control" } },
    replicateGroups: { type: "array", items: { $ref: "#/definitions/replicateGroup" } },
    equipment: { type: "array", items: { $ref: "#/definitions/equipment" } },
    operations: { type: "array", items: { $ref: "#/definitions/operation" } },
    process: { $ref: "#/definitions/process" },
    analysisPlan: { $ref: "#/definitions/analysisPlan" },
    evidenceRequirements: { type: "array", items: { $ref: "#/definitions/evidenceRequirement" } },
    materials: { type: "array", items: { $ref: "#/definitions/resourceSpec" } },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["version", "author", "updatedAt", "tags"],
      properties: {
        version: nonEmptyString,
        author: nonEmptyString,
        updatedAt: { type: "string", minLength: 20 },
        tags: stringSet,
      },
    },
  },
  definitions,
};

const componentSchema = (definition: string, title: string): Record<string, unknown> => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: `https://lab-studio.local/schemas/assay-studio.assay-definition/1.0/${definition}`,
  title,
  definitions,
  $ref: `#/definitions/${definition}`,
});

export const assayPlateDefinitionSchema = componentSchema("plateDefinition", "Assay Studio PlateDefinition v1");
export const assayWellDefinitionSchema = componentSchema("wellDefinition", "Assay Studio WellDefinition v1");
export const assayPlateRuntimeStateSchema = componentSchema("plateRuntimeState", "Assay Studio PlateRuntimeState v1");
export const assayWellStateSchema = componentSchema("wellState", "Assay Studio WellState v1");

const validateAssaySchema = compileJsonSchemaValidator<AssayDefinition>(assayDefinitionSchema);
const validatePlateSchema = compileJsonSchemaValidator<PlateDefinition>(assayPlateDefinitionSchema);
const validateWellSchema = compileJsonSchemaValidator<WellDefinition>(assayWellDefinitionSchema);
const validatePlateStateSchemaDocument = compileJsonSchemaValidator<PlateRuntimeState>(assayPlateRuntimeStateSchema);
const validateWellStateSchemaDocument = compileJsonSchemaValidator<WellState>(assayWellStateSchema);

export const validateAssayDefinitionSchema = (input: unknown): ContractValidationResult<AssayDefinition> =>
  validateWithJsonSchema(validateAssaySchema, input);
export const validatePlateDefinitionSchema = (input: unknown): ContractValidationResult<PlateDefinition> =>
  validateWithJsonSchema(validatePlateSchema, input);
export const validateWellDefinitionSchema = (input: unknown): ContractValidationResult<WellDefinition> =>
  validateWithJsonSchema(validateWellSchema, input);
export const validatePlateRuntimeStateSchema = (input: unknown): ContractValidationResult<PlateRuntimeState> =>
  validateWithJsonSchema(validatePlateStateSchemaDocument, input);
export const validateWellStateSchema = (input: unknown): ContractValidationResult<WellState> =>
  validateWithJsonSchema(validateWellStateSchemaDocument, input);
