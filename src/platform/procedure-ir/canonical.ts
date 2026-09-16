import { sanitizeStructuredCandidate, type JsonValue } from "./candidate";
import { validateProcedureIR } from "./validation";
import type { ProcedureIR } from "./types";

const sortJson = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortJson);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
};

export const canonicalSerializeJson = (value: unknown): string => {
  const sanitized = sanitizeStructuredCandidate(value);
  if (!sanitized.ok) {
    throw new Error(sanitized.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  }
  return `${JSON.stringify(sortJson(sanitized.value), null, 2)}\n`;
};

export const serializeProcedureIR = (procedure: ProcedureIR): string => {
  const validation = validateProcedureIR(procedure);
  if (!validation.ok) {
    throw new Error(validation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  }
  return canonicalSerializeJson(validation.value);
};

export const parseProcedureIR = (serialized: string): ProcedureIR => {
  const input: unknown = JSON.parse(serialized);
  const validation = validateProcedureIR(input);
  if (!validation.ok) {
    throw new Error(validation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  }
  return validation.value;
};
