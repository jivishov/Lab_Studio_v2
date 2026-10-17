import * as THREE from "three";

/**
 * The room's own ambient occlusion (the natural room, you 2026-10-12; the open hall, 2026-10-16), on every quality
 * tier: the soft darkening of a room's inside corners and of the floor and walls against what stands on them, worked
 * out from shapes rather than rendered. The room is a box (the hall), and inside it stand a small fixed number of
 * blocks, each from the floor up (the islands, the column, the wall cabinets; `BLOCK_COUNT`, a uniform array). A
 * surface darkens towards each face of the room it meets at a corner, by 1 − strength · e^(−distance / reach), and
 * towards each block. A surface is never darkened by its own plane (its normal says which), nor by a block it lies on
 * (within `ON_BLOCK` of it); the worktops and the cabinet fronts under them (`onBench`) are not darkened by blocks at
 * all, and take the shade under the worktop's overhang instead.
 *
 * It darkens the surface colour, so the key light's share darkens with the ambient's: a room's corners are lit
 * mostly by light from the room itself, which reaches into them least.
 */
export interface RoomBox {
  /** The room's inside, metres: floor, walls and ceiling. */
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** The free-standing blocks, floor upwards: exactly `BLOCK_COUNT` (a degenerate box at the floor is none). */
  blocks: Array<{ min: THREE.Vector3; max: THREE.Vector3 }>;
}

export const BLOCK_COUNT = 5;

export const OCCLUSION = Object.freeze({
  /** The room's corners: strength and reach (m). */
  corner: { strength: 0.32, reach: 0.24 },
  /** Against a block: the floor at the toe kick, a wall beside a cabinet. */
  bench: { strength: 0.42, reach: 0.12 },
  /** Under the worktop's 25 mm overhang (below its 30 mm edge), on the cabinet fronts; the worktops' top is y = 0. */
  overhang: { strength: 0.38, reach: 0.05 },
  /** Never darker than this. */
  floor: 0.5,
});
/** A surface this close to a block lies on it (its faces), and is not darkened by it. */
export const ON_BLOCK = 0.003;

/** The occlusion at `p` on a surface facing `n`, as the shader works it out (for tests and the probe). */
export const roomOcclusionAt = (box: RoomBox, p: THREE.Vector3, n: THREE.Vector3, onBench = false): number => {
  const f = (d: number, k: { strength: number; reach: number }) => 1 - k.strength * Math.exp(-Math.max(d, 0) / k.reach);
  const a = new THREE.Vector3(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
  let ao = 1;
  if (a.x < 0.5) ao *= f(p.x - box.min.x, OCCLUSION.corner) * f(box.max.x - p.x, OCCLUSION.corner);
  if (a.y < 0.5) ao *= f(p.y - box.min.y, OCCLUSION.corner) * f(box.max.y - p.y, OCCLUSION.corner);
  if (a.z < 0.5) ao *= f(p.z - box.min.z, OCCLUSION.corner) * f(box.max.z - p.z, OCCLUSION.corner);
  if (onBench) {
    const under = -0.03 - p.y;
    if (a.y < 0.5 && under >= 0) ao *= f(under, OCCLUSION.overhang);
  } else {
    for (const block of box.blocks) {
      const d = new THREE.Vector3().subVectors(block.min, p).max(new THREE.Vector3().subVectors(p, block.max)).max(new THREE.Vector3()).length();
      if (d > ON_BLOCK) ao *= f(d, OCCLUSION.bench);
    }
  }
  return Math.max(ao, OCCLUSION.floor);
};

const GLSL = /* glsl */ `
#define ROOM_BLOCKS ${BLOCK_COUNT}
uniform vec3 roomMin;
uniform vec3 roomMax;
uniform vec3 roomBlockMin[ ROOM_BLOCKS ];
uniform vec3 roomBlockMax[ ROOM_BLOCKS ];
varying vec3 vRoomPosition;
varying vec3 vRoomNormal;
float roomFalloff( float d, float strength, float reach ) { return 1.0 - strength * exp( - max( d, 0.0 ) / reach ); }
float roomOcclusion( vec3 p, vec3 n ) {
	vec3 a = abs( n );
	float ao = 1.0;
	float ks = ${OCCLUSION.corner.strength.toFixed(3)}, kr = ${OCCLUSION.corner.reach.toFixed(3)};
	if ( a.x < 0.5 ) ao *= roomFalloff( p.x - roomMin.x, ks, kr ) * roomFalloff( roomMax.x - p.x, ks, kr );
	if ( a.y < 0.5 ) ao *= roomFalloff( p.y - roomMin.y, ks, kr ) * roomFalloff( roomMax.y - p.y, ks, kr );
	if ( a.z < 0.5 ) ao *= roomFalloff( p.z - roomMin.z, ks, kr ) * roomFalloff( roomMax.z - p.z, ks, kr );
	#ifdef ROOM_ON_BENCH
		float under = -0.03 - p.y;
		if ( a.y < 0.5 && under >= 0.0 ) ao *= roomFalloff( under, ${OCCLUSION.overhang.strength.toFixed(3)}, ${OCCLUSION.overhang.reach.toFixed(3)} );
	#else
		for ( int i = 0; i < ROOM_BLOCKS; i ++ ) {
			float d = length( max( max( roomBlockMin[ i ] - p, p - roomBlockMax[ i ] ), vec3( 0.0 ) ) );
			if ( d > ${ON_BLOCK.toFixed(4)} ) ao *= roomFalloff( d, ${OCCLUSION.bench.strength.toFixed(3)}, ${OCCLUSION.bench.reach.toFixed(3)} );
		}
	#endif
	return max( ao, ${OCCLUSION.floor.toFixed(3)} );
}`;

/**
 * Give a room material the occlusion (once, before the room lighting patch, which keeps an earlier hook).
 * `onBench`: the worktops and the cabinet fronts under them, which stand on an island's block.
 */
export const roomOccludedMaterial = (material: THREE.MeshStandardMaterial, box: RoomBox, onBench = false): void => {
  if (material.userData.roomOccluded) return;
  if (box.blocks.length !== BLOCK_COUNT) throw new Error(`the room's occlusion takes ${BLOCK_COUNT} blocks`);
  material.userData.roomOccluded = true;
  const uniforms = {
    roomMin: { value: box.min }, roomMax: { value: box.max },
    roomBlockMin: { value: box.blocks.map((b) => b.min) }, roomBlockMax: { value: box.blocks.map((b) => b.max) },
  };
  const baseKey = material.customProgramCacheKey();
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    if (onBench) shader.defines = { ...shader.defines, ROOM_ON_BENCH: "" };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRoomPosition;\nvarying vec3 vRoomNormal;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n\tvRoomPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n\tvRoomNormal = mat3( modelMatrix ) * objectNormal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\n\tdiffuseColor.rgb *= roomOcclusion( vRoomPosition, normalize( vRoomNormal ) );");
  };
  material.customProgramCacheKey = () => `${baseKey}|room-occlusion${onBench ? "-bench" : ""}`;
  material.needsUpdate = true;
};
