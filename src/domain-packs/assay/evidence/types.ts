import type { DecimalString } from "../../../platform/procedure-ir/types";

export interface AssayObservationEvidencePayload {
  observationId: string;
  plateId: string;
  wellId: string;
  sourceType: "instrument-export" | "image-derived" | "manual" | "synthetic";
  value: DecimalString;
  unit: string;
  reviewStatus: "unreviewed" | "accepted" | "corrected" | "rejected";
  provenanceSourceId: string;
  provenanceSourceVersion: string;
}

export interface AssayTransferEvidencePayload {
  operationId: string;
  operationType: "aspirate" | "dispense" | "discard" | "mix";
  summary: string;
  objectRefs: string[];
  sourceRefs: string[];
  destinationRefs: string[];
  volume?: DecimalString;
  unit?: string;
}

export interface AssayCompositionEvidencePayload {
  plateId: string;
  wellId: string;
  volume: DecimalString;
  unit: string;
  mixed: boolean;
  components: Array<{
    resourceRef: string;
    volume: DecimalString;
    unit: string;
    concentration?: DecimalString;
    concentrationUnit?: string;
    sourceRefs: string[];
  }>;
}

export interface AssayQcResultEvidencePayload {
  evaluationId: string;
  ruleId: string;
  ruleType: string;
  status: "pass" | "warn" | "fail" | "indeterminate";
  summary: string;
  metricValue?: DecimalString;
  unit?: string;
  threshold?: DecimalString;
  affectedWellIds: string[];
  formulaTraceRefs: string[];
  policySourceRef: string;
}

export interface AssayNormalizedResultEvidencePayload {
  evaluationId: string;
  wellId: string;
  observationId: string;
  rawValue: DecimalString;
  correctedValue?: DecimalString;
  normalizedValue: DecimalString;
  unit: string;
  formulaTraceRef: string;
  policySourceRef: string;
}

export interface AssayFormulaTraceEvidencePayload {
  traceId: string;
  policySourceRef: string;
  formula: string;
  inputRefs: string[];
  inputValues: DecimalString[];
  result: DecimalString;
  unit: string;
  rounding: string;
}

export interface AssayEndpointCandidateEvidencePayload {
  candidateId: string;
  profileRef: string;
  status: "candidate" | "rejected" | "indeterminate";
  value?: DecimalString;
  unit?: string;
  wellIds: string[];
  formulaTraceRefs: string[];
  limitations: string[];
}

export interface AssayManualCorrectionEvidencePayload {
  correctionId: string;
  observationId: string;
  previousValue: DecimalString;
  acceptedValue: DecimalString;
  reason?: string;
  actorRole: string;
  provenanceSourceId: string;
  provenanceSourceVersion: string;
}

export interface AssayAssignmentChangeEvidencePayload {
  assignmentId: string;
  assignmentType: "control" | "replicate-group";
  targetRef: string;
  wellIds: string[];
  outcome: "accepted" | "rejected";
  summary: string;
}

export interface AssayEndpointCandidateInput {
  candidateId: string;
  profileRef: string;
  status: AssayEndpointCandidateEvidencePayload["status"];
  value?: DecimalString;
  unit?: string;
  wellIds: string[];
  formulaTraceRefs: string[];
  limitations: string[];
}
