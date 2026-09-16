import { findForbiddenArtifactData } from "../../platform/artifacts/security";
import { studioDomainPackRegistry } from "../../platform/domain-packs/staticRegistry";
import type { VersionedStudioArtifact } from "../../platform/domain-packs/types";
import { validateEvidenceBundle, validateRunTrace } from "../../platform/evidence/validation";
import { validateProcedureIR } from "../../platform/procedure-ir/validation";
import type { ContractDiagnostic, ContractValidationResult } from "../../platform/validation/jsonSchema";
import { validateCausalystAssessment } from "../domain/validation";
import type { CausalystAssessmentDefinition, VersionedRef } from "../domain/types";
import { causalystEvidenceRegistry } from "../trace/registry";
import { validateCausalystSubmissionSchema } from "./schema";
import type { CausalystSubmission } from "./types";

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const artifactRef = (artifact: Record<string, unknown>): VersionedRef | undefined => {
  if (typeof artifact.id !== "string") return undefined;
  const metadata = artifact.metadata;
  const version = metadata && typeof metadata === "object"
    && typeof (metadata as Record<string, unknown>).version === "string"
    ? String((metadata as Record<string, unknown>).version)
    : typeof artifact.schemaVersion === "string" ? artifact.schemaVersion : undefined;
  return version ? { id: artifact.id, version } : undefined;
};

const sameRef = (left: VersionedRef, right: VersionedRef) =>
  left.id === right.id && left.version === right.version;

export const validateCausalystSubmission = (
  candidate: unknown,
  assessment: CausalystAssessmentDefinition,
): ContractValidationResult<CausalystSubmission> => {
  const schema = validateCausalystSubmissionSchema(candidate);
  if (!schema.ok) return schema;
  const submission = schema.value;
  const diagnostics: ContractDiagnostic[] = [];
  const assessmentValidation = validateCausalystAssessment(assessment);
  if (!assessmentValidation.ok) diagnostics.push(...assessmentValidation.diagnostics.map((entry) => ({
    ...entry,
    path: `/assessment${entry.path === "/" ? "" : entry.path}`,
  })));
  if (!sameRef(submission.assessmentRef, { id: assessment.id, version: assessment.metadata.version })) {
    diagnostics.push(error("causalyst.submission.assessment-mismatch", "/assessmentRef", "Submission assessment version does not match the reviewed assessment."));
  }
  if (!Number.isFinite(Date.parse(submission.submittedAt))) {
    diagnostics.push(error("causalyst.submission.timestamp-invalid", "/submittedAt", "submittedAt must be an ISO-8601 timestamp."));
  }
  if (submission.attemptNumber > assessment.attemptPolicy.maximumAttempts) {
    diagnostics.push(error("causalyst.submission.attempt-limit", "/attemptNumber", "Attempt exceeds the teacher-configured limit."));
  }
  const pack = studioDomainPackRegistry.hasExact(assessment.domainPackRef)
    ? studioDomainPackRegistry.resolveExact(assessment.domainPackRef)
    : undefined;
  submission.artifactSnapshots.forEach((artifact, index) => {
    const result = pack?.validateArtifact(artifact as VersionedStudioArtifact, {});
    if (!result?.ok) diagnostics.push(...(result?.diagnostics ?? [error(
      "causalyst.submission.domain-pack-missing",
      `/artifactSnapshots/${index}`,
      "The pinned domain pack is unavailable.",
    )]).map((entry) => ({
      ...entry,
      path: `/artifactSnapshots/${index}${entry.path === "/" ? "" : entry.path}`,
    })));
    const ref = artifactRef(artifact);
    if (!ref || !submission.integrity.artifactRefs.some((expected) => sameRef(expected, ref))) {
      diagnostics.push(error("causalyst.submission.artifact-ref-mismatch", `/artifactSnapshots/${index}`, "Artifact snapshot is not represented by the integrity pins."));
    }
  });
  submission.procedureIRCandidates?.forEach((procedure, index) => {
    const result = validateProcedureIR(procedure);
    if (!result.ok) diagnostics.push(...result.diagnostics.map((entry) => ({
      ...entry,
      path: `/procedureIRCandidates/${index}${entry.path === "/" ? "" : entry.path}`,
    })));
  });
  const evidence = validateEvidenceBundle(submission.evidenceBundle, causalystEvidenceRegistry);
  if (!evidence.ok) diagnostics.push(...evidence.diagnostics.map((entry) => ({
    ...entry,
    path: `/evidenceBundle${entry.path === "/" ? "" : entry.path}`,
  })));
  submission.runTraces.forEach((trace, index) => {
    const result = validateRunTrace(trace, causalystEvidenceRegistry, submission.evidenceBundle);
    if (!result.ok) diagnostics.push(...result.diagnostics.map((entry) => ({
      ...entry,
      path: `/runTraces/${index}${entry.path === "/" ? "" : entry.path}`,
    })));
  });
  const traceIds = new Set(submission.runTraces.map(({ traceId }) => traceId));
  if (traceIds.size !== submission.runTraces.length) {
    diagnostics.push(error("causalyst.submission.trace-duplicate", "/runTraces", "Trace IDs must be unique."));
  }
  if (submission.runTraces.length < assessment.runPolicy.requiredRuns) {
    diagnostics.push(error("causalyst.submission.required-runs-missing", "/runTraces", "Submission does not contain the required number of runs."));
  }
  assessment.explanationPrompts.filter(({ required }) => required).forEach((prompt) => {
    if (!submission.explanations.some(({ promptId, responseText }) =>
      promptId === prompt.id && responseText.trim())) diagnostics.push(error(
        "causalyst.submission.explanation-missing",
        "/explanations",
        `Required explanation ${prompt.id} is missing.`,
      ));
  });
  if (submission.rubricEvaluation.finalScore !== null
    || submission.rubricEvaluation.decision !== "teacher-review-required") {
    diagnostics.push(error("causalyst.submission.final-score-forbidden", "/rubricEvaluation", "Submission cannot contain a final score."));
  }
  if (submission.teacherApproval.gradeReturn !== false) {
    diagnostics.push(error("causalyst.submission.grade-return-forbidden", "/teacherApproval/gradeReturn", "Cycle 14 cannot return a score or grade."));
  }
  diagnostics.push(...findForbiddenArtifactData(submission));
  const evidenceRefs = new Set(submission.evidenceBundle.records.map(({ typeId, typeVersion }) =>
    `${typeId}@${typeVersion}`));
  const pinnedEvidenceRefs = new Set(submission.integrity.evidenceTypeRefs.map(({ id, version }) =>
    `${id}@${version}`));
  evidenceRefs.forEach((ref) => {
    if (!pinnedEvidenceRefs.has(ref)) diagnostics.push(error(
      "causalyst.submission.evidence-pin-missing",
      "/integrity/evidenceTypeRefs",
      `Evidence version ${ref} is not pinned.`,
    ));
  });
  if (submission.integrity.assessmentVersion !== assessment.metadata.version
    || submission.integrity.domainPackVersion !== assessment.domainPackRef.version
    || submission.integrity.evidenceRegistryVersion !== submission.evidenceBundle.registryVersion) {
    diagnostics.push(error("causalyst.submission.integrity-version-mismatch", "/integrity", "Integrity versions do not match the assessment and evidence bundle."));
  }
  const uniqueDiagnostics = [...new Map(diagnostics.map((entry) => [
    `${entry.code}|${entry.path}|${entry.message}`,
    entry,
  ])).values()].sort((left, right) =>
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
  return uniqueDiagnostics.length > 0
    ? { ok: false, diagnostics: uniqueDiagnostics }
    : { ok: true, value: submission, diagnostics: [] };
};

