import { clamp } from "./handCore";

/**
 * Hand-control settings, transcribed from the DNA microarray 3D lab's `3d-v3/hand-tuning.js`
 * (decided 2026-10-04). A per-viewer preference kept in this browser (a UI preference only, never
 * camera data or run state; handoff §3.8, G-13):
 * - mode: "thumb", a calibrated thumb press on the plunger (the default), or "pinch", a
 *   thumb-to-index pinch with no calibration;
 * - gain: how far the cursor travels for a hand movement (1–4);
 * - smoothing: 0 most responsive, 1 steadiest;
 * - assist: bigger hand hit areas and snapping to the step's next target.
 * The thresholds stay fixed. Insertion always uses the untouched palm coordinates; these settings
 * only change the cursor.
 */
export interface HandSettings {
  mode: "thumb" | "pinch";
  gain: number;
  smoothing: number;
  assist: boolean;
}

export const HAND_SETTINGS_KEY = "lab-studio:3d:v1:hand";
export const HAND_DEFAULTS: HandSettings = { mode: "thumb", gain: 2.2, smoothing: 0.5, assist: true };

export const sanitizeHandSettings = (s: Partial<HandSettings> & Record<string, unknown>): HandSettings => ({
  mode: s.mode === "pinch" ? "pinch" : "thumb",
  gain: clamp(Number(s.gain) || HAND_DEFAULTS.gain, 1, 4),
  smoothing: clamp(Number.isFinite(Number(s.smoothing)) ? Number(s.smoothing) : HAND_DEFAULTS.smoothing, 0, 1),
  assist: s.assist !== false,
});

/** One Euro parameters for a smoothing value: steadier means a lower cutoff and a gentler speed response. */
export const filterParams = (smoothing: number) => ({ minCutoff: 3.2 - 2.8 * smoothing, beta: 9 - 6 * smoothing });

export const smoothingLabel = (smoothing: number) => (smoothing < 0.34 ? "Quick" : smoothing < 0.67 ? "Balanced" : "Steady");

let settings: HandSettings = (() => {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(HAND_SETTINGS_KEY) ?? "null");
    return saved ? sanitizeHandSettings({ ...HAND_DEFAULTS, ...saved }) : { ...HAND_DEFAULTS };
  } catch {
    return { ...HAND_DEFAULTS };
  }
})();
const listeners = new Set<(s: HandSettings) => void>();

export const handSettings = (): HandSettings => ({ ...settings });

export const setHandSettings = (patch: Partial<HandSettings>): void => {
  settings = sanitizeHandSettings({ ...settings, ...patch });
  try { globalThis.localStorage?.setItem(HAND_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage is optional */ }
  listeners.forEach((listener) => listener(handSettings()));
};

export const onHandSettings = (listener: (s: HandSettings) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
