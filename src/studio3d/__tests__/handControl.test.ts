import { afterEach, describe, expect, it, vi } from "vitest";
import type { GestureCursor } from "../../player/gesture/gestureMath";
import { gestureActionButtonSelector } from "../../player/gesture/bridge/gestureBridge";
import { benchCanvasUnder, createBenchGestureTargetResolver, player3DHoverSelector, trayTileSelector, type BenchGestureTargets } from "../bench/input/targetResolver";
import { handControlSetupSteps } from "../player/HandControlPanel";
import { sanitizeLayout } from "../player/panelLayout";

/**
 * Player3D's hand control (plan D6, handoff §5.15): the raycast resolver behind the bench canvas,
 * the shared DOM resolver for the page, and the panel's set-up state read from the engine.
 */

const cursor = (clientX = 50, clientY = 60): GestureCursor => ({
  clientX,
  clientY,
  normalizedX: 0,
  normalizedY: 0,
  pinching: true,
  pinchRatio: 0.25,
  tracking: "tracked",
});

const fixture = (overrides: Partial<BenchGestureTargets> = {}) => {
  const root = document.createElement("div");
  root.className = "s3d-player";
  const canvas = document.createElement("canvas");
  const tray = document.createElement("section");
  tray.className = "s3d-float s3d-tray";
  tray.innerHTML = '<button type="button" class="s3d-tile" data-definition-id="wash-bottle"><img alt=""><span>Wash bottle</span></button>';
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.dataset.gestureAction = "confirm-accessible-action";
  root.append(canvas, tray, confirm);
  document.body.append(root);
  const tile = tray.querySelector(".s3d-tile") as HTMLElement;
  tile.getBoundingClientRect = () => ({ bottom: 100, height: 100, left: 0, right: 100, top: 0, width: 100, x: 0, y: 0, toJSON: () => ({}) });
  let under: Element | null = canvas;
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => under) });
  const targets: BenchGestureTargets = {
    canCarry: () => true,
    canPickUp: () => true,
    canvas: () => canvas,
    hoverBenchItem: vi.fn(),
    pick: vi.fn(() => "flask-1"),
    root: () => root,
    trayItem: (definitionId) => (definitionId === "wash-bottle" ? { label: "Wash bottle" } : undefined),
    ...overrides,
  };
  return {
    canvas,
    confirm,
    resolver: createBenchGestureTargetResolver(targets),
    setUnder: (element: Element | null) => {
      under = element;
    },
    targets,
    tile,
    tileImage: tile.querySelector("img") as Element,
  };
};

const originalElementFromPoint = document.elementFromPoint;

afterEach(() => {
  document.body.replaceChildren();
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: originalElementFromPoint });
});

describe("Player3D's gesture target resolver (raycast behind the canvas)", () => {
  it("names the tray tile and hover selectors from the shared whitelist", () => {
    expect(trayTileSelector).toBe(".s3d-tray .s3d-tile[data-definition-id]");
    expect(player3DHoverSelector).toBe(`${trayTileSelector}, ${gestureActionButtonSelector}`);
  });

  it("picks up the bench item the raycast finds under the cursor", () => {
    const f = fixture();
    expect(f.resolver.grabAt(f.canvas, cursor(70, 80))).toEqual({ grab: { instanceId: "flask-1", kind: "bench" }, kind: "grab" });
    expect(f.targets.pick).toHaveBeenCalledWith(70, 80);
  });

  it("stops at a bench item that cannot be carried now, and finds nothing over the empty bench", () => {
    expect(fixture({ canCarry: () => false }).resolver.grabAt(document.createElement("canvas"), cursor())).toBeUndefined();
    const blocked = fixture({ canCarry: () => false });
    expect(blocked.resolver.grabAt(blocked.canvas, cursor())).toEqual({ kind: "blocked" });
    const empty = fixture({ pick: () => undefined });
    expect(empty.resolver.grabAt(empty.canvas, cursor())).toBeUndefined();
  });

  it("picks up a tray item from its tile through the DOM, keeping the grip point", () => {
    const f = fixture();
    expect(f.resolver.grabAt(f.tileImage, cursor(25, 75))).toEqual({
      grab: { definitionId: "wash-bottle", gripX: 0.25, gripY: 0.75, kind: "tray", label: "Wash bottle" },
      kind: "grab",
    });
    expect(f.targets.pick).not.toHaveBeenCalled();
  });

  it("stops at a tray tile while nothing can be picked up", () => {
    const f = fixture({ canPickUp: () => false });
    expect(f.resolver.grabAt(f.tile, cursor())).toEqual({ kind: "blocked" });
  });

  it("leaves action buttons to the shared bridge's whitelist", () => {
    const f = fixture();
    expect(f.resolver.grabAt(f.confirm, cursor())).toBeUndefined();
  });

  it("cues a bench item with the bench's own hover label, and page targets with the shared class", () => {
    const f = fixture();
    const benchCue = f.resolver.hoverAt(cursor());
    expect(benchCue?.key).toBe("bench:flask-1");
    benchCue?.apply();
    expect(f.targets.hoverBenchItem).toHaveBeenLastCalledWith("flask-1");
    benchCue?.clear();
    expect(f.targets.hoverBenchItem).toHaveBeenLastCalledWith(undefined);

    f.setUnder(f.tileImage);
    const tileCue = f.resolver.hoverAt(cursor());
    expect(tileCue?.key).toBe(f.tile);
    tileCue?.apply();
    expect(f.tile).toHaveClass("is-gesture-hovered");

    f.setUnder(f.confirm);
    expect(f.resolver.hoverAt(cursor())?.key).toBe(f.confirm);
  });

  it("cues nothing over the empty bench", () => {
    const f = fixture({ pick: () => undefined });
    expect(f.resolver.hoverAt(cursor())).toBeUndefined();
  });

  it("counts a point as over the bench only where the canvas itself is the element, not a panel over it", () => {
    const f = fixture();
    expect(benchCanvasUnder(f.canvas, 10, 10)).toBe(true);
    f.setUnder(f.tileImage);
    expect(benchCanvasUnder(f.canvas, 10, 10)).toBe(false);
    expect(benchCanvasUnder(undefined, 10, 10)).toBe(false);
  });
});

describe("the hand-control panel's set-up state (the secure context and the engine's status)", () => {
  const states = (secureContext: boolean, status: Parameters<typeof handControlSetupSteps>[1]) =>
    handControlSetupSteps(secureContext, status).map((step) => step.state);

  it("uses the 2D requirements wording, one requirement per line", () => {
    expect(handControlSetupSteps(true, "off").map((step) => step.text)).toEqual([
      "Use localhost or HTTPS",
      "Allow webcam permission",
      "Keep one hand visible",
      "Use steady lighting with enough contrast",
    ]);
  });

  it("marks each requirement from the secure context and the engine's status", () => {
    expect(states(false, "off")).toEqual(["problem", "pending", "pending", undefined]);
    expect(states(true, "off")).toEqual(["done", "pending", "pending", undefined]);
    expect(states(true, "starting")).toEqual(["done", "now", "pending", undefined]);
    expect(states(true, "permissionDenied")).toEqual(["done", "problem", "pending", undefined]);
    expect(states(true, "noHand")).toEqual(["done", "done", "now", undefined]);
    expect(states(true, "unstable")).toEqual(["done", "done", "now", undefined]);
    expect(states(true, "ready")).toEqual(["done", "done", "done", undefined]);
  });

  it("remembers the panel's layout with the other floating panels", () => {
    expect(sanitizeLayout({ hand: { box: { x: 900, y: 300 }, collapsed: true } })).toEqual({ hand: { box: { x: 900, y: 300 }, collapsed: true } });
  });
});
