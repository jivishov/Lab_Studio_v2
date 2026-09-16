import type { LiquidRenderState, LiquidShapeKind, LiquidVisualProfile } from "./types";
import { clamp01, widthInsetsAtHeight } from "./calibration";

const formatPathNumber = (value: number): string => {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? "0" : `${rounded}`;
};

const roundedRectPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 0,
): string => {
  if (width <= 0 || height <= 0) return "";
  const r = Math.min(radius, width / 2, height / 2);
  if (r <= 0) return `M${x} ${y}H${x + width}V${y + height}H${x}Z`;
  return [
    `M${formatPathNumber(x + r)} ${formatPathNumber(y)}`,
    `H${formatPathNumber(x + width - r)}`,
    `Q${formatPathNumber(x + width)} ${formatPathNumber(y)} ${formatPathNumber(x + width)} ${formatPathNumber(y + r)}`,
    `V${formatPathNumber(y + height - r)}`,
    `Q${formatPathNumber(x + width)} ${formatPathNumber(y + height)} ${formatPathNumber(x + width - r)} ${formatPathNumber(y + height)}`,
    `H${formatPathNumber(x + r)}`,
    `Q${formatPathNumber(x)} ${formatPathNumber(y + height)} ${formatPathNumber(x)} ${formatPathNumber(y + height - r)}`,
    `V${formatPathNumber(y + r)}`,
    `Q${formatPathNumber(x)} ${formatPathNumber(y)} ${formatPathNumber(x + r)} ${formatPathNumber(y)}`,
    "Z",
  ].join("");
};

const pointAtHeightFraction = (
  profile: LiquidVisualProfile,
  heightFraction: number,
  side: "left" | "right",
): { x: number; y: number } => {
  const { region } = profile;
  const clampedHeight = clamp01(heightFraction);
  const insets = widthInsetsAtHeight(profile.widthStops, clampedHeight);
  return {
    x:
      side === "left"
        ? region.x + region.width * insets.left
        : region.x + region.width * (1 - insets.right),
    y: region.y + region.height * (1 - clampedHeight),
  };
};

const uniqueHeights = (values: number[]): number[] => {
  const seen = new Set<string>();
  const result: number[] = [];
  for (const value of values) {
    const clamped = clamp01(value);
    const key = clamped.toFixed(6);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clamped);
  }
  return result;
};

const pathForHeightRange = (
  profile: LiquidVisualProfile,
  lowerHeightFraction: number,
  upperHeightFraction: number,
): string => {
  if (upperHeightFraction <= lowerHeightFraction) return "";
  const lower = clamp01(lowerHeightFraction);
  const upper = clamp01(upperHeightFraction);
  const internalStops =
    profile.widthStops
      ?.map((stop) => stop.heightFraction)
      .filter((heightFraction) => heightFraction > lower && heightFraction < upper) ?? [];
  const heights = uniqueHeights([upper, ...internalStops.sort((a, b) => b - a), lower]);
  const leftPoints = heights.map((heightFraction) =>
    pointAtHeightFraction(profile, heightFraction, "left"),
  );
  const rightPoints = heights.map((heightFraction) =>
    pointAtHeightFraction(profile, heightFraction, "right"),
  );
  const commands = [
    `M${formatPathNumber(leftPoints[0].x)} ${formatPathNumber(leftPoints[0].y)}`,
    ...rightPoints.map((point) => `L${formatPathNumber(point.x)} ${formatPathNumber(point.y)}`),
    ...leftPoints
      .slice()
      .reverse()
      .map((point) => `L${formatPathNumber(point.x)} ${formatPathNumber(point.y)}`),
    "Z",
  ];
  return commands.join("");
};

export type ShapeRenderOutput = {
  bodyPath: string;
  clipPath: string;
  highlightPath: string;
};

export const clipPathForProfile = (profile: LiquidVisualProfile): string =>
  profile.silhouettePath ??
  (profile.widthStops
    ? pathForHeightRange(profile, 0, 1)
    : roundedRectPath(
        profile.region.x,
        profile.region.y,
        profile.region.width,
        profile.region.height,
        profile.shape === "thin-tube" ? 2 : 4,
      ));

export type ShapeRenderer = (
  profile: LiquidVisualProfile,
  state: Pick<LiquidRenderState, "heightFraction" | "surfaceY" | "bottomY" | "region">,
) => ShapeRenderOutput;

const fillHeightRange = (
  profile: LiquidVisualProfile,
  heightFraction: number,
): { lower: number; upper: number } =>
  profile.fillDirection === "bottom-up"
    ? { lower: 0, upper: clamp01(heightFraction) }
    : { lower: clamp01(1 - heightFraction), upper: 1 };

const renderRectangularLiquid: ShapeRenderer = (profile, state) => {
  const { region } = profile;
  const height = Math.max(0, state.bottomY - state.surfaceY);
  const range = fillHeightRange(profile, state.heightFraction);
  const bodyPath = profile.widthStops
    ? pathForHeightRange(profile, range.lower, range.upper)
    : roundedRectPath(region.x, state.surfaceY, region.width, height, 2);
  const highlightInsets = widthInsetsAtHeight(profile.widthStops, clamp01(state.heightFraction * 0.7));
  const highlightX = region.x + region.width * (highlightInsets.left + 0.18);
  const highlightPath = roundedRectPath(highlightX, state.surfaceY + 2, Math.max(1, region.width * 0.14), height - 4, 2);
  return { bodyPath, clipPath: clipPathForProfile(profile), highlightPath };
};

const renderShapedLiquid: ShapeRenderer = (profile, state) => {
  const range = fillHeightRange(profile, state.heightFraction);
  const bodyPath = profile.widthStops
    ? pathForHeightRange(profile, range.lower, range.upper)
    : roundedRectPath(
        profile.region.x,
        state.surfaceY,
        profile.region.width,
        Math.max(0, state.bottomY - state.surfaceY),
        2,
      );
  const highlightInsets = widthInsetsAtHeight(profile.widthStops, clamp01(state.heightFraction * 0.7));
  const highlightX = profile.region.x + profile.region.width * (highlightInsets.left + 0.18);
  const highlightWidth = Math.max(1, profile.region.width * 0.1);
  const highlightPath = roundedRectPath(
    highlightX,
    state.surfaceY + 3,
    highlightWidth,
    Math.max(0, state.bottomY - state.surfaceY - 8),
    3,
  );
  return { bodyPath, clipPath: clipPathForProfile(profile), highlightPath };
};

const explicitRectPath = (x: number, y: number, width: number, height: number): string => {
  if (width <= 0 || height <= 0) return "";
  return [
    `M${formatPathNumber(x)} ${formatPathNumber(y)}`,
    `L${formatPathNumber(x + width)} ${formatPathNumber(y)}`,
    `L${formatPathNumber(x + width)} ${formatPathNumber(y + height)}`,
    `L${formatPathNumber(x)} ${formatPathNumber(y + height)}`,
    "Z",
  ].join("");
};

const renderVolumetricFlaskLiquid: ShapeRenderer = (profile, state) => {
  const height = Math.max(0, state.bottomY - state.surfaceY);
  const bodyPath = explicitRectPath(profile.region.x, state.surfaceY, profile.region.width, height);
  const highlightPath = roundedRectPath(
    profile.region.x + profile.region.width * 0.28,
    state.surfaceY + 4,
    Math.max(1, profile.region.width * 0.13),
    Math.max(0, height - 14),
    5,
  );
  return { bodyPath, clipPath: clipPathForProfile(profile), highlightPath };
};

export const shapeRenderers: Record<LiquidShapeKind, ShapeRenderer> = {
  rectangular: renderRectangularLiquid,
  cylindrical: renderRectangularLiquid,
  "thin-tube": renderRectangularLiquid,
  "erlenmeyer-body": renderShapedLiquid,
  "volumetric-flask-bulb-neck": renderVolumetricFlaskLiquid,
  "bottle-shoulder": renderShapedLiquid,
  "funnel-cone": renderShapedLiquid,
  "dropper-bottle": renderShapedLiquid,
  "wash-bottle": renderShapedLiquid,
};
