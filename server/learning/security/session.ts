import type { AppSessionClaims, LearningServiceConfig } from "../types";
import { decodeBase64UrlJson } from "./base64url";
import { verify } from "node:crypto";
import { createPublicKey } from "node:crypto";
import { decodeBase64Url } from "./base64url";
import { requireLearning } from "../errors";
import { LearningServiceError } from "../errors";

export const verifyAppSessionToken = (
  token: string,
  config: LearningServiceConfig,
  nowSeconds: number,
): AppSessionClaims => {
  const parts = token.split(".");
  requireLearning(parts.length === 3, "session.shape", "Session token is malformed.", 401);
  let header: { alg: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = decodeBase64UrlJson<{ alg: string; kid?: string }>(parts[0]);
    claims = decodeBase64UrlJson<Record<string, unknown>>(parts[1]);
  } catch {
    throw new LearningServiceError("session.encoding", "Session token encoding is invalid.", 401);
  }
  requireLearning(header.alg === "RS256" && typeof header.kid === "string", "session.key", "Session key is invalid.", 401);
  const publicJwk = header.kid === config.keyId
    ? config.publicJwk
    : config.retiringPublicJwks.find(({ kid }) => kid === header.kid);
  requireLearning(publicJwk, "session.key", "Session key is invalid.", 401);
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key: publicJwk, format: "jwk" }),
    decodeBase64Url(parts[2]),
  );
  requireLearning(valid, "session.signature", "Session signature is invalid.", 401);
  requireLearning(claims.iss === config.issuer && claims.aud === config.clientId,
    "session.audience", "Session issuer or audience is invalid.", 401);
  requireLearning(Number.isInteger(claims.iat) && Number.isInteger(claims.exp)
    && (claims.iat as number) <= nowSeconds + 60 && (claims.exp as number) >= nowSeconds,
    "session.expired", "Session has expired.", 401);
  requireLearning(typeof claims.jti === "string" && typeof claims.sub === "string"
    && typeof claims.registrationId === "string" && typeof claims.deploymentId === "string",
  "session.claims", "Session scope claims are invalid.", 401);
  requireLearning(Array.isArray(claims.roles)
    && claims.roles.every((role) => role === "learner" || role === "instructor" || role === "administrator"),
  "session.roles", "Session roles are invalid.", 401);
  return {
    sessionId: claims.jti,
    registrationId: claims.registrationId,
    deploymentId: claims.deploymentId,
    userKey: claims.sub,
    roles: claims.roles as AppSessionClaims["roles"],
    ...(typeof claims.assignmentId === "string" ? { assignmentId: claims.assignmentId } : {}),
    ...(typeof claims.resourceLinkId === "string" ? { resourceLinkId: claims.resourceLinkId } : {}),
    ...(claims.ltiContext && typeof claims.ltiContext === "object" ? {
      ltiContext: claims.ltiContext as AppSessionClaims["ltiContext"],
    } : {}),
    issuedAt: new Date(Number(claims.iat) * 1000).toISOString(),
    expiresAt: new Date(Number(claims.exp) * 1000).toISOString(),
  };
};
