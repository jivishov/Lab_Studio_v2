import { describe, expect, it } from "vitest";
import {
  aggregateCalorimeterConstants,
  calculateCalorimeterCalibration,
  calculateDissolutionEnergy,
  calculateHandWarmerMassG,
  generateTemperatureResponse,
  seededVariation,
} from "../calculations";

describe("hand-warmer calorimetry calculations", () => {
  it("uses the signed page-103 calibration balance", () => {
    const result = calculateCalorimeterCalibration({
      coldVolumeMl: 100,
      hotVolumeMl: 100,
      coldInitialC: 20,
      hotInitialC: 50,
      mixtureC: 34,
    });
    expect(result.qColdJ).toBeCloseTo(5857.6, 8);
    expect(result.qHotJ).toBeCloseTo(-6694.4, 8);
    expect(result.qCalJ).toBeCloseTo(836.8, 8);
    expect(result.calorimeterConstantJPerC).toBeCloseTo(59.77142857, 8);
  });

  it("rejects physically inconsistent calibration data and aggregates configured determinations", () => {
    expect(() =>
      calculateCalorimeterCalibration({
        coldVolumeMl: 100,
        hotVolumeMl: 100,
        coldInitialC: 20,
        hotInitialC: 50,
        mixtureC: 52,
      }),
    ).toThrow(/between/);
    expect(aggregateCalorimeterConstants([58, 60, 64])).toBeCloseTo(60.6666667, 6);
    expect(aggregateCalorimeterConstants([58, 60, 64], "median")).toBe(60);
  });

  it("keeps normalized dissolution signs and converts to kJ/mol", () => {
    const result = calculateDissolutionEnergy({
      waterVolumeMl: 100,
      soluteMassG: 5,
      molarMassGPerMol: 120.366,
      initialC: 21.4,
      endingC: 35.6,
      calorimeterConstantJPerC: 60,
    });
    expect(result.deltaTC).toBeCloseTo(14.2, 10);
    expect(result.qThermalJ).toBeGreaterThan(0);
    expect(result.qCalJ).toBeGreaterThan(0);
    expect(result.qDissolutionJ).toBeLessThan(0);
    expect(result.deltaHSolutionKJPerMol).toBeLessThan(0);
  });

  it("scales a 50 mL design to no more than a 20 degree rise", () => {
    const mass = calculateHandWarmerMassG(900, 50, 20, 60);
    const predictedRise = (mass * 900) / (50 * 4.184 + 60);
    expect(predictedRise).toBeCloseTo(20, 10);
  });

  it("generates deterministic response data that rises to a peak and then cools", () => {
    expect(seededVariation(42, 0.1)).toBe(seededVariation(42, 0.1));
    const options = {
      durationS: 60,
      sampleEveryS: 5,
      peakTimeS: 20,
      noiseAmplitudeC: 0,
    };
    const first = generateTemperatureResponse(20, 35, 7, options);
    const second = generateTemperatureResponse(20, 35, 7, options);
    expect(first).toEqual(second);
    expect(first).toHaveLength(13);
    const peak = Math.max(...first.map((point) => point.y));
    expect(peak).toBe(35);
    expect(first.at(-1)?.y).toBeLessThan(peak);
    expect(first.at(-1)?.y).toBeGreaterThan(first[0].y);
  });
});
