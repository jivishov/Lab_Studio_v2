import * as THREE from "three";
import { ROOM_SCALE } from "../look/room";

/**
 * The bench view of the DNA microarray 3D lab, ported to three.js (decided 2026-10-03/04;
 * `proposals/MICROARRAY_ADOPTION.md` §4, choices 3 and 11). Sources, under
 * `virtual_lab/experiments/dnamicroarray_v2/3d-v3/`:
 * - the camera model, `renderer.js:12` (`cameraMatrices`) and `:119` (the default view);
 * - the manual limits, pan, orbit and zoom, `app.js:111-151`;
 * - the presets, `app.js:104-110`;
 * - auto-framing's `fit()` and its tween, `framing.js:29-83`; the free rectangles around open
 *   panels, `app.js:83-97` (`safeRects`).
 *
 * The camera orbits a look-at point `at` by yaw, pitch and distance; there is no roll. Lengths are
 * the source's scene units times `ROOM_SCALE`, so the views frame the same room around Lab Studio's
 * bench; angles and pixel constants carry over unchanged.
 */
export interface OrbitView {
  at: THREE.Vector3;
  yaw: number;
  pitch: number;
  distance: number;
}

export interface Size { w: number; h: number }
export interface Rect { left: number; top: number; right: number; bottom: number }

const S = ROOM_SCALE;
/** Vertical field of view, degrees, and the clip planes (`renderer.js:12`, `.04` and `80` units). */
export const FOV = 42;
export const NEAR = 0.04 * S;
export const FAR = 80 * S;

/** Limits for manual input only (`app.js:121-151`); presets, framing and Examine are not clamped. */
export const MANUAL = {
  pitchMin: 0.35,
  pitchMax: 1.55,
  distanceMin: 3.2 * S,
  distanceMax: 20 * S,
  atX: 7 * S,
  atZ: 4.5 * S,
  /** Radians per pixel: orbit yaw, and pitch (orbit and pan-tilt alike). */
  yawPerPx: 0.006,
  pitchPerPx: 0.005,
  /** Wheel zoom: distance × e^(deltaY · k). */
  zoomPerDelta: 0.0012,
  /** A camera drag starts after this many pixels; less is a click. */
  dragPx: 3,
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S);
export const DEFAULT_VIEW = (): OrbitView => ({ at: v(0, 0.35, 0.65), yaw: 0, pitch: 0.72, distance: 11.2 * S });
export const PRESETS = {
  /** "Whole bench" */
  bench: (): OrbitView => ({ at: v(0, 0.24, -0.6), yaw: 0, pitch: 0.89, distance: 15.5 * S }),
  /** "Overhead" (the source's Top) */
  top: (): OrbitView => ({ at: v(0, 0.15, -0.6), yaw: 0, pitch: 1.535, distance: 14.8 * S }),
};
/** Auto-framing's pitch for a step's working set (the source sets one per phase, mostly .85–.92). */
export const FRAME_PITCH = 0.9;
export const FRAME_MS = 650;

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const copyView = (view: OrbitView): OrbitView => ({ ...view, at: view.at.clone() });

/** The distance actually used: narrow viewports (under 1.1:1) step back by 1.10/aspect. */
export const effectiveDistance = (view: OrbitView, aspect: number) => view.distance * Math.max(1, 1.1 / aspect);

export const eyeOf = (view: OrbitView, aspect: number): THREE.Vector3 => {
  const d = effectiveDistance(view, aspect), cp = Math.cos(view.pitch);
  return view.at.clone().add(new THREE.Vector3(Math.sin(view.yaw) * cp * d, Math.sin(view.pitch) * d, Math.cos(view.yaw) * cp * d));
};

/** Pose `camera` for `view` (the source's `cameraMatrices`). */
export const applyView = (camera: THREE.PerspectiveCamera, view: OrbitView, aspect: number): void => {
  camera.fov = FOV;
  camera.near = NEAR;
  camera.far = FAR;
  camera.aspect = aspect;
  camera.position.copy(eyeOf(view, aspect));
  camera.up.set(0, 1, 0);
  camera.lookAt(view.at);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};

/** Pitch, distance and the look-at point within the manual limits; yaw is unbounded. */
export const clampManual = (view: OrbitView): OrbitView => ({
  at: clampAt(view.at),
  yaw: view.yaw,
  pitch: clampPitch(view.pitch),
  distance: clamp(view.distance, MANUAL.distanceMin, MANUAL.distanceMax),
});
/**
 * Each manual input clamps only what it changes, as the source does: an orbit its pitch, a pan its
 * look-at point and pitch, the wheel its distance and look-at point (`app.js:125-126, 136, 148-149`).
 * So a programmatic view outside the limits (eye level, close to a meniscus) is not thrown out by a
 * pan or a zoom.
 */
const clampPitch = (pitch: number) => clamp(pitch, MANUAL.pitchMin, MANUAL.pitchMax);
export const clampAt = (at: THREE.Vector3) => new THREE.Vector3(clamp(at.x, -MANUAL.atX, MANUAL.atX), at.y, clamp(at.z, -MANUAL.atZ, MANUAL.atZ));

/** Shift/Alt + right-drag or middle-drag (`app.js:125`). */
export const orbitBy = (view: OrbitView, dx: number, dy: number): OrbitView =>
  ({ ...copyView(view), yaw: view.yaw - dx * MANUAL.yawPerPx, pitch: clampPitch(view.pitch + dy * MANUAL.pitchPerPx) });

/**
 * Right-drag (`app.js:126`, `panBy` at `:134-137`): the bench point under the pointer moves with it sideways
 * (`from` and `to` are the bench points under the pointer before and after, at the same screen
 * height), and moving up or down tilts the view.
 */
export const panTiltBy = (view: OrbitView, from: THREE.Vector3 | null, to: THREE.Vector3 | null, dy: number): OrbitView => {
  const at = view.at.clone();
  if (from && to) at.add(from.clone().sub(to));
  return { ...view, at: from && to ? clampAt(at) : at, pitch: clampPitch(view.pitch + dy * MANUAL.pitchPerPx) };
};

/** The wheel (`app.js:146-151`): zoom by e^(deltaY·k); `refit` then keeps the bench point under the pointer fixed. */
export const zoomBy = (view: OrbitView, deltaY: number): OrbitView =>
  ({ ...copyView(view), distance: clamp(view.distance * Math.exp(deltaY * MANUAL.zoomPerDelta), MANUAL.distanceMin, MANUAL.distanceMax) });

/** Choice 11: framing turns back to the front the short way, never unwinding whole turns made by hand. */
export const frontYaw = (yaw: number): number => Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;

const scratch = new THREE.PerspectiveCamera();
const project = (view: OrbitView, size: Size, points: readonly THREE.Vector3[]) => {
  applyView(scratch, view, size.w / size.h);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const p = new THREE.Vector3();
  for (const point of points) {
    p.copy(point).project(scratch);
    const x = (p.x + 1) * 0.5 * size.w, y = (1 - p.y) * 0.5 * size.h;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
};

/**
 * Fit world points into a pixel rectangle by moving the look-at point and the distance (the source's
 * `fit`, `framing.js:29-50`): up to 14 projections; the look-at point starts at the points' centroid
 * on the bench plane. `limits` bound the distance.
 */
export const fit = (points: readonly THREE.Vector3[], base: OrbitView, size: Size, safe: Rect,
  limits = { min: MANUAL.distanceMin, max: MANUAL.distanceMax }): OrbitView => {
  const view = copyView(base);
  const n = points.length || 1;
  view.at.set(points.reduce((s, p) => s + p.x, 0) / n, 0, points.reduce((s, p) => s + p.z, 0) / n);
  const sw = Math.max(40, safe.right - safe.left), sh = Math.max(40, safe.bottom - safe.top);
  const cx = (safe.left + safe.right) / 2, cy = (safe.top + safe.bottom) / 2;
  for (let i = 0; i < 14; i += 1) {
    const { x0, x1, y0, y1 } = project(view, size, points);
    const scale = Math.max((x1 - x0) / sw, (y1 - y0) / sh);
    const eff = effectiveDistance(view, size.w / size.h);
    const upp = (2 * eff * Math.tan((FOV * Math.PI) / 360)) / size.h;
    const dx = (x0 + x1) / 2 - cx, dy = (y0 + y1) / 2 - cy;
    const right = new THREE.Vector3(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
    const away = new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
    const k = 1 / Math.max(0.35, Math.sin(view.pitch));
    view.at.addScaledVector(right, dx * upp).addScaledVector(away, -dy * upp * k);
    view.distance = clamp(view.distance * clamp(scale, 0.6, 1.6), limits.min, limits.max);
    if (Math.abs(scale - 1) < 0.01 && Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
  }
  return view;
};

/**
 * The free rectangles of the stage around open panels (`app.js:83-97`): the canvas less a 12 px
 * margin and everything below the hint or dock, split around each obstacle with a 10 px pad;
 * pieces smaller than 160 × 110 px are dropped. Largest first, at most 24.
 */
export const safeRects = (size: Size, obstacles: readonly Rect[], bottomLimit = size.h): Rect[] => {
  const base: Rect = { left: 12, top: 12, right: size.w - 12, bottom: Math.min(bottomLimit, size.h) - 10 };
  const split = (rect: Rect, obs: readonly Rect[]): Rect[] => {
    const hit = obs.find((o) => o.left < rect.right && o.right > rect.left && o.top < rect.bottom && o.bottom > rect.top);
    if (!hit) return [rect];
    const rest = obs.filter((o) => o !== hit), pad = 10;
    return [
      { ...rect, right: Math.min(rect.right, hit.left - pad) },
      { ...rect, left: Math.max(rect.left, hit.right + pad) },
      { ...rect, bottom: Math.min(rect.bottom, hit.top - pad) },
      { ...rect, top: Math.max(rect.top, hit.bottom + pad) },
    ].filter((q) => q.right - q.left > 160 && q.bottom - q.top > 110).flatMap((q) => split(q, rest));
  };
  const rects = split(base, obstacles)
    .sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top))
    .slice(0, 24);
  return rects.length ? rects : [base];
};

/**
 * Fit into each free rectangle and keep the one that frames the points largest (`framing.js:66-67`).
 * A fit that ran away is dropped: with a point close behind the camera its projection flips, and the
 * look-at point can be driven tens of metres off the bench (seen in Heat and Reweigh's practice, the
 * clay triangle placed with the ring stand at the bench's front edge), leaving an empty view. A real
 * framing keeps the look-at point within twice the manual limits; with none left the view stays.
 */
export const fitBest = (points: readonly THREE.Vector3[], base: OrbitView, size: Size, rects: readonly Rect[],
  limits?: { min: number; max: number }): OrbitView | undefined => rects
  .map((rect) => fit(points, base, size, rect, limits))
  .filter((c) => [c.at.x, c.at.y, c.at.z, c.distance, c.pitch].every(Number.isFinite))
  .filter((c) => Math.abs(c.at.x) <= 2 * MANUAL.atX && Math.abs(c.at.z) <= 2 * MANUAL.atZ)
  .sort((a, b) => a.distance - b.distance)[0];

/** The source's tween easing (`framing.js:7`, easeInOutCubic). */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const lerpView = (a: OrbitView, b: OrbitView, t: number): OrbitView => ({
  at: a.at.clone().lerp(b.at, t),
  yaw: a.yaw + (b.yaw - a.yaw) * t,
  pitch: a.pitch + (b.pitch - a.pitch) * t,
  distance: a.distance + (b.distance - a.distance) * t,
});
