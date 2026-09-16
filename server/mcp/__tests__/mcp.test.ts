import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { demoLab } from "../../../src/domain/fixtures";
import type { ProcedureIR } from "../../../src/platform/procedure-ir/types";
import goldenProcedureJson from "../../../src/domain-packs/chemistry/__fixtures__/chemistry-compose-procedure.v1.json";
import { createStudioMcpAdapter, McpAdapterError } from "../adapter";
import {
  chemistryDomainServices,
  chemistryMcpDomainRegistration,
  type AssessProcedureInput,
  type ComposeDraftInput,
  type PlanClassRunInput,
  type SearchCapabilitiesInput,
  type ValidateArtifactInput,
} from "../chemistryServices";
import { listenMcpHttpServer } from "../http";
import { createLabStudioMcpAdapter } from "../index";
import { baseRequestProperties, resultEnvelopeSchema } from "../schemas";
import type { RegisterDomainToolsInput, StudioMcpResultEnvelope } from "../types";

const goldenProcedure = goldenProcedureJson as unknown as ProcedureIR;
const constraints = {
  requiredOperationRefs: ["measureVolume", "observe", "calculate"],
  allowedOperationRefs: ["measureVolume", "observe", "calculate"],
  maximumSteps: 3,
};
const runContext = {
  requestId: "mcp-plan",
  participants: 8,
  grouping: { kind: "group-size" as const, groupSize: 2 },
  sections: [{ id: "section-a", participantCount: 8 }],
  repeats: 1,
  technicalReplicates: 1,
  stations: [],
  availableInventory: [],
  instrumentCapacities: [],
};
const servers: Array<Awaited<ReturnType<typeof listenMcpHttpServer>>["server"]> = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

const structured = async (name: string, input: Record<string, unknown>): Promise<StudioMcpResultEnvelope> => {
  const response = await createLabStudioMcpAdapter().callTool(name, input);
  return response.structuredContent as StudioMcpResultEnvelope;
};

describe("domain-scoped MCP protocol and chemistry contracts", () => {
  it("initializes and lists the five chemistry and six assay tools with strict schemas and annotations", async () => {
    const adapter = createLabStudioMcpAdapter();
    const initialize = await adapter.handleJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    expect(initialize).toMatchObject({
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: false } },
      },
    });
    const listed = await adapter.handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tools = (listed?.result as { tools: Array<Record<string, unknown>> }).tools;
    expect(tools.map(({ name }) => name)).toEqual([
      "assaystudio.assess_protocol",
      "assaystudio.compose_assay",
      "assaystudio.ingest_observations",
      "assaystudio.plan_run",
      "assaystudio.search_capabilities",
      "assaystudio.validate_assay",
      "labstudio.assess_procedure",
      "labstudio.compose_draft",
      "labstudio.plan_class_run",
      "labstudio.search_capabilities",
      "labstudio.validate_artifact",
    ]);
    tools.forEach((tool) => {
      expect(tool).toMatchObject({
        inputSchema: { type: "object", additionalProperties: false },
        outputSchema: { type: "object", additionalProperties: false },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      });
    });
    expect(JSON.stringify(tools)).not.toMatch(/assaystudio\.|studentId|learnerId|assignmentId/i);
  });

  it("rejects malformed tool input and unsupported protocol methods through stable JSON-RPC errors", async () => {
    const adapter = createLabStudioMcpAdapter();
    const invalid = await adapter.handleJsonRpc({
      jsonrpc: "2.0",
      id: "invalid",
      method: "tools/call",
      params: {
        name: "labstudio.search_capabilities",
        arguments: { requestId: "invalid", unexpected: true },
      },
    });
    expect(invalid).toMatchObject({ error: { code: -32602, data: { code: "invalid_tool_input" } } });
    const resources = await adapter.handleJsonRpc({ jsonrpc: "2.0", id: 3, method: "resources/list" });
    expect(resources).toMatchObject({ error: { code: -32601, data: { code: "method_not_found" } } });
  });

  it("matches direct shared-service results for all five chemistry tools", async () => {
    const searchInput: SearchCapabilitiesInput = { requestId: "parity-search", query: "volume", limit: 5 };
    const assessInput: AssessProcedureInput = { requestId: "parity-assess", procedure: goldenProcedure, constraints };
    const composeInput: ComposeDraftInput = {
      requestId: "parity-compose",
      procedure: goldenProcedure,
      constraints,
      package: { packageId: "mcp-compose-package", createdAt: "2026-07-18T09:00:00.000Z" },
    };
    const validateInput: ValidateArtifactInput = { requestId: "parity-validate", artifact: demoLab, context: {} };
    const planInput: PlanClassRunInput = { requestId: "parity-plan", artifact: demoLab, context: { ...runContext, requestId: "parity-plan" } };
    const cases = [
      ["labstudio.search_capabilities", searchInput, chemistryDomainServices.searchCapabilities(searchInput)],
      ["labstudio.assess_procedure", assessInput, chemistryDomainServices.assessProcedure(assessInput)],
      ["labstudio.compose_draft", composeInput, chemistryDomainServices.composeDraft(composeInput)],
      ["labstudio.validate_artifact", validateInput, chemistryDomainServices.validateArtifact(validateInput)],
      ["labstudio.plan_class_run", planInput, chemistryDomainServices.planClassRun(planInput)],
    ] as const;
    for (const [name, input, direct] of cases) {
      const envelope = await structured(name, input as unknown as Record<string, unknown>);
      expect(envelope.data, name).toEqual(direct.data);
      expect(envelope.status, name).toBe(direct.status);
      expect(envelope.summary, name).toBe(direct.summary);
      expect(envelope.provenance).toEqual({ studioCoreVersion: "1.0.0", capabilityManifestVersion: "2.0" });
    }
  });

  it("returns deterministic idempotent results and a conflict for key reuse with different input", async () => {
    const adapter = createLabStudioMcpAdapter();
    const firstInput = { requestId: "idem", idempotencyKey: "same-key", query: "volume" };
    const first = await adapter.callTool("labstudio.search_capabilities", firstInput);
    const replay = await adapter.callTool("labstudio.search_capabilities", structuredClone(firstInput));
    expect(replay).toEqual(first);
    await expect(adapter.callTool("labstudio.search_capabilities", {
      ...firstInput,
      query: "temperature",
    })).rejects.toMatchObject({ adapterCode: "idempotency_conflict", rpcCode: -32009 });
  });

  it("enforces origin, payload, time, forbidden-output, and redacted-observability boundaries", async () => {
    const records: unknown[] = [];
    const adapter = createLabStudioMcpAdapter({ maxPayloadBytes: 100, observe: (record) => records.push(record) });
    await expect(adapter.callTool("labstudio.search_capabilities", {
      requestId: "origin",
    }, { origin: "https://attacker.invalid" })).rejects.toMatchObject({ adapterCode: "origin_not_allowed" });
    await expect(adapter.callTool("labstudio.search_capabilities", {
      requestId: "payload",
      query: "x".repeat(200),
    })).rejects.toMatchObject({ adapterCode: "payload_too_large" });
    expect(JSON.stringify(records)).not.toContain("attacker.invalid");
    expect(JSON.stringify(records)).not.toContain("x".repeat(50));

    const fixtureRegistration = (invoke: RegisterDomainToolsInput["contracts"][number]["invoke"]): RegisterDomainToolsInput => ({
      namespace: "labstudio",
      domainPackId: "chemistry",
      domainPackVersion: "test",
      contracts: [{
        suffix: "fixture",
        title: "Fixture",
        description: "Security test fixture.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["requestId"],
          properties: baseRequestProperties,
        },
        outputSchema: resultEnvelopeSchema,
        invoke,
      }],
    });
    const slow = createStudioMcpAdapter([fixtureRegistration(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { status: "ok", summary: "Slow complete.", data: {} };
    })], { maxExecutionMs: 1 });
    await expect(slow.callTool("labstudio.fixture", { requestId: "slow" })).rejects.toMatchObject({ adapterCode: "execution_timeout" });

    const leaking = createStudioMcpAdapter([fixtureRegistration(() => ({
      status: "ok",
      summary: "Leaking output.",
      data: { localPath: "C:\\private\\secret.json" },
    }))]);
    await expect(leaking.callTool("labstudio.fixture", { requestId: "leak" })).rejects.toMatchObject({ adapterCode: "forbidden_output" });
  });

  it("serves stateless Streamable HTTP initialize/list/call and rejects hostile origins and oversized bodies", async () => {
    const adapter = createLabStudioMcpAdapter({ maxPayloadBytes: 512 });
    const listening = await listenMcpHttpServer(adapter);
    servers.push(listening.server);
    const initialize = await fetch(listening.url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25" } }),
    });
    expect(initialize.status).toBe(200);
    expect(await initialize.json()).toMatchObject({ result: { serverInfo: { name: "lab-studio-mcp" } } });
    const hostile = await fetch(listening.url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.invalid" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(hostile.status).toBe(403);
    const oversized = await fetch(listening.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "labstudio.search_capabilities", arguments: { requestId: "large", query: "z".repeat(1000) } } }),
    });
    expect(oversized.status).toBe(413);
  });

  it("keeps the production MCP adapter free of persistence, URL fetching, provider internals, and student-state fields", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const productionFiles = ["adapter.ts", "chemistryServices.ts", "domainRegistration.ts", "entry.ts", "http.ts", "index.ts", "schemas.ts", "stdio.ts", "types.ts"];
    const source = productionFiles.map((file) => readFileSync(join(root, "..", file), "utf8")).join("\n");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\b(studentId|learnerId|assignmentId|grade|roster)\b/);
    expect(source).not.toMatch(/\b(prisma|postgres|sqlite|mongodb|database)\b/i);
    expect(source).not.toMatch(/\b(chainOfThought|hiddenReasoning|providerFileId|vendorFileId)\b/);
    expect(createStudioMcpAdapter([chemistryMcpDomainRegistration]).listTools()).toHaveLength(5);
  });
});
