import type { LabDefinition } from "../domain/types";

export type AssistantPageId = "studio";
export type AssistantSafety = "auto" | "guarded";
export type AssistantReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export interface AssistantModelCatalogEntry {
  id: string;
  label: string;
  description: string;
  defaultReasoningEffort: AssistantReasoningEffort;
  reasoningEfforts: AssistantReasoningEffort[];
  background: boolean;
  default?: boolean;
}

export interface AssistantActionCatalogEntry {
  name: string;
  description: string;
  pageId: AssistantPageId;
  safety: AssistantSafety;
  confirmationLabel?: string;
  parameters: Record<string, unknown>;
}

export interface AssistantToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AssistantToolResult {
  status: "ok" | "error" | "pending_confirmation";
  message: string;
  data?: unknown;
}

export interface AssistantToolOutput {
  callId: string;
  name: string;
  result: AssistantToolResult;
}

export interface AssistantUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
}

export interface AssistantTurnRequest {
  pageId: AssistantPageId;
  modelId: string;
  reasoningEffort: AssistantReasoningEffort;
  previousResponseId?: string;
  message?: string;
  toolOutputs?: AssistantToolOutput[];
  pageContext?: StudioAssistantContext;
}

export interface AssistantTurnResponse {
  responseId: string;
  status: "completed" | "queued" | "in_progress" | "failed" | "cancelled" | "incomplete";
  outputText: string;
  toolCalls: AssistantToolCall[];
  usage?: AssistantUsage;
  latencyMs?: number;
  error?: string;
}

export interface AssistantImageRequest {
  prompt: string;
  filename?: string | null;
  kind: "workflow" | "equipment" | "template" | "experiment" | "reference";
  draftId?: string;
}

export interface AssistantImageResponse {
  id: string;
  filename: string;
  publicPath: string;
  kind: AssistantImageRequest["kind"];
  createdAt: string;
}

export interface StudioAssistantContext {
  draft: {
    id: string;
    revision: string;
    artifactKind: "lab" | "technique";
    title: string;
    description: string;
    audience: string;
    learningGoals: string[];
    safetyNotes: string[];
    equipment: string[];
    tags: string[];
    nodeCount: number;
    actionCount: number;
    startNodeId: string;
    selectedNodeId?: string;
  };
  selectedNode?: {
    id: string;
    type: string;
    title: string;
    description: string;
    actionId?: string;
    hints: string[];
  };
  selectedAction?: {
    id: string;
    verb: string;
    label: string;
    parameters: Record<string, unknown>;
    interaction?: Record<string, unknown>;
  };
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
  templates: Array<{
    id: string;
    title: string;
    description: string;
    requiredEquipment: string[];
    replacesDraft: boolean;
    appendsWorkflow?: boolean;
  }>;
  processNodes: Array<{
    id: string;
    type: string;
    title: string;
    actionId?: string;
  }>;
}

export interface StudioAssistantAdapter {
  getContext: () => StudioAssistantContext;
  executeTool: (
    call: AssistantToolCall,
    options?: { confirmed?: boolean },
  ) => Promise<AssistantToolResult>;
}

export type StudioDraftUpdater = (updater: (current: LabDefinition) => LabDefinition) => void;
