import { useCallback, useSyncExternalStore } from "react";

/**
 * Lab Studio 3D's two themes (you, 2026-10-12: "make two themes: 1. Everything the old light one and 2. Everything the
 * HUD look."). `light` is the original pale look; `hud` is the sci-fi HUD the step card and dock first wore, on every
 * 3D surface (hud.css). The theme is set as `data-theme` on each `.s3d` root (Studio3DApp), and tokens.css remaps the
 * colour tokens under it. One preference serves the gate, the Player and the Studio, kept apart from the Player's and
 * the Studio's own UI preferences, so a switch in either changes both.
 */
export type Studio3DTheme = "hud" | "light";
export const STUDIO3D_THEMES: readonly Studio3DTheme[] = ["hud", "light"];
export const THEME_KEY = "lab-studio:3d:v1:theme";
/** The HUD, the latest look you asked for. */
export const DEFAULT_THEME: Studio3DTheme = "hud";
export const THEME_LABELS: Record<Studio3DTheme, string> = { hud: "HUD", light: "Light" };

const CHANGE = "lab-studio:3d:theme";
// Without storage the choice still holds for this page.
let memory: Studio3DTheme | undefined;

const isTheme = (value: unknown): value is Studio3DTheme => value === "hud" || value === "light";

export const readTheme = (): Studio3DTheme => {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_KEY);
    if (isTheme(saved)) return saved;
  } catch { /* the 3D app works without storage */ }
  return memory ?? DEFAULT_THEME;
};

export const writeTheme = (theme: Studio3DTheme) => {
  memory = theme;
  try { globalThis.localStorage?.setItem(THEME_KEY, theme); } catch { /* storage is optional; the switch still applies */ }
  globalThis.dispatchEvent?.(new Event(CHANGE));
};

const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === THEME_KEY) onChange(); };
  globalThis.addEventListener?.(CHANGE, onChange);
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    globalThis.removeEventListener?.(CHANGE, onChange);
    globalThis.removeEventListener?.("storage", onStorage);
  };
};

/** The theme in use and a setter; every caller follows a change, in this tab or another. */
export const useStudio3DTheme = (): [Studio3DTheme, (theme: Studio3DTheme) => void] => {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return [theme, useCallback((next: Studio3DTheme) => writeTheme(next), [])];
};
