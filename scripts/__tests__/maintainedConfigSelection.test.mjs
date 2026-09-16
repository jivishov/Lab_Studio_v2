import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nodeTest from "node:test";

const appRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "../.."));
const maintainedConfigPath = join(appRoot, "vite.config.ts");
const expectedInclude = [
  "src/**/*.{test,spec}.{ts,tsx}",
  "server/**/*.{test,spec}.{ts,tsx}",
  "scripts/**/*.{test,spec}.{js,mjs}",
];
const expectedExcludedArchives = [
  "**/Refined_Implementation_Plan_2026-07-18/**",
  "**/Lab_Studio_Assay_Causalyst_Refined_Implementation_Plan_2026-07-18/**",
];
const test = process.env.VITEST ? (await import("vitest")).test : nodeTest;

const normalizeRelativePath = (root, path) => relative(root, path).replaceAll("\\", "/");

const assertExplicitConfig = (name, command, { run, reporters = [] }) => {
  assert.equal(typeof command, "string", `${name} must remain a Vitest command`);
  const tokens = command.trim().split(/\s+/);
  assert.equal(tokens[0], "vitest", `${name} must invoke Vitest`);
  assert.equal(tokens.includes("run"), run, `${name} must preserve its execution mode`);

  const configPositions = tokens
    .map((token, index) => (token === "--config" ? index : -1))
    .filter((index) => index >= 0);
  assert.equal(configPositions.length, 1, `${name} must select one explicit config`);
  assert.equal(tokens[configPositions[0] + 1], "vite.config.ts", `${name} must select the maintained TypeScript config`);
  for (const reporter of reporters) assert.ok(tokens.includes(reporter), `${name} must preserve ${reporter}`);
};

test("maintained Vitest scripts select TypeScript discovery rules despite a synthetic JavaScript shadow", async () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  assertExplicitConfig("test", packageJson.scripts.test, { run: true });
  assertExplicitConfig("test:accounting", packageJson.scripts["test:accounting"], {
    run: true,
    reporters: ["--reporter=default", "--reporter=./scripts/vitestOutcomeReporter.mjs"],
  });
  assertExplicitConfig("test:watch", packageJson.scripts["test:watch"], { run: false });

  const fixtureParent = join(appRoot, "tmp");
  mkdirSync(fixtureParent, { recursive: true });
  const fixtureRoot = mkdtempSync(join(fixtureParent, "maintained-config-selection-"));
  const fixtureConfigPath = join(fixtureRoot, "vite.config.ts");

  try {
    mkdirSync(join(fixtureRoot, "src", "test"), { recursive: true });
    writeFileSync(join(fixtureRoot, "src", "test", "setup.ts"), "");
    writeFileSync(fixtureConfigPath, readFileSync(maintainedConfigPath, "utf8"));
    writeFileSync(
      join(fixtureRoot, "vite.config.js"),
      'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { include: ["legacy/**/*.test.js"], exclude: [] } });\n',
    );

    const { resolveConfig } = await import("vitest/node");
    const resolved = await resolveConfig({
      root: fixtureRoot,
      config: fixtureConfigPath,
      pool: "forks",
      maxWorkers: 1,
      fileParallelism: false,
    });

    assert.equal(realpathSync(resolved.configFile), realpathSync(fixtureConfigPath));
    assert.deepEqual(resolved.test.include, expectedInclude);
    for (const archivePattern of expectedExcludedArchives) {
      assert.ok(resolved.test.exclude.includes(archivePattern), `maintained exclusion ${archivePattern} must remain active`);
    }
    assert.equal(resolved.test.environment, "jsdom");
    assert.deepEqual(resolved.test.setupFiles.map((path) => normalizeRelativePath(fixtureRoot, path)), ["src/test/setup.ts"]);
    assert.ok(!resolved.test.include.includes("legacy/**/*.test.js"), "the synthetic JavaScript sibling must not shadow the explicit TypeScript config");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
