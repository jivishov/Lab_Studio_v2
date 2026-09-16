import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const requiredMigrationTables = [
  "lti_platform_registrations",
  "lti_deployments",
  "causalyst_assignments",
  "causalyst_resource_links",
  "pseudonymous_users",
  "causalyst_submissions",
  "causalyst_submission_artifacts",
  "causalyst_reviews",
  "ags_transactions",
  "audit_events",
];
const sourceFiles = [
  "server/learning/lti/launch.ts",
  "server/learning/lti/deepLinking.ts",
  "server/learning/security/jwt.ts",
  "server/learning/services/learningService.ts",
  "server/learning/ags/client.ts",
  "server/learning/http.ts",
  "server/learning/storage/postgres.ts",
  "server/learning/types.ts",
  "src/causalyst/lti/client.ts",
  "src/causalyst/lti/CausalystLtiRoute.tsx",
  "server/learning/README.md",
];
const [migration, config, ...sources] = await Promise.all([
  readFile("server/learning/migrations/001_learning_integration.sql", "utf8"),
  readFile("server/learning/config/learning.example.json", "utf8").then(JSON.parse),
  ...sourceFiles.map((path) => readFile(path, "utf8")),
]);

for (const table of requiredMigrationTables) {
  if (!migration.includes(`CREATE TABLE ${table}`)) throw new Error(`Cycle 15 migration is missing ${table}.`);
}
for (const required of [
  "PRIMARY KEY (registration_id, deployment_id, id)",
  "PRIMARY KEY (registration_id, deployment_id, resource_link_id)",
  "PRIMARY KEY (registration_id, deployment_id, user_key)",
  "runtime database role must not have direct client access",
  "causalyst_resource_links_assignment_idx",
  "causalyst_reviews_submission_idx",
  "ags_transactions_retry_idx",
]) {
  if (!migration.includes(required)) throw new Error(`Cycle 15 deployment-isolation contract is missing ${required}.`);
}
if (config.causalystLtiV1 !== false || config.causalystAgsV1 !== false) {
  throw new Error("Cycle 15 example deployment must keep LTI and AGS disabled.");
}
if (config.registrations.some((registration) => registration.enabled || registration.allowedServices.includes("ags"))) {
  throw new Error("Cycle 15 example registration must remain disabled and AGS-free.");
}

const joined = sources.join("\n");
for (const required of [
  "issuer", "clientId", "deploymentId", "nonce", "stateHash", "jwks",
  "LtiResourceLinkRequest", "LtiDeepLinkingRequest", "teacher-approved",
  "score-approved", "idempotencyKey", "causalystAgsV1", "gradeReturn",
  "pseudonymous", "third-party cookies", "deployment-scoped",
]) {
  if (!joined.toLowerCase().includes(required.toLowerCase())) {
    throw new Error(`Cycle 15 boundary is missing ${required}.`);
  }
}
for (const requiredSource of [
  "aud: input.launch.issuer",
  "lti-dl/claim/data",
  "deepLinkLaunchUrl",
  "lti.jwt-authorized-party",
  "submission.portable-identity",
  "ags.idempotency-conflict",
  "assignment.ags-scope",
  'jwt.name = "JWT"',
  'credentials: "omit"',
  'window.history.replaceState(null, "", "#/causalyst-lti")',
]) {
  if (!joined.includes(requiredSource)) throw new Error(`Cycle 15 security source is missing ${requiredSource}.`);
}
for (const prohibitedStorageField of [
  /\bemail_address\b/i,
  /\bgiven_name\b/i,
  /\bfamily_name\b/i,
  /\baccommodation_details\b/i,
  /\broster_membership\b/i,
]) {
  if (prohibitedStorageField.test(migration)) {
    throw new Error(`Cycle 15 migration contains prohibited identity data: ${prohibitedStorageField}.`);
  }
}
for (const forbiddenPositive of [
  /NRPS is enabled/i,
  /dynamic registration is enabled/i,
  /model-generated grade (?:is|may be) (?:enabled|final|returned)/i,
  /model score (?:is|may be) final/i,
  /QTI export is enabled/i,
]) {
  if (forbiddenPositive.test(joined)) throw new Error(`Cycle 15 contains prohibited scope: ${forbiddenPositive}.`);
}

const vite = await createServer({ configFile: false, appType: "custom", server: { middlewareMode: true } });
try {
  const { MemoryLearningStore } = await vite.ssrLoadModule("/server/learning/storage/memoryStore.ts");
  const { readLaunchCodeFromHash } = await vite.ssrLoadModule("/src/causalyst/lti/client.ts");
  const store = new MemoryLearningStore();
  await store.putLoginState({
    stateHash: "state-hash", nonceHash: "nonce-hash", registrationId: "platform",
    targetLinkUri: "https://tool.example/lti/launch",
    createdAt: "2026-07-27T00:00:00.000Z", expiresAt: "2026-07-27T00:05:00.000Z",
  });
  if (!await store.consumeLoginState("state-hash", "2026-07-27T00:01:00.000Z")) {
    throw new Error("Cycle 15 one-time state did not consume.");
  }
  if (await store.consumeLoginState("state-hash", "2026-07-27T00:02:00.000Z")) {
    throw new Error("Cycle 15 replay protection did not fail closed.");
  }
  if (readLaunchCodeFromHash("#/causalyst-lti?launchCode=one-time-code") !== "one-time-code") {
    throw new Error("Cycle 15 cookie-independent launch fragment adapter is invalid.");
  }
  await store.putAssignment({
    id: "retained-assignment",
    registrationId: "platform",
    deploymentId: "deployment-a",
    assessment: {},
    assessmentVersion: "1.0.0",
    createdByUserKey: "teacher",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    gradable: false,
    agsEnabled: false,
    retentionDays: 1,
  });
  if (await store.getAssignment({
    registrationId: "platform",
    deploymentId: "deployment-b",
    id: "retained-assignment",
  })) throw new Error("Cycle 15 cross-deployment assignment isolation failed.");
  await store.purgeExpired("2026-07-27T00:00:00.000Z");
  if (await store.getAssignment({
    registrationId: "platform",
    deploymentId: "deployment-a",
    id: "retained-assignment",
  })) throw new Error("Cycle 15 assignment retention enforcement failed.");
} finally {
  await vite.close();
}

console.log("Cycle 15 learning lint passed: static LTI/AGS defaults off; Deep Linking platform-audience/JWT form boundary present; deployment-scoped indexed PostgreSQL contract and retention valid; one-time fragment exchange valid; portable identity-free submissions and teacher-approved idempotent AGS boundary present.");
