import { compareDecimal, parseDecimal } from "../../platform/planning/decimal";
import type { CapabilityRef } from "../../platform/capabilities/types";
import type { EvidenceBundle, EvidenceRecord } from "../../platform/evidence/types";
import type {
  CausalystRubric,
  EvidenceSelector,
  PrimitiveEvidenceValue,
  RubricEvaluation,
} from "../domain/types";

export interface RubricEvaluationContext {
  artifactValid: boolean;
  usedCapabilityRefs: CapabilityRef[];
}

const capabilityKey = (ref: CapabilityRef) =>
  `${ref.domainPackId}:${ref.kind}:${ref.id}@${ref.version}`;

const pointerValue = (payload: unknown, pointer: string): unknown => pointer
  .split("/")
  .slice(1)
  .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"))
  .reduce<unknown>((value, token) =>
    value && typeof value === "object" ? (value as Record<string, unknown>)[token] : undefined, payload);

const matchingRecords = (
  selector: Extract<EvidenceSelector, { type: "evidence-type" | "payload-equals" }>,
  evidence: EvidenceBundle,
): EvidenceRecord[] => evidence.records.filter(
  ({ typeId, typeVersion }) =>
    typeId === selector.evidenceTypeId && typeVersion === selector.evidenceTypeVersion,
);

const primitiveEquals = (left: unknown, right: PrimitiveEvidenceValue): boolean =>
  typeof left === typeof right && left === right;

const selectorMatches = (
  selector: EvidenceSelector,
  evidence: EvidenceBundle,
  context: RubricEvaluationContext,
): boolean => {
  switch (selector.type) {
    case "artifact-valid":
      return context.artifactValid;
    case "capability-used":
      return context.usedCapabilityRefs.some((ref) => capabilityKey(ref) === capabilityKey(selector.capabilityRef));
    case "evidence-type":
      return matchingRecords(selector, evidence).length >= selector.minimumCount;
    case "payload-equals":
      return matchingRecords(selector, evidence).some(({ payload }) =>
        primitiveEquals(pointerValue(payload, selector.path), selector.expected));
  }
};

export const evaluateRubricProvisionally = (
  rubric: CausalystRubric,
  evidence: EvidenceBundle,
  context: RubricEvaluationContext,
): RubricEvaluation => ({
  schema: "causalyst.rubric-evaluation",
  schemaVersion: "1.0",
  rubricId: rubric.id,
  evidenceBundleId: evidence.bundleId,
  criteria: rubric.criteria.map((criterion) => {
    const matchedSelectorIds = criterion.evidenceSelectors
      .filter((selector) => selectorMatches(selector, evidence, context))
      .map(({ id }) => id);
    const missingSelectorIds = criterion.evidenceSelectors
      .filter(({ id }) => !matchedSelectorIds.includes(id))
      .map(({ id }) => id);
    if (criterion.scoringMode === "manual") return {
      criterionId: criterion.id,
      matchedSelectorIds,
      missingSelectorIds,
      status: "manual-review" as const,
      explanation: "This criterion is manual. Evidence matches are provided only for teacher review.",
    };
    if (missingSelectorIds.length > 0) return {
      criterionId: criterion.id,
      matchedSelectorIds,
      missingSelectorIds,
      status: criterion.missingEvidenceBehavior === "not-applicable" ? "not-applicable" as const : "provisional" as const,
      ...(criterion.missingEvidenceBehavior === "zero" ? { provisionalPoints: "0" } : {}),
      explanation: "Required declarative evidence is incomplete; teacher review remains required.",
    };
    const level = [...criterion.levels].sort((left, right) =>
      compareDecimal(parseDecimal(right.points), parseDecimal(left.points)))[0];
    return {
      criterionId: criterion.id,
      matchedSelectorIds,
      missingSelectorIds,
      suggestedLevelId: level?.id,
      provisionalPoints: level?.points,
      status: "provisional" as const,
      explanation: "All configured selectors matched. This is provisional and cannot become a final score without teacher review.",
    };
  }),
  decision: "teacher-review-required",
  finalScore: null,
});
