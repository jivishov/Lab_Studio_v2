export { resourceRunContextSchema } from "../../src/platform/planning/schema";

export const nonEmptyStringSchema = { type: "string", minLength: 1 } as const;

export const baseRequestProperties = {
  requestId: nonEmptyStringSchema,
  idempotencyKey: nonEmptyStringSchema,
} as const;

export const resultEnvelopeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema", "schemaVersion", "requestId", "tool", "status", "summary", "data",
    "diagnostics", "assumptions", "limitations", "provenance",
  ],
  properties: {
    schema: { const: "studio.mcp-tool-result" },
    schemaVersion: { const: "1.0" },
    requestId: nonEmptyStringSchema,
    tool: {
      type: "object",
      additionalProperties: false,
      required: ["name", "domainPackId", "domainPackVersion"],
      properties: {
        name: nonEmptyStringSchema,
        domainPackId: { enum: ["chemistry", "assay"] },
        domainPackVersion: nonEmptyStringSchema,
      },
    },
    status: { enum: ["ok", "incomplete"] },
    summary: nonEmptyStringSchema,
    data: { type: "object" },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "path", "message", "severity"],
        properties: {
          code: nonEmptyStringSchema,
          path: { type: "string" },
          message: nonEmptyStringSchema,
          severity: { enum: ["error", "warning"] },
        },
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    provenance: {
      type: "object",
      additionalProperties: false,
      required: ["studioCoreVersion", "capabilityManifestVersion"],
      properties: {
        studioCoreVersion: { const: "1.0.0" },
        capabilityManifestVersion: { const: "2.0" },
      },
    },
  },
} as const;

export const resultEnvelopeSchemaFor = (
  required: readonly string[],
  properties: Record<string, unknown>,
): Record<string, unknown> => ({
  ...resultEnvelopeSchema,
  properties: {
    ...resultEnvelopeSchema.properties,
    data: {
      type: "object",
      additionalProperties: false,
      required: [...required],
      properties,
    },
  },
});
