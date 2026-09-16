import {
  addDecimal,
  ceilDecimalToInteger,
  compareDecimal,
  formatDecimal,
  isNonNegativeDecimal,
  multiplyDecimal,
  multiplyDecimalByInteger,
  multiplyDecimalByRatio,
  parseDecimal,
  subtractDecimal,
  type ExactDecimal,
} from "./decimal";
import { convertQuantity, normalizeQuantity, quantitiesAreCompatible } from "./units";
import type {
  CapacityScheduleItem,
  FormulaTraceStep,
  PlanningDiagnostic,
  PlanningExtension,
  Quantity,
  RequirementLine,
  ResourceRunContext,
  ResourceRunPlan,
  ResourceSpec,
  StationWave,
} from "./types";

const quantity = (value: ExactDecimal, unit: Quantity["unit"]): Quantity => ({
  value: formatDecimal(value),
  unit,
});

const positiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

const contextDiagnostics = (context: ResourceRunContext): PlanningDiagnostic[] => {
  const diagnostics: PlanningDiagnostic[] = [];
  const requirePositive = (value: number, path: string): void => {
    if (!positiveSafeInteger(value)) diagnostics.push({
      code: "planning.context.positive-integer-required",
      path,
      message: `${path} must be a positive safe integer.`,
      severity: "error",
    });
  };
  requirePositive(context.participants, "/participants");
  requirePositive(context.repeats, "/repeats");
  requirePositive(context.technicalReplicates, "/technicalReplicates");
  if (context.grouping.kind === "group-size") requirePositive(context.grouping.groupSize, "/grouping/groupSize");
  context.sections.forEach((section, index) => requirePositive(section.participantCount, `/sections/${index}/participantCount`));
  if (context.sections.reduce((total, section) => total + section.participantCount, 0) !== context.participants) {
    diagnostics.push({
      code: "planning.context.section-participants-mismatch",
      path: "/sections",
      message: "Section participant totals must equal participants.",
      severity: "error",
    });
  }
  if (context.grouping.kind === "explicit") {
    context.grouping.groups.forEach((group, index) => requirePositive(group.participantCount, `/grouping/groups/${index}/participantCount`));
    if (context.grouping.groups.reduce((total, group) => total + group.participantCount, 0) !== context.participants) {
      diagnostics.push({
        code: "planning.context.group-participants-mismatch",
        path: "/grouping/groups",
        message: "Explicit group participant totals must equal participants.",
        severity: "error",
      });
    }
  }
  return diagnostics;
};

const groupIds = (context: ResourceRunContext): string[] => {
  if (context.grouping.kind === "explicit") return context.grouping.groups.map(({ id }) => id);
  if (!positiveSafeInteger(context.grouping.groupSize)) return [];
  return Array.from(
    { length: Math.ceil(context.participants / context.grouping.groupSize) },
    (_, index) => `group-${index + 1}`,
  );
};

const basisMultiplier = (
  spec: ResourceSpec,
  context: ResourceRunContext,
  groups: number,
): number => {
  const base = {
    fixed: 1,
    participant: context.participants,
    group: groups,
    section: context.sections.length,
    repeat: context.repeats,
    station: context.stations.length,
  }[spec.quantity.basis];
  return base
    * (spec.quantity.multiplyByRepeats ? context.repeats : 1)
    * (spec.quantity.multiplyByTechnicalReplicates ? context.technicalReplicates : 1);
};

const reuseDivisor = (spec: ResourceSpec, context: ResourceRunContext): number => {
  switch (spec.reuse?.mode) {
    case "reuse-across-repeats": return context.repeats;
    case "reuse-across-sections": return Math.max(context.sections.length, 1);
    case "maximum-uses": return spec.reuse.maximumUses ?? 1;
    default: return 1;
  }
};

const applyReuse = (
  spec: ResourceSpec,
  total: ExactDecimal,
  context: ResourceRunContext,
  groups: number,
  trace: FormulaTraceStep[],
): ExactDecimal => {
  if (spec.reuse?.mode === "reuse-across-waves" && spec.capacity) {
    const override = context.instrumentCapacities.find(({ resourceId }) => resourceId === spec.id);
    const unitsAvailable = override?.unitsAvailable ?? spec.capacity.defaultUnitsAvailable ?? 1;
    const groupsPerUnit = override?.groupsPerUnitPerWave ?? spec.capacity.groupsPerUnitPerWave;
    const concurrentUnits = Math.min(unitsAvailable, Math.max(1, Math.ceil(groups / groupsPerUnit)));
    const reused = parseDecimal(String(concurrentUnits));
    trace.push({
      label: "wave concurrency",
      expression: `min(${unitsAvailable} available, ceil(${groups} groups / ${groupsPerUnit} groups per unit))`,
      result: quantity(reused, "1"),
    });
    return reused;
  }
  const divisor = reuseDivisor(spec, context);
  if (divisor <= 1) return total;
  if (spec.quantity.amount.unit !== "1") throw new Error("Reuse policies apply only to count quantities.");
  const reused = parseDecimal(String(ceilDecimalToInteger(multiplyDecimalByRatio(total, 1n, BigInt(divisor)))));
  trace.push({
    label: "reuse",
    expression: `ceil(${formatDecimal(total)} / ${divisor})`,
    result: quantity(reused, "1"),
  });
  return reused;
};

const applyOverage = (
  spec: ResourceSpec,
  base: ExactDecimal,
  trace: FormulaTraceStep[],
): ExactDecimal => {
  if (!spec.overage || spec.quantity.includesOverage) return base;
  if (spec.overage.kind === "percent") {
    const percent = parseDecimal(spec.overage.percent);
    if (!isNonNegativeDecimal(percent)) throw new Error("Overage percent cannot be negative.");
    const factor = addDecimal(parseDecimal("1"), multiplyDecimalByRatio(percent, 1n, 100n));
    const total = multiplyDecimal(base, factor);
    trace.push({
      label: "overage",
      expression: `${formatDecimal(base)} x (1 + ${formatDecimal(percent)} / 100)`,
      result: quantity(total, spec.quantity.amount.unit),
    });
    return total;
  }
  const fixed = convertQuantity(spec.overage.quantity, spec.quantity.amount.unit);
  const total = addDecimal(base, parseDecimal(fixed.value));
  trace.push({
    label: "overage",
    expression: `${formatDecimal(base)} + ${fixed.value}`,
    result: quantity(total, spec.quantity.amount.unit),
  });
  return total;
};

const applyDeadVolume = (
  spec: ResourceSpec,
  base: ExactDecimal,
  trace: FormulaTraceStep[],
): ExactDecimal => {
  if (!spec.deadVolume || spec.quantity.includesDeadVolume) return base;
  const converted = convertQuantity(spec.deadVolume, spec.quantity.amount.unit);
  const batches = spec.preparation?.batchCount ?? 1;
  const addition = multiplyDecimalByInteger(parseDecimal(converted.value), batches);
  const total = addDecimal(base, addition);
  trace.push({
    label: "dead-volume",
    expression: `${formatDecimal(base)} + (${converted.value} x ${batches} batch${batches === 1 ? "" : "es"})`,
    result: quantity(total, spec.quantity.amount.unit),
  });
  return total;
};

const planRequirement = (
  spec: ResourceSpec,
  context: ResourceRunContext,
  groups: number,
): RequirementLine => {
  const amount = parseDecimal(spec.quantity.amount.value);
  if (!isNonNegativeDecimal(amount)) throw new Error("Resource quantities cannot be negative.");
  const multiplier = basisMultiplier(spec, context, groups);
  let total = multiplyDecimalByInteger(amount, multiplier);
  const trace: FormulaTraceStep[] = [{
    label: "base requirement",
    expression: `${formatDecimal(amount)} ${spec.quantity.amount.unit} x ${multiplier} ${spec.quantity.basis}${multiplier === 1 ? "" : "s"}`,
    result: quantity(total, spec.quantity.amount.unit),
  }];
  total = applyReuse(spec, total, context, groups, trace);
  total = applyOverage(spec, total, trace);
  total = applyDeadVolume(spec, total, trace);
  if (spec.quantity.includesOverage) trace.push({
    label: "overage already included",
    expression: "No additional overage applied.",
    result: quantity(total, spec.quantity.amount.unit),
  });
  if (spec.quantity.includesDeadVolume) trace.push({
    label: "dead volume already included",
    expression: "No additional dead volume applied.",
    result: quantity(total, spec.quantity.amount.unit),
  });
  const required = quantity(total, spec.quantity.amount.unit);
  return {
    resourceId: spec.id,
    label: spec.label,
    resourceClass: spec.resourceClass,
    required,
    normalizedTotal: normalizeQuantity(required),
    formulaTrace: trace,
  };
};

const capacityFor = (
  spec: ResourceSpec,
  context: ResourceRunContext,
  groups: string[],
): { item?: CapacityScheduleItem; waves: StationWave[] } => {
  if (!spec.capacity) return { waves: [] };
  const override = context.instrumentCapacities.find(({ resourceId }) => resourceId === spec.id);
  const unitsAvailable = override?.unitsAvailable ?? spec.capacity.defaultUnitsAvailable;
  if (!unitsAvailable || unitsAvailable < 1) return { waves: [] };
  const perUnit = override?.groupsPerUnitPerWave ?? spec.capacity.groupsPerUnitPerWave;
  const groupsPerWave = unitsAvailable * perUnit;
  const waveCount = Math.max(1, Math.ceil(groups.length / groupsPerWave));
  const waveDuration = spec.capacity.waveDuration ? normalizeQuantity(spec.capacity.waveDuration) : undefined;
  const resetDuration = spec.capacity.resetDuration ? normalizeQuantity(spec.capacity.resetDuration) : undefined;
  let totalDuration: Quantity | undefined;
  if (waveDuration) {
    let duration = multiplyDecimalByInteger(parseDecimal(waveDuration.value), waveCount);
    if (resetDuration && waveCount > 1) duration = addDecimal(
      duration,
      multiplyDecimalByInteger(parseDecimal(resetDuration.value), waveCount - 1),
    );
    totalDuration = quantity(duration, waveDuration.unit);
  }
  const stationId = spec.capacity.stationId ?? context.stations[0]?.id;
  const waves = stationId
    ? Array.from({ length: waveCount }, (_, index): StationWave => ({
        stationId,
        resourceId: spec.id,
        wave: index + 1,
        groupIds: groups.slice(index * groupsPerWave, (index + 1) * groupsPerWave),
      }))
    : [];
  return {
    item: {
      resourceId: spec.id,
      ...(stationId ? { stationId } : {}),
      unitsAvailable,
      groupsPerWave,
      waves: waveCount,
      ...(waveDuration ? { waveDuration } : {}),
      ...(totalDuration ? { totalDuration } : {}),
    },
    waves,
  };
};

const sorted = <T>(values: T[], key: (value: T) => string): T[] =>
  values.sort((left, right) => key(left).localeCompare(key(right)));

export const planResourceRun = (
  inputResources: readonly ResourceSpec[],
  context: ResourceRunContext,
  options: {
    extension?: PlanningExtension;
    initialDiagnostics?: readonly PlanningDiagnostic[];
    assumptions?: readonly string[];
    limitations?: readonly string[];
  } = {},
): ResourceRunPlan => {
  const contextIssues = contextDiagnostics(context);
  const extensionResult = options.extension?.extendResources?.(inputResources, context);
  const resources = [...(extensionResult?.resources ?? inputResources)];
  const diagnostics: PlanningDiagnostic[] = [
    ...(options.initialDiagnostics ?? []),
    ...contextIssues,
    ...(extensionResult?.diagnostics ?? []),
  ];
  const groups = groupIds(context);
  const requirements: RequirementLine[] = [];
  const capacitySchedule: CapacityScheduleItem[] = [];
  const stationWaves: StationWave[] = [];

  resources.forEach((spec, index) => {
    spec.reviewFlags.forEach((flag) => diagnostics.push({
      code: flag.code,
      path: `/resources/${index}/reviewFlags`,
      message: flag.message,
      severity: flag.severity === "blocking" ? "error" : "warning",
      resourceId: spec.id,
    }));
    try {
      requirements.push(planRequirement(spec, context, groups.length));
      const capacity = capacityFor(spec, context, groups);
      if (capacity.item) {
        capacitySchedule.push(capacity.item);
        if (capacity.item.totalDuration && context.runWindow) {
          try {
            const available = convertQuantity(context.runWindow.duration, capacity.item.totalDuration.unit);
            if (compareDecimal(parseDecimal(capacity.item.totalDuration.value), parseDecimal(available.value)) > 0) {
              diagnostics.push({
                code: "planning.capacity.run-window-exceeded",
                path: `/resources/${index}/capacity`,
                message: `${spec.label} requires ${capacity.item.totalDuration.value} ${capacity.item.totalDuration.unit}, exceeding the declared run window of ${available.value} ${available.unit}.`,
                severity: "error",
                resourceId: spec.id,
              });
            }
          } catch (error) {
            diagnostics.push({
              code: "planning.capacity.run-window-unit-incompatible",
              path: "/runWindow/duration",
              message: error instanceof Error ? error.message : "Run-window duration unit is incompatible.",
              severity: "error",
              resourceId: spec.id,
            });
          }
        }
      }
      stationWaves.push(...capacity.waves);
    } catch (error) {
      diagnostics.push({
        code: "planning.resource.invalid-metadata",
        path: `/resources/${index}`,
        message: error instanceof Error ? error.message : "Resource metadata is invalid.",
        severity: "error",
        resourceId: spec.id,
      });
    }
  });

  const shortages = requirements.flatMap((line) => {
    const inventory = context.availableInventory.find(({ resourceId }) => resourceId === line.resourceId);
    if (!inventory) return [];
    try {
      if (!quantitiesAreCompatible(inventory.quantity, line.required)) throw new Error("Inventory unit is incompatible with the requirement.");
      const available = convertQuantity(inventory.quantity, line.required.unit);
      const requiredDecimal = parseDecimal(line.required.value);
      const availableDecimal = parseDecimal(available.value);
      if (compareDecimal(availableDecimal, requiredDecimal) >= 0) return [];
      return [{
        resourceId: line.resourceId,
        required: line.required,
        available,
        shortage: quantity(subtractDecimal(requiredDecimal, availableDecimal), line.required.unit),
      }];
    } catch (error) {
      diagnostics.push({
        code: "planning.inventory.unit-incompatible",
        path: "/availableInventory",
        message: error instanceof Error ? error.message : "Inventory unit is incompatible.",
        severity: "error",
        resourceId: line.resourceId,
      });
      return [];
    }
  });

  const plan: ResourceRunPlan = {
    schema: "studio.resource-run-plan",
    schemaVersion: "1.0",
    requestId: context.requestId,
    status: diagnostics.some(({ severity }) => severity === "error") || shortages.length > 0 ? "incomplete" : "complete",
    contextSummary: {
      participants: context.participants,
      groupCount: groups.length,
      sectionCount: context.sections.length,
      repeats: context.repeats,
      technicalReplicates: context.technicalReplicates,
      stationCount: context.stations.length,
    },
    requirements: sorted(requirements, ({ resourceId }) => resourceId),
    preparationBatches: sorted(resources.flatMap((spec) => spec.preparation
      ? Array.from({ length: spec.preparation.batchCount ?? 1 }, (_, index) => ({
          resourceId: spec.id,
          batchNumber: index + 1,
          task: spec.preparation?.task ?? "Prepare resource.",
          ...(spec.preparation?.batchCapacity ? { targetQuantity: spec.preparation.batchCapacity } : {}),
          ...(spec.preparation?.leadTime ? { leadTime: spec.preparation.leadTime } : {}),
        }))
      : []), ({ resourceId, batchNumber }) => `${resourceId}:${String(batchNumber).padStart(6, "0")}`),
    capacitySchedule: sorted(capacitySchedule, ({ resourceId }) => resourceId),
    stationWaves: sorted(stationWaves, ({ stationId, resourceId, wave }) => `${stationId}:${resourceId}:${String(wave).padStart(6, "0")}`),
    shortages: sorted(shortages, ({ resourceId }) => resourceId),
    cleanupTasks: sorted(resources.flatMap((spec) => spec.cleanup ? [{
      resourceId: spec.id,
      task: spec.cleanup.task,
      ...(spec.cleanup.duration ? { duration: spec.cleanup.duration } : {}),
      resetRequired: spec.cleanup.resetRequired,
    }] : []), ({ resourceId }) => resourceId),
    substitutionCandidates: sorted(resources.flatMap((spec) =>
      spec.substitutionPolicy?.mode === "review-only"
        ? spec.substitutionPolicy.candidates.map((candidate) => ({
            resourceId: spec.id,
            candidateResourceId: candidate.resourceId,
            label: candidate.label,
            reason: candidate.reason,
            reviewRequired: true as const,
          }))
        : []), ({ resourceId, candidateResourceId }) => `${resourceId}:${candidateResourceId}`),
    diagnostics: sorted(diagnostics, ({ path, code, resourceId = "" }) => `${path}:${code}:${resourceId}`),
    assumptions: [...(options.assumptions ?? [])].sort(),
    limitations: [
      "This plan performs no purchase, reservation, inventory mutation, or other external write.",
      ...(options.limitations ?? []),
    ].sort(),
  };
  return options.extension?.extendPlan?.(plan, context) ?? plan;
};

export const incompleteResourceRunPlan = (
  requestId: string,
  diagnostics: readonly PlanningDiagnostic[],
  limitations: readonly string[] = [],
): ResourceRunPlan => ({
  schema: "studio.resource-run-plan",
  schemaVersion: "1.0",
  requestId,
  status: "incomplete",
  contextSummary: {
    participants: 0,
    groupCount: 0,
    sectionCount: 0,
    repeats: 0,
    technicalReplicates: 0,
    stationCount: 0,
  },
  requirements: [],
  preparationBatches: [],
  capacitySchedule: [],
  stationWaves: [],
  shortages: [],
  cleanupTasks: [],
  substitutionCandidates: [],
  diagnostics: [...diagnostics].sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code)),
  assumptions: [],
  limitations: [
    "This plan performs no purchase, reservation, inventory mutation, or other external write.",
    ...limitations,
  ].sort(),
});
