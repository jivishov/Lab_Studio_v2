import { parseCausalystAssessmentImport } from "../domain/package";
import type { CausalystAssessmentDefinition } from "../domain/types";
import { validateCausalystAssessment } from "../domain/validation";

export const causalystLocalLibraryKey = "lab-studio:causalyst:v1:assessments";

export const loadLocalAssessments = (): CausalystAssessmentDefinition[] => {
  const raw = window.localStorage.getItem(causalystLocalLibraryKey);
  if (!raw) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return values.flatMap((value) => {
      const validation = validateCausalystAssessment(value);
      return validation.ok ? [validation.value] : [];
    });
  } catch {
    return [];
  }
};

export const saveLocalAssessment = (
  assessment: CausalystAssessmentDefinition,
): CausalystAssessmentDefinition[] => {
  const validation = validateCausalystAssessment(assessment);
  if (!validation.ok) throw new Error(validation.diagnostics.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  const next = [
    validation.value,
    ...loadLocalAssessments().filter(({ id }) => id !== validation.value.id),
  ];
  window.localStorage.setItem(causalystLocalLibraryKey, JSON.stringify(next));
  return next;
};

export const importLocalAssessment = (text: string) => saveLocalAssessment(parseCausalystAssessmentImport(text))[0];

export const getLocalAssessment = (id: string): CausalystAssessmentDefinition | undefined =>
  loadLocalAssessments().find((assessment) => assessment.id === id);
