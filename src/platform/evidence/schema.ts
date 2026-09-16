import evidenceBundleSchemaDocument from "./evidence-bundle.schema.json";
import evidenceRegistrySchemaDocument from "./evidence-registry.schema.json";
import runTraceSchemaDocument from "./run-trace.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import type {
  EvidenceBundle,
  EvidenceRegistryDocument,
  EvidenceRegistryFragment,
  RunEvent,
  RunTrace,
} from "./types";

type SchemaDocument = Record<string, unknown>;

const componentSchema = (
  schemaSource: { $schema: string; $id: string; definitions: Record<string, unknown> },
  definition: string,
  title: string,
): SchemaDocument => ({
  $schema: schemaSource.$schema,
  $id: `${schemaSource.$id}/${definition}`,
  title,
  definitions: schemaSource.definitions,
  $ref: `#/definitions/${definition}`,
});

export const evidenceRegistrySchema = evidenceRegistrySchemaDocument as SchemaDocument;
export const evidenceRegistryDocumentSchema = componentSchema(evidenceRegistrySchemaDocument, "registry", "Studio Evidence Registry v1");
export const evidenceRegistryFragmentSchema = componentSchema(evidenceRegistrySchemaDocument, "fragment", "Studio Evidence Registry Fragment v1");
export const evidenceBundleSchema = evidenceBundleSchemaDocument as SchemaDocument;
export const runTraceSchema = componentSchema(runTraceSchemaDocument, "runTrace", "Studio Semantic Run Trace v1");
export const runEventSchema = componentSchema(runTraceSchemaDocument, "runEvent", "Studio Semantic Run Event v1");

const validateRegistry = compileJsonSchemaValidator<EvidenceRegistryDocument>(evidenceRegistryDocumentSchema);
const validateFragment = compileJsonSchemaValidator<EvidenceRegistryFragment>(evidenceRegistryFragmentSchema);
const validateBundle = compileJsonSchemaValidator<EvidenceBundle>(evidenceBundleSchema);
const validateTrace = compileJsonSchemaValidator<RunTrace>(runTraceSchema);
const validateEvent = compileJsonSchemaValidator<RunEvent>(runEventSchema);

export const validateEvidenceRegistrySchema = (input: unknown): ContractValidationResult<EvidenceRegistryDocument> =>
  validateWithJsonSchema(validateRegistry, input);
export const validateEvidenceRegistryFragmentSchema = (input: unknown): ContractValidationResult<EvidenceRegistryFragment> =>
  validateWithJsonSchema(validateFragment, input);
export const validateEvidenceBundleSchema = (input: unknown): ContractValidationResult<EvidenceBundle> =>
  validateWithJsonSchema(validateBundle, input);
export const validateRunTraceSchema = (input: unknown): ContractValidationResult<RunTrace> =>
  validateWithJsonSchema(validateTrace, input);
export const validateRunEventSchema = (input: unknown): ContractValidationResult<RunEvent> =>
  validateWithJsonSchema(validateEvent, input);
