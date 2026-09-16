import { useId, type CSSProperties, type DragEvent, type ReactNode } from "react";
import type { ContentState, EquipmentDefinition, EquipmentInstance } from "../domain/types";
import { equipmentAssetPath, equipmentById } from "../equipment/catalog";
import { evaluateCompositeScene, type CompositeSceneLayer } from "../equipment/composites";
import { resolveSolidStyle, solidStyleVariables } from "../equipment/solidRendering";
import {
  getShelfSize,
  getVisualProfile,
  type SolidRegion,
} from "../equipment/visualCatalog";
import {
  computeLiquidRenderState,
  horizontalSpanAtHeight,
  type LiquidRenderState,
} from "../equipment/liquidRendering";
import {
  contentFillPercent,
  formatRecordedTemperature,
  formatClosureLabel,
  formatContentLabel,
  isOverCapacity,
  isVisibleLiquid,
  isVisiblePrecipitate,
  isVisibleSolidContent,
} from "./contentDisplay";
import { compositeOverlayById, contentOverlayByDefinitionId } from "./equipmentOverlays";

export interface EquipmentViewLayer {
  id: string;
  definition: EquipmentDefinition;
  instance?: EquipmentInstance;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  assetOverride?: string;
  /** Decorative content rendered inside a liquid-capable SVG between the apparatus and liquid. */
  underLiquidAccessory?: ReactNode;
}

interface EquipmentViewProps {
  accessibilityHidden?: boolean;
  definition?: EquipmentDefinition;
  decorative?: boolean;
  instance?: EquipmentInstance;
  layers?: EquipmentViewLayer[];
  selected?: boolean;
  gestureGrabbed?: boolean;
  onSelect?: () => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  variant?: "shelf" | "bench";
  attachedSummary?: string;
  disabled?: boolean;
  statusBadge?: string;
  shelfFitMaxWidth?: number;
}

const cssSize = (width: number, height: number): CSSProperties =>
  ({
    "--equipment-width": `${width}px`,
    "--equipment-height": `${height}px`,
  }) as CSSProperties;

const svgId = (...parts: Array<string | number | undefined>): string =>
  parts.filter((part) => part !== undefined).join("-").replace(/[^a-zA-Z0-9_-]/g, "-");

const solidClass = (region: SolidRegion): string =>
  region.shape === "rect" ? "equipment-region-solid is-rect" : "equipment-region-solid";

const compositeSceneLayer = (layer: EquipmentViewLayer): CompositeSceneLayer => ({
  id: layer.id,
  definitionId: layer.definition.id,
  instanceId: layer.instance?.id,
  snapZoneId: layer.instance?.snapZoneId,
  visualState: layer.instance?.contents.visualState,
  // Explicitly `false`, never merely absent: absent means the apparatus models no lid.
  lidOpen: layer.instance?.contents.developingChamberClosed === false,
});

const AssetImage = ({
  assetOverride,
  definition,
  height,
  width,
}: {
  assetOverride?: string;
  definition: EquipmentDefinition;
  height: number;
  width: number;
}) => (
  <image
    href={assetOverride ?? definition.asset}
    width={width}
    height={height}
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    onError={(event) => {
      const fallback = equipmentAssetPath(`assets/equipment/${definition.id}.svg`);
      if (event.currentTarget.getAttribute("href") === fallback) return;
      event.currentTarget.setAttribute("href", fallback);
    }}
  />
);

const ViewportAssetImage = ({
  assetOverride,
  definition,
  viewport,
}: {
  assetOverride?: string;
  definition: EquipmentDefinition;
  viewport: { x: number; y: number; width: number; height: number };
}) => (
  <svg
    className="equipment-layer-svg equipment-asset-viewport"
    data-asset-viewport
    viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <AssetImage
      assetOverride={assetOverride}
      definition={definition}
      width={1}
      height={1}
    />
  </svg>
);

const LiquidLayer = ({
  clipId,
  gradientId,
  state,
}: {
  clipId: string;
  gradientId: string;
  state: LiquidRenderState;
}) => {
  if (!state.isRenderable) return null;
  const fillHeight = Math.abs(state.bottomY - state.surfaceY);
  const showParticles =
    Boolean(state.style.particles) &&
    fillHeight >= (state.profile.hideParticlesBelowPx ?? 8);
  const particlePoint = (heightWithinFill: number, xFraction: number) => {
    const profileHeight =
      state.profile.fillDirection === "bottom-up"
        ? state.heightFraction * heightWithinFill
        : 1 - state.heightFraction * (1 - heightWithinFill);
    const span = horizontalSpanAtHeight(state.profile, profileHeight);
    return {
      x: span.leftX + span.width * xFraction,
      y:
        state.profile.fillDirection === "bottom-up"
          ? state.bottomY - fillHeight * heightWithinFill
          : state.surfaceY + fillHeight * heightWithinFill,
    };
  };
  const particles = [
    { ...particlePoint(0.3, 0.28), r: 1.2 },
    { ...particlePoint(0.5, 0.58), r: 0.9 },
    { ...particlePoint(0.72, 0.44), r: 0.75 },
  ];

  return (
    <g className="equipment-liquid-svg-layer" clipPath={`url(#${clipId})`} data-liquid-layer>
      <path
        d={state.bodyPath}
        fill={`url(#${gradientId})`}
        stroke={state.style.stroke}
        strokeWidth="1.15"
        opacity={state.style.opacity}
        data-liquid-body
      />
      {showParticles ? (
        <g className="equipment-liquid-particles" opacity="0.42" data-liquid-particles>
          {particles.map((particle, index) => (
            <circle
              key={`${index}-${particle.r}`}
              cx={particle.x}
              cy={particle.y}
              r={particle.r}
            />
          ))}
        </g>
      ) : null}
      {state.highlightPath ? (
        <path
          d={state.highlightPath}
          fill={state.style.highlight}
          opacity="0.82"
          data-liquid-highlight
        />
      ) : null}
      {state.meniscus ? (
        <ellipse
          cx={state.meniscus.cx}
          cy={state.meniscus.cy}
          rx={state.meniscus.rx}
          ry={state.meniscus.ry}
          fill={state.style.meniscus}
          stroke={state.style.stroke}
          strokeWidth="0.9"
          opacity={state.meniscus.opacity}
          data-meniscus
        />
      ) : null}
    </g>
  );
};

const SolidLayer = ({
  clipId,
  contents,
  regions,
}: {
  clipId: string;
  contents: ContentState;
  regions: SolidRegion[];
}) => {
  if (regions.length === 0) return null;
  const style = resolveSolidStyle(contents);
  return (
    <g className="equipment-solid-svg-layer" clipPath={`url(#${clipId})`} data-solid-layer>
      {regions.map((region) => {
        const cx = region.bounds.x + region.bounds.width / 2;
        const cy = region.bounds.y + region.bounds.height / 2;
        if (region.shape === "rect") {
          return (
            <rect
              data-solid-region
              key={region.id}
              x={region.bounds.x}
              y={region.bounds.y}
              width={region.bounds.width}
              height={region.bounds.height}
              rx="3"
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth="0.9"
            />
          );
        }
        return (
          <g key={region.id} data-solid-region>
            <ellipse
              cx={cx}
              cy={cy}
              rx={region.bounds.width / 2}
              ry={region.bounds.height / 2}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth="0.9"
            />
            <ellipse
              cx={cx - region.bounds.width * 0.08}
              cy={cy - region.bounds.height * 0.16}
              rx={region.bounds.width * 0.24}
              ry={region.bounds.height * 0.18}
              fill={style.highlight}
            />
          </g>
        );
      })}
    </g>
  );
};

const WetnessLayer = ({ clipId, state }: { clipId: string; state: LiquidRenderState }) => {
  if (!state.derived.isWetOnly) return null;
  return (
    <g clipPath={`url(#${clipId})`} className="equipment-wetness-svg-layer" data-wetness-layer>
      <path d={state.clipPath} fill="rgba(216, 240, 244, 0.18)" />
      <path
        d={`M${state.region.x + state.region.width * 0.18} ${state.region.y + state.region.height * 0.2}v${state.region.height * 0.56}`}
        stroke="rgba(255, 255, 255, 0.42)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>
  );
};

const CalibrationMark = ({ state }: { state: LiquidRenderState }) => {
  const y = state.profile.calibrationMarkY;
  if (y === undefined) return null;
  return (
    <line
      className="equipment-calibration-mark"
      x1={state.region.x + state.region.width * 0.22}
      x2={state.region.x + state.region.width * 0.78}
      y1={y}
      y2={y}
      data-calibration-mark
    />
  );
};

const LayerContent = ({
  layer,
  clipPrefix,
  fallbackFillPercent,
  suppressAsset = false,
  suppressSolidOverlay = false,
  assetOverride,
  underLiquidAccessory,
}: {
  layer: EquipmentViewLayer;
  clipPrefix: string;
  fallbackFillPercent?: number;
  suppressAsset?: boolean;
  suppressSolidOverlay?: boolean;
  assetOverride?: string;
  underLiquidAccessory?: ReactNode;
}) => {
  const profile = getVisualProfile(layer.definition.id);
  const liquidProfile = profile?.liquidVisualProfile;
  const instance = layer.instance;
  const liquidState =
    instance && liquidProfile
      ? computeLiquidRenderState({
          contents: instance.contents,
          definition: layer.definition,
          profile: liquidProfile,
        })
      : undefined;
  const hasFallbackLiquid =
    !liquidProfile &&
    !profile?.noLiquidRender &&
    instance &&
    isVisibleLiquid(instance.contents) &&
    fallbackFillPercent !== undefined;
  const hasSolidContent = !suppressSolidOverlay && instance ? isVisibleSolidContent(instance.contents) : false;
  const overfilled = Boolean(liquidState?.overCapacity.show || (instance && isOverCapacity(instance.contents, layer.definition)));
  const clipId = svgId(clipPrefix, layer.id, liquidProfile?.profileId, "clip");
  const gradientId = svgId(clipPrefix, layer.id, liquidProfile?.profileId, "gradient");
  const renderSvgAsset = Boolean(profile && liquidProfile);
  const renderSvgSolid = Boolean(renderSvgAsset && profile && profile.solidRegions.length > 0);
  const layerWidth = profile?.benchSize.width ?? layer.width;
  const layerHeight = profile?.benchSize.height ?? layer.height;
  const liquidElement = liquidState ? (
    <>
      <CalibrationMark state={liquidState} />
      <WetnessLayer clipId={clipId} state={liquidState} />
      <LiquidLayer clipId={clipId} gradientId={gradientId} state={liquidState} />
    </>
  ) : null;
  const solidElement =
    hasSolidContent && profile && instance ? (
      <SolidLayer clipId={clipId} contents={instance.contents} regions={profile.solidRegions} />
    ) : null;
  const ContentOverlay = instance
    ? contentOverlayByDefinitionId[instance.definitionId]
    : undefined;
  const liquidBeforeAsset = liquidProfile?.liquidLayerMode === "under-asset";
  const liquidAfterAsset =
    liquidProfile?.liquidLayerMode === "over-asset" ||
    liquidProfile?.liquidLayerMode === "within-svg-mask";

  return (
    <span
      className="equipment-layer"
      style={{
        left: layer.x,
        top: layer.y,
        width: layer.width,
        height: layer.height,
        zIndex: layer.zIndex,
      }}
    >
      {renderSvgAsset && profile && liquidState ? (
        <svg
          className="equipment-layer-svg"
          viewBox={`0 0 ${layerWidth} ${layerHeight}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={liquidState.clipPath} />
            </clipPath>
            <linearGradient
              id={gradientId}
              x1={liquidState.region.x}
              x2={liquidState.region.x}
              y1={liquidState.surfaceY}
              y2={liquidState.bottomY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={liquidState.style.highlight} />
              <stop offset="42%" stopColor={liquidState.style.fill} />
              <stop offset="100%" stopColor={liquidState.style.stroke} />
            </linearGradient>
          </defs>
          {liquidBeforeAsset ? (
            <>
              {liquidElement}
              {solidElement}
            </>
          ) : null}
          {suppressAsset ? null : (
            <AssetImage
              assetOverride={assetOverride}
              definition={layer.definition}
              width={layerWidth}
              height={layerHeight}
            />
          )}
          {underLiquidAccessory}
          {liquidAfterAsset ? (
            <>
              {liquidElement}
              {solidElement}
            </>
          ) : null}
        </svg>
      ) : suppressAsset ? null : profile?.assetViewport ? (
        <ViewportAssetImage
          assetOverride={assetOverride}
          definition={layer.definition}
          viewport={profile.assetViewport}
        />
      ) : (
        <img
          src={assetOverride ?? layer.definition.asset}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={(event) => {
            const fallback = equipmentAssetPath(`assets/equipment/${layer.definition.id}.svg`);
            if (event.currentTarget.src.endsWith(fallback)) return;
            event.currentTarget.src = fallback;
          }}
        />
      )}
      {hasFallbackLiquid ? (
        <span
          className="equipment-liquid-fill"
          style={{ "--fill-level": `${fallbackFillPercent}%` } as CSSProperties}
          aria-hidden="true"
        >
          <span className="equipment-meniscus" />
        </span>
      ) : null}
      {hasSolidContent && instance && profile && profile.solidRegions.length > 0 && !renderSvgSolid ? (
        <span
          className="equipment-solid-region-layer"
          aria-hidden="true"
          style={solidStyleVariables(instance.contents)}
        >
          {profile.solidRegions.map((region) => (
            <span
              className={solidClass(region)}
              key={region.id}
              style={{
                left: region.bounds.x,
                top: region.bounds.y,
                width: region.bounds.width,
                height: region.bounds.height,
              }}
            />
          ))}
        </span>
      ) : null}
      {hasSolidContent && instance && (!profile || profile.solidRegions.length === 0) ? (
        <span
          className="equipment-precipitate"
          aria-hidden="true"
          style={solidStyleVariables(instance.contents)}
        />
      ) : null}
      {overfilled ? (
        <span
          className={`equipment-warning-badge ${liquidState?.overCapacity.severity === "major" ? "is-major" : ""}`}
          aria-hidden="true"
        >
          Overfilled
        </span>
      ) : null}
      {ContentOverlay && instance ? <ContentOverlay instance={instance} /> : null}
    </span>
  );
};

export const EquipmentView = ({
  accessibilityHidden = false,
  attachedSummary,
  decorative = false,
  definition,
  disabled = false,
  instance,
  layers,
  gestureGrabbed = false,
  onDragStart,
  onSelect,
  selected,
  statusBadge,
  shelfFitMaxWidth,
  variant = "shelf",
}: EquipmentViewProps) => {
  const generatedId = useId();
  const resolved = definition ?? (instance ? equipmentById.get(instance.definitionId) : undefined);
  if (!resolved) return null;
  const label = instance?.label ?? resolved.label;
  const contentLabel = instance ? formatContentLabel(instance.contents) : "available";
  const hideContentBadge =
    variant === "bench" && Boolean(getVisualProfile(resolved.id)?.hideContentBadgeOnBench);
  const fillPercent = instance ? contentFillPercent(instance.contents, resolved) : undefined;
  const hasLiquid = instance ? isVisibleLiquid(instance.contents) && fillPercent !== undefined : false;
  const hasPrecipitate = instance ? isVisiblePrecipitate(instance.contents) : false;
  const nominalRenderLayers =
    layers ??
    [
      {
        id: instance?.id ?? resolved.id,
        definition: resolved,
        instance,
        x: 0,
        y: 0,
        width:
          variant === "bench"
            ? getVisualProfile(resolved.id)?.benchSize.width ?? 128
            : getShelfSize(resolved.id).width,
        height:
          variant === "bench"
            ? getVisualProfile(resolved.id)?.benchSize.height ?? 128
            : getShelfSize(resolved.id).height,
      },
    ];
  const nominalArtWidth = Math.max(
    ...nominalRenderLayers.map((layer) => layer.x + layer.width),
    0,
  );
  const shelfFitScale =
    variant === "shelf" &&
    shelfFitMaxWidth &&
    shelfFitMaxWidth > 0 &&
    nominalArtWidth > shelfFitMaxWidth
      ? shelfFitMaxWidth / nominalArtWidth
      : 1;
  const renderLayers =
    shelfFitScale < 1
      ? nominalRenderLayers.map((layer) => ({
          ...layer,
          x: layer.x * shelfFitScale,
          y: layer.y * shelfFitScale,
          width: layer.width * shelfFitScale,
          height: layer.height * shelfFitScale,
        }))
      : nominalRenderLayers;
  const artWidth = Math.max(...renderLayers.map((layer) => layer.x + layer.width), 44);
  const artHeight = Math.max(...renderLayers.map((layer) => layer.y + layer.height), 44);
  // One registry-driven evaluation, in the precedence src/equipment/compositeRegistry.json declares.
  // This component names no apparatus: it asks for an override, a suppression set, and an overlay id.
  const scene = evaluateCompositeScene(renderLayers.map(compositeSceneLayer), {
    compositesEnabled: variant === "bench",
  });
  const CompositeOverlay = scene.overlay ? compositeOverlayById[scene.overlay] : undefined;
  const compositeParentLayer = renderLayers.find((layer) => layer.id === scene.parentLayerId);
  const compositeLayerByRole = new Map(
    [...scene.layerIdByRole].flatMap(([role, layerId]) => {
      const layer = renderLayers.find((candidate) => candidate.id === layerId);
      return layer ? [[role, layer] as const] : [];
    }),
  );
  // Open and closed are now two different pictures of the same apparatus, resolved by the asset
  // pass in src/equipment/composites.ts: the open art has no lid on the vessel, shows the mouth,
  // and rests the lid beside it. The badge is a small at-a-glance confirmation of what the art
  // already shows, not a correction of it, and stays decorative because the accessible name
  // carries the same state through `contentLabel`.
  const closureLabel = instance ? formatClosureLabel(instance.contents) : undefined;
  const chamberOpen = instance?.contents.developingChamberClosed === false;
  const artClassName = [
    "equipment-art",
    `is-${resolved.id}`,
    variant === "bench" ? "is-bench-art" : "is-shelf-art",
    instance ? `visual-${instance.contents.visualState}` : "",
    hasLiquid ? "has-liquid" : "",
    hasPrecipitate ? "has-precipitate" : "",
    closureLabel ? (chamberOpen ? "is-chamber-open" : "is-chamber-sealed") : "",
  ]
    .filter(Boolean)
    .join(" ");
  const recordedTemperatureLabel = instance?.contents.recordedTemperature
    ? `${instance.contents.recordedTemperature.label}: ${formatRecordedTemperature(instance.contents.recordedTemperature)}`
    : undefined;
  const ariaLabel = [label, contentLabel, recordedTemperatureLabel].filter(Boolean).join(", ");
  const className = [
    "equipment-view",
    selected ? "is-selected" : "",
    gestureGrabbed ? "is-gesture-grabbed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = cssSize(artWidth, artHeight);
  const content = (
    <>
      <span className={artClassName}>
        {renderLayers.map((layer) => (
          <LayerContent
            key={layer.id}
            layer={layer}
            clipPrefix={generatedId}
            fallbackFillPercent={layer.instance?.id === instance?.id ? fillPercent : undefined}
            assetOverride={scene.assetOverrideByLayerId.get(layer.id) ?? layer.assetOverride}
            underLiquidAccessory={layer.underLiquidAccessory}
            suppressAsset={scene.suppressedLayerIds.has(layer.id)}
            suppressSolidOverlay={scene.suppressedLayerIds.has(layer.id)}
          />
        ))}
        {CompositeOverlay && compositeParentLayer && scene.composite ? (
          <CompositeOverlay
            clipPrefix={generatedId}
            composite={scene.composite}
            parentLayer={compositeParentLayer}
            layerByRole={compositeLayerByRole}
          />
        ) : null}
        {instance && instance.contents.kind !== "empty" && !hideContentBadge ? (
          <span className="equipment-content-badge" aria-hidden="true">
            {contentLabel}
          </span>
        ) : null}
        {closureLabel ? (
          <span
            className={`equipment-closure-badge ${chamberOpen ? "is-open" : "is-sealed"}`}
            aria-hidden="true"
          >
            {chamberOpen ? "Lid off" : "Sealed"}
          </span>
        ) : null}
        {statusBadge ? <span className="equipment-status-badge">{statusBadge}</span> : null}
      </span>
      <span className="equipment-label">{label}</span>
      {instance ? <span className="equipment-state">{contentLabel}</span> : null}
      {attachedSummary ? <span className="equipment-state">{attachedSummary}</span> : null}
    </>
  );

  if (decorative) {
    return (
      <span
        className={className}
        data-definition-id={resolved.id}
        data-gesture-target={variant}
        data-instance-id={instance?.id}
        style={style}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      aria-hidden={accessibilityHidden || undefined}
      className={className}
      type="button"
      onClick={onSelect}
      disabled={disabled}
      data-definition-id={resolved.id}
      data-gesture-target={variant}
      data-instance-id={instance?.id}
      draggable={Boolean(onDragStart) && !disabled}
      onDragStart={onDragStart}
      aria-pressed={selected}
      aria-label={ariaLabel}
      tabIndex={accessibilityHidden ? -1 : undefined}
      style={style}
    >
      {content}
    </button>
  );
};
