import { describe, expect, it } from "vitest";
import { actionCatalog, openAiToolsForPage, validateToolCall } from "../actionCatalog";

describe("assistant action catalog", () => {
  it("exports strict OpenAI tools for the Studio page", () => {
    const tools = openAiToolsForPage("studio");
    expect(tools.length).toBe(actionCatalog.length);
    expect(tools.every((tool) => tool.strict === true)).toBe(true);
    expect(tools.some((tool) => tool.name === "generate_and_save_image_asset")).toBe(true);
    expect(tools.some((tool) => tool.name === "studio_commit_transaction")).toBe(true);
  });

  it("rejects unknown tools", () => {
    expect(validateToolCall({ name: "click_dom_selector", arguments: {} }, "studio")).toEqual({
      ok: false,
      error: "Unknown assistant tool for studio: click_dom_selector",
    });
  });

  it("validates known tool arguments", () => {
    expect(
      validateToolCall(
        { name: "add_template_node", arguments: { templateId: "template-filtration" } },
        "studio",
      ).ok,
    ).toBe(true);
    expect(
      validateToolCall({ name: "add_template_node", arguments: { templateId: "" } }, "studio")
        .ok,
    ).toBe(false);
    expect(
      validateToolCall(
        {
          name: "update_interaction_fields",
          arguments: {
            actionId: "spot-sample",
            type: "spotOnto",
            sourceDefinitionId: "capillary-spotter",
            targetDefinitionId: "chromatography-paper",
            stationId: null,
            snapZoneId: null,
            valueParameter: null,
            accessibleLabel: "Touch the capillary spotter to the paper baseline.",
            successCue: null,
            invalidCue: null,
          },
        },
        "studio",
      ).ok,
    ).toBe(true);
    expect(
      validateToolCall(
        {
          name: "studio_commit_transaction",
          arguments: {
            baseRevision: "rev-1",
            idempotencyKey: "add-equipment",
            label: "Add equipment",
            operations: [{ type: "addEquipment", definitionId: "watch-glass" }],
          },
        },
        "studio",
      ).ok,
    ).toBe(true);
  });

  it("keeps save, export, full-template, and image tools guarded", () => {
    const guarded = actionCatalog
      .filter((action) => action.safety === "guarded")
      .map((action) => action.name);
    expect(guarded).toEqual([
      "load_full_lab_template",
      "save_local_draft",
      "export_lab_json",
      "generate_and_save_image_asset",
    ]);
  });
});
