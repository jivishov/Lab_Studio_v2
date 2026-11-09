import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createRuntimeState, type RuntimeDefinition } from "../../runtime";
import { BENCH_MM } from "../adapters/benchCoordinates";
import { applyView, DEFAULT_VIEW } from "../bench/camera/benchCamera";
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
      expect(spot.point.xMm - spot.widthMm / 2).toBeGreaterThan(BENCH_MM.right - 100);
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

  it("gives an item that reaches the shelf later a free gap, moving none of the start items", () => {
    const instances = [
      { id: "a", definitionId: "beaker-150ml", location: "shelf" },
      { id: "b", definitionId: "volumetric-flask", location: "workbench" },
      { id: "c", definitionId: "beaker-250ml", location: "shelf" },
      { id: "d", definitionId: "funnel", location: "shelf" },
    ];
    const start = ["a", "c", "d"];
    const before = shelfSpots(stableShelfOrder(instances, start));
    expect([...before.keys()].sort()).toEqual(["a", "c", "d"]);
    const later = shelfSpots(stableShelfOrder(instances.map((i) => i.id === "b" ? { ...i, location: "shelf" } : i), start));
    for (const id of start) expect(later.get(id)).toEqual(before.get(id));
    const b = later.get("b")!;
    expect(b.place).toBe("tier");
    expect(b.overflow).toBeUndefined();
    // Clear of every item on its tier.
    for (const id of start) {
      const s = later.get(id)!;
      if (s.tier !== b.tier) continue;
      expect(Math.abs(s.centre.xMm - b.centre.xMm)).toBeGreaterThanOrEqual((s.widthMm + b.widthMm) / 2);
    }
  });

  it("spreads each tier's items along it, sharing them between the tiers, so neighbours stand at least 44 px apart at Home", () => {
    // The labs' shelves, in start order (compiled with their default setup, 2026-10-11).
    const labs: Record<string, string[]> = {
      "hard-water-demo": ["beral-pipette", "graduated-cylinder-25ml", "beaker-250ml", "stirring-rod", "beral-pipette", "ring-stand",
        "funnel", "filter-paper", "erlenmeyer-flask-250ml", "watch-glass", "crucible-tongs", "scoopula"],
      "paper-chromatography": ["chromatography-chamber", "chromatography-chamber", "chromatography-paper", "chromatography-paper",
        "distilled-water-bottle", "propanol-bottle", "graduated-cylinder", "pencil", "capillary-spotter", "small-vial", "metric-ruler"],
    };
    const shelves = [
      ...["transmittance-dilution", "dilution", "making-solution", "paper-chromatography-practice", "thermal-decomposition-mass-loss-practice"]
        .map((id) => ({ id, spots: startSpots(technique3d(id)).spots })),
      ...Object.entries(labs).map(([id, items]) => ({ id, spots: shelfSpots(items.map((definitionId, i) => ({ instanceId: `${definitionId}-${i}`, definitionId }))) })),
    ];
    const camera = new THREE.PerspectiveCamera();
    applyView(camera, DEFAULT_VIEW(), 1024 / 700);
    const onScreen = (s: ShelfSpot) => {
      const q = new THREE.Vector3(s.centre.xMm / 1000, (s.zMm + s.heightMm / 2) / 1000, -s.centre.yMm / 1000).project(camera);
      return { x: (q.x + 1) * 512, y: (1 - q.y) * 350 };
    };
    for (const { id, spots } of shelves) {
      const tiers = [...spots.values()].filter((s) => s.place === "tier");
      const counts = [0, 1].map((tier) => tiers.filter((s) => s.tier === tier).length);
      // Shared: the tiers hold within two of each other (the tall items alone may tip it).
      expect(Math.abs(counts[0] - counts[1]), id).toBeLessThanOrEqual(2);
      const points = tiers.map(onScreen);
      points.forEach((a, i) => points.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.x - b.x, a.y - b.y), id).toBeGreaterThanOrEqual(44);
      }));
      // Spread: each tier's items reach past the shelf's middle from its left half.
      for (const tier of [0, 1]) {
        const xs = tiers.filter((s) => s.tier === tier).map((s) => s.centre.xMm);
        if (xs.length > 1) expect(Math.max(...xs) - Math.min(...xs), id).toBeGreaterThan(SHELF.lengthMm / 2);
      }
    }
  });

  it("matches the reagent shelf model the room draws", () => {
    const shelf = equipment3dRegistry.entries.find((entry) => entry.definitionId === SHELF.id);
    expect(shelf?.scenery).toBe(true);
    const bounds = shelf!.boundsMm!;
    // Its boards are the shelf's length; the spine's sockets and tap (the lab room, 2026-10-16) stand past its ends,
    // inside the 1300 mm section pitch (reagent_shelf.py), so the next section's fittings never meet them.
    expect(shelf!.footprintMm).toMatchObject({ shape: "rect", width: SHELF.lengthMm });
    expect(bounds.max[0] - bounds.min[0]).toBeGreaterThanOrEqual(SHELF.lengthMm);
    expect(bounds.max[0] - bounds.min[0]).toBeLessThan(1300);
    // The board is the shelf's depth; the label rail stands 2 mm proud of its front edge.
    expect(Math.abs(bounds.max[1] - bounds.min[1] - SHELF.depthMm)).toBeLessThanOrEqual(3);
    expect(bounds.max[2]).toBeGreaterThanOrEqual(SHELF.tierTopsMm[1]);
    // Its top, which Home keeps in view (camera/home.ts).
    expect(Math.abs(bounds.max[2] - SHELF.heightMm)).toBeLessThanOrEqual(1);
  });
});
