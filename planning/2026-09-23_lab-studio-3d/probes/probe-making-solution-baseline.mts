// Probe: run making-solution and dilution step by step (Confirm path) and print contents. Not a test run.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { applyTechniqueConfiguration } = await import(root + "src/data/techniqueConfiguration.ts");
const { createRuntimeState, performRuntimeAction } = await import(root + "src/runtime/index.ts");
const { resolveInteractionIntent } = await import(root + "src/runtime/interactionIntents.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { intentTypeForInteraction, mergeActionInput } = await import(root + "src/studio3d/adapters/sceneToIntent.ts");
const { actionInputField, resolveActionInput } = await import(root + "src/runtime/actionInputs.ts");

const runs: Record<string, Record<string, string>> = {
  "making-solution": { initialSolventVolumeMl: "50", soluteMassG: "1.25", finalVolumeMl: "100", solutionObservation: "Clear, colourless solution" },
  dilution: { aliquotVolumeMl: "10", finalVolumeMl: "100", dilutionFactor: "10" },
};
for (const [id, values] of Object.entries(runs)) {
  const raw = JSON.parse(await readFile(new URL(root + `public/techniques/${id}.json`), "utf8"));
  const def = applyTechniqueConfiguration(raw, values);
  let state = createRuntimeState(def);
  console.log("=====", id);
  for (const node of def.process.nodes) {
    const action = def.actions.find((a: any) => a.id === node.actionId);
    const interaction = resolveActionInteraction(action);
    const field = actionInputField(action);
    const typed = field ? (field.mode === "numeric" ? "1" : "Clear, colourless solution") : "";
    const intent: any = mergeActionInput({ type: intentTypeForInteraction[interaction.type], origin: "keyboard" }, resolveActionInput(action, typed), action);
    const result = resolveInteractionIntent(def, state, intent);
    if (!result.ok) { console.log("  ", node.title, "REFUSED", result.feedback.message); break; }
    const before = state.feedbackQueue.length;
    state = performRuntimeAction(def, state, result.request);
    const errs = state.feedbackQueue.slice(before).filter((f: any) => f.severity === "error").map((f: any) => f.message);
    console.log("  ", node.title, "| ia", interaction.type, interaction.sourceDefinitionId, "->", interaction.targetDefinitionId ?? interaction.stationId, "| field", field?.label ?? "-", "|", errs.length ? "ERROR " + errs.join(" / ") : "ok");
    for (const e of state.equipmentInstances) {
      const c = e.contents;
      if (c.kind !== "empty") console.log("        ", e.id, "@", e.location, c.kind, c.label, "vol", c.volumeMl, "final", c.finalVolumeMl, "mass", c.massG, "solutes", JSON.stringify(c.solutes?.map((s: any) => [s.label, s.amount, s.unit])));
    }
  }
}
