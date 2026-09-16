import {
  absRational,
  addRational,
  compareRational,
  decimalToRational,
  divideRational,
  multiplyRational,
  rational,
  subtractRational,
  type Rational,
} from "../dilution/exact";
import type { AssayDefinition, ReplicateGroupDefinition } from "../types";
import {
  coefficientOfVariation,
  formatQcRational,
  linearRegressionSlope,
  meanRational,
  medianRational,
  rangeRational,
  standardDeviation,
} from "./statistics";
import type {
  AssayObservationSet,
  AssayQcEvaluation,
  AssayQcFormulaTrace,
  AssayQcRule,
  AssayQcRuleResult,
  AssayQcRuleSet,
  AssayQcStatus,
  AssayQcWellResult,
  AssayReplicateSummary,
  PlateObservation,
} from "./types";
import {
  validateAssayObservationSet,
  validateAssayQcEvaluation,
  validateAssayQcRuleSet,
} from "./validation";

export class AssayQcEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssayQcEvaluationError";
  }
}

interface WorkingObservation {
  observation: PlateObservation;
  coordinate: string;
  raw: Rational;
  working?: Rational;
  normalized?: Rational;
  flags: string[];
}

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();

const overallStatus = (statuses: readonly AssayQcStatus[]): AssayQcStatus => {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  if (statuses.includes("indeterminate")) return "indeterminate";
  return "pass";
};

const violationStatus = (rule: AssayQcRule): "warn" | "fail" => rule.violationSeverity;

const traceRounding = (ruleSet: AssayQcRuleSet): string =>
  `${ruleSet.roundingPolicy.decimalPlaces} decimal places, ${ruleSet.roundingPolicy.tieBreaking}`;

const aggregate = (
  values: readonly Rational[],
  method: "mean" | "median",
): Rational => method === "mean" ? meanRational(values) : medianRational(values);

const format = (value: Rational, ruleSet: AssayQcRuleSet): string =>
  formatQcRational(value, ruleSet.roundingPolicy);

const standardDeviationRational = (
  values: readonly Rational[],
  ruleSet: AssayQcRuleSet,
): Rational => decimalToRational(standardDeviation(values, ruleSet.roundingPolicy));

const controlWellIds = (assay: AssayDefinition, controlRef: string): string[] =>
  assay.plate.wells
    .filter((well) => well.controlRef === controlRef)
    .map(({ id }) => id);

const groupValues = (
  group: ReplicateGroupDefinition,
  working: ReadonlyMap<string, WorkingObservation>,
): Array<{ wellId: string; value: Rational }> =>
  group.memberWellIds.flatMap((wellId) => {
    const value = working.get(wellId)?.working;
    return value ? [{ wellId, value }] : [];
  });

const controlValues = (
  assay: AssayDefinition,
  controlRef: string,
  working: ReadonlyMap<string, WorkingObservation>,
): Array<{ wellId: string; value: Rational }> =>
  controlWellIds(assay, controlRef).flatMap((wellId) => {
    const value = working.get(wellId)?.working;
    return value ? [{ wellId, value }] : [];
  });

const createTrace = (
  traces: AssayQcFormulaTrace[],
  ruleSet: AssayQcRuleSet,
  id: string,
  formula: string,
  inputs: ReadonlyArray<{ ref: string; value: Rational }>,
  result: Rational,
  unit: string,
): string => {
  const trace: AssayQcFormulaTrace = {
    id,
    policySourceRef: ruleSet.policySource.id,
    formula,
    inputRefs: inputs.map(({ ref }) => ref),
    inputValues: inputs.map(({ value }) => format(value, ruleSet)),
    result: format(result, ruleSet),
    unit,
    rounding: traceRounding(ruleSet),
  };
  traces.push(trace);
  return trace.id;
};

const indeterminate = (
  rule: AssayQcRule,
  summary: string,
  affectedWellIds: readonly string[] = [],
  limitations: readonly string[] = [],
): AssayQcRuleResult => ({
  ruleId: rule.id,
  ruleType: rule.type,
  title: rule.title,
  status: "indeterminate",
  summary,
  affectedWellIds: unique(affectedWellIds),
  formulaTraceRefs: [],
  limitations: unique([
    "No pass was fabricated because the rule preconditions were not satisfied.",
    ...limitations,
  ]),
});

const evaluateReplicateSummaries = (
  assay: AssayDefinition,
  working: ReadonlyMap<string, WorkingObservation>,
  ruleSet: AssayQcRuleSet,
  traces: AssayQcFormulaTrace[],
  unit: string,
): AssayReplicateSummary[] => assay.replicateGroups.map((group) => {
  const entries = groupValues(group, working);
  const formulaTraceRefs: string[] = [];
  const limitations: string[] = [];
  if (entries.length < group.minimumCount) {
    return {
      replicateGroupRef: group.id,
      memberWellIds: [...group.memberWellIds],
      observedWellIds: entries.map(({ wellId }) => wellId),
      aggregation: group.aggregation,
      ...(group.variabilityMetric ? { variabilityMetric: group.variabilityMetric } : {}),
      unit,
      ...(group.variabilityMetric ? {
        variabilityUnit: group.variabilityMetric === "cv" ? "%" : unit,
      } : {}),
      status: "indeterminate",
      formulaTraceRefs,
      limitations: [
        `Expected at least ${group.minimumCount} reviewed observations; received ${entries.length}.`,
      ],
    };
  }
  const values = entries.map(({ value }) => value);
  let aggregateValue: string | undefined;
  if (group.aggregation !== "none") {
    const result = aggregate(values, group.aggregation);
    aggregateValue = format(result, ruleSet);
    formulaTraceRefs.push(createTrace(
      traces,
      ruleSet,
      `trace.replicate.${group.id}.${group.aggregation}`,
      group.aggregation === "mean" ? "sum(x_i) / n" : "median(sorted(x_i))",
      entries.map(({ wellId, value }) => ({ ref: wellId, value })),
      result,
      unit,
    ));
  }
  let variabilityValue: string | undefined;
  if (group.variabilityMetric) {
    try {
      const result = group.variabilityMetric === "sd"
        ? standardDeviationRational(values, ruleSet)
        : group.variabilityMetric === "cv"
          ? decimalToRational(coefficientOfVariation(values, ruleSet.roundingPolicy))
          : rangeRational(values);
      variabilityValue = format(result, ruleSet);
      formulaTraceRefs.push(createTrace(
        traces,
        ruleSet,
        `trace.replicate.${group.id}.${group.variabilityMetric}`,
        group.variabilityMetric === "sd"
          ? "sqrt(sum((x_i - mean)^2) / (n - 1))"
          : group.variabilityMetric === "cv"
            ? "sample_sd / abs(mean) * 100"
            : "max(x_i) - min(x_i)",
        entries.map(({ wellId, value }) => ({ ref: wellId, value })),
        result,
        group.variabilityMetric === "cv" ? "%" : unit,
      ));
    } catch (error) {
      limitations.push(error instanceof Error ? error.message : "Variability is indeterminate.");
    }
  }
  return {
    replicateGroupRef: group.id,
    memberWellIds: [...group.memberWellIds],
    observedWellIds: entries.map(({ wellId }) => wellId),
    aggregation: group.aggregation,
    ...(aggregateValue !== undefined ? { aggregateValue } : {}),
    ...(group.variabilityMetric ? { variabilityMetric: group.variabilityMetric } : {}),
    ...(variabilityValue !== undefined ? { variabilityValue } : {}),
    unit,
    ...(group.variabilityMetric ? {
      variabilityUnit: group.variabilityMetric === "cv" ? "%" : unit,
    } : {}),
    status: limitations.length === 0 ? "complete" : "indeterminate",
    formulaTraceRefs,
    limitations,
  };
});

const evaluateRule = (
  rule: AssayQcRule,
  assay: AssayDefinition,
  working: ReadonlyMap<string, WorkingObservation>,
  ruleSet: AssayQcRuleSet,
  traces: AssayQcFormulaTrace[],
  outlierFlags: AssayQcEvaluation["outlierFlags"],
  unit: string,
): AssayQcRuleResult => {
  if (rule.type === "replicate-variability") {
    const groups = rule.replicateGroupRefs.map((groupRef) =>
      assay.replicateGroups.find(({ id }) => id === groupRef)).filter(Boolean) as ReplicateGroupDefinition[];
    const results: Array<{ groupRef: string; value: Rational; wellIds: string[]; traceRef: string }> = [];
    for (const group of groups) {
      const entries = groupValues(group, working);
      if (entries.length < Math.max(group.minimumCount, rule.metric === "sd" || rule.metric === "cv" ? 2 : 1)) {
        return indeterminate(
          rule,
          `Replicate rule ${rule.id} lacks enough reviewed values for ${group.id}.`,
          group.memberWellIds,
        );
      }
      try {
        const values = entries.map(({ value }) => value);
        const value = rule.metric === "sd"
          ? standardDeviationRational(values, ruleSet)
          : rule.metric === "cv"
            ? decimalToRational(coefficientOfVariation(values, ruleSet.roundingPolicy))
            : rangeRational(values);
        const traceRef = createTrace(
          traces,
          ruleSet,
          `trace.rule.${rule.id}.${group.id}`,
          rule.metric === "sd"
            ? "sqrt(sum((x_i - mean)^2) / (n - 1))"
            : rule.metric === "cv"
              ? "sample_sd / abs(mean) * 100"
              : "max(x_i) - min(x_i)",
          entries.map(({ wellId, value: input }) => ({ ref: wellId, value: input })),
          value,
          rule.metric === "cv" ? "%" : unit,
        );
        results.push({ groupRef: group.id, value, wellIds: entries.map(({ wellId }) => wellId), traceRef });
      } catch (error) {
        return indeterminate(
          rule,
          error instanceof Error ? error.message : "Replicate variability is indeterminate.",
          group.memberWellIds,
        );
      }
    }
    const maximum = results.reduce((current, result) =>
      compareRational(result.value, current.value) > 0 ? result : current);
    const threshold = decimalToRational(rule.maximum);
    const passed = compareRational(maximum.value, threshold) <= 0;
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      title: rule.title,
      status: passed ? "pass" : violationStatus(rule),
      summary: `${rule.metric.toUpperCase()} maximum ${format(maximum.value, ruleSet)} ${rule.metric === "cv" ? "%" : unit} ${passed ? "meets" : "exceeds"} the explicit ${rule.maximum} threshold.`,
      metricValue: format(maximum.value, ruleSet),
      unit: rule.metric === "cv" ? "%" : unit,
      threshold: rule.maximum,
      affectedWellIds: unique(results.flatMap(({ wellIds }) => wellIds)),
      formulaTraceRefs: results.map(({ traceRef }) => traceRef),
      limitations: [],
    };
  }

  if (rule.type === "control-direction" || rule.type === "signal-window" || rule.type === "z-prime") {
    const high = controlValues(assay, rule.highControlRef, working);
    const low = controlValues(assay, rule.lowControlRef, working);
    const minimumCount = rule.type === "z-prime" ? rule.minimumReplicatesPerControl : 1;
    if (high.length < minimumCount || low.length < minimumCount) {
      return indeterminate(
        rule,
        `${rule.title} requires at least ${minimumCount} reviewed observation(s) for each named control.`,
        [...high.map(({ wellId }) => wellId), ...low.map(({ wellId }) => wellId)],
      );
    }
    const highMean = meanRational(high.map(({ value }) => value));
    const lowMean = meanRational(low.map(({ value }) => value));
    const difference = subtractRational(highMean, lowMean);
    if (rule.type === "z-prime") {
      if (difference.numerator === 0n) return indeterminate(
        rule,
        "Z-prime is indeterminate because control means are equal.",
        [...high.map(({ wellId }) => wellId), ...low.map(({ wellId }) => wellId)],
      );
      const highSd = standardDeviationRational(high.map(({ value }) => value), ruleSet);
      const lowSd = standardDeviationRational(low.map(({ value }) => value), ruleSet);
      const zPrime = subtractRational(
        rational(1n),
        divideRational(
          multiplyRational(rational(3n), addRational(highSd, lowSd)),
          absRational(difference),
        ),
      );
      const traceRef = createTrace(
        traces,
        ruleSet,
        `trace.rule.${rule.id}`,
        "1 - 3 * (sd_high + sd_low) / abs(mean_high - mean_low)",
        [
          { ref: `${rule.highControlRef}:mean`, value: highMean },
          { ref: `${rule.highControlRef}:sd`, value: highSd },
          { ref: `${rule.lowControlRef}:mean`, value: lowMean },
          { ref: `${rule.lowControlRef}:sd`, value: lowSd },
        ],
        zPrime,
        "1",
      );
      const threshold = decimalToRational(rule.minimum);
      const passed = compareRational(zPrime, threshold) >= 0;
      return {
        ruleId: rule.id,
        ruleType: rule.type,
        title: rule.title,
        status: passed ? "pass" : violationStatus(rule),
        summary: `Z-prime ${format(zPrime, ruleSet)} ${passed ? "meets" : "is below"} the explicitly supplied ${rule.minimum} threshold.`,
        metricValue: format(zPrime, ruleSet),
        unit: "1",
        threshold: rule.minimum,
        affectedWellIds: unique([...high.map(({ wellId }) => wellId), ...low.map(({ wellId }) => wellId)]),
        formulaTraceRefs: [traceRef],
        limitations: ["Z-prime is evaluated only because this versioned rule set explicitly enables it."],
      };
    }
    const thresholdText = rule.type === "control-direction" ? rule.minimumDifference : rule.minimum;
    const threshold = decimalToRational(thresholdText);
    const traceRef = createTrace(
      traces,
      ruleSet,
      `trace.rule.${rule.id}`,
      "mean(high control) - mean(low control)",
      [
        { ref: `${rule.highControlRef}:mean`, value: highMean },
        { ref: `${rule.lowControlRef}:mean`, value: lowMean },
      ],
      difference,
      unit,
    );
    const passed = compareRational(difference, threshold) >= 0;
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      title: rule.title,
      status: passed ? "pass" : violationStatus(rule),
      summary: `Control separation ${format(difference, ruleSet)} ${unit} ${passed ? "meets" : "is below"} the explicit ${thresholdText} threshold.`,
      metricValue: format(difference, ruleSet),
      unit,
      threshold: thresholdText,
      affectedWellIds: unique([...high.map(({ wellId }) => wellId), ...low.map(({ wellId }) => wellId)]),
      formulaTraceRefs: [traceRef],
      limitations: [],
    };
  }

  if (rule.type === "edge-effect") {
    const edge = rule.edgeWellIds.flatMap((wellId) => {
      const value = working.get(wellId)?.working;
      return value ? [{ wellId, value }] : [];
    });
    const interior = rule.interiorWellIds.flatMap((wellId) => {
      const value = working.get(wellId)?.working;
      return value ? [{ wellId, value }] : [];
    });
    if (edge.length !== rule.edgeWellIds.length || interior.length !== rule.interiorWellIds.length) {
      return indeterminate(rule, "Edge-effect comparison requires a reviewed value for every explicitly listed edge and interior well.", [...rule.edgeWellIds, ...rule.interiorWellIds]);
    }
    const edgeMean = meanRational(edge.map(({ value }) => value));
    const interiorMean = meanRational(interior.map(({ value }) => value));
    const difference = absRational(subtractRational(edgeMean, interiorMean));
    const traceRef = createTrace(
      traces,
      ruleSet,
      `trace.rule.${rule.id}`,
      "abs(mean(explicit edge wells) - mean(explicit interior wells))",
      [
        { ref: "edge:mean", value: edgeMean },
        { ref: "interior:mean", value: interiorMean },
      ],
      difference,
      unit,
    );
    const passed = compareRational(difference, decimalToRational(rule.maximumAbsoluteDifference)) <= 0;
    return {
      ruleId: rule.id,
      ruleType: rule.type,
      title: rule.title,
      status: passed ? "pass" : violationStatus(rule),
      summary: `Edge/interior mean difference ${format(difference, ruleSet)} ${unit} ${passed ? "meets" : "exceeds"} the explicit ${rule.maximumAbsoluteDifference} threshold.`,
      metricValue: format(difference, ruleSet),
      unit,
      threshold: rule.maximumAbsoluteDifference,
      affectedWellIds: unique([...rule.edgeWellIds, ...rule.interiorWellIds]),
      formulaTraceRefs: [traceRef],
      limitations: ["Only the well sets explicitly named by the rule are compared."],
    };
  }

  if (rule.type === "drift") {
    const wellsById = new Map(assay.plate.wells.map((well) => [well.id, well]));
    const points = rule.wellIds.flatMap((wellId) => {
      const value = working.get(wellId)?.working;
      const coordinate = wellsById.get(wellId)?.coordinate;
      if (!value || !coordinate) return [];
      const row = coordinate.charCodeAt(0) - "A".charCodeAt(0) + 1;
      const column = Number.parseInt(coordinate.slice(1), 10);
      return [{ wellId, x: rational(BigInt(rule.axis === "row" ? row : column)), y: value }];
    });
    if (points.length !== rule.wellIds.length) return indeterminate(
      rule,
      "Drift evaluation requires a reviewed value for every explicitly listed well.",
      rule.wellIds,
    );
    try {
      const slope = linearRegressionSlope(points);
      const absoluteSlope = absRational(slope);
      const traceRef = createTrace(
        traces,
        ruleSet,
        `trace.rule.${rule.id}`,
        "sum((position_i - mean_position) * (signal_i - mean_signal)) / sum((position_i - mean_position)^2)",
        points.flatMap(({ wellId, x, y }) => [
          { ref: `${wellId}:position`, value: x },
          { ref: `${wellId}:signal`, value: y },
        ]),
        absoluteSlope,
        `${unit}/plate-${rule.axis}`,
      );
      const passed = compareRational(absoluteSlope, decimalToRational(rule.maximumAbsoluteSlope)) <= 0;
      return {
        ruleId: rule.id,
        ruleType: rule.type,
        title: rule.title,
        status: passed ? "pass" : violationStatus(rule),
        summary: `Absolute ${rule.axis} slope ${format(absoluteSlope, ruleSet)} ${unit}/position ${passed ? "meets" : "exceeds"} the explicit ${rule.maximumAbsoluteSlope} threshold.`,
        metricValue: format(absoluteSlope, ruleSet),
        unit: `${unit}/plate-${rule.axis}`,
        threshold: rule.maximumAbsoluteSlope,
        affectedWellIds: [...rule.wellIds],
        formulaTraceRefs: [traceRef],
        limitations: ["This is a deterministic linear trend warning over explicitly named wells, not a physical drift model."],
      };
    } catch (error) {
      return indeterminate(
        rule,
        error instanceof Error ? error.message : "Drift is indeterminate.",
        rule.wellIds,
      );
    }
  }

  const affectedWellIds: string[] = [];
  const formulaTraceRefs: string[] = [];
  for (const groupRef of rule.replicateGroupRefs) {
    const group = assay.replicateGroups.find(({ id }) => id === groupRef);
    if (!group) return indeterminate(rule, `Replicate group ${groupRef} is missing.`);
    const entries = groupValues(group, working);
    if (entries.length < group.minimumCount) return indeterminate(
      rule,
      `Outlier flagging requires at least ${group.minimumCount} reviewed values for ${groupRef}.`,
      group.memberWellIds,
    );
    const mean = meanRational(entries.map(({ value }) => value));
    formulaTraceRefs.push(createTrace(
      traces,
      ruleSet,
      `trace.rule.${rule.id}.${groupRef}.mean`,
      "sum(x_i) / n",
      entries.map(({ wellId, value }) => ({ ref: wellId, value })),
      mean,
      unit,
    ));
    entries.forEach(({ wellId, value }) => {
      const deviation = absRational(subtractRational(value, mean));
      if (compareRational(deviation, decimalToRational(rule.maximumAbsoluteDeviation)) > 0) {
        affectedWellIds.push(wellId);
        working.get(wellId)?.flags.push(`Outlier flag: ${rule.id}`);
        outlierFlags.push({
          ruleId: rule.id,
          wellId,
          reason: `Absolute deviation ${format(deviation, ruleSet)} ${unit} exceeds explicit threshold ${rule.maximumAbsoluteDeviation} ${unit}.`,
        });
      }
    });
  }
  const passed = affectedWellIds.length === 0;
  return {
    ruleId: rule.id,
    ruleType: rule.type,
    title: rule.title,
    status: passed ? "pass" : violationStatus(rule),
    summary: passed
      ? "No reviewed replicate value exceeded the explicit deviation threshold."
      : `${affectedWellIds.length} value(s) were flagged for review; none were removed.`,
    threshold: rule.maximumAbsoluteDeviation,
    unit,
    affectedWellIds: unique(affectedWellIds),
    formulaTraceRefs,
    limitations: ["Flags never remove observations or change replicate aggregates automatically."],
  };
};

export const evaluateAssayQc = (
  assay: AssayDefinition,
  observationInput: unknown,
  ruleSetInput: unknown,
): AssayQcEvaluation => {
  const observationValidation = validateAssayObservationSet(observationInput, assay);
  if (!observationValidation.ok) throw new AssayQcEvaluationError(
    observationValidation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "),
  );
  const ruleSetValidation = validateAssayQcRuleSet(ruleSetInput, assay);
  if (!ruleSetValidation.ok) throw new AssayQcEvaluationError(
    ruleSetValidation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "),
  );
  const observationSet = observationValidation.value;
  const ruleSet = ruleSetValidation.value;
  const traces: AssayQcFormulaTrace[] = [];
  const ruleResults: AssayQcRuleResult[] = [];
  const outlierFlags: AssayQcEvaluation["outlierFlags"] = [];
  const limitations = [
    ...ruleSet.policySource.limitations,
    "QC status applies only to the supplied rule-set version, observations, and declared validity range.",
    "No observation is automatically deleted and no clinical interpretation is produced.",
  ];

  const corrections = new Map(observationSet.manualCorrections.map((correction) => [
    correction.observationId,
    correction,
  ]));
  const eligible = observationSet.observations.filter(({ reviewStatus }) =>
    reviewStatus === "accepted" || reviewStatus === "corrected");
  const byWell = new Map<string, PlateObservation[]>();
  eligible.forEach((observation) => byWell.set(
    observation.wellId,
    [...(byWell.get(observation.wellId) ?? []), observation],
  ));
  const wellsById = new Map(assay.plate.wells.map((well) => [well.id, well]));
  const working = new Map<string, WorkingObservation>();
  byWell.forEach((observations, wellId) => {
    if (observations.length !== 1) return;
    const observation = observations[0];
    const corrected = corrections.get(observation.id);
    working.set(wellId, {
      observation,
      coordinate: wellsById.get(wellId)?.coordinate ?? wellId,
      raw: decimalToRational(corrected?.acceptedValue ?? observation.rawValue),
      flags: corrected ? ["Manual correction applied"] : [],
    });
  });

  const units = unique([...working.values()].map(({ observation }) => observation.unit));
  const unit = units.length === 1 ? units[0] : "mixed-units";
  if (units.length !== 1) {
    ruleResults.push({
      ruleId: "observation-set-unit",
      ruleType: "observation-set",
      title: "Observation unit consistency",
      status: "indeterminate",
      summary: units.length === 0
        ? "No reviewed observations are available."
        : `Reviewed observations contain multiple units: ${units.join(", ")}.`,
      affectedWellIds: unique([...working.keys()]),
      formulaTraceRefs: [],
      limitations: ["Cycle 08 does not guess or convert unspecified signal-unit relationships."],
    });
  }
  const duplicateWellIds = [...byWell.entries()]
    .filter(([, observations]) => observations.length > 1)
    .map(([wellId]) => wellId);
  if (duplicateWellIds.length > 0) ruleResults.push({
    ruleId: "observation-set-duplicate-well",
    ruleType: "observation-set",
    title: "One reviewed observation per well",
    status: "indeterminate",
    summary: `${duplicateWellIds.length} well(s) have multiple reviewed observations; those wells were excluded rather than guessed.`,
    affectedWellIds: duplicateWellIds,
    formulaTraceRefs: [],
    limitations: ["Select one explicit channel/timepoint during ingestion; QC still refuses duplicate reviewed values for a well rather than guessing."],
  });

  ruleSet.requiredControls.forEach((requirement) => {
    const assigned = controlWellIds(assay, requirement.controlRef);
    const withinMaximum = requirement.maximumCount === undefined || assigned.length <= requirement.maximumCount;
    const present = assigned.length >= requirement.minimumCount && withinMaximum;
    ruleResults.push({
      ruleId: requirement.id,
      ruleType: "required-control",
      title: `Required control ${requirement.controlRef}`,
      status: present ? "pass" : "fail",
      summary: present
        ? `${assigned.length} uniquely assigned well(s) satisfy the explicit count requirement.`
        : `${assigned.length} assigned well(s) do not satisfy the explicit ${requirement.minimumCount}${requirement.maximumCount ? `-${requirement.maximumCount}` : "+"} count.`,
      affectedWellIds: assigned,
      formulaTraceRefs: [],
      limitations: [],
    });
  });

  let blankValue: Rational | undefined;
  if (units.length === 1 && ruleSet.blankCorrection) {
    const blankEntries = controlValues(assay, ruleSet.blankCorrection.controlRef, new Map(
      [...working.entries()].map(([wellId, entry]) => [wellId, { ...entry, working: entry.raw }]),
    ));
    if (blankEntries.length > 0) {
      blankValue = aggregate(blankEntries.map(({ value }) => value), ruleSet.blankCorrection.aggregation);
      createTrace(
        traces,
        ruleSet,
        "trace.blank.aggregate",
        ruleSet.blankCorrection.aggregation === "mean" ? "sum(blank_i) / n" : "median(sorted(blank_i))",
        blankEntries.map(({ wellId, value }) => ({ ref: wellId, value })),
        blankValue,
        unit,
      );
      working.forEach((entry, wellId) => {
        entry.working = subtractRational(entry.raw, blankValue!);
        createTrace(
          traces,
          ruleSet,
          `trace.blank.correct.${wellId}`,
          "reviewed_value - aggregated_blank",
          [
            { ref: entry.observation.id, value: entry.raw },
            { ref: `${ruleSet.blankCorrection!.controlRef}:blank`, value: blankValue! },
          ],
          entry.working,
          unit,
        );
      });
    } else {
      ruleResults.push({
        ruleId: "blank-correction",
        ruleType: "observation-set",
        title: "Blank/background correction",
        status: "indeterminate",
        summary: `No reviewed observations are available for blank control ${ruleSet.blankCorrection.controlRef}.`,
        affectedWellIds: controlWellIds(assay, ruleSet.blankCorrection.controlRef),
        formulaTraceRefs: [],
        limitations: ["Raw values were retained, but no corrected or normalized result was fabricated."],
      });
    }
  } else if (units.length === 1) {
    working.forEach((entry) => {
      entry.working = entry.raw;
    });
  }

  if (ruleSet.normalization && [...working.values()].some(({ working: value }) => value !== undefined)) {
    const reference = controlValues(assay, ruleSet.normalization.referenceControlRef, working);
    if (reference.length === 0) {
      ruleResults.push({
        ruleId: "normalization-reference",
        ruleType: "observation-set",
        title: "Normalization reference",
        status: "indeterminate",
        summary: `No reviewed corrected values are available for reference control ${ruleSet.normalization.referenceControlRef}.`,
        affectedWellIds: controlWellIds(assay, ruleSet.normalization.referenceControlRef),
        formulaTraceRefs: [],
        limitations: ["No normalized value was fabricated."],
      });
    } else {
      const referenceMean = meanRational(reference.map(({ value }) => value));
      createTrace(
        traces,
        ruleSet,
        "trace.normalization.reference",
        "sum(reference_i) / n",
        reference.map(({ wellId, value }) => ({ ref: wellId, value })),
        referenceMean,
        unit,
      );
      if (referenceMean.numerator === 0n) {
        ruleResults.push({
          ruleId: "normalization-reference-zero",
          ruleType: "observation-set",
          title: "Normalization reference",
          status: "indeterminate",
          summary: "Reference-control mean is zero, so normalization is undefined.",
          affectedWellIds: reference.map(({ wellId }) => wellId),
          formulaTraceRefs: ["trace.normalization.reference"],
          limitations: ["No division by zero or normalized value was fabricated."],
        });
      } else {
        working.forEach((entry, wellId) => {
          if (!entry.working) return;
          const ratio = divideRational(entry.working, referenceMean);
          entry.normalized = ruleSet.normalization!.mode === "ratio-to-reference"
            ? ratio
            : ruleSet.normalization!.mode === "percent-of-reference"
              ? multiplyRational(ratio, rational(100n))
              : multiplyRational(subtractRational(rational(1n), ratio), rational(100n));
          createTrace(
            traces,
            ruleSet,
            `trace.normalization.${wellId}`,
            ruleSet.normalization!.mode === "ratio-to-reference"
              ? "corrected_value / reference_mean"
              : ruleSet.normalization!.mode === "percent-of-reference"
                ? "corrected_value / reference_mean * 100"
                : "(1 - corrected_value / reference_mean) * 100",
            [
              { ref: wellId, value: entry.working },
              { ref: `${ruleSet.normalization!.referenceControlRef}:mean`, value: referenceMean },
            ],
            entry.normalized,
            ruleSet.normalization!.mode === "ratio-to-reference" ? "1" : "%",
          );
        });
      }
    }
  }

  const replicateSummaries = evaluateReplicateSummaries(assay, working, ruleSet, traces, unit);
  if (units.length === 1 && [...working.values()].some(({ working: value }) => value !== undefined)) {
    ruleSet.rules.forEach((rule) => ruleResults.push(evaluateRule(
      rule,
      assay,
      working,
      ruleSet,
      traces,
      outlierFlags,
      unit,
    )));
  } else {
    ruleSet.rules.forEach((rule) => ruleResults.push(indeterminate(
      rule,
      "The rule cannot run until reviewed observations share one explicit unit and required preprocessing succeeds.",
    )));
  }

  const wellResults: AssayQcWellResult[] = [...working.entries()]
    .sort(([, left], [, right]) => left.coordinate.localeCompare(right.coordinate, undefined, { numeric: true }))
    .map(([wellId, entry]) => ({
      wellId,
      coordinate: entry.coordinate,
      observationId: entry.observation.id,
      rawValue: entry.observation.rawValue,
      ...(entry.working ? { correctedValue: format(entry.working, ruleSet) } : {}),
      ...(entry.normalized ? { normalizedValue: format(entry.normalized, ruleSet) } : {}),
      unit: entry.observation.unit,
      flags: unique(entry.flags),
    }));
  const evaluation: AssayQcEvaluation = {
    schema: "assay-studio.qc-evaluation",
    schemaVersion: "1.0",
    id: `${assay.id}:${observationSet.id}:${ruleSet.id}`,
    assayId: assay.id,
    observationSetId: observationSet.id,
    ruleSetRef: { id: ruleSet.id, version: "1.0" },
    policySourceRef: ruleSet.policySource.id,
    status: overallStatus(ruleResults.map(({ status }) => status)),
    unit,
    wellResults,
    replicateSummaries,
    ruleResults,
    formulaTraces: traces,
    outlierFlags,
    limitations: unique(limitations),
  };
  const validation = validateAssayQcEvaluation(evaluation);
  if (!validation.ok) throw new AssayQcEvaluationError(
    validation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "),
  );
  return validation.value;
};
