/**
 * Bounded F08 current-evidence authoring writer.
 *
 * The writer performs source/document inspection, byte hashing, and writes only the four named
 * F08 current-evidence artifacts. It does not import application code, a compiler, a policy
 * evaluator, a checker, a witness collector, or the Cycle 12 reconciler. Running `--write` is
 * static artifact authoring, not application validation.
 *
 * Usage:
 *   node scripts/writeFollowupClosure.mjs --write
 *   node scripts/writeFollowupClosure.mjs --check
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReconciliationInputPayload,
  canonicalJson,
  deriveReconciliationInputSpecification,
  makePayloadSeal,
  makeStableSourceSnapshot,
  sha256Bytes,
  sha256Text,
  stableDomainExclusion,
  stableSourceIdentityPolicy,
} from "./followupEvidenceContract.mjs";

const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const oldPlanRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
const followupPlanRoot = "planning/2026-09-08_catalog-fidelity-follow-up";
const followupEvidenceRoot = `${followupPlanRoot}/evidence/f08-current`;
const outputs = {
  closure: `${followupEvidenceRoot}/CLOSURE.json`,
  closureMarkdown: `${followupEvidenceRoot}/CLOSURE.md`,
  catalogDispositions: `${followupEvidenceRoot}/CATALOG_DISPOSITIONS.json`,
  sourceIdentity: `${followupEvidenceRoot}/SOURCE_IDENTITY.json`,
};
const writeRequested = process.argv.includes("--write");
const checkRequested = process.argv.includes("--check");

if (!writeRequested && !checkRequested) {
  console.log("F08 closure writer is bounded; pass --write to author the four current-evidence artifacts or --check to parse them.");
  process.exit(0);
}

const asArray = (value) => Array.isArray(value) ? value : [];
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sorted = (values) => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const unique = (values) => [...new Set(values)];
const readText = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const readOptionalJson = (relativePath) => {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return undefined;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return undefined;
  }
};
const readOptionalText = (relativePath) => {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return undefined;
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    return undefined;
  }
};
const readOuterOptionalJson = (relativePath) => {
  const absolutePath = join(root, "..", relativePath);
  if (!existsSync(absolutePath)) return undefined;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return undefined;
  }
};
const fileRecord = (relativePath) => {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) return { path: relativePath, exists: false };
  const bytes = readFileSync(absolutePath);
  return { path: relativePath, exists: true, sha256: sha256Bytes(bytes), bytes: bytes.byteLength };
};
const outerFileRecord = (relativePath) => {
  const absolutePath = join(root, "..", relativePath);
  if (!existsSync(absolutePath)) return { path: `../${relativePath}`, exists: false };
  const bytes = readFileSync(absolutePath);
  return { path: `../${relativePath}`, exists: true, sha256: sha256Bytes(bytes), bytes: bytes.byteLength };
};
const collectF08ReviewIntegrationObservations = () => {
  const namespace = stableSourceIdentityPolicy.f08ReviewIntegrationNamespace;
  const absoluteDirectory = join(root, namespace.directory);
  if (!existsSync(absoluteDirectory)) {
    return {
      namespace,
      records: [],
      note: "The bounded F08 review/integration directory is absent, so no parent record is available for this dated observation.",
    };
  }
  try {
    const records = readdirSync(absoluteDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `${namespace.directory}/${entry.name}`)
      .filter((relativePath) => stableDomainExclusion(relativePath, "file") === "f08-parent-review-or-integration-bookkeeping")
      .sort((left, right) => left.localeCompare(right))
      .map(fileRecord);
    return {
      namespace,
      records,
      note: "These bounded F08 parent review/integration records are dated coordination observations, not stable source prerequisites. Future matching parent records do not self-invalidate application/evidence byte freshness.",
    };
  } catch (error) {
    return {
      namespace,
      records: [],
      readError: String(error.message ?? error),
      note: "The bounded F08 parent record observation could not be listed; it remains outside the stable source domain rather than becoming an inferred source input.",
    };
  }
};

const collectStableSourceFiles = () => {
  const files = {};
  const filesystemBoundary = { reparsePoints: [], walkErrors: [], skippedPaths: [] };
  const walk = (absoluteDirectory, relativeDirectory = "") => {
    let entries;
    try {
      entries = readdirSync(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      filesystemBoundary.walkErrors.push({ path: relativeDirectory || ".", reason: String(error.message ?? error) });
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = join(absoluteDirectory, entry.name);
      const directoryExclusion = stableDomainExclusion(relativePath, "directory");
      if (entry.isSymbolicLink()) {
        if (directoryExclusion === "excluded-generated-or-dependency-directory") {
          filesystemBoundary.skippedPaths.push({ path: relativePath, reason: directoryExclusion });
          continue;
        }
        filesystemBoundary.reparsePoints.push({ path: relativePath, kind: "symbolic-link-or-reparse-point" });
        continue;
      }
      if (entry.isDirectory()) {
        if (directoryExclusion) {
          filesystemBoundary.skippedPaths.push({ path: relativePath, reason: directoryExclusion });
          continue;
        }
        walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        filesystemBoundary.reparsePoints.push({ path: relativePath, kind: "unsupported-filesystem-entry" });
        continue;
      }
      const exclusion = stableDomainExclusion(relativePath, "file");
      if (exclusion) {
        filesystemBoundary.skippedPaths.push({ path: relativePath, reason: exclusion });
        continue;
      }
      const bytes = readFileSync(absolutePath);
      files[relativePath] = { sha256: sha256Bytes(bytes), bytes: bytes.byteLength };
    }
  };
  walk(root);
  return { files, filesystemBoundary };
};

const ownership = readJson(`${oldPlanRoot}/CATALOG_OWNERSHIP.json`);
const cycleStatus = readJson(`${oldPlanRoot}/_CYCLE_STATUS.json`);
const techniqueIndex = readJson("public/techniques/index.json");
const labIndex = readJson("public/labs/index.json");
const sourceRegistry = readJson("docs/architecture/source-trace-registry.json");
const atomRegistry = readJson("src/domain/atomRegistry.json");
const revision9 = readJson(`${oldPlanRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`);
const revision10 = readJson(`${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json`);
const revision10Impact = readJson(`${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json`);
const thermalTechnique = readJson("public/techniques/thermal-decomposition-mass-loss.json");
const acidBaseSettings = readJson("public/labs/acid-base-titration-curves-config.json");
const coordination = readOptionalJson(`${followupPlanRoot}/ORCHESTRATION_STATUS.json`);
const remainingLunaOrchestrationPath = `${followupPlanRoot}/evidence/REMAINING_LUNA_ORCHESTRATION.md`;
const remainingLunaOrchestration = readOptionalText(remainingLunaOrchestrationPath);
const trackingSnapshotPath = "GIT_TRACKING_SNAPSHOT.json";
const trackingSnapshot = readOuterOptionalJson(trackingSnapshotPath);

const acceptedEvidencePaths = {
  f03Review: `${followupPlanRoot}/evidence/F03_FINAL_STRICT_ROOT_REVIEW.md`,
  f03Integration: `${followupPlanRoot}/evidence/F03_FINAL_STRICT_ROOT_INTEGRATION.json`,
  f04Closure: `${followupPlanRoot}/F04_FINAL_CLOSURE_REPORT.md`,
  f05Review: `${followupPlanRoot}/evidence/F05_REMAINING_ROOT_REVIEW.md`,
  f06Completion: `${followupPlanRoot}/evidence/F06_COMPLETION.md`,
  f07Phase1Review: `${followupPlanRoot}/evidence/F07_PHASE1_ROOT_REVIEW.md`,
  f07Phase2Review: `${followupPlanRoot}/evidence/F07_PHASE2_ROOT_REVIEW.md`,
};
const f03Expected = {
  integrationRecordSha256: "0ec7b78f324d0c9907e2ff2c27e0dd480aa8f13cc9a61db2f4dacc4135483b1a",
  manifestSha256: "bf627b9c0e43319f6ae26164a28bb6ec8b1d466aa429aa8ac3fa36c711120b08",
  status: "integrated-source-final-strict-source-static-reviewed-execution-unverified",
};
const f03FinalIntegration = readJson(acceptedEvidencePaths.f03Integration);
const f03FinalIntegrationArtifact = fileRecord(acceptedEvidencePaths.f03Integration);
const f03DeclaredFiles = asArray(f03FinalIntegration.files).filter((entry) => typeof entry?.path === "string" && entry.path);
const f03DeclaredFileChecks = f03DeclaredFiles.map((entry) => {
  const current = fileRecord(entry.path);
  const expected = entry.after;
  return {
    path: entry.path,
    expected: expected ? { sha256: expected.sha256, bytes: expected.bytes } : null,
    current: current.exists ? { sha256: current.sha256, bytes: current.bytes } : { exists: false },
    matchesAcceptedF03Integration: Boolean(current.exists && expected && current.sha256 === expected.sha256 && current.bytes === expected.bytes),
  };
});
const f03DependencyIntegrity = {
  recordPath: acceptedEvidencePaths.f03Integration,
  recordIdentity: f03FinalIntegrationArtifact,
  expectedIntegrationRecordSha256: f03Expected.integrationRecordSha256,
  expectedManifestSha256: f03Expected.manifestSha256,
  expectedStatus: f03Expected.status,
  actualStatus: f03FinalIntegration.status ?? null,
  actualManifestSha256: f03FinalIntegration.manifestSha256 ?? null,
  declaredFiles: f03DeclaredFileChecks,
  matchesAcceptedDependency: f03FinalIntegrationArtifact.sha256 === f03Expected.integrationRecordSha256
    && f03FinalIntegration.manifestSha256 === f03Expected.manifestSha256
    && f03FinalIntegration.status === f03Expected.status
    && f03DeclaredFileChecks.length === 6
    && f03DeclaredFileChecks.every((entry) => entry.matchesAcceptedF03Integration),
};

if (!f03DependencyIntegrity.matchesAcceptedDependency) {
  throw new Error("F03 final-strict dependency bytes or accepted record do not match the settled source/static integration identity.");
}

const stableSourceCollection = collectStableSourceFiles();
const currentSourceSnapshot = makeStableSourceSnapshot({
  files: stableSourceCollection.files,
  status: stableSourceCollection.filesystemBoundary.reparsePoints.length || stableSourceCollection.filesystemBoundary.walkErrors.length
    ? "blocked-filesystem-boundary"
    : "current-stable-source-snapshot",
});
const inputSpecification = deriveReconciliationInputSpecification({
  oldPlanRoot,
  followupPlanRoot,
  techniqueIndex,
  labIndex,
  availablePaths: new Set(Object.keys(stableSourceCollection.files)),
  acceptedDependencyPaths: f03DeclaredFiles.map((entry) => entry.path),
});
// Present direct inputs are taken from the same stable snapshot supplied to the reconciler.
// A filesystem-only record would allow excluded bookkeeping to enter this identity.
const requiredReconcilerFiles = inputSpecification.requiredPaths.map((path) => {
  const stableRecord = stableSourceCollection.files[path];
  return stableRecord
    ? { path, exists: true, sha256: stableRecord.sha256, bytes: stableRecord.bytes }
    : { path, exists: false };
});
const missingRequiredPaths = requiredReconcilerFiles.filter((entry) => !entry.exists).map((entry) => entry.path);
const presentReconcilerFiles = requiredReconcilerFiles.filter((entry) => entry.exists).map(({ path, sha256, bytes }) => ({ path, sha256, bytes }));
const compileWitnessPath = `${oldPlanRoot}/evidence/lane-12/COMPILED_LAB_WITNESS.json`;
const staleInputPaths = existsSync(join(root, compileWitnessPath)) ? [compileWitnessPath] : [];
const historicalInputPaths = [
  `${oldPlanRoot}/evidence/lane-12/FROZEN_PREDECESSOR_SOURCE_DISPOSITION.json`,
  `${oldPlanRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`,
  `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json`,
  `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json`,
  ...["05", "06", "07", "08", "09", "11", "10"].flatMap((lane) => [
    `${oldPlanRoot}/evidence/lane-${lane}/source-trace-overlay.json`,
    `${oldPlanRoot}/evidence/lane-${lane}/technique-atomicity-overlay.json`,
    `${oldPlanRoot}/evidence/lane-${lane}/lab-composition-overlay.json`,
  ]).filter((path) => existsSync(join(root, path))),
];
const reconciliationInputPayload = buildReconciliationInputPayload({
  requiredFiles: presentReconcilerFiles,
  missingRequiredPaths,
  optionalMissingPaths: inputSpecification.optionalMissingPaths,
  staleInputPaths,
  staleInputReasons: Object.fromEntries(staleInputPaths.map((path) => [path, "Pre-F08 compiler witness has no F08 source identity or current collector run; its totals remain historical observations only."])),
  historicalInputPaths,
});
const reconciliationInputs = {
  ...reconciliationInputPayload,
  completeness: missingRequiredPaths.length === 0 ? "complete" : "incomplete",
  freshness: staleInputPaths.length || missingRequiredPaths.length ? "stale" : "current",
  payloadSha256: sha256Text(canonicalJson(reconciliationInputPayload)),
  independentlyDerivedRequiredPaths: inputSpecification.requiredPaths,
  derivationErrors: inputSpecification.derivationErrors,
};
const sourceIdentityRef = {
  path: outputs.sourceIdentity,
  sourceSnapshotPayloadSha256: currentSourceSnapshot.payloadSha256,
  reconciliationInputManifestSha256: reconciliationInputs.payloadSha256,
};
const capturedAt = new Date().toISOString();
const authoringContext = {
  capturedAt,
  workerTaskId: process.env.CODEX_THREAD_ID ?? "not-provided-by-authoring-environment",
  parentTaskId: process.env.CODEX_PARENT_THREAD_ID ?? "not-provided-by-authoring-environment",
  source: "static authoring process environment; task identifiers are coordination observations, not source-freshness inputs",
};
const f08ReviewIntegrationObservation = {
  observedAt: capturedAt,
  ...collectF08ReviewIntegrationObservations(),
};

const indexedTechniqueIds = techniqueIndex.map((entry) => entry.id);
const indexedLabIds = labIndex.map((entry) => entry.id);
const ownedTechniqueById = new Map();
for (const [cycle, ids] of Object.entries(ownership.techniquesByFinalCycle ?? {})) {
  for (const id of asArray(ids)) ownedTechniqueById.set(id, cycle);
}
const ownedLabById = new Map();
for (const [cycle, ids] of Object.entries(ownership.labsByFinalCycle ?? {})) {
  for (const id of asArray(ids)) ownedLabById.set(id, cycle);
}

const plannedEvidenceRun = ({ category, command, inputs = [], outputs: runOutputs = [], freshness = "unknown", limitations, authorization = "withheld-by-policy" }) => ({
  category,
  command,
  environment: { runtime: "not-collected", platform: "not-collected", cwd: "not-collected" },
  authorization,
  sourceIdentity: sourceIdentityRef,
  inputs,
  outputs: runOutputs,
  collectionCompleteness: "unattempted",
  exitStatus: "not-run",
  freshness,
  limitations,
});

const broadRepositoryBaseline = {
  status: "unknown",
  command: "npm run content:check",
  environment: { runtime: "not-collected", platform: "not-collected", cwd: "not-collected" },
  authorization: "withheld-by-policy",
  sourceIdentity: sourceIdentityRef,
  inputs: ["candidate repository source tree"],
  outputs: [],
  collectionCompleteness: "unattempted",
  exitStatus: "not-run",
  freshness: "unknown",
  reason: "No specifically complete current repository-wide run was authorized. Catalog freshness and historical prose cannot establish repository health.",
};
const evidenceRuns = [
  {
    category: "f08-static-authoring",
    command: "node scripts/writeFollowupClosure.mjs --write",
    environment: { runtime: process.version, platform: process.platform, cwd: root },
    authorization: "bounded-static-artifact-authoring",
    sourceIdentity: sourceIdentityRef,
    inputs: sorted(Object.keys(stableSourceCollection.files)),
    outputs: Object.values(outputs),
    collectionCompleteness: "selected-stable-source-domain-complete",
    exitStatus: "completed-authoring-only",
    freshness: "current-stable-source-snapshot",
    limitations: "This writer authors evidence only. It does not execute a compiler, checker, witness, policy evaluator, test, build, browser, runtime, or scientific procedure.",
  },
  plannedEvidenceRun({
    category: "cycle12-compiler-witness",
    command: "npm run cycle12:compile-witness",
    inputs: [compileWitnessPath],
    outputs: [compileWitnessPath],
    freshness: "stale",
    limitations: "The preserved witness has no F08 source identity or current collector run and remains historical only.",
  }),
  plannedEvidenceRun({
    category: "cycle12-reconciliation",
    command: "node scripts/reconcileCycle12Catalog.mjs",
    inputs: ["scripts/reconcileCycle12Catalog.mjs", ...inputSpecification.requiredPaths],
    outputs: [
      `${oldPlanRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`,
      `${oldPlanRoot}/LAB_COMPOSITION_AUDIT.json`,
      `${oldPlanRoot}/evidence/lane-12/RECONCILIATION_REPORT.json`,
      "docs/technique-composition-closure.md",
    ],
    limitations: "Not run. Existing Cycle 12 outputs remain historical and are not overwritten by this lane.",
  }),
  plannedEvidenceRun({
    category: "cycle09-overlay-refresh",
    command: "node scripts/documentCycle09Composition.mjs",
    inputs: [`${oldPlanRoot}/evidence/lane-09`],
    outputs: [`${oldPlanRoot}/evidence/lane-09/source-trace-overlay.json`, `${oldPlanRoot}/evidence/lane-09/technique-atomicity-overlay.json`, `${oldPlanRoot}/evidence/lane-09/lab-composition-overlay.json`],
    limitations: "Deferred until fresh audits exist; this feedback writer was not run and its historical overlays were not edited.",
  }),
  plannedEvidenceRun({
    category: "cycle09-overlay-check",
    command: "node scripts/checkCycle09Composition.mjs",
    inputs: [`${oldPlanRoot}/evidence/lane-09`],
    limitations: "Deferred after the Cycle 09 overlay refresh; no checker was run.",
  }),
  plannedEvidenceRun({
    category: "cycle12-reconciliation-check",
    command: "node scripts/reconcileCycle12Catalog.mjs --check",
    inputs: ["scripts/reconcileCycle12Catalog.mjs"],
    limitations: "Deferred until the Cycle 09 refresh and checker; no deterministic-output check was run.",
  }),
  plannedEvidenceRun({ category: "scientific-verification", command: "node scripts/verifyCycle12ScientificActivities.mjs", limitations: "Withheld by policy. A pre-refresh historical verifier cannot establish post-refresh Cycle 09 freshness." }),
  plannedEvidenceRun({ category: "repository-content-check", command: "npm run content:check", limitations: "Withheld by policy; no current repository-wide result is inferred." }),
  plannedEvidenceRun({ category: "tests", command: "npm test", limitations: "Withheld by policy; discovered, collected, executed, skipped, collection-failed, worker-failed, incomplete, and unattempted files are not collapsed into a pass." }),
  plannedEvidenceRun({ category: "typecheck", command: "npm run typecheck", limitations: "Withheld by policy." }),
  plannedEvidenceRun({ category: "build", command: "npm run build", limitations: "Withheld by policy." }),
  plannedEvidenceRun({ category: "browser-runtime", command: "npm run smoke:e2e", limitations: "Withheld by policy; no browser, route, visual, responsive, or WebMCP claim is made." }),
  plannedEvidenceRun({ category: "release-deployment", command: "release/deployment workflow", limitations: "Not attempted; publication and release remain outside this lane." }),
  plannedEvidenceRun({ category: "physical-scientific", command: "physical apparatus/classroom validation", limitations: "Not attempted; source files cannot establish physical, safety, disposal, or classroom acceptance." }),
];

const acceptedSourceStaticOutcomes = [
  {
    cycle: "F03",
    outcome: "Final-strict bundled policy activation is integrated and source/static reviewed.",
    evidence: [fileRecord(acceptedEvidencePaths.f03Review), fileRecord(acceptedEvidencePaths.f03Integration)],
    sourceDecision: "accepted-final-strict-source-static",
    executionLimit: "No policy evaluator, compiler, test, runtime, or release result was run or implied.",
  },
  {
    cycle: "F04",
    outcome: "Balance-display continuity and reviewed mass/transfer source repairs remain accepted at source/static scope.",
    evidence: [fileRecord(acceptedEvidencePaths.f04Closure)],
    sourceDecision: "accepted-source-static-continuity",
    executionLimit: "The F04 closure explicitly leaves runtime, policy, scientific-playability, and release acceptance unverified.",
  },
  {
    cycle: "F06",
    outcome: "Strict Green setup parsing and shared configured loader/import behavior remain integrated at source/basic-static scope.",
    evidence: [fileRecord(acceptedEvidencePaths.f06Completion)],
    sourceDecision: "accepted-source-static-setup-and-import",
    executionLimit: "No generic player playability, runtime, or release conclusion is supplied by the F06 record.",
  },
  {
    cycle: "F07",
    outcome: "Source-trace and visual/editorial registry work remains source/static reviewed; contextual provenance is descriptive, not globally enforced.",
    evidence: [fileRecord(acceptedEvidencePaths.f07Phase1Review), fileRecord(acceptedEvidencePaths.f07Phase2Review)],
    sourceDecision: "accepted-source-static-visual-and-editorial",
    executionLimit: "No checker, renderer, browser, runtime, or release result was run or implied.",
  },
];

const coordinationObservation = {
  observedAt: capturedAt,
  source: `${followupPlanRoot}/ORCHESTRATION_STATUS.json`,
  sourceFile: fileRecord(`${followupPlanRoot}/ORCHESTRATION_STATUS.json`),
  f03Status: coordination?.cycles?.F03?.status ?? "unknown",
  f08Status: coordination?.cycles?.F08?.status ?? "unknown",
  remainingLunaOrchestration: {
    source: remainingLunaOrchestrationPath,
    sourceFile: fileRecord(remainingLunaOrchestrationPath),
    readable: typeof remainingLunaOrchestration === "string",
    note: "This mutable parent log is a dated coordination observation outside the stable source identity domain; later log updates do not invalidate application/evidence byte freshness.",
  },
  note: "The mutable parent status and log are dated coordination observations outside the stable source identity domain. Later parent bookkeeping changes do not invalidate application/evidence byte freshness.",
};
const trackingObservation = {
  source: `../${trackingSnapshotPath}`,
  artifact: outerFileRecord(trackingSnapshotPath),
  capturedAt: trackingSnapshot?.at ?? null,
  commands: asArray(trackingSnapshot?.commands),
  scope: trackingSnapshot?.scope ?? "unavailable",
  note: "Only an exact parent-supplied tracking entry establishes tracked, untracked, or ignored state. Baseline-manifest membership is not a Git state.",
};

const currentSourceIdentityPayload = {
  schema: "lab-studio/f08-source-identity@2",
  contractVersion: "lab-studio/f08-evidence-contract@2",
  capturedAt,
  authoringContext,
  stableIdentityDomain: {
    purpose: "Detect byte changes, additions, removals, links, and traversal errors in relevant application/content and accepted predecessor evidence without binding freshness to generated F08 artifacts, bounded mutable parent coordination, or this F08 package's parent review/integration bookkeeping.",
    policy: stableSourceIdentityPolicy,
    nonFreshnessObservations: ["coordinationObservation", "f08ReviewIntegrationObservation", "trackingObservation"],
  },
  sourceSnapshot: currentSourceSnapshot,
  reconciliationInputs,
  acceptedDependencies: {
    f03FinalStrict: f03DependencyIntegrity,
    sourceStaticOutcomes: acceptedSourceStaticOutcomes,
  },
  catalogObservations: {
    indexedTechniqueCount: indexedTechniqueIds.length,
    ownedTechniqueCount: ownedTechniqueById.size,
    indexedLabCount: indexedLabIds.length,
    sourceTraceRegistryRowCount: asArray(sourceRegistry.traces).length,
    atomRegistryRowCount: asArray(atomRegistry.atoms).length,
    thermalTechnique: { id: thermalTechnique.id, version: thermalTechnique.metadata?.version ?? null },
    acidBaseCustomSettings: { investigationId: acidBaseSettings.investigationId, requiredCombinationCount: asArray(acidBaseSettings.requiredCombinationIds).length },
  },
  coordinationObservation,
  f08ReviewIntegrationObservation,
  trackingObservation,
  filesystemBoundary: stableSourceCollection.filesystemBoundary,
  repositoryHealth: { broadRepositoryBaseline },
  evidenceRuns,
  lineage: {
    revision9: {
      path: `${oldPlanRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`,
      state: revision9.state,
      recordedSource: revision9.source,
      artifactSha256: stableSourceCollection.files[`${oldPlanRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`]?.sha256 ?? null,
    },
    revision10: {
      path: `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json`,
      state: revision10.state,
      recordedSource: revision10.source,
      predecessor: revision10.predecessor,
      impactPath: `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json`,
      impactState: revision10Impact.state,
      impactArtifactSha256: stableSourceCollection.files[`${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json`]?.sha256 ?? null,
      note: "Candidate-not-frozen is preserved; no historical hash is invented.",
    },
  },
  exclusions: {
    stableDomainPolicy: stableSourceIdentityPolicy,
    note: "The explicit exclusions are non-source/generated directories, the protected uninspected backup, the four self-generated F08 artifacts, bounded mutable parent status/log bookkeeping, and bounded F08 parent review/integration records. They are separately observed rather than silently omitted; real application/content and accepted predecessor evidence remain in the stable domain.",
  },
};
const sourceIdentity = {
  ...currentSourceIdentityPayload,
  identitySeal: makePayloadSeal(currentSourceIdentityPayload, "SOURCE_IDENTITY payload excluding identitySeal; stable snapshot and reconciliation-input payloads carry their own seals"),
};

const trackingState = (relativePath) => {
  const state = isObject(trackingSnapshot?.files) ? trackingSnapshot.files[relativePath] : undefined;
  if (["tracked", "untracked", "ignored"].includes(state)) {
    return {
      state,
      basis: `Parent-supplied bounded Git tracking snapshot (${trackingSnapshot?.at ?? "undated"}); ${asArray(trackingSnapshot?.commands).join("; ")}`,
    };
  }
  return {
    state: "unknown",
    basis: "No exact path state appears in the parent-supplied bounded Git tracking snapshot. Filesystem/baseline-manifest membership is not treated as a Git result.",
  };
};
const currentFile = (relativePath) => {
  const record = stableSourceCollection.files[relativePath];
  return record ? { exists: true, ...record } : { exists: existsSync(join(root, relativePath)), observed: "outside-stable-domain-or-not-a-file" };
};
const dispositions = [];
const addDisposition = (row) => dispositions.push({
  path: row.path,
  disposition: row.disposition,
  tracking: row.tracking,
  currentFile: row.currentFile,
  discoveryDomain: row.discoveryDomain,
  owner: row.owner,
  retentionRationale: row.retentionRationale,
  cleanupDecisionState: row.cleanupDecisionState,
  currentUse: row.currentUse,
  impact: row.impact,
  reason: row.reason,
  nextAction: row.nextAction,
  verificationLimit: row.verificationLimit,
});

for (const entry of techniqueIndex) {
  const path = `public/techniques/${entry.file ?? `${entry.id}.json`}`;
  const routeOnly = entry.id === "ph-volume-formal-titration-trial";
  addDisposition({
    path,
    disposition: routeOnly ? "indexed-route-only-carrier" : "indexed-runtime-definition",
    tracking: trackingState(path),
    currentFile: currentFile(path),
    discoveryDomain: "public-technique-index",
    owner: routeOnly ? "cycle-10 route-only carrier" : `cycle-${ownedTechniqueById.get(entry.id) ?? "unresolved"} technique owner`,
    retentionRationale: routeOnly ? "The formal route is an intentional one-for-one indexed carrier; the generated Cycle 07 carrier remains separate for direct consumers." : "Indexed public technique definition is an active catalog source and remains in the runtime discovery domain.",
    cleanupDecisionState: "retain",
    currentUse: routeOnly ? "indexed route-only entry; not a second ownership row" : "indexed runtime/route definition",
  });
}
for (const entry of labIndex) {
  const path = `public/labs/${entry.file ?? `${entry.id}.json`}`;
  addDisposition({
    path,
    disposition: "indexed-runtime-definition",
    tracking: trackingState(path),
    currentFile: currentFile(path),
    discoveryDomain: "public-lab-index",
    owner: `cycle-${ownedLabById.get(entry.id) ?? "unresolved"} lab owner`,
    retentionRationale: "Indexed public lab definition remains in the runtime discovery domain.",
    cleanupDecisionState: "retain",
    currentUse: "indexed lab definition",
  });
}

const carrierPath = "public/techniques/ph-volume-titration-trial.json";
const carrier = readJson(carrierPath);
addDisposition({
  path: carrierPath,
  disposition: "unindexed-generated-carrier",
  tracking: trackingState(carrierPath),
  currentFile: currentFile(carrierPath),
  discoveryDomain: "direct-generated-family-consumer; excluded from indexed catalog counts",
  owner: "Cycle 07 generated technique family / Cycle 10 compatibility boundary",
  retentionRationale: `Generated carrier ${carrier.id}@${carrier.metadata?.version ?? "unknown"} remains available to direct consumers; absence from the indexed witness is not retirement.`,
  cleanupDecisionState: "retain-no-cleanup-authorized",
  currentUse: "direct compatibility carrier; F08 indexed compiler witness status was not evaluated",
});

const settingsPath = "public/labs/acid-base-titration-curves-config.json";
addDisposition({
  path: settingsPath,
  disposition: "intentional-custom-route-settings",
  tracking: trackingState(settingsPath),
  currentFile: currentFile(settingsPath),
  discoveryDomain: "custom-route-settings; excluded from lab-definition/witness enumeration",
  owner: "acid-base-titration-curves custom route",
  retentionRationale: "The route-control map, custom player, and Cycle 10 configuration consume this non-definition payload.",
  cleanupDecisionState: "retain-no-cleanup-authorized",
  currentUse: "custom route configuration and required-combination source",
});

for (const name of ["state-1024x600.png", "state-1366x625.png", "state-1920x945.png", "state-900x700.png"]) {
  const path = `undefined/${name}`;
  addDisposition({
    path,
    disposition: "nonruntime-screenshot",
    tracking: trackingState(path),
    currentFile: currentFile(path),
    discoveryDomain: "non-runtime asset; excluded from catalog/witness discovery",
    owner: "unresolved visual-artifact owner",
    retentionRationale: "The bounded Git snapshot establishes the path's state, but no source/runtime reference or retention decision was reviewed here.",
    cleanupDecisionState: "unresolved-owner-decision",
    currentUse: "no fidelity outcome claimed",
  });
}

const backupPath = stableSourceIdentityPolicy.protectedUninspectedPrefix;
addDisposition({
  path: `${backupPath}/`,
  disposition: "preserved-nested-backup-not-traversed",
  tracking: trackingState(backupPath),
  currentFile: { exists: existsSync(join(root, backupPath)), observed: "directory-presence-only; protected from recursive inspection" },
  discoveryDomain: "protected nested backup outside ordinary discovery",
  owner: "repository owner / explicit cleanup decision",
  retentionRationale: "The handoff identifies this as a protected ignored backup, but the bounded tracking snapshot supplies no exact directory-path state; tracking is therefore unknown rather than invented.",
  cleanupDecisionState: "unresolved-owner-decision",
  currentUse: "none asserted; absence, retirement, and cleanup are not inferred",
});

const historicalPaths = [
  acceptedEvidencePaths.f03Review,
  acceptedEvidencePaths.f03Integration,
  acceptedEvidencePaths.f04Closure,
  acceptedEvidencePaths.f05Review,
  acceptedEvidencePaths.f06Completion,
  acceptedEvidencePaths.f07Phase1Review,
  acceptedEvidencePaths.f07Phase2Review,
  `${followupPlanRoot}/evidence/BRASS_REPAIR_COMPLETION.md`,
  `${followupPlanRoot}/evidence/F08_PREPARATION.md`,
  `${oldPlanRoot}/evidence/CYCLE_08_PLUS_SHARED_CONTRACT_BASELINE_REVISION_9.json`,
  `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_BASELINE_REVISION_10.json`,
  `${oldPlanRoot}/evidence/CYCLE_10_SHARED_CONTRACT_AMENDMENT_IMPACT.json`,
  `${oldPlanRoot}/evidence/lane-12/COMPILED_LAB_WITNESS.json`,
  `${oldPlanRoot}/TECHNIQUE_ATOMICITY_AUDIT.json`,
  `${oldPlanRoot}/LAB_COMPOSITION_AUDIT.json`,
  `${oldPlanRoot}/evidence/lane-12/RECONCILIATION_REPORT.json`,
  "docs/technique-composition-closure.md",
].filter((path) => existsSync(join(root, path)));
const historicalEvidence = historicalPaths.map((path) => {
  const record = fileRecord(path);
  const parsed = path.endsWith(".json") ? readOptionalJson(path) : undefined;
  addDisposition({
    path,
    disposition: "historical-or-source-static-evidence",
    tracking: trackingState(path),
    currentFile: currentFile(path),
    discoveryDomain: "planning/documentation evidence; excluded from current runtime/catalog discovery",
    owner: "follow-up evidence history",
    retentionRationale: "Identity and reviewed scope are retained without promoting historical execution output to current evidence.",
    cleanupDecisionState: "retain-no-cleanup-authorized",
    currentUse: "lineage or source/static review boundary only",
  });
  return {
    artifact: path,
    identity: {
      sha256: record.sha256 ?? null,
      bytes: record.bytes ?? null,
      schema: parsed?.schema ?? null,
      generatedAt: parsed?.generatedAt ?? parsed?.capturedOn ?? null,
      sourceCommit: parsed?.sourceCommit ?? parsed?.source?.commit ?? parsed?.source?.parentCommit ?? null,
      state: parsed?.state ?? parsed?.status ?? null,
    },
    scope: "historic predecessor or accepted source/static evidence; not re-executed in F08",
    reproducibility: "historical-or-source-static-only",
    currentUse: "lineage, accepted dependency, or explicit source-static boundary",
  };
});

const boundaryDispositions = [
  {
    id: "paper-post-development-drying",
    path: acceptedEvidencePaths.f05Review,
    owner: "Chromatography curriculum/source owner",
    impact: "A teacher configuration gate can collect a drying note but does not authenticate the teacher or establish a scientifically authorized post-development drying method.",
    reason: "F05 source review retained the gate as a source limitation rather than an approved method.",
    nextAction: "Supply a source-authorized drying method through a separately reviewed curriculum/content change, or continue to disclose the limit.",
    verificationLimit: "Source/static review only; no classroom or physical procedure validation occurred.",
  },
  {
    id: "brass-blanking-versus-selected-method-calibration",
    path: acceptedEvidencePaths.f07Phase2Review,
    owner: "Brass spectroscopy source owner",
    impact: "Configured per-wavelength blanking and the source's two-stage selected-method calibration are distinct operations and must not be equated.",
    reason: "F07 phase 2 preserved the operational distinction while retaining source-bounded presentation text.",
    nextAction: "Retain the distinction in any future source, UI, or validation work; obtain supporting source material before asserting equivalence.",
    verificationLimit: "No checker, instrument, browser, runtime, or classroom validation occurred.",
  },
  {
    id: "green-heated-product-recovery-mass",
    path: acceptedEvidencePaths.f06Completion,
    owner: "Green chemistry source owner",
    impact: "Heated-product recovery remains qualitative with unknown mass; it cannot support a quantitative yield/recovery claim.",
    reason: "F06 preserved the accepted F04/F05 recovery contract instead of inventing a mass result.",
    nextAction: "Add a source-backed quantitative recovery procedure only through a separately reviewed content change.",
    verificationLimit: "No physical recovery measurement or runtime calculation verification occurred.",
  },
  {
    id: "contextual-provenance-enforcement",
    path: acceptedEvidencePaths.f07Phase1Review,
    owner: "Catalog policy/checker owner",
    impact: "Contextual provenance metadata is source-descriptive but is not enforced by the existing global checker.",
    reason: "F07 phase 1 explicitly records additive metadata without claiming checker enforcement.",
    nextAction: "If enforcement is desired, change and separately validate the central checker/policy boundary; do not call context metadata a current global provenance proof.",
    verificationLimit: "No policy/checker execution or clean global provenance result occurred.",
  },
];
for (const boundary of boundaryDispositions) {
  addDisposition({
    path: boundary.path,
    disposition: "open-source-boundary",
    tracking: trackingState(boundary.path),
    currentFile: currentFile(boundary.path),
    discoveryDomain: "accepted source/static review evidence",
    owner: boundary.owner,
    retentionRationale: "The reviewed record is retained so the boundary remains explicit rather than flattened into an unknown execution category.",
    cleanupDecisionState: "retain-no-cleanup-authorized",
    currentUse: "explicit source limitation",
    impact: boundary.impact,
    reason: boundary.reason,
    nextAction: boundary.nextAction,
    verificationLimit: boundary.verificationLimit,
  });
}

const authoringCounts = {
  indexedTechniqueDefinitions: indexedTechniqueIds.length,
  ownedTechniqueDefinitions: ownedTechniqueById.size,
  indexedRouteOnlyCarriers: dispositions.filter((row) => row.disposition === "indexed-route-only-carrier").length,
  indexedLabDefinitions: indexedLabIds.length,
  unindexedTechniqueShapedFiles: dispositions.filter((row) => row.disposition === "unindexed-generated-carrier").length,
  intentionalCustomRouteSettings: dispositions.filter((row) => row.disposition === "intentional-custom-route-settings").length,
  nonruntimeScreenshots: dispositions.filter((row) => row.disposition === "nonruntime-screenshot").length,
  protectedNestedBackups: dispositions.filter((row) => row.disposition === "preserved-nested-backup-not-traversed").length,
  historicalOrSourceStaticEvidenceArtifacts: historicalEvidence.length,
  openSourceBoundaries: boundaryDispositions.length,
};
const compileWitness = readOptionalJson(compileWitnessPath);
const compiledImpact = {
  status: staleInputPaths.length ? "stale" : "unknown",
  current: {
    witnessCompileCount: null,
    unionNodeCount: null,
    compiledActionCount: null,
    compiledInstanceCount: null,
    evaluatedConfigurations: null,
    note: "No F08 compiler witness was executed; current compiled impact is not established.",
  },
  historicalReference: compileWitness ? {
    artifact: compileWitnessPath,
    artifactSha256: stableSourceCollection.files[compileWitnessPath]?.sha256 ?? null,
    totals: compileWitness.totals ?? null,
    sourceIdentity: "not embedded in the historical witness; do not promote its totals to current evidence",
  } : null,
  unrepresentedConfigurations: "All teacher settings and runtime traversals outside the declared witness set remain unrepresented; the unindexed generated carrier was not evaluated by an F08 witness.",
};

const integrationRecordPaths = {
  F01: [`${followupPlanRoot}/evidence/F01_INTEGRATION.json`],
  F02: [`${followupPlanRoot}/evidence/F02_INTEGRATION.json`],
  F03: [acceptedEvidencePaths.f03Integration],
  F04: [`${followupPlanRoot}/evidence/F04_ROOT_FINAL_INTEGRATION.json`],
  F05: [`${followupPlanRoot}/evidence/F05_REMAINING_ROOT_INTEGRATION.json`, `${followupPlanRoot}/evidence/BRASS_FINAL_INTEGRATION.json`, `${followupPlanRoot}/evidence/GREEN_RECOVERY_ROOT_INTEGRATION.json`],
  F06: [`${followupPlanRoot}/evidence/F06_ROOT_INTEGRATION.json`],
  F07: [`${followupPlanRoot}/evidence/F07_PHASE1_ROOT_INTEGRATION.json`, `${followupPlanRoot}/evidence/F07_PHASE2_ROOT_INTEGRATION.json`],
};
const exactChangedPathsFor = (cycle) => unique(integrationRecordPaths[cycle]?.flatMap((path) => {
  const record = readOptionalJson(path);
  return asArray(record?.files).map((entry) => entry?.path).filter(Boolean);
}) ?? []);
const allowedF08Paths = [
  "scripts/reconcileCycle12Catalog.mjs",
  "scripts/writeFollowupClosure.mjs",
  "scripts/followupEvidenceContract.mjs",
  "scripts/__tests__/followupClosureEvidence.test.mjs",
  outputs.closure,
  outputs.closureMarkdown,
  outputs.catalogDispositions,
  outputs.sourceIdentity,
];
const cycleStates = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08"].map((cycle) => {
  const status = coordination?.cycles?.[cycle]?.status ?? "unknown";
  if (cycle === "F03") {
    return {
      cycle,
      implementationState: f03FinalIntegration.status,
      reviewGateState: "final-strict-parent-source-review-accepted",
      integrationState: "integrated",
      sourceDecisionState: "final-strict-bundled-activation-source-static-reviewed",
      verificationState: "execution-unverified-under-source-static-policy",
      exactChangedPaths: f03DeclaredFiles.map((entry) => entry.path),
      integrationRecords: [acceptedEvidencePaths.f03Integration],
      note: "F03 final-strict integration is a settled source/static dependency. No policy evaluator, runtime, or release acceptance is inferred.",
    };
  }
  if (cycle === "F08") {
    return {
      cycle,
      implementationState: "repair-candidate-source-static-authored",
      reviewGateState: "parent-critical-review-pending",
      integrationState: "not-integrated",
      sourceDecisionState: "repair-candidate-pending-parent-acceptance",
      verificationState: "execution-unverified-under-source-static-policy",
      exactChangedPaths: allowedF08Paths,
      integrationRecords: [],
      note: "This repair package refreshes F08 evidence after settled dependencies. Parent review and scoped integration remain pending and are not self-approved here.",
    };
  }
  return {
    cycle,
    implementationState: status,
    reviewGateState: status.includes("reviewed") || status.includes("integrated") ? "source-static-recorded" : "not-reverified-in-this-lane",
    integrationState: status.includes("integrated") ? "integrated" : "not-integrated",
    sourceDecisionState: "inherited-from-accepted-coordination-and-review-records",
    verificationState: "not-run-or-unverified-under-source-static-policy",
    exactChangedPaths: exactChangedPathsFor(cycle),
    integrationRecords: integrationRecordPaths[cycle] ?? [],
    note: "Status and exact changed paths are derived from preserved coordination/integration records; F08 did not reopen accepted work.",
  };
});

const openItems = [
  {
    id: "f08-parent-review-and-integration",
    owner: "Parent critical reviewer and integration owner",
    impact: "This repaired F08 package cannot be treated as integrated until parent review verifies the sealed candidate and explicitly selects paths for integration.",
    reason: "Authoring a candidate does not self-approve the review or integration gate.",
    nextAction: "Perform an independent source/static review of the sealed package, then decide whether to integrate the reviewed paths.",
    sourceDecision: "parent-review-pending",
    verificationLimit: "No integration, stage, commit, push, deploy, or runtime execution occurred in this lane.",
  },
  {
    id: "current-compiler-and-reconciliation",
    owner: "F08 coordinator",
    impact: "Structural composition, atomic identity, and evidence continuity remain stale or unknown as current closure categories.",
    reason: "The existing compiler witness is pre-F08 generated output and the reconciler was intentionally not run.",
    nextAction: "After separate authorization, collect a fresh witness, run reconciliation, refresh Cycle 09 overlays, run their checker, then run reconciler --check with each source identity recorded.",
    sourceDecision: "deferred-current-evidence-refresh",
    verificationLimit: "Current record contains static inventory/hashes only; no generated current audit is asserted.",
  },
  {
    id: "cycle09-feedback-edge",
    owner: "Cycle 09 coordinator",
    impact: "Refreshing audits can stale Cycle 09 observed audit hashes even when row decisions are unchanged.",
    reason: "The feedback edge has not been refreshed or checked in F08.",
    nextAction: "Run the documented Cycle 09 writer after fresh audits, then its checker, then the reconciliation deterministic check.",
    sourceDecision: "deferred-cycle09-overlay-refresh",
    verificationLimit: "No Cycle 09 writer/checker execution was authorized.",
  },
  ...boundaryDispositions.map((boundary) => ({
    id: boundary.id,
    owner: boundary.owner,
    impact: boundary.impact,
    reason: boundary.reason,
    nextAction: boundary.nextAction,
    sourceDecision: "explicit-source-boundary",
    verificationLimit: boundary.verificationLimit,
  })),
  {
    id: "repository-and-execution-verification",
    owner: "Repository QA/release owner",
    impact: "No current test, collection, type, build, browser, runtime, physical, classroom, or release acceptance can be claimed.",
    reason: "The authorized boundary is source/basic-static-only.",
    nextAction: "Obtain separate authorization and run each command with environment, source identity, collection completeness, and exit state recorded independently.",
    sourceDecision: "withheld-by-policy",
    verificationLimit: "This package records not-run/unknown states only and never converts historical results into current passes.",
  },
  {
    id: "unresolved-screenshot-retention",
    owner: "Named visual-artifact owner",
    impact: "Four non-runtime screenshots have no retained/archived/deleted owner decision.",
    reason: "The tracking state is separately recorded, but no current source/runtime reference or cleanup decision was reviewed.",
    nextAction: "Make a separately named retain/archive/delete decision and record its owner; do not use absence of references as a fidelity result.",
    sourceDecision: "unresolved-owner-decision",
    verificationLimit: "No visual or runtime validation was run.",
  },
  {
    id: "protected-nested-backup",
    owner: "Repository owner",
    impact: "The protected nested backup can contaminate broad discovery if traversed.",
    reason: "It is deliberately preserved and not recursively inspected under this task's boundary.",
    nextAction: "Handle cleanup or replacement only through a separately named user decision; preserve it in the meantime.",
    sourceDecision: "preserve-protected-boundary",
    verificationLimit: "Directory presence only was observed; the bounded tracking record did not establish an exact directory Git state.",
  },
];

const outcomeCategories = {
  structuralComposition: {
    status: "pending-current-reconciliation",
    sourceStaticBasis: "Current index/definition and ownership inventory is captured; fresh witness/reconciliation output is not available.",
    verificationStatus: "not-run",
  },
  atomicIdentity: {
    status: "unknown-current",
    sourceStaticBasis: "The atom registry and historical audit are identified, but the historical audit is not promoted to current evidence.",
    verificationStatus: "not-run",
  },
  evidenceContinuity: {
    status: "unknown-current",
    sourceStaticBasis: "Source-trace registry byte identity and row count are recorded; no current audit/checker continuity is asserted.",
    verificationStatus: "not-run",
  },
  f04BalanceDisplayContinuity: {
    status: "accepted-source-static-execution-unverified",
    sourceStaticBasis: "F04 final closure records accepted source-level balance-display continuity and mass/transfer repairs.",
    verificationStatus: "not-run",
  },
  f06SetupAndImportCompatibility: {
    status: "accepted-source-static-execution-unverified",
    sourceStaticBasis: "F06 completion records strict Green setup parsing and shared configured loader/import behavior at source/basic-static scope.",
    verificationStatus: "not-run",
  },
  f07VisualAndEditorialStatus: {
    status: "accepted-source-static-execution-unverified",
    sourceStaticBasis: "F07 phase records source-trace/visual/editorial decisions and their contextual-provenance enforcement limit.",
    verificationStatus: "not-run",
  },
  f03FinalStrictPolicyActivation: {
    status: "integrated-source-static-execution-unverified",
    sourceStaticBasis: "Accepted F03 final-strict review/integration record and all six declared destination bytes match the settled dependency identity.",
    verificationStatus: "not-run",
  },
  scientificProvenance: {
    status: "source-static-reviewed-with-explicit-open-boundaries",
    sourceStaticBasis: "F04-F07 outcomes are retained with the four concrete F05/F07/F06 source limitations, rather than flattened into an execution label.",
    verificationStatus: "not-run",
  },
  executedVerification: {
    status: "withheld-by-policy",
    sourceStaticBasis: "Every execution category is listed independently in evidenceRuns. Repository health remains unknown without a source-identity-bound complete run.",
    verificationStatus: "not-run",
  },
};

const authoringCountsForClosure = {
  ...authoringCounts,
  sourceTraceRegistryRows: asArray(sourceRegistry.traces).length,
  thermalTechniqueVersion: thermalTechnique.metadata?.version ?? null,
};
const closurePayload = {
  schema: "lab-studio/f08-current-closure@2",
  generatedAt: capturedAt,
  status: "repair-candidate-source-static-authored-parent-review-pending",
  authoringContext,
  validationBoundary: "Source/basic-static only: inspected source, JSON/hash/whitespace integrity, and bounded evidence authoring. No reconciler, witness, audit, checker, compiler, policy evaluator, test, typecheck, build, browser, runtime, physical, classroom, deployment, or release execution is claimed.",
  sourceIdentity: {
    path: outputs.sourceIdentity,
    capturedAt,
    payloadSha256: sourceIdentity.identitySeal.payloadSha256,
    sourceSnapshotPayloadSha256: currentSourceSnapshot.payloadSha256,
    reconciliationInputManifestSha256: reconciliationInputs.payloadSha256,
    stableDomain: currentSourceSnapshot.domain,
    stablePolicy: stableSourceIdentityPolicy,
    allowedF08Paths,
    predecessorIdentities: sourceIdentity.lineage,
  },
  acceptedDependencies: sourceIdentity.acceptedDependencies,
  cycleStates,
  evidenceRuns,
  repositoryHealthEvidence: broadRepositoryBaseline,
  inventory: {
    authoringCounts: authoringCountsForClosure,
    compiledImpact,
    dispositions,
    sourceObservations: {
      indexedTechniqueCount: indexedTechniqueIds.length,
      ownedTechniqueCount: ownedTechniqueById.size,
      indexedLabCount: indexedLabIds.length,
      sourceTraceRegistryRows: asArray(sourceRegistry.traces).length,
      thermalTechniqueVersion: thermalTechnique.metadata?.version ?? null,
      acidBaseSettingsInvestigationId: acidBaseSettings.investigationId,
    },
  },
  outcomeCategories,
  openItems,
  historicalEvidence,
  deferredExecutionOrdering: [
    "1. Obtain parent review and any explicitly authorized integration decision for this F08 package.",
    "2. Collect a fresh Cycle 12 compiler witness with its own source identity.",
    "3. Run the reconciler write and record current audit/report identity.",
    "4. Refresh Cycle 09 overlays from the fresh audits.",
    "5. Run the Cycle 09 checker against those fresh audit hashes.",
    "6. Run reconciler --check after the Cycle 09 feedback edge.",
    "7. Run the scientific verifier only if separately authorized, and identify whether it follows the Cycle 09 refresh.",
  ],
  preservation: {
    historicalLedger: "unchanged",
    historicalCycle12Outputs: "not overwritten by this writer",
    revision9: "reviewed-frozen historical lineage preserved",
    revision10: "candidate-not-frozen preserved",
    protectedNestedBackup: "not recursively inspected or deleted",
    cleanup: "no deletion, relocation, or cleanup",
  },
};

const catalogPayload = {
  schema: "lab-studio/f08-catalog-dispositions@2",
  generatedAt: capturedAt,
  sourceIdentity: {
    path: outputs.sourceIdentity,
    payloadSha256: sourceIdentity.identitySeal.payloadSha256,
    sourceSnapshotPayloadSha256: currentSourceSnapshot.payloadSha256,
    fileCount: currentSourceSnapshot.fileCount,
    stableDomain: currentSourceSnapshot.domain,
  },
  trackingObservation,
  vocabulary: [
    "indexed-runtime-definition",
    "indexed-route-only-carrier",
    "unindexed-generated-carrier",
    "intentional-custom-route-settings",
    "nonruntime-screenshot",
    "preserved-nested-backup-not-traversed",
    "historical-or-source-static-evidence",
    "open-source-boundary",
  ],
  accounting: authoringCountsForClosure,
  dispositions,
  noCleanupStatement: "F08 performs no deletion, relocation, or cleanup. An unresolved owner decision is not a fidelity result.",
};
const catalogDispositions = {
  ...catalogPayload,
  identitySeal: makePayloadSeal(catalogPayload, "CATALOG_DISPOSITIONS payload excluding identitySeal"),
};

const closureMarkdown = [
  "# F08 current-evidence repair candidate",
  "",
  `Captured at ${capturedAt}. Status: **repair-candidate-source-static-authored-parent-review-pending**. This is not F08 integration evidence.`,
  "",
  "## Stable source identity",
  "",
  `- Stable application/evidence domain: ${currentSourceSnapshot.fileCount} files; sealed payload SHA-256 \`${currentSourceSnapshot.payloadSha256}\`.`,
  `- Reconciliation input manifest: \`${reconciliationInputs.payloadSha256}\`; completeness \`${reconciliationInputs.completeness}\`, freshness \`${reconciliationInputs.freshness}\`.`,
  "- The domain detects relevant application/content and accepted-predecessor additions, removals, links/reparse points, and byte changes. It explicitly excludes only generated F08 artifacts, bounded mutable parent status/log bookkeeping, bounded F08 parent review/integration records, the eight exact nonruntime preparation artifacts declared by the stable policy, non-source dependency/build directories, and the protected uninspected nested backup. It does not exclude archive or compiler-cache extensions generally.",
  `- The finite nonruntime preparation boundary contains ${stableSourceIdentityPolicy.nonruntimePreparationBoundary.exactFilePaths.length} exact authority-observed paths absent from this candidate; no local candidate bytes or archive contents are claimed for them.`,
  `- Dated non-freshness observations record the mutable parent status/log and ${f08ReviewIntegrationObservation.records.length} matching F08 parent review/integration record(s); those coordination records neither establish nor stale application/evidence byte freshness.`,
  `- F03 final-strict dependency: ${f03DependencyIntegrity.matchesAcceptedDependency ? "accepted record and six declared destination bytes match" : "mismatch; authoring is blocked"}. Its execution remains unverified.`,
  "- Repository-wide health: **unknown**. It remains unknown unless a specifically complete, source-identity-bound run proves it; catalog freshness cannot promote it.",
  "",
  "## Reviewed source/static outcomes retained",
  "",
  ...acceptedSourceStaticOutcomes.map((outcome) => `- **${outcome.cycle}** - ${outcome.outcome} Limit: ${outcome.executionLimit}`),
  "",
  "## Explicit source boundaries",
  "",
  ...boundaryDispositions.map((boundary) => `- **${boundary.id}** - owner: ${boundary.owner}; impact: ${boundary.impact} Reason: ${boundary.reason} Next: ${boundary.nextAction} Limit: ${boundary.verificationLimit}`),
  "",
  "## Current inventory boundaries",
  "",
  `- Public catalog: ${indexedTechniqueIds.length} indexed techniques (${ownedTechniqueById.size} ownership rows plus one explicit route-only entry) and ${indexedLabIds.length} indexed labs.`,
  `- Source-trace registry: ${asArray(sourceRegistry.traces).length} rows as a static byte observation; this is not a source-trace checker result.`,
  `- Unindexed generated carrier: \`${carrierPath}\` remains retained for direct generated-family consumers and is not called retired.`,
  `- Custom route settings: \`${settingsPath}\` remains intentional configuration outside generic lab-definition discovery.`,
  `- Non-runtime screenshots: ${authoringCounts.nonruntimeScreenshots}; each tracking state is taken only from the supplied bounded Git snapshot.`,
  `- Protected nested backup: \`${backupPath}/\` is not recursively inspected; its exact tracking state is unknown when the snapshot has no exact entry.`,
  "",
  "## Deferred verification order",
  "",
  "Every execution category is independently recorded in `CLOSURE.json` with command, environment, source identity, collection completeness, exit state, freshness, and limitations. Tests, typecheck, build, browser/runtime, compiler, checker, policy, physical, and release results are not-run or withheld by policy.",
  "",
  ...closurePayload.deferredExecutionOrdering.map((item) => `- ${item}`),
  "",
  "## Lineage and open items",
  "",
  "Revision 9 remains reviewed-frozen historical lineage. Revision 10 remains candidate-not-frozen; no historical checksum is invented. F03 final strict is a settled source/static dependency, while F08 parent review and integration remain pending.",
  "",
  ...openItems.map((item) => `- **${item.id}** - owner: ${item.owner}; impact: ${item.impact} Reason: ${item.reason} Next: ${item.nextAction} Limit: ${item.verificationLimit}`),
  "",
  "No historical Cycle 12 outputs, ledgers, overlays, public generated definitions, or protected backups were changed. No deletion, relocation, cleanup, integration, publish, or deployment occurred.",
  "",
].join("\n");

const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const writeOutput = (relativePath, value) => writeFileSync(join(root, relativePath), typeof value === "string" ? value : jsonText(value), "utf8");
const artifactHash = (relativePath) => {
  const bytes = readFileSync(join(root, relativePath));
  return { path: relativePath, sha256: sha256Bytes(bytes), bytes: bytes.byteLength };
};

if (writeRequested) {
  if (stableSourceCollection.filesystemBoundary.reparsePoints.length || stableSourceCollection.filesystemBoundary.walkErrors.length) {
    throw new Error(`F08 stable source identity is blocked by filesystem boundary: ${JSON.stringify(stableSourceCollection.filesystemBoundary)}`);
  }
  if (inputSpecification.derivationErrors.length || missingRequiredPaths.length) {
    throw new Error(`F08 reconciliation input contract is incomplete: ${JSON.stringify({ derivationErrors: inputSpecification.derivationErrors, missingRequiredPaths })}`);
  }
  mkdirSync(join(root, followupEvidenceRoot), { recursive: true });
  writeOutput(outputs.sourceIdentity, sourceIdentity);
  writeOutput(outputs.catalogDispositions, catalogDispositions);
  writeOutput(outputs.closureMarkdown, closureMarkdown);
  const artifactRefs = {
    sourceIdentity: artifactHash(outputs.sourceIdentity),
    catalogDispositions: artifactHash(outputs.catalogDispositions),
    closureMarkdown: artifactHash(outputs.closureMarkdown),
  };
  const finalClosurePayload = {
    ...closurePayload,
    artifacts: {
      ...artifactRefs,
      closure: { path: outputs.closure, sha256: "recorded by the outer delivery manifest; omitted here to avoid circular self-hashing" },
    },
  };
  writeOutput(outputs.closure, {
    ...finalClosurePayload,
    identitySeal: makePayloadSeal(finalClosurePayload, "CLOSURE payload excluding identitySeal and excluding its own artifact hash"),
  });
  console.log(`F08 closure artifacts authored: ${Object.values(outputs).join(", ")}`);
}

if (checkRequested) {
  for (const relativePath of Object.values(outputs)) {
    if (!existsSync(join(root, relativePath))) throw new Error(`Missing F08 closure artifact: ${relativePath}`);
    if (relativePath.endsWith(".json")) JSON.parse(readText(relativePath));
  }
  console.log("F08 closure artifact JSON parsing passed; no application validation was executed.");
}
