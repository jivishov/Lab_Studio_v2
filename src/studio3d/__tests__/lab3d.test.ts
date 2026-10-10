import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assessBundledTechniqueCatalogPolicy } from "../../data/bundledCatalogPolicyBoundary";
import { resolveActionInteraction } from "../../domain/interactions";
import type { LabDefinition, NotebookEntry, RuntimeState, TechniqueDefinition } from "../../domain/types";
import { validateTechniqueDefinition } from "../../domain/validation";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { resolveActionInput } from "../../runtime/actionInputs";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { benchMoveRequest, intentTypeForInteraction, mergeActionInput } from "../adapters/sceneToIntent";
import { equipment3dReadiness } from "../equipment3d/readiness";
import type * as Labs3D from "../labs3d";
import { parseLab3DValues, type Lab3DSummary } from "../labs3dSetup";
import { measurementProvenance, notebookProvenance } from "../player/provenance";

/**
 * D8 E3 (decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design"): the twins and the
 * generated 3D lab, loaded the way `#/3d/play/<labId>` loads them (the public files served by a stub fetch).
 */
const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const twins = read("public/techniques-3d/twins.json") as Array<{ id: string; file: string; practiceId: string; basedOn: string }>;
const practiceIndex = read("public/techniques-3d/index.json") as Array<{ id: string }>;
const catalogue = read("public/techniques/index.json") as Array<{ id: string }>;
const labIndex = read("public/labs-3d/index.json") as Lab3DSummary[];
const demo = labIndex.find((entry) => entry.id === "intro-filtration-demo")!;
const defaults = Object.fromEntries(demo.setup.map((field) => [field.id, String(field.defaultValue)]));

let labs3d: typeof Labs3D;
const fetched: string[] = [];
beforeEach(async () => {
  fetched.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace(/^\/+/, "");
    fetched.push(path);
    try {
      return new Response(await readFile(join(process.cwd(), "public", ...path.split("/")), "utf8"), { status: 200 });
    } catch {
      return new Response("", { status: 404 });
    }
  }));
  vi.resetModules();
  labs3d = await import("../labs3d");
});
afterEach(() => { vi.unstubAllGlobals(); });

/** Plays a compiled lab through the process control; `inputs` and `moves` by compiled action id. */
const playLab = (lab: LabDefinition, inputs: Record<string, string>, moves: Record<string, string>): RuntimeState => {
  let state = createRuntimeState(lab);
  for (const node of lab.process.nodes) {
    const action = lab.actions.find((candidate) => candidate.id === node.actionId)!;
    if (moves[action.id]) state = performRuntimeAction(lab, state, benchMoveRequest(moves[action.id], { x: 300, y: 380 }, 50));
    for (let i = 0; i < 40 && !state.completedNodes.includes(node.id); i += 1) {
      const interaction = resolveActionInteraction(action)!;
      const intent = mergeActionInput({ origin: "keyboard", type: intentTypeForInteraction[interaction.type] } as RuntimeInteractionIntent,
        resolveActionInput(action, inputs[action.id] ?? ""), action);
      const resolved = resolveInteractionIntent(lab, state, intent);
      if (!resolved.ok) throw new Error(`${node.id}: ${resolved.feedback.message}`);
      const before = state.feedbackQueue.length;
      state = performRuntimeAction(lab, state, resolved.request);
      const error = state.feedbackQueue.slice(before).find((entry) => entry.severity === "error");
      if (error) throw new Error(`${node.id}: ${error.message}`);
    }
    expect(state.completedNodes, node.id).toContain(node.id);
  }
  return state;
};
const contents = (state: RuntimeState, id: string) => state.equipmentInstances.find((item) => item.id === id)?.contents;

describe("D8 twins", () => {
  it("lists the three twins E3 composes, each a composable copy of a practice version", async () => {
    expect(twins.map((twin) => twin.id)).toEqual(["transfer-3d", "hard-water-precipitation-3d", "filtration-3d"]);
    for (const twin of twins) {
      const raw = read(`public/techniques-3d/${twin.file}`) as TechniqueDefinition;
      expect(validateTechniqueDefinition(raw).errors ?? []).toEqual([]);
      expect(raw.composition?.catalogDisposition).toBe("composable");
      await expect(assessBundledTechniqueCatalogPolicy("public-bundle", `public/techniques-3d/${twin.file}`, raw)).resolves.toBeDefined();
      // Never offered on its own: not a practice version, not in the 2D catalogue.
      expect(practiceIndex.some((entry) => entry.id === twin.id)).toBe(false);
      expect(catalogue.some((entry) => entry.id === twin.id)).toBe(false);
      expect(practiceIndex.some((entry) => entry.id === twin.practiceId)).toBe(true);
    }
  });

  it("drops the values the lab's own bench carries, and keeps the balance reading", () => {
    const slots = (id: string) => (read(`public/techniques-3d/${id}.json`) as TechniqueDefinition).composition!.configurationSlots.map((slot) => slot.id);
    expect(slots("hard-water-precipitation-3d")).not.toContain("sampleVolumeMl");
    expect(slots("hard-water-precipitation-3d")).not.toContain("reagentStockVolumeMl");
    expect(slots("filtration-3d")).not.toContain("mixtureVolumeMl");
    expect(slots("filtration-3d")).not.toContain("precipitateMassG");
    expect(slots("filtration-3d")).toContain("paperMassG");
  });

  it("resolves a twin from techniques-3d and anything else from the bundled catalogue", async () => {
    expect((await labs3d.resolve3DTechnique("filtration-3d")).id).toBe("filtration-3d");
    expect((await labs3d.resolve3DTechnique("measuring-volume")).id).toBe("measuring-volume");
    expect(fetched).toContain("techniques-3d/filtration-3d.json");
    expect(fetched.some((path) => path.startsWith("techniques/") && path.includes("measuring-volume"))).toBe(true);
    expect(fetched.some((path) => path.startsWith("labs/"))).toBe(false);
  });
});

describe("D8 3D lab: Precipitate and Filter Calcium Carbonate", () => {
  it("is listed with its four parts, and its 2D fallback exists", () => {
    expect(labIndex.map((entry) => entry.id)).toEqual(["intro-filtration-demo"]);
    expect(demo.parts.map((part) => part.techniqueId)).toEqual(["measuring-volume", "transfer-3d", "hard-water-precipitation-3d", "filtration-3d"]);
    expect(read("public/labs/index.json").some((entry: { id: string }) => entry.id === demo.id)).toBe(true);
  });

  it("compiles with the defaults through the policy seam, every step labelled with its part", async () => {
    const loaded = await labs3d.loadLab3D(demo, defaults);
    expect(loaded.lab.compositionManifest?.status).toBeDefined();
    expect(loaded.lab.process.nodes).toHaveLength(31);
    expect(loaded.lab.initialState?.equipment).toHaveLength(13);
    expect(equipment3dReadiness(loaded.lab.initialState!.equipment.map((item) => item.definitionId)).ready).toBe(true);
    const counts = demo.parts.map((_, index) => loaded.lab.process.nodes.filter((node) => loaded.parts.get(node.id)?.index === index + 1).length);
    expect(counts).toEqual([3, 4, 11, 13]);
    expect(loaded.parts.get(loaded.lab.process.nodes[3].id)).toEqual({ index: 2, count: 4, title: "Transfer Liquid" });
    expect(fetched.some((path) => path.startsWith("labs/"))).toBe(false);
  });

  it("plays all 31 steps with the defaults", async () => {
    const { lab } = await labs3d.loadLab3D(demo, defaults);
    const state = playLab(lab, { "filtration--weigh-paper": defaults.paperMassG }, { "filtration--fold-paper": "filter-paper-1" });
    expect(state.completedNodes).toHaveLength(31);
    expect(contents(state, "filter-paper-1")?.precipitate?.massG).toBeCloseTo(0.0075, 6);
    // 20 mL sample + 20 mL reagent + the cylinder's 9 mL and 5 mL rinses + the 18 mL of rod and beaker washes, less nothing.
    expect(contents(state, "erlenmeyer-flask-250ml-1")?.volumeMl).toBeCloseTo(72.05, 6);
    expect(contents(state, "reagent-beaker-1")?.volumeMl).toBeCloseTo(29, 6);
  });

  it("carries the teacher's values into the run", async () => {
    const values = { ...defaults, sampleVolumeMl: "50", workingPortionMl: "40", reagentVolumeMl: "30", paperMassG: "0.912" };
    const { lab } = await labs3d.loadLab3D(demo, values);
    expect(lab.initialState?.equipment.find((item) => item.id === "reagent-beaker-1")?.contents?.volumeMl).toBe(40);
    const state = playLab(lab, { "filtration--weigh-paper": "0.912" }, { "filtration--fold-paper": "filter-paper-1" });
    expect(state.completedNodes).toHaveLength(31);
    expect(contents(state, "reagent-beaker-1")?.volumeMl).toBeCloseTo(9, 6);
    expect(contents(state, "erlenmeyer-flask-250ml-1")?.volumeMl).toBeCloseTo(112.05, 6);
  });

  it("refuses setup values out of bounds or that break a rule, naming the problem", () => {
    expect(() => parseLab3DValues(demo, defaults)).not.toThrow();
    expect(() => parseLab3DValues(demo, { ...defaults, paperMassG: "" })).toThrow(/Enter dry filter paper's mass/);
    expect(() => parseLab3DValues(demo, { ...defaults, sampleVolumeMl: "two" })).toThrow(/must be a number/);
    expect(() => parseLab3DValues(demo, { ...defaults, sampleVolumeMl: "101" })).toThrow(/at most 100 mL/);
    expect(() => parseLab3DValues(demo, { ...defaults, sampleVolumeMl: "100", reagentVolumeMl: "120", workingPortionMl: "150" })).toThrow(/250 mL receiving flask/);
    expect(() => parseLab3DValues(demo, { ...defaults, reagentVolumeMl: "50" })).toThrow(/working portion/);
  });

  it("marks the teacher's values as teacher settings through the authored view", async () => {
    const { lab, authored } = await labs3d.loadLab3D(demo, defaults);
    const node = (actionId: string) => lab.process.nodes.find((entry) => entry.actionId === actionId)!.id;
    const entry = (nodeId: string): NotebookEntry => ({ id: "e-1", timestamp: "", nodeId, type: "observation", label: "", value: "", tags: [] });
    expect(notebookProvenance(lab, authored, entry(node("hard-water-precipitation--observe-precipitate")))).toBe("teacher");
    // Compiled, the binding is gone: without the authored view the chip falls back to the bench.
    expect(notebookProvenance(lab, undefined, entry(node("hard-water-precipitation--observe-precipitate")))).toBe("bench");
    // "Record volume" only records the cylinder's teacher-set reading: its row is a teacher setting, not an entry.
    const record = node("measuring-volume--record-volume");
    expect(notebookProvenance(lab, authored, { ...entry(record), type: "measurement" })).toBe("teacher");
    // The paper's mass is read off the balance by the student, not shown as a teacher's value.
    const weigh = lab.actions.find((action) => action.id === "filtration--weigh-paper")!;
    expect(measurementProvenance(lab, authored, String(weigh.parameters.measurementId))).not.toBe("teacher");
    const recordMass = node("filtration--record-paper-mass");
    expect(notebookProvenance(lab, authored, { ...entry(recordMass), type: "measurement" })).toBe("entry");
  });
});
