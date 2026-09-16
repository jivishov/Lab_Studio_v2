import { describe, expect, it } from "vitest";
import { demoLab } from "../../domain/fixtures";
import { createDraftFromDemo } from "../studioState";
import { assessStudioReadiness } from "../studioReadiness";

describe("studio readiness", () => {
  it("treats the demo draft as export ready", () => {
    const readiness = assessStudioReadiness(createDraftFromDemo());
    expect(readiness.level).toBe("exportReady");
    expect(readiness.categories.map((category) => category.label)).toEqual([
      "Draft structure",
      "References",
      "Student preview",
      "Export readiness",
    ]);
  });

  it("keeps incomplete drafts saveable while blocking preview and export readiness", () => {
    const draft = {
      ...demoLab,
      title: "",
      actions: [],
      process: {
        ...demoLab.process,
        startNodeId: "missing",
        nodes: [],
        edges: [],
      },
    };

    const readiness = assessStudioReadiness(draft);

    expect(readiness.level).toBe("incomplete");
    expect(readiness.diagnostics.map((diagnostic) => diagnostic.message).join(" ")).toContain(
      "Add a lab or technique title",
    );
    expect(readiness.categories.find((category) => category.id === "studentPreview")?.status).toBe("fail");
    expect(readiness.categories.find((category) => category.id === "exportReadiness")?.status).toBe("fail");
  });
});
