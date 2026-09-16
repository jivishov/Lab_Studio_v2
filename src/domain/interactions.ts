import type {
  ActionDefinition,
  ActionInteractionSpec,
  ActionInteractionType,
  ActionParameterValue,
  ActionVerb,
} from "./types";
import { definiteEquipmentLabel, sentenceEquipmentLabel } from "./equipmentLabels";
import { equipmentById } from "../equipment/catalog";

export const interactionOperationTypes: readonly ActionInteractionType[] = [
  "dragToZone",
  "snapIntoTarget",
  "pourInto",
  "dispenseDrops",
  "spotOnto",
  "rinseTarget",
  "placeInInstrument",
  "readInstrument",
  "recordTimeSeries",
  "recordNotebook",
  "submitCalculation",
];

export const interactionStationIds = [
  "shelf",
  "workbench",
  "balance",
  "wet-bench",
  "filtration",
  "heating",
  "oven",
  "notebook",
  "calculator",
] as const;

export const compatibleInteractionVerbs: Record<ActionInteractionType, readonly ActionVerb[]> = {
  dragToZone: ["place", "reset"],
  snapIntoTarget: ["place", "developChromatogram"],
  pourInto: ["measureVolume", "transfer", "dissolve", "precipitate", "dilute", "filter", "stressEquilibrium"],
  dispenseDrops: ["transfer"],
  spotOnto: ["spotSample"],
  rinseTarget: ["rinse"],
  placeInInstrument: ["dry", "heat", "cool", "stressEquilibrium"],
  readInstrument: ["weigh", "measureVolume", "observe", "stressEquilibrium"],
  recordTimeSeries: ["record"],
  recordNotebook: ["calculate", "record", "observe", "stressEquilibrium", "mix", "vent", "settle", "dry", "cool", "transfer", "rinse"],
  submitCalculation: ["calculate"],
};

const stringParam = (
  parameters: Record<string, ActionParameterValue>,
  key: string,
): string | undefined => {
  const value = parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const inferSourceDefinitionId = (
  parameters: Record<string, ActionParameterValue>,
): string | undefined =>
  stringParam(parameters, "sourceDefinitionId") ??
  stringParam(parameters, "equipmentDefinitionId");

const inferTargetDefinitionId = (
  parameters: Record<string, ActionParameterValue>,
): string | undefined => stringParam(parameters, "targetDefinitionId");

const hasParameter = (
  parameters: Record<string, ActionParameterValue>,
  key: string,
): boolean => parameters[key] !== undefined;

const numberParam = (
  parameters: Record<string, ActionParameterValue>,
  key: string,
): number | undefined => {
  const value = parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const equipmentLabel = (definitionId: string | undefined, fallback: string): string =>
  definitionId ? equipmentById.get(definitionId)?.label ?? fallback : fallback;

const volumeLabel = (volumeMl: number | undefined): string =>
  volumeMl === undefined
    ? "the requested volume"
    : `${Number.isInteger(volumeMl) ? volumeMl.toFixed(0) : volumeMl.toFixed(1)} mL`;

const withCommonCues = (
  action: Pick<ActionDefinition, "label" | "feedback">,
  spec: Omit<ActionInteractionSpec, "accessibleLabel"> & { accessibleLabel?: string },
): ActionInteractionSpec => ({
  ...spec,
  successCue: spec.successCue ?? action.feedback.success,
  invalidCue: spec.invalidCue ?? action.feedback.invalid,
  accessibleLabel: spec.accessibleLabel ?? action.label,
});

const labelSentence = (label: string): string =>
  label.endsWith(".") ? label : `${label}.`;

export const defaultInteractionForAction = (
  action: Pick<ActionDefinition, "verb" | "label" | "parameters" | "feedback">,
): ActionInteractionSpec | undefined => {
  const sourceDefinitionId = inferSourceDefinitionId(action.parameters);
  const targetDefinitionId = inferTargetDefinitionId(action.parameters);
  const snapZoneId = stringParam(action.parameters, "snapZoneId");

  if (action.verb === "place") {
    if (targetDefinitionId || snapZoneId) {
      return withCommonCues(action, {
        type: "snapIntoTarget",
        sourceDefinitionId,
        targetDefinitionId,
        snapZoneId,
        accessibleLabel: labelSentence(action.label),
      });
    }
    return withCommonCues(action, {
      type: "dragToZone",
      sourceDefinitionId,
      stationId: stringParam(action.parameters, "location") ?? "workbench",
      accessibleLabel: action.label.toLowerCase().startsWith("place ")
        ? labelSentence(action.label)
        : `Move ${action.label} to the bench.`,
    });
  }

  if (action.verb === "measureVolume" || action.verb === "transfer") {
    const volumeMl = numberParam(action.parameters, "volumeMl");
    const sourceLabel = equipmentLabel(sourceDefinitionId, "the source container");
    const targetLabel = equipmentLabel(targetDefinitionId, "the target container");
    return withCommonCues(action, {
      type: "pourInto",
      sourceDefinitionId,
      targetDefinitionId,
      valueParameter: hasParameter(action.parameters, "volumeMl") ? "volumeMl" : undefined,
      accessibleLabel:
        action.verb === "measureVolume"
          ? `Pour ${sentenceEquipmentLabel(sourceLabel)} into ${sentenceEquipmentLabel(targetLabel)} until the meniscus reaches ${volumeLabel(volumeMl)}.`
          : `Pour ${volumeLabel(volumeMl)} from ${definiteEquipmentLabel(sourceLabel)} into ${definiteEquipmentLabel(targetLabel)}.`,
    });
  }

  if (action.verb === "dissolve" || action.verb === "precipitate" || action.verb === "dilute" || action.verb === "filter") {
    return withCommonCues(action, {
      type: "pourInto",
      sourceDefinitionId,
      targetDefinitionId,
      valueParameter: hasParameter(action.parameters, "volumeMl") ? "volumeMl" : undefined,
      accessibleLabel: `Use a pour action for ${action.label}.`,
    });
  }

  if (action.verb === "spotSample") {
    return withCommonCues(action, {
      type: "spotOnto",
      sourceDefinitionId: sourceDefinitionId ?? "capillary-spotter",
      targetDefinitionId,
      accessibleLabel: `Spot the sample onto ${definiteEquipmentLabel(equipmentLabel(targetDefinitionId, "the chromatography paper"))}.`,
    });
  }

  if (action.verb === "developChromatogram") {
    return withCommonCues(action, {
      type: "snapIntoTarget",
      sourceDefinitionId,
      targetDefinitionId,
      snapZoneId,
      accessibleLabel: `Place ${definiteEquipmentLabel(equipmentLabel(sourceDefinitionId, "the spotted chromatography paper"))} into ${definiteEquipmentLabel(equipmentLabel(targetDefinitionId, "the chromatography chamber"))}.`,
    });
  }

  if (action.verb === "rinse") {
    return withCommonCues(action, {
      type: "rinseTarget",
      sourceDefinitionId: sourceDefinitionId ?? "wash-bottle",
      targetDefinitionId,
      accessibleLabel: `Rinse for ${action.label}.`,
    });
  }

  if (action.verb === "dry") {
    const instrumentDefinitionId =
      stringParam(action.parameters, "ovenDefinitionId") ??
      stringParam(action.parameters, "instrumentDefinitionId") ??
      "drying-oven";
    const sampleDefinitionId = sourceDefinitionId ?? targetDefinitionId;
    return withCommonCues(action, {
      type: "placeInInstrument",
      sourceDefinitionId: sampleDefinitionId,
      targetDefinitionId: instrumentDefinitionId,
      stationId: instrumentDefinitionId,
      accessibleLabel: `Place the sample in the drying oven for ${action.label}.`,
    });
  }

  if (action.verb === "heat") {
    const instrumentDefinitionId =
      targetDefinitionId ??
      stringParam(action.parameters, "heatSourceDefinitionId") ??
      stringParam(action.parameters, "instrumentDefinitionId") ??
      "bunsen-burner";
    return withCommonCues(action, {
      type: "placeInInstrument",
      sourceDefinitionId,
      targetDefinitionId: instrumentDefinitionId,
      stationId: instrumentDefinitionId,
      accessibleLabel: `Heat ${definiteEquipmentLabel(equipmentLabel(sourceDefinitionId, "the sample"))} with ${definiteEquipmentLabel(equipmentLabel(instrumentDefinitionId, "the heat source"))}.`,
    });
  }

  if (action.verb === "cool") {
    const toolDefinitionId =
      targetDefinitionId ??
      stringParam(action.parameters, "coolingToolDefinitionId") ??
      stringParam(action.parameters, "instrumentDefinitionId") ??
      "crucible-tongs";
    return withCommonCues(action, {
      type: "placeInInstrument",
      sourceDefinitionId,
      targetDefinitionId: toolDefinitionId,
      stationId: toolDefinitionId,
      accessibleLabel: `Use ${definiteEquipmentLabel(equipmentLabel(toolDefinitionId, "the cooling tool"))} to let ${definiteEquipmentLabel(equipmentLabel(sourceDefinitionId, "the heated sample"))} cool before weighing.`,
    });
  }

  if (action.verb === "stressEquilibrium") {
    const stressType = stringParam(action.parameters, "stressType") ?? "stress";
    const valueParameter = hasParameter(action.parameters, "volumeMl") ? "volumeMl" : undefined;
    if (sourceDefinitionId && targetDefinitionId) {
      return withCommonCues(action, {
        type: "pourInto",
        sourceDefinitionId,
        targetDefinitionId,
        valueParameter,
        accessibleLabel: `Apply the ${stressType} stress for ${action.label}.`,
      });
    }
    return withCommonCues(action, {
      type: "recordNotebook",
      valueParameter: "note",
      accessibleLabel: `Record the equilibrium evidence for ${action.label}.`,
    });
  }

  if (action.verb === "weigh") {
    const instrumentDefinitionId =
      stringParam(action.parameters, "instrumentDefinitionId") ??
      (targetDefinitionId === "analytical-balance" ? targetDefinitionId : undefined);
    return withCommonCues(action, {
      type: "readInstrument",
      sourceDefinitionId: sourceDefinitionId ?? targetDefinitionId,
      targetDefinitionId: instrumentDefinitionId,
      stationId: instrumentDefinitionId ?? "analytical-balance",
      accessibleLabel: `Read the balance for ${action.label}.`,
    });
  }

  if (action.verb === "record" || action.verb === "observe" || action.verb === "mix" || action.verb === "vent" || action.verb === "settle") {
    if (action.verb === "record" && stringParam(action.parameters, "kineticsModelId")) {
      return withCommonCues(action, {
        type: "recordTimeSeries",
        valueParameter: "dataSeriesId",
        accessibleLabel: `Record timed gas-volume data for ${action.label}.`,
      });
    }
    return withCommonCues(action, {
      type: "recordNotebook",
      valueParameter: action.verb === "record" ? "measurementId" : "note",
      accessibleLabel: `Record evidence for ${action.label}.`,
    });
  }

  if (action.verb === "calculate") {
    return withCommonCues(action, {
      type: "submitCalculation",
      valueParameter: "calculationId",
      accessibleLabel: `Submit calculation for ${action.label}.`,
    });
  }

  if (action.verb === "reset") {
    return withCommonCues(action, {
      type: "dragToZone",
      stationId: "workbench",
      accessibleLabel: "Reset the lab setup.",
    });
  }

  return undefined;
};

export const resolveActionInteraction = (
  action: ActionDefinition,
): ActionInteractionSpec | undefined => action.interaction ?? defaultInteractionForAction(action);
