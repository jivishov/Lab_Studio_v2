import type { ContractDiagnostic } from "../validation/jsonSchema";

const forbiddenKeys = new Set([
  "absolutepath", "filepath", "localpath", "assetpath", "generatedassetpath",
  "providerfileid", "remotefileid", "vendorfileid", "fileid", "sha256", "sha1",
  "checksum", "digest", "hash", "credentials", "credential", "apikey", "secret",
  "password", "authorization", "cookie", "accesstoken", "refreshtoken", "chainofthought",
  "hiddenreasoning", "reasoningtrace", "scratchpad", "runtimestate", "rawruntimestate",
  "providerresponse", "rawresponse", "modeloutput", "providerinternals", "vendorinternals",
]);
const normalizeKey = (key: string): string => key.replace(/[-_\s]/g, "").toLowerCase();
const localPathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|file:\/\/|\/(?:Users|home|var|tmp|private|etc|opt|srv|mnt|Volumes)(?:\/|$))/i;
const credentialPattern = /(?:^Bearer\s+\S+|^sk-[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const providerFilePattern = /^file-[A-Za-z0-9_-]{8,}$/i;
const hashPattern = /^[a-f0-9]{64}$/i;

export const findForbiddenArtifactData = (input: unknown): ContractDiagnostic[] => {
  const diagnostics: ContractDiagnostic[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (localPathPattern.test(value)) diagnostics.push({ code: "artifact.forbidden.local-path", path: path || "/", message: "Local paths are forbidden in artifact packages.", severity: "error" });
      if (credentialPattern.test(value)) diagnostics.push({ code: "artifact.forbidden.credential", path: path || "/", message: "Credentials are forbidden in artifact packages.", severity: "error" });
      if (providerFilePattern.test(value) || hashPattern.test(value)) diagnostics.push({ code: "artifact.forbidden.provider-internal", path: path || "/", message: "Provider handles and hashes are forbidden in artifact packages.", severity: "error" });
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) {
      diagnostics.push({ code: "artifact.forbidden.circular", path: path || "/", message: "Live or circular objects are forbidden in artifact packages.", severity: "error" });
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) value.forEach((child, index) => visit(child, `${path}/${index}`));
    else Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const childPath = `${path}/${key}`;
      if (forbiddenKeys.has(normalizeKey(key))) diagnostics.push({
        code: "artifact.forbidden.field",
        path: childPath,
        message: `Field ${key} is forbidden in artifact packages.`,
        severity: "error",
      });
      visit(child, childPath);
    });
    seen.delete(value);
  };
  visit(input, "");
  return diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};
