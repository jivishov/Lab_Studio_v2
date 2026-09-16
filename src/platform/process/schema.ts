import processGraphSchemaDocument from "./process-graph.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import type { PlatformProcessGraph } from "./types";

export const platformProcessGraphSchema = processGraphSchemaDocument as Record<string, unknown>;

const validateSchema = compileJsonSchemaValidator<PlatformProcessGraph>(platformProcessGraphSchema);

export const validatePlatformProcessGraphSchema = (
  input: unknown,
): ContractValidationResult<PlatformProcessGraph> => validateWithJsonSchema(validateSchema, input);
