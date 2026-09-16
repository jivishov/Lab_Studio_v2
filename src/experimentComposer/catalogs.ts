import { equipmentById } from "../equipment/catalog";
import { familyValidator, moduleValidator, validateSchema } from "./schemas";
import type {
  ComposerChemicalId,
  ComposerEquipmentId,
  ComposerModuleId,
  ComposerRoleId,
  LabInventoryProfile,
  VerifiedExperimentFamily,
  VerifiedModuleDescriptor,
} from "./types";

export const SYNTHETIC_UNKNOWN_ACID_MOLARITY_M = 0.0992;
export const SYNTHETIC_UNKNOWN_ACID_DEFAULT_QUANTITY_ML = 120;
export const DEFAULT_BURETTE_FILL_ML = 50;
export const INDICATOR_ADDITION_ML = 0.1;
export const ACID_RESERVE_ML = 5;
export const NAOH_RESERVE_ML = 5;
export const FINE_WINDOW_DROPS = 10;

export const composerEquipmentIds = Object.freeze([
  "burette-50ml",
  "ring-stand-clamp",
  "graduated-cylinder",
  "erlenmeyer-flask-250ml",
  "waste-beaker",
] as const satisfies readonly ComposerEquipmentId[]);

export const composerChemicalContainers = Object.freeze({
  synthetic_unknown_acid_a: "unknown-acid-bottle",
  standardized_naoh: "naoh-bottle",
  phenolphthalein_indicator: "phenolphthalein-dropper",
} as const satisfies Record<ComposerChemicalId, string>);

export const roleDefinitionIds = Object.freeze({
  burette: "burette-50ml",
  burette_support: "ring-stand-clamp",
  aliquot_measure: "graduated-cylinder",
  receiving_flask: "erlenmeyer-flask-250ml",
  waste_receiver: "waste-beaker",
  analyte_source: "unknown-acid-bottle",
  titrant_source: "naoh-bottle",
  indicator_source: "phenolphthalein-dropper",
} as const satisfies Record<ComposerRoleId, string>);

const module = (descriptor: VerifiedModuleDescriptor): VerifiedModuleDescriptor => {
  const validation = validateSchema(moduleValidator, descriptor);
  if (!validation.ok) {
    throw new Error(`Invalid verified Composer module ${descriptor.id}: ${validation.diagnostics.map((item) => item.message).join("; ")}`);
  }
  return Object.freeze({
    ...descriptor,
    requiredRoleIds: Object.freeze([...descriptor.requiredRoleIds]),
    actionIds: Object.freeze([...descriptor.actionIds]),
    nodeIds: Object.freeze([...descriptor.nodeIds]),
    prerequisiteModuleIds: Object.freeze([...descriptor.prerequisiteModuleIds]),
  });
};

export const verifiedModuleDescriptors = Object.freeze([
  module({
    id: "mount_burette_v1",
    version: "1.0.0",
    label: "Set up and mount the prefilled burette",
    requiredRoleIds: ["burette", "burette_support"],
    actionIds: ["place-ring-stand", "mount-burette"],
    nodeIds: ["place-ring-stand-node", "mount-burette-node"],
    prerequisiteModuleIds: [],
    evidenceContract: "The support is placed and the burette is mounted through ordinary action evidence.",
    limitation: "The P0 inventory uses a prefilled modeled burette and does not rehearse conditioning or filling.",
  }),
  module({
    id: "record_initial_burette_v1",
    version: "1.0.0",
    label: "Read and record the initial burette level",
    requiredRoleIds: ["burette"],
    actionIds: ["read-initial-burette", "record-initial-burette"],
    nodeIds: ["read-initial-burette-node", "record-initial-burette-node"],
    prerequisiteModuleIds: ["mount_burette_v1"],
    evidenceContract: "The instrument reading and matching notebook entry are both required.",
  }),
  module({
    id: "measure_aliquot_cylinder_v1",
    version: "1.0.0",
    label: "Measure the configured acid aliquot",
    requiredRoleIds: ["analyte_source", "aliquot_measure"],
    actionIds: ["measure-acid"],
    nodeIds: ["measure-acid-node"],
    prerequisiteModuleIds: ["record_initial_burette_v1"],
    evidenceContract: "The graduated-cylinder pour records the measured aliquot volume.",
  }),
  module({
    id: "record_aliquot_v1",
    version: "1.0.0",
    label: "Retain aliquot measurement evidence",
    requiredRoleIds: ["aliquot_measure"],
    actionIds: ["measure-acid"],
    nodeIds: ["measure-acid-node"],
    prerequisiteModuleIds: ["measure_aliquot_cylinder_v1"],
    evidenceContract: "The existing measurement action is the single source of aliquot evidence; no duplicate runtime action is created.",
  }),
  module({
    id: "transfer_aliquot_v1",
    version: "1.0.0",
    label: "Transfer the measured aliquot to the flask",
    requiredRoleIds: ["aliquot_measure", "receiving_flask"],
    actionIds: ["transfer-acid-flask"],
    nodeIds: ["transfer-acid-flask-node"],
    prerequisiteModuleIds: ["record_aliquot_v1"],
    evidenceContract: "The ordinary pour action must complete before indicator addition.",
  }),
  module({
    id: "add_indicator_v1",
    version: "1.0.0",
    label: "Add phenolphthalein indicator",
    requiredRoleIds: ["indicator_source", "receiving_flask"],
    actionIds: ["add-indicator"],
    nodeIds: ["add-indicator-node"],
    prerequisiteModuleIds: ["transfer_aliquot_v1"],
    evidenceContract: "The configured indicator transfer must complete before titration.",
  }),
  module({
    id: "dispense_titrant_v1",
    version: "1.0.0",
    label: "Position the flask and dispense NaOH",
    requiredRoleIds: ["burette", "burette_support", "receiving_flask", "titrant_source"],
    actionIds: ["position-flask-under-burette", "deliver-titrant"],
    nodeIds: ["position-flask-under-burette-node", "deliver-titrant-node"],
    prerequisiteModuleIds: ["add_indicator_v1"],
    evidenceContract: "The flask must be positioned and the ordinary drop endpoint must be accepted.",
  }),
  module({
    id: "observe_indicator_endpoint_v1",
    version: "1.0.0",
    label: "Record persistent pale-pink endpoint evidence",
    requiredRoleIds: ["receiving_flask", "indicator_source"],
    actionIds: ["confirm-endpoint"],
    nodeIds: ["confirm-endpoint-node"],
    prerequisiteModuleIds: ["dispense_titrant_v1"],
    evidenceContract: "A notebook entry records qualitative indicator evidence after endpoint acceptance.",
    limitation: "Indicator color is qualitative and is not a numeric pH measurement.",
  }),
  module({
    id: "record_final_burette_v1",
    version: "1.0.0",
    label: "Record the final burette reading",
    requiredRoleIds: ["burette"],
    actionIds: ["record-final-burette"],
    nodeIds: ["record-final-burette-node"],
    prerequisiteModuleIds: ["observe_indicator_endpoint_v1"],
    evidenceContract: "The endpoint-generated final reading is copied to the notebook.",
  }),
  module({
    id: "calculate_molarity_v1",
    version: "1.0.0",
    label: "Estimate the acid molarity",
    requiredRoleIds: ["aliquot_measure", "burette"],
    actionIds: ["calculate-acid-molarity"],
    nodeIds: ["calculate-acid-molarity-node"],
    prerequisiteModuleIds: ["record_final_burette_v1"],
    evidenceContract: "The calculation requires the aliquot and both burette readings and is checked within the verified tolerance.",
  }),
]);

export const verifiedModulesById = new Map<ComposerModuleId, VerifiedModuleDescriptor>(
  verifiedModuleDescriptors.map((descriptor) => [descriptor.id, descriptor]),
);

export const p0ModuleIds = Object.freeze([
  "mount_burette_v1",
  "record_initial_burette_v1",
  "measure_aliquot_cylinder_v1",
  "record_aliquot_v1",
  "transfer_aliquot_v1",
  "add_indicator_v1",
  "dispense_titrant_v1",
  "observe_indicator_endpoint_v1",
  "record_final_burette_v1",
  "calculate_molarity_v1",
] as const satisfies readonly ComposerModuleId[]);

const p0ModuleDescriptors = p0ModuleIds.map((moduleId) => {
  const descriptor = verifiedModulesById.get(moduleId);
  if (!descriptor) throw new Error(`Verified P0 module "${moduleId}" is missing.`);
  return descriptor;
});

/**
 * The compiler consumes these exact source pairs. Deriving them from the frozen module catalog
 * prevents the public provenance sequence and the executable 12-step sequence from drifting apart.
 * `record_aliquot_v1` intentionally reuses the measurement pair and therefore contributes no
 * duplicate runtime action or node.
 */
p0ModuleDescriptors.forEach((descriptor, index) => {
  if (descriptor.actionIds.length !== descriptor.nodeIds.length) {
    throw new Error(`Verified P0 module "${descriptor.id}" must pair each action with one process node.`);
  }
  descriptor.prerequisiteModuleIds.forEach((prerequisiteId) => {
    const prerequisiteIndex = p0ModuleIds.indexOf(prerequisiteId);
    if (prerequisiteIndex < 0 || prerequisiteIndex >= index) {
      throw new Error(`Verified P0 module "${descriptor.id}" has an out-of-order prerequisite "${prerequisiteId}".`);
    }
  });
});

const seenActionIds = new Map<string, string>();
const seenNodeIds = new Map<string, string>();
const p0SourcePairs = p0ModuleDescriptors.flatMap((descriptor) =>
  descriptor.actionIds.flatMap((actionId, index) => {
    const nodeId = descriptor.nodeIds[index]!;
    const previousNodeId = seenActionIds.get(actionId);
    const previousActionId = seenNodeIds.get(nodeId);
    if (previousNodeId && previousNodeId !== nodeId) {
      throw new Error(`Verified P0 action "${actionId}" maps to both "${previousNodeId}" and "${nodeId}".`);
    }
    if (previousActionId && previousActionId !== actionId) {
      throw new Error(`Verified P0 node "${nodeId}" maps to both "${previousActionId}" and "${actionId}".`);
    }
    if (previousNodeId === nodeId && previousActionId === actionId) return [];
    seenActionIds.set(actionId, nodeId);
    seenNodeIds.set(nodeId, actionId);
    return [{ actionId, nodeId }];
  }),
);

export const p0ActionIds = Object.freeze(p0SourcePairs.map(({ actionId }) => actionId));
export const p0NodeIds = Object.freeze(p0SourcePairs.map(({ nodeId }) => nodeId));

if (p0ActionIds.length !== 12 || p0NodeIds.length !== 12) {
  throw new Error("The frozen P0 module catalog must resolve to exactly 12 unique action/node pairs.");
}

const family: VerifiedExperimentFamily = {
  id: "acid_base_titration_v1",
  version: "1.0.0",
  sourceLabId: "acid-base-titration",
  sourceLabVersion: "3.0.1",
  sourceTechniqueId: "titration-endpoint",
  sourceTechniqueVersion: "3.0.1",
  supportedObjectives: [
    "Estimate the molarity of a synthetic monoprotic-acid sample by titration with standardized sodium hydroxide.",
  ],
  parameterBounds: {
    aliquotVolumeMl: [10, 20, 25],
    titrantMolarityM: { min: 0.05, max: 0.2 },
  },
  requiredRoles: Object.keys(roleDefinitionIds) as ComposerRoleId[],
  optionalRoles: [],
  moduleIds: [...p0ModuleIds],
  modelLimitations: [
    "Synthetic sample only.",
    "Aliquot precision follows the graduated cylinder rather than a volumetric pipette.",
    "Phenolphthalein evidence is qualitative; no pH curve or indicator-equilibrium model is included.",
  ],
};

const familyValidation = validateSchema(familyValidator, family);
if (!familyValidation.ok) {
  throw new Error(`Invalid verified Composer family: ${familyValidation.diagnostics.map((item) => item.message).join("; ")}`);
}

export const acidBaseTitrationFamily = Object.freeze(family);

export const defaultLabInventory = (): LabInventoryProfile => ({
  schemaVersion: "1",
  revision: 0,
  equipment: composerEquipmentIds.map((definitionId) => ({ definitionId, count: 1 })),
  chemicals: [
    {
      chemicalId: "synthetic_unknown_acid_a",
      quantityMl: SYNTHETIC_UNKNOWN_ACID_DEFAULT_QUANTITY_ML,
      containerDefinitionId: composerChemicalContainers.synthetic_unknown_acid_a,
    },
    {
      chemicalId: "standardized_naoh",
      quantityMl: 120,
      concentrationM: 0.1,
      containerDefinitionId: composerChemicalContainers.standardized_naoh,
    },
    {
      chemicalId: "phenolphthalein_indicator",
      quantityMl: 30,
      containerDefinitionId: composerChemicalContainers.phenolphthalein_indicator,
    },
  ],
  facilities: {
    splashGoggles: true,
    eyewash: true,
    spillResponseMaterials: true,
    compatibleBaseWasteContainer: true,
  },
});

export const verifiedEquipmentCapabilities = Object.freeze(
  [...composerEquipmentIds, ...Object.values(composerChemicalContainers)].map((definitionId) => {
    const definition = equipmentById.get(definitionId);
    if (!definition) throw new Error(`Verified Composer equipment "${definitionId}" is absent from equipmentById.`);
    return Object.freeze({
      definitionId,
      capacityMl: definition.capacity.unit === "mL" ? definition.capacity.amount : 0,
      precisionMl: definition.precision.unit === "mL" ? definition.precision.amount : 0,
      affordances: Object.freeze([...definition.affordances]),
    });
  }),
);
