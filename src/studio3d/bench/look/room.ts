import * as THREE from "three";
import { REFLECTION } from "./roomLighting";
import { packedBevelBox, packedCylinder, packedLathe, packedPlane, toBufferGeometry } from "./microarrayGeometry";
import type { BenchTextures } from "./textures";

/**
 * The teaching-lab room and its lights, rebuilt in three.js from the DNA microarray 3D lab
 * (`virtual_lab/experiments/dnamicroarray_v2/3d-v3/scene.js:57-84`, lights from `renderer.js:126,
 * 163-170`), decided 2026-10-03 and 2026-10-04 (`proposals/MICROARRAY_ADOPTION.md` §3, choices 1–3).
 *
 * The room is built in the source's arbitrary units inside one group scaled by `ROOM_SCALE`, which
 * fits the source's 15-unit worktop to Lab Studio's 1.4 m bench (`BENCH_MM`, the runtime mapping,
 * is unchanged). The worktop's top is at y = 0. Scenery only: nothing here is a runtime object or
 * pickable (G-8); the microarray's apparatus and its UV sign are not taken, and the wall text names
 * this lab.
 */
export const ROOM_SCALE = 1.4 / 15; // metres per microarray unit (about 0.093)

/** Source hex colours are linearised with a plain 2.2 gamma (`renderer.js` `rgb`). */
export const linearHex = (hex: string): THREE.Color => {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
  return new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);
};

/** Light colours and directions, as the source's shader receives them (`renderer.js:163-166`). */
export const ROOM_LIGHTS = {
  keyDirection: new THREE.Vector3(-6, 9, 3.5),
  keyColour: [3.0, 2.82, 2.55] as const,
  fillDirection: new THREE.Vector3(6, 4, -2),
  fillColour: [0.55, 0.68, 0.84] as const,
  sky: [0.26, 0.27, 0.29] as const,
  ground: [0.11, 0.1, 0.09] as const,
  /** The source keeps 22% of the key light in shadow (`renderer.js:39`). */
  shadowLeft: 0.22,
  /** The canvas clear colour behind the room (`renderer.js:177`). */
  clear: [0.55, 0.56, 0.55] as const,
};

const WALL_TEXT = "CHEMISTRY · TEACHING LAB";
const PLEX = '600 {px}px "IBM Plex Sans", Arial, sans-serif';

interface RoomOptions {
  textures: BenchTextures;
  /** Shadow map size of the key light (the source's quality tiers: 2048, or 1024 on Low). */
  shadowMapSize: number;
  /** Called when a texture changes after the room is built (the wall text, once its font loads). */
  onTextureChange?: () => void;
  /** The room's reflection map, for the glass bottles at the source's glass reflection factor (roomLighting.ts). */
  environment?: THREE.Texture;
}

export interface Room {
  group: THREE.Group;
  lights: THREE.Group;
  key: THREE.DirectionalLight;
  dispose: () => void;
}

export const buildRoom = ({ textures, shadowMapSize, onTextureChange, environment }: RoomOptions): Room => {
  const group = new THREE.Group();
  group.name = "room (scenery)";
  group.scale.setScalar(ROOM_SCALE);
  group.position.y = 0.02 * ROOM_SCALE; // the source's worktop top sits at y = -0.02 units
  const disposables: Array<{ dispose: () => void }> = [];

  // The source shades both faces of every surface; its geometry is wound for front faces, as three's is.
  const mat = (hex: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: linearHex(hex), roughness: 0.38, metalness: 0, side: THREE.DoubleSide, ...options });
    disposables.push(m);
    return m;
  };
  const mesh = (packed: number[], material: THREE.Material, pos: [number, number, number], parent: THREE.Object3D = group, cast = true) => {
    const geometry = toBufferGeometry(packed);
    disposables.push(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...pos);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.raycast = () => undefined; // scenery is never picked (G-8)
    parent.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, pos: [number, number, number], parent?: THREE.Object3D, rad?: number) =>
    mesh(packedBevelBox(w, h, d, rad), material, pos, parent);

  const m = {
    wall: mat("#dcd3c2", { roughness: 0.92 }),
    trim: mat("#e7e4dd", { roughness: 0.5 }),
    // The worktop's resin colour, speckle and roughness come from its texture (`renderer.js:58`, pattern 1).
    bench: new THREE.MeshStandardMaterial({ name: "Bench worktop", map: textures.benchC, roughnessMap: textures.benchR, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    edge: mat("#a47a50", { roughness: 0.55 }),
    steel: mat("#c3c8ca", { roughness: 0.3, metalness: 0.85 }),
  };
  disposables.push(m.bench);

  // Worktop and its wooden front lip. On the bevelled box's top face u runs along z (10 units) and v
  // along x (15 units); the resin texture's repeat is set for that (textures.ts).
  const top = mesh(packedBevelBox(15, 0.22, 10), m.bench, [0, -0.13, 0]);
  top.castShadow = false;
  top.name = "bench";
  box(15, 0.08, 0.14, m.edge, [0, -0.06, 4.97]);
  // Cabinets below the worktop, so steep views never show empty space.
  const cabinet = mat("#c9c3b6", { roughness: 0.6 });
  box(15, 3.2, 0.1, cabinet, [0, -1.72, 4.9]);
  const gap = mat("#9f998d", { roughness: 0.6 });
  for (let x = -7.5 + 1.875; x < 7.5; x += 3.75) box(0.03, 3.0, 0.03, gap, [x, -1.72, 4.96]);
  for (let x = -7.5 + 0.94; x < 7.5; x += 1.875) box(0.36, 0.05, 0.06, m.steel, [x, -0.55, 4.99]);
  // Back wall, skirting rail, window and sill.
  box(15, 4.4, 0.13, m.wall, [0, 2.0, -4.6]);
  box(15, 0.14, 0.2, m.trim, [0, 0.05, -4.47]);
  const glow = new THREE.MeshBasicMaterial({ color: linearHex("#e3ecef").multiplyScalar(1.9), side: THREE.DoubleSide }); // emission 1.9
  disposables.push(glow);
  mesh(packedBevelBox(4.6, 2.1, 0.02), glow, [-4.1, 2.25, -4.52], group, false);
  for (const x of [-6.4, -4.1, -1.8]) box(0.07, 2.2, 0.05, m.trim, [x, 2.25, -4.48]);
  for (const y of [1.2, 2.25, 3.3]) box(4.7, 0.07, 0.05, m.trim, [-4.1, y, -4.48]);
  box(4.9, 0.06, 0.28, m.trim, [-4.1, 1.17, -4.4]);

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
  const textMap = new THREE.CanvasTexture(canvas);
  textMap.colorSpace = THREE.SRGBColorSpace;
  textMap.flipY = false; // the source's plane UVs put the canvas's first row at the top
  textMap.anisotropy = 8;
  disposables.push(textMap);
  const textMaterial = new THREE.MeshStandardMaterial({ map: textMap, transparent: true, roughness: 0.75, depthWrite: false, side: THREE.DoubleSide });
  disposables.push(textMaterial);
  const text = mesh(packedPlane(3.4, 0.22), textMaterial, [3.1, 3.45, -4.52], group, false);
  text.renderOrder = 1;
  if (typeof document !== "undefined" && document.fonts?.load) {
    void document.fonts.load(PLEX.replace("{px}", "32")).then(() => {
      drawText();
      textMap.needsUpdate = true;
      onTextureChange?.();
    }).catch(() => undefined);
  }

  // The shelf and its five bottles: amber and clear glass, and one white plastic bottle.
  const shelf = new THREE.Group();
  shelf.position.set(3.1, 2.45, -4.33);
  group.add(shelf);
  box(3.8, 0.07, 0.42, mat("#b08a60", { roughness: 0.6 }), [0, 0, 0], shelf);
  const bottles: Array<[number, string, string, number]> = [
    [-1.35, "#a8662c", "#2f3437", 0.62], [-0.75, "#f2f4f1", "#3f6fb3", 0.5], [-0.2, "#e9ebe4", "#e9ebe4", 0.7],
    [0.45, "#a8662c", "#2f3437", 0.48], [1.1, "#f2f4f1", "#7b5fae", 0.56],
  ];
  for (const [x, glass, cap, h] of bottles) {
    const g = new THREE.Group();
    g.position.set(x, 0.03, 0);
    shelf.add(g);
    const profile: Array<[number, number]> = [[0.001, 0], [0.14, 0], [0.15, 0.02], [0.15, h * 0.72], [0.07, h * 0.9], [0.06, h]];
    const plastic = glass === "#e9ebe4";
    // The source's thin-shell glass (glass 1, opacity .55, roughness .14) as three's transmissive glass.
    const material = plastic ? mat(glass, { roughness: 0.45 })
      : new THREE.MeshPhysicalMaterial({ color: linearHex(glass), roughness: 0.14, transmission: 0.45, thickness: 0.25, ior: 1.47, side: THREE.FrontSide, depthWrite: false,
        ...(environment ? { envMap: environment, envMapIntensity: REFLECTION.glass } : {}) });
    if (!plastic) disposables.push(material);
    const body = mesh(packedLathe(profile, 28), material, [0, 0, 0], g, plastic);
    if (!plastic) body.renderOrder = 2;
    mesh(packedCylinder(0.068, 0.08, 28), mat(cap, { roughness: 0.4 }), [0, h, 0], g);
  }

  // Lights, in metres. The key casts the source's shadow box, scaled (`renderer.js:126`).
  const lights = new THREE.Group();
  lights.name = "room lights";
  const key = new THREE.DirectionalLight();
  key.color.setRGB(...ROOM_LIGHTS.keyColour, THREE.LinearSRGBColorSpace);
  key.intensity = 1;
  const s = ROOM_SCALE;
  key.position.set(-12 * s, 18 * s, 7 * s);
  key.target.position.set(0, 0, -0.5 * s);
  key.castShadow = shadowMapSize > 0;
  key.shadow.mapSize.set(shadowMapSize || 1024, shadowMapSize || 1024);
  Object.assign(key.shadow.camera, { left: -10.5 * s, right: 10.5 * s, top: 8.5 * s, bottom: -8.5 * s, near: 0.1 * s, far: 45 * s });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.intensity = 1 - ROOM_LIGHTS.shadowLeft;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.0006;
  // The source's key comes from (-6, 9, 3.5); the shadow camera sits on the same line as its lightVP.
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
  lights.add(key, key.target, fill, hemi);

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
