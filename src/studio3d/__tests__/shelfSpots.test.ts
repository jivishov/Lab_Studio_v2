import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntimeState, type RuntimeDefinition } from "../../runtime";
import { BENCH_MM } from "../adapters/benchCoordinates";
import { LOWER_TIER_CLEAR_MM, SHELF, SIDE_STATION, shelfSpots, stableShelfOrder, type ShelfSpot } from "../adapters/shelfSpots";
import { equipment3dRegistry } from "../equipment3d/readiness";

const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const technique3d = (id: string): RuntimeDefinition => {
  const entry = (read("public/techniques-3d/index.json") as Array<{ id: string; file: string }>).find((t) => t.id === id);
  return read(entry ? `public/techniques-3d/${entry.file}` : `public/techniques/${id}.json`);
};
const startSpots = (definition: RuntimeDefinition) => {
  const state = createRuntimeState(definition);
  const shelf = state.equipmentInstances.filter((instance) => instance.location === "shelf");
  const spots = shelfSpots(stableShelfOrder(state.equipmentInstances, undefined));
  return { state, shelf, spots };
};

describe("the shelf's spots (option B, approved 2026-10-11)", () => {
  it("puts transmittance-dilution's 13 on the shelf: 12 on the tiers, the spectrophotometer at the side station", () => {
    const { shelf, spots } = startSpots(technique3d("transmittance-dilution"));
    expect(shelf).toHaveLength(13);
    const placed = shelf.map((instance) => ({ id: instance.definitionId, spot: spots.get(instance.id)! }));
    expect(placed.every(({ spot }) => spot && !spot.overflow)).toBe(true);
    expect(placed.filter(({ spot }) => spot.place === "tier")).toHaveLength(12);
    expect(placed.filter(({ spot }) => spot.place === "station").map(({ id }) => id)).toEqual(["spectrophotometer"]);
  });

  it("stands Heat and Reweigh's four large items at the side station, within it and apart", () => {
    const { shelf, spots } = startSpots(technique3d("thermal-decomposition-mass-loss-practice"));
    const large = shelf.filter((instance) => spots.get(instance.id)?.place === "station");
    expect(large.map((instance) => instance.definitionId).sort())
      .toEqual(["analytical-balance", "analytical-balance", "bunsen-burner", "ring-stand"]);
    const boxes = large.map((instance) => spots.get(instance.id)!);
    for (const spot of boxes) {
      expect(spot.overflow).toBeUndefined();
      expect(spot.zMm).toBe(0);
      // The station is past the working area's right end.
      expect(spot.point.xMm - spot.widthMm / 2).toBeGreaterThan(BENCH_MM.width / 2 - 100);
    }
    // No two large items share bench: their x ranges or their y ranges are apart.
    const range = (s: ShelfSpot, model: string) => {
      const entry = equipment3dRegistry.entries.find((e) => e.definitionId === model)!;
      return { x0: s.point.xMm + entry.boundsMm!.min[0], x1: s.point.xMm + entry.boundsMm!.max[0], y0: s.point.yMm + entry.boundsMm!.min[1], y1: s.point.yMm + entry.boundsMm!.max[1] };
    };
    const rects = large.map((instance) => range(spots.get(instance.id)!, instance.definitionId));
    for (const r of rects) {
      expect(r.x0).toBeGreaterThanOrEqual(SIDE_STATION.xMinMm - 0.1);
      expect(r.x1).toBeLessThanOrEqual(SIDE_STATION.xMaxMm + 0.1);
      expect(r.y0).toBeGreaterThanOrEqual(SIDE_STATION.yMinMm - 0.1);
      expect(r.y1).toBeLessThanOrEqual(SIDE_STATION.yMaxMm + 0.1);
    }
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
      expect(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0).toBe(true);
    }));
  });

  it("lays long items along a tier and stands tall ones on the upper tier", () => {
    const spots = shelfSpots([
      { instanceId: "pipette", definitionId: "graduated-pipette-10ml" },
      { instanceId: "tongs", definitionId: "crucible-tongs" },
      { instanceId: "rod", definitionId: "stirring-rod" },
      { instanceId: "pencil", definitionId: "pencil" },
      { instanceId: "ruler", definitionId: "metric-ruler" },
      { instanceId: "bottle", definitionId: "sample-bottle-1l" },
      { instanceId: "cylinder", definitionId: "graduated-cylinder" },
      { instanceId: "wash", definitionId: "wash-bottle" },
    ]);
    for (const id of ["pipette", "tongs", "rod", "pencil", "ruler"]) {
      const spot = spots.get(id)!;
      expect(spot.place).toBe("tier");
      // Its length runs along the tier, and its depth fits the shelf.
      expect(spot.widthMm).toBeGreaterThan(spot.depthMm);
      expect(spot.depthMm).toBeLessThanOrEqual(SHELF.depthMm);
    }
    for (const id of ["bottle", "cylinder", "wash"]) {
      const spot = spots.get(id)!;
      expect(spot.heightMm).toBeGreaterThan(LOWER_TIER_CLEAR_MM - 12);
      expect(spot.tier).toBe(1);
      expect(spot.zMm).toBe(SHELF.tierTopsMm[1]);
    }
    expect(spots.get("pipette")!.point.yawDeg).toBe(90);
    expect(spots.get("tongs")!.point.yawDeg).toBe(0); // modelled along x already
  });

  it("gives distinct spots that stay put as items leave the shelf and come back", () => {
    for (const id of ["transmittance-dilution", "thermal-decomposition-mass-loss-practice", "dilution"]) {
      const { state, shelf, spots } = startSpots(technique3d(id));
      const start = shelf.map((instance) => instance.id);
      expect(new Set([...spots.values()].map((s) => `${s.place}${s.tier}:${s.point.xMm},${s.point.yMm}`)).size).toBe(spots.size);
      // Every item but the first goes to the bench: the first keeps its spot, and so does each one later put back.
      const moved = state.equipmentInstances.map((instance) => start.includes(instance.id) && instance.id !== start[0]
        ? { ...instance, location: "workbench" as const } : instance);
      const after = shelfSpots(stableShelfOrder(moved, start));
      expect(after.get(start[0])).toEqual(spots.get(start[0]));
      for (const instanceId of start) expect(after.get(instanceId)).toEqual(spots.get(instanceId));
      // The same members always give the same spots.
      expect(shelfSpots(stableShelfOrder(state.equipmentInstances, start))).toEqual(spots);
    }
  });

  it("keeps the items on a tier apart and within the shelf", () => {
    for (const id of ["transmittance-dilution", "paper-chromatography-practice", "dilution", "drying-practice"]) {
      const { spots } = startSpots(technique3d(id));
      for (const tier of [0, 1] as const) {
        const row = [...spots.entries()].filter(([, s]) => s.place === "tier" && s.tier === tier);
        const ranges = row.map(([, s]) => ({ x0: s.centre.xMm - s.widthMm / 2, x1: s.centre.xMm + s.widthMm / 2 }));
        for (const r of ranges) {
          expect(r.x0).toBeGreaterThanOrEqual(SHELF.centre.xMm - SHELF.lengthMm / 2 + SHELF.uprightMm);
          expect(r.x1).toBeLessThanOrEqual(SHELF.centre.xMm + SHELF.lengthMm / 2 - SHELF.uprightMm);
        }
        ranges.sort((a, b) => a.x0 - b.x0).forEach((r, i, all) => {
          if (i > 0) expect(r.x0).toBeGreaterThanOrEqual(all[i - 1].x1);
        });
      }
    }
  });

  it("gives an item that reaches the shelf later the next free place, after the start items", () => {
    const instances = [
      { id: "a", definitionId: "beaker-150ml", location: "shelf" },
      { id: "b", definitionId: "volumetric-flask", location: "workbench" },
      { id: "c", definitionId: "beaker-250ml", location: "shelf" },
    ];
    const start = ["a", "c"];
    const before = shelfSpots(stableShelfOrder(instances, start));
    expect([...before.keys()]).toEqual(["a", "c"]);
    const later = shelfSpots(stableShelfOrder(instances.map((i) => i.id === "b" ? { ...i, location: "shelf" } : i), start));
    expect(later.get("a")).toEqual(before.get("a"));
    expect(later.get("c")).toEqual(before.get("c"));
    expect(later.get("b")!.point.xMm).toBeGreaterThan(later.get("c")!.point.xMm);
  });

  it("matches the reagent shelf model the room draws", () => {
    const shelf = equipment3dRegistry.entries.find((entry) => entry.definitionId === SHELF.id);
    expect(shelf?.scenery).toBe(true);
    const bounds = shelf!.boundsMm!;
    expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(SHELF.lengthMm, 0);
    // The board is the shelf's depth; the label rail stands 2 mm proud of its front edge.
    expect(Math.abs(bounds.max[1] - bounds.min[1] - SHELF.depthMm)).toBeLessThanOrEqual(3);
    expect(bounds.max[2]).toBeGreaterThanOrEqual(SHELF.tierTopsMm[1]);
  });
});
