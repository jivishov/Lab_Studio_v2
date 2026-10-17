import * as THREE from "three";

/**
 * The DNA microarray 3D lab's lighting model on three.js's standard materials (decided 2026-10-03/04;
 * `proposals/MICROARRAY_ADOPTION.md` §3.3). The source shades every surface as (`3d-v3/renderer.js:67-77`):
 * - ambient from a hemisphere term, base · mix(ground, sky) (room.ts adds it as a hemisphere light);
 * - the key and fill lights;
 * - reflections of its analytic room, env(r, roughness) · Fresnel (environment.ts), on top;
 * - rim darkening: the colour falls towards 60% at grazing angles, c · mix(1, 0.6, edge · 0.35),
 *   edge = (1 − n·v)^2.15. Its glass uses a gentler 0.62 at edge · 0.3 (`renderer.js:81`), which clear plastic keeps;
 *   glassware has its own since 2026-10-16 (`GLASS`).
 *
 * three.js lights diffuse surfaces from the environment map as well as reflecting it, so each
 * standard material is patched to take only the map's reflections (its `iblIrradiance` term is
 * dropped, `lights_fragment_maps`), leaving the hemisphere light as the only ambient, as in the
 * source; and the rim darkening is applied to the outgoing light. The source's ground occlusion
 * (darker lower sides within 0.34 units of the bench) is not reproduced: Lab Studio's contact
 * shadows do that work under each item.
 *
 * Glass takes the map as its own `envMap` at the source's glass reflection factor
 * (`REFLECTION.glass`, `renderer.js:80`: env · 0.62); everything else reflects the scene's map at
 * full strength, as the source's env(r, rough) · f does (`renderer.js:71`).
 */
export const REFLECTION = { glass: 0.62 } as const;
export const RIM = { edgePower: 2.15, weight: 0.35, floor: 0.6, glassWeight: 0.3, glassFloor: 0.62 } as const;
/**
 * Glassware's own look (you, 2026-10-16: "Glassware on the shelves is not visible as on the bench"; answered "e:
 * stronger"): against the window and the pale wall the source's glass let the background through untouched, so an empty
 * vessel on the shelf all but vanished. Real glass passes about 86% through its four surfaces and darkens toward its
 * sides, where light crosses the wall lengthwise and reflects more. So glass (materials.ts, `ROOM_GLASS`) passes `pass` of
 * the light behind it, and its outgoing light falls to `edgeFloor` at the silhouette over a broad band,
 * mix(1, edgeFloor, (1 − n·v)^edgePower · edgeWeight), about 40% at the edge and 70% at 60° from face-on. Other
 * transmissive surfaces (clear and frosted plastic) keep the source's gentler glass rim above.
 */
export const GLASS = { pass: 0.8, edgePower: 1, edgeFloor: 0.35, edgeWeight: 0.9 } as const;

const IRRADIANCE = "iblIrradiance += getIBLIrradiance( geometryNormal );";
const SPECULAR_ONLY_MAPS = THREE.ShaderChunk.lights_fragment_maps.replace(IRRADIANCE, "");
/** Whether this three.js build still has the line the patch removes; if not, the patch leaves the shader alone. */
export const roomLightingSupported = THREE.ShaderChunk.lights_fragment_maps.includes(IRRADIANCE);

const RIM_GLSL = /* glsl */ `
	{
		float roomRimNv = saturate( dot( normal, geometryViewDir ) );
		float roomRimEdge = pow( 1.0 - roomRimNv, ${RIM.edgePower.toFixed(2)} );
		#if defined( ROOM_GLASS )
			outgoingLight *= mix( 1.0, ${GLASS.edgeFloor.toFixed(2)}, pow( 1.0 - roomRimNv, ${GLASS.edgePower.toFixed(2)} ) * ${GLASS.edgeWeight.toFixed(2)} );
		#elif defined( USE_TRANSMISSION )
			outgoingLight *= mix( 1.0, ${RIM.glassFloor.toFixed(2)}, roomRimEdge * ${RIM.glassWeight.toFixed(2)} );
		#else
			outgoingLight *= mix( 1.0, ${RIM.floor.toFixed(2)}, roomRimEdge * ${RIM.weight.toFixed(2)} );
		#endif
	}
#include <opaque_fragment>`;

/** Patch one material (once): environment reflections only, and the source's rim darkening. */
export const roomLitMaterial = (material: THREE.Material): void => {
  const m = material as THREE.MeshStandardMaterial;
  if (!m.isMeshStandardMaterial || m.userData.roomLit || !roomLightingSupported) return;
  m.userData.roomLit = true;
  // The program cache key keeps the material's own key (taken before the hook is replaced), so a
  // material with a hook of its own never shares a program with one without.
  const baseKey = m.customProgramCacheKey();
  const previous = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    previous.call(m, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <lights_fragment_maps>", SPECULAR_ONLY_MAPS)
      .replace("#include <opaque_fragment>", RIM_GLSL);
  };
  m.customProgramCacheKey = () => `${baseKey}|microarray-room-lit`;
  m.needsUpdate = true;
};

/** Patch every standard material under `root` that is not patched yet (cheap once patched: a flag check per material). */
export const applyRoomLighting = (root: THREE.Object3D): void => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) roomLitMaterial(material);
  });
};
