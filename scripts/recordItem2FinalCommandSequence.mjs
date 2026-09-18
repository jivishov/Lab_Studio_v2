import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const runId = valueAfter("--run-id");
const deliveryRoot = valueAfter("--delivery-root") ?? resolve(root, "..", "delivery");
if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(runId ?? "")) throw new Error("--run-id must be a safe lowercase run id.");
const deliveryDirectory = resolve(deliveryRoot, runId);
mkdirSync(deliveryDirectory, { recursive: true });

const commands = [
  { id: "01-initialize", args: ["scripts/recordCurrentVerificationRun.mjs", "--initialize", "--run-id", runId], expectedExitCode: 0 },
  { id: "02-cycle12-compiler-witness", args: ["scripts/recordCurrentVerificationRun.mjs", "--run-phase", "cycle12-compiler-witness", "--run-id", runId], expectedExitCode: 0 },
  { id: "03-cycle12-reconciliation", args: ["scripts/recordCurrentVerificationRun.mjs", "--run-phase", "cycle12-reconciliation", "--run-id", runId], expectedExitCode: 0 },
  { id: "04-cycle09-overlay-refresh", args: ["scripts/recordCurrentVerificationRun.mjs", "--run-phase", "cycle09-overlay-refresh", "--run-id", runId], expectedExitCode: 0 },
  { id: "05-cycle09-overlay-check", args: ["scripts/recordCurrentVerificationRun.mjs", "--run-phase", "cycle09-overlay-check", "--run-id", runId], expectedExitCode: 0 },
  { id: "06-cycle12-reconciliation-check", args: ["scripts/recordCurrentVerificationRun.mjs", "--run-phase", "cycle12-reconciliation-check", "--run-id", runId], expectedExitCode: 0 },
  { id: "07-cycle12-static-verifier", args: ["scripts/recordCurrentVerificationRun.mjs", "--run-phase", "cycle12-static-verifier", "--run-id", runId], expectedExitCode: 0 },
  { id: "08-repository-content-check", args: ["scripts/recordCurrentVerificationRun.mjs", "--run-phase", "repository-content-check", "--run-id", runId], expectedExitCode: 1 },
  { id: "09-recorder-check", args: ["scripts/recordCurrentVerificationRun.mjs", "--check", "--run-id", runId], expectedExitCode: 0 },
  {
    id: "10-content-check-compiled-json",
    args: ["--experimental-strip-types", "--experimental-loader", "./scripts/tsCompositionLoader.mjs", "scripts/checkContentConsistency.mjs", "--compiled", "--json"],
    expectedExitCode: 1,
    stdoutFile: "content-check-compiled.json",
    stderrFile: "content-check-compiled.stderr.log",
  },
];

const runCommand = (command) => new Promise((resolveCommand, rejectCommand) => {
  const startedAt = new Date().toISOString();
  const combinedLogPath = join(deliveryDirectory, `${command.id}.log`);
  const stdoutPath = command.stdoutFile ? join(deliveryDirectory, command.stdoutFile) : null;
  const stderrPath = command.stderrFile ? join(deliveryDirectory, command.stderrFile) : null;
  const combinedLog = createWriteStream(combinedLogPath, { encoding: "utf8", flags: "w" });
  const stdoutLog = stdoutPath ? createWriteStream(stdoutPath, { encoding: "utf8", flags: "w" }) : combinedLog;
  const stderrLog = stderrPath ? createWriteStream(stderrPath, { encoding: "utf8", flags: "w" }) : combinedLog;
  combinedLog.write([
    `commandId=${command.id}`,
    `command=${JSON.stringify([process.execPath, ...command.args])}`,
    "cwd=candidate-root",
    `startedAt=${startedAt}`,
    `expectedExitCode=${command.expectedExitCode}`,
    "--- stdout-and-stderr (interleaved unless separate files are declared) ---",
    "",
  ].join("\n"));
  const child = spawn(process.execPath, command.args, {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stdoutLog, { end: false });
  child.stderr.pipe(stderrLog, { end: false });
  let launchError = null;
  child.once("error", (error) => {
    launchError = String(error?.message ?? error);
  });
  child.once("close", (exitCode, signal) => {
    const endedAt = new Date().toISOString();
    const closeStreams = [
      stdoutLog === combinedLog ? null : stdoutLog,
      stderrLog === combinedLog ? null : stderrLog,
    ].filter(Boolean).map((stream) => new Promise((resolveStream, rejectStream) => {
      stream.once("error", rejectStream);
      stream.end(resolveStream);
    }));
    closeStreams.push(new Promise((resolveStream, rejectStream) => {
      combinedLog.once("error", rejectStream);
      combinedLog.end(resolveStream);
    }));
    Promise.all(closeStreams).then(() => resolveCommand({
      id: command.id,
      argv: [process.execPath, ...command.args],
      expectedExitCode: command.expectedExitCode,
      startedAt,
      endedAt,
      exitCode: exitCode ?? null,
      signal: signal ?? null,
      launchError,
      outcome: launchError ? "launch-failed" : exitCode === command.expectedExitCode ? "expected" : "unexpected",
      combinedLog: combinedLogPath,
      stdout: stdoutPath,
      stderr: stderrPath,
    })).catch(rejectCommand);
  });
});

const receipts = [];
for (const command of commands) {
  const receipt = await runCommand(command);
  receipts.push(receipt);
  console.log(`${command.id}: ${receipt.outcome} (exit ${receipt.exitCode ?? "null"})`);
}

const sequenceReceipt = {
  schema: "lab-studio/item2-final-command-sequence@1",
  runId,
  root: "candidate-root",
  deliveryDirectory,
  commands: receipts,
  recorderReceipt: `planning/2026-09-08_catalog-fidelity-follow-up/evidence/f08-current-runs/${runId}/CURRENT_VERIFICATION_RUN.json`,
  contentCapture: join(deliveryDirectory, "content-check-compiled.json"),
};
writeFileSync(join(deliveryDirectory, "FINAL_SEQUENCE_RECEIPT.json"), `${JSON.stringify(sequenceReceipt, null, 2)}\n`, "utf8");
const unexpected = receipts.filter((receipt) => receipt.outcome !== "expected");
if (unexpected.length) {
  console.error(JSON.stringify({ unexpected }, null, 2));
  process.exitCode = 1;
}
