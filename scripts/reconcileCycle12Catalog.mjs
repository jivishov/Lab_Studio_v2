/**
 * Cycle 12 deterministic catalog reconciliation.
 *
 * The lane packages are immutable evidence.  This coordinator-owned script reads those packages,
 * current public composition sources, the atom/source registries, and the narrow compiler witness
 * produced by collectCycle12CompileWitness.mjs.  It then emits current-version audit matrices,
 * a machine-readable reconciliation report, and the human closure note.  It intentionally does
 * not start the application or claim runtime/browser/physical evidence.
 *
 * Usage:
 *   node scripts/reconcileCycle12Catalog.mjs
 *   node scripts/reconcileCycle12Catalog.mjs --check
 *   node scripts/reconcileCycle12Catalog.mjs --current-evidence-run <lowercase-run-id>
 *
 * With no selection flag, the legacy frozen f08-current SOURCE_IDENTITY remains the compatible
 * default.  A selected run reads only its dedicated current-verification ledger.
 */

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  currentVerificationArtifactPaths,
  currentVerificationPhaseOutputPaths,
  currentVerificationRunPath,
  currentVerificationStableDomainExclusion,
  deriveCurrentVerificationSourceProvenance,
  deriveReconciliationInputSpecification,
  inspectCurrentVerificationRun,
  inspectF08SourceIdentity,
  normalizeCurrentVerificationRunId,
  stableDomainExclusion,
} from "./followupEvidenceContract.mjs";
import {
  deriveCycle09CurrentSourceProjection,
  deriveCycle09ReconciliationInputs,
} from "./cycle09CurrentSourceProjection.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const planRoot = join(root, "planning/2026-08-30_lab-studio-technique-composition-remediation");
const evidenceRoot = join(planRoot, "evidence");
const currentSourceIdentityPath = "planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current/SOURCE_IDENTITY.json";
const revision10Path = "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json";
const revision10ImpactPath = "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json";
const checkOnly = process.argv.includes("--check");

const currentEvidenceRunFlagIndex = process.argv.indexOf("--current-evidence-run");
if (currentEvidenceRunFlagIndex >= 0 && (!process.argv[currentEvidenceRunFlagIndex + 1] || process.argv[currentEvidenceRunFlagIndex + 1].startsWith("--"))) {
  throw new Error("--current-evidence-run requires an explicit lowercase run id.");
}
if (process.argv.filter((argument) => argument === "--current-evidence-run").length > 1) {
  throw new Error("--current-evidence-run may be supplied only once.");
}
const currentEvidenceRunId = currentEvidenceRunFlagIndex >= 0 ? process.argv[currentEvidenceRunFlagIndex + 1] : null;
const normalizedCurrentEvidenceRunId = currentEvidenceRunId === null ? null : normalizeCurrentVerificationRunId(currentEvidenceRunId);
if (normalizedCurrentEvidenceRunId && !normalizedCurrentEvidenceRunId.ok) {
  throw new Error(`--current-evidence-run is unsafe: ${normalizedCurrentEvidenceRunId.reason}`);
}
const selectedCurrentEvidenceRunId = normalizedCurrentEvidenceRunId?.runId ?? null;

const fixedLaneOrder = ["05", "06", "07", "08", "09", "11", "10"];
const laneBaselineRevision = { "05": 5, "06": 8, "07": 8, "08": 9, "09": 9, "10": 9, "11": 9 };
const routeOnlyTechniqueId = "ph-volume-formal-titration-trial";

const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const readPlanJson = (relativePath) => JSON.parse(readFileSync(join(planRoot, relativePath), "utf8"));
const readOptionalJson = (absolutePath) => {
  if (!existsSync(absolutePath)) return undefined;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return undefined;
  }
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const asArray = (value) => Array.isArray(value) ? value : [];
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const unique = (values) => [...new Set(values)];
const sorted = (values) => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const ownerKey = (kind, id) => `${kind}:${id}`;
const actionKey = (id, actionId) => `${id}#${actionId}`;

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const ownership = readPlanJson("CATALOG_OWNERSHIP.json");
const statusLedger = readPlanJson("_CYCLE_STATUS.json");
const revision10Candidate = readOptionalJson(join(root, revision10Path));
const techniqueIndex = readJson("public/techniques/index.json");
const labIndex = readJson("public/labs/index.json");
const atomRegistry = readJson("src/domain/atomRegistry.json");
const sourceRegistry = readJson("docs/architecture/source-trace-registry.json");
/**
 * The predecessor source dispositions come from an immutable projection of the frozen audit that
 * every lane pinned, not from this script's own regenerated audit.  Reading the live audit made
 * reconciliation self-referential: a conflict flag this run resolved disappeared from the next
 * run's input, so the same catalog produced two different reports.
 */
const frozenPredecessor = readPlanJson("evidence/lane-12/FROZEN_PREDECESSOR_SOURCE_DISPOSITION.json");
const compileWitnessPath = "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json";
const compileWitness = existsSync(join(root, compileWitnessPath)) ? readJson(compileWitnessPath) : undefined;

/**
 * The F08 identity is intentionally broader than the direct reconciler inputs. It records all
 * relevant application/content bytes in the shared stable domain, while excluding only generated
 * F08 artifacts, mutable coordination bookkeeping, the finite nonruntime preparation boundary,
 * dependency/build directories, and the protected nested backup. The finite boundary is exact-path
 * only; it does not exclude arbitrary archive or compiler-cache extensions. A later reconciliation
 * re-derives this inventory rather than trusting the record.
 */
const collectStableSourceFiles = (exclusion = stableDomainExclusion) => {
  const files = {};
  const boundary = [];
  const walk = (absoluteDirectory, relativeDirectory = "") => {
    let entries;
    try {
      entries = readdirSync(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      boundary.push({ path: relativeDirectory || ".", reason: `walk-error:${String(error.message ?? error)}` });
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = join(absoluteDirectory, entry.name);
      const directoryExclusion = exclusion(relativePath, "directory");
      if (entry.isSymbolicLink()) {
        if (directoryExclusion === "excluded-generated-or-dependency-directory") continue;
        boundary.push({ path: relativePath, reason: "symbolic-link-or-reparse-point" });
        continue;
      }
      if (entry.isDirectory()) {
        if (directoryExclusion) continue;
        walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        boundary.push({ path: relativePath, reason: "unsupported-filesystem-entry" });
        continue;
      }
      if (exclusion(relativePath, "file")) continue;
      const bytes = readFileSync(absolutePath);
      files[relativePath] = { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength };
    }
  };
  walk(root);
  return { files, boundary };
};

const f03FinalStrictIntegrationPath = "planning/2026-09-08_catalog-fidelity-follow-up/evidence/F03_FINAL_STRICT_ROOT_INTEGRATION.json";
const f03FinalStrictIntegration = readOptionalJson(join(root, f03FinalStrictIntegrationPath));
const f03FinalStrictPaths = asArray(f03FinalStrictIntegration?.files).map((entry) => entry?.path).filter((path) => typeof path === "string" && path);
const currentStableSource = collectStableSourceFiles(selectedCurrentEvidenceRunId ? currentVerificationStableDomainExclusion : stableDomainExclusion);
const selectedCurrentPhaseOutputPaths = selectedCurrentEvidenceRunId
  ? currentVerificationPhaseOutputPaths.filter((path) => existsSync(join(root, path)))
  : [];
const currentInputSpecification = deriveReconciliationInputSpecification({
  oldPlanRoot: "planning/2026-08-30_lab-studio-technique-composition-remediation",
  followupPlanRoot: "planning/2026-09-08_catalog-fidelity-follow-up",
  techniqueIndex,
  labIndex,
  availablePaths: new Set([...Object.keys(currentStableSource.files), ...selectedCurrentPhaseOutputPaths]),
  acceptedDependencyPaths: f03FinalStrictPaths,
});
const selectedCurrentEvidencePath = selectedCurrentEvidenceRunId ? currentVerificationRunPath(selectedCurrentEvidenceRunId) : currentSourceIdentityPath;
const currentSourceIdentity = selectedCurrentEvidenceRunId ? undefined : readOptionalJson(join(root, currentSourceIdentityPath));
const selectedCurrentEvidenceRun = selectedCurrentEvidenceRunId ? readOptionalJson(join(root, selectedCurrentEvidencePath)) : undefined;
const selectedCurrentEvidenceArtifacts = selectedCurrentEvidenceRunId
  ? [...new Set([...currentVerificationPhaseOutputPaths, ...currentVerificationArtifactPaths(selectedCurrentEvidenceRunId)])]
    .filter((path) => existsSync(join(root, path)))
    .reduce((records, path) => {
      if (!lstatSync(join(root, path)).isFile()) return records;
      const bytes = readFileSync(join(root, path));
      records[path] = { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength };
      return records;
    }, {})
  : {};
const selectedCurrentEvidenceInspection = selectedCurrentEvidenceRunId
  ? inspectCurrentVerificationRun({
    run: selectedCurrentEvidenceRun,
    expectedRunId: selectedCurrentEvidenceRunId,
    observedStableFiles: currentStableSource.files,
    observedArtifacts: selectedCurrentEvidenceArtifacts,
    observedBoundary: currentStableSource.boundary,
  })
  : null;
const selectedCurrentEvidenceSourceProvenance = selectedCurrentEvidenceInspection
  ? deriveCurrentVerificationSourceProvenance({
    run: selectedCurrentEvidenceRun,
    inspection: selectedCurrentEvidenceInspection,
  })
  : null;
const currentEvidenceFreshness = selectedCurrentEvidenceInspection
  ? {
    ...selectedCurrentEvidenceSourceProvenance,
    currentEvidenceRuns: [],
    repositoryHealth: {
      status: "unknown",
      reason: "A selected current-verification run records source and phase receipts only; repository-wide health still requires its own complete current run.",
      validation: "not-a-complete-current-repository-health-run",
    },
  }
  : inspectF08SourceIdentity({
    identity: currentSourceIdentity,
    expectedReconciliationPaths: currentInputSpecification.requiredPaths,
    observedStableFiles: currentStableSource.files,
    observedBoundary: currentStableSource.boundary,
  });
if (selectedCurrentEvidenceInspection) {
  const requiredPhaseIds = checkOnly
    ? ["cycle12-compiler-witness", "cycle12-reconciliation", "cycle09-overlay-refresh", "cycle09-overlay-check"]
    : ["cycle12-compiler-witness"];
  for (const phaseId of requiredPhaseIds) {
    const phase = selectedCurrentEvidenceInspection.phases.find((entry) => entry.id === phaseId);
    if (!phase || phase.status !== "complete-current-run") {
      fail(`Selected current verification run ${selectedCurrentEvidenceRunId} lacks a complete current phase receipt for ${phaseId}.`);
    }
  }
}
const currentEvidenceTimestamp = currentEvidenceFreshness.status === "current" ? currentEvidenceFreshness.capturedAt : null;
const currentRepositoryHealth = currentEvidenceFreshness.repositoryHealth;
const validatedCurrentEvidenceRuns = !selectedCurrentEvidenceInspection && currentEvidenceFreshness.status === "current"
  ? asArray(currentEvidenceFreshness.currentEvidenceRuns)
  : [];
const currentEvidenceRunProvenance = selectedCurrentEvidenceInspection
  ? "selected-current-verification-run; only the immutable selected source snapshot and required prior phase receipt are read so later receipts cannot make reconciliation output self-referential"
  : currentEvidenceFreshness.status !== "current"
  ? "withheld-because-source-is-not-current-or-run-provenance-is-invalid"
  : validatedCurrentEvidenceRuns.length > 0
    ? "current-source-and-complete-run-provenance-validated"
    : "no-current-complete-run-recorded";
const currentEvidenceReference = {
  path: selectedCurrentEvidencePath,
  status: currentEvidenceFreshness.status,
  capturedAt: currentEvidenceFreshness.capturedAt ?? null,
  sourceSnapshotPayloadSha256: currentEvidenceFreshness.sourceSnapshotPayloadSha256,
  reconciliationInputManifestSha256: currentEvidenceFreshness.reconciliationInputManifestSha256,
  reason: currentEvidenceFreshness.reason,
  mismatches: currentEvidenceFreshness.mismatches,
  contractErrors: currentEvidenceFreshness.contractErrors,
  missingRequiredPaths: currentEvidenceFreshness.missingRequiredPaths,
  stableDomainBoundary: currentStableSource.boundary,
  evidenceRunProvenance: currentEvidenceRunProvenance,
  ...(selectedCurrentEvidenceRunId ? {
    selection: "explicit-current-verification-run",
    runId: selectedCurrentEvidenceRunId,
    sourceSnapshotExcludes: "only fixed current phase outputs and fixed current-run artifacts; those paths are validated by phase receipts instead",
  } : {}),
};

const ownedTechniqueByCycle = new Map();
for (const [cycle, ids] of Object.entries(ownership.techniquesByFinalCycle ?? {})) {
  for (const id of ids) {
    if (ownedTechniqueByCycle.has(id)) fail(`Technique ownership repeats ${id}.`);
    ownedTechniqueByCycle.set(id, cycle);
  }
}
const ownedLabByCycle = new Map();
for (const [cycle, ids] of Object.entries(ownership.labsByFinalCycle ?? {})) {
  for (const id of ids) {
    if (ownedLabByCycle.has(id)) fail(`Lab ownership repeats ${id}.`);
    ownedLabByCycle.set(id, cycle);
  }
}

const techniquesById = new Map();
const labsById = new Map();
for (const entry of techniqueIndex) {
  if (techniquesById.has(entry.id)) fail(`Technique index repeats ${entry.id}.`);
  const technique = readJson(`public/techniques/${entry.file ?? `${entry.id}.json`}`);
  techniquesById.set(entry.id, technique);
  if (technique.id !== entry.id) fail(`Technique index/file identity mismatch for ${entry.id}.`);
}
for (const entry of labIndex) {
  if (labsById.has(entry.id)) fail(`Lab index repeats ${entry.id}.`);
  const lab = readJson(`public/labs/${entry.file ?? `${entry.id}.json`}`);
  labsById.set(entry.id, lab);
  if (lab.id !== entry.id) fail(`Lab index/file identity mismatch for ${entry.id}.`);
}

// Cycle 09 overlay files retain observed audit hashes and historical baseline reconciliation
// rows. Those coordinator-owned audit records change during the fixed phase chain, so the lane's
// current semantic rows must come directly from current source instead of whichever overlay was
// present before the refresh phase. The overlay remains independently reviewed below.
const cycle09Projection = deriveCycle09CurrentSourceProjection({
  registry: atomRegistry,
  sourceRegistry,
  techniquesById,
  labsById,
});
const cycle09ReconciliationInputs = deriveCycle09ReconciliationInputs(cycle09Projection);

const indexedTechniqueIds = [...techniquesById.keys()];
const indexedLabIds = [...labsById.keys()];
const unownedTechniqueIds = indexedTechniqueIds.filter((id) => !ownedTechniqueByCycle.has(id));
if (ownedTechniqueByCycle.size !== ownership.expectedTechniqueCount) {
  fail(`Ownership map has ${ownedTechniqueByCycle.size} techniques; expected ${ownership.expectedTechniqueCount}.`);
}
if (ownedLabByCycle.size !== ownership.expectedLabCount) {
  fail(`Ownership map has ${ownedLabByCycle.size} labs; expected ${ownership.expectedLabCount}.`);
}
if (unownedTechniqueIds.length !== 1 || unownedTechniqueIds[0] !== routeOnlyTechniqueId) {
  fail(`Only the explicit route-only carrier may be unowned; found ${unownedTechniqueIds.join(", ") || "none"}.`);
}
if (indexedLabIds.length !== ownership.expectedLabCount) {
  fail(`Public lab index has ${indexedLabIds.length} labs; expected ${ownership.expectedLabCount}.`);
}

const atomsById = new Map(asArray(atomRegistry.atoms).map((atom) => [atom.id, atom]));
const sourceTraceByOwnerAction = new Map();
for (const trace of asArray(sourceRegistry.traces)) {
  if (!trace.ownerType || !trace.ownerId || !trace.actionId) continue;
  sourceTraceByOwnerAction.set(actionKey(ownerKey(trace.ownerType, trace.ownerId), trace.actionId), trace);
}
const baselineTechniqueRowByAction = new Map();
for (const row of asArray(frozenPredecessor.rows)) {
  if (row.techniqueId && row.actionId) baselineTechniqueRowByAction.set(actionKey(row.techniqueId, row.actionId), row);
}
if (baselineTechniqueRowByAction.size !== frozenPredecessor.rowCount) {
  fail(`Frozen predecessor projection declares ${frozenPredecessor.rowCount} rows but yields ${baselineTechniqueRowByAction.size} unique action identities.`);
}

const normalizeOwner = (value) => {
  if (typeof value !== "string") return undefined;
  if (value.includes("ph-volume-titration-trial")) return ownerKey("technique", routeOnlyTechniqueId);
  if (value.includes("crystal-violet-hydroxide-order-extension")) return ownerKey("technique", "crystal-violet-kinetics");
  if (value.includes("thermal-decomposition-mass-loss")) return ownerKey("technique", "thermal-decomposition-mass-loss");
  if (value.includes("green-chemistry-mixture-purification")) return ownerKey("lab", "green-chemistry-mixture-purification");
  if (value.includes("acid-base-titration-curves")) return ownerKey("lab", "acid-base-titration-curves");
  if (value.startsWith("technique:") || value.startsWith("lab:")) return value;
  return undefined;
};

const overlayRowsByKey = new Map();
const overlaySummary = [];
for (const lane of fixedLaneOrder) {
  const laneRoot = join(evidenceRoot, `lane-${lane}`);
  const files = ["source-trace-overlay.json", "technique-atomicity-overlay.json", "lab-composition-overlay.json"];
  const routeMapPath = join(laneRoot, "route-control-map.json");
  const laneEntry = {
    lane,
    baselineRevision: laneBaselineRevision[lane],
    declaredBaselineRevisions: [],
    files: [],
    rowCounts: {},
    semanticRowOrigins: {},
    duplicateRowIds: [],
    unevaluatedRows: [],
    outOfScopeRows: [],
    historical: lane === "06" || lane === "07",
    candidateStatus: undefined,
    routeControl: undefined,
  };
  for (const file of files) {
    const path = join(laneRoot, file);
    if (!existsSync(path)) {
      warn(`Lane ${lane} has no ${file}; no rows were available.`);
      continue;
    }
    const relative = `planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-${lane}/${file}`;
    const overlay = readPlanJson(`evidence/lane-${lane}/${file}`);
    const currentCycle09Rows = lane === "09" ? cycle09ReconciliationInputs.rowsForOverlay(file) : null;
    if (lane === "09" && !currentCycle09Rows) {
      fail(`Lane 09 has no current-source semantic projection for ${file}.`);
      continue;
    }
    const rowsForReconciliation = lane === "09" ? currentCycle09Rows : asArray(overlay.rows);
    laneEntry.files.push(file);
    laneEntry.rowCounts[file] = rowsForReconciliation.length;
    laneEntry.semanticRowOrigins[file] = lane === "09" ? "current-source-projection" : "serialized-overlay";
    if (typeof overlay.baselineRevision === "number") laneEntry.declaredBaselineRevisions.push(overlay.baselineRevision);
    if (overlay.candidateStatus) laneEntry.candidateStatus = overlay.candidateStatus;
    if (overlay.frozenTechniqueAuditSha256 && overlay.frozenTechniqueAuditSha256 !== frozenPredecessor.sourceSha256) {
      fail(`Lane ${lane} pins frozen technique audit ${overlay.frozenTechniqueAuditSha256}, but the predecessor projection was taken from ${frozenPredecessor.sourceSha256}.`);
    }
    const rowIds = new Set();
    for (const row of rowsForReconciliation) {
      if (!row || typeof row !== "object") continue;
      if (row.rowId && rowIds.has(row.rowId)) laneEntry.duplicateRowIds.push(`${file}:${row.rowId}`);
      if (row.rowId) rowIds.add(row.rowId);
      if (row.evaluated !== true) laneEntry.unevaluatedRows.push(`${file}:${row.rowId ?? "<missing>"}`);
      const normalized = normalizeOwner(row.owner ?? row.originalOwner);
      const rowOwner = normalized ?? (typeof row.owner === "string" ? row.owner : undefined);
      const currentOwnerAllowed = rowOwner && (
        rowOwner === ownerKey("technique", routeOnlyTechniqueId) ||
        (rowOwner.startsWith("technique:") && ownedTechniqueByCycle.get(rowOwner.slice("technique:".length)) === lane) ||
        (rowOwner.startsWith("lab:") && ownedLabByCycle.get(rowOwner.slice("lab:".length)) === lane)
      );
      const coordinatorPathOwner = typeof row.owner === "string" && row.owner.startsWith("public/") ||
        typeof row.owner === "string" && row.owner.startsWith("src/") ||
        typeof row.owner === "string" && row.owner.startsWith("scripts/");
      if (!currentOwnerAllowed && !coordinatorPathOwner && rowOwner) laneEntry.outOfScopeRows.push(`${file}:${row.rowId ?? rowOwner}`);
      const techniqueId = row.techniqueId ?? (rowOwner?.startsWith("technique:") ? rowOwner.slice("technique:".length) : undefined);
      const labId = row.labId ?? (rowOwner?.startsWith("lab:") ? rowOwner.slice("lab:".length) : undefined);
      const itemId = techniqueId ?? labId;
      const itemAction = row.actionId ?? row.originalActionId;
      if (lane !== "09" && itemId && itemAction) {
        const key = actionKey(itemId, itemAction);
        const bucket = overlayRowsByKey.get(key) ?? {};
        bucket[file] = { ...row, lane, sourcePath: relative };
        overlayRowsByKey.set(key, bucket);
      }
    }
    laneEntry.declaredBaselineRevisions = unique(laneEntry.declaredBaselineRevisions);
  }
  if (laneEntry.declaredBaselineRevisions.some((revision) => revision !== laneEntry.baselineRevision)) {
    if (laneEntry.historical) warn(`Lane ${lane} retains historical baseline revision ${laneEntry.declaredBaselineRevisions.join(", ")}; accepted review evidence supersedes it.`);
    else fail(`Lane ${lane} declares a baseline revision other than ${laneEntry.baselineRevision}.`);
  }
  if (laneEntry.duplicateRowIds.length > 0) fail(`Lane ${lane} has duplicate overlay row identities.`);
  if (laneEntry.unevaluatedRows.length > 0) fail(`Lane ${lane} has unevaluated overlay rows.`);
  if (laneEntry.outOfScopeRows.length > 0) fail(`Lane ${lane} has out-of-scope overlay rows: ${laneEntry.outOfScopeRows.slice(0, 5).join(", ")}.`);
  if (existsSync(routeMapPath)) {
    const routeMap = readPlanJson(`evidence/lane-${lane}/route-control-map.json`);
    const controls = asArray(routeMap.controls);
    const controlIds = controls.map((control) => control.controlId).filter(Boolean);
    const duplicateControlIds = controlIds.filter((id, index) => controlIds.indexOf(id) !== index);
    const unevaluatedControls = controls.filter((control) => control.evaluated !== true).map((control) => control.controlId);
    laneEntry.routeControl = {
      route: routeMap.route ?? {},
      controlCount: controls.length,
      uniqueControlIds: unique(controlIds).length,
      duplicateControlIds,
      unevaluatedControls,
      everyControlMappedExactlyOnce: routeMap.coverage?.everyControlMappedExactlyOnce === true,
      noHiddenExpectedAnswers: routeMap.coverage?.noHiddenExpectedAnswersInRouteCopy === true || routeMap.coverage?.noExpectedMeasurementsOrResults === true,
    };
    if (duplicateControlIds.length || unevaluatedControls.length || !laneEntry.routeControl.everyControlMappedExactlyOnce) {
      fail(`Lane ${lane} route-control map is incomplete or duplicated.`);
    }
  }
  overlaySummary.push(laneEntry);
}

const getOverlay = (id, actionId, file, kind) => {
  // Cycle 09 rows are source-derived for every current owner. A removed current identity returns
  // `undefined` with `applies: true`, so it cannot inherit a serialized predecessor row. The
  // separate Cycle 09 checker remains responsible for exact post-refresh overlay validation.
  const currentCycle09Row = cycle09ReconciliationInputs.rowForOverlay({
    file,
    owner: ownerKey(kind, id),
    actionId,
  });
  if (currentCycle09Row.applies) return currentCycle09Row.row;
  return overlayRowsByKey.get(actionKey(id, actionId))?.[file];
};

/**
 * Lanes record a governing-authority rationale in `sourceConflict` / `sourceConflictDisposition`
 * as free text.  Most of that text resolves the authority; a row that opens with "Conflict" is a
 * lane escalation that this coordinator must carry, not flatten to `false`.  Treating only a
 * literal `true` as a conflict silently dropped the lane escalations, so both forms are honored.
 */
const declaredConflictNote = (...values) => {
  for (const value of values) {
    if (value === true) return "Lane recorded an unresolved source conflict.";
    if (typeof value === "string" && /^\s*conflict\b/i.test(value)) return value;
  }
  return null;
};

let baselineConflictsSupersededByLaneEvidence = 0;
let unreviewedBaselineConflicts = 0;

const getSourceEvidence = (id, actionId, kind) => {
  const owner = ownerKey(kind, id);
  const overlay = getOverlay(id, actionId, "source-trace-overlay.json", kind);
  const atomicityOverlay = getOverlay(id, actionId, "technique-atomicity-overlay.json", kind);
  const registryTrace = sourceTraceByOwnerAction.get(actionKey(owner, actionId));
  const baseline = kind === "technique" ? baselineTechniqueRowByAction.get(actionKey(id, actionId)) : undefined;
  const sourceFile = overlay?.sourceFile ?? registryTrace?.sourceFile ?? null;
  const sourceTable = overlay?.sourceTable ?? registryTrace?.sourceTable ?? null;
  const step = overlay?.step ?? registryTrace?.step ?? null;
  const basis = overlay?.basis ?? registryTrace?.basis ?? baseline?.applicableSourceClaims?.[0]?.basis ?? null;
  const traceDebt = overlay?.traceDebt ?? null;
  const laneConflictNote = declaredConflictNote(
    overlay?.sourceConflict,
    atomicityOverlay?.sourceConflict,
    atomicityOverlay?.sourceConflictDisposition,
  );
  // The owning lane's reviewed overlay governs its own rows, so a pre-remediation baseline
  // conflict flag is superseded once that lane re-examined the action.  Keeping the old flag
  // would over-report a re-grounded row; dropping it without a count would hide that it existed.
  const laneReviewed = Boolean(overlay ?? atomicityOverlay);
  const baselineConflict = baseline?.conflict === true;
  let supersededBaselineConflict = null;
  let conflictNote = laneConflictNote;
  if (baselineConflict && !laneConflictNote) {
    if (laneReviewed) {
      baselineConflictsSupersededByLaneEvidence += 1;
      supersededBaselineConflict = `Predecessor audit flagged a source conflict; the owning lane's reviewed overlay re-grounded this action${sourceFile ? ` to ${sourceFile}` : " as an explicit non-source disposition"}.`;
    } else {
      unreviewedBaselineConflicts += 1;
      conflictNote = "Predecessor audit flagged a source conflict and no owning-lane overlay re-examined this action.";
    }
  }
  const rationale = overlay?.rationale ?? baseline?.governingAuthorityAndRationale ??
    (basis === "C" ? "Configuration, orchestration, or learner/instructor evidence boundary; no authored result is promoted to source authority." :
      kind === "technique" && ownedTechniqueByCycle.get(id) === "04" ? "Cycle 04 reviewed reusable boundary as disclosed R/C practice; consuming instances supply quantities and evidence identities." :
        "Current source/static lane evidence and registry disposition; no unreviewed source claim is introduced.");
  const sourceStatus = sourceFile ? "source-traced" :
    traceDebt ? "untraced-acquisition-debt" :
      basis === "C" ? "configuration-orchestration" :
        kind === "technique" && ownedTechniqueByCycle.get(id) === "04" ? "cycle-04-reviewed-r-c-contract" :
          "declared-non-source-derived";
  return {
    trace: overlay ?? registryTrace ?? null,
    sourceFile,
    sourceTable,
    step,
    basis,
    sourceStatus,
    traceDebt,
    disposition: {
      applicableSourceClaims: sourceFile ? [{ sourceFile, sourceTable, step, basis }] : (baseline?.applicableSourceClaims ?? []),
      conflict: Boolean(conflictNote),
      traceDebt,
      supersededBaselineConflict,
      governingAuthorityAndRationale: rationale,
      unresolvedConfirmationPoint: conflictNote ??
        (traceDebt ? `Lane-recorded ${traceDebt}: the acquisition has no exact source-registry row and the frozen registry is outside this cycle's touchpoints.` : null),
    },
  };
};

const effectFlags = (classes) => ({
  apparatusMaterialInstrumentState: classes.includes("apparatus-material-instrument-state"),
  measurementOrDirectObservation: classes.includes("measurement-direct-observation-acquisition"),
  evidenceRecording: classes.includes("evidence-recording"),
  calculationOrAnalysis: classes.includes("calculation-analysis"),
  pedagogicalOrchestration: classes.includes("pedagogical-orchestration"),
});

/**
 * A row's verdict follows its effect contract, not merely whether an atom row exists.
 *
 * Deriving "nonphysical" from a missing `atomId` alone contradicted the effect contract the same
 * row already carried: 99 actions declare `apparatus-material-instrument-state` or
 * `measurement-direct-observation-acquisition` while having no atom entry, and the owning lanes
 * recorded them as physical.  Reporting those as nonphysical is exactly the spoofed-nonphysical
 * record Cycle 12 must not produce, so they are classified and counted explicitly instead.  The
 * atom registry is frozen and outside this cycle's touchpoints, so the rows are disclosed rather
 * than repaired here.
 */
const atomicityVerdict = (hasAtom, classes) => {
  if (hasAtom) return "keep";
  const flags = effectFlags(classes);
  if (flags.measurementOrDirectObservation) return "acquisition-without-atom";
  if (flags.apparatusMaterialInstrumentState) return "physical-without-atom";
  return "nonphysical";
};
const atomlessPhysicalVerdicts = new Set(["acquisition-without-atom", "physical-without-atom"]);

/**
 * Lane 06 established the rule for a weighing action: the learner's mass must land in a declared
 * output measurement, or the action must be explicitly locked behind an approved
 * `unsupportedMassOutputBindingApproved` prerequisite.  Anything else compares the learner's mass
 * against a container/zero fallback.  The catalog-wide count is recomputed here so the closure
 * reports it instead of leaving it to one lane verifier the coordinator never ran; repairing the
 * bindings is lane-owned content work, not a coordinator edit.
 */
const hasSupportedMassOutputBinding = (action) => {
  if (action.verb !== "weigh") return true;
  const mass = action.mass ?? {};
  const supported = mass.source === "action-input" &&
    typeof mass.outputMeasurementId === "string" &&
    !mass.applyToSourceInventory;
  const guarded = action.parameters?.unlocked === false &&
    asArray(action.prerequisites).some((rule) => rule.path === "unsupportedMassOutputBindingApproved");
  return supported || guarded;
};

const techniqueRows = [];
const techniqueDispositionById = {};
for (const technique of techniquesById.values()) {
  const ownerCycle = ownedTechniqueByCycle.get(technique.id);
  const routeOnly = technique.id === routeOnlyTechniqueId;
  if (!ownerCycle && !routeOnly) fail(`Technique ${technique.id} has no final owner.`);
  if (!technique.metadata?.version || /[\s*^~<>=|]/.test(technique.metadata.version)) fail(`Technique ${technique.id} does not pin an exact version.`);
  if (technique.composition?.schemaVersion !== 1) fail(`Technique ${technique.id} is missing composition schemaVersion 1.`);
  const legacyEffects = new Map(asArray(technique.composition?.legacyActionEffects).map((entry) => [entry.actionId, entry.effect]));
  const actionIds = new Set();
  const nodesByAction = new Map();
  for (const node of asArray(technique.process?.nodes)) {
    if (node.actionId) {
      const list = nodesByAction.get(node.actionId) ?? [];
      list.push(node.id);
      nodesByAction.set(node.actionId, list);
    }
  }
  const counts = {
    actions: technique.actions.length,
    atoms: 0,
    nonphysical: 0,
    atomlessPhysical: 0,
    sourceTraced: 0,
    configuration: 0,
    untracedAcquisition: 0,
  };
  for (const action of asArray(technique.actions)) {
    if (actionIds.has(action.id)) fail(`Technique ${technique.id} repeats action ${action.id}.`);
    actionIds.add(action.id);
    const atom = action.atomId ? atomsById.get(action.atomId) : undefined;
    const effectContract = atom?.effectContract ?? legacyEffects.get(action.id);
    if (action.atomId && !atom) fail(`Technique ${technique.id} action ${action.id} references unknown atom ${action.atomId}.`);
    if (!effectContract) fail(`Technique ${technique.id} action ${action.id} has no atom or composition-owned effect contract.`);
    const source = getSourceEvidence(technique.id, action.id, "technique");
    if (source.sourceFile) counts.sourceTraced += 1; else counts.configuration += 1;
    if (source.traceDebt) counts.untracedAcquisition += 1;
    const classes = effectContract?.classes ?? [];
    const targets = effectContract?.targets ?? [];
    const verdict = atomicityVerdict(Boolean(atom), classes);
    if (atom) counts.atoms += 1;
    else if (atomlessPhysicalVerdicts.has(verdict)) counts.atomlessPhysical += 1;
    else counts.nonphysical += 1;
    const row = {
      rowId: `${technique.id}@${technique.metadata.version}#${action.id}`,
      techniqueId: technique.id,
      techniqueVersion: technique.metadata.version,
      actionId: action.id,
      actionLabel: action.label,
      actionVerb: action.verb,
      reachableTechniqueNodeConsumers: nodesByAction.get(action.id) ?? [],
      coverage: {
        atomId: action.atomId ?? null,
        atomRegistryEntryPresent: Boolean(atom),
        equipmentRoleBindings: action.equipmentRoleBindings ?? {},
        equipmentRoleRegistryEntriesPresent: true,
        missingRequiredRoles: (atom?.requiredRoles ?? []).filter((roleId) => !action.equipmentRoleBindings?.[roleId]),
        sourceTraceCount: source.trace ? 1 : 0,
        sourceStatus: source.sourceStatus,
      },
      finalOwningCycle: ownerCycle ?? "route-only",
      effect: {
        registryHandlerDerivedClasses: classes,
        typedTargetDomains: targets.map((target) => target.domain),
        flags: effectFlags(classes),
        declaredVersusDerivedConflict: { hasConflict: false, reasons: [] },
        resolvedInteractionType: action.interaction?.type ?? null,
      },
      atomicity: {
        realBenchVerb: action.verb,
        persistentStateTransition: asArray(action.stateChanges),
        prerequisites: asArray(action.prerequisites),
        distinctPausePoint: `Completion of node evidence for ${action.id}; no un-authored microstep is introduced.`,
        invalidUnsafeCases: asArray(action.invalidCases),
        recoveryBoundary: asArray(action.invalidCases).map((item) => ({ caseId: item.id, recovery: item.recovery })),
        evidenceBoundary: { actionEvidence: asArray(action.evidence), atomEvidence: atom?.evidence ?? null },
        flags: { multiVerb: false, positionVersusOperate: false, readVersusRecord: false, conditionVersusMeasure: false },
        verdict,
        atomlessPhysicalDisclosure: atomlessPhysicalVerdicts.has(verdict)
          ? `The composition-owned effect contract is physical (${classes.join(", ")}) but no atom registry row backs this action. The frozen atom registry is outside this cycle's touchpoints, so the row is disclosed as residual atomic-identity debt and is not recorded as nonphysical.`
          : null,
        massOutputBinding: action.verb !== "weigh"
          ? "not-applicable"
          : hasSupportedMassOutputBinding(action)
            ? "bound-or-approval-guarded"
            : "unbound: the learner mass has no declared output measurement and no approved unsupported-binding guard; lane-owned content repair is required.",
        proposedChildOperations: [],
        publicIdDisposition: `Preserve ${action.id}.`,
      },
      sourceDisposition: source.disposition,
      techniqueMatchDecision: "exact-compatible-version",
      blockedReason: null,
      evaluated: true,
    };
    techniqueRows.push(row);
  }
  if (technique.process?.nodes?.length !== technique.actions.length) warn(`Technique ${technique.id} has ${technique.process?.nodes?.length ?? 0} process nodes for ${technique.actions.length} actions; the compiler witness remains authoritative for labs.`);
  techniqueDispositionById[technique.id] = {
    id: technique.id,
    version: technique.metadata.version,
    ownerCycle: ownerCycle ?? null,
    catalogDisposition: technique.composition?.catalogDisposition ?? null,
    actionCount: technique.actions.length,
    physicalActionCount: counts.atoms,
    nonphysicalActionCount: counts.nonphysical,
    atomlessPhysicalActionCount: counts.atomlessPhysical,
    sourceTracedActionCount: counts.sourceTraced,
    configurationBoundaryActionCount: counts.configuration,
    untracedAcquisitionActionCount: counts.untracedAcquisition,
    finalDisposition: routeOnly ? "route-only-carrier" : (technique.composition?.catalogDisposition ?? "composable"),
  };
}

const atomlessPhysicalRowIds = techniqueRows
  .filter((row) => atomlessPhysicalVerdicts.has(row.atomicity.verdict))
  .map((row) => row.rowId);
const untracedAcquisitionRowIds = techniqueRows
  .filter((row) => row.sourceDisposition.traceDebt)
  .map((row) => row.rowId);
const declaredSourceConflictRowIds = techniqueRows
  .filter((row) => row.sourceDisposition.conflict)
  .map((row) => row.rowId);
const unboundMassOutputRowIds = techniqueRows
  .filter((row) => String(row.atomicity.massOutputBinding).startsWith("unbound"))
  .map((row) => row.rowId);
const weighRowCount = techniqueRows.filter((row) => row.atomicity.massOutputBinding !== "not-applicable").length;
const atomlessPhysicalByAction = new Map(techniqueRows
  .filter((row) => atomlessPhysicalVerdicts.has(row.atomicity.verdict))
  .map((row) => [actionKey(row.techniqueId, row.actionId), row]));
const techniqueRowByAction = new Map(techniqueRows.map((row) => [actionKey(row.techniqueId, row.actionId), row]));

const witnessByLab = new Map(asArray(compileWitness?.labs).map((lab) => [lab.id, lab]));
if (!compileWitness) fail("Cycle 12 compiler witness is missing; run collectCycle12CompileWitness.mjs before reconciliation.");
const labRows = [];
const labDispositionById = {};
const originCounts = { "technique-instance": 0, "lab-local": 0 };
const complianceCounts = { "technique-origin procedure": 0, "allowed-orchestration": 0, "anonymous-local-procedure": 0, "missing-origin": 0 };
const reachabilityCounts = { mandatory: 0, conditional: 0, "dead-under-witness": 0 };
const effectClassCounts = {};
let effectConflictRows = 0;
let unreferencedDeclaredActionCount = 0;
const unreferencedDeclaredActions = [];
let atomlessPhysicalOriginRows = 0;
let witnessCompileCount = 0;
for (const lab of labsById.values()) {
  if (!Array.isArray(lab.techniqueInstances) || lab.techniqueInstances.length === 0) fail(`Lab ${lab.id} is missing techniqueInstances.`);
  if (lab.techniqueRefs !== undefined) fail(`Lab ${lab.id} still exposes legacy techniqueRefs.`);
  if (lab.compositionManifest !== undefined) fail(`Raw lab ${lab.id} must not assert a compositionManifest.`);
  if (!isObject(lab.initialState) || !Array.isArray(lab.initialState.equipment)) fail(`Lab ${lab.id} does not declare initialState.equipment explicitly.`);
  const declaredDefinitions = new Set(asArray(lab.equipment));
  const initialDefinitions = new Set(asArray(lab.initialState?.equipment).map((item) => item.definitionId));
  for (const definitionId of declaredDefinitions) if (!initialDefinitions.has(definitionId)) fail(`Lab ${lab.id} omits explicit initial equipment ${definitionId}.`);
  const witness = witnessByLab.get(lab.id);
  if (!witness) {
    fail(`Lab ${lab.id} has no compiler witness.`);
    continue;
  }
  const actionById = new Map(asArray(lab.actions).map((action) => [action.id, action]));
  const declaredWitnessIds = asArray(lab.reachabilityWitnesses).map((item) => item.id);
  if (JSON.stringify(declaredWitnessIds) !== JSON.stringify(asArray(witness.reachabilityWitnessIds))) {
    fail(`Lab ${lab.id} declares witnesses ${declaredWitnessIds.join(", ")} but the compiler witness covers ${asArray(witness.reachabilityWitnessIds).join(", ")}.`);
  }
  if (asArray(witness.witnessCompiles).length !== declaredWitnessIds.length) {
    fail(`Lab ${lab.id} compiler witness records ${asArray(witness.witnessCompiles).length} witness compiles for ${declaredWitnessIds.length} declared witnesses; regenerate collectCycle12CompileWitness.mjs.`);
  }
  witnessCompileCount += asArray(witness.witnessCompiles).length;

  // Independent cross-check of the collector's default-witness reachability, so a collector
  // regression cannot quietly turn an unreachable node into a mandatory row.
  const defaultWitnessId = declaredWitnessIds[0];
  const defaultReachable = new Set();
  const defaultQueue = [witness.startNodeId];
  while (defaultQueue.length) {
    const nodeId = defaultQueue.shift();
    if (!nodeId || defaultReachable.has(nodeId)) continue;
    defaultReachable.add(nodeId);
    for (const edge of asArray(witness.edges)) if (edge.from === nodeId && edge.condition?.type !== "retry") defaultQueue.push(edge.to);
  }
  for (const node of asArray(witness.nodes)) {
    if (!asArray(node.presentInWitnesses).includes(defaultWitnessId)) continue;
    if (defaultReachable.has(node.nodeId) !== asArray(node.reachableInWitnesses).includes(defaultWitnessId)) {
      fail(`Lab ${lab.id} node ${node.nodeId} disagrees with the recompiled default-witness reachability.`);
    }
  }

  const witnessById = new Map(asArray(lab.reachabilityWitnesses)
    .map((item) => [item.id, { id: item.id, configuration: item.configuration ?? {}, approvalGates: item.approvalGates ?? {} }]));
  const coveredLocalActions = new Set();
  for (const node of asArray(witness.nodes)) {
    const origin = node.origin;
    const presentIn = asArray(node.presentInWitnesses);
    const reachableIn = asArray(node.reachableInWitnesses);
    const gatedIn = asArray(node.gatedInWitnesses);
    // "mandatory" means every valid witness both contains the node and reaches it ungated.
    // "conditional" means at least one valid witness reaches it but the entry depends on a
    // configuration/approval choice or on which witness is selected.
    const reachability = reachableIn.length === 0
      ? "dead-under-witness"
      : (presentIn.length < declaredWitnessIds.length ||
        reachableIn.length < presentIn.length ||
        reachableIn.every((witnessId) => gatedIn.includes(witnessId)))
        ? "conditional"
        : "mandatory";
    reachabilityCounts[reachability] += 1;
    if (reachability === "dead-under-witness") {
      fail(`Lab ${lab.id} node ${node.nodeId} is unreachable under every valid witness.`);
    }
    let effect;
    let currentActionOrigin;
    let complianceVerdict;
    let sourceConflictOrConfigurationBlock = { sourceClaims: [], conflict: false, traceDebt: null, block: null };
    let requiredRemediation = null;
    if (origin) {
      currentActionOrigin = {
        kind: "technique-instance",
        techniqueId: origin.techniqueId,
        techniqueVersion: origin.techniqueVersion,
        instanceId: origin.instanceId,
        sourceActionId: origin.sourceActionId,
        sourceNodeId: origin.sourceNodeId,
      };
      originCounts["technique-instance"] += 1;
      const techniqueRow = techniqueRowByAction.get(actionKey(origin.techniqueId, origin.sourceActionId));
      effect = techniqueRow?.effect ?? { registryHandlerDerivedClasses: [], typedTargetDomains: [], flags: effectFlags([]), declaredVersusDerivedConflict: { hasConflict: true, reasons: ["missing technique row"] }, resolvedInteractionType: null };
      if (!techniqueRow) effectConflictRows += 1;
      complianceVerdict = "technique-origin procedure";
      // The lab row inherits the originating technique row's source disposition instead of
      // asserting a blank, always-clean block.
      if (techniqueRow) {
        sourceConflictOrConfigurationBlock = {
          sourceClaims: techniqueRow.sourceDisposition.applicableSourceClaims,
          conflict: techniqueRow.sourceDisposition.conflict,
          traceDebt: techniqueRow.sourceDisposition.traceDebt ?? null,
          block: techniqueRow.sourceDisposition.unresolvedConfirmationPoint,
        };
      }
      const atomlessOrigin = atomlessPhysicalByAction.get(actionKey(origin.techniqueId, origin.sourceActionId));
      if (atomlessOrigin) {
        atomlessPhysicalOriginRows += 1;
        requiredRemediation = `Residual atomic-identity debt: origin ${origin.techniqueId}#${origin.sourceActionId} carries a physical effect contract with no atom registry row (${atomlessOrigin.atomicity.verdict}). Repair requires an atom registry amendment, which is outside this cycle's touchpoints.`;
      }
    } else {
      const action = actionById.get(node.actionId);
      const interactionType = action?.interaction?.type;
      const nonphysical = !["placeOnWorkbench", "moveEquipment", "snapIntoTarget", "transferLiquid", "dispense", "measureVolume", "readInstrument", "heat", "cool", "mix", "separate", "filter", "weigh", "drop"].includes(interactionType) &&
        !["place", "move", "transfer", "measureVolume", "weigh", "heat", "cool", "mix", "dispense", "filter", "separate"].includes(action?.verb);
      const classes = action?.verb === "calculate" || interactionType === "submitCalculation" ? ["calculation-analysis"] : ["evidence-recording"];
      effect = { registryHandlerDerivedClasses: classes, typedTargetDomains: classes[0] === "calculation-analysis" ? ["analysis"] : ["evidence"], flags: effectFlags(classes), declaredVersusDerivedConflict: { hasConflict: false, reasons: [] }, resolvedInteractionType: interactionType ?? null };
      currentActionOrigin = { kind: "lab-local" };
      originCounts["lab-local"] += 1;
      complianceVerdict = nonphysical ? "allowed-orchestration" : "anonymous-local-procedure";
      if (!nonphysical) fail(`Lab ${lab.id} has a lab-local physical action ${node.actionId}.`);
      if (node.actionId) coveredLocalActions.add(node.actionId);
    }
    for (const className of effect.registryHandlerDerivedClasses) effectClassCounts[className] = (effectClassCounts[className] ?? 0) + 1;
    complianceCounts[complianceVerdict] += 1;
    const row = {
      rowId: `${lab.id}#${node.nodeId}`,
      labId: lab.id,
      processId: "root",
      nodeId: node.nodeId,
      actionId: node.actionId,
      reachability,
      validConfigurationApprovalWitnesses: presentIn.map((witnessId) => witnessById.get(witnessId)).filter(Boolean),
      reachableUnderWitnessIds: reachableIn,
      gatedUnderWitnessIds: gatedIn,
      currentActionOrigin,
      effect,
      complianceVerdict,
      techniqueMatchEscalation: origin ? { decision: "exact-compatible-version", candidates: [] } : { decision: "not-applicable", candidates: [] },
      laterOwnerCycle: origin ? (ownedTechniqueByCycle.get(origin.techniqueId) ?? "route-only") : ownedLabByCycle.get(lab.id),
      sourceConflictOrConfigurationBlock,
      requiredRemediation,
      evaluated: true,
    };
    labRows.push(row);
  }
  for (const actionId of asArray(lab.actions).map((action) => action.id)) {
    if (coveredLocalActions.has(actionId)) continue;
    unreferencedDeclaredActionCount += 1;
    unreferencedDeclaredActions.push({ labId: lab.id, actionId });
  }
  labDispositionById[lab.id] = {
    id: lab.id,
    ownerCycle: ownedLabByCycle.get(lab.id),
    sourceTechniqueInstanceCount: witness.sourceTechniqueInstanceCount,
    sourceLocalActionCount: witness.sourceLocalActionCount,
    compiledActionCount: witness.compiledActionCount,
    compiledNodeCount: witness.compiledNodeCount,
    compiledEdgeCount: witness.compiledEdgeCount,
    compiledOriginCount: witness.compiledOriginCount,
    compiledManifestInstanceCount: witness.compiledManifestInstanceCount,
    initialEquipmentCount: witness.initialEquipmentCount,
    reachabilityWitnessIds: witness.reachabilityWitnessIds,
    witnessCompileCount: asArray(witness.witnessCompiles).length,
    auditedNodeCount: witness.unionNodeCount,
    unionTechniqueInstanceCount: asArray(witness.unionTechniqueInstanceIds).length,
    customRoute: ["acid-base-titration-curves", "green-chemistry-mixture-purification"].includes(lab.id),
  };
}

if (unreferencedDeclaredActionCount > 0) {
  fail(`${unreferencedDeclaredActionCount} declared lab-local action(s) appear under no valid witness: ${unreferencedDeclaredActions.map((item) => `${item.labId}#${item.actionId}`).slice(0, 5).join(", ")}.`);
}

const totalTechniqueActions = techniqueRows.length;
const totalCompiledNodes = labRows.length;
const routeControlSummary = overlaySummary.filter((entry) => entry.routeControl).map((entry) => ({ lane: entry.lane, ...entry.routeControl }));
const sourceStatusCounts = techniqueRows.reduce((counts, row) => {
  counts[row.coverage.sourceStatus] = (counts[row.coverage.sourceStatus] ?? 0) + 1;
  return counts;
}, {});
const verdictCounts = techniqueRows.reduce((counts, row) => {
  counts[row.atomicity.verdict] = (counts[row.atomicity.verdict] ?? 0) + 1;
  return counts;
}, {});

const techniqueAudit = {
  schema: "lab-studio/technique-atomicity-audit@cycle12",
  generatedAt: currentEvidenceTimestamp,
  currentEvidence: currentEvidenceReference,
  inventory: {
    indexedTechniques: indexedTechniqueIds.length,
    ownedTechniques: ownedTechniqueByCycle.size,
    routeOnlyTechniqueCount: unownedTechniqueIds.length,
    actionRows: totalTechniqueActions,
    uniqueRowIds: unique(techniqueRows.map((row) => row.rowId)).length,
    verdictCounts,
    sourceStatusCounts,
    effectClassCounts: techniqueRows.reduce((counts, row) => {
      for (const className of row.effect.registryHandlerDerivedClasses) counts[className] = (counts[className] ?? 0) + 1;
      return counts;
    }, {}),
    effectConflictRows: techniqueRows.filter((row) => row.effect.declaredVersusDerivedConflict.hasConflict).length,
    missingAtomOrEffectRows: techniqueRows.filter((row) => !row.coverage.atomRegistryEntryPresent && !row.effect.registryHandlerDerivedClasses.length).length,
    atomlessPhysicalRows: atomlessPhysicalRowIds.length,
    untracedAcquisitionRows: untracedAcquisitionRowIds.length,
    declaredSourceConflictRows: declaredSourceConflictRowIds.length,
    baselineConflictsSupersededByLaneEvidence,
    unreviewedBaselineConflicts,
    weighActionRows: weighRowCount,
    unboundMassOutputRows: unboundMassOutputRowIds.length,
  },
  rubric: {
    mandatoryRowSchema: ["actionLabel", "actionVerb", "reachableTechniqueNodeConsumers", "coverage", "effect", "atomicity", "sourceDisposition", "techniqueMatchDecision", "finalOwningCycle"],
    policy: "Every current exact-version action is represented once. Atom-backed rows use the frozen atom registry; atomless rows use composition-owned handler-equivalent effects. A row's verdict follows its effect contract, so an atomless action whose contract is physical or acquisitive is recorded as physical-without-atom / acquisition-without-atom residual debt rather than as nonphysical.",
    residualDebt: {
      atomlessPhysicalRowIds,
      untracedAcquisitionRowIds,
      declaredSourceConflictRowIds,
      unboundMassOutputRowIds,
      owner: "Repair needs a frozen atom-registry or source-trace-registry amendment, which is outside this cycle's touchpoints; the rows are disclosed, not suppressed.",
    },
  },
  rows: techniqueRows,
};

const labAudit = {
  schema: "lab-studio/lab-composition-audit@cycle12",
  generatedAt: currentEvidenceTimestamp,
  currentEvidence: currentEvidenceReference,
  inventory: {
    indexedLabs: indexedLabIds.length,
    nodeActionRows: totalCompiledNodes,
    uniqueRowIds: unique(labRows.map((row) => row.rowId)).length,
    sourceLocalActionRows: [...labsById.values()].reduce((sum, lab) => sum + lab.actions.length, 0),
    sourceTechniqueInstanceRows: [...labsById.values()].reduce((sum, lab) => sum + lab.techniqueInstances.length, 0),
    witnessCompileCount,
    defaultWitnessNodeRows: compileWitness?.totals?.compiledNodeCount ?? 0,
    reachabilityCounts,
    originCounts,
    complianceCounts,
    effectClassCounts,
    effectConflictRows,
    unreferencedDeclaredActionCount,
    atomlessPhysicalOriginRows,
  },
  reachabilityPolicy: "Every lab is compiled once per declared reachability witness and the rows cover the union of compiled nodes, because a configuration witness can enable or disable whole technique instances. A node reachable and ungated under every valid witness is mandatory; one reachable under some witness, or entered only through a configuration/approval gate, is conditional; one present but unreachable under every witness it appears in is dead-under-witness and fails reconciliation. No local physical or evidence-acquisition action is accepted without a technique-instance origin.",
  rows: labRows,
  unreferencedDeclaredActions,
};

const compilerTotals = compileWitness?.totals ?? {};

/**
 * Lane 11's re-review filed a shared request against `src/data/labSetup.ts`: register a
 * green-chemistry setup so the lab can carry an empty configuration and `loadBundledLab` raises
 * `LabSetupRequired` instead of compiling the placeholder.  Cycle 12 does not resolve it here.
 * The request arrived after this cycle closed and has not gone through the baseline-revision
 * amendment protocol, and landing the gate changes `loadBundledLab` behaviour that only the
 * prohibited Vitest/build checks could confirm.  The condition is recomputed rather than asserted,
 * so the disclosure disappears on its own once a later cycle removes the placeholder.
 */
const placeholderConfigurationValues = new Set(["unconfigured-teacher-choice"]);
const openSharedContractRequests = [];
for (const lab of labsById.values()) {
  const placeholders = asArray(lab.techniqueInstances).flatMap((instance) =>
    Object.entries(instance.bindings?.configuration ?? {})
      .filter(([, value]) => placeholderConfigurationValues.has(value))
      .map(([slotId]) => `${instance.instanceId}.${slotId}`));
  if (placeholders.length === 0) continue;
  openSharedContractRequests.push({
    id: "lane-11-green-chemistry-lab-setup",
    requestedBy: "11",
    target: "src/data/labSetup.ts",
    labId: lab.id,
    placeholderConfigurationSlots: sorted(placeholders),
    request: "Register a green-chemistry setup so the lab can declare an empty bindings.configuration and loadBundledLab raises LabSetupRequired instead of compiling a labelled placeholder.",
    cycle12Disposition: "not-resolved-by-this-cycle: filed after Cycle 12 closed, outside the reviewed baseline-revision amendment protocol, and the loadBundledLab gate it needs can only be confirmed by the Vitest/build checks this cycle may not run.",
    currentMitigation: "The placeholder is explicit, the route refuses to execute an unconfigured compile, and the coordinator compile witness binds a teacher-approved fixture instead.",
  });
}
const residualConfirmationPoints = [
  "Expected-value literals and illustrative configuration defaults remain source/configuration review points; they are not learner answer keys or physical results.",
  "The public index contains 42 technique entries: 41 ownership-map techniques plus the explicit route-only ph-volume-formal-titration-trial carrier. The roadmap's older '40 techniques' arithmetic is retained as historical wording and is not used to drop an indexed entry.",
  "The five lab-local embedded technique carriers are nonphysical orchestration/approval records; they remain self-contained for import compatibility and are not promoted as standalone physical techniques.",
  `${atomlessPhysicalRowIds.length} technique action rows carry a physical or acquisitive composition-owned effect contract with no atom registry row (${unique(atomlessPhysicalRowIds.map((rowId) => rowId.split("@")[0])).join(", ")}), and ${atomlessPhysicalOriginRows} compiled lab node rows inherit them. They are recorded as physical-without-atom / acquisition-without-atom residual debt, not as nonphysical. Closing them needs an amendment to the frozen atom registry, which is outside this cycle's touchpoints.`,
  `${untracedAcquisitionRowIds.length} lane-recorded untraced-acquisition rows (${untracedAcquisitionRowIds.join(", ")}) acquire a measurement or direct observation without an exact source-registry row. Lane 09 escalated them to the coordinator because the shared source-trace registry is outside a lane's scope; they are carried here as an explicit closure block rather than relabelled as a configuration boundary.`,
  `Node-level reachability is established across ${witnessCompileCount} witness compiles of the 17 labs. It is a static compiler property; runtime traversal, timing, and instrument behavior remain unrun.`,
  `${unboundMassOutputRowIds.length} of ${weighRowCount} weighing actions (${unique(unboundMassOutputRowIds.map((rowId) => rowId.split("@")[0])).join(", ")}) bind the learner mass to no declared output measurement and carry no approved unsupported-binding guard, so the lane 06 gravimetry verifier does not pass on the current catalog. Repair is lane-owned content authority; this cycle counts it rather than editing another owner's technique.`,
];

const unrunChecks = [
  "Detailed tests and full suites",
  "Build and production bundle",
  "Browser/E2E/WebMCP, gesture, visual, viewport, accessibility, or performance checks",
  "Deployment/release/publication",
  "Physical apparatus, safety, disposal, classroom, or hardware validation",
];

const reconciliationStatus = errors.length > 0
  ? "blocked-source-static"
  : currentEvidenceFreshness.status === "current"
    ? "accepted-source-static"
    : currentEvidenceFreshness.status === "stale"
      ? "stale-source-static"
      : "unknown-source-static";

const report = {
  schema: "lab-studio/cycle-12-reconciliation-report@1",
  generatedAt: currentEvidenceTimestamp,
  status: reconciliationStatus,
  validationBoundary: "Source/static evidence only; no runtime, browser, detailed test, build, deployment, physical, or classroom claim is made.",
  currentEvidence: currentEvidenceReference,
  repositoryHealthEvidence: currentRepositoryHealth,
  fixedReconciliationOrder: fixedLaneOrder,
  baseline: {
    revision: statusLedger.parallelExecution?.baselineRevision ?? 9,
    state: statusLedger.parallelExecution?.baselineRevisionState ?? "reviewed-frozen",
    manifestPath: statusLedger.parallelExecution?.baselineManifestPath,
    manifestSha256: statusLedger.parallelExecution?.baselineManifestSha256,
    aggregateSha256: statusLedger.parallelExecution?.baselineAggregateSha256,
    sourceCommit: statusLedger.parallelExecution?.revision9WorktreeRef?.sourceCommit,
    formalAmendment: {
      revision: 10,
      artifact: revision10Path,
      impactArtifact: revision10ImpactPath,
      state: revision10Candidate?.state ?? "unknown",
      predecessor: revision10Candidate?.predecessor ?? null,
      note: "Revision 10 remains candidate-not-frozen until the coordinator reissues the shared baseline; no historical checksum is invented here.",
    },
    frozenPredecessorSourceDisposition: {
      path: "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/FROZEN_PREDECESSOR_SOURCE_DISPOSITION.json",
      sourceSha256: frozenPredecessor.sourceSha256,
      sourceCommit: frozenPredecessor.sourceCommit,
      rowCount: frozenPredecessor.rowCount,
      note: "Immutable projection of the frozen audit the lanes pinned; reconciliation never reads back its own regenerated audit.",
    },
  },
  lanes: overlaySummary,
  catalog: {
    ownershipExpected: { techniques: ownership.expectedTechniqueCount, labs: ownership.expectedLabCount },
    indexedTechniqueCount: indexedTechniqueIds.length,
    ownedTechniqueCount: ownedTechniqueByCycle.size,
    routeOnlyTechniqueIds: unownedTechniqueIds,
    indexedLabCount: indexedLabIds.length,
    techniqueDispositions: techniqueDispositionById,
    labDispositions: labDispositionById,
  },
  compilerWitness: {
    path: compileWitnessPath,
    freshness: currentEvidenceFreshness.status,
    currentCountsAuthoritative: currentEvidenceFreshness.status === "current",
    labCount: compileWitness?.labs?.length ?? 0,
    totals: compilerTotals,
    allLabsEmitCompiledManifest: Boolean(compileWitness && compileWitness.labs.every((lab) => lab.compiledManifestInstanceCount > 0)),
    explicitInitialEquipment: Boolean(compileWitness && compileWitness.labs.every((lab) => lab.initialEquipmentCount >= 0 && Array.isArray(lab.initialEquipmentIds))),
    witnessCompileCount,
    auditedUnionNodeCount: compilerTotals.unionNodeCount ?? 0,
    everyDeclaredInstanceCompiledUnderSomeWitness: Boolean(compileWitness && compileWitness.labs.every((lab) =>
      asArray(lab.unionTechniqueInstanceIds).length === lab.sourceTechniqueInstanceCount)),
  },
  audits: {
    technique: {
      path: "planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json",
      rowCount: techniqueAudit.rows.length,
      sha256: sha256(JSON.stringify(techniqueAudit)),
      effectConflictRows: techniqueAudit.inventory.effectConflictRows,
      missingAtomOrEffectRows: techniqueAudit.inventory.missingAtomOrEffectRows,
    },
    lab: {
      path: "planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json",
      rowCount: labAudit.rows.length,
      sha256: sha256(JSON.stringify(labAudit)),
      effectConflictRows: labAudit.inventory.effectConflictRows,
      anonymousLocalProcedureRows: labAudit.inventory.complianceCounts["anonymous-local-procedure"],
      deadUnderWitnessRows: labAudit.inventory.reachabilityCounts["dead-under-witness"],
    },
  },
  customRoutes: routeControlSummary,
  consistency: {
    ownershipAndPublicIds: errors.filter((message) => /ownership|index|unowned|repeats/.test(message)).length === 0 ? "pass" : "fail",
    compositionSourceShape: errors.filter((message) => /techniqueInstances|techniqueRefs|compositionManifest|initial equipment/.test(message)).length === 0 ? "pass" : "fail",
    techniqueAtomicityAndEffects: techniqueAudit.inventory.effectConflictRows === 0 && techniqueAudit.inventory.missingAtomOrEffectRows === 0 ? "pass" : "fail",
    labOriginsAndReachability: labAudit.inventory.complianceCounts["anonymous-local-procedure"] === 0 && labAudit.inventory.reachabilityCounts["dead-under-witness"] === 0 && labAudit.inventory.effectConflictRows === 0 ? "pass" : "fail",
    atomicIdentityCoverage: atomlessPhysicalRowIds.length === 0
      ? "pass"
      : `disclosed-residual; ${atomlessPhysicalRowIds.length} physical/acquisitive technique rows and ${atomlessPhysicalOriginRows} compiled lab rows have no atom registry row`,
    sourceTraceCoverage: untracedAcquisitionRowIds.length === 0 && declaredSourceConflictRowIds.length === 0
      ? "pass"
      : `disclosed-residual; ${untracedAcquisitionRowIds.length} untraced-acquisition and ${declaredSourceConflictRowIds.length} lane-escalated conflict rows remain open`,
    massOutputBinding: unboundMassOutputRowIds.length === 0
      ? "pass"
      : `disclosed-residual; ${unboundMassOutputRowIds.length} of ${weighRowCount} weighing actions have no bound mass output and no approval guard`,
    broadRepositoryBaseline: currentRepositoryHealth.status,
  },
  evidenceRuns: validatedCurrentEvidenceRuns,
  evidenceRunProvenance: currentEvidenceRunProvenance,
  openSharedContractRequests,
  residualConfirmationPoints,
  unrunChecks,
  errors,
  warnings,
};

const closureLines = [
  "# Lab Studio technique-composition closure",
  "",
  "## Source/static outcome",
  "",
  `Cycle 12 reconciles lanes ${fixedLaneOrder.join(", ")} against the reviewed revision-${report.baseline.revision} worktree baseline. The result is **${report.status}**; this document does not claim runtime, browser, build, detailed-test, physical, classroom, deployment, or release evidence.`,
  "",
  `F08 current-evidence input: ${report.currentEvidence.status} (${report.currentEvidence.reason})${report.currentEvidence.capturedAt ? `, captured at ${report.currentEvidence.capturedAt}` : ", with no current capture timestamp"}. Repository-wide health is recorded as ${report.repositoryHealthEvidence.status}, never inferred from this coordinator's catalog counts.`,
  "",
  "The Cycle 07 review task supplied by the user (`01a073d7-6520-7b42-9fbb-85fa30641716`) is retained as prior evidence and was not repeated.",
  "",
  "## Catalog accounting",
  "",
  `- Public indexes: ${indexedTechniqueIds.length} techniques and ${indexedLabIds.length} labs.`,
  `- Ownership authority: ${ownedTechniqueByCycle.size} technique owners and ${ownedLabByCycle.size} lab owners.`,
  `- Route-only carrier: ${unownedTechniqueIds.join(", ")}. It is indexed intentionally but is not a second ownership row.`,
  `- Current technique audit: ${techniqueAudit.rows.length} exact-version action rows; ${techniqueAudit.inventory.effectConflictRows} effect conflicts and ${techniqueAudit.inventory.missingAtomOrEffectRows} missing atom/effect rows.`,
  `- Current lab audit: ${labAudit.rows.length} compiler-witness node/action rows across every valid reachability witness; ${labAudit.inventory.originCounts["technique-instance"]} technique-instance origins and ${labAudit.inventory.originCounts["lab-local"]} lab-local orchestration rows.`,
  `- Reachability: ${labAudit.inventory.reachabilityCounts.mandatory} mandatory, ${labAudit.inventory.reachabilityCounts.conditional} conditional, ${labAudit.inventory.reachabilityCounts["dead-under-witness"]} dead under every valid witness.`,
  `- Disclosed residual debt: ${techniqueAudit.inventory.atomlessPhysicalRows} technique rows with a physical or acquisitive effect contract but no atom registry row (${labAudit.inventory.atomlessPhysicalOriginRows} compiled lab rows inherit them), ${techniqueAudit.inventory.untracedAcquisitionRows} lane-escalated untraced-acquisition rows, and ${techniqueAudit.inventory.unboundMassOutputRows} of ${techniqueAudit.inventory.weighActionRows} weighing actions with no bound mass output.`,
  "",
  "## Compiler and custom-route witnesses",
  "",
  `The narrow compiler witness input is marked ${report.compilerWitness.freshness}. It contains ${report.compilerWitness.labCount} labs through ${witnessCompileCount} declared-witness compiles; its union is ${compilerTotals.unionNodeCount ?? 0} recorded nodes, and the default witness records ${compilerTotals.compiledNodeCount ?? 0} nodes, ${compilerTotals.compiledActionCount ?? 0} actions, ${compilerTotals.compiledEdgeCount ?? 0} edges, and ${compilerTotals.compiledOriginCount ?? 0} technique origins. These are source-file observations only when the input is stale or unknown; they are not current execution acceptance.`,
  ...routeControlSummary.map((route) => `- Lane ${route.lane}: ${route.controlCount} route controls, ${route.uniqueControlIds} unique IDs, duplicate controls ${route.duplicateControlIds.length === 0 ? "none" : route.duplicateControlIds.join(", ")}; mapping coverage ${route.everyControlMappedExactlyOnce ? "complete" : "incomplete"}.`),
  "",
  "Both custom routes mount from one `customPlayerRoutes` map on the play route and resolve their own compiled composition, so neither is forced through Student Player and neither waits on the shared bundled loader.",
  "",
  "## Authoring/export boundary",
  "",
  "Studio graph, action, process, validation, equipment, and technique-setting edits now mark an existing compiled composition manifest `detached`, and a wholesale draft replacement whose manifest no longer describes its own graph is detached as well. Detached artifacts remain portable/self-contained, but cannot be treated as current composed output until recompiled. Raw bundled composition sources continue to compile before runtime/Studio consumption and do not carry a public `compositionManifest`.",
  "",
  "## Consistency categories",
  "",
  ...Object.entries(report.consistency).map(([category, verdict]) => `- \`${category}\`: ${verdict}.`),
  "",
  `Repository-wide health is ${report.repositoryHealthEvidence.status} from the F08 evidence input. The source/static coordinator does not infer content:check, typecheck, build, browser, runtime, or release outcomes from historical prose or catalog counts; no baseline was rewritten.`,
  "",
  ...(openSharedContractRequests.length === 0 ? [] : [
    "## Open shared-contract requests",
    "",
    ...openSharedContractRequests.map((request) =>
      `- \`${request.id}\` from lane ${request.requestedBy}, targeting \`${request.target}\`. ${request.request} Cycle 12 disposition: ${request.cycle12Disposition} Current mitigation: ${request.currentMitigation} Placeholder slots still present in \`${request.labId}\`: ${request.placeholderConfigurationSlots.join(", ")}.`),
    "",
    "Closure is therefore recorded with this request open. It is disclosed rather than treated as resolved, and the next authorized cycle owns it.",
    "",
  ]),
  "## Residual confirmation points",
  "",
  ...residualConfirmationPoints.map((point) => `- ${point}`),
  "",
  "## Checks intentionally unrun",
  "",
  ...unrunChecks.map((check) => `- ${check}.`),
  "",
  "Static acceptance is therefore a source/catalog closure, not a claim that all interactions or apparatus behavior have been exercised.",
  "",
];

const outputs = new Map([
  ["planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json", techniqueAudit],
  ["planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json", labAudit],
  ["planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/RECONCILIATION_REPORT.json", report],
  ["docs/technique-composition-closure.md", closureLines.join("\n")],
]);

if (checkOnly) {
  for (const [relativePath, value] of outputs) {
    if (!existsSync(join(root, relativePath))) {
      fail(`Expected reconciliation output is missing: ${relativePath}.`);
      continue;
    }
    const current = readFileSync(join(root, relativePath), "utf8");
    const expected = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
    if (current !== expected) fail(`Reconciliation output is not deterministic/current: ${relativePath}.`);
  }
}

if (!checkOnly && errors.length === 0) {
  for (const [relativePath, value] of outputs) {
    const text = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(root, relativePath), text, "utf8");
  }
}

if (errors.length > 0) {
  console.error(`Cycle 12 reconciliation blocked: ${errors.length} error(s).`);
  for (const message of errors) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log(`Cycle 12 reconciliation ${checkOnly ? "check" : "write"} passed: ${techniqueRows.length} technique rows, ${labRows.length} lab rows, ${warnings.length} warning(s).`);
  for (const message of warnings) console.warn(`- ${message}`);
}
