import type { ContractDiagnostic } from "../validation/jsonSchema";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type CandidateSanitizationResult =
  | { ok: true; value: JsonValue; diagnostics: [] }
  | { ok: false; diagnostics: ContractDiagnostic[] };

const forbiddenKeyCategories = new Map<string, string>([
  ["proto", "prototype-pollution"],
  ["prototype", "prototype-pollution"],
  ["constructor", "prototype-pollution"],
  ["path", "local-path"],
  ["filepath", "local-path"],
  ["localpath", "local-path"],
  ["assetpath", "local-path"],
  ["generatedassetpath", "local-path"],
  ["fileid", "provider-internal"],
  ["providerfileid", "provider-internal"],
  ["remotefileid", "provider-internal"],
  ["vendorfileid", "provider-internal"],
  ["attachmenttoken", "provider-internal"],
  ["providertoken", "provider-internal"],
  ["hash", "provider-internal"],
  ["sha256", "provider-internal"],
  ["assethash", "provider-internal"],
  ["credentials", "credential"],
  ["credential", "credential"],
  ["apikey", "credential"],
  ["secret", "credential"],
  ["password", "credential"],
  ["authorization", "credential"],
  ["cookie", "credential"],
  ["chainofthought", "hidden-reasoning"],
  ["hiddenreasoning", "hidden-reasoning"],
  ["reasoningtrace", "hidden-reasoning"],
  ["runtimestate", "executable-payload"],
  ["rawruntimestate", "executable-payload"],
  ["executable", "executable-payload"],
  ["executablepayload", "executable-payload"],
  ["executableartifact", "executable-payload"],
  ["handler", "executable-payload"],
  ["reducer", "executable-payload"],
  ["script", "executable-payload"],
  ["bytecode", "executable-payload"],
  ["wasm", "executable-payload"],
]);

const normalizeKey = (key: string): string => key.replace(/[-_\s]/g, "").toLowerCase();
const pointerToken = (value: string): string => value.replace(/~/g, "~0").replace(/\//g, "~1");
const localPathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|file:\/\/|\/(?:Users|home|var|tmp|private|etc|opt|srv|mnt|Volumes)(?:\/|$))/i;
const credentialValuePattern = /^(?:Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,})$/i;

const diagnostic = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path: path || "/",
  message,
  severity: "error",
});

export interface CandidateSanitizerLimits {
  maxDepth?: number;
  maxValues?: number;
}

export const sanitizeStructuredCandidate = (
  input: unknown,
  limits: CandidateSanitizerLimits = {},
): CandidateSanitizationResult => {
  const diagnostics: ContractDiagnostic[] = [];
  const seen = new WeakSet<object>();
  const maxDepth = limits.maxDepth ?? 64;
  const maxValues = limits.maxValues ?? 100_000;
  let valueCount = 0;

  const visit = (value: unknown, path: string, depth: number): JsonValue | undefined => {
    valueCount += 1;
    if (valueCount > maxValues) {
      diagnostics.push(diagnostic("candidate.limit.size", path, "Candidate exceeds the value limit."));
      return undefined;
    }
    if (depth > maxDepth) {
      diagnostics.push(diagnostic("candidate.limit.depth", path, "Candidate exceeds the nesting limit."));
      return undefined;
    }
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (localPathPattern.test(value)) {
        diagnostics.push(diagnostic("candidate.forbidden.local-path", path, "Local file paths are not allowed."));
      }
      if (credentialValuePattern.test(value)) {
        diagnostics.push(diagnostic("candidate.forbidden.credential", path, "Credential-like values are not allowed."));
      }
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        diagnostics.push(diagnostic("candidate.non-json.number", path, "Numbers must be finite JSON values."));
        return undefined;
      }
      return value;
    }
    if (typeof value !== "object") {
      diagnostics.push(diagnostic(
        "candidate.non-json.value",
        path,
        `Values of type ${typeof value} are not allowed in structured candidates.`,
      ));
      return undefined;
    }
    if (seen.has(value)) {
      diagnostics.push(diagnostic("candidate.non-json.circular", path, "Circular references are not allowed."));
      return undefined;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      const result = value.map((item, index) => visit(item, `${path}/${index}`, depth + 1) ?? null);
      seen.delete(value);
      return result;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      diagnostics.push(diagnostic("candidate.non-json.prototype", path, "Only plain JSON objects are allowed."));
      seen.delete(value);
      return undefined;
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      diagnostics.push(diagnostic("candidate.non-json.symbol-key", path, "Symbol keys are not allowed."));
    }

    const result: { [key: string]: JsonValue } = Object.create(null) as { [key: string]: JsonValue };
    for (const key of Object.getOwnPropertyNames(value)) {
      const childPath = `${path}/${pointerToken(key)}`;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) {
        diagnostics.push(diagnostic("candidate.non-json.accessor", childPath, "Accessor properties are not allowed."));
        continue;
      }
      const category = forbiddenKeyCategories.get(normalizeKey(key));
      if (category) {
        diagnostics.push(diagnostic(
          `candidate.forbidden.${category}`,
          childPath,
          `Field ${key} is outside the ProcedureIR candidate boundary.`,
        ));
        continue;
      }
      const child = visit(descriptor.value, childPath, depth + 1);
      if (child !== undefined) result[key] = child;
    }
    seen.delete(value);
    return result;
  };

  const value = visit(input, "", 0);
  if (diagnostics.length > 0 || value === undefined) {
    return {
      ok: false,
      diagnostics: diagnostics.sort((left, right) =>
        left.path.localeCompare(right.path) || left.code.localeCompare(right.code)),
    };
  }
  return { ok: true, value, diagnostics: [] };
};
