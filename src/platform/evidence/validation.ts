import type { ContractDiagnostic, ContractValidationResult } from "../validation/jsonSchema";
import {
  validateEvidenceBundleSchema,
  validateRunEventSchema,
  validateRunTraceSchema,
} from "./schema";
import { findForbiddenEvidenceData } from "./security";
import type { EvidenceBundle, EvidenceRegistry, RunEvent, RunTrace } from "./types";

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const isTimestamp = (value: string): boolean => value.includes("T") && Number.isFinite(Date.parse(value));

const duplicateStrings = (values: readonly string[], path: string, code: string): ContractDiagnostic[] => {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    if (seen.has(value)) return [error(code, `${path}/${index}`, `Duplicate reference ${value}.`)];
    seen.add(value);
    return [];
  });
};

export const validateEvidenceBundle = (
  input: unknown,
  registry: EvidenceRegistry,
): ContractValidationResult<EvidenceBundle> => {
  const schemaResult = validateEvidenceBundleSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const bundle = schemaResult.value;
  const diagnostics: ContractDiagnostic[] = [];
  if (!isTimestamp(bundle.createdAt)) diagnostics.push(error("evidence.bundle.created-at.invalid", "/createdAt", "createdAt must be an ISO-8601 timestamp."));
  if (bundle.registryVersion !== registry.registryDocument.version) diagnostics.push(error("evidence.bundle.registry-version-mismatch", "/registryVersion", `Evidence bundle requires registry ${bundle.registryVersion}, but ${registry.registryDocument.version} is active.`));
  diagnostics.push(...duplicateStrings(bundle.records.map(({ evidenceId }) => evidenceId), "/records", "evidence.record.duplicate"));

  bundle.records.forEach((record, index) => {
    const recordPath = `/records/${index}`;
    if (!isTimestamp(record.occurredAt)) diagnostics.push(error("evidence.record.occurred-at.invalid", `${recordPath}/occurredAt`, "occurredAt must be an ISO-8601 timestamp."));
    else if (isTimestamp(bundle.createdAt) && Date.parse(record.occurredAt) > Date.parse(bundle.createdAt)) diagnostics.push(error("evidence.record.after-bundle", `${recordPath}/occurredAt`, "Evidence cannot occur after its bundle is created."));
    diagnostics.push(...findForbiddenEvidenceData(record.summary, `${recordPath}/summary`));
    const descriptor = registry.get(record.typeId, record.typeVersion);
    if (!descriptor) {
      const known = registry.get(record.typeId);
      diagnostics.push(error(
        known ? "evidence.type.version-mismatch" : "evidence.type.not-registered",
        known ? `${recordPath}/typeVersion` : `${recordPath}/typeId`,
        known ? `Evidence type ${record.typeId} requires ${known.version}, not ${record.typeVersion}.` : `Evidence type ${record.typeId} is not registered.`,
      ));
      return;
    }
    if (!descriptor.producerIds.includes(record.producerId)) diagnostics.push(error("evidence.producer.not-declared", `${recordPath}/producerId`, `Producer ${record.producerId} is not declared for ${record.typeId}.`));
    const expectedMetadata = {
      retentionClass: descriptor.retentionClass,
      sensitivity: descriptor.sensitivity,
      accessibleRepresentation: descriptor.accessibleRepresentation,
      redactionPolicyId: descriptor.redaction.policyId,
    };
    (Object.keys(expectedMetadata) as Array<keyof typeof expectedMetadata>).forEach((key) => {
      if (record.metadata[key] !== expectedMetadata[key]) diagnostics.push(error("evidence.metadata.policy-mismatch", `${recordPath}/metadata/${key}`, `Evidence metadata must match the registered ${key} policy.`));
    });
    const payloadResult = registry.validatePayload(record.typeId, record.typeVersion, record.payload);
    if (!payloadResult.ok) diagnostics.push(...payloadResult.diagnostics.map((item) => ({
      ...item,
      path: `${recordPath}${item.path}`,
    })));
  });
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, value: bundle, diagnostics: [] };
};

export interface RunEventValidationContext {
  registry: EvidenceRegistry;
  evidenceIds?: ReadonlySet<string>;
}

export const validateRunEvent = (
  input: unknown,
  context: RunEventValidationContext,
): ContractValidationResult<RunEvent> => {
  const schemaResult = validateRunEventSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const event = schemaResult.value;
  const diagnostics = findForbiddenEvidenceData(event);
  if (!isTimestamp(event.occurredAt)) diagnostics.push(error("run-event.occurred-at.invalid", "/occurredAt", "occurredAt must be an ISO-8601 timestamp."));
  if (!context.registry.get(event.eventTypeId)) diagnostics.push(error("run-event.type.not-registered", "/eventTypeId", `Run event type ${event.eventTypeId} is not registered as evidence.`));
  if (context.evidenceIds) event.evidenceRefs.forEach((id, index) => {
    if (!context.evidenceIds?.has(id)) diagnostics.push(error("run-event.evidence.dangling", `/evidenceRefs/${index}`, `Evidence ${id} is not present in the evidence bundle.`));
  });
  if (event.eventTypeId === "action.completed") {
    if (!event.nodeId) diagnostics.push(error("run-event.action.node-required", "/nodeId", "Completed actions require a process node."));
    if (!event.operationRef) diagnostics.push(error("run-event.action.operation-required", "/operationRef", "Completed actions require an operation reference."));
    if (event.evidenceRefs.length === 0) diagnostics.push(error("run-event.action.evidence-required", "/evidenceRefs", "Completed actions require linked evidence."));
  }
  if (event.eventTypeId === "state.transition") {
    if (event.objectRefs.length === 0) diagnostics.push(error("run-event.transition.object-required", "/objectRefs", "State transitions require affected object references."));
    if (event.evidenceRefs.length === 0) diagnostics.push(error("run-event.transition.evidence-required", "/evidenceRefs", "State transitions require linked evidence."));
  }
  if (["measurement.scalar", "measurement.series", "calculation.result", "observation.text", "observation.image-derived", "artifact.snapshot", "artifact.validation", "procedure.coverage", "run.plan", "explanation.response", "rubric.mapping"].includes(event.eventTypeId)
    && event.evidenceRefs.length === 0) diagnostics.push(error("run-event.semantic-evidence-required", "/evidenceRefs", `${event.eventTypeId} events require linked evidence.`));
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, value: event, diagnostics: [] };
};

export const validateRunTrace = (
  input: unknown,
  registry: EvidenceRegistry,
  evidenceBundle?: EvidenceBundle,
): ContractValidationResult<RunTrace> => {
  const schemaResult = validateRunTraceSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const trace = schemaResult.value;
  const evidenceIds = evidenceBundle ? new Set(evidenceBundle.records.map(({ evidenceId }) => evidenceId)) : undefined;
  const diagnostics: ContractDiagnostic[] = [];
  if (!isTimestamp(trace.startedAt)) diagnostics.push(error("run-trace.started-at.invalid", "/startedAt", "startedAt must be an ISO-8601 timestamp."));
  if (trace.completedAt && !isTimestamp(trace.completedAt)) diagnostics.push(error("run-trace.completed-at.invalid", "/completedAt", "completedAt must be an ISO-8601 timestamp."));
  if (trace.completedAt && isTimestamp(trace.startedAt) && isTimestamp(trace.completedAt) && Date.parse(trace.completedAt) < Date.parse(trace.startedAt)) diagnostics.push(error("run-trace.completed-before-start", "/completedAt", "completedAt cannot precede startedAt."));
  diagnostics.push(...duplicateStrings(trace.events.map(({ eventId }) => eventId), "/events", "run-event.id.duplicate"));

  let previousTimestamp = Number.NEGATIVE_INFINITY;
  trace.events.forEach((event, index) => {
    const eventResult = validateRunEvent(event, { registry, evidenceIds });
    if (!eventResult.ok) diagnostics.push(...eventResult.diagnostics.map((item) => ({ ...item, path: `/events/${index}${item.path === "/" ? "" : item.path}` })));
    if (event.sequence !== index + 1) diagnostics.push(error("run-event.sequence.non-contiguous", `/events/${index}/sequence`, `Expected sequence ${index + 1}, received ${event.sequence}.`));
    const occurredAt = Date.parse(event.occurredAt);
    if (Number.isFinite(occurredAt)) {
      if (occurredAt < previousTimestamp) diagnostics.push(error("run-event.timestamp.out-of-order", `/events/${index}/occurredAt`, "Run event timestamps must be nondecreasing."));
      if (isTimestamp(trace.startedAt) && occurredAt < Date.parse(trace.startedAt)) diagnostics.push(error("run-event.before-trace-start", `/events/${index}/occurredAt`, "Run event cannot precede trace start."));
      if (trace.completedAt && isTimestamp(trace.completedAt) && occurredAt > Date.parse(trace.completedAt)) diagnostics.push(error("run-event.after-trace-completion", `/events/${index}/occurredAt`, "Run event cannot follow trace completion."));
      previousTimestamp = Math.max(previousTimestamp, occurredAt);
    }
  });
  diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, value: trace, diagnostics: [] };
};
