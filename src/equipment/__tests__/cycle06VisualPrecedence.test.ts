/**
 * Cycle 06 — the Blue #1 dilution series and the crystal-violet colour.
 *
 * Nine visual states Cycle 05 re-owned to this cycle are now `liquid-style` entries. These assert
 * the two properties that matter and that no static rule can express: the eight Blue #1 ratios form
 * a monotonic ladder that an authored state reaches ahead of any container or reagent fallback, and
 * the ladder is ordinal — it never claims a concentration.
 *
 * Authored, not executed. See `docs/_cycle-06-audit-section.md` §21.
 */
import { describe, expect, it } from "vitest";
import type { ContentState } from "../../domain/types";
import { equipmentById } from "../catalog";
import { resolveLiquidStyle } from "../liquidRendering";
import { liquidStylesByState } from "../registries";
import visualStateRegistry from "../visualStateRegistry.json";

/** Ratios in the order the manual lists them: 10/0 down to 0/10 (Investigation 1, finding 3.2). */
const BLUE1_SERIES = [
  "blue1-10-0",
  "blue1-8-2",
  "blue1-6-4",
  "blue1-4-6",
  "blue1-3-7",
  "blue1-2-8",
  "blue1-1-9",
  "blue1-0-10",
] as const;

const stateById = new Map(visualStateRegistry.states.map((state) => [state.id, state]));

const content = (visualState: string, label = "Blue #1 standard"): ContentState => ({
  kind: "solution",
  label,
  volumeMl: 5,
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState,
});

/** Alpha of an `rgba(r, g, b, a)` literal. */
const alpha = (colour: string): number => {
  const match = /rgba\([^)]*,\s*([0-9.]+)\s*\)/.exec(colour);
  if (!match) throw new Error(`not an rgba literal: ${colour}`);
  return Number(match[1]);
};

describe("the Blue #1 dilution series resolves through the registry", () => {
  it("registers all eight ratios as renderable liquid styles", () => {
    for (const id of BLUE1_SERIES) {
      expect(stateById.get(id)?.disposition).toBe("liquid-style");
      expect(liquidStylesByState.has(id)).toBe(true);
    }
  });

  it("orders the series monotonically by stock fraction", () => {
    const fills = BLUE1_SERIES.map((id) => alpha(stateById.get(id)!.renderStyle!.fill));
    for (let index = 1; index < fills.length; index += 1) {
      expect(fills[index]).toBeLessThan(fills[index - 1]);
    }
  });

  it("claims an order and never a value", () => {
    for (const id of BLUE1_SERIES) {
      expect(stateById.get(id)?.quantitativeClaim).toBe("ordinal");
      expect(stateById.get(id)?.quantitativeClaim).not.toBe("absolute");
    }
  });

  it("declares the undiluted standard identical to the stock rather than leaving it to read as an accident", () => {
    expect(stateById.get("blue1-10-0")?.sharesAppearanceWith).toContain("blue-dye-solution");
    expect(stateById.get("blue-dye-solution")?.sharesAppearanceWith).toContain("blue1-10-0");
    expect(stateById.get("blue1-10-0")?.renderStyle).toEqual(
      stateById.get("blue-dye-solution")?.renderStyle,
    );
  });
});

describe("an authored series state beats every fallback", () => {
  it("survives the sample-bottle definition-id override", () => {
    // Audit §9.4: the stock lives in a `sample-bottle`, whose definition-id fallback used to redraw
    // three separate dye samples as plain water.
    const sampleBottle = equipmentById.get("sample-bottle");
    expect(sampleBottle).toBeDefined();
    const resolved = resolveLiquidStyle(content("blue1-10-0"), sampleBottle);
    expect(resolved).toEqual(stateById.get("blue1-10-0")?.renderStyle);
  });

  it("survives a reagent-name heuristic on the content label", () => {
    const testTube = equipmentById.get("test-tube");
    const resolved = resolveLiquidStyle(content("blue1-2-8", "Water and Blue #1"), testTube);
    expect(resolved).toEqual(stateById.get("blue1-2-8")?.renderStyle);
  });

  it("keeps the two ends of the ladder distinguishable in the renderer, not only in the registry", () => {
    const testTube = equipmentById.get("test-tube");
    const strongest = resolveLiquidStyle(content("blue1-10-0"), testTube);
    const weakest = resolveLiquidStyle(content("blue1-0-10"), testTube);
    expect(alpha(strongest.fill)).toBeGreaterThan(alpha(weakest.fill));
  });
});

describe("crystal violet has one colour, not a fade series", () => {
  it("registers purple-solution as a renderable liquid style making no quantitative claim", () => {
    const purple = stateById.get("purple-solution");
    expect(purple?.disposition).toBe("liquid-style");
    expect(purple?.quantitativeClaim).toBe("none");
  });

  it("resolves in a test tube without falling back to a container or reagent style", () => {
    const testTube = equipmentById.get("test-tube");
    const resolved = resolveLiquidStyle(content("purple-solution", "Crystal violet"), testTube);
    expect(resolved).toEqual(stateById.get("purple-solution")?.renderStyle);
  });

  it("leaves no Cycle 06 state unresolved", () => {
    const owned = visualStateRegistry.states.filter((state) => state.ownerCycle === "06");
    expect(owned.length).toBeGreaterThan(0);
    for (const state of owned) {
      expect(state.disposition).not.toBe("unresolved");
    }
  });
});
