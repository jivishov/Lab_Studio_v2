import type {
  ActionMassConsumerContinuity,
  MeasurementRecord,
  ProcessNode,
  RuntimeActionRequest,
  RuntimeState,
  ValidationEvidence,
  ValidationRule,
} from "../domain/types";
import { isWithinTolerance } from "./calculations";

/**
 * Logical scope labels may intentionally be reused by an authored retry. The generation is the
 * attempt discriminator for opt-in continuity evidence; omitted generations remain compatible
 * with older persisted runtime state as the initial attempt.
 */
export const currentEvidenceScopeGeneration = (state: RuntimeState): number =>
  state.evidenceScopeGeneration ?? 1;

export const measurementMatchesContinuity = (
  measurement: MeasurementRecord,
  state: RuntimeState,
  continuity: ActionMassConsumerContinuity,
): boolean =>
  measurement.sourceActionId === continuity.producerActionId &&
  measurement.evidenceScopeId === state.evidenceScopeId &&
  measurement.evidenceScopeGeneration === currentEvidenceScopeGeneration(state) &&
  measurement.measuredSupportInstanceId === continuity.measuredSupportInstanceId &&
  measurement.materialSourceInstanceId === continuity.materialSourceInstanceId &&
  measurement.quantityKind === continuity.quantityKind;

export const findCurrentContinuityMeasurement = (
  state: RuntimeState,
  measurementId: string,
  continuity: ActionMassConsumerContinuity,
): MeasurementRecord | undefined => {
  // Select the newest exact-provenance record first.  Persisted/imported state can contain
  // duplicate logical records even though the normal writer replaces them; an invalid newest one
  // must fail closed rather than causing a fallback to an older value from the same scope.
  const measurement = [...state.measurements]
    .reverse()
    .find((measurement) =>
      measurement.id === measurementId && measurement.unit === "g" &&
      measurementMatchesContinuity(measurement, state, continuity),
    );
  if (!measurement || !Number.isFinite(measurement.value)) return undefined;
  return continuity.quantityKind === "balance-display"
    ? measurement.value >= 0 ? measurement : undefined
    : measurement.value > 0 ? measurement : undefined;
};

const pathValue = (state: RuntimeState, path: string): unknown =>
  path.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) return undefined;
    if (Array.isArray(value) && /^\d+$/.test(segment)) return value[Number(segment)];
    return (value as Record<string, unknown>)[segment];
  }, state);

export const evaluateRule = (
  rule: ValidationRule,
  state: RuntimeState,
  action: RuntimeActionRequest,
  node: ProcessNode,
): ValidationEvidence => {
  let passed = false;
  let message = rule.label;

  if (rule.type === "actionEvidence") {
    // A physical reset keeps `attemptHistory` and starts a new scope generation, so an unqualified
    // rule stays satisfied by a success the reset has already undone. A qualified rule accepts only
    // an attempt stamped with the scope and generation this action is running in, and never the
    // "I am that action" shortcut, so it cannot be satisfied by the requesting action itself.
    const requiresCurrentScope = rule.requireCurrentEvidenceScope === true;
    const generation = currentEvidenceScopeGeneration(state);
    passed = Boolean(
      rule.actionId &&
        ((!requiresCurrentScope && action.actionId === rule.actionId) ||
          state.attemptHistory.some(
            (attempt) =>
              attempt.actionId === rule.actionId &&
              attempt.success &&
              (!requiresCurrentScope ||
                (attempt.evidenceScopeId === state.evidenceScopeId &&
                  attempt.evidenceScopeGeneration === generation)),
          )),
    );
  }

  if (rule.type === "measurementRecorded") {
    passed = Boolean(
      rule.measurementId &&
        (rule.measurementContinuity
          ? findCurrentContinuityMeasurement(
              state,
              rule.measurementId,
              rule.measurementContinuity,
            )
          : state.measurements.some((measurement) => measurement.id === rule.measurementId)),
    );
  }

  if (rule.type === "dataSeriesRecorded") {
    passed = Boolean(
      rule.dataSeriesId &&
        state.dataSeries.some((series) => series.id === rule.dataSeriesId),
    );
  }

  if (rule.type === "notebookEntry") {
    passed = Boolean(
      rule.notebookTag &&
        state.notebook.some((entry) => entry.tags.includes(rule.notebookTag ?? "")),
    );
  }

  if (rule.type === "calculationWithinTolerance") {
    const calculation = state.calculations.find(
      (record) => record.id === rule.calculationId,
    );
    passed = Boolean(
      calculation &&
        calculation.expected !== undefined &&
        isWithinTolerance(
          calculation.value,
          calculation.expected,
          rule.tolerance ?? calculation.tolerance ?? 0,
        ),
    );
    if (calculation) {
      message = `${rule.label} (${calculation.value} ${calculation.unit}).`;
    }
  }

  if (rule.type === "statePath" && rule.path) {
    passed = pathValue(state, rule.path) === rule.equals;
  }

  if (rule.type === "processCompleted") {
    passed = state.completedNodes.includes(node.id);
  }

  return {
    id: `${node.id}-${rule.id}`,
    ruleId: rule.id,
    nodeId: node.id,
    passed,
    message: passed ? message : `${rule.label} is not complete yet.`,
  };
};

export const evaluateNode = (
  node: ProcessNode,
  state: RuntimeState,
  action: RuntimeActionRequest,
): ValidationEvidence[] =>
  node.validation.length > 0
    ? node.validation.map((rule) => evaluateRule(rule, state, action, node))
    : [
        {
          id: `${node.id}-implicit-success`,
          ruleId: "implicit-success",
          nodeId: node.id,
          passed: true,
          message: `${node.title} completed.`,
        },
      ];
