import type {
  ActionDefinition,
  EquipmentInstance,
  LabDefinition,
  ProcessDefinition,
  RuntimeState,
  TechniqueDefinition,
} from "../domain/types";
import { resolveTitrationActions } from "../domain/titrationModels";
import { createEquipmentInstance } from "../equipment/catalog";
import { deriveLegacyAttachments } from "./attachments";

export type RuntimeDefinition = LabDefinition | TechniqueDefinition;

export const isLabDefinition = (definition: RuntimeDefinition): definition is LabDefinition =>
  "techniques" in definition && "audience" in definition;

export const getProcess = (definition: RuntimeDefinition): ProcessDefinition => definition.process;

const resolvedActionsCache = new WeakMap<RuntimeDefinition, ActionDefinition[]>();

export const getActions = (definition: RuntimeDefinition): ActionDefinition[] => {
  const cached = resolvedActionsCache.get(definition);
  if (cached) return cached;
  const resolved = resolveTitrationActions(definition, definition.actions);
  resolvedActionsCache.set(definition, resolved);
  return resolved;
};

const uniqueInstances = (instances: EquipmentInstance[]): EquipmentInstance[] => {
  const seen = new Set<string>();
  return instances.filter((instance) => {
    if (seen.has(instance.id)) return false;
    seen.add(instance.id);
    return true;
  });
};

const cloneEquipmentInstance = (item: EquipmentInstance): EquipmentInstance => ({
  ...item,
  contents: {
    ...item.contents,
    solutes: item.contents.solutes.map((solute) => ({ ...solute })),
    contamination: [...item.contents.contamination],
    concentration: item.contents.concentration ? { ...item.contents.concentration } : undefined,
    precipitate: item.contents.precipitate ? { ...item.contents.precipitate } : undefined,
    chromatogram: item.contents.chromatogram
      ? {
          ...item.contents.chromatogram,
          bands: item.contents.chromatogram.bands.map((band) => ({ ...band })),
        }
      : undefined,
    instrumentReadout: item.contents.instrumentReadout
      ? { ...item.contents.instrumentReadout }
      : undefined,
    qualitativeSolidProvenance: item.contents.qualitativeSolidProvenance?.map((record) => ({
      ...record,
      measurementEvidenceIds: [...record.measurementEvidenceIds],
      recoveryEvidenceIds: [...record.recoveryEvidenceIds],
      routeEvidenceIds: [...record.routeEvidenceIds],
    })),
  },
});

export const getInitialEquipment = (definition: RuntimeDefinition): EquipmentInstance[] => {
  if (!isLabDefinition(definition)) {
    return definition.initialState.equipment.map(cloneEquipmentInstance);
  }

  if (definition.initialState?.equipment) {
    const presentDefinitionIds = new Set(
      definition.initialState.equipment.map((instance) => instance.definitionId),
    );
    const missing = definition.equipment
      .filter((definitionId) => !presentDefinitionIds.has(definitionId))
      .map((definitionId) => createEquipmentInstance(definitionId));
    return uniqueInstances([...definition.initialState.equipment, ...missing]).map(cloneEquipmentInstance);
  }

  const fromTechniques = definition.techniques.flatMap((technique) => technique.initialState.equipment);
  const presentDefinitionIds = new Set(fromTechniques.map((instance) => instance.definitionId));
  const missing = definition.equipment
    .filter((definitionId) => !presentDefinitionIds.has(definitionId))
    .map((definitionId) => createEquipmentInstance(definitionId));

  return uniqueInstances([...fromTechniques, ...missing]).map(cloneEquipmentInstance);
};

export const createRuntimeState = (
  definition: RuntimeDefinition,
  mode: RuntimeState["mode"] = "guided",
): RuntimeState => {
  const equipmentInstances = getInitialEquipment(definition);
  return {
    currentNodeId: getProcess(definition).startNodeId,
    equipmentInstances,
    attachments: deriveLegacyAttachments(equipmentInstances),
    contents: Object.fromEntries(equipmentInstances.map((instance) => [instance.id, instance.contents])),
    measurements: [],
    dataSeries: [],
    temperatureEvidence: [],
    thermalControls: {},
    evidenceScopeId: "scope-1",
    evidenceScopeGeneration: 1,
    // A wholly fresh runtime has initialized nothing. `performRuntimeAction`'s physical reset
    // rebuilds from here and re-adds only the records it names, so the empty map survives it.
    solidStockInitializations: {},
    // Generic photometer blank readiness is runtime-only and starts empty for every instrument.
    // The epoch makes an old blank unusable after a physical or authored scoped reset.
    photometerCalibration: {},
    photometerCalibrationEpoch: 1,
    calculations: [],
    dropDispenses: {},
    repeatProgress: {},
    notebook: [],
    completedNodes: [],
    validationEvidence: [],
    attemptHistory: [],
    feedbackQueue: [
      {
        id: "runtime-start",
        timestamp: new Date().toISOString(),
        severity: "info",
        message: `Loaded ${definition.title}.`,
        nodeId: getProcess(definition).startNodeId,
      },
    ],
    mode,
    importedLabs: [],
  };
};
