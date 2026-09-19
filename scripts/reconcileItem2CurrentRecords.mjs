import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPreparationMode } from "./item2EvidenceReadiness.mjs";

const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
assertPreparationMode(process.argv);
const finalRunId = process.argv.includes("--run-id")
  ? process.argv[process.argv.indexOf("--run-id") + 1]
  : "item2-luna-final-20260918";
if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(finalRunId)) {
  throw new Error(`Unsafe final run id: ${finalRunId}`);
}

const followupRoot = "planning/2026-09-08_catalog-fidelity-follow-up";
const runEvidenceRoot = `${followupRoot}/evidence/f08-current-runs/${finalRunId}`;
const contentLog = `${runEvidenceRoot}/logs/repository-content-check.log`;
const externalDeliveryRoot = `../delivery/${finalRunId}`;
const finalSummaryPath = `${externalDeliveryRoot}/FINAL_SUMMARY.json`;
const finalSummaryRef = (pointer) => `${finalSummaryPath}#/${pointer}`;
const contentCapture = `${externalDeliveryRoot}/content-check-compiled.json`;
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => writeFileSync(
  join(root, relativePath),
  `${JSON.stringify(value, null, 2)}\n`,
  "utf8",
);
const unique = (values) => [...new Set(values)];
const isAffirmativeReviewedMapping = (group) => {
  const mapping = group?.reviewedMapping;
  return [
    "reviewed-static-source-mapping",
    "reviewed-authored-simulator-boundary",
  ].includes(mapping?.reviewStatus) && String(mapping?.decisionDisposition ?? "").startsWith("reviewed-");
};
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
const unresolvedReviewViolationCount = violationByRule["source-trace/group-review-unresolved"] ?? 0;
const composition = diagnostic.compositionDiagnostics?.result ?? {};
const coverage = composition.coverage ?? {};
const statuses = composition.statuses ?? [];
const fixedRoleConfigurations = coverage.fixedRoleConfigurations ?? [];
const allowedContentRules = new Set(["action/source-trace-missing", "source-trace/group-review-unresolved"]);
if (violationTotal === 0 || Object.keys(violationByRule).some((rule) => !allowedContentRules.has(rule))) {
  throw new Error(`Unexpected current content diagnostic result: ${JSON.stringify({ violationTotal, violationByRule })}`);
}
if (coverage.unrepresentedConfigurations?.length !== 0 || fixedRoleConfigurations.length === 0) {
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
  "scripts/generatorInputs/item2SourceTraceMappings.mjs",
  contentLog,
];
const sourceTraceResidual = (ownerId, actionId, atomId) => {
  if (atomId === "atom.observe.dry-developed-chromatography-paper") {
    return {
      category: "authored-qualitative-chromatography-preparation-without-source-example",
      missingEvidence: "An external source locator or an approved physical drying method, duration, temperature and ventilation contract.",
      evidence: [
        "public/techniques/paper-chromatography.json",
        "scripts/generatorInputs/simulator/paperChromatography.mjs",
        "src/runtime/reducer.ts",
        "src/runtime/__tests__/runtime.test.ts",
        "src/domain/__tests__/bundledCatalogPolicy.test.ts",
      ],
      reason: `The authored drying action ${ownerId}/${actionId} has no direct registry row and atom ${atomId} has no source examples. The current simulator contract is qualitative: it requires the matching developed paper and a marked solvent front, then changes the paper to dry; it does not model a physical drying method, duration, temperature or ventilation. Preserve that explicit limit and do not invent a source locator or laboratory SOP.`,
    };
  }
  const inventoryEvidence = [
    "docs/stock-supply-volumes.md",
    "scripts/generatorInputs/stockSupplyVolumes.mjs",
    `public/techniques/${ownerId}.json`,
    "src/domain/atomRegistry.json",
  ];
  const isBlueInventory = ownerId === "blue1-percent-transmittance";
  return {
    category: "teacher-configured-operational-inventory-without-source-example",
    missingEvidence: "A source protocol locator for the exact starting-stock choice, if the setup quantity is later intended to be presented as source-prescribed rather than simulator configuration.",
    evidence: inventoryEvidence,
    reason: isBlueInventory
      ? `The authored inventory action ${ownerId}/${actionId} has no direct registry row and atom ${atomId} has no source example. The current source/static contract records 1,000 mL each for the Blue #1 unknown sample and dilution water as finite operational setup inventory; it keeps that quantity separate from learner-measured aliquots, concentrations and analytical results.`
      : `The authored inventory action ${ownerId}/${actionId} has no direct registry row and atom ${atomId} has no source example. The current source/static contract records 5 mL each for assigned brass salt A/B tubes to support two 1 mL conditioning portions and a 3 mL cuvette fill, with return after the scan; this is operational starting inventory, not a new analytical or source-protocol measurement.`,
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
    if (!isAffirmativeReviewedMapping(group)) {
      const review = group.reviewedMapping ?? {};
      base.detail = `The exact action is present in contextual source-trace group ${group.id}, but its owner/atom/source review is unresolved.`;
      base.scenarioImpact = `The current source registry keeps ${ownerId}/${actionId} visible as unresolved source review (${review.reviewStatus ?? "missing status"}); no affirmative contextual transfer or closure is recorded.`;
      base.disposition = "source-trace-unresolved-review";
      base.reason = `Group ${group.id} has reviewStatus=${review.reviewStatus ?? "absent"} and decisionDisposition=${review.decisionDisposition ?? "absent"}. Resolve the exact owner/atom/source mapping before treating this action as contextual provenance; do not copy source quantities, identity, configuration or acceptance criteria.`;
      base.sourceTraceReview = {
        id: group.id,
        owner: `${group.ownerType}:${group.ownerId}`,
        actionId,
        memberCount: group.actionIds.length,
        atomId: group.atomId,
        sourceFile: group.sourceFile,
        sourceTable: group.sourceTable,
        step: group.step,
        basis: group.basis,
        reviewStatus: review.reviewStatus ?? null,
        decisionDisposition: review.decisionDisposition ?? null,
      };
      delete base.sourceTraceGroup;
      delete base.sourceTraceResidual;
      return base;
    }
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
  base.scenarioImpact = `The action remains a visible source-provenance residual, but the current authored contract supplies a bounded nonblocking disposition: ${residual.category}. The current compiled witness produced zero compiled-context findings. This does not establish runtime, scientific, or learner-facing acceptance.`;
  base.disposition = "source-trace-residual-justified-nonblocking";
  base.reason = `${residual.reason} Required next evidence if the boundary is expanded: ${residual.missingEvidence} No source citation is invented, and no runtime/scientific/release acceptance is claimed.`;
  base.evidence = [...new Set([...(base.evidence ?? []), ...(residual.evidence ?? [])])];
  base.sourceTraceResidual = {
    owner: `${ownerType}:${ownerId}`,
    actionId,
    atomId,
    category: residual.category,
    missingEvidence: residual.missingEvidence,
    disposition: base.disposition,
    evidence: residual.evidence ?? [],
  };
  delete base.sourceTraceGroup;
  return base;
});

const groupedCount = transformedFindings.filter((finding) => finding.sourceTraceGroup).length;
const unresolvedReviewCount = transformedFindings.filter((finding) => finding.sourceTraceReview).length;
const residualCount = transformedFindings.filter((finding) => finding.sourceTraceResidual).length;
if (
  groupedCount + unresolvedReviewCount + residualCount !== previousActionFindings.length
  || (violationByRule["action/source-trace-missing"] ?? 0) !== residualCount
  || (unresolvedReviewViolationCount > 0 && unresolvedReviewCount === 0)
) {
  throw new Error(`Unexpected source-trace reconciliation counts: ${JSON.stringify({ groupedCount, unresolvedReviewCount, residualCount, violationByRule })}`);
}
const residualCategoryCounts = Object.fromEntries(transformedFindings
  .filter((finding) => finding.sourceTraceResidual)
  .reduce((counts, finding) => {
    const category = finding.sourceTraceResidual.category;
    counts.set(category, (counts.get(category) ?? 0) + 1);
    return counts;
  }, new Map()));
const paperDryingResidualCount = residualCategoryCounts["authored-qualitative-chromatography-preparation-without-source-example"] ?? 0;
const inventoryResidualCount = residualCategoryCounts["teacher-configured-operational-inventory-without-source-example"] ?? 0;
const compiledContextFindingCount = composition.findings?.counts?.uniqueCompiledContextFindings ?? 0;
const compiledWitnessCount = coverage.attemptedContextCount ?? 0;
const evaluatedNodeContextCount = coverage.evaluatedNodeContextCount ?? 0;
const sourceTraceReviewSummary = Object.fromEntries((registry.traceGroups ?? []).reduce((counts, group) => {
  const status = group.reviewedMapping?.reviewStatus ?? "missing-review-status";
  const entry = counts.get(status) ?? { groups: 0, members: 0 };
  entry.groups += 1;
  entry.members += group.actionIds?.length ?? 0;
  counts.set(status, entry);
  return counts;
}, new Map()));
const unreviewedSourceTraceGroups = (registry.traceGroups ?? []).filter((group) => !isAffirmativeReviewedMapping(group));
const unreviewedSourceTraceGroupCount = unreviewedSourceTraceGroups.length;
const sourceReviewIncomplete = unresolvedReviewCount > 0 || unreviewedSourceTraceGroupCount > 0;
const preparationStatus = sourceReviewIncomplete
  ? "prepared-with-unresolved-source-review"
  : "prepared-pending-final-run";
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
if (oldIntegrityFindings.length === 0) throw new Error("Expected prior configuration coverage rows for current reconciliation.");
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
if (currentNotApplicable.length === 0) throw new Error("Expected a current Crystal Violet not-applicable approval row.");
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
if (
  formerConfigurationResolutions.length !== oldIntegrityFindings.length
  || formerConfigurationResolutions.filter((row) => row.disposition === "resolved-as-fixed-role-configuration").length !== fixedRoleConfigurations.length
  || formerConfigurationResolutions.filter((row) => row.disposition === "resolved-as-not-applicable-to-host-instance").length !== currentNotApplicable.length
) {
  throw new Error(`Former configuration coverage did not reconcile to current fixed-role and not-applicable rows: ${JSON.stringify({
    former: formerConfigurationResolutions.length,
    fixed: fixedRoleConfigurations.length,
    notApplicable: currentNotApplicable.length,
  })}`);
}

const configurationResolution = {
  formerIntegrityFindingCount: oldIntegrityFindings.length,
  resolvedFormerFindingCount: formerConfigurationResolutions.length,
  fixedRoleCount: fixedRoleConfigurations.length,
  notApplicableCount: currentNotApplicable.length,
  fixedRoleConfigurations,
  notApplicableConfigurations: currentNotApplicable,
  formerIntegrityFindings: formerConfigurationResolutions,
  coverageStatusCounts: Object.fromEntries(statuses.reduce((counts, status) => {
    const key = status.status ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map())),
};

triage.status = preparationStatus;
triage.currentRawDiagnostics = {
  status: preparationStatus,
  verificationStatus: "pending-final-run",
  runId: finalRunId,
  finalSummaryPath,
  sourceCommit: finalSummaryRef("sourceFreeze/commit"),
  sourceCommitAtRecordAuthoring: gitHead,
  sourceSnapshotPayloadSha256: null,
  contentCheck: {
    command: "node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/checkContentConsistency.mjs --compiled --json",
    phase: "pre-final-run-static-preflight",
    exitCode: checker.status,
    stdoutPath: contentCapture,
    stdoutSha256: null,
    stdoutBytes: null,
    recorderLog: contentLog,
    recorderLogBytes: null,
    recorderLogSha256: null,
  },
  evaluationScope: "raw/template findings after conservative compiled-context routing and explicit source-trace group expansion",
  retainedFindingCount: residualCount,
  evaluatedSourceTraceFindingCount: transformedFindings.length,
  groupedContextFindingCount: groupedCount,
  unresolvedSourceTraceReviewCount: unresolvedReviewCount,
  unreviewedSourceTraceGroupCount,
  sourceReviewIncomplete,
  unresolvedSourceTraceResidualCount: residualCount,
  justifiedNonblockingSourceTraceResidualCount: residualCount,
  sourceTraceReviewSummary,
  residualCategoryCounts,
  byRule: violationByRule,
  rawCompositionFindingsRouted: routed,
  findings: transformedFindings,
  resolvedPriorFindings: cvResolvedRows,
  compiledContextAssessment: {
    attemptedContextCount: coverage.attemptedContextCount,
    compiledContextCount: compiledWitnessCount,
    evaluatedNodeContextCount: coverage.evaluatedNodeContextCount,
    uniqueCompiledContextFindings: composition.findings?.counts?.uniqueCompiledContextFindings ?? 0,
    integrityFailureCount: null,
    integrityFindings: [],
    coverageStatusCounts: coverage.byStatus ?? {},
    configurationCoverageResolution: configurationResolution,
    probes: currentProbeRecords,
  },
  documentation: {
    path: "docs/atomic-steps.md",
    upToDate: true,
  },
  finalEvidenceBoundary: "Prepared source/static reconciliation only. The new final recorder/current/integrity/core result is pending; runtime, browser, physical, scientific, classroom, safety, performance and release acceptance remain unclaimed.",
};
writeJson(triagePath, triage);

const coveragePath = "docs/item2/CONFIGURATION_COVERAGE.json";
const configurationCoverage = readJson(coveragePath);
configurationCoverage.currentCompiledCoverage = {
  status: "pre-final-run-static-preflight",
  runId: finalRunId,
  finalSummaryPath,
  sourceCommit: finalSummaryRef("sourceFreeze/commit"),
  attemptedWitnessCount: coverage.attemptedContextCount,
  compiledWitnessCount,
  evaluatedNodeContextCount: coverage.evaluatedNodeContextCount,
  compiledContextFindings: compiledContextFindingCount,
  declaredConfigurationGaps: oldIntegrityFindings.length,
  unrepresentedConfigurations: 0,
  fixedRoleConfigurations: fixedRoleConfigurations.length,
  notApplicableConfigurationRows: currentNotApplicable.length,
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
    `${compiledWitnessCount} compiled witnesses and ${evaluatedNodeContextCount} node contexts are static composition evidence, not runtime traversal or scientific acceptance.`,
    `The ${fixedRoleConfigurations.length} fixed-role rows are narrow authored host-role boundaries; generic fixtures and other hosts remain subject to ordinary coverage reporting.`,
    `The ${residualCount} source-trace residuals remain visible and are dispositioned as justified nonblocking boundaries; they are not converted into invented citations.`,
  ],
};
configurationCoverage.historicalComparison = {
  ...(configurationCoverage.historicalComparison ?? {}),
  currentStatus: "superseded-by-pre-final-run-static-preflight",
  supersededRun: "item2-f9c9229-run-b",
};
writeJson(coveragePath, configurationCoverage);

const catalogPath = "docs/item2/CATALOG_DISPOSITIONS.json";
const catalog = replaceText(readJson(catalogPath));
catalog.evidenceMode = `source/static reconciliation prepared for final run ${finalRunId}; current recorder, source-integrity and core-completion results are pending; ${residualCount} explicit source-trace residuals remain with justified nonblocking dispositions; runtime/scientific/browser/release acceptance not claimed`;
catalog.status = {
  ...(catalog.status ?? {}),
  sourceInventoryAndStaticRationale: sourceReviewIncomplete ? "incomplete-unresolved-source-review" : "prepared",
  sourceLevelReconciliationClosure: sourceReviewIncomplete
    ? `incomplete-with-${unreviewedSourceTraceGroupCount || unresolvedReviewCount}-unresolved-source-review-groups`
    : "prepared-pending-final-run",
  currentEvidenceStatus: sourceReviewIncomplete
    ? "unresolved source-trace review prevents current closure; final run not accepted"
    : "final recorder/current/integrity/core result pending; no current acceptance claim",
  fullItem2Status: sourceReviewIncomplete
    ? "incomplete-unresolved-source-review"
    : "incomplete-pending-final-run",
};
catalog.currentEvidence = {
  runId: finalRunId,
  finalSummaryPath,
  sourceCommit: finalSummaryRef("sourceFreeze/commit"),
  status: sourceReviewIncomplete ? "incomplete-unresolved-source-review" : "pending-final-run",
  corePhases: "pending",
  supplementalPhases: {
    cycle12StaticVerifier: "pending",
    repositoryContentCheck: "pending-final-run; pre-final static preflight is not a supplemental run result",
  },
  recorderCheck: "pending-final-run; do not infer recorder verdict from the content-check exit",
  contentCheck: {
    retainedFindings: residualCount,
    evaluatedSourceTraceFindings: transformedFindings.length,
    groupedSourceTraceMembers: groupedCount,
    unresolvedSourceTraceResiduals: residualCount,
    unresolvedSourceTraceReviewCount: unresolvedReviewCount,
    unreviewedSourceTraceGroupCount,
    justifiedNonblockingSourceTraceResiduals: residualCount,
    resolvedPriorCrystalVioletRows: cvResolvedRows.length,
    compiledContextFindings: compiledContextFindingCount,
    formerConfigurationGapsResolved: formerConfigurationResolutions.length,
    fixedRoleConfigurations: fixedRoleConfigurations.length,
    notApplicableConfigurationRows: currentNotApplicable.length,
  },
  dispositionRecord: triagePath,
  finalEvidenceBoundary: "Prepared source/static reconciliation only; the new final recorder/current/integrity/core result is pending. Runtime, scientific, browser, classroom, safety and release acceptance remain unclaimed.",
};
writeJson(catalogPath, catalog);

const scenarioAuditPath = "docs/item2/SCENARIO_AUDIT.json";
const scenarioAudit = readJson(scenarioAuditPath);
scenarioAudit.evidenceStatus = {
  runId: finalRunId,
  status: sourceReviewIncomplete
    ? "unresolved source-trace review prevents current closure; scenario execution and runtime acceptance unrun"
    : "static preparation recorded; final recorder/current result pending; scenario execution and runtime acceptance unrun",
  disposition: "not conflated with current content diagnostics",
};
writeJson(scenarioAuditPath, scenarioAudit);

const ledgerPath = "docs/item2/RUN_LEDGER.json";
const ledger = replaceText(readJson(ledgerPath));
ledger.performed = [
  ...(ledger.performed ?? []).filter((entry) => !["source-trace-group-reconciliation", "compiled-coverage-boundary-reconciliation", "item2-final-current-evidence", "item2-final-evidence-preparation"].includes(entry.kind)),
  {
    kind: "source-trace-group-reconciliation",
    detail: `Added ${traceGroupsByAction.size ? registry.traceGroups.length : 0} explicit contextual source-trace groups covering ${groupedCount} exact owner-local action members; preserved ${residualCount} source-trace residuals with justified nonblocking dispositions and no invented citation.`,
  },
  {
    kind: "compiled-coverage-boundary-reconciliation",
    detail: `Narrowed fixed-role/host-predicate handling to authored boundaries: ${fixedRoleConfigurations.length} former configuration gaps resolve as fixed-role coverage and ${currentNotApplicable.length} Crystal Violet rate-law approval row(s) are not applicable to the host instance.`,
  },
  {
    kind: "item2-final-evidence-preparation",
    detail: `Source/static records are prepared for final-evidence run ${finalRunId}; recorder, source-integrity and core-completion results are pending and no acceptance is claimed.`,
  },
];
ledger.evidencePipelineStatus = sourceReviewIncomplete
  ? "incomplete-unresolved-source-review"
  : "prepared-pending-final-run";
ledger.currentEvidenceStatus = sourceReviewIncomplete
  ? `Run ${finalRunId} is not accepted because source-trace review is unresolved; no current closure is claimed.`
  : `Final current-evidence run ${finalRunId} is prepared but not yet observed; recorder/current/integrity/core results are pending.`;
ledger.sourceLevelClosureClaim = sourceReviewIncomplete
  ? "source-level closure is incomplete until every contextual source group/action has an affirmative reviewed mapping"
  : `source/static reconciliation prepared with ${residualCount} explicit residuals; final recorder/current/integrity/core result pending; runtime/scientific/browser/release closure not claimed`;
delete ledger.acceptedRun;
ledger.pendingRun = {
  runId: finalRunId,
  finalSummaryPath,
  sourceCommit: finalSummaryRef("sourceFreeze/commit"),
  recorderCheck: "pending-final-run; not inferred from content-check exit",
  sourceReviewStatus: sourceReviewIncomplete ? "unresolved-source-review" : "reviewed",
};
ledger.currentDiagnosticSummary = {
  groupedSourceTraceMembers: groupedCount,
  unresolvedSourceTraceResiduals: residualCount,
  unresolvedSourceTraceReviewCount: unresolvedReviewCount,
  unreviewedSourceTraceGroupCount,
  sourceReviewIncomplete,
  resolvedPriorCrystalVioletRows: cvResolvedRows.length,
  compiledWitnesses: compiledWitnessCount,
  evaluatedNodeContexts: evaluatedNodeContextCount,
  compiledContextFindings: compiledContextFindingCount,
  formerConfigurationGapsResolved: formerConfigurationResolutions.length,
  fixedRoleConfigurations: fixedRoleConfigurations.length,
  notApplicableConfigurationRows: currentNotApplicable.length,
};
writeJson(ledgerPath, ledger);

const finalEvidenceSection = `## Pending final evidence — ${finalRunId}

- Run ID: \`${finalRunId}\` is prepared for the new final sequence; the future recorder receipt is expected under \`${runEvidenceRoot}/CURRENT_VERIFICATION_RUN.json\`, with the future summary at \`${finalSummaryPath}\`.
- Current source/static preparation covers **${groupedCount} exact action members** in **${registry.traceGroups.length} reviewed contextual groups** and retains **${residualCount} explicit residuals** (${paperDryingResidualCount} authored paper-drying operations and ${inventoryResidualCount} teacher-configured inventory actions).
- The final recorder/current/source-integrity/core result is **pending**. It must be read from the structured recorder result; it is not inferred from the content-check exit.
- The tracked input tree must remain unchanged after the source-freeze manifest commit; only permitted generated evidence artifacts may be added after the final run.

This is preparation evidence only. It does not claim a current run, source integrity, core completion, runtime behavior, scientific validity, classroom safety or release readiness.
`;

const reportPath = "docs/item2/ITEM2_REPORT.md";
let report = readFileSync(join(root, reportPath), "utf8");
report = report.replace(
  /- (?:Fresh current evidence pipeline|Prepared final evidence pipeline): .*\n/,
  `- Prepared final evidence pipeline: **${finalRunId}; recorder/current/source-integrity/core result pending; source/static preflight retains ${residualCount} justified nonblocking source-trace residuals**\n`,
);
report = report.replace(/Run B static findings triaged/g, "current static findings prepared");
report = report.replace(
  /- Source-level reconciliation closure: .*\n/,
  "- Source-level reconciliation closure: **source/static preparation recorded; final recorder/current/source-integrity/core result pending; runtime/scientific/release closure not claimed**\n",
);
report = report.replace(
  /- Full Item 2: .*\n/,
  "- Full Item 2: **incomplete pending the final recorder/current/source-integrity/core result, with explicit static limitations**\n",
);
report = report.replace(
  "The authorized item-2 evidence phase is now recorded in the final current run. The remaining unrun checks are deliberately outside the repository validation policy and this scoped request.",
  "The authorized item-2 evidence phase is prepared but not yet observed. The remaining unrun checks are deliberately outside the repository validation policy and this scoped request.",
);
report = report.replace(
  "At that earlier pre-evidence checkpoint, the scenario changes were source-only; the final current evidence section below supersedes its pending-evidence wording.",
  "That earlier source-only checkpoint remains historical; the preparation section below does not claim final recorder/current/source-integrity/core acceptance.",
);
const reportMarker = "## Fresh current evidence — Run B";
const existingFinalReportIndex = report.search(/^## Final current evidence — /m);
const existingPreparationIndex = report.search(/^## (?:Pending final evidence|Current-evidence preparation) — /m);
const reportCutIndex = [
  report.indexOf(reportMarker),
  existingFinalReportIndex,
  existingPreparationIndex,
].filter((index) => index >= 0).sort((left, right) => left - right)[0];
const reportBase = reportCutIndex === undefined ? report : report.slice(0, reportCutIndex);
report = `${reportBase.trimEnd()}\n\n${finalEvidenceSection}`;
writeFileSync(join(root, reportPath), report, "utf8");

const criticalPath = "docs/item2/CRITICAL_REVIEW.md";
let critical = readFileSync(join(root, criticalPath), "utf8");
critical = critical.replace(/six core phases/g, "five core phases");
critical = critical.replace(
  "The narrower claim is inventory/static-rationale accounting, current static evidence recorded; runtime/scientific/browser/release acceptance remains unclaimed.",
  "The narrower claim is inventory/static-rationale accounting; final recorder/current/source-integrity/core evidence remains pending; runtime/scientific/browser/release acceptance remains unclaimed.",
);
critical = critical.replace(
  /The current evidence phase is complete for the authorized source\/static scope\.[^\n]*/,
  "The current evidence phase is prepared for the authorized source/static scope; final recorder/current/source-integrity/core acceptance remains pending, and runtime, scientific, browser, classroom, safety and release acceptance remain unclaimed.",
);
const criticalMarker = "## Current-evidence challenge";
const existingFinalCriticalIndex = critical.search(/^## Current-evidence challenge and final receipt — /m);
const existingPreparationCriticalIndex = critical.search(/^## (?:Pending final evidence|Current-evidence preparation) — /m);
const criticalCutIndex = [
  critical.includes(criticalMarker) && !critical.includes("## Current-evidence challenge and final receipt") ? critical.indexOf(criticalMarker) : -1,
  existingFinalCriticalIndex,
  existingPreparationCriticalIndex,
].filter((index) => index >= 0).sort((left, right) => left - right)[0];
const criticalBase = criticalCutIndex === undefined ? critical : critical.slice(0, criticalCutIndex);
critical = `${criticalBase.trimEnd()}\n\n${finalEvidenceSection.replace("## Pending final evidence", "## Current-evidence preparation")}`;
writeFileSync(join(root, criticalPath), critical, "utf8");

const executionPath = "docs/item2/EXECUTION_REQUEST.md";
let execution = readFileSync(join(root, executionPath), "utf8");
execution = execution.replace(/six core/g, "five core");
execution = execution.replace(
  /^Item 2 is \*\*complete[^\n]*/m,
  "Item 2 is **prepared pending the final recorder/current/source-integrity/core result with explicit static limitations**. Catalog/source/configuration records were corrected, the 46 historical dependencies were restored into the isolated checkout with 46/46 SHA-256 matches, and no final acceptance is claimed before the new sequence.",
);
const executionMarker = "## Current execution result";
const executionSection = `## Current execution preparation

- Discovery runs remain historical: Run A \`item2-597c060-run-a\`, Run B \`item2-f9c9229-run-b\`, and Run C \`item2-646169f-run-c\` are not used as the final identity for this repaired tree.
- Prepared final run: \`${finalRunId}\`; the source commit and source snapshot identity will be recorded only after the new sequence completes.
- Source/static preflight: ${groupedCount} grouped source-trace members, ${residualCount} explicit residuals, three prior Crystal Violet rows routed through compiled static coverage, ${compiledWitnessCount} compiled witnesses, ${evaluatedNodeContextCount} node contexts, ${compiledContextFindingCount} compiled-context findings, and ${fixedRoleConfigurations.length} fixed-role plus ${currentNotApplicable.length} not-applicable configuration resolutions.
- Recorder/current/source-integrity/core result: **pending**. The content-check exit is not a recorder verdict.

No runtime, scientific, browser, classroom, safety or release acceptance is claimed by this preparation record.
`;
const existingExecutionPreparationIndex = execution.search(/^## Current execution preparation$/m);
const existingExecutionResultIndex = execution.indexOf(executionMarker);
const executionCutIndex = [existingExecutionPreparationIndex, existingExecutionResultIndex]
  .filter((index) => index >= 0)
  .sort((left, right) => left - right)[0];
execution = executionCutIndex === undefined
  ? `${execution.trimEnd()}\n\n${executionSection}`
  : `${execution.slice(0, executionCutIndex)}${executionSection}`;
writeFileSync(join(root, executionPath), execution, "utf8");

const catalogMarkdownPath = "docs/item2/CATALOG_DISPOSITIONS.md";
let catalogMarkdown = readFileSync(join(root, catalogMarkdownPath), "utf8");
catalogMarkdown = catalogMarkdown.replace(/Run B static findings triaged/g, "current static findings prepared");
catalogMarkdown = catalogMarkdown.replace(/Run B static evidence current/g, "pre-final-run static evidence prepared");
const existingCatalogBoundaryIndex = catalogMarkdown.search(/^## Current evidence boundary$/m);
if (existingCatalogBoundaryIndex >= 0) catalogMarkdown = catalogMarkdown.slice(0, existingCatalogBoundaryIndex);
catalogMarkdown = `${catalogMarkdown.trimEnd()}\n\n## Current evidence boundary\n\nThe final run \`${finalRunId}\` is prepared but not yet observed. Source/static preflight partitions ${groupedCount} contextual group members and ${residualCount} explicit residuals with justified nonblocking dispositions; recorder/current/source-integrity/core results are pending, and runtime/scientific/browser/release acceptance is not claimed.\n`;
writeFileSync(join(root, catalogMarkdownPath), catalogMarkdown, "utf8");

// The manifest is deliberately refreshed from a committed source tree by
// scripts/refreshItem2Manifest.mjs after this preparation commit. This writer never
// records final-run blobs or observed recorder outcomes.

console.log(JSON.stringify({
  finalRunId,
  preparation: true,
  evidenceStatus: preparationStatus,
  sourceCommitAtRecordAuthoring: gitHead,
  retainedFindings: residualCount,
  evaluatedSourceTraceFindings: transformedFindings.length,
  groupedSourceTraceMembers: groupedCount,
  unresolvedSourceTraceResiduals: residualCount,
  resolvedPriorCrystalVioletRows: cvResolvedRows.length,
  compiledWitnesses: compiledWitnessCount,
  evaluatedNodeContexts: evaluatedNodeContextCount,
  compiledContextFindings: compiledContextFindingCount,
  formerConfigurationGapsResolved: formerConfigurationResolutions.length,
  fixedRoleConfigurations: fixedRoleConfigurations.length,
  notApplicableConfigurationRows: currentNotApplicable.length,
  checkerExitCode: checker.status,
}, null, 2));
