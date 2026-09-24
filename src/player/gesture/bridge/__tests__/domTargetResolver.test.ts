import { afterEach, describe, expect, it, vi } from "vitest";
import type { GestureCursor } from "../../gestureMath";
import {
  attachedChildHandleSelector,
  createDomGestureTargetResolver,
  elementAtGestureCursor,
  probeHandleSelector,
  shelfEquipmentSelector,
  studentPlayerHoverSelector,
  workbenchItemSelector,
} from "../domTargetResolver";
import { gestureActionButtonSelector } from "../gestureBridge";

/**
 * The DOM resolver the 2D Student Player keeps (plan D6). The selectors are the ones AGENTS.md
 * names ("Runtime Interaction Bridge") and the ones StudentPlayer.tsx used before the extraction;
 * they must not change.
 */

const cursor = (clientX = 10, clientY = 20): GestureCursor => ({
  clientX,
  clientY,
  normalizedX: 0,
  normalizedY: 0,
  pinching: false,
  pinchRatio: 0.7,
  tracking: "tracked",
});

const withElementFromPoint = (element: Element | null) => {
  const original = document.elementFromPoint;
  const spy = vi.fn(() => element);
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: spy });
  return {
    restore: () => Object.defineProperty(document, "elementFromPoint", { configurable: true, value: original }),
    spy,
  };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("the DOM gesture target resolver (2D Student Player)", () => {
  it("keeps the Student Player's selectors exactly", () => {
    expect(shelfEquipmentSelector).toBe(".equipment-shelf .equipment-view[data-definition-id]");
    expect(workbenchItemSelector).toBe(".bench-item[data-instance-id]");
    expect(probeHandleSelector).toBe('[data-gesture-drag-kind="probe"][data-instance-id]');
    expect(attachedChildHandleSelector).toBe('[data-gesture-drag-kind="attached-child"][data-instance-id]');
    expect(gestureActionButtonSelector).toBe("button[data-gesture-action]");
    expect(studentPlayerHoverSelector).toBe(
      ".equipment-shelf .equipment-view[data-definition-id], [data-gesture-drag-kind], .bench-item[data-instance-id], button[data-gesture-action]",
    );
  });

  it("finds what is under the cursor with document.elementFromPoint", () => {
    const target = document.createElement("div");
    const mock = withElementFromPoint(target);
    try {
      expect(elementAtGestureCursor(cursor(33, 44))).toBe(target);
      expect(mock.spy).toHaveBeenCalledWith(33, 44);
    } finally {
      mock.restore();
    }
  });

  it("belongs to its player only", () => {
    const root = document.createElement("section");
    const inside = document.createElement("span");
    root.append(inside);
    document.body.append(root, document.createElement("aside"));
    const resolver = createDomGestureTargetResolver({ grabAt: () => undefined, hoverSelector: "span", root: () => root });
    expect(resolver.contains(inside)).toBe(true);
    expect(resolver.contains(document.body.lastElementChild as Element)).toBe(false);
    const noRoot = createDomGestureTargetResolver({ grabAt: () => undefined, hoverSelector: "span", root: () => null });
    expect(noRoot.contains(inside)).toBe(false);
  });

  it("cues the eligible target under an open hand with the is-gesture-hovered class", () => {
    const root = document.createElement("section");
    root.innerHTML = '<div class="bench-item" data-instance-id="flask-1"><span class="art"></span></div>';
    document.body.append(root);
    const art = root.querySelector(".art") as Element;
    const benchItem = root.querySelector(".bench-item") as Element;
    const mock = withElementFromPoint(art);
    try {
      const resolver = createDomGestureTargetResolver({
        grabAt: () => undefined,
        hoverSelector: studentPlayerHoverSelector,
        root: () => root,
      });
      const cue = resolver.hoverAt(cursor());
      expect(cue?.key).toBe(benchItem);
      cue?.apply();
      expect(benchItem).toHaveClass("is-gesture-hovered");
      cue?.clear();
      expect(benchItem).not.toHaveClass("is-gesture-hovered");
    } finally {
      mock.restore();
    }
  });

  it("does not cue targets outside the player, or elements that are not targets", () => {
    const root = document.createElement("section");
    const outside = document.createElement("div");
    outside.className = "bench-item";
    outside.dataset.instanceId = "elsewhere";
    const plain = document.createElement("p");
    root.append(plain);
    document.body.append(root, outside);
    const resolver = createDomGestureTargetResolver({
      grabAt: () => undefined,
      hoverSelector: studentPlayerHoverSelector,
      root: () => root,
    });
    const first = withElementFromPoint(outside);
    try {
      expect(resolver.hoverAt(cursor())).toBeUndefined();
    } finally {
      first.restore();
    }
    const second = withElementFromPoint(plain);
    try {
      expect(resolver.hoverAt(cursor())).toBeUndefined();
    } finally {
      second.restore();
    }
  });

  it("passes pinch starts to the player's own grab rule", () => {
    const grabAt = vi.fn(() => ({ grab: "shelf item", kind: "grab" as const }));
    const resolver = createDomGestureTargetResolver({ grabAt, hoverSelector: "*", root: () => document.body });
    const element = document.createElement("button");
    expect(resolver.grabAt(element, cursor())).toEqual({ grab: "shelf item", kind: "grab" });
    expect(grabAt).toHaveBeenCalledWith(element, expect.objectContaining({ clientX: 10 }));
  });
});
