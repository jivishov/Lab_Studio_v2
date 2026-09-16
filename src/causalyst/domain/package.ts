import { serializeArtifactPackage } from "../../platform/artifacts/canonical";
import { validateCausalystAssessment } from "./validation";
import type {
  CausalystAssessmentDefinition,
  CausalystAssessmentPackage,
} from "./types";

const safeName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const bytes = (content: string) => new TextEncoder().encode(content).byteLength;

export const serializeCausalystAssessment = (
  assessment: CausalystAssessmentDefinition,
): string => {
  const validation = validateCausalystAssessment(assessment);
  if (!validation.ok) throw new Error(validation.diagnostics.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  return serializeArtifactPackage(validation.value);
};

export const createCausalystAssessmentPackage = (
  assessment: CausalystAssessmentDefinition,
  input: { packageId: string; createdAt: string },
): CausalystAssessmentPackage => {
  if (!input.packageId.trim()) throw new Error("packageId is required.");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("createdAt must be an ISO-8601 timestamp.");
  const assessmentContent = serializeCausalystAssessment(assessment);
  const artifactContent = serializeArtifactPackage(assessment.executableArtifact.artifact);
  const rubricContent = serializeArtifactPackage(assessment.rubric);
  const fileName = `${assessment.id}.causalyst-assessment.json`;
  if (!safeName.test(fileName)) throw new Error("Assessment ID must produce a safe portable file name.");
  return {
    schema: "causalyst.assessment-package",
    schemaVersion: "1.0",
    packageId: input.packageId,
    createdAt: input.createdAt,
    assessment: structuredClone(assessment),
    files: [
      { id: "assessment", fileName, mediaType: "application/json", byteLength: bytes(assessmentContent), content: assessmentContent },
      {
        id: "embedded-artifact",
        fileName: `${assessment.executableArtifact.artifactRef.id}.embedded-artifact.json`,
        mediaType: "application/json",
        byteLength: bytes(artifactContent),
        content: artifactContent,
      },
      { id: "rubric", fileName: `${assessment.rubric.id}.rubric.json`, mediaType: "application/json", byteLength: bytes(rubricContent), content: rubricContent },
    ],
    limitations: [
      "This local package contains no learner identity or durable submission.",
      "Rubric results are provisional until a teacher reviews the evidence.",
      "Prompt-to-simulation, trace replay, LTI, AGS, QTI, and final grades are not included.",
    ],
  };
};

export const serializeCausalystAssessmentPackage = (
  value: CausalystAssessmentPackage,
): string => serializeArtifactPackage(value);

export const parseCausalystAssessment = (text: string): CausalystAssessmentDefinition => {
  const candidate: unknown = JSON.parse(text);
  const validation = validateCausalystAssessment(candidate);
  if (!validation.ok) throw new Error(validation.diagnostics.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  return validation.value;
};

export const parseCausalystAssessmentImport = (text: string): CausalystAssessmentDefinition => {
  const candidate: unknown = JSON.parse(text);
  if (!candidate || typeof candidate !== "object" || (candidate as Record<string, unknown>).schema !== "causalyst.assessment-package") {
    return parseCausalystAssessment(text);
  }
  const value = candidate as Partial<CausalystAssessmentPackage>;
  if (value.schemaVersion !== "1.0" || !value.assessment || !Array.isArray(value.files)) {
    throw new Error("Causalyst assessment package is malformed or uses an unsupported version.");
  }
  const assessment = parseCausalystAssessment(JSON.stringify(value.assessment));
  const assessmentFile = value.files.find(({ id }) => id === "assessment");
  const artifactFile = value.files.find(({ id }) => id === "embedded-artifact");
  if (!assessmentFile || assessmentFile.content !== serializeCausalystAssessment(assessment)) {
    throw new Error("Causalyst package assessment file does not match the canonical assessment.");
  }
  if (!artifactFile || artifactFile.content !== serializeArtifactPackage(assessment.executableArtifact.artifact)) {
    throw new Error("Causalyst package embedded artifact does not match the assessment.");
  }
  return assessment;
};
