import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { filtrationTechnique } from "../../domain/fixtures";
import { Player3D } from "../player/Player3D";
import type { Player3DController } from "../player/usePlayer3D";

/**
 * The shelf in place of the tray (option B, approved 2026-10-11): the tray panel is gone, and the Bench list's
 * "On the shelf" group is the Shelf list, the keyboard and screen-reader way to take an item off the shelf (G-6).
 * jsdom has no WebGL, so the bench shows its fallback; the list works without the canvas.
 */

const render3D = () => {
  const ref: { current?: Player3DController } = {};
  render(<Player3D definition={filtrationTechnique} title="Filter a Precipitate" sourceTag="TECHNIQUE · PACK 1"
    fallbackHash="#/technique/filtration" backHref="#/3d" onPlayer={(p) => { ref.current = p; }} />);
  return ref;
};
const onShelf = (player: Player3DController) => player.runtime.state.equipmentInstances.filter((i) => i.location === "shelf");
const shelfList = () => screen.getByRole("list", { name: /^On the shelf · \d+$/ });

describe("the Shelf list", () => {
  beforeEach(() => localStorage.clear());

  it("has no tray: the dock has no Tray button, and no panel opens at the start", () => {
    render3D();
    const dock = screen.getByRole("navigation", { name: "Player tools" });
    expect(within(dock).queryByRole("button", { name: /Tray/ })).not.toBeInTheDocument();
    expect(within(dock).getByRole("button", { name: /Bench list/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tray" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Bench list" })).not.toBeInTheDocument();
  });

  it("names every shelf item with where it stands, and marks what the step needs in guided mode only", () => {
    const ref = render3D();
    fireEvent.click(screen.getByRole("button", { name: /Bench list/ }));
    const items = within(shelfList()).getAllByRole("button");
    expect(items).toHaveLength(onShelf(ref.current!).length);
    for (const item of items) expect(item.getAttribute("aria-label")).toMatch(/, on the (upper shelf|lower shelf|side station)(, needed now)?\. Press Enter to place it on the bench\.$/);
    expect(items.some((item) => /needed now/.test(item.getAttribute("aria-label") ?? ""))).toBe(true);
    act(() => ref.current!.runtime.setMode("assessment"));
    for (const item of within(shelfList()).getAllByRole("button")) expect(item).not.toHaveAccessibleName(/needed now/);
    expect(shelfList()).not.toHaveTextContent("needed now");
  });

  it("places an item on the bench with Enter (a button's click), as the tray's tile did", () => {
    const ref = render3D();
    fireEvent.click(screen.getByRole("button", { name: /Bench list/ }));
    const before = onShelf(ref.current!).length;
    const needed = within(shelfList()).getAllByRole("button").find((item) => /needed now/.test(item.getAttribute("aria-label") ?? ""))!;
    const instanceId = needed.dataset.instanceId!;
    fireEvent.click(needed);
    const placed = ref.current!.runtime.state.equipmentInstances.find((i) => i.id === instanceId);
    expect(placed?.location).not.toBe("shelf");
    expect(onShelf(ref.current!)).toHaveLength(before - 1);
    expect(within(shelfList()).getAllByRole("button")).toHaveLength(before - 1);
    expect(screen.getByRole("heading", { name: `On the shelf · ${before - 1}` })).toBeInTheDocument();
  });
});
