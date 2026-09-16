export const fidelityLevels = ["F0", "F1", "F2", "F3", "F4"] as const;

export type FidelityLevel = (typeof fidelityLevels)[number];

export type SupportClassification = "runnable" | "representable" | "unsupported";

export type FidelityLimitationKind =
  | "scope"
  | "validity"
  | "missing-proof"
  | "missing-capability"
  | "accessibility";

export interface FidelityLimitation {
  id: string;
  kind: FidelityLimitationKind;
  code: string;
  message: string;
  appliesToRef: string;
}

export type FidelityComparisonStatus = "meets" | "representable-only" | "insufficient";

export interface FidelityComparison {
  requested: FidelityLevel;
  supported: FidelityLevel;
  meetsRequest: boolean;
  status: FidelityComparisonStatus;
  limitations: FidelityLimitation[];
}

export type MissingSupportRequirement =
  | "object"
  | "operation"
  | "model"
  | "evidence"
  | "accessible-path";

export interface ClaimSupportAssessment {
  claimId: string;
  outcome: string;
  essential: boolean;
  quantitative: boolean;
  requestedFidelity: FidelityLevel;
  supportedFidelity: FidelityLevel;
  missingRequirements: MissingSupportRequirement[];
  limitations: FidelityLimitation[];
}

export interface ClassifiedClaimSupport extends ClaimSupportAssessment {
  comparison: FidelityComparison;
  classification: SupportClassification;
}

export interface AggregateSupportClassification {
  schema: "studio.fidelity-assessment";
  schemaVersion: "1.0";
  classification: SupportClassification;
  claims: ClassifiedClaimSupport[];
  limitations: FidelityLimitation[];
}
