import * as THREE from "three";

/**
 * Reflections of the teaching-lab room, from the DNA microarray 3D lab's analytic environment
 * (`virtual_lab/experiments/dnamicroarray_v2/3d-v3/renderer.js:33-38`, `env()`): a floor-to-ceiling
 * gradient with three lobes, the window behind and to the left, a ceiling panel and a cool strip
 * light. It is evaluated per direction into an equirectangular map (roughness 0) and prefiltered by
 * PMREM, which stands in for the source's roughness-widened lobes (decided 2026-10-03/04;
 * `proposals/MICROARRAY_ADOPTION.md` §3.3).
 *
 * As in the source, the map is used for reflections only: every material is patched to drop the
 * map's diffuse lighting, and the hemisphere light gives the ambient (roomLighting.ts, room.ts).
 */

type V3 = [number, number, number];
const unit = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const WINDOW = unit([-0.8, 0.55, -0.5]);
const PANEL = unit([0.1, 0.98, -0.2]);
const STRIP = unit([0.75, 0.55, 0.6]);
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The source's `env(r, 0)`: linear radiance seen along direction `r`. The window's lobe is dimmed to
 * 0.45 of the source's (decided 2026-10-05), as the window itself is, so glass does not mirror a glare.
 */
export const roomRadiance = (r: V3): V3 => {
  const h = smoothstep(-0.2, 0.9, r[1]);
  const w = smoothstep(0.86, 0.99, dot(r, WINDOW));
  const p = smoothstep(0.9, 0.997, dot(r, PANEL));
  const s = smoothstep(0.975, 0.999, dot(r, STRIP));
  return [
    0.15 + 0.45 * h + 1.2 * w + 2.1 * p + 1.0 * s,
    0.14 + 0.48 * h + 1.15 * w + 2.15 * p + 1.04 * s,
    0.13 + 0.49 * h + 1.05 * w + 2.2 * p + 1.1 * s,
  ];
};

export const labEnvironment = (renderer: THREE.WebGLRenderer): THREE.Texture => {
  const W = 512, H = 256;
  // Half floats: linear filtering of them is core WebGL 2, unlike 32-bit floats.
  const data = new Uint16Array(W * H * 4);
  const one = THREE.DataUtils.toHalfFloat(1);
  for (let j = 0; j < H; j += 1) {
    const theta = ((j + 0.5) / H - 0.5) * Math.PI; // three's equirectUv: v = asin(y) / π + 0.5
    for (let i = 0; i < W; i += 1) {
      const phi = ((i + 0.5) / W - 0.5) * Math.PI * 2; // u = atan(z, x) / 2π + 0.5
      const c = roomRadiance([Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi)]);
      data.set([THREE.DataUtils.toHalfFloat(c[0]), THREE.DataUtils.toHalfFloat(c[1]), THREE.DataUtils.toHalfFloat(c[2]), one], (j * W + i) * 4);
    }
  }
  const equirect = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.LinearSRGBColorSpace;
  equirect.magFilter = THREE.LinearFilter;
  equirect.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromEquirectangular(equirect).texture;
  pmrem.dispose();
  equirect.dispose();
  return texture;
};
