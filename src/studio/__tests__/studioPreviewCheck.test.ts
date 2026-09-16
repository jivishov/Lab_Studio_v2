import { describe, expect, it } from "vitest";
import { createDraftFromDemo } from "../studioState";
import { runStudioPreviewCheck } from "../studioPreviewCheck";

describe("studio preview checks", () => {
  it("accepts a draft that can initialize the StudentPlayer runtime", () => {
    const draft = createDraftFromDemo();

    const result = runStudioPreviewCheck(draft, draft.process.startNodeId);

    expect(result.runnable).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.selectedStepTitle).toBe("Measure sample");
  });

  it("blocks preview when the runtime start node cannot resolve", () => {
    const draft = {
      ...createDraftFromDemo(),
      process: {
        ...createDraftFromDemo().process,
        startNodeId: "missing-node",
      },
    };

    const result = runStudioPreviewCheck(draft);

    expect(result.runnable).toBe(false);
    expect(result.errors.join(" ")).toContain("valid start node");
  });
});
