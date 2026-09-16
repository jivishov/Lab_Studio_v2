/**
 * F07 — provenance and runtime visual fallback coverage.
 *
 * This is authored static coverage for the Phase 1 visual registry change; it was not executed in
 * this handoff. Source-trace assertions live in scripts/__tests__ because application source must
 * not reference the architecture registry directly.
 */
import { describe, expect, it } from "vitest";
import type { ContentState } from "../../domain/types";
import { resolveSolidStyle } from "../solidRendering";
import visualStateRegistry from "../visualStateRegistry.json";

const stateById = new Map(visualStateRegistry.states.map((state) => [state.id, state]));

const solidContent = (visualState: string): ContentState => ({
  kind: "solid",
  label: "Unidentified recovery fraction",
  solutes: [],
  contamination: [],
  wetState: "wet",
  visualState,
});

const solidStyleFor = (id: string): unknown =>
  (stateById.get(id) as { solidStyle?: unknown } | undefined)?.solidStyle;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
};

describe("F07 runtime residue visual fallbacks", () => {
  it("registers wet and dry residue as qualitative, non-quantitative solid styles", () => {
    const wet = stateById.get("wet-residue");
    const dry = stateById.get("dry-residue");

    for (const state of [wet, dry]) {
      expect(state).toBeDefined();
      expect(state?.disposition).toBe("solid-style");
      expect(state?.evidenceKind).toBe("simulator-configured");
      expect(state?.quantitativeClaim).toBe("none");
      expect(state?.authoredToday).toBe(false);
      expect(state?.selectors).toEqual(["runtime-assigned"]);
      expect(state?.owners).toEqual([]);
      expect(state?.runtimeAssignment).toBe("unconditional");
      expect("solidStyle" in (state ?? {})).toBe(true);
    }

    expect(solidStyleFor("wet-residue")).toEqual(solidStyleFor("damp-precipitate"));
    expect(solidStyleFor("dry-residue")).toEqual(solidStyleFor("dry-solid"));
    expect(wet?.sharesAppearanceWith).toEqual(["damp-precipitate"]);
    expect(dry?.sharesAppearanceWith).toEqual(["dry-solid"]);
  });

  it("declares every byte-identical visual style peer in both directions", () => {
    const groups = new Map<string, string[]>();

    for (const state of visualStateRegistry.states) {
      const style = state.renderStyle ?? state.solidStyle;
      if (!style) continue;
      const key = JSON.stringify(canonical(style));
      groups.set(key, [...(groups.get(key) ?? []), state.id]);
    }

    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      for (const id of ids) {
        const peers = stateById.get(id)?.sharesAppearanceWith ?? [];
        for (const other of ids) {
          if (other !== id) expect(peers).toContain(other);
        }
      }
    }
  });

  it("resolves both fallbacks through the solid rendering consumer", () => {
    const wet = resolveSolidStyle(solidContent("wet-residue"));
    const dry = resolveSolidStyle(solidContent("dry-residue"));

    expect(wet).toEqual(solidStyleFor("damp-precipitate"));
    expect(dry).toEqual(solidStyleFor("dry-solid"));
    expect(wet).not.toEqual(dry);
    expect(wet.fill).not.toBe(dry.fill);
  });

  it("keeps the literal registry counts synchronized with the state list", () => {
    const byDisposition: Record<string, number> = {
      "liquid-style": 0,
      unresolved: 0,
      "solid-style": 0,
      "state-asset": 0,
      nonvisual: 0,
    };
    for (const state of visualStateRegistry.states) byDisposition[state.disposition] += 1;

    expect(visualStateRegistry.counts).toEqual({
      total: visualStateRegistry.states.length,
      byDisposition,
    });
  });
});
