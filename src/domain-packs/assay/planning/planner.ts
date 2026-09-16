import {
  addDecimal,
  ceilDecimalToInteger,
  compareDecimal,
  formatDecimal,
  multiplyDecimal,
  multiplyDecimalByInteger,
  multiplyDecimalByRatio,
  parseDecimal,
  type ExactDecimal,
} from "../../../platform/planning/decimal";
import {
  incompleteResourceRunPlan,
  planResourceRun,
} from "../../../platform/planning/planner";
import {
  validateResourceRunContext,
} from "../../../platform/planning/schema";
import type {
  CapacityScheduleItem,
  FormulaTraceStep,
  OveragePolicy,
  PlanningDiagnostic,
  Quantity,
  ResourceRunContext,
  ResourceRunPlan,
  ResourceSpec,
  StationWave,
} from "../../../platform/planning/types";
import {
  convertQuantity,
  normalizeQuantity,
} from "../../../platform/planning/units";
import { replayAssayOperations } from "../runtime";
import type {
  AssayOperation,
  AssayRuntimeState,
} from "../runtime";
import type { AssayDefinition } from "../types";
import { findForbiddenArtifactData } from "../../../platform/artifacts/security";
import { createAssayPlanningExports } from "./exports";
import type {
  AssayCapacityBottleneck,
  AssayInventoryComparison,
  AssayMasterMixBatch,
  AssayMasterMixPolicy,
  AssayOperationPlanningSummary,
  AssayOperationalPhaseScheduleItem,
  AssayPlanningProfile,
  AssayRunPlanningRequest,
  AssayRunPlanEvidencePayload,
  AssayRunPlanResult,
} from "./types";
import { validateAssayPlanningProfile } from "./validation";

const countGroups = (context: ResourceRunContext): number =>
  context.grouping.kind === "explicit"
    ? context.grouping.groups.length
    : Math.ceil(context.participants / context.grouping.groupSize);

const plateRunsFor = (context: ResourceRunContext): number =>
  countGroups(context) * context.repeats * context.technicalReplicates;

const quantity = (
  value: ExactDecimal,
  unit: Quantity["unit"],
): Quantity => ({ value: formatDecimal(value), unit });

const operationConsumption = (
  state: AssayRuntimeState,
  operations: readonly AssayOperation[],
): {
  externalLiquidBySource: Map<string, ExactDecimal>;
  tipCountByType: Map<string, number>;
  diagnostics: PlanningDiagnostic[];
} => {
  const diagnostics: PlanningDiagnostic[] = [];
  const externalLiquidBySource = new Map<string, ExactDecimal>();
  const tipCountByType = new Map<string, number>();
  const setVolumes = new Map(
    state.pipettes.map(({ pipetteId, setVolume }) => [
      pipetteId,
      parseDecimal(convertQuantity(setVolume, "uL").value),
    ]),
  );
  const definitions = new Map(
    state.pipetteDefinitions.map((definition) => [definition.id, definition]),
  );

  operations.forEach((operation, index) => {
    const definition = "pipetteId" in operation
      ? definitions.get(operation.pipetteId)
      : undefined;
    if ("pipetteId" in operation && !definition) {
      diagnostics.push({
        code: "assay.planning.operation.pipette-missing",
        path: `/operations/${index}/pipetteId`,
        message: `Operation ${operation.operationId} references unknown pipette ${operation.pipetteId}.`,
        severity: "error",
      });
      return;
    }
    if (operation.type === "setVolume") {
      setVolumes.set(
        operation.pipetteId,
        parseDecimal(convertQuantity(operation.volume, "uL").value),
      );
      return;
    }
    if (operation.type === "attachTips" && definition) {
      tipCountByType.set(
        operation.tipTypeId,
        (tipCountByType.get(operation.tipTypeId) ?? 0) + definition.channels,
      );
      return;
    }
    if (operation.type !== "aspirate" || !definition) return;
    const sourceRef = operation.source.kind === "shared-source"
      ? operation.source.sourceId
      : operation.source.kind === "single"
        && operation.source.location.kind === "source"
        ? operation.source.location.sourceId
        : undefined;
    if (!sourceRef) return;
    const configuredVolume = setVolumes.get(operation.pipetteId);
    if (!configuredVolume) {
      diagnostics.push({
        code: "assay.planning.operation.volume-missing",
        path: `/operations/${index}`,
        message: `Operation ${operation.operationId} has no declared pipette volume.`,
        severity: "error",
      });
      return;
    }
    const channels = operation.source.kind === "shared-source"
      ? definition.channels
      : 1;
    const consumed = multiplyDecimalByInteger(configuredVolume, channels);
    externalLiquidBySource.set(
      sourceRef,
      addDecimal(
        externalLiquidBySource.get(sourceRef) ?? parseDecimal("0"),
        consumed,
      ),
    );
  });

  return { externalLiquidBySource, tipCountByType, diagnostics };
};

const profileDiagnostics = (
  artifact: AssayDefinition,
  request: AssayRunPlanningRequest,
): PlanningDiagnostic[] => {
  const diagnostics: PlanningDiagnostic[] = [];
  if (!request.profile.supportedUseBoundaries.includes(artifact.useBoundary)) {
    diagnostics.push({
      code: "assay.planning.profile.use-boundary",
      path: "/profile/supportedUseBoundaries",
      message: `Profile ${request.profile.id}@${request.profile.version} does not declare support for ${artifact.useBoundary}.`,
      severity: "error",
    });
  }
  if (request.initialRuntimeState.plate.format !== artifact.plate.format) {
    diagnostics.push({
      code: "assay.planning.runtime.plate-format",
      path: "/initialRuntimeState/plate/format",
      message: "The runtime operation graph and assay artifact must use the same plate format.",
      severity: "error",
    });
  }
  const artifactOperationTypes = new Set(
    artifact.operations.map(({ type }) => type),
  );
  request.profile.instruments.forEach((instrument, index) => {
    if (instrument.demandOperationTypes.some((type) =>
      artifactOperationTypes.has(type))) {
      return;
    }
    diagnostics.push({
      code: "assay.planning.instrument.operation-demand-missing",
      path: `/profile/instruments/${index}/demandOperationTypes`,
      message: `${instrument.label} has no matching declared operation in artifact ${artifact.id}.`,
      severity: "error",
      resourceId: instrument.resourceId,
    });
  });
  request.profile.reviewFlags.forEach((flag) => diagnostics.push({
    code: flag.code,
    path: "/profile/reviewFlags",
    message: flag.message,
    severity: flag.severity === "blocking" ? "error" : "warning",
  }));
  request.declaredAssumptions.forEach((assumption, index) => {
    if (assumption.trim()) return;
    diagnostics.push({
      code: "assay.planning.assumption.empty",
      path: `/declaredAssumptions/${index}`,
      message: "Declared assumptions must be non-empty reviewable text.",
      severity: "error",
    });
  });
  findForbiddenArtifactData(request.declaredAssumptions).forEach((entry) => {
    diagnostics.push({
      code: entry.code,
      path: `/declaredAssumptions${entry.path === "/" ? "" : entry.path}`,
      message: entry.message,
      severity: "error",
    });
  });
  if (request.operations.length > 10000) {
    diagnostics.push({
      code: "assay.planning.operation-graph.too-large",
      path: "/operations",
      message: "Operational planning accepts at most 10,000 ordered operations.",
      severity: "error",
    });
  }
  return diagnostics;
};

const createLiquidResources = (
  profile: AssayPlanningProfile,
  consumed: ReadonlyMap<string, ExactDecimal>,
  plateRuns: number,
  diagnostics: PlanningDiagnostic[],
): ResourceSpec[] => {
  const policiesBySource = new Map(
    profile.operationLiquids.map((policy) => [policy.sourceRef, policy]),
  );
  consumed.forEach((_volume, sourceRef) => {
    if (policiesBySource.has(sourceRef)) return;
    diagnostics.push({
      code: "assay.planning.operation-liquid.metadata-missing",
      path: `/profile/operationLiquids/${sourceRef}`,
      message: `External source ${sourceRef} is consumed by the operation graph but has no declared planning policy.`,
      severity: "error",
      resourceId: sourceRef,
    });
  });
  profile.operationLiquids.forEach(({ sourceRef, resourceId }) => {
    if (consumed.has(sourceRef)) return;
    diagnostics.push({
      code: "assay.planning.operation-liquid.unused-policy",
      path: `/profile/operationLiquids/${sourceRef}`,
      message: `Declared operation-liquid policy ${resourceId} has no matching external aspiration in the operation graph.`,
      severity: "warning",
      resourceId,
    });
  });
  return [...consumed.entries()].flatMap(([sourceRef, volume]) => {
    const policy = policiesBySource.get(sourceRef);
    if (!policy) return [];
    const batchCount = Math.ceil(plateRuns / policy.batchPlateCapacity);
    return [{
      id: policy.resourceId,
      domainPackId: "assay" as const,
      label: policy.label,
      resourceClass: policy.resourceClass,
      quantity: {
        amount: quantity(volume, "uL"),
        basis: "group" as const,
        multiplyByRepeats: true,
        multiplyByTechnicalReplicates: true,
      },
      ...(policy.overage ? { overage: policy.overage } : {}),
      ...(policy.deadVolume ? { deadVolume: policy.deadVolume } : {}),
      preparation: {
        task: policy.preparationTask,
        batchCount,
        ...(policy.leadTime ? { leadTime: policy.leadTime } : {}),
      },
      substitutionPolicy: { mode: "none" as const, candidates: [] },
      reviewFlags: policy.reviewFlags,
    }];
  });
};

const createTipResources = (
  profile: AssayPlanningProfile,
  tipsPerPlate: ReadonlyMap<string, number>,
  plateRuns: number,
  diagnostics: PlanningDiagnostic[],
): ResourceSpec[] => {
  const packages = new Map(
    profile.tipPackages.map((policy) => [policy.tipTypeId, policy]),
  );
  return [...tipsPerPlate.entries()].flatMap(([tipTypeId, count]) => {
    const policy = packages.get(tipTypeId);
    if (!policy) {
      diagnostics.push({
        code: "assay.planning.tip-package.metadata-missing",
        path: `/profile/tipPackages/${tipTypeId}`,
        message: `Tip type ${tipTypeId} is attached by the operation graph but has no declared package policy.`,
        severity: "error",
        resourceId: tipTypeId,
      });
      return [];
    }
    const totalTips = count * plateRuns;
    const boxCount = Math.ceil(totalTips / policy.tipsPerBox);
    return [
      {
        id: policy.tipResourceId,
        domainPackId: "assay" as const,
        label: policy.tipLabel,
        resourceClass: "consumable" as const,
        quantity: {
          amount: { value: String(count), unit: "1" as const },
          basis: "group" as const,
          multiplyByRepeats: true,
          multiplyByTechnicalReplicates: true,
        },
        reuse: { mode: "single-use" as const },
        reviewFlags: policy.reviewFlags,
      },
      {
        id: policy.boxResourceId,
        domainPackId: "assay" as const,
        label: policy.boxLabel,
        resourceClass: "consumable" as const,
        quantity: {
          amount: { value: String(boxCount), unit: "1" as const },
          basis: "fixed" as const,
        },
        reuse: { mode: "single-use" as const },
        reviewFlags: policy.reviewFlags,
      },
    ];
  });
};

const createProfileResources = (
  profile: AssayPlanningProfile,
  plateRuns: number,
): ResourceSpec[] => [
  ...profile.countResources.map((policy): ResourceSpec => ({
    id: policy.resourceId,
    domainPackId: "assay",
    label: policy.label,
    resourceClass: policy.resourceClass,
    quantity: {
      amount: { value: policy.quantityPerPlate, unit: "1" },
      basis: "group",
      multiplyByRepeats: true,
      multiplyByTechnicalReplicates: true,
    },
    ...(policy.reuseMode ? { reuse: { mode: policy.reuseMode } } : {}),
    ...(policy.cleanupTask
      ? {
          cleanup: {
            task: policy.cleanupTask,
            resetRequired: policy.resetRequired ?? false,
          },
        }
      : {}),
    reviewFlags: policy.reviewFlags,
  })),
  ...profile.masterMixes.flatMap((mix) => {
    const batchCount = Math.ceil(plateRuns / mix.batchPlateCapacity);
    return mix.components.map((component): ResourceSpec => ({
      id: component.resourceId,
      domainPackId: "assay",
      label: component.label,
      resourceClass: component.resourceClass,
      quantity: {
        amount: component.volumePerPlate,
        basis: "group",
        multiplyByRepeats: true,
        multiplyByTechnicalReplicates: true,
      },
      ...(mix.overage ? { overage: mix.overage } : {}),
      ...(component.deadVolume ? { deadVolume: component.deadVolume } : {}),
      preparation: {
        task: `${mix.preparationTask} (${mix.label}).`,
        batchCount,
        ...(mix.leadTime ? { leadTime: mix.leadTime } : {}),
      },
      substitutionPolicy: { mode: "none", candidates: [] },
      reviewFlags: mix.reviewFlags,
    }));
  }),
  ...profile.instruments.map((instrument): ResourceSpec => ({
    id: instrument.resourceId,
    domainPackId: "assay",
    label: instrument.label,
    resourceClass: instrument.resourceClass,
    quantity: {
      amount: { value: "1", unit: "1" },
      basis: "group",
    },
    capacity: {
      groupsPerUnitPerWave: instrument.platesPerUnitPerWave,
      defaultUnitsAvailable: instrument.defaultUnitsAvailable,
      stationId: instrument.stationId,
      waveDuration: instrument.waveDuration,
      ...(instrument.resetDuration
        ? { resetDuration: instrument.resetDuration }
        : {}),
    },
    reuse: { mode: "reuse-across-waves" },
    cleanup: {
      task: instrument.cleanupTask,
      ...(instrument.cleanupDuration
        ? { duration: instrument.cleanupDuration }
        : {}),
      resetRequired: true,
    },
    reviewFlags: instrument.reviewFlags,
  })),
];

const expandedPlateRunIds = (context: ResourceRunContext): string[] => {
  const baseGroups = context.grouping.kind === "explicit"
    ? context.grouping.groups.map(({ id }) => id)
    : Array.from(
        { length: countGroups(context) },
        (_, index) => `group-${index + 1}`,
      );
  return Array.from({ length: context.repeats }, (_, repeat) =>
    Array.from({ length: context.technicalReplicates }, (_, technical) =>
      baseGroups.map((groupId) =>
        `${groupId}:repeat-${repeat + 1}:technical-${technical + 1}`),
    ).flat(),
  ).flat();
};

const exactCapacitySchedule = (
  profile: AssayPlanningProfile,
  context: ResourceRunContext,
  diagnostics: PlanningDiagnostic[],
): {
  capacitySchedule: CapacityScheduleItem[];
  stationWaves: StationWave[];
  bottlenecks: AssayCapacityBottleneck[];
} => {
  const runIds = expandedPlateRunIds(context);
  const capacitySchedule: CapacityScheduleItem[] = [];
  const stationWaves: StationWave[] = [];
  const bottlenecks: AssayCapacityBottleneck[] = [];

  profile.instruments.forEach((instrument) => {
    const override = context.instrumentCapacities.find(
      ({ resourceId }) => resourceId === instrument.resourceId,
    );
    const unitsAvailable =
      override?.unitsAvailable ?? instrument.defaultUnitsAvailable;
    const platesPerUnitPerWave =
      override?.groupsPerUnitPerWave ?? instrument.platesPerUnitPerWave;
    const groupsPerWave = unitsAvailable * platesPerUnitPerWave;
    const waves = Math.max(1, Math.ceil(runIds.length / groupsPerWave));
    const waveDuration = normalizeQuantity(instrument.waveDuration);
    const resetDuration = instrument.resetDuration
      ? normalizeQuantity(instrument.resetDuration)
      : undefined;
    let total = multiplyDecimalByInteger(
      parseDecimal(waveDuration.value),
      waves,
    );
    if (resetDuration && waves > 1) {
      total = addDecimal(
        total,
        multiplyDecimalByInteger(
          parseDecimal(resetDuration.value),
          waves - 1,
        ),
      );
    }
    capacitySchedule.push({
      resourceId: instrument.resourceId,
      stationId: instrument.stationId,
      unitsAvailable,
      groupsPerWave,
      waves,
      waveDuration,
      totalDuration: quantity(total, waveDuration.unit),
    });
    Array.from({ length: waves }, (_, index) => {
      stationWaves.push({
        stationId: instrument.stationId,
        resourceId: instrument.resourceId,
        wave: index + 1,
        groupIds: runIds.slice(index * groupsPerWave, (index + 1) * groupsPerWave),
      });
    });
    if (waves > 1) {
      bottlenecks.push({
        resourceId: instrument.resourceId,
        label: instrument.label,
        waves,
        message: `${instrument.label} requires ${waves} waves for ${runIds.length} plate runs at ${unitsAvailable} unit(s) and ${platesPerUnitPerWave} plate slot(s) per unit.`,
      });
    }
  });

  if (context.runWindow) {
    const runWindow = normalizeQuantity(context.runWindow.duration);
    capacitySchedule.forEach((item) => {
      if (
        item.totalDuration
        && compareDecimal(
          parseDecimal(item.totalDuration.value),
          parseDecimal(runWindow.value),
        ) > 0
      ) {
        diagnostics.push({
          code: "assay.planning.capacity.run-window-exceeded",
          path: `/profile/instruments/${item.resourceId}`,
          message: `${item.resourceId} requires ${item.totalDuration.value} ${item.totalDuration.unit}, exceeding the declared run window of ${runWindow.value} ${runWindow.unit}.`,
          severity: "error",
          resourceId: item.resourceId,
        });
      }
    });
  }

  return {
    capacitySchedule: capacitySchedule.sort((a, b) =>
      a.resourceId.localeCompare(b.resourceId)),
    stationWaves: stationWaves.sort((a, b) =>
      `${a.stationId}:${a.resourceId}:${String(a.wave).padStart(6, "0")}`
        .localeCompare(
          `${b.stationId}:${b.resourceId}:${String(b.wave).padStart(6, "0")}`,
        )),
    bottlenecks: bottlenecks.sort((a, b) =>
      a.resourceId.localeCompare(b.resourceId)),
  };
};

const applyOverage = (
  base: ExactDecimal,
  unit: Quantity["unit"],
  overage: OveragePolicy | undefined,
  trace: FormulaTraceStep[],
  applyFixed: boolean,
): ExactDecimal => {
  if (!overage) return base;
  if (overage.kind === "percent") {
    const percent = parseDecimal(overage.percent);
    const result = multiplyDecimal(
      base,
      addDecimal(
        parseDecimal("1"),
        multiplyDecimalByRatio(percent, 1n, 100n),
      ),
    );
    trace.push({
      label: "overage",
      expression: `${formatDecimal(base)} x (1 + ${overage.percent} / 100)`,
      result: quantity(result, unit),
    });
    return result;
  }
  if (!applyFixed) return base;
  const fixed = convertQuantity(overage.quantity, unit);
  const result = addDecimal(base, parseDecimal(fixed.value));
  trace.push({
    label: "fixed overage",
    expression: `${formatDecimal(base)} + ${fixed.value}`,
    result: quantity(result, unit),
  });
  return result;
};

const createMasterMixBatches = (
  mixes: readonly AssayMasterMixPolicy[],
  plateRuns: number,
): AssayMasterMixBatch[] => mixes.flatMap((mix) => {
  const batchCount = Math.ceil(plateRuns / mix.batchPlateCapacity);
  return Array.from({ length: batchCount }, (_, index): AssayMasterMixBatch => {
    const plateCount = Math.min(
      mix.batchPlateCapacity,
      plateRuns - index * mix.batchPlateCapacity,
    );
    return {
      masterMixId: mix.id,
      masterMixLabel: mix.label,
      batchNumber: index + 1,
      plateCount,
      components: mix.components.map((component) => {
        const unit = component.volumePerPlate.unit;
        let required = multiplyDecimalByInteger(
          parseDecimal(component.volumePerPlate.value),
          plateCount,
        );
        const formulaTrace: FormulaTraceStep[] = [{
          label: "batch base",
          expression: `${component.volumePerPlate.value} ${unit} x ${plateCount} plates`,
          result: quantity(required, unit),
        }];
        required = applyOverage(
          required,
          unit,
          mix.overage,
          formulaTrace,
          index === 0,
        );
        if (component.deadVolume) {
          const deadVolume = convertQuantity(component.deadVolume, unit);
          const beforeDeadVolume = required;
          required = addDecimal(required, parseDecimal(deadVolume.value));
          formulaTrace.push({
            label: "dead-volume",
            expression: `${formatDecimal(beforeDeadVolume)} + ${deadVolume.value} ${unit} batch dead volume`,
            result: quantity(required, unit),
          });
        }
        return {
          resourceId: component.resourceId,
          label: component.label,
          required: quantity(required, unit),
          formulaTrace,
        };
      }),
    };
  });
});

const phaseSchedule = (
  profile: AssayPlanningProfile,
  capacity: readonly CapacityScheduleItem[],
  context: ResourceRunContext,
  diagnostics: PlanningDiagnostic[],
): AssayOperationalPhaseScheduleItem[] => {
  let offset = parseDecimal("0");
  const schedule = profile.phases.map((phase): AssayOperationalPhaseScheduleItem => {
    const linked = phase.capacityResourceId
      ? capacity.find(({ resourceId }) => resourceId === phase.capacityResourceId)
      : undefined;
    const duration = linked?.totalDuration
      ?? (phase.duration ? normalizeQuantity(phase.duration) : undefined);
    if (!duration) {
      diagnostics.push({
        code: "assay.planning.phase.duration-unresolved",
        path: `/profile/phases/${phase.id}`,
        message: `Phase ${phase.id} has no resolved duration.`,
        severity: "error",
      });
    }
    const resolved = duration ?? { value: "0", unit: "s" as const };
    const start = quantity(offset, "s");
    offset = addDecimal(
      offset,
      parseDecimal(convertQuantity(resolved, "s").value),
    );
    return {
      phaseId: phase.id,
      label: phase.label,
      kind: phase.kind,
      startsAfter: start,
      duration: convertQuantity(resolved, "s"),
      ...(phase.capacityResourceId
        ? { capacityResourceId: phase.capacityResourceId }
        : {}),
      ...(linked ? { waves: linked.waves } : {}),
    };
  });
  const phaseTotal = (
    kinds: readonly AssayOperationalPhaseScheduleItem["kind"][],
  ): ExactDecimal => schedule
    .filter(({ kind }) => kinds.includes(kind))
    .reduce(
      (total, phase) => addDecimal(
        total,
        parseDecimal(convertQuantity(phase.duration, "s").value),
      ),
      parseDecimal("0"),
    );
  const compareWindow = (
    actual: ExactDecimal,
    window: ResourceRunContext["runWindow"],
    code: string,
    path: string,
    label: string,
  ): void => {
    if (!window) return;
    const available = convertQuantity(window.duration, "s");
    if (compareDecimal(actual, parseDecimal(available.value)) <= 0) return;
    diagnostics.push({
      code,
      path,
      message: `${label} phases require ${formatDecimal(actual)} s, exceeding the declared window of ${available.value} s.`,
      severity: "error",
    });
  };
  compareWindow(
    phaseTotal(["preparation"]),
    context.preparationWindow,
    "assay.planning.schedule.preparation-window-exceeded",
    "/resourceContext/preparationWindow",
    "Preparation",
  );
  compareWindow(
    phaseTotal(["reset", "cleanup"]),
    context.cleanupWindow,
    "assay.planning.schedule.cleanup-window-exceeded",
    "/resourceContext/cleanupWindow",
    "Reset and cleanup",
  );
  if (context.runWindow) {
    const available = convertQuantity(context.runWindow.duration, "s");
    if (compareDecimal(offset, parseDecimal(available.value)) > 0) {
      diagnostics.push({
        code: "assay.planning.schedule.run-window-exceeded",
        path: "/resourceContext/runWindow",
        message: `Sequential operational phases require ${formatDecimal(offset)} s, exceeding the declared run window of ${available.value} s.`,
        severity: "error",
      });
    }
  }
  return schedule;
};

const addPackagingFormulaTrace = (
  plan: ResourceRunPlan,
  profile: AssayPlanningProfile,
  summary: AssayOperationPlanningSummary,
): void => {
  summary.tipCountByType.forEach((tip) => {
    const policy = profile.tipPackages.find(
      ({ tipTypeId }) => tipTypeId === tip.tipTypeId,
    );
    if (!policy) return;
    const line = plan.requirements.find(
      ({ resourceId }) => resourceId === policy.boxResourceId,
    );
    if (!line) return;
    line.formulaTrace = [{
      label: "tip packaging",
      expression: `ceil(${tip.totalTips} tips / ${policy.tipsPerBox} tips per box)`,
      result: { value: String(tip.boxCount), unit: "1" },
    }];
  });
};

const inventoryComparison = (
  plan: ResourceRunPlan,
  context: ResourceRunContext,
): AssayInventoryComparison[] => plan.requirements.map((line): AssayInventoryComparison => {
  const inventory = context.availableInventory.find(
    ({ resourceId }) => resourceId === line.resourceId,
  );
  if (!inventory) {
    return {
      resourceId: line.resourceId,
      required: line.required,
      status: "not-declared",
    };
  }
  try {
    const available = convertQuantity(inventory.quantity, line.required.unit);
    const shortage = plan.shortages.find(
      ({ resourceId }) => resourceId === line.resourceId,
    )?.shortage;
    return {
      resourceId: line.resourceId,
      required: line.required,
      available,
      ...(shortage ? { shortage } : {}),
      status: shortage ? "shortage" : "available",
    };
  } catch {
    return {
      resourceId: line.resourceId,
      required: line.required,
      available: inventory.quantity,
      status: "incompatible-unit",
    };
  }
}).sort((left, right) => left.resourceId.localeCompare(right.resourceId));

const emptySummary = (): AssayOperationPlanningSummary => ({
  operationCount: 0,
  plateRuns: 0,
  tipCountByType: [],
  externalLiquidBySource: [],
});

const incompleteResult = (
  artifact: AssayDefinition,
  requestId: string,
  profile: AssayPlanningProfile | undefined,
  diagnostics: readonly PlanningDiagnostic[],
): AssayRunPlanResult => {
  const plan = incompleteResourceRunPlan(
    requestId,
    diagnostics,
    [
      "No material amount is inferred when operation, profile, or context metadata is invalid or missing.",
      "The planning service performs no purchase, reservation, inventory mutation, safety approval, or equipment control.",
    ],
  );
  return {
    status: "incomplete",
    artifactId: artifact.id,
    profileRef: {
      id: profile?.id ?? "unresolved",
      version: profile?.version ?? "unresolved",
    },
    plan,
    operationSummary: emptySummary(),
    masterMixBatches: [],
    phaseSchedule: [],
    bottlenecks: [],
    inventoryComparison: [],
    diagnostics: [...plan.diagnostics],
    exports: createAssayPlanningExports(plan, [], []),
  };
};

export const planAssayRun = (
  artifact: AssayDefinition,
  input: unknown,
  requestId: string,
): AssayRunPlanResult => {
  if (!input || typeof input !== "object") {
    return incompleteResult(artifact, requestId, undefined, [{
      code: "assay.planning.request.missing",
      path: "/context/extension",
      message: "An explicit resource context, planning profile, initial runtime state, and accepted operation graph are required.",
      severity: "error",
    }]);
  }
  const request = input as Partial<AssayRunPlanningRequest>;
  const profileValidation = validateAssayPlanningProfile(request.profile);
  if (!profileValidation.ok) {
    return incompleteResult(
      artifact,
      requestId,
      request.profile,
      profileValidation.diagnostics.map((entry) => ({
        code: entry.code,
        path: `/profile${entry.path === "/" ? "" : entry.path}`,
        message: entry.message,
        severity: "error",
      })),
    );
  }
  const contextValidation = validateResourceRunContext(request.resourceContext);
  if (!contextValidation.ok) {
    return incompleteResult(
      artifact,
      requestId,
      profileValidation.value,
      contextValidation.diagnostics.map((entry) => ({
        code: entry.code,
        path: `/resourceContext${entry.path === "/" ? "" : entry.path}`,
        message: entry.message,
        severity: "error",
      })),
    );
  }
  if (
    !request.initialRuntimeState
    || !Array.isArray(request.operations)
    || !Array.isArray(request.declaredAssumptions)
  ) {
    return incompleteResult(artifact, requestId, profileValidation.value, [{
      code: "assay.planning.operation-graph.missing",
      path: "/context/extension",
      message: "The initial runtime state, ordered operations, and declared assumptions are required.",
      severity: "error",
    }]);
  }

  const profile = profileValidation.value;
  const context = { ...contextValidation.value, requestId };
  const diagnostics = profileDiagnostics(artifact, {
    resourceContext: context,
    initialRuntimeState: request.initialRuntimeState,
    operations: request.operations,
    profile,
    declaredAssumptions: request.declaredAssumptions,
  });
  const replay = replayAssayOperations(
    request.initialRuntimeState,
    request.operations,
  );
  replay.transitions.forEach((transition, index) => {
    if (transition.accepted) return;
    transition.diagnostics.forEach((diagnostic) => diagnostics.push({
      code: "assay.planning.operation-graph.rejected",
      path: `/operations/${index}`,
      message: `${diagnostic.code}: ${diagnostic.message}`,
      severity: "error",
    }));
  });
  const consumption = operationConsumption(
    request.initialRuntimeState,
    request.operations,
  );
  diagnostics.push(...consumption.diagnostics);
  const plateRuns = plateRunsFor(context);
  const resources = [
    ...createLiquidResources(
      profile,
      consumption.externalLiquidBySource,
      plateRuns,
      diagnostics,
    ),
    ...createTipResources(
      profile,
      consumption.tipCountByType,
      plateRuns,
      diagnostics,
    ),
    ...createProfileResources(profile, plateRuns),
  ];
  const resourceIds = new Set<string>();
  resources.forEach((resource, index) => {
    if (resourceIds.has(resource.id)) {
      diagnostics.push({
        code: "assay.planning.resource.double-count",
        path: `/resources/${index}`,
        message: `Resource ${resource.id} was projected more than once; no quantity was merged or guessed.`,
        severity: "error",
        resourceId: resource.id,
      });
    }
    resourceIds.add(resource.id);
  });

  let plan = planResourceRun(resources, context, {
    initialDiagnostics: diagnostics,
    assumptions: [
      ...profile.assumptions,
      ...request.declaredAssumptions,
      `The ordered accepted operation graph is authoritative for tip and external-liquid consumption under ${request.initialRuntimeState.tipReusePolicy.mode} tip reuse.`,
      "One complete operation graph executes per group, repeat, and technical-replicate plate run.",
      `Profile source: ${profile.source.title} ${profile.source.version}; ${profile.source.validity}`,
    ],
    limitations: [
      ...profile.limitations,
      ...profile.source.limitations,
      "Planning is nominal and reviewable; it is not a safety, biosafety, purchasing, inventory-reservation, or automation-system action.",
    ],
  });
  diagnostics.splice(0, diagnostics.length, ...plan.diagnostics);
  const capacity = exactCapacitySchedule(profile, context, diagnostics);
  plan = {
    ...plan,
    capacitySchedule: capacity.capacitySchedule,
    stationWaves: capacity.stationWaves,
    diagnostics: [...diagnostics].sort((left, right) =>
      left.path.localeCompare(right.path)
      || left.code.localeCompare(right.code)
      || (left.resourceId ?? "").localeCompare(right.resourceId ?? "")),
  };
  const schedule = phaseSchedule(
    profile,
    capacity.capacitySchedule,
    context,
    diagnostics,
  );
  plan = {
    ...plan,
    status: diagnostics.some(({ severity }) => severity === "error")
      || plan.shortages.length > 0
      ? "incomplete"
      : "complete",
    diagnostics: [...diagnostics].sort((left, right) =>
      left.path.localeCompare(right.path)
      || left.code.localeCompare(right.code)
      || (left.resourceId ?? "").localeCompare(right.resourceId ?? "")),
  };
  const operationSummary: AssayOperationPlanningSummary = {
    operationCount: request.operations.length,
    plateRuns,
    tipCountByType: [...consumption.tipCountByType.entries()]
      .map(([tipTypeId, tipsPerPlate]) => {
        const packagePolicy = profile.tipPackages.find(
          (policy) => policy.tipTypeId === tipTypeId,
        );
        const totalTips = tipsPerPlate * plateRuns;
        return {
          tipTypeId,
          tipsPerPlate,
          totalTips,
          boxCount: packagePolicy
            ? Math.ceil(totalTips / packagePolicy.tipsPerBox)
            : 0,
        };
      })
      .sort((left, right) => left.tipTypeId.localeCompare(right.tipTypeId)),
    externalLiquidBySource: [...consumption.externalLiquidBySource.entries()]
      .map(([sourceRef, volume]) => ({
        sourceRef,
        volumePerPlate: quantity(volume, "uL"),
      }))
      .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef)),
  };
  addPackagingFormulaTrace(plan, profile, operationSummary);
  const masterMixBatches = createMasterMixBatches(
    profile.masterMixes,
    plateRuns,
  );
  const comparedInventory = inventoryComparison(plan, context);

  return {
    status: plan.status,
    artifactId: artifact.id,
    profileRef: { id: profile.id, version: profile.version },
    plan,
    operationSummary,
    masterMixBatches,
    phaseSchedule: schedule,
    bottlenecks: capacity.bottlenecks,
    inventoryComparison: comparedInventory,
    diagnostics: [...plan.diagnostics],
    exports: createAssayPlanningExports(plan, schedule, comparedInventory),
  };
};

export const projectAssayRunPlanEvidence = (
  result: AssayRunPlanResult,
): AssayRunPlanEvidencePayload => ({
  planId: result.plan.requestId,
  status: result.plan.status === "complete"
    ? result.plan.shortages.length > 0
      ? "review-required"
      : "ready"
    : result.plan.shortages.length > 0
      ? "review-required"
      : "blocked",
  requirementCount: result.plan.requirements.length,
  limitations: [...new Set(result.plan.limitations)].sort(),
});
