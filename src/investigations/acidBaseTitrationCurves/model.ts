import { calculateAcidBasePh } from "../../domain/titrationModels";
import type {
  AcidBaseRole,
  AcidBaseStrength,
  AcidBaseTitrationModel,
} from "../../domain/types";

export type { AcidBaseRole };
export type SolutionStrength = AcidBaseStrength;
export type ConcentrationStatus = "known" | "unknown";

export interface TitrationSample {
  id: string;
  label: string;
  formula: string;
  role: AcidBaseRole;
  strength: SolutionStrength;
  concentrationStatus: ConcentrationStatus;
  molarityM: number;
  acceptedEquilibriumConstant?: number;
}

export interface TitrationCombination {
  id: string;
  label: string;
  analyteId: string;
  titrantId: string;
  stoichiometricRatio: {
    analyte: number;
    titrant: number;
  };
}

export interface TitrationSettings {
  aliquotMl: number;
  allowedAliquotMl: { min: number; max: number };
  allowedIncrementMl: { min: number; max: number };
  coarseIncrementMl: number;
  fineIncrementMl: number;
  fineWindowMl: number;
  buretCapacityMl: number;
  buretPrecisionMl: number;
  phPrecision: number;
  temperatureC: number;
  waterIonProduct: number;
  stabilityDeltaPh: number;
  stabilityConsecutiveReadings: number;
  minimumPostEquivalenceMl: number;
  maximumPostEquivalenceMl: number;
  probeRules: string[];
  indicatorInFormalTrials: boolean;
}

export interface TitrationInvestigationConfig {
  investigationId: string;
  title: string;
  assignedQuestion: string;
  teacherName: string;
  samples: TitrationSample[];
  combinations: TitrationCombination[];
  requiredCombinationIds: string[];
  minimumReplicates: number;
  practice: {
    acidSampleId: string;
    baseSampleId: string;
    portionMl: number;
    indicator: string;
  };
  settings: TitrationSettings;
  safety: {
    requiredPpe: string[];
    hazardSummary: string[];
    spillResponse: string;
    dilutionRule: string;
    neutralizationPhRange: { min: number; max: number };
    disposalProcedure: string;
  };
}

export interface CurvePoint {
  volumeMl: number;
  ph: number;
  region: "initial" | "pre-equivalence" | "half-equivalence" | "equivalence" | "post-equivalence";
  stableAfterSteepRegion: boolean;
}

export interface CurveResult {
  combinationId: string;
  equivalenceVolumeMl: number;
  points: CurvePoint[];
  stabilityReached: boolean;
}

export interface AnalysisTargets {
  equivalenceVolumeMl: number;
  equivalencePh: number;
  halfEquivalenceVolumeMl?: number;
  halfEquivalencePh?: number;
  unknownMolarityM?: number;
  percentIonization?: number;
  equilibriumConstant?: number;
  acceptedEquilibriumConstant?: number;
  percentError?: number;
  constantLabel?: "Ka" | "Kb";
  unknownSampleLabel?: string;
}

const DEFAULT_MODEL_TEMPERATURE_C = 25;
const DEFAULT_WATER_ION_PRODUCT = 1e-14;

const round = (value: number, digits: number): number => Number(value.toFixed(digits));

const positiveFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
};

export const sampleById = (
  config: TitrationInvestigationConfig,
  id: string,
): TitrationSample => {
  const sample = config.samples.find((candidate) => candidate.id === id);
  if (!sample) throw new Error(`Sample "${id}" was not found.`);
  return sample;
};

export const combinationById = (
  config: TitrationInvestigationConfig,
  id: string,
): TitrationCombination => {
  const combination = config.combinations.find((candidate) => candidate.id === id);
  if (!combination) throw new Error(`Titration combination "${id}" was not found.`);
  return combination;
};

export const validateInvestigationConfig = (
  config: TitrationInvestigationConfig,
): string[] => {
  const errors: string[] = [];
  if (config.samples.length !== 4) errors.push("Exactly four samples are required.");
  const sampleIds = new Set<string>();
  for (const sample of config.samples) {
    if (!sample.id.trim()) errors.push("Every sample requires a non-empty ID.");
    if (sampleIds.has(sample.id)) errors.push(`Sample ID "${sample.id}" is duplicated.`);
    sampleIds.add(sample.id);
    try {
      positiveFinite(sample.molarityM, `${sample.label} model molarity`);
      if (sample.strength === "weak") {
        positiveFinite(
          sample.acceptedEquilibriumConstant ?? Number.NaN,
          `${sample.label} accepted equilibrium constant`,
        );
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid sample configuration.");
    }
  }
  const structures = new Set(
    config.samples.map(
      (sample) => `${sample.role}:${sample.strength}:${sample.concentrationStatus}`,
    ),
  );
  for (const role of ["acid", "base"] as const) {
    if (!config.samples.some((sample) => sample.role === role && sample.concentrationStatus === "known")) {
      errors.push(`A known-concentration ${role} sample is required.`);
    }
    if (!config.samples.some((sample) => sample.role === role && sample.concentrationStatus === "unknown")) {
      errors.push(`An unknown-concentration ${role} sample is required.`);
    }
  }
  if (![...structures].some((structure) => structure.includes(":strong:"))) {
    errors.push("At least one strong sample is required.");
  }
  if (![...structures].some((structure) => structure.includes(":weak:"))) {
    errors.push("At least one weak sample is required.");
  }
  const combinationIds = new Set<string>();
  for (const combination of config.combinations) {
    if (!combination.id.trim()) errors.push("Every combination requires a non-empty ID.");
    if (combinationIds.has(combination.id)) {
      errors.push(`Combination ID "${combination.id}" is duplicated.`);
    }
    combinationIds.add(combination.id);
    try {
      const analyte = sampleById(config, combination.analyteId);
      const titrant = sampleById(config, combination.titrantId);
      if (analyte.role === titrant.role) {
        errors.push(`${combination.label} must pair an acid with a base.`);
      }
      if (titrant.strength !== "strong") {
        errors.push(
          `${combination.label} is unsupported: the configured titrant must be strong so post-equivalence pH is governed by stoichiometric excess titrant.`,
        );
      }
      if (
        analyte.concentrationStatus === "unknown" &&
        titrant.concentrationStatus === "unknown"
      ) {
        errors.push(
          `${combination.label} cannot determine molarity when both analyte and titrant concentrations are unknown.`,
        );
      }
      positiveFinite(combination.stoichiometricRatio.analyte, "Analyte stoichiometric ratio");
      positiveFinite(combination.stoichiometricRatio.titrant, "Titrant stoichiometric ratio");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid titration combination.");
    }
  }
  for (const requiredId of config.requiredCombinationIds) {
    if (!config.combinations.some((combination) => combination.id === requiredId)) {
      errors.push(`Required combination "${requiredId}" is missing.`);
    }
  }
  if (new Set(config.requiredCombinationIds).size !== config.requiredCombinationIds.length) {
    errors.push("Required combination IDs must be unique.");
  }
  if (!Number.isInteger(config.minimumReplicates) || config.minimumReplicates < 1) {
    errors.push("Minimum replicates must be a positive integer.");
  }
  try {
    const practiceAcid = sampleById(config, config.practice.acidSampleId);
    const practiceBase = sampleById(config, config.practice.baseSampleId);
    if (practiceAcid.role !== "acid" || practiceBase.role !== "base") {
      errors.push("Practice samples must reference an acid and a base respectively.");
    }
    if (practiceAcid.strength === "weak" && practiceBase.strength === "weak") {
      errors.push("The modeled equal-volume practice does not support a weak-acid/weak-base pair.");
    }
    positiveFinite(config.practice.portionMl, "Practice portion volume");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Invalid practice configuration.");
  }
  const settings = config.settings;
  for (const [value, label] of [
    [settings.aliquotMl, "Aliquot volume"],
    [settings.coarseIncrementMl, "Coarse increment"],
    [settings.fineIncrementMl, "Fine increment"],
    [settings.fineWindowMl, "Fine-increment window"],
    [settings.buretCapacityMl, "Buret capacity"],
    [settings.buretPrecisionMl, "Buret precision"],
    [settings.stabilityDeltaPh, "Stability delta-pH"],
    [settings.stabilityConsecutiveReadings, "Stability reading count"],
    [settings.minimumPostEquivalenceMl, "Minimum post-equivalence volume"],
    [settings.maximumPostEquivalenceMl, "Maximum post-equivalence volume"],
  ] as const) {
    try {
      positiveFinite(value, label);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Invalid ${label}.`);
    }
  }
  if (settings.fineIncrementMl >= settings.coarseIncrementMl) {
    errors.push("The fine increment must be smaller than the coarse increment.");
  }
  if (settings.minimumPostEquivalenceMl >= settings.maximumPostEquivalenceMl) {
    errors.push("Maximum post-equivalence volume must exceed the required minimum.");
  }
  if (
    !Number.isInteger(settings.stabilityConsecutiveReadings) ||
    settings.stabilityConsecutiveReadings < 1
  ) {
    errors.push("Stability reading count must be a positive integer.");
  }
  if (!Number.isInteger(settings.phPrecision) || settings.phPrecision < 0 || settings.phPrecision > 4) {
    errors.push("pH precision must be an integer from 0 through 4.");
  }
  if (!Number.isFinite(settings.temperatureC)) {
    errors.push("Model temperature must be a finite number.");
  }
  if (!Number.isFinite(settings.waterIonProduct) || settings.waterIonProduct <= 0) {
    errors.push("Water ion product must be a positive finite number.");
  }
  if (
    settings.aliquotMl < settings.allowedAliquotMl.min ||
    settings.aliquotMl > settings.allowedAliquotMl.max
  ) {
    errors.push("The default aliquot must be within the configured aliquot range.");
  }
  if (
    settings.allowedAliquotMl.min <= 0 ||
    settings.allowedAliquotMl.min > settings.allowedAliquotMl.max
  ) {
    errors.push("The allowed aliquot range must be positive and ordered.");
  }
  if (
    settings.allowedIncrementMl.min <= 0 ||
    settings.allowedIncrementMl.min > settings.allowedIncrementMl.max
  ) {
    errors.push("The allowed increment range must be positive and ordered.");
  }
  if (settings.probeRules.length === 0 || settings.probeRules.some((rule) => !rule.trim())) {
    errors.push("At least one non-empty pH-probe rule is required.");
  }
  if (
    config.safety.neutralizationPhRange.min >= config.safety.neutralizationPhRange.max ||
    config.safety.neutralizationPhRange.min < 0 ||
    config.safety.neutralizationPhRange.max > 14
  ) {
    errors.push("The disposal pH range must be ordered and stay within pH 0-14.");
  }
  return errors;
};

export const equivalenceVolumeMl = (
  analyte: TitrationSample,
  titrant: TitrationSample,
  aliquotMl: number,
  ratio: TitrationCombination["stoichiometricRatio"],
): number => {
  positiveFinite(aliquotMl, "Aliquot volume");
  positiveFinite(analyte.molarityM, "Analyte molarity");
  positiveFinite(titrant.molarityM, "Titrant molarity");
  return (
    (analyte.molarityM * aliquotMl * ratio.titrant) /
    (titrant.molarityM * ratio.analyte)
  );
};

const speciesFor = (sample: TitrationSample): AcidBaseTitrationModel["analyte"] => ({
  formula: sample.formula,
  role: sample.role,
  strength: sample.strength,
  ...(sample.acceptedEquilibriumConstant === undefined
    ? {}
    : { equilibriumConstant: sample.acceptedEquilibriumConstant }),
});

const sharedModelFor = (
  analyte: TitrationSample,
  titrant: TitrationSample,
  aliquotMl: number,
  ratio: TitrationCombination["stoichiometricRatio"],
  settings: Pick<TitrationSettings, "temperatureC" | "waterIonProduct" | "phPrecision">,
): AcidBaseTitrationModel => ({
  id: `investigation-14-${analyte.id}-${titrant.id}`,
  type: "acidBase",
  analyte: speciesFor(analyte),
  titrant: speciesFor(titrant),
  analyteMolarityM: analyte.molarityM,
  analyteVolumeMl: aliquotMl,
  titrantMolarityM: titrant.molarityM,
  stoichiometricRatio: ratio,
  temperatureC: settings.temperatureC,
  waterIonProduct: settings.waterIonProduct,
  phPrecision: settings.phPrecision,
});

const initialPh = (
  sample: TitrationSample,
  settings: Pick<TitrationSettings, "temperatureC" | "waterIonProduct" | "phPrecision"> = {
    temperatureC: DEFAULT_MODEL_TEMPERATURE_C,
    waterIonProduct: DEFAULT_WATER_ION_PRODUCT,
    phPrecision: 2,
  },
): number => {
  const oppositeRole: AcidBaseRole = sample.role === "acid" ? "base" : "acid";
  const counterpart: TitrationSample = {
    id: "strong-counterpart",
    label: "Strong counterpart",
    formula: oppositeRole === "base" ? "OH-" : "H+",
    role: oppositeRole,
    strength: "strong",
    concentrationStatus: "known",
    molarityM: sample.molarityM,
  };
  return calculateAcidBasePh(
    sharedModelFor(sample, counterpart, 1, { analyte: 1, titrant: 1 }, settings),
    0,
  ).ph;
};

const phAtVolume = (
  analyte: TitrationSample,
  titrant: TitrationSample,
  aliquotMl: number,
  titrantVolumeMl: number,
  ratio: TitrationCombination["stoichiometricRatio"],
  settings: Pick<TitrationSettings, "temperatureC" | "waterIonProduct" | "phPrecision"> = {
    temperatureC: DEFAULT_MODEL_TEMPERATURE_C,
    waterIonProduct: DEFAULT_WATER_ION_PRODUCT,
    phPrecision: 2,
  },
): number => {
  return calculateAcidBasePh(
    sharedModelFor(analyte, titrant, aliquotMl, ratio, settings),
    titrantVolumeMl,
  ).ph;
};

/**
 * A buret can only be set and read to its own resolution, so every scheduled volume — the
 * equivalence and half-equivalence markers included — has to land on that grid. Unsnapped markers
 * produced additions such as 1.375 mL, which the shared titration contract rejects because it
 * requires each delivery at the buret's reading resolution.
 */
const snapToBuret = (value: number, settings: TitrationSettings): number =>
  round(Math.round(value / settings.buretPrecisionMl) * settings.buretPrecisionMl, 3);

const buildVolumeSchedule = (
  equivalenceMl: number,
  settings: TitrationSettings,
): number[] => {
  for (const [value, label] of [
    [equivalenceMl, "Equivalence volume"],
    [settings.coarseIncrementMl, "Coarse increment"],
    [settings.fineIncrementMl, "Fine increment"],
    [settings.fineWindowMl, "Fine-increment window"],
    [settings.buretCapacityMl, "Buret capacity"],
    [settings.buretPrecisionMl, "Buret precision"],
    [settings.maximumPostEquivalenceMl, "Maximum post-equivalence volume"],
  ] as const) {
    positiveFinite(value, label);
  }
  if (settings.fineIncrementMl >= settings.coarseIncrementMl) {
    throw new Error("Fine increment must be smaller than coarse increment.");
  }
  const snap = (value: number): number => snapToBuret(value, settings);
  const markers = new Set<number>([0, snap(equivalenceMl / 2), snap(equivalenceMl)]);
  const values = new Set<number>(markers);
  const endMl = snap(Math.min(
    settings.buretCapacityMl,
    equivalenceMl + settings.maximumPostEquivalenceMl,
  ));
  markers.add(endMl);
  let volume = 0;
  while (volume < endMl) {
    const nearEquivalence =
      Math.abs(volume - equivalenceMl) <= settings.fineWindowMl ||
      Math.abs(volume + settings.coarseIncrementMl - equivalenceMl) <= settings.fineWindowMl;
    volume = Math.min(
      endMl,
      snap(volume + (nearEquivalence ? settings.fineIncrementMl : settings.coarseIncrementMl)),
    );
    values.add(volume);
  }
  // A landmark marker rarely lands on the increment grid, and the row next to it would then ask
  // for a sliver below the smallest deliverable addition. Drop that neighbouring grid row instead
  // of scheduling an addition the shared titration contract cannot accept; markers are kept
  // because the equivalence and half-equivalence rows are what the analysis reads.
  const sorted = [...values].sort((first, second) => first - second);
  const schedule: number[] = [];
  for (const candidate of sorted) {
    const previous = schedule.at(-1);
    if (
      previous !== undefined &&
      candidate - previous + 1e-9 < settings.allowedIncrementMl.min
    ) {
      if (markers.has(candidate) && !markers.has(previous)) schedule[schedule.length - 1] = candidate;
      continue;
    }
    schedule.push(candidate);
  }
  return schedule;
};


export const generateTitrationCurve = (
  config: TitrationInvestigationConfig,
  combinationId: string,
  settings: TitrationSettings = config.settings,
): CurveResult => {
  const combination = combinationById(config, combinationId);
  const analyte = sampleById(config, combination.analyteId);
  const titrant = sampleById(config, combination.titrantId);
  if (titrant.strength !== "strong") {
    throw new Error(`${combination.label} requires a strong titrant in this model.`);
  }
  const equivalenceMl = equivalenceVolumeMl(
    analyte,
    titrant,
    settings.aliquotMl,
    combination.stoichiometricRatio,
  );
  const schedule = buildVolumeSchedule(equivalenceMl, settings);
  let stableCount = 0;
  let previousPh: number | undefined;
  const points: CurvePoint[] = [];

  for (const volumeMl of schedule) {
    const ph = round(
      Math.max(
        0,
        Math.min(
          14,
          phAtVolume(
            analyte,
            titrant,
            settings.aliquotMl,
            volumeMl,
            combination.stoichiometricRatio,
            settings,
          ),
        ),
      ),
      settings.phPrecision,
    );
    const afterMinimumPostRegion =
      volumeMl >= equivalenceMl + settings.minimumPostEquivalenceMl;
    if (
      afterMinimumPostRegion &&
      previousPh !== undefined &&
      Math.abs(ph - previousPh) <= settings.stabilityDeltaPh
    ) {
      stableCount += 1;
    } else {
      stableCount = 0;
    }
    const stableAfterSteepRegion =
      stableCount >= settings.stabilityConsecutiveReadings;
    // Landmarks are identified on the same buret grid the schedule uses, so a marker that had to
    // be snapped still classifies its row instead of silently losing the equivalence flag.
    const isEquivalence = volumeMl === snapToBuret(equivalenceMl, settings);
    const isHalf = volumeMl === snapToBuret(equivalenceMl / 2, settings);
    points.push({
      volumeMl,
      ph,
      region:
        volumeMl === 0
          ? "initial"
          : isEquivalence
            ? "equivalence"
            : isHalf && analyte.strength === "weak"
              ? "half-equivalence"
              : volumeMl < equivalenceMl
                ? "pre-equivalence"
                : "post-equivalence",
      stableAfterSteepRegion,
    });
    previousPh = ph;
    if (stableAfterSteepRegion) break;
  }

  return {
    combinationId,
    equivalenceVolumeMl: round(equivalenceMl, 3),
    points,
    stabilityReached: points.at(-1)?.stableAfterSteepRegion ?? false,
  };
};

export const analysisTargets = (
  config: TitrationInvestigationConfig,
  result: CurveResult,
): AnalysisTargets => {
  const combination = combinationById(config, result.combinationId);
  const analyte = sampleById(config, combination.analyteId);
  const titrant = sampleById(config, combination.titrantId);
  const equivalencePoint = result.points.find((point) => point.region === "equivalence");
  const halfPoint = result.points.find((point) => point.region === "half-equivalence");
  const targets: AnalysisTargets = {
    equivalenceVolumeMl: result.equivalenceVolumeMl,
    equivalencePh: equivalencePoint?.ph ?? 7,
    halfEquivalenceVolumeMl: halfPoint?.volumeMl,
    halfEquivalencePh: halfPoint?.ph,
  };

  if (analyte.concentrationStatus === "unknown") {
    targets.unknownMolarityM = round(
      (titrant.molarityM *
        result.equivalenceVolumeMl *
        combination.stoichiometricRatio.analyte) /
        (config.settings.aliquotMl * combination.stoichiometricRatio.titrant),
      4,
    );
    targets.unknownSampleLabel = analyte.label;
  } else if (titrant.concentrationStatus === "unknown") {
    targets.unknownMolarityM = round(
      (analyte.molarityM *
        config.settings.aliquotMl *
        combination.stoichiometricRatio.titrant) /
        (result.equivalenceVolumeMl * combination.stoichiometricRatio.analyte),
      4,
    );
    targets.unknownSampleLabel = titrant.label;
  }

  if (analyte.strength === "weak") {
    const initial = result.points[0].ph;
    const ionizedConcentration =
      analyte.role === "acid" ? 10 ** -initial : 10 ** -(14 - initial);
    if (!halfPoint) {
      throw new Error(`${combination.label} requires a half-equivalence point.`);
    }
    const constant =
      analyte.role === "acid"
        ? 10 ** -halfPoint.ph
        : 10 ** -(14 - halfPoint.ph);
    const accepted = analyte.acceptedEquilibriumConstant;
    targets.percentIonization = round(
      (ionizedConcentration / analyte.molarityM) * 100,
      3,
    );
    targets.equilibriumConstant = Number(constant.toPrecision(3));
    targets.acceptedEquilibriumConstant = accepted;
    targets.percentError = accepted
      ? round((Math.abs(constant - accepted) / accepted) * 100, 2)
      : undefined;
    targets.constantLabel = analyte.role === "acid" ? "Ka" : "Kb";
  }
  return targets;
};

export const practicePh = (sample: TitrationSample, precision = 1): number =>
  round(initialPh(sample), precision);

export const practiceMixturePh = (
  acid: TitrationSample,
  base: TitrationSample,
  portionMl: number,
  precision = 1,
): number => {
  if (acid.role !== "acid" || base.role !== "base") {
    throw new Error("Practice mixture requires an acid and a base.");
  }
  if (acid.strength === "weak" && base.strength === "weak") {
    throw new Error("Weak-acid/weak-base practice mixtures are outside this model.");
  }
  const analyte = acid.strength === "weak" ? acid : base.strength === "weak" ? base : acid;
  const titrant = analyte.id === acid.id ? base : acid;
  return round(
    Math.max(0, Math.min(14, phAtVolume(analyte, titrant, portionMl, portionMl, {
      analyte: 1,
      titrant: 1,
    }))),
    precision,
  );
};

export const isAnalysisValueWithinTolerance = (
  submitted: number,
  expected: number,
  relativeTolerance = 0.03,
  absoluteTolerance = 0.02,
): boolean =>
  Number.isFinite(submitted) &&
  Math.abs(submitted - expected) <=
    Math.max(absoluteTolerance, Math.abs(expected) * relativeTolerance);
