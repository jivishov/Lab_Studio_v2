import { describe, expect, it } from "vitest";
import {
  advanceGestureTracking,
  coerceGestureCursorSpeed,
  expandGestureAxis,
  filterProfileForGestureSpeed,
  hasFourFingerScrollPose,
  isPinching,
  labelForGestureCursorSpeed,
  mirroredViewportPoint,
  resolveFourFingerScrollSignal,
  type GestureCursor,
  type GestureCursorSpeed,
  type GestureTrackingState,
  type NormalizedGestureLandmark,
} from "../gestureMath";
import { resolveGestureAssetUrl } from "../gestureAssets";
import {
  applyGestureScrollIntent,
  gestureScrollIntentFromSignal,
  resolveGestureScrollIntent,
  resolveGestureScrollTarget,
} from "../gestureScroll";

const trackingLandmarks = ({
  indexX = 0.5,
  indexY = 0.4,
  pinchRatio = 0.7,
  scale = 1,
}: {
  indexX?: number;
  indexY?: number;
  pinchRatio?: number;
  scale?: number;
} = {}): NormalizedGestureLandmark[] => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.55, z: 0 }));
  const palmHeight = 0.16 * scale;
  landmarks[0] = { x: 0.5, y: 0.62, z: 0 };
  for (const [landmark, offset] of [[5, -0.08], [9, -0.025], [13, 0.03], [17, 0.085]] as const) {
    landmarks[landmark] = { x: 0.5 + offset * scale, y: 0.62 - palmHeight, z: 0 };
  }
  landmarks[8] = { x: indexX, y: indexY, z: 0 };
  const palmScalePx = Math.hypot(0.025 * 640 * scale, palmHeight * 480);
  landmarks[4] = { x: indexX - (pinchRatio * palmScalePx) / 640, y: indexY, z: 0 };
  return landmarks;
};

const advance = (
  landmarks: NormalizedGestureLandmark[],
  frameTimeMs: number,
  previous?: GestureTrackingState,
  cursorSpeed: GestureCursorSpeed = 3,
) =>
  advanceGestureTracking({
    cursorSpeed,
    frameTimeMs,
    landmarks,
    previous,
    sourceHeight: 480,
    sourceWidth: 640,
    viewportHeight: 800,
    viewportWidth: 1000,
  });

const cursor = (overrides: Partial<GestureCursor> = {}): GestureCursor => ({
  clientX: 110,
  clientY: 220,
  normalizedX: 0.11,
  normalizedY: 0.275,
  pinching: false,
  pinchRatio: 0.7,
  tracking: "tracked",
  ...overrides,
});

const fourFingerLandmarks = (x: number, y: number): NormalizedGestureLandmark[] => {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: y + 0.2, z: 0 }));
  const fingers = [
    { mcp: 5, pip: 6, tip: 8, x: x - 0.06 },
    { mcp: 9, pip: 10, tip: 12, x: x - 0.02 },
    { mcp: 13, pip: 14, tip: 16, x: x + 0.02 },
    { mcp: 17, pip: 18, tip: 20, x: x + 0.06 },
  ];
  landmarks[0] = { x, y: y + 0.28, z: 0 };
  landmarks[4] = { x: x - 0.14, y: y + 0.08, z: 0 };
  for (const finger of fingers) {
    landmarks[finger.mcp] = { x: finger.x, y: y + 0.12, z: 0 };
    landmarks[finger.pip] = { x: finger.x, y: y + 0.06, z: 0 };
    landmarks[finger.tip] = { x: finger.x, y, z: 0 };
  }
  return landmarks;
};

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  toJSON: () => ({}),
  top,
  width,
  x: left,
  y: top,
});

const scrollableElement = ({
  className,
  clientHeight = 200,
  clientWidth = 200,
  rect: elementRect,
  scrollHeight = clientHeight,
  scrollWidth = clientWidth,
}: {
  className: string;
  clientHeight?: number;
  clientWidth?: number;
  rect: DOMRect;
  scrollHeight?: number;
  scrollWidth?: number;
}): HTMLElement => {
  const element = document.createElement("div");
  element.className = className;
  element.getBoundingClientRect = () => elementRect;
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(element, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(element, "scrollWidth", { configurable: true, value: scrollWidth });
  return element;
};

describe("gesture math", () => {
  it("maps and labels cursor speed settings", () => {
    expect(coerceGestureCursorSpeed("bad")).toBe(3);
    expect(coerceGestureCursorSpeed(0)).toBe(1);
    expect(coerceGestureCursorSpeed(6)).toBe(5);
    expect(filterProfileForGestureSpeed(3)).toEqual({
      beta: 3,
      derivativeCutoffHz: 1,
      label: "Balanced",
      minCutoffHz: 1.5,
    });
    expect(filterProfileForGestureSpeed(5).beta).toBe(12);
    expect(labelForGestureCursorSpeed(1)).toBe("Precision");
    expect(labelForGestureCursorSpeed(4)).toBe("Responsive");
  });

  it("responds faster at direct than precision response", () => {
    const first = advance(trackingLandmarks({ indexX: 0.4 }), 0);
    const precision = advance(trackingLandmarks({ indexX: 0.6 }), 16, first.state, 1);
    const direct = advance(trackingLandmarks({ indexX: 0.6 }), 16, first.state, 5);
    expect(direct.cursor!.clientX).toBeLessThan(precision.cursor!.clientX);
  });

  it("keeps centered camera landmarks centered after edge expansion", () => {
    expect(mirroredViewportPoint({ x: 0.5, y: 0.5 }, 1000, 800)).toEqual({
      clientX: 500,
      clientY: 400,
      normalizedX: 0.5,
      normalizedY: 0.5,
    });
  });

  it("expands near-edge hand positions to the viewport edges", () => {
    expect(mirroredViewportPoint({ x: 0.94, y: 0.03 }, 1000, 800)).toEqual({
      clientX: 0,
      clientY: 0,
      normalizedX: 0,
      normalizedY: 0,
    });
    expect(mirroredViewportPoint({ x: 0.02, y: 0.98 }, 1000, 800)).toEqual({
      clientX: 1000,
      clientY: 800,
      normalizedX: 1,
      normalizedY: 1,
    });
  });

  it("keeps edge expansion bounded for invalid input", () => {
    expect(expandGestureAxis(Number.NaN, 0.08)).toBe(0.5);
    expect(expandGestureAxis(0.25, Number.NaN)).toBe(0.25);
    expect(expandGestureAxis(1.2, 0.08)).toBe(1);
  });

  it("uses hysteresis for pinch start and release", () => {
    expect(isPinching(0.3, false)).toBe(true);
    expect(isPinching(0.4, false)).toBe(false);
    expect(isPinching(0.4, true)).toBe(true);
    expect(isPinching(0.5, true)).toBe(false);
  });

  it("rejects missing, non-finite, and undersized hands", () => {
    expect(advance([], 0)).toMatchObject({ status: "noHand" });
    const nonFinite = trackingLandmarks();
    nonFinite[8] = { x: Number.NaN, y: 0.4, z: 0 };
    expect(advance(nonFinite, 0)).toMatchObject({ status: "unstable" });
    expect(advance(trackingLandmarks({ scale: 0.2 }), 0)).toMatchObject({ status: "unstable" });
  });

  it("normalizes pinch by palm scale", () => {
    const result = advance(trackingLandmarks({ pinchRatio: 0.25, scale: 0.6 }), 0);
    const large = advance(trackingLandmarks({ pinchRatio: 0.25, scale: 1.4 }), 0);
    expect(result.status).toBe("ready");
    expect(result.cursor?.pinching).toBe(true);
    expect(large.cursor?.pinching).toBe(true);
    expect(result.cursor?.pinchRatio).toBeCloseTo(0.25, 1);
    expect(large.cursor?.pinchRatio).toBeCloseTo(0.25, 1);
  });

  it("uses the thumb-index contact point through pinch release", () => {
    const openLandmarks = trackingLandmarks({ indexX: 0.45, pinchRatio: 0.7 });
    const pinchedLandmarks = trackingLandmarks({ indexX: 0.45, pinchRatio: 0.25 });
    const releasedLandmarks = trackingLandmarks({ indexX: 0.45, pinchRatio: 0.55 });
    const open = advance(openLandmarks, 0);
    const pinched = advance(pinchedLandmarks, 16, open.state);
    const released = advance(releasedLandmarks, 32, pinched.state);
    const pinchedContact = mirroredViewportPoint(
      {
        x: (pinchedLandmarks[4].x + pinchedLandmarks[8].x) / 2,
        y: (pinchedLandmarks[4].y + pinchedLandmarks[8].y) / 2,
      },
      1000,
      800,
    );
    expect(pinched.cursor?.clientX).toBeCloseTo(pinchedContact.clientX, 5);
    expect(released.cursor?.clientX).toBeCloseTo(pinched.cursor!.clientX, 5);
    expect(pinched.cursor?.clientX).not.toBeCloseTo(open.cursor!.clientX, 1);
  });

  it("reacquires the current point without a frozen frame after a long valid gap", () => {
    const first = advance(trackingLandmarks({ indexX: 0.4 }), 0);
    const reacquiredLandmarks = trackingLandmarks({ indexX: 0.6 });
    const reacquired = advance(reacquiredLandmarks, 300, first.state);
    const expected = mirroredViewportPoint(reacquiredLandmarks[8], 1000, 800);
    expect(reacquired.cursor?.clientX).toBeCloseTo(expected.clientX, 5);
    expect(reacquired.cursor?.clientY).toBeCloseTo(expected.clientY, 5);
  });

  it("holds a pinched cursor briefly and only reacquires a nearby pinch", () => {
    const pinched = advance(trackingLandmarks({ indexX: 0.45, pinchRatio: 0.25 }), 0);
    const held = advance([], 120, pinched.state);
    expect(held.cursor).toMatchObject({ pinching: true, tracking: "held" });
    const resumed = advance(trackingLandmarks({ indexX: 0.46, pinchRatio: 0.25 }), 140, held.state);
    expect(resumed.cursor).toMatchObject({ pinching: true, tracking: "tracked" });
    const open = advance(trackingLandmarks({ indexX: 0.46, pinchRatio: 0.7 }), 140, held.state);
    expect(open.cursor).toBeUndefined();
    expect(advance([], 170, pinched.state).cursor).toBeUndefined();
  });

  it("produces exactly one pinch start and release across frame rates and hand scales", () => {
    for (const fps of [15, 30, 60]) {
      for (const scale of [0.6, 1, 1.4]) {
        let state: GestureTrackingState | undefined;
        let previousPinching = false;
        let starts = 0;
        let releases = 0;
        const ratios = [...Array(12).fill(0.7), ...Array(6).fill(0.25), ...Array(6).fill(0.6)];
        ratios.forEach((pinchRatio, index) => {
          const result = advance(
            trackingLandmarks({ indexX: 0.5, pinchRatio, scale }),
            (index * 1000) / fps,
            state,
          );
          state = result.state;
          const pinching = result.cursor?.pinching ?? false;
          if (!previousPinching && pinching) starts += 1;
          if (previousPinching && !pinching) releases += 1;
          previousPinching = pinching;
        });
        expect({ fps, releases, scale, starts }).toMatchObject({ releases: 1, starts: 1 });
      }
    }
  });

  it("does not falsely pinch during ten seconds of seeded open-hand noise", () => {
    let seed = 0x1234abcd;
    let state: GestureTrackingState | undefined;
    let starts = 0;
    for (let index = 0; index < 600; index += 1) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      const noise = (seed / 0xffffffff - 0.5) * 0.08;
      const result = advance(
        trackingLandmarks({ indexX: 0.5 + noise * 0.02, pinchRatio: 0.68 + noise }),
        (index * 1000) / 60,
        state,
      );
      if (!state?.pinching && result.cursor?.pinching) starts += 1;
      state = result.state;
    }
    expect(starts).toBe(0);
  });

  it("settles a 48 px move consistently with the Balanced time-based filter", () => {
    const settleTimes = [15, 30, 60].map((fps) => {
      let state: GestureTrackingState | undefined;
      for (let index = 0; index < fps; index += 1) {
        state = advance(trackingLandmarks({ indexX: 0.5 }), (index * 1000) / fps, state).state;
      }
      const startX = state!.cursor!.clientX;
      const targetIndexX = 0.5 - (48 / 1000) * (1 - 0.08 * 2);
      const targetX = startX + 48;
      let previousError = 48;
      let previousElapsed = 0;
      for (let frame = 1; frame <= fps; frame += 1) {
        const elapsed = (frame * 1000) / fps;
        const result = advance(
          trackingLandmarks({ indexX: targetIndexX }),
          1000 + elapsed,
          state,
        );
        state = result.state;
        const error = Math.abs(result.cursor!.clientX - targetX);
        if (error <= 10) {
          const crossingFraction = (previousError - 10) / Math.max(0.0001, previousError - error);
          return previousElapsed + crossingFraction * (elapsed - previousElapsed);
        }
        previousError = error;
        previousElapsed = elapsed;
      }
      return Number.POSITIVE_INFINITY;
    });
    expect(Math.max(...settleTimes)).toBeLessThanOrEqual(220);
    expect(Math.max(...settleTimes) - Math.min(...settleTimes)).toBeLessThanOrEqual(40);
  });

  it("detects a stable four-finger wave after pose and travel thresholds", () => {
    const first = resolveFourFingerScrollSignal({
      landmarks: fourFingerLandmarks(0.5, 0.5),
      now: 0,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    expect(first.signal).toMatchObject({ active: false, pose: true });

    const second = resolveFourFingerScrollSignal({
      landmarks: fourFingerLandmarks(0.5, 0.492),
      now: 80,
      previous: first.state,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    expect(second.signal).toMatchObject({ active: false, pose: true });

    const third = resolveFourFingerScrollSignal({
      landmarks: fourFingerLandmarks(0.5, 0.46),
      now: 140,
      previous: second.state,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    expect(third.signal).toMatchObject({
      active: true,
      axis: "vertical",
      direction: "up",
      pose: true,
    });
    expect(third.signal?.deltaY).toBeLessThan(0);
  });

  it("rejects bent or spread fingers for four-finger scrolling", () => {
    const bent = fourFingerLandmarks(0.5, 0.5);
    bent[8] = { ...bent[8], y: bent[6].y };
    expect(hasFourFingerScrollPose(bent)).toBe(false);

    const spread = fourFingerLandmarks(0.5, 0.5);
    spread[20] = { ...spread[20], x: spread[20].x + 0.3 };
    expect(hasFourFingerScrollPose(spread)).toBe(false);
  });

  it("keeps an active four-finger scroll signal through a brief pose gap", () => {
    const first = resolveFourFingerScrollSignal({
      landmarks: fourFingerLandmarks(0.5, 0.5),
      now: 0,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    const active = resolveFourFingerScrollSignal({
      landmarks: fourFingerLandmarks(0.5, 0.46),
      now: 140,
      previous: first.state,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    expect(active.signal).toMatchObject({ active: true, pose: true });

    const briefGap = resolveFourFingerScrollSignal({
      landmarks: trackingLandmarks(),
      now: 220,
      previous: active.state,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    expect(briefGap.signal).toMatchObject({
      active: true,
      axis: "vertical",
      pose: false,
    });

    const continuedGap = resolveFourFingerScrollSignal({
      landmarks: trackingLandmarks(),
      now: 300,
      previous: briefGap.state,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    expect(continuedGap.signal).toMatchObject({ active: true, pose: false });

    const released = resolveFourFingerScrollSignal({
      landmarks: trackingLandmarks(),
      now: 400,
      previous: continuedGap.state,
      viewportHeight: 800,
      viewportWidth: 1000,
    });
    expect(released.signal).toBeUndefined();
    expect(released.state).toBeUndefined();
  });

  it("resolves shelf, workbench, and document scroll intents", () => {
    const root = document.createElement("div");
    const shelf = scrollableElement({
      className: "equipment-shelf-scroll",
      rect: rect(0, 100, 220, 240),
      scrollHeight: 640,
    });
    const workbench = scrollableElement({
      className: "workbench",
      clientWidth: 420,
      rect: rect(260, 100, 420, 240),
      scrollWidth: 900,
    });
    root.append(shelf, workbench);

    expect(
      resolveGestureScrollIntent({
        cursor: {
          clientX: 110,
          clientY: 336,
          pinchRatio: 0.7,
          tracking: "tracked",
          normalizedX: 0.1,
          normalizedY: 0.42,
          pinching: false,
        },
        root,
      }),
    ).toMatchObject({ direction: "down", kind: "shelf" });

    const workbenchIntent = resolveGestureScrollIntent({
      cursor: {
        clientX: 676,
        clientY: 180,
        pinchRatio: 0.7,
        tracking: "tracked",
        normalizedX: 0.68,
        normalizedY: 0.22,
        pinching: false,
      },
      root,
    });
    expect(workbenchIntent).toMatchObject({ direction: "right", kind: "workbench" });
    expect(workbenchIntent ? applyGestureScrollIntent(workbenchIntent) : false).toBe(true);
    expect(workbench.scrollLeft).toBeGreaterThan(0);

    const scrollingElement = document.scrollingElement ?? document.documentElement;
    Object.defineProperty(scrollingElement, "clientHeight", { configurable: true, value: 800 });
    Object.defineProperty(scrollingElement, "scrollHeight", { configurable: true, value: 1600 });
    scrollingElement.scrollTop = 0;
    expect(
      resolveGestureScrollIntent({
        cursor: {
          clientX: 500,
          clientY: 796,
          pinchRatio: 0.7,
          tracking: "tracked",
          normalizedX: 0.5,
          normalizedY: 0.99,
          pinching: false,
        },
        root,
        viewportHeight: 800,
      }),
    ).toMatchObject({ direction: "down", kind: "document" });
  });

  it("chooses an available horizontal or vertical edge for a two-axis workbench viewport", () => {
    const root = document.createElement("div");
    const viewport = scrollableElement({
      className: "bench-viewport",
      clientHeight: 240,
      clientWidth: 420,
      rect: rect(260, 100, 420, 240),
      scrollHeight: 620,
      scrollWidth: 900,
    });
    viewport.setAttribute("data-gesture-scroll-kind", "workbench");
    viewport.setAttribute("data-gesture-scroll-region", "both");
    root.append(viewport);

    expect(
      resolveGestureScrollIntent({
        cursor: {
          clientX: 470,
          clientY: 338,
          pinchRatio: 0.7,
          tracking: "tracked",
          normalizedX: 0.47,
          normalizedY: 0.42,
          pinching: false,
        },
        root,
      }),
    ).toMatchObject({ direction: "down", kind: "workbench" });

    expect(
      resolveGestureScrollIntent({
        cursor: {
          clientX: 678,
          clientY: 220,
          pinchRatio: 0.7,
          tracking: "tracked",
          normalizedX: 0.68,
          normalizedY: 0.28,
          pinching: false,
        },
        root,
      }),
    ).toMatchObject({ direction: "right", kind: "workbench" });
  });

  it("uses visible panel edges when a shelf extends beyond the viewport", () => {
    const root = document.createElement("div");
    root.append(
      scrollableElement({
        className: "equipment-shelf-scroll",
        clientHeight: 540,
        rect: rect(0, 260, 220, 540),
        scrollHeight: 900,
      }),
    );

    expect(
      resolveGestureScrollIntent({
        cursor: {
          clientX: 110,
          clientY: 718,
          pinchRatio: 0.7,
          tracking: "tracked",
          normalizedX: 0.1,
          normalizedY: 0.99,
          pinching: false,
        },
        root,
        viewportHeight: 720,
      }),
    ).toMatchObject({ direction: "down", kind: "shelf" });
  });

  it("resolves target-based four-finger scroll intents without edge positioning", () => {
    const root = document.createElement("div");
    const shelf = scrollableElement({
      className: "equipment-shelf-scroll",
      rect: rect(0, 100, 220, 240),
      scrollHeight: 640,
    });
    shelf.setAttribute("data-gesture-scroll-kind", "shelf");
    shelf.setAttribute("data-gesture-scroll-region", "vertical");
    root.append(shelf);

    const target = resolveGestureScrollTarget({
      axis: "vertical",
      cursor: {
        clientX: 110,
        clientY: 220,
        pinchRatio: 0.7,
        tracking: "tracked",
        normalizedX: 0.1,
        normalizedY: 0.28,
        pinching: false,
      },
      root,
    });
    expect(target).toMatchObject({ axis: "vertical", kind: "shelf" });

    const intent = target
      ? gestureScrollIntentFromSignal({
          signal: {
            active: true,
            axis: "vertical",
            centroid: { clientX: 110, clientY: 246, normalizedX: 0.1, normalizedY: 0.31 },
            deltaX: 0,
            deltaY: 26,
            direction: "down",
            pose: true,
            stableMs: 180,
            strength: 0.8,
            velocityX: 0,
            velocityY: 650,
          },
          target,
        })
      : undefined;
    expect(intent).toMatchObject({ direction: "down", kind: "shelf" });
    expect(intent ? applyGestureScrollIntent(intent) : false).toBe(true);
    expect(shelf.scrollTop).toBeGreaterThan(0);
  });

  it("supports horizontal four-finger scroll for horizontal-only targets", () => {
    const root = document.createElement("div");
    const workbench = scrollableElement({
      className: "workbench",
      clientWidth: 320,
      rect: rect(0, 100, 320, 240),
      scrollWidth: 900,
    });
    workbench.setAttribute("data-gesture-scroll-kind", "workbench");
    workbench.setAttribute("data-gesture-scroll-region", "horizontal");
    root.append(workbench);

    const target = resolveGestureScrollTarget({
      axis: "horizontal",
      cursor: {
        clientX: 140,
        clientY: 200,
        pinchRatio: 0.7,
        tracking: "tracked",
        normalizedX: 0.14,
        normalizedY: 0.25,
        pinching: false,
      },
      root,
    });
    expect(target).toMatchObject({ axis: "horizontal", kind: "workbench" });

    const intent = target
      ? gestureScrollIntentFromSignal({
          signal: {
            active: true,
            axis: "horizontal",
            centroid: { clientX: 170, clientY: 200, normalizedX: 0.17, normalizedY: 0.25 },
            deltaX: 30,
            deltaY: 0,
            direction: "right",
            pose: true,
            stableMs: 180,
            strength: 0.8,
            velocityX: 750,
            velocityY: 0,
          },
          target,
        })
      : undefined;
    expect(intent).toMatchObject({ direction: "right", kind: "workbench" });
    expect(intent ? applyGestureScrollIntent(intent) : false).toBe(true);
    expect(workbench.scrollLeft).toBeGreaterThan(0);
  });

  it("does not resolve scroll intents while pinching or dialogs are open", () => {
    const root = document.createElement("div");
    root.append(
      scrollableElement({
        className: "equipment-shelf-scroll",
        rect: rect(0, 100, 220, 240),
        scrollHeight: 640,
      }),
    );
    const cursor: GestureCursor = {
      clientX: 110,
      clientY: 336,
      pinchRatio: 0.7,
      tracking: "tracked",
      normalizedX: 0.1,
      normalizedY: 0.42,
      pinching: false,
    };

    expect(resolveGestureScrollIntent({ cursor: { ...cursor, pinching: true }, root })).toBeUndefined();
    expect(resolveGestureScrollIntent({ cursor, dialogOpen: true, root })).toBeUndefined();
  });

  it("resolves gesture asset URLs without corrupting absolute base URLs", () => {
    expect(resolveGestureAssetUrl("/", "mediapipe/model.task")).toBe("/mediapipe/model.task");
    expect(resolveGestureAssetUrl("/lab-studio", "/mediapipe/model.task")).toBe(
      "/lab-studio/mediapipe/model.task",
    );
    expect(resolveGestureAssetUrl("https://cdn.example/lab/", "mediapipe/model.task")).toBe(
      "https://cdn.example/lab/mediapipe/model.task",
    );
  });
});
