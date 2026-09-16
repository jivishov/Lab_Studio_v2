import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReconciliationInputPayload,
  canonicalJson,
  deriveReconciliationInputSpecification,
  inspectF08SourceIdentity,
  makePayloadSeal,
  makeStableSourceSnapshot,
  sha256Text,
  stableDomainExclusion,
} from "../followupEvidenceContract.mjs";

const test = process.env.VITEST || globalThis.__vitest_worker__
  ? (await import("vitest")).test
  : (await import("node:test")).default;

const appRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "../.."));
const evidenceRoot = join(appRoot, "planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current");
const readJson = (name) => JSON.parse(readFileSync(join(evidenceRoot, name), "utf8"));

const fixtureFiles = {
  "inputs/a.json": { sha256: "a".repeat(64), bytes: 11 },
  "inputs/b.json": { sha256: "b".repeat(64), bytes: 17 },
};
const finiteNonruntimePreparationPaths = [
  "Lab_Studio_GPT_Pro_MCP_Handoff_2026-07-17.zip",
  "Lab_Studio_Maintainable_Source_Handoff_2026-07-26.zip",
  "Lab_Studio_Scientific_Simulator_Handoff_2026-07-14.zip",
  "Refined_Implementation_Plan_2026-07-18.zip",
  "hand_warmer/hand-warmer-calorimetry-phase16-complete-2026-07-27.zip",
  "tsconfig.app.tsbuildinfo",
  "tsconfig.learning.tsbuildinfo",
  "tsconfig.node.tsbuildinfo",
];
const sealIdentity = (payload) => ({
  ...payload,
  identitySeal: makePayloadSeal(payload, "fixture identity payload excluding identitySeal"),
});
const makeFixtureIdentity = ({
  health,
  evidenceRuns,
  sourceFiles = fixtureFiles,
  requiredFiles = Object.entries(sourceFiles).map(([path, record]) => ({ path, ...record })),
  missingRequiredPaths = [],
  optionalMissingPaths = [],
  staleInputPaths = [],
  staleInputReasons = {},
  historicalInputPaths = [],
} = {}) => {
  const sourceSnapshot = makeStableSourceSnapshot({ files: sourceFiles });
  const reconciliationPayload = buildReconciliationInputPayload({
    requiredFiles,
    missingRequiredPaths,
    optionalMissingPaths,
    staleInputPaths,
    staleInputReasons,
    historicalInputPaths,
  });
  const sourceIdentity = {
    sourceSnapshotPayloadSha256: sourceSnapshot.payloadSha256,
    reconciliationInputManifestSha256: sha256Text(JSON.stringify(reconciliationPayload)),
  };
  const defaultHealth = {
    status: "unknown",
    command: "npm run content:check",
    sourceIdentity,
    collectionCompleteness: "unattempted",
    exitStatus: "not-run",
  };
  const defaultRuns = [{
    category: "static-authoring",
    sourceIdentity,
    collectionCompleteness: "unattempted",
    exitStatus: "not-run",
  }];
  const payload = {
    schema: "lab-studio/f08-source-identity@2",
    capturedAt: "2026-09-12T00:00:00.000Z",
    sourceSnapshot,
    reconciliationInputs: {
      ...reconciliationPayload,
      completeness: missingRequiredPaths.length === 0 ? "complete" : "incomplete",
      freshness: missingRequiredPaths.length || staleInputPaths.length ? "stale" : "current",
      payloadSha256: sourceIdentity.reconciliationInputManifestSha256,
    },
    repositoryHealth: { broadRepositoryBaseline: health ?? defaultHealth },
    evidenceRuns: evidenceRuns ?? defaultRuns,
  };
  return sealIdentity(payload);
};
const inspectFixture = (identity, {
  expectedReconciliationPaths = Object.keys(fixtureFiles),
  observedStableFiles = fixtureFiles,
  observedBoundary = [],
} = {}) => inspectF08SourceIdentity({
  identity,
  expectedReconciliationPaths,
  observedStableFiles,
  observedBoundary,
});
const makeCompleteCurrentRun = (sourceIdentity, overrides = {}) => ({
  category: "repository-content-check",
  status: "complete-current-run",
  command: "npm run content:check",
  environment: { runtime: "v24.18.0", platform: "win32", cwd: "C:/candidate/Lab_studio" },
  sourceIdentity,
  inputs: ["candidate repository source tree"],
  outputs: ["content-check-output.txt"],
  collectionCompleteness: "complete",
  exitStatus: "passed",
  freshness: "current",
  result: {
    recordedAt: "2026-09-12T00:00:01.000Z",
    summary: "content check completed without recorded failures",
    outputSha256: "c".repeat(64),
  },
  ...overrides,
});

test("F08 evidence keeps current-source identity separate from executable acceptance", () => {
  const closure = readJson("CLOSURE.json");
  const sourceIdentity = readJson("SOURCE_IDENTITY.json");
  const dispositions = readJson("CATALOG_DISPOSITIONS.json");

  assert.equal(closure.status, "repair-candidate-source-static-authored-parent-review-pending");
  assert.match(closure.validationBoundary, /no .*execution/i);
  assert.equal(closure.outcomeCategories.executedVerification.verificationStatus, "not-run");
  assert.equal(sourceIdentity.schema, "lab-studio/f08-source-identity@2");
  assert.equal(sourceIdentity.reconciliationInputs.freshness, "stale");
  assert.ok(sourceIdentity.reconciliationInputs.staleInputPaths.includes("planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json"));
  assert.ok(sourceIdentity.exclusions.stableDomainPolicy.protectedUninspectedPrefix.endsWith("phase7-work"));
  assert.ok(!Object.keys(sourceIdentity.sourceSnapshot.files).some((path) => path.includes("hand-warmer-calorimetry-phase16-complete-2026-07-27/phase7-work/")));
  assert.equal(closure.cycleStates.find((state) => state.cycle === "F03").integrationState, "integrated");
  assert.equal(closure.cycleStates.find((state) => state.cycle === "F08").integrationState, "not-integrated");

  const counts = dispositions.dispositions.reduce((accumulator, row) => {
    accumulator[row.disposition] = (accumulator[row.disposition] ?? 0) + 1;
    return accumulator;
  }, {});
  assert.equal(counts["indexed-route-only-carrier"], 1);
  assert.equal(counts["unindexed-generated-carrier"], 1);
  assert.equal(counts["intentional-custom-route-settings"], 1);
  assert.equal(counts["nonruntime-screenshot"], 4);
  assert.equal(counts["open-source-boundary"], 4);
  assert.ok(existsSync(join(evidenceRoot, "CLOSURE.md")));
});

test("F08 evidence rejects a complete-flag identity that omits an independently required input", () => {
  const identity = makeFixtureIdentity();
  const truncatedInputs = {
    ...identity.reconciliationInputs,
    requiredFiles: [identity.reconciliationInputs.requiredFiles[0]],
    missingRequiredPaths: [],
    completeness: "complete",
  };
  const truncatedPayload = buildReconciliationInputPayload({
    requiredFiles: truncatedInputs.requiredFiles,
    missingRequiredPaths: [],
    optionalMissingPaths: [],
    staleInputPaths: [],
    staleInputReasons: {},
    historicalInputPaths: [],
  });
  truncatedInputs.payloadSha256 = sha256Text(JSON.stringify(truncatedPayload));
  const repairedSeal = sealIdentity({ ...identity, reconciliationInputs: truncatedInputs, identitySeal: undefined });
  delete repairedSeal.identitySeal.payloadScope;
  const result = inspectFixture(repairedSeal);

  assert.equal(result.status, "unknown");
  assert.ok(result.contractErrors.some((error) => error.includes("omits independently derived required path inputs/b.json")));
});

test("F08 evidence keeps a sealed declared-missing required input stale", () => {
  const observedStableFiles = {
    "inputs/a.json": fixtureFiles["inputs/a.json"],
  };
  const identity = makeFixtureIdentity({
    sourceFiles: observedStableFiles,
    requiredFiles: [{ path: "inputs/a.json", ...fixtureFiles["inputs/a.json"] }],
    missingRequiredPaths: ["inputs/b.json"],
  });
  const result = inspectFixture(identity, {
    expectedReconciliationPaths: Object.keys(fixtureFiles),
    observedStableFiles,
  });

  assert.equal(result.status, "stale");
  assert.deepEqual(result.missingRequiredPaths, ["inputs/b.json"]);
  assert.equal(result.contractErrors.length, 0);
  assert.match(result.reason, /missing required input\(s\): inputs\/b\.json/);
});

test("F08 evidence rejects tampered identity payloads, path escapes, duplicate dependencies, and run provenance", () => {
  const identity = makeFixtureIdentity();
  const tampered = {
    ...identity,
    evidenceRuns: [{
      ...identity.evidenceRuns[0],
      sourceIdentity: {
        ...identity.evidenceRuns[0].sourceIdentity,
        sourceSnapshotPayloadSha256: "c".repeat(64),
      },
    }],
  };
  const tamperedResult = inspectFixture(tampered);
  assert.equal(tamperedResult.status, "unknown");
  assert.ok(tamperedResult.contractErrors.some((error) => error.includes("payload seal")));

  const malformedInputs = {
    ...identity.reconciliationInputs,
    requiredFiles: [
      identity.reconciliationInputs.requiredFiles[0],
      identity.reconciliationInputs.requiredFiles[0],
      { path: "../escape.json", sha256: "d".repeat(64), bytes: 1 },
    ],
  };
  const malformedIdentity = sealIdentity({ ...identity, reconciliationInputs: malformedInputs, identitySeal: undefined });
  const malformedResult = inspectFixture(malformedIdentity);
  assert.equal(malformedResult.status, "unknown");
  assert.ok(malformedResult.contractErrors.some((error) => /duplicate|requiredFiles|escapes/.test(error)));

  const provenanceIdentity = makeFixtureIdentity({
    evidenceRuns: [{
      category: "static-authoring",
      sourceIdentity: {
        sourceSnapshotPayloadSha256: "e".repeat(64),
        reconciliationInputManifestSha256: "f".repeat(64),
      },
      collectionCompleteness: "unattempted",
      exitStatus: "not-run",
    }],
  });
  const provenanceResult = inspectFixture(provenanceIdentity);
  assert.equal(provenanceResult.status, "unknown");
  assert.ok(provenanceResult.contractErrors.some((error) => error.includes("not bound to this source identity")));
});

test("F08 source policy excludes bounded bookkeeping but detects included application add, removal, and byte changes", () => {
  const planRoot = "planning/2026-09-08_catalog-fidelity-follow-up";
  assert.equal(stableDomainExclusion(`${planRoot}/ORCHESTRATION_STATUS.json`), "mutable-coordination-bookkeeping");
  assert.equal(stableDomainExclusion(`${planRoot}/evidence/REMAINING_LUNA_ORCHESTRATION.md`), "mutable-coordination-bookkeeping");
  assert.equal(stableDomainExclusion(`${planRoot}/evidence/F08_TERRA_REPAIR_02_ROOT_REVIEW.md`), "f08-parent-review-or-integration-bookkeeping");
  assert.equal(stableDomainExclusion(`${planRoot}/evidence/F08_TERRA_REPAIR_02_ROOT_INTEGRATION.json`), "f08-parent-review-or-integration-bookkeeping");
  assert.equal(stableDomainExclusion(`${planRoot}/evidence/F08_PREPARATION.md`), null);
  assert.equal(stableDomainExclusion("src/runtime/current-source.js"), null);

  const identity = makeFixtureIdentity();
  const byteChanged = inspectFixture(identity, {
    observedStableFiles: {
      ...fixtureFiles,
      "inputs/a.json": { sha256: "d".repeat(64), bytes: fixtureFiles["inputs/a.json"].bytes },
    },
  });
  assert.equal(byteChanged.status, "stale");
  assert.ok(byteChanged.mismatches.some((message) => message.includes("inputs/a.json byte identity changed")));

  const added = inspectFixture(identity, {
    observedStableFiles: {
      ...fixtureFiles,
      "src/runtime/current-source.js": { sha256: "e".repeat(64), bytes: 23 },
    },
  });
  assert.equal(added.status, "stale");
  assert.ok(added.mismatches.some((message) => message.includes("src/runtime/current-source.js was added")));

  const removed = inspectFixture(identity, {
    observedStableFiles: {
      "inputs/b.json": fixtureFiles["inputs/b.json"],
    },
  });
  assert.equal(removed.status, "stale");
  assert.ok(removed.mismatches.some((message) => message.includes("inputs/a.json is missing")));
});

test("F08 source policy uses a finite nonruntime preparation boundary without archive or cache extension leakage", () => {
  for (const path of finiteNonruntimePreparationPaths) {
    assert.equal(stableDomainExclusion(path), "finite-nonruntime-preparation-boundary", `${path} must be an exact finite exclusion`);
  }
  const includedNearMisses = [
    "public/assets/downloads/runtime-protocol.zip",
    "archives/Refined_Implementation_Plan_2026-07-18.zip",
    "tsconfig.app.tsbuildinfo.backup",
    "src/runtime/current-source.ts",
  ];
  for (const path of includedNearMisses) assert.equal(stableDomainExclusion(path), null, `${path} must remain in the stable domain`);

  const downloadableZip = "public/assets/downloads/runtime-protocol.zip";
  const result = inspectFixture(makeFixtureIdentity(), {
    observedStableFiles: {
      ...fixtureFiles,
      [downloadableZip]: { sha256: "e".repeat(64), bytes: 23 },
    },
  });
  assert.equal(result.status, "stale");
  assert.ok(result.mismatches.some((message) => message.includes(`${downloadableZip} was added`)));
});

test("F08 direct inputs share the real stable-domain contract and retain application change sensitivity", () => {
  const oldPlanRoot = "planning/2026-08-30_lab-studio-technique-composition-remediation";
  const followupPlanRoot = "planning/2026-09-08_catalog-fidelity-follow-up";
  const ownReviewPath = `${followupPlanRoot}/evidence/F08_LUNA_ROOT_CRITICAL_REVIEW.md`;
  const sourceIdentity = readJson("SOURCE_IDENTITY.json");
  const stableFiles = sourceIdentity.sourceSnapshot.files;
  const techniqueIndex = JSON.parse(readFileSync(join(appRoot, "public/techniques/index.json"), "utf8"));
  const labIndex = JSON.parse(readFileSync(join(appRoot, "public/labs/index.json"), "utf8"));
  const f03Integration = JSON.parse(readFileSync(join(appRoot, `${followupPlanRoot}/evidence/F03_FINAL_STRICT_ROOT_INTEGRATION.json`), "utf8"));
  const derive = (availablePaths) => deriveReconciliationInputSpecification({
    oldPlanRoot,
    followupPlanRoot,
    techniqueIndex,
    labIndex,
    availablePaths,
    acceptedDependencyPaths: f03Integration.files.map((entry) => entry.path),
  });
  const directInputPayload = (specification, files) => buildReconciliationInputPayload({
    requiredFiles: specification.requiredPaths
      .filter((path) => files[path])
      .map((path) => ({ path, ...files[path] })),
    missingRequiredPaths: specification.requiredPaths.filter((path) => !files[path]),
    optionalMissingPaths: specification.optionalMissingPaths,
    staleInputPaths: sourceIdentity.reconciliationInputs.staleInputPaths,
    staleInputReasons: sourceIdentity.reconciliationInputs.staleInputReasons,
    historicalInputPaths: sourceIdentity.reconciliationInputs.historicalInputPaths,
  });
  const stableFilesAfterExcludedReviewChange = (record) => Object.fromEntries(
    Object.entries({ ...stableFiles, [ownReviewPath]: record })
      .filter(([path]) => !stableDomainExclusion(path)),
  );
  const baseline = derive(new Set(Object.keys(stableFiles)));

  assert.deepEqual(sourceIdentity.reconciliationInputs.independentlyDerivedRequiredPaths, baseline.requiredPaths);
  assert.deepEqual(baseline.derivationErrors, []);
  assert.ok(!baseline.requiredPaths.includes(ownReviewPath));
  assert.equal(stableDomainExclusion(ownReviewPath), "f08-parent-review-or-integration-bookkeeping");
  for (const path of finiteNonruntimePreparationPaths) assert.ok(!baseline.requiredPaths.includes(path), `${path} must not become a derived reconciliation input`);
  for (const path of baseline.requiredPaths) assert.equal(stableDomainExclusion(path), null, `${path} must not be excluded from the stable domain`);
  assert.equal(sourceIdentity.reconciliationInputs.requiredFiles.length, baseline.requiredPaths.length);
  for (const record of sourceIdentity.reconciliationInputs.requiredFiles) {
    assert.deepEqual({ sha256: record.sha256, bytes: record.bytes }, stableFiles[record.path]);
  }

  const reviewAdded = stableFilesAfterExcludedReviewChange({ sha256: "a".repeat(64), bytes: 1 });
  const reviewEdited = stableFilesAfterExcludedReviewChange({ sha256: "b".repeat(64), bytes: 2 });
  assert.deepEqual(reviewAdded, stableFiles);
  assert.deepEqual(reviewEdited, stableFiles);
  const afterReviewAdded = derive(new Set(Object.keys(reviewAdded)));
  const afterReviewEdited = derive(new Set(Object.keys(reviewEdited)));
  assert.deepEqual(afterReviewAdded.requiredPaths, baseline.requiredPaths);
  assert.deepEqual(afterReviewEdited.requiredPaths, baseline.requiredPaths);
  const baselineIdentity = sha256Text(canonicalJson(directInputPayload(baseline, stableFiles)));
  assert.equal(baselineIdentity, sourceIdentity.reconciliationInputs.payloadSha256);
  assert.equal(sha256Text(canonicalJson(directInputPayload(afterReviewAdded, reviewAdded))), baselineIdentity);
  assert.equal(sha256Text(canonicalJson(directInputPayload(afterReviewEdited, reviewEdited))), baselineIdentity);

  const applicationPath = "scripts/reconcileCycle12Catalog.mjs";
  const inspect = (observedStableFiles) => inspectF08SourceIdentity({
    identity: sourceIdentity,
    expectedReconciliationPaths: baseline.requiredPaths,
    observedStableFiles,
  });
  const byteChanged = inspect({
    ...stableFiles,
    [applicationPath]: { sha256: "c".repeat(64), bytes: stableFiles[applicationPath].bytes },
  });
  assert.ok(byteChanged.mismatches.some((message) => message.includes(`${applicationPath} byte identity changed`)));
  const removed = { ...stableFiles };
  delete removed[applicationPath];
  assert.ok(inspect(removed).mismatches.some((message) => message.includes(`${applicationPath} is missing`)));
  const added = inspect({
    ...stableFiles,
    "src/domain/f08-contract-probe.mjs": { sha256: "d".repeat(64), bytes: 3 },
  });
  assert.ok(added.mismatches.some((message) => message.includes("src/domain/f08-contract-probe.mjs was added")));
});

test("F08 denies passing health and run promotion for stale, malformed, incomplete, or boundary-affected source", () => {
  const initial = makeFixtureIdentity();
  const sourceIdentity = initial.evidenceRuns[0].sourceIdentity;
  const completeHealth = makeCompleteCurrentRun(sourceIdentity);
  const completeRun = makeCompleteCurrentRun(sourceIdentity, { category: "cycle12-reconciliation" });
  const current = inspectFixture(makeFixtureIdentity({ health: completeHealth, evidenceRuns: [completeRun] }));
  assert.equal(current.status, "current");
  assert.equal(current.repositoryHealth.status, "complete-current-run");
  assert.equal(current.currentEvidenceRuns.length, 1);

  const byteDrift = inspectFixture(makeFixtureIdentity({ health: completeHealth, evidenceRuns: [completeRun] }), {
    observedStableFiles: {
      ...fixtureFiles,
      "inputs/a.json": { sha256: "f".repeat(64), bytes: fixtureFiles["inputs/a.json"].bytes },
    },
  });
  assert.equal(byteDrift.status, "stale");
  assert.equal(byteDrift.repositoryHealth.status, "unknown");
  assert.equal(byteDrift.currentEvidenceRuns.length, 0);

  const tampered = makeFixtureIdentity({ health: completeHealth, evidenceRuns: [completeRun] });
  tampered.sourceSnapshot.payloadSha256 = "a".repeat(64);
  const tamperedResult = inspectFixture(tampered);
  assert.equal(tamperedResult.status, "unknown");
  assert.equal(tamperedResult.repositoryHealth.status, "unknown");
  assert.equal(tamperedResult.currentEvidenceRuns.length, 0);

  const incompleteClaim = makeCompleteCurrentRun(sourceIdentity, {
    category: "cycle12-reconciliation",
    result: undefined,
  });
  const incompleteResult = inspectFixture(makeFixtureIdentity({ health: completeHealth, evidenceRuns: [incompleteClaim] }));
  assert.equal(incompleteResult.status, "unknown");
  assert.ok(incompleteResult.contractErrors.some((error) => error.includes("incomplete result provenance")));
  assert.equal(incompleteResult.currentEvidenceRuns.length, 0);

  const boundaryResult = inspectFixture(makeFixtureIdentity({ health: completeHealth, evidenceRuns: [completeRun] }), {
    observedBoundary: [{ path: "src", reason: "symbolic-link-or-reparse-point" }],
  });
  assert.equal(boundaryResult.status, "unknown");
  assert.equal(boundaryResult.repositoryHealth.status, "unknown");
  assert.equal(boundaryResult.currentEvidenceRuns.length, 0);
});

test("F08 repository health remains unknown without a complete current source-identity-bound run", () => {
  const identity = makeFixtureIdentity();
  const unknown = inspectFixture(identity);
  assert.equal(unknown.status, "current");
  assert.equal(unknown.repositoryHealth.status, "unknown");

  const sourceIdentity = identity.evidenceRuns[0].sourceIdentity;
  const completeHealth = makeCompleteCurrentRun(sourceIdentity);
  const complete = inspectFixture(makeFixtureIdentity({ health: completeHealth }));
  assert.equal(complete.repositoryHealth.status, "complete-current-run");

  const incompleteHealth = {
    ...completeHealth,
    status: "passed",
  };
  const incomplete = inspectFixture(makeFixtureIdentity({ health: incompleteHealth }));
  assert.equal(incomplete.repositoryHealth.status, "unknown");
});
