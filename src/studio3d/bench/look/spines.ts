import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FAR_SPINE_Z, SPINE, SPINE_Z } from "./hall";

/**
 * The island spines beyond our station (the lab room, phase 1, 2026-10-16): more sections of the reagent shelf's model
 * over the neighbouring station, each with the lattice rods and an iron ring, and along the far island's spine without
 * them. Our own section is the shelf BenchEngine places; these are scenery only (G-8), never picked.
 *
 * Each spine is merged by material from the loaded models (one draw call per material), with its own clones of the
 * models' materials, so the cutaway can fade it alone. The clones lose the room-lighting patch (a clone keeps
 * `userData` but not `onBeforeCompile`), so their flags are cleared and `applyRoomLighting` patches them again. They
 * cast no shadows.
 */
export interface Spines {
  neighbour: THREE.Group;
  far: THREE.Group;
  dispose: () => void;
}

/** Geometry of every mesh under `model`, in the model's frame, by material. */
const partsOf = (model: THREE.Object3D) => {
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  const parts: Array<{ material: THREE.Material; geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }> = [];
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    parts.push({ material: mesh.material, geometry: mesh.geometry, matrix: inverse.clone().multiply(mesh.matrixWorld) });
  });
  return parts;
};

/** A copy with only position, normal and uv, non-indexed, transformed: so any parts merge. */
const normalised = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {};
  g.clearGroups();
  return g.applyMatrix4(matrix);
};

const ownMaterial = (source: THREE.Material) => {
  const m = source.clone();
  delete m.userData.roomLit;
  delete m.userData.roomOccluded;
  delete m.userData.cutawayOpacity;
  return m;
};

export const buildSpines = (shelf: THREE.Object3D, rods: THREE.Object3D | null): Spines => {
  const disposables: Array<{ dispose: () => void }> = [];
  const spine = (name: string, placements: Array<{ model: THREE.Object3D; at: THREE.Vector3 }>) => {
    const group = new THREE.Group();
    group.name = name;
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const { model, at } of placements) {
      const place = new THREE.Matrix4().makeTranslation(at.x, at.y, at.z);
      for (const part of partsOf(model)) {
        const list = byMaterial.get(part.material) ?? [];
        list.push(normalised(part.geometry, place.clone().multiply(part.matrix)));
        byMaterial.set(part.material, list);
      }
    }
    byMaterial.forEach((list, source) => {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) return;
      const material = ownMaterial(source);
      disposables.push(merged, material);
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${name}: ${source.name || "material"}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.raycast = () => undefined; // scenery is never picked (G-8)
      group.add(mesh);
    });
    return group;
  };
  const neighbour = spine("scenery: neighbour spine", SPINE.neighbour.flatMap((x) => {
    const at = new THREE.Vector3(x, 0, SPINE_Z);
    return rods ? [{ model: shelf, at }, { model: rods, at }] : [{ model: shelf, at }];
  }));
  const far = spine("scenery: far spine", SPINE.far.map((x) => ({ model: shelf, at: new THREE.Vector3(x, 0, FAR_SPINE_Z) })));
  return { neighbour, far, dispose: () => disposables.forEach((d) => d.dispose()) };
};
