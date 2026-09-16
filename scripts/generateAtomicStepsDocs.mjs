import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderDocs } from "./renderAtomicStepsDocs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readRegistry = (fileName) =>
  JSON.parse(readFileSync(join(root, "src", "domain", fileName), "utf8"));

const outputPath = join(root, "docs", "atomic-steps.md");
const contents = renderDocs({
  atoms: readRegistry("atomRegistry.json"),
  roles: readRegistry("equipmentRoleRegistry.json"),
});
writeFileSync(outputPath, contents);
console.log("wrote docs/atomic-steps.md");
