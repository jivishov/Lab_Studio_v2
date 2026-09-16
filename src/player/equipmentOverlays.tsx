import type { ReactElement } from "react";
import { compositeParticipantByRole } from "../equipment/composites";
import type { CompositeEntry } from "../equipment/registries";
import { resolveSolidStyle } from "../equipment/solidRendering";
import { getVisualProfile } from "../equipment/visualCatalog";
import type { EquipmentInstance } from "../domain/types";
import { formatRecordedTemperature, isVisiblePrecipitate } from "./contentDisplay";
import type { EquipmentViewLayer } from "./EquipmentView";

/**
 * Decorative overlays, kept out of `EquipmentView.tsx`.
 *
 * `EquipmentView` looks an overlay up by id and renders it; it never tests a definition id. A
 * composite overlay is named by `extraOverlay` in `src/equipment/compositeRegistry.json`; a content
 * overlay is keyed by the definition whose contents it draws. Every overlay here is `aria-hidden`
 * and non-interactive: the accessible name and the interaction target stay on the equipment button.
 *
 * A composite overlay gets its registry entry, not just its layers, so the snap zone it draws into
 * comes from the participant that declares it. Anything the overlay draws that names a physical
 * state — the filter cake — takes its colour from the visual-state registry through
 * `resolveSolidStyle`, so this file is not a second palette.
 */

export interface CompositeOverlayProps {
  clipPrefix: string;
  composite: CompositeEntry;
  parentLayer: EquipmentViewLayer;
  /** Every matched participant layer, keyed by the registry `role` it fills. */
  layerByRole: ReadonlyMap<string, EquipmentViewLayer>;
}

/** Fallback geometry for the paper seat, used only when the visual profile declares no zone. */
const FALLBACK_PAPER_SEAT = { x: 43, y: 35, width: 56, height: 38 };

const paperSeatGeometry = (funnelLayer: EquipmentViewLayer, zoneId: string | null) => {
  const profile = getVisualProfile(funnelLayer.definition.id);
  const zone = zoneId
    ? profile?.visualZones.find((candidate) => candidate.id === zoneId)
    : undefined;
  const bounds = zone?.bounds ?? FALLBACK_PAPER_SEAT;
  const anchor = zone?.anchor ?? {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height * 0.4,
  };
  return { profile, bounds, anchor };
};

const paperConePath = (bounds: typeof FALLBACK_PAPER_SEAT, anchor: { x: number; y: number }) => {
  const topY = bounds.y + bounds.height * 0.1;
  const sideY = bounds.y + bounds.height * 0.95;
  const tipY = bounds.y + bounds.height * 1.25;
  return [
    `M${bounds.x + bounds.width * 0.05} ${topY}`,
    `L${bounds.x + bounds.width * 0.95} ${topY}`,
    `L${bounds.x + bounds.width * 0.68} ${sideY}`,
    `Q${anchor.x} ${tipY} ${bounds.x + bounds.width * 0.32} ${sideY}`,
    "Z",
  ].join(" ");
};

/** Filter cake sitting in the seated paper cone of the assembled funnel stand. */
const FunnelFilterCakeOverlay = ({
  clipPrefix,
  composite,
  parentLayer,
  layerByRole,
}: CompositeOverlayProps) => {
  const medium = compositeParticipantByRole(composite, "filter-medium");
  const paperContents = medium ? layerByRole.get(medium.role)?.instance?.contents : undefined;
  const hasFilterCake = paperContents ? isVisiblePrecipitate(paperContents) : false;
  const clipId = `${clipPrefix}-funnel-paper-clip`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const { profile, bounds, anchor } = paperSeatGeometry(parentLayer, medium?.snapZoneId ?? null);
  const width = profile?.benchSize.width ?? parentLayer.width;
  const height = profile?.benchSize.height ?? parentLayer.height;
  // The cake is the paper's own precipitate, so it takes the paper's resolved solid style. Before
  // Cycle 05's review this ellipse carried its own literal, a second palette for a state the
  // visual-state registry already owns as `filter-cake`.
  const cake = paperContents ? resolveSolidStyle(paperContents) : undefined;

  return (
    <svg
      className="funnel-composite-overlay"
      style={{
        left: parentLayer.x,
        top: parentLayer.y,
        width: parentLayer.width,
        height: parentLayer.height,
      }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={paperConePath(bounds, anchor)} />
        </clipPath>
      </defs>
      {hasFilterCake && cake ? (
        <g clipPath={`url(#${clipId})`}>
          <ellipse
            cx={anchor.x}
            cy={bounds.y + bounds.height * 0.52}
            rx={bounds.width * 0.34}
            ry={bounds.height * 0.18}
            fill={cake.fill}
            stroke={cake.stroke}
            strokeWidth="0.9"
          />
          <ellipse
            cx={anchor.x}
            cy={bounds.y + bounds.height * 0.46}
            rx={bounds.width * 0.22}
            ry={bounds.height * 0.09}
            fill={cake.highlight}
          />
        </g>
      ) : null}
    </svg>
  );
};

/** Developed chromatogram bands, spotting line, and solvent front on the paper itself. */
const ChromatogramOverlay = ({ instance }: { instance: EquipmentInstance }) => {
  const chromatogram = instance.contents.chromatogram;
  if (!chromatogram) return null;
  const solventFront = chromatogram.solventFrontMm ?? 80;
  const yForDistance = (distanceMm: number) =>
    160 - Math.min(1, Math.max(0, distanceMm / solventFront)) * 118;
  return (
    <svg
      aria-hidden="true"
      className="chromatogram-overlay"
      viewBox="0 0 76 190"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <line x1="20" y1="160" x2="56" y2="160" stroke="#4f4a41" strokeWidth="1.4" strokeDasharray="3 2" />
      {chromatogram.spotted ? <circle cx="38" cy="156" r="3.6" fill="#5a3745" /> : null}
      {chromatogram.solventFrontMm ? (
        <line x1="18" y1="42" x2="58" y2="42" stroke="#4b8797" strokeWidth="1.7" strokeDasharray="4 2" />
      ) : null}
      {chromatogram.bands.map((band) => (
        <ellipse
          key={band.id}
          cx="38"
          cy={yForDistance(band.distanceMm)}
          rx="14"
          ry="4.5"
          fill={band.color}
          opacity="0.88"
        />
      ))}
    </svg>
  );
};

const sevenSegmentGlyphs: Record<string, readonly string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "d", "e", "g"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["b", "c", "f", "g"],
  "5": ["a", "c", "d", "f", "g"],
  "6": ["a", "c", "d", "e", "f", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
};

const SevenSegmentGlyph = ({ character }: { character: string }) => {
  if (character === ".") {
    return <span className="ph-meter-digit ph-meter-decimal" />;
  }

  return (
    <span className="ph-meter-digit" data-glyph={character}>
      {sevenSegmentGlyphs[character]?.map((segment) => (
        <span className={`ph-meter-segment is-${segment}`} key={segment} />
      ))}
    </span>
  );
};

const PhMeterReadoutOverlay = ({ instance }: { instance: EquipmentInstance }) => {
  const readout = instance.contents.instrumentReadout;
  const value = readout ? readout.value.toFixed(readout.precision) : "--.--";

  return (
    <span className="ph-meter-screen-overlay" aria-hidden="true">
      {Array.from(value).map((character, index) => (
        <SevenSegmentGlyph character={character} key={`${character}-${index}`} />
      ))}
    </span>
  );
};

/** The learner's submitted initial-temperature evidence, positioned above the calorimeter probe. */
const HandWarmerRecordedTemperatureOverlay = ({ instance }: { instance: EquipmentInstance }) => {
  const recorded = instance.contents.recordedTemperature;
  if (!recorded) return null;

  return (
    <span className="hand-warmer-temperature-imprint" data-recorded-temperature-imprint aria-hidden="true">
      <span className="hand-warmer-temperature-imprint__label">{recorded.label}</span>
      <span className="hand-warmer-temperature-imprint__value">
        {formatRecordedTemperature(recorded)}
      </span>
    </span>
  );
};

/** Keyed by `extraOverlay` in the composite registry. */
export const compositeOverlayById: Record<
  string,
  (props: CompositeOverlayProps) => ReactElement | null
> = {
  "funnel-filter-cake": FunnelFilterCakeOverlay,
};

/** Keyed by the definition whose own contents the overlay draws. */
export const contentOverlayByDefinitionId: Record<
  string,
  (props: { instance: EquipmentInstance }) => ReactElement | null
> = {
  "chromatography-paper": ChromatogramOverlay,
  "hand-warmer-calorimeter": HandWarmerRecordedTemperatureOverlay,
  "ph-meter": PhMeterReadoutOverlay,
};
