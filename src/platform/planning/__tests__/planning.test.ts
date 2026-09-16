import { describe, expect, it } from "vitest";
import { demoLab, standaloneTechniques } from "../../../domain/fixtures";
import { planChemistryClassRun, projectChemistryPlanningResources } from "../../../domain-packs/chemistry/planning/chemistryPlanner";
import {
  addDecimal,
  compareDecimal,
  formatDecimal,
  multiplyDecimal,
  parseDecimal,
} from "../decimal";
import { planResourceRun } from "../planner";
import { validateResourceRunContext, validateResourceRunPlan, validateResourceSpec } from "../schema";
import type { ResourceRunContext, ResourceSpec } from "../types";
import { convertQuantity, normalizeQuantity } from "../units";

const context: ResourceRunContext = {
  requestId: "planning-golden",
  participants: 10,
  grouping: { kind: "group-size", groupSize: 3 },
  sections: [{ id: "section-a", participantCount: 10 }],
  repeats: 2,
  technicalReplicates: 1,
  stations: [{ id: "balance-station", label: "Balance station" }],
  availableInventory: [],
  instrumentCapacities: [],
};

describe("exact decimal quantities and controlled units", () => {
  it("performs decimal arithmetic without binary floating-point drift", () => {
    expect(formatDecimal(addDecimal(parseDecimal("0.1"), parseDecimal("0.2")))).toBe("0.3");
    expect(formatDecimal(multiplyDecimal(parseDecimal("1.25"), parseDecimal("0.08")))).toBe("0.1");
    expect(compareDecimal(parseDecimal("1.000"), parseDecimal("1"))).toBe(0);
    expect(() => parseDecimal("1e-3")).toThrow("Invalid decimal string");
  });

  it("property-checks exact volume and mass conversions over representative decimal values", () => {
    for (let whole = 0; whole <= 100; whole += 1) {
      for (const fraction of ["", ".1", ".25", ".005"]) {
        const value = `${whole}${fraction}`;
        const millilitres = { value, unit: "mL" as const };
        const microlitres = convertQuantity(millilitres, "uL");
        expect(convertQuantity(microlitres, "mL")).toEqual({ value: formatDecimal(parseDecimal(value)), unit: "mL" });
        const grams = { value, unit: "g" as const };
        expect(convertQuantity(convertQuantity(grams, "mg"), "g")).toEqual({ value: formatDecimal(parseDecimal(value)), unit: "g" });
      }
    }
    expect(normalizeQuantity({ value: "1.5", unit: "L" })).toEqual({ value: "1500000", unit: "uL" });
    expect(() => convertQuantity({ value: "1", unit: "s" }, "min")).toThrow("finite exact decimal");
    expect(() => convertQuantity({ value: "1", unit: "mL" }, "g")).toThrow("not exactly convertible");
  });
});

describe("generic deterministic resource/run planner", () => {
  it("plans grouping, repeats, station waves, capacity, inventory shortages, preparation, and cleanup", () => {
    const specs: ResourceSpec[] = [{
      id: "balance",
      domainPackId: "chemistry",
      label: "Analytical balance",
      resourceClass: "instrument",
      quantity: { amount: { value: "1", unit: "1" }, basis: "group" },
      reuse: { mode: "reuse-across-waves" },
      capacity: {
        groupsPerUnitPerWave: 1,
        defaultUnitsAvailable: 2,
        stationId: "balance-station",
        waveDuration: { value: "5", unit: "min" },
        resetDuration: { value: "1", unit: "min" },
      },
      preparation: { task: "Calibrate the balance.", batchCount: 1, leadTime: { value: "10", unit: "min" } },
      cleanup: { task: "Brush and reset the balance pan.", duration: { value: "2", unit: "min" }, resetRequired: true },
      substitutionPolicy: {
        mode: "review-only",
        candidates: [{ resourceId: "top-loading-balance", label: "Top-loading balance", reason: "Review precision before substitution." }],
      },
      reviewFlags: [],
    }, {
      id: "sample",
      domainPackId: "chemistry",
      label: "Sample",
      resourceClass: "sample",
      quantity: { amount: { value: "2.5", unit: "g" }, basis: "group", multiplyByRepeats: true },
      overage: { kind: "percent", percent: "10" },
      deadVolume: { value: "0.5", unit: "g" },
      preparation: { task: "Prepare sample batch.", batchCount: 1 },
      reviewFlags: [],
    }];
    const first = planResourceRun(specs, {
      ...context,
      availableInventory: [{ resourceId: "sample", quantity: { value: "20", unit: "g" } }],
    });
    const second = planResourceRun(structuredClone(specs), structuredClone({
      ...context,
      availableInventory: [{ resourceId: "sample", quantity: { value: "20", unit: "g" } }],
    }));
    expect(first).toEqual(second);
    expect(first.contextSummary.groupCount).toBe(4);
    expect(first.requirements.find(({ resourceId }) => resourceId === "balance")?.required).toEqual({ value: "2", unit: "1" });
    expect(first.capacitySchedule[0]).toMatchObject({ groupsPerWave: 2, waves: 2, totalDuration: { value: "660", unit: "s" } });
    expect(first.stationWaves.map(({ groupIds }) => groupIds)).toEqual([
      ["group-1", "group-2"],
      ["group-3", "group-4"],
    ]);
    expect(first.requirements.find(({ resourceId }) => resourceId === "sample")?.required).toEqual({ value: "22.5", unit: "g" });
    expect(first.shortages[0]).toMatchObject({ resourceId: "sample", shortage: { value: "2.5", unit: "g" } });
    expect(first.status).toBe("incomplete");
    expect(first.preparationBatches).toHaveLength(2);
    expect(first.cleanupTasks).toHaveLength(1);
    expect(first.substitutionCandidates[0].reviewRequired).toBe(true);
    expect(specs.every((spec) => validateResourceSpec(spec).ok)).toBe(true);
    expect(validateResourceRunContext(context).ok).toBe(true);
    expect(validateResourceRunPlan(first).ok).toBe(true);
  });

  it("never double-applies declared overage or dead volume", () => {
    const spec = (includesOverage: boolean, includesDeadVolume: boolean): ResourceSpec => ({
      id: `reagent-${includesOverage}-${includesDeadVolume}`,
      domainPackId: "chemistry",
      label: "Prepared reagent",
      resourceClass: "reagent",
      quantity: {
        amount: { value: "110", unit: "mL" },
        basis: "fixed",
        includesOverage,
        includesDeadVolume,
      },
      overage: { kind: "percent", percent: "10" },
      deadVolume: { value: "5", unit: "mL" },
      preparation: { task: "Prepare reagent.", batchCount: 1 },
      reviewFlags: [],
    });
    const alreadyIncluded = planResourceRun([spec(true, true)], context).requirements[0];
    expect(alreadyIncluded.required).toEqual({ value: "110", unit: "mL" });
    expect(alreadyIncluded.formulaTrace.map(({ label }) => label)).toEqual([
      "base requirement", "overage already included", "dead volume already included",
    ]);
    const applied = planResourceRun([spec(false, false)], context).requirements[0];
    expect(applied.required).toEqual({ value: "126", unit: "mL" });
  });

  it("keeps missing chemistry metadata explicit instead of inferring runtime contents", () => {
    const completeProjection = projectChemistryPlanningResources(demoLab);
    expect(completeProjection.diagnostics).toEqual([]);
    const complete = planChemistryClassRun(demoLab, context, "chemistry-complete");
    expect(complete.status).toBe("complete");
    expect(complete.plan.requirements.length).toBeGreaterThan(10);
    expect(complete.requirementsCsv).toContain("resource_id,label");
    expect(complete.preparationChecklist).toContain("No purchases, reservations, or inventory changes were performed.");

    const incomplete = planChemistryClassRun(standaloneTechniques[0], context, "chemistry-incomplete");
    expect(incomplete.status).toBe("incomplete");
    expect(incomplete.plan.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "chemistry.planning.artifact-metadata-incomplete" }),
      expect.objectContaining({ code: "chemistry.planning.quantity-metadata-missing" }),
    ]));
    expect(incomplete.plan.requirements).toEqual([]);
  });

  it("rejects invalid context and schema versions explicitly", () => {
    const plan = planResourceRun([], { ...context, participants: 5 });
    expect(plan.status).toBe("incomplete");
    expect(plan.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "planning.context.section-participants-mismatch" }),
    ]));
    expect(validateResourceRunPlan({ ...plan, schemaVersion: "2.0" }).ok).toBe(false);
    expect(validateResourceRunContext({ ...context, participants: 0 }).ok).toBe(false);
    expect(validateResourceSpec({
      id: "bad",
      domainPackId: "chemistry",
      label: "Bad",
      resourceClass: "reagent",
      quantity: { amount: { value: "1e3", unit: "mL" }, basis: "fixed" },
      reviewFlags: [],
    }).ok).toBe(false);
  });

  it("supports deterministic domain extension hooks without mutating source specs", () => {
    const source: ResourceSpec[] = [{
      id: "base",
      domainPackId: "chemistry",
      label: "Base resource",
      resourceClass: "consumable",
      quantity: { amount: { value: "1", unit: "1" }, basis: "fixed" },
      reviewFlags: [],
    }];
    const plan = planResourceRun(source, context, {
      extension: {
        extendResources: (resources) => ({
          resources: [...resources, {
            id: "extension",
            domainPackId: "chemistry",
            label: "Extension resource",
            resourceClass: "service",
            quantity: { amount: { value: "1", unit: "1" }, basis: "section" },
            reviewFlags: [],
          }],
          diagnostics: [],
        }),
        extendPlan: (value) => ({ ...value, assumptions: [...value.assumptions, "Deterministic extension applied."] }),
      },
    });
    expect(source).toHaveLength(1);
    expect(plan.requirements.map(({ resourceId }) => resourceId)).toEqual(["base", "extension"]);
    expect(plan.assumptions).toContain("Deterministic extension applied.");
  });
});
