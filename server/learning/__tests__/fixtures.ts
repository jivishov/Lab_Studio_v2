import { generateKeyPairSync } from "node:crypto";
import type { AppSessionClaims, LearningServiceConfig } from "../types";

const toolKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const toolPrivateKeyPem = toolKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
export const toolPublicJwk = toolKeys.publicKey.export({ format: "jwk" });

export const learningTestConfig = (overrides: Partial<LearningServiceConfig> = {}): LearningServiceConfig => ({
  issuer: "https://tool.example",
  clientId: "tool-client",
  launchUrl: "https://tool.example/lti/launch",
  deepLinkLaunchUrl: "https://tool.example/lti/deep-link/launch",
  appBaseUrl: "https://app.example/",
  keyId: "tool-key-1",
  privateKeyPem: toolPrivateKeyPem,
  publicJwk: toolPublicJwk,
  retiringPublicJwks: [],
  pseudonymSecret: "test-pseudonym-secret-with-at-least-32-characters",
  causalystLtiV1: true,
  causalystAgsV1: false,
  sessionTtlSeconds: 900,
  loginStateTtlSeconds: 300,
  launchCodeTtlSeconds: 60,
  jwksCacheSeconds: 60,
  maxRequestBytes: 1_048_576,
  maxAssessmentBytes: 2_097_152,
  maxSubmissionBytes: 8_388_608,
  maxExplanationBytes: 65_536,
  retentionDays: 365,
  registrations: [{
    id: "platform",
    issuer: "https://platform.example",
    clientId: "platform-client",
    deploymentIds: ["deployment-a"],
    authorizationEndpoint: "https://platform.example/oidc",
    tokenEndpoint: "https://platform.example/token",
    jwksUrl: "https://platform.example/jwks",
    enabled: true,
    allowedServices: ["deep-linking"],
  }],
  ...overrides,
});

export const instructorSession: AppSessionClaims = {
  sessionId: "session-instructor",
  registrationId: "platform",
  deploymentId: "deployment-a",
  userKey: "usr_instructor",
  roles: ["instructor"],
  ltiContext: {
    messageType: "LtiDeepLinkingRequest",
    deepLinkReturnUrl: "https://platform.example/deep-link-return",
    agsScopes: [],
  },
  issuedAt: "2026-07-27T00:00:00.000Z",
  expiresAt: "2026-07-27T00:15:00.000Z",
};
