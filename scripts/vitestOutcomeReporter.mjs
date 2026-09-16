import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const normalizePath = (root, moduleId) => relative(root, moduleId).replaceAll("\\", "/");
const sorted = (values) => [...values].sort((left, right) => left.localeCompare(right));

const errorSummary = (error) => {
  if (error && typeof error === "object") {
    const value = error;
    return {
      name: typeof value.name === "string" ? value.name : undefined,
      message: typeof value.message === "string" ? value.message : String(error),
      stack: typeof value.stack === "string" ? value.stack : undefined,
    };
  }
  return { message: String(error) };
};

const looksLikeWorkerFailure = (error) => {
  const summary = errorSummary(error);
  return /\[vitest-pool\]|worker exited unexpectedly|failed to start .* worker|timeout starting .* runner|worker .* emitted error|ERR_WORKER_|JavaScript heap out of memory|reached heap limit|allocation failed/i
    .test(`${summary.name ?? ""} ${summary.message} ${summary.stack ?? ""}`);
};

/**
 * A future execution companion for F01. This reporter records file-level accounting rather than
 * collapsing discovery, collection, worker, and assertion outcomes into a single pass count.
 * It records final module and test accounting only; it does not infer a passed assertion from a
 * file that never completed.
 */
export default class VitestOutcomeReporter {
  constructor(options = {}) {
    this.outputFileOption = options.outputFile ?? "test-results/vitest-outcomes.json";
    this.root = process.cwd();
    this.outputFile = resolve(this.root, this.outputFileOption);
    this.resetRun();
  }

  onInit(vitest) {
    // Vitest can be launched with an explicit root from a different working directory. Use the
    // runner's resolved root so file identities and the output path describe that actual run.
    this.root = vitest.config.root;
    this.outputFile = resolve(this.root, this.outputFileOption);
  }

  resetRun() {
    this.discovered = new Set();
    this.collected = new Set();
    this.executed = new Set();
    this.skipped = new Set();
    this.collectionFailed = new Set();
    this.incomplete = new Set();
    this.collectionErrors = new Map();
    this.testCases = { passed: 0, failed: 0, skipped: 0, pending: 0 };
    this.finishedModules = new Set();
    this.startedAt = undefined;
  }

  pathFor(module) {
    return normalizePath(this.root, module.moduleId);
  }

  onTestRunStart(specifications) {
    this.resetRun();
    this.startedAt = new Date().toISOString();
    for (const specification of specifications) {
      this.discovered.add(normalizePath(this.root, specification.moduleId));
    }
  }

  onTestModuleCollected(module) {
    this.collected.add(this.pathFor(module));
  }

  finishModule(module) {
    const path = this.pathFor(module);
    // Vitest 5 reports a completed module through onTestModuleEnd and supplies that same module to
    // onTestRunEnd. Classification and test totals must remain exactly-once across both callbacks.
    if (this.finishedModules.has(path)) return;
    this.finishedModules.add(path);

    const errors = module.errors();
    if (errors.length > 0) {
      this.collectionFailed.add(path);
      this.collectionErrors.set(path, errors.map(errorSummary));
      return;
    }

    const state = module.state();
    if (state === "queued" || state === "pending") {
      this.incomplete.add(path);
      return;
    }
    if (state === "skipped") {
      this.skipped.add(path);
    } else {
      this.executed.add(path);
    }

    for (const test of module.children.allTests()) {
      const result = test.result();
      this.testCases[result.state] += 1;
    }
  }

  onTestModuleEnd(module) {
    this.finishModule(module);
  }

  async onTestRunEnd(testModules, unhandledErrors, reason) {
    for (const module of testModules) this.finishModule(module);

    const classified = new Set([
      ...this.executed,
      ...this.skipped,
      ...this.collectionFailed,
      ...this.incomplete,
    ]);
    const unclassified = sorted([...this.discovered].filter((path) => !classified.has(path)));
    const workerErrors = unhandledErrors.filter(looksLikeWorkerFailure);
    const workerFailed = new Set();

    if (workerErrors.length > 0) {
      // A failed worker can prevent several files from ever reaching collection. Preserve that
      // uncertainty as worker failure instead of mislabelling those files as assertion passes.
      for (const path of unclassified) workerFailed.add(path);
    } else if (reason === "interrupted") {
      for (const path of unclassified) this.incomplete.add(path);
    } else {
      for (const path of unclassified) this.collectionFailed.add(path);
    }

    const output = {
      schema: "lab-studio/vitest-outcome-accounting@1",
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      runReason: reason,
      status: reason === "passed" && unhandledErrors.length === 0 && this.collectionFailed.size === 0 && workerFailed.size === 0 && this.incomplete.size === 0
        ? "complete"
        : "incomplete-or-failed",
      files: {
        discovered: sorted(this.discovered),
        collected: sorted(this.collected),
        executed: sorted(this.executed),
        skipped: sorted(this.skipped),
        collectionFailed: sorted(this.collectionFailed),
        workerFailed: sorted(workerFailed),
        incomplete: sorted(this.incomplete),
      },
      testCases: this.testCases,
      collectionErrors: Object.fromEntries([...this.collectionErrors].sort(([left], [right]) => left.localeCompare(right))),
      workerErrors: workerErrors.map(errorSummary),
      unhandledErrors: unhandledErrors.map(errorSummary),
      classificationNote: "A file is only executed after its module completed without collection errors. Vitest-pool and explicit worker-exit errors leave affected uncollected files in workerFailed; other unattributed failures remain collectionFailed. Interrupted work remains incomplete. Startup failures before this reporter initializes must be accounted from the command exit and stderr because no report can be written.",
    };

    await mkdir(dirname(this.outputFile), { recursive: true });
    await writeFile(this.outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }
}
