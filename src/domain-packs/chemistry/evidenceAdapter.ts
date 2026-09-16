import type {
  AttemptRecord,
  CalculationRecord,
  DataSeriesRecord,
  MeasurementRecord,
  NotebookEntry,
  RuntimeState,
  ValidationEvidence,
} from "../../domain/types";
import type { EvidenceRecord } from "../../platform/evidence/types";
import type { ChemistryArtifact } from "./artifactKind";
import { chemistryModelCapabilitySources } from "./capabilitySources";
import type { DeepReadonly } from "./processAdapter";

const actionEvidenceMetadata = {
  retentionClass: "submission" as const,
  sensitivity: "none" as const,
  accessibleRepresentation: "text" as const,
  redactionPolicyId: "core.action.completed.allowlist-v1",
};

const calculationEvidenceMetadata = {
  retentionClass: "submission" as const,
  sensitivity: "none" as const,
  accessibleRepresentation: "table" as const,
  redactionPolicyId: "core.calculation.result.allowlist-v1",
};

const measurementEvidenceMetadata = {
  retentionClass: "submission" as const,
  sensitivity: "none" as const,
  accessibleRepresentation: "table" as const,
  redactionPolicyId: "core.measurement.scalar.allowlist-v1",
};

const seriesEvidenceMetadata = {
  retentionClass: "submission" as const,
  sensitivity: "none" as const,
  accessibleRepresentation: "chart+table" as const,
  redactionPolicyId: "core.measurement.series.allowlist-v1",
};

const notebookEvidenceMetadata = {
  retentionClass: "submission" as const,
  sensitivity: "user-authored" as const,
  accessibleRepresentation: "text" as const,
  redactionPolicyId: "core.observation.text.allowlist-v1",
};

const validationEvidenceMetadata = {
  retentionClass: "submission" as const,
  sensitivity: "none" as const,
  accessibleRepresentation: "text" as const,
  redactionPolicyId: "chemistry.validation.rule.allowlist-v1",
};

export const projectAttemptRecordToActionEvidence = (
  attempt: DeepReadonly<AttemptRecord>,
): EvidenceRecord => ({
  evidenceId: `action.${attempt.id}`,
  typeId: "action.completed",
  typeVersion: "1.0.0",
  occurredAt: attempt.timestamp,
  producerId: "chemistry.runtime",
  summary: attempt.message,
  metadata: actionEvidenceMetadata,
  payload: {
    actionId: attempt.actionId,
    verb: attempt.verb,
    nodeId: attempt.nodeId,
    success: attempt.success,
  },
});

export interface CalculationEvidenceProjection {
  occurredAt: string;
  formula: string;
  inputs: Array<{ name: string; value: number; unit?: string }>;
  validityLimits: string[];
}

export const projectCalculationRecordToEvidence = (
  calculation: DeepReadonly<CalculationRecord>,
  projection: DeepReadonly<CalculationEvidenceProjection>,
): EvidenceRecord => ({
  evidenceId: `calculation.${calculation.id}`,
  typeId: "calculation.result",
  typeVersion: "1.0.0",
  occurredAt: projection.occurredAt,
  producerId: "chemistry.runtime",
  summary: `${calculation.label}: ${calculation.value} ${calculation.unit}`.trim(),
  metadata: calculationEvidenceMetadata,
  payload: {
    calculationId: calculation.id,
    value: calculation.value,
    unit: calculation.unit || "1",
    formula: projection.formula,
    inputs: projection.inputs.map((input) => ({ ...input })),
    validityLimits: [...projection.validityLimits],
  },
});

export const projectMeasurementRecordToEvidence = (
  measurement: DeepReadonly<MeasurementRecord>,
  occurredAt: string,
): EvidenceRecord => ({
  evidenceId: `measurement.${measurement.id}`,
  typeId: "measurement.scalar",
  typeVersion: "1.0.0",
  occurredAt,
  producerId: "chemistry.runtime",
  summary: `${measurement.label}: ${measurement.value} ${measurement.unit}`.trim(),
  metadata: measurementEvidenceMetadata,
  payload: {
    measurementId: measurement.id,
    value: measurement.value,
    unit: measurement.unit || "1",
  },
});

export const projectDataSeriesRecordToEvidence = (
  series: DeepReadonly<DataSeriesRecord>,
  occurredAt: string,
): EvidenceRecord => ({
  evidenceId: `series.${series.id}`,
  typeId: "measurement.series",
  typeVersion: "1.0.0",
  occurredAt,
  producerId: "chemistry.runtime",
  summary: `${series.label}: ${series.points.length} recorded points.`,
  metadata: seriesEvidenceMetadata,
  payload: {
    seriesId: series.id,
    xUnit: series.xUnit || "1",
    yUnit: series.yUnit || "1",
    points: series.points.map((point, index) => ({
      sequence: index + 1,
      x: point.x,
      y: point.y,
    })),
  },
});

export const projectNotebookEntryToEvidence = (
  entry: DeepReadonly<NotebookEntry>,
): EvidenceRecord => ({
  evidenceId: `notebook.${entry.id}`,
  typeId: "observation.text",
  typeVersion: "1.0.0",
  occurredAt: entry.timestamp,
  producerId: "studio.notebook",
  summary: entry.label,
  metadata: notebookEvidenceMetadata,
  payload: {
    observationId: entry.id,
    text: entry.value,
    tags: [...entry.tags],
  },
});

export const projectValidationEvidenceToEvidence = (
  evidence: DeepReadonly<ValidationEvidence>,
  occurredAt: string,
): EvidenceRecord => ({
  evidenceId: `validation.${evidence.id}`,
  typeId: "chemistry.validation.rule",
  typeVersion: "1.0.0",
  occurredAt,
  producerId: "chemistry.runtime",
  summary: evidence.message,
  metadata: validationEvidenceMetadata,
  payload: {
    ruleId: evidence.ruleId,
    nodeId: evidence.nodeId,
    passed: evidence.passed,
    message: evidence.message,
  },
});

export interface ChemistryRuntimeEvidenceProjectionContext {
  occurredAt: string;
  artifact?: DeepReadonly<ChemistryArtifact>;
  calculationEvidenceById?: Readonly<Record<string, Readonly<CalculationEvidenceProjection>>>;
}

export type ChemistryEvidenceRuntimeState = Pick<
  RuntimeState,
  "measurements" | "dataSeries" | "calculations" | "notebook" | "validationEvidence" | "attemptHistory"
>;

const actionForCalculation = (
  calculationId: string,
  artifact: DeepReadonly<ChemistryArtifact> | undefined,
) => artifact?.actions.find((action) => {
  const configuredId = action.parameters.calculationId;
  return typeof configuredId === "string" &&
    (calculationId === configuredId || calculationId.startsWith(`${configuredId}-`));
});

const calculationProjection = (
  calculation: DeepReadonly<CalculationRecord>,
  context: Readonly<ChemistryRuntimeEvidenceProjectionContext>,
): CalculationEvidenceProjection => {
  const supplied = context.calculationEvidenceById?.[calculation.id];
  if (supplied) {
    return {
      occurredAt: supplied.occurredAt,
      formula: supplied.formula,
      inputs: supplied.inputs.map((input) => ({ ...input })),
      validityLimits: [...supplied.validityLimits],
    };
  }

  const action = actionForCalculation(calculation.id, context.artifact);
  const runtimeTemplate = typeof action?.parameters.template === "string"
    ? action.parameters.template
    : undefined;
  const model = chemistryModelCapabilitySources.find(
    (candidate) => candidate.runtimeTemplate === runtimeTemplate,
  );
  const inputs = Object.entries(action?.parameters ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => ({ name, value }));

  return {
    occurredAt: context.occurredAt,
    formula: model?.formula ?? "result = validated chemistry runtime calculation",
    inputs,
    validityLimits: model
      ? [...model.validityLimits]
      : ["No registered quantitative model trace was available for this legacy calculation record."],
  };
};

export const projectChemistryRuntimeEvidence = (
  state: DeepReadonly<ChemistryEvidenceRuntimeState>,
  context: Readonly<ChemistryRuntimeEvidenceProjectionContext>,
): EvidenceRecord[] => [
  ...state.attemptHistory.map(projectAttemptRecordToActionEvidence),
  ...state.measurements.map((measurement) =>
    projectMeasurementRecordToEvidence(measurement, context.occurredAt)),
  ...state.dataSeries.map((series) =>
    projectDataSeriesRecordToEvidence(series, context.occurredAt)),
  ...state.calculations.map((calculation) =>
    projectCalculationRecordToEvidence(calculation, calculationProjection(calculation, context))),
  ...state.notebook.map(projectNotebookEntryToEvidence),
  ...state.validationEvidence.map((evidence) =>
    projectValidationEvidenceToEvidence(evidence, context.occurredAt)),
];
