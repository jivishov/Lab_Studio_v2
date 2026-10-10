import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { resolveActionInteraction } from "../../domain/interactions";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { createRuntimeState, performRuntimeAction } from "../index";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../interactionIntents";

/**
 * Dilute a Stock Solution, atomized (decided 2026-10-02): a graduated pipette delivers down to a
 * line and a dropping pipette brings the flask to its mark, both a drop at a time and judged within
 * one drop; a stoppered flask is inverted ten times. Overshooting the line cannot be undone.
 */
const technique = applyTechniqueConfiguration(
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", "dilution.json"), "utf8")) as TechniqueDefinition,
  { aliquotVolumeMl: "5", stockConcentrationM: "0.2" },
);

const send = (state: RuntimeState, intent: Record<string, unknown>): RuntimeState => {
  const result = resolveInteractionIntent(technique, state, { origin: "keyboard", ...intent } as RuntimeInteractionIntent);
  if (!result.ok) throw new Error(result.feedback.message);
  return performRuntimeAction(technique, state, result.request);
};
const lastError = (before: RuntimeState, after: RuntimeState) =>
  after.feedbackQueue.slice(before.feedbackQueue.length).find((item) => item.severity === "error")?.message;
const volume = (state: RuntimeState, id: string) => state.equipmentInstances.find((item) => item.id === id)?.contents.volumeMl ?? 0;
const drops = (state: RuntimeState, count: number) => {
  let next = state;
  for (let sent = 0; sent < count; sent += 40) next = send(next, { type: "dispenseDropIntent", runtimeParameters: { dropCount: Math.min(40, count - sent) } });
  return next;
};

/** Plays each step through the Confirm path until `stopBefore`. */
const playTo = (stopBefore: string): RuntimeState => {
  let state = createRuntimeState(technique);
  for (const node of technique.process.nodes) {
    if (node.actionId === stopBefore) return state;
    const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
    const interaction = resolveActionInteraction(action)!;
    if (interaction.type === "dispenseDrops") {
      state = drops(state, action.parameters.markDispense === "source" ? 100 : 20);
      state = send(state, { type: "dispenseCompleteIntent" });
    } else if (action.id === "invert-to-mix") {
      for (let i = 0; i < 10; i += 1) state = send(state, { type: "notebookRecordIntent" });
    } else {
      const types: Record<string, string> = { dragToZone: "placeIntent", snapIntoTarget: "snapIntent", pourInto: "pourIntent", submitCalculation: "calculationSubmitIntent" };
      state = send(state, { type: types[interaction.type] });
    }
  }
  return state;
};

describe("drop to the line", () => {
  it("delivers a graduated pipette's aliquot down to its line and records the line's value", () => {
    let state = playTo("deliver-aliquot-to-line");
    expect(volume(state, "graduated-pipette-1")).toBe(10);
    state = drops(state, 100);
    expect(volume(state, "volumetric-flask-1")).toBeCloseTo(5, 6);
    expect(state.currentNodeId).toBe("deliver-aliquot-to-line-node");
    state = send(state, { type: "dispenseCompleteIntent" });
    expect(state.measurements.find((m) => m.id === "aliquot-volume")).toMatchObject({ value: 5, unit: "mL" });
    expect(state.currentNodeId).toBe("fill-water-below-mark-node");
  });

  it("refuses an early 'at the line' and keeps the step open", () => {
    const before = drops(playTo("deliver-aliquot-to-line"), 95);
    const after = send(before, { type: "dispenseCompleteIntent" });
    expect(lastError(before, after)).toBe("The meniscus has not reached the line yet.");
    expect(after.currentNodeId).toBe("deliver-aliquot-to-line-node");
  });

  it("refuses the mark after an overshoot, and more drops cannot undo it", () => {
    const at = playTo("bring-to-mark-dropwise");
    expect(volume(at, "volumetric-flask-1")).toBe(99);
    const over = drops(at, 23);
    const refused = send(over, { type: "dispenseCompleteIntent" });
    expect(lastError(over, refused)).toBe("The meniscus is past the line.");
    expect(refused.markDispenses?.["bring-to-mark-dropwise"]?.overshot).toBe(true);
  });

  it("accepts within one drop of the mark", () => {
    const state = send(drops(playTo("bring-to-mark-dropwise"), 21), { type: "dispenseCompleteIntent" });
    expect(state.measurements.find((m) => m.id === "final-volume")).toMatchObject({ value: 100 });
  });

  it("never draws back at a flask's mark: the solution would be remade", () => {
    const over = drops(playTo("bring-to-mark-dropwise"), 23);
    expect(() => send(over, { type: "dispenseDrawBackIntent" })).toThrow("Nothing is drawn back at this step.");
    const refused = send(over, { type: "dispenseCompleteIntent" });
    expect(refused.feedbackQueue.at(-1)?.recovery).toMatch(/^In the lab this solution would be remade\./);
  });
});

/**
 * At a graduation (decided 2026-10-10): the 3D Measure Liquid Volume's cylinder, where a level past the line is drawn
 * back up into the dropping pipette (`markDrawBack`) and judged as it stands when it is accepted.
 */
describe("drawing a level back at a graduation", () => {
  const twin = applyTechniqueConfiguration(
    JSON.parse(readFileSync(join(process.cwd(), "public", "techniques-3d", "measuring-volume-3d.json"), "utf8")) as TechniqueDefinition,
    { targetVolumeMl: "20", pourVolumeMl: "19" },
  );
  const sendTwin = (state: RuntimeState, intent: Record<string, unknown>): RuntimeState => {
    const result = resolveInteractionIntent(twin, state, { origin: "keyboard", ...intent } as RuntimeInteractionIntent);
    if (!result.ok) throw new Error(result.feedback.message);
    return performRuntimeAction(twin, state, result.request);
  };
  /** The cylinder poured to 19 mL and the pipette filled, at the drops step. */
  const atDrops = (): RuntimeState => {
    let state = createRuntimeState(twin);
    for (const node of twin.process.nodes.slice(0, 3)) {
      const action = twin.actions.find((candidate) => candidate.id === node.actionId)!;
      const type = resolveActionInteraction(action)!.type === "pourInto" ? "pourIntent" : "placeIntent";
      for (let i = 0; i < 10 && !state.completedNodes.includes(node.id); i += 1) state = sendTwin(state, { type });
    }
    expect(state.currentNodeId).toBe("drops-to-line-node");
    return state;
  };
  const dropsTwin = (state: RuntimeState, type: string, dropCount: number) => sendTwin(state, { type, runtimeParameters: { dropCount } });

  it("draws an overshoot back into the pipette, and judges the level as it stands", () => {
    const start = atDrops();
    const pipette = volume(start, "beral-pipette-1");
    const over = dropsTwin(start, "dispenseDropIntent", 30);
    const refused = sendTwin(over, { type: "dispenseCompleteIntent" });
    expect(lastError(over, refused)).toBe("The meniscus is past the line.");
    expect(refused.feedbackQueue.at(-1)?.recovery).toMatch(/^Draw the excess back up into the pipette/);
    const back = dropsTwin(refused, "dispenseDrawBackIntent", 10);
    // Progress within the step, as a drop is: no "try again".
    expect(back.feedbackQueue).toHaveLength(refused.feedbackQueue.length);
    expect(volume(back, "graduated-cylinder-1")).toBeCloseTo(20, 6);
    expect(volume(back, "beral-pipette-1")).toBeCloseTo(pipette - 1, 6);
    expect(back.markDispenses?.["drops-to-line"]).toMatchObject({ deliveredMl: 1, overshot: false });
    const done = sendTwin(back, { type: "dispenseCompleteIntent" });
    expect(done.measurements.find((m) => m.id === "sample-volume")).toMatchObject({ value: 20, unit: "mL" });
  });

  it("draws back only as much as the pipette has room for", () => {
    const over = dropsTwin(atDrops(), "dispenseDropIntent", 30);
    const full = dropsTwin(over, "dispenseDrawBackIntent", 40);
    expect(volume(full, "beral-pipette-1")).toBeCloseTo(3, 6);
    expect(volume(full, "graduated-cylinder-1")).toBeCloseTo(19 + 1.5 - (3 - volume(over, "beral-pipette-1")), 6);
    expect(full.attemptHistory.at(-1)?.message).toMatch(/^Drawn back until the .* is full\.$/);
    const again = dropsTwin(full, "dispenseDrawBackIntent", 1);
    expect(lastError(full, again)).toMatch(/is full\.$/);
  });
});

describe("invert to mix", () => {
  it("counts inversions and completes the step at ten", () => {
    let state = playTo("invert-to-mix");
    for (let i = 0; i < 9; i += 1) state = send(state, { type: "notebookRecordIntent" });
    expect(state.mixInversions?.["invert-to-mix"]).toBe(9);
    expect(state.currentNodeId).toBe("invert-to-mix-node");
    state = send(state, { type: "notebookRecordIntent" });
    expect(state.currentNodeId).toBe("calculate-dilution-factor-node");
    expect(state.notebook.some((entry) => entry.tags.includes("mixed-by-inversion"))).toBe(true);
  });
});

describe("the whole dilution", () => {
  it("ends with a dilution factor of 20 and 0.01 M", () => {
    const state = playTo("none");
    expect(state.completedNodes).toHaveLength(technique.process.nodes.length);
    expect(state.calculations.find((c) => c.id === "dilution-factor")).toMatchObject({ value: 20, unit: "x" });
    expect(state.calculations.find((c) => c.id === "diluted-concentration")?.value).toBeCloseTo(0.01, 9);
  });
});
