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
/**
 * Vertical field of view, degrees, and the clip planes (`renderer.js:12`, `.04` and `80` units). The far plane reaches
 * past the open hall's farthest corner from the farthest eye (the lab room, 2026-10-16: about 17 m).
 */
export const FOV = 42;
export const NEAR = 0.04 * S;
export const FAR = 182 * S;

/** Limits for manual input only (`app.js:121-151`); presets, framing and Examine are not clamped. */
export const MANUAL = {
  /**
   * Down to level (you, 2026-10-16: "I want to be able to adjust the POV when the observer is completely perpendicular
   * to the bench"), the eye looking straight across the bench as Eye level does; the source's 0.35 rad before.
   */
  pitchMin: 0,
  pitchMax: 1.55,
  /** In as close as Eye level comes (0.16 m), so a meniscus can be zoomed to by hand (2026-10-16; the source's 3.2 units before). */
  distanceMin: 0.15,
  /** Out to past the Home view, which takes in the shelf and the side station (2026-10-11; the source's 20 units). */
  distanceMax: 34 * S,
  /**
   * Sideways: the source's 7 units to the left; to the right as far as the side station's far end (decided
   * 2026-10-11), so a slide can bring the large items to the middle of the view.
   */
  atXMin: -7 * S,
  atXMax: 14 * S,
  /**
   * Forward and back: the source's 4.5 units, doubled (decided 2026-10-11) so a left-drag can slide the bench well
   * up or down the screen. Right-drag clamps to the same range, so it never snaps a slid view back.
   */
  atZ: 9 * S,
  /**
   * Up and down, metres over the worktop (you, 2026-10-13, right-drag moves the scene up and down): the camera rises
   * with the look-at point up to 0.5 m, still under the ceiling from Home's angle, and goes down 0.3 m.
   */
  atYMin: -0.3,
  atYMax: 0.5,
  /** Radians per pixel: orbit yaw and pitch. */
  yawPerPx: 0.006,
  pitchPerPx: 0.005,
  /** Wheel zoom: distance × e^(deltaY · k). */
  zoomPerDelta: 0.0012,
  /** A camera drag starts after this many pixels; less is a click. */
  dragPx: 3,
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S);
/**
 * Home (decided 2026-10-11, the shelf in place of the tray): the working area, the reagent shelf behind it and the side
 * station at its right end together, from a little lower than the source's 0.72 rad so the shelf's tiers face the
 * eye. Aimed left of the bench's middle so the whole shelf stands clear of the step card, which opens at the top left.
 * Fitted at 1024 × 700 (the source's own view, `renderer.js:119`, was at(0, .35, .65), pitch .72, 11.2 units).
 * Lowered from 0.66 rad to 0.45 (you, 2026-10-12, with the natural room): the eye about 1.3 m over the worktop, not
 * 1.8 m, so the bench is seen more as one standing at it sees it, and the window shows over the shelf.
 * Now Home's angle and its fallback (you, 2026-10-12): Home itself is fitted to the screen (home.ts), coming closer
 * from this angle wherever the screen has room.
 */
export const DEFAULT_VIEW = (): OrbitView => ({ at: v(-3.2, 0, -2.4), yaw: 0, pitch: 0.45, distance: 32 * S });
export const PRESETS = {
  /** "Whole bench" */
  bench: (): OrbitView => ({ at: v(0, 0.24, -0.6), yaw: 0, pitch: 0.89, distance: 15.5 * S }),
  /** "Overhead" (the source's Top) */
  top: (): OrbitView => ({ at: v(0, 0.15, -0.6), yaw: 0, pitch: 1.535, distance: 14.8 * S }),
};
/** Auto-framing's pitch for a step's working set (the source sets one per phase, mostly .85–.92). */
export const FRAME_PITCH = 0.9;
export const FRAME_MS = 650;
/** The closest a framing comes: the source's manual minimum, kept for framing when the hand's went in (2026-10-16). */
export const FRAME_DISTANCE_MIN = 3.2 * S;
/**
 * Under this pitch a view is near level (the source's lowest, 0.35 rad): the bench plane runs off toward the horizon,
 * so a move along it hardly moves the view up or down, and a pixel near the horizon spans metres of it. There, drags,
 * the wheel and framing move the camera in its own plane instead (2026-10-16).
 */
export const LEVEL_PITCH = 0.35;

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
 * look-at point, the wheel its distance and look-at point (`app.js:125-126, 136, 148-149`).
 * So a programmatic view outside the limits (eye level, close to a meniscus) is not thrown out by a
 * pan or a zoom.
 */
const clampPitch = (pitch: number) => clamp(pitch, MANUAL.pitchMin, MANUAL.pitchMax);
export const clampAt = (at: THREE.Vector3) => new THREE.Vector3(clamp(at.x, MANUAL.atXMin, MANUAL.atXMax), at.y, clamp(at.z, -MANUAL.atZ, MANUAL.atZ));

/** Shift/Alt + right-drag or middle-drag (`app.js:125`); up and down tilt (with right-drag before 2026-10-13). */
export const orbitBy = (view: OrbitView, dx: number, dy: number): OrbitView =>
  ({ ...copyView(view), yaw: view.yaw - dx * MANUAL.yawPerPx, pitch: clampPitch(view.pitch + dy * MANUAL.pitchPerPx) });

/**
 * Right-drag, and one finger on empty bench: the view moves with the pointer. Sideways, the bench point under the
 * pointer stays under it (`app.js:126`, `panBy` at `:134-137`; `from` and `to` are the bench points under the pointer
 * before and after, at the same screen height; near level, the points on the plane through the look-at point facing the
 * camera, 2026-10-16). Up or down (you, 2026-10-13: "Allow user to the move the scene
 * up-down vertically with the right-mouse button held clicked"; it tilted the view before), the camera slides along
 * its own up direction, keeping its angle and distance, so the scene at the look-at point's depth follows the pointer
 * `dy` pixels. The look-at point stays between `MANUAL.atYMin` and `atYMax`; one already outside is not pulled in.
 */
export const panBy = (view: OrbitView, from: THREE.Vector3 | null, to: THREE.Vector3 | null, dy: number, size: Size): OrbitView => {
  const at = view.at.clone();
  if (from && to) at.add(from.clone().sub(to));
  const up = upOf(view);
  let step = (dy * 2 * effectiveDistance(view, size.w / size.h) * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, size.h);
  if (Math.abs(up.y) > 1e-6) {
    const y = clamp(at.y + step * up.y, Math.min(MANUAL.atYMin, at.y), Math.max(MANUAL.atYMax, at.y));
    step = (y - at.y) / up.y;
  }
  at.addScaledVector(up, step);
  return { ...view, at: (from && to) || step ? clampAt(at) : at };
};

/**
 * Left-drag on empty bench (decided 2026-10-11): the bench slides with the pointer, up and down as well as sideways,
 * the bench point under the pointer staying under it (`from` and `to` are the bench points under the pointer before
 * and after). Near the horizon a pixel spans metres of bench, so one move goes at most a quarter of the distance.
 */
export const slideBy = (view: OrbitView, from: THREE.Vector3 | null, to: THREE.Vector3 | null): OrbitView => {
  if (!from || !to) return view;
  const step = from.clone().sub(to).setY(0);
  const most = view.distance / 4;
  if (step.length() > most) step.setLength(most);
  return { ...view, at: clampAt(view.at.clone().add(step)) };
};

/**
 * The wheel (`app.js:146-151`): zoom by e^(deltaY·k); `refit` then keeps the bench point under the pointer fixed. A view
 * already outside the range is not pulled into it (2026-10-16: Eye level's 0.16 m was thrown out to the old 0.3 m on
 * the first notch); the wheel only stops it going further out of it.
 */
export const zoomBy = (view: OrbitView, deltaY: number): OrbitView => ({
  ...copyView(view),
  distance: clamp(view.distance * Math.exp(deltaY * MANUAL.zoomPerDelta),
    Math.min(MANUAL.distanceMin, view.distance), Math.max(MANUAL.distanceMax, view.distance)),
});

/** The camera's up direction for `view` (no roll): a move along it moves the scene straight down the screen. */
export const upOf = (view: OrbitView): THREE.Vector3 => {
  const sp = Math.sin(view.pitch), cp = Math.cos(view.pitch);
  return new THREE.Vector3(-sp * Math.sin(view.yaw), cp, -sp * Math.cos(view.yaw));
};

/**
 * Framing's move of the look-at point for a centre `dy` pixels below where it should be, `upp` metres a pixel: along the
 * bench toward the viewer (the source's, its step stretched by 1/sin pitch), or near level, where that hardly moves the
 * view, down in the camera's own plane (2026-10-16).
 */
const lowerBy = (view: OrbitView, dy: number, upp: number): THREE.Vector3 => {
  if (view.pitch < LEVEL_PITCH) return upOf(view).multiplyScalar(-dy * upp);
  const away = new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
  return away.multiplyScalar(-dy * upp / Math.max(0.35, Math.sin(view.pitch)));
};

/** Choice 11: framing turns back to the front the short way, never unwinding whole turns made by hand. */
export const frontYaw = (yaw: number): number => Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;

const scratch = new THREE.PerspectiveCamera();
const project = (view: OrbitView, size: Size, points: readonly THREE.Vector3[]) => {
  applyView(scratch, view, size.w / size.h);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, inFront = true;
  const p = new THREE.Vector3();
  for (const point of points) {
    p.copy(point).project(scratch);
    const x = (p.x + 1) * 0.5 * size.w, y = (1 - p.y) * 0.5 * size.h;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (!(p.z > -1 && p.z < 1)) inFront = false;
  }
  return { x0, x1, y0, y1, inFront };
};

/**
 * Fit world points into a pixel rectangle by moving the look-at point and the distance (the source's
 * `fit`, `framing.js:29-50`): up to 14 projections; the look-at point starts at the points' centroid
 * on the bench plane. `limits` bound the distance.
 */
export const fit = (points: readonly THREE.Vector3[], base: OrbitView, size: Size, safe: Rect,
  limits = { min: FRAME_DISTANCE_MIN, max: MANUAL.distanceMax }): OrbitView => {
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
    view.at.addScaledVector(right, dx * upp).add(lowerBy(view, dy, upp));
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
 * How far a real framing's look-at point can lie: twice the source's manual limits (7 and 4.5 units), kept when the
 * manual forward-and-back range was doubled for the slide.
 */
export const FRAME_REACH = { x: 14 * S, z: 9 * S };

/**
 * Fit into each free rectangle and keep the one that frames the points largest (`framing.js:66-67`).
 * A fit that ran away is dropped: with a point close behind the camera its projection flips, and the
 * look-at point can be driven tens of metres off the bench (seen in Heat and Reweigh's practice, the
 * clay triangle placed with the ring stand at the bench's front edge), leaving an empty view. A real
 * framing keeps the look-at point within `FRAME_REACH`; with none left the view stays.
 */
export const fitBest = (points: readonly THREE.Vector3[], base: OrbitView, size: Size, rects: readonly Rect[],
  limits?: { min: number; max: number }): OrbitView | undefined => rects
  .map((rect) => fit(points, base, size, rect, limits))
  .filter((c) => [c.at.x, c.at.y, c.at.z, c.distance, c.pitch].every(Number.isFinite))
  .filter((c) => Math.abs(c.at.x) <= FRAME_REACH.x && Math.abs(c.at.z) <= FRAME_REACH.z)
  .sort((a, b) => a.distance - b.distance)[0];

/**
 * A steady fit (2026-10-12): from `base`'s angle, the least distance within `limits` at which the points lie within
 * `rect`, or none if they do not fit even at the farthest. The source's `fit` above moves the look-at point and the
 * distance together. From a low pitch, with points spread far back and high (the shelf behind the working area), that
 * overshoots and swings between too near and too far without settling: found with Home at pitch 0.45, where after its
 * 14 steps the points could lie under the step card or past the screen's edge. Here, at a given distance the look-at
 * point alone centres the points, a near-linear move that settles in a few steps, and the distance is found by
 * bisection.
 */
export const fitSteady = (points: readonly THREE.Vector3[], base: OrbitView, size: Size, rect: Rect,
  limits = { min: FRAME_DISTANCE_MIN, max: MANUAL.distanceMax }): OrbitView | undefined => {
  const cx = (rect.left + rect.right) / 2, cy = (rect.top + rect.bottom) / 2;
  const n = points.length || 1;
  const start = new THREE.Vector3(points.reduce((s, p) => s + p.x, 0) / n, 0, points.reduce((s, p) => s + p.z, 0) / n);
  const right = new THREE.Vector3(Math.cos(base.yaw), 0, -Math.sin(base.yaw));
  const centred = (distance: number) => {
    const view: OrbitView = { ...copyView(base), at: start.clone(), distance };
    let b = project(view, size, points);
    for (let i = 0; i < 16; i += 1) {
      const dx = (b.x0 + b.x1) / 2 - cx, dy = (b.y0 + b.y1) / 2 - cy;
      if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) break;
      const upp = (2 * effectiveDistance(view, size.w / size.h) * Math.tan((FOV * Math.PI) / 360)) / size.h;
      view.at.addScaledVector(right, dx * upp).add(lowerBy(view, dy, upp));
      b = project(view, size, points);
    }
    const fits = b.inFront && b.x0 >= rect.left - 0.5 && b.x1 <= rect.right + 0.5 && b.y0 >= rect.top - 0.5 && b.y1 <= rect.bottom + 0.5;
    return { view, fits };
  };
  let near = limits.min, far = limits.max;
  let best = centred(far);
  if (!best.fits) return undefined;
  for (let i = 0; i < 24; i += 1) {
    const mid = (near + far) / 2, at = centred(mid);
    if (at.fits) { far = mid; best = at; } else near = mid;
  }
  return best.view;
};

/**
 * Auto view's fit (you, 2026-10-12: "Switch Auto view"): as `fitBest`, the free rectangle that frames the points
 * largest, but with the steady fit. Auto view frames from the learner's angle, often Home's low pitch, where the
 * source's fit swings. A view whose look-at point lies past `FRAME_REACH` is dropped. Where the points fit no rectangle
 * even at the farthest, the source's fit frames them as before: centring alone does not settle on points larger than
 * the rectangle.
 */
export const fitBestSteady = (points: readonly THREE.Vector3[], base: OrbitView, size: Size, rects: readonly Rect[],
  limits = { min: FRAME_DISTANCE_MIN, max: MANUAL.distanceMax }): OrbitView | undefined => {
  const real = (view: OrbitView | undefined): view is OrbitView => view !== undefined
    && [view.at.x, view.at.z, view.distance].every(Number.isFinite) && Math.abs(view.at.x) <= FRAME_REACH.x && Math.abs(view.at.z) <= FRAME_REACH.z;
  return rects.map((rect) => fitSteady(points, base, size, rect, limits)).filter(real).sort((a, b) => a.distance - b.distance)[0]
    ?? fitBest(points, base, size, rects, limits);
};

/** The source's tween easing (`framing.js:7`, easeInOutCubic). */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const lerpView = (a: OrbitView, b: OrbitView, t: number): OrbitView => ({
  at: a.at.clone().lerp(b.at, t),
  yaw: a.yaw + (b.yaw - a.yaw) * t,
  pitch: a.pitch + (b.pitch - a.pitch) * t,
  distance: a.distance + (b.distance - a.distance) * t,
});
