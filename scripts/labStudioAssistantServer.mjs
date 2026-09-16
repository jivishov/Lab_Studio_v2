import Ajv from "ajv";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicAssetPathForFilename, sanitizeImageFilename } from "./assistantAssetUtils.mjs";
import { createOpenAiResponseParser } from "./assistantResponseParser.mjs";
import { defaultAssistantOriginPolicy } from "./assistantServerSecurity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const modelCatalogPath = path.join(workspaceRoot, "src", "assistant", "modelCatalog.json");
const actionCatalogPath = path.join(workspaceRoot, "src", "assistant", "actionCatalog.json");
const procedureIrSchemaPath = path.join(workspaceRoot, "src", "platform", "procedure-ir", "procedure-ir.schema.json");
const assetDirectory = path.join(workspaceRoot, "public", "assets", "assistant-generated");
const manifestPath = path.join(assetDirectory, "manifest.json");
const port = Number(process.env.LAB_STUDIO_ASSISTANT_PORT ?? 8787);
const apiKey = process.env.OPENAI_API_KEY;

const studioAssistantInstructions = `You are the in-page assistant for Lab Design Studio.
Help the user operate only the current Lab Design Studio page using the provided context and function tools.
When the user asks to change settings, build workflow steps, apply templates, validate a draft, generate images, save a draft, or export content, call the best matching registered tool instead of giving manual click instructions.
Use only registered tools. Do not invent action names, DOM selectors, local file paths, file hashes, provider file IDs, secrets, or hidden runtime values.
Do not serialize local paths, hashes, vendor file IDs, or generated asset runtime details into lab JSON.
Destructive, save/export/import, full-template replacement, and image-generation actions may return a pending-confirmation result. If that happens, tell the user the action is waiting for confirmation in the assistant card.
Keep final text concise and mention the concrete actions taken or queued.`;

const readJsonFile = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const modelCatalog = await readJsonFile(modelCatalogPath);
const actionCatalog = await readJsonFile(actionCatalogPath);
const procedureIrSchema = await readJsonFile(procedureIrSchemaPath);
const modelIds = new Set(modelCatalog.map((model) => model.id));
const modelById = new Map(modelCatalog.map((model) => [model.id, model]));
const ajv = new Ajv({ allErrors: true, strict: false });

const assistantRequestSchema = {
  type: "object",
  properties: {
    pageId: { type: "string", enum: ["studio"] },
    modelId: { type: "string" },
    reasoningEffort: { type: "string", enum: ["none", "low", "medium", "high", "xhigh"] },
    previousResponseId: { type: "string", nullable: true },
    message: { type: "string", nullable: true },
    toolOutputs: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        properties: {
          callId: { type: "string" },
          name: { type: "string" },
          result: { type: "object", additionalProperties: true },
        },
        required: ["callId", "name", "result"],
        additionalProperties: false,
      },
    },
    pageContext: { type: "object", nullable: true, additionalProperties: true },
  },
  required: ["pageId", "modelId", "reasoningEffort"],
  additionalProperties: false,
};

const imageRequestSchema = {
  type: "object",
  properties: {
    prompt: { type: "string", minLength: 8 },
    filename: { type: "string", nullable: true },
    kind: { type: "string", enum: ["workflow", "equipment", "template", "experiment", "reference"] },
    draftId: { type: "string", nullable: true },
  },
  required: ["prompt", "kind"],
  additionalProperties: false,
};

const causalystCandidateRequestSchema = {
  type: "object",
  properties: {
    modelId: { type: "string" },
    reasoningEffort: { type: "string", enum: ["low", "medium", "high", "xhigh"] },
    prompt: { type: "string", minLength: 1, maxLength: 50_000 },
    approvedSourceText: { type: "string", maxLength: 200_000, nullable: true },
    domainPackRef: {
      type: "object",
      additionalProperties: false,
      required: ["id", "version"],
      properties: { id: { enum: ["chemistry", "assay"] }, version: { type: "string" } },
    },
    authoringPolicy: { type: "object", additionalProperties: true },
    attachment: {
      type: "object",
      nullable: true,
      additionalProperties: false,
      required: ["attachmentId", "name", "mimeType", "base64"],
      properties: {
        attachmentId: { type: "string", minLength: 1, maxLength: 200 },
        name: { type: "string", minLength: 1, maxLength: 200 },
        mimeType: { type: "string", minLength: 1, maxLength: 100 },
        base64: { type: "string", minLength: 1, maxLength: 14_000_000 },
      },
    },
  },
  required: ["modelId", "reasoningEffort", "prompt", "domainPackRef", "authoringPolicy"],
  additionalProperties: false,
};

const validateAssistantRequest = ajv.compile(assistantRequestSchema);
const validateImageRequest = ajv.compile(imageRequestSchema);
const validateCausalystCandidateRequest = ajv.compile(causalystCandidateRequestSchema);
const parseOpenAiResponse = createOpenAiResponseParser(actionCatalog);
const causalystRemoteFiles = new Map();

const sendJson = (request, response, status, body) => {
  response.writeHead(status, {
    ...defaultAssistantOriginPolicy.corsHeadersForOrigin(request.headers.origin),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const openAiFetch = async (url, init = {}) => {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error?.message === "string"
        ? body.error.message
        : `OpenAI request failed with ${response.status}.`;
    throw new Error(message);
  }
  return body;
};

const openAiMultipartFetch = async (url, form) => {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message ?? `OpenAI request failed with ${response.status}.`);
  return body;
};

const stagedOpenAiFileId = async (attachment) => {
  const cached = causalystRemoteFiles.get(attachment.attachmentId);
  if (cached && cached.name === attachment.name && cached.byteLength === attachment.base64.length) {
    return cached.fileId;
  }
  if (cached) {
    await openAiFetch(`https://api.openai.com/v1/files/${encodeURIComponent(cached.fileId)}`, {
      method: "DELETE",
    });
    causalystRemoteFiles.delete(attachment.attachmentId);
  }
  const stageDirectory = await mkdtemp(path.join(tmpdir(), "lab-studio-causalyst-"));
  const stagePath = path.join(stageDirectory, path.basename(attachment.name));
  try {
    const bytes = Buffer.from(attachment.base64, "base64");
    await writeFile(stagePath, bytes);
    const form = new FormData();
    form.set("purpose", "user_data");
    form.set("file", new Blob([bytes], { type: attachment.mimeType }), path.basename(attachment.name));
    const uploaded = await openAiMultipartFetch("https://api.openai.com/v1/files", form);
    if (typeof uploaded.id !== "string") throw new Error("OpenAI Files API did not return a file id.");
    causalystRemoteFiles.set(attachment.attachmentId, {
      fileId: uploaded.id,
      name: attachment.name,
      byteLength: attachment.base64.length,
    });
    return uploaded.id;
  } finally {
    await rm(stageDirectory, { recursive: true, force: true });
  }
};

const extractResponseText = (value) => {
  if (typeof value.output_text === "string") return value.output_text;
  for (const item of value.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("OpenAI response did not contain structured candidate text.");
};

const causalystCandidateInstructions = `Return exactly one studio.procedure-ir v1 JSON candidate.
The candidate is untrusted planning data, never executable JSON. Mark metadata.createdBy as host-model.
Use only the supplied domain, teacher capability policy, and approved source material.
Do not expand the palette, lower fidelity, unlock fields, change a rubric, invent scientific values,
or include local paths, file handles, hashes, credentials, provider internals, hidden reasoning,
runtime state, pointer/camera/gesture data, or executable artifacts. Keep missing or ambiguous
scientific information explicit in ambiguity and reviewFlags.`;

const handleCausalystCandidatePost = async (request, response) => {
  const body = await readBody(request);
  if (!validateCausalystCandidateRequest(body)) {
    return sendJson(request, response, 400, {
      error: ajv.errorsText(validateCausalystCandidateRequest.errors),
    });
  }
  if (!modelIds.has(body.modelId)) {
    return sendJson(request, response, 400, { error: `Unsupported model: ${body.modelId}` });
  }
  const model = modelById.get(body.modelId);
  if (!model.reasoningEfforts.includes(body.reasoningEffort)) {
    return sendJson(request, response, 400, {
      error: `${body.reasoningEffort} is not supported by ${body.modelId}.`,
    });
  }
  const fileId = body.attachment ? await stagedOpenAiFileId(body.attachment) : undefined;
  const content = [
    ...(fileId ? [{ type: "input_file", file_id: fileId }] : []),
    {
      type: "input_text",
      text: JSON.stringify({
        learnerPrompt: body.prompt,
        approvedSourceText: body.approvedSourceText,
        domainPackRef: body.domainPackRef,
        authoringPolicy: body.authoringPolicy,
      }),
    },
  ];
  const openAiResponse = await openAiFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    body: JSON.stringify({
      model: body.modelId,
      instructions: causalystCandidateInstructions,
      input: [{ role: "user", content }],
      reasoning: { effort: body.reasoningEffort },
      text: {
        format: {
          type: "json_schema",
          name: "causalyst_procedure_ir_candidate",
          strict: true,
          schema: procedureIrSchema,
        },
        verbosity: "low",
      },
      store: false,
    }),
  });
  return sendJson(request, response, 200, {
    candidate: JSON.parse(extractResponseText(openAiResponse)),
  });
};

const handleCausalystAttachmentReset = async (request, response) => {
  const body = await readBody(request);
  const attachmentId = typeof body.attachmentId === "string" ? body.attachmentId : "";
  const cached = causalystRemoteFiles.get(attachmentId);
  if (cached) {
    await openAiFetch(`https://api.openai.com/v1/files/${encodeURIComponent(cached.fileId)}`, {
      method: "DELETE",
    });
    causalystRemoteFiles.delete(attachmentId);
  }
  return sendJson(request, response, 200, { ok: true });
};

const cleanupCausalystRemoteFiles = async () => {
  const entries = [...causalystRemoteFiles.entries()];
  causalystRemoteFiles.clear();
  await Promise.allSettled(entries.map(([, cached]) =>
    openAiFetch(`https://api.openai.com/v1/files/${encodeURIComponent(cached.fileId)}`, {
      method: "DELETE",
    })));
};

const toolsForPage = (pageId) =>
  actionCatalog
    .filter((action) => action.pageId === pageId)
    .map((action) => ({
      type: "function",
      name: action.name,
      description: action.description,
      parameters: action.parameters,
      strict: true,
    }));

const buildResponseInput = (body) => {
  if (Array.isArray(body.toolOutputs) && body.toolOutputs.length > 0) {
    return body.toolOutputs.map((output) => ({
      type: "function_call_output",
      call_id: output.callId,
      output: JSON.stringify(output.result),
    }));
  }

  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Current page context:\n${JSON.stringify(body.pageContext ?? {}, null, 2)}\n\nUser request:\n${body.message ?? ""}`,
        },
      ],
    },
  ];
};

const assertInsideAssetDirectory = (candidatePath) => {
  const resolved = path.resolve(candidatePath);
  const root = path.resolve(assetDirectory);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Generated asset path escaped the assistant asset directory.");
  }
  return resolved;
};

const readManifest = async () => {
  if (!existsSync(manifestPath)) return [];
  const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
};

const writeManifestEntry = async (entry) => {
  await mkdir(assetDirectory, { recursive: true });
  const manifest = await readManifest();
  manifest.push(entry);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

const generateImage = async (body) => {
  const response = await openAiFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    body: JSON.stringify({
      model: "gpt-5.5",
      input: body.prompt,
      tools: [{ type: "image_generation" }],
    }),
  });
  const imageBase64 = Array.isArray(response.output)
    ? response.output.find((item) => item.type === "image_generation_call")?.result
    : undefined;
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    throw new Error("OpenAI did not return an image.");
  }

  await mkdir(assetDirectory, { recursive: true });
  const filename = sanitizeImageFilename(body.filename, `${body.kind}-asset`);
  const filePath = assertInsideAssetDirectory(path.join(assetDirectory, filename));
  await writeFile(filePath, Buffer.from(imageBase64, "base64"));

  const entry = {
    id: filename.replace(/\.png$/i, ""),
    filename,
    publicPath: publicAssetPathForFilename(filename),
    kind: body.kind,
    prompt: body.prompt,
    createdAt: new Date().toISOString(),
    draftId: body.draftId,
  };
  await writeManifestEntry(entry);

  return {
    id: entry.id,
    filename: entry.filename,
    publicPath: entry.publicPath,
    kind: entry.kind,
    createdAt: entry.createdAt,
  };
};

const handleResponsesPost = async (request, response) => {
  const body = await readBody(request);
  if (!validateAssistantRequest(body)) {
    return sendJson(request, response, 400, {
      error: ajv.errorsText(validateAssistantRequest.errors),
    });
  }
  if (!modelIds.has(body.modelId)) {
    return sendJson(request, response, 400, { error: `Unsupported model: ${body.modelId}` });
  }
  const model = modelById.get(body.modelId);
  if (!model.reasoningEfforts.includes(body.reasoningEffort)) {
    return sendJson(request, response, 400, {
      error: `${body.reasoningEffort} is not supported by ${body.modelId}.`,
    });
  }

  const startedAt = performance.now();
  const payload = {
    model: body.modelId,
    instructions: studioAssistantInstructions,
    input: buildResponseInput(body),
    tools: toolsForPage(body.pageId),
    parallel_tool_calls: false,
    store: true,
    reasoning: { effort: body.reasoningEffort },
    text: { verbosity: "low" },
    previous_response_id: body.previousResponseId || undefined,
    background: model.background ? true : undefined,
  };
  const openAiResponse = await openAiFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return sendJson(
    request,
    response,
    200,
    parseOpenAiResponse(openAiResponse, {
      latencyMs: performance.now() - startedAt,
      pageId: body.pageId,
    }),
  );
};

const handleResponseGet = async (request, responseId, response) => {
  const startedAt = performance.now();
  const openAiResponse = await openAiFetch(
    `https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`,
    { method: "GET" },
  );
  return sendJson(
    request,
    response,
    200,
    parseOpenAiResponse(openAiResponse, { latencyMs: performance.now() - startedAt }),
  );
};

const handleImagePost = async (request, response) => {
  const body = await readBody(request);
  if (!validateImageRequest(body)) {
    return sendJson(request, response, 400, {
      error: ajv.errorsText(validateImageRequest.errors),
    });
  }
  const result = await generateImage(body);
  return sendJson(request, response, 200, result);
};

const server = createServer((request, response) => {
  void (async () => {
    if (!defaultAssistantOriginPolicy.isAllowedAssistantOrigin(request.headers.origin)) {
      return sendJson(request, response, 403, {
        error: "Assistant server only accepts requests from localhost or explicitly allowed origins.",
      });
    }

    if (request.method === "OPTIONS") {
      response.writeHead(
        204,
        defaultAssistantOriginPolicy.corsHeadersForOrigin(request.headers.origin),
      );
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (request.method === "GET" && url.pathname === "/api/assistant/health") {
      return sendJson(request, response, 200, {
        ok: true,
        configured: Boolean(apiKey),
        models: modelCatalog.map((model) => model.id),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/assistant/responses") {
      return handleResponsesPost(request, response);
    }

    const responseMatch = url.pathname.match(/^\/api\/assistant\/responses\/([^/]+)$/);
    if (request.method === "GET" && responseMatch) {
      return handleResponseGet(request, responseMatch[1], response);
    }

    if (request.method === "POST" && url.pathname === "/api/assistant/images") {
      return handleImagePost(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/causalyst/procedure-candidates") {
      return handleCausalystCandidatePost(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/causalyst/attachments/reset") {
      return handleCausalystAttachmentReset(request, response);
    }

    return sendJson(request, response, 404, { error: "Not found." });
  })().catch((error) => {
    sendJson(request, response, 500, {
      error: error instanceof Error ? error.message : "Server error.",
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Lab Studio assistant server listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void cleanupCausalystRemoteFiles().finally(() => {
      server.close(() => process.exit(0));
    });
  });
}
