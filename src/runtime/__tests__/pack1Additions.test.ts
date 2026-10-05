import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { deriveActionEffectContract } from "../../domain/atomRegistry";
import { resolveActionInteraction } from "../../domain/interactions";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { validateActionAttachmentState } from "../attachments";
import { seatNeededLater } from "../../studio3d/player/stepRules";
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

  it("validates, stoppering and inverting after the water and unstoppering just before the sample is drawn", () => {
    expect(validateTechniqueDefinition(technique).errors ?? []).toEqual([]);
    const order = technique.process.nodes.map((node) => node.actionId);
    const at = order.indexOf("transmittance-dilution-add-water-below-mark");
    expect(order.slice(at + 1, at + 3)).toEqual(["transmittance-dilution-stopper-test-tube", "transmittance-dilution-invert-test-tube"]);
    expect(order[order.indexOf("transmittance-dilution-draw-sample-into-pipette") - 1]).toBe("transmittance-dilution-remove-test-tube-stopper");
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
    expect(state.currentNodeId).toBe("transmittance-dilution-place-spectrophotometer-node");
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

describe("fidelity review of the Pack 1 finish (2026-10-05)", () => {
  const solution = read("making-solution");
  const swap = (definition: TechniqueDefinition, actionId: string, change: (p: Record<string, unknown>) => Record<string, unknown>): TechniqueDefinition => ({
    ...definition,
    actions: definition.actions.map((action) => (action.id === actionId ? { ...action, parameters: change({ ...action.parameters }) as typeof action.parameters } : action)),
  });
  const errorsOf = (definition: TechniqueDefinition) => (validateTechniqueDefinition(definition).errors ?? []).join(" ");

  it("checks the stopper on the named tube, not the first tube in the lab", () => {
    const tube = (id: string) => ({ id, definitionId: "test-tube", label: id, location: "workbench", contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } });
    const stopper = { ...tube("stopper-1"), definitionId: "rubber-stopper-set" };
    const state = {
      equipmentInstances: [tube("other-tube"), tube("receiver"), stopper],
      attachments: [{ id: "a", parentInstanceId: "receiver", childInstanceId: "stopper-1", zoneId: "test-tube-stopper-seat" }],
    } as unknown as Parameters<typeof validateActionAttachmentState>[0];
    const gate = {
      requiredAttachmentState: "attached", attachmentParentDefinitionId: "test-tube", attachmentChildDefinitionId: "rubber-stopper-set",
      attachmentSnapZoneId: "test-tube-stopper-seat",
    };
    expect(validateActionAttachmentState(state, gate)).toBeDefined();
    expect(validateActionAttachmentState(state, { ...gate, attachmentParentInstanceId: "receiver", attachmentChildInstanceId: "stopper-1" })).toBeUndefined();
  });

  it("requires a counted step to be judged on its own unique tag", () => {
    expect(errorsOf(swap(solution, "rinse-boat-into-funnel", ({ tag: _tag, ...p }) => p))).toContain("needs parameters.tag");
    expect(errorsOf(swap(solution, "rinse-boat-into-funnel", (p) => ({ ...p, tag: "funnel-rinsed-into-flask" })))).toContain("must be unique");
    const byEvidence = {
      ...solution,
      process: { ...solution.process, nodes: solution.process.nodes.map((node) => (node.actionId === "invert-to-mix"
        ? { ...node, validation: [{ id: "x", type: "actionEvidence", label: "x", actionId: "invert-to-mix" }] } : node)) },
    } as TechniqueDefinition;
    expect(errorsOf(byEvidence)).toContain("not the action's evidence");
    expect(errorsOf(solution)).not.toContain("count of requests");
  });

  it("keeps the step's own squirt count, whatever a request carries", () => {
    const technique = applyTechniqueConfiguration(solution, { soluteMassG: "2.5", solutionObservation: "Clear" });
    let state = createRuntimeState(technique);
    for (const node of technique.process.nodes) {
      if (node.actionId === "rinse-boat-into-funnel") break;
      const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
      const types: Record<string, string> = { dragToZone: "placeIntent", snapIntoTarget: "snapIntent", pourInto: "pourIntent" };
      const result = resolveInteractionIntent(technique, state, { type: types[resolveActionInteraction(action)!.type], origin: "keyboard" } as RuntimeInteractionIntent);
      if (!result.ok) throw new Error(result.feedback.message);
      state = performRuntimeAction(technique, state, result.request);
    }
    const result = resolveInteractionIntent(technique, state, { type: "rinseIntent", origin: "keyboard" } as RuntimeInteractionIntent);
    if (!result.ok) throw new Error(result.feedback.message);
    const after = performRuntimeAction(technique, state, { ...result.request, parameters: { ...result.request.parameters, rinsePortions: 1 } });
    expect(after.currentNodeId).toBe("rinse-boat-into-funnel-node");
    expect(after.rinsePortions?.["rinse-boat-into-funnel"]).toBe(1);
  });

  it("refuses a dilution that would leave no air in the stoppered tube", () => {
    expect(() => applyTechniqueConfiguration(read("transmittance-dilution"), {
      stockConcentrationM: "0.2", wavelengthNm: "630", stockAliquotVolumeMl: "5", waterVolumeMl: "13", finalVolumeMl: "18", samplePercentTransmittance: "42.5",
    })).toThrow(/at most 15 mL/);
  });
});

describe("a seated part a step still needs stays seated (fidelity review, 2026-10-05)", () => {
  const technique = read("transmittance-dilution");
  const stopper = { instanceId: "rubber-stopper-set-1", definitionId: "rubber-stopper-set" };
  const tube = { instanceId: "prepared-receiver-1", definitionId: "test-tube" };
  const nodeOf = (actionId: string) => technique.process.nodes.find((node) => node.actionId === actionId)!.id;
  const actionOf = (id: string) => technique.actions.find((action) => action.id === `transmittance-dilution-${id}`);
  const doneThrough = (actionId: string) => {
    const ids = technique.process.nodes.map((node) => node.id);
    return ids.slice(0, ids.indexOf(nodeOf(`transmittance-dilution-${actionId}`)) + 1);
  };
  const needed = (done: string[], current?: string) =>
    seatNeededLater(technique.actions, technique.process.nodes, done, current ? actionOf(current) : undefined, stopper, tube, "test-tube-stopper-seat");

  it("keeps the stopper in from stoppering until the step that takes it out", () => {
    expect(needed(doneThrough("stopper-test-tube"), "invert-test-tube")).toBe(true);
    expect(needed(doneThrough("invert-test-tube"), "place-spectrophotometer")).toBe(true);
  });

  it("lets the removal step lift it, and anything after", () => {
    expect(needed(doneThrough("remove-blank-cuvette"), "remove-test-tube-stopper")).toBe(false);
    expect(needed(doneThrough("remove-test-tube-stopper"), "draw-sample-into-pipette")).toBe(false);
  });
});
