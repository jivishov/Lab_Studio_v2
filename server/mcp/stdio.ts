import { createInterface } from "node:readline";
import type { StudioMcpAdapter } from "./adapter";
import type { JsonRpcRequest } from "./types";

export const runMcpStdio = async (
  adapter: StudioMcpAdapter,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<void> => {
  const lines = createInterface({ input });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      const response = await adapter.handleJsonRpc(request);
      if (response) output.write(`${JSON.stringify(response)}\n`);
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON payload." } })}\n`);
    }
  }
};
