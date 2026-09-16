import { describe, expect, it } from "vitest";
import { addDecimal, formatDecimal, parseDecimal } from "../../../../platform/planning/decimal";
import {
  createCanonical96WellDilutionTargets,
  generateSerialDilutionPlan,
  projectDilutionTransferGraph,
  type SerialDilutionInput,
} from "..";

const singleChannelGroups = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `point-${index + 1}`,
  targets: [{
    targetId: `tube-${index + 1}`,
    channelIndex: 0,
    channelCount: 1 as const,
    orientation: "single" as const,
  }],
}));

const factorInput = (overrides: Partial<SerialDilutionInput> = {}): SerialDilutionInput => ({
  planId: "factor-golden",
  source: {
    id: "stock",
    concentration: { value: "1000", unit: "uM" },
    availableVolume: { value: "1000", unit: "uL" },
    mixed: true,
    concentrationBasis: "amount-per-volume",
  },
  diluent: { id: "buffer", availableVolume: { value: "10000", unit: "uL" } },
  transferDevice: {
    deviceRef: "p200-single",
    channels: 1,
    minimumVolume: { value: "20", unit: "uL" },
    maximumVolume: { value: "200", unit: "uL" },
    increment: { value: "1", unit: "uL" },
  },
  targetGroups: singleChannelGroups(4),
  series: { kind: "factor", factor: "2", pointCount: 4 },
  volumePolicy: {
    kind: "fixed",
    transferVolume: { value: "100", unit: "uL" },
    diluentVolume: { value: "0.1", unit: "mL" },
    finalVolume: { value: "200", unit: "uL" },
  },
  mixingPolicy: { kind: "mix-each-point", cycles: 3 },
  discardPolicy: { kind: "discard-final-transfer", volume: { value: "100", unit: "uL" } },
  monotonicity: "strictly-decreasing",
  rounding: { mode: "reject-non-terminating" },
  ...overrides,
});

describe("factor-derived serial dilution", () => {
  it("generates an exact deterministic golden plan and trace for every target", () => {
    const first = generateSerialDilutionPlan(factorInput());
    const second = generateSerialDilutionPlan(factorInput());
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    if (!first.ok) return;

    expect(first.plan.schema).toBe("assay.serial-dilution-plan");
    expect(first.plan.schemaVersion).toBe("1.0");
    expect(first.plan.points.map((point) => point.targets[0].achievedConcentration.value))
      .toEqual(["500", "250", "125", "62.5"]);
    expect(first.plan.points.flatMap(({ targets }) => targets)).toHaveLength(4);
    expect(first.plan.points.every(({ targets }) => targets.every(({ formulaTrace }) =>
      formulaTrace.equations.length === 4
      && formulaTrace.roundingApplied === false
      && formulaTrace.concentrationBasis === "amount-per-volume"))).toBe(true);
    expect(first.plan.points.map(({ targets }) => targets[0].retainedVolume.value))
      .toEqual(["100", "100", "100", "100"]);
    expect(first.plan.transferGraph.steps.map(({ kind }) => kind))
      .toEqual([
        "add-diluent", "transfer", "mix",
        "add-diluent", "transfer", "mix",
        "add-diluent", "transfer", "mix",
        "add-diluent", "transfer", "mix", "discard",
      ]);
    expect(first.plan.conservation.roundingResidual.value).toBe("0");
    const recombined = formatDecimal(addDecimal(
      parseDecimal(first.plan.conservation.terminalAnalyte.value),
      parseDecimal(first.plan.conservation.discardedAnalyte.value),
    ));
    expect(recombined).toBe(first.plan.conservation.sourceAnalyteRemoved.value);
    expect(projectDilutionTransferGraph(first.plan)).toEqual(first.plan.transferGraph);
    expect(projectDilutionTransferGraph(first.plan)).not.toBe(first.plan.transferGraph);
  });

  it("covers a complete 96-well 8-channel plan with explicit mapping and final discard", () => {
    const targetGroups = createCanonical96WellDilutionTargets("plate-1");
    const result = generateSerialDilutionPlan(factorInput({
      planId: "plate-96-factor-2",
      source: {
        ...factorInput().source,
        concentration: { value: "10000", unit: "uM" },
        availableVolume: { value: "800", unit: "uL" },
      },
      diluent: { id: "buffer", availableVolume: { value: "9.6", unit: "mL" } },
      transferDevice: {
        deviceRef: "p200-8",
        channels: 8,
        minimumVolume: { value: "20", unit: "uL" },
        maximumVolume: { value: "200", unit: "uL" },
        increment: { value: "1", unit: "uL" },
      },
      targetGroups,
      series: { kind: "factor", factor: "2", pointCount: 12 },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const targets = result.plan.points.flatMap(({ targets }) => targets);
    expect(targets).toHaveLength(96);
    expect(new Set(targets.map(({ mapping }) => mapping.coordinate)).size).toBe(96);
    expect(result.plan.points[0].targets.map(({ mapping }) => mapping.coordinate))
      .toEqual(["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"]);
    expect(result.plan.points.at(-1)?.targets[0].achievedConcentration.value).toBe("2.44140625");
    expect(targets.every(({ mapping, retainedVolume, formulaTrace }) =>
      mapping.channelCount === 8
      && mapping.orientation === "column"
      && retainedVolume.value === "100"
      && formulaTrace.roundingApplied === false)).toBe(true);
    expect(result.plan.transferGraph.steps).toHaveLength(37);
    expect(result.plan.transferGraph.steps.at(-1)).toMatchObject({
      kind: "discard",
      channelCount: 8,
      orientation: "column",
      deviceRef: "p200-8",
      mappings: expect.arrayContaining([
        expect.objectContaining({ sourceId: "plate-1:A12", targetId: "discard", volume: { value: "100", unit: "uL" } }),
      ]),
    });
    expect(result.plan.conservation).toMatchObject({
      sourceVolumeRemoved: { value: "800", unit: "uL" },
      diluentVolumeAdded: { value: "9600", unit: "uL" },
      discardedVolume: { value: "800", unit: "uL" },
      terminalVolume: { value: "9600", unit: "uL" },
      sourceAnalyteRemoved: { value: "8", unit: "umol" },
      roundingResidual: { value: "0", unit: "umol" },
    });
  });

  it("preserves volume and analyte across exact factor/property cases", () => {
    for (const factor of ["2", "4", "5", "10"]) {
      for (const pointCount of [1, 2, 3, 6]) {
        const final = "200";
        const transfer = String(200 / Number(factor));
        const diluent = String(200 - Number(transfer));
        const result = generateSerialDilutionPlan(factorInput({
          planId: `property-${factor}-${pointCount}`,
          targetGroups: singleChannelGroups(pointCount),
          series: { kind: "factor", factor, pointCount },
          volumePolicy: {
            kind: "fixed",
            transferVolume: { value: transfer, unit: "uL" },
            diluentVolume: { value: diluent, unit: "uL" },
            finalVolume: { value: final, unit: "uL" },
          },
          discardPolicy: { kind: "discard-final-transfer", volume: { value: transfer, unit: "uL" } },
        }));
        expect(result.ok, `${factor} x ${pointCount}`).toBe(true);
        if (!result.ok) continue;
        const analyteOut = formatDecimal(addDecimal(
          parseDecimal(result.plan.conservation.terminalAnalyte.value),
          parseDecimal(result.plan.conservation.discardedAnalyte.value),
        ));
        expect(analyteOut).toBe(result.plan.conservation.sourceAnalyteRemoved.value);
        expect(result.plan.conservation.roundingResidual.value).toBe("0");
        expect(result.plan.points.flatMap(({ targets }) => targets).every(({ retainedVolume }) =>
          Number(retainedVolume.value) >= 0)).toBe(true);
      }
    }
  });
});

describe("explicit-target and feasibility policies", () => {
  it("derives exact transfer and diluent volumes from explicit targets", () => {
    const result = generateSerialDilutionPlan(factorInput({
      planId: "target-derived",
      targetGroups: singleChannelGroups(3),
      series: {
        kind: "targets",
        concentrations: [
          { value: "0.5", unit: "mM" },
          { value: "250", unit: "uM" },
          { value: "0.000125", unit: "M" },
        ],
        tolerance: { kind: "absolute", value: { value: "0", unit: "uM" } },
      },
      volumePolicy: { kind: "derive-transfer", finalVolume: { value: "200", unit: "uL" } },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.points.map(({ targets }) => targets[0].transferVolume.value)).toEqual(["100", "100", "100"]);
    expect(result.plan.points.map(({ targets }) => targets[0].diluentVolume.value)).toEqual(["100", "100", "100"]);
    expect(result.plan.points.map(({ targets }) => targets[0].achievedConcentration.value)).toEqual(["500", "250", "125"]);
  });

  it("rejects target-derived increases and fixed targets outside explicit tolerance", () => {
    const increasing = generateSerialDilutionPlan(factorInput({
      targetGroups: singleChannelGroups(2),
      series: {
        kind: "targets",
        concentrations: [{ value: "500", unit: "uM" }, { value: "600", unit: "uM" }],
        tolerance: { kind: "absolute", value: { value: "0", unit: "uM" } },
      },
      volumePolicy: { kind: "derive-transfer", finalVolume: { value: "200", unit: "uL" } },
    }));
    expect(increasing.ok).toBe(false);
    if (!increasing.ok) expect(increasing.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "assay.dilution.transfer.infeasible",
    ]));

    const unachievable = generateSerialDilutionPlan(factorInput({
      targetGroups: singleChannelGroups(2),
      series: {
        kind: "targets",
        concentrations: [{ value: "500", unit: "uM" }, { value: "200", unit: "uM" }],
        tolerance: { kind: "absolute", value: { value: "0", unit: "uM" } },
      },
    }));
    expect(unachievable.ok).toBe(false);
    if (!unachievable.ok) expect(unachievable.diagnostics.some(({ code }) => code === "assay.dilution.target.unachievable")).toBe(true);
  });

  it("requires explicit rounding for non-terminating results and records applied rounding", () => {
    const base = factorInput({
      source: { ...factorInput().source, concentration: { value: "1", unit: "uM" } },
      targetGroups: singleChannelGroups(2),
      series: { kind: "factor", factor: "3", pointCount: 2 },
      volumePolicy: { kind: "derive-transfer", finalVolume: { value: "300", unit: "uL" } },
      transferDevice: {
        deviceRef: "precision-p300",
        channels: 1,
        minimumVolume: { value: "20", unit: "uL" },
        maximumVolume: { value: "300", unit: "uL" },
        increment: { value: "0.0001", unit: "uL" },
      },
      discardPolicy: { kind: "discard-final-transfer", volume: { value: "100", unit: "uL" } },
    });
    const rejected = generateSerialDilutionPlan(base);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.diagnostics.some(({ code }) => code === "assay.dilution.rounding.required")).toBe(true);

    const rounded = generateSerialDilutionPlan({
      ...base,
      rounding: { mode: "decimal-places", decimalPlaces: 6, tieBreaking: "half-even" },
    });
    expect(rounded.ok).toBe(true);
    if (rounded.ok) {
      expect(rounded.plan.points[0].targets[0].achievedConcentration.value).toBe("0.333333");
      expect(rounded.plan.points.some(({ targets }) => targets.some(({ formulaTrace }) => formulaTrace.roundingApplied))).toBe(true);
      expect(rounded.plan.roundingPolicy).toEqual({ mode: "decimal-places", decimalPlaces: 6, tieBreaking: "half-even" });
    }
  });

  it("returns typed diagnostics without a partial plan for invalid units, mixing, capacity, and mapping", () => {
    const invalid = factorInput({
      source: {
        ...factorInput().source,
        mixed: false,
        concentration: { value: "1000", unit: "uL" },
        availableVolume: { value: "99", unit: "uL" },
      },
      diluent: { id: "buffer", availableVolume: { value: "399", unit: "uL" } },
      mixingPolicy: { kind: "none" },
      targetGroups: [
        ...singleChannelGroups(3),
        { id: "point-4", targets: [{ ...singleChannelGroups(1)[0].targets[0], targetId: "tube-1" }] },
      ],
    });
    const result = generateSerialDilutionPlan(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "assay.dilution.unit.invalid",
      "assay.dilution.source.unmixed",
      "assay.dilution.mixing.required",
      "assay.dilution.mapping.duplicate",
    ]));

    const insufficient = generateSerialDilutionPlan(factorInput({
      source: { ...factorInput().source, availableVolume: { value: "99", unit: "uL" } },
      diluent: { id: "buffer", availableVolume: { value: "399", unit: "uL" } },
    }));
    expect(insufficient.ok).toBe(false);
    if (!insufficient.ok) expect(insufficient.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "assay.dilution.volume.insufficient-source",
      "assay.dilution.volume.insufficient-diluent",
    ]));
  });
});
