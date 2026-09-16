import { findForbiddenArtifactData } from "../../../platform/artifacts/security";
import type { ContractDiagnostic, ContractValidationResult } from "../../../platform/validation/jsonSchema";
import {
  compareRational,
  decimalToRational,
  type Rational,
} from "../dilution/exact";
import { meanRational } from "../qc/statistics";
import type { AssayObservationSet, PlateObservation } from "../qc/types";
import { validateAssayObservationSet } from "../qc/validation";
import type { AssayDefinition, WellDefinition, WellRole } from "../types/types";
import { evaluateAssayExpression, expressionFormula, formatAnalysisValue } from "./evaluator";
import { validateAssayProtocolProfile } from "./registry";
import { validateAssayProtocolAnalysisSchema } from "./schema";
import type {
  AssayProtocolAnalysis,
  AssayProtocolFormulaTrace,
  AssayProtocolProfile,
  AssayProtocolWellResult,
} from "./types";

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();
const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code, path, message, severity: "error",
});

interface ReviewedObservation {
  observation: PlateObservation;
  value: Rational;
}

const reviewedByWell = (
  set: AssayObservationSet,
): { values: Map<string, ReviewedObservation>; duplicates: string[] } => {
  const corrections = new Map(set.manualCorrections.map((entry) => [entry.observationId, entry]));
  const grouped = new Map<string, PlateObservation[]>();
  set.observations
    .filter(({ reviewStatus }) => reviewStatus === "accepted" || reviewStatus === "corrected")
    .forEach((observation) => grouped.set(observation.wellId, [...(grouped.get(observation.wellId) ?? []), observation]));
  const values = new Map<string, ReviewedObservation>();
  const duplicates: string[] = [];
  grouped.forEach((observations, wellId) => {
    if (observations.length !== 1) {
      duplicates.push(wellId);
      return;
    }
    const observation = observations[0];
    values.set(wellId, {
      observation,
      value: decimalToRational(corrections.get(observation.id)?.acceptedValue ?? observation.rawValue),
    });
  });
  return { values, duplicates };
};

const wellsForRole = (assay: AssayDefinition, role: WellRole): WellDefinition[] =>
  assay.plate.wells.filter((well) => well.role === role);

const controlMean = (
  assay: AssayDefinition,
  role: WellRole,
  reviewed: ReadonlyMap<string, ReviewedObservation>,
): { value?: Rational; wellIds: string[] } => {
  const wells = wellsForRole(assay, role);
  const entries = wells.flatMap(({ id }) => reviewed.get(id)?.value ? [reviewed.get(id)!.value] : []);
  return { ...(entries.length ? { value: meanRational(entries) } : {}), wellIds: wells.map(({ id }) => id) };
};

const concentrationForWell = (
  well: WellDefinition,
  componentRef: string,
): { value: string; unit: string } | undefined => {
  const matches = well.plannedComponents.filter(({ resourceRef, concentration }) =>
    resourceRef === componentRef && concentration);
  if (matches.length !== 1) return undefined;
  return matches[0].concentration;
};

const baseAnalysis = (
  assay: AssayDefinition,
  set: AssayObservationSet,
  profile: AssayProtocolProfile,
): Omit<AssayProtocolAnalysis, "status" | "controlStatus" | "wellResults" | "replicateSummaries" | "formulaTraces" | "diagnostics"> => ({
  schema: "assay-studio.protocol-analysis",
  schemaVersion: "1.0",
  id: `${assay.id}:${set.id}:${profile.id}@${profile.version}`,
  assayId: assay.id,
  observationSetId: set.id,
  profileRef: { id: profile.id, version: profile.version },
  workflow: profile.workflow,
  dataSources: unique(set.observations
    .filter(({ reviewStatus }) => reviewStatus === "accepted" || reviewStatus === "corrected")
    .map(({ sourceType }) => sourceType)) as PlateObservation["sourceType"][],
  readoutRef: profile.readouts[0].id,
  readoutUnit: unique(set.observations.map(({ unit }) => unit)).join(", ") || "not-supplied",
  limitations: unique([
    ...profile.limitations,
    "Results are bound to the exact checked profile version, reviewed observations, source provenance, controls, and authored concentrations.",
  ]),
  scientificBoundary: profile.workflow === "xtt-metabolic-activity"
    ? "Protocol-dependent metabolic-activity proxy; not a direct cell count and not a clinical result."
    : "Profile-bound educational/research endpoint; no clinical breakpoint, susceptibility category, or treatment advice.",
});

const finalize = (analysis: AssayProtocolAnalysis): AssayProtocolAnalysis => {
  const validation = validateAssayProtocolAnalysis(analysis);
  if (!validation.ok) throw new Error(JSON.stringify(validation.diagnostics));
  return validation.value;
};

const preflight = (
  assay: AssayDefinition,
  observationInput: unknown,
  profileInput: unknown,
): { set: AssayObservationSet; profile: AssayProtocolProfile; diagnostics: string[] } => {
  const observationValidation = validateAssayObservationSet(observationInput, assay);
  if (!observationValidation.ok) throw new Error(JSON.stringify(observationValidation.diagnostics));
  const profileValidation = validateAssayProtocolProfile(profileInput);
  if (!profileValidation.ok) throw new Error(JSON.stringify(profileValidation.diagnostics));
  const profile = profileValidation.value;
  const diagnostics: string[] = [];
  if (assay.protocolProfileRef.id !== profile.id || assay.protocolProfileRef.version !== profile.version) {
    diagnostics.push(`Artifact profile ${assay.protocolProfileRef.id}@${assay.protocolProfileRef.version} does not match ${profile.id}@${profile.version}.`);
  }
  if (assay.analysisPlan.profileRef
    && (assay.analysisPlan.profileRef.id !== profile.id || assay.analysisPlan.profileRef.version !== profile.version)) {
    diagnostics.push("The analysis-plan profile reference does not match the selected checked profile.");
  }
  return { set: observationValidation.value, profile, diagnostics };
};

export const analyzeXttMetabolicActivity = (
  assay: AssayDefinition,
  observationInput: unknown,
  profileInput: unknown,
): AssayProtocolAnalysis => {
  const { set, profile, diagnostics } = preflight(assay, observationInput, profileInput);
  if (profile.workflow !== "xtt-metabolic-activity") throw new Error("Selected profile is not an XTT metabolic-activity profile.");
  const { values: reviewed, duplicates } = reviewedByWell(set);
  if (duplicates.length) diagnostics.push(`Multiple reviewed observations exist for wells: ${duplicates.join(", ")}.`);
  const units = unique([...reviewed.values()].map(({ observation }) => observation.unit));
  const channels = unique([...reviewed.values()].map(({ observation }) => observation.channel ?? ""));
  const readout = profile.readouts[0];
  if (units.length !== 1 || !readout.allowedUnits.includes(units[0])) diagnostics.push("Reviewed XTT observations must share one unit allowed by the selected profile.");
  if (readout.channelRequirement === "required" && (channels.length !== 1 || channels[0] === "")) diagnostics.push("Reviewed XTT observations must share one explicit channel supplied by the protocol/import mapping.");
  const blank = controlMean(assay, profile.blankControlRole!, reviewed);
  const reference = controlMean(assay, profile.referenceControlRole!, reviewed);
  profile.requiredControls.forEach((requirement) => {
    const count = wellsForRole(assay, requirement.role).filter(({ id }) => reviewed.has(id)).length;
    if (count < requirement.minimumCount) diagnostics.push(`Control role ${requirement.role} requires ${requirement.minimumCount} reviewed observation(s); found ${count}.`);
  });
  if (!blank.value || !reference.value) diagnostics.push("Blank and reference control means are required.");
  else if (compareRational(reference.value, blank.value) <= 0) diagnostics.push("Reference-control mean must be greater than blank-control mean under this profile.");
  const traces: AssayProtocolFormulaTrace[] = [];
  const wellResults: AssayProtocolWellResult[] = [];
  if (diagnostics.length === 0 && blank.value && reference.value) {
    assay.plate.wells
      .filter((well) => reviewed.has(well.id) && well.role !== profile.blankControlRole)
      .forEach((well) => {
        const entry = reviewed.get(well.id)!;
        const metricValues: Record<string, string> = {};
        profile.metricRules.forEach((rule) => {
          const result = evaluateAssayExpression(rule.expression, {
            observed: entry.value,
            blankMean: blank.value!,
            referenceMean: reference.value!,
          });
          const formatted = formatAnalysisValue(result, profile.roundingPolicy.decimalPlaces, profile.roundingPolicy.tieBreaking);
          metricValues[rule.id] = formatted;
          traces.push({
            id: `trace.${well.id}.${rule.id}`,
            ruleId: rule.id,
            formula: expressionFormula(rule.expression),
            inputRefs: [entry.observation.id, ...blank.wellIds, ...reference.wellIds],
            inputValues: [
              formatAnalysisValue(entry.value, profile.roundingPolicy.decimalPlaces, profile.roundingPolicy.tieBreaking),
              formatAnalysisValue(blank.value!, profile.roundingPolicy.decimalPlaces, profile.roundingPolicy.tieBreaking),
              formatAnalysisValue(reference.value!, profile.roundingPolicy.decimalPlaces, profile.roundingPolicy.tieBreaking),
            ],
            result: formatted,
            unit: rule.unit,
          });
        });
        wellResults.push({
          wellId: well.id,
          coordinate: well.coordinate,
          sourceType: entry.observation.sourceType,
          rawValue: entry.observation.rawValue,
          unit: entry.observation.unit,
          metricValues,
        });
      });
  }
  const replicateSummaries = assay.replicateGroups.flatMap((group) => profile.metricRules.map((rule) => {
    const members = group.memberWellIds
      .map((wellId) => wellResults.find((result) => result.wellId === wellId))
      .filter((value): value is AssayProtocolWellResult => Boolean(value));
    const valuesForRule = members.flatMap(({ metricValues }) => metricValues[rule.id] ? [decimalToRational(metricValues[rule.id])] : []);
    return {
      replicateGroupRef: group.id,
      metricRuleRef: rule.id,
      memberWellIds: [...group.memberWellIds],
      ...(valuesForRule.length >= group.minimumCount ? {
        aggregateValue: formatAnalysisValue(meanRational(valuesForRule), profile.roundingPolicy.decimalPlaces, profile.roundingPolicy.tieBreaking),
      } : {}),
      status: valuesForRule.length >= group.minimumCount ? "complete" as const : "indeterminate" as const,
      limitations: valuesForRule.length >= group.minimumCount
        ? ["Arithmetic mean of the reviewed, profile-normalized technical replicates."]
        : [`Expected ${group.minimumCount} reviewed replicate values; found ${valuesForRule.length}.`],
    };
  }));
  if (replicateSummaries.some(({ status }) => status === "indeterminate")) diagnostics.push("At least one authored replicate group is incomplete.");
  const thresholdRule = profile.endpointRules.find((rule) => rule.type === "lowest-metric-threshold-concentration");
  let endpoint: AssayProtocolAnalysis["endpoint"];
  if (thresholdRule) {
    const levels = wellResults.flatMap((result) => {
      const well = assay.plate.wells.find(({ id }) => id === result.wellId);
      const concentration = well ? concentrationForWell(well, thresholdRule.concentrationComponentRef) : undefined;
      const metric = result.metricValues[thresholdRule.metricRuleRef];
      if (!concentration || metric === undefined) {
        diagnostics.push(`Well ${result.wellId} lacks the endpoint concentration or metric ${thresholdRule.metricRuleRef}.`);
        return [];
      }
      return [{ concentration, metric: decimalToRational(metric) }];
    }).sort((left, right) => compareRational(
      decimalToRational(left.concentration.value),
      decimalToRational(right.concentration.value),
    ));
    const concentrationUnits = unique(levels.map(({ concentration }) => concentration.unit));
    if (concentrationUnits.length !== 1) diagnostics.push("Protocol-defined inhibition endpoint concentrations must share one unit.");
    for (let index = 1; index < levels.length; index += 1) {
      if (compareRational(levels[index].metric, levels[index - 1].metric) < 0) {
        diagnostics.push("The protocol-defined inhibition metric is non-monotonic across increasing concentration.");
        break;
      }
    }
    const selected = levels.find(({ metric }) =>
      compareRational(metric, decimalToRational(thresholdRule.threshold)) >= 0);
    if (!selected) diagnostics.push("No tested concentration reaches the explicit profile threshold.");
    else endpoint = {
      ruleId: thresholdRule.id,
      terminology: thresholdRule.terminology,
      concentration: { ...selected.concentration },
    };
  }
  return finalize({
    ...baseAnalysis(assay, set, profile),
    status: diagnostics.length ? "indeterminate" : "complete",
    controlStatus: diagnostics.some((entry) => entry.toLowerCase().includes("control")) ? "invalid" : diagnostics.length ? "indeterminate" : "valid",
    wellResults,
    replicateSummaries,
    ...(diagnostics.length === 0 && endpoint ? { endpoint } : {}),
    formulaTraces: traces,
    diagnostics: unique(diagnostics),
  });
};

export const analyzeBrothMicrodilutionEndpoint = (
  assay: AssayDefinition,
  observationInput: unknown,
  profileInput: unknown,
): AssayProtocolAnalysis => {
  const { set, profile, diagnostics } = preflight(assay, observationInput, profileInput);
  if (profile.workflow !== "broth-microdilution") throw new Error("Selected profile is not a broth-microdilution profile.");
  const endpointRule = profile.endpointRules.find((rule) => rule.type === "lowest-no-growth-concentration");
  if (!endpointRule) throw new Error("The broth-microdilution profile has no supported endpoint rule.");
  const { values: reviewed, duplicates } = reviewedByWell(set);
  if (duplicates.length) diagnostics.push(`Multiple reviewed observations exist for wells: ${duplicates.join(", ")}.`);
  const readout = profile.readouts[0];
  const units = unique([...reviewed.values()].map(({ observation }) => observation.unit));
  if (units.length !== 1 || !readout.allowedUnits.includes(units[0])) diagnostics.push("Reviewed endpoint observations must share the profile-defined binary-growth unit.");
  profile.requiredControls.forEach((requirement) => {
    const entries = wellsForRole(assay, requirement.role).flatMap(({ id }) => reviewed.get(id) ? [reviewed.get(id)!] : []);
    if (entries.length < requirement.minimumCount) diagnostics.push(`Control role ${requirement.role} requires ${requirement.minimumCount} reviewed observation(s); found ${entries.length}.`);
    const expected = requirement.expectedSignal === "growth" ? endpointRule.growthValue
      : requirement.expectedSignal === "no-growth" ? endpointRule.noGrowthValue : undefined;
    if (expected && entries.some(({ value }) => compareRational(value, decimalToRational(expected)) !== 0)) {
      diagnostics.push(`Control role ${requirement.role} does not match its profile-defined ${requirement.expectedSignal} value.`);
    }
  });
  const grouped = new Map<string, { unit: string; values: Rational[]; wells: WellDefinition[]; sources: PlateObservation["sourceType"][] }>();
  assay.plate.wells.filter(({ role }) => role === "sample").forEach((well) => {
    const concentration = concentrationForWell(well, endpointRule.concentrationComponentRef);
    const entry = reviewed.get(well.id);
    if (!concentration || !entry) {
      diagnostics.push(`Sample well ${well.id} lacks one reviewed binary result or one explicit ${endpointRule.concentrationComponentRef} concentration.`);
      return;
    }
    const key = `${concentration.value}|${concentration.unit}`;
    const current = grouped.get(key) ?? { unit: concentration.unit, values: [], wells: [], sources: [] };
    current.values.push(entry.value);
    current.wells.push(well);
    current.sources.push(entry.observation.sourceType);
    grouped.set(key, current);
  });
  const concentrationUnits = unique([...grouped.values()].map(({ unit }) => unit));
  if (concentrationUnits.length !== 1) diagnostics.push("All endpoint concentrations must share one explicit unit.");
  const levels = [...grouped.entries()].map(([key, group]) => {
    const [value] = key.split("|");
    const uniqueValues = unique(group.values.map((entry) => `${entry.numerator}/${entry.denominator}`));
    if (uniqueValues.length !== 1) diagnostics.push(`Replicates conflict at concentration ${value} ${group.unit}.`);
    const result = group.values[0];
    if (result && compareRational(result, decimalToRational(endpointRule.growthValue)) !== 0
      && compareRational(result, decimalToRational(endpointRule.noGrowthValue)) !== 0) {
      diagnostics.push(`Concentration ${value} ${group.unit} is neither the profile-defined growth nor no-growth value.`);
    }
    return { value, rational: decimalToRational(value), group, result };
  }).sort((left, right) => compareRational(left.rational, right.rational));
  let seenNoGrowth = false;
  levels.forEach((level) => {
    if (!level.result) return;
    const noGrowth = compareRational(level.result, decimalToRational(endpointRule.noGrowthValue)) === 0;
    if (noGrowth) seenNoGrowth = true;
    else if (seenNoGrowth) diagnostics.push("The reviewed concentration-response sequence is non-monotonic; growth reappears above a no-growth concentration.");
  });
  const endpointLevel = levels.find(({ result }) =>
    result && compareRational(result, decimalToRational(endpointRule.noGrowthValue)) === 0);
  if (!endpointLevel) diagnostics.push("No reviewed no-growth concentration is available, so the endpoint is outside the tested range or indeterminate.");
  const wellResults = levels.flatMap(({ value, group }) => group.wells.map((well, index): AssayProtocolWellResult => ({
    wellId: well.id,
    coordinate: well.coordinate,
    sourceType: group.sources[index],
    rawValue: formatAnalysisValue(group.values[index], profile.roundingPolicy.decimalPlaces, profile.roundingPolicy.tieBreaking),
    unit: units[0] ?? "not-supplied",
    metricValues: { "binary-growth": formatAnalysisValue(group.values[index], 0, "half-even") },
    concentration: { value, unit: group.unit },
  })));
  const replicateSummaries = levels.map(({ value, group }) => ({
    replicateGroupRef: `concentration:${value}:${group.unit}`,
    metricRuleRef: "binary-growth",
    memberWellIds: group.wells.map(({ id }) => id),
    ...(group.values.length && unique(group.values.map((entry) => `${entry.numerator}/${entry.denominator}`)).length === 1
      ? { aggregateValue: formatAnalysisValue(group.values[0], 0, "half-even") } : {}),
    status: group.values.length && unique(group.values.map((entry) => `${entry.numerator}/${entry.denominator}`)).length === 1
      ? "complete" as const : "indeterminate" as const,
    limitations: ["Binary replicate agreement only; no clinical susceptibility interpretation is performed."],
  }));
  return finalize({
    ...baseAnalysis(assay, set, profile),
    status: diagnostics.length ? "indeterminate" : "complete",
    controlStatus: diagnostics.some((entry) => entry.toLowerCase().includes("control")) ? "invalid" : diagnostics.length ? "indeterminate" : "valid",
    wellResults,
    replicateSummaries,
    ...(diagnostics.length === 0 && endpointLevel ? {
      endpoint: {
        ruleId: endpointRule.id,
        terminology: endpointRule.terminology,
        concentration: { value: endpointLevel.value, unit: endpointLevel.group.unit },
      },
    } : {}),
    formulaTraces: [],
    diagnostics: unique(diagnostics),
  });
};

export const validateAssayProtocolAnalysis = (
  input: unknown,
): ContractValidationResult<AssayProtocolAnalysis> => {
  const schema = validateAssayProtocolAnalysisSchema(input);
  if (!schema.ok) return schema;
  const diagnostics = findForbiddenArtifactData(schema.value);
  if ("susceptibilityCategory" in schema.value || "treatmentAdvice" in schema.value) {
    diagnostics.push(error("assay.analysis.clinical-field-forbidden", "/", "Clinical category and treatment-advice fields are forbidden."));
  }
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, value: schema.value, diagnostics: [] };
};
