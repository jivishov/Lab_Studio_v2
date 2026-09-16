import { createCanonical96WellDilutionTargets } from "../mapping";
import { generateSerialDilutionPlan } from "../engine";
import type { SerialDilutionInput, SerialDilutionPlan } from "../types";

export const createComplete96WellSerialDilutionPlanInput = (): SerialDilutionInput => ({
  planId: "cycle07-complete-96-well-plan",
  source: {
    id: "illustrative-stock",
    concentration: { value: "10000", unit: "uM" },
    availableVolume: { value: "800", unit: "uL" },
    mixed: true,
    concentrationBasis: "amount-per-volume",
  },
  diluent: {
    id: "illustrative-diluent",
    availableVolume: { value: "10000", unit: "uL" },
  },
  transferDevice: {
    deviceRef: "assay.pipette.8-channel-p200",
    channels: 8,
    minimumVolume: { value: "20", unit: "uL" },
    maximumVolume: { value: "200", unit: "uL" },
    increment: { value: "1", unit: "uL" },
  },
  targetGroups: createCanonical96WellDilutionTargets("cycle07-complete-plate"),
  series: { kind: "factor", factor: "2", pointCount: 12 },
  volumePolicy: {
    kind: "fixed",
    transferVolume: { value: "100", unit: "uL" },
    diluentVolume: { value: "100", unit: "uL" },
    finalVolume: { value: "200", unit: "uL" },
  },
  mixingPolicy: { kind: "mix-each-point", cycles: 3 },
  discardPolicy: { kind: "discard-final-transfer", volume: { value: "100", unit: "uL" } },
  monotonicity: "strictly-decreasing",
  rounding: { mode: "reject-non-terminating" },
});

export const getComplete96WellSerialDilutionPlan = (): SerialDilutionPlan => {
  const result = generateSerialDilutionPlan(createComplete96WellSerialDilutionPlanInput());
  if (!result.ok) {
    throw new Error(result.diagnostics.map(({ code, message }) => `${code}: ${message}`).join("\n"));
  }
  return result.plan;
};
