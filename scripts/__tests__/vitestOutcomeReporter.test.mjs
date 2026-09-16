import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import VitestOutcomeReporter from "../vitestOutcomeReporter.mjs";

const temporaryRoots = [];

const testCase = (state) => ({ result: () => ({ state }) });

const testModule = (root, relativePath, state, testStates = [], errors = []) => ({
  moduleId: join(root, relativePath),
  state: () => state,
  errors: () => errors,
  children: { allTests: () => testStates.map(testCase) },
});

const readReport = async (path) => JSON.parse(await readFile(path, "utf8"));

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Vitest outcome reporter", () => {
  it("classifies each discovered file and counts a completed module exactly once", async () => {
    const root = await mkdtemp(join(tmpdir(), "lab-studio-reporter-"));
    temporaryRoots.push(root);
    const outputFile = join(root, "outcomes.json");
    const reporter = new VitestOutcomeReporter({ outputFile });
    reporter.onInit({ config: { root } });

    const executed = testModule(root, "src/executed.test.ts", "failed", ["passed", "failed", "skipped"]);
    const skipped = testModule(root, "src/skipped.test.ts", "skipped", ["skipped"]);
    const collectionFailed = testModule(
      root,
      "src/collection-failed.test.ts",
      "failed",
      [],
      [{ name: "SyntaxError", message: "Unable to collect module" }],
    );
    const incomplete = testModule(root, "src/incomplete.test.ts", "pending");
    const workerFailedPath = join(root, "src/worker-failed.test.ts");
    const modules = [executed, skipped, collectionFailed, incomplete];

    reporter.onTestRunStart([
      ...modules.map((module) => ({ moduleId: module.moduleId })),
      { moduleId: workerFailedPath },
    ]);
    modules.forEach((module) => reporter.onTestModuleCollected(module));
    reporter.onTestModuleEnd(executed);
    await reporter.onTestRunEnd(
      modules,
      [{ name: "Error", message: "[vitest-pool]: Failed to start threads worker for test files" }],
      "failed",
    );

    const report = await readReport(outputFile);
    expect(report.files.executed).toEqual(["src/executed.test.ts"]);
    expect(report.files.skipped).toEqual(["src/skipped.test.ts"]);
    expect(report.files.collectionFailed).toEqual(["src/collection-failed.test.ts"]);
    expect(report.files.incomplete).toEqual(["src/incomplete.test.ts"]);
    expect(report.files.workerFailed).toEqual(["src/worker-failed.test.ts"]);
    expect(report.testCases).toEqual({ passed: 1, failed: 1, skipped: 2, pending: 0 });
    expect(report.workerErrors).toHaveLength(1);
    expect(report.status).toBe("incomplete-or-failed");
  });

  it("does not classify a generic resource assertion as a worker failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "lab-studio-reporter-"));
    temporaryRoots.push(root);
    const outputFile = join(root, "outcomes.json");
    const reporter = new VitestOutcomeReporter({ outputFile });
    reporter.onInit({ config: { root } });
    const moduleId = join(root, "src/uncollected.test.ts");

    reporter.onTestRunStart([{ moduleId }]);
    await reporter.onTestRunEnd(
      [],
      [{ name: "Error", message: "Public resource assertion failed" }],
      "failed",
    );

    const report = await readReport(outputFile);
    expect(report.files.workerFailed).toEqual([]);
    expect(report.files.collectionFailed).toEqual(["src/uncollected.test.ts"]);
    expect(report.workerErrors).toEqual([]);
    expect(report.unhandledErrors).toHaveLength(1);
  });
});
