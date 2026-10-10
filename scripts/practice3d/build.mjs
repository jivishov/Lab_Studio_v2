/**
 * Writes the Pack 2 3D practice techniques and their list (decided 2026-10-05,
 * `planning/2026-09-23_lab-studio-3d/proposals/PACK2_ATOMIZATION.md`, decision 1A):
 *
 *   node scripts/practice3d/build.mjs [--check]
 *
 * Output: `public/techniques-3d/<id>.json` and `public/techniques-3d/index.json`, LF line endings.
 * `--check` writes nothing and fails when a file differs from what the modules describe.
 * The lab-bound originals in `public/techniques/` and the 2D catalogue are not written.
 *
 * D8 (decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design") adds, from the same modules:
 * - each composed practice version's twin, `public/techniques-3d/<original>-3d.json`, listed in
 *   `public/techniques-3d/twins.json` (never in the practice list, so the switcher never offers one), and the
 *   twins with no practice version (`TWINS`);
 * - the 3D labs, `public/labs-3d/<labId>.json` (composition sources) and `public/labs-3d/index.json`
 *   (their parts and setup fields), from `labs/*.mjs`. A Pack 1 original a lab composes as it is
 *   (`original(id)`) is read from `public/techniques/`; the 2D labs are not read.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeLab } from "./composeLab.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

/** Twins with no practice version of their own, composed by the 3D labs only (you, 2026-10-10). */
const TWINS = [{ module: "./measuringVolumeTwin.mjs", basedOn: "measuring-volume" }];

/** The 3D labs, in the order the switcher's Experiments group shows them. */
const LABS = ["./labs/introFiltrationDemo.mjs"];

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const check = process.argv.includes("--check");
const files = new Map();
const index = [];
const twins = [];
const twinsById = new Map();
for (const entry of PRACTICE) {
  const module = await import(entry.module);
  const definition = module.default;
  files.set(`techniques-3d/${definition.id}.json`, json(definition));
  index.push({ id: definition.id, title: definition.title, description: entry.description, file: `${definition.id}.json`,
    pack: entry.pack, basedOn: entry.basedOn, tags: definition.metadata.tags });
  if (module.twin) {
    files.set(`techniques-3d/${module.twin.id}.json`, json(module.twin));
    twins.push({ id: module.twin.id, file: `${module.twin.id}.json`, practiceId: definition.id, basedOn: entry.basedOn });
    twinsById.set(module.twin.id, module.twin);
  }
}
for (const entry of TWINS) {
  const { twin } = await import(entry.module);
  files.set(`techniques-3d/${twin.id}.json`, json(twin));
  twins.push({ id: twin.id, file: `${twin.id}.json`, basedOn: entry.basedOn });
  twinsById.set(twin.id, twin);
}
files.set("techniques-3d/index.json", json(index));
files.set("techniques-3d/twins.json", json(twins));

const labIndex = [];
for (const path of LABS) {
  const { source, entry } = composeLab((await import(path)).default, (part) => {
    if (part.technique.original) return JSON.parse(readFileSync(join(root, "public", "techniques", `${part.technique.original}.json`), "utf8"));
    if (!twinsById.has(part.technique.id)) throw new Error(`Lab part "${part.instanceId}" composes "${part.technique.id}", which is not a written twin.`);
    return part.technique;
  });
  files.set(`labs-3d/${entry.file}`, json(source));
  labIndex.push(entry);
}
files.set("labs-3d/index.json", json(labIndex));

let stale = 0;
for (const [name, text] of files) {
  const path = join(root, "public", ...name.split("/"));
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  if (current === text) continue;
  if (check) { stale += 1; console.log(`stale: public/${name}`); continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote public/${name}`);
}
if (check && stale) process.exit(1);
