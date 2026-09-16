import Ajv from "ajv";

const outputTextFromResponse = (response) => {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return "";
  return response.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n");
};

const parseToolCall = (item) => {
  if (typeof item.call_id !== "string" || item.call_id.length === 0) {
    return { error: "OpenAI returned a function call without a call id." };
  }
  if (typeof item.name !== "string" || item.name.length === 0) {
    return { error: `OpenAI returned function call ${item.call_id} without a tool name.` };
  }
  try {
    return {
      callId: item.call_id,
      name: item.name,
      arguments: item.arguments ? JSON.parse(item.arguments) : {},
    };
  } catch {
    return { error: `${item.name} returned invalid JSON arguments.` };
  }
};

const createToolCallValidator = (actionCatalog) => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const actionByName = new Map(actionCatalog.map((action) => [action.name, action]));
  const validators = new Map(
    actionCatalog.map((action) => [action.name, ajv.compile(action.parameters)]),
  );

  return (call, pageId) => {
    const action = actionByName.get(call.name);
    if (!action || action.pageId !== pageId) {
      return { ok: false, error: `Unknown assistant tool for ${pageId}: ${call.name}` };
    }
    const validate = validators.get(call.name);
    if (!validate) {
      return { ok: false, error: `No schema validator for ${call.name}.` };
    }
    if (!validate(call.arguments)) {
      return {
        ok: false,
        error: `${call.name} arguments failed validation: ${ajv.errorsText(validate.errors, {
          separator: "; ",
        })}`,
      };
    }
    return { ok: true };
  };
};

export const createOpenAiResponseParser = (actionCatalog) => {
  const validateToolCall = createToolCallValidator(actionCatalog);

  return (response, { latencyMs = 0, pageId = "studio" } = {}) => {
    const acceptedToolCalls = [];
    const rejectedToolCalls = [];

    if (Array.isArray(response.output)) {
      response.output
        .filter((item) => item.type === "function_call")
        .forEach((item) => {
          const parsed = parseToolCall(item);
          if ("error" in parsed) {
            rejectedToolCalls.push(parsed.error);
            return;
          }
          const validation = validateToolCall(parsed, pageId);
          if (!validation.ok) {
            rejectedToolCalls.push(validation.error);
            return;
          }
          acceptedToolCalls.push(parsed);
        });
    }

    const toolValidationError = rejectedToolCalls[0];
    return {
      responseId: response.id,
      status: toolValidationError ? "failed" : response.status ?? "completed",
      outputText: outputTextFromResponse(response),
      toolCalls: toolValidationError ? [] : acceptedToolCalls,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: response.usage?.total_tokens,
        cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      },
      latencyMs,
      error: response.error?.message ?? toolValidationError,
    };
  };
};
