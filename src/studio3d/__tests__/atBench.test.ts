import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyView, eyeOf, MANUAL, orbitBy, safeRects, zoomBy, type OrbitView, type Rect, type Size } from "../bench/camera/benchCamera";
import { AT_BENCH, atBenchView } from "../bench/camera/atBench";
import { homeView } from "../bench/camera/home";

// "At the bench" (you, 2026-10-16: "eye about 0.5 m above the worktop at the front edge, framing the step's items. Keep
// Home and Auto view unchanged.").

/** The lab's stage: the 52 px top bar, the step card at the top left (to 388 px across), the dock from `dockTop` down. */
const stage = (size: Size, dockTop: number): Rect[] =>
  safeRects(size, [{ left: 0, top: 0, right: size.w, bottom: 52 }, { left: 14, top: 64, right: 388, bottom: 480 }], dockTop);

const projected = (view: OrbitView, size: Size, points: readonly THREE.Vector3[]) => {
  const camera = new THREE.PerspectiveCamera();
  applyView(camera, view, size.w / size.h);
  const xs: number[] = [], ys: number[] = [];
  for (const p of points) {
    const q = p.clone().project(camera);
    xs.push((q.x + 1) * 0.5 * size.w);
    ys.push((1 - q.y) * 0.5 * size.h);
  }
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
};
const inside = (box: ReturnType<typeof projected>, rects: readonly Rect[]) => rects.some((r) =>
  box.left >= r.left - 1 && box.right <= r.right + 1 && box.top >= r.top - 1 && box.bottom <= r.bottom + 1);

/** An item's bounds (world metres, centred at x, z on the worktop), grown by the view's margin as the engine grows them. */
const corners = (items: Array<{ x: number; z: number; r: number; h: number }>) => {
  const box = new THREE.Box3();
  for (const { x, z, r, h } of items) box.expandByPoint(new THREE.Vector3(x - r, 0, z - r)).expandByPoint(new THREE.Vector3(x + r, h, z + r));
  const centre = box.getCenter(new THREE.Vector3()), half = box.getSize(new THREE.Vector3()).multiplyScalar(AT_BENCH.margin / 2);
  const out: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(new THREE.Vector3(centre.x + sx * half.x, Math.max(0, centre.y + sy * half.y), centre.z + sz * half.z));
  }
  return out;
};
/** The 25 mL cylinder (151 mm tall, its foot 26 mm across the radius) at the bench's middle. */
const cylinder = corners([{ x: 0, z: 0, r: 0.026, h: 0.151 }]);
/** The pitch from the eye, 0.5 m over the front edge (or `minReach` in front), to the middle of `points`. */
const pitchTo = (points: THREE.Vector3[]) => {
  const middle = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  return Math.atan2(AT_BENCH.eyeY - middle.y, Math.max(AT_BENCH.minReach, AT_BENCH.eyeZ - middle.z));
};

describe("At the bench", () => {
  const size = { w: 1280, h: 748 };
  const rects = stage(size, 650);

  it("looks at a few items from about 0.5 m over the worktop's front edge, about three times larger than Home", () => {
    const view = atBenchView(cylinder, 0, size, rects)!;
    const eye = eyeOf(view, size.w / size.h);
    expect(eye.y).toBeGreaterThan(0.45);
    expect(eye.y).toBeLessThan(0.6);
    expect(eye.z).toBeGreaterThan(0.25);
    expect(eye.z).toBeLessThan(0.45);
    expect(view.yaw).toBe(0);
    const box = projected(view, size, cylinder);
    expect(inside(box, rects)).toBe(true);
    const home = projected(homeView([], size, rects), size, cylinder);
    const ratio = (box.bottom - box.top) / (home.bottom - home.top);
    expect(ratio).toBeGreaterThan(2.5);
    expect(ratio).toBeLessThan(4.5);
  });

  it("steps back along its line of sight when the items do not fit from the edge", () => {
    const spread = corners([{ x: -0.45, z: -0.05, r: 0.04, h: 0.12 }, { x: 0.45, z: 0.05, r: 0.04, h: 0.2 }]);
    const view = atBenchView(spread, 0, size, rects)!;
    const middle = new THREE.Box3().setFromPoints(spread).getCenter(new THREE.Vector3());
    expect(view.distance).toBeGreaterThan(Math.hypot(AT_BENCH.eyeY - middle.y, AT_BENCH.eyeZ - middle.z) + 0.05);
    expect(view.pitch).toBeCloseTo(pitchTo(spread), 6);
    expect(eyeOf(view, size.w / size.h).y).toBeGreaterThan(AT_BENCH.eyeY + 0.05);
    expect(inside(projected(view, size, spread), rects)).toBe(true);
  });

  it("looks down on an item at the front edge rather than under it, and turns to the front the short way", () => {
    const front = corners([{ x: 0.2, z: 0.3, r: 0.03, h: 0.1 }]);
    const view = atBenchView(front, 2 * Math.PI + 0.4, size, rects)!;
    expect(view.yaw).toBeCloseTo(2 * Math.PI, 9);
    expect(view.pitch).toBeCloseTo(pitchTo(front), 6);
    expect(eyeOf(view, size.w / size.h).z).toBeGreaterThan(0.3);
    expect(inside(projected(view, size, front), rects)).toBe(true);
  });

  it("frames an item on the shelf's upper tier, above the eye, about level (found 2026-10-16: it was never framed)", () => {
    // The 25 mL cylinder where Determine Water Hardness starts it: on the upper tier, 520 mm up, 460 mm back.
    const shelf = corners([{ x: -0.45, z: -0.46, r: 0.026, h: 0.151 }]).map((p) => p.setY(p.y + 0.52));
    const view = atBenchView(shelf, 0, size, rects)!;
    expect(view).toBeDefined();
    const eye = eyeOf(view, size.w / size.h);
    expect(eye.y).toBeGreaterThan(0.45);
    expect(eye.y).toBeLessThan(0.6);
    expect(Math.abs(view.pitch)).toBeLessThan(0.2);
    expect(inside(projected(view, size, shelf), rects)).toBe(true);
    // It looks a little up, below the hand's level; an orbit from it turns it without snapping it level.
    expect(view.pitch).toBeLessThan(MANUAL.pitchMin);
    expect(orbitBy(view, 10, 0).pitch).toBe(view.pitch);
    expect(orbitBy(view, 0, 10).pitch).toBeCloseTo(view.pitch + 10 * MANUAL.pitchPerPx, 9);
    expect(orbitBy(view, 0, -10).pitch).toBe(view.pitch);
  });

  it("stays within the wheel's range, so a zoom from it does not snap", () => {
    const view = atBenchView(cylinder, 0, size, rects)!;
    expect(view.distance).toBeGreaterThanOrEqual(MANUAL.distanceMin);
    expect(view.distance).toBeLessThanOrEqual(MANUAL.distanceMax);
    expect(view.pitch).toBeLessThanOrEqual(MANUAL.pitchMax);
    expect(zoomBy(view, 0).distance).toBeCloseTo(view.distance, 9);
  });
});
