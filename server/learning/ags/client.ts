import { LTI_CLAIMS, type LearningServiceConfig, type LtiPlatformRegistration } from "../types";
import { LearningServiceError, requireLearning } from "../errors";
import { randomOpaque } from "../security/identifiers";
import { signServiceJwt } from "../security/jwt";

export const AGS_SCOPES = Object.freeze({
  lineItem: "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  score: "https://purl.imsglobal.org/spec/lti-ags/scope/score",
} as const);

export interface AgsScoreRequest {
  deploymentId: string;
  lineItemUrl: string;
  userId: string;
  scoreGiven: string;
  scoreMaximum: string;
  timestamp: string;
  comment?: string;
  idempotencyKey: string;
}

export interface AgsScoreResult {
  status: number;
  retryable: boolean;
}

export interface AgsClient {
  postApprovedScore(registration: LtiPlatformRegistration, request: AgsScoreRequest): Promise<AgsScoreResult>;
}

export class HttpAgsClient implements AgsClient {
  constructor(
    private readonly config: LearningServiceConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async accessToken(
    registration: LtiPlatformRegistration,
    deploymentId: string,
    scopes: string[],
  ): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const assertion = signServiceJwt({
      iss: registration.clientId,
      sub: registration.clientId,
      aud: registration.tokenEndpoint,
      iat: issuedAt,
      exp: issuedAt + 300,
      jti: randomOpaque("oauth"),
      [LTI_CLAIMS.deploymentId]: deploymentId,
    }, this.config.keyId, this.config.privateKeyPem);
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      scope: scopes.join(" "),
    });
    const response = await this.fetcher(registration.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
    });
    if (!response.ok) throw new LearningServiceError(
      response.status >= 500 || response.status === 429 ? "ags.token-retryable" : "ags.token-rejected",
      "AGS access token request failed.",
      response.status >= 500 || response.status === 429 ? 503 : 502,
    );
    const payload = await response.json() as Record<string, unknown>;
    requireLearning(typeof payload.access_token === "string" && payload.access_token.length > 0,
      "ags.token-shape", "AGS token response did not contain an access token.", 502);
    return payload.access_token;
  }

  async postApprovedScore(
    registration: LtiPlatformRegistration,
    request: AgsScoreRequest,
  ): Promise<AgsScoreResult> {
    requireLearning(registration.allowedServices.includes("ags"), "ags.platform-disabled",
      "AGS is disabled for this platform.", 403);
    const token = await this.accessToken(registration, request.deploymentId, [AGS_SCOPES.score]);
    const scoreGiven = Number(request.scoreGiven);
    const scoreMaximum = Number(request.scoreMaximum);
    requireLearning(Number.isFinite(scoreGiven) && Number.isFinite(scoreMaximum),
      "ags.score-number", "Approved score is outside the AGS numeric range.");
    const response = await this.fetcher(`${request.lineItemUrl.replace(/\/+$/, "")}/scores`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/vnd.ims.lis.v1.score+json",
        "idempotency-key": request.idempotencyKey,
      },
      body: JSON.stringify({
        userId: request.userId,
        scoreGiven,
        scoreMaximum,
        activityProgress: "Completed",
        gradingProgress: "FullyGraded",
        timestamp: request.timestamp,
        ...(request.comment ? { comment: request.comment } : {}),
      }),
    });
    return {
      status: response.status,
      retryable: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500,
    };
  }
}
