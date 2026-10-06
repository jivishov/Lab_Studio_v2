/**
 * Writes the Pack 2 3D practice techniques and their list (decided 2026-10-05,
 * `planning/2026-09-23_lab-studio-3d/proposals/PACK2_ATOMIZATION.md`, decision 1A):
 *
 *   node scripts/practice3d/build.mjs [--check]
 *
 * Output: `public/techniques-3d/<id>.json` and `public/techniques-3d/index.json`, LF line endings.
 * `--check` writes nothing and fails when a file differs from what the modules describe.
 * The lab-bound originals in `public/techniques/` and the 2D catalogue are not read or written.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "public", "techniques-3d");

/** The practice list, in the order the 3D switcher shows Pack 2. `basedOn` names the lab-bound original. */
const PRACTICE = [
  { module: "./transferPractice.mjs", basedOn: "transfer", pack: 2,
    description: "Pour a measured sample into a beaker, let the cylinder drain, and rinse it in." },
  { module: "./precipitationPractice.mjs", basedOn: "hard-water-precipitation", pack: 2,
    description: "Add sodium carbonate in portions while stirring, then test that precipitation is complete." },
  { module: "./filtrationPractice.mjs", basedOn: "filtration", pack: 2,
    description: "Weigh and fold the paper, then filter by gravity: decant, pour down a rod, rinse and wash." },
  { module: "./dryingPractice.mjs", basedOn: "drying", pack: 2,
    description: "Dry the precipitate in two oven stages, handle it hot with tongs, and weigh it by difference." },
  { module: "./heatReweighPractice.mjs", basedOn: "thermal-decomposition-mass-loss", pack: 2,
    description: "Heat a carbonate mixture over a blue flame, lid askew, then cool and reweigh it to constant mass." },
];

const check = process.argv.includes("--check");
const files = new Map();
const index = [];
for (const entry of PRACTICE) {
  const definition = (await import(entry.module)).default;
  files.set(`${definition.id}.json`, `${JSON.stringify(definition, null, 2)}\n`);
  index.push({ id: definition.id, title: definition.title, description: entry.description, file: `${definition.id}.json`,
    pack: entry.pack, basedOn: entry.basedOn, tags: definition.metadata.tags });
}
files.set("index.json", `${JSON.stringify(index, null, 2)}\n`);

let stale = 0;
if (!check) mkdirSync(out, { recursive: true });
for (const [name, text] of files) {
  const path = join(out, name);
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  if (current === text) continue;
  if (check) { stale += 1; console.log(`stale: public/techniques-3d/${name}`); continue; }
  writeFileSync(path, text);
  console.log(`wrote public/techniques-3d/${name}`);
}
if (check && stale) process.exit(1);
