import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { interactionZoneById } from "../../domain/interactionZones";
import { equipmentById } from "../catalog";
import {
  getVisualStateAsset,
  handWarmerCalorimeterStateAssets,
  v1VisualCatalog,
} from "../visualCatalog";

const handWarmerEquipmentIds = [
  "beaker-150ml",
  "polystyrene-cup-8oz",
  "wooden-calorimeter-cover",
  "probe-thermometer",
  "magnetic-stir-bar",
  "weigh-boat",
  "hand-warmer-calorimeter",
] as const;

const expectedZones = {
  "analytical-balance-pan": ["weigh-boat"],
  "ring-stand-calorimeter-support": ["polystyrene-cup-8oz"],
  "hand-warmer-stirrer-base": ["hot-plate-stirrer"],
  "hand-warmer-cup-support-ring": ["polystyrene-cup-8oz"],
  "hand-warmer-inner-cup-nest": ["polystyrene-cup-8oz"],
  "hand-warmer-cover-seat": ["wooden-calorimeter-cover"],
  "hand-warmer-probe-hole": ["probe-thermometer"],
  "hand-warmer-stir-bar-well": ["magnetic-stir-bar"],
  "polystyrene-cup-inner-nest": ["polystyrene-cup-8oz"],
  "polystyrene-cup-cover-seat": ["wooden-calorimeter-cover"],
  "polystyrene-cup-stir-bar-zone": ["magnetic-stir-bar"],
  "wooden-cover-probe-hole": ["probe-thermometer"],
  "hot-plate-stirrer-deck": ["beaker-150ml"],
} as const;

const publicFile = (assetPath: string): string =>
  join(process.cwd(), "public", assetPath.replace(/^\//, ""));

describe("hand-warmer calorimetry Phase 7 equipment", () => {
  it("registers every missing apparatus definition and visual profile", () => {
    for (const equipmentId of handWarmerEquipmentIds) {
      const definition = equipmentById.get(equipmentId);
      const profile = v1VisualCatalog[equipmentId];

      expect(definition, equipmentId).toBeDefined();
      expect(definition?.accessibleName.trim(), equipmentId).not.toBe("");
      expect(profile, equipmentId).toBeDefined();
      expect(profile?.equipmentDefinitionId, equipmentId).toBe(equipmentId);
      expect(existsSync(publicFile(profile?.assetId ?? "")), equipmentId).toBe(true);
    }

    expect(equipmentById.get("beaker-150ml")?.capacity).toEqual({
      amount: 150,
      unit: "mL",
    });
    expect(equipmentById.get("polystyrene-cup-8oz")?.capacity).toEqual({
      amount: 237,
      unit: "mL",
    });
    expect(equipmentById.get("hand-warmer-calorimeter")?.shelfPlaceable).toBe(false);
  });

  it("registers the approved assembly and measurement zones in both catalogs", () => {
    for (const [zoneId, acceptedEquipment] of Object.entries(expectedZones)) {
      const zone = interactionZoneById.get(zoneId);
      const ownerProfile = zone ? v1VisualCatalog[zone.ownerDefinitionId] : undefined;

      expect(zone, zoneId).toBeDefined();
      expect(zone?.accepts, zoneId).toEqual(
        expect.arrayContaining([...acceptedEquipment]),
      );
      expect(
        ownerProfile?.visualZones.some((visualZone) => visualZone.id === zoneId),
        zoneId,
      ).toBe(true);
    }

    for (const zoneId of [
      "hand-warmer-stirrer-base",
      "hand-warmer-cup-support-ring",
      "hand-warmer-inner-cup-nest",
      "hand-warmer-cover-seat",
      "hand-warmer-probe-hole",
      "hand-warmer-stir-bar-well",
    ]) {
      expect(interactionZoneById.get(zoneId)?.ownerDefinitionId, zoneId).toBe(
        "hand-warmer-calorimeter",
      );
    }

    const probeHole = v1VisualCatalog["hand-warmer-calorimeter"].visualZones.find(
      (zone) => zone.id === "hand-warmer-probe-hole",
    );
    expect(probeHole?.bounds.width).toBeGreaterThanOrEqual(56);
    expect(probeHole?.bounds.height).toBeGreaterThanOrEqual(56);
    expect(probeHole?.anchor).toEqual({ x: 235, y: 150 });
  });

  it("maps every CAL-00 through CAL-12 state to an existing composite wrapper", () => {
    expect(Object.keys(handWarmerCalorimeterStateAssets)).toHaveLength(13);

    for (let index = 0; index <= 12; index += 1) {
      const stateId = `CAL-${String(index).padStart(2, "0")}`;
      const assetPath = getVisualStateAsset("hand-warmer-calorimeter", stateId);

      expect(assetPath, stateId).toBe(
        `/assets/equipment-realistic/v1/hand-warmer-calorimeter-${stateId.toLowerCase()}.svg`,
      );
      expect(existsSync(publicFile(assetPath ?? "")), stateId).toBe(true);
    }
  });
});
