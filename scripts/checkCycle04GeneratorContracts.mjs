import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tempRoot = await mkdtemp(join(tmpdir(), "labstudio-cycle04-generators-"));
const scenarios = [];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const asJson = (value) => JSON.stringify(value);
const normalizedBaselineTime = new Date("2000-01-01T00:00:00.000Z");

/**
 * These are the complete copied inputs for each generator, not a guess based on its output folder.
 * The final delta below covers this entire copied scope, so a deletion or an unexpected side effect
 * outside `public/` cannot disappear merely because it is absent from the after snapshot.
 */
const generatorDependencyInventory = {
  simulator: [
    "scripts/generatorInputs/simulator",
    "public/techniques",
  ],
  ap: [
    "scripts/generatorInputs/apChem",
    "scripts/generatorInputs/titration",
    "public/techniques",
    "src/domain/atomRegistry.json",
  ],
  handWarmer: [
    "scripts/generatorInputs/handWarmerCalorimetry.mjs",
    "public/techniques",
    "public/labs",
    "experiments/lab-studio/docs/hand-warmer-calorimetry/source-traceability.md",
  ],
};

const listFiles = async (base, current = base) => {
  const entries = await readdir(current, { withFileTypes: true });
  const values = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) values.push(...await listFiles(base, path));
    else values.push(relative(base, path).replaceAll("\\", "/"));
  }
  return values.sort();
};

const snapshot = async (base) => Object.fromEntries(await Promise.all((await listFiles(base)).map(async (path) => {
  const info = await stat(join(base, path));
  const bytes = await readFile(join(base, path));
  return [path, { sha256: sha(bytes), mtimeMs: info.mtimeMs }];
})));

const normalizeFinalMetadataBaseline = async (base) => {
  await Promise.all((await listFiles(base)).map((path) =>
    utimes(join(base, path), normalizedBaselineTime, normalizedBaselineTime)));
};

const copyPath = async (targetRoot, sourceRelative) => {
  const source = join(root, sourceRelative);
  const target = join(targetRoot, sourceRelative);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
};

const createScenario = async (name, paths) => {
  const target = join(tempRoot, name);
  await mkdir(target, { recursive: true });
  for (const path of new Set(paths)) await copyPath(target, path);
  // `cp` and a fast generator write can otherwise land in the same filesystem timestamp tick.
  // Normalize copied files before the first snapshot so a file that still exists after being
  // rewritten has an observable final metadata change without pretending to trace transient I/O.
  await normalizeFinalMetadataBaseline(target);
  return target;
};

const finalDelta = (before, after) => {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const created = paths.filter((path) => !before[path] && after[path]);
  const deleted = paths.filter((path) => before[path] && !after[path]);
  const changed = paths.filter((path) => before[path] && after[path] && before[path].sha256 !== after[path].sha256);
  // This records metadata that differs in the final snapshot, not a transient-write trace. A
  // generator could still write and restore both bytes and metadata before this snapshot.
  const finalMetadataChanged = paths.filter((path) =>
    before[path] && after[path] && before[path].mtimeMs !== after[path].mtimeMs);
  return { created, deleted, changed, finalMetadataChanged, paths: [...created, ...deleted, ...changed].sort() };
};

const assertExactPaths = (name, actual, expected) => {
  const normalizedExpected = [...expected].sort();
  if (asJson(actual) !== asJson(normalizedExpected)) {
    throw new Error(`${name} ${asJson(actual)}; expected ${asJson(normalizedExpected)}.`);
  }
};

const assertOnlyDeclaredOutputs = (name, paths, declaredOutputs) => {
  const undeclared = paths.filter((path) => !declaredOutputs.includes(path));
  if (undeclared.length > 0) {
    throw new Error(`${name} changed undeclared sandbox paths: ${undeclared.join(", ")}.`);
  }
};

const runScenario = async ({
  name,
  script,
  args,
  dependencyKey,
  declaredOutputs,
  expectedFinalMetadataChanged,
  expectedFinalDelta = [],
  assertionKind,
}) => {
  const dependencies = generatorDependencyInventory[dependencyKey];
  if (!dependencies) throw new Error(`${name} refers to unknown generator dependency key "${dependencyKey}".`);
  const target = await createScenario(name, [script, ...dependencies]);
  const before = await snapshot(target);
  execFileSync(process.execPath, [join(target, script), ...args], { cwd: target, stdio: "pipe" });
  const after = await snapshot(target);
  const delta = finalDelta(before, after);

  assertOnlyDeclaredOutputs(`${name} final delta`, delta.paths, declaredOutputs);
  assertExactPaths(`${name} final delta`, delta.paths, expectedFinalDelta);
  assertExactPaths(`${name} final output ownership`, delta.finalMetadataChanged, expectedFinalMetadataChanged);

  scenarios.push({
    name,
    assertionKind,
    script,
    args,
    sandboxDependencies: dependencies,
    declaredOutputs,
    finalDelta: { created: delta.created, deleted: delta.deleted, changed: delta.changed },
    finalMetadataChanged: delta.finalMetadataChanged,
  });
};

try {
  await runScenario({
    name: "simulator-targeted",
    assertionKind: "targeted-output-ownership-and-byte-parity",
    script: "scripts/generateSimulatorTechniqueDefinitions.mjs",
    args: ["--only", "transmittance-dilution"],
    dependencyKey: "simulator",
    declaredOutputs: ["public/techniques/transmittance-dilution.json"],
    expectedFinalMetadataChanged: ["public/techniques/transmittance-dilution.json"],
  });
  await runScenario({
    name: "ap-targeted",
    assertionKind: "targeted-output-ownership-and-byte-parity",
    script: "scripts/generateApChemTechniqueFragments.mjs",
    args: ["--only", "beers-law-calibration"],
    dependencyKey: "ap",
    declaredOutputs: ["public/techniques/beers-law-calibration.json"],
    expectedFinalMetadataChanged: ["public/techniques/beers-law-calibration.json"],
  });
  await runScenario({
    name: "hand-warmer-no-index",
    assertionKind: "targeted-output-ownership-and-byte-parity",
    script: "scripts/generateHandWarmerCalorimetry.mjs",
    args: ["--no-index"],
    dependencyKey: "handWarmer",
    declaredOutputs: [
      "public/labs/hand-warmer-calorimetry.json",
      "public/techniques/hand-warmer-calorimetry.json",
    ],
    expectedFinalMetadataChanged: [
      "public/labs/hand-warmer-calorimetry.json",
      "public/techniques/hand-warmer-calorimetry.json",
    ],
  });
  await runScenario({
    name: "simulator-full-default",
    assertionKind: "full-default-byte-parity-and-output-ownership",
    script: "scripts/generateSimulatorTechniqueDefinitions.mjs",
    args: [],
    dependencyKey: "simulator",
    declaredOutputs: [
      "public/techniques/paper-chromatography.json",
      "public/techniques/thermal-decomposition-mass-loss.json",
      "public/techniques/transmittance-dilution.json",
    ],
    expectedFinalMetadataChanged: [
      "public/techniques/paper-chromatography.json",
      "public/techniques/thermal-decomposition-mass-loss.json",
      "public/techniques/transmittance-dilution.json",
    ],
  });
  await runScenario({
    name: "ap-full-default",
    assertionKind: "full-default-known-final-delta-and-output-ownership",
    script: "scripts/generateApChemTechniqueFragments.mjs",
    args: [],
    dependencyKey: "ap",
    declaredOutputs: [
      "public/techniques/beers-law-calibration.json",
      "public/techniques/bonding-solids-tests.json",
      "public/techniques/brass-spectrophotometry.json",
      "public/techniques/crystal-violet-kinetics.json",
      "public/techniques/hard-water-gravimetry.json",
      "public/techniques/index.json",
      "public/techniques/redox-titration.json",
      "public/techniques/tablet-separation.json",
      "public/techniques/titration-curve-analysis.json",
      "public/techniques/titration-endpoint.json",
    ],
    expectedFinalMetadataChanged: [
      "public/techniques/beers-law-calibration.json",
      "public/techniques/bonding-solids-tests.json",
      "public/techniques/brass-spectrophotometry.json",
      "public/techniques/crystal-violet-kinetics.json",
      "public/techniques/hard-water-gravimetry.json",
      "public/techniques/index.json",
      "public/techniques/redox-titration.json",
      "public/techniques/tablet-separation.json",
      "public/techniques/titration-curve-analysis.json",
      "public/techniques/titration-endpoint.json",
    ],
    expectedFinalDelta: [
      "public/techniques/index.json",
      "public/techniques/redox-titration.json",
      "public/techniques/titration-curve-analysis.json",
      "public/techniques/titration-endpoint.json",
    ],
  });
  await runScenario({
    name: "hand-warmer-full-default",
    assertionKind: "full-default-byte-parity-and-output-ownership",
    script: "scripts/generateHandWarmerCalorimetry.mjs",
    args: [],
    dependencyKey: "handWarmer",
    declaredOutputs: [
      "public/labs/hand-warmer-calorimetry.json",
      "public/labs/index.json",
      "public/techniques/hand-warmer-calorimetry.json",
      "public/techniques/index.json",
    ],
    expectedFinalMetadataChanged: [
      "public/labs/hand-warmer-calorimetry.json",
      "public/labs/index.json",
      "public/techniques/hand-warmer-calorimetry.json",
      "public/techniques/index.json",
    ],
  });
  console.log(JSON.stringify({
    passed: scenarios.length,
    dependencyInventory: generatorDependencyInventory,
    historicalProofs: "Frozen historical proofs are not re-pinned or rewritten by this checker.",
    scenarios,
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
