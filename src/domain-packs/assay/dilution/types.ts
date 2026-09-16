import type { DecimalString } from "../../../platform/procedure-ir/types";
import type { AssayQuantity } from "../types/types";

export const serialDilutionPlanSchema = "assay.serial-dilution-plan" as const;
export const serialDilutionPlanSchemaVersion = "1.0" as const;

export type DilutionRoundingPolicy =
  | { mode: "reject-non-terminating" }
  | {
      mode: "decimal-places";
      decimalPlaces: number;
      tieBreaking: "half-up" | "half-even";
    };

export type DilutionSeriesPolicy =
  | {
      kind: "factor";
      factor: DecimalString;
      pointCount: number;
    }
  | {
      kind: "targets";
      concentrations: AssayQuantity[];
      tolerance:
        | { kind: "absolute"; value: AssayQuantity }
        | { kind: "relative-percent"; percent: DecimalString };
    };

/**
 * `finalVolume` is the mixed volume at which the requested concentration is
 * evaluated. The retained terminal volume can be lower after a carry-forward
 * transfer or an explicit final discard, and is reported separately.
 */
export type DilutionVolumePolicy =
  | {
      kind: "fixed";
      transferVolume: AssayQuantity;
      diluentVolume: AssayQuantity;
      finalVolume: AssayQuantity;
    }
  | {
      kind: "derive-transfer";
      finalVolume: AssayQuantity;
    };

export type DilutionMixingPolicy =
  | { kind: "mix-each-point"; cycles: number }
  | { kind: "none" };

export type DilutionDiscardPolicy =
  | { kind: "discard-final-transfer"; volume: AssayQuantity }
  | { kind: "retain-final-mixture" };

export type DilutionMonotonicityPolicy =
  | "strictly-decreasing"
  | "non-increasing"
  | "none";

export type DilutionTransferOrientation = "single" | "row" | "column";

export interface DilutionTargetMapping {
  targetId: string;
  plateId?: string;
  coordinate?: string;
  channelIndex: number;
  channelCount: 1 | 8 | 12;
  orientation: DilutionTransferOrientation;
}

export interface DilutionTargetGroup {
  id: string;
  targets: DilutionTargetMapping[];
}

export interface DilutionSourceSpec {
  id: string;
  concentration: AssayQuantity;
  availableVolume: AssayQuantity;
  mixed: boolean;
  concentrationBasis: "amount-per-volume";
}

export interface DiluentSourceSpec {
  id: string;
  availableVolume: AssayQuantity;
}

/** Generic executor constraint; the pipetting runtime resolves `deviceRef`. */
export interface DilutionTransferDeviceSpec {
  deviceRef: string;
  channels: 1 | 8 | 12;
  minimumVolume: AssayQuantity;
  maximumVolume: AssayQuantity;
  increment: AssayQuantity;
}

export interface SerialDilutionInput {
  planId: string;
  source: DilutionSourceSpec;
  diluent: DiluentSourceSpec;
  transferDevice: DilutionTransferDeviceSpec;
  targetGroups: DilutionTargetGroup[];
  series: DilutionSeriesPolicy;
  volumePolicy: DilutionVolumePolicy;
  mixingPolicy: DilutionMixingPolicy;
  discardPolicy: DilutionDiscardPolicy;
  monotonicity: DilutionMonotonicityPolicy;
  rounding: DilutionRoundingPolicy;
}

export type DilutionDiagnosticCode =
  | "assay.dilution.id.invalid"
  | "assay.dilution.decimal.invalid"
  | "assay.dilution.unit.invalid"
  | "assay.dilution.quantity.non-positive"
  | "assay.dilution.source.unmixed"
  | "assay.dilution.factor.invalid"
  | "assay.dilution.point-count.invalid"
  | "assay.dilution.targets.invalid"
  | "assay.dilution.mapping.invalid"
  | "assay.dilution.mapping.duplicate"
  | "assay.dilution.volume.inconsistent"
  | "assay.dilution.volume.insufficient-source"
  | "assay.dilution.volume.insufficient-diluent"
  | "assay.dilution.transfer.infeasible"
  | "assay.dilution.transfer.device-incompatible"
  | "assay.dilution.target.unachievable"
  | "assay.dilution.monotonicity.invalid"
  | "assay.dilution.mixing.required"
  | "assay.dilution.rounding.invalid"
  | "assay.dilution.rounding.required"
  | "assay.dilution.discard.invalid";

export interface DilutionDiagnostic {
  code: DilutionDiagnosticCode;
  path: string;
  message: string;
  severity: "error";
}

export interface DilutionFormulaTerm {
  label: string;
  expression: string;
  result: AssayQuantity;
}

export interface DilutionFormulaTrace {
  sourceId: string;
  targetId: string;
  concentrationBasis: "amount-per-volume";
  sourceConcentration: AssayQuantity;
  requestedConcentration: AssayQuantity;
  achievedConcentration: AssayQuantity;
  transferVolume: AssayQuantity;
  diluentVolume: AssayQuantity;
  mixedVolume: AssayQuantity;
  retainedVolume: AssayQuantity;
  incomingAnalyteAmount: AssayQuantity;
  mixedAnalyteAmount: AssayQuantity;
  retainedAnalyteAmount: AssayQuantity;
  outgoingAnalyteAmount: AssayQuantity;
  equations: DilutionFormulaTerm[];
  roundingPolicy: DilutionRoundingPolicy;
  roundingApplied: boolean;
}

export interface DilutionPlannedTarget {
  mapping: DilutionTargetMapping;
  sourceId: string;
  requestedConcentration: AssayQuantity;
  achievedConcentration: AssayQuantity;
  transferVolume: AssayQuantity;
  diluentVolume: AssayQuantity;
  mixedVolume: AssayQuantity;
  retainedVolume: AssayQuantity;
  formulaTrace: DilutionFormulaTrace;
}

export interface DilutionPlanPoint {
  index: number;
  id: string;
  targets: DilutionPlannedTarget[];
}

export type DilutionTransferStepKind = "add-diluent" | "transfer" | "mix" | "discard";

export interface DilutionTransferMapping {
  sourceId?: string;
  targetId: string;
  volume?: AssayQuantity;
  channelIndex: number;
}

export interface DilutionTransferStep {
  id: string;
  order: number;
  kind: DilutionTransferStepKind;
  orientation: DilutionTransferOrientation;
  channelCount: 1 | 8 | 12;
  deviceRef: string;
  mappings: DilutionTransferMapping[];
  mixCycles?: number;
}

export interface DilutionTransferGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: "sequence" | "liquid-transfer";
}

export interface DilutionTransferGraph {
  planId: string;
  steps: DilutionTransferStep[];
  edges: DilutionTransferGraphEdge[];
}

export interface DilutionConservationSummary {
  sourceVolumeRemoved: AssayQuantity;
  diluentVolumeAdded: AssayQuantity;
  discardedVolume: AssayQuantity;
  terminalVolume: AssayQuantity;
  sourceAnalyteRemoved: AssayQuantity;
  discardedAnalyte: AssayQuantity;
  terminalAnalyte: AssayQuantity;
  /** Source analyte minus serialized terminal and discarded analyte. Zero when no rounding is applied. */
  roundingResidual: AssayQuantity;
}

export interface SerialDilutionPlan {
  schema: typeof serialDilutionPlanSchema;
  schemaVersion: typeof serialDilutionPlanSchemaVersion;
  id: string;
  concentrationBasis: "amount-per-volume";
  concentrationUnit: AssayQuantity["unit"];
  volumeUnit: "uL";
  points: DilutionPlanPoint[];
  transferGraph: DilutionTransferGraph;
  conservation: DilutionConservationSummary;
  roundingPolicy: DilutionRoundingPolicy;
  assumptions: string[];
  limitations: string[];
}

export type GenerateSerialDilutionResult =
  | { ok: true; plan: SerialDilutionPlan }
  | { ok: false; diagnostics: DilutionDiagnostic[] };
