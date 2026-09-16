import type { CapabilityRef } from "../../platform/capabilities/types";
import type { EvidenceBundle, RunTrace } from "../../platform/evidence/types";
import type { ProcedureIR } from "../../platform/procedure-ir/types";
import type {
  CausalystAssessmentDefinition,
  RubricEvaluation,
  VersionedRef,
} from "../domain/types";
import type { PromptRevisionRecord } from "../prompt/types";

export const causalystSubmissionSchema = "causalyst.submission" as const;
export const causalystSubmissionSchemaVersion = "1.0" as const;
export const causalystSubmissionPackageSchema = "causalyst.submission-package" as const;
export const causalystSubmissionPackageSchemaVersion = "1.0" as const;

export interface ExplanationResponse {
  promptId: string;
  responseText: string;
  submittedAt: string;
}

export interface SubmissionIntegrityRecord {
  status: "valid" | "invalid";
  assessmentVersion: string;
  domainPackVersion: string;
  capabilityManifestSchemaVersion: "2.0";
  evidenceRegistryVersion: string;
  artifactRefs: VersionedRef[];
  evidenceTypeRefs: VersionedRef[];
  checkCodes: string[];
}

export interface LocalTeacherApproval {
  status: "pending" | "approved-local" | "changes-requested";
  reviewedAt?: string;
  reviewerNote?: string;
  approvedCriterionLevelIds?: Array<{
    criterionId: string;
    levelId: string;
  }>;
  gradeReturn: false;
}

export interface CausalystSubmission {
  schema: typeof causalystSubmissionSchema;
  schemaVersion: typeof causalystSubmissionSchemaVersion;
  submissionId: string;
  assessmentRef: VersionedRef;
  attemptNumber: number;
  submittedAt: string;
  artifactSnapshots: Array<Record<string, unknown>>;
  procedureIRCandidates?: ProcedureIR[];
  runTraces: RunTrace[];
  evidenceBundle: EvidenceBundle;
  explanations: ExplanationResponse[];
  promptRevisions?: PromptRevisionRecord[];
  usedCapabilityRefs: CapabilityRef[];
  rubricEvaluation: RubricEvaluation;
  integrity: SubmissionIntegrityRecord;
  teacherApproval: LocalTeacherApproval;
}

export interface CausalystSubmissionPackage {
  schema: typeof causalystSubmissionPackageSchema;
  schemaVersion: typeof causalystSubmissionPackageSchemaVersion;
  packageId: string;
  createdAt: string;
  assessment: CausalystAssessmentDefinition;
  submission: CausalystSubmission;
  files: Array<{
    id: "assessment" | "submission" | "evidence" | "trace" | "rubric-evaluation";
    fileName: string;
    mediaType: "application/json";
    byteLength: number;
    content: string;
  }>;
  limitations: string[];
}

