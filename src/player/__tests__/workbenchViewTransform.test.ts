import { describe, expect, it } from "vitest";
import {
  clientPointToWorkbench,
  createWorkbenchViewTransform,
  fitWorkbenchZoomPercent,
  logicalPointAtViewportCenter,
  nearestNumericWorkbenchZoom,
  parseWorkbenchZoomPreference,
  resolveWorkbenchLogicalSize,
  scaleWorkbenchPreviewSize,
  scrollPositionForLogicalCenter,
  workbenchPointToClient,
} from "../workbenchViewTransform";

describe("workbench view transform", () => {
  it("accepts only persisted numeric steps or fit", () => {
    expect(parseWorkbenchZoomPreference("fit")).toBe("fit");
    expect(parseWorkbenchZoomPreference("60")).toBe(60);
    expect(parseWorkbenchZoomPreference("160")).toBe(160);
    expect(parseWorkbenchZoomPreference("75")).toBe(100);
    expect(parseWorkbenchZoomPreference("200")).toBe(100);
    expect(parseWorkbenchZoomPreference("not-a-zoom")).toBe(100);
  });

  it("clamps fit and numeric stepping to the supported limits", () => {
    expect(fitWorkbenchZoomPercent({ width: 380, height: 260 }, { width: 760, height: 520 })).toBe(60);
    expect(fitWorkbenchZoomPercent({ width: 1520, height: 1040 }, { width: 760, height: 520 })).toBe(160);
    expect(nearestNumericWorkbenchZoom(83, 1)).toBe(90);
    expect(nearestNumericWorkbenchZoom(83, -1)).toBe(80);
  });

  it("grows the logical scene around the viewport and occupied apparatus", () => {
    expect(
      resolveWorkbenchLogicalSize(
        { width: 820, height: 480 },
        [{ x: 810, y: 500, width: 120, height: 90 }],
      ),
    ).toEqual({ width: 954, height: 614 });
  });

  it("round-trips pointer points and scales camera previews", () => {
    const rect = { left: 120, top: 80 };
    const logicalPoint = clientPointToWorkbench({ x: 420, y: 230 }, rect, 1.5);
    expect(logicalPoint).toEqual({ x: 200, y: 100 });
    expect(workbenchPointToClient(logicalPoint, rect, 1.5)).toEqual({ x: 420, y: 230 });
    expect(scaleWorkbenchPreviewSize({ width: 128, height: 72 }, 1.5)).toEqual({
      width: 192,
      height: 108,
    });
  });

  it("preserves the logical point beneath the viewport center", () => {
    const previous = createWorkbenchViewTransform(
      { width: 900, height: 620 },
      { width: 600, height: 400 },
      100,
    );
    const center = logicalPointAtViewportCenter(
      { clientWidth: 600, clientHeight: 400, scrollLeft: 120, scrollTop: 80 },
      previous,
    );
    const next = createWorkbenchViewTransform(
      { width: 900, height: 620 },
      { width: 600, height: 400 },
      150,
    );
    const scroll = scrollPositionForLogicalCenter(
      center,
      { clientWidth: 600, clientHeight: 400 },
      next,
    );
    expect(
      logicalPointAtViewportCenter(
        {
          clientWidth: 600,
          clientHeight: 400,
          scrollLeft: scroll.x,
          scrollTop: scroll.y,
        },
        next,
      ),
    ).toEqual(center);
  });
});
