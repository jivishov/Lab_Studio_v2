# Causalyst Learning Integration Service

This is the separate, stateful Causalyst LTI boundary. It does not share storage
with the stateless MCP service.

## Release boundary

- Static administrator-controlled LTI 1.3 registrations only.
- OIDC state and nonce are single-use and short-lived.
- Platform launch JWTs require RS256, an exact issuer/client/deployment match,
  registered target link URI, LTI version/message type, and mapped minimum role.
- Platform JWKS are cached briefly. The tool publishes one active signing key
  plus optional retiring public keys so administrators can overlap a rotation.
- Browser launch uses a one-time URL-fragment code exchanged for a short-lived
  bearer token. It does not require third-party cookies inside an LMS iframe.
- Identity is scoped to issuer, deployment, and LTI subject. Name, email, roster,
  accommodation, and unrelated LMS claims are neither requested nor stored.
- Assignment, resource-link, submission, review, AGS, and audit records are
  deployment-scoped through composite keys and mandatory scoped storage-port
  predicates. The runtime database role must be private to this service.
- AGS is off unless both `causalystAgsV1` and the static platform/assignment
  settings allow it. Score return requires a separate teacher approval record,
  an LMS-provided line item, and a stable idempotency key.

## Deployment

1. Apply `migrations/001_learning_integration.sql` with a migration identity.
2. Mirror each reviewed static registration/deployment into the administrative
   metadata tables for deployment audit. Runtime discovery still uses only the
   static configuration; there is no dynamic-registration path.
3. Create a restricted runtime config from `config/learning.example.json`.
   Keep the private key and pseudonym secret outside source control.
4. Set `CAUSALYST_DATABASE_URL`, `CAUSALYST_LEARNING_CONFIG`, and optionally
   `CAUSALYST_LEARNING_PORT`, `CAUSALYST_DATABASE_POOL_SIZE`, and
   `CAUSALYST_DATABASE_SSL`.
5. Enable only the reviewed platform registration/deployment. Keep AGS disabled
   until the named platform's token, scope, approval, retry, and idempotency
   integration checks have passed.
6. Run `npm run learning:build`, then start with `npm run learning:start`.

The service emits only request id, method, route, status, and stable outcome
code. Logs omit launch tokens, subjects, prompts, explanations, artifacts,
traces, grades, credentials, local paths, hashes, and provider internals.

## Retention and deletion

Assignments declare a retention period no longer than the deployment maximum.
Deletion operations exist for an assignment, the current pseudonymous user, or
an administrator-authorized deployment. Governed records are logically deleted
and excluded from every scoped application read; user deletion replaces the LTI
subject with a non-reversible tombstone. Expired login state and launch codes
are physically purgeable through the storage port. Physical database compaction,
production scheduling, and institutional retention approval remain deployment
responsibilities.

## Explicit exclusions

No NRPS, name/email identity, dynamic registration, QTI, institution-wide
collaboration, model scoring, model-generated grade, final automatic grade,
clinical interpretation, roster storage, or MCP persistence is implemented.
