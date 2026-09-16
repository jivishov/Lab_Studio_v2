import { create96WellPlateDefinition } from "../plate/state";
import type { AssayDefinition } from "../types/types";

const plateId = "assay-cycle06-plate";

export const assayLayoutGoldenArtifact: AssayDefinition = {
  schema: "assay-studio.assay-definition",
  schemaVersion: "1.0",
  id: "assay-cycle06-layout",
  title: "Cycle 06 96-well layout fixture",
  description: "A layout-only fixture for canonical coordinates, controls, replicates, and schema conformance.",
  audience: "Laboratory learners and assay planners",
  learningGoals: ["Author and review an unambiguous 96-well plate map."],
  useBoundary: "education",
  safetyNotes: ["This layout-only artifact does not authorize or specify a wet-lab procedure."],
  protocolProfileRef: { id: "assay.protocol-profile.unassigned", version: "0.0.0" },
  plate: create96WellPlateDefinition({
    id: plateId,
    maxWellVolume: { value: "300", unit: "uL" },
    recommendedWorkingVolume: {
      minimum: { value: "50", unit: "uL" },
      maximum: { value: "200", unit: "uL" },
    },
    wellFactory: (coordinate) => {
      if (coordinate === "A1") return {
        role: "blank",
        controlRef: "control-blank",
        plannedComponents: [{
          resourceRef: "resource-buffer",
          role: "control",
          volume: { value: "100", unit: "uL" },
        }],
        expectedFinalVolume: { value: "100", unit: "uL" },
        labels: ["Blank"],
      };
      if (coordinate === "A2" || coordinate === "A3") return {
        role: "sample",
        sampleRef: "sample-demo",
        conditionRefs: ["condition-baseline"],
        replicateGroupRefs: ["replicate-demo"],
        plannedComponents: [
          {
            resourceRef: "resource-sample",
            role: "sample",
            volume: { value: "10", unit: "uL" },
          },
          {
            resourceRef: "resource-buffer",
            role: "diluent",
            volume: { value: "90", unit: "uL" },
          },
        ],
        expectedFinalVolume: { value: "100", unit: "uL" },
        labels: [coordinate === "A2" ? "Sample replicate 1" : "Sample replicate 2"],
      };
      return {};
    },
  }),
  resources: [
    {
      id: "resource-sample",
      label: "Demonstration sample",
      kind: "sample",
      description: "Non-clinical placeholder sample for plate-layout validation.",
      labels: ["layout-fixture"],
    },
    {
      id: "resource-buffer",
      label: "Demonstration buffer",
      kind: "buffer",
      description: "Placeholder diluent for plate-layout validation.",
      labels: ["layout-fixture"],
    },
  ],
  samples: [{
    id: "sample-demo",
    label: "Demonstration sample",
    description: "A non-clinical, non-executable layout sample.",
    tags: ["fixture"],
  }],
  conditions: [{
    id: "condition-baseline",
    label: "Baseline layout condition",
    parameters: {},
  }],
  controls: [{
    id: "control-blank",
    role: "blank",
    label: "Layout blank",
    expectedDirection: "zero",
    requiredByProfile: false,
    interpretation: "The blank role is represented only; no signal interpretation is implemented in Cycle 06.",
  }],
  replicateGroups: [{
    id: "replicate-demo",
    type: "technical",
    memberWellIds: [`${plateId}:A2`, `${plateId}:A3`],
    minimumCount: 2,
    aggregation: "none",
  }],
  equipment: [
    { id: "equipment-plate", equipmentType: "microplate", label: "96-well microplate" },
    { id: "equipment-pipette", equipmentType: "micropipette", label: "Micropipette requirement" },
    { id: "equipment-tips", equipmentType: "tip-box", label: "Tip box requirement" },
    { id: "equipment-reservoir", equipmentType: "reservoir", label: "Reservoir requirement" },
    { id: "equipment-tube", equipmentType: "tube", label: "Tube requirement" },
    { id: "equipment-reader", equipmentType: "plate-reader", label: "Plate reader requirement" },
  ],
  operations: [{
    id: "record-layout-note",
    type: "recordNote",
    label: "Record a plate-layout note",
    destinationRefs: [],
    parameters: {},
    limitations: ["This operation is a schema scaffold only and is not executable in Cycle 06."],
  }],
  process: {
    schema: "studio.process-graph",
    schemaVersion: "1.0",
    startNodeId: "review-layout",
    nodes: [{
      id: "review-layout",
      type: "operation",
      title: "Review plate layout",
      description: "Inspect coordinates, roles, labels, and replicate membership without executing pipetting.",
      operationRef: "record-layout-note",
      evidenceRequirementRefs: [],
      hints: ["Confirm A1 is at the top-left before using this layout outside the fixture."],
    }],
    edges: [],
  },
  analysisPlan: {
    id: "analysis-none",
    analysisType: "none",
    inputObservationRefs: [],
    outputIds: [],
    limitations: ["No analysis or endpoint calculation is implemented in Cycle 06."],
  },
  evidenceRequirements: [],
  materials: [],
  metadata: {
    version: "1.0.0",
    author: "AssayDomainPack",
    updatedAt: "2026-07-19T00:00:00.000Z",
    tags: ["assay", "cycle-06", "layout-only"],
  },
};

export const getAssayLayoutGoldenArtifact = (): AssayDefinition =>
  structuredClone(assayLayoutGoldenArtifact);

