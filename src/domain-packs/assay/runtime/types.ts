import type { AssayQuantity, PlateRuntimeState } from "../types";
import type {
  ExternalLiquidSourceState,
  LiquidSourceSelection,
  MicropipetteDefinition,
  PipetteRuntimeState,
  PipetteTipDefinition,
  PlateTargetSelection,
  TipReusePolicy,
} from "../pipetting";

export const assayOperationSchemaId = "assay-studio.operation" as const;
export const assayOperationSchemaVersion = "1.0" as const;

interface OperationBase {
  schema: typeof assayOperationSchemaId;
  schemaVersion: typeof assayOperationSchemaVersion;
  operationId: string;
}

export type AssayOperation =
  | (OperationBase & { type: "selectPipette"; pipetteId: string })
  | (OperationBase & { type: "setVolume"; pipetteId: string; volume: AssayQuantity })
  | (OperationBase & { type: "attachTips"; pipetteId: string; tipTypeId: string })
  | (OperationBase & { type: "aspirate"; pipetteId: string; source: LiquidSourceSelection })
  | (OperationBase & { type: "dispense"; pipetteId: string; target: PlateTargetSelection })
  | (OperationBase & { type: "discard"; pipetteId: string; wasteRef: string })
  | (OperationBase & { type: "mix"; pipetteId: string; target: PlateTargetSelection; cycles: number })
  | (OperationBase & { type: "ejectTips"; pipetteId: string })
  | (OperationBase & { type: "recoverInvalid"; pipetteId: string; confirmDiscard: boolean });

export type AssayRuntimeIntent =
  | { type: "selectPipette"; pipetteId: string }
  | { type: "setVolume"; pipetteId: string; volume: AssayQuantity }
  | { type: "attachTips"; pipetteId: string; tipTypeId: string }
  | { type: "aspirate"; pipetteId: string; source: LiquidSourceSelection }
  | { type: "dispense"; pipetteId: string; target: PlateTargetSelection }
  | { type: "discard"; pipetteId: string; wasteRef: string }
  | { type: "mix"; pipetteId: string; target: PlateTargetSelection; cycles: number }
  | { type: "ejectTips"; pipetteId: string }
  | { type: "recoverInvalid"; pipetteId: string; confirmDiscard: boolean };

export interface AssayRuntimeState {
  schema: "assay-studio.runtime-state";
  schemaVersion: "1.0";
  runId: string;
  plate: PlateRuntimeState;
  pipetteDefinitions: MicropipetteDefinition[];
  tipDefinitions: PipetteTipDefinition[];
  pipettes: PipetteRuntimeState[];
  liquidSources: ExternalLiquidSourceState[];
  tipReusePolicy: TipReusePolicy;
  selectedPipetteId: string;
  acceptedOperationIds: string[];
}

export interface AssayRuntimeDiagnostic {
  code: string;
  severity: "warning" | "error";
  message: string;
  operationId: string;
  recovery: string;
  objectRefs: string[];
}

export interface AssayOperationEvidence {
  typeId: "assay.pipetting-operation";
  typeVersion: "1.0.0";
  operationId: string;
  operationType: AssayOperation["type"] | "invalid";
  outcome: "accepted" | "rejected";
  summary: string;
  objectRefs: string[];
  data: Record<string, string | number | boolean | string[]>;
}

export interface AssayRuntimeTransition {
  state: AssayRuntimeState;
  accepted: boolean;
  diagnostics: AssayRuntimeDiagnostic[];
  evidence: AssayOperationEvidence;
}

export interface AssayReplayResult {
  state: AssayRuntimeState;
  transitions: AssayRuntimeTransition[];
  evidence: AssayOperationEvidence[];
}
