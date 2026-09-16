import { describe, expect, it } from "vitest";
import type { AcidBaseTitrationModel, ActionDefinition, LabDefinition, TitrationModelDefinition } from "../types";
import {
  calculateAcidBasePh,
  deriveTitrationDropPlan,
  resolveActionTitrationParameters,
} from "../titrationModels";

const model = (overrides: Partial<AcidBaseTitrationModel> = {}): AcidBaseTitrationModel => ({
  id: "acid-base-model",
  type: "acidBase",
  analyte: {
    formula: "CH3COOH",
    role: "acid",
    strength: "weak",
    equilibriumConstant: 1.753e-5,
  },
  titrant: { formula: "NaOH", role: "base", strength: "strong" },
  analyteMolarityM: 0.1,
  analyteVolumeMl: 25,
  titrantMolarityM: 0.1,
  temperatureC: 25,
  waterIonProduct: 1e-14,
  phPrecision: 2,
  ...overrides,
});

const action: ActionDefinition = {
  id: "dispense",
  verb: "transfer",
  label: "Dispense titrant",
  parameters: {
    titrationModelId: "acid-base-model",
    sourceDefinitionId: "burette-50ml",
    targetDefinitionId: "erlenmeyer-flask-250ml",
    initialBuretteReadingMl: 0.2,
    dropVolumeMl: 0.1,
    endpointDropCount: 1,
    equivalenceDropCount: 1,
    volumeMl: 0.1,
    maxExtraDrops: 0,
  },
  interaction: {
    type: "dispenseDrops",
    sourceDefinitionId: "burette-50ml",
    targetDefinitionId: "erlenmeyer-flask-250ml",
    accessibleLabel: "Dispense drops.",
  },
  prerequisites: [],
  stateChanges: [],
  invalidCases: [],
  feedback: {
    success: "Done.",
    invalid: "Try again.",
  },
  evidence: ["transfer"],
};

const lab = (models: TitrationModelDefinition[]): LabDefinition => ({
  id: "test-lab",
  title: "Test lab",
  description: "Test lab.",
  audience: "Students",
  learningGoals: [],
  safetyNotes: [],
  equipment: ["burette-50ml", "erlenmeyer-flask-250ml"],
  titrationModels: models,
  techniques: [],
  actions: [action],
  process: { startNodeId: "start", nodes: [], edges: [] },
  assessments: [],
  metadata: {
    version: "1.0.0",
    author: "Test",
    updatedAt: "2026-05-15T00:00:00.000Z",
    tags: [],
  },
});

describe("titration model derivation", () => {
  it("calculates weak-acid initial, buffer, equivalence, and overshoot regions", () => {
    const aceticAcid = model({ analyteMolarityM: 0.0992 });

    expect(calculateAcidBasePh(aceticAcid, 0).ph).toBeCloseTo(2.88, 2);
    expect(calculateAcidBasePh(aceticAcid, 12.4).ph).toBeCloseTo(-Math.log10(1.753e-5), 6);
    expect(calculateAcidBasePh(aceticAcid, 24.8)).toMatchObject({ region: "equivalence" });
    expect(calculateAcidBasePh(aceticAcid, 24.8).ph).toBeCloseTo(8.7267, 4);
    expect(calculateAcidBasePh(aceticAcid, 25.05)).toMatchObject({ region: "excess-titrant" });
    expect(calculateAcidBasePh(aceticAcid, 25.05).ph).toBeGreaterThan(10);
  });

  it("keeps strong-acid/strong-base equivalence neutral at 25 C", () => {
    const strongAcid = model({
      analyte: { formula: "HCl", role: "acid", strength: "strong" },
      titrant: { formula: "NaOH", role: "base", strength: "strong" },
      analyteMolarityM: 0.1,
    });

    expect(calculateAcidBasePh(strongAcid, 25).ph).toBeCloseTo(7, 8);
  });

  it("rejects a weak species with no equilibrium constant", () => {
    expect(() => calculateAcidBasePh(model({
      analyte: { formula: "CH3COOH", role: "acid", strength: "weak" },
    }), 0)).toThrow(/equilibriumConstant/);
  });

  it("derives exact whole-drop equivalence and endpoint readings", () => {
    const plan = deriveTitrationDropPlan(
      model({
        analyteMolarityM: 0.0992,
        analyteVolumeMl: 25,
        titrantMolarityM: 0.1,
        dropVolumeMl: 0.05,
      }),
      { initialBuretteReadingMl: 0.2 },
    );

    expect(plan.theoreticalEquivalenceVolumeMl).toBe(24.8);
    expect(plan.equivalenceDropCount).toBe(496);
    expect(plan.endpointDropCount).toBe(496);
    expect(plan.endpointDeliveredVolumeMl).toBe(24.8);
    expect(plan.expectedFinalBuretteReadingMl).toBe(25);
    expect(plan.expectedAnalyteMolarityM).toBe(0.0992);
  });

  it("rounds fractional equivalence to the first whole drop at or above equivalence", () => {
    const plan = deriveTitrationDropPlan(model({ analyteVolumeMl: 10, dropVolumeMl: 0.06 }));

    expect(plan.theoreticalEquivalenceVolumeMl).toBe(10);
    expect(plan.exactEquivalenceDropCount).toBeCloseTo(166.6667);
    expect(plan.equivalenceDropCount).toBe(167);
    expect(plan.endpointDeliveredVolumeMl).toBe(10.02);
  });

  it("supports non-1:1 acid-base stoichiometry", () => {
    const plan = deriveTitrationDropPlan(model({
      stoichiometricRatio: { analyte: 2, titrant: 1 },
    }));

    expect(plan.theoreticalEquivalenceVolumeMl).toBe(12.5);
    expect(plan.equivalenceDropCount).toBe(250);
  });

  it("applies endpoint offsets after the equivalence drop", () => {
    const plan = deriveTitrationDropPlan(model({
      analyteVolumeMl: 10,
      dropVolumeMl: 0.06,
      endpointOffsetDrops: 2,
    }));

    expect(plan.equivalenceDropCount).toBe(167);
    expect(plan.endpointDropCount).toBe(169);
    expect(plan.endpointDeliveredVolumeMl).toBe(10.14);
  });

  it("rejects invalid model values", () => {
    expect(() => deriveTitrationDropPlan(model({ dropVolumeMl: 0 }))).toThrow(/dropVolumeMl/);
    expect(() => deriveTitrationDropPlan(model({ endpointOffsetDrops: 0.5 }))).toThrow(/endpointOffsetDrops/);
    expect(() =>
      deriveTitrationDropPlan(model({ stoichiometricRatio: { analyte: 0, titrant: 1 } })),
    ).toThrow(/stoichiometricRatio/);
  });

  it("lets model-derived values win while preserving legacy explicit fallback", () => {
    const resolved = resolveActionTitrationParameters(lab([
      model({
        analyteMolarityM: 0.0992,
        analyteVolumeMl: 25,
        titrantMolarityM: 0.1,
        dropVolumeMl: 0.05,
        maxExtraDrops: 5,
      }),
    ]), action);

    expect(resolved.parameters).toMatchObject({
      dropVolumeMl: 0.05,
      endpointDropCount: 496,
      equivalenceDropCount: 496,
      volumeMl: 24.8,
      maxExtraDrops: 5,
    });

    const legacy = {
      ...action,
      parameters: {
        ...action.parameters,
        titrationModelId: undefined,
        endpointDropCount: 12,
        dropVolumeMl: 0.04,
      },
    };
    expect(resolveActionTitrationParameters(lab([]), legacy)).toBe(legacy);
    expect(resolveActionTitrationParameters(lab([]), legacy).parameters.endpointDropCount).toBe(12);
  });
});
