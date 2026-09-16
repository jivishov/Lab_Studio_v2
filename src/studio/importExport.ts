import type { LabDefinition, TechniqueDefinition, ValidationResult } from "../domain/types";
import {
  validateImportedDefinition,
  validateLabDefinition,
  validateTechniqueDefinition,
} from "../domain/validation";
import {
  normalizeStudioDefinitionCandidate,
  normalizeStudioLabDraft,
  normalizeStudioTechniqueDraft,
} from "./draftNormalizer";
import { stripRuntimeOnlyFields } from "./runtimeOnlyFields";

/**
 * Studio artifacts are portable and self-contained: whoever opens one must get the same lab without
 * also fetching a technique catalogue at a pinned version. A draft therefore always carries its
 * resolved action array, and an exported artifact never carries an unresolved bundled reference —
 * `loadBundledLab` has already hydrated anything that arrived from `public/labs/`.
 */
const withoutBundledReferences = (lab: LabDefinition): LabDefinition => {
  if (!("techniqueRefs" in lab)) return lab;
  const portable = { ...lab } as LabDefinition & { techniqueRefs?: unknown };
  delete portable.techniqueRefs;
  return portable;
};

export const serializeLab = (lab: LabDefinition): string => {
  const portable = withoutBundledReferences(lab);
  const validation = validateLabDefinition(portable);
  if (!validation.ok) {
    throw new Error(validation.errors.join("\n"));
  }
  return JSON.stringify(stripRuntimeOnlyFields(portable), null, 2);
};

export const serializeTechnique = (technique: TechniqueDefinition): string => {
  const validation = validateTechniqueDefinition(technique);
  if (!validation.ok) {
    throw new Error(validation.errors.join("\n"));
  }
  return JSON.stringify(stripRuntimeOnlyFields(technique), null, 2);
};

export const parseImportedJson = (
  text: string,
): ValidationResult<LabDefinition | TechniqueDefinition> => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      "techniqueRefs" in parsed
    ) {
      // Silently dropping the references would import a lab missing the actions its process needs,
      // and Studio cannot fetch the pinned techniques from inside a synchronous parse. Say so.
      return {
        ok: false,
        errors: [
          "This is a bundled lab source with unresolved techniqueRefs, not a self-contained lab.",
          "Open it from the lab library instead — that path resolves the pinned technique actions before Studio sees the draft.",
        ],
      };
    }
    const validation = validateImportedDefinition(normalizeStudioDefinitionCandidate(parsed));
    if (!validation.ok || !validation.value) return validation;
    return {
      ok: true,
      value: "audience" in validation.value
        ? normalizeStudioLabDraft(validation.value)
        : normalizeStudioTechniqueDraft(validation.value),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "Unable to parse imported JSON."],
    };
  }
};

export const downloadJson = (filename: string, contents: string): void => {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
