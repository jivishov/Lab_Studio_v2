import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { deriveActionEffectContract } from "../../domain/atomRegistry";
import { solutionTechnique } from "../../domain/fixtures";
import { resolveActionInteraction } from "../../domain/interactions";
import type { ContentState, RuntimeState, TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { createRuntimeState, performRuntimeAction } from "../index";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../interactionIntents";

/**
 * Make a Solution, atomized (decided 2026-10-04, D4 exception 9): the pre-weighed sodium carbonate is
 * tipped through a funnel seated in the flask, the boat and then the funnel are rinsed in, the flask is
 * half filled and swirled until the solid dissolves (the solid already in the flask, not a new one),
 * then filled to the mark drop by drop, stoppered and inverted. Written, not run.
 */
const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", "making-solution.json"), "utf8")) as TechniqueDefinition;
const technique = applyTechniqueConfiguration(raw, { soluteMassG: "2.5", solutionObservation: "Clear and colourless; no solid left" });

const send = (state: RuntimeState, intent: Record<string, unknown>): RuntimeState => {
  const result = resolveInteractionIntent(technique, state, { origin: "keyboard", ...intent } as RuntimeInteractionIntent);
  if (!result.ok) throw new Error(result.feedback.message);
  return performRuntimeAction(technique, state, result.request);
};
const lastError = (before: RuntimeState, after: RuntimeState) =>
  after.feedbackQueue.slice(before.feedbackQueue.length).find((item) => item.severity === "error")?.message;
const contents = (state: RuntimeState, id: string): ContentState => state.equipmentInstances.find((item) => item.id === id)!.contents;
const withFlask = (state: RuntimeState, change: (contents: ContentState) => ContentState): RuntimeState => ({
  ...state,
  equipmentInstances: state.equipmentInstances.map((item) => (item.id === "volumetric-flask-1" ? { ...item, contents: change(item.contents) } : item)),
});

/** Plays each step through the Confirm path until `stopBefore`. */
const playTo = (stopBefore?: string): RuntimeState => {
  let state = createRuntimeState(technique);
  const types: Record<string, string> = {
    dragToZone: "placeIntent", snapIntoTarget: "snapIntent", pourInto: "pourIntent", rinseTarget: "rinseIntent", recordNotebook: "notebookRecordIntent",
  };
  for (const node of technique.process.nodes) {
    if (node.actionId === stopBefore) return state;
    const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
    const interaction = resolveActionInteraction(action)!;
    if (interaction.type === "dispenseDrops") {
      state = send(state, { type: "dispenseDropIntent", runtimeParameters: { dropCount: 20 } });
      state = send(state, { type: "dispenseCompleteIntent" });
    } else if (action.id === "invert-to-mix") {
      for (let i = 0; i < 10; i += 1) state = send(state, { type: "notebookRecordIntent" });
    } else {
      state = send(state, { type: types[interaction.type] });
    }
  }
  return state;
};

describe("Make a Solution through the runtime", () => {
  it("tips all of the weighed solid through the seated funnel into the dry flask", () => {
    const state = playTo("rinse-boat-into-funnel");
    expect(state.attachments).toEqual(expect.arrayContaining([
      expect.objectContaining({ childInstanceId: "funnel-1", parentInstanceId: "volumetric-flask-1", zoneId: "volumetric-flask-funnel-seat" }),
    ]));
    expect(contents(state, "volumetric-flask-1")).toMatchObject({ kind: "solid", label: "Sodium carbonate", massG: 2.5 });
    expect(contents(state, "volumetric-flask-1").solutes).toEqual([{ id: "sodium-carbonate", label: "Sodium carbonate", amount: 2.5, unit: "g" }]);
    expect(contents(state, "weigh-boat-1").kind).toBe("empty");
  });

  it("refuses to tip the solid while no funnel is seated in the neck", () => {
    const state = { ...playTo("tip-solid-into-funnel"), attachments: [] };
    const result = resolveInteractionIntent(technique, state, { type: "pourIntent", origin: "keyboard" } as RuntimeInteractionIntent);
    const after = result.ok ? performRuntimeAction(technique, state, result.request) : state;
    expect(result.ok ? lastError(state, after) : result.feedback.message).toBeTruthy();
    expect(contents(after, "volumetric-flask-1").kind).toBe("empty");
  });

  it("rinses the boat, then the funnel, into the flask: 5 mL each from the wash bottle", () => {
    const state = playTo("remove-funnel");
    expect(contents(state, "volumetric-flask-1")).toMatchObject({
      kind: "mixture", label: "Sodium carbonate + Deionized water", volumeMl: 10, massG: 2.5, visualState: "dissolving-solid",
    });
    expect(contents(state, "wash-bottle-1").volumeMl).toBe(490);
    expect(contents(state, "weigh-boat-1").wetState).toBe("rinsed");
    expect(contents(state, "funnel-1").wetState).toBe("rinsed");
    expect(state.notebook.filter((entry) => entry.tags.includes("rinse")).map((entry) => entry.value))
      .toEqual(Array(2).fill("Rinse completed; the washings ran into the 100 mL volumetric flask."));
  });

  it("adds the half-fill water as solvent, without naming the water twice", () => {
    const state = playTo("swirl-to-dissolve");
    expect(contents(state, "volumetric-flask-1")).toMatchObject({ kind: "mixture", label: "Sodium carbonate + Deionized water", volumeMl: 50 });
  });

  it("dissolves the solid already in the flask, keeping its identity and mass", () => {
    const state = playTo("fill-water-below-mark");
    const flask = contents(state, "volumetric-flask-1");
    expect(flask).toMatchObject({ kind: "solution", label: "Sodium carbonate solution", volumeMl: 50, visualState: "clear-solution" });
    expect(flask.massG).toBeUndefined();
    expect(flask.solutes).toEqual([{ id: "sodium-carbonate", label: "Sodium carbonate", amount: 2.5, unit: "g" }]);
    expect(flask.concentration).toEqual({ value: 50, unit: "g/L" });
    expect(state.notebook.at(-1)).toMatchObject({ tags: ["dissolved-by-swirling"], value: "Swirled the 100 mL volumetric flask until the sodium carbonate dissolved." });
  });

  it("refuses to swirl when there is no water, or no solid, in the flask", () => {
    const atSwirl = playTo("swirl-to-dissolve");
    const dry = withFlask(atSwirl, (flask) => ({ ...flask, volumeMl: 0 }));
    expect(lastError(dry, send(dry, { type: "notebookRecordIntent" }))).toBe("There is no water in the 100 mL volumetric flask to dissolve the sodium carbonate in.");
    const noSolid = withFlask(atSwirl, (flask) => ({ ...flask, solutes: [], massG: undefined }));
    expect(lastError(noSolid, send(noSolid, { type: "notebookRecordIntent" }))).toBe("There is no solid in the 100 mL volumetric flask to dissolve.");
  });

  it("keeps the solution named, and its concentration true, as it is filled to the mark", () => {
    const state = playTo();
    const flask = contents(state, "volumetric-flask-1");
    expect(flask).toMatchObject({ kind: "solution", label: "Sodium carbonate solution", volumeMl: 100 });
    expect(flask.concentration?.value).toBeCloseTo(25, 9);
    expect(state.measurements.find((entry) => entry.id === "final-volume")?.value).toBe(100);
    expect(state.completedNodes).toHaveLength(technique.process.nodes.length);
  });
});

describe("content that names no solid keeps the original dissolve", () => {
  it("still creates the prepared solute from the step's settings", () => {
    let state = createRuntimeState(solutionTechnique);
    for (const node of solutionTechnique.process.nodes.slice(0, 3)) {
      const result = resolveInteractionIntent(solutionTechnique, state, { type: "pourIntent", origin: "keyboard" } as RuntimeInteractionIntent);
      expect(result.ok, `${node.id}: ${result.ok ? "" : result.feedback.message}`).toBe(true);
      if (result.ok) state = performRuntimeAction(solutionTechnique, state, result.request);
    }
    const flask = state.equipmentInstances.find((item) => item.definitionId === "volumetric-flask")!.contents;
    expect(flask).toMatchObject({ kind: "solution", label: "Prepared solution" });
    expect(flask.solutes).toEqual([{ id: "prepared-solute", label: "Prepared solute", amount: 2.5, unit: "g" }]);
  });
});

describe("the swirl and the rinse receiver are typed contracts", () => {
  const swirl = raw.actions.find((action) => action.id === "swirl-to-dissolve")!;
  const rinse = raw.actions.find((action) => action.id === "rinse-boat-into-funnel")!;
  const withAction = (replacement: typeof swirl): TechniqueDefinition =>
    ({ ...raw, actions: raw.actions.map((action) => (action.id === replacement.id ? replacement : action)) });

  it("derives a physical, recorded effect for the swirl", () => {
    const effect = deriveActionEffectContract(swirl);
    expect(effect.errors).toEqual([]);
    expect(effect.contract?.classes).toEqual(expect.arrayContaining(["apparatus-material-instrument-state", "evidence-recording"]));
  });

  it("requires a dissolve through the process control to be a swirl that names its solid", () => {
    const { mixOperation: _mix, ...noSwirl } = swirl.parameters;
    expect(validateTechniqueDefinition(withAction({ ...swirl, parameters: noSwirl })).errors?.join(" ")).toContain('mixOperation "swirl"');
    const { dissolveSoluteId: _solute, ...noSolute } = swirl.parameters;
    expect(validateTechniqueDefinition(withAction({ ...swirl, parameters: noSolute })).errors?.join(" ")).toContain("dissolveSoluteId");
  });

  it("refuses a rinse that both keeps its washings and sends them to a receiver", () => {
    const both = { ...rinse, parameters: { ...rinse.parameters, collectRinseVolume: true } };
    expect(validateTechniqueDefinition(withAction(both)).errors?.join(" ")).toContain("cannot both keep its washings and send them to a receiver");
  });
});
