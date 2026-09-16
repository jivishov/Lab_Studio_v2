import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LabCompositionSourceDefinition, LabDefinition, TechniqueDefinition } from "../../domain/types";
import { validateLabCompositionSource, validateTechniqueDefinition } from "../../domain/validation";
import { compileLabComposition } from "../../data/compileLabComposition";
import {
  calculateInitialRateMlPerS,
  compareRatesByCondition,
  createRuntimeState,
  generateGasVolumeSeries,
  getActions,
  getProcess,
  performRuntimeAction,
} from "../index";

const readMarbleKineticsLab = (): LabCompositionSourceDefinition => {
  const lab = JSON.parse(
    readFileSync(join(process.cwd(), "public", "labs", "marble-statue-kinetics.json"), "utf8"),
  ) as unknown;
  const validation = validateLabCompositionSource(lab);
  if (!validation.ok || !validation.value) {
    throw new Error(validation.errors.join("\n"));
  }
  return validation.value;
};

const readMarbleKineticsTechnique = (): TechniqueDefinition => {
  const technique = JSON.parse(
    readFileSync(join(process.cwd(), "public", "techniques", "marble-gas-syringe-kinetics.json"), "utf8"),
  ) as unknown;
  const validation = validateTechniqueDefinition(technique);
  if (!validation.ok || !validation.value) {
    throw new Error(validation.errors.join("\n"));
  }
  return validation.value;
};

const compileMarbleKineticsLab = async (): Promise<LabDefinition> => {
  const source = readMarbleKineticsLab();
  return compileLabComposition(source, async (techniqueId) => {
    const technique = readMarbleKineticsTechnique();
    if (technique.id !== techniqueId) {
      throw new Error(`Technique resolver returned ${technique.id} for ${techniqueId}.`);
    }
    return technique;
  });
};

describe("gas-syringe kinetics models", () => {
  it("generates deterministic gas-volume series for all supported variable tracks", () => {
    const lab = readMarbleKineticsLab();
    const models = lab.kineticsModels ?? [];
    expect(models).toHaveLength(4);

    const rates = models.map((model) => {
      expect(model.conditions).toHaveLength(1);
      const configuredCondition = model.conditions[0];
      if (!configuredCondition) throw new Error(`Model ${model.id} has no guided condition.`);
      const { condition, points } = generateGasVolumeSeries(model, configuredCondition.id);
      expect(condition.id).toBe("guided-configuration");
      expect(points.map((point) => point.x)).toEqual(model.timepointsS);
      expect(points[0].y).toBe(0);
      expect(points.every((point, index) => index === 0 || point.y >= points[index - 1].y)).toBe(true);
      return { conditionId: model.id, value: calculateInitialRateMlPerS(points) };
    });

    expect(rates).toEqual([
      { conditionId: "marble-model-practice", value: 2.62 },
      { conditionId: "marble-model-acid-2m", value: 1.7 },
      { conditionId: "marble-model-acid-4m", value: 2.62 },
      { conditionId: "marble-model-acid-6m", value: 3.253 },
    ]);
    expect(compareRatesByCondition(rates)).toMatchObject({
      fastestConditionId: "marble-model-acid-6m",
      slowestConditionId: "marble-model-acid-2m",
    });
  });

  it("requires exact 0 s and 15 s readings for initial-rate calculations", () => {
    expect(() =>
      calculateInitialRateMlPerS([
        { x: 5, y: 4.2 },
        { x: 15, y: 21.1 },
      ]),
    ).toThrow("0 s and 15 s");
  });

  it("records the current compiled practice series before configured investigation routing", async () => {
    const lab = await compileMarbleKineticsLab();
    let state = createRuntimeState(lab);

    const process = getProcess(lab);
    const actions = getActions(lab);
    for (
      let transitionCount = 0;
      state.currentNodeId !== "record-practice-run-node" && transitionCount < process.nodes.length;
      transitionCount += 1
    ) {
      const current = process.nodes.find((node) => node.id === state.currentNodeId);
      const action = actions.find((candidate) => candidate.id === current?.actionId);
      if (!action) throw new Error(`Missing action for node ${state.currentNodeId}.`);
      const input = action.id === "zero-gas-syringe"
        ? { value: 0, unit: "mL" }
        : action.id === "weigh-practice-marble"
          ? { value: 1.3, unit: "g" }
          : {};
      const next = performRuntimeAction(lab, state, {
        actionId: action.id,
        verb: action.verb,
        ...input,
      });
      const diagnostic = JSON.stringify({
        currentNodeId: state.currentNodeId,
        actionId: action.id,
        attempt: next.attemptHistory.at(-1),
        feedback: next.feedbackQueue.at(-1),
        nextNodeId: next.currentNodeId,
      });
      expect(next.attemptHistory.at(-1)?.success, diagnostic).toBe(true);
      expect(next.currentNodeId, diagnostic).not.toBe(state.currentNodeId);
      state = next;
    }

    expect(state.currentNodeId).toBe("record-practice-run-node");
    const recordAction = actions.find((action) => action.id === "record-practice-run");
    if (!recordAction) throw new Error("Missing compiled practice-series action.");
    const recorded = performRuntimeAction(lab, state, {
      actionId: recordAction.id,
      verb: recordAction.verb,
    });
    expect(recorded.dataSeries.map((series) => series.id)).toEqual(["practice-gas-series"]);
    expect(recorded.dataSeries[0]?.points).toHaveLength(10);
    expect(recorded.calculations).toHaveLength(0);
    expect(recorded.completedNodes).not.toContain("postlab-node");
  });
});
