// Probe: the atomized Dilute a Stock Solution through the runtime (Confirm path, drops and inversions),
// plus validation, the composition contract, the evidence audit and the catalogue policy. Not a test run.
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
const { auditStandaloneEvidence } = await import(root + "src/data/standaloneEvidenceAudit.ts");
const { assessBundledTechniqueCatalogPolicy } = await import(root + "src/data/bundledCatalogPolicyBoundary.ts");

const raw = JSON.parse(await readFile(new URL(root + "public/techniques/dilution.json"), "utf8"));
const v = validateTechniqueDefinition(raw);
console.log("published validates:", v.ok, (v.errors ?? []).slice(0, 6).join(" | "));
const cc = validateTechniqueCompositionContract(raw);
console.log("composition contract:", cc.ok, (cc.errors ?? []).slice(0, 6).join(" | "));
try { await assessBundledTechniqueCatalogPolicy("bundled", "public/techniques/dilution.json", raw); console.log("policy: accepted"); }
catch (e) { console.log("policy: REFUSED", e instanceof Error ? e.message.slice(0, 900) : e); }
for (const bad of [{ aliquotVolumeMl: "12", stockConcentrationM: "0.2" }, { aliquotVolumeMl: "5", stockConcentrationM: "0" }]) {
  try { applyTechniqueConfiguration(raw, bad); console.log("setup accepted", JSON.stringify(bad), "(should refuse)"); }
  catch (e) { console.log("setup refuses", JSON.stringify(bad), "->", e instanceof Error ? e.message.slice(0, 160) : e); }
}
const def = applyTechniqueConfiguration(raw, { aliquotVolumeMl: "5", stockConcentrationM: "0.2" });
const cv = validateTechniqueDefinition(def);
console.log("configured validates:", cv.ok, (cv.errors ?? []).slice(0, 6).join(" | "));
console.log("audit:", JSON.stringify(auditStandaloneEvidence(def)));

const run = (mode: "good" | "overshoot" | "early" | "nostopper") => {
  let state = createRuntimeState(def);
  const out: string[] = [];
  const send = (action: any, intent: any) => {
    const interaction = resolveActionInteraction(action);
    const merged = mergeActionInput({ origin: "keyboard", ...intent }, resolveActionInput(action, ""), action);
    const result = resolveInteractionIntent(def, state, merged);
    if (!result.ok) return "REFUSED " + result.feedback.message;
    const before = state.feedbackQueue.length;
    state = performRuntimeAction(def, state, result.request);
    const added = state.feedbackQueue.slice(before);
    const err = added.find((f: any) => f.severity === "error");
    return err ? "ERROR " + err.message : (added.at(-1)?.message ?? "ok(no feedback)");
  };
  for (const node of def.process.nodes) {
    if (state.currentNodeId !== node.id) { out.push(`stuck before ${node.id} (current ${state.currentNodeId})`); break; }
    const action = def.actions.find((a: any) => a.id === node.actionId);
    const interaction = resolveActionInteraction(action);
    let note = "";
    if (interaction.type === "dispenseDrops") {
      const goalDrops = action.parameters.markDispense === "source" ? Math.round(Number(action.parameters.deliverMl) / 0.05) : 20;
      const target = mode === "overshoot" && action.id === "bring-to-mark-dropwise" ? goalDrops + 3 : mode === "early" && action.id === "deliver-aliquot-to-line" ? goalDrops - 5 : goalDrops;
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
    } else if (mode === "nostopper" && action.id === "stopper-flask") {
      note = "(skipped) then invert -> " + send(def.actions.find((a: any) => a.id === "invert-to-mix"), { type: "notebookRecordIntent" });
      out.push(`${node.id}: ${note}`); break;
    } else {
      note = send(action, { type: intentTypeForInteraction[interaction.type] });
    }
    const vol = (id: string) => state.equipmentInstances.find((e: any) => e.id === id)?.contents.volumeMl ?? 0;
    out.push(`${node.id}: ${note} | flask ${vol("volumetric-flask-1")} pipette ${vol("graduated-pipette-1")} stockBeaker ${vol("stock-beaker-1")} water ${vol("water-pipette-1")}`);
    if (note.includes("REFUSED") || note.includes("ERROR")) break;
  }
  out.push("measurements " + JSON.stringify(state.measurements.map((m: any) => [m.id, m.value, m.unit])));
  out.push("calculations " + JSON.stringify(state.calculations.map((c: any) => [c.id, c.value, c.unit])));
  out.push("complete " + state.completedNodes.length + "/" + def.process.nodes.length);
  const flask = state.equipmentInstances.find((e: any) => e.id === "volumetric-flask-1")?.contents;
  out.push("flask contents " + JSON.stringify({ kind: flask?.kind, label: flask?.label, volumeMl: flask?.volumeMl, solutes: flask?.solutes?.map((s: any) => s.label) }));
  return out;
};
for (const mode of ["good", "overshoot", "early", "nostopper"] as const) {
  console.log("=====", mode);
  for (const line of run(mode)) console.log("  ", line);
}
