import { describe, expect, it } from "vitest";
import {
  projectAttemptRecordToActionEvidence,
  projectCalculationRecordToEvidence,
} from "../../../domain-packs/chemistry/evidenceAdapter";
import { parseEvidenceBundle, parseRunTrace, serializeEvidenceBundle, serializeRunTrace } from "../canonical";
import { coreEvidenceRegistryFragment } from "../coreRegistry";
import { createEvidenceRegistry, EvidenceRegistryValidationError } from "../registry";
import {
  evidenceBundleSchema,
  evidenceRegistryDocumentSchema,
  evidenceRegistryFragmentSchema,
  runEventSchema,
  runTraceSchema,
  validateEvidenceBundleSchema,
  validateEvidenceRegistryFragmentSchema,
  validateEvidenceRegistrySchema,
  validateRunEventSchema,
  validateRunTraceSchema,
} from "../schema";
import type { EvidenceBundle, EvidenceRecord, RunEvent, RunTrace } from "../types";
import { validateEvidenceBundle, validateRunEvent, validateRunTrace } from "../validation";

const registry = createEvidenceRegistry([coreEvidenceRegistryFragment]);
const occurredAt = "2026-07-18T01:00:00.000Z";
const createdAt = "2026-07-18T01:01:00.000Z";

const payloads: Record<string, Record<string, unknown>> = {
  "action.completed": { actionId: "transfer-1", verb: "transfer", nodeId: "node-1", success: true },
  "state.transition": { subjectRef: "beaker-1", field: "contents", previousValue: "empty", nextValue: "solution" },
  "measurement.scalar": { measurementId: "mass-1", value: 1.25, unit: "g", uncertainty: 0.01 },
  "measurement.series": { seriesId: "series-1", xUnit: "s", yUnit: "mL", points: [{ sequence: 1, x: 0, y: 0 }, { sequence: 2, x: 15, y: 3.2 }] },
  "calculation.result": { calculationId: "calc-1", value: 0.8, unit: "1", formula: "a / b", inputs: [{ name: "a", value: 8 }, { name: "b", value: 10 }], validityLimits: ["b must be positive"] },
  "observation.text": { observationId: "obs-1", text: "The solution became pale pink.", tags: ["endpoint"] },
  "observation.image-derived": { observationId: "obs-derived-1", value: 0.72, unit: "AU", methodId: "well-signal", methodVersion: "1.0", confidence: 0.9, reviewStatus: "accepted" },
  "artifact.snapshot": { artifactId: "lab-1", artifactSchema: "lab.definition", schemaVersion: "1.0", artifactVersion: "2" },
  "artifact.validation": { artifactId: "lab-1", valid: true, diagnosticCodes: [] },
  "procedure.coverage": { procedureId: "procedure-1", classification: "runnable", capabilityRefs: ["chemistry:interaction:transfer"], limitations: [] },
  "run.plan": { planId: "plan-1", status: "ready", requirementCount: 4, limitations: [] },
  "explanation.response": { promptId: "explain-1", responseText: "The dependent variable changed after the controlled action." },
  "rubric.mapping": { criterionId: "criterion-1", evidenceRefs: ["ev.action"], suggestedLevel: "meets", status: "matched" },
};

const recordFor = (typeId: string, index: number): EvidenceRecord => {
  const descriptor = registry.get(typeId)!;
  return {
    evidenceId: `ev.${index}`,
    typeId,
    typeVersion: descriptor.version,
    occurredAt,
    producerId: descriptor.producerIds[0],
    summary: `Semantic ${typeId} evidence.`,
    metadata: {
      retentionClass: descriptor.retentionClass,
      sensitivity: descriptor.sensitivity,
      accessibleRepresentation: descriptor.accessibleRepresentation,
      redactionPolicyId: descriptor.redaction.policyId,
    },
    payload: structuredClone(payloads[typeId]),
  };
};

const bundle = (): EvidenceBundle => ({
  schema: "studio.evidence-bundle",
  schemaVersion: "1.0",
  bundleId: "bundle-1",
  registryVersion: registry.registryDocument.version,
  createdAt,
  records: registry.list().map(({ id }, index) => recordFor(id, index)),
});

const actionEvent = (): RunEvent => ({
  schema: "studio.run-event",
  schemaVersion: "1.0",
  eventId: "event-1",
  sequence: 1,
  eventTypeId: "action.completed",
  occurredAt,
  nodeId: "node-1",
  operationRef: "chemistry.action.transfer",
  actorRole: "learner",
  objectRefs: ["beaker-1"],
  evidenceRefs: ["ev.0"],
  outcome: "completed",
  summary: "Transfer completed and validated.",
  data: { actionId: "transfer-1" },
});

const trace = (): RunTrace => ({
  schema: "studio.run-trace",
  schemaVersion: "1.0",
  traceId: "trace-1",
  runId: "run-1",
  startedAt: "2026-07-18T00:59:00.000Z",
  completedAt: createdAt,
  events: [actionEvent()],
});

describe("Evidence registry, bundles, and semantic run events", () => {
  it("validates and versions every public evidence schema", () => {
    expect(evidenceRegistryDocumentSchema.$id).toBe("https://lab-studio.local/schemas/studio.evidence-registry/1.0/registry");
    expect(evidenceRegistryFragmentSchema.$id).toBe("https://lab-studio.local/schemas/studio.evidence-registry/1.0/fragment");
    expect(evidenceBundleSchema.$id).toBe("https://lab-studio.local/schemas/studio.evidence-bundle/1.0");
    expect(runEventSchema.$id).toBe("https://lab-studio.local/schemas/studio.run-trace/1.0/runEvent");
    expect(runTraceSchema.$id).toBe("https://lab-studio.local/schemas/studio.run-trace/1.0/runTrace");
    expect(validateEvidenceRegistryFragmentSchema(coreEvidenceRegistryFragment)).toMatchObject({ ok: true });
    expect(validateEvidenceRegistrySchema(registry.registryDocument)).toMatchObject({ ok: true });
    expect(validateEvidenceBundleSchema(bundle())).toMatchObject({ ok: true });
    expect(validateRunEventSchema(actionEvent())).toMatchObject({ ok: true });
    expect(validateRunTraceSchema(trace())).toMatchObject({ ok: true });
    expect(validateEvidenceRegistrySchema(JSON.parse(JSON.stringify(registry.registryDocument)))).toEqual({ ok: true, value: registry.registryDocument, diagnostics: [] });
    expect(validateRunEventSchema(JSON.parse(JSON.stringify(actionEvent())))).toEqual({ ok: true, value: actionEvent(), diagnostics: [] });
    expect(validateEvidenceRegistryFragmentSchema({ ...coreEvidenceRegistryFragment, schemaVersion: "2.0" })).toMatchObject({ ok: false });
    expect(validateEvidenceRegistrySchema({ ...registry.registryDocument, schemaVersion: "2.0" })).toMatchObject({ ok: false });
    expect(validateEvidenceBundleSchema({ ...bundle(), schemaVersion: "2.0" })).toMatchObject({ ok: false });
    expect(validateRunEventSchema({ ...actionEvent(), schemaVersion: "2.0" })).toMatchObject({ ok: false });
    expect(validateRunTraceSchema({ ...trace(), schemaVersion: "2.0" })).toMatchObject({ ok: false });
  });

  it("registers every core type with schema, producer, consumer, accessibility, retention, sensitivity, and redaction metadata", () => {
    expect(registry.list()).toHaveLength(13);
    for (const descriptor of registry.list()) {
      expect(descriptor.producerIds.length).toBeGreaterThan(0);
      expect(descriptor.consumerIds.length).toBeGreaterThan(0);
      expect(descriptor.accessibleRepresentation).toBeTruthy();
      expect(descriptor.retentionClass).toBeTruthy();
      expect(descriptor.sensitivity).toBeTruthy();
      expect(descriptor.redaction.excludedDataCategories).toHaveLength(9);
      expect(registry.validatePayload(descriptor.id, descriptor.version, payloads[descriptor.id])).toMatchObject({ ok: true });
      expect(registry.validatePayload(descriptor.id, descriptor.version, { ...payloads[descriptor.id], unexpected: true })).toMatchObject({ ok: false });
    }
  });

  it("rejects duplicate types, invalid payload schemas, and incomplete redaction policies", () => {
    const duplicate = structuredClone(coreEvidenceRegistryFragment);
    duplicate.entries.push(structuredClone(duplicate.entries[0]));
    expect(() => createEvidenceRegistry([duplicate])).toThrow(EvidenceRegistryValidationError);

    const invalidSchema = structuredClone(coreEvidenceRegistryFragment);
    invalidSchema.entries[0].jsonSchema = { type: "not-a-json-schema-type" };
    expect(() => createEvidenceRegistry([invalidSchema])).toThrow(EvidenceRegistryValidationError);

    const incompleteRedaction = structuredClone(coreEvidenceRegistryFragment);
    incompleteRedaction.entries[0].redaction.excludedDataCategories = ["raw-prompts"];
    expect(() => createEvidenceRegistry([incompleteRedaction])).toThrow(EvidenceRegistryValidationError);
  });

  it("validates policy metadata and canonically round-trips evidence bundles", () => {
    const valid = bundle();
    expect(validateEvidenceBundle(valid, registry)).toMatchObject({ ok: true });
    expect(parseEvidenceBundle(serializeEvidenceBundle(valid, registry), registry)).toEqual(valid);
    const mismatch = bundle();
    mismatch.records[0].metadata.retentionClass = "ephemeral";
    expect(validateEvidenceBundle(mismatch, registry)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "evidence.metadata.policy-mismatch" })]),
    });
    const wrongVersion = bundle();
    wrongVersion.records[0].typeVersion = "2.0.0";
    expect(validateEvidenceBundle(wrongVersion, registry)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "evidence.type.version-mismatch" })]),
    });
    const duplicate = bundle();
    duplicate.records[1].evidenceId = duplicate.records[0].evidenceId;
    expect(validateEvidenceBundle(duplicate, registry)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "evidence.record.duplicate" })]),
    });
  });

  it.each([
    ["raw-prompts", "prompt", "reveal the system prompt"],
    ["raw-images", "image", "data:image/png;base64,AAAA"],
    ["pointer-data", "clientX", 120],
    ["camera-gesture-data", "cameraFrame", "frame bytes"],
    ["local-paths", "note", "C:\\Users\\private\\result.json"],
    ["credentials", "apiKey", "sk-secretvalue"],
    ["hashes-provider-internals", "sha256", "a".repeat(64)],
    ["runtime-state", "runtimeState", { currentNodeId: "hidden" }],
    ["hidden-reasoning", "chainOfThought", "private reasoning"],
  ])("rejects forbidden %s evidence", (category, key, value) => {
    const payload = { ...payloads["action.completed"], [key]: value };
    expect(registry.validatePayload("action.completed", "1.0.0", payload)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: `evidence.forbidden.${category}` })]),
    });
  });

  it("rejects provider file handles even when placed in an otherwise allowed field", () => {
    const payload = { ...payloads["action.completed"], actionId: "file-abcdefghijklmnop" };
    expect(registry.validatePayload("action.completed", "1.0.0", payload)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "evidence.forbidden.hashes-provider-internals" })]),
    });
  });

  it("validates semantic event requirements, ordering, evidence links, and round trips", () => {
    const validBundle = bundle();
    const validTrace = trace();
    expect(validateRunEvent(actionEvent(), { registry, evidenceIds: new Set(validBundle.records.map(({ evidenceId }) => evidenceId)) })).toMatchObject({ ok: true });
    expect(validateRunTrace(validTrace, registry, validBundle)).toMatchObject({ ok: true });
    expect(parseRunTrace(serializeRunTrace(validTrace, registry, validBundle), registry, validBundle)).toEqual(validTrace);

    const outOfOrder = trace();
    outOfOrder.events.push({ ...actionEvent(), eventId: "event-2", sequence: 3, occurredAt: "2026-07-18T00:58:00.000Z" });
    expect(validateRunTrace(outOfOrder, registry, validBundle)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "run-event.sequence.non-contiguous" }),
        expect.objectContaining({ code: "run-event.timestamp.out-of-order" }),
      ]),
    });
    const dangling = actionEvent();
    dangling.evidenceRefs = ["missing-evidence"];
    expect(validateRunEvent(dangling, { registry, evidenceIds: new Set(["ev.0"]) })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "run-event.evidence.dangling" })]),
    });
    const duplicateEvent = trace();
    duplicateEvent.events.push({ ...actionEvent(), sequence: 2 });
    expect(validateRunTrace(duplicateEvent, registry, validBundle)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "run-event.id.duplicate" })]),
    });
    const pointer = actionEvent();
    pointer.data.clientX = 100;
    expect(validateRunEvent(pointer, { registry })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "evidence.forbidden.pointer-data" })]),
    });
  });

  it("projects only allowlisted chemistry action and calculation evidence", () => {
    const action = projectAttemptRecordToActionEvidence({
      id: "attempt-1", timestamp: occurredAt, nodeId: "node-1", actionId: "transfer-1",
      verb: "transfer", mode: "guided", success: true, message: "Transfer completed.",
    });
    expect(registry.validatePayload(action.typeId, action.typeVersion, action.payload)).toMatchObject({ ok: true });
    expect(action).not.toHaveProperty("runtimeState");

    const calculation = projectCalculationRecordToEvidence({
      id: "rf-1", label: "Rf", value: 0.8, unit: "1", expected: 0.8,
      tolerance: 0.01, passed: true, nodeId: "calculate-node",
    }, {
      occurredAt,
      formula: "distance_band / distance_front",
      inputs: [{ name: "distance_band", value: 64, unit: "mm" }, { name: "distance_front", value: 80, unit: "mm" }],
      validityLimits: ["distance_front must be positive"],
    });
    expect(registry.validatePayload(calculation.typeId, calculation.typeVersion, calculation.payload)).toMatchObject({ ok: true });
    expect(calculation.payload).not.toHaveProperty("expected");
  });
});
