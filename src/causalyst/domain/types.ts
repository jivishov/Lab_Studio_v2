import type { CapabilityRef } from "../../platform/capabilities/types";
import type { FidelityLevel } from "../../platform/fidelity/types";
import type { EvidenceBundle } from "../../platform/evidence/types";

export const causalystAssessmentSchema = "causalyst.assessment-definition" as const;
export const causalystAssessmentSchemaVersion = "1.0" as const;
export const causalystAssessmentPackageSchema = "causalyst.assessment-package" as const;
export const causalystAssessmentPackageSchemaVersion = "1.0" as const;

export interface VersionedRef {
  id: string;
  version: string;
}

export interface DomainPackRef extends VersionedRef {
  id: "chemistry" | "assay";
}

export interface CausalystContractPins {
  capabilityManifestSchemaVersion: "2.0";
  evidenceRegistryVersion: string;
}

export type PrimitiveEvidenceValue = string | number | boolean;

export type EvidenceSelector =
  | {
      id: string;
      type: "evidence-type";
      evidenceTypeId: string;
      evidenceTypeVersion: string;
      minimumCount: number;
    }
  | {
      id: string;
      type: "artifact-valid";
      expected: true;
    }
  | {
      id: string;
      type: "capability-used";
      capabilityRef: CapabilityRef;
    }
  | {
      id: string;
      type: "payload-equals";
      evidenceTypeId: string;
      evidenceTypeVersion: string;
      path: string;
      expected: PrimitiveEvidenceValue;
    };

export interface RubricLevel {
  id: string;
  label: string;
  description: string;
  points: string;
}

export interface CausalystRubricCriterion {
  id: string;
  title: string;
  description: string;
  weight: string;
  levels: RubricLevel[];
  evidenceSelectors: EvidenceSelector[];
  scoringMode: "manual" | "deterministic" | "rule-assisted";
  minimumEvidenceCount?: number;
  missingEvidenceBehavior: "zero" | "flag-for-review" | "not-applicable";
}

export interface CausalystRubric {
  id: string;
  totalPoints: string;
  criteria: CausalystRubricCriterion[];
  scoringPolicy: {
    finalDecision: "teacher-required";
    allowDeterministicAutoCredit: boolean;
    allowModelSuggestions: false;
  };
}

export interface CausalystAuthoringPolicy {
  mode: "configure" | "approved-palette" | "prompt-bounded";
  allowedCapabilityRefs: CapabilityRef[];
  deniedCapabilityRefs: CapabilityRef[];
  requiredCapabilityRefs: CapabilityRef[];
  allowedParameterPaths: string[];
  lockedParameterPaths: string[];
  maximumProcessNodes: number;
  maximumArtifactsPerAttempt: number;
  requiredFidelity: FidelityLevel;
  unsupportedStepPolicy: "block" | "allow-representable-with-review";
}

export interface CausalystRunPolicy {
  requiredRuns: number;
  allowReset: boolean;
  requirePredictionBeforeRun: boolean;
  requireComparisonAfterRun: boolean;
  requiredEvidenceTypeIds: string[];
  traceRetention: "submission" | "until-graded" | "institution-policy";
  replayEnabled: boolean;
}

export interface CausalystEvidencePlan {
  requiredEvidenceTypeRefs: VersionedRef[];
  optionalEvidenceTypeRefs: VersionedRef[];
  selectorVersion: "1.0";
}

export interface ExplanationPrompt {
  id: string;
  prompt: string;
  required: boolean;
  evidenceSelectorIds: string[];
}

export interface AttemptPolicy {
  maximumAttempts: number;
  allowDrafts: boolean;
}

export interface FeedbackPolicy {
  duringAttempt: "none" | "validation-only" | "configured";
  afterSubmission: "teacher-release";
}

export interface SubmissionPolicy {
  mode: "local-export";
  requireValidArtifact: boolean;
  requireTeacherReview: true;
}

export interface CausalystAssessmentDefinition {
  schema: typeof causalystAssessmentSchema;
  schemaVersion: typeof causalystAssessmentSchemaVersion;
  id: string;
  title: string;
  instructions: string;
  audience: string;
  learningObjectives: string[];
  domainPackRef: DomainPackRef;
  contractPins: CausalystContractPins;
  executableArtifact: {
    mode: "embedded";
    artifactRef: VersionedRef;
    artifact: Record<string, unknown>;
  };
  authoringPolicy: CausalystAuthoringPolicy;
  runPolicy: CausalystRunPolicy;
  evidencePlan: CausalystEvidencePlan;
  rubric: CausalystRubric;
  explanationPrompts: ExplanationPrompt[];
  attemptPolicy: AttemptPolicy;
  feedbackPolicy: FeedbackPolicy;
  submissionPolicy: SubmissionPolicy;
  metadata: {
    version: string;
    author: string;
    updatedAt: string;
    tags: string[];
  };
}

export interface CausalystAssessmentPackage {
  schema: typeof causalystAssessmentPackageSchema;
  schemaVersion: typeof causalystAssessmentPackageSchemaVersion;
  packageId: string;
  createdAt: string;
  assessment: CausalystAssessmentDefinition;
  files: Array<{
    id: "assessment" | "embedded-artifact" | "rubric";
    fileName: string;
    mediaType: "application/json";
    byteLength: number;
    content: string;
  }>;
  limitations: string[];
}

export interface RubricCriterionEvaluation {
  criterionId: string;
  matchedSelectorIds: string[];
  missingSelectorIds: string[];
  suggestedLevelId?: string;
  provisionalPoints?: string;
  status: "manual-review" | "provisional" | "not-applicable";
  explanation: string;
}

export interface RubricEvaluation {
  schema: "causalyst.rubric-evaluation";
  schemaVersion: "1.0";
  rubricId: string;
  evidenceBundleId: string;
  criteria: RubricCriterionEvaluation[];
  decision: "teacher-review-required";
  finalScore: null;
}

export interface CausalystValidationContext {
  evidenceBundle?: EvidenceBundle;
}
