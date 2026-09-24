/**
 * Player3D's floating-panel layout (handoff §5.1): panels move by the header, resize from any
 * corner and collapse, and the layout is remembered under the player's UI key (§3.8), never with
 * run state (G-13). Pure, so the rules can be tested without a browser.
 */
export type PanelId = "step" | "tray" | "list";
export const PANEL_IDS: readonly PanelId[] = ["step", "tray", "list"];

export interface PanelBox {
  /** Offset from the player's top-left corner, px. */
  x: number;
  y: number;
  /** Size, px; absent keeps the panel's natural size. */
  w?: number;
  h?: number;
}

export interface PanelState {
  box?: PanelBox;
  collapsed?: boolean;
}

export type PanelLayout = Partial<Record<PanelId, PanelState>>;

export interface Viewport {
  width: number;
  height: number;
}

export const PANEL_MIN = Object.freeze({ w: 240, h: 96 });
/** The top bar the panels never cover (§5.1). */
export const PANEL_TOP = 52;
/** Panels float from the laptop layout up; below it they become sheets (handoff §7). */
export const MOVABLE_FROM_WIDTH = 1024;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Whatever storage returns, keep only well-formed entries for known panels. */
export const sanitizeLayout = (raw: unknown): PanelLayout => {
  if (!raw || typeof raw !== "object") return {};
  const layout: PanelLayout = {};
  for (const id of PANEL_IDS) {
    const entry = (raw as Record<string, unknown>)[id];
    if (!entry || typeof entry !== "object") continue;
    const { box, collapsed } = entry as { box?: Record<string, unknown>; collapsed?: unknown };
    const state: PanelState = {};
    if (box && typeof box === "object" && finite(box.x) && finite(box.y)) {
      state.box = { x: box.x, y: box.y, ...(finite(box.w) ? { w: box.w } : {}), ...(finite(box.h) ? { h: box.h } : {}) };
    }
    if (collapsed === true) state.collapsed = true;
    if (state.box || state.collapsed) layout[id] = state;
  }
  return layout;
};

/**
 * Keep a panel inside the player, below the top bar and at no less than the minimum size.
 * `natural` is the panel's measured size, used when the box keeps the natural size.
 */
export const clampBox = (box: PanelBox, natural: { w: number; h: number }, viewport: Viewport): PanelBox => {
  const w = Math.min(Math.max(box.w ?? natural.w, PANEL_MIN.w), viewport.width);
  const h = Math.min(Math.max(box.h ?? natural.h, PANEL_MIN.h), Math.max(PANEL_MIN.h, viewport.height - PANEL_TOP));
  return {
    x: Math.min(Math.max(0, box.x), Math.max(0, viewport.width - w)),
    y: Math.min(Math.max(PANEL_TOP, box.y), Math.max(PANEL_TOP, viewport.height - h)),
    ...(box.w !== undefined ? { w } : {}),
    ...(box.h !== undefined ? { h } : {}),
  };
};

export type Corner = "nw" | "ne" | "sw" | "se";
export const CORNERS: readonly Corner[] = ["nw", "ne", "sw", "se"];

/** A corner dragged by (dx, dy) from `start`; the opposite corner stays where it was. */
export const resizeBox = (start: Required<PanelBox>, corner: Corner, dx: number, dy: number): Required<PanelBox> => {
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  const w = Math.max(PANEL_MIN.w, start.w + (west ? -dx : dx));
  const h = Math.max(PANEL_MIN.h, start.h + (north ? -dy : dy));
  return { x: west ? start.x + start.w - w : start.x, y: north ? start.y + start.h - h : start.y, w, h };
};

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * How much of the canvas's left and right the open panels cover, for auto-framing (§5.9: "fits
 * the working set into the free area around open panels"). A panel counts when it covers at least
 * a quarter of the canvas height, so a short tray or a collapsed card does not squeeze the view;
 * it covers the side its centre is on. Neither side takes more than 70 % of the width.
 */
export const coveredSides = (canvas: Rect, panels: readonly Rect[], gap = 12): { left: number; right: number } => {
  const width = canvas.right - canvas.left;
  const height = canvas.bottom - canvas.top;
  let left = 0;
  let right = 0;
  for (const panel of panels) {
    const covered = Math.min(panel.bottom, canvas.bottom) - Math.max(panel.top, canvas.top);
    if (covered < height * 0.25 || panel.right <= canvas.left || panel.left >= canvas.right) continue;
    if ((panel.left + panel.right) / 2 - canvas.left < width / 2) left = Math.max(left, panel.right - canvas.left + gap);
    else right = Math.max(right, canvas.right - panel.left + gap);
  }
  return { left: Math.min(left, width * 0.7), right: Math.min(right, width * 0.7) };
};
