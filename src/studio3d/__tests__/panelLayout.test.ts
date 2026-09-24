import { describe, expect, it } from "vitest";
import { clampBox, coveredSides, PANEL_MIN, PANEL_TOP, resizeBox, sanitizeLayout } from "../player/panelLayout";

const viewport = { width: 1280, height: 720 };

describe("panel layout (handoff §5.1)", () => {
  it("keeps only well-formed entries for known panels from storage", () => {
    expect(sanitizeLayout(null)).toEqual({});
    expect(sanitizeLayout("junk")).toEqual({});
    expect(sanitizeLayout({
      step: { box: { x: 10, y: 80, w: 400, h: "tall" }, collapsed: true },
      tray: { box: { x: Number.NaN, y: 3 } },
      list: { collapsed: "yes" },
      notebook: { box: { x: 1, y: 2 } },
    })).toEqual({ step: { box: { x: 10, y: 80, w: 400 }, collapsed: true } });
  });

  it("keeps a panel inside the player and below the top bar", () => {
    expect(clampBox({ x: -50, y: 0 }, { w: 300, h: 130 }, viewport)).toEqual({ x: 0, y: PANEL_TOP });
    expect(clampBox({ x: 5000, y: 5000 }, { w: 300, h: 130 }, viewport)).toEqual({ x: 980, y: 590 });
    expect(clampBox({ x: 0, y: 60, w: 10, h: 10 }, { w: 300, h: 130 }, viewport)).toEqual({ x: 0, y: 60, w: PANEL_MIN.w, h: PANEL_MIN.h });
  });

  it("resizes from a corner and keeps the opposite corner where it was", () => {
    const start = { x: 100, y: 100, w: 300, h: 200 };
    expect(resizeBox(start, "se", 40, 20)).toEqual({ x: 100, y: 100, w: 340, h: 220 });
    expect(resizeBox(start, "nw", 40, 20)).toEqual({ x: 140, y: 120, w: 260, h: 180 });
    expect(resizeBox(start, "ne", -500, 0)).toEqual({ x: 100, y: 100, w: PANEL_MIN.w, h: 200 });
    expect(resizeBox(start, "sw", -500, 0)).toEqual({ x: -400, y: 100, w: 800, h: 200 });
  });

  it("counts tall panels on the side their centre is on, and ignores short ones", () => {
    const canvas = { left: 0, top: 0, right: 1280, bottom: 720 };
    const stepCard = { left: 14, top: 66, right: 386, bottom: 397 };
    const tray = { left: 14, top: 573, right: 314, bottom: 706 };
    const benchList = { left: 926, top: 66, right: 1266, bottom: 540 };
    expect(coveredSides(canvas, [stepCard, tray, benchList])).toEqual({ left: 398, right: 366 });
    expect(coveredSides(canvas, [tray])).toEqual({ left: 0, right: 0 });
  });
});
