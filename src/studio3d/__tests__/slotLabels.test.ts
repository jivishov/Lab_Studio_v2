import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { configurationSlots } from "../../data/techniqueConfiguration";
import type { TechniqueDefinition } from "../../domain/types";
import { fallbackSlotLabel, hasExplicitSlotLabel } from "../copy/slotLabels";

const readTechnique = (id: string): TechniqueDefinition =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8")) as TechniqueDefinition;

describe("teacher-facing slot labels (decision U10)", () => {
  it.each(["weighing", "measuring-volume", "making-solution", "dilution", "transmittance-dilution"])(
    "labels every %s slot explicitly",
    (id) => {
      for (const slot of configurationSlots(readTechnique(id))) {
        expect(hasExplicitSlotLabel(slot.id), slot.id).toBe(true);
      }
    },
  );

  it("falls back to a readable label with the unit from the id", () => {
    expect(fallbackSlotLabel("rinseVolumeMl")).toEqual({ label: "Rinse volume", unit: "mL" });
    expect(fallbackSlotLabel("dryMassMeasurementId")).toEqual({ label: "Dry mass record name" });
  });
});
