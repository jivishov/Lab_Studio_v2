import type {
  EvidenceBundle,
  EvidenceRecord,
  RunEvent,
  RunTrace,
} from "../../platform/evidence/types";
import { validateEvidenceBundle, validateRunTrace } from "../../platform/evidence/validation";
import { causalystEvidenceRegistry } from "./registry";

export type SemanticTraceEventInput = Omit<
  RunEvent,
  "schema" | "schemaVersion" | "sequence"
>;

export class CausalystTraceCollector {
  readonly bundleId: string;
  readonly runId: string;
  readonly traceId: string;
  readonly startedAt: string;
  private readonly records: EvidenceRecord[] = [];
  private readonly events: RunEvent[] = [];
  private completedAt?: string;

  constructor(input: {
    bundleId: string;
    runId: string;
    traceId: string;
    startedAt: string;
  }) {
    if (!Number.isFinite(Date.parse(input.startedAt))) throw new Error("Trace start must be an ISO-8601 timestamp.");
    this.bundleId = input.bundleId;
    this.runId = input.runId;
    this.traceId = input.traceId;
    this.startedAt = input.startedAt;
  }

  addEvidence(record: EvidenceRecord): void {
    if (this.records.some(({ evidenceId }) => evidenceId === record.evidenceId)) {
      throw new Error(`Evidence ${record.evidenceId} already exists in this trace.`);
    }
    this.records.push(structuredClone(record));
  }

  addEvent(input: SemanticTraceEventInput): void {
    if (this.completedAt) throw new Error("A completed trace cannot accept more events.");
    if (this.events.some(({ eventId }) => eventId === input.eventId)) {
      throw new Error(`Event ${input.eventId} already exists in this trace.`);
    }
    this.events.push({
      schema: "studio.run-event",
      schemaVersion: "1.0",
      ...structuredClone(input),
      sequence: this.events.length + 1,
    });
  }

  complete(completedAt: string): void {
    if (!Number.isFinite(Date.parse(completedAt))) throw new Error("Trace completion must be an ISO-8601 timestamp.");
    this.completedAt = completedAt;
  }

  build(createdAt = this.completedAt ?? this.startedAt): {
    evidenceBundle: EvidenceBundle;
    runTrace: RunTrace;
  } {
    const evidenceBundle: EvidenceBundle = {
      schema: "studio.evidence-bundle",
      schemaVersion: "1.0",
      bundleId: this.bundleId,
      registryVersion: causalystEvidenceRegistry.registryDocument.version,
      createdAt,
      records: structuredClone(this.records),
    };
    const runTrace: RunTrace = {
      schema: "studio.run-trace",
      schemaVersion: "1.0",
      traceId: this.traceId,
      runId: this.runId,
      startedAt: this.startedAt,
      ...(this.completedAt ? { completedAt: this.completedAt } : {}),
      events: structuredClone(this.events),
    };
    const evidenceValidation = validateEvidenceBundle(evidenceBundle, causalystEvidenceRegistry);
    if (!evidenceValidation.ok) throw new Error(evidenceValidation.diagnostics
      .map(({ code, path }) => `${code} at ${path}`).join("; "));
    const traceValidation = validateRunTrace(runTrace, causalystEvidenceRegistry, evidenceBundle);
    if (!traceValidation.ok) throw new Error(traceValidation.diagnostics
      .map(({ code, path }) => `${code} at ${path}`).join("; "));
    return { evidenceBundle, runTrace };
  }
}

