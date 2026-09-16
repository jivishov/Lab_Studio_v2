export const WEBMCP_RESULT_CHARACTER_BUDGET = 1_500;

export type WebMCPSurface = "studio" | "rehearsal";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface WebMCPResult<T extends JsonValue = JsonValue> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
  state: {
    surface: WebMCPSurface;
    revision: number;
  };
}

const assertJsonValue = (value: unknown, ancestors = new Set<object>()): void => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("WebMCP tool results cannot contain non-finite numbers.");
    }
    return;
  }
  if (typeof value !== "object") {
    throw new TypeError("WebMCP tool results must contain only JSON values.");
  }

  if (ancestors.has(value)) {
    throw new TypeError("WebMCP tool results cannot contain circular references.");
  }
  ancestors.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => assertJsonValue(item, ancestors));
    ancestors.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("WebMCP tool results must use plain JSON objects.");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError("WebMCP tool results cannot contain symbol properties.");
  }
  Object.values(value).forEach((item) => assertJsonValue(item, ancestors));
  ancestors.delete(value);
};

const serializeJson = (value: unknown): string => {
  assertJsonValue(value);
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("WebMCP tool results must be JSON-serializable values.");
  }
  return serialized;
};

export const serializedResultLength = (value: unknown): number => serializeJson(value).length;

export const compactWebMCPResult = <T extends JsonValue>(
  result: WebMCPResult<T>,
): WebMCPResult<T> | WebMCPResult => {
  let serialized: string;
  try {
    serialized = serializeJson(result);
  } catch {
    return {
      ok: false,
      code: "NON_SERIALIZABLE_RESULT",
      message: "The tool produced a result that cannot be serialized as JSON.",
      state: result.state,
    };
  }

  if (serialized.length <= WEBMCP_RESULT_CHARACTER_BUDGET) return result;

  return {
    ok: false,
    code: "RESULT_BUDGET_EXCEEDED",
    message: `The tool result exceeded the ${WEBMCP_RESULT_CHARACTER_BUDGET}-character budget. Narrow the request and retry.`,
    state: result.state,
  };
};
