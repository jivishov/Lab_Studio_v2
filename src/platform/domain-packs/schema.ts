import descriptorSchemaDocument from "./domain-pack-descriptor.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import type { DomainPackDescriptor } from "./types";

export const domainPackDescriptorSchema = descriptorSchemaDocument as Record<string, unknown>;
const validateSchema = compileJsonSchemaValidator<DomainPackDescriptor>(domainPackDescriptorSchema);

export const validateDomainPackDescriptor = (
  input: unknown,
): ContractValidationResult<DomainPackDescriptor> => validateWithJsonSchema(validateSchema, input);
