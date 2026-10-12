import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, eyeOf } from "../bench/camera/benchCamera";
import { AO, BLOOM } from "../bench/look/composer";
import { ROOM, ROOM_BOX, ROOM_LIGHTS, ROOM_SCALE, WORKTOP } from "../bench/look/room";
import { OCCLUSION, roomOccludedMaterial, roomOcclusionAt } from "../bench/look/roomOcclusion";
import { REFLECTION_PROBE } from "../bench/look/roomReflections";
import { WINDOW_VIEW } from "../bench/look/windowView";

// The natural room (you, 2026-10-12): a closed room round the bench, its own occlusion, a view out of the window.

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const luminance = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe("the closed room", () => {
  it("runs the bench wall to wall and stands it on a floor, under a ceiling", () => {
    expect(ROOM.left).toBeCloseTo(WORKTOP.left * ROOM_SCALE, 9);
    expect(ROOM.right).toBeCloseTo(WORKTOP.right * ROOM_SCALE, 9);
    expect(ROOM.floor).toBe(-0.9); // a 900 mm worktop
    expect(ROOM.ceiling).toBeGreaterThan(1.8);
    expect(ROOM.window.sill).toBeGreaterThan(0.54); // the window clears the reagent shelf's top
    expect(ROOM_BOX.min.toArray()).toEqual([ROOM.left, ROOM.floor, ROOM.back]);
    expect(ROOM_BOX.max.toArray()).toEqual([ROOM.right, ROOM.ceiling, ROOM.front]);
  });

  it("keeps Home's eye inside the room, under the ceiling, from wide screens to a portrait tablet", () => {
    expect(DEFAULT_VIEW().pitch).toBe(0.45);
    for (const aspect of [16 / 9, 1280 / 748, 1024 / 648, 834 / 1060, 0.75]) {
      const eye = eyeOf(DEFAULT_VIEW(), aspect);
      expect(eye.x).toBeGreaterThan(ROOM.left);
      expect(eye.x).toBeLessThan(ROOM.right);
      expect(eye.y).toBeGreaterThan(0);
      expect(eye.y).toBeLessThan(ROOM.ceiling - 0.05);
      expect(eye.z).toBeGreaterThan(ROOM.back);
      expect(eye.z).toBeLessThan(ROOM.front - 0.5);
    }
  });

  it("keeps one shadow-casting light, its shadows soft", () => {
    expect(ROOM_LIGHTS.shadowRadius).toBeGreaterThan(1);
    expect(ROOM_LIGHTS.keyDirection.y).toBeGreaterThan(0.8 * ROOM_LIGHTS.keyDirection.length()); // nearly overhead
  });

  it("captures its reflections from inside the room, above the worktop", () => {
    const p = REFLECTION_PROBE.position;
    expect(p.y).toBeGreaterThan(0);
    expect(p.x).toBeGreaterThan(ROOM.left);
    expect(p.x).toBeLessThan(ROOM.right);
    expect(p.z).toBeGreaterThan(ROOM.back);
    expect(REFLECTION_PROBE.far).toBeGreaterThan(ROOM.front - ROOM.back);
  });
});

describe("the room's own occlusion", () => {
  const up = v(0, 1, 0), wallFacing = v(0, 0, 1);

  it("leaves open wall alone and darkens towards the corners", () => {
    const open = roomOcclusionAt(ROOM_BOX, v(0.2, 1.1, ROOM.back), wallFacing);
    expect(open).toBeGreaterThan(0.97);
    const corner = roomOcclusionAt(ROOM_BOX, v(ROOM.left + 0.02, 1.1, ROOM.back), wallFacing);
    expect(corner).toBeLessThan(open - 0.2);
    const ceilingCorner = roomOcclusionAt(ROOM_BOX, v(ROOM.left + 0.02, ROOM.ceiling - 0.02, ROOM.back), wallFacing);
    expect(ceilingCorner).toBeLessThan(corner);
    expect(ceilingCorner).toBeGreaterThanOrEqual(OCCLUSION.floor);
  });

  it("darkens the wall just above the worktop and the floor at the toe kick, not the worktop itself", () => {
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, 0.02, ROOM.back), wallFacing)).toBeLessThan(0.7);
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, ROOM.floor, ROOM_BOX.benchMax.z + 0.02), up)).toBeLessThan(0.7);
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, 0, 0), up, true)).toBeGreaterThan(0.95); // only the back wall's corner, far off
  });

  it("shades the cabinet fronts under the worktop's edge, not the edge itself", () => {
    const front = v(0, 0, 1);
    expect(roomOcclusionAt(ROOM_BOX, v(0.2, -0.01, ROOM.cabinetFace), front, true)).toBeGreaterThan(0.98);
    const under = roomOcclusionAt(ROOM_BOX, v(0.2, -0.035, ROOM.cabinetFace), front, true);
    const lower = roomOcclusionAt(ROOM_BOX, v(0.2, -0.4, ROOM.cabinetFace), front, true);
    expect(under).toBeLessThan(lower - 0.2);
  });

  it("patches a material's shader once, under its own program key", () => {
    const material = new THREE.MeshStandardMaterial();
    roomOccludedMaterial(material, ROOM_BOX, true);
    const shader = {
      vertexShader: "#include <common>\n#include <project_vertex>",
      fragmentShader: "#include <common>\n#include <color_fragment>",
      uniforms: {}, defines: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain("diffuseColor.rgb *= roomOcclusion(");
    expect(shader.vertexShader).toContain("vRoomPosition =");
    expect(shader.defines).toHaveProperty("ROOM_ON_BENCH");
    expect(material.customProgramCacheKey()).toContain("room-occlusion-bench");
    const once = material.onBeforeCompile;
    roomOccludedMaterial(material, ROOM_BOX);
    expect(material.onBeforeCompile).toBe(once);
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
