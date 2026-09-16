import { hardWaterSamples } from "../domain/fixtures";
import type {
  DataSeriesPoint,
  KineticsConditionDefinition,
  KineticsModelDefinition,
  StoichiometricRatio,
} from "../domain/types";

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  pointCount: number;
}

export const calculateLinearRegression = (
  points: DataSeriesPoint[],
): LinearRegressionResult => {
  if (points.length < 2 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error("Linear regression requires at least two finite data pairs.");
  }
  const pointCount = points.length;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / pointCount;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / pointCount;
  const sumXX = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (sumXX === 0) throw new Error("Linear regression requires at least two distinct x values.");
  const sumXY = points.reduce(
    (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
    0,
  );
  const slope = sumXY / sumXX;
  const intercept = meanY - slope * meanX;
  const totalVariation = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const residualVariation = points.reduce(
    (sum, point) => sum + (point.y - (slope * point.x + intercept)) ** 2,
    0,
  );
  const rSquared = totalVariation === 0 ? 1 : 1 - residualVariation / totalVariation;
  return { slope, intercept, rSquared, pointCount };
};

export type RegressionTransform = "identity" | "ln" | "reciprocal";

export const transformRegressionSeries = (
  points: DataSeriesPoint[],
  transform: RegressionTransform,
): DataSeriesPoint[] =>
  points.map((point) => {
    if (transform !== "identity" && point.y <= 0) {
      throw new Error("Logarithmic and reciprocal fits require positive concentration values.");
    }
    return {
      x: point.x,
      y: transform === "ln" ? Math.log(point.y) : transform === "reciprocal" ? 1 / point.y : point.y,
    };
  });

export const calculateConcentrationSeries = (
  absorbancePoints: DataSeriesPoint[],
  calibration: Pick<LinearRegressionResult, "slope" | "intercept">,
): DataSeriesPoint[] => {
  if (!Number.isFinite(calibration.slope) || calibration.slope === 0 || !Number.isFinite(calibration.intercept)) {
    throw new Error("A finite, non-zero calibration slope and finite intercept are required.");
  }
  return absorbancePoints.map((point) => {
    const concentration = (point.y - calibration.intercept) / calibration.slope;
    if (!Number.isFinite(concentration) || concentration <= 0) {
      throw new Error("Every absorbance must convert to a positive finite concentration.");
    }
    return { x: point.x, y: concentration };
  });
};

export const calculateNitricAcidVolumeMl = (
  brassMassG: number,
  acidMolarityM = 15.8,
  copperMolarMassGPerMol = 63.546,
  acidMolesPerCopperMole = 8 / 3,
): number => {
  if (
    ![brassMassG, acidMolarityM, copperMolarMassGPerMol, acidMolesPerCopperMole].every(Number.isFinite) ||
    brassMassG <= 0 || acidMolarityM <= 0 || copperMolarMassGPerMol <= 0 || acidMolesPerCopperMole <= 0
  ) {
    throw new Error("Brass mass and nitric-acid calculation constants must be positive finite values.");
  }
  return (brassMassG / copperMolarMassGPerMol) * acidMolesPerCopperMole / acidMolarityM * 1000;
};

export const calculateDilutionAliquotMl = (
  stockConcentrationM: number,
  targetConcentrationM: number,
  finalVolumeMl: number,
): number => {
  if (
    ![stockConcentrationM, targetConcentrationM, finalVolumeMl].every(Number.isFinite) ||
    stockConcentrationM <= 0 || targetConcentrationM < 0 || finalVolumeMl <= 0 ||
    targetConcentrationM > stockConcentrationM
  ) {
    throw new Error("Dilution concentrations and final volume are outside their valid ranges.");
  }
  return targetConcentrationM * finalVolumeMl / stockConcentrationM;
};

export const calculateConcentrationFromRegression = (
  response: number,
  regression: Pick<LinearRegressionResult, "slope" | "intercept">,
): number => calculateConcentrationSeries([{ x: 0, y: response }], regression)[0].y;

export const calculateCopperMassG = (
  concentrationM: number,
  solutionVolumeMl: number,
  copperMolarMassGPerMol = 63.546,
): number => {
  if (
    ![concentrationM, solutionVolumeMl, copperMolarMassGPerMol].every(Number.isFinite) ||
    concentrationM < 0 || solutionVolumeMl <= 0 || copperMolarMassGPerMol <= 0
  ) {
    throw new Error("Copper concentration, solution volume, and molar mass must be valid finite values.");
  }
  return concentrationM * solutionVolumeMl / 1000 * copperMolarMassGPerMol;
};

export const calculateMassPercent = (componentMassG: number, totalMassG: number): number => {
  if (!Number.isFinite(componentMassG) || !Number.isFinite(totalMassG) || componentMassG < 0 || totalMassG <= 0) {
    throw new Error("Component and total masses must be valid finite values.");
  }
  return componentMassG / totalMassG * 100;
};

export const calculateVisualComparisonConcentration = (
  knownConcentrationM: number,
  knownDepthMm: number,
  unknownDepthMm: number,
): number => {
  if (
    ![knownConcentrationM, knownDepthMm, unknownDepthMm].every(Number.isFinite) ||
    knownConcentrationM <= 0 || knownDepthMm <= 0 || unknownDepthMm <= 0
  ) {
    throw new Error("Visual-comparison concentration and both depths must be positive finite values.");
  }
  return knownConcentrationM * knownDepthMm / unknownDepthMm;
};

export const calculatePercentDifference = (first: number, second: number): number => {
  if (![first, second].every(Number.isFinite) || first < 0 || second < 0 || first + second === 0) {
    throw new Error("Percent difference requires two non-negative finite values with a non-zero mean.");
  }
  return Math.abs(first - second) / ((first + second) / 2) * 100;
};

export const calculatePrecipitateMassG = (finalMassG: number, tareMassG: number): number =>
  Number((finalMassG - tareMassG).toFixed(5));

/**
 * Hardness of the analysed aliquot, in mg/L as CaCO3.
 *
 * `preconcentrationFactor` divides the result back to the source water. Investigation 3 boils its
 * community samples down to one two-hundredth of their initial volume, so an aliquot result is 200
 * times the source-water hardness. The factor defaults to 1: an undeclared factor means "this
 * aliquot is the sample", never an assumed 200.
 */
export const calculateHardnessMgLAsCaCO3 = (
  precipitateMassG: number,
  sampleVolumeMl: number,
  preconcentrationFactor = 1,
): number => {
  if (sampleVolumeMl <= 0) {
    throw new Error("Sample volume must be greater than zero.");
  }
  if (!Number.isFinite(preconcentrationFactor) || preconcentrationFactor <= 0) {
    throw new Error("Preconcentration factor must be a positive finite value.");
  }
  return Number(
    ((precipitateMassG * 1_000_000) / sampleVolumeMl / preconcentrationFactor).toFixed(2),
  );
};

/**
 * Collected precipitate mass, by difference from the cooled combined mass.
 *
 * Every tare is required. Investigation 3 weighs the filter paper (FD-01) and the labelled watch
 * glass (FD-10) separately, and a missing tare is a missing measurement, not a zero: subtracting
 * nothing would silently report the whole assembly as precipitate.
 */
export const calculateGravimetricPrecipitateMassG = (
  combinedMassG: number,
  tareMassesG: number[],
): number => {
  if (!Number.isFinite(combinedMassG)) {
    throw new Error("Combined mass must be a finite value.");
  }
  if (tareMassesG.length === 0 || tareMassesG.some((mass) => !Number.isFinite(mass))) {
    throw new Error("Every tare mass must be a recorded finite value.");
  }
  const precipitateMassG = tareMassesG.reduce((mass, tare) => mass - tare, combinedMassG);
  if (precipitateMassG <= 0) {
    throw new Error("The combined mass must exceed the sum of the recorded tares.");
  }
  return Number(precipitateMassG.toFixed(5));
};

/** Anhydrous molar masses. A hydrated reagent needs a different model, not a different rounding. */
export const CALCIUM_CARBONATE_MOLAR_MASS_G_MOL = 100.0869;
export const SODIUM_CARBONATE_MOLAR_MASS_G_MOL = 105.9884;
export const CALCIUM_CHLORIDE_MOLAR_MASS_G_MOL = 110.984;

/**
 * Theoretical CaCO3 mass from the two recorded practice reactant masses.
 *
 * Na2CO3 + CaCl2 -> CaCO3 + 2 NaCl is 1:1:1 in the two reactants and the product, so the limiting
 * reactant is whichever supplies fewer moles. Both masses are required: this is the comparison the
 * student's recovery argument rests on (FD-21), and defaulting either to zero would make the
 * comparison pass against nothing.
 */
export const calculateCalciumCarbonateTheoreticalMassG = (
  sodiumCarbonateMassG: number,
  calciumChlorideMassG: number,
): number => {
  if (!Number.isFinite(sodiumCarbonateMassG) || !Number.isFinite(calciumChlorideMassG)) {
    throw new Error("Both recorded reactant masses must be finite values.");
  }
  if (sodiumCarbonateMassG <= 0 || calciumChlorideMassG <= 0) {
    throw new Error("Both recorded reactant masses must be greater than zero.");
  }
  const limitingMoles = Math.min(
    sodiumCarbonateMassG / SODIUM_CARBONATE_MOLAR_MASS_G_MOL,
    calciumChlorideMassG / CALCIUM_CHLORIDE_MOLAR_MASS_G_MOL,
  );
  return Number((limitingMoles * CALCIUM_CARBONATE_MOLAR_MASS_G_MOL).toFixed(5));
};

export const calculateAcidBaseMolarity = (
  titrantMolarity: number,
  initialBuretteMl: number,
  finalBuretteMl: number,
  analyteVolumeMl: number,
  stoichiometricRatio: StoichiometricRatio = { analyte: 1, titrant: 1 },
): number => {
  if (analyteVolumeMl <= 0) {
    throw new Error("Analyte volume must be greater than zero.");
  }
  if (
    stoichiometricRatio.analyte <= 0 ||
    stoichiometricRatio.titrant <= 0 ||
    !Number.isFinite(stoichiometricRatio.analyte) ||
    !Number.isFinite(stoichiometricRatio.titrant)
  ) {
    throw new Error("Stoichiometric ratio must contain positive finite values.");
  }
  const deliveredMl = finalBuretteMl - initialBuretteMl;
  if (deliveredMl <= 0) {
    throw new Error("Final burette reading must be greater than initial reading.");
  }
  return Number(
    (
      (titrantMolarity * deliveredMl * stoichiometricRatio.analyte) /
      (analyteVolumeMl * stoichiometricRatio.titrant)
    ).toFixed(4),
  );
};

/* ------------------------------------------------------------------ *
 * Investigation 8 - redox titration (Cycle 09).
 *
 * These three templates were authored into
 * `public/labs/hydrogen-peroxide-redox-titration.json` with no implementation anywhere in the
 * runtime. Every one of the lab's twelve calculation steps therefore fell through to
 * `Number(action.value ?? params.expected ?? 0)` in the reducer, computed the teacher's own
 * `expected` value, compared it against itself, and passed - the same class of defect Cycle 08
 * found in `gravimetricPrecipitateMass`. Each function below derives its result from recorded
 * evidence and throws rather than returning a placeholder.
 * ------------------------------------------------------------------ */

export const HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL = 34.0147;

const deliveredTitrantMl = (initialBuretteMl: number, finalBuretteMl: number): number => {
  if (!Number.isFinite(initialBuretteMl) || !Number.isFinite(finalBuretteMl)) {
    throw new Error("Both burette readings must be recorded before a delivered volume exists.");
  }
  const deliveredMl = finalBuretteMl - initialBuretteMl;
  if (deliveredMl <= 0) {
    throw new Error("Final burette reading must be greater than initial reading.");
  }
  return deliveredMl;
};

const positiveRatio = (ratio: StoichiometricRatio): StoichiometricRatio => {
  if (
    !Number.isFinite(ratio.analyte) ||
    !Number.isFinite(ratio.titrant) ||
    ratio.analyte <= 0 ||
    ratio.titrant <= 0
  ) {
    throw new Error("Stoichiometric ratio must contain positive finite values.");
  }
  return ratio;
};

/**
 * ST-05. The titrant molarity a standardization trial reports, from the student's own Fe2+ aliquot
 * and their own pair of burette readings. `stoichiometricRatio` carries the 5 Fe2+ : 1 MnO4- of the
 * acidified permanganate half-reactions; it is configuration, not a constant baked in here.
 */
export const calculatePermanganateMolarityFromIron = (
  standardMolarityM: number,
  standardAliquotMl: number,
  initialBuretteMl: number,
  finalBuretteMl: number,
  stoichiometricRatio: StoichiometricRatio = { analyte: 5, titrant: 1 },
): number => {
  if (!Number.isFinite(standardMolarityM) || standardMolarityM <= 0) {
    throw new Error("Standard molarity must be a positive finite value.");
  }
  if (!Number.isFinite(standardAliquotMl) || standardAliquotMl <= 0) {
    throw new Error("Standard aliquot volume must be a positive finite value.");
  }
  const ratio = positiveRatio(stoichiometricRatio);
  const deliveredMl = deliveredTitrantMl(initialBuretteMl, finalBuretteMl);
  return Number(
    ((standardMolarityM * standardAliquotMl * ratio.titrant) / (deliveredMl * ratio.analyte)).toFixed(6),
  );
};

/**
 * AN-01. Percent H2O2 by mass from the standardized titrant molarity, the delivered volume, and the
 * manual's explicit 1.00 g/mL density (finding 8). The density is a parameter rather than a literal
 * so that a teacher who states a different one is not silently overridden.
 */
export const calculateHydrogenPeroxidePercent = (
  titrantMolarityM: number,
  initialBuretteMl: number,
  finalBuretteMl: number,
  sampleAliquotMl: number,
  densityGPerMl: number,
  stoichiometricRatio: StoichiometricRatio = { analyte: 5, titrant: 2 },
  analyteMolarMassGPerMol: number = HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL,
): number => {
  if (!Number.isFinite(titrantMolarityM) || titrantMolarityM <= 0) {
    throw new Error("Standardized titrant molarity must be a positive finite value.");
  }
  if (!Number.isFinite(sampleAliquotMl) || sampleAliquotMl <= 0) {
    throw new Error("Sample aliquot volume must be a positive finite value.");
  }
  if (!Number.isFinite(densityGPerMl) || densityGPerMl <= 0) {
    throw new Error("Sample density must be a positive finite value.");
  }
  if (!Number.isFinite(analyteMolarMassGPerMol) || analyteMolarMassGPerMol <= 0) {
    throw new Error("Analyte molar mass must be a positive finite value.");
  }
  const ratio = positiveRatio(stoichiometricRatio);
  const deliveredMl = deliveredTitrantMl(initialBuretteMl, finalBuretteMl);
  const titrantMoles = (titrantMolarityM * deliveredMl) / 1000;
  const analyteMoles = (titrantMoles * ratio.analyte) / ratio.titrant;
  const analyteMassG = analyteMoles * analyteMolarMassGPerMol;
  const sampleMassG = sampleAliquotMl * densityGPerMl;
  return Number(((analyteMassG / sampleMassG) * 100).toFixed(4));
};

/**
 * ST-06 and AN-02. The mean of named trial results. `maximumRange` carries the configured
 * standardization precision: the source requires acceptable precision but never states a number, so
 * a run that exceeds the configured spread is rejected instead of being averaged away.
 */
export const calculateMeanOfValues = (
  values: number[],
  options: { maximumRange?: number } = {},
): number => {
  if (values.length === 0) {
    throw new Error("At least one trial result is required before an average exists.");
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Every trial result must be recorded before they can be averaged.");
  }
  const maximumRange = options.maximumRange;
  if (typeof maximumRange === "number" && Number.isFinite(maximumRange) && values.length > 1) {
    const range = Math.max(...values) - Math.min(...values);
    if (range > maximumRange) {
      throw new Error(
        `Trial results span ${Number(range.toFixed(6))}, which exceeds the configured acceptable range of ${maximumRange}.`,
      );
    }
  }
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(6));
};

export const calculateDilutedConcentration = (
  stockConcentration: number,
  stockVolumeMl: number,
  finalVolumeMl: number,
): number => {
  if (stockVolumeMl < 0) {
    throw new Error("Stock volume must be non-negative.");
  }
  if (finalVolumeMl <= 0) {
    throw new Error("Final volume must be greater than zero.");
  }
  if (stockConcentration < 0 || !Number.isFinite(stockConcentration)) {
    throw new Error("Stock concentration must be a non-negative finite value.");
  }
  return Number(((stockConcentration * stockVolumeMl) / finalVolumeMl).toFixed(6));
};

export const calculateDecimalTransmittance = (percentTransmittance: number): number => {
  if (percentTransmittance <= 0 || percentTransmittance > 100) {
    throw new Error("Percent transmittance must be greater than 0 and at most 100.");
  }
  return Number((percentTransmittance / 100).toFixed(4));
};

export const calculateAbsorbanceFromPercentT = (percentTransmittance: number): number => {
  if (percentTransmittance <= 0 || percentTransmittance > 100) {
    throw new Error("Percent transmittance must be greater than 0 and at most 100.");
  }
  return Number((-Math.log10(percentTransmittance / 100)).toFixed(4));
};

/* ------------------------------------------------------------------ *
 * Cycle 06: photometric quantities.
 *
 * Investigation 1 measures percent transmittance, converts it to decimal transmittance, and only
 * then discusses `-log T`; Investigation 11 measures absorbance directly. Three different numbers
 * describe the same beam, and 42 means "42 %T", "T = 42" (impossible), or "A = 42" (impossible)
 * depending on which one is meant. Naming the quantity is therefore part of the measurement, not
 * presentation, and the unit string is derived from the quantity rather than authored beside it.
 * ------------------------------------------------------------------ */

export const PHOTOMETRIC_QUANTITIES = [
  "percentTransmittance",
  "decimalTransmittance",
  "absorbance",
] as const;

export type PhotometricQuantity = (typeof PHOTOMETRIC_QUANTITIES)[number];

export const isPhotometricQuantity = (value: string): value is PhotometricQuantity =>
  (PHOTOMETRIC_QUANTITIES as readonly string[]).includes(value);

/** The one unit each quantity may be stored and displayed with. */
export const PHOTOMETRIC_UNITS: Record<PhotometricQuantity, string> = {
  percentTransmittance: "%T",
  decimalTransmittance: "T",
  absorbance: "absorbance",
};

export const photometricQuantityUnit = (quantity: PhotometricQuantity): string =>
  PHOTOMETRIC_UNITS[quantity];

/**
 * Whether a value can be that quantity at all.
 *
 * These are the physical limits of the quantity, not an instrument's reliable range: a photometer
 * that stops being trustworthy above A = 1.0 still *reports* A = 1.4, and Investigation 11 asks the
 * student to notice that and redesign (finding 3.4). The reliable maximum is teacher-configured and
 * is checked separately, so an over-range reading is recorded and flagged rather than rejected.
 */
export const photometricValueInRange = (quantity: PhotometricQuantity, value: number): boolean => {
  if (!Number.isFinite(value)) return false;
  if (quantity === "percentTransmittance") return value > 0 && value <= 100;
  if (quantity === "decimalTransmittance") return value > 0 && value <= 1;
  return value >= 0;
};

/**
 * `A = -log10(T)` applied to a **decimal** transmittance only.
 *
 * `calculateAbsorbanceFromPercentT` divides by 100 first; this one must not, so it refuses any
 * value above 1. Handing it a percent transmittance of 42 would otherwise return -1.6232, a
 * negative absorbance that no static check would question.
 */
export const calculateAbsorbanceFromDecimalT = (decimalTransmittance: number): number => {
  if (!Number.isFinite(decimalTransmittance)) {
    throw new Error("Decimal transmittance must be a finite value.");
  }
  if (decimalTransmittance <= 0 || decimalTransmittance > 1) {
    throw new Error(
      "Decimal transmittance must be greater than 0 and at most 1; a percent transmittance is not a decimal transmittance.",
    );
  }
  return Number((-Math.log10(decimalTransmittance)).toFixed(4));
};

export const MICROMOLAR_PER_MOLAR = 1_000_000;

/**
 * `M1V1 = M2V2` for Investigation 1's eight standards, reported in micromolar.
 *
 * The stock concentration is teacher-supplied and recorded in molar (P-01, M); the plan asks for
 * "final concentration in micromolar" (§11). The template name `dilutedConcentrationMicromolar` had
 * no implementation at all before this cycle, so all eight standards computed 0, compared 0 against
 * an expected 0 with a tolerance of 0, and passed.
 *
 * The conversion is applied before rounding rather than after. `calculateDilutedConcentration`
 * rounds to six decimals in molar, which is 1 µM of resolution — routing a micromolar result
 * through it would quantise the whole series and send a 0.1 µM standard to 0.
 */
export const calculateDilutedConcentrationMicromolar = (
  stockConcentrationM: number,
  stockVolumeMl: number,
  finalVolumeMl: number,
): number => {
  if (stockVolumeMl < 0) {
    throw new Error("Stock volume must be non-negative.");
  }
  if (finalVolumeMl <= 0) {
    throw new Error("Final volume must be greater than zero.");
  }
  if (stockConcentrationM < 0 || !Number.isFinite(stockConcentrationM)) {
    throw new Error("Stock concentration must be a non-negative finite value.");
  }
  return Number(
    (((stockConcentrationM * stockVolumeMl) / finalVolumeMl) * MICROMOLAR_PER_MOLAR).toFixed(4),
  );
};

export const calculateChromatographyRf = (
  bandDistanceMm: number,
  solventFrontMm: number,
): number => {
  if (bandDistanceMm < 0 || !Number.isFinite(bandDistanceMm)) {
    throw new Error("Band distance must be a non-negative finite value.");
  }
  if (solventFrontMm <= 0 || !Number.isFinite(solventFrontMm)) {
    throw new Error("Solvent front distance must be greater than zero.");
  }
  if (bandDistanceMm > solventFrontMm) {
    throw new Error("Band distance cannot exceed solvent front distance.");
  }
  return Number((bandDistanceMm / solventFrontMm).toFixed(4));
};

/**
 * A ruler reading, quantised to the divisions the modelled ruler actually has.
 *
 * Investigation 5 records every distance "to the nearest mm" (TR-12, TR-14) with a metric ruler, so
 * a reading is never finer than one division. The precision is a parameter rather than a constant
 * because the strip length, and therefore the useful division, is a teacher configuration point
 * (confirmation point 3); a precision of 0 or less means "do not quantise".
 */
export const quantiseRulerReadingMm = (
  readingMm: number,
  divisionMm: number,
): number => {
  if (!Number.isFinite(readingMm)) {
    throw new Error("A ruler reading must be a finite value.");
  }
  if (!Number.isFinite(divisionMm) || divisionMm <= 0) return readingMm;
  return Number((Math.round(readingMm / divisionMm) * divisionMm).toFixed(4));
};

/**
 * Percent of the starting sample mass that one recovered component accounts for.
 *
 * Investigation 9's Data Collection sentence describes dividing "the sum of the masses of all
 * recovered components by the mass ... multiplied by 100", which is total percent recovery rather
 * than per-component composition (finding 3.7, confirmation point 1). The source ambiguity is not
 * resolved here: this function implements only one of the two readings, and the caller must state
 * which convention was confirmed before it runs. Both masses are required, because a component mass
 * of zero is an unmeasured component, not a component that is absent.
 */
export const calculateComponentMassPercent = (
  componentMassG: number,
  startingMassG: number,
): number => {
  if (!Number.isFinite(componentMassG) || componentMassG < 0) {
    throw new Error("A recovered component mass must be a non-negative finite value.");
  }
  if (!Number.isFinite(startingMassG) || startingMassG <= 0) {
    throw new Error("The starting sample mass must be greater than zero.");
  }
  return Number(((componentMassG / startingMassG) * 100).toFixed(2));
};

/**
 * Percent of the starting sample mass recovered across every component.
 *
 * This is the other reading of the same source sentence, kept as a separate calculation so that a
 * composition figure and a recovery figure can never be the same number by accident. An empty
 * component list is a missing measurement set rather than a 0 % recovery.
 */
export const calculateTotalPercentRecovery = (
  componentMassesG: number[],
  startingMassG: number,
): number => {
  if (componentMassesG.length === 0) {
    throw new Error("Total percent recovery needs at least one recovered component mass.");
  }
  for (const massG of componentMassesG) {
    if (!Number.isFinite(massG) || massG < 0) {
      throw new Error("Every recovered component mass must be a non-negative finite value.");
    }
  }
  if (!Number.isFinite(startingMassG) || startingMassG <= 0) {
    throw new Error("The starting sample mass must be greater than zero.");
  }
  const recoveredG = componentMassesG.reduce((total, massG) => total + massG, 0);
  return Number(((recoveredG / startingMassG) * 100).toFixed(2));
};

const round = (value: number, digits: number): number => Number(value.toFixed(digits));

export const generateGasVolumeSeries = (
  model: KineticsModelDefinition,
  conditionId: string,
  measuredMassG?: number,
): {
  condition: KineticsConditionDefinition;
  points: DataSeriesPoint[];
  effectiveMaxVolumeMl: number;
} => {
  const condition = model.conditions.find((candidate) => candidate.id === conditionId);
  if (!condition) {
    throw new Error(`Kinetics condition "${conditionId}" was not found.`);
  }
  if (model.timepointsS.length < 2) {
    throw new Error("Kinetics models need at least two time points.");
  }
  const referenceMassG = model.controlled.marbleMassG;
  if (measuredMassG !== undefined && (!Number.isFinite(measuredMassG) || measuredMassG <= 0)) {
    throw new Error("The measured marble mass must be a positive finite value.");
  }
  if (measuredMassG !== undefined && (!Number.isFinite(referenceMassG) || referenceMassG <= 0)) {
    throw new Error("The kinetics model requires a positive controlled marble reference mass.");
  }
  const effectiveMaxVolumeMl = measuredMassG === undefined
    ? model.baseMaxVolumeMl
    : model.baseMaxVolumeMl * measuredMassG / referenceMassG;
  const points = model.timepointsS.map((timeS) => ({
    x: timeS,
    y: round(effectiveMaxVolumeMl * (1 - Math.exp(-model.baseRateConstant * condition.rateFactor * timeS)), 1),
  }));
  return { condition, points, effectiveMaxVolumeMl };
};

export const calculateInitialRateMlPerS = (
  points: DataSeriesPoint[],
  intervalS = 15,
): number => {
  const first = points.find((point) => point.x === 0);
  const intervalPoint = points.find((point) => point.x === intervalS);
  if (!first || !intervalPoint || intervalPoint.x <= first.x) {
    throw new Error(`Data series must include 0 s and ${intervalS} s readings.`);
  }
  return round((intervalPoint.y - first.y) / (intervalPoint.x - first.x), 3);
};

export const compareRatesByCondition = (
  rates: { conditionId: string; value: number }[],
): { fastestConditionId: string; slowestConditionId: string; spread: number } => {
  if (rates.length === 0) {
    throw new Error("At least one rate is required for comparison.");
  }
  const fastest = rates.reduce((best, rate) => (rate.value > best.value ? rate : best), rates[0]);
  const slowest = rates.reduce((best, rate) => (rate.value < best.value ? rate : best), rates[0]);
  return {
    fastestConditionId: fastest.conditionId,
    slowestConditionId: slowest.conditionId,
    spread: round(fastest.value - slowest.value, 3),
  };
};

export const isWithinTolerance = (
  value: number,
  expected: number,
  tolerance: number,
): boolean => Math.abs(value - expected) <= tolerance;

export const SODIUM_BICARBONATE_MOLAR_MASS_G_MOL = 84.0066;
export const CARBON_DIOXIDE_MOLAR_MASS_G_MOL = 44.0095;
export const WATER_MOLAR_MASS_G_MOL = 18.0153;

export interface CarbonateMassLossComposition {
  massLossG: number;
  sodiumBicarbonateMassG: number;
  sodiumCarbonateInitialMassG: number;
  sodiumBicarbonatePercent: number;
  sodiumCarbonatePercent: number;
}

export const calculateCarbonateMassLossComposition = (
  initialMassG: number,
  finalMassG: number,
  sampleMassG: number,
): CarbonateMassLossComposition => {
  if (!Number.isFinite(initialMassG) || !Number.isFinite(finalMassG) || !Number.isFinite(sampleMassG)) {
    throw new Error("Mass inputs must be finite numbers.");
  }
  if (sampleMassG <= 0) {
    throw new Error("Sample mass must be greater than zero.");
  }
  const massLossG = initialMassG - finalMassG;
  if (massLossG <= 0) {
    throw new Error("Final mass must be less than initial mass.");
  }
  const sodiumBicarbonateMassG =
    massLossG *
    ((2 * SODIUM_BICARBONATE_MOLAR_MASS_G_MOL) /
      (CARBON_DIOXIDE_MOLAR_MASS_G_MOL + WATER_MOLAR_MASS_G_MOL));
  const sodiumCarbonateInitialMassG = sampleMassG - sodiumBicarbonateMassG;
  if (sodiumCarbonateInitialMassG < 0) {
    throw new Error("Mass loss exceeds the amount possible for the configured sample mass.");
  }
  return {
    massLossG: round(massLossG, 4),
    sodiumBicarbonateMassG: round(sodiumBicarbonateMassG, 4),
    sodiumCarbonateInitialMassG: round(sodiumCarbonateInitialMassG, 4),
    sodiumBicarbonatePercent: round((sodiumBicarbonateMassG / sampleMassG) * 100, 2),
    sodiumCarbonatePercent: round((sodiumCarbonateInitialMassG / sampleMassG) * 100, 2),
  };
};

export const hardWaterRegressionValues = hardWaterSamples.map((sample) => ({
  ...sample,
  calculated: calculateHardnessMgLAsCaCO3(sample.precipitateMassG, 20),
}));

export const WATER_DENSITY_G_PER_ML = 1;
export const WATER_SPECIFIC_HEAT_J_PER_G_C = 4.184;

export interface CalorimeterCalibrationInput {
  coldVolumeMl: number;
  hotVolumeMl: number;
  coldInitialC: number;
  hotInitialC: number;
  mixtureC: number;
  densityGPerMl?: number;
  specificHeatJPerGC?: number;
}

export interface CalorimeterCalibrationResult {
  qColdJ: number;
  qHotJ: number;
  qCalJ: number;
  deltaTCalC: number;
  calorimeterConstantJPerC: number;
}

const requireFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
};

export const calculateCalorimeterCalibration = (
  input: CalorimeterCalibrationInput,
): CalorimeterCalibrationResult => {
  const density = input.densityGPerMl ?? WATER_DENSITY_G_PER_ML;
  const specificHeat = input.specificHeatJPerGC ?? WATER_SPECIFIC_HEAT_J_PER_G_C;
  Object.entries(input).forEach(([label, value]) => requireFinite(value, label));
  if (input.coldVolumeMl <= 0 || input.hotVolumeMl <= 0) {
    throw new Error("Calibration water volumes must be greater than zero.");
  }
  if (density <= 0 || specificHeat <= 0) {
    throw new Error("Density and specific heat must be greater than zero.");
  }
  if (!(input.mixtureC > input.coldInitialC && input.mixtureC < input.hotInitialC)) {
    throw new Error("Mixture temperature must lie between the two initial water temperatures.");
  }
  const qColdJ =
    input.coldVolumeMl * density * specificHeat * (input.mixtureC - input.coldInitialC);
  const qHotJ =
    input.hotVolumeMl * density * specificHeat * (input.mixtureC - input.hotInitialC);
  const qCalJ = -qHotJ - qColdJ;
  const deltaTCalC = input.mixtureC - input.coldInitialC;
  const calorimeterConstantJPerC = qCalJ / deltaTCalC;
  if (calorimeterConstantJPerC <= 0) {
    throw new Error("Calibration data produce a non-positive calorimeter constant.");
  }
  return { qColdJ, qHotJ, qCalJ, deltaTCalC, calorimeterConstantJPerC };
};

export const aggregateCalorimeterConstants = (
  values: number[],
  method: "mean" | "median" = "mean",
): number => {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Calibration constants must be a non-empty list of positive finite values.");
  }
  if (method === "mean") return values.reduce((sum, value) => sum + value, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

export interface DissolutionEnergyInput {
  waterVolumeMl: number;
  soluteMassG: number;
  molarMassGPerMol: number;
  initialC: number;
  endingC: number;
  calorimeterConstantJPerC: number;
  densityGPerMl?: number;
  specificHeatJPerGC?: number;
  massConvention?: "waterOnly" | "solution";
}

export interface DissolutionEnergyResult {
  deltaTC: number;
  solutionMassG: number;
  qThermalJ: number;
  qCalJ: number;
  qDissolutionJ: number;
  molesSolute: number;
  deltaHSolutionKJPerMol: number;
}

export const calculateDissolutionEnergy = (
  input: DissolutionEnergyInput,
): DissolutionEnergyResult => {
  Object.entries(input).forEach(([, value]) => {
    if (typeof value === "number") requireFinite(value, "Dissolution input");
  });
  if (input.waterVolumeMl <= 0 || input.soluteMassG <= 0 || input.molarMassGPerMol <= 0) {
    throw new Error("Water volume, solute mass, and molar mass must be greater than zero.");
  }
  if (input.calorimeterConstantJPerC < 0) {
    throw new Error("Calorimeter constant must be non-negative.");
  }
  const density = input.densityGPerMl ?? WATER_DENSITY_G_PER_ML;
  const specificHeat = input.specificHeatJPerGC ?? WATER_SPECIFIC_HEAT_J_PER_G_C;
  if (!Number.isFinite(density) || !Number.isFinite(specificHeat) || density <= 0 || specificHeat <= 0) {
    throw new Error("Density and specific heat must be positive finite values.");
  }
  const waterMassG = input.waterVolumeMl * density;
  const solutionMassG =
    (input.massConvention ?? "solution") === "solution"
      ? waterMassG + input.soluteMassG
      : waterMassG;
  const deltaTC = input.endingC - input.initialC;
  const qThermalJ = solutionMassG * specificHeat * deltaTC;
  const qCalJ = input.calorimeterConstantJPerC * deltaTC;
  const qDissolutionJ = -(qThermalJ + qCalJ);
  const molesSolute = input.soluteMassG / input.molarMassGPerMol;
  return {
    deltaTC,
    solutionMassG,
    qThermalJ,
    qCalJ,
    qDissolutionJ,
    molesSolute,
    deltaHSolutionKJPerMol: qDissolutionJ / molesSolute / 1000,
  };
};

export const calculateHandWarmerMassG = (
  releasedEnergyJPerG: number,
  waterVolumeMl = 50,
  targetRiseC = 20,
  calorimeterConstantJPerC = 0,
): number => {
  if (
    !Number.isFinite(releasedEnergyJPerG) ||
    !Number.isFinite(waterVolumeMl) ||
    !Number.isFinite(targetRiseC) ||
    !Number.isFinite(calorimeterConstantJPerC) ||
    releasedEnergyJPerG <= 0 ||
    waterVolumeMl <= 0 ||
    targetRiseC <= 0 ||
    calorimeterConstantJPerC < 0
  ) {
    throw new Error("Hand-warmer design inputs must be positive finite values.");
  }
  const requiredEnergyJ =
    (waterVolumeMl * WATER_DENSITY_G_PER_ML * WATER_SPECIFIC_HEAT_J_PER_G_C +
      calorimeterConstantJPerC) *
    targetRiseC;
  return requiredEnergyJ / releasedEnergyJPerG;
};

export const seededVariation = (seed: number, amplitude: number): number => {
  if (!Number.isInteger(seed) || !Number.isFinite(amplitude) || amplitude < 0) {
    throw new Error("Seed must be an integer and amplitude must be non-negative.");
  }
  let value = seed | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  const unit = (value >>> 0) / 0xffffffff;
  return (unit * 2 - 1) * amplitude;
};

export const generateTemperatureResponse = (
  initialC: number,
  idealPeakC: number,
  seed: number,
  options: {
    durationS?: number;
    sampleEveryS?: number;
    lagSeconds?: number;
    peakTimeS?: number;
    coolingTimeConstantS?: number;
    ambientC?: number;
    noiseAmplitudeC?: number;
    precisionC?: number;
  } = {},
): DataSeriesPoint[] => {
  const durationS = options.durationS ?? 120;
  const sampleEveryS = options.sampleEveryS ?? 1;
  const lagSeconds = options.lagSeconds ?? 8;
  const peakTimeS = options.peakTimeS ?? Math.min(30, durationS / 3);
  const coolingTimeConstantS = options.coolingTimeConstantS ?? 100;
  const ambientC = options.ambientC ?? initialC;
  const noiseAmplitudeC = options.noiseAmplitudeC ?? 0.08;
  const precisionC = options.precisionC ?? 0.1;
  if (
    ![initialC, idealPeakC, durationS, sampleEveryS, lagSeconds, peakTimeS, coolingTimeConstantS, ambientC, noiseAmplitudeC, precisionC]
      .every(Number.isFinite)
  ) {
    throw new Error("Temperature response values must be finite.");
  }
  if (
    durationS <= 0 ||
    sampleEveryS <= 0 ||
    lagSeconds <= 0 ||
    peakTimeS <= 0 ||
    peakTimeS >= durationS ||
    coolingTimeConstantS <= 0 ||
    noiseAmplitudeC < 0 ||
    precisionC <= 0
  ) {
    throw new Error("Temperature response timing and precision values are outside their valid ranges.");
  }
  const points: DataSeriesPoint[] = [];
  const riseDenominator = 1 - Math.exp(-peakTimeS / lagSeconds);
  for (let timeS = 0; timeS <= durationS; timeS += sampleEveryS) {
    const modeledTemperatureC =
      timeS <= peakTimeS
        ? initialC +
          (idealPeakC - initialC) *
            ((1 - Math.exp(-timeS / lagSeconds)) / riseDenominator)
        : ambientC +
          (idealPeakC - ambientC) *
            Math.exp(-(timeS - peakTimeS) / coolingTimeConstantS);
    const noise = seededVariation(seed + timeS * 104729, noiseAmplitudeC);
    points.push({
      x: timeS,
      y: Number(
        (Math.round((modeledTemperatureC + noise) / precisionC) * precisionC).toFixed(6),
      ),
    });
  }
  return points;
};
