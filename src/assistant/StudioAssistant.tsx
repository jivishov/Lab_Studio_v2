import { useEffect, useMemo, useState } from "react";
import { Bot, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { actionCatalog } from "./actionCatalog";
import {
  defaultAssistantModel,
  modelCatalog,
  resolveReasoningEffort,
} from "./modelCatalog";
import {
  checkAssistantHealth,
  pollAssistantResponse,
  postAssistantTurn,
} from "./client";
import type {
  AssistantReasoningEffort,
  AssistantToolCall,
  AssistantToolOutput,
  AssistantTurnResponse,
  StudioAssistantAdapter,
} from "./types";

interface StudioAssistantProps {
  adapter: StudioAssistantAdapter;
  isOpen: boolean;
  onClose: () => void;
}

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface PendingConfirmation {
  call: AssistantToolCall;
  responseId: string;
  message: string;
  round: number;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isPendingResponse = (response: AssistantTurnResponse): boolean =>
  response.status === "queued" || response.status === "in_progress";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const usageLabel = (response?: AssistantTurnResponse): string => {
  if (!response?.usage?.totalTokens) return "";
  const cached = response.usage.cachedInputTokens
    ? `, ${response.usage.cachedInputTokens} cached`
    : "";
  return `${response.usage.totalTokens} tokens${cached}`;
};

export const StudioAssistant = ({ adapter, isOpen, onClose }: StudioAssistantProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "I can help build this lab workflow, adjust structured fields, validate the draft, save/export, and generate image assets through the local assistant server.",
    },
  ]);
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState(defaultAssistantModel.id);
  const [reasoningEffort, setReasoningEffort] = useState<AssistantReasoningEffort>(
    defaultAssistantModel.defaultReasoningEffort,
  );
  const [previousResponseId, setPreviousResponseId] = useState<string>();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>();
  const [isBusy, setIsBusy] = useState(false);
  const [serverState, setServerState] = useState<"checking" | "ready" | "missing" | "unconfigured">(
    "checking",
  );
  const [statusText, setStatusText] = useState("Checking local assistant server");
  const [lastResponse, setLastResponse] = useState<AssistantTurnResponse>();

  const selectedModel = useMemo(
    () => modelCatalog.find((model) => model.id === modelId) ?? defaultAssistantModel,
    [modelId],
  );

  useEffect(() => {
    let active = true;
    if (!isOpen) return undefined;
    setServerState("checking");
    setStatusText("Checking local assistant server");
    void checkAssistantHealth()
      .then((health) => {
        if (!active) return;
        if (!health.configured) {
          setServerState("unconfigured");
          setStatusText("Local assistant server is running, but OPENAI_API_KEY is not configured.");
          return;
        }
        setServerState("ready");
        setStatusText("Local assistant server ready");
      })
      .catch(() => {
        if (!active) return;
        setServerState("missing");
        setStatusText("Start the local assistant server with npm run assistant:server.");
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const appendMessage = (role: ChatRole, content: string) => {
    setMessages((current) => [...current, { id: makeId(), role, content }]);
  };

  const pollUntilComplete = async (response: AssistantTurnResponse): Promise<AssistantTurnResponse> => {
    if (!isPendingResponse(response)) return response;
    setStatusText("GPT-5.5 pro request is running in background");
    let current = response;
    for (let attempt = 0; attempt < 90 && isPendingResponse(current); attempt += 1) {
      await wait(2000);
      current = await pollAssistantResponse(current.responseId);
    }
    return current;
  };

  const runAssistantLoop = async (
    request: {
      message?: string;
      toolOutputs?: AssistantToolOutput[];
      previousResponseId?: string;
    },
    round = 0,
  ): Promise<void> => {
    if (round >= 6) {
      appendMessage("assistant", "I stopped after 6 tool rounds to keep the draft safe.");
      return;
    }

    const turn = await pollUntilComplete(
      await postAssistantTurn({
        pageId: "studio",
        modelId,
        reasoningEffort,
        previousResponseId: request.previousResponseId ?? previousResponseId,
        message: request.message,
        toolOutputs: request.toolOutputs,
        pageContext: adapter.getContext(),
      }),
    );
    setLastResponse(turn);
    setPreviousResponseId(turn.responseId);
    setStatusText(usageLabel(turn) || "Assistant turn complete");

    if (turn.status !== "completed") {
      appendMessage("assistant", turn.error || "The assistant response did not complete.");
      return;
    }

    if (turn.toolCalls.length === 0) {
      appendMessage("assistant", turn.outputText || "Done.");
      return;
    }

    const call = turn.toolCalls[0];
    const toolResult = await adapter.executeTool(call);
    if (toolResult.status === "pending_confirmation") {
      setPendingConfirmation({
        call,
        responseId: turn.responseId,
        message: toolResult.message,
        round,
      });
      appendMessage("assistant", toolResult.message);
      return;
    }

    await runAssistantLoop(
      {
        previousResponseId: turn.responseId,
        toolOutputs: [{ callId: call.callId, name: call.name, result: toolResult }],
      },
      round + 1,
    );
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isBusy || serverState !== "ready") return;
    setInput("");
    setPendingConfirmation(undefined);
    appendMessage("user", trimmed);
    setIsBusy(true);
    setStatusText("Assistant thinking");
    try {
      await runAssistantLoop({ message: trimmed });
    } catch (error) {
      appendMessage(
        "assistant",
        error instanceof Error ? error.message : "The assistant request failed.",
      );
      setStatusText("Assistant request failed");
    } finally {
      setIsBusy(false);
    }
  };

  const confirmPendingTool = async () => {
    if (!pendingConfirmation || isBusy) return;
    setIsBusy(true);
    const pending = pendingConfirmation;
    setPendingConfirmation(undefined);
    setStatusText(`Running ${pending.call.name}`);
    try {
      const result = await adapter.executeTool(pending.call, { confirmed: true });
      appendMessage("system", result.message);
      await runAssistantLoop(
        {
          previousResponseId: pending.responseId,
          toolOutputs: [{ callId: pending.call.callId, name: pending.call.name, result }],
        },
        pending.round + 1,
      );
    } catch (error) {
      appendMessage(
        "assistant",
        error instanceof Error ? error.message : "The confirmed action failed.",
      );
      setStatusText("Confirmed action failed");
    } finally {
      setIsBusy(false);
    }
  };

  const cancelPendingTool = async () => {
    if (!pendingConfirmation || isBusy) return;
    const pending = pendingConfirmation;
    setPendingConfirmation(undefined);
    appendMessage("system", `${pending.call.name} was cancelled.`);
    setIsBusy(true);
    setStatusText("Sending cancellation");
    try {
      await runAssistantLoop(
        {
          previousResponseId: pending.responseId,
          toolOutputs: [
            {
              callId: pending.call.callId,
              name: pending.call.name,
              result: {
                status: "error",
                message: `${pending.call.name} was cancelled by the user.`,
              },
            },
          ],
        },
        pending.round + 1,
      );
    } catch (error) {
      appendMessage(
        "assistant",
        error instanceof Error ? error.message : "The cancellation update failed.",
      );
      setStatusText("Cancellation update failed");
    } finally {
      setIsBusy(false);
    }
  };

  const changeModel = (nextModelId: string) => {
    setModelId(nextModelId);
    setReasoningEffort(resolveReasoningEffort(nextModelId, undefined));
  };

  if (!isOpen) return null;

  return (
    <aside className="studio-assistant" aria-label="Lab Studio assistant">
      <div className="studio-assistant__header">
        <div>
          <span className="studio-assistant__eyebrow">
            <Sparkles size={13} aria-hidden="true" /> Local AI assistant
          </span>
          <h2>Workflow builder</h2>
        </div>
        <button type="button" aria-label="Close assistant" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="studio-assistant__controls">
        <label>
          Model
          <select value={modelId} onChange={(event) => changeModel(event.target.value)}>
            {modelCatalog.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reasoning
          <select
            value={reasoningEffort}
            onChange={(event) =>
              setReasoningEffort(event.target.value as AssistantReasoningEffort)
            }
          >
            {selectedModel.reasoningEfforts.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className={`studio-assistant__status is-${serverState}`} aria-live="polite">
        {isBusy ? <Loader2 size={13} aria-hidden="true" /> : <Bot size={13} aria-hidden="true" />}
        {statusText}
      </p>

      <div className="studio-assistant__messages" aria-live="polite">
        {messages.map((message) => (
          <div className={`assistant-message is-${message.role}`} key={message.id}>
            {message.content}
          </div>
        ))}
      </div>

      {pendingConfirmation ? (
        <section className="assistant-confirmation" aria-label="Assistant confirmation">
          <div>
            <strong>
              {actionCatalog.find((action) => action.name === pendingConfirmation.call.name)
                ?.confirmationLabel ?? pendingConfirmation.call.name}
            </strong>
            <span>{pendingConfirmation.message}</span>
          </div>
          <div className="assistant-confirmation__actions">
            <button type="button" onClick={confirmPendingTool} disabled={isBusy}>
              <Check size={14} aria-hidden="true" /> Confirm
            </button>
            <button type="button" onClick={() => void cancelPendingTool()} disabled={isBusy}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <form
        className="studio-assistant__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <label>
          <span className="sr-only">Assistant message</span>
          <textarea
            value={input}
            placeholder="Ask for a filtration workflow, validation pass, image asset, or export."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!input.trim() || isBusy || serverState !== "ready"}
          aria-label="Send assistant message"
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </form>

      {lastResponse?.latencyMs ? (
        <p className="studio-assistant__meta">
          {Math.round(lastResponse.latencyMs)} ms {usageLabel(lastResponse)}
        </p>
      ) : null}
    </aside>
  );
};
