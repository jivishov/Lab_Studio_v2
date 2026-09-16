export interface NormalizedGestureLandmark {
  x: number;
  y: number;
  z?: number;
}

export type GestureTrackingMode = "tracked" | "held";

export interface GestureCursor {
  clientX: number;
  clientY: number;
  fourFingerScroll?: FourFingerScrollSignal;
  normalizedX: number;
  normalizedY: number;
  pinching: boolean;
  pinchRatio: number;
  tracking: GestureTrackingMode;
}

export type GestureCursorSpeed = 1 | 2 | 3 | 4 | 5;
export type GestureFrameStatus = "ready" | "noHand" | "unstable";
export type FourFingerScrollAxis = "horizontal" | "vertical";
export type FourFingerScrollDirection = "up" | "down" | "left" | "right";

export interface FourFingerScrollSignal {
  active: boolean;
  axis?: FourFingerScrollAxis;
  centroid: {
    clientX: number;
    clientY: number;
    normalizedX: number;
    normalizedY: number;
  };
  deltaX: number;
  deltaY: number;
  direction?: FourFingerScrollDirection;
  pose: boolean;
  stableMs: number;
  strength: number;
  velocityX: number;
  velocityY: number;
}

export interface FourFingerScrollTrackerState {
  active: boolean;
  axis?: FourFingerScrollAxis;
  lastCentroid?: FourFingerScrollSignal["centroid"];
  lastSampleAt?: number;
  originCentroid?: FourFingerScrollSignal["centroid"];
  poseStartedAt?: number;
}

export interface FourFingerScrollInput {
  landmarks: NormalizedGestureLandmark[];
  now: number;
  previous?: FourFingerScrollTrackerState;
  viewportHeight: number;
  viewportWidth: number;
}

export interface FourFingerScrollResult {
  signal?: FourFingerScrollSignal;
  state?: FourFingerScrollTrackerState;
}

export interface GestureFilterProfile {
  beta: number;
  derivativeCutoffHz: number;
  label: string;
  minCutoffHz: number;
}

interface GestureAxisFilterState {
  derivative: number;
  filtered: number;
  raw: number;
  timestampMs: number;
}

export interface GestureCursorFilterState {
  x: GestureAxisFilterState;
  y: GestureAxisFilterState;
}

export interface GestureTrackingState {
  cursor?: GestureCursor;
  filter?: GestureCursorFilterState;
  lastRawNormalized?: { x: number; y: number };
  lastTrackedAtMs?: number;
  pinching: boolean;
}

export interface GestureTrackingInput {
  cursorSpeed: GestureCursorSpeed;
  frameTimeMs: number;
  landmarks: NormalizedGestureLandmark[];
  previous?: GestureTrackingState;
  sourceHeight: number;
  sourceWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}

export interface GestureTrackingResult {
  cursor?: GestureCursor;
  state?: GestureTrackingState;
  status: GestureFrameStatus;
}

export const pinchStartRatio = 0.3;
export const pinchReleaseRatio = 0.5;
export const minimumPalmSpanPx = 32;
export const pinchTrackingGraceMs = 160;
export const maximumReacquireJumpNormalized = 0.12;
export const maximumCommittableSampleAgeMs = 250;
export const horizontalGestureEdgeMargin = 0.08;
export const verticalGestureEdgeMargin = 0.06;
export const fourFingerPoseStableMs = 120;
export const fourFingerActivationTravelPx = 18;
export const fourFingerReleaseGapMs = 160;
export const defaultGestureCursorSpeed: GestureCursorSpeed = 3;
export const gestureCursorSpeedStorageKey = "lab-studio:v1:camera-cursor-speed";
export const gestureFilterProfiles: Record<GestureCursorSpeed, GestureFilterProfile> = {
  1: { beta: 0.4, derivativeCutoffHz: 1, label: "Precision", minCutoffHz: 0.7 },
  2: { beta: 1, derivativeCutoffHz: 1, label: "Smooth", minCutoffHz: 1 },
  3: { beta: 3, derivativeCutoffHz: 1, label: "Balanced", minCutoffHz: 1.5 },
  4: { beta: 6, derivativeCutoffHz: 1, label: "Responsive", minCutoffHz: 2.5 },
  5: { beta: 12, derivativeCutoffHz: 1, label: "Direct", minCutoffHz: 4 },
};

const wristIndex = 0;
const thumbTipIndex = 4;
const indexTipIndex = 8;
const middleTipIndex = 12;
const ringTipIndex = 16;
const pinkyTipIndex = 20;
const palmMcpIndices = [5, 9, 13, 17] as const;

const fourFingerSpecs = [
  { mcp: 5, pip: 6, tip: indexTipIndex },
  { mcp: 9, pip: 10, tip: middleTipIndex },
  { mcp: 13, pip: 14, tip: ringTipIndex },
  { mcp: 17, pip: 18, tip: pinkyTipIndex },
] as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const finiteOr = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const coerceGestureCursorSpeed = (value: unknown): GestureCursorSpeed => {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return defaultGestureCursorSpeed;
  const rounded = Math.round(numeric);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as GestureCursorSpeed;
};

export const labelForGestureCursorSpeed = (speed: unknown): string =>
  gestureFilterProfiles[coerceGestureCursorSpeed(speed)].label;

export const filterProfileForGestureSpeed = (speed: unknown): GestureFilterProfile =>
  gestureFilterProfiles[coerceGestureCursorSpeed(speed)];

export const expandGestureAxis = (value: number, margin: number): number => {
  const normalizedValue = finiteOr(value, 0.5);
  const clampedMargin = clamp01(finiteOr(margin, 0));
  const span = 1 - clampedMargin * 2;
  if (span <= 0) return clamp01(normalizedValue);
  return clamp01((normalizedValue - clampedMargin) / span);
};

export const mirroredViewportPoint = (
  landmark: NormalizedGestureLandmark,
  viewportWidth: number,
  viewportHeight: number,
) => {
  const rawNormalizedX = clamp01(1 - finiteOr(landmark.x, 0.5));
  const rawNormalizedY = clamp01(finiteOr(landmark.y, 0.5));
  const normalizedX = expandGestureAxis(rawNormalizedX, horizontalGestureEdgeMargin);
  const normalizedY = expandGestureAxis(rawNormalizedY, verticalGestureEdgeMargin);
  return {
    clientX: normalizedX * Math.max(0, viewportWidth),
    clientY: normalizedY * Math.max(0, viewportHeight),
    normalizedX,
    normalizedY,
  };
};

export const landmarkDistance = (
  first: NormalizedGestureLandmark,
  second: NormalizedGestureLandmark,
): number => Math.hypot(first.x - second.x, first.y - second.y, (first.z ?? 0) - (second.z ?? 0));

const sourceSpaceDistance = (
  first: NormalizedGestureLandmark,
  second: NormalizedGestureLandmark,
  sourceWidth: number,
  sourceHeight: number,
): number => {
  const width = Math.max(1, sourceWidth);
  const height = Math.max(1, sourceHeight);
  return Math.hypot(
    (first.x - second.x) * width,
    (first.y - second.y) * height,
    ((first.z ?? 0) - (second.z ?? 0)) * width,
  );
};

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const hasFiniteTrackingLandmarks = (landmarks: NormalizedGestureLandmark[]): boolean =>
  landmarks.length >= 21 &&
  landmarks.slice(0, 21).every(
    (landmark) =>
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      (landmark.z === undefined || Number.isFinite(landmark.z)),
  );

const palmScaleInSourcePixels = (
  landmarks: NormalizedGestureLandmark[],
  sourceWidth: number,
  sourceHeight: number,
): number => {
  const wrist = landmarks[wristIndex];
  if (!wrist) return 0;
  return median(
    palmMcpIndices.map((index) =>
      sourceSpaceDistance(wrist, landmarks[index], sourceWidth, sourceHeight),
    ),
  );
};

export const isPinching = (
  ratio: number,
  previousPinching = false,
  startRatio = pinchStartRatio,
  releaseRatio = pinchReleaseRatio,
): boolean => (previousPinching ? ratio < releaseRatio : ratio <= startRatio);

const averageLandmark = (landmarks: NormalizedGestureLandmark[]): NormalizedGestureLandmark => {
  const total = landmarks.reduce<{ x: number; y: number; z: number }>(
    (sum, landmark) => ({
      x: sum.x + landmark.x,
      y: sum.y + landmark.y,
      z: sum.z + (landmark.z ?? 0),
    }),
    { x: 0, y: 0, z: 0 },
  );
  const count = Math.max(1, landmarks.length);
  return {
    x: total.x / count,
    y: total.y / count,
    z: total.z / count,
  };
};

const spreadForAxis = (landmarks: NormalizedGestureLandmark[], axis: "x" | "y"): number => {
  if (!landmarks.length) return 0;
  let min = landmarks[0][axis];
  let max = landmarks[0][axis];
  for (const landmark of landmarks) {
    min = Math.min(min, landmark[axis]);
    max = Math.max(max, landmark[axis]);
  }
  return max - min;
};

export const hasFourFingerScrollPose = (landmarks: NormalizedGestureLandmark[]): boolean => {
  const fingertips = fourFingerSpecs
    .map(({ tip }) => landmarks[tip])
    .filter((landmark): landmark is NormalizedGestureLandmark => Boolean(landmark));
  if (fingertips.length !== fourFingerSpecs.length) return false;

  const fingersExtended = fourFingerSpecs.every(({ mcp, pip, tip }) => {
    const mcpLandmark = landmarks[mcp];
    const pipLandmark = landmarks[pip];
    const tipLandmark = landmarks[tip];
    if (!mcpLandmark || !pipLandmark || !tipLandmark) return false;
    return tipLandmark.y + 0.018 < pipLandmark.y && pipLandmark.y + 0.006 < mcpLandmark.y;
  });
  if (!fingersExtended) return false;

  const tipSpanX = spreadForAxis(fingertips, "x");
  const tipSpanY = spreadForAxis(fingertips, "y");
  return tipSpanX <= 0.22 && tipSpanY <= 0.16;
};

export const resetFourFingerScrollState = (): FourFingerScrollTrackerState | undefined => undefined;

export const resolveFourFingerScrollSignal = ({
  landmarks,
  now,
  previous,
  viewportHeight,
  viewportWidth,
}: FourFingerScrollInput): FourFingerScrollResult => {
  const pose = hasFourFingerScrollPose(landmarks);
  const activePrevious =
    previous?.lastSampleAt !== undefined && now - previous.lastSampleAt <= fourFingerReleaseGapMs
      ? previous
      : undefined;
  if (!pose) {
    if (!activePrevious) return { state: resetFourFingerScrollState() };
    const centroid = activePrevious.lastCentroid;
    const signal: FourFingerScrollSignal | undefined =
      activePrevious.active && activePrevious.axis && centroid
        ? {
            active: true,
            axis: activePrevious.axis,
            centroid,
            deltaX: 0,
            deltaY: 0,
            direction: undefined,
            pose: false,
            stableMs: activePrevious.poseStartedAt === undefined ? 0 : now - activePrevious.poseStartedAt,
            strength: 0,
            velocityX: 0,
            velocityY: 0,
          }
        : undefined;
    return {
      signal,
      // Preserve the last valid-pose timestamp so a continuous stream of non-pose frames cannot
      // keep the scroll latch alive indefinitely.
      state: activePrevious,
    };
  }

  const fingertips = fourFingerSpecs.map(({ tip }) => landmarks[tip]);
  const centroid = mirroredViewportPoint(averageLandmark(fingertips), viewportWidth, viewportHeight);
  const startedAt = activePrevious?.poseStartedAt ?? now;
  const origin = activePrevious?.originCentroid ?? centroid;
  const last = activePrevious?.lastCentroid ?? centroid;
  const elapsedMs = Math.max(1, now - (activePrevious?.lastSampleAt ?? now));
  const deltaX = centroid.clientX - last.clientX;
  const deltaY = centroid.clientY - last.clientY;
  const velocityX = (deltaX * 1000) / elapsedMs;
  const velocityY = (deltaY * 1000) / elapsedMs;
  const totalX = centroid.clientX - origin.clientX;
  const totalY = centroid.clientY - origin.clientY;
  const stableMs = now - startedAt;
  const totalTravelX = Math.abs(totalX);
  const totalTravelY = Math.abs(totalY);
  const activated =
    activePrevious?.active ||
    (stableMs >= fourFingerPoseStableMs &&
      Math.max(totalTravelX, totalTravelY) >= fourFingerActivationTravelPx);
  const axis: FourFingerScrollAxis | undefined = activated
    ? activePrevious?.axis ?? (totalTravelX > totalTravelY ? "horizontal" : "vertical")
    : undefined;
  const axisDelta = axis === "horizontal" ? deltaX : deltaY;
  const direction: FourFingerScrollDirection | undefined =
    !activated || !axis || Math.abs(axisDelta) < 0.75
      ? undefined
      : axis === "horizontal"
        ? axisDelta < 0
          ? "left"
          : "right"
        : axisDelta < 0
          ? "up"
          : "down";
  const strength = Math.min(
    1,
    Math.max(Math.abs(axis === "horizontal" ? velocityX : velocityY) / 900, Math.abs(axisDelta) / 28),
  );
  const signal: FourFingerScrollSignal = {
    active: activated,
    axis,
    centroid,
    deltaX,
    deltaY,
    direction,
    pose,
    stableMs,
    strength,
    velocityX,
    velocityY,
  };

  return {
    signal,
    state: {
      active: activated,
      axis,
      lastCentroid: centroid,
      lastSampleAt: now,
      originCentroid: origin,
      poseStartedAt: startedAt,
    },
  };
};

const smoothingAlpha = (cutoffHz: number, deltaSeconds: number): number => {
  const timeConstant = 1 / (2 * Math.PI * Math.max(0.0001, cutoffHz));
  return 1 / (1 + timeConstant / deltaSeconds);
};

const createAxisFilterState = (value: number, timestampMs: number): GestureAxisFilterState => ({
  derivative: 0,
  filtered: value,
  raw: value,
  timestampMs,
});

const advanceAxisFilter = (
  value: number,
  timestampMs: number,
  previous: GestureAxisFilterState | undefined,
  profile: GestureFilterProfile,
): GestureAxisFilterState => {
  if (!previous || !Number.isFinite(previous.timestampMs) || timestampMs <= previous.timestampMs) {
    return createAxisFilterState(value, timestampMs);
  }
  const elapsedSeconds = (timestampMs - previous.timestampMs) / 1000;
  if (elapsedSeconds > 0.25) {
    return createAxisFilterState(value, timestampMs);
  }
  const deltaSeconds = Math.min(0.1, Math.max(1 / 240, elapsedSeconds));
  const rawDerivative = (value - previous.raw) / deltaSeconds;
  const derivativeAlpha = smoothingAlpha(profile.derivativeCutoffHz, deltaSeconds);
  const derivative = previous.derivative + (rawDerivative - previous.derivative) * derivativeAlpha;
  const cutoff = profile.minCutoffHz + profile.beta * Math.abs(derivative);
  const valueAlpha = smoothingAlpha(cutoff, deltaSeconds);
  return {
    derivative,
    filtered: previous.filtered + (value - previous.filtered) * valueAlpha,
    raw: value,
    timestampMs,
  };
};

const advanceCursorFilter = (
  rawPoint: ReturnType<typeof mirroredViewportPoint>,
  frameTimeMs: number,
  previous: GestureCursorFilterState | undefined,
  speed: GestureCursorSpeed,
  snapToRaw: boolean,
): GestureCursorFilterState => {
  if (snapToRaw) {
    return {
      x: createAxisFilterState(rawPoint.normalizedX, frameTimeMs),
      y: createAxisFilterState(rawPoint.normalizedY, frameTimeMs),
    };
  }
  const profile = filterProfileForGestureSpeed(speed);
  return {
    x: advanceAxisFilter(rawPoint.normalizedX, frameTimeMs, previous?.x, profile),
    y: advanceAxisFilter(rawPoint.normalizedY, frameTimeMs, previous?.y, profile),
  };
};

export const advanceGestureTracking = ({
  cursorSpeed,
  frameTimeMs,
  landmarks,
  previous,
  sourceHeight,
  sourceWidth,
  viewportHeight,
  viewportWidth,
}: GestureTrackingInput): GestureTrackingResult => {
  const finiteLandmarks = hasFiniteTrackingLandmarks(landmarks);
  const palmScale = finiteLandmarks
    ? palmScaleInSourcePixels(landmarks, sourceWidth, sourceHeight)
    : 0;
  const valid = finiteLandmarks && palmScale >= minimumPalmSpanPx;
  if (!valid) {
    const elapsedSinceTracked = frameTimeMs - (previous?.lastTrackedAtMs ?? Number.NEGATIVE_INFINITY);
    if (
      previous?.pinching &&
      previous.cursor &&
      elapsedSinceTracked >= 0 &&
      elapsedSinceTracked <= pinchTrackingGraceMs
    ) {
      const cursor: GestureCursor = {
        ...previous.cursor,
        fourFingerScroll: undefined,
        pinching: true,
        tracking: "held",
      };
      return {
        cursor,
        state: { ...previous, cursor },
        status: "unstable",
      };
    }
    return {
      state: undefined,
      status: landmarks.length === 0 ? "noHand" : "unstable",
    };
  }

  const thumbTip = landmarks[thumbTipIndex];
  const indexTip = landmarks[indexTipIndex];
  const pinchDistance = sourceSpaceDistance(thumbTip, indexTip, sourceWidth, sourceHeight);
  const pinchRatio = pinchDistance / palmScale;
  const pinching = isPinching(pinchRatio, previous?.pinching);
  // The physical grab point is the contact between the thumb and index finger. On release, keep
  // the last visible contact point for one sample instead of following the newly separated
  // fingertips' midpoint, then ease back to the index-tip cursor on the next open-hand frame.
  const releasing = Boolean(previous?.pinching && !pinching);
  const cursorLandmark = pinching ? averageLandmark([thumbTip, indexTip]) : indexTip;
  const trackedPoint = mirroredViewportPoint(cursorLandmark, viewportWidth, viewportHeight);
  const rawPoint = releasing && previous?.cursor
    ? {
        clientX: previous.cursor.clientX,
        clientY: previous.cursor.clientY,
        normalizedX: previous.cursor.normalizedX,
        normalizedY: previous.cursor.normalizedY,
      }
    : trackedPoint;

  if (previous?.cursor?.tracking === "held") {
    const previousRaw = previous.lastRawNormalized ?? {
      x: previous.cursor.normalizedX,
      y: previous.cursor.normalizedY,
    };
    const reacquireJump = Math.hypot(
      rawPoint.normalizedX - previousRaw.x,
      rawPoint.normalizedY - previousRaw.y,
    );
    if (!pinching || reacquireJump > maximumReacquireJumpNormalized) {
      return { state: undefined, status: "unstable" };
    }
  }

  const pinchTransition = previous !== undefined && previous.pinching !== pinching;
  const filter = advanceCursorFilter(rawPoint, frameTimeMs, previous?.filter, cursorSpeed, pinchTransition);
  const normalizedX = clamp01(filter.x.filtered);
  const normalizedY = clamp01(filter.y.filtered);
  const cursor: GestureCursor = {
    clientX: normalizedX * Math.max(0, viewportWidth),
    clientY: normalizedY * Math.max(0, viewportHeight),
    normalizedX,
    normalizedY,
    pinching,
    pinchRatio,
    tracking: "tracked",
  };
  return {
    cursor,
    state: {
      cursor,
      filter,
      lastRawNormalized: {
        x: rawPoint.normalizedX,
        y: rawPoint.normalizedY,
      },
      lastTrackedAtMs: frameTimeMs,
      pinching,
    },
    status: "ready",
  };
};
