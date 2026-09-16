import { describe, expect, it } from "vitest";
import { filtrationTechnique, measuringVolumeTechnique } from "../../domain/fixtures";
import { createRuntimeState } from "../../runtime";
import {
  goblinModeIntentForInteraction,
  isGoblinModeComplete,
  isGoblinModeEligible,
  performGoblinModeStep,
} from "../goblinMode";

describe("Goblin mode automation", () => {
  it("is only eligible for the standalone filtration technique outside preview chrome", () => {
    expect(isGoblinModeEligible(filtrationTechnique, false)).toBe(true);
    expect(isGoblinModeEligible(filtrationTechnique, true)).toBe(false);
    expect(isGoblinModeEligible(measuringVolumeTechnique, false)).toBe(false);
  });

  it("maps only supported physical interactions to automation intents", () => {
    const snapAction = filtrationTechnique.actions.find((action) => action.id === "place-filter-paper");
    const rinseAction = filtrationTechnique.actions.find((action) => action.id === "wet-filter-paper");
    const pourAction = filtrationTechnique.actions.find((action) => action.id === "filter-mixture");
    if (!snapAction?.interaction || !rinseAction?.interaction || !pourAction?.interaction) {
      throw new Error("Filtration fixture is missing expected interactions.");
    }

    expect(goblinModeIntentForInteraction(snapAction, snapAction.interaction)?.type).toBe("snapIntent");
    expect(goblinModeIntentForInteraction(rinseAction, rinseAction.interaction)?.type).toBe("rinseIntent");
    expect(goblinModeIntentForInteraction(pourAction, pourAction.interaction)?.type).toBe("pourIntent");
  });

  it("completes filtration through resolved interaction intents and runtime actions", () => {
    let state = createRuntimeState(filtrationTechnique);
    let steps = 0;

    while (!isGoblinModeComplete(filtrationTechnique, state) && steps < 10) {
      const result = performGoblinModeStep(filtrationTechnique, state);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.feedback.message);
      state = result.state;
      steps += 1;
    }

    expect(steps).toBe(6);
    expect(isGoblinModeComplete(filtrationTechnique, state)).toBe(true);
    expect(state.completedNodes).toHaveLength(filtrationTechnique.process.nodes.length);
    expect(state.equipmentInstances.find((item) => item.id === "filter-paper-1")?.contents.precipitate?.rinsed)
      .toBe(true);
  });
});
