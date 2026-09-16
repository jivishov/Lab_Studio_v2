import { describe, expect, it, vi } from "vitest";
import { actionCatalog } from "../../assistant/actionCatalog";
import {
  acidBaseTitrationFamily,
  defaultLabInventory,
} from "../../experimentComposer/catalogs";
import type {
  ComposerSessionController,
  PublicStageSummary,
} from "../../experimentComposer/types";
import {
  serializedResultLength,
  WEBMCP_RESULT_CHARACTER_BUDGET,
  type JsonValue,
  type WebMCPResult,
} from "../result";
import { compactStudioStageSummary, createStudioToolSet } from "../studioTools";
import { STUDIO_TOOL_NAMES } from "../toolSchemas";

const controllerFixture = (): ComposerSessionController => {
  let inventory = defaultLabInventory();
  let revision = 0;
  const response = (ok: boolean, code: string, message: string, data?: JsonValue): WebMCPResult<JsonValue> => ({
    ok,
    code,
    message,
    ...(data === undefined ? {} : { data }),
    state: { surface: "studio", revision },
  });
  return {
    getRevision: () => revision,
    getInventory: () => structuredClone(inventory),
    getStage: () => undefined,
    getProtocolReport: () => undefined,
    replaceInventory: vi.fn(async (next) => {
      inventory = next;
      revision += 1;
      return response(true, "INVENTORY_REPLACED", "visible", { inventoryRevision: next.revision });
    }),
    preview: vi.fn(async () => response(false, "PREVIEW_FAILED", "blocked")),
    inspectPreview: () => undefined,
    startRehearsal: vi.fn(async () => response(false, "NOT_READY", "not ready")),
    runProtocolCheck: vi.fn(async () => response(false, "NOT_READY", "not ready")),
  };
};

describe("Studio WebMCP tools", () => {
  it("emits exactly seven isolated names with no Assistant or human-authority operations", () => {
    const set = createStudioToolSet(controllerFixture());
    expect(set.tools.map((tool) => tool.name)).toEqual(STUDIO_TOOL_NAMES);
    const names = new Set(set.tools.map((tool) => tool.name));
    actionCatalog.forEach((action) => expect(names.has(action.name)).toBe(false));
    ["apply", "discard", "save", "export", "publish", "assessment"].forEach((fragment) => {
      expect([...names].some((name) => name.includes(fragment))).toBe(false);
    });
    const annotations = Object.fromEntries(set.tools.map((tool) => [tool.name, tool.annotations]));
    expect(annotations.inspect_lab_capabilities).toMatchObject({ readOnlyHint: true });
    expect(annotations.inspect_lab_inventory).toMatchObject({ readOnlyHint: true });
    expect(annotations.inspect_lab_preview).toMatchObject({ readOnlyHint: true, untrustedContentHint: true });
    expect(annotations.replace_lab_inventory).toMatchObject({ readOnlyHint: false });
    expect(annotations.preview_lab_experiment).toMatchObject({ readOnlyHint: false, untrustedContentHint: true });
    expect(annotations.start_lab_rehearsal).toEqual({ readOnlyHint: false });
    expect(annotations.run_lab_protocol_check).toEqual({ readOnlyHint: false });
  });

  it("AJV rejects malformed state-changing input before controller access", () => {
    const controller = controllerFixture();
    const set = createStudioToolSet(controller);
    const replace = set.tools.find((tool) => tool.name === "replace_lab_inventory")!;
    const invalid = replace.validateInput({ expectedRevision: 0, equipment: [] });
    expect(invalid.ok).toBe(false);
    expect(controller.getInventory()).toEqual(defaultLabInventory());
    expect(controller.replaceInventory).not.toHaveBeenCalled();
  });

  it("keeps a worst-case staged inspection compact without leaking guard internals", () => {
    const summary = {
      stageId: "s".repeat(80),
      stageRevision: Number.MAX_SAFE_INTEGER,
      familyId: "acid_base_titration_v1",
      title: "\u0000\\\"".repeat(100),
      objective: "\u0000\\\"".repeat(300),
      audience: "technician_onboarding",
      experience: "intermediate",
      durationMinutes: 120,
      deliveryContext: "physical_procedure_rehearsal",
      resolvedRoles: {
        burette: "burette-50ml",
        burette_support: "ring-stand-clamp",
        aliquot_measure: "graduated-cylinder",
        receiving_flask: "erlenmeyer-flask-250ml",
        waste_receiver: "waste-beaker",
        analyte_source: "unknown-acid-bottle",
        titrant_source: "naoh-bottle",
        indicator_source: "phenolphthalein-dropper",
      },
      moduleIds: [...acidBaseTitrationFamily.moduleIds],
      workingVolumes: { aliquotMl: 25, buretteFillMl: 50, indicatorMl: 0.1 },
      fidelity: {
        status: "procedurally_executable",
        modeled: ["M".repeat(300)],
        proceduralOnly: ["P".repeat(300)],
        assumptions: ["A".repeat(300)],
        limitations: ["L".repeat(300), "L2".repeat(150)],
        safetyDeclarations: ["S".repeat(300)],
        warnings: ["W".repeat(300), "W2".repeat(150)],
      },
      staleReasons: ["inventory_changed", "draft_changed"],
    } satisfies PublicStageSummary;
    const result: WebMCPResult<JsonValue> = {
      ok: true,
      code: "PREVIEW_INSPECTED",
      message: "Current staged summary returned.",
      data: compactStudioStageSummary(summary, {
        reportId: "r".repeat(200),
        passed: true,
        stage: {
          stageId: summary.stageId,
          stageRevision: summary.stageRevision,
          sourceInventoryRevision: 0,
          sourceDraftFingerprint: "private-fingerprint-must-not-appear",
        },
      }),
      state: { surface: "studio", revision: Number.MAX_SAFE_INTEGER },
    };
    expect(serializedResultLength(result)).toBeLessThanOrEqual(WEBMCP_RESULT_CHARACTER_BUDGET);
    expect(JSON.stringify(result)).not.toContain("\u0000");
    expect(JSON.stringify(result)).not.toContain("private-fingerprint-must-not-appear");
    expect(result.data).toMatchObject({ stageId: summary.stageId, stageRevision: summary.stageRevision });
  });

  it("awaits inventory acknowledgement, keeps inspection compact, and delegates honestly", async () => {
    const controller = controllerFixture();
    const set = createStudioToolSet(controller);
    const capabilities = set.tools.find((tool) => tool.name === "inspect_lab_capabilities")!;
    const capabilityResult = await capabilities.execute({}, { signal: new AbortController().signal });
    expect(serializedResultLength(capabilityResult)).toBeLessThanOrEqual(WEBMCP_RESULT_CHARACTER_BUDGET);

    const input = defaultLabInventory();
    const replace = set.tools.find((tool) => tool.name === "replace_lab_inventory")!;
    const result = await replace.execute({
      expectedRevision: 0,
      equipment: input.equipment,
      chemicals: input.chemicals,
      facilities: input.facilities,
    }, { signal: new AbortController().signal });
    expect(result.ok).toBe(true);
    expect(result.state.revision).toBe(1);
    expect(controller.replaceInventory).toHaveBeenCalledTimes(1);
    const invalidAfterMutation = replace.validateInput({ expectedRevision: 1, equipment: [] });
    expect(invalidAfterMutation).toMatchObject({
      ok: false,
      result: { state: { surface: "studio", revision: 1 } },
    });

    for (const name of ["start_lab_rehearsal", "run_lab_protocol_check"]) {
      const tool = set.tools.find((candidate) => candidate.name === name)!;
      const delegated = await tool.execute({ stageId: "current-stage" }, { signal: new AbortController().signal });
      expect(delegated).toMatchObject({ ok: false, code: "NOT_READY" });
    }
  });
});
