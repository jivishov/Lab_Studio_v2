import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileBundledLabCompositionWithPolicy } from "../../data/bundledCatalogPolicyBoundary";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { resolveActionInteraction } from "../../domain/interactions";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState, performRuntimeAction, type RuntimeDefinition } from "../../runtime";
import { resolveActionInput } from "../../runtime/actionInputs";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { intentTypeForInteraction, mergeActionInput } from "../adapters/sceneToIntent";
import { applyLab3DSetup, type Lab3DSummary } from "../labs3dSetup";
import { describeTechnique } from "../studio/techniqueCatalog";
import { shelfLaidOut } from "./shelfLayout";

/**
 * Tray-to-shelf build, phase 4: every 3D technique and lab starts with its items on the shelf or at the side station,
 * and plays as before. The practice versions and the labs play to completion in pack2Practice, pack3Practice and
 * lab3d, which check the shelf at every step; the 2D techniques that open in 3D play here.
 */

const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const practice = read("public/techniques-3d/index.json") as Array<{ id: string; file: string }>;
const twins = read("public/techniques-3d/twins.json") as Array<{ id: string; file: string }>;
const labs = read("public/labs-3d/index.json") as Array<Lab3DSummary & { file: string }>;
const catalogue = (read("public/techniques/index.json") as Array<{ id: string }>)
  .map(({ id }) => read(`public/techniques/${id}.json`) as TechniqueDefinition);
/** The 2D catalogue's techniques that open in 3D: every model drawn, and no host lab needed (the 3D home's rule). */
const opensIn3D = catalogue.filter((technique) => ["ready", "setup"].includes(describeTechnique(technique).status ?? ""));

const compileLab = (entry: (typeof labs)[number]): Promise<RuntimeDefinition> => {
  const source = read(`public/labs-3d/${entry.file}`);
  const values = Object.fromEntries(entry.setup.map((field) => [field.id, String(field.defaultValue)]));
  return compileBundledLabCompositionWithPolicy({
    authority: "public-bundle", artifact: `public/labs-3d/${entry.file}`, catalogSource: source,
    compilationSource: applyLab3DSetup(source, entry, values),
    resolveTechnique: async (id: string) => { const twin = twins.find((t) => t.id === id); return read(twin ? `public/techniques-3d/${twin.file}` : `public/techniques/${id}.json`); },
  } as Parameters<typeof compileBundledLabCompositionWithPolicy>[0]) as unknown as Promise<RuntimeDefinition>;
};

/** Each 2D technique's classroom values and the student's entries, by action id. */
const PLAYS: Record<string, { config: Record<string, string>; inputs?: Record<string, string> }> = {
  weighing: { config: { solidMassG: "2.037", supportEmptyMassG: "31.4" }, inputs: { "weigh-solid": "2.037" } },
  "making-solution": { config: { soluteMassG: "2.5", solutionObservation: "The solid dissolved completely." } },
  dilution: { config: { aliquotVolumeMl: "5", stockConcentrationM: "0.2" } },
  "transmittance-dilution": {
    config: { stockConcentrationM: "0.1", wavelengthNm: "635", stockAliquotVolumeMl: "2", waterVolumeMl: "8", finalVolumeMl: "10", samplePercentTransmittance: "45" },
    inputs: {
      "transmittance-dilution-wipe-blank-cuvette": "Held by the frosted faces; the clear faces wiped and kept in the light path.",
      "transmittance-dilution-wipe-orient-sample-cuvette": "Held by the frosted faces; the clear faces wiped and kept in the light path.",
      "transmittance-dilution-read-percent-transmittance": "45",
    },
  },
};

/** Plays a technique through the process control, as the step card's Confirm does, checking the shelf at every step. */
const play = (technique: TechniqueDefinition, inputs: Record<string, string>): RuntimeState => {
  let state = createRuntimeState(technique);
  const start = shelfLaidOut(state, technique, `${technique.id} start`);
  const send = (nodeId: string, intent: RuntimeInteractionIntent) => {
    const resolved = resolveInteractionIntent(technique, state, intent);
    if (!resolved.ok) throw new Error(`${nodeId}: ${resolved.feedback.message}`);
    const before = state.feedbackQueue.length;
    state = performRuntimeAction(technique, state, resolved.request);
    const error = state.feedbackQueue.slice(before).find((entry) => entry.severity === "error");
    if (error) throw new Error(`${nodeId}: ${error.message}`);
  };
  for (const node of technique.process.nodes) {
    const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
    const interaction = resolveActionInteraction(action)!;
    // A drop-to-the-line step: the drops that bring the target to its mark, or that deliver the aliquot from a
    // pipette's line, 40 at most at a time, then "at the line" (as lab3d's playLab and markDispense.test).
    if (interaction.type === "dispenseDrops") {
      const p = action.parameters, level = state.equipmentInstances.find((item) => item.id === String(p.targetInstanceId))?.contents.volumeMl ?? 0;
      const dropCount = Math.round((p.markDispense === "source" ? Number(p.deliverMl) : Number(p.markVolumeMl) - level) / Number(p.dropVolumeMl));
      for (let sent = 0; sent < dropCount; sent += 40) {
        send(node.id, { origin: "keyboard", type: "dispenseDropIntent", runtimeParameters: { dropCount: Math.min(40, dropCount - sent) } } as RuntimeInteractionIntent);
      }
      send(node.id, { origin: "keyboard", type: "dispenseCompleteIntent" } as RuntimeInteractionIntent);
    }
    for (let i = 0; i < 40 && !state.completedNodes.includes(node.id); i += 1) {
      send(node.id, mergeActionInput({ origin: "keyboard", type: intentTypeForInteraction[interaction.type] } as RuntimeInteractionIntent,
        resolveActionInput(action, inputs[action.id] ?? ""), action));
    }
    expect(state.completedNodes, node.id).toContain(node.id);
    shelfLaidOut(state, technique, `${technique.id} ${node.id}`, start);
  }
  return state;
};

describe("every 3D technique and lab, with the shelf in place of the tray", () => {
  it("covers the seven practice versions, the four 2D techniques that open in 3D, and the three labs", () => {
    expect(practice).toHaveLength(7);
    // A technique that comes to open in 3D needs its play here.
    expect(opensIn3D.map((technique) => technique.id)).toEqual(Object.keys(PLAYS));
    expect(labs.map((entry) => entry.id)).toEqual(["intro-filtration-demo", "hard-water-demo", "paper-chromatography"]);
  });

  it.each(practice.map((entry) => entry.id))("%s starts with its items on the shelf or at the side station, each on its own spot", (id) => {
    const definition = read(`public/techniques-3d/${practice.find((entry) => entry.id === id)!.file}`) as RuntimeDefinition;
    shelfLaidOut(createRuntimeState(definition), definition, id);
  });

  it.each(Object.keys(PLAYS))("%s starts with its items on the shelf or at the side station, and plays to completion", (id) => {
    const technique = applyTechniqueConfiguration(opensIn3D.find((t) => t.id === id)!, PLAYS[id].config);
    const state = play(technique, PLAYS[id].inputs ?? {});
    expect(state.completedNodes).toHaveLength(technique.process.nodes.length);
  });

  it.each(labs.map((entry) => entry.id))("the %s lab starts with its items on the shelf or at the side station, each on its own spot", async (id) => {
    const lab = await compileLab(labs.find((entry) => entry.id === id)!);
    shelfLaidOut(createRuntimeState(lab), lab as never, id);
  });
});
