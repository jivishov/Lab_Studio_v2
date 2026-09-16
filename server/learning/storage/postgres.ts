import type { LearningStore } from "./port";
import type {
  AgsTransactionRecord,
  AssignmentRecord,
  AuditEventRecord,
  LaunchCodeRecord,
  LoginStateRecord,
  PseudonymousUserRecord,
  ResourceLinkRecord,
  ReviewRecord,
  SubmissionRecord,
} from "../types";

export interface PgQueryResult<Row = Record<string, unknown>> { rows: Row[]; rowCount: number | null }
export interface PgQueryable {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<PgQueryResult<Row>>;
}

const json = (value: unknown): string => JSON.stringify(value);
const first = <T>(result: PgQueryResult<{ payload: T }>): T | undefined => result.rows[0]?.payload;

export class PostgresLearningStore implements LearningStore {
  constructor(private readonly db: PgQueryable) {}

  async putLoginState(record: LoginStateRecord): Promise<void> {
    await this.db.query("INSERT INTO learning_login_states (state_hash, payload, expires_at) VALUES ($1,$2::jsonb,$3)", [record.stateHash, json(record), record.expiresAt]);
  }
  async consumeLoginState(stateHash: string, consumedAt: string): Promise<LoginStateRecord | undefined> {
    return first(await this.db.query<{ payload: LoginStateRecord }>(
      "UPDATE learning_login_states SET consumed_at=$2, payload=jsonb_set(payload,'{consumedAt}',to_jsonb($2::text)) WHERE state_hash=$1 AND consumed_at IS NULL AND expires_at>$2 RETURNING payload",
      [stateHash, consumedAt],
    ));
  }
  async putLaunchCode(record: LaunchCodeRecord): Promise<void> {
    await this.db.query("INSERT INTO learning_launch_codes (code_hash, payload, expires_at) VALUES ($1,$2::jsonb,$3)", [record.codeHash, json(record), record.expiresAt]);
  }
  async consumeLaunchCode(codeHash: string, consumedAt: string): Promise<LaunchCodeRecord | undefined> {
    return first(await this.db.query<{ payload: LaunchCodeRecord }>(
      "UPDATE learning_launch_codes SET consumed_at=$2, payload=jsonb_set(payload,'{consumedAt}',to_jsonb($2::text)) WHERE code_hash=$1 AND consumed_at IS NULL AND expires_at>$2 RETURNING payload",
      [codeHash, consumedAt],
    ));
  }
  async upsertUser(record: PseudonymousUserRecord): Promise<PseudonymousUserRecord> {
    return first(await this.db.query<{ payload: PseudonymousUserRecord }>(
      `INSERT INTO pseudonymous_users (registration_id,deployment_id,user_key,lti_subject,payload,last_seen_at,deleted_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,NULL)
       ON CONFLICT (registration_id,deployment_id,user_key) DO UPDATE
       SET lti_subject=EXCLUDED.lti_subject,payload=EXCLUDED.payload,last_seen_at=EXCLUDED.last_seen_at,deleted_at=NULL
       RETURNING payload`,
      [record.registrationId, record.deploymentId, record.userKey, record.ltiSubject, json(record), record.lastSeenAt],
    ))!;
  }
  async getUser(scope: { registrationId: string; deploymentId: string; userKey: string }): Promise<PseudonymousUserRecord | undefined> {
    return first(await this.db.query<{ payload: PseudonymousUserRecord }>(
      "SELECT payload FROM pseudonymous_users WHERE registration_id=$1 AND deployment_id=$2 AND user_key=$3 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.userKey],
    ));
  }
  async putAssignment(record: AssignmentRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO causalyst_assignments (registration_id,deployment_id,id,payload,deleted_at)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (registration_id,deployment_id,id) DO UPDATE SET payload=EXCLUDED.payload,deleted_at=EXCLUDED.deleted_at`,
      [record.registrationId, record.deploymentId, record.id, json(record), record.deletedAt ?? null],
    );
  }
  async getAssignment(scope: { registrationId: string; deploymentId: string; id: string }): Promise<AssignmentRecord | undefined> {
    return first(await this.db.query<{ payload: AssignmentRecord }>(
      "SELECT payload FROM causalyst_assignments WHERE registration_id=$1 AND deployment_id=$2 AND id=$3 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.id],
    ));
  }
  async putResourceLink(record: ResourceLinkRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO causalyst_resource_links (registration_id,deployment_id,resource_link_id,assignment_id,payload)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (registration_id,deployment_id,resource_link_id) DO UPDATE SET assignment_id=EXCLUDED.assignment_id,payload=EXCLUDED.payload`,
      [record.registrationId, record.deploymentId, record.resourceLinkId, record.assignmentId, json(record)],
    );
  }
  async getResourceLink(scope: { registrationId: string; deploymentId: string; resourceLinkId: string }): Promise<ResourceLinkRecord | undefined> {
    return first(await this.db.query<{ payload: ResourceLinkRecord }>(
      "SELECT payload FROM causalyst_resource_links WHERE registration_id=$1 AND deployment_id=$2 AND resource_link_id=$3",
      [scope.registrationId, scope.deploymentId, scope.resourceLinkId],
    ));
  }
  async putSubmission(record: SubmissionRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO causalyst_submissions (registration_id,deployment_id,id,assignment_id,learner_user_key,payload,deleted_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       ON CONFLICT (registration_id,deployment_id,id) DO UPDATE SET payload=EXCLUDED.payload,deleted_at=EXCLUDED.deleted_at`,
      [record.registrationId, record.deploymentId, record.id, record.assignmentId, record.learnerUserKey, json(record), record.deletedAt ?? null],
    );
    await this.db.query(
      "DELETE FROM causalyst_submission_artifacts WHERE registration_id=$1 AND deployment_id=$2 AND submission_id=$3",
      [record.registrationId, record.deploymentId, record.id],
    );
    for (const artifact of record.submission.artifactSnapshots) {
      const value = artifact as Record<string, unknown>;
      const metadata = value.metadata && typeof value.metadata === "object"
        ? value.metadata as Record<string, unknown>
        : undefined;
      const artifactId = String(value.id ?? "");
      const artifactVersion = String(metadata?.version ?? value.schemaVersion ?? "");
      await this.db.query(
        `INSERT INTO causalyst_submission_artifacts (
           registration_id,deployment_id,submission_id,artifact_id,artifact_version,payload,byte_length
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          record.registrationId, record.deploymentId, record.id, artifactId,
          artifactVersion, json(value), Buffer.byteLength(json(value), "utf8"),
        ],
      );
    }
  }
  async getSubmission(scope: { registrationId: string; deploymentId: string; id: string }): Promise<SubmissionRecord | undefined> {
    return first(await this.db.query<{ payload: SubmissionRecord }>(
      "SELECT payload FROM causalyst_submissions WHERE registration_id=$1 AND deployment_id=$2 AND id=$3 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.id],
    ));
  }
  async listSubmissions(scope: { registrationId: string; deploymentId: string; assignmentId: string }): Promise<SubmissionRecord[]> {
    return (await this.db.query<{ payload: SubmissionRecord }>(
      "SELECT payload FROM causalyst_submissions WHERE registration_id=$1 AND deployment_id=$2 AND assignment_id=$3 AND deleted_at IS NULL ORDER BY submitted_at,id",
      [scope.registrationId, scope.deploymentId, scope.assignmentId],
    )).rows.map(({ payload }) => payload);
  }
  async putReview(record: ReviewRecord): Promise<void> {
    await this.db.query(
      "INSERT INTO causalyst_reviews (registration_id,deployment_id,id,submission_id,payload) VALUES ($1,$2,$3,$4,$5::jsonb)",
      [record.registrationId, record.deploymentId, record.id, record.submissionId, json(record)],
    );
  }
  async listReviews(scope: { registrationId: string; deploymentId: string; submissionId: string }): Promise<ReviewRecord[]> {
    return (await this.db.query<{ payload: ReviewRecord }>(
      "SELECT payload FROM causalyst_reviews WHERE registration_id=$1 AND deployment_id=$2 AND submission_id=$3 ORDER BY reviewed_at,id",
      [scope.registrationId, scope.deploymentId, scope.submissionId],
    )).rows.map(({ payload }) => payload);
  }
  async putAgsTransaction(record: AgsTransactionRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO ags_transactions (
         registration_id,deployment_id,id,assignment_id,submission_id,
         approval_review_id,idempotency_key,status,payload,updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       ON CONFLICT (registration_id,deployment_id,idempotency_key) DO UPDATE
       SET status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`,
      [
        record.registrationId, record.deploymentId, record.id, record.assignmentId,
        record.submissionId, record.approvalReviewId, record.idempotencyKey,
        record.status, json(record), record.updatedAt,
      ],
    );
  }
  async getAgsTransaction(scope: { registrationId: string; deploymentId: string; idempotencyKey: string }): Promise<AgsTransactionRecord | undefined> {
    return first(await this.db.query<{ payload: AgsTransactionRecord }>(
      "SELECT payload FROM ags_transactions WHERE registration_id=$1 AND deployment_id=$2 AND idempotency_key=$3",
      [scope.registrationId, scope.deploymentId, scope.idempotencyKey],
    ));
  }
  async appendAudit(record: AuditEventRecord): Promise<void> {
    await this.db.query(
      "INSERT INTO audit_events (id,registration_id,deployment_id,actor_user_key,action,target_type,target_id,outcome,code,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [record.id, record.registrationId ?? null, record.deploymentId ?? null, record.actorUserKey ?? null, record.action, record.targetType, record.targetId ?? null, record.outcome, record.code, record.occurredAt],
    );
  }
  async deleteAssignment(scope: { registrationId: string; deploymentId: string; id: string; deletedAt: string }): Promise<number> {
    const result = await this.db.query(
      "UPDATE causalyst_assignments SET deleted_at=$4,payload=jsonb_set(payload,'{deletedAt}',to_jsonb($4::text)) WHERE registration_id=$1 AND deployment_id=$2 AND id=$3 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.id, scope.deletedAt],
    );
    await this.db.query(
      "UPDATE causalyst_submissions SET deleted_at=$4,payload=jsonb_set(payload,'{deletedAt}',to_jsonb($4::text)) WHERE registration_id=$1 AND deployment_id=$2 AND assignment_id=$3 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.id, scope.deletedAt],
    );
    return result.rowCount ?? 0;
  }
  async deleteUser(scope: { registrationId: string; deploymentId: string; userKey: string; deletedAt: string }): Promise<number> {
    const result = await this.db.query(
      `UPDATE pseudonymous_users
       SET deleted_at=$4,lti_subject='deleted:'||user_key,
           payload=jsonb_build_object(
             'userKey',user_key,'registrationId',registration_id,'deploymentId',deployment_id,'deletedAt',$4::text
           )
       WHERE registration_id=$1 AND deployment_id=$2 AND user_key=$3 AND deleted_at IS NULL`,
      [scope.registrationId, scope.deploymentId, scope.userKey, scope.deletedAt],
    );
    await this.db.query(
      "UPDATE causalyst_submissions SET deleted_at=$4,payload=jsonb_set(payload,'{deletedAt}',to_jsonb($4::text)) WHERE registration_id=$1 AND deployment_id=$2 AND learner_user_key=$3 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.userKey, scope.deletedAt],
    );
    return result.rowCount ?? 0;
  }
  async deleteDeployment(scope: { registrationId: string; deploymentId: string; deletedAt: string }): Promise<number> {
    const result = await this.db.query(
      "UPDATE causalyst_assignments SET deleted_at=$3,payload=jsonb_set(payload,'{deletedAt}',to_jsonb($3::text)) WHERE registration_id=$1 AND deployment_id=$2 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.deletedAt],
    );
    await this.db.query(
      "UPDATE causalyst_submissions SET deleted_at=$3,payload=jsonb_set(payload,'{deletedAt}',to_jsonb($3::text)) WHERE registration_id=$1 AND deployment_id=$2 AND deleted_at IS NULL",
      [scope.registrationId, scope.deploymentId, scope.deletedAt],
    );
    await this.db.query(
      `UPDATE pseudonymous_users
       SET deleted_at=$3,lti_subject='deleted:'||user_key,
           payload=jsonb_build_object(
             'userKey',user_key,'registrationId',registration_id,'deploymentId',deployment_id,'deletedAt',$3::text
           )
       WHERE registration_id=$1 AND deployment_id=$2 AND deleted_at IS NULL`,
      [scope.registrationId, scope.deploymentId, scope.deletedAt],
    );
    return result.rowCount ?? 0;
  }
  async purgeExpired(now: string): Promise<number> {
    const state = await this.db.query("DELETE FROM learning_login_states WHERE expires_at<$1", [now]);
    const code = await this.db.query("DELETE FROM learning_launch_codes WHERE expires_at<$1", [now]);
    const assignments = await this.db.query(
      `UPDATE causalyst_assignments
       SET deleted_at=$1,payload=jsonb_set(payload,'{deletedAt}',to_jsonb($1::text))
       WHERE deleted_at IS NULL
         AND ((payload->>'updatedAt')::timestamptz
           + ((payload->>'retentionDays')::integer * interval '1 day')) <= $1::timestamptz
       RETURNING registration_id,deployment_id,id`,
      [now],
    );
    for (const row of assignments.rows as Array<{ registration_id: string; deployment_id: string; id: string }>) {
      await this.db.query(
        `UPDATE causalyst_submissions
         SET deleted_at=$4,payload=jsonb_set(payload,'{deletedAt}',to_jsonb($4::text))
         WHERE registration_id=$1 AND deployment_id=$2 AND assignment_id=$3 AND deleted_at IS NULL`,
        [row.registration_id, row.deployment_id, row.id, now],
      );
    }
    return (state.rowCount ?? 0) + (code.rowCount ?? 0) + (assignments.rowCount ?? 0);
  }
}
