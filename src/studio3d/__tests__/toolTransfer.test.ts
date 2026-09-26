import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyTechniqueConfiguration } from "../../data/techniqueConfiguration";
import { resolveActionInteraction } from "../../domain/interactions";
import type { TechniqueDefinition } from "../../domain/types";
import type { BenchOverlapResult } from "../../player/benchOverlap";
import { createRuntimeState } from "../../runtime";
import { pointInFootprint, resolveToolRelease, toolTransferFor, type ToolTransfer } from "../adapters/sceneToIntent";
import { equipment3dEntry } from "../equipment3d/readiness";
import { currentStepEquipmentIds } from "../player/stepRules";

// Weighing's transfer is made with the spatula (decided 2026-09-25): dip it into the reagent
// bottle, carry it to the watch glass. The runtime records the same bottle-to-glass transfer.
const weighing = applyTechniqueConfiguration(
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", "weighing.json"), "utf8")) as TechniqueDefinition,
  { solidMassG: "2.037" },
);
const transfer = weighing.actions.find((action) => action.id === "transfer-sodium-carbonate-to-watch-glass")!;
const interaction = resolveActionInteraction(transfer);
const instances = createRuntimeState(weighing).equipmentInstances;

const over = (id: string, definitionId: string, kind: BenchOverlapResult["kind"] = "valid"): BenchOverlapResult =>
  ({ kind, target: { id, definitionId, x: 0, y: 0, width: 10, height: 10 }, overlapRatio: 0.5 });

describe("toolTransferFor", () => {
  it("names the spatula, the bottle and the glass at weighing's transfer step", () => {
    expect(toolTransferFor(transfer, interaction, instances, false)).toEqual({
      toolDefinitionId: "spatula",
      sourceInstanceId: "reagent-bottle-1",
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "watch-glass",
    });
  });

  it("is undefined once the step is done, at a step with no tool, or when the source holds no solid", () => {
    expect(toolTransferFor(transfer, interaction, instances, true)).toBeUndefined();
    const place = weighing.actions.find((action) => action.id === "place-watch-glass")!;
    expect(toolTransferFor(place, resolveActionInteraction(place), instances, false)).toBeUndefined();
    const emptied = instances.map((instance) => (instance.id === "reagent-bottle-1"
      ? { ...instance, contents: { ...instance.contents, kind: "empty" as const } } : instance));
    expect(toolTransferFor(transfer, interaction, emptied, false)).toBeUndefined();
  });
});

describe("resolveToolRelease", () => {
  const tool = toolTransferFor(transfer, interaction, instances, false) as ToolTransfer;

  it("sends the step's own bottle-to-glass pour when the dipped spatula is released over the glass", () => {
    const release = resolveToolRelease(tool, { definitionId: "spatula", loaded: true }, over("watch-glass-1", "watch-glass"), "pointer");
    expect(release).toEqual({
      kind: "transfer",
      intent: {
        type: "pourIntent",
        origin: "pointer",
        sourceInstanceId: "reagent-bottle-1",
        targetInstanceId: "watch-glass-1",
        sourceDefinitionId: "reagent-bottle",
        targetDefinitionId: "watch-glass",
      },
    });
  });

  it("sends nothing for a spatula that was not dipped, or released over anything but the glass", () => {
    expect(resolveToolRelease(tool, { definitionId: "spatula", loaded: false }, over("watch-glass-1", "watch-glass"), "pointer")).toEqual({ kind: "none" });
    expect(resolveToolRelease(tool, { definitionId: "spatula", loaded: true }, over("analytical-balance-1", "analytical-balance"), "pointer")).toEqual({ kind: "none" });
    expect(resolveToolRelease(tool, { definitionId: "spatula", loaded: true }, over("watch-glass-1", "watch-glass", "invalid"), "pointer")).toEqual({ kind: "none" });
    expect(resolveToolRelease(tool, { definitionId: "spatula", loaded: true }, { kind: "moveOnly", overlapRatio: 0 }, "pointer")).toEqual({ kind: "none" });
  });

  it("refuses the bottle tipped onto the glass in favour of the spatula", () => {
    expect(resolveToolRelease(tool, { definitionId: "reagent-bottle", loaded: false }, over("watch-glass-1", "watch-glass"), "vision")).toEqual({ kind: "useTool" });
  });
});

describe("pointInFootprint", () => {
  const footprint = { xMm: 100, yMm: 50, widthMm: 40, depthMm: 20 };
  it("includes the edges and excludes points outside", () => {
    expect(pointInFootprint(footprint, { xMm: 100, yMm: 50 })).toBe(true);
    expect(pointInFootprint(footprint, { xMm: 120, yMm: 60 })).toBe(true);
    expect(pointInFootprint(footprint, { xMm: 121, yMm: 50 })).toBe(false);
    expect(pointInFootprint(footprint, { xMm: 100, yMm: 39 })).toBe(false);
  });
});

describe("the tray's needed-now marks", () => {
  it("add the step's tool to its source and target", () => {
    expect(currentStepEquipmentIds(interaction, "spatula")).toEqual(["reagent-bottle", "watch-glass", "spatula"]);
    expect(currentStepEquipmentIds(interaction)).toEqual(["reagent-bottle", "watch-glass"]);
  });
});

describe("the balance's TARE key and the spatula's scoop", () => {
  it("are in the registry the viewer reads", () => {
    const tare = equipment3dEntry("analytical-balance")?.controls?.find((control) => control.id === "tare");
    expect(tare).toMatchObject({ operation: "zero", label: "TARE", objects: ["Balance_key_tare", "Balance_key_tare_legend"] });
    expect(equipment3dEntry("spatula")?.solidRest).toMatchObject({ radiusMm: 4 });
  });
});
