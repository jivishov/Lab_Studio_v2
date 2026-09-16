import type { AuditEventRecord } from "../types";

const safeAuditKeys = new Set([
  "id", "registrationId", "deploymentId", "actorUserKey", "action", "targetType",
  "targetId", "outcome", "code", "occurredAt",
]);

export const redactAuditEvent = (event: AuditEventRecord): AuditEventRecord =>
  Object.fromEntries(Object.entries(event).filter(([key]) => safeAuditKeys.has(key))) as unknown as AuditEventRecord;

export const learningLogRecord = (
  requestId: string,
  method: string,
  route: string,
  status: number,
  code: string,
): Readonly<Record<string, string | number>> => Object.freeze({
  requestId,
  method,
  route,
  status,
  code,
});
