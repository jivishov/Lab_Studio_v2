import type { CalibrationStop, LiquidVisualProfile, WidthStop } from "./types";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const heightFractionForVolume = (
  stops: CalibrationStop[],
  volumeFraction: number,
): number => {
  if (stops.length === 0 || !isFiniteNumber(volumeFraction)) return 0;
  const x = clamp01(volumeFraction);
  for (let index = 0; index < stops.length - 1; index += 1) {
    const a = stops[index];
    const b = stops[index + 1];
    if (x >= a.volumeFraction && x <= b.volumeFraction) {
      const span = b.volumeFraction - a.volumeFraction;
      const t = span === 0 ? 0 : (x - a.volumeFraction) / span;
      return clamp01(a.heightFraction + t * (b.heightFraction - a.heightFraction));
    }
  }
  if (x <= stops[0].volumeFraction) return clamp01(stops[0].heightFraction);
  return clamp01(stops[stops.length - 1].heightFraction);
};

export const widthInsetsAtHeight = (
  stops: WidthStop[] | undefined,
  heightFraction: number,
): { left: number; right: number } => {
  if (!stops || stops.length === 0 || !isFiniteNumber(heightFraction)) {
    return { left: 0, right: 0 };
  }
  const y = clamp01(heightFraction);
  for (let index = 0; index < stops.length - 1; index += 1) {
    const a = stops[index];
    const b = stops[index + 1];
    if (y >= a.heightFraction && y <= b.heightFraction) {
      const span = b.heightFraction - a.heightFraction;
      const t = span === 0 ? 0 : (y - a.heightFraction) / span;
      return {
        left: a.leftInsetFraction + t * (b.leftInsetFraction - a.leftInsetFraction),
        right: a.rightInsetFraction + t * (b.rightInsetFraction - a.rightInsetFraction),
      };
    }
  }
  const boundary = y <= stops[0].heightFraction ? stops[0] : stops[stops.length - 1];
  return {
    left: boundary.leftInsetFraction,
    right: boundary.rightInsetFraction,
  };
};

export const horizontalSpanAtHeight = (
  profile: Pick<LiquidVisualProfile, "region" | "widthStops">,
  heightFraction: number,
): { leftX: number; rightX: number; centerX: number; width: number } => {
  const insets = widthInsetsAtHeight(profile.widthStops, heightFraction);
  const leftX = profile.region.x + profile.region.width * insets.left;
  const rightX = profile.region.x + profile.region.width * (1 - insets.right);
  const width = Math.max(0, rightX - leftX);
  return {
    leftX,
    rightX,
    centerX: leftX + width / 2,
    width,
  };
};

export const validateCalibrationStops = (
  profile: Pick<LiquidVisualProfile, "profileId" | "calibrationStops">,
): string[] => {
  const errors: string[] = [];
  const stops = profile.calibrationStops;
  if (stops.length < 2) {
    return [`Liquid profile ${profile.profileId} needs at least two calibration stops.`];
  }
  if (stops[0].volumeFraction !== 0 || stops[0].heightFraction !== 0) {
    errors.push(`Liquid profile ${profile.profileId} calibration must start at 0,0.`);
  }
  const last = stops[stops.length - 1];
  if (last.volumeFraction !== 1 || last.heightFraction !== 1) {
    errors.push(`Liquid profile ${profile.profileId} calibration must end at 1,1.`);
  }
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    if (!isFiniteNumber(stop.volumeFraction) || !isFiniteNumber(stop.heightFraction)) {
      errors.push(`Liquid profile ${profile.profileId} calibration stop ${index} must be finite.`);
      continue;
    }
    if (
      stop.volumeFraction < 0 ||
      stop.volumeFraction > 1 ||
      stop.heightFraction < 0 ||
      stop.heightFraction > 1
    ) {
      errors.push(`Liquid profile ${profile.profileId} calibration stop ${index} must be in [0, 1].`);
    }
    const previous = stops[index - 1];
    if (previous) {
      if (stop.volumeFraction <= previous.volumeFraction) {
        errors.push(`Liquid profile ${profile.profileId} calibration volume stops must increase.`);
      }
      if (stop.heightFraction < previous.heightFraction) {
        errors.push(`Liquid profile ${profile.profileId} calibration height stops must be monotonic.`);
      }
    }
  }
  return errors;
};

export const validateWidthStops = (
  profile: Pick<LiquidVisualProfile, "profileId" | "widthStops">,
): string[] => {
  const errors: string[] = [];
  const stops = profile.widthStops;
  if (!stops) return errors;
  if (stops.length < 2) {
    errors.push(`Liquid profile ${profile.profileId} widthStops needs at least two stops.`);
    return errors;
  }
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    if (
      !isFiniteNumber(stop.heightFraction) ||
      !isFiniteNumber(stop.leftInsetFraction) ||
      !isFiniteNumber(stop.rightInsetFraction)
    ) {
      errors.push(`Liquid profile ${profile.profileId} width stop ${index} must be finite.`);
      continue;
    }
    if (
      stop.heightFraction < 0 ||
      stop.heightFraction > 1 ||
      stop.leftInsetFraction < 0 ||
      stop.rightInsetFraction < 0 ||
      stop.leftInsetFraction + stop.rightInsetFraction >= 1
    ) {
      errors.push(`Liquid profile ${profile.profileId} width stop ${index} has invalid insets.`);
    }
    const previous = stops[index - 1];
    if (previous && stop.heightFraction <= previous.heightFraction) {
      errors.push(`Liquid profile ${profile.profileId} width stop heights must increase.`);
    }
  }
  return errors;
};
