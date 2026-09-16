import { loadBundledLab } from "../data/loadBundledLabs";
import {
  resolveTitrationActions,
  type TitrationDropPlan,
} from "../domain/titrationModels";
import type {
  AcidBaseTitrationModel,
  ActionDefinition,
  ContentState,
  EquipmentInstance,
  LabDefinition,
  ProcessNode,
} from "../domain/types";
import { validateLabDefinition } from "../domain/validation";
import { collectStudioInteractionIssues } from "../studio/studioValidation";
import {
  ACID_RESERVE_ML,
  acidBaseTitrationFamily,
  DEFAULT_BURETTE_FILL_ML,
  INDICATOR_ADDITION_ML,
  NAOH_RESERVE_ML,
  p0ActionIds,
  p0ModuleIds,
  p0NodeIds,
  SYNTHETIC_UNKNOWN_ACID_MOLARITY_M,
} from "./catalogs";
import { createFidelityManifest } from "./fidelity";
import { stableDraftFingerprint, stableValueHash } from "./fingerprint";
import {
  blueprintValidator,
  publicStageSummaryValidator,
  stagedExperimentValidator,
  validateSchema,
} from "./schemas";
import type {
  CompiledExperimentBlueprint,
  ComposerPreviewOutcome,
  ComposerValidationIssue,
  ExperimentRequest,
  LabInventoryProfile,
  PublicStageSummary,
  StagedExperiment,
} from "./types";
import { validateExperimentRequest } from "./validateExperimentRequest";

export const P0_ACTION_IDS = p0ActionIds;
export const P0_NODE_IDS = p0NodeIds;

const P0_EQUIPMENT_IDS = new Set([
  "unknown-acid-bottle",
  "graduated-cylinder",
  "erlenmeyer-flask-250ml",
  "phenolphthalein-dropper",
  "naoh-bottle",
  "burette-50ml",
  "ring-stand-clamp",
  "waste-beaker",
]);

// The full titration technique can optionally coordinate a pH-meter workflow. P0 deliberately
// uses indicator evidence only, so it must not carry meter identity, meter readiness, or derived
// pH values into its smaller executable contract.
const P0_INDICATOR_ONLY_PARAMETER_KEYS = [
  "meterInstanceId",
  "readinessNotebookTag",
  "requirePh",
  "indicatorStartPh",
  "indicatorStrongPh",
  "idealEquivalencePh",
  "phPrecision",
] as const;

// These keys drive the longer, source-level titration trial. They conflict with P0's single
// derived dispense action by requiring a typed increment and routing reducer work through the
// source trial state machine. P0 retains its source/receiver identities and measurement IDs, but
// intentionally uses the ordinary drop-dispense runtime instead.
const P0_SOURCE_TRIAL_PARAMETER_KEYS = [
  "trialReferenceId",
  "buretteInstanceId",
  "receiverInstanceId",
  "aliquotMeasurementId",
  "initialMeasurementId",
  "finalMeasurementId",
  "endpointWindowMl",
  "maximumIncrementMl",
  "maximumDeliveryMl",
  "persistenceSeconds",
  "titrationOperation",
  "inputMode",
  "inputRole",
  "inputRequired",
  "inputMin",
  "inputMinExclusive",
  "inputMax",
  "inputStep",
  "inputLabel",
] as const;

const stripP0MeterParameters = (action: ActionDefinition): ActionDefinition => {
  const rewritten = structuredClone(action);
  [...P0_INDICATOR_ONLY_PARAMETER_KEYS, ...P0_SOURCE_TRIAL_PARAMETER_KEYS].forEach((key) => {
    delete rewritten.parameters[key];
  });
  return rewritten;
};

const issue = (
  code: ComposerValidationIssue["code"],
  phase: ComposerValidationIssue["phase"],
  message: string,
): ComposerValidationIssue => ({ code, phase, message, recoverable: true });

const assertVerifiedSourceProvenance = (source: LabDefinition): void => {
  const actionsById = new Map(source.actions.map((action) => [action.id, action]));
  const nodesById = new Map(source.process.nodes.map((node) => [node.id, node]));
  P0_ACTION_IDS.forEach((actionId, index) => {
    if (!actionsById.has(actionId)) {
      throw new Error(`Verified source is missing P0 action "${actionId}".`);
    }
    const nodeId = P0_NODE_IDS[index];
    const node = nodesById.get(nodeId);
    if (!node) throw new Error(`Verified source is missing P0 process node "${nodeId}".`);
    if (node.actionId !== actionId) {
      throw new Error(
        `Verified source node "${nodeId}" must reference action "${actionId}", not "${node.actionId ?? "none"}".`,
      );
    }
  });

  const manifest = source.compositionManifest;
  if (!manifest || manifest.status !== "compiled") {
    throw new Error(
      "Verified source must be a compiled composition with public provenance for every P0 action/node pair.",
    );
  }
  P0_ACTION_IDS.forEach((actionId, index) => {
    const nodeId = P0_NODE_IDS[index]!;
    const origin = manifest.origins.find((candidate) =>
      candidate.actionId === actionId && candidate.nodeId === nodeId,
    );
    if (!origin) {
      throw new Error(
        `Verified source has no compiled composition origin for P0 action/node pair "${actionId}" / "${nodeId}".`,
      );
    }
    if (origin.sourceActionId !== actionId || origin.sourceNodeId !== nodeId) {
      throw new Error(
        `Verified source P0 pair "${actionId}" / "${nodeId}" does not preserve its authored action/node identity.`,
      );
    }
    if (
      origin.techniqueId !== acidBaseTitrationFamily.sourceTechniqueId
      || origin.techniqueVersion !== acidBaseTitrationFamily.sourceTechniqueVersion
    ) {
      throw new Error(
        `Verified source P0 pair "${actionId}" / "${nodeId}" originates from ${origin.techniqueId}@${origin.techniqueVersion}, not ${acidBaseTitrationFamily.sourceTechniqueId}@${acidBaseTitrationFamily.sourceTechniqueVersion}.`,
      );
    }
  });
};

const emptyContents = (): ContentState => ({
  kind: "empty",
  label: "empty",
  solutes: [],
  contamination: [],
  wetState: "dry",
  visualState: "empty",
});

const solutionContents = (
  label: string,
  volumeMl: number,
  concentrationM: number,
  solute: { id: string; label: string },
): ContentState => ({
  kind: "solution",
  label,
  volumeMl,
  solutes: [{
    ...solute,
    // Dimensionally correct amount: mol/L times L.
    amount: concentrationM * (volumeMl / 1_000),
    unit: "mol",
  }],
  concentration: { value: concentrationM, unit: "M" },
  contamination: [],
  wetState: "wet",
  visualState: "clear-solution",
});

const rewriteInitialEquipment = (
  source: EquipmentInstance[],
  inventory: LabInventoryProfile,
  request: ExperimentRequest,
  titrantMolarityM: number,
): EquipmentInstance[] => {
  const byDefinitionId = new Map(source.map((instance) => [instance.definitionId, instance]));
  const analyte = inventory.chemicals.find((item) => item.chemicalId === "synthetic_unknown_acid_a")!;
  const titrant = inventory.chemicals.find((item) => item.chemicalId === "standardized_naoh")!;
  const indicator = inventory.chemicals.find((item) => item.chemicalId === "phenolphthalein_indicator")!;
  const naohBottleVolumeMl = titrant.quantityMl - DEFAULT_BURETTE_FILL_ML;

  return [...P0_EQUIPMENT_IDS].map((definitionId) => {
    const sourceInstance = byDefinitionId.get(definitionId);
    if (!sourceInstance) throw new Error(`Hydrated source is missing ${definitionId}.`);
    const instance = structuredClone(sourceInstance);
    if (definitionId === "unknown-acid-bottle") {
      instance.label = request.sampleLabel?.trim() || "Synthetic unknown acid A";
      instance.contents = solutionContents(
        "Synthetic monoprotic-acid sample",
        analyte.quantityMl,
        SYNTHETIC_UNKNOWN_ACID_MOLARITY_M,
        { id: "synthetic-monoprotic-acid", label: "Synthetic monoprotic acid" },
      );
    } else if (definitionId === "naoh-bottle") {
      instance.label = `${titrantMolarityM.toFixed(3)} M NaOH reserve`;
      instance.contents = solutionContents(
        `${titrantMolarityM.toFixed(3)} M standardized NaOH reserve`,
        naohBottleVolumeMl,
        titrantMolarityM,
        { id: "sodium-hydroxide", label: "Sodium hydroxide" },
      );
    } else if (definitionId === "burette-50ml") {
      instance.label = `Prefilled ${titrantMolarityM.toFixed(3)} M NaOH burette`;
      instance.contents = solutionContents(
        `${titrantMolarityM.toFixed(3)} M standardized NaOH`,
        DEFAULT_BURETTE_FILL_ML,
        titrantMolarityM,
        { id: "sodium-hydroxide", label: "Sodium hydroxide" },
      );
    } else if (definitionId === "phenolphthalein-dropper") {
      instance.contents = {
        kind: "solution",
        label: "Phenolphthalein indicator",
        volumeMl: indicator.quantityMl,
        solutes: [{
          id: "phenolphthalein",
          label: "Phenolphthalein",
          amount: indicator.quantityMl * 0.001,
          unit: "g",
        }],
        contamination: [],
        wetState: "wet",
        visualState: "indicator-solution",
      };
    } else {
      instance.contents = emptyContents();
    }
    instance.location = "shelf";
    delete instance.snapZoneId;
    delete instance.x;
    delete instance.y;
    delete instance.rotation;
    delete instance.zIndex;
    delete instance.interactionStatus;
    return instance;
  });
};

const rewriteActions = (
  sourceActions: ActionDefinition[],
  request: ExperimentRequest,
  plan: TitrationDropPlan,
): ActionDefinition[] => {
  const byId = new Map(sourceActions.map((action) => [action.id, action]));
  const selected = P0_ACTION_IDS.map((actionId) => {
    const source = byId.get(actionId);
    if (!source) throw new Error(`Hydrated source is missing action ${actionId}.`);
    const action = stripP0MeterParameters(source);
    if (action.id === "mount-burette") {
      if (action.interaction) {
        action.interaction.invalidCue = "Mount the prefilled burette on the ring stand before reading its initial level.";
      }
    }
    if (action.id === "read-initial-burette") {
      // The composed source now records this through its multi-step trial state machine. P0 needs
      // the physical scale reading itself so the ordinary runtime can create the initial evidence
      // that its later calculation consumes.
      action.verb = "measureVolume";
      action.atomId = "atom.measure.read-burette";
      action.parameters.label = "Initial burette reading";
      action.parameters.readingPrecisionMl = 0.05;
      action.parameters.scaleReadsDownward = true;
      action.interaction = {
        type: "readInstrument",
        sourceDefinitionId: "burette-50ml",
        stationId: "burette-50ml",
        successCue: "Initial burette level read.",
        invalidCue: "Mount the prefilled burette before reading its scale.",
        accessibleLabel: "Read the meniscus on the mounted prefilled burette.",
      };
      action.prerequisites = [{
        id: "prefilled-burette-mounted-required",
        type: "actionEvidence",
        label: "The prefilled burette is mounted on the ring stand.",
        actionId: "mount-burette",
      }];
      delete action.parameters.requiredAttachmentState;
      delete action.parameters.attachmentParentDefinitionId;
      delete action.parameters.attachmentChildDefinitionId;
      delete action.parameters.attachmentSnapZoneId;
      action.invalidCases = action.invalidCases
        .filter((invalidCase) => invalidCase.id !== "funnel-still-present")
        .map((invalidCase) => invalidCase.id === "empty-burette"
          ? {
              ...invalidCase,
              recovery: "Reset the rehearsal to restore the configured prefilled burette.",
            }
          : invalidCase);
      action.feedback.invalid = "Mount the prefilled burette before reading it.";
      action.evidence = ["measureVolume", "measurement"];
    }
    if (action.id === "record-initial-burette") {
      // This record copies the initial scale value the instrument produced; it never replaces that
      // evidence with a hidden authored number or a typed value from the source trial flow.
      action.parameters.copyExistingMeasurementOnly = true;
    }
    if (action.id === "measure-acid" || action.id === "transfer-acid-flask") {
      action.parameters.volumeMl = request.aliquotVolumeMl;
    }
    if (action.id === "add-indicator") action.parameters.volumeMl = INDICATOR_ADDITION_ML;
    if (action.id === "deliver-titrant") {
      // The current composed source expands titrant delivery into several learner-record steps.
      // P0 is its own indicator-only executable rehearsal, so retain the same source/receiver
      // identities while restoring the ordinary drop-dispense interaction that derives its plan.
      action.interaction = {
        type: "dispenseDrops",
        sourceDefinitionId: "burette-50ml",
        targetDefinitionId: "erlenmeyer-flask-250ml",
        successCue: "Titrant is delivered to the indicator endpoint.",
        invalidCue: "Mount the prefilled burette, charge and position the flask, and record the initial reading before dispensing.",
        accessibleLabel: "Deliver titrant from the mounted burette to the indicator endpoint.",
      };
      action.parameters.initialBuretteReadingMl = 0;
      action.parameters.initialBuretteMeasurementId = "burette-initial-volume";
      action.parameters.finalBuretteMeasurementId = "burette-final-volume";
      action.parameters.finalBuretteLabel = "Final burette reading";
      action.feedback.invalid = "Mount the prefilled burette, charge and position the flask, and record the initial reading before dispensing.";
    }
    return action;
  });

  const withResolvedModel = resolveTitrationActions(
    {
      id: "composer-titration-action-resolution",
      title: "Composer action resolution",
      description: "Internal action parameter resolution.",
      audience: "internal",
      learningGoals: [],
      safetyNotes: [],
      equipment: [...P0_EQUIPMENT_IDS],
      techniques: [],
      actions: selected,
      process: { startNodeId: P0_NODE_IDS[0], nodes: [], edges: [] },
      assessments: [],
      metadata: { version: "1.0.0", author: "Lab Studio", updatedAt: "2026-08-29T00:00:00Z", tags: [] },
      titrationModels: [{
        id: "unknown-acid-naoh",
        type: "acidBase",
        analyte: { formula: "CH3COOH", role: "acid", strength: "weak", equilibriumConstant: 1.753e-5 },
        titrant: { formula: "NaOH", role: "base", strength: "strong" },
        analyteMolarityM: plan.analyteMolarityM,
        analyteVolumeMl: plan.analyteVolumeMl,
        titrantMolarityM: plan.titrantMolarityM,
        stoichiometricRatio: plan.stoichiometricRatio,
        dropVolumeMl: plan.dropVolumeMl,
        endpointOffsetDrops: plan.endpointOffsetDrops,
        maxExtraDrops: plan.maxExtraDrops,
        temperatureC: 25,
        waterIonProduct: 1e-14,
        phPrecision: 2,
      }],
    },
    selected,
  );
  return withResolvedModel.map(stripP0MeterParameters);
};

const rewriteNodes = (sourceNodes: ProcessNode[], request: ExperimentRequest): ProcessNode[] => {
  const byId = new Map(sourceNodes.map((node) => [node.id, node]));
  return P0_NODE_IDS.map((nodeId, index) => {
    const source = byId.get(nodeId);
    if (!source) throw new Error(`Hydrated source is missing process node ${nodeId}.`);
    const node = structuredClone(source);
    node.layout = {
      x: 40 + (index % 4) * 300,
      y: 60 + Math.floor(index / 4) * 200,
      lane: node.layout?.lane,
      display: node.layout?.display ?? "expanded",
    };
    if (node.id === "read-initial-burette-node") {
      node.description = "Read the initial level on the mounted, prefilled burette.";
      node.feedback.retry = "Mount the prefilled burette, then read its scale.";
    }
    if (node.id === "measure-acid-node") {
      node.description = `Measure ${request.aliquotVolumeMl.toFixed(1)} mL of the synthetic acid into the graduated cylinder.`;
    }
    if (node.id === "deliver-titrant-node") {
      // A drop is a real physical state change but is not a completed P0 endpoint. The state-path
      // gate stays false until the same ordinary reducer accepts the model-derived indicator
      // endpoint, preventing the process from advancing after a single arbitrary drop.
      node.validation = [{
        id: "indicator-endpoint-accepted",
        type: "statePath",
        label: "The modeled indicator endpoint has been accepted after the required drop sequence.",
        path: "dropDispenses.deliver-titrant.accepted",
        equals: true,
      }];
      node.feedback.retry = "Continue dispensing one drop at a time, then accept the modeled pale-pink indicator endpoint.";
    }
    return node;
  });
};

const linearEdges = () => [
  ...P0_NODE_IDS.slice(0, -1).map((from, index) => ({
    from,
    to: P0_NODE_IDS[index + 1],
    label: "Next",
    condition: { type: "validationPassed" as const },
  })),
  {
    from: "confirm-endpoint-node",
    to: "deliver-titrant-node",
    label: "Adjust titration",
    condition: { type: "retry" as const },
  },
  {
    from: "calculate-acid-molarity-node",
    to: "calculate-acid-molarity-node",
    label: "Retry calculation",
    condition: { type: "retry" as const },
  },
];

export interface CompileAcidBaseTitrationOptions {
  stageRevision: number;
  createdAt?: string;
  loadSource?: () => Promise<LabDefinition>;
}

export const compileAcidBaseTitration = async (
  requestInput: unknown,
  inventoryInput: unknown,
  currentDraft: LabDefinition,
  options: CompileAcidBaseTitrationOptions,
): Promise<ComposerPreviewOutcome> => {
  const inputValidation = validateExperimentRequest(requestInput, inventoryInput);
  if (!inputValidation.ok) return inputValidation;
  const { request, inventory, resolvedRoles, titrantMolarityM, plan } = inputValidation.value;

  let source: LabDefinition;
  try {
    const hydrated = await (options.loadSource ?? (() => loadBundledLab("acid-base-titration")))();
    source = structuredClone(hydrated);
  } catch (error) {
    return {
      ok: false,
      issues: [issue(
        "COMPILED_DEFINITION_INVALID",
        "definition",
        error instanceof Error ? `Verified source could not be loaded: ${error.message}` : "Verified source could not be loaded.",
      )],
    };
  }
  if (
    source.id !== acidBaseTitrationFamily.sourceLabId
    || source.metadata.version !== acidBaseTitrationFamily.sourceLabVersion
  ) {
    return {
      ok: false,
      issues: [issue(
        "COMPILED_DEFINITION_INVALID",
        "definition",
        `Expected ${acidBaseTitrationFamily.sourceLabId}@${acidBaseTitrationFamily.sourceLabVersion}; received ${source.id}@${source.metadata.version}.`,
      )],
    };
  }

  try {
    assertVerifiedSourceProvenance(source);
  } catch (error) {
    return {
      ok: false,
      issues: [issue(
        "COMPILED_DEFINITION_INVALID",
        "definition",
        error instanceof Error ? error.message : "Verified source provenance could not be confirmed.",
      )],
    };
  }

  const sourceDraftFingerprint = stableDraftFingerprint(currentDraft);
  const stageId = `stage-v1-r${options.stageRevision}-${stableValueHash({
    sourceLabId: acidBaseTitrationFamily.sourceLabId,
    sourceLabVersion: acidBaseTitrationFamily.sourceLabVersion,
    sourceTechniqueId: acidBaseTitrationFamily.sourceTechniqueId,
    sourceTechniqueVersion: acidBaseTitrationFamily.sourceTechniqueVersion,
    familyVersion: acidBaseTitrationFamily.version,
    request,
    inventory,
    stageRevision: options.stageRevision,
  })}`;
  const fidelity = createFidelityManifest(request.deliveryContext);
  const blueprint: CompiledExperimentBlueprint = {
    id: `blueprint-${stageId}`,
    familyId: acidBaseTitrationFamily.id,
    familyVersion: acidBaseTitrationFamily.version,
    request,
    sourceInventoryRevision: inventory.revision,
    selectedSamplePresetId: "synthetic_unknown_acid_a",
    resolvedRoles,
    moduleIds: [...p0ModuleIds],
    model: {
      analyteMolarityM: SYNTHETIC_UNKNOWN_ACID_MOLARITY_M,
      analyteVolumeMl: request.aliquotVolumeMl,
      titrantMolarityM,
      stoichiometricRatio: { analyte: 1, titrant: 1 },
      dropVolumeMl: plan.dropVolumeMl,
      endpointOffsetDrops: plan.endpointOffsetDrops,
      maxExtraDrops: plan.maxExtraDrops,
      buretteFillVolumeMl: DEFAULT_BURETTE_FILL_ML,
      indicatorVolumeMl: INDICATOR_ADDITION_ML,
      acidReserveMl: ACID_RESERVE_ML,
      naohReserveMl: NAOH_RESERVE_ML,
    },
    fidelity,
  };
  const blueprintValidation = validateSchema(blueprintValidator, blueprint);
  if (!blueprintValidation.ok) {
    return {
      ok: false,
      issues: [issue(
        "TITRATION_MODEL_DERIVATION_FAILED",
        "model",
        `The internal blueprint failed its strict schema: ${blueprintValidation.diagnostics.map((item) => `${item.path} ${item.message}`).join("; ")}`,
      )],
    };
  }

  const model = structuredClone(source.titrationModels?.find((item) => item.id === "unknown-acid-naoh"));
  if (!model || model.type !== "acidBase") {
    return { ok: false, issues: [issue("COMPILED_DEFINITION_INVALID", "definition", "The verified source has no acid-base model 'unknown-acid-naoh'.")] };
  }
  const acidBaseModel = model as AcidBaseTitrationModel;
  acidBaseModel.analyteMolarityM = SYNTHETIC_UNKNOWN_ACID_MOLARITY_M;
  acidBaseModel.analyteVolumeMl = request.aliquotVolumeMl;
  acidBaseModel.titrantMolarityM = titrantMolarityM;
  acidBaseModel.stoichiometricRatio = { analyte: 1, titrant: 1 };
  acidBaseModel.dropVolumeMl = plan.dropVolumeMl;
  acidBaseModel.endpointOffsetDrops = plan.endpointOffsetDrops;
  acidBaseModel.maxExtraDrops = plan.maxExtraDrops;

  // The hydrated source manifest describes the complete composed activity. This compiler emits a
  // deliberately smaller P0 definition, so carrying that manifest forward would assert origins for
  // actions and nodes that the generated definition intentionally does not contain. Input
  // provenance is checked above before this omission; the derived stage keeps its own explicit
  // family/source identity in the blueprint instead of publishing a stale composition manifest.
  const { compositionManifest: _sourceCompositionManifest, ...sourceDefinition } = source;

  let definition: LabDefinition;
  try {
    definition = {
      ...sourceDefinition,
      id: `composer-${stageId}`,
      title: request.title?.trim() || "Synthetic Unknown Acid Molarity Estimate",
      description: request.objective.trim(),
      audience: `${request.audience}; ${request.experience}; ${request.durationMinutes} minutes; practice/training only`,
      learningGoals: [
        request.objective.trim(),
        "Use aliquot and burette evidence to estimate a synthetic monoprotic-acid molarity.",
      ],
      safetyNotes: [
        "This simulation is not authorization to perform a physical procedure.",
        "Use instructor-approved PPE, eyewash, spill-response, and compatible base-waste procedures for physical rehearsal.",
      ],
      equipment: [...P0_EQUIPMENT_IDS],
      initialState: {
        equipment: rewriteInitialEquipment(
          source.initialState?.equipment ?? [],
          inventory,
          request,
          titrantMolarityM,
        ),
      },
      titrationModels: [acidBaseModel],
      techniques: [],
      actions: rewriteActions(source.actions, request, plan),
      process: {
        startNodeId: P0_NODE_IDS[0],
        nodes: rewriteNodes(source.process.nodes, request),
        edges: linearEdges(),
      },
      assessments: source.assessments.filter((assessment) =>
        assessment.measurementId !== "endpoint-ph" && assessment.notebookTag !== "endpoint-ph"
      ),
      metadata: {
        version: "1.0.0",
        author: "Lab Studio Grounded Experiment Composer",
        updatedAt: source.metadata.updatedAt,
        tags: [
          "lab",
          "composer-generated",
          acidBaseTitrationFamily.id,
          `family-${acidBaseTitrationFamily.version}`,
          "indicator-only",
          "practice-training",
          ...p0ModuleIds,
        ],
      },
    };
  } catch (error) {
    return {
      ok: false,
      issues: [issue(
        "COMPILED_DEFINITION_INVALID",
        "definition",
        error instanceof Error ? error.message : "The verified source could not be parameterized.",
      )],
    };
  }

  // 9. Current authoritative LabDefinition validator.
  const definitionValidation = validateLabDefinition(definition);
  if (!definitionValidation.ok || !definitionValidation.value) {
    return {
      ok: false,
      issues: [issue(
        "COMPILED_DEFINITION_INVALID",
        "definition",
        definitionValidation.errors.join("; "),
      )],
    };
  }
  definition = definitionValidation.value;

  // 10. Studio interaction validation is a stage blocker for P0.
  const interactionIssues = collectStudioInteractionIssues(definition);
  if (interactionIssues.length > 0) {
    return {
      ok: false,
      issues: interactionIssues.map((item) => issue(
        "STUDIO_INTERACTION_BLOCKER",
        "studio_interactions",
        `${item.actionId}: ${item.message}`,
      )),
    };
  }

  const stage: StagedExperiment = {
    stageId,
    stageRevision: options.stageRevision,
    createdAt: options.createdAt ?? new Date().toISOString(),
    sourceInventoryRevision: inventory.revision,
    sourceDraftFingerprint,
    request,
    blueprint,
    definition,
    validation: {
      schemaErrors: [],
      interactionWarnings: [],
      inventoryErrors: [],
    },
    staleReasons: [],
  };
  const stageValidation = validateSchema(stagedExperimentValidator, stage);
  if (!stageValidation.ok) {
    return {
      ok: false,
      issues: [issue(
        "COMPILED_DEFINITION_INVALID",
        "definition",
        `The staged artifact failed its strict schema: ${stageValidation.diagnostics.map((item) => `${item.path} ${item.message}`).join("; ")}`,
      )],
    };
  }

  const summary: PublicStageSummary = {
    stageId,
    stageRevision: options.stageRevision,
    familyId: request.familyId,
    title: definition.title,
    objective: request.objective.trim(),
    audience: request.audience,
    experience: request.experience,
    durationMinutes: request.durationMinutes,
    deliveryContext: request.deliveryContext,
    resolvedRoles,
    moduleIds: [...p0ModuleIds],
    workingVolumes: {
      aliquotMl: request.aliquotVolumeMl,
      buretteFillMl: DEFAULT_BURETTE_FILL_ML,
      indicatorMl: INDICATOR_ADDITION_ML,
    },
    fidelity,
    staleReasons: [],
  };
  const summaryValidation = validateSchema(publicStageSummaryValidator, summary);
  if (!summaryValidation.ok) {
    return {
      ok: false,
      issues: [issue(
        "COMPILED_DEFINITION_INVALID",
        "definition",
        `The public stage summary failed sanitation schema validation: ${summaryValidation.diagnostics.map((item) => `${item.path} ${item.message}`).join("; ")}`,
      )],
    };
  }

  return { ok: true, stage, summary };
};
