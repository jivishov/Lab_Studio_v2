import { atomById, deriveActionEffectContract, equipmentRoleById, roleAcceptsEquipment } from "./atomRegistry";
import type {
  ActionEffectClass,
  ActionEffectContract,
  BundledLabSourceDefinition,
  CompositionBranchPredicate,
  CompositionManifest,
  CompositionReachabilityWitness,
  LabCompositionSourceDefinition,
  TechniqueCompositionContract,
  TechniqueConfigurationSlot,
  TechniqueConfigurationValue,
  TechniqueDefinition,
  TechniqueInstanceRef,
  TechniqueVariantPredicate,
  ValidationResult,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isCompositionToken = (value: unknown): value is string =>
  isNonEmptyString(value) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);

const isConfigurationValue = (value: unknown): value is TechniqueConfigurationValue =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const effectClasses = new Set([
  "apparatus-material-instrument-state",
  "measurement-direct-observation-acquisition",
  "evidence-recording",
  "calculation-analysis",
  "pedagogical-orchestration",
]);
const effectTargetDomains = new Set([
  "equipment", "material", "instrument", "measurement-observation", "evidence",
  "calculation", "analysis", "pedagogy", "configuration", "approval", "model",
]);
const equipmentLocations = new Set(["shelf", "workbench", "snapZone", "oven", "storage"]);
const evidenceOutputKinds = new Set(["action-evidence", "measurement", "data-series", "notebook", "calculation"]);

const sameValues = <T extends string>(left: readonly T[], right: readonly T[]): boolean =>
  left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);

const effectTargetKeys = (effect: ActionEffectContract): string[] =>
  effect.targets.map((target) => `${target.domain}/${target.reference ?? ""}`);

const validateEffectShape = (
  effect: unknown,
  path: string,
  errors: string[],
): effect is ActionEffectContract => {
  if (!isRecord(effect)) {
    errors.push(`${path} must declare a typed effect contract.`);
    return false;
  }
  if (!Array.isArray(effect.classes) || effect.classes.length === 0 || !effect.classes.every(isNonEmptyString)) {
    errors.push(`${path}.classes must be a non-empty string array.`);
  } else if (effect.classes.some((effectClass) => !effectClasses.has(effectClass))) {
    errors.push(`${path}.classes contains an unknown effect class.`);
  } else if (new Set(effect.classes).size !== effect.classes.length) {
    errors.push(`${path}.classes must not contain duplicates.`);
  }
  if (!Array.isArray(effect.targets) || effect.targets.length === 0 || !effect.targets.every((target) =>
    isRecord(target) && isNonEmptyString(target.domain) &&
    (target.reference === undefined || isNonEmptyString(target.reference)))) {
    errors.push(`${path}.targets must be a non-empty array of typed domain/reference objects.`);
  } else if (effect.targets.some((target) => !effectTargetDomains.has((target as { domain: string }).domain))) {
    errors.push(`${path}.targets contains an unknown target domain.`);
  } else if (new Set(effect.targets.map((target) =>
    `${(target as { domain: string }).domain}/${String((target as { reference?: string }).reference ?? "")}`)).size !== effect.targets.length) {
    errors.push(`${path}.targets must not contain duplicates.`);
  }
  return true;
};

const techniqueOnlyClasses = new Set<ActionEffectClass>([
  "apparatus-material-instrument-state",
  "measurement-direct-observation-acquisition",
]);
const techniqueOnlyTargetDomains = new Set([
  "equipment", "material", "instrument", "measurement-observation", "model",
]);

const validateLocalActionEffects = (
  source: LabCompositionSourceDefinition,
  errors: string[],
): void => {
  if (!Array.isArray(source.actions)) return;
  source.actions.forEach((action, index) => {
    const path = `lab.actions[${index}]`;
    if (!validateEffectShape(action.effect, `${path}.effect`, errors)) return;
    const derived = deriveActionEffectContract(action);
    errors.push(...derived.errors.map((error) => `${path}: ${error}`));
    if (!derived.contract) return;
    for (const effectClass of derived.contract.classes) {
      if (techniqueOnlyClasses.has(effectClass)) {
        errors.push(
          `${path} action "${action.id}" derives technique-only effect class "${effectClass}" from its handler.`,
        );
      }
    }
    const handlerClasses = action.effect.classes.filter(
      (effectClass) => effectClass !== "pedagogical-orchestration",
    );
    if (!sameValues(handlerClasses, derived.contract.classes)) {
      errors.push(
        `${path}.effect.classes conflicts with registry/handler-derived classes for action "${action.id}".`,
      );
    }
    const declaredDomains = action.effect.targets.map((target) => target.domain);
    for (const domain of declaredDomains) {
      if (techniqueOnlyTargetDomains.has(domain)) {
        errors.push(
          `${path}.effect.targets declares technique-only target domain "${domain}" for lab-local action "${action.id}".`,
        );
      }
    }
    for (const target of derived.contract.targets) {
      if (!declaredDomains.includes(target.domain)) {
        errors.push(
          `${path}.effect.targets omits handler-derived target domain "${target.domain}" for action "${action.id}".`,
        );
      }
    }
  });
};

const slotAcceptsValue = (
  slot: TechniqueConfigurationSlot,
  value: TechniqueConfigurationValue,
): boolean =>
  typeof value === slot.valueType &&
  (slot.allowedValues === undefined || slot.allowedValues.includes(value));

const witnessEnables = (
  predicate: CompositionBranchPredicate | undefined,
  witness: CompositionReachabilityWitness,
  source?: LabCompositionSourceDefinition,
): boolean => {
  if (!predicate) return true;
  if (predicate.kind === "approval") {
    return witness.approvalGates[`${predicate.instanceId}.${predicate.gateId}`] === predicate.equals;
  }
  const key = `${predicate.instanceId}.${predicate.slotId}`;
  const value = witness.configuration[key] ?? source?.techniqueInstances.find(
    (instance) => instance.instanceId === predicate.instanceId,
  )?.bindings.configuration[predicate.slotId];
  return value === predicate.equals;
};

export interface ConcreteEquipmentMappingConflict {
  endpoint: "source" | "target";
  instanceId: string;
  priorOwner: string;
  priorSourceInstanceId: string;
  priorTargetInstanceId: string;
}

/**
 * Tracks a one-to-one concrete equipment mapping while permitting compatible
 * roles to repeat the exact same standalone-source -> concrete-target pair.
 */
export const createConcreteEquipmentMappingTracker = () => {
  const bySource = new Map<string, {
    targetInstanceId: string;
    owner: string;
  }>();
  const byTarget = new Map<string, {
    sourceInstanceId: string;
    owner: string;
  }>();

  return {
    reserve(
      sourceInstanceId: string,
      targetInstanceId: string,
      owner: string,
    ): ConcreteEquipmentMappingConflict | undefined {
      const priorSource = bySource.get(sourceInstanceId);
      if (priorSource && priorSource.targetInstanceId !== targetInstanceId) {
        return {
          endpoint: "source",
          instanceId: sourceInstanceId,
          priorOwner: priorSource.owner,
          priorSourceInstanceId: sourceInstanceId,
          priorTargetInstanceId: priorSource.targetInstanceId,
        };
      }
      const priorTarget = byTarget.get(targetInstanceId);
      if (priorTarget && priorTarget.sourceInstanceId !== sourceInstanceId) {
        return {
          endpoint: "target",
          instanceId: targetInstanceId,
          priorOwner: priorTarget.owner,
          priorSourceInstanceId: priorTarget.sourceInstanceId,
          priorTargetInstanceId: targetInstanceId,
        };
      }
      if (!priorSource) bySource.set(sourceInstanceId, { targetInstanceId, owner });
      if (!priorTarget) byTarget.set(targetInstanceId, { sourceInstanceId, owner });
      return undefined;
    },
  };
};

export const validateTechniqueCompositionContract = (
  technique: TechniqueDefinition,
): ValidationResult<TechniqueCompositionContract> => {
  const contract = technique.composition;
  if (!contract) return { ok: false, errors: [`Technique "${technique.id}" has no composition contract.`] };
  const errors: string[] = [];
  if (contract.schemaVersion !== 1) errors.push(`Technique "${technique.id}" composition.schemaVersion must be 1.`);
  for (const key of [
    "ports", "equipmentRoles", "modelSlots", "configurationSlots", "approvalGates", "variants", "evidenceOutputs",
  ] as const) {
    if (!Array.isArray(contract[key])) errors.push(`Technique "${technique.id}" composition.${key} must be an array.`);
  }
  if (contract.legacyActionEffects !== undefined && !Array.isArray(contract.legacyActionEffects)) {
    errors.push(`Technique "${technique.id}" composition.legacyActionEffects must be an array when supplied.`);
  }
  if (!isRecord(contract.completion)) {
    errors.push(`Technique "${technique.id}" composition.completion must be an object.`);
  }
  if (!["composable", "standalone-practice", "lab-scoped", "deprecated"].includes(contract.catalogDisposition)) {
    errors.push(`Technique "${technique.id}" composition.catalogDisposition is invalid.`);
  }
  if (errors.length > 0) return { ok: false, errors };
  const processNodes = Array.isArray(technique.process?.nodes) ? technique.process.nodes : [];
  const nodeIds = new Set(processNodes.map((node) => node.id));
  const ids = new Set<string>();
  for (const port of contract.ports) {
    if (ids.has(port.id)) errors.push(`Technique "${technique.id}" repeats composition port "${port.id}".`);
    ids.add(port.id);
    if (!nodeIds.has(port.nodeId)) {
      errors.push(`Technique "${technique.id}" port "${port.id}" references missing node "${port.nodeId}".`);
    }
  }
  if (!contract.ports.some((port) => port.kind === "entry")) {
    errors.push(`Technique "${technique.id}" composition requires at least one entry port.`);
  }
  if (!contract.ports.some((port) => port.kind === "exit")) {
    errors.push(`Technique "${technique.id}" composition requires at least one exit port.`);
  }
  const roleIds = new Set<string>();
  const standaloneMappings = createConcreteEquipmentMappingTracker();
  for (const role of contract.equipmentRoles) {
    if (!isNonEmptyString(role.roleId)) errors.push(`Technique "${technique.id}" composition equipment role id is missing.`);
    else if (roleIds.has(role.roleId)) errors.push(`Technique "${technique.id}" repeats composition equipment role "${role.roleId}".`);
    else if (!equipmentRoleById.has(role.roleId)) errors.push(`Technique "${technique.id}" composition references unknown equipment role "${role.roleId}".`);
    roleIds.add(role.roleId);
    if (role.sourceInstanceIds !== undefined &&
      (!Array.isArray(role.sourceInstanceIds) || !role.sourceInstanceIds.every(isNonEmptyString) ||
        new Set(role.sourceInstanceIds).size !== role.sourceInstanceIds.length)) {
      errors.push(`Technique "${technique.id}" equipment role "${role.roleId}" sourceInstanceIds must be a unique string array.`);
    }
    const sourceDefinitionIds = new Set(technique.actions.flatMap((action) => {
      const definitionId = action.equipmentRoleBindings?.[role.roleId];
      return definitionId ? [definitionId] : [];
    }));
    for (const sourceInstanceId of role.sourceInstanceIds ?? []) {
      const conflict = standaloneMappings.reserve(sourceInstanceId, sourceInstanceId, `equipment role "${role.roleId}"`);
      if (conflict) {
        errors.push(
          `Technique "${technique.id}" standalone instance "${sourceInstanceId}" has a conflicting role mapping from ${conflict.priorOwner} to equipment role "${role.roleId}".`,
        );
      }
      const sourceInstance = technique.initialState.equipment.find((instance) => instance.id === sourceInstanceId);
      if (!sourceInstance) {
        errors.push(`Technique "${technique.id}" equipment role "${role.roleId}" references missing standalone instance "${sourceInstanceId}".`);
      } else if (sourceDefinitionIds.size > 0 && !sourceDefinitionIds.has(sourceInstance.definitionId)) {
        errors.push(`Technique "${technique.id}" equipment role "${role.roleId}" standalone instance "${sourceInstanceId}" has definition "${sourceInstance.definitionId}" not used by that role.`);
      }
    }
  }
  if (contract.orderedProcedure) {
    const plan = contract.orderedProcedure;
    if (!Array.isArray(plan.groups) || !Array.isArray(plan.resources) || !Array.isArray(plan.startActionIds) || !Array.isArray(plan.endActionIds)) return { ok: false, errors: ["Ordered procedure requires explicit group/resource/action arrays."] };
    if (plan.groups.some((group) => !group || !isNonEmptyString(group.id) || !Array.isArray(group.actionIds) || group.actionIds.length === 0 || group.actionIds.some((id) => !isNonEmptyString(id))) || plan.resources.some((resource) => !resource || !isNonEmptyString(resource.id) || !Array.isArray(resource.prepareActionIds) || !Array.isArray(resource.cleanupActionIds))) return { ok: false, errors: ["Ordered procedure groups require nonempty identities and real action ownership."] };
    const ids = new Set(technique.actions.map((action) => action.id));
    const groupIds = new Set(plan.groups.map((group) => group.id));
    const resourceIds = new Set(plan.resources.map((resource) => resource.id));
    if (!contract.configurationSlots.some((slot) => slot.id === plan.configurationSlotId && slot.valueType === "string" && slot.required)) errors.push("Ordered procedure must name a required string configuration slot.");
    if (!Number.isInteger(plan.minimumTests) || plan.minimumTests < 1 || groupIds.size !== plan.groups.length || resourceIds.size !== plan.resources.length) errors.push("Ordered procedure has invalid group counts or duplicated identities.");
    const owned = [...plan.startActionIds, ...plan.endActionIds, ...plan.groups.flatMap((group) => group.actionIds), ...plan.resources.flatMap((resource) => [...resource.prepareActionIds, ...resource.cleanupActionIds])];
    if (new Set(owned).size !== owned.length || owned.some((id) => !ids.has(id)) || owned.length !== ids.size) errors.push("Ordered procedure must partition every canonical action exactly once.");
    for (const group of plan.groups) {
      if (group.actionAliases && Object.entries(group.actionAliases).some(([sourceId, targetId]) => !ids.has(sourceId) || !group.actionIds.includes(targetId))) errors.push("Procedure aliases must target an action owned by that alternative.");
      if (group.resourceId && !resourceIds.has(group.resourceId)) errors.push(`Unknown ordered procedure resource ${group.resourceId}.`);
      if (!Number.isInteger(group.testCount) || group.testCount < 0 || !["qualitative", "quantitative", "procedure"].includes(group.evidenceKind)) errors.push("Invalid ordered procedure evidence declaration.");
      if ([...(group.requiresEarlier ?? []), ...(group.requiresSelected ?? [])].some((id) => !groupIds.has(id))) errors.push("Unknown ordered procedure dependency.");
    }
  }
  const modelIds = new Set<string>();
  for (const slot of contract.modelSlots) {
    if (!isNonEmptyString(slot.id) || !isNonEmptyString(slot.sourceModelId)) {
      errors.push(`Technique "${technique.id}" composition model slots require id and sourceModelId.`);
    } else if (modelIds.has(slot.id)) errors.push(`Technique "${technique.id}" repeats composition model slot "${slot.id}".`);
    modelIds.add(slot.id);
    const collections = {
      titration: technique.titrationModels ?? [],
      chromatography: technique.chromatographyModels ?? [],
      kinetics: technique.kineticsModels ?? [],
    } as const;
    if (!(slot.kind in collections) || !collections[slot.kind]?.some((model) => model.id === slot.sourceModelId)) {
      errors.push(`Technique "${technique.id}" model slot "${slot.id}" references missing ${slot.kind} model "${slot.sourceModelId}".`);
    }
  }
  const configurationIds = new Set<string>();
  for (const slot of contract.configurationSlots) {
    if (!isCompositionToken(slot.id)) errors.push(`Technique "${technique.id}" composition configuration slot id is invalid.`);
    else if (configurationIds.has(slot.id)) errors.push(`Technique "${technique.id}" repeats composition configuration slot "${slot.id}".`);
    configurationIds.add(slot.id);
    if (!(["string", "number", "boolean"] as const).includes(slot.valueType)) {
      errors.push(`Technique "${technique.id}" configuration slot "${slot.id}" has an invalid valueType.`);
    }
    if (slot.defaultValue !== undefined && !slotAcceptsValue(slot, slot.defaultValue)) {
      errors.push(`Technique "${technique.id}" configuration slot "${slot.id}" has an invalid defaultValue.`);
    }
  }
  const approvalGateIds = new Set<string>();
  for (const gate of contract.approvalGates) {
    if (!isCompositionToken(gate.id) || !isNonEmptyString(gate.label)) {
      errors.push(`Technique "${technique.id}" composition approval gates require id and label.`);
    } else if (approvalGateIds.has(gate.id)) {
      errors.push(`Technique "${technique.id}" repeats composition approval gate "${gate.id}".`);
    }
    approvalGateIds.add(gate.id);
  }
  const validateVariantPredicate = (
    predicate: TechniqueVariantPredicate,
    path: string,
  ): void => {
    if (!isRecord(predicate)) {
      errors.push(`${path} must be an object.`);
      return;
    }
    if (predicate.kind === "configuration") {
      const slot = contract.configurationSlots.find((candidate) => candidate.id === predicate.slotId);
      if (!slot) errors.push(`${path} references undeclared configuration slot "${predicate.slotId}".`);
      else if (!isConfigurationValue(predicate.equals) || !slotAcceptsValue(slot, predicate.equals)) {
        errors.push(`${path} has an incompatible configuration value.`);
      }
    } else if (predicate.kind === "approval") {
      if (!approvalGateIds.has(predicate.gateId)) {
        errors.push(`${path} references undeclared approval gate "${predicate.gateId}".`);
      }
      if (typeof predicate.equals !== "boolean") errors.push(`${path}.equals must be boolean.`);
    } else {
      errors.push(`${path}.kind is invalid.`);
    }
  };
  const variantIds = new Set<string>();
  for (const [index, variant] of contract.variants.entries()) {
    if (!isNonEmptyString(variant.id) || !isNonEmptyString(variant.label)) {
      errors.push(`Technique "${technique.id}" composition variants require id and label.`);
    } else if (variantIds.has(variant.id)) {
      errors.push(`Technique "${technique.id}" repeats composition variant "${variant.id}".`);
    }
    variantIds.add(variant.id);
    validateVariantPredicate(
      variant.enabledWhen,
      `Technique "${technique.id}" composition.variants[${index}].enabledWhen`,
    );
  }
  const actionIds = new Set(technique.actions.map((action) => action.id));
  const validationRuleOwners = new Map<string, string>();
  const reserveValidationRule = (ruleId: string, owner: string): void => {
    const previous = validationRuleOwners.get(ruleId);
    if (previous) {
      errors.push(`Technique "${technique.id}" repeats validation rule id "${ruleId}" in ${previous} and ${owner}.`);
    } else {
      validationRuleOwners.set(ruleId, owner);
    }
  };
  technique.actions.forEach((action) => action.prerequisites.forEach((rule) =>
    reserveValidationRule(rule.id, `action "${action.id}" prerequisites`)));
  technique.process.nodes.forEach((node) => node.validation.forEach((rule) =>
    reserveValidationRule(rule.id, `node "${node.id}" validation`)));
  technique.successCriteria.forEach((rule) => reserveValidationRule(rule.id, "successCriteria"));
  const evidenceOutputIds = new Set<string>();
  for (const output of contract.evidenceOutputs) {
    if (!isNonEmptyString(output.id)) errors.push(`Technique "${technique.id}" composition evidence output id is missing.`);
    else if (evidenceOutputIds.has(output.id)) errors.push(`Technique "${technique.id}" repeats evidence output "${output.id}".`);
    evidenceOutputIds.add(output.id);
    if (!evidenceOutputKinds.has(output.kind)) errors.push(`Technique "${technique.id}" evidence output "${output.id}" has an invalid kind.`);
    if (!actionIds.has(output.actionId)) errors.push(`Technique "${technique.id}" evidence output "${output.id}" references missing action "${output.actionId}".`);
    if (output.referenceId !== undefined && !isNonEmptyString(output.referenceId)) {
      errors.push(`Technique "${technique.id}" evidence output "${output.id}" has an invalid referenceId.`);
    }
  }
  if (isRecord(contract.completion)) {
    const completionArrays = [
      ["exitPortIds", contract.completion.exitPortIds],
      ["requiredEvidenceOutputIds", contract.completion.requiredEvidenceOutputIds],
      ["requiredValidationRuleIds", contract.completion.requiredValidationRuleIds],
    ] as const;
    for (const [key, value] of completionArrays) {
      if (!Array.isArray(value) || !value.every(isNonEmptyString) || new Set(value).size !== value.length) {
        errors.push(`Technique "${technique.id}" composition.completion.${key} must be a unique string array.`);
      }
    }
    const exitPorts = new Set(contract.ports.filter((port) => port.kind === "exit").map((port) => port.id));
    for (const portId of Array.isArray(contract.completion.exitPortIds) ? contract.completion.exitPortIds : []) {
      if (!exitPorts.has(portId)) errors.push(`Technique "${technique.id}" completion references missing exit port "${portId}".`);
    }
    for (const outputId of Array.isArray(contract.completion.requiredEvidenceOutputIds)
      ? contract.completion.requiredEvidenceOutputIds
      : []) {
      if (!evidenceOutputIds.has(outputId)) errors.push(`Technique "${technique.id}" completion references missing evidence output "${outputId}".`);
    }
    const successRuleIds = new Set(technique.successCriteria.map((rule) => rule.id));
    for (const ruleId of Array.isArray(contract.completion.requiredValidationRuleIds)
      ? contract.completion.requiredValidationRuleIds
      : []) {
      if (!successRuleIds.has(ruleId)) errors.push(`Technique "${technique.id}" completion references missing success criterion "${ruleId}".`);
    }
  }
  if (contract.presentationPaths !== undefined &&
    (!Array.isArray(contract.presentationPaths) || !contract.presentationPaths.every(isNonEmptyString))) {
    errors.push(`Technique "${technique.id}" composition.presentationPaths must be a string array.`);
  }
  for (const path of Array.isArray(contract.presentationPaths) ? contract.presentationPaths : []) {
    if (/(?:^|\.)(?:prerequisites|invalidCases|commonMistakes|successCriteria|evidence|safetyNotes)(?:\.|$)|feedback\.(?:invalid|retry)/.test(path)) {
      errors.push(`Technique "${technique.id}" presentation path "${path}" targets protected procedural or safety content.`);
    }
  }
  const legacyEffects = new Map<string, ActionEffectContract>();
  for (const [index, declaration] of (contract.legacyActionEffects ?? []).entries()) {
    const path = `Technique "${technique.id}" composition.legacyActionEffects[${index}]`;
    if (!isRecord(declaration) || !isNonEmptyString(declaration.actionId) ||
      !validateEffectShape(declaration.effect, `${path}.effect`, errors)) continue;
    if (legacyEffects.has(declaration.actionId)) {
      errors.push(`${path}.actionId repeats legacy action "${declaration.actionId}".`);
    }
    legacyEffects.set(declaration.actionId, declaration.effect);
  }
  for (const action of Array.isArray(technique.actions) ? technique.actions : []) {
    const effect = deriveActionEffectContract(action);
    errors.push(...effect.errors.map((error) => `Technique "${technique.id}": ${error}`));
    if (!effect.contract) errors.push(`Technique "${technique.id}" action "${action.id}" has no derived effect contract.`);
    const legacyEffect = legacyEffects.get(action.id);
    if (!action.atomId && !legacyEffect) {
      errors.push(`Technique "${technique.id}" atomless action "${action.id}" requires composition-owned legacyActionEffects metadata.`);
    } else if (action.atomId && legacyEffect) {
      errors.push(`Technique "${technique.id}" atom-backed action "${action.id}" must not declare legacyActionEffects metadata.`);
    } else if (legacyEffect && action.effect !== undefined) {
      errors.push(`Technique "${technique.id}" legacy action "${action.id}" must keep effect metadata composition-owned rather than emitting action.effect.`);
    } else if (legacyEffect && effect.contract &&
      (!sameValues(legacyEffect.classes, effect.contract.classes) ||
        !sameValues(effectTargetKeys(legacyEffect), effectTargetKeys(effect.contract)))) {
      errors.push(`Technique "${technique.id}" legacy effect for action "${action.id}" conflicts with registry/handler-derived effects.`);
    }
    const atom = action.atomId ? atomById.get(action.atomId) : undefined;
    for (const roleId of atom?.requiredRoles ?? []) {
      if (!roleIds.has(roleId)) {
        errors.push(`Technique "${technique.id}" composition omits required atom equipment role "${roleId}" used by action "${action.id}".`);
      }
    }
  }
  for (const actionId of legacyEffects.keys()) {
    if (!technique.actions.some((action) => action.id === actionId)) {
      errors.push(`Technique "${technique.id}" legacy effect references unknown action "${actionId}".`);
    }
  }
  return errors.length === 0
    ? { ok: true, value: contract, errors: [] }
    : { ok: false, errors };
};

export const validateLabCompositionSourceShape = (
  input: unknown,
): ValidationResult<LabCompositionSourceDefinition> => {
  if (!isRecord(input)) return { ok: false, errors: ["Lab composition source must be an object."] };
  const errors: string[] = [];
  if (!Array.isArray(input.techniqueInstances) || input.techniqueInstances.length === 0) {
    errors.push("lab.techniqueInstances must be a non-empty array.");
  }
  if (input.techniqueRefs !== undefined) {
    errors.push("lab.techniqueRefs and lab.techniqueInstances are mutually exclusive source contracts.");
  }
  if (input.compositionManifest !== undefined) {
    errors.push("Raw composition sources cannot assert compositionManifest; the compiler issues origin rows.");
  }
  if (!Array.isArray(input.compositionConnections)) {
    errors.push("lab.compositionConnections must be an array.");
  }
  if (!Array.isArray(input.reachabilityWitnesses) || input.reachabilityWitnesses.length === 0) {
    errors.push("lab.reachabilityWitnesses must be a non-empty array.");
  }
  if (!Array.isArray(input.actions)) errors.push("lab.actions must be an array.");
  if (!isRecord(input.process)) errors.push("lab.process must be an object.");
  if (errors.length > 0) return { ok: false, errors };

  const source = input as unknown as LabCompositionSourceDefinition;
  const labEquipment = Array.isArray(source.equipment) && source.equipment.every(isNonEmptyString)
    ? source.equipment
    : [];
  if (labEquipment.length !== (Array.isArray(source.equipment) ? source.equipment.length : -1)) {
    errors.push("lab.equipment must be a string array for a composition source.");
  }
  if (!isRecord(source.initialState) || !Array.isArray(source.initialState.equipment)) {
    errors.push("lab.initialState.equipment must be an explicit array for a composition source.");
  } else {
    const initialInstanceIds = new Set<string>();
    const presentDefinitions = new Set<string>();
    for (const [index, instance] of source.initialState.equipment.entries()) {
      if (!isRecord(instance) || !isNonEmptyString(instance.id) || !isNonEmptyString(instance.definitionId)) {
        errors.push(`lab.initialState.equipment[${index}] requires non-empty id and definitionId.`);
        continue;
      }
      if (initialInstanceIds.has(instance.id)) {
        errors.push(`lab.initialState.equipment repeats instance id "${instance.id}".`);
      }
      initialInstanceIds.add(instance.id);
      presentDefinitions.add(instance.definitionId);
      if (!labEquipment.includes(instance.definitionId)) {
        errors.push(`lab.initialState.equipment[${index}] uses undeclared lab equipment "${instance.definitionId}".`);
      }
      if (!isNonEmptyString(instance.label)) {
        errors.push(`lab.initialState.equipment[${index}].label must be a non-empty string.`);
      }
      if (!equipmentLocations.has(String(instance.location))) {
        errors.push(`lab.initialState.equipment[${index}].location is invalid.`);
      }
      if (!isRecord(instance.contents)) {
        errors.push(`lab.initialState.equipment[${index}].contents must be an object.`);
      }
    }
    for (const definitionId of labEquipment) {
      if (!presentDefinitions.has(definitionId)) {
        errors.push(
          `lab.initialState.equipment must explicitly include declared equipment "${definitionId}" so runtime cannot synthesize it.`,
        );
      }
    }
  }
  const instanceIds = new Set<string>();
  for (const [index, instance] of source.techniqueInstances.entries()) {
    const path = `lab.techniqueInstances[${index}]`;
    if (!isRecord(instance)) {
      errors.push(`${path} must be an object.`);
      continue;
    }
    for (const [key, value] of [["instanceId", instance.instanceId], ["techniqueId", instance.techniqueId], ["version", instance.version]] as const) {
      if (key === "instanceId" ? !isCompositionToken(value) : !isNonEmptyString(value)) {
        errors.push(`${path}.${key} must be a ${key === "instanceId" ? "composition-safe" : "non-empty"} string.`);
      }
    }
    if (isNonEmptyString(instance.version) && /[\s*^~<>=|]/.test(instance.version)) {
      errors.push(`${path}.version must be an exact version, not a range or wildcard.`);
    }
    if (instanceIds.has(instance.instanceId)) errors.push(`${path}.instanceId repeats "${instance.instanceId}".`);
    instanceIds.add(instance.instanceId);
    if (instance.repeat !== undefined && (!Number.isInteger(instance.repeat) || instance.repeat < 1 || instance.repeat > 32)) {
      errors.push(`${path}.repeat must be an integer from 1 through 32.`);
    }
    if (!isRecord(instance.bindings) || !isRecord(instance.bindings.equipment) ||
      !isRecord(instance.bindings.models) || !isRecord(instance.bindings.configuration)) {
      errors.push(`${path}.bindings requires equipment, models, and configuration records.`);
    }
    if (instance.preserveIds !== undefined) {
      if (!isRecord(instance.preserveIds)) {
        errors.push(`${path}.preserveIds must be an object.`);
      } else {
        const allowedPreserveKeys = new Set(["actions", "nodes", "validationRules", "references"]);
        for (const [bindingKind, bindings] of Object.entries(instance.preserveIds)) {
          if (!allowedPreserveKeys.has(bindingKind)) {
            errors.push(`${path}.preserveIds contains unsupported binding kind "${bindingKind}".`);
          } else if (!isRecord(bindings) || !Object.entries(bindings).every(([sourceId, targetId]) =>
            isNonEmptyString(sourceId) && isNonEmptyString(targetId))) {
            errors.push(`${path}.preserveIds.${bindingKind} must map non-empty source ids to non-empty target ids.`);
          }
        }
      }
    }
  }
  const validateEndpointShape = (endpoint: unknown, path: string): void => {
    if (!isRecord(endpoint) || (endpoint.kind !== "lab-node" && endpoint.kind !== "technique-port")) {
      errors.push(`${path} must be a typed endpoint.`);
    } else if (endpoint.kind === "lab-node" && !isNonEmptyString(endpoint.nodeId)) {
      errors.push(`${path}.nodeId must be a non-empty string.`);
    } else if (endpoint.kind === "technique-port" &&
      (!isCompositionToken(endpoint.instanceId) || !instanceIds.has(endpoint.instanceId) ||
        !isNonEmptyString(endpoint.portId) ||
        (endpoint.repeatIndex !== undefined && (!Number.isInteger(endpoint.repeatIndex) || Number(endpoint.repeatIndex) < 0)))) {
      errors.push(`${path} has an invalid or undeclared technique-port endpoint.`);
    }
  };
  if (source.compositionStart !== undefined) {
    validateEndpointShape(source.compositionStart, "lab.compositionStart");
  }
  if (source.compositionEdgeOrder !== undefined) {
    if (!Array.isArray(source.compositionEdgeOrder)) {
      errors.push("lab.compositionEdgeOrder must be an array when supplied.");
    } else {
      source.compositionEdgeOrder.forEach((entry, index) => {
        const path = `lab.compositionEdgeOrder[${index}]`;
        if (!isRecord(entry)) errors.push(`${path} must be an object.`);
        else if (entry.kind === "lab-edge") {
          if (!Number.isInteger(entry.edgeIndex) || Number(entry.edgeIndex) < 0) {
            errors.push(`${path}.edgeIndex must be a non-negative integer.`);
          }
        } else if (entry.kind === "technique-edge") {
          if (!isCompositionToken(entry.instanceId) || !instanceIds.has(entry.instanceId) ||
            !Number.isInteger(entry.edgeIndex) || Number(entry.edgeIndex) < 0 ||
            (entry.repeatIndex !== undefined && (!Number.isInteger(entry.repeatIndex) || Number(entry.repeatIndex) < 0))) {
            errors.push(`${path} must identify a declared instance, non-negative edgeIndex, and optional non-negative repeatIndex.`);
          }
        } else if (entry.kind === "connection") {
          if (!isCompositionToken(entry.connectionId)) errors.push(`${path}.connectionId must be composition-safe.`);
        } else errors.push(`${path}.kind must be lab-edge, technique-edge, or connection.`);
      });
    }
  }
  if (source.compositionAssessmentOrder !== undefined) {
    if (!Array.isArray(source.compositionAssessmentOrder)) {
      errors.push("lab.compositionAssessmentOrder must be an array when supplied.");
    } else {
      const validateTechniqueAssessmentRef = (ref: unknown, path: string, requireKind: boolean): void => {
        if (!isRecord(ref) || (requireKind && ref.kind !== "technique-success-criterion") ||
          !isCompositionToken(ref.instanceId) || !instanceIds.has(ref.instanceId) || !isNonEmptyString(ref.ruleId) ||
          (ref.repeatIndex !== undefined && (!Number.isInteger(ref.repeatIndex) || Number(ref.repeatIndex) < 0))) {
          errors.push(`${path} must identify a declared technique instance, success-criterion rule, and optional non-negative repeatIndex.`);
        }
      };
      source.compositionAssessmentOrder.forEach((entry, index) => {
        const path = `lab.compositionAssessmentOrder[${index}]`;
        if (!isRecord(entry)) {
          errors.push(`${path} must be an object.`);
        } else if (entry.kind === "technique-success-criterion") {
          validateTechniqueAssessmentRef(entry, path, true);
        } else if (entry.kind === "lab-assessment") {
          if (!isNonEmptyString(entry.ruleId)) errors.push(`${path}.ruleId must be a non-empty string.`);
          if (entry.substitutes !== undefined) validateTechniqueAssessmentRef(entry.substitutes, `${path}.substitutes`, false);
        } else {
          errors.push(`${path}.kind must be technique-success-criterion or lab-assessment.`);
        }
      });
    }
  }
  const invalidPredicates = new Set<unknown>();
  const validatePredicateShape = (predicate: unknown, path: string): void => {
    if (predicate === undefined) return;
    if (!isRecord(predicate)) {
      errors.push(`${path} must be an object.`);
      invalidPredicates.add(predicate);
      return;
    }
    if (!isNonEmptyString(predicate.instanceId) || !instanceIds.has(predicate.instanceId)) {
      errors.push(`${path}.instanceId must reference a declared technique instance.`);
      invalidPredicates.add(predicate);
    }
    if (predicate.kind === "configuration") {
      if (!isNonEmptyString(predicate.slotId) || !isConfigurationValue(predicate.equals)) {
        errors.push(`${path} requires a slotId and typed primitive equals value.`);
        invalidPredicates.add(predicate);
      }
    } else if (predicate.kind === "approval") {
      if (!isNonEmptyString(predicate.gateId) || typeof predicate.equals !== "boolean") {
        errors.push(`${path} requires a gateId and boolean equals value.`);
        invalidPredicates.add(predicate);
      }
    } else {
      errors.push(`${path}.kind must be configuration or approval.`);
      invalidPredicates.add(predicate);
    }
  };
  source.techniqueInstances.filter(isRecord).forEach((instance, index) =>
    validatePredicateShape(instance.enabledWhen, `lab.techniqueInstances[${index}].enabledWhen`));
  source.compositionConnections.forEach((connection, index) => {
    if (!isRecord(connection)) {
      errors.push(`lab.compositionConnections[${index}] must be an object.`);
      return;
    }
    validatePredicateShape(connection.enabledWhen, `lab.compositionConnections[${index}].enabledWhen`);
    if (connection.id !== undefined && !isCompositionToken(connection.id)) {
      errors.push(`lab.compositionConnections[${index}].id must be composition-safe when supplied.`);
    }
    if (!isNonEmptyString(connection.label)) {
      errors.push(`lab.compositionConnections[${index}].label must be a non-empty string.`);
    }
    for (const [direction, endpoint] of [["from", connection.from], ["to", connection.to]] as const) {
      validateEndpointShape(endpoint, `lab.compositionConnections[${index}].${direction}`);
    }
  });
  if (source.compositionEdgeOrder !== undefined) {
    const connectionIds = new Set<string>();
    source.compositionConnections.forEach((connection, index) => {
      if (!isRecord(connection) || !isCompositionToken(connection.id)) {
        errors.push(`lab.compositionConnections[${index}].id is required by compositionEdgeOrder.`);
      } else if (connectionIds.has(connection.id)) {
        errors.push(`lab.compositionConnections[${index}].id repeats "${connection.id}".`);
      } else connectionIds.add(connection.id);
    });
  }
  const predicateIsDecidableWithoutTechnique = (predicate: CompositionBranchPredicate | undefined): boolean => {
    if (!predicate || predicate.kind === "approval") return true;
    const key = `${predicate.instanceId}.${predicate.slotId}`;
    const binding = source.techniqueInstances.find((instance) =>
      isRecord(instance) && instance.instanceId === predicate.instanceId)?.bindings;
    return isRecord(binding) && isRecord(binding.configuration) && binding.configuration[predicate.slotId] !== undefined ||
      source.reachabilityWitnesses.every((witness) => witness.configuration[key] !== undefined);
  };

  const witnessIds = new Set<string>();
  for (const [index, witness] of source.reachabilityWitnesses.entries()) {
    const path = `lab.reachabilityWitnesses[${index}]`;
    if (!isRecord(witness)) {
      errors.push(`${path} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(witness.id)) errors.push(`${path}.id must be a non-empty string.`);
    else if (witnessIds.has(witness.id)) errors.push(`${path}.id repeats "${witness.id}".`);
    witnessIds.add(witness.id);
    if (!isRecord(witness.configuration) || !Object.values(witness.configuration).every(isConfigurationValue)) {
      errors.push(`${path}.configuration must contain only typed primitive values.`);
    }
    if (!isRecord(witness.approvalGates) || !Object.values(witness.approvalGates).every((value) => typeof value === "boolean")) {
      errors.push(`${path}.approvalGates must contain only booleans.`);
    }
  }
  if (errors.length > 0) {
    validateLocalActionEffects(source, errors);
    return { ok: false, errors };
  }
  for (const instance of source.techniqueInstances.filter(isRecord)) {
    if (!invalidPredicates.has(instance.enabledWhen) && predicateIsDecidableWithoutTechnique(instance.enabledWhen) &&
      !source.reachabilityWitnesses.some((witness) => witnessEnables(instance.enabledWhen, witness, source))) {
      errors.push(`Technique instance "${instance.instanceId}" is dead under every declared reachability witness.`);
    }
  }
  for (const [index, connection] of source.compositionConnections.entries()) {
    if (!isRecord(connection)) {
      errors.push(`lab.compositionConnections[${index}] must be an object.`);
      continue;
    }
    if (connection.enabledWhen && !invalidPredicates.has(connection.enabledWhen) &&
      predicateIsDecidableWithoutTechnique(connection.enabledWhen) &&
      !source.reachabilityWitnesses.some((witness) => witnessEnables(connection.enabledWhen, witness, source))) {
      errors.push(`Composition connection ${index} is dead under every declared reachability witness.`);
    }
  }
  validateLocalActionEffects(source, errors);
  return errors.length === 0 ? { ok: true, value: source, errors: [] } : { ok: false, errors };
};

export const validateInstanceBindings = (
  source: LabCompositionSourceDefinition,
  instance: TechniqueInstanceRef,
  technique: TechniqueDefinition,
): string[] => {
  const errors: string[] = [];
  const contract = technique.composition;
  if (!contract) return [`Technique "${technique.id}" has no composition contract for instance "${instance.instanceId}".`];
  if (contract.catalogDisposition !== "composable" && contract.catalogDisposition !== "lab-scoped") {
    errors.push(
      `Instance "${instance.instanceId}" cannot compose technique "${technique.id}" with catalog disposition "${contract.catalogDisposition}".`,
    );
  }
  const labEquipment = new Set(source.equipment);
  const initialInstances = new Map((source.initialState?.equipment ?? []).map((item) => [item.id, item.definitionId]));
  const techniqueInstances = new Map(technique.initialState.equipment.map((item) => [item.id, item.definitionId]));
  const concreteMappings = createConcreteEquipmentMappingTracker();
  const reserveConcreteMapping = (sourceInstanceId: string, targetInstanceId: string, path: string): void => {
    const conflict = concreteMappings.reserve(sourceInstanceId, targetInstanceId, path);
    if (!conflict) return;
    if (conflict.endpoint === "source") {
      errors.push(
        `${path} multiply owns source instance "${sourceInstanceId}": it maps to target "${targetInstanceId}", but ${conflict.priorOwner} already maps it to target "${conflict.priorTargetInstanceId}".`,
      );
    } else {
      errors.push(
        `${path} multiply owns target instance "${targetInstanceId}": source "${sourceInstanceId}" conflicts with source "${conflict.priorSourceInstanceId}" already mapped by ${conflict.priorOwner}.`,
      );
    }
  };
  for (const role of contract.equipmentRoles) {
    const binding = instance.bindings.equipment[role.roleId];
    if (role.required && !binding) {
      errors.push(`Instance "${instance.instanceId}" is missing required equipment role "${role.roleId}".`);
      continue;
    }
    if (!binding) continue;
    if (!isRecord(binding)) {
      errors.push(`Instance "${instance.instanceId}" role "${role.roleId}" binding must be an object.`);
      continue;
    }
    const validateTarget = (definitionId: unknown, targetInstanceId: unknown, path: string): void => {
      if (!isNonEmptyString(definitionId) || !isNonEmptyString(targetInstanceId)) {
        errors.push(`${path} requires non-empty definitionId and instanceId.`);
        return;
      }
      if (!labEquipment.has(definitionId)) errors.push(`${path} binds undeclared lab equipment "${definitionId}".`);
      if (!initialInstances.has(targetInstanceId)) errors.push(`${path} binds missing lab initial-state instance "${targetInstanceId}".`);
      else if (initialInstances.get(targetInstanceId) !== definitionId) {
        errors.push(`${path} binds instance "${targetInstanceId}" with mismatched definition "${initialInstances.get(targetInstanceId)}".`);
      }
      if (role.allowedDefinitionIds && !role.allowedDefinitionIds.includes(definitionId)) {
        errors.push(`${path} rejects equipment "${definitionId}".`);
      }
      if (!roleAcceptsEquipment(role.roleId, definitionId)) {
        errors.push(`${path} is incompatible with registry equipment "${definitionId}".`);
      }
    };
    if ("sourceInstances" in binding) {
      const path = `Instance "${instance.instanceId}" role "${role.roleId}"`;
      if (!Array.isArray(binding.sourceInstances) || binding.sourceInstances.length === 0) {
        errors.push(`${path} sourceInstances must be a non-empty array.`);
        continue;
      }
      if (!role.sourceInstanceIds) {
        errors.push(`${path} plural binding requires explicit contract sourceInstanceIds; inference is forbidden.`);
      }
      const mappedForRole = new Set<string>();
      for (const [mappingIndex, mapping] of binding.sourceInstances.entries()) {
        const mappingPath = `${path} sourceInstances[${mappingIndex}]`;
        if (!isRecord(mapping) || !isNonEmptyString(mapping.sourceInstanceId)) {
          errors.push(`${mappingPath} requires a non-empty sourceInstanceId.`);
          continue;
        }
        const sourceDefinitionId = techniqueInstances.get(mapping.sourceInstanceId);
        if (!sourceDefinitionId) errors.push(`${mappingPath} references missing technique instance "${mapping.sourceInstanceId}".`);
        if (mappedForRole.has(mapping.sourceInstanceId)) {
          errors.push(`${mappingPath} multiply owns source instance "${mapping.sourceInstanceId}".`);
        }
        mappedForRole.add(mapping.sourceInstanceId);
        if (isNonEmptyString(mapping.instanceId)) reserveConcreteMapping(mapping.sourceInstanceId, mapping.instanceId, mappingPath);
        if (sourceDefinitionId && role.allowedDefinitionIds && !role.allowedDefinitionIds.includes(sourceDefinitionId)) {
          errors.push(`${mappingPath} source definition "${sourceDefinitionId}" is not permitted by role "${role.roleId}".`);
        }
        if (sourceDefinitionId && !roleAcceptsEquipment(role.roleId, sourceDefinitionId)) {
          errors.push(`${mappingPath} source definition "${sourceDefinitionId}" is incompatible with registry role "${role.roleId}".`);
        }
        validateTarget(mapping.definitionId, mapping.instanceId, mappingPath);
      }
      const declaredSources = new Set(role.sourceInstanceIds ?? []);
      for (const sourceId of declaredSources) if (!mappedForRole.has(sourceId)) errors.push(`${path} is missing source instance mapping "${sourceId}".`);
      for (const sourceId of mappedForRole) if (!declaredSources.has(sourceId)) errors.push(`${path} maps undeclared source instance "${sourceId}".`);
    } else {
      if (role.sourceInstanceIds && role.sourceInstanceIds.length > 1) {
        errors.push(`Instance "${instance.instanceId}" role "${role.roleId}" requires one explicit mapping per source instance.`);
      }
      validateTarget(binding.definitionId, binding.instanceId, `Instance "${instance.instanceId}" role "${role.roleId}"`);
      const sourceDefinitionIds = new Set(technique.actions.flatMap((action) => {
        const definitionId = action.equipmentRoleBindings?.[role.roleId];
        return definitionId ? [definitionId] : [];
      }));
      const concreteSources = role.sourceInstanceIds?.length === 1
        ? technique.initialState.equipment.filter((item) => item.id === role.sourceInstanceIds![0])
        : technique.initialState.equipment.filter((item) => sourceDefinitionIds.has(item.definitionId));
      if (!role.sourceInstanceIds && concreteSources.length > 1) {
        errors.push(`Instance "${instance.instanceId}" role "${role.roleId}" matches multiple source instances; explicit per-source mappings are required.`);
      } else if (concreteSources.length === 1 && isNonEmptyString(binding.instanceId)) {
        const sourceItem = concreteSources[0];
        if (role.allowedDefinitionIds && !role.allowedDefinitionIds.includes(sourceItem.definitionId)) {
          errors.push(`Instance "${instance.instanceId}" role "${role.roleId}" source definition "${sourceItem.definitionId}" is not permitted.`);
        }
        if (!roleAcceptsEquipment(role.roleId, sourceItem.definitionId)) {
          errors.push(`Instance "${instance.instanceId}" role "${role.roleId}" source definition "${sourceItem.definitionId}" is registry-incompatible.`);
        }
        reserveConcreteMapping(
          sourceItem.id,
          binding.instanceId,
          `Instance "${instance.instanceId}" role "${role.roleId}"`,
        );
      }
    }
  }
  const declaredRoles = new Set(contract.equipmentRoles.map((role) => role.roleId));
  for (const roleId of Object.keys(instance.bindings.equipment)) {
    if (!declaredRoles.has(roleId)) errors.push(`Instance "${instance.instanceId}" binds undeclared equipment role "${roleId}".`);
  }
  const collections = {
    titration: source.titrationModels ?? [],
    chromatography: source.chromatographyModels ?? [],
    kinetics: source.kineticsModels ?? [],
  } as const;
  for (const slot of contract.modelSlots) {
    const modelId = instance.bindings.models[slot.id];
    if (slot.required && !modelId) errors.push(`Instance "${instance.instanceId}" is missing model slot "${slot.id}".`);
    if (modelId && !collections[slot.kind].some((model) => model.id === modelId)) {
      errors.push(`Instance "${instance.instanceId}" model slot "${slot.id}" binds unknown lab model "${modelId}".`);
    }
  }
  const declaredModelSlots = new Set(contract.modelSlots.map((slot) => slot.id));
  for (const slotId of Object.keys(instance.bindings.models)) {
    if (!declaredModelSlots.has(slotId)) errors.push(`Instance "${instance.instanceId}" binds undeclared model slot "${slotId}".`);
  }
  for (const slot of contract.configurationSlots) {
    const value = instance.bindings.configuration[slot.id] ?? slot.defaultValue;
    if (slot.required && value === undefined) errors.push(`Instance "${instance.instanceId}" is missing configuration slot "${slot.id}".`);
    else if (value !== undefined && !slotAcceptsValue(slot, value)) {
      errors.push(`Instance "${instance.instanceId}" configuration slot "${slot.id}" has an incompatible value.`);
    }
  }
  const declaredConfigurationSlots = new Set(contract.configurationSlots.map((slot) => slot.id));
  for (const slotId of Object.keys(instance.bindings.configuration)) {
    if (!declaredConfigurationSlots.has(slotId)) errors.push(`Instance "${instance.instanceId}" binds undeclared configuration slot "${slotId}".`);
  }
  if (instance.variantId !== undefined && !contract.variants.some((variant) => variant.id === instance.variantId)) {
    errors.push(`Instance "${instance.instanceId}" selects undeclared variant "${instance.variantId}".`);
  }
  for (const sourceActionId of Object.keys(instance.preserveIds?.actions ?? {})) {
    if (!technique.actions.some((action) => action.id === sourceActionId)) {
      errors.push(`Instance "${instance.instanceId}" preserves unknown source action id "${sourceActionId}".`);
    }
  }
  for (const sourceNodeId of Object.keys(instance.preserveIds?.nodes ?? {})) {
    if (!technique.process.nodes.some((node) => node.id === sourceNodeId)) {
      errors.push(`Instance "${instance.instanceId}" preserves unknown source node id "${sourceNodeId}".`);
    }
  }
  const validationRuleIds = new Set([
    ...technique.actions.flatMap((action) => action.prerequisites.map((rule) => rule.id)),
    ...technique.process.nodes.flatMap((node) => node.validation.map((rule) => rule.id)),
    ...technique.successCriteria.map((rule) => rule.id),
  ]);
  for (const sourceRuleId of Object.keys(instance.preserveIds?.validationRules ?? {})) {
    if (!validationRuleIds.has(sourceRuleId)) {
      errors.push(`Instance "${instance.instanceId}" preserves unknown source validation rule id "${sourceRuleId}".`);
    }
  }
  const referenceKeys = new Set([
    "sourceMeasurements", "timeMeasurements", "measuredComponentMassIds", "tareMassIds",
    "repeatGroupId", "nextScopeId", "pairId", "systemId", "referenceId", "progressId",
  ]);
  const ownerLocalReferences = new Set<string>();
  const collectReferences = (value: unknown, key = ""): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => collectReferences(item, key));
      return;
    }
    if (isRecord(value)) {
      Object.entries(value).forEach(([childKey, child]) => collectReferences(child, childKey));
      return;
    }
    if (typeof value !== "string" || /^\{\{config\./.test(value)) return;
    if (/MeasurementIds?$/i.test(key) || /CalculationIds?$/i.test(key) || /ReferenceIds?$/i.test(key) || /OutputIds?$/i.test(key) || /ProgressIds?$/i.test(key) ||
      /EvidenceId$/i.test(key) || /EvidenceScopeId$/i.test(key) || /NotebookTag$/i.test(key) ||
      /DataSeriesIds?$/i.test(key) || referenceKeys.has(key)) {
      ownerLocalReferences.add(value);
    }
  };
  technique.actions.forEach((action) => collectReferences(action));
  technique.process.nodes.forEach((node) => collectReferences(node));
  technique.process.edges.forEach((edge) => collectReferences(edge));
  technique.successCriteria.forEach((rule) => collectReferences(rule));
  contract.evidenceOutputs.forEach((output) => collectReferences(output));
  const preservedReferenceTargets = new Map<string, string>();
  for (const [sourceReferenceId, targetReferenceId] of Object.entries(instance.preserveIds?.references ?? {})) {
    if (!ownerLocalReferences.has(sourceReferenceId)) {
      errors.push(`Instance "${instance.instanceId}" preserves unknown owner-local reference id "${sourceReferenceId}".`);
    }
    const previous = preservedReferenceTargets.get(targetReferenceId);
    if (previous && previous !== sourceReferenceId) {
      errors.push(
        `Instance "${instance.instanceId}" maps owner-local references "${previous}" and "${sourceReferenceId}" to the same preserved id "${targetReferenceId}".`,
      );
    }
    preservedReferenceTargets.set(targetReferenceId, sourceReferenceId);
  }
  return errors;
};

export const validateCompositionManifest = (
  input: unknown,
): ValidationResult<CompositionManifest> => {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["compositionManifest must be an object."] };
  const manifest = input as unknown as CompositionManifest;
  if (manifest.schemaVersion !== 1) errors.push("compositionManifest.schemaVersion must be 1.");
  if (!(["1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] as const).includes(manifest.compilerContractVersion)) {
    errors.push("compositionManifest.compilerContractVersion must be 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, or 1.6.");
  }
  if (manifest.status !== "compiled" && manifest.status !== "detached") errors.push("compositionManifest.status is invalid.");
  const allowedManifestKeys = new Set(["schemaVersion", "compilerContractVersion", "status", "instances", "origins"]);
  for (const key of Object.keys(manifest)) {
    if (!allowedManifestKeys.has(key)) errors.push(`compositionManifest contains unsupported field "${key}".`);
  }
  const instanceIds = new Set<string>();
  if (!Array.isArray(manifest.instances)) errors.push("compositionManifest.instances must be an array.");
  else for (const [index, instance] of manifest.instances.entries()) {
    if (!isRecord(instance)) {
      errors.push(`compositionManifest.instances[${index}] must be an object.`);
      continue;
    }
    for (const key of ["instanceId", "techniqueId", "version"] as const) {
      if (!isNonEmptyString(instance[key])) errors.push(`compositionManifest.instances[${index}].${key} must be a non-empty string.`);
    }
    if (!Number.isInteger(instance.repeatIndex) || Number(instance.repeatIndex) < 0) {
      errors.push(`compositionManifest.instances[${index}].repeatIndex must be a non-negative integer.`);
    }
    if (isNonEmptyString(instance.instanceId)) {
      if (instanceIds.has(instance.instanceId)) errors.push(`compositionManifest repeats instance "${instance.instanceId}".`);
      instanceIds.add(instance.instanceId);
    }
    if (instance.variantId !== undefined && !isNonEmptyString(instance.variantId)) {
      errors.push(`compositionManifest.instances[${index}].variantId must be a non-empty string when provided.`);
    }
    if (!Array.isArray(instance.evidenceOutputs)) {
      errors.push(`compositionManifest.instances[${index}].evidenceOutputs must be an array.`);
    } else {
      const outputIds = new Set<string>();
      for (const [outputIndex, output] of instance.evidenceOutputs.entries()) {
        if (!isRecord(output)) {
          errors.push(`compositionManifest.instances[${index}].evidenceOutputs[${outputIndex}] must be an object.`);
          continue;
        }
        for (const key of ["id", "sourceId", "kind", "actionId"] as const) {
          if (!isNonEmptyString(output[key])) {
            errors.push(`compositionManifest.instances[${index}].evidenceOutputs[${outputIndex}].${key} must be a non-empty string.`);
          }
        }
        if (isNonEmptyString(output.kind) && !evidenceOutputKinds.has(output.kind)) {
          errors.push(`compositionManifest.instances[${index}].evidenceOutputs[${outputIndex}].kind is invalid.`);
        }
        if (isNonEmptyString(output.id) && outputIds.has(output.id)) {
          errors.push(`compositionManifest instance "${instance.instanceId}" repeats evidence output "${output.id}".`);
        }
        if (isNonEmptyString(output.id)) outputIds.add(output.id);
        if (output.referenceId !== undefined && !isNonEmptyString(output.referenceId)) {
          errors.push(`compositionManifest.instances[${index}].evidenceOutputs[${outputIndex}].referenceId must be a non-empty string.`);
        }
        const outputAllowed = new Set(["id", "sourceId", "kind", "actionId", "referenceId"]);
        for (const key of Object.keys(output)) {
          if (!outputAllowed.has(key)) {
            errors.push(`compositionManifest.instances[${index}].evidenceOutputs[${outputIndex}] contains unsupported field "${key}".`);
          }
        }
      }
    }
    if (!isRecord(instance.completion)) {
      errors.push(`compositionManifest.instances[${index}].completion must be an object.`);
    } else {
      const completionAllowed = new Set(["exitNodeIds", "requiredEvidenceOutputIds", "requiredValidationRuleIds"]);
      for (const key of completionAllowed) {
        const value = instance.completion[key];
        if (!Array.isArray(value) || !value.every(isNonEmptyString) || new Set(value).size !== value.length) {
          errors.push(`compositionManifest.instances[${index}].completion.${key} must be a unique string array.`);
        }
      }
      for (const key of Object.keys(instance.completion)) {
        if (!completionAllowed.has(key)) {
          errors.push(`compositionManifest.instances[${index}].completion contains unsupported field "${key}".`);
        }
      }
    }
    const allowed = new Set([
      "instanceId", "techniqueId", "version", "repeatIndex", "variantId", "evidenceOutputs", "completion",
    ]);
    for (const key of Object.keys(instance)) if (!allowed.has(key)) errors.push(`compositionManifest.instances[${index}] contains unsupported field "${key}".`);
  }
  const originKeys = new Set<string>();
  if (!Array.isArray(manifest.origins)) errors.push("compositionManifest.origins must be an array.");
  else for (const [index, origin] of manifest.origins.entries()) {
    if (!isRecord(origin)) {
      errors.push(`compositionManifest.origins[${index}] must be an object.`);
      continue;
    }
    for (const key of ["nodeId", "techniqueId", "techniqueVersion", "instanceId", "sourceNodeId"] as const) {
      if (!isNonEmptyString(origin[key])) errors.push(`compositionManifest.origins[${index}].${key} must be a non-empty string.`);
    }
    if ((origin.actionId === undefined) !== (origin.sourceActionId === undefined)) {
      errors.push(`compositionManifest.origins[${index}] must provide actionId and sourceActionId together.`);
    }
    if (origin.actionId !== undefined && !isNonEmptyString(origin.actionId)) {
      errors.push(`compositionManifest.origins[${index}].actionId must be a non-empty string when provided.`);
    }
    if (origin.sourceActionId !== undefined && !isNonEmptyString(origin.sourceActionId)) {
      errors.push(`compositionManifest.origins[${index}].sourceActionId must be a non-empty string when provided.`);
    }
    if (isNonEmptyString(origin.instanceId) && !instanceIds.has(origin.instanceId)) {
      errors.push(`compositionManifest origin references unknown instance "${origin.instanceId}".`);
    }
    const identity = String(origin.nodeId);
    if (originKeys.has(identity)) errors.push(`compositionManifest repeats origin identity "${identity}".`);
    originKeys.add(identity);
    const allowed = new Set(["actionId", "nodeId", "techniqueId", "techniqueVersion", "instanceId", "sourceActionId", "sourceNodeId"]);
    for (const key of Object.keys(origin)) if (!allowed.has(key)) errors.push(`compositionManifest.origins[${index}] contains unsupported field "${key}".`);
  }
  if (Array.isArray(manifest.instances) && Array.isArray(manifest.origins)) {
    for (const instance of manifest.instances) {
      if (!isRecord(instance) || !isNonEmptyString(instance.instanceId)) continue;
      const instanceOrigins = manifest.origins.filter((origin) =>
        isRecord(origin) && origin.instanceId === instance.instanceId);
      for (const origin of instanceOrigins) {
        if (origin.techniqueId !== instance.techniqueId || origin.techniqueVersion !== instance.version) {
          errors.push(`compositionManifest origin for instance "${instance.instanceId}" conflicts with its technique/version mapping.`);
        }
      }
      if (Array.isArray(instance.evidenceOutputs)) {
        for (const output of instance.evidenceOutputs) {
          if (isRecord(output) && isNonEmptyString(output.actionId) &&
            !instanceOrigins.some((origin) => origin.actionId === output.actionId)) {
            errors.push(`compositionManifest evidence output "${output.id}" is not owned by instance "${instance.instanceId}".`);
          }
        }
      }
      if (isRecord(instance.completion) && Array.isArray(instance.completion.exitNodeIds)) {
        for (const nodeId of instance.completion.exitNodeIds) {
          if (!instanceOrigins.some((origin) => origin.nodeId === nodeId)) {
            errors.push(`compositionManifest completion exit node "${nodeId}" is not owned by instance "${instance.instanceId}".`);
          }
        }
      }
    }
  }
  const forbidden = /(?:[A-Z]:[\\/]|file:\/\/|sha256|fileId|provider|runtimeId|assetPath)/i;
  if (forbidden.test(JSON.stringify(manifest))) {
    errors.push("compositionManifest contains a forbidden build/runtime/private locator field or value.");
  }
  return errors.length === 0 ? { ok: true, value: manifest, errors: [] } : { ok: false, errors };
};

export const isCompositionSource = (
  source: BundledLabSourceDefinition,
): source is LabCompositionSourceDefinition => "techniqueInstances" in source;
