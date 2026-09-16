import type { ControlledUnitId, DecimalString } from "../procedure-ir/types";

export const resourceRunPlanSchemaId = "studio.resource-run-plan" as const;
export const resourceRunPlanSchemaVersion = "1.0" as const;

export interface Quantity {
  value: DecimalString;
  unit: ControlledUnitId;
}

export type QuantityBasis =
  | "fixed"
  | "participant"
  | "group"
  | "section"
  | "repeat"
  | "station";

export interface QuantityFormula {
  amount: Quantity;
  basis: QuantityBasis;
  multiplyByRepeats?: boolean;
  multiplyByTechnicalReplicates?: boolean;
  includesOverage?: boolean;
  includesDeadVolume?: boolean;
}

export type ResourceClass =
  | "consumable"
  | "durable"
  | "instrument"
  | "reagent"
  | "sample"
  | "service";

export interface CapacitySpecV2 {
  groupsPerUnitPerWave: number;
  defaultUnitsAvailable?: number;
  stationId?: string;
  waveDuration?: Quantity;
  resetDuration?: Quantity;
}

export type OveragePolicy =
  | { kind: "percent"; percent: DecimalString }
  | { kind: "fixed"; quantity: Quantity };

export interface ReusePolicy {
  mode:
    | "single-use"
    | "reuse-across-repeats"
    | "reuse-across-sections"
    | "reuse-across-waves"
    | "maximum-uses";
  maximumUses?: number;
}

export interface PreparationSpec {
  task: string;
  batchCount?: number;
  batchCapacity?: Quantity;
  leadTime?: Quantity;
}

export interface CleanupSpec {
  task: string;
  duration?: Quantity;
  resetRequired: boolean;
}

export interface SubstitutionCandidate {
  resourceId: string;
  label: string;
  reason: string;
}

export interface SubstitutionPolicy {
  mode: "none" | "review-only";
  candidates: SubstitutionCandidate[];
}

export interface PlanningReviewFlag {
  code: string;
  severity: "info" | "warning" | "blocking";
  message: string;
}

export interface ResourceSpec {
  id: string;
  domainPackId: "chemistry" | "assay";
  label: string;
  resourceClass: ResourceClass;
  quantity: QuantityFormula;
  capacity?: CapacitySpecV2;
  overage?: OveragePolicy;
  deadVolume?: Quantity;
  reuse?: ReusePolicy;
  preparation?: PreparationSpec;
  cleanup?: CleanupSpec;
  substitutionPolicy?: SubstitutionPolicy;
  reviewFlags: PlanningReviewFlag[];
}

export type GroupingPolicy =
  | { kind: "group-size"; groupSize: number }
  | {
      kind: "explicit";
      groups: Array<{ id: string; participantCount: number; sectionId?: string }>;
    };

export interface RunSection {
  id: string;
  participantCount: number;
}

export interface RunStation {
  id: string;
  label: string;
}

export interface InventoryItem {
  resourceId: string;
  quantity: Quantity;
}

export interface InstrumentCapacityOverride {
  resourceId: string;
  unitsAvailable: number;
  groupsPerUnitPerWave?: number;
}

export interface PlanningWindow {
  start?: string;
  duration: Quantity;
}

export interface ResourceRunContext {
  requestId: string;
  participants: number;
  grouping: GroupingPolicy;
  sections: RunSection[];
  repeats: number;
  technicalReplicates: number;
  stations: RunStation[];
  availableInventory: InventoryItem[];
  instrumentCapacities: InstrumentCapacityOverride[];
  preparationWindow?: PlanningWindow;
  runWindow?: PlanningWindow;
  cleanupWindow?: PlanningWindow;
}

export interface PlanningDiagnostic {
  code: string;
  path: string;
  message: string;
  severity: "warning" | "error";
  resourceId?: string;
}

export interface FormulaTraceStep {
  label: string;
  expression: string;
  result: Quantity;
}

export interface RequirementLine {
  resourceId: string;
  label: string;
  resourceClass: ResourceClass;
  required: Quantity;
  normalizedTotal: Quantity;
  formulaTrace: FormulaTraceStep[];
}

export interface PreparationBatch {
  resourceId: string;
  batchNumber: number;
  task: string;
  targetQuantity?: Quantity;
  leadTime?: Quantity;
}

export interface CapacityScheduleItem {
  resourceId: string;
  stationId?: string;
  unitsAvailable: number;
  groupsPerWave: number;
  waves: number;
  waveDuration?: Quantity;
  totalDuration?: Quantity;
}

export interface StationWave {
  stationId: string;
  resourceId: string;
  wave: number;
  groupIds: string[];
}

export interface Shortage {
  resourceId: string;
  required: Quantity;
  available: Quantity;
  shortage: Quantity;
}

export interface CleanupTask {
  resourceId: string;
  task: string;
  duration?: Quantity;
  resetRequired: boolean;
}

export interface ReviewOnlySubstitution {
  resourceId: string;
  candidateResourceId: string;
  label: string;
  reason: string;
  reviewRequired: true;
}

export interface ResourceRunPlan {
  schema: typeof resourceRunPlanSchemaId;
  schemaVersion: typeof resourceRunPlanSchemaVersion;
  requestId: string;
  status: "complete" | "incomplete";
  contextSummary: {
    participants: number;
    groupCount: number;
    sectionCount: number;
    repeats: number;
    technicalReplicates: number;
    stationCount: number;
  };
  requirements: RequirementLine[];
  preparationBatches: PreparationBatch[];
  capacitySchedule: CapacityScheduleItem[];
  stationWaves: StationWave[];
  shortages: Shortage[];
  cleanupTasks: CleanupTask[];
  substitutionCandidates: ReviewOnlySubstitution[];
  diagnostics: PlanningDiagnostic[];
  assumptions: string[];
  limitations: string[];
}

export interface PlanningExtension {
  extendResources?: (
    resources: readonly ResourceSpec[],
    context: ResourceRunContext,
  ) => { resources: ResourceSpec[]; diagnostics: PlanningDiagnostic[] };
  extendPlan?: (plan: ResourceRunPlan, context: ResourceRunContext) => ResourceRunPlan;
}
