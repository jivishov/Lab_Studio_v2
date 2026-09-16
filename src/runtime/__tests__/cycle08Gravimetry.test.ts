/**
 * Cycle 08 — Investigation 3 hard-water gravimetry.
 *
 * These cover the runtime behaviour Cycle 08 changed and could not execute under the repository's
 * validation policy (`AGENTS.md`): the two-stage drying sequence, the cooling gate that the oven
 * temperature makes real, and the two gravimetric calculation templates that previously had no
 * implementation and so derived 0 from nothing.
 *
 * Authored, not executed. See `docs/step-and-image-consistency-audit.md` §20.
 */
import { describe, expect, it } from "vitest";
import { emptyContents } from "../../domain/types";
import type {
  ActionDefinition,
  ContentState,
  PrecipitateState,
  ProcessNode,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import {
  calculateCalciumCarbonateTheoreticalMassG,
  calculateGravimetricPrecipitateMassG,
  calculateHardnessMgLAsCaCO3,
} from "../calculations";
import { createRuntimeState, performRuntimeAction } from "../index";

const precipitate = (dryness: PrecipitateState["dryness"], massG: number): PrecipitateState => ({
  substance: "Calcium carbonate",
  massG,
  rinsed: true,
  dryness,
});

const wetCake = (massG: number): ContentState => ({
  ...emptyContents(),
  kind: "precipitate",
  label: "Calcium carbonate",
  massG,
  precipitate: precipitate("wet", massG),
  wetState: "wet",
  visualState: "filter-cake",
});

describe("gravimetric precipitate mass by difference", () => {
  it("subtracts every recorded tare from the cooled combined mass", () => {
    expect(calculateGravimetricPrecipitateMassG(35.376, [32.842, 0.824])).toBeCloseTo(1.71, 5);
  });

  it("refuses a missing tare rather than treating it as zero", () => {
    expect(() => calculateGravimetricPrecipitateMassG(35.376, [])).toThrow(/tare/i);
    expect(() => calculateGravimetricPrecipitateMassG(35.376, [32.842, Number.NaN])).toThrow(
      /tare/i,
    );
  });

  it("refuses a combined mass that does not exceed its tares", () => {
    expect(() => calculateGravimetricPrecipitateMassG(32.0, [32.842, 0.824])).toThrow(/exceed/i);
  });
});

describe("theoretical CaCO3 mass from the practice reactant masses", () => {
  it("uses the limiting reactant, not the first one recorded", () => {
    // 2.037 g Na2CO3 is 0.019219 mol; 2.006 g CaCl2 is 0.018075 mol, so calcium chloride limits.
    expect(calculateCalciumCarbonateTheoreticalMassG(2.037, 2.006)).toBeCloseTo(1.80904, 4);
    // Swapping which reagent is in excess must not change which one limits the yield.
    expect(calculateCalciumCarbonateTheoreticalMassG(20.37, 2.006)).toBeCloseTo(1.80904, 4);
  });

  it("refuses to compute against an unrecorded reactant mass", () => {
    expect(() => calculateCalciumCarbonateTheoreticalMassG(Number.NaN, 2.006)).toThrow(/finite/i);
    expect(() => calculateCalciumCarbonateTheoreticalMassG(2.037, 0)).toThrow(/greater than zero/i);
  });
});

describe("hardness as mg/L CaCO3", () => {
  it("reports the analysed aliquot when no preconcentration is declared", () => {
    expect(calculateHardnessMgLAsCaCO3(0.32, 20)).toBeCloseTo(16000, 2);
  });

  it("divides back to the source water by the declared preconcentration factor", () => {
    // Finding 10: the community samples were boiled to one two-hundredth of their initial volume.
    expect(calculateHardnessMgLAsCaCO3(0.32, 20, 200)).toBeCloseTo(80, 2);
    expect(calculateHardnessMgLAsCaCO3(0.56, 20, 200)).toBeCloseTo(140, 2);
  });

  it("never assumes a factor the content did not declare", () => {
    expect(calculateHardnessMgLAsCaCO3(0.32, 20)).not.toBeCloseTo(
      calculateHardnessMgLAsCaCO3(0.32, 20, 200),
      2,
    );
  });

  it("rejects a non-positive factor rather than dividing by it", () => {
    expect(() => calculateHardnessMgLAsCaCO3(0.32, 20, 0)).toThrow(/preconcentration/i);
    expect(() => calculateHardnessMgLAsCaCO3(0.32, 20, -200)).toThrow(/preconcentration/i);
  });
});

/**
 * The reducer half of the same behaviour.
 *
 * One fixture technique carries the whole drying chain, because the chain is the thing under test:
 * before Cycle 08 the dry handler discarded the authored state, reported the first stage as fully
 * dry, and left `temperatureC` undefined, which made `cool` fail with "the crucible is not hot" and
 * made the warm-weighing gate unreachable.
 */
const action = (
  id: string,
  verb: ActionDefinition["verb"],
  parameters: ActionDefinition["parameters"],
): ActionDefinition => ({
  id,
  verb,
  label: id,
  parameters,
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: { success: `${id} ok`, invalid: `${id} invalid` },
  evidence: [verb],
});

const node = (actionId: string): ProcessNode => ({
  id: `${actionId}-node`,
  type: "action",
  title: actionId,
  description: actionId,
  actionId,
  config: {},
  validation: [],
  hints: [],
  feedback: { success: "ok", retry: "retry" },
});

const OVEN_C = 115;
const SAFE_WEIGH_C = 40;

const dryingChain = (): TechniqueDefinition => {
  const stage = (id: string, drynessResult: string, visualState: string, dryMassG: number) =>
    action(id, "dry", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "watch-glass",
      ovenDefinitionId: "drying-oven",
      drynessResult,
      visualState,
      dryMassG,
      temperatureC: OVEN_C,
    });

  const actions = [
    stage("fx-first-dry", "damp", "partially-dry-precipitate", 1.73),
    stage("fx-second-dry", "dry", "broken-dry-precipitate", 1.71),
    action("fx-cool", "cool", {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "crucible-tongs",
      cooledTemperatureC: 25,
      cooledObjectLabel: "Watch-glass, paper, and precipitate assembly",
      visualState: "cooled-dry-precipitate",
    }),
    action("fx-weigh", "weigh", {
      sourceDefinitionId: "watch-glass",
      measurementId: "fx-combined-mass",
      expectedMassG: 1.71,
      tolerance: 0.001,
      maxSafeTemperatureC: SAFE_WEIGH_C,
      requiresDryPrecipitate: true,
    }),
  ];

  return {
    id: "fx-drying",
    title: "Fixture drying",
    learningGoal: "Exercise the two-stage drying sequence.",
    requiredEquipment: ["watch-glass", "drying-oven", "crucible-tongs", "analytical-balance"],
    initialState: {
      equipment: [
        {
          id: "fx-watch",
          definitionId: "watch-glass",
          label: "Watch-glass assembly",
          location: "workbench",
          contents: wetCake(1.75),
        },
        {
          id: "fx-oven",
          definitionId: "drying-oven",
          label: "Drying oven",
          location: "workbench",
          contents: emptyContents(),
        },
        {
          id: "fx-tongs",
          definitionId: "crucible-tongs",
          label: "Crucible tongs",
          location: "workbench",
          contents: emptyContents(),
        },
        {
          id: "fx-balance",
          definitionId: "analytical-balance",
          label: "Analytical balance",
          location: "workbench",
          contents: emptyContents(),
        },
      ],
    },
    actions,
    process: {
      startNodeId: "fx-first-dry-node",
      nodes: actions.map((entry) => node(entry.id)),
      edges: actions.slice(1).map((entry, index) => ({
        from: `${actions[index].id}-node`,
        to: `${entry.id}-node`,
        label: "Next",
        condition: { type: "validationPassed" as const },
      })),
    },
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: {
      version: "1.0.0",
      author: "fixture",
      updatedAt: "2026-08-04T00:00:00.000Z",
      tags: [],
    },
  };
};

const lastMessage = (state: RuntimeState) =>
  state.feedbackQueue[state.feedbackQueue.length - 1]?.message ?? "";

const watchGlass = (state: RuntimeState) =>
  state.equipmentInstances.find((instance) => instance.id === "fx-watch")!;

const perform = (
  definition: TechniqueDefinition,
  state: RuntimeState,
  request: Parameters<typeof performRuntimeAction>[2],
) => performRuntimeAction(definition, state, request);

describe("two-stage drying in the reducer", () => {
  it("leaves the first stage damp, warm, and still wet", () => {
    const definition = dryingChain();
    const after = perform(definition, createRuntimeState(definition), {
      actionId: "fx-first-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    const contents = watchGlass(after).contents;
    expect(contents.precipitate?.dryness).toBe("damp");
    expect(contents.wetState).toBe("wet");
    expect(contents.temperatureC).toBe(OVEN_C);
  });

  it("renders the authored stage state instead of the reducer's dry-precipitate default", () => {
    const definition = dryingChain();
    const after = perform(definition, createRuntimeState(definition), {
      actionId: "fx-first-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    expect(watchGlass(after).contents.visualState).toBe("partially-dry-precipitate");
    expect(watchGlass(after).contents.visualState).not.toBe("dry-precipitate");
  });

  it("reaches dry only on the second stage", () => {
    const definition = dryingChain();
    let state = perform(definition, createRuntimeState(definition), {
      actionId: "fx-first-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    state = perform(definition, state, {
      actionId: "fx-second-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    expect(watchGlass(state).contents.precipitate?.dryness).toBe("dry");
    expect(watchGlass(state).contents.wetState).toBe("dry");
    expect(watchGlass(state).contents.visualState).toBe("broken-dry-precipitate");
  });

  it("refuses a combined weighing while the assembly is still warm", () => {
    const definition = dryingChain();
    let state = perform(definition, createRuntimeState(definition), {
      actionId: "fx-first-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    state = perform(definition, state, {
      actionId: "fx-second-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    // Select the weighing node deliberately so this test exercises the physical temperature gate,
    // not the process-order guard.
    const warm = perform(definition, { ...state, currentNodeId: "fx-weigh-node" }, {
      actionId: "fx-weigh",
      verb: "weigh",
      sourceInstanceId: "fx-watch",
    });
    expect(lastMessage(warm)).toMatch(/too hot to weigh/i);
    // The message names the object being weighed, not one investigation's crucible.
    expect(lastMessage(warm)).toMatch(/watch-glass assembly/i);
    expect(warm.measurements.find((entry) => entry.id === "fx-combined-mass")).toBeUndefined();
  });

  it("accepts the weighing once the assembly has cooled", () => {
    const definition = dryingChain();
    let state = perform(definition, createRuntimeState(definition), {
      actionId: "fx-first-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    state = perform(definition, state, {
      actionId: "fx-second-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    state = perform(definition, state, {
      actionId: "fx-cool",
      verb: "cool",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-tongs",
    });
    expect(watchGlass(state).contents.temperatureC).toBeLessThan(SAFE_WEIGH_C);
    expect(watchGlass(state).contents.visualState).toBe("cooled-dry-precipitate");

    state = perform(definition, state, {
      actionId: "fx-weigh",
      verb: "weigh",
      sourceInstanceId: "fx-watch",
    });
    expect(state.measurements.find((entry) => entry.id === "fx-combined-mass")?.value).toBeCloseTo(
      1.71,
      5,
    );
  });

  it("refuses a combined weighing that skips the second drying stage", () => {
    const definition = dryingChain();
    let state = perform(definition, createRuntimeState(definition), {
      actionId: "fx-first-dry",
      verb: "dry",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-oven",
    });
    // Select the cooling node deliberately, then cool straight from the damp stage: the
    // temperature gate is satisfied, while the subsequent weighing dryness gate is not.
    state = perform(definition, { ...state, currentNodeId: "fx-cool-node" }, {
      actionId: "fx-cool",
      verb: "cool",
      sourceInstanceId: "fx-watch",
      targetInstanceId: "fx-tongs",
    });
    const damp = perform(definition, state, {
      actionId: "fx-weigh",
      verb: "weigh",
      sourceInstanceId: "fx-watch",
    });
    expect(lastMessage(damp)).toMatch(/still wet/i);
    expect(damp.measurements.find((entry) => entry.id === "fx-combined-mass")).toBeUndefined();
  });
});
