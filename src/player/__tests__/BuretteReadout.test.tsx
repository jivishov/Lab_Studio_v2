import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuretteReadout, createBuretteScale } from "../BuretteReadout";

describe("BuretteReadout", () => {
  it("renders a 0.1 mL local scale with increasing values below the meniscus", () => {
    const scale = createBuretteScale(5);

    expect(scale.startMl).toBe(4.3);
    expect(scale.endMl).toBe(5.7);
    expect(scale.ticks).toHaveLength(15);
    expect(scale.ticks.map((tick) => tick.valueMl)).toEqual([
      4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7,
    ]);
    expect(scale.ticks.filter((tick) => tick.isLabeled).map((tick) => tick.valueMl)).toEqual([4.5, 5, 5.5]);
    expect(scale.meniscusPositionPercent).toBe(50);

    render(<BuretteReadout label="Initial burette reading" volumeMl={5} />);

    expect(screen.getByLabelText(/initial burette reading: 5\.00 mL/i)).toBeInTheDocument();
    expect(screen.getByTestId("burette-scale")).toHaveAttribute("data-scale-start", "4.3");
    expect(screen.getByTestId("burette-scale")).toHaveAttribute("data-scale-end", "5.7");
    expect(screen.getByTestId("burette-meniscus")).toHaveStyle({ top: "50%" });
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText("5.5")).toBeInTheDocument();
  });

  it("keeps the scale bounded at the 0.00 and 50.00 mL ends", () => {
    const lowerScale = createBuretteScale(-1);
    const upperScale = createBuretteScale(51);

    expect(lowerScale.startMl).toBe(0);
    expect(lowerScale.endMl).toBe(1.4);
    expect(lowerScale.meniscusPositionPercent).toBe(0);
    expect(upperScale.startMl).toBe(48.6);
    expect(upperScale.endMl).toBe(50);
    expect(upperScale.meniscusPositionPercent).toBe(100);
  });

  it("places a 0.05 mL simulator reading between the physical 0.1 mL graduations", () => {
    const scale = createBuretteScale(5.05);

    expect(scale.meniscusPositionPercent).toBeCloseTo(53.571, 3);
    expect(scale.ticks.find((tick) => tick.valueMl === 5)?.positionPercent).toBe(50);
    expect(scale.ticks.find((tick) => tick.valueMl === 5.1)?.positionPercent).toBeCloseTo(57.143, 3);
  });
});
