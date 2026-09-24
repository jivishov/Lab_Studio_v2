import { isVisibleWorkbenchLocation } from "../../domain/equipmentLocations";
import type { EquipmentInstance, RuntimeState } from "../../domain/types";
import { getBenchSize } from "../../equipment/visualCatalog";
import type { BenchBounds } from "../../player/benchOverlap";
import { benchOccupiedBoundsFromNodes } from "../../player/benchTargeting";
import { resolveWorkbenchScene } from "../../player/resolveWorkbenchScene";
import { RUNTIME_BENCH_PX } from "./benchCoordinates";

/**
 * The 2D player's placement rules, in runtime bench units, so that the 3D bench puts things where
 * the 2D bench would (plan §4.5; handoff §5.6, §5.10):
 * - `nextPlacementPoint`: where a tray item goes on click or Enter (`StudentPlayer.nextPlacementPoint`);
 * - `parkPointAfterInteraction`: where a pour's source is set down afterwards
 *   (`Workbench.parkAfterInteraction`, fed the way `Workbench.finishMove` feeds it).
 *
 * Both rules are private to their 2D files. Exporting them would be a 2D edit outside plan §4.7, so
 * their bodies are copied here word for word; what they read (render nodes, occupied bounds) comes
 * from the exported 2D helpers. The drift risk, and the proposal to move the rules into a shared
 * module both players import, are recorded in evidence/M5_EVIDENCE.md with `player/stepRules.ts`.
 */
interface BenchPoint {
  x: number;
  y: number;
}
interface Size {
  width: number;
  height: number;
}
interface SurfaceLimits {
  maxX: number;
  maxY: number;
}

// ---------------------------------------------------------------- StudentPlayer.nextPlacementPoint

const benchPointForIndex = (index: number): BenchPoint => ({ x: 34 + (index % 5) * 148, y: 86 + Math.floor(index / 5) * 160 });
const benchPointForDefinition = (definitionId: string, index: number): BenchPoint =>
  definitionId === "ring-stand-clamp" || definitionId === "ring-stand" ? { x: 270, y: 36 } : benchPointForIndex(index);
const placementOverlapRatio = (point: BenchPoint, size: Size, occupied: BenchPoint & Size): number => {
  const left = Math.max(point.x, occupied.x);
  const right = Math.min(point.x + size.width, occupied.x + occupied.width);
  const top = Math.max(point.y, occupied.y);
  const bottom = Math.min(point.y + size.height, occupied.y + occupied.height);
  const denominator = Math.min(size.width * size.height, occupied.width * occupied.height);
  return denominator > 0 ? (Math.max(0, right - left) * Math.max(0, bottom - top)) / denominator : 0;
};

/** The first of 18 default slots overlapping every placed item by under 5 %, else the next slot. */
export const nextPlacementPoint = (instances: readonly EquipmentInstance[], definitionId: string): BenchPoint => {
  const placed = instances.filter((item) => isVisibleWorkbenchLocation(item.location));
  const occupied = placed.map((item, index) => ({
    x: item.x ?? benchPointForIndex(index).x,
    y: item.y ?? benchPointForIndex(index).y,
    width: getBenchSize(item.definitionId).width,
    height: getBenchSize(item.definitionId).height,
  }));
  const size = getBenchSize(definitionId);
  for (let index = 0; index < 18; index += 1) {
    const point = benchPointForDefinition(definitionId, index);
    if (occupied.every((bounds) => placementOverlapRatio(point, size, bounds) < 0.05)) return point;
  }
  return benchPointForIndex(placed.length);
};

// ---------------------------------------------------------------- Workbench.parkAfterInteraction

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));
const surfaceLimits = (logicalSize: Size, size: Size = { width: 128, height: 128 }): SurfaceLimits => ({
  maxX: Math.max(8, logicalSize.width - size.width),
  maxY: Math.max(8, logicalSize.height - size.height),
});
const clampPoint = (point: BenchPoint, limits: SurfaceLimits): BenchPoint => ({
  x: clamp(point.x, 8, limits.maxX),
  y: clamp(point.y, 8, limits.maxY),
});
const overlapRatio = (point: BenchPoint, size: Size, occupied: BenchBounds): number => {
  const left = Math.max(point.x, occupied.x);
  const right = Math.min(point.x + size.width, occupied.x + occupied.width);
  const top = Math.max(point.y, occupied.y);
  const bottom = Math.min(point.y + size.height, occupied.y + occupied.height);
  return (Math.max(0, right - left) * Math.max(0, bottom - top)) / (size.width * size.height);
};
const boundsFromPoint = (point: BenchPoint, size: Size) => ({ x: point.x, y: point.y, width: size.width, height: size.height });
const boundsCenter = (bounds: BenchPoint & Size): BenchPoint => ({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
const containsPoint = (bounds: BenchPoint & Size, point: BenchPoint): boolean =>
  point.x > bounds.x && point.x < bounds.x + bounds.width && point.y > bounds.y && point.y < bounds.y + bounds.height;
const parkingConflictScore = (point: BenchPoint, occupied: BenchBounds[], size: Size): number => {
  const candidate = boundsFromPoint(point, size);
  const candidateCenter = boundsCenter(candidate);
  return occupied.reduce((score, bounds) => {
    const ratio = overlapRatio(point, size, bounds);
    const coversOccupiedCenter = containsPoint(candidate, boundsCenter(bounds));
    const centerInsideOccupied = containsPoint(bounds, candidateCenter);
    return score + ratio + (coversOccupiedCenter ? 2 : 0) + (centerInsideOccupied ? 1 : 0);
  }, 0);
};
const isClearParkingSpot = (point: BenchPoint, occupied: BenchBounds[], size: Size): boolean => {
  const candidate = boundsFromPoint(point, size);
  const candidateCenter = boundsCenter(candidate);
  return occupied.every((bounds) => {
    if (overlapRatio(point, size, bounds) >= 0.05) return false;
    return !containsPoint(candidate, boundsCenter(bounds)) && !containsPoint(bounds, candidateCenter);
  });
};
const distanceSquared = (a: BenchPoint, b: BenchPoint): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const parkAfterInteraction = (point: BenchPoint, occupied: BenchBounds[], limits: SurfaceLimits, size: Size): BenchPoint => {
  const seen = new Set<string>();
  const candidates: BenchPoint[] = [];
  const addCandidate = (candidate: BenchPoint) => {
    const clamped = clampPoint(candidate, limits);
    const key = `${Math.round(clamped.x)}:${Math.round(clamped.y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(clamped);
  };
  const offsets = [
    { x: -136, y: 264 }, { x: 0, y: 264 }, { x: 136, y: 264 }, { x: 264, y: 132 }, { x: -264, y: 132 }, { x: 264, y: 264 },
    { x: -264, y: 264 }, { x: 0, y: -180 }, { x: 84, y: 156 }, { x: 156, y: 42 }, { x: -132, y: 42 },
  ];
  for (const offset of offsets) addCandidate({ x: point.x + offset.x, y: point.y + offset.y });
  const strideX = Math.max(28, Math.min(72, size.width * 0.5));
  const strideY = Math.max(28, Math.min(72, size.height * 0.5));
  for (let y = 8; y <= limits.maxY; y += strideY) {
    for (let x = 8; x <= limits.maxX; x += strideX) addCandidate({ x, y });
    addCandidate({ x: limits.maxX, y });
  }
  for (let x = 8; x <= limits.maxX; x += strideX) addCandidate({ x, y: limits.maxY });
  addCandidate({ x: limits.maxX, y: limits.maxY });
  const clearCandidate = candidates
    .filter((candidate) => isClearParkingSpot(candidate, occupied, size))
    .sort((a, b) => distanceSquared(a, point) - distanceSquared(b, point))[0];
  if (clearCandidate) return clearCandidate;
  return candidates
    .slice()
    .sort((a, b) => {
      const conflictDelta = parkingConflictScore(a, occupied, size) - parkingConflictScore(b, occupied, size);
      if (Math.abs(conflictDelta) > 0.001) return conflictDelta;
      return distanceSquared(a, point) - distanceSquared(b, point);
    })[0] ?? clampPoint({ x: point.x - 136, y: point.y + 264 }, limits);
};

/**
 * Where the 2D workbench would park `sourceInstanceId` after a completed interaction released at
 * `releasePoint`: sized by its render node, clear of every other node's hit box, on the 2D player's
 * minimum logical bench (the area benchCoordinates maps onto the 3D bench).
 */
export const parkPointAfterInteraction = (
  state: Pick<RuntimeState, "equipmentInstances" | "attachments">,
  sourceInstanceId: string,
  releasePoint: BenchPoint,
): BenchPoint => {
  const nodes = resolveWorkbenchScene(state);
  const node = nodes.find((candidate) => candidate.primaryInstanceId === sourceInstanceId);
  const instance = state.equipmentInstances.find((candidate) => candidate.id === sourceInstanceId);
  const size = node ? { width: node.bounds.width, height: node.bounds.height } : getBenchSize(instance?.definitionId ?? "");
  const occupied = benchOccupiedBoundsFromNodes(nodes, new Map(), sourceInstanceId, [...state.equipmentInstances]);
  return parkAfterInteraction(releasePoint, occupied, surfaceLimits(RUNTIME_BENCH_PX, size), size);
};
