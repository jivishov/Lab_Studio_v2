import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HandFrame } from "./handCore";
import { HandController, IMMERSED, type HandApi, type HandTarget } from "./handController";
import { HandTracker, type CalibrationProfiles, type Handedness, type HandStats } from "./handTracker";
import { handSettings, onHandSettings, type HandSettings } from "./handTuning";

/**
 * Player3D's hand control (decided 2026-10-03/04; `proposals/MICROARRAY_ADOPTION.md` §7): the DNA
 * microarray 3D lab's webcam pipeline (`HandTracker`) feeding its controller (`HandController`),
 * with the state its panel and cursor show. `api` is read on every frame, so the caller passes the
 * current bench, carry and step through it without restarting the camera.
 */
export interface HandCursor {
  x: number;
  y: number;
  /** Aiming at a target, locked on one (with the insertion depth, 0..1), and the plunger pressed. */
  aiming: boolean;
  locked: boolean;
  depth: number;
  pressed: boolean;
}

export interface HandControlState {
  running: boolean;
  status: string;
  error: boolean;
  profiles: CalibrationProfiles;
  calibrated: boolean;
  homeSet: boolean;
  pinchSeen: boolean;
  /** When the hand was last seen (performance.now()), for "No hand". */
  seenAt: number;
  thumbDepth: number;
  stats?: HandStats;
  handName?: string | null;
  backend: string;
  cursor?: HandCursor;
  settings: HandSettings;
  preference: Handedness;
}

export const useHandControl = (api: HandApi) => {
  const apiRef = useRef(api);
  apiRef.current = api;
  const [state, setState] = useState<HandControlState>(() => ({
    running: false, status: "Camera off. Mouse controls are available.", error: false, profiles: {}, calibrated: false, homeSet: false,
    pinchSeen: false, seenAt: 0, thumbDepth: 0, backend: "", settings: handSettings(), preference: "Auto",
  }));
  const patch = useCallback((p: Partial<HandControlState>) => setState((s) => ({ ...s, ...p })), []);
  const lastCursor = useRef(0);

  const controller = useMemo(() => new HandController({
    targets: () => apiRef.current.targets(),
    expectedId: () => apiRef.current.expectedId(),
    assist: () => apiRef.current.assist(),
    carrying: () => apiRef.current.carrying(),
    pickUpItem: (id) => apiRef.current.pickUpItem(id),
    pickUpTile: (id) => apiRef.current.pickUpTile(id),
    aimCarry: (x, y) => apiRef.current.aimCarry(x, y),
    carryDepth: (d) => apiRef.current.carryDepth(d),
    commitCarry: () => apiRef.current.commitCarry(),
    cancelCarry: () => apiRef.current.cancelCarry(),
    loadTool: () => apiRef.current.loadTool(),
    pressControl: (t) => apiRef.current.pressControl(t),
    pressButton: (t) => apiRef.current.pressButton(t),
    invertTarget: (id) => apiRef.current.invertTarget(id),
    invert: () => apiRef.current.invert(),
    dropMode: () => apiRef.current.dropMode(),
    drop: () => apiRef.current.drop(),
    runDrops: (on) => apiRef.current.runDrops(on),
    focus: (t: HandTarget | undefined, locked: boolean) => apiRef.current.focus(t, locked),
    say: (text, error) => apiRef.current.say(text, error),
    bounds: () => apiRef.current.bounds(),
    blocked: () => apiRef.current.blocked(),
  }), []);

  const tracker = useMemo(() => new HandTracker({
    bounds: () => apiRef.current.bounds(),
    status: (message, error) => patch({ status: message, error }),
    active: (on) => patch({ running: on, ...(on ? {} : { cursor: undefined, pinchSeen: false }) }),
    lost: () => {
      if (apiRef.current.carrying()) apiRef.current.cancelCarry();
      controller.resetMotion();
      patch({ cursor: undefined, seenAt: 0 });
    },
    home: () => patch({ homeSet: true }),
    calibration: (profiles) => patch({ profiles: { ...profiles }, calibrated: Boolean(profiles.rest && profiles.press) }),
    frame: (f: HandFrame) => {
      if (apiRef.current.blocked()) return;
      controller.feed(f);
      // The cursor sits on a locked target and fills with the insertion depth; otherwise it follows the palm.
      const locked = controller.contact?.target;
      const cursor: HandCursor = locked
        ? { x: locked.x, y: locked.y, aiming: false, locked: true, depth: Math.min(1, (controller.contact?.depth ?? 0) / IMMERSED), pressed: Boolean(f.thumbDown) }
        : { x: f.x, y: f.y, aiming: Boolean(controller.target), locked: false, depth: 0, pressed: Boolean(f.thumbDown) };
      const now = performance.now();
      if (now - lastCursor.current > 33) { lastCursor.current = now; patch({ cursor, seenAt: now }); }
    },
    edge: (edge, f) => {
      if (edge === "press" && f.pinch) setState((s) => (s.pinchSeen ? s : { ...s, pinchSeen: true }));
      if (apiRef.current.blocked()) return;
      if (edge === "press") controller.press(f); else controller.release();
    },
    meter: (f, stats, name) => patch({ thumbDepth: f.thumbDepth ?? 0, stats: { ...stats }, handName: name }),
  }), [controller, patch]);

  useEffect(() => onHandSettings((settings) => {
    patch({ settings });
    if (apiRef.current.carrying()) apiRef.current.cancelCarry();
    controller.resetMotion();
    if (settings.mode !== tracker.mode) { tracker.setMode(settings.mode); patch({ pinchSeen: false, calibrated: tracker.calibrated }); }
  }), [controller, patch, tracker]);

  useEffect(() => () => tracker.stop(), [tracker]);

  const start = useCallback(() => {
    if (apiRef.current.carrying()) apiRef.current.cancelCarry();
    controller.resetMotion();
    patch({ error: false, homeSet: false });
    void tracker.start().then(() => patch({ backend: tracker.backend, calibrated: tracker.calibrated }));
  }, [controller, patch, tracker]);
  const stop = useCallback(() => { if (tracker.running) tracker.stop(); }, [tracker]);
  const capture = useCallback((kind: "rest" | "press") => { controller.resetMotion(); tracker.capture(kind); }, [controller, tracker]);
  const setHome = useCallback(() => { controller.resetMotion(); if (tracker.setHome()) patch({ homeSet: true }); }, [controller, patch, tracker]);
  const setPreference = useCallback((value: Handedness) => { tracker.setPreference(value); patch({ preference: value }); }, [patch, tracker]);
  const videoRef = useCallback((el: HTMLVideoElement | null) => { if (el) tracker.video = el; }, [tracker]);
  const overlayRef = useCallback((el: HTMLCanvasElement | null) => { if (el) tracker.overlay = el; }, [tracker]);

  return { state, controller, tracker, start, stop, capture, setHome, setPreference, videoRef, overlayRef };
};

export type HandControl = ReturnType<typeof useHandControl>;
