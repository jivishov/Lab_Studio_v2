import type { DecimalString } from "../../../platform/procedure-ir/types";

export const assayObservationSetSchemaId = "assay-studio.observation-set" as const;
export const assayObservationSetSchemaVersion = "1.0" as const;
export const assayQcRuleSetSchemaId = "assay-studio.qc-rule-set" as const;
export const assayQcRuleSetSchemaVersion = "1.0" as const;
export const assayQcEvaluationSchemaId = "assay-studio.qc-evaluation" as const;
export const assayQcEvaluationSchemaVersion = "1.0" as const;

export type AssayQcStatus = "pass" | "warn" | "fail" | "indeterminate";
export type AssayQcViolationSeverity = "warn" | "fail";

export interface AssayObservationProvenance {
  sourceId: string;
  sourceVersion: string;
  methodId: string;
  methodVersion: string;
  description: string;
}

export interface PlateObservation {
  id: string;
  plateId: string;
  wellId: string;
  sourceType: "instrument-export" | "image-derived" | "manual" | "synthetic";
  rawValue: DecimalString;
  unit: string;
  channel?: string;
  confidence?: DecimalString;
  capturedAt?: string;
  provenance: AssayObservationProvenance;
  reviewStatus: "unreviewed" | "accepted" | "corrected" | "rejected";
}

export interface AssayManualCorrection {
  id: string;
  observationId: string;
  previousValue: DecimalString;
  acceptedValue: DecimalString;
  reason?: string;
  actorRole: string;
  occurredAt: string;
  provenance: AssayObservationProvenance;
}

export interface AssayObservationSet {
  schema: typeof assayObservationSetSchemaId;
  schemaVersion: typeof assayObservationSetSchemaVersion;
  id: string;
  plateId: string;
  orientation: "A1-top-left";
  observations: PlateObservation[];
  manualCorrections: AssayManualCorrection[];
}

export interface AssayQcPolicySource {
  id: string;
  version: string;
  title: string;
  sourceKind: "protocol-profile" | "author-supplied" | "fixture";
  sourceReferences: string[];
  validityRange: string[];
  limitations: string[];
}

export interface AssayQcRoundingPolicy {
  mode: "round";
  decimalPlaces: number;
  tieBreaking: "half-up" | "half-even";
}

export interface RequiredControlPolicy {
  id: string;
  controlRef: string;
  minimumCount: number;
  maximumCount?: number;
}

export interface BlankCorrectionPolicy {
  controlRef: string;
  aggregation: "mean" | "median";
}

export interface NormalizationPolicy {
  referenceControlRef: string;
  mode: "ratio-to-reference" | "percent-of-reference" | "percent-inhibition";
}

interface AssayQcRuleBase {
  id: string;
  title: string;
  violationSeverity: AssayQcViolationSeverity;
}

export type AssayQcRule =
  | (AssayQcRuleBase & {
      type: "replicate-variability";
      replicateGroupRefs: string[];
      metric: "sd" | "cv" | "range";
      maximum: DecimalString;
    })
  | (AssayQcRuleBase & {
      type: "control-direction";
      highControlRef: string;
      lowControlRef: string;
      minimumDifference: DecimalString;
    })
  | (AssayQcRuleBase & {
      type: "signal-window";
      highControlRef: string;
      lowControlRef: string;
      minimum: DecimalString;
    })
  | (AssayQcRuleBase & {
      type: "z-prime";
      highControlRef: string;
      lowControlRef: string;
      minimum: DecimalString;
      minimumReplicatesPerControl: number;
    })
  | (AssayQcRuleBase & {
      type: "edge-effect";
      edgeWellIds: string[];
      interiorWellIds: string[];
      maximumAbsoluteDifference: DecimalString;
    })
  | (AssayQcRuleBase & {
      type: "drift";
      wellIds: string[];
      axis: "row" | "column";
      maximumAbsoluteSlope: DecimalString;
    })
  | (AssayQcRuleBase & {
      type: "outlier-flag";
      replicateGroupRefs: string[];
      maximumAbsoluteDeviation: DecimalString;
    });

export interface AssayQcRuleSet {
  schema: typeof assayQcRuleSetSchemaId;
  schemaVersion: typeof assayQcRuleSetSchemaVersion;
  id: string;
  title: string;
  policySource: AssayQcPolicySource;
  requiredControls: RequiredControlPolicy[];
  blankCorrection?: BlankCorrectionPolicy;
  normalization?: NormalizationPolicy;
  roundingPolicy: AssayQcRoundingPolicy;
  rules: AssayQcRule[];
}

export interface AssayQcFormulaTrace {
  id: string;
  policySourceRef: string;
  formula: string;
  inputRefs: string[];
  inputValues: DecimalString[];
  result: DecimalString;
  unit: string;
  rounding: string;
}

export interface AssayQcWellResult {
  wellId: string;
  coordinate: string;
  observationId: string;
  rawValue: DecimalString;
  correctedValue?: DecimalString;
  normalizedValue?: DecimalString;
  unit: string;
  flags: string[];
}

export interface AssayReplicateSummary {
  replicateGroupRef: string;
  memberWellIds: string[];
  observedWellIds: string[];
  aggregation: "mean" | "median" | "none";
  aggregateValue?: DecimalString;
  variabilityMetric?: "sd" | "cv" | "range";
  variabilityValue?: DecimalString;
  unit: string;
  variabilityUnit?: string;
  status: "complete" | "indeterminate";
  formulaTraceRefs: string[];
  limitations: string[];
}

export interface AssayQcRuleResult {
  ruleId: string;
  ruleType: AssayQcRule["type"] | "required-control" | "observation-set";
  title: string;
  status: AssayQcStatus;
  summary: string;
  metricValue?: DecimalString;
  unit?: string;
  threshold?: DecimalString;
  affectedWellIds: string[];
  formulaTraceRefs: string[];
  limitations: string[];
}

export interface AssayQcEvaluation {
  schema: typeof assayQcEvaluationSchemaId;
  schemaVersion: typeof assayQcEvaluationSchemaVersion;
  id: string;
  assayId: string;
  observationSetId: string;
  ruleSetRef: {
    id: string;
    version: typeof assayQcRuleSetSchemaVersion;
  };
  policySourceRef: string;
  status: AssayQcStatus;
  unit: string;
  wellResults: AssayQcWellResult[];
  replicateSummaries: AssayReplicateSummary[];
  ruleResults: AssayQcRuleResult[];
  formulaTraces: AssayQcFormulaTrace[];
  outlierFlags: Array<{
    ruleId: string;
    wellId: string;
    reason: string;
  }>;
  limitations: string[];
}

export interface AssayQcTableRow {
  wellId: string;
  coordinate: string;
  sourceType: PlateObservation["sourceType"];
  reviewStatus: PlateObservation["reviewStatus"];
  rawValue: DecimalString;
  correctedValue: DecimalString | "";
  normalizedValue: DecimalString | "";
  unit: string;
  flags: string[];
}

export interface AssayQcTableProjection {
  columns: Array<{
    id: keyof AssayQcTableRow;
    label: string;
  }>;
  rows: AssayQcTableRow[];
}

export interface AssayQcChartPoint {
  wellId: string;
  coordinate: string;
  value: DecimalString;
  unit: string;
  flags: string[];
}

export interface AssayQcChartProjection {
  title: string;
  valueField: "normalizedValue" | "correctedValue" | "rawValue";
  points: AssayQcChartPoint[];
}
