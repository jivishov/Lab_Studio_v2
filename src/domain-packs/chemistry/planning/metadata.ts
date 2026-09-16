import type { ResourceSpec } from "../../../platform/planning/types";

const durablePerGroup = (id: string, label: string): ResourceSpec => ({
  id,
  domainPackId: "chemistry",
  label,
  resourceClass: "durable",
  quantity: { amount: { value: "1", unit: "1" }, basis: "group" },
  reuse: { mode: "reuse-across-repeats" },
  cleanup: { task: `Clean, inspect, and reset ${label}.`, resetRequired: true },
  reviewFlags: [],
});

const introFiltrationResources: ResourceSpec[] = [
  durablePerGroup("sample-bottle", "Sample bottle"),
  durablePerGroup("graduated-cylinder", "Graduated cylinder"),
  durablePerGroup("beaker-250ml", "250 mL beaker"),
  durablePerGroup("reagent-bottle", "Reagent bottle"),
  durablePerGroup("ring-stand", "Ring stand"),
  durablePerGroup("funnel", "Glass funnel"),
  durablePerGroup("funnel-stand", "Funnel stand"),
  durablePerGroup("erlenmeyer-flask-250ml", "250 mL Erlenmeyer flask"),
  durablePerGroup("wash-bottle", "Wash bottle"),
  {
    id: "filter-paper",
    domainPackId: "chemistry",
    label: "Filter paper",
    resourceClass: "consumable",
    quantity: {
      amount: { value: "1", unit: "1" },
      basis: "group",
      multiplyByRepeats: true,
    },
    reuse: { mode: "single-use" },
    reviewFlags: [],
  },
  {
    id: "hard-water-sample",
    domainPackId: "chemistry",
    label: "Hard-water sample",
    resourceClass: "sample",
    quantity: {
      amount: { value: "20", unit: "mL" },
      basis: "group",
      multiplyByRepeats: true,
    },
    overage: { kind: "percent", percent: "10" },
    preparation: { task: "Label and distribute hard-water sample aliquots.", batchCount: 1 },
    reviewFlags: [],
  },
  {
    id: "carbonate-reagent",
    domainPackId: "chemistry",
    label: "Carbonate reagent",
    resourceClass: "reagent",
    quantity: {
      amount: { value: "20", unit: "mL" },
      basis: "group",
      multiplyByRepeats: true,
    },
    overage: { kind: "percent", percent: "10" },
    deadVolume: { value: "2", unit: "mL" },
    preparation: { task: "Prepare and label carbonate reagent dispensing stock.", batchCount: 1 },
    cleanup: { task: "Collect carbonate reagent waste according to local reviewed guidance.", resetRequired: false },
    substitutionPolicy: { mode: "none", candidates: [] },
    reviewFlags: [],
  },
  {
    id: "rinse-water",
    domainPackId: "chemistry",
    label: "Rinse water",
    resourceClass: "reagent",
    quantity: {
      amount: { value: "10", unit: "mL" },
      basis: "group",
      multiplyByRepeats: true,
    },
    overage: { kind: "percent", percent: "10" },
    preparation: { task: "Fill and label rinse-water wash bottles.", batchCount: 1 },
    reviewFlags: [],
  },
];

export const chemistryPlanningMetadataByArtifactId: ReadonlyMap<string, readonly ResourceSpec[]> = new Map([
  ["intro-filtration-demo", introFiltrationResources],
]);
