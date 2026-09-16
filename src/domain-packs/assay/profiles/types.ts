import type { DecimalString } from "../../../platform/procedure-ir/types";
import type { AssayQcRoundingPolicy, PlateObservation } from "../qc/types";
import type { WellRole } from "../types/types";

export const assayProtocolProfileSchemaId = "assay-studio.protocol-profile" as const;
export const assayProtocolProfileSchemaVersion = "1.0" as const;
export const assayProtocolAnalysisSchemaId = "assay-studio.protocol-analysis" as const;
export const assayProtocolAnalysisSchemaVersion = "1.0" as const;

export interface AssayProtocolSourceReference {
  id: string;
  title: string;
  organization: string;
  url: string;
  versionOrAccessDate: string;
  supports: string[];
}

export type AssayAnalysisExpression =
  | { type: "input"; input: "observed" | "blankMean" | "referenceMean" }
  | { type: "constant"; value: DecimalString }
  | { type: "add" | "subtract" | "multiply" | "divide"; left: AssayAnalysisExpression; right: AssayAnalysisExpression };

export interface AssayProfileControlRequirement {
  role: WellRole;
  minimumCount: number;
  expectedSignal?: "high" | "low" | "zero" | "growth" | "no-growth";
}

export interface AssayProtocolReadout {
  id: string;
  label: string;
  kind: "continuous-signal" | "binary-growth";
  allowedUnits: string[];
  allowedSourceTypes: PlateObservation["sourceType"][];
  channelRequirement: "required" | "optional";
  interpretation: string;
}

export interface AssayMetricRule {
  id: string;
  label: string;
  unit: "1" | "%";
  expression: AssayAnalysisExpression;
  interpretation: string;
}

export type AssayEndpointRule =
  | {
      id: string;
      type: "lowest-no-growth-concentration";
      concentrationComponentRef: string;
      growthValue: DecimalString;
      noGrowthValue: DecimalString;
      terminology: string;
      requireMonotonic: true;
    }
  | {
      id: string;
      type: "lowest-metric-threshold-concentration";
      metricRuleRef: string;
      concentrationComponentRef: string;
      comparator: "greater-than-or-equal";
      threshold: DecimalString;
      terminology: "protocol-defined inhibition endpoint";
      requireMonotonic: true;
    };

export interface AssayProtocolProfile {
  schema: typeof assayProtocolProfileSchemaId;
  schemaVersion: typeof assayProtocolProfileSchemaVersion;
  id: string;
  version: string;
  title: string;
  workflow: "xtt-metabolic-activity" | "broth-microdilution";
  useBoundary: "education" | "research-planning";
  sourceReferences: AssayProtocolSourceReference[];
  requiredControls: AssayProfileControlRequirement[];
  readouts: AssayProtocolReadout[];
  blankControlRole?: WellRole;
  referenceControlRole?: WellRole;
  metricRules: AssayMetricRule[];
  endpointRules: AssayEndpointRule[];
  roundingPolicy: AssayQcRoundingPolicy;
  validityRange: string[];
  materialDefaults: Array<{
    resourceClass: "reagent" | "consumable" | "instrument";
    label: string;
    quantityStatus: "protocol-supplied-required";
    note: string;
  }>;
  limitations: string[];
}

export interface AssayProtocolFormulaTrace {
  id: string;
  ruleId: string;
  formula: string;
  inputRefs: string[];
  inputValues: DecimalString[];
  result: DecimalString;
  unit: string;
}

export interface AssayProtocolWellResult {
  wellId: string;
  coordinate: string;
  sourceType: PlateObservation["sourceType"];
  rawValue: DecimalString;
  unit: string;
  metricValues: Record<string, DecimalString>;
  concentration?: { value: DecimalString; unit: string };
}

export interface AssayProtocolAnalysis {
  schema: typeof assayProtocolAnalysisSchemaId;
  schemaVersion: typeof assayProtocolAnalysisSchemaVersion;
  id: string;
  assayId: string;
  observationSetId: string;
  profileRef: { id: string; version: string };
  workflow: AssayProtocolProfile["workflow"];
  status: "complete" | "indeterminate";
  dataSources: PlateObservation["sourceType"][];
  readoutRef: string;
  readoutUnit: string;
  controlStatus: "valid" | "invalid" | "indeterminate";
  wellResults: AssayProtocolWellResult[];
  replicateSummaries: Array<{
    replicateGroupRef: string;
    metricRuleRef: string;
    memberWellIds: string[];
    aggregateValue?: DecimalString;
    status: "complete" | "indeterminate";
    limitations: string[];
  }>;
  endpoint?: {
    ruleId: string;
    terminology: string;
    concentration: { value: DecimalString; unit: string };
  };
  formulaTraces: AssayProtocolFormulaTrace[];
  diagnostics: string[];
  limitations: string[];
  scientificBoundary: string;
}
