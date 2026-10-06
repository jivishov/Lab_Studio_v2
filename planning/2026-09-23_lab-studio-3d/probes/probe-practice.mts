// Probe: a Pack 2 practice technique through the runtime (the Confirm path, counted squirts and
// portions), plus validation, the composition contract, the derived effects, the evidence audit and
// the catalogue policy. Not a test run.
//   node --experimental-strip-types --experimental-loader ./scripts/tsCompositionLoader.mjs \
//     planning/2026-09-23_lab-studio-3d/probes/probe-practice.mts <id> '<config json>' [watch ids,comma]
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { applyTechniqueConfiguration } = await import(root + "src/data/techniqueConfiguration.ts");
const { createRuntimeState, performRuntimeAction } = await import(root + "src/runtime/index.ts");
const { resolveInteractionIntent } = await import(root + "src/runtime/interactionIntents.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { benchMoveRequest, intentTypeForInteraction, mergeActionInput } = await import(root + "src/studio3d/adapters/sceneToIntent.ts");
const { resolveActionInput } = await import(root + "src/runtime/actionInputs.ts");
const { validateTechniqueDefinition } = await import(root + "src/domain/validation.ts");
const { validateTechniqueCompositionContract } = await import(root + "src/domain/compositionValidation.ts");
const { deriveActionEffectContract } = await import(root + "src/domain/atomRegistry.ts");
const { auditStandaloneEvidence } = await import(root + "src/data/standaloneEvidenceAudit.ts");
const { assessBundledTechniqueCatalogPolicy } = await import(root + "src/data/bundledCatalogPolicyBoundary.ts");

const [id, configJson = "{}", watchList = ""] = process.argv.slice(2);
const raw = JSON.parse(await readFile(new URL(root + `public/techniques-3d/${id}.json`), "utf8"));
const v = validateTechniqueDefinition(raw);
console.log("validates:", v.ok, (v.errors ?? []).slice(0, 12).join(" | "));
const cc = validateTechniqueCompositionContract(raw);
console.log("composition contract:", cc.ok, (cc.errors ?? []).slice(0, 12).join(" | "));
for (const action of raw.actions) {
  const effect = deriveActionEffectContract(action);
  if (effect.errors.length) console.log("effect errors", action.id, effect.errors.join(" | "));
}
try { await assessBundledTechniqueCatalogPolicy("public-bundle", `public/techniques-3d/${id}.json`, raw); console.log("policy: accepted"); }
catch (e) { console.log("policy: REFUSED", e instanceof Error ? e.message.slice(0, 1500) : e); }
let def: any;
try { def = applyTechniqueConfiguration(raw, JSON.parse(configJson)); }
catch (e) { console.log("setup refused:", e instanceof Error ? e.message : e); process.exit(0); }
const cv = validateTechniqueDefinition(def);
console.log("configured validates:", cv.ok, (cv.errors ?? []).slice(0, 8).join(" | "));
console.log("audit:", JSON.stringify(auditStandaloneEvidence(def)));

const describe = (c: any) => c ? `${c.kind} "${c.label}" vol ${c.volumeMl} mass ${c.massG} ${c.temperatureC !== undefined ? `T ${c.temperatureC} ` : ""}solutes ${JSON.stringify(c.solutes?.map((s: any) => [s.id, s.amount, s.unit]))}${c.precipitate ? ` ppt ${JSON.stringify(c.precipitate)}` : ""} ${c.visualState}/${c.wetState}` : "-";
const watch = watchList ? watchList.split(",") : def.initialState.equipment.map((e: any) => e.id);

let state = createRuntimeState(def);
const send = (action: any, intent: any, input = "") => {
  const merged = mergeActionInput({ origin: "keyboard", ...intent }, resolveActionInput(action, input), action);
  const result = resolveInteractionIntent(def, state, merged);
  if (!result.ok) return "REFUSED " + result.feedback.message;
  const before = state.feedbackQueue.length;
  state = performRuntimeAction(def, state, result.request);
  const added = state.feedbackQueue.slice(before);
  const err = added.find((f: any) => f.severity === "error");
  return err ? "ERROR " + err.message + " / " + (err.recovery ?? "") : (added.at(-1)?.message ?? "ok(no feedback)");
};
const inputs: Record<string, string> = JSON.parse(process.env.PROBE_INPUTS ?? "{}");
// Free moves made before a step (a paper lifted off the balance pan before it is folded): action id -> instance id.
const moves: Record<string, string | string[]> = JSON.parse(process.env.PROBE_MOVES ?? "{}");
for (const n of def.process.nodes) {
  if (state.currentNodeId !== n.id) { console.log(`stuck before ${n.id} (current ${state.currentNodeId})`); break; }
  const action = def.actions.find((a: any) => a.id === n.actionId);
  const interaction = resolveActionInteraction(action);
  const type = intentTypeForInteraction[interaction.type];
  const notes: string[] = [];
  for (const [i, id] of [moves[action.id] ?? []].flat().entries()) {
    state = performRuntimeAction(def, state, benchMoveRequest(id, { x: 300 + 90 * i, y: 380 }, 50 + i));
    notes.push(`(moved ${id} to the bench)`);
  }
  const repeats = Number(action.parameters.rinsePortions ?? action.parameters.inversions ?? action.parameters.portionsThisStep ?? (action.parameters.pourPortionMl ? 20 : 1));
  for (let i = 0; i < repeats * (action.parameters.stirBetweenPortions ? 2 : 1) && !state.completedNodes.includes(n.id); i += 1) {
    const stir = action.parameters.stirBetweenPortions && i % 2 === 1;
    notes.push(send(action, stir ? { type: "notebookRecordIntent", runtimeParameters: { portionOperation: "stir" } } : { type }, inputs[action.id] ?? ""));
    if (notes.at(-1)!.startsWith("REFUSED") || notes.at(-1)!.startsWith("ERROR")) break;
  }
  console.log(`${n.id} [${interaction.type}]: ${notes.join(" / ")}`);
  for (const w of watch) {
    const inst = state.equipmentInstances.find((e: any) => e.id === w);
    console.log(`      ${w}@${inst?.location} ${describe(inst?.contents)}`);
  }
  if (process.env.PROBE_DUMP) console.log("      dump " + JSON.stringify(state.equipmentInstances.find((e: any) => e.id === process.env.PROBE_DUMP)));
  if (!state.completedNodes.includes(n.id)) { console.log("   (node not completed)"); break; }
}
console.log("attachments " + JSON.stringify(state.attachments.map((a: any) => [a.childInstanceId, a.parentInstanceId, a.zoneId])));
console.log("measurements " + JSON.stringify(state.measurements.map((m: any) => [m.id, m.value, m.unit])));
console.log("calculations " + JSON.stringify(state.calculations.map((c: any) => [c.id, c.value, c.expected])));
console.log("notebook " + JSON.stringify(state.notebook.map((e: any) => [e.tags, e.text?.slice?.(0, 80) ?? e.note?.slice?.(0, 80)])));
console.log("complete " + state.completedNodes.length + "/" + def.process.nodes.length);
