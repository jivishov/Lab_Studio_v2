const acceptedSupplementalStatuses = new Set([
  "supplemental-failures",
  "no-supplemental-failures",
]);
const acceptedCheckStatuses = new Set(["supplemental-failures", "passed"]);

export const preparationMode = (argv = process.argv) => {
  const args = Array.from(argv);
  if (!args.includes("--prepare")) {
    return {
      accepted: false,
      status: "preparation-required",
      reason: "Tracked Item-2 record generation is preparation-only; pass --prepare before any checker or write operation.",
    };
  }
  return {
    accepted: true,
    status: "preparation",
    reason: "Tracked Item-2 records may be generated only as pre-final-run preparation.",
  };
};

export const assertPreparationMode = (argv = process.argv) => {
  const decision = preparationMode(argv);
  if (!decision.accepted) throw new Error(decision.reason);
  return decision;
};

export const deriveItem2FinalReadiness = ({
  recorderCheck,
  sourceReviewIncomplete = false,
  sourceFreezeValid = true,
  evidencePointerValid = true,
  sequenceContractValid = true,
} = {}) => {
  const contractErrors = Array.isArray(recorderCheck?.contractErrors) ? recorderCheck.contractErrors : [];
  const mismatches = Array.isArray(recorderCheck?.mismatches) ? recorderCheck.mismatches : [];
  const sourceStatus = recorderCheck?.sourceStatus ?? "unknown";
  const integrityStatus = recorderCheck?.integrityStatus ?? "failed";
  const coreRunStatus = recorderCheck?.coreRunStatus ?? "unknown";
  const supplementalRunStatus = recorderCheck?.supplementalRunStatus ?? "unknown";
  const checkStatus = recorderCheck?.checkStatus ?? "integrity-failed";
  const sourceCurrent = sourceStatus === "current";
  const integrityPassed = integrityStatus === "passed";
  const coreComplete = coreRunStatus === "complete-current-run";
  const supplementalAccepted = acceptedSupplementalStatuses.has(supplementalRunStatus);
  const checkAccepted = acceptedCheckStatuses.has(checkStatus);
  const structuredResultValid = Boolean(recorderCheck)
    && sourceCurrent
    && integrityPassed
    && coreComplete
    && supplementalAccepted
    && checkAccepted
    && contractErrors.length === 0
    && mismatches.length === 0;
  const status = !recorderCheck
    || !sourceCurrent
    || !integrityPassed
    || contractErrors.length > 0
    || mismatches.length > 0
    ? "integrity-failed"
    : !coreComplete
      ? "core-incomplete"
      : !supplementalAccepted || !checkAccepted
        ? "recorder-verdict-invalid"
        : sourceReviewIncomplete
          ? "incomplete-unresolved-source-review"
          : !sourceFreezeValid || !evidencePointerValid || !sequenceContractValid
            ? "source-or-sequence-contract-failed"
            : checkStatus === "supplemental-failures"
              ? "current-integrity-passed-core-complete-with-supplemental-findings"
              : "current-integrity-passed-core-complete";
  return {
    status,
    accepted: structuredResultValid
      && !sourceReviewIncomplete
      && sourceFreezeValid
      && evidencePointerValid
      && sequenceContractValid,
    sourceStatus,
    integrityStatus,
    coreRunStatus,
    supplementalRunStatus,
    checkStatus,
    contractErrors,
    mismatches,
    structuredResultValid,
    supplementalAccepted,
    checkAccepted,
  };
};
