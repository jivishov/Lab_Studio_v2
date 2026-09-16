import type { ResourceRunPlan } from "../planning/types";

export const studioArtifactPackageSchemaId = "studio.artifact-package" as const;
export const studioArtifactPackageSchemaVersion = "1.0" as const;

export interface ArtifactDomainDescriptor {
  id: "chemistry" | "assay";
  version: string;
}

export interface ArtifactDescriptor {
  artifactId: string;
  artifactKind: string;
  title: string;
  version: string;
  fileName: string;
  mediaType: "application/json";
}

export interface ArtifactValidationSummary {
  ok: boolean;
  diagnostics: Array<{
    code: string;
    path: string;
    message: string;
    severity: "error" | "warning";
  }>;
}

export interface ArtifactFileDescriptor {
  id: string;
  role: "artifact" | "requirements-csv" | "preparation-checklist";
  fileName: string;
  mediaType: "application/json" | "text/csv" | "text/markdown";
  encoding: "utf-8";
  byteLength: number;
  content: string;
}

export interface StudioArtifactPackage<TArtifact extends { id: string }> {
  schema: typeof studioArtifactPackageSchemaId;
  schemaVersion: typeof studioArtifactPackageSchemaVersion;
  packageId: string;
  createdAt: string;
  domainPack: ArtifactDomainDescriptor;
  capabilityManifestVersion: string;
  artifactDescriptor: ArtifactDescriptor;
  validation: ArtifactValidationSummary;
  artifact: TArtifact;
  runPlan?: ResourceRunPlan;
  files: ArtifactFileDescriptor[];
  assumptions: string[];
  limitations: string[];
}

export interface CreateArtifactPackageInput<TArtifact extends { id: string }> {
  packageId: string;
  createdAt: string;
  domainPack: ArtifactDomainDescriptor;
  capabilityManifestVersion: string;
  artifactKind: string;
  artifactTitle: string;
  artifactVersion: string;
  artifactFileName: string;
  artifact: TArtifact;
  validation: ArtifactValidationSummary;
  runPlan?: ResourceRunPlan;
  assumptions?: string[];
  limitations?: string[];
}
