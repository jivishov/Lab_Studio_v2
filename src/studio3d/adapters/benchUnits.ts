import { getBenchSize } from "../../equipment/visualCatalog";

/**
 * The one conversion between runtime bench units and the 3D bench (plan §2.3, §4.1, §11).
 *
 * `EquipmentInstance.x`/`y` are 2D workbench pixels in a front-view picture: `x` is the left edge
 * of the item's art, and `y` its top edge, so `y` is height on screen, not depth. Runtime units
 * are never rewritten: the 3D view reads them through `toBench` and commits moves through
 * `fromBench`, so a state saved by either player loads unchanged in the other.
 *
 * The mapping, chosen once here:
 * - bench x is the centre of the item's 2D art, scaled so the 2D player's minimum logical width
 *   spans the usable bench width;
 * - bench depth is the item's 2D base line (y plus its art height, where the picture "stands"):
 *   a base line higher on screen is further back on the bench.
 * Bench millimetres use the registry's convention: x to the viewer's right, y away from the
 * viewer, origin at the first 1400 mm bench's centre (`BENCH_MM.left` and `right` say where the working area lies).
 *
 * Kept apart from benchCoordinates.ts, which also reads the 3D layout (stableBench.ts), so the layout can convert
 * units without an import cycle; benchCoordinates re-exports everything here.
 */

/** The 2D player's minimum logical workbench (src/player/workbenchViewTransform.ts). */
export const RUNTIME_BENCH_PX = Object.freeze({ width: 760, height: 520 });

/**
 * The working area on the 3D bench, and the margin kept clear at its edges. Bench x = 0 stays the world origin, from
 * which the shelf, the side station and the room are placed. The area reaches 300 mm farther left than the first
 * 1400 mm bench (2026-11-09: "User must be able to move the objects farther to the left on the bench to enlarge the
 * working area"). Its right end stays put, as the side station starts just past it. 1700 mm is the width decided for
 * the lab room (decision 2, 2026-10-16).
 */
export const BENCH_MM = Object.freeze({ left: -1000, right: 700, width: 1700, depth: 700, edgeMargin: 40 });
/** The working area's centre across, millimetres; it is not the world origin. */
export const BENCH_CENTRE_X_MM = (BENCH_MM.left + BENCH_MM.right) / 2;

export const USABLE_WIDTH_MM = BENCH_MM.width - 2 * BENCH_MM.edgeMargin;
export const USABLE_DEPTH_MM = BENCH_MM.depth - 2 * BENCH_MM.edgeMargin;
/** The usable area's left and right edges, millimetres. */
export const USABLE_LEFT_MM = BENCH_MM.left + BENCH_MM.edgeMargin;
export const USABLE_RIGHT_MM = BENCH_MM.right - BENCH_MM.edgeMargin;

/** Millimetres of bench per runtime pixel, across and in depth. */
export const MM_PER_PX_X = USABLE_WIDTH_MM / RUNTIME_BENCH_PX.width;
export const MM_PER_PX_DEPTH = USABLE_DEPTH_MM / RUNTIME_BENCH_PX.height;
/**
 * The scale 2D art sizes are read at (snap zones, the snap anchor's box): the first 1400 mm bench's, kept when the
 * working area grew so a seat is as easy to reach as before.
 */
export const ART_MM_PER_PX = (1400 - 2 * BENCH_MM.edgeMargin) / RUNTIME_BENCH_PX.width;

export interface BenchPointMm {
  xMm: number;
  yMm: number;
  /**
   * Turn about the vertical axis, degrees. Always 0 from runtime state: `EquipmentInstance.rotation`
   * is set by no runtime action and drawn by no 2D view, so neither player gives it a meaning
   * (decision U6: turning stays in Examine). Seated items take their anchor's yaw instead.
   */
  yawDeg: number;
}

export interface RuntimeBenchPoint {
  x: number;
  y: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

/** Runtime bench units -> bench millimetres for an item of `definitionId`. */
export const toBench = (
  definitionId: string,
  point: { x?: number; y?: number },
): BenchPointMm => {
  const size = getBenchSize(definitionId);
  const centreXPx = (point.x ?? 0) + size.width / 2;
  const baseLinePx = (point.y ?? 0) + size.height;
  const xMm = USABLE_LEFT_MM + centreXPx * MM_PER_PX_X;
  const yMm = USABLE_DEPTH_MM / 2 - baseLinePx * MM_PER_PX_DEPTH;
  return {
    xMm: round1(clamp(xMm, BENCH_MM.left, BENCH_MM.right)),
    yMm: round1(clamp(yMm, -BENCH_MM.depth / 2, BENCH_MM.depth / 2)),
    yawDeg: 0,
  };
};

/**
 * Bench millimetres -> runtime bench units for a free move or placement of `definitionId`.
 * The point is clamped to the bench surface first (handoff §5.6: "the bench is bounded").
 */
export const fromBench = (definitionId: string, xMm: number, yMm: number): RuntimeBenchPoint => {
  const size = getBenchSize(definitionId);
  const x = clamp(xMm, USABLE_LEFT_MM, USABLE_RIGHT_MM);
  const y = clamp(yMm, -USABLE_DEPTH_MM / 2, USABLE_DEPTH_MM / 2);
  const centreXPx = (x - USABLE_LEFT_MM) / MM_PER_PX_X;
  const baseLinePx = (USABLE_DEPTH_MM / 2 - y) / MM_PER_PX_DEPTH;
  return {
    x: round1(Math.max(0, centreXPx - size.width / 2)),
    y: round1(Math.max(0, baseLinePx - size.height)),
  };
};
