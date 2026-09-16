import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aliasedEquipmentIds,
  assetDispositionById,
  assetDispositionRegistry,
  compositeRegistry,
  compositesForParent,
  imageAliasRegistry,
  liquidStylesByState,
  solidStylesByState,
  visualStateById,
  visualStateRegistry,
  visualStateResolves,
} from "../registries";
import { equipmentById } from "../catalog";

const realisticDirectory = join(process.cwd(), "public", "assets", "equipment-realistic", "v1");

describe("visual state registry", () => {
  it("parses with unique ids and a legal disposition on every entry", () => {
    expect(visualStateRegistry.schema).toBe("lab-studio/visual-state-registry@2");
    expect(visualStateById.size).toBe(visualStateRegistry.states.length);
    for (const state of visualStateRegistry.states) {
      expect(["liquid-style", "solid-style", "state-asset", "nonvisual", "unresolved"]).toContain(
        state.disposition,
      );
    }
  });

  it("never lets appearance stand in for a measured value", () => {
    for (const state of visualStateRegistry.states) {
      expect(["none", "ordinal"]).toContain(state.quantitativeClaim);
    }
  });

  it("declares an evidence kind and a selector list on every entry", () => {
    for (const state of visualStateRegistry.states) {
      expect(Object.keys(visualStateRegistry.evidenceKinds), state.id).toContain(state.evidenceKind);
      for (const selector of state.selectors) {
        expect(Object.keys(visualStateRegistry.selectors), state.id).toContain(selector);
      }
      expect(state.selectors.includes("authored"), state.id).toBe(state.authoredToday);
    }
  });

  it("gives every unresolved state an owning cycle other than 05", () => {
    for (const state of visualStateRegistry.states) {
      if (state.disposition !== "unresolved") continue;
      expect(state.ownerCycle, state.id).toMatch(/^\d{2}$/);
      expect(state.ownerCycle, state.id).not.toBe("05");
    }
  });

  it("carries the palette so no colour is defined outside the registry", () => {
    expect(liquidStylesByState.get("clear-liquid")?.fill).toBe("rgba(86, 174, 206, 0.46)");
    expect(liquidStylesByState.size).toBe(
      visualStateRegistry.states.filter((state) => state.disposition === "liquid-style").length,
    );
    expect(solidStylesByState.size).toBe(
      visualStateRegistry.states.filter((state) => state.disposition === "solid-style").length,
    );
  });

  it("declares both sides of every shared appearance", () => {
    for (const state of visualStateRegistry.states) {
      for (const other of state.sharesAppearanceWith ?? []) {
        expect(visualStateById.get(other)?.sharesAppearanceWith, state.id).toContain(state.id);
      }
    }
  });

  it("names an owning cycle for a renderable state no selector reaches", () => {
    for (const state of visualStateRegistry.states) {
      if (!visualStateResolves(state.id)) continue;
      if (state.selectors.length > 0) continue;
      expect(state.ownerCycle, state.id).toMatch(/^\d{2}$/);
    }
  });

  it("resolves only states backed by a style or a state asset", () => {
    expect(visualStateResolves("clear-liquid")).toBe(true);
    expect(visualStateResolves("powder")).toBe(true);
    expect(visualStateResolves("CAL-00")).toBe(true);
    expect(visualStateById.get("syringe-filled")).toMatchObject({
      disposition: "state-asset",
      stateAssetEquipmentIds: ["luer-lock-syringe"],
    });
    expect(visualStateResolves("syringe-filled")).toBe(true);
    expect(visualStateResolves("not-a-state")).toBe(false);
  });
});

describe("composite registry", () => {
  it("references catalog equipment and registered assets", () => {
    for (const composite of compositeRegistry.composites) {
      expect(equipmentById.has(composite.parentDefinitionId), composite.id).toBe(true);
      for (const participant of composite.participants) {
        expect(
          equipmentById.has(participant.definitionId),
          `${composite.id}/${participant.definitionId}`,
        ).toBe(true);
        expect(compositeRegistry.participantRoleKinds, composite.id).toContain(
          participant.roleKind,
        );
      }
      expect(assetDispositionById.has(composite.resultAsset), composite.id).toBe(true);
    }
  });

  it("gives every composite exactly one parent participant, and only children carry snap zones", () => {
    for (const composite of compositeRegistry.composites) {
      const parents = composite.participants.filter((participant) => participant.parent);
      expect(parents.length, composite.id).toBe(1);
      expect(parents[0]?.definitionId, composite.id).toBe(composite.parentDefinitionId);
      expect(parents[0]?.snapZoneId, composite.id).toBeNull();
      expect(parents[0]?.suppressed, composite.id).toBe(false);
      for (const child of composite.participants.filter((participant) => !participant.parent)) {
        expect(child.snapZoneId, `${composite.id}/${child.role}`).toBeTruthy();
      }
    }
  });

  it("lists every visual composite in the renderer precedence chain, and no instance swap", () => {
    for (const composite of compositeRegistry.composites) {
      expect(compositeRegistry.rendererPrecedence.includes(composite.id), composite.id).toBe(
        composite.kind === "visual",
      );
    }
  });

  it("returns the ring-stand renderer composites in precedence order, excluding the swap", () => {
    // compositesForParent walks rendererPrecedence, so funnel-stand-assembly is absent by design:
    // an instance swap is not a renderer path.
    expect(compositesForParent("ring-stand").map((composite) => composite.id)).toEqual([
      "ring-stand-clay-triangle-crucible-lid-ajar",
      "ring-stand-clay-triangle",
    ]);
  });

  it("closed the funnel composite's missing snap prerequisite", () => {
    const funnel = compositeRegistry.composites.find(
      (composite) => composite.id === "funnel-stand-with-filter-paper",
    );
    expect(funnel?.deviations).not.toContain("no-snap-zone-prerequisite");
    expect(
      funnel?.participants.find((participant) => participant.definitionId === "filter-paper")
        ?.snapZoneId,
    ).toBe("funnel-stand-paper-seat");
  });

  it("declares composite-aware detach, recovery, and reset for every composite", () => {
    for (const composite of compositeRegistry.composites) {
      for (const behaviour of [composite.detach, composite.recovery, composite.reset]) {
        expect(behaviour.compositeAware, composite.id).toBe(true);
        expect(behaviour.evidence.length, composite.id).toBeGreaterThan(0);
      }
    }
  });

  it("requires invalid feedback exactly where a swap can be refused", () => {
    for (const composite of compositeRegistry.composites) {
      if (composite.kind === "instance-swap") {
        expect(composite.invalidFeedback?.message, composite.id).toBeTruthy();
        expect(composite.invalidFeedback?.recovery, composite.id).toBeTruthy();
        expect(composite.resultInstanceDefinitionId, composite.id).toBeTruthy();
      } else {
        expect(composite.invalidFeedback, composite.id).toBeNull();
        expect(composite.resultInstanceDefinitionId, composite.id).toBeNull();
      }
    }
  });
});

describe("realistic asset disposition registry", () => {
  it("classifies every image file in the realistic asset directory", () => {
    const entries = readdirSync(realisticDirectory, { withFileTypes: true });
    const files = new Set(
      entries.filter((entry) => entry.isFile() && /\.(svg|png)$/.test(entry.name)).map((entry) => entry.name),
    );
    for (const file of files) {
      const base = file.replace(/\.(svg|png)$/, "");
      if (file.endsWith(".png") && files.has(`${base}.svg`)) continue;
      expect(assetDispositionById.has(base), file).toBe(true);
    }
  });

  it("documents every non-image entry beside the assets", () => {
    const documented = new Set(assetDispositionRegistry.nonAssetEntries.map((entry) => entry.name));
    for (const entry of readdirSync(realisticDirectory, { withFileTypes: true })) {
      if (entry.isFile() && /\.(svg|png)$/.test(entry.name)) continue;
      expect(documented.has(entry.name), entry.name).toBe(true);
    }
  });

  it("gives every remediation candidate an owning cycle and a matching authored state", () => {
    for (const asset of assetDispositionRegistry.assets) {
      if (asset.disposition !== "remediation-candidate") continue;
      expect(asset.ownerCycle, asset.id).toMatch(/^\d{2}$/);
      expect(visualStateById.has(asset.matchingVisualState ?? ""), asset.id).toBe(true);
    }
  });
});

describe("image alias registry", () => {
  it("documents every realistic asset shared by more than one equipment definition", () => {
    const sharing = new Map<string, string[]>();
    for (const definition of equipmentById.values()) {
      const asset = definition.asset.split("/").pop()?.replace(/\.svg$/, "");
      if (!asset) continue;
      sharing.set(asset, [...(sharing.get(asset) ?? []), definition.id]);
    }
    const documented = new Set(imageAliasRegistry.aliases.map((alias) => alias.asset));
    for (const [asset, ids] of sharing) {
      if (ids.length < 2) continue;
      expect(documented.has(asset), asset).toBe(true);
    }
  });

  it("keeps aliased definitions semantically distinct", () => {
    for (const alias of imageAliasRegistry.aliases) {
      const labels = alias.equipmentIds.map((id) => equipmentById.get(id)?.label);
      expect(new Set(labels).size, alias.asset).toBe(alias.equipmentIds.length);
      const accessibleNames = alias.equipmentIds.map((id) => equipmentById.get(id)?.accessibleName);
      expect(new Set(accessibleNames).size, alias.asset).toBe(alias.equipmentIds.length);
    }
  });

  it("indexes each aliased equipment id back to its alias", () => {
    expect(aliasedEquipmentIds.get("waste-beaker")?.asset).toBe("beaker-250ml");
    expect(aliasedEquipmentIds.get("naoh-bottle")?.asset).toBe("reagent-bottle");
    expect(aliasedEquipmentIds.has("spectrophotometer")).toBe(false);
  });
});
