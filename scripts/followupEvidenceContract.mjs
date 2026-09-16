/**
 * Pure F08 evidence-contract helpers.
 *
 * This module deliberately has no filesystem, application, compiler, checker, or runtime
 * dependency. Callers provide observed files and parsed records. That keeps source-identity
 * authoring and later reconciliation on the same bounded validation rules without turning a
 * static evidence helper into an evaluator.
 */

import { createHash } from "node:crypto";

export const F08_CONTRACT_VERSION = "lab-studio/f08-evidence-contract@2";
export const F08_SOURCE_IDENTITY_SCHEMA = "lab-studio/f08-source-identity@2";
export const F08_STABLE_SOURCE_SNAPSHOT_SCHEMA = "lab-studio/f08-stable-source-snapshot@2";
export const F08_RECONCILIATION_INPUT_SCHEMA = "lab-studio/f08-reconciliation-inputs@2";
export const F08_CURRENT_VERIFICATION_RUN_SCHEMA = "lab-studio/f08-current-verification-run@1";
export const F08_CURRENT_VERIFICATION_SOURCE_SNAPSHOT_SCHEMA = "lab-studio/f08-current-verification-source-snapshot@1";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const F08_FOLLOWUP_PLAN_ROOT = "planning/2026-09-08_catalog-fidelity-follow-up";
const F08_EVIDENCE_ROOT = `${F08_FOLLOWUP_PLAN_ROOT}/evidence`;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => Array.isArray(value) ? value : [];
const sorted = (values) => [...values].sort((left, right) => String(left).localeCompare(String(right)));

export const canonicalJson = (value) => JSON.stringify(value);
export const sha256Text = (value) => createHash("sha256").update(String(value)).digest("hex");
export const sha256Bytes = (value) => createHash("sha256").update(value).digest("hex");

export const normalizeEvidencePath = (value) => {
  if (typeof value !== "string") return { ok: false, reason: "path is not a string" };
  if (!value || value !== value.trim()) return { ok: false, reason: "path is empty or has surrounding whitespace" };
  if (value.includes("\\")) return { ok: false, reason: "path uses a backslash instead of canonical slash separators" };
  if (value.startsWith("/") || value.startsWith("//") || /^[A-Za-z]:/.test(value)) return { ok: false, reason: "path is absolute" };
  if (value.startsWith("./") || value.endsWith("/") || value.includes("//")) return { ok: false, reason: "path is not canonical" };
  if (value.includes("\u0000") || value.includes(":")) return { ok: false, reason: "path has a prohibited character" };
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return { ok: false, reason: "path escapes or has an empty segment" };
  return { ok: true, path: value };
};

export const stableSourceIdentityPolicy = Object.freeze({
  version: F08_CONTRACT_VERSION,
  domain: "candidate-application-source-and-accepted-evidence",
  excludedDirectoryNames: [".git", ".playwright-mcp", "dist", "dist-server", "node_modules", "test-results", "tmp"],
  protectedUninspectedPrefix: "hand_warmer/hand-warmer-calorimetry-phase16-complete-2026-07-27/phase7-work",
  mutableCoordinationPaths: [
    `${F08_FOLLOWUP_PLAN_ROOT}/ORCHESTRATION_STATUS.json`,
    `${F08_EVIDENCE_ROOT}/REMAINING_LUNA_ORCHESTRATION.md`,
  ],
  f08ReviewIntegrationNamespace: {
    directory: F08_EVIDENCE_ROOT,
    fileNamePattern: "^F08_[A-Z0-9_]+_ROOT(?:_CRITICAL)?_(?:REVIEW|INTEGRATION)\\.(?:md|json)$",
    purpose: "Bounded parent review/integration bookkeeping for this F08 package; it is observed separately and is not a source prerequisite.",
  },
  nonruntimePreparationBoundary: {
    exactFilePaths: [
      "Lab_Studio_GPT_Pro_MCP_Handoff_2026-07-17.zip",
      "Lab_Studio_Maintainable_Source_Handoff_2026-07-26.zip",
      "Lab_Studio_Scientific_Simulator_Handoff_2026-07-14.zip",
      "Refined_Implementation_Plan_2026-07-18.zip",
      "hand_warmer/hand-warmer-calorimetry-phase16-complete-2026-07-27.zip",
      "tsconfig.app.tsbuildinfo",
      "tsconfig.learning.tsbuildinfo",
      "tsconfig.node.tsbuildinfo",
    ],
    purpose: "Finite candidate-preparation boundary for eight known nonruntime handoff archives and generated compiler caches observed by the parent in authority but absent from this candidate. This is not an archive or cache-extension exclusion; every other path remains subject to stable-source identity.",
  },
  generatedEvidencePaths: [
    `${F08_EVIDENCE_ROOT}/f08-current/CLOSURE.json`,
    `${F08_EVIDENCE_ROOT}/f08-current/CLOSURE.md`,
    `${F08_EVIDENCE_ROOT}/f08-current/CATALOG_DISPOSITIONS.json`,
    `${F08_EVIDENCE_ROOT}/f08-current/SOURCE_IDENTITY.json`,
  ],
});

const CURRENT_VERIFICATION_RUN_ROOT = `${F08_EVIDENCE_ROOT}/f08-current-runs`;
const CURRENT_VERIFICATION_RUN_FILE = "CURRENT_VERIFICATION_RUN.json";

/**
 * These are the only generated outputs that a fresh Batch 3 run may replace.  They are excluded
 * from the new run's source snapshot only because their own phase receipts record predecessor,
 * input, output, and command identity.  The legacy F08 source policy deliberately remains
 * unchanged so its frozen record stays interpretable as historical evidence.
 */
export const currentVerificationPhaseSpecification = Object.freeze([
  Object.freeze({
    id: "cycle12-compiler-witness",
    sequence: "core",
    command: "node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/collectCycle12CompileWitness.mjs",
    requiredInputPaths: ["scripts/collectCycle12CompileWitness.mjs"],
    outputPaths: ["planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json"],
    prerequisitePhaseIds: [],
  }),
  Object.freeze({
    id: "cycle12-reconciliation",
    sequence: "core",
    command: "node scripts/reconcileCycle12Catalog.mjs --current-evidence-run <run-id>",
    requiredInputPaths: [
      "scripts/reconcileCycle12Catalog.mjs",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/source-trace-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/technique-atomicity-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/lab-composition-overlay.json",
    ],
    outputPaths: [
      "planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/RECONCILIATION_REPORT.json",
      "docs/technique-composition-closure.md",
    ],
    prerequisitePhaseIds: ["cycle12-compiler-witness"],
  }),
  Object.freeze({
    id: "cycle09-overlay-refresh",
    sequence: "core",
    command: "node scripts/documentCycle09Composition.mjs",
    requiredInputPaths: [
      "scripts/documentCycle09Composition.mjs",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json",
    ],
    outputPaths: [
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/source-trace-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/technique-atomicity-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/lab-composition-overlay.json",
    ],
    prerequisitePhaseIds: ["cycle12-reconciliation"],
  }),
  Object.freeze({
    id: "cycle09-overlay-check",
    sequence: "core",
    command: "node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/checkCycle09Composition.mjs",
    requiredInputPaths: [
      "scripts/checkCycle09Composition.mjs",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/source-trace-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/technique-atomicity-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/lab-composition-overlay.json",
    ],
    outputPaths: [],
    prerequisitePhaseIds: ["cycle09-overlay-refresh"],
  }),
  Object.freeze({
    id: "cycle12-reconciliation-check",
    sequence: "core",
    command: "node scripts/reconcileCycle12Catalog.mjs --check --current-evidence-run <run-id>",
    requiredInputPaths: [
      "scripts/reconcileCycle12Catalog.mjs",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/RECONCILIATION_REPORT.json",
      "docs/technique-composition-closure.md",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/source-trace-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/technique-atomicity-overlay.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-09/lab-composition-overlay.json",
    ],
    outputPaths: [],
    prerequisitePhaseIds: ["cycle12-compiler-witness", "cycle12-reconciliation", "cycle09-overlay-refresh", "cycle09-overlay-check"],
  }),
  Object.freeze({
    id: "repository-content-check",
    sequence: "supplemental",
    command: "node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs scripts/checkContentConsistency.mjs --compiled",
    requiredInputPaths: ["scripts/checkContentConsistency.mjs"],
    outputPaths: [],
    prerequisitePhaseIds: [],
  }),
  Object.freeze({
    id: "cycle12-static-verifier",
    sequence: "supplemental",
    command: "node scripts/verifyCycle12ScientificActivities.mjs --json",
    requiredInputPaths: [
      "scripts/verifyCycle12ScientificActivities.mjs",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/TECHNIQUE_ATOMICITY_AUDIT.json",
      "planning/2026-08-30_lab-studio-technique-composition-remediation/LAB_COMPOSITION_AUDIT.json",
    ],
    outputPaths: [],
    prerequisitePhaseIds: ["cycle12-reconciliation"],
  }),
]);

const currentVerificationPhaseById = new Map(currentVerificationPhaseSpecification.map((phase) => [phase.id, phase]));
export const currentVerificationPhaseOutputPaths = Object.freeze([...new Set(currentVerificationPhaseSpecification.flatMap((phase) => phase.outputPaths))]);

export const currentVerificationOutputPolicy = Object.freeze({
  version: F08_CONTRACT_VERSION,
  domain: "candidate-application-source-and-accepted-evidence-with-explicit-current-phase-outputs-recorded-separately",
  baseStableSourcePolicy: stableSourceIdentityPolicy,
  phaseOutputPaths: currentVerificationPhaseOutputPaths,
  artifactNamespace: {
    directory: CURRENT_VERIFICATION_RUN_ROOT,
    runIdPattern: "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$",
    runFileName: CURRENT_VERIFICATION_RUN_FILE,
    purpose: "Explicit generated current-verification receipts. Only the named record, fixed predecessor copies, and fixed phase logs are excluded; unexpected files remain source inputs.",
  },
});

const f08ReviewIntegrationRecordPattern = new RegExp(stableSourceIdentityPolicy.f08ReviewIntegrationNamespace.fileNamePattern);
const isF08ReviewIntegrationRecord = (path) => {
  const namespace = stableSourceIdentityPolicy.f08ReviewIntegrationNamespace;
  if (!path.startsWith(`${namespace.directory}/`)) return false;
  const fileName = path.slice(namespace.directory.length + 1);
  return !fileName.includes("/") && f08ReviewIntegrationRecordPattern.test(fileName);
};

export const stableDomainExclusion = (relativePath, kind = "file") => {
  const normalized = normalizeEvidencePath(relativePath);
  if (!normalized.ok) return `invalid-path:${normalized.reason}`;
  const path = normalized.path;
  const leaf = path.split("/").at(-1);
  if (kind === "directory" && stableSourceIdentityPolicy.excludedDirectoryNames.includes(leaf)) return "excluded-generated-or-dependency-directory";
  if (path === stableSourceIdentityPolicy.protectedUninspectedPrefix || path.startsWith(`${stableSourceIdentityPolicy.protectedUninspectedPrefix}/`)) return "protected-nested-backup-not-recursively-inspected";
  if (stableSourceIdentityPolicy.mutableCoordinationPaths.includes(path)) return "mutable-coordination-bookkeeping";
  if (isF08ReviewIntegrationRecord(path)) return "f08-parent-review-or-integration-bookkeeping";
  if (stableSourceIdentityPolicy.generatedEvidencePaths.includes(path)) return "self-generated-f08-evidence";
  if (kind === "file" && stableSourceIdentityPolicy.nonruntimePreparationBoundary.exactFilePaths.includes(path)) return "finite-nonruntime-preparation-boundary";
  return null;
};

export const normalizeCurrentVerificationRunId = (value) => {
  if (typeof value !== "string") return { ok: false, reason: "run id is not a string" };
  if (!value || value !== value.trim()) return { ok: false, reason: "run id is empty or has surrounding whitespace" };
  const pattern = new RegExp(currentVerificationOutputPolicy.artifactNamespace.runIdPattern);
  if (!pattern.test(value)) return { ok: false, reason: "run id must use lowercase letters, digits, and interior hyphens only" };
  return { ok: true, runId: value };
};

export const currentVerificationRunPath = (runId) => {
  const normalized = normalizeCurrentVerificationRunId(runId);
  return normalized.ok ? `${CURRENT_VERIFICATION_RUN_ROOT}/${normalized.runId}/${CURRENT_VERIFICATION_RUN_FILE}` : null;
};

const currentVerificationPredecessorSourceIndex = new Map(currentVerificationPhaseOutputPaths.map((path, index) => [path, index]));
const currentVerificationPredecessorFileName = (sourcePath) => {
  const index = currentVerificationPredecessorSourceIndex.get(sourcePath);
  if (index === undefined) return null;
  return `${String(index + 1).padStart(2, "0")}-${sourcePath.split("/").at(-1)}`;
};

export const currentVerificationPredecessorCopyPath = (runId, sourcePath) => {
  const recordPath = currentVerificationRunPath(runId);
  const fileName = currentVerificationPredecessorFileName(sourcePath);
  return recordPath && fileName ? `${recordPath.slice(0, -CURRENT_VERIFICATION_RUN_FILE.length)}predecessors/${fileName}` : null;
};

export const currentVerificationPhaseLogPath = (runId, phaseId) => {
  const recordPath = currentVerificationRunPath(runId);
  return recordPath && currentVerificationPhaseById.has(phaseId)
    ? `${recordPath.slice(0, -CURRENT_VERIFICATION_RUN_FILE.length)}logs/${phaseId}.log`
    : null;
};

export const currentVerificationArtifactPaths = (runId) => {
  const recordPath = currentVerificationRunPath(runId);
  if (!recordPath) return [];
  return [
    recordPath,
    ...currentVerificationPhaseOutputPaths.map((path) => currentVerificationPredecessorCopyPath(runId, path)),
    ...currentVerificationPhaseSpecification.map((phase) => currentVerificationPhaseLogPath(runId, phase.id)),
  ];
};

const isCurrentVerificationArtifact = (path) => {
  const prefix = `${CURRENT_VERIFICATION_RUN_ROOT}/`;
  if (!path.startsWith(prefix)) return false;
  const suffix = path.slice(prefix.length);
  const [runId, ...tailSegments] = suffix.split("/");
  if (!normalizeCurrentVerificationRunId(runId).ok || tailSegments.length === 0) return false;
  return currentVerificationArtifactPaths(runId).includes(path);
};

export const currentVerificationStableDomainExclusion = (relativePath, kind = "file") => {
  const legacyExclusion = stableDomainExclusion(relativePath, kind);
  if (legacyExclusion) return legacyExclusion;
  const normalized = normalizeEvidencePath(relativePath);
  if (!normalized.ok) return `invalid-path:${normalized.reason}`;
  if (kind === "file" && currentVerificationPhaseOutputPaths.includes(normalized.path)) return "current-verification-phase-output-recorded-separately";
  if (kind === "file" && isCurrentVerificationArtifact(normalized.path)) return "self-generated-current-verification-artifact";
  return null;
};

export const getCurrentVerificationPhase = (phaseId) => currentVerificationPhaseById.get(phaseId) ?? null;

const normalizePathList = (values, label) => {
  const paths = [];
  const errors = [];
  const seen = new Set();
  for (const value of asArray(values)) {
    const normalized = normalizeEvidencePath(value);
    if (!normalized.ok) {
      errors.push(`${label}: ${normalized.reason}`);
      continue;
    }
    if (seen.has(normalized.path)) {
      errors.push(`${label}: duplicate path ${normalized.path}`);
      continue;
    }
    seen.add(normalized.path);
    paths.push(normalized.path);
  }
  return { paths: sorted(paths), errors };
};

const normalizeFileRecord = (entry, label) => {
  const path = normalizeEvidencePath(entry?.path);
  if (!path.ok) return { error: `${label}: ${path.reason}` };
  if (!Number.isSafeInteger(entry?.bytes) || entry.bytes < 0) return { error: `${label}: ${path.path} has an invalid byte count` };
  if (typeof entry?.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256)) return { error: `${label}: ${path.path} has an invalid SHA-256` };
  return { record: { path: path.path, sha256: entry.sha256, bytes: entry.bytes } };
};

const normalizeFileRecordList = (entries, label) => {
  const records = [];
  const errors = [];
  const seen = new Set();
  if (!Array.isArray(entries)) return { records, errors: [`${label}: requiredFiles is not an array`] };
  for (const entry of entries) {
    const normalized = normalizeFileRecord(entry, label);
    if (normalized.error) {
      errors.push(normalized.error);
      continue;
    }
    if (seen.has(normalized.record.path)) {
      errors.push(`${label}: duplicate required file ${normalized.record.path}`);
      continue;
    }
    seen.add(normalized.record.path);
    records.push(normalized.record);
  }
  return { records: records.sort((left, right) => left.path.localeCompare(right.path)), errors };
};

const normalizeFileMap = (files, label) => {
  const normalized = {};
  const errors = [];
  if (!isObject(files)) return { files: normalized, errors: [`${label}: files is not an object`] };
  for (const rawPath of sorted(Object.keys(files))) {
    const path = normalizeEvidencePath(rawPath);
    if (!path.ok) {
      errors.push(`${label}: ${path.reason}`);
      continue;
    }
    const record = files[rawPath];
    if (!Number.isSafeInteger(record?.bytes) || record.bytes < 0) {
      errors.push(`${label}: ${path.path} has an invalid byte count`);
      continue;
    }
    if (typeof record?.sha256 !== "string" || !SHA256_PATTERN.test(record.sha256)) {
      errors.push(`${label}: ${path.path} has an invalid SHA-256`);
      continue;
    }
    normalized[path.path] = { sha256: record.sha256, bytes: record.bytes };
  }
  return { files: normalized, errors };
};

const sortedObject = (value) => Object.fromEntries(sorted(Object.keys(value ?? {})).map((key) => [key, value[key]]));

export const buildStableSourceSnapshotPayload = ({ files }) => ({
  schema: F08_STABLE_SOURCE_SNAPSHOT_SCHEMA,
  contractVersion: F08_CONTRACT_VERSION,
  domain: stableSourceIdentityPolicy.domain,
  policy: stableSourceIdentityPolicy,
  files: sortedObject(files),
});

export const makeStableSourceSnapshot = ({ files, status = "current-stable-source-snapshot" }) => {
  const payload = buildStableSourceSnapshotPayload({ files });
  return {
    schema: F08_STABLE_SOURCE_SNAPSHOT_SCHEMA,
    status,
    fileCount: Object.keys(payload.files).length,
    payloadSha256: sha256Text(canonicalJson(payload)),
    domain: payload.domain,
    policy: payload.policy,
    files: payload.files,
  };
};

export const buildCurrentVerificationSourceSnapshotPayload = ({ files }) => ({
  schema: F08_CURRENT_VERIFICATION_SOURCE_SNAPSHOT_SCHEMA,
  contractVersion: F08_CONTRACT_VERSION,
  domain: currentVerificationOutputPolicy.domain,
  policy: currentVerificationOutputPolicy,
  files: sortedObject(files),
});

export const makeCurrentVerificationSourceSnapshot = ({ files, status = "current-current-verification-source-snapshot" }) => {
  const payload = buildCurrentVerificationSourceSnapshotPayload({ files });
  return {
    schema: F08_CURRENT_VERIFICATION_SOURCE_SNAPSHOT_SCHEMA,
    status,
    fileCount: Object.keys(payload.files).length,
    payloadSha256: sha256Text(canonicalJson(payload)),
    domain: payload.domain,
    policy: payload.policy,
    files: payload.files,
  };
};

export const buildReconciliationInputPayload = ({ requiredFiles, missingRequiredPaths, optionalMissingPaths, staleInputPaths, staleInputReasons, historicalInputPaths }) => {
  const normalizedRequired = normalizeFileRecordList(requiredFiles, "reconciliationInputs").records;
  const normalizedMissing = normalizePathList(missingRequiredPaths, "reconciliationInputs.missingRequiredPaths").paths;
  const normalizedOptional = normalizePathList(optionalMissingPaths, "reconciliationInputs.optionalMissingPaths").paths;
  const normalizedStale = normalizePathList(staleInputPaths, "reconciliationInputs.staleInputPaths").paths;
  const normalizedHistorical = normalizePathList(historicalInputPaths, "reconciliationInputs.historicalInputPaths").paths;
  const reasons = {};
  if (isObject(staleInputReasons)) {
    for (const path of normalizedStale) {
      if (typeof staleInputReasons[path] === "string" && staleInputReasons[path]) reasons[path] = staleInputReasons[path];
    }
  }
  return {
    schema: F08_RECONCILIATION_INPUT_SCHEMA,
    contractVersion: F08_CONTRACT_VERSION,
    requiredFiles: normalizedRequired,
    missingRequiredPaths: normalizedMissing,
    optionalMissingPaths: normalizedOptional,
    staleInputPaths: normalizedStale,
    staleInputReasons: sortedObject(reasons),
    historicalInputPaths: normalizedHistorical,
  };
};

/**
 * Produces the same direct-input set for authoring and reconciliation. `availablePaths` is the
 * caller's current stable-domain inventory, so optional lane artifacts remain optional while any
 * addition/removal is still caught by the full stable snapshot contract. A direct input may not
 * be an excluded bookkeeping record: the shared stable-domain policy is the contract boundary.
 */
export const deriveReconciliationInputSpecification = ({ oldPlanRoot, followupPlanRoot, techniqueIndex, labIndex, availablePaths, acceptedDependencyPaths = [] }) => {
  const available = availablePaths instanceof Set ? availablePaths : new Set(asArray(availablePaths));
  const required = new Set([
    "scripts/reconcileCycle12Catalog.mjs",
    "scripts/followupEvidenceContract.mjs",
    `${followupPlanRoot}/REFINED_IMPLEMENTATION_PLAN.md`,
    `${followupPlanRoot}/evidence/F08_PREPARATION.md`,
    `${followupPlanRoot}/evidence/F03_FINAL_STRICT_ROOT_REVIEW.md`,
    `${followupPlanRoot}/evidence/F03_FINAL_STRICT_ROOT_INTEGRATION.json`,
    `${followupPlanRoot}/evidence/F05_REMAINING_ROOT_REVIEW.md`,
    `${followupPlanRoot}/evidence/F06_COMPLETION.md`,
    `${followupPlanRoot}/evidence/F07_PHASE1_ROOT_REVIEW.md`,
    `${followupPlanRoot}/evidence/F07_PHASE2_ROOT_REVIEW.md`,
    `${followupPlanRoot}/F04_FINAL_CLOSURE_REPORT.md`,
    `${oldPlanRoot}/CATALOG_OWNERSHIP.json`,
    `${oldPlanRoot}/_CYCLE_STATUS.json`,
    "public/techniques/index.json",
    "public/labs/index.json",
    "public/labs/acid-base-titration-curves-config.json",
    "public/techniques/thermal-decomposition-mass-loss.json",
    "src/domain/atomRegistry.json",
    "docs/architecture/source-trace-registry.json",
    `${oldPlanRoot}/evidence/lane-12/FROZEN_PREDECESSOR_SOURCE_DISPOSITION.json`,
    `${oldPlanRoot}/evidence/lane-12/COMPILED_LAB_WITNESS.json`,
    `${oldPlanRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`,
    `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json`,
    `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json`,
    ...asArray(acceptedDependencyPaths),
  ]);
  for (const entry of asArray(techniqueIndex)) {
    if (typeof entry?.id === "string" && entry.id) required.add(`public/techniques/${entry.file ?? `${entry.id}.json`}`);
  }
  for (const entry of asArray(labIndex)) {
    if (typeof entry?.id === "string" && entry.id) required.add(`public/labs/${entry.file ?? `${entry.id}.json`}`);
  }
  const optionalCandidates = [];
  for (const lane of ["05", "06", "07", "08", "09", "11", "10"]) {
    for (const file of ["source-trace-overlay.json", "technique-atomicity-overlay.json", "lab-composition-overlay.json", "route-control-map.json"]) {
      const path = `${oldPlanRoot}/evidence/lane-${lane}/${file}`;
      optionalCandidates.push(path);
      if (available.has(path)) required.add(path);
    }
  }
  const normalizedRequired = normalizePathList([...required], "derived reconciliation input");
  const normalizedOptional = normalizePathList(optionalCandidates.filter((path) => !available.has(path)), "derived optional reconciliation input");
  const excludedRequiredErrors = normalizedRequired.paths
    .map((path) => ({ path, exclusion: stableDomainExclusion(path, "file") }))
    .filter(({ exclusion }) => exclusion)
    .map(({ path, exclusion }) => `derived reconciliation input ${path} is excluded from the stable source domain (${exclusion})`);
  return {
    requiredPaths: normalizedRequired.paths,
    optionalMissingPaths: normalizedOptional.paths,
    derivationErrors: [...normalizedRequired.errors, ...normalizedOptional.errors, ...excludedRequiredErrors],
  };
};

export const makePayloadSeal = (payload, payloadScope) => ({
  payloadSha256: sha256Text(canonicalJson(payload)),
  payloadScope,
});

const compareFileMaps = (recorded, observed, label) => {
  const mismatches = [];
  for (const path of sorted(Object.keys(recorded))) {
    const actual = observed[path];
    if (!actual) {
      mismatches.push(`${label}: ${path} is missing from the current stable domain`);
      continue;
    }
    if (actual.bytes !== recorded[path].bytes || actual.sha256 !== recorded[path].sha256) {
      mismatches.push(`${label}: ${path} byte identity changed`);
    }
  }
  for (const path of sorted(Object.keys(observed))) {
    if (!recorded[path]) mismatches.push(`${label}: ${path} was added to the current stable domain`);
  }
  return mismatches;
};

const validateStableSourceSnapshot = ({ snapshot, observedFiles }) => {
  const errors = [];
  const mismatches = [];
  if (!isObject(snapshot)) return { errors: ["sourceSnapshot is missing or malformed"], mismatches, payloadSha256: null };
  if (snapshot.schema !== F08_STABLE_SOURCE_SNAPSHOT_SCHEMA) errors.push("sourceSnapshot schema is not the current F08 contract");
  if (snapshot.contractVersion !== undefined) errors.push("sourceSnapshot must not carry an unsealed duplicate contract version");
  if (snapshot.domain !== stableSourceIdentityPolicy.domain) errors.push("sourceSnapshot domain is not the stable application/evidence domain");
  if (canonicalJson(snapshot.policy) !== canonicalJson(stableSourceIdentityPolicy)) errors.push("sourceSnapshot policy does not match the shared stable-domain policy");
  const recorded = normalizeFileMap(snapshot.files, "sourceSnapshot");
  errors.push(...recorded.errors);
  if (snapshot.fileCount !== Object.keys(recorded.files).length) errors.push("sourceSnapshot fileCount does not match its file map");
  const payload = buildStableSourceSnapshotPayload({ files: recorded.files });
  const expectedPayloadSha256 = sha256Text(canonicalJson(payload));
  if (snapshot.payloadSha256 !== expectedPayloadSha256) errors.push("sourceSnapshot payload seal does not match its recorded files and policy");
  if (observedFiles !== undefined) {
    const observed = normalizeFileMap(observedFiles, "observed stable source snapshot");
    errors.push(...observed.errors);
    mismatches.push(...compareFileMaps(recorded.files, observed.files, "sourceSnapshot"));
  }
  return { errors, mismatches, payloadSha256: typeof snapshot.payloadSha256 === "string" ? snapshot.payloadSha256 : null };
};

const validateReconciliationInputs = ({ inputs, expectedRequiredPaths, observedFiles }) => {
  const errors = [];
  const mismatches = [];
  if (!isObject(inputs)) return { errors: ["reconciliationInputs is missing or malformed"], mismatches, payloadSha256: null, missingRequiredPaths: [], staleInputPaths: [] };
  if (inputs.schema !== F08_RECONCILIATION_INPUT_SCHEMA) errors.push("reconciliationInputs schema is not the current F08 contract");
  if (inputs.contractVersion !== F08_CONTRACT_VERSION) errors.push("reconciliationInputs contract version is not current");
  const required = normalizeFileRecordList(inputs.requiredFiles, "reconciliationInputs");
  const missing = normalizePathList(inputs.missingRequiredPaths, "reconciliationInputs.missingRequiredPaths");
  const optional = normalizePathList(inputs.optionalMissingPaths, "reconciliationInputs.optionalMissingPaths");
  const stale = normalizePathList(inputs.staleInputPaths, "reconciliationInputs.staleInputPaths");
  const historical = normalizePathList(inputs.historicalInputPaths, "reconciliationInputs.historicalInputPaths");
  errors.push(...required.errors, ...missing.errors, ...optional.errors, ...stale.errors, ...historical.errors);
  const expected = normalizePathList(expectedRequiredPaths, "expected reconciliation input");
  errors.push(...expected.errors);
  const recordedPaths = new Set([...required.records.map((record) => record.path), ...missing.paths]);
  for (const path of expected.paths) if (!recordedPaths.has(path)) errors.push(`reconciliationInputs omits independently derived required path ${path}`);
  for (const path of recordedPaths) if (!expected.paths.includes(path)) errors.push(`reconciliationInputs declares unexpected required path ${path}`);
  for (const path of required.records.map((record) => record.path)) if (missing.paths.includes(path)) errors.push(`reconciliationInputs repeats ${path} as both present and missing`);
  const expectedCompleteness = missing.paths.length === 0 ? "complete" : "incomplete";
  if (inputs.completeness !== expectedCompleteness) errors.push("reconciliationInputs completeness does not match its required-path coverage");
  const expectedFreshness = stale.paths.length || missing.paths.length ? "stale" : "current";
  if (inputs.freshness !== expectedFreshness) errors.push("reconciliationInputs freshness does not match its stale/missing dependency state");
  const reasonKeys = isObject(inputs.staleInputReasons) ? Object.keys(inputs.staleInputReasons) : [];
  if (!isObject(inputs.staleInputReasons)) errors.push("reconciliationInputs staleInputReasons is not an object");
  for (const path of stale.paths) if (typeof inputs.staleInputReasons?.[path] !== "string" || !inputs.staleInputReasons[path]) errors.push(`reconciliationInputs has no stale reason for ${path}`);
  for (const path of reasonKeys) if (!stale.paths.includes(path)) errors.push(`reconciliationInputs has a stale reason for undeclared path ${path}`);
  const payload = buildReconciliationInputPayload({
    requiredFiles: required.records,
    missingRequiredPaths: missing.paths,
    optionalMissingPaths: optional.paths,
    staleInputPaths: stale.paths,
    staleInputReasons: inputs.staleInputReasons,
    historicalInputPaths: historical.paths,
  });
  const expectedPayloadSha256 = sha256Text(canonicalJson(payload));
  if (inputs.payloadSha256 !== expectedPayloadSha256) errors.push("reconciliationInputs payload seal does not match its recorded dependencies");
  const observed = normalizeFileMap(observedFiles, "observed reconciliation input source");
  errors.push(...observed.errors);
  for (const record of required.records) {
    const actual = observed.files[record.path];
    if (!actual) {
      mismatches.push(`reconciliationInputs: ${record.path} is missing`);
      continue;
    }
    if (actual.sha256 !== record.sha256 || actual.bytes !== record.bytes) mismatches.push(`reconciliationInputs: ${record.path} byte identity changed`);
  }
  for (const path of missing.paths) {
    if (observed.files[path]) mismatches.push(`reconciliationInputs: ${path} is present despite a recorded missing state`);
  }
  return {
    errors,
    mismatches,
    payloadSha256: typeof inputs.payloadSha256 === "string" ? inputs.payloadSha256 : null,
    missingRequiredPaths: missing.paths,
    staleInputPaths: stale.paths,
  };
};

const sourceIdentityMatches = (reference, sourceIdentity) => isObject(reference)
  && reference.sourceSnapshotPayloadSha256 === sourceIdentity.sourceSnapshotPayloadSha256
  && reference.reconciliationInputManifestSha256 === sourceIdentity.reconciliationInputManifestSha256;

const hasObservedEnvironment = (environment) => isObject(environment)
  && ["runtime", "platform", "cwd"].every((key) => typeof environment[key] === "string" && environment[key].trim() && environment[key] !== "not-collected");

const completeCurrentRunProvenanceErrors = (run, label) => {
  const errors = [];
  if (typeof run?.command !== "string" || !run.command.trim()) errors.push(`${label} has no recorded command`);
  if (!hasObservedEnvironment(run?.environment)) errors.push(`${label} has incomplete environment provenance`);
  if (!Array.isArray(run?.inputs)) errors.push(`${label} has no recorded input collection`);
  if (!Array.isArray(run?.outputs)) errors.push(`${label} has no recorded output collection`);
  if (run?.collectionCompleteness !== "complete") errors.push(`${label} collection is not complete`);
  if (run?.exitStatus !== "passed") errors.push(`${label} did not record a passed exit status`);
  if (run?.freshness !== "current") errors.push(`${label} is not explicitly current`);
  if (!isObject(run?.result) || typeof run.result.recordedAt !== "string" || !run.result.recordedAt.trim()
    || typeof run.result.summary !== "string" || !run.result.summary.trim()
    || typeof run.result.outputSha256 !== "string" || !SHA256_PATTERN.test(run.result.outputSha256)) {
    errors.push(`${label} has incomplete result provenance`);
  }
  return errors;
};

const claimsCurrentAcceptance = (run) => run?.status === "complete-current-run"
  || (run?.freshness === "current" && run?.collectionCompleteness === "complete" && run?.exitStatus === "passed");

export const inspectRepositoryHealthEvidence = ({ health, sourceIdentity, sourceStatus = "unknown" }) => {
  const unknown = (reason) => ({ status: "unknown", reason, validation: "not-a-complete-current-run" });
  if (sourceStatus !== "current") return unknown(`Repository-wide health cannot be current while F08 source identity is ${sourceStatus}.`);
  if (!isObject(health)) return unknown("No repository-wide health record is available.");
  const reference = health.sourceIdentity;
  if (!isObject(reference)) return unknown("Repository-wide health has no source-identity reference.");
  if (!sourceIdentityMatches(reference, sourceIdentity)) {
    return unknown("Repository-wide health is not bound to this source identity.");
  }
  if (health.status !== "complete-current-run") {
    return unknown("Repository-wide health is not a specifically complete current run; catalog freshness does not promote it.");
  }
  const provenanceErrors = completeCurrentRunProvenanceErrors(health, "Repository-wide health");
  if (provenanceErrors.length) return unknown(`Repository-wide health cannot establish a current pass: ${provenanceErrors.join("; ")}.`);
  return {
    status: "complete-current-run",
    reason: "A complete repository-wide run with complete command/environment/collection/result provenance is explicitly bound to the current source identity.",
    validation: "current-source-identity-bound-complete-run-provenance",
  };
};

const validateEvidenceRuns = ({ runs, sourceIdentity }) => {
  const errors = [];
  const currentAcceptanceRuns = [];
  if (!Array.isArray(runs)) return { errors: ["evidenceRuns is not an array"], currentAcceptanceRuns };
  const categories = new Set();
  for (const run of runs) {
    if (!isObject(run) || typeof run.category !== "string" || !run.category) {
      errors.push("evidenceRuns contains a malformed run record");
      continue;
    }
    if (categories.has(run.category)) errors.push(`evidenceRuns repeats category ${run.category}`);
    categories.add(run.category);
    const reference = run.sourceIdentity;
    if (!sourceIdentityMatches(reference, sourceIdentity)) {
      errors.push(`evidenceRuns ${run.category} is not bound to this source identity`);
    }
    if (typeof run.collectionCompleteness !== "string" || typeof run.exitStatus !== "string") errors.push(`evidenceRuns ${run.category} has incomplete run provenance`);
    if (claimsCurrentAcceptance(run)) {
      const provenanceErrors = completeCurrentRunProvenanceErrors(run, `evidenceRuns ${run.category}`);
      errors.push(...provenanceErrors);
      if (provenanceErrors.length === 0 && sourceIdentityMatches(reference, sourceIdentity)) currentAcceptanceRuns.push(run);
    }
  }
  return { errors, currentAcceptanceRuns };
};

export const inspectF08SourceIdentity = ({ identity, expectedReconciliationPaths, observedStableFiles, observedBoundary = [] }) => {
  if (!isObject(identity)) {
    return {
      status: "unknown",
      capturedAt: null,
      sourceSnapshotPayloadSha256: null,
      reconciliationInputManifestSha256: null,
      mismatches: [],
      contractErrors: ["No F08 source identity record is available."],
      repositoryHealth: { status: "unknown", reason: "No source identity is available." },
      missingRequiredPaths: [],
      currentEvidenceRuns: [],
      reason: "No F08 source identity record is available; current freshness is unknown.",
    };
  }
  const contractErrors = [];
  const mismatches = [];
  if (identity.schema !== F08_SOURCE_IDENTITY_SCHEMA) contractErrors.push("SOURCE_IDENTITY schema is not the current F08 contract");
  const identityPayload = Object.fromEntries(Object.entries(identity).filter(([key]) => key !== "identitySeal"));
  const expectedIdentitySeal = sha256Text(canonicalJson(identityPayload));
  if (!isObject(identity.identitySeal) || identity.identitySeal.payloadSha256 !== expectedIdentitySeal) contractErrors.push("SOURCE_IDENTITY payload seal does not match the identity payload");
  const stableSnapshot = validateStableSourceSnapshot({ snapshot: identity.sourceSnapshot, observedFiles: observedStableFiles });
  contractErrors.push(...stableSnapshot.errors);
  mismatches.push(...stableSnapshot.mismatches);
  const reconciliationInputs = validateReconciliationInputs({
    inputs: identity.reconciliationInputs,
    expectedRequiredPaths: expectedReconciliationPaths,
    observedFiles: observedStableFiles,
  });
  contractErrors.push(...reconciliationInputs.errors);
  mismatches.push(...reconciliationInputs.mismatches);
  if (asArray(observedBoundary).length) contractErrors.push("Current stable-source traversal encountered a link, reparse point, or walk error.");
  const sourceIdentityReference = {
    sourceSnapshotPayloadSha256: stableSnapshot.payloadSha256,
    reconciliationInputManifestSha256: reconciliationInputs.payloadSha256,
  };
  const runs = validateEvidenceRuns({ runs: identity.evidenceRuns, sourceIdentity: sourceIdentityReference });
  contractErrors.push(...runs.errors);
  const missingRequiredPaths = reconciliationInputs.missingRequiredPaths;
  const staleInputPaths = reconciliationInputs.staleInputPaths;
  const status = contractErrors.length > 0 ? "unknown" : (mismatches.length > 0 || missingRequiredPaths.length > 0 || staleInputPaths.length > 0 ? "stale" : "current");
  const repositoryHealth = inspectRepositoryHealthEvidence({
    health: identity.repositoryHealth?.broadRepositoryBaseline,
    sourceIdentity: sourceIdentityReference,
    sourceStatus: status,
  });
  const currentEvidenceRuns = status === "current" ? runs.currentAcceptanceRuns : [];
  const reasons = [];
  if (contractErrors.length) reasons.push(`${contractErrors.length} identity-contract error(s)`);
  if (mismatches.length) reasons.push(`${mismatches.length} current file mismatch(es)`);
  if (missingRequiredPaths.length) reasons.push(`missing required input(s): ${missingRequiredPaths.join(", ")}`);
  if (staleInputPaths.length) reasons.push(`stale generated input(s): ${staleInputPaths.join(", ")}`);
  if (!reasons.length) reasons.push("All independently derived F08 source-identity dependencies match current stable bytes.");
  return {
    status,
    capturedAt: typeof identity.capturedAt === "string" ? identity.capturedAt : null,
    sourceSnapshotPayloadSha256: stableSnapshot.payloadSha256,
    reconciliationInputManifestSha256: reconciliationInputs.payloadSha256,
    mismatches,
    contractErrors,
    repositoryHealth,
    missingRequiredPaths,
    currentEvidenceRuns,
    reason: reasons.join("; "),
  };
};

const currentVerificationRuntimeOnlyKeys = new Set([
  "absolutepath",
  "attachment",
  "attachmentid",
  "fileid",
  "localfilepath",
  "localpath",
  "remotefileid",
  "remotehandle",
  "vendorfileid",
]);

const currentVerificationExecutionOutcomes = new Set([
  "passed",
  "launch-failed",
  "timed-out",
  "nonzero-exit",
  "output-collection-incomplete",
  "source-not-current-after-phase",
]);

const collectRuntimeOnlyBoundaryErrors = (value, label, seen = new Set()) => {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const errors = [];
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
    if (currentVerificationRuntimeOnlyKeys.has(normalizedKey)) errors.push(`${label} contains runtime-only field ${key}`);
    errors.push(...collectRuntimeOnlyBoundaryErrors(child, `${label}.${key}`, seen));
  }
  return errors;
};

const validateCurrentVerificationPhaseExecution = (execution, phase, label) => {
  const errors = [];
  if (!isObject(execution)) return [`${label} has no execution accounting`];
  if (execution.launcher !== "process.execPath") errors.push(`${label} launcher must be process.execPath`);
  if (typeof execution.launched !== "boolean") errors.push(`${label} execution launched state is not boolean`);
  if (execution.launchError !== null && (typeof execution.launchError !== "string" || !execution.launchError.trim())) {
    errors.push(`${label} execution launch error is malformed`);
  }
  if (!Number.isSafeInteger(execution.timeoutMs) || execution.timeoutMs < 100 || execution.timeoutMs > 3_600_000) {
    errors.push(`${label} execution timeout is outside the bounded policy`);
  }
  if (execution.exitCode !== null && !Number.isInteger(execution.exitCode)) errors.push(`${label} execution exit code is malformed`);
  if (execution.signal !== null && (typeof execution.signal !== "string" || !execution.signal.trim())) {
    errors.push(`${label} execution signal is malformed`);
  }
  if (typeof execution.timedOut !== "boolean") errors.push(`${label} execution timeout state is not boolean`);
  if (!currentVerificationExecutionOutcomes.has(execution.outcome)) errors.push(`${label} execution outcome is not recognized`);
  if (execution.launched === true && execution.launchError !== null) errors.push(`${label} execution records both a launch and a launch error`);
  if (execution.launched === false && execution.launchError === null) errors.push(`${label} execution did not launch but has no launch error`);
  if (execution.timedOut === true && execution.launched !== true) errors.push(`${label} execution timed out before a launch was recorded`);
  if (execution.outcome === "passed" && (!execution.launched || execution.timedOut || execution.exitCode !== 0 || execution.signal !== null || execution.launchError !== null)) {
    errors.push(`${label} passed execution accounting is inconsistent`);
  }
  if (execution.outcome === "launch-failed" && (execution.launched || execution.launchError === null || execution.timedOut)) {
    errors.push(`${label} launch-failed execution accounting is inconsistent`);
  }
  if (execution.outcome === "timed-out" && (!execution.launched || !execution.timedOut)) {
    errors.push(`${label} timed-out execution accounting is inconsistent`);
  }
  if (execution.outcome === "nonzero-exit" && (!execution.launched || execution.timedOut || (execution.exitCode === 0 && execution.signal === null))) {
    errors.push(`${label} nonzero-exit execution accounting is inconsistent`);
  }
  if (phase.exitStatus === "passed" && execution.outcome !== "passed") errors.push(`${label} passed phase does not have a passed execution outcome`);
  if (phase.exitStatus === "failed" && execution.outcome === "passed") errors.push(`${label} failed phase has a passed execution outcome`);
  return errors;
};

const validateCurrentVerificationSourceSnapshot = ({ snapshot, observedFiles }) => {
  const errors = [];
  const mismatches = [];
  if (!isObject(snapshot)) return { errors: ["current verification sourceSnapshot is missing or malformed"], mismatches, payloadSha256: null, files: {} };
  if (snapshot.schema !== F08_CURRENT_VERIFICATION_SOURCE_SNAPSHOT_SCHEMA) errors.push("current verification sourceSnapshot schema is not recognized");
  if (snapshot.contractVersion !== undefined) errors.push("current verification sourceSnapshot must not carry an unsealed duplicate contract version");
  if (snapshot.domain !== currentVerificationOutputPolicy.domain) errors.push("current verification sourceSnapshot domain is not the explicit current-verification domain");
  if (canonicalJson(snapshot.policy) !== canonicalJson(currentVerificationOutputPolicy)) errors.push("current verification sourceSnapshot policy does not match the explicit output policy");
  const recorded = normalizeFileMap(snapshot.files, "current verification sourceSnapshot");
  errors.push(...recorded.errors);
  if (snapshot.fileCount !== Object.keys(recorded.files).length) errors.push("current verification sourceSnapshot fileCount does not match its file map");
  for (const path of Object.keys(recorded.files)) {
    if (currentVerificationPhaseOutputPaths.includes(path)) errors.push(`current verification sourceSnapshot incorrectly includes generated phase output ${path}`);
    if (isCurrentVerificationArtifact(path)) errors.push(`current verification sourceSnapshot incorrectly includes generated run artifact ${path}`);
  }
  const payload = buildCurrentVerificationSourceSnapshotPayload({ files: recorded.files });
  const expectedPayloadSha256 = sha256Text(canonicalJson(payload));
  if (snapshot.payloadSha256 !== expectedPayloadSha256) errors.push("current verification sourceSnapshot payload seal does not match its recorded files and policy");
  if (observedFiles !== undefined) {
    const observed = normalizeFileMap(observedFiles, "observed current verification source snapshot");
    errors.push(...observed.errors);
    mismatches.push(...compareFileMaps(recorded.files, observed.files, "current verification sourceSnapshot"));
  }
  return { errors, mismatches, payloadSha256: typeof snapshot.payloadSha256 === "string" ? snapshot.payloadSha256 : null, files: recorded.files };
};

const normalizedExactPathSet = (records) => sorted(records.map((record) => record.path));
const samePathSet = (records, expectedPaths) => canonicalJson(normalizedExactPathSet(records)) === canonicalJson(sorted(expectedPaths));
const recordsMatch = (left, right) => Boolean(left && right && left.sha256 === right.sha256 && left.bytes === right.bytes);

const normalizeObservedArtifactMap = (files) => normalizeFileMap(files ?? {}, "observed current verification artifacts");

const validateCurrentVerificationPredecessors = ({ runId, predecessors, observedArtifacts }) => {
  const errors = [];
  const mismatches = [];
  const records = new Map();
  if (!Array.isArray(predecessors)) return { errors: ["current verification predecessorArtifacts is not an array"], mismatches, records };
  const bySourcePath = new Map();
  for (const entry of predecessors) {
    const sourcePath = normalizeEvidencePath(entry?.sourcePath);
    if (!sourcePath.ok) {
      errors.push(`current verification predecessor artifact has invalid source path: ${sourcePath.reason}`);
      continue;
    }
    if (bySourcePath.has(sourcePath.path)) {
      errors.push(`current verification predecessorArtifacts repeats ${sourcePath.path}`);
      continue;
    }
    bySourcePath.set(sourcePath.path, entry);
  }
  for (const sourcePath of currentVerificationPhaseOutputPaths) {
    const entry = bySourcePath.get(sourcePath);
    if (!entry) {
      errors.push(`current verification predecessorArtifacts omits ${sourcePath}`);
      continue;
    }
    const expectedCopyPath = currentVerificationPredecessorCopyPath(runId, sourcePath);
    if (entry.source?.exists === false) {
      if (entry.preservedCopy !== null) errors.push(`current verification predecessor ${sourcePath} declares no source but has a preserved copy`);
      continue;
    }
    const source = normalizeFileRecord(entry.source, "current verification predecessor source");
    const copy = normalizeFileRecord(entry.preservedCopy, "current verification predecessor copy");
    if (source.error) errors.push(source.error);
    if (copy.error) errors.push(copy.error);
    if (source.record && source.record.path !== sourcePath) errors.push(`current verification predecessor source path does not match ${sourcePath}`);
    if (copy.record && copy.record.path !== expectedCopyPath) errors.push(`current verification predecessor copy path does not match ${sourcePath}`);
    if (source.record && copy.record && !recordsMatch(source.record, copy.record)) errors.push(`current verification predecessor copy bytes do not preserve ${sourcePath}`);
    if (source.record && copy.record && recordsMatch(source.record, copy.record)) records.set(sourcePath, source.record);
    if (copy.record) {
      const observed = observedArtifacts[copy.record.path];
      if (!observed) mismatches.push(`current verification predecessor copy is missing: ${copy.record.path}`);
      else if (!recordsMatch(copy.record, observed)) mismatches.push(`current verification predecessor copy byte identity changed: ${copy.record.path}`);
    }
  }
  for (const sourcePath of bySourcePath.keys()) {
    if (!currentVerificationPhaseOutputPaths.includes(sourcePath)) errors.push(`current verification predecessorArtifacts declares unexpected source ${sourcePath}`);
  }
  return { errors, mismatches, records };
};

const validateCurrentVerificationPhase = ({ runId, phase, sourceSnapshot, predecessorOutputs, producedOutputs, observedArtifacts }) => {
  const errors = [];
  const mismatches = [];
  if (!isObject(phase)) return { errors: ["current verification phases contains a malformed phase record"], mismatches, id: null, status: "invalid" };
  const specification = getCurrentVerificationPhase(phase.id);
  if (!specification) return { errors: [`current verification phase ${String(phase.id)} is not an allowed phase`], mismatches, id: typeof phase.id === "string" ? phase.id : null, status: "invalid" };
  const label = `current verification phase ${specification.id}`;
  if (phase.command !== specification.command) errors.push(`${label} command does not match the fixed phase recipe`);
  if (!hasObservedEnvironment(phase.environment)) errors.push(`${label} has incomplete environment provenance`);
  if (phase.environment?.cwd !== "candidate-root") errors.push(`${label} environment cwd must be the redacted candidate-root marker`);
  if (phase.sourceSnapshotPayloadSha256 !== sourceSnapshot.payloadSha256) errors.push(`${label} is not bound to this current source snapshot`);
  const inputs = normalizeFileRecordList(phase.inputs, `${label} inputs`);
  const outputs = normalizeFileRecordList(phase.outputs, `${label} outputs`);
  errors.push(...inputs.errors, ...outputs.errors);
  if (!samePathSet(inputs.records, specification.requiredInputPaths)) errors.push(`${label} input paths do not match the fixed phase recipe`);
  if (phase.exitStatus === "passed" && !samePathSet(outputs.records, specification.outputPaths)) {
    errors.push(`${label} output paths do not match the fixed phase recipe`);
  }
  if (phase.exitStatus === "failed" && outputs.records.some((output) => !specification.outputPaths.includes(output.path))) {
    errors.push(`${label} failed receipt records an output outside the fixed phase recipe`);
  }
  for (const input of inputs.records) {
    const sourceRecord = sourceSnapshot.files[input.path];
    const predecessorRecord = predecessorOutputs.get(input.path);
    const producedRecord = producedOutputs.get(input.path);
    if (sourceRecord && !recordsMatch(sourceRecord, input)) errors.push(`${label} input ${input.path} does not match the sealed source snapshot`);
    if (!sourceRecord && producedRecord && !recordsMatch(producedRecord, input)) errors.push(`${label} input ${input.path} does not match its prior generated phase output`);
    if (!sourceRecord && !producedRecord && predecessorRecord && !recordsMatch(predecessorRecord, input)) errors.push(`${label} input ${input.path} does not match its preserved predecessor evidence`);
    if (!sourceRecord && !predecessorRecord && !producedRecord) errors.push(`${label} input ${input.path} is neither a sealed source input, preserved predecessor, nor prior generated output`);
  }
  for (const output of outputs.records) {
    const observed = observedArtifacts[output.path];
    if (!observed) mismatches.push(`${label} output is missing: ${output.path}`);
    else if (!recordsMatch(output, observed)) mismatches.push(`${label} output byte identity changed: ${output.path}`);
  }
  if (!["complete", "incomplete"].includes(phase.collectionCompleteness)) errors.push(`${label} has an invalid collection state`);
  if (phase.exitStatus === "passed" && phase.collectionCompleteness !== "complete") errors.push(`${label} passed collection is not complete`);
  if (!["passed", "failed"].includes(phase.exitStatus)) errors.push(`${label} has an invalid exit status`);
  if (!["current", "stale", "unknown"].includes(phase.freshness)) errors.push(`${label} has an invalid freshness state`);
  errors.push(...validateCurrentVerificationPhaseExecution(phase.execution, phase, label));
  if (!isObject(phase.result) || typeof phase.result.recordedAt !== "string" || !phase.result.recordedAt.trim()
    || typeof phase.result.summary !== "string" || !phase.result.summary.trim()
    || typeof phase.result.outputSha256 !== "string" || !SHA256_PATTERN.test(phase.result.outputSha256)) {
    errors.push(`${label} has incomplete result provenance`);
  }
  const log = normalizeFileRecord(phase.log, `${label} log`);
  if (log.error) errors.push(log.error);
  const expectedLogPath = currentVerificationPhaseLogPath(runId, specification.id);
  if (log.record && log.record.path !== expectedLogPath) errors.push(`${label} log path does not match the fixed phase recipe`);
  if (log.record) {
    const observed = observedArtifacts[log.record.path];
    if (!observed) mismatches.push(`${label} log is missing: ${log.record.path}`);
    else if (!recordsMatch(log.record, observed)) mismatches.push(`${label} log byte identity changed: ${log.record.path}`);
    if (phase.result?.outputSha256 !== log.record.sha256) errors.push(`${label} result output hash does not match its collected log`);
  }
  errors.push(...collectRuntimeOnlyBoundaryErrors(phase, label));
  const complete = errors.length === 0 && mismatches.length === 0 && phase.exitStatus === "passed" && phase.freshness === "current";
  return {
    errors,
    mismatches,
    id: specification.id,
    status: complete ? "complete-current-run" : phase.exitStatus === "failed" ? "failed" : errors.length > 0 ? "invalid" : "stale",
    outputs: outputs.records,
  };
};

export const sealCurrentVerificationRun = (payload) => {
  const sealedPayload = Object.fromEntries(Object.entries(payload ?? {}).filter(([key]) => key !== "identitySeal"));
  return {
    ...sealedPayload,
    identitySeal: makePayloadSeal(sealedPayload, "CURRENT_VERIFICATION_RUN payload excluding identitySeal and excluding its own artifact hash"),
  };
};

/**
 * Validates a separately selected current-run ledger.  A matching source snapshot alone returns
 * `sourceStatus: current`; only a completed, fixed-recipe phase receipt is a current command
 * result.  This distinction prevents a fresh input hash from promoting historical passes.
 */
export const inspectCurrentVerificationRun = ({ run, expectedRunId, observedStableFiles, observedArtifacts = {}, observedBoundary = [] }) => {
  const contractErrors = [];
  const mismatches = [];
  if (!isObject(run)) {
    return {
      sourceStatus: "unknown",
      runStatus: "unknown",
      integrityStatus: "failed",
      coreRunStatus: "unknown",
      supplementalRunStatus: "unknown",
      failedCorePhaseIds: [],
      incompleteCorePhaseIds: [],
      supplementalFailures: [],
      checkStatus: "integrity-failed",
      sourceSnapshotPayloadSha256: null,
      contractErrors: ["No current verification run record is available."],
      mismatches,
      phases: [],
      reason: "No current verification run record is available; current source and command outcomes are unknown.",
    };
  }
  if (run.schema !== F08_CURRENT_VERIFICATION_RUN_SCHEMA) contractErrors.push("CURRENT_VERIFICATION_RUN schema is not recognized");
  if (run.contractVersion !== F08_CONTRACT_VERSION) contractErrors.push("CURRENT_VERIFICATION_RUN contract version is not current");
  const runId = normalizeCurrentVerificationRunId(run.runId);
  if (!runId.ok) contractErrors.push(`CURRENT_VERIFICATION_RUN has invalid run id: ${runId.reason}`);
  if (expectedRunId !== undefined && runId.ok && runId.runId !== expectedRunId) contractErrors.push("CURRENT_VERIFICATION_RUN run id does not match the selected output path");
  if (typeof run.createdAt !== "string" || !run.createdAt.trim()) contractErrors.push("CURRENT_VERIFICATION_RUN has no creation timestamp");
  const runPayload = Object.fromEntries(Object.entries(run).filter(([key]) => key !== "identitySeal"));
  const expectedSeal = sha256Text(canonicalJson(runPayload));
  if (!isObject(run.identitySeal) || run.identitySeal.payloadSha256 !== expectedSeal) contractErrors.push("CURRENT_VERIFICATION_RUN payload seal does not match the run payload");
  contractErrors.push(...collectRuntimeOnlyBoundaryErrors(run, "CURRENT_VERIFICATION_RUN"));

  const sourceSnapshot = validateCurrentVerificationSourceSnapshot({ snapshot: run.sourceSnapshot, observedFiles: observedStableFiles });
  contractErrors.push(...sourceSnapshot.errors);
  mismatches.push(...sourceSnapshot.mismatches);
  const observed = normalizeObservedArtifactMap(observedArtifacts);
  contractErrors.push(...observed.errors);
  if (asArray(observedBoundary).length) contractErrors.push("Current verification source traversal encountered a link, reparse point, or walk error.");

  const normalizedRunId = runId.ok ? runId.runId : "invalid-run-id";
  const predecessors = validateCurrentVerificationPredecessors({
    runId: normalizedRunId,
    predecessors: run.predecessorArtifacts,
    observedArtifacts: observed.files,
  });
  contractErrors.push(...predecessors.errors);
  mismatches.push(...predecessors.mismatches);

  const phaseStates = [];
  const seenPhases = new Set();
  const producedOutputs = new Map();
  let priorPhaseIndex = -1;
  for (const phase of asArray(run.phases)) {
    const phaseId = phase?.id;
    const specification = getCurrentVerificationPhase(phaseId);
    const phaseIndex = specification?.sequence === "core"
      ? currentVerificationPhaseSpecification.filter((candidate) => candidate.sequence === "core").findIndex((candidate) => candidate.id === phaseId)
      : -1;
    if (seenPhases.has(phaseId)) contractErrors.push(`CURRENT_VERIFICATION_RUN repeats phase ${String(phaseId)}`);
    seenPhases.add(phaseId);
    if (phaseIndex >= 0 && phaseIndex <= priorPhaseIndex) contractErrors.push(`CURRENT_VERIFICATION_RUN phase order is not deterministic at ${String(phaseId)}`);
    if (phaseIndex >= 0) priorPhaseIndex = phaseIndex;
    if (specification) {
      for (const prerequisite of specification.prerequisitePhaseIds) {
        const prior = phaseStates.find((state) => state.id === prerequisite);
        if (!prior) {
          contractErrors.push(`CURRENT_VERIFICATION_RUN phase ${phaseId} lacks completed prerequisite ${prerequisite}`);
        } else if (prior.status === "stale") {
          mismatches.push(`CURRENT_VERIFICATION_RUN phase ${phaseId} depends on stale prerequisite ${prerequisite}`);
        } else if (prior.status !== "complete-current-run") {
          contractErrors.push(`CURRENT_VERIFICATION_RUN phase ${phaseId} lacks completed prerequisite ${prerequisite}`);
        }
      }
    }
    const validated = validateCurrentVerificationPhase({
      runId: normalizedRunId,
      phase,
      sourceSnapshot,
      predecessorOutputs: predecessors.records,
      producedOutputs,
      observedArtifacts: observed.files,
    });
    contractErrors.push(...validated.errors);
    mismatches.push(...validated.mismatches);
    phaseStates.push({ id: validated.id ?? String(phaseId ?? "unknown"), status: validated.status });
    if (validated.status === "complete-current-run" || validated.status === "stale") {
      for (const output of validated.outputs) producedOutputs.set(output.path, output);
    }
  }

  const sourceStatus = contractErrors.length > 0 ? "unknown" : mismatches.length > 0 ? "stale" : "current";
  const corePhaseSpecifications = currentVerificationPhaseSpecification.filter((phase) => phase.sequence === "core");
  const supplementalPhaseSpecifications = currentVerificationPhaseSpecification.filter((phase) => phase.sequence === "supplemental");
  const failedCorePhaseIds = corePhaseSpecifications
    .filter((phase) => phaseStates.some((state) => state.id === phase.id && state.status === "failed"))
    .map((phase) => phase.id);
  const incompleteCorePhaseIds = corePhaseSpecifications
    .filter((phase) => !phaseStates.some((state) => state.id === phase.id && state.status === "complete-current-run"))
    .map((phase) => phase.id);
  const supplementalFailures = supplementalPhaseSpecifications
    .filter((phase) => phaseStates.some((state) => state.id === phase.id && state.status === "failed"))
    .map((phase) => phase.id);
  const integrityStatus = sourceStatus === "current" ? "passed" : "failed";
  const coreRunStatus = failedCorePhaseIds.length > 0
    ? "failed-core-run"
    : integrityStatus !== "passed"
      ? "unknown"
      : incompleteCorePhaseIds.length > 0
        ? "incomplete-core-run"
        : "complete-current-run";
  const supplementalRunStatus = integrityStatus !== "passed"
    ? "unknown"
    : supplementalFailures.length > 0
      ? "supplemental-failures"
      : "no-supplemental-failures";
  const checkStatus = integrityStatus !== "passed"
    ? "integrity-failed"
    : coreRunStatus === "failed-core-run"
      ? "failed-core-run"
      : coreRunStatus === "incomplete-core-run"
        ? "incomplete-core-run"
        : supplementalFailures.length > 0
          ? "supplemental-failures"
          : "passed";
  const runStatus = integrityStatus !== "passed"
    ? sourceStatus
    : coreRunStatus === "failed-core-run"
      ? "failed-core-run"
      : coreRunStatus === "incomplete-core-run"
        ? "incomplete-core-run"
        : supplementalFailures.length > 0
          ? "complete-current-run-with-supplemental-failures"
          : "complete-current-run";
  const reasons = [];
  if (contractErrors.length) reasons.push(`${contractErrors.length} current-verification contract error(s)`);
  if (mismatches.length) reasons.push(`${mismatches.length} current-verification byte mismatch(es)`);
  if (!reasons.length && failedCorePhaseIds.length) reasons.push(`Core execution failed for ${failedCorePhaseIds.join(", ")}.`);
  if (!reasons.length && incompleteCorePhaseIds.length) reasons.push(`Core execution remains incomplete: ${incompleteCorePhaseIds.join(", ")}.`);
  if (!reasons.length && supplementalFailures.length) reasons.push(`Supplemental execution failed for ${supplementalFailures.join(", ")}; core completion is reported separately.`);
  if (!reasons.length) reasons.push("The selected current-verification source snapshot matches and every fixed core phase has a complete current receipt.");
  return {
    sourceStatus,
    runStatus,
    integrityStatus,
    coreRunStatus,
    supplementalRunStatus,
    failedCorePhaseIds,
    incompleteCorePhaseIds,
    supplementalFailures,
    checkStatus,
    sourceSnapshotPayloadSha256: sourceSnapshot.payloadSha256,
    contractErrors,
    mismatches,
    phases: phaseStates,
    reason: reasons.join("; "),
  };
};

/**
 * Builds the source-only reference that deterministic reconciliation artifacts may serialize for
 * a selected current-verification run. Receipt progress is intentionally omitted after source
 * integrity is current: completing a later core phase or recording an independent supplemental
 * failure must remain visible in the ledger/CLI without rewriting the catalog provenance.
 */
export const deriveCurrentVerificationSourceProvenance = ({ run, inspection }) => {
  const status = ["current", "stale", "unknown"].includes(inspection?.sourceStatus)
    ? inspection.sourceStatus
    : "unknown";
  const reference = {
    status,
    capturedAt: typeof run?.createdAt === "string" && run.createdAt.trim() ? run.createdAt : null,
    sourceSnapshotPayloadSha256: typeof inspection?.sourceSnapshotPayloadSha256 === "string"
      ? inspection.sourceSnapshotPayloadSha256
      : null,
    reconciliationInputManifestSha256: null,
    missingRequiredPaths: [],
  };
  if (status === "current") {
    return {
      ...reference,
      reason: "Selected current-verification source snapshot is current; serialized reconciliation provenance is limited to its immutable source identity and fixed output boundary. Dynamic phase receipts remain in the current-verification ledger and CLI.",
      mismatches: [],
      contractErrors: [],
    };
  }
  return {
    ...reference,
    reason: typeof inspection?.reason === "string" && inspection.reason.trim()
      ? inspection.reason
      : "Selected current-verification source identity is unavailable or invalid.",
    mismatches: asArray(inspection?.mismatches),
    contractErrors: asArray(inspection?.contractErrors),
  };
};
