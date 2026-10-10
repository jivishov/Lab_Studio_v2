// Probe for the D8 brief, option (iv): a 3D intro-filtration-demo composed from "twins" (the Pack 2 practice
// versions with catalogDisposition "composable") and Pack 1's measuring-volume, compiled through the
// loader's own seam (compileBundledLabCompositionWithPolicy) with a 3D-first resolver. Bindings are derived
// mechanically (k-th instance of a definition in a technique → lab instance `<definition>-<k>`); it shows
// feasibility only, not a designed lab. Not a test run.
//   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
//     planning/2026-09-23_lab-studio-3d/probes/probe-d8-twins.mts
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { compileBundledLabCompositionWithPolicy } = await import(root + "src/data/bundledCatalogPolicyBoundary.ts");
const { createRuntimeState, performRuntimeAction } = await import(root + "src/runtime/index.ts");
const { resolveInteractionIntent } = await import(root + "src/runtime/interactionIntents.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { benchMoveRequest, intentTypeForInteraction, mergeActionInput } = await import(root + "src/studio3d/adapters/sceneToIntent.ts");
const { resolveActionInput } = await import(root + "src/runtime/actionInputs.ts");
const read = async (path: string) => JSON.parse(await readFile(new URL(root + path), "utf8"));

const plan = [
  { instanceId: "measuring-volume", dir: "techniques", id: "measuring-volume", twin: false },
  { instanceId: "transfer", dir: "techniques-3d", id: "transfer-practice", twin: true },
  { instanceId: "hard-water-precipitation", dir: "techniques-3d", id: "hard-water-precipitation-practice", twin: true },
  { instanceId: "filtration", dir: "techniques-3d", id: "filtration-practice", twin: true },
];
const twoD = await read("public/labs/intro-filtration-demo.json");
// Teacher-prepared values with no authored default (the 2D lab binds none of them): example values.
const teacherValues: Record<string, Record<string, unknown>> = {
  "hard-water-precipitation": { reagentVolumeMl: 20, precipitateObservation: "A white precipitate forms.",
    completenessObservation: "No further cloudiness where the drop meets the liquid." },
  filtration: { precipitateMassG: 0.0075, paperMassG: 0.912 },
};
const techniques = new Map<string, any>();
for (const step of plan) {
  const t = await read(`public/${step.dir}/${step.id}.json`);
  if (step.twin) t.composition.catalogDisposition = "composable";
  techniques.set(step.id, t);
}
const resolve = async (id: string) => {
  const t = techniques.get(id);
  if (!t) throw new Error(`unresolved ${id}`);
  return structuredClone(t);
};

const labItems = new Map<string, any>();
const twoDByDefinition = new Map(twoD.initialState.equipment.map((item: any) => [item.definitionId, item]));
const fill = (value: any, config: Record<string, any>): any => JSON.parse(JSON.stringify(value), (_key, leaf) => {
  if (typeof leaf !== "string") return leaf;
  const whole = /^\{\{config\.([A-Za-z0-9]+)\}\}$/.exec(leaf);
  return whole ? config[whole[1]] : leaf;
});
const instances = plan.map((step) => {
  const t = techniques.get(step.id);
  const twoDInstanceEarly = twoD.techniqueInstances.find((i: any) => i.instanceId === step.instanceId);
  const configEarly: Record<string, any> = {};
  for (const slot of t.composition.configurationSlots) configEarly[slot.id] = teacherValues[step.instanceId]?.[slot.id] ?? twoDInstanceEarly.bindings.configuration[slot.id] ?? slot.defaultValue;
  const seen = new Map<string, number>();
  const map = new Map<string, string>();
  for (const item of t.initialState.equipment) {
    const k = (seen.get(item.definitionId) ?? 0) + 1;
    seen.set(item.definitionId, k);
    const labId = `${item.definitionId}-${k}`;
    map.set(item.id, labId);
    if (!labItems.has(labId)) {
      const fromTwoD: any = k === 1 ? twoDByDefinition.get(item.definitionId) : undefined;
      // Items the 2D lab lacks keep the technique's own starting contents (the reagent beaker), except
      // vessels a practice version pre-fills only because it plays alone (none expected here).
      labItems.set(labId, { ...(fromTwoD ? structuredClone(fromTwoD) : fill(item, configEarly)), id: labId, location: "shelf" });
    }
  }
  const equipment: Record<string, any> = {};
  for (const role of t.composition.equipmentRoles) {
    equipment[role.roleId] = { sourceInstances: role.sourceInstanceIds.map((sourceInstanceId: string) => {
      const definitionId = t.initialState.equipment.find((item: any) => item.id === sourceInstanceId).definitionId;
      return { sourceInstanceId, definitionId, instanceId: map.get(sourceInstanceId) };
    }) };
  }
  const twoDInstance = twoD.techniqueInstances.find((i: any) => i.instanceId === step.instanceId);
  const configuration: Record<string, any> = {};
  for (const slot of t.composition.configurationSlots) {
    const value = teacherValues[step.instanceId]?.[slot.id] ?? twoDInstance.bindings.configuration[slot.id] ?? slot.defaultValue;
    if (value !== undefined) configuration[slot.id] = value;
  }
  return { instanceId: step.instanceId, techniqueId: step.id, version: t.metadata.version,
    bindings: { equipment, models: {}, configuration } };
});
const source = { ...structuredClone(twoD), id: "intro-filtration-demo",
  equipment: [...new Set([...labItems.values()].map((item) => item.definitionId))],
  initialState: { equipment: [...labItems.values()] },
  techniqueInstances: instances };

try {
  const lab: any = await compileBundledLabCompositionWithPolicy({ authority: "public-bundle",
    artifact: "public/labs-3d/intro-filtration-demo.json", catalogSource: source, resolveTechnique: resolve });
  console.log("compiled:", lab.compositionManifest.status, "steps", lab.process.nodes.length, "bench", lab.initialState.equipment.length);
  const parts = new Map<string, number>();
  for (const origin of Object.values(lab.compositionManifest.origins) as any[]) parts.set(origin.instanceId, (parts.get(origin.instanceId) ?? 0) + 1);
  console.log("steps per part:", JSON.stringify([...parts]));
  console.log("bench:", lab.initialState.equipment.map((item: any) => item.id).join(" "));
  if (process.env.PROBE_TITLES) console.log("titles:\n" + lab.process.nodes.map((n: any, i: number) => `${i + 1}. ${n.title}`).join("\n"));
  // Play it through the runtime as probe-practice.mts does (the Confirm path, counted portions and squirts).
  let state = createRuntimeState(lab);
  const inputs: Record<string, string> = JSON.parse(process.env.PROBE_INPUTS ?? "{}");
  const moves: Record<string, string | string[]> = JSON.parse(process.env.PROBE_MOVES ?? "{}");
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
    // PROBE_ROUND=1: a probe-only workaround for the defect this probe found (filterInPortions rounds the last
    // portion above the remaining liquid when upstream steps leave float noise, e.g. 54.0500000001 mL).
    if (process.env.PROBE_ROUND && action.parameters.pourPortionMl) {
      state = { ...state, equipmentInstances: state.equipmentInstances.map((e: any) => e.contents?.volumeMl
        ? { ...e, contents: { ...e.contents, volumeMl: Number(e.contents.volumeMl.toFixed(6)) } } : e) };
      notes.push("(volumes rounded: probe workaround)");
    }
    const repeats = Number(action.parameters.rinsePortions ?? action.parameters.inversions ?? action.parameters.portionsThisStep ?? (action.parameters.pourPortionMl ? 20 : 1));
    for (let i = 0; i < repeats * (action.parameters.stirBetweenPortions ? 2 : 1) && !state.completedNodes.includes(n.id); i += 1) {
      const stir = action.parameters.stirBetweenPortions && i % 2 === 1;
      notes.push(send(action, stir ? { type: "notebookRecordIntent", runtimeParameters: { portionOperation: "stir" } } : { type }, inputs[action.id] ?? ""));
      if (!notes.at(-1)!.startsWith("ok")) break;
    }
    console.log(`${action.id}: ${[...new Set(notes)].join(" / ")}`);
    if (!state.completedNodes.includes(n.id)) { console.log("   (node not completed)"); break; }
  }
  for (const id of ["graduated-cylinder-1", "beaker-250ml-1", "filter-paper-1", "erlenmeyer-flask-250ml-1"]) {
    console.log(`  ${id}: ${describe(state.equipmentInstances.find((e: any) => e.id === id)?.contents)}`);
  }
  console.log("complete " + state.completedNodes.length + "/" + lab.process.nodes.length);
} catch (e) { console.log("REFUSED:", e instanceof Error ? e.message.split("\n").slice(0, 25).join("\n") : e); }
