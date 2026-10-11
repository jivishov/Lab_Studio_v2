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
import { runtimeToScene } from "../adapters/runtimeToScene";
import { benchMoveRequest, intentTypeForInteraction, mergeActionInput } from "../adapters/sceneToIntent";
import { stepFlow } from "../player/stepRules";

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
  "paper-chromatography-practice": {
    config: {},
    inputs: { "identify-bands": "Purple overlap, then yellow", "read-front": "80", "read-purple-overlap": "59", "read-yellow": "66",
      "record-quality": "Overlapping" },
  },
  "hard-water-calculation-practice": {
    config: { sampleVolumeMl: "20", watchGlassMassG: "30", paperMassG: "0.553", combinedMassG: "30.5605", calculationTolerance: "0.5" },
    inputs: { "calculate-hardness": "375" },
  },
};

type Play = (typeof PLAYS)[string];

/** A practice version, or a twin by its id (Paper Chromatography's 2-propanol trial has no practice version). */
const load = (id: string, play: Play = PLAYS[id]): TechniqueDefinition =>
  applyTechniqueConfiguration(read(`public/techniques-3d/${practiceIndex.find((entry) => entry.id === id)?.file ?? `${id}.json`}`) as TechniqueDefinition,
    play.config);

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

describe("Paper Chromatography", () => {
  const id = "paper-chromatography-practice";
  const propanol: Play = {
    config: {},
    inputs: { "identify-bands": "Blue, red, yellow", "read-front": "80", "read-blue": "28", "read-red": "49", "read-yellow": "68",
      "record-quality": "Resolved" },
  };
  const steps = (technique: TechniqueDefinition) => technique.process.nodes.map((node) => node.actionId);
  const shared = ["place-chamber", "label-chamber", "measure-solvent", "charge-chamber", "place-paper", "draw-baseline", "load-capillary",
    "spot-1", "dry-spot-1", "spot-2", "dry-spot-2", "spot-3", "dry-spot-3", "hang-strip", "close-chamber", "develop", "open-chamber",
    "remove-strip", "mark-front", "dry-strip", "identify-bands", "place-ruler", "read-front", "record-front"];

  it("is 31 steps for water and 33 for 2-propanol: place then label, spotting as six, the lid and the hook as two", () => {
    expect(steps(load(id))).toEqual([...shared, "read-purple-overlap", "record-purple-overlap", "read-yellow", "record-yellow",
      "calculate-rf", "record-quality", "dispose-solvent"]);
    expect(steps(load("paper-chromatography-propanol-3d", propanol))).toEqual([...shared, "read-blue", "record-blue", "read-red", "record-red",
      "read-yellow", "record-yellow", "calculate-rf", "record-quality", "dispose-solvent"]);
    expect(steps(load("paper-chromatography-water-3d", PLAYS[id]))).toEqual(steps(load(id)));
  });

  it("adds no bench operation, and the new tape-label atom is used by no 2D technique", () => {
    for (const technique of [load(id), load("paper-chromatography-propanol-3d", propanol)]) {
      expect(technique.actions.filter((action) => action.parameters.benchOperation !== undefined)).toEqual([]);
      expect(technique.actions.find((action) => action.id === "label-chamber")!.atomId).toBe("atom.observe.label-developing-chamber");
    }
    for (const entry of catalogue) {
      expect(JSON.stringify(read(`public/techniques/${entry.id}.json`))).not.toContain("atom.observe.label-developing-chamber");
    }
  });

  it("works each Rf from the student's recorded readings", () => {
    const { state } = playTo(id);
    expect(state.calculations.find((entry) => entry.id === "water-rf-purple-overlap")).toMatchObject({ passed: true });
    expect(state.calculations.find((entry) => entry.id === "water-rf-purple-overlap")?.value).toBeCloseTo(0.7375, 4);
    expect(state.calculations.find((entry) => entry.id === "water-rf-yellow")?.value).toBeCloseTo(0.825, 4);
  });

  it("plays the 2-propanol trial to completion, three bands into the organic waste", () => {
    const { technique, state } = playTo("paper-chromatography-propanol-3d", undefined, propanol);
    expect(state.completedNodes).toHaveLength(33);
    expect(state.calculations.find((entry) => entry.id === "propanol-rf-blue")?.value).toBeCloseTo(0.35, 4);
    expect(technique.actions.find((action) => action.id === "dispose-solvent")!.parameters).toMatchObject({ targetInstanceId: "organic-waste-1",
      wasteStream: "organic" });
  });

  it("asks for the student's reading and does not pass one more than half a millimetre off", () => {
    const played = playTo(id, "read-front");
    expect(attempt(played.technique, played.state, id, { ...PLAYS[id], inputs: {} }).refusal).toBeDefined();
    const off = attempt(played.technique, played.state, id, { ...PLAYS[id], inputs: { "read-front": "82" } }).state;
    expect(off.completedNodes).not.toContain("read-front-node");
    const right = attempt(played.technique, played.state, id, { ...PLAYS[id], inputs: { "read-front": "80" } }).state;
    expect(right.completedNodes).toContain("read-front-node");
  });

  it("lets the step card perform each pencil, drying, lid and development step", () => {
    const technique = load(id);
    let state = createRuntimeState(technique);
    for (const node of technique.process.nodes) {
      const action = technique.actions.find((candidate) => candidate.id === node.actionId)!;
      const typed = action.parameters.chromatographyOperation ?? action.parameters.chamberOperation ?? (action.verb === "developChromatogram" ? "develop" : undefined);
      if (typed) {
        const flow = stepFlow({ state, node, action, interaction: resolveActionInteraction(action), inputValue: "", showGuidance: false });
        expect(flow.canRecordObservation || flow.canRecord, node.id).toBe(true);
      }
      for (let i = 0; i < 40 && !state.completedNodes.includes(node.id); i += 1) state = attempt(technique, state, id).state;
    }
    expect(state.completedNodes).toHaveLength(31);
  });

  it("lays the ruler beside the flat strip, its zero level with the baseline", () => {
    const { technique, state } = playTo(id, "read-front");
    const bench = runtimeToScene(state, technique).bench;
    const point = (instanceId: string) => {
      const placement = bench.find((item) => item.instanceId === instanceId)!.placement;
      if (placement.kind !== "bench") throw new Error(`${instanceId} is not on the bench`);
      return placement.point;
    };
    const paper = point("paper-1");
    const ruler = point("ruler-1");
    // The strip's lower edge is 55 mm before its centre; the ruler's zero is 76 mm before, and 14 mm left of, its own.
    expect(ruler.yMm - 76).toBeCloseTo(paper.yMm - 55 + 15, 6);
    expect(ruler.xMm - 14).toBeCloseTo(paper.xMm + 7.5 + 0.6, 6);
  });
});
