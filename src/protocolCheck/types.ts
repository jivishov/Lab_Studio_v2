import type {
  ProtocolReportGuardIdentity,
  StageGuardIdentity,
} from "../experimentComposer/types";

export const PROTOCOL_CHECK_NAMES = Object.freeze([
  "schema_valid",
  "interaction_contracts_valid",
  "inventory_roles_resolved",
  "titration_model_derives",
  "happy_path_completes",
  "wrong_target_rejected",
  "early_endpoint_rejected",
  "premature_calculation_rejected",
  "reset_restores_initial_state",
  "limitations_present",
] as const);

export type ProtocolCheckName = (typeof PROTOCOL_CHECK_NAMES)[number];
export type ProtocolCheckStatus = "passed" | "failed";

export interface ProtocolCheckResult {
  name: ProtocolCheckName;
  status: ProtocolCheckStatus;
  message: string;
}

export interface ProtocolCheckLimitations {
  scientific: string[];
  safety: string[];
  physical: string[];
}

export interface ProtocolCheckReport extends ProtocolReportGuardIdentity {
  completedAt: string;
  checks: ProtocolCheckResult[];
  limitations: ProtocolCheckLimitations;
}

export type ProtocolCheckRunResult =
  | { status: "completed"; report: ProtocolCheckReport }
  | { status: "aborted"; stage: StageGuardIdentity; message: string };
