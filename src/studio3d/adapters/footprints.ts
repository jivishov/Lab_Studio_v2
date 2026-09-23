import type { ActionInteractionSpec } from "../../domain/types";
import { resolveBenchOverlap, type BenchBounds, type BenchOverlapResult } from "../../player/benchOverlap";
import type { Equipment3DEntry } from "../equipment3d/types";
import { BENCH_MM, MM_PER_PX_DEPTH, MM_PER_PX_X } from "./benchCoordinates";

/**
 * 3D footprints -> the 2D bench bounds the shared overlap classifier works on (plan §4.1). Overlap
 * is classified by the same `resolveBenchOverlap` the 2D workbench uses (valid, invalid or move
 * only), so what counts as "over the target" does not change between the players. Bounds are the
 * top-down footprint rectangle, expressed in runtime pixel units through benchCoordinates' scale.
 */

export interface FootprintMm {
  /** Centre on the bench, millimetres. */
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
}

export const footprintOf = (entry: Equipment3DEntry | undefined, xMm: number, yMm: number): FootprintMm => {
  const fp = entry?.footprintMm;
  if (fp?.shape === "rect") return { xMm, yMm, widthMm: fp.width, depthMm: fp.depth };
  const d = fp?.shape === "circle" ? fp.radius * 2 : 80;
  return { xMm, yMm, widthMm: d, depthMm: d };
};

/** A footprint as runtime-unit bounds; bench depth runs down the 2D y axis (front is larger y). */
export const footprintBounds = (id: string, definitionId: string, fp: FootprintMm): BenchBounds => {
  const usableW = BENCH_MM.width - 2 * BENCH_MM.edgeMargin;
  const usableD = BENCH_MM.depth - 2 * BENCH_MM.edgeMargin;
  const left = (fp.xMm - fp.widthMm / 2 + usableW / 2) / MM_PER_PX_X;
  const top = (usableD / 2 - (fp.yMm + fp.depthMm / 2)) / MM_PER_PX_DEPTH;
  return {
    id,
    definitionId,
    x: left,
    y: top,
    width: fp.widthMm / MM_PER_PX_X,
    height: fp.depthMm / MM_PER_PX_DEPTH,
  };
};

export interface FootprintCandidate {
  instanceId: string;
  definitionId: string;
  footprint: FootprintMm;
}

/** Classify a carried footprint against the bench items, exactly as the 2D workbench does. */
export const classifyOverlap = (
  carried: FootprintCandidate,
  others: readonly FootprintCandidate[],
  interaction?: ActionInteractionSpec,
): BenchOverlapResult =>
  resolveBenchOverlap(
    footprintBounds(carried.instanceId, carried.definitionId, carried.footprint),
    others
      .filter((other) => other.instanceId !== carried.instanceId)
      .map((other) => footprintBounds(other.instanceId, other.definitionId, other.footprint)),
    interaction,
  );

/** The 2D rule for automatic placement: a spot is free below 5 % overlap (StudentPlayer). */
export const FREE_OVERLAP_RATIO = 0.05;

const overlapRatio = (a: FootprintMm, b: FootprintMm): number => {
  const w = Math.max(0, Math.min(a.xMm + a.widthMm / 2, b.xMm + b.widthMm / 2) - Math.max(a.xMm - a.widthMm / 2, b.xMm - b.widthMm / 2));
  const d = Math.max(0, Math.min(a.yMm + a.depthMm / 2, b.yMm + b.depthMm / 2) - Math.max(a.yMm - a.depthMm / 2, b.yMm - b.depthMm / 2));
  const denominator = Math.min(a.widthMm * a.depthMm, b.widthMm * b.depthMm);
  return denominator > 0 ? (w * d) / denominator : 0;
};

const clampToBench = (fp: FootprintMm): FootprintMm => {
  const halfW = BENCH_MM.width / 2 - BENCH_MM.edgeMargin - fp.widthMm / 2;
  const halfD = BENCH_MM.depth / 2 - BENCH_MM.edgeMargin - fp.depthMm / 2;
  return { ...fp, xMm: Math.min(halfW, Math.max(-halfW, fp.xMm)), yMm: Math.min(halfD, Math.max(-halfD, fp.yMm)) };
};

/**
 * The nearest spot to `wanted` (clamped to the bench) where the footprint overlaps every other by
 * under 5 %, searched outward in rings (handoff §5.6, "no interpenetration"). Falls back to the
 * clamped wanted point when the bench is full.
 */
export const nearestFreeSpot = (wanted: FootprintMm, others: readonly FootprintMm[], stepMm = 20, rings = 30): FootprintMm => {
  const free = (fp: FootprintMm) => others.every((other) => overlapRatio(fp, other) < FREE_OVERLAP_RATIO);
  const start = clampToBench(wanted);
  if (free(start)) return start;
  for (let ring = 1; ring <= rings; ring += 1) {
    const r = ring * stepMm;
    const samples = Math.max(8, Math.round((2 * Math.PI * r) / stepMm));
    let best: FootprintMm | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let k = 0; k < samples; k += 1) {
      const a = (2 * Math.PI * k) / samples;
      const candidate = clampToBench({ ...wanted, xMm: wanted.xMm + r * Math.cos(a), yMm: wanted.yMm + r * Math.sin(a) });
      const distance = Math.hypot(candidate.xMm - wanted.xMm, candidate.yMm - wanted.yMm);
      if (free(candidate) && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (best) return best;
  }
  return start;
};

/** Where a pour source is set down after an accepted pour: beside the target, then the nearest free spot. */
export const parkBeside = (source: FootprintMm, target: FootprintMm, others: readonly FootprintMm[]): FootprintMm =>
  nearestFreeSpot(
    { ...source, xMm: target.xMm + target.widthMm / 2 + source.widthMm / 2 + 20, yMm: target.yMm - 30 },
    others,
  );
