import { describe, expect, it } from "vitest";
import { BENCH_MM } from "../adapters/benchCoordinates";
import { arrowDirection, clampToBenchSurface, cycleIndex, KEY_STEP_LARGE_MM, KEY_STEP_MM, nudgePoint, spatialNeighbour, spatialOrder } from "../bench/input/keyboard";

describe("keyboard carry rules (handoff §5.6)", () => {
  it("maps the four arrows, and nothing else", () => {
    expect(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "a"].map(arrowDirection)).toEqual(["left", "right", "up", "down", undefined, undefined]);
  });

  it("moves 10 mm, or 50 mm with Shift; Up is toward the back of the bench", () => {
    expect(nudgePoint({ xMm: 0, yMm: 0 }, "right", false)).toEqual({ xMm: KEY_STEP_MM, yMm: 0 });
    expect(nudgePoint({ xMm: 0, yMm: 0 }, "up", true)).toEqual({ xMm: 0, yMm: KEY_STEP_LARGE_MM });
    expect(nudgePoint({ xMm: 0, yMm: 0 }, "down", false)).toEqual({ xMm: 0, yMm: -KEY_STEP_MM });
  });

  it("keeps the carried point on the bench surface", () => {
    const halfW = BENCH_MM.width / 2 - BENCH_MM.edgeMargin;
    const halfD = BENCH_MM.depth / 2 - BENCH_MM.edgeMargin;
    expect(nudgePoint({ xMm: halfW, yMm: 0 }, "right", true).xMm).toBe(halfW);
    expect(clampToBenchSurface({ xMm: -99_999, yMm: 99_999 })).toEqual({ xMm: -halfW, yMm: halfD });
  });

  it("steps through targets from the first or last, wrapping", () => {
    expect(cycleIndex(3, undefined, 1)).toBe(0);
    expect(cycleIndex(3, undefined, -1)).toBe(2);
    expect(cycleIndex(3, 2, 1)).toBe(0);
    expect(cycleIndex(3, 0, -1)).toBe(2);
    expect(cycleIndex(0, undefined, 1)).toBe(-1);
  });
});

describe("arrow selection in spatial order (§5.19)", () => {
  const items = [
    { id: "left", xMm: -300, yMm: 0 },
    { id: "centre", xMm: 0, yMm: 0 },
    { id: "right", xMm: 300, yMm: 10 },
    { id: "back", xMm: 20, yMm: 200 },
  ];

  it("reads the bench back row first, then left to right", () => {
    expect(spatialOrder(items).map((i) => i.id)).toEqual(["back", "right", "left", "centre"]);
    expect(spatialNeighbour(items, undefined, "right")).toBe("back");
  });

  it("moves to the nearest item that way, preferring the same row or column", () => {
    expect(spatialNeighbour(items, "centre", "right")).toBe("right");
    expect(spatialNeighbour(items, "centre", "left")).toBe("left");
    expect(spatialNeighbour(items, "centre", "up")).toBe("back");
  });

  it("stays put when nothing lies that way", () => {
    expect(spatialNeighbour(items, "right", "right")).toBe("right");
    expect(spatialNeighbour(items, "centre", "down")).toBe("centre");
  });
});
