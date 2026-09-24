import { createDomGestureTargetResolver } from "../../../player/gesture/bridge/domTargetResolver";
import {
  gestureActionButtonSelector,
  type GestureGrabResolution,
  type GestureTargetResolver,
} from "../../../player/gesture/bridge/gestureBridge";
import type { GestureCursor } from "../../../player/gesture/gestureMath";

/**
 * Player3D's gesture target resolver (plan D6, handoff §5.15). Page targets resolve through the
 * shared DOM resolver: tray tiles and whitelisted action buttons, found with `elementFromPoint`.
 * Behind the bench canvas, a raycast through `BenchEngine.pick` finds the bench item. It only
 * resolves targets: what a pinch does comes from the shared bridge, and a release commits through
 * the bench's normal carry (useBenchCarry), so this adds no gesture meaning of its own (G-10).
 */

/** A tray tile, the 3D counterpart of the 2D shelf item. */
export const trayTileSelector = ".s3d-tray .s3d-tile[data-definition-id]";
/** Everything Player3D cues while an open hand hovers it, besides bench items. */
export const player3DHoverSelector = `${trayTileSelector}, ${gestureActionButtonSelector}`;

export type BenchGestureGrab =
  | { kind: "bench"; instanceId: string }
  /** Where on its tile the pinch took hold (0–1), so the preview keeps that grip. */
  | { kind: "tray"; definitionId: string; label: string; gripX: number; gripY: number };

export interface BenchGestureTargets {
  /** The player's root, read at call time. */
  root: () => Element | null | undefined;
  /** The bench canvas; a cursor over it is resolved by raycast. */
  canvas: () => HTMLCanvasElement | undefined;
  /** The bench item under a client point (`BenchEngine.pick`; scenery is never picked). */
  pick: (clientX: number, clientY: number) => string | undefined;
  /** Whether a bench item can be carried now (the carry's own rule). */
  canCarry: (instanceId: string) => boolean;
  /** A tray tile's definition, if it still has an item on the tray. */
  trayItem: (definitionId: string) => { label: string } | undefined;
  /** Whether anything can be picked up now (nothing is while a committed pour is drawn). */
  canPickUp: () => boolean;
  /** The bench's hover label, the one the mouse shows. */
  hoverBenchItem: (instanceId: string | undefined) => void;
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/**
 * Whether the bench canvas itself is under a client point. The canvas fills the player and the
 * floating panels sit over it, so "over the bench" (the 2D bridge's "over the workbench") means the
 * canvas is the element there, not only that the point is inside its rectangle.
 */
export const benchCanvasUnder = (canvas: HTMLCanvasElement | undefined, clientX: number, clientY: number): boolean =>
  Boolean(canvas) && typeof document.elementFromPoint === "function" && document.elementFromPoint(clientX, clientY) === canvas;

export const createBenchGestureTargetResolver = (targets: BenchGestureTargets): GestureTargetResolver<BenchGestureGrab> => {
  const grabTrayTile = (element: Element, cursor: GestureCursor): GestureGrabResolution<BenchGestureGrab> | undefined => {
    const tile = element.closest<HTMLElement>(trayTileSelector);
    const definitionId = tile?.dataset.definitionId;
    if (!tile || !definitionId) return undefined;
    const item = targets.trayItem(definitionId);
    if (!item || !targets.canPickUp()) return { kind: "blocked" };
    const rect = tile.getBoundingClientRect();
    return {
      grab: {
        definitionId,
        gripX: rect.width > 0 ? clamp01((cursor.clientX - rect.left) / rect.width) : 0.5,
        gripY: rect.height > 0 ? clamp01((cursor.clientY - rect.top) / rect.height) : 0.5,
        kind: "tray",
        label: item.label,
      },
      kind: "grab",
    };
  };
  const dom = createDomGestureTargetResolver<BenchGestureGrab>({
    grabAt: grabTrayTile,
    hoverSelector: player3DHoverSelector,
    root: targets.root,
  });
  const isCanvas = (element: Element | undefined): boolean => {
    const canvas = targets.canvas();
    return Boolean(canvas && element === canvas && dom.contains(canvas));
  };
  return {
    ...dom,
    grabAt: (element, cursor) => {
      if (!isCanvas(element)) return dom.grabAt(element, cursor);
      const instanceId = targets.pick(cursor.clientX, cursor.clientY);
      if (!instanceId) return undefined;
      return targets.canCarry(instanceId) ? { grab: { instanceId, kind: "bench" }, kind: "grab" } : { kind: "blocked" };
    },
    hoverAt: (cursor) => {
      if (!isCanvas(dom.elementAt(cursor))) return dom.hoverAt(cursor);
      const instanceId = targets.pick(cursor.clientX, cursor.clientY);
      if (!instanceId) return undefined;
      return {
        apply: () => targets.hoverBenchItem(instanceId),
        clear: () => targets.hoverBenchItem(undefined),
        key: `bench:${instanceId}`,
      };
    },
  };
};
