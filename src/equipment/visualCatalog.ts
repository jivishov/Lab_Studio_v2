import { v1InteractionZones } from "../domain/interactionZones";
import type { EquipmentDefinition } from "../domain/types";
import { equipmentAssetPath, v1EquipmentCatalog } from "./catalog";
import stockBottleVariants from "./stockBottleVariants.json";
import {
  isCoreLiquidVisualEquipment,
  validateLiquidVisualProfile,
  type CalibrationStop,
  type LiquidShapeKind,
  type LiquidVisualProfile,
  type MeniscusProfile,
  type WidthStop,
} from "./liquidRendering";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualZone {
  id: string;
  bounds: Rect;
  anchor: { x: number; y: number };
  /**
   * Optional physical contact point on the accepted child, normalized to that child's rendered art.
   * It lets a snap zone evaluate and place a vessel by its foot instead of its bounding-box center.
   */
  sourceSnapAnchor?: NormalizedInteractionAnchor;
}

export interface LiquidRegion {
  type: "rect" | "path";
  viewBox: [number, number, number, number];
  d?: string;
  bounds: Rect;
  fillDirection: "up" | "down";
  fillCurve: "linear" | "wide-bottom" | "narrow-neck";
}

export interface SolidRegion {
  id: string;
  bounds: Rect;
  shape: "ellipse" | "rect";
}

export interface NormalizedAssetViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedInteractionAnchor {
  x: number;
  y: number;
}

export interface VisualInteractionAnchors {
  dispenseControl?: NormalizedInteractionAnchor;
  dispenseOutlet?: NormalizedInteractionAnchor;
  probeHandle?: NormalizedInteractionAnchor;
  /** Point on the rendered source that must enter and align with a snap target. */
  snapAnchor?: NormalizedInteractionAnchor;
}

/**
 * A detachable, physical accessory that belongs to the primary apparatus rather than a new
 * equipment definition. Every coordinate is normalized to the art it belongs to, keeping the
 * player free of padded-asset offsets or apparatus-specific geometry.
 */
export interface ProbePresentation {
  detachedConsoleAsset: string;
  probeAsset: string;
  probeSize: { width: number; height: number };
  consoleLeadPort: NormalizedInteractionAnchor;
  sourceGripAnchor: NormalizedInteractionAnchor;
  probeLeadPort: NormalizedInteractionAnchor;
  probeTipAnchor: NormalizedInteractionAnchor;
}

export interface VisualProfile {
  equipmentDefinitionId: string;
  assetId: string;
  stateAssets?: Record<string, string>;
  benchSize: Rect;
  shelfSize: Rect;
  footprint: Rect;
  hitBox: Rect;
  visualZones: VisualZone[];
  contentRegions: LiquidRegion[];
  liquidVisualProfile?: LiquidVisualProfile;
  solidRegions: SolidRegion[];
  noLiquidRender?: boolean;
  /** Crop padded source art without changing its canonical PNG/SVG or any generated composites. */
  assetViewport?: NormalizedAssetViewport;
  interactionAnchors?: VisualInteractionAnchors;
  probePresentation?: ProbePresentation;
  /**
   * Suppress the bench content badge for apparatus whose art is too narrow to carry it. A profile
   * flag rather than a definition-id test in `EquipmentView`, so the renderer names no apparatus.
   */
  hideContentBadgeOnBench?: boolean;
}

export type VisualCatalog = Record<string, VisualProfile>;

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

const liquidRect = (
  bounds: Rect,
  fillCurve: LiquidRegion["fillCurve"] = "linear",
  fillDirection: LiquidRegion["fillDirection"] = "up",
): LiquidRegion => ({
  type: "rect",
  viewBox: [0, 0, 120, 120],
  bounds,
  fillDirection,
  fillCurve,
});

const solid = (id: string, bounds: Rect, shape: SolidRegion["shape"] = "ellipse"): SolidRegion => ({
  id,
  bounds,
  shape,
});

const profile = (
  equipmentDefinitionId: string,
  assetId: string,
  benchSize: Rect,
  options: Partial<Omit<VisualProfile, "equipmentDefinitionId" | "assetId" | "benchSize" | "shelfSize">> & {
    shelfSize?: Rect;
  } = {},
): VisualProfile => ({
  equipmentDefinitionId,
  assetId,
  stateAssets: options.stateAssets,
  benchSize,
  shelfSize: options.shelfSize ?? rect(0, 0, 92, 92),
  footprint: options.footprint ?? rect(10, benchSize.height - 32, benchSize.width - 20, 28),
  hitBox: options.hitBox ?? rect(0, 0, Math.max(44, benchSize.width), Math.max(44, benchSize.height)),
  visualZones: options.visualZones ?? [],
  contentRegions: options.contentRegions ?? [],
  liquidVisualProfile: options.liquidVisualProfile,
  solidRegions: options.solidRegions ?? [],
  noLiquidRender: options.noLiquidRender,
  assetViewport: options.assetViewport,
  interactionAnchors: options.interactionAnchors,
  probePresentation: options.probePresentation,
  hideContentBadgeOnBench: options.hideContentBadgeOnBench,
});

const linearStops: CalibrationStop[] = [
  { volumeFraction: 0, heightFraction: 0 },
  { volumeFraction: 0.25, heightFraction: 0.25 },
  { volumeFraction: 0.5, heightFraction: 0.5 },
  { volumeFraction: 0.75, heightFraction: 0.75 },
  { volumeFraction: 1, heightFraction: 1 },
];

const beakerStops: CalibrationStop[] = [
  { volumeFraction: 0, heightFraction: 0 },
  { volumeFraction: 0.1, heightFraction: 0.1 },
  { volumeFraction: 0.25, heightFraction: 0.24 },
  { volumeFraction: 0.5, heightFraction: 0.5 },
  { volumeFraction: 0.75, heightFraction: 0.76 },
  { volumeFraction: 1, heightFraction: 1 },
];

const erlenmeyerStops: CalibrationStop[] = [
  { volumeFraction: 0, heightFraction: 0 },
  { volumeFraction: 0.1, heightFraction: 0.06 },
  { volumeFraction: 0.25, heightFraction: 0.16 },
  { volumeFraction: 0.5, heightFraction: 0.38 },
  { volumeFraction: 0.75, heightFraction: 0.67 },
  { volumeFraction: 1, heightFraction: 1 },
];

const volumetricStops: CalibrationStop[] = [
  { volumeFraction: 0, heightFraction: 0 },
  { volumeFraction: 0.2, heightFraction: 0.16 },
  { volumeFraction: 0.5, heightFraction: 0.32 },
  { volumeFraction: 0.8, heightFraction: 0.59 },
  { volumeFraction: 0.9, heightFraction: 0.8 },
  { volumeFraction: 0.95, heightFraction: 0.9 },
  { volumeFraction: 1, heightFraction: 1 },
];

const bottleStops: CalibrationStop[] = [
  { volumeFraction: 0, heightFraction: 0 },
  { volumeFraction: 0.25, heightFraction: 0.22 },
  { volumeFraction: 0.5, heightFraction: 0.47 },
  { volumeFraction: 0.8, heightFraction: 0.74 },
  { volumeFraction: 1, heightFraction: 1 },
];

const funnelStops: CalibrationStop[] = [
  { volumeFraction: 0, heightFraction: 0 },
  { volumeFraction: 0.1, heightFraction: 0.42 },
  { volumeFraction: 0.25, heightFraction: 0.62 },
  { volumeFraction: 0.5, heightFraction: 0.8 },
  { volumeFraction: 1, heightFraction: 1 },
];

const concave = (ellipseRxFraction: number, ellipseRyPx: number): MeniscusProfile => ({
  type: "concave",
  ellipseRxFraction,
  ellipseRyPx,
  opacity: 0.62,
});

const widthStops = (...stops: WidthStop[]): WidthStop[] => stops;

const underAssetLiquid: Pick<LiquidVisualProfile, "liquidLayerMode" | "overlayViability"> = {
  liquidLayerMode: "under-asset",
  overlayViability: {
    checked: true,
    interior: "semi-transparent",
    strategy: "under-asset",
  },
};

const withinSvgMaskLiquid: Pick<LiquidVisualProfile, "liquidLayerMode" | "overlayViability"> = {
  liquidLayerMode: "within-svg-mask",
  overlayViability: {
    checked: true,
    interior: "opaque",
    strategy: "within-svg-mask",
  },
};

const liquidProfile = (
  profileId: string,
  assetViewBox: Rect,
  region: Rect,
  shape: LiquidShapeKind,
  calibrationStops: CalibrationStop[],
  options: Partial<LiquidVisualProfile> = {},
): LiquidVisualProfile => ({
  profileId,
  profileVersion: 1,
  assetViewBox,
  region,
  shape,
  fillDirection: "bottom-up",
  liquidLayerMode: "over-asset",
  calibrationStops,
  meniscus: concave(shape === "thin-tube" ? 0.46 : 0.42, shape === "thin-tube" ? 2.2 : 3.2),
  overlayViability: {
    checked: true,
    interior: "semi-transparent",
    strategy: "over-asset",
  },
  minRenderableHeightPx: shape === "thin-tube" ? 1.5 : 4,
  minMeniscusHeightPx: 1.4,
  hideMeniscusBelowPx: 1.2,
  ...options,
});

const asset = (definitionId: string): string =>
  v1EquipmentCatalog.find((item) => item.id === definitionId)?.asset ??
  equipmentAssetPath(`assets/equipment/${definitionId}.svg`);

const realisticAsset = (assetId: string): string =>
  equipmentAssetPath(`assets/equipment-realistic/v1/${assetId}.svg`);

export const handWarmerCalorimeterStateAssets = Object.fromEntries(
  Array.from({ length: 13 }, (_, index) => {
    const stateId = `CAL-${String(index).padStart(2, "0")}`;
    return [
      stateId,
      equipmentAssetPath(
        `assets/equipment-realistic/v1/hand-warmer-calorimeter-${stateId.toLowerCase()}.svg`,
      ),
    ];
  }),
) as Record<string, string>;

export const v1VisualCatalog: VisualCatalog = {
  "brass-fume-hood-digestion": profile(
    "brass-fume-hood-digestion",
    equipmentAssetPath("assets/equipment-realistic/v1/brass-fume-hood-digestion.svg"),
    rect(0, 0, 248, 198),
    {
      shelfSize: rect(0, 0, 150, 120),
      footprint: rect(24, 166, 200, 24),
      hitBox: rect(0, 0, 248, 198),
      noLiquidRender: true,
    },
  ),
  "brass-color-depth-comparison": profile(
    "brass-color-depth-comparison",
    equipmentAssetPath("assets/equipment-realistic/v1/brass-color-depth-comparison.svg"),
    rect(0, 0, 238, 190),
    {
      shelfSize: rect(0, 0, 126, 100),
      footprint: rect(30, 166, 178, 18),
      hitBox: rect(0, 0, 238, 190),
      noLiquidRender: true,
    },
  ),
  "analytical-balance": profile("analytical-balance", asset("analytical-balance"), rect(0, 0, 150, 112), {
    footprint: rect(18, 80, 114, 28),
    hitBox: rect(0, 0, 150, 112),
    visualZones: [
      { id: "analytical-balance-pan", bounds: rect(50, 48, 48, 28), anchor: { x: 74, y: 58 } },
    ],
    noLiquidRender: true,
  }),
  "beaker-150ml": profile("beaker-150ml", asset("beaker-150ml"), rect(0, 0, 94, 124), {
    footprint: rect(14, 98, 66, 20),
    hitBox: rect(0, 0, 94, 124),
    contentRegions: [liquidRect(rect(22, 35, 50, 58), "wide-bottom")],
    liquidVisualProfile: liquidProfile(
      "beaker-150ml-v1",
      rect(0, 0, 94, 124),
      rect(22, 35, 50, 58),
      "cylindrical",
      beakerStops,
      {
        profileVersion: 1,
        visualCapacityOverrideMl: 150,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.13, rightInsetFraction: 0.13 },
          { heightFraction: 0.2, leftInsetFraction: 0.08, rightInsetFraction: 0.08 },
          { heightFraction: 0.76, leftInsetFraction: 0.04, rightInsetFraction: 0.04 },
          { heightFraction: 1, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
        ),
        meniscus: concave(0.5, 3.2),
        minRenderableHeightPx: 6,
        hideMeniscusBelowPx: 3,
      },
    ),
    solidRegions: [solid("beaker-150ml-bottom", rect(31, 89, 32, 4))],
  }),
  "beaker-250ml": profile("beaker-250ml", asset("beaker-250ml"), rect(0, 0, 102, 132), {
    footprint: rect(15, 105, 72, 22),
    hitBox: rect(0, 0, 102, 132),
    contentRegions: [liquidRect(rect(24, 38, 54, 60), "wide-bottom")],
    liquidVisualProfile: liquidProfile(
      "beaker-250ml-v1",
      rect(0, 0, 102, 132),
      rect(24, 38, 54, 60),
      "cylindrical",
      beakerStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.13, rightInsetFraction: 0.13 },
          { heightFraction: 0.16, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
          { heightFraction: 0.72, leftInsetFraction: 0.045, rightInsetFraction: 0.045 },
          { heightFraction: 1, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
        ),
        meniscus: concave(0.5, 3.4),
        minRenderableHeightPx: 7,
        hideMeniscusBelowPx: 3,
      },
    ),
    solidRegions: [solid("beaker-bottom", rect(34, 94.2, 34, 3.8))],
  }),
  "burette-50ml": profile("burette-50ml", asset("burette-50ml"), rect(0, 0, 96, 360), {
    shelfSize: rect(0, 0, 54, 128),
    footprint: rect(35, 316, 26, 24),
    hitBox: rect(0, 0, 96, 360),
    interactionAnchors: {
      dispenseControl: { x: 0.64, y: 0.82 },
      dispenseOutlet: { x: 0.5, y: 0.97 },
    },
    visualZones: [
      {
        id: "burette-funnel-seat",
        bounds: rect(4.5, -40.3, 88.5, 126.7),
        anchor: { x: 48.75, y: 23 },
      },
    ],
    contentRegions: [liquidRect(rect(42, 40, 13, 256), "linear", "down")],
    liquidVisualProfile: liquidProfile(
      "burette-50ml-v1",
      rect(0, 0, 96, 360),
      rect(42, 40, 13, 256),
      "thin-tube",
      linearStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        readableTubeRegion: rect(42, 40, 13, 256),
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.12, rightInsetFraction: 0.12 },
          { heightFraction: 0.08, leftInsetFraction: 0.06, rightInsetFraction: 0.06 },
          { heightFraction: 0.95, leftInsetFraction: 0.03, rightInsetFraction: 0.03 },
          { heightFraction: 1, leftInsetFraction: 0.03, rightInsetFraction: 0.03 },
        ),
        meniscus: concave(0.48, 1.8),
        minRenderableHeightPx: 1,
        hideMeniscusBelowPx: 2,
      },
    ),
    solidRegions: [],
  }),
  "crucible-tongs": profile("crucible-tongs", asset("crucible-tongs"), rect(0, 0, 124, 74), {
    footprint: rect(11, 38, 102, 20),
    hitBox: rect(0, 0, 124, 74),
    noLiquidRender: true,
  }),
  "crucible-with-lid": profile("crucible-with-lid", asset("crucible-with-lid"), rect(0, 0, 118, 102), {
    footprint: rect(16, 76, 86, 18),
    hitBox: rect(0, 0, 118, 102),
    solidRegions: [solid("crucible-solid", rect(35, 64, 48, 10))],
    noLiquidRender: true,
  }),
  "bunsen-burner": profile("bunsen-burner", asset("bunsen-burner"), rect(0, 0, 112, 142), {
    footprint: rect(18, 112, 76, 20),
    hitBox: rect(0, 0, 112, 142),
    noLiquidRender: true,
  }),
  "dropper-bottle": profile("dropper-bottle", asset("dropper-bottle"), rect(0, 0, 74, 120), {
    footprint: rect(18, 92, 38, 20),
    hitBox: rect(-8, 0, 90, 120),
    contentRegions: [liquidRect(rect(28, 45, 18, 42), "linear")],
    liquidVisualProfile: liquidProfile(
      "dropper-bottle-v1",
      rect(0, 0, 74, 120),
      rect(28, 45, 18, 42),
      "dropper-bottle",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.13, rightInsetFraction: 0.13 },
          { heightFraction: 0.65, leftInsetFraction: 0.08, rightInsetFraction: 0.08 },
          { heightFraction: 0.88, leftInsetFraction: 0.18, rightInsetFraction: 0.18 },
          { heightFraction: 1, leftInsetFraction: 0.32, rightInsetFraction: 0.32 },
        ),
        meniscus: concave(0.44, 2.5),
      },
    ),
  }),
  "phenolphthalein-dropper": profile("phenolphthalein-dropper", asset("phenolphthalein-dropper"), rect(0, 0, 74, 120), {
    footprint: rect(18, 92, 38, 20),
    hitBox: rect(-8, 0, 90, 120),
    contentRegions: [liquidRect(rect(28, 45, 18, 42), "linear")],
    liquidVisualProfile: liquidProfile(
      "phenolphthalein-dropper-v1",
      rect(0, 0, 74, 120),
      rect(28, 45, 18, 42),
      "dropper-bottle",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.13, rightInsetFraction: 0.13 },
          { heightFraction: 0.65, leftInsetFraction: 0.08, rightInsetFraction: 0.08 },
          { heightFraction: 0.88, leftInsetFraction: 0.18, rightInsetFraction: 0.18 },
          { heightFraction: 1, leftInsetFraction: 0.32, rightInsetFraction: 0.32 },
        ),
        meniscus: concave(0.44, 2.5),
      },
    ),
  }),
  "drying-oven": profile("drying-oven", asset("drying-oven"), rect(0, 0, 152, 126), {
    footprint: rect(13, 95, 126, 24),
    hitBox: rect(0, 0, 152, 126),
    visualZones: [
      { id: "drying-oven-chamber", bounds: rect(40, 42, 72, 44), anchor: { x: 76, y: 62 } },
    ],
    noLiquidRender: true,
  }),
  "erlenmeyer-flask-250ml": profile("erlenmeyer-flask-250ml", asset("erlenmeyer-flask-250ml"), rect(0, 0, 106, 140), {
    footprint: rect(17, 112, 72, 20),
    hitBox: rect(0, 0, 106, 140),
    visualZones: [
      { id: "erlenmeyer-stopper-neck", bounds: rect(42, 6, 22, 26), anchor: { x: 53, y: 24 } },
      { id: "erlenmeyer-ph-probe-zone", bounds: rect(37, 24, 32, 58), anchor: { x: 53, y: 52 } },
    ],
    contentRegions: [liquidRect(rect(29, 50, 48, 54), "wide-bottom")],
    liquidVisualProfile: liquidProfile(
      "erlenmeyer-250ml-v1",
      rect(0, 0, 106, 140),
      rect(29, 50, 48, 54),
      "erlenmeyer-body",
      erlenmeyerStops,
      {
        // The realistic flask PNG has an opaque interior, so the fill must sit above
        // the asset while the profile clip keeps it inside the glass silhouette.
        liquidLayerMode: "over-asset",
        overlayViability: {
          checked: true,
          interior: "opaque",
          strategy: "over-asset",
        },
        profileVersion: 3,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.08, rightInsetFraction: 0.08 },
          { heightFraction: 0.22, leftInsetFraction: 0.03, rightInsetFraction: 0.03 },
          { heightFraction: 0.55, leftInsetFraction: 0.18, rightInsetFraction: 0.18 },
          { heightFraction: 0.78, leftInsetFraction: 0.32, rightInsetFraction: 0.32 },
          { heightFraction: 1, leftInsetFraction: 0.39, rightInsetFraction: 0.39 },
        ),
        meniscus: concave(0.46, 3.4),
      },
    ),
    solidRegions: [solid("flask-bottom", rect(35, 98.5, 36, 4.8))],
  }),
  "filter-paper": profile("filter-paper", asset("filter-paper"), rect(0, 0, 70, 52), {
    footprint: rect(8, 29, 54, 12),
    hitBox: rect(-5, -4, 80, 60),
    solidRegions: [solid("paper-cake", rect(18, 19, 34, 15))],
    noLiquidRender: true,
  }),
  "chromatography-paper": profile("chromatography-paper", asset("chromatography-paper"), rect(0, 0, 76, 190), {
    shelfSize: rect(0, 0, 54, 122),
    footprint: rect(16, 170, 44, 12),
    hitBox: rect(0, 0, 76, 190),
    noLiquidRender: true,
  }),
  "chromatography-chamber": profile("chromatography-chamber", asset("chromatography-chamber"), rect(0, 0, 156, 188), {
    shelfSize: rect(0, 0, 86, 110),
    footprint: rect(18, 162, 120, 18),
    hitBox: rect(0, 0, 156, 188),
    visualZones: [
      { id: "chromatography-chamber-paper-slot", bounds: rect(53, 38, 50, 124), anchor: { x: 78, y: 98 } },
    ],
    contentRegions: [liquidRect(rect(33, 136, 90, 22), "linear")],
    liquidVisualProfile: liquidProfile(
      "chromatography-chamber-v1",
      rect(0, 0, 156, 188),
      rect(33, 136, 90, 22),
      "rectangular",
      linearStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        visualCapacityOverrideMl: 50,
        meniscus: concave(0.48, 2.2),
        minRenderableHeightPx: 2,
        hideMeniscusBelowPx: 2,
      },
    ),
  }),
  "capillary-spotter": profile("capillary-spotter", asset("capillary-spotter"), rect(0, 0, 58, 150), {
    shelfSize: rect(0, 0, 48, 126),
    footprint: rect(18, 140, 20, 8),
    hitBox: rect(0, 0, 58, 150),
    noLiquidRender: true,
    hideContentBadgeOnBench: true,
  }),
  "metric-ruler": profile("metric-ruler", asset("metric-ruler"), rect(0, 0, 178, 34), {
    shelfSize: rect(0, 0, 120, 34),
    footprint: rect(6, 22, 166, 8),
    hitBox: rect(0, 0, 178, 34),
    noLiquidRender: true,
  }),
  "funnel": profile("funnel", asset("funnel"), rect(0, 0, 87, 126), {
    shelfSize: rect(0, 0, 56, 78),
    footprint: rect(35, 114, 17, 8),
    hitBox: rect(0, 3, 87, 121),
    noLiquidRender: true,
  }),
  "funnel-stand": profile("funnel-stand", asset("funnel-stand"), rect(0, 0, 260, 468), {
    shelfSize: rect(0, 0, 96, 172),
    footprint: rect(62, 414, 154, 36),
    hitBox: rect(44, 14, 204, 436),
    visualZones: [
      { id: "funnel-stand-paper-seat", bounds: rect(94, 128, 66, 56), anchor: { x: 127, y: 154 } },
      { id: "funnel-receiving-vessel-zone", bounds: rect(74, 244, 106, 130), anchor: { x: 127, y: 315 } },
    ],
    contentRegions: [liquidRect(rect(96, 132, 62, 56), "narrow-neck")],
    liquidVisualProfile: liquidProfile(
      "funnel-stand-v1",
      rect(0, 0, 260, 468),
      rect(96, 132, 62, 56),
      "funnel-cone",
      funnelStops,
      {
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.44, rightInsetFraction: 0.44 },
          { heightFraction: 0.32, leftInsetFraction: 0.31, rightInsetFraction: 0.31 },
          { heightFraction: 0.68, leftInsetFraction: 0.16, rightInsetFraction: 0.16 },
          { heightFraction: 1, leftInsetFraction: 0.04, rightInsetFraction: 0.04 },
        ),
        meniscus: concave(0.42, 2.6),
        minRenderableHeightPx: 3,
      },
    ),
    solidRegions: [solid("funnel-paper-cake", rect(110, 154, 34, 12))],
  }),
  "graduated-cylinder": profile("graduated-cylinder", asset("graduated-cylinder"), rect(0, 0, 108, 178), {
    shelfSize: rect(0, 0, 82, 126),
    footprint: rect(23, 148, 62, 20),
    hitBox: rect(-10, 0, 128, 178),
    contentRegions: [liquidRect(rect(45, 43, 18, 84), "narrow-neck")],
    liquidVisualProfile: liquidProfile(
      "graduated-cylinder-100ml-v1",
      rect(0, 0, 108, 178),
      rect(45, 43, 18, 84),
      "thin-tube",
      linearStops,
      {
        profileVersion: 2,
        overlayViability: {
          checked: true,
          interior: "opaque",
          strategy: "over-asset",
        },
        meniscus: concave(0.48, 2.2),
        minRenderableHeightPx: 1.5,
      },
    ),
  }),
  "graduated-cylinder-25ml": profile(
    "graduated-cylinder-25ml",
    asset("graduated-cylinder-25ml"),
    rect(0, 0, 78, 184),
    {
      shelfSize: rect(0, 0, 62, 132),
      footprint: rect(14, 158, 50, 18),
      hitBox: rect(-8, 0, 94, 184),
      contentRegions: [liquidRect(rect(30, 40, 18, 104), "narrow-neck")],
      liquidVisualProfile: liquidProfile(
        "graduated-cylinder-25ml-v1",
        rect(0, 0, 78, 184),
        rect(30, 40, 18, 104),
        "thin-tube",
        linearStops,
        {
          profileVersion: 2,
          overlayViability: {
            checked: true,
            interior: "transparent",
            strategy: "under-asset",
          },
          meniscus: concave(0.48, 2.2),
          minRenderableHeightPx: 1.5,
        },
      ),
    },
  ),
  "test-tube": profile("test-tube", asset("test-tube"), rect(0, 0, 54, 150), {
    shelfSize: rect(0, 0, 48, 118),
    footprint: rect(18, 132, 18, 10),
    hitBox: rect(-6, 0, 66, 150),
    contentRegions: [liquidRect(rect(18, 48, 18, 78), "narrow-neck")],
    liquidVisualProfile: liquidProfile(
      "test-tube-v1",
      rect(0, 0, 54, 150),
      rect(18, 48, 18, 78),
      "thin-tube",
      linearStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.18, rightInsetFraction: 0.18 },
          { heightFraction: 0.14, leftInsetFraction: 0.08, rightInsetFraction: 0.08 },
          { heightFraction: 0.9, leftInsetFraction: 0.04, rightInsetFraction: 0.04 },
          { heightFraction: 1, leftInsetFraction: 0.06, rightInsetFraction: 0.06 },
        ),
        meniscus: concave(0.46, 1.9),
        minRenderableHeightPx: 2,
        hideMeniscusBelowPx: 1.5,
      },
    ),
    solidRegions: [solid("test-tube-bottom", rect(19, 124, 16, 7))],
  }),
  "ph-meter": profile("ph-meter", asset("ph-meter"), rect(0, 0, 112, 118), {
    footprint: rect(16, 88, 80, 24),
    hitBox: rect(0, 0, 112, 118),
    noLiquidRender: true,
    interactionAnchors: {
      probeHandle: { x: 0.82, y: 0.64 },
    },
    probePresentation: {
      detachedConsoleAsset: equipmentAssetPath(
        "assets/equipment-realistic/v1/ph-meter-probe-detached-console.svg",
      ),
      probeAsset: equipmentAssetPath("assets/equipment-realistic/v1/ph-meter-probe.svg"),
      probeSize: { width: 24, height: 72 },
      consoleLeadPort: { x: 0.74, y: 0.23 },
      sourceGripAnchor: { x: 0.82, y: 0.64 },
      probeLeadPort: { x: 0.5, y: 0.09 },
      probeTipAnchor: { x: 0.5, y: 0.94 },
    },
  }),
  "reagent-bottle": profile("reagent-bottle", asset("reagent-bottle"), rect(0, 0, 86, 126), {
    footprint: rect(18, 100, 50, 18),
    hitBox: rect(-4, 0, 94, 126),
    contentRegions: [liquidRect(rect(27, 44, 32, 51), "linear")],
    liquidVisualProfile: liquidProfile(
      "reagent-bottle-v1",
      rect(0, 0, 86, 126),
      rect(27, 44, 32, 51),
      "bottle-shoulder",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.14, rightInsetFraction: 0.14 },
          { heightFraction: 0.18, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
          { heightFraction: 0.68, leftInsetFraction: 0.07, rightInsetFraction: 0.07 },
          { heightFraction: 0.86, leftInsetFraction: 0.18, rightInsetFraction: 0.16 },
          { heightFraction: 1, leftInsetFraction: 0.31, rightInsetFraction: 0.28 },
        ),
      },
    ),
    solidRegions: [solid("bottle-solid", rect(33, 90, 20, 4.5))],
  }),
  "rubbing-alcohol-bottle": profile(
    "rubbing-alcohol-bottle",
    asset("rubbing-alcohol-bottle"),
    rect(0, 0, 1024, 1536),
    {
      shelfSize: rect(0, 0, 72, 108),
      footprint: rect(254, 1310, 508, 76),
      hitBox: rect(226, 104, 572, 1288),
      noLiquidRender: true,
    },
  ),
  "propanol-bottle": profile("propanol-bottle", asset("propanol-bottle"), rect(0, 0, 86, 126), {
    footprint: rect(18, 100, 50, 18),
    hitBox: rect(-4, 0, 94, 126),
    contentRegions: [liquidRect(rect(27, 44, 32, 51), "linear")],
    liquidVisualProfile: liquidProfile(
      "propanol-bottle-v1",
      rect(0, 0, 86, 126),
      rect(27, 44, 32, 51),
      "bottle-shoulder",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.14, rightInsetFraction: 0.14 },
          { heightFraction: 0.18, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
          { heightFraction: 0.68, leftInsetFraction: 0.07, rightInsetFraction: 0.07 },
          { heightFraction: 0.86, leftInsetFraction: 0.18, rightInsetFraction: 0.16 },
          { heightFraction: 1, leftInsetFraction: 0.31, rightInsetFraction: 0.28 },
        ),
      },
    ),
    solidRegions: [solid("bottle-solid", rect(33, 90, 20, 4.5))],
  }),
  "ring-stand": profile("ring-stand", asset("ring-stand"), rect(0, 0, 260, 468), {
    shelfSize: rect(0, 0, 96, 172),
    footprint: rect(28, 414, 184, 36),
    hitBox: rect(26, 24, 210, 420),
    visualZones: [
      { id: "ring-stand-funnel-seat", bounds: rect(78, 174, 76, 44), anchor: { x: 113, y: 190 } },
      { id: "ring-stand-clay-triangle-seat", bounds: rect(80, 166, 92, 50), anchor: { x: 126, y: 194 } },
      { id: "ring-stand-crucible-seat", bounds: rect(84, 118, 84, 64), anchor: { x: 126, y: 166 } },
      {
        id: "ring-stand-calorimeter-support",
        bounds: rect(78, 168, 96, 58),
        anchor: { x: 126, y: 194 },
      },
      {
        id: "ring-stand-stirrer-bay",
        bounds: rect(62, 318, 160, 112),
        anchor: { x: 142, y: 378 },
      },
    ],
    noLiquidRender: true,
  }),
  "naoh-bottle": profile("naoh-bottle", asset("naoh-bottle"), rect(0, 0, 86, 126), {
    footprint: rect(18, 100, 50, 18),
    hitBox: rect(-4, 0, 94, 126),
    contentRegions: [liquidRect(rect(27, 44, 32, 51), "linear")],
    liquidVisualProfile: liquidProfile(
      "naoh-bottle-v1",
      rect(0, 0, 86, 126),
      rect(27, 44, 32, 51),
      "bottle-shoulder",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.14, rightInsetFraction: 0.14 },
          { heightFraction: 0.18, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
          { heightFraction: 0.68, leftInsetFraction: 0.07, rightInsetFraction: 0.07 },
          { heightFraction: 0.86, leftInsetFraction: 0.18, rightInsetFraction: 0.16 },
          { heightFraction: 1, leftInsetFraction: 0.31, rightInsetFraction: 0.28 },
        ),
      },
    ),
  }),
  "unknown-acid-bottle": profile("unknown-acid-bottle", asset("unknown-acid-bottle"), rect(0, 0, 86, 126), {
    footprint: rect(18, 100, 50, 18),
    hitBox: rect(-4, 0, 94, 126),
    contentRegions: [liquidRect(rect(27, 44, 32, 51), "linear")],
    liquidVisualProfile: liquidProfile(
      "unknown-acid-bottle-v1",
      rect(0, 0, 86, 126),
      rect(27, 44, 32, 51),
      "bottle-shoulder",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.14, rightInsetFraction: 0.14 },
          { heightFraction: 0.18, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
          { heightFraction: 0.68, leftInsetFraction: 0.07, rightInsetFraction: 0.07 },
          { heightFraction: 0.86, leftInsetFraction: 0.18, rightInsetFraction: 0.16 },
          { heightFraction: 1, leftInsetFraction: 0.31, rightInsetFraction: 0.28 },
        ),
      },
    ),
  }),
  "ring-stand-clamp": profile("ring-stand-clamp", asset("ring-stand-clamp"), rect(0, 0, 320, 470), {
    shelfSize: rect(0, 0, 96, 130),
    footprint: rect(95, 324, 130, 52),
    hitBox: rect(78, 0, 208, 238),
    visualZones: [
      { id: "ring-stand-burette-clamp", bounds: rect(108, 84, 128, 94), anchor: { x: 160, y: 124 } },
      {
        id: "ring-stand-burette-receiver",
        // The square stand asset is contained inside this 320 x 470 bench box, so its visible base
        // spans roughly y=324..376. Target the flask foot there and align its mouth with the outlet.
        bounds: rect(180, 324, 66, 52),
        anchor: { x: 213, y: 365 },
        sourceSnapAnchor: { x: 0.5, y: 122 / 140 },
      },
    ],
    noLiquidRender: true,
  }),
  "sample-bottle": profile("sample-bottle", asset("sample-bottle"), rect(0, 0, 84, 124), {
    footprint: rect(18, 98, 48, 18),
    hitBox: rect(-4, 0, 92, 124),
    contentRegions: [liquidRect(rect(28, 44, 28, 51), "linear")],
    liquidVisualProfile: liquidProfile(
      "sample-bottle-v1",
      rect(0, 0, 84, 124),
      rect(28, 44, 28, 51),
      "bottle-shoulder",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.12, rightInsetFraction: 0.12 },
          { heightFraction: 0.18, leftInsetFraction: 0.07, rightInsetFraction: 0.07 },
          { heightFraction: 0.68, leftInsetFraction: 0.04, rightInsetFraction: 0.04 },
          { heightFraction: 0.86, leftInsetFraction: 0.18, rightInsetFraction: 0.16 },
          { heightFraction: 1, leftInsetFraction: 0.31, rightInsetFraction: 0.27 },
        ),
      },
    ),
  }),
  "separatory-funnel": profile(
    "separatory-funnel",
    asset("separatory-funnel"),
    rect(0, 0, 104, 176),
    {
      shelfSize: rect(0, 0, 62, 104),
      footprint: rect(35, 156, 34, 12),
      hitBox: rect(0, 0, 104, 176),
      contentRegions: [liquidRect(rect(30, 55, 44, 66), "wide-bottom")],
      noLiquidRender: true,
    },
  ),
  "sample-rack": profile("sample-rack", asset("sample-rack"), rect(0, 0, 138, 92), {
    footprint: rect(10, 66, 118, 20),
    hitBox: rect(0, 0, 138, 92),
    visualZones: [
      { id: "sample-rack-slot-1", bounds: rect(8, 10, 18, 45), anchor: { x: 17, y: 34 } },
      { id: "sample-rack-slot-2", bounds: rect(28, 10, 18, 45), anchor: { x: 37, y: 34 } },
      { id: "sample-rack-slot-3", bounds: rect(48, 10, 18, 45), anchor: { x: 57, y: 34 } },
      { id: "sample-rack-slot-4", bounds: rect(68, 10, 18, 45), anchor: { x: 77, y: 34 } },
      { id: "sample-rack-slot-5", bounds: rect(88, 10, 18, 45), anchor: { x: 97, y: 34 } },
      { id: "sample-rack-slot-6", bounds: rect(108, 10, 18, 45), anchor: { x: 117, y: 34 } },
    ],
    noLiquidRender: true,
  }),
  "small-vial": profile("small-vial", asset("small-vial"), rect(0, 0, 50, 74), {
    shelfSize: rect(0, 0, 42, 62),
    footprint: rect(11, 62, 28, 8),
    hitBox: rect(0, 0, 50, 74),
    contentRegions: [liquidRect(rect(16, 34, 18, 27), "linear")],
    liquidVisualProfile: liquidProfile(
      "small-vial-v1",
      rect(0, 0, 50, 74),
      rect(16, 34, 18, 27),
      "cylindrical",
      linearStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        meniscus: concave(0.46, 2.4),
        minRenderableHeightPx: 3,
      },
    ),
    solidRegions: [solid("small-vial-solid", rect(17, 55, 16, 6), "rect")],
  }),
  "reagent-tray": profile("reagent-tray", asset("reagent-tray"), rect(0, 0, 144, 76), {
    shelfSize: rect(0, 0, 102, 56),
    footprint: rect(12, 58, 120, 13),
    hitBox: rect(0, 0, 144, 76),
    noLiquidRender: true,
  }),
  "spatula": profile("spatula", asset("spatula"), rect(0, 0, 124, 58), {
    footprint: rect(10, 30, 104, 12),
    hitBox: rect(0, 0, 124, 58),
    solidRegions: [solid("spatula-bowl", rect(84, 24, 22, 10), "rect")],
    noLiquidRender: true,
  }),
  "scoopula": profile("scoopula", asset("scoopula"), rect(0, 0, 1254, 1254), {
    shelfSize: rect(0, 0, 102, 72),
    footprint: rect(124, 760, 1006, 190),
    hitBox: rect(40, 180, 1174, 860),
    solidRegions: [solid("scoopula-bowl", rect(804, 390, 300, 300), "rect")],
    noLiquidRender: true,
  }),
  "stirring-rod": profile("stirring-rod", asset("stirring-rod"), rect(0, 0, 128, 44), {
    footprint: rect(8, 22, 112, 8),
    hitBox: rect(0, 0, 128, 44),
    noLiquidRender: true,
  }),
  "volumetric-flask": profile("volumetric-flask", asset("volumetric-flask"), rect(0, 0, 98, 142), {
    footprint: rect(22, 114, 54, 18),
    hitBox: rect(0, 0, 98, 142),
    visualZones: [
      { id: "volumetric-flask-stopper-seat", bounds: rect(39, 8, 20, 26), anchor: { x: 49, y: 26 } },
    ],
    contentRegions: [liquidRect(rect(24, 54, 50, 60), "wide-bottom")],
    liquidVisualProfile: liquidProfile(
      "volumetric-flask-100ml-v1",
      rect(0, 0, 98, 142),
      rect(24, 54, 50, 60),
      "volumetric-flask-bulb-neck",
      volumetricStops,
      {
        ...withinSvgMaskLiquid,
        profileVersion: 3,
        silhouettePath:
          "M44.6 29.4 C45.1 27.5 52.9 27.5 53.4 29.4 L53 72.6 C53 76.2 55.8 79 58.6 83.1 C65.2 92.2 68.3 102.4 63.3 109.5 C60.2 113.8 54.8 114.4 49 114.4 C43.2 114.4 37.8 113.8 34.7 109.5 C29.7 102.4 32.8 92.2 39.4 83.1 C42.2 79 45 76.2 45 72.6 Z",
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.34, rightInsetFraction: 0.34 },
          { heightFraction: 0.16, leftInsetFraction: 0.22, rightInsetFraction: 0.22 },
          { heightFraction: 0.32, leftInsetFraction: 0.2, rightInsetFraction: 0.2 },
          { heightFraction: 0.59, leftInsetFraction: 0.36, rightInsetFraction: 0.36 },
          { heightFraction: 0.8, leftInsetFraction: 0.42, rightInsetFraction: 0.42 },
          { heightFraction: 0.9, leftInsetFraction: 0.42, rightInsetFraction: 0.42 },
          { heightFraction: 1, leftInsetFraction: 0.42, rightInsetFraction: 0.42 },
        ),
        calibrationMarkY: 54,
        useFinalVolumeMlAsCapacity: true,
        meniscus: concave(0.44, 3),
        minRenderableHeightPx: 4.5,
        hideMeniscusBelowPx: 2.5,
      },
    ),
  }),
  "wash-bottle": profile("wash-bottle", asset("wash-bottle"), rect(0, 0, 112, 118), {
    footprint: rect(24, 92, 56, 18),
    hitBox: rect(0, 0, 112, 118),
    contentRegions: [liquidRect(rect(38, 51, 34, 45), "linear")],
    liquidVisualProfile: liquidProfile(
      "wash-bottle-v1",
      rect(0, 0, 112, 118),
      rect(38, 51, 34, 45),
      "wash-bottle",
      bottleStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.11, rightInsetFraction: 0.07 },
          { heightFraction: 0.55, leftInsetFraction: 0.07, rightInsetFraction: 0.04 },
          { heightFraction: 0.78, leftInsetFraction: 0.1, rightInsetFraction: 0.06 },
          { heightFraction: 1, leftInsetFraction: 0.24, rightInsetFraction: 0.16 },
        ),
      },
    ),
  }),
  "distilled-water-bottle": profile(
    "distilled-water-bottle",
    asset("distilled-water-bottle"),
    rect(0, 0, 112, 118),
    {
      footprint: rect(24, 92, 56, 18),
      hitBox: rect(0, 0, 112, 118),
      contentRegions: [liquidRect(rect(38, 51, 34, 45), "linear")],
      liquidVisualProfile: liquidProfile(
        "distilled-water-bottle-v1",
        rect(0, 0, 112, 118),
        rect(38, 51, 34, 45),
        "wash-bottle",
        bottleStops,
        {
          ...underAssetLiquid,
          profileVersion: 2,
          widthStops: widthStops(
            { heightFraction: 0, leftInsetFraction: 0.11, rightInsetFraction: 0.07 },
            { heightFraction: 0.55, leftInsetFraction: 0.07, rightInsetFraction: 0.04 },
            { heightFraction: 0.78, leftInsetFraction: 0.1, rightInsetFraction: 0.06 },
            { heightFraction: 1, leftInsetFraction: 0.24, rightInsetFraction: 0.16 },
          ),
        },
      ),
    },
  ),
  "waste-beaker": profile("waste-beaker", asset("waste-beaker"), rect(0, 0, 102, 132), {
    footprint: rect(15, 105, 72, 22),
    hitBox: rect(0, 0, 102, 132),
    contentRegions: [liquidRect(rect(24, 38, 54, 60), "wide-bottom")],
    liquidVisualProfile: liquidProfile(
      "waste-beaker-250ml-v1",
      rect(0, 0, 102, 132),
      rect(24, 38, 54, 60),
      "cylindrical",
      beakerStops,
      {
        ...underAssetLiquid,
        profileVersion: 2,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.13, rightInsetFraction: 0.13 },
          { heightFraction: 0.16, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
          { heightFraction: 0.72, leftInsetFraction: 0.045, rightInsetFraction: 0.045 },
          { heightFraction: 1, leftInsetFraction: 0.09, rightInsetFraction: 0.09 },
        ),
        meniscus: concave(0.5, 3.4),
        minRenderableHeightPx: 7,
        hideMeniscusBelowPx: 3,
      },
    ),
    solidRegions: [solid("waste-bottom", rect(34, 94.2, 34, 3.8))],
  }),
  "watch-glass": profile("watch-glass", asset("watch-glass"), rect(0, 0, 102, 64), {
    footprint: rect(10, 38, 82, 14),
    hitBox: rect(0, 0, 102, 64),
    visualZones: [
      {
        id: "watch-glass-paper-seat",
        bounds: rect(20, 12, 62, 42),
        anchor: { x: 51, y: 30 },
      },
    ],
    solidRegions: [solid("watch-glass-surface", rect(24, 28, 54, 16))],
    noLiquidRender: true,
  }),
  "marble-chips": profile("marble-chips", asset("marble-chips"), rect(0, 0, 118, 82), {
    footprint: rect(12, 56, 94, 16),
    hitBox: rect(0, 0, 118, 82),
    solidRegions: [solid("marble-chip-pile", rect(28, 34, 62, 24))],
    noLiquidRender: true,
  }),
  "rubber-stopper-delivery-tube": profile(
    "rubber-stopper-delivery-tube",
    asset("rubber-stopper-delivery-tube"),
    rect(0, 0, 150, 202),
    {
      shelfSize: rect(0, 0, 82, 116),
      footprint: rect(8, 150, 68, 26),
      hitBox: rect(0, 0, 150, 202),
      visualZones: [
        { id: "delivery-tube-gas-syringe-port", bounds: rect(114, 18, 30, 24), anchor: { x: 132, y: 30 } },
      ],
      noLiquidRender: true,
    },
  ),
  "gas-syringe": profile("gas-syringe", asset("gas-syringe"), rect(0, 0, 74, 220), {
    shelfSize: rect(0, 0, 50, 128),
    footprint: rect(24, 198, 26, 12),
    hitBox: rect(0, 0, 74, 220),
    solidRegions: [solid("gas-syringe-readout", rect(14, 58, 46, 118), "rect")],
    noLiquidRender: true,
  }),
  "luer-lock-syringe": profile(
    "luer-lock-syringe",
    realisticAsset("luer-lock-syringe-empty"),
    rect(0, 0, 92, 176),
    {
      shelfSize: rect(0, 0, 62, 122),
      footprint: rect(23, 154, 46, 14),
      hitBox: rect(-8, 0, 108, 176),
      visualZones: [
        {
          id: "luer-lock-syringe-plunger-hole",
          bounds: rect(15, 98, 62, 30),
          anchor: { x: 46, y: 113 },
        },
      ],
      // The seven `syringe-*` states are one shared family, not one investigation's set. Each name
      // describes a plunger, barrel-contents, or closure condition that any syringe body can be in,
      // so a later cycle extends the family by adding a value rather than renaming these. The art is
      // the existing realistic Luer-lock series; `src/equipment/visualStateRegistry.json` records
      // which axis each state fixes.
      stateAssets: {
        "syringe-empty": realisticAsset("luer-lock-syringe-empty"),
        "syringe-extended": realisticAsset("luer-lock-syringe-extended"),
        "syringe-filled": realisticAsset("luer-lock-syringe-filled"),
        "syringe-gas-expelled": realisticAsset("luer-lock-syringe-gas-expelled"),
        "syringe-inverted": realisticAsset("luer-lock-syringe-inverted"),
        "syringe-valve-closed": realisticAsset("luer-lock-syringe-valve-closed"),
        "syringe-nail-locked": realisticAsset("luer-lock-syringe-nail-locked"),
      },
      contentRegions: [liquidRect(rect(33, 50, 26, 62), "linear")],
      liquidVisualProfile: liquidProfile(
        "luer-lock-syringe-v1",
        rect(0, 0, 92, 176),
        rect(33, 50, 26, 62),
        "cylindrical",
        linearStops,
        {
          ...underAssetLiquid,
          profileVersion: 2,
          meniscus: concave(0.36, 2),
          minRenderableHeightPx: 3,
        },
      ),
    },
  ),
  "locking-nail": profile("locking-nail", asset("locking-nail"), rect(0, 0, 154, 32), {
    shelfSize: rect(0, 0, 112, 28),
    footprint: rect(6, 21, 142, 6),
    hitBox: rect(0, -10, 154, 52),
    noLiquidRender: true,
  }),
  "luer-lock-syringe-locked": profile(
    "luer-lock-syringe-locked",
    asset("luer-lock-syringe-locked"),
    rect(0, 0, 160, 48),
    {
      shelfSize: rect(0, 0, 114, 44),
      footprint: rect(19, 35, 118, 8),
      hitBox: rect(0, 0, 160, 48),
      contentRegions: [liquidRect(rect(42, 18, 74, 12), "linear")],
      liquidVisualProfile: liquidProfile(
        "luer-lock-syringe-locked-v1",
        rect(0, 0, 160, 48),
        rect(42, 18, 74, 12),
        "cylindrical",
        linearStops,
        {
          ...underAssetLiquid,
          profileVersion: 2,
          meniscus: concave(0.36, 2),
          minRenderableHeightPx: 3,
        },
      ),
      solidRegions: [solid("syringe-plunger-lock", rect(18, 17, 18, 13), "rect")],
    },
  ),
  "stopwatch": profile("stopwatch", asset("stopwatch"), rect(0, 0, 96, 112), {
    footprint: rect(22, 86, 52, 16),
    hitBox: rect(0, 0, 96, 112),
    noLiquidRender: true,
  }),
  "thermometer": profile("thermometer", asset("thermometer"), rect(0, 0, 28, 118), {
    shelfSize: rect(0, 0, 24, 88),
    footprint: rect(9, 106, 10, 5),
    hitBox: rect(0, 0, 44, 118),
    noLiquidRender: true,
  }),
  "probe-thermometer": profile(
    "probe-thermometer",
    asset("probe-thermometer"),
    rect(0, 0, 52, 154),
    {
      shelfSize: rect(0, 0, 38, 112),
      footprint: rect(20, 142, 12, 6),
      hitBox: rect(0, 0, 52, 154),
      noLiquidRender: true,
      assetViewport: {
        x: 498 / 1254,
        y: 49 / 1254,
        width: 256 / 1254,
        height: 1175 / 1254,
      },
      interactionAnchors: {
        // The shaft enters the cover here; the display head must not drive CAL-05 hit testing.
        snapAnchor: { x: 129 / 256, y: 231 / 1175 },
      },
    },
  ),
  "hot-plate-stirrer": profile("hot-plate-stirrer", asset("hot-plate-stirrer"), rect(0, 0, 154, 96), {
    footprint: rect(16, 70, 122, 18),
    hitBox: rect(0, 0, 154, 96),
    visualZones: [
      {
        id: "hot-plate-stirrer-deck",
        bounds: rect(35, 7, 84, 50),
        anchor: { x: 77, y: 34 },
      },
    ],
    noLiquidRender: true,
  }),
  "magnetic-stir-bar": profile(
    "magnetic-stir-bar",
    asset("magnetic-stir-bar"),
    rect(0, 0, 72, 28),
    {
      shelfSize: rect(0, 0, 64, 28),
      footprint: rect(8, 17, 56, 7),
      hitBox: rect(0, -8, 72, 44),
      noLiquidRender: true,
    },
  ),
  "pencil": profile("pencil", asset("pencil"), rect(0, 0, 174, 36), {
    shelfSize: rect(0, 0, 118, 28),
    footprint: rect(10, 23, 150, 8),
    hitBox: rect(0, 0, 174, 36),
    noLiquidRender: true,
  }),
  "cuvette": profile("cuvette", asset("cuvette"), rect(0, 0, 54, 162), {
    shelfSize: rect(0, 0, 42, 112),
    footprint: rect(16, 142, 22, 9),
    hitBox: rect(0, 0, 54, 162),
    contentRegions: [liquidRect(rect(20, 46, 14, 86), "linear")],
    liquidVisualProfile: liquidProfile(
      "cuvette-v1",
      rect(0, 0, 54, 162),
      rect(20, 46, 14, 86),
      "thin-tube",
      linearStops,
      {
        ...underAssetLiquid,
        profileVersion: 1,
        visualCapacityOverrideMl: 4,
        widthStops: widthStops(
          { heightFraction: 0, leftInsetFraction: 0.04, rightInsetFraction: 0.04 },
          { heightFraction: 1, leftInsetFraction: 0.04, rightInsetFraction: 0.04 },
        ),
        minRenderableHeightPx: 2,
      },
    ),
  }),
  "spectrophotometer": profile("spectrophotometer", asset("spectrophotometer"), rect(0, 0, 188, 114), {
    shelfSize: rect(0, 0, 126, 76),
    footprint: rect(16, 88, 156, 18),
    hitBox: rect(0, 0, 188, 114),
    visualZones: [
      { id: "spectrophotometer-cuvette-slot", bounds: rect(120, 42, 42, 44), anchor: { x: 141, y: 64 } },
    ],
    noLiquidRender: true,
  }),
  "rubber-stopper-set": profile("rubber-stopper-set", asset("rubber-stopper-set"), rect(0, 0, 42, 58), {
    shelfSize: rect(0, 0, 38, 52),
    footprint: rect(8, 48, 26, 8),
    hitBox: rect(0, 0, 42, 58),
    noLiquidRender: true,
  }),
  "polystyrene-cup-8oz": profile(
    "polystyrene-cup-8oz",
    asset("polystyrene-cup-8oz"),
    rect(0, 0, 118, 132),
    {
      shelfSize: rect(0, 0, 82, 92),
      footprint: rect(20, 110, 78, 16),
      hitBox: rect(0, 0, 118, 132),
      visualZones: [
        {
          id: "polystyrene-cup-inner-nest",
          bounds: rect(20, 24, 78, 92),
          anchor: { x: 59, y: 61 },
        },
        {
          id: "polystyrene-cup-cover-seat",
          bounds: rect(12, 6, 94, 38),
          anchor: { x: 59, y: 25 },
        },
        {
          id: "polystyrene-cup-stir-bar-zone",
          bounds: rect(28, 72, 62, 42),
          anchor: { x: 59, y: 94 },
        },
      ],
      contentRegions: [liquidRect(rect(28, 30, 62, 78), "wide-bottom")],
      liquidVisualProfile: liquidProfile(
        "polystyrene-cup-8oz-v1",
        rect(0, 0, 118, 132),
        rect(28, 30, 62, 78),
        "cylindrical",
        beakerStops,
        {
          profileVersion: 1,
          visualCapacityOverrideMl: 237,
          widthStops: widthStops(
            { heightFraction: 0, leftInsetFraction: 0.2, rightInsetFraction: 0.2 },
            { heightFraction: 0.18, leftInsetFraction: 0.15, rightInsetFraction: 0.15 },
            { heightFraction: 0.72, leftInsetFraction: 0.07, rightInsetFraction: 0.07 },
            { heightFraction: 1, leftInsetFraction: 0.04, rightInsetFraction: 0.04 },
          ),
          meniscus: concave(0.48, 3.2),
          minRenderableHeightPx: 6,
          hideMeniscusBelowPx: 3,
        },
      ),
      solidRegions: [solid("polystyrene-cup-bottom", rect(42, 102, 34, 5))],
    },
  ),
  "wooden-calorimeter-cover": profile(
    "wooden-calorimeter-cover",
    asset("wooden-calorimeter-cover"),
    rect(0, 0, 118, 48),
    {
      shelfSize: rect(0, 0, 92, 40),
      footprint: rect(12, 31, 94, 10),
      hitBox: rect(0, -4, 118, 56),
      visualZones: [
        {
          id: "wooden-cover-probe-hole",
          bounds: rect(45, 5, 28, 38),
          anchor: { x: 59, y: 24 },
        },
      ],
      noLiquidRender: true,
    },
  ),
  "weigh-boat": profile("weigh-boat", asset("weigh-boat"), rect(0, 0, 118, 56), {
    shelfSize: rect(0, 0, 94, 48),
    footprint: rect(12, 38, 94, 12),
    hitBox: rect(0, 0, 118, 56),
    solidRegions: [solid("weigh-boat-solid", rect(31, 25, 56, 13))],
    noLiquidRender: true,
  }),
  "hand-warmer-calorimeter": profile(
    "hand-warmer-calorimeter",
    asset("hand-warmer-calorimeter"),
    rect(0, 0, 400, 400),
    {
      shelfSize: rect(0, 0, 120, 120),
      footprint: rect(56, 346, 288, 36),
      hitBox: rect(20, 16, 360, 368),
      visualZones: [
        {
          id: "hand-warmer-stirrer-base",
          // The heater rests on the stand base; it must not occupy the support ring.
          bounds: rect(155, 282, 160, 94),
          anchor: { x: 235, y: 330 },
        },
        {
          id: "hand-warmer-cup-support-ring",
          bounds: rect(198, 134, 75, 142),
          anchor: { x: 235, y: 205 },
        },
        {
          id: "hand-warmer-inner-cup-nest",
          bounds: rect(205, 146, 60, 120),
          anchor: { x: 235, y: 205 },
        },
        {
          id: "hand-warmer-cover-seat",
          bounds: rect(198, 140, 75, 35),
          anchor: { x: 235, y: 155 },
        },
        {
          id: "hand-warmer-probe-hole",
          // Large enough for pointer, touch, and gesture acquisition while preserving the exact hole.
          bounds: rect(207, 122, 56, 56),
          anchor: { x: 235, y: 150 },
        },
        {
          id: "hand-warmer-stir-bar-well",
          bounds: rect(213, 176, 45, 83),
          anchor: { x: 235, y: 251 },
        },
      ],
      stateAssets: handWarmerCalorimeterStateAssets,
      noLiquidRender: true,
    },
  ),
  "foam-cup-calorimeter": profile(
    "foam-cup-calorimeter",
    asset("foam-cup-calorimeter"),
    rect(0, 0, 118, 118),
    {
      shelfSize: rect(0, 0, 88, 88),
      footprint: rect(20, 92, 78, 14),
      hitBox: rect(0, 0, 118, 118),
      noLiquidRender: true,
    },
  ),
  "buchner-funnel": profile("buchner-funnel", asset("buchner-funnel"), rect(0, 0, 96, 116), {
    shelfSize: rect(0, 0, 76, 92),
    footprint: rect(34, 98, 28, 12),
    hitBox: rect(0, 0, 96, 116),
    visualZones: [
      { id: "buchner-funnel-paper-seat", bounds: rect(22, 12, 52, 32), anchor: { x: 48, y: 30 } },
      { id: "buchner-funnel-receiver-neck", bounds: rect(28, 72, 40, 26), anchor: { x: 48, y: 86 } },
    ],
    noLiquidRender: true,
  }),
  "side-arm-filter-flask": profile(
    "side-arm-filter-flask",
    asset("side-arm-filter-flask"),
    rect(0, 0, 118, 138),
    {
      shelfSize: rect(0, 0, 78, 92),
      footprint: rect(22, 114, 70, 16),
      hitBox: rect(0, 0, 118, 138),
      noLiquidRender: true,
    },
  ),
  "vacuum-source": profile("vacuum-source", asset("vacuum-source"), rect(0, 0, 164, 114), {
    shelfSize: rect(0, 0, 126, 88),
    footprint: rect(18, 84, 132, 20),
    hitBox: rect(0, 0, 164, 114),
    noLiquidRender: true,
  }),
  "conductivity-tester": profile(
    "conductivity-tester",
    asset("conductivity-tester"),
    rect(0, 0, 98, 106),
    {
      shelfSize: rect(0, 0, 78, 84),
      footprint: rect(20, 84, 58, 14),
      hitBox: rect(0, 0, 98, 106),
      noLiquidRender: true,
    },
  ),
  "melting-point-apparatus": profile(
    "melting-point-apparatus",
    asset("melting-point-apparatus"),
    rect(0, 0, 86, 122),
    {
      shelfSize: rect(0, 0, 70, 100),
      footprint: rect(16, 104, 54, 12),
      hitBox: rect(0, 0, 86, 122),
      noLiquidRender: true,
    },
  ),
  "ph-paper": profile("ph-paper", asset("ph-paper"), rect(0, 0, 156, 84), {
    shelfSize: rect(0, 0, 126, 68),
    footprint: rect(14, 52, 128, 10),
    hitBox: rect(0, 0, 156, 84),
    noLiquidRender: true,
  }),
  "permanent-marker": profile("permanent-marker", asset("permanent-marker"), rect(0, 0, 190, 56), {
    shelfSize: rect(0, 0, 132, 40),
    footprint: rect(16, 36, 160, 8),
    hitBox: rect(0, 0, 190, 56),
    noLiquidRender: true,
  }),
  "magnet": profile("magnet", asset("magnet"), rect(0, 0, 98, 104), {
    shelfSize: rect(0, 0, 78, 84),
    footprint: rect(14, 86, 70, 12),
    hitBox: rect(0, 0, 98, 104),
    noLiquidRender: true,
  }),
  "data-collection-interface": profile(
    "data-collection-interface",
    asset("data-collection-interface"),
    rect(0, 0, 152, 120),
    {
      shelfSize: rect(0, 0, 116, 92),
      footprint: rect(14, 94, 124, 16),
      hitBox: rect(0, 0, 152, 120),
      noLiquidRender: true,
    },
  ),
  "graduated-pipette-10ml": profile(
    "graduated-pipette-10ml",
    asset("graduated-pipette-10ml"),
    rect(0, 0, 42, 126),
    {
      shelfSize: rect(0, 0, 34, 104),
      footprint: rect(16, 112, 10, 8),
      hitBox: rect(0, 0, 44, 126),
      noLiquidRender: true,
    },
  ),
  "beral-pipette": profile("beral-pipette", asset("beral-pipette"), rect(0, 0, 54, 122), {
    shelfSize: rect(0, 0, 44, 100),
    footprint: rect(18, 108, 18, 8),
    hitBox: rect(0, 0, 54, 122),
    noLiquidRender: true,
  }),
  "pipette-pump": profile("pipette-pump", asset("pipette-pump"), rect(0, 0, 56, 114), {
    shelfSize: rect(0, 0, 46, 94),
    footprint: rect(16, 98, 24, 10),
    hitBox: rect(0, 0, 56, 114),
    noLiquidRender: true,
  }),
  "clay-triangle": profile("clay-triangle", asset("clay-triangle"), rect(0, 0, 98, 70), {
    shelfSize: rect(0, 0, 76, 58),
    footprint: rect(10, 48, 78, 10),
    hitBox: rect(0, 0, 98, 70),
    noLiquidRender: true,
  }),
  "wire-gauze": profile("wire-gauze", asset("wire-gauze"), rect(0, 0, 104, 76), {
    shelfSize: rect(0, 0, 78, 58),
    footprint: rect(10, 54, 84, 10),
    hitBox: rect(0, 0, 104, 76),
    noLiquidRender: true,
  }),
};

// Ungraduated stock bottle silhouettes share their existing clipped liquid geometry.
// The distinct equipment identity supplies the 1 L capacity and accessible label.
for (const [id, baseId] of Object.entries(stockBottleVariants)) {
  v1VisualCatalog[id] = { ...v1VisualCatalog[baseId], equipmentDefinitionId: id };
}

export const getVisualProfile = (definitionId: string | undefined): VisualProfile | undefined =>
  definitionId ? v1VisualCatalog[definitionId] : undefined;

export const getVisualStateAsset = (
  definitionId: string | undefined,
  visualState: string | undefined,
): string | undefined =>
  definitionId && visualState
    ? v1VisualCatalog[definitionId]?.stateAssets?.[visualState]
    : undefined;

export const getBenchSize = (definitionId: string): Rect =>
  getVisualProfile(definitionId)?.benchSize ?? rect(0, 0, 128, 128);

export const getShelfSize = (definitionId: string): Rect =>
  getVisualProfile(definitionId)?.shelfSize ?? rect(0, 0, 92, 92);

export const getFootprint = (definitionId: string): Rect =>
  getVisualProfile(definitionId)?.footprint ?? rect(0, 0, 128, 128);

export const getHitBox = (definitionId: string): Rect =>
  getVisualProfile(definitionId)?.hitBox ?? rect(0, 0, 128, 128);

/**
 * A target zone can name the exact contact point it needs from an accepted child. Source profiles
 * retain their own anchor for reusable apparatus such as a probe; a zone-specific anchor wins when
 * one receiver needs a different physical contact point.
 */
export const getSnapSourceAnchor = (
  sourceDefinitionId: string,
  targetDefinitionId: string | undefined,
  snapZoneId: string | undefined,
): NormalizedInteractionAnchor | undefined =>
  (targetDefinitionId && snapZoneId
    ? getVisualProfile(targetDefinitionId)?.visualZones.find((zone) => zone.id === snapZoneId)
        ?.sourceSnapAnchor
    : undefined) ?? getVisualProfile(sourceDefinitionId)?.interactionAnchors?.snapAnchor;

export const applyFillCurve = (fraction: number, curve: LiquidRegion["fillCurve"]): number => {
  const clamped = Math.min(1, Math.max(0, fraction));
  if (curve === "wide-bottom") return Math.pow(clamped, 0.75);
  if (curve === "narrow-neck") return Math.pow(clamped, 0.55);
  return clamped;
};

export const validateVisualCatalog = (
  catalog: VisualCatalog = v1VisualCatalog,
  equipmentDefinitions: EquipmentDefinition[] = v1EquipmentCatalog,
  availableAssetPaths?: Set<string>,
): string[] => {
  const errors: string[] = [];
  const zoneIds = new Set(v1InteractionZones.map((item) => item.id));
  const definitionIds = new Set(equipmentDefinitions.map((item) => item.id));

  for (const definition of equipmentDefinitions) {
    const profile = catalog[definition.id];
    if (!profile) {
      errors.push(`Missing visual profile for ${definition.id}.`);
      continue;
    }
    if (profile.equipmentDefinitionId !== definition.id) {
      errors.push(`Visual profile ${definition.id} has mismatched equipmentDefinitionId.`);
    }
    if (!definitionIds.has(profile.equipmentDefinitionId)) {
      errors.push(`Visual profile ${profile.equipmentDefinitionId} references unknown equipment.`);
    }
    if (!profile.assetId) {
      errors.push(`Visual profile ${definition.id} must declare an assetId.`);
    }
    if (availableAssetPaths && !availableAssetPaths.has(profile.assetId)) {
      errors.push(`Visual profile ${definition.id} asset does not exist: ${profile.assetId}.`);
    }
    for (const [stateId, stateAsset] of Object.entries(profile.stateAssets ?? {})) {
      if (!stateId.trim()) {
        errors.push(`Visual profile ${definition.id} has an empty state asset id.`);
      }
      if (!stateAsset) {
        errors.push(`Visual profile ${definition.id} state ${stateId} must declare an asset.`);
      }
      if (availableAssetPaths && !availableAssetPaths.has(stateAsset)) {
        errors.push(
          `Visual profile ${definition.id} state ${stateId} asset does not exist: ${stateAsset}.`,
        );
      }
    }
    for (const field of ["benchSize", "shelfSize", "footprint", "hitBox"] as const) {
      const bounds = profile[field];
      if (bounds.width <= 0 || bounds.height <= 0) {
        errors.push(`Visual profile ${definition.id}.${field} must have positive size.`);
      }
    }
    for (const visualZone of profile.visualZones) {
      if (!zoneIds.has(visualZone.id)) {
        errors.push(`Visual profile ${definition.id} visual zone ${visualZone.id} is not an interaction zone.`);
      }
      const sourceSnapAnchor = visualZone.sourceSnapAnchor;
      if (
        sourceSnapAnchor &&
        (!Number.isFinite(sourceSnapAnchor.x) ||
          !Number.isFinite(sourceSnapAnchor.y) ||
          sourceSnapAnchor.x < 0 ||
          sourceSnapAnchor.x > 1 ||
          sourceSnapAnchor.y < 0 ||
          sourceSnapAnchor.y > 1)
      ) {
        errors.push(
          `Visual profile ${definition.id} visual zone ${visualZone.id} source snap anchor must use finite normalized coordinates between 0 and 1.`,
        );
      }
    }
    for (const [anchorId, anchor] of Object.entries(profile.interactionAnchors ?? {})) {
      if (
        !anchor ||
        !Number.isFinite(anchor.x) ||
        !Number.isFinite(anchor.y) ||
        anchor.x < 0 ||
        anchor.x > 1 ||
        anchor.y < 0 ||
        anchor.y > 1
      ) {
        errors.push(
          `Visual profile ${definition.id} interaction anchor ${anchorId} must use finite normalized coordinates between 0 and 1.`,
        );
      }
    }
    if (profile.assetViewport) {
      const viewport = profile.assetViewport;
      if (
        !Number.isFinite(viewport.x) ||
        !Number.isFinite(viewport.y) ||
        !Number.isFinite(viewport.width) ||
        !Number.isFinite(viewport.height) ||
        viewport.x < 0 ||
        viewport.y < 0 ||
        viewport.width <= 0 ||
        viewport.height <= 0 ||
        viewport.x + viewport.width > 1 ||
        viewport.y + viewport.height > 1
      ) {
        errors.push(
          `Visual profile ${definition.id} assetViewport must be a finite positive rectangle within normalized source bounds.`,
        );
      }
    }
    if (profile.probePresentation) {
      const presentation = profile.probePresentation;
      for (const [assetName, assetPath] of Object.entries({
        detachedConsoleAsset: presentation.detachedConsoleAsset,
        probeAsset: presentation.probeAsset,
      })) {
        if (!assetPath) {
          errors.push(`Visual profile ${definition.id} ${assetName} must declare an asset.`);
        } else if (availableAssetPaths && !availableAssetPaths.has(assetPath)) {
          errors.push(`Visual profile ${definition.id} ${assetName} does not exist: ${assetPath}.`);
        }
      }
      if (presentation.probeSize.width <= 0 || presentation.probeSize.height <= 0) {
        errors.push(`Visual profile ${definition.id} probePresentation.probeSize must have positive size.`);
      }
      for (const [anchorId, anchor] of Object.entries({
        consoleLeadPort: presentation.consoleLeadPort,
        sourceGripAnchor: presentation.sourceGripAnchor,
        probeLeadPort: presentation.probeLeadPort,
        probeTipAnchor: presentation.probeTipAnchor,
      })) {
        if (
          !anchor ||
          !Number.isFinite(anchor.x) ||
          !Number.isFinite(anchor.y) ||
          anchor.x < 0 ||
          anchor.x > 1 ||
          anchor.y < 0 ||
          anchor.y > 1
        ) {
          errors.push(
            `Visual profile ${definition.id} probePresentation ${anchorId} must use finite normalized coordinates between 0 and 1.`,
          );
        }
      }
    }
    if (
      definition.capacity.unit === "mL" &&
      definition.capacity.amount > 0 &&
      !profile.noLiquidRender &&
      profile.contentRegions.length === 0 &&
      !profile.liquidVisualProfile
    ) {
      errors.push(`Capacity equipment ${definition.id} needs a liquid region or noLiquidRender.`);
    }
    if (isCoreLiquidVisualEquipment(definition.id) && !profile.noLiquidRender && !profile.liquidVisualProfile) {
      errors.push(`Core liquid equipment ${definition.id} needs a liquid visual profile.`);
    }
    if (profile.liquidVisualProfile) {
      for (const error of validateLiquidVisualProfile(profile.liquidVisualProfile)) {
        errors.push(`${definition.id}: ${error}`);
      }
    }
  }

  for (const id of Object.keys(catalog)) {
    if (!definitionIds.has(id)) errors.push(`Visual catalog contains unknown equipment ${id}.`);
  }

  return errors;
};
