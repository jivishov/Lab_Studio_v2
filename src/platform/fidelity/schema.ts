import fidelityAssessmentSchemaDocument from "./fidelity-assessment.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import type { AggregateSupportClassification } from "./types";

export const fidelityAssessmentSchema = fidelityAssessmentSchemaDocument as Record<string, unknown>;

const validateSchema = compileJsonSchemaValidator<AggregateSupportClassification>(fidelityAssessmentSchema);

export const validateFidelityAssessment = (
  input: unknown,
): ContractValidationResult<AggregateSupportClassification> => validateWithJsonSchema(validateSchema, input);
