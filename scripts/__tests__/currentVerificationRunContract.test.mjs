import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  currentVerificationPhaseLogPath,
  currentVerificationPhaseOutputPaths,
  currentVerificationPhaseSpecification,
  currentVerificationPredecessorCopyPath,
  currentVerificationRunPath,
  currentVerificationStableDomainExclusion,
  deriveCurrentVerificationSourceProvenance,
  inspectCurrentVerificationRun,
  makeCurrentVerificationSourceSnapshot,
  normalizeCurrentVerificationRunId,
  sealCurrentVerificationRun,
  sha256Text,
  stableDomainExclusion,
} from "../followupEvidenceContract.mjs";

const test = process.env.VITEST || globalThis.__vitest_worker__
  ? (await import("vitest")).test
  : (await import("node:test")).default;

const runId = "batch3-current-proof";
const clone = (value) => JSON.parse(JSON.stringify(value));
const record = (path, salt, bytes = salt.length + 11) => ({ path, sha256: sha256Text(`${path}:${salt}`), bytes });

const sourceInputPaths = [...new Set(currentVerificationPhaseSpecification
  .flatMap((phase) => phase.requiredInputPaths)
  .filter((path) => !currentVerificationPhaseOutputPaths.includes(path)))];
const sourceFiles = Object.fromEntries(sourceInputPaths.map((path, index) => {
  const value = record(path, `source-${index}`, index + 31);
  return [path, { sha256: value.sha256, bytes: value.bytes }];
}));
const generatedOutputs = Object.fromEntries(currentVerificationPhaseOutputPaths.map((path, index) => {
  const value = record(path, `generated-${index}`, index + 71);
  return [path, { sha256: value.sha256, bytes: value.bytes }];
}));

const makeFixture = ({ phases = currentVerificationPhaseSpecification, runIdOverride = runId } = {}) => {
  const sourceSnapshot = makeCurrentVerificationSourceSnapshot({ files: sourceFiles });
  const predecessorArtifacts = currentVerificationPhaseOutputPaths.map((sourcePath, index) => {
    const source = record(sourcePath, `predecessor-${index}`, index + 101);
    const copyPath = currentVerificationPredecessorCopyPath(runIdOverride, sourcePath);
    return {
      sourcePath,
      source: { ...source, exists: true },
      preservedCopy: { path: copyPath, sha256: source.sha256, bytes: source.bytes },
    };
  });
  const observedArtifacts = {};
  for (const entry of predecessorArtifacts) {
    observedArtifacts[entry.preservedCopy.path] = { sha256: entry.preservedCopy.sha256, bytes: entry.preservedCopy.bytes };
  }
  for (const [path, value] of Object.entries(generatedOutputs)) observedArtifacts[path] = { ...value };
  const phaseRecords = phases.map((specification, phaseIndex) => {
    const inputs = specification.requiredInputPaths.map((path) => sourceFiles[path]
      ? { path, ...sourceFiles[path] }
      : specification.id === "cycle12-reconciliation" && path.includes("/evidence/lane-09/") && predecessorArtifacts.some((entry) => entry.sourcePath === path)
        ? (() => {
          const predecessor = predecessorArtifacts.find((entry) => entry.sourcePath === path).source;
          return { path, sha256: predecessor.sha256, bytes: predecessor.bytes };
        })()
      : { path, ...generatedOutputs[path] });
    const outputs = specification.outputPaths.map((path) => ({ path, ...generatedOutputs[path] }));
    const logPath = currentVerificationPhaseLogPath(runIdOverride, specification.id);
    const log = record(logPath, `log-${phaseIndex}`, phaseIndex + 211);
    observedArtifacts[log.path] = { sha256: log.sha256, bytes: log.bytes };
    return {
      id: specification.id,
      command: specification.command,
      environment: { runtime: "v24.18.0", platform: "win32/x64", cwd: "candidate-root" },
      sourceSnapshotPayloadSha256: sourceSnapshot.payloadSha256,
      inputs,
      outputs,
      collectionCompleteness: "complete",
      exitStatus: "passed",
      freshness: "current",
      execution: {
        launcher: "process.execPath",
        launched: true,
        launchError: null,
        timedOut: false,
        timeoutMs: 900_000,
        timeoutKillRequested: false,
        exitCode: 0,
        signal: null,
        outcome: "passed",
      },
      result: { recordedAt: "2026-09-14T01:00:00.000Z", summary: `${specification.id} passed`, outputSha256: log.sha256 },
      log,
    };
  });
  const run = sealCurrentVerificationRun({
    schema: "lab-studio/f08-current-verification-run@1",
    contractVersion: "lab-studio/f08-evidence-contract@2",
    runId: runIdOverride,
    createdAt: "2026-09-14T00:59:00.000Z",
    sourceSnapshot,
    predecessorArtifacts,
    phases: phaseRecords,
  });
  return { run, sourceSnapshot, observedArtifacts };
};

const inspectFixture = (fixture, overrides = {}) => inspectCurrentVerificationRun({
  run: fixture.run,
  expectedRunId: runId,
  observedStableFiles: sourceFiles,
  observedArtifacts: fixture.observedArtifacts,
  observedBoundary: [],
  ...overrides,
});

test("current verification run uses an explicit safe output selection without changing the legacy F08 exclusion policy", () => {
  assert.deepEqual(normalizeCurrentVerificationRunId(runId), { ok: true, runId });
  for (const unsafe of ["", " batch3", "../escape", "Batch3", "batch3/current", "batch3_current", "batch3-"]) {
    assert.equal(normalizeCurrentVerificationRunId(unsafe).ok, false, unsafe);
  }
  const selectedPath = currentVerificationRunPath(runId);
  assert.match(selectedPath, /f08-current-runs\/batch3-current-proof\/CURRENT_VERIFICATION_RUN\.json$/);
  assert.equal(currentVerificationStableDomainExclusion(selectedPath), "self-generated-current-verification-artifact");
  assert.equal(currentVerificationStableDomainExclusion("planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current-runs/batch3-current-proof/unexpected.json"), null);
  assert.equal(currentVerificationStableDomainExclusion(currentVerificationPhaseOutputPaths[0]), "current-verification-phase-output-recorded-separately");
  assert.equal(stableDomainExclusion(currentVerificationPhaseOutputPaths[0]), null);
});

test("current verification requires both an unchanged source snapshot and fixed-recipe command receipts", () => {
  const sourceOnly = makeFixture({ phases: [] });
  const sourceOnlyResult = inspectFixture(sourceOnly);
  assert.equal(sourceOnlyResult.sourceStatus, "current");
  assert.equal(sourceOnlyResult.integrityStatus, "passed");
  assert.equal(sourceOnlyResult.coreRunStatus, "incomplete-core-run");
  assert.equal(sourceOnlyResult.runStatus, "incomplete-core-run");
  assert.equal(sourceOnlyResult.checkStatus, "incomplete-core-run");
  assert.equal(sourceOnlyResult.phases.length, 0);

  const fixture = makeFixture();
  const result = inspectFixture(fixture);
  assert.equal(result.sourceStatus, "current");
  assert.equal(result.integrityStatus, "passed");
  assert.equal(result.coreRunStatus, "complete-current-run");
  assert.equal(result.supplementalRunStatus, "no-supplemental-failures");
  assert.equal(result.runStatus, "complete-current-run");
  assert.equal(result.checkStatus, "passed");
  assert.ok(result.phases.every((phase) => phase.status === "complete-current-run"));
});

test("serialized current-source provenance stays fixed as receipts progress but exposes source tampering", () => {
  const initial = makeFixture({ phases: [currentVerificationPhaseSpecification[0]] });
  const initialInspection = inspectFixture(initial);
  const initialProvenance = deriveCurrentVerificationSourceProvenance({ run: initial.run, inspection: initialInspection });
  assert.equal(initialInspection.sourceStatus, "current");
  assert.equal(initialInspection.coreRunStatus, "incomplete-core-run");

  const later = makeFixture();
  const laterInspection = inspectFixture(later);
  assert.equal(laterInspection.coreRunStatus, "complete-current-run");
  assert.notEqual(initialInspection.reason, laterInspection.reason);
  assert.deepEqual(deriveCurrentVerificationSourceProvenance({ run: later.run, inspection: laterInspection }), initialProvenance);

  const supplementalFailure = makeFixture();
  const contentPhase = supplementalFailure.run.phases.find((phase) => phase.id === "repository-content-check");
  contentPhase.exitStatus = "failed";
  contentPhase.freshness = "unknown";
  contentPhase.execution = { ...contentPhase.execution, exitCode: 9, outcome: "nonzero-exit" };
  supplementalFailure.run = sealCurrentVerificationRun(supplementalFailure.run);
  const supplementalInspection = inspectFixture(supplementalFailure);
  assert.equal(supplementalInspection.checkStatus, "supplemental-failures");
  assert.notEqual(laterInspection.reason, supplementalInspection.reason);
  assert.deepEqual(deriveCurrentVerificationSourceProvenance({ run: supplementalFailure.run, inspection: supplementalInspection }), initialProvenance);

  const tampered = makeFixture({ phases: [] });
  const tamperedFiles = {
    ...sourceFiles,
    [sourceInputPaths[0]]: { ...sourceFiles[sourceInputPaths[0]], sha256: sha256Text("tampered-source") },
  };
  const tamperedInspection = inspectFixture(tampered, { observedStableFiles: tamperedFiles });
  const tamperedProvenance = deriveCurrentVerificationSourceProvenance({ run: tampered.run, inspection: tamperedInspection });
  assert.equal(tamperedProvenance.status, "stale");
  assert.ok(tamperedProvenance.mismatches.some((message) => message.includes("byte identity changed")));
  assert.notDeepEqual(tamperedProvenance, initialProvenance);
});

test("current verification reports failed core, incomplete core, and supplemental failures separately from integrity", () => {
  const failedCore = makeFixture();
  const finalCorePhase = failedCore.run.phases.find((phase) => phase.id === "cycle12-reconciliation-check");
  finalCorePhase.exitStatus = "failed";
  finalCorePhase.freshness = "unknown";
  finalCorePhase.execution = {
    ...finalCorePhase.execution,
    exitCode: 23,
    outcome: "nonzero-exit",
  };
  failedCore.run = sealCurrentVerificationRun(failedCore.run);
  const failedCoreResult = inspectFixture(failedCore);
  assert.equal(failedCoreResult.integrityStatus, "passed");
  assert.equal(failedCoreResult.coreRunStatus, "failed-core-run");
  assert.equal(failedCoreResult.runStatus, "failed-core-run");
  assert.equal(failedCoreResult.checkStatus, "failed-core-run");
  assert.deepEqual(failedCoreResult.failedCorePhaseIds, ["cycle12-reconciliation-check"]);

  const supplementalFailure = makeFixture();
  const contentPhase = supplementalFailure.run.phases.find((phase) => phase.id === "repository-content-check");
  contentPhase.exitStatus = "failed";
  contentPhase.freshness = "unknown";
  contentPhase.execution = {
    ...contentPhase.execution,
    exitCode: 9,
    outcome: "nonzero-exit",
  };
  supplementalFailure.run = sealCurrentVerificationRun(supplementalFailure.run);
  const supplementalResult = inspectFixture(supplementalFailure);
  assert.equal(supplementalResult.integrityStatus, "passed");
  assert.equal(supplementalResult.coreRunStatus, "complete-current-run");
  assert.equal(supplementalResult.supplementalRunStatus, "supplemental-failures");
  assert.equal(supplementalResult.runStatus, "complete-current-run-with-supplemental-failures");
  assert.equal(supplementalResult.checkStatus, "supplemental-failures");
  assert.deepEqual(supplementalResult.supplementalFailures, ["repository-content-check"]);
});

test("current verification rejects unsafe runtime-only data and tampered, missing, or extra receipt content", () => {
  const fixture = makeFixture();

  const runtimeOnly = clone(fixture.run);
  runtimeOnly.phases[0].environment.localFilePath = "C:/sensitive/input.txt";
  fixture.run = sealCurrentVerificationRun(runtimeOnly);
  const runtimeResult = inspectFixture(fixture);
  assert.equal(runtimeResult.sourceStatus, "unknown");
  assert.ok(runtimeResult.contractErrors.some((error) => error.includes("runtime-only field localFilePath")));

  const extraFixture = makeFixture();
  extraFixture.run.phases[0].outputs.push(record("src/unexpected-current-output.json", "extra", 9));
  extraFixture.run = sealCurrentVerificationRun(extraFixture.run);
  const extraResult = inspectFixture(extraFixture);
  assert.equal(extraResult.sourceStatus, "unknown");
  assert.ok(extraResult.contractErrors.some((error) => error.includes("output paths do not match")));

  const missingFixture = makeFixture();
  delete missingFixture.observedArtifacts[currentVerificationPhaseOutputPaths[0]];
  const missingResult = inspectFixture(missingFixture);
  assert.equal(missingResult.sourceStatus, "stale");
  assert.ok(missingResult.mismatches.some((error) => error.includes("output is missing")));
});

test("current verification keeps byte-identical predecessor copies and enforces the witness-to-checker phase lineage", () => {
  const fixture = makeFixture();
  const predecessorCopy = fixture.run.predecessorArtifacts[0].preservedCopy.path;
  fixture.observedArtifacts[predecessorCopy] = { sha256: sha256Text("tampered-predecessor"), bytes: 1 };
  const predecessorResult = inspectFixture(fixture);
  assert.equal(predecessorResult.sourceStatus, "stale");
  assert.ok(predecessorResult.mismatches.some((error) => error.includes("predecessor copy byte identity changed")));

  const predecessorInput = makeFixture();
  const reconciliation = predecessorInput.run.phases.find((phase) => phase.id === "cycle12-reconciliation");
  const lane09Input = reconciliation.inputs.find((input) => input.path.includes("/evidence/lane-09/"));
  lane09Input.sha256 = sha256Text("tampered-lane09-predecessor-input");
  predecessorInput.run = sealCurrentVerificationRun(predecessorInput.run);
  const predecessorInputResult = inspectFixture(predecessorInput);
  assert.equal(predecessorInputResult.sourceStatus, "unknown");
  assert.ok(predecessorInputResult.contractErrors.some((error) => error.includes("preserved predecessor evidence")));

  const outOfOrder = makeFixture({ phases: [
    currentVerificationPhaseSpecification[0],
    currentVerificationPhaseSpecification[2],
  ] });
  const orderResult = inspectFixture(outOfOrder);
  assert.equal(orderResult.sourceStatus, "unknown");
  assert.ok(orderResult.contractErrors.some((error) => error.includes("lacks completed prerequisite cycle12-reconciliation")));
});

const candidateRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtureParent = join(candidateRoot, "tmp");
const fixtureCompilerWitnessOutput = "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/lane-12/COMPILED_LAB_WITNESS.json";

const makeRunnerFixture = (compilerScript) => {
  mkdirSync(fixtureParent, { recursive: true });
  const fixtureRoot = mkdtempSync(join(fixtureParent, "current-verification-runner-"));
  const fixtureScripts = join(fixtureRoot, "scripts");
  mkdirSync(fixtureScripts, { recursive: true });
  for (const name of ["followupEvidenceContract.mjs", "recordCurrentVerificationRun.mjs", "tsCompositionLoader.mjs"]) {
    copyFileSync(join(candidateRoot, "scripts", name), join(fixtureScripts, name));
  }
  writeFileSync(join(fixtureScripts, "collectCycle12CompileWitness.mjs"), compilerScript, "utf8");
  writeFileSync(join(fixtureScripts, "checkContentConsistency.mjs"), 'process.stdout.write("fixture content check passed\\n");\n', "utf8");
  return fixtureRoot;
};

const runRunnerCli = (fixtureRoot, args, environment = {}) => {
  const result = spawnSync(process.execPath, [join(fixtureRoot, "scripts", "recordCurrentVerificationRun.mjs"), ...args], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env: { ...process.env, ...environment },
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  return result;
};

const assertCliExit = (result, expected, label) => {
  assert.equal(result.status, expected, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
};

const readFixtureRun = (fixtureRoot, fixtureRunId) => JSON.parse(readFileSync(join(
  fixtureRoot,
  "planning",
  "2026-09-08_catalog-fidelity-follow-up",
  "evidence",
  "f08-current-runs",
  fixtureRunId,
  "CURRENT_VERIFICATION_RUN.json",
), "utf8"));

test("runner CLI launches direct Node recipes and records success, nonzero, timeout, and independent supplemental outcomes", () => {
  const fixtureRoots = [];
  try {
    const successFixture = makeRunnerFixture([
      'import { mkdirSync, writeFileSync } from "node:fs";',
      'import { dirname } from "node:path";',
      `const output = ${JSON.stringify(fixtureCompilerWitnessOutput)};`,
      'mkdirSync(dirname(output), { recursive: true });',
      'writeFileSync(output, "{\\n  \\"fixture\\": true\\n}\\n", "utf8");',
      'process.stdout.write("fixture compiler witness passed\\n");',
    ].join("\n"));
    fixtureRoots.push(successFixture);
    const successRunId = "cli-success";
    assertCliExit(runRunnerCli(successFixture, ["--initialize", "--run-id", successRunId]), 0, "initialize success fixture");
    assertCliExit(runRunnerCli(successFixture, ["--run-phase", "cycle12-compiler-witness", "--run-id", successRunId]), 0, "run direct compiler witness fixture");
    const successLedger = readFixtureRun(successFixture, successRunId);
    const successPhase = successLedger.phases.find((phase) => phase.id === "cycle12-compiler-witness");
    assert.deepEqual(successPhase.execution, {
      launcher: "process.execPath",
      launched: true,
      launchError: null,
      timedOut: false,
      timeoutMs: 900_000,
      timeoutKillRequested: false,
      exitCode: 0,
      signal: null,
      outcome: "passed",
      startedAt: successPhase.execution.startedAt,
      endedAt: successPhase.execution.endedAt,
    });
    assert.match(readFileSync(join(successFixture, currentVerificationPhaseLogPath(successRunId, "cycle12-compiler-witness")), "utf8"), /launcher=process\.execPath/);
    const successCheck = runRunnerCli(successFixture, ["--check", "--run-id", successRunId]);
    assertCliExit(successCheck, 1, "check incomplete core fixture");
    assert.equal(JSON.parse(successCheck.stdout).checkStatus, "incomplete-core-run");

    const failedFixture = makeRunnerFixture('process.stdout.write("fixture compiler witness failing\\n");\nprocess.stderr.write("fixture nonzero exit\\n");\nprocess.exit(23);\n');
    fixtureRoots.push(failedFixture);
    const failedRunId = "cli-failed";
    assertCliExit(runRunnerCli(failedFixture, ["--initialize", "--run-id", failedRunId]), 0, "initialize failure fixture");
    assertCliExit(runRunnerCli(failedFixture, ["--run-phase", "cycle12-compiler-witness", "--run-id", failedRunId]), 1, "record nonzero compiler witness fixture");
    const failedLedger = readFixtureRun(failedFixture, failedRunId);
    const failedPhase = failedLedger.phases.find((phase) => phase.id === "cycle12-compiler-witness");
    assert.equal(failedPhase.execution.launcher, "process.execPath");
    assert.equal(failedPhase.execution.launched, true);
    assert.equal(failedPhase.execution.exitCode, 23);
    assert.equal(failedPhase.execution.outcome, "nonzero-exit");
    assertCliExit(runRunnerCli(failedFixture, ["--run-phase", "repository-content-check", "--run-id", failedRunId]), 0, "run independent supplemental after core failure");
    const failedLedgerAfterSupplemental = readFixtureRun(failedFixture, failedRunId);
    const supplementalPhase = failedLedgerAfterSupplemental.phases.find((phase) => phase.id === "repository-content-check");
    assert.equal(supplementalPhase.execution.launcher, "process.execPath");
    assert.equal(supplementalPhase.execution.outcome, "passed");
    assert.match(readFileSync(join(failedFixture, currentVerificationPhaseLogPath(failedRunId, "repository-content-check")), "utf8"), /scripts\/checkContentConsistency\.mjs/);
    const failedCheck = runRunnerCli(failedFixture, ["--check", "--run-id", failedRunId]);
    assertCliExit(failedCheck, 1, "check failed core fixture");
    const failedStatus = JSON.parse(failedCheck.stdout);
    assert.equal(failedStatus.integrityStatus, "passed");
    assert.equal(failedStatus.coreRunStatus, "failed-core-run");
    assert.equal(failedStatus.checkStatus, "failed-core-run");
    assert.equal(failedStatus.supplementalRunStatus, "no-supplemental-failures");

    const timeoutFixture = makeRunnerFixture('process.stdout.write("fixture compiler witness waiting\\n");\nsetInterval(() => process.stdout.write("tick\\n"), 20);\n');
    fixtureRoots.push(timeoutFixture);
    const timeoutRunId = "cli-timeout";
    assertCliExit(runRunnerCli(timeoutFixture, ["--initialize", "--run-id", timeoutRunId]), 0, "initialize timeout fixture");
    assertCliExit(runRunnerCli(timeoutFixture, ["--run-phase", "cycle12-compiler-witness", "--run-id", timeoutRunId], {
      LAB_STUDIO_CURRENT_VERIFICATION_PHASE_TIMEOUT_MS: "180",
    }), 1, "record timed-out compiler witness fixture");
    const timeoutLedger = readFixtureRun(timeoutFixture, timeoutRunId);
    const timeoutPhase = timeoutLedger.phases.find((phase) => phase.id === "cycle12-compiler-witness");
    assert.equal(timeoutPhase.execution.launcher, "process.execPath");
    assert.equal(timeoutPhase.execution.launched, true);
    assert.equal(timeoutPhase.execution.timedOut, true);
    assert.equal(timeoutPhase.execution.timeoutMs, 180);
    assert.equal(timeoutPhase.execution.outcome, "timed-out");
    assert.match(readFileSync(join(timeoutFixture, currentVerificationPhaseLogPath(timeoutRunId, "cycle12-compiler-witness")), "utf8"), /timedOut=true/);
    const timeoutCheck = runRunnerCli(timeoutFixture, ["--check", "--run-id", timeoutRunId]);
    assertCliExit(timeoutCheck, 1, "check timed-out core fixture");
    assert.equal(JSON.parse(timeoutCheck.stdout).coreRunStatus, "failed-core-run");
  } finally {
    for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
