import type { CapabilityEntry, CapabilityRef } from "../../platform/capabilities/types";
import type { VersionedStudioArtifact } from "../../platform/domain-packs/types";
import { assayDomainPack } from "../../domain-packs/assay/assayPack";
import { chemistryDomainPack } from "../../domain-packs/chemistry/chemistryPack";
import type { CausalystAssessmentDefinition } from "./types";

const artifactVersion = (artifact: VersionedStudioArtifact): string =>
  "metadata" in artifact ? artifact.metadata.version : artifact.schemaVersion;

const runnableCapability = (entries: CapabilityEntry[]): CapabilityRef => {
  const entry = entries.find(({ claims }) => claims.some(({ maximumFidelity }) => ["F2", "F3"].includes(maximumFidelity)));
  if (!entry) throw new Error("Fixture domain pack has no registered interactive capability.");
  return structuredClone(entry.ref);
};

const createFixture = (
  domain: "chemistry" | "assay",
): CausalystAssessmentDefinition => {
  const pack = domain === "chemistry" ? chemistryDomainPack : assayDomainPack;
  const artifactId = pack.conformance.goldenArtifactIds[0];
  const artifact = pack.conformance.getGoldenArtifact(artifactId);
  if (!artifact) throw new Error(`Missing ${domain} golden artifact.`);
  const capability = runnableCapability(pack.getCapabilityManifestFragment().entries);
  return {
    schema: "causalyst.assessment-definition",
    schemaVersion: "1.0",
    id: `causalyst-${domain}-evidence-review`,
    title: domain === "chemistry" ? "Chemistry evidence review" : "Assay evidence review",
    instructions: "Use the provided validated simulation and explain how the recorded evidence supports the outcome.",
    audience: "Secondary or postsecondary science learners",
    learningObjectives: ["Connect a validated simulation action to inspectable evidence.", "Explain limitations without broadening the simulation claim."],
    domainPackRef: { id: domain, version: pack.descriptor.version },
    contractPins: { capabilityManifestSchemaVersion: "2.0", evidenceRegistryVersion: "1.0.0" },
    executableArtifact: {
      mode: "embedded",
      artifactRef: { id: artifact.id, version: artifactVersion(artifact) },
      artifact: structuredClone(artifact) as unknown as Record<string, unknown>,
    },
    authoringPolicy: {
      mode: "configure",
      allowedCapabilityRefs: [capability],
      deniedCapabilityRefs: [],
      requiredCapabilityRefs: [capability],
      allowedParameterPaths: [],
      lockedParameterPaths: ["/id", "/metadata/version"],
      maximumProcessNodes: 100,
      maximumArtifactsPerAttempt: 1,
      requiredFidelity: "F2",
      unsupportedStepPolicy: "block",
    },
    runPolicy: {
      requiredRuns: 1,
      allowReset: true,
      requirePredictionBeforeRun: true,
      requireComparisonAfterRun: true,
      requiredEvidenceTypeIds: ["artifact.validation"],
      traceRetention: "submission",
      replayEnabled: false,
    },
    evidencePlan: {
      requiredEvidenceTypeRefs: [{ id: "artifact.validation", version: "1.0.0" }],
      optionalEvidenceTypeRefs: [{ id: "explanation.response", version: "1.0.0" }],
      selectorVersion: "1.0",
    },
    rubric: {
      id: `${domain}-evidence-rubric`,
      totalPoints: "10",
      criteria: [{
        id: "validated-artifact",
        title: "Validated simulation",
        description: "The submitted artifact remains valid and supplies the required validation evidence.",
        weight: "10",
        levels: [
          { id: "not-yet", label: "Not yet", description: "Required evidence is missing.", points: "0" },
          { id: "met", label: "Met", description: "The validated artifact evidence is present.", points: "10" },
        ],
        evidenceSelectors: [
          { id: "artifact-is-valid", type: "artifact-valid", expected: true },
          {
            id: "validation-record-present",
            type: "evidence-type",
            evidenceTypeId: "artifact.validation",
            evidenceTypeVersion: "1.0.0",
            minimumCount: 1,
          },
        ],
        scoringMode: "rule-assisted",
        missingEvidenceBehavior: "flag-for-review",
      }],
      scoringPolicy: {
        finalDecision: "teacher-required",
        allowDeterministicAutoCredit: false,
        allowModelSuggestions: false,
      },
    },
    explanationPrompts: [{
      id: "limitations",
      prompt: "What does this simulation support, and what does it not establish?",
      required: true,
      evidenceSelectorIds: ["artifact-is-valid", "validation-record-present"],
    }],
    attemptPolicy: { maximumAttempts: 3, allowDrafts: true },
    feedbackPolicy: { duringAttempt: "validation-only", afterSubmission: "teacher-release" },
    submissionPolicy: { mode: "local-export", requireValidArtifact: true, requireTeacherReview: true },
    metadata: {
      version: "1.0.0",
      author: "Lab Studio source-controlled fixture",
      updatedAt: "2026-07-26T00:00:00.000Z",
      tags: ["causalyst", domain, "synthetic", "local"],
    },
  };
};

export const createChemistryAssessmentFixture = () => createFixture("chemistry");
export const createAssayAssessmentFixture = () => createFixture("assay");
