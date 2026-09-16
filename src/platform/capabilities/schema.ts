import capabilityManifestSchemaDocument from "./capability-manifest.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import type { CapabilityManifest, CapabilityManifestFragment } from "./types";

type SchemaDocument = Record<string, unknown>;

export const capabilityManifestSchema = capabilityManifestSchemaDocument as SchemaDocument;

const componentSchema = (definition: "manifest" | "fragment", title: string): SchemaDocument => ({
  $schema: capabilityManifestSchemaDocument.$schema,
  $id: `${capabilityManifestSchemaDocument.$id}/${definition}`,
  title,
  definitions: capabilityManifestSchemaDocument.definitions,
  $ref: `#/definitions/${definition}`,
});

export const capabilityManifestDocumentSchema = componentSchema("manifest", "Studio Capability Manifest v2");
export const capabilityManifestFragmentSchema = componentSchema("fragment", "Studio Capability Manifest Fragment v2");

const validateManifest = compileJsonSchemaValidator<CapabilityManifest>(capabilityManifestDocumentSchema);
const validateFragment = compileJsonSchemaValidator<CapabilityManifestFragment>(capabilityManifestFragmentSchema);

export const validateCapabilityManifestSchema = (
  input: unknown,
): ContractValidationResult<CapabilityManifest> => validateWithJsonSchema(validateManifest, input);

export const validateCapabilityManifestFragmentSchema = (
  input: unknown,
): ContractValidationResult<CapabilityManifestFragment> => validateWithJsonSchema(validateFragment, input);
