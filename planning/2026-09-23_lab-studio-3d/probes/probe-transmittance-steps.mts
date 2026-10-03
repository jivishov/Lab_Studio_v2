// Probe: run transmittance-dilution through step 13 as the 3D Confirm path does, and report the
// photometer's attachments after each step. Not a test run.
import { readFile } from "node:fs/promises";
const root = "file:///C:/Users/EmilJivishov/Projects/Lab_studio/tmp/lab-studio-3d/";
const { applyTechniqueConfiguration } = await import(root + "src/data/techniqueConfiguration.ts");
const { createRuntimeState, performRuntimeAction } = await import(root + "src/runtime/index.ts");
const { resolveInteractionIntent } = await import(root + "src/runtime/interactionIntents.ts");
const { resolveActionInteraction } = await import(root + "src/domain/interactions.ts");
const { intentTypeForInteraction } = await import(root + "src/studio3d/adapters/sceneToIntent.ts");
const { actionInputField, resolveActionInput } = await import(root + "src/runtime/actionInputs.ts");
const { mergeActionInput } = await import(root + "src/studio3d/adapters/sceneToIntent.ts");

const raw = JSON.parse(await readFile(new URL(root + "public/techniques/transmittance-dilution.json"), "utf8"));
const values = { stockConcentrationM: "0.2", wavelengthNm: "630", stockAliquotVolumeMl: "5", waterVolumeMl: "10", finalVolumeMl: "15", samplePercentTransmittance: "42.5" };
const def = applyTechniqueConfiguration(raw, values);
if (process.argv[3] === "patch") for (const a of def.actions) if (a.atomId === "atom.place.insert-cuvette") { a.interaction.snapZoneId = "spectrophotometer-cuvette-slot"; a.parameters.snapZoneId = "spectrophotometer-cuvette-slot"; }
if (process.argv[3] === "patch") for (const a of def.actions) if (a.atomId === "atom.place.remove-cuvette") { a.interaction.sourceDefinitionId = "cuvette"; Object.assign(a.parameters, { equipmentDefinitionId: "cuvette", location: "workbench" }); }
let state = createRuntimeState(def);
const upTo = Number(process.argv[2] ?? 14);
for (const [i, node] of def.process.nodes.slice(0, upTo).entries()) {
  const action = def.actions.find((a: any) => a.id === node.actionId);
  const interaction = resolveActionInteraction(action);
  const field = actionInputField(action);
  const typed = !field ? "" : field.mode === "choice" ? field.options?.[0] : field.mode === "numeric" ? (/ransmittance/.test(field.label) ? "42.5" : "630") : "Held by the frosted faces; clear faces in the light path.";
  const intent: any = mergeActionInput({ type: intentTypeForInteraction[interaction.type], origin: "keyboard" }, resolveActionInput(action, typed), action);
  if (field && i >= 10) console.log("   field", JSON.stringify(field).slice(0, 200));
  const result = resolveInteractionIntent(def, state, intent);
  if (!result.ok) { console.log(i + 1, node.id, "REFUSED", result.feedback.message); break; }
  const before = state.feedbackQueue.length;
  state = performRuntimeAction(def, state, result.request);
  const errs = state.feedbackQueue.slice(before).filter((f: any) => f.severity === "error").map((f: any) => f.message);
  const att = state.attachments.filter((a: any) => a.parentInstanceId === "spectrophotometer-1" || a.childInstanceId?.includes("cuvette") || a.childInstanceId === "funnel-1").map((a: any) => a.childInstanceId + ">" + a.parentInstanceId);
  const vol = (id: string) => state.equipmentInstances.find((e: any) => e.id === id)?.contents.volumeMl ?? 0;
  const v = `cyl ${vol("graduated-cylinder-1")} tube ${vol("prepared-receiver-1")} beaker ${vol("blank-beaker-1")} bp ${vol("blank-pipette-1")} sp ${vol("sample-pipette-1")} bc ${vol("blank-cuvette-1")} sc ${vol("sample-cuvette-1")}`;
  const cuv = state.equipmentInstances.filter((e: any) => e.definitionId === "cuvette").map((e: any) => `${e.id}@${e.location}`);
  console.log(i + 1, node.id, errs.length ? "ERROR " + errs.join(" | ") : "ok", "", "| att", att.join(","), "|", v);
}
