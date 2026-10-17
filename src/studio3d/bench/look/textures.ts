import * as THREE from "three";
import { ROOM_SCALE, WORKTOP } from "./room";

/**
 * Tileable procedural surface textures, generated at load time so no image files ship for them
 * (ported from the prototype's look.js). Model UVs are physical (1 UV unit = 10 cm), so each
 * texture's repeat sets its real scale. Sizes shrink on the low quality tier.
 */
const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};

const valueNoise = (N: number, px: number, py: number, rand: () => number): Float32Array => {
  const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i += 1) g[i] = rand();
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    const fy = (y / N) * py, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = iy % py, y1 = (iy + 1) % py;
    for (let x = 0; x < N; x += 1) {
      const fx = (x / N) * px, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % px, x1 = (ix + 1) % px;
      const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
      out[y * N + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
};

const fbm = (N: number, octaves: Array<[number, number, number]>, seed: number): Float32Array => {
  const rand = rng(seed);
  const out = new Float32Array(N * N);
  let total = 0;
  for (const [px, py, w] of octaves) {
    const n = valueNoise(N, px, py, rand);
    for (let i = 0; i < out.length; i += 1) out[i] += n[i] * w;
    total += w;
  }
  for (let i = 0; i < out.length; i += 1) out[i] /= total;
  return out;
};

const fibres = (N: number, count: number, seed: number): Float32Array => {
  const rand = rng(seed);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, N, N);
  g.lineCap = "round";
  for (let i = 0; i < count; i += 1) {
    const x = rand() * N, y = rand() * N, a = rand() * Math.PI * 2, len = 8 + rand() * 30, bend = (rand() - 0.5) * 12;
    g.strokeStyle = rand() < 0.55 ? `rgba(255,255,255,${0.1 + rand() * 0.2})` : `rgba(0,0,0,${0.06 + rand() * 0.14})`;
    g.lineWidth = 0.6 + rand() * 1.3;
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    const cx = (x + ex) / 2 - Math.sin(a) * bend, cy = (y + ey) / 2 + Math.cos(a) * bend;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      if (Math.max(x, ex) + ox < -2 || Math.min(x, ex) + ox > N + 2 || Math.max(y, ey) + oy < -2 || Math.min(y, ey) + oy > N + 2) continue;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(cx + ox, cy + oy, ex + ox, ey + oy);
      g.stroke();
    }
  }
  const px = g.getImageData(0, 0, N, N).data;
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i += 1) h[i] = px[i * 4] / 255;
  return h;
};

const dataTexture = (N: number, fill: (data: Uint8Array) => void, repeat: [number, number], srgb = false): THREE.DataTexture => {
  const data = new Uint8Array(N * N * 4);
  fill(data);
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
};

/** Tangent-space normal map from a height field (OpenGL convention). */
const normalTex = (h: Float32Array, N: number, strength: number, repeat: [number, number]) =>
  dataTexture(N, (d) => {
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
      const xm = h[y * N + ((x + N - 1) % N)], xp = h[y * N + ((x + 1) % N)];
      const ym = h[((y + N - 1) % N) * N + x], yp = h[((y + 1) % N) * N + x];
      const nx = (xm - xp) * strength, ny = (ym - yp) * strength, k = 1 / Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
      d[i] = (nx * k * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * k * 0.5 + 0.5) * 255;
      d[i + 2] = (k * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }, repeat);

const greyTex = (h: Float32Array, N: number, lo: number, hi: number, repeat: [number, number]) =>
  dataTexture(N, (d) => {
    for (let i = 0; i < N * N; i += 1) {
      const v = (lo + (hi - lo) * h[i]) * 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  }, repeat);

export interface BenchTextures {
  brushedN: THREE.Texture;
  brushedR: THREE.Texture;
  peelN: THREE.Texture;
  peelR: THREE.Texture;
  castN: THREE.Texture;
  paperN: THREE.Texture;
  ldpeN: THREE.Texture;
  benchC: THREE.Texture;
  benchR: THREE.Texture;
  /** The room's surfaces (the natural room, 2026-10-12): UVs in metres, so each repeat is 1 / the tile's size. */
  wallC: THREE.Texture;
  wallN: THREE.Texture;
  floorC: THREE.Texture;
  floorR: THREE.Texture;
  floorN: THREE.Texture;
  ceilingC: THREE.Texture;
  laminateC: THREE.Texture;
}

/** Real sizes of the room's texture tiles, metres. */
export const TILE_M = Object.freeze({ worktop: 0.5, wall: 0.5, floorTile: 0.6, ceilingTile: 0.6, laminate: 0.6 });

export const makeTextures = (size: "full" | "reduced" = "full"): BenchTextures => {
  const k = size === "full" ? 1 : 0.5;
  const n = (v: number) => Math.max(64, Math.round(v * k));
  const brushed = fbm(n(512), [[160, 3, 1], [320, 6, 0.6], [40, 2, 0.5]], 11);
  const peel = fbm(n(512), [[22, 22, 1], [44, 44, 0.45], [120, 120, 0.15]], 23);
  const cast = fbm(n(256), [[64, 64, 1], [128, 128, 0.5]], 31);
  const paperH = fibres(n(1024), Math.round(5200 * k * k), 41);
  const fine = fbm(n(1024), [[96, 96, 1], [256, 256, 0.6]], 43);
  for (let i = 0; i < paperH.length; i += 1) paperH[i] = paperH[i] * 0.75 + fine[i] * 0.25;
  const ldpe = fbm(n(256), [[6, 6, 1], [18, 18, 0.35], [90, 90, 0.12]], 53);
  // Worktop: black-charcoal epoxy resin (you, 2026-10-12, in place of the microarray lab's slate-blue resin, so the
  // equipment stands out): near-black with a faint cloudy mottle and sparse fine filler specks, in a 0.5 m tile.
  const benchN = n(1024);
  const cellHash = (x: number, y: number, salt: number) => {
    let h = Math.imul(x + salt * 7919, 374761393) ^ Math.imul(y + salt * 104729, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const lin = (hex: number) => [hex >> 16, (hex >> 8) & 255, hex & 255].map((c) => Math.pow(c / 255, 2.2));
  const epoxy = fbm(benchN, [[3, 3, 0.55], [7, 7, 0.3], [19, 19, 0.15]], 71);
  const epoxyBase = lin(0x2a2c2e);
  const speckCells = Math.round((TILE_M.worktop * 1000) / 0.9); // specks about 0.9 mm
  // The worktop's top face runs u along its depth and v along its width (room.ts).
  const worktopRepeat: [number, number] = [((WORKTOP.front - WORKTOP.back) * ROOM_SCALE) / TILE_M.worktop, ((WORKTOP.right - WORKTOP.left) * ROOM_SCALE) / TILE_M.worktop];
  // Light wear in its sheen: satin roughness 0.36, a little hazier along a few fine scratches. (Wipe marks were tried:
  // at this 0.5 m tile they repeat across the worktop like a stamp.)
  const wear = canvasField(benchN, 0.36, (g, rand) => {
    g.lineCap = "round";
    for (let i = 0; i < 70; i += 1) {
      const x = rand() * benchN, y = rand() * benchN, a = rand() * Math.PI * 2, len = benchN * (0.01 + rand() * 0.07);
      g.strokeStyle = `rgba(255,255,255,${0.04 + rand() * 0.08})`;
      g.lineWidth = 0.6 + rand() * 0.6;
      wrapped(benchN, (ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke(); });
    }
  }, 72);

  // Painted plaster: a faint roller mottle in the colour, and orange-peel stipple in the normal map (0.5 m tile).
  const wallN = n(512);
  const mottle = fbm(wallN, [[2, 2, 0.5], [5, 5, 0.3], [13, 13, 0.2]], 81);
  const stipple = fbm(wallN, [[160, 160, 1], [330, 330, 0.5]], 83);

  // Porcelain floor tiles, 600 mm, warm pale grey and satin (the lab room, 2026-10-16; the photos' large pale glossy
  // tiles): a faint cloudy body, a slight shade difference from tile to tile, and thin grout (a texture of 2 � 2 tiles).
  const floorN = n(1024), tilePx = floorN / 2;
  const cloud = fbm(floorN, [[4, 4, 0.5], [11, 11, 0.3], [37, 37, 0.2]], 91);
  const grain = fbm(floorN, [[180, 180, 1]], 93);
  const floorBase = lin(0xd9d6cf), grout = lin(0xa9a49a);
  const seamPx = Math.max(1, Math.round(floorN / 512));
  const tileShade = [0.99, 1.015, 1.005, 0.985];
  const floorAt = (x: number, y: number) => {
    const tx = Math.floor(x / tilePx), ty = Math.floor(y / tilePx);
    const seam = x - tx * tilePx < seamPx || y - ty * tilePx < seamPx;
    const i = y * floorN + x;
    return { seam, shade: tileShade[(ty % 2) * 2 + (tx % 2)], i };
  };

  // Acoustic ceiling tiles, 600 mm, in their T-bar grid: fine fissures in white, the grid a little greyer.
  const ceilN = n(512);
  const ceilingField = canvasField(ceilN, 0.97, (g, rand) => {
    g.lineCap = "round";
    for (let i = 0; i < Math.round(900 * (ceilN / 512) ** 2); i += 1) {
      const x = rand() * ceilN, y = rand() * ceilN, a = rand() * Math.PI * 2, len = 2 + rand() * 7;
      g.strokeStyle = `rgba(0,0,0,${0.05 + rand() * 0.09})`;
      g.lineWidth = 0.6 + rand() * 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.8) * len * 0.5, y + Math.sin(a + 0.8) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    // The T-bar: 24 mm wide, half of it along each edge of the tile, with the tile's shadow line beside it.
    const bar = Math.max(1, Math.round(((0.024 / TILE_M.ceilingTile) * ceilN) / 2));
    g.fillStyle = "rgb(232,232,230)";
    for (const [x, y, w, h] of [[0, 0, ceilN, bar], [0, ceilN - bar, ceilN, bar], [0, 0, bar, ceilN], [ceilN - bar, 0, bar, ceilN]]) g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(0,0,0,0.22)";
    const line = 1.5;
    for (const [x, y, w, h] of [[bar, bar, ceilN - 2 * bar, line], [bar, ceilN - bar - line, ceilN - 2 * bar, line], [bar, bar, line, ceilN - 2 * bar], [ceilN - bar - line, bar, line, ceilN - 2 * bar]]) g.fillRect(x, y, w, h);
  }, 95);

  // Cabinet laminate: the faintest mottle (0.6 m tile).
  const lamN = n(256);
  const laminate = fbm(lamN, [[4, 4, 0.6], [24, 24, 0.4]], 97);

  const per = (m: number): [number, number] => [1 / m, 1 / m];
  return {
    brushedN: normalTex(brushed, n(512), 1.4, [3.3, 3.3]),
    brushedR: greyTex(brushed, n(512), 0.2, 0.36, [3.3, 3.3]),
    peelN: normalTex(peel, n(512), 3.2, [2, 2]),
    peelR: greyTex(peel, n(512), 0.5, 0.66, [2, 2]),
    castN: normalTex(cast, n(256), 1.2, [8, 8]),
    paperN: normalTex(paperH, n(1024), 3.0, [3.3, 3.3]),
    ldpeN: normalTex(ldpe, n(256), 1.1, [1, 1]),
    benchC: dataTexture(benchN, (d) => {
      for (let y = 0; y < benchN; y += 1) for (let x = 0; x < benchN; x += 1) {
        const i = y * benchN + x;
        const speck = cellHash(Math.floor((x / benchN) * speckCells), Math.floor((y / benchN) * speckCells), 3) > 0.994 ? 1 : 0;
        for (let c = 0; c < 3; c += 1) d[i * 4 + c] = toSrgb(Math.min(1, epoxyBase[c] * (0.9 + 0.2 * epoxy[i]) * (1 + 0.3 * speck)));
        d[i * 4 + 3] = 255;
      }
    }, worktopRepeat, true),
    benchR: greyTex(wear, benchN, 0, 1, worktopRepeat),
    wallC: greyTex(mottle, wallN, 0.955, 1, per(TILE_M.wall)),
    wallN: normalTex(stipple, wallN, 0.9, per(TILE_M.wall)),
    floorC: dataTexture(floorN, (d) => {
      for (let y = 0; y < floorN; y += 1) for (let x = 0; x < floorN; x += 1) {
        const { seam, shade, i } = floorAt(x, y);
        for (let c = 0; c < 3; c += 1) {
          const v = seam ? grout[c] : floorBase[c] * shade * (0.965 + 0.05 * cloud[i] + 0.015 * grain[i]);
          d[i * 4 + c] = toSrgb(Math.min(1, v));
        }
        d[i * 4 + 3] = 255;
      }
    }, per(2 * TILE_M.floorTile), true),
    // Satin glaze, roughness about 0.35, the grout matte.
    floorR: dataTexture(floorN, (d) => {
      for (let y = 0; y < floorN; y += 1) for (let x = 0; x < floorN; x += 1) {
        const { seam, i } = floorAt(x, y);
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = (seam ? 0.8 : 0.32 + 0.06 * grain[i]) * 255;
        d[i * 4 + 3] = 255;
      }
    }, per(2 * TILE_M.floorTile)),
    floorN: normalTex(Float32Array.from({ length: floorN * floorN }, (_, i) => (floorAt(i % floorN, Math.floor(i / floorN)).seam ? 0 : 1)),
      floorN, 0.8, per(2 * TILE_M.floorTile)),
    ceilingC: greyTex(ceilingField, ceilN, 0, 1, per(TILE_M.ceilingTile)),
    laminateC: greyTex(laminate, lamN, 0.965, 1, per(TILE_M.laminate)),
  };
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Strokes drawn over a flat grey of `base` (0–1) on an `N` × `N` canvas, read back as a field from its red channel. */
const canvasField = (N: number, base: number, draw: (g: CanvasRenderingContext2D, rand: () => number) => void, seed: number): Float32Array => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const g = canvas.getContext("2d")!;
  const b = Math.round(base * 255);
  g.fillStyle = `rgb(${b},${b},${b})`;
  g.fillRect(0, 0, N, N);
  draw(g, rng(seed));
  const px = g.getImageData(0, 0, N, N).data;
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i += 1) h[i] = px[i * 4] / 255;
  return h;
};

/** A stroke repeated at the eight neighbouring offsets as well, so the tile wraps. */
const wrapped = (N: number, stroke: (ox: number, oy: number) => void) => {
  for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) stroke(ox, oy);
};

export const disposeTextures = (textures: BenchTextures): void => {
  Object.values(textures).forEach((t) => t.dispose());
};
