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
import { readingVesselId } from "../player/stepRules";

/**
 * D8 E3 (decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design"): the twins and the
 * generated 3D lab, loaded the way `#/3d/play/<labId>` loads them (the public files served by a stub fetch).
 * Part 1 is the 3D twin of Measure Liquid Volume and the parts carry short titles (you, 2026-10-10).
 */
const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const twins = read("public/techniques-3d/twins.json") as Array<{ id: string; file: string; practiceId?: string; basedOn: string }>;
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

/**
 * Plays a compiled lab through the process control; `inputs` and `moves` by compiled action id. A drop-to-the-line
 * step adds the drops that bring the level to the line and `dropsOff` more, draws `drawnBack` drops' worth back up
 * into the pipette, then says it is at the line.
 */
const playLab = (lab: LabDefinition, inputs: Record<string, string>, moves: Record<string, string>, dropsOff = 0, drawnBack = 0): RuntimeState => {
  let state = createRuntimeState(lab);
  const send = (nodeId: string, intent: RuntimeInteractionIntent) => {
    const resolved = resolveInteractionIntent(lab, state, intent);
    if (!resolved.ok) throw new Error(`${nodeId}: ${resolved.feedback.message}`);
    const before = state.feedbackQueue.length;
    state = performRuntimeAction(lab, state, resolved.request);
    const error = state.feedbackQueue.slice(before).find((entry) => entry.severity === "error");
    if (error) throw new Error(`${nodeId}: ${error.message}`);
  };
  for (const node of lab.process.nodes) {
    const action = lab.actions.find((candidate) => candidate.id === node.actionId)!;
    const interaction = resolveActionInteraction(action)!;
    if (moves[action.id]) state = performRuntimeAction(lab, state, benchMoveRequest(moves[action.id], { x: 300, y: 380 }, 50));
    if (interaction.type === "dispenseDrops") {
      const level = contents(state, String(action.parameters.targetInstanceId))?.volumeMl ?? 0;
      const dropCount = Math.round((Number(action.parameters.markVolumeMl) - level) / Number(action.parameters.dropVolumeMl)) + dropsOff;
      send(node.id, { origin: "keyboard", type: "dispenseDropIntent", runtimeParameters: { dropCount } } as RuntimeInteractionIntent);
      if (drawnBack) send(node.id, { origin: "keyboard", type: "dispenseDrawBackIntent", runtimeParameters: { dropCount: drawnBack } } as RuntimeInteractionIntent);
      send(node.id, { origin: "keyboard", type: "dispenseCompleteIntent" } as RuntimeInteractionIntent);
    }
    for (let i = 0; i < 40 && !state.completedNodes.includes(node.id); i += 1) {
      send(node.id, mergeActionInput({ origin: "keyboard", type: intentTypeForInteraction[interaction.type] } as RuntimeInteractionIntent,
        resolveActionInput(action, inputs[action.id] ?? ""), action));
    }
    expect(state.completedNodes, node.id).toContain(node.id);
  }
  return state;
};
function contents(state: RuntimeState, id: string) { return state.equipmentInstances.find((item) => item.id === id)?.contents; }
/** What the student types: the cylinder read at the line, and the balance's mass. */
const typed = (values: Record<string, string>, reading = values.sampleVolumeMl) =>
  ({ "measuring-volume--read-volume": reading, "filtration--weigh-paper": values.paperMassG });
const moves = { "filtration--fold-paper": "filter-paper-1" };

describe("D8 twins", () => {
  it("lists the eight twins the labs compose, each a composable copy of a practice version or a Pack 1 original", async () => {
    // Pack 3a adds Dry and Weigh's and Calculate Hardness's, in the practice list's order (2026-10-10), and Paper
    // Chromatography's two trials, water then 2-propanol, both from its one module (2026-10-11).
    expect(twins.map((twin) => twin.id)).toEqual(["transfer-3d", "hard-water-precipitation-3d", "filtration-3d", "drying-3d",
      "paper-chromatography-water-3d", "paper-chromatography-propanol-3d", "hard-water-calculation-3d", "measuring-volume-3d"]);
    for (const twin of twins) {
      const raw = read(`public/techniques-3d/${twin.file}`) as TechniqueDefinition;
      expect(validateTechniqueDefinition(raw).errors ?? []).toEqual([]);
      expect(raw.composition?.catalogDisposition).toBe("composable");
      await expect(assessBundledTechniqueCatalogPolicy("public-bundle", `public/techniques-3d/${twin.file}`, raw)).resolves.toBeDefined();
      // Never offered on its own: not a practice version, not in the 2D catalogue.
      expect(practiceIndex.some((entry) => entry.id === twin.id)).toBe(false);
      expect(catalogue.some((entry) => entry.id === twin.id)).toBe(false);
      // Measure Liquid Volume has no practice version: its twin is built on the Pack 1 original.
      if (twin.practiceId) expect(practiceIndex.some((entry) => entry.id === twin.practiceId)).toBe(true);
      else expect(catalogue.some((entry) => entry.id === twin.basedOn)).toBe(true);
    }
    expect(twins.find((twin) => twin.id === "measuring-volume-3d")).toEqual({ id: "measuring-volume-3d", file: "measuring-volume-3d.json", basedOn: "measuring-volume" });
  });

  it("atomizes Measure Liquid Volume: pour to below the line, fill a dropping pipette, drops to the line, read", () => {
    const twin = read("public/techniques-3d/measuring-volume-3d.json") as TechniqueDefinition;
    const steps = twin.process.nodes.map((node) => twin.actions.find((action) => action.id === node.actionId)!);
    expect(steps.map((action) => action.atomId ?? action.verb)).toEqual([
      "atom.place.variable-volume-device", "atom.transfer.fill-below-graduation", "atom.transfer.draw-into-transfer-pipette",
      "atom.transfer.dropwise-to-graduation", "record"]);
    // The pipette draws from the small beaker, never from the bottle.
    expect(steps[2].parameters.sourceInstanceId).toBe("sample-portion-1");
    // An overshoot is drawn back up into the pipette, in the 25 mL cylinder its tip reaches (you, 2026-10-10).
    expect(steps[3].parameters).toMatchObject({ markDispense: "target", markToleranceMl: 0.2, dropVolumeMl: 0.05, markDrawBack: true,
      targetDefinitionId: "graduated-cylinder-25ml" });
    // The reading is the student's, typed and never checked against the level.
    expect(steps[4].parameters).toMatchObject({ inputRole: "studentResponse", studentValueRequired: true, inputStep: 0.1 });
    expect(steps[4].parameters.copyExistingMeasurementOnly).toBeUndefined();
  });

  it("drops the values the lab's own bench carries, and keeps the balance reading", () => {
    const slots = (id: string) => (read(`public/techniques-3d/${id}.json`) as TechniqueDefinition).composition!.configurationSlots.map((slot) => slot.id);
    expect(slots("hard-water-precipitation-3d")).not.toContain("sampleVolumeMl");
    expect(slots("hard-water-precipitation-3d")).not.toContain("reagentStockVolumeMl");
    expect(slots("filtration-3d")).not.toContain("mixtureVolumeMl");
    expect(slots("filtration-3d")).not.toContain("precipitateMassG");
    expect(slots("filtration-3d")).toContain("paperMassG");
    // Transfer pours all the cylinder holds, so the line's tolerance carries through to the flask; its twin pours
    // from the 25 mL cylinder the sample was measured in, and the practice version keeps the 100 mL one.
    expect(slots("transfer-3d")).not.toContain("transferVolumeMl");
    const cylinders = (file: string) => (read(file) as TechniqueDefinition).initialState!.equipment
      .filter((item) => item.definitionId.startsWith("graduated-cylinder")).map((item) => item.definitionId);
    expect(cylinders("public/techniques-3d/transfer-3d.json")).toEqual(["graduated-cylinder-25ml"]);
    expect(cylinders("public/techniques-3d/transfer-practice.json")).toEqual(["graduated-cylinder"]);
    expect(slots("measuring-volume-3d")).toEqual(["targetVolumeMl", "pourVolumeMl"]);
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
  it("is listed with its four parts under short titles, and its 2D fallback exists", () => {
    expect(labIndex.map((entry) => entry.id)).toEqual(["intro-filtration-demo", "hard-water-demo"]);
    expect(demo.parts.map((part) => part.techniqueId)).toEqual(["measuring-volume-3d", "transfer-3d", "hard-water-precipitation-3d", "filtration-3d"]);
    expect(demo.parts.map((part) => part.title)).toEqual(["Measure the sample", "Transfer the sample", "Precipitate the calcium", "Filter the precipitate"]);
    expect(demo.parts.map((part) => part.techniqueTitle)).toEqual(["Measure Liquid Volume", "Transfer Liquid", "Hard-Water Calcium Carbonate Precipitation", "Filter a Precipitate"]);
    expect(read("public/labs/index.json").some((entry: { id: string }) => entry.id === demo.id)).toBe(true);
  });

  it("compiles with the defaults through the policy seam, every step labelled with its part", async () => {
    const loaded = await labs3d.loadLab3D(demo, defaults);
    expect(loaded.lab.compositionManifest?.status).toBeDefined();
    expect(loaded.lab.process.nodes).toHaveLength(33);
    expect(loaded.lab.initialState?.equipment).toHaveLength(15);
    expect(equipment3dReadiness(loaded.lab.initialState!.equipment.map((item) => item.definitionId)).ready).toBe(true);
    // The sample is measured in the smallest cylinder that holds it (you, 2026-10-10).
    expect(loaded.lab.initialState!.equipment.find((item) => item.id === "graduated-cylinder-1"))
      .toMatchObject({ definitionId: "graduated-cylinder-25ml", label: "25 mL graduated cylinder" });
    const counts = demo.parts.map((_, index) => loaded.lab.process.nodes.filter((node) => loaded.parts.get(node.id)?.index === index + 1).length);
    expect(counts).toEqual([5, 4, 11, 13]);
    expect(loaded.parts.get(loaded.lab.process.nodes[5].id)).toEqual({ index: 2, count: 4, title: "Transfer the sample" });
    // The pour stops 1 mL below the line the teacher set (a setup offset).
    const action = (id: string) => loaded.lab.actions.find((entry) => entry.id === id)!;
    expect(action("measuring-volume--pour-below-line").parameters.volumeMl).toBe(19);
    expect(action("measuring-volume--drops-to-line").parameters.markVolumeMl).toBe(20);
    // The step text carries each part's values: the compiler leaves `{{config.*}}` in node text, the loader fills it.
    expect(loaded.lab.process.nodes[1].description).toBe("Pour the hard-water sample from its bottle into the cylinder until the level is just below the 20 mL line.");
    expect(loaded.lab.process.nodes.find((node) => node.id === "hard-water-precipitation--add-reagent-portion-1-node")?.description)
      .toMatch(/^Pour a third of the 20 mL of sodium carbonate solution/);
    expect(loaded.lab.process.nodes.filter((node) => `${node.title} ${node.description ?? ""}`.includes("{{"))).toEqual([]);
    expect(fetched.some((path) => path.startsWith("labs/"))).toBe(false);
  });

  it("plays all 33 steps with the defaults", async () => {
    const { lab } = await labs3d.loadLab3D(demo, defaults);
    const state = playLab(lab, typed(defaults), moves);
    expect(state.completedNodes).toHaveLength(33);
    expect(state.measurements.find((m) => m.id === "measuring-volume--sample-volume")?.value).toBe(20);
    expect(contents(state, "sample-portion-1")?.volumeMl).toBeCloseTo(7, 6);
    // The reading is taken at the cylinder, so the auto view puts the eye level with it; the balance's mass is not.
    const action = (id: string) => lab.actions.find((entry) => entry.id === id);
    expect(readingVesselId(action("measuring-volume--read-volume"), state.measurements)).toBe("graduated-cylinder-1");
    expect(readingVesselId(action("filtration--record-paper-mass"), state.measurements)).toBeUndefined();
    expect(contents(state, "filter-paper-1")?.precipitate?.massG).toBeCloseTo(0.0075, 6);
    // 20 mL sample + 20 mL reagent + the cylinder's 9 mL and 5 mL rinses + the 18 mL of rod and beaker washes, less nothing.
    expect(contents(state, "erlenmeyer-flask-250ml-1")?.volumeMl).toBeCloseTo(72.05, 6);
    expect(contents(state, "reagent-beaker-1")?.volumeMl).toBeCloseTo(29, 6);
  });

  it("carries the teacher's values into the run", async () => {
    const values = { ...defaults, sampleVolumeMl: "24", workingPortionMl: "40", reagentVolumeMl: "30", paperMassG: "0.912" };
    const { lab } = await labs3d.loadLab3D(demo, values);
    expect(lab.initialState?.equipment.find((item) => item.id === "reagent-beaker-1")?.contents?.volumeMl).toBe(40);
    expect(lab.actions.find((action) => action.id === "measuring-volume--pour-below-line")?.parameters.volumeMl).toBe(23);
    expect(lab.process.nodes[1].description).toMatch(/just below the 24 mL line\.$/);
    expect(lab.process.nodes.find((node) => node.id === "hard-water-precipitation--add-reagent-portion-1-node")?.description).toMatch(/a third of the 30 mL/);
    const state = playLab(lab, typed(values), moves);
    expect(state.completedNodes).toHaveLength(33);
    expect(contents(state, "reagent-beaker-1")?.volumeMl).toBeCloseTo(9, 6);
    expect(contents(state, "erlenmeyer-flask-250ml-1")?.volumeMl).toBeCloseTo(86.05, 6);
  });

  it("draws a level past the line back up into the pipette, then judges it at the line", async () => {
    const { lab } = await labs3d.loadLab3D(demo, defaults);
    // Ten drops over (0.5 mL) is past the line until it is drawn back; what was drawn back is in the pipette again.
    expect(() => playLab(lab, typed(defaults), moves, 10)).toThrow(/past the line/);
    const back = playLab(lab, typed(defaults), moves, 10, 10);
    expect(back.completedNodes).toHaveLength(33);
    expect(contents(back, "erlenmeyer-flask-250ml-1")?.volumeMl).toBeCloseTo(72.05, 6);
    const plain = playLab(lab, typed(defaults), moves);
    expect(contents(back, "sample-pipette-1")?.volumeMl).toBeCloseTo(contents(plain, "sample-pipette-1")?.volumeMl ?? NaN, 6);
    // Drawn back to 0.2 mL under the line is on it; 0.25 over, or 0.3 under, is not.
    expect(contents(playLab(lab, typed(defaults), moves, 10, 14), "erlenmeyer-flask-250ml-1")?.volumeMl).toBeCloseTo(71.85, 6);
    expect(() => playLab(lab, typed(defaults), moves, 10, 5)).toThrow(/past the line/);
    expect(() => playLab(lab, typed(defaults), moves, 10, 16)).toThrow(/not reached the line/);
  });

  it("judges the level within the line's tolerance, and records the reading as typed", async () => {
    const { lab } = await labs3d.loadLab3D(demo, defaults);
    // Three drops over (0.15 mL) is still on the line; the flask takes what the cylinder held.
    const over = playLab(lab, typed(defaults, "20.1"), moves, 3);
    expect(over.completedNodes).toHaveLength(33);
    expect(contents(over, "erlenmeyer-flask-250ml-1")?.volumeMl).toBeCloseTo(72.2, 6);
    // The reading is the student's: 20.1 mL is recorded although the line is 20 mL.
    expect(over.measurements.find((m) => m.id === "measuring-volume--sample-volume")).toMatchObject({ value: 20.1, unit: "mL" });
    expect(over.notebook.find((e) => e.tags.includes("measuring-volume--sample-volume"))?.value).toBe("20.1 mL");
    // Five over (0.25 mL) or five short is not on the line.
    expect(() => playLab(lab, typed(defaults), moves, 5)).toThrow(/past the line/);
    expect(() => playLab(lab, typed(defaults), moves, -5)).toThrow(/not reached the line/);
  });

  it("refuses setup values out of bounds or that break a rule, naming the problem", () => {
    expect(() => parseLab3DValues(demo, defaults)).not.toThrow();
    expect(() => parseLab3DValues(demo, { ...defaults, paperMassG: "" })).toThrow(/Enter dry filter paper's mass/);
    expect(() => parseLab3DValues(demo, { ...defaults, sampleVolumeMl: "two" })).toThrow(/must be a number/);
    // The 25 mL cylinder holds the sample (you, 2026-10-10).
    expect(() => parseLab3DValues(demo, { ...defaults, sampleVolumeMl: "26" })).toThrow(/at most 25 mL/);
    expect(() => parseLab3DValues(demo, { ...defaults, sampleVolumeMl: "4" })).toThrow(/at least 5 mL/);
    // At the bounds, everything fits in the receiving flask; the rule stays as a guard, and still names the problem.
    const most = { ...defaults, sampleVolumeMl: "25", reagentVolumeMl: "140", workingPortionMl: "150" };
    expect(() => parseLab3DValues(demo, most)).not.toThrow();
    const smallerFlask = { ...demo, rules: demo.rules.map((rule, i) => (i === 0 ? { ...rule, atMost: 150 } : rule)) };
    expect(() => parseLab3DValues(smallerFlask, most)).toThrow(/250 mL receiving flask/);
    expect(() => parseLab3DValues(demo, { ...defaults, reagentVolumeMl: "50" })).toThrow(/working portion/);
  });

  it("marks the teacher's values as teacher settings through the authored view", async () => {
    const { lab, authored } = await labs3d.loadLab3D(demo, defaults);
    const node = (actionId: string) => lab.process.nodes.find((entry) => entry.actionId === actionId)!.id;
    const entry = (nodeId: string): NotebookEntry => ({ id: "e-1", timestamp: "", nodeId, type: "observation", label: "", value: "", tags: [] });
    expect(notebookProvenance(lab, authored, entry(node("hard-water-precipitation--observe-precipitate")))).toBe("teacher");
    // Compiled, the binding is gone: without the authored view the chip falls back to the bench.
    expect(notebookProvenance(lab, undefined, entry(node("hard-water-precipitation--observe-precipitate")))).toBe("bench");
    // The level step records the line, the teacher's setting, until the student's reading replaces it.
    const level = node("measuring-volume--drops-to-line");
    const reading = node("measuring-volume--read-volume");
    expect(measurementProvenance(lab, authored, "measuring-volume--sample-volume", level)).toBe("teacher");
    expect(measurementProvenance(lab, authored, "measuring-volume--sample-volume", reading)).toBe("entry");
    expect(notebookProvenance(lab, authored, { ...entry(reading), type: "measurement" })).toBe("entry");
    // The paper's mass is read off the balance by the student, not shown as a teacher's value.
    const weigh = lab.actions.find((action) => action.id === "filtration--weigh-paper")!;
    expect(measurementProvenance(lab, authored, String(weigh.parameters.measurementId))).not.toBe("teacher");
    const recordMass = node("filtration--record-paper-mass");
    expect(notebookProvenance(lab, authored, { ...entry(recordMass), type: "measurement" })).toBe("entry");
  });
});

describe("Pack 3a 3D lab: Determine Water Hardness", () => {
  const hardWater = labIndex.find((entry) => entry.id === "hard-water-demo")!;
  const hardWaterDefaults = Object.fromEntries(hardWater.setup.map((field) => [field.id, String(field.defaultValue)]));
  /** What the student types: the cylinder, the three balance readings, the oven, and the hardness. */
  const entries = (values: Record<string, string>, hardness: string, combined: string) => ({
    ...typed(values),
    "filtration--weigh-paper": Number(values.paperMassG).toFixed(4),
    "drying--weigh-glass": Number(values.watchGlassMassG).toFixed(4),
    "drying--set-oven": "115",
    "drying--weigh-combined": combined,
    "hard-water-calculation--calculate-hardness": hardness,
  });
  const hardWaterMoves = { ...moves, "drying--paper-onto-glass": "watch-glass-1", "drying--first-to-pad": "crucible-tongs-1", "drying--break-up": "scoopula-1" };
  const hardnessOf = (state: RuntimeState) => state.calculations.find((entry) => entry.id === "hard-water-calculation--hardness-mg-l");

  it("composes the 2D lab's six parts in its order, as twins under its instance ids", () => {
    expect(hardWater.parts.map((part) => part.instanceId)).toEqual(["measuring-volume", "transfer", "hard-water-precipitation", "filtration",
      "drying", "hard-water-calculation"]);
    expect(hardWater.parts.map((part) => part.techniqueId)).toEqual(["measuring-volume-3d", "transfer-3d", "hard-water-precipitation-3d",
      "filtration-3d", "drying-3d", "hard-water-calculation-3d"]);
    expect(hardWaterDefaults).toMatchObject({ sampleVolumeMl: "20", precipitateMassG: "0.0075", paperMassG: "0.553", watchGlassMassG: "30" });
    expect(read("public/labs/index.json").some((entry: { id: string }) => entry.id === hardWater.id)).toBe(true);
  });

  it("drops Dry and Weigh's noted paper mass, and keeps the hardness step alone", () => {
    const drying = read("public/techniques-3d/drying-3d.json") as TechniqueDefinition;
    expect(drying.actions.some((action) => action.id === "note-paper-mass")).toBe(false);
    expect(drying.composition!.configurationSlots.map((slot) => slot.id)).toEqual(["paperMassG", "watchGlassMassG", "firstDryingMinutes",
      "filterPaperMassMeasurementId"]);
    const hardness = read("public/techniques-3d/hard-water-calculation-3d.json") as TechniqueDefinition;
    expect(hardness.process.nodes.map((node) => node.actionId)).toEqual(["calculate-hardness"]);
    expect(hardness.composition!.configurationSlots.map((slot) => slot.id)).toEqual(["sampleVolumeMeasurementId", "precipitateMassCalculationId",
      "calculationTolerance"]);
  });

  it("compiles with the defaults, the ids meeting across parts", async () => {
    const { lab, parts } = await labs3d.loadLab3D(hardWater, hardWaterDefaults);
    expect(lab.process.nodes).toHaveLength(59);
    expect(lab.initialState?.equipment).toHaveLength(21);
    expect(equipment3dReadiness(lab.initialState!.equipment.map((item) => item.definitionId)).ready).toBe(true);
    const counts = hardWater.parts.map((_, index) => lab.process.nodes.filter((node) => parts.get(node.id)?.index === index + 1).length);
    expect(counts).toEqual([5, 4, 11, 13, 25, 1]);
    const action = (id: string) => lab.actions.find((entry) => entry.id === id)!;
    expect(action("drying--precipitate-by-difference").parameters.filterPaperMassMeasurementId).toBe("filtration--filter-paper-mass");
    expect(action("hard-water-calculation--calculate-hardness").parameters).toMatchObject({
      calculationId: "hard-water-calculation--hardness-mg-l", sampleVolumeMeasurementId: "measuring-volume--sample-volume",
      precipitateMassCalculationId: "drying--precipitate-mass", tolerance: 0.5, requireStudentValue: true });
    expect(lab.process.nodes.at(-1)!.validation[0]).toMatchObject({ calculationId: "hard-water-calculation--hardness-mg-l" });
    // The balance reads to 0.0001 g from its first weighing, Filtration's paper (decision 9).
    expect(lab.actions.filter((entry) => entry.verb === "weigh").map((entry) => entry.parameters.inputStep)).toEqual([0.0001, 0.0001, 0.0001]);
  });

  it("plays all 59 steps to 375 mg/L with the defaults", async () => {
    const { lab } = await labs3d.loadLab3D(hardWater, hardWaterDefaults);
    const state = playLab(lab, entries(hardWaterDefaults, "375", "30.5605"), hardWaterMoves);
    expect(state.completedNodes).toHaveLength(59);
    expect(state.calculations.find((entry) => entry.id === "drying--precipitate-mass")?.value).toBeCloseTo(0.0075, 6);
    expect(hardnessOf(state)).toMatchObject({ value: 375, passed: true });
    expect(hardnessOf(state)?.expected).toBeCloseTo(375, 6);
  });

  it("refuses a wrong hardness until it is corrected", async () => {
    const { lab } = await labs3d.loadLab3D(hardWater, hardWaterDefaults);
    // 400 mg/L is what the 0.001 g balance gave (30.561 g): it fails, and the step stays open.
    expect(() => playLab(lab, entries(hardWaterDefaults, "400", "30.5605"), hardWaterMoves)).toThrow(/hard-water-calculation--calculate-hardness-node/);
    const last = lab.process.nodes.at(-1)!;
    const before = playLab({ ...lab, process: { ...lab.process, nodes: lab.process.nodes.slice(0, -1) } },
      entries(hardWaterDefaults, "", "30.5605"), hardWaterMoves);
    const action = lab.actions.find((entry) => entry.id === last.actionId)!;
    const submit = (state: RuntimeState, value: string) => {
      const interaction = resolveActionInteraction(action)!;
      const resolved = resolveInteractionIntent(lab, state, mergeActionInput({ origin: "keyboard", type: intentTypeForInteraction[interaction.type] } as RuntimeInteractionIntent,
        resolveActionInput(action, value), action));
      if (!resolved.ok) throw new Error(resolved.feedback.message);
      return performRuntimeAction(lab, state, resolved.request);
    };
    const wrong = submit(before, "400");
    expect(hardnessOf(wrong)?.passed).toBe(false);
    expect(wrong.completedNodes).not.toContain(last.id);
    const corrected = submit(wrong, "375");
    expect(hardnessOf(corrected)?.passed).toBe(true);
    expect(corrected.completedNodes).toContain(last.id);
    expect(corrected.completedNodes).toHaveLength(59);
  });

  it("carries the teacher's values into the hardness", async () => {
    // 0.0150 g in 25 mL is 600 mg/L, with the paper and the watch glass as the teacher set them.
    const values = { ...hardWaterDefaults, sampleVolumeMl: "25", precipitateMassG: "0.015", paperMassG: "0.912", watchGlassMassG: "31.2" };
    const { lab } = await labs3d.loadLab3D(hardWater, values);
    const state = playLab(lab, entries(values, "600", "32.1270"), hardWaterMoves);
    expect(state.completedNodes).toHaveLength(59);
    expect(hardnessOf(state)?.expected).toBeCloseTo(600, 6);
  });
});
