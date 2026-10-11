import { describe, expect, it } from "vitest";
import { guideItemId } from "../adapters/guideTargets";
import type { SceneItem } from "../adapters/runtimeToScene";

const item = (instanceId: string, definitionId: string) => ({ instanceId, definitionId }) as SceneItem;

describe("what guidance points at (the shelf in place of the tray, 2026-10-11)", () => {
  it("points at an item still on the shelf when none of its kind is on the bench", () => {
    const scene = { bench: [item("b1", "beaker-150ml")], tray: [item("f1", "volumetric-flask")] };
    expect(guideItemId(scene, "volumetric-flask")).toBe("f1");
  });

  it("prefers the bench's item of the kind to the shelf's", () => {
    const scene = { bench: [item("b2", "beaker-150ml")], tray: [item("b1", "beaker-150ml")] };
    expect(guideItemId(scene, "beaker-150ml")).toBe("b2");
  });

  it("takes the instance a step names, wherever it is drawn, and never the excluded source as the target", () => {
    const scene = { bench: [item("s1", "chromatography-strip")], tray: [item("s2", "chromatography-strip")] };
    expect(guideItemId(scene, "chromatography-strip", "s2")).toBe("s2");
    expect(guideItemId(scene, "chromatography-strip", undefined, "s1")).toBe("s2");
    expect(guideItemId(scene, "chromatography-strip", "s1", "s1")).toBe("s2");
  });

  it("points at nothing for an item that is not drawn", () => {
    expect(guideItemId({ bench: [], tray: [] }, "pencil", "p1")).toBeUndefined();
    expect(guideItemId({ bench: [], tray: [] }, undefined)).toBeUndefined();
  });
});
