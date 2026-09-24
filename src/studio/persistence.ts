import type { LabDefinition } from "../domain/types";
import { validateLabDefinition } from "../domain/validation";
import type { StudioArtifactKind } from "./studioArtifact";
import {
  normalizeStudioDefinitionCandidate,
  normalizeStudioLabDraft,
} from "./draftNormalizer";
import { stripRuntimeOnlyFields } from "./runtimeOnlyFields";

export const DRAFT_STORAGE_KEY = "lab-studio:v1:draft";

const isStudioArtifactKind = (value: unknown): value is StudioArtifactKind =>
  value === "lab" || value === "technique";

export interface SavedStudioDraft {
  draft: LabDefinition;
  artifactKind: StudioArtifactKind;
}

/**
 * `key` lets another Studio keep its draft apart (Lab Studio 3D uses `lab-studio:3d:v1:draft`);
 * every caller that omits it reads and writes the original Studio's draft, as before.
 */
export const saveDraft = (draft: LabDefinition, artifactKind: StudioArtifactKind = "lab", key = DRAFT_STORAGE_KEY): void => {
  window.localStorage.setItem(
    key,
    JSON.stringify({ version: 2, savedAt: new Date().toISOString(), artifactKind, draft: stripRuntimeOnlyFields(draft) }),
  );
};

export const loadDraftArtifact = (key = DRAFT_STORAGE_KEY): SavedStudioDraft | undefined => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { draft?: unknown; artifactKind?: unknown };
    const validation = validateLabDefinition(normalizeStudioDefinitionCandidate(parsed.draft));
    return validation.ok && validation.value
      ? {
          draft: normalizeStudioLabDraft(validation.value),
          artifactKind: isStudioArtifactKind(parsed.artifactKind) ? parsed.artifactKind : "lab",
        }
      : undefined;
  } catch {
    return undefined;
  }
};

export const loadDraft = (key = DRAFT_STORAGE_KEY): LabDefinition | undefined => loadDraftArtifact(key)?.draft;

export const clearDraft = (key = DRAFT_STORAGE_KEY): void => {
  window.localStorage.removeItem(key);
};
