import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createChemistryAssessmentFixture } from "../../../src/causalyst/domain/fixtures";
import type { CausalystSubmission } from "../../../src/causalyst/submission/types";
import type { AgsClient } from "../ags/client";
import { createDeepLinkResponse } from "../lti/deepLinking";
import { LtiLaunchService } from "../lti/launch";
import { signServiceJwt } from "../security/jwt";
import { CausalystLearningService } from "../services/learningService";
import { MemoryLearningStore } from "../storage/memoryStore";
import {
  LTI_CLAIMS,
  LTI_VERSION,
  type AppSessionClaims,
  type LearningServiceConfig,
  type PublishedJwk,
} from "../types";

const platformKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const toolKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const platformJwk = {
  ...platformKeys.publicKey.export({ format: "jwk" }),
  kid: "platform-key",
  alg: "RS256",
  use: "sig",
} as PublishedJwk;
const toolJwk = toolKeys.publicKey.export({ format: "jwk" });
const toolPrivateKey = toolKeys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const platformPrivateKey = platformKeys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const nowSeconds = Math.floor(Date.parse("2026-07-27T00:00:00.000Z") / 1000);

const config: LearningServiceConfig = {
  issuer: "https://tool.example",
  clientId: "tool-client",
  launchUrl: "https://tool.example/lti/launch",
  deepLinkLaunchUrl: "https://tool.example/lti/deep-link/launch",
  appBaseUrl: "https://app.example/",
  keyId: "tool-key",
  privateKeyPem: toolPrivateKey,
  publicJwk: toolJwk,
  retiringPublicJwks: [],
  pseudonymSecret: "a-pseudonym-secret-longer-than-thirty-two-characters",
  causalystLtiV1: true,
  causalystAgsV1: true,
  sessionTtlSeconds: 900,
  loginStateTtlSeconds: 300,
  launchCodeTtlSeconds: 60,
  jwksCacheSeconds: 300,
  maxRequestBytes: 1_048_576,
  maxAssessmentBytes: 2_097_152,
  maxSubmissionBytes: 8_388_608,
  maxExplanationBytes: 65_536,
  retentionDays: 365,
  registrations: [{
    id: "platform",
    issuer: "https://platform.example",
    clientId: "platform-client",
    deploymentIds: ["deployment-a", "deployment-b"],
    authorizationEndpoint: "https://platform.example/authorize",
    tokenEndpoint: "https://platform.example/token",
    jwksUrl: "https://platform.example/jwks",
    enabled: true,
    allowedServices: ["deep-linking", "ags"],
  }],
};

const jwksFetch = async () => new Response(JSON.stringify({ keys: [platformJwk] }), {
  status: 200,
  headers: { "content-type": "application/json" },
});

const launchToken = (input: {
  nonce: string;
  deploymentId?: string;
  audience?: string | string[];
  authorizedParty?: string;
  messageType?: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest";
  targetLinkUri?: string;
}) => signServiceJwt({
  iss: "https://platform.example",
  sub: "opaque-platform-subject",
  aud: input.audience ?? "platform-client",
  ...(input.authorizedParty ? { azp: input.authorizedParty } : {}),
  iat: nowSeconds,
  exp: nowSeconds + 600,
  nonce: input.nonce,
  [LTI_CLAIMS.deploymentId]: input.deploymentId ?? "deployment-a",
  [LTI_CLAIMS.version]: LTI_VERSION,
  [LTI_CLAIMS.messageType]: input.messageType ?? "LtiResourceLinkRequest",
  [LTI_CLAIMS.targetLinkUri]: input.targetLinkUri ?? config.launchUrl,
  [LTI_CLAIMS.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#learner"],
  [LTI_CLAIMS.resourceLink]: { id: "resource-link" },
  [LTI_CLAIMS.custom]: { causalyst_assignment_id: "assessment" },
}, "platform-key", platformPrivateKey);

const startLogin = async (
  service: LtiLaunchService,
  targetLinkUri = config.launchUrl,
) => {
  const redirect = new URL(await service.initiateLogin({
    iss: "https://platform.example",
    clientId: "platform-client",
    loginHint: "opaque-login-hint",
    targetLinkUri,
    deploymentId: "deployment-a",
  }));
  return {
    state: redirect.searchParams.get("state")!,
    nonce: redirect.searchParams.get("nonce")!,
  };
};

describe("Cycle 15 governed learning boundary", () => {
  it("validates a launch once and rejects replay, deployment mismatch, and multi-audience azp mismatch", async () => {
    const store = new MemoryLearningStore();
    const service = new LtiLaunchService(config, store, () => new Date("2026-07-27T00:00:00.000Z"), jwksFetch);
    const valid = await startLogin(service);
    await expect(service.validateLaunch(launchToken(valid), valid.state)).resolves.toMatchObject({
      deploymentId: "deployment-a",
      roles: ["learner"],
    });
    await expect(service.validateLaunch(launchToken(valid), valid.state)).rejects.toMatchObject({ code: "lti.state" });

    const deployment = await startLogin(service);
    await expect(service.validateLaunch(launchToken({ ...deployment, deploymentId: "unregistered" }), deployment.state))
      .rejects.toMatchObject({ code: "lti.deployment" });

    const audience = await startLogin(service);
    await expect(service.validateLaunch(launchToken({
      ...audience,
      audience: ["platform-client", "another-client"],
      authorizedParty: "another-client",
    }), audience.state)).rejects.toMatchObject({ code: "lti.jwt-authorized-party" });
  });

  it("returns a standards-shaped Deep Linking response to the platform issuer with opaque data preserved", () => {
    const result = createDeepLinkResponse({
      config,
      launch: {
        registrationId: "platform",
        issuer: "https://platform.example",
        clientId: "platform-client",
        deploymentId: "deployment-a",
        subject: "opaque-platform-subject",
        pseudonymousUserKey: "usr_key",
        roles: ["instructor"],
        messageType: "LtiDeepLinkingRequest",
        targetLinkUri: config.deepLinkLaunchUrl,
        deepLinkReturnUrl: "https://platform.example/deep-link-return",
        deepLinkData: "opaque-platform-data",
        deepLinkAcceptsLineItem: true,
      },
      selection: {
        assignmentId: "assessment",
        title: "Assessment",
        text: "Validated assessment",
        gradable: true,
        scoreMaximum: "10",
      },
      now: new Date("2026-07-27T00:00:00.000Z"),
    });
    const claims = JSON.parse(Buffer.from(result.idToken.split(".")[1], "base64url").toString("utf8"));
    expect(claims.iss).toBe("platform-client");
    expect(claims.aud).toBe("https://platform.example");
    expect(claims.azp).toBe("platform-client");
    expect(claims["https://purl.imsglobal.org/spec/lti-dl/claim/data"]).toBe("opaque-platform-data");
    expect(claims[LTI_CLAIMS.deepLinkingContentItems][0].custom).toEqual({
      causalyst_assignment_id: "assessment",
    });
  });

  it("keeps deployments isolated and blocks role escalation and score return before teacher approval", async () => {
    const store = new MemoryLearningStore();
    const assessment = createChemistryAssessmentFixture();
    await store.putAssignment({
      id: assessment.id,
      registrationId: "platform",
      deploymentId: "deployment-a",
      assessment,
      assessmentVersion: assessment.metadata.version,
      createdByUserKey: "teacher",
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
      gradable: true,
      scoreMaximum: "10",
      agsEnabled: true,
      agsLineItemUrl: "https://platform.example/lineitems/1",
      retentionDays: 30,
    });
    expect(await store.getAssignment({
      registrationId: "platform",
      deploymentId: "deployment-b",
      id: assessment.id,
    })).toBeUndefined();

    const agsClient: AgsClient = {
      postApprovedScore: async () => {
        throw new Error("AGS must not run without approval.");
      },
    };
    const learning = new CausalystLearningService(config, store, agsClient, () => new Date("2026-07-27T00:00:00.000Z"));
    const learnerSession: AppSessionClaims = {
      sessionId: "learner-session",
      registrationId: "platform",
      deploymentId: "deployment-a",
      userKey: "learner",
      roles: ["learner"],
      issuedAt: "2026-07-27T00:00:00.000Z",
      expiresAt: "2026-07-27T00:15:00.000Z",
    };
    await expect(learning.createAssignment(learnerSession, {
      id: assessment.id,
      assessment,
      gradable: false,
      agsEnabled: false,
    })).rejects.toMatchObject({ code: "assignment.role" });

    await store.upsertUser({
      userKey: "learner",
      registrationId: "platform",
      deploymentId: "deployment-a",
      ltiSubject: "opaque-platform-subject",
      createdAt: "2026-07-27T00:00:00.000Z",
      lastSeenAt: "2026-07-27T00:00:00.000Z",
    });
    await store.putSubmission({
      id: "submission",
      registrationId: "platform",
      deploymentId: "deployment-a",
      assignmentId: assessment.id,
      learnerUserKey: "learner",
      submission: {} as CausalystSubmission,
      status: "submitted",
      submittedAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
    });
    const instructorSession: AppSessionClaims = {
      ...learnerSession,
      sessionId: "instructor-session",
      userKey: "teacher",
      roles: ["instructor"],
    };
    await expect(learning.returnApprovedScore(instructorSession, "submission", "stable-idempotency-key"))
      .rejects.toMatchObject({ code: "ags.not-approved" });
  });

  it("soft-deletes assignments and submissions when the explicit retention window expires", async () => {
    const store = new MemoryLearningStore();
    const assessment = createChemistryAssessmentFixture();
    await store.putAssignment({
      id: assessment.id,
      registrationId: "platform",
      deploymentId: "deployment-a",
      assessment,
      assessmentVersion: assessment.metadata.version,
      createdByUserKey: "teacher",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      gradable: false,
      agsEnabled: false,
      retentionDays: 30,
    });
    await store.putSubmission({
      id: "retained-submission",
      registrationId: "platform",
      deploymentId: "deployment-a",
      assignmentId: assessment.id,
      learnerUserKey: "learner",
      submission: {} as CausalystSubmission,
      status: "submitted",
      submittedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await store.purgeExpired("2026-02-01T00:00:00.000Z");
    await expect(store.getAssignment({
      registrationId: "platform", deploymentId: "deployment-a", id: assessment.id,
    })).resolves.toBeUndefined();
    await expect(store.getSubmission({
      registrationId: "platform", deploymentId: "deployment-a", id: "retained-submission",
    })).resolves.toBeUndefined();
  });
});
