import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { StudioMcpAdapter } from "./adapter";
import type { JsonRpcRequest } from "./types";

const json = (response: ServerResponse, status: number, body: unknown): void => {
  const content = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(content)),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(content);
};

const readBoundedBody = async (request: IncomingMessage, maximumBytes: number): Promise<string> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maximumBytes) throw new Error("payload_too_large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const createMcpHttpServer = (adapter: StudioMcpAdapter) => createServer(async (request, response) => {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
  if (!adapter.isOriginAllowed(origin)) {
    json(response, 403, { error: { code: "origin_not_allowed", message: "Request origin is not allowed." } });
    return;
  }
  if (request.url !== "/mcp") {
    json(response, 404, { error: { code: "not_found", message: "Route not found." } });
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, accept",
      ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    });
    response.end();
    return;
  }
  if (request.method !== "POST") {
    json(response, 405, { error: { code: "method_not_allowed", message: "Only POST is supported by this stateless MCP endpoint." } });
    return;
  }
  if (!String(request.headers["content-type"] ?? "").toLowerCase().includes("application/json")) {
    json(response, 415, { error: { code: "unsupported_media_type", message: "Content-Type must be application/json." } });
    return;
  }
  try {
    const raw = await readBoundedBody(request, adapter.maxPayloadBytes);
    const payload: unknown = JSON.parse(raw);
    if (Array.isArray(payload) || !payload || typeof payload !== "object") {
      json(response, 400, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "JSON-RPC batches are not supported." } });
      return;
    }
    const result = await adapter.handleJsonRpc(payload as JsonRpcRequest, { origin });
    if (!result) {
      response.writeHead(202, { "cache-control": "no-store" });
      response.end();
      return;
    }
    if (origin) response.setHeader("access-control-allow-origin", origin);
    json(response, 200, result);
  } catch (error) {
    if (error instanceof Error && error.message === "payload_too_large") {
      json(response, 413, { error: { code: "payload_too_large", message: "Request body exceeds the configured byte limit." } });
      return;
    }
    json(response, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON payload." } });
  }
});

export const listenMcpHttpServer = async (
  adapter: StudioMcpAdapter,
  options: { host?: string; port?: number } = {},
): Promise<{ server: ReturnType<typeof createMcpHttpServer>; url: string }> => {
  const server = createMcpHttpServer(adapter);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return { server, url: `http://${address.address}:${address.port}/mcp` };
};
