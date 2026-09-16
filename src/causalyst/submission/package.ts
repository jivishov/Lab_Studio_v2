import { serializeArtifactPackage } from "../../platform/artifacts/canonical";
import { serializeCausalystAssessment } from "../domain/package";
import type { CausalystAssessmentDefinition } from "../domain/types";
import { validateCausalystSubmission } from "./validation";
import type { CausalystSubmission, CausalystSubmissionPackage } from "./types";

const bytes = (content: string) => new TextEncoder().encode(content).byteLength;
const safeName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const serializeCausalystSubmission = (
  submission: CausalystSubmission,
  assessment: CausalystAssessmentDefinition,
): string => {
  const validation = validateCausalystSubmission(submission, assessment);
  if (!validation.ok) throw new Error(validation.diagnostics
    .map(({ code, path }) => `${code} at ${path}`).join("; "));
  return serializeArtifactPackage(validation.value);
};

export const createCausalystSubmissionPackage = (
  assessment: CausalystAssessmentDefinition,
  submission: CausalystSubmission,
  input: { packageId: string; createdAt: string },
): CausalystSubmissionPackage => {
  if (!input.packageId.trim() || !Number.isFinite(Date.parse(input.createdAt))) {
    throw new Error("Package ID and ISO-8601 creation time are required.");
  }
  const assessmentContent = serializeCausalystAssessment(assessment);
  const submissionContent = serializeCausalystSubmission(submission, assessment);
  const evidenceContent = serializeArtifactPackage(submission.evidenceBundle);
  const traceContent = serializeArtifactPackage(submission.runTraces);
  const rubricContent = serializeArtifactPackage(submission.rubricEvaluation);
  const files: CausalystSubmissionPackage["files"] = [
    ["assessment", `${assessment.id}.causalyst-assessment.json`, assessmentContent],
    ["submission", `${submission.submissionId}.causalyst-submission.json`, submissionContent],
    ["evidence", `${submission.submissionId}.evidence.json`, evidenceContent],
    ["trace", `${submission.submissionId}.trace.json`, traceContent],
    ["rubric-evaluation", `${submission.submissionId}.rubric-evaluation.json`, rubricContent],
  ].map(([id, fileName, content]) => {
    if (!safeName.test(fileName)) throw new Error(`Unsafe portable file name ${fileName}.`);
    return {
      id: id as CausalystSubmissionPackage["files"][number]["id"],
      fileName,
      mediaType: "application/json" as const,
      byteLength: bytes(content),
      content,
    };
  });
  return {
    schema: "causalyst.submission-package",
    schemaVersion: "1.0",
    packageId: input.packageId,
    createdAt: input.createdAt,
    assessment: structuredClone(assessment),
    submission: structuredClone(submission),
    files,
    limitations: [
      "This local package contains no learner identity.",
      "Replay is semantic and evidence-oriented, not a screen recording.",
      "Rubric results remain provisional until local teacher review.",
      "No LTI, AGS, QTI, score return, or final grade is included.",
    ],
  };
};

export const serializeCausalystSubmissionPackage = (
  value: CausalystSubmissionPackage,
): string => serializeArtifactPackage(value);

export const parseCausalystSubmissionPackage = (
  text: string,
): CausalystSubmissionPackage => {
  const candidate = JSON.parse(text) as CausalystSubmissionPackage;
  if (candidate.schema !== "causalyst.submission-package" || candidate.schemaVersion !== "1.0") {
    throw new Error("Unsupported Causalyst submission package.");
  }
  const canonical = createCausalystSubmissionPackage(candidate.assessment, candidate.submission, {
    packageId: candidate.packageId,
    createdAt: candidate.createdAt,
  });
  canonical.files.forEach((file) => {
    const supplied = candidate.files.find(({ id }) => id === file.id);
    if (!supplied || supplied.content !== file.content || supplied.byteLength !== file.byteLength) {
      throw new Error(`Submission package file ${file.id} failed integrity review.`);
    }
  });
  return candidate;
};

