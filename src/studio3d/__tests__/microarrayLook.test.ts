import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BENCH_MM } from "../adapters/benchCoordinates";
import { BLOOM } from "../bench/look/composer";
import { roomRadiance } from "../bench/look/environment";
import { REFLECTION, RIM, roomLightingSupported, roomLitMaterial } from "../bench/look/roomLighting";
import { packedBevelBox, packedBox, packedLathe, packedPlane } from "../bench/look/microarrayGeometry";
import { linearHex, ROOM_LIGHTS, ROOM_SCALE } from "../bench/look/room";

// The microarray lab's room and look in three.js (adoption P1, 2026-10-04). Written, not run.

const vertices = (packed: number[]) => Array.from({ length: packed.length / 8 }, (_, i) => packed.slice(i * 8, i * 8 + 8));

describe("transcribed microarray geometry", () => {
  it("packs 8 floats per vertex, with unit normals", () => {
    for (const packed of [packedBox(1, 2, 3), packedBevelBox(1, 2, 3), packedLathe([[0, 0], [1, 0], [1, 1], [0, 1]], 12), packedPlane(2, 1)]) {
      expect(packed.length % 24).toBe(0);
      for (const v of vertices(packed)) expect(Math.hypot(v[3], v[4], v[5])).toBeCloseTo(1, 5);
    }
  });

  it("keeps a bevelled box within its size and gives each face 9 quads", () => {
    const packed = packedBevelBox(15, 0.22, 10);
    expect(packed.length / 8).toBe(6 * 9 * 6);
    for (const v of vertices(packed)) {
      expect(Math.abs(v[0])).toBeLessThanOrEqual(7.5 + 1e-9);
      expect(Math.abs(v[1])).toBeLessThanOrEqual(0.11 + 1e-9);
      expect(Math.abs(v[2])).toBeLessThanOrEqual(5 + 1e-9);
    }
  });

  it("revolves a lathe profile about +Y", () => {
    const packed = packedLathe([[0.14, 0], [0.15, 0.5]], 28);
    expect(packed.length / 8).toBe(28 * 6);
    for (const v of vertices(packed)) expect(Math.hypot(v[0], v[2])).toBeGreaterThan(0.139);
  });
});

describe("room scale and colours", () => {
  it("fits the microarray's 15-unit worktop to the runtime bench width", () => {
    expect(15 * ROOM_SCALE).toBeCloseTo(BENCH_MM.width / 1000, 9);
    expect(ROOM_SCALE).toBeCloseTo(0.0933, 4);
  });

  it("linearises hex colours with a plain 2.2 gamma, as the source does", () => {
    const c = linearHex("#5e6a71");
    expect(c.r).toBeCloseTo(Math.pow(0x5e / 255, 2.2), 6);
    expect(c.b).toBeCloseTo(Math.pow(0x71 / 255, 2.2), 6);
  });

  it("keeps the source's light values", () => {
    expect(ROOM_LIGHTS.keyColour).toEqual([3.0, 2.82, 2.55]);
    expect(ROOM_LIGHTS.fillColour).toEqual([0.55, 0.68, 0.84]);
    expect(ROOM_LIGHTS.shadowLeft).toBe(0.22);
  });
});

describe("environment and frame", () => {
  it("evaluates the source's analytic room radiance", () => {
    expect(roomRadiance([0, -1, 0])).toEqual([0.15, 0.14, 0.13]);
    const window = Math.hypot(-0.8, 0.55, -0.5);
    const atWindow = roomRadiance([-0.8 / window, 0.55 / window, -0.5 / window]);
    // The window's lobe, dimmed from the source's 2.7 (decided 2026-10-05).
    expect(atWindow[0]).toBeGreaterThan(1.2);
    expect(atWindow[0]).toBeLessThan(2.7);
  });

  it("takes only the environment's reflections, and darkens rims, as the source shades (renderer.js:67-81)", () => {
    expect(roomLightingSupported).toBe(true);
    const material = new THREE.MeshStandardMaterial();
    roomLitMaterial(material);
    const shader = {
      fragmentShader: ["#include <lights_fragment_maps>", "#include <opaque_fragment>"].join("\n"),
      vertexShader: "", uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).not.toContain("getIBLIrradiance");
    expect(shader.fragmentShader).toContain("getIBLRadiance");
    expect(shader.fragmentShader).toContain("roomRimEdge");
    expect(material.customProgramCacheKey()).toContain("microarray-room-lit");
    // Patching twice changes nothing.
    const once = material.onBeforeCompile;
    roomLitMaterial(material);
    expect(material.onBeforeCompile).toBe(once);
    expect(RIM).toMatchObject({ edgePower: 2.15, weight: 0.35, floor: 0.6 });
    expect(REFLECTION.glass).toBe(0.62);
  });

  it("blooms above the source's threshold at its strength", () => {
    expect(BLOOM).toMatchObject({ threshold: 1.05, knee: 0.5, strength: 0.45 });
  });
});
