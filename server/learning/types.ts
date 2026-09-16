import type { CausalystAssessmentDefinition } from "../../src/causalyst/domain/types";
import type { CausalystSubmission } from "../../src/causalyst/submission/types";

export const LTI_VERSION = "1.3.0";
export const LTI_CLAIMS = Object.freeze({
  deploymentId: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  version: "https://purl.imsglobal.org/spec/lti/claim/version",
  roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
  targetLinkUri: "https://purl.imsglobal.org/spec/lti/claim/target_link_uri",
  resourceLink: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
  custom: "https://purl.imsglobal.org/spec/lti/claim/custom",
  deepLinkingSettings: "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings",
  deepLinkingContentItems: "https://purl.imsglobal.org/spec/lti-dl/claim/content_items",
  deepLinkingData: "https://purl.imsglobal.org/spec/lti-dl/claim/data",
  agsEndpoint: "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint",
} as const);

export type LearningRole = "learner" | "instructor" | "administrator";
export type AllowedLtiService = "deep-linking" | "ags";
export type PublishedJwk = JsonWebKey & { kid: string };

export interface LtiPlatformRegistration {
  id: string;
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUrl: string;
  enabled: boolean;
  allowedServices: AllowedLtiService[];
}

export interface LearningServiceConfig {
  issuer: string;
  clientId: string;
  launchUrl: string;
  deepLinkLaunchUrl: string;
  appBaseUrl: string;
  keyId: string;
  privateKeyPem: string;
  publicJwk: JsonWebKey;
  retiringPublicJwks: PublishedJwk[];
  pseudonymSecret: string;
  causalystLtiV1: boolean;
  causalystAgsV1: boolean;
  sessionTtlSeconds: number;
  loginStateTtlSeconds: number;
  launchCodeTtlSeconds: number;
  jwksCacheSeconds: number;
  maxRequestBytes: number;
  maxAssessmentBytes: number;
  maxSubmissionBytes: number;
  maxExplanationBytes: number;
  retentionDays: number;
  registrations: LtiPlatformRegistration[];
}

export interface LoginStateRecord {
  stateHash: string;
  nonceHash: string;
  registrationId: string;
  deploymentHint?: string;
  targetLinkUri: string;
  messageHint?: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface ValidatedLaunch {
  registrationId: string;
  issuer: string;
  clientId: string;
  deploymentId: string;
  subject: string;
  pseudonymousUserKey: string;
  roles: LearningRole[];
  messageType: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest";
  targetLinkUri: string;
  resourceLinkId?: string;
  assignmentId?: string;
  deepLinkReturnUrl?: string;
  deepLinkData?: string;
  deepLinkAcceptsLineItem?: boolean;
  ags?: {
    lineItemUrl?: string;
    lineItemsUrl?: string;
    scopes: string[];
  };
}

export interface PseudonymousUserRecord {
  userKey: string;
  registrationId: string;
  deploymentId: string;
  ltiSubject: string;
  createdAt: string;
  lastSeenAt: string;
  deletedAt?: string;
}

export interface AssignmentRecord {
  id: string;
  registrationId: string;
  deploymentId: string;
  assessment: CausalystAssessmentDefinition;
  assessmentVersion: string;
  createdByUserKey: string;
  createdAt: string;
  updatedAt: string;
  gradable: boolean;
  scoreMaximum?: string;
  agsEnabled: boolean;
  agsLineItemUrl?: string;
  retentionDays: number;
  deletedAt?: string;
}

export interface ResourceLinkRecord {
  id: string;
  registrationId: string;
  deploymentId: string;
  resourceLinkId: string;
  assignmentId: string;
  createdAt: string;
}

export interface SubmissionRecord {
  id: string;
  registrationId: string;
  deploymentId: string;
  assignmentId: string;
  learnerUserKey: string;
  submission: CausalystSubmission;
  status: "submitted" | "under-review" | "approved" | "changes-requested";
  submittedAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ReviewRecord {
  id: string;
  registrationId: string;
  deploymentId: string;
  submissionId: string;
  reviewerUserKey: string;
  status: "changes-requested" | "reviewed" | "score-approved";
  feedback?: string;
  approvedScore?: string;
  scoreMaximum?: string;
  reviewedAt: string;
}

export interface AgsTransactionRecord {
  id: string;
  registrationId: string;
  deploymentId: string;
  assignmentId: string;
  submissionId: string;
  approvalReviewId: string;
  idempotencyKey: string;
  status: "pending" | "succeeded" | "retryable-failure" | "permanent-failure" | "disabled";
  attemptCount: number;
  requestStatus: "FullyGraded";
  responseStatus?: number;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventRecord {
  id: string;
  registrationId?: string;
  deploymentId?: string;
  actorUserKey?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: "accepted" | "rejected" | "completed";
  code: string;
  occurredAt: string;
}

export interface AppSessionClaims {
  sessionId: string;
  registrationId: string;
  deploymentId: string;
  userKey: string;
  roles: LearningRole[];
  assignmentId?: string;
  resourceLinkId?: string;
  ltiContext?: {
    messageType: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest";
    deepLinkReturnUrl?: string;
    deepLinkData?: string;
    deepLinkAcceptsLineItem?: boolean;
    agsLineItemUrl?: string;
    agsScopes: string[];
  };
  issuedAt: string;
  expiresAt: string;
}

export interface LaunchCodeRecord {
  codeHash: string;
  session: AppSessionClaims;
  expiresAt: string;
  consumedAt?: string;
}

export interface DeepLinkSelection {
  assignmentId: string;
  title: string;
  text: string;
  gradable: boolean;
  scoreMaximum?: string;
}

export interface ScoreApprovalInput {
  score: string;
  scoreMaximum: string;
  feedback?: string;
  approvedAt: string;
}
