import { describe, expect, it } from "vitest";
import {
  assignControlToWells,
  upsertReplicateGroupAssignment,
} from "../assignments";
import { evaluateAssayQc } from "../engine";
import {
  createCycle08QcAssayFixture,
  cycle08ObservationSet,
  cycle08QcRuleSet,
  getCycle08QcGoldenFixture,
} from "../__fixtures__/cycle08QcFixture";
import {
  createAssayQcChartProjection,
  createAssayQcTableProjection,
} from "../projection";
import {
  validateAssayObservationSet,
  validateAssayQcEvaluation,
  validateAssayQcRuleSet,
} from "../validation";

describe("Cycle 08 controls, replicates, and configurable QC", () => {
  it("validates positive/version-negative public schemas and explicit provenance", () => {
    const assay = createCycle08QcAssayFixture();
    expect(validateAssayObservationSet(cycle08ObservationSet, assay).ok).toBe(true);
    expect(validateAssayQcRuleSet(cycle08QcRuleSet, assay).ok).toBe(true);
    expect(validateAssayObservationSet(
      { ...cycle08ObservationSet, schemaVersion: "2.0" },
      assay,
    ).ok).toBe(false);
    expect(validateAssayQcRuleSet(
      { ...cycle08QcRuleSet, schemaVersion: "2.0" },
      assay,
    ).ok).toBe(false);
    expect(cycle08QcRuleSet.policySource.sourceKind).toBe("fixture");
    expect(cycle08QcRuleSet.policySource.limitations.join(" ")).toContain("not externally sourced");
  });

  it("applies immutable control and reciprocal replicate assignments", () => {
    const assay = createCycle08QcAssayFixture();
    const before = structuredClone(assay);
    const assigned = assignControlToWells(assay, "control-high", ["H10", "H11"]);
    expect(assay).toEqual(before);
    expect(assigned.plate.wells.filter(({ coordinate }) => ["H10", "H11"].includes(coordinate)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ controlRef: "control-high", role: "positiveControl" }),
      ]));
    const replicated = upsertReplicateGroupAssignment(
      assigned,
      {
        id: "replicate-explicit",
        type: "technical",
        minimumCount: 2,
        aggregation: "median",
        variabilityMetric: "range",
      },
      ["H10", "H11"],
    );
    const group = replicated.replicateGroups.find(({ id }) => id === "replicate-explicit")!;
    expect(group.memberWellIds).toEqual(["assay-cycle06-plate:H10", "assay-cycle06-plate:H11"]);
    expect(replicated.plate.wells.filter(({ coordinate }) => ["H10", "H11"].includes(coordinate))
      .every(({ replicateGroupRefs }) => replicateGroupRefs.includes(group.id))).toBe(true);
    expect(() => upsertReplicateGroupAssignment(
      assigned,
      { id: "too-small", type: "technical", minimumCount: 2, aggregation: "mean" },
      ["H10"],
    )).toThrow(/requires at least 2 wells/i);
  });

  it("reproduces blank correction, normalization, SD/CV, control separation, and optional Z-prime", () => {
    const fixture = getCycle08QcGoldenFixture();
    expect(validateAssayQcEvaluation(fixture.evaluation).ok).toBe(true);
    expect(fixture.evaluation.status).toBe("pass");
    const sample = fixture.evaluation.wellResults.find(({ coordinate }) => coordinate === "D5")!;
    expect(sample.correctedValue).toBe("0.5");
    expect(sample.normalizedValue).toBe("55.555556");
    const replicate = fixture.evaluation.replicateSummaries.find(
      ({ replicateGroupRef }) => replicateGroupRef === "replicate-sample",
    )!;
    expect(replicate.aggregateValue).toBe("0.5");
    expect(replicate.variabilityMetric).toBe("cv");
    expect(replicate.variabilityValue).toBe("4");
    expect(fixture.evaluation.ruleResults.find(({ ruleId }) => ruleId === "z-prime"))
      .toEqual(expect.objectContaining({ status: "pass", metricValue: "0.8875" }));
  });

  it("returns indeterminate when preconditions are absent instead of fabricating a pass", () => {
    const assay = createCycle08QcAssayFixture();
    const observations = {
      ...structuredClone(cycle08ObservationSet),
      observations: cycle08ObservationSet.observations.filter(
        ({ wellId }) => !wellId.endsWith(":A1") && !wellId.endsWith(":A2") && !wellId.endsWith(":A3"),
      ),
    };
    const evaluation = evaluateAssayQc(assay, observations, cycle08QcRuleSet);
    expect(evaluation.status).toBe("indeterminate");
    expect(evaluation.ruleResults.find(({ ruleId }) => ruleId === "blank-correction"))
      .toEqual(expect.objectContaining({ status: "indeterminate" }));
    expect(evaluation.ruleResults.every(({ summary }) => !summary.includes("assumed"))).toBe(true);
  });

  it("flags edge/drift/outlier review without deleting any observation", () => {
    const assay = createCycle08QcAssayFixture();
    const observations = structuredClone(cycle08ObservationSet);
    const sample = observations.observations.find(({ wellId }) => wellId.endsWith(":D7"))!;
    sample.rawValue = "0.9";
    const evaluation = evaluateAssayQc(assay, observations, cycle08QcRuleSet);
    expect(evaluation.outlierFlags).toEqual([
      expect.objectContaining({ ruleId: "sample-outlier-review", wellId: sample.wellId }),
    ]);
    expect(evaluation.wellResults).toHaveLength(cycle08ObservationSet.observations.length);
    expect(evaluation.wellResults.find(({ wellId }) => wellId === sample.wellId)?.flags)
      .toContain("Outlier flag: sample-outlier-review");
  });

  it("keeps chart and authoritative table projections at identical reviewed-well grain", () => {
    const fixture = getCycle08QcGoldenFixture();
    const table = createAssayQcTableProjection(fixture.observationSet, fixture.evaluation);
    const chart = createAssayQcChartProjection(table);
    expect(chart.points.map(({ wellId }) => wellId)).toEqual(table.rows.map(({ wellId }) => wellId));
    expect(chart.points.map(({ value }) => value)).toEqual(
      table.rows.map(({ normalizedValue }) => normalizedValue).filter(Boolean),
    );
  });
});
