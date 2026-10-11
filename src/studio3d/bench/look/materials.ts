import * as THREE from "three";
import viewerMaterials from "../../equipment3d/viewerMaterials.json";
import { REFLECTION } from "./roomLighting";
import type { BenchTextures } from "./textures";

/**
 * Physically based material settings for equipment models, assigned by the role each glTF
 * material name has in viewerMaterials.json (the contract the Blender side is validated against).
 * Values are the prototype's look.js settings. Glass is front-sided and writes no depth, so
 * liquids drawn inside it stay visible and double-sided transmission cannot render black bands
 * (plan §6.2).
 *
 * Glass and clear plastic take the room's reflection map as their own `envMap` at the microarray
 * lab's glass reflection factor (`REFLECTION.glass`); everything else reflects the scene's map at
 * full strength. All of them are lit as the source lights its surfaces (roomLighting.ts).
 */
type Role =
  | "glass-thin" | "glass-thick" | "frosted" | "print" | "metal-brushed" | "metal" | "coating" | "rubber"
  | "plastic-opaque" | "plastic-translucent" | "plastic-clear" | "paper" | "display" | "porcelain" | "tile" | "brass" | "flame";

const roleByName = new Map<string, Role>(
  Object.entries(viewerMaterials.materials as Record<string, { role: string }>).map(([name, value]) => [name, value.role as Role]),
);

export const materialRole = (name: string): Role | undefined => roleByName.get(name);

const toPhysical = (m: THREE.Material): THREE.MeshPhysicalMaterial => {
  if ((m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return m as THREE.MeshPhysicalMaterial;
  const src = m as THREE.MeshStandardMaterial;
  const p = new THREE.MeshPhysicalMaterial({ name: src.name });
  if (src.color) p.color.copy(src.color);
  if (src.map) p.map = src.map;
  p.roughness = src.roughness ?? 1;
  p.metalness = src.metalness ?? 0;
  return p;
};

const tune = (src: THREE.Material, T: BenchTextures, enclosureGlass: boolean, environment?: THREE.Texture): THREE.Material => {
  const name = src.name ?? "";
  const role = materialRole(name);
  const reflect = (m: THREE.MeshPhysicalMaterial, intensity: number): THREE.MeshPhysicalMaterial => {
    if (environment) { m.envMap = environment; m.envMapIntensity = intensity; }
    return m;
  };
  switch (role) {
    case "glass-thin":
    case "glass-thick": {
      const thick = role === "glass-thick";
      const m = toPhysical(src);
      if (enclosureGlass) {
        // An instrument's glass is its enclosure, such as a balance's draft shield. three.js draws a
        // transmissive surface from a buffer of the opaque scene only, so glassware inside, itself
        // transmissive, would vanish behind transmissive panes: a watch glass on the pan could not
        // be seen. Enclosure panes are therefore blended, and drawn after the glassware.
        Object.assign(m, {
          transmission: 0, transparent: true, opacity: 0.12, roughness: 0.015, metalness: 0, ior: 1.473,
          specularIntensity: 1, side: THREE.FrontSide, depthWrite: false,
        });
        m.color.setRGB(1, 1, 1);
        return reflect(m, REFLECTION.glass);
      }
      Object.assign(m, {
        transmission: 1, roughness: 0.015, metalness: 0, ior: 1.473, specularIntensity: 1,
        thickness: thick ? 0.007 : 0.0022, attenuationDistance: thick ? 0.045 : 0.3, dispersion: thick ? 0.12 : 0.04,
        side: THREE.FrontSide, depthWrite: false,
      });
      m.color.setRGB(1, 1, 1);
      m.attenuationColor = new THREE.Color(0.86, 0.95, 0.93);
      return reflect(m, REFLECTION.glass);
    }
    case "plastic-clear": {
      const m = toPhysical(src);
      Object.assign(m, { transmission: 1, roughness: 0.03, ior: 1.59, thickness: 0.0012, side: THREE.FrontSide, depthWrite: false });
      m.color.setRGB(1, 1, 1);
      return reflect(m, REFLECTION.glass);
    }
    case "metal-brushed": {
      const m = toPhysical(src);
      Object.assign(m, { metalness: 1, roughness: 1, roughnessMap: T.brushedR, normalMap: T.brushedN, anisotropy: 0.55 });
      m.normalScale = new THREE.Vector2(0.25, 0.25);
      m.color.setRGB(0.63, 0.64, 0.65);
      return m;
    }
    case "metal": {
      const m = toPhysical(src);
      Object.assign(m, { metalness: 1, roughness: 0.34, normalMap: T.castN });
      m.normalScale = new THREE.Vector2(0.12, 0.12);
      m.color.setRGB(0.6, 0.61, 0.62);
      return m;
    }
    case "coating": {
      const m = toPhysical(src);
      Object.assign(m, { metalness: 0, roughness: 1, roughnessMap: T.peelR, normalMap: T.peelN });
      m.normalScale = new THREE.Vector2(0.45, 0.45);
      m.color.setRGB(0.014, 0.015, 0.017);
      return m;
    }
    case "rubber": {
      const m = toPhysical(src);
      m.roughness = 0.9;
      m.color.setRGB(0.018, 0.018, 0.018);
      return m;
    }
    case "plastic-opaque": {
      const m = toPhysical(src);
      if (/phenolic/i.test(name)) Object.assign(m, { roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.18 });
      else Object.assign(m, { roughness: Math.max(0.35, m.roughness), normalMap: T.peelN, normalScale: new THREE.Vector2(0.06, 0.06) });
      return m;
    }
    case "plastic-translucent": {
      const m = toPhysical(src);
      if (/LDPE natural/i.test(name)) {
        // Milky blow-moulded LDPE: frosted transmission shows contents and the dip tube as soft shapes.
        Object.assign(m, { transmission: 0.62, roughness: 0.48, metalness: 0, ior: 1.51, thickness: 0.004, attenuationDistance: 0.012,
          normalMap: T.ldpeN, side: THREE.FrontSide, specularIntensity: 0.8, sheen: 0.25, sheenRoughness: 0.6 });
        m.normalScale = new THREE.Vector2(0.5, 0.5);
        m.color.setRGB(0.96, 0.96, 0.94);
        m.attenuationColor = new THREE.Color(0.96, 0.955, 0.93);
      } else if (/delivery tube/i.test(name)) {
        Object.assign(m, { transmission: 0, roughness: 0.34, sheen: 0.4, sheenRoughness: 0.5 });
        m.color.setRGB(0.9, 0.9, 0.88);
      } else {
        Object.assign(m, { roughness: 0.38, sheen: 0.3, sheenRoughness: 0.5, normalMap: T.ldpeN });
        m.normalScale = new THREE.Vector2(0.3, 0.3);
        m.color.setRGB(0.93, 0.93, 0.92);
      }
      return m;
    }
    case "paper": {
      const m = toPhysical(src);
      Object.assign(m, { roughness: 0.93, metalness: 0, normalMap: T.paperN, sheen: 0.45, sheenRoughness: 0.85, specularIntensity: 0.35 });
      m.normalScale = new THREE.Vector2(0.7, 0.7);
      m.color.setRGB(0.8, 0.8, 0.78);
      m.sheenColor = new THREE.Color(0.9, 0.9, 0.9);
      return m;
    }
    // A print or a bottle's writing spot lies on the glass. three.js renders the opaque scene into the buffer that
    // transmissive glass samples, so an opaque print was refracted by the glass round it and showed
    // twice ("200" read "2200"). Marked transparent (fully opaque still), it stays out of that buffer
    // and is drawn once, after the glass (decided 2026-10-10).
    case "frosted": {
      const m = toPhysical(src);
      if (/polystyrene/i.test(name)) Object.assign(m, { transmission: 0.55, roughness: 0.6, ior: 1.59, thickness: 0.0012, side: THREE.FrontSide });
      else if (/marking spot/i.test(name)) Object.assign(m, { roughness: 0.95, transparent: true });
      else m.roughness = 0.95; // pipe clay: a solid part, not a mark on glass
      return m;
    }
    case "print": {
      const m = toPhysical(src);
      Object.assign(m, { roughness: 0.55, transparent: true });
      return m;
    }
    case "display": {
      const m = toPhysical(src);
      Object.assign(m, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
      m.color.setRGB(0.012, 0.015, 0.017);
      return m;
    }
    // Pack 2's Heat and Reweigh (decided 2026-10-05): glazed porcelain, a burner's brass, and its flames.
    case "porcelain": {
      const m = toPhysical(src);
      Object.assign(m, { roughness: 0.16, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.06, sheen: 0.1 });
      m.color.setRGB(0.86, 0.85, 0.82);
      return m;
    }
    // A white glazed tile under a chromatography strip (decided 2026-10-11): a cool, glossy white set well below the
    // porcelain's. Under the room's lights it still reads white, and the warm, matte paper on it reads as a strip
    // rather than vanishing white on white (G1: 0.74 left the strip 12 levels above the tile; this, 16-19).
    case "tile": {
      const m = toPhysical(src);
      Object.assign(m, { roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
      m.color.setRGB(0.64, 0.68, 0.74);
      return m;
    }
    case "brass": {
      const m = toPhysical(src);
      Object.assign(m, { metalness: 1, roughness: 0.32, normalMap: T.castN });
      m.normalScale = new THREE.Vector2(0.08, 0.08);
      m.color.setRGB(0.78, 0.58, 0.3);
      return m;
    }
    case "flame": {
      // A flame gives light and blocks none: unlit and see-through, writing no depth. It is drawn a little
      // stronger than a real flame in a lit room, which is faint against a pale bench.
      const colour = (src as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 0.6, 0.2);
      const opacity = /inner/i.test(name) ? 0.85 : /yellow/i.test(name) ? 0.75 : 0.55;
      return new THREE.MeshBasicMaterial({ name: src.name, color: colour.clone(), transparent: true, opacity,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    }
    default:
      return src;
  }
};

/**
 * Tune every mesh material under `root` once; glass neither casts nor blocks contact shadows.
 * `enclosureGlass` is set for an instrument (an entry with a display), whose glass encloses
 * glassware rather than holding contents.
 */
export const tuneMaterials = (root: THREE.Object3D, T: BenchTextures, cache: Map<THREE.Material, THREE.Material>,
  options: { enclosureGlass?: boolean; environment?: THREE.Texture } = {}): void => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.Material;
    let tuned = cache.get(src);
    if (!tuned) {
      tuned = tune(src, T, Boolean(options.enclosureGlass), options.environment);
      tuned.needsUpdate = true;
      cache.set(src, tuned);
    }
    mesh.material = tuned;
    const role = materialRole(tuned.name);
    // Marked for picking: an instrument's enclosure glass is seen through (BenchEngine.pick).
    if (options.enclosureGlass && (role === "glass-thin" || role === "glass-thick")) mesh.userData.enclosureGlass = true;
    mesh.castShadow = role !== "glass-thin" && role !== "glass-thick" && role !== "plastic-clear" && role !== "flame";
    mesh.receiveShadow = true;
  });
};
