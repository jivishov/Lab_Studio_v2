import * as THREE from "three";
import { BENCH_MM } from "../../adapters/benchCoordinates";
import { fitBest, fitSteady, FRAME_REACH, frontYaw, MANUAL, safeRects, type OrbitView, type Rect, type Size } from "./benchCamera";

/**
 * "At the bench", a camera menu view (you, 2026-10-16, with stills from Labster, PraxiLabs and Michael Bodekaer's TEDx
 * talk, where "the equipment is large enough to comfortable observe details"; answered "Add an 'At the bench' working view
 * to the camera menu: eye about 0.5 m above the worktop at the front edge, framing the step's items. Keep Home and Auto
 * view unchanged."): the view of one working at the bench. Facing the bench from its front, the eye about 0.5 m over the
 * worktop above its front edge looks at the middle of the items' bounds, down on the bench and about level at the
 * shelf's upper tier; where they do not fit the free stage from there, it steps back along its line of sight until they
 * do. Real sizes are kept: a few items are seen from about 0.5 m, not from Home's 1.5 m or more, so they are drawn about
 * three times larger.
 */
export const AT_BENCH = {
  /** The eye over the worktop, metres. */
  eyeY: 0.5,
  /** The eye over the worktop's front edge: metres toward the viewer from the bench's middle. */
  eyeZ: BENCH_MM.depth / 2000,
  /** The least reach along the worktop from the eye to the items' middle (one at the very edge is looked down on, not under). */
  minReach: 0.15,
  /** The items' bounds grow by this about their centre, so a rim or a tip is not cut at the stage's edge. */
  margin: 1.3,
};

/**
 * "At the bench" for `points`, the corners of the items' bounds (world metres), on a canvas of `size` whose free stage is
 * `rects` (none: the whole canvas). Turned back to the front the short way from `yaw` (choice 11). The steady fit from the
 * items' middle (found 2026-10-16: from the worktop below it, an item on the upper tier, above the eye, was never framed),
 * within the wheel's range, so a zoom from it never snaps; the source's fit where nothing fits; none where no real fit
 * exists.
 */
export const atBenchView = (points: readonly THREE.Vector3[], yaw: number, size: Size, rects?: readonly Rect[]): OrbitView | undefined => {
  const middle = new THREE.Box3().setFromPoints([...points]).getCenter(new THREE.Vector3());
  const reach = Math.max(AT_BENCH.minReach, AT_BENCH.eyeZ - middle.z);
  const rise = AT_BENCH.eyeY - middle.y;
  const limits = { min: Math.hypot(rise, reach), max: MANUAL.distanceMax };
  const base: OrbitView = { at: middle, yaw: frontYaw(yaw), pitch: Math.atan2(rise, reach), distance: limits.min };
  const free = rects?.length ? rects : safeRects(size, []);
  return free.map((rect) => fitSteady(points, base, size, rect, limits, middle))
    .filter((view): view is OrbitView => view !== undefined && Math.abs(view.at.x) <= FRAME_REACH.x && Math.abs(view.at.z) <= FRAME_REACH.z)
    .sort((a, b) => a.distance - b.distance)[0] ?? fitBest(points, base, size, free, limits);
};
