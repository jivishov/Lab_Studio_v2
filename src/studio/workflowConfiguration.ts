import techniqueIndex from "../../public/techniques/index.json";
import {
  applyTechniqueConfigurationForComposition,
  compositionTechniqueConfigurationBlocker,
  configurationSlots,
  TechniqueConfigurationError,
  unresolvedConfigurationSlots,
} from "../data/techniqueConfiguration";
import { hostLabsForTechnique } from "../data/techniqueHosts";
import type { LabDefinition, TechniqueDefinition } from "../domain/types";
import { appendTechniqueToDraft } from "./studioState";

const catalogIds = techniqueIndex.map((entry) => entry.id).sort((a, b) => b.length - a.length);

/** Recognize the existing append allocator's <catalog-id>-<instance-number> identities. */
export const workflowSourceId = (technique: TechniqueDefinition): string =>
  catalogIds.find((id) => technique.id === id || (
    technique.id.startsWith(`${id}-`) && /^[1-9]\d*$/.test(technique.id.slice(id.length + 1))
  )) ?? technique.id;

export const workflowHostLabs = (technique: TechniqueDefinition) =>
  hostLabsForTechnique(workflowSourceId(technique));

/** This editor binds one whole workflow; selecting/reordering host subflows belongs to the compiler. */
export const workflowConfigurationBlocker = (technique: TechniqueDefinition): string | null => {
  const sourceId = workflowSourceId(technique);
  return compositionTechniqueConfigurationBlocker(sourceId === technique.id
    ? technique
    : { ...technique, id: sourceId });
};

export const workflowNeedsConfiguration = (technique: TechniqueDefinition): boolean =>
  unresolvedConfigurationSlots(technique).length > 0;

const requireApproval = (technique: TechniqueDefinition, approved: boolean): void => {
  if (configurationSlots(technique).some((slot) => slot.kind !== "internal-identifier") && approved !== true) {
    throw new TechniqueConfigurationError("Confirm that the teacher-entered settings are approved before applying them.");
  }
};

const assertConfigurable = (technique: TechniqueDefinition): void => {
  const blocker = workflowConfigurationBlocker(technique);
  if (blocker) throw new TechniqueConfigurationError(blocker);
};

export const appendConfiguredWorkflow = (
  draft: LabDefinition,
  technique: TechniqueDefinition,
  values: Readonly<Record<string, string>>,
  approved: boolean,
) => {
  assertConfigurable(technique);
  requireApproval(technique, approved);
  const configured = applyTechniqueConfigurationForComposition(technique, values);
  return appendTechniqueToDraft(draft, configured);
};

const ownedItems = <T extends { id: string }>(stored: T[], current: T[], kind: string): T[] =>
  stored.map((item) => {
    const matches = current.filter((candidate) => candidate.id === item.id);
    if (matches.length !== 1) {
      throw new TechniqueConfigurationError(`The workflow's ${kind} "${item.id}" is missing or ambiguous. Repair its ownership before configuring it.`);
    }
    return matches[0];
  });

/** Use the editable graph's current values, never restore the original appended snapshot over edits. */
export const currentWorkflowInstance = (draft: LabDefinition, instanceId: string): TechniqueDefinition => {
  const matches = draft.techniques.filter((technique) => technique.id === instanceId);
  if (matches.length !== 1) throw new TechniqueConfigurationError("The selected workflow is missing or ambiguous.");
  const technique = matches[0];
  const actionIds = new Set(technique.actions.map((action) => action.id));
  const nodeIds = new Set(technique.process.nodes.map((node) => node.id));
  const ruleIds = new Set(technique.successCriteria.map((rule) => rule.id));
  const equipmentIds = new Set(technique.initialState.equipment.map((item) => item.id));
  if (draft.techniques.some((other) => other !== technique && (
    other.actions.some((action) => actionIds.has(action.id))
    || other.process.nodes.some((node) => nodeIds.has(node.id) || (node.actionId && actionIds.has(node.actionId)))
    || other.successCriteria.some((rule) => ruleIds.has(rule.id))
    || other.initialState.equipment.some((item) => equipmentIds.has(item.id))
  ))) {
    throw new TechniqueConfigurationError("This workflow shares editable content with another instance. Repair its ownership before configuring it.");
  }
  const nodes = ownedItems(technique.process.nodes, draft.process.nodes, "step");
  if (nodes.some((node) => node.actionId && !actionIds.has(node.actionId))) {
    throw new TechniqueConfigurationError("This workflow now references another workflow's action. Review that connection before configuring it.");
  }
  return {
    ...technique,
    actions: ownedItems(technique.actions, draft.actions, "action"),
    process: {
      ...technique.process,
      nodes,
      edges: draft.process.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
    },
    successCriteria: ownedItems(technique.successCriteria, draft.assessments, "completion rule"),
    initialState: draft.initialState
      ? { equipment: ownedItems(technique.initialState.equipment, draft.initialState.equipment, "starting equipment") }
      : technique.initialState,
  };
};

/**
 * Complete one saved raw instance using the same materializer as append. Supplying defaults for
 * internal identifiers scopes names only: no classroom value or learner evidence is invented.
 * Keep the canonical id during validation so its authored cross-field constraints still apply.
 */
export const configureWorkflowInDraft = (
  draft: LabDefinition,
  instanceId: string,
  values: Readonly<Record<string, string>>,
  approved: boolean,
): LabDefinition => {
  const current = currentWorkflowInstance(draft, instanceId);
  assertConfigurable(current);
  requireApproval(current, approved);
  const identifiers = configurationSlots(current).filter((slot) => slot.kind === "internal-identifier");
  if (identifiers.length && (!current.composition || identifiers.some((slot) =>
    !current.composition?.configurationSlots.some((declaration) => declaration.id === slot.id)))) {
    throw new TechniqueConfigurationError("This saved workflow needs declared evidence identifiers before its setup can be completed.");
  }
  const defaults = new Map(identifiers.map((slot) => [slot.id, `${instanceId}-${slot.derivedValue}`]));
  const configured = applyTechniqueConfigurationForComposition({
    ...current,
    id: workflowSourceId(current),
    composition: current.composition ? {
      ...current.composition,
      configurationSlots: current.composition.configurationSlots.map((slot) => defaults.has(slot.id)
        ? { ...slot, defaultValue: defaults.get(slot.id)! }
        : slot),
    } : undefined,
  }, values);
  configured.id = instanceId;
  const actions = new Map(configured.actions.map((action) => [action.id, action]));
  const nodes = new Map(configured.process.nodes.map((node) => [node.id, node]));
  const assessments = new Map(configured.successCriteria.map((rule) => [rule.id, rule]));
  const equipment = new Map(configured.initialState.equipment.map((item) => [item.id, item]));
  let edgeIndex = 0;
  return {
    ...draft,
    techniques: draft.techniques.map((technique) => technique.id === instanceId ? configured : technique),
    actions: draft.actions.map((action) => actions.get(action.id) ?? action),
    process: {
      ...draft.process,
      nodes: draft.process.nodes.map((node) => nodes.get(node.id) ?? node),
      // External connectors and their ordering remain lab-owned.
      edges: draft.process.edges.map((edge) => nodes.has(edge.from) && nodes.has(edge.to)
        ? configured.process.edges[edgeIndex++] : edge),
    },
    assessments: draft.assessments.map((rule) => assessments.get(rule.id) ?? rule),
    initialState: draft.initialState ? {
      equipment: draft.initialState.equipment.map((item) => equipment.get(item.id) ?? item),
    } : undefined,
  };
};
