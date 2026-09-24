import { BENCH_MM } from "../../adapters/benchCoordinates";

/**
 * The bench's keyboard rules (handoff §5.6 "Keyboard carry", §5.19), pure so they can be tested
 * without a browser. Bench millimetres: x to the viewer's right, y away from the viewer, so the
 * Up arrow moves toward the back of the bench.
 */
export type ArrowDirection = "left" | "right" | "up" | "down";

const ARROWS: Record<string, ArrowDirection> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

export const arrowDirection = (key: string): ArrowDirection | undefined => ARROWS[key];

/** Arrow steps while carrying: 10 mm, or 50 mm with Shift. */
export const KEY_STEP_MM = 10;
export const KEY_STEP_LARGE_MM = 50;

export interface BenchPoint {
  xMm: number;
  yMm: number;
}

/** Keep a carried point on the usable bench surface ("the bench is bounded"). */
export const clampToBenchSurface = (point: BenchPoint): BenchPoint => {
  const halfW = BENCH_MM.width / 2 - BENCH_MM.edgeMargin;
  const halfD = BENCH_MM.depth / 2 - BENCH_MM.edgeMargin;
  return { xMm: Math.min(halfW, Math.max(-halfW, point.xMm)), yMm: Math.min(halfD, Math.max(-halfD, point.yMm)) };
};

export const nudgePoint = (point: BenchPoint, direction: ArrowDirection, large: boolean): BenchPoint => {
  const step = large ? KEY_STEP_LARGE_MM : KEY_STEP_MM;
  return clampToBenchSurface({
    xMm: point.xMm + (direction === "right" ? step : direction === "left" ? -step : 0),
    yMm: point.yMm + (direction === "up" ? step : direction === "down" ? -step : 0),
  });
};

export interface PlacedItem extends BenchPoint {
  id: string;
}

/** Items in reading order across the bench: back row first, then left to right. */
export const spatialOrder = <T extends PlacedItem>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => b.yMm - a.yMm || a.xMm - b.xMm || a.id.localeCompare(b.id));

/**
 * The nearest item in an arrow's direction, for moving the selection (§5.19 "in spatial order").
 * Distance across the arrow counts double, so the choice stays in the row or column. With no
 * selection the first item in reading order is chosen; with nothing that way, the selection stays.
 */
export const spatialNeighbour = (items: readonly PlacedItem[], fromId: string | undefined, direction: ArrowDirection): string | undefined => {
  const from = items.find((item) => item.id === fromId);
  if (!from) return spatialOrder(items)[0]?.id;
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "right" || direction === "up" ? 1 : -1;
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (item.id === from.id) continue;
    const along = (horizontal ? item.xMm - from.xMm : item.yMm - from.yMm) * sign;
    if (along <= 0) continue;
    const score = along + 2 * Math.abs(horizontal ? item.yMm - from.yMm : item.xMm - from.xMm);
    if (score < bestScore) {
      bestScore = score;
      best = item.id;
    }
  }
  return best ?? from.id;
};

/** `[` and `]` step through candidate targets; the first press lands on the first or last. */
export const cycleIndex = (length: number, current: number | undefined, delta: 1 | -1): number => {
  if (length <= 0) return -1;
  if (current === undefined || current < 0 || current >= length) return delta > 0 ? 0 : length - 1;
  return (current + delta + length) % length;
};
