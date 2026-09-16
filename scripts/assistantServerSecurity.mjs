const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const ALLOWED_METHODS = "GET,POST,OPTIONS";
const ALLOWED_HEADERS = "Content-Type";

const normalizeOrigin = (origin) => {
  if (typeof origin !== "string" || origin.trim().length === 0 || origin === "null") {
    return undefined;
  }
  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return undefined;
  }
};

const originListFromEnv = (value = "") =>
  value
    .split(",")
    .map((entry) => normalizeOrigin(entry.trim()))
    .filter(Boolean);

const isLoopbackOrigin = (origin) => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const parsed = new URL(normalized);
  return (parsed.protocol === "http:" || parsed.protocol === "https:") && LOOPBACK_HOSTS.has(parsed.hostname);
};

export const createAssistantOriginPolicy = (extraOrigins = []) => {
  const explicitOrigins = new Set(extraOrigins.map(normalizeOrigin).filter(Boolean));

  const isAllowedAssistantOrigin = (origin) => {
    if (origin === undefined || origin === null || origin === "") return true;
    const normalized = normalizeOrigin(origin);
    if (!normalized) return false;
    return explicitOrigins.has(normalized) || isLoopbackOrigin(normalized);
  };

  const corsHeadersForOrigin = (origin) => {
    const headers = {
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      Vary: "Origin",
    };
    const normalized = normalizeOrigin(origin);
    if (normalized && isAllowedAssistantOrigin(normalized)) {
      headers["Access-Control-Allow-Origin"] = normalized;
    }
    return headers;
  };

  return {
    isAllowedAssistantOrigin,
    corsHeadersForOrigin,
  };
};

export const defaultAssistantOriginPolicy = createAssistantOriginPolicy(
  originListFromEnv(process.env.LAB_STUDIO_ASSISTANT_ALLOWED_ORIGINS),
);
