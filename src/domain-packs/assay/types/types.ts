import type { ResourceSpec } from "../../../platform/planning/types";
import type { ControlledUnitId, DecimalString, EvidenceRequirementIR, ScalarOrQuantity } from "../../../platform/procedure-ir/types";
import type { PlatformProcessGraph } from "../../../platform/process/types";

export const assayDefinitionSchemaId = "assay-studio.assay-definition" as const;
export const assayDefinitionSchemaVersion = "1.0" as const;

export type AssayDefinitionSchemaVersion = typeof assayDefinitionSchemaVersion;

export interface VersionedRef {
  id: string;
  version: string;
}

export interface AssayQuantity {
  value: DecimalString;
  unit: ControlledUnitId;
}

export interface AssayQuantityRange {
  minimum: AssayQuantity;
  maximum: AssayQuantity;
}

export type PlateFormat = 6 | 12 | 24 | 48 | 96 | 384;
export type PlateOrientation = "A1-top-left";

export type WellRole =
  | "sample"
  | "standard"
  | "blank"
  | "negativeControl"
  | "positiveControl"
  | "vehicleControl"
  | "growthControl"
  | "sterilityControl"
  | "qualityControl"
  | "edgeBuffer"
  | "unused";

export type PlannedWellComponentRole = "sample" | "reagent" | "diluent" | "control" | "other";

export interface PlannedWellComponent {
  resourceRef: string;
  role: PlannedWellComponentRole;
  volume: AssayQuantity;
  concentration?: AssayQuantity;
}

export interface WellDefinition {
  id: string;
  coordinate: string;
  role: WellRole;
  sampleRef?: string;
  conditionRefs: string[];
  controlRef?: string;
  replicateGroupRefs: string[];
  plannedComponents: PlannedWellComponent[];
  expectedFinalVolume: AssayQuantity;
  labels: string[];
}

export interface PlateRegionDefinition {
  id: string;
  label: string;
  wellIds: string[];
  labels: string[];
}

export interface PlateDefinition {
  id: string;
  format: PlateFormat;
  rowCount: number;
  columnCount: number;
  rowLabels: string[];
  columnLabels: string[];
  orientation: PlateOrientation;
  maxWellVolume: AssayQuantity;
  recommendedWorkingVolume?: AssayQuantityRange;
  wells: WellDefinition[];
  regions: PlateRegionDefinition[];
}

export interface AssayResourceDefinition {
  id: string;
  label: string;
  kind: "reagent" | "buffer" | "sample" | "consumable" | "instrument" | "other";
  description: string;
  stockConcentration?: AssayQuantity;
  availableVolume?: AssayQuantity;
  labels: string[];
}

export interface AssaySampleDefinition {
  id: string;
  label: string;
  description: string;
  tags: string[];
}

export interface AssayConditionDefinition {
  id: string;
  label: string;
  parameters: Record<string, ScalarOrQuantity>;
}

export interface AssayControlDefinition {
  id: string;
  role: WellRole;
  label: string;
  expectedDirection?: "high" | "low" | "zero" | "growth" | "no-growth";
  requiredByProfile: boolean;
  interpretation: string;
}

export interface ReplicateGroupDefinition {
  id: string;
  type: "technical" | "biological" | "independent-run";
  memberWellIds: string[];
  minimumCount: number;
  aggregation: "mean" | "median" | "none";
  variabilityMetric?: "sd" | "cv" | "range";
}

export type AssayEquipmentType =
  | "microplate"
  | "micropipette"
  | "tip-box"
  | "reservoir"
  | "tube"
  | "plate-reader";

export interface AssayEquipmentRef {
  id: string;
  equipmentType: AssayEquipmentType;
  label: string;
  catalogRef?: string;
}

/**
 * Cycle 06 defines the authored operation vocabulary only. Runtime state
 * transitions and quantitative transfer semantics begin in Cycle 07.
 */
export const assayOperationTypes = [
  "selectPipette",
  "setVolume",
  "attachTips",
  "aspirate",
  "dispense",
  "mix",
  "ejectTips",
  "wait",
  "readPlate",
  "recordNote",
  "recordCalculation",
] as const;

export type AssayOperationType = (typeof assayOperationTypes)[number];

export interface AssayOperationDefinition {
  id: string;
  type: AssayOperationType;
  label: string;
  sourceRef?: string;
  destinationRefs: string[];
  volume?: AssayQuantity;
  parameters: Record<string, ScalarOrQuantity>;
  limitations: string[];
}

export interface AssayAnalysisPlan {
  id: string;
  analysisType: "none" | "xtt" | "inhibition" | "custom";
  profileRef?: VersionedRef;
  inputObservationRefs: string[];
  outputIds: string[];
  limitations: string[];
}

export interface AssayDefinition {
  schema: typeof assayDefinitionSchemaId;
  schemaVersion: AssayDefinitionSchemaVersion;
  id: string;
  title: string;
  description: string;
  audience: string;
  learningGoals: string[];
  useBoundary: "education" | "research-planning";
  safetyNotes: string[];
  protocolProfileRef: VersionedRef;
  plate: PlateDefinition;
  resources: AssayResourceDefinition[];
  samples: AssaySampleDefinition[];
  conditions: AssayConditionDefinition[];
  controls: AssayControlDefinition[];
  replicateGroups: ReplicateGroupDefinition[];
  equipment: AssayEquipmentRef[];
  operations: AssayOperationDefinition[];
  process: PlatformProcessGraph;
  analysisPlan: AssayAnalysisPlan;
  evidenceRequirements: EvidenceRequirementIR[];
  materials: ResourceSpec[];
  metadata: {
    version: string;
    author: string;
    updatedAt: string;
    tags: string[];
  };
}

export interface PlateObservationRef {
  id: string;
}

export interface AssayRuntimeWarning {
  code: string;
  severity: "warning" | "blocking";
  message: string;
}

export interface WellComponentState {
  resourceRef: string;
  volume: AssayQuantity;
  concentration?: AssayQuantity;
  sourceRefs: string[];
}

export interface WellState {
  coordinate: string;
  volume: AssayQuantity;
  components: WellComponentState[];
  mixed: boolean;
  contaminationTags: string[];
  status: "empty" | "prepared" | "incubating" | "ready" | "read" | "invalid";
  observations: PlateObservationRef[];
  warnings: AssayRuntimeWarning[];
}

export interface PlateRuntimeState {
  plateId: string;
  format: 96;
  orientation: PlateOrientation;
  maxWellVolume: AssayQuantity;
  wells: WellState[];
}
