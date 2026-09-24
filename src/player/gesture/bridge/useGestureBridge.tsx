import { useEffect, useRef, type RefObject } from "react";
import type { GestureFrameSnapshot, GestureFrameSource } from "../gestureTypes";
import { GestureBridge } from "./gestureBridge";

/**
 * One bridge per player. The player assigns `bridge.host` during every render, once its resolver
 * and grab handlers exist, so the bridge always resolves and commits against the player's latest
 * state. While camera control is on, pointer, touch or keyboard input inside the player cancels an
 * unfinished gesture without committing; leaving the player clears every cue and stops the camera.
 */
export const useGestureBridge = <TGrab,>({
  enabled,
  root,
  stop,
}: {
  enabled: boolean;
  root: RefObject<HTMLElement | null>;
  stop: () => void;
}): GestureBridge<TGrab> => {
  const bridgeRef = useRef<GestureBridge<TGrab> | null>(null);
  if (!bridgeRef.current) bridgeRef.current = new GestureBridge<TGrab>();
  const bridge = bridgeRef.current;

  useEffect(() => {
    const element = root.current;
    if (!element || !enabled) return undefined;
    const interruptGestureMode = () => {
      bridge.cancel(true);
      bridge.cancelScroll();
    };
    element.addEventListener("pointerdown", interruptGestureMode, true);
    element.addEventListener("touchstart", interruptGestureMode, true);
    element.addEventListener("keydown", interruptGestureMode, true);
    return () => {
      element.removeEventListener("pointerdown", interruptGestureMode, true);
      element.removeEventListener("touchstart", interruptGestureMode, true);
      element.removeEventListener("keydown", interruptGestureMode, true);
    };
  }, [bridge, enabled, root]);

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  useEffect(
    () => () => {
      bridge.dispose();
      stopRef.current();
    },
    [bridge],
  );

  return bridge;
};

/**
 * The fixed gesture cursor. Frames are handled here, off React state: the bridge runs first, then
 * the cursor moves by a direct transform and shows the pinch, grab, held-tracking and re-arm states.
 */
export const GestureCursorOverlay = <TGrab,>({
  blocked,
  bridge,
  enabled,
  frames,
}: {
  blocked: boolean;
  bridge: GestureBridge<TGrab>;
  enabled: boolean;
  frames: GestureFrameSource;
}) => {
  const cursorElementRef = useRef<HTMLSpanElement | null>(null);
  const metricFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const renderSnapshot = (snapshot: GestureFrameSnapshot) => {
      const element = cursorElementRef.current;
      const cursor = snapshot.cursor;
      bridge.handleFrame(snapshot);
      if (!element || !enabled || blocked || !cursor) {
        if (element) element.hidden = true;
        return;
      }
      element.hidden = false;
      element.style.transform = `translate3d(${cursor.clientX}px, ${cursor.clientY}px, 0) translate(-50%, -50%)`;
      element.classList.toggle("is-pinching", cursor.pinching);
      element.classList.toggle("is-grabbing", bridge.grabbing);
      element.classList.toggle("is-tracking-held", cursor.tracking === "held");
      element.classList.toggle("is-rearm-required", bridge.rearmRequired);
      if (metricFrameRef.current !== undefined) window.cancelAnimationFrame(metricFrameRef.current);
      metricFrameRef.current = window.requestAnimationFrame(() => {
        metricFrameRef.current = undefined;
        frames.markCursorRendered(snapshot.frameId, performance.now());
      });
    };
    const unsubscribe = frames.subscribe(renderSnapshot);
    renderSnapshot(frames.getSnapshot());
    return () => {
      unsubscribe();
      if (metricFrameRef.current !== undefined) window.cancelAnimationFrame(metricFrameRef.current);
    };
  }, [blocked, bridge, enabled, frames]);

  return <span ref={cursorElementRef} aria-hidden="true" className="gesture-cursor" hidden />;
};
