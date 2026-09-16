import type { EvidenceTypeDescriptorDocument } from "../../../platform/evidence";
import { forbiddenEvidenceDataCategories } from "../../../platform/evidence/security";
import type { AssayOperation, AssayOperationEvidence } from "./types";

export const ASSAY_PIPETTING_EVIDENCE_TYPE_ID = "assay.pipetting-operation" as const;
export const ASSAY_PIPETTING_EVIDENCE_TYPE_VERSION = "1.0.0" as const;

export const assayPipettingEvidenceDescriptor: EvidenceTypeDescriptorDocument = Object.freeze<EvidenceTypeDescriptorDocument>({
  id: ASSAY_PIPETTING_EVIDENCE_TYPE_ID,
  version: ASSAY_PIPETTING_EVIDENCE_TYPE_VERSION,
  domainPackId: "assay",
  title: "Assay pipetting operation",
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["typeId", "typeVersion", "operationId", "operationType", "outcome", "summary", "objectRefs", "data"],
    properties: {
      typeId: { const: ASSAY_PIPETTING_EVIDENCE_TYPE_ID },
      typeVersion: { const: ASSAY_PIPETTING_EVIDENCE_TYPE_VERSION },
      operationId: { type: "string", minLength: 1 },
      operationType: { enum: ["selectPipette", "setVolume", "attachTips", "aspirate", "dispense", "discard", "mix", "ejectTips", "recoverInvalid", "invalid"] },
      outcome: { enum: ["accepted", "rejected"] },
      summary: { type: "string", minLength: 1 },
      objectRefs: { type: "array", items: { type: "string" } },
      data: { type: "object", additionalProperties: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "array", items: { type: "string" } }] } },
    },
  },
  producerIds: ["assay.runtime.reducer"],
  consumerIds: ["assay.runtime.replay", "assay.player.operation-history"],
  accessibleRepresentation: "table",
  retentionClass: "ephemeral",
  sensitivity: "none",
  redaction: {
    policyId: "assay.pipetting-operation.allowlist.v1",
    strategy: "allowlist",
    excludedDataCategories: [...forbiddenEvidenceDataCategories],
  },
});

export const getAssayPipettingEvidenceRegistryDescriptors = (): EvidenceTypeDescriptorDocument[] =>
  [structuredClone(assayPipettingEvidenceDescriptor)];

export const projectAssayOperationEvidence = (
  operation: AssayOperation | null,
  accepted: boolean,
  summary: string,
  objectRefs: readonly string[],
  data: AssayOperationEvidence["data"] = {},
): AssayOperationEvidence => ({
  typeId: ASSAY_PIPETTING_EVIDENCE_TYPE_ID,
  typeVersion: ASSAY_PIPETTING_EVIDENCE_TYPE_VERSION,
  operationId: operation?.operationId ?? "invalid-operation",
  operationType: operation?.type ?? "invalid",
  outcome: accepted ? "accepted" : "rejected",
  summary,
  objectRefs: [...objectRefs],
  data: structuredClone(data),
});
