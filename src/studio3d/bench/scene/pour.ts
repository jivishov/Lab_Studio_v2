import * as THREE from "three";
import type { Equipment3DEntry, Equipment3DFill } from "../../equipment3d/types";
import { radiusAt } from "./contents";

/**
 * Geometry for a committed pour's animation (handoff §5.7): how a source vessel is posed to pour
 * from its lip, how high its liquid stands when it is tilted, and the falling stream. Presentation
 * only; the volumes animated between always come from runtime state before and after the pour.
 *
 * Model-local millimetres are (x right, y away, z up); three.js is metres, y up.
 */
const MM = 0.001;
const DEG = Math.PI / 180;
export const UP = Object.freeze(new THREE.Vector3(0, 1, 0));

/** Model-local millimetres -> the item's three.js local frame, metres. */
export const localPoint = (mm: number[]): THREE.Vector3 => new THREE.Vector3(mm[0] * MM, mm[2] * MM, -mm[1] * MM);

/** Where liquid leaves the source, and which way it is aimed (a wash bottle's tube). */
export interface PourGeometry {
  style: "pour" | "squeeze-jet";
  lip: THREE.Vector3;
  /** Horizontal unit vector, local, from the vessel axis toward the lip. */
  lipDir: THREE.Vector3;
  /** Local unit direction the jet leaves the tip in, for squeeze-jet. */
  tipDir?: THREE.Vector3;
  tiltMax: number;
}

export const pourGeometry = (entry: Equipment3DEntry): PourGeometry => {
  const pour = entry.pour;
  const top = entry.fill?.innerBoxMm?.topZ ?? entry.fill?.innerProfileMm?.at(-1)?.[1] ?? 100;
  const lip = localPoint(pour?.lipMm ?? [0, 0, top]);
  const lipDir = new THREE.Vector3(lip.x, 0, lip.z);
  if (lipDir.lengthSq() < 1e-10) lipDir.set(-1, 0, 0);
  lipDir.normalize();
  const tipDir = pour?.tipDirection ? localPoint(pour.tipDirection).normalize() : undefined;
  return { style: pour?.style ?? "pour", lip, lipDir, ...(tipDir ? { tipDir } : {}), tiltMax: (pour?.tiltDeg ?? 90) * DEG };
};

/**
 * The source's orientation for a pour: turned about the vertical so its lip faces `toward` (a
 * horizontal world direction), then tipped by `tilt` about the horizontal axis across the lip, so
 * the lip goes down.
 */
export const pourQuaternion = (geometry: PourGeometry, toward: THREE.Vector3, tilt: number): THREE.Quaternion => {
  const yaw = Math.atan2(-toward.z, toward.x) - Math.atan2(-geometry.lipDir.z, geometry.lipDir.x);
  const turn = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const across = new THREE.Vector3().crossVectors(UP, geometry.lipDir).normalize();
  return turn.multiply(new THREE.Quaternion().setFromAxisAngle(across, tilt));
};

/** The root position that puts the lip at `lipWorld` when the source has orientation `q`. */
export const rootForLip = (geometry: PourGeometry, q: THREE.Quaternion, lipWorld: THREE.Vector3): THREE.Vector3 =>
  lipWorld.clone().sub(geometry.lip.clone().applyQuaternion(q));

/** A vessel's inside as thin discs across its axis, millimetres. */
export interface VesselSlices {
  dz: number;
  slices: Array<{ z: number; r: number }>;
}

export const vesselSlices = (fill: Equipment3DFill | undefined, count = 96): VesselSlices | undefined => {
  if (!fill) return undefined;
  let z0: number;
  let z1: number;
  let radius: (z: number) => number;
  if (fill.innerBoxMm) {
    // A rectangular cavity is treated as the round one of the same cross-section area.
    const { width, depth, floorZ, topZ } = fill.innerBoxMm;
    const r = Math.sqrt((width * depth) / Math.PI);
    [z0, z1, radius] = [floorZ, topZ, () => r];
  } else {
    const profile = fill.innerProfileMm ?? [];
    if (profile.length < 2) return undefined;
    [z0, z1, radius] = [profile[0][1], profile[profile.length - 1][1], (z) => radiusAt(profile, z)];
  }
  const dz = (z1 - z0) / count;
  if (!(dz > 0)) return undefined;
  return { dz, slices: Array.from({ length: count }, (_, i) => { const z = z0 + (i + 0.5) * dz; return { z, r: radius(z) }; }) };
};

/** Area of a disc of radius r on the side of a chord at signed distance d from its centre. */
const segmentArea = (r: number, d: number): number => {
  if (d <= -r) return 0;
  if (d >= r) return Math.PI * r * r;
  return r * r * Math.acos(-d / r) + d * Math.sqrt(r * r - d * d);
};

/**
 * Millilitres below the world height `h` (metres) in a vessel whose axis passes through its root
 * at `base` in direction `axis` (a unit vector; model z). Each disc is cut by the level plane.
 */
export const volumeBelow = (vessel: VesselSlices, base: THREE.Vector3, axis: THREE.Vector3, h: number): number => {
  const s = Math.sqrt(Math.max(0, 1 - axis.y * axis.y));
  const hMm = h / MM;
  let mm3 = 0;
  for (const { z, r } of vessel.slices) {
    const cy = base.y / MM + axis.y * z;
    mm3 += (s < 1e-4 ? (cy <= hMm ? Math.PI * r * r : 0) : segmentArea(r, (hMm - cy) / s)) * vessel.dz;
  }
  return mm3 / 1000;
};

/** The world height (metres) at which `ml` stands level in the posed vessel. */
export const surfaceHeight = (vessel: VesselSlices, base: THREE.Vector3, axis: THREE.Vector3, ml: number): number => {
  const s = Math.sqrt(Math.max(0, 1 - axis.y * axis.y));
  let lo = Infinity;
  let hi = -Infinity;
  for (const { z, r } of vessel.slices) {
    const cy = base.y + axis.y * z * MM;
    lo = Math.min(lo, cy - r * s * MM);
    hi = Math.max(hi, cy + r * s * MM);
  }
  lo -= vessel.dz * MM;
  hi += vessel.dz * MM;
  if (ml <= 0) return lo;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (volumeBelow(vessel, base, axis, mid) < ml) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/**
 * The smallest tilt (up to `max`) at which `ml` in the vessel reaches the lip, so it starts to
 * flow. Computed with the vessel's root at the origin; a pour is independent of where it stands.
 */
export const onsetTilt = (vessel: VesselSlices, geometry: PourGeometry, ml: number, max: number): number => {
  const toward = new THREE.Vector3(1, 0, 0);
  for (let tilt = 0; tilt <= max; tilt += DEG) {
    const q = pourQuaternion(geometry, toward, tilt);
    const lipY = geometry.lip.clone().applyQuaternion(q).y;
    if (surfaceHeight(vessel, new THREE.Vector3(), UP.clone().applyQuaternion(q), ml) >= lipY) return tilt;
  }
  return max;
};

/** The part of a curve between fractions s0 and s1: a stream's leading and trailing edges. */
class CurveSpan extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly curve: THREE.Curve<THREE.Vector3>, private readonly s0: number, private readonly s1: number) {
    super();
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getPoint(this.s0 + (this.s1 - this.s0) * t, target);
  }
}

/**
 * A falling stream from `from` to `to`: for a pour, it leaves the lip almost level and drops; for
 * a squeeze jet, it leaves along `aim` and arcs down. Only the span [s0, s1] is drawn.
 */
export const streamGeometry = (from: THREE.Vector3, to: THREE.Vector3, radius: number, s0: number, s1: number, aim?: THREE.Vector3): THREE.BufferGeometry => {
  const control = aim
    ? from.clone().addScaledVector(aim, from.distanceTo(to) * 0.45)
    : new THREE.Vector3(from.x + (to.x - from.x) * 0.35, from.y - (from.y - to.y) * 0.08, from.z + (to.z - from.z) * 0.35);
  const curve = new CurveSpan(new THREE.QuadraticBezierCurve3(from.clone(), control, to.clone()), s0, s1);
  return new THREE.TubeGeometry(curve, 24, radius, 8, false);
};
