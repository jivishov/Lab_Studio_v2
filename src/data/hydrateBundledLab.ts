import type {
  ActionDefinition,
  BundledLabSourceDefinition,
  LabDefinition,
  TechniqueActionRef,
  TechniqueDefinition,
} from "../domain/types";
import {
  actionEquipmentParameterKeys,
  actionModelParameterKeys,
  validateLabDefinition,
} from "../domain/validation";
import { BundleContentError } from "./bundleErrors";

export type TechniqueResolver = (techniqueId: string) => Promise<TechniqueDefinition>;

const modelCollectionByParameterKey = {
  titrationModelId: "titrationModels",
  chromatographyModelId: "chromatographyModels",
  kineticsModelId: "kineticsModels",
} as const satisfies Record<(typeof actionModelParameterKeys)[number], keyof LabDefinition>;

const stringParameter = (
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

/**
 * Every model id the lab source owns directly or through a lab-local technique. An imported action
 * may only depend on one of these: a referenced technique contributes actions, never models, so a
 * dependency it leaves behind has to be made explicit in the lab source.
 */
const labOwnedModelIds = (
  source: BundledLabSourceDefinition,
  collection: "titrationModels" | "chromatographyModels" | "kineticsModels",
): Set<string> => {
  const ids = new Set<string>();
  const add = (models: readonly { id: string }[] | undefined): void => {
    for (const model of models ?? []) ids.add(model.id);
  };
  add(source[collection]);
  for (const technique of source.techniques) add(technique[collection]);
  return ids;
};

const equipmentIdsUsedBy = (action: ActionDefinition): string[] => {
  const parameters = action.parameters as Record<string, unknown>;
  const used = actionEquipmentParameterKeys
    .map((key) => stringParameter(parameters, key))
    .filter((value): value is string => value !== undefined);
  if (action.interaction?.sourceDefinitionId) used.push(action.interaction.sourceDefinitionId);
  if (action.interaction?.targetDefinitionId) used.push(action.interaction.targetDefinitionId);
  return [...new Set(used)];
};

/**
 * Reject an imported action whose behaviour depends on something the referenced technique owns.
 *
 * The post-hydration `validateLabDefinition` pass would also reject these, but only with a generic
 * "not available in this definition" message pointing at the resolved array. Naming the reference
 * and the missing declaration is what makes the migration in Cycles 03-04 actionable.
 */
const assertImportedDependenciesSatisfied = (
  source: BundledLabSourceDefinition,
  ref: TechniqueActionRef,
  action: ActionDefinition,
): void => {
  const where = `${ref.techniqueId}@${ref.version}#${action.id}`;
  const declaredEquipment = new Set(source.equipment);
  for (const equipmentId of equipmentIdsUsedBy(action)) {
    if (!declaredEquipment.has(equipmentId)) {
      throw new BundleContentError(
        `Imported action ${where} needs equipment "${equipmentId}", which lab "${source.id}" does not declare in lab.equipment.`,
      );
    }
  }
  const parameters = action.parameters as Record<string, unknown>;
  for (const key of actionModelParameterKeys) {
    const modelId = stringParameter(parameters, key);
    if (!modelId) continue;
    const collection = modelCollectionByParameterKey[key];
    if (!labOwnedModelIds(source, collection).has(modelId)) {
      throw new BundleContentError(
        `Imported action ${where} needs ${collection} "${modelId}", which lab "${source.id}" does not own.`,
      );
    }
  }
};

/**
 * Imported actions are cloned, never aliased.
 *
 * `loadBundledTechnique` memoizes one `TechniqueDefinition` per id, so handing its action objects
 * straight to a lab would make every lab that imports a technique share mutable state with the
 * cache and with each other. "Self-contained" has to mean the object graph too, not just the
 * absence of a `techniqueRefs` key.
 */
const selectActions = (
  ref: TechniqueActionRef,
  technique: TechniqueDefinition,
): ActionDefinition[] => {
  const clone = (action: ActionDefinition): ActionDefinition => structuredClone(action);
  if (ref.actionIds === "all") return technique.actions.map(clone);
  const available = new Map(technique.actions.map((action) => [action.id, action]));
  return ref.actionIds.map((actionId) => {
    const action = available.get(actionId);
    if (!action) {
      throw new BundleContentError(
        `Technique "${ref.techniqueId}@${ref.version}" has no action "${actionId}".`,
      );
    }
    return clone(action);
  });
};

/**
 * Resolve a raw bundled lab source into the self-contained `LabDefinition` that runtime and Studio
 * consume.
 *
 * Action order is deterministic: every `techniqueRefs` entry in declaration order, its selected
 * actions in declaration order, then the lab-local actions. Nothing else crosses the boundary — no
 * process node, edge, equipment instance, model, success criterion, or presentation string — so a
 * technique edit can change what an imported action *does*, never where the lab teaches it.
 */
export const hydrateBundledLab = async (
  source: BundledLabSourceDefinition,
  resolveTechnique: TechniqueResolver,
): Promise<LabDefinition> => {
  const imported: ActionDefinition[] = [];
  const importedBy = new Map<string, string>();

  for (const ref of source.techniqueRefs ?? []) {
    const technique = await resolveTechnique(ref.techniqueId);
    if (technique.id !== ref.techniqueId) {
      throw new BundleContentError(
        `Technique reference "${ref.techniqueId}" resolved to technique "${technique.id}".`,
      );
    }
    if (technique.metadata.version !== ref.version) {
      throw new BundleContentError(
        `Technique "${ref.techniqueId}" is version ${technique.metadata.version}, but lab "${source.id}" pins ${ref.version}.`,
      );
    }
    for (const action of selectActions(ref, technique)) {
      const previous = importedBy.get(action.id);
      if (previous) {
        throw new BundleContentError(
          `Action "${action.id}" is imported by both "${previous}" and "${ref.techniqueId}" in lab "${source.id}".`,
        );
      }
      assertImportedDependenciesSatisfied(source, ref, action);
      importedBy.set(action.id, ref.techniqueId);
      imported.push(action);
    }
  }

  const local = new Set<string>();
  for (const action of source.actions) {
    if (local.has(action.id)) {
      throw new BundleContentError(
        `Lab "${source.id}" declares action "${action.id}" more than once.`,
      );
    }
    if (importedBy.has(action.id)) {
      throw new BundleContentError(
        `Lab "${source.id}" declares action "${action.id}", which it also imports from technique "${importedBy.get(action.id)}".`,
      );
    }
    local.add(action.id);
  }

  // The resolved definition must carry no unresolved reference: this is the point where the raw
  // source contract ends and the runtime/Studio/export contract begins.
  const hydrated: BundledLabSourceDefinition = {
    ...source,
    actions: [...imported, ...source.actions],
  };
  delete hydrated.techniqueRefs;

  const resolvedActionIds = new Set(hydrated.actions.map((action) => action.id));
  for (const node of hydrated.process.nodes) {
    if (node.actionId && !resolvedActionIds.has(node.actionId)) {
      throw new BundleContentError(
        `Lab "${source.id}" process node "${node.id}" references action "${node.actionId}", which is neither imported nor lab-local.`,
      );
    }
  }

  const validation = validateLabDefinition(hydrated);
  if (!validation.ok || !validation.value) {
    throw new BundleContentError(
      `Hydrated lab "${source.id}" failed validation:\n${validation.errors.join("\n")}`,
    );
  }
  return validation.value;
};
