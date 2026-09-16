import { bundledLabs, findLabById } from "../domain/fixtures";
import type { BundledLabSourceDefinition, LabDefinition } from "../domain/types";
import { validateBundledLabSource, validateLabDefinition } from "../domain/validation";
import { BundleContentError, isBundleResourceError } from "./bundleErrors";
import {
  assessBundledLabCatalogPolicy,
  compileBundledLabCompositionWithPolicy,
} from "./bundledCatalogPolicyBoundary";
import { hydrateBundledLab } from "./hydrateBundledLab";
import { isCompositionSource } from "../domain/compositionValidation";
import { loadBundledTechnique } from "./loadBundledTechniques";
import { fetchPublicJson } from "./publicBundle";
import { applyLabSetup, LabSetupRequired, type LabSetup } from "./labSetup";
import {
  GREEN_CHEMISTRY_LAB_ID,
  parseGreenChemistrySetup,
} from "./greenChemistrySetup";

export interface BundleSummary {
  id: string;
  title: string;
  description: string;
  file?: string;
  tags: string[];
}

interface BundleIndexEntry {
  id: string;
  title: string;
  description: string;
  file?: string;
  tags?: string[];
}

const fallbackLabSummaries = (): BundleSummary[] =>
  bundledLabs.map((lab) => ({
    id: lab.id,
    title: lab.title,
    description: lab.description,
    file: `${lab.id}.json`,
    tags: lab.metadata.tags,
  }));

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeIndex = (entries: unknown, folder: "labs" | "techniques"): BundleSummary[] => {
  if (!Array.isArray(entries)) {
    throw new BundleContentError(`${folder}/index.json must be an array.`);
  }
  const ids = new Set<string>();
  return entries.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new BundleContentError(`${folder}/index.json[${index}] must be an object.`);
    }
    const item = entry as BundleIndexEntry;
    if (!nonEmptyString(item.id) || !nonEmptyString(item.title) || !nonEmptyString(item.description)) {
      throw new BundleContentError(
        `${folder}/index.json[${index}] requires non-empty string id, title, and description.`,
      );
    }
    if (item.file !== undefined && !nonEmptyString(item.file)) {
      throw new BundleContentError(`${folder}/index.json[${index}].file must be a non-empty string when present.`);
    }
    if (ids.has(item.id)) {
      throw new BundleContentError(`${folder}/index.json repeats id "${item.id}".`);
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

let labIndexCache: Promise<BundleSummary[]> | undefined;
const labCache = new Map<string, Promise<LabDefinition>>();

export const loadBundledLabSummaries = async (): Promise<BundleSummary[]> => {
  labIndexCache ??= fetchPublicJson<unknown>("labs", "index.json").then((entries) =>
    normalizeIndex(entries, "labs"),
  );
  return labIndexCache;
};

export const bundledLabSummaries = (): BundleSummary[] => fallbackLabSummaries();

/** Only genuine resource unavailability may reach a fixture; see src/data/bundleErrors.ts. */
const fallbackLab = async (id: string, cause: unknown): Promise<LabDefinition> => {
  const fallback = findLabById(id);
  if (!fallback) throw cause;
  const validation = validateLabDefinition(fallback);
  if (!validation.ok || !validation.value) {
    throw new BundleContentError(validation.errors.join("\n"), { cause });
  }
  await assessBundledLabCatalogPolicy(
    "fixture-fallback",
    `src/domain/fixtures.ts#lab:${fallback.id}`,
    validation.value,
    true,
  );
  return validation.value;
};

export const loadBundledLab = async (id: string, setup?: LabSetup): Promise<LabDefinition> => {
  let canonicalSetup: LabSetup | undefined = setup;
  if (id === GREEN_CHEMISTRY_LAB_ID) {
    if (setup === undefined) throw new LabSetupRequired();
    canonicalSetup = parseGreenChemistrySetup(setup);
  }
  const cacheKey = JSON.stringify([id, canonicalSetup ?? null]);
  if (labCache.has(cacheKey)) return labCache.get(cacheKey)!;

  const load = (async () => {
    let source: BundledLabSourceDefinition;
    let sourceArtifact = `public/labs/${id}.json`;
    try {
      const index = await loadBundledLabSummaries();
      const summary = index.find((entry) => entry.id === id);
      if (!summary) throw new BundleContentError(`Bundled lab not found in public index: ${id}`);
      sourceArtifact = `public/labs/${summary.file ?? `${summary.id}.json`}`;
      const raw = await fetchPublicJson<unknown>("labs", summary.file ?? `${summary.id}.json`);
      const validation = validateBundledLabSource(raw);
      if (!validation.ok || !validation.value) {
        throw new BundleContentError(validation.errors.join("\n"));
      }
      if (validation.value.id !== summary.id) {
        throw new BundleContentError(
          `Public lab id "${validation.value.id}" does not match index id "${summary.id}".`,
        );
      }
      source = validation.value;
    } catch (error) {
      if (!isBundleResourceError(error)) throw error;
      // The green route is a configured composition, not a legacy fixture. Returning the fixture
      // here would skip both its exact source identity and the teacher setup binding.
      if (id === GREEN_CHEMISTRY_LAB_ID) throw error;
      return await fallbackLab(id, error);
    }

    // Past this point the public bundle is demonstrably reachable and this lab's JSON is valid, so
    // a technique that will not resolve is a broken public bundle rather than an offline client.
    // Serving the fixture copy here would hide a missing or mispinned technique behind stale content.
    try {
      if (id === GREEN_CHEMISTRY_LAB_ID && !isCompositionSource(source)) {
        throw new BundleContentError(
          `Green-chemistry lab "${id}" must remain a composition source; legacy fixture hydration is not permitted.`,
        );
      }
      if (isCompositionSource(source)) {
        return await compileBundledLabCompositionWithPolicy({
          authority: "public-bundle",
          artifact: sourceArtifact,
          catalogSource: source,
          compilationSource: applyLabSetup(source, canonicalSetup),
          resolveTechnique: loadBundledTechnique,
        });
      }
      await assessBundledLabCatalogPolicy("public-bundle", sourceArtifact, source);
      return await hydrateBundledLab(source, loadBundledTechnique);
    } catch (error) {
      if (error instanceof BundleContentError || error instanceof LabSetupRequired) throw error;
      throw new BundleContentError(
        `Lab "${id}" could not resolve its technique references: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  })();

  labCache.set(cacheKey, load);
  void load.catch(() => { labCache.delete(cacheKey); });
  return load;
};
