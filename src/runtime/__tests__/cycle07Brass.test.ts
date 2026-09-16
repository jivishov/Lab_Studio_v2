import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ContentState,
  LabCompositionSourceDefinition,
  LabDefinition,
  RuntimeActionRequest,
  RuntimeState,
  TechniqueDefinition,
} from "../../domain/types";
import {
  deriveActionEffectContract,
  missingRoleBindings,
  roleAcceptsEquipment,
} from "../../domain/atomRegistry";
import { compileLabComposition } from "../../data/compileLabComposition";
import { calculateLinearRegression, calculateNitricAcidVolumeMl } from "../calculations";
import { createRuntimeState, performRuntimeAction } from "../index";

const loadBrass = (): LabDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "labs", "brass-colorimetry.json"), "utf8")) as LabDefinition;

const atAction = (definition: LabDefinition, actionId: string, state = createRuntimeState(definition)): RuntimeState => {
  const node = definition.process.nodes.find((candidate) => candidate.actionId === actionId);
  if (!node) throw new Error(`Missing process node for ${actionId}`);
  return { ...state, currentNodeId: node.id };
};

const lastMessage = (state: RuntimeState): string => state.feedbackQueue.at(-1)?.message ?? "";

/**
 * The staged handler fixtures previously put a molarity unit in `solutes`, which represents an
 * amount instead of a concentration. Keep the same synthetic one-molar fixture by storing its
 * amount and concentration in their respective runtime fields.
 */
const stagedCopperSolution = (label: string, volumeMl: number): ContentState => ({
  kind: "solution",
  label,
  volumeMl,
  solutes: [{
    id: "copper-ii",
    label: "Copper(II)",
    amount: volumeMl / 1000,
    unit: "mol",
  }],
  concentration: { value: 1, unit: "M" },
  contamination: [],
  wetState: "wet",
  visualState: "copper-blue-solution",
});

describe("Cycle 07 brass fidelity", () => {
  it("keeps teacher nitric-acid addition locked until session approval", () => {
    const definition = loadBrass();
    const blocked = performRuntimeAction(definition, atAction(definition, "teacher-add-acid-action"), {
      actionId: "teacher-add-acid-action",
      verb: "observe",
    });
    expect(blocked.completedNodes).not.toContain(blocked.currentNodeId);
    expect(lastMessage(blocked)).toMatch(/locked/i);

    const approved = performRuntimeAction(definition, atAction(definition, "teacher-add-acid-action"), {
      actionId: "teacher-add-acid-action",
      verb: "observe",
      note: "Teacher completed acid addition in hood",
      parameters: { configurationApproved: true },
    });
    expect(approved.attemptHistory.at(-1)?.success).toBe(true);
  });

  it("derives the minimum nitric-acid volume from the recorded brass mass", () => {
    const definition = loadBrass();
    const expected = calculateNitricAcidVolumeMl(1.25);
    const state = atAction(definition, "minimum-hno3-volume-ml-action", {
      ...createRuntimeState(definition),
      measurements: [{
        id: "brass-mass-recorded-g",
        label: "Brass mass",
        value: 1.25,
        unit: "g",
        nodeId: "brass-mass",
      }],
    });
    const next = performRuntimeAction(definition, state, {
      actionId: "minimum-hno3-volume-ml-action",
      verb: "calculate",
      value: expected,
    });

    expect(next.calculations.find((entry) => entry.id === "minimum-hno3-volume-ml")).toMatchObject({
      expected: expect.closeTo(expected, 8),
      passed: true,
      value: expect.closeTo(expected, 8),
    });
  });

  it("derives the calibration model from five recorded absorbances", () => {
    const definition = loadBrass();
    const pairs = [
      [0.025, 0.06],
      [0.05, 0.117],
      [0.1, 0.224],
      [0.2, 0.449],
      [0.4, 0.882],
    ] as const;
    const regression = calculateLinearRegression(pairs.map(([x, y]) => ({ x, y })));
    const state = atAction(definition, "calibration-slope-action", {
      ...createRuntimeState(definition),
      measurements: pairs.map(([, value], index) => ({
        id: ["0p0250", "0p0500", "0p100", "0p200", "0p400"][index] + "-absorbance-au",
        label: "Configured instrument reading",
        value,
        unit: "AU",
        nodeId: `reading-${index}`,
      })),
    });
    const next = performRuntimeAction(definition, state, {
      actionId: "calibration-slope-action",
      verb: "calculate",
      value: regression.slope,
    });
    const calculation = next.calculations.find((entry) => entry.id === "calibration-slope");

    expect(calculation?.passed).toBe(true);
    expect(calculation?.regression).toMatchObject({ pointCount: 5 });
    expect(calculation?.regression?.slope).toBeCloseTo(regression.slope, 10);
    expect(calculation?.regression?.intercept).toBeCloseTo(regression.intercept, 10);
  });

});

/**
 * F05-A coverage. The brass sample path, teacher dilution confirmation, paired comparison fills
 * and waste collection are all technique-owned, so these cases traverse the compiled composition
 * rather than the raw lab. `atAction` above cannot reach them: it looks up process nodes on the
 * raw `LabDefinition`, whose own node list holds only the 28 lab-local steps.
 *
 * Authored, not executed: this batch's verification boundary is source review only.
 */
describe("F05-A brass sample, dilution, comparison and waste continuity", () => {
  const CONFIGURED_BRASS_G = 1.482;
  const READ_BRASS_G = 1.481;

  const loadTechnique = (): TechniqueDefinition =>
    JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", "brass-spectrophotometry.json"), "utf8")) as TechniqueDefinition;

  const compileBrass = async (): Promise<LabDefinition> => {
    const source = JSON.parse(
      readFileSync(join(process.cwd(), "public", "labs", "brass-colorimetry.json"), "utf8"),
    ) as unknown as LabCompositionSourceDefinition;
    const technique = loadTechnique();
    return compileLabComposition(source, async (techniqueId) => {
      if (techniqueId !== technique.id) throw new Error(`Unexpected technique request ${techniqueId}`);
      return technique;
    });
  };

  /**
   * Isolated node entry. This *is* state injection: it replaces `currentNodeId` outright so a
   * single action's handler can be exercised without the process reaching it. Nothing that uses
   * it is traversal coverage. `runNormalSampleProgression` below is the case that lets the reducer
   * choose the transitions.
   */
  const at = (definition: LabDefinition, actionId: string, state: RuntimeState): RuntimeState => {
    const node = definition.process.nodes.find((candidate) => candidate.actionId === actionId);
    if (!node) throw new Error(`Missing compiled process node for ${actionId}`);
    return { ...state, currentNodeId: node.id };
  };
  /**
   * Isolated node entry that also reopens that one node.
   *
   * Nothing in this runtime clears `completedNodes` except a full reset of the whole activity, so
   * re-entering a step an earlier attempt finished - including after a physical reset, which keeps
   * completions on purpose - returns "The current step is already complete." before any handler
   * runs. Cases that are about the guard behind that notice use this and clear only the single
   * node under test. The notice itself is asserted on its own elsewhere in this file.
   */
  const atReopened = (definition: LabDefinition, actionId: string, state: RuntimeState): RuntimeState => {
    const node = definition.process.nodes.find((candidate) => candidate.actionId === actionId);
    if (!node) throw new Error(`Missing compiled process node for ${actionId}`);
    return {
      ...state,
      currentNodeId: node.id,
      completedNodes: state.completedNodes.filter((id) => id !== node.id),
    };
  };
  const instanceOf = (state: RuntimeState, instanceId: string) =>
    state.equipmentInstances.find((entry) => entry.id === instanceId);

  /**
   * An **isolated ordered action sequence** over the repaired sample path, with explicit
   * per-action inputs.
   *
   * It calls `at(...)` before every step, so it overwrites `currentNodeId` each time and never
   * asks the process graph where the learner would actually be. It is a convenient way to reach a
   * given handler with realistic inputs; it is not traversal, it does not exercise the compiled
   * edges, and compiling the definition does not make it so. The bounded traversal case is
   * `runNormalSampleProgression`.
   */
  const runIsolatedSampleSequence = (
    definition: LabDefinition,
    overrides: { configuredMassG?: number; readMassG?: number; skip?: readonly string[] } = {},
  ): RuntimeState => {
    const skip = new Set(overrides.skip ?? []);
    let state = createRuntimeState(definition);
    const steps: Array<{
      actionId: string;
      verb: RuntimeState["attemptHistory"][number]["verb"];
      value?: number;
      parameters?: RuntimeActionRequest["parameters"];
    }> = [
      {
        actionId: "configure-brass-sample-inventory-action",
        verb: "observe",
        value: overrides.configuredMassG ?? CONFIGURED_BRASS_G,
        // The stock configuration carries the repository's configuration acknowledgement
        // contract, so a request must carry the `configurationApproved` flag the player sets for
        // any valid teacher-configuration value. It acknowledges a teacher-provided number; it
        // does not establish who supplied it.
        parameters: { configurationApproved: true },
      },
      { actionId: "tare-empty-beaker-action", verb: "weigh", value: 0 },
      { actionId: "confirm-brass-weighing-support-zeroed-action", verb: "observe" },
      { actionId: "load-brass-onto-weighing-support-action", verb: "transfer" },
      { actionId: "weigh-brass-action", verb: "weigh", value: overrides.readMassG ?? READ_BRASS_G },
      { actionId: "place-brass-in-beaker-action", verb: "transfer" },
    ];
    for (const step of steps) {
      if (skip.has(step.actionId)) continue;
      state = performRuntimeAction(definition, at(definition, step.actionId, state), {
        actionId: step.actionId,
        verb: step.verb,
        ...(step.value === undefined ? {} : { value: step.value }),
        ...(step.parameters === undefined ? {} : { parameters: step.parameters }),
      });
    }
    return state;
  };

  /**
   * Bounded normal progression over the repaired sample-preparation segment.
   *
   * One labelled entry injection places the runtime on the segment's first node, and nothing after
   * that is injected: every later `currentNodeId` is the one the reducer chose from the compiled
   * edges, and each step asserts where it expects to be before it acts.
   *
   * The entry injection is necessary and is reported as a coverage limit rather than hidden. The
   * compiled lab starts at `safety-ppe`, and the only route from there to this segment runs
   * `safety-ppe -> safety-hazards -> safety-hood` into the technique's preliminary wavelength scan
   * (`scan-place-photometer-action-node` ... `scan-return-salt-b-after-series-action-node`, 155
   * nodes in `public/techniques/brass-spectrophotometry.json`) and back out through the lab nodes
   * `approved-wavelength-nm` and `teacher-wavelength-approval` in
   * `public/labs/brass-colorimetry.json`. That is 160 unrelated steps, and the scan's reference
   * composition and per-wavelength zero/blank requirements are exactly the unresolved external
   * authority recorded as blocker B2, so authoring inputs for them would invent the analytical
   * content this batch is forbidden to decide.
   */
  const runNormalSampleProgression = (
    definition: LabDefinition,
    overrides: { configuredMassG?: number; readMassG?: number } = {},
  ): RuntimeState => {
    // Labelled isolated injection, once, at the segment entry only.
    let state: RuntimeState = { ...createRuntimeState(definition), currentNodeId: "configure-brass-sample-inventory" };
    const steps: Array<{
      nodeId: string;
      actionId: string;
      verb: RuntimeState["attemptHistory"][number]["verb"];
      value?: number;
      parameters?: RuntimeActionRequest["parameters"];
    }> = [
      {
        nodeId: "configure-brass-sample-inventory",
        actionId: "configure-brass-sample-inventory-action",
        verb: "observe",
        value: overrides.configuredMassG ?? CONFIGURED_BRASS_G,
        parameters: { configurationApproved: true },
      },
      { nodeId: "tare-empty-beaker", actionId: "tare-empty-beaker-action", verb: "weigh", value: 0.42 },
      {
        nodeId: "confirm-brass-weighing-support-zeroed",
        actionId: "confirm-brass-weighing-support-zeroed-action",
        verb: "observe",
      },
      { nodeId: "load-brass-onto-weighing-support", actionId: "load-brass-onto-weighing-support-action", verb: "transfer" },
      { nodeId: "weigh-brass", actionId: "weigh-brass-action", verb: "weigh", value: overrides.readMassG ?? READ_BRASS_G },
      { nodeId: "place-brass-in-beaker", actionId: "place-brass-in-beaker-action", verb: "transfer" },
    ];
    for (const step of steps) {
      // The reducer put us here, not the test.
      expect(state.currentNodeId, step.actionId).toBe(step.nodeId);
      state = performRuntimeAction(definition, state, {
        actionId: step.actionId,
        verb: step.verb,
        ...(step.value === undefined ? {} : { value: step.value }),
        ...(step.parameters === undefined ? {} : { parameters: step.parameters }),
      });
      expect(state.attemptHistory.at(-1), step.actionId).toMatchObject({ actionId: step.actionId, success: true });
      expect(state.completedNodes, step.actionId).toContain(step.nodeId);
    }
    return state;
  };

  it("keeps one support identity across the tare, the load, the reading and the B-03 transfer", async () => {
    const technique = loadTechnique();
    const support = "brass-weighing-watch-glass";
    const byId = new Map(technique.actions.map((entry) => [entry.id, entry]));

    expect(byId.get("tare-empty-beaker-action")?.parameters.sourceInstanceId).toBe(support);
    expect(byId.get("load-brass-onto-weighing-support-action")?.parameters.targetInstanceId).toBe(support);
    expect(byId.get("weigh-brass-action")?.parameters.sourceInstanceId).toBe(support);
    expect(byId.get("place-brass-in-beaker-action")?.parameters.sourceInstanceId).toBe(support);
    // No step still names the beaker as the thing on the balance.
    for (const id of ["tare-empty-beaker-action", "weigh-brass-action"]) {
      expect(byId.get(id)?.equipmentRoleBindings?.["weighed-vessel"]).toBe("watch-glass");
    }
    expect(byId.get("place-brass-in-beaker-action")?.parameters.targetInstanceId).toBe("brass-beaker");

    const compiled = await compileBrass();
    const state = createRuntimeState(compiled);
    expect(instanceOf(state, support)?.definitionId).toBe("watch-glass");
    expect(instanceOf(state, support)?.contents.kind).toBe("empty");
    expect(instanceOf(state, "brass-sample-vial")?.contents.kind).toBe("empty");
  });

  it("acquires the mass without moving material, then conserves the whole portion into the beaker", async () => {
    const definition = await compileBrass();
    const afterReading = runIsolatedSampleSequence(definition, { skip: ["place-brass-in-beaker-action"] });

    // Configuration established the stock; loading moved it; the balance read moved nothing.
    expect(afterReading.measurements).toContainEqual(expect.objectContaining({
      id: "brass-spectrophotometry--brass-configured-stock-g", value: CONFIGURED_BRASS_G, unit: "g",
    }));
    expect(instanceOf(afterReading, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(instanceOf(afterReading, "brass-weighing-watch-glass")?.contents.massG).toBeCloseTo(CONFIGURED_BRASS_G, 6);
    expect(instanceOf(afterReading, "brass-beaker")?.contents.kind).toBe("empty");
    expect(afterReading.measurements).toContainEqual(expect.objectContaining({
      id: "brass-mass-recorded-g",
      value: READ_BRASS_G,
      unit: "g",
      quantityKind: "material-portion",
      measuredSupportInstanceId: "brass-weighing-watch-glass",
      materialSourceInstanceId: "brass-sample-vial",
      sourceActionId: "weigh-brass-action",
    }));

    const afterTransfer = runIsolatedSampleSequence(definition);
    // The beaker receives the configured portion, not the learner's reading, and the support empties once.
    expect(instanceOf(afterTransfer, "brass-beaker")?.contents.massG).toBeCloseTo(CONFIGURED_BRASS_G, 6);
    expect(instanceOf(afterTransfer, "brass-beaker")?.contents.massG).not.toBeCloseTo(READ_BRASS_G, 6);
    expect(instanceOf(afterTransfer, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");
    // Recording the reading never replenished the vial.
    expect(instanceOf(afterTransfer, "brass-sample-vial")?.contents.kind).toBe("empty");
  });

  it("refuses the B-03 transfer without valid current-attempt evidence on the same support", async () => {
    const definition = await compileBrass();

    // Missing evidence: the reading was never taken.
    const noReading = runIsolatedSampleSequence(definition, { skip: ["weigh-brass-action", "place-brass-in-beaker-action"] });
    const rejected = performRuntimeAction(definition, at(definition, "place-brass-in-beaker-action", noReading), {
      actionId: "place-brass-in-beaker-action", verb: "transfer",
    });
    expect(rejected.completedNodes).not.toContain(rejected.currentNodeId);
    expect(instanceOf(rejected, "brass-beaker")?.contents.kind).toBe("empty");
    expect(instanceOf(rejected, "brass-weighing-watch-glass")?.contents.massG).toBeCloseTo(CONFIGURED_BRASS_G, 6);

    // Invalid evidence: a record that exists but carries no usable positive value.
    const invalid = runIsolatedSampleSequence(definition, { skip: ["place-brass-in-beaker-action"] });
    const withInvalidRecord: RuntimeState = {
      ...invalid,
      measurements: invalid.measurements.map((entry) =>
        entry.id === "brass-mass-recorded-g" ? { ...entry, value: Number.NaN } : entry),
    };
    const rejectedInvalid = performRuntimeAction(definition, at(definition, "place-brass-in-beaker-action", withInvalidRecord), {
      actionId: "place-brass-in-beaker-action", verb: "transfer",
    });
    expect(rejectedInvalid.completedNodes).not.toContain(rejectedInvalid.currentNodeId);
    expect(instanceOf(rejectedInvalid, "brass-beaker")?.contents.kind).toBe("empty");

    // Wrong support: the same value read against another support does not authorise this delivery.
    const wrongSupport: RuntimeState = {
      ...invalid,
      measurements: invalid.measurements.map((entry) =>
        entry.id === "brass-mass-recorded-g" ? { ...entry, measuredSupportInstanceId: "brass-beaker" } : entry),
    };
    const rejectedSupport = performRuntimeAction(definition, at(definition, "place-brass-in-beaker-action", wrongSupport), {
      actionId: "place-brass-in-beaker-action", verb: "transfer",
    });
    expect(rejectedSupport.completedNodes).not.toContain(rejectedSupport.currentNodeId);
    expect(instanceOf(rejectedSupport, "brass-beaker")?.contents.kind).toBe("empty");

    // Stale evidence: a record stamped with an earlier attempt cannot complete a fresh one.
    const stale: RuntimeState = {
      ...invalid,
      evidenceScopeGeneration: (invalid.evidenceScopeGeneration ?? 1) + 1,
    };
    const rejectedStale = performRuntimeAction(definition, at(definition, "place-brass-in-beaker-action", stale), {
      actionId: "place-brass-in-beaker-action", verb: "transfer",
    });
    expect(rejectedStale.completedNodes).not.toContain(rejectedStale.currentNodeId);
    expect(instanceOf(rejectedStale, "brass-beaker")?.contents.kind).toBe("empty");
  });

  it("configures the vial once per physical setup and refuses every later configuration of it", async () => {
    const definition = await compileBrass();
    const finished = runIsolatedSampleSequence(definition);
    expect(instanceOf(finished, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(Object.keys(finished.solidStockInitializations ?? {})).toEqual(["brass-sample-vial"]);

    // Re-entering the setup step is answered by the runtime's already-complete notice before any
    // handler runs, because a rejection never removes a node the learner really did complete.
    const refill = performRuntimeAction(definition, at(definition, "configure-brass-sample-inventory-action", finished), {
      actionId: "configure-brass-sample-inventory-action", verb: "observe", value: CONFIGURED_BRASS_G,
      parameters: { configurationApproved: true },
    });
    expect(refill.completedNodes).toContain(refill.currentNodeId);
    expect(refill.completedNodes).toEqual(finished.completedNodes);
    expect(refill.attemptHistory).toHaveLength(finished.attemptHistory.length);
    expect(refill.feedbackQueue.at(-1)?.message).toContain("already complete");
    expect(instanceOf(refill, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(instanceOf(refill, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");
    expect(refill.solidStockInitializations).toEqual(finished.solidStockInitializations);

    // Labelled isolated injection of `completedNodes` only, so the initialization guard itself is
    // the thing that answers. Everything else about the state is the one the sequence produced.
    const reopened = performRuntimeAction(
      definition,
      atReopened(definition, "configure-brass-sample-inventory-action", finished),
      {
        actionId: "configure-brass-sample-inventory-action", verb: "observe", value: CONFIGURED_BRASS_G,
        parameters: { configurationApproved: true },
      },
    );
    expect(reopened.attemptHistory.at(-1)).toMatchObject({
      actionId: "configure-brass-sample-inventory-action", success: false,
    });
    expect(reopened.feedbackQueue.at(-1)?.message).toContain("already configured for the current physical setup");
    expect(instanceOf(reopened, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(instanceOf(reopened, "brass-beaker")?.contents.massG).toBeCloseTo(CONFIGURED_BRASS_G, 6);
    expect(reopened.measurements).toEqual(finished.measurements);
    expect(reopened.solidStockInitializations).toEqual(finished.solidStockInitializations);
    // Historical completions the rejection did not create are still there.
    expect(reopened.completedNodes).toEqual(expect.arrayContaining(["tare-empty-beaker", "place-brass-in-beaker"]));

    // Correcting an accepted value is no longer available either: one accepted configuration per
    // physical setup, whatever the second value is. This deliberately supersedes the earlier rule
    // that allowed 1.2 g to be replaced by 1.9 g on an unused vial.
    const configured = performRuntimeAction(definition, at(definition, "configure-brass-sample-inventory-action", createRuntimeState(definition)), {
      actionId: "configure-brass-sample-inventory-action", verb: "observe", value: 1.2,
      parameters: { configurationApproved: true },
    });
    expect(instanceOf(configured, "brass-sample-vial")?.contents.massG).toBeCloseTo(1.2, 6);
    const corrected = performRuntimeAction(
      definition,
      atReopened(definition, "configure-brass-sample-inventory-action", configured),
      {
        actionId: "configure-brass-sample-inventory-action", verb: "observe", value: 1.9,
        parameters: { configurationApproved: true },
      },
    );
    expect(corrected.feedbackQueue.at(-1)?.message).toContain("already configured for the current physical setup");
    expect(instanceOf(corrected, "brass-sample-vial")?.contents.massG).toBeCloseTo(1.2, 6);
    expect(instanceOf(corrected, "brass-sample-vial")?.contents.solutes).toEqual([
      expect.objectContaining({ id: "configured-brass", amount: 1.2, unit: "g" }),
    ]);

    // A brand-new runtime is a fresh setup with the authored empty vial back and nothing locked.
    const brandNew = createRuntimeState(definition);
    expect(instanceOf(brandNew, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(brandNew.solidStockInitializations).toEqual({});
  });

  it("restores the physical setup on a real reset and allows exactly one new configuration", async () => {
    const definition = await compileBrass();
    const finished = runIsolatedSampleSequence(definition);
    expect(instanceOf(finished, "brass-beaker")?.contents.massG).toBeCloseTo(CONFIGURED_BRASS_G, 6);

    // The public reset operation, not a hand-built fresh state. Default resume: no `resumeNodeId`
    // is supplied, so nothing here skips a prerequisite.
    const reset = performRuntimeAction(definition, finished, { verb: "reset", parameters: { scope: "physical" } });

    // Fresh physical setup.
    expect(instanceOf(reset, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(instanceOf(reset, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");
    expect(instanceOf(reset, "brass-beaker")?.contents.kind).toBe("empty");
    expect(reset.solidStockInitializations).toEqual({});

    // Retained history and evidence, and a new generation. Reset does not empty `completedNodes`
    // or the notebook, and this test does not assume it does.
    expect(reset.completedNodes).toEqual(finished.completedNodes);
    expect(reset.attemptHistory).toEqual(finished.attemptHistory);
    expect(reset.notebook).toEqual(finished.notebook);
    expect(reset.measurements).toEqual(finished.measurements);
    expect(reset.evidenceScopeGeneration).toBe((finished.evidenceScopeGeneration ?? 1) + 1);

    // Re-entering any finished step is answered by the already-complete notice, and the notice
    // appends no attempt. That is the first thing a learner meets after a physical reset here, so
    // it is asserted before anything reopens a node.
    const reentry = performRuntimeAction(definition, at(definition, "load-brass-onto-weighing-support-action", reset), {
      actionId: "load-brass-onto-weighing-support-action", verb: "transfer",
    });
    expect(reentry.feedbackQueue.at(-1)?.message).toContain("already complete");
    expect(reentry.attemptHistory).toHaveLength(reset.attemptHistory.length);

    // Retained evidence cannot authorize the new sample's work. Each rule is asserted on its own,
    // behind a labelled single-node reopen, so a single failure names the rule that slipped.
    const staleZero = performRuntimeAction(definition, atReopened(definition, "confirm-brass-weighing-support-zeroed-action", reset), {
      actionId: "confirm-brass-weighing-support-zeroed-action", verb: "observe",
    });
    expect(staleZero.attemptHistory.at(-1)).toMatchObject({
      actionId: "confirm-brass-weighing-support-zeroed-action", success: false, message: "Prerequisite missing.",
    });
    const staleLoad = performRuntimeAction(definition, atReopened(definition, "load-brass-onto-weighing-support-action", reset), {
      actionId: "load-brass-onto-weighing-support-action", verb: "transfer",
    });
    expect(staleLoad.attemptHistory.at(-1)).toMatchObject({
      actionId: "load-brass-onto-weighing-support-action", success: false, message: "Prerequisite missing.",
    });
    expect(instanceOf(staleLoad, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");
    const staleTransfer = performRuntimeAction(definition, atReopened(definition, "place-brass-in-beaker-action", reset), {
      actionId: "place-brass-in-beaker-action", verb: "transfer",
    });
    expect(staleTransfer.attemptHistory.at(-1)).toMatchObject({
      actionId: "place-brass-in-beaker-action", success: false, message: "Prerequisite missing.",
    });
    expect(instanceOf(staleTransfer, "brass-beaker")?.contents.kind).toBe("empty");

    // The retained configuration measurement is still in state and is not what decides this: the
    // cleared runtime lifecycle marker is.
    expect(reset.measurements.some((entry) => entry.id === "brass-spectrophotometry--brass-configured-stock-g")).toBe(true);
    const reconfigured = performRuntimeAction(
      definition,
      atReopened(definition, "configure-brass-sample-inventory-action", reset),
      {
        actionId: "configure-brass-sample-inventory-action", verb: "observe", value: 1.1,
        parameters: { configurationApproved: true },
      },
    );
    expect(reconfigured.attemptHistory.at(-1)).toMatchObject({
      actionId: "configure-brass-sample-inventory-action", success: true,
    });
    expect(instanceOf(reconfigured, "brass-sample-vial")?.contents.massG).toBeCloseTo(1.1, 6);
    expect(reconfigured.solidStockInitializations).toEqual({
      "brass-sample-vial": expect.objectContaining({
        actionId: "configure-brass-sample-inventory-action", configuredMassG: 1.1,
        evidenceScopeGeneration: (finished.evidenceScopeGeneration ?? 1) + 1,
      }),
    });

    // Exactly one: the next configuration of the same vial in the same setup is refused again.
    const secondConfiguration = performRuntimeAction(
      definition,
      atReopened(definition, "configure-brass-sample-inventory-action", reconfigured),
      {
        actionId: "configure-brass-sample-inventory-action", verb: "observe", value: 1.1,
        parameters: { configurationApproved: true },
      },
    );
    expect(secondConfiguration.feedbackQueue.at(-1)?.message).toContain("already configured for the current physical setup");

    // The freshly prepared sample completes the segment in the new generation, once each retained
    // completion is reopened. This part is an isolated ordered sequence, not traversal.
    let state = reconfigured;
    for (const step of [
      { actionId: "tare-empty-beaker-action", verb: "weigh" as const, value: 0.5 },
      { actionId: "confirm-brass-weighing-support-zeroed-action", verb: "observe" as const },
      { actionId: "load-brass-onto-weighing-support-action", verb: "transfer" as const },
      { actionId: "weigh-brass-action", verb: "weigh" as const, value: 1.099 },
      { actionId: "place-brass-in-beaker-action", verb: "transfer" as const },
    ]) {
      state = performRuntimeAction(definition, atReopened(definition, step.actionId, state), {
        actionId: step.actionId, verb: step.verb,
        ...(step.value === undefined ? {} : { value: step.value }),
      });
      expect(state.attemptHistory.at(-1), step.actionId).toMatchObject({ actionId: step.actionId, success: true });
    }
    expect(instanceOf(state, "brass-beaker")?.contents.massG).toBeCloseTo(1.1, 6);
    // The reset kept the first attempt's record under the same id, so the new one is the last.
    const readings = state.measurements.filter((entry) => entry.id === "brass-mass-recorded-g");
    expect(readings).toHaveLength(2);
    expect(readings.at(0)).toMatchObject({ value: READ_BRASS_G, evidenceScopeGeneration: 1 });
    expect(readings.at(-1)).toMatchObject({
      value: 1.099, evidenceScopeGeneration: (finished.evidenceScopeGeneration ?? 1) + 1,
    });
  });

  it("requires a current-attempt external-zero confirmation before the brass is loaded", async () => {
    const definition = await compileBrass();
    const technique = loadTechnique();
    const confirmation = technique.actions.find((entry) => entry.id === "confirm-brass-weighing-support-zeroed-action");

    // It records a statement. It is not a physical operation and does not claim to be one: no atom,
    // no mass, volume or material contract, and a composition-owned evidence-recording effect that
    // matches what the canonical derivation produces for it.
    expect(confirmation?.verb).toBe("observe");
    expect(confirmation?.interaction?.type).toBe("recordNotebook");
    expect(confirmation?.atomId).toBeUndefined();
    expect(confirmation?.equipmentRoleBindings).toBeUndefined();
    expect(confirmation?.mass).toBeUndefined();
    expect(confirmation?.volume).toBeUndefined();
    expect(confirmation?.materialTransition).toBeUndefined();
    expect(confirmation?.sourceInventory).toBeUndefined();
    const derived = deriveActionEffectContract(confirmation!);
    expect(derived.errors).toEqual([]);
    expect(derived.contract).toEqual({ classes: ["evidence-recording"], targets: [{ domain: "evidence" }] });
    expect(technique.composition?.legacyActionEffects).toContainEqual({
      actionId: "confirm-brass-weighing-support-zeroed-action",
      effect: { classes: ["evidence-recording"], targets: [{ domain: "evidence" }] },
    });
    // The wording on record is a self-report, and says so.
    expect(String(confirmation?.parameters.note)).toMatch(/self-reported/i);
    expect(String(confirmation?.parameters.note)).toMatch(/neither performs nor senses/i);

    // It is bound to this attempt's reading on this exact support, by the reading's own provenance.
    expect(confirmation?.prerequisites).toContainEqual(expect.objectContaining({
      type: "measurementRecorded",
      measurementId: "empty-weighing-support-tare-g",
      measurementContinuity: {
        version: 1,
        quantityKind: "balance-display",
        measuredSupportInstanceId: "brass-weighing-watch-glass",
        producerActionId: "tare-empty-beaker-action",
      },
    }));

    // Missing: no reading has been taken, so the confirmation is refused.
    const noReading = performRuntimeAction(definition, at(definition, "confirm-brass-weighing-support-zeroed-action", createRuntimeState(definition)), {
      actionId: "confirm-brass-weighing-support-zeroed-action", verb: "observe",
    });
    expect(noReading.attemptHistory.at(-1)).toMatchObject({
      actionId: "confirm-brass-weighing-support-zeroed-action", success: false, message: "Prerequisite missing.",
    });
    expect(noReading.notebook).toEqual([]);

    // Missing: the load refuses without the confirmation, even though the reading exists.
    const readOnly = runIsolatedSampleSequence(definition, {
      skip: [
        "confirm-brass-weighing-support-zeroed-action",
        "load-brass-onto-weighing-support-action",
        "weigh-brass-action",
        "place-brass-in-beaker-action",
      ],
    });
    const unconfirmedLoad = performRuntimeAction(definition, at(definition, "load-brass-onto-weighing-support-action", readOnly), {
      actionId: "load-brass-onto-weighing-support-action", verb: "transfer",
    });
    expect(unconfirmedLoad.attemptHistory.at(-1)).toMatchObject({
      actionId: "load-brass-onto-weighing-support-action", success: false, message: "Prerequisite missing.",
    });
    expect(instanceOf(unconfirmedLoad, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");
    expect(instanceOf(unconfirmedLoad, "brass-sample-vial")?.contents.massG).toBeCloseTo(CONFIGURED_BRASS_G, 6);

    // Stale: nothing an earlier attempt recorded authorizes this one, and the notebook tag the
    // confirmation left behind does not either. Bumping the generation stales the reading and the
    // confirmation together, and the load evaluates its rules in order, so the reading's gate is
    // what reports first. This case therefore proves that the whole earlier attempt is worthless
    // here, not that the zero gate alone refuses; the case above, where the reading succeeded in
    // this attempt and only the confirmation is missing, is the one that isolates the zero gate.
    const confirmed = runIsolatedSampleSequence(definition, {
      skip: ["load-brass-onto-weighing-support-action", "weigh-brass-action", "place-brass-in-beaker-action"],
    });
    const compiledConfirmation = definition.actions.find(
      (action) => action.id === "confirm-brass-weighing-support-zeroed-action",
    );
    const scopedConfirmationTag = String(compiledConfirmation?.parameters.tag);
    expect(scopedConfirmationTag).not.toBe("undefined");
    expect(confirmed.notebook.at(-1)?.tags).toContain(scopedConfirmationTag);
    const staleGeneration: RuntimeState = {
      ...confirmed,
      evidenceScopeGeneration: (confirmed.evidenceScopeGeneration ?? 1) + 1,
    };
    // The confirmation's own success is now stranded in the previous generation.
    expect(staleGeneration.attemptHistory.some((attempt) =>
      attempt.actionId === "confirm-brass-weighing-support-zeroed-action" &&
      attempt.success &&
      attempt.evidenceScopeGeneration === staleGeneration.evidenceScopeGeneration)).toBe(false);
    const staleLoad = performRuntimeAction(definition, at(definition, "load-brass-onto-weighing-support-action", staleGeneration), {
      actionId: "load-brass-onto-weighing-support-action", verb: "transfer",
    });
    expect(staleLoad.attemptHistory.at(-1)).toMatchObject({
      actionId: "load-brass-onto-weighing-support-action", success: false, message: "Prerequisite missing.",
    });
    // The tag survived the generation change and authorized nothing, which is why the load is
    // gated on the action rather than on the tag.
    expect(staleGeneration.notebook.some((entry) => entry.tags.includes(scopedConfirmationTag))).toBe(true);
    expect(instanceOf(staleLoad, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");
  });

  it("drives the sample-preparation segment through the compiled edges without further injection", async () => {
    const definition = await compileBrass();
    const state = runNormalSampleProgression(definition);

    // The support is where the whole path says it is, and the beaker holds the configured portion.
    expect(instanceOf(state, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");
    expect(instanceOf(state, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(instanceOf(state, "brass-beaker")?.contents.massG).toBeCloseTo(CONFIGURED_BRASS_G, 6);
    expect(state.completedNodes).toEqual(expect.arrayContaining([
      "configure-brass-sample-inventory",
      "tare-empty-beaker",
      "confirm-brass-weighing-support-zeroed",
      "load-brass-onto-weighing-support",
      "weigh-brass",
      "place-brass-in-beaker",
    ]));
    // B-03 completed and the process moved along its own outgoing edge. Where that edge leads is
    // out of scope here, so it is read from the compiled graph rather than named.
    const afterTransfer = definition.process.edges.find((edge) => edge.from === "place-brass-in-beaker");
    expect(afterTransfer).toBeDefined();
    expect(state.currentNodeId).toBe(afterTransfer?.to);

    // The empty-support reading was 0.42 g and nothing required it to be zero, which is the point
    // of the separate zeroing statement.
    expect(state.measurements.find((entry) => entry.id === "brass-spectrophotometry--empty-weighing-support-tare-g")).toMatchObject({
      value: 0.42, quantityKind: "balance-display", measuredSupportInstanceId: "brass-weighing-watch-glass",
    });

    // Equipment placement: this composition declares no placement step on the sample path, and no
    // runtime guard requires the support to be on the balance pan. The authored location is the
    // shelf throughout. "On the pan" is therefore instruction text, not enforced state.
    const sampleSegment = [
      "configure-brass-sample-inventory", "tare-empty-beaker", "confirm-brass-weighing-support-zeroed",
      "load-brass-onto-weighing-support", "weigh-brass", "place-brass-in-beaker",
    ];
    const actionById = new Map(definition.actions.map((entry) => [entry.id, entry]));
    for (const nodeId of sampleSegment) {
      const node = definition.process.nodes.find((entry) => entry.id === nodeId);
      expect(actionById.get(node?.actionId ?? "")?.verb, nodeId).not.toBe("place");
    }
    expect(createRuntimeState(definition).equipmentInstances
      .find((entry) => entry.id === "brass-weighing-watch-glass")?.location).toBe("shelf");
  });

  it("locks the stock configuration behind the acknowledgement contract rather than a role label", async () => {
    const definition = await compileBrass();
    const unapproved = performRuntimeAction(definition, at(definition, "configure-brass-sample-inventory-action", createRuntimeState(definition)), {
      actionId: "configure-brass-sample-inventory-action", verb: "observe", value: CONFIGURED_BRASS_G,
    });
    expect(unapproved.completedNodes).not.toContain(unapproved.currentNodeId);
    expect(instanceOf(unapproved, "brass-sample-vial")?.contents.kind).toBe("empty");
    expect(unapproved.measurements.some((entry) => entry.id.endsWith("brass-configured-stock-g"))).toBe(false);

    // The load is unreachable while the stock is unconfigured, so the guard really does hold the
    // whole sample path rather than only its own step.
    const blockedLoad = performRuntimeAction(definition, at(definition, "load-brass-onto-weighing-support-action", unapproved), {
      actionId: "load-brass-onto-weighing-support-action", verb: "transfer",
    });
    expect(blockedLoad.completedNodes).not.toContain(blockedLoad.currentNodeId);
    expect(instanceOf(blockedLoad, "brass-weighing-watch-glass")?.contents.kind).toBe("empty");

    // What the flag actually proves, stated so no later reader over-reads this test: the player
    // sets `configurationApproved` from a valid value in the field and nothing else, so the same
    // request succeeds without any actor identity being established anywhere.
    const acknowledged = performRuntimeAction(definition, at(definition, "configure-brass-sample-inventory-action", createRuntimeState(definition)), {
      actionId: "configure-brass-sample-inventory-action", verb: "observe", value: CONFIGURED_BRASS_G,
      parameters: { configurationApproved: true },
    });
    expect(acknowledged.attemptHistory.at(-1)).toMatchObject({
      actionId: "configure-brass-sample-inventory-action", success: true,
    });
    expect(acknowledged.measurements.some((entry) => entry.id.endsWith("brass-configured-stock-g"))).toBe(true);
  });

  it("feeds the learner's own reading, not the teacher stock, into the acid and copper calculations", async () => {
    const definition = await compileBrass();
    const state = runIsolatedSampleSequence(definition, { configuredMassG: 1.9, readMassG: 1.234 });
    const recorded = state.measurements.find((entry) => entry.id === "brass-mass-recorded-g");
    expect(recorded?.value).toBe(1.234);

    const expected = calculateNitricAcidVolumeMl(1.234);
    const next = performRuntimeAction(definition, at(definition, "minimum-hno3-volume-ml-action", state), {
      actionId: "minimum-hno3-volume-ml-action", verb: "calculate", value: expected,
    });
    expect(next.calculations.find((entry) => entry.id === "minimum-hno3-volume-ml")).toMatchObject({
      passed: true, expected: expect.closeTo(expected, 8),
    });
    // The configured stock is separate evidence and is not what the calculation consumed.
    expect(calculateNitricAcidVolumeMl(1.9)).not.toBeCloseTo(expected, 8);

    // Both copper mass-percent denominators read the same measurement. Labelled isolated handler
    // state supplies only the upstream concentration/mass evidence those templates need; the
    // denominator itself is the reading the sample path above actually produced.
    const unknownMolarityM = 0.31;
    const copperMassG = (unknownMolarityM * 0.1) * 63.546;
    const staged: RuntimeState = {
      ...next,
      calculations: [
        ...next.calculations,
        { id: "spectrometric-unknown-molarity", label: "Spectrometric unknown molarity", value: unknownMolarityM, unit: "M", nodeId: "staged" },
        { id: "visual-unknown-molarity", label: "Visual unknown molarity", value: unknownMolarityM, unit: "M", nodeId: "staged" },
        { id: "spectrometric-copper-mass-g", label: "Copper mass", value: copperMassG, unit: "g Cu", nodeId: "staged" },
      ],
    };
    const expectedPercent = (copperMassG / 1.234) * 100;
    for (const actionId of ["spectrometric-copper-percent-action", "visual-copper-percent-action"]) {
      const percent = performRuntimeAction(definition, at(definition, actionId, staged), {
        actionId, verb: "calculate", value: expectedPercent,
      });
      const calculationId = actionId.replace("-action", "");
      expect(percent.calculations.find((entry) => entry.id === calculationId), actionId).toMatchObject({
        passed: true, expected: expect.closeTo(expectedPercent, 6),
      });
      // Had the configured 1.9 g stock been the denominator, the same numerator would give a
      // materially different percentage, so this confirms which quantity was consumed.
      expect((copperMassG / 1.9) * 100).not.toBeCloseTo(expectedPercent, 2);
    }
  });

  it("requires the actual water addition before the teacher dilution confirmation and adds no second addition", async () => {
    const definition = await compileBrass();
    const technique = loadTechnique();
    const byId = new Map(technique.actions.map((entry) => [entry.id, entry]));

    // Exactly one action delivers water into the beaker, and it consumes the measured volume.
    const beakerWaterPours = technique.actions.filter((entry) =>
      entry.volume?.source === "measurement" &&
      entry.volume.referenceId === "digest-added-water-ml" &&
      entry.parameters.targetInstanceId === "brass-beaker");
    expect(beakerWaterPours).toHaveLength(1);
    expect(byId.get("measure-50ml-digest-water-action")?.volume).toMatchObject({ source: "literal", valueMl: 50 });

    // The confirmation is a qualitative external assertion with no quantity contract at all.
    const confirm = byId.get("confirm-diluted-digest-material-action");
    expect(confirm?.verb).toBe("observe");
    expect(confirm?.interaction?.type).toBe("recordNotebook");
    expect(confirm?.volume).toBeUndefined();
    expect(confirm?.mass).toBeUndefined();
    expect(Object.keys(confirm?.materialTransition ?? {}).sort()).toEqual(["kind", "label", "visualState", "wetState"]);

    // Without the authorization tag the addition itself is locked, so the confirmation is too.
    const blocked = performRuntimeAction(definition, at(definition, "confirm-diluted-digest-material-action", createRuntimeState(definition)), {
      actionId: "confirm-diluted-digest-material-action", verb: "observe",
    });
    expect(blocked.completedNodes).not.toContain(blocked.currentNodeId);
    expect(instanceOf(blocked, "brass-beaker")?.contents.kind).toBe("empty");
  });

  it("confirms the dilution qualitatively while preserving the beaker's established quantities", async () => {
    const definition = await compileBrass();
    // Labelled isolated handler state: the beaker already holds the digest volume this
    // confirmation describes, and the gating evidence is present. This is not a claim of learner
    // traversal.
    const base = createRuntimeState(definition);
    const digestVolumeMl = 62.5;
    const staged: RuntimeState = {
      ...base,
      equipmentInstances: base.equipmentInstances.map((entry) =>
        entry.id === "brass-beaker"
          ? {
              ...entry,
              contents: {
                ...entry.contents,
                kind: "mixture",
                label: "Completed brass digest",
                volumeMl: digestVolumeMl,
                massG: 1.481,
                solutes: [{ id: "copper-ii", label: "Copper(II)", amount: 0.9, unit: "g" }],
                wetState: "wet",
                visualState: "digest",
              },
            }
          : entry),
      notebook: [
        ...base.notebook,
        {
          id: "staged-authorization", timestamp: "2026-09-09T00:00:00.000Z", nodeId: "staged",
          type: "observation", label: "Authorization", value: "authorized",
          tags: ["teacher-digest-dilution-authorized"],
        },
      ],
      attemptHistory: [
        ...base.attemptHistory,
        {
          id: "staged-water-addition", timestamp: "2026-09-09T00:00:00.000Z", nodeId: "staged",
          actionId: "teacher-add-50ml-water-to-digest-action", verb: "transfer", mode: base.mode,
          evidenceScopeId: base.evidenceScopeId, evidenceScopeGeneration: base.evidenceScopeGeneration,
          success: true, message: "staged",
        },
      ],
    };

    const next = performRuntimeAction(definition, at(definition, "confirm-diluted-digest-material-action", staged), {
      actionId: "confirm-diluted-digest-material-action", verb: "observe",
    });
    const beaker = instanceOf(next, "brass-beaker");
    expect(beaker?.contents.kind).toBe("solution");
    expect(beaker?.contents.visualState).toBe("copper-blue-solution");
    // Qualitative only: nothing was added, removed or synthesised.
    expect(beaker?.contents.volumeMl).toBe(digestVolumeMl);
    expect(beaker?.contents.massG).toBeCloseTo(1.481, 6);
    expect(beaker?.contents.solutes).toEqual([
      expect.objectContaining({ id: "copper-ii", amount: 0.9, unit: "g" }),
    ]);
    const compiledConfirmation = definition.actions.find(
      (action) => action.id === "confirm-diluted-digest-material-action",
    );
    const scopedConfirmationTag = String(compiledConfirmation?.parameters.tag);
    expect(scopedConfirmationTag).not.toBe("undefined");
    expect(next.notebook.at(-1)?.tags).toContain(scopedConfirmationTag);
  });

  it("fills each comparison arm from its own tube and keeps V-02 a separate operation", async () => {
    const definition = await compileBrass();
    // Labelled isolated handler state: the labelled sample tubes are staged with the solutions the
    // upstream dilution steps would have prepared. This exercises the two fill handlers, and is not
    // a claim that the route up to V-01 was traversed.
    const base = createRuntimeState(definition);
    const staged: RuntimeState = {
      ...base,
      equipmentInstances: base.equipmentInstances.map((entry) =>
        entry.id === "unknown-sample-tube" ? { ...entry, contents: stagedCopperSolution("Brass unknown", 12) }
        : entry.id === "standard-0p400-tube" ? { ...entry, contents: stagedCopperSolution("0.400 M standard", 12) }
        : entry),
    };

    let state = performRuntimeAction(definition, at(definition, "fill-color-depth-unknown-action", staged), {
      actionId: "fill-color-depth-unknown-action", verb: "transfer", value: 8,
    });
    expect(instanceOf(state, "color-depth-unknown-tube")?.contents.volumeMl).toBeCloseTo(8, 6);
    expect(instanceOf(state, "unknown-sample-tube")?.contents.volumeMl).toBeCloseTo(4, 6);
    expect(instanceOf(state, "color-depth-standard-tube")?.contents.kind).toBe("empty");

    state = performRuntimeAction(definition, at(definition, "fill-color-depth-standard-action", state), {
      actionId: "fill-color-depth-standard-action", verb: "transfer", value: 8,
    });
    expect(instanceOf(state, "color-depth-standard-tube")?.contents.volumeMl).toBeCloseTo(8, 6);
    expect(instanceOf(state, "standard-0p400-tube")?.contents.volumeMl).toBeCloseTo(4, 6);
    // The two arms never share a receiver, so the unknown arm is untouched by the standard fill.
    expect(instanceOf(state, "color-depth-unknown-tube")?.contents.label).toBe("Brass unknown");
    expect(instanceOf(state, "color-depth-standard-tube")?.contents.label).toBe("0.400 M standard");

    // A fill beyond the source's remaining volume is refused rather than invented.
    // Reopen only this already-complete node so the transfer handler, rather than the shared
    // completed-node guard, receives the overdraw request.
    const overdraw = performRuntimeAction(definition, atReopened(definition, "fill-color-depth-unknown-action", state), {
      actionId: "fill-color-depth-unknown-action", verb: "transfer", value: 999,
    });
    expect(overdraw.completedNodes).not.toContain(overdraw.currentNodeId);
    expect(overdraw.attemptHistory.at(-1)).toMatchObject({
      actionId: "fill-color-depth-unknown-action",
      success: false,
    });
    expect(instanceOf(overdraw, "unknown-sample-tube")?.contents.volumeMl).toBeCloseTo(4, 6);

    const technique = loadTechnique();
    const byId = new Map(technique.actions.map((entry) => [entry.id, entry]));
    expect(byId.get("fill-color-depth-unknown-action")?.atomId).toBe("atom.transfer.fill-color-depth-pair");
    expect(byId.get("fill-color-depth-standard-action")?.atomId).toBe("atom.transfer.fill-color-depth-pair");
    expect(byId.get("visual-match-action")?.atomId).toBe("atom.transfer.adjust-color-depth-standard");
  });

  it("accumulates every collected portion in the treatment beaker and accounts for both comparison aliquots", async () => {
    const definition = await compileBrass();
    // Labelled isolated handler state: the eight tubes are staged with the residual volumes the
    // measurement and comparison steps would have left. Not a claim of learner traversal.
    const base = createRuntimeState(definition);
    const tubes = [
      ["standard-0p0250-tube", "collect-0p0250-waste-action", 3],
      ["standard-0p0500-tube", "collect-0p0500-waste-action", 3],
      ["standard-0p100-tube", "collect-0p100-waste-action", 3],
      ["standard-0p200-tube", "collect-0p200-waste-action", 3],
      ["standard-0p400-tube", "collect-0p400-waste-action", 3],
      ["unknown-sample-tube", "collect-unknown-waste-action", 3],
      ["color-depth-unknown-tube", "collect-color-depth-unknown-waste-action", 8],
      ["color-depth-standard-tube", "collect-color-depth-standard-waste-action", 5],
    ] as const;
    const staged: RuntimeState = {
      ...base,
      equipmentInstances: base.equipmentInstances.map((entry) => {
        const match = tubes.find(([instanceId]) => instanceId === entry.id);
        return match
          ? {
              ...entry,
              contents: stagedCopperSolution(`${entry.id} contents`, match[2]),
            }
          : entry;
      }),
    };

    let state = staged;
    let expectedVolumeMl = 0;
    for (const [instanceId, actionId, volumeMl] of tubes) {
      state = performRuntimeAction(definition, at(definition, actionId, state), { actionId, verb: "transfer" });
      expectedVolumeMl += volumeMl;
      // Each collection empties its own tube and adds to, never replaces, what is already there.
      expect(instanceOf(state, instanceId)?.contents.kind).toBe("empty");
      expect(instanceOf(state, "waste-beaker")?.contents.volumeMl).toBeCloseTo(expectedVolumeMl, 6);
    }
    expect(instanceOf(state, "waste-beaker")?.contents.solutes.length).toBe(tubes.length);

    // Nothing that ever received sample is left holding it.
    for (const [instanceId] of tubes) expect(instanceOf(state, instanceId)?.contents.kind).toBe("empty");
  });

  it("refuses the treated-waste handoff without both the treatment endpoint and the teacher destination", async () => {
    const definition = await compileBrass();
    // Labelled isolated handler state: the treatment beaker is staged as already neutralised, so
    // the case isolates the two approval gates. Not a claim of learner traversal.
    const base = createRuntimeState(definition);
    const treated: RuntimeState = {
      ...base,
      equipmentInstances: base.equipmentInstances.map((entry) =>
        entry.id === "waste-beaker"
          ? {
              ...entry,
              contents: stagedCopperSolution("Neutralised brass waste", 40),
            }
          : entry),
    };
    const tag = (state: RuntimeState, notebookTag: string): RuntimeState => ({
      ...state,
      notebook: [...state.notebook, {
        id: `staged-${notebookTag}`, timestamp: "2026-09-09T00:00:00.000Z", nodeId: "staged",
        type: "observation", label: notebookTag, value: notebookTag, tags: [notebookTag],
      }],
    });
    const attempt = (state: RuntimeState): RuntimeState =>
      performRuntimeAction(definition, at(definition, "transfer-treated-waste-to-destination-action", state), {
        actionId: "transfer-treated-waste-to-destination-action", verb: "transfer",
      });

    for (const partial of [treated, tag(treated, "waste-ph-within-range"), tag(treated, "teacher-disposal-gate")]) {
      const rejected = attempt(partial);
      expect(rejected.completedNodes).not.toContain(rejected.currentNodeId);
      expect(instanceOf(rejected, "teacher-designated-disposal-receiver")?.contents.kind).toBe("empty");
      expect(instanceOf(rejected, "waste-beaker")?.contents.volumeMl).toBeCloseTo(40, 6);
    }

    const approved = attempt(tag(tag(treated, "waste-ph-within-range"), "teacher-disposal-gate"));
    expect(instanceOf(approved, "teacher-designated-disposal-receiver")?.contents.volumeMl).toBeCloseTo(40, 6);
    expect(instanceOf(approved, "waste-beaker")?.contents.kind).toBe("empty");
  });

  it("keeps waste-pH recording in the composed technique before the authored 5-9 disposition choice", async () => {
    const definition = await compileBrass();
    const record = definition.actions.find((action) => action.id === "record-waste-ph-action");
    const classify = definition.actions.find((action) => action.id === "classify-waste-ph-action");
    expect(record?.parameters).toMatchObject({ inputMin: 0, inputMax: 14, measurementId: "neutralized-waste-ph" });
    expect(classify?.choiceObservation?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ tag: "brass-spectrophotometry--ph-retreat-required", value: 0 }),
      expect.objectContaining({ tag: "brass-spectrophotometry--ph-within-source-range", value: 1 }),
    ]));

    const base = createRuntimeState(definition);
    const afterBubblingObservation: RuntimeState = {
      ...base,
      attemptHistory: [...base.attemptHistory, {
        id: "staged-bubbling-observation",
        timestamp: "2026-09-09T00:00:00.000Z",
        nodeId: "staged",
        actionId: "observe-waste-bubbling-action",
        verb: "observe",
        mode: base.mode,
        evidenceScopeId: base.evidenceScopeId,
        evidenceScopeGeneration: base.evidenceScopeGeneration,
        success: true,
        message: "staged bubbling observation",
      }],
    };
    const recorded = performRuntimeAction(
      definition,
      at(definition, "record-waste-ph-action", afterBubblingObservation),
      { actionId: "record-waste-ph-action", verb: "observe", value: 4 },
    );
    expect(recorded.measurements.find((measurement) => measurement.id === "neutralized-waste-ph"))
      .toMatchObject({ value: 4, unit: "pH" });
  });

  it("keeps every repaired action's required roles bound and leaves the calibration order and pin intact", async () => {
    const technique = loadTechnique();
    const compiled = await compileBrass();
    const repaired = [
      "configure-brass-sample-inventory-action",
      "load-brass-onto-weighing-support-action",
      "weigh-brass-action",
      "place-brass-in-beaker-action",
      "confirm-diluted-digest-material-action",
      "fill-color-depth-unknown-action",
      "fill-color-depth-standard-action",
      "collect-0p0250-waste-action",
      "collect-0p0500-waste-action",
      "collect-0p100-waste-action",
      "collect-0p200-waste-action",
      "collect-0p400-waste-action",
      "collect-unknown-waste-action",
      "collect-color-depth-unknown-waste-action",
      "collect-color-depth-standard-waste-action",
      "transfer-treated-waste-to-destination-action",
    ];
    const directObservationActions = new Set(["weigh-brass-action"]);
    const byId = new Map(technique.actions.map((entry) => [entry.id, entry]));
    for (const id of repaired) {
      const action = byId.get(id);
      expect(action, id).toBeDefined();
      expect(action?.atomId, id).toBeTruthy();
      expect(missingRoleBindings(action!.atomId!, action!.equipmentRoleBindings), id).toEqual([]);
      for (const [roleId, definitionId] of Object.entries(action!.equipmentRoleBindings ?? {})) {
        expect(roleAcceptsEquipment(roleId, definitionId), `${id} ${roleId} -> ${definitionId}`).toBe(true);
      }
      const derived = deriveActionEffectContract(action!);
      expect(derived.errors, id).toEqual([]);
      if (directObservationActions.has(id)) {
        expect(derived.contract?.classes, id).toEqual(["measurement-direct-observation-acquisition"]);
      } else {
        expect(derived.contract?.classes, id).toContain("apparatus-material-instrument-state");
      }
    }

    // The tare is a balance-display observation. It does not move material or instrument state,
    // so its direct-observation contract is intentionally distinct from the repaired operations.
    const tare = byId.get("tare-empty-beaker-action");
    const tareContract = tare ? deriveActionEffectContract(tare) : undefined;
    expect(tare).toBeDefined();
    expect(tareContract?.errors).toEqual([]);
    expect(tareContract?.contract?.classes).toEqual(["measurement-direct-observation-acquisition"]);
    expect(tareContract?.contract?.classes).not.toContain("apparatus-material-instrument-state");

    // Preserved public identities survive the repair.
    for (const id of ["tare-empty-beaker-action", "weigh-brass-action", "place-brass-in-beaker-action"]) {
      expect(compiled.actions.some((entry) => entry.id === id), id).toBe(true);
    }
    expect(compiled.actions.some((entry) => entry.id === "brass-mass-recorded-g")).toBe(false);
    expect(technique.metadata.version).toBe("2.0.0");

    // The scan retains its own blank observations at each wavelength; its sample reads do not
    // borrow a calibration atom.
    const scanActions = technique.actions.filter((entry) => entry.id.startsWith("scan-"));
    expect(scanActions.length).toBeGreaterThan(100);
    const scanBlankActions = scanActions.filter((entry) => /^scan-blank-\d+-action$/.test(entry.id));
    expect(scanBlankActions).toHaveLength(16);
    expect(scanBlankActions.every((entry) => entry.atomId === "atom.observe.blank-photometer")).toBe(true);
    for (const entry of scanActions.filter((entry) => !scanBlankActions.includes(entry))) {
      expect(entry.atomId).not.toBe("atom.observe.dark-zero-photometer");
      expect(entry.atomId).not.toBe("atom.observe.blank-photometer");
    }
    const nodeOf = (actionId: string) => compiled.process.nodes.find((node) => node.actionId === actionId)?.id;
    expect(compiled.process.edges).toContainEqual(expect.objectContaining({
      from: nodeOf("calibrate-zero-percent-t-action"), to: nodeOf("prepare-blank-action"),
    }));
  });
});
