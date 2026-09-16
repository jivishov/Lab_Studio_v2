import { describe, expect, it } from "vitest";
import { createChemistryAssessmentFixture } from "../../domain";
import { createSemanticTrace, appendSemanticEvent } from "../../trace";
import { evaluateRubricProvisionally } from "../../rubric";
import { validateCausalystSubmissionSchema } from "..";

describe("Cycle 14 portable submission", () => {
  it("accepts the public schema shape without identity or a final grade", () => {
    const assessment = createChemistryAssessmentFixture();
    const now = "2026-07-26T00:00:00.000Z";
    const evidence = {
      schema: "studio.evidence-bundle" as const, schemaVersion: "1.0" as const,
      bundleId: "bundle-1", registryVersion: "1.0.0", createdAt: now,
      records: [{
        evidenceId: "evidence-1", typeId: "artifact.validation", typeVersion: "1.0.0",
        occurredAt: now, producerId: "studio.validation", summary: "Valid artifact.",
        metadata: { retentionClass: "submission" as const, sensitivity: "none" as const, accessibleRepresentation: "text" as const, redactionPolicyId: "core.artifact.validation.allowlist-v1" },
        payload: { artifactId: assessment.executableArtifact.artifactRef.id, valid: true, diagnosticCodes: [] },
      }],
    };
    const trace = appendSemanticEvent(createSemanticTrace("trace-1", "run-1", now), {
      eventId: "event-1", eventTypeId: "artifact.validation", occurredAt: now,
      objectRefs: [assessment.executableArtifact.artifactRef.id], evidenceRefs: ["evidence-1"],
      outcome: "completed", summary: "Validated.", data: { artifactVersion: "1.0" },
    });
    const rubricEvaluation = evaluateRubricProvisionally(assessment.rubric, evidence, {
      artifactValid: true, usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs,
    });
    const submission = {
      schema: "causalyst.submission" as const, schemaVersion: "1.0" as const,
      submissionId: "submission-1", assessmentRef: { id: assessment.id, version: assessment.metadata.version },
      attemptNumber: 1, submittedAt: now,
      artifactSnapshots: [assessment.executableArtifact.artifact], runTraces: [trace], evidenceBundle: evidence,
      explanations: [{ promptId: "limitations", responseText: "The result is bounded by the simulation.", submittedAt: now }],
      usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs, rubricEvaluation,
      integrity: {
        status: "valid" as const, assessmentVersion: assessment.metadata.version, domainPackVersion: assessment.domainPackRef.version,
        capabilityManifestSchemaVersion: "2.0" as const, evidenceRegistryVersion: evidence.registryVersion,
        artifactRefs: [assessment.executableArtifact.artifactRef],
        evidenceTypeRefs: [{ id: "artifact.validation", version: "1.0.0" }],
        checkCodes: ["artifact.valid"],
      },
      teacherApproval: { status: "pending" as const, gradeReturn: false as const },
    };
    const text = JSON.stringify(submission);
    expect(validateCausalystSubmissionSchema(submission).ok).toBe(true);
    expect(text).not.toMatch(/learner(name|email)|finalGrade|pointer|camera|gesture|chainOfThought/i);
    expect(submission.rubricEvaluation.finalScore).toBeNull();
  });

  it("rejects missing linked evidence and forbidden trace internals", () => {
    const trace = createSemanticTrace("trace-1", "run-1", "2026-07-26T00:00:00.000Z");
    expect(() => appendSemanticEvent(trace, {
      eventId: "event-1", eventTypeId: "action.completed", occurredAt: "2026-07-26T00:00:00.000Z",
      objectRefs: [], evidenceRefs: [], outcome: "completed", summary: "Moved.", data: { pointerCoordinate: "1,2" },
    })).toThrow(/semantic-event boundary/);
  });
});
