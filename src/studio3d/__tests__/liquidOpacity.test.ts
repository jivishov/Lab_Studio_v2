import { describe, expect, it } from "vitest";
import { liquidOpacity3D } from "../bench/scene/contents";

describe("3D liquid opacity keeps the palette's order (plan §2.5)", () => {
  it("is strictly increasing in the 2D opacity, so ordinal states stay distinct and ordered", () => {
    const steps = Array.from({ length: 101 }, (_, i) => i / 100);
    const mapped = steps.map((value) => liquidOpacity3D(1, value));
    for (let i = 1; i < mapped.length; i += 1) expect(mapped[i]).toBeGreaterThan(mapped[i - 1]);
  });

  it("reads colour alpha and style opacity together, as the 2D fill does", () => {
    expect(liquidOpacity3D(0.5, 0.4)).toBeCloseTo(liquidOpacity3D(1, 0.2), 12);
    expect(liquidOpacity3D(0, 1)).toBeCloseTo(0.25, 12);
    expect(liquidOpacity3D(1, 1)).toBeCloseTo(1, 12);
  });
});
