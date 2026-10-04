import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { resolveActionInteraction } from "../../domain/interactions";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { resolveSolidStyle } from "../../equipment/solidRendering";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { runtimeToScene } from "../adapters/runtimeToScene";
import { intentTypeForInteraction } from "../adapters/sceneToIntent";
import { equipment3dEntry } from "../equipment3d/readiness";

/**
 * Make a Solution on the 3D bench (decided 2026-10-04): the flask shows the tipped solid as a heap,
 * then the rinse and half-fill water with the undissolved solid lying under it, then a clear solution
 * once it is swirled; the funnel is seated in the flask's neck; the weighing boat has a model. Written,
 * not run.
 */
const technique = applyTechniqueConfiguration(
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", "making-solution.json"), "utf8")) as TechniqueDefinition,
  { soluteMassG: "2.5", solutionObservation: "Clear and colourless" },
);

const playTo = (stopBefore: string): RuntimeState => {
  let state = createRuntimeState(technique);
  for (const node of technique.process.nodes) {
    if (node.actionId === stopBefore) return state;
    const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
    const interaction = resolveActionInteraction(action)!;
    const result = resolveInteractionIntent(technique, state, { type: intentTypeForInteraction[interaction.type], origin: "keyboard" } as RuntimeInteractionIntent);
    if (!result.ok) throw new Error(`${node.id}: ${result.feedback.message}`);
    state = performRuntimeAction(technique, state, result.request);
  }
  return state;
};
const flaskIn = (state: RuntimeState) => runtimeToScene(state, technique).bench.find((item) => item.instanceId === "volumetric-flask-1")!;

describe("Make a Solution's flask on the bench", () => {
  it("has a model for every item, the weighing boat included", () => {
    expect(runtimeToScene(createRuntimeState(technique), technique).missingModels).toEqual([]);
    expect(equipment3dEntry("weigh-boat")?.solidRest).toBeDefined();
    expect(equipment3dEntry("weigh-boat")?.pour).toBeDefined();
  });

  it("seats the funnel at the flask's funnel seat, and draws the tipped solid as a heap at the flask's solid rest", () => {
    const state = playTo("rinse-boat-into-funnel");
    const funnel = runtimeToScene(state, technique).bench.find((item) => item.instanceId === "funnel-1")!;
    expect(funnel.placement).toMatchObject({ kind: "seated", parentInstanceId: "volumetric-flask-1", zoneId: "volumetric-flask-funnel-seat" });
    expect(flaskIn(state).contents).toMatchObject({ kind: "solid", massG: 2.5, restMm: equipment3dEntry("volumetric-flask")!.solidRest!.centreMm });
  });

  it("shows the undissolved solid lying under the water until the flask is swirled", () => {
    const beforeSwirl = flaskIn(playTo("swirl-to-dissolve")).contents;
    expect(beforeSwirl).toMatchObject({ kind: "liquid", volumeMl: 50 });
    expect(beforeSwirl.kind === "liquid" ? beforeSwirl.sediment : undefined).toMatchObject({
      style: resolveSolidStyle({ kind: "mixture", label: "", solutes: [], contamination: [], wetState: "wet", visualState: "dissolving-solid" }),
      restMm: equipment3dEntry("volumetric-flask")!.solidRest!.centreMm,
    });
    const afterSwirl = flaskIn(playTo("fill-water-below-mark")).contents;
    expect(afterSwirl).toMatchObject({ kind: "liquid", volumeMl: 50 });
    expect(afterSwirl.kind === "liquid" ? afterSwirl.sediment : "none").toBeUndefined();
  });
});
