/**
 * Read-only adapter for F02 composition-aware diagnostics.
 *
 * The imported collector and evaluator are side-effect-free. This adapter owns catalog reads only;
 * callers decide whether and how to print results, compare baselines, or exit non-zero.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectCompiledWitnesses } from "../src/data/collectCompiledWitnesses.ts";
import { prepareCycle12WitnessSource } from "../src/data/cycle12WitnessSetup.ts";
import { evaluateCompiledWitnessDiagnostics } from "../src/data/compiledWitnessDiagnostics.ts";
import {
  BUNDLED_CATALOG_POLICY_DIAGNOSTIC,
  bundledLabSurfaces,
  bundledTechniqueSurface,
  evaluateBundledCatalogPolicy,
  evaluateCompiledBundledCatalogPolicy,
} from "../src/domain/bundledCatalogPolicy.ts";
import { bundledLabs, standaloneTechniques } from "../src/domain/fixtures.ts";

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isCompositionSource = (value) => isObject(value) &&
  Array.isArray(value.techniqueInstances) &&
  Array.isArray(value.compositionConnections) &&
  Array.isArray(value.reachabilityWitnesses);
const isTechniqueDefinition = (value) => isObject(value) &&
  typeof value.id === "string" &&
  isObject(value.metadata) &&
  typeof value.metadata.version === "string" &&
  Array.isArray(value.actions) &&
  isObject(value.process);

const readJsonAt = async (root, relativePath) =>
  JSON.parse(await readFile(join(root, relativePath), "utf8"));

const normalizeIndex = (entries, folder) => {
  if (!Array.isArray(entries)) {
    throw new Error(`public/${folder}/index.json must be an array.`);
  }
  const ids = new Set();
  return entries.map((entry, index) => {
    if (!isObject(entry)) {
      throw new Error(`public/${folder}/index.json[${index}] must be an object.`);
    }
    if (!nonEmptyString(entry.id) || !nonEmptyString(entry.title) || !nonEmptyString(entry.description)) {
      throw new Error(`public/${folder}/index.json[${index}] requires non-empty string id, title, and description.`);
    }
    if (entry.file !== undefined && !nonEmptyString(entry.file)) {
      throw new Error(`public/${folder}/index.json[${index}].file must be a non-empty string when present.`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`public/${folder}/index.json repeats id "${entry.id}".`);
    }
    ids.add(entry.id);
    return { ...entry, file: entry.file ?? `${entry.id}.json` };
  });
};

/**
 * Load indexed composition sources and every standalone technique surface without producing an
 * artifact. `readJson` and `listFiles` make fixture callers independent from a real filesystem.
 */
export const runCompiledContentDiagnostics = async ({
  root = defaultRoot,
  readJson = (relativePath) => readJsonAt(root, relativePath),
  listFiles = async (relativePath) => readdir(join(root, relativePath)),
} = {}) => {
  const [labIndex, techniqueIndex, techniqueFiles] = await Promise.all([
    readJson("public/labs/index.json"),
    readJson("public/techniques/index.json"),
    listFiles("public/techniques"),
  ]);
  const indexedLabEntries = normalizeIndex(labIndex, "labs");
  const indexedTechniqueIndex = normalizeIndex(techniqueIndex, "techniques");
  const indexedTechniqueEntries = new Map(indexedTechniqueIndex.map((entry) => [entry.id, entry]));
  const discoveredDefinitionsByFile = new Map();
  const techniqueById = new Map();
  const techniqueSurfaces = [];
  const catalogPolicySurfaces = [];

  for (const file of techniqueFiles.filter((candidate) => candidate.endsWith(".json") && candidate !== "index.json").sort()) {
    const definition = await readJson(`public/techniques/${file}`);
    if (!isTechniqueDefinition(definition)) continue;
    discoveredDefinitionsByFile.set(file, definition);
    techniqueSurfaces.push({
      id: definition.id,
      version: definition.metadata.version,
      indexed: indexedTechniqueEntries.get(definition.id)?.file === file ||
        (!indexedTechniqueEntries.get(definition.id)?.file && file === `${definition.id}.json`),
      path: `public/techniques/${file}`,
      actionIds: definition.actions.map((action) => action.id),
    });
  }

  const techniqueResolutionErrors = new Map();
  for (const entry of indexedTechniqueIndex) {
    const file = entry.file;
    const definition = discoveredDefinitionsByFile.get(file);
    if (!definition) {
      techniqueResolutionErrors.set(
        entry.id,
        `Technique ${entry.id} is indexed at public/techniques/${file}, but that file is absent or not a recognizable technique definition.`,
      );
      continue;
    }
    if (definition.id !== entry.id) {
      techniqueResolutionErrors.set(
        entry.id,
        `Technique index id ${entry.id} points to public/techniques/${file}, whose definition id is ${definition.id}.`,
      );
      continue;
    }
    if (techniqueById.has(entry.id)) {
      techniqueResolutionErrors.set(entry.id, `Technique index repeats id ${entry.id}.`);
      techniqueById.delete(entry.id);
      continue;
    }
    techniqueById.set(entry.id, definition);
    catalogPolicySurfaces.push(
      bundledTechniqueSurface("public-bundle", `public/techniques/${file}`, definition),
    );
  }

  const legacyTechniqueIds = new Set();
  const labs = [];
  const nonCompositionIndexedLabs = [];
  for (const entry of indexedLabEntries) {
    const file = entry.file;
    const source = await readJson(`public/labs/${file}`);
    if (!isObject(source) || !nonEmptyString(source.id)) {
      throw new Error(`Lab index id ${entry.id} points to public/labs/${file}, which has no non-empty string definition id.`);
    }
    if (source.id !== entry.id) {
      throw new Error(`Lab index id ${entry.id} points to public/labs/${file}, whose definition id is ${source.id}.`);
    }
    if (Array.isArray(source?.actions) && Array.isArray(source?.techniques)) {
      catalogPolicySurfaces.push(...bundledLabSurfaces("public-bundle", `public/labs/${file}`, source));
    }
    for (const reference of source.techniqueRefs ?? []) legacyTechniqueIds.add(reference.techniqueId);
    if (!isCompositionSource(source)) {
      nonCompositionIndexedLabs.push(source.id ?? entry.id);
      continue;
    }
    const collection = await collectCompiledWitnesses({
      source,
      prepareSource: prepareCycle12WitnessSource,
      resolveTechnique: async (techniqueId) => {
        const resolutionError = techniqueResolutionErrors.get(techniqueId);
        if (resolutionError) throw new Error(resolutionError);
        const technique = techniqueById.get(techniqueId);
        if (!technique) {
          const entryForTechnique = indexedTechniqueEntries.get(techniqueId);
          if (!entryForTechnique) {
            throw new Error(`Technique ${techniqueId} is not present in public/techniques/index.json.`);
          }
          throw new Error(`Technique ${techniqueId} is indexed but its definition was not found in public/techniques.`);
        }
        return structuredClone(technique);
      },
    });
    labs.push({ source, collection });
  }

  for (const technique of standaloneTechniques) {
    catalogPolicySurfaces.push(
      bundledTechniqueSurface(
        "fixture-fallback",
        `src/domain/fixtures.ts#technique:${technique.id}`,
        technique,
        "fixture-technique",
      ),
    );
  }
  for (const lab of bundledLabs) {
    catalogPolicySurfaces.push(
      ...bundledLabSurfaces("fixture-fallback", `src/domain/fixtures.ts#lab:${lab.id}`, lab, true),
    );
  }

  const result = evaluateCompiledWitnessDiagnostics({
    labs,
    techniques: [...techniqueById.values()],
    techniqueSurfaces,
    legacyTechniqueIds: [...legacyTechniqueIds],
  });
  const rawCatalogPolicy = await evaluateBundledCatalogPolicy(catalogPolicySurfaces, {
    migrationScope: "complete-inventory",
    mode: BUNDLED_CATALOG_POLICY_DIAGNOSTIC,
  });
  const compiledCatalogPolicyFindings = (
    await Promise.all(labs.map(({ source, collection }) => evaluateCompiledBundledCatalogPolicy({
      source,
      collection,
      techniques: [...techniqueById.values()],
    })))
  ).flat();
  return {
    ...result,
    catalogPolicy: {
      schemaVersion: rawCatalogPolicy.schemaVersion,
      evaluationMode: rawCatalogPolicy.evaluationMode,
      raw: rawCatalogPolicy,
      compiledFindings: compiledCatalogPolicyFindings,
      failureCount:
        rawCatalogPolicy.blockingFindings.length +
        rawCatalogPolicy.migrationIssues.length +
        compiledCatalogPolicyFindings.length,
    },
    catalog: {
      indexedLabCount: indexedLabEntries.length,
      indexedCompositionLabCount: labs.length,
      nonCompositionIndexedLabIds: nonCompositionIndexedLabs.sort(),
      indexedTechniqueCount: indexedTechniqueIndex.length,
      discoveredTechniqueSurfaceCount: techniqueSurfaces.length,
    },
  };
};
