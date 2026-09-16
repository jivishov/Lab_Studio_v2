export interface CausalystLtiSession {
  token: string;
  session: {
    sessionId: string;
    registrationId: string;
    deploymentId: string;
    userKey: string;
    roles: Array<"learner" | "instructor" | "administrator">;
    assignmentId?: string;
    resourceLinkId?: string;
    ltiContext?: {
      messageType: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest";
    };
    issuedAt: string;
    expiresAt: string;
  };
}

export const readLaunchCodeFromHash = (hash: string): string | undefined => {
  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0 || !hash.slice(0, queryIndex).endsWith("/causalyst-lti")) return undefined;
  const code = new URLSearchParams(hash.slice(queryIndex + 1)).get("launchCode");
  return code?.trim() || undefined;
};

export const exchangeCausalystLaunchCode = async (
  launchCode: string,
  fetcher: typeof fetch = fetch,
): Promise<CausalystLtiSession> => {
  const response = await fetcher("/api/session/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ launchCode }),
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Causalyst LTI launch could not be completed.");
  return response.json() as Promise<CausalystLtiSession>;
};

export const causalystLtiAuthorization = (session: CausalystLtiSession): HeadersInit => ({
  authorization: `Bearer ${session.token}`,
});

export interface LtiAssignment {
  id: string;
  assessment: CausalystAssessmentDefinition;
  assessmentVersion: string;
  gradable: boolean;
  scoreMaximum?: string;
  agsEnabled: boolean;
}

export interface LtiSubmissionRecord {
  id: string;
  assignmentId: string;
  submission: CausalystSubmission;
  status: "submitted" | "under-review" | "approved" | "changes-requested";
  submittedAt: string;
}

const requestJson = async <T>(
  session: CausalystLtiSession,
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> => {
  const response = await fetcher(path, {
    ...init,
    headers: {
      ...causalystLtiAuthorization(session),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    const value = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
    throw new Error(value?.error?.message ?? "Causalyst LTI request failed.");
  }
  return response.json() as Promise<T>;
};

export const loadCurrentLtiAssignment = (
  session: CausalystLtiSession,
  fetcher?: typeof fetch,
): Promise<LtiAssignment> => requestJson(session, "/api/causalyst/assignments/current", {}, fetcher);

export const createLtiAssignment = (
  session: CausalystLtiSession,
  assessment: CausalystAssessmentDefinition,
  fetcher?: typeof fetch,
): Promise<LtiAssignment> => requestJson(session, "/api/causalyst/assignments", {
  method: "POST",
  body: JSON.stringify({
    id: assessment.id,
    assessment,
    gradable: true,
    scoreMaximum: assessment.rubric.totalPoints,
    agsEnabled: false,
  }),
}, fetcher);

export const submitLtiAttempt = (
  session: CausalystLtiSession,
  assignmentId: string,
  submission: CausalystSubmission,
  fetcher?: typeof fetch,
): Promise<LtiSubmissionRecord> => requestJson(
  session,
  `/api/causalyst/assignments/${encodeURIComponent(assignmentId)}/submissions`,
  { method: "POST", body: JSON.stringify({ submission }) },
  fetcher,
);

export const listLtiSubmissions = async (
  session: CausalystLtiSession,
  assignmentId: string,
  fetcher?: typeof fetch,
): Promise<LtiSubmissionRecord[]> => {
  const result = await requestJson<{ submissions: LtiSubmissionRecord[] }>(
    session,
    `/api/causalyst/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    {},
    fetcher,
  );
  return result.submissions;
};

export const approveLtiScore = (
  session: CausalystLtiSession,
  submissionId: string,
  score: string,
  scoreMaximum: string,
  fetcher?: typeof fetch,
): Promise<void> => requestJson(session, `/api/causalyst/submissions/${encodeURIComponent(submissionId)}/approve-score`, {
  method: "POST",
  body: JSON.stringify({
    score,
    scoreMaximum,
    approvedAt: new Date().toISOString(),
  }),
}, fetcher);

export const returnApprovedLtiScore = (
  session: CausalystLtiSession,
  submissionId: string,
  idempotencyKey: string,
  fetcher?: typeof fetch,
): Promise<void> => requestJson(session, `/api/causalyst/submissions/${encodeURIComponent(submissionId)}/return-score`, {
  method: "POST",
  body: JSON.stringify({ idempotencyKey }),
}, fetcher);

export const returnDeepLinkSelection = async (
  session: CausalystLtiSession,
  assignmentId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> => {
  const result = await requestJson<{ returnUrl: string; idToken: string }>(
    session,
    "/lti/deep-link/return",
    { method: "POST", body: JSON.stringify({ assignmentId }) },
    fetcher,
  );
  const form = document.createElement("form");
  form.method = "post";
  form.action = result.returnUrl;
  const jwt = document.createElement("input");
  jwt.type = "hidden";
  jwt.name = "JWT";
  jwt.value = result.idToken;
  form.append(jwt);
  document.body.append(form);
  form.submit();
};
import type { CausalystAssessmentDefinition } from "../domain/types";
import type { CausalystSubmission } from "../submission/types";
