import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EquipmentShelf } from "../EquipmentShelf";

const rect = (top: number, bottom: number): DOMRect =>
  ({
    bottom,
    height: bottom - top,
    left: 0,
    right: 220,
    toJSON: () => ({}),
    top,
    width: 220,
    x: 0,
    y: top,
  }) as DOMRect;

const configureShelfGeometry = (
  shelf: HTMLElement,
  definitionId: string,
  targetBounds: DOMRect,
) => {
  const scrollRegion = shelf.querySelector<HTMLElement>(".equipment-shelf-scroll");
  const target = scrollRegion?.querySelector<HTMLElement>(
    `.equipment-view[data-definition-id="${definitionId}"]`,
  );
  if (!scrollRegion || !target) throw new Error("Missing shelf scroll geometry target.");

  vi.spyOn(scrollRegion, "getBoundingClientRect").mockReturnValue(rect(100, 300));
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue(targetBounds);
  const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
    scrollRegion.scrollTop = top ?? scrollRegion.scrollTop;
  });
  Object.defineProperty(scrollRegion, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
  return { scrollRegion, scrollTo };
};

describe("EquipmentShelf context retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens and reveals the first current-step item in Guided mode", () => {
    const { rerender } = render(
      <EquipmentShelf
        availableIds={["beaker-250ml", "funnel", "filter-paper"]}
        currentStepEquipmentIds={[]}
      />,
    );
    const shelf = screen.getByLabelText(/equipment shelf/i);
    const filtrationToggle = screen.getByRole("button", { name: /^filtration/i });
    const { scrollRegion, scrollTo } = configureShelfGeometry(
      shelf,
      "filter-paper",
      rect(340, 440),
    );
    scrollRegion.scrollTop = 20;

    rerender(
      <EquipmentShelf
        availableIds={["beaker-250ml", "funnel", "filter-paper"]}
        currentStepEquipmentIds={["filter-paper"]}
      />,
    );
    act(() => vi.runAllTimers());

    expect(filtrationToggle).toHaveAttribute("aria-expanded", "true");
    expect(filtrationToggle).toHaveTextContent(/needed now/i);
    expect(filtrationToggle.querySelector(".shelf-category-icon")).not.toBeNull();
    expect(screen.getByRole("region", { name: /needed now/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /browse all equipment/i })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", top: 160 });
    expect(scrollRegion).toHaveAttribute("data-gesture-scroll-kind", "shelf");
    expect(scrollRegion).toHaveAttribute("data-gesture-scroll-region", "vertical");
  });

  it("does not move an already visible target and retains manually opened categories", () => {
    const { rerender } = render(
      <EquipmentShelf
        availableIds={["beaker-250ml", "funnel", "filter-paper"]}
        currentStepEquipmentIds={["beaker-250ml"]}
      />,
    );
    act(() => vi.runAllTimers());

    const shelf = screen.getByLabelText(/equipment shelf/i);
    const containerToggle = screen.getByRole("button", { name: /^container/i });
    const filtrationToggle = screen.getByRole("button", { name: /^filtration/i });
    fireEvent.click(filtrationToggle);
    act(() => vi.runAllTimers());

    const { scrollTo } = configureShelfGeometry(shelf, "filter-paper", rect(150, 250));
    rerender(
      <EquipmentShelf
        availableIds={["beaker-250ml", "funnel", "filter-paper"]}
        currentStepEquipmentIds={["filter-paper"]}
      />,
    );
    act(() => vi.runAllTimers());

    expect(containerToggle).toHaveAttribute("aria-expanded", "true");
    expect(filtrationToggle).toHaveAttribute("aria-expanded", "true");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does not reveal required equipment from step state in Assessment mode", () => {
    render(
      <EquipmentShelf
        availableIds={["beaker-250ml", "funnel", "filter-paper"]}
        currentStepEquipmentIds={["filter-paper"]}
        showGuidance={false}
      />,
    );
    act(() => vi.runAllTimers());

    const filtrationToggle = screen.getByRole("button", { name: /^filtration/i });
    expect(filtrationToggle).toHaveAttribute("aria-expanded", "false");
    expect(filtrationToggle).not.toHaveTextContent(/needed now/i);
    expect(screen.queryByRole("region", { name: /needed now/i })).not.toBeInTheDocument();
  });

  it("retains user and gesture interaction context without changing the row variant", () => {
    const onPlace = vi.fn();
    const { rerender } = render(
      <EquipmentShelf
        availableIds={["funnel", "filter-paper"]}
        currentStepEquipmentIds={[]}
        onPlace={onPlace}
      />,
    );
    const shelf = screen.getByLabelText(/equipment shelf/i);
    fireEvent.click(screen.getByRole("button", { name: /^filtration/i }));
    act(() => vi.runAllTimers());

    const filterPaper = shelf.querySelector<HTMLElement>(
      '.equipment-view[data-definition-id="filter-paper"]',
    );
    if (!filterPaper) throw new Error("Missing filter paper shelf item.");
    const { scrollTo } = configureShelfGeometry(shelf, "filter-paper", rect(330, 430));

    fireEvent.click(filterPaper);
    act(() => vi.runAllTimers());
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalled();

    scrollTo.mockClear();
    rerender(
      <EquipmentShelf
        availableIds={["funnel", "filter-paper"]}
        currentStepEquipmentIds={[]}
        gestureGrabbedDefinitionId="filter-paper"
        onPlace={onPlace}
      />,
    );
    act(() => vi.runAllTimers());
    expect(scrollTo).toHaveBeenCalled();

    rerender(
      <EquipmentShelf
        availableIds={["funnel", "filter-paper"]}
        currentStepEquipmentIds={["filter-paper"]}
        variant="row"
      />,
    );
    act(() => vi.runAllTimers());
    expect(screen.getByLabelText(/equipment shelf/i).querySelector(".equipment-row")).toHaveAttribute(
      "data-gesture-scroll-region",
      "horizontal",
    );
    expect(screen.getByLabelText(/equipment shelf/i).querySelector(".equipment-shelf-scroll")).toBeNull();
  });
});
