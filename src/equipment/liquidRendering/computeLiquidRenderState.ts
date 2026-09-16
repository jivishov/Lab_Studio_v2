import type { ContentState, EquipmentDefinition } from "../../domain/types";
import { clamp01, heightFractionForVolume, horizontalSpanAtHeight } from "./calibration";
import { deriveRenderableLiquid, resolveLiquidStyle } from "./styles";
import { clipPathForProfile, shapeRenderers } from "./shapeRenderers";
import type { LiquidRenderInput, LiquidRenderState, LiquidVisualProfile } from "./types";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const emptyState = (
  input: LiquidRenderInput,
  reason: string,
  profile: LiquidVisualProfile,
): LiquidRenderState => ({
  isRenderable: false,
  reason,
  volumeMl: 0,
  capacityMl: null,
  volumeFraction: null,
  heightFraction: 0,
  surfaceY: profile.region.y + profile.region.height,
  bottomY: profile.region.y + profile.region.height,
  surface: {
    heightFraction: 0,
    y: profile.region.y + profile.region.height,
    ...horizontalSpanAtHeight(profile, 0),
  },
  region: profile.region,
  bodyPath: "",
  clipPath: clipPathForProfile(profile),
  highlightPath: "",
  style: resolveLiquidStyle(input.contents, input.definition),
  overCapacity: { show: false, amountMl: 0, severity: "minor" },
  profile,
  derived: deriveRenderableLiquid(input.contents),
});

const capacityFor = (
  contents: ContentState,
  definition: EquipmentDefinition,
  profile: LiquidVisualProfile,
): number | null => {
  const finalVolumeCapacity =
    profile.useFinalVolumeMlAsCapacity &&
    isFiniteNumber(contents.finalVolumeMl) &&
    contents.finalVolumeMl > 0
      ? contents.finalVolumeMl
      : undefined;
  const capacity =
    profile.visualCapacityOverrideMl ??
    finalVolumeCapacity ??
    (definition.capacity.unit === "mL" ? definition.capacity.amount : undefined);
  return isFiniteNumber(capacity) && capacity > 0 ? capacity : null;
};

export const computeLiquidRenderState = (
  input: LiquidRenderInput,
): LiquidRenderState | undefined => {
  const { contents, definition, profile } = input;
  if (!profile) return undefined;
  const derived = deriveRenderableLiquid(contents);
  const style = resolveLiquidStyle(contents, definition);
  if (!derived.isVisibleLiquid) return emptyState(input, "not-visible-liquid", profile);
  if (!isFiniteNumber(derived.volumeMl)) return emptyState(input, "missing-volume", profile);
  if (
    profile.region.width <= 0 ||
    profile.region.height <= 0 ||
    !isFiniteNumber(profile.region.width) ||
    !isFiniteNumber(profile.region.height)
  ) {
    return emptyState(input, "invalid-liquid-region", profile);
  }
  const capacityMl = capacityFor(contents, definition, profile);
  if (capacityMl === null) return emptyState(input, "missing-capacity", profile);

  const rawVolumeMl = Math.max(0, derived.volumeMl);
  const visibleVolumeMl = Math.max(0, rawVolumeMl - (profile.deadVolumeMl ?? 0));
  const volumeFraction = visibleVolumeMl / capacityMl;
  const clampedVolumeFraction = clamp01(volumeFraction);
  let heightFraction = heightFractionForVolume(profile.calibrationStops, clampedVolumeFraction);
  const minimumHeightPx = profile.minRenderableHeightPx ?? 2;
  if (visibleVolumeMl > 0 && heightFraction * profile.region.height < minimumHeightPx) {
    heightFraction = clamp01(minimumHeightPx / profile.region.height);
  }

  const fillHeight = profile.region.height * heightFraction;
  const bottomY =
    profile.fillDirection === "bottom-up"
      ? profile.region.y + profile.region.height
      : profile.region.y + fillHeight;
  const surfaceY =
    profile.fillDirection === "bottom-up"
      ? profile.region.y + profile.region.height - fillHeight
      : profile.region.y;
  const baseState = {
    heightFraction,
    surfaceY,
    bottomY,
    region: profile.region,
  };
  const renderer = shapeRenderers[profile.shape];
  if (!renderer) return emptyState(input, "unsupported-shape", profile);
  const rendered = renderer(profile, baseState);
  const surfaceHeightFraction = profile.fillDirection === "bottom-up" ? heightFraction : 1 - heightFraction;
  const surfacePhysicalY = profile.fillDirection === "bottom-up" ? surfaceY : bottomY;
  const surfaceSpan = horizontalSpanAtHeight(profile, surfaceHeightFraction);
  const meniscusWidth = surfaceSpan.width * profile.meniscus.ellipseRxFraction;
  const meniscusHeight = Math.max(profile.meniscus.ellipseRyPx, profile.minMeniscusHeightPx ?? 1.5);
  const hideMeniscus = fillHeight < (profile.hideMeniscusBelowPx ?? 1.5);
  const overCapacityAmountMl = Math.max(0, rawVolumeMl - capacityMl);

  return {
    isRenderable: visibleVolumeMl > 0 && rendered.bodyPath.length > 0,
    reason: visibleVolumeMl > 0 ? undefined : "empty",
    volumeMl: rawVolumeMl,
    capacityMl,
    volumeFraction,
    heightFraction,
    surfaceY,
    bottomY,
    surface: {
      heightFraction: surfaceHeightFraction,
      y: surfacePhysicalY,
      ...surfaceSpan,
    },
    region: profile.region,
    bodyPath: rendered.bodyPath,
    clipPath: rendered.clipPath,
    highlightPath: rendered.highlightPath,
    meniscus: hideMeniscus
      ? undefined
      : {
          cx: surfaceSpan.centerX,
          cy: surfacePhysicalY + (profile.meniscus.verticalOffsetPx ?? 0),
          rx: Math.max(1, meniscusWidth),
          ry: meniscusHeight,
          curvature: profile.meniscus.type,
          opacity: profile.meniscus.opacity ?? 0.58,
        },
    style,
    overCapacity: {
      show: overCapacityAmountMl > 0,
      amountMl: overCapacityAmountMl,
      severity: rawVolumeMl > capacityMl * 1.05 ? "major" : "minor",
    },
    profile,
    derived,
  };
};
