import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  applyView, clampManual, DEFAULT_VIEW, eyeOf, fit, fitBest, frontYaw, MANUAL, orbitBy, panTiltBy, PRESETS, safeRects, zoomBy,
} from "../bench/camera/benchCamera";
import { ROOM_SCALE } from "../bench/look/room";

// The microarray lab's bench view in three.js (adoption P2, 2026-10-04). Written, not run.

const size = { w: 1280, h: 720 };
const project = (view: ReturnType<typeof DEFAULT_VIEW>, p: THREE.Vector3) => {
  const camera = new THREE.PerspectiveCamera();
  applyView(camera, view, size.w / size.h);
  const q = p.clone().project(camera);
  return { x: (q.x + 1) * 0.5 * size.w, y: (1 - q.y) * 0.5 * size.h };
};

describe("camera model (renderer.js:12)", () => {
  it("places the eye by yaw, pitch and distance about the look-at point", () => {
    const view = { at: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0.72, distance: 1 };
    const eye = eyeOf(view, 16 / 9);
    expect(eye.x).toBeCloseTo(0, 9);
    expect(eye.y).toBeCloseTo(Math.sin(0.72), 9);
    expect(eye.z).toBeCloseTo(Math.cos(0.72), 9);
  });

  it("steps back on viewports narrower than 1.1:1", () => {
    const view = { at: new THREE.Vector3(), yaw: 0, pitch: 0, distance: 1 };
    expect(eyeOf(view, 0.55).z).toBeCloseTo(2, 9);
    expect(eyeOf(view, 2).z).toBeCloseTo(1, 9);
  });

  it("scales the source's default view and presets into metres", () => {
    expect(DEFAULT_VIEW().distance).toBeCloseTo(11.2 * ROOM_SCALE, 9);
    expect(PRESETS.bench()).toMatchObject({ pitch: 0.89, distance: 15.5 * ROOM_SCALE });
    expect(PRESETS.top().pitch).toBe(1.535);
  });
});

describe("manual input (app.js:111-149)", () => {
  it("clamps pitch, distance and the look-at point, but not yaw", () => {
    const view = clampManual({ at: new THREE.Vector3(9, 0.1, -9), yaw: 12, pitch: 0, distance: 99 });
    expect(view.pitch).toBe(MANUAL.pitchMin);
    expect(view.distance).toBe(MANUAL.distanceMax);
    expect(view.at.x).toBe(MANUAL.atX);
    expect(view.at.z).toBe(-MANUAL.atZ);
    expect(view.yaw).toBe(12);
  });

  it("orbits at 0.006 rad/px of yaw and 0.005 rad/px of pitch", () => {
    const view = orbitBy(DEFAULT_VIEW(), 100, 20);
    expect(view.yaw).toBeCloseTo(-0.6, 9);
    expect(view.pitch).toBeCloseTo(0.72 + 0.1, 9);
  });

  it("pans by the bench points under the pointer, and tilts with up/down", () => {
    const from = new THREE.Vector3(0.1, 0, 0), to = new THREE.Vector3(0.3, 0, 0);
    const view = panTiltBy(DEFAULT_VIEW(), from, to, -10);
    expect(view.at.x).toBeCloseTo(DEFAULT_VIEW().at.x - 0.2, 9);
    expect(view.pitch).toBeCloseTo(0.72 - 0.05, 9);
  });

  it("zooms by e^(deltaY · 0.0012)", () => {
    expect(zoomBy(DEFAULT_VIEW(), 100).distance).toBeCloseTo(DEFAULT_VIEW().distance * Math.exp(0.12), 9);
  });

  it("returns to the front the short way (choice 11)", () => {
    expect(frontYaw(0.4)).toBe(0);
    expect(frontYaw(2 * Math.PI + 0.3)).toBeCloseTo(2 * Math.PI, 9);
    expect(frontYaw(-2 * Math.PI - 3)).toBeCloseTo(-2 * Math.PI, 9);
  });
});

describe("auto-framing (framing.js:29-50, app.js:81-97)", () => {
  const points = [new THREE.Vector3(-0.2, 0, -0.1), new THREE.Vector3(0.2, 0.15, 0.1)];
  const box = [-0.2, 0.2].flatMap((x) => [0, 0.15].flatMap((y) => [-0.1, 0.1].map((z) => new THREE.Vector3(x, y, z))));

  it("fits the points into the safe rectangle", () => {
    const safe = { left: 400, top: 60, right: 1240, bottom: 640 };
    const view = fit(box, { ...DEFAULT_VIEW(), pitch: 0.9 }, size, safe);
    for (const p of points) {
      const s = project(view, p);
      expect(s.x).toBeGreaterThan(safe.left - 2);
      expect(s.x).toBeLessThan(safe.right + 2);
      expect(s.y).toBeGreaterThan(safe.top - 2);
      expect(s.y).toBeLessThan(safe.bottom + 2);
    }
  });

  it("keeps the distance within the limits", () => {
    const tiny = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.001, 0.001, 0.001)];
    expect(fit(tiny, DEFAULT_VIEW(), size, { left: 0, top: 0, right: 1280, bottom: 720 }).distance).toBeGreaterThanOrEqual(MANUAL.distanceMin);
  });

  it("splits the stage around a panel and keeps pieces of a useful size", () => {
    const rects = safeRects(size, [{ left: 14, top: 66, right: 386, bottom: 400 }], 690);
    expect(rects[0]).toEqual({ left: 396, top: 12, right: 1268, bottom: 680 });
    for (const r of rects) {
      expect(r.right - r.left).toBeGreaterThan(160);
      expect(r.bottom - r.top).toBeGreaterThan(110);
    }
  });

  it("picks the rectangle that frames largest", () => {
    const view = fitBest(box, DEFAULT_VIEW(), size, [{ left: 12, top: 12, right: 300, bottom: 200 }, { left: 12, top: 12, right: 1268, bottom: 700 }]);
    const small = fit(box, DEFAULT_VIEW(), size, { left: 12, top: 12, right: 300, bottom: 200 });
    expect(view!.distance).toBeLessThan(small.distance);
  });
});
