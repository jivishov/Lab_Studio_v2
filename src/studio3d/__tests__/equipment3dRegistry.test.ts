import { describe, expect, it } from "vitest";
import registryJson from "../equipment3d/registry.json";
import {
  equipment3dEntry,
  equipment3dReadiness,
  equipment3dRegistry,
  parseEquipment3DRegistry,
} from "../equipment3d/readiness";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("equipment3d registry", () => {
  it("parses the generated registry and indexes entries by definition id", () => {
    expect(equipment3dRegistry.entries.length).toBeGreaterThan(0);
    expect(equipment3dEntry("wash-bottle")?.fill?.capacityMl).toBe(500);
  });

  it("keeps contents out of models: the wash bottle declares a fill profile, not baked liquid", () => {
    const entry = equipment3dEntry("wash-bottle");
    expect(entry?.fill?.innerProfileMm?.length).toBeGreaterThan(2);
    expect(entry?.displays).toEqual([]);
  });

  it("reports missing models without treating readiness as sufficient", () => {
    expect(equipment3dReadiness(["wash-bottle", "wash-bottle"])).toEqual({ ready: true, missing: [] });
    expect(equipment3dReadiness(["wash-bottle", "not-a-definition"])).toEqual({
      ready: false,
      missing: ["not-a-definition"],
    });
  });

  it("rejects widened or malformed literal fields", () => {
    const bad = clone(registryJson) as { entries: Array<Record<string, any>> };
    bad.entries[0].footprintMm.shape = "blob";
    expect(() => parseEquipment3DRegistry(bad)).toThrow(/footprintMm.shape/);
    const badLip = clone(registryJson) as { entries: Array<Record<string, any>> };
    badLip.entries[0].pour.lipMm = [1, 2];
    expect(() => parseEquipment3DRegistry(badLip)).toThrow(/pour.lipMm/);
  });
});
