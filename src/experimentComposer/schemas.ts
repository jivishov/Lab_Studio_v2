import type { ValidateFunction } from "ajv";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../platform/validation/jsonSchema";
import type {
  CompiledExperimentBlueprint,
  ExperimentRequest,
  FidelityManifest,
  LabInventoryProfile,
  ProtocolReportGuardIdentity,
  PublicStageSummary,
  StageGuardIdentity,
  StagedExperiment,
  VerifiedExperimentFamily,
  VerifiedModuleDescriptor,
} from "./types";
import type { JsonValue, WebMCPResult } from "../webmcp/result";

const strictObject = (
  required: readonly string[],
  properties: Record<string, unknown>,
): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

const nonEmptyString = { type: "string", minLength: 1 } as const;

export const facilityInventorySchema = strictObject(
  ["splashGoggles", "eyewash", "spillResponseMaterials", "compatibleBaseWasteContainer"],
  {
    splashGoggles: { type: "boolean", description: "Whether splash goggles are declared available." },
    eyewash: { type: "boolean", description: "Whether an eyewash is declared available." },
    spillResponseMaterials: { type: "boolean", description: "Whether spill-response materials are declared available." },
    compatibleBaseWasteContainer: { type: "boolean", description: "Whether a compatible base-waste container is declared available." },
  },
);

export const equipmentInventoryItemSchema = strictObject(["definitionId", "count"], {
  definitionId: {
    type: "string",
    minLength: 1,
    maxLength: 80,
    description: "Supported equipment catalog definition ID.",
  },
  count: {
    type: "integer",
    minimum: 1,
    maximum: 10,
    description: "Available count for this equipment definition.",
  },
});

export const chemicalInventoryItemSchema = strictObject(
  ["chemicalId", "quantityMl", "containerDefinitionId"],
  {
    chemicalId: {
      type: "string",
      enum: [
        "synthetic_unknown_acid_a",
        "standardized_naoh",
        "phenolphthalein_indicator",
      ],
      description: "Supported Composer chemical ID.",
    },
    quantityMl: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 250,
      description: "Total available liquid volume in milliliters.",
    },
    concentrationM: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 1,
      description: "NaOH molarity; omit for the synthetic acid and indicator.",
    },
    containerDefinitionId: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      description: "Verified reagent-container equipment definition ID.",
    },
  },
);

export const labInventoryProfileSchema = strictObject(
  ["schemaVersion", "revision", "equipment", "chemicals", "facilities"],
  {
    schemaVersion: { const: "1" },
    revision: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    equipment: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: equipmentInventoryItemSchema,
    },
    chemicals: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: chemicalInventoryItemSchema,
    },
    facilities: facilityInventorySchema,
  },
);

export const experimentRequestSchema = strictObject(
  [
    "schemaVersion",
    "familyId",
    "expectedInventoryRevision",
    "objective",
    "audience",
    "experience",
    "durationMinutes",
    "deliveryContext",
    "aliquotVolumeMl",
    "endpointEvidence",
  ],
  {
    schemaVersion: { const: "1", description: "Composer request schema version; use 1." },
    familyId: { const: "acid_base_titration_v1", description: "Only the verified acid-base titration family is supported." },
    expectedInventoryRevision: {
      type: "integer",
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
      description: "Exact current inventory revision returned by inspection.",
    },
    objective: {
      type: "string",
      minLength: 1,
      maxLength: 300,
      pattern: ".*\\S.*",
      description: "Teacher objective treated only as untrusted display data.",
    },
    title: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      pattern: ".*\\S.*",
      description: "Optional staged-lab title treated only as display data.",
    },
    audience: {
      enum: ["high_school", "intro_college", "technician_onboarding"],
      description: "Supported learner audience level.",
    },
    experience: {
      enum: ["novice", "intermediate"],
      description: "Supported learner experience level.",
    },
    durationMinutes: {
      type: "integer",
      minimum: 20,
      maximum: 120,
      description: "Planned activity duration from 20 through 120 minutes.",
    },
    deliveryContext: {
      enum: ["virtual_training", "physical_procedure_rehearsal"],
      description: "Virtual training or declared physical-procedure rehearsal.",
    },
    aliquotVolumeMl: {
      enum: [10, 20, 25],
      description: "Supported synthetic-acid aliquot volume in milliliters.",
    },
    endpointEvidence: {
      const: "phenolphthalein",
      description: "P0 uses phenolphthalein endpoint evidence only.",
    },
    sampleLabel: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: ".*\\S.*",
      description: "Optional learner-facing sample label treated only as data.",
    },
  },
);

const composerRoleIds = [
  "burette",
  "burette_support",
  "aliquot_measure",
  "receiving_flask",
  "waste_receiver",
  "analyte_source",
  "titrant_source",
  "indicator_source",
] as const;

const composerModuleIds = [
  "mount_burette_v1",
  "measure_aliquot_cylinder_v1",
  "record_aliquot_v1",
  "transfer_aliquot_v1",
  "add_indicator_v1",
  "record_initial_burette_v1",
  "dispense_titrant_v1",
  "observe_indicator_endpoint_v1",
  "record_final_burette_v1",
  "calculate_molarity_v1",
] as const;

export const verifiedModuleDescriptorSchema = strictObject(
  [
    "id",
    "version",
    "label",
    "requiredRoleIds",
    "actionIds",
    "nodeIds",
    "prerequisiteModuleIds",
    "evidenceContract",
  ],
  {
    id: { enum: composerModuleIds },
    version: { const: "1.0.0" },
    label: nonEmptyString,
    requiredRoleIds: { type: "array", minItems: 1, uniqueItems: true, items: { enum: composerRoleIds } },
    actionIds: { type: "array", minItems: 1, uniqueItems: true, items: nonEmptyString },
    nodeIds: { type: "array", minItems: 1, uniqueItems: true, items: nonEmptyString },
    prerequisiteModuleIds: {
      type: "array",
      uniqueItems: true,
      items: { enum: composerModuleIds },
    },
    evidenceContract: nonEmptyString,
    limitation: nonEmptyString,
  },
);

export const verifiedExperimentFamilySchema = strictObject(
  [
    "id",
    "version",
    "sourceLabId",
    "sourceLabVersion",
    "sourceTechniqueId",
    "sourceTechniqueVersion",
    "supportedObjectives",
    "parameterBounds",
    "requiredRoles",
    "optionalRoles",
    "moduleIds",
    "modelLimitations",
  ],
  {
    id: { const: "acid_base_titration_v1" },
    version: { const: "1.0.0" },
    sourceLabId: { const: "acid-base-titration" },
    sourceLabVersion: { const: "3.0.1" },
    sourceTechniqueId: { const: "titration-endpoint" },
    sourceTechniqueVersion: { const: "3.0.1" },
    supportedObjectives: { type: "array", minItems: 1, items: nonEmptyString },
    parameterBounds: strictObject(["aliquotVolumeMl", "titrantMolarityM"], {
      aliquotVolumeMl: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: [{ const: 10 }, { const: 20 }, { const: 25 }],
      },
      titrantMolarityM: strictObject(["min", "max"], {
        min: { const: 0.05 },
        max: { const: 0.2 },
      }),
    }),
    requiredRoles: { type: "array", minItems: 1, uniqueItems: true, items: { enum: composerRoleIds } },
    optionalRoles: { type: "array", uniqueItems: true, items: { enum: composerRoleIds } },
    moduleIds: { type: "array", minItems: 10, maxItems: 10, uniqueItems: true, items: { enum: composerModuleIds } },
    modelLimitations: { type: "array", minItems: 1, items: nonEmptyString },
  },
);

export const fidelityManifestSchema = strictObject(
  ["status", "modeled", "proceduralOnly", "assumptions", "limitations", "safetyDeclarations", "warnings"],
  {
    status: { enum: ["modeled_and_executable", "procedurally_executable", "design_only", "unsupported"] },
    modeled: { type: "array", items: nonEmptyString },
    proceduralOnly: { type: "array", items: nonEmptyString },
    assumptions: { type: "array", items: nonEmptyString },
    limitations: { type: "array", minItems: 6, items: nonEmptyString },
    safetyDeclarations: { type: "array", items: nonEmptyString },
    warnings: { type: "array", items: nonEmptyString },
  },
);

const resolvedRolesSchema = strictObject(composerRoleIds, Object.fromEntries(
  composerRoleIds.map((role) => [role, nonEmptyString]),
));

export const compiledExperimentBlueprintSchema = strictObject(
  [
    "id",
    "familyId",
    "familyVersion",
    "request",
    "sourceInventoryRevision",
    "selectedSamplePresetId",
    "resolvedRoles",
    "moduleIds",
    "model",
    "fidelity",
  ],
  {
    id: nonEmptyString,
    familyId: { const: "acid_base_titration_v1" },
    familyVersion: { const: "1.0.0" },
    request: experimentRequestSchema,
    sourceInventoryRevision: { type: "integer", minimum: 0 },
    selectedSamplePresetId: { const: "synthetic_unknown_acid_a" },
    resolvedRoles: resolvedRolesSchema,
    moduleIds: { type: "array", minItems: 10, maxItems: 10, uniqueItems: true, items: { enum: composerModuleIds } },
    model: strictObject(
      [
        "analyteMolarityM",
        "analyteVolumeMl",
        "titrantMolarityM",
        "stoichiometricRatio",
        "dropVolumeMl",
        "endpointOffsetDrops",
        "maxExtraDrops",
        "buretteFillVolumeMl",
        "indicatorVolumeMl",
        "acidReserveMl",
        "naohReserveMl",
      ],
      {
        analyteMolarityM: { type: "number", exclusiveMinimum: 0 },
        analyteVolumeMl: { enum: [10, 20, 25] },
        titrantMolarityM: { type: "number", minimum: 0.05, maximum: 0.2 },
        stoichiometricRatio: strictObject(["analyte", "titrant"], {
          analyte: { const: 1 },
          titrant: { const: 1 },
        }),
        dropVolumeMl: { const: 0.05 },
        endpointOffsetDrops: { const: 0 },
        maxExtraDrops: { const: 5 },
        buretteFillVolumeMl: { const: 50 },
        indicatorVolumeMl: { const: 0.1 },
        acidReserveMl: { const: 5 },
        naohReserveMl: { const: 5 },
      },
    ),
    fidelity: fidelityManifestSchema,
  },
);

export const stageGuardIdentitySchema = strictObject(
  ["stageId", "stageRevision", "sourceInventoryRevision", "sourceDraftFingerprint"],
  {
    stageId: nonEmptyString,
    stageRevision: { type: "integer", minimum: 1 },
    sourceInventoryRevision: { type: "integer", minimum: 0 },
    sourceDraftFingerprint: nonEmptyString,
  },
);

export const protocolReportGuardIdentitySchema = strictObject(
  ["reportId", "stage", "passed"],
  {
    reportId: nonEmptyString,
    stage: stageGuardIdentitySchema,
    passed: { type: "boolean" },
  },
);

export const stagedExperimentSchema = strictObject(
  [
    "stageId",
    "stageRevision",
    "createdAt",
    "sourceInventoryRevision",
    "sourceDraftFingerprint",
    "request",
    "blueprint",
    "definition",
    "validation",
    "staleReasons",
  ],
  {
    stageId: nonEmptyString,
    stageRevision: { type: "integer", minimum: 1 },
    createdAt: nonEmptyString,
    sourceInventoryRevision: { type: "integer", minimum: 0 },
    sourceDraftFingerprint: nonEmptyString,
    request: experimentRequestSchema,
    blueprint: compiledExperimentBlueprintSchema,
    definition: { type: "object" },
    validation: strictObject(["schemaErrors", "interactionWarnings", "inventoryErrors"], {
      schemaErrors: { type: "array", items: { type: "string" } },
      interactionWarnings: { type: "array", items: { type: "string" } },
      inventoryErrors: { type: "array", items: { type: "string" } },
    }),
    staleReasons: {
      type: "array",
      uniqueItems: true,
      items: { enum: ["inventory_changed", "draft_changed"] },
    },
  },
);

export const publicStageSummarySchema = strictObject(
  [
    "stageId",
    "stageRevision",
    "familyId",
    "title",
    "objective",
    "audience",
    "experience",
    "durationMinutes",
    "deliveryContext",
    "resolvedRoles",
    "moduleIds",
    "workingVolumes",
    "fidelity",
    "staleReasons",
  ],
  {
    stageId: nonEmptyString,
    stageRevision: { type: "integer", minimum: 1 },
    familyId: { const: "acid_base_titration_v1" },
    title: nonEmptyString,
    objective: nonEmptyString,
    audience: { enum: ["high_school", "intro_college", "technician_onboarding"] },
    experience: { enum: ["novice", "intermediate"] },
    durationMinutes: { type: "integer", minimum: 20, maximum: 120 },
    deliveryContext: { enum: ["virtual_training", "physical_procedure_rehearsal"] },
    resolvedRoles: resolvedRolesSchema,
    moduleIds: { type: "array", minItems: 10, maxItems: 10, uniqueItems: true, items: { enum: composerModuleIds } },
    workingVolumes: strictObject(["aliquotMl", "buretteFillMl", "indicatorMl"], {
      aliquotMl: { enum: [10, 20, 25] },
      buretteFillMl: { const: 50 },
      indicatorMl: { const: 0.1 },
    }),
    fidelity: fidelityManifestSchema,
    staleReasons: {
      type: "array",
      uniqueItems: true,
      items: { enum: ["inventory_changed", "draft_changed"] },
    },
  },
);

export const webMcpResultEnvelopeSchema = strictObject(
  ["ok", "code", "message", "state"],
  {
    ok: { type: "boolean" },
    code: { type: "string", minLength: 1, maxLength: 80 },
    message: { type: "string", minLength: 1, maxLength: 1_000 },
    data: {},
    state: strictObject(["surface", "revision"], {
      surface: { enum: ["studio", "rehearsal"] },
      revision: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    }),
  },
);

export const composerSchemaCatalog = Object.freeze({
  experimentRequest: experimentRequestSchema,
  inventory: labInventoryProfileSchema,
  family: verifiedExperimentFamilySchema,
  module: verifiedModuleDescriptorSchema,
  fidelity: fidelityManifestSchema,
  blueprint: compiledExperimentBlueprintSchema,
  stageGuard: stageGuardIdentitySchema,
  protocolReportGuard: protocolReportGuardIdentitySchema,
  stagedExperiment: stagedExperimentSchema,
  publicStageSummary: publicStageSummarySchema,
  webMcpResultEnvelope: webMcpResultEnvelopeSchema,
});

export const experimentRequestValidator = compileJsonSchemaValidator<ExperimentRequest>(experimentRequestSchema);
export const inventoryValidator = compileJsonSchemaValidator<LabInventoryProfile>(labInventoryProfileSchema);
export const familyValidator = compileJsonSchemaValidator<VerifiedExperimentFamily>(verifiedExperimentFamilySchema);
export const moduleValidator = compileJsonSchemaValidator<VerifiedModuleDescriptor>(verifiedModuleDescriptorSchema);
export const fidelityValidator = compileJsonSchemaValidator<FidelityManifest>(fidelityManifestSchema);
export const blueprintValidator = compileJsonSchemaValidator<CompiledExperimentBlueprint>(compiledExperimentBlueprintSchema);
export const stageGuardValidator = compileJsonSchemaValidator<StageGuardIdentity>(stageGuardIdentitySchema);
export const protocolReportGuardValidator = compileJsonSchemaValidator<ProtocolReportGuardIdentity>(protocolReportGuardIdentitySchema);
export const stagedExperimentValidator = compileJsonSchemaValidator<StagedExperiment>(stagedExperimentSchema);
export const publicStageSummaryValidator = compileJsonSchemaValidator<PublicStageSummary>(publicStageSummarySchema);
export const webMcpResultEnvelopeValidator = compileJsonSchemaValidator<WebMCPResult<JsonValue>>(webMcpResultEnvelopeSchema);

export const validateSchema = <T>(
  validator: ValidateFunction<T>,
  input: unknown,
): ContractValidationResult<T> => validateWithJsonSchema(validator, input);
