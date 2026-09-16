import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const randomOpaque = (prefix: string, byteLength = 24): string =>
  `${prefix}_${randomBytes(byteLength).toString("base64url")}`;

export const hashOpaque = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("base64url");

export const equalOpaqueHash = (value: string, expectedHash: string): boolean => {
  const actual = Buffer.from(hashOpaque(value));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const derivePseudonymousUserKey = (
  secret: string,
  issuer: string,
  deploymentId: string,
  subject: string,
): string => `usr_${createHmac("sha256", secret)
  .update(issuer)
  .update("\0")
  .update(deploymentId)
  .update("\0")
  .update(subject)
  .digest("base64url")}`;
