import type {
  AggregateSupportClassification,
  ClaimSupportAssessment,
  ClassifiedClaimSupport,
  FidelityComparison,
  FidelityLevel,
  FidelityLimitation,
  SupportClassification,
} from "./types";
import { fidelityLevels } from "./types";

const rank = (level: FidelityLevel): number => fidelityLevels.indexOf(level);

const limitationKey = (limitation: FidelityLimitation): string =>
  `${limitation.appliesToRef}\u0000${limitation.code}\u0000${limitation.id}`;

const sortLimitations = (limitations: readonly FidelityLimitation[]): FidelityLimitation[] =>
  [...limitations].sort((left, right) => limitationKey(left).localeCompare(limitationKey(right)));

export const compareFidelity = (
  requested: FidelityLevel,
  supported: FidelityLevel,
  limitations: readonly FidelityLimitation[] = [],
): FidelityComparison => {
  const meetsRequest = rank(supported) >= rank(requested);
  return {
    requested,
    supported,
    meetsRequest,
    status: meetsRequest ? "meets" : rank(supported) <= rank("F1") ? "representable-only" : "insufficient",
    limitations: sortLimitations(limitations),
  };
};

const classifyClaim = (claim: ClaimSupportAssessment): ClassifiedClaimSupport => {
  const comparison = compareFidelity(
    claim.requestedFidelity,
    claim.supportedFidelity,
    claim.limitations,
  );
  let classification: SupportClassification = "runnable";
  if (claim.missingRequirements.length > 0) {
    classification = "unsupported";
  } else if (!comparison.meetsRequest || rank(claim.supportedFidelity) < rank("F2")) {
    classification = "representable";
  } else if (claim.quantitative && rank(claim.supportedFidelity) < rank("F3")) {
    classification = "representable";
  }
  return {
    ...claim,
    missingRequirements: [...claim.missingRequirements].sort(),
    limitations: sortLimitations(claim.limitations),
    comparison,
    classification,
  };
};

export const classifyAggregateSupport = (
  claims: readonly ClaimSupportAssessment[],
): AggregateSupportClassification => {
  const classified = [...claims]
    .sort((left, right) => left.claimId.localeCompare(right.claimId))
    .map(classifyClaim);
  const essential = classified.filter((claim) => claim.essential);
  const classification: SupportClassification = essential.some((claim) => claim.classification === "unsupported")
    ? "unsupported"
    : essential.some((claim) => claim.classification !== "runnable")
      ? "representable"
      : "runnable";
  return {
    schema: "studio.fidelity-assessment",
    schemaVersion: "1.0",
    classification,
    claims: classified,
    limitations: sortLimitations(classified.flatMap((claim) => claim.limitations)),
  };
};
