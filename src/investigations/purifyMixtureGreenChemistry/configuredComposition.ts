import { loadBundledLab } from "../../data/loadBundledLabs";
import {
  GREEN_CHEMISTRY_LAB_ID,
  type GreenChemistryApprovedConfiguration,
} from "../../data/greenChemistrySetup";
import type { LabDefinition } from "../../domain/types";

export {
  GREEN_CHEMISTRY_INSTANCE_ID,
  GREEN_CHEMISTRY_LAB_ID,
  GREEN_CHEMISTRY_TARE_CONVENTIONS,
  GREEN_CHEMISTRY_TECHNIQUE_ID,
  GREEN_CHEMISTRY_TECHNIQUE_VERSION,
  UNCONFIGURED_TEXT,
  assertConfigured,
  canonicalizeGreenChemistrySetup,
  parseGreenChemistryConfiguration,
  parseGreenChemistrySetup,
  type GreenChemistryApprovedConfiguration,
  type GreenChemistrySetup,
  type GreenChemistryTareConvention,
} from "../../data/greenChemistrySetup";

/** Compatibility entry point retained for the custom route; the shared loader owns compilation. */
export const compileConfiguredGreenChemistry = async (
  configuration: GreenChemistryApprovedConfiguration,
): Promise<LabDefinition> => loadBundledLab(GREEN_CHEMISTRY_LAB_ID, configuration);
