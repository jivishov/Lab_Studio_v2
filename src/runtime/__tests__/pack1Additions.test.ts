import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { deriveActionEffectContract } from "../../domain/atomRegistry";
import { resolveActionInteraction } from "../../domain/interactions";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { intentTypeForInteraction, mergeActionInput } from "../../studio3d/adapters/sceneToIntent";
import { actionInputField, resolveActionInput } from "../actionInputs";
import { createRuntimeState, performRuntimeAction } from "../index";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../interactionIntents";

/**
 * The last Pack 1 additions (decided 2026-10-05): Weigh a Solid's zero step has its own atom, and
 * transmittance-dilution's test tube is stoppered, inverted ten times and unstoppered before its
 * sample is drawn. Written, then run with the suite.
 */
const read = (id: string) => JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;

describe("Weigh a Solid's zero step", () => {
  const weighing = read("weighing");
  const zero = weighing.actions.find((action) => action.id === "zero-balance")!;

  it("is backed by atom.observe.zero-balance, which records evidence and acquires no reading", () => {
    expect(zero.atomId).toBe("atom.observe.zero-balance");
    expect(zero.equipmentRoleBindings).toEqual({ "balance-instrument": "analytical-balance", "weighed-vessel": "watch-glass" });
    const effect = deriveActionEffectContract(zero);
    expect(effect.errors).toEqual([]);
    expect(effect.contract?.classes).toEqual(["evidence-recording"]);
  });

  it("no longer needs a legacy effect", () => {
    expect(weighing.composition?.legacyActionEffects?.some((entry) => entry.actionId === "zero-balance")).toBe(false);
  });
});

describe("transmittance-dilution's test tube is stoppered, inverted and opened", () => {
  const technique = applyTechniqueConfiguration(read("transmittance-dilution"), {
    stockConcentrationM: "0.2", wavelengthNm: "630", stockAliquotVolumeMl: "5", waterVolumeMl: "10", finalVolumeMl: "15", samplePercentTransmittance: "42.5",
  });
  const send = (state: RuntimeState, type: string): RuntimeState => {
    const result = resolveInteractionIntent(technique, state, { type, origin: "keyboard" } as RuntimeInteractionIntent);
    if (!result.ok) throw new Error(result.feedback.message);
    return performRuntimeAction(technique, state, result.request);
  };
  /** Each step as the 3D Confirm path sends it, with the value a student would type where one is asked. */
  const playTo = (actionId: string): RuntimeState => {
    let state = createRuntimeState(technique);
    for (const node of technique.process.nodes) {
      if (node.actionId === actionId) return state;
      const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
      const interaction = resolveActionInteraction(action)!;
      const field = actionInputField(action);
      const typed = !field ? "" : field.mode === "choice" ? field.options?.[0] ?? "" : field.mode === "numeric"
        ? (/ransmittance/.test(field.label) ? "42.5" : "630") : "Held by the frosted faces; clear faces in the light path.";
      const intent = mergeActionInput({ type: intentTypeForInteraction[interaction.type], origin: "keyboard" } as RuntimeInteractionIntent,
        resolveActionInput(action, typed), action);
      const times = action.parameters.mixOperation === "invert" ? Number(action.parameters.inversions) : 1;
      for (let i = 0; i < times; i += 1) {
        const result = resolveInteractionIntent(technique, state, intent);
        if (!result.ok) throw new Error(`${node.id}: ${result.feedback.message}`);
        state = performRuntimeAction(technique, state, result.request);
      }
    }
    return state;
  };
  const stopper = (state: RuntimeState) => state.attachments.find((a) => a.childInstanceId === "rubber-stopper-set-1");

  it("validates, with the three steps between the water and the photometer", () => {
    expect(validateTechniqueDefinition(technique).errors ?? []).toEqual([]);
    const order = technique.process.nodes.map((node) => node.actionId);
    const at = order.indexOf("transmittance-dilution-add-water-below-mark");
    expect(order.slice(at + 1, at + 4)).toEqual([
      "transmittance-dilution-stopper-test-tube", "transmittance-dilution-invert-test-tube", "transmittance-dilution-remove-test-tube-stopper",
    ]);
  });

  it("seats the stopper in the test tube's stopper seat", () => {
    const state = send(playTo("transmittance-dilution-stopper-test-tube"), "snapIntent");
    expect(stopper(state)).toMatchObject({ parentInstanceId: "prepared-receiver-1", zoneId: "test-tube-stopper-seat" });
  });

  it("refuses to invert without the stopper, and mixes after ten inversions", () => {
    const atInvert = playTo("transmittance-dilution-invert-test-tube");
    const unstoppered = { ...atInvert, attachments: atInvert.attachments.filter((a) => a.childInstanceId !== "rubber-stopper-set-1") };
    const refused = resolveInteractionIntent(technique, unstoppered, { type: "notebookRecordIntent", origin: "keyboard" } as RuntimeInteractionIntent);
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.feedback.message).toMatch(/stopper is not seated/i);
    let state = atInvert;
    for (let i = 0; i < 9; i += 1) state = send(state, "notebookRecordIntent");
    expect(state.currentNodeId).toBe("transmittance-dilution-invert-test-tube-node");
    state = send(state, "notebookRecordIntent");
    expect(state.notebook.at(-1)?.tags).toContain("test-tube-mixed-by-inversion");
    expect(state.currentNodeId).toBe("transmittance-dilution-remove-test-tube-stopper-node");
  });

  it("takes the stopper out before the sample is drawn, and the run completes", () => {
    const opened = send(playTo("transmittance-dilution-remove-test-tube-stopper"), "placeIntent");
    expect(stopper(opened)).toBeUndefined();
    const done = playTo("never");
    expect(done.completedNodes).toHaveLength(technique.process.nodes.length);
  });
});

describe("rinsePortions is checked", () => {
  const solution = read("making-solution");
  const withRinse = (portions: unknown, actionId = "rinse-boat-into-funnel"): TechniqueDefinition => ({
    ...solution,
    actions: solution.actions.map((action) => (action.id === actionId ? { ...action, parameters: { ...action.parameters, rinsePortions: portions as number } } : action)),
  });

  it("as a whole number from 1 to 10", () => {
    expect(validateTechniqueDefinition(withRinse(2.5)).errors?.join(" ")).toContain("rinsePortions must be a whole number from 1 to 10");
    expect(validateTechniqueDefinition(withRinse(12)).errors?.join(" ")).toContain("rinsePortions must be a whole number from 1 to 10");
  });

  it("on rinse actions only", () => {
    expect(validateTechniqueDefinition(withRinse(3, "swirl-to-dissolve")).errors?.join(" ")).toContain("rinsePortions is legal only on rinse actions");
  });
});
