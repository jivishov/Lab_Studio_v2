import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BENCH_MM } from "../../adapters/benchCoordinates";
import { SIDE_STATION } from "../../adapters/shelfSpots";
import { BLOCKS, COLUMN, END_WALL, FAR_ISLAND, HALL, ISLAND, STOOL, WINDOWS, type CutName } from "./hall";
import { packedBevelBox, toBufferGeometry } from "./microarrayGeometry";
import { roomOccludedMaterial, type RoomBox } from "./roomOcclusion";
import type { BenchTextures } from "./textures";
import { windowViewMaterial } from "./windowView";

/**
 * The teaching-lab room and its lights. Its worktop and lights began as the DNA microarray 3D lab's
 * (`virtual_lab/experiments/dnamicroarray_v2/3d-v3/scene.js:57-84`, lights from `renderer.js:126, 163-170`), decided
 * 2026-10-03 and 2026-10-04 (`proposals/MICROARRAY_ADOPTION.md` §3, choices 1–3). The natural lab (you, 2026-10-12;
 * Lab Studio 3D only) made the room real-sized, with a black-charcoal epoxy worktop, the key light from overhead and
 * daylight from windows. The lab room (decided 2026-10-16, `proposals/LAB_ROOM_LAYOUT.md` revision 2, phase 1) opens
 * it into a teaching hall about 12 × 10 m with a 3.0 m ceiling: our bench is one station of a long double-sided island
 * (hall.ts has every place in it), with a second island behind, windows along the back wall, the end wall's fittings,
 * large pale floor tiles and a ceiling grid of light panels and vents.
 *
 * The worktops are built in the source's arbitrary units inside a group scaled by `ROOM_SCALE`, which fits the
 * source's 15-unit worktop to Lab Studio's 1.4 m bench (`BENCH_MM`, the runtime mapping, is unchanged); the room
 * around them is built in metres. The worktop's top is at y = 0. Scenery only: nothing here is a runtime object or
 * pickable (G-8).
 *
 * The walls, ceiling and floor are single-sided, facing in, so a camera orbited outside the hall sees in through them;
 * the scenery that may stand in the camera's way is built in groups the cutaway fades (cutaway.ts). Each group's
 * static meshes are merged by material, so the hall costs one draw call per material per group; the far scenery
 * casts no shadows.
 */
export const ROOM_SCALE = 1.4 / 15; // metres per microarray unit (about 0.093)

/**
 * Our island's worktop, in room units: the source's 15 × 10 top was Lab Studio's 1400 × 700 mm working area with its
 * margins; it ran on past the working area for the shelf (decided 2026-10-11) and for the side station at the right.
 * In the hall (2026-10-16) it runs back past the shelf to a far working side and on to the left as a neighbouring
 * station. Its front edge and its right end, the island's free end, are where they were.
 */
export const WORKTOP = Object.freeze({ left: ISLAND.left / ROOM_SCALE, right: 14.25, front: 5, back: ISLAND.back / ROOM_SCALE });

/** The hall, metres, worktop top at y = 0 (hall.ts). */
export const ROOM = Object.freeze({
  ...HALL,
  windows: WINDOWS,
  /** The cabinets: their doors' faces, behind the worktop's 25 mm overhang, and the toe kick. */
  cabinetFace: ISLAND.front - 0.025,
  toeKick: { height: 0.1, depth: 0.07 },
  worktopThickness: 0.028,
});

/** Source hex colours are linearised with a plain 2.2 gamma (`renderer.js` `rgb`). */
export const linearHex = (hex: string): THREE.Color => {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
  return new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);
};

/**
 * Light colours and directions. The colours are the source's (`renderer.js:163-166`); the key comes from overhead
 * and a little in front (2026-10-12; the source's came from the upper left at about 40° off vertical), so shadows
 * fall short and back; the fill comes from the room in front; daylight comes in at the windows.
 */
export const ROOM_LIGHTS = {
  keyDirection: new THREE.Vector3(-0.15, 1, 0.45),
  keyColour: [3.0, 2.82, 2.55] as const,
  fillDirection: new THREE.Vector3(0.45, 0.5, 1),
  fillColour: [0.55, 0.68, 0.84] as const,
  sky: [0.26, 0.27, 0.29] as const,
  ground: [0.11, 0.1, 0.09] as const,
  /** The source keeps 22% of the key light in shadow (`renderer.js:39`). */
  shadowLeft: 0.22,
  /** The key's shadow edge, in shadow-map texels: soft, as under a ceiling panel. */
  shadowRadius: 4,
  /**
   * Daylight from the window run, one area light across it, no shadows. From about 6 m it reaches a face turned to the
   * windows about as the one window behind the shelf did (2026-10-16: 1.07 to 1.47 times less, so raised by 1.3), and
   * the worktop's top much less, as daylight from a far wall does.
   */
  window: { colour: [0.9, 0.96, 1.06] as const, intensity: 2.9 },
  /** The canvas clear colour behind the room (`renderer.js:177`), seen only from outside it. */
  clear: [0.55, 0.56, 0.55] as const,
};

/**
 * The key light's shadow box: our station and the side station, with a margin (2026-10-16, re-fitted for the hall; at
 * 1400 mm it is about the size it was). Scenery past it is lit and casts no shadows.
 */
export const SHADOW_BOX = Object.freeze({
  minX: BENCH_MM.left / 1000 - 0.15,
  maxX: SIDE_STATION.xMaxMm / 1000 + 0.15,
  /** Half its height in the light's view, which looks down and a little back across the bench. */
  halfDepth: 0.93,
  centreZ: -0.05,
});

/** The hall's box and its free-standing blocks, for its occlusion (roomOcclusion.ts). */
export const ROOM_BOX: RoomBox = {
  min: new THREE.Vector3(ROOM.left, ROOM.floor, ROOM.back),
  max: new THREE.Vector3(ROOM.right, ROOM.ceiling, ROOM.front),
  blocks: BLOCKS.map((b) => ({ min: new THREE.Vector3(...b.min), max: new THREE.Vector3(...b.max) })),
};

const WALL_TEXT = "CHEMISTRY · TEACHING LAB";
const BENCH_NUMBER = "3";
const PLEX = '600 {px}px "IBM Plex Sans", Arial, sans-serif';

interface RoomOptions {
  textures: BenchTextures;
  /** Shadow map size of the key light (the source's quality tiers: 2048, or 1024 on Low). */
  shadowMapSize: number;
  /** Called when a texture changes after the room is built (the wall text, once its font loads). */
  onTextureChange?: () => void;
}

export interface Room {
  group: THREE.Group;
  lights: THREE.Group;
  key: THREE.DirectionalLight;
  /** The scenery the cutaway may fade, each its own group under `group`. */
  cut: Partial<Record<CutName, THREE.Group>>;
  dispose: () => void;
}

type V3 = [number, number, number];
type MaterialKey =
  | "wall" | "floor" | "ceiling" | "trim" | "cove" | "laminate" | "carcass" | "kick" | "steel" | "panelFrame" | "bench"
  | "enamel" | "fireRed" | "bellRed" | "doorLeaf" | "hoodWhite" | "sash" | "lining" | "seat" | "chrome" | "sign" | "vent";

/** Geometry gathered per material, merged into one mesh each (`flush`). */
class Batch {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(material: THREE.Material, geometry: THREE.BufferGeometry): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    const list = this.parts.get(material) ?? [];
    list.push(g);
    this.parts.set(material, list);
  }
  /** One mesh per material under `parent`; the parts are disposed, the merged geometry handed to `keep`. */
  flush(parent: THREE.Object3D, keep: (g: THREE.BufferGeometry) => void, cast = false): void {
    this.parts.forEach((list, material) => {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) return;
      keep(merged);
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${parent.name}: ${material.name || "material"}`;
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.raycast = () => undefined; // scenery is never picked (G-8)
      parent.add(mesh);
    });
    this.parts.clear();
  }
}

export const buildRoom = ({ textures: T, shadowMapSize, onTextureChange }: RoomOptions): Room => {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  group.name = "room (scenery)";
  const disposables: Array<{ dispose: () => void }> = [];
  const keep = <D extends { dispose: () => void }>(d: D): D => { disposables.push(d); return d; };

  const mat = (hex: string, options: THREE.MeshStandardMaterialParameters = {}, occlusion: "room" | "bench" | "none" = "room") => {
    const m = keep(new THREE.MeshStandardMaterial({ color: linearHex(hex), roughness: 0.9, metalness: 0, side: THREE.FrontSide, ...options }));
    if (occlusion !== "none") roomOccludedMaterial(m, ROOM_BOX, occlusion === "bench");
    return m;
  };
  const canvasTexture = (canvas: HTMLCanvasElement) => {
    const t = keep(new THREE.CanvasTexture(canvas));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const ventMap = canvasTexture(drawVent());
  const signCanvas = document.createElement("canvas");
  signCanvas.width = signCanvas.height = 256;
  const signMap = canvasTexture(signCanvas);
  /** Each group's own materials, made on first use: a group the cutaway fades owns what it fades. */
  const kit = (): ((key: MaterialKey) => THREE.MeshStandardMaterial) => {
    const made = new Map<MaterialKey, THREE.MeshStandardMaterial>();
    const make = (key: MaterialKey): THREE.MeshStandardMaterial => {
      switch (key) {
        case "wall": return mat("#dcd3c2", { name: "Wall", map: T.wallC, normalMap: T.wallN, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.92 });
        case "floor": return mat("#ffffff", { name: "Floor tiles", map: T.floorC, roughnessMap: T.floorR, roughness: 1, normalMap: T.floorN, normalScale: new THREE.Vector2(0.5, 0.5) });
        case "ceiling": return mat("#f1efe9", { name: "Ceiling", map: T.ceilingC, roughness: 0.95 });
        case "trim": return mat("#e7e4dd", { name: "Trim", roughness: 0.5 }, "none");
        case "cove": return mat("#5d5850", { name: "Cove", roughness: 0.7 });
        // Black-charcoal epoxy (you, 2026-10-12): its colour, faint speckle and worn satin sheen are its textures.
        case "bench": {
          const m = keep(new THREE.MeshStandardMaterial({ name: "Bench worktop", map: T.benchC, roughnessMap: T.benchR, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
          roomOccludedMaterial(m, ROOM_BOX, true);
          return m;
        }
        case "laminate": return mat("#c9c3b6", { name: "Laminate", map: T.laminateC, roughness: 0.55 }, "bench");
        case "carcass": return mat("#3a3732", { name: "Carcass", roughness: 0.8 }, "bench");
        case "kick": return mat("#3b3833", { name: "Toe kick", roughness: 0.75 }, "bench");
        case "steel": return mat("#c3c8ca", { name: "Steel", roughness: 0.3, metalness: 0.85 }, "none");
        case "chrome": return mat("#d6d9db", { name: "Chrome", roughness: 0.18, metalness: 1 }, "none");
        case "panelFrame": return mat("#dedfdd", { name: "Panel frame", roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, "none");
        case "vent": return mat("#ffffff", { name: "Vent", map: ventMap, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, "none");
        case "enamel": return mat("#d9dad6", { name: "Steel enamel", roughness: 0.42 });
        case "fireRed": return mat("#b3241f", { name: "Fire red", roughness: 0.4 });
        case "bellRed": return mat("#c22a22", { name: "Bell red", roughness: 0.25, metalness: 0.2 }, "none");
        case "doorLeaf": return mat("#a9b4b8", { name: "Door leaf", map: T.laminateC, roughness: 0.5 });
        case "hoodWhite": return mat("#e4e3de", { name: "Fume cupboard", roughness: 0.45 });
        case "lining": return mat("#cfcfc9", { name: "Fume cupboard lining", roughness: 0.6 });
        case "sash": return keep(new THREE.MeshStandardMaterial({ name: "Sash glass", color: linearHex("#dfe8e8"), roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false }));
        case "seat": return mat("#1d1e20", { name: "Stool seat", roughness: 0.6 }, "none");
        case "sign": return mat("#ffffff", { name: "Bench sign", map: signMap, roughness: 0.5 }, "none");
      }
    };
    return (key) => {
      let m = made.get(key);
      if (!m) { m = make(key); made.set(key, m); }
      return m;
    };
  };

  /** A quad from `o` along `u` then `v`, facing u × v; its UVs are in metres from `uv0`, so textures keep their size. */
  const quadGeometry = (o: V3, u: V3, v: V3, uv0: [number, number] = [0, 0]) => {
    const O = new THREE.Vector3(...o), U = new THREE.Vector3(...u), V = new THREE.Vector3(...v);
    const n = U.clone().cross(V).normalize();
    const g = new THREE.BufferGeometry();
    const corners = [O, O.clone().add(U), O.clone().add(U).add(V), O.clone().add(V)];
    g.setAttribute("position", new THREE.Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(corners.flatMap(() => [n.x, n.y, n.z]), 3));
    const ul = U.length(), vl = V.length();
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1].map((t, i) => (i % 2 ? uv0[1] + t * vl : uv0[0] + t * ul)), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  };
  const boxGeometry = (min: V3, max: V3) =>
    new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]).translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  /** A cylinder along y (or turned to face ±x / ±z), metres. */
  const cylinder = (r: number, h: number, at: V3, axis: "y" | "x" | "z" = "y", segments = 16) => {
    const g = new THREE.CylinderGeometry(r, r, h, segments);
    if (axis === "x") g.rotateZ(Math.PI / 2);
    if (axis === "z") g.rotateX(Math.PI / 2);
    return g.translate(...at);
  };

  /** A worktop slab in the source's units, as built since 2026-10-03 (an epoxy slab 28 mm thick with eased edges). */
  const worktop = (material: THREE.Material, parent: THREE.Object3D, frontZ: number) => {
    const units = new THREE.Group();
    units.name = "worktop (room units)";
    units.scale.setScalar(ROOM_SCALE);
    units.position.y = 0.02 * ROOM_SCALE; // the source's worktop top sits at y = -0.02 units
    parent.add(units);
    // On the bevelled box's top face u runs along z (its depth) and v along x (its width); the texture's repeat is set
    // for that (textures.ts).
    const width = WORKTOP.right - WORKTOP.left, depth = WORKTOP.front - WORKTOP.back;
    const slab = ROOM.worktopThickness / ROOM_SCALE;
    const top = new THREE.Mesh(keep(toBufferGeometry(packedBevelBox(width, slab, depth, 0.035))), material);
    top.position.set((WORKTOP.left + WORKTOP.right) / 2, -0.02 - slab / 2, frontZ / ROOM_SCALE - depth / 2);
    top.receiveShadow = true;
    top.raycast = () => undefined;
    units.add(top);
    return top;
  };

  /**
   * An island's base: a dark carcass on a recessed toe kick, laminate end panels, and on both sides lockable
   * cabinets, a drawer over a door in each module, with C handles and key cylinders (the photos).
   */
  const islandBase = (batch: Batch, handles: Batch, k: ReturnType<typeof kit>, island: { left: number; right: number; front: number; back: number }) => {
    const under = -ROOM.worktopThickness, floor = ROOM.floor, kickTop = floor + ROOM.toeKick.height;
    const x0 = island.left + 0.025, x1 = island.right - 0.025, zf = island.front - 0.025, zb = island.back + 0.025;
    const kd = ROOM.toeKick.depth;
    batch.add(k("kick"), boxGeometry([x0 + kd, floor, zb + kd], [x1 - kd, kickTop, zf - kd]));
    batch.add(k("carcass"), boxGeometry([x0 + 0.018, kickTop, zb + 0.018], [x1 - 0.018, under, zf - 0.018]));
    for (const x of [x0, x1 - 0.018]) batch.add(k("laminate"), boxGeometry([x, floor + 0.005, zb], [x + 0.018, under, zf]));
    const span = x1 - x0 - 0.036, modules = Math.max(1, Math.round(span / 0.6)), mw = span / modules, gap = 0.0015, drawer = 0.15;
    for (const side of [1, -1]) {
      const face = side > 0 ? zf : zb, back = face - side * 0.018;
      const zMin = Math.min(face, back), zMax = Math.max(face, back);
      for (let i = 0; i < modules; i += 1) {
        const a = x0 + 0.018 + i * mw + gap, b = x0 + 0.018 + (i + 1) * mw - gap, cx = (a + b) / 2;
        batch.add(k("laminate"), boxGeometry([a, under - drawer + gap, zMin], [b, under - gap, zMax]));
        batch.add(k("laminate"), boxGeometry([a, kickTop + gap, zMin], [b, under - drawer - gap, zMax]));
        // C handles: a bar on two legs, standing 28 mm proud; a key cylinder beside each.
        for (const [y, length] of [[under - drawer / 2, 0.128], [under - drawer - 0.06, 0.096]] as const) {
          const out = face + side * 0.028, mid = face + side * 0.014;
          handles.add(k("steel"), boxGeometry([cx - length / 2, y - 0.005, Math.min(out, out - side * 0.009)], [cx + length / 2, y + 0.005, Math.max(out, out - side * 0.009)]));
          for (const lx of [cx - length / 2 + 0.005, cx + length / 2 - 0.005]) {
            handles.add(k("steel"), boxGeometry([lx - 0.005, y - 0.005, Math.min(face, out)], [lx + 0.005, y + 0.005, Math.max(face, out)]));
          }
          handles.add(k("chrome"), cylinder(0.0085, 0.008, [cx + length / 2 + 0.035, y, mid - side * 0.01], "z", 12));
        }
      }
    }
  };

  const { floor, ceiling, left, right, back, front } = ROOM;
  const shell = kit();
  const shellBatch = new Batch();
  const handleBatch = new Batch();

  // Our island: its worktop (named "bench"), under it the cabinets on both sides.
  const top = worktop(shell("bench"), group, ISLAND.front);
  top.name = "bench";
  islandBase(shellBatch, handleBatch, shell, ISLAND);

  // Floor, ceiling and walls, facing in. Their UVs run from the hall's corner, so the tiles meet across pieces.
  const D = front - back, H = ceiling - floor, Wd = right - left;
  shellBatch.add(shell("floor"), quadGeometry([left, floor, front], [Wd, 0, 0], [0, 0, -D], [0, 0]));
  // The ceiling's 600 mm grid is laid out from the working area's middle, so its panels sit between the grid's lines.
  const gridX = -0.3, gridZ = -0.25;
  shellBatch.add(shell("ceiling"), quadGeometry([left, ceiling, back], [Wd, 0, 0], [0, 0, D], [left - gridX, back - gridZ]));
  shellBatch.add(shell("wall"), quadGeometry([left, floor, front], [0, 0, -D], [0, H, 0], [0, 0])); // left wall, facing +x
  shellBatch.add(shell("wall"), quadGeometry([right, floor, back], [0, 0, D], [0, H, 0], [0, 0])); // right wall, facing -x
  shellBatch.add(shell("wall"), quadGeometry([right, floor, front], [-Wd, 0, 0], [0, H, 0], [0, 0])); // front wall, facing -z
  // The back wall around the windows' openings, and each opening's reveals; the window view past each frame.
  const W = WINDOWS, t = ROOM.wallThickness, outer = back - t;
  const backWall = (x0: number, x1: number, y0: number, y1: number) =>
    shellBatch.add(shell("wall"), quadGeometry([x0, y0, back], [x1 - x0, 0, 0], [0, y1 - y0, 0], [x0 - left, y0 - floor]));
  backWall(left, right, floor, W.sill);
  backWall(left, right, W.head, ceiling);
  const spans = W.centres.map((c) => [c - W.width / 2, c + W.width / 2] as const);
  spans.forEach(([wl], i) => backWall(i === 0 ? left : spans[i - 1][1], wl, W.sill, W.head));
  backWall(spans[spans.length - 1][1], right, W.sill, W.head);
  const viewMaterial = keep(windowViewMaterial({ wall: outer, floor: ROOM.floor }));
  const viewBatch = new Batch();
  const fz0 = outer + 0.03, fz1 = outer + 0.075, bar = 0.05, mullion = 0.045;
  for (const [wl, wr] of spans) {
    shellBatch.add(shell("wall"), quadGeometry([wl, W.sill, back], [0, 0, -t], [0, W.head - W.sill, 0])); // left jamb, facing +x
    shellBatch.add(shell("wall"), quadGeometry([wr, W.sill, outer], [0, 0, t], [0, W.head - W.sill, 0])); // right jamb, facing -x
    shellBatch.add(shell("wall"), quadGeometry([wl, W.head, outer], [wr - wl, 0, 0], [0, 0, t])); // head, facing down
    shellBatch.add(shell("trim"), quadGeometry([wl, W.sill, back], [wr - wl, 0, 0], [0, 0, -t])); // sill, facing up
    viewBatch.add(viewMaterial, quadGeometry([wl, W.sill, outer + 0.02], [wr - wl, 0, 0], [0, W.head - W.sill, 0]));
    // The frame, white powder-coated, in three lights with a transom.
    const frame = (min: V3, max: V3) => shellBatch.add(shell("trim"), boxGeometry(min, max));
    frame([wl, W.sill, fz0], [wr, W.sill + bar, fz1]);
    frame([wl, W.head - bar, fz0], [wr, W.head, fz1]);
    frame([wl, W.sill, fz0], [wl + bar, W.head, fz1]);
    frame([wr - bar, W.sill, fz0], [wr, W.head, fz1]);
    const third = (wr - wl) / 3;
    for (const x of [wl + third, wl + 2 * third]) frame([x - mullion / 2, W.sill, fz0], [x + mullion / 2, W.head, fz1]);
    frame([wl, W.head - 0.42, fz0], [wr, W.head - 0.42 + mullion, fz1]);
  }
  // Coved vinyl skirting along the walls, 6 mm off them (far across the hall, a millimetre or two would flicker).
  const cove = 0.1, off = 0.006;
  shellBatch.add(shell("cove"), quadGeometry([left + off, floor, front - off], [0, 0, -(D - 2 * off)], [0, cove, 0]));
  shellBatch.add(shell("cove"), quadGeometry([right - off, floor, back + off], [0, 0, D - 2 * off], [0, cove, 0]));
  shellBatch.add(shell("cove"), quadGeometry([right - off, floor, front - off], [-(Wd - 2 * off), 0, 0], [0, cove, 0]));
  shellBatch.add(shell("cove"), quadGeometry([left + off, floor, back + off], [Wd - 2 * off, 0, 0], [0, cove, 0]));

  // The ceiling grid's fittings: 600 × 1200 mm LED troffers and 600 mm square swirl vents, single-sided, facing down,
  // 6 and 9 mm under the ceiling with a polygon offset (seen 10 m off across the hall, 1 or 2 mm would flicker).
  const panelGlow = keep(new THREE.MeshBasicMaterial({ name: "Panel glow", color: new THREE.Color().setRGB(1.85, 1.86, 1.9, THREE.LinearSRGBColorSpace),
    side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  const down = (x0: number, z0: number, w: number, d: number, y: number): THREE.BufferGeometry => quadGeometry([x0, y, z0], [w, 0, 0], [0, 0, d]);
  const fixtures = new Batch();
  for (let x0 = gridX - 0.6 - 2.4 * 4; x0 + 0.6 < right; x0 += 2.4) for (let z0 = gridZ - 2.4 * 3; z0 + 1.2 < front; z0 += 2.4) {
    if (x0 < left + 0.3 || z0 < back + 0.3) continue;
    fixtures.add(shell("panelFrame"), down(x0, z0, 0.6, 1.2, ceiling - 0.006));
    fixtures.add(panelGlow, down(x0 + 0.025, z0 + 0.025, 0.55, 1.15, ceiling - 0.009));
    const vx = x0 + 1.2, vz = z0 + 0.6;
    if (vx + 0.6 < right - 0.3 && vz + 0.6 < front - 0.3) fixtures.add(shell("vent"), ventQuad(vx, vz, ceiling - 0.006));
  }
  function ventQuad(x0: number, z0: number, y: number) {
    const g = down(x0, z0, 0.6, 0.6, y);
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    return g;
  }

  // The wall text on the back wall, over the windows, behind our station; drawn on a canvas as the source draws its decals.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 80;
  const drawText = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#5a6661";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.min(canvas.height / 1.3, canvas.width / (WALL_TEXT.length * 0.62));
    ctx.font = PLEX.replace("{px}", String(size));
    ctx.fillText(WALL_TEXT, canvas.width / 2, canvas.height / 2);
  };
  drawText();
  const textMap = canvasTexture(canvas);
  const textMaterial = keep(new THREE.MeshStandardMaterial({ map: textMap, transparent: true, roughness: 0.75, depthWrite: false, side: THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  const textWidth = 2.6;
  const text = new THREE.Mesh(keep(new THREE.PlaneGeometry(textWidth, (textWidth * canvas.height) / canvas.width)), textMaterial);
  text.position.set(W.centres[3], (W.head + ceiling) / 2 + 0.02, back + 0.006);
  text.renderOrder = 1;
  text.raycast = () => undefined;
  group.add(text);

  const drawSign = () => {
    const ctx = signCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f4f3ef";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#2f5d8a";
    ctx.lineWidth = 10;
    ctx.strokeRect(9, 9, 238, 238);
    ctx.fillStyle = "#2f5d8a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = PLEX.replace("{px}", "40");
    ctx.fillText("BENCH", 128, 62);
    ctx.font = PLEX.replace("{px}", "150");
    ctx.fillText(BENCH_NUMBER, 128, 160);
  };
  drawSign();
  if (typeof document !== "undefined" && document.fonts?.load) {
    void document.fonts.load(PLEX.replace("{px}", "32")).then(() => {
      drawText();
      drawSign();
      textMap.needsUpdate = signMap.needsUpdate = true;
      onTextureChange?.();
    }).catch(() => undefined);
  }

  shellBatch.flush(group, keep);
  handleBatch.flush(group, keep, true);
  viewBatch.flush(group, keep);
  fixtures.flush(group, keep);

  // ---------------------------------------------------------------- scenery the cutaway may fade (hall.ts, CUT_BOXES)
  const cut: Partial<Record<CutName, THREE.Group>> = {};
  const part = (name: CutName, build: (batch: Batch, k: ReturnType<typeof kit>, g: THREE.Group) => void) => {
    const g = new THREE.Group();
    g.name = `scenery: ${name}`;
    const batch = new Batch();
    build(batch, kit(), g);
    batch.flush(g, keep);
    group.add(g);
    cut[name] = g;
  };

  // The far island: the same worktop and base, empty (its spine is placed with the shelf's model, BenchEngine).
  part("farIsland", (batch, k, g) => {
    worktop(k("bench"), g, FAR_ISLAND.front);
    islandBase(batch, batch, k, FAR_ISLAND);
  });

  // The column at our island's free end, with the bench-number sign on its face.
  part("column", (batch, k) => {
    batch.add(k("wall"), boxGeometry([...COLUMN.min] as V3, [...COLUMN.max] as V3));
    batch.add(k("cove"), boxGeometry([COLUMN.min[0] - 0.006, floor, COLUMN.min[2] - 0.006], [COLUMN.max[0] + 0.006, floor + cove, COLUMN.max[2] + 0.006]));
    const cx = (COLUMN.min[0] + COLUMN.max[0]) / 2;
    const sign = quadGeometry([cx - 0.13, 1.18, COLUMN.max[2] + 0.006], [0.26, 0, 0], [0, 0.26, 0]);
    sign.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    batch.add(k("sign"), sign);
  });

  // The right end wall: tall storage cabinets, a benchtop fume cupboard, and the fittings in the photos.
  const wallX = right;
  part("tallCabinets", (batch, k) => {
    const c = END_WALL.tallCabinets, x0 = c.min[0], top = c.max[1];
    batch.add(k("kick"), boxGeometry([x0 + 0.05, floor, c.min[2] + 0.02], [wallX, floor + 0.08, c.max[2] - 0.02]));
    batch.add(k("enamel"), boxGeometry([x0 + 0.02, floor + 0.08, c.min[2]], [wallX, top, c.max[2]]));
    const units = 2, w = (c.max[2] - c.min[2]) / units;
    for (let u = 0; u < units; u += 1) for (const half of [0, 1]) {
      const z0 = c.min[2] + u * w + (half * w) / 2 + 0.002, z1 = c.min[2] + u * w + ((half + 1) * w) / 2 - 0.002;
      batch.add(k("enamel"), boxGeometry([x0, floor + 0.085, z0], [x0 + 0.02, top - 0.005, z1]));
      const hz = half ? z0 + 0.04 : z1 - 0.04;
      batch.add(k("steel"), boxGeometry([x0 - 0.028, 0.15, hz - 0.005], [x0 - 0.019, 0.33, hz + 0.005]));
      for (const y of [0.155, 0.325]) batch.add(k("steel"), boxGeometry([x0 - 0.028, y - 0.005, hz - 0.005], [x0, y + 0.005, hz + 0.005]));
      if (!half) batch.add(k("chrome"), cylinder(0.0085, 0.008, [x0 - 0.004, 0.4, hz], "x", 12));
    }
  });
  part("fumeCupboard", (batch, k) => {
    const c = END_WALL.fumeCupboard, x0 = c.min[0], z0 = c.min[2], z1 = c.max[2], top = c.max[1], side = 0.07;
    // The base cabinet, its worktop, then the hood: sides, back baffle, roof, a fascia over the half-open sash, and an
    // airfoil sill. Its light (in the roof) is off.
    batch.add(k("kick"), boxGeometry([x0 + 0.07, floor, z0 + 0.03], [wallX, floor + 0.1, z1 - 0.03]));
    batch.add(k("hoodWhite"), boxGeometry([x0 + 0.02, floor + 0.1, z0], [wallX, -0.03, z1]));
    for (const [a, b] of [[z0 + 0.002, (z0 + z1) / 2 - 0.002], [(z0 + z1) / 2 + 0.002, z1 - 0.002]]) {
      batch.add(k("hoodWhite"), boxGeometry([x0, floor + 0.105, a], [x0 + 0.02, -0.035, b]));
      batch.add(k("steel"), boxGeometry([x0 - 0.028, -0.2, (a + b) / 2 - 0.005], [x0 - 0.019, -0.08, (a + b) / 2 + 0.005]));
    }
    batch.add(k("carcass"), boxGeometry([x0, -0.03, z0], [wallX, 0, z1]));
    batch.add(k("hoodWhite"), boxGeometry([x0, 0, z0], [wallX, top, z0 + side]));
    batch.add(k("hoodWhite"), boxGeometry([x0, 0, z1 - side], [wallX, top, z1]));
    batch.add(k("lining"), boxGeometry([wallX - 0.06, 0, z0 + side], [wallX, top - 0.3, z1 - side]));
    batch.add(k("hoodWhite"), boxGeometry([x0, top - 0.3, z0 + side], [wallX, top, z1 - side]));
    batch.add(k("lining"), boxGeometry([x0 + 0.06, top - 0.32, z0 + side], [wallX - 0.06, top - 0.3, z1 - side]));
    batch.add(k("steel"), boxGeometry([x0 - 0.02, 0, z0 + side], [x0 + 0.05, 0.03, z1 - side]));
    // The sash, half open: its frame and its glass.
    const sx = x0 + 0.02, s0 = 0.42, s1 = top - 0.25;
    batch.add(k("hoodWhite"), boxGeometry([sx - 0.012, s0, z0 + side], [sx + 0.012, s0 + 0.05, z1 - side]));
    batch.add(k("steel"), boxGeometry([sx - 0.03, s0 + 0.01, z0 + side + 0.2], [sx - 0.012, s0 + 0.025, z1 - side - 0.2]));
    batch.add(k("sash"), quadGeometry([sx, s0 + 0.05, z0 + side], [0, s1 - s0 - 0.05, 0], [0, 0, z1 - z0 - 2 * side]));
  });
  part("endWall", (batch, k) => {
    // The fire hose cabinet: red steel, a door with a narrow glazed strip and a latch.
    const f = END_WALL.fireHose;
    batch.add(k("fireRed"), boxGeometry([f.min[0], f.min[1], f.min[2]], [wallX, f.max[1], f.max[2]]));
    batch.add(k("trim"), boxGeometry([f.min[0] - 0.004, f.max[1] - 0.2, f.min[2] + 0.06], [f.min[0], f.max[1] - 0.06, f.max[2] - 0.06]));
    batch.add(k("steel"), boxGeometry([f.min[0] - 0.02, 0.3, f.max[2] - 0.05], [f.min[0], 0.42, f.max[2] - 0.035]));
    // The alarm bell over the door, on a small back plate.
    const b = END_WALL.bell;
    batch.add(k("bellRed"), new THREE.SphereGeometry(b.radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2).translate(wallX - 0.03, b.centre[1], b.centre[2]));
    batch.add(k("bellRed"), cylinder(0.03, 0.03, [wallX - 0.015, b.centre[1], b.centre[2]], "x", 16));
    // The door: a frame, a leaf, a lever handle and a kick plate.
    const d = END_WALL.door, dx = d.min[0];
    batch.add(k("trim"), boxGeometry([dx, floor, d.min[2] - 0.06], [wallX, d.max[1] + 0.06, d.min[2]]));
    batch.add(k("trim"), boxGeometry([dx, floor, d.max[2]], [wallX, d.max[1] + 0.06, d.max[2] + 0.06]));
    batch.add(k("trim"), boxGeometry([dx, d.max[1], d.min[2]], [wallX, d.max[1] + 0.06, d.max[2]]));
    batch.add(k("doorLeaf"), boxGeometry([dx + 0.015, floor + 0.01, d.min[2] + 0.004], [wallX, d.max[1] - 0.004, d.max[2] - 0.004]));
    batch.add(k("steel"), boxGeometry([dx + 0.008, floor + 0.01, d.min[2] + 0.02], [dx + 0.015, floor + 0.25, d.max[2] - 0.02]));
    batch.add(k("chrome"), cylinder(0.025, 0.012, [dx + 0.009, 0.1, d.max[2] - 0.09], "x", 16));
    batch.add(k("chrome"), boxGeometry([dx - 0.06, 0.092, d.max[2] - 0.22], [dx - 0.045, 0.108, d.max[2] - 0.09]));
    batch.add(k("chrome"), boxGeometry([dx - 0.06, 0.092, d.max[2] - 0.1], [dx, 0.108, d.max[2] - 0.08]));
  });
  part("stool", (batch, k) => {
    const [x, z] = STOOL.centre, seat = STOOL.seat;
    batch.add(k("seat"), cylinder(STOOL.radius, 0.05, [x, seat - 0.025, z], "y", 28));
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, r = STOOL.radius - 0.05;
      batch.add(k("chrome"), cylinder(0.012, seat - 0.05 - floor, [x + r * Math.cos(a), (seat - 0.05 + floor) / 2, z + r * Math.sin(a)], "y", 10));
    }
    batch.add(k("chrome"), new THREE.TorusGeometry(STOOL.radius - 0.05, 0.008, 8, 32).rotateX(Math.PI / 2).translate(x, floor + 0.3, z));
  });

  // Lights, in metres. The key casts over our station and the side station (`SHADOW_BOX`).
  const lights = new THREE.Group();
  lights.name = "room lights";
  const key = new THREE.DirectionalLight();
  key.color.setRGB(...ROOM_LIGHTS.keyColour, THREE.LinearSRGBColorSpace);
  key.intensity = 1;
  const s = ROOM_SCALE;
  const sb = SHADOW_BOX, half = (sb.maxX - sb.minX) / 2;
  key.target.position.set((sb.minX + sb.maxX) / 2, 0, sb.centreZ);
  key.castShadow = shadowMapSize > 0;
  key.shadow.mapSize.set(shadowMapSize || 1024, shadowMapSize || 1024);
  Object.assign(key.shadow.camera, { left: -half, right: half, top: sb.halfDepth, bottom: -sb.halfDepth, near: 0.1 * s, far: 45 * s });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.intensity = 1 - ROOM_LIGHTS.shadowLeft;
  key.shadow.radius = ROOM_LIGHTS.shadowRadius;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.0006;
  key.position.copy(ROOM_LIGHTS.keyDirection).normalize().multiplyScalar(Math.hypot(-12, 18, 7) * s).add(key.target.position);
  const fill = new THREE.DirectionalLight();
  fill.color.setRGB(...ROOM_LIGHTS.fillColour, THREE.LinearSRGBColorSpace);
  fill.position.copy(ROOM_LIGHTS.fillDirection).normalize();
  // The source's ambient term, base·mix(ground, sky) with no 1/π (`renderer.js:68`); three's hemisphere
  // light divides by π, so its colours are scaled by π. It is the only ambient: materials take only the
  // environment's reflections (roomLighting.ts).
  const hemi = new THREE.HemisphereLight();
  hemi.color.setRGB(...ROOM_LIGHTS.sky, THREE.LinearSRGBColorSpace).multiplyScalar(Math.PI);
  hemi.groundColor.setRGB(...ROOM_LIGHTS.ground, THREE.LinearSRGBColorSpace).multiplyScalar(Math.PI);
  // Daylight through the window run: one area light across it, tilted a little down, as the sky's light falls.
  const runLeft = spans[0][0], runRight = spans[spans.length - 1][1];
  const daylight = new THREE.RectAreaLight(undefined, ROOM_LIGHTS.window.intensity, runRight - runLeft, W.head - W.sill);
  daylight.color.setRGB(...ROOM_LIGHTS.window.colour, THREE.LinearSRGBColorSpace);
  daylight.position.set((runLeft + runRight) / 2, (W.sill + W.head) / 2, back - 0.001);
  daylight.lookAt((runLeft + runRight) / 2, (W.sill + W.head) / 2 - 0.35, back + 1);
  lights.add(key, key.target, fill, hemi, daylight);

  return {
    group,
    lights,
    key,
    cut,
    dispose: () => {
      key.shadow.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
};

/** A square swirl diffuser: a frame, a centre plate and curved slots turning about it (canvas, sRGB). */
const drawVent = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.fillStyle = "#e8e8e5";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#d6d6d2";
  g.fillRect(14, 14, 228, 228);
  g.strokeStyle = "#5f615f";
  g.lineCap = "round";
  g.lineWidth = 5;
  for (let ring = 0; ring < 4; ring += 1) {
    const r0 = 40 + ring * 22;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + ring * 0.3;
      g.beginPath();
      g.arc(128, 128, r0, a, a + 0.32);
      g.stroke();
    }
  }
  g.fillStyle = "#ececea";
  g.beginPath();
  g.arc(128, 128, 26, 0, Math.PI * 2);
  g.fill();
  return canvas;
};

/** The background behind the room: the source's clear colour, linear. */
export const roomBackground = (): THREE.Color =>
  new THREE.Color().setRGB(...ROOM_LIGHTS.clear, THREE.LinearSRGBColorSpace);
