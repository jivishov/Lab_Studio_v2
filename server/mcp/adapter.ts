import { findForbiddenArtifactData } from "../../src/platform/artifacts/security";
import { registerDomainTools } from "./domainRegistration";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpAdapterOptions,
  RegisterDomainToolsInput,
  RegisteredMcpTool,
} from "./types";

export const supportedMcpProtocolVersions = ["2025-11-25", "2025-06-18"] as const;

export class McpAdapterError extends Error {
  constructor(
    public readonly adapterCode: string,
    message: string,
    public readonly rpcCode = -32000,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "McpAdapterError";
  }
}

const sortJson = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortJson);
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [
    key,
    sortJson((value as Record<string, unknown>)[key]),
  ]));
};
const stableJson = (value: unknown): string => JSON.stringify(sortJson(value));
const payloadBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;

interface CachedCall {
  fingerprint: string;
  value: unknown;
}

const isLocalOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]");
  } catch {
    return false;
  }
};

export class StudioMcpAdapter {
  private readonly tools: Map<string, RegisteredMcpTool>;
  private readonly cache = new Map<string, CachedCall>();
  readonly maxPayloadBytes: number;
  readonly maxExecutionMs: number;
  private readonly maxIdempotencyEntries: number;
  private readonly allowedOrigins: Set<string>;
  private readonly observe: NonNullable<McpAdapterOptions["observe"]>;

  constructor(registrations: readonly RegisterDomainToolsInput[], options: McpAdapterOptions = {}) {
    const tools = registrations.flatMap(registerDomainTools);
    if (new Set(tools.map(({ name }) => name)).size !== tools.length) {
      throw new Error("MCP tool names must be unique across domain registrations.");
    }
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
    this.maxPayloadBytes = options.maxPayloadBytes ?? 1_048_576;
    this.maxExecutionMs = options.maxExecutionMs ?? 5_000;
    this.maxIdempotencyEntries = options.maxIdempotencyEntries ?? 128;
    this.allowedOrigins = new Set(options.allowedOrigins ?? []);
    this.observe = options.observe ?? (() => undefined);
  }

  isOriginAllowed(origin: string | undefined): boolean {
    return origin === undefined || isLocalOrigin(origin) || this.allowedOrigins.has(origin);
  }

  listTools(): Array<Omit<RegisteredMcpTool, "invoke" | "domainPackId" | "domainPackVersion">> {
    return [...this.tools.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ name, title, description, inputSchema, outputSchema, annotations }) => ({
        name,
        title,
        description,
        inputSchema,
        outputSchema,
        annotations,
      }));
  }

  private async withinTimeLimit<T>(operation: Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new McpAdapterError(
            "execution_timeout",
            "Tool execution exceeded the configured time limit.",
            -32008,
          )), this.maxExecutionMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async callTool(
    name: string,
    input: unknown,
    metadata: { origin?: string } = {},
  ): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: unknown; isError: false }> {
    const started = Date.now();
    const requestId = input && typeof input === "object" && typeof (input as Record<string, unknown>).requestId === "string"
      ? String((input as Record<string, unknown>).requestId)
      : "unknown-request";
    try {
      if (!this.isOriginAllowed(metadata.origin)) throw new McpAdapterError(
        "origin_not_allowed",
        "Request origin is not allowed.",
        -32002,
      );
      if (payloadBytes(input) > this.maxPayloadBytes) throw new McpAdapterError(
        "payload_too_large",
        "Tool payload exceeds the configured byte limit.",
        -32001,
      );
      const tool = this.tools.get(name);
      if (!tool) throw new McpAdapterError("tool_not_found", `Unknown tool: ${name}`, -32602);
      const idempotencyKey = input && typeof input === "object" && typeof (input as Record<string, unknown>).idempotencyKey === "string"
        ? String((input as Record<string, unknown>).idempotencyKey)
        : undefined;
      const fingerprint = stableJson({ name, input });
      if (idempotencyKey) {
        const cached = this.cache.get(idempotencyKey);
        if (cached && cached.fingerprint !== fingerprint) throw new McpAdapterError(
          "idempotency_conflict",
          "The idempotency key was already used with different tool input.",
          -32009,
        );
        if (cached) return structuredClone(cached.value) as Awaited<ReturnType<StudioMcpAdapter["callTool"]>>;
      }
      const envelope = await this.withinTimeLimit(tool.invoke(input));
      if (payloadBytes(envelope) > this.maxPayloadBytes) throw new McpAdapterError(
        "response_too_large",
        "Tool output exceeds the configured byte limit.",
        -32011,
      );
      const leaks = findForbiddenArtifactData(envelope);
      if (leaks.length > 0) throw new McpAdapterError(
        "forbidden_output",
        "Tool output contained forbidden runtime or provider data.",
        -32010,
        leaks.map(({ code, path }) => ({ code, path })),
      );
      const value = {
        content: [{ type: "text" as const, text: envelope.summary }],
        structuredContent: envelope,
        isError: false as const,
      };
      if (idempotencyKey) {
        if (this.cache.size >= this.maxIdempotencyEntries) {
          const oldest = this.cache.keys().next().value as string | undefined;
          if (oldest) this.cache.delete(oldest);
        }
        this.cache.set(idempotencyKey, { fingerprint, value: structuredClone(value) });
      }
      this.observe({ requestId, method: "tools/call", toolName: name, status: "ok", durationMs: Date.now() - started });
      return value;
    } catch (error) {
      const code = error instanceof McpAdapterError
        ? error.adapterCode
        : (error as Error & { code?: string })?.code ?? "internal_error";
      this.observe({ requestId, method: "tools/call", toolName: name, status: "error", code, durationMs: Date.now() - started });
      throw error;
    }
  }

  async handleJsonRpc(
    request: JsonRpcRequest,
    metadata: { origin?: string } = {},
  ): Promise<JsonRpcResponse | undefined> {
    const id = request.id ?? null;
    if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") return {
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid JSON-RPC request." },
    };
    try {
      if (request.method === "notifications/initialized") return undefined;
      if (request.method === "ping") return { jsonrpc: "2.0", id, result: {} };
      if (request.method === "initialize") {
        const requested = request.params && typeof request.params === "object"
          ? (request.params as Record<string, unknown>).protocolVersion
          : undefined;
        const protocolVersion = typeof requested === "string" && supportedMcpProtocolVersions.includes(requested as typeof supportedMcpProtocolVersions[number])
          ? requested
          : supportedMcpProtocolVersions[0];
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "lab-studio-mcp", version: "1.0.0" },
            instructions: "Use tools for deterministic chemistry and bounded 96-well assay capability search, assessment, composition, validation, planning, and reviewed observation mapping. No durable drafts, purchases, assignments, clinical decisions, or student data are stored.",
          },
        };
      }
      if (request.method === "tools/list") return {
        jsonrpc: "2.0",
        id,
        result: { tools: this.listTools() },
      };
      if (request.method === "tools/call") {
        if (!request.params || typeof request.params !== "object") throw new McpAdapterError("invalid_params", "tools/call params are required.", -32602);
        const params = request.params as Record<string, unknown>;
        if (typeof params.name !== "string") throw new McpAdapterError("invalid_params", "tools/call name is required.", -32602);
        return {
          jsonrpc: "2.0",
          id,
          result: await this.callTool(params.name, params.arguments ?? {}, metadata),
        };
      }
      throw new McpAdapterError("method_not_found", `Method not found: ${request.method}`, -32601);
    } catch (error) {
      const adapterError = error instanceof McpAdapterError
        ? error
        : new McpAdapterError(
            (error as Error & { code?: string })?.code ?? "internal_error",
            error instanceof Error ? error.message : "Internal MCP error.",
            (error as Error & { code?: string })?.code === "invalid_tool_input" ? -32602 : -32603,
            (error as Error & { details?: unknown })?.details,
          );
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: adapterError.rpcCode,
          message: adapterError.message,
          data: {
            code: adapterError.adapterCode,
            ...(adapterError.details ? { details: adapterError.details } : {}),
          },
        },
      };
    }
  }
}

export const createStudioMcpAdapter = (
  registrations: readonly RegisterDomainToolsInput[],
  options: McpAdapterOptions = {},
): StudioMcpAdapter => new StudioMcpAdapter(registrations, options);
