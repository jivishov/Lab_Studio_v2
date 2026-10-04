import * as THREE from "three";

/**
 * The DNA microarray 3D lab's procedural geometry, transcribed from
 * `virtual_lab/experiments/dnamicroarray_v2/3d-v3/renderer.js` (the `G` helpers, line 10) so the
 * room built from it keeps the source's topology, normals and UVs (decided 2026-10-03/04;
 * `proposals/MICROARRAY_ADOPTION.md` §3.3). three.js's RoundedBoxGeometry and LatheGeometry differ
 * in both. Vertices are packed as the source packs them, 8 floats each (position, normal, uv), then
 * split into a non-indexed BufferGeometry. Units are the source's arbitrary scene units.
 */
type Vec3 = [number, number, number];
type Vec2 = [number, number];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const tri = (out: number[], a: Vec3, b: Vec3, c: Vec3, na: Vec3, nb: Vec3, nc: Vec3,
  ua: Vec2 = [0, 0], ub: Vec2 = [1, 0], uc: Vec2 = [1, 1]): void => {
  out.push(...a, ...na, ...ua, ...b, ...nb, ...ub, ...c, ...nc, ...uc);
};

export const packedBox = (w: number, h: number, d: number): number[] => {
  const o: number[] = [], x = w / 2, y = h / 2, z = d / 2;
  const faces: Array<[Vec3, Vec3, Vec3, Vec3, Vec3]> = [
    [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
    [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
    [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
    [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]],
    [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
    [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
  ];
  for (const [a, b, c, dd, n] of faces) {
    tri(o, a, b, c, n, n, n, [0, 0], [1, 0], [1, 1]);
    tri(o, a, c, dd, n, n, n, [0, 0], [1, 1], [0, 1]);
  }
  return o;
};

/** A surface of revolution about +Y from `profile` ([radius, y] pairs); neighbouring faces under ~63° share smoothed normals. */
export const packedLathe = (profile: Vec2[], segments = 48): number[] => {
  const o: number[] = [];
  const faces = profile.slice(0, -1).map((p, j): Vec3 => norm([profile[j + 1][1] - p[1], p[0] - profile[j + 1][0], 0]));
  for (let j = 0; j < profile.length - 1; j += 1) {
    const [r0, y0] = profile[j], [r1, y1] = profile[j + 1], f = faces[j];
    const smooth = (other: Vec3 | undefined): Vec3 => (other && dot(f, other) > 0.45 ? norm(add(f, other)) : f);
    const lo = smooth(faces[j - 1]), hi = smooth(faces[j + 1]);
    const v0 = j / (profile.length - 1), v1 = (j + 1) / (profile.length - 1);
    for (let i = 0; i < segments; i += 1) {
      const t0 = (i / segments) * Math.PI * 2, t1 = ((i + 1) / segments) * Math.PI * 2;
      const pt = (r: number, y: number, t: number): Vec3 => [r * Math.cos(t), y, r * Math.sin(t)];
      const nn = (n: Vec3, t: number): Vec3 => [n[0] * Math.cos(t), n[1], n[0] * Math.sin(t)];
      const a = pt(r0, y0, t0), b = pt(r0, y0, t1), c = pt(r1, y1, t1), d = pt(r1, y1, t0);
      const na = nn(lo, t0), nb = nn(lo, t1), nc = nn(hi, t1), nd = nn(hi, t0);
      const u0 = i / segments, u1 = (i + 1) / segments;
      tri(o, a, d, c, na, nd, nc, [u0, v0], [u0, v1], [u1, v1]);
      tri(o, a, c, b, na, nc, nb, [u0, v0], [u1, v1], [u1, v0]);
    }
  }
  return o;
};

/** A box whose edges and corners are rounded by `rad` (at most 35% of the smallest half-size). */
export const packedBevelBox = (w: number, h: number, d: number, rad = 0.018): number[] => {
  const halves: Vec3 = [w / 2, h / 2, d / 2];
  const b = Math.min(rad, ...halves.map((v) => v * 0.35));
  const out: number[] = [];
  for (let axis = 0; axis < 3; axis += 1) for (const sign of [-1, 1]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const grid = (k: number) => [-halves[k], -halves[k] + b, halves[k] - b, halves[k]];
    const us = grid(u), vs = grid(v);
    const at = (i: number, j: number): { p: Vec3; n: Vec3; uv: Vec2 } => {
      const p: Vec3 = [0, 0, 0];
      p[axis] = halves[axis] * sign;
      p[u] = us[i];
      p[v] = vs[j];
      const core = p.map((q, k) => Math.min(halves[k] - b, Math.max(-halves[k] + b, q))) as Vec3;
      const n = norm(sub(p, core));
      return { p: add(core, mul(n, b)), n, uv: [(p[u] + halves[u]) / (2 * halves[u]), (p[v] + halves[v]) / (2 * halves[v])] };
    };
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
      const a = at(i, j);
      let bb = at(i + 1, j);
      const c = at(i + 1, j + 1);
      let dd = at(i, j + 1);
      if (sign < 0) [bb, dd] = [dd, bb];
      tri(out, a.p, bb.p, c.p, a.n, bb.n, c.n, a.uv, bb.uv, c.uv);
      tri(out, a.p, c.p, dd.p, a.n, c.n, dd.n, a.uv, c.uv, dd.uv);
    }
  }
  return out;
};

export const packedCylinder = (r: number, h: number, segments = 48, rTop = r): number[] =>
  packedLathe([[0, 0], [r, 0], [rTop, h], [0, h]], segments);

export const packedPlane = (w: number, h: number): number[] => {
  const o: number[] = [], n: Vec3 = [0, 0, 1];
  const a: Vec3 = [-w / 2, -h / 2, 0], b: Vec3 = [w / 2, -h / 2, 0], c: Vec3 = [w / 2, h / 2, 0], d: Vec3 = [-w / 2, h / 2, 0];
  tri(o, a, b, c, n, n, n, [0, 1], [1, 1], [1, 0]);
  tri(o, a, c, d, n, n, n, [0, 1], [1, 0], [0, 0]);
  return o;
};

/** Split packed vertices into a BufferGeometry. The source samples canvas textures without a Y flip; `flipV` matches that for three. */
export const toBufferGeometry = (packed: number[], flipV = false): THREE.BufferGeometry => {
  const count = packed.length / 8;
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    position.set(packed.slice(i * 8, i * 8 + 3), i * 3);
    normal.set(packed.slice(i * 8 + 3, i * 8 + 6), i * 3);
    uv[i * 2] = packed[i * 8 + 6];
    uv[i * 2 + 1] = flipV ? 1 - packed[i * 8 + 7] : packed[i * 8 + 7];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
};
