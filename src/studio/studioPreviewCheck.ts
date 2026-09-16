import { createRuntimeState, getActions } from "../runtime";
import type { LabDefinition } from "../domain/types";
import { validateLabDefinition } from "../domain/validation";
import { assessStudioReadiness, isRunnableReadiness, type StudioReadiness } from "./studioReadiness";

export interface StudioPreviewCheck {
  runnable: boolean;
  readiness: StudioReadiness;
  startNodeId: string;
  selectedStepTitle?: string;
  errors: string[];
}

export const runStudioPreviewCheck = (
  draft: LabDefinition,
  selectedNodeId?: string,
): StudioPreviewCheck => {
  const readiness = assessStudioReadiness(draft);
  const validation = validateLabDefinition(draft);
  const errors = validation.ok ? [] : [...validation.errors];
  const startNode = draft.process.nodes.find((node) => node.id === draft.process.startNodeId);

  if (!startNode) {
    errors.push("Student preview needs a valid start node.");
  }

  try {
    const runtimeState = createRuntimeState(draft);
    const actions = getActions(draft);
    const currentNode = draft.process.nodes.find((node) => node.id === runtimeState.currentNodeId);
    if (!currentNode) {
      errors.push("Student preview could not resolve the runtime current step.");
    }
    if (currentNode?.actionId && !actions.some((action) => action.id === currentNode.actionId)) {
      errors.push("Student preview could not resolve the current step action.");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Student preview runtime initialization failed.");
  }

  return {
    runnable: isRunnableReadiness(readiness) && errors.length === 0,
    readiness,
    startNodeId: draft.process.startNodeId,
    selectedStepTitle: draft.process.nodes.find((node) => node.id === selectedNodeId)?.title,
    errors,
  };
};
