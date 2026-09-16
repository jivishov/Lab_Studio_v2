import { exportPreparationChecklist, exportRequirementsCsv } from "../planning/exports";
import { validateResourceRunPlan } from "../planning/schema";
import { serializeArtifactPackage } from "./canonical";
import { validateStudioArtifactPackage } from "./schema";
import { findForbiddenArtifactData } from "./security";
import type {
  ArtifactFileDescriptor,
  CreateArtifactPackageInput,
  StudioArtifactPackage,
} from "./types";

const safeFileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const byteLength = (content: string): number => new TextEncoder().encode(content).byteLength;

const file = (
  id: string,
  role: ArtifactFileDescriptor["role"],
  fileName: string,
  mediaType: ArtifactFileDescriptor["mediaType"],
  content: string,
): ArtifactFileDescriptor => ({ id, role, fileName, mediaType, encoding: "utf-8", byteLength: byteLength(content), content });

export const createStudioArtifactPackage = <TArtifact extends { id: string }>(
  input: CreateArtifactPackageInput<TArtifact>,
): StudioArtifactPackage<TArtifact> => {
  if (!input.packageId.trim()) throw new Error("packageId must be a non-empty string.");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("createdAt must be an ISO-8601 timestamp.");
  if (!safeFileNamePattern.test(input.artifactFileName)) throw new Error("Artifact file names must be safe basenames.");
  const leaks = findForbiddenArtifactData(input.artifact);
  if (leaks.length > 0) throw new Error(leaks.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  if (input.runPlan && !validateResourceRunPlan(input.runPlan).ok) throw new Error("runPlan failed shared schema validation.");

  const artifactContent = serializeArtifactPackage(input.artifact);
  const files: ArtifactFileDescriptor[] = [file(
    "artifact",
    "artifact",
    input.artifactFileName,
    "application/json",
    artifactContent,
  )];
  if (input.runPlan) {
    files.push(
      file("requirements", "requirements-csv", "requirements.csv", "text/csv", exportRequirementsCsv(input.runPlan)),
      file("preparation-checklist", "preparation-checklist", "preparation-checklist.md", "text/markdown", exportPreparationChecklist(input.runPlan)),
    );
  }
  const result: StudioArtifactPackage<TArtifact> = {
    schema: "studio.artifact-package",
    schemaVersion: "1.0",
    packageId: input.packageId,
    createdAt: input.createdAt,
    domainPack: { ...input.domainPack },
    capabilityManifestVersion: input.capabilityManifestVersion,
    artifactDescriptor: {
      artifactId: input.artifact.id,
      artifactKind: input.artifactKind,
      title: input.artifactTitle,
      version: input.artifactVersion,
      fileName: input.artifactFileName,
      mediaType: "application/json",
    },
    validation: structuredClone(input.validation),
    artifact: structuredClone(input.artifact),
    ...(input.runPlan ? { runPlan: structuredClone(input.runPlan) } : {}),
    files,
    assumptions: [...(input.assumptions ?? [])].sort(),
    limitations: [...(input.limitations ?? [])].sort(),
  };
  const validation = validateStudioArtifactPackage(result);
  if (!validation.ok) throw new Error(validation.diagnostics.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  return result;
};

export const roundTripStudioArtifactPackage = <TArtifact extends { id: string }>(
  artifactPackage: StudioArtifactPackage<TArtifact>,
): StudioArtifactPackage<TArtifact> => {
  const parsed: unknown = JSON.parse(serializeArtifactPackage(artifactPackage));
  const validation = validateStudioArtifactPackage(parsed);
  if (!validation.ok) throw new Error(validation.diagnostics.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  return parsed as StudioArtifactPackage<TArtifact>;
};
