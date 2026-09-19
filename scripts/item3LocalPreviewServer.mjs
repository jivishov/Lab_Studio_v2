import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { dirname, extname, join, relative, resolve } from "node:path";

const parseArgs = (argv) => {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) values[key] = true;
    else {
      values[key] = next;
      index += 1;
    }
  }
  return values;
};

const numberArgument = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// The packaged launcher sets the working directory to the package root. Keeping
// the default rooted in cwd avoids passing a space-containing package path
// through another native command-line quoting layer.
const defaultRoot = resolve(process.cwd());

const pathsFor = (args) => {
  const root = resolve(typeof args.root === "string" ? args.root : defaultRoot);
  const stateFile = resolve(
    typeof args["state-file"] === "string" ? args["state-file"] : join(root, "logs", "preview-state.json"),
  );
  const logFile = resolve(
    typeof args["log-file"] === "string" ? args["log-file"] : join(root, "logs", "preview.log"),
  );
  return { root, stateFile, logFile };
};

const logLine = async (logFile, message) => {
  await mkdir(dirname(logFile), { recursive: true });
  await appendFile(logFile, `[${new Date().toISOString()}] ${message}\n`, "utf8");
};

const jsonResponse = (response, statusCode, value) => {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
};

const requestPort = ({ port, method = "GET", path = "/", headers = {}, body = "" }) =>
  new Promise((resolveRequest, rejectRequest) => {
    const request = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...(body ? { "content-length": Buffer.byteLength(body) } : {}),
          ...headers,
        },
        timeout: 1200,
      },
      (response) => {
        const chunks = [];
        response.setEncoding("utf8");
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolveRequest({
          statusCode: response.statusCode ?? 0,
          body: chunks.join(""),
        }));
      },
    );
    request.on("timeout", () => request.destroy(new Error("request timed out")));
    request.on("error", rejectRequest);
    if (body) request.write(body);
    request.end();
  });

const probePort = async (port) => {
  try {
    return { kind: "occupied", response: await requestPort({ port, path: "/__lab-studio/health" }) };
  } catch (error) {
    if (error?.code === "ECONNREFUSED") return { kind: "free" };
    return { kind: "unknown", error: error instanceof Error ? error.message : String(error) };
  }
};

const readBuildRecord = async (root) => {
  const content = await readFile(join(root, "_lab-studio-build.json"), "utf8");
  const record = JSON.parse(content);
  if (!record || typeof record !== "object" || typeof record.buildId !== "string") {
    throw new Error("The package build record is missing a buildId.");
  }
  return record;
};

const isInsideRoot = (root, candidate) => {
  const rootWithSeparator = root.endsWith("\\") || root.endsWith("/") ? root : `${root}${process.platform === "win32" ? "\\" : "/"}`;
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(rootWithSeparator);
};

const contentTypeFor = (filePath) => {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".webp": "image/webp",
  };
  return types[extname(filePath).toLowerCase()] ?? "application/octet-stream";
};

const safeFilePath = (root, requestPath) => {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0")) return undefined;
  const withoutLeadingSlash = decoded.replace(/^[/\\]+/, "");
  const candidate = resolve(root, withoutLeadingSlash || "index.html");
  if (!isInsideRoot(root, candidate)) return undefined;
  const relativePath = relative(root, candidate).replaceAll("\\", "/");
  if (relativePath.split("/").some((segment) => segment === "logs" || segment.startsWith("."))) return undefined;
  return candidate;
};

const serveFile = async (root, requestPath, response) => {
  const candidate = safeFilePath(root, requestPath);
  if (!candidate) {
    response.writeHead(400);
    response.end("Invalid package path.");
    return;
  }

  let filePath = candidate;
  try {
    const candidateStat = await stat(candidate);
    if (candidateStat.isDirectory()) filePath = join(candidate, "index.html");
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not a file");
  } catch {
    const acceptsHtml = !extname(candidate) && !candidate.endsWith("/");
    if (acceptsHtml) {
      filePath = join(root, "index.html");
    } else {
      response.writeHead(404);
      response.end("Not found.");
      return;
    }
  }

  const body = await readFile(filePath);
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": contentTypeFor(filePath),
    "content-length": body.byteLength,
  });
  response.end(body);
};

const shutdownRequest = ({ port, token }) =>
  requestPort({
    port,
    method: "POST",
    path: "/__lab-studio/shutdown",
    headers: { "x-lab-studio-stop-token": token },
  });

const stopServer = async (args) => {
  const { root, stateFile } = pathsFor(args);
  let state;
  try {
    state = JSON.parse(await readFile(stateFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log("Lab Studio Item 3 preview is not running.");
      return;
    }
    throw error;
  }

  if (typeof state?.port !== "number" || typeof state?.token !== "string") {
    throw new Error("The preview state file is invalid.");
  }

  try {
    const response = await shutdownRequest({ port: state.port, token: state.token });
    if (response.statusCode !== 200) throw new Error(`preview returned HTTP ${response.statusCode}`);
    console.log(`Stopped Lab Studio Item 3 preview for ${state.buildId}.`);
  } catch (error) {
    if (error?.code === "ECONNREFUSED" || /ECONNREFUSED/.test(String(error?.message))) {
      console.log("Lab Studio Item 3 preview process is already stopped.");
    } else {
      throw error;
    }
  } finally {
    await unlink(stateFile).catch(() => undefined);
  }

  await logLine(join(root, "logs", "preview-control.log"), "stop requested");
};

const startServer = async (args) => {
  const { root, stateFile, logFile } = pathsFor(args);
  const port = numberArgument(args.port, 4180);
  const expectedBuildId = typeof args["expected-build-id"] === "string" ? args["expected-build-id"] : undefined;
  const record = await readBuildRecord(root);
  if (expectedBuildId && expectedBuildId !== record.buildId) {
    throw new Error(`Build identity mismatch: launcher expected ${expectedBuildId}, package is ${record.buildId}.`);
  }

  const existing = await probePort(port);
  if (existing.kind === "occupied") {
    let health;
    try {
      health = JSON.parse(existing.response.body);
    } catch {
      health = undefined;
    }
    if (health?.app === "lab-studio" && health.buildId === record.buildId) {
      await logLine(logFile, `reused matching preview on 127.0.0.1:${port} (${record.buildId})`);
      return;
    }
    throw new Error(`Port ${port} is occupied by an unrelated service or a different Lab Studio build.`);
  }
  if (existing.kind === "unknown") throw new Error(`Could not safely inspect port ${port}: ${existing.error}`);

  const token = randomBytes(24).toString("hex");
  let closing = false;
  let server;
  const cleanup = async () => {
    await unlink(stateFile).catch(() => undefined);
    await logLine(logFile, "preview stopped").catch(() => undefined);
  };
  const closeServer = () => {
    if (closing) return;
    closing = true;
    server.close(() => {
      void cleanup().finally(() => process.exit(0));
    });
  };

  server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    if (requestUrl.pathname === "/__lab-studio/health") {
      jsonResponse(response, 200, {
        app: "lab-studio",
        buildId: record.buildId,
        featureFlags: record.featureFlags,
        pid: process.pid,
        sourceCommit: record.source.commit,
        status: "ok",
      });
      return;
    }
    if (requestUrl.pathname === "/__lab-studio/shutdown") {
      if (request.method !== "POST" || request.headers["x-lab-studio-stop-token"] !== token) {
        jsonResponse(response, 403, { error: "forbidden" });
        return;
      }
      jsonResponse(response, 200, { status: "stopping" });
      setTimeout(closeServer, 10);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end();
      return;
    }
    try {
      await serveFile(root, requestUrl.pathname, response);
    } catch (error) {
      await logLine(logFile, `request failure: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      if (!response.headersSent) response.writeHead(500);
      response.end("Preview server error.");
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", resolveListen);
  }).catch(async (error) => {
    await logLine(logFile, `listen failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Could not start the local preview on 127.0.0.1:${port}: ${error instanceof Error ? error.message : String(error)}`);
  });

  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ buildId: record.buildId, pid: process.pid, port, token }, null, 2), "utf8");
  await logLine(logFile, `preview started on http://127.0.0.1:${port}/ for ${record.buildId} (pid ${process.pid})`);
  process.once("SIGINT", closeServer);
  process.once("SIGTERM", closeServer);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.stop) await stopServer(args);
  else await startServer(args);
};

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await logLine(pathsFor(parseArgs(process.argv.slice(2))).logFile, `startup/control failure: ${message}`).catch(() => undefined);
  console.error(message);
  process.exitCode = 1;
});
