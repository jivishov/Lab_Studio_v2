import resourceRunPlanSchemaDocument from "./resource-run-plan.schema.json";
import resourceSpecSchemaDocument from "./resource-spec.schema.json";
import resourceRunContextSchemaDocument from "./resource-run-context.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import type { ResourceRunContext, ResourceRunPlan, ResourceSpec } from "./types";

export const resourceRunPlanSchema = resourceRunPlanSchemaDocument as Record<string, unknown>;
export const resourceSpecSchema = resourceSpecSchemaDocument as Record<string, unknown>;
export const resourceRunContextSchema = resourceRunContextSchemaDocument as Record<string, unknown>;
const validateSchema = compileJsonSchemaValidator<ResourceRunPlan>(resourceRunPlanSchema);
const validateSpecSchema = compileJsonSchemaValidator<ResourceSpec>(resourceSpecSchema);
const validateContextSchema = compileJsonSchemaValidator<ResourceRunContext>(resourceRunContextSchema);

export const validateResourceRunPlan = (
  input: unknown,
): ContractValidationResult<ResourceRunPlan> => validateWithJsonSchema(validateSchema, input);

export const validateResourceSpec = (
  input: unknown,
): ContractValidationResult<ResourceSpec> => validateWithJsonSchema(validateSpecSchema, input);

export const validateResourceRunContext = (
  input: unknown,
): ContractValidationResult<ResourceRunContext> => validateWithJsonSchema(validateContextSchema, input);
