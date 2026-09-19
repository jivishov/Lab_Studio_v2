import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deriveItem2FinalReadiness } from "./item2EvidenceReadiness.mjs";

const root = process.cwd();
const git = process.platform === "win32" ? "git.exe" : "git";
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const runId = valueAfter("--run-id");
const sourceFreezeCommit = valueAfter("--source-freeze-commit");
const evidenceCommit = valueAfter("--evidence-commit");
const deliveryRoot = resolve(valueAfter("--delivery-root") ?? join(root, "..", "delivery"));
if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(runId ?? "")) throw new Error("--run-id must be a safe lowercase run id.");
if (!/^[0-9a-f]{40}$/.test(sourceFreezeCommit ?? "")) throw new Error("--source-freeze-commit must be a full commit hash.");
if (!/^[0-9a-f]{40}$/.test(evidenceCommit ?? "")) throw new Error("--evidence-commit must be a full commit hash.");

const deliveryDirectory = resolve(deliveryRoot, runId);
const runReceiptPath = `planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current-runs/${runId}/CURRENT_VERIFICATION_RUN.json`;
const sequenceReceiptPath = join(deliveryDirectory, "FINAL_SEQUENCE_RECEIPT.json");
const diagnosticPath = join(deliveryDirectory, "content-check-compiled.json");
const recorderCheckPath = join(deliveryDirectory, "recorder-check.json");
const recorderCheckRelativePath = `../delivery/${runId}/recorder-check.json`;
const contentCheckLogRelativePath = `planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current-runs/${runId}/logs/repository-content-check.log`;
const contentCheckLogPath = join(root, contentCheckLogRelativePath);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const sha256File = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const fileBytes = (file) => statSync(file).size;
const gitText = (gitArgs) => execFileSync(git, gitArgs, { cwd: root, encoding: "utf8" }).trim();
const blobFor = (commit, relativePath) => {
  const output = gitText(["ls-tree", "-r", commit, "--", relativePath]);
  const line = output.split(/\r?\n/).find((candidate) => candidate.endsWith(`\t${relativePath}`));
  if (!line) return null;
  return line.match(/^[0-9]+ blob ([0-9a-f]{40})\t/)?.[1] ?? null;
};

const receipt = readJson(join(root, runReceiptPath));
const sequence = readJson(sequenceReceiptPath);
const diagnostic = readJson(diagnosticPath);
const recorderCheck = existsSync(recorderCheckPath) ? readJson(recorderCheckPath) : null;
const manifest = readJson(join(root, "docs/item2/CHANGED_FILE_MANIFEST.json"));
const registry = readJson(join(root, "docs/architecture/source-trace-registry.json"));
const triage = readJson(join(root, "docs/item2/FINDING_TRIAGE.json"));
const coverage = readJson(join(root, "docs/item2/CONFIGURATION_COVERAGE.json"));
const selfReview = readJson(join(root, "docs/item2/SELF_REVIEW_AUDIT.json"));

const manifestEntries = [
  ...(manifest.implementation ?? []),
  ...(manifest.item2Records ?? []),
];
const manifestMismatches = manifestEntries.map((entry) => ({
  path: entry.path,
  recorded: entry.blobSha,
  actual: blobFor(sourceFreezeCommit, entry.path),
})).filter((entry) => entry.recorded !== entry.actual);
if (manifestMismatches.length) throw new Error(`Manifest blob mismatch: ${JSON.stringify(manifestMismatches.slice(0, 10))}`);
const evidenceRunReceiptBlob = blobFor(evidenceCommit, runReceiptPath);
const workingRunReceiptBlob = gitText(["hash-object", runReceiptPath]);
const evidencePointerValid = Boolean(evidenceRunReceiptBlob)
  && evidenceRunReceiptBlob === workingRunReceiptBlob;

const phaseSnapshotHashes = [...new Set((receipt.phases ?? []).map((phase) => phase.sourceSnapshotPayloadSha256).filter(Boolean))];
const sequenceUnexpected = (sequence.commands ?? []).filter((command) => command.outcome !== "expected");
const commandById = new Map((sequence.commands ?? []).map((command) => [command.id, command]));
const coreCommandIds = [
  "02-cycle12-compiler-witness",
  "03-cycle12-reconciliation",
  "04-cycle09-overlay-refresh",
  "05-cycle09-overlay-check",
  "06-cycle12-reconciliation-check",
];
const supplementalCommandIds = ["07-cycle12-static-verifier", "08-repository-content-check"];
const residuals = diagnostic.violations?.retainedFindings ?? [];
const residualCategoryCounts = triage.currentRawDiagnostics?.residualCategoryCounts ?? {};
const reviewedStatuses = new Set([
  "reviewed-static-source-mapping",
  "reviewed-authored-simulator-boundary",
]);
const semanticReview = (registry.traceGroups ?? []).reduce((summaryValue, group) => {
  const status = group.reviewedMapping?.reviewStatus ?? "missing-review-status";
  const disposition = group.reviewedMapping?.decisionDisposition ?? "missing-disposition";
  const members = group.actionIds?.length ?? 0;
  summaryValue.byStatus[status] = {
    groups: (summaryValue.byStatus[status]?.groups ?? 0) + 1,
    members: (summaryValue.byStatus[status]?.members ?? 0) + members,
  };
  summaryValue.byDisposition[disposition] = {
    groups: (summaryValue.byDisposition[disposition]?.groups ?? 0) + 1,
    members: (summaryValue.byDisposition[disposition]?.members ?? 0) + members,
  };
  if (reviewedStatuses.has(status) && String(disposition).startsWith("reviewed-")) {
    summaryValue.reviewedGroups += 1;
    summaryValue.reviewedMembers += members;
  } else if (status === "unresolved-source-review") {
    summaryValue.unresolvedGroups += 1;
    summaryValue.unresolvedMembers += members;
  } else {
    summaryValue.unreviewedGroups += 1;
    summaryValue.unreviewedMembers += members;
  }
  return summaryValue;
}, {
  reviewedGroups: 0,
  reviewedMembers: 0,
  unresolvedGroups: 0,
  unresolvedMembers: 0,
  unreviewedGroups: 0,
  unreviewedMembers: 0,
  byStatus: {},
  byDisposition: {},
});
const recorderCommand = commandById.get("09-recorder-check");
const recorderContractErrors = Array.isArray(recorderCheck?.contractErrors) ? recorderCheck.contractErrors : [];
const recorderMismatches = Array.isArray(recorderCheck?.mismatches) ? recorderCheck.mismatches : [];
const triageSourceReviewCount = Number(triage.currentRawDiagnostics?.unresolvedSourceTraceReviewCount ?? 0);
const triageUnreviewedGroupCount = Number(triage.currentRawDiagnostics?.unreviewedSourceTraceGroupCount ?? 0);
const sourceReviewIncomplete = triageSourceReviewCount > 0
  || triageUnreviewedGroupCount > 0
  || semanticReview.unresolvedGroups > 0
  || semanticReview.unreviewedGroups > 0;
const sourceFreezeValid = manifestMismatches.length === 0;
const sequenceContractValid = sequenceUnexpected.length === 0;
const readinessDecision = deriveItem2FinalReadiness({
  recorderCheck,
  sourceReviewIncomplete,
  sourceFreezeValid,
  evidencePointerValid,
  sequenceContractValid,
});
const readinessStatus = readinessDecision.status;
const finalAccepted = readinessDecision.accepted;
const placeholders = [];
const scanPlaceholders = (value, path = "summary") => {
  if (typeof value === "string" && /recorded in final CURRENT_VERIFICATION_RUN|recorded in final delivery receipt|TODO|PLACEHOLDER/i.test(value)) placeholders.push(path);
  else if (Array.isArray(value)) value.forEach((entry, index) => scanPlaceholders(entry, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => scanPlaceholders(entry, `${path}.${key}`));
};

const summary = {
  schema: "lab-studio/item2-final-summary@1",
  runId,
  scope: "Item-2 catalog/source reconciliation and current static evidence only",
  sourceFreeze: {
    commit: sourceFreezeCommit,
    tree: gitText(["rev-parse", `${sourceFreezeCommit}^{tree}`]),
    documentedHeadBeforeManifestUpdate: manifest.documentedHeadBeforeManifestUpdate,
    manifestEntryCount: manifestEntries.length,
    manifestMismatches: manifestMismatches.length,
  },
  evidenceCommit: {
    commit: evidenceCommit,
    tree: gitText(["rev-parse", `${evidenceCommit}^{tree}`]),
    runReceiptPath,
    runReceiptBlob: evidenceRunReceiptBlob,
    workingRunReceiptBlob,
    pointerValid: evidencePointerValid,
  },
  sourceSnapshot: {
    fileCount: receipt.sourceSnapshot?.fileCount ?? null,
    payloadSha256: receipt.sourceSnapshot?.payloadSha256 ?? null,
    identitySealPayloadSha256: receipt.identitySeal?.payloadSha256 ?? null,
    phasePayloadHashes: phaseSnapshotHashes,
    allRecordedPhasesUseSamePayload: phaseSnapshotHashes.length === 1 && phaseSnapshotHashes[0] === receipt.sourceSnapshot?.payloadSha256,
  },
  readiness: {
    status: readinessStatus,
    accepted: finalAccepted,
    sourceStatus: recorderCheck?.sourceStatus ?? "unknown",
    integrityStatus: recorderCheck?.integrityStatus ?? "failed",
    coreRunStatus: recorderCheck?.coreRunStatus ?? "unknown",
    supplementalRunStatus: recorderCheck?.supplementalRunStatus ?? "unknown",
    checkStatus: recorderCheck?.checkStatus ?? "integrity-failed",
    failedCorePhaseIds: recorderCheck?.failedCorePhaseIds ?? [],
    incompleteCorePhaseIds: recorderCheck?.incompleteCorePhaseIds ?? [],
    supplementalFailures: recorderCheck?.supplementalFailures ?? [],
    contractErrors: recorderContractErrors,
    mismatches: recorderMismatches,
    sourceReviewIncomplete,
    unresolvedSourceTraceReviewCount: triageSourceReviewCount,
    unreviewedSourceTraceGroupCount: triageUnreviewedGroupCount || semanticReview.unresolvedGroups + semanticReview.unreviewedGroups,
    sourceFreezeValid,
    evidencePointerValid,
    sequenceContractValid,
  },
  diagnostic: {
    path: `../delivery/${runId}/content-check-compiled.json`,
    sha256: sha256File(diagnosticPath),
    bytes: fileBytes(diagnosticPath),
    contentCheckLog: contentCheckLogRelativePath,
    exitCode: commandById.get("10-content-check-compiled-json")?.exitCode ?? null,
    retainedFindingCount: diagnostic.violations?.total ?? null,
    byRule: diagnostic.violations?.byRule ?? {},
    residualCategoryCounts,
  },
  recorderReceipt: {
    path: runReceiptPath,
    sha256: sha256File(join(root, runReceiptPath)),
    checkExitCode: recorderCommand?.exitCode ?? null,
    checkOutcome: recorderCommand?.outcome ?? null,
    structuredCheck: {
      path: recorderCheckRelativePath,
      sha256: existsSync(recorderCheckPath) ? sha256File(recorderCheckPath) : null,
      bytes: existsSync(recorderCheckPath) ? fileBytes(recorderCheckPath) : null,
      present: Boolean(recorderCheck),
    },
    verdict: recorderCheck ?? {
      sourceStatus: "unknown",
      integrityStatus: "failed",
      coreRunStatus: "unknown",
      checkStatus: "integrity-failed",
      contractErrors: ["Structured recorder check result is missing."],
      mismatches: [],
    },
  },
  contentCheckLog: {
    path: contentCheckLogRelativePath,
    sha256: sha256File(contentCheckLogPath),
    bytes: fileBytes(contentCheckLogPath),
  },
  sequenceReceipt: {
    path: `../delivery/${runId}/FINAL_SEQUENCE_RECEIPT.json`,
    sha256: sha256File(sequenceReceiptPath),
    commandCount: sequence.commands?.length ?? 0,
    unexpectedCommands: sequenceUnexpected.map((command) => ({ id: command.id, exitCode: command.exitCode, outcome: command.outcome })),
  },
  phaseResults: {
    core: coreCommandIds.map((id) => ({ id, exitCode: commandById.get(id)?.exitCode ?? null, outcome: commandById.get(id)?.outcome ?? null })),
    supplemental: supplementalCommandIds.map((id) => ({ id, exitCode: commandById.get(id)?.exitCode ?? null, outcome: commandById.get(id)?.outcome ?? null })),
    recorded: (receipt.phases ?? []).map((phase) => ({ id: phase.id, exitStatus: phase.exitStatus, exitCode: phase.execution?.exitCode ?? null, freshness: phase.freshness })),
  },
  catalog: {
    indexedActivities: manifest.scenarioAudit?.indexedActivities ?? 59,
    traceCount: registry.traces?.length ?? 0,
    contextualTraceGroupCount: registry.traceGroups?.length ?? 0,
    contextualTraceMemberCount: registry.traceGroups?.reduce((total, group) => total + (group.actionIds?.length ?? 0), 0) ?? 0,
    compiledWitnesses: coverage.currentCompiledCoverage?.compiledWitnessCount ?? null,
    evaluatedNodeContexts: coverage.currentCompiledCoverage?.evaluatedNodeContextCount ?? null,
    compiledContextFindings: coverage.currentCompiledCoverage?.compiledContextFindings ?? null,
    fixedRoleConfigurations: coverage.currentCompiledCoverage?.fixedRoleConfigurations ?? null,
    notApplicableConfigurationRows: coverage.currentCompiledCoverage?.notApplicableConfigurationRows ?? null,
    semanticReview,
    sourceReviewIncomplete,
    readinessStatus,
  },
  residualDispositions: {
    retainedCount: residuals.length,
    categories: residualCategoryCounts,
    dispositionRecord: "docs/item2/FINDING_TRIAGE.json",
    allRetainedAsExplicitNonblocking: !sourceReviewIncomplete
      && (triage.currentRawDiagnostics?.justifiedNonblockingSourceTraceResidualCount ?? residuals.length) === residuals.length,
  },
  selfReview: {
    reviewedHeadReference: selfReview.reviewedHead,
    status: "critical self-review performed by the implementation worker; no independent reviewer claimed",
  },
  boundaries: {
    unrunChecks: [
      "detailed tests and full test suites",
      "build and typecheck",
      "browser or runtime matrices",
      "mobile-specific QA",
      "physical instrument, scientific, classroom-safety, performance and release acceptance",
      "Items 3-5 implementation or acceptance",
    ],
    item3Readiness: finalAccepted
      ? "Ready for parent review and Item-3 planning only; do not treat this source/static closure as runtime or release acceptance."
      : `Not ready for Item-3 planning because Item-2 final readiness is ${readinessStatus}; resolve the current source/recorder/review contract first.`,
  },
};
scanPlaceholders(summary);
if (placeholders.length) throw new Error(`Unresolved placeholder text in final summary: ${placeholders.join(", ")}`);
writeFileSync(join(deliveryDirectory, "FINAL_SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
if (!finalAccepted) {
  console.error(JSON.stringify({
    error: "Final summary is not accepted because the structured recorder/source/review contract is not green.",
    readiness: summary.readiness,
  }, null, 2));
  process.exitCode = 1;
}
console.log(JSON.stringify({
  path: join(deliveryDirectory, "FINAL_SUMMARY.json"),
  sourceFreezeCommit,
  evidenceCommit,
  manifestMismatches: summary.sourceFreeze.manifestMismatches,
  retainedResiduals: summary.diagnostic.retainedFindingCount,
  readinessStatus: summary.readiness.status,
  accepted: summary.readiness.accepted,
}, null, 2));
