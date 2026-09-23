import * as THREE from "three";

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
}

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
  const benchN = n(512);
  const mottle = fbm(benchN, [[6, 6, 1], [24, 24, 0.5]], 71);
  const speck = rng(73);
  return {
    brushedN: normalTex(brushed, n(512), 1.4, [3.3, 3.3]),
    brushedR: greyTex(brushed, n(512), 0.2, 0.36, [3.3, 3.3]),
    peelN: normalTex(peel, n(512), 3.2, [2, 2]),
    peelR: greyTex(peel, n(512), 0.5, 0.66, [2, 2]),
    castN: normalTex(cast, n(256), 1.2, [8, 8]),
    paperN: normalTex(paperH, n(1024), 3.0, [3.3, 3.3]),
    ldpeN: normalTex(ldpe, n(256), 1.1, [1, 1]),
    // Worktop: a low-saturation, mid-tone epoxy resin, faintly mottled with fine speckle (handoff §3.7).
    benchC: dataTexture(benchN, (d) => {
      for (let i = 0; i < benchN * benchN; i += 1) {
        let v = 92 + mottle[i] * 16;
        const s = speck();
        if (s > 0.9965) v += 40;
        else if (s < 0.002) v -= 22;
        d[i * 4] = v;
        d[i * 4 + 1] = v + 2;
        d[i * 4 + 2] = v + 1;
        d[i * 4 + 3] = 255;
      }
    }, [8, 4], true),
    benchR: greyTex(fbm(benchN, [[10, 10, 1], [40, 40, 0.5]], 79), benchN, 0.35, 0.55, [8, 4]),
  };
};

export const disposeTextures = (textures: BenchTextures): void => {
  Object.values(textures).forEach((t) => t.dispose());
};
