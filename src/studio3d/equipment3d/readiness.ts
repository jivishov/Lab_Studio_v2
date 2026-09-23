import registryJson from "./registry.json";
import type { Equipment3DEntry, Equipment3DRegistry } from "./types";

const fail = (path: string, expected: string): never => {
  throw new Error(`equipment3d registry: ${path} must be ${expected}.`);
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const numbers = (value: unknown, path: string, length?: number): number[] => {
  if (!Array.isArray(value) || !value.every((n) => typeof n === "number" && Number.isFinite(n))
    || (length !== undefined && value.length !== length)) {
    return fail(path, length ? `${length} finite numbers` : "finite numbers");
  }
  return value as number[];
};
const oneOf = <T extends string>(value: unknown, options: readonly T[], path: string): T =>
  (options as readonly unknown[]).includes(value) ? (value as T) : fail(path, options.join(" | "));

/**
 * Checks the generated registry against its contract. JSON imports widen string literals, so
 * the literal fields are checked here rather than by an assignment; the build-time gate remains
 * tools/blender/validate_equipment3d.py.
 */
export const parseEquipment3DRegistry = (json: unknown): Equipment3DRegistry => {
  if (!isRecord(json) || !Array.isArray(json.entries)) return fail("root", "an object with entries[]");
  json.entries.forEach((entry: unknown, i) => {
    const at = `entries[${i}]`;
    if (!isRecord(entry)) return fail(at, "an object");
    for (const key of ["definitionId", "model", "thumbnail"]) {
      if (typeof entry[key] !== "string" || !entry[key]) fail(`${at}.${key}`, "a non-empty string");
    }
    const footprint = entry.footprintMm;
    if (!isRecord(footprint)) return fail(`${at}.footprintMm`, "an object");
    const shape = oneOf(footprint.shape, ["circle", "rect"] as const, `${at}.footprintMm.shape`);
    if (shape === "circle") numbers([footprint.radius], `${at}.footprintMm.radius`, 1);
    else numbers([footprint.width, footprint.depth], `${at}.footprintMm`, 2);
    if (isRecord(entry.pour)) {
      numbers(entry.pour.lipMm, `${at}.pour.lipMm`, 3);
      if (entry.pour.style !== undefined) oneOf(entry.pour.style, ["pour", "squeeze-jet"] as const, `${at}.pour.style`);
    }
    if (isRecord(entry.fill)) {
      oneOf(entry.fill.meniscus, ["concave", "convex", "flat"] as const, `${at}.fill.meniscus`);
      if (!Array.isArray(entry.fill.innerProfileMm)) fail(`${at}.fill.innerProfileMm`, "[radius, height] pairs");
      (entry.fill.innerProfileMm as unknown[]).forEach((pair, k) => numbers(pair, `${at}.fill.innerProfileMm[${k}]`, 2));
    }
    if (entry.graduations !== null && !isRecord(entry.graduations)) fail(`${at}.graduations`, "an object or null");
    if (isRecord(entry.graduations)) oneOf(entry.graduations.unit, ["mL"] as const, `${at}.graduations.unit`);
    if (!isRecord(entry.anchors)) fail(`${at}.anchors`, "an object keyed by zone id");
    if (!Array.isArray(entry.displays)) fail(`${at}.displays`, "an array");
    if (!isRecord(entry.provenance) || typeof entry.provenance.sourceHash !== "string") {
      fail(`${at}.provenance.sourceHash`, "a string");
    }
    return undefined;
  });
  return json as unknown as Equipment3DRegistry;
};

export const equipment3dRegistry: Equipment3DRegistry = parseEquipment3DRegistry(registryJson);

const entryById = new Map<string, Equipment3DEntry>(
  equipment3dRegistry.entries.filter((entry) => !entry.scenery).map((entry) => [entry.definitionId, entry]),
);

export const equipment3dEntry = (definitionId: string): Equipment3DEntry | undefined =>
  entryById.get(definitionId);

export interface Equipment3DReadiness {
  ready: boolean;
  /** Definition ids with no 3D model yet, in the order given. */
  missing: string[];
}

/**
 * 3D readiness is necessary, never sufficient (plan §2.7, E2): every definition an activity uses
 * has a model. Setup, host-bound and custom-route rules are checked separately, by the core.
 */
export const equipment3dReadiness = (definitionIds: readonly string[]): Equipment3DReadiness => {
  const missing = [...new Set(definitionIds)].filter((id) => !entryById.has(id));
  return { ready: missing.length === 0, missing };
};

export const equipment3dAssetUrl = (file: string): string =>
  `${import.meta.env.BASE_URL}${equipment3dRegistry.assetBase}${file}`;
