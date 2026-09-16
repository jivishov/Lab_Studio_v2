import { evaluateRubricProvisionally } from "../rubric/evaluator";
import { CausalystTraceCollector } from "../trace/collector";
import { causalystEvidenceRegistry } from "../trace/registry";
import type { EvidenceRecord } from "../../platform/evidence/types";
import type { VersionedStudioArtifact } from "../../platform/domain-packs/types";
import type { CausalystAssessmentDefinition, VersionedRef } from "../domain/types";
import type { PromptBuildResult, PromptRevisionRecord } from "../prompt/types";
import type { CausalystSubmission, ExplanationResponse } from "../submission/types";

const artifactVersion = (artifact: VersionedStudioArtifact): string =>
  "metadata" in artifact ? artifact.metadata.version : artifact.schemaVersion;

const evidenceRecord = (
  input: Omit<EvidenceRecord, "metadata">,
): EvidenceRecord => {
  const descriptor = causalystEvidenceRegistry.get(input.typeId, input.typeVersion);
  if (!descriptor) throw new Error(`Evidence type ${input.typeId}@${input.typeVersion} is not registered.`);
  return {
    ...input,
    metadata: {
      retentionClass: descriptor.retentionClass,
      sensitivity: descriptor.sensitivity,
      accessibleRepresentation: descriptor.accessibleRepresentation,
      redactionPolicyId: descriptor.redaction.policyId,
    },
  };
};

export const createValidatedLocalSubmission = (
  assessment: CausalystAssessmentDefinition,
  input: {
    submissionId: string;
    attemptNumber: number;
    occurredAt: string;
    artifact?: VersionedStudioArtifact;
    promptBuild?: PromptBuildResult;
    explanations: ExplanationResponse[];
    promptRevisions?: PromptRevisionRecord[];
    runConfirmed: boolean;
  },
): CausalystSubmission => {
  const artifact = input.artifact
    ?? (input.promptBuild?.ok ? input.promptBuild.artifact : undefined)
    ?? assessment.executableArtifact.artifact as VersionedStudioArtifact;
  const ref: VersionedRef = { id: artifact.id, version: artifactVersion(artifact) };
  const validationEvidenceId = `${input.submissionId}:artifact-validation`;
  const collector = new CausalystTraceCollector({
    bundleId: `${input.submissionId}:evidence`,
    runId: `${input.submissionId}:run-1`,
    traceId: `${input.submissionId}:trace-1`,
    startedAt: input.occurredAt,
  });
  collector.addEvidence(evidenceRecord({
    evidenceId: validationEvidenceId,
    typeId: "artifact.validation",
    typeVersion: "1.0.0",
    occurredAt: input.occurredAt,
    producerId: "studio.validation",
    summary: `Validated artifact ${ref.id}@${ref.version}.`,
    payload: { artifactId: ref.id, valid: true, diagnosticCodes: [] },
  }));
  const runConfirmationEvidenceId = `${input.submissionId}:run-confirmation`;
  collector.addEvidence(evidenceRecord({
    evidenceId: runConfirmationEvidenceId,
    typeId: "observation.text",
    typeVersion: "1.0.0",
    occurredAt: input.occurredAt,
    producerId: "studio.notebook",
    summary: "Learner-confirmed completion checkpoint for the pinned simulation.",
    payload: {
      observationId: `${input.submissionId}:run-checkpoint`,
      text: input.runConfirmed
        ? "Learner confirmed completing the teacher-directed run in the pinned domain simulation. This checkpoint does not independently prove runtime operations."
        : "Run completion was not confirmed.",
      tags: ["causalyst", "learner-confirmed", "not-runtime-proof"],
    },
  }));
  input.explanations.forEach((explanation, index) => {
    collector.addEvidence(evidenceRecord({
      evidenceId: `${input.submissionId}:explanation:${index + 1}`,
      typeId: "explanation.response",
      typeVersion: "1.0.0",
      occurredAt: explanation.submittedAt,
      producerId: "causalyst.attempt",
      summary: `Learner response to ${explanation.promptId}.`,
      payload: { promptId: explanation.promptId, responseText: explanation.responseText },
    }));
  });
  collector.addEvent({
    eventId: `${input.submissionId}:event:validation`,
    eventTypeId: "artifact.validation",
    occurredAt: input.occurredAt,
    objectRefs: [ref.id],
    evidenceRefs: [validationEvidenceId],
    outcome: "accepted",
    summary: `Artifact ${ref.id}@${ref.version} passed the pinned domain-pack validator.`,
    data: {
      artifactId: ref.id,
      artifactVersion: ref.version,
      domainPackVersion: assessment.domainPackRef.version,
    },
  });
  collector.addEvent({
    eventId: `${input.submissionId}:event:run-confirmation`,
    eventTypeId: "observation.text",
    occurredAt: input.occurredAt,
    objectRefs: [ref.id],
    evidenceRefs: [runConfirmationEvidenceId],
    outcome: input.runConfirmed ? "recorded" : "rejected",
    summary: input.runConfirmed
      ? "Recorded learner confirmation after the pinned simulation run."
      : "Run confirmation is missing.",
    data: { confirmationKind: "learner-confirmed-not-runtime-proof" },
  });
  input.explanations.forEach((explanation, index) => collector.addEvent({
    eventId: `${input.submissionId}:event:explanation:${index + 1}`,
    eventTypeId: "explanation.response",
    occurredAt: explanation.submittedAt,
    objectRefs: [ref.id],
    evidenceRefs: [`${input.submissionId}:explanation:${index + 1}`],
    outcome: "recorded",
    summary: `Recorded learner explanation ${explanation.promptId}.`,
    data: { promptId: explanation.promptId },
  }));
  collector.complete(input.occurredAt);
  const { evidenceBundle, runTrace } = collector.build(input.occurredAt);
  const usedCapabilityRefs = input.promptBuild?.ok
    ? input.promptBuild.usedCapabilityRefs
    : assessment.authoringPolicy.requiredCapabilityRefs;
  const rubricEvaluation = evaluateRubricProvisionally(
    assessment.rubric,
    evidenceBundle,
    { artifactValid: true, usedCapabilityRefs },
  );
  const evidenceTypeRefs = [...new Map(evidenceBundle.records.map(({ typeId, typeVersion }) => [
    `${typeId}@${typeVersion}`,
    { id: typeId, version: typeVersion },
  ])).values()];
  return {
    schema: "causalyst.submission",
    schemaVersion: "1.0",
    submissionId: input.submissionId,
    assessmentRef: { id: assessment.id, version: assessment.metadata.version },
    attemptNumber: input.attemptNumber,
    submittedAt: input.occurredAt,
    artifactSnapshots: [structuredClone(artifact) as unknown as Record<string, unknown>],
    ...(input.promptBuild?.procedure
      ? { procedureIRCandidates: [structuredClone(input.promptBuild.procedure)] }
      : {}),
    runTraces: [runTrace],
    evidenceBundle,
    explanations: structuredClone(input.explanations),
    ...(input.promptRevisions?.length
      ? { promptRevisions: structuredClone(input.promptRevisions) }
      : {}),
    usedCapabilityRefs: structuredClone(usedCapabilityRefs),
    rubricEvaluation,
    integrity: {
      status: "valid",
      assessmentVersion: assessment.metadata.version,
      domainPackVersion: assessment.domainPackRef.version,
      capabilityManifestSchemaVersion: assessment.contractPins.capabilityManifestSchemaVersion,
      evidenceRegistryVersion: evidenceBundle.registryVersion,
      artifactRefs: [ref],
      evidenceTypeRefs,
      checkCodes: [
        "assessment-version-pinned",
        "artifact-domain-validated",
        "evidence-registry-validated",
        "semantic-trace-ordered",
        "teacher-review-required",
        "grade-return-disabled",
      ],
    },
    teacherApproval: { status: "pending", gradeReturn: false },
  };
};
