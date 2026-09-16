import type { ContractDiagnostic, ContractValidationResult } from "../validation/jsonSchema";

export const evidenceRegistrySchemaVersion = "1.0" as const;
export const evidenceBundleSchemaVersion = "1.0" as const;
export const runEventSchemaVersion = "1.0" as const;

export type EvidenceDomainPackId = "core" | "chemistry" | "assay" | "causalyst";
export type AccessibleRepresentation = "text" | "table" | "chart+table" | "image+alt" | "artifact";
export type EvidenceRetentionClass = "ephemeral" | "submission" | "audit";
export type EvidenceSensitivity = "none" | "educational-record" | "user-authored";
export type EvidenceRedactionStrategy = "allowlist" | "project-derived-values" | "remove-after-projection";

export interface EvidenceRedactionPolicy {
  policyId: string;
  strategy: EvidenceRedactionStrategy;
  excludedDataCategories: string[];
}

export interface EvidenceTypeDescriptorDocument {
  id: string;
  version: string;
  domainPackId: EvidenceDomainPackId;
  title: string;
  jsonSchema: Record<string, unknown>;
  producerIds: string[];
  consumerIds: string[];
  accessibleRepresentation: AccessibleRepresentation;
  retentionClass: EvidenceRetentionClass;
  sensitivity: EvidenceSensitivity;
  redaction: EvidenceRedactionPolicy;
}

export interface EvidenceTypeDescriptor<TPayload = unknown> extends EvidenceTypeDescriptorDocument {
  validate(payload: unknown): payload is TPayload;
}

export interface EvidenceRegistryFragment {
  schema: "studio.evidence-registry-fragment";
  schemaVersion: typeof evidenceRegistrySchemaVersion;
  domainPackId: EvidenceDomainPackId;
  version: string;
  entries: EvidenceTypeDescriptorDocument[];
}

export interface EvidenceRegistryDocument {
  schema: "studio.evidence-registry";
  schemaVersion: typeof evidenceRegistrySchemaVersion;
  version: string;
  entries: EvidenceTypeDescriptorDocument[];
}

export interface EvidenceRecordMetadata {
  retentionClass: EvidenceRetentionClass;
  sensitivity: EvidenceSensitivity;
  accessibleRepresentation: AccessibleRepresentation;
  redactionPolicyId: string;
}

export interface EvidenceRecord<TPayload = Record<string, unknown>> {
  evidenceId: string;
  typeId: string;
  typeVersion: string;
  occurredAt: string;
  producerId: string;
  summary: string;
  metadata: EvidenceRecordMetadata;
  payload: TPayload;
}

export interface EvidenceBundle {
  schema: "studio.evidence-bundle";
  schemaVersion: typeof evidenceBundleSchemaVersion;
  bundleId: string;
  registryVersion: string;
  createdAt: string;
  records: EvidenceRecord[];
}

export interface RunEvent {
  schema: "studio.run-event";
  schemaVersion: typeof runEventSchemaVersion;
  eventId: string;
  sequence: number;
  eventTypeId: string;
  occurredAt: string;
  nodeId?: string;
  operationRef?: string;
  actorRole?: string;
  objectRefs: string[];
  evidenceRefs: string[];
  outcome: "accepted" | "rejected" | "recorded" | "completed";
  summary: string;
  data: Record<string, string | number | boolean | string[]>;
}

export interface RunTrace {
  schema: "studio.run-trace";
  schemaVersion: typeof runEventSchemaVersion;
  traceId: string;
  runId: string;
  startedAt: string;
  completedAt?: string;
  events: RunEvent[];
}

export interface EvidenceRegistry {
  readonly registryDocument: EvidenceRegistryDocument;
  readonly typeIds: ReadonlySet<string>;
  list(): readonly EvidenceTypeDescriptor[];
  get(typeId: string, version?: string): EvidenceTypeDescriptor | undefined;
  validatePayload(typeId: string, version: string, payload: unknown): ContractValidationResult<unknown>;
}

export interface EvidenceValidationContext {
  registry: EvidenceRegistry;
  evidenceBundle?: EvidenceBundle;
}

export type EvidenceContractValidationResult<T> =
  | { ok: true; value: T; diagnostics: ContractDiagnostic[] }
  | { ok: false; diagnostics: ContractDiagnostic[] };
