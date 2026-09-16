import { interactionOperationTypes } from "../../domain/interactions";
import { actionVerbs } from "../../domain/validation";
import { v1EquipmentCatalog } from "../../equipment/catalog";
import { v1VisualCatalog } from "../../equipment/visualCatalog";
import type { CapabilityClaim } from "../../platform/capabilities/types";

export interface ChemistryModelCapabilitySource {
  id: string;
  title: string;
  summary: string;
  exportName: string;
  runtimeTemplate?: string;
  formula: string;
  validityRange: NonNullable<CapabilityClaim["validityRange"]>;
  validityLimits: string[];
  limitations: string[];
  regressionSource: string;
}

export const chemistryActionCapabilitySources = actionVerbs;
export const chemistryInteractionCapabilitySources = interactionOperationTypes;
export const chemistryEquipmentCapabilitySources = v1EquipmentCatalog.filter(
  (definition) => Boolean(v1VisualCatalog[definition.id]),
);

export const chemistryModelCapabilitySources: readonly ChemistryModelCapabilitySource[] = [
  {
    id: "precipitate-mass",
    title: "Precipitate mass difference",
    summary: "Computes dry precipitate mass from final and tare masses.",
    exportName: "calculatePrecipitateMassG",
    formula: "m_precipitate = m_final - m_tare",
    validityRange: { massInputs: "finite grams; final mass must not be less than tare mass" },
    validityLimits: ["Inputs use grams.", "The caller must reject a final mass below tare mass."],
    limitations: ["This arithmetic does not establish precipitate identity or purity."],
    regressionSource: "src/runtime/__tests__/runtime.test.ts",
  },
  {
    id: "hardness-as-caco3",
    title: "Hardness as CaCO3",
    summary: "Computes mg/L hardness as CaCO3 from precipitate mass and sample volume.",
    exportName: "calculateHardnessMgLAsCaCO3",
    runtimeTemplate: "hardnessMgLAsCaCO3",
    formula: "hardness_mg_L = precipitate_mass_g * 1000000 / sample_volume_mL",
    validityRange: { precipitateMass: "finite non-negative grams", sampleVolume: "greater than zero milliliters" },
    validityLimits: ["Sample volume must be greater than zero.", "The educational model assumes the configured precipitate-to-CaCO3 relationship."],
    limitations: ["The result is a configured educational calculation, not a certified water analysis."],
    regressionSource: "src/runtime/__tests__/runtime.test.ts",
  },
  {
    id: "acid-base-molarity",
    title: "Acid-base titration molarity",
    summary: "Computes analyte molarity from delivered titrant, analyte volume, and stoichiometric ratio.",
    exportName: "calculateAcidBaseMolarity",
    runtimeTemplate: "acidBaseMolarity",
    formula: "M_analyte = M_titrant * V_titrant * n_analyte / (V_analyte * n_titrant)",
    validityRange: { volumes: "positive finite milliliters with final burette reading greater than initial", stoichiometry: "positive finite ratio" },
    validityLimits: ["Analyte volume and stoichiometric coefficients must be positive.", "Final burette reading must exceed the initial reading."],
    limitations: ["The calculation assumes the configured reaction stoichiometry and an accepted endpoint."],
    regressionSource: "src/domain/__tests__/titrationModels.test.ts",
  },
  {
    id: "diluted-concentration",
    title: "Diluted concentration",
    summary: "Computes final concentration for one ideal volumetric dilution.",
    exportName: "calculateDilutedConcentration",
    runtimeTemplate: "dilutedConcentration",
    formula: "C_final = C_stock * V_stock / V_final",
    validityRange: { concentration: "finite non-negative", stockVolume: "finite non-negative milliliters", finalVolume: "greater than zero milliliters" },
    validityLimits: ["Final volume must be greater than zero.", "The model assumes ideal mixing and compatible concentration units."],
    limitations: ["Non-ideal volume contraction and uncertainty propagation are not modeled."],
    regressionSource: "src/runtime/__tests__/runtime.test.ts",
  },
  {
    id: "decimal-transmittance",
    title: "Decimal transmittance",
    summary: "Converts percent transmittance to decimal transmittance.",
    exportName: "calculateDecimalTransmittance",
    runtimeTemplate: "decimalTransmittance",
    formula: "T = percent_T / 100",
    validityRange: { percentTransmittance: "greater than zero and at most 100 percent" },
    validityLimits: ["Percent transmittance must be in the interval (0, 100]."],
    limitations: ["This conversion does not validate instrument calibration or sample handling."],
    regressionSource: "src/runtime/__tests__/runtime.test.ts",
  },
  {
    id: "absorbance-from-transmittance",
    title: "Absorbance from percent transmittance",
    summary: "Computes base-10 absorbance from percent transmittance.",
    exportName: "calculateAbsorbanceFromPercentT",
    runtimeTemplate: "absorbanceFromPercentT",
    formula: "A = -log10(percent_T / 100)",
    validityRange: { percentTransmittance: "greater than zero and at most 100 percent" },
    validityLimits: ["Percent transmittance must be in the interval (0, 100].", "No linear Beer-Lambert range is inferred."],
    limitations: ["The calculation is not a calibration claim and does not infer concentration by itself."],
    regressionSource: "src/runtime/__tests__/runtime.test.ts",
  },
  {
    id: "chromatography-rf",
    title: "Chromatography retention factor",
    summary: "Computes Rf from band travel distance and solvent-front distance.",
    exportName: "calculateChromatographyRf",
    runtimeTemplate: "chromatographyRf",
    formula: "Rf = distance_band / distance_solvent_front",
    validityRange: { distances: "finite millimeters with 0 <= band distance <= positive solvent-front distance" },
    validityLimits: ["The solvent front must be positive.", "Band distance cannot exceed solvent-front distance."],
    limitations: ["Rf is condition-dependent and is not an identification proof without references."],
    regressionSource: "src/runtime/__tests__/runtime.test.ts",
  },
  {
    id: "initial-rate",
    title: "Initial gas-volume rate",
    summary: "Computes an initial finite-difference gas-volume rate over a declared interval.",
    exportName: "calculateInitialRateMlPerS",
    runtimeTemplate: "initialRateMlPerS",
    formula: "rate = (V_interval - V_0) / (t_interval - t_0)",
    validityRange: { timeSeries: "contains exact zero and configured interval readings with increasing time" },
    validityLimits: ["The series must contain readings at zero and the configured interval.", "The result is a finite-difference estimate, not an instantaneous derivative."],
    limitations: ["The estimate depends on the selected interval and supplied series quality."],
    regressionSource: "src/runtime/__tests__/kineticsModels.test.ts",
  },
  {
    id: "carbonate-mass-loss-composition",
    title: "Carbonate mass-loss composition",
    summary: "Computes a configured NaHCO3/Na2CO3 composition from thermal mass loss.",
    exportName: "calculateCarbonateMassLossComposition",
    runtimeTemplate: "carbonateMassLossComposition",
    formula: "m_NaHCO3 = mass_loss * (2*M_NaHCO3)/(M_CO2+M_H2O); percent = component_mass/sample_mass*100",
    validityRange: { masses: "finite grams; sample mass positive; initial mass greater than final; physically possible mass loss" },
    validityLimits: ["Sample mass must be positive.", "The configured decomposition reaction and complete loss assumptions must hold."],
    limitations: ["The model does not identify unknown components or certify experimental completeness."],
    regressionSource: "src/runtime/__tests__/runtime.test.ts",
  },
] as const;
