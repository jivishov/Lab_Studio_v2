import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { packedBevelBox, packedPlane, toBufferGeometry } from "./microarrayGeometry";
import { roomOccludedMaterial, type RoomBox } from "./roomOcclusion";
import type { BenchTextures } from "./textures";
import { windowViewMaterial } from "./windowView";

/**
 * The teaching-lab room and its lights. Its worktop and lights began as the DNA microarray 3D lab's
 * (`virtual_lab/experiments/dnamicroarray_v2/3d-v3/scene.js:57-84`, lights from `renderer.js:126, 163-170`), decided
 * 2026-10-03 and 2026-10-04 (`proposals/MICROARRAY_ADOPTION.md` §3, choices 1–3). For a natural lab (you,
 * 2026-10-12; Lab Studio 3D only) the room around them is closed and real-sized: the bench stands 0.9 m high in a bay
 * 2.9 m to its ceiling, with recessed ceiling panels, a vinyl tile floor, cabinets of drawers and doors, and a window
 * over the reagent shelf onto trees; the worktop is black-charcoal epoxy; the key light comes from overhead and
 * daylight from the window.
 *
 * The worktop is built in the source's arbitrary units inside a group scaled by `ROOM_SCALE`, which fits the source's
 * 15-unit worktop to Lab Studio's 1.4 m bench (`BENCH_MM`, the runtime mapping, is unchanged); the room around it is
 * built in metres. The worktop's top is at y = 0. Scenery only: nothing here is a runtime object or pickable (G-8).
 *
 * The walls, ceiling and floor are single-sided, facing in, so a camera orbited outside the room sees in through them.
 */
export const ROOM_SCALE = 1.4 / 15; // metres per microarray unit (about 0.093)

/**
 * The worktop, in room units. The source's 15 × 10 top is Lab Studio's 1400 × 700 mm working area with its margins.
 * For the shelf in place of the tray (decided 2026-10-11) it runs on past the working area: about 130 mm further
 * back, where the reagent shelf stands against the wall (shelfSpots.ts, `SHELF`), and 620 mm past its right end,
 * the side station for the large items (`SIDE_STATION`). Its front edge and left end are the source's.
 */
export const WORKTOP = Object.freeze({ left: -10.5, right: 14.25, front: 5, back: -6.1 });
/** The back wall's front face (room units): just behind the shelf. */
const WALL_FACE = -6.0;

/**
 * The room, metres, worktop top at y = 0 (2026-10-12). The side walls stand at the bench run's ends; the front wall is
 * past the farthest the camera reaches (a portrait tablet at the manual limits), so the camera stays inside.
 */
export const ROOM = Object.freeze({
  floor: -0.9,
  ceiling: 2.0,
  left: WORKTOP.left * ROOM_SCALE,
  right: WORKTOP.right * ROOM_SCALE,
  back: WALL_FACE * ROOM_SCALE,
  front: 5.2,
  wallThickness: 0.12,
  /** The window over the shelf: its opening in the back wall. */
  window: { left: -0.8, right: 0.5, sill: 0.62, head: 1.62 },
  /** The cabinets: their doors' face, behind the worktop's 25 mm overhang, and the toe kick. */
  cabinetFace: WORKTOP.front * ROOM_SCALE - 0.025,
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
 * fall short and back; the fill comes from the room in front; daylight comes in at the window.
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
  /** Daylight from the window, an area light the size of its opening, no shadows. */
  window: { colour: [0.9, 0.96, 1.06] as const, intensity: 2.2 },
  /** The canvas clear colour behind the room (`renderer.js:177`), seen only from outside it. */
  clear: [0.55, 0.56, 0.55] as const,
};

/** The room's box and the bench run, for its occlusion (roomOcclusion.ts). */
export const ROOM_BOX: RoomBox = {
  min: new THREE.Vector3(ROOM.left, ROOM.floor, ROOM.back),
  max: new THREE.Vector3(ROOM.right, ROOM.ceiling, ROOM.front),
  benchMin: new THREE.Vector3(ROOM.left, ROOM.floor, ROOM.back),
  benchMax: new THREE.Vector3(ROOM.right, 0, WORKTOP.front * ROOM_SCALE),
};

const WALL_TEXT = "CHEMISTRY · TEACHING LAB";
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
  dispose: () => void;
}

type V3 = [number, number, number];

export const buildRoom = ({ textures: T, shadowMapSize, onTextureChange }: RoomOptions): Room => {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  group.name = "room (scenery)";
  const units = new THREE.Group();
  units.name = "worktop (room units)";
  units.scale.setScalar(ROOM_SCALE);
  units.position.y = 0.02 * ROOM_SCALE; // the source's worktop top sits at y = -0.02 units
  group.add(units);
  const disposables: Array<{ dispose: () => void }> = [];
  const keep = <D extends { dispose: () => void }>(d: D): D => { disposables.push(d); return d; };

  const mat = (hex: string, options: THREE.MeshStandardMaterialParameters = {}, occlusion: "room" | "bench" | "none" = "room") => {
    const m = keep(new THREE.MeshStandardMaterial({ color: linearHex(hex), roughness: 0.9, metalness: 0, side: THREE.FrontSide, ...options }));
    if (occlusion !== "none") roomOccludedMaterial(m, ROOM_BOX, occlusion === "bench");
    return m;
  };
  const place = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = group, cast = false) => {
    keep(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.raycast = () => undefined; // scenery is never picked (G-8)
    parent.add(m);
    return m;
  };
  /** A quad from `o` along `u` then `v`, facing u × v; its UVs are in metres from `uv0`, so textures keep their size. */
  const quad = (material: THREE.Material, o: V3, u: V3, v: V3, uv0: [number, number] = [0, 0]) => {
    const O = new THREE.Vector3(...o), U = new THREE.Vector3(...u), V = new THREE.Vector3(...v);
    const n = U.clone().cross(V).normalize();
    const g = new THREE.BufferGeometry();
    const corners = [O, O.clone().add(U), O.clone().add(U).add(V), O.clone().add(V)];
    g.setAttribute("position", new THREE.Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(corners.flatMap(() => [n.x, n.y, n.z]), 3));
    const ul = U.length(), vl = V.length();
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1].map((t, i) => (i % 2 ? uv0[1] + t * vl : uv0[0] + t * ul)), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return place(g, material);
  };
  /** A box by its corners, metres. */
  const block = (material: THREE.Material, min: V3, max: V3, cast = false) => {
    const m = place(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), material, group, cast);
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    return m;
  };

  const { floor, ceiling, left, right, back, front } = ROOM;
  const W = ROOM.window;
  const m = {
    wall: mat("#dcd3c2", { map: T.wallC, normalMap: T.wallN, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.92 }),
    floor: mat("#ffffff", { map: T.floorC, roughnessMap: T.floorR, roughness: 1, normalMap: T.floorN, normalScale: new THREE.Vector2(0.6, 0.6) }),
    ceiling: mat("#f1efe9", { map: T.ceilingC, roughness: 0.95 }),
    trim: mat("#e7e4dd", { roughness: 0.5 }, "none"),
    cove: mat("#5d5850", { roughness: 0.7 }),
    // Black-charcoal epoxy (you, 2026-10-12): its colour, faint speckle and worn satin sheen are its textures.
    bench: new THREE.MeshStandardMaterial({ name: "Bench worktop", map: T.benchC, roughnessMap: T.benchR, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    laminate: mat("#c9c3b6", { map: T.laminateC, roughness: 0.55 }, "bench"),
    carcass: mat("#3a3732", { roughness: 0.8 }, "bench"),
    kick: mat("#3b3833", { roughness: 0.75 }, "bench"),
    steel: mat("#c3c8ca", { roughness: 0.3, metalness: 0.85 }, "none"),
    panelFrame: mat("#dedfdd", { roughness: 0.45 }, "none"),
  };
  keep(m.bench);
  roomOccludedMaterial(m.bench, ROOM_BOX, true);

  // The worktop: an epoxy slab 28 mm thick with eased edges. On the bevelled box's top face u runs along z (its
  // depth) and v along x (its width); the texture's repeat is set for that (textures.ts).
  const width = WORKTOP.right - WORKTOP.left, depth = WORKTOP.front - WORKTOP.back;
  const midX = (WORKTOP.left + WORKTOP.right) / 2, midZ = (WORKTOP.front + WORKTOP.back) / 2;
  const slab = ROOM.worktopThickness / ROOM_SCALE;
  const top = place(toBufferGeometry(packedBevelBox(width, slab, depth, 0.035)), m.bench, units);
  top.position.set(midX, -0.02 - slab / 2, midZ);
  top.name = "bench";

  // Floor, ceiling and walls, facing in. Their UVs run from the room's corner, so the tiles meet across pieces.
  const D = front - back, H = ceiling - floor, Wd = right - left;
  quad(m.floor, [left, floor, front], [Wd, 0, 0], [0, 0, -D], [0, 0]);
  // The ceiling's grid is laid out from the room's middle, so its panels sit between the grid's lines.
  const gridX = (left + right) / 2 - 0.3, gridZ = -0.25;
  quad(m.ceiling, [left, ceiling, back], [Wd, 0, 0], [0, 0, D], [left - gridX, back - gridZ]);
  quad(m.wall, [left, floor, front], [0, 0, -D], [0, H, 0], [0, 0]); // left wall, facing +x
  quad(m.wall, [right, floor, back], [0, 0, D], [0, H, 0], [0, 0]); // right wall, facing -x
  quad(m.wall, [right, floor, front], [-Wd, 0, 0], [0, H, 0], [0, 0]); // front wall, facing -z
  // The back wall around the window's opening, and the opening's reveals.
  const backWall = (x0: number, x1: number, y0: number, y1: number) =>
    quad(m.wall, [x0, y0, back], [x1 - x0, 0, 0], [0, y1 - y0, 0], [x0 - left, y0 - floor]);
  backWall(left, right, floor, W.sill);
  backWall(left, right, W.head, ceiling);
  backWall(left, W.left, W.sill, W.head);
  backWall(W.right, right, W.sill, W.head);
  const t = ROOM.wallThickness, outer = back - t;
  quad(m.wall, [W.left, W.sill, back], [0, 0, -t], [0, W.head - W.sill, 0]); // left jamb, facing +x
  quad(m.wall, [W.right, W.sill, outer], [0, 0, t], [0, W.head - W.sill, 0]); // right jamb, facing -x
  quad(m.wall, [W.left, W.head, outer], [W.right - W.left, 0, 0], [0, 0, t]); // head, facing down
  quad(m.trim, [W.left, W.sill, back], [W.right - W.left, 0, 0], [0, 0, -t]); // sill, facing up
  // Coved vinyl skirting where the walls meet the floor in front of the bench.
  const cove = 0.1, coveOff = 0.006, cabFront = ROOM.cabinetFace;
  quad(m.cove, [left + coveOff, floor, front - coveOff], [0, 0, -(front - coveOff - cabFront)], [0, cove, 0]);
  quad(m.cove, [right - coveOff, floor, cabFront], [0, 0, front - coveOff - cabFront], [0, cove, 0]);
  quad(m.cove, [right - coveOff, floor, front - coveOff], [-(Wd - 2 * coveOff), 0, 0], [0, cove, 0]);

  // The window: a view of a lawn and trees past its frame (windowView.ts), and the frame, white powder-coated, in three lights.
  const viewMaterial = keep(windowViewMaterial({ wall: outer, floor: ROOM.floor }));
  quad(viewMaterial, [W.left, W.sill, outer + 0.02], [W.right - W.left, 0, 0], [0, W.head - W.sill, 0]);
  const fz0 = outer + 0.03, fz1 = outer + 0.075, bar = 0.045, mullion = 0.04, third = (W.right - W.left) / 3;
  block(m.trim, [W.left, W.sill, fz0], [W.right, W.sill + bar, fz1]);
  block(m.trim, [W.left, W.head - bar, fz0], [W.right, W.head, fz1]);
  block(m.trim, [W.left, W.sill, fz0], [W.left + bar, W.head, fz1]);
  block(m.trim, [W.right - bar, W.sill, fz0], [W.right, W.head, fz1]);
  for (const x of [W.left + third, W.left + 2 * third]) block(m.trim, [x - mullion / 2, W.sill, fz0], [x + mullion / 2, W.head, fz1]);

  // Ceiling panels: 600 × 1200 mm LED troffers in the grid, in rows over the bench and over where the user stands.
  const panelGlow = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.85, 1.86, 1.9, THREE.LinearSRGBColorSpace), side: THREE.FrontSide }));
  for (const z0 of [gridZ, gridZ + 2.4, gridZ + 4.2]) for (const x0 of [gridX - 0.6, gridX + 0.6]) {
    if (z0 + 1.2 > front || x0 < left || x0 + 0.6 > right) continue;
    quad(m.panelFrame, [x0, ceiling - 0.001, z0], [0.6, 0, 0], [0, 0, 1.2]);
    quad(panelGlow, [x0 + 0.025, ceiling - 0.002, z0 + 0.025], [0.55, 0, 0], [0, 0, 1.15]);
  }

  // Cabinets under the worktop: a dark carcass on a recessed toe kick, faced with laminate drawers over doors, 3 mm
  // apart, with steel bar pulls; four modules along the run.
  const under = -ROOM.worktopThickness, kickTop = floor + ROOM.toeKick.height, face = ROOM.cabinetFace;
  block(m.kick, [left, floor, back + 0.05], [right, kickTop, face - ROOM.toeKick.depth]);
  block(m.carcass, [left, kickTop, back + 0.05], [right, under, face - 0.018]);
  const modules = 4, mw = Wd / modules, gap = 0.0015, drawer = 0.15;
  for (let i = 0; i < modules; i += 1) {
    const x0 = left + i * mw + gap, x1 = left + (i + 1) * mw - gap;
    block(m.laminate, [x0, under - drawer + gap, face - 0.018], [x1, under - gap, face]);
    block(m.laminate, [x0, kickTop + gap, face - 0.018], [x1, under - drawer - gap, face]);
    const cx = (x0 + x1) / 2;
    for (const y of [under - drawer / 2, under - drawer - 0.07]) block(m.steel, [cx - 0.064, y - 0.006, face], [cx + 0.064, y + 0.006, face + 0.028], true);
  }

  // The wall text, drawn on a canvas as the source draws its decals.
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.max(64, Math.round((512 * 0.22) / 3.4));
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
  const textMap = keep(new THREE.CanvasTexture(canvas));
  textMap.colorSpace = THREE.SRGBColorSpace;
  textMap.flipY = false; // the source's plane UVs put the canvas's first row at the top
  textMap.anisotropy = 8;
  const textMaterial = keep(new THREE.MeshStandardMaterial({ map: textMap, transparent: true, roughness: 0.75, depthWrite: false, side: THREE.FrontSide }));
  // Over the side station, above its tallest item (the ring stand, 512 mm).
  const text = place(toBufferGeometry(packedPlane(3.4, 0.22)), textMaterial, units);
  text.position.set(10.9, 6.6, WALL_FACE + 0.015);
  text.renderOrder = 1;
  if (typeof document !== "undefined" && document.fonts?.load) {
    void document.fonts.load(PLEX.replace("{px}", "32")).then(() => {
      drawText();
      textMap.needsUpdate = true;
      onTextureChange?.();
    }).catch(() => undefined);
  }

  // Lights, in metres. The key casts the source's shadow box, scaled (`renderer.js:126`).
  const lights = new THREE.Group();
  lights.name = "room lights";
  const key = new THREE.DirectionalLight();
  key.color.setRGB(...ROOM_LIGHTS.keyColour, THREE.LinearSRGBColorSpace);
  key.intensity = 1;
  const s = ROOM_SCALE;
  key.target.position.set(midX * s, 0, -0.5 * s);
  key.castShadow = shadowMapSize > 0;
  key.shadow.mapSize.set(shadowMapSize || 1024, shadowMapSize || 1024);
  // The source's box, widened for the side station and deepened for the shelf (2026-10-11).
  Object.assign(key.shadow.camera, { left: -14.5 * s, right: 14.5 * s, top: 10 * s, bottom: -10 * s, near: 0.1 * s, far: 45 * s });
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
  // Daylight through the window: an area light filling its opening, tilted a little down, as the sky's light falls.
  const daylight = new THREE.RectAreaLight(undefined, ROOM_LIGHTS.window.intensity, W.right - W.left, W.head - W.sill);
  daylight.color.setRGB(...ROOM_LIGHTS.window.colour, THREE.LinearSRGBColorSpace);
  daylight.position.set((W.left + W.right) / 2, (W.sill + W.head) / 2, back - 0.001);
  daylight.lookAt((W.left + W.right) / 2, (W.sill + W.head) / 2 - 0.35, back + 1);
  lights.add(key, key.target, fill, hemi, daylight);

  return {
    group,
    lights,
    key,
    dispose: () => {
      key.shadow.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
};

/** The background behind the room: the source's clear colour, linear. */
export const roomBackground = (): THREE.Color =>
  new THREE.Color().setRGB(...ROOM_LIGHTS.clear, THREE.LinearSRGBColorSpace);
