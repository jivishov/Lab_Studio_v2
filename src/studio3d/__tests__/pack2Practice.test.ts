import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assessBundledTechniqueCatalogPolicy } from "../../data/bundledCatalogPolicyBoundary";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { resolveActionInteraction } from "../../domain/interactions";
import type { RuntimeState, TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { resolveActionInput } from "../../runtime/actionInputs";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { benchMoveRequest, intentTypeForInteraction, mergeActionInput } from "../adapters/sceneToIntent";

/**
 * Pack 2's 3D practice versions (decided 2026-10-05, PACK2_ATOMIZATION.md): each is listed only in the
 * 3D practice list, validates and passes the catalogue policy, and plays to completion through the
 * process control with the free moves a student makes; the Heat and Reweigh burner refuses what a lab
 * refuses. Written; run with the suite.
 */
const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const practiceIndex = read("public/techniques-3d/index.json") as Array<{ id: string; file: string; basedOn: string; pack: number }>;
const catalogue = read("public/techniques/index.json") as Array<{ id: string }>;

/** Each practice version's setup, the student's entries, and the items moved to the bench before a step. */
const PLAYS: Record<string, { config: Record<string, string>; inputs?: Record<string, string>; moves?: Record<string, string> }> = {
  "transfer-practice": { config: { transferObservation: "The cylinder drained into the beaker." } },
  "hard-water-precipitation-practice": {
    config: { reagentVolumeMl: "15", precipitateMassG: "0.15", precipitateObservation: "A white precipitate formed.", completenessObservation: "No new cloudiness." },
  },
  "filtration-practice": {
    config: { precipitateMassG: "0.15", paperMassG: "0.552" },
    inputs: { "weigh-paper": "0.552" },
    moves: { "fold-paper": "filter-paper-1" },
  },
  "drying-practice": {
    config: { precipitateMassG: "0.15", paperMassG: "0.552", watchGlassMassG: "30", firstDryingMinutes: "12" },
    inputs: { "weigh-glass": "30.000", "set-oven": "115", "weigh-combined": "30.702" },
    moves: { "paper-onto-glass": "watch-glass-1", "first-to-pad": "crucible-tongs-1", "break-up": "scoopula-1" },
  },
  "thermal-decomposition-mass-loss-practice": {
    config: {},
    inputs: { "read-empty-crucible": "25.000", "read-loaded-crucible": "27.000", "read-first-cycle": "26.557", "read-final": "26.557", "calculate-composition": "0.443" },
    moves: { "first-to-pad": "crucible-tongs-1" },
  },
};

type Play = (typeof PLAYS)[string];

const load = (id: string, play: Play = PLAYS[id]): TechniqueDefinition =>
  applyTechniqueConfiguration(read(`public/techniques-3d/${practiceIndex.find((entry) => entry.id === id)!.file}`) as TechniqueDefinition, play.config);

const errorAdded = (before: RuntimeState, after: RuntimeState) =>
  after.feedbackQueue.slice(before.feedbackQueue.length).find((entry) => entry.severity === "error");

/** One attempt at the current step through the process control; returns the state and any refusal. */
const attempt = (technique: TechniqueDefinition, state: RuntimeState, id: string, play: Play = PLAYS[id]) => {
  const action = technique.actions.find((candidate) => candidate.id === technique.process.nodes.find((n) => n.id === state.currentNodeId)!.actionId)!;
  const interaction = resolveActionInteraction(action)!;
  const intent = mergeActionInput({ origin: "keyboard", type: intentTypeForInteraction[interaction.type] } as RuntimeInteractionIntent,
    resolveActionInput(action, play.inputs?.[action.id] ?? ""), action);
  const resolved = resolveInteractionIntent(technique, state, intent);
  if (!resolved.ok) return { state, refusal: resolved.feedback.message };
  const next = performRuntimeAction(technique, state, resolved.request);
  return { state: next, refusal: errorAdded(state, next)?.message };
};

/** Plays the technique up to (not including) the node of `stopBefore`, or to its end. */
const playTo = (id: string, stopBefore?: string, play: Play = PLAYS[id]): { technique: TechniqueDefinition; state: RuntimeState } => {
  const technique = load(id, play);
  let state = createRuntimeState(technique);
  for (const node of technique.process.nodes) {
    if (node.actionId === stopBefore) break;
    const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
    const moved = play.moves?.[action.id];
    if (moved) state = performRuntimeAction(technique, state, benchMoveRequest(moved, { x: 300, y: 380 }, 50));
    for (let i = 0; i < 40 && !state.completedNodes.includes(node.id); i += 1) {
      const result = attempt(technique, state, id, play);
      if (result.refusal) throw new Error(`${id} ${node.id}: ${result.refusal}`);
      state = result.state;
    }
    expect(state.completedNodes, `${id} ${node.id}`).toContain(node.id);
  }
  return { technique, state };
};

describe("Pack 2 3D practice versions", () => {
  it("lists five practice versions, none of them in the 2D catalogue", () => {
    expect(practiceIndex.map((entry) => entry.id)).toEqual(Object.keys(PLAYS));
    for (const entry of practiceIndex) {
      expect(entry.pack).toBe(2);
      expect(catalogue.some((technique) => technique.id === entry.id)).toBe(false);
      expect(catalogue.some((technique) => technique.id === entry.basedOn)).toBe(true);
    }
  });

  it.each(Object.keys(PLAYS))("%s validates and passes the catalogue policy", async (id) => {
    const raw = read(`public/techniques-3d/${id}.json`);
    expect(validateTechniqueDefinition(raw).errors ?? []).toEqual([]);
    await expect(assessBundledTechniqueCatalogPolicy("public-bundle", `public/techniques-3d/${id}.json`, raw)).resolves.toBeDefined();
    expect(validateTechniqueDefinition(load(id)).ok).toBe(true);
  });

  it.each(Object.keys(PLAYS))("%s plays to completion", (id) => {
    const { technique, state } = playTo(id);
    expect(state.completedNodes).toHaveLength(technique.process.nodes.length);
  });

  it("Heat and Reweigh works out the configured composition from the recorded masses", () => {
    const { state } = playTo("thermal-decomposition-mass-loss-practice");
    const value = (calculationId: string) => state.calculations.find((entry) => entry.id === calculationId)?.value;
    expect(value("composition-analysis")).toBeCloseTo(0.443, 3);
    expect(value("composition-analysis-nahco3-percent")).toBeCloseTo(60, 0);
  });

  it("Filter a Precipitate pours the last portion exactly, at a mixture volume that leaves float noise (54.05 mL)", () => {
    // The decanted portions leave 6.049999999999997 mL; the last portion used to round to 6.05 mL and throw.
    const play = { ...PLAYS["filtration-practice"], config: { mixtureVolumeMl: "54.05", precipitateMassG: "0.0075", paperMassG: "0.912" },
      inputs: { "weigh-paper": "0.912" } };
    const { technique, state } = playTo("filtration-practice", undefined, play);
    expect(state.completedNodes).toHaveLength(technique.process.nodes.length);
    const byId = (id: string) => state.equipmentInstances.find((instance) => instance.id === id)!;
    expect(byId("filter-paper-1").contents.precipitate?.massG).toBeCloseTo(0.0075, 6);
    expect(byId("erlenmeyer-flask-250ml-1").contents.volumeMl).toBeCloseTo(54.05 + 18, 6);
  });

  it("Precipitation rinses the rod back into the beaker, losing none of the precipitate", () => {
    const { state } = playTo("hard-water-precipitation-practice", "remove-stirring-rod");
    const byId = (id: string) => state.equipmentInstances.find((instance) => instance.id === id)!;
    expect(byId("beaker-250ml-1").contents.precipitate?.massG).toBeCloseTo(0.15, 6);
    expect(byId("stirring-rod-1").contents.wetState).toBe("rinsed");
  });

  it("each weighing practice zeros the empty balance before its first weighing", () => {
    for (const id of ["filtration-practice", "drying-practice", "thermal-decomposition-mass-loss-practice"]) {
      const technique = load(id);
      const order = technique.process.nodes.map((node) => technique.actions.find((candidate) => candidate.id === node.actionId)!);
      const zero = order.findIndex((action) => action.atomId === "atom.observe.zero-empty-balance");
      const firstWeighing = order.findIndex((action) => action.verb === "weigh");
      expect(zero, id).toBeGreaterThanOrEqual(0);
      expect(zero, id).toBeLessThan(firstWeighing);
      expect(order[zero].parameters.sourceInstanceId, id).toBeUndefined();
    }
  });

  it("Dry and Weigh keeps the oven door shut while the solid is broken up and while it cools", () => {
    const breakUp = playTo("drying-practice", "break-up").state;
    expect(breakUp.apparatusStates?.["drying-oven-1"]?.door).toBe("closed");
    const cooling = playTo("drying-practice", "cool").state;
    expect(cooling.apparatusStates?.["drying-oven-1"]?.door).toBe("closed");
  });

  it("Heat and Reweigh returns the left-over mixture to Unused Sample, apart from the product (EX-08, S-07)", () => {
    const { state } = playTo("thermal-decomposition-mass-loss-practice");
    const byId = (id: string) => state.equipmentInstances.find((instance) => instance.id === id)!;
    expect(byId("working-sample-portion-1").contents.kind).toBe("empty");
    expect(byId("unused-sample-recovery-1").contents.massG).toBeCloseTo(0.5, 6);
    expect(byId("heated-product-recovery-1").contents.massG).toBeCloseTo(1.557, 6);
  });
});

describe("Heat and Reweigh's burner and crucible", () => {
  const id = "thermal-decomposition-mass-loss-practice";
  const patch = (state: RuntimeState, instanceId: string, values: Record<string, string | boolean>): RuntimeState =>
    ({ ...state, apparatusStates: { ...state.apparatusStates, [instanceId]: { ...state.apparatusStates?.[instanceId], ...values } } });

  it("records the burner lit yellow, then blue, then off", () => {
    const { state } = playTo(id, "warm-gently");
    expect(state.apparatusStates?.["bunsen-burner-1"]).toMatchObject({ gas: "on", collar: "open", flame: "blue" });
    expect(state.apparatusStates?.["crucible-with-lid-1"]).toMatchObject({ lid: "askew" });
    const off = playTo(id, "first-to-pad").state;
    expect(off.apparatusStates?.["bunsen-burner-1"]).toMatchObject({ gas: "off", flame: "off" });
    expect(off.apparatusStates?.["crucible-with-lid-1"]).toMatchObject({ glow: false });
  });

  it("glows under strong heat and leaves the sodium carbonate residue", () => {
    const { state } = playTo(id, "turn-off-1");
    const crucible = state.equipmentInstances.find((instance) => instance.id === "crucible-with-lid-1")!;
    expect(state.apparatusStates?.["crucible-with-lid-1"]?.glow).toBe(true);
    expect(crucible.contents.massG).toBeCloseTo(1.557, 6);
    expect(crucible.contents.solutes).toEqual([{ id: "sodium-carbonate", label: "Sodium carbonate", amount: 1.557, unit: "g" }]);
  });

  it("refuses to light the burner with the lid not askew", () => {
    const { technique, state } = playTo(id, "light-burner-1");
    const result = attempt(technique, patch(state, "crucible-with-lid-1", { lid: "closed" }), id);
    expect(result.refusal).toBe("The crucible's lid is not askew.");
  });

  it("refuses to heat over a yellow flame", () => {
    const { technique, state } = playTo(id, "warm-gently");
    const result = attempt(technique, patch(state, "bunsen-burner-1", { flame: "yellow", collar: "nearly-closed" }), id);
    expect(result.refusal).toBe("The flame is still yellow.");
  });

  it("refuses to move the crucible off a lit burner and leaves it seated", () => {
    const { technique, state } = playTo(id, "first-to-pad");
    const lit = performRuntimeAction(technique, patch(state, "bunsen-burner-1", { flame: "blue" }),
      benchMoveRequest("crucible-tongs-1", { x: 300, y: 380 }, 50));
    const result = attempt(technique, lit, id);
    expect(result.refusal).toBe("The burner is still lit.");
    expect(result.state.attachments.some((relation) => relation.childInstanceId === "crucible-with-lid-1"
      && relation.zoneId === "ring-stand-crucible-seat")).toBe(true);
  });

  it("refuses a weighing on the other balance (EX-01) and leaves the crucible where it was", () => {
    const { technique, state } = playTo(id, "first-on-balance");
    const withB = performRuntimeAction(technique, state, benchMoveRequest("analytical-balance-b", { x: 600, y: 198 }, 50));
    const action = technique.actions.find((candidate) => candidate.id === "first-on-balance")!;
    const intent = mergeActionInput({ origin: "keyboard", type: intentTypeForInteraction[resolveActionInteraction(action)!.type],
      targetInstanceId: "analytical-balance-b" } as RuntimeInteractionIntent, resolveActionInput(action, ""), action);
    const resolved = resolveInteractionIntent(technique, withB, intent);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const next = performRuntimeAction(technique, withB, resolved.request);
    expect(errorAdded(withB, next)?.message).toBe("Every weighing in this run is made on balance A.");
    expect(next.attachments.some((relation) => relation.childInstanceId === "crucible-with-lid-1" && relation.parentInstanceId === "heat-safe-pad-1")).toBe(true);
  });

  it("refuses to take the hot crucible to the pad by hand", () => {
    const { technique, state } = playTo(id, "first-to-pad");
    const result = attempt(technique, state, id);
    expect(result.refusal).toBe("Use the crucible tongs.");
  });
});
