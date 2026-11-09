import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createRuntimeState, type RuntimeDefinition } from "../../runtime";
import { shelfSpots, stableShelfOrder, type ShelfSpot } from "../adapters/shelfSpots";
import { applyView, DEFAULT_VIEW, MANUAL, safeRects, type OrbitView, type Rect, type Size } from "../bench/camera/benchCamera";
import { homeMarks, homeView } from "../bench/camera/home";
import { DEFAULT_HAND_HOME, palmCursor } from "../hand/handTracker";
import { HAND_DEFAULTS } from "../hand/handTuning";

// Home fitted to the screen (you, 2026-10-12: "the equipment is small and difficult to notice").

const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const technique3d = (id: string): RuntimeDefinition => {
  const entry = (read("public/techniques-3d/index.json") as Array<{ id: string; file: string }>).find((t) => t.id === id);
  return read(entry ? `public/techniques-3d/${entry.file}` : `public/techniques/${id}.json`);
};
/** The spots of what starts on the shelf and at the side station. */
const startSpots = (id: string): ShelfSpot[] => {
  const state = createRuntimeState(technique3d(id));
  const spots = shelfSpots(stableShelfOrder(state.equipmentInstances, undefined));
  return state.equipmentInstances.filter((i) => i.location === "shelf").map((i) => spots.get(i.id)!).filter(Boolean);
};

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
/** Every mark lies in one free rectangle (fit converges to within a pixel and 1 %). */
const inOneRect = (view: OrbitView, size: Size, marks: readonly THREE.Vector3[], rects: readonly Rect[]) => {
  const b = projected(view, size, marks), slack = 0.01 * size.w;
  return rects.some((r) => b.left >= r.left - slack && b.right <= r.right + slack && b.top >= r.top - slack && b.bottom <= r.bottom + slack);
};

describe("Home fitted to the screen", () => {
  const chromatography = startSpots("paper-chromatography-practice");

  it("keeps Home's angle and comes closer on a wide screen: Paper Chromatography at 1907 × 897", () => {
    expect(chromatography.some((s) => s.place === "station")).toBe(false);
    const size = { w: 1907, h: 897 }, rects = stage(size, 795);
    const view = homeView(chromatography, size, rects);
    expect(view.pitch).toBe(DEFAULT_VIEW().pitch);
    expect(view.yaw).toBe(DEFAULT_VIEW().yaw);
    // About 1.3 times as large as the fixed Home (32 units): the upper tier's cylinder and wash bottle stand above the
    // shelf, so the height from their tops to the working area's front edge is what binds.
    expect(DEFAULT_VIEW().distance / view.distance).toBeGreaterThan(1.25);
    expect(inOneRect(view, size, homeMarks(chromatography), rects)).toBe(true);
  });

  it("takes in the side station only when it holds items", () => {
    const size = { w: 1280, h: 800 }, rects = stage(size, 716);
    const spots = startSpots("thermal-decomposition-mass-loss-practice");
    const tiers = spots.filter((s) => s.place === "tier");
    expect(spots.length - tiers.length).toBe(4);
    // The marks reach past the working area's right end only with the station's items.
    expect(Math.max(...homeMarks(spots).map((p) => p.x))).toBeGreaterThan(0.74);
    expect(Math.max(...homeMarks(tiers).map((p) => p.x))).toBeLessThanOrEqual(0.7);
    const withStation = homeView(spots, size, rects), without = homeView(tiers, size, rects);
    expect(inOneRect(withStation, size, homeMarks(spots), rects)).toBe(true);
    expect(inOneRect(without, size, homeMarks(tiers), rects)).toBe(true);
    // Heat and Reweigh's four (the most it holds) take Home back, within the wheel's reach. (Closer than the fixed
    // Home until the working area reached 300 mm farther left, 2026-11-09.)
    expect(withStation.distance).toBeGreaterThan(without.distance * 1.1);
    expect(withStation.distance).toBeLessThanOrEqual(MANUAL.distanceMax);
  });

  it("stays within the wheel's reach, and is the fixed Home where nothing fits beside the step card", () => {
    const size = { w: 1024, h: 700 }, rects = stage(size, 616);
    const view = homeView(chromatography, size, rects);
    expect(inOneRect(view, size, homeMarks(chromatography), rects)).toBe(true);
    // The 1700 mm working area (2026-11-09) takes Home past the fixed Home here, within the wheel's reach (below).
    expect(view.distance).toBeGreaterThan(DEFAULT_VIEW().distance);
    for (const [w, h, dock] of [[1907, 897, 795], [1280, 800, 716], [1024, 700, 616]]) {
      expect(homeView(chromatography, { w, h }, stage({ w, h }, dock)).distance).toBeLessThanOrEqual(MANUAL.distanceMax);
    }
    // Heat and Reweigh's four large items and its tall shelf at 1024 × 700 do not fit beside the step card even at the
    // wheel's farthest, so Home is the fixed one, as before.
    expect(homeView(startSpots("thermal-decomposition-mass-loss-practice"), size, rects)).toEqual(DEFAULT_VIEW());
  });

  it("fits the whole canvas when no free stage is given", () => {
    const size = { w: 1280, h: 800 };
    const view = homeView(chromatography, size);
    expect(inOneRect(view, size, homeMarks(chromatography), safeRects(size, []))).toBe(true);
  });
});

// Tray-to-shelf build, phase 3: a comfortable raise of the hand reaches the upper tier at Home.
describe("the hand reaches the shelf's upper tier at Home", () => {
  /** The highest centre on screen, in px, of the items that start on the upper tier. */
  const upperTop = (spots: readonly ShelfSpot[], view: OrbitView, size: Size) => {
    const camera = new THREE.PerspectiveCamera();
    applyView(camera, view, size.w / size.h);
    return Math.min(...spots.filter((s) => s.place === "tier" && s.tier === 1).map((s) => {
      const corners = homeMarks([s]).slice(16); // after the working area's and the shelf's 8 corners each
      const q = corners.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / corners.length).project(camera);
      return (1 - q.y) * 0.5 * size.h;
    }));
  };

  it("at the default gain, a raise of 0.15 of the webcam frame takes the cursor above every upper-tier item; at the lowest, the palm stays in frame", () => {
    const routes = ["transfer-practice", "hard-water-precipitation-practice", "filtration-practice", "drying-practice",
      "thermal-decomposition-mass-loss-practice", "paper-chromatography-practice", "transmittance-dilution", "weighing"];
    // Laptop and wide screens, and a tablet each way round (G-12).
    const screens: Array<[number, number, number]> = [[1024, 700, 616], [1280, 800, 716], [1907, 897, 795], [1180, 820, 736], [834, 1112, 1028]];
    const home = DEFAULT_HAND_HOME;
    for (const id of routes) {
      const spots = startSpots(id);
      for (const [w, h, dock] of screens) {
        const size = { w, h }, top = upperTop(spots, homeView(spots, size, stage(size, dock)), size);
        // The highest needs about 0.13 of the frame (Weigh a Sample at 1907 × 897): some 6 cm at arm's length.
        expect(palmCursor({ x: home.x, y: home.y - 0.15 }, home, HAND_DEFAULTS.gain).y * h, `${id} at ${w} × ${h}`).toBeLessThan(top);
        // At gain 1 the highest needs a raise of about 0.3: the palm is still more than 0.1 of the frame below its top edge.
        expect(palmCursor({ x: home.x, y: 0.1 }, home, 1).y * h, `${id} at ${w} × ${h}, gain 1`).toBeLessThan(top);
      }
    }
  });
});
