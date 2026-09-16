import type { ScalarOrQuantity } from "../procedure-ir/types";
import type { FidelityLevel } from "../fidelity/types";

export const capabilityManifestSchemaId = "studio.capability-manifest" as const;
export const capabilityManifestFragmentSchemaId = "studio.capability-manifest-fragment" as const;
export const capabilityManifestSchemaVersion = "2.0" as const;

export type CapabilityDomainPackId = "chemistry" | "assay";
export type CapabilityKind =
  | "object"
  | "operation"
  | "interaction"
  | "model"
  | "evidence"
  | "planning"
  | "export";

export interface CapabilityRef {
  domainPackId: CapabilityDomainPackId;
  kind: CapabilityKind;
  id: string;
  version: string;
}

export type CapabilityProofKind =
  | "runtime-handler"
  | "interaction-implementation"
  | "deterministic-model"
  | "validator"
  | "evidence-producer"
  | "accessible-path"
  | "representative-content-fixture"
  | "regression-test"
  | "protocol-profile"
  | "limitation-document";

export interface CapabilityProofRef {
  proofId: string;
  kind: CapabilityProofKind;
}

export interface CapabilityImplementationRef {
  source: string;
  exportName?: string;
}

export interface DeterministicModelProof {
  deterministic: true;
  formula: string;
  validityLimits: string[];
}

export interface CalibrationReferenceProof {
  referenceId: string;
  title: string;
  version: string;
  referenceKind: "dataset" | "method" | "protocol" | "profile";
  validityLimits: string[];
}

export interface CapabilityProof {
  id: string;
  kind: CapabilityProofKind;
  title: string;
  implementation?: CapabilityImplementationRef;
  model?: DeterministicModelProof;
  reference?: CalibrationReferenceProof;
  dependsOnProofRefs: string[];
  evidenceTypeIds: string[];
  accessiblePathIds: string[];
  limitations: string[];
}

export interface AccessiblePathDescriptor {
  id: string;
  title: string;
  modes: Array<"keyboard" | "pointer" | "screen-reader" | "accessible-process">;
  implementation: CapabilityImplementationRef;
  limitations: string[];
}

export interface CapabilityClaim {
  id: string;
  outcome: string;
  maximumFidelity: FidelityLevel;
  validityRange?: Record<string, ScalarOrQuantity | ScalarOrQuantity[]>;
  proofRefs: CapabilityProofRef[];
  requiredEvidenceTypeIds: string[];
  requiredAccessiblePathIds: string[];
}

export interface CapabilityEntry {
  ref: CapabilityRef;
  title: string;
  summary: string;
  tags: string[];
  claims: CapabilityClaim[];
  dependencies: CapabilityRef[];
  accessiblePathIds: string[];
  exampleIds: string[];
  limitations: string[];
}

export interface DomainPackSummary {
  id: CapabilityDomainPackId;
  version: string;
  title: string;
  limitations: string[];
}

export interface CapabilityEdge {
  from: CapabilityRef;
  to: CapabilityRef;
  relationship: "requires" | "works-with" | "alternative-to";
}

export interface CapabilityExample {
  id: string;
  title: string;
  artifactRef: string;
  capabilityRefs: CapabilityRef[];
  limitations: string[];
}

export interface CapabilityManifestFragment {
  schema: typeof capabilityManifestFragmentSchemaId;
  schemaVersion: typeof capabilityManifestSchemaVersion;
  studioCoreVersion: string;
  domainPack: DomainPackSummary;
  entries: CapabilityEntry[];
  proofs: CapabilityProof[];
  accessiblePaths: AccessiblePathDescriptor[];
  compatibilityEdges: CapabilityEdge[];
  examples: CapabilityExample[];
}

export interface CapabilityManifest {
  schema: typeof capabilityManifestSchemaId;
  schemaVersion: typeof capabilityManifestSchemaVersion;
  studioCoreVersion: string;
  generatedAt: string;
  domainPacks: DomainPackSummary[];
  entries: CapabilityEntry[];
  proofs: CapabilityProof[];
  accessiblePaths: AccessiblePathDescriptor[];
  compatibilityEdges: CapabilityEdge[];
  exampleIndex: CapabilityExample[];
}
