import { getAssayLayoutGoldenArtifact } from "../../__fixtures__/assay-layout.v1";
import type { AssayDefinition } from "../../types";
import { evaluateAssayQc } from "../engine";
import type {
  AssayObservationProvenance,
  AssayObservationSet,
  AssayQcEvaluation,
  AssayQcRuleSet,
  PlateObservation,
} from "../types";

const wellId = (coordinate: string) => `assay-cycle06-plate:${coordinate}`;

const provenance: AssayObservationProvenance = {
  sourceId: "cycle08-source-controlled-golden",
  sourceVersion: "1.0.0",
  methodId: "cycle08.explicit.synthetic-signal",
  methodVersion: "1.0.0",
  description: "Source-controlled synthetic values for deterministic Cycle 08 QC regression only.",
};

const observation = (
  coordinate: string,
  rawValue: string,
  reviewStatus: PlateObservation["reviewStatus"] = "accepted",
): PlateObservation => ({
  id: `observation-${coordinate}`,
  plateId: "assay-cycle06-plate",
  wellId: wellId(coordinate),
  sourceType: "synthetic",
  rawValue,
  unit: "AU",
  capturedAt: "2026-07-26T20:30:00.000Z",
  provenance,
  reviewStatus,
});

export const createCycle08QcAssayFixture = (): AssayDefinition => {
  const assay = getAssayLayoutGoldenArtifact();
  assay.id = "assay-cycle08-qc-golden";
  assay.title = "Cycle 08 explicit QC golden";
  assay.description = "Synthetic, source-controlled controls/replicates/QC fixture with no protocol or clinical claim.";
  assay.controls = [
    {
      id: "control-blank",
      role: "blank",
      label: "Synthetic blank",
      expectedDirection: "zero",
      requiredByProfile: true,
      interpretation: "Illustrative background reference for the Cycle 08 fixture only.",
    },
    {
      id: "control-low",
      role: "negativeControl",
      label: "Synthetic low control",
      expectedDirection: "low",
      requiredByProfile: true,
      interpretation: "Illustrative low-signal control for the Cycle 08 fixture only.",
    },
    {
      id: "control-high",
      role: "positiveControl",
      label: "Synthetic high control",
      expectedDirection: "high",
      requiredByProfile: true,
      interpretation: "Illustrative high-signal control for the Cycle 08 fixture only.",
    },
  ];
  assay.replicateGroups = [{
    id: "replicate-sample",
    type: "technical",
    memberWellIds: ["D5", "D6", "D7"].map(wellId),
    minimumCount: 3,
    aggregation: "mean",
    variabilityMetric: "cv",
  }];
  const controlCoordinates = new Map([
    ...["A1", "A2", "A3"].map((coordinate) => [coordinate, "control-blank"] as const),
    ...["A4", "A5", "A6"].map((coordinate) => [coordinate, "control-low"] as const),
    ...["A7", "A8", "A9"].map((coordinate) => [coordinate, "control-high"] as const),
  ]);
  assay.plate.wells = assay.plate.wells.map((well) => {
    const { controlRef: _controlRef, ...withoutControl } = well;
    const next = { ...withoutControl, replicateGroupRefs: [] };
    const controlRef = controlCoordinates.get(well.coordinate);
    if (controlRef) {
      const control = assay.controls.find(({ id }) => id === controlRef)!;
      return {
        ...next,
        role: control.role,
        controlRef,
        labels: [control.label],
      };
    }
    if (["D5", "D6", "D7"].includes(well.coordinate)) return {
      ...next,
      role: "sample" as const,
      replicateGroupRefs: ["replicate-sample"],
      labels: [`Sample replicate ${well.coordinate}`],
    };
    if (["A10", "A11", "A12", "B2", "B3", "B4", "B5", "B6", "B7"].includes(well.coordinate)) return {
      ...next,
      role: "qualityControl" as const,
      labels: [`Synthetic QC monitor ${well.coordinate}`],
    };
    return next;
  });
  assay.analysisPlan = {
    id: "cycle08-qc-only",
    analysisType: "custom",
    profileRef: { id: "assay.qc-policy.cycle08-fixture", version: "1.0.0" },
    inputObservationRefs: [],
    outputIds: ["cycle08-qc-evaluation"],
    limitations: [
      "This source-controlled QC fixture is not an XTT, MIC, clinical, or calibrated protocol profile.",
    ],
  };
  assay.metadata = {
    ...assay.metadata,
    version: "1.0.0",
    updatedAt: "2026-07-26T20:30:00.000Z",
    tags: ["assay", "cycle-08", "synthetic", "qc-golden"],
  };
  return assay;
};

export const cycle08ObservationSet: AssayObservationSet = {
  schema: "assay-studio.observation-set",
  schemaVersion: "1.0",
  id: "cycle08-synthetic-observations",
  plateId: "assay-cycle06-plate",
  orientation: "A1-top-left",
  observations: [
    observation("A1", "0.10"),
    observation("A2", "0.11"),
    observation("A3", "0.09"),
    observation("A4", "0.20"),
    observation("A5", "0.21"),
    observation("A6", "0.19"),
    observation("A7", "1.00"),
    observation("A8", "1.02"),
    observation("A9", "0.98"),
    observation("A10", "0.61"),
    observation("A11", "0.60"),
    observation("A12", "0.59"),
    observation("D5", "0.60"),
    observation("D6", "0.62"),
    observation("D7", "0.58"),
    observation("B2", "0.50"),
    observation("B3", "0.505"),
    observation("B4", "0.51"),
    observation("B5", "0.515"),
    observation("B6", "0.52"),
    observation("B7", "0.524", "corrected"),
  ],
  manualCorrections: [{
    id: "correction-B7",
    observationId: "observation-B7",
    previousValue: "0.524",
    acceptedValue: "0.525",
    reason: "Source-controlled fixture correction used to prove explicit before/after provenance.",
    actorRole: "fixture-author",
    occurredAt: "2026-07-26T20:31:00.000Z",
    provenance: {
      ...provenance,
      methodId: "cycle08.explicit.manual-correction",
      description: "Explicit synthetic fixture correction; not an inferred or automatic edit.",
    },
  }],
};

export const cycle08QcRuleSet: AssayQcRuleSet = {
  schema: "assay-studio.qc-rule-set",
  schemaVersion: "1.0",
  id: "cycle08-explicit-qc-policy",
  title: "Cycle 08 explicit synthetic QC policy",
  policySource: {
    id: "cycle08.fixture.explicit-policy",
    version: "1.0.0",
    title: "Source-controlled Cycle 08 golden thresholds",
    sourceKind: "fixture",
    sourceReferences: ["cycle08-qc-golden-fixture-v1"],
    validityRange: [
      "Synthetic AU observations in this source-controlled fixture only.",
      "Canonical A1-top-left 96-well plate with the explicitly named controls and wells.",
    ],
    limitations: [
      "Thresholds are illustrative regression inputs, not externally sourced scientific acceptance criteria.",
      "No XTT, MIC, clinical, calibration, diagnostic, or protocol-conformance claim is made.",
    ],
  },
  requiredControls: [
    { id: "required-blank", controlRef: "control-blank", minimumCount: 3, maximumCount: 3 },
    { id: "required-low", controlRef: "control-low", minimumCount: 3, maximumCount: 3 },
    { id: "required-high", controlRef: "control-high", minimumCount: 3, maximumCount: 3 },
  ],
  blankCorrection: { controlRef: "control-blank", aggregation: "mean" },
  normalization: { referenceControlRef: "control-high", mode: "percent-of-reference" },
  roundingPolicy: { mode: "round", decimalPlaces: 6, tieBreaking: "half-even" },
  rules: [
    {
      id: "sample-cv",
      title: "Synthetic sample replicate CV",
      type: "replicate-variability",
      violationSeverity: "warn",
      replicateGroupRefs: ["replicate-sample"],
      metric: "cv",
      maximum: "5",
    },
    {
      id: "control-direction",
      title: "Synthetic high-above-low direction",
      type: "control-direction",
      violationSeverity: "fail",
      highControlRef: "control-high",
      lowControlRef: "control-low",
      minimumDifference: "0.5",
    },
    {
      id: "signal-window",
      title: "Synthetic signal window",
      type: "signal-window",
      violationSeverity: "warn",
      highControlRef: "control-high",
      lowControlRef: "control-low",
      minimum: "0.7",
    },
    {
      id: "z-prime",
      title: "Synthetic optional Z-prime",
      type: "z-prime",
      violationSeverity: "warn",
      highControlRef: "control-high",
      lowControlRef: "control-low",
      minimum: "0.5",
      minimumReplicatesPerControl: 3,
    },
    {
      id: "edge-check",
      title: "Synthetic edge/interior comparison",
      type: "edge-effect",
      violationSeverity: "warn",
      edgeWellIds: ["A10", "A11", "A12"].map(wellId),
      interiorWellIds: ["D5", "D6", "D7"].map(wellId),
      maximumAbsoluteDifference: "0.05",
    },
    {
      id: "column-drift",
      title: "Synthetic column drift warning",
      type: "drift",
      violationSeverity: "warn",
      wellIds: ["B2", "B3", "B4", "B5", "B6", "B7"].map(wellId),
      axis: "column",
      maximumAbsoluteSlope: "0.01",
    },
    {
      id: "sample-outlier-review",
      title: "Synthetic sample outlier review",
      type: "outlier-flag",
      violationSeverity: "warn",
      replicateGroupRefs: ["replicate-sample"],
      maximumAbsoluteDeviation: "0.1",
    },
  ],
};

export interface Cycle08QcGoldenFixture {
  assay: AssayDefinition;
  observationSet: AssayObservationSet;
  ruleSet: AssayQcRuleSet;
  evaluation: AssayQcEvaluation;
}

export const getCycle08QcGoldenFixture = (): Cycle08QcGoldenFixture => {
  const assay = createCycle08QcAssayFixture();
  const observationSet = structuredClone(cycle08ObservationSet);
  const ruleSet = structuredClone(cycle08QcRuleSet);
  return {
    assay,
    observationSet,
    ruleSet,
    evaluation: evaluateAssayQc(assay, observationSet, ruleSet),
  };
};
