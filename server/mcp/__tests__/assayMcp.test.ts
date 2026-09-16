import { describe, expect, it } from "vitest";
import { createCycle09AssayPlanningRequest, createCycle09PlanningArtifact } from "../../../src/domain-packs/assay/planning/__fixtures__/cycle09PlanningFixture";
import { cycle10LongCsv } from "../../../src/domain-packs/assay/ingestion/__fixtures__/cycle10IngestionFixture";
import { createCycle11XttAssay } from "../../../src/domain-packs/assay/profiles/__fixtures__/cycle11ProtocolFixtures";
import { assayReleaseServices } from "../../../src/domain-packs/assay/services";
import { createLabStudioMcpAdapter } from "../index";
import type { StudioMcpResultEnvelope } from "../types";

const structured = async (name: string, input: Record<string, unknown>): Promise<StudioMcpResultEnvelope> => {
  const response = await createLabStudioMcpAdapter().callTool(name, input);
  return response.structuredContent as StudioMcpResultEnvelope;
};

describe("Cycle 12 assay MCP release contracts", () => {
  it("exposes exactly six assay tools alongside the unchanged five chemistry tools", () => {
    const names = createLabStudioMcpAdapter().listTools().map(({ name }) => name);
    expect(names.filter((name) => name.startsWith("assaystudio."))).toEqual([
      "assaystudio.assess_protocol",
      "assaystudio.compose_assay",
      "assaystudio.ingest_observations",
      "assaystudio.plan_run",
      "assaystudio.search_capabilities",
      "assaystudio.validate_assay",
    ]);
    expect(names.filter((name) => name.startsWith("labstudio."))).toHaveLength(5);
  });

  it("keeps direct-app and MCP validation and planning services at parity", async () => {
    const artifact = createCycle09PlanningArtifact();
    const planningRequest = createCycle09AssayPlanningRequest();
    const directValidation = assayReleaseServices.validateAssay(artifact);
    const mcpValidation = await structured("assaystudio.validate_assay", {
      requestId: "assay-parity-validation",
      artifact,
    });
    expect(mcpValidation.data.validation).toEqual(directValidation.validation);

    const directPlan = assayReleaseServices.planRun(
      artifact,
      "assay-parity-plan",
      planningRequest,
    );
    const mcpPlan = await structured("assaystudio.plan_run", {
      requestId: "assay-parity-plan",
      artifact,
      planningRequest,
    });
    expect(mcpPlan.data.runPlan).toEqual(directPlan.runPlan);
  });

  it("composes only registered templates and preserves XTT as a metabolic-activity proxy", async () => {
    const result = await structured("assaystudio.compose_assay", {
      requestId: "assay-compose-xtt",
      templateId: "xtt-metabolic-activity",
      id: "teacher-xtt",
      title: "Teacher XTT metabolic-activity assay",
      updatedAt: "2026-07-26T23:30:00.000Z",
      package: {
        packageId: "teacher-xtt-package",
        createdAt: "2026-07-26T23:30:00.000Z",
      },
    });
    expect(result.status).toBe("ok");
    expect(JSON.stringify(result)).toContain("metabolic-activity");
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/direct cell count(?! is not| is never)/);
    expect(JSON.stringify(result)).not.toMatch(/susceptib|treatment recommendation|\bS\/I\/R\b/);
  });

  it("returns CSV mapping candidates without accepting or committing observations", async () => {
    const result = await structured("assaystudio.ingest_observations", {
      requestId: "assay-ingest-csv",
      kind: "csv",
      contents: cycle10LongCsv,
      mapping: {
        format: "long",
        delimiter: ",",
        decimalSeparator: ".",
        orientation: "A1-top-left",
        plateIdColumn: "plate",
        wellColumn: "well",
        signalColumn: "signal",
        unitColumn: "unit",
        channelColumn: "channel",
      },
      importId: "assay-ingest-csv",
      sourceName: "supplied fixture",
      sourceVersion: "1.0.0",
      createdAt: "2026-07-26T23:30:00.000Z",
    });
    expect(result.status).toBe("ok");
    expect(result.data.reviewRequired).toBe(true);
    expect(JSON.stringify(result.data)).toContain("unreviewed");
  });

  it("rejects schema extras, clinical-shaped artifact data, and idempotency conflicts", async () => {
    const adapter = createLabStudioMcpAdapter();
    await expect(adapter.callTool("assaystudio.search_capabilities", {
      requestId: "assay-extra",
      unexpected: true,
    })).rejects.toMatchObject({ code: "invalid_tool_input" });

    const artifact = createCycle11XttAssay() as unknown as Record<string, unknown>;
    artifact.clinicalBreakpoint = "unsupported";
    const validation = await structured("assaystudio.validate_assay", {
      requestId: "assay-clinical-negative",
      artifact,
    });
    expect(validation.status).toBe("incomplete");

    const first = {
      requestId: "assay-idempotent",
      idempotencyKey: "assay-idempotency-key",
      query: "pipette",
    };
    await adapter.callTool("assaystudio.search_capabilities", first);
    await expect(adapter.callTool("assaystudio.search_capabilities", {
      ...first,
      query: "endpoint",
    })).rejects.toMatchObject({ adapterCode: "idempotency_conflict" });
  });
});
