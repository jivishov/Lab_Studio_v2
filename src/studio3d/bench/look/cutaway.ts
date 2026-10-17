import * as THREE from "three";
import { CUT_BOXES, SIGHT_TARGETS, type Box, type CutName } from "./hall";

/**
 * Scenery in the camera's way is cut away (the lab room, decision 6, 2026-10-16): the orbit stays free, and a scenery
 * object fades out while it lies between the eye and the bench, as the single-sided walls already vanish from outside.
 *
 * - **What can be cut away:** each object that can come between the camera and the bench is its own entry, by its box
 *   (`CUT_BOXES`): the far island, the column, the neighbouring station's spine, the tall cabinets, the fume cupboard,
 *   the end wall's fittings and the stool. Our island, its bays over our station and the side station never are.
 * - **The test**, whenever the camera moves: an entry is in the way while its box meets a segment from the eye to the
 *   look-at point or to a corner of the working area or of the shelf's top (`SIGHT_TARGETS`), or holds the eye.
 * - **The fade:** `FADE_S` through `alphaHash` opacity, so it needs no sorting against the glass; under reduced motion it
 *   switches at once. A faded-out entry is hidden, so it costs nothing.
 *
 * The reflection captures see the room whole (`whole`); the contact-shadow pass hides the room anyway.
 */
export const FADE_S = 0.2;

interface Entry {
  name: CutName;
  box: THREE.Box3;
  objects: THREE.Object3D[];
  materials: Set<THREE.Material>;
  /** 1 shown, 0 cut away. */
  shown: number;
  goal: number;
}

const toBox3 = (b: Box) => new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));

/** Whether the segment from `a` to `b` meets `box`. */
export const segmentMeetsBox = (a: THREE.Vector3, b: THREE.Vector3, box: THREE.Box3): boolean => {
  if (box.containsPoint(a) || box.containsPoint(b)) return true;
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  if (length < 1e-9) return false;
  const hit = new THREE.Ray(a, dir.divideScalar(length)).intersectBox(box, new THREE.Vector3());
  return hit !== null && hit.distanceTo(a) <= length;
};

/** The entries in the way of an eye looking at `at` (names), by the rule above. */
export const inTheWay = (eye: THREE.Vector3, at: THREE.Vector3, boxes: Readonly<Record<CutName, Box>> = CUT_BOXES): CutName[] => {
  const targets = [at, ...SIGHT_TARGETS.map((t) => new THREE.Vector3(...t))];
  return (Object.keys(boxes) as CutName[]).filter((name) => {
    const b = toBox3(boxes[name]);
    return b.containsPoint(eye) || targets.some((t) => segmentMeetsBox(eye, t, b));
  });
};

export class Cutaway {
  private readonly entries = new Map<CutName, Entry>();

  constructor() {
    for (const name of Object.keys(CUT_BOXES) as CutName[]) {
      this.entries.set(name, { name, box: toBox3(CUT_BOXES[name]), objects: [], materials: new Set(), shown: 1, goal: 1 });
    }
  }

  /**
   * Put `object` under the entry `name`. Its materials become its own (each must be used by this entry alone) and take
   * `alphaHash`, so the fade needs no change of program.
   */
  add(name: CutName, object: THREE.Object3D): void {
    const entry = this.entries.get(name)!;
    entry.objects.push(object);
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!m.alphaHash) { m.alphaHash = true; m.needsUpdate = true; }
        m.userData.cutawayOpacity ??= m.opacity; // a glass's own opacity, faded with the rest
        entry.materials.add(m);
      }
    });
    this.apply(entry);
  }

  /** The names now cut away or fading out. */
  get hidden(): CutName[] {
    return [...this.entries.values()].filter((e) => e.goal === 0).map((e) => e.name);
  }

  /** Re-test after the camera moved. `immediate` (reduced motion, or the first view) switches without a fade. */
  update(eye: THREE.Vector3, at: THREE.Vector3, immediate = false): boolean {
    const away = new Set(inTheWay(eye, at));
    let changed = false;
    for (const entry of this.entries.values()) {
      const goal = away.has(entry.name) ? 0 : 1;
      if (goal !== entry.goal) changed = true;
      entry.goal = goal;
      if (immediate && entry.shown !== goal) { entry.shown = goal; this.apply(entry); }
    }
    return changed;
  }

  /** Advance the fades by `dt` seconds; true while any is still fading. */
  tick(dt: number, reducedMotion = false): boolean {
    let fading = false;
    for (const entry of this.entries.values()) {
      if (entry.shown === entry.goal) continue;
      const step = reducedMotion ? 1 : dt / FADE_S;
      entry.shown = entry.goal > entry.shown ? Math.min(entry.goal, entry.shown + step) : Math.max(entry.goal, entry.shown - step);
      this.apply(entry);
      if (entry.shown !== entry.goal) fading = true;
    }
    return fading;
  }

  /** Run `fn` with every entry shown whole (the reflection captures), then restore each as it was. */
  whole<T>(fn: () => T): T {
    const was = [...this.entries.values()].map((e) => e.shown);
    this.entries.forEach((e) => { e.shown = 1; this.apply(e); });
    try {
      return fn();
    } finally {
      [...this.entries.values()].forEach((e, i) => { e.shown = was[i]; this.apply(e); });
    }
  }

  private apply(entry: Entry): void {
    const t = entry.shown;
    entry.materials.forEach((m) => { m.opacity = (m.userData.cutawayOpacity ?? 1) * t; });
    entry.objects.forEach((o) => { o.visible = t > 0; });
  }
}
