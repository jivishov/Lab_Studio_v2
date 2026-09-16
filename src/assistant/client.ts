import type {
  AssistantImageRequest,
  AssistantImageResponse,
  AssistantTurnRequest,
  AssistantTurnResponse,
} from "./types";

const ASSISTANT_SERVER_STORAGE_KEY = "lab-studio:v1:assistant-server-url";
const DEFAULT_ASSISTANT_SERVER_URL = "http://127.0.0.1:8787";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const assistantServerUrl = (): string => {
  try {
    const saved = window.localStorage.getItem(ASSISTANT_SERVER_STORAGE_KEY);
    return trimTrailingSlash(saved || DEFAULT_ASSISTANT_SERVER_URL);
  } catch {
    return DEFAULT_ASSISTANT_SERVER_URL;
  }
};

const parseJsonResponse = async <T,>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Assistant server returned ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
};

export const checkAssistantHealth = async (): Promise<{
  ok: boolean;
  configured: boolean;
  models: string[];
}> => {
  const response = await fetch(`${assistantServerUrl()}/api/assistant/health`);
  return parseJsonResponse(response);
};

export const postAssistantTurn = async (
  request: AssistantTurnRequest,
): Promise<AssistantTurnResponse> => {
  const response = await fetch(`${assistantServerUrl()}/api/assistant/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return parseJsonResponse(response);
};

export const pollAssistantResponse = async (
  responseId: string,
): Promise<AssistantTurnResponse> => {
  const response = await fetch(
    `${assistantServerUrl()}/api/assistant/responses/${encodeURIComponent(responseId)}`,
  );
  return parseJsonResponse(response);
};

export const postAssistantImage = async (
  request: AssistantImageRequest,
): Promise<AssistantImageResponse> => {
  const response = await fetch(`${assistantServerUrl()}/api/assistant/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return parseJsonResponse(response);
};
