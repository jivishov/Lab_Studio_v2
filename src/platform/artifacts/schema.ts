import studioArtifactPackageSchemaDocument from "./studio-artifact-package.schema.json";
import {
  compileJsonSchemaValidator,
  validateWithJsonSchema,
  type ContractValidationResult,
} from "../validation/jsonSchema";
import { findForbiddenArtifactData } from "./security";
import type { StudioArtifactPackage } from "./types";
import { serializeArtifactPackage } from "./canonical";
import { validateResourceRunPlan } from "../planning/schema";

export const studioArtifactPackageSchema = studioArtifactPackageSchemaDocument as Record<string, unknown>;
const validateSchema = compileJsonSchemaValidator<StudioArtifactPackage<{ id: string }>>(studioArtifactPackageSchema);

export const validateStudioArtifactPackage = (
  input: unknown,
): ContractValidationResult<StudioArtifactPackage<{ id: string }>> => {
  const schemaResult = validateWithJsonSchema(validateSchema, input);
  if (!schemaResult.ok) return schemaResult;
  if (!Number.isFinite(Date.parse(schemaResult.value.createdAt))) return {
    ok: false,
    diagnostics: [{ code: "artifact-package.created-at.invalid", path: "/createdAt", message: "createdAt must be an ISO-8601 timestamp.", severity: "error" }],
  };
  if (schemaResult.value.artifact.id !== schemaResult.value.artifactDescriptor.artifactId) return {
    ok: false,
    diagnostics: [{ code: "artifact-package.artifact-id.mismatch", path: "/artifactDescriptor/artifactId", message: "Artifact descriptor ID must match artifact.id.", severity: "error" }],
  };
  const leaks = findForbiddenArtifactData(schemaResult.value.artifact);
  if (leaks.length > 0) return { ok: false, diagnostics: leaks };
  const ids = new Set<string>();
  const duplicate = schemaResult.value.files.find(({ id }) => ids.has(id) || !ids.add(id));
  if (duplicate) return {
    ok: false,
    diagnostics: [{ code: "artifact-package.file-id.duplicate", path: "/files", message: `File ID ${duplicate.id} is duplicated.`, severity: "error" }],
  };
  const fileLengthMismatch = schemaResult.value.files.find(({ byteLength, content }) =>
    byteLength !== new TextEncoder().encode(content).byteLength);
  if (fileLengthMismatch) return {
    ok: false,
    diagnostics: [{ code: "artifact-package.file-length.mismatch", path: "/files", message: `File ${fileLengthMismatch.id} byteLength does not match its UTF-8 content.`, severity: "error" }],
  };
  const artifactFiles = schemaResult.value.files.filter(({ role }) => role === "artifact");
  if (artifactFiles.length !== 1
    || artifactFiles[0].fileName !== schemaResult.value.artifactDescriptor.fileName
    || artifactFiles[0].content !== serializeArtifactPackage(schemaResult.value.artifact)) return {
    ok: false,
    diagnostics: [{ code: "artifact-package.artifact-file.mismatch", path: "/files", message: "Exactly one artifact file must match the descriptor and canonical artifact content.", severity: "error" }],
  };
  if (schemaResult.value.runPlan && !validateResourceRunPlan(schemaResult.value.runPlan).ok) return {
    ok: false,
    diagnostics: [{ code: "artifact-package.run-plan.invalid", path: "/runPlan", message: "Embedded runPlan failed shared schema validation.", severity: "error" }],
  };
  return schemaResult;
};
