import type {
  ActionDefinition,
  ActionParameterValue,
  CompositionAssessmentSourceRef,
  CompositionEndpoint,
  CompositionManifest,
  CompositionReachabilityWitness,
  LabCompositionSourceDefinition,
  LabDefinition,
  ProcessEdge,
  ProcessNode,
  TechniqueCompositionContract,
  TechniqueDefinition,
  TechniqueInstanceRef,
  TechniqueVariantPredicate,
  ValidationRule,
} from "../domain/types";
import {
  createConcreteEquipmentMappingTracker,
  validateInstanceBindings,
  validateTechniqueCompositionContract,
} from "../domain/compositionValidation";
import { validateLabCompositionSource, validateLabDefinition } from "../domain/validation";
import { materializeOrderedProcedure } from "./materializeOrderedProcedure";
import { BundleContentError } from "./bundleErrors";
import type { TechniqueResolver } from "./hydrateBundledLab";

export const COMPOSITION_COMPILER_CONTRACT_VERSION = "1.6" as const;
const MAX_COMPILED_ACTIONS = 10_000;
const MAX_COMPILED_NODES = 10_000;

export interface CompileLabCompositionOptions {
  witnessId?: string;
  status?: CompositionManifest["status"];
}

interface ExpandedInstance {
  source: TechniqueInstanceRef;
  technique: TechniqueDefinition;
  contract: TechniqueCompositionContract;
  repeatIndex: number;
  scopeId: string;
  actionIds: Map<string, string>;
  nodeIds: Map<string, string>;
  validationRuleIds: Map<string, string>;
  configuration: Record<string, ActionParameterValue>;
}

const fail = (messages: readonly string[]): never => {
  throw new BundleContentError(`Lab composition failed:\n${messages.join("\n")}`);
};

const uniqueId = (
  proposed: string,
  kind: string,
  owner: string,
  seen: Map<string, string>,
): string => {
  const previous = seen.get(proposed);
  if (previous) fail([`Ambiguous compiled ${kind} id "${proposed}" from ${previous} and ${owner}.`]);
  seen.set(proposed, owner);
  return proposed;
};

const scopedId = (
  sourceId: string,
  scopeId: string,
  preserve: Record<string, string> | undefined,
): string => preserve?.[sourceId] ?? `${scopeId}--${sourceId}`;

const scopedReference = (
  value: string | undefined,
  scopeId: string,
  configuration: Readonly<Record<string, ActionParameterValue>>,
  preserve: Readonly<Record<string, string>> = {},
): string | undefined => {
  if (!value) return undefined;
  const placeholder = /^\{\{config\.([a-zA-Z0-9_-]+)\}\}$/.exec(value);
  const configured = placeholder ? configuration[placeholder[1]] : undefined;
  if (configured !== undefined) {
    if (typeof configured === "string") return configured;
    return fail([`Configuration slot "${placeholder![1]}" must bind a string reference.`]);
  }
  return preserve[value] ?? (value.startsWith(`${scopeId}--`) ? value : `${scopeId}--${value}`);
};

const rewriteRule = (
  rule: ValidationRule,
  actionIds: ReadonlyMap<string, string>,
  validationRuleIds: ReadonlyMap<string, string>,
  scopeId: string,
  configuration: Readonly<Record<string, ActionParameterValue>>,
  references: Readonly<Record<string, string>>,
  equipmentInstances: ReadonlyMap<string, string>,
  boundEquipmentInstanceIds: ReadonlySet<string>,
): ValidationRule => {
  const rewritten = structuredClone(rule);
  rewritten.id = validationRuleIds.get(rule.id) ?? fail([`Unresolved technique validation rule id "${rule.id}".`]);
  if (rule.actionId !== undefined) {
    rewritten.actionId = actionIds.get(rule.actionId) ?? fail([
      `Unresolved technique action reference "${rule.actionId}" in validation rule "${rule.id}".`,
    ]);
  }
  for (const key of ["measurementId", "notebookTag", "calculationId", "dataSeriesId"] as const) {
    if (rule[key] !== undefined) rewritten[key] = scopedReference(rule[key], scopeId, configuration, references);
  }
  // A `measurementRecorded` rule may carry a continuity tuple naming the producer action, the
  // balance support and the material source. `rewriteBoundValue` already resolves those key
  // shapes elsewhere, but this function replaces the whole rule from the unrewritten original, so
  // without this block the tuple would keep technique-local identities and silently stop matching
  // whenever a lab renames an action or binds a role to a differently named instance.
  if (rule.measurementContinuity !== undefined) {
    const continuity = rule.measurementContinuity;
    const resolveInstance = (instanceId: string, field: string): string => {
      const mapped = equipmentInstances.get(instanceId);
      if (mapped) return mapped;
      if (boundEquipmentInstanceIds.has(instanceId)) return instanceId;
      return fail([
        `Unresolved technique equipment instance reference "${instanceId}" in validation rule "${rule.id}" ${field}.`,
      ]);
    };
    rewritten.measurementContinuity = {
      ...continuity,
      producerActionId: actionIds.get(continuity.producerActionId) ?? fail([
        `Unresolved technique action reference "${continuity.producerActionId}" in validation rule "${rule.id}" measurementContinuity.`,
      ]),
      measuredSupportInstanceId: resolveInstance(continuity.measuredSupportInstanceId, "measuredSupportInstanceId"),
      ...(continuity.materialSourceInstanceId !== undefined
        ? { materialSourceInstanceId: resolveInstance(continuity.materialSourceInstanceId, "materialSourceInstanceId") }
        : {}),
    };
  }
  return rewritten;
};

const replacePresentation = (
  value: string,
  presentation: Readonly<Record<string, string>>,
  path: string,
  allowedPaths: readonly string[],
): string => value.replace(/\{\{presentation\.([a-zA-Z0-9_-]+)\}\}/g, (match, key: string) => {
  const allowed = allowedPaths.some((candidate) => {
    const pattern = `^${candidate.split(".").map((part) => part === "*" ? "[^.]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\.")}$`;
    return new RegExp(pattern).test(path);
  });
  if (!allowed) fail([`Presentation binding "${key}" is not allowlisted for path "${path}".`]);
  const replacement = presentation[key];
  if (replacement === undefined) fail([`Missing presentation binding "${key}".`]);
  return replacement;
});

const rewriteBoundValue = (
  value: unknown,
  key: string,
  maps: {
    equipmentDefinitions: ReadonlyMap<string, string>;
    equipmentInstances: ReadonlyMap<string, string>;
    standaloneEquipmentInstanceIds: ReadonlySet<string>;
    boundEquipmentInstanceIds: ReadonlySet<string>;
    models: ReadonlyMap<string, string>;
    sourceModelIds: ReadonlySet<string>;
    boundModelIds: ReadonlySet<string>;
    configuration: Readonly<Record<string, ActionParameterValue>>;
    presentation: Readonly<Record<string, string>>;
    presentationPaths: readonly string[];
    scopeId: string;
    actionIds: ReadonlyMap<string, string>;
    nodeIds: ReadonlyMap<string, string>;
    references: Readonly<Record<string, string>>;
  },
  path = key,
): unknown => {
  if (Array.isArray(value)) return value.map((item, index) => rewriteBoundValue(item, key, maps, `${path}.${index}`));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        rewriteBoundValue(child, childKey, maps, path ? `${path}.${childKey}` : childKey),
      ]),
    );
  }
  if (typeof value !== "string") return value;
  let stringValue = value;
  const configuration = /^\{\{config\.([a-zA-Z0-9_-]+)\}\}$/.exec(stringValue);
  if (configuration) {
    const replacement = maps.configuration[configuration[1]];
    if (replacement === undefined) fail([`Missing configuration binding "${configuration[1]}".`]);
    if (typeof replacement !== "string") {
      if (/(?:Definition|Instance|Model|Action|Node|Measurement|Calculation|Evidence|DataSeries|Reference|Output|Progress)Ids?$/.test(key)) {
        return fail([`Configuration slot "${configuration[1]}" must bind a string identity at "${path}".`]);
      }
      return replacement;
    }
    if (/(?:Definition|Instance|Model|Action|Node|Measurement|Calculation|Evidence|DataSeries|Reference|Output|Progress)Ids?$/.test(key) ||
      /NotebookTag$/i.test(key) || key === "tag" || new Set([
        "sourceMeasurements", "timeMeasurements", "measuredComponentMassIds", "tareMassIds",
        "repeatGroupId", "nextScopeId", "pairId", "systemId",
      ]).has(key)) {
      // A string identity supplied by the lab is already a lab-owned/global reference. Scoping it
      // again would sever cross-instance evidence bindings such as measured volume -> calculation.
      return replacement;
    }
    stringValue = replacement;
  }
  if (/DefinitionIds?$/.test(key)) return maps.equipmentDefinitions.get(stringValue) ?? stringValue;
  if (/InstanceIds?$/.test(key) || key === "timerId") {
    const mapped = maps.equipmentInstances.get(stringValue);
    if (mapped) return mapped;
    if (maps.boundEquipmentInstanceIds.has(stringValue)) return stringValue;
    if (maps.standaloneEquipmentInstanceIds.has(stringValue)) {
      return fail([`Unbound standalone equipment instance reference "${stringValue}" at "${path}".`]);
    }
    return fail([`Unrecognized concrete lab equipment instance reference "${stringValue}" at "${path}".`]);
  }
  if (/ModelIds?$/.test(key)) {
    const mapped = maps.models.get(stringValue);
    if (mapped) return mapped;
    if (maps.boundModelIds.has(stringValue)) return stringValue;
    if (maps.sourceModelIds.has(stringValue)) return fail([`Unbound standalone model reference "${stringValue}" at "${path}".`]);
    return fail([`Unrecognized lab model reference "${stringValue}" at "${path}".`]);
  }
  if (/ActionIds?$/.test(key) || key === "actionId") {
    return maps.actionIds.get(stringValue) ?? fail([`Unresolved technique action reference "${stringValue}" at "${path}".`]);
  }
  if (/NodeIds?$/.test(key) || key === "nodeId") {
    return maps.nodeIds.get(stringValue) ?? fail([`Unresolved technique node reference "${stringValue}" at "${path}".`]);
  }
  if (/MeasurementIds?$/i.test(key) || /CalculationIds?$/i.test(key) || /ReferenceIds?$/i.test(key) || /OutputIds?$/i.test(key) || /ProgressIds?$/i.test(key) ||
    /EvidenceId$/i.test(key) || /EvidenceScopeId$/i.test(key) || /NotebookTag$/i.test(key) || key === "tag" ||
    /DataSeriesIds?$/i.test(key) || new Set([
      "sourceMeasurements", "timeMeasurements", "measuredComponentMassIds", "tareMassIds",
      "repeatGroupId", "nextScopeId", "pairId", "systemId",
    ]).has(key)) {
    return maps.references[stringValue] ??
      (stringValue.startsWith(`${maps.scopeId}--`) ? stringValue : `${maps.scopeId}--${stringValue}`);
  }
  return replacePresentation(stringValue, maps.presentation, path, maps.presentationPaths);
};

const bindingMaps = (expanded: ExpandedInstance) => {
  const equipmentDefinitions = new Map<string, string>();
  const equipmentDefinitionsByRole = new Map<string, Map<string, string>>();
  const equipmentInstances = new Map<string, string>();
  const concreteMappings = createConcreteEquipmentMappingTracker();
  const registerInstance = (sourceInstanceId: string, targetInstanceId: string, owner: string): void => {
    const conflict = concreteMappings.reserve(sourceInstanceId, targetInstanceId, owner);
    if (conflict?.endpoint === "source") {
      fail([`Instance "${expanded.scopeId}" source equipment instance "${sourceInstanceId}" maps to both "${conflict.priorTargetInstanceId}" by ${conflict.priorOwner} and "${targetInstanceId}" by ${owner}.`]);
    }
    if (conflict?.endpoint === "target") {
      fail([`Instance "${expanded.scopeId}" target equipment instance "${targetInstanceId}" receives both source "${conflict.priorSourceInstanceId}" by ${conflict.priorOwner} and source "${sourceInstanceId}" by ${owner}.`]);
    }
    equipmentInstances.set(sourceInstanceId, targetInstanceId);
  };
  const registerDefinition = (roleId: string, sourceDefinitionId: string, targetDefinitionId: string): void => {
    const roleMap = equipmentDefinitionsByRole.get(roleId) ?? new Map<string, string>();
    const previousForRole = roleMap.get(sourceDefinitionId);
    if (previousForRole && previousForRole !== targetDefinitionId) {
      fail([`Instance "${expanded.scopeId}" role "${roleId}" maps source equipment definition "${sourceDefinitionId}" to both "${previousForRole}" and "${targetDefinitionId}".`]);
    }
    roleMap.set(sourceDefinitionId, targetDefinitionId);
    equipmentDefinitionsByRole.set(roleId, roleMap);
    const previous = equipmentDefinitions.get(sourceDefinitionId);
    if (previous && previous !== targetDefinitionId) {
      fail([`Instance "${expanded.scopeId}" maps source equipment definition "${sourceDefinitionId}" to both "${previous}" and "${targetDefinitionId}".`]);
    }
    equipmentDefinitions.set(sourceDefinitionId, targetDefinitionId);
  };
  for (const requirement of expanded.contract.equipmentRoles) {
    const binding = expanded.source.bindings.equipment[requirement.roleId];
    if (!binding) continue;
    const sourceDefinitionIds = new Set(expanded.technique.actions.flatMap((action) => {
      const definitionId = action.equipmentRoleBindings?.[requirement.roleId];
      return definitionId ? [definitionId] : [];
    }));
    if (Array.isArray(binding.sourceInstances)) {
      for (const mapping of binding.sourceInstances) {
        const sourceInstance = expanded.technique.initialState.equipment.find(
          (instance) => instance.id === mapping.sourceInstanceId,
        ) ?? fail([`Instance "${expanded.scopeId}" role "${requirement.roleId}" references missing standalone equipment instance "${mapping.sourceInstanceId}".`]);
        registerDefinition(requirement.roleId, sourceInstance.definitionId, mapping.definitionId);
        registerInstance(sourceInstance.id, mapping.instanceId, `role "${requirement.roleId}"`);
      }
    } else {
      const targetDefinitionId = binding.definitionId ?? fail([
        `Instance "${expanded.scopeId}" role "${requirement.roleId}" has an invalid single equipment binding.`,
      ]);
      const targetInstanceId = binding.instanceId ?? fail([
        `Instance "${expanded.scopeId}" role "${requirement.roleId}" has an invalid single equipment binding.`,
      ]);
      for (const sourceDefinitionId of sourceDefinitionIds) {
        registerDefinition(requirement.roleId, sourceDefinitionId, targetDefinitionId);
      }
      const sourceInstances = requirement.sourceInstanceIds
        ? requirement.sourceInstanceIds.map((instanceId) =>
          expanded.technique.initialState.equipment.find((instance) => instance.id === instanceId) ?? fail([
            `Instance "${expanded.scopeId}" role "${requirement.roleId}" references missing standalone equipment instance "${instanceId}".`,
          ]))
        : expanded.technique.initialState.equipment.filter((instance) => sourceDefinitionIds.has(instance.definitionId));
      if (!requirement.sourceInstanceIds && sourceInstances.length > 1) {
        fail([
          `Instance "${expanded.scopeId}" role "${requirement.roleId}" matches multiple standalone equipment instances; declare sourceInstanceIds in the technique contract.`,
        ]);
      }
      for (const sourceInstance of sourceInstances) {
        registerInstance(sourceInstance.id, targetInstanceId, `role "${requirement.roleId}"`);
      }
    }
  }
  const models = new Map<string, string>();
  for (const slot of expanded.contract.modelSlots) {
    const bound = expanded.source.bindings.models[slot.id];
    if (bound) {
      const previous = models.get(slot.sourceModelId);
      if (previous && previous !== bound) {
        fail([`Instance "${expanded.scopeId}" maps source model "${slot.sourceModelId}" to both "${previous}" and "${bound}".`]);
      }
      models.set(slot.sourceModelId, bound);
    }
  }
  return {
    equipmentDefinitions,
    equipmentDefinitionsByRole,
    equipmentInstances,
    standaloneEquipmentInstanceIds: new Set(expanded.technique.initialState.equipment.map((instance) => instance.id)),
    boundEquipmentInstanceIds: new Set(Object.values(expanded.source.bindings.equipment).flatMap((binding) =>
      Array.isArray(binding.sourceInstances)
        ? binding.sourceInstances.map((mapping) => mapping.instanceId)
        : binding.instanceId ? [binding.instanceId] : [])),
    models,
    sourceModelIds: new Set([
      ...(expanded.technique.titrationModels ?? []).map((model) => model.id),
      ...(expanded.technique.chromatographyModels ?? []).map((model) => model.id),
      ...(expanded.technique.kineticsModels ?? []).map((model) => model.id),
    ]),
    boundModelIds: new Set(Object.values(expanded.source.bindings.models)),
    configuration: expanded.configuration,
    presentation: expanded.source.bindings.presentation ?? {},
    presentationPaths: expanded.contract.presentationPaths ?? [],
    scopeId: expanded.scopeId,
    actionIds: expanded.actionIds,
    nodeIds: expanded.nodeIds,
    references: expanded.source.preserveIds?.references ?? {},
  };
};

const rewriteAction = (expanded: ExpandedInstance, action: ActionDefinition): ActionDefinition => {
  const maps = bindingMaps(expanded);
  const rewritten = rewriteBoundValue(structuredClone(action), "", maps) as ActionDefinition;
  rewritten.id = expanded.actionIds.get(action.id)!;
  rewritten.prerequisites = action.prerequisites.map((rule) =>
    rewriteRule(rule, expanded.actionIds, expanded.validationRuleIds, expanded.scopeId, maps.configuration, maps.references,
      maps.equipmentInstances, maps.boundEquipmentInstanceIds));
  if (action.equipmentRoleBindings) {
    rewritten.equipmentRoleBindings = Object.fromEntries(
      Object.entries(action.equipmentRoleBindings).map(([roleId, sourceDefinitionId]) => [
        roleId,
        maps.equipmentDefinitionsByRole.get(roleId)?.get(sourceDefinitionId) ?? sourceDefinitionId,
      ]),
    );
  }
  // Compiler-issued technique effects are always derived from atom/handler contracts, never copied
  // from a source-local claim. The public flat action need not duplicate the registry.
  delete rewritten.effect;
  return rewritten;
};

const rewriteNode = (expanded: ExpandedInstance, node: ProcessNode): ProcessNode => {
  const maps = bindingMaps(expanded);
  const rewritten = rewriteBoundValue(structuredClone(node), "", maps) as ProcessNode;
  rewritten.id = expanded.nodeIds.get(node.id)!;
  if (node.actionId !== undefined) {
    rewritten.actionId = expanded.actionIds.get(node.actionId) ?? fail([
      `Unresolved technique action reference "${node.actionId}" in process node "${node.id}".`,
    ]);
  }
  rewritten.validation = node.validation.map((rule) => rewriteRule(
    rule,
    expanded.actionIds,
    expanded.validationRuleIds,
    expanded.scopeId,
    maps.configuration,
    maps.references,
    maps.equipmentInstances,
    maps.boundEquipmentInstanceIds,
  ));
  return rewritten;
};

const rewriteInternalEdge = (expanded: ExpandedInstance, edge: ProcessEdge): ProcessEdge => {
  const rewritten = structuredClone(edge);
  rewritten.from = expanded.nodeIds.get(edge.from)!;
  rewritten.to = expanded.nodeIds.get(edge.to)!;
  if (edge.condition.calculationId !== undefined) {
    rewritten.condition.calculationId = scopedReference(
      edge.condition.calculationId,
      expanded.scopeId,
      expanded.configuration,
      expanded.source.preserveIds?.references,
    );
  }
  return rewritten;
};

const witnessEnablesPredicate = (
  predicate: TechniqueInstanceRef["enabledWhen"],
  witness: CompositionReachabilityWitness,
  configurations: ReadonlyMap<string, Readonly<Record<string, ActionParameterValue>>>,
): boolean => {
  if (!predicate) return true;
  if (predicate.kind === "approval") {
    return witness.approvalGates[`${predicate.instanceId}.${predicate.gateId}`] === predicate.equals;
  }
  return configurations.get(predicate.instanceId)?.[predicate.slotId] === predicate.equals;
};

const configurationForWitness = (
  instance: TechniqueInstanceRef,
  technique: TechniqueDefinition,
  witness: CompositionReachabilityWitness,
): Record<string, ActionParameterValue> => Object.fromEntries(
  (technique.composition?.configurationSlots ?? []).map((slot) => [
    slot.id,
    witness.configuration[`${instance.instanceId}.${slot.id}`] ??
      instance.bindings.configuration[slot.id] ??
      slot.defaultValue,
  ]),
) as Record<string, ActionParameterValue>;

const witnessEnablesVariant = (
  predicate: TechniqueVariantPredicate | undefined,
  instanceId: string,
  witness: CompositionReachabilityWitness,
  configuration: Readonly<Record<string, ActionParameterValue>>,
): boolean => {
  if (!predicate) return true;
  if (predicate.kind === "approval") {
    return witness.approvalGates[`${instanceId}.${predicate.gateId}`] === predicate.equals;
  }
  return configuration[predicate.slotId] === predicate.equals;
};

const witnessEnablesInstance = (
  instance: TechniqueInstanceRef,
  technique: TechniqueDefinition,
  witness: CompositionReachabilityWitness,
  configurations: ReadonlyMap<string, Readonly<Record<string, ActionParameterValue>>>,
): boolean => {
  if (!witnessEnablesPredicate(instance.enabledWhen, witness, configurations)) return false;
  const variant = instance.variantId
    ? technique.composition?.variants.find((candidate) => candidate.id === instance.variantId)
    : undefined;
  return witnessEnablesVariant(
    variant?.enabledWhen,
    instance.instanceId,
    witness,
    configurations.get(instance.instanceId) ?? {},
  );
};

const endpointNodeId = (
  endpoint: CompositionEndpoint,
  expandedByKey: ReadonlyMap<string, ExpandedInstance>,
  localNodeIds: ReadonlySet<string>,
  direction: "from" | "to",
): string => {
  if (endpoint.kind === "lab-node") {
    if (!localNodeIds.has(endpoint.nodeId)) fail([`Composition connection references missing lab node "${endpoint.nodeId}".`]);
    return endpoint.nodeId;
  }
  if (endpoint.repeatIndex === undefined) {
    const matchingInstances = [...expandedByKey.keys()].filter((key) => key.startsWith(`${endpoint.instanceId}#`));
    if (matchingInstances.length > 1) {
      fail([`Composition connection endpoint for repeated instance "${endpoint.instanceId}" requires repeatIndex.`]);
    }
  }
  const key = `${endpoint.instanceId}#${endpoint.repeatIndex ?? 0}`;
  const expanded = expandedByKey.get(key) ??
    fail([`Composition connection references inactive or missing instance "${key}".`]);
  const port = expanded.contract.ports.find((candidate) => candidate.id === endpoint.portId) ??
    fail([`Instance "${key}" has no composition port "${endpoint.portId}".`]);
  const expectedKind = direction === "from" ? "exit" : "entry";
  if (port.kind !== expectedKind) {
    fail([`Composition connection ${direction} endpoint "${key}/${port.id}" must use a ${expectedKind} port.`]);
  }
  return expanded.nodeIds.get(port.nodeId)!;
};

const reachableNodeIds = (startNodeId: string, edges: readonly ProcessEdge[]): Set<string> => {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  const reached = new Set<string>();
  const pending = [startNodeId];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (reached.has(current)) continue;
    reached.add(current);
    pending.push(...(outgoing.get(current) ?? []));
  }
  return reached;
};

const reserveValidationRuleIds = (
  actions: readonly ActionDefinition[],
  nodes: readonly ProcessNode[],
  assessments: readonly ValidationRule[],
): void => {
  const owners = new Map<string, string>();
  const reserve = (rule: ValidationRule, owner: string): void => {
    uniqueId(rule.id, "validation rule", owner, owners);
  };
  actions.forEach((action) => action.prerequisites.forEach((rule) =>
    reserve(rule, `action "${action.id}" prerequisite "${rule.id}"`)));
  nodes.forEach((node) => node.validation.forEach((rule) =>
    reserve(rule, `node "${node.id}" validation "${rule.id}"`)));
  assessments.forEach((rule) => reserve(rule, `assessment "${rule.id}"`));
};

const assessmentRefKey = (
  instanceId: string,
  repeatIndex: number,
  ruleId: string,
): string => `${instanceId}#${repeatIndex}#${ruleId}`;

const composeAssessments = (
  source: LabCompositionSourceDefinition,
  expanded: readonly ExpandedInstance[],
  techniques: ReadonlyMap<string, TechniqueDefinition>,
): ValidationRule[] => {
  const rewriteCriterion = (item: ExpandedInstance, rule: ValidationRule): ValidationRule => {
    const maps = bindingMaps(item);
    return rewriteRule(
      rule,
      item.actionIds,
      item.validationRuleIds,
      item.scopeId,
      maps.configuration,
      maps.references,
      maps.equipmentInstances,
      maps.boundEquipmentInstanceIds,
    );
  };
  if (!source.compositionAssessmentOrder) {
    return [
      ...expanded.flatMap((item) => item.technique.successCriteria.map((rule) => rewriteCriterion(item, rule))),
      ...structuredClone(source.assessments),
    ];
  }

  const criteria = new Map<string, { item: ExpandedInstance; rule: ValidationRule }>();
  for (const item of expanded) {
    for (const rule of item.technique.successCriteria) {
      criteria.set(assessmentRefKey(item.source.instanceId, item.repeatIndex, rule.id), { item, rule });
    }
  }
  const declaredCriteria = new Set<string>();
  for (const instance of source.techniqueInstances) {
    const technique = techniques.get(instance.instanceId) ?? fail([
      `compositionAssessmentOrder cannot resolve technique instance "${instance.instanceId}".`,
    ]);
    for (let repeatIndex = 0; repeatIndex < (instance.repeat ?? 1); repeatIndex += 1) {
      for (const rule of technique.successCriteria) {
        declaredCriteria.add(assessmentRefKey(instance.instanceId, repeatIndex, rule.id));
      }
    }
  }
  const labAssessments = new Map(source.assessments.map((rule) => [rule.id, rule]));
  const accountedCriteria = new Set<string>();
  const accountedLabRows = new Set<string>();
  const output: ValidationRule[] = [];

  const resolveCriterion = (
    ref: Omit<Extract<CompositionAssessmentSourceRef, { kind: "technique-success-criterion" }>, "kind">,
    owner: string,
  ): { key: string; item: ExpandedInstance; rule: ValidationRule } | undefined => {
    const declaredInstance = source.techniqueInstances.find((instance) => instance.instanceId === ref.instanceId);
    if ((declaredInstance?.repeat ?? 1) > 1 && ref.repeatIndex === undefined) {
      fail([`${owner} requires repeatIndex for repeated instance "${ref.instanceId}".`]);
    }
    const repeatIndex = ref.repeatIndex ?? 0;
    const key = assessmentRefKey(ref.instanceId, repeatIndex, ref.ruleId);
    if (!declaredCriteria.has(key)) fail([
      `${owner} references unknown technique success criterion "${ref.instanceId}#${repeatIndex}.${ref.ruleId}".`,
    ]);
    if (accountedCriteria.has(key)) fail([`${owner} accounts for technique success criterion "${key}" more than once.`]);
    accountedCriteria.add(key);
    const criterion = criteria.get(key);
    if (!criterion) return undefined;
    return { key, ...criterion };
  };

  source.compositionAssessmentOrder.forEach((entry, index) => {
    const owner = `compositionAssessmentOrder[${index}]`;
    if (entry.kind === "technique-success-criterion") {
      const criterion = resolveCriterion(entry, owner);
      if (criterion) output.push(rewriteCriterion(criterion.item, criterion.rule));
      return;
    }
    const rule = labAssessments.get(entry.ruleId) ?? fail([
      `${owner} references missing lab assessment "${entry.ruleId}".`,
    ]);
    if (accountedLabRows.has(entry.ruleId)) fail([`${owner} emits lab assessment "${entry.ruleId}" more than once.`]);
    accountedLabRows.add(entry.ruleId);
    if (entry.substitutes) {
      const substitution = resolveCriterion(entry.substitutes, `${owner}.substitutes`);
      if (substitution) {
        const explicitlyPreserved = substitution.item.source.preserveIds?.validationRules?.[substitution.rule.id];
        if (explicitlyPreserved !== undefined && explicitlyPreserved !== rule.id) {
          fail([
            `${owner}.substitutes conflicts with preserved validation rule id "${explicitlyPreserved}"; expected "${rule.id}".`,
          ]);
        }
        substitution.item.validationRuleIds.set(substitution.rule.id, rule.id);
      }
    }
    output.push(structuredClone(rule));
  });

  const missingCriteria = [...declaredCriteria].filter((key) => !accountedCriteria.has(key));
  const missingLabRows = [...labAssessments.keys()].filter((id) => !accountedLabRows.has(id));
  if (missingCriteria.length > 0 || missingLabRows.length > 0) {
    fail([
      ...(missingCriteria.length > 0
        ? [`compositionAssessmentOrder does not account for declared technique criteria: ${missingCriteria.join(", ")}.`]
        : []),
      ...(missingLabRows.length > 0
        ? [`compositionAssessmentOrder does not emit lab assessments: ${missingLabRows.join(", ")}.`]
        : []),
    ]);
  }
  return output;
};

const validateWitnessAgainstContracts = (
  source: LabCompositionSourceDefinition,
  techniques: ReadonlyMap<string, TechniqueDefinition>,
): string[] => {
  const errors: string[] = [];
  const instanceById = new Map(source.techniqueInstances.map((instance) => [instance.instanceId, instance]));
  const validatePredicate = (
    predicate: TechniqueInstanceRef["enabledWhen"],
    path: string,
  ): void => {
    if (!predicate) return;
    const instance = instanceById.get(predicate.instanceId);
    const technique = instance ? techniques.get(instance.instanceId) : undefined;
    if (!instance || !technique?.composition) {
      errors.push(`${path} references unknown technique instance "${predicate.instanceId}".`);
      return;
    }
    if (predicate.kind === "configuration") {
      const slot = technique.composition.configurationSlots.find((candidate) => candidate.id === predicate.slotId);
      if (!slot) errors.push(`${path} references undeclared configuration slot "${predicate.instanceId}.${predicate.slotId}".`);
      else if (typeof predicate.equals !== slot.valueType ||
        (slot.allowedValues && !slot.allowedValues.includes(predicate.equals))) {
        errors.push(`${path} has an invalid configured predicate value.`);
      }
      return;
    }
    if (!technique.composition.approvalGates.some((gate) => gate.id === predicate.gateId)) {
      errors.push(`${path} references undeclared approval gate "${predicate.instanceId}.${predicate.gateId}".`);
    }
  };
  source.techniqueInstances.forEach((instance) =>
    validatePredicate(instance.enabledWhen, `Instance "${instance.instanceId}" enabledWhen`));
  source.compositionConnections.forEach((connection, index) =>
    validatePredicate(connection.enabledWhen, `Composition connection ${index} enabledWhen`));
  const localNodeIds = new Set(source.process.nodes.map((node) => node.id));
  if (source.compositionStart) {
    const endpoint = source.compositionStart;
    if (endpoint.kind === "lab-node") {
      if (!localNodeIds.has(endpoint.nodeId)) errors.push(`compositionStart references missing lab node "${endpoint.nodeId}".`);
    } else {
      const instance = instanceById.get(endpoint.instanceId);
      const technique = instance ? techniques.get(instance.instanceId) : undefined;
      const port = technique?.composition?.ports.find((candidate) => candidate.id === endpoint.portId);
      if (!instance || !technique?.composition) errors.push(`compositionStart references missing technique instance "${endpoint.instanceId}".`);
      else if (endpoint.repeatIndex !== undefined &&
        (endpoint.repeatIndex < 0 || endpoint.repeatIndex >= (instance.repeat ?? 1))) {
        errors.push(`compositionStart has an out-of-range repeatIndex for instance "${endpoint.instanceId}".`);
      } else if (!port) errors.push(`compositionStart references missing port "${endpoint.instanceId}/${endpoint.portId}".`);
      else if (port.kind !== "entry") errors.push(`compositionStart must use an entry port.`);
    }
  }
  source.compositionConnections.forEach((connection, index) => {
    ([
      [connection.from, "from"],
      [connection.to, "to"],
    ] as const).forEach(([endpoint, direction]) => {
      if (endpoint.kind === "lab-node") {
        if (!localNodeIds.has(endpoint.nodeId)) {
          errors.push(`Composition connection ${index} references missing lab node "${endpoint.nodeId}".`);
        }
        return;
      }
      const instance = instanceById.get(endpoint.instanceId);
      const technique = instance ? techniques.get(instance.instanceId) : undefined;
      if (!instance || !technique?.composition) {
        errors.push(`Composition connection ${index} references missing technique instance "${endpoint.instanceId}".`);
        return;
      }
      if (endpoint.repeatIndex !== undefined &&
        (!Number.isInteger(endpoint.repeatIndex) || endpoint.repeatIndex < 0 || endpoint.repeatIndex >= (instance.repeat ?? 1))) {
        errors.push(`Composition connection ${index} has an out-of-range repeatIndex for instance "${endpoint.instanceId}".`);
      }
      const port = technique.composition.ports.find((candidate) => candidate.id === endpoint.portId);
      if (!port) {
        errors.push(`Composition connection ${index} references missing port "${endpoint.instanceId}/${endpoint.portId}".`);
      } else {
        const expectedKind = direction === "from" ? "exit" : "entry";
        if (port.kind !== expectedKind) {
          errors.push(`Composition connection ${index} ${direction} endpoint must use a ${expectedKind} port.`);
        }
      }
    });
  });

  for (const witness of source.reachabilityWitnesses) {
    const configurations = new Map(source.techniqueInstances.map((instance) => [
      instance.instanceId,
      configurationForWitness(instance, techniques.get(instance.instanceId)!, witness),
    ]));
    for (const [key, value] of Object.entries(witness.configuration)) {
      const split = key.lastIndexOf(".");
      const instanceId = split > 0 ? key.slice(0, split) : "";
      const slotId = split > 0 ? key.slice(split + 1) : "";
      const instance = instanceById.get(instanceId);
      const technique = instance ? techniques.get(instance.instanceId) : undefined;
      const slot = technique?.composition?.configurationSlots.find((candidate) => candidate.id === slotId);
      if (!slot) errors.push(`Witness "${witness.id}" references undeclared configuration slot "${key}".`);
      else if (typeof value !== slot.valueType || (slot.allowedValues && !slot.allowedValues.includes(value))) {
        errors.push(`Witness "${witness.id}" has an invalid value for configuration slot "${key}".`);
      }
    }
    for (const key of Object.keys(witness.approvalGates)) {
      const split = key.lastIndexOf(".");
      const instanceId = split > 0 ? key.slice(0, split) : "";
      const gateId = split > 0 ? key.slice(split + 1) : "";
      const instance = instanceById.get(instanceId);
      const technique = instance ? techniques.get(instance.instanceId) : undefined;
      if (!technique?.composition?.approvalGates.some((gate) => gate.id === gateId)) {
        errors.push(`Witness "${witness.id}" references undeclared approval gate "${key}".`);
      }
    }
    for (const instance of source.techniqueInstances) {
      const technique = techniques.get(instance.instanceId)!;
      for (const slot of technique.composition?.configurationSlots ?? []) {
        const value = configurations.get(instance.instanceId)?.[slot.id];
        if (slot.required && value === undefined) {
          errors.push(`Witness "${witness.id}" leaves required configuration slot "${instance.instanceId}.${slot.id}" unbound.`);
        } else if (value !== undefined && (typeof value !== slot.valueType ||
          (slot.allowedValues && !slot.allowedValues.some((candidate) => candidate === value)))) {
          errors.push(`Witness "${witness.id}" has an invalid effective value for "${instance.instanceId}.${slot.id}".`);
        }
      }
      const variant = instance.variantId
        ? technique.composition?.variants.find((candidate) => candidate.id === instance.variantId)
        : undefined;
      if (variant?.enabledWhen.kind === "approval") {
        const key = `${instance.instanceId}.${variant.enabledWhen.gateId}`;
        if (!(key in witness.approvalGates)) errors.push(`Witness "${witness.id}" omits approval gate "${key}" used by selected variant "${variant.id}".`);
      }
    }
    const usedApprovalPredicates = [
      ...source.techniqueInstances.map((instance) => instance.enabledWhen),
      ...source.compositionConnections.map((connection) => connection.enabledWhen),
    ].filter((predicate): predicate is Exclude<TechniqueInstanceRef["enabledWhen"], undefined> => Boolean(predicate));
    for (const predicate of usedApprovalPredicates) {
      if (predicate.kind !== "approval") continue;
      const key = `${predicate.instanceId}.${predicate.gateId}`;
      if (!(key in witness.approvalGates)) errors.push(`Witness "${witness.id}" omits approval gate "${key}" used by a branch predicate.`);
    }

    const instanceEnabled = new Map(source.techniqueInstances.map((instance) => [
      instance.instanceId,
      witnessEnablesInstance(instance, techniques.get(instance.instanceId)!, witness, configurations),
    ]));
    if (source.compositionStart?.kind === "technique-port" &&
      instanceEnabled.get(source.compositionStart.instanceId) !== true) {
      errors.push(`Witness "${witness.id}" makes compositionStart instance "${source.compositionStart.instanceId}" inactive.`);
    }
    source.compositionConnections.forEach((connection, index) => {
      if (!witnessEnablesPredicate(connection.enabledWhen, witness, configurations)) return;
      for (const endpoint of [connection.from, connection.to]) {
        if (endpoint.kind === "technique-port" && instanceEnabled.get(endpoint.instanceId) !== true) {
          errors.push(`Witness "${witness.id}" enables composition connection ${index} while endpoint instance "${endpoint.instanceId}" is inactive.`);
        }
      }
    });
  }
  for (const instance of source.techniqueInstances) {
    const enabled = source.reachabilityWitnesses.some((witness) => {
      const configurations = new Map(source.techniqueInstances.map((candidate) => [
        candidate.instanceId,
        configurationForWitness(candidate, techniques.get(candidate.instanceId)!, witness),
      ]));
      return witnessEnablesInstance(instance, techniques.get(instance.instanceId)!, witness, configurations);
    });
    if (!enabled) errors.push(`Technique instance "${instance.instanceId}" is dead under every internally valid witness.`);
  }
  source.compositionConnections.forEach((connection, index) => {
    const enabled = source.reachabilityWitnesses.some((witness) => {
      const configurations = new Map(source.techniqueInstances.map((instance) => [
        instance.instanceId,
        configurationForWitness(instance, techniques.get(instance.instanceId)!, witness),
      ]));
      if (!witnessEnablesPredicate(connection.enabledWhen, witness, configurations)) return false;
      return [connection.from, connection.to].every((endpoint) => {
        if (endpoint.kind === "lab-node") return true;
        const instance = instanceById.get(endpoint.instanceId);
        const technique = techniques.get(endpoint.instanceId);
        return Boolean(instance && technique &&
          witnessEnablesInstance(instance, technique, witness, configurations));
      });
    });
    if (!enabled) errors.push(`Composition connection ${index} is dead under every internally valid witness.`);
  });
  const branchCoverage: Array<{ label: string; outcomes: boolean[] }> = [];
  source.techniqueInstances.forEach((instance) => {
    if (instance.enabledWhen) {
      branchCoverage.push({
        label: `instance "${instance.instanceId}" enabledWhen`,
        outcomes: source.reachabilityWitnesses.map((witness) => {
          const configurations = new Map(source.techniqueInstances.map((candidate) => [
            candidate.instanceId,
            configurationForWitness(candidate, techniques.get(candidate.instanceId)!, witness),
          ]));
          return witnessEnablesPredicate(instance.enabledWhen, witness, configurations);
        }),
      });
    }
    const variant = instance.variantId
      ? techniques.get(instance.instanceId)?.composition?.variants.find((candidate) => candidate.id === instance.variantId)
      : undefined;
    if (variant) {
      branchCoverage.push({
        label: `instance "${instance.instanceId}" variant "${variant.id}"`,
        outcomes: source.reachabilityWitnesses.map((witness) =>
          witnessEnablesVariant(
            variant.enabledWhen,
            instance.instanceId,
            witness,
            configurationForWitness(instance, techniques.get(instance.instanceId)!, witness),
          )),
      });
    }
  });
  source.compositionConnections.forEach((connection, index) => {
    if (!connection.enabledWhen) return;
    branchCoverage.push({
      label: `composition connection ${index} enabledWhen`,
      outcomes: source.reachabilityWitnesses.map((witness) => {
        const configurations = new Map(source.techniqueInstances.map((instance) => [
          instance.instanceId,
          configurationForWitness(instance, techniques.get(instance.instanceId)!, witness),
        ]));
        return witnessEnablesPredicate(connection.enabledWhen, witness, configurations);
      }),
    });
  });
  for (const branch of branchCoverage) {
    if (!branch.outcomes.includes(true) || !branch.outcomes.includes(false)) {
      errors.push(`Reachability witnesses do not cover both outcomes of ${branch.label}.`);
    }
  }
  return errors;
};

export const compileLabComposition = async (
  source: LabCompositionSourceDefinition,
  resolveTechnique: TechniqueResolver,
  options: CompileLabCompositionOptions = {},
): Promise<LabDefinition> => {
  const shape = validateLabCompositionSource(source);
  if (!shape.ok) fail(shape.errors);
  const witness = (options.witnessId
    ? source.reachabilityWitnesses.find((candidate) => candidate.id === options.witnessId)
    : source.reachabilityWitnesses[0]) ??
    fail([`Reachability witness "${options.witnessId}" does not exist.`]);

  const techniques = new Map<string, TechniqueDefinition>();
  for (const instance of source.techniqueInstances) {
    const technique = await resolveTechnique(instance.techniqueId);
    if (technique.id !== instance.techniqueId) {
      fail([`Instance "${instance.instanceId}" requested technique "${instance.techniqueId}" but resolved "${technique.id}".`]);
    }
    if (technique.metadata.version !== instance.version) {
      fail([`Instance "${instance.instanceId}" pins ${instance.techniqueId}@${instance.version}, but the resolver returned ${technique.metadata.version}.`]);
    }
    const contract = validateTechniqueCompositionContract(technique);
    if (!contract.ok) fail(contract.errors.map((error) => `Instance "${instance.instanceId}": ${error}`));
    const bindingErrors = validateInstanceBindings(source, instance, technique);
    if (bindingErrors.length > 0) fail(bindingErrors);
    techniques.set(instance.instanceId, materializeOrderedProcedure(technique, configurationForWitness(instance, technique, witness)));
  }
  const witnessErrors = validateWitnessAgainstContracts(source, techniques);
  if (witnessErrors.length > 0) fail(witnessErrors);
  const selectedConfigurations = new Map(source.techniqueInstances.map((instance) => [
    instance.instanceId,
    configurationForWitness(instance, techniques.get(instance.instanceId)!, witness),
  ]));

  const actionOwners = new Map(source.actions.map((action) => [action.id, `lab-local action "${action.id}"`]));
  const nodeOwners = new Map(source.process.nodes.map((node) => [node.id, `lab-local node "${node.id}"`]));
  if (actionOwners.size !== source.actions.length) fail([`Lab "${source.id}" repeats a local action id.`]);
  if (nodeOwners.size !== source.process.nodes.length) fail([`Lab "${source.id}" repeats a local node id.`]);
  const expanded: ExpandedInstance[] = [];
  const expandedByKey = new Map<string, ExpandedInstance>();
  for (const instance of source.techniqueInstances) {
    const technique = techniques.get(instance.instanceId)!;
    if (!witnessEnablesInstance(instance, technique, witness, selectedConfigurations)) continue;
    const contract = technique.composition!;
    const repeat = instance.repeat ?? 1;
    if (repeat > 1 && (instance.preserveIds?.actions || instance.preserveIds?.nodes ||
      instance.preserveIds?.validationRules || instance.preserveIds?.references)) {
      fail([`Repeated instance "${instance.instanceId}" cannot preserve unscoped legacy ids.`]);
    }
    for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
      const scopeId = repeat === 1 ? instance.instanceId : `${instance.instanceId}--${repeatIndex + 1}`;
      const item: ExpandedInstance = {
        source: instance,
        technique,
        contract,
        repeatIndex,
        scopeId,
        actionIds: new Map(),
        nodeIds: new Map(),
        validationRuleIds: new Map(),
        configuration: { ...(selectedConfigurations.get(instance.instanceId) ?? {}) },
      };
      for (const action of technique.actions) {
        item.actionIds.set(action.id, uniqueId(
          scopedId(action.id, scopeId, instance.preserveIds?.actions),
          "action",
          `${instance.instanceId}@${repeatIndex}#${action.id}`,
          actionOwners,
        ));
      }
      for (const node of technique.process.nodes) {
        item.nodeIds.set(node.id, uniqueId(
          scopedId(node.id, scopeId, instance.preserveIds?.nodes),
          "node",
          `${instance.instanceId}@${repeatIndex}#${node.id}`,
          nodeOwners,
        ));
      }
      const sourceRules = [
        ...technique.actions.flatMap((action) => action.prerequisites),
        ...technique.process.nodes.flatMap((node) => node.validation),
        ...technique.successCriteria,
      ];
      for (const rule of sourceRules) {
        if (!item.validationRuleIds.has(rule.id)) {
          item.validationRuleIds.set(rule.id, scopedId(
            rule.id,
            scopeId,
            instance.preserveIds?.validationRules,
          ));
        }
      }
      expanded.push(item);
      expandedByKey.set(`${instance.instanceId}#${repeatIndex}`, item);
    }
  }
  const compiledActions = expanded.flatMap((item) =>
    item.technique.actions.map((action) => rewriteAction(item, action)));
  const compiledNodes = expanded.flatMap((item) =>
    item.technique.process.nodes.map((node) => rewriteNode(item, node)));
  const compiledAssessments = composeAssessments(source, expanded, techniques);
  reserveValidationRuleIds(
    [...compiledActions, ...source.actions],
    [...compiledNodes, ...source.process.nodes],
    compiledAssessments,
  );
  if (source.actions.length + compiledActions.length > MAX_COMPILED_ACTIONS) fail(["Compiled action expansion exceeds the 10,000-action bound."]);
  if (source.process.nodes.length + compiledNodes.length > MAX_COMPILED_NODES) fail(["Compiled node expansion exceeds the 10,000-node bound."]);

  const localNodeIds = new Set(source.process.nodes.map((node) => node.id));
  const internalEdgeEntries = expanded.flatMap((item) => item.technique.process.edges.map((edge, edgeIndex) => ({
    key: `technique-edge:${item.source.instanceId}#${item.repeatIndex}:${edgeIndex}`,
    edge: rewriteInternalEdge(item, edge),
  })));
  const localEdgeEntries = source.process.edges.map((edge, edgeIndex) => ({
    key: `lab-edge:${edgeIndex}`,
    edge: structuredClone(edge),
  }));
  const connectionEdgeEntries = source.compositionConnections.flatMap((connection, connectionIndex) => {
    if (!witnessEnablesPredicate(connection.enabledWhen, witness, selectedConfigurations)) return [];
    return [{
      key: `connection:${connection.id ?? connectionIndex}`,
      edge: {
        from: endpointNodeId(connection.from, expandedByKey, localNodeIds, "from"),
        to: endpointNodeId(connection.to, expandedByKey, localNodeIds, "to"),
        label: connection.label,
        condition: connection.condition ?? { type: "always" as const },
      } satisfies ProcessEdge,
    }];
  });
  let orderedEdges: ProcessEdge[];
  if (!source.compositionEdgeOrder) {
    orderedEdges = [...localEdgeEntries, ...internalEdgeEntries, ...connectionEdgeEntries].map((entry) => entry.edge);
  } else {
    const activeEdges = new Map([...localEdgeEntries, ...internalEdgeEntries, ...connectionEdgeEntries]
      .map((entry) => [entry.key, entry.edge] as const));
    const seenOrderKeys = new Set<string>();
    orderedEdges = source.compositionEdgeOrder.map((entry, orderIndex) => {
      let key: string;
      if (entry.kind === "lab-edge") key = `lab-edge:${entry.edgeIndex}`;
      else if (entry.kind === "connection") key = `connection:${entry.connectionId}`;
      else {
        const declared = source.techniqueInstances.find((instance) => instance.instanceId === entry.instanceId) ??
          fail([`compositionEdgeOrder[${orderIndex}] references undeclared instance "${entry.instanceId}".`]);
        if ((declared.repeat ?? 1) > 1 && entry.repeatIndex === undefined) {
          fail([`compositionEdgeOrder[${orderIndex}] requires repeatIndex for repeated instance "${entry.instanceId}".`]);
        }
        key = `technique-edge:${entry.instanceId}#${entry.repeatIndex ?? 0}:${entry.edgeIndex}`;
      }
      if (seenOrderKeys.has(key)) fail([`compositionEdgeOrder[${orderIndex}] repeats edge source "${key}".`]);
      seenOrderKeys.add(key);
      return activeEdges.get(key) ?? fail([`compositionEdgeOrder[${orderIndex}] references missing or inactive edge source "${key}".`]);
    });
    const missing = [...activeEdges.keys()].filter((key) => !seenOrderKeys.has(key));
    if (missing.length > 0) fail([`compositionEdgeOrder does not account for active edges: ${missing.join(", ")}.`]);
  }
  const resolvedStartNodeId = source.compositionStart
    ? endpointNodeId(source.compositionStart, expandedByKey, localNodeIds, "to")
    : source.process.startNodeId;
  const process = {
    startNodeId: resolvedStartNodeId,
    nodes: [...structuredClone(source.process.nodes), ...compiledNodes],
    edges: orderedEdges,
  };
  const reached = reachableNodeIds(process.startNodeId, process.edges);
  const dead = process.nodes.filter((node) => !reached.has(node.id)).map((node) => node.id);
  if (dead.length > 0) fail([`Selected witness "${witness.id}" emits unreachable nodes: ${dead.join(", ")}.`]);
  const referencedActions = new Set(process.nodes.map((node) => node.actionId).filter((id): id is string => Boolean(id)));
  const unused = [...actionOwners.keys()].filter((actionId) => !referencedActions.has(actionId));
  if (unused.length > 0) fail([`Selected witness "${witness.id}" emits unreferenced actions: ${unused.join(", ")}.`]);

  const manifest: CompositionManifest = {
    schemaVersion: 1,
    compilerContractVersion: COMPOSITION_COMPILER_CONTRACT_VERSION,
    status: options.status ?? "compiled",
    instances: expanded.map((item) => ({
      instanceId: item.scopeId,
      techniqueId: item.technique.id,
      version: item.technique.metadata.version,
      repeatIndex: item.repeatIndex,
      variantId: item.source.variantId,
      evidenceOutputs: item.contract.evidenceOutputs.map((output) => ({
        id: `${item.scopeId}--${output.id}`,
        sourceId: output.id,
        kind: output.kind,
        actionId: item.actionIds.get(output.actionId) ?? fail([
          `Instance "${item.scopeId}" evidence output "${output.id}" references unresolved action "${output.actionId}".`,
        ]),
        referenceId: scopedReference(
          output.referenceId,
          item.scopeId,
          item.configuration,
          item.source.preserveIds?.references,
        ),
      })),
      completion: {
        exitNodeIds: item.contract.completion.exitPortIds.map((portId) => {
          const port = item.contract.ports.find((candidate) => candidate.id === portId) ?? fail([
            `Instance "${item.scopeId}" completion references missing exit port "${portId}".`,
          ]);
          return item.nodeIds.get(port.nodeId) ?? fail([
            `Instance "${item.scopeId}" exit port "${portId}" references unresolved node "${port.nodeId}".`,
          ]);
        }),
        requiredEvidenceOutputIds: item.contract.completion.requiredEvidenceOutputIds.map(
          (outputId) => `${item.scopeId}--${outputId}`,
        ),
        requiredValidationRuleIds: item.contract.completion.requiredValidationRuleIds.map((ruleId) =>
          item.validationRuleIds.get(ruleId) ?? fail([
            `Instance "${item.scopeId}" completion references unresolved validation rule "${ruleId}".`,
          ])),
      },
    })),
    origins: expanded.flatMap((item) => item.technique.process.nodes.map((node) => ({
        actionId: node.actionId ? item.actionIds.get(node.actionId) : undefined,
        nodeId: item.nodeIds.get(node.id)!,
        techniqueId: item.technique.id,
        techniqueVersion: item.technique.metadata.version,
        instanceId: item.scopeId,
        sourceActionId: node.actionId,
        sourceNodeId: node.id,
      }))),
  };
  const compiled: LabDefinition = {
    ...structuredClone(source),
    initialState: { equipment: structuredClone(source.initialState?.equipment ?? []) },
    actions: [...compiledActions, ...structuredClone(source.actions)],
    process,
    assessments: compiledAssessments,
    compositionManifest: manifest,
  };
  delete (compiled as LabDefinition & { techniqueInstances?: unknown }).techniqueInstances;
  delete (compiled as LabDefinition & { compositionConnections?: unknown }).compositionConnections;
  delete (compiled as LabDefinition & { reachabilityWitnesses?: unknown }).reachabilityWitnesses;
  delete (compiled as LabDefinition & { compositionAssessmentOrder?: unknown }).compositionAssessmentOrder;
  delete (compiled as LabDefinition & { compositionStart?: unknown }).compositionStart;
  delete (compiled as LabDefinition & { compositionEdgeOrder?: unknown }).compositionEdgeOrder;
  const validation = validateLabDefinition(compiled);
  if (!validation.ok || !validation.value) fail(validation.errors.map((error) => `Compiled ${error}`));
  return validation.value ?? fail([`Compiled lab "${source.id}" validation returned no value.`]);
};
