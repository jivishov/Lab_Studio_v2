import type { EquipmentDefinition } from "../../domain/types";
import type { LiquidVisualProfile, LiquidShapeKind } from "./types";
import { validateCalibrationStops, validateWidthStops } from "./calibration";

export const CORE_LIQUID_VISUAL_EQUIPMENT = [
  "beaker-250ml",
  "waste-beaker",
  "graduated-cylinder",
  "volumetric-flask",
  "erlenmeyer-flask-250ml",
  "burette-50ml",
  "reagent-bottle",
  "distilled-water-bottle",
  "propanol-bottle",
  "unknown-acid-bottle",
  "naoh-bottle",
  "sample-bottle",
  "dropper-bottle",
  "phenolphthalein-dropper",
  "wash-bottle",
  "funnel-stand",
] as const;

const KNOWN_SHAPES = new Set<LiquidShapeKind>([
  "rectangular",
  "cylindrical",
  "thin-tube",
  "erlenmeyer-body",
  "volumetric-flask-bulb-neck",
  "bottle-shoulder",
  "funnel-cone",
  "dropper-bottle",
  "wash-bottle",
]);

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

export const validateLiquidVisualProfile = (profile: LiquidVisualProfile): string[] => {
  const errors: string[] = [];
  if (!profile.profileId) errors.push("Liquid profile must declare a profileId.");
  if (!Number.isInteger(profile.profileVersion) || profile.profileVersion <= 0) {
    errors.push(`Liquid profile ${profile.profileId} must declare a positive profileVersion.`);
  }
  if (!KNOWN_SHAPES.has(profile.shape)) {
    errors.push(`Liquid profile ${profile.profileId} uses unknown shape ${profile.shape}.`);
  }
  if (!finitePositive(profile.assetViewBox.width) || !finitePositive(profile.assetViewBox.height)) {
    errors.push(`Liquid profile ${profile.profileId} assetViewBox must have positive size.`);
  }
  if (!finitePositive(profile.region.width) || !finitePositive(profile.region.height)) {
    errors.push(`Liquid profile ${profile.profileId} region must have positive size.`);
  }
  if (
    profile.region.x < 0 ||
    profile.region.y < 0 ||
    profile.region.x + profile.region.width > profile.assetViewBox.width ||
    profile.region.y + profile.region.height > profile.assetViewBox.height
  ) {
    errors.push(`Liquid profile ${profile.profileId} region must stay inside assetViewBox.`);
  }
  if (
    ["erlenmeyer-body", "volumetric-flask-bulb-neck", "bottle-shoulder", "funnel-cone", "dropper-bottle", "wash-bottle"].includes(
      profile.shape,
    ) &&
    !profile.silhouettePath &&
    !profile.widthStops
  ) {
    errors.push(`Liquid profile ${profile.profileId} tapered shapes need silhouettePath or widthStops.`);
  }
  if (!profile.overlayViability?.checked) {
    errors.push(`Liquid profile ${profile.profileId} must declare checked overlay viability.`);
  }
  if (profile.visualCapacityOverrideMl !== undefined && !finitePositive(profile.visualCapacityOverrideMl)) {
    errors.push(`Liquid profile ${profile.profileId} visualCapacityOverrideMl must be positive.`);
  }
  errors.push(...validateCalibrationStops(profile));
  errors.push(...validateWidthStops(profile));
  return errors;
};

export const isCoreLiquidVisualEquipment = (definitionId: string): boolean =>
  (CORE_LIQUID_VISUAL_EQUIPMENT as readonly string[]).includes(definitionId);

export const liquidCapableDefinitions = (definitions: EquipmentDefinition[]): EquipmentDefinition[] =>
  definitions.filter((definition) => isCoreLiquidVisualEquipment(definition.id));
