import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { decodeBase64Url, decodeBase64UrlJson, encodeBase64Url } from "./base64url";
import { LearningServiceError, requireLearning } from "../errors";
import type { PublishedJwk } from "../types";

export interface JwtHeader { alg: string; kid?: string; typ?: string }
export interface JwtClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  [key: string]: unknown;
}

export interface JwksDocument { keys: PublishedJwk[] }
interface CachedJwks { expiresAt: number; document: JwksDocument }

export class JwksCache {
  private readonly entries = new Map<string, CachedJwks>();
  constructor(
    private readonly ttlSeconds: number,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async get(url: string, nowSeconds: number, forceRefresh = false): Promise<JwksDocument> {
    const cached = this.entries.get(url);
    if (!forceRefresh && cached && cached.expiresAt > nowSeconds) return cached.document;
    const response = await this.fetcher(url, { headers: { accept: "application/json" } });
    requireLearning(response.ok, "lti.jwks-fetch", "Platform JWKS could not be loaded.", 401);
    const value = await response.json() as JwksDocument;
    requireLearning(Array.isArray(value.keys) && value.keys.length > 0, "lti.jwks-shape", "Platform JWKS is invalid.", 401);
    const document = Object.freeze({ keys: value.keys.map((key) => Object.freeze({ ...key })) });
    this.entries.set(url, { expiresAt: nowSeconds + this.ttlSeconds, document });
    return document;
  }

  clear(url?: string): void { if (url) this.entries.delete(url); else this.entries.clear(); }
}

const parseJwt = (token: string): {
  header: JwtHeader;
  claims: JwtClaims;
  signingInput: string;
  signature: Buffer;
} => {
  const parts = token.split(".");
  requireLearning(parts.length === 3, "lti.jwt-shape", "JWT must contain three segments.", 401);
  try {
    return {
      header: decodeBase64UrlJson<JwtHeader>(parts[0]),
      claims: decodeBase64UrlJson<JwtClaims>(parts[1]),
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: decodeBase64Url(parts[2]),
    };
  } catch {
    throw new LearningServiceError("lti.jwt-decode", "JWT encoding is invalid.", 401);
  }
};

export const verifyPlatformJwt = async (input: {
  token: string;
  issuer: string;
  clientId: string;
  jwksUrl: string;
  jwksCache: JwksCache;
  nowSeconds: number;
  clockSkewSeconds?: number;
}): Promise<JwtClaims> => {
  const parsed = parseJwt(input.token);
  requireLearning(parsed.header.alg === "RS256", "lti.jwt-alg", "Only RS256 platform JWTs are accepted.", 401);
  requireLearning(typeof parsed.header.kid === "string" && parsed.header.kid.length > 0,
    "lti.jwt-kid", "JWT signing key id is required.", 401);
  let jwks = await input.jwksCache.get(input.jwksUrl, input.nowSeconds);
  let jwk = jwks.keys.find(({ kid, alg, use }) =>
    kid === parsed.header.kid && (!alg || alg === "RS256") && (!use || use === "sig"));
  if (!jwk) {
    jwks = await input.jwksCache.get(input.jwksUrl, input.nowSeconds, true);
    jwk = jwks.keys.find(({ kid, alg, use }) =>
      kid === parsed.header.kid && (!alg || alg === "RS256") && (!use || use === "sig"));
  }
  requireLearning(jwk, "lti.jwt-key", "JWT signing key is not registered.", 401);
  let valid = false;
  try {
    valid = verify("RSA-SHA256", Buffer.from(parsed.signingInput), createPublicKey({ key: jwk, format: "jwk" }), parsed.signature);
  } catch {
    valid = false;
  }
  requireLearning(valid, "lti.jwt-signature", "JWT signature is invalid.", 401);

  const skew = input.clockSkewSeconds ?? 60;
  requireLearning(parsed.claims.iss === input.issuer, "lti.jwt-issuer", "JWT issuer is invalid.", 401);
  const audiences = Array.isArray(parsed.claims.aud) ? parsed.claims.aud : [parsed.claims.aud];
  requireLearning(audiences.includes(input.clientId), "lti.jwt-audience", "JWT audience is invalid.", 401);
  if (audiences.length > 1) {
    requireLearning(parsed.claims.azp === input.clientId,
      "lti.jwt-authorized-party", "JWT authorized party is invalid.", 401);
  }
  requireLearning(Number.isInteger(parsed.claims.exp) && parsed.claims.exp + skew >= input.nowSeconds,
    "lti.jwt-expired", "JWT is expired.", 401);
  requireLearning(Number.isInteger(parsed.claims.iat) && parsed.claims.iat - skew <= input.nowSeconds,
    "lti.jwt-issued-at", "JWT issued-at time is invalid.", 401);
  requireLearning(parsed.claims.iat >= input.nowSeconds - 600,
    "lti.jwt-too-old", "JWT was issued outside the accepted launch window.", 401);
  requireLearning(typeof parsed.claims.sub === "string" && parsed.claims.sub.length > 0,
    "lti.jwt-subject", "JWT subject is required.", 401);
  return parsed.claims;
};

export const signServiceJwt = (
  claims: Record<string, unknown>,
  keyId: string,
  privateKeyPem: string,
): string => {
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", kid: keyId, typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), createPrivateKey(privateKeyPem));
  return `${signingInput}.${encodeBase64Url(signature)}`;
};
