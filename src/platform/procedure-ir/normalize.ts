import { sanitizeStructuredCandidate, type JsonValue } from "./candidate";
import type { ContractDiagnostic, ContractValidationResult } from "../validation/jsonSchema";
import { validateProcedureIRSchema } from "./schema";
import type { ProcedureIR, SourceLocator } from "./types";

const decimalPattern = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/;

export const normalizeDecimalString = (value: string): string => {
  const match = decimalPattern.exec(value.trim());
  if (!match) return value.trim();
  const [, sign, integer, fraction = "", exponent] = match;
  const normalizedInteger = integer.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  const normalizedSign = sign === "-" && (normalizedInteger !== "0" || normalizedFraction !== "") ? "-" : "";
  const mantissa = normalizedFraction
    ? `${normalizedSign}${normalizedInteger}.${normalizedFraction}`
    : `${normalizedSign}${normalizedInteger}`;
  if (exponent === undefined) return mantissa;
  const numericExponent = Number(exponent);
  return numericExponent === 0 ? mantissa : `${mantissa}e${numericExponent}`;
};

const cloneLocator = (locator: SourceLocator): SourceLocator => ({
  ...locator,
  ...(locator.start ? { start: { ...locator.start } } : {}),
  ...(locator.end ? { end: { ...locator.end } } : {}),
});

const cloneJson = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)]));
};

const normalizeJson = (value: JsonValue): JsonValue => {
  if (typeof value === "string") return value.trim();
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));

  const quantityLike = typeof value.value === "string"
    && value.unit !== null
    && typeof value.unit === "object"
    && !Array.isArray(value.unit);
  return Object.fromEntries(Object.entries(value).map(([childKey, child]) => {
    if (childKey === "sourceLocators") return [childKey, cloneJson(child)];
    if (quantityLike && (childKey === "value" || childKey === "uncertainty") && typeof child === "string") {
      return [childKey, normalizeDecimalString(child)];
    }
    return [childKey, normalizeJson(child)];
  })) as JsonValue;
};

export const normalizeProcedureIR = (procedure: ProcedureIR): ProcedureIR => {
  const normalized = normalizeJson(procedure as unknown as JsonValue) as unknown as ProcedureIR;
  return {
    ...normalized,
    steps: normalized.steps.map((step, index) => ({
      ...step,
      // Structured source order and locator values are provenance and never normalized away.
      sourceLocators: procedure.steps[index].sourceLocators.map(cloneLocator),
    })),
  };
};

const candidateOriginDiagnostic = (): ContractDiagnostic => ({
  code: "candidate.origin.host-model",
  path: "/metadata/createdBy",
  message: "Host-model candidates must be marked with metadata.createdBy = host-model.",
  severity: "error",
});

export const normalizeProcedureIRCandidate = (
  input: unknown,
): ContractValidationResult<ProcedureIR> => {
  const sanitized = sanitizeStructuredCandidate(input);
  if (!sanitized.ok) return sanitized;
  const normalized = normalizeJson(sanitized.value);
  const validation = validateProcedureIRSchema(normalized);
  if (!validation.ok) return validation;
  return { ok: true, value: normalizeProcedureIR(validation.value), diagnostics: [] };
};

export const normalizeHostModelProcedureIRCandidate = (
  input: unknown,
): ContractValidationResult<ProcedureIR> => {
  const result = normalizeProcedureIRCandidate(input);
  if (!result.ok) return result;
  if (result.value.metadata.createdBy !== "host-model") {
    return { ok: false, diagnostics: [candidateOriginDiagnostic()] };
  }
  return result;
};
