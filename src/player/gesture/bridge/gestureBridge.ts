import { maximumCommittableSampleAgeMs, type GestureCursor } from "../gestureMath";
import {
  applyGestureScrollIntent,
  gestureScrollDwellMs,
  gestureScrollIntentFromSignal,
  gestureScrollReleasePauseMs,
  resolveGestureScrollIntent,
  resolveGestureScrollTarget,
  type GestureScrollIntent,
  type GestureScrollTarget,
} from "../gestureScroll";
import type { GestureFrameSnapshot } from "../gestureTypes";

/**
 * The shared camera-gesture interaction bridge (plan D6). It turns the recognition engine's cursor
 * frames into grab, preview, commit-on-release, re-arm and scroll arbitration, and knows nothing
 * about what is being grabbed: a player supplies a target resolver (what is under the cursor) and
 * grab handlers (how its own preview follows and how its normal pointer path commits). The 2D
 * Student Player uses the DOM resolver; Player3D adds a raycast resolver behind its bench canvas.
 * Nothing commits while a pinch is held; a release commits once, through the player's handlers.
 */

/** An open hand must be tracked this long before camera input re-arms after a cancel. */
export const gestureRearmOpenMs = 120;
/** A whitelisted action fires when the pinch releases within this distance of the button it started on. */
export const gestureActionReleaseTolerancePx = 8;
/** Two action activations closer together than this are treated as one. */
export const gestureActionRepeatGuardMs = 450;
/** Only buttons that opt in with `data-gesture-action` can be activated by a pinch. */
export const gestureActionButtonSelector = "button[data-gesture-action]";

/** What a pinch start found under the cursor, as the player's resolver judges it. */
export type GestureGrabResolution<TGrab> =
  | { kind: "grab"; grab: TGrab }
  /** Equipment was under the cursor but cannot be picked up now; nothing else is tried. */
  | { kind: "blocked" };

/** The hover cue on the eligible target under an open-hand cursor. */
export interface GestureHoverCue {
  /** Two cues with the same key are the same target. */
  key: unknown;
  apply: () => void;
  clear: () => void;
}

/** What is under the cursor. The 2D player's is DOM-only; Player3D adds a raycast behind its canvas. */
export interface GestureTargetResolver<TGrab> {
  /** The element under the cursor, if any (`document.elementFromPoint`). */
  elementAt: (cursor: GestureCursor) => Element | undefined;
  /** Whether an element belongs to this player. */
  contains: (element: Element) => boolean;
  /**
   * The equipment a pinch starting on `element` picks up. Undefined when `element` is not equipment,
   * so the bridge tries whitelisted action buttons next.
   */
  grabAt: (element: Element, cursor: GestureCursor) => GestureGrabResolution<TGrab> | undefined;
  /** The hover cue for the eligible target under an open-hand cursor, if any. */
  hoverAt: (cursor: GestureCursor) => GestureHoverCue | undefined;
}

/** How a player shows and commits a grab. Every commit goes through the player's normal pointer path. */
export interface GestureGrabHandlers<TGrab> {
  /** A pinch picked `grab` up: show it attached to the pinch point. */
  begin: (grab: TGrab, cursor: GestureCursor) => void;
  /** The pinch moved: the grabbed object follows. Never commits. */
  move: (grab: TGrab, cursor: GestureCursor) => void;
  /** The pinch was released: clear the preview, then commit through the normal runtime path. */
  release: (grab: TGrab, cursor: GestureCursor) => void;
  /** Drop any preview without committing. */
  clear: () => void;
}

export interface GestureBridgeHost<TGrab> {
  resolver: GestureTargetResolver<TGrab>;
  grabs: GestureGrabHandlers<TGrab>;
  /** A blocking dialog is open: gestures cancel and scrolling stops. */
  blocked: boolean;
  /** The player's root, read at scroll time, where open-hand scrolling looks for scroll regions. */
  scrollRoot: () => ParentNode | null;
  /** Called whenever the bridge asks the learner to re-arm (true) or re-arming completes (false). May repeat. */
  onRearmChange: (required: boolean) => void;
}

export interface GestureBridgeClock {
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
}

const browserClock: GestureBridgeClock = {
  now: () => performance.now(),
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
};

/** A host that does nothing, until a player assigns its own during render. */
export const inertGestureBridgeHost = <TGrab>(): GestureBridgeHost<TGrab> => ({
  blocked: false,
  grabs: { begin: () => undefined, clear: () => undefined, move: () => undefined, release: () => undefined },
  onRearmChange: () => undefined,
  resolver: {
    contains: () => false,
    elementAt: () => undefined,
    grabAt: () => undefined,
    hoverAt: () => undefined,
  },
  scrollRoot: () => null,
});

type ActiveGesture<TGrab> =
  | { kind: "grab"; grab: TGrab }
  | { kind: "button"; button: HTMLButtonElement; startClientX: number; startClientY: number };

export class GestureBridge<TGrab> {
  /** The player assigns this on every render, so handlers always see its latest state. */
  host: GestureBridgeHost<TGrab>;
  private readonly clock: GestureBridgeClock;
  private active: ActiveGesture<TGrab> | undefined;
  private grabbingState = false;
  private rearmRequiredState = false;
  private rearmOpenSince: number | undefined;
  private previousCursor: GestureCursor | undefined;
  private buttonCue: HTMLButtonElement | undefined;
  private hoverCue: GestureHoverCue | undefined;
  private lastButtonActivationAt = 0;
  private lastPinchReleaseAt = Number.NEGATIVE_INFINITY;
  private scrollFrame: number | undefined;
  private scrollEdge: { firstSeenAt: number; intent: GestureScrollIntent; key: string } | undefined;
  private scrollCue: { className: string; target: Element } | undefined;
  private waveScroll: { target: GestureScrollTarget } | undefined;

  constructor(host: GestureBridgeHost<TGrab> = inertGestureBridgeHost<TGrab>(), clock: GestureBridgeClock = browserClock) {
    this.host = host;
    this.clock = clock;
  }

  /** Whether a pinch holds equipment or an action button (the cursor's grabbing state). */
  get grabbing(): boolean {
    return this.grabbingState;
  }

  /** Whether camera input waits for an open hand before it acts again. */
  get rearmRequired(): boolean {
    return this.rearmRequiredState;
  }

  /** The grab the current pinch holds, if any. */
  get activeGrab(): TGrab | undefined {
    return this.active?.kind === "grab" ? this.active.grab : undefined;
  }

  /** One recognition frame. Pinch start grabs, a held pinch previews, release commits once. */
  handleFrame(snapshot: GestureFrameSnapshot): void {
    const current = snapshot.cursor;
    const previous = this.previousCursor;
    if (this.host.blocked) {
      if (this.active || previous?.pinching) this.cancel(true);
      this.cancelScroll();
      return;
    }

    if (this.rearmRequiredState) {
      this.cancelScroll();
      this.clearHoverCue();
      if (current?.tracking === "tracked" && !current.pinching) {
        const openSince = this.rearmOpenSince ?? snapshot.frameTimeMs;
        this.rearmOpenSince = openSince;
        if (snapshot.frameTimeMs - openSince >= gestureRearmOpenMs) {
          this.rearmRequiredState = false;
          this.rearmOpenSince = undefined;
          this.host.onRearmChange(false);
        }
      } else {
        this.rearmOpenSince = undefined;
      }
      this.previousCursor = current;
      return;
    }

    if (!current) {
      if (previous?.pinching || this.active) this.cancel(true);
      this.clearHoverCue();
      this.previousCursor = undefined;
      this.handleScroll(undefined);
      return;
    }

    if (current.tracking === "held") {
      this.previousCursor = current;
      this.clearHoverCue();
      this.cancelScroll();
      return;
    }

    if (this.clock.now() - snapshot.sampleStartedAtMs > maximumCommittableSampleAgeMs) {
      const stalePinchWasActive = Boolean(current.pinching || previous?.pinching || this.active);
      if (stalePinchWasActive) {
        this.cancel(true);
      } else {
        this.previousCursor = undefined;
        this.clearHoverCue();
      }
      this.cancelScroll();
      return;
    }

    if (!previous?.pinching && current.pinching) {
      this.clearHoverCue();
      this.start(current);
      this.previousCursor = current;
      this.cancelScroll();
      return;
    }
    if (current.pinching) {
      this.clearHoverCue();
      if (this.active?.kind === "grab") this.host.grabs.move(this.active.grab, current);
      this.previousCursor = current;
      this.cancelScroll();
      return;
    }
    if (previous?.pinching && !current.pinching) this.complete(current);
    this.previousCursor = current;
    if (this.updateHoverCue(current)) this.cancelScroll();
    else this.handleScroll(current);
  }

  /** Cancel an unfinished gesture without committing; by default camera input must then re-arm. */
  cancel(requireRearm = true): void {
    this.active = undefined;
    this.grabbingState = false;
    this.previousCursor = undefined;
    this.clearButtonCue();
    this.clearHoverCue();
    this.host.grabs.clear();
    if (requireRearm) {
      this.rearmRequiredState = true;
      this.rearmOpenSince = undefined;
      this.host.onRearmChange(true);
    }
  }

  /** Starting camera control again needs no re-arm. */
  resetRearm(): void {
    this.rearmRequiredState = false;
    this.rearmOpenSince = undefined;
    this.host.onRearmChange(false);
  }

  /** Stop any open-hand scrolling and clear its cue. */
  cancelScroll(): void {
    if (this.scrollFrame !== undefined) {
      this.clock.cancelFrame(this.scrollFrame);
      this.scrollFrame = undefined;
    }
    this.scrollEdge = undefined;
    this.waveScroll = undefined;
    this.clearScrollCue();
  }

  /** The player is leaving: drop all gesture state and cues. */
  dispose(): void {
    this.active = undefined;
    this.grabbingState = false;
    this.previousCursor = undefined;
    this.buttonCue?.classList.remove("is-gesture-armed");
    this.hoverCue?.clear();
    this.cancelScroll();
  }

  private start(cursor: GestureCursor): void {
    const { resolver, grabs } = this.host;
    const element = resolver.elementAt(cursor);
    this.active = undefined;
    this.grabbingState = false;
    this.clearButtonCue();
    if (!element || !resolver.contains(element)) {
      this.active = undefined;
      grabs.clear();
      return;
    }

    const resolution = resolver.grabAt(element, cursor);
    if (resolution?.kind === "grab") {
      this.active = { kind: "grab", grab: resolution.grab };
      this.grabbingState = true;
      grabs.begin(resolution.grab, cursor);
      return;
    }
    if (resolution?.kind === "blocked") {
      grabs.clear();
      return;
    }

    const button = element.closest<HTMLButtonElement>(gestureActionButtonSelector);
    if (button && resolver.contains(button) && !button.disabled) {
      this.active = {
        button,
        kind: "button",
        startClientX: cursor.clientX,
        startClientY: cursor.clientY,
      };
      this.grabbingState = true;
      this.armButtonCue(button);
    } else {
      this.active = undefined;
      this.grabbingState = false;
    }
    grabs.clear();
  }

  private complete(cursor: GestureCursor): void {
    this.lastPinchReleaseAt = this.clock.now();
    const active = this.active;
    this.active = undefined;
    this.grabbingState = false;
    this.clearButtonCue();
    if (active?.kind === "grab") {
      this.host.grabs.release(active.grab, cursor);
      return;
    }
    this.host.grabs.clear();
    const element = this.host.resolver.elementAt(cursor);
    if (active?.kind === "button") this.activateButton(active, cursor, element);
  }

  private activateButton(
    active: Extract<ActiveGesture<TGrab>, { kind: "button" }>,
    cursor: GestureCursor,
    element: Element | undefined,
  ): boolean {
    const button = active.button;
    if (!button || !this.host.resolver.contains(button) || button.disabled) return false;
    const releaseButton = element?.closest<HTMLButtonElement>(gestureActionButtonSelector);
    const rect = button.getBoundingClientRect();
    const releaseNearOriginalButton =
      cursor.clientX >= rect.left - gestureActionReleaseTolerancePx &&
      cursor.clientX <= rect.right + gestureActionReleaseTolerancePx &&
      cursor.clientY >= rect.top - gestureActionReleaseTolerancePx &&
      cursor.clientY <= rect.bottom + gestureActionReleaseTolerancePx;
    if (releaseButton !== button && !releaseNearOriginalButton) return false;
    const now = this.clock.now();
    if (now - this.lastButtonActivationAt < gestureActionRepeatGuardMs) return false;
    this.lastButtonActivationAt = now;
    button.click();
    return true;
  }

  private clearButtonCue(): void {
    this.buttonCue?.classList.remove("is-gesture-armed");
    this.buttonCue = undefined;
  }

  private armButtonCue(button: HTMLButtonElement): void {
    this.clearButtonCue();
    button.classList.add("is-gesture-armed");
    this.buttonCue = button;
  }

  private clearHoverCue(): void {
    this.hoverCue?.clear();
    this.hoverCue = undefined;
  }

  /** Cue the eligible target under an open hand; returns whether there is one (it suppresses edge scrolling). */
  private updateHoverCue(cursor: GestureCursor): boolean {
    const cue = this.host.resolver.hoverAt(cursor);
    if (!cue) {
      this.clearHoverCue();
      return false;
    }
    if (this.hoverCue?.key === cue.key) return true;
    this.clearHoverCue();
    cue.apply();
    this.hoverCue = cue;
    return true;
  }

  private clearScrollCue(): void {
    const cue = this.scrollCue;
    if (!cue) return;
    cue.target.classList.remove(cue.className);
    this.scrollCue = undefined;
  }

  private setScrollCue(intent: GestureScrollIntent): void {
    const current = this.scrollCue;
    if (current?.target === intent.target && current.className === intent.className) return;
    this.clearScrollCue();
    intent.target.classList.add(intent.className);
    this.scrollCue = {
      className: intent.className,
      target: intent.target,
    };
  }

  private cancelEdgeScroll(): void {
    if (this.scrollFrame !== undefined) {
      this.clock.cancelFrame(this.scrollFrame);
      this.scrollFrame = undefined;
    }
    this.scrollEdge = undefined;
  }

  private readonly runScrollFrame = (): void => {
    const edge = this.scrollEdge;
    if (!edge) {
      this.scrollFrame = undefined;
      this.clearScrollCue();
      return;
    }
    this.setScrollCue(edge.intent);
    if (this.clock.now() - edge.firstSeenAt >= gestureScrollDwellMs) {
      if (!applyGestureScrollIntent(edge.intent)) {
        this.cancelScroll();
        return;
      }
    }
    this.scrollFrame = this.clock.requestFrame(this.runScrollFrame);
  };

  /** Open-hand scrolling: only when not pinching, no target is held, no dialog blocks, and the release pause has passed. */
  private handleScroll(cursor: GestureCursor | undefined): void {
    const now = this.clock.now();
    const { blocked } = this.host;
    const scrollRoot = this.host.scrollRoot();
    const scrollDisabled =
      !cursor ||
      cursor.pinching ||
      Boolean(this.active) ||
      blocked ||
      now - this.lastPinchReleaseAt < gestureScrollReleasePauseMs;
    if (scrollDisabled) {
      this.cancelScroll();
      return;
    }

    const waveScroll = cursor.fourFingerScroll;
    if (waveScroll) {
      this.cancelEdgeScroll();
      if (!waveScroll.active || !waveScroll.axis) {
        this.waveScroll = undefined;
        this.clearScrollCue();
        return;
      }

      if (!waveScroll.pose) {
        this.clearScrollCue();
        return;
      }

      const currentTarget = this.waveScroll?.target;
      const waveTargetCursor: GestureCursor = {
        ...cursor,
        clientX: waveScroll.centroid.clientX,
        clientY: waveScroll.centroid.clientY,
        normalizedX: waveScroll.centroid.normalizedX,
        normalizedY: waveScroll.centroid.normalizedY,
      };
      const target =
        currentTarget && currentTarget.axis === waveScroll.axis && document.contains(currentTarget.target)
          ? currentTarget
          : resolveGestureScrollTarget({
              axis: waveScroll.axis,
              cursor: waveTargetCursor,
              dialogOpen: blocked,
              pinching: cursor.pinching,
              root: scrollRoot,
            });
      if (!target) {
        this.waveScroll = undefined;
        this.clearScrollCue();
        return;
      }

      this.waveScroll = { target };
      const intent = gestureScrollIntentFromSignal({
        signal: waveScroll,
        target,
      });
      if (!intent) {
        this.clearScrollCue();
        return;
      }
      if (applyGestureScrollIntent(intent)) {
        this.setScrollCue(intent);
        return;
      }
      this.clearScrollCue();
      return;
    }

    this.waveScroll = undefined;

    const intent = resolveGestureScrollIntent({
      cursor,
      dialogOpen: blocked,
      pinching: cursor.pinching,
      root: scrollRoot,
    });
    if (!intent) {
      this.cancelScroll();
      return;
    }

    const existing = this.scrollEdge;
    if (!existing || existing.key !== intent.key || existing.intent.target !== intent.target) {
      this.scrollEdge = {
        firstSeenAt: now,
        intent,
        key: intent.key,
      };
    } else {
      existing.intent = intent;
    }
    this.setScrollCue(intent);
    if (this.scrollFrame === undefined) {
      this.scrollFrame = this.clock.requestFrame(this.runScrollFrame);
    }
  }
}
