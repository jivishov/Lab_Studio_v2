import type {
  ActionDefinition,
  BundledLabSourceDefinition,
  LabCompositionSourceDefinition,
  TechniqueDefinition,
  ValidationRule,
} from "../domain/types";
import { COMPOSITION_COMPILER_CONTRACT_VERSION, compileLabComposition } from "./compileLabComposition";
import { hydrateBundledLab } from "./hydrateBundledLab";
import { validateActionDefinition, validateBundledLabSource, validateLabDefinition, validateTechniqueDefinition } from "../domain/validation";
import { deriveActionEffectContract } from "../domain/atomRegistry";
import { validateRouteTechniqueExecutionIntent } from "../investigations/shared/routeTechniqueExecution";

const emptyContents = {
  kind: "empty" as const,
  label: "Empty",
  solutes: [],
  contamination: [],
  wetState: "dry" as const,
  visualState: "empty",
};

const placeAction = (): ActionDefinition => ({
  id: "place-instrument",
  verb: "place",
  label: "Place the instrument",
  atomId: "atom.place.photometer",
  equipmentRoleBindings: { "photometer-instrument": "spectrophotometer" },
  parameters: {
    equipmentDefinitionId: "spectrophotometer",
    equipmentInstanceId: "standalone-instrument",
    location: "workbench",
    configuredMode: "{{config.mode}}",
    measurementIds: ["source-measurement"],
    sourceCalculationIds: ["source-calculation"],
    evidenceId: "placement-evidence",
    repeatGroupId: "placement-repeat",
    resumeNodeId: "place-node",
    chromatographyModelId: "standalone-model",
  },
  interaction: {
    type: "dragToZone",
    sourceDefinitionId: "spectrophotometer",
    stationId: "workbench",
    accessibleLabel: "Place the instrument.",
  },
  prerequisites: [],
  stateChanges: ["The instrument is available."],
  invalidCases: [],
  feedback: { success: "Instrument placed.", invalid: "Place the instrument on the bench." },
  evidence: ["placement"],
});

const localPlanningAction = (): ActionDefinition => ({
  id: "record-local-plan",
  verb: "observe",
  label: "Record the orchestration plan",
  effect: {
    classes: ["evidence-recording", "pedagogical-orchestration"],
    targets: [{ domain: "evidence" }, { domain: "pedagogy" }],
  },
  parameters: { note: "Plan recorded." },
  interaction: { type: "recordNotebook", valueParameter: "note", accessibleLabel: "Record the plan." },
  prerequisites: [],
  stateChanges: ["The lab-owned plan evidence is recorded."],
  invalidCases: [],
  feedback: { success: "Plan recorded.", invalid: "Record the plan." },
  evidence: ["notebook"],
});

export const syntheticComposableTechnique = (): TechniqueDefinition => ({
  id: "synthetic-placement",
  title: "Synthetic placement",
  learningGoal: "Exercise the composition boundary without catalog migration.",
  requiredEquipment: ["spectrophotometer"],
  chromatographyModels: [{
    id: "standalone-model",
    solventFrontMm: 10,
    bands: [{ id: "source-band", label: "Source", color: "blue", distanceMm: 5, expectedRf: 0.5 }],
  }],
  initialState: {
    equipment: [{
      id: "standalone-instrument",
      definitionId: "spectrophotometer",
      label: "Standalone instrument that must not leak",
      location: "shelf",
      contents: emptyContents,
    }],
  },
  actions: [placeAction()],
  process: {
    startNodeId: "place-node",
    nodes: [{
      id: "place-node",
      type: "action",
      title: "Place",
      description: "Place the instrument.",
      actionId: "place-instrument",
      config: {},
      validation: [],
      hints: [],
      feedback: { success: "Placed.", retry: "Try again." },
    }],
    edges: [],
  },
  successCriteria: [],
  commonMistakes: [],
  resetBehavior: "resetTechnique",
  metadata: { version: "1.0.0", author: "Cycle 02 static fixture", updatedAt: "2026-08-30", tags: ["synthetic"] },
  composition: {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: "place-node", label: "Entry" },
      { id: "exit", kind: "exit", nodeId: "place-node", label: "Exit" },
    ],
    equipmentRoles: [{
      roleId: "photometer-instrument",
      required: true,
      allowedDefinitionIds: ["spectrophotometer"],
      sourceInstanceIds: ["standalone-instrument"],
    }],
    modelSlots: [{
      id: "analysis-model",
      kind: "chromatography",
      sourceModelId: "standalone-model",
      required: true,
    }],
    configurationSlots: [{
      id: "mode",
      valueType: "string",
      required: true,
      allowedValues: ["standard", "alternate"],
      defaultValue: "standard",
    }],
    approvalGates: [{ id: "teacher-approved", label: "Teacher approved" }],
    variants: [{
      id: "teacher-approved",
      label: "Teacher-approved variant",
      enabledWhen: { kind: "approval", gateId: "teacher-approved", equals: true },
    }],
    evidenceOutputs: [{
      id: "placement",
      kind: "action-evidence",
      actionId: "place-instrument",
      referenceId: "placement-evidence",
    }],
    completion: {
      exitPortIds: ["exit"],
      requiredEvidenceOutputIds: ["placement"],
      requiredValidationRuleIds: [],
    },
    catalogDisposition: "composable",
  },
});

const instance = (instanceId: string) => ({
  instanceId,
  techniqueId: "synthetic-placement",
  version: "1.0.0",
  bindings: {
    equipment: {
      "photometer-instrument": { definitionId: "spectrophotometer", instanceId: "lab-instrument" },
    },
    models: { "analysis-model": "lab-model" },
    configuration: { mode: "standard" },
  },
});

export const syntheticCompositionSource = (
  instanceIds: string[] = ["placement"],
): LabCompositionSourceDefinition => ({
  id: "synthetic-composition-lab",
  title: "Synthetic composition lab",
  description: "Static compiler fixture.",
  audience: "Compiler",
  learningGoals: ["Prove flat compilation."],
  safetyNotes: [],
  equipment: ["spectrophotometer"],
  initialState: {
    equipment: [{
      id: "lab-instrument",
      definitionId: "spectrophotometer",
      label: "Lab-owned instrument",
      location: "shelf",
      contents: emptyContents,
    }],
  },
  chromatographyModels: [{
    id: "lab-model",
    solventFrontMm: 12,
    bands: [{ id: "lab-band", label: "Lab", color: "blue", distanceMm: 6, expectedRf: 0.5 }],
  }],
  techniques: [],
  actions: [localPlanningAction()],
  process: {
    startNodeId: "lab-entry",
    nodes: [{
      id: "lab-entry",
      type: "teacherNote",
      title: "Begin",
      description: "Begin the composed sequence.",
      actionId: "record-local-plan",
      config: {},
      validation: [],
      hints: [],
      feedback: { success: "Begin.", retry: "Begin." },
    }],
    edges: [],
  },
  assessments: [],
  metadata: { version: "1.0.0", author: "Cycle 02 static fixture", updatedAt: "2026-08-30", tags: ["synthetic"] },
  techniqueInstances: instanceIds.map(instance),
  compositionConnections: [
    { from: { kind: "lab-node", nodeId: "lab-entry" }, to: { kind: "technique-port", instanceId: instanceIds[0], portId: "entry" }, label: "Start" },
    ...instanceIds.slice(1).map((instanceId, index) => ({
      from: { kind: "technique-port" as const, instanceId: instanceIds[index], portId: "exit" },
      to: { kind: "technique-port" as const, instanceId, portId: "entry" },
      label: "Continue",
    })),
  ],
  reachabilityWitnesses: [{ id: "default", configuration: {}, approvalGates: {} }],
});

const multiRoleContinuityFixture = (): {
  technique: TechniqueDefinition;
  source: LabCompositionSourceDefinition;
} => {
  const technique = syntheticComposableTechnique();
  technique.id = "synthetic-role-continuity";
  technique.title = "Synthetic role continuity";
  technique.requiredEquipment = ["beaker-150ml"];
  technique.chromatographyModels = undefined;
  technique.initialState.equipment = [{
    id: "standalone-vessel",
    definitionId: "beaker-150ml",
    label: "Standalone vessel",
    location: "shelf",
    contents: emptyContents,
  }];
  const receivingAction = placeAction();
  receivingAction.id = "place-receiving-vessel";
  receivingAction.atomId = "atom.place.select-clean-dry-receiving-vessel";
  receivingAction.equipmentRoleBindings = { "receiving-vessel": "beaker-150ml" };
  receivingAction.parameters.equipmentDefinitionId = "beaker-150ml";
  receivingAction.parameters.equipmentInstanceId = "standalone-vessel";
  delete receivingAction.parameters.configuredMode;
  delete receivingAction.parameters.chromatographyModelId;
  receivingAction.parameters.resumeNodeId = "receiving-node";
  if (receivingAction.interaction?.type === "dragToZone") {
    receivingAction.interaction.sourceDefinitionId = "beaker-150ml";
  }
  const weighedAction = structuredClone(receivingAction);
  weighedAction.id = "place-weighed-vessel";
  weighedAction.atomId = "atom.place.weighed-vessel";
  weighedAction.equipmentRoleBindings = { "weighed-vessel": "beaker-150ml" };
  weighedAction.parameters.resumeNodeId = "weighed-node";
  technique.actions = [receivingAction, weighedAction];
  technique.process = {
    startNodeId: "receiving-node",
    nodes: [
      {
        id: "receiving-node", type: "action", title: "Receive", description: "Place the receiver.",
        actionId: receivingAction.id, config: {}, validation: [], hints: [],
        feedback: { success: "Placed.", retry: "Place the receiver." },
      },
      {
        id: "weighed-node", type: "action", title: "Weigh", description: "Reuse the vessel for weighing.",
        actionId: weighedAction.id, config: {}, validation: [], hints: [],
        feedback: { success: "Placed.", retry: "Place the weighing vessel." },
      },
    ],
    edges: [{ from: "receiving-node", to: "weighed-node", label: "Continue", condition: { type: "always" } }],
  };
  technique.composition = {
    schemaVersion: 1,
    ports: [
      { id: "entry", kind: "entry", nodeId: "receiving-node", label: "Entry" },
      { id: "exit", kind: "exit", nodeId: "weighed-node", label: "Exit" },
    ],
    equipmentRoles: [
      { roleId: "receiving-vessel", required: true, allowedDefinitionIds: ["beaker-150ml"], sourceInstanceIds: ["standalone-vessel"] },
      { roleId: "weighed-vessel", required: true, allowedDefinitionIds: ["beaker-150ml"], sourceInstanceIds: ["standalone-vessel"] },
    ],
    modelSlots: [], configurationSlots: [], approvalGates: [], variants: [], evidenceOutputs: [],
    completion: { exitPortIds: ["exit"], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
    catalogDisposition: "composable",
  };

  const source = syntheticCompositionSource(["continuity"]);
  source.id = "synthetic-role-continuity-lab";
  source.equipment = ["beaker-150ml", "test-tube"];
  source.initialState!.equipment = [
    { id: "lab-vessel", definitionId: "beaker-150ml", label: "Concrete vessel", location: "shelf", contents: emptyContents },
    { id: "lab-vessel-2", definitionId: "beaker-150ml", label: "Second concrete vessel", location: "shelf", contents: emptyContents },
    { id: "lab-incompatible", definitionId: "test-tube", label: "Incompatible vessel", location: "shelf", contents: emptyContents },
  ];
  source.chromatographyModels = undefined;
  source.techniqueInstances[0] = {
    instanceId: "continuity",
    techniqueId: technique.id,
    version: "1.0.0",
    bindings: {
      equipment: {
        "receiving-vessel": { definitionId: "beaker-150ml", instanceId: "lab-vessel" },
        "weighed-vessel": { definitionId: "beaker-150ml", instanceId: "lab-vessel" },
      },
      models: {},
      configuration: {},
    },
  };
  return { technique, source };
};

const pilotShapedLegacyTechnique = (): TechniqueDefinition => {
  const action = (id: string, definitionId: "scoopula" | "spatula", sourceInstanceId: string): ActionDefinition => {
    const value: ActionDefinition = {
      ...placeAction(),
      id,
      label: `Place ${definitionId}`,
      equipmentRoleBindings: { "solid-transfer-tool": definitionId },
      parameters: {
        equipmentDefinitionId: definitionId,
        equipmentInstanceId: sourceInstanceId,
        location: "workbench",
      },
      interaction: {
        type: "dragToZone",
        sourceDefinitionId: definitionId,
        stationId: "workbench",
        accessibleLabel: `Place ${definitionId}.`,
      },
    };
    delete value.atomId;
    return value;
  };
  const actions = [
    action("tool-action-1", "scoopula", "source-scoopula"),
    action("tool-action-2", "spatula", "source-spatula"),
    action("tool-action-3", "scoopula", "source-scoopula"),
  ];
  return {
    id: "pilot-shaped-legacy-tools",
    title: "Pilot-shaped legacy tools",
    learningGoal: "Exercise legacy composition ownership, plural bindings, and internal ordering.",
    requiredEquipment: ["scoopula", "spatula"],
    initialState: { equipment: [
      { id: "source-scoopula", definitionId: "scoopula", label: "Source scoopula", location: "shelf", contents: emptyContents },
      { id: "source-spatula", definitionId: "spatula", label: "Source spatula", location: "shelf", contents: emptyContents },
    ] },
    actions,
    process: {
      startNodeId: "tool-node-1",
      nodes: actions.map((item, index) => ({
        id: `tool-node-${index + 1}`,
        type: "action" as const,
        title: item.label,
        description: item.label,
        actionId: item.id,
        config: {},
        validation: [],
        hints: [],
        feedback: { success: "Placed.", retry: "Try again." },
      })),
      edges: [
        { from: "tool-node-1", to: "tool-node-2", label: "Primary", condition: { type: "always" } },
        { from: "tool-node-2", to: "tool-node-3", label: "Trailing", condition: { type: "always" } },
      ],
    },
    successCriteria: [],
    commonMistakes: [],
    resetBehavior: "resetTechnique",
    metadata: { version: "1.0.0", author: "Cycle 02 amendment fixture", updatedAt: "2026-08-30", tags: ["synthetic"] },
    composition: {
      schemaVersion: 1,
      ports: [
        { id: "entry", kind: "entry", nodeId: "tool-node-1", label: "Entry" },
        { id: "exit", kind: "exit", nodeId: "tool-node-3", label: "Exit" },
      ],
      equipmentRoles: [{
        roleId: "solid-transfer-tool",
        required: true,
        allowedDefinitionIds: ["scoopula", "spatula"],
        sourceInstanceIds: ["source-scoopula", "source-spatula"],
      }],
      modelSlots: [],
      configurationSlots: [],
      approvalGates: [],
      variants: [],
      evidenceOutputs: [],
      completion: { exitPortIds: ["exit"], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
      catalogDisposition: "composable",
      legacyActionEffects: actions.map((item) => ({
        actionId: item.id,
        effect: {
          classes: ["apparatus-material-instrument-state"],
          targets: [{ domain: "equipment" }],
        },
      })),
    },
  };
};

const pilotShapedAmendmentSource = (): LabCompositionSourceDefinition => {
  const equipmentBinding = {
    "solid-transfer-tool": {
      sourceInstances: [
        { sourceInstanceId: "source-scoopula", definitionId: "scoopula", instanceId: "lab-scoopula" },
        { sourceInstanceId: "source-spatula", definitionId: "spatula", instanceId: "lab-spatula" },
      ],
    },
  };
  const techniqueInstances = ["property", "extraction", "analysis"].map((instanceId) => ({
    instanceId,
    techniqueId: "pilot-shaped-legacy-tools",
    version: "1.0.0",
    bindings: { equipment: structuredClone(equipmentBinding), models: {}, configuration: {} },
  }));
  return {
    id: "pilot-shaped-amendment",
    title: "Pilot-shaped amendment",
    description: "Fully technique-owned exact-order fixture.",
    audience: "Compiler",
    learningGoals: ["Prove the amendment surface."],
    safetyNotes: [],
    equipment: ["scoopula", "spatula"],
    initialState: { equipment: [
      { id: "lab-scoopula", definitionId: "scoopula", label: "Lab scoopula", location: "shelf", contents: emptyContents },
      { id: "lab-spatula", definitionId: "spatula", label: "Lab spatula", location: "shelf", contents: emptyContents },
    ] },
    techniques: [],
    actions: [],
    process: { startNodeId: "composition-owned-root", nodes: [], edges: [] },
    assessments: [],
    metadata: { version: "1.0.0", author: "Cycle 02 amendment fixture", updatedAt: "2026-08-30", tags: ["synthetic"] },
    techniqueInstances,
    compositionStart: { kind: "technique-port", instanceId: "property", portId: "entry" },
    compositionConnections: [
      { id: "property-to-extraction", from: { kind: "technique-port", instanceId: "property", portId: "exit" }, to: { kind: "technique-port", instanceId: "extraction", portId: "entry" }, label: "Property to extraction" },
      { id: "extraction-to-analysis", from: { kind: "technique-port", instanceId: "extraction", portId: "exit" }, to: { kind: "technique-port", instanceId: "analysis", portId: "entry" }, label: "Extraction to analysis" },
    ],
    compositionEdgeOrder: [
      { kind: "technique-edge", instanceId: "property", edgeIndex: 0 },
      { kind: "connection", connectionId: "property-to-extraction" },
      { kind: "technique-edge", instanceId: "extraction", edgeIndex: 0 },
      { kind: "connection", connectionId: "extraction-to-analysis" },
      { kind: "technique-edge", instanceId: "analysis", edgeIndex: 0 },
      { kind: "technique-edge", instanceId: "property", edgeIndex: 1 },
      { kind: "technique-edge", instanceId: "extraction", edgeIndex: 1 },
      { kind: "technique-edge", instanceId: "analysis", edgeIndex: 1 },
    ],
    reachabilityWitnesses: [{ id: "default", configuration: {}, approvalGates: {} }],
  };
};

const compatibilityTechnique = (
  techniqueId: string,
  actionId: string,
  criteria: ValidationRule[],
): TechniqueDefinition => {
  const technique = syntheticComposableTechnique();
  const nodeId = `${techniqueId}-node`;
  technique.id = techniqueId;
  technique.actions[0].id = actionId;
  technique.actions[0].parameters.resumeNodeId = nodeId;
  technique.process.startNodeId = nodeId;
  technique.process.nodes[0].id = nodeId;
  technique.process.nodes[0].actionId = actionId;
  technique.successCriteria = structuredClone(criteria);
  technique.composition!.ports = [
    { id: "entry", kind: "entry", nodeId, label: "Entry" },
    { id: "exit", kind: "exit", nodeId, label: "Exit" },
  ];
  technique.composition!.evidenceOutputs[0].actionId = actionId;
  technique.composition!.completion.requiredValidationRuleIds = criteria.map((rule) => rule.id);
  return technique;
};

const actionCriterion = (id: string, actionId: string, label: string): ValidationRule => ({
  id,
  type: "actionEvidence",
  label,
  actionId,
});

const measurementCriterion = (id: string, measurementId: string, label: string): ValidationRule => ({
  id,
  type: "measurementRecorded",
  label,
  measurementId,
});

const quickAcheCompatibilityFixture = (): {
  source: LabCompositionSourceDefinition;
  techniques: Map<string, TechniqueDefinition>;
} => {
  const propertyRule = actionCriterion(
    "quick-ache-property-evidence-complete",
    "qar-compare-property-matrix",
    "Quick Ache Pure-Component Property Evidence final evidence was recorded.",
  );
  const approvalRule = actionCriterion(
    "quick-ache-design-approval-complete",
    "qar-record-teacher-approval",
    "Quick Ache Separation Design and Approval final evidence was recorded.",
  );
  const extractionRule = actionCriterion(
    "quick-ache-extraction-recovery-complete",
    "qar-record-dry-component-masses",
    "Quick Ache Extraction, Recovery, and Gravimetry final evidence was recorded.",
  );
  const analysisRule = actionCriterion(
    "quick-ache-analysis-report-complete",
    "qar-submit-particulate-postlab",
    "Quick Ache Composition Analysis and Report final evidence was recorded.",
  );
  const massLabels = {
    acidic: "The acidic fraction's dry recovered mass was measured.",
    organic: "The organic fraction's dry recovered mass was measured.",
    aqueous: "The aqueous fraction's dry recovered mass was measured.",
  } as const;
  const extractionMassRules = Object.entries(massLabels).map(([fraction, label]) => measurementCriterion(
    `quick-ache-${fraction}-mass-recorded`,
    `qar-recovered-${fraction}-component-mass`,
    label,
  ));
  const definitions = [
    compatibilityTechnique("quick-ache-property-evidence", propertyRule.actionId!, [propertyRule]),
    compatibilityTechnique("quick-ache-design-approval", approvalRule.actionId!, [approvalRule]),
    compatibilityTechnique(
      "quick-ache-extraction-recovery",
      extractionRule.actionId!,
      [extractionRule, ...extractionMassRules],
    ),
    compatibilityTechnique("quick-ache-analysis-report", analysisRule.actionId!, [analysisRule]),
  ];
  const instanceIds = ["property", "approval", "extraction", "analysis"];
  const source = syntheticCompositionSource(instanceIds);
  source.techniqueInstances.forEach((item, index) => {
    const definition = definitions[index];
    item.techniqueId = definition.id;
    const actionId = definition.actions[0].id;
    item.preserveIds = {
      actions: { [actionId]: actionId },
      validationRules: Object.fromEntries(definition.successCriteria.map((rule) => [
        rule.id,
        rule.id.replace(/-mass-recorded$/, "-mass-assessment"),
      ])),
      references: Object.fromEntries(definition.successCriteria.flatMap((rule) =>
        rule.measurementId ? [[rule.measurementId, rule.measurementId]] : [])),
    };
  });
  source.assessments = Object.entries(massLabels).map(([fraction, label]) => measurementCriterion(
    `quick-ache-${fraction}-mass-assessment`,
    `qar-recovered-${fraction}-component-mass`,
    label,
  ));
  source.compositionAssessmentOrder = [
    { kind: "technique-success-criterion", instanceId: "property", ruleId: propertyRule.id },
    { kind: "technique-success-criterion", instanceId: "approval", ruleId: approvalRule.id },
    { kind: "technique-success-criterion", instanceId: "extraction", ruleId: extractionRule.id },
    { kind: "technique-success-criterion", instanceId: "analysis", ruleId: analysisRule.id },
    ...source.assessments.map((rule, index) => ({
      kind: "lab-assessment" as const,
      ruleId: rule.id,
      substitutes: {
        instanceId: "extraction",
        ruleId: extractionMassRules[index].id,
      },
    })),
  ];
  return { source, techniques: new Map(definitions.map((definition) => [definition.id, definition])) };
};

const equilibriumCompatibilityFixture = (): {
  source: LabCompositionSourceDefinition;
  technique: TechniqueDefinition;
} => {
  const criteria: ValidationRule[] = [
    { id: "all-systems-reviewed-assessment", type: "notebookEntry", label: "All six systems reviewed", notebookTag: "all-systems-reviewed" },
    { id: "display-rationale-assessment", type: "notebookEntry", label: "Display rationale recorded", notebookTag: "display-rationale" },
    actionCriterion(
      "teacher-display-assessment",
      "confirm-final-display-review",
      "Final display reviewed and confirmed",
    ),
  ];
  const technique = compatibilityTechnique(
    "equilibrium-rainbow-inquiry",
    "confirm-final-display-review",
    criteria,
  );
  const source = syntheticCompositionSource(["equilibrium"]);
  source.techniqueInstances[0].techniqueId = technique.id;
  source.techniqueInstances[0].preserveIds = {
    actions: { "confirm-final-display-review": "confirm-final-display-review" },
    validationRules: Object.fromEntries(criteria.map((rule) => [rule.id, rule.id])),
    references: {
      "all-systems-reviewed": "all-systems-reviewed",
      "display-rationale": "display-rationale",
    },
  };
  source.compositionAssessmentOrder = criteria.map((rule) => ({
    kind: "technique-success-criterion",
    instanceId: "equilibrium",
    ruleId: rule.id,
  }));
  return { source, technique };
};

const expectFailure = async (label: string, operation: () => Promise<unknown>, expected: string): Promise<void> => {
  try {
    await operation();
    throw new Error(`${label} unexpectedly passed.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expected)) throw new Error(`${label} failed without expected diagnostic "${expected}": ${message}`);
  }
};

export const runCompositionStaticFixtures = async (): Promise<Record<string, string>> => {
  const technique = syntheticComposableTechnique();
  const resolve = async (id: string): Promise<TechniqueDefinition> => {
    if (id !== technique.id) throw new Error(`Unknown synthetic technique ${id}`);
    return structuredClone(technique);
  };
  const single = await compileLabComposition(syntheticCompositionSource(), resolve);
  if (single.actions.length !== 2 || single.process.nodes.length !== 2) throw new Error("Single-technique expansion is incomplete.");
  if (single.initialState?.equipment[0]?.id !== "lab-instrument") throw new Error("Lab equipment binding was not retained.");
  if (JSON.stringify(single).includes("standalone-instrument")) throw new Error("Standalone technique equipment leaked into compiled output.");
  const compiledPlacement = single.actions.find((action) => action.id === "placement--place-instrument");
  const measurementIds = compiledPlacement?.parameters.measurementIds;
  const calculationIds = compiledPlacement?.parameters.sourceCalculationIds;
  if (compiledPlacement?.parameters.configuredMode !== "standard" ||
    !Array.isArray(measurementIds) || measurementIds[0] !== "placement--source-measurement" ||
    !Array.isArray(calculationIds) || calculationIds[0] !== "placement--source-calculation" ||
    compiledPlacement.parameters.repeatGroupId !== "placement--placement-repeat" ||
    compiledPlacement.parameters.resumeNodeId !== "placement--place-node") {
    throw new Error("Typed configuration/evidence/calculation/repeat/node references were not rewritten coherently.");
  }
  if (compiledPlacement.parameters.chromatographyModelId !== "lab-model" || JSON.stringify(single).includes("standalone-model")) {
    throw new Error("Concrete lab model binding did not replace the standalone technique model identity.");
  }
  const compiledInstance = single.compositionManifest?.instances[0];
  if (compiledInstance?.evidenceOutputs[0]?.id !== "placement--placement" ||
    compiledInstance.evidenceOutputs[0]?.referenceId !== "placement--placement-evidence" ||
    compiledInstance.completion.exitNodeIds[0] !== "placement--place-node" ||
    compiledInstance.completion.requiredEvidenceOutputIds[0] !== "placement--placement") {
    throw new Error("Compiled evidence/completion mappings are incomplete.");
  }
  if (!validateLabDefinition(single).ok) throw new Error("Compiled output is not an ordinary valid LabDefinition.");
  const priorManifest = structuredClone(single);
  for (const version of ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] as const) {
    priorManifest.compositionManifest!.compilerContractVersion = version;
    if (!validateLabDefinition(priorManifest).ok) {
      throw new Error(`A self-contained compiler-contract ${version} manifest is no longer readable.`);
    }
  }
  const unsupportedManifest = structuredClone(single);
  (unsupportedManifest.compositionManifest as unknown as { compilerContractVersion: string }).compilerContractVersion = "1.7";
  const unsupportedValidation = validateLabDefinition(unsupportedManifest);
  if (unsupportedValidation.ok) {
    throw new Error("An unknown future compiler-contract manifest version was accepted.");
  }
  if (!unsupportedValidation.errors.some((error) => error.includes("compilerContractVersion"))) {
    throw new Error("The unknown compiler-contract version was rejected for an unrelated reason.");
  }

  const continuity = multiRoleContinuityFixture();
  const continuityResolve = async (id: string): Promise<TechniqueDefinition> => {
    if (id !== continuity.technique.id) throw new Error(`Unknown continuity technique ${id}`);
    return structuredClone(continuity.technique);
  };
  const continuityTechniqueValidation = validateTechniqueDefinition(continuity.technique);
  if (!continuityTechniqueValidation.ok) {
    throw new Error(`Exact-pair multi-role standalone validation failed: ${continuityTechniqueValidation.errors.join(" ")}`);
  }
  const continuityCompiled = await compileLabComposition(continuity.source, continuityResolve);
  if (continuityCompiled.compositionManifest?.compilerContractVersion !== COMPOSITION_COMPILER_CONTRACT_VERSION ||
    continuityCompiled.actions.some((action) =>
      action.parameters.equipmentInstanceId === "standalone-vessel") ||
    continuityCompiled.actions.filter((action) =>
      action.parameters.equipmentInstanceId === "lab-vessel").length !== 2) {
    throw new Error("Exact-pair multi-role reuse did not preserve one concrete equipment instance.");
  }

  const oneSourceDifferentTargets = structuredClone(continuity.source);
  oneSourceDifferentTargets.techniqueInstances[0].bindings.equipment["weighed-vessel"] = {
    definitionId: "beaker-150ml", instanceId: "lab-vessel-2",
  };
  await expectFailure(
    "one source mapped to different targets",
    () => compileLabComposition(oneSourceDifferentTargets, continuityResolve),
    "already maps it to target",
  );

  const differentSourcesOneTargetTechnique = structuredClone(continuity.technique);
  differentSourcesOneTargetTechnique.initialState.equipment.push({
    id: "standalone-vessel-2", definitionId: "beaker-150ml", label: "Second standalone vessel",
    location: "shelf", contents: emptyContents,
  });
  differentSourcesOneTargetTechnique.actions[1].parameters.equipmentInstanceId = "standalone-vessel-2";
  differentSourcesOneTargetTechnique.composition!.equipmentRoles[1].sourceInstanceIds = ["standalone-vessel-2"];
  await expectFailure(
    "different sample sources mapped to one ambiguous target",
    () => compileLabComposition(continuity.source, async () => structuredClone(differentSourcesOneTargetTechnique)),
    "multiply owns target instance",
  );

  const mismatchedReturnReceiver = structuredClone(oneSourceDifferentTargets);
  await expectFailure(
    "mismatched provenance return receiver",
    () => compileLabComposition(mismatchedReturnReceiver, continuityResolve),
    "already maps it to target",
  );

  const incompatibleDefinition = structuredClone(continuity.source);
  incompatibleDefinition.techniqueInstances[0].bindings.equipment["weighed-vessel"] = {
    definitionId: "test-tube", instanceId: "lab-incompatible",
  };
  await expectFailure(
    "incompatible multi-role definition",
    () => compileLabComposition(incompatibleDefinition, continuityResolve),
    "rejects equipment",
  );

  const missingRequiredContinuityRole = structuredClone(continuity.source);
  delete missingRequiredContinuityRole.techniqueInstances[0].bindings.equipment["weighed-vessel"];
  await expectFailure(
    "missing required continuity role",
    () => compileLabComposition(missingRequiredContinuityRole, continuityResolve),
    "missing required equipment role",
  );

  const amendmentTechnique = pilotShapedLegacyTechnique();
  const amendmentTechniqueValidation = validateTechniqueDefinition(amendmentTechnique);
  if (!amendmentTechniqueValidation.ok) {
    throw new Error(`The indexed-technique validation path rejected composition-owned legacy actions: ${amendmentTechniqueValidation.errors.join(" ")}`);
  }
  const amendmentResolve = async (id: string): Promise<TechniqueDefinition> => {
    if (id !== amendmentTechnique.id) throw new Error(`Unknown amendment technique ${id}`);
    return structuredClone(amendmentTechnique);
  };
  const amendmentSource = pilotShapedAmendmentSource();
  const amendmentSourceValidation = validateBundledLabSource(amendmentSource);
  if (!amendmentSourceValidation.ok) {
    throw new Error(`The bundled-lab validation path rejected the technique-owned root source: ${amendmentSourceValidation.errors.join(" ")}`);
  }
  const amendment = await compileLabComposition(amendmentSource, amendmentResolve);
  if (amendment.compositionManifest?.compilerContractVersion !== COMPOSITION_COMPILER_CONTRACT_VERSION) {
    throw new Error(`The public amendment did not emit compiler contract ${COMPOSITION_COMPILER_CONTRACT_VERSION}.`);
  }
  if (/compositionStart|compositionEdgeOrder|sourceInstances|legacyActionEffects|property-to-extraction/.test(JSON.stringify(amendment))) {
    throw new Error("A source-only amendment instruction leaked into the flat runtime definition.");
  }
  if (amendment.process.startNodeId !== "property--tool-node-1" ||
    amendmentSource.process.nodes.length !== 0 || amendment.process.nodes.length !== 9) {
    throw new Error("A fully technique-owned composition did not resolve its typed entry-port root exactly.");
  }
  const expectedPilotEdges = [
    { from: "property--tool-node-1", to: "property--tool-node-2", label: "Primary", condition: { type: "always" } },
    { from: "property--tool-node-3", to: "extraction--tool-node-1", label: "Property to extraction", condition: { type: "always" } },
    { from: "extraction--tool-node-1", to: "extraction--tool-node-2", label: "Primary", condition: { type: "always" } },
    { from: "extraction--tool-node-3", to: "analysis--tool-node-1", label: "Extraction to analysis", condition: { type: "always" } },
    { from: "analysis--tool-node-1", to: "analysis--tool-node-2", label: "Primary", condition: { type: "always" } },
    { from: "property--tool-node-2", to: "property--tool-node-3", label: "Trailing", condition: { type: "always" } },
    { from: "extraction--tool-node-2", to: "extraction--tool-node-3", label: "Trailing", condition: { type: "always" } },
    { from: "analysis--tool-node-2", to: "analysis--tool-node-3", label: "Trailing", condition: { type: "always" } },
  ];
  if (JSON.stringify(amendment.process.edges) !== JSON.stringify(expectedPilotEdges)) {
    throw new Error("The pilot-shaped global edge surface did not preserve its explicit interleaving exactly.");
  }
  if (amendment.actions.some((action) =>
    Object.prototype.hasOwnProperty.call(action, "atomId") ||
    Object.prototype.hasOwnProperty.call(action, "effect")) ||
    amendment.actions[0]?.parameters.equipmentInstanceId !== "lab-scoopula" ||
    amendment.actions[1]?.parameters.equipmentInstanceId !== "lab-spatula" ||
    amendment.actions[0]?.equipmentRoleBindings?.["solid-transfer-tool"] !== "scoopula" ||
    amendment.actions[1]?.equipmentRoleBindings?.["solid-transfer-tool"] !== "spatula") {
    throw new Error("Legacy action shape or distinct polymorphic source-instance bindings changed during compilation.");
  }
  const normalizedLegacyActions = amendment.actions.slice(0, 3).map((compiledAction, index) => {
    const normalized = structuredClone(compiledAction);
    normalized.id = amendmentTechnique.actions[index].id;
    normalized.parameters.equipmentInstanceId = amendmentTechnique.actions[index].parameters.equipmentInstanceId;
    return normalized;
  });
  if (JSON.stringify(normalizedLegacyActions) !== JSON.stringify(amendmentTechnique.actions)) {
    throw new Error("Composition-owned legacy effect metadata altered an emitted flat action shape.");
  }
  const normalizedLegacyNodes = amendment.process.nodes.slice(0, 3).map((compiledNode, index) => ({
    ...structuredClone(compiledNode),
    id: amendmentTechnique.process.nodes[index].id,
    actionId: amendmentTechnique.process.nodes[index].actionId,
  }));
  if (JSON.stringify(normalizedLegacyNodes) !== JSON.stringify(amendmentTechnique.process.nodes)) {
    throw new Error("Technique-owned root expansion changed the exact source node surface.");
  }
  const expectedPilotManifest = {
    schemaVersion: 1,
    compilerContractVersion: COMPOSITION_COMPILER_CONTRACT_VERSION,
    status: "compiled",
    instances: ["property", "extraction", "analysis"].map((instanceId) => ({
      instanceId,
      techniqueId: "pilot-shaped-legacy-tools",
      version: "1.0.0",
      repeatIndex: 0,
      variantId: undefined,
      evidenceOutputs: [],
      completion: {
        exitNodeIds: [`${instanceId}--tool-node-3`],
        requiredEvidenceOutputIds: [],
        requiredValidationRuleIds: [],
      },
    })),
    origins: ["property", "extraction", "analysis"].flatMap((instanceId) => [1, 2, 3].map((index) => ({
      actionId: `${instanceId}--tool-action-${index}`,
      nodeId: `${instanceId}--tool-node-${index}`,
      techniqueId: "pilot-shaped-legacy-tools",
      techniqueVersion: "1.0.0",
      instanceId,
      sourceActionId: `tool-action-${index}`,
      sourceNodeId: `tool-node-${index}`,
    }))),
  };
  if (JSON.stringify(amendment.compositionManifest) !== JSON.stringify(expectedPilotManifest)) {
    throw new Error(`Compiler ${COMPOSITION_COMPILER_CONTRACT_VERSION} manifest origins or completion ownership changed unexpectedly.`);
  }
  const sameDefinitionTechnique = pilotShapedLegacyTechnique();
  sameDefinitionTechnique.requiredEquipment = ["scoopula"];
  sameDefinitionTechnique.initialState.equipment[1].definitionId = "scoopula";
  sameDefinitionTechnique.actions[1].equipmentRoleBindings!["solid-transfer-tool"] = "scoopula";
  sameDefinitionTechnique.actions[1].parameters.equipmentDefinitionId = "scoopula";
  if (sameDefinitionTechnique.actions[1].interaction?.type === "dragToZone") {
    sameDefinitionTechnique.actions[1].interaction.sourceDefinitionId = "scoopula";
  }
  sameDefinitionTechnique.composition!.equipmentRoles[0].allowedDefinitionIds = ["scoopula"];
  const sameDefinitionSource = pilotShapedAmendmentSource();
  sameDefinitionSource.equipment = ["scoopula"];
  sameDefinitionSource.initialState!.equipment[1].definitionId = "scoopula";
  sameDefinitionSource.techniqueInstances.forEach((item) => {
    const binding = item.bindings.equipment["solid-transfer-tool"];
    if (Array.isArray(binding.sourceInstances)) binding.sourceInstances[1].definitionId = "scoopula";
  });
  const sameDefinition = await compileLabComposition(
    sameDefinitionSource,
    async () => structuredClone(sameDefinitionTechnique),
  );
  if (sameDefinition.actions[0]?.parameters.equipmentInstanceId !== "lab-scoopula" ||
    sameDefinition.actions[1]?.parameters.equipmentInstanceId !== "lab-spatula") {
    throw new Error("One role with multiple same-definition source instances collapsed distinct lab targets.");
  }

  const missingLegacyEffect = pilotShapedLegacyTechnique();
  missingLegacyEffect.composition!.legacyActionEffects!.shift();
  await expectFailure(
    "missing legacy effect ownership",
    () => compileLabComposition(pilotShapedAmendmentSource(), async () => missingLegacyEffect),
    "requires composition-owned legacyActionEffects",
  );
  const conflictingLegacyEffect = pilotShapedLegacyTechnique();
  conflictingLegacyEffect.composition!.legacyActionEffects![0].effect.classes = ["evidence-recording"];
  await expectFailure(
    "conflicting legacy effect ownership",
    () => compileLabComposition(pilotShapedAmendmentSource(), async () => conflictingLegacyEffect),
    "conflicts with registry/handler-derived effects",
  );
  const emittedLegacyEffect = pilotShapedLegacyTechnique();
  emittedLegacyEffect.actions[0].effect = structuredClone(
    emittedLegacyEffect.composition!.legacyActionEffects![0].effect,
  );
  await expectFailure(
    "emitted legacy effect metadata",
    () => compileLabComposition(pilotShapedAmendmentSource(), async () => emittedLegacyEffect),
    "must keep effect metadata composition-owned",
  );
  const malformedLegacyEffects = pilotShapedLegacyTechnique();
  (malformedLegacyEffects.composition as unknown as { legacyActionEffects: unknown }).legacyActionEffects = {};
  const malformedLegacyValidation = validateTechniqueDefinition(malformedLegacyEffects);
  if (malformedLegacyValidation.ok ||
    !malformedLegacyValidation.errors.some((error) => error.includes("legacyActionEffects must be an array"))) {
    throw new Error("Malformed legacy effect metadata did not fail with a stable validation diagnostic.");
  }
  const malformedEquipmentBinding = pilotShapedAmendmentSource();
  malformedEquipmentBinding.techniqueInstances[0].bindings.equipment["solid-transfer-tool"] = 7 as never;
  await expectFailure(
    "malformed equipment binding",
    () => compileLabComposition(malformedEquipmentBinding, amendmentResolve),
    "binding must be an object",
  );
  const missingSourceMapping = pilotShapedAmendmentSource();
  const missingPlural = missingSourceMapping.techniqueInstances[0].bindings.equipment["solid-transfer-tool"];
  if (Array.isArray(missingPlural.sourceInstances)) missingPlural.sourceInstances.pop();
  await expectFailure("missing plural source mapping", () => compileLabComposition(missingSourceMapping, amendmentResolve), "missing source instance mapping");
  const duplicateSourceMapping = pilotShapedAmendmentSource();
  const duplicateSource = duplicateSourceMapping.techniqueInstances[0].bindings.equipment["solid-transfer-tool"];
  if (Array.isArray(duplicateSource.sourceInstances)) duplicateSource.sourceInstances[1].sourceInstanceId = "source-scoopula";
  await expectFailure("duplicate plural source mapping", () => compileLabComposition(duplicateSourceMapping, amendmentResolve), "multiply owns source instance");
  const duplicateTargetMapping = pilotShapedAmendmentSource();
  const duplicateTarget = duplicateTargetMapping.techniqueInstances[0].bindings.equipment["solid-transfer-tool"];
  if (Array.isArray(duplicateTarget.sourceInstances)) duplicateTarget.sourceInstances[1].instanceId = "lab-scoopula";
  await expectFailure("duplicate plural target mapping", () => compileLabComposition(duplicateTargetMapping, amendmentResolve), "multiply owns target instance");
  const crossFormCollisionTechnique = pilotShapedLegacyTechnique();
  crossFormCollisionTechnique.requiredEquipment.push("beaker-150ml");
  crossFormCollisionTechnique.initialState.equipment.push({
    id: "source-beaker", definitionId: "beaker-150ml", label: "Source beaker", location: "shelf", contents: emptyContents,
  });
  crossFormCollisionTechnique.actions[2].equipmentRoleBindings = {
    "weighed-vessel": "beaker-150ml",
    "receiving-vessel": "beaker-150ml",
  };
  crossFormCollisionTechnique.actions[2].parameters.equipmentDefinitionId = "beaker-150ml";
  crossFormCollisionTechnique.actions[2].parameters.equipmentInstanceId = "source-beaker";
  if (crossFormCollisionTechnique.actions[2].interaction?.type === "dragToZone") {
    crossFormCollisionTechnique.actions[2].interaction.sourceDefinitionId = "beaker-150ml";
  }
  crossFormCollisionTechnique.composition!.equipmentRoles.push(
    {
      roleId: "weighed-vessel",
      required: true,
      allowedDefinitionIds: ["beaker-150ml"],
      sourceInstanceIds: ["source-beaker"],
    },
    {
      roleId: "receiving-vessel",
      required: true,
      allowedDefinitionIds: ["beaker-150ml"],
    },
  );
  const crossFormCollisionSource = pilotShapedAmendmentSource();
  crossFormCollisionSource.equipment.push("beaker-150ml");
  crossFormCollisionSource.initialState!.equipment.push(
    { id: "lab-beaker", definitionId: "beaker-150ml", label: "Lab beaker", location: "shelf", contents: emptyContents },
    { id: "lab-beaker-alt", definitionId: "beaker-150ml", label: "Alternate lab beaker", location: "shelf", contents: emptyContents },
  );
  crossFormCollisionSource.techniqueInstances.forEach((item) => {
    item.bindings.equipment["weighed-vessel"] = {
      sourceInstances: [{ sourceInstanceId: "source-beaker", definitionId: "beaker-150ml", instanceId: "lab-beaker" }],
    };
    item.bindings.equipment["receiving-vessel"] = {
      definitionId: "beaker-150ml",
      instanceId: "lab-beaker-alt",
    };
  });
  await expectFailure(
    "plural and single source collision",
    () => compileLabComposition(crossFormCollisionSource, async () => structuredClone(crossFormCollisionTechnique)),
    "multiply owns source instance \"source-beaker\"",
  );
  const inferredPlural = pilotShapedAmendmentSource();
  inferredPlural.techniqueInstances[0].bindings.equipment["solid-transfer-tool"] = {
    definitionId: "scoopula", instanceId: "lab-scoopula",
  };
  await expectFailure("plural inference", () => compileLabComposition(inferredPlural, amendmentResolve), "requires one explicit mapping per source instance");
  const incompatiblePlural = pilotShapedAmendmentSource();
  incompatiblePlural.equipment.push("beaker-150ml");
  incompatiblePlural.initialState!.equipment.push({
    id: "lab-beaker", definitionId: "beaker-150ml", label: "Lab beaker", location: "shelf", contents: emptyContents,
  });
  const incompatibleBinding = incompatiblePlural.techniqueInstances[0].bindings.equipment["solid-transfer-tool"];
  if (Array.isArray(incompatibleBinding.sourceInstances)) {
    incompatibleBinding.sourceInstances[0].definitionId = "beaker-150ml";
    incompatibleBinding.sourceInstances[0].instanceId = "lab-beaker";
  }
  await expectFailure("incompatible plural target", () => compileLabComposition(incompatiblePlural, amendmentResolve), "rejects equipment");

  const missingEdgeOrder = pilotShapedAmendmentSource();
  missingEdgeOrder.compositionEdgeOrder!.pop();
  await expectFailure("incomplete global edge order", () => compileLabComposition(missingEdgeOrder, amendmentResolve), "does not account for active edges");
  const duplicateEdgeOrder = pilotShapedAmendmentSource();
  duplicateEdgeOrder.compositionEdgeOrder![7] = structuredClone(duplicateEdgeOrder.compositionEdgeOrder![6]);
  await expectFailure("duplicate global edge order", () => compileLabComposition(duplicateEdgeOrder, amendmentResolve), "repeats edge source");
  const inactiveEdgeOrder = pilotShapedAmendmentSource();
  const optionalPredicate = { kind: "approval" as const, instanceId: "analysis", gateId: "approved", equals: true };
  const optionalTechnique = pilotShapedLegacyTechnique();
  optionalTechnique.composition!.approvalGates = [{ id: "approved", label: "Approved" }];
  inactiveEdgeOrder.techniqueInstances[2].enabledWhen = optionalPredicate;
  inactiveEdgeOrder.compositionConnections[1].enabledWhen = optionalPredicate;
  inactiveEdgeOrder.reachabilityWitnesses = [
    { id: "inactive", configuration: {}, approvalGates: { "analysis.approved": false } },
    { id: "active", configuration: {}, approvalGates: { "analysis.approved": true } },
  ];
  await expectFailure(
    "inactive global edge source",
    () => compileLabComposition(inactiveEdgeOrder, async () => structuredClone(optionalTechnique), { witnessId: "inactive" }),
    "missing or inactive edge source",
  );
  const invalidCompositionStart = pilotShapedAmendmentSource();
  if (invalidCompositionStart.compositionStart?.kind === "technique-port") {
    invalidCompositionStart.compositionStart.portId = "exit";
  }
  await expectFailure("non-entry composition root", () => compileLabComposition(invalidCompositionStart, amendmentResolve), "compositionStart must use an entry port");
  const unresolvedCompositionStart = pilotShapedAmendmentSource();
  if (unresolvedCompositionStart.compositionStart?.kind === "technique-port") {
    unresolvedCompositionStart.compositionStart.portId = "missing-entry";
  }
  await expectFailure(
    "unresolved composition root",
    () => compileLabComposition(unresolvedCompositionStart, amendmentResolve),
    "compositionStart references missing port",
  );
  const inactiveCompositionStart = pilotShapedAmendmentSource();
  const inactiveStartPredicate = { kind: "approval" as const, instanceId: "analysis", gateId: "approved", equals: true };
  const inactiveStartTechnique = pilotShapedLegacyTechnique();
  inactiveStartTechnique.composition!.approvalGates = [{ id: "approved", label: "Approved" }];
  inactiveCompositionStart.compositionStart = { kind: "technique-port", instanceId: "analysis", portId: "entry" };
  inactiveCompositionStart.techniqueInstances[2].enabledWhen = inactiveStartPredicate;
  inactiveCompositionStart.compositionConnections[1].enabledWhen = inactiveStartPredicate;
  inactiveCompositionStart.reachabilityWitnesses = [
    { id: "inactive", configuration: {}, approvalGates: { "analysis.approved": false } },
    { id: "active", configuration: {}, approvalGates: { "analysis.approved": true } },
  ];
  await expectFailure(
    "inactive composition root",
    () => compileLabComposition(
      inactiveCompositionStart,
      async () => structuredClone(inactiveStartTechnique),
      { witnessId: "inactive" },
    ),
    "makes compositionStart instance \"analysis\" inactive",
  );
  const ambiguousOrderedRepeat = pilotShapedAmendmentSource();
  ambiguousOrderedRepeat.techniqueInstances[0].repeat = 2;
  if (ambiguousOrderedRepeat.compositionStart?.kind === "technique-port") ambiguousOrderedRepeat.compositionStart.repeatIndex = 0;
  const repeatedConnection = ambiguousOrderedRepeat.compositionConnections[0].from;
  if (repeatedConnection.kind === "technique-port") repeatedConnection.repeatIndex = 1;
  await expectFailure(
    "ambiguous repeated global edge source",
    () => compileLabComposition(ambiguousOrderedRepeat, amendmentResolve),
    "requires repeatIndex for repeated instance",
  );
  const manifestJson = JSON.stringify(single.compositionManifest);
  if (/[A-Z]:[\\/]|file:\/\/|sha256|fileId|provider|runtimeId|assetPath/i.test(manifestJson)) {
    throw new Error("Composition manifest leaked a private/build/runtime locator.");
  }
  const routeIntentErrors = validateRouteTechniqueExecutionIntent(single.compositionManifest, {
    instanceId: "placement",
    actionId: "placement--place-instrument",
    payload: {},
  });
  if (routeIntentErrors.length > 0) throw new Error(`Valid route intent failed: ${routeIntentErrors.join(" ")}`);
  if (validateRouteTechniqueExecutionIntent(single.compositionManifest, {
    instanceId: "placement",
    actionId: "lab-local-spoof",
    payload: {},
  }).length === 0) throw new Error("Route adapter accepted a non-origin action.");
  const missingOrigins = structuredClone(single);
  missingOrigins.compositionManifest!.origins = [];
  if (validateLabDefinition(missingOrigins).ok) {
    throw new Error("Compiled manifest accepted missing node/action/evidence origins.");
  }

  const defaultScopedTechnique = syntheticComposableTechnique();
  defaultScopedTechnique.successCriteria = [{
    id: "default-criterion",
    type: "notebookEntry",
    label: "Default scoped criterion",
    notebookTag: "default-notebook",
  }];
  defaultScopedTechnique.composition!.completion.requiredValidationRuleIds = ["default-criterion"];
  defaultScopedTechnique.actions[0].parameters.referenceId = "owner-local-reference";
  defaultScopedTechnique.process.edges = [{
    from: "place-node",
    to: "place-node",
    label: "Retain a calculation branch reference",
    condition: { type: "calculationResult", calculationId: "owner-local-calculation" },
  }];
  const defaultScopedSource = syntheticCompositionSource();
  defaultScopedSource.techniqueInstances[0].preserveIds = {
    references: {
      "owner-local-reference": "legacy-reference",
      "owner-local-calculation": "legacy-calculation",
    },
  };
  const defaultScoped = await compileLabComposition(
    defaultScopedSource,
    async () => structuredClone(defaultScopedTechnique),
  );
  if (defaultScoped.assessments[0]?.id !== "placement--default-criterion" ||
    defaultScoped.assessments[0]?.notebookTag !== "placement--default-notebook" ||
    defaultScoped.compositionManifest?.instances[0]?.completion.requiredValidationRuleIds[0] !==
      "placement--default-criterion" ||
    defaultScoped.actions.find((action) => action.id === "placement--place-instrument")?.parameters.referenceId !==
      "legacy-reference" ||
    defaultScoped.process.edges.find((edge) => edge.label === "Retain a calculation branch reference")
      ?.condition.calculationId !== "legacy-calculation") {
    throw new Error("Scoped defaults or explicit owner-local reference preservation regressed.");
  }

  const equilibriumFixture = equilibriumCompatibilityFixture();
  const equilibrium = await compileLabComposition(
    equilibriumFixture.source,
    async () => structuredClone(equilibriumFixture.technique),
  );
  if (JSON.stringify(equilibrium.assessments) !== JSON.stringify([
    { id: "all-systems-reviewed-assessment", type: "notebookEntry", label: "All six systems reviewed", notebookTag: "all-systems-reviewed" },
    { id: "display-rationale-assessment", type: "notebookEntry", label: "Display rationale recorded", notebookTag: "display-rationale" },
    { id: "teacher-display-assessment", type: "actionEvidence", label: "Final display reviewed and confirmed", actionId: "confirm-final-display-review" },
  ])) {
    throw new Error("Equilibrium immutable three-row assessment identities were not preserved exactly.");
  }

  const quickAcheFixture = quickAcheCompatibilityFixture();
  const quickAche = await compileLabComposition(
    quickAcheFixture.source,
    async (id) => structuredClone(quickAcheFixture.techniques.get(id) ?? (() => { throw new Error(id); })()),
  );
  const expectedQuickAcheSurface = [
    { id: "quick-ache-property-evidence-complete", type: "actionEvidence", label: "Quick Ache Pure-Component Property Evidence final evidence was recorded.", actionId: "qar-compare-property-matrix" },
    { id: "quick-ache-design-approval-complete", type: "actionEvidence", label: "Quick Ache Separation Design and Approval final evidence was recorded.", actionId: "qar-record-teacher-approval" },
    { id: "quick-ache-extraction-recovery-complete", type: "actionEvidence", label: "Quick Ache Extraction, Recovery, and Gravimetry final evidence was recorded.", actionId: "qar-record-dry-component-masses" },
    { id: "quick-ache-analysis-report-complete", type: "actionEvidence", label: "Quick Ache Composition Analysis and Report final evidence was recorded.", actionId: "qar-submit-particulate-postlab" },
    { id: "quick-ache-acidic-mass-assessment", type: "measurementRecorded", label: "The acidic fraction's dry recovered mass was measured.", measurementId: "qar-recovered-acidic-component-mass" },
    { id: "quick-ache-organic-mass-assessment", type: "measurementRecorded", label: "The organic fraction's dry recovered mass was measured.", measurementId: "qar-recovered-organic-component-mass" },
    { id: "quick-ache-aqueous-mass-assessment", type: "measurementRecorded", label: "The aqueous fraction's dry recovered mass was measured.", measurementId: "qar-recovered-aqueous-component-mass" },
  ];
  if (JSON.stringify(quickAche.assessments) !== JSON.stringify(expectedQuickAcheSurface)) {
    throw new Error("QuickAche immutable seven-row assessment surface was not preserved exactly.");
  }
  const extractionCompletion = quickAche.compositionManifest?.instances.find(
    (item) => item.instanceId === "extraction",
  )?.completion.requiredValidationRuleIds;
  if (!extractionCompletion?.includes("quick-ache-acidic-mass-assessment") ||
    extractionCompletion.includes("quick-ache-acidic-mass-recorded")) {
    throw new Error("QuickAche substituted compatibility assessments did not update completion identities.");
  }

  const incompleteAssessmentOrder = quickAcheCompatibilityFixture();
  incompleteAssessmentOrder.source.compositionAssessmentOrder!.pop();
  await expectFailure(
    "incomplete explicit assessment order",
    () => compileLabComposition(
      incompleteAssessmentOrder.source,
      async (id) => structuredClone(incompleteAssessmentOrder.techniques.get(id)!),
    ),
    "does not account",
  );

  const conflictingSubstitution = quickAcheCompatibilityFixture();
  conflictingSubstitution.source.techniqueInstances[2].preserveIds!.validationRules![
    "quick-ache-acidic-mass-recorded"
  ] = "different-public-id";
  await expectFailure(
    "conflicting explicit assessment substitution",
    () => compileLabComposition(
      conflictingSubstitution.source,
      async (id) => structuredClone(conflictingSubstitution.techniques.get(id)!),
    ),
    "conflicts with preserved validation rule id",
  );

  const collidingReferenceBindings = quickAcheCompatibilityFixture();
  collidingReferenceBindings.source.techniqueInstances[2].preserveIds!.references = {
    "qar-recovered-acidic-component-mass": "shared-mass-id",
    "qar-recovered-organic-component-mass": "shared-mass-id",
  };
  await expectFailure(
    "colliding preserved reference ids",
    () => compileLabComposition(
      collidingReferenceBindings.source,
      async (id) => structuredClone(collidingReferenceBindings.techniques.get(id)!),
    ),
    "same preserved id",
  );

  const legacyBase = syntheticCompositionSource();
  const legacy: BundledLabSourceDefinition = {
    ...legacyBase,
    chromatographyModels: [
      ...(legacyBase.chromatographyModels ?? []),
      ...(technique.chromatographyModels ?? []),
    ],
    process: {
      ...legacyBase.process,
      nodes: [
        ...legacyBase.process.nodes,
        { ...syntheticComposableTechnique().process.nodes[0], id: "legacy-imported-node" },
      ],
      edges: [{ from: "lab-entry", to: "legacy-imported-node", label: "Continue", condition: { type: "always" } }],
    },
    techniqueRefs: [{ techniqueId: technique.id, version: "1.0.0", actionIds: "all" }],
  };
  delete legacy.techniqueInstances;
  delete legacy.compositionConnections;
  delete legacy.reachabilityWitnesses;
  const legacyValidation = validateBundledLabSource(legacy);
  if (!legacyValidation.ok || !legacyValidation.value) throw new Error(`Legacy source validation regressed: ${legacyValidation.errors.join(" ")}`);
  const hydratedLegacy = await hydrateBundledLab(legacyValidation.value, resolve);
  if (hydratedLegacy.actions.length !== 2 || "techniqueRefs" in hydratedLegacy) {
    throw new Error("Legacy techniqueRefs hydration is no longer self-contained.");
  }

  const multi = await compileLabComposition(syntheticCompositionSource(["first", "second"]), resolve);
  if (multi.actions.map((action) => action.id).join(",") !== "first--place-instrument,second--place-instrument,record-local-plan") {
    throw new Error("Multi-technique ids are not deterministic and instance-scoped.");
  }
  if (JSON.stringify(multi.process.edges) !== JSON.stringify([
    { from: "lab-entry", to: "first--place-node", label: "Start", condition: { type: "always" } },
    { from: "first--place-node", to: "second--place-node", label: "Continue", condition: { type: "always" } },
  ])) {
    throw new Error("The contract 1.1 deterministic default edge assembly order changed.");
  }

  const repeated = syntheticCompositionSource(["repeat"]);
  repeated.techniqueInstances[0].repeat = 2;
  repeated.compositionConnections = [
    { from: { kind: "lab-node", nodeId: "lab-entry" }, to: { kind: "technique-port", instanceId: "repeat", repeatIndex: 0, portId: "entry" }, label: "Start" },
    { from: { kind: "technique-port", instanceId: "repeat", repeatIndex: 0, portId: "exit" }, to: { kind: "technique-port", instanceId: "repeat", repeatIndex: 1, portId: "entry" }, label: "Repeat" },
  ];
  const repeatedResult = await compileLabComposition(repeated, resolve);
  const repeatedTechniqueIds = repeatedResult.actions
    .map((action) => action.id)
    .filter((id) => id.includes("place-instrument"));
  if (new Set(repeatedTechniqueIds).size !== 2) throw new Error("Repeated ids collided.");
  const ambiguousRepeat = structuredClone(repeated);
  delete (ambiguousRepeat.compositionConnections[0].to as { repeatIndex?: number }).repeatIndex;
  await expectFailure(
    "ambiguous repeated endpoint",
    () => compileLabComposition(ambiguousRepeat, resolve),
    "requires repeatIndex",
  );

  const spoofed = syntheticCompositionSource();
  spoofed.actions.push({
    ...placeAction(),
    id: "spoofed-local-physical",
    effect: { classes: ["pedagogical-orchestration"], targets: [{ domain: "pedagogy" }] },
  });
  await expectFailure("spoofed local physical action", () => compileLabComposition(spoofed, resolve), "technique-only effect class");

  const spoofedMeasurement = syntheticCompositionSource();
  spoofedMeasurement.actions[0] = {
    ...localPlanningAction(),
    id: "spoofed-local-measurement",
    interaction: {
      type: "readInstrument",
      sourceDefinitionId: "spectrophotometer",
      stationId: "spectrophotometer",
      accessibleLabel: "Read the instrument.",
    },
  };
  spoofedMeasurement.process.nodes[0].actionId = "spoofed-local-measurement";
  await expectFailure("spoofed local measurement", () => compileLabComposition(spoofedMeasurement, resolve), "technique-only effect class");

  const missingVersion = syntheticCompositionSource();
  missingVersion.techniqueInstances[0].version = "";
  await expectFailure("missing version", () => compileLabComposition(missingVersion, resolve), ".version must be a non-empty string");

  const missingBinding = syntheticCompositionSource();
  delete missingBinding.techniqueInstances[0].bindings.models["analysis-model"];
  await expectFailure("missing model binding", () => compileLabComposition(missingBinding, resolve), "missing model slot");

  const missingPort = syntheticCompositionSource();
  const techniqueEndpoint = missingPort.compositionConnections[0].to;
  if (techniqueEndpoint.kind === "technique-port") techniqueEndpoint.portId = "missing-port";
  await expectFailure("missing port", () => compileLabComposition(missingPort, resolve), "missing port");

  const ambiguousId = syntheticCompositionSource();
  ambiguousId.techniqueInstances[0].preserveIds = {
    actions: { "place-instrument": "record-local-plan" },
  };
  await expectFailure("ambiguous preserved id", () => compileLabComposition(ambiguousId, resolve), "Ambiguous compiled action id");

  const unresolvedTechnique = syntheticComposableTechnique();
  unresolvedTechnique.actions[0].prerequisites = [{
    id: "missing-action-reference",
    type: "actionEvidence",
    label: "Missing action reference",
    actionId: "not-an-action",
  }];
  await expectFailure(
    "unresolved action reference",
    () => compileLabComposition(syntheticCompositionSource(), async () => unresolvedTechnique),
    "Unresolved technique action reference",
  );

  const duplicateValidationTechnique = syntheticComposableTechnique();
  duplicateValidationTechnique.actions[0].prerequisites = [{
    id: "duplicate-validation-id",
    type: "actionEvidence",
    label: "Prerequisite duplicate",
    actionId: "place-instrument",
  }];
  duplicateValidationTechnique.successCriteria = [{
    id: "duplicate-validation-id",
    type: "actionEvidence",
    label: "Criterion duplicate",
    actionId: "place-instrument",
  }];
  await expectFailure(
    "ambiguous source validation identity",
    () => compileLabComposition(syntheticCompositionSource(), async () => duplicateValidationTechnique),
    "repeats validation rule id",
  );

  const spoofedOrigin = {
    ...syntheticCompositionSource(),
    compositionManifest: { schemaVersion: 1 },
  } as unknown as LabCompositionSourceDefinition;
  await expectFailure("spoofed raw origin", () => compileLabComposition(spoofedOrigin, resolve), "cannot assert compositionManifest");

  const dead = syntheticCompositionSource();
  dead.compositionConnections = [];
  await expectFailure("dead selected output", () => compileLabComposition(dead, resolve), "unreachable nodes");

  const incompleteInitialEquipment = syntheticCompositionSource();
  incompleteInitialEquipment.equipment.push("beaker-250ml");
  await expectFailure(
    "runtime-fallback equipment gap",
    () => compileLabComposition(incompleteInitialEquipment, resolve),
    "so runtime cannot synthesize it",
  );

  const optional = syntheticCompositionSource(["optional"]);
  const approvalPredicate = {
    kind: "approval" as const,
    instanceId: "optional",
    gateId: "teacher-approved",
    equals: true,
  };
  optional.techniqueInstances[0].variantId = "teacher-approved";
  optional.compositionConnections[0].enabledWhen = approvalPredicate;
  optional.reachabilityWitnesses = [
    { id: "not-approved", configuration: {}, approvalGates: { "optional.teacher-approved": false } },
    { id: "approved", configuration: {}, approvalGates: { "optional.teacher-approved": true } },
  ];
  const approved = await compileLabComposition(optional, resolve, { witnessId: "approved" });
  const notApproved = await compileLabComposition(optional, resolve, { witnessId: "not-approved" });
  if (approved.compositionManifest?.instances.length !== 1 || notApproved.compositionManifest?.instances.length !== 0) {
    throw new Error("Approval-aware reachability witnesses did not select the expected variant.");
  }
  const optionalAssessmentTechnique = syntheticComposableTechnique();
  optionalAssessmentTechnique.successCriteria = [{
    id: "optional-criterion",
    type: "notebookEntry",
    label: "Optional selected criterion",
    notebookTag: "optional-selected",
  }];
  optionalAssessmentTechnique.composition!.completion.requiredValidationRuleIds = ["optional-criterion"];
  const optionalAssessmentSource = structuredClone(optional);
  optionalAssessmentSource.compositionAssessmentOrder = [{
    kind: "technique-success-criterion",
    instanceId: "optional",
    ruleId: "optional-criterion",
  }];
  const approvedAssessment = await compileLabComposition(
    optionalAssessmentSource,
    async () => structuredClone(optionalAssessmentTechnique),
    { witnessId: "approved" },
  );
  const notApprovedAssessment = await compileLabComposition(
    optionalAssessmentSource,
    async () => structuredClone(optionalAssessmentTechnique),
    { witnessId: "not-approved" },
  );
  if (approvedAssessment.assessments[0]?.id !== "optional--optional-criterion" ||
    notApprovedAssessment.assessments.length !== 0) {
    throw new Error("Explicit assessment ordering did not follow the active reachability witness.");
  }

  const deadUnderWitnesses = structuredClone(optional);
  deadUnderWitnesses.reachabilityWitnesses = [
    { id: "never-approved", configuration: {}, approvalGates: { "teacher-approved": false } },
  ];
  await expectFailure("dead under all witnesses", () => compileLabComposition(deadUnderWitnesses, resolve), "dead under every declared reachability witness");

  const configured = syntheticCompositionSource(["configured"]);
  const configuredPredicate = {
    kind: "configuration" as const,
    instanceId: "configured",
    slotId: "mode",
    equals: "alternate",
  };
  configured.techniqueInstances[0].enabledWhen = configuredPredicate;
  configured.compositionConnections[0].enabledWhen = configuredPredicate;
  configured.reachabilityWitnesses = [
    { id: "standard", configuration: { "configured.mode": "standard" }, approvalGates: {} },
    { id: "alternate", configuration: { "configured.mode": "alternate" }, approvalGates: {} },
  ];
  const configuredAlternate = await compileLabComposition(configured, resolve, { witnessId: "alternate" });
  if (configuredAlternate.actions.find((action) => action.id === "configured--place-instrument")
    ?.parameters.configuredMode !== "alternate") {
    throw new Error("Selected witness configuration did not drive the compiled binding.");
  }

  const structuredTechnique = syntheticComposableTechnique();
  structuredTechnique.composition!.configurationSlots.push({
    id: "global-bound",
    valueType: "string",
    required: true,
    defaultValue: "teacher-global-bound",
  });
  structuredTechnique.actions.push(
    {
      id: "measure-structured-volume",
      verb: "measureVolume",
      label: "Measure structured volume",
      volume: { source: "action-input", outputMeasurementId: "local-volume" },
      parameters: {
        sourceDefinitionId: "wash-bottle",
        targetDefinitionId: "graduated-cylinder",
        inputMode: "numeric",
      },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "wash-bottle",
        targetDefinitionId: "graduated-cylinder",
        accessibleLabel: "Measure a volume.",
      },
      prerequisites: [], stateChanges: [], invalidCases: [],
      feedback: { success: "Measured.", invalid: "Measure again." }, evidence: [],
    },
    {
      id: "transfer-structured-volume",
      verb: "transfer",
      label: "Transfer structured volume",
      volume: { source: "measurement", referenceId: "local-volume" },
      parameters: { sourceDefinitionId: "wash-bottle", targetDefinitionId: "graduated-cylinder" },
      interaction: {
        type: "pourInto",
        sourceDefinitionId: "wash-bottle",
        targetDefinitionId: "graduated-cylinder",
        accessibleLabel: "Transfer the measured volume.",
      },
      prerequisites: [], stateChanges: [], invalidCases: [],
      feedback: { success: "Transferred.", invalid: "Transfer again." }, evidence: [],
    },
    {
      id: "classify-structured-measurement",
      verb: "calculate",
      label: "Classify structured measurement",
      parameters: {
        template: "classifyMeasurementAgainstBound",
        measurementId: "local-response",
        boundMeasurementId: "{{config.global-bound}}",
        comparison: "below",
        calculationId: "local-classification",
      },
      prerequisites: [], stateChanges: [], invalidCases: [],
      feedback: { success: "Classified.", invalid: "Classify again." }, evidence: [],
    },
    {
      id: "transform-structured-measurement",
      verb: "calculate",
      label: "Transform structured measurement",
      analysis: {
        type: "unaryEvidenceTransform",
        input: { source: "measurement", referenceId: "local-volume" },
        operation: "reciprocal",
        outputUnit: "1/mL",
        outputCalculationId: "local-transformed-volume",
      },
      parameters: {}, prerequisites: [], stateChanges: [], invalidCases: [],
      feedback: { success: "Transformed.", invalid: "Transform again." }, evidence: [],
    },
  );
  structuredTechnique.composition!.legacyActionEffects = structuredTechnique.actions.slice(-4).map((action) => {
    const derived = deriveActionEffectContract(action);
    if (!derived.contract || derived.errors.length > 0) {
      throw new Error(`Unable to derive structured fixture effect for ${action.id}: ${derived.errors.join(" ")}`);
    }
    return { actionId: action.id, effect: derived.contract };
  });
  structuredTechnique.process.nodes.push(
    {
      id: "measure-structured-volume-node", type: "action", title: "Measure structured volume",
      description: "Measure structured volume.", actionId: "measure-structured-volume", config: {},
      validation: [], hints: [], feedback: { success: "Measured.", retry: "Measure again." },
    },
    {
      id: "transfer-structured-volume-node", type: "action", title: "Transfer structured volume",
      description: "Transfer structured volume.", actionId: "transfer-structured-volume", config: {},
      validation: [], hints: [], feedback: { success: "Transferred.", retry: "Transfer again." },
    },
    {
      id: "classify-structured-measurement-node", type: "action", title: "Classify structured measurement",
      description: "Classify structured measurement.", actionId: "classify-structured-measurement", config: {},
      validation: [], hints: [], feedback: { success: "Classified.", retry: "Classify again." },
    },
    {
      id: "transform-structured-measurement-node", type: "action", title: "Transform structured measurement",
      description: "Transform structured measurement.", actionId: "transform-structured-measurement", config: {},
      validation: [], hints: [], feedback: { success: "Transformed.", retry: "Transform again." },
    },
  );
  structuredTechnique.process.edges.push(
    { from: "place-node", to: "measure-structured-volume-node", label: "Measure", condition: { type: "always" } },
    { from: "measure-structured-volume-node", to: "transfer-structured-volume-node", label: "Transfer", condition: { type: "always" } },
    { from: "transfer-structured-volume-node", to: "classify-structured-measurement-node", label: "Classify", condition: { type: "always" } },
    { from: "classify-structured-measurement-node", to: "transform-structured-measurement-node", label: "Transform", condition: { type: "always" } },
  );
  const structuredExit = structuredTechnique.composition!.ports.find((port) => port.id === "exit");
  if (structuredExit) structuredExit.nodeId = "transform-structured-measurement-node";
  const structuredSource = syntheticCompositionSource(["structured"]);
  structuredSource.techniqueInstances[0].bindings.configuration["global-bound"] = "teacher-global-bound";
  structuredSource.equipment.push("wash-bottle", "graduated-cylinder");
  structuredSource.initialState!.equipment.push(
    {
      id: "fixture-water", definitionId: "wash-bottle", label: "Fixture water", location: "shelf",
      contents: { ...emptyContents, kind: "liquid", label: "Water", volumeMl: 100, wetState: "wet", visualState: "clear-liquid" },
    },
    {
      id: "fixture-cylinder", definitionId: "graduated-cylinder", label: "Fixture cylinder", location: "shelf",
      contents: emptyContents,
    },
  );
  const structuredCompiled = await compileLabComposition(
    structuredSource,
    async () => structuredClone(structuredTechnique),
  );
  const structuredMeasure = structuredCompiled.actions.find((action) => action.id === "structured--measure-structured-volume");
  const structuredTransfer = structuredCompiled.actions.find((action) => action.id === "structured--transfer-structured-volume");
  const structuredClassification = structuredCompiled.actions.find((action) => action.id === "structured--classify-structured-measurement");
  const structuredTransform = structuredCompiled.actions.find((action) => action.id === "structured--transform-structured-measurement");
  if (structuredMeasure?.volume?.outputMeasurementId !== "structured--local-volume" ||
    structuredTransfer?.volume?.source !== "measurement" ||
    structuredTransfer.volume.referenceId !== "structured--local-volume" ||
    structuredClassification?.parameters.measurementId !== "structured--local-response" ||
    structuredClassification.parameters.boundMeasurementId !== "teacher-global-bound" ||
    structuredClassification.parameters.calculationId !== "structured--local-classification" ||
    structuredTransform?.analysis?.type !== "unaryEvidenceTransform" ||
    structuredTransform.analysis.input.referenceId !== "structured--local-volume" ||
    structuredTransform.analysis.outputCalculationId !== "structured--local-transformed-volume") {
    throw new Error("Compiler 1.5 did not scope structured local references/outputs while preserving a configured global bound.");
  }

  const contractAction = (extra: Partial<ActionDefinition>): ActionDefinition => ({
    id: "contract-15", verb: "calculate", label: "Contract 1.5 fixture", parameters: {},
    prerequisites: [], stateChanges: [], invalidCases: [], feedback: { success: "Done.", invalid: "Retry." }, evidence: [],
    ...extra,
  });
  const valid15: ActionDefinition[] = [
    contractAction({ analysis: { type: "mixedEvidenceRegression", pairs: [
      { x: { source: "measurement", referenceId: "x1" }, y: { source: "calculation", referenceId: "y1" } },
      { x: { source: "calculation", referenceId: "x2" }, y: { source: "measurement", referenceId: "y2" } },
    ], xUnit: "M", yUnit: "abs", outputCalculationId: "regression" } }),
    contractAction({ analysis: { type: "unaryEvidenceTransform", input: { source: "measurement", referenceId: "response" }, operation: "negativeLog10", outputUnit: "abs", outputCalculationId: "transformed" } }),
    contractAction({ analysis: { type: "concentrationFromRegression", response: { source: "calculation", referenceId: "transformed" }, regressionCalculationId: "regression", outputUnit: "M", outputCalculationId: "concentration" } }),
    contractAction({ analysis: { type: "molarConcentrationToMass", concentration: { source: "calculation", referenceId: "concentration" }, solutionVolumeMeasurementId: "volume", molarMassMeasurementId: "molar-mass", outputCalculationId: "mass" } }),
    contractAction({ verb: "observe", runtimeRepeat: { countMeasurementId: "count", outputMeasurementId: "reading", progressId: "acquisition" } }),
    contractAction({ verb: "observe", parameters: { inputMode: "numeric", inputRole: "teacherConfiguration" }, sourceInventory: { sourceDefinitionId: "sample-bottle", outputMeasurementId: "inventory" } }),
    contractAction({ verb: "dissolve", parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, materialTransition: { kind: "solution", visualState: "clear-solution" } }),
    contractAction({ verb: "transfer", parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, volume: { source: "measurement", referenceId: "aliquot" }, deliveryDevice: { deviceDefinitionId: "graduated-pipette-10ml" } }),
    contractAction({ verb: "observe", parameters: { inputMode: "choice" }, choiceObservation: { outputCalculationId: "endpoint", options: [
      { label: "Bubbling continues", tag: "continues", value: 0 }, { label: "Bubbling subsided", tag: "subsided", value: 1 },
    ] } }),
  ];
  const rejected15 = valid15.map((action) => ({ action, result: validateActionDefinition(action) })).find((entry) => !entry.result.ok);
  if (rejected15) throw new Error(`A valid compiler 1.5 typed contract fixture was rejected: ${rejected15.result.errors.join(" ")}`);
  const malformed15 = [
    contractAction({ analysis: { type: "unaryEvidenceTransform", input: { source: "measurement", referenceId: "x" }, operation: "ln" as never, outputUnit: "x", outputCalculationId: "bad" } }),
    contractAction({ verb: "observe", runtimeRepeat: { countMeasurementId: "", outputMeasurementId: "x", progressId: "p" } }),
    contractAction({ verb: "observe", parameters: { inputMode: "numeric" }, volume: { source: "literal", valueMl: 1 }, sourceInventory: { sourceDefinitionId: "sample-bottle", outputMeasurementId: "inventory" } }),
    contractAction({ verb: "observe", parameters: { inputMode: "numeric", inputRole: "teacherConfiguration", configuredValue: 1 }, sourceInventory: { sourceDefinitionId: "ph-paper", outputMeasurementId: "inventory" } }),
    contractAction({ verb: "dissolve", parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, materialTransition: {} }),
    contractAction({ verb: "transfer", parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, deliveryDevice: { deviceDefinitionId: "graduated-pipette-10ml" } }),
    contractAction({ verb: "transfer", parameters: { sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml" }, volume: { source: "literal", valueMl: 1 }, interaction: { type: "dispenseDrops", sourceDefinitionId: "sample-bottle", targetDefinitionId: "beaker-150ml", accessibleLabel: "Dispense a drop." }, deliveryDevice: { deviceDefinitionId: "graduated-pipette-10ml" } }),
    contractAction({ verb: "observe", parameters: { inputMode: "choice" }, choiceObservation: { outputCalculationId: "endpoint", options: [
      { label: "Same", tag: "same", value: 1 }, { label: "Same", tag: "same", value: 1 },
    ] } }),
  ];
  if (malformed15.some((action) => validateActionDefinition(action).ok)) throw new Error("A malformed compiler 1.5 typed contract fixture was accepted.");
  const collidingRepeatProgress = structuredClone(structuredTechnique);
  collidingRepeatProgress.actions.push(
    contractAction({ id: "repeat-count-producer", verb: "observe", parameters: { measurementId: "repeat-count" } }),
    contractAction({ id: "repeat-progress-a", verb: "record", runtimeRepeat: { countMeasurementId: "repeat-count", outputMeasurementId: "reading-a", progressId: "shared-progress" } }),
    contractAction({ id: "repeat-progress-b", verb: "record", runtimeRepeat: { countMeasurementId: "repeat-count", outputMeasurementId: "reading-b", progressId: "shared-progress" } }),
  );
  const repeatProgressResult = validateTechniqueDefinition(collidingRepeatProgress);
  if (repeatProgressResult.ok || !repeatProgressResult.errors.some((error) => error.includes('repeats runtime repeat progress id "shared-progress"'))) {
    throw new Error("Duplicate runtime-repeat progress identities were not rejected exactly.");
  }
  for (const reverse of [false, true]) {
    const crossNamespace = structuredClone(structuredTechnique);
    const typed = contractAction({ id: "typed-repeat-progress", verb: "record", runtimeRepeat: { countMeasurementId: "repeat-count", outputMeasurementId: "typed-reading", progressId: "cross-progress" } });
    const legacy = contractAction({ id: "legacy-repeat-progress", verb: "record", parameters: { repeatGroupId: "cross-progress", repeatIteration: 1, repeatCount: 1 } });
    crossNamespace.actions.push(...(reverse ? [legacy, typed] : [typed, legacy]));
    const crossResult = validateTechniqueDefinition(crossNamespace);
    if (crossResult.ok || !crossResult.errors.some((error) => error.includes('runtime repeat progress id "cross-progress" collides with a legacy repeat group id'))) {
      throw new Error("Typed and legacy repeat progress identities were not rejected in both declaration orders.");
    }
  }

  const undeclaredApproval = structuredClone(optional);
  undeclaredApproval.techniqueInstances[0].enabledWhen = approvalPredicate;
  undeclaredApproval.techniqueInstances[0].variantId = undefined;
  undeclaredApproval.techniqueInstances[0].enabledWhen.gateId = "not-declared";
  undeclaredApproval.compositionConnections[0].enabledWhen = undeclaredApproval.techniqueInstances[0].enabledWhen;
  undeclaredApproval.reachabilityWitnesses = undeclaredApproval.reachabilityWitnesses.map((witness) => ({
    ...witness,
    approvalGates: { "optional.not-declared": true },
  }));
  await expectFailure(
    "undeclared approval gate",
    () => compileLabComposition(undeclaredApproval, resolve),
    "undeclared approval gate",
  );

  return {
    single: "compiled-valid-flat-definition",
    multi: "deterministic-connected-instances",
    repeat: "stable-distinct-bounded-ids",
    equipment: "explicit-lab-owned-initial-state-no-standalone-fallback",
    roleContinuity: "exact-pair-multi-role-reuse-valid-with-bijective-conflict-rejection",
    amendment: "loader-valid-legacy-effects-technique-root-complete-unique-bindings-full-global-edge-and-manifest-shapes",
    compatibility: "equilibrium-three-row-and-quickache-seven-row-full-shapes-identities-order-and-substitutions",
    witnesses: "declared-approval-and-configuration-selected-branches-and-assessment-order",
    local: "typed-pedagogical-evidence-supported",
    structuredEvidence: "compiler-1.5-scoped-outputs-and-references-with-configured-global-preservation",
    analysisAndProcedureEvidence: "eight-positive-and-negative-typed-contract-fixtures",
    legacy: "techniqueRefs-hydration-compiler-contract-1.0-through-1.6-reading-and-1.7-rejection",
    routeAdapter: "manifest-origin-gated-intent-and-rejection",
    failures: "legacy-effect-missing-conflicting-emitted-or-malformed,equipment-binding-malformed-missing-duplicate-cross-form-inferred-or-incompatible,edge-order-missing-duplicate-inactive-or-ambiguous-repeat,composition-root-non-entry-unresolved-or-inactive,spoofed-physical,spoofed-measurement,spoofed-origin,missing-version,binding,port,origin,reference,dead-output,dead-under-all-witnesses,undeclared-gate,runtime-fallback-equipment,ambiguous-ids-and-repeat-endpoint,incomplete-assessment-order,conflicting-substitution,colliding-reference-bindings,ambiguous-source-validation-id",
  };
};
