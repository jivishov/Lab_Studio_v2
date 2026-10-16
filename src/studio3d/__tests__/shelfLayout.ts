import { expect } from "vitest";
import type { RuntimeState } from "../../domain/types";
import { runtimeToScene, type SceneDefinition } from "../adapters/runtimeToScene";
import { isLargeStation, SHELF, SIDE_STATION, type ShelfSpot } from "../adapters/shelfSpots";

/**
 * Tray-to-shelf build, phase 4: the 3D scene's shelf at one moment of a run. Every item on the runtime's shelf is
 * drawn on a spot of its own: a large station at the side station, anything else on a tier within the shelf, none
 * past the end of its space and none overlapping a neighbour on its tier. An item that started on the shelf is back
 * on its start spot whenever it is there (pass `start`, the spots of the run's first state).
 */
export const shelfLaidOut = (state: RuntimeState, definition: SceneDefinition, label: string, start?: ReadonlyMap<string, ShelfSpot>) => {
  const scene = runtimeToScene(state, definition);
  const onShelf = state.equipmentInstances.filter((instance) => instance.location === "shelf").map((instance) => instance.id);
  expect(scene.tray.map((item) => item.instanceId).sort(), `${label}: drawn on the shelf`).toEqual([...onShelf].sort());
  for (const { instanceId, definitionId, spot } of scene.tray) {
    const what = `${label}: ${instanceId}`;
    expect(spot.overflow, `${what} past the end`).toBeUndefined();
    expect(spot.place, what).toBe(isLargeStation(definitionId) ? "station" : "tier");
    const x0 = spot.centre.xMm - spot.widthMm / 2, x1 = spot.centre.xMm + spot.widthMm / 2;
    if (spot.place === "tier") {
      expect(x0, what).toBeGreaterThanOrEqual(SHELF.centre.xMm - SHELF.lengthMm / 2 + SHELF.uprightMm);
      expect(x1, what).toBeLessThanOrEqual(SHELF.centre.xMm + SHELF.lengthMm / 2 - SHELF.uprightMm);
    } else {
      expect(x0, what).toBeGreaterThanOrEqual(SIDE_STATION.xMinMm);
      expect(x1, what).toBeLessThanOrEqual(SIDE_STATION.xMaxMm);
    }
    const first = start?.get(instanceId);
    if (first) expect(spot, `${what} back on its start spot`).toEqual(first);
  }
  for (const tier of [0, 1]) {
    const row = scene.tray.filter((item) => item.spot.place === "tier" && item.spot.tier === tier)
      .map(({ spot }) => ({ x0: spot.centre.xMm - spot.widthMm / 2, x1: spot.centre.xMm + spot.widthMm / 2 }))
      .sort((a, b) => a.x0 - b.x0);
    row.forEach((r, i) => { if (i > 0) expect(r.x0, `${label}: tier ${tier} apart`).toBeGreaterThanOrEqual(row[i - 1].x1); });
  }
  return new Map(scene.tray.map((item) => [item.instanceId, item.spot]));
};
