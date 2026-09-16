BEGIN;

CREATE TABLE learning_login_states (
  state_hash text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE learning_launch_codes (
  code_hash text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE lti_platform_registrations (
  id text PRIMARY KEY,
  issuer text NOT NULL,
  client_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config_version text NOT NULL,
  UNIQUE (issuer, client_id)
);

CREATE TABLE lti_deployments (
  registration_id text NOT NULL REFERENCES lti_platform_registrations(id) ON DELETE CASCADE,
  deployment_id text NOT NULL,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (registration_id, deployment_id)
);

CREATE TABLE pseudonymous_users (
  registration_id text NOT NULL,
  deployment_id text NOT NULL,
  user_key text NOT NULL,
  lti_subject text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (registration_id, deployment_id, user_key),
  UNIQUE (registration_id, deployment_id, lti_subject)
);

CREATE TABLE causalyst_assignments (
  registration_id text NOT NULL,
  deployment_id text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, deployment_id, id)
);

CREATE TABLE causalyst_resource_links (
  registration_id text NOT NULL,
  deployment_id text NOT NULL,
  resource_link_id text NOT NULL,
  assignment_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, deployment_id, resource_link_id),
  FOREIGN KEY (registration_id, deployment_id, assignment_id)
    REFERENCES causalyst_assignments(registration_id, deployment_id, id)
);

CREATE TABLE causalyst_submissions (
  registration_id text NOT NULL,
  deployment_id text NOT NULL,
  id text NOT NULL,
  assignment_id text NOT NULL,
  learner_user_key text NOT NULL,
  payload jsonb NOT NULL,
  submitted_at timestamptz GENERATED ALWAYS AS ((payload->>'submittedAt')::timestamptz) STORED,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, deployment_id, id),
  FOREIGN KEY (registration_id, deployment_id, assignment_id)
    REFERENCES causalyst_assignments(registration_id, deployment_id, id),
  FOREIGN KEY (registration_id, deployment_id, learner_user_key)
    REFERENCES pseudonymous_users(registration_id, deployment_id, user_key)
);

CREATE TABLE causalyst_submission_artifacts (
  registration_id text NOT NULL,
  deployment_id text NOT NULL,
  submission_id text NOT NULL,
  artifact_id text NOT NULL,
  artifact_version text NOT NULL,
  payload jsonb NOT NULL,
  byte_length integer NOT NULL CHECK (byte_length >= 0),
  PRIMARY KEY (registration_id, deployment_id, submission_id, artifact_id, artifact_version),
  FOREIGN KEY (registration_id, deployment_id, submission_id)
    REFERENCES causalyst_submissions(registration_id, deployment_id, id) ON DELETE CASCADE
);

CREATE TABLE causalyst_reviews (
  registration_id text NOT NULL,
  deployment_id text NOT NULL,
  id text NOT NULL,
  submission_id text NOT NULL,
  payload jsonb NOT NULL,
  reviewed_at timestamptz GENERATED ALWAYS AS ((payload->>'reviewedAt')::timestamptz) STORED,
  PRIMARY KEY (registration_id, deployment_id, id),
  FOREIGN KEY (registration_id, deployment_id, submission_id)
    REFERENCES causalyst_submissions(registration_id, deployment_id, id) ON DELETE CASCADE
);

CREATE TABLE ags_transactions (
  registration_id text NOT NULL,
  deployment_id text NOT NULL,
  id text NOT NULL,
  assignment_id text NOT NULL,
  submission_id text NOT NULL,
  approval_review_id text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'pending','succeeded','retryable-failure','permanent-failure','disabled'
  )),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, deployment_id, id),
  UNIQUE (registration_id, deployment_id, idempotency_key),
  FOREIGN KEY (registration_id, deployment_id, assignment_id)
    REFERENCES causalyst_assignments(registration_id, deployment_id, id),
  FOREIGN KEY (registration_id, deployment_id, submission_id)
    REFERENCES causalyst_submissions(registration_id, deployment_id, id),
  FOREIGN KEY (registration_id, deployment_id, approval_review_id)
    REFERENCES causalyst_reviews(registration_id, deployment_id, id)
);

CREATE TABLE audit_events (
  id text PRIMARY KEY,
  registration_id text,
  deployment_id text,
  actor_user_key text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  outcome text NOT NULL CHECK (outcome IN ('accepted','rejected','completed')),
  code text NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX causalyst_submissions_assignment_idx
  ON causalyst_submissions (registration_id, deployment_id, assignment_id, submitted_at)
  WHERE deleted_at IS NULL;
CREATE INDEX causalyst_submissions_user_idx
  ON causalyst_submissions (registration_id, deployment_id, learner_user_key)
  WHERE deleted_at IS NULL;
CREATE INDEX causalyst_resource_links_assignment_idx
  ON causalyst_resource_links (registration_id, deployment_id, assignment_id);
CREATE INDEX causalyst_reviews_submission_idx
  ON causalyst_reviews (registration_id, deployment_id, submission_id, reviewed_at);
CREATE INDEX ags_transactions_submission_idx
  ON ags_transactions (registration_id, deployment_id, submission_id, updated_at);
CREATE INDEX ags_transactions_retry_idx
  ON ags_transactions (registration_id, deployment_id, updated_at)
  WHERE status IN ('pending','retryable-failure');
CREATE INDEX audit_events_scope_idx
  ON audit_events (registration_id, deployment_id, occurred_at);

-- Deployment isolation is enforced by composite keys plus mandatory
-- registration_id/deployment_id predicates in the narrow storage port. The
-- runtime database role must not have direct client access. RLS is intentionally
-- not declared until a connection-scoped transaction adapter can set and clear
-- deployment context without leaking it across a pool.

COMMIT;
