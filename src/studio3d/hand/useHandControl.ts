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
 *
 * As in the source (`3d-v3/app.js:355-369`), the cursor ring and the plunger meter are moved on
 * every frame directly (`cursorRef`, `meterRef`), and the guide line and badge refresh at most
 * every 150 ms, so tracking never re-renders the player at the camera's frame rate.
 */
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
  stats?: HandStats;
  handName?: string | null;
  backend: string;
  settings: HandSettings;
  preference: Handedness;
}

/** The guide line's refresh period (`app.js:367`, `guideTick`). */
export const GUIDE_REFRESH_MS = 150;

export const useHandControl = (api: HandApi) => {
  const apiRef = useRef(api);
  apiRef.current = api;
  const [state, setState] = useState<HandControlState>(() => ({
    running: false, status: "Camera off. Mouse controls are available.", error: false, profiles: {}, calibrated: false, homeSet: false,
    pinchSeen: false, seenAt: 0, backend: "", settings: handSettings(), preference: "Auto",
  }));
  const patch = useCallback((p: Partial<HandControlState>) => setState((s) => ({ ...s, ...p })), []);
  const guideTick = useRef(0);
  const stats = useRef<{ stats?: HandStats; handName?: string | null }>({});
  const cursorEl = useRef<HTMLSpanElement | null>(null);
  const meterEl = useRef<HTMLElement | null>(null);

  const controller = useMemo(() => new HandController({
    targets: () => apiRef.current.targets(),
    expectedId: () => apiRef.current.expectedId(),
    assist: () => apiRef.current.assist(),
    carrying: () => apiRef.current.carrying(),
    pickUpItem: (id) => apiRef.current.pickUpItem(id),
    pickUpTile: (id, instanceId) => apiRef.current.pickUpTile(id, instanceId),
    squirtMode: () => apiRef.current.squirtMode?.() ?? false,
    squirt: () => apiRef.current.squirt?.(),
    aimCarry: (x, y) => apiRef.current.aimCarry(x, y),
    carryDepth: (d) => apiRef.current.carryDepth(d),
    commitCarry: () => apiRef.current.commitCarry(),
    cancelCarry: () => apiRef.current.cancelCarry(),
    loadTool: () => apiRef.current.loadTool(),
    pressControl: (t) => apiRef.current.pressControl(t),
    pressButton: (t) => apiRef.current.pressButton(t),
    invertTarget: (id) => apiRef.current.invertTarget(id),
    invert: () => apiRef.current.invert(),
    swirlTarget: (id) => apiRef.current.swirlTarget(id),
    swirl: () => apiRef.current.swirl(),
    dropMode: () => apiRef.current.dropMode(),
    drop: () => apiRef.current.drop(),
    runDrops: (on) => apiRef.current.runDrops(on),
    focus: (t: HandTarget | undefined, locked: boolean) => apiRef.current.focus(t, locked),
    say: (text, error, recovery) => apiRef.current.say(text, error, recovery),
    bounds: () => apiRef.current.bounds(),
    blocked: () => apiRef.current.blocked(),
  }), []);

  const hideCursor = () => { if (cursorEl.current) cursorEl.current.hidden = true; };

  const tracker = useMemo(() => new HandTracker({
    bounds: () => apiRef.current.bounds(),
    status: (message, error) => patch({ status: message, error }),
    active: (on) => { if (!on) hideCursor(); patch({ running: on, ...(on ? {} : { pinchSeen: false }) }); },
    // Tracking lost: the motion in progress is dropped and nothing commits; a carried item stays held,
    // as the source keeps its tool (`app.js:358`).
    lost: () => {
      controller.resetMotion();
      hideCursor();
      patch({ seenAt: 0 });
    },
    home: () => patch({ homeSet: true }),
    calibration: (profiles) => patch({ profiles: { ...profiles }, calibrated: Boolean(profiles.rest && profiles.press) }),
    frame: (f: HandFrame) => {
      if (apiRef.current.blocked()) return;
      controller.feed(f);
      // The cursor sits on a locked target and fills with the insertion depth; otherwise it follows the palm (`app.js:364-366`).
      const locked = controller.lockedTarget;
      const el = cursorEl.current;
      if (el) {
        el.hidden = false;
        el.style.left = `${locked ? locked.x : f.x}px`;
        el.style.top = `${locked ? locked.y : f.y}px`;
        el.classList.toggle("is-locked", Boolean(locked));
        el.classList.toggle("is-aiming", !locked && Boolean(controller.target));
        el.classList.toggle("is-pressed", Boolean(f.thumbDown));
        el.style.setProperty("--depth", String(Math.min(1, (controller.contact?.depth ?? 0) / IMMERSED)));
      }
      const now = performance.now();
      if (now - guideTick.current >= GUIDE_REFRESH_MS) {
        guideTick.current = now;
        patch({ seenAt: now, stats: stats.current.stats, handName: stats.current.handName });
      }
    },
    edge: (edge, f) => {
      if (edge === "press" && f.pinch) setState((s) => (s.pinchSeen ? s : { ...s, pinchSeen: true }));
      if (apiRef.current.blocked()) return;
      if (edge === "press") controller.press(f); else controller.release();
    },
    meter: (f, frameStats, name) => {
      if (meterEl.current) meterEl.current.style.width = `${Math.round(Math.min(1, Math.max(0, f.thumbDepth ?? 0)) * 100)}%`;
      stats.current = { stats: { ...frameStats }, handName: name };
    },
  }), [controller, patch]);

  // Changing a hand setting drops the motion in progress, as the source does (`app.js:427`); a carried item stays held.
  useEffect(() => onHandSettings((settings) => {
    patch({ settings });
    controller.resetMotion();
    if (settings.mode !== tracker.mode) { tracker.setMode(settings.mode); patch({ pinchSeen: false, calibrated: tracker.calibrated }); }
  }), [controller, patch, tracker]);

  useEffect(() => () => tracker.stop(), [tracker]);

  const start = useCallback(() => {
    controller.resetMotion();
    patch({ error: false, homeSet: false });
    void tracker.start().then(() => patch({ backend: tracker.backend, calibrated: tracker.calibrated }));
  }, [controller, patch, tracker]);
  const stop = useCallback(() => { if (tracker.running) tracker.stop(); }, [tracker]);
  const capture = useCallback((kind: "rest" | "press") => { controller.resetMotion(); tracker.capture(kind); }, [controller, tracker]);
  // `app.js:425`: the hand's position now becomes the centre of the bench view.
  const setHome = useCallback(() => {
    controller.resetMotion();
    if (tracker.setHome()) { patch({ homeSet: true }); apiRef.current.say("Centre set. Small hand movements now cover the bench."); }
  }, [controller, patch, tracker]);
  const setPreference = useCallback((value: Handedness) => { tracker.setPreference(value); patch({ preference: value }); }, [patch, tracker]);
  const videoRef = useCallback((el: HTMLVideoElement | null) => { if (el) tracker.video = el; }, [tracker]);
  const overlayRef = useCallback((el: HTMLCanvasElement | null) => { if (el) tracker.overlay = el; }, [tracker]);
  const cursorRef = useCallback((el: HTMLSpanElement | null) => { cursorEl.current = el; }, []);
  const meterRef = useCallback((el: HTMLElement | null) => { meterEl.current = el; }, []);

  return { state, controller, tracker, start, stop, capture, setHome, setPreference, videoRef, overlayRef, cursorRef, meterRef };
};

export type HandControl = ReturnType<typeof useHandControl>;
