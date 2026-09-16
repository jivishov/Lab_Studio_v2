import type { ContentState, EquipmentDefinition } from "../../domain/types";
import type { Rect } from "../visualCatalog";

export type FillDirection = "bottom-up" | "top-down";

export type LiquidLayerMode = "over-asset" | "under-asset" | "within-svg-mask";

export type LiquidShapeKind =
  | "rectangular"
  | "cylindrical"
  | "thin-tube"
  | "erlenmeyer-body"
  | "volumetric-flask-bulb-neck"
  | "bottle-shoulder"
  | "funnel-cone"
  | "dropper-bottle"
  | "wash-bottle";

export interface CalibrationStop {
  volumeFraction: number;
  heightFraction: number;
}

export interface WidthStop {
  heightFraction: number;
  leftInsetFraction: number;
  rightInsetFraction: number;
}

export interface MeniscusProfile {
  type: "flat" | "concave" | "convex";
  ellipseRxFraction: number;
  ellipseRyPx: number;
  verticalOffsetPx?: number;
  opacity?: number;
}

export interface OverlayViability {
  checked: true;
  interior: "transparent" | "semi-transparent" | "opaque";
  strategy: LiquidLayerMode;
}

export interface LiquidVisualProfile {
  profileId: string;
  profileVersion: number;
  assetViewBox: Rect;
  region: Rect;
  shape: LiquidShapeKind;
  fillDirection: FillDirection;
  liquidLayerMode: LiquidLayerMode;
  calibrationStops: CalibrationStop[];
  meniscus: MeniscusProfile;
  overlayViability: OverlayViability;
  visualCapacityOverrideMl?: number;
  useFinalVolumeMlAsCapacity?: boolean;
  deadVolumeMl?: number;
  readableTubeRegion?: Rect;
  calibrationMarkY?: number;
  silhouettePath?: string;
  widthStops?: WidthStop[];
  safeInsetPx?: Partial<Record<"top" | "right" | "bottom" | "left", number>>;
  minRenderableHeightPx?: number;
  minMeniscusHeightPx?: number;
  hideMeniscusBelowPx?: number;
  hideParticlesBelowPx?: number;
}

export interface RenderableLiquid {
  volumeMl: number | undefined;
  visualState: string;
  reagentKey?: string;
  hasPrecipitate: boolean;
  hasPowder: boolean;
  isWetOnly: boolean;
  isVisibleLiquid: boolean;
}

export interface LiquidRenderStyle {
  fill: string;
  stroke: string;
  highlight: string;
  meniscus: string;
  opacity: number;
  particles?: boolean;
}

export interface MeniscusRenderState {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  curvature: MeniscusProfile["type"];
  opacity: number;
}

export interface LiquidHorizontalSpan {
  heightFraction: number;
  y: number;
  leftX: number;
  rightX: number;
  centerX: number;
  width: number;
}

export interface OverflowWarning {
  show: boolean;
  amountMl: number;
  severity: "minor" | "major";
}

export interface LiquidRenderState {
  isRenderable: boolean;
  reason?: string;
  volumeMl: number;
  capacityMl: number | null;
  volumeFraction: number | null;
  heightFraction: number;
  surfaceY: number;
  bottomY: number;
  surface: LiquidHorizontalSpan;
  region: Rect;
  bodyPath: string;
  clipPath: string;
  highlightPath: string;
  meniscus?: MeniscusRenderState;
  style: LiquidRenderStyle;
  overCapacity: OverflowWarning;
  profile: LiquidVisualProfile;
  derived: RenderableLiquid;
}

export type LiquidRenderInput = {
  contents: ContentState;
  definition: EquipmentDefinition;
  profile?: LiquidVisualProfile;
};
