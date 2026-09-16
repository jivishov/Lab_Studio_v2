import {
  compatibleInteractionVerbs,
  defaultInteractionForAction,
  interactionOperationTypes,
} from "../domain/interactions";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  LabDefinition,
} from "../domain/types";
import {
  collectTitrationModels,
  deriveTitrationDropPlan,
} from "../domain/titrationModels";
import { equipmentById } from "../equipment/catalog";

export interface StudioInteractionIssue {
  actionId: string;
  message: string;
}

const sourceRequired = new Set<ActionInteractionSpec["type"]>([
  "dragToZone",
  "snapIntoTarget",
  "pourInto",
  "dispenseDrops",
  "spotOnto",
  "placeInInstrument",
  "readInstrument",
]);

const targetRequired = new Set<ActionInteractionSpec["type"]>([
  "snapIntoTarget",
  "pourInto",
  "dispenseDrops",
  "spotOnto",
  "rinseTarget",
  "placeInInstrument",
]);

const stationRequired = new Set<ActionInteractionSpec["type"]>([
  "dragToZone",
  "placeInInstrument",
  "readInstrument",
]);

export const collectStudioEquipmentIds = (draft: LabDefinition): string[] =>
  Array.from(
    new Set([
      ...draft.equipment,
      ...draft.techniques.flatMap((technique) => technique.requiredEquipment),
      ...draft.techniques.flatMap((technique) =>
        technique.initialState.equipment.map((instance) => instance.definitionId),
      ),
    ]),
  );

const isBlank = (value: string | undefined): boolean =>
  value === undefined || value.trim().length === 0;

const pushReferenceIssue = (
  issues: StudioInteractionIssue[],
  action: ActionDefinition,
  availableEquipmentIds: Set<string>,
  field: "sourceDefinitionId" | "targetDefinitionId",
  value: string | undefined,
): void => {
  if (!value) return;
  if (!equipmentById.has(value)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} references unknown ${field} "${value}".`,
    });
    return;
  }
  if (!availableEquipmentIds.has(value)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} references ${value}, but it is not included in this draft's equipment.`,
    });
  }
};

const findSnapZone = (
  snapZoneId: string | undefined,
  targetDefinitionId: string | undefined,
) => {
  if (!snapZoneId) return undefined;
  if (targetDefinitionId) {
    return equipmentById
      .get(targetDefinitionId)
      ?.snapZones.find((zone) => zone.id === snapZoneId);
  }
  for (const definition of equipmentById.values()) {
    const zone = definition.snapZones.find((candidate) => candidate.id === snapZoneId);
    if (zone) return zone;
  }
  return undefined;
};

const collectInteractionIssues = (
  action: ActionDefinition,
  availableEquipmentIds: Set<string>,
): StudioInteractionIssue[] => {
  const issues: StudioInteractionIssue[] = [];
  const interaction = action.interaction ?? defaultInteractionForAction(action);
  if (!action.interaction) {
    issues.push({
      actionId: action.id,
      message: `${action.label} is missing an explicit interaction spec.`,
    });
  }
  if (!interaction) return issues;

  if (!interactionOperationTypes.includes(interaction.type)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} uses an unsupported interaction operation.`,
    });
    return issues;
  }

  if (!compatibleInteractionVerbs[interaction.type].includes(action.verb)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} uses ${interaction.type}, which is not compatible with ${action.verb}.`,
    });
  }

  if (sourceRequired.has(interaction.type) && isBlank(interaction.sourceDefinitionId)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} is missing interaction source equipment.`,
    });
  }

  if (targetRequired.has(interaction.type) && isBlank(interaction.targetDefinitionId)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} is missing interaction target equipment.`,
    });
  }

  if (stationRequired.has(interaction.type) && isBlank(interaction.stationId)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} is missing an interaction station.`,
    });
  }

  if (interaction.type === "submitCalculation" && isBlank(interaction.valueParameter)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} is missing the calculation value parameter.`,
    });
  }

  if (isBlank(interaction.accessibleLabel)) {
    issues.push({
      actionId: action.id,
      message: `${action.label} is missing an accessible interaction label.`,
    });
  }

  pushReferenceIssue(
    issues,
    action,
    availableEquipmentIds,
    "sourceDefinitionId",
    interaction.sourceDefinitionId,
  );
  pushReferenceIssue(
    issues,
    action,
    availableEquipmentIds,
    "targetDefinitionId",
    interaction.targetDefinitionId,
  );

  const snapZone = findSnapZone(interaction.snapZoneId, interaction.targetDefinitionId);
  if (interaction.snapZoneId && !snapZone) {
    issues.push({
      actionId: action.id,
      message: `${action.label} references an unknown snap zone.`,
    });
  } else if (
    snapZone &&
    interaction.sourceDefinitionId &&
    !snapZone.accepts.includes(interaction.sourceDefinitionId)
  ) {
    issues.push({
      actionId: action.id,
      message: `${action.label} uses a snap zone that does not accept ${interaction.sourceDefinitionId}.`,
    });
  }

  const sourceDefinition = interaction.sourceDefinitionId
    ? equipmentById.get(interaction.sourceDefinitionId)
    : undefined;
  const targetDefinition = interaction.targetDefinitionId
    ? equipmentById.get(interaction.targetDefinitionId)
    : undefined;
  if (interaction.type === "pourInto" || interaction.type === "dispenseDrops") {
    if (sourceDefinition && !sourceDefinition.affordances.includes("pourable")) {
      issues.push({
        actionId: action.id,
        message: `${action.label} uses ${interaction.sourceDefinitionId} as a liquid source, but that equipment is not pourable.`,
      });
    }
    if (
      targetDefinition &&
      !targetDefinition.affordances.some((affordance) =>
        affordance === "fillable" || affordance === "filterTarget"
      )
    ) {
      issues.push({
        actionId: action.id,
        message: `${action.label} pours into ${interaction.targetDefinitionId}, but that equipment cannot receive liquid.`,
      });
    }
  }
  if (interaction.type === "spotOnto" && targetDefinition && !targetDefinition.affordances.includes("spotTarget")) {
    issues.push({
      actionId: action.id,
      message: `${action.label} spots onto ${interaction.targetDefinitionId}, but that equipment is not a spot target.`,
    });
  }

  return issues;
};

const numericParameter = (action: ActionDefinition, key: string): number | undefined => {
  const value = action.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const stringParameter = (action: ActionDefinition, key: string): string | undefined => {
  const value = action.parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const differsFromDerived = (
  explicit: number | undefined,
  derived: number,
): boolean =>
  explicit !== undefined && Math.abs(explicit - derived) > 1e-9;

const collectTitrationModelIssues = (draft: LabDefinition): StudioInteractionIssue[] => {
  const models = new Map(collectTitrationModels(draft).map((model) => [model.id, model]));
  return draft.actions.flatMap((action) => {
    const modelId = stringParameter(action, "titrationModelId");
    if (!modelId) return [];

    const model = models.get(modelId);
    if (!model) {
      return [{
        actionId: action.id,
        message: `${action.label} references unknown titration model "${modelId}".`,
      }];
    }

    try {
      const plan = deriveTitrationDropPlan(model, {
        initialBuretteReadingMl: numericParameter(action, "initialBuretteReadingMl"),
      });
      if (
        action.interaction?.type === "dispenseDrops" &&
        (differsFromDerived(numericParameter(action, "dropVolumeMl"), plan.dropVolumeMl) ||
          differsFromDerived(numericParameter(action, "equivalenceDropCount"), plan.equivalenceDropCount) ||
          differsFromDerived(numericParameter(action, "endpointDropCount"), plan.endpointDropCount) ||
          differsFromDerived(numericParameter(action, "volumeMl"), plan.endpointDeliveredVolumeMl) ||
          differsFromDerived(numericParameter(action, "maxExtraDrops"), plan.maxExtraDrops))
      ) {
        return [{
          actionId: action.id,
          message: `${action.label} uses titration model "${modelId}"; explicit drop settings differ and will be ignored.`,
        }];
      }
    } catch (error) {
      return [{
        actionId: action.id,
        message: `${action.label} references invalid titration model "${modelId}".`,
      }];
    }

    return [];
  });
};

export const collectStudioInteractionIssues = (
  draft: LabDefinition,
): StudioInteractionIssue[] => {
  const availableEquipmentIds = new Set(collectStudioEquipmentIds(draft));
  return [
    ...draft.actions.flatMap((action) =>
      collectInteractionIssues(action, availableEquipmentIds),
    ),
    ...collectTitrationModelIssues(draft),
  ];
};
