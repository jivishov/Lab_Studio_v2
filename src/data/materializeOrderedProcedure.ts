import type { ActionParameterValue, TechniqueDefinition } from "../domain/types";
import { BundleContentError } from "./bundleErrors";

/** Expand only canonical declared subflows; setup cannot supply actions or edges. */
export const materializeOrderedProcedure = (source: TechniqueDefinition, configuration: Record<string, ActionParameterValue>): TechniqueDefinition => {
  const plan = source.composition?.orderedProcedure;
  if (!plan) return source;
  const reject = (message: string): never => { throw new BundleContentError(`${source.id} approved procedure: ${message}`); };
  if (source.process.edges.some((edge) => edge.condition.type !== "validationPassed") ||
      source.process.nodes.some((node) => source.process.edges.filter((edge) => edge.from === node.id).length > 1 || source.process.edges.filter((edge) => edge.to === node.id).length > 1)) return reject("scientific branches cannot be flattened by an ordered procedure.");
  const raw = configuration[plan.configurationSlotId];
  if (typeof raw !== "string" || !raw.trim()) return reject("select and order the declared procedure groups before compilation.");
  const selected = raw.split(",").map((id) => id.trim());
  if (new Set(selected).size !== selected.length) return reject("each selected group needs a distinct evidence path.");
  const groups = selected.map((id) => plan.groups.find((group) => group.id === id) ?? reject(`unknown group ${id}`));
  if (plan.selectionCount && configuration[plan.selectionCount.configurationSlotId] !== plan.selectionCount.baseCount + selected.filter((id) => plan.selectionCount!.groupIds.includes(id)).length) return reject("selected procedure count does not match the approved configuration.");
  const families = groups.map((group) => group.family).filter((family): family is string => Boolean(family));
  if (new Set(families).size !== families.length || plan.requiredFamilies?.some((family) => !families.includes(family))) return reject("select exactly one alternative for each required procedure family.");
  if (groups.reduce((sum, group) => sum + group.testCount, 0) < plan.minimumTests) return reject(`select at least ${plan.minimumTests} tests/trials.`);
  if (plan.requireMixedEvidence && (!groups.some((group) => group.evidenceKind === "quantitative") || !groups.some((group) => group.evidenceKind === "qualitative"))) return reject("include both qualitative and quantitative tests.");
  groups.forEach((group, index) => {
    for (const required of group.requiresSelected ?? []) if (!selected.includes(required)) reject(`${group.id} requires the matching ${required} subflow.`);
    for (const required of group.requiresEarlier ?? []) if (selected.includes(required) && selected.indexOf(required) >= index) reject(`${required} must precede ${group.id} to preserve specimen state.`);
  });
  const ids = [...plan.startActionIds];
  const prepared = new Set<string>();
  groups.forEach((group, index) => {
    const resource = plan.resources.find((item) => item.id === group.resourceId);
    if (resource && !prepared.has(resource.id)) { ids.push(...resource.prepareActionIds); prepared.add(resource.id); }
    ids.push(...group.actionIds);
    if (resource && !groups.slice(index + 1).some((item) => item.resourceId === resource.id)) ids.push(...resource.cleanupActionIds);
  });
  ids.push(...plan.endActionIds);
  if (new Set(ids).size !== ids.length) return reject("the declared subflows overlap action ownership.");
  const result = structuredClone(source);
  const actions = new Map(result.actions.map((action) => [action.id, action]));
  const nodes = new Map(result.process.nodes.map((node) => [node.actionId, node]));
  result.actions = ids.map((id) => actions.get(id) ?? reject(`missing canonical action ${id}`));
  result.process.nodes = ids.map((id) => nodes.get(id) ?? reject(`missing canonical process node ${id}`));
  const aliases = Object.assign({}, ...groups.map((group) => group.actionAliases ?? {})) as Record<string, string>;
  const rewriteAliases = (value: unknown, key = ""): unknown => {
    if (typeof value === "string") return /ActionIds?$|^actionId$/.test(key) ? aliases[value] ?? value : value;
    if (Array.isArray(value)) return value.map((item) => rewriteAliases(item, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [childKey, rewriteAliases(item, childKey)]));
    return value;
  };
  result.actions = result.actions.map((action) => ({ ...action, prerequisites: rewriteAliases(action.prerequisites) as typeof action.prerequisites, parameters: rewriteAliases(action.parameters) as typeof action.parameters }));
  const included = new Set(ids);
  result.actions.forEach((action, index) => {
    // Generated sequence-only guards are replaced; scientific prerequisites remain authoritative.
    action.prerequisites = action.prerequisites.filter((rule) => {
      if (!rule.id.endsWith("--previous-action")) return true;
      if (rule.type !== "actionEvidence" || !rule.actionId || Object.keys(rule).some((key) => !["id", "type", "actionId", "label"].includes(key))) reject(`${action.id} mislabels a scientific prerequisite as a sequence guard.`);
      return false;
    });
    for (const rule of action.prerequisites) if (rule.actionId && (!included.has(rule.actionId) || ids.indexOf(rule.actionId) >= index)) reject(`${action.id} needs earlier prerequisite ${rule.actionId}`);
    if (index) action.prerequisites.push({ id: `${action.id}--approved-sequence`, type: "actionEvidence", actionId: ids[index - 1], label: "Complete the preceding approved procedure operation." });
  });
  result.process.startNodeId = result.process.nodes[0].id;
  result.process.edges = result.process.nodes.slice(1).map((node, index) => ({ from: result.process.nodes[index].id, to: node.id, label: "Approved procedure", condition: { type: "validationPassed" } }));
  for (const port of result.composition!.ports) port.nodeId = port.kind === "entry" ? result.process.nodes[0].id : result.process.nodes[result.process.nodes.length - 1].id;
  result.composition!.legacyActionEffects = result.composition!.legacyActionEffects?.filter((item) => included.has(item.actionId));
  result.composition!.evidenceOutputs = result.composition!.evidenceOutputs.filter((item) => included.has(item.actionId));
  return result;
};
