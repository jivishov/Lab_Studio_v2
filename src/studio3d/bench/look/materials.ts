import * as THREE from "three";
import viewerMaterials from "../../equipment3d/viewerMaterials.json";
import type { BenchTextures } from "./textures";

/**
 * Physically based material settings for equipment models, assigned by the role each glTF
 * material name has in viewerMaterials.json (the contract the Blender side is validated against).
 * Values are the prototype's look.js settings. Glass is front-sided and writes no depth, so
 * liquids drawn inside it stay visible and double-sided transmission cannot render black bands
 * (plan §6.2).
 */
type Role =
  | "glass-thin" | "glass-thick" | "frosted" | "print" | "metal-brushed" | "metal" | "coating" | "rubber"
  | "plastic-opaque" | "plastic-translucent" | "plastic-clear" | "paper" | "display";

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

const tune = (src: THREE.Material, T: BenchTextures): THREE.Material => {
  const name = src.name ?? "";
  const role = materialRole(name);
  switch (role) {
    case "glass-thin":
    case "glass-thick": {
      const thick = role === "glass-thick";
      const m = toPhysical(src);
      Object.assign(m, {
        transmission: 1, roughness: 0.015, metalness: 0, ior: 1.473, specularIntensity: 1, envMapIntensity: 1.15,
        thickness: thick ? 0.007 : 0.0022, attenuationDistance: thick ? 0.045 : 0.3, dispersion: thick ? 0.12 : 0.04,
        side: THREE.FrontSide, depthWrite: false,
      });
      m.color.setRGB(1, 1, 1);
      m.attenuationColor = new THREE.Color(0.86, 0.95, 0.93);
      return m;
    }
    case "plastic-clear": {
      const m = toPhysical(src);
      Object.assign(m, { transmission: 1, roughness: 0.03, ior: 1.59, thickness: 0.0012, side: THREE.FrontSide, depthWrite: false });
      m.color.setRGB(1, 1, 1);
      return m;
    }
    case "metal-brushed": {
      const m = toPhysical(src);
      Object.assign(m, { metalness: 1, roughness: 1, roughnessMap: T.brushedR, normalMap: T.brushedN, anisotropy: 0.55, envMapIntensity: 1 });
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
    case "frosted": {
      const m = toPhysical(src);
      if (/polystyrene/i.test(name)) Object.assign(m, { transmission: 0.55, roughness: 0.6, ior: 1.59, thickness: 0.0012, side: THREE.FrontSide });
      else m.roughness = 0.95;
      return m;
    }
    case "print": {
      const m = toPhysical(src);
      m.roughness = 0.55;
      return m;
    }
    case "display": {
      const m = toPhysical(src);
      Object.assign(m, { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
      m.color.setRGB(0.012, 0.015, 0.017);
      return m;
    }
    default:
      return src;
  }
};

/** Tune every mesh material under `root` once; glass neither casts nor blocks contact shadows. */
export const tuneMaterials = (root: THREE.Object3D, T: BenchTextures, cache: Map<THREE.Material, THREE.Material>): void => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.Material;
    let tuned = cache.get(src);
    if (!tuned) {
      tuned = tune(src, T);
      tuned.needsUpdate = true;
      cache.set(src, tuned);
    }
    mesh.material = tuned;
    const role = materialRole(tuned.name);
    mesh.castShadow = role !== "glass-thin" && role !== "glass-thick" && role !== "plastic-clear";
    mesh.receiveShadow = true;
  });
};
