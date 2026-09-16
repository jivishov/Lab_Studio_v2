import { describe, expect, it } from "vitest";
import type { EvidenceBundle } from "../../../platform/evidence/types";
import { createChemistryAssessmentFixture } from "../../domain";
import { evaluateRubricProvisionally } from "../evaluator";

const evidence: EvidenceBundle = {
  schema: "studio.evidence-bundle",
  schemaVersion: "1.0",
  bundleId: "cycle13-bundle",
  registryVersion: "1.0.0",
  createdAt: "2026-07-26T00:00:00.000Z",
  records: [{
    evidenceId: "validation-1",
    typeId: "artifact.validation",
    typeVersion: "1.0.0",
    occurredAt: "2026-07-26T00:00:00.000Z",
    producerId: "studio.validation",
    summary: "Artifact is valid.",
    metadata: {
      retentionClass: "submission",
      sensitivity: "none",
      accessibleRepresentation: "text",
      redactionPolicyId: "core.artifact.validation.allowlist-v1",
    },
    payload: { artifactId: "fixture", valid: true, diagnosticCodes: [] },
  }],
};

describe("declarative Causalyst rubric evaluation", () => {
  it("returns provisional evidence-linked credit and never a final score", () => {
    const assessment = createChemistryAssessmentFixture();
    const result = evaluateRubricProvisionally(assessment.rubric, evidence, {
      artifactValid: true,
      usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs,
    });
    expect(result.criteria[0]).toMatchObject({ status: "provisional", provisionalPoints: "10" });
    expect(result.decision).toBe("teacher-review-required");
    expect(result.finalScore).toBeNull();
  });

  it("flags missing evidence for review without inventing a score", () => {
    const assessment = createChemistryAssessmentFixture();
    const result = evaluateRubricProvisionally(assessment.rubric, { ...evidence, records: [] }, {
      artifactValid: true,
      usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs,
    });
    expect(result.criteria[0].missingSelectorIds).toContain("validation-record-present");
    expect(result.finalScore).toBeNull();
  });
});
