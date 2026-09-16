import rawModelCatalog from "./modelCatalog.json";
import type { AssistantModelCatalogEntry, AssistantReasoningEffort } from "./types";

export const modelCatalog = rawModelCatalog as AssistantModelCatalogEntry[];

export const defaultAssistantModel =
  modelCatalog.find((model) => model.default) ?? modelCatalog[0];

export const modelIds = modelCatalog.map((model) => model.id);

export const findAssistantModel = (modelId: string): AssistantModelCatalogEntry | undefined =>
  modelCatalog.find((model) => model.id === modelId);

export const isAssistantModelId = (modelId: string): boolean =>
  findAssistantModel(modelId) !== undefined;

export const resolveAssistantModel = (
  modelId: string | undefined,
): AssistantModelCatalogEntry => {
  if (!modelId) return defaultAssistantModel;
  return findAssistantModel(modelId) ?? defaultAssistantModel;
};

export const resolveReasoningEffort = (
  modelId: string | undefined,
  effort: string | undefined,
): AssistantReasoningEffort => {
  const model = resolveAssistantModel(modelId);
  if (effort && model.reasoningEfforts.includes(effort as AssistantReasoningEffort)) {
    return effort as AssistantReasoningEffort;
  }
  return model.defaultReasoningEffort;
};
