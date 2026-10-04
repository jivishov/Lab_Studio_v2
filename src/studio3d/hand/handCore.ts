/**
 * The DNA microarray 3D lab's deterministic hand-interaction core, transcribed into TypeScript from
 * `virtual_lab/experiments/dnamicroarray_v2/3d-v3/hand-core.js` (decided 2026-10-03/04;
 * `proposals/MICROARRAY_ADOPTION.md` §7.3, choice 12). No camera or DOM dependency. Used by Player3D
 * only; the 2D player keeps its own gesture engine under `src/player/gesture/`.
 */

/** Longest tracking gap a gesture survives. MediaPipe drops a few frames in quick moves or on slow CPUs; no gesture edge is produced during a gap. */
export const HAND_GAP_MS = 400;

export type Vec = number[];
export const clamp = (x: number, a = 0, b = 1): number => Math.max(a, Math.min(b, x));
export const sub = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]);
export const dot = (a: Vec, b: Vec): number => a.reduce((n, v, i) => n + v * b[i], 0);
export const norm = (a: Vec): number => Math.hypot(...a);
export const unit = (a: Vec): Vec => a.map((v) => v / (norm(a) || 1e-9));
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const angle = (a: Vec, b: Vec): number => Math.acos(clamp(dot(unit(a), unit(b)), -1, 1));

/** One Euro filter for the cursor. */
export class OneEuro {
  x: number | null = null;
  dx = 0;
  t: number | null = null;
  constructor(public minCutoff = 1.2, public beta = 6, public dCutoff = 1.2) {}
  reset(): void { this.x = null; this.dx = 0; this.t = null; }
  alpha(cutoff: number, dt: number): number { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  update(x: number, t: number): number | null {
    if (!Number.isFinite(x) || !Number.isFinite(t)) return this.x;
    if (this.x === null || this.t === null || t <= this.t || t - this.t > 300) { this.x = x; this.dx = 0; this.t = t; return x; }
    const dt = clamp((t - this.t) / 1000, 0.004, 0.2), d = (x - this.x) / dt;
    this.dx += this.alpha(this.dCutoff, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.alpha(cutoff, dt) * (x - this.x);
    this.t = t;
    return this.x;
  }
}

/** Plunger edges from a 0..1 press depth. The bands leave a dead middle so a hovering thumb cannot chatter. */
export class PressGate {
  rest: number;
  press: number;
  active = false;
  armed = false;
  since: number | null = null;
  last: number | null = null;
  band: "rest" | "middle" | "press" | null = null;
  constructor(bands: { rest?: number; press?: number } = {}) {
    this.rest = bands.rest ?? 0.28;
    this.press = bands.press ?? 0.65;
  }
  reset(): void { this.active = false; this.armed = false; this.since = null; this.last = null; this.band = null; }
  update(depth: number, now: number, valid = true): "press" | "release" | null {
    if (!valid || !Number.isFinite(depth) || !Number.isFinite(now) || (this.last !== null && (now - this.last > HAND_GAP_MS || now < this.last))) {
      this.reset();
      if (!valid || !Number.isFinite(depth) || !Number.isFinite(now)) return null;
    }
    this.last = now;
    const band = depth < this.rest ? "rest" : depth > this.press ? "press" : "middle";
    if (band !== this.band) { this.band = band; this.since = now; }
    const since = this.since ?? now;
    if (band === "rest" && now - since >= 75) { const was = this.active; this.active = false; this.armed = true; return was ? "release" : null; }
    if (band === "press" && now - since >= 65 && this.armed && !this.active) { this.active = true; this.armed = false; return "press"; }
    return null;
  }
}

export interface Landmark { x: number; y: number; z: number }

export interface HandMeasure {
  /** Thumb features (7), compared against the Rest and Press calibration. */
  features: number[];
  shape: number[];
  normal: Vec;
  axis: Vec;
  grip: boolean;
  open: boolean;
  pinch: boolean;
  pinchRatio: number;
  extended: number;
  palmX: number;
  palmY: number;
  rotation: [number, number, number];
}

/** Hand pose from MediaPipe's 21 world and image landmarks; null when the hand is not measurable. */
export const measureHand = (world: readonly Landmark[] | undefined, lm: readonly Landmark[] | undefined): HandMeasure | null => {
  if (!world || world.length !== 21 || !lm || lm.length !== 21) return null;
  const finite = (i: number) => world[i] && [world[i].x, world[i].y, world[i].z].every(Number.isFinite);
  if (![0, 1, 2, 3, 4, 5, 9, 17].every(finite)) return null;
  const p = world.map((v) => (v ? [v.x, v.y, v.z] : [0, 0, 0]));
  const bones = [norm(sub(p[2], p[1])), norm(sub(p[3], p[2])), norm(sub(p[4], p[3]))];
  const scale = bones.reduce((a, b) => a + b, 0);
  if (scale < 0.015 || scale > 0.25 || bones.some((v) => v / scale < 0.1 || v / scale > 0.65)) return null;
  const features: number[] = [];
  for (const i of [3, 4]) for (const j of [0, 1, 2]) features.push(norm(sub(p[i], p[j])) / scale);
  const axis = unit(sub(p[2], p[1]));
  features.push((2 * (0.75 * dot(sub(p[4], p[2]), axis) + 0.25 * dot(sub(p[3], p[2]), axis))) / (bones[1] + bones[2]));
  const palmAxis = unit(sub(p[9], p[0])), across = unit(sub(p[5], p[17])), normal = unit(cross(across, palmAxis));
  let extended = 0, folded = 0;
  for (const [base, pip, tip] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
    if (![base, pip, tip].every(finite)) continue;
    const dp = norm(sub(p[pip], p[0])), dt = norm(sub(p[tip], p[0]));
    if (dt > dp * 1.27) extended += 1;
    if (dt < dp * 1.12) folded += 1;
  }
  const pinchRatio = norm(sub(p[4], p[8])) / Math.max(0.015, norm(sub(p[5], p[17])));
  const pinch = pinchRatio < 0.4;
  // The palm point uses the wrist and the index/pinky knuckles only, so thumb movement never shifts it.
  return {
    features, shape: bones.map((v) => v / scale), normal, axis: palmAxis,
    grip: folded >= 2 || pinch, open: extended >= 3 && !pinch, pinch, pinchRatio, extended,
    palmX: (lm[0].x + lm[5].x + lm[17].x) / 3, palmY: (lm[0].y + lm[5].y + lm[17].y) / 3,
    rotation: [Math.atan2(palmAxis[2], -palmAxis[1]), Math.atan2(normal[0], normal[2]), Math.atan2(palmAxis[0], -palmAxis[1])],
  };
};

/** How far the thumb is from Rest toward Press (0..1), and whether the pose lies near that line. */
export const thumbDepth = (features: Vec, rest?: Vec, press?: Vec): { depth: number; valid: boolean } => {
  if (!rest || !press) return { depth: 0, valid: false };
  const d = sub(press, rest), v = sub(features, rest), den = dot(d, d);
  if (den < 0.0004) return { depth: 0, valid: false };
  const depth = dot(v, d) / den, err = norm(sub(v, d.map((x) => x * depth))) / Math.sqrt(d.length);
  return { depth, valid: Number.isFinite(depth) && depth > -0.7 && depth < 2 && err < Math.max(0.11, Math.sqrt(den / d.length) * 0.8) };
};

/**
 * Hand exits, in normalized camera units measured from the locked palm position. The camera sees
 * roughly an arm's-length width, so .01 is about 6 mm of hand travel. The limits are generous, and
 * the controller acts only when an exit lasts or is clearly deliberate (twice the limit).
 */
export const HAND_EXIT = { travel: 0.042, lift: -0.03, backUp: 0.012, sideShallow: 0.03, sideDeep: 0.05, overshoot: 0.07, deep: 0.25 };

/** One frame of hand (or mouse) input, as the controller sees it. */
export interface HandFrame {
  x: number;
  y: number;
  now: number;
  source: "hand" | "mouse";
  rawX?: number;
  palmY?: number;
  dragX?: number;
  dragY?: number;
  ready?: boolean;
  grip?: boolean;
  open?: boolean;
  hold?: boolean;
  thumbDown?: boolean;
  thumbDepth?: number;
  pinch?: boolean;
  normal?: Vec;
}

/** A locked contact with a target: insertion depth from lowering the palm, and the exits that end it. */
export class Contact<T> {
  x: number;
  y: number;
  cx: number;
  cy: number;
  last: number;
  source: "hand" | "mouse";
  depth = 0;
  inserted = false;
  valid = true;
  reason = "";
  rearmed = true;
  exit: string | null = null;
  far = false;
  exitSince: number | null = null;
  exitDepth: number | null = null;
  constructor(public target: T, f: HandFrame) {
    this.x = f.rawX ?? f.x;
    this.y = f.palmY ?? f.y;
    this.cx = f.x;
    this.cy = f.y;
    this.last = f.now;
    this.source = f.source;
  }
  /** `holding`: a plunger stroke is bound to this target, so deeper travel is tolerated instead of being treated as moving on. */
  update(f: HandFrame, holding = false): this {
    const x = f.rawX ?? f.x, y = f.palmY ?? f.y;
    if (![x, y, f.now].every(Number.isFinite) || f.now < this.last || (this.source === "hand" && f.now - this.last > HAND_GAP_MS)) {
      this.valid = false; this.reason = "tracking"; return this;
    }
    this.last = f.now;
    if (this.source === "hand") {
      // Leave by lifting above the lock height, lifting back up after inserting, moving well to the side, or travelling far past the insertion depth with no stroke bound.
      const L = HAND_EXIT, dx = x - this.x, dy = y - this.y, side = Math.abs(dx);
      this.depth = clamp(dy / L.travel);
      if (this.depth >= 0.85) this.inserted = true;
      const sideLimit = this.depth >= 0.35 ? L.sideDeep : L.sideShallow;
      let exit: string | null = null, far = false;
      if (dy < L.lift) { exit = "withdrawal"; far = dy < 2 * L.lift; }
      else if (this.inserted && dy < L.backUp) { exit = "withdrawal"; far = dy < L.lift / 2; }
      else if (side > sideLimit) { exit = "slide"; far = side > 2 * sideLimit; }
      else if (dy > (holding ? L.deep : L.overshoot)) { exit = "overshoot"; far = true; }
      this.exit = exit;
      this.far = far;
    } else {
      // Mouse contact stays locked for the whole left-button stroke; dragging above the entry point withdraws.
      const dy = Number.isFinite(f.dragY) ? (f.dragY as number) : y - this.y;
      if (dy < -32) { this.valid = false; this.reason = "withdrawal"; return this; }
      this.depth = clamp(Math.max(0, dy) / 28);
    }
    if (this.depth < 0.18) this.rearmed = true;
    return this;
  }
}
