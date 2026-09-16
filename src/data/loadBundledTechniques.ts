import { findTechniqueById, standaloneTechniques } from "../domain/fixtures";
import type { TechniqueDefinition } from "../domain/types";
import { validateTechniqueDefinition } from "../domain/validation";
import { BundleContentError, isBundleResourceError } from "./bundleErrors";
import { assessBundledTechniqueCatalogPolicy } from "./bundledCatalogPolicyBoundary";
import { fetchPublicJson } from "./publicBundle";
import type { BundleSummary } from "./loadBundledLabs";

interface BundleIndexEntry {
  id: string;
  title: string;
  description: string;
  file?: string;
  tags?: string[];
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeIndex = (entries: unknown): BundleSummary[] => {
  if (!Array.isArray(entries)) {
    throw new BundleContentError("techniques/index.json must be an array.");
  }
  const ids = new Set<string>();
  return entries.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new BundleContentError(`techniques/index.json[${index}] must be an object.`);
    }
    const item = entry as BundleIndexEntry;
    if (!nonEmptyString(item.id) || !nonEmptyString(item.title) || !nonEmptyString(item.description)) {
      throw new BundleContentError(
        `techniques/index.json[${index}] requires non-empty string id, title, and description.`,
      );
    }
    if (item.file !== undefined && !nonEmptyString(item.file)) {
      throw new BundleContentError(`techniques/index.json[${index}].file must be a non-empty string when present.`);
    }
    if (ids.has(item.id)) {
      throw new BundleContentError(`techniques/index.json repeats id "${item.id}".`);
    }
    ids.add(item.id);
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      file: item.file ?? `${item.id}.json`,
      tags: item.tags ?? [],
    };
  });
};

const fallbackTechniqueSummaries = (): BundleSummary[] =>
  standaloneTechniques.map((technique) => ({
    id: technique.id,
    title: technique.title,
    description: technique.learningGoal,
    file: `${technique.id}.json`,
    tags: technique.metadata.tags,
  }));

let techniqueIndexCache: Promise<BundleSummary[]> | undefined;
const techniqueCache = new Map<string, Promise<TechniqueDefinition>>();

export const loadBundledTechniqueSummaries = async (): Promise<BundleSummary[]> => {
  techniqueIndexCache ??= fetchPublicJson<unknown>("techniques", "index.json").then(normalizeIndex);
  return techniqueIndexCache;
};

export const bundledTechniqueSummaries = (): BundleSummary[] => fallbackTechniqueSummaries();

export const loadBundledTechnique = async (id: string): Promise<TechniqueDefinition> => {
  if (techniqueCache.has(id)) return techniqueCache.get(id)!;

  const load = (async () => {
    try {
      const index = await loadBundledTechniqueSummaries();
      const summary = index.find((entry) => entry.id === id);
      if (!summary) {
        throw new BundleContentError(`Bundled technique not found in public index: ${id}`);
      }
      const technique = await fetchPublicJson<unknown>(
        "techniques",
        summary.file ?? `${summary.id}.json`,
      );
      const validation = validateTechniqueDefinition(technique);
      if (!validation.ok || !validation.value) {
        throw new BundleContentError(validation.errors.join("\n"));
      }
      if (validation.value.id !== summary.id) {
        throw new BundleContentError(
          `Public technique id "${validation.value.id}" does not match index id "${summary.id}".`,
        );
      }
      await assessBundledTechniqueCatalogPolicy(
        "public-bundle",
        `public/techniques/${summary.file ?? `${summary.id}.json`}`,
        validation.value,
      );
      return validation.value;
    } catch (error) {
      // Only genuine resource unavailability may reach a fixture; see src/data/bundleErrors.ts.
      if (!isBundleResourceError(error)) throw error;
      const fallback = findTechniqueById(id);
      if (!fallback) throw error;
      const validation = validateTechniqueDefinition(fallback);
      if (!validation.ok || !validation.value) {
        throw new BundleContentError(validation.errors.join("\n"), { cause: error });
      }
      await assessBundledTechniqueCatalogPolicy(
        "fixture-fallback",
        `src/domain/fixtures.ts#technique:${fallback.id}`,
        validation.value,
        true,
      );
      return validation.value;
    }
  })();

  techniqueCache.set(id, load);
  return load;
};
