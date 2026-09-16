import { describe, expect, it } from "vitest";
import {
  defaultAssistantModel,
  findAssistantModel,
  isAssistantModelId,
  resolveReasoningEffort,
} from "../modelCatalog";

describe("assistant model catalog", () => {
  it("defaults to GPT-5.5", () => {
    expect(defaultAssistantModel.id).toBe("gpt-5.5");
    expect(defaultAssistantModel.defaultReasoningEffort).toBe("medium");
  });

  it("accepts only the configured model IDs", () => {
    expect(isAssistantModelId("gpt-5.4-mini")).toBe(true);
    expect(isAssistantModelId("gpt-5.5")).toBe(true);
    expect(isAssistantModelId("gpt-5.5-pro")).toBe(true);
    expect(isAssistantModelId("gpt-5.4-pro")).toBe(false);
  });

  it("routes GPT-5.5 pro through the background-capable catalog path", () => {
    expect(findAssistantModel("gpt-5.5-pro")?.background).toBe(true);
  });

  it("falls back to model-specific reasoning defaults", () => {
    expect(resolveReasoningEffort("gpt-5.4-mini", "xhigh")).toBe("low");
    expect(resolveReasoningEffort("gpt-5.5", "xhigh")).toBe("xhigh");
    expect(resolveReasoningEffort("gpt-5.5-pro", undefined)).toBe("high");
  });
});
