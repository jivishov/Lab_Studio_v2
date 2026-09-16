import { describe, expect, it } from "vitest";
import {
  compositeChildren,
  compositeParent,
  evaluateCompositeScene,
  instanceSwapCompositeFor,
  visualCompositesInPrecedenceOrder,
  type CompositeSceneLayer,
} from "../composites";
import { compositeRegistry } from "../registries";
import { getVisualProfile, handWarmerCalorimeterStateAssets } from "../visualCatalog";

/**
 * Cycle 05 tests for the one composite evaluation path.
 *
 * Authored under the repository validation policy and deliberately not executed in this cycle.
 */

const layer = (
  definitionId: string,
  overrides: Partial<CompositeSceneLayer> = {},
): CompositeSceneLayer => ({
  id: `${definitionId}-1`,
  definitionId,
  instanceId: `${definitionId}-instance`,
  ...overrides,
});

const bench = { compositesEnabled: true };
const shelf = { compositesEnabled: false };

describe("composite scene evaluation", () => {
  it("recognises a composite only when every participant occupies its declared snap zone", () => {
    const seated = evaluateCompositeScene(
      [
        layer("funnel-stand"),
        layer("filter-paper", { snapZoneId: "funnel-stand-paper-seat" }),
      ],
      bench,
    );
    const looseOnBench = evaluateCompositeScene(
      [layer("funnel-stand"), layer("filter-paper")],
      bench,
    );
    const seatedElsewhere = evaluateCompositeScene(
      [layer("funnel-stand"), layer("filter-paper", { snapZoneId: "watch-glass-paper-seat" })],
      bench,
    );

    expect(seated.composite?.id).toBe("funnel-stand-with-filter-paper");
    // Cycle 02 recorded this branch firing on presence alone; that deviation is closed.
    expect(looseOnBench.composite).toBeUndefined();
    expect(seatedElsewhere.composite).toBeUndefined();
  });

  it("suppresses only the participants the registry declares", () => {
    const scene = evaluateCompositeScene(
      [
        layer("funnel-stand"),
        layer("filter-paper", { snapZoneId: "funnel-stand-paper-seat" }),
        layer("beaker-250ml", { snapZoneId: "funnel-receiving-vessel-zone" }),
      ],
      bench,
    );

    expect([...scene.suppressedLayerIds]).toEqual(["filter-paper-1"]);
    expect(scene.parentLayerId).toBe("funnel-stand-1");
    expect(scene.assetOverrideByLayerId.get("funnel-stand-1")).toContain("funnel-paper-stand.svg");
    expect(scene.assetOverrideByLayerId.has("beaker-250ml-1")).toBe(false);
  });

  it("prefers the more complete assembly, and falls back gracefully when a participant leaves", () => {
    const full = evaluateCompositeScene(
      [
        layer("ring-stand"),
        layer("clay-triangle", { snapZoneId: "ring-stand-clay-triangle-seat" }),
        layer("crucible-with-lid", { snapZoneId: "ring-stand-crucible-seat" }),
      ],
      bench,
    );
    const crucibleRemoved = evaluateCompositeScene(
      [layer("ring-stand"), layer("clay-triangle", { snapZoneId: "ring-stand-clay-triangle-seat" })],
      bench,
    );

    expect(full.composite?.id).toBe("ring-stand-clay-triangle-crucible-lid-ajar");
    expect([...full.suppressedLayerIds].sort()).toEqual(["clay-triangle-1", "crucible-with-lid-1"]);
    // Recovery is precedence, not branch order: detaching the crucible leaves the clay-triangle art.
    expect(crucibleRemoved.composite?.id).toBe("ring-stand-clay-triangle");
    expect([...crucibleRemoved.suppressedLayerIds]).toEqual(["clay-triangle-1"]);
  });

  it("prefers the stand-burette-funnel composite and falls back after funnel removal", () => {
    const withFunnel = evaluateCompositeScene(
      [
        layer("ring-stand-clamp"),
        layer("burette-50ml", { snapZoneId: "ring-stand-burette-clamp" }),
        layer("funnel", { snapZoneId: "burette-funnel-seat" }),
      ],
      bench,
    );
    const funnelRemoved = evaluateCompositeScene(
      [
        layer("ring-stand-clamp"),
        layer("burette-50ml", { snapZoneId: "ring-stand-burette-clamp" }),
      ],
      bench,
    );

    expect(withFunnel.composite?.id).toBe("ring-stand-burette-funnel");
    expect([...withFunnel.suppressedLayerIds].sort()).toEqual(["burette-50ml-1", "funnel-1"]);
    expect(withFunnel.assetOverrideByLayerId.get("ring-stand-clamp-1")).toContain(
      "ring-stand-burette-funnel.svg",
    );
    expect(funnelRemoved.composite?.id).toBe("ring-stand-burette");
    expect([...funnelRemoved.suppressedLayerIds]).toEqual(["burette-50ml-1"]);
    expect(funnelRemoved.assetOverrideByLayerId.get("ring-stand-clamp-1")).toContain(
      "ring-stand-burette.svg",
    );
  });

  it("ignores a decorative preview layer, which carries no bench instance", () => {
    const preview = evaluateCompositeScene(
      [
        layer("funnel-stand", { instanceId: undefined }),
        layer("filter-paper", { instanceId: undefined, snapZoneId: "funnel-stand-paper-seat" }),
      ],
      bench,
    );

    // The parent is held to the same rule as its participants: a silhouette must not assemble
    // around a seated child that belongs to some other stand.
    const decorativeParent = evaluateCompositeScene(
      [
        layer("funnel-stand", { instanceId: undefined }),
        layer("filter-paper", { snapZoneId: "funnel-stand-paper-seat" }),
      ],
      bench,
    );

    expect(preview.composite).toBeUndefined();
    expect(preview.suppressedLayerIds.size).toBe(0);
    expect(decorativeParent.composite).toBeUndefined();
    expect(decorativeParent.suppressedLayerIds.size).toBe(0);
  });

  it("assembles nothing on the shelf, where there is no bench to assemble on", () => {
    const scene = evaluateCompositeScene(
      [layer("funnel-stand"), layer("filter-paper", { snapZoneId: "funnel-stand-paper-seat" })],
      shelf,
    );

    expect(scene.composite).toBeUndefined();
    expect(scene.suppressedLayerIds.size).toBe(0);
  });

  it("keys every matched participant by its registry role", () => {
    const scene = evaluateCompositeScene(
      [
        layer("ring-stand"),
        layer("clay-triangle", { snapZoneId: "ring-stand-clay-triangle-seat" }),
        layer("crucible-with-lid", { snapZoneId: "ring-stand-crucible-seat" }),
      ],
      bench,
    );

    // An overlay asks for the slot it draws, never for a positional index into the layer array.
    expect([...scene.layerIdByRole.entries()].sort()).toEqual([
      ["crucible-cradle", "clay-triangle-1"],
      ["heated-vessel", "crucible-with-lid-1"],
      ["heating-support", "ring-stand-1"],
    ]);
  });

  it("lets a complete parent state asset suppress attached component art without heuristic assembly", () => {
    const scene = evaluateCompositeScene(
      [
        layer("hand-warmer-calorimeter", { visualState: "CAL-02" }),
        layer("hot-plate-stirrer", { snapZoneId: "hand-warmer-stirrer-base" }),
        layer("polystyrene-cup-8oz", { snapZoneId: "hand-warmer-cup-support-ring" }),
      ],
      bench,
    );

    expect(scene.assetOverrideByLayerId.get("hand-warmer-calorimeter-1")).toBe(
      handWarmerCalorimeterStateAssets["CAL-02"],
    );
    expect(scene.composite).toBeUndefined();
    expect([...scene.suppressedLayerIds].sort()).toEqual([
      "hot-plate-stirrer-1",
      "polystyrene-cup-8oz-1",
    ]);
  });

  it("suppresses every attached hand-warmer child when the complete CAL state owns the pixels", () => {
    const scene = evaluateCompositeScene(
      [
        layer("hand-warmer-calorimeter", { visualState: "CAL-12" }),
        layer("hot-plate-stirrer", { snapZoneId: "hand-warmer-stirrer-base" }),
        layer("polystyrene-cup-8oz", { id: "outer-cup", snapZoneId: "hand-warmer-cup-support-ring" }),
        layer("polystyrene-cup-8oz", { id: "inner-cup", snapZoneId: "hand-warmer-inner-cup-nest" }),
        layer("wooden-calorimeter-cover", { snapZoneId: "hand-warmer-cover-seat" }),
        layer("probe-thermometer", { snapZoneId: "hand-warmer-probe-hole" }),
        layer("magnetic-stir-bar", { snapZoneId: "hand-warmer-stir-bar-well" }),
      ],
      bench,
    );

    expect(scene.assetOverrideByLayerId.get("hand-warmer-calorimeter-1")).toBe(
      handWarmerCalorimeterStateAssets["CAL-12"],
    );
    expect([...scene.suppressedLayerIds].sort()).toEqual([
      "hot-plate-stirrer-1",
      "inner-cup",
      "magnetic-stir-bar-1",
      "outer-cup",
      "probe-thermometer-1",
      "wooden-calorimeter-cover-1",
    ]);
  });

  it("keeps registered composite parents out of the state-asset map", () => {
    // A state-asset proxy may own attached runtime participants, as the hand-warmer calorimeter does,
    // but it is not also a heuristic composite parent. Keeping these mechanisms disjoint preserves
    // the declared precedence and prevents two complete-art sources from competing for one layer.
    for (const composite of compositeRegistry.composites) {
      const parentDefinitionId = compositeParent(composite)?.definitionId;
      expect(parentDefinitionId, composite.id).toBeDefined();
      expect(
        getVisualProfile(parentDefinitionId as string)?.stateAssets,
        `${composite.id} parent ${parentDefinitionId}`,
      ).toBeUndefined();
    }
  });

  it("declares the same participants the precedence order walks", () => {
    const visual = visualCompositesInPrecedenceOrder();

    expect(visual.map((composite) => composite.id)).toEqual(
      compositeRegistry.rendererPrecedence.filter((token) =>
        compositeRegistry.composites.some(
          (composite) => composite.id === token && composite.kind === "visual",
        ),
      ),
    );
    for (const composite of visual) {
      expect(compositeParent(composite)?.definitionId, composite.id).toBe(
        composite.parentDefinitionId,
      );
      expect(compositeChildren(composite).length, composite.id).toBeGreaterThan(0);
    }
  });
});

describe("instance-swap resolution", () => {
  it("resolves the funnel-stand assembly from its participants, not from an action parameter", () => {
    const resolved = instanceSwapCompositeFor({
      parentDefinitionId: "ring-stand",
      childDefinitionId: "funnel",
      snapZoneId: "ring-stand-funnel-seat",
    });

    expect(resolved?.id).toBe("funnel-stand-assembly");
    expect(resolved?.resultInstanceDefinitionId).toBe("funnel-stand");
    expect(resolved?.invalidFeedback?.recovery).toBeTruthy();
  });

  it("resolves nothing for a seating no composite declares", () => {
    expect(
      instanceSwapCompositeFor({
        parentDefinitionId: "ring-stand",
        childDefinitionId: "funnel",
        snapZoneId: "ring-stand-clay-triangle-seat",
      }),
    ).toBeUndefined();
    expect(
      instanceSwapCompositeFor({
        parentDefinitionId: "funnel-stand",
        childDefinitionId: "filter-paper",
        snapZoneId: "funnel-stand-paper-seat",
      }),
    ).toBeUndefined();
  });
});
