import { readFile } from "node:fs/promises";
import type { LearningServiceConfig, LtiPlatformRegistration } from "./types";
import { requireLearning } from "./errors";

const httpsUrl = (value: string, label: string): string => {
  const url = new URL(value);
  requireLearning(url.protocol === "https:" || url.hostname === "127.0.0.1" || url.hostname === "localhost",
    "config.insecure-url", `${label} must use HTTPS outside localhost.`);
  requireLearning(!url.username && !url.password && !url.hash,
    "config.unsafe-url", `${label} must not contain credentials or a fragment.`);
  return url.toString();
};
const exactHttpsUrl = (value: string, label: string): string => {
  httpsUrl(value, label);
  return value;
};

export const validateRegistration = (value: LtiPlatformRegistration): LtiPlatformRegistration => {
  requireLearning(value.id.trim(), "config.registration-id", "Registration id is required.");
  requireLearning(value.issuer.trim(), "config.issuer", "Registration issuer is required.");
  requireLearning(value.clientId.trim(), "config.client-id", "Registration client id is required.");
  requireLearning(value.deploymentIds.length > 0 && new Set(value.deploymentIds).size === value.deploymentIds.length,
    "config.deployments", "Registration deployment ids must be nonempty and unique.");
  requireLearning(value.deploymentIds.every((id) => /^[\x20-\x7E]{1,255}$/.test(id)),
    "config.deployment-id", "Deployment ids must contain 1-255 ASCII characters.");
  requireLearning(new Set(value.allowedServices).size === value.allowedServices.length,
    "config.services", "Registration services must be unique.");
  requireLearning(value.allowedServices.every((service) => service === "deep-linking" || service === "ags"),
    "config.service", "Registration contains an unsupported service.");
  return Object.freeze({
    ...value,
    issuer: exactHttpsUrl(value.issuer, "registration issuer"),
    authorizationEndpoint: httpsUrl(value.authorizationEndpoint, "authorizationEndpoint"),
    tokenEndpoint: httpsUrl(value.tokenEndpoint, "tokenEndpoint"),
    jwksUrl: httpsUrl(value.jwksUrl, "jwksUrl"),
    deploymentIds: [...value.deploymentIds],
    allowedServices: [...value.allowedServices],
  });
};

export const validateLearningConfig = (value: LearningServiceConfig): LearningServiceConfig => {
  requireLearning(value.registrations.length > 0, "config.registrations", "At least one static registration is required.");
  requireLearning(new Set(value.registrations.map(({ id }) => id)).size === value.registrations.length,
    "config.registration-duplicate", "Registration ids must be unique.");
  requireLearning(value.privateKeyPem.includes("PRIVATE KEY"), "config.private-key", "A signing private key is required.");
  requireLearning(value.publicJwk.kty === "RSA" && !("d" in value.publicJwk),
    "config.public-key", "Published active key must be a public RSA JWK.");
  requireLearning(value.keyId.trim(), "config.key-id", "A signing key id is required.");
  requireLearning(Array.isArray(value.retiringPublicJwks), "config.retiring-keys",
    "Retiring public keys must be an array.");
  requireLearning(value.retiringPublicJwks.every((key) => key.kty === "RSA" && !("d" in key)),
    "config.retiring-key", "Retiring keys must be public RSA JWKs.");
  const publishedKids = [value.keyId, ...value.retiringPublicJwks.map(({ kid }) => kid)];
  requireLearning(publishedKids.every((kid) => typeof kid === "string" && kid.length > 0)
    && new Set(publishedKids).size === publishedKids.length,
  "config.key-rotation", "Active and retiring public key ids must be present and unique.");
  requireLearning(value.pseudonymSecret.length >= 32, "config.pseudonym-secret", "Pseudonym secret must contain at least 32 characters.");
  for (const amount of [
    value.sessionTtlSeconds, value.loginStateTtlSeconds, value.launchCodeTtlSeconds,
    value.jwksCacheSeconds, value.maxRequestBytes, value.maxAssessmentBytes,
    value.maxSubmissionBytes, value.maxExplanationBytes, value.retentionDays,
  ]) requireLearning(Number.isSafeInteger(amount) && amount > 0, "config.positive-limit", "All time, size, and retention limits must be positive integers.");
  return Object.freeze({
    ...value,
    issuer: exactHttpsUrl(value.issuer, "service issuer"),
    launchUrl: httpsUrl(value.launchUrl, "launchUrl"),
    deepLinkLaunchUrl: httpsUrl(value.deepLinkLaunchUrl, "deepLinkLaunchUrl"),
    appBaseUrl: httpsUrl(value.appBaseUrl, "appBaseUrl"),
    registrations: value.registrations.map(validateRegistration),
  });
};

export const loadLearningConfig = async (filePath: string): Promise<LearningServiceConfig> =>
  validateLearningConfig(JSON.parse(await readFile(filePath, "utf8")) as LearningServiceConfig);
