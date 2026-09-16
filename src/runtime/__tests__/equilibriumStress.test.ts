import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ContentState, LabDefinition, RuntimeState } from "../../domain/types";
import {
  createBundledLabHarness,
  type BundledLabHarness,
} from "../../test/bundledLabHarness";
import { createRuntimeState, performRuntimeAction } from "../index";

let bundledLabHarness: BundledLabHarness | undefined;
let lab: LabDefinition;

const actionVerb = (actionId: string) => {
  const action = lab.actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`Missing action ${actionId}`);
  return action.verb;
};

// This deliberately selects one compiled action in isolation; it is not traversal evidence.
const atAction = (state: RuntimeState, actionId: string): RuntimeState => {
  const processNode = lab.process.nodes.find((candidate) => candidate.actionId === actionId);
  if (!processNode) throw new Error(`Missing process node for ${actionId}`);
  return {
    ...state,
    currentNodeId: processNode.id,
    completedNodes: state.completedNodes.filter((nodeId) => nodeId !== processNode.id),
  };
};

const lastFeedback = (state: RuntimeState): string =>
  state.feedbackQueue[state.feedbackQueue.length - 1]?.message ?? "";

// These tests select a compiled action directly to exercise its reducer contract. Workflow
// prerequisites remain covered by traversal tests, so only the selected action's declared
// prerequisite list is removed from this local test definition.
const labForIsolatedAction = (actionId: string): LabDefinition => ({
  ...lab,
  actions: lab.actions.map((action) =>
    action.id === actionId
      ? { ...action, prerequisites: [] }
      : action,
  ),
});

const withTubeColor = (
  state: RuntimeState,
  instanceId: string,
  visualState: string,
  label: string,
): RuntimeState => {
  const equipmentInstances = state.equipmentInstances.map((instance) =>
    instance.id === instanceId
      ? {
          ...instance,
          contents: {
            ...instance.contents,
            kind: "solution" as ContentState["kind"],
            label,
            volumeMl: 8,
            wetState: "wet" as const,
            visualState,
          },
        }
      : instance,
  );
  return {
    ...state,
    equipmentInstances,
    contents: Object.fromEntries(equipmentInstances.map((instance) => [instance.id, instance.contents])),
  };
};

const runConfiguredAction = (
  state: RuntimeState,
  actionId: string,
  selection: { sourceInstanceId?: string; targetInstanceId?: string } = {},
): RuntimeState =>
  performRuntimeAction(labForIsolatedAction(actionId), atAction(state, actionId), {
    actionId,
    verb: actionVerb(actionId),
    ...selection,
  });

describe("equilibrium stress runtime (isolated selected-action coverage)", () => {
  beforeEach(async () => {
    bundledLabHarness = await createBundledLabHarness();
    lab = await bundledLabHarness.loadLab("equilibrium-rainbow-display");
  });

  afterEach(() => {
    bundledLabHarness?.dispose();
    bundledLabHarness = undefined;
  });

  it("updates result color state for the current control, concentration, temperature, and pressure stresses", () => {
    let state = createRuntimeState(lab);

    state = runConfiguredAction(state, "stress-btb-control");
    expect(state.contents["tube-btb-control"].visualState).toBe("equilibrium-green");
    expect(state.notebook.some((entry) => entry.tags.includes("green"))).toBe(true);

    state = runConfiguredAction(state, "stress-iron-reactant");
    expect(state.contents["tube-iron-reactant"].visualState).toBe("equilibrium-red");
    expect(state.notebook.some((entry) => entry.tags.includes("concentration"))).toBe(true);

    state = runConfiguredAction(state, "stress-cobalt-hot");
    expect(state.contents["tube-cobalt-hot"].visualState).toBe("equilibrium-blue");

    state = runConfiguredAction(state, "soda-shake-if-needed");
    expect(state.contents["soda-syringe"].visualState).toBe("equilibrium-yellow-orange");
    expect(state.notebook.some((entry) => entry.tags.includes("pressure-volume"))).toBe(true);
  });

  it("rejects wrong order and reagent substitutions while preserving the authored stress target", () => {
    const initial = createRuntimeState(lab);
    const wrongOrder = performRuntimeAction(lab, initial, {
      actionId: "stress-btb-control",
      verb: "stressEquilibrium",
    });
    expect(lastFeedback(wrongOrder)).toContain("not expected");

    const wrongSource = runConfiguredAction(initial, "stress-iron-reactant", {
      sourceInstanceId: "distilled-water",
      targetInstanceId: "tube-iron-reactant",
    });
    expect(lastFeedback(wrongSource)).toContain("required stress reagent");

    const fixedTarget = runConfiguredAction(initial, "stress-iron-reactant", {
      sourceInstanceId: "iron-chloride-solid",
      targetInstanceId: "rack-working",
    });
    expect(fixedTarget.contents["tube-iron-reactant"].visualState).toBe("equilibrium-red");
    expect(fixedTarget.contents["rack-working"].visualState).toBe("empty");
  });

  it("requires the final display rack slots to contain the six submitted colors", () => {
    const coloredTubes = [
      ["tube-iron-reactant", "equilibrium-red", "red iron-thiocyanate display tube"],
      ["tube-soda-pressure", "equilibrium-yellow-orange", "orange soda-water display tube"],
      ["tube-btb-acid", "equilibrium-yellow", "yellow bromothymol blue display tube"],
      ["tube-btb-control", "equilibrium-green", "green bromothymol blue display tube"],
      ["tube-btb-base", "equilibrium-blue", "blue bromothymol blue display tube"],
      ["tube-cobalt-chloride", "equilibrium-violet", "violet cobalt-chloride display tube"],
    ] as const;

    let state = coloredTubes.reduce(
      (next, [instanceId, visualState, label]) => withTubeColor(next, instanceId, visualState, label),
      createRuntimeState(lab),
    );

    for (const [actionId, sourceInstanceId] of [
      ["display-red-candidate", "tube-iron-reactant"],
      ["display-orange-candidate", "tube-soda-pressure"],
      ["display-yellow-candidate", "tube-btb-acid"],
      ["display-green-candidate", "tube-btb-control"],
      ["display-blue-candidate", "tube-btb-base"],
      ["display-violet-candidate", "tube-cobalt-chloride"],
    ]) {
      state = runConfiguredAction(state, actionId, { sourceInstanceId });
    }

    const submitted = runConfiguredAction(state, "submit-final-display");
    const submitNodeId = lab.process.nodes.find((node) => node.actionId === "submit-final-display")?.id;
    expect(submitted.notebook.some((entry) => entry.nodeId === submitNodeId)).toBe(true);
    expect(lastFeedback(submitted)).toContain("ready for teacher confirmation");

    const incomplete = runConfiguredAction(
      { ...state, attachments: state.attachments.filter((attachment) => attachment.zoneId !== "sample-rack-slot-6") },
      "submit-final-display",
    );
    expect(lastFeedback(incomplete)).toContain("not fully assembled");
  });
});
