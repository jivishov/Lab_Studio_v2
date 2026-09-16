import { canonicalSerializeJson } from "../procedure-ir/canonical";
import type { EvidenceBundle, EvidenceRegistry, RunTrace } from "./types";
import { validateEvidenceBundle, validateRunTrace } from "./validation";

const resultOrThrow = <T>(result: { ok: true; value: T } | { ok: false; diagnostics: Array<{ code: string; path: string }> }): T => {
  if (!result.ok) throw new Error(result.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "));
  return result.value;
};

export const serializeEvidenceBundle = (bundle: EvidenceBundle, registry: EvidenceRegistry): string =>
  canonicalSerializeJson(resultOrThrow(validateEvidenceBundle(bundle, registry)));

export const parseEvidenceBundle = (serialized: string, registry: EvidenceRegistry): EvidenceBundle =>
  resultOrThrow(validateEvidenceBundle(JSON.parse(serialized) as unknown, registry));

export const serializeRunTrace = (
  trace: RunTrace,
  registry: EvidenceRegistry,
  bundle?: EvidenceBundle,
): string => canonicalSerializeJson(resultOrThrow(validateRunTrace(trace, registry, bundle)));

export const parseRunTrace = (
  serialized: string,
  registry: EvidenceRegistry,
  bundle?: EvidenceBundle,
): RunTrace => resultOrThrow(validateRunTrace(JSON.parse(serialized) as unknown, registry, bundle));
