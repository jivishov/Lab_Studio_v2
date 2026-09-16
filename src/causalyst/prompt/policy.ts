import { defaultAssistantModel } from "../../assistant/modelCatalog";

const reasoningEffort = defaultAssistantModel.reasoningEfforts.includes(
  defaultAssistantModel.defaultReasoningEffort,
) && defaultAssistantModel.defaultReasoningEffort !== "none"
  ? defaultAssistantModel.defaultReasoningEffort
  : "medium";

export const causalystPromptRuntimePolicy = Object.freeze({
  providerRef: "openai" as const,
  modelRef: defaultAssistantModel.id,
  reasoningEffort,
  retainPromptRevisions: false,
  maximumRevisionCount: 5,
});

