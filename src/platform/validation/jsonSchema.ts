import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";

export interface ContractDiagnostic {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export type ContractValidationResult<T> =
  | { ok: true; value: T; diagnostics: ContractDiagnostic[] }
  | { ok: false; diagnostics: ContractDiagnostic[] };

const pointerToken = (value: string): string => value.replace(/~/g, "~0").replace(/\//g, "~1");

const diagnosticPath = (error: ErrorObject): string => {
  const base = error.instancePath || "";
  if (error.keyword === "required") {
    return `${base}/${pointerToken(String(error.params.missingProperty))}` || "/";
  }
  if (error.keyword === "additionalProperties") {
    return `${base}/${pointerToken(String(error.params.additionalProperty))}` || "/";
  }
  return base || "/";
};

export const schemaErrorsToDiagnostics = (
  errors: ErrorObject[] | null | undefined,
): ContractDiagnostic[] => (errors ?? [])
  .map((error) => ({
    code: `schema.${error.keyword}`,
    path: diagnosticPath(error),
    message: error.message ?? `Failed ${error.keyword} validation.`,
    severity: "error" as const,
  }))
  .sort((left, right) =>
    left.path.localeCompare(right.path)
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message));

export const compileJsonSchemaValidator = <T>(schema: object): ValidateFunction<T> => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile<T>(schema);
};

export const validateWithJsonSchema = <T>(
  validator: ValidateFunction<T>,
  input: unknown,
): ContractValidationResult<T> => validator(input)
  ? { ok: true, value: input, diagnostics: [] }
  : { ok: false, diagnostics: schemaErrorsToDiagnostics(validator.errors) };
