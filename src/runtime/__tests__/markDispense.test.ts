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
