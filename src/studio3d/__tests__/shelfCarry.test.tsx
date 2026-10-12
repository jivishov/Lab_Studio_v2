import { act, fireEvent, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { filtrationTechnique } from "../../domain/fixtures";
import type { BenchEngine } from "../bench/BenchEngine";
import { useBenchCarry } from "../bench/input/useBenchCarry";
import { usePlayer3D } from "../player/usePlayer3D";

/**
 * Taking an item off the shelf with the mouse and by touch (the shelf in place of the tray, approved 2026-10-11):
 * a press on a shelf item starts the tray's own carry, setting it down runs `dropFromTray`'s intent or move, and a
 * press back on the shelf puts it back on its spot with nothing changed. jsdom has no WebGL, so the engine is a fake
 * that answers where the pointer is: over a shelf item, over the shelf, or over the bench.
 */

const fakeEngine = () => {
  const canvas = document.createElement("canvas");
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => false;
  document.body.appendChild(canvas);
  const where = { shelfItem: undefined as string | undefined, overShelf: false };
  const engine = {
    canvasElement: canvas,
    pick: () => undefined,
    pickControl: () => undefined,
    pickShelf: () => where.shelfItem,
    overShelf: () => where.overShelf,
    onShelf: (id: string) => id === where.shelfItem,
    carryPointAt: () => ({ xMm: 0, yMm: 120, surfaceMm: 0 }),
    benchPointAt: () => ({ xMm: 0, yMm: 120 }),
    screenPoint: () => ({ x: 0, y: 0 }),
    previewCarry: vi.fn(),
    endCarryPreview: vi.fn(),
    setTargetRing: vi.fn(),
    setToolHeld: vi.fn(),
    setToolLoad: vi.fn(),
    holdCameraInput: vi.fn(),
    sync: vi.fn(() => Promise.resolve()),
    tipOffsetMm: () => undefined,
    solidRestOffsetMm: () => undefined,
  };
  return { engine, where, canvas };
};

const setUp = () => {
  const fake = fakeEngine();
  const hook = renderHook(() => {
    const player = usePlayer3D(filtrationTechnique);
    const carry = useBenchCarry(fake.engine as unknown as BenchEngine, player, () => undefined);
    return { player, carry };
  });
  const first = hook.result.current.player.scene.tray[0];
  fake.where.shelfItem = first.instanceId;
  const location = () => hook.result.current.player.runtime.getState().equipmentInstances.find((i) => i.id === first.instanceId)?.location;
  const press = (x: number, y: number, pointerType = "mouse") => act(() => { fireEvent.pointerDown(fake.canvas, { button: 0, pointerType, clientX: x, clientY: y, pointerId: 1 }); });
  const up = (x: number, y: number, pointerType = "mouse") => act(() => { fireEvent.pointerUp(window, { button: 0, pointerType, clientX: x, clientY: y, pointerId: 1 }); });
  const move = (x: number, y: number, pointerType = "mouse") => act(() => { fireEvent.pointerMove(window, { pointerType, clientX: x, clientY: y, pointerId: 1 }); });
  return { ...fake, hook, first, location, press, up, move };
};

describe("taking an item off the shelf", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("with the mouse: a press takes it, and the item itself follows the pointer onto the bench, where the next press sets it down", () => {
    const t = setUp();
    expect(t.location()).toBe("shelf");
    t.press(100, 80);
    t.up(100, 80);
    expect(t.hook.result.current.carry.carrying).toBe(true);
    expect(t.hook.result.current.carry.clickCarrying).toBe(true);
    // The item drawn lifted toward the bench point under the pointer, not a thumbnail.
    expect(t.engine.previewCarry).toHaveBeenCalledWith(t.first.instanceId, 0, 120, expect.any(Number));
    t.where.shelfItem = undefined;
    t.press(400, 420);
    expect(t.hook.result.current.carry.carrying).toBe(false);
    expect(t.location()).not.toBe("shelf");
  });

  it("with the mouse: a press back on the shelf puts it back on its spot, and nothing changes", async () => {
    const t = setUp();
    const before = t.hook.result.current.player.runtime.getState();
    t.press(100, 80);
    t.up(100, 80);
    t.where.overShelf = true;
    t.press(160, 90);
    expect(t.hook.result.current.carry.carrying).toBe(false);
    expect(t.location()).toBe("shelf");
    expect(t.hook.result.current.player.runtime.getState().equipmentInstances).toEqual(before.equipmentInstances);
    // Drawn on its spot again, and said where.
    expect(t.engine.sync).toHaveBeenCalled();
    // Announced on a short timer (usePlayer3D's announce).
    await waitFor(() => expect(t.hook.result.current.player.announcement).toMatch(/^Put back on the shelf\. Nothing moved\./));
  });

  it("with the mouse: Esc puts it back", () => {
    const t = setUp();
    t.press(100, 80);
    t.up(100, 80);
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(t.hook.result.current.carry.carrying).toBe(false);
    expect(t.location()).toBe("shelf");
  });

  it("by touch: press, drag onto the bench and lift sets it down; a tap places it in its own slot", () => {
    const t = setUp();
    t.press(100, 80, "touch");
    expect(t.engine.holdCameraInput).toHaveBeenCalledWith(true);
    t.move(300, 400, "touch");
    expect(t.hook.result.current.carry.carrying).toBe(true);
    t.up(300, 400, "touch");
    expect(t.hook.result.current.carry.carrying).toBe(false);
    expect(t.location()).not.toBe("shelf");

    const tap = setUp();
    tap.press(100, 80, "touch");
    tap.up(100, 80, "touch");
    expect(tap.location()).not.toBe("shelf");
  });

  it("by touch: dragged back over the shelf and lifted, it goes back on its spot", () => {
    const t = setUp();
    t.press(100, 80, "touch");
    t.move(300, 400, "touch");
    t.where.overShelf = true;
    t.move(110, 85, "touch");
    t.up(110, 85, "touch");
    expect(t.hook.result.current.carry.carrying).toBe(false);
    expect(t.location()).toBe("shelf");
  });
});
