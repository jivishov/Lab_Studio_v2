import { convertQuantity } from "../../../platform/planning/units";
import type { AssayQuantity } from "../types/types";
import {
  absRational,
  addRational,
  compareRational,
  decimalToRational,
  divideRational,
  formatRational,
  multiplyRational,
  rational,
  subtractRational,
  type Rational,
} from "./exact";
import {
  serialDilutionPlanSchema,
  serialDilutionPlanSchemaVersion,
  type DilutionConservationSummary,
  type DilutionDiagnostic,
  type DilutionDiagnosticCode,
  type DilutionFormulaTrace,
  type DilutionPlannedTarget,
  type DilutionTargetGroup,
  type DilutionTransferGraph,
  type DilutionTransferStep,
  type GenerateSerialDilutionResult,
  type SerialDilutionInput,
  type SerialDilutionPlan,
} from "./types";

const ZERO = rational(0n);
const ONE = rational(1n);
const ONE_HUNDRED = rational(100n);
const MICROMOLAR_MICROLITER_PER_MICROMOLE = rational(1_000_000n);
const concentrationUnits = new Set(["uM", "mM", "M"]);
const volumeUnits = new Set(["uL", "mL", "L"]);

const diagnostic = (
  code: DilutionDiagnosticCode,
  path: string,
  message: string,
): DilutionDiagnostic => ({ code, path, message, severity: "error" });

const quantity = (value: string, unit: AssayQuantity["unit"]): AssayQuantity => ({ value, unit });

const parsePositive = (
  value: string,
  path: string,
  diagnostics: DilutionDiagnostic[],
): Rational | null => {
  try {
    const parsed = decimalToRational(value);
    if (compareRational(parsed, ZERO) <= 0) {
      diagnostics.push(diagnostic("assay.dilution.quantity.non-positive", path, `${path} must be greater than zero.`));
      return null;
    }
    return parsed;
  } catch {
    diagnostics.push(diagnostic("assay.dilution.decimal.invalid", path, `${path} must be a finite decimal string.`));
    return null;
  }
};

const normalizeVolume = (
  input: AssayQuantity,
  path: string,
  diagnostics: DilutionDiagnostic[],
): Rational | null => {
  if (!volumeUnits.has(input.unit)) {
    diagnostics.push(diagnostic("assay.dilution.unit.invalid", `${path}.unit`, `${path} must use uL, mL, or L.`));
    return null;
  }
  try {
    const normalized = convertQuantity(input, "uL");
    return parsePositive(normalized.value, `${path}.value`, diagnostics);
  } catch {
    diagnostics.push(diagnostic("assay.dilution.unit.invalid", path, `${path} is not an exactly convertible volume.`));
    return null;
  }
};

const normalizeConcentration = (
  input: AssayQuantity,
  path: string,
  diagnostics: DilutionDiagnostic[],
  allowZero = false,
): Rational | null => {
  if (!concentrationUnits.has(input.unit)) {
    diagnostics.push(diagnostic("assay.dilution.unit.invalid", `${path}.unit`, `${path} must use uM, mM, or M.`));
    return null;
  }
  try {
    const normalized = convertQuantity(input, "uM");
    const parsed = decimalToRational(normalized.value);
    if (compareRational(parsed, ZERO) < 0 || (!allowZero && compareRational(parsed, ZERO) === 0)) {
      diagnostics.push(diagnostic("assay.dilution.quantity.non-positive", `${path}.value`, `${path} must be ${allowZero ? "non-negative" : "greater than zero"}.`));
      return null;
    }
    return parsed;
  } catch {
    diagnostics.push(diagnostic("assay.dilution.decimal.invalid", path, `${path} must be an exactly convertible finite concentration.`));
    return null;
  }
};

const validateTargetGroups = (
  groups: readonly DilutionTargetGroup[],
  deviceChannels: 1 | 8 | 12,
  diagnostics: DilutionDiagnostic[],
): void => {
  if (groups.length === 0) {
    diagnostics.push(diagnostic("assay.dilution.targets.invalid", "targetGroups", "At least one target group is required."));
    return;
  }
  const groupIds = new Set<string>();
  const targetIds = new Set<string>();
  const expectedChannels = groups[0]?.targets.map(({ channelIndex }) => channelIndex).sort((a, b) => a - b).join(",");
  const expectedChannelCount = groups[0]?.targets[0]?.channelCount;
  const expectedOrientation = groups[0]?.targets[0]?.orientation;
  for (const [groupIndex, group] of groups.entries()) {
    const groupPath = `targetGroups[${groupIndex}]`;
    if (!group.id.trim() || groupIds.has(group.id)) {
      diagnostics.push(diagnostic("assay.dilution.mapping.duplicate", `${groupPath}.id`, "Target group ids must be non-empty and unique."));
    }
    groupIds.add(group.id);
    if (group.targets.length === 0) {
      diagnostics.push(diagnostic("assay.dilution.mapping.invalid", `${groupPath}.targets`, "Each point needs at least one mapped target."));
      continue;
    }
    const channelIds = new Set<number>();
    for (const [targetIndex, target] of group.targets.entries()) {
      const targetPath = `${groupPath}.targets[${targetIndex}]`;
      if (!target.targetId.trim() || targetIds.has(target.targetId)) {
        diagnostics.push(diagnostic("assay.dilution.mapping.duplicate", `${targetPath}.targetId`, "Target ids must be non-empty and unique across the plan."));
      }
      targetIds.add(target.targetId);
      if (!Number.isInteger(target.channelIndex)
        || target.channelIndex < 0
        || target.channelIndex >= target.channelCount
        || channelIds.has(target.channelIndex)) {
        diagnostics.push(diagnostic("assay.dilution.mapping.invalid", `${targetPath}.channelIndex`, "Channel indices must be unique integers within the declared channel count."));
      }
      channelIds.add(target.channelIndex);
      if (target.channelCount !== expectedChannelCount || target.orientation !== expectedOrientation) {
        diagnostics.push(diagnostic("assay.dilution.mapping.invalid", targetPath, "Every target group must use one stable channel count and orientation."));
      }
      if (target.channelCount !== deviceChannels) {
        diagnostics.push(diagnostic("assay.dilution.transfer.device-incompatible", targetPath, "Target mapping channel count must match the transfer device."));
      }
    }
    const channels = [...channelIds].sort((a, b) => a - b).join(",");
    if (channels !== expectedChannels) {
      diagnostics.push(diagnostic("assay.dilution.mapping.invalid", `${groupPath}.targets`, "Every serial point must map the same channel indices for deterministic carry-forward."));
    }
  }
};

export const validateSerialDilutionInput = (input: SerialDilutionInput): DilutionDiagnostic[] => {
  const diagnostics: DilutionDiagnostic[] = [];
  if (!input.planId.trim()) diagnostics.push(diagnostic("assay.dilution.id.invalid", "planId", "Plan id must be non-empty."));
  if (!input.source.id.trim()) diagnostics.push(diagnostic("assay.dilution.id.invalid", "source.id", "Source id must be non-empty."));
  if (!input.diluent.id.trim()) diagnostics.push(diagnostic("assay.dilution.id.invalid", "diluent.id", "Diluent id must be non-empty."));
  if (input.source.concentrationBasis !== "amount-per-volume") {
    diagnostics.push(diagnostic("assay.dilution.unit.invalid", "source.concentrationBasis", "Concentration basis must be explicit amount-per-volume."));
  }
  normalizeConcentration(input.source.concentration, "source.concentration", diagnostics);
  normalizeVolume(input.source.availableVolume, "source.availableVolume", diagnostics);
  normalizeVolume(input.diluent.availableVolume, "diluent.availableVolume", diagnostics);
  if (!input.transferDevice.deviceRef.trim()) diagnostics.push(diagnostic("assay.dilution.id.invalid", "transferDevice.deviceRef", "Transfer device ref must be non-empty."));
  normalizeVolume(input.transferDevice.minimumVolume, "transferDevice.minimumVolume", diagnostics);
  normalizeVolume(input.transferDevice.maximumVolume, "transferDevice.maximumVolume", diagnostics);
  normalizeVolume(input.transferDevice.increment, "transferDevice.increment", diagnostics);
  if (!input.source.mixed) diagnostics.push(diagnostic("assay.dilution.source.unmixed", "source.mixed", "Quantitative transfer requires a mixed source."));
  validateTargetGroups(input.targetGroups, input.transferDevice.channels, diagnostics);

  if (input.series.kind === "factor") {
    const factor = parsePositive(input.series.factor, "series.factor", diagnostics);
    if (factor && compareRational(factor, ONE) <= 0) {
      diagnostics.push(diagnostic("assay.dilution.factor.invalid", "series.factor", "A dilution factor must be greater than one."));
    }
    if (!Number.isSafeInteger(input.series.pointCount) || input.series.pointCount <= 0 || input.series.pointCount !== input.targetGroups.length) {
      diagnostics.push(diagnostic("assay.dilution.point-count.invalid", "series.pointCount", "Point count must be a positive safe integer matching targetGroups."));
    }
  } else {
    if (input.series.concentrations.length !== input.targetGroups.length || input.series.concentrations.length === 0) {
      diagnostics.push(diagnostic("assay.dilution.targets.invalid", "series.concentrations", "Explicit concentrations must match the non-empty target group list."));
    }
    input.series.concentrations.forEach((target, index) =>
      normalizeConcentration(target, `series.concentrations[${index}]`, diagnostics, true));
    if (input.series.tolerance.kind === "absolute") {
      normalizeConcentration(input.series.tolerance.value, "series.tolerance.value", diagnostics, true);
    } else {
      const percent = parsePositive(input.series.tolerance.percent, "series.tolerance.percent", diagnostics);
      if (percent && compareRational(percent, ONE_HUNDRED) > 0) {
        diagnostics.push(diagnostic("assay.dilution.targets.invalid", "series.tolerance.percent", "Relative tolerance cannot exceed 100 percent."));
      }
    }
  }

  if (input.volumePolicy.kind === "fixed") {
    normalizeVolume(input.volumePolicy.transferVolume, "volumePolicy.transferVolume", diagnostics);
    normalizeVolume(input.volumePolicy.diluentVolume, "volumePolicy.diluentVolume", diagnostics);
  }
  normalizeVolume(input.volumePolicy.finalVolume, "volumePolicy.finalVolume", diagnostics);

  if (input.mixingPolicy.kind !== "mix-each-point") {
    diagnostics.push(diagnostic("assay.dilution.mixing.required", "mixingPolicy", "Every destination must be mixed before quantitative transfer-out."));
  } else if (!Number.isSafeInteger(input.mixingPolicy.cycles) || input.mixingPolicy.cycles <= 0) {
    diagnostics.push(diagnostic("assay.dilution.mixing.required", "mixingPolicy.cycles", "Mix cycles must be a positive safe integer."));
  }
  if (input.discardPolicy.kind === "discard-final-transfer") {
    normalizeVolume(input.discardPolicy.volume, "discardPolicy.volume", diagnostics);
  }
  if (input.rounding.mode === "decimal-places"
    && (!Number.isSafeInteger(input.rounding.decimalPlaces) || input.rounding.decimalPlaces < 0)) {
    diagnostics.push(diagnostic("assay.dilution.rounding.invalid", "rounding.decimalPlaces", "Decimal places must be a non-negative safe integer."));
  }
  return diagnostics;
};

interface ComputedPoint {
  requested: Rational;
  requestedValue: string;
  achieved: Rational;
  achievedValue: string;
  sourceConcentration: Rational;
  sourceConcentrationValue: string;
  transfer: Rational;
  transferValue: string;
  diluent: Rational;
  diluentValue: string;
  final: Rational;
  finalValue: string;
  roundingApplied: boolean;
}

const format = (
  value: Rational,
  input: SerialDilutionInput,
  path: string,
  diagnostics: DilutionDiagnostic[],
): { value: string; rounded: boolean } | null => {
  try {
    return formatRational(value, input.rounding);
  } catch (error) {
    diagnostics.push(diagnostic(
      "assay.dilution.rounding.required",
      path,
      error instanceof Error ? error.message : "An explicit rounding policy is required.",
    ));
    return null;
  }
};

const isWithinTargetTolerance = (
  achieved: Rational,
  target: Rational,
  input: SerialDilutionInput,
): boolean => {
  if (input.series.kind !== "targets") return compareRational(achieved, target) === 0;
  const delta = absRational(subtractRational(achieved, target));
  if (input.series.tolerance.kind === "absolute") {
    const tolerance = decimalToRational(convertQuantity(input.series.tolerance.value, "uM").value);
    return compareRational(delta, tolerance) <= 0;
  }
  if (compareRational(target, ZERO) === 0) return compareRational(delta, ZERO) === 0;
  const relativePercent = multiplyRational(divideRational(delta, target), ONE_HUNDRED);
  return compareRational(relativePercent, decimalToRational(input.series.tolerance.percent)) <= 0;
};

const analyteAmount = (concentration: Rational, volume: Rational): Rational =>
  divideRational(multiplyRational(concentration, volume), MICROMOLAR_MICROLITER_PER_MICROMOLE);

const buildTransferGraph = (
  input: SerialDilutionInput,
  points: readonly ComputedPoint[],
): DilutionTransferGraph => {
  const steps: DilutionTransferStep[] = [];
  let order = 0;
  for (const [pointIndex, group] of input.targetGroups.entries()) {
    const common = {
      orientation: group.targets[0].orientation,
      channelCount: group.targets[0].channelCount,
      deviceRef: input.transferDevice.deviceRef,
    } as const;
    steps.push({
      id: `${input.planId}:point-${pointIndex + 1}:diluent`, order: order++, kind: "add-diluent", ...common,
      mappings: group.targets.map((target) => ({
        sourceId: input.diluent.id, targetId: target.targetId,
        volume: quantity(points[pointIndex].diluentValue, "uL"), channelIndex: target.channelIndex,
      })),
    });
    const previous = pointIndex === 0 ? null : input.targetGroups[pointIndex - 1];
    steps.push({
      id: `${input.planId}:point-${pointIndex + 1}:transfer`, order: order++, kind: "transfer", ...common,
      mappings: group.targets.map((target) => ({
        sourceId: previous?.targets.find(({ channelIndex }) => channelIndex === target.channelIndex)?.targetId ?? input.source.id,
        targetId: target.targetId, volume: quantity(points[pointIndex].transferValue, "uL"), channelIndex: target.channelIndex,
      })),
    });
    steps.push({
      id: `${input.planId}:point-${pointIndex + 1}:mix`, order: order++, kind: "mix", ...common,
      mappings: group.targets.map((target) => ({ targetId: target.targetId, channelIndex: target.channelIndex })),
      mixCycles: input.mixingPolicy.kind === "mix-each-point" ? input.mixingPolicy.cycles : undefined,
    });
  }
  if (input.discardPolicy.kind === "discard-final-transfer") {
    const lastGroup = input.targetGroups.at(-1)!;
    const discardVolume = convertQuantity(input.discardPolicy.volume, "uL");
    steps.push({
      id: `${input.planId}:final-discard`, order: order++, kind: "discard",
      orientation: lastGroup.targets[0].orientation,
      channelCount: lastGroup.targets[0].channelCount,
      deviceRef: input.transferDevice.deviceRef,
      mappings: lastGroup.targets.map((target) => ({
        sourceId: target.targetId, targetId: "discard", volume: discardVolume, channelIndex: target.channelIndex,
      })),
    });
  }
  const edges: DilutionTransferGraph["edges"] = steps.slice(1).map((step, index) => ({
    id: `${input.planId}:sequence-${index + 1}`, from: steps[index].id, to: step.id, kind: "sequence" as const,
  }));
  for (const step of steps.filter(({ kind }) => kind === "transfer" || kind === "discard")) {
    for (const mapping of step.mappings) {
      edges.push({
        id: `${step.id}:channel-${mapping.channelIndex}`,
        from: mapping.sourceId!,
        to: mapping.targetId,
        kind: "liquid-transfer",
      });
    }
  }
  return { planId: input.planId, steps, edges };
};

export const projectDilutionTransferGraph = (plan: SerialDilutionPlan): DilutionTransferGraph =>
  structuredClone(plan.transferGraph);

export const generateSerialDilutionPlan = (input: SerialDilutionInput): GenerateSerialDilutionResult => {
  const diagnostics = validateSerialDilutionInput(input);
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const sourceConcentration = decimalToRational(convertQuantity(input.source.concentration, "uM").value);
  const sourceAvailable = decimalToRational(convertQuantity(input.source.availableVolume, "uL").value);
  const diluentAvailable = decimalToRational(convertQuantity(input.diluent.availableVolume, "uL").value);
  const finalVolume = decimalToRational(convertQuantity(input.volumePolicy.finalVolume, "uL").value);
  const factor = input.series.kind === "factor" ? decimalToRational(input.series.factor) : null;
  const fixedTransfer = input.volumePolicy.kind === "fixed"
    ? decimalToRational(convertQuantity(input.volumePolicy.transferVolume, "uL").value)
    : null;
  const fixedDiluent = input.volumePolicy.kind === "fixed"
    ? decimalToRational(convertQuantity(input.volumePolicy.diluentVolume, "uL").value)
    : null;

  if (fixedTransfer && fixedDiluent
    && compareRational(addRational(fixedTransfer, fixedDiluent), finalVolume) !== 0) {
    diagnostics.push(diagnostic("assay.dilution.volume.inconsistent", "volumePolicy", "Transfer volume plus diluent volume must equal finalVolume exactly."));
  }
  if (factor && fixedTransfer
    && compareRational(divideRational(finalVolume, fixedTransfer), factor) !== 0) {
    diagnostics.push(diagnostic("assay.dilution.factor.invalid", "volumePolicy.transferVolume", "Fixed volumes do not produce the requested dilution factor."));
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const computed: ComputedPoint[] = [];
  let currentSource = sourceConcentration;
  let currentSourceValue = formatRational(sourceConcentration, { mode: "reject-non-terminating" }).value;
  for (let index = 0; index < input.targetGroups.length; index += 1) {
    const requested = factor
      ? divideRational(currentSource, factor)
      : decimalToRational(convertQuantity(input.series.kind === "targets" ? input.series.concentrations[index] : input.source.concentration, "uM").value);
    const requestedFormatted = format(requested, input, `points[${index}].requestedConcentration`, diagnostics);
    if (!requestedFormatted) continue;
    const authoritativeRequested = decimalToRational(requestedFormatted.value);
    const transferRaw = fixedTransfer ?? divideRational(multiplyRational(finalVolume, authoritativeRequested), currentSource);
    const transferFormatted = format(transferRaw, input, `points[${index}].transferVolume`, diagnostics);
    if (!transferFormatted) continue;
    const transfer = decimalToRational(transferFormatted.value);
    const diluentRaw = fixedDiluent ?? subtractRational(finalVolume, transfer);
    if (compareRational(transfer, ZERO) <= 0 || compareRational(transfer, finalVolume) >= 0 || compareRational(diluentRaw, ZERO) <= 0) {
      diagnostics.push(diagnostic("assay.dilution.transfer.infeasible", `points[${index}]`, "A serial dilution transfer and its diluent must both be positive and smaller than finalVolume."));
      continue;
    }
    const diluentFormatted = format(diluentRaw, input, `points[${index}].diluentVolume`, diagnostics);
    if (!diluentFormatted) continue;
    const diluent = decimalToRational(diluentFormatted.value);
    const achievedRaw = divideRational(multiplyRational(currentSource, transfer), finalVolume);
    const achievedFormatted = format(achievedRaw, input, `points[${index}].achievedConcentration`, diagnostics);
    if (!achievedFormatted) continue;
    const achieved = decimalToRational(achievedFormatted.value);
    if (!isWithinTargetTolerance(achieved, authoritativeRequested, input)) {
      diagnostics.push(diagnostic("assay.dilution.target.unachievable", `points[${index}]`, `Achieved ${achievedFormatted.value} uM does not meet target ${requestedFormatted.value} uM within the declared tolerance.`));
    }
    if (index > 0) {
      const comparison = compareRational(authoritativeRequested, computed[index - 1]?.requested ?? currentSource);
      const invalid = input.monotonicity === "strictly-decreasing" ? comparison >= 0
        : input.monotonicity === "non-increasing" ? comparison > 0 : false;
      if (invalid) diagnostics.push(diagnostic("assay.dilution.monotonicity.invalid", `points[${index}]`, "Requested concentrations violate the declared monotonicity policy."));
    }
    computed.push({
      requested: authoritativeRequested,
      requestedValue: requestedFormatted.value,
      achieved,
      achievedValue: achievedFormatted.value,
      sourceConcentration: currentSource,
      sourceConcentrationValue: currentSourceValue,
      transfer,
      transferValue: transferFormatted.value,
      diluent,
      diluentValue: diluentFormatted.value,
      final: finalVolume,
      finalValue: formatRational(finalVolume, { mode: "reject-non-terminating" }).value,
      roundingApplied: requestedFormatted.rounded || transferFormatted.rounded || diluentFormatted.rounded || achievedFormatted.rounded,
    });
    currentSource = achieved;
    currentSourceValue = achievedFormatted.value;
  }
  if (diagnostics.length > 0 || computed.length !== input.targetGroups.length) return { ok: false, diagnostics };

  const replicateCount = input.targetGroups[0].targets.length;
  const deviceMinimum = decimalToRational(convertQuantity(input.transferDevice.minimumVolume, "uL").value);
  const deviceMaximum = decimalToRational(convertQuantity(input.transferDevice.maximumVolume, "uL").value);
  const deviceIncrement = decimalToRational(convertQuantity(input.transferDevice.increment, "uL").value);
  if (compareRational(deviceMinimum, deviceMaximum) > 0) {
    diagnostics.push(diagnostic("assay.dilution.transfer.device-incompatible", "transferDevice", "Transfer device minimum cannot exceed its maximum."));
  }
  const validateDeviceVolume = (value: Rational, path: string): void => {
    const increments = divideRational(value, deviceIncrement);
    if (compareRational(value, deviceMinimum) < 0
      || compareRational(value, deviceMaximum) > 0
      || increments.denominator !== 1n) {
      diagnostics.push(diagnostic("assay.dilution.transfer.device-incompatible", path, "Planned volume is outside the selected device range or increment."));
    }
  };
  computed.forEach((point, index) => {
    validateDeviceVolume(point.transfer, `points[${index}].transferVolume`);
    validateDeviceVolume(point.diluent, `points[${index}].diluentVolume`);
  });
  const firstSourceNeeded = multiplyRational(computed[0].transfer, rational(BigInt(replicateCount)));
  const totalDiluentNeeded = computed.reduce(
    (total, point) => addRational(total, multiplyRational(point.diluent, rational(BigInt(replicateCount)))),
    ZERO,
  );
  if (compareRational(firstSourceNeeded, sourceAvailable) > 0) {
    diagnostics.push(diagnostic("assay.dilution.volume.insufficient-source", "source.availableVolume", "Source volume is insufficient for the first replicated transfer."));
  }
  if (compareRational(totalDiluentNeeded, diluentAvailable) > 0) {
    diagnostics.push(diagnostic("assay.dilution.volume.insufficient-diluent", "diluent.availableVolume", "Diluent volume is insufficient for all target wells."));
  }
  const finalDiscard = input.discardPolicy.kind === "discard-final-transfer"
    ? decimalToRational(convertQuantity(input.discardPolicy.volume, "uL").value)
    : ZERO;
  if (input.discardPolicy.kind === "discard-final-transfer") validateDeviceVolume(finalDiscard, "discardPolicy.volume");
  if (compareRational(finalDiscard, computed.at(-1)!.final) >= 0) {
    diagnostics.push(diagnostic("assay.dilution.discard.invalid", "discardPolicy.volume", "Final discard must be smaller than the final mixed volume."));
  }
  if (input.discardPolicy.kind === "discard-final-transfer"
    && compareRational(finalDiscard, computed.at(-1)!.transfer) !== 0) {
    diagnostics.push(diagnostic("assay.dilution.discard.invalid", "discardPolicy.volume", "discard-final-transfer must match the final point transfer volume exactly."));
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const points = computed.map((point, pointIndex) => {
    const outgoing = pointIndex < computed.length - 1 ? computed[pointIndex + 1].transfer : finalDiscard;
    const retained = subtractRational(point.final, outgoing);
    const incomingAnalyte = analyteAmount(point.sourceConcentration, point.transfer);
    const outgoingAnalyte = analyteAmount(point.achieved, outgoing);
    const retainedAnalyte = analyteAmount(point.achieved, retained);
    const targets: DilutionPlannedTarget[] = input.targetGroups[pointIndex].targets.map((mapping) => {
      const previous = pointIndex === 0 ? null : input.targetGroups[pointIndex - 1];
      const sourceId = previous?.targets.find(({ channelIndex }) => channelIndex === mapping.channelIndex)?.targetId ?? input.source.id;
      const trace: DilutionFormulaTrace = {
        sourceId,
        targetId: mapping.targetId,
        concentrationBasis: "amount-per-volume",
        sourceConcentration: quantity(point.sourceConcentrationValue, "uM"),
        requestedConcentration: quantity(point.requestedValue, "uM"),
        achievedConcentration: quantity(point.achievedValue, "uM"),
        transferVolume: quantity(point.transferValue, "uL"),
        diluentVolume: quantity(point.diluentValue, "uL"),
        mixedVolume: quantity(point.finalValue, "uL"),
        retainedVolume: quantity(formatRational(retained, input.rounding).value, "uL"),
        incomingAnalyteAmount: quantity(formatRational(incomingAnalyte, input.rounding).value, "umol"),
        mixedAnalyteAmount: quantity(formatRational(incomingAnalyte, input.rounding).value, "umol"),
        retainedAnalyteAmount: quantity(formatRational(retainedAnalyte, input.rounding).value, "umol"),
        outgoingAnalyteAmount: quantity(formatRational(outgoingAnalyte, input.rounding).value, "umol"),
        equations: [
          {
            label: "mixed volume",
            expression: `${point.transferValue} uL + ${point.diluentValue} uL`,
            result: quantity(point.finalValue, "uL"),
          },
          {
            label: "incoming analyte",
            expression: `(${point.sourceConcentrationValue} uM * ${point.transferValue} uL) / 1000000`,
            result: quantity(formatRational(incomingAnalyte, input.rounding).value, "umol"),
          },
          {
            label: "final concentration",
            expression: `(${point.sourceConcentrationValue} uM * ${point.transferValue} uL) / ${point.finalValue} uL`,
            result: quantity(point.achievedValue, "uM"),
          },
          {
            label: "terminal volume",
            expression: `${point.finalValue} uL - ${formatRational(outgoing, input.rounding).value} uL`,
            result: quantity(formatRational(retained, input.rounding).value, "uL"),
          },
        ],
        roundingPolicy: structuredClone(input.rounding),
        roundingApplied: point.roundingApplied,
      };
      return {
        mapping: structuredClone(mapping), sourceId,
        requestedConcentration: trace.requestedConcentration,
        achievedConcentration: trace.achievedConcentration,
        transferVolume: trace.transferVolume,
        diluentVolume: trace.diluentVolume,
        mixedVolume: trace.mixedVolume,
        retainedVolume: trace.retainedVolume,
        formulaTrace: trace,
      };
    });
    return { index: pointIndex, id: input.targetGroups[pointIndex].id, targets };
  });

  const terminalVolume = points.flatMap(({ targets }) => targets).reduce(
    (sum, target) => addRational(sum, decimalToRational(target.retainedVolume.value)), ZERO,
  );
  const terminalAnalyte = points.flatMap(({ targets }) => targets).reduce(
    (sum, target) => addRational(sum, decimalToRational(target.formulaTrace.retainedAnalyteAmount.value)), ZERO,
  );
  const discardedVolume = multiplyRational(finalDiscard, rational(BigInt(replicateCount)));
  const discardedAnalyte = multiplyRational(
    analyteAmount(computed.at(-1)!.achieved, finalDiscard), rational(BigInt(replicateCount)),
  );
  const sourceAnalyteRemoved = multiplyRational(
    analyteAmount(sourceConcentration, computed[0].transfer), rational(BigInt(replicateCount)),
  );
  const roundingResidual = subtractRational(sourceAnalyteRemoved, addRational(terminalAnalyte, discardedAnalyte));
  const conservation: DilutionConservationSummary = {
    sourceVolumeRemoved: quantity(formatRational(firstSourceNeeded, input.rounding).value, "uL"),
    diluentVolumeAdded: quantity(formatRational(totalDiluentNeeded, input.rounding).value, "uL"),
    discardedVolume: quantity(formatRational(discardedVolume, input.rounding).value, "uL"),
    terminalVolume: quantity(formatRational(terminalVolume, input.rounding).value, "uL"),
    sourceAnalyteRemoved: quantity(formatRational(sourceAnalyteRemoved, input.rounding).value, "umol"),
    discardedAnalyte: quantity(formatRational(discardedAnalyte, input.rounding).value, "umol"),
    terminalAnalyte: quantity(formatRational(terminalAnalyte, input.rounding).value, "umol"),
    roundingResidual: quantity(formatRational(roundingResidual, input.rounding).value, "umol"),
  };
  if (!computed.some(({ roundingApplied }) => roundingApplied)
    && compareRational(addRational(terminalAnalyte, discardedAnalyte), sourceAnalyteRemoved) !== 0) {
    return { ok: false, diagnostics: [diagnostic("assay.dilution.target.unachievable", "conservation", "Internal analyte conservation check failed after serialization.")] };
  }
  const transferGraph = buildTransferGraph(input, computed);
  const plan: SerialDilutionPlan = {
    schema: serialDilutionPlanSchema,
    schemaVersion: serialDilutionPlanSchemaVersion,
    id: input.planId,
    concentrationBasis: "amount-per-volume",
    concentrationUnit: "uM",
    volumeUnit: "uL",
    points,
    transferGraph,
    conservation,
    roundingPolicy: structuredClone(input.rounding),
    assumptions: [
      "The stock source is homogeneous because source.mixed is true.",
      "Diluent contributes zero analyte.",
      "Transfer-out removes analyte at the mixed source concentration.",
    ],
    limitations: [
      "No stochastic pipette error, carryover quantity, air-gap, reverse-pipetting, viscosity, or protocol threshold is modeled.",
    ],
  };
  return { ok: true, plan };
};
