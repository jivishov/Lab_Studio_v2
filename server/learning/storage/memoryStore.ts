import type { LearningStore } from "./port";
import type {
  AgsTransactionRecord,
  AssignmentRecord,
  AuditEventRecord,
  LaunchCodeRecord,
  LoginStateRecord,
  PseudonymousUserRecord,
  ResourceLinkRecord,
  ReviewRecord,
  SubmissionRecord,
} from "../types";

const clone = <T>(value: T): T => structuredClone(value);
const scopeKey = (...parts: string[]): string => parts.join("\0");

export class MemoryLearningStore implements LearningStore {
  private readonly loginStates = new Map<string, LoginStateRecord>();
  private readonly launchCodes = new Map<string, LaunchCodeRecord>();
  private readonly users = new Map<string, PseudonymousUserRecord>();
  private readonly assignments = new Map<string, AssignmentRecord>();
  private readonly resourceLinks = new Map<string, ResourceLinkRecord>();
  private readonly submissions = new Map<string, SubmissionRecord>();
  private readonly reviews = new Map<string, ReviewRecord>();
  private readonly agsTransactions = new Map<string, AgsTransactionRecord>();
  readonly audits: AuditEventRecord[] = [];

  async putLoginState(record: LoginStateRecord): Promise<void> {
    if (this.loginStates.has(record.stateHash)) throw new Error("Duplicate login state.");
    this.loginStates.set(record.stateHash, clone(record));
  }
  async consumeLoginState(stateHash: string, consumedAt: string): Promise<LoginStateRecord | undefined> {
    const found = this.loginStates.get(stateHash);
    if (!found || found.consumedAt || Date.parse(found.expiresAt) <= Date.parse(consumedAt)) return undefined;
    const consumed = { ...found, consumedAt };
    this.loginStates.set(stateHash, consumed);
    return clone(consumed);
  }
  async putLaunchCode(record: LaunchCodeRecord): Promise<void> {
    if (this.launchCodes.has(record.codeHash)) throw new Error("Duplicate launch code.");
    this.launchCodes.set(record.codeHash, clone(record));
  }
  async consumeLaunchCode(codeHash: string, consumedAt: string): Promise<LaunchCodeRecord | undefined> {
    const found = this.launchCodes.get(codeHash);
    if (!found || found.consumedAt || Date.parse(found.expiresAt) <= Date.parse(consumedAt)) return undefined;
    const consumed = { ...found, consumedAt };
    this.launchCodes.set(codeHash, consumed);
    return clone(consumed);
  }
  async upsertUser(record: PseudonymousUserRecord): Promise<PseudonymousUserRecord> {
    const key = scopeKey(record.registrationId, record.deploymentId, record.userKey);
    const current = this.users.get(key);
    const next = current ? { ...current, lastSeenAt: record.lastSeenAt } : clone(record);
    this.users.set(key, next);
    return clone(next);
  }
  async getUser(scope: { registrationId: string; deploymentId: string; userKey: string }): Promise<PseudonymousUserRecord | undefined> {
    const value = this.users.get(scopeKey(scope.registrationId, scope.deploymentId, scope.userKey));
    return value ? clone(value) : undefined;
  }
  async putAssignment(record: AssignmentRecord): Promise<void> {
    this.assignments.set(scopeKey(record.registrationId, record.deploymentId, record.id), clone(record));
  }
  async getAssignment(scope: { registrationId: string; deploymentId: string; id: string }): Promise<AssignmentRecord | undefined> {
    const value = this.assignments.get(scopeKey(scope.registrationId, scope.deploymentId, scope.id));
    return value && !value.deletedAt ? clone(value) : undefined;
  }
  async putResourceLink(record: ResourceLinkRecord): Promise<void> {
    this.resourceLinks.set(scopeKey(record.registrationId, record.deploymentId, record.resourceLinkId), clone(record));
  }
  async getResourceLink(scope: { registrationId: string; deploymentId: string; resourceLinkId: string }): Promise<ResourceLinkRecord | undefined> {
    const value = this.resourceLinks.get(scopeKey(scope.registrationId, scope.deploymentId, scope.resourceLinkId));
    return value ? clone(value) : undefined;
  }
  async putSubmission(record: SubmissionRecord): Promise<void> {
    this.submissions.set(scopeKey(record.registrationId, record.deploymentId, record.id), clone(record));
  }
  async getSubmission(scope: { registrationId: string; deploymentId: string; id: string }): Promise<SubmissionRecord | undefined> {
    const value = this.submissions.get(scopeKey(scope.registrationId, scope.deploymentId, scope.id));
    return value && !value.deletedAt ? clone(value) : undefined;
  }
  async listSubmissions(scope: { registrationId: string; deploymentId: string; assignmentId: string }): Promise<SubmissionRecord[]> {
    return [...this.submissions.values()]
      .filter((value) => !value.deletedAt
        && value.registrationId === scope.registrationId
        && value.deploymentId === scope.deploymentId
        && value.assignmentId === scope.assignmentId)
      .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id))
      .map(clone);
  }
  async putReview(record: ReviewRecord): Promise<void> {
    this.reviews.set(scopeKey(record.registrationId, record.deploymentId, record.id), clone(record));
  }
  async listReviews(scope: { registrationId: string; deploymentId: string; submissionId: string }): Promise<ReviewRecord[]> {
    return [...this.reviews.values()]
      .filter((value) => value.registrationId === scope.registrationId
        && value.deploymentId === scope.deploymentId
        && value.submissionId === scope.submissionId)
      .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt) || left.id.localeCompare(right.id))
      .map(clone);
  }
  async putAgsTransaction(record: AgsTransactionRecord): Promise<void> {
    this.agsTransactions.set(scopeKey(record.registrationId, record.deploymentId, record.idempotencyKey), clone(record));
  }
  async getAgsTransaction(scope: { registrationId: string; deploymentId: string; idempotencyKey: string }): Promise<AgsTransactionRecord | undefined> {
    const value = this.agsTransactions.get(scopeKey(scope.registrationId, scope.deploymentId, scope.idempotencyKey));
    return value ? clone(value) : undefined;
  }
  async appendAudit(record: AuditEventRecord): Promise<void> { this.audits.push(clone(record)); }
  async deleteAssignment(scope: { registrationId: string; deploymentId: string; id: string; deletedAt: string }): Promise<number> {
    const assignment = await this.getAssignment(scope);
    if (!assignment) return 0;
    await this.putAssignment({ ...assignment, deletedAt: scope.deletedAt });
    for (const submission of await this.listSubmissions({ ...scope, assignmentId: scope.id })) {
      await this.putSubmission({ ...submission, deletedAt: scope.deletedAt });
    }
    return 1;
  }
  async deleteUser(scope: { registrationId: string; deploymentId: string; userKey: string; deletedAt: string }): Promise<number> {
    const key = scopeKey(scope.registrationId, scope.deploymentId, scope.userKey);
    const existed = this.users.delete(key);
    for (const submission of this.submissions.values()) {
      if (submission.registrationId === scope.registrationId && submission.deploymentId === scope.deploymentId
        && submission.learnerUserKey === scope.userKey) submission.deletedAt = scope.deletedAt;
    }
    return existed ? 1 : 0;
  }
  async deleteDeployment(scope: { registrationId: string; deploymentId: string; deletedAt: string }): Promise<number> {
    let count = 0;
    for (const assignment of this.assignments.values()) {
      if (assignment.registrationId === scope.registrationId && assignment.deploymentId === scope.deploymentId && !assignment.deletedAt) {
        assignment.deletedAt = scope.deletedAt;
        count += 1;
      }
    }
    for (const submission of this.submissions.values()) {
      if (submission.registrationId === scope.registrationId && submission.deploymentId === scope.deploymentId && !submission.deletedAt) {
        submission.deletedAt = scope.deletedAt;
      }
    }
    for (const [key, user] of this.users) {
      if (user.registrationId === scope.registrationId && user.deploymentId === scope.deploymentId) {
        this.users.delete(key);
      }
    }
    for (const [key, link] of this.resourceLinks) {
      if (link.registrationId === scope.registrationId && link.deploymentId === scope.deploymentId) {
        this.resourceLinks.delete(key);
      }
    }
    for (const [key, review] of this.reviews) {
      if (review.registrationId === scope.registrationId && review.deploymentId === scope.deploymentId) {
        this.reviews.delete(key);
      }
    }
    for (const [key, transaction] of this.agsTransactions) {
      if (transaction.registrationId === scope.registrationId && transaction.deploymentId === scope.deploymentId) {
        this.agsTransactions.delete(key);
      }
    }
    return count;
  }
  async purgeExpired(now: string): Promise<number> {
    let count = 0;
    for (const [key, value] of this.loginStates) if (value.expiresAt < now) { this.loginStates.delete(key); count += 1; }
    for (const [key, value] of this.launchCodes) if (value.expiresAt < now) { this.launchCodes.delete(key); count += 1; }
    const nowMillis = Date.parse(now);
    for (const assignment of this.assignments.values()) {
      if (assignment.deletedAt
        || Date.parse(assignment.updatedAt) + assignment.retentionDays * 86_400_000 > nowMillis) continue;
      assignment.deletedAt = now;
      count += 1;
      for (const submission of this.submissions.values()) {
        if (submission.registrationId === assignment.registrationId
          && submission.deploymentId === assignment.deploymentId
          && submission.assignmentId === assignment.id
          && !submission.deletedAt) submission.deletedAt = now;
      }
    }
    return count;
  }
}
