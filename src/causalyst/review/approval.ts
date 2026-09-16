import type { CausalystAssessmentDefinition } from "../domain/types";
import type { CausalystSubmission } from "../submission/types";
import { validateCausalystSubmission } from "../submission/validation";

export const recordLocalTeacherReview = (
  assessment: CausalystAssessmentDefinition,
  submission: CausalystSubmission,
  input: {
    status: "approved-local" | "changes-requested";
    reviewedAt: string;
    reviewerNote?: string;
    approvedCriterionLevelIds?: Array<{ criterionId: string; levelId: string }>;
  },
): CausalystSubmission => {
  if (!Number.isFinite(Date.parse(input.reviewedAt))) throw new Error("Review time must be ISO-8601.");
  const next: CausalystSubmission = {
    ...structuredClone(submission),
    teacherApproval: {
      status: input.status,
      reviewedAt: input.reviewedAt,
      ...(input.reviewerNote?.trim() ? { reviewerNote: input.reviewerNote.trim() } : {}),
      ...(input.approvedCriterionLevelIds?.length
        ? { approvedCriterionLevelIds: structuredClone(input.approvedCriterionLevelIds) }
        : {}),
      gradeReturn: false,
    },
  };
  const validation = validateCausalystSubmission(next, assessment);
  if (!validation.ok) throw new Error(validation.diagnostics
    .map(({ code, path }) => `${code} at ${path}`).join("; "));
  return validation.value;
};

