import * as THREE from "three";
import type { SceneContents } from "../../adapters/runtimeToScene";
import type { Equipment3DEntry } from "../../equipment3d/types";

/**
 * Contents meshes (plan §4.4): a liquid is the model's own fill profile, cut at the level the
 * runtime's volume reaches; a solid is a low powder heap at the model's solid rest. Colours come
 * only from resolveLiquidStyle / resolveSolidStyle (the one palette, plan §2.5; G-9). Nothing is
 * drawn for empty contents. Model coordinates are millimetres, z up; meshes are built in metres,
 * y up, like the GLBs.
 */
const MM = 0.001;
const WALL_INSET_MM = 0.25;

/** "rgba(r, g, b, a)" or "#rrggbb" -> colour and alpha. */
export const parseCssColour = (value: string): { colour: THREE.Color; alpha: number } => {
  const rgba = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(value);
  if (rgba) {
    const colour = new THREE.Color().setRGB(Number(rgba[1]) / 255, Number(rgba[2]) / 255, Number(rgba[3]) / 255, THREE.SRGBColorSpace);
    return { colour, alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  }
  return { colour: new THREE.Color(value), alpha: 1 };
};

export const radiusAt = (profile: number[][], z: number): number => {
  for (let i = 0; i + 1 < profile.length; i += 1) {
    const [r0, z0] = profile[i];
    const [r1, z1] = profile[i + 1];
    if (z >= z0 && z <= z1 && z1 > z0) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
  }
  return profile[profile.length - 1]?.[0] ?? 0;
};

/**
 * The 2D player draws a liquid at its fill colour's alpha times `style.opacity`. A 3D volume seen
 * through glass needs a little more body to read at all, so that value is mapped onto 0.25–1 by a
 * strictly increasing line: any two states the palette draws differently stay different and in
 * the same order, which keeps the registry's ordinal claims (a stronger colour means more).
 */
export const liquidOpacity3D = (alpha: number, opacity: number): number =>
  0.25 + 0.75 * Math.min(1, Math.max(0, alpha * opacity));

const liquidMaterial = (fill: string, opacity: number): THREE.MeshPhysicalMaterial => {
  const { colour, alpha } = parseCssColour(fill);
  return new THREE.MeshPhysicalMaterial({
    name: "Runtime liquid",
    color: colour,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: liquidOpacity3D(alpha, opacity),
    depthWrite: false,
    envMapIntensity: 1.3,
    side: THREE.DoubleSide,
  });
};

/** A liquid body filling the profile from the floor to `levelMm`, with a meniscus ring. */
export const buildLiquid = (entry: Equipment3DEntry, contents: Extract<SceneContents, { kind: "liquid" }>): THREE.Object3D | undefined => {
  const fill = entry.fill;
  if (!fill) return undefined;
  const group = new THREE.Group();
  group.name = "contents:liquid";
  const material = liquidMaterial(contents.style.fill, contents.style.opacity);
  const level = contents.levelMm;
  if (fill.innerBoxMm) {
    const { width, depth, floorZ } = fill.innerBoxMm;
    const h = Math.max(0.2, level - floorZ);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry((width - 2 * WALL_INSET_MM) * MM, h * MM, (depth - 2 * WALL_INSET_MM) * MM), material);
    mesh.position.y = (floorZ + h / 2) * MM;
    group.add(mesh);
    return group;
  }
  const profile = fill.innerProfileMm ?? [];
  if (profile.length < 2) return undefined;
  const points: THREE.Vector2[] = [];
  for (const [r, z] of profile) {
    if (z >= level) break;
    points.push(new THREE.Vector2(Math.max(0, r - WALL_INSET_MM) * MM, z * MM));
  }
  const rTop = Math.max(0, radiusAt(profile, level) - WALL_INSET_MM);
  // A concave meniscus climbs the wall by about a millimetre; flat and convex surfaces stay level.
  const climb = fill.meniscus === "concave" ? Math.min(1.2, rTop * 0.15) : 0;
  points.push(new THREE.Vector2(rTop * MM, (level + climb) * MM));
  if (climb > 0) points.push(new THREE.Vector2(Math.max(0, rTop - 1.5) * MM, level * MM));
  points.push(new THREE.Vector2(0, level * MM));
  const body = new THREE.Mesh(new THREE.LatheGeometry(points, 64), material);
  body.renderOrder = 2;
  group.add(body);
  const meniscus = parseCssColour(contents.style.meniscus);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0, rTop - 1.2) * MM, rTop * MM, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: meniscus.colour, transparent: true, opacity: meniscus.alpha * 0.8, depthWrite: false }),
  );
  ring.position.y = (level + climb * 0.6) * MM;
  ring.renderOrder = 3;
  group.add(ring);
  return group;
};

/**
 * A source vessel's liquid while it tilts to pour (handoff §5.7): the whole inner volume, cut by a
 * world-horizontal clipping plane at the surface, so the liquid stays level however the vessel
 * turns. The open cut shows the body's back faces, which read as the surface. The caller moves
 * the plane; the colour is the same palette colour as at rest.
 */
export const buildTiltingLiquid = (
  entry: Equipment3DEntry,
  contents: Extract<SceneContents, { kind: "liquid" }>,
  surface: THREE.Plane,
): THREE.Mesh | undefined => {
  const fill = entry.fill;
  if (!fill) return undefined;
  const material = liquidMaterial(contents.style.fill, contents.style.opacity);
  material.clippingPlanes = [surface];
  let geometry: THREE.BufferGeometry;
  if (fill.innerBoxMm) {
    const { width, depth, floorZ, topZ } = fill.innerBoxMm;
    geometry = new THREE.BoxGeometry((width - 2 * WALL_INSET_MM) * MM, (topZ - floorZ) * MM, (depth - 2 * WALL_INSET_MM) * MM)
      .translate(0, ((floorZ + topZ) / 2) * MM, 0);
  } else {
    const profile = fill.innerProfileMm ?? [];
    if (profile.length < 2) return undefined;
    const points = profile.map(([r, z]) => new THREE.Vector2(Math.max(0, r - WALL_INSET_MM) * MM, z * MM));
    points.push(new THREE.Vector2(0, profile[profile.length - 1][1] * MM));
    geometry = new THREE.LatheGeometry(points, 64);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "contents:liquid";
  mesh.renderOrder = 2;
  return mesh;
};

/** A low powder heap resting where the model says solids rest. */
export const buildSolid = (entry: Equipment3DEntry, contents: Extract<SceneContents, { kind: "solid" }>): THREE.Object3D | undefined => {
  const rest = contents.restMm ?? entry.solidRest?.centreMm;
  const radius = contents.radiusMm ?? entry.solidRest?.radiusMm ?? 12;
  if (!rest) return undefined;
  const { colour } = parseCssColour(contents.style.fill);
  const heap = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.8 * MM, radius * 0.35 * MM, 40, 1, false),
    new THREE.MeshStandardMaterial({ name: "Runtime solid", color: colour, roughness: 0.9 }),
  );
  heap.name = "contents:solid";
  heap.position.set(rest[0] * MM, (rest[2] + radius * 0.35 / 2) * MM, -rest[1] * MM);
  heap.castShadow = true;
  return heap;
};

export const buildContents = (entry: Equipment3DEntry, contents: SceneContents): THREE.Object3D | undefined => {
  if (contents.kind === "liquid") return buildLiquid(entry, contents);
  if (contents.kind === "solid") return buildSolid(entry, contents);
  return undefined;
};

export const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => {
        const map = (m as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        m.dispose();
      });
    }
  });
};
