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

export interface LearningStore {
  putLoginState(record: LoginStateRecord): Promise<void>;
  consumeLoginState(stateHash: string, consumedAt: string): Promise<LoginStateRecord | undefined>;
  putLaunchCode(record: LaunchCodeRecord): Promise<void>;
  consumeLaunchCode(codeHash: string, consumedAt: string): Promise<LaunchCodeRecord | undefined>;
  upsertUser(record: PseudonymousUserRecord): Promise<PseudonymousUserRecord>;
  getUser(scope: { registrationId: string; deploymentId: string; userKey: string }): Promise<PseudonymousUserRecord | undefined>;
  putAssignment(record: AssignmentRecord): Promise<void>;
  getAssignment(scope: { registrationId: string; deploymentId: string; id: string }): Promise<AssignmentRecord | undefined>;
  putResourceLink(record: ResourceLinkRecord): Promise<void>;
  getResourceLink(scope: { registrationId: string; deploymentId: string; resourceLinkId: string }): Promise<ResourceLinkRecord | undefined>;
  putSubmission(record: SubmissionRecord): Promise<void>;
  getSubmission(scope: { registrationId: string; deploymentId: string; id: string }): Promise<SubmissionRecord | undefined>;
  listSubmissions(scope: { registrationId: string; deploymentId: string; assignmentId: string }): Promise<SubmissionRecord[]>;
  putReview(record: ReviewRecord): Promise<void>;
  listReviews(scope: { registrationId: string; deploymentId: string; submissionId: string }): Promise<ReviewRecord[]>;
  putAgsTransaction(record: AgsTransactionRecord): Promise<void>;
  getAgsTransaction(scope: { registrationId: string; deploymentId: string; idempotencyKey: string }): Promise<AgsTransactionRecord | undefined>;
  appendAudit(record: AuditEventRecord): Promise<void>;
  deleteAssignment(scope: { registrationId: string; deploymentId: string; id: string; deletedAt: string }): Promise<number>;
  deleteUser(scope: { registrationId: string; deploymentId: string; userKey: string; deletedAt: string }): Promise<number>;
  deleteDeployment(scope: { registrationId: string; deploymentId: string; deletedAt: string }): Promise<number>;
  purgeExpired(now: string): Promise<number>;
}
