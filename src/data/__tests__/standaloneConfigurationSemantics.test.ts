import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  TechniqueConfigurationValue,
  TechniqueDefinition,
} from "../../domain/types";
import { validateStandaloneConfigurationSemantics } from "../standaloneConfigurationSemantics";

/** Authored regression coverage; intentionally not executed under the current verification ceiling. */
const readTechnique = async (id: string): Promise<TechniqueDefinition> =>
  JSON.parse(
    await readFile(join(process.cwd(), "public", "techniques", `${id}.json`), "utf8"),
  ) as TechniqueDefinition;

const values = (entries: Record<string, TechniqueConfigurationValue>) =>
  new Map<string, TechniqueConfigurationValue>(Object.entries(entries));

describe("standalone configuration physical semantics", () => {
  it("accepts a physically consistent dilution and rejects an aliquot the pipette cannot deliver", async () => {
    // Dilute a Stock Solution delivers its aliquot from a 10 mL graduated pipette into a 100 mL
    // volumetric flask (decided 2026-10-02): the factor is calculated, not set.
    const definition = await readTechnique("dilution");

    expect(validateStandaloneConfigurationSemantics(definition, values({
      aliquotVolumeMl: 5,
      stockConcentrationM: 0.2,
    }))).toEqual([]);

    expect(validateStandaloneConfigurationSemantics(definition, values({
      aliquotVolumeMl: 11,
      stockConcentrationM: 0.2,
    })).some((issue) => issue.message.includes("at most 10 mL"))).toBe(true);

    expect(validateStandaloneConfigurationSemantics(definition, values({
      aliquotVolumeMl: 5,
      stockConcentrationM: 0,
    })).some((issue) => issue.message.includes("stockConcentrationM must be greater than zero"))).toBe(true);
  });

  it("keeps the solid's mass positive and small enough to dissolve in the half-full flask (decided 2026-10-04)", async () => {
    const definition = await readTechnique("making-solution");

    expect(validateStandaloneConfigurationSemantics(definition, values({ soluteMassG: 2.5 }))).toEqual([]);

    expect(validateStandaloneConfigurationSemantics(definition, values({ soluteMassG: 0 }))
      .some((issue) => issue.message.includes("soluteMassG must be greater than zero"))).toBe(true);

    expect(validateStandaloneConfigurationSemantics(definition, values({ soluteMassG: 12 }))
      .some((issue) => issue.message.includes("at most 10 g"))).toBe(true);
  });

  it("honors the hard-water ranges stated by the authored drying actions", async () => {
    const definition = await readTechnique("hard-water-gravimetry");

    expect(validateStandaloneConfigurationSemantics(definition, values({
      ovenTemperatureC: 115,
      firstDurationMinutes: 12,
      coolingTemperatureC: 25,
    }))).toEqual([]);

    const tooCoolOven = validateStandaloneConfigurationSemantics(definition, values({
      ovenTemperatureC: 109,
      firstDurationMinutes: 12,
      coolingTemperatureC: 25,
    }));
    expect(tooCoolOven.some((issue) => issue.message.includes("110-120 °C"))).toBe(true);

    const tooShort = validateStandaloneConfigurationSemantics(definition, values({
      ovenTemperatureC: 115,
      firstDurationMinutes: 9,
      coolingTemperatureC: 25,
    }));
    expect(tooShort.some((issue) => issue.message.includes("10-15 minute"))).toBe(true);

    const notCooling = validateStandaloneConfigurationSemantics(definition, values({
      ovenTemperatureC: 115,
      firstDurationMinutes: 12,
      coolingTemperatureC: 115,
    }));
    expect(notCooling.some((issue) => issue.message.includes("must be below ovenTemperatureC"))).toBe(true);
  });
});
