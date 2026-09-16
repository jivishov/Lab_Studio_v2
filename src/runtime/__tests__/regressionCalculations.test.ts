import { describe, expect, it } from "vitest";
import {
  calculateConcentrationSeries,
  calculateDilutionAliquotMl,
  calculateLinearRegression,
  calculateNitricAcidVolumeMl,
  calculatePercentDifference,
  calculateVisualComparisonConcentration,
  transformRegressionSeries,
} from "../calculations";

describe("evidence-derived regression calculations", () => {
  it("returns slope, intercept, R-squared, and point count", () => {
    const result = calculateLinearRegression([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ]);

    expect(result).toMatchObject({ slope: 2, intercept: 1, rSquared: 1, pointCount: 3 });
  });

  it("converts absorbance with the recorded calibration model", () => {
    expect(calculateConcentrationSeries(
      [{ x: 15, y: 0.397 }, { x: 45, y: 0.277 }],
      { slope: 0.038, intercept: 0.001 },
    )).toEqual([
      { x: 15, y: expect.closeTo(10.4210526, 6) },
      { x: 45, y: expect.closeTo(7.2631579, 6) },
    ]);
  });

  it("supports the three integrated-rate-law transforms", () => {
    const series = [{ x: 0, y: 2 }, { x: 1, y: 1 }];
    expect(transformRegressionSeries(series, "identity")).toEqual(series);
    expect(transformRegressionSeries(series, "ln")[0].y).toBeCloseTo(Math.log(2));
    expect(transformRegressionSeries(series, "reciprocal")).toEqual([
      { x: 0, y: 0.5 },
      { x: 1, y: 1 },
    ]);
  });

  it("rejects incomplete and scientifically invalid operands", () => {
    expect(() => calculateLinearRegression([{ x: 0, y: 1 }])).toThrow(/at least two/i);
    expect(() => transformRegressionSeries([{ x: 0, y: 0 }], "ln")).toThrow(/positive/i);
    expect(() => calculateConcentrationSeries([{ x: 0, y: 1 }], { slope: 0, intercept: 0 })).toThrow(/non-zero/i);
  });

  it("derives the brass preparation and visual-comparison quantities", () => {
    expect(calculateNitricAcidVolumeMl(1.25)).toBeCloseTo(3.32, 2);
    expect(calculateDilutionAliquotMl(0.4, 0.2, 10)).toBeCloseTo(5, 6);
    expect(calculateVisualComparisonConcentration(0.4, 42, 105)).toBeCloseTo(0.16, 6);
    expect(calculatePercentDifference(80, 82)).toBeCloseTo(2.4691, 4);
  });
});
