import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const finalRunId = process.argv.includes("--run-id")
  ? process.argv[process.argv.indexOf("--run-id") + 1]
  : "item2-luna-final-20260918";
if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(finalRunId)) {
  throw new Error(`Unsafe final run id: ${finalRunId}`);
}

const followupRoot = "planning/2026-09-08_catalog-fidelity-follow-up";
const runEvidenceRoot = `${followupRoot}/evidence/f08-current-runs/${finalRunId}`;
const contentLog = `${runEvidenceRoot}/logs/repository-content-check.log`;
const contentCapture = `delivery/${finalRunId}/content-check-compiled.json`;
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(
  join(root, relativePath),
  `${JSON.stringify(value, null, 2)}\n`,
  "utf8",
);
const unique = (values) => [...new Set(values)];
const replaceText = (value) => {
  if (typeof value === "string") {
    return value
      .replaceAll("Run B static evidence current", "final current static evidence recorded")
      .replaceAll("Run B overlay current", "final current static overlay recorded")
      .replaceAll("Run B content check current", "final current static content check recorded")
      .replaceAll("Run B current evidence covers the core static chain", "The final current run covers the core static chain")
      .replaceAll("six core phases", "five core phases");
  }
  if (Array.isArray(value)) return value.map(replaceText);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceText(entry)]));
  return value;
};
const gitExecutable = process.platform === "win32" ? "git.exe" : "git";
const gitHead = execFileSync(gitExecutable, ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

const checker = spawnSync(process.execPath, [
  "--experimental-strip-types",
  "--experimental-loader",
  "./scripts/tsCompositionLoader.mjs",
  "scripts/checkContentConsistency.mjs",
  "--compiled",
  "--json",
], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (checker.error) throw checker.error;
let diagnostic;
try {
  diagnostic = JSON.parse(checker.stdout);
} catch (error) {
  throw new Error(`Unable to parse current content diagnostic JSON: ${String(error.message ?? error)}\n${checker.stderr}`);
}

const violationTotal = diagnostic.violations?.total ?? 0;
const violationByRule = diagnostic.violations?.byRule ?? {};
const composition = diagnostic.compositionDiagnostics?.result ?? {};
const coverage = composition.coverage ?? {};
const statuses = composition.statuses ?? [];
const fixedRoleConfigurations = coverage.fixedRoleConfigurations ?? [];
if (violationTotal !== 21 || JSON.stringify(violationByRule) !== JSON.stringify({ "action/source-trace-missing": 21 })) {
  throw new Error(`Unexpected current content diagnostic result: ${JSON.stringify({ violationTotal, violationByRule })}`);
}
if (coverage.unrepresentedConfigurations?.length !== 0 || fixedRoleConfigurations.length !== 37) {
  throw new Error(`Unexpected current configuration coverage: ${JSON.stringify({
    unrepresented: coverage.unrepresentedConfigurations?.length,
    fixedRole: fixedRoleConfigurations.length,
  })}`);
}

const registry = readJson("docs/architecture/source-trace-registry.json");
const traceGroupsByAction = new Map();
for (const group of registry.traceGroups ?? []) {
  for (const actionId of group.actionIds ?? []) {
    traceGroupsByAction.set(`${group.ownerType}:${group.ownerId}#${actionId}`, group);
  }
}

const triagePath = "docs/item2/FINDING_TRIAGE.json";
const triage = readJson(triagePath);
const previousCurrent = triage.currentRawDiagnostics ?? {};
const previousFindings = [
  ...(previousCurrent.findings ?? []),
  ...(previousCurrent.resolvedPriorFindings ?? []),
];
const previousActionFindings = previousFindings.filter((finding) => finding.rule === "action/source-trace-missing");
if (previousActionFindings.length !== 903) {
  throw new Error(`Expected the prior 903 source-trace findings, found ${previousActionFindings.length}.`);
}

const sourceTraceEvidence = (ownerId) => [
  "docs/architecture/source-trace-registry.json",
  `public/techniques/${ownerId}.json`,
  "scripts/generateItem2SourceTraceGroups.mjs",
  contentLog,
];
const sourceTraceResidual = (ownerId, actionId, atomId) => {
  if (atomId === "atom.observe.dry-developed-chromatography-paper") {
    return {
      category: "authored-simulator-operation-without-source-example",
      missingEvidence: "An explicit source operation/locator or an approved simulator-context mapping for drying the developed paper.",
      reason: `The authored drying action ${ownerId}/${actionId} has no direct registry row and atom ${atomId} has no source examples. Keep the residual explicit; do not invent a drying method, duration, or source locator.`,
    };
  }
  return {
    category: "teacher-configured-inventory-without-source-example",
    missingEvidence: "A source plan locator or an explicit source-backed decision that this teacher-configured inventory setup is contextual.",
    reason: `The authored inventory action ${ownerId}/${actionId} has no direct registry row and atom ${atomId} has no source example. Keep the teacher-configuration provenance residual explicit rather than inferring a source-backed inventory choice.`,
  };
};

const transformedFindings = previousActionFindings.map((finding) => {
  const match = finding.context?.match(/^(technique|lab):([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Cannot parse source-trace finding context: ${finding.context}`);
  const [, ownerType, ownerId, actionId] = match;
  const group = traceGroupsByAction.get(`${ownerType}:${ownerId}#${actionId}`);
  const base = {
    ...finding,
    evidence: sourceTraceEvidence(ownerId),
    evaluationScope: "raw-template-rule; current-source-trace-reconciliation",
  };
  if (group) {
    base.detail = `The exact action is covered by contextual source-trace group ${group.id}; the group expands one source boundary to its finite owner-local action members without claiming verbatim source prescription.`;
    base.scenarioImpact = `The current source registry now provides contextual provenance for ${ownerId}/${actionId} through group ${group.id}. The source row remains contextual rather than an exact prescription for this generated/decomposed action; compiled static evidence found zero compiled-context findings, and no runtime or scientific acceptance is implied.`;
    base.disposition = "source-trace-grouped-context";
    base.reason = `Group ${group.id} supplies the exact owner-local member mapping. Source boundary: ${group.sourceFile} ${group.sourceTable} ${group.step}; basis=${group.basis}; actionBasis=${group.actionBasis}. The registry checker validates the group member, atom identity, citation and non-duplication. This closes the generic missing-row report as contextual source provenance only, not as verbatim source prescription or runtime/scientific proof.`;
    base.sourceTraceGroup = {
      id: group.id,
      owner: `${group.ownerType}:${group.ownerId}`,
      actionId,
      memberCount: group.actionIds.length,
      atomId: group.atomId,
      sourceFile: group.sourceFile,
      sourceTable: group.sourceTable,
      step: group.step,
      basis: group.basis,
      sourceBasis: group.sourceBasis,
      actionBasis: group.actionBasis,
      traceDisposition: group.traceDisposition,
    };
    delete base.sourceTraceResidual;
    return base;
  }
  const atomId = (() => {
    const definition = readJson(`public/techniques/${ownerId}.json`);
    return definition.actions.find((action) => action.id === actionId)?.atomId;
  })();
  const residual = sourceTraceResidual(ownerId, actionId, atomId);
  base.detail = `No direct source-trace row or approved contextual group exists for ${ownerId}/${actionId}.`;
  base.scenarioImpact = `The action remains outside source-provenance closure. The current compiled witness produced zero compiled-context findings, so this is not by itself an established runtime, scientific, or learner-facing failure; source provenance remains unresolved.`;
  base.disposition = "unresolved-source-trace-residual";
  base.reason = `${residual.reason} Required next evidence: ${residual.missingEvidence} No runtime/scientific/release acceptance is claimed.`;
  base.sourceTraceResidual = {
    owner: `${ownerType}:${ownerId}`,
    actionId,
    atomId,
    category: residual.category,
    missingEvidence: residual.missingEvidence,
  };
  delete base.sourceTraceGroup;
  return base;
});

const groupedCount = transformedFindings.filter((finding) => finding.sourceTraceGroup).length;
const residualCount = transformedFindings.filter((finding) => finding.sourceTraceResidual).length;
if (groupedCount !== 882 || residualCount !== 21) {
  throw new Error(`Unexpected source-trace reconciliation counts: ${JSON.stringify({ groupedCount, residualCount })}`);
}

const priorCrystalVioletFindings = unique(previousFindings
  .filter((finding) => finding.rule === "cycle06/cuvette-slot-unbalanced" || finding.rule === "cycle06/photometer-wavelength-unproduced")
  .map((finding) => finding.id))
  .map((id) => previousFindings.find((finding) => finding.id === id));
if (priorCrystalVioletFindings.length !== 3) {
  throw new Error(`Expected the three prior Crystal Violet raw rows, found ${priorCrystalVioletFindings.length}.`);
}
const cvResolvedRows = priorCrystalVioletFindings.map((finding) => ({
  ...finding,
  origin: "prior-current-run-superseded",
  evidence: [
    "public/labs/crystal-violet-rate-law.json",
    "public/techniques/crystal-violet-kinetics.json",
    "public/techniques/crystal-violet-waste-treatment.json",
    "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json",
    contentLog,
  ],
  evaluationScope: "superseded-raw-template-row; current-compiled-static-routing",
  disposition: "resolved-by-current-compiled-static-routing",
  reason: finding.rule === "cycle06/photometer-wavelength-unproduced"
    ? "Current static compilation covers all 14 Crystal Violet host instances through both mandatory/refusal approval witnesses; the kinetics read consumes the configured wavelength identity supplied by the hosted calibration path, with 229 Crystal Violet compiled contexts and zero compiled-context findings. The prior raw row is resolved as a conservative routing/coverage false positive; runtime instrument production and scientific reading truth remain unverified."
    : "Current static compilation covers all 14 Crystal Violet host instances through both mandatory/refusal approval witnesses; the kinetics and waste actions preserve the authored cuvette/source-instance roles, with 229 Crystal Violet compiled contexts and zero compiled-context findings. The prior raw row is resolved as a conservative routing/coverage false positive; runtime slot behavior and physical handling remain unverified.",
  scenarioImpact: "The prior raw-template diagnosis no longer represents a current compiled-instance finding. This static disposition does not establish runtime, browser, physical, classroom, safety, or release acceptance.",
}));

const routed = (previousCurrent.rawCompositionFindingsRouted ?? []).map((finding) => ({
  ...finding,
  evidence: [contentCapture, contentLog],
  reason: "The current routing contract assigns this raw row to compiled-context evaluation; the final compiled diagnostic has zero compiled-context findings, so it is not retained as a current raw finding.",
}));
const currentProbeRecords = (composition.probes ?? []).map((probe) => ({
  id: probe.id,
  status: probe.status,
  evaluatedContextCount: probe.evaluatedContextCount,
  staticFindingCount: probe.staticFindingCount,
  boundary: probe.boundary,
}));

const existingIntegrityFindings = previousCurrent.compiledContextAssessment?.integrityFindings ?? [];
const oldIntegrityFindings = existingIntegrityFindings.length > 0
  ? existingIntegrityFindings
  : previousCurrent.compiledContextAssessment?.configurationCoverageResolution?.formerIntegrityFindings ?? [];
if (oldIntegrityFindings.length !== 38) throw new Error(`Expected 38 prior configuration coverage rows, found ${oldIntegrityFindings.length}.`);
const configurationKey = (detail) => {
  if (detail.startsWith("Configuration ")) return detail.split(" omits")[0];
  if (detail.startsWith("Declared variant ")) return detail.split(" has no exact")[0];
  if (detail.startsWith("Approval ")) return detail.split(" has declared")[0];
  return detail;
};
const resolutionByKey = new Map();
for (const status of fixedRoleConfigurations) {
  const key = status.detail.startsWith("Configuration ")
    ? status.detail.split(" is authored")[0]
    : status.detail.split(" is represented")[0];
  resolutionByKey.set(key, { ...status, resolution: "fixed-role-configuration" });
}
const currentNotApplicable = statuses.filter((status) =>
  status.status === "not-applicable" && status.detail?.includes("rate-law-analysis.teacher-approved"),
);
if (currentNotApplicable.length !== 1) throw new Error(`Expected one Crystal Violet not-applicable approval row, found ${currentNotApplicable.length}.`);
const formerConfigurationResolutions = oldIntegrityFindings.map((finding) => {
  const key = configurationKey(finding.detail);
  const fixed = resolutionByKey.get(key);
  if (fixed) {
    return {
      ...finding,
      disposition: "resolved-as-fixed-role-configuration",
      reason: fixed.detail,
      resolution: fixed,
    };
  }
  if (finding.rule === "compiled/unrepresented-configuration" && finding.detail.startsWith("Approval rate-law-analysis.teacher-approved")) {
    return {
      ...finding,
      disposition: "resolved-as-not-applicable-to-host-instance",
      reason: currentNotApplicable[0].detail,
      resolution: currentNotApplicable[0],
    };
  }
  throw new Error(`No current configuration resolution for ${finding.detail}`);
});
if (formerConfigurationResolutions.length !== 38 || formerConfigurationResolutions.filter((row) => row.disposition === "resolved-as-fixed-role-configuration").length !== 37) {
  throw new Error("Former configuration coverage did not reconcile to 37 fixed-role rows plus one not-applicable row.");
}

const configurationResolution = {
  formerIntegrityFindingCount: oldIntegrityFindings.length,
  resolvedFormerFindingCount: formerConfigurationResolutions.length,
  fixedRoleCount: fixedRoleConfigurations.length,
  notApplicableCount: 1,
  fixedRoleConfigurations,
  notApplicableConfigurations: currentNotApplicable,
  formerIntegrityFindings: formerConfigurationResolutions,
  coverageStatusCounts: Object.fromEntries(statuses.reduce((counts, status) => {
    const key = status.status ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map())),
};

triage.status = "current-final-static-reconciliation-with-explicit-source-residuals";
triage.currentRawDiagnostics = {
  status: "current-run-complete-with-supplemental-failures",
  runId: finalRunId,
  sourceCommit: "recorded in final CURRENT_VERIFICATION_RUN.json",
  sourceCommitAtRecordAuthoring: gitHead,
  sourceSnapshotPayloadSha256: "recorded in final CURRENT_VERIFICATION_RUN.json",
  contentCheck: {
    command: "node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/checkContentConsistency.mjs --compiled --json",
    exitCode: 1,
    stdoutPath: contentCapture,
    stdoutSha256: "recorded in final delivery receipt",
    stdoutBytes: null,
    recorderLog: contentLog,
    recorderLogSha256: "recorded in final CURRENT_VERIFICATION_RUN.json",
  },
  evaluationScope: "raw/template findings after conservative compiled-context routing and explicit source-trace group expansion",
  retainedFindingCount: residualCount,
  evaluatedSourceTraceFindingCount: transformedFindings.length,
  groupedContextFindingCount: groupedCount,
  unresolvedSourceTraceResidualCount: residualCount,
  byRule: { "action/source-trace-missing": residualCount },
  rawCompositionFindingsRouted: routed,
  findings: transformedFindings,
  resolvedPriorFindings: cvResolvedRows,
  compiledContextAssessment: {
    attemptedContextCount: coverage.attemptedContextCount,
    compiledContextCount: coverage.compiledContextCount,
    evaluatedNodeContextCount: coverage.evaluatedNodeContextCount,
    uniqueCompiledContextFindings: composition.findings?.counts?.uniqueCompiledContextFindings ?? 0,
    integrityFailureCount: 0,
    integrityFindings: [],
    coverageStatusCounts: coverage.byStatus ?? {},
    configurationCoverageResolution: configurationResolution,
    probes: currentProbeRecords,
  },
  documentation: {
    path: "docs/atomic-steps.md",
    upToDate: true,
  },
  finalEvidenceBoundary: "Source/static evidence only. Runtime, browser, physical, scientific, classroom, safety, performance and release acceptance remain unclaimed.",
};
writeJson(triagePath, triage);

const coveragePath = "docs/item2/CONFIGURATION_COVERAGE.json";
const configurationCoverage = readJson(coveragePath);
configurationCoverage.currentCompiledCoverage = {
  status: "current-final-static-diagnostic",
  runId: finalRunId,
  sourceCommit: "recorded in final CURRENT_VERIFICATION_RUN.json",
  attemptedWitnessCount: coverage.attemptedContextCount,
  compiledWitnessCount: coverage.compiledContextCount,
  evaluatedNodeContextCount: coverage.evaluatedNodeContextCount,
  compiledContextFindings: composition.findings?.counts?.uniqueCompiledContextFindings ?? 0,
  declaredConfigurationGaps: 38,
  unrepresentedConfigurations: 0,
  fixedRoleConfigurations: fixedRoleConfigurations.length,
  notApplicableConfigurationRows: 1,
  representativeContinuousConfigurations: coverage.representativeContinuousConfigurations?.length ?? 0,
  coverageStatusCounts: coverage.byStatus ?? {},
  probeStatuses: currentProbeRecords,
  formerGapResolution: configurationResolution,
  evidence: {
    compiledWitness: `${followupRoot}/evidence/f08-current-runs/${finalRunId}/predecessors/01-COMPILED_LAB_WITNESS.json`,
    contentCheckLog: contentLog,
    triage: triagePath,
  },
  limitations: [
    "The 30 compiled witnesses and 6,278 node contexts are static composition evidence, not runtime traversal or scientific acceptance.",
    "The 37 fixed-role rows are narrow authored host-role boundaries; generic fixtures and other hosts remain subject to ordinary coverage reporting.",
    "The 21 unresolved source-trace residuals remain outside provenance closure and are not converted into invented citations.",
  ],
};
configurationCoverage.historicalComparison = {
  ...(configurationCoverage.historicalComparison ?? {}),
  currentStatus: "superseded-by-current-final-static-diagnostic",
  supersededRun: "item2-f9c9229-run-b",
};
writeJson(coveragePath, configurationCoverage);

const catalogPath = "docs/item2/CATALOG_DISPOSITIONS.json";
const catalog = replaceText(readJson(catalogPath));
catalog.evidenceMode = "current source/static evidence recorded in the final item-2 run; 21 explicit source-trace residuals remain; runtime/scientific/browser/release acceptance not claimed";
catalog.status = {
  ...(catalog.status ?? {}),
  sourceInventoryAndStaticRationale: "complete",
  sourceLevelReconciliationClosure: "current-static-with-21-explicit-source-trace-residuals",
  currentEvidenceStatus: "current final static evidence recorded; runtime/scientific/browser/release acceptance not claimed",
  fullItem2Status: "complete-for-authorized-source-current-evidence-scope",
};
catalog.currentEvidence = {
  runId: finalRunId,
  sourceCommit: "recorded in final CURRENT_VERIFICATION_RUN.json",
  corePhases: "5/5 passed",
  supplementalPhases: {
    cycle12StaticVerifier: "passed",
    repositoryContentCheck: "exit 1; 21 explicit source-trace residuals",
  },
  recorderCheck: "exit 1; source current; integrity passed; core complete; supplemental-failures reports repository-content-check",
  contentCheck: {
    retainedFindings: residualCount,
    evaluatedSourceTraceFindings: transformedFindings.length,
    groupedSourceTraceMembers: groupedCount,
    unresolvedSourceTraceResiduals: residualCount,
    resolvedPriorCrystalVioletRows: cvResolvedRows.length,
    compiledContextFindings: composition.findings?.counts?.uniqueCompiledContextFindings ?? 0,
    formerConfigurationGapsResolved: formerConfigurationResolutions.length,
    fixedRoleConfigurations: fixedRoleConfigurations.length,
    notApplicableConfigurationRows: 1,
  },
  dispositionRecord: triagePath,
  finalEvidenceBoundary: "Source/static evidence only; runtime, scientific, browser, classroom, safety and release acceptance remain unclaimed.",
};
writeJson(catalogPath, catalog);

const scenarioAuditPath = "docs/item2/SCENARIO_AUDIT.json";
const scenarioAudit = readJson(scenarioAuditPath);
scenarioAudit.evidenceStatus = {
  runId: finalRunId,
  status: "static evidence current; scenario execution and runtime acceptance unrun",
  disposition: "not conflated with current content diagnostics",
};
writeJson(scenarioAuditPath, scenarioAudit);

const ledgerPath = "docs/item2/RUN_LEDGER.json";
const ledger = replaceText(readJson(ledgerPath));
ledger.performed = [
  ...(ledger.performed ?? []).filter((entry) => !["source-trace-group-reconciliation", "compiled-coverage-boundary-reconciliation", "item2-final-current-evidence"].includes(entry.kind)),
  {
    kind: "source-trace-group-reconciliation",
    detail: "Added 192 explicit contextual source-trace groups covering 882 exact owner-local action members; preserved 21 source-trace residuals with no invented citation.",
  },
  {
    kind: "compiled-coverage-boundary-reconciliation",
    detail: "Narrowed fixed-role/host-predicate handling to authored boundaries: 37 former configuration gaps resolve as fixed-role coverage and the Crystal Violet rate-law approval row is not applicable to that host instance.",
  },
  {
    kind: "item2-final-current-evidence",
    detail: `Final current-evidence run ${finalRunId} is the authoritative receipt for the frozen tracked tree; five core phases and two supplemental phases are recorded.`,
  },
];
ledger.evidencePipelineStatus = "complete-current-run-with-supplemental-failures";
ledger.currentEvidenceStatus = `Final current-evidence run ${finalRunId} is authoritative for the frozen tree: five core phases passed, two supplemental phases were recorded, repository-content-check remains nonzero only for 21 explicit source-trace residuals, and the source/static boundary is preserved.`;
ledger.sourceLevelClosureClaim = "current source/static reconciliation and evidence recorded; 21 explicit source-trace residuals remain; runtime/scientific/browser/release closure not claimed";
ledger.acceptedRun = {
  runId: finalRunId,
  sourceCommit: "recorded in final CURRENT_VERIFICATION_RUN.json",
  sourceSnapshotPayloadSha256: "recorded in final CURRENT_VERIFICATION_RUN.json",
  recorderCheck: "exit 1; source current; integrity passed; core complete; supplemental-failures reports repository-content-check",
  integrity: "passed",
  corePhases: "5/5 required",
  supplemental: {
    cycle12StaticVerifier: "passed",
    repositoryContentCheck: "nonzero exit retained and triaged: 21 unresolved source-trace residuals",
  },
};
ledger.currentDiagnosticSummary = {
  groupedSourceTraceMembers: groupedCount,
  unresolvedSourceTraceResiduals: residualCount,
  resolvedPriorCrystalVioletRows: cvResolvedRows.length,
  compiledWitnesses: coverage.compiledContextCount,
  evaluatedNodeContexts: coverage.evaluatedNodeContextCount,
  compiledContextFindings: composition.findings?.counts?.uniqueCompiledContextFindings ?? 0,
  formerConfigurationGapsResolved: formerConfigurationResolutions.length,
  fixedRoleConfigurations: fixedRoleConfigurations.length,
  notApplicableConfigurationRows: 1,
};
writeJson(ledgerPath, ledger);

const finalEvidenceSection = `## Final current evidence — ${finalRunId}

- Run ID: \`${finalRunId}\`; the final recorder receipt is under \`${runEvidenceRoot}/CURRENT_VERIFICATION_RUN.json\`.
- Core chain: **5/5 passed** — compiler witness, reconciliation, Cycle 09 overlay refresh/check, and reconciliation check.
- Recorder \`--check\`: **exit 1 is expected** because \`checkStatus=supplemental-failures\`; source is current, integrity passed, no core phase failed, and only repository-content-check is supplemental-failed.
- Supplemental phases: **2 recorded** — the Cycle 12 static verifier passed; repository-content-check exited 1 only for 21 explicit source-trace residuals.
- Source-trace reconciliation: **882 exact action members** are covered by 192 contextual groups; **21 residuals** remain (17 authored paper-drying operations and 4 teacher-configured inventory actions).
- Crystal Violet: the prior three raw rows are resolved by current compiled static routing across 14 host instances, both approval witnesses and 229 Crystal Violet compiled contexts; compiled-context findings are zero.
- Configuration coverage: the former 38 rows resolve as **37 fixed-role configurations plus 1 not-applicable approval row**; current unrepresented configuration count is zero.
- The complete content-check JSON and recorder logs are captured under the external delivery directory \`${contentCapture}\` and the run evidence directory above.

This is source/static evidence only. Runtime traversal, browser behavior, physical instrument response, scientific validity, classroom safety and release readiness remain unverified. No push, merge or deployment was performed.
`;

const reportPath = "docs/item2/ITEM2_REPORT.md";
let report = readFileSync(join(root, reportPath), "utf8");
report = report.replace(
  /- Fresh current evidence pipeline: .*\n/,
  `- Fresh current evidence pipeline: **${finalRunId}; five core phases passed; two supplemental phases recorded; content check retains 21 explicit source-trace residuals**\n`,
);
report = report.replace(/Run B static findings triaged/g, "final current static findings triaged");
report = report.replace(
  "The authorized item-2 evidence phase is now recorded in Run B. The remaining unrun checks are deliberately outside the repository validation policy and this scoped request.",
  "The authorized item-2 evidence phase is now recorded in the final current run. The remaining unrun checks are deliberately outside the repository validation policy and this scoped request.",
);
report = report.replace(
  "These changes improve static specification fidelity only. Item 2 remains incomplete pending repository-workspace restoration and separately authorized fresh evidence.",
  "At that earlier pre-evidence checkpoint, the scenario changes were source-only; the final current evidence section below supersedes its pending-evidence wording.",
);
const reportMarker = "## Fresh current evidence — Run B";
const existingFinalReportIndex = report.search(/^## Final current evidence — /m);
const reportBase = report.includes(reportMarker)
  ? report.slice(0, report.indexOf(reportMarker))
  : existingFinalReportIndex >= 0
    ? report.slice(0, existingFinalReportIndex)
    : report;
report = `${reportBase.trimEnd()}\n\n${finalEvidenceSection}`;
writeFileSync(join(root, reportPath), report, "utf8");

const criticalPath = "docs/item2/CRITICAL_REVIEW.md";
let critical = readFileSync(join(root, criticalPath), "utf8");
critical = critical.replace(/six core phases/g, "five core phases");
critical = critical.replace(/pending current evidence\./g, "current static evidence recorded; runtime/scientific/browser/release acceptance remains unclaimed.");
critical = critical.replace(/The current evidence phase is now complete[\s\S]*?release acceptance remain unclaimed\./, "The current evidence phase is complete for the authorized source/static scope. The final run records 882 grouped source-trace members, 21 explicit residuals, zero compiled-context findings, 37 fixed-role configuration resolutions and one not-applicable Crystal Violet approval row; runtime, scientific, browser, classroom, safety and release acceptance remain unclaimed.");
const criticalMarker = "## Current-evidence challenge";
const existingFinalCriticalIndex = critical.search(/^## Current-evidence challenge and final receipt — /m);
const criticalBase = critical.includes(criticalMarker) && !critical.includes("## Current-evidence challenge and final receipt")
  ? critical.slice(0, critical.indexOf(criticalMarker))
  : existingFinalCriticalIndex >= 0
    ? critical.slice(0, existingFinalCriticalIndex)
    : critical;
critical = `${criticalBase.trimEnd()}\n\n${finalEvidenceSection.replace("## Final current evidence", "## Current-evidence challenge and final receipt")}`;
writeFileSync(join(root, criticalPath), critical, "utf8");

const executionPath = "docs/item2/EXECUTION_REQUEST.md";
let execution = readFileSync(join(root, executionPath), "utf8");
execution = execution.replace(/six core/g, "five core");
const executionMarker = "## Current execution result";
const executionSection = `## Current execution result

- Discovery runs remain historical: Run A \`item2-597c060-run-a\`, Run B \`item2-f9c9229-run-b\`, and Run C \`item2-646169f-run-c\` are not used as the final identity for this repaired tree.
- Final run: \`${finalRunId}\`; source commit and source snapshot identity are recorded in its \`CURRENT_VERIFICATION_RUN.json\`.
- Core chain: **5/5 passed**; supplemental static verifier passed; repository-content-check exited 1 and retained only 21 explicit source-trace residuals.
- Complete current diagnostic: 882 grouped source-trace members, 21 residuals, three prior Crystal Violet rows resolved by compiled static routing, 30/30 compiled witnesses, 6,278 node contexts, zero compiled-context findings, and 37 fixed-role plus one not-applicable configuration resolutions.
- The final recorder receipt records the source/integrity result and exact command outcomes; the source/static boundary remains explicit and no runtime, scientific, browser, classroom, safety or release acceptance is claimed.
`;
execution = execution.includes(executionMarker)
  ? `${execution.slice(0, execution.indexOf(executionMarker))}${executionSection}`
  : `${execution.trimEnd()}\n\n${executionSection}`;
writeFileSync(join(root, executionPath), execution, "utf8");

const catalogMarkdownPath = "docs/item2/CATALOG_DISPOSITIONS.md";
let catalogMarkdown = readFileSync(join(root, catalogMarkdownPath), "utf8");
catalogMarkdown = catalogMarkdown.replace(/Run B static findings triaged/g, "final current static findings triaged");
catalogMarkdown = catalogMarkdown.replace(/Run B static evidence current/g, "final current static evidence");
const existingCatalogBoundaryIndex = catalogMarkdown.search(/^## Current evidence boundary$/m);
if (existingCatalogBoundaryIndex >= 0) catalogMarkdown = catalogMarkdown.slice(0, existingCatalogBoundaryIndex);
catalogMarkdown = `${catalogMarkdown.trimEnd()}\n\n## Current evidence boundary\n\nThe final run \`${finalRunId}\` records current source/static evidence. The raw provenance debt is partitioned into 882 contextual group members and 21 explicit residuals; runtime/scientific/browser/release acceptance is not claimed.\n`;
writeFileSync(join(root, catalogMarkdownPath), catalogMarkdown, "utf8");

const manifestPath = "docs/item2/CHANGED_FILE_MANIFEST.json";
const manifest = readJson(manifestPath);
const changedImplementationPaths = [
  "docs/architecture/source-trace-registry.json",
  "scripts/checkContentConsistency.mjs",
  "scripts/generateItem2SourceTraceGroups.mjs",
  "scripts/reconcileItem2CurrentRecords.mjs",
  "scripts/recordItem2FinalCommandSequence.mjs",
  "scripts/__tests__/f07SourceTraceRegistry.test.mjs",
  "src/data/compiledWitnessDiagnostics.ts",
  "src/data/__tests__/compiledWitnessDiagnostics.test.ts",
];
manifest.implementation = unique([
  ...(manifest.implementation ?? []).map((entry) => entry.path ?? entry),
  ...changedImplementationPaths,
]).sort().map((path) => ({
  path,
  blobSha: execFileSync(gitExecutable, ["hash-object", path], { cwd: root, encoding: "utf8" }).trim(),
}));
manifest.item2Records = (manifest.item2Records ?? []).map((entry) => ({
  ...entry,
  blobSha: execFileSync(gitExecutable, ["hash-object", entry.path], { cwd: root, encoding: "utf8" }).trim(),
}));
manifest.documentedHeadBeforeManifestUpdate = gitHead;
manifest.evidenceStatus = `${finalRunId} final current source/static evidence; no runtime/scientific/browser/release claim`;
manifest.currentEvidence = {
  runId: finalRunId,
  sourceCommit: "recorded in final CURRENT_VERIFICATION_RUN.json",
  corePhasesPassed: 5,
  supplementalPhasesRecorded: 2,
  contentCheckExitCode: 1,
  retainedFindings: residualCount,
  evaluatedSourceTraceFindings: transformedFindings.length,
  groupedSourceTraceMembers: groupedCount,
  unresolvedSourceTraceResiduals: residualCount,
  resolvedPriorCrystalVioletRows: cvResolvedRows.length,
  compiledContextFindings: composition.findings?.counts?.uniqueCompiledContextFindings ?? 0,
  formerConfigurationGapsResolved: formerConfigurationResolutions.length,
  triagePath: triagePath,
};
writeJson(manifestPath, manifest);

console.log(JSON.stringify({
  finalRunId,
  sourceCommitAtRecordAuthoring: gitHead,
  retainedFindings: residualCount,
  evaluatedSourceTraceFindings: transformedFindings.length,
  groupedSourceTraceMembers: groupedCount,
  unresolvedSourceTraceResiduals: residualCount,
  resolvedPriorCrystalVioletRows: cvResolvedRows.length,
  compiledWitnesses: coverage.compiledContextCount,
  evaluatedNodeContexts: coverage.evaluatedNodeContextCount,
  compiledContextFindings: composition.findings?.counts?.uniqueCompiledContextFindings ?? 0,
  formerConfigurationGapsResolved: formerConfigurationResolutions.length,
  fixedRoleConfigurations: fixedRoleConfigurations.length,
  notApplicableConfigurationRows: 1,
  checkerExitCode: checker.status,
}, null, 2));
