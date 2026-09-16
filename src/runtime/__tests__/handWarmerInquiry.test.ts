import { describe, expect, it } from "vitest";
import {
  generateInquiryExecutionScopes,
  type InquiryPlan,
  validateInquiryPlan,
} from "../inquiryPlan";

const plan: InquiryPlan = {
  waterVolumeMl: 50,
  volumeEquipmentId: "graduated-cylinder",
  weighingEquipmentId: "analytical-balance",
  calorimeterEquipmentId: "hand-warmer-calorimeter",
  startingTemperatureMethod: "wait for a stable probe reading",
  endingTemperatureCriterion: "temperature change below 0.1 C over 10 s",
  controlledVariables: ["water volume", "cup assembly"],
  safetyPrecautions: ["goggles", "gloves", "compound SDS"],
  measurements: ["water amount", "solid amount", "starting temperature", "ending temperature"],
  solids: [
    { solidId: "cacl2", solidLabel: "Calcium chloride", massG: 3, trials: 2, disposalMethod: "teacher waste" },
    { solidId: "nh4no3", solidLabel: "Ammonium nitrate", massG: 3, trials: 2, disposalMethod: "teacher waste" },
    { solidId: "naoac", solidLabel: "Sodium acetate", massG: 3, trials: 2, disposalMethod: "teacher waste" },
  ],
};

describe("student-designed hand-warmer inquiry", () => {
  it("enforces only manual rules by default and generates the chosen workflow", () => {
    expect(validateInquiryPlan(plan)).toEqual({ accepted: true, findings: [] });
    const scopes = generateInquiryExecutionScopes(plan);
    expect(scopes).toHaveLength(6);
    expect(scopes[0]).toMatchObject({
      id: "cacl2-trial-1",
      waterVolumeMl: 50,
      solidMassG: 3,
      endingTemperatureCriterion: plan.endingTemperatureCriterion,
    });
    expect(scopes[0].actionIds).toEqual([
      "INV-X01", "INV-X02", "INV-X03", "INV-X04", "INV-X05", "INV-X06",
      "INV-X07", "INV-X08", "INV-X09", "INV-X10", "INV-X11", "INV-X12",
    ]);
  });

  it("classifies optional teacher rules separately from manual constraints", () => {
    const result = validateInquiryPlan(plan, { requiredWaterVolumeMl: 100, requireEqualMasses: true });
    expect(result.accepted).toBe(false);
    expect(result.findings).toEqual([
      expect.objectContaining({ field: "waterVolumeMl", classification: "teacher" }),
    ]);
  });

  it("blocks more than 10 g total per solid without forcing equal mass, moles, or endpoints", () => {
    const invalid = {
      ...plan,
      solids: plan.solids.map((solid, index) =>
        index === 0 ? { ...solid, massG: 6, trials: 2 } : solid,
      ),
    };
    const result = validateInquiryPlan(invalid);
    expect(result.accepted).toBe(false);
    expect(result.findings).toEqual([
      expect.objectContaining({ field: "solids.cacl2.massG", classification: "manual" }),
    ]);
  });

  it("rejects duplicate solids and non-whole or non-positive trial counts", () => {
    const invalid = {
      ...plan,
      solids: [
        { ...plan.solids[0], trials: 0 },
        { ...plan.solids[0], trials: 1.5 },
        plan.solids[2],
      ],
    };
    const result = validateInquiryPlan(invalid);
    expect(result.accepted).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "solids", classification: "manual" }),
        expect.objectContaining({ field: "solids.cacl2.trials", classification: "manual" }),
      ]),
    );
  });
});
