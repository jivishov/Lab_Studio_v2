import { stripRuntimeOnlyFields } from "../studio/runtimeOnlyFields";

const keySorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(keySorted);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, keySorted(child)]),
  );
};

export const stableStrippedJson = (value: unknown): string =>
  JSON.stringify(keySorted(stripRuntimeOnlyFields(value)));

export const stableValueHash = (value: unknown): string => {
  const serialized = stableStrippedJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/** FNV-1a is used only for deterministic change identity, never for cryptographic security. */
export const stableValueFingerprint = (label: string, value: unknown): string =>
  `${label}-fnv1a-${stableValueHash(value)}`;

export const stableDraftFingerprint = (value: unknown): string =>
  stableValueFingerprint("draft", value);
