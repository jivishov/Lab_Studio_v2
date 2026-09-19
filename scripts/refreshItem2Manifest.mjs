import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const git = process.platform === "win32" ? "git.exe" : "git";
const manifestPath = join(root, "docs/item2/CHANGED_FILE_MANIFEST.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const head = execFileSync(git, ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

const blobFor = (relativePath) => {
  const output = execFileSync(git, ["ls-tree", "-r", head, "--", relativePath], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const line = output.split(/\r?\n/).find((candidate) => candidate.endsWith(`\t${relativePath}`));
  if (!line) throw new Error(`Path is not present in ${head}: ${relativePath}`);
  const match = line.match(/^[0-9]+ blob ([0-9a-f]{40})\t/);
  if (!match) throw new Error(`Unexpected ls-tree row for ${relativePath}: ${line}`);
  return match[1];
};

const paths = (entries) => [...new Set((entries ?? []).map((entry) => typeof entry === "string" ? entry : entry.path))]
  .sort()
  .map((path) => ({ path, blobSha: blobFor(path) }));

manifest.implementation = paths(manifest.implementation);
manifest.item2Records = paths(manifest.item2Records);
manifest.documentedHeadBeforeManifestUpdate = head;
manifest.blobVerification = {
  sourceFreezeCommit: head,
  verifiedEntries: manifest.implementation.length + manifest.item2Records.length,
  selfExcluded: manifest.selfExcluded === true,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  sourceFreezeCommit: head,
  implementationEntries: manifest.implementation.length,
  item2RecordEntries: manifest.item2Records.length,
  verifiedEntries: manifest.blobVerification.verifiedEntries,
}, null, 2));
