import * as THREE from "three";

/**
 * The room's own ambient occlusion (the natural room, you 2026-10-12), on every quality tier: the soft darkening of
 * a room's inside corners, worked out from its shape rather than rendered. The room is a box with the bench run
 * against its back wall, a block from the floor up to the worktop; a surface darkens towards each surface it meets at
 * a corner, by 1 − strength · e^(−distance / reach), and towards the bench block. A surface is never darkened by its own
 * plane (its normal says which), and the worktop and the cabinet fronts, being on the block, not by the block.
 *
 * It darkens the surface colour, so the key light's share darkens with the ambient's: a room's corners are lit
 * mostly by light from the room itself, which reaches into them least.
 */
export interface RoomBox {
  /** The room's inside, metres: floor, walls and ceiling. */
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** The bench run: floor to worktop, wall to wall, back wall to the worktop's front edge. */
  benchMin: THREE.Vector3;
  benchMax: THREE.Vector3;
}

export const OCCLUSION = Object.freeze({
  /** The room's corners: strength and reach (m). */
  corner: { strength: 0.32, reach: 0.24 },
  /** Against the bench run: the floor at the toe kick, the walls just above the worktop. */
  bench: { strength: 0.42, reach: 0.12 },
  /** Under the worktop's 25 mm overhang (below its 30 mm edge), on the cabinet fronts. */
  overhang: { strength: 0.38, reach: 0.05 },
  /** Never darker than this. */
  floor: 0.5,
});

/** The occlusion at `p` on a surface facing `n`, as the shader works it out (for tests and the probe). */
export const roomOcclusionAt = (box: RoomBox, p: THREE.Vector3, n: THREE.Vector3, onBench = false): number => {
  const f = (d: number, k: { strength: number; reach: number }) => 1 - k.strength * Math.exp(-Math.max(d, 0) / k.reach);
  const a = new THREE.Vector3(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
  let ao = 1;
  if (a.x < 0.5) ao *= f(p.x - box.min.x, OCCLUSION.corner) * f(box.max.x - p.x, OCCLUSION.corner);
  if (a.y < 0.5) ao *= f(p.y - box.min.y, OCCLUSION.corner) * f(box.max.y - p.y, OCCLUSION.corner);
  if (a.z < 0.5) ao *= f(p.z - box.min.z, OCCLUSION.corner) * f(box.max.z - p.z, OCCLUSION.corner);
  if (onBench) {
    const under = box.benchMax.y - 0.03 - p.y;
    if (a.y < 0.5 && under >= 0) ao *= f(under, OCCLUSION.overhang);
  } else {
    const q = new THREE.Vector3().subVectors(box.benchMin, p).max(new THREE.Vector3().subVectors(p, box.benchMax)).max(new THREE.Vector3());
    ao *= f(q.length(), OCCLUSION.bench);
  }
  return Math.max(ao, OCCLUSION.floor);
};

const GLSL = /* glsl */ `
uniform vec3 roomMin;
uniform vec3 roomMax;
uniform vec3 roomBenchMin;
uniform vec3 roomBenchMax;
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
		float under = roomBenchMax.y - 0.03 - p.y;
		if ( a.y < 0.5 && under >= 0.0 ) ao *= roomFalloff( under, ${OCCLUSION.overhang.strength.toFixed(3)}, ${OCCLUSION.overhang.reach.toFixed(3)} );
	#else
		vec3 q = max( max( roomBenchMin - p, p - roomBenchMax ), vec3( 0.0 ) );
		ao *= roomFalloff( length( q ), ${OCCLUSION.bench.strength.toFixed(3)}, ${OCCLUSION.bench.reach.toFixed(3)} );
	#endif
	return max( ao, ${OCCLUSION.floor.toFixed(3)} );
}`;

/**
 * Give a room material the occlusion (once, before the room lighting patch, which keeps an earlier hook).
 * `onBench`: the worktop and the cabinet fronts, which stand on the bench block.
 */
export const roomOccludedMaterial = (material: THREE.MeshStandardMaterial, box: RoomBox, onBench = false): void => {
  if (material.userData.roomOccluded) return;
  material.userData.roomOccluded = true;
  const uniforms = {
    roomMin: { value: box.min }, roomMax: { value: box.max },
    roomBenchMin: { value: box.benchMin }, roomBenchMax: { value: box.benchMax },
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
