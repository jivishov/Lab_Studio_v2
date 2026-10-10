// Probe for the D8 brief: compile a bundled lab through the loader's own seam
// (compileBundledLabCompositionWithPolicy), print the compiled manifest's shape, then try the same
// source with one instance swapped to its 3D practice version. Not a test run.
//   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
//     planning/2026-09-23_lab-studio-3d/probes/probe-d8-compile.mts <labId> [instanceId=practiceId]
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { compileBundledLabCompositionWithPolicy } = await import(root + "src/data/bundledCatalogPolicyBoundary.ts");
const { compileLabComposition } = await import(root + "src/data/compileLabComposition.ts");
const read = async (path: string) => JSON.parse(await readFile(new URL(root + path), "utf8"));
const resolve = async (id: string) => {
  try { return await read(`public/techniques/${id}.json`); } catch { return await read(`public/techniques-3d/${id}.json`); }
};
const [labId, swap] = process.argv.slice(2);
const source = await read(`public/labs/${labId}.json`);
try {
  const lab: any = await compileBundledLabCompositionWithPolicy({ authority: "public-bundle", artifact: `public/labs/${labId}.json`, catalogSource: source, resolveTechnique: resolve });
  const m = lab.compositionManifest;
  console.log("compiled:", m.status, "nodes", lab.process.nodes.length, "actions", lab.actions.length, "edges", lab.process.edges.length, "equipment", lab.initialState.equipment.length);
  console.log("manifest keys:", Object.keys(m).join(","));
  console.log("manifest instance[0]:", JSON.stringify(m.instances[0]).slice(0, 700));
  console.log("origins sample:", JSON.stringify(Object.entries(m.origins ?? {}).slice(0, 2)).slice(0, 700));
  console.log("node order:", lab.process.nodes.map((n: any) => n.id).join(" "));
  console.log("bench:", lab.initialState.equipment.map((e: any) => e.id).join(" "));
} catch (e) { console.log("REFUSED:", e instanceof Error ? e.message.slice(0, 1500) : e); }
if (swap) {
  const [inst, practiceId] = swap.split("=");
  const p = await read(`public/techniques-3d/${practiceId}.json`);
  const s = structuredClone(source);
  const ti = s.techniqueInstances.find((i: any) => i.instanceId === inst);
  ti.techniqueId = practiceId; ti.version = p.metadata.version;
  try { await compileLabComposition(s, resolve); console.log("swap compiled"); }
  catch (e) { console.log("swap REFUSED:", e instanceof Error ? e.message.split("\n").slice(0, 14).join("\n") : e); }
}
