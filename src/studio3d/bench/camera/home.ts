import * as THREE from "three";
import { BENCH_MM } from "../../adapters/benchCoordinates";
import { SHELF, type ShelfSpot } from "../../adapters/shelfSpots";
import { DEFAULT_VIEW, fitSteady, FRAME_REACH, safeRects, type OrbitView, type Rect, type Size } from "./benchCamera";

/**
 * Home fitted to the screen (you, 2026-10-12: "the equipment is small and difficult to notice" at Home on a wide
 * screen; answered "Fit Home to the screen" and, for the side station, "Only when it holds items"). From Home's angle
 * (`DEFAULT_VIEW`: pitch 0.45, yaw 0) the camera comes as close as still shows what Home must, within the free stage:
 * beside the step card and any open panel, below the top bar and above the dock. Real sizes are kept; only the camera
 * moves, so on a wide screen everything is drawn larger, and at 1024 × 700 Home is about where it was.
 *
 * Home must show the working area, the reagent shelf from its feet to its top, everything standing on its tiers, and
 * the side station's items when it holds any. An empty side station is left out, so the bench comes closer. Items
 * count by their shelf spots, not their models, so Home neither waits for a model nor shifts as one loads.
 */
const mark = (xMm: number, yMm: number, zMm: number) => new THREE.Vector3(xMm / 1000, zMm / 1000, -yMm / 1000);

const box = (out: THREE.Vector3[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(mark(x, y, z));
};

/** The world points Home keeps in view, given the spots of the items now on the shelf or at the side station. */
export const homeMarks = (spots: readonly ShelfSpot[]): THREE.Vector3[] => {
  const out: THREE.Vector3[] = [];
  const w = BENCH_MM.width / 2, d = BENCH_MM.depth / 2;
  box(out, -w, -d, 0, w, d, 0);
  const half = SHELF.lengthMm / 2, depth = SHELF.depthMm / 2;
  box(out, SHELF.centre.xMm - half, SHELF.centre.yMm - depth, 0, SHELF.centre.xMm + half, SHELF.centre.yMm + depth, SHELF.heightMm);
  for (const spot of spots) {
    box(out, spot.centre.xMm - spot.widthMm / 2, spot.centre.yMm - spot.depthMm / 2, spot.zMm,
      spot.centre.xMm + spot.widthMm / 2, spot.centre.yMm + spot.depthMm / 2, spot.zMm + spot.heightMm);
  }
  return out;
};

/**
 * Home for a canvas of `size` whose free stage is `rects` (none: the whole canvas): the closest fit into any of them
 * (the steady fit, as the source's `fit` does not settle at Home's low pitch), within the wheel's range so a zoom from
 * Home never snaps. The fixed Home if nothing fits.
 */
export const homeView = (spots: readonly ShelfSpot[], size: Size, rects?: readonly Rect[]): OrbitView => {
  const marks = homeMarks(spots);
  return (rects?.length ? rects : safeRects(size, []))
    .map((rect) => fitSteady(marks, DEFAULT_VIEW(), size, rect))
    .filter((view): view is OrbitView => view !== undefined && Math.abs(view.at.x) <= FRAME_REACH.x && Math.abs(view.at.z) <= FRAME_REACH.z)
    .sort((a, b) => a.distance - b.distance)[0] ?? DEFAULT_VIEW();
};
