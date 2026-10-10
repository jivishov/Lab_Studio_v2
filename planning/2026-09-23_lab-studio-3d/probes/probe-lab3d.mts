// Probe for D8 E3 (successor of probe-d8-twins.mts): a generated 3D lab from public/labs-3d/, compiled through the
// loader's seam (compileBundledLabCompositionWithPolicy) with the 3D resolver's order (a twin listed in
// public/techniques-3d/twins.json, else public/techniques/), then played through the runtime by the process
// control. No workaround. Not a test run.
//   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
//     planning/2026-09-23_lab-studio-3d/probes/probe-lab3d.mts [labId] ['{"field":"value"}']
// Env: PROBE_INPUTS and PROBE_MOVES by compiled action id (filtration--weigh-paper), PROBE_TITLES=1.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { compileBundledLabCompositionWithPolicy } = await import(root + "src/data/bundledCatalogPolicyBoundary.ts");
const { validateBundledLabSource } = await import(root + "src/domain/validation.ts");
const { createRuntimeState, performRuntimeAction } = await import(root + "src/runtime/index.ts");
const { resolveInteractionIntent } = await import(root + "src/runtime/interactionIntents.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { benchMoveRequest, intentTypeForInteraction, mergeActionInput } = await import(root + "src/studio3d/adapters/sceneToIntent.ts");
const { resolveActionInput } = await import(root + "src/runtime/actionInputs.ts");
const { applyLab3DSetup } = await import(root + "src/studio3d/labs3dSetup.ts");
const read = async (path: string) => JSON.parse(await readFile(new URL(root + path), "utf8"));

const [labId = "intro-filtration-demo", valuesJson = "{}"] = process.argv.slice(2);
const entry = (await read("public/labs-3d/index.json")).find((lab: any) => lab.id === labId);
const twins: any[] = await read("public/techniques-3d/twins.json");
const resolve = async (id: string) => {
  const twin = twins.find((t) => t.id === id);
  return read(twin ? `public/techniques-3d/${twin.file}` : `public/techniques/${id}.json`);
};
const source = await read(`public/labs-3d/${entry.file}`);
const validation = validateBundledLabSource(source);
console.log("source valid:", validation.ok, validation.errors.join("; "));
const values = Object.fromEntries(entry.setup.map((field: any) => [field.id, String(field.defaultValue)]));
Object.assign(values, JSON.parse(valuesJson));
const configured = applyLab3DSetup(source, entry, values);

try {
  const lab: any = await compileBundledLabCompositionWithPolicy({ authority: "public-bundle",
    artifact: `public/labs-3d/${entry.file}`, catalogSource: source, compilationSource: configured, resolveTechnique: resolve });
  console.log("compiled:", lab.compositionManifest.status, "steps", lab.process.nodes.length, "bench", lab.initialState.equipment.length);
  const parts = new Map<string, number>();
  for (const origin of lab.compositionManifest.origins) parts.set(origin.instanceId, (parts.get(origin.instanceId) ?? 0) + 1);
  console.log("steps per part:", JSON.stringify([...parts]));
  if (process.env.PROBE_TITLES) console.log("titles:\n" + lab.process.nodes.map((n: any, i: number) => `${i + 1}. ${n.title}`).join("\n"));
  let state = createRuntimeState(lab);
  const inputs: Record<string, string> = JSON.parse(process.env.PROBE_INPUTS ?? '{"filtration--weigh-paper":"' + values.paperMassG + '"}');
  const moves: Record<string, string | string[]> = JSON.parse(process.env.PROBE_MOVES ?? '{"filtration--fold-paper":"filter-paper-1"}');
  const send = (action: any, intent: any, input = "") => {
    const merged = mergeActionInput({ origin: "keyboard", ...intent }, resolveActionInput(action, input), action);
    const result = resolveInteractionIntent(lab, state, merged);
    if (!result.ok) return "REFUSED " + result.feedback.message;
    const before = state.feedbackQueue.length;
    state = performRuntimeAction(lab, state, result.request);
    const err = state.feedbackQueue.slice(before).find((f: any) => f.severity === "error");
    return err ? "ERROR " + err.message : "ok";
  };
  const describe = (c: any) => c ? `${c.label} ${c.volumeMl ?? ""} mL${c.precipitate ? " ppt " + JSON.stringify(c.precipitate) : ""}` : "-";
  for (const n of lab.process.nodes) {
    if (state.currentNodeId !== n.id) { console.log(`stuck before ${n.id} (current ${state.currentNodeId})`); break; }
    const action = lab.actions.find((a: any) => a.id === n.actionId);
    const type = intentTypeForInteraction[resolveActionInteraction(action).type];
    const notes: string[] = [];
    for (const [i, id] of [moves[action.id] ?? []].flat().entries()) state = performRuntimeAction(lab, state, benchMoveRequest(id, { x: 300 + 90 * i, y: 380 }, 50 + i));
    const repeats = Number(action.parameters.rinsePortions ?? action.parameters.inversions ?? action.parameters.portionsThisStep ?? (action.parameters.pourPortionMl ? 40 : 1));
    for (let i = 0; i < repeats * (action.parameters.stirBetweenPortions ? 2 : 1) && !state.completedNodes.includes(n.id); i += 1) {
      const stir = action.parameters.stirBetweenPortions && i % 2 === 1;
      notes.push(send(action, stir ? { type: "notebookRecordIntent", runtimeParameters: { portionOperation: "stir" } } : { type }, inputs[action.id] ?? ""));
      if (!notes.at(-1)!.startsWith("ok")) break;
    }
    console.log(`${action.id}: ${[...new Set(notes)].join(" / ")}`);
    if (!state.completedNodes.includes(n.id)) { console.log("   (node not completed)"); break; }
  }
  for (const id of ["sample-bottle-1", "graduated-cylinder-1", "beaker-250ml-1", "reagent-beaker-1", "beral-pipette-1", "filter-paper-1", "erlenmeyer-flask-250ml-1"]) {
    console.log(`  ${id}: ${describe(state.equipmentInstances.find((e: any) => e.id === id)?.contents)}`);
  }
  console.log("measurements", JSON.stringify(state.measurements.map((m: any) => [m.id, m.value, m.unit])));
  console.log("complete " + state.completedNodes.length + "/" + lab.process.nodes.length);
} catch (e) { console.log("REFUSED:", e instanceof Error ? e.message.split("\n").slice(0, 25).join("\n") : e); }
