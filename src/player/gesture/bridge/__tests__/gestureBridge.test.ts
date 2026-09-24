import { afterEach, describe, expect, it, vi } from "vitest";
import { maximumCommittableSampleAgeMs, type GestureCursor } from "../../gestureMath";
import type { GestureFrameSnapshot } from "../../gestureTypes";
import {
  GestureBridge,
  gestureActionReleaseTolerancePx,
  gestureActionRepeatGuardMs,
  gestureRearmOpenMs,
  type GestureBridgeClock,
  type GestureBridgeHost,
  type GestureGrabResolution,
  type GestureHoverCue,
} from "../gestureBridge";

/**
 * The shared gesture bridge on its own (plan D6): a fake resolver says what is under the cursor, fake
 * grab handlers record what the bridge asks the player to do, and a manual clock drives time.
 */

interface FakeGrab {
  id: string;
}

const cursor = (
  pinching: boolean,
  clientX = 100,
  clientY = 100,
  tracking: GestureCursor["tracking"] = "tracked",
): GestureCursor => ({
  clientX,
  clientY,
  normalizedX: clientX / 1000,
  normalizedY: clientY / 800,
  pinching,
  pinchRatio: pinching ? 0.25 : 0.7,
  tracking,
});

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

const manualClock = () => {
  let now = 1000;
  const frames = new Map<number, () => void>();
  let nextHandle = 1;
  const clock: GestureBridgeClock = {
    cancelFrame: (handle) => {
      frames.delete(handle);
    },
    now: () => now,
    requestFrame: (callback) => {
      const handle = nextHandle++;
      frames.set(handle, callback);
      return handle;
    },
  };
  return {
    advance: (ms: number) => {
      now += ms;
    },
    clock,
    get now() {
      return now;
    },
  };
};

const setup = ({
  grabAt = () => undefined,
  hoverAt = () => undefined,
}: {
  grabAt?: (element: Element) => GestureGrabResolution<FakeGrab> | undefined;
  hoverAt?: () => GestureHoverCue | undefined;
} = {}) => {
  const root = document.createElement("div");
  document.body.append(root);
  const surface = document.createElement("div");
  root.append(surface);
  let under: Element | undefined = surface;
  const time = manualClock();
  const grabs = {
    begin: vi.fn<(grab: FakeGrab, cursor: GestureCursor) => void>(),
    clear: vi.fn<() => void>(),
    move: vi.fn<(grab: FakeGrab, cursor: GestureCursor) => void>(),
    release: vi.fn<(grab: FakeGrab, cursor: GestureCursor) => void>(),
  };
  const onRearmChange = vi.fn<(required: boolean) => void>();
  const host: GestureBridgeHost<FakeGrab> = {
    blocked: false,
    grabs,
    onRearmChange,
    resolver: {
      contains: (element) => root.contains(element),
      elementAt: () => under,
      grabAt: (element) => grabAt(element),
      hoverAt: () => hoverAt(),
    },
    scrollRoot: () => root,
  };
  const bridge = new GestureBridge<FakeGrab>(host, time.clock);
  const frame = (current: GestureCursor | undefined, sampleAgeMs = 0) => {
    const snapshot: GestureFrameSnapshot = {
      cursor: current,
      frameId: 1,
      frameTimeMs: time.now,
      sampleStartedAtMs: time.now - sampleAgeMs,
      status: current ? "ready" : "noHand",
    };
    bridge.handleFrame(snapshot);
    time.advance(16);
  };
  return {
    bridge,
    frame,
    grabs,
    host,
    onRearmChange,
    root,
    setUnder: (element: Element | undefined) => {
      under = element;
    },
    surface,
    time,
  };
};

const actionButton = (root: HTMLElement, action = "confirm-accessible-action") => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.gestureAction = action;
  button.getBoundingClientRect = () => rect(80, 80, 60, 30);
  root.append(button);
  return button;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("the shared gesture bridge (plan D6)", () => {
  it("grabs on pinch start, previews while the pinch is held, and commits once on release", () => {
    const item = { id: "flask" };
    const t = setup({ grabAt: () => ({ grab: item, kind: "grab" }) });
    t.frame(cursor(false));
    t.frame(cursor(true, 100, 100));
    expect(t.grabs.begin).toHaveBeenCalledTimes(1);
    expect(t.grabs.begin).toHaveBeenCalledWith(item, expect.objectContaining({ clientX: 100, pinching: true }));
    expect(t.bridge.grabbing).toBe(true);
    expect(t.bridge.activeGrab).toBe(item);

    t.frame(cursor(true, 140, 120));
    t.frame(cursor(true, 180, 140));
    expect(t.grabs.move).toHaveBeenCalledTimes(2);
    expect(t.grabs.move).toHaveBeenLastCalledWith(item, expect.objectContaining({ clientX: 180 }));
    // Nothing commits while the pinch is held (AGENTS.md; handoff G-5).
    expect(t.grabs.release).not.toHaveBeenCalled();

    t.frame(cursor(false, 190, 150));
    expect(t.grabs.release).toHaveBeenCalledTimes(1);
    expect(t.grabs.release).toHaveBeenCalledWith(item, expect.objectContaining({ clientX: 190, pinching: false }));
    expect(t.bridge.grabbing).toBe(false);
    expect(t.bridge.activeGrab).toBeUndefined();

    t.frame(cursor(false, 190, 150));
    expect(t.grabs.release).toHaveBeenCalledTimes(1);
  });

  it("picks nothing up outside the player, and clears any preview", () => {
    const grabAt = vi.fn(() => ({ grab: { id: "x" }, kind: "grab" as const }));
    const t = setup({ grabAt });
    t.setUnder(document.createElement("span"));
    t.frame(cursor(false));
    t.frame(cursor(true));
    expect(grabAt).not.toHaveBeenCalled();
    expect(t.grabs.begin).not.toHaveBeenCalled();
    expect(t.grabs.clear).toHaveBeenCalled();
    expect(t.bridge.grabbing).toBe(false);
  });

  it("stops at equipment that cannot be picked up: no grab and no action", () => {
    const t = setup({ grabAt: () => ({ kind: "blocked" }) });
    const button = actionButton(t.root);
    const click = vi.spyOn(button, "click");
    t.setUnder(button);
    t.frame(cursor(false, 100, 95));
    t.frame(cursor(true, 100, 95));
    t.frame(cursor(false, 100, 95));
    expect(t.grabs.begin).not.toHaveBeenCalled();
    expect(t.grabs.release).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("activates a whitelisted action button on release over it, once", () => {
    const t = setup();
    const button = actionButton(t.root);
    const click = vi.spyOn(button, "click");
    t.setUnder(button);
    t.frame(cursor(false, 100, 95));
    t.frame(cursor(true, 100, 95));
    expect(button).toHaveClass("is-gesture-armed");
    expect(t.bridge.grabbing).toBe(true);
    expect(click).not.toHaveBeenCalled();
    t.frame(cursor(false, 102, 96));
    expect(click).toHaveBeenCalledTimes(1);
    expect(button).not.toHaveClass("is-gesture-armed");
  });

  it("only activates buttons that opt in with data-gesture-action", () => {
    const t = setup();
    const plain = document.createElement("button");
    plain.type = "button";
    t.root.append(plain);
    const click = vi.spyOn(plain, "click");
    t.setUnder(plain);
    t.frame(cursor(false));
    t.frame(cursor(true));
    t.frame(cursor(false));
    expect(click).not.toHaveBeenCalled();
    expect(t.bridge.grabbing).toBe(false);
  });

  it("does not activate a disabled action button", () => {
    const t = setup();
    const button = actionButton(t.root);
    button.disabled = true;
    const click = vi.spyOn(button, "click");
    t.setUnder(button);
    t.frame(cursor(false, 100, 95));
    t.frame(cursor(true, 100, 95));
    t.frame(cursor(false, 100, 95));
    expect(click).not.toHaveBeenCalled();
  });

  it("does not activate a different whitelisted button on release, but tolerates a release just off the original", () => {
    const t = setup();
    const first = actionButton(t.root, "confirm-accessible-action");
    const second = actionButton(t.root, "record-evidence");
    second.getBoundingClientRect = () => rect(400, 80, 60, 30);
    const firstClick = vi.spyOn(first, "click");
    const secondClick = vi.spyOn(second, "click");

    t.setUnder(first);
    t.frame(cursor(false, 100, 95));
    t.frame(cursor(true, 100, 95));
    t.setUnder(second);
    t.frame(cursor(false, 420, 95));
    expect(firstClick).not.toHaveBeenCalled();
    expect(secondClick).not.toHaveBeenCalled();

    t.time.advance(gestureActionRepeatGuardMs);
    t.setUnder(first);
    t.frame(cursor(false, 100, 95));
    t.frame(cursor(true, 100, 95));
    t.setUnder(t.surface);
    // Just outside the button's right edge (140), inside the tolerance.
    t.frame(cursor(false, 140 + gestureActionReleaseTolerancePx - 1, 95));
    expect(firstClick).toHaveBeenCalledTimes(1);
  });

  it("treats two activations closer together than the repeat guard as one", () => {
    const t = setup();
    const button = actionButton(t.root);
    const click = vi.spyOn(button, "click");
    t.setUnder(button);
    t.frame(cursor(false, 100, 95));
    t.frame(cursor(true, 100, 95));
    t.frame(cursor(false, 100, 95));
    t.frame(cursor(true, 100, 95));
    t.frame(cursor(false, 100, 95));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("cancels without committing when a blocking dialog opens mid-pinch, and asks to re-arm", () => {
    const t = setup({ grabAt: () => ({ grab: { id: "flask" }, kind: "grab" }) });
    t.frame(cursor(false));
    t.frame(cursor(true));
    t.host.blocked = true;
    t.frame(cursor(true, 150, 150));
    expect(t.grabs.clear).toHaveBeenCalled();
    expect(t.grabs.release).not.toHaveBeenCalled();
    expect(t.bridge.rearmRequired).toBe(true);
    expect(t.onRearmChange).toHaveBeenLastCalledWith(true);

    t.host.blocked = false;
    t.frame(cursor(false, 150, 150));
    expect(t.grabs.release).not.toHaveBeenCalled();
  });

  it("re-arms only after an open hand has been tracked continuously for the re-arm time", () => {
    const t = setup({ grabAt: () => ({ grab: { id: "flask" }, kind: "grab" }) });
    t.bridge.cancel(true);
    expect(t.bridge.rearmRequired).toBe(true);
    t.frame(cursor(false));
    t.time.advance(gestureRearmOpenMs - 40);
    t.frame(cursor(true));
    // A pinch restarts the wait, and grabs nothing while re-arm is required.
    expect(t.grabs.begin).not.toHaveBeenCalled();
    t.frame(cursor(false));
    t.time.advance(gestureRearmOpenMs - 40);
    t.frame(cursor(false));
    expect(t.bridge.rearmRequired).toBe(true);
    t.time.advance(40);
    t.frame(cursor(false));
    expect(t.bridge.rearmRequired).toBe(false);
    expect(t.onRearmChange).toHaveBeenLastCalledWith(false);

    t.frame(cursor(true));
    expect(t.grabs.begin).toHaveBeenCalledTimes(1);
  });

  it("holds a pinch through brief tracking loss, then commits on release", () => {
    const item = { id: "flask" };
    const t = setup({ grabAt: () => ({ grab: item, kind: "grab" }) });
    t.frame(cursor(false));
    t.frame(cursor(true));
    t.frame(cursor(true, 120, 120, "held"));
    expect(t.grabs.clear).not.toHaveBeenCalled();
    expect(t.bridge.activeGrab).toBe(item);
    t.frame(cursor(true, 130, 120));
    t.frame(cursor(false, 130, 120));
    expect(t.grabs.release).toHaveBeenCalledTimes(1);
  });

  it("cancels without committing when the hand is lost mid-pinch", () => {
    const t = setup({ grabAt: () => ({ grab: { id: "flask" }, kind: "grab" }) });
    t.frame(cursor(false));
    t.frame(cursor(true));
    t.frame(undefined);
    expect(t.grabs.clear).toHaveBeenCalled();
    expect(t.bridge.rearmRequired).toBe(true);
    t.frame(cursor(false));
    expect(t.grabs.release).not.toHaveBeenCalled();
  });

  it("cancels an active pinch on a stale sample, but only clears the hover cue when idle", () => {
    const cue = { apply: vi.fn(), clear: vi.fn(), key: "target" };
    const t = setup({ grabAt: () => ({ grab: { id: "flask" }, kind: "grab" }), hoverAt: () => cue });
    t.frame(cursor(false));
    expect(cue.apply).toHaveBeenCalledTimes(1);
    t.frame(cursor(false), maximumCommittableSampleAgeMs + 1);
    expect(cue.clear).toHaveBeenCalledTimes(1);
    expect(t.bridge.rearmRequired).toBe(false);

    t.frame(cursor(true));
    t.frame(cursor(true), maximumCommittableSampleAgeMs + 1);
    expect(t.bridge.rearmRequired).toBe(true);
    expect(t.grabs.release).not.toHaveBeenCalled();
  });

  it("applies a hover cue once per target and clears it when the target changes", () => {
    let cue: GestureHoverCue | undefined;
    const first = { apply: vi.fn(), clear: vi.fn(), key: "first" };
    const second = { apply: vi.fn(), clear: vi.fn(), key: "second" };
    const t = setup({ hoverAt: () => cue });
    cue = first;
    t.frame(cursor(false));
    t.frame(cursor(false));
    expect(first.apply).toHaveBeenCalledTimes(1);
    cue = second;
    t.frame(cursor(false));
    expect(first.clear).toHaveBeenCalledTimes(1);
    expect(second.apply).toHaveBeenCalledTimes(1);
    cue = undefined;
    t.frame(cursor(false));
    expect(second.clear).toHaveBeenCalledTimes(1);
  });

  it("clears the hover cue while pinching", () => {
    const cue = { apply: vi.fn(), clear: vi.fn(), key: "target" };
    const t = setup({ hoverAt: () => cue });
    t.frame(cursor(false));
    t.frame(cursor(true));
    expect(cue.clear).toHaveBeenCalledTimes(1);
  });

  it("does not ask to re-arm when cancelled without it, and resetRearm clears the prompt", () => {
    const t = setup();
    t.bridge.cancel(false);
    expect(t.bridge.rearmRequired).toBe(false);
    expect(t.onRearmChange).not.toHaveBeenCalled();
    t.bridge.cancel(true);
    t.bridge.resetRearm();
    expect(t.bridge.rearmRequired).toBe(false);
    expect(t.onRearmChange).toHaveBeenLastCalledWith(false);
  });

  it("clears every cue when the player leaves", () => {
    const cue = { apply: vi.fn(), clear: vi.fn(), key: "target" };
    const t = setup({ hoverAt: () => cue });
    t.frame(cursor(false));
    const button = actionButton(t.root);
    t.setUnder(button);
    t.frame(cursor(true, 100, 95));
    expect(button).toHaveClass("is-gesture-armed");
    t.bridge.dispose();
    expect(button).not.toHaveClass("is-gesture-armed");
    expect(t.bridge.grabbing).toBe(false);
  });

  describe("open-hand scrolling arbitration", () => {
    const scrollRegion = (root: HTMLElement) => {
      const region = document.createElement("div");
      region.dataset.gestureScrollRegion = "vertical";
      region.getBoundingClientRect = () => rect(0, 0, 300, 300);
      Object.defineProperty(region, "clientHeight", { configurable: true, value: 300 });
      Object.defineProperty(region, "scrollHeight", { configurable: true, value: 900 });
      Object.defineProperty(region, "clientWidth", { configurable: true, value: 300 });
      Object.defineProperty(region, "scrollWidth", { configurable: true, value: 300 });
      region.scrollTop = 0;
      root.append(region);
      return region;
    };
    const wave = (deltaY = 24): GestureCursor => ({
      ...cursor(false, 150, 150),
      fourFingerScroll: {
        active: true,
        axis: "vertical",
        centroid: { clientX: 150, clientY: 150, normalizedX: 0.15, normalizedY: 0.19 },
        deltaX: 0,
        deltaY,
        direction: "down",
        pose: true,
        stableMs: 180,
        strength: 0.8,
        velocityX: 0,
        velocityY: deltaY * 25,
      },
    });

    it("scrolls the region under an open-hand wave", () => {
      const t = setup();
      const region = scrollRegion(t.root);
      t.frame(wave());
      expect(region.scrollTop).toBeGreaterThan(0);
      expect(region).toHaveClass("is-gesture-scrolling-down");
    });

    it("does not scroll while a dialog blocks, or within the pause after a pinch release", () => {
      const t = setup();
      const region = scrollRegion(t.root);
      t.host.blocked = true;
      t.frame(wave());
      expect(region.scrollTop).toBe(0);

      t.host.blocked = false;
      t.frame(cursor(true));
      t.frame(cursor(false));
      t.frame(wave());
      expect(region.scrollTop).toBe(0);
      t.time.advance(400);
      t.frame(wave());
      expect(region.scrollTop).toBeGreaterThan(0);
    });

    it("gives way to a pinch, which clears the scroll cue", () => {
      const t = setup();
      const region = scrollRegion(t.root);
      t.frame(wave());
      expect(region).toHaveClass("is-gesture-scrolling-down");
      t.frame(cursor(true, 150, 150));
      expect(region).not.toHaveClass("is-gesture-scrolling-down");
    });
  });
});
