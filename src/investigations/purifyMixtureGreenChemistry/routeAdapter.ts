import type {
  ActionParameterValue,
  EquipmentInstance,
  GreenChemistryProductRecoveryRecord,
  LabDefinition,
  RouteTechniqueExecutionAdapter,
  RouteTechniqueExecutionEvidence,
  RouteTechniqueExecutionIntent,
  RouteTechniqueExecutionRejection,
  RouteTechniqueExecutionTarget,
} from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { resolvePhysicalSolidInventoryMassG } from "../../runtime/contentTransfer";
import { getInitialEquipment } from "../../runtime/createRuntime";
import {
  initializeConfiguredSolidStock,
  transferSolid,
  type SolidMaterialSlice,
  type ConfiguredSolidStockLedgerEntry,
} from "../../runtime/solidMaterial";
import {
  validateRouteTechniqueExecutionIntent,
  validateRouteTechniqueExecutionTargets,
} from "../shared/routeTechniqueExecution";
import {
  GREEN_CHEMISTRY_INSTANCE_ID,
  GREEN_CHEMISTRY_LAB_ID,
  GREEN_CHEMISTRY_TARE_CONVENTIONS,
  GREEN_CHEMISTRY_TECHNIQUE_ID,
  GREEN_CHEMISTRY_TECHNIQUE_VERSION,
  UNCONFIGURED_TEXT,
  type GreenChemistryTareConvention,
} from "../../data/greenChemistrySetup";
import { isConstantMass } from "./model";

export type GreenChemistryBalanceId = "balance-a" | "balance-b";
export type GreenChemistryLidPosition = "off" | "closed" | "askew";
export type GreenChemistryCrucibleState =
  | "cool-empty"
  | "loaded-cool"
  | "heating"
  | "hot"
  | "cooled-residue"
  | "cooled-recorded";

export interface GreenChemistryCycleRecord {
  cycle: number;
  balanceId: GreenChemistryBalanceId;
  durationMin: number;
  crucibleAndLidMassG: number;
  differenceG?: number;
  constant: boolean;
}

export interface GreenChemistryPendingMassReading {
  kind: "empty" | "loaded" | "cycle";
  balanceId: GreenChemistryBalanceId;
  valueG: number;
  measurementId: string;
}

export interface GreenChemistryReplicateRecord {
  replicate: number;
  emptyMassG: number;
  loadedMassG: number;
  cycles: GreenChemistryCycleRecord[];
}

/** The physical issue that opened one replicate's working portion. */
export interface GreenChemistryWorkingPortionIssueRecord {
  issueId: string;
  runId: string;
  replicate: number;
  operationId: "add-carbonate-sample";
  sourceInstanceId: string;
  destinationInstanceId: string;
  sourceMaterialId: string;
  sourceMaterialLabel: string;
  massG: number;
}

/** Route-owned recovery history for physical and qualitative material edges. */
export interface GreenChemistryUnheatedRecoveryRecord {
  recordId: string;
  runId: string;
  replicate?: number;
  operationId: "recover-unused-sample" | "finalize-unused-master-stock";
  stream: "unheated";
  sourceInstanceId: string;
  destinationInstanceId: string;
  sourceMaterialId: string;
  sourceMaterialLabel: string;
  sourceActionId: string;
  quantityBasis: "working-remainder" | "master-stock-remainder";
  sourceInventoryMassG: number;
  destinationPhysicalMassKnown: true;
  measurementEvidenceIds: string[];
  routeEvidenceIds: string[];
  recoveryEvidenceIds: string[];
}

export type GreenChemistryRecoveryRecord =
  | GreenChemistryUnheatedRecoveryRecord
  | GreenChemistryProductRecoveryRecord;

/**
 * The containers this route actually moves solid between.
 *
 * Read back out of the compiled instance rather than written down here a second time: the compiled
 * action parameters are the procedural authority for every quantity this adapter enforces, and the
 * holders are no different. A compile whose recovery steps name other containers is refused before
 * any material moves.
 */
export interface GreenChemistryMaterialHolders {
  /** Teacher master stock S. */
  masterStockInstanceId: string;
  /** The working portion W issued to one replicate at a time. */
  workingPortionInstanceId: string;
  crucibleInstanceId: string;
  unusedRecoveryInstanceId: string;
  productRecoveryInstanceId: string;
  /** The single configured component the stock total belongs to; no composition is implied. */
  materialSoluteId: string;
  materialLabel: string;
  /** Compiled evidence identity the configuring step records the configured total against. */
  stockMeasurementId: string;
}

/** One replicate's issued working portion while that replicate is still open. */
export interface GreenChemistryActiveMaterialReplicate {
  replicate: number;
  /** The immutable issue-history row that opened this replicate. */
  issueRecordId?: string;
  /** W actually issued from the master stock for this replicate. */
  issuedWorkingMassG: number;
  /** p actually loaded into the crucible. */
  loadedPortionMassG: number;
  /** Set by EX-08. Zero is a truthful outcome, not a missing value, when W equals p. */
  excessReturnedG?: number;
  /** Set by EX-19, and the only proof the replicate's product actually left the crucible. */
  productRecordId?: string;
}

/** A replicate whose material is fully accounted for. Never rewritten afterwards. */
export interface GreenChemistryCompletedMaterialReplicate {
  replicate: number;
  issueRecordId?: string;
  issuedWorkingMassG: number;
  loadedPortionMassG: number;
  excessReturnedG: number;
  productRecordId: string;
}

/**
 * The route's physical material slice.
 *
 * Every quantity here is a real inventory the shared solid helpers moved, not a flag: the master
 * stock is finite, the working vial holds one issued portion at a time, and the two labelled
 * receivers accumulate what actually arrived. The heated-product receiver deliberately carries
 * provenance records rather than a mass, because nobody weighed the recovered product.
 */
export interface GreenChemistryMaterialState {
  holders: GreenChemistryMaterialHolders;
  instances: EquipmentInstance[];
  stockInitializations: Record<string, ConfiguredSolidStockLedgerEntry>;
  /** S, as the teacher set it up for this run. A setup quantity, never a balance reading. */
  configuredStockMassG: number;
  /** W, the portion issued per replicate. */
  configuredWorkingPortionMassG: number;
  /** p, the compiled plan target each replicate loads. */
  plannedPortionMassG: number;
  /** Next ordinal the route may issue while the run is open. */
  nextReplicateOrdinal: number;
  /** Every successful master -> working-vial issue, including extra replicates. */
  issuedWorkingPortions: GreenChemistryWorkingPortionIssueRecord[];
  active?: GreenChemistryActiveMaterialReplicate;
  completed: GreenChemistryCompletedMaterialReplicate[];
  productRecords: GreenChemistryProductRecoveryRecord[];
  /** Every successful unheated and heated recovery, plus terminal master closure. */
  recoveryRecords: GreenChemistryRecoveryRecord[];
  /** Present only once the run is closed; freezes the replicate set analysis may bind to. */
  closure?: {
    masterRemainderReturnedG: number;
    frozenReplicates: number[];
    stockClosureRecordId: string;
  };
}

export interface GreenChemistryRouteState {
  /** Fresh for every run, including after a reset. Recovery provenance records carry it. */
  runId: string;
  /** A closed run has returned its master remainder and frozen its completed replicate set. */
  runPhase: "open" | "closed";
  /** String ids for the actual completed set, frozen by terminal stock closure. */
  closedCompletedReplicateIds?: readonly string[];
  /** Deterministic id of the run-level master closure record. */
  stockClosureRecordId?: string;
  /** Absent until the teacher configures the stock; present for the rest of the run. */
  material?: GreenChemistryMaterialState;
  /**
   * Where the active replicate's own evidence starts in `evidence`. A recovery record must cite
   * the evidence of the replicate it belongs to, not whatever an earlier replicate recorded under
   * the same action id.
   */
  replicateEvidenceStartIndex: number;
  approved: boolean;
  balancePlaced: boolean;
  cruciblePlaced: boolean;
  selectedBalance?: GreenChemistryBalanceId;
  pendingMassReading?: GreenChemistryPendingMassReading;
  emptyMassRecorded: boolean;
  emptyMassG?: number;
  loadedMassRecorded: boolean;
  loadedMassG?: number;
  unusedSampleRecovered: boolean;
  assemblySteps: string[];
  lidPosition: GreenChemistryLidPosition;
  crucibleState: GreenChemistryCrucibleState;
  gentleWarmComplete: boolean;
  cycles: GreenChemistryCycleRecord[];
  completedReplicates: GreenChemistryReplicateRecord[];
  finalMassRecorded: boolean;
  replicateProductRecovered: boolean;
  analysisCalculated: boolean;
  uncertaintyRecorded: boolean;
  productRecovered: boolean;
  reportReviewed: boolean;
  atomEconomyRecorded: boolean;
  peerReviewComplete: boolean;
  completedActionIds: string[];
  evidence: RouteTechniqueExecutionEvidence[];
}

/**
 * The approved method's quantities, read back out of the compiled technique instance rather than
 * held as a second copy in component state. Every value here comes from a compiled action
 * parameter, so the instance the compiler issued is the only procedural authority the adapter
 * enforces.
 */
export interface GreenChemistryRouteRules {
  sampleMassG: number;
  warmDurationMin: number;
  heatingDurationMin: number;
  heatingIntensity: string;
  constantMassToleranceG: number;
  maximumHeatCycles: number;
  coolingEndpointC: number;
  coolingSurface: string;
  tareConvention: GreenChemistryTareConvention;
  minimumReplicates: number;
}

/** The plan fields whose learner text the approval payload must actually carry. */
export const GREEN_CHEMISTRY_APPROVAL_PLAN_FIELDS = [
  "rationale",
  "constantMassRule",
  "apparatusAndObservations",
  "calculations",
  "uncertainty",
  "safety",
  "recovery",
] as const;

/** Lab-owned nonphysical nodes of the compiled root process, in compiled order. */
export const GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS = [
  "review-assigned-green-chemistry-report",
  "calculate-assigned-report-atom-economy",
  "complete-green-chemistry-peer-review",
] as const;

export type GreenChemistryLabNodeActionId =
  (typeof GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS)[number];

/** Scope for the lab-owned nodes; they belong to no technique instance. */
export const GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID = "lab-orchestration";

const target = (
  actionId: string,
  evidenceOutputIds: string[] = [],
): RouteTechniqueExecutionTarget => ({
  techniqueId: GREEN_CHEMISTRY_TECHNIQUE_ID,
  techniqueVersion: GREEN_CHEMISTRY_TECHNIQUE_VERSION,
  instanceId: GREEN_CHEMISTRY_INSTANCE_ID,
  actionId,
  nodeId: GREEN_CHEMISTRY_INSTANCE_ID + "--" + actionId + "-node",
  evidenceOutputIds: evidenceOutputIds.map(
    (id) => GREEN_CHEMISTRY_INSTANCE_ID + "--" + id,
  ),
  payload: {},
});

export const GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS = [
  target("approve-thermal-decomposition-plan", ["approval"]),
  target("configure-unheated-stock", ["unheated-stock-configured"]),
  target("place-balance"),
  target("place-empty-crucible"),
  target("read-empty-crucible", ["empty-mass"]),
  target("record-empty-crucible", ["empty-mass-record"]),
  target("add-carbonate-sample"),
  target("weigh-initial-crucible", ["loaded-mass"]),
  target("record-initial-crucible-mass", ["loaded-mass-record"]),
  target("recover-unused-sample", ["unused-sample-recovery"]),
  target("place-ring-stand"),
  target("add-clay-triangle"),
  target("place-bunsen-burner"),
  target("place-crucible-on-support"),
  target("set-crucible-lid"),
  target("warm-gently"),
  target("heat-carbonate-mixture"),
  target("turn-off-burner"),
  target("cool-crucible"),
  target("weigh-preliminary-final-mass", ["cycle-mass"]),
  target("record-cycle-mass", ["cycle-mass-record"]),
  target("repeat-heat-to-constant-mass"),
  target("cool-constant-mass-crucible"),
  target("weigh-final-crucible", ["final-mass"]),
  target("record-final-crucible-mass", ["final-mass-record"]),
  target("recover-replicate-product", ["replicate-recovery"]),
  target("complete-replicate", ["replicate-completion"]),
  target("finalize-unused-master-stock", ["unused-master-stock-finalized"]),
  target("calculate-carbonate-composition", ["composition-calculation"]),
  target("record-composition-uncertainty", ["uncertainty-record"]),
  target("recover-final-product", ["final-product-recovery"]),
] as const;

const APPARATUS_ACTIONS = [
  ["place-ring-stand", "Ring stand and iron ring"],
  ["add-clay-triangle", "Ceramic triangle"],
  ["place-bunsen-burner", "Bunsen burner"],
  ["place-crucible-on-support", "Crucible"],
] as const;

/** Apparatus that remains safely assembled between replicates and at run closure. */
const REUSABLE_APPARATUS_STEPS = APPARATUS_ACTIONS.slice(0, -1).map(([, label]) => label);

/** The one apparatus step a further replicate has to repeat. */
export const CRUCIBLE_SUPPORT_STEP = "Crucible";

let runSequence = 0;

/**
 * A fresh identity for each run.
 *
 * Provenance records carry it, so two runs can never read as one pile of recovered product, and a
 * reset must never inherit the previous run's id. Tests pass an explicit id; nothing else needs to.
 */
export const nextGreenChemistryRunId = (): string =>
  "green-chemistry-run-" + (runSequence += 1) + "-" + Date.now().toString(36);

export const greenChemistryReplicateRecordId = (
  runId: string,
  replicate: number,
  operationId: "recover-unused-sample" | "recover-replicate-product",
): string => `${runId}--replicate-${replicate}--${operationId}`;

export const greenChemistryIssueRecordId = (
  runId: string,
  replicate: number,
): string => `${runId}--replicate-${replicate}--issue-working-portion`;

export const greenChemistryMasterClosureRecordId = (runId: string): string =>
  `${runId}--finalize-unused-master-stock`;

export const greenChemistryClosedReplicateSetBinding = (
  state: GreenChemistryRouteState,
): string | undefined => {
  const frozenReplicates = state.material?.closure?.frozenReplicates;
  if (!frozenReplicates) return undefined;
  return `${state.runId}::${[...frozenReplicates].sort((a, b) => a - b).join(",")}`;
};

const greenChemistryClosedReplicateIds = (
  runId: string,
  replicates: readonly number[],
): string[] =>
  replicates.map((replicate) => `${runId}--replicate-${replicate}`);

export const createInitialGreenChemistryRouteState = (
  runId: string = nextGreenChemistryRunId(),
): GreenChemistryRouteState => ({
    runId,
    runPhase: "open",
    replicateEvidenceStartIndex: 0,
    approved: false,
    balancePlaced: false,
    cruciblePlaced: false,
    emptyMassRecorded: false,
    loadedMassRecorded: false,
    unusedSampleRecovered: false,
    assemblySteps: [],
    lidPosition: "off",
    crucibleState: "cool-empty",
    gentleWarmComplete: false,
    cycles: [],
    completedReplicates: [],
    finalMassRecorded: false,
    replicateProductRecovered: false,
    analysisCalculated: false,
    uncertaintyRecorded: false,
    productRecovered: false,
    reportReviewed: false,
    atomEconomyRecorded: false,
    peerReviewComplete: false,
    completedActionIds: [],
    evidence: [],
  });

const compiledParameter = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: string,
): ActionParameterValue | undefined =>
  definition?.actions.find((action) => action.id === actionId)?.parameters?.[key];

const compiledQuantity = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: string,
  errors: string[],
): number => {
  const value = compiledParameter(definition, actionId, key);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(
      `Compiled action "${actionId}" does not carry a teacher-configured "${key}".`,
    );
    return Number.NaN;
  }
  return value;
};

const compiledFiniteQuantity = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: string,
  errors: string[],
): number => {
  const value = compiledParameter(definition, actionId, key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(
      `Compiled action "${actionId}" does not carry a finite teacher-configured "${key}".`,
    );
    return Number.NaN;
  }
  return value;
};

const compiledPositiveSafeInteger = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: string,
  errors: string[],
): number => {
  const value = compiledParameter(definition, actionId, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    errors.push(
      `Compiled action "${actionId}" does not carry a positive safe-integer "${key}".`,
    );
    return Number.NaN;
  }
  return value;
};

const compiledText = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: string,
  errors: string[],
): string => {
  const value = compiledParameter(definition, actionId, key);
  if (typeof value !== "string" || !value.trim() || value.trim() === UNCONFIGURED_TEXT) {
    errors.push(
      `Compiled action "${actionId}" does not carry a teacher-configured "${key}".`,
    );
    return "";
  }
  return value;
};

const compiledTareConvention = (
  definition: LabDefinition | undefined,
  actionId: string,
  errors: string[],
): GreenChemistryTareConvention => {
  const value = compiledParameter(definition, actionId, "tareConvention");
  if (
    typeof value !== "string"
    || !GREEN_CHEMISTRY_TARE_CONVENTIONS.includes(value as GreenChemistryTareConvention)
  ) {
    errors.push(
      `Compiled action "${actionId}" does not carry one of the two approved tare conventions.`,
    );
    return GREEN_CHEMISTRY_TARE_CONVENTIONS[0];
  }
  return value as GreenChemistryTareConvention;
};

/**
 * Read the approved method back out of the compiled instance.
 *
 * The public lab binds `0`/`unconfigured-teacher-choice` placeholders to every open configuration
 * slot, so a definition compiled without teacher configuration fails here and no physical
 * operation can run against it.
 */
export const greenChemistryRulesFromCompiled = (
  definition: LabDefinition | undefined,
): { rules?: GreenChemistryRouteRules; errors: string[] } => {
  if (!definition) {
    return { errors: ["Route execution requires a compiled green-chemistry composition."] };
  }
  const errors: string[] = [];
  const rules: GreenChemistryRouteRules = {
    sampleMassG: compiledQuantity(definition, "add-carbonate-sample", "massG", errors),
    warmDurationMin: compiledQuantity(definition, "warm-gently", "durationMin", errors),
    heatingDurationMin: compiledQuantity(definition, "heat-carbonate-mixture", "durationMin", errors),
    heatingIntensity: compiledText(definition, "heat-carbonate-mixture", "intensity", errors),
    constantMassToleranceG: compiledQuantity(definition, "record-cycle-mass", "constantMassToleranceG", errors),
    maximumHeatCycles: compiledPositiveSafeInteger(definition, "repeat-heat-to-constant-mass", "maximumHeatCycles", errors),
    coolingEndpointC: compiledFiniteQuantity(definition, "cool-crucible", "coolingEndpointC", errors),
    coolingSurface: compiledText(definition, "cool-crucible", "coolingSurface", errors),
    tareConvention: compiledTareConvention(definition, "approve-thermal-decomposition-plan", errors),
    minimumReplicates: compiledPositiveSafeInteger(definition, "complete-replicate", "minimumReplicates", errors),
  };
  if (errors.length > 0) return { errors };
  // The same configuration slot feeds the repeat and final stages; a compiled instance that
  // disagrees with itself would let one stage enforce a different approved method than another.
  const mirrored: Array<[string, string, ActionParameterValue]> = [
    ["repeat-heat-to-constant-mass", "durationMin", rules.heatingDurationMin],
    ["repeat-heat-to-constant-mass", "intensity", rules.heatingIntensity],
    ["read-empty-crucible", "maxSafeTemperatureC", rules.coolingEndpointC],
    ["weigh-initial-crucible", "maxSafeTemperatureC", rules.coolingEndpointC],
    ["weigh-preliminary-final-mass", "maxSafeTemperatureC", rules.coolingEndpointC],
    ["weigh-final-crucible", "maxSafeTemperatureC", rules.coolingEndpointC],
    ["cool-constant-mass-crucible", "coolingEndpointC", rules.coolingEndpointC],
    ["cool-constant-mass-crucible", "coolingSurface", rules.coolingSurface],
    ["record-final-crucible-mass", "constantMassToleranceG", rules.constantMassToleranceG],
    ["finalize-unused-master-stock", "minimumReplicates", rules.minimumReplicates],
    ["record-empty-crucible", "tareConvention", rules.tareConvention],
    ["calculate-carbonate-composition", "tareConvention", rules.tareConvention],
  ];
  for (const [actionId, key, expected] of mirrored) {
    if (compiledParameter(definition, actionId, key) !== expected) {
      errors.push(`Compiled action "${actionId}" carries a different "${key}" than its first stage.`);
    }
  }
  return errors.length > 0 ? { errors } : { rules, errors };
};

const compiledInstanceId = (
  definition: LabDefinition | undefined,
  actionId: string,
  key: "sourceInstanceId" | "targetInstanceId",
  errors: string[],
): string => {
  const value = compiledParameter(definition, actionId, key);
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`Compiled action "${actionId}" does not name a "${key}".`);
    return "";
  }
  return value;
};

/**
 * Read the physical holders and the configured material identity out of the compiled instance.
 *
 * The route moves real material between named containers, so the containers are part of the
 * approved method and are verified the same way the quantities are. Every cross-check here exists
 * because the corresponding mistake would silently break material accounting rather than fail
 * loudly: a closing return into the wrong receiver, an EX-08 that empties something other than the
 * vial the load drew from, an EX-19 that empties something other than the crucible the load
 * filled, or one container serving both recovery streams.
 */
export const greenChemistryHoldersFromCompiled = (
  definition: LabDefinition | undefined,
): { holders?: GreenChemistryMaterialHolders; errors: string[] } => {
  if (!definition) {
    return { errors: ["Route execution requires a compiled green-chemistry composition."] };
  }
  const errors: string[] = [];
  const inventory = definition.actions.find(
    (action) => action.id === "configure-unheated-stock",
  )?.sourceInventory;
  if (!inventory || inventory.quantityKind !== "solid-mass") {
    errors.push(
      'Compiled action "configure-unheated-stock" does not declare a solid-mass source inventory.',
    );
  }
  const holders: GreenChemistryMaterialHolders = {
    masterStockInstanceId: compiledInstanceId(
      definition, "configure-unheated-stock", "sourceInstanceId", errors,
    ),
    workingPortionInstanceId: compiledInstanceId(
      definition, "add-carbonate-sample", "sourceInstanceId", errors,
    ),
    crucibleInstanceId: compiledInstanceId(
      definition, "add-carbonate-sample", "targetInstanceId", errors,
    ),
    unusedRecoveryInstanceId: compiledInstanceId(
      definition, "recover-unused-sample", "targetInstanceId", errors,
    ),
    productRecoveryInstanceId: compiledInstanceId(
      definition, "recover-replicate-product", "targetInstanceId", errors,
    ),
    materialSoluteId:
      inventory?.quantityKind === "solid-mass" ? inventory.materialSoluteId : "",
    materialLabel:
      inventory?.quantityKind === "solid-mass" ? inventory.materialLabel : "",
    stockMeasurementId: inventory?.outputMeasurementId ?? "",
  };
  const expectedHolderBindings: Array<
    [keyof typeof EXPECTED_GREEN_CHEMISTRY_PHYSICAL_HOLDER_IDS, string]
  > = [
    ["masterStockInstanceId", holders.masterStockInstanceId],
    ["workingPortionInstanceId", holders.workingPortionInstanceId],
    ["crucibleInstanceId", holders.crucibleInstanceId],
    ["unusedRecoveryInstanceId", holders.unusedRecoveryInstanceId],
    ["productRecoveryInstanceId", holders.productRecoveryInstanceId],
    ["materialSoluteId", holders.materialSoluteId],
  ];
  for (const [key, actual] of expectedHolderBindings) {
    if (actual !== EXPECTED_GREEN_CHEMISTRY_PHYSICAL_HOLDER_IDS[key]) {
      errors.push(
        `Compiled green-chemistry holder "${key}" must be "${EXPECTED_GREEN_CHEMISTRY_PHYSICAL_HOLDER_IDS[key]}".`,
      );
    }
  }
  const namedHolderIds = [
    holders.masterStockInstanceId,
    holders.workingPortionInstanceId,
    holders.crucibleInstanceId,
    holders.unusedRecoveryInstanceId,
    holders.productRecoveryInstanceId,
  ].filter((instanceId) => instanceId.length > 0);
  if (new Set(namedHolderIds).size !== namedHolderIds.length) {
    errors.push(
      "The compiled green-chemistry material holders must be five distinct equipment instances.",
    );
  }
  if (
    compiledParameter(definition, "finalize-unused-master-stock", "sourceInstanceId")
      !== holders.masterStockInstanceId
    || compiledParameter(definition, "finalize-unused-master-stock", "targetInstanceId")
      !== holders.unusedRecoveryInstanceId
  ) {
    errors.push(
      'Compiled action "finalize-unused-master-stock" does not return the same master stock into the same Unused Sample receiver.',
    );
  }
  if (
    compiledParameter(definition, "recover-unused-sample", "sourceInstanceId")
      !== holders.workingPortionInstanceId
  ) {
    errors.push(
      'Compiled action "recover-unused-sample" does not empty the working portion the load draws from.',
    );
  }
  if (
    compiledParameter(definition, "recover-replicate-product", "sourceInstanceId")
      !== holders.crucibleInstanceId
  ) {
    errors.push(
      'Compiled action "recover-replicate-product" does not empty the crucible the load fills.',
    );
  }
  if (
    holders.unusedRecoveryInstanceId !== ""
    && holders.unusedRecoveryInstanceId === holders.productRecoveryInstanceId
  ) {
    errors.push(
      "The unheated and heated recovery streams must use separately labelled containers.",
    );
  }
  if (!holders.materialSoluteId || !holders.materialLabel || !holders.stockMeasurementId) {
    errors.push(
      'Compiled action "configure-unheated-stock" does not name the configured material identity and its evidence output.',
    );
  }
  return errors.length > 0 ? { errors } : { holders, errors };
};

const EXPECTED_GREEN_CHEMISTRY_PHYSICAL_HOLDER_IDS = {
  masterStockInstanceId: "sample-bottle-1",
  workingPortionInstanceId: "working-sample-portion-1",
  crucibleInstanceId: "crucible-with-lid-1",
  unusedRecoveryInstanceId: "unused-sample-recovery-1",
  productRecoveryInstanceId: "heated-product-recovery-1",
  materialSoluteId: "carbonate-mixture-undisclosed",
} as const;

const GREEN_CHEMISTRY_STOCK_MEASUREMENT_SOURCE_ID = "unheated-stock-configured-g";

const GREEN_CHEMISTRY_BALANCE_MASS_PROJECTIONS = [
  ["read-empty-crucible", "empty-crucible-mass"],
  ["weigh-initial-crucible", "loaded-crucible-mass"],
  ["weigh-preliminary-final-mass", "cooled-cycle-mass"],
  ["weigh-final-crucible", "final-cooled-crucible-mass"],
] as const;

/**
 * Reference identities are issued by the compiler for each bound technique instance. Recover the
 * prefix from a compiler-issued evidence output rather than duplicating a literal scope name or
 * delimiter here. Route-target validation independently verifies that this anchor belongs to the
 * approved green-chemistry instance and action.
 */
const greenChemistryBoundReferencePrefix = (
  definition: LabDefinition | undefined,
): { prefix?: string; errors: string[] } => {
  const errors: string[] = [];
  const instances = definition?.compositionManifest?.instances.filter(
    (instance) => instance.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
  ) ?? [];
  if (instances.length !== 1) {
    errors.push(
      `Compiled green-chemistry reference bindings require exactly one "${GREEN_CHEMISTRY_INSTANCE_ID}" manifest instance.`,
    );
    return { errors };
  }
  const anchors = instances[0].evidenceOutputs.filter(
    (output) => output.sourceId === "approval"
      && output.actionId === "approve-thermal-decomposition-plan",
  );
  if (anchors.length !== 1) {
    errors.push(
      'Compiled green-chemistry reference bindings require one compiler-issued approval evidence output.',
    );
    return { errors };
  }
  const anchor = anchors[0];
  if (
    typeof anchor.id !== "string"
    || typeof anchor.sourceId !== "string"
    || !anchor.sourceId
    || !anchor.id.endsWith(anchor.sourceId)
    || anchor.id.length === anchor.sourceId.length
  ) {
    errors.push(
      'Compiled green-chemistry approval evidence does not expose a usable bound reference identity.',
    );
    return { errors };
  }
  return { prefix: anchor.id.slice(0, -anchor.sourceId.length), errors };
};

const validateGreenChemistryMassProjections = (
  definition: LabDefinition | undefined,
): string[] => {
  if (!definition) return ["Route execution requires a compiled green-chemistry composition."];
  const errors: string[] = [];
  const boundReferences = greenChemistryBoundReferencePrefix(definition);
  errors.push(...boundReferences.errors);
  const holders = greenChemistryHoldersFromCompiled(definition).holders;
  for (const [actionId, sourceMeasurementId] of GREEN_CHEMISTRY_BALANCE_MASS_PROJECTIONS) {
    const action = definition.actions.find((candidate) => candidate.id === actionId);
    const mass = action?.mass;
    if (!mass || mass.source !== "action-input") {
      errors.push(`Compiled action "${actionId}" must produce an action-input balance mass.`);
      continue;
    }
    const expectedMeasurementId = boundReferences.prefix
      ? `${boundReferences.prefix}${sourceMeasurementId}`
      : undefined;
    if (expectedMeasurementId && mass.outputMeasurementId !== expectedMeasurementId) {
      errors.push(
        `Compiled action "${actionId}" must produce its compiler-bound measurement "${expectedMeasurementId}".`,
      );
    }
    const continuity = mass.continuity;
    if (
      !continuity
      || continuity.version !== 1
      || continuity.quantityKind !== "balance-display"
      || !holders
      || continuity.measuredSupportInstanceId !== holders.crucibleInstanceId
    ) {
      errors.push(
        `Compiled action "${actionId}" must preserve the v1 balance-display continuity for the compiled crucible holder.`,
      );
    }
  }
  return errors;
};

const validateGreenChemistryRecoveryContracts = (
  definition: LabDefinition | undefined,
): string[] => {
  if (!definition) return ["Route execution requires a compiled green-chemistry composition."];
  const errors: string[] = [];
  const holders = greenChemistryHoldersFromCompiled(definition).holders;
  const boundReferences = greenChemistryBoundReferencePrefix(definition);
  errors.push(...boundReferences.errors);
  const recoveryContracts = [
    ["recover-unused-sample", "whole-remaining", "physical", false],
    ["recover-replicate-product", "whole-remaining", "qualitative-unknown", true],
    ["finalize-unused-master-stock", "whole-remaining", "physical", false],
  ] as const;
  for (const [actionId, mode, destinationRepresentation, requireNonEmptySource] of recoveryContracts) {
    const action = definition.actions.find((candidate) => candidate.id === actionId);
    const contract = action?.solidTransfer;
    if (
      !contract
      || contract.mode !== mode
      || contract.destinationRepresentation !== destinationRepresentation
      || contract.requireNonEmptySource !== requireNonEmptySource
    ) {
      errors.push(
        `Compiled action "${actionId}" must preserve the accepted ${mode}/${destinationRepresentation} recovery contract.`,
      );
    }
  }

  if (holders) {
    const expectedBindings = [
      ["recover-unused-sample", holders.workingPortionInstanceId, holders.unusedRecoveryInstanceId],
      ["recover-replicate-product", holders.crucibleInstanceId, holders.productRecoveryInstanceId],
      ["finalize-unused-master-stock", holders.masterStockInstanceId, holders.unusedRecoveryInstanceId],
    ] as const;
    for (const [actionId, sourceInstanceId, targetInstanceId] of expectedBindings) {
      const action = definition.actions.find((candidate) => candidate.id === actionId);
      const parameters = action?.parameters;
      if (
        parameters?.sourceInstanceId !== sourceInstanceId
        || parameters?.targetInstanceId !== targetInstanceId
      ) {
        errors.push(
          `Compiled action "${actionId}" must bind source "${sourceInstanceId}" to target "${targetInstanceId}".`,
        );
      }
    }
  }
  const stock = definition.actions.find((candidate) => candidate.id === "configure-unheated-stock");
  const inventory = stock?.sourceInventory;
  const expectedStockMeasurementId = boundReferences.prefix
    ? `${boundReferences.prefix}${GREEN_CHEMISTRY_STOCK_MEASUREMENT_SOURCE_ID}`
    : undefined;
  if (
    !inventory
    || inventory.quantityKind !== "solid-mass"
    || !holders
    || inventory.sourceInstanceId !== holders.masterStockInstanceId
    || (expectedStockMeasurementId !== undefined
      && inventory.outputMeasurementId !== expectedStockMeasurementId)
    || inventory.materialSoluteId !== EXPECTED_GREEN_CHEMISTRY_PHYSICAL_HOLDER_IDS.materialSoluteId
    || inventory.materialLabel !== "NaHCO3 and Na2CO3 mixture; composition not disclosed"
  ) {
    errors.push(
      'Compiled action "configure-unheated-stock" must preserve the accepted stock identity and measurement output.',
    );
  }
  return errors;
};

const validateGreenChemistryManifestIdentity = (
  definition: LabDefinition | undefined,
): string[] => {
  if (!definition) return ["Route execution requires a compiled green-chemistry composition."];
  const errors: string[] = [];
  if (definition.id !== GREEN_CHEMISTRY_LAB_ID) {
    errors.push(
      `Compiled lab id "${definition.id}" does not match "${GREEN_CHEMISTRY_LAB_ID}".`,
    );
  }
  const manifest = definition.compositionManifest;
  if (!manifest || manifest.status !== "compiled") {
    return [...errors, "The green route requires a compiler-issued compiled composition manifest."];
  }
  const matchingInstances = manifest.instances.filter(
    (instance) => instance.instanceId === GREEN_CHEMISTRY_INSTANCE_ID,
  );
  if (matchingInstances.length !== 1) {
    errors.push(
      `The compiled manifest must contain exactly one "${GREEN_CHEMISTRY_INSTANCE_ID}" instance.`,
    );
  } else {
    const instance = matchingInstances[0];
    if (instance.techniqueId !== GREEN_CHEMISTRY_TECHNIQUE_ID) {
      errors.push(
        `The compiled manifest instance "${GREEN_CHEMISTRY_INSTANCE_ID}" must use technique "${GREEN_CHEMISTRY_TECHNIQUE_ID}".`,
      );
    }
    if (instance.version !== GREEN_CHEMISTRY_TECHNIQUE_VERSION) {
      errors.push(
        `The compiled manifest instance "${GREEN_CHEMISTRY_INSTANCE_ID}" must use version "${GREEN_CHEMISTRY_TECHNIQUE_VERSION}".`,
      );
    }
  }

  const expectedActionIds = GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS.map(
    (target) => target.actionId,
  );
  const manifestActionIds = manifest.origins
    .filter((origin) => origin.instanceId === GREEN_CHEMISTRY_INSTANCE_ID)
    .map((origin) => origin.actionId)
    .filter((actionId): actionId is string => typeof actionId === "string");
  if (
    manifestActionIds.length !== expectedActionIds.length
    || expectedActionIds.some((actionId, index) => manifestActionIds[index] !== actionId)
  ) {
    errors.push(
      "The compiled thermal action origins do not match the exact ordered green route target list.",
    );
  }

  for (const target of GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS) {
    const action = definition.actions.find((candidate) => candidate.id === target.actionId);
    if (!action) errors.push(`Compiled route action "${target.actionId}" is missing.`);
    const node = definition.process.nodes.find((candidate) => candidate.id === target.nodeId);
    if (!node) {
      errors.push(`Compiled route node "${target.nodeId}" is missing.`);
    } else if (node.actionId !== target.actionId) {
      errors.push(
        `Compiled route node "${target.nodeId}" owns "${node.actionId}", not "${target.actionId}".`,
      );
    }
    const origins = manifest.origins.filter(
      (origin) => origin.instanceId === target.instanceId && origin.actionId === target.actionId,
    );
    if (origins.length !== 1) {
      errors.push(
        `Compiled route action "${target.actionId}" must have exactly one matching origin.`,
      );
    } else {
      const origin = origins[0];
      if (
        origin.techniqueId !== target.techniqueId
        || origin.techniqueVersion !== target.techniqueVersion
        || origin.nodeId !== target.nodeId
      ) {
        errors.push(
          `Compiled route identity for "${target.actionId}" does not match its exact route target.`,
        );
      }
    }
  }
  return errors;
};

const materialSlice = (material: GreenChemistryMaterialState): SolidMaterialSlice => ({
  instances: material.instances,
  stockInitializations: material.stockInitializations,
});

const holderInstance = (
  material: GreenChemistryMaterialState,
  instanceId: string,
): EquipmentInstance | undefined =>
  material.instances.find((instance) => instance.id === instanceId);

/**
 * The physical gram inventory of a named holder, or `undefined` when the holder is missing or is
 * not a usable physical solid. A qualitative receiver deliberately resolves to `undefined`: its
 * bookkeeping grams are not an inventory.
 */
const holderPhysicalMassG = (
  material: GreenChemistryMaterialState,
  instanceId: string,
): number | undefined => {
  const instance = holderInstance(material, instanceId);
  return instance ? resolvePhysicalSolidInventoryMassG(instance.contents) : undefined;
};

/** Genuinely empty: no declared mass, no solute amount, no liquid, and no recovery provenance. */
const holderIsEmpty = (
  material: GreenChemistryMaterialState,
  instanceId: string,
): boolean => {
  const instance = holderInstance(material, instanceId);
  if (!instance) return false;
  const contents = instance.contents;
  return (
    (contents.massG ?? 0) === 0
    && Array.isArray(contents.solutes)
    && contents.solutes.every(
      (solute) => Boolean(solute) && Number.isFinite(solute.amount) && solute.amount === 0,
    )
    && (contents.volumeMl ?? 0) === 0
    && contents.finalVolumeMl === undefined
    && contents.concentration === undefined
    && contents.precipitate === undefined
    && contents.chromatogram === undefined
    && contents.unallocatedInventory === undefined
    && (contents.wasteContents === undefined
      || (Array.isArray(contents.wasteContents) && contents.wasteContents.length === 0))
    && (contents.qualitativeSolidProvenance === undefined
      || (Array.isArray(contents.qualitativeSolidProvenance)
        && contents.qualitativeSolidProvenance.length === 0))
  );
};

/** EmptyContents() is the only valid post-transfer empty state for a terminal reconciliation. */
const holderIsGenuinelyEmpty = (
  material: GreenChemistryMaterialState,
  instanceId: string,
): boolean => {
  const instance = holderInstance(material, instanceId);
  return Boolean(
    instance
    && instance.contents.kind === "empty"
    && instance.contents.massG === undefined
    && instance.contents.volumeMl === undefined
    && instance.contents.finalVolumeMl === undefined
    && Array.isArray(instance.contents.contamination)
    && instance.contents.contamination.length === 0
    && instance.contents.temperatureC === undefined
    && instance.contents.recordedTemperature === undefined
    && instance.contents.recoveryEvidence === undefined
    && instance.contents.allocationReferenceId === undefined
    && instance.contents.extractionState === undefined
    && instance.contents.probeImmersedInInstanceId === undefined
    && instance.contents.instrumentReadout === undefined
    && instance.contents.wetState === "dry"
    && instance.contents.visualState === "empty"
    && holderIsEmpty(material, instanceId),
  );
};

const sameStringArray = (
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean =>
  Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => value === right[index]);

const validEvidenceIdArray = (values: readonly string[] | undefined): boolean =>
  Array.isArray(values)
  && values.every((value) => typeof value === "string" && value.trim().length > 0);

const uniqueSortedEvidenceIds = (values: readonly string[]): string[] =>
  [...new Set(values)].sort();

/**
 * The route repeats the same action ids for each replicate.  Evidence binding therefore follows
 * the ordered complete-replicate boundaries rather than globally collecting an action id, which
 * would let replicate two cite replicate one's mass or recovery output.
 */
const evidenceSegmentThrough = (
  state: GreenChemistryRouteState,
  replicate: number,
  throughActionId: string,
): RouteTechniqueExecutionEvidence[] => {
  const replicateIndex = state.completedReplicates.findIndex(
    (entry) => entry.replicate === replicate,
  );
  if (replicateIndex < 0) return [];
  const completionIndexes = state.evidence.reduce<number[]>(
    (indexes, entry, index) => {
      if (entry.actionId === "complete-replicate") indexes.push(index);
      return indexes;
    },
    [],
  );
  const completionIndex = completionIndexes[replicateIndex];
  if (completionIndex === undefined) return [];
  const startIndex = replicateIndex === 0
    ? 0
    : (completionIndexes[replicateIndex - 1] ?? -1) + 1;
  if (startIndex < 0 || startIndex > completionIndex) return [];
  const segment = state.evidence.slice(startIndex, completionIndex + 1);
  const throughIndex = segment.findIndex((entry) => entry.actionId === throughActionId);
  return throughIndex < 0 ? [] : segment.slice(0, throughIndex + 1);
};

const evidenceIdsFromActions = (
  entries: readonly RouteTechniqueExecutionEvidence[],
  actionIds: readonly string[],
): string[] => uniqueSortedEvidenceIds(
  entries
    .filter((entry) => actionIds.includes(entry.actionId))
    .flatMap((entry) => entry.evidence),
);

const measurementIdsFromEntries = (
  entries: readonly RouteTechniqueExecutionEvidence[],
  replicate: number,
): string[] => uniqueSortedEvidenceIds(
  entries
    .flatMap((entry) => Object.keys(entry.measurements ?? {}))
    .filter((id) => id.startsWith(`replicate-${replicate}-`)),
);

/** Full field-for-field equality for the canonical qualitative product record. */
const sameProductRecoveryRecord = (
  left: GreenChemistryProductRecoveryRecord,
  right: GreenChemistryProductRecoveryRecord,
): boolean =>
  left.recordId === right.recordId
  && left.runId === right.runId
  && left.replicate === right.replicate
  && left.operationId === right.operationId
  && left.stream === right.stream
  && left.sourceMaterialId === right.sourceMaterialId
  && left.sourceMaterialLabel === right.sourceMaterialLabel
  && left.sourceInstanceId === right.sourceInstanceId
  && left.destinationInstanceId === right.destinationInstanceId
  && left.sourceActionId === right.sourceActionId
  && left.quantityBasis === right.quantityBasis
  && left.sourceInventoryMassG === right.sourceInventoryMassG
  && left.sourceInventoryEquivalentMassG === right.sourceInventoryEquivalentMassG
  && left.destinationPhysicalMassKnown === right.destinationPhysicalMassKnown
  && sameStringArray(left.measurementEvidenceIds, right.measurementEvidenceIds)
  && sameStringArray(left.recoveryEvidenceIds, right.recoveryEvidenceIds)
  && sameStringArray(left.routeEvidenceIds, right.routeEvidenceIds);

const sortedRecordIds = (
  records: readonly GreenChemistryRecoveryRecord[],
): string[] => records.map((record) => record.recordId).sort();

const unheatedReceiverConflict = (
  material: GreenChemistryMaterialState,
  instanceId: string,
): string | undefined => {
  const receiver = holderInstance(material, instanceId);
  if (!receiver) return "The named Unused Sample receiver is not on the bench.";
  if (
    receiver.contents.qualitativeSolidProvenance !== undefined
    && !Array.isArray(receiver.contents.qualitativeSolidProvenance)
  ) {
    return "The Unused Sample receiver contains malformed qualitative provenance.";
  }
  if (receiver.contents.qualitativeSolidProvenance?.length) {
    return "The Unused Sample receiver cannot hold qualitative heated-product provenance.";
  }
  if (holderIsGenuinelyEmpty(material, instanceId)) return undefined;
  if (receiver.contents.kind !== "solid" && receiver.contents.kind !== "mixture") {
    return "The Unused Sample receiver already holds a non-solid phase.";
  }
  if (
    receiver.contents.precipitate !== undefined
    || (receiver.contents.volumeMl !== undefined && receiver.contents.volumeMl !== 0)
    || receiver.contents.finalVolumeMl !== undefined
    || receiver.contents.concentration !== undefined
    || receiver.contents.chromatogram !== undefined
    || receiver.contents.unallocatedInventory !== undefined
    || (receiver.contents.wasteContents?.length ?? 0) > 0
  ) {
    return "The Unused Sample receiver already holds incompatible liquid or precipitate contents.";
  }
  if (
    !Array.isArray(receiver.contents.solutes)
    || receiver.contents.solutes.length === 0
    || receiver.contents.solutes.some(
      (solute) =>
        !solute
        || !Number.isFinite(solute.amount)
        || solute.amount < 0
        || solute.id !== material.holders.materialSoluteId
        || solute.label !== material.holders.materialLabel
        || solute.unit !== "g",
    )
  ) {
    return "The Unused Sample receiver already holds a different material identity.";
  }
  if (holderPhysicalMassG(material, instanceId) === undefined) {
    return "The Unused Sample receiver does not hold a usable physical solid inventory.";
  }
  return undefined;
};

/** Solid gram bookkeeping rounds to six decimals, matching the shared split/merge contract. */
const roundSolidG = (value: number): number => Number(value.toFixed(6));

/**
 * Checks the material packet that must exist before a run can close.
 *
 * This is intentionally stricter than comparing record counts: a count can still be satisfied by
 * an orphaned issue, a recovery for another source, or a product record that is not the one linked
 * from the completed replicate. The finalizer calls this before touching the master stock, while
 * the final confirmation performs the same linkage again against the frozen set.
 */
const completedMaterialPacketErrors = (
  state: GreenChemistryRouteState,
  material: GreenChemistryMaterialState,
  holders: GreenChemistryMaterialHolders,
): string[] => {
  const errors: string[] = [];
  const completedOrdinals = material.completed.map((entry) => entry.replicate);
  const workingRecords = material.recoveryRecords.filter(
    (record): record is GreenChemistryUnheatedRecoveryRecord =>
      record.stream === "unheated" && record.operationId === "recover-unused-sample",
  );
  const productRecords = material.productRecords;
  if (
    material.issuedWorkingPortions.length !== material.completed.length
    || productRecords.length !== material.completed.length
    || workingRecords.length !== material.completed.length
    || material.recoveryRecords.length !== material.completed.length * 2
  ) {
    errors.push("The completed material packet contains an orphan, missing or extra recovery entry.");
  }
  for (const completed of material.completed) {
    const issueRecordId = greenChemistryIssueRecordId(state.runId, completed.replicate);
    const issue = material.issuedWorkingPortions.find(
      (candidate) => candidate.replicate === completed.replicate,
    );
    if (
      !issue
      || issue.issueId !== issueRecordId
      || completed.issueRecordId !== issue.issueId
      || issue.runId !== state.runId
      || issue.operationId !== "add-carbonate-sample"
      || issue.sourceInstanceId !== holders.masterStockInstanceId
      || issue.destinationInstanceId !== holders.workingPortionInstanceId
      || issue.sourceMaterialId !== holders.materialSoluteId
      || issue.sourceMaterialLabel !== holders.materialLabel
      || issue.massG !== material.configuredWorkingPortionMassG
      || issue.massG !== completed.issuedWorkingMassG
    ) {
      errors.push(`Replicate ${completed.replicate} is not linked to its exact working-portion issue.`);
    }

    const workingRecord = workingRecords.find(
      (candidate) => candidate.replicate === completed.replicate,
    );
    if (
      !workingRecord
      || workingRecord.recordId !== greenChemistryReplicateRecordId(
        state.runId,
        completed.replicate,
        "recover-unused-sample",
      )
      || workingRecord.runId !== state.runId
      || workingRecord.replicate !== completed.replicate
      || workingRecord.sourceInstanceId !== holders.workingPortionInstanceId
      || workingRecord.destinationInstanceId !== holders.unusedRecoveryInstanceId
      || workingRecord.sourceMaterialId !== holders.materialSoluteId
      || workingRecord.sourceMaterialLabel !== holders.materialLabel
      || workingRecord.sourceActionId !== "recover-unused-sample"
      || workingRecord.quantityBasis !== "working-remainder"
      || workingRecord.destinationPhysicalMassKnown !== true
      || workingRecord.sourceInventoryMassG !== completed.excessReturnedG
    ) {
      errors.push(`Replicate ${completed.replicate} is not linked to its exact unheated recovery record.`);
    }

    const productRecord = productRecords.find(
      (candidate) => candidate.replicate === completed.replicate,
    );
    if (
      !productRecord
      || productRecord.recordId !== greenChemistryReplicateRecordId(
        state.runId,
        completed.replicate,
        "recover-replicate-product",
      )
      || completed.productRecordId !== productRecord.recordId
      || productRecord.runId !== state.runId
      || productRecord.operationId !== "recover-replicate-product"
      || productRecord.stream !== "heated-product"
      || productRecord.sourceMaterialId !== holders.materialSoluteId
      || productRecord.sourceMaterialLabel !== holders.materialLabel
      || productRecord.sourceInstanceId !== holders.crucibleInstanceId
      || productRecord.destinationInstanceId !== holders.productRecoveryInstanceId
      || productRecord.sourceActionId !== "recover-replicate-product"
      || productRecord.quantityBasis !== "source-inventory-equivalent"
      || productRecord.destinationPhysicalMassKnown !== false
      || productRecord.sourceInventoryMassG !== completed.loadedPortionMassG
      || productRecord.sourceInventoryEquivalentMassG !== completed.loadedPortionMassG
    ) {
      errors.push(`Replicate ${completed.replicate} is not linked to its exact heated-product recovery record.`);
    }
  }
  if (new Set(completedOrdinals).size !== completedOrdinals.length) {
    errors.push("The completed material packet contains a duplicate replicate ordinal.");
  }
  return errors;
};

/**
 * Everything that must be true before a run may state that all of its material is accounted for.
 *
 * This is deliberately an exact reconciliation rather than a tolerance: every number compared here
 * is the route's own six-decimal bookkeeping of transfers the shared helper actually performed, so
 * a disagreement means material was lost, double-counted, or attributed to the wrong run - not
 * that a measurement was imprecise. The constant-mass tolerance governs balance readings and has
 * no business here.
 */
const finalReconciliationErrors = (state: GreenChemistryRouteState): string[] => {
  const material = state.material;
  if (!material) return ["No material was ever configured for this run."];
  if (!material.closure) return ["The run has not returned its remaining master stock."];
  const { closure, holders } = material;
  const errors: string[] = [];

  if (state.runPhase !== "closed" || material.active || state.pendingMassReading) {
    errors.push("The run is not in a settled closed state.");
  }
  if (
    state.crucibleState !== "cool-empty"
    || state.cruciblePlaced
    || state.emptyMassRecorded
    || state.loadedMassRecorded
    || state.finalMassRecorded
    || state.unusedSampleRecovered
    || state.replicateProductRecovered
    || state.cycles.length > 0
    || !sameStringArray(state.assemblySteps, REUSABLE_APPARATUS_STEPS)
    || state.lidPosition !== "off"
    || state.gentleWarmComplete
  ) {
    errors.push("The current replicate lifecycle is not fully cleared.");
  }

  const frozen = [...closure.frozenReplicates].sort((a, b) => a - b);
  const completedOrdinals = material.completed
    .map((entry) => entry.replicate)
    .sort((a, b) => a - b);
  const measurementOrdinals = state.completedReplicates
    .map((entry) => entry.replicate)
    .sort((a, b) => a - b);
  if (
    frozen.length !== completedOrdinals.length
    || frozen.some((ordinal, index) => ordinal !== completedOrdinals[index])
    || frozen.length !== measurementOrdinals.length
    || frozen.some((ordinal, index) => ordinal !== measurementOrdinals[index])
    || new Set(frozen).size !== frozen.length
  ) {
    errors.push("The frozen replicate set does not match the replicates this run completed.");
  }
  const expectedClosedIds = greenChemistryClosedReplicateIds(state.runId, frozen);
  if (
    !state.closedCompletedReplicateIds
    || !sameStringArray(state.closedCompletedReplicateIds, expectedClosedIds)
  ) {
    errors.push("The closed replicate identity does not match the frozen completed set.");
  }
  if (
    state.stockClosureRecordId !== closure.stockClosureRecordId
    || closure.stockClosureRecordId !== greenChemistryMasterClosureRecordId(state.runId)
  ) {
    errors.push("The stock closure record is missing or belongs to a different run.");
  }
  if (material.completed.length !== state.completedReplicates.length) {
    errors.push(
      "The material record and the measurement record disagree about how many replicates completed.",
    );
  }

  const recoveryRecords = material.recoveryRecords;
  const recoveryRecordIds = sortedRecordIds(recoveryRecords);
  if (new Set(recoveryRecordIds).size !== recoveryRecordIds.length) {
    errors.push("A recovery record was recorded twice.");
  }
  if (recoveryRecords.some((record) => record.runId !== state.runId)) {
    errors.push("A recovery record belongs to a different run.");
  }
  for (const record of recoveryRecords) {
    if (
      !Number.isFinite(record.sourceInventoryMassG)
      || record.sourceInventoryMassG < 0
      || !validEvidenceIdArray(record.measurementEvidenceIds)
      || !validEvidenceIdArray(record.routeEvidenceIds)
      || !validEvidenceIdArray(record.recoveryEvidenceIds)
    ) {
      errors.push(`Recovery record "${record.recordId}" is malformed.`);
    }
  }

  const productRecoveryRecords = recoveryRecords.filter(
    (record): record is GreenChemistryProductRecoveryRecord => record.stream === "heated-product",
  );
  const unheatedRecoveryRecords = recoveryRecords.filter(
    (record): record is GreenChemistryUnheatedRecoveryRecord => record.stream === "unheated",
  );
  const masterClosureRecords = unheatedRecoveryRecords.filter(
    (record) => record.operationId === "finalize-unused-master-stock",
  );
  const workingRecoveryRecords = unheatedRecoveryRecords.filter(
    (record) => record.operationId === "recover-unused-sample",
  );
  if (
    recoveryRecords.some(
      (record) =>
        (record.stream === "heated-product" && record.operationId !== "recover-replicate-product")
        || (record.stream === "unheated"
          && record.operationId !== "recover-unused-sample"
          && record.operationId !== "finalize-unused-master-stock")
        || (record.stream !== "heated-product" && record.stream !== "unheated"),
    )
  ) {
    errors.push("A recovery record has an unsupported operation or stream pairing.");
  }

  // Counts are not enough to prove that the current records belong to the completed material
  // packets. Link every completed ordinal back to its deterministic issue, unheated return and
  // product record, including the source-side quantities captured at each boundary.
  for (const completed of material.completed) {
    const issueRecordId = greenChemistryIssueRecordId(state.runId, completed.replicate);
    const issue = material.issuedWorkingPortions.find(
      (candidate) => candidate.replicate === completed.replicate,
    );
    if (
      !issue
      || issue.issueId !== issueRecordId
      || completed.issueRecordId !== issue.issueId
      || issue.massG !== completed.issuedWorkingMassG
    ) {
      errors.push(`Replicate ${completed.replicate} is not linked to its exact working-portion issue.`);
    }

    const workingRecordId = greenChemistryReplicateRecordId(
      state.runId,
      completed.replicate,
      "recover-unused-sample",
    );
    const workingRecord = workingRecoveryRecords.find(
      (candidate) => candidate.replicate === completed.replicate,
    );
    if (
      !workingRecord
      || workingRecord.recordId !== workingRecordId
      || workingRecord.sourceInventoryMassG !== completed.excessReturnedG
    ) {
      errors.push(`Replicate ${completed.replicate} is not linked to its exact unheated recovery record.`);
    }

    const productRecordId = greenChemistryReplicateRecordId(
      state.runId,
      completed.replicate,
      "recover-replicate-product",
    );
    const productRecord = material.productRecords.find(
      (candidate) => candidate.replicate === completed.replicate,
    );
    if (
      !productRecord
      || productRecord.recordId !== productRecordId
      || completed.productRecordId !== productRecord.recordId
    ) {
      errors.push(`Replicate ${completed.replicate} is not linked to its exact heated-product recovery record.`);
    }
  }

  if (masterClosureRecords.length !== 1) {
    errors.push("The run must have exactly one master-stock closure record.");
  }
  if (
    recoveryRecords.length
      !== productRecoveryRecords.length
      + workingRecoveryRecords.length
      + masterClosureRecords.length
  ) {
    errors.push("The recovery history contains an unknown or orphaned record.");
  }
  const masterClosureRecord = masterClosureRecords[0];
  const masterClosureEvidenceEntries = state.evidence.filter(
    (entry) => entry.actionId === "finalize-unused-master-stock",
  );
  const masterClosureEvidenceIds = evidenceIdsFromActions(
    state.evidence,
    ["finalize-unused-master-stock"],
  );
  if (masterClosureEvidenceEntries.length !== 1) {
    errors.push("The master-stock closure evidence is missing or duplicated.");
  }
  if (
    masterClosureRecord
    && (
      masterClosureRecord.recordId !== closure.stockClosureRecordId
      || masterClosureRecord.runId !== state.runId
      || masterClosureRecord.replicate !== undefined
      || masterClosureRecord.sourceInstanceId !== holders.masterStockInstanceId
      || masterClosureRecord.destinationInstanceId !== holders.unusedRecoveryInstanceId
      || masterClosureRecord.sourceMaterialId !== holders.materialSoluteId
      || masterClosureRecord.sourceMaterialLabel !== holders.materialLabel
      || masterClosureRecord.sourceActionId !== "finalize-unused-master-stock"
      || masterClosureRecord.quantityBasis !== "master-stock-remainder"
      || masterClosureRecord.destinationPhysicalMassKnown !== true
      || masterClosureRecord.sourceInventoryMassG !== closure.masterRemainderReturnedG
      || !sameStringArray(masterClosureRecord.measurementEvidenceIds, [])
      || !sameStringArray(masterClosureRecord.routeEvidenceIds, masterClosureEvidenceIds)
      || !sameStringArray(masterClosureRecord.recoveryEvidenceIds, masterClosureEvidenceIds)
      || masterClosureEvidenceIds.length === 0
    )
  ) {
    errors.push("The master-stock closure record does not match the compiled source and receiver.");
  }

  const expectedProductRecordIds = material.productRecords.map((record) => record.recordId).sort();
  const actualProductRecordIds = productRecoveryRecords.map((record) => record.recordId).sort();
  if (
    material.productRecords.length !== productRecoveryRecords.length
    || actualProductRecordIds.some((id, index) => id !== expectedProductRecordIds[index])
    || new Set(expectedProductRecordIds).size !== expectedProductRecordIds.length
  ) {
    errors.push("The route product records and recovery history do not match exactly.");
  }
  for (const record of material.productRecords) {
    const matching = productRecoveryRecords.find((candidate) => candidate.recordId === record.recordId);
    if (!matching || !sameProductRecoveryRecord(record, matching)) {
      errors.push(`Product recovery record "${record.recordId}" was altered or is missing from recovery history.`);
    }
  }
  if (
    productRecoveryRecords.length !== frozen.length
    || productRecoveryRecords.some((record) => !frozen.includes(record.replicate))
    || new Set(productRecoveryRecords.map((record) => record.replicate)).size
      !== productRecoveryRecords.length
  ) {
    errors.push("There must be exactly one product record for every frozen replicate.");
  }
  for (const record of productRecoveryRecords) {
    if (
      !material.completed.some(
        (completed) =>
          completed.replicate === record.replicate
          && record.sourceInventoryMassG === completed.loadedPortionMassG
          && record.sourceInventoryEquivalentMassG === completed.loadedPortionMassG,
      )
      || !sameStringArray(
        record.measurementEvidenceIds,
        measurementIdsFromEntries(
          evidenceSegmentThrough(state, record.replicate, "recover-replicate-product"),
          record.replicate,
        ),
      )
      || !sameStringArray(
        record.recoveryEvidenceIds,
        evidenceIdsFromActions(
          evidenceSegmentThrough(state, record.replicate, "recover-replicate-product"),
          ["recover-unused-sample", "recover-replicate-product"],
        ),
      )
      || !sameStringArray(
        record.routeEvidenceIds,
        evidenceIdsFromActions(
          evidenceSegmentThrough(state, record.replicate, "recover-replicate-product"),
          ["record-initial-crucible-mass", "record-final-crucible-mass"],
        ),
      )
      || measurementIdsFromEntries(
        evidenceSegmentThrough(state, record.replicate, "recover-replicate-product"),
        record.replicate,
      ).length === 0
      || evidenceIdsFromActions(
        evidenceSegmentThrough(state, record.replicate, "recover-replicate-product"),
        ["recover-unused-sample", "recover-replicate-product"],
      ).length === 0
      || evidenceIdsFromActions(
        evidenceSegmentThrough(state, record.replicate, "recover-replicate-product"),
        ["record-initial-crucible-mass", "record-final-crucible-mass"],
      ).length === 0
      || record.recordId !== greenChemistryReplicateRecordId(
        state.runId,
        record.replicate,
        "recover-replicate-product",
      )
      || record.runId !== state.runId
      || record.operationId !== "recover-replicate-product"
      || record.stream !== "heated-product"
      || record.sourceInstanceId !== holders.crucibleInstanceId
      || record.destinationInstanceId !== holders.productRecoveryInstanceId
      || record.sourceMaterialId !== holders.materialSoluteId
      || record.sourceMaterialLabel !== holders.materialLabel
      || record.sourceActionId !== "recover-replicate-product"
      || record.quantityBasis !== "source-inventory-equivalent"
      || record.destinationPhysicalMassKnown !== false
      || !Number.isFinite(record.sourceInventoryMassG)
      || record.sourceInventoryMassG < 0
      || !Number.isFinite(record.sourceInventoryEquivalentMassG)
        || record.sourceInventoryEquivalentMassG < 0
        || record.sourceInventoryEquivalentMassG !== record.sourceInventoryMassG
        || !Array.isArray(record.measurementEvidenceIds)
    ) {
      errors.push(`Product recovery record "${record.recordId}" has the wrong material identity or stream.`);
    }
  }

  const productReceiver = holderInstance(material, holders.productRecoveryInstanceId);
  const receiverProvenance = productReceiver?.contents.qualitativeSolidProvenance;
  const receiverProductRecords = Array.isArray(receiverProvenance)
    ? receiverProvenance
    : [];
  if (receiverProvenance !== undefined && !Array.isArray(receiverProvenance)) {
    errors.push("The product receiver contains malformed qualitative provenance.");
  }
  if (
    !productReceiver
    || productReceiver.contents.kind !== "solid"
    || productReceiver.contents.massG !== undefined
    || productReceiver.contents.volumeMl !== undefined
    || productReceiver.contents.finalVolumeMl !== undefined
    || productReceiver.contents.concentration !== undefined
    || productReceiver.contents.precipitate !== undefined
    || productReceiver.contents.chromatogram !== undefined
    || productReceiver.contents.unallocatedInventory !== undefined
    || productReceiver.contents.wasteContents !== undefined
    || !Array.isArray(productReceiver.contents.solutes)
    || productReceiver.contents.solutes.length !== 0
    || receiverProvenance === undefined
  ) {
    errors.push("The product receiver is not a qualitative-only solid receiver.");
  }
  const receiverProductRecordIds = receiverProductRecords.map((record) => record.recordId).sort();
  if (
    receiverProductRecords.length !== productRecoveryRecords.length
    || receiverProductRecordIds.some((id, index) => id !== actualProductRecordIds[index])
    || new Set(receiverProductRecordIds).size !== receiverProductRecordIds.length
  ) {
    errors.push("The product receiver's provenance records do not match the route records.");
  }
  for (const record of productRecoveryRecords) {
    const received = receiverProductRecords.find((candidate) => candidate.recordId === record.recordId);
    if (!received || !sameProductRecoveryRecord(record, received)) {
      errors.push(`Product receiver provenance "${record.recordId}" is not field-for-field identical.`);
    }
  }

  if (
    workingRecoveryRecords.length !== frozen.length
    || workingRecoveryRecords.some((record) =>
      record.replicate === undefined || !frozen.includes(record.replicate),
    )
    || new Set(workingRecoveryRecords.map((record) => record.replicate)).size
      !== workingRecoveryRecords.length
  ) {
    errors.push("There must be exactly one unheated working-remainder record for every frozen replicate.");
  }
  for (const record of workingRecoveryRecords) {
    const unheatedEntries = evidenceSegmentThrough(
      state,
      record.replicate ?? -1,
      "recover-unused-sample",
    );
    const expectedMeasurementIds = measurementIdsFromEntries(
      unheatedEntries,
      record.replicate ?? -1,
    );
    const expectedRouteEvidenceIds = evidenceIdsFromActions(
      unheatedEntries,
      ["record-initial-crucible-mass"],
    );
    const expectedRecoveryEvidenceIds = evidenceIdsFromActions(
      unheatedEntries,
      ["recover-unused-sample"],
    );
    if (
      record.runId !== state.runId
      || record.replicate === undefined
      || record.recordId !== greenChemistryReplicateRecordId(
        state.runId,
        record.replicate,
        "recover-unused-sample",
      )
      || record.operationId !== "recover-unused-sample"
      || record.stream !== "unheated"
      || record.sourceInstanceId !== holders.workingPortionInstanceId
      || record.destinationInstanceId !== holders.unusedRecoveryInstanceId
      || record.sourceMaterialId !== holders.materialSoluteId
      || record.sourceMaterialLabel !== holders.materialLabel
      || record.sourceActionId !== "recover-unused-sample"
      || record.quantityBasis !== "working-remainder"
      || record.destinationPhysicalMassKnown !== true
      || !sameStringArray(record.measurementEvidenceIds, expectedMeasurementIds)
      || !sameStringArray(record.routeEvidenceIds, expectedRouteEvidenceIds)
      || !sameStringArray(record.recoveryEvidenceIds, expectedRecoveryEvidenceIds)
      || expectedMeasurementIds.length === 0
      || expectedRouteEvidenceIds.length === 0
      || expectedRecoveryEvidenceIds.length === 0
    ) {
      errors.push(`Unheated recovery record "${record.recordId}" has the wrong source or stream.`);
    }
  }

  const issueIds = material.issuedWorkingPortions.map((issue) => issue.issueId);
  if (
    new Set(issueIds).size !== issueIds.length
    || material.issuedWorkingPortions.length !== material.completed.length
    || material.issuedWorkingPortions.some((issue) =>
      issue.runId !== state.runId
      || issue.issueId !== greenChemistryIssueRecordId(state.runId, issue.replicate)
      || issue.operationId !== "add-carbonate-sample"
      || issue.sourceInstanceId !== holders.masterStockInstanceId
      || issue.destinationInstanceId !== holders.workingPortionInstanceId
      || issue.sourceMaterialId !== holders.materialSoluteId
      || issue.sourceMaterialLabel !== holders.materialLabel
      || issue.massG !== material.configuredWorkingPortionMassG
      || !Number.isInteger(issue.replicate)
      || issue.replicate <= 0,
    )
  ) {
    errors.push("The working-portion issue history has an orphan, duplicate or foreign entry.");
  }
  if (
    material.issuedWorkingPortions.some((issue) => !frozen.includes(issue.replicate))
    || new Set(material.issuedWorkingPortions.map((issue) => issue.replicate)).size
      !== material.issuedWorkingPortions.length
  ) {
    errors.push("The issue history does not match the frozen completed replicate set.");
  }

  // The unheated stream is physical, so its receiver must hold exactly the aggregate amount in the
  // working-remainder and master-closure records. The all-zero branch deliberately does not ask a
  // solid-only resolver to interpret an untouched empty receiver.
  const returnedUnheatedG = roundSolidG(
    unheatedRecoveryRecords.reduce((total, record) => total + record.sourceInventoryMassG, 0),
  );
  const unusedReceiver = holderInstance(material, holders.unusedRecoveryInstanceId);
  if (!unusedReceiver) {
    errors.push("The compiled Unused Sample receiver is missing.");
  } else if (returnedUnheatedG === 0) {
    if (!holderIsGenuinelyEmpty(material, holders.unusedRecoveryInstanceId)) {
      errors.push("Nothing unheated was returned, but the Unused Sample container is not genuinely empty.");
    }
  } else {
    const heldG = holderPhysicalMassG(material, holders.unusedRecoveryInstanceId);
    if (
      heldG === undefined
      || roundSolidG(heldG) !== returnedUnheatedG
      || !Array.isArray(unusedReceiver.contents.solutes)
      || unusedReceiver.contents.solutes.length === 0
      || unusedReceiver.contents.solutes.some(
        (solute) =>
          !solute
          || !Number.isFinite(solute.amount)
          || solute.amount < 0
          || solute.id !== holders.materialSoluteId
          || solute.label !== holders.materialLabel
          || solute.unit !== "g",
      )
      || roundSolidG(
        unusedReceiver.contents.solutes.reduce(
          (total, solute) =>
            solute.unit === "g" && Number.isFinite(solute.amount)
              ? total + solute.amount
              : Number.NaN,
          0,
        ),
      ) !== returnedUnheatedG
      || (unusedReceiver.contents.qualitativeSolidProvenance !== undefined
        && (!Array.isArray(unusedReceiver.contents.qualitativeSolidProvenance)
          || unusedReceiver.contents.qualitativeSolidProvenance.length > 0))
    ) {
      errors.push(
        "The Unused Sample container does not hold the unheated material this run returned.",
      );
    }
  }

  for (const [instanceId, label] of [
    [holders.masterStockInstanceId, "master stock bottle"],
    [holders.workingPortionInstanceId, "working portion vial"],
    [holders.crucibleInstanceId, "crucible"],
  ] as const) {
    if (!holderIsGenuinelyEmpty(material, instanceId)) {
      errors.push(`The ${label} is not genuinely empty after closure.`);
    }
  }

  const issuedG = roundSolidG(
    material.completed.reduce((total, entry) => total + entry.issuedWorkingMassG, 0),
  );
  const resolvedG = roundSolidG(
    material.completed.reduce(
      (total, entry) => total + entry.excessReturnedG + entry.loadedPortionMassG,
      0,
    ),
  );
  if (issuedG !== resolvedG) {
    errors.push("The issued working portions do not add up to what was loaded and returned.");
  }
  if (roundSolidG(issuedG + closure.masterRemainderReturnedG)
    !== roundSolidG(material.configuredStockMassG)) {
    errors.push("The configured stock does not add up to what was issued and returned.");
  }
  return errors;
};

/** Only these nonphysical actions remain available after terminal stock closure. */
export const CLOSED_RUN_ALLOWED_ACTION_IDS: readonly string[] = [
  "calculate-carbonate-composition",
  "record-composition-uncertainty",
  "recover-final-product",
  ...GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS,
];

/** The lab-owned nodes must exist in the compiled root process with their compiled action. */
const validateLabNodeProjections = (definition: LabDefinition | undefined): string[] => {
  if (!definition) return ["Route execution requires a compiled green-chemistry composition."];
  const errors: string[] = [];
  for (const actionId of GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS) {
    const nodeId = `${actionId}-node`;
    const node = definition.process.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      errors.push(`Lab node projection "${nodeId}" is not part of the compiled root process.`);
      continue;
    }
    if (node.actionId !== actionId) {
      errors.push(`Compiled node "${nodeId}" owns action "${node.actionId}", not "${actionId}".`);
    }
    if (!definition.actions.some((action) => action.id === actionId)) {
      errors.push(`Compiled lab action "${actionId}" is missing from the compiled definition.`);
    }
  }
  return errors;
};

const numberPayload = (
  payload: RouteTechniqueExecutionIntent["payload"],
  key: string,
): number | undefined => {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

const stringPayload = (
  payload: RouteTechniqueExecutionIntent["payload"],
  key: string,
): string | undefined => {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const requireClosedRunBinding = (
  state: GreenChemistryRouteState,
  intent: RouteTechniqueExecutionIntent,
) => {
  const expectedBinding = greenChemistryClosedReplicateSetBinding(state);
  if (state.runPhase !== "closed" || !state.material?.closure || !expectedBinding) {
    return rejection(
      state,
      "closed-run-required",
      "This record action is available only after the run has been closed and its completed set frozen.",
      "Return the remaining master stock before recording analysis or final confirmation.",
    );
  }
  if (
    stringPayload(intent.payload, "runId") !== state.runId
    || stringPayload(intent.payload, "closedReplicateSet") !== expectedBinding
  ) {
    return rejection(
      state,
      "closed-set-binding-mismatch",
      "This record does not identify the current run and its frozen completed-replicate set.",
      "Refresh the closed-run analysis controls and submit the current runId and frozen set binding.",
    );
  }
  return undefined;
};

const isBalanceId = (value: unknown): value is GreenChemistryBalanceId =>
  value === "balance-a" || value === "balance-b";

const rejection = (
  state: GreenChemistryRouteState,
  code: string,
  message: string,
  recovery: string,
) => ({
  ok: false as const,
  state,
  rejection: { code, message, recovery },
});

const succeed = (
  state: GreenChemistryRouteState,
  actionId: string,
  evidence: RouteTechniqueExecutionEvidence,
) => ({
  ok: true as const,
  state: {
    ...state,
    completedActionIds: state.completedActionIds.includes(actionId)
      ? state.completedActionIds
      : [...state.completedActionIds, actionId],
    evidence: [...state.evidence, evidence],
  },
  evidence,
});

const routeEvidence = (
  actionId: string,
  evidence: string[],
  measurements?: Record<string, number>,
  notebook?: Record<string, string>,
): RouteTechniqueExecutionEvidence => ({
  actionId,
  evidence,
  ...(measurements ? { measurements } : {}),
  ...(notebook ? { notebook } : {}),
});

const currentReplicateRecord = (
  state: GreenChemistryRouteState,
): GreenChemistryReplicateRecord | undefined => {
  if (
    state.emptyMassG === undefined ||
    state.loadedMassG === undefined ||
    !state.finalMassRecorded ||
    state.cycles.length < 2
  ) {
    return undefined;
  }
  return {
    replicate: state.material?.active?.replicate ?? state.completedReplicates.length + 1,
    emptyMassG: state.emptyMassG,
    loadedMassG: state.loadedMassG,
    cycles: state.cycles,
  };
};

export const currentGreenChemistryReplicate = (
  state: GreenChemistryRouteState,
): GreenChemistryReplicateRecord | undefined => currentReplicateRecord(state);

export const validateGreenChemistryRouteManifest = (
  definition: LabDefinition | undefined,
): string[] => [
  ...validateGreenChemistryManifestIdentity(definition),
  ...validateRouteTechniqueExecutionTargets(
    definition?.compositionManifest,
    GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS,
  ),
  ...validateLabNodeProjections(definition),
  ...greenChemistryRulesFromCompiled(definition).errors,
  ...validateGreenChemistryMassProjections(definition),
  ...validateGreenChemistryRecoveryContracts(definition),
  // The holders are part of the approved method: a compile that names other containers for the
  // issue, the load or either recovery stream must not reach a learner at all.
  ...greenChemistryHoldersFromCompiled(definition).errors,
];

export const createGreenChemistryRouteAdapter = (
  definition: LabDefinition | undefined,
): RouteTechniqueExecutionAdapter<GreenChemistryRouteState> => {
  // Captured as a `const` so the compiled-definition guard below narrows it for every handler.
  const compiledDefinition = definition;
  const manifest = definition?.compositionManifest;
  const derived = greenChemistryRulesFromCompiled(definition);
  const derivedHolders = greenChemistryHoldersFromCompiled(definition);
  const targetErrors = validateGreenChemistryRouteManifest(definition);

  return {
    execute(state, intent) {
      if (
        targetErrors.length > 0
        || !derived.rules
        || !derivedHolders.holders
        || !compiledDefinition
      ) {
        return rejection(
          state,
          "manifest-target-mismatch",
          targetErrors.join(" "),
          "Reload the teacher-configured compiled lab definition. Do not continue with an unverified or unconfigured route map.",
        );
      }
      const rules = derived.rules;
      const holders = derivedHolders.holders;
      const labActionId = GREEN_CHEMISTRY_LAB_NODE_ACTION_IDS.find(
        (candidate) => candidate === intent.actionId,
      );
      const isLabNode =
        intent.instanceId === GREEN_CHEMISTRY_LAB_ORCHESTRATION_INSTANCE_ID;
      if (isLabNode !== Boolean(labActionId)) {
        return rejection(
          state,
          "unmapped-control",
          'Action "' + intent.actionId + '" was not dispatched against its compiled scope.',
          "Dispatch lab-owned report nodes as lab orchestration and technique nodes against their compiled instance.",
        );
      }
      const intentErrors = isLabNode
        ? []
        : validateRouteTechniqueExecutionIntent(manifest, intent);
      if (intentErrors.length > 0) {
        return rejection(
          state,
          "manifest-intent-mismatch",
          intentErrors.join(" "),
          "Use a compiler-owned action for the thermal-decomposition instance.",
        );
      }
      const declaredTarget = isLabNode
        ? undefined
        : GREEN_CHEMISTRY_ROUTE_EXECUTION_TARGETS.find(
            (candidate) => candidate.actionId === intent.actionId,
          );
      if (!isLabNode && !declaredTarget) {
        return rejection(
          state,
          "unmapped-control",
          'Action "' + intent.actionId + '" is not in the Cycle 11 route-control map.',
          "Use one of the mapped route controls.",
        );
      }

      const complete = (
        next: GreenChemistryRouteState,
        measurements?: Record<string, number>,
        notebook?: Record<string, string>,
      ) =>
        succeed(
          next,
          intent.actionId,
          routeEvidence(
            intent.actionId,
            [...(declaredTarget?.evidenceOutputIds ?? [])],
            measurements,
            notebook,
          ),
        );
      const requireApproval = () =>
        state.approved
          ? undefined
          : rejection(
              state,
              "teacher-approval-required",
              "Execution is locked until the teacher approves the complete inquiry and safety configuration.",
              "Complete all required fields and record teacher approval.",
            );

      if (intent.actionId === "approve-thermal-decomposition-plan") {
        if (state.runPhase === "closed") {
          return rejection(
            state,
            "run-closed",
            "This run is closed: reset the activity before approving a new plan.",
            "Use the full reset to begin a new open run.",
          );
        }
        const missingPlanFields = GREEN_CHEMISTRY_APPROVAL_PLAN_FIELDS.filter(
          (field) => !stringPayload(intent.payload, field),
        );
        if (missingPlanFields.length > 0) {
          return rejection(
            state,
            "approval-incomplete",
            "The learner plan is incomplete: " + missingPlanFields.join(", ") + ".",
            "Resolve every plan, PPE, constant-mass, recovery, and report-assignment field.",
          );
        }
        // The approval payload has to name the same method the compiled instance carries, so an
        // approval can never unlock a run governed by numbers the compiler never saw.
        const mismatched = (
          Object.keys(rules) as Array<keyof GreenChemistryRouteRules>
        ).filter((key) => intent.payload[key] !== rules[key]);
        if (mismatched.length > 0) {
          return rejection(
            state,
            "approval-configuration-mismatch",
            "The approved configuration does not match the compiled technique instance: " +
              mismatched.join(", ") +
              ".",
            "Recompile the route with the teacher configuration before recording approval.",
          );
        }
        return complete(
          { ...state, approved: true },
          undefined,
          { approval: "teacher-approved-compiled-configuration" },
        );
      }

      const approvalFailure = requireApproval();
      if (approvalFailure) return approvalFailure;

      if (state.runPhase === "closed" && !CLOSED_RUN_ALLOWED_ACTION_IDS.includes(intent.actionId)) {
        return rejection(
          state,
          "run-closed",
          "This run is closed: its remaining stock was returned and its completed replicates are frozen.",
          "Record the analysis and confirmation for the completed replicates, or reset the activity for a new run.",
        );
      }

      /** The compiled presentation for a transfer target, so no label is invented at runtime. */
      const compiledLabel = (actionId: string, key: string): string | undefined => {
        const value = compiledParameter(compiledDefinition, actionId, key);
        return typeof value === "string" && value.trim() ? value : undefined;
      };

      if (intent.actionId === "configure-unheated-stock") {
        if (state.material) {
          return rejection(
            state,
            "stock-already-configured",
            "The available mixture stock has already been configured for this run.",
            "Reset the activity to configure a different stock quantity.",
          );
        }
        const stockMassG = numberPayload(intent.payload, "stockMassG");
        const workingPortionMassG = numberPayload(
          intent.payload,
          "workingPortionMassG",
        );
        if (
          stockMassG === undefined
          || stockMassG <= 0
          || workingPortionMassG === undefined
          || workingPortionMassG <= 0
        ) {
          return rejection(
            state,
            "stock-configuration-required",
            "Enter the total prepared mixture available to the class and the working portion issued per replicate as positive masses.",
            "Weigh out the prepared stock and decide the working portion before execution starts.",
          );
        }
        // Every feasibility test runs before anything is issued, so a run can never start on a
        // stock that cannot supply the replicates the approved plan requires.
        if (workingPortionMassG < rules.sampleMassG) {
          return rejection(
            state,
            "working-portion-too-small",
            "The working portion issued per replicate is smaller than the approved portion each replicate loads.",
            "Issue at least the approved portion, so a replicate can be loaded and its excess returned.",
          );
        }
        if (stockMassG < rules.minimumReplicates * workingPortionMassG) {
          return rejection(
            state,
            "stock-insufficient",
            "The configured stock cannot supply a working portion for every required replicate.",
            "Prepare more mixture, reduce the working portion, or lower the required replicate count before approval.",
          );
        }
        const instances = getInitialEquipment(compiledDefinition);
        const missingHolders = [
          holders.masterStockInstanceId,
          holders.workingPortionInstanceId,
          holders.crucibleInstanceId,
          holders.unusedRecoveryInstanceId,
          holders.productRecoveryInstanceId,
        ].filter((instanceId) => !instances.some((instance) => instance.id === instanceId));
        if (missingHolders.length > 0) {
          return rejection(
            state,
            "missing-material-holder",
            "The compiled bench is missing " + missingHolders.join(", ") + ".",
            "Recompile the lab with the stock bottle, working vial, crucible, and both labelled recovery containers on the bench.",
          );
        }
        const seeded: GreenChemistryMaterialState = {
          holders,
          instances,
          stockInitializations: {},
          configuredStockMassG: stockMassG,
          configuredWorkingPortionMassG: workingPortionMassG,
          plannedPortionMassG: rules.sampleMassG,
          nextReplicateOrdinal: 1,
          issuedWorkingPortions: [],
          completed: [],
          productRecords: [],
          recoveryRecords: [],
        };
        const initialized = initializeConfiguredSolidStock(
          materialSlice(seeded),
          {
            instanceId: holders.masterStockInstanceId,
            massG: stockMassG,
            materialSoluteId: holders.materialSoluteId,
            materialLabel: holders.materialLabel,
            outputMeasurementId: holders.stockMeasurementId,
            visualState: "powder",
          },
          equipmentById,
        );
        if (!initialized.ok) {
          return rejection(
            state,
            "stock-initialization-refused",
            initialized.message ?? "The configured stock could not be issued.",
            initialized.recovery ?? "Place an empty stock container before configuring its contents.",
          );
        }
        return complete(
          {
            ...state,
            material: {
              ...seeded,
              instances: [...initialized.slice.instances],
              stockInitializations: { ...initialized.slice.stockInitializations },
            },
          },
          undefined,
          {
            [holders.stockMeasurementId]:
              stockMassG + " g; teacher setup inventory, not a learner balance reading",
            workingPortionMassG:
              workingPortionMassG + " g issued to each replicate from the configured stock",
          },
        );
      }

      if (intent.actionId === "place-balance") {
        const balanceId = intent.payload.balanceId;
        if (!isBalanceId(balanceId)) {
          return rejection(
            state,
            "balance-required",
            "Select balance A or balance B.",
            "Choose one balance for every reading in the run.",
          );
        }
        if (state.selectedBalance && state.selectedBalance !== balanceId) {
          return rejection(
            state,
            "same-balance-required",
            "A different balance is already locked for this run.",
            "Use the locked balance or restart the entire run.",
          );
        }
        return complete({
          ...state,
          balancePlaced: true,
          selectedBalance: balanceId,
        });
      }

      if (intent.actionId === "place-empty-crucible") {
        if (!state.balancePlaced || !state.selectedBalance) {
          return rejection(
            state,
            "balance-not-ready",
            "Place and lock one balance before positioning the empty crucible.",
            "Select the balance that will be used for the full run.",
          );
        }
        if (state.crucibleState !== "cool-empty") {
          return rejection(
            state,
            "crucible-not-empty",
            "The current crucible is not in the cool-empty state.",
            "Complete or restart the active replicate before taking another empty reading.",
          );
        }
        return complete({ ...state, cruciblePlaced: true });
      }

      if (intent.actionId === "read-empty-crucible") {
        const valueG = numberPayload(intent.payload, "valueG");
        const balanceId = intent.payload.balanceId;
        if (!state.cruciblePlaced || state.crucibleState !== "cool-empty") {
          return rejection(
            state,
            "empty-crucible-not-ready",
            "The clean, cool, empty crucible and lid are not positioned for a reading.",
            "Place the locked balance and empty crucible first.",
          );
        }
        if (!isBalanceId(balanceId) || balanceId !== state.selectedBalance) {
          return rejection(
            state,
            "same-balance-required",
            "The empty reading must come from the locked balance.",
            "Use the same balance selected at the start of the run.",
          );
        }
        if (valueG === undefined || valueG < 0) {
          return rejection(
            state,
            "measurement-required",
            "Enter the observed balance display as a nonnegative mass.",
            "Read the physical or classroom-simulated balance, then enter its displayed value.",
          );
        }
        const measurementId =
          "replicate-" + (state.completedReplicates.length + 1) + "-empty-mass";
        return complete(
          {
            ...state,
            pendingMassReading: {
              kind: "empty",
              balanceId,
              valueG,
              measurementId,
            },
          },
          { [measurementId]: valueG },
        );
      }

      if (intent.actionId === "record-empty-crucible") {
        const pending = state.pendingMassReading;
        if (!pending || pending.kind !== "empty") {
          return rejection(
            state,
            "empty-reading-required",
            "No unrecorded empty-crucible reading is available.",
            "Read the cool empty crucible on the locked balance first.",
          );
        }
        // Both approved tare conventions produce arithmetically correct sample and residue masses,
        // because every later reading is compared against this same baseline. What differs is what
        // the number means: an untared display carries the crucible-and-lid mass, a tared display
        // carries a zeroed baseline. Recording the convention beside the value is what stops the
        // two from being read as the same evidence later in the run or by a reader of the notebook.
        return complete(
          {
            ...state,
            pendingMassReading: undefined,
            emptyMassRecorded: true,
            emptyMassG: pending.valueG,
          },
          undefined,
          {
            [pending.measurementId]:
              pending.valueG
              + " g; student-entered balance display; baseline convention "
              + rules.tareConvention,
          },
        );
      }

      if (intent.actionId === "add-carbonate-sample") {
        const planMassG = numberPayload(intent.payload, "massG");
        if (!state.emptyMassRecorded || state.emptyMassG === undefined) {
          return rejection(
            state,
            "empty-mass-required",
            "Record the empty crucible and lid before adding mixture.",
            "Acquire and separately record the baseline reading.",
          );
        }
        if (planMassG !== rules.sampleMassG) {
          return rejection(
            state,
            "approved-portion-required",
            "The transfer must target the approved portion compiled into this run.",
            "Return to the approved plan; the loaded balance reading will establish the actual mass.",
          );
        }
        const material = state.material;
        if (!material) {
          return rejection(
            state,
            "stock-not-configured",
            "No mixture stock has been configured for this run.",
            "Configure the available unheated mixture stock before loading a crucible.",
          );
        }
        if (material.active) {
          return rejection(
            state,
            "replicate-already-loaded",
            "This replicate has already been issued its working portion.",
            "Complete or finish the active replicate before loading another portion.",
          );
        }
        const ordinal = material.nextReplicateOrdinal;
        if (!Number.isInteger(ordinal) || ordinal <= 0) {
          return rejection(
            state,
            "replicate-ordinal-invalid",
            "The next replicate identity is not valid for this run.",
            "Reset the activity so the route can issue a fresh replicate identity.",
          );
        }
        if (material.issuedWorkingPortions.some((issue) => issue.replicate === ordinal)) {
          return rejection(
            state,
            "replicate-issue-already-recorded",
            "This replicate already has a recorded working-portion issue.",
            "Complete the current replicate or reset the activity before issuing another portion.",
          );
        }
        if (state.crucibleState !== "cool-empty") {
          return rejection(
            state,
            "crucible-not-cool-empty",
            "The crucible is not in the cool, empty state this load requires.",
            "Complete the active replicate and take a fresh empty reading before loading again.",
          );
        }
        if (!holderIsEmpty(material, holders.workingPortionInstanceId)) {
          return rejection(
            state,
            "working-portion-not-empty",
            "The working vial still holds mixture from an earlier issue.",
            "Return the unheated excess to the Unused Sample container before issuing another portion.",
          );
        }
        if (!holderIsEmpty(material, holders.crucibleInstanceId)) {
          return rejection(
            state,
            "crucible-not-empty",
            "The crucible still holds material from an earlier replicate.",
            "Recover the previous replicate's product before loading a new portion.",
          );
        }
        const availableStockG = holderPhysicalMassG(material, holders.masterStockInstanceId);
        if (
          availableStockG === undefined
          || roundSolidG(availableStockG) < roundSolidG(material.configuredWorkingPortionMassG)
        ) {
          return rejection(
            state,
            "stock-exhausted",
            "The master stock no longer holds a full working portion for another replicate.",
            "Close the run and return the remaining stock, or reset the activity with more prepared mixture.",
          );
        }
        // One transaction: the working issue and the approved load commit together or not at all.
        // `issued.instances` is a value the helper returned, not state - abandoning it here leaves
        // the run exactly as it was, with no half-issued portion and no ledger entry.
        const issued = transferSolid(
          materialSlice(material),
          {
            mode: "measured-portion",
            sourceInstanceId: holders.masterStockInstanceId,
            targetInstanceId: holders.workingPortionInstanceId,
            massG: material.configuredWorkingPortionMassG,
            constraints: {
              materialId: holders.materialSoluteId,
              materialLabel: holders.materialLabel,
              destinationStream: "unheated",
              runId: state.runId,
              sourceActionId: "add-carbonate-sample",
            },
            visualState: compiledLabel("add-carbonate-sample", "visualState"),
          },
          equipmentById,
        );
        if (!issued.ok) {
          return rejection(
            state,
            "working-portion-issue-refused",
            issued.message ?? "The working portion could not be issued from the master stock.",
            issued.recovery ?? "Check the stock container before issuing another portion.",
          );
        }
        const loaded = transferSolid(
          { instances: issued.instances, stockInitializations: material.stockInitializations },
          {
            mode: "measured-portion",
            sourceInstanceId: holders.workingPortionInstanceId,
            targetInstanceId: holders.crucibleInstanceId,
            massG: rules.sampleMassG,
            constraints: {
              materialId: holders.materialSoluteId,
              materialLabel: holders.materialLabel,
              destinationStream: "unheated",
              runId: state.runId,
              sourceActionId: "add-carbonate-sample",
            },
            targetLabel: compiledLabel("add-carbonate-sample", "targetLabel"),
            visualState: compiledLabel("add-carbonate-sample", "visualState"),
          },
          equipmentById,
        );
        if (!loaded.ok) {
          return rejection(
            state,
            "portion-load-refused",
            loaded.message ?? "The approved portion could not be loaded into the crucible.",
            loaded.recovery ?? "Check the crucible and the issued working portion before loading.",
          );
        }
        const issueRecord: GreenChemistryWorkingPortionIssueRecord = {
          issueId: greenChemistryIssueRecordId(state.runId, ordinal),
          runId: state.runId,
          replicate: ordinal,
          operationId: "add-carbonate-sample",
          sourceInstanceId: holders.masterStockInstanceId,
          destinationInstanceId: holders.workingPortionInstanceId,
          sourceMaterialId: holders.materialSoluteId,
          sourceMaterialLabel: holders.materialLabel,
          massG: material.configuredWorkingPortionMassG,
        };
        return complete({
          ...state,
            crucibleState: "loaded-cool",
            pendingMassReading: undefined,
            material: {
              ...material,
              instances: loaded.instances,
              issuedWorkingPortions: [...material.issuedWorkingPortions, issueRecord],
              nextReplicateOrdinal: ordinal + 1,
              active: {
                replicate: ordinal,
                issueRecordId: issueRecord.issueId,
                issuedWorkingMassG: material.configuredWorkingPortionMassG,
              loadedPortionMassG: rules.sampleMassG,
            },
          },
        });
      }

      if (intent.actionId === "weigh-initial-crucible") {
        const valueG = numberPayload(intent.payload, "valueG");
        const balanceId = intent.payload.balanceId;
        if (state.crucibleState !== "loaded-cool") {
          return rejection(
            state,
            "sample-not-loaded",
            "The approved mixture portion is not in the cool crucible.",
            "Transfer the approved portion after recording the empty mass.",
          );
        }
        if (!isBalanceId(balanceId) || balanceId !== state.selectedBalance) {
          return rejection(
            state,
            "same-balance-required",
            "The loaded reading must come from the locked balance.",
            "Use the same balance selected for the empty reading.",
          );
        }
        if (
          valueG === undefined ||
          state.emptyMassG === undefined ||
          valueG <= state.emptyMassG
        ) {
          return rejection(
            state,
            "loaded-measurement-invalid",
            "The loaded display must be greater than the recorded empty baseline.",
            "Check the balance display, crucible contents, tare convention, and entered units.",
          );
        }
        const measurementId =
          "replicate-" + (state.completedReplicates.length + 1) + "-loaded-mass";
        return complete(
          {
            ...state,
            pendingMassReading: {
              kind: "loaded",
              balanceId,
              valueG,
              measurementId,
            },
          },
          { [measurementId]: valueG },
        );
      }

      if (intent.actionId === "record-initial-crucible-mass") {
        const pending = state.pendingMassReading;
        if (!pending || pending.kind !== "loaded") {
          return rejection(
            state,
            "loaded-reading-required",
            "No unrecorded loaded-crucible reading is available.",
            "Read the cool loaded crucible on the locked balance first.",
          );
        }
        return complete(
          {
            ...state,
            pendingMassReading: undefined,
            loadedMassRecorded: true,
            loadedMassG: pending.valueG,
          },
          undefined,
          {
            [pending.measurementId]:
              pending.valueG + " g; student-entered balance display",
          },
        );
      }

      if (intent.actionId === "recover-unused-sample") {
        const requestedTargetInstanceId = stringPayload(intent.payload, "targetInstanceId");
        if (requestedTargetInstanceId !== holders.unusedRecoveryInstanceId) {
          return rejection(
            state,
            "wrong-recovery-target",
            "Unheated mixture must be returned to the compiled Unused Sample receiver.",
            "Choose the concrete Unused Sample recovery container named by the compiled action.",
          );
        }
        const requestedSourceInstanceId = stringPayload(intent.payload, "sourceInstanceId");
        if (
          requestedSourceInstanceId !== undefined
          && requestedSourceInstanceId !== holders.workingPortionInstanceId
        ) {
          return rejection(
            state,
            "wrong-recovery-source",
            "The unheated remainder must come from the current working portion vial.",
            `Use the "${holders.workingPortionInstanceId}" instance named by the compiled action.`,
          );
        }
        if (!state.loadedMassRecorded) {
          return rejection(
            state,
            "loaded-mass-required",
            "Record the loaded mass before recovering excess starting mixture.",
            "Acquire and record the loaded-crucible reading.",
          );
        }
        const material = state.material;
        if (!material?.active) {
          return rejection(
            state,
            "replicate-not-loaded",
            "No issued working portion is open for this replicate.",
            "Load the approved portion before returning its unheated excess.",
          );
        }
        if (material.active.excessReturnedG !== undefined) {
          return rejection(
            state,
            "excess-already-recovered",
            "This replicate's unheated excess has already been returned.",
            "Continue with the lid and heating steps.",
          );
        }
        const receiverConflict = unheatedReceiverConflict(
          material,
          holders.unusedRecoveryInstanceId,
        );
        if (receiverConflict) {
          return rejection(
            state,
            "unused-receiver-incompatible",
            receiverConflict,
            "Use the compiled Unused Sample receiver with compatible unheated solid contents.",
          );
        }
        const returned = transferSolid(
          materialSlice(material),
          {
            mode: "whole-remaining",
            sourceInstanceId: holders.workingPortionInstanceId,
            targetInstanceId: holders.unusedRecoveryInstanceId,
            // A vial that issued exactly the approved portion has nothing left. That is a truthful
            // zero return, not a failed step, so the whole-remaining contract permits an empty
            // source here and the Unused Sample container stays genuinely empty.
            requireNonEmptySource: false,
            destinationRepresentation: "physical",
            constraints: {
              materialId: holders.materialSoluteId,
              materialLabel: holders.materialLabel,
              destinationStream: "unheated",
              runId: state.runId,
              replicate: material.active.replicate,
              sourceActionId: "recover-unused-sample",
            },
            targetLabel: compiledLabel("recover-unused-sample", "targetLabel"),
          },
          equipmentById,
        );
        if (!returned.ok) {
          return rejection(
            state,
            "unused-recovery-refused",
            returned.message ?? "The unheated excess could not be returned.",
            returned.recovery ?? "Check the working vial and the Unused Sample container.",
          );
        }
        const returnedG = roundSolidG(returned.movedSourceInventoryMassG);
        const ordinal = material.active.replicate;
        const replicateEntries = state.evidence.slice(state.replicateEvidenceStartIndex);
        const evidenceOutputsFor = (actionIds: readonly string[]): string[] =>
          uniqueSortedEvidenceIds(
            replicateEntries
              .filter((entry) => actionIds.includes(entry.actionId))
              .flatMap((entry) => entry.evidence),
          );
        const measurementEvidenceIds = [
          ...new Set(
            replicateEntries.flatMap((entry) => Object.keys(entry.measurements ?? {})),
          ),
        ]
          .filter((id) => id.startsWith("replicate-" + ordinal + "-"))
          .sort();
        const recoveryRecord: GreenChemistryUnheatedRecoveryRecord = {
          recordId: greenChemistryReplicateRecordId(
            state.runId,
            ordinal,
            "recover-unused-sample",
          ),
          runId: state.runId,
          replicate: ordinal,
          operationId: "recover-unused-sample",
          stream: "unheated",
          sourceInstanceId: holders.workingPortionInstanceId,
          destinationInstanceId: holders.unusedRecoveryInstanceId,
          sourceMaterialId: holders.materialSoluteId,
          sourceMaterialLabel: holders.materialLabel,
          sourceActionId: intent.actionId,
          quantityBasis: "working-remainder",
          sourceInventoryMassG: returnedG,
          destinationPhysicalMassKnown: true,
          measurementEvidenceIds,
          routeEvidenceIds: evidenceOutputsFor(["record-initial-crucible-mass"]),
          recoveryEvidenceIds: uniqueSortedEvidenceIds(
            declaredTarget?.evidenceOutputIds ?? [],
          ),
        };
        return complete(
          {
            ...state,
            unusedSampleRecovered: true,
            material: {
              ...material,
              instances: returned.instances,
              recoveryRecords: [...material.recoveryRecords, recoveryRecord],
              active: { ...material.active, excessReturnedG: returnedG },
            },
          },
          undefined,
          {
            unusedSampleReturned:
              returnedG + " g unheated mixture returned to Unused Sample",
          },
        );
      }

      const apparatus = APPARATUS_ACTIONS.find(
        ([actionId]) => actionId === intent.actionId,
      );
      if (apparatus) {
        const expected = APPARATUS_ACTIONS[state.assemblySteps.length];
        if (!expected || expected[0] !== intent.actionId) {
          return rejection(
            state,
            "apparatus-order",
            "The next apparatus operation is " +
              (expected?.[1] ?? "already complete") +
              ".",
            "Build the stable support in the displayed order.",
          );
        }
        return complete({
          ...state,
          assemblySteps: [...state.assemblySteps, apparatus[1]],
        });
      }

      if (intent.actionId === "set-crucible-lid") {
        const position = intent.payload.position;
        if (!["off", "closed", "askew"].includes(String(position))) {
          return rejection(
            state,
            "lid-position-required",
            "Choose off, closed, or askew.",
            "Inspect and explicitly record the lid position.",
          );
        }
        if (!state.assemblySteps.includes("Crucible")) {
          return rejection(
            state,
            "crucible-support-required",
            "Place the crucible on the support before setting its lid.",
            "Complete the apparatus sequence through Crucible.",
          );
        }
        if (state.crucibleState === "heating" || state.crucibleState === "hot") {
          return rejection(
            state,
            "hot-lid-block",
            "Do not manipulate the lid while the crucible is heating or hot.",
            "Turn off the burner, move with tongs, and cool before changing the lid.",
          );
        }
        return complete({
          ...state,
          lidPosition: position as GreenChemistryLidPosition,
        });
      }

      if (intent.actionId === "warm-gently") {
        // The excess has to be out of the vial before anything is heated: after ignition the
        // unheated container could only receive heated material. This checks the actual material
        // resolution for the open replicate, not just that some recovery step once ran.
        if (
          !state.loadedMassRecorded ||
          !state.unusedSampleRecovered ||
          state.material?.active?.excessReturnedG === undefined ||
          !state.material?.recoveryRecords.some(
            (record) =>
              record.stream === "unheated"
              && record.operationId === "recover-unused-sample"
              && record.replicate === state.material?.active?.replicate,
          ) ||
          state.assemblySteps.length !== APPARATUS_ACTIONS.length
        ) {
          return rejection(
            state,
            "heating-prerequisites",
            "Loaded-mass evidence, this replicate's unheated-excess return, and the full apparatus are required.",
            "Complete the mass, recovery, and apparatus controls before heating.",
          );
        }
        if (state.lidPosition !== "askew") {
          return rejection(
            state,
            "lid-vent-required",
            "Heating is blocked unless the lid is askew with a visible vent gap.",
            "Set and inspect the lid in the askew position.",
          );
        }
        if (state.cycles.length > 0) {
          return rejection(
            state,
            "gentle-warm-already-complete",
            "The separate gentle-warm stage belongs to the first cycle.",
            "Use the repeat-heat action for a subsequent cycle.",
          );
        }
        return complete({ ...state, gentleWarmComplete: true });
      }

      if (
        intent.actionId === "heat-carbonate-mixture" ||
        intent.actionId === "repeat-heat-to-constant-mass"
      ) {
        const firstCycle = state.cycles.length === 0;
        if (
          (firstCycle && intent.actionId !== "heat-carbonate-mixture") ||
          (!firstCycle && intent.actionId !== "repeat-heat-to-constant-mass")
        ) {
          return rejection(
            state,
            "heat-stage-mismatch",
            firstCycle
              ? "The first cycle must use the initial heat action."
              : "Subsequent cycles must use the repeat-heat action.",
            "Use the action matched to the current cycle.",
          );
        }
        if (firstCycle && !state.gentleWarmComplete) {
          return rejection(
            state,
            "gentle-warm-required",
            "Complete the approved gentle-warm stage before the first full heat.",
            "Warm gently with the lid askew.",
          );
        }
        if (
          !firstCycle &&
          (state.crucibleState !== "cooled-recorded" ||
            state.cycles[state.cycles.length - 1]?.constant)
        ) {
          return rejection(
            state,
            "repeat-not-required",
            "A repeat heat requires a recorded nonconstant cooled mass.",
            "Record the current cooled mass or proceed after constant mass.",
          );
        }
        if (state.lidPosition !== "askew") {
          return rejection(
            state,
            "lid-vent-required",
            "Heating is blocked unless the lid is askew.",
            "Leave a visible vent gap before ignition.",
          );
        }
        if (state.cycles.length >= rules.maximumHeatCycles) {
          return rejection(
            state,
            "cycle-cap",
            "The teacher-configured heat-cycle cap has been reached without constant mass.",
            "Stop the run and request teacher review; do not claim constant mass.",
          );
        }
        return complete({
          ...state,
          crucibleState: "heating",
          gentleWarmComplete: false,
          finalMassRecorded: false,
        });
      }

      if (intent.actionId === "turn-off-burner") {
        if (state.crucibleState !== "heating") {
          return rejection(
            state,
            "burner-not-active",
            "There is no active heating stage to extinguish.",
            "Start the appropriate heat stage first.",
          );
        }
        return complete({ ...state, crucibleState: "hot" });
      }

      if (
        intent.actionId === "cool-crucible" ||
        intent.actionId === "cool-constant-mass-crucible"
      ) {
        const expected =
          state.cycles.length === 0
            ? "cool-crucible"
            : "cool-constant-mass-crucible";
        if (intent.actionId !== expected) {
          return rejection(
            state,
            "cool-stage-mismatch",
            "The cooling action does not match the current cycle.",
            "Use first-cycle cooling once, then repeat-cycle cooling.",
          );
        }
        if (state.crucibleState !== "hot") {
          return rejection(
            state,
            "burner-off-required",
            "Cooling requires a hot crucible with the burner already off.",
            "Extinguish the burner before moving the crucible with tongs.",
          );
        }
        return complete({ ...state, crucibleState: "cooled-residue" });
      }

      if (
        intent.actionId === "weigh-preliminary-final-mass" ||
        intent.actionId === "weigh-final-crucible"
      ) {
        const firstCycle = state.cycles.length === 0;
        const expected = firstCycle
          ? "weigh-preliminary-final-mass"
          : "weigh-final-crucible";
        if (intent.actionId !== expected) {
          return rejection(
            state,
            "weigh-stage-mismatch",
            "The mass-reading action does not match the current cycle.",
            "Use the first-cycle reading once, then subsequent-cycle readings.",
          );
        }
        const balanceId = intent.payload.balanceId;
        const valueG = numberPayload(intent.payload, "valueG");
        if (state.crucibleState !== "cooled-residue") {
          return rejection(
            state,
            "cooling-required",
            "The crucible must be moved with tongs and cooled before weighing.",
            "Turn off the burner and complete the configured cooling step.",
          );
        }
        if (!isBalanceId(balanceId) || balanceId !== state.selectedBalance) {
          return rejection(
            state,
            "same-balance-required",
            "The cooled reading must come from the locked balance.",
            "Use the same balance as the empty and loaded readings.",
          );
        }
        if (
          valueG === undefined ||
          state.emptyMassG === undefined ||
          state.loadedMassG === undefined ||
          valueG <= state.emptyMassG ||
          valueG > state.loadedMassG
        ) {
          return rejection(
            state,
            "cooled-measurement-invalid",
            "The cooled display must be above the empty baseline and no greater than the loaded mass.",
            "Check cooling, sample retention, the displayed value, units, and tare convention.",
          );
        }
        const measurementId =
          "replicate-" +
          (state.completedReplicates.length + 1) +
          "-cycle-" +
          (state.cycles.length + 1) +
          "-mass";
        return complete(
          {
            ...state,
            pendingMassReading: {
              kind: "cycle",
              balanceId,
              valueG,
              measurementId,
            },
          },
          { [measurementId]: valueG },
        );
      }

      if (intent.actionId === "record-cycle-mass") {
        const pending = state.pendingMassReading;
        if (!pending || pending.kind !== "cycle") {
          return rejection(
            state,
            "cycle-reading-required",
            "No unrecorded cooled-cycle reading is available.",
            "Read the cooled crucible on the locked balance first.",
          );
        }
        const previous = state.cycles[state.cycles.length - 1];
        const differenceG = previous
          ? Math.abs(previous.crucibleAndLidMassG - pending.valueG)
          : undefined;
        const constant =
          differenceG !== undefined &&
          isConstantMass(
            previous.crucibleAndLidMassG,
            pending.valueG,
            rules.constantMassToleranceG,
          );
        const cycle: GreenChemistryCycleRecord = {
          cycle: state.cycles.length + 1,
          balanceId: pending.balanceId,
          durationMin: rules.heatingDurationMin,
          crucibleAndLidMassG: pending.valueG,
          ...(differenceG === undefined ? {} : { differenceG }),
          constant,
        };
        return complete(
          {
            ...state,
            pendingMassReading: undefined,
            cycles: [...state.cycles, cycle],
            crucibleState: "cooled-recorded",
          },
          undefined,
          {
            [pending.measurementId]:
              pending.valueG +
              " g; student-entered balance display; " +
              (constant
                ? "constant-mass criterion met"
                : "repeat required"),
          },
        );
      }

      if (intent.actionId === "record-final-crucible-mass") {
        const last = state.cycles[state.cycles.length - 1];
        if (!last?.constant || state.crucibleState !== "cooled-recorded") {
          return rejection(
            state,
            "constant-mass-required",
            "A final mass can be recorded only after two consecutive cooled readings meet the approved tolerance.",
            "Repeat the full heat, extinguish, cool, read, and record loop.",
          );
        }
        return complete(
          { ...state, finalMassRecorded: true },
          undefined,
          {
            finalMass:
              last.crucibleAndLidMassG + " g; constant-mass evidence",
          },
        );
      }

      if (intent.actionId === "recover-replicate-product") {
        const requestedTargetInstanceId = stringPayload(intent.payload, "targetInstanceId");
        if (requestedTargetInstanceId !== holders.productRecoveryInstanceId) {
          return rejection(
            state,
            "wrong-recovery-target",
            "Heated product must be collected in the compiled Product Made from Heating Samples receiver.",
            "Choose the concrete heated-product recovery container named by the compiled action.",
          );
        }
        const requestedSourceInstanceId = stringPayload(intent.payload, "sourceInstanceId");
        if (
          requestedSourceInstanceId !== undefined
          && requestedSourceInstanceId !== holders.crucibleInstanceId
        ) {
          return rejection(
            state,
            "wrong-recovery-source",
            "The heated product must come from the current crucible.",
            `Use the "${holders.crucibleInstanceId}" instance named by the compiled action.`,
          );
        }
        if (!currentReplicateRecord(state)) {
          return rejection(
            state,
            "replicate-not-complete",
            "The replicate product is not cool with a recorded constant final mass.",
            "Complete the constant-mass sequence before emptying the crucible.",
          );
        }
        const material = state.material;
        if (!material?.active) {
          return rejection(
            state,
            "replicate-not-loaded",
            "No open replicate holds a product to recover.",
            "Load and heat an approved portion before recovering its product.",
          );
        }
        if (material.active.excessReturnedG === undefined) {
          return rejection(
            state,
            "excess-unresolved",
            "This replicate never returned its unheated excess.",
            "Return the unheated excess before the heated product is collected.",
          );
        }
        if (material.active.productRecordId !== undefined) {
          return rejection(
            state,
            "product-already-recovered",
            "This replicate's product has already been collected.",
            "Complete the replicate, or start another one.",
          );
        }
        const sourceInventoryMassG = holderPhysicalMassG(
          material,
          holders.crucibleInstanceId,
        );
        if (sourceInventoryMassG === undefined || sourceInventoryMassG <= 0) {
          return rejection(
            state,
            "product-source-empty",
            "The crucible holds no material to recover.",
            "Check that the loaded portion is still in the crucible this replicate heated.",
          );
        }
        const ordinal = material.active.replicate;
        // The recovery and notebook evidence this record cites is taken from the entries recorded
        // since the previous replicate closed, never from whatever an earlier replicate filed
        // under the same action id.
        const replicateEntries = state.evidence.slice(state.replicateEvidenceStartIndex);
        const evidenceOutputsFor = (actionIds: readonly string[]): string[] =>
          uniqueSortedEvidenceIds(
            replicateEntries
              .filter((entry) => actionIds.includes(entry.actionId))
              .flatMap((entry) => entry.evidence),
          );
        const productRecord: GreenChemistryProductRecoveryRecord = {
          recordId: greenChemistryReplicateRecordId(
            state.runId,
            ordinal,
            "recover-replicate-product",
          ),
          runId: state.runId,
          replicate: ordinal,
          operationId: "recover-replicate-product",
          stream: "heated-product",
          sourceMaterialId: holders.materialSoluteId,
          sourceMaterialLabel: holders.materialLabel,
          sourceInstanceId: holders.crucibleInstanceId,
          destinationInstanceId: holders.productRecoveryInstanceId,
          sourceActionId: intent.actionId,
          quantityBasis: "source-inventory-equivalent",
          sourceInventoryMassG,
          sourceInventoryEquivalentMassG: sourceInventoryMassG,
          destinationPhysicalMassKnown: false,
          // Balance readings this replicate actually took, selected by their own replicate-scoped
          // identity rather than by position, so the teacher's stock-setup value - which is not a
          // balance reading at all - can never be cited here. None of them is the product's mass.
          measurementEvidenceIds: [
            ...new Set(
              state.evidence.flatMap((entry) => Object.keys(entry.measurements ?? {})),
            ),
          ]
            .filter((id) => id.startsWith("replicate-" + ordinal + "-"))
            .sort(),
          recoveryEvidenceIds: uniqueSortedEvidenceIds([
            ...evidenceOutputsFor(["recover-unused-sample"]),
            ...(declaredTarget?.evidenceOutputIds ?? []),
          ]),
          routeEvidenceIds: evidenceOutputsFor([
            "record-initial-crucible-mass",
            "record-final-crucible-mass",
          ]),
        };
        const recovered = transferSolid(
          materialSlice(material),
          {
            mode: "whole-remaining",
            sourceInstanceId: holders.crucibleInstanceId,
            targetInstanceId: holders.productRecoveryInstanceId,
            // EX-19 follows an accepted constant-mass residue, so an empty crucible here means the
            // residue was already lost or moved. That is a real error, never a permitted no-op.
            requireNonEmptySource: true,
            destinationRepresentation: "qualitative-unknown",
            provenance: productRecord,
            constraints: {
              materialId: holders.materialSoluteId,
              materialLabel: holders.materialLabel,
              destinationStream: "heated-product",
              runId: state.runId,
              replicate: ordinal,
              sourceActionId: "recover-replicate-product",
            },
            targetLabel: compiledLabel("recover-replicate-product", "targetLabel"),
          },
          equipmentById,
        );
        if (!recovered.ok) {
          return rejection(
            state,
            "product-recovery-refused",
            recovered.message ?? "The heated product could not be collected.",
            recovered.recovery ?? "Check the crucible and the labelled product container.",
          );
        }
        return complete({
          ...state,
          replicateProductRecovered: true,
          material: {
            ...material,
            instances: recovered.instances,
            productRecords: [...material.productRecords, productRecord],
            recoveryRecords: [...material.recoveryRecords, productRecord],
            active: { ...material.active, productRecordId: productRecord.recordId },
          },
        });
      }

      if (intent.actionId === "complete-replicate") {
        if (state.pendingMassReading) {
          return rejection(
            state,
            "pending-mass-reading",
            "The current balance display must be recorded before completing the replicate.",
            "Record or recover the pending measurement, then complete the replicate.",
          );
        }
        const record = currentReplicateRecord(state);
        const material = state.material;
        const active = material?.active;
        const currentUnheatedRecord = material?.recoveryRecords.find(
          (candidate) =>
            candidate.stream === "unheated"
            && candidate.operationId === "recover-unused-sample"
            && candidate.replicate === active?.replicate,
        );
        const currentProductRecord = material?.productRecords.find(
          (candidate) => candidate.replicate === active?.replicate,
        );
        if (
          !record
          || !state.replicateProductRecovered
          || !currentUnheatedRecord
          || !currentProductRecord
          || currentProductRecord.recordId !== active?.productRecordId
        ) {
          return rejection(
            state,
            "replicate-recovery-required",
            "Recover the cooled replicate product before completing its evidence packet.",
            "Use the heated-product container, then complete the replicate.",
          );
        }
        if (
          !material
          || !active
          || active.excessReturnedG === undefined
          || active.productRecordId === undefined
        ) {
          return rejection(
            state,
            "replicate-material-unresolved",
            "This replicate's issued material is not fully accounted for.",
            "Return the unheated excess and collect the heated product before completing the replicate.",
          );
        }
        if (
          !holderIsGenuinelyEmpty(material, holders.workingPortionInstanceId)
          || !holderIsGenuinelyEmpty(material, holders.crucibleInstanceId)
        ) {
          return rejection(
            state,
            "replicate-holders-not-empty",
            "The working vial or crucible still holds material from this replicate.",
            "Empty both into their labelled recovery containers before completing the replicate.",
          );
        }
        // The emptied crucible leaves the support with its product, so the support step is
        // reopened: another replicate has to place the crucible on the clay triangle again.
        // The material slice keeps everything cumulative: stock, both receivers, every product
        // record and every completed replicate survive, and only this replicate's open handle is
        // closed out.
        return complete({
          ...state,
          material: {
            ...material,
            completed: [
              ...material.completed,
              {
                replicate: active.replicate,
                issueRecordId: active.issueRecordId,
                issuedWorkingMassG: active.issuedWorkingMassG,
                loadedPortionMassG: active.loadedPortionMassG,
                excessReturnedG: active.excessReturnedG,
                productRecordId: active.productRecordId,
              },
            ],
            nextReplicateOrdinal: active.replicate + 1,
            active: undefined,
          },
          // This completion's own evidence entry is appended by `succeed`, so the next replicate's
          // evidence starts immediately after it.
          replicateEvidenceStartIndex: state.evidence.length + 1,
          completedReplicates: [...state.completedReplicates, record],
          cruciblePlaced: false,
          pendingMassReading: undefined,
          emptyMassRecorded: false,
          emptyMassG: undefined,
          loadedMassRecorded: false,
          loadedMassG: undefined,
          unusedSampleRecovered: false,
          assemblySteps: state.assemblySteps.filter(
            (step) => step !== CRUCIBLE_SUPPORT_STEP,
          ),
          lidPosition: "off",
          crucibleState: "cool-empty",
          gentleWarmComplete: false,
          cycles: [],
          finalMassRecorded: false,
          replicateProductRecovered: false,
        });
      }

      if (intent.actionId === "finalize-unused-master-stock") {
        const requestedSourceInstanceId = stringPayload(intent.payload, "sourceInstanceId");
        const requestedTargetInstanceId = stringPayload(intent.payload, "targetInstanceId");
        if (
          requestedSourceInstanceId !== holders.masterStockInstanceId
          || requestedTargetInstanceId !== holders.unusedRecoveryInstanceId
        ) {
          return rejection(
            state,
            "wrong-closure-target",
            "Master-stock closure must return the compiled stock bottle to the compiled Unused Sample receiver.",
            "Use the source and target instances named by finalize-unused-master-stock.",
          );
        }
        const material = state.material;
        if (!material) {
          return rejection(
            state,
            "stock-not-configured",
            "No mixture stock was configured for this run.",
            "Configure the available stock before closing the run.",
          );
        }
        if (state.runPhase !== "open") {
          return rejection(
            state,
            "run-closed",
            "This run has already returned its remaining master stock and is closed.",
            "Record the analysis and confirmation for the frozen run, or reset for a new run.",
          );
        }
        if (material.completed.length < rules.minimumReplicates) {
          return rejection(
            state,
            "minimum-replicates-required",
            "The run has not completed the "
              + rules.minimumReplicates
              + " replicates the approved plan requires.",
            "Complete the required replicates before returning the remaining stock.",
          );
        }
        if (material.active) {
          return rejection(
            state,
            "replicate-still-open",
            "A replicate is still open, so its issued material is unaccounted for.",
            "Finish or complete the open replicate before closing the run.",
          );
        }
        if (state.pendingMassReading) {
          return rejection(
            state,
            "pending-mass-reading",
            "A pending balance display must be recorded before closing the run.",
            "Record the current mass or complete the active replicate before closing.",
          );
        }
        if (
          state.crucibleState !== "cool-empty"
          || state.cruciblePlaced
          || state.emptyMassRecorded
          || state.loadedMassRecorded
          || state.finalMassRecorded
          || state.emptyMassG !== undefined
          || state.loadedMassG !== undefined
          || state.unusedSampleRecovered
          || state.replicateProductRecovered
          || state.cycles.length > 0
          || !sameStringArray(state.assemblySteps, REUSABLE_APPARATUS_STEPS)
          || state.lidPosition !== "off"
          || state.gentleWarmComplete
        ) {
          return rejection(
            state,
            "current-replicate-not-settled",
            "The current replicate lifecycle is not fully cleared.",
            "Complete the current replicate and recover both material streams before closing the run.",
          );
        }
        if (
          !holderIsGenuinelyEmpty(material, holders.workingPortionInstanceId)
          || !holderIsGenuinelyEmpty(material, holders.crucibleInstanceId)
        ) {
          return rejection(
            state,
            "orphan-material",
            "The working vial or crucible still holds mixture that belongs to no completed replicate.",
            "Return that material through its labelled recovery container before closing the run.",
          );
        }
        if (material.completed.length !== state.completedReplicates.length) {
          return rejection(
            state,
            "completed-set-mismatch",
            "The material and measurement records do not contain the same completed replicates.",
            "Complete each replicate through its recovery and completion actions before closing.",
          );
        }
        const completedOrdinals = material.completed.map((entry) => entry.replicate);
        if (
          completedOrdinals.some((replicate) => !Number.isInteger(replicate) || replicate <= 0)
          || new Set(completedOrdinals).size !== completedOrdinals.length
        ) {
          return rejection(
            state,
            "completed-set-invalid",
            "The run contains a duplicate or invalid completed-replicate identity.",
            "Reset the run if its replicate identity has been altered.",
          );
        }
        if (
          material.issuedWorkingPortions.length !== material.completed.length
          || material.issuedWorkingPortions.some((issue) => !completedOrdinals.includes(issue.replicate))
        ) {
          return rejection(
            state,
            "orphan-issue-history",
            "The working-portion issue history does not match the completed replicate set.",
            "Complete every issued replicate through its recovery packet before closing the run.",
          );
        }
        const materialPacketErrors = completedMaterialPacketErrors(
          state,
          material,
          holders,
        );
        if (materialPacketErrors.length > 0) {
          return rejection(
            state,
            "recovery-history-incomplete",
            materialPacketErrors.join(" "),
            "Complete each actual replicate through its exact issue, unheated return, heated-product recovery and completion records before closing.",
          );
        }
        for (const replicate of completedOrdinals) {
          const workingRecords = material.recoveryRecords.filter(
            (record) =>
              record.stream === "unheated"
              && record.operationId === "recover-unused-sample"
              && record.replicate === replicate,
          );
          const productRecords = material.productRecords.filter(
            (record) => record.replicate === replicate,
          );
          if (workingRecords.length !== 1 || productRecords.length !== 1) {
            return rejection(
              state,
              "recovery-history-incomplete",
              `Replicate ${replicate} does not have exactly one unheated and one heated recovery record.`,
              "Recover both streams and complete the replicate before closing the run.",
            );
          }
        }
        if (
          material.recoveryRecords.some(
            (record) => record.operationId === "finalize-unused-master-stock",
          )
        ) {
          return rejection(
            state,
            "closure-record-already-exists",
            "This run already contains a master-stock closure record.",
            "Use the existing closed-run analysis, or reset for a new run.",
          );
        }
        const receiverConflict = unheatedReceiverConflict(
          material,
          holders.unusedRecoveryInstanceId,
        );
        if (receiverConflict) {
          return rejection(
            state,
            "unused-receiver-incompatible",
            receiverConflict,
            "Use the compiled Unused Sample receiver with compatible unheated solid contents.",
          );
        }
        // The remainder is whatever the bottle actually still holds, resolved from the container.
        // Deriving it as the configured total minus the minimum allocation would silently invent a
        // quantity whenever the class ran extra replicates.
        const returnedMaster = transferSolid(
          materialSlice(material),
          {
            mode: "whole-remaining",
            sourceInstanceId: holders.masterStockInstanceId,
            targetInstanceId: holders.unusedRecoveryInstanceId,
            // A stock issued down to nothing closes as a truthful zero.
            requireNonEmptySource: false,
            destinationRepresentation: "physical",
            constraints: {
              materialId: holders.materialSoluteId,
              materialLabel: holders.materialLabel,
              destinationStream: "unheated",
              runId: state.runId,
              sourceActionId: "finalize-unused-master-stock",
            },
            targetLabel: compiledLabel("finalize-unused-master-stock", "targetLabel"),
          },
          equipmentById,
        );
        if (!returnedMaster.ok) {
          return rejection(
            state,
            "master-closure-refused",
            returnedMaster.message ?? "The remaining master stock could not be returned.",
            returnedMaster.recovery ?? "Check the stock bottle and the Unused Sample container.",
          );
        }
        const remainderG = roundSolidG(returnedMaster.movedSourceInventoryMassG);
        const closureRecordId = greenChemistryMasterClosureRecordId(state.runId);
        const closureEvidenceIds = uniqueSortedEvidenceIds(
          declaredTarget?.evidenceOutputIds ?? [],
        );
        const closureRecord: GreenChemistryUnheatedRecoveryRecord = {
          recordId: closureRecordId,
          runId: state.runId,
          operationId: "finalize-unused-master-stock",
          stream: "unheated",
          sourceInstanceId: holders.masterStockInstanceId,
          destinationInstanceId: holders.unusedRecoveryInstanceId,
          sourceMaterialId: holders.materialSoluteId,
          sourceMaterialLabel: holders.materialLabel,
          sourceActionId: intent.actionId,
          quantityBasis: "master-stock-remainder",
          sourceInventoryMassG: remainderG,
          destinationPhysicalMassKnown: true,
          measurementEvidenceIds: [],
          routeEvidenceIds: closureEvidenceIds,
          recoveryEvidenceIds: [...closureEvidenceIds],
        };
        const frozenReplicates = [...completedOrdinals].sort((left, right) => left - right);
        // Material move, closure record, frozen replicate set and the closed phase commit together.
        return complete(
          {
            ...state,
            runPhase: "closed",
            closedCompletedReplicateIds: greenChemistryClosedReplicateIds(
              state.runId,
              frozenReplicates,
            ),
            stockClosureRecordId: closureRecordId,
            material: {
              ...material,
              instances: returnedMaster.instances,
              recoveryRecords: [...material.recoveryRecords, closureRecord],
              closure: {
                masterRemainderReturnedG: remainderG,
                frozenReplicates,
                stockClosureRecordId: closureRecordId,
              },
            },
          },
          undefined,
          {
            unusedMasterStockReturned:
              remainderG + " g remaining unheated stock returned to Unused Sample",
          },
        );
      }

      if (intent.actionId === "calculate-carbonate-composition") {
        const closedBindingFailure = requireClosedRunBinding(state, intent);
        if (closedBindingFailure) return closedBindingFailure;
        // Every replicate closes through recover-replicate-product and complete-replicate, and
        // the run then freezes that set when it returns its remaining stock. The calculation binds
        // to the frozen set, so it can never be derived from a replicate the run never closed out.
        const closure = state.material?.closure;
        if (
          state.runPhase !== "closed" ||
          !closure ||
          closure.frozenReplicates.length !== state.completedReplicates.length ||
          closure.frozenReplicates.length < rules.minimumReplicates ||
          intent.payload.validated !== true
        ) {
          return rejection(
            state,
            "measurement-derived-calculation-required",
            "Composition must pass validation against the recorded empty, loaded, and constant final masses for every replicate in the closed run.",
            "Finish the required replicates, return the remaining stock, and revise the submitted arithmetic using only recorded evidence.",
          );
        }
        return complete(
          { ...state, analysisCalculated: true },
          undefined,
          {
            calculation:
              "student submission validated against recorded replicate evidence",
          },
        );
      }

      if (intent.actionId === "record-composition-uncertainty") {
        const closedBindingFailure = requireClosedRunBinding(state, intent);
        if (closedBindingFailure) return closedBindingFailure;
        const note = stringPayload(intent.payload, "note");
        if (!state.analysisCalculated || !note) {
          return rejection(
            state,
            "uncertainty-required",
            "Record a substantive uncertainty or limitation after the composition calculation.",
            "Address the balance, constant-mass, transfer, and model evidence.",
          );
        }
        return complete(
          { ...state, uncertaintyRecorded: true },
          undefined,
          { uncertainty: note },
        );
      }

      // Every replicate already moved its own product at EX-19 and the run already returned its
      // remaining stock, so this step moves nothing and offers no destination to choose. It states
      // that the run's material is fully accounted for, and it may only say so once.
      if (intent.actionId === "recover-final-product") {
        const closedBindingFailure = requireClosedRunBinding(state, intent);
        if (closedBindingFailure) return closedBindingFailure;
        if (
          intent.payload.destination !== undefined
          || intent.payload.sourceInstanceId !== undefined
          || intent.payload.targetInstanceId !== undefined
        ) {
          return rejection(
            state,
            "destination-not-allowed",
            "Final recovery confirmation is a nonphysical record action and has no destination.",
            "Confirm the closed run without selecting another receiver.",
          );
        }
        if (state.productRecovered) {
          return rejection(
            state,
            "recoveries-already-confirmed",
            "This run's recoveries have already been confirmed.",
            "Continue with the report nodes, or reset the activity for a new run.",
          );
        }
        if (state.runPhase !== "closed" || !state.material?.closure) {
          return rejection(
            state,
            "run-not-closed",
            "The run has not returned its remaining unheated stock.",
            "Return the remaining master stock to Unused Sample before confirming the recoveries.",
          );
        }
        if (
          !state.analysisCalculated ||
          !state.uncertaintyRecorded ||
          state.material.closure.frozenReplicates.length < rules.minimumReplicates
        ) {
          return rejection(
            state,
            "analysis-required",
            "The final confirmation follows validated composition and uncertainty evidence for the closed run.",
            "Complete the measurement-derived analysis before confirming the recoveries.",
          );
        }
        const reconciliationErrors = finalReconciliationErrors(state);
        if (reconciliationErrors.length > 0) {
          return rejection(
            state,
            "recovery-reconciliation-failed",
            reconciliationErrors.join(" "),
            "Reconcile the recovered material against the run's own records before confirming.",
          );
        }
        return complete({ ...state, productRecovered: true }, undefined, {
          allRecoveriesConfirmed:
            state.material.closure.frozenReplicates.length
            + " replicate products collected separately; all unheated mixture returned",
        });
      }

      // The lab-owned report nodes are nonphysical, but they are compiled nodes with compiled
      // prerequisites: the route records their evidence instead of asserting completion locally.
      if (intent.actionId === "review-assigned-green-chemistry-report") {
        const closedBindingFailure = requireClosedRunBinding(state, intent);
        if (closedBindingFailure) return closedBindingFailure;
        const review = stringPayload(intent.payload, "review");
        if (!state.productRecovered) {
          return rejection(
            state,
            "recovery-required",
            "The assigned report review follows separate recovery of the heated product.",
            "Recover the final product into its labeled vessel first.",
          );
        }
        if (!stringPayload(intent.payload, "assignedReport") || !review) {
          return rejection(
            state,
            "assigned-report-required",
            "Review the teacher-assigned report using its own evidence.",
            "Ask the teacher to provide and assign one of the three report artifacts.",
          );
        }
        return complete({ ...state, reportReviewed: true }, undefined, {
          assignedReportReview: review,
        });
      }

      if (intent.actionId === "calculate-assigned-report-atom-economy") {
        const closedBindingFailure = requireClosedRunBinding(state, intent);
        if (closedBindingFailure) return closedBindingFailure;
        const submitted = numberPayload(intent.payload, "atomEconomyPercent");
        if (!state.reportReviewed) {
          return rejection(
            state,
            "assigned-report-review-required",
            "Atom economy follows the assigned-report review.",
            "Record the assigned-report review first.",
          );
        }
        if (submitted === undefined || intent.payload.validated !== true) {
          return rejection(
            state,
            "atom-economy-validation-required",
            "Atom economy must be calculated from the teacher-provided stoichiometric contributions.",
            "Use the teacher-provided convention and revise the submitted percentage.",
          );
        }
        return complete({ ...state, atomEconomyRecorded: true }, undefined, {
          assignedReportAtomEconomy: submitted + " %; student submission validated",
        });
      }

      if (intent.actionId === "complete-green-chemistry-peer-review") {
        const closedBindingFailure = requireClosedRunBinding(state, intent);
        if (closedBindingFailure) return closedBindingFailure;
        const principle = stringPayload(intent.payload, "additionalGreenPrinciple");
        const recommendations = stringPayload(intent.payload, "recommendations");
        if (!state.atomEconomyRecorded) {
          return rejection(
            state,
            "atom-economy-required",
            "The peer review closes after the assigned-report atom economy is recorded.",
            "Record the assigned-report atom economy first.",
          );
        }
        if (!principle || !recommendations) {
          return rejection(
            state,
            "incomplete-review",
            "The peer review omits a green-chemistry principle or its recommendations.",
            "Complete every review section using evidence from the assigned report.",
          );
        }
        return complete({ ...state, peerReviewComplete: true }, undefined, {
          additionalGreenPrinciple: principle,
          peerReviewRecommendations: recommendations,
        });
      }

      return rejection(
        state,
        "unimplemented-mapped-action",
        'Mapped action "' + intent.actionId + '" has no route transition.',
        "Stop and reconcile the Cycle 11 route adapter.",
      );
    },
    recover(state, routeRejection: RouteTechniqueExecutionRejection) {
      if (
        routeRejection.code === "measurement-required" ||
        routeRejection.code.endsWith("-measurement-invalid")
      ) {
        return { ...state, pendingMassReading: undefined };
      }
      return state;
    },
    reset() {
      // A fresh run: a new run id, an open phase, and no inherited material, records or evidence.
      // Nothing about the closed run may carry into the next one.
      return createInitialGreenChemistryRouteState();
    },
  };
};
