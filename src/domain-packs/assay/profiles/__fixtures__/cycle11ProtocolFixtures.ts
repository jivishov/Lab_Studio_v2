import { getAssayLayoutGoldenArtifact } from "../../__fixtures__/assay-layout.v1";
import { createCycle08QcAssayFixture, cycle08ObservationSet } from "../../qc/__fixtures__/cycle08QcFixture";
import type { AssayObservationSet, PlateObservation } from "../../qc/types";
import type { AssayDefinition, WellDefinition } from "../../types/types";
import { analyzeBrothMicrodilutionEndpoint, analyzeXttMetabolicActivity } from "../analysis";
import {
  educationalBrothMicrodilutionProfile,
  xttMetabolicActivityProfile,
} from "../registry";

const plateId = "assay-cycle06-plate";
const wellId = (coordinate: string) => `${plateId}:${coordinate}`;

export const createCycle11XttAssay = (): AssayDefinition => {
  const assay = createCycle08QcAssayFixture();
  assay.id = "assay-cycle11-xtt-golden";
  assay.title = "Synthetic XTT metabolic-activity workflow";
  assay.description = "Source-controlled synthetic values demonstrate profile-bound XTT normalization without claiming direct cell count, calibration, or clinical use.";
  assay.protocolProfileRef = {
    id: xttMetabolicActivityProfile.id,
    version: xttMetabolicActivityProfile.version,
  };
  assay.analysisPlan = {
    id: "cycle11-xtt-analysis",
    analysisType: "xtt",
    profileRef: { ...assay.protocolProfileRef },
    inputObservationRefs: [],
    outputIds: ["percent-metabolic-activity", "percent-metabolic-inhibition"],
    limitations: [...xttMetabolicActivityProfile.limitations],
  };
  assay.metadata = {
    ...assay.metadata,
    version: "1.0.0",
    updatedAt: "2026-07-26T23:10:00.000Z",
    tags: ["assay", "cycle-11", "xtt", "synthetic", "metabolic-activity-proxy"],
  };
  return assay;
};

export const cycle11XttObservationSet: AssayObservationSet = {
  ...structuredClone(cycle08ObservationSet),
  id: "cycle11-xtt-synthetic-observations",
  observations: cycle08ObservationSet.observations.map((observation) => ({
    ...observation,
    channel: "profile-supplied-xtt-channel",
    provenance: {
      ...observation.provenance,
      sourceId: "cycle11-xtt-synthetic-golden",
      sourceVersion: "1.0.0",
      methodId: "cycle11.synthetic.xtt-signal",
      methodVersion: "1.0.0",
      description: "Synthetic XTT-like AU values for deterministic profile analysis; not instrument data or direct cell counts.",
    },
  })),
};

const emptyWell = (well: WellDefinition): WellDefinition => {
  const { controlRef: _controlRef, sampleRef: _sampleRef, ...rest } = well;
  return {
    ...rest,
    role: "unused",
    conditionRefs: [],
    replicateGroupRefs: [],
    plannedComponents: [],
    expectedFinalVolume: { value: "0", unit: "uL" },
    labels: [],
  };
};

const sampleWell = (
  well: WellDefinition,
  concentration: string,
  replicateGroupRef: string,
): WellDefinition => ({
  ...emptyWell(well),
  role: "sample",
  sampleRef: "sample-demo",
  conditionRefs: [`condition-${concentration.replace(".", "-")}`],
  replicateGroupRefs: [replicateGroupRef],
  plannedComponents: [
    {
      resourceRef: "test-compound",
      role: "reagent",
      volume: { value: "10", unit: "uL" },
      concentration: { value: concentration, unit: "uM" },
    },
    {
      resourceRef: "broth",
      role: "diluent",
      volume: { value: "90", unit: "uL" },
    },
  ],
  expectedFinalVolume: { value: "100", unit: "uL" },
  labels: [`Synthetic ${concentration} uM condition`],
});

export const createCycle11MicAssay = (): AssayDefinition => {
  const assay = getAssayLayoutGoldenArtifact();
  assay.id = "assay-cycle11-broth-microdilution-golden";
  assay.title = "Synthetic educational broth-microdilution workflow";
  assay.description = "Source-controlled binary growth/no-growth fixture for a profile-bound non-clinical endpoint.";
  assay.protocolProfileRef = {
    id: educationalBrothMicrodilutionProfile.id,
    version: educationalBrothMicrodilutionProfile.version,
  };
  assay.resources = [
    ...assay.resources,
    { id: "test-compound", label: "Synthetic test compound", kind: "reagent", description: "Fictional fixture input; not a drug selection or recommendation.", labels: ["synthetic"] },
    { id: "broth", label: "Protocol-supplied broth", kind: "buffer", description: "Placeholder broth requiring a real supplying protocol.", labels: ["synthetic"] },
  ];
  assay.controls = [
    {
      id: "growth-control",
      role: "growthControl",
      label: "Synthetic growth control",
      expectedDirection: "growth",
      requiredByProfile: true,
      interpretation: "Must report the profile-coded growth value before an endpoint can be determined.",
    },
    {
      id: "sterility-control",
      role: "sterilityControl",
      label: "Synthetic sterility control",
      expectedDirection: "no-growth",
      requiredByProfile: true,
      interpretation: "Must report the profile-coded no-growth value before an endpoint can be determined.",
    },
  ];
  assay.conditions = ["0.25", "0.5", "1"].map((value) => ({
    id: `condition-${value.replace(".", "-")}`,
    label: `Synthetic ${value} uM condition`,
    parameters: { concentrationLabel: `${value} uM` },
  }));
  assay.replicateGroups = [
    { id: "replicate-0-25", type: "technical", memberWellIds: [wellId("B1"), wellId("B2")], minimumCount: 2, aggregation: "none" },
    { id: "replicate-0-5", type: "technical", memberWellIds: [wellId("B3"), wellId("B4")], minimumCount: 2, aggregation: "none" },
    { id: "replicate-1", type: "technical", memberWellIds: [wellId("B5"), wellId("B6")], minimumCount: 2, aggregation: "none" },
  ];
  assay.plate.wells = assay.plate.wells.map((well) => {
    if (well.coordinate === "A1" || well.coordinate === "A2") return {
      ...emptyWell(well),
      role: well.coordinate === "A1" ? "growthControl" : "sterilityControl",
      controlRef: well.coordinate === "A1" ? "growth-control" : "sterility-control",
      plannedComponents: [{ resourceRef: "broth", role: "control", volume: { value: "100", unit: "uL" } }],
      expectedFinalVolume: { value: "100", unit: "uL" },
      labels: [well.coordinate === "A1" ? "Growth control" : "Sterility control"],
    };
    if (well.coordinate === "B1" || well.coordinate === "B2") return sampleWell(well, "0.25", "replicate-0-25");
    if (well.coordinate === "B3" || well.coordinate === "B4") return sampleWell(well, "0.5", "replicate-0-5");
    if (well.coordinate === "B5" || well.coordinate === "B6") return sampleWell(well, "1", "replicate-1");
    return emptyWell(well);
  });
  assay.analysisPlan = {
    id: "cycle11-broth-microdilution-analysis",
    analysisType: "inhibition",
    profileRef: { ...assay.protocolProfileRef },
    inputObservationRefs: [],
    outputIds: ["profile-bound-educational-mic-endpoint"],
    limitations: [...educationalBrothMicrodilutionProfile.limitations],
  };
  assay.metadata = {
    ...assay.metadata,
    version: "1.0.0",
    updatedAt: "2026-07-26T23:10:00.000Z",
    tags: ["assay", "cycle-11", "broth-microdilution", "synthetic", "non-clinical"],
  };
  return assay;
};

const micObservation = (
  coordinate: string,
  rawValue: "0" | "1",
  sourceType: PlateObservation["sourceType"] = "synthetic",
): PlateObservation => ({
  id: `cycle11-mic-observation-${coordinate}`,
  plateId,
  wellId: wellId(coordinate),
  sourceType,
  rawValue,
  unit: "binary-growth",
  provenance: {
    sourceId: "cycle11-mic-synthetic-golden",
    sourceVersion: "1.0.0",
    methodId: "cycle11.synthetic.binary-growth",
    methodVersion: "1.0.0",
    description: "Synthetic reviewed binary growth/no-growth fixture; not a clinical organism/drug result.",
  },
  reviewStatus: "accepted",
});

export const cycle11MicObservationSet: AssayObservationSet = {
  schema: "assay-studio.observation-set",
  schemaVersion: "1.0",
  id: "cycle11-mic-synthetic-observations",
  plateId,
  orientation: "A1-top-left",
  observations: [
    micObservation("A1", "1"),
    micObservation("A2", "0"),
    micObservation("B1", "1"),
    micObservation("B2", "1"),
    micObservation("B3", "0"),
    micObservation("B4", "0"),
    micObservation("B5", "0"),
    micObservation("B6", "0"),
  ],
  manualCorrections: [],
};

export const getCycle11ProtocolGoldenWorkflows = () => {
  const xttAssay = createCycle11XttAssay();
  const micAssay = createCycle11MicAssay();
  return {
    xtt: {
      assay: xttAssay,
      observations: structuredClone(cycle11XttObservationSet),
      profile: structuredClone(xttMetabolicActivityProfile),
      analysis: analyzeXttMetabolicActivity(xttAssay, cycle11XttObservationSet, xttMetabolicActivityProfile),
    },
    mic: {
      assay: micAssay,
      observations: structuredClone(cycle11MicObservationSet),
      profile: structuredClone(educationalBrothMicrodilutionProfile),
      analysis: analyzeBrothMicrodilutionEndpoint(micAssay, cycle11MicObservationSet, educationalBrothMicrodilutionProfile),
    },
  };
};
