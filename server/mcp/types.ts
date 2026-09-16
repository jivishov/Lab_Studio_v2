import type { ContractDiagnostic } from "../../src/platform/validation/jsonSchema";

export const studioMcpResultSchemaId = "studio.mcp-tool-result" as const;
export const studioMcpResultSchemaVersion = "1.0" as const;

export interface StudioMcpResultEnvelope<TData extends object = Record<string, unknown>> {
  schema: typeof studioMcpResultSchemaId;
  schemaVersion: typeof studioMcpResultSchemaVersion;
  requestId: string;
  tool: {
    name: string;
    domainPackId: "chemistry" | "assay";
    domainPackVersion: string;
  };
  status: "ok" | "incomplete";
  summary: string;
  data: TData;
  diagnostics: ContractDiagnostic[];
  assumptions: string[];
  limitations: string[];
  provenance: {
    studioCoreVersion: "1.0.0";
    capabilityManifestVersion: "2.0";
  };
}

export interface DomainServiceOutcome<TData extends object = Record<string, unknown>> {
  status: "ok" | "incomplete";
  summary: string;
  data: TData;
  diagnostics?: ContractDiagnostic[];
  assumptions?: string[];
  limitations?: string[];
}

export interface RegisteredMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: true;
    destructiveHint: false;
    idempotentHint: true;
    openWorldHint: false;
  };
  domainPackId: "chemistry" | "assay";
  domainPackVersion: string;
  invoke(input: unknown): Promise<StudioMcpResultEnvelope>;
}

export interface DomainToolContract {
  suffix: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  invoke(input: Record<string, unknown>): Promise<DomainServiceOutcome> | DomainServiceOutcome;
}

export interface RegisterDomainToolsInput {
  namespace: "labstudio" | "assaystudio";
  domainPackId: "chemistry" | "assay";
  domainPackVersion: string;
  contracts: readonly DomainToolContract[];
}

export interface McpObservabilityRecord {
  requestId: string;
  method: string;
  toolName?: string;
  status: "ok" | "error";
  code?: string;
  durationMs: number;
}

export interface McpAdapterOptions {
  maxPayloadBytes?: number;
  maxExecutionMs?: number;
  maxIdempotencyEntries?: number;
  allowedOrigins?: readonly string[];
  observe?: (record: McpObservabilityRecord) => void;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
