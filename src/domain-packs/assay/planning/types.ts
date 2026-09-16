import type { DecimalString } from "../../../platform/procedure-ir/types";
import type {
  FormulaTraceStep,
  OveragePolicy,
  PlanningDiagnostic,
  PlanningReviewFlag,
  Quantity,
  ResourceRunContext,
  ResourceRunPlan,
} from "../../../platform/planning/types";
import type { AssayOperation, AssayRuntimeState } from "../runtime";
import type { AssayDefinition, AssayOperationType } from "../types";

export const assayPlanningProfileSchemaId = "assay-studio.planning-profile" as const;
export const assayPlanningProfileSchemaVersion = "1.0" as const;

export interface AssayPlanningSource {
  kind: "fixture" | "user-declared" | "protocol-profile";
  title: string;
  version: string;
  validity: string;
  limitations: string[];
}

export interface AssayOperationLiquidPolicy {
  sourceRef: string;
  resourceId: string;
  label: string;
  resourceClass: "reagent" | "sample";
  overage?: OveragePolicy;
  deadVolume?: Quantity;
  batchPlateCapacity: number;
  preparationTask: string;
  leadTime?: Quantity;
  reviewFlags: PlanningReviewFlag[];
}

export interface AssayTipPackagePolicy {
  tipTypeId: string;
  tipResourceId: string;
  tipLabel: string;
  boxResourceId: string;
  boxLabel: string;
  tipsPerBox: number;
  reviewFlags: PlanningReviewFlag[];
}

export interface AssayCountResourcePolicy {
  resourceId: string;
  label: string;
  resourceClass: "consumable";
  quantityPerPlate: DecimalString;
  reuseMode?: "single-use";
  cleanupTask?: string;
  resetRequired?: boolean;
  reviewFlags: PlanningReviewFlag[];
}

export interface AssayMasterMixComponentPolicy {
  resourceId: string;
  label: string;
  resourceClass: "reagent" | "sample";
  volumePerPlate: Quantity;
  deadVolume?: Quantity;
}

export interface AssayMasterMixPolicy {
  id: string;
  label: string;
  batchPlateCapacity: number;
  components: AssayMasterMixComponentPolicy[];
  overage?: OveragePolicy;
  preparationTask: string;
  leadTime?: Quantity;
  reviewFlags: PlanningReviewFlag[];
}

export interface AssayInstrumentPolicy {
  resourceId: string;
  label: string;
  resourceClass: "durable" | "instrument";
  stationId: string;
  defaultUnitsAvailable: number;
  platesPerUnitPerWave: number;
  waveDuration: Quantity;
  resetDuration?: Quantity;
  cleanupTask: string;
  cleanupDuration?: Quantity;
  demandOperationTypes: AssayOperationType[];
  reviewFlags: PlanningReviewFlag[];
}

export type AssayOperationalPhaseKind =
  | "preparation"
  | "run"
  | "incubation"
  | "read"
  | "reset"
  | "cleanup";

export interface AssayOperationalPhasePolicy {
  id: string;
  label: string;
  kind: AssayOperationalPhaseKind;
  duration?: Quantity;
  capacityResourceId?: string;
}

export interface AssayPlanningProfile {
  schema: typeof assayPlanningProfileSchemaId;
  schemaVersion: typeof assayPlanningProfileSchemaVersion;
  id: string;
  version: string;
  title: string;
  supportedUseBoundaries: Array<AssayDefinition["useBoundary"]>;
  source: AssayPlanningSource;
  operationLiquids: AssayOperationLiquidPolicy[];
  tipPackages: AssayTipPackagePolicy[];
  countResources: AssayCountResourcePolicy[];
  masterMixes: AssayMasterMixPolicy[];
  instruments: AssayInstrumentPolicy[];
  phases: AssayOperationalPhasePolicy[];
  assumptions: string[];
  limitations: string[];
  reviewFlags: PlanningReviewFlag[];
}

export interface AssayRunPlanningRequest {
  resourceContext: ResourceRunContext;
  initialRuntimeState: AssayRuntimeState;
  operations: AssayOperation[];
  profile: AssayPlanningProfile;
  declaredAssumptions: string[];
}

export interface AssayOperationPlanningSummary {
  operationCount: number;
  plateRuns: number;
  tipCountByType: Array<{
    tipTypeId: string;
    tipsPerPlate: number;
    totalTips: number;
    boxCount: number;
  }>;
  externalLiquidBySource: Array<{
    sourceRef: string;
    volumePerPlate: Quantity;
  }>;
}

export interface AssayMasterMixBatch {
  masterMixId: string;
  masterMixLabel: string;
  batchNumber: number;
  plateCount: number;
  components: Array<{
    resourceId: string;
    label: string;
    required: Quantity;
    formulaTrace: FormulaTraceStep[];
  }>;
}

export interface AssayOperationalPhaseScheduleItem {
  phaseId: string;
  label: string;
  kind: AssayOperationalPhaseKind;
  startsAfter: Quantity;
  duration: Quantity;
  capacityResourceId?: string;
  waves?: number;
}

export interface AssayCapacityBottleneck {
  resourceId: string;
  label: string;
  waves: number;
  message: string;
}

export interface AssayInventoryComparison {
  resourceId: string;
  required: Quantity;
  available?: Quantity;
  shortage?: Quantity;
  status: "available" | "shortage" | "not-declared" | "incompatible-unit";
}

export interface AssayPlanningExports {
  requirementsCsv: string;
  formulaTraceCsv: string;
  scheduleCsv: string;
  checklistMarkdown: string;
}

export interface AssayRunPlanResult {
  status: "complete" | "incomplete";
  artifactId: string;
  profileRef: { id: string; version: string };
  plan: ResourceRunPlan;
  operationSummary: AssayOperationPlanningSummary;
  masterMixBatches: AssayMasterMixBatch[];
  phaseSchedule: AssayOperationalPhaseScheduleItem[];
  bottlenecks: AssayCapacityBottleneck[];
  inventoryComparison: AssayInventoryComparison[];
  diagnostics: PlanningDiagnostic[];
  exports: AssayPlanningExports;
}

export interface AssayRunPlanEvidencePayload {
  planId: string;
  status: "ready" | "review-required" | "blocked";
  requirementCount: number;
  limitations: string[];
}
