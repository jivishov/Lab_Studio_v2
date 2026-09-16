import { describe, expect, it } from "vitest";
import { stepBlueprintByTemplateId } from "../stepBlueprints";

describe("step blueprints", () => {
  it("reports required field diagnostics for guided step planning", () => {
    const blueprint = stepBlueprintByTemplateId.get("template-weigh");
    if (!blueprint) throw new Error("Missing weigh blueprint.");

    const diagnostics = blueprint.validate({
      values: {
        sourceDefinitionId: "watch-glass",
      },
    }, {
      revision: "rev-blueprint",
      equipmentIds: new Set(["watch-glass"]),
    });

    expect(diagnostics.map((diagnostic) => diagnostic.message).join(" ")).toContain("Balance is required");
    expect(diagnostics.map((diagnostic) => diagnostic.message).join(" ")).toContain("Measurement is required");
  });

  it("generates unique transaction keys when no idempotency key is supplied", () => {
    const blueprint = stepBlueprintByTemplateId.get("template-weigh");
    if (!blueprint) throw new Error("Missing weigh blueprint.");

    const first = blueprint.build({}, { revision: "rev-blueprint" });
    const second = blueprint.build({}, { revision: "rev-blueprint" });

    expect(first.baseRevision).toBe("rev-blueprint");
    expect(second.baseRevision).toBe("rev-blueprint");
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });
});
