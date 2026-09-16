import { pathToFileURL } from "node:url";
import { createLabStudioMcpAdapter } from "./index";
import { listenMcpHttpServer } from "./http";
import { runMcpStdio } from "./stdio";

const allowedOrigins = (process.env.LAB_STUDIO_MCP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const startLabStudioMcp = async (): Promise<void> => {
  const adapter = createLabStudioMcpAdapter({
    allowedOrigins,
    observe: (record) => process.stderr.write(`${JSON.stringify(record)}\n`),
  });
  if (process.argv.includes("--stdio")) {
    await runMcpStdio(adapter);
    return;
  }
  const parsedPort = Number(process.env.LAB_STUDIO_MCP_PORT ?? "8787");
  const port = Number.isSafeInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8787;
  const { url } = await listenMcpHttpServer(adapter, { port });
  process.stderr.write(`${JSON.stringify({ event: "mcp.started", transport: "streamable-http", url })}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLabStudioMcp().catch((error) => {
    process.stderr.write(`${JSON.stringify({ event: "mcp.failed", message: error instanceof Error ? error.message : "Unknown error" })}\n`);
    process.exitCode = 1;
  });
}
