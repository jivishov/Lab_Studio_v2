import { describe, expect, it } from "vitest";
import validFixture from "../__fixtures__/valid-procedure-ir.v1.json";
import invalidFixture from "../__fixtures__/invalid-procedure-ir.v1.json";
import {
  ambiguityIRSchema,
  evidenceRequirementIRSchema,
  procedureIRSchema,
  procedureResourceSchema,
  procedureRoleSchema,
  procedureVariableSchema,
  quantityIRSchema,
  reviewFlagSchema,
  sourceLocatorSchema,
} from "../schema";
import {
  normalizeHostModelProcedureIRCandidate,
  normalizeProcedureIRCandidate,
} from "../normalize";
import {
  canonicalSerializeJson,
  parseProcedureIR,
  serializeProcedureIR,
} from "../canonical";
import { sanitizeStructuredCandidate } from "../candidate";
import { validateProcedureIR } from "../validation";
import type { JsonValue } from "../candidate";
import type { ProcedureIR } from "../types";
import { compileJsonSchemaValidator, validateWithJsonSchema } from "../../validation/jsonSchema";

const validProcedure = validFixture as unknown as ProcedureIR;

const reverseObjectKeys = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]),
  );
};

describe("ProcedureIR v1", () => {
  it("publishes versioned root and component JSON Schemas", () => {
    expect(procedureIRSchema.$id).toBe("https://lab-studio.local/schemas/studio.procedure-ir/1.0");
    for (const schema of [
      quantityIRSchema,
      sourceLocatorSchema,
      procedureRoleSchema,
      procedureResourceSchema,
      procedureVariableSchema,
      ambiguityIRSchema,
      evidenceRequirementIRSchema,
      reviewFlagSchema,
    ]) {
      expect(schema.$id).toContain("/1.0/");
      expect(schema.$ref).toMatch(/^#\/definitions\//);
    }
  });

  it("validates positive and negative values through every component schema", () => {
    const examples: Array<[object, unknown]> = [
      [quantityIRSchema, validProcedure.resources[0].quantity],
      [sourceLocatorSchema, validProcedure.steps[0].sourceLocators[0]],
      [procedureRoleSchema, validProcedure.roles[0]],
      [procedureResourceSchema, validProcedure.resources[0]],
      [procedureVariableSchema, validProcedure.variables[0]],
      [ambiguityIRSchema, validProcedure.steps[0].ambiguity[0]],
      [evidenceRequirementIRSchema, validProcedure.steps[0].evidenceRequirements[0]],
      [reviewFlagSchema, validProcedure.resources[1].reviewFlags[0]],
    ];
    for (const [schema, example] of examples) {
      const validator = compileJsonSchemaValidator<unknown>(schema);
      expect(validateWithJsonSchema(validator, example).ok).toBe(true);
      expect(validateWithJsonSchema(validator, {}).ok).toBe(false);
    }
  });

  it("validates the positive fixture while retaining explicit unknowns and review categories", () => {
    const result = validateProcedureIR(validProcedure);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources.find(({ id }) => id === "transfer-tool")).toMatchObject({
      kind: "unknown",
      unknownResource: { raw: "small transfer tool" },
    });
    expect(result.value.variables.find(({ id }) => id === "drop-unit")?.unit).toEqual({
      kind: "unknown",
      raw: "drops",
      reason: "Drop volume is not defined by the source.",
    });
    expect(result.review?.missingData.map(({ id }) => id)).toEqual(["transfer-tool-ambiguity"]);
    expect(result.review?.unsupportedSemantics).toEqual([]);
  });

  it("preserves structured step order and every source locator during deterministic normalization", () => {
    const sourceLocators = validProcedure.steps.map(({ sourceLocators }) => structuredClone(sourceLocators));
    const result = normalizeProcedureIRCandidate(validProcedure);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps.map(({ id }) => id)).toEqual(["measure-sample", "observe-sample"]);
    expect(result.value.steps.map(({ sourceLocators: locators }) => locators)).toEqual(sourceLocators);
    expect(result.value.steps[0].normalizedOperation?.parameters.volume).toEqual({
      value: "10",
      unit: { kind: "known", id: "mL" },
    });
    expect(validProcedure.steps[0].normalizedOperation?.parameters.volume).toMatchObject({ value: "10.00" });
  });

  it("canonicalizes object keys without reordering arrays and round-trips exactly", () => {
    const normalized = normalizeProcedureIRCandidate(validProcedure);
    const reversed = normalizeProcedureIRCandidate(
      reverseObjectKeys(structuredClone(validProcedure) as unknown as JsonValue),
    );
    expect(normalized.ok).toBe(true);
    expect(reversed.ok).toBe(true);
    if (!normalized.ok || !reversed.ok) return;
    const first = serializeProcedureIR(normalized.value);
    const second = serializeProcedureIR(reversed.value);
    expect(second).toBe(first);
    expect(first.endsWith("\n")).toBe(true);
    expect(parseProcedureIR(first)).toEqual(normalized.value);
    expect(serializeProcedureIR(parseProcedureIR(first))).toBe(first);
  });

  it("rejects negative schema and version fixtures with stable codes and JSON-pointer paths", () => {
    const invalid = validateProcedureIR(invalidFixture);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "schema.const", path: "/schemaVersion" }),
      expect.objectContaining({ code: "schema.minItems", path: "/steps" }),
    ]));

    const numericQuantity = structuredClone(validProcedure) as unknown as Record<string, unknown>;
    ((numericQuantity.resources as Array<Record<string, unknown>>)[0].quantity as Record<string, unknown>).value = 10;
    const quantityResult = validateProcedureIR(numericQuantity);
    expect(quantityResult.ok).toBe(false);
    if (!quantityResult.ok) {
      expect(quantityResult.diagnostics.some(({ path }) => path.includes("/resources/0/quantity/value"))).toBe(true);
    }
  });

  it("requires host-model provenance at the candidate boundary", () => {
    const accepted = normalizeHostModelProcedureIRCandidate(validProcedure);
    expect(accepted.ok).toBe(true);
    const mislabeled = structuredClone(validProcedure);
    mislabeled.metadata.createdBy = "user";
    const rejected = normalizeHostModelProcedureIRCandidate(mislabeled);
    expect(rejected).toMatchObject({
      ok: false,
      diagnostics: [{ code: "candidate.origin.host-model", path: "/metadata/createdBy" }],
    });
  });

  it.each([
    ["local path value", { ...validProcedure, purpose: "C:\\private\\procedure.txt" }, "candidate.forbidden.local-path"],
    ["provider file id", { ...validProcedure, provider_file_id: "file-secret" }, "candidate.forbidden.provider-internal"],
    ["credential value", { ...validProcedure, purpose: "sk-1234567890abcdef" }, "candidate.forbidden.credential"],
    ["runtime payload", { ...validProcedure, runtimeState: { currentNodeId: "start" } }, "candidate.forbidden.executable-payload"],
    ["executable handler", { ...validProcedure, handler: () => true }, "candidate.forbidden.executable-payload"],
    ["prototype pollution", JSON.parse('{"__proto__":{"polluted":true}}'), "candidate.forbidden.prototype-pollution"],
  ])("rejects %s", (_name, candidate, code) => {
    const result = sanitizeStructuredCandidate(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics.some((item) => item.code === code)).toBe(true);
  });

  it("rejects non-JSON functions even when their field name is otherwise ordinary", () => {
    const result = sanitizeStructuredCandidate({ ...validProcedure, title: () => "unsafe" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "candidate.non-json.value",
      path: "/title",
    }));
  });

  it("does not canonicalize forbidden candidates", () => {
    expect(() => canonicalSerializeJson({ safe: true, localPath: "C:\\private\\input.pdf" }))
      .toThrow("candidate.forbidden.local-path");
  });
});
