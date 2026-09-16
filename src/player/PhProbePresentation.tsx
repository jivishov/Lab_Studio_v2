import type { CSSProperties } from "react";
import type { ProbePresentation } from "../equipment/visualCatalog";

export interface ProbePoint {
  x: number;
  y: number;
}

export const probeLeadPathData = (from: ProbePoint, to: ProbePoint): string => {
  const bend = Math.max(24, Math.min(96, Math.abs(to.x - from.x) * 0.42 + 18));
  const direction = to.x >= from.x ? 1 : -1;
  return `M ${from.x} ${from.y} C ${from.x + bend * direction} ${from.y + 10}, ${to.x - bend * direction} ${to.y - 22}, ${to.x} ${to.y}`;
};

const probeStyle = (presentation: ProbePresentation): CSSProperties => ({
  width: presentation.probeSize.width,
  height: presentation.probeSize.height,
});

/** The single photorealistic probe element used at its source, while dragging, and when immersed. */
export const PhProbeArt = ({ presentation }: { presentation: ProbePresentation }) => (
  <img
    className="ph-probe-art"
    src={presentation.probeAsset}
    alt=""
    aria-hidden="true"
    draggable={false}
    style={probeStyle(presentation)}
  />
);

/**
 * Places the probe beneath a vessel's liquid overlay. The probe tip, not its bounding-box centre,
 * meets the snap-zone anchor, which keeps a real sensing end immersed through a narrow neck.
 */
export const PhProbeUnderLiquidAccessory = ({
  presentation,
  zoneAnchor,
}: {
  presentation: ProbePresentation;
  zoneAnchor: ProbePoint;
}) => {
  const { width, height } = presentation.probeSize;
  const x = zoneAnchor.x - width * presentation.probeTipAnchor.x;
  const y = zoneAnchor.y - height * presentation.probeTipAnchor.y;
  return (
    <image
      className="ph-probe-under-liquid"
      href={presentation.probeAsset}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    />
  );
};

/** A restrained physical lead; it carries no state and never participates in hit testing. */
export const PhProbeLead = ({
  from,
  instanceId,
  to,
  surfaceHeight,
  surfaceWidth,
}: {
  from: ProbePoint;
  instanceId?: string;
  to: ProbePoint;
  surfaceHeight: number;
  surfaceWidth: number;
}) => {
  const d = probeLeadPathData(from, to);
  return (
    <svg
      className="ph-probe-lead"
      data-probe-lead-from-x={from.x}
      data-probe-lead-from-y={from.y}
      data-probe-lead-instance-id={instanceId}
      viewBox={`0 0 ${surfaceWidth} ${surfaceHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="ph-probe-lead-shadow" d={d} />
      <path className="ph-probe-lead-wire" d={d} />
    </svg>
  );
};
