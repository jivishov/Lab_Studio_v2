import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import type { ActionDefinition, EquipmentInstance, RuntimeState, TechniqueDefinition } from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { resolveLiquidStyle } from "../../equipment/liquidRendering";
import { createRuntimeState, performRuntimeAction } from "../../runtime";
import { resolveInteractionIntent, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { BENCH_MM, fromBench, RUNTIME_BENCH_PX, toBench, benchPositionWords } from "../adapters/benchCoordinates";
import { instrumentDisplay } from "../adapters/instrumentDisplay";
import { fillLevelMm, runtimeToScene } from "../adapters/runtimeToScene";
import { equipment3dEntry } from "../equipment3d/readiness";
import { fallbackWorkbenchSize } from "../../player/workbenchViewTransform";

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;

const PACK_1 = ["weighing", "measuring-volume", "making-solution", "dilution", "transmittance-dilution"];

describe("benchCoordinates", () => {
  it("uses the 2D player's minimum logical workbench", () => {
    expect(RUNTIME_BENCH_PX).toEqual(fallbackWorkbenchSize);
  });

  it("round-trips runtime bench units through bench millimetres", () => {
    for (const point of [{ x: 34, y: 86 }, { x: 330, y: 246 }, { x: 626, y: 86 }]) {
      const bench = toBench("wash-bottle", point);
      const back = fromBench("wash-bottle", bench.xMm, bench.yMm);
      expect(back.x).toBeCloseTo(point.x, 0);
      expect(back.y).toBeCloseTo(point.y, 0);
    }
  });

  it("keeps runtime rotation as read-only yaw and clamps to the bench surface", () => {
    expect(toBench("wash-bottle", { x: 34, y: 86, rotation: 15 }).yawDeg).toBe(15);
    const far = toBench("wash-bottle", { x: 100_000, y: 100_000 });
    expect(Math.abs(far.xMm)).toBeLessThanOrEqual(BENCH_MM.width / 2);
    expect(Math.abs(far.yMm)).toBeLessThanOrEqual(BENCH_MM.depth / 2);
    const clamped = fromBench("wash-bottle", 10_000, -10_000);
    expect(clamped.x).toBeGreaterThan(0);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
  });

  it("describes positions in words for the Bench list", () => {
    expect(benchPositionWords(0, 0)).toBe("middle centre");
    expect(benchPositionWords(-500, 250)).toBe("back left");
  });
});

describe("runtimeToScene: Pack 1 initial states", () => {
  it.each(PACK_1)("%s starts with everything in the tray and a model for every definition", (id) => {
    const technique = readTechnique(id);
    const state = createRuntimeState(technique);
    const scene = runtimeToScene(state, technique);
    expect(scene.missingModels).toEqual([]);
    const shelved = state.equipmentInstances.filter((instance) => instance.location === "shelf").map((i) => i.id);
    expect(scene.tray.map((item) => item.instanceId).sort()).toEqual([...shelved].sort());
    const onBench = new Set(scene.bench.map((item) => item.instanceId));
    expect(shelved.filter((instanceId) => onBench.has(instanceId))).toEqual([]);
  });
});

describe("runtimeToScene: contents and scenery", () => {
  const instance = (patch: Partial<EquipmentInstance>): EquipmentInstance => ({
    id: "x-1",
    definitionId: "graduated-cylinder",
    label: "Graduated cylinder",
    location: "workbench",
    x: 200,
    y: 100,
    contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" },
    ...patch,
  });
  const stateWith = (instances: EquipmentInstance[]): RuntimeState => {
    const base = createRuntimeState(readTechnique("measuring-volume"));
    return { ...base, equipmentInstances: instances, attachments: [] };
  };

  it("draws a liquid at the fill-profile level, coloured by the one palette", () => {
    const contents = { kind: "liquid" as const, label: "Water sample", volumeMl: 50, solutes: [], contamination: [], wetState: "wet" as const, visualState: "clear-liquid" };
    const scene = runtimeToScene(stateWith([instance({ contents })]), { actions: [] });
    const item = scene.bench[0];
    expect(item.contents.kind).toBe("liquid");
    const fill = equipment3dEntry("graduated-cylinder")!.fill!;
    const bore = fill.innerProfileMm![3][0];
    const floor = fill.innerProfileMm![0][1];
    if (item.contents.kind === "liquid") {
      expect(item.contents.levelMm).toBeCloseTo(fillLevelMm(fill, 50).levelMm, 6);
      expect(item.contents.levelMm).toBeGreaterThan(floor + (50_000 / (Math.PI * bore * bore)) - 1);
      expect(item.contents.style).toEqual(resolveLiquidStyle(contents, equipmentById.get("graduated-cylinder")));
    }
    expect(item.contentsText).toBe("50 mL water sample");
  });

  it("draws nothing for empty contents", () => {
    expect(runtimeToScene(stateWith([instance({})]), { actions: [] }).bench[0].contents).toEqual({ kind: "none" });
  });

  it("stands a bench test tube in visual-only rack scenery that is never an instance", () => {
    const scene = runtimeToScene(stateWith([instance({ id: "tube-1", definitionId: "test-tube", label: "Tube" })]), { actions: [] });
    expect(scene.bench).toHaveLength(1);
    expect(scene.bench[0].scenery?.sceneryId).toBe("test-tube-rack");
    expect(scene.bench.map((item) => item.definitionId)).not.toContain("test-tube-rack");
  });

  it("hides storage and oven items, as the 2D player does", () => {
    const scene = runtimeToScene(stateWith([instance({ location: "storage" }), instance({ id: "x-2", location: "oven" })]), { actions: [] });
    expect(scene.hidden).toEqual(["x-1", "x-2"]);
    expect(scene.bench).toEqual([]);
    expect(scene.tray).toEqual([]);
  });
});

describe("weighing through the real runtime: the balance display stays measurement-neutral", () => {
  const weighing = applyTechniqueConfiguration(readTechnique("weighing"), {});
  const act = (state: RuntimeState, intent: RuntimeInteractionIntent): RuntimeState => {
    const result = resolveInteractionIntent(weighing, state, intent);
    expect(result.ok, result.ok ? "" : result.feedback.message).toBe(true);
    return result.ok ? performRuntimeAction(weighing, state, result.request) : state;
  };
  const moveToBench = (state: RuntimeState, definitionId: string, x: number, y: number): RuntimeState =>
    performRuntimeAction(weighing, state, {
      verb: "place", equipmentDefinitionId: definitionId, location: "workbench", parameters: { benchMove: true, x, y, zIndex: 1 },
    });
  const balanceLines = (state: RuntimeState) =>
    runtimeToScene(state, weighing).bench.find((item) => item.definitionId === "analytical-balance")?.display?.lines;

  it("shows nothing before the learner's entry and only the entry after it", () => {
    let state = createRuntimeState(weighing);
    state = act(state, { type: "placeIntent", sourceDefinitionId: "watch-glass", stationId: "workbench", x: 200, y: 120 });
    state = moveToBench(state, "analytical-balance", 420, 60);
    expect(balanceLines(state)).toEqual([]);
    state = act(state, {
      type: "instrumentReadIntent",
      sourceInstanceId: "watch-glass-1",
      targetInstanceId: "analytical-balance-1",
      value: 12.345,
    });
    expect(balanceLines(state)).toEqual([{ key: "entry:standalone-mass-measurement-id", text: "12.345 g", source: "entry" }]);
    state = act(state, { type: "notebookRecordIntent" });
    const final = runtimeToScene(state, weighing);
    expect(final.bench.map((item) => item.definitionId).sort()).toEqual(["analytical-balance", "watch-glass"]);
    expect(final.missingModels).toEqual([]);
    // The runtime's weigh neither seats nor moves the watch glass (plan §2.4): the resting scene
    // keeps it on the bench, not on the pan.
    expect(final.bench.find((item) => item.definitionId === "watch-glass")?.placement.kind).toBe("bench");
  });
});

describe("instrumentDisplay: the photometer shows settings, zero status and the learner's entry only", () => {
  const action = (id: string, parameters: ActionDefinition["parameters"]): ActionDefinition => ({
    id, verb: "observe", label: id, parameters, prerequisites: [], stateChanges: [],
  } as unknown as ActionDefinition);
  const definition = {
    actions: [
      action("configure", { photometerInstanceId: "p-1", measurementId: "wl", inputMode: "numeric", inputRole: "teacherConfiguration", unit: "nm" }),
      action("zero", { photometerInstanceId: "p-1", photometerOperation: "zero", tag: "generic-photometer-blanked" }),
      action("read", { photometerInstanceId: "p-1", photometerOperation: "read", photometricQuantity: "percentTransmittance",
        measurementId: "percent-transmittance", inputMode: "numeric", inputRole: "studentResponse", unit: "%T" }),
    ],
    process: { nodes: [{ id: "n-configure", actionId: "configure" }, { id: "n-zero", actionId: "zero" }, { id: "n-read", actionId: "read" }] },
  };
  const photometer = { id: "p-1", definitionId: "spectrophotometer", label: "Spectrophotometer", location: "workbench",
    contents: { kind: "empty", label: "empty", solutes: [], contamination: [], wetState: "dry", visualState: "empty" } } as EquipmentInstance;
  const base = createRuntimeState(readTechnique("measuring-volume"));
  const policy = "photometer-settings-status-and-entry";
  const measurement = (id: string, value: number, unit: string) => ({ id, label: id, value, unit, nodeId: "n" });

  it("is blank with no runtime evidence", () => {
    expect(instrumentDisplay(policy, definition, base, photometer).lines).toEqual([]);
  });

  it("adds each line only when its runtime record exists", () => {
    const configured = { ...base, measurements: [measurement("wl", 630, "nm")] };
    expect(instrumentDisplay(policy, definition, configured, photometer).lines.map((l) => [l.key, l.source]))
      .toEqual([["wavelength", "teacher"]]);
    const applied = { ...configured, completedNodes: ["n-configure"] };
    expect(instrumentDisplay(policy, definition, applied, photometer).lines.map((l) => l.key)).toEqual(["wavelength", "mode"]);
    const zeroed = { ...applied, notebook: [{ id: "e", timestamp: "", nodeId: "n-zero", type: "observation" as const,
      label: "", value: "", tags: ["generic-photometer-blanked", "wavelength:630nm"] }] };
    expect(instrumentDisplay(policy, definition, zeroed, photometer).lines.map((l) => l.text))
      .toEqual(["630 nm", "%T", "Zeroed on blank"]);
    const read = { ...zeroed, measurements: [...zeroed.measurements, measurement("percent-transmittance", 41.2, "%T")] };
    expect(instrumentDisplay(policy, definition, read, photometer).lines.at(-1)).toEqual({
      key: "entry:percent-transmittance", text: "41.2 %T", source: "entry",
    });
  });

  it("does not count a zero at another wavelength", () => {
    const state = { ...base, measurements: [measurement("wl", 630, "nm")], notebook: [{ id: "e", timestamp: "", nodeId: "n-zero",
      type: "observation" as const, label: "", value: "", tags: ["generic-photometer-blanked", "wavelength:450nm"] }] };
    expect(instrumentDisplay(policy, definition, state, photometer).lines.map((l) => l.key)).not.toContain("blank");
  });

  it("shows nothing for an unknown policy", () => {
    expect(instrumentDisplay("invented-policy", definition, base, photometer).lines).toEqual([]);
  });
});
