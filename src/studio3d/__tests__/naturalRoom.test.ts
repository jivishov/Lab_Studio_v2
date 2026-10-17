import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, eyeOf, FAR, MANUAL } from "../bench/camera/benchCamera";
import { AO, BLOOM } from "../bench/look/composer";
import { BLOCKS, ISLAND } from "../bench/look/hall";
import { ROOM, ROOM_BOX, ROOM_LIGHTS, ROOM_SCALE, SHADOW_BOX, WORKTOP } from "../bench/look/room";
import { BLOCK_COUNT, OCCLUSION, roomOccludedMaterial, roomOcclusionAt } from "../bench/look/roomOcclusion";
import { REFLECTION_PROBE } from "../bench/look/roomReflections";
import { WINDOW_VIEW } from "../bench/look/windowView";

// The natural room (you, 2026-10-12), opened into the lab room's hall (2026-10-16, LAB_ROOM_LAYOUT.md revision 2):
// a teaching hall round our island, its own occlusion, a view out of the windows.

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const luminance = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const corners = () => [ROOM.left, ROOM.right].flatMap((x) => [ROOM.floor, ROOM.ceiling].flatMap((y) => [ROOM.back, ROOM.front].map((z) => v(x, y, z))));

describe("the hall", () => {
  it("is about 12 × 10 m, 3 m high, with the bench at 900 mm and the ceiling 2.1 m over the worktop", () => {
    expect(ROOM.right - ROOM.left).toBeCloseTo(12, 1);
    expect(ROOM.front - ROOM.back).toBeGreaterThan(9.5);
    expect(ROOM.front - ROOM.back).toBeLessThan(10.5);
    expect(ROOM.floor).toBe(-0.9);
    expect(ROOM.ceiling).toBe(2.1);
    expect(ROOM_BOX.min.toArray()).toEqual([ROOM.left, ROOM.floor, ROOM.back]);
    expect(ROOM_BOX.max.toArray()).toEqual([ROOM.right, ROOM.ceiling, ROOM.front]);
  });

  it("places its walls as decided: front about 4.3 m out, back about 6 m behind the bench's edge, the end wall 2 m past the island", () => {
    expect(ROOM.front).toBeCloseTo(4.3, 6);
    expect(ISLAND.front - ROOM.back).toBeGreaterThan(5.8);
    expect(ISLAND.front - ROOM.back).toBeLessThan(6.6);
    expect(ROOM.right - ISLAND.right).toBeCloseTo(2, 1);
    expect(ISLAND.left).toBeGreaterThan(ROOM.left + 1); // an aisle round the island's far end
  });

  it("keeps our island's front edge and its free end where the worktop ended before", () => {
    expect(WORKTOP.front).toBe(5);
    expect(WORKTOP.right).toBe(14.25);
    expect(WORKTOP.right * ROOM_SCALE).toBeCloseTo(ISLAND.right, 9);
    expect(WORKTOP.back * ROOM_SCALE).toBeCloseTo(ISLAND.back, 9);
  });

  it("puts the windows in the back wall, side by side, under the ceiling", () => {
    const w = ROOM.windows;
    expect(w.centres).toHaveLength(5);
    for (let i = 1; i < w.centres.length; i += 1) expect(w.centres[i] - w.centres[i - 1]).toBeGreaterThan(w.width);
    expect(w.centres[0] - w.width / 2).toBeGreaterThan(ROOM.left);
    expect(w.centres[4] + w.width / 2).toBeLessThan(ROOM.right);
    expect(w.head).toBeLessThan(ROOM.ceiling - 0.3);
  });

  it("keeps Home's default eye inside the hall, from wide screens to a portrait tablet", () => {
    expect(DEFAULT_VIEW().pitch).toBe(0.45);
    for (const aspect of [16 / 9, 1280 / 748, 1024 / 648, 834 / 1060, 0.75]) {
      const eye = eyeOf(DEFAULT_VIEW(), aspect);
      expect(eye.x).toBeGreaterThan(ROOM.left);
      expect(eye.x).toBeLessThan(ROOM.right);
      expect(eye.y).toBeGreaterThan(0);
      expect(eye.y).toBeLessThan(ROOM.ceiling - 0.05);
      expect(eye.z).toBeLessThan(ROOM.front - 0.5);
    }
  });

  it("draws to the farthest corner from the farthest eye manual zoom allows", () => {
    // The farthest eye: manual zoom out, about any look-at point over the working area, on a portrait screen.
    const reach = MANUAL.distanceMax * (1.1 / 0.75) + Math.hypot(0.7, 0.35);
    for (const c of corners()) expect(c.length() + reach).toBeLessThan(FAR);
    expect(FAR).toBeGreaterThan(16);
    expect(FAR).toBeLessThan(19);
  });

  it("keeps one shadow-casting light, nearly overhead, its shadows soft, its box on our station and the side station", () => {
    expect(ROOM_LIGHTS.shadowRadius).toBeGreaterThan(1);
    expect(ROOM_LIGHTS.keyDirection.y).toBeGreaterThan(0.8 * ROOM_LIGHTS.keyDirection.length());
    expect(SHADOW_BOX.minX).toBeLessThan(-0.7);
    expect(SHADOW_BOX.maxX).toBeGreaterThan(1.3);
    expect(SHADOW_BOX.maxX - SHADOW_BOX.minX).toBeLessThan(2.6); // still about a station's size, so its texels stay fine
  });

  it("captures its reflections from over the worktop, out to the far corners", () => {
    const p = REFLECTION_PROBE.position;
    expect(p.y).toBeGreaterThan(0);
    expect(p.x).toBeGreaterThan(ROOM.left);
    expect(p.x).toBeLessThan(ROOM.right);
    expect(p.z).toBeGreaterThan(ROOM.back);
    for (const c of corners()) expect(c.distanceTo(p)).toBeLessThan(REFLECTION_PROBE.far);
  });
});

describe("the hall's own occlusion", () => {
  const up = v(0, 1, 0), wallFacing = v(0, 0, 1);

  it("takes a fixed number of blocks, the islands first", () => {
    expect(ROOM_BOX.blocks).toHaveLength(BLOCK_COUNT);
    expect(BLOCKS).toHaveLength(BLOCK_COUNT);
    expect(ROOM_BOX.blocks[0].max.z).toBeCloseTo(ISLAND.front, 9);
  });

  it("leaves open wall alone and darkens towards the corners", () => {
    const open = roomOcclusionAt(ROOM_BOX, v(0.2, 1.1, ROOM.back), wallFacing);
    expect(open).toBeGreaterThan(0.97);
    const corner = roomOcclusionAt(ROOM_BOX, v(ROOM.left + 0.02, 1.1, ROOM.back), wallFacing);
    expect(corner).toBeLessThan(open - 0.2);
    const ceilingCorner = roomOcclusionAt(ROOM_BOX, v(ROOM.left + 0.02, ROOM.ceiling - 0.02, ROOM.back), wallFacing);
    expect(ceilingCorner).toBeLessThan(corner);
    expect(ceilingCorner).toBeGreaterThanOrEqual(OCCLUSION.floor);
  });

  it("darkens the floor at each island's toe kick and leaves the open floor alone", () => {
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, ROOM.floor, ISLAND.front + 0.02), up)).toBeLessThan(0.7);
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, ROOM.floor, ISLAND.back - 0.02), up)).toBeLessThan(0.7);
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, ROOM.floor, ISLAND.front + 1.5), up)).toBeGreaterThan(0.97);
  });

  it("never darkens a block by itself, nor the worktop", () => {
    // The cabinet fronts lie on the island's block: only the overhang shades them.
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, 0, 0), up, true)).toBeGreaterThan(0.95);
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, -0.2, ISLAND.front), wallFacing)).toBeGreaterThan(0.97);
  });

  it("shades the cabinet fronts under the worktop's edge, not the edge itself", () => {
    const front = v(0, 0, 1);
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, -0.01, ROOM.cabinetFace), front, true)).toBeGreaterThan(0.98);
    const under = roomOcclusionAt(ROOM_BOX, v(0.2, -0.035, ROOM.cabinetFace), front, true);
    const lower = roomOcclusionAt(ROOM_BOX, v(0.2, -0.4, ROOM.cabinetFace), front, true);
    expect(under).toBeLessThan(lower - 0.2);
  });

  it("patches a material's shader once, under its own program key, with the blocks as a uniform array", () => {
    const material = new THREE.MeshStandardMaterial();
    roomOccludedMaterial(material, ROOM_BOX, true);
    const shader = {
      vertexShader: "#include <common>\n#include <project_vertex>",
      fragmentShader: "#include <common>\n#include <color_fragment>",
      uniforms: {}, defines: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain("diffuseColor.rgb *= roomOcclusion(");
    expect(shader.fragmentShader).toContain(`#define ROOM_BLOCKS ${BLOCK_COUNT}`);
    expect((shader.uniforms.roomBlockMin as { value: unknown[] }).value).toHaveLength(BLOCK_COUNT);
    expect(shader.vertexShader).toContain("vRoomPosition =");
    expect(shader.defines).toHaveProperty("ROOM_ON_BENCH");
    expect(material.customProgramCacheKey()).toContain("room-occlusion-bench");
    const once = material.onBeforeCompile;
    roomOccludedMaterial(material, ROOM_BOX);
    expect(material.onBeforeCompile).toBe(once);
    expect(() => roomOccludedMaterial(new THREE.MeshStandardMaterial(), { ...ROOM_BOX, blocks: [] })).toThrow();
  });
});

describe("the window view and live occlusion", () => {
  it("stays under the bloom threshold, with the sky the brightest and the trees darker than the lawn", () => {
    const colours = [WINDOW_VIEW.horizon, WINDOW_VIEW.zenith, WINDOW_VIEW.lawn, WINDOW_VIEW.treeline.colour, WINDOW_VIEW.trees.colour];
    for (const c of colours) for (const x of c) expect(x).toBeLessThan(BLOOM.threshold);
    expect(luminance(WINDOW_VIEW.horizon)).toBeGreaterThan(luminance(WINDOW_VIEW.lawn));
    expect(luminance(WINDOW_VIEW.lawn)).toBeGreaterThan(luminance(WINDOW_VIEW.treeline.colour));
    expect(WINDOW_VIEW.treeline.distance).toBeLessThan(WINDOW_VIEW.trees.distance);
  });

  it("sizes the live occlusion for bench equipment", () => {
    expect(AO.radius).toBeLessThan(0.1);
    expect(AO.blend).toBeGreaterThan(0);
    expect(AO.blend).toBeLessThanOrEqual(1);
  });
});
