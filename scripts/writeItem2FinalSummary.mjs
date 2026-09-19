import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

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
  },
  sourceSnapshot: {
    fileCount: receipt.sourceSnapshot?.fileCount ?? null,
    payloadSha256: receipt.sourceSnapshot?.payloadSha256 ?? null,
    identitySealPayloadSha256: receipt.identitySeal?.payloadSha256 ?? null,
    phasePayloadHashes: phaseSnapshotHashes,
    allRecordedPhasesUseSamePayload: phaseSnapshotHashes.length === 1 && phaseSnapshotHashes[0] === receipt.sourceSnapshot?.payloadSha256,
  },
  diagnostic: {
    path: `../delivery/${runId}/content-check-compiled.json`,
    sha256: sha256File(diagnosticPath),
    bytes: fileBytes(diagnosticPath),
    exitCode: commandById.get("10-content-check-compiled-json")?.exitCode ?? null,
    retainedFindingCount: diagnostic.violations?.total ?? null,
    byRule: diagnostic.violations?.byRule ?? {},
    residualCategoryCounts,
  },
  recorderReceipt: {
    path: runReceiptPath,
    sha256: sha256File(join(root, runReceiptPath)),
    checkExitCode: commandById.get("09-recorder-check")?.exitCode ?? null,
    checkOutcome: commandById.get("09-recorder-check")?.outcome ?? null,
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
  },
  residualDispositions: {
    retainedCount: residuals.length,
    categories: residualCategoryCounts,
    dispositionRecord: "docs/item2/FINDING_TRIAGE.json",
    allRetainedAsExplicitNonblocking: (triage.currentRawDiagnostics?.justifiedNonblockingSourceTraceResidualCount ?? residuals.length) === residuals.length,
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
    item3Readiness: "Ready for parent review and Item-3 planning only; do not treat this source/static closure as runtime or release acceptance.",
  },
};
scanPlaceholders(summary);
if (placeholders.length) throw new Error(`Unresolved placeholder text in final summary: ${placeholders.join(", ")}`);
writeFileSync(join(deliveryDirectory, "FINAL_SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  path: join(deliveryDirectory, "FINAL_SUMMARY.json"),
  sourceFreezeCommit,
  evidenceCommit,
  manifestMismatches: summary.sourceFreeze.manifestMismatches,
  retainedResiduals: summary.diagnostic.retainedFindingCount,
}, null, 2));
