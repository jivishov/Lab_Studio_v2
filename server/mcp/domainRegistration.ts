import { compileJsonSchemaValidator } from "../../src/platform/validation/jsonSchema";
import { resultEnvelopeSchema } from "./schemas";
import type {
  RegisterDomainToolsInput,
  RegisteredMcpTool,
  StudioMcpResultEnvelope,
} from "./types";

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const registerDomainTools = (
  input: RegisterDomainToolsInput,
): RegisteredMcpTool[] => input.contracts.map((contract) => {
  const name = `${input.namespace}.${contract.suffix}`;
  const validateInput = compileJsonSchemaValidator<Record<string, unknown>>(contract.inputSchema);
  const validateOutput = compileJsonSchemaValidator<StudioMcpResultEnvelope>(contract.outputSchema);
  return {
    name,
    title: contract.title,
    description: contract.description,
    inputSchema: contract.inputSchema,
    outputSchema: contract.outputSchema,
    annotations,
    domainPackId: input.domainPackId,
    domainPackVersion: input.domainPackVersion,
    invoke: async (rawInput: unknown): Promise<StudioMcpResultEnvelope> => {
      if (!validateInput(rawInput)) {
        const error = new Error("Tool input failed its strict JSON Schema.") as Error & { code?: string; details?: unknown };
        error.code = "invalid_tool_input";
        error.details = validateInput.errors;
        throw error;
      }
      const requestId = String(rawInput.requestId);
      const outcome = await contract.invoke(rawInput);
      const envelope: StudioMcpResultEnvelope = {
        schema: "studio.mcp-tool-result",
        schemaVersion: "1.0",
        requestId,
        tool: {
          name,
          domainPackId: input.domainPackId,
          domainPackVersion: input.domainPackVersion,
        },
        status: outcome.status,
        summary: outcome.summary,
        data: outcome.data,
        diagnostics: outcome.diagnostics ?? [],
        assumptions: [...(outcome.assumptions ?? [])].sort(),
        limitations: [...(outcome.limitations ?? [])].sort(),
        provenance: { studioCoreVersion: "1.0.0", capabilityManifestVersion: "2.0" },
      };
      if (!validateOutput(envelope)) {
        const error = new Error("Tool output failed its strict JSON Schema.") as Error & { code?: string; details?: unknown };
        error.code = "invalid_tool_output";
        error.details = validateOutput.errors;
        throw error;
      }
      return envelope;
    },
  };
});

export const defaultResultEnvelopeSchema = resultEnvelopeSchema;
