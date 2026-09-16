import type { LabDefinition, TechniqueDefinition } from "../../domain/types";

export type ChemistryArtifact = LabDefinition | TechniqueDefinition;
export type ChemistryArtifactKind = "LabDefinition" | "TechniqueDefinition";

export interface ChemistryArtifactKindDiagnostic {
  code:
    | "chemistry.artifact.kind.not-object"
    | "chemistry.artifact.kind.foreign-discriminator"
    | "chemistry.artifact.kind.version-unsupported"
    | "chemistry.artifact.kind.conflicting-discriminator"
    | "chemistry.artifact.kind.ambiguous"
    | "chemistry.artifact.kind.missing";
  path: string;
  message: string;
}

export type ChemistryArtifactKindDetection =
  | { ok: true; kind: ChemistryArtifactKind }
  | { ok: false; diagnostic: ChemistryArtifactKindDiagnostic };

const explicitSchemas: Record<string, ChemistryArtifactKind> = {
  "lab-studio.lab-definition": "LabDefinition",
  "lab-studio.technique-definition": "TechniqueDefinition",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasAny = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.some((key) => Object.prototype.hasOwnProperty.call(value, key));

const fail = (
  code: ChemistryArtifactKindDiagnostic["code"],
  path: string,
  message: string,
): ChemistryArtifactKindDetection => ({ ok: false, diagnostic: { code, path, message } });

export const detectChemistryArtifactKind = (input: unknown): ChemistryArtifactKindDetection => {
  if (!isRecord(input)) {
    return fail(
      "chemistry.artifact.kind.not-object",
      "/",
      "Chemistry artifacts must be JSON objects.",
    );
  }

  const explicitSchema = typeof input.schema === "string" ? input.schema : undefined;
  const explicitKind = explicitSchema ? explicitSchemas[explicitSchema] : undefined;
  if (explicitSchema && !explicitKind) {
    return fail(
      "chemistry.artifact.kind.foreign-discriminator",
      "/schema",
      `Artifact discriminator ${explicitSchema} is not a LabDefinition or TechniqueDefinition.`,
    );
  }
  if (explicitKind && input.schemaVersion !== undefined && input.schemaVersion !== "1.0") {
    return fail(
      "chemistry.artifact.kind.version-unsupported",
      "/schemaVersion",
      `Artifact discriminator ${explicitSchema} supports schemaVersion 1.0 only.`,
    );
  }

  const labShape = hasAny(input, [
    "description",
    "audience",
    "learningGoals",
    "safetyNotes",
    "equipment",
    "techniques",
    "assessments",
  ]);
  const techniqueShape = hasAny(input, [
    "learningGoal",
    "requiredEquipment",
    "successCriteria",
    "commonMistakes",
    "resetBehavior",
  ]);

  if (explicitKind === "LabDefinition" && techniqueShape) {
    return fail(
      "chemistry.artifact.kind.conflicting-discriminator",
      "/schema",
      "The lab discriminator conflicts with TechniqueDefinition-only fields.",
    );
  }
  if (explicitKind === "TechniqueDefinition" && labShape) {
    return fail(
      "chemistry.artifact.kind.conflicting-discriminator",
      "/schema",
      "The technique discriminator conflicts with LabDefinition-only fields.",
    );
  }
  if (explicitKind) return { ok: true, kind: explicitKind };

  if (labShape && techniqueShape) {
    return fail(
      "chemistry.artifact.kind.ambiguous",
      "/",
      "Artifact contains both LabDefinition and TechniqueDefinition discriminator fields.",
    );
  }
  if (labShape) return { ok: true, kind: "LabDefinition" };
  if (techniqueShape) return { ok: true, kind: "TechniqueDefinition" };
  return fail(
    "chemistry.artifact.kind.missing",
    "/",
    "Artifact kind is missing; expected LabDefinition fields or TechniqueDefinition fields.",
  );
};

