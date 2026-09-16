import { getAssayLayoutGoldenArtifact } from "../../__fixtures__/assay-layout.v1";
import {
  executeComplete96WellSerialDilutionFixture,
} from "../../runtime/__fixtures__/complete96WellSerialDilution";
import type { AssayDefinition } from "../../types";
import { planAssayRun } from "../planner";
import type {
  AssayPlanningProfile,
  AssayRunPlanningRequest,
  AssayRunPlanResult,
} from "../types";

export const cycle09AssayPlanningProfile: AssayPlanningProfile = {
  schema: "assay-studio.planning-profile",
  schemaVersion: "1.0",
  id: "assay.planning-profile.cycle09-illustrative",
  version: "1.0.0",
  title: "Cycle 09 illustrative 96-well operational profile",
  supportedUseBoundaries: ["education", "research-planning"],
  source: {
    kind: "fixture",
    title: "Cycle 09 source-controlled deterministic planning fixture",
    version: "1.0.0",
    validity: "Valid only for the included nominal 96-well operation graph and explicitly declared classroom/research-planning assumptions.",
    limitations: [
      "All amounts and timings are synthetic regression inputs, not a biological protocol, safety review, instrument specification, or purchasing recommendation.",
      "Local staff must replace every fixture value with reviewed profile or user-declared metadata before operational use.",
    ],
  },
  operationLiquids: [
    {
      sourceRef: "diluent-reservoir",
      resourceId: "cycle09-diluent",
      label: "Illustrative operation diluent",
      resourceClass: "reagent",
      overage: { kind: "percent", percent: "5" },
      deadVolume: { value: "500", unit: "uL" },
      batchPlateCapacity: 3,
      preparationTask: "Prepare the explicitly declared operation diluent in labeled reservoirs",
      leadTime: { value: "20", unit: "min" },
      reviewFlags: [],
    },
    {
      sourceRef: "compound-stock",
      resourceId: "cycle09-stock",
      label: "Illustrative non-clinical stock",
      resourceClass: "sample",
      overage: { kind: "percent", percent: "10" },
      deadVolume: { value: "200", unit: "uL" },
      batchPlateCapacity: 3,
      preparationTask: "Prepare the explicitly declared non-clinical fixture stock",
      leadTime: { value: "20", unit: "min" },
      reviewFlags: [],
    },
  ],
  tipPackages: [{
    tipTypeId: "assay.tip.universal-200uL",
    tipResourceId: "cycle09-200ul-tips",
    tipLabel: "Universal 200 uL tips",
    boxResourceId: "cycle09-200ul-tip-boxes",
    boxLabel: "96-tip boxes",
    tipsPerBox: 96,
    reviewFlags: [],
  }],
  countResources: [
    {
      resourceId: "cycle09-96-well-plate",
      label: "96-well microplate",
      resourceClass: "consumable",
      quantityPerPlate: "1",
      reuseMode: "single-use",
      reviewFlags: [],
    },
    {
      resourceId: "cycle09-plate-seal",
      label: "Plate seal",
      resourceClass: "consumable",
      quantityPerPlate: "1",
      reuseMode: "single-use",
      reviewFlags: [],
    },
    {
      resourceId: "cycle09-reservoir",
      label: "Reagent reservoir",
      resourceClass: "consumable",
      quantityPerPlate: "2",
      reuseMode: "single-use",
      reviewFlags: [],
    },
    {
      resourceId: "cycle09-labeled-tube",
      label: "Labeled preparation tube",
      resourceClass: "consumable",
      quantityPerPlate: "2",
      reuseMode: "single-use",
      reviewFlags: [],
    },
  ],
  masterMixes: [{
    id: "cycle09-illustrative-master-mix",
    label: "Illustrative non-protocol master mix",
    batchPlateCapacity: 3,
    components: [
      {
        resourceId: "cycle09-master-mix-buffer",
        label: "Illustrative master-mix buffer",
        resourceClass: "reagent",
        volumePerPlate: { value: "7200", unit: "uL" },
        deadVolume: { value: "450", unit: "uL" },
      },
      {
        resourceId: "cycle09-master-mix-indicator",
        label: "Illustrative master-mix indicator",
        resourceClass: "reagent",
        volumePerPlate: { value: "800", unit: "uL" },
        deadVolume: { value: "50", unit: "uL" },
      },
    ],
    overage: { kind: "percent", percent: "10" },
    preparationTask: "Prepare and label the source-controlled illustrative master mix",
    leadTime: { value: "30", unit: "min" },
    reviewFlags: [],
  }],
  instruments: [
    {
      resourceId: "cycle09-multichannel-pipette",
      label: "8-channel micropipette station",
      resourceClass: "durable",
      stationId: "pipetting",
      defaultUnitsAvailable: 3,
      platesPerUnitPerWave: 1,
      waveDuration: { value: "25", unit: "min" },
      resetDuration: { value: "5", unit: "min" },
      cleanupTask: "Inspect, clean, and reset the declared pipetting station",
      cleanupDuration: { value: "5", unit: "min" },
      demandOperationTypes: ["aspirate", "dispense", "mix"],
      reviewFlags: [],
    },
    {
      resourceId: "cycle09-incubator",
      label: "Plate incubator",
      resourceClass: "instrument",
      stationId: "incubation",
      defaultUnitsAvailable: 1,
      platesPerUnitPerWave: 4,
      waveDuration: { value: "60", unit: "min" },
      resetDuration: { value: "5", unit: "min" },
      cleanupTask: "Inspect and reset the declared incubation space",
      cleanupDuration: { value: "5", unit: "min" },
      demandOperationTypes: ["wait"],
      reviewFlags: [],
    },
    {
      resourceId: "cycle09-plate-reader",
      label: "Plate reader",
      resourceClass: "instrument",
      stationId: "read",
      defaultUnitsAvailable: 1,
      platesPerUnitPerWave: 2,
      waveDuration: { value: "10", unit: "min" },
      resetDuration: { value: "2", unit: "min" },
      cleanupTask: "Inspect and reset the declared plate reader",
      cleanupDuration: { value: "3", unit: "min" },
      demandOperationTypes: ["readPlate"],
      reviewFlags: [],
    },
  ],
  phases: [
    {
      id: "phase-preparation",
      label: "Prepare and label materials",
      kind: "preparation",
      duration: { value: "30", unit: "min" },
    },
    {
      id: "phase-pipetting",
      label: "Execute the nominal pipetting graph",
      kind: "run",
      capacityResourceId: "cycle09-multichannel-pipette",
    },
    {
      id: "phase-incubation",
      label: "Hold plates in the declared incubation window",
      kind: "incubation",
      capacityResourceId: "cycle09-incubator",
    },
    {
      id: "phase-read",
      label: "Read plates in declared slots",
      kind: "read",
      capacityResourceId: "cycle09-plate-reader",
    },
    {
      id: "phase-reset",
      label: "Complete final declared station resets",
      kind: "reset",
      duration: { value: "10", unit: "min" },
    },
    {
      id: "phase-cleanup",
      label: "Reset and clean declared stations",
      kind: "cleanup",
      duration: { value: "15", unit: "min" },
    },
  ],
  assumptions: [
    "Each group executes one complete 96-well operation graph per repeat and technical-replicate run.",
    "Tip demand is counted from accepted attach-tip operations and the registered pipette channel count.",
    "Plate, seal, reservoir, tube, overage, dead-volume, batch, timing, and capacity values are explicit fixture declarations.",
    "Durable and instrument requirements are concurrency scheduled; they are not multiplied as consumables.",
  ],
  limitations: [
    "This fixture performs nominal operations and deterministic arithmetic only.",
    "No clinical interpretation, biological outcome, safety approval, substitution, purchasing, inventory reservation, cloud synchronization, or hardware scheduling command is produced.",
  ],
  reviewFlags: [{
    code: "assay.planning.fixture-values-review",
    severity: "info",
    message: "Replace every source-controlled fixture amount, timing, and capacity with reviewed local declarations before operational use.",
  }],
};

export const createCycle09PlanningArtifact = (): AssayDefinition => {
  const artifact = getAssayLayoutGoldenArtifact();
  return {
    ...artifact,
    id: "assay-cycle09-planning",
    title: "Cycle 09 deterministic operational-planning fixture",
    description: "A source-controlled, non-protocol fixture joining the accepted 96-well operation graph to explicit planning metadata.",
    resources: [
      ...artifact.resources,
      {
        id: "diluent-reservoir",
        label: "Illustrative diluent source",
        kind: "buffer",
        description: "Source identifier used by the deterministic Cycle 07 operation graph.",
        labels: ["cycle-09", "fixture-only"],
      },
      {
        id: "compound-stock",
        label: "Illustrative stock source",
        kind: "sample",
        description: "Non-clinical source identifier used by the deterministic Cycle 07 operation graph.",
        labels: ["cycle-09", "fixture-only"],
      },
    ],
    operations: [
      ...artifact.operations,
      {
        id: "cycle09-aspirate",
        type: "aspirate",
        label: "Aspirate declared operation liquid",
        sourceRef: "diluent-reservoir",
        destinationRefs: [],
        volume: { value: "100", unit: "uL" },
        parameters: {},
        limitations: ["The accepted runtime operation graph remains authoritative for exact consumption."],
      },
      {
        id: "cycle09-dispense",
        type: "dispense",
        label: "Dispense into declared plate wells",
        destinationRefs: [`${artifact.plate.id}:A1`],
        volume: { value: "100", unit: "uL" },
        parameters: {},
        limitations: ["The accepted runtime operation graph remains authoritative for exact channel mapping."],
      },
      {
        id: "cycle09-mix",
        type: "mix",
        label: "Mix declared plate wells",
        destinationRefs: [`${artifact.plate.id}:A1`],
        volume: { value: "100", unit: "uL" },
        parameters: { cycles: "3" },
        limitations: ["Nominal mixing establishes no biological or calibration claim."],
      },
      {
        id: "cycle09-wait",
        type: "wait",
        label: "Hold plates for the declared fixture duration",
        destinationRefs: [`${artifact.plate.id}:A1`],
        parameters: { duration: "60 min fixture declaration" },
        limitations: ["The duration is a synthetic planning fixture input, not a protocol requirement."],
      },
      {
        id: "cycle09-read",
        type: "readPlate",
        label: "Read plates in declared instrument slots",
        destinationRefs: ["equipment-reader"],
        parameters: {},
        limitations: ["No observation ingestion or biological interpretation is performed in Cycle 09."],
      },
    ],
    safetyNotes: [
      ...artifact.safetyNotes,
      "Fixture amounts and timings are synthetic planning inputs and do not authorize laboratory work.",
    ],
    metadata: {
      ...artifact.metadata,
      version: "1.0.0",
      author: "AssayDomainPack Cycle 09",
      updatedAt: "2026-07-26T00:00:00.000Z",
      tags: ["assay", "cycle-09", "planning", "fixture-only"],
    },
  };
};

export const createCycle09AssayPlanningRequest = (): AssayRunPlanningRequest => {
  const runtime = executeComplete96WellSerialDilutionFixture();
  return {
    resourceContext: {
      requestId: "cycle09-planning-golden",
      participants: 24,
      grouping: { kind: "group-size", groupSize: 4 },
      sections: [{ id: "section-a", participantCount: 24 }],
      repeats: 1,
      technicalReplicates: 1,
      stations: [
        { id: "pipetting", label: "Pipetting station" },
        { id: "incubation", label: "Incubation station" },
        { id: "read", label: "Plate-reader station" },
      ],
      availableInventory: [
        { resourceId: "cycle09-diluent", quantity: { value: "65000", unit: "uL" } },
        { resourceId: "cycle09-stock", quantity: { value: "6000", unit: "uL" } },
        { resourceId: "cycle09-200ul-tips", quantity: { value: "1920", unit: "1" } },
        { resourceId: "cycle09-200ul-tip-boxes", quantity: { value: "20", unit: "1" } },
        { resourceId: "cycle09-96-well-plate", quantity: { value: "6", unit: "1" } },
        { resourceId: "cycle09-plate-seal", quantity: { value: "6", unit: "1" } },
        { resourceId: "cycle09-reservoir", quantity: { value: "12", unit: "1" } },
        { resourceId: "cycle09-labeled-tube", quantity: { value: "12", unit: "1" } },
        { resourceId: "cycle09-master-mix-buffer", quantity: { value: "50000", unit: "uL" } },
        { resourceId: "cycle09-master-mix-indicator", quantity: { value: "7000", unit: "uL" } },
        { resourceId: "cycle09-multichannel-pipette", quantity: { value: "3", unit: "1" } },
        { resourceId: "cycle09-incubator", quantity: { value: "1", unit: "1" } },
        { resourceId: "cycle09-plate-reader", quantity: { value: "1", unit: "1" } },
      ],
      instrumentCapacities: [
        { resourceId: "cycle09-multichannel-pipette", unitsAvailable: 3, groupsPerUnitPerWave: 1 },
        { resourceId: "cycle09-incubator", unitsAvailable: 1, groupsPerUnitPerWave: 4 },
        { resourceId: "cycle09-plate-reader", unitsAvailable: 1, groupsPerUnitPerWave: 2 },
      ],
      preparationWindow: { duration: { value: "60", unit: "min" } },
      runWindow: { duration: { value: "5", unit: "h" } },
      cleanupWindow: { duration: { value: "30", unit: "min" } },
    },
    initialRuntimeState: runtime.initialState,
    operations: runtime.operations,
    profile: structuredClone(cycle09AssayPlanningProfile),
    declaredAssumptions: [
      "The classroom grouping, inventory, instrument counts, and five-hour run window are explicit fixture inputs.",
    ],
  };
};

export interface Cycle09AssayPlanningFixture {
  artifact: AssayDefinition;
  request: AssayRunPlanningRequest;
  result: AssayRunPlanResult;
}

export const getCycle09AssayPlanningFixture = (): Cycle09AssayPlanningFixture => {
  const artifact = createCycle09PlanningArtifact();
  const request = createCycle09AssayPlanningRequest();
  return {
    artifact,
    request,
    result: planAssayRun(
      artifact,
      request,
      request.resourceContext.requestId,
    ),
  };
};
