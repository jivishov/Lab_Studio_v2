import type {
  AcidBaseSpeciesModel,
  AcidBaseTitrationModel,
  ActionDefinition,
  ActionParameterValue,
  LabDefinition,
  StoichiometricRatio,
  TechniqueDefinition,
  TitrationModelDefinition,
} from "./types";

export const DEFAULT_TITRATION_DROP_VOLUME_ML = 0.05;
export const DEFAULT_TITRATION_ENDPOINT_OFFSET_DROPS = 0;
export const DEFAULT_TITRATION_MAX_EXTRA_DROPS = 5;
export const DEFAULT_TITRATION_STOICHIOMETRIC_RATIO: StoichiometricRatio = {
  analyte: 1,
  titrant: 1,
};

const wholeDropEpsilon = 1e-9;

export interface TitrationDropPlan {
  modelId: string;
  type: TitrationModelDefinition["type"];
  analyteMolarityM: number;
  analyteVolumeMl: number;
  titrantMolarityM: number;
  stoichiometricRatio: StoichiometricRatio;
  dropVolumeMl: number;
  theoreticalEquivalenceVolumeMl: number;
  exactEquivalenceDropCount: number;
  equivalenceDropCount: number;
  endpointOffsetDrops: number;
  endpointDropCount: number;
  endpointDeliveredVolumeMl: number;
  expectedFinalBuretteReadingMl: number;
  expectedAnalyteMolarityM: number;
  maxExtraDrops: number;
  analyteMolarMassGPerMol?: number;
  sampleDensityGPerMl?: number;
  expectedAnalyteMassG?: number;
  expectedAnalytePercentByMass?: number;
  idealEquivalencePh?: number;
  phPrecision?: number;
}

export type AcidBaseTitrationRegion =
  | "initial"
  | "pre-equivalence"
  | "buffer"
  | "equivalence"
  | "excess-titrant";

export interface AcidBasePhResult {
  ph: number;
  region: AcidBaseTitrationRegion;
  titrantVolumeMl: number;
  equivalenceVolumeMl: number;
}

const TITRATION_MODEL_TYPES = new Set<TitrationModelDefinition["type"]>(["acidBase", "redox"]);

type RuntimeDefinitionWithModels = LabDefinition | TechniqueDefinition;

const roundToFinitePrecision = (value: number): number => Number(value.toFixed(10));

const equilibriumRoot = (constant: number, concentration: number): number =>
  (-constant + Math.sqrt(constant * constant + 4 * constant * concentration)) / 2;

const positiveNumber = (value: number | undefined, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${path} must be a positive finite number.`);
  }
  return value;
};

const nonNegativeInteger = (
  value: number | undefined,
  path: string,
  fallback: number,
): number => {
  const next = value ?? fallback;
  if (!Number.isFinite(next) || next < 0 || !Number.isInteger(next)) {
    throw new RangeError(`${path} must be a non-negative integer.`);
  }
  return next;
};

const ratioFor = (model: TitrationModelDefinition): StoichiometricRatio => {
  const ratio = model.stoichiometricRatio ?? DEFAULT_TITRATION_STOICHIOMETRIC_RATIO;
  return {
    analyte: positiveNumber(ratio.analyte, `${model.id}.stoichiometricRatio.analyte`),
    titrant: positiveNumber(ratio.titrant, `${model.id}.stoichiometricRatio.titrant`),
  };
};

const validateAcidBaseSpecies = (
  species: AcidBaseSpeciesModel,
  path: string,
): AcidBaseSpeciesModel => {
  if (!species.formula?.trim()) throw new RangeError(`${path}.formula must be a non-empty string.`);
  if (species.role !== "acid" && species.role !== "base") {
    throw new RangeError(`${path}.role must be acid or base.`);
  }
  if (species.strength !== "strong" && species.strength !== "weak") {
    throw new RangeError(`${path}.strength must be strong or weak.`);
  }
  if (species.strength === "weak") {
    positiveNumber(species.equilibriumConstant, `${path}.equilibriumConstant`);
  }
  return species;
};

const initialSpeciesPh = (
  species: AcidBaseSpeciesModel,
  concentrationM: number,
  waterIonProduct: number,
): number => {
  if (species.strength === "strong") {
    return species.role === "acid"
      ? -Math.log10(concentrationM)
      : -Math.log10(waterIonProduct) + Math.log10(concentrationM);
  }
  const constant = positiveNumber(
    species.equilibriumConstant,
    `${species.formula}.equilibriumConstant`,
  );
  const ionized = equilibriumRoot(constant, concentrationM);
  return species.role === "acid"
    ? -Math.log10(ionized)
    : -Math.log10(waterIonProduct) + Math.log10(ionized);
};

/**
 * Shared ideal-solution acid-base calculator for both schema titrations and Investigation 14.
 * It deliberately reports a simulator prediction, not a calibrated laboratory measurement.
 */
export const calculateAcidBasePh = (
  model: AcidBaseTitrationModel,
  titrantVolumeMl: number,
): AcidBasePhResult => {
  const analyte = validateAcidBaseSpecies(model.analyte, `${model.id}.analyte`);
  const titrant = validateAcidBaseSpecies(model.titrant, `${model.id}.titrant`);
  if (analyte.role === titrant.role) {
    throw new RangeError(`${model.id} analyte and titrant must have opposite acid-base roles.`);
  }
  if (titrant.strength !== "strong") {
    throw new RangeError(`${model.id}.titrant.strength must be strong for this pH model.`);
  }
  if (!Number.isFinite(titrantVolumeMl) || titrantVolumeMl < 0) {
    throw new RangeError(`${model.id}.titrantVolumeMl must be a non-negative finite number.`);
  }
  const analyteMolarityM = positiveNumber(model.analyteMolarityM, `${model.id}.analyteMolarityM`);
  const analyteVolumeMl = positiveNumber(model.analyteVolumeMl, `${model.id}.analyteVolumeMl`);
  const titrantMolarityM = positiveNumber(model.titrantMolarityM, `${model.id}.titrantMolarityM`);
  const waterIonProduct = positiveNumber(model.waterIonProduct, `${model.id}.waterIonProduct`);
  const ratio = ratioFor(model);
  const equivalenceVolumeMl = roundToFinitePrecision(
    (analyteMolarityM * analyteVolumeMl * ratio.titrant) /
      (titrantMolarityM * ratio.analyte),
  );
  if (titrantVolumeMl === 0) {
    return {
      ph: initialSpeciesPh(analyte, analyteMolarityM, waterIonProduct),
      region: "initial",
      titrantVolumeMl,
      equivalenceVolumeMl,
    };
  }

  const analyteMoles = analyteMolarityM * analyteVolumeMl * 0.001;
  const titrantMoles = titrantMolarityM * titrantVolumeMl * 0.001;
  const analyteEquivalentMoles = analyteMoles / ratio.analyte;
  const titrantEquivalentMoles = titrantMoles / ratio.titrant;
  const difference = analyteEquivalentMoles - titrantEquivalentMoles;
  const totalVolumeL = (analyteVolumeMl + titrantVolumeMl) * 0.001;
  const nearEquivalence = Math.abs(difference) < 1e-12;
  const neutralPh = -0.5 * Math.log10(waterIonProduct);

  if (analyte.strength === "strong") {
    if (nearEquivalence) {
      return { ph: neutralPh, region: "equivalence", titrantVolumeMl, equivalenceVolumeMl };
    }
    const excessConcentration = Math.abs(difference) / totalVolumeL;
    const ph = analyte.role === "acid"
      ? difference > 0
        ? -Math.log10(excessConcentration)
        : -Math.log10(waterIonProduct) + Math.log10(excessConcentration)
      : difference > 0
        ? -Math.log10(waterIonProduct) + Math.log10(excessConcentration)
        : -Math.log10(excessConcentration);
    return {
      ph,
      region: difference > 0 ? "pre-equivalence" : "excess-titrant",
      titrantVolumeMl,
      equivalenceVolumeMl,
    };
  }

  const constant = positiveNumber(
    analyte.equilibriumConstant,
    `${model.id}.analyte.equilibriumConstant`,
  );
  if (nearEquivalence) {
    const conjugateConcentration = analyteMoles / totalVolumeL;
    const conjugateConstant = waterIonProduct / constant;
    const hydrolyzed = equilibriumRoot(conjugateConstant, conjugateConcentration);
    const ph = analyte.role === "acid"
      ? -Math.log10(waterIonProduct) + Math.log10(hydrolyzed)
      : -Math.log10(hydrolyzed);
    return { ph, region: "equivalence", titrantVolumeMl, equivalenceVolumeMl };
  }
  if (difference > 0) {
    const conjugateMoles = titrantEquivalentMoles * ratio.analyte;
    const remainingMoles = analyteMoles - conjugateMoles;
    const ratioTerm = conjugateMoles / remainingMoles;
    const pConstant = -Math.log10(constant);
    const ph = analyte.role === "acid"
      ? pConstant + Math.log10(ratioTerm)
      : -Math.log10(waterIonProduct) - (pConstant + Math.log10(ratioTerm));
    return { ph, region: "buffer", titrantVolumeMl, equivalenceVolumeMl };
  }
  const excessConcentration = Math.abs(difference) / totalVolumeL;
  const ph = titrant.role === "base"
    ? -Math.log10(waterIonProduct) + Math.log10(excessConcentration)
    : -Math.log10(excessConcentration);
  return { ph, region: "excess-titrant", titrantVolumeMl, equivalenceVolumeMl };
};

export const deriveTitrationDropPlan = (
  model: TitrationModelDefinition,
  options: { initialBuretteReadingMl?: number } = {},
): TitrationDropPlan => {
  if (!TITRATION_MODEL_TYPES.has(model.type)) {
    throw new RangeError(`${model.id}.type must be acidBase or redox.`);
  }

  const ratio = ratioFor(model);
  const analyteMolarityM = positiveNumber(model.analyteMolarityM, `${model.id}.analyteMolarityM`);
  const analyteVolumeMl = positiveNumber(model.analyteVolumeMl, `${model.id}.analyteVolumeMl`);
  const titrantMolarityM = positiveNumber(model.titrantMolarityM, `${model.id}.titrantMolarityM`);
  const dropVolumeMl = positiveNumber(
    model.dropVolumeMl ?? DEFAULT_TITRATION_DROP_VOLUME_ML,
    `${model.id}.dropVolumeMl`,
  );
  const endpointOffsetDrops = nonNegativeInteger(
    model.endpointOffsetDrops,
    `${model.id}.endpointOffsetDrops`,
    DEFAULT_TITRATION_ENDPOINT_OFFSET_DROPS,
  );
  const maxExtraDrops = nonNegativeInteger(
    model.maxExtraDrops,
    `${model.id}.maxExtraDrops`,
    DEFAULT_TITRATION_MAX_EXTRA_DROPS,
  );
  const initialBuretteReadingMl = options.initialBuretteReadingMl ?? 0;
  if (!Number.isFinite(initialBuretteReadingMl) || initialBuretteReadingMl < 0) {
    throw new RangeError(`${model.id}.initialBuretteReadingMl must be a non-negative finite number.`);
  }

  const theoreticalEquivalenceVolumeMl = roundToFinitePrecision(
    (analyteMolarityM * analyteVolumeMl * ratio.titrant) /
      (titrantMolarityM * ratio.analyte),
  );
  const exactEquivalenceDropCount = theoreticalEquivalenceVolumeMl / dropVolumeMl;
  const equivalenceDropCount = Math.max(1, Math.ceil(exactEquivalenceDropCount - wholeDropEpsilon));
  const endpointDropCount = equivalenceDropCount + endpointOffsetDrops;
  const endpointDeliveredVolumeMl = roundToFinitePrecision(endpointDropCount * dropVolumeMl);
  const expectedFinalBuretteReadingMl = roundToFinitePrecision(
    initialBuretteReadingMl + endpointDeliveredVolumeMl,
  );
  const expectedAnalyteMolarityM = roundToFinitePrecision(
    (titrantMolarityM * endpointDeliveredVolumeMl * ratio.analyte) /
      (analyteVolumeMl * ratio.titrant),
  );

  // Only a redox model reports a mass or a percent, and only when the teacher configured the molar
  // mass the conversion needs. An acid-base model leaves both undefined rather than inventing one.
  const analyteMolarMassGPerMol =
    model.type === "redox" && typeof model.analyteMolarMassGPerMol === "number"
      ? positiveNumber(model.analyteMolarMassGPerMol, `${model.id}.analyteMolarMassGPerMol`)
      : undefined;
  const sampleDensityGPerMl =
    model.type === "redox" && typeof model.sampleDensityGPerMl === "number"
      ? positiveNumber(model.sampleDensityGPerMl, `${model.id}.sampleDensityGPerMl`)
      : undefined;
  const expectedAnalyteMassG =
    analyteMolarMassGPerMol === undefined
      ? undefined
      : roundToFinitePrecision(
          (expectedAnalyteMolarityM * analyteVolumeMl * analyteMolarMassGPerMol) / 1000,
        );
  const expectedAnalytePercentByMass =
    expectedAnalyteMassG === undefined || sampleDensityGPerMl === undefined
      ? undefined
      : roundToFinitePrecision(
          (expectedAnalyteMassG / (analyteVolumeMl * sampleDensityGPerMl)) * 100,
        );
  const idealEquivalencePh =
    model.type === "acidBase"
      ? calculateAcidBasePh(model, theoreticalEquivalenceVolumeMl).ph
      : undefined;

  return {
    modelId: model.id,
    type: model.type,
    analyteMolarityM,
    analyteVolumeMl,
    titrantMolarityM,
    stoichiometricRatio: ratio,
    dropVolumeMl,
    theoreticalEquivalenceVolumeMl,
    exactEquivalenceDropCount,
    equivalenceDropCount,
    endpointOffsetDrops,
    endpointDropCount,
    endpointDeliveredVolumeMl,
    expectedFinalBuretteReadingMl,
    expectedAnalyteMolarityM,
    maxExtraDrops,
    ...(analyteMolarMassGPerMol === undefined ? {} : { analyteMolarMassGPerMol }),
    ...(sampleDensityGPerMl === undefined ? {} : { sampleDensityGPerMl }),
    ...(expectedAnalyteMassG === undefined ? {} : { expectedAnalyteMassG }),
    ...(expectedAnalytePercentByMass === undefined ? {} : { expectedAnalytePercentByMass }),
    ...(idealEquivalencePh === undefined ? {} : { idealEquivalencePh }),
    ...(model.type === "acidBase" ? { phPrecision: model.phPrecision } : {}),
  };
};

export const collectTitrationModels = (
  definition: RuntimeDefinitionWithModels,
): TitrationModelDefinition[] => [
  ...(definition.titrationModels ?? []),
  ...("techniques" in definition
    ? definition.techniques.flatMap((technique) => technique.titrationModels ?? [])
    : []),
];

export const findTitrationModel = (
  definition: RuntimeDefinitionWithModels,
  id: string,
): TitrationModelDefinition | undefined =>
  collectTitrationModels(definition).find((model) => model.id === id);

const numberParameter = (
  parameters: Record<string, ActionParameterValue>,
  key: string,
): number | undefined => {
  const value = parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const stringParameter = (
  parameters: Record<string, ActionParameterValue>,
  key: string,
): string | undefined => {
  const value = parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const withDropPlanParameters = (
  parameters: Record<string, ActionParameterValue>,
  plan: TitrationDropPlan,
): Record<string, ActionParameterValue> => ({
  ...parameters,
  dropVolumeMl: plan.dropVolumeMl,
  equivalenceDropCount: plan.equivalenceDropCount,
  endpointDropCount: plan.endpointDropCount,
  volumeMl: plan.endpointDeliveredVolumeMl,
  endpointDeliveredVolumeMl: plan.endpointDeliveredVolumeMl,
  expectedFinalBuretteReadingMl: plan.expectedFinalBuretteReadingMl,
  theoreticalEquivalenceVolumeMl: plan.theoreticalEquivalenceVolumeMl,
  maxExtraDrops: plan.maxExtraDrops,
  ...(plan.idealEquivalencePh === undefined
    ? {}
    : { idealEquivalencePh: plan.idealEquivalencePh }),
  ...(plan.phPrecision === undefined ? {} : { phPrecision: plan.phPrecision }),
});

const withAcidBaseCalculationParameters = (
  parameters: Record<string, ActionParameterValue>,
  plan: TitrationDropPlan,
): Record<string, ActionParameterValue> => ({
  ...parameters,
  titrantMolarity: plan.titrantMolarityM,
  analyteVolumeMl: plan.analyteVolumeMl,
  expected: plan.expectedAnalyteMolarityM,
  stoichiometricRatioAnalyte: plan.stoichiometricRatio.analyte,
  stoichiometricRatioTitrant: plan.stoichiometricRatio.titrant,
});

/**
 * Investigation 8's standardization. The accepted KMnO4 molarity is derived from the same model the
 * drop plan comes from, so the accepted value and the simulated endpoint can never disagree. The
 * *student's* value is still computed in the reducer from their own recorded readings.
 */
const withRedoxStandardizationParameters = (
  parameters: Record<string, ActionParameterValue>,
  plan: TitrationDropPlan,
): Record<string, ActionParameterValue> => ({
  ...parameters,
  standardMolarityM: plan.analyteMolarityM,
  stoichiometricRatioAnalyte: plan.stoichiometricRatio.analyte,
  stoichiometricRatioTitrant: plan.stoichiometricRatio.titrant,
  expected: plan.titrantMolarityM,
});

/**
 * Investigation 8's percent-by-mass result. `expected` is the model's own percent, not a label
 * claim: AN-02 compares the measured mean *against* the label claim, so making the label the
 * tolerance target would have made the comparison unfalsifiable.
 */
const withRedoxPercentParameters = (
  parameters: Record<string, ActionParameterValue>,
  plan: TitrationDropPlan,
): Record<string, ActionParameterValue> => ({
  ...parameters,
  sampleAliquotMl: plan.analyteVolumeMl,
  stoichiometricRatioAnalyte: plan.stoichiometricRatio.analyte,
  stoichiometricRatioTitrant: plan.stoichiometricRatio.titrant,
  ...(plan.analyteMolarMassGPerMol === undefined
    ? {}
    : { analyteMolarMassGPerMol: plan.analyteMolarMassGPerMol }),
  ...(plan.sampleDensityGPerMl === undefined
    ? {}
    : { densityGPerMl: plan.sampleDensityGPerMl }),
  ...(plan.expectedAnalytePercentByMass === undefined
    ? {}
    : { expected: plan.expectedAnalytePercentByMass }),
});

const REDOX_STANDARDIZATION_TEMPLATE = "permanganateMolarityFromIron";
const REDOX_PERCENT_TEMPLATE = "hydrogenPeroxidePercent";

export const resolveActionTitrationParameters = (
  definition: RuntimeDefinitionWithModels,
  action: ActionDefinition,
): ActionDefinition => {
  const modelId = stringParameter(action.parameters, "titrationModelId");
  if (!modelId) return action;

  const model = findTitrationModel(definition, modelId);
  if (!model) return action;

  const plan = deriveTitrationDropPlan(model, {
    initialBuretteReadingMl: numberParameter(action.parameters, "initialBuretteReadingMl"),
  });
  const isDropDispense = action.interaction?.type === "dispenseDrops";
  const isAcidBaseCalculation = action.parameters.template === "acidBaseMolarity";
  const isRedoxStandardization = action.parameters.template === REDOX_STANDARDIZATION_TEMPLATE;
  const isRedoxPercent = action.parameters.template === REDOX_PERCENT_TEMPLATE;
  const isAcidBasePhReading = action.parameters.phReadingMode === "acceptedEndpoint";

  if (!isDropDispense && !isAcidBaseCalculation && !isRedoxStandardization && !isRedoxPercent && !isAcidBasePhReading) {
    return action;
  }

  return {
    ...action,
    parameters: {
      ...(isDropDispense ? withDropPlanParameters(action.parameters, plan) : action.parameters),
      ...(isAcidBaseCalculation ? withAcidBaseCalculationParameters(action.parameters, plan) : {}),
      ...(isRedoxStandardization ? withRedoxStandardizationParameters(action.parameters, plan) : {}),
      ...(isRedoxPercent ? withRedoxPercentParameters(action.parameters, plan) : {}),
      ...(isAcidBasePhReading ? withDropPlanParameters(action.parameters, plan) : {}),
    },
  };
};

export const resolveTitrationActions = (
  definition: RuntimeDefinitionWithModels,
  actions: ActionDefinition[],
): ActionDefinition[] =>
  actions.map((action) => resolveActionTitrationParameters(definition, action));
