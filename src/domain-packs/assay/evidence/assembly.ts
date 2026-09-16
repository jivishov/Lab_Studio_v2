import {
  coreEvidenceRegistryFragment,
  createEvidenceRegistry,
  validateEvidenceBundle,
  validateRunTrace,
  type EvidenceBundle,
  type EvidenceRecord,
  type EvidenceRegistry,
  type RunEvent,
  type RunTrace,
} from "../../../platform/evidence";
import type { PlateRuntimeState } from "../types";
import type { AssayOperationEvidence } from "../runtime";
import { getAssayEvidenceRegistryFragment } from "../evidenceRegistry";
import type {
  AssayObservationSet,
  AssayQcEvaluation,
} from "../qc";
import {
  ASSAY_COMPOSITION_EVIDENCE,
  ASSAY_CYCLE08_EVIDENCE_VERSION,
  ASSAY_ENDPOINT_CANDIDATE_EVIDENCE,
  ASSAY_FORMULA_TRACE_EVIDENCE,
  ASSAY_MANUAL_CORRECTION_EVIDENCE,
  ASSAY_NORMALIZED_RESULT_EVIDENCE,
  ASSAY_OBSERVATION_EVIDENCE,
  ASSAY_QC_RESULT_EVIDENCE,
  ASSAY_TRANSFER_EVIDENCE,
  ASSAY_ASSIGNMENT_CHANGE_EVIDENCE,
} from "./descriptors";
import type {
  AssayAssignmentChangeEvidencePayload,
  AssayCompositionEvidencePayload,
  AssayEndpointCandidateEvidencePayload,
  AssayEndpointCandidateInput,
  AssayFormulaTraceEvidencePayload,
  AssayManualCorrectionEvidencePayload,
  AssayNormalizedResultEvidencePayload,
  AssayObservationEvidencePayload,
  AssayQcResultEvidencePayload,
  AssayTransferEvidencePayload,
} from "./types";

export interface AssayEvidenceAssemblyInput {
  bundleId: string;
  traceId: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  operationEvidence?: AssayOperationEvidence[];
  assignmentEvidence?: AssayAssignmentChangeEvidencePayload[];
  plateState?: PlateRuntimeState;
  observationSet?: AssayObservationSet;
  qcEvaluation?: AssayQcEvaluation;
  endpointCandidates?: AssayEndpointCandidateInput[];
}

export interface AssayEvidenceAssemblyResult {
  registry: EvidenceRegistry;
  bundle: EvidenceBundle;
  trace: RunTrace;
}

export const createAssayEvidenceRegistry = (): EvidenceRegistry =>
  createEvidenceRegistry(
    [coreEvidenceRegistryFragment, getAssayEvidenceRegistryFragment()],
    "1.0.0",
  );

const metadataFor = (registry: EvidenceRegistry, typeId: string) => {
  const descriptor = registry.get(typeId);
  if (!descriptor) throw new Error(`Evidence type ${typeId} is not registered.`);
  return {
    typeVersion: descriptor.version,
    metadata: {
      retentionClass: descriptor.retentionClass,
      sensitivity: descriptor.sensitivity,
      accessibleRepresentation: descriptor.accessibleRepresentation,
      redactionPolicyId: descriptor.redaction.policyId,
    },
  };
};

const record = <TPayload extends object>(
  registry: EvidenceRegistry,
  input: {
    evidenceId: string;
    typeId: string;
    occurredAt: string;
    producerId: string;
    summary: string;
    payload: TPayload;
  },
): EvidenceRecord => {
  const { typeVersion, metadata } = metadataFor(registry, input.typeId);
  return {
    evidenceId: input.evidenceId,
    typeId: input.typeId,
    typeVersion,
    occurredAt: input.occurredAt,
    producerId: input.producerId,
    summary: input.summary,
    metadata,
    payload: structuredClone(input.payload) as unknown as Record<string, unknown>,
  };
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const transferPayload = (
  evidence: AssayOperationEvidence,
): AssayTransferEvidencePayload | undefined => {
  if (
    evidence.outcome !== "accepted"
    || !["aspirate", "dispense", "discard", "mix"].includes(evidence.operationType)
  ) return undefined;
  const sourceRefs = stringArray(evidence.data.sourceRefs);
  const destinationRefs = stringArray(evidence.data.destinationRefs);
  const volume = stringValue(
    evidence.data.volumePerChannel
    ?? evidence.data.discardedVolume
    ?? evidence.data.volumePerCycle,
  );
  const unit = stringValue(evidence.data.unit);
  return {
    operationId: evidence.operationId,
    operationType: evidence.operationType as AssayTransferEvidencePayload["operationType"],
    summary: evidence.summary,
    objectRefs: [...evidence.objectRefs],
    sourceRefs,
    destinationRefs,
    ...(volume ? { volume } : {}),
    ...(unit ? { unit } : {}),
  };
};

const assertTimestampRange = (startedAt: string, completedAt: string) => {
  const start = Date.parse(startedAt);
  const completion = Date.parse(completedAt);
  if (
    !startedAt.includes("T")
    || !completedAt.includes("T")
    || !Number.isFinite(start)
    || !Number.isFinite(completion)
    || completion < start
  ) throw new Error("Assay evidence assembly requires valid ordered ISO-8601 timestamps.");
};

export const assembleAssayEvidence = (
  input: AssayEvidenceAssemblyInput,
): AssayEvidenceAssemblyResult => {
  assertTimestampRange(input.startedAt, input.completedAt);
  const registry = createAssayEvidenceRegistry();
  const records: EvidenceRecord[] = [];

  (input.assignmentEvidence ?? []).forEach((assignment) => {
    records.push(record(registry, {
      evidenceId: `${input.runId}:assignment:${assignment.assignmentId}`,
      typeId: ASSAY_ASSIGNMENT_CHANGE_EVIDENCE,
      occurredAt: input.startedAt,
      producerId: "assay.assignment.actions",
      summary: assignment.summary,
      payload: assignment,
    }));
  });

  (input.operationEvidence ?? []).forEach((operation, index) => {
    records.push(record(registry, {
      evidenceId: `${input.runId}:operation:${index + 1}`,
      typeId: operation.typeId,
      occurredAt: input.startedAt,
      producerId: "assay.runtime.reducer",
      summary: operation.summary,
      payload: operation,
    }));
    const transfer = transferPayload(operation);
    if (transfer) records.push(record(registry, {
      evidenceId: `${input.runId}:transfer:${operation.operationId}`,
      typeId: ASSAY_TRANSFER_EVIDENCE,
      occurredAt: input.startedAt,
      producerId: "assay.evidence.assembler",
      summary: operation.summary,
      payload: transfer,
    }));
  });

  input.plateState?.wells.filter(({ components }) => components.length > 0).forEach((well) => {
    const payload: AssayCompositionEvidencePayload = {
      plateId: input.plateState!.plateId,
      wellId: `${input.plateState!.plateId}:${well.coordinate}`,
      volume: well.volume.value,
      unit: well.volume.unit,
      mixed: well.mixed,
      components: well.components.map((component) => ({
        resourceRef: component.resourceRef,
        volume: component.volume.value,
        unit: component.volume.unit,
        ...(component.concentration ? {
          concentration: component.concentration.value,
          concentrationUnit: component.concentration.unit,
        } : {}),
        sourceRefs: [...component.sourceRefs],
      })),
    };
    records.push(record(registry, {
      evidenceId: `${input.runId}:composition:${well.coordinate}`,
      typeId: ASSAY_COMPOSITION_EVIDENCE,
      occurredAt: input.completedAt,
      producerId: "assay.evidence.assembler",
      summary: `Recorded final composition for well ${well.coordinate}.`,
      payload,
    }));
  });

  input.observationSet?.observations.forEach((observation) => {
    const correction = input.observationSet!.manualCorrections.find(
      ({ observationId }) => observationId === observation.id,
    );
    const payload: AssayObservationEvidencePayload = {
      observationId: observation.id,
      plateId: observation.plateId,
      wellId: observation.wellId,
      sourceType: observation.sourceType,
      value: correction?.acceptedValue ?? observation.rawValue,
      unit: observation.unit,
      reviewStatus: observation.reviewStatus,
      provenanceSourceId: observation.provenance.sourceId,
      provenanceSourceVersion: observation.provenance.sourceVersion,
    };
    records.push(record(registry, {
      evidenceId: `${input.runId}:observation:${observation.id}`,
      typeId: ASSAY_OBSERVATION_EVIDENCE,
      occurredAt: observation.capturedAt ?? input.completedAt,
      producerId: "assay.evidence.assembler",
      summary: `Recorded ${observation.reviewStatus} ${observation.sourceType} observation for ${observation.wellId}.`,
      payload,
    }));
  });

  input.observationSet?.manualCorrections.forEach((correction) => {
    const payload: AssayManualCorrectionEvidencePayload = {
      correctionId: correction.id,
      observationId: correction.observationId,
      previousValue: correction.previousValue,
      acceptedValue: correction.acceptedValue,
      ...(correction.reason ? { reason: correction.reason } : {}),
      actorRole: correction.actorRole,
      provenanceSourceId: correction.provenance.sourceId,
      provenanceSourceVersion: correction.provenance.sourceVersion,
    };
    records.push(record(registry, {
      evidenceId: `${input.runId}:correction:${correction.id}`,
      typeId: ASSAY_MANUAL_CORRECTION_EVIDENCE,
      occurredAt: correction.occurredAt,
      producerId: "assay.evidence.assembler",
      summary: `Recorded explicit correction ${correction.id}; no automatic deletion occurred.`,
      payload,
    }));
  });

  input.qcEvaluation?.ruleResults.forEach((result) => {
    const payload: AssayQcResultEvidencePayload = {
      evaluationId: input.qcEvaluation!.id,
      ruleId: result.ruleId,
      ruleType: result.ruleType,
      status: result.status,
      summary: result.summary,
      ...(result.metricValue !== undefined ? { metricValue: result.metricValue } : {}),
      ...(result.unit !== undefined ? { unit: result.unit } : {}),
      ...(result.threshold !== undefined ? { threshold: result.threshold } : {}),
      affectedWellIds: [...result.affectedWellIds],
      formulaTraceRefs: [...result.formulaTraceRefs],
      policySourceRef: input.qcEvaluation!.policySourceRef,
    };
    records.push(record(registry, {
      evidenceId: `${input.runId}:qc:${result.ruleId}`,
      typeId: ASSAY_QC_RESULT_EVIDENCE,
      occurredAt: input.completedAt,
      producerId: "assay.qc.engine",
      summary: result.summary,
      payload,
    }));
  });

  input.qcEvaluation?.formulaTraces.forEach((trace) => {
    const payload: AssayFormulaTraceEvidencePayload = {
      traceId: trace.id,
      policySourceRef: trace.policySourceRef,
      formula: trace.formula,
      inputRefs: [...trace.inputRefs],
      inputValues: [...trace.inputValues],
      result: trace.result,
      unit: trace.unit,
      rounding: trace.rounding,
    };
    records.push(record(registry, {
      evidenceId: trace.id,
      typeId: ASSAY_FORMULA_TRACE_EVIDENCE,
      occurredAt: input.completedAt,
      producerId: "assay.qc.engine",
      summary: `Recorded deterministic formula trace ${trace.id}.`,
      payload,
    }));
  });

  input.qcEvaluation?.wellResults.filter(
    ({ normalizedValue }) => normalizedValue !== undefined,
  ).forEach((result) => {
    const traceRef = `trace.normalization.${result.wellId}`;
    const trace = input.qcEvaluation!.formulaTraces.find(({ id }) => id === traceRef);
    const payload: AssayNormalizedResultEvidencePayload = {
      evaluationId: input.qcEvaluation!.id,
      wellId: result.wellId,
      observationId: result.observationId,
      rawValue: result.rawValue,
      ...(result.correctedValue !== undefined ? { correctedValue: result.correctedValue } : {}),
      normalizedValue: result.normalizedValue!,
      unit: trace?.unit ?? "%",
      formulaTraceRef: traceRef,
      policySourceRef: input.qcEvaluation!.policySourceRef,
    };
    records.push(record(registry, {
      evidenceId: `${input.runId}:normalized:${result.wellId}`,
      typeId: ASSAY_NORMALIZED_RESULT_EVIDENCE,
      occurredAt: input.completedAt,
      producerId: "assay.qc.engine",
      summary: `Recorded explicit normalized result for ${result.wellId}.`,
      payload,
    }));
  });

  (input.endpointCandidates ?? []).forEach((candidate) => {
    const payload: AssayEndpointCandidateEvidencePayload = structuredClone(candidate);
    records.push(record(registry, {
      evidenceId: `${input.runId}:endpoint-candidate:${candidate.candidateId}`,
      typeId: ASSAY_ENDPOINT_CANDIDATE_EVIDENCE,
      occurredAt: input.completedAt,
      producerId: "assay.analysis.endpoint-candidate",
      summary: `Recorded explicit ${candidate.status} endpoint candidate ${candidate.candidateId}.`,
      payload,
    }));
  });

  const bundle: EvidenceBundle = {
    schema: "studio.evidence-bundle",
    schemaVersion: "1.0",
    bundleId: input.bundleId,
    registryVersion: registry.registryDocument.version,
    createdAt: input.completedAt,
    records,
  };
  const bundleValidation = validateEvidenceBundle(bundle, registry);
  if (!bundleValidation.ok) throw new Error(
    bundleValidation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "),
  );

  const events: RunEvent[] = records.map((evidence, index) => ({
    schema: "studio.run-event",
    schemaVersion: "1.0",
    eventId: `${input.traceId}:event:${index + 1}`,
    sequence: index + 1,
    eventTypeId: evidence.typeId,
    occurredAt: evidence.occurredAt,
    ...(evidence.typeId === "assay.pipetting-operation" ? {
      operationRef: (evidence.payload as unknown as AssayOperationEvidence).operationId,
    } : {}),
    objectRefs: evidence.typeId === ASSAY_QC_RESULT_EVIDENCE
      ? [...(evidence.payload as unknown as AssayQcResultEvidencePayload).affectedWellIds]
      : evidence.typeId === ASSAY_OBSERVATION_EVIDENCE
        ? [(evidence.payload as unknown as AssayObservationEvidencePayload).wellId]
        : [],
    evidenceRefs: [evidence.evidenceId],
    outcome: evidence.typeId === "assay.pipetting-operation"
      ? (evidence.payload as unknown as AssayOperationEvidence).outcome
      : "recorded",
    summary: evidence.summary,
    data: {
      typeVersion: evidence.typeVersion,
      producerId: evidence.producerId,
    },
  }));
  events.sort((left, right) =>
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
    || left.sequence - right.sequence);
  events.forEach((event, index) => {
    event.sequence = index + 1;
    event.eventId = `${input.traceId}:event:${index + 1}`;
  });
  const trace: RunTrace = {
    schema: "studio.run-trace",
    schemaVersion: "1.0",
    traceId: input.traceId,
    runId: input.runId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    events,
  };
  const traceValidation = validateRunTrace(trace, registry, bundleValidation.value);
  if (!traceValidation.ok) throw new Error(
    traceValidation.diagnostics.map(({ code, path }) => `${code} at ${path}`).join("; "),
  );
  return {
    registry,
    bundle: bundleValidation.value,
    trace: traceValidation.value,
  };
};

export const ASSAY_EVIDENCE_SCHEMA_VERSION = ASSAY_CYCLE08_EVIDENCE_VERSION;
