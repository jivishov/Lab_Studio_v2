/**
 * Executes and records the fixed Batch 3 current-evidence chain without mutating frozen F08
 * artifacts.  Each run has an explicit id and a dedicated generated ledger under
 * f08-current-runs.  The ledger snapshots source excluding only the fixed generated outputs;
 * predecessor copies and per-phase receipts carry those outputs' byte identities instead.
 *
 * Usage:
 *   node scripts/recordCurrentVerificationRun.mjs --initialize --run-id <lowercase-id>
 *   node scripts/recordCurrentVerificationRun.mjs --run-phase <phase-id> --run-id <lowercase-id>
 *   node scripts/recordCurrentVerificationRun.mjs --check --run-id <lowercase-id>
 */

import { spawn } from "node:child_process";
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  F08_CONTRACT_VERSION,
  F08_CURRENT_VERIFICATION_RUN_SCHEMA,
  currentVerificationArtifactPaths,
  currentVerificationPhaseLogPath,
  currentVerificationPhaseOutputPaths,
  currentVerificationPhaseSpecification,
  currentVerificationPredecessorCopyPath,
  currentVerificationRunPath,
  currentVerificationStableDomainExclusion,
  getCurrentVerificationPhase,
  inspectCurrentVerificationRun,
  makeCurrentVerificationSourceSnapshot,
  normalizeCurrentVerificationRunId,
  sealCurrentVerificationRun,
  sha256Bytes,
} from "./followupEvidenceContract.mjs";

const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const showUsage = hasFlag("--help") || hasFlag("-h");
const modeNames = ["--initialize", "--run-phase", "--check"].filter((flag) => hasFlag(flag));

if (showUsage || modeNames.length !== 1) {
  console.log("Usage: --initialize | --run-phase <phase-id> | --check; every mode also requires --run-id <lowercase-id>.");
  if (!showUsage && modeNames.length !== 1) process.exitCode = 1;
} else {
  const normalizedRunId = normalizeCurrentVerificationRunId(valueAfter("--run-id"));
  if (!normalizedRunId.ok) {
    throw new Error(`--run-id is required and must be safe: ${normalizedRunId.reason}`);
  }
  const runId = normalizedRunId.runId;
  const runPath = currentVerificationRunPath(runId);
  const runDirectory = dirname(join(root, runPath));

  const fileRecord = (relativePath, { allowMissing = false } = {}) => {
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      if (allowMissing) return { path: relativePath, exists: false };
      throw new Error(`Expected file is missing: ${relativePath}`);
    }
    const stat = lstatSync(absolutePath);
    if (!stat.isFile()) throw new Error(`Expected regular file but found another filesystem entry: ${relativePath}`);
    const bytes = readFileSync(absolutePath);
    return { path: relativePath, exists: true, sha256: sha256Bytes(bytes), bytes: bytes.byteLength };
  };

  const collectCurrentSource = () => {
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
        const directoryExclusion = currentVerificationStableDomainExclusion(relativePath, "directory");
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
        if (currentVerificationStableDomainExclusion(relativePath, "file")) continue;
        const bytes = readFileSync(absolutePath);
        files[relativePath] = { sha256: sha256Bytes(bytes), bytes: bytes.byteLength };
      }
    };
    walk(root);
    return { files, boundary };
  };

  const collectArtifacts = () => {
    const records = {};
    for (const relativePath of [...new Set([...currentVerificationPhaseOutputPaths, ...currentVerificationArtifactPaths(runId)])]) {
      const record = fileRecord(relativePath, { allowMissing: true });
      if (record.exists) records[relativePath] = { sha256: record.sha256, bytes: record.bytes };
    }
    return records;
  };

  const readRun = () => {
    if (!existsSync(join(root, runPath))) throw new Error(`Current verification run does not exist: ${runPath}`);
    return JSON.parse(readFileSync(join(root, runPath), "utf8"));
  };

  const writeRun = (run) => writeFileSync(join(root, runPath), `${JSON.stringify(sealCurrentVerificationRun(run), null, 2)}\n`, "utf8");

  const resolvePhaseTimeoutMs = () => {
    const rawTimeout = process.env.LAB_STUDIO_CURRENT_VERIFICATION_PHASE_TIMEOUT_MS;
    if (rawTimeout === undefined) return 15 * 60 * 1000;
    if (!/^[0-9]+$/.test(rawTimeout)) {
      throw new Error("LAB_STUDIO_CURRENT_VERIFICATION_PHASE_TIMEOUT_MS must be an integer number of milliseconds.");
    }
    const timeoutMs = Number(rawTimeout);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3_600_000) {
      throw new Error("LAB_STUDIO_CURRENT_VERIFICATION_PHASE_TIMEOUT_MS must be between 100 and 3600000 milliseconds.");
    }
    return timeoutMs;
  };

  const executePhaseWithFileLog = async ({ phaseId, specification, invocation, logPath, timeoutMs }) => {
    if (invocation.executable !== process.execPath) {
      throw new Error(`Current verification phase ${phaseId} must launch through process.execPath.`);
    }
    const absoluteLogPath = join(root, logPath);
    mkdirSync(dirname(absoluteLogPath), { recursive: true });
    const startedAt = new Date().toISOString();
    const log = createWriteStream(absoluteLogPath, { encoding: "utf8", flags: "w" });
    log.write([
      `phase=${phaseId}`,
      `recipe=${specification.command}`,
      "launcher=process.execPath",
      `argv=${JSON.stringify(invocation.arguments)}`,
      "cwd=candidate-root",
      `timeoutMs=${timeoutMs}`,
      `startedAt=${startedAt}`,
      "--- stdout-and-stderr (interleaved, complete file-backed capture) ---",
    ].join("\n"));
    log.write("\n");

    return new Promise((resolveExecution, rejectExecution) => {
      let settled = false;
      let timeoutHandle = null;
      let launched = false;
      let launchError = null;
      let timedOut = false;
      let timeoutKillRequested = false;
      let exitCode = null;
      let signal = null;
      const settle = () => {
        if (settled) return;
        settled = true;
        if (timeoutHandle !== null) clearTimeout(timeoutHandle);
        const endedAt = new Date().toISOString();
        const outcome = !launched
          ? "launch-failed"
          : timedOut
            ? "timed-out"
            : exitCode !== 0 || signal !== null
              ? "nonzero-exit"
              : "passed";
        log.write([
          "",
          "--- execution ---",
          `endedAt=${endedAt}`,
          `launched=${launched}`,
          `launchError=${launchError ?? "none"}`,
          `timedOut=${timedOut}`,
          `timeoutKillRequested=${timeoutKillRequested}`,
          `exitCode=${exitCode ?? "null"}`,
          `signal=${signal ?? "none"}`,
          `outcome=${outcome}`,
          "",
        ].join("\n"));
        log.once("error", rejectExecution);
        log.end(() => resolveExecution({
          startedAt,
          endedAt,
          launcher: "process.execPath",
          launched,
          launchError,
          timedOut,
          timeoutMs,
          timeoutKillRequested,
          exitCode,
          signal,
          outcome,
        }));
      };

      let child;
      try {
        child = spawn(invocation.executable, invocation.arguments, {
          cwd: root,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
        launched = true;
      } catch (error) {
        launchError = String(error?.message ?? error);
        settle();
        return;
      }
      child.stdout?.pipe(log, { end: false });
      child.stderr?.pipe(log, { end: false });
      child.once("error", (error) => {
        launchError = String(error?.message ?? error);
        launched = false;
        settle();
      });
      child.once("close", (code, receivedSignal) => {
        exitCode = code ?? null;
        signal = receivedSignal ?? null;
        settle();
      });
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        timeoutKillRequested = child.kill();
      }, timeoutMs);
    });
  };

  const inspectRun = (run) => {
    const currentSource = collectCurrentSource();
    return {
      currentSource,
      inspection: inspectCurrentVerificationRun({
        run,
        expectedRunId: runId,
        observedStableFiles: currentSource.files,
        observedArtifacts: collectArtifacts(),
        observedBoundary: currentSource.boundary,
      }),
    };
  };

  const commandForPhase = (phaseId) => {
    const nodeArgs = (arguments_) => ({ executable: process.execPath, arguments: arguments_ });
    switch (phaseId) {
      case "cycle12-compiler-witness":
        return nodeArgs(["--experimental-strip-types", "--experimental-loader", "./scripts/tsCompositionLoader.mjs", "scripts/collectCycle12CompileWitness.mjs"]);
      case "cycle12-reconciliation":
        return nodeArgs(["scripts/reconcileCycle12Catalog.mjs", "--current-evidence-run", runId]);
      case "cycle09-overlay-refresh":
        return nodeArgs(["scripts/documentCycle09Composition.mjs"]);
      case "cycle09-overlay-check":
        return nodeArgs(["--experimental-strip-types", "--experimental-loader", "./scripts/tsCompositionLoader.mjs", "scripts/checkCycle09Composition.mjs"]);
      case "cycle12-reconciliation-check":
        return nodeArgs(["scripts/reconcileCycle12Catalog.mjs", "--check", "--current-evidence-run", runId]);
      case "repository-content-check":
        return nodeArgs(["--experimental-strip-types", "--experimental-loader", "./scripts/tsCompositionLoader.mjs", "scripts/checkContentConsistency.mjs", "--compiled"]);
      case "cycle12-static-verifier":
        return nodeArgs(["scripts/verifyCycle12ScientificActivities.mjs", "--json"]);
      default:
        throw new Error(`Unsupported current verification phase: ${phaseId}`);
    }
  };

  if (hasFlag("--initialize")) {
    if (existsSync(runDirectory)) throw new Error(`Refusing to overwrite an existing current verification run directory: ${runPath}`);
    const currentSource = collectCurrentSource();
    if (currentSource.boundary.length) throw new Error(`Current verification source traversal is blocked: ${JSON.stringify(currentSource.boundary)}`);
    const sourceSnapshot = makeCurrentVerificationSourceSnapshot({ files: currentSource.files });
    const predecessorArtifacts = [];
    for (const sourcePath of currentVerificationPhaseOutputPaths) {
      const source = fileRecord(sourcePath, { allowMissing: true });
      if (!source.exists) {
        predecessorArtifacts.push({ sourcePath, source: { exists: false }, preservedCopy: null });
        continue;
      }
      const copyPath = currentVerificationPredecessorCopyPath(runId, sourcePath);
      mkdirSync(dirname(join(root, copyPath)), { recursive: true });
      copyFileSync(join(root, sourcePath), join(root, copyPath), 0);
      const preservedCopy = fileRecord(copyPath);
      predecessorArtifacts.push({
        sourcePath,
        source: { path: source.path, exists: true, sha256: source.sha256, bytes: source.bytes },
        preservedCopy: { path: preservedCopy.path, sha256: preservedCopy.sha256, bytes: preservedCopy.bytes },
      });
    }
    const run = {
      schema: F08_CURRENT_VERIFICATION_RUN_SCHEMA,
      contractVersion: F08_CONTRACT_VERSION,
      runId,
      createdAt: new Date().toISOString(),
      sourceSnapshot,
      predecessorArtifacts,
      phases: [],
    };
    mkdirSync(runDirectory, { recursive: true });
    writeRun(run);
    console.log(`Initialized current verification run ${runId}: ${runPath}`);
  }

  if (hasFlag("--check")) {
    const run = readRun();
    const { inspection } = inspectRun(run);
    console.log(JSON.stringify({
      runId,
      sourceStatus: inspection.sourceStatus,
      runStatus: inspection.runStatus,
      integrityStatus: inspection.integrityStatus,
      coreRunStatus: inspection.coreRunStatus,
      supplementalRunStatus: inspection.supplementalRunStatus,
      failedCorePhaseIds: inspection.failedCorePhaseIds,
      incompleteCorePhaseIds: inspection.incompleteCorePhaseIds,
      supplementalFailures: inspection.supplementalFailures,
      checkStatus: inspection.checkStatus,
      phaseStates: inspection.phases,
      contractErrors: inspection.contractErrors,
      mismatches: inspection.mismatches,
    }, null, 2));
    if (inspection.checkStatus !== "passed") process.exitCode = 1;
  }

  if (hasFlag("--run-phase")) {
    const phaseId = valueAfter("--run-phase");
    const specification = getCurrentVerificationPhase(phaseId);
    if (!specification) throw new Error(`--run-phase must name one fixed phase; received ${String(phaseId)}`);
    const run = readRun();
    const { inspection } = inspectRun(run);
    if (inspection.sourceStatus !== "current") throw new Error(`Cannot run ${phaseId}; current source identity is ${inspection.sourceStatus}: ${inspection.reason}`);
    if (run.phases.some((phase) => phase?.id === phaseId)) throw new Error(`Refusing to replay an already recorded phase in the same run: ${phaseId}`);
    for (const prerequisite of specification.prerequisitePhaseIds) {
      const state = inspection.phases.find((phase) => phase.id === prerequisite);
      if (!state || state.status !== "complete-current-run") {
        throw new Error(`Cannot run ${phaseId}; required prior phase ${prerequisite} is not a complete current receipt.`);
      }
    }
    const inputs = specification.requiredInputPaths.map((path) => {
      const record = fileRecord(path);
      return { path: record.path, sha256: record.sha256, bytes: record.bytes };
    });
    const invocation = commandForPhase(phaseId);
    const timeoutMs = resolvePhaseTimeoutMs();
    const logPath = currentVerificationPhaseLogPath(runId, phaseId);
    const execution = await executePhaseWithFileLog({ phaseId, specification, invocation, logPath, timeoutMs });
    const outputs = specification.outputPaths
      .map((path) => fileRecord(path, { allowMissing: true }))
      .filter((record) => record.exists)
      .map(({ path, sha256, bytes }) => ({ path, sha256, bytes }));
    const sourceAfter = collectCurrentSource();
    const sourceAfterSnapshot = makeCurrentVerificationSourceSnapshot({
      files: sourceAfter.files,
      status: sourceAfter.boundary.length ? "blocked-filesystem-boundary" : "current-current-verification-source-snapshot",
    });
    const outputCollectionComplete = outputs.length === specification.outputPaths.length;
    const sourceRemainedCurrent = sourceAfter.boundary.length === 0 && sourceAfterSnapshot.payloadSha256 === run.sourceSnapshot?.payloadSha256;
    const executionOutcome = execution.outcome !== "passed"
      ? execution.outcome
      : !outputCollectionComplete
        ? "output-collection-incomplete"
        : !sourceRemainedCurrent
          ? "source-not-current-after-phase"
          : "passed";
    const phaseExecution = { ...execution, outcome: executionOutcome };
    const passed = phaseExecution.outcome === "passed";
    const log = fileRecord(logPath);
    const phase = {
      id: phaseId,
      command: specification.command,
      environment: {
        runtime: process.version,
        platform: `${process.platform}/${process.arch}`,
        cwd: "candidate-root",
        launcher: phaseExecution.launcher,
        phaseTimeoutMs: timeoutMs,
        nativeLibraryOverride: process.env.NAPI_RS_NATIVE_LIBRARY_PATH ? "present" : "absent",
      },
      sourceSnapshotPayloadSha256: run.sourceSnapshot?.payloadSha256 ?? null,
      inputs,
      outputs,
      collectionCompleteness: outputCollectionComplete && sourceAfter.boundary.length === 0 ? "complete" : "incomplete",
      exitStatus: passed ? "passed" : "failed",
      freshness: passed ? "current" : sourceRemainedCurrent ? "unknown" : "stale",
      execution: phaseExecution,
      result: {
        recordedAt: phaseExecution.endedAt,
        summary: passed
          ? `${phaseId} completed with the fixed command recipe and all expected outputs were collected.`
          : `${phaseId} ${phaseExecution.outcome}; inspect its complete file-backed log and output accounting.`,
        outputSha256: log.sha256,
      },
      log: { path: log.path, sha256: log.sha256, bytes: log.bytes },
    };
    run.phases.push(phase);
    writeRun(run);
    console.log(`Recorded ${phaseId}: ${passed ? "passed" : "failed"}; log ${logPath}`);
    if (!passed) process.exitCode = 1;
  }
}
