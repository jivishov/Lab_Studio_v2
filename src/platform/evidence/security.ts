import type { ContractDiagnostic } from "../validation/jsonSchema";

export const forbiddenEvidenceDataCategories = [
  "raw-prompts",
  "raw-images",
  "pointer-data",
  "camera-gesture-data",
  "local-paths",
  "credentials",
  "hashes-provider-internals",
  "runtime-state",
  "hidden-reasoning",
] as const;

const forbiddenKeys = new Map<string, string>([
  ["prompt", "raw-prompts"], ["rawprompt", "raw-prompts"], ["prompttext", "raw-prompts"], ["systemprompt", "raw-prompts"], ["modelprompt", "raw-prompts"],
  ["image", "raw-images"], ["rawimage", "raw-images"], ["imagedata", "raw-images"], ["imagebytes", "raw-images"], ["pixels", "raw-images"], ["screenshot", "raw-images"],
  ["pointer", "pointer-data"], ["pointerdata", "pointer-data"], ["pointercoordinates", "pointer-data"], ["clientx", "pointer-data"], ["clienty", "pointer-data"], ["pagex", "pointer-data"], ["pagey", "pointer-data"], ["screenx", "pointer-data"], ["screeny", "pointer-data"], ["cursorposition", "pointer-data"],
  ["camera", "camera-gesture-data"], ["cameradata", "camera-gesture-data"], ["cameraframe", "camera-gesture-data"], ["video", "camera-gesture-data"], ["gesture", "camera-gesture-data"], ["gesturedata", "camera-gesture-data"], ["landmarks", "camera-gesture-data"], ["handlandmarks", "camera-gesture-data"],
  ["path", "local-paths"], ["filepath", "local-paths"], ["localpath", "local-paths"], ["absolutepath", "local-paths"], ["assetpath", "local-paths"], ["sourcepath", "local-paths"],
  ["credential", "credentials"], ["credentials", "credentials"], ["password", "credentials"], ["passphrase", "credentials"], ["apikey", "credentials"], ["authorization", "credentials"], ["cookie", "credentials"], ["accesstoken", "credentials"], ["refreshtoken", "credentials"], ["secret", "credentials"],
  ["hash", "hashes-provider-internals"], ["sha256", "hashes-provider-internals"], ["sha1", "hashes-provider-internals"], ["checksum", "hashes-provider-internals"], ["digest", "hashes-provider-internals"], ["fileid", "hashes-provider-internals"], ["providerfileid", "hashes-provider-internals"], ["remotefileid", "hashes-provider-internals"], ["vendorfileid", "hashes-provider-internals"], ["providerresponse", "hashes-provider-internals"], ["rawresponse", "hashes-provider-internals"], ["providerinternals", "hashes-provider-internals"], ["vendorinternals", "hashes-provider-internals"], ["modeloutput", "hashes-provider-internals"],
  ["runtimestate", "runtime-state"], ["rawruntimestate", "runtime-state"], ["statesnapshot", "runtime-state"], ["internalstate", "runtime-state"], ["serializedstate", "runtime-state"],
  ["chainofthought", "hidden-reasoning"], ["hiddenreasoning", "hidden-reasoning"], ["reasoning", "hidden-reasoning"], ["reasoningtrace", "hidden-reasoning"], ["scratchpad", "hidden-reasoning"],
]);

const normalizeKey = (key: string): string => key.replace(/[-_\s]/g, "").toLowerCase();
const pointerToken = (value: string): string => value.replace(/~/g, "~0").replace(/\//g, "~1");
const localPathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|file:\/\/|\/(?:Users|home|var|tmp|private|etc|opt|srv|mnt|Volumes)(?:\/|$))/i;
const credentialPattern = /(?:^Bearer\s+\S+|^sk-[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const rawImagePattern = /^data:image\//i;
const providerFilePattern = /^file-[A-Za-z0-9_-]{8,}$/i;
const hashPattern = /^[a-f0-9]{64}$/i;

const diagnostic = (category: string, path: string, message: string): ContractDiagnostic => ({
  code: `evidence.forbidden.${category}`,
  path: path || "/",
  message,
  severity: "error",
});

export const findForbiddenEvidenceData = (input: unknown, rootPath = ""): ContractDiagnostic[] => {
  const diagnostics: ContractDiagnostic[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (localPathPattern.test(value)) diagnostics.push(diagnostic("local-paths", path, "Local file paths are forbidden in evidence and run events."));
      if (credentialPattern.test(value)) diagnostics.push(diagnostic("credentials", path, "Credential-like values are forbidden in evidence and run events."));
      if (rawImagePattern.test(value)) diagnostics.push(diagnostic("raw-images", path, "Raw image data is forbidden in evidence and run events."));
      if (providerFilePattern.test(value) || hashPattern.test(value)) diagnostics.push(diagnostic("hashes-provider-internals", path, "Hashes and provider file handles are forbidden in evidence and run events."));
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) {
      diagnostics.push(diagnostic("runtime-state", path, "Circular or live runtime objects are forbidden in evidence and run events."));
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}/${index}`));
    } else {
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        const childPath = `${path}/${pointerToken(key)}`;
        const category = forbiddenKeys.get(normalizeKey(key));
        if (category) diagnostics.push(diagnostic(category, childPath, `Field ${key} is forbidden in evidence and run events.`));
        visit(child, childPath);
      });
    }
    seen.delete(value);
  };
  visit(input, rootPath);
  return diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};
