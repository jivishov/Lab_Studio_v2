import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createRuntimeState, type RuntimeDefinition } from "../../runtime";
import { BENCH_MM } from "../adapters/benchCoordinates";
import { SHELF, shelfSpots, SIDE_STATION, stableShelfOrder } from "../adapters/shelfSpots";
import { DEFAULT_VIEW, eyeOf, MANUAL, PRESETS, type OrbitView } from "../bench/camera/benchCamera";
import { homeView } from "../bench/camera/home";
import { Cutaway, FADE_S, inTheWay } from "../bench/look/cutaway";
import { CUT_BOXES, FRONT_ZONE, KEEP_CLEAR, SIGHT_TARGETS, type CutName } from "../bench/look/hall";
import { buildRoom } from "../bench/look/room";
import { buildSpines } from "../bench/look/spines";
import type { BenchTextures } from "../bench/look/textures";

// The lab room, phase 1 (2026-10-16, LAB_ROOM_LAYOUT.md revision 2): the hall is scenery round the working area, which
// does not move; scenery in the camera's way is cut away.

const read = (path: string) => JSON.parse(readFileSync(join(process.cwd(), ...path.split("/")), "utf8"));
const technique3d = (id: string): RuntimeDefinition => {
  const entry = (read("public/techniques-3d/index.json") as Array<{ id: string; file: string }>).find((t) => t.id === id);
  return read(entry ? `public/techniques-3d/${entry.file}` : `public/techniques/${id}.json`);
};

/** The room's textures stand in as plain textures: jsdom draws no canvas. */
const fakeTextures = () => new Proxy({} as Record<string, THREE.Texture>, {
  get: (made, key: string) => (made[key] ??= new THREE.Texture()),
}) as unknown as BenchTextures;

/** A stand-in for a loaded model: one box over its registry bounds (model-local mm, z up), as the GLB is y up. */
const modelOver = (min: [number, number, number], max: [number, number, number], name: string) => {
  const root = new THREE.Group();
  const g = new THREE.BoxGeometry((max[0] - min[0]) / 1000, (max[2] - min[2]) / 1000, (max[1] - min[1]) / 1000)
    .translate((min[0] + max[0]) / 2000, (min[2] + max[2]) / 2000, -(min[1] + max[1]) / 2000);
  root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name })));
  return root;
};
const shelfModel = () => modelOver([-667, -92, 0], [624, 90, 580], "shelf");
const rodsModel = () => modelOver([-520, -88, 520], [520, 61, 1180], "rods");

const build = () => {
  const room = buildRoom({ textures: fakeTextures(), shadowMapSize: 0 });
  const spines = buildSpines(shelfModel(), rodsModel());
  return { room, spines };
};

/** Every triangle's box under `root`, world space. */
const triangleBoxes = (root: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const boxes: THREE.Box3[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const p = g.attributes.position;
    const a = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      const box = new THREE.Box3();
      for (let k = 0; k < 3; k += 1) box.expandByPoint(a.fromBufferAttribute(p, i + k).applyMatrix4(mesh.matrixWorld));
      boxes.push(box);
    }
  });
  return boxes;
};
const toBox3 = (b: { min: readonly number[]; max: readonly number[] }) =>
  new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
/** Overlap with some volume, not just a touch at a face. */
const overlaps = (a: THREE.Box3, b: THREE.Box3) => {
  const i = a.clone().intersect(b);
  return !i.isEmpty() && i.max.x - i.min.x > 1e-4 && i.max.y - i.min.y > 1e-4 && i.max.z - i.min.z > 1e-4;
};

describe("the hall keeps clear of the bench", () => {
  const { room, spines } = build();
  const scenery = new THREE.Group().add(room.group, spines.neighbour, spines.far);
  const boxes = triangleBoxes(scenery);

  it.each(Object.keys(KEEP_CLEAR))("puts nothing over the %s", (name) => {
    const keep = toBox3(KEEP_CLEAR[name]);
    expect(boxes.filter((b) => overlaps(b, keep))).toHaveLength(0);
  });

  it("stands nothing in the front zone (the floor and walls only bound it)", () => {
    const zone = toBox3(FRONT_ZONE);
    zone.min.y += 0.01; // the floor
    zone.max.y -= 0.02; // the ceiling's fittings
    zone.min.x += 0.01; zone.max.x -= 0.01; zone.max.z -= 0.01; // the walls and their coves
    const inside = boxes.filter((b) => overlaps(b, zone)).filter((b) => b.max.y - b.min.y > 0.12 || b.min.y > -0.79);
    expect(inside).toHaveLength(0);
  });

  it("is never picked", () => {
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 1.5, 3), new THREE.Vector3(0, -0.4, -1).normalize());
    expect(raycaster.intersectObject(scenery, true)).toHaveLength(0);
  });
});

describe("the working area does not move", () => {
  it("keeps BENCH_MM, the shelf, the side station and the default view", () => {
    expect(BENCH_MM).toEqual({ width: 1400, depth: 700, edgeMargin: 40 });
    expect(SHELF).toMatchObject({ centre: { xMm: 0, yMm: 460 }, lengthMm: 1200, depthMm: 180, tierTopsMm: [300, 520], heightMm: 580 });
    expect(SIDE_STATION).toEqual({ xMinMm: 740, xMaxMm: 1300, yMinMm: -320, yMaxMm: 540 });
    const home = DEFAULT_VIEW();
    expect(home.at.toArray().map((x) => +x.toFixed(4))).toEqual([-0.2987, 0, -0.224]);
    expect([home.yaw, home.pitch, +home.distance.toFixed(4)]).toEqual([0, 0.45, 2.9867]);
  });

  it.each(["hard-water-precipitation", "paper-chromatography"])("keeps the shelf spots and Home of %s", (id) => {
    const state = createRuntimeState(technique3d(id));
    const spots = shelfSpots(stableShelfOrder(state.equipmentInstances, undefined));
    const row = [...spots.entries()].map(([key, s]) => `${key} ${s.tier} ${s.centre.xMm.toFixed(1)},${s.centre.yMm.toFixed(1)}`);
    const view = homeView([...spots.values()], { w: 1280, h: 748 });
    expect({ row, home: [...view.at.toArray(), view.yaw, view.pitch, view.distance].map((x) => +x.toFixed(4)) }).toMatchSnapshot();
  });
});

describe("the cutaway", () => {
  const { room, spines } = build();
  const parts: Array<[CutName, THREE.Object3D]> = [
    ...(Object.entries(room.cut) as Array<[CutName, THREE.Object3D]>),
    ["neighbourSpine", spines.neighbour],
    ["farIsland", spines.far],
  ];
  const scenery = new THREE.Group().add(room.group, spines.neighbour, spines.far);
  scenery.updateMatrixWorld(true);

  /** The cut groups whose geometry a sight line from `eye` meets, by ray against their triangles. */
  const blocking = (eye: THREE.Vector3, at: THREE.Vector3) => {
    const found = new Set<CutName>();
    for (const target of [at, ...SIGHT_TARGETS.map((t) => new THREE.Vector3(...t))]) {
      const dir = target.clone().sub(eye), length = dir.length();
      const raycaster = new THREE.Raycaster(eye, dir.normalize(), 0, length);
      for (const [name, object] of parts) {
        object.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const hits: THREE.Intersection[] = [];
          THREE.Mesh.prototype.raycast.call(mesh, raycaster, hits);
          if (hits.length) found.add(name);
        });
      }
    }
    return found;
  };

  it("builds a group for every entry, our island in none", () => {
    expect(new Set(parts.map(([n]) => n))).toEqual(new Set(Object.keys(CUT_BOXES)));
    for (const [, object] of parts) object.traverse((o) => expect(o.name).not.toBe("bench"));
  });

  const views: Array<[string, OrbitView]> = [];
  for (let k = 0; k < 8; k += 1) {
    const yaw = (k * Math.PI) / 4;
    views.push([`yaw ${k * 45}° at Home's distance`, { ...DEFAULT_VIEW(), yaw }]);
    views.push([`yaw ${k * 45}° zoomed out and low`, { ...DEFAULT_VIEW(), yaw, pitch: MANUAL.pitchMin, distance: MANUAL.distanceMax }]);
  }
  views.push(["Overhead", PRESETS.top()]);

  it.each(views)("hides what stands in the sight lines, from %s", (_, view) => {
    const eye = eyeOf(view, 16 / 9);
    const hidden = new Set(inTheWay(eye, view.at));
    for (const name of blocking(eye, view.at)) expect(hidden, name).toContain(name);
    const cutaway = new Cutaway();
    for (const [name, object] of parts) cutaway.add(name, object);
    cutaway.update(eye, view.at, true);
    expect(new Set(cutaway.hidden)).toEqual(hidden);
    for (const [name, object] of parts) expect(object.visible).toBe(!hidden.has(name));
  });

  it("fades over 200 ms through alphaHash, at once under reduced motion, and shows the room whole for captures", () => {
    const cutaway = new Cutaway();
    const column = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true }));
    cutaway.add("column", column);
    const material = column.material;
    expect(material.alphaHash).toBe(true);
    const c = CUT_BOXES.column;
    const inside = new THREE.Vector3((c.min[0] + c.max[0]) / 2, 0.5, (c.min[2] + c.max[2]) / 2);
    expect(cutaway.update(inside, new THREE.Vector3(), false)).toBe(true);
    expect(cutaway.tick(FADE_S / 2)).toBe(true);
    expect(material.opacity).toBeCloseTo(0.25, 6);
    expect(cutaway.whole(() => [column.visible, material.opacity])).toEqual([true, 0.5]);
    expect(material.opacity).toBeCloseTo(0.25, 6);
    expect(cutaway.tick(FADE_S / 2)).toBe(false);
    expect(column.visible).toBe(false);
    cutaway.update(new THREE.Vector3(0, 1, 3), new THREE.Vector3(), false);
    expect(cutaway.tick(0.01, true)).toBe(false);
    expect([column.visible, material.opacity]).toEqual([true, 0.5]);
  });
});

describe("disposal", () => {
  it("disposes every geometry, material and texture the room and the spines made", () => {
    const { room, spines } = build();
    const made = new Set<{ dispose: () => void }>();
    for (const root of [room.group, spines.own, spines.neighbour, spines.far]) root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      made.add(mesh.geometry);
      for (const m of [mesh.material].flat()) {
        made.add(m);
        const map = (m as THREE.MeshStandardMaterial).map;
        if (map instanceof THREE.CanvasTexture) made.add(map);
      }
    });
    const disposed = new Set<unknown>();
    for (const d of made) {
      const own = d.dispose.bind(d);
      d.dispose = () => { disposed.add(d); own(); };
    }
    room.dispose();
    spines.dispose();
    expect([...made].filter((d) => !disposed.has(d)).map((d) => (d as { name?: string }).name ?? d.constructor.name)).toEqual([]);
  });
});
