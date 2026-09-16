import { validateCausalystAssessment } from "../../../src/causalyst/domain/validation";
import type { CausalystAssessmentDefinition } from "../../../src/causalyst/domain/types";
import type { CausalystSubmission } from "../../../src/causalyst/submission/types";
import { validateCausalystSubmission } from "../../../src/causalyst/submission/validation";
import { findForbiddenArtifactData } from "../../../src/platform/artifacts/security";
import type { AgsClient } from "../ags/client";
import { AGS_SCOPES } from "../ags/client";
import { LearningServiceError, requireLearning } from "../errors";
import { hashOpaque, randomOpaque } from "../security/identifiers";
import { redactAuditEvent } from "../security/redaction";
import type { LearningStore } from "../storage/port";
import type {
  AgsTransactionRecord,
  AppSessionClaims,
  AssignmentRecord,
  LearningServiceConfig,
  ReviewRecord,
  ScoreApprovalInput,
  SubmissionRecord,
  ValidatedLaunch,
} from "../types";

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");
const hasRole = (session: AppSessionClaims, ...roles: AppSessionClaims["roles"]): boolean =>
  roles.some((role) => session.roles.includes(role));
const scope = (session: AppSessionClaims) => ({
  registrationId: session.registrationId,
  deploymentId: session.deploymentId,
});
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const compareDecimals = (left: string, right: string): number => {
  const [li, lf = ""] = left.split(".");
  const [ri, rf = ""] = right.split(".");
  const scale = Math.max(lf.length, rf.length);
  const l = BigInt(li + lf.padEnd(scale, "0"));
  const r = BigInt(ri + rf.padEnd(scale, "0"));
  return l < r ? -1 : l > r ? 1 : 0;
};

export class CausalystLearningService {
  constructor(
    private readonly config: LearningServiceConfig,
    private readonly store: LearningStore,
    private readonly agsClient: AgsClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async audit(input: Omit<Parameters<LearningStore["appendAudit"]>[0], "id" | "occurredAt">): Promise<void> {
    await this.store.appendAudit(redactAuditEvent({
      id: randomOpaque("aud"),
      occurredAt: this.now().toISOString(),
      ...input,
    }));
  }

  async createAssignment(
    session: AppSessionClaims,
    input: {
      id: string;
      assessment: CausalystAssessmentDefinition;
      gradable: boolean;
      scoreMaximum?: string;
      agsEnabled: boolean;
      agsLineItemUrl?: string;
      retentionDays?: number;
    },
  ): Promise<AssignmentRecord> {
    requireLearning(hasRole(session, "instructor", "administrator"),
      "assignment.role", "Instructor authorization is required.", 403);
    requireLearning(bytes(input.assessment) <= this.config.maxAssessmentBytes,
      "assignment.size", "Assessment exceeds the configured size limit.", 413);
    requireLearning(findForbiddenArtifactData(input.assessment).length === 0,
      "assignment.forbidden-data", "Assessment contains forbidden runtime or provider data.");
    const validation = validateCausalystAssessment(input.assessment);
    requireLearning(validation.ok, "assignment.invalid", "Assessment does not satisfy pinned Causalyst contracts.");
    requireLearning(input.id === input.assessment.id, "assignment.id", "Assignment id must match the assessment id.");
    requireLearning(!input.agsEnabled || input.gradable, "assignment.ags-not-gradable",
      "AGS cannot be enabled for a non-gradable assignment.");
    requireLearning(!input.agsEnabled || this.config.causalystAgsV1,
      "assignment.ags-disabled", "AGS is safely disabled by the service feature flag.", 503);
    requireLearning(!input.gradable || (typeof input.scoreMaximum === "string"
      && decimalPattern.test(input.scoreMaximum) && compareDecimals(input.scoreMaximum, "0") > 0),
    "assignment.score-maximum", "Gradable assignments require a positive explicit score maximum.");
    const registration = this.config.registrations.find(({ id }) => id === session.registrationId);
    requireLearning(registration?.enabled, "assignment.registration", "Platform registration is disabled.", 403);
    requireLearning(!input.agsEnabled || registration.allowedServices.includes("ags"),
      "assignment.ags-platform-disabled", "AGS is disabled for this platform.", 403);
    const deepLinkCanProvision = session.ltiContext?.messageType === "LtiDeepLinkingRequest"
      && session.ltiContext.deepLinkAcceptsLineItem === true;
    if (input.agsEnabled && input.agsLineItemUrl) {
      requireLearning(input.agsLineItemUrl === session.ltiContext?.agsLineItemUrl,
        "assignment.ags-lineitem", "AGS line item must come from the validated launch context.", 403);
      requireLearning(session.ltiContext.agsScopes.includes(AGS_SCOPES.score),
        "assignment.ags-scope", "The validated launch did not authorize AGS score return.", 403);
    } else {
      requireLearning(!input.agsEnabled || deepLinkCanProvision,
        "assignment.ags-lineitem", "AGS requires a validated line item or Deep Linking line-item support.", 403);
    }
    const retentionDays = input.retentionDays ?? this.config.retentionDays;
    requireLearning(Number.isSafeInteger(retentionDays) && retentionDays > 0 && retentionDays <= this.config.retentionDays,
      "assignment.retention", "Retention must be a positive value within the deployment maximum.");
    const now = this.now().toISOString();
    const record: AssignmentRecord = {
      id: input.id,
      ...scope(session),
      assessment: validation.value,
      assessmentVersion: validation.value.metadata.version,
      createdByUserKey: session.userKey,
      createdAt: now,
      updatedAt: now,
      gradable: input.gradable,
      ...(input.scoreMaximum ? { scoreMaximum: input.scoreMaximum } : {}),
      agsEnabled: input.agsEnabled,
      ...(input.agsLineItemUrl ? { agsLineItemUrl: input.agsLineItemUrl } : {}),
      retentionDays,
    };
    await this.store.putAssignment(record);
    await this.audit({ ...scope(session), actorUserKey: session.userKey, action: "assignment.create",
      targetType: "assignment", targetId: record.id, outcome: "completed", code: "assignment.created" });
    return record;
  }

  async linkResource(
    session: AppSessionClaims,
    input: { resourceLinkId: string; assignmentId: string },
  ): Promise<void> {
    requireLearning(hasRole(session, "instructor", "administrator"),
      "resource-link.role", "Instructor authorization is required.", 403);
    const assignment = await this.store.getAssignment({ ...scope(session), id: input.assignmentId });
    requireLearning(assignment, "resource-link.assignment", "Assignment is not available in this deployment.", 404);
    await this.store.putResourceLink({
      id: randomOpaque("rl"),
      ...scope(session),
      resourceLinkId: input.resourceLinkId,
      assignmentId: input.assignmentId,
      createdAt: this.now().toISOString(),
    });
  }

  async bindPlatformResourceLaunch(launch: ValidatedLaunch): Promise<void> {
    requireLearning(launch.messageType === "LtiResourceLinkRequest"
      && launch.resourceLinkId && launch.assignmentId,
    "resource-link.launch-claims", "Resource Link launch is missing signed assignment linkage.", 401);
    const linkScope = {
      registrationId: launch.registrationId,
      deploymentId: launch.deploymentId,
      resourceLinkId: launch.resourceLinkId,
    };
    const existing = await this.store.getResourceLink(linkScope);
    requireLearning(!existing || existing.assignmentId === launch.assignmentId,
      "resource-link.rebind", "Resource Link cannot be rebound to another assignment.", 409);
    const assignment = await this.store.getAssignment({
      registrationId: launch.registrationId,
      deploymentId: launch.deploymentId,
      id: launch.assignmentId,
    });
    requireLearning(assignment, "resource-link.assignment", "Signed assignment is unavailable in this deployment.", 404);
    if (assignment.agsEnabled && launch.ags?.lineItemUrl
      && launch.ags.scopes.includes(AGS_SCOPES.score)) {
      requireLearning(!assignment.agsLineItemUrl || assignment.agsLineItemUrl === launch.ags.lineItemUrl,
        "resource-link.ags-rebind", "Assignment AGS line item cannot be rebound.", 409);
      await this.store.putAssignment({
        ...assignment,
        agsLineItemUrl: launch.ags.lineItemUrl,
        updatedAt: this.now().toISOString(),
      });
    }
    if (!existing) await this.store.putResourceLink({
      id: randomOpaque("rl"),
      ...linkScope,
      assignmentId: launch.assignmentId,
      createdAt: this.now().toISOString(),
    });
  }

  async resolveResourceLaunch(
    session: AppSessionClaims,
    resourceLinkId: string,
    claimedAssignmentId?: string,
  ): Promise<AssignmentRecord> {
    const link = await this.store.getResourceLink({ ...scope(session), resourceLinkId });
    requireLearning(link, "resource-link.missing", "Resource link is not registered in this deployment.", 404);
    requireLearning(!claimedAssignmentId || link.assignmentId === claimedAssignmentId,
      "resource-link.assignment-mismatch", "Resource link assignment claim was altered.", 403);
    const assignment = await this.store.getAssignment({ ...scope(session), id: link.assignmentId });
    requireLearning(assignment, "resource-link.assignment", "Assignment is not available in this deployment.", 404);
    return assignment;
  }

  async currentAssignment(session: AppSessionClaims): Promise<AssignmentRecord> {
    requireLearning(session.resourceLinkId && session.assignmentId,
      "resource-link.session", "Session is not bound to a Resource Link assignment.", 403);
    return this.resolveResourceLaunch(session, session.resourceLinkId, session.assignmentId);
  }

  async submit(
    session: AppSessionClaims,
    assignmentId: string,
    submission: CausalystSubmission,
  ): Promise<SubmissionRecord> {
    requireLearning(hasRole(session, "learner"), "submission.role", "Learner authorization is required.", 403);
    requireLearning(session.assignmentId === assignmentId,
      "submission.assignment-session", "Session is not authorized for this assignment.", 403);
    const assignment = await this.store.getAssignment({ ...scope(session), id: assignmentId });
    requireLearning(assignment, "submission.assignment", "Assignment is not available in this deployment.", 404);
    requireLearning(submission.assessmentRef.id === assignment.assessment.id
      && submission.assessmentRef.version === assignment.assessment.metadata.version,
    "submission.assessment-version", "Submission does not match the pinned assignment version.");
    requireLearning(bytes(submission) <= this.config.maxSubmissionBytes,
      "submission.size", "Submission exceeds the configured size limit.", 413);
    requireLearning(submission.explanations.every(({ responseText }) =>
      Buffer.byteLength(responseText, "utf8") <= this.config.maxExplanationBytes),
    "submission.explanation-size", "An explanation exceeds the configured size limit.", 413);
    requireLearning(findForbiddenArtifactData(submission).length === 0,
      "submission.forbidden-data", "Submission contains forbidden runtime or provider data.");
    requireLearning(!("pseudonymousLearnerRef" in (submission as unknown as Record<string, unknown>)),
      "submission.portable-identity", "Portable submissions must remain identity-free.");
    const validation = validateCausalystSubmission(submission, assignment.assessment);
    requireLearning(validation.ok, "submission.invalid", "Submission does not satisfy the pinned Causalyst contract.");
    requireLearning(validation.value.rubricEvaluation.finalScore === null
      && validation.value.rubricEvaluation.decision === "teacher-review-required"
      && validation.value.teacherApproval.gradeReturn === false,
    "submission.grade-boundary", "Learner submissions cannot contain a final score or grade return.");
    const now = this.now().toISOString();
    const existing = await this.store.getSubmission({ ...scope(session), id: validation.value.submissionId });
    requireLearning(!existing, "submission.duplicate", "Submission id has already been used.", 409);
    const record: SubmissionRecord = {
      id: validation.value.submissionId,
      ...scope(session),
      assignmentId,
      learnerUserKey: session.userKey,
      submission: validation.value,
      status: "submitted",
      submittedAt: validation.value.submittedAt,
      updatedAt: now,
    };
    await this.store.putSubmission(record);
    await this.audit({ ...scope(session), actorUserKey: session.userKey, action: "submission.create",
      targetType: "submission", targetId: record.id, outcome: "completed", code: "submission.accepted" });
    return record;
  }

  async listSubmissions(session: AppSessionClaims, assignmentId: string): Promise<SubmissionRecord[]> {
    requireLearning(hasRole(session, "instructor", "administrator"),
      "submission.list-role", "Instructor authorization is required.", 403);
    const assignment = await this.store.getAssignment({ ...scope(session), id: assignmentId });
    requireLearning(assignment, "submission.assignment", "Assignment is not available in this deployment.", 404);
    return this.store.listSubmissions({ ...scope(session), assignmentId });
  }

  async getSubmission(session: AppSessionClaims, submissionId: string): Promise<SubmissionRecord> {
    const submission = await this.store.getSubmission({ ...scope(session), id: submissionId });
    requireLearning(submission, "submission.missing", "Submission is not available in this deployment.", 404);
    requireLearning(
      hasRole(session, "instructor", "administrator")
        || (hasRole(session, "learner") && submission.learnerUserKey === session.userKey),
      "submission.read-role",
      "Session is not authorized to read this submission.",
      403,
    );
    return submission;
  }

  async review(
    session: AppSessionClaims,
    submissionId: string,
    input: { status: "changes-requested" | "reviewed"; feedback?: string; reviewedAt: string },
  ): Promise<ReviewRecord> {
    requireLearning(hasRole(session, "instructor", "administrator"),
      "review.role", "Instructor authorization is required.", 403);
    requireLearning(Number.isFinite(Date.parse(input.reviewedAt)), "review.time", "Review time must be ISO-8601.");
    const submission = await this.store.getSubmission({ ...scope(session), id: submissionId });
    requireLearning(submission, "review.submission", "Submission is not available in this deployment.", 404);
    const record: ReviewRecord = {
      id: randomOpaque("rev"),
      ...scope(session),
      submissionId,
      reviewerUserKey: session.userKey,
      status: input.status,
      ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
      reviewedAt: input.reviewedAt,
    };
    await this.store.putReview(record);
    await this.store.putSubmission({
      ...submission,
      status: input.status === "changes-requested" ? "changes-requested" : "under-review",
      updatedAt: this.now().toISOString(),
    });
    return record;
  }

  async approveScore(
    session: AppSessionClaims,
    submissionId: string,
    input: ScoreApprovalInput,
  ): Promise<ReviewRecord> {
    requireLearning(hasRole(session, "instructor", "administrator"),
      "score.role", "Instructor authorization is required.", 403);
    requireLearning(decimalPattern.test(input.score) && decimalPattern.test(input.scoreMaximum)
      && compareDecimals(input.score, "0") >= 0 && compareDecimals(input.score, input.scoreMaximum) <= 0,
    "score.range", "Approved score must be an explicit decimal within the declared maximum.");
    requireLearning(Number.isFinite(Date.parse(input.approvedAt)), "score.time", "Approval time must be ISO-8601.");
    const submission = await this.store.getSubmission({ ...scope(session), id: submissionId });
    requireLearning(submission, "score.submission", "Submission is not available in this deployment.", 404);
    const assignment = await this.store.getAssignment({ ...scope(session), id: submission.assignmentId });
    requireLearning(assignment?.gradable && assignment.scoreMaximum === input.scoreMaximum,
      "score.assignment", "Score maximum does not match the gradable assignment.", 409);
    const record: ReviewRecord = {
      id: randomOpaque("approval"),
      ...scope(session),
      submissionId,
      reviewerUserKey: session.userKey,
      status: "score-approved",
      ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
      approvedScore: input.score,
      scoreMaximum: input.scoreMaximum,
      reviewedAt: input.approvedAt,
    };
    await this.store.putReview(record);
    await this.store.putSubmission({ ...submission, status: "approved", updatedAt: this.now().toISOString() });
    await this.audit({ ...scope(session), actorUserKey: session.userKey, action: "score.approve",
      targetType: "submission", targetId: submissionId, outcome: "completed", code: "score.teacher-approved" });
    return record;
  }

  async returnApprovedScore(
    session: AppSessionClaims,
    submissionId: string,
    idempotencyKey: string,
  ): Promise<AgsTransactionRecord> {
    requireLearning(hasRole(session, "instructor", "administrator"),
      "ags.role", "Instructor authorization is required.", 403);
    requireLearning(this.config.causalystAgsV1, "ags.disabled", "AGS is safely disabled.", 503);
    requireLearning(idempotencyKey.trim().length >= 16, "ags.idempotency-key",
      "A stable idempotency key is required.");
    const prior = await this.store.getAgsTransaction({ ...scope(session), idempotencyKey });
    requireLearning(!prior || prior.submissionId === submissionId,
      "ags.idempotency-conflict", "Idempotency key is already bound to another submission.", 409);
    if (prior && ["succeeded", "pending", "permanent-failure", "disabled"].includes(prior.status)) return prior;
    const submission = await this.store.getSubmission({ ...scope(session), id: submissionId });
    requireLearning(submission, "ags.submission", "Submission is not available in this deployment.", 404);
    const assignment = await this.store.getAssignment({ ...scope(session), id: submission.assignmentId });
    requireLearning(assignment?.gradable && assignment.agsEnabled && assignment.agsLineItemUrl,
      "ags.assignment-disabled", "AGS is disabled or unconfigured for this assignment.", 403);
    const registration = this.config.registrations.find(({ id }) => id === session.registrationId);
    requireLearning(registration?.enabled && registration.allowedServices.includes("ags"),
      "ags.platform-disabled", "AGS is disabled for this platform.", 403);
    const approvals = (await this.store.listReviews({ ...scope(session), submissionId }))
      .filter((review) => review.status === "score-approved");
    const approval = approvals.at(-1);
    requireLearning(approval?.approvedScore && approval.scoreMaximum,
      "ags.not-approved", "A teacher-approved score is required before AGS return.", 409);
    const learner = await this.store.getUser({ ...scope(session), userKey: submission.learnerUserKey });
    requireLearning(learner, "ags.learner", "Pseudonymous learner record is unavailable.", 409);
    const now = this.now().toISOString();
    const transaction: AgsTransactionRecord = {
      id: prior?.id ?? randomOpaque("ags"),
      ...scope(session),
      assignmentId: assignment.id,
      submissionId,
      approvalReviewId: approval.id,
      idempotencyKey,
      status: "pending",
      attemptCount: (prior?.attemptCount ?? 0) + 1,
      requestStatus: "FullyGraded",
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    };
    await this.store.putAgsTransaction(transaction);
    try {
      const result = await this.agsClient.postApprovedScore(registration, {
        deploymentId: session.deploymentId,
        lineItemUrl: assignment.agsLineItemUrl,
        userId: learner.ltiSubject,
        scoreGiven: approval.approvedScore,
        scoreMaximum: approval.scoreMaximum,
        timestamp: approval.reviewedAt,
        ...(approval.feedback ? { comment: approval.feedback } : {}),
        idempotencyKey,
      });
      const completed: AgsTransactionRecord = {
        ...transaction,
        status: result.status >= 200 && result.status < 300
          ? "succeeded"
          : result.retryable ? "retryable-failure" : "permanent-failure",
        responseStatus: result.status,
        ...(result.status >= 200 && result.status < 300 ? {} : {
          lastErrorCode: result.retryable ? "ags.http-retryable" : "ags.http-rejected",
        }),
        updatedAt: this.now().toISOString(),
      };
      await this.store.putAgsTransaction(completed);
      return completed;
    } catch (error) {
      const permanent = error instanceof LearningServiceError
        && ["ags.token-rejected", "ags.token-shape"].includes(error.code);
      const failed: AgsTransactionRecord = {
        ...transaction,
        status: permanent ? "permanent-failure" : "retryable-failure",
        lastErrorCode: error instanceof LearningServiceError ? error.code
          : error instanceof Error ? "ags.transport" : "ags.unknown",
        updatedAt: this.now().toISOString(),
      };
      await this.store.putAgsTransaction(failed);
      return failed;
    }
  }

  async deleteAssignment(session: AppSessionClaims, assignmentId: string): Promise<number> {
    requireLearning(hasRole(session, "instructor", "administrator"),
      "deletion.role", "Instructor authorization is required.", 403);
    return this.store.deleteAssignment({ ...scope(session), id: assignmentId, deletedAt: this.now().toISOString() });
  }

  async deleteOwnUserData(session: AppSessionClaims): Promise<number> {
    return this.store.deleteUser({ ...scope(session), userKey: session.userKey, deletedAt: this.now().toISOString() });
  }

  async deleteDeployment(session: AppSessionClaims): Promise<number> {
    requireLearning(hasRole(session, "administrator"),
      "deletion.admin-role", "Administrator authorization is required.", 403);
    return this.store.deleteDeployment({ ...scope(session), deletedAt: this.now().toISOString() });
  }

  async enforceRetention(): Promise<number> {
    return this.store.purgeExpired(this.now().toISOString());
  }

  static scoreApprovalFingerprint(submissionId: string, approvalReviewId: string): string {
    return `ags_${hashOpaque(`${submissionId}\0${approvalReviewId}`)}`;
  }
}
