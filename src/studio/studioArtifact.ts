import type { LabDefinition, TechniqueDefinition } from "../domain/types";
import { emptyContents } from "../domain/types";
import { serializeLab, serializeTechnique } from "./importExport";

export type StudioArtifactKind = "lab" | "technique";

export const artifactKindLabels: Record<StudioArtifactKind, string> = {
  lab: "LAB",
  technique: "TECHNIQUE",
};

const nowIso = () => new Date().toISOString();

const slugFromTitle = (title: string, fallback: string): string => {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
};

export const createBlankStudioLab = (): LabDefinition => ({
  id: "untitled-lab",
  title: "Untitled lab",
  description: "",
  audience: "",
  learningGoals: [],
  safetyNotes: [],
  equipment: [],
  initialState: { equipment: [] },
  techniques: [],
  actions: [],
  process: {
    startNodeId: "",
    nodes: [],
    edges: [],
  },
  assessments: [],
  metadata: {
    version: "1.0.0",
    author: "Lab Studio",
    updatedAt: nowIso(),
    tags: [],
  },
});

export const createBlankStudioTechniqueLab = (): LabDefinition => {
  const draft = {
    ...createBlankStudioLab(),
    id: "untitled-technique",
    title: "Untitled technique",
    description: "Practice this technique.",
    audience: "Technique practice",
    learningGoals: ["Practice this technique."],
  };
  const technique: TechniqueDefinition = {
    id: draft.id,
    title: draft.title,
    learningGoal: draft.learningGoals[0],
    requiredEquipment: [],
    initialState: { equipment: [] },
    actions: [],
    process: draft.process,
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: { ...draft.metadata, tags: [] },
  };
  return {
    ...draft,
    techniques: [technique],
  };
};

export const deriveTechniqueFromLabDraft = (draft: LabDefinition): TechniqueDefinition => ({
  id: slugFromTitle(draft.id || draft.title, "untitled-technique"),
  title: draft.title || "Untitled technique",
  learningGoal: draft.learningGoals[0] || draft.description || draft.title || "Practice this technique.",
  requiredEquipment: [...draft.equipment],
  titrationModels: draft.titrationModels,
  chromatographyModels: draft.chromatographyModels,
  kineticsModels: draft.kineticsModels,
  initialState: {
    equipment: draft.initialState?.equipment ?? [],
  },
  actions: draft.actions,
  process: draft.process,
  successCriteria: draft.assessments,
  commonMistakes: draft.techniques[0]?.commonMistakes ?? [],
  resetBehavior: draft.techniques[0]?.resetBehavior ?? "resetTechnique",
  metadata: {
    ...(draft.techniques[0]?.metadata ?? draft.metadata),
    tags: [...draft.metadata.tags],
  },
});

export const labDraftFromTechnique = (technique: TechniqueDefinition): LabDefinition => ({
  id: technique.id,
  title: technique.title,
  description: technique.learningGoal,
  audience: "Technique practice",
  learningGoals: [technique.learningGoal],
  safetyNotes: [],
  equipment: [...technique.requiredEquipment],
  initialState: {
    equipment: technique.initialState.equipment.map((instance) => ({
      ...instance,
      contents: instance.contents ?? emptyContents(),
    })),
  },
  titrationModels: technique.titrationModels,
  chromatographyModels: technique.chromatographyModels,
  kineticsModels: technique.kineticsModels,
  techniques: [technique],
  actions: technique.actions,
  process: technique.process,
  assessments: technique.successCriteria,
  metadata: {
    ...technique.metadata,
    tags: [...technique.metadata.tags],
  },
});

export const serializeStudioArtifact = (
  kind: StudioArtifactKind,
  draft: LabDefinition,
): string => kind === "technique"
  ? serializeTechnique(deriveTechniqueFromLabDraft(draft))
  : serializeLab(draft);

export const studioArtifactFilename = (
  kind: StudioArtifactKind,
  draft: LabDefinition,
): string => {
  const id = slugFromTitle(draft.id || draft.title, kind === "technique" ? "technique" : "lab");
  return `${id}.${kind === "technique" ? "technique" : "lab"}.json`;
};
