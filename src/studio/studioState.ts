import { defaultInteractionForAction } from "../domain/interactions";
import { generatedLayoutForNode } from "../domain/processLayout";
import type {
  ActionAnalysisContract,
  ActionDefinition,
  ActionEvidenceReference,
  ActionMassConsumerContinuity,
  ActionMassContract,
  ActionMassProducerContinuity,
  ActionParameterValue,
  ActionVolumeContract,
  ActionVerb,
  EquipmentInstance,
  LabDefinition,
  ProcessEdge,
  ProcessNode,
  ProcessNodeType,
  TechniqueDefinition,
  ValidationRule,
} from "../domain/types";
import { demoLab } from "../domain/fixtures";
import { normalizeStudioLabDraft } from "./draftNormalizer";

export interface StudioTemplate {
  id: string;
  title: string;
  nodeType?: ProcessNodeType;
  verb?: ActionVerb;
  description: string;
  requiredEquipment: string[];
  labId?: string;
  techniqueId?: string;
}

export const studioTemplates: StudioTemplate[] = [
  {
    id: "template-acid-base-titration",
    title: "Acid-base titration",
    description: "Load the complete diagram-authored titration lab.",
    requiredEquipment: [
      "unknown-acid-bottle",
      "graduated-cylinder",
      "erlenmeyer-flask-250ml",
      "phenolphthalein-dropper",
      "naoh-bottle",
      "burette-50ml",
      "ring-stand-clamp",
      "ph-meter",
      "waste-beaker",
    ],
    labId: "acid-base-titration",
  },
  {
    id: "template-marble-statue-kinetics",
    title: "Marble statue kinetics",
    description: "Load the complete gas-syringe kinetics lab.",
    requiredEquipment: [
      "reagent-bottle",
      "graduated-cylinder",
      "erlenmeyer-flask-250ml",
      "rubber-stopper-delivery-tube",
      "gas-syringe",
      "marble-chips",
      "analytical-balance",
      "watch-glass",
      "stopwatch",
      "hot-plate-stirrer",
      "thermometer",
      "waste-beaker",
    ],
    labId: "marble-statue-kinetics",
  },
  {
    id: "template-paper-chromatography",
    title: "Paper chromatography lab",
    description: "Load the complete paper chromatography lab.",
    requiredEquipment: ["chromatography-chamber", "chromatography-paper", "capillary-spotter", "metric-ruler"],
    labId: "paper-chromatography",
  },
  {
    id: "template-equilibrium-rainbow-display",
    title: "Equilibrium display lab",
    description: "Load the complete equilibrium stress display lab.",
    requiredEquipment: [
      "small-vial",
      "reagent-tray",
      "luer-lock-syringe-locked",
      "distilled-water-bottle",
    ],
    labId: "equilibrium-rainbow-display",
  },
  {
    id: "template-transmittance-dilution-technique",
    title: "Spectrophotometer dilution",
    description: "Append a reusable spectrophotometer dilution workflow.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "volumetric-flask",
      "wash-bottle",
      "rubber-stopper-set",
      "cuvette",
      "spectrophotometer",
    ],
    techniqueId: "transmittance-dilution",
  },
  {
    id: "template-paper-chromatography-technique",
    title: "Paper chromatography",
    description: "Append a reusable paper chromatography workflow.",
    requiredEquipment: ["chromatography-chamber", "chromatography-paper", "capillary-spotter", "metric-ruler"],
    techniqueId: "paper-chromatography",
  },
  {
    id: "template-thermal-decomposition-technique",
    title: "Thermal decomposition",
    description: "Append a reusable carbonate heating and reweighing workflow.",
    requiredEquipment: [
      "analytical-balance",
      "crucible-with-lid",
      "bunsen-burner",
      "crucible-tongs",
      "ring-stand",
      "clay-triangle",
    ],
    techniqueId: "thermal-decomposition-mass-loss",
  },
  {
    id: "template-beers-law-calibration",
    title: "Beer's law calibration",
    description: "Append a reusable Beer's law calibration workflow.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "volumetric-flask",
      "wash-bottle",
      "cuvette",
      "spectrophotometer",
      "data-collection-interface",
    ],
    techniqueId: "beers-law-calibration",
  },
  {
    id: "template-brass-spectrophotometry",
    title: "Brass spectrophotometry",
    description: "Append a reusable brass sample spectrophotometry workflow.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "volumetric-flask",
      "wash-bottle",
      "cuvette",
      "spectrophotometer",
      "data-collection-interface",
    ],
    techniqueId: "brass-spectrophotometry",
  },
  {
    id: "template-hard-water-gravimetry",
    title: "Hard water gravimetry",
    description: "Append a reusable hard water filtration and drying workflow.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "beaker-250ml",
      "stirring-rod",
      "buchner-funnel",
      "side-arm-filter-flask",
      "vacuum-source",
      "filter-paper",
      "wash-bottle",
      "drying-oven",
      "watch-glass",
      "analytical-balance",
    ],
    techniqueId: "hard-water-gravimetry",
  },
  {
    id: "template-titration-endpoint",
    title: "Titration endpoint",
    description: "Append a reusable acid-base titration endpoint workflow.",
    requiredEquipment: [
      "unknown-acid-bottle",
      "graduated-cylinder",
      "erlenmeyer-flask-250ml",
      "phenolphthalein-dropper",
      "naoh-bottle",
      "burette-50ml",
      "ring-stand-clamp",
      "waste-beaker",
    ],
    techniqueId: "titration-endpoint",
  },
  {
    id: "template-bonding-solids-tests",
    title: "Bonding solids tests",
    description: "Append a reusable solids property testing workflow.",
    requiredEquipment: [
      "small-vial",
      "reagent-tray",
      "conductivity-tester",
      "melting-point-apparatus",
      "hot-plate-stirrer",
      "spatula",
      "watch-glass",
    ],
    techniqueId: "bonding-solids-tests",
  },
  {
    id: "template-redox-titration",
    title: "Redox titration",
    description: "Append a reusable redox titration workflow.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-cylinder",
      "erlenmeyer-flask-250ml",
      "burette-50ml",
      "ring-stand-clamp",
      "reagent-bottle",
      "wash-bottle",
      "waste-beaker",
    ],
    techniqueId: "redox-titration",
  },
  {
    id: "template-tablet-separation",
    title: "Tablet separation",
    description: "Append a reusable tablet component separation workflow.",
    requiredEquipment: [
      "analytical-balance",
      "beaker-250ml",
      "funnel",
      "filter-paper",
      "watch-glass",
      "drying-oven",
      "spatula",
      "magnet",
    ],
    techniqueId: "tablet-separation",
  },
  {
    id: "template-crystal-violet-kinetics",
    title: "Crystal violet kinetics",
    description: "Append a reusable crystal violet kinetics workflow.",
    requiredEquipment: [
      "sample-bottle",
      "graduated-pipette-10ml",
      "beral-pipette",
      "pipette-pump",
      "cuvette",
      "spectrophotometer",
      "stopwatch",
      "data-collection-interface",
    ],
    techniqueId: "crystal-violet-kinetics",
  },
  {
    id: "template-hand-warmer-calorimetry",
    title: "Hand-warmer calorimetry",
    description: "Append a reusable calorimetry and enthalpy workflow.",
    requiredEquipment: [
      "foam-cup-calorimeter",
      "thermometer",
      "analytical-balance",
      "watch-glass",
      "stirring-rod",
      "graduated-cylinder",
      "stopwatch",
    ],
    techniqueId: "hand-warmer-calorimetry",
  },
  {
    id: "template-titration-curve-analysis",
    title: "Titration curve analysis",
    description: "Append a reusable titration curve and pH workflow.",
    requiredEquipment: [
      "unknown-acid-bottle",
      "graduated-cylinder",
      "beaker-250ml",
      "burette-50ml",
      "ring-stand-clamp",
      "ph-meter",
      "ph-paper",
      "data-collection-interface",
    ],
    techniqueId: "titration-curve-analysis",
  },
  {
    id: "template-weigh",
    title: "Weigh item",
    nodeType: "action",
    verb: "weigh",
    description: "Place the watch glass on the balance and record the mass.",
    requiredEquipment: ["analytical-balance", "watch-glass", "spatula", "reagent-bottle"],
  },
  {
    id: "template-volume",
    title: "Measure volume",
    nodeType: "action",
    verb: "measureVolume",
    description: "Pour 20 mL of sample from the sample bottle into the graduated cylinder.",
    requiredEquipment: ["sample-bottle", "graduated-cylinder", "beaker-250ml"],
  },
  {
    id: "template-solution",
    title: "Make solution",
    nodeType: "action",
    verb: "dissolve",
    description: "Dissolve 2.5 g of solid from the reagent bottle in the volumetric flask.",
    requiredEquipment: [
      "analytical-balance",
      "watch-glass",
      "spatula",
      "reagent-bottle",
      "beaker-250ml",
      "stirring-rod",
      "volumetric-flask",
      "wash-bottle",
    ],
  },
  {
    id: "template-dilution",
    title: "Dilution",
    nodeType: "action",
    verb: "dilute",
    description: "Pour 10 mL from the graduated cylinder into the volumetric flask, then dilute to 100 mL.",
    requiredEquipment: ["reagent-bottle", "graduated-cylinder", "volumetric-flask", "wash-bottle"],
  },
  {
    id: "template-filtration",
    title: "Filtration",
    nodeType: "checkpoint",
    verb: "filter",
    description: "Pour the mixture from the beaker through the funnel stand.",
    requiredEquipment: [
      "beaker-250ml",
      "funnel-stand",
      "filter-paper",
      "erlenmeyer-flask-250ml",
      "wash-bottle",
      "stirring-rod",
    ],
  },
  {
    id: "template-drying",
    title: "Dry sample",
    nodeType: "action",
    verb: "dry",
    description: "Place the watch glass in the drying oven until the sample is dry.",
    requiredEquipment: ["watch-glass", "crucible-tongs", "drying-oven", "analytical-balance"],
  },
  {
    id: "template-thermal-decomposition",
    title: "Thermal decomposition",
    nodeType: "action",
    verb: "heat",
    description: "Heat the crucible with lid askew over the Bunsen burner.",
    requiredEquipment: ["analytical-balance", "crucible-with-lid", "bunsen-burner", "crucible-tongs"],
  },
  {
    id: "template-paper-chromatography",
    title: "Paper chromatography",
    nodeType: "checkpoint",
    verb: "developChromatogram",
    description: "Place spotted chromatography paper in a solvent chamber and develop visible bands.",
    requiredEquipment: ["chromatography-chamber", "chromatography-paper", "capillary-spotter", "metric-ruler"],
  },
  {
    id: "template-observe",
    title: "Observation",
    nodeType: "observation",
    verb: "observe",
    description: "Record the observation in the notebook.",
    requiredEquipment: [],
  },
  {
    id: "template-calc",
    title: "Calculation",
    nodeType: "calculation",
    verb: "calculate",
    description: "Submit the hardness calculation result.",
    requiredEquipment: [],
  },
];

const parameterDefaults = (
  template: StudioTemplate,
  index: number,
): Record<string, ActionParameterValue> => {
  if (!template.verb) return { supportedOnly: true };
  if (template.verb === "weigh") {
    return {
      sourceDefinitionId: "watch-glass",
      instrumentDefinitionId: "analytical-balance",
      measurementId: `mass-${index}`,
      expectedMassG: 1,
      tolerance: 0.005,
      supportedOnly: true,
    };
  }
  if (template.verb === "measureVolume") {
    return {
      sourceDefinitionId: "sample-bottle",
      targetDefinitionId: "graduated-cylinder",
      measurementId: `volume-${index}`,
      volumeMl: 20,
      tolerance: 1,
      supportedOnly: true,
    };
  }
  if (template.verb === "dissolve") {
    return {
      sourceDefinitionId: "reagent-bottle",
      targetDefinitionId: "volumetric-flask",
      soluteMassG: 2.5,
      finalVolumeMl: 100,
      supportedOnly: true,
    };
  }
  if (template.verb === "dilute") {
    return {
      sourceDefinitionId: "graduated-cylinder",
      targetDefinitionId: "volumetric-flask",
      volumeMl: 10,
      finalVolumeMl: 100,
      dilutionFactor: 10,
      supportedOnly: true,
    };
  }
  if (template.verb === "filter") {
    return {
      sourceDefinitionId: "beaker-250ml",
      targetDefinitionId: "funnel-stand",
      supportedOnly: true,
    };
  }
  if (template.verb === "dry") {
    return {
      sourceDefinitionId: "watch-glass",
      targetDefinitionId: "watch-glass",
      ovenDefinitionId: "drying-oven",
      dryMassG: 1,
      supportedOnly: true,
    };
  }
  if (template.verb === "heat") {
    return {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "bunsen-burner",
      heatSourceDefinitionId: "bunsen-burner",
      heatedMassG: 24.1899,
      productMassG: 1.1899,
      heatedTemperatureC: 650,
      productLabel: "Heated sodium carbonate residue",
      supportedOnly: true,
    };
  }
  if (template.verb === "cool") {
    return {
      sourceDefinitionId: "crucible-with-lid",
      targetDefinitionId: "crucible-tongs",
      coolingToolDefinitionId: "crucible-tongs",
      cooledTemperatureC: 25,
      supportedOnly: true,
    };
  }
  if (template.verb === "developChromatogram") {
    return {
      sourceDefinitionId: "chromatography-paper",
      targetDefinitionId: "chromatography-chamber",
      snapZoneId: "chromatography-chamber-paper-slot",
      supportedOnly: true,
    };
  }
  if (template.verb === "observe") {
    return {
      note: "Observation recorded.",
      tag: `observation-${index}`,
      supportedOnly: true,
    };
  }
  if (template.verb === "calculate") {
    return {
      calculationId: `calculation-${index}`,
      template: "hardnessMgLAsCaCO3",
      expected: 375,
      tolerance: 0.5,
      supportedOnly: true,
    };
  }
  return { supportedOnly: true };
};

export const createDraftFromDemo = (): LabDefinition =>
  normalizeStudioLabDraft({
    ...demoLab,
    id: "teacher-draft",
    title: "Teacher Draft Lab",
    metadata: {
      ...demoLab.metadata,
      author: "Teacher draft",
      tags: ["draft", "teacher-authored"],
    },
  });

const prefixedId = (prefix: string, id: string): string => `${prefix}-${id}`;

const prefixedOptionalId = (prefix: string, id: string | undefined): string | undefined =>
  id ? prefixedId(prefix, id) : undefined;

const idParameterKeys = new Set([
  "measurementId",
  "calculationId",
  "dataSeriesId",
  "tag",
  "notebookTag",
  "measurementPrefix",
  "initialBuretteMeasurementId",
  "finalBuretteMeasurementId",
  "titrationModelId",
  "chromatographyModelId",
  "kineticsModelId",
  "conditionId",
]);

const isTemplateReference = (value: string): boolean => /^\{\{[^}]+\}\}$/.test(value);

const prefixReference = (prefix: string, value: string | undefined): string | undefined =>
  value === undefined || isTemplateReference(value) ? value : prefixedId(prefix, value);

const prefixKnownReference = (
  key: string,
  value: string,
  prefix: string,
): string => {
  if (isTemplateReference(value)) return value;
  if (
    idParameterKeys.has(key) ||
    /(?:Measurement|Calculation)Ids?$/.test(key) ||
    /(?:Action|Instance)Ids?$/.test(key) ||
    /(?:Action|Notebook)?Tag$/.test(key) ||
    /ModelId$/.test(key)
  ) {
    return prefixedId(prefix, value);
  }
  return value;
};

const prefixParameterMap = (
  parameters: Record<string, ActionParameterValue>,
  prefix: string,
): Record<string, ActionParameterValue> =>
  Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [
      key,
      typeof value === "string"
        ? prefixKnownReference(key, value, prefix)
        : Array.isArray(value)
          ? value.map((item) => prefixKnownReference(key, item, prefix))
          : value,
    ]),
  );

const prefixValidationRule = (
  rule: ValidationRule,
  prefix: string,
): ValidationRule => ({
  ...rule,
  id: prefixedId(prefix, rule.id),
  actionId: prefixReference(prefix, rule.actionId),
  measurementId: prefixReference(prefix, rule.measurementId),
  notebookTag: prefixReference(prefix, rule.notebookTag),
  calculationId: prefixReference(prefix, rule.calculationId),
  dataSeriesId: prefixReference(prefix, rule.dataSeriesId),
  measurementContinuity: rule.measurementContinuity
    ? {
        ...rule.measurementContinuity,
        measuredSupportInstanceId: prefixedId(prefix, rule.measurementContinuity.measuredSupportInstanceId),
        materialSourceInstanceId: rule.measurementContinuity.materialSourceInstanceId
          ? prefixedId(prefix, rule.measurementContinuity.materialSourceInstanceId)
          : undefined,
        producerActionId: prefixedId(prefix, rule.measurementContinuity.producerActionId),
      }
    : undefined,
});

const prefixEquipmentInstance = (
  instance: EquipmentInstance,
  prefix: string,
): EquipmentInstance => ({
  ...instance,
  id: prefixedId(prefix, instance.id),
});

const prefixMassProducerContinuity = (
  continuity: ActionMassProducerContinuity | undefined,
  prefix: string,
): ActionMassProducerContinuity | undefined =>
  continuity
    ? {
        ...continuity,
        measuredSupportInstanceId: prefixedId(prefix, continuity.measuredSupportInstanceId),
        materialSourceInstanceId: continuity.materialSourceInstanceId
          ? prefixedId(prefix, continuity.materialSourceInstanceId)
          : undefined,
      }
    : undefined;

const prefixMassConsumerContinuity = (
  continuity: ActionMassConsumerContinuity | undefined,
  prefix: string,
): ActionMassConsumerContinuity | undefined =>
  continuity
    ? {
        ...continuity,
        measuredSupportInstanceId: prefixedId(prefix, continuity.measuredSupportInstanceId),
        materialSourceInstanceId: continuity.materialSourceInstanceId
          ? prefixedId(prefix, continuity.materialSourceInstanceId)
          : undefined,
        producerActionId: prefixedId(prefix, continuity.producerActionId),
      }
    : undefined;

const prefixVolume = (volume: ActionVolumeContract, prefix: string): ActionVolumeContract => {
  if (volume.source === "measurement" || volume.source === "calculation") {
    return {
      ...volume,
      referenceId: prefixReference(prefix, volume.referenceId)!,
      outputMeasurementId: prefixReference(prefix, volume.outputMeasurementId),
    };
  }
  return {
    ...volume,
    outputMeasurementId: prefixReference(prefix, volume.outputMeasurementId),
  };
};

const prefixMass = (mass: ActionMassContract, prefix: string): ActionMassContract => {
  if (mass.source === "configured-input") return { ...mass };
  if (mass.source === "action-input") {
    return {
      ...mass,
      outputMeasurementId: prefixReference(prefix, mass.outputMeasurementId)!,
      confirmLatestMeasurementIds: mass.confirmLatestMeasurementIds?.map((id) => prefixReference(prefix, id)!),
      toleranceMeasurementId: prefixReference(prefix, mass.toleranceMeasurementId),
      noRepeatCalculationId: prefixReference(prefix, mass.noRepeatCalculationId),
      continuity: prefixMassProducerContinuity(mass.continuity, prefix),
    };
  }
  return {
    ...mass,
    referenceId: prefixReference(prefix, mass.referenceId)!,
    continuity: prefixMassConsumerContinuity(mass.continuity, prefix),
  };
};

const prefixEvidenceReference = (
  reference: ActionEvidenceReference,
  prefix: string,
): ActionEvidenceReference => ({
  ...reference,
  referenceId: prefixReference(prefix, reference.referenceId)!,
});

const prefixAnalysis = (
  analysis: ActionAnalysisContract,
  prefix: string,
): ActionAnalysisContract => {
  switch (analysis.type) {
    case "massDifferenceWithinTolerance":
      return {
        ...analysis,
        firstMassMeasurementId: prefixReference(prefix, analysis.firstMassMeasurementId)!,
        secondMassMeasurementId: prefixReference(prefix, analysis.secondMassMeasurementId)!,
        toleranceMeasurementId: prefixReference(prefix, analysis.toleranceMeasurementId)!,
        outputCalculationId: prefixReference(prefix, analysis.outputCalculationId)!,
      };
    case "mixedEvidenceRegression":
      return {
        ...analysis,
        pairs: analysis.pairs.map((pair) => ({
          x: prefixEvidenceReference(pair.x, prefix),
          y: prefixEvidenceReference(pair.y, prefix),
        })),
        outputCalculationId: prefixReference(prefix, analysis.outputCalculationId)!,
      };
    case "unaryEvidenceTransform":
      return {
        ...analysis,
        input: prefixEvidenceReference(analysis.input, prefix),
        outputCalculationId: prefixReference(prefix, analysis.outputCalculationId)!,
      };
    case "concentrationFromRegression":
      return {
        ...analysis,
        response: prefixEvidenceReference(analysis.response, prefix),
        regressionCalculationId: prefixReference(prefix, analysis.regressionCalculationId)!,
        outputCalculationId: prefixReference(prefix, analysis.outputCalculationId)!,
      };
    case "molarConcentrationToMass":
      return {
        ...analysis,
        concentration: prefixEvidenceReference(analysis.concentration, prefix),
        solutionVolumeMeasurementId: prefixReference(prefix, analysis.solutionVolumeMeasurementId)!,
        molarMassMeasurementId: prefixReference(prefix, analysis.molarMassMeasurementId)!,
        outputCalculationId: prefixReference(prefix, analysis.outputCalculationId)!,
      };
  }
};

const prefixAction = (action: ActionDefinition, prefix: string): ActionDefinition => ({
  ...action,
  id: prefixedId(prefix, action.id),
  effect: action.effect
    ? {
        ...action.effect,
        targets: action.effect.targets.map((target) => ({
          ...target,
          reference: prefixReference(prefix, target.reference),
        })),
      }
    : undefined,
  volume: action.volume ? prefixVolume(action.volume, prefix) : undefined,
  mass: action.mass ? prefixMass(action.mass, prefix) : undefined,
  analysis: action.analysis ? prefixAnalysis(action.analysis, prefix) : undefined,
  runtimeRepeat: action.runtimeRepeat
    ? {
        ...action.runtimeRepeat,
        countMeasurementId: prefixReference(prefix, action.runtimeRepeat.countMeasurementId)!,
        outputMeasurementId: prefixReference(prefix, action.runtimeRepeat.outputMeasurementId)!,
        progressId: prefixReference(prefix, action.runtimeRepeat.progressId)!,
      }
    : undefined,
  sourceInventory: action.sourceInventory
    ? {
        ...action.sourceInventory,
        sourceInstanceId: prefixReference(prefix, action.sourceInventory.sourceInstanceId),
        outputMeasurementId: prefixReference(prefix, action.sourceInventory.outputMeasurementId)!,
      }
    : undefined,
  extractionOperation: action.extractionOperation
    ? {
        ...action.extractionOperation,
        vesselInstanceId: prefixReference(prefix, action.extractionOperation.vesselInstanceId)!,
        requiredControlActionIds: action.extractionOperation.requiredControlActionIds.map((id) => prefixedId(prefix, id)),
      }
    : undefined,
  extractionObservation: action.extractionObservation
    ? {
        ...action.extractionObservation,
        vesselInstanceId: prefixReference(prefix, action.extractionObservation.vesselInstanceId)!,
      }
    : undefined,
  extractionIdentity: action.extractionIdentity
    ? {
        ...action.extractionIdentity,
        vesselInstanceId: prefixReference(prefix, action.extractionIdentity.vesselInstanceId)!,
      }
    : undefined,
  extractionDrain: action.extractionDrain
    ? {
        ...action.extractionDrain,
        vesselInstanceId: prefixReference(prefix, action.extractionDrain.vesselInstanceId)!,
      }
    : undefined,
  fractionHandling: action.fractionHandling
    ? {
        ...action.fractionHandling,
        sourceInstanceId: prefixReference(prefix, action.fractionHandling.sourceInstanceId)!,
        targetInstanceId: prefixReference(prefix, action.fractionHandling.targetInstanceId),
        fractionId: prefixReference(prefix, action.fractionHandling.fractionId)!,
      }
    : undefined,
  deliveryDevice: action.deliveryDevice
    ? {
        ...action.deliveryDevice,
        deviceInstanceId: prefixReference(prefix, action.deliveryDevice.deviceInstanceId),
      }
    : undefined,
  choiceObservation: action.choiceObservation
    ? {
        ...action.choiceObservation,
        outputCalculationId: prefixReference(prefix, action.choiceObservation.outputCalculationId)!,
        options: action.choiceObservation.options.map((option) => ({
          ...option,
          tag: prefixReference(prefix, option.tag)!,
        })),
      }
    : undefined,
  dilutionFactorOutputId: prefixReference(prefix, action.dilutionFactorOutputId),
  parameters: prefixParameterMap(action.parameters, prefix),
  prerequisites: action.prerequisites.map((rule) => prefixValidationRule(rule, prefix)),
  interaction: action.interaction ? { ...action.interaction } : undefined,
});

const prefixNode = (
  node: ProcessNode,
  prefix: string,
): ProcessNode => ({
  ...node,
  id: prefixedId(prefix, node.id),
  actionId: prefixedOptionalId(prefix, node.actionId),
  config: prefixParameterMap(node.config, prefix),
  validation: node.validation.map((rule) => prefixValidationRule(rule, prefix)),
});

const prefixEdge = (edge: ProcessEdge, prefix: string): ProcessEdge => ({
  ...edge,
  from: prefixedId(prefix, edge.from),
  to: prefixedId(prefix, edge.to),
  condition: {
    ...edge.condition,
    calculationId: prefixReference(prefix, edge.condition.calculationId),
  },
});

const prefixOrderedProcedure = (
  procedure: NonNullable<NonNullable<TechniqueDefinition["composition"]>["orderedProcedure"]>,
  prefix: string,
) => ({
  ...procedure,
  startActionIds: procedure.startActionIds.map((id) => prefixedId(prefix, id)),
  endActionIds: procedure.endActionIds.map((id) => prefixedId(prefix, id)),
  resources: procedure.resources.map((resource) => ({
    ...resource,
    prepareActionIds: resource.prepareActionIds.map((id) => prefixedId(prefix, id)),
    cleanupActionIds: resource.cleanupActionIds.map((id) => prefixedId(prefix, id)),
  })),
  groups: procedure.groups.map((group) => ({
    ...group,
    actionAliases: group.actionAliases
      ? Object.fromEntries(
          Object.entries(group.actionAliases).map(([sourceId, targetId]) => [
            prefixedId(prefix, sourceId),
            prefixedId(prefix, targetId),
          ]),
        )
      : undefined,
    actionIds: group.actionIds.map((id) => prefixedId(prefix, id)),
  })),
});

const prefixComposition = (
  composition: NonNullable<TechniqueDefinition["composition"]>,
  prefix: string,
): NonNullable<TechniqueDefinition["composition"]> => ({
  ...composition,
  ports: composition.ports.map((port) => ({
    ...port,
    nodeId: prefixedId(prefix, port.nodeId),
  })),
  equipmentRoles: composition.equipmentRoles.map((role) => ({
    ...role,
    sourceInstanceIds: role.sourceInstanceIds?.map((id) => prefixedId(prefix, id)),
  })),
  modelSlots: composition.modelSlots.map((slot) => ({
    ...slot,
    sourceModelId: prefixedId(prefix, slot.sourceModelId),
  })),
  evidenceOutputs: composition.evidenceOutputs.map((output) => ({
    ...output,
    actionId: prefixedId(prefix, output.actionId),
    referenceId: prefixReference(prefix, output.referenceId),
  })),
  completion: {
    ...composition.completion,
    requiredValidationRuleIds: composition.completion.requiredValidationRuleIds.map((id) => prefixedId(prefix, id)),
  },
  legacyActionEffects: composition.legacyActionEffects?.map((declaration) => ({
    ...declaration,
    actionId: prefixedId(prefix, declaration.actionId),
  })),
  orderedProcedure: composition.orderedProcedure
    ? prefixOrderedProcedure(composition.orderedProcedure, prefix)
    : undefined,
});

const nextTechniquePrefix = (draft: LabDefinition, techniqueId: string): string => {
  const existingIds = new Set(draft.techniques.map((technique) => technique.id));
  let index = 1;
  let candidate = `${techniqueId}-${index}`;
  while (existingIds.has(candidate)) {
    index += 1;
    candidate = `${techniqueId}-${index}`;
  }
  return candidate;
};

export interface AppendTechniqueResult {
  lab: LabDefinition;
  startNodeId: string;
}

export type StudioTemplateStepPlacement = "append" | "after" | "before";

export interface InsertTemplateStepOptions {
  anchorNodeId?: string;
  placement?: StudioTemplateStepPlacement;
}

export interface InsertTemplateStepResult {
  lab: LabDefinition;
  actionId: string;
  nodeId: string;
}

export const appendTechniqueToDraft = (
  draft: LabDefinition,
  technique: TechniqueDefinition,
): AppendTechniqueResult => {
  const prefix = nextTechniquePrefix(draft, technique.id);
  const prefixedTechnique: TechniqueDefinition = {
    ...technique,
    id: prefix,
    titrationModels: technique.titrationModels?.map((model) => ({
      ...model,
      id: prefixedId(prefix, model.id),
    })),
    chromatographyModels: technique.chromatographyModels?.map((model) => ({
      ...model,
      id: prefixedId(prefix, model.id),
      bands: model.bands.map((band) => ({ ...band })),
    })),
    kineticsModels: technique.kineticsModels?.map((model) => ({
      ...model,
      id: prefixedId(prefix, model.id),
      conditions: model.conditions.map((condition) => ({
        ...condition,
        id: prefixedId(prefix, condition.id),
      })),
    })),
    initialState: {
      equipment: technique.initialState.equipment.map((instance) => prefixEquipmentInstance(instance, prefix)),
    },
    actions: technique.actions.map((action) => prefixAction(action, prefix)),
    process: {
      startNodeId: prefixedId(prefix, technique.process.startNodeId),
      nodes: technique.process.nodes.map((node) => prefixNode(node, prefix)),
      edges: technique.process.edges.map((edge) => prefixEdge(edge, prefix)),
    },
    successCriteria: technique.successCriteria.map((rule) => prefixValidationRule(rule, prefix)),
    composition: technique.composition
      ? prefixComposition(technique.composition, prefix)
      : undefined,
  };

  const previousLastNode = draft.process.nodes[draft.process.nodes.length - 1];
  const connector: ProcessEdge[] = previousLastNode
    ? [
        {
          from: previousLastNode.id,
          to: prefixedTechnique.process.startNodeId,
          label: "Next",
          condition: { type: "validationPassed" },
        },
      ]
    : [];

  return {
    lab: {
      ...draft,
      equipment: Array.from(new Set([...draft.equipment, ...technique.requiredEquipment])),
      initialState: draft.initialState
        ? {
            equipment: [
              ...draft.initialState.equipment,
              ...prefixedTechnique.initialState.equipment,
            ],
          }
        : undefined,
      techniques: [...draft.techniques, prefixedTechnique],
      actions: [...draft.actions, ...prefixedTechnique.actions],
      process: {
        ...draft.process,
        nodes: [...draft.process.nodes, ...prefixedTechnique.process.nodes],
        edges: [...draft.process.edges, ...connector, ...prefixedTechnique.process.edges],
      },
      assessments: [...draft.assessments, ...prefixedTechnique.successCriteria],
    },
    startNodeId: prefixedTechnique.process.startNodeId,
  };
};

const isLinearOutgoingEdge = (edge: ProcessEdge): boolean =>
  edge.condition.type === "validationPassed" || edge.condition.type === "always";

const nextEdge = (from: string, to: string): ProcessEdge => ({
  from,
  to,
  label: "Next",
  condition: { type: "validationPassed" },
});

const insertNodeAt = (
  nodes: ProcessNode[],
  node: ProcessNode,
  anchorNodeId: string | undefined,
  placement: StudioTemplateStepPlacement,
): ProcessNode[] => {
  if (placement === "append" || !anchorNodeId) return [...nodes, node];
  const anchorIndex = nodes.findIndex((candidate) => candidate.id === anchorNodeId);
  if (anchorIndex < 0) return [...nodes, node];
  const insertionIndex = placement === "before" ? anchorIndex : anchorIndex + 1;
  return [
    ...nodes.slice(0, insertionIndex),
    node,
    ...nodes.slice(insertionIndex),
  ];
};

const insertEdgesForStep = (
  edges: ProcessEdge[],
  nodeId: string,
  anchorNodeId: string | undefined,
  placement: StudioTemplateStepPlacement,
): ProcessEdge[] => {
  if (!anchorNodeId) return edges;
  if (placement === "append") return [...edges, nextEdge(anchorNodeId, nodeId)];

  if (placement === "before") {
    const rewiredCandidates = edges
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => edge.to === anchorNodeId && isLinearOutgoingEdge(edge));

    if (rewiredCandidates.length === 1) {
      const [{ index: previousIndex }] = rewiredCandidates;
      return [
        ...edges.map((edge, index) =>
          index === previousIndex ? { ...edge, to: nodeId } : edge,
        ),
        nextEdge(nodeId, anchorNodeId),
      ];
    }

    return [...edges, nextEdge(nodeId, anchorNodeId)];
  }

  const rewiredCandidates = edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.from === anchorNodeId && isLinearOutgoingEdge(edge));

  if (rewiredCandidates.length === 1) {
    const [{ edge: previousEdge, index: previousIndex }] = rewiredCandidates;
    return [
      ...edges.map((edge, index) =>
        index === previousIndex ? nextEdge(anchorNodeId, nodeId) : edge,
      ),
      { ...previousEdge, from: nodeId },
    ];
  }

  return [...edges, nextEdge(anchorNodeId, nodeId)];
};

export const insertTemplateStepIntoDraft = (
  draft: LabDefinition,
  template: StudioTemplate,
  options: InsertTemplateStepOptions = {},
): InsertTemplateStepResult => {
  const usedIds = new Set([
    ...draft.process.nodes.map((node) => node.id),
    ...draft.actions.map((action) => action.id),
  ]);
  let index = draft.process.nodes.length + 1;
  while (
    usedIds.has(`${template.id}-${index}`) ||
    (template.verb ? usedIds.has(`${template.verb}-${index}`) : false)
  ) {
    index += 1;
  }
  const newNode = createNodeFromTemplate(template, index);
  const newAction = createActionFromTemplate(template, index);
  const requestedPlacement = options.placement ?? "append";
  const anchorExists = options.anchorNodeId
    ? draft.process.nodes.some((node) => node.id === options.anchorNodeId)
    : false;
  const placement = anchorExists ? requestedPlacement : "append";
  const anchorNodeId =
    placement === "append"
      ? draft.process.nodes.at(-1)?.id
      : options.anchorNodeId;
  const nextNodes = insertNodeAt(
    draft.process.nodes,
    newNode,
    anchorNodeId,
    placement,
  );
  const nextEdges = insertEdgesForStep(
    draft.process.edges,
    newNode.id,
    anchorNodeId,
    placement,
  );

  return {
    actionId: newAction.id,
    nodeId: newNode.id,
    lab: {
      ...draft,
      equipment: Array.from(new Set([...draft.equipment, ...template.requiredEquipment])),
      actions: [...draft.actions, newAction],
      process: {
        ...draft.process,
        startNodeId:
          placement === "before" && anchorNodeId === draft.process.startNodeId
            ? newNode.id
            : draft.process.startNodeId || newNode.id,
        nodes: nextNodes,
        edges: nextEdges,
      },
    },
  };
};

export const createNodeFromTemplate = (template: StudioTemplate, index: number): ProcessNode => {
  if (!template.nodeType || !template.verb) {
    throw new Error(`${template.title} creates a bundled lab or technique, not a single process node.`);
  }
  const nodeId = `${template.id}-${index}`;
  const actionId = `${template.verb}-${index}`;
  const node: ProcessNode = {
    id: nodeId,
    type: template.nodeType,
    title: template.title,
    description: template.description,
    actionId,
    config: {
      verb: template.verb,
      supportedOnly: true,
    },
    validation: [
      {
        id: `${nodeId}-action`,
        type: "actionEvidence",
        label: `${template.title} completed.`,
        actionId,
      },
    ],
    hints: [],
    feedback: {
      success: `${template.title} complete.`,
      retry: `Adjust the ${template.title.toLowerCase()} node before previewing.`,
    },
  };
  return {
    ...node,
    layout: generatedLayoutForNode(node, index - 1),
  };
};

export const createActionFromTemplate = (
  template: StudioTemplate,
  index: number,
): ActionDefinition => {
  if (!template.verb) {
    throw new Error(`${template.title} creates a bundled lab or technique, not a single action.`);
  }
  const action: ActionDefinition = {
    id: `${template.verb}-${index}`,
    verb: template.verb,
    label: template.title,
    parameters: parameterDefaults(template, index),
    prerequisites: [],
    stateChanges: [`${template.verb} updates the schema-driven runtime.`],
    invalidCases: [],
    feedback: {
      success: `${template.title} completed.`,
      invalid: `Review the ${template.title.toLowerCase()} node.`,
    },
    evidence: [template.verb],
  };

  const interaction = defaultInteractionForAction(action);
  return {
    ...action,
    interaction: interaction ? { ...interaction, accessibleLabel: template.description } : undefined,
  };
};
