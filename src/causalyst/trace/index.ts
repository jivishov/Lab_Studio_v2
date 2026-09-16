export * from "./collector";
export * from "./registry";
export * from "./replay";

import type { RunEvent, RunTrace } from "../../platform/evidence/types";

const forbiddenEventKey = /(pointer|coordinate|camera|gesture|landmark|chain.?of.?thought|hidden.?reason|credential|provider|file.?id|local.?path|hash)/i;

export const createSemanticTrace = (traceId: string, runId: string, startedAt: string): RunTrace => ({
  schema: "studio.run-trace",
  schemaVersion: "1.0",
  traceId,
  runId,
  startedAt,
  events: [],
});

export const appendSemanticEvent = (
  trace: RunTrace,
  event: Omit<RunEvent, "schema" | "schemaVersion" | "sequence">,
): RunTrace => {
  const leaked = Object.keys(event.data).find((key) => forbiddenEventKey.test(key));
  if (leaked) throw new Error(`Trace data field ${leaked} is outside the semantic-event boundary.`);
  return { ...trace, events: [...trace.events, {
    ...event,
    schema: "studio.run-event",
    schemaVersion: "1.0",
    sequence: trace.events.length + 1,
  }] };
};

export const completeSemanticTrace = (trace: RunTrace, completedAt: string): RunTrace => ({ ...trace, completedAt });

export const replayTimeline = (trace: RunTrace) => trace.events.map((event) => ({
  sequence: event.sequence,
  occurredAt: event.occurredAt,
  summary: event.summary,
  outcome: event.outcome,
  evidenceRefs: [...event.evidenceRefs],
}));
