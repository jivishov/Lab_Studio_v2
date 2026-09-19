import { createHash } from "node:crypto";
import { cp, copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutputRoot = resolve(repoRoot, "..", "..", "..", "local-builds", "item3-human-test");
const buildTimestamp = new Date().toISOString();

const intendedFeatureFlags = Object.freeze({
  studioCoreV1: false,
  assayStudioV1: true,
  assayImageImportV1: false,
  causalystLocalV1: true,
  causalystPromptBuildV1: false,
  causalystLtiV1: false,
  causalystAgsV1: false,
  causalystQtiExportV1: false,
});

const featureFlagEnvironment = Object.freeze({
  VITE_STUDIO_CORE_V1: "false",
  VITE_ASSAY_STUDIO_V1: "true",
  VITE_ASSAY_IMAGE_IMPORT_V1: "false",
  VITE_CAUSALYST_LOCAL_V1: "true",
  VITE_CAUSALYST_PROMPT_BUILD_V1: "false",
  VITE_CAUSALYST_LTI_V1: "false",
  VITE_CAUSALYST_AGS_V1: "false",
  VITE_CAUSALYST_QTI_EXPORT_V1: "false",
});

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const runGit = (args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = process.platform === "win32";

const directDependencyVersions = async (packageJson) => {
  const sections = ["dependencies", "devDependencies"];
  const resolved = {};
  for (const section of sections) {
    resolved[section] = {};
    for (const name of Object.keys(packageJson[section] ?? {}).sort()) {
      const dependencyPackage = await readJson(join(repoRoot, "node_modules", name, "package.json"));
      resolved[section][name] = dependencyPackage.version;
    }
  }
  return resolved;
};

const parseOptions = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
};

const formatBuildId = (sourceCommit) => {
  const timestamp = buildTimestamp
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `item3-human-test-${sourceCommit.slice(0, 12)}-${timestamp}`;
};

const runProductionBuild = async (environment) => {
  const child = spawn(npmExecutable, ["run", "build"], {
    cwd: repoRoot,
    env: environment,
    shell: npmShell,
    stdio: "inherit",
    windowsHide: false,
  });
  const [exitCode] = await once(child, "close");
  if (exitCode !== 0) throw new Error(`npm run build exited with code ${exitCode}.`);
};

const collectFiles = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    const relativePath = relative(root, path).replaceAll("\\", "/");
    if (
      relativePath === "_lab-studio-build.json" ||
      relativePath === "README.md" ||
      relativePath.startsWith("logs/")
    ) continue;
    if (entry.isDirectory()) files.push(...await collectFiles(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right));
};

const hashPackagePayload = async (root) => {
  const files = await collectFiles(root);
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(relative(root, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return { fileCount: files.length, sha256: hash.digest("hex") };
};

const chooseOutputDirectory = async (baseDirectory, buildId) => {
  if (!(await exists(baseDirectory))) {
    await mkdir(baseDirectory, { recursive: true });
    return baseDirectory;
  }
  const existingEntries = await readdir(baseDirectory);
  if (existingEntries.length === 0) return baseDirectory;
  const versionedDirectory = `${baseDirectory}-${buildId}`;
  if (await exists(versionedDirectory)) {
    throw new Error(`Refusing to overwrite existing build directory ${versionedDirectory}.`);
  }
  await mkdir(versionedDirectory, { recursive: true });
  return versionedDirectory;
};

const packageReadme = ({ buildId, sourceCommit, artifact }) => `# Lab Studio Item 3 local Windows build

Build: ${buildId}
Source commit: ${sourceCommit}
Artifact payload: ${artifact.sha256} (${artifact.fileCount} files)

## Start

1. Confirm Node.js is available on this Windows machine.
2. Double-click **launch-lab-studio.bat** in this folder.
3. The launcher opens [http://127.0.0.1:4180/](http://127.0.0.1:4180/).
4. The top navigation shows the build identifier and source commit used for this package.

## Stop and restart

- Double-click **stop-lab-studio.bat** to stop the preview owned by this package.
- Run **stop-lab-studio.bat**, then **launch-lab-studio.bat** again to restart it.
- The preview uses only loopback port 4180 and refuses a different service or build on that port.

## Human-test starting points

- Open **Labs** and **Techniques** to confirm the bundled catalogs load.
- Try the teacher setup/approval gate before previewing an unapproved configured technique.
- Exercise Paper Chromatography, Green Chemistry, and Quick Ache recovery/refusal paths.
- Use the normal pointer and keyboard controls. Camera hardware and scientific/classroom certification are outside this package.

The machine-readable identity and feature flags are in **_lab-studio-build.json**. Preview logs are written under **logs** after launch.

`;

const main = async () => {
  const options = parseOptions(process.argv.slice(2));
  const packageJson = await readJson(join(repoRoot, "package.json"));
  const status = runGit(["status", "--porcelain", "--untracked-files=all"]);
  if (status) throw new Error("The Item 3 build requires a clean source worktree; commit source changes before building.");
  if (!(await exists(join(repoRoot, "node_modules")))) throw new Error("node_modules is missing; prepare dependencies before building.");

  const sourceCommit = runGit(["rev-parse", "HEAD"]);
  const sourceTree = runGit(["rev-parse", "HEAD^{tree}"]);
  const buildId = typeof options["build-id"] === "string" ? options["build-id"] : formatBuildId(sourceCommit);
  const outputRoot = resolve(typeof options["output-dir"] === "string" ? options["output-dir"] : process.env.LAB_STUDIO_ITEM3_OUTPUT ?? defaultOutputRoot);

  const environment = {
    ...process.env,
    ...featureFlagEnvironment,
    VITE_LAB_STUDIO_BUILD_ID: buildId,
    VITE_LAB_STUDIO_BUILD_SOURCE_COMMIT: sourceCommit,
    VITE_LAB_STUDIO_BUILD_TIMESTAMP: buildTimestamp,
    VITE_LAB_STUDIO_BUILD_FEATURE_PROFILE: "item3-human-test",
  };

  await runProductionBuild(environment);
  const packageDirectory = await chooseOutputDirectory(outputRoot, buildId);
  await cp(join(repoRoot, "dist"), packageDirectory, { recursive: true });
  await copyFile(join(repoRoot, "scripts", "item3LocalPreviewServer.mjs"), join(packageDirectory, "_lab-studio-preview-server.mjs"));
  await copyFile(join(repoRoot, "scripts", "item3LocalPreviewLauncher.ps1"), join(packageDirectory, "_lab-studio-preview-launcher.ps1"));
  await copyFile(join(repoRoot, "launch-lab-studio.bat"), join(packageDirectory, "launch-lab-studio.bat"));
  await copyFile(join(repoRoot, "stop-lab-studio.bat"), join(packageDirectory, "stop-lab-studio.bat"));

  const artifact = await hashPackagePayload(packageDirectory);
  const npmVersion = execFileSync(npmExecutable, ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: npmShell,
  }).trim();
  const record = {
    schema: "lab-studio/item3-local-build@1",
    buildId,
    scope: "Item 3 runnable local Windows human-test build",
    generatedAt: buildTimestamp,
    source: { commit: sourceCommit, tree: sourceTree },
    application: {
      packageVersion: packageJson.version,
      artifactPayloadSha256: artifact.sha256,
      artifactFileCount: artifact.fileCount,
      artifactPayloadExcludes: ["_lab-studio-build.json", "README.md", "logs/**"],
    },
    runtime: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      npm: npmVersion,
      dependencies: await directDependencyVersions(packageJson),
    },
    featureProfile: "item3-human-test",
    featureFlags: intendedFeatureFlags,
    launch: {
      url: "http://127.0.0.1:4180/",
      host: "127.0.0.1",
      port: 4180,
      server: "_lab-studio-preview-server.mjs",
      launcher: "launch-lab-studio.bat",
      stopCommand: "stop-lab-studio.bat",
    },
    build: { command: "npm run build", typeScriptStep: "tsc -b", bundlerStep: "vite build", exitCode: 0 },
  };
  await writeFile(join(packageDirectory, "_lab-studio-build.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await writeFile(join(packageDirectory, "README.md"), packageReadme({ buildId, sourceCommit, artifact }), "utf8");

  console.log(JSON.stringify({ buildId, packageDirectory, sourceCommit, sourceTree, artifact }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
