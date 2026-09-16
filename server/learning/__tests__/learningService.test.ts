import { describe, expect, it, vi } from "vitest";
import { createChemistryAssessmentFixture } from "../../../src/causalyst/domain/fixtures";
import { createValidatedLocalSubmission } from "../../../src/causalyst/attempt/submissionBuilder";
import { CausalystLearningService } from "../services/learningService";
import { MemoryLearningStore } from "../storage/memoryStore";
import { instructorSession, learningTestConfig } from "./fixtures";
import type { AppSessionClaims } from "../types";

describe("Cycle 15 governed persistence and AGS boundary", () => {
  it("isolates deployments, persists no name/email, and requires learner assignment authorization", async () => {
    const store = new MemoryLearningStore();
    const service = new CausalystLearningService(learningTestConfig(), store, {
      postApprovedScore: vi.fn(),
    }, () => new Date("2026-07-27T00:00:00.000Z"));
    const assessment = createChemistryAssessmentFixture();
    await service.createAssignment(instructorSession, {
      id: assessment.id, assessment, gradable: false, agsEnabled: false,
    });
    const otherDeployment = { ...instructorSession, deploymentId: "deployment-b" };
    await expect(service.listSubmissions(otherDeployment, assessment.id))
      .rejects.toMatchObject({ code: "submission.assignment" });

    const learner: AppSessionClaims = {
      ...instructorSession,
      sessionId: "learner-session",
      userKey: "usr_learner",
      roles: ["learner"],
      assignmentId: assessment.id,
      ltiContext: { messageType: "LtiResourceLinkRequest" as const, agsScopes: [] },
    };
    const submission = createValidatedLocalSubmission(assessment, {
      submissionId: "submission-1",
      attemptNumber: 1,
      occurredAt: "2026-07-27T00:00:00.000Z",
      explanations: [{
        promptId: assessment.explanationPrompts[0].id,
        responseText: "The evidence is limited to the pinned simulation.",
        submittedAt: "2026-07-27T00:00:00.000Z",
      }],
      runConfirmed: true,
    });
    await expect(service.submit({ ...learner, assignmentId: "altered" }, assessment.id, submission))
      .rejects.toMatchObject({ code: "submission.assignment-session" });
    await expect(service.submit(learner, assessment.id, submission)).resolves.toMatchObject({
      learnerUserKey: "usr_learner", status: "submitted",
    });
    expect(JSON.stringify(await service.listSubmissions(instructorSession, assessment.id)))
      .not.toMatch(/name|email|pointer|camera|gesture|providerResponse|finalGrade/i);
  });

  it("blocks AGS until explicit teacher approval and safely replays an idempotent success", async () => {
    const config = learningTestConfig({
      causalystAgsV1: true,
      registrations: [{
        ...learningTestConfig().registrations[0],
        allowedServices: ["deep-linking", "ags"],
      }],
    });
    const store = new MemoryLearningStore();
    const postApprovedScore = vi.fn().mockResolvedValue({ status: 204, retryable: false });
    const service = new CausalystLearningService(config, store, { postApprovedScore },
      () => new Date("2026-07-27T00:00:00.000Z"));
    const assessment = createChemistryAssessmentFixture();
    const agsInstructor = {
      ...instructorSession,
      ltiContext: {
        ...instructorSession.ltiContext!,
        agsLineItemUrl: "https://platform.example/lineitems/1",
        agsScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/score"],
      },
    };
    await service.createAssignment(agsInstructor, {
      id: assessment.id, assessment, gradable: true, scoreMaximum: "10",
      agsEnabled: true, agsLineItemUrl: "https://platform.example/lineitems/1",
    });
    await store.upsertUser({
      registrationId: "platform", deploymentId: "deployment-a", userKey: "usr_learner",
      ltiSubject: "opaque-platform-subject", createdAt: "2026-07-27T00:00:00.000Z",
      lastSeenAt: "2026-07-27T00:00:00.000Z",
    });
    const submission = createValidatedLocalSubmission(assessment, {
      submissionId: "submission-ags", attemptNumber: 1,
      occurredAt: "2026-07-27T00:00:00.000Z",
      explanations: [{ promptId: assessment.explanationPrompts[0].id, responseText: "Bounded.", submittedAt: "2026-07-27T00:00:00.000Z" }],
      runConfirmed: true,
    });
    await service.submit({
      ...agsInstructor, userKey: "usr_learner", roles: ["learner"], assignmentId: assessment.id,
    }, assessment.id, submission);
    await expect(service.returnApprovedScore(agsInstructor, submission.submissionId, "stable-idempotency-key"))
      .rejects.toMatchObject({ code: "ags.not-approved" });
    await service.approveScore(agsInstructor, submission.submissionId, {
      score: "8.5", scoreMaximum: "10", approvedAt: "2026-07-27T00:00:00.000Z",
    });
    const first = await service.returnApprovedScore(agsInstructor, submission.submissionId, "stable-idempotency-key");
    const second = await service.returnApprovedScore(agsInstructor, submission.submissionId, "stable-idempotency-key");
    expect(first.status).toBe("succeeded");
    expect(second.id).toBe(first.id);
    expect(postApprovedScore).toHaveBeenCalledTimes(1);
  });
});
