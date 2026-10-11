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
 * Pack 3's 3D practice versions (decided 2026-10-10, PACK3_ATOMIZATION.md), on `pack2Practice.test.ts`'s pattern: each
 * is listed only in the 3D practice list with `pack: 3`, validates and passes the catalogue policy, and plays to
 * completion through the process control.
 */
const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const listed = read("public/techniques-3d/index.json") as Array<{ id: string; file: string; basedOn: string; pack: number }>;
const practiceIndex = listed.filter((entry) => entry.pack === 3);
const catalogue = read("public/techniques/index.json") as Array<{ id: string }>;

/** Each practice version's setup, the student's entries, and the items moved to the bench before a step. */
const PLAYS: Record<string, { config: Record<string, string>; inputs?: Record<string, string>; moves?: Record<string, string> }> = {
  "paper-chromatography-practice": { config: {} },
  "hard-water-calculation-practice": {
    config: { sampleVolumeMl: "20", watchGlassMassG: "30", paperMassG: "0.553", combinedMassG: "30.5605", calculationTolerance: "0.5" },
    inputs: { "calculate-hardness": "375" },
  },
};

type Play = (typeof PLAYS)[string];

const load = (id: string, play: Play = PLAYS[id]): TechniqueDefinition =>
  applyTechniqueConfiguration(read(`public/techniques-3d/${practiceIndex.find((entry) => entry.id === id)!.file}`) as TechniqueDefinition, play.config);

const errorAdded = (before: RuntimeState, after: RuntimeState) =>
  after.feedbackQueue.slice(before.feedbackQueue.length).find((entry) => entry.severity === "error");

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

describe("Pack 3 3D practice versions", () => {
  it("lists Pack 3's practice versions after Pack 2's, none of them in the 2D catalogue", () => {
    expect(practiceIndex.map((entry) => entry.id)).toEqual(Object.keys(PLAYS));
    expect(listed.findIndex((entry) => entry.pack === 3)).toBeGreaterThan(listed.map((entry) => entry.pack).lastIndexOf(2));
    for (const entry of practiceIndex) {
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
});

describe("Calculate Hardness", () => {
  const id = "hard-water-calculation-practice";

  it("is six steps: four noted values, the mass by difference, and the student's hardness", () => {
    const technique = load(id);
    expect(technique.process.nodes.map((node) => node.actionId)).toEqual(["note-sample-volume", "note-watch-glass-mass", "note-paper-mass",
      "note-combined-mass", "precipitate-by-difference", "calculate-hardness"]);
    const hardness = technique.actions.find((action) => action.id === "calculate-hardness")!;
    expect(hardness.parameters).toMatchObject({ calculationId: "hardness-mg-l", template: "hardnessMgLAsCaCO3", requireStudentValue: true,
      sampleVolumeMeasurementId: "sample-volume", precipitateMassCalculationId: "precipitate-mass", tolerance: 0.5 });
    expect(technique.successCriteria).toEqual([expect.objectContaining({ type: "calculationWithinTolerance", calculationId: "hardness-mg-l" })]);
  });

  it("asks the teacher only for the classroom values, never the record names", () => {
    const raw = read(`public/techniques-3d/${id}.json`) as TechniqueDefinition;
    const technique = applyTechniqueConfiguration(raw, {});
    expect(technique.actions.find((action) => action.id === "calculate-hardness")!.parameters.precipitateMassCalculationId).toBe("precipitate-mass");
  });

  it("works out 375 mg/L from 0.0075 g in 20 mL", () => {
    const { state } = playTo(id);
    expect(state.calculations.find((entry) => entry.id === "precipitate-mass")?.value).toBeCloseTo(0.0075, 6);
    expect(state.calculations.find((entry) => entry.id === "hardness-mg-l")).toMatchObject({ value: 375, passed: true, unit: "mg/L as CaCO3" });
  });

  it("requires the student's hardness, refuses one off by more than 0.5 mg/L, and takes the corrected one", () => {
    const played = playTo(id, "calculate-hardness");
    expect(attempt(played.technique, played.state, id, { ...PLAYS[id], inputs: {} }).refusal).toBeDefined();
    const wrong = attempt(played.technique, played.state, id, { ...PLAYS[id], inputs: { "calculate-hardness": "375.6" } }).state;
    expect(wrong.calculations.find((entry) => entry.id === "hardness-mg-l")?.passed).toBe(false);
    expect(wrong.completedNodes).toHaveLength(5);
    const corrected = attempt(played.technique, wrong, id, { ...PLAYS[id], inputs: { "calculate-hardness": "375.4" } }).state;
    expect(corrected.calculations.find((entry) => entry.id === "hardness-mg-l")?.passed).toBe(true);
    expect(corrected.completedNodes).toHaveLength(6);
  });

  it("follows the teacher's values: 0.0150 g in 25 mL is 600 mg/L", () => {
    const play = { config: { ...PLAYS[id].config, sampleVolumeMl: "25", combinedMassG: "30.5680" }, inputs: { "calculate-hardness": "600" } };
    const { state } = playTo(id, undefined, play);
    expect(state.calculations.find((entry) => entry.id === "hardness-mg-l")?.expected).toBeCloseTo(600, 6);
  });
});
