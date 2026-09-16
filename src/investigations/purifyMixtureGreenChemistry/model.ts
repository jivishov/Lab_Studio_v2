export {
  GREEN_CHEMISTRY_LAB_ID as PURIFY_MIXTURE_GREEN_CHEMISTRY_ID,
} from "../../data/greenChemistrySetup";

export const SODIUM_BICARBONATE_MOLAR_MASS_G_MOL = 84.0066;
export const SODIUM_CARBONATE_MOLAR_MASS_G_MOL = 105.9888;
export const CARBON_DIOXIDE_MOLAR_MASS_G_MOL = 44.0095;
export const WATER_MOLAR_MASS_G_MOL = 18.0153;

export interface MixtureComposition {
  initialSampleMassG: number;
  finalResidueMassG: number;
  massLossG: number;
  sodiumBicarbonateMassG: number;
  sodiumCarbonateMassG: number;
  sodiumBicarbonatePercent: number;
  sodiumCarbonatePercent: number;
}

const round = (value: number, digits: number): number =>
  Number(value.toFixed(digits));

const requirePositiveFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
};

const requireNonnegativeFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative finite number.`);
  }
};

/**
 * Derives composition only from learner-recorded mass evidence and the balanced selective
 * decomposition:
 * 2 NaHCO3(s) -> Na2CO3(s) + CO2(g) + H2O(g)
 *
 * This module deliberately has no inverse expected-mixture generator. The custom route must never
 * insert a missing balance reading or an expected composition result.
 */
export const compositionFromMassLoss = (
  sampleMassG: number,
  massLossG: number,
): MixtureComposition => {
  requirePositiveFinite(sampleMassG, "Sample mass");
  requireNonnegativeFinite(massLossG, "Mass loss");

  const sodiumBicarbonateMassG =
    massLossG *
    ((2 * SODIUM_BICARBONATE_MOLAR_MASS_G_MOL) /
      (CARBON_DIOXIDE_MOLAR_MASS_G_MOL + WATER_MOLAR_MASS_G_MOL));
  const sodiumCarbonateMassG = sampleMassG - sodiumBicarbonateMassG;
  if (sodiumCarbonateMassG < 0) {
    throw new Error(
      "Mass loss exceeds the maximum possible loss for the sample.",
    );
  }

  return {
    initialSampleMassG: round(sampleMassG, 4),
    finalResidueMassG: round(sampleMassG - massLossG, 4),
    massLossG: round(massLossG, 4),
    sodiumBicarbonateMassG: round(sodiumBicarbonateMassG, 4),
    sodiumCarbonateMassG: round(sodiumCarbonateMassG, 4),
    sodiumBicarbonatePercent: round(
      (sodiumBicarbonateMassG / sampleMassG) * 100,
      2,
    ),
    sodiumCarbonatePercent: round(
      (sodiumCarbonateMassG / sampleMassG) * 100,
      2,
    ),
  };
};

export const isConstantMass = (
  previousMassG: number,
  currentMassG: number,
  toleranceG: number,
): boolean => {
  requirePositiveFinite(previousMassG, "Previous mass");
  requirePositiveFinite(currentMassG, "Current mass");
  requirePositiveFinite(toleranceG, "Constant-mass tolerance");
  return Math.abs(previousMassG - currentMassG) <= toleranceG;
};

export const calculateAtomEconomyPercent = (
  desiredProductStoichiometricMassG: number,
  totalReactantStoichiometricMassG: number,
): number => {
  requirePositiveFinite(
    desiredProductStoichiometricMassG,
    "Desired-product stoichiometric mass contribution",
  );
  requirePositiveFinite(
    totalReactantStoichiometricMassG,
    "Total-reactant stoichiometric mass contribution",
  );
  if (desiredProductStoichiometricMassG > totalReactantStoichiometricMassG) {
    throw new Error(
      "Desired-product contribution cannot exceed the total reactant contribution.",
    );
  }
  return round(
    (desiredProductStoichiometricMassG / totalReactantStoichiometricMassG) *
      100,
    2,
  );
};

export const within = (
  submitted: number,
  expected: number,
  tolerance: number,
): boolean =>
  Number.isFinite(submitted) &&
  Number.isFinite(expected) &&
  Number.isFinite(tolerance) &&
  Math.abs(submitted - expected) <= tolerance;
