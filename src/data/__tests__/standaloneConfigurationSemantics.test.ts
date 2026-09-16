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
  it("accepts a physically consistent dilution and rejects inconsistent factor/capacity/source volume", async () => {
    const definition = await readTechnique("dilution");

    expect(validateStandaloneConfigurationSemantics(definition, values({
      aliquotVolumeMl: 5,
      finalVolumeMl: 50,
      dilutionFactor: 10,
    }))).toEqual([]);

    expect(validateStandaloneConfigurationSemantics(definition, values({
      aliquotVolumeMl: 5,
      finalVolumeMl: 50,
      dilutionFactor: 8,
    })).some((issue) => issue.message.includes("finalVolumeMl / aliquotVolumeMl"))).toBe(true);

    expect(validateStandaloneConfigurationSemantics(definition, values({
      aliquotVolumeMl: 11,
      finalVolumeMl: 55,
      dilutionFactor: 5,
    })).some((issue) => issue.message.includes("starting volume of 10 mL"))).toBe(true);

    expect(validateStandaloneConfigurationSemantics(definition, values({
      aliquotVolumeMl: 5,
      finalVolumeMl: 120,
      dilutionFactor: 24,
    })).some((issue) => issue.message.includes("capacity of 100 mL"))).toBe(true);
  });

  it("rejects non-positive solution quantities and final volume below initial solvent", async () => {
    const definition = await readTechnique("making-solution");

    expect(validateStandaloneConfigurationSemantics(definition, values({
      initialSolventVolumeMl: 50,
      soluteMassG: 2.5,
      finalVolumeMl: 100,
    }))).toEqual([]);

    expect(validateStandaloneConfigurationSemantics(definition, values({
      initialSolventVolumeMl: 50,
      soluteMassG: 0,
      finalVolumeMl: 100,
    })).some((issue) => issue.message.includes("soluteMassG must be greater than zero"))).toBe(true);

    expect(validateStandaloneConfigurationSemantics(definition, values({
      initialSolventVolumeMl: 80,
      soluteMassG: 2.5,
      finalVolumeMl: 50,
    })).some((issue) => issue.message.includes("at least the initial solvent volume"))).toBe(true);
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
