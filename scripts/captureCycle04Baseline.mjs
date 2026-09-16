import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const lines = (value) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const tracked = lines(execFileSync("git", ["ls-files", "--", "."], { encoding: "utf8" }));
const untracked = lines(execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "."], { encoding: "utf8" }));
const excludedExact = new Set([
  "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_04_BASELINE_MANIFEST.json",
  "planning/2026-08-30_lab-studio-technique-composition-remediation/CONTINUATION_CYCLE_04.md",
]);
const excludedPattern = /(^|\/)(?:\.git|node_modules|dist|build|coverage|\.vite|\.cache)(\/|$)|(^|\/)\.env(?:\.|$)/i;
const candidates = [...new Set([...tracked, ...untracked])]
  .map((path) => path.replaceAll("\\", "/"))
  .filter((path) => !excludedExact.has(path) && !excludedPattern.test(path))
  .sort();
const files = candidates.map((path) => {
  const absolute = resolve(cwd, path);
  const bytes = readFileSync(absolute);
  return { path, size: statSync(absolute).size, sha256: createHash("sha256").update(bytes).digest("hex") };
});
const aggregate = createHash("sha256");
for (const file of files) aggregate.update(`${file.path}\0${file.size}\0${file.sha256}\n`);
const output = {
  schema: "lab-studio/cycle-04-baseline-manifest@1",
  baselineRevision: 1,
  transportMode: "sequential",
  repositoryScope: "Lab_studio only",
  git: {
    root: execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim().replaceAll("\\", "/"),
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    headIsCompleteBaseline: false,
  },
  exclusions: [
    "manifest self", "Cycle 04 continuation handoff", ".git", "node_modules", "build/dist/coverage/cache",
    "real .env files", "runtime attachments/provider handles", "sibling projects",
  ],
  fileCount: files.length,
  aggregateSha256: aggregate.digest("hex"),
  files,
  laneContractDependencyManifest: {
    schema: "lab-studio/lane-contract-dependencies@1",
    required: ["baselineRevision", "compilerContractVersion", "atomRegistrySha256", "equipmentRoleRegistrySha256", "routeAdapterSha256", "generatorDriverSha256", "generatorInputPath", "sourceTraceRegistrySha256", "atomicityAuditSha256", "labCompositionAuditSha256"],
  },
  returnProtocol: "Sequential tasks edit only their owned paths and continuation/overlay artifacts; no patch transport is used.",
};
const serialized = `${JSON.stringify(output)}\n`;
if (process.argv.includes("--write")) {
  const manifestPath = resolve(
    cwd,
    "planning/2026-08-30_lab-studio-technique-composition-remediation/evidence/CYCLE_04_BASELINE_MANIFEST.json",
  );
  writeFileSync(manifestPath, serialized);
  console.log(`wrote ${manifestPath}`);
} else {
  process.stdout.write(serialized);
}
