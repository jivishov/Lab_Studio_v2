// Probe: the atomized Make a Solution through the runtime (Confirm path, rinses, the swirl, drops and
// inversions), plus validation, the composition contract, the evidence audit, the setup rules and the
// catalogue policy. Not a test run.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { applyTechniqueConfiguration } = await import(root + "src/data/techniqueConfiguration.ts");
const { createRuntimeState, performRuntimeAction } = await import(root + "src/runtime/index.ts");
const { resolveInteractionIntent } = await import(root + "src/runtime/interactionIntents.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { intentTypeForInteraction, mergeActionInput } = await import(root + "src/studio3d/adapters/sceneToIntent.ts");
const { resolveActionInput } = await import(root + "src/runtime/actionInputs.ts");
const { validateTechniqueDefinition } = await import(root + "src/domain/validation.ts");
const { validateTechniqueCompositionContract } = await import(root + "src/domain/compositionValidation.ts");
const { deriveActionEffectContract } = await import(root + "src/domain/atomRegistry.ts");
const { auditStandaloneEvidence } = await import(root + "src/data/standaloneEvidenceAudit.ts");
const { assessBundledTechniqueCatalogPolicy } = await import(root + "src/data/bundledCatalogPolicyBoundary.ts");

const raw = JSON.parse(await readFile(new URL(root + "public/techniques/making-solution.json"), "utf8"));
const v = validateTechniqueDefinition(raw);
console.log("published validates:", v.ok, (v.errors ?? []).slice(0, 8).join(" | "));
const cc = validateTechniqueCompositionContract(raw);
console.log("composition contract:", cc.ok, (cc.errors ?? []).slice(0, 8).join(" | "));
for (const action of raw.actions) {
  const effect = deriveActionEffectContract(action);
  if (effect.errors.length) console.log("effect errors", action.id, effect.errors.join(" | "));
}
try { await assessBundledTechniqueCatalogPolicy("bundled", "public/techniques/making-solution.json", raw); console.log("policy: accepted"); }
catch (e) { console.log("policy: REFUSED", e instanceof Error ? e.message.slice(0, 900) : e); }
for (const bad of [{ soluteMassG: "0", solutionObservation: "Clear" }, { soluteMassG: "12", solutionObservation: "Clear" }]) {
  try { applyTechniqueConfiguration(raw, bad); console.log("setup accepted", JSON.stringify(bad), "(should refuse)"); }
  catch (e) { console.log("setup refuses", JSON.stringify(bad), "->", e instanceof Error ? e.message.slice(0, 160) : e); }
}
const def = applyTechniqueConfiguration(raw, { soluteMassG: "2.5", solutionObservation: "Clear, colourless solution; no solid left" });
const cv = validateTechniqueDefinition(def);
console.log("configured validates:", cv.ok, (cv.errors ?? []).slice(0, 6).join(" | "));
console.log("audit:", JSON.stringify(auditStandaloneEvidence(def)));

const describe = (c: any) => c ? `${c.kind} "${c.label}" vol ${c.volumeMl} mass ${c.massG} solutes ${JSON.stringify(c.solutes?.map((s: any) => [s.id, s.amount, s.unit]))}${c.concentration ? ` conc ${c.concentration.value.toFixed(3)} ${c.concentration.unit}` : ""} ${c.visualState}/${c.wetState}` : "-";

const run = (mode: "good" | "overshoot" | "swirl-out-of-sequence") => {
  let state = createRuntimeState(def);
  const out: string[] = [];
  const send = (action: any, intent: any) => {
    const merged = mergeActionInput({ origin: "keyboard", ...intent }, resolveActionInput(action, ""), action);
    const result = resolveInteractionIntent(def, state, merged);
    if (!result.ok) return "REFUSED " + result.feedback.message;
    const before = state.feedbackQueue.length;
    state = performRuntimeAction(def, state, result.request);
    const added = state.feedbackQueue.slice(before);
    const err = added.find((f: any) => f.severity === "error");
    return err ? "ERROR " + err.message + " / " + (err.recovery ?? "") : (added.at(-1)?.message ?? "ok(no feedback)");
  };
  for (const node of def.process.nodes) {
    if (state.currentNodeId !== node.id) { out.push(`stuck before ${node.id} (current ${state.currentNodeId})`); break; }
    const action = def.actions.find((a: any) => a.id === node.actionId);
    const interaction = resolveActionInteraction(action);
    let note = "";
    if (mode === "swirl-out-of-sequence" && action.id === "fill-water-half") {
      // A swirl sent before its step (the flask is not yet half full) is refused as out of sequence.
      const swirl = def.actions.find((a: any) => a.id === "swirl-to-dissolve");
      out.push("swirl before its step -> " + send(swirl, { type: "notebookRecordIntent" }));
    }
    if (interaction.type === "dispenseDrops") {
      const target = mode === "overshoot" ? 23 : 20;
      let sent = 0;
      while (sent < target) {
        const n = Math.min(40, target - sent);
        note = send(action, { type: "dispenseDropIntent", runtimeParameters: { dropCount: n } });
        sent += n;
        if (note.startsWith("REFUSED") || note.startsWith("ERROR")) break;
      }
      note = `${sent} drops; accept -> ` + send(action, { type: "dispenseCompleteIntent" });
    } else if (action.id === "invert-to-mix") {
      for (let i = 0; i < 10; i += 1) note = send(action, { type: "notebookRecordIntent" });
    } else {
      note = send(action, { type: intentTypeForInteraction[interaction.type] });
    }
    const of = (id: string) => state.equipmentInstances.find((e: any) => e.id === id);
    out.push(`${node.id}: ${note}`);
    out.push(`      flask ${describe(of("volumetric-flask-1")?.contents)} | boat ${describe(of("weigh-boat-1")?.contents)} | funnel ${of("funnel-1")?.contents.wetState} | wash ${of("wash-bottle-1")?.contents.volumeMl}`);
    if (note.includes("REFUSED") || note.includes("ERROR")) break;
  }
  out.push("attachments " + JSON.stringify(state.attachments.map((a: any) => [a.childInstanceId, a.parentInstanceId, a.zoneId])));
  out.push("measurements " + JSON.stringify(state.measurements.map((m: any) => [m.id, m.value, m.unit])));
  out.push("notebook tags " + JSON.stringify(state.notebook.map((n: any) => n.tags)));
  out.push("complete " + state.completedNodes.length + "/" + def.process.nodes.length);
  return out;
};
for (const mode of ["good", "overshoot", "swirl-out-of-sequence"] as const) {
  console.log("=====", mode);
  for (const line of run(mode)) console.log("  ", line);
}
