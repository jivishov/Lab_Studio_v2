import type { EvidenceBundle, RunTrace } from "../../platform/evidence/types";

export interface ReplayTimelineEntry {
  sequence: number;
  occurredAt: string;
  eventTypeId: string;
  processNode?: string;
  operationRef?: string;
  objectRefs: string[];
  outcome: string;
  summary: string;
  evidence: Array<{
    evidenceId: string;
    typeId: string;
    summary: string;
  }>;
}

export const createReplayTimeline = (
  trace: RunTrace,
  bundle: EvidenceBundle,
): ReplayTimelineEntry[] => {
  const evidence = new Map(bundle.records.map((record) => [record.evidenceId, record]));
  return trace.events.map((event) => ({
    sequence: event.sequence,
    occurredAt: event.occurredAt,
    eventTypeId: event.eventTypeId,
    ...(event.nodeId ? { processNode: event.nodeId } : {}),
    ...(event.operationRef ? { operationRef: event.operationRef } : {}),
    objectRefs: [...event.objectRefs],
    outcome: event.outcome,
    summary: event.summary,
    evidence: event.evidenceRefs.flatMap((evidenceId) => {
      const record = evidence.get(evidenceId);
      return record ? [{
        evidenceId,
        typeId: record.typeId,
        summary: record.summary,
      }] : [];
    }),
  }));
};

