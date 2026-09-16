import { assistantServerUrl } from "../../assistant/client";
import type {
  CausalystModelCandidateAdapter,
  CausalystPromptRequest,
} from "./types";

export interface CausalystPromptClientOptions {
  modelRef: string;
  reasoningEffort: "low" | "medium" | "high" | "xhigh";
}

export const createCausalystPromptClient = (
  options: CausalystPromptClientOptions,
): CausalystModelCandidateAdapter => ({
  id: "causalyst.local-openai-responses",
  modelRef: options.modelRef,
  async proposeProcedureIR(request: CausalystPromptRequest): Promise<unknown> {
    const response = await fetch(`${assistantServerUrl()}/api/causalyst/procedure-candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: options.modelRef,
        reasoningEffort: options.reasoningEffort,
        prompt: request.prompt,
        approvedSourceText: request.approvedSourceText,
        attachment: request.sourceAttachment,
        domainPackRef: request.assessment.domainPackRef,
        authoringPolicy: request.assessment.authoringPolicy,
      }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof body.error === "string"
      ? body.error
      : `Prompt candidate server returned ${response.status}.`);
    return body.candidate;
  },
});

export const resetCausalystPromptAttachment = async (
  attachmentId: string,
): Promise<void> => {
  const response = await fetch(`${assistantServerUrl()}/api/causalyst/attachments/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attachmentId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(typeof body.error === "string"
      ? body.error
      : `Attachment cleanup returned ${response.status}.`);
  }
};
