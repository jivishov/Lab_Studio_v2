import type {
  CapabilityEntry,
  CapabilityExample,
  CapabilityManifestFragment,
  CapabilityProof,
  CapabilityProofRef,
  CapabilityRef,
} from "../../platform/capabilities/types";
import {
  chemistryActionCapabilitySources,
  chemistryEquipmentCapabilitySources,
  chemistryInteractionCapabilitySources,
  chemistryModelCapabilitySources,
} from "./capabilitySources";

export const chemistryCapabilityManifestGeneratedAt = "2026-07-18T00:00:00.000Z";

const version = "1.0.0";
const ref = (kind: CapabilityRef["kind"], id: string): CapabilityRef => ({
  domainPackId: "chemistry",
  kind,
  id,
  version,
});
const proofRef = (proofId: string, kind: CapabilityProofRef["kind"]): CapabilityProofRef => ({ proofId, kind });
const titleCase = (value: string): string => value
  .replace(/([a-z])([A-Z])/g, "$1 $2")
  .replace(/[._-]+/g, " ")
  .replace(/^./, (character) => character.toUpperCase());

const accessiblePaths: CapabilityManifestFragment["accessiblePaths"] = [
  {
    id: "chemistry.accessible.equipment-controls",
    title: "Keyboard and screen-reader equipment controls",
    modes: ["keyboard", "pointer", "screen-reader"],
    implementation: { source: "src/player/EquipmentView.tsx", exportName: "EquipmentView" },
    limitations: ["Equipment-specific causal behavior depends on a validated action and interaction specification."],
  },
  {
    id: "chemistry.accessible.process-controls",
    title: "Accessible process action controls",
    modes: ["keyboard", "pointer", "screen-reader", "accessible-process"],
    implementation: { source: "src/player/ProcessSidebar.tsx", exportName: "ProcessSidebar" },
    limitations: ["The active artifact must provide the required source, target, and validation configuration."],
  },
];

const sharedProofs: CapabilityProof[] = [
  {
    id: "chemistry.registry.equipment",
    kind: "representative-content-fixture",
    title: "Versioned chemistry equipment catalog",
    implementation: { source: "src/equipment/catalog.ts", exportName: "v1EquipmentCatalog" },
    dependsOnProofRefs: [], evidenceTypeIds: [], accessiblePathIds: [],
    limitations: ["Catalog presence proves representation only; it does not prove causal behavior."],
  },
  {
    id: "chemistry.registry.actions",
    kind: "representative-content-fixture",
    title: "Validated chemistry action vocabulary",
    implementation: { source: "src/domain/validation.ts", exportName: "actionVerbs" },
    dependsOnProofRefs: [], evidenceTypeIds: [], accessiblePathIds: [],
    limitations: ["Vocabulary membership alone is limited to F1."],
  },
  {
    id: "chemistry.registry.interactions",
    kind: "representative-content-fixture",
    title: "Validated chemistry interaction vocabulary",
    implementation: { source: "src/domain/interactions.ts", exportName: "interactionOperationTypes" },
    dependsOnProofRefs: [], evidenceTypeIds: [], accessiblePathIds: [],
    limitations: ["Registry presence alone is not runnable proof."],
  },
  {
    id: "chemistry.view.equipment",
    kind: "interaction-implementation",
    title: "Catalog-backed equipment renderer and control",
    implementation: { source: "src/player/EquipmentView.tsx", exportName: "EquipmentView" },
    dependsOnProofRefs: ["chemistry.registry.equipment"], evidenceTypeIds: [],
    accessiblePathIds: ["chemistry.accessible.equipment-controls"],
    limitations: ["Rendering does not imply quantitative simulation."],
  },
  {
    id: "chemistry.runtime.perform-action",
    kind: "runtime-handler",
    title: "Chemistry runtime action reducer",
    implementation: { source: "src/runtime/reducer.ts", exportName: "performRuntimeAction" },
    dependsOnProofRefs: ["chemistry.registry.actions"], evidenceTypeIds: ["action.completed"],
    accessiblePathIds: ["chemistry.accessible.process-controls"],
    limitations: ["Execution requires a valid current LabDefinition or TechniqueDefinition action."],
  },
  {
    id: "chemistry.interactions.resolve",
    kind: "interaction-implementation",
    title: "Central chemistry interaction resolver",
    implementation: { source: "src/runtime/interactionIntents.ts", exportName: "resolveInteractionIntent" },
    dependsOnProofRefs: ["chemistry.registry.interactions", "chemistry.runtime.perform-action"],
    evidenceTypeIds: ["action.completed"], accessiblePathIds: ["chemistry.accessible.process-controls"],
    limitations: ["Endpoint and overlap requirements remain artifact-specific."],
  },
  {
    id: "chemistry.validation.actions",
    kind: "validator",
    title: "Action and artifact validation",
    implementation: { source: "src/domain/validation.ts", exportName: "validateActionDefinition" },
    dependsOnProofRefs: ["chemistry.registry.actions", "chemistry.registry.interactions"],
    evidenceTypeIds: [], accessiblePathIds: [],
    limitations: ["Validation checks configured semantics; it is not experimental calibration."],
  },
  {
    id: "chemistry.validation.equipment",
    kind: "validator",
    title: "Equipment definition validation",
    implementation: { source: "src/domain/validation.ts", exportName: "validateEquipmentDefinition" },
    dependsOnProofRefs: ["chemistry.registry.equipment"], evidenceTypeIds: [], accessiblePathIds: [],
    limitations: ["Definition validation does not prove scientific causality."],
  },
  {
    id: "chemistry.evidence.action-projection",
    kind: "evidence-producer",
    title: "Allowlisted action evidence projection",
    implementation: { source: "src/domain-packs/chemistry/evidenceAdapter.ts", exportName: "projectAttemptRecordToActionEvidence" },
    dependsOnProofRefs: ["chemistry.runtime.perform-action"], evidenceTypeIds: ["action.completed"],
    accessiblePathIds: [],
    limitations: ["Projects semantic completion evidence only; it never serializes RuntimeState."],
  },
  {
    id: "chemistry.evidence.calculation-projection",
    kind: "evidence-producer",
    title: "Allowlisted calculation evidence projection",
    implementation: { source: "src/domain-packs/chemistry/evidenceAdapter.ts", exportName: "projectCalculationRecordToEvidence" },
    dependsOnProofRefs: ["chemistry.runtime.perform-action"], evidenceTypeIds: ["calculation.result"],
    accessiblePathIds: [],
    limitations: ["Formula, inputs, and validity limits must be supplied from the registered model proof."],
  },
  {
    id: "chemistry.accessible.equipment",
    kind: "accessible-path",
    title: "Equipment accessible path",
    implementation: { source: "src/player/EquipmentView.tsx", exportName: "EquipmentView" },
    dependsOnProofRefs: ["chemistry.view.equipment"], evidenceTypeIds: [],
    accessiblePathIds: ["chemistry.accessible.equipment-controls"], limitations: [],
  },
  {
    id: "chemistry.accessible.process",
    kind: "accessible-path",
    title: "Process accessible path",
    implementation: { source: "src/player/ProcessSidebar.tsx", exportName: "ProcessSidebar" },
    dependsOnProofRefs: ["chemistry.interactions.resolve"], evidenceTypeIds: ["action.completed", "calculation.result"],
    accessiblePathIds: ["chemistry.accessible.process-controls"], limitations: [],
  },
  {
    id: "chemistry.tests.interactions",
    kind: "regression-test",
    title: "Runtime interaction regression coverage",
    implementation: { source: "src/runtime/__tests__/interactionIntents.test.ts" },
    dependsOnProofRefs: ["chemistry.interactions.resolve"], evidenceTypeIds: [], accessiblePathIds: [],
    limitations: ["Tests cover registered current behavior and are not calibration evidence."],
  },
];

const equipmentEntries: CapabilityEntry[] = chemistryEquipmentCapabilitySources.map((equipment) => ({
  ref: ref("object", `equipment.${equipment.id}`),
  title: equipment.label,
  summary: `Catalog-backed representation of ${equipment.accessibleName}.`,
  tags: ["chemistry", "equipment", equipment.category, ...equipment.affordances],
  claims: [{
    id: "represented",
    outcome: `Display, inspect, and select ${equipment.accessibleName} through an accessible catalog-backed view.`,
    maximumFidelity: "F1",
    proofRefs: [
      proofRef("chemistry.registry.equipment", "representative-content-fixture"),
      proofRef("chemistry.view.equipment", "interaction-implementation"),
      proofRef("chemistry.validation.equipment", "validator"),
      proofRef("chemistry.accessible.equipment", "accessible-path"),
    ],
    requiredEvidenceTypeIds: [],
    requiredAccessiblePathIds: ["chemistry.accessible.equipment-controls"],
  }],
  dependencies: [],
  accessiblePathIds: ["chemistry.accessible.equipment-controls"],
  exampleIds: [],
  limitations: ["Catalog and visual presence are F1 only; causal behavior requires a separately proven interaction claim."],
}));

const actionEntries: CapabilityEntry[] = chemistryActionCapabilitySources.map((action) => ({
  ref: ref("operation", `action.${action}`),
  title: titleCase(action),
  summary: `Recognized chemistry action vocabulary for ${action}.`,
  tags: ["chemistry", "action", action],
  claims: [{
    id: "represented",
    outcome: `Represent and validate the ${action} action in authored chemistry content.`,
    maximumFidelity: "F1",
    proofRefs: [
      proofRef("chemistry.registry.actions", "representative-content-fixture"),
      proofRef("chemistry.validation.actions", "validator"),
      proofRef("chemistry.accessible.process", "accessible-path"),
    ],
    requiredEvidenceTypeIds: [],
    requiredAccessiblePathIds: ["chemistry.accessible.process-controls"],
  }],
  dependencies: [],
  accessiblePathIds: ["chemistry.accessible.process-controls"],
  exampleIds: [],
  limitations: ["Action vocabulary membership alone does not establish a runnable interaction or quantitative model."],
}));

const interactionEntries: CapabilityEntry[] = chemistryInteractionCapabilitySources.map((interaction) => ({
  ref: ref("interaction", `interaction.${interaction}`),
  title: titleCase(interaction),
  summary: `Validated ${interaction} interaction routed through the central chemistry intent and runtime paths.`,
  tags: ["chemistry", "interaction", interaction],
  claims: [{
    id: "interactive",
    outcome: `Perform a configured ${interaction} state-changing action with validation, semantic evidence, and an accessible process control.`,
    maximumFidelity: "F2",
    proofRefs: [
      proofRef("chemistry.runtime.perform-action", "runtime-handler"),
      proofRef("chemistry.interactions.resolve", "interaction-implementation"),
      proofRef("chemistry.validation.actions", "validator"),
      proofRef("chemistry.evidence.action-projection", "evidence-producer"),
      proofRef("chemistry.accessible.process", "accessible-path"),
      proofRef("chemistry.tests.interactions", "regression-test"),
    ],
    requiredEvidenceTypeIds: ["action.completed"],
    requiredAccessiblePathIds: ["chemistry.accessible.process-controls"],
  }],
  dependencies: [],
  accessiblePathIds: ["chemistry.accessible.process-controls"],
  exampleIds: [],
  limitations: ["A validated artifact must supply compatible verbs, endpoints, parameters, and state prerequisites."],
}));

const modelExampleIds: Record<string, string[]> = {
  "hardness-as-caco3": ["chemistry.example.hard-water"],
  "acid-base-molarity": ["chemistry.example.acid-base-titration"],
  "diluted-concentration": ["chemistry.example.transmittance-dilution"],
  "decimal-transmittance": ["chemistry.example.transmittance-dilution"],
  "absorbance-from-transmittance": ["chemistry.example.transmittance-dilution"],
  "chromatography-rf": ["chemistry.example.paper-chromatography"],
  "initial-rate": ["chemistry.example.marble-kinetics"],
  "carbonate-mass-loss-composition": ["chemistry.example.thermal-mass-loss"],
};

const modelProofs: CapabilityProof[] = chemistryModelCapabilitySources.flatMap((model) => [
  {
    id: `chemistry.model.${model.id}`,
    kind: "deterministic-model" as const,
    title: `${model.title} deterministic formula`,
    implementation: { source: "src/runtime/calculations.ts", exportName: model.exportName },
    model: { deterministic: true as const, formula: model.formula, validityLimits: [...model.validityLimits] },
    dependsOnProofRefs: ["chemistry.runtime.perform-action"], evidenceTypeIds: ["calculation.result"],
    accessiblePathIds: ["chemistry.accessible.process-controls"], limitations: [...model.limitations],
  },
  {
    id: `chemistry.tests.model.${model.id}`,
    kind: "regression-test" as const,
    title: `${model.title} regression coverage`,
    implementation: { source: model.regressionSource },
    dependsOnProofRefs: [`chemistry.model.${model.id}`], evidenceTypeIds: ["calculation.result"],
    accessiblePathIds: [], limitations: ["Regression coverage is not calibration evidence."],
  },
]);

const modelEntries: CapabilityEntry[] = chemistryModelCapabilitySources.map((model) => ({
  ref: ref("model", `model.${model.id}`),
  title: model.title,
  summary: model.summary,
  tags: ["chemistry", "model", "deterministic", "quantitative"],
  claims: [{
    id: "quantitative",
    outcome: `${model.summary} Produce reproducible formula evidence within the declared validity range.`,
    maximumFidelity: "F3",
    validityRange: model.validityRange,
    proofRefs: [
      proofRef("chemistry.runtime.perform-action", "runtime-handler"),
      proofRef("chemistry.interactions.resolve", "interaction-implementation"),
      proofRef("chemistry.validation.actions", "validator"),
      proofRef("chemistry.evidence.calculation-projection", "evidence-producer"),
      proofRef("chemistry.accessible.process", "accessible-path"),
      proofRef(`chemistry.model.${model.id}`, "deterministic-model"),
      proofRef(`chemistry.tests.model.${model.id}`, "regression-test"),
    ],
    requiredEvidenceTypeIds: ["calculation.result"],
    requiredAccessiblePathIds: ["chemistry.accessible.process-controls"],
  }],
  dependencies: [ref("interaction", "interaction.submitCalculation")],
  accessiblePathIds: ["chemistry.accessible.process-controls"],
  exampleIds: modelExampleIds[model.id] ?? [],
  limitations: [...model.limitations, "No F4 calibration claim is made."],
}));

const examples: CapabilityExample[] = [
  { id: "chemistry.example.hard-water", title: "Hard-water gravimetry", artifactRef: "public/labs/hard-water-demo.json", capabilityRefs: [ref("model", "model.hardness-as-caco3")], limitations: ["Educational runtime fixture."] },
  { id: "chemistry.example.acid-base-titration", title: "Acid-base titration", artifactRef: "public/labs/acid-base-titration.json", capabilityRefs: [ref("model", "model.acid-base-molarity")], limitations: ["Configured educational endpoint model."] },
  { id: "chemistry.example.transmittance-dilution", title: "Transmittance dilution", artifactRef: "public/techniques/transmittance-dilution.json", capabilityRefs: [ref("model", "model.diluted-concentration"), ref("model", "model.decimal-transmittance"), ref("model", "model.absorbance-from-transmittance")], limitations: ["No instrument calibration claim."] },
  { id: "chemistry.example.paper-chromatography", title: "Paper chromatography", artifactRef: "public/techniques/paper-chromatography.json", capabilityRefs: [ref("model", "model.chromatography-rf")], limitations: ["Rf remains condition-dependent."] },
  { id: "chemistry.example.marble-kinetics", title: "Marble kinetics", artifactRef: "public/labs/marble-statue-kinetics.json", capabilityRefs: [ref("model", "model.initial-rate")], limitations: ["Finite-difference educational rate estimate."] },
  { id: "chemistry.example.thermal-mass-loss", title: "Thermal decomposition mass loss", artifactRef: "public/techniques/thermal-decomposition-mass-loss.json", capabilityRefs: [ref("model", "model.carbonate-mass-loss-composition")], limitations: ["Configured reaction assumptions apply."] },
];

export const getChemistryCapabilityManifestFragment = (): CapabilityManifestFragment => structuredClone({
    schema: "studio.capability-manifest-fragment",
    schemaVersion: "2.0",
    studioCoreVersion: "1.0.0",
    domainPack: {
      id: "chemistry",
      version,
      title: "Lab Studio Chemistry",
      limitations: [
        "The ChemistryDomainPack adapts current canonical LabDefinition and TechniqueDefinition artifacts without migration.",
        "Existing action vocabulary is capped at F1 unless a separate proof-complete interaction claim applies.",
        "No capability is classified F4 because no named calibration/reference evidence is registered.",
      ],
    },
    entries: [...equipmentEntries, ...actionEntries, ...interactionEntries, ...modelEntries],
    proofs: [...sharedProofs, ...modelProofs],
    accessiblePaths,
    compatibilityEdges: modelEntries.map((entry) => ({
      from: entry.ref,
      to: ref("interaction", "interaction.submitCalculation"),
      relationship: "requires" as const,
    })),
    examples,
  } satisfies CapabilityManifestFragment);
