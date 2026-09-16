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

export const saveDraft = (draft: LabDefinition, artifactKind: StudioArtifactKind = "lab"): void => {
  window.localStorage.setItem(
    DRAFT_STORAGE_KEY,
    JSON.stringify({ version: 2, savedAt: new Date().toISOString(), artifactKind, draft: stripRuntimeOnlyFields(draft) }),
  );
};

export const loadDraftArtifact = (): SavedStudioDraft | undefined => {
  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
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

export const loadDraft = (): LabDefinition | undefined => loadDraftArtifact()?.draft;

export const clearDraft = (): void => {
  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
};
