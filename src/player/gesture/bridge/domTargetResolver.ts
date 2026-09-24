import type { GestureCursor } from "../gestureMath";
import type { GestureGrabResolution, GestureHoverCue, GestureTargetResolver } from "./gestureBridge";

/**
 * The DOM target resolver: what is under a gesture cursor is `document.elementFromPoint`, and the
 * supported targets are found with the Student Player's selectors (AGENTS.md, "Runtime
 * Interaction Bridge"). What a matched element picks up stays with the player, which knows its own
 * bench geometry.
 */

/** Shelf equipment in the 2D Student Player. */
export const shelfEquipmentSelector = ".equipment-shelf .equipment-view[data-definition-id]";
/** Placed workbench equipment in the 2D Student Player. */
export const workbenchItemSelector = ".bench-item[data-instance-id]";
/** A probe that is dragged by its own handle. */
export const probeHandleSelector = "[data-gesture-drag-kind=\"probe\"][data-instance-id]";
/** A detachable child inside a rendered assembly. */
export const attachedChildHandleSelector = "[data-gesture-drag-kind=\"attached-child\"][data-instance-id]";
/** Everything the 2D Student Player cues while an open hand hovers it. */
export const studentPlayerHoverSelector =
  ".equipment-shelf .equipment-view[data-definition-id], [data-gesture-drag-kind], .bench-item[data-instance-id], button[data-gesture-action]";

export const elementAtGestureCursor = (cursor: GestureCursor): Element | undefined => {
  if (typeof document.elementFromPoint !== "function") return undefined;
  return document.elementFromPoint(cursor.clientX, cursor.clientY) ?? undefined;
};

/** The hover cue on an element: the `is-gesture-hovered` class. */
export const domHoverCue = (element: Element): GestureHoverCue => ({
  key: element,
  apply: () => element.classList.add("is-gesture-hovered"),
  clear: () => element.classList.remove("is-gesture-hovered"),
});

export const createDomGestureTargetResolver = <TGrab>({
  grabAt,
  hoverSelector,
  root,
}: {
  /** What a pinch on a matched element picks up; undefined when the element is not equipment. */
  grabAt: (element: Element, cursor: GestureCursor) => GestureGrabResolution<TGrab> | undefined;
  hoverSelector: string;
  /** The player's root, read at call time. */
  root: () => Element | null | undefined;
}): GestureTargetResolver<TGrab> => ({
  contains: (element) => Boolean(root()?.contains(element)),
  elementAt: elementAtGestureCursor,
  grabAt,
  hoverAt: (cursor) => {
    const target = elementAtGestureCursor(cursor)?.closest(hoverSelector);
    if (!target || !root()?.contains(target)) return undefined;
    return domHoverCue(target);
  },
});
