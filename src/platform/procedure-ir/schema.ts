import procedureIRSchemaDocument from "./procedure-ir.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import type { ProcedureIR } from "./types";

type JsonSchemaDocument = Record<string, unknown>;

export const procedureIRSchema = procedureIRSchemaDocument as JsonSchemaDocument;

const componentSchema = (definition: string, title: string): JsonSchemaDocument => ({
  $schema: procedureIRSchemaDocument.$schema,
  $id: `${procedureIRSchemaDocument.$id}/${definition}`,
  title,
  definitions: procedureIRSchemaDocument.definitions,
  $ref: `#/definitions/${definition}`,
});

export const quantityIRSchema = componentSchema("quantity", "ProcedureIR Quantity v1");
export const sourceLocatorSchema = componentSchema("sourceLocator", "ProcedureIR Source Locator v1");
export const procedureRoleSchema = componentSchema("procedureRole", "ProcedureIR Role v1");
export const procedureResourceSchema = componentSchema("procedureResource", "ProcedureIR Resource v1");
export const procedureVariableSchema = componentSchema("procedureVariable", "ProcedureIR Variable v1");
export const ambiguityIRSchema = componentSchema("ambiguity", "ProcedureIR Ambiguity v1");
export const evidenceRequirementIRSchema = componentSchema(
  "evidenceRequirement",
  "ProcedureIR Evidence Requirement v1",
);
export const reviewFlagSchema = componentSchema("reviewFlag", "ProcedureIR Review Flag v1");

const validateSchema = compileJsonSchemaValidator<ProcedureIR>(procedureIRSchema);

export const validateProcedureIRSchema = (
  input: unknown,
): ContractValidationResult<ProcedureIR> => validateWithJsonSchema(validateSchema, input);
