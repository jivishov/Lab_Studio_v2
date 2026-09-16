import { compareDecimal, parseDecimal } from "../../../platform/planning/decimal";
import { findForbiddenArtifactData } from "../../../platform/artifacts/security";
import type { ContractDiagnostic, ContractValidationResult } from "../../../platform/validation/jsonSchema";
import type { AssayDefinition } from "../types";
import {
  validateAssayObservationSetSchema,
  validateAssayQcEvaluationSchema,
  validateAssayQcRuleSetSchema,
} from "./schema";
import type {
  AssayObservationSet,
  AssayQcEvaluation,
  AssayQcRuleSet,
} from "./types";

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const duplicateDiagnostics = (
  values: readonly string[],
  path: string,
  code: string,
): ContractDiagnostic[] => {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    if (seen.has(value)) return [error(code, `${path}/${index}`, `Duplicate id ${value}.`)];
    seen.add(value);
    return [];
  });
};

const timestampIsValid = (value: string): boolean =>
  value.includes("T") && Number.isFinite(Date.parse(value));

export const validateAssayObservationSet = (
  input: unknown,
  assay: AssayDefinition,
): ContractValidationResult<AssayObservationSet> => {
  const schemaResult = validateAssayObservationSetSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const set = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateDiagnostics(set.observations.map(({ id }) => id), "/observations", "assay.observation.id.duplicate"),
    ...duplicateDiagnostics(set.manualCorrections.map(({ id }) => id), "/manualCorrections", "assay.correction.id.duplicate"),
    ...findForbiddenArtifactData(set),
  ];
  if (set.plateId !== assay.plate.id) diagnostics.push(error(
    "assay.observation-set.plate-mismatch",
    "/plateId",
    `Observation plate ${set.plateId} does not match assay plate ${assay.plate.id}.`,
  ));
  const wellIds = new Set(assay.plate.wells.map(({ id }) => id));
  const observations = new Map(set.observations.map((observation) => [observation.id, observation]));
  const correctionsByObservation = new Map<string, number>();
  set.observations.forEach((observation, index) => {
    if (observation.plateId !== set.plateId) diagnostics.push(error(
      "assay.observation.plate-mismatch",
      `/observations/${index}/plateId`,
      `Observation ${observation.id} belongs to ${observation.plateId}, not ${set.plateId}.`,
    ));
    if (!wellIds.has(observation.wellId)) diagnostics.push(error(
      "assay.observation.well-missing",
      `/observations/${index}/wellId`,
      `Observation ${observation.id} references missing well ${observation.wellId}.`,
    ));
    if (observation.capturedAt && !timestampIsValid(observation.capturedAt)) diagnostics.push(error(
      "assay.observation.captured-at.invalid",
      `/observations/${index}/capturedAt`,
      "capturedAt must be an ISO-8601 timestamp when supplied.",
    ));
    if (observation.confidence !== undefined) {
      const confidence = parseDecimal(observation.confidence);
      if (
        compareDecimal(confidence, parseDecimal("0")) < 0
        || compareDecimal(confidence, parseDecimal("1")) > 0
      ) diagnostics.push(error(
        "assay.observation.confidence.range",
        `/observations/${index}/confidence`,
        "Confidence must be between 0 and 1.",
      ));
    }
  });
  set.manualCorrections.forEach((correction, index) => {
    const observation = observations.get(correction.observationId);
    if (!observation) diagnostics.push(error(
      "assay.correction.observation-missing",
      `/manualCorrections/${index}/observationId`,
      `Correction references missing observation ${correction.observationId}.`,
    ));
    else if (observation.rawValue !== correction.previousValue) diagnostics.push(error(
      "assay.correction.previous-value-mismatch",
      `/manualCorrections/${index}/previousValue`,
      `Correction previous value must match observation ${observation.id}.`,
    ));
    if (!timestampIsValid(correction.occurredAt)) diagnostics.push(error(
      "assay.correction.occurred-at.invalid",
      `/manualCorrections/${index}/occurredAt`,
      "Correction occurredAt must be an ISO-8601 timestamp.",
    ));
    correctionsByObservation.set(
      correction.observationId,
      (correctionsByObservation.get(correction.observationId) ?? 0) + 1,
    );
  });
  correctionsByObservation.forEach((count, observationId) => {
    if (count > 1) diagnostics.push(error(
      "assay.correction.multiple-unsupported",
      "/manualCorrections",
      `Observation ${observationId} has ${count} corrections; Cycle 08 accepts one explicit correction per observation.`,
    ));
  });
  set.observations.forEach((observation, index) => {
    const hasCorrection = correctionsByObservation.has(observation.id);
    if (observation.reviewStatus === "corrected" && !hasCorrection) diagnostics.push(error(
      "assay.observation.correction-required",
      `/observations/${index}/reviewStatus`,
      `Corrected observation ${observation.id} requires an explicit manual-correction record.`,
    ));
    if (observation.reviewStatus !== "corrected" && hasCorrection) diagnostics.push(error(
      "assay.observation.corrected-status-required",
      `/observations/${index}/reviewStatus`,
      `Observation ${observation.id} has a correction and must use reviewStatus corrected.`,
    ));
  });
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, value: set, diagnostics: [] };
};

export const validateAssayQcRuleSet = (
  input: unknown,
  assay: AssayDefinition,
): ContractValidationResult<AssayQcRuleSet> => {
  const schemaResult = validateAssayQcRuleSetSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const set = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateDiagnostics(set.requiredControls.map(({ id }) => id), "/requiredControls", "assay.qc.required-control.id.duplicate"),
    ...duplicateDiagnostics(set.rules.map(({ id }) => id), "/rules", "assay.qc.rule.id.duplicate"),
    ...findForbiddenArtifactData(set),
  ];
  const controls = new Set(assay.controls.map(({ id }) => id));
  const groups = new Set(assay.replicateGroups.map(({ id }) => id));
  const wells = new Set(assay.plate.wells.map(({ id }) => id));
  const requireControl = (controlRef: string, path: string) => {
    if (!controls.has(controlRef)) diagnostics.push(error(
      "assay.qc.control-ref.missing",
      path,
      `QC policy references missing control ${controlRef}.`,
    ));
  };
  set.requiredControls.forEach((requirement, index) => {
    requireControl(requirement.controlRef, `/requiredControls/${index}/controlRef`);
    if (requirement.maximumCount !== undefined && requirement.maximumCount < requirement.minimumCount) {
      diagnostics.push(error(
        "assay.qc.required-control.range",
        `/requiredControls/${index}/maximumCount`,
        "maximumCount cannot be less than minimumCount.",
      ));
    }
  });
  if (set.blankCorrection) requireControl(set.blankCorrection.controlRef, "/blankCorrection/controlRef");
  if (set.normalization) requireControl(set.normalization.referenceControlRef, "/normalization/referenceControlRef");
  set.rules.forEach((rule, index) => {
    const path = `/rules/${index}`;
    if ("highControlRef" in rule) requireControl(rule.highControlRef, `${path}/highControlRef`);
    if ("lowControlRef" in rule) requireControl(rule.lowControlRef, `${path}/lowControlRef`);
    if ("replicateGroupRefs" in rule) rule.replicateGroupRefs.forEach((groupRef, groupIndex) => {
      if (!groups.has(groupRef)) diagnostics.push(error(
        "assay.qc.replicate-group-ref.missing",
        `${path}/replicateGroupRefs/${groupIndex}`,
        `QC policy references missing replicate group ${groupRef}.`,
      ));
    });
    const ruleWellIds = "edgeWellIds" in rule
      ? [...rule.edgeWellIds, ...rule.interiorWellIds]
      : "wellIds" in rule
        ? rule.wellIds
        : [];
    ruleWellIds.forEach((wellId, wellIndex) => {
      if (!wells.has(wellId)) diagnostics.push(error(
        "assay.qc.well-ref.missing",
        `${path}/wellIds/${wellIndex}`,
        `QC policy references missing well ${wellId}.`,
      ));
    });
  });
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, value: set, diagnostics: [] };
};

export const validateAssayQcEvaluation = (
  input: unknown,
): ContractValidationResult<AssayQcEvaluation> => {
  const schemaResult = validateAssayQcEvaluationSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const evaluation = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateDiagnostics(evaluation.wellResults.map(({ observationId }) => observationId), "/wellResults", "assay.qc.well-result.observation.duplicate"),
    ...duplicateDiagnostics(evaluation.ruleResults.map(({ ruleId }) => ruleId), "/ruleResults", "assay.qc.rule-result.id.duplicate"),
    ...duplicateDiagnostics(evaluation.formulaTraces.map(({ id }) => id), "/formulaTraces", "assay.qc.formula-trace.id.duplicate"),
    ...findForbiddenArtifactData(evaluation),
  ];
  const traceIds = new Set(evaluation.formulaTraces.map(({ id }) => id));
  evaluation.ruleResults.forEach((result, resultIndex) => result.formulaTraceRefs.forEach((traceRef, traceIndex) => {
    if (!traceIds.has(traceRef)) diagnostics.push(error(
      "assay.qc.formula-trace-ref.missing",
      `/ruleResults/${resultIndex}/formulaTraceRefs/${traceIndex}`,
      `Rule result references missing formula trace ${traceRef}.`,
    ));
  }));
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, value: evaluation, diagnostics: [] };
};
