import type { RuntimeState } from "../../domain/types";
import { BENCH_CENTRE_X_MM, toBench, USABLE_DEPTH_MM, USABLE_WIDTH_MM, type BenchPointMm, type RuntimeBenchPoint } from "./benchUnits";
import { stableWorkbenchNodes } from "./stableBench";

/**
 * Runtime bench units and the 3D bench (plan §2.3, §4.1, §11). The conversion itself, `toBench` and `fromBench`,
 * lives in benchUnits.ts and is re-exported here; this file adds where each bench item stands.
 */
export {
  ART_MM_PER_PX,
  BENCH_CENTRE_X_MM,
  BENCH_MM,
  fromBench,
  MM_PER_PX_DEPTH,
  MM_PER_PX_X,
  RUNTIME_BENCH_PX,
  toBench,
  type BenchPointMm,
  type RuntimeBenchPoint,
  USABLE_LEFT_MM,
  USABLE_RIGHT_MM,
} from "./benchUnits";

/**
 * Where each bench item stands, in runtime bench units. An item with coordinates of its own stands
 * there, as in 2D. The runtime moves some items onto the bench without coordinates (a pour's target
 * leaves the shelf with no `x` or `y`, as does a step's placement by Confirm); 2D stands each at the
 * default slot of its render order, so items shifted as others came and went. The 3D bench keeps
 * each such item in one spot for the whole run instead (stableBench.ts, decided 2026-10-11), clear of
 * every other by its real footprint (decided 2026-10-22). The runtime's units are untouched, so a
 * saved state loads in either player (G-3).
 */
export const runtimeBenchPoints = (
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">,
): Map<string, RuntimeBenchPoint> =>
  new Map(stableWorkbenchNodes(state).map((node) => [node.primaryInstanceId, { x: node.transform.x, y: node.transform.y }]));

/** `runtimeBenchPoints` in bench millimetres. */
export const runtimeBenchPointsMm = (
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">,
): Map<string, BenchPointMm> => {
  const byId = new Map(state.equipmentInstances.map((instance) => [instance.id, instance]));
  const points = new Map<string, BenchPointMm>();
  for (const [id, point] of runtimeBenchPoints(state)) {
    const instance = byId.get(id);
    if (instance) points.set(id, toBench(instance.definitionId, point));
  }
  return points;
};

/** Bench millimetres -> a position in words, for the Bench list and announcements (§5.11). */
export const benchPositionWords = (xMm: number, yMm: number): string => {
  const depth = yMm > USABLE_DEPTH_MM / 6 ? "back" : yMm < -USABLE_DEPTH_MM / 6 ? "front" : "middle";
  const across = xMm - BENCH_CENTRE_X_MM;
  const side = across < -USABLE_WIDTH_MM / 6 ? "left" : across > USABLE_WIDTH_MM / 6 ? "right" : "centre";
  return `${depth} ${side}`;
};
