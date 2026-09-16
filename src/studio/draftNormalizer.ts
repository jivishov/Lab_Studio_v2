import { defaultInteractionForAction } from "../domain/interactions";
import type {
  ActionDefinition,
  LabDefinition,
  TechniqueDefinition,
} from "../domain/types";

const legacySampleSourceId = "sample-rack";
const sampleBottleId = "sample-bottle";
const graduatedCylinderId = "graduated-cylinder";
const sampleBottleLabel = "Sample bottle";

type NormalizedValue = {
  value: unknown;
  repaired: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const replaceSampleRackText = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  return value.replace(/sample rack/gi, (match) =>
    match.startsWith("S") ? "Sample bottle" : "sample bottle",
  );
};

const normalizeInteractionRecord = (interaction: Record<string, unknown>) => {
  let changed = false;
  const next = { ...interaction };

  if (next.sourceDefinitionId === legacySampleSourceId) {
    next.sourceDefinitionId = sampleBottleId;
    changed = true;
  }

  for (const key of ["accessibleLabel", "successCue", "invalidCue"] as const) {
    const replacement = replaceSampleRackText(next[key]);
    if (replacement !== next[key]) {
      next[key] = replacement;
      changed = true;
    }
  }

  return changed ? next : interaction;
};

const normalizeActionRecord = (action: unknown): NormalizedValue => {
  if (!isRecord(action)) return { value: action, repaired: false };

  const parameters = isRecord(action.parameters) ? action.parameters : undefined;
  const interaction = isRecord(action.interaction) ? action.interaction : undefined;
  const targetDefinitionId =
    stringValue(parameters?.targetDefinitionId) ??
    stringValue(interaction?.targetDefinitionId);
  const hasLegacySampleSource =
    parameters?.sourceDefinitionId === legacySampleSourceId ||
    interaction?.sourceDefinitionId === legacySampleSourceId;

  if (
    action.verb !== "measureVolume" ||
    targetDefinitionId !== graduatedCylinderId ||
    !hasLegacySampleSource
  ) {
    return { value: action, repaired: false };
  }

  const next = { ...action };
  if (parameters?.sourceDefinitionId === legacySampleSourceId) {
    next.parameters = {
      ...parameters,
      sourceDefinitionId: sampleBottleId,
    };
  }
  if (interaction) {
    next.interaction = normalizeInteractionRecord(interaction);
  }

  return { value: next, repaired: true };
};

const normalizeActionArray = (actions: unknown): NormalizedValue => {
  if (!Array.isArray(actions)) return { value: actions, repaired: false };
  let repaired = false;
  const value = actions.map((action) => {
    const normalized = normalizeActionRecord(action);
    repaired ||= normalized.repaired;
    return normalized.value;
  });
  return { value: repaired ? value : actions, repaired };
};

const normalizeEquipmentIds = (equipmentIds: unknown, shouldRepair: boolean): unknown => {
  if (!shouldRepair || !Array.isArray(equipmentIds)) return equipmentIds;

  let changed = false;
  const seen = new Set<string>();
  const normalized: unknown[] = [];

  for (const equipmentId of equipmentIds) {
    const nextId = equipmentId === legacySampleSourceId ? sampleBottleId : equipmentId;
    changed ||= nextId !== equipmentId;
    if (typeof nextId === "string") {
      if (seen.has(nextId)) {
        changed = true;
        continue;
      }
      seen.add(nextId);
    }
    normalized.push(nextId);
  }

  return changed ? normalized : equipmentIds;
};

const hasLiquidContents = (contents: unknown): boolean => {
  if (!isRecord(contents)) return false;
  return (
    contents.kind === "liquid" ||
    contents.kind === "solution" ||
    contents.kind === "mixture" ||
    typeof contents.volumeMl === "number"
  );
};

const sampleBottleInstanceId = (id: unknown): string => {
  if (typeof id !== "string" || id.trim().length === 0) return "sample-bottle-1";
  return id.startsWith(legacySampleSourceId)
    ? id.replace(legacySampleSourceId, sampleBottleId)
    : "sample-bottle-1";
};

const normalizeInitialEquipment = (equipment: unknown, shouldRepair: boolean): unknown => {
  if (!shouldRepair || !Array.isArray(equipment)) return equipment;
  const hasSampleBottle = equipment.some(
    (instance) => isRecord(instance) && instance.definitionId === sampleBottleId,
  );
  if (hasSampleBottle) return equipment;

  let changed = false;
  const normalized = equipment.map((instance) => {
    if (
      isRecord(instance) &&
      instance.definitionId === legacySampleSourceId &&
      hasLiquidContents(instance.contents)
    ) {
      changed = true;
      return {
        ...instance,
        id: sampleBottleInstanceId(instance.id),
        definitionId: sampleBottleId,
        label: sampleBottleLabel,
      };
    }
    return instance;
  });

  return changed ? normalized : equipment;
};

const normalizeTechniqueRecord = (technique: unknown): NormalizedValue => {
  if (!isRecord(technique)) return { value: technique, repaired: false };

  const actions = normalizeActionArray(technique.actions);
  const initialState = isRecord(technique.initialState)
    ? {
        ...technique.initialState,
        equipment: normalizeInitialEquipment(technique.initialState.equipment, actions.repaired),
      }
    : technique.initialState;

  if (!actions.repaired) return { value: technique, repaired: false };

  return {
    value: {
      ...technique,
      requiredEquipment: normalizeEquipmentIds(technique.requiredEquipment, true),
      initialState,
      actions: actions.value,
    },
    repaired: true,
  };
};

const normalizeTechniqueArray = (techniques: unknown): NormalizedValue => {
  if (!Array.isArray(techniques)) return { value: techniques, repaired: false };
  let repaired = false;
  const value = techniques.map((technique) => {
    const normalized = normalizeTechniqueRecord(technique);
    repaired ||= normalized.repaired;
    return normalized.value;
  });
  return { value: repaired ? value : techniques, repaired };
};

const normalizeLabRecord = (lab: Record<string, unknown>): NormalizedValue => {
  const actions = normalizeActionArray(lab.actions);
  const techniques = normalizeTechniqueArray(lab.techniques);
  const repaired = actions.repaired || techniques.repaired;

  if (!repaired) return { value: lab, repaired: false };

  return {
    value: {
      ...lab,
      equipment: normalizeEquipmentIds(lab.equipment, true),
      techniques: techniques.value,
      actions: actions.value,
    },
    repaired: true,
  };
};

export const normalizeStudioDefinitionCandidate = (definition: unknown): unknown => {
  if (!isRecord(definition)) return definition;
  if ("audience" in definition && "equipment" in definition && "techniques" in definition) {
    return normalizeLabRecord(definition).value;
  }
  if ("learningGoal" in definition && "requiredEquipment" in definition && "initialState" in definition) {
    return normalizeTechniqueRecord(definition).value;
  }
  return definition;
};

const normalizeValidatedAction = (action: ActionDefinition): ActionDefinition => {
  if (action.interaction) return action;
  const interaction = defaultInteractionForAction(action);
  return interaction ? { ...action, interaction } : action;
};

const normalizeValidatedActions = (
  actions: ActionDefinition[],
): ActionDefinition[] => {
  let changed = false;
  const normalized = actions.map((action) => {
    const nextAction = normalizeValidatedAction(action);
    changed ||= nextAction !== action;
    return nextAction;
  });
  return changed ? normalized : actions;
};

export const normalizeStudioTechniqueDraft = (
  technique: TechniqueDefinition,
): TechniqueDefinition => {
  const repairedTechnique =
    normalizeStudioDefinitionCandidate(technique) as TechniqueDefinition;
  const actions = normalizeValidatedActions(repairedTechnique.actions);
  return actions === repairedTechnique.actions
    ? repairedTechnique
    : {
        ...repairedTechnique,
        actions,
      };
};

export const normalizeStudioLabDraft = (draft: LabDefinition): LabDefinition => {
  const repairedDraft = normalizeStudioDefinitionCandidate(draft) as LabDefinition;
  const actions = normalizeValidatedActions(repairedDraft.actions);
  let techniquesChanged = false;
  const techniques = repairedDraft.techniques.map((technique) => {
    const nextTechnique = normalizeStudioTechniqueDraft(technique);
    techniquesChanged ||= nextTechnique !== technique;
    return nextTechnique;
  });

  if (actions === repairedDraft.actions && !techniquesChanged) {
    return repairedDraft;
  }

  return {
    ...repairedDraft,
    actions,
    techniques: techniquesChanged ? techniques : repairedDraft.techniques,
  };
};
