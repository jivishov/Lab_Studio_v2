import { bundledLabs, standaloneTechniques } from "../../domain/fixtures";
import type {
  ActionDefinition,
  ActionParameterValue,
  LabDefinition,
  TechniqueDefinition,
} from "../../domain/types";
import {
  validateLabDefinition,
  validatePublicJsonForPublishing,
  validateTechniqueDefinition,
} from "../../domain/validation";
import { equipmentById } from "../../equipment/catalog";
import type { SupportClassification } from "../../platform/fidelity/types";
import { classifyAggregateSupport } from "../../platform/fidelity/comparison";
import type { ClaimSupportAssessment, FidelityLevel } from "../../platform/fidelity/types";
import type {
  ArtifactPackageContext,
  ArtifactValidationDiagnostic,
  CompilationGap,
  ComposeArtifactRequest,
  CoverageReportContract,
  DomainPackDescriptor,
  ProcedureConstraints,
  RunContext,
  StudioArtifactPackage,
  StudioDomainPack,
} from "../../platform/domain-packs/types";
import { createStudioArtifactPackage } from "../../platform/artifacts/builder";
import type { ProcedureIR, ProcedureStepIR, ScalarOrQuantity } from "../../platform/procedure-ir/types";
import { validateProcedureIR } from "../../platform/procedure-ir/validation";
import { createRuntimeState, getActions } from "../../runtime/createRuntime";
import { serializeLab, serializeTechnique } from "../../studio/importExport";
import { runStudioPreviewCheck, type StudioPreviewCheck } from "../../studio/studioPreviewCheck";
import {
  assessStudioReadiness,
  type StudioReadiness,
} from "../../studio/studioReadiness";
import {
  createActionFromTemplate,
  createDraftFromDemo,
} from "../../studio/studioState";
import { stepBlueprintByTemplateId, stepBlueprints, type StepBlueprint } from "../../studio/stepBlueprints";
import { planStudioTransaction } from "../../studio/studioTransactions";
import {
  detectChemistryArtifactKind,
  type ChemistryArtifact,
  type ChemistryArtifactKind,
} from "./artifactKind";
import { getChemistryCapabilityManifestFragment } from "./capabilityFragment";
import {
  chemistryActionCapabilitySources,
  chemistryModelCapabilitySources,
} from "./capabilitySources";
import { getChemistryEvidenceRegistryFragment } from "./evidenceRegistry";
import {
  planChemistryClassRun,
  type ChemistryRunPlanResult,
} from "./planning/chemistryPlanner";

export const chemistryDomainPackVersion = "1.0.0";

export interface ChemistryValidationContext {
  includeReadiness?: boolean;
  includePreview?: boolean;
  requireExportReady?: boolean;
  selectedNodeId?: string;
}

export interface ChemistryValidationDetails {
  artifactKind: ChemistryArtifactKind;
  readiness?: StudioReadiness;
  preview?: StudioPreviewCheck;
}

export type ChemistryValidationReport =
  | ({ ok: true; artifact: ChemistryArtifact; diagnostics: ArtifactValidationDiagnostic[] } & ChemistryValidationDetails)
  | ({ ok: false; diagnostics: ArtifactValidationDiagnostic[] } & Partial<ChemistryValidationDetails>);

export interface ChemistryStepCoverage {
  stepId: string;
  actionKey?: string;
  classification: SupportClassification;
  supportedFidelity: FidelityLevel;
  capabilityRef?: string;
  blueprintId?: string;
}

export interface ChemistryCoverageReport extends CoverageReportContract {
  classification: SupportClassification;
  steps: ChemistryStepCoverage[];
}

export type ChemistryRunPlan = ChemistryRunPlanResult;

export type ChemistryArtifactPackage = StudioArtifactPackage<ChemistryArtifact>;

const descriptor: DomainPackDescriptor = {
  id: "chemistry",
  version: chemistryDomainPackVersion,
  title: "Lab Studio Chemistry",
  artifactKinds: ["LabDefinition", "TechniqueDefinition"],
  supportedProcedureIRVersions: ["1.0"],
  minimumStudioCoreVersion: "1.0.0",
  publicNamespaces: ["labstudio"],
  limitations: [
    "Existing LabDefinition and TechniqueDefinition artifacts remain canonical and are not migrated or wrapped.",
    "Composition is limited to current source-controlled Studio step blueprints and registered deterministic chemistry models.",
    "Class-run plans remain incomplete when reviewed resource quantities or run-context metadata are absent.",
    "No F4 calibration, safety certification, hardware control, or assay behavior is claimed.",
  ],
};

const chemistrySchemas = {
  artifact: {
    contract: "LabDefinition | TechniqueDefinition",
    kindDetection: "structural legacy discriminator with optional explicit schema",
    validators: ["validateLabDefinition", "validateTechniqueDefinition"],
  },
  validationContext: {
    optionalFields: ["includeReadiness", "includePreview", "requireExportReady", "selectedNodeId"],
  },
  package: {
    schema: "studio.artifact-package",
    schemaVersion: "1.0",
    sanitization: "shared Studio artifact-package boundary plus existing chemistry public-JSON export boundary",
  },
};

const serviceOnlyForbiddenKeys = new Set([
  "absolutepath",
  "filepath",
  "localpath",
  "providerfileid",
  "remotefileid",
  "vendorfileid",
  "sha256",
  "checksum",
  "digest",
  "credentials",
  "credential",
  "apikey",
  "secret",
  "password",
  "authorization",
  "cookie",
  "chainofthought",
  "hiddenreasoning",
  "reasoningtrace",
  "runtimestate",
  "rawruntimestate",
  "providerresponse",
  "rawresponse",
  "modeloutput",
]);
const localPathValuePattern = /^(?:[A-Za-z]:[\\/]|\\\\|file:\/\/|\/(?:Users|home|var|tmp|private|etc|opt|srv|mnt|Volumes)(?:\/|$))/i;
const normalizeServiceKey = (key: string): string => key.replace(/[-_\s]/g, "").toLowerCase();

const serviceSanitizationPaths = (input: unknown): string[] => {
  const paths: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (localPathValuePattern.test(value)) paths.push(path || "/");
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}/${index}`));
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const childPath = `${path}/${key}`;
      if (serviceOnlyForbiddenKeys.has(normalizeServiceKey(key))) paths.push(childPath);
      visit(child, childPath);
    });
  };
  visit(input, "");
  return [...new Set(paths)].sort();
};

const sanitizeServiceArtifact = (input: unknown): unknown => {
  if (typeof input === "string") return localPathValuePattern.test(input) ? undefined : input;
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.flatMap((value) => {
      const sanitized = sanitizeServiceArtifact(value);
      return sanitized === undefined ? [] : [sanitized];
    });
  }
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).flatMap(([key, value]) => {
    if (serviceOnlyForbiddenKeys.has(normalizeServiceKey(key))) return [];
    const sanitized = sanitizeServiceArtifact(value);
    return sanitized === undefined ? [] : [[key, sanitized]];
  }));
};

const errorDiagnostic = (
  code: string,
  path: string,
  message: string,
  severity: ArtifactValidationDiagnostic["severity"] = "error",
): ArtifactValidationDiagnostic => ({ code, path, message, severity });

const validateChemistryArtifact = (
  artifact: unknown,
  context: ChemistryValidationContext = {},
): ChemistryValidationReport => {
  const detected = detectChemistryArtifactKind(artifact);
  if (!detected.ok) {
    return {
      ok: false,
      diagnostics: [errorDiagnostic(
        detected.diagnostic.code,
        detected.diagnostic.path,
        detected.diagnostic.message,
      )],
    };
  }

  const direct = detected.kind === "LabDefinition"
    ? validateLabDefinition(artifact)
    : validateTechniqueDefinition(artifact);
  if (!direct.ok || !direct.value) {
    return {
      ok: false,
      artifactKind: detected.kind,
      diagnostics: direct.errors.map((message, index) => errorDiagnostic(
        `chemistry.artifact.${detected.kind === "LabDefinition" ? "lab" : "technique"}.invalid`,
        `/diagnostics/${index}`,
        message,
      )),
    };
  }

  const diagnostics: ArtifactValidationDiagnostic[] = [];
  const publicJsonValidation = validatePublicJsonForPublishing(direct.value);
  diagnostics.push(...publicJsonValidation.errors.map((message, index) => errorDiagnostic(
    "chemistry.artifact.sanitized-field",
    `/sanitization/${index}`,
    message,
    "warning",
  )));
  diagnostics.push(...serviceSanitizationPaths(direct.value).map((path) => errorDiagnostic(
    "chemistry.artifact.sanitized-field",
    path,
    `${path} contains service-forbidden local or provider data and was removed.`,
    "warning",
  )));

  let readiness: StudioReadiness | undefined;
  let preview: StudioPreviewCheck | undefined;
  if (detected.kind === "LabDefinition") {
    const lab = direct.value as LabDefinition;
    if (context.includeReadiness !== false) {
      readiness = assessStudioReadiness(lab);
      diagnostics.push(...readiness.diagnostics.map((diagnostic) => errorDiagnostic(
        `chemistry.studio.readiness.${diagnostic.id}`,
        diagnostic.anchor?.nodeId
          ? `/process/nodes/${diagnostic.anchor.nodeId}`
          : `/${diagnostic.category}`,
        diagnostic.message,
        context.requireExportReady && diagnostic.severity === "fail" ? "error" : "warning",
      )));
    }
    if (context.includePreview !== false) {
      preview = runStudioPreviewCheck(lab, context.selectedNodeId);
      diagnostics.push(...preview.errors.map((message, index) => errorDiagnostic(
        `chemistry.studio.preview.${index + 1}`,
        "/process/startNodeId",
        message,
      )));
    }
  } else if (context.includePreview !== false) {
    const technique = direct.value as TechniqueDefinition;
    try {
      const state = createRuntimeState(technique);
      const currentNode = technique.process.nodes.find((node) => node.id === state.currentNodeId);
      if (!currentNode) {
        diagnostics.push(errorDiagnostic(
          "chemistry.studio.preview.current-node-missing",
          "/process/startNodeId",
          "Student preview could not resolve the runtime current step.",
        ));
      } else if (currentNode.actionId && !getActions(technique).some((action) => action.id === currentNode.actionId)) {
        diagnostics.push(errorDiagnostic(
          "chemistry.studio.preview.current-action-missing",
          "/process/startNodeId",
          "Student preview could not resolve the current step action.",
        ));
      }
    } catch (error) {
      diagnostics.push(errorDiagnostic(
        "chemistry.studio.preview.initialization-failed",
        "/process/startNodeId",
        error instanceof Error ? error.message : "Student preview runtime initialization failed.",
      ));
    }
  }

  const exportBlocked = Boolean(
    context.requireExportReady && readiness && readiness.level !== "exportReady",
  );
  const hasErrors = diagnostics.some(({ severity }) => severity === "error");
  if (hasErrors || exportBlocked) {
    return {
      ok: false,
      artifactKind: detected.kind,
      diagnostics,
      ...(readiness ? { readiness } : {}),
      ...(preview ? { preview } : {}),
    };
  }

  const serialized = detected.kind === "LabDefinition"
    ? serializeLab(direct.value as LabDefinition)
    : serializeTechnique(direct.value as TechniqueDefinition);
  const sanitizedArtifact = sanitizeServiceArtifact(JSON.parse(serialized)) as ChemistryArtifact;
  return {
    ok: true,
    artifactKind: detected.kind,
    artifact: sanitizedArtifact,
    diagnostics,
    ...(readiness ? { readiness } : {}),
    ...(preview ? { preview } : {}),
  };
};

const normalizeActionKey = (value: string): string | undefined => {
  const lastSegment = value.split(/[.:/]/).at(-1) ?? value;
  const normalized = lastSegment.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return chemistryActionCapabilitySources.find(
    (action) => action.replace(/[^A-Za-z0-9]/g, "").toLowerCase() === normalized,
  );
};

const blueprintForStep = (step: ProcedureStepIR): StepBlueprint | undefined => {
  const actionKey = step.normalizedOperation?.actionKey;
  if (!actionKey) return undefined;
  const explicit = stepBlueprintByTemplateId.get(actionKey);
  if (explicit) return explicit;
  const action = normalizeActionKey(actionKey);
  return action ? stepBlueprints.find((blueprint) => blueprint.verb === action) : undefined;
};

const runtimeTemplate = (step: ProcedureStepIR): string | undefined => {
  const value = step.normalizedOperation?.parameters.template;
  return typeof value === "string" ? value : undefined;
};

const sourceForRuntimeTemplate = (template: string | undefined) =>
  chemistryModelCapabilitySources.find((source) => source.runtimeTemplate === template);

const supportedAccessibilityRequirements = new Set([
  "keyboard",
  "pointer",
  "screen-reader",
  "accessible-process",
  "text-alternative",
]);

const limitation = (
  stepId: string,
  code: string,
  message: string,
) => ({
  id: `${stepId}-${code}`,
  kind: "missing-capability" as const,
  code,
  message,
  appliesToRef: stepId,
});

const stepAnalysis = (
  step: ProcedureStepIR,
): { claim: ClaimSupportAssessment; coverage: Omit<ChemistryStepCoverage, "classification">; gaps: CompilationGap[] } => {
  const actionKey = step.normalizedOperation?.actionKey;
  const action = actionKey ? normalizeActionKey(actionKey) : undefined;
  const blueprint = blueprintForStep(step);
  const model = blueprint?.verb === "calculate" ? sourceForRuntimeTemplate(runtimeTemplate(step)) : undefined;
  let supportedFidelity: FidelityLevel = blueprint ? (model ? "F3" : "F2") : action ? "F1" : "F0";
  const gaps: CompilationGap[] = [];
  const limitations = [] as ReturnType<typeof limitation>[];
  const missingRequirements: ClaimSupportAssessment["missingRequirements"] = [];

  if (!step.normalizedOperation) {
    missingRequirements.push("operation");
    gaps.push({
      stepId: step.id,
      code: "chemistry.operation.missing",
      category: "missing-data",
      message: "The procedure step has no normalized chemistry operation.",
      required: true,
    });
  } else if (!action) {
    missingRequirements.push("operation");
    gaps.push({
      stepId: step.id,
      code: "chemistry.operation.unsupported",
      category: "unsupported",
      message: `Chemistry does not register operation ${actionKey}.`,
      required: true,
    });
  } else if (!blueprint) {
    limitations.push(limitation(
      step.id,
      "chemistry.operation.representable-only",
      `Action ${action} is registered for representation but has no deterministic Studio composition blueprint.`,
    ));
    gaps.push({
      stepId: step.id,
      code: "chemistry.operation.representable-only",
      category: "unsupported",
      message: `Action ${action} is representable but cannot be composed from a current Studio step blueprint.`,
      required: true,
    });
  }

  const openAmbiguity = step.ambiguity.find(({ resolutionStatus }) => resolutionStatus !== "resolved");
  const blockingFlag = step.reviewFlags.find(({ severity }) => severity === "blocking");
  const unknownUnit = Object.values(step.normalizedOperation?.parameters ?? {}).find(
    (value) => typeof value === "object" && value !== null && "unit" in value && value.unit.kind === "unknown",
  );
  if (openAmbiguity || blockingFlag || unknownUnit) {
    if (!missingRequirements.includes("operation")) missingRequirements.push("operation");
    const message = openAmbiguity?.message ?? blockingFlag?.message ?? "Resolve unknown units before chemistry composition.";
    gaps.push({
      stepId: step.id,
      code: "chemistry.step.review-required",
      category: openAmbiguity ? "ambiguous" : "missing-data",
      message,
      required: true,
    });
  }

  const unsupportedAccessibility = step.accessibilityRequirements.find(
    (requirement) => !supportedAccessibilityRequirements.has(requirement),
  );
  if (unsupportedAccessibility) {
    if (!missingRequirements.includes("accessible-path")) missingRequirements.push("accessible-path");
    gaps.push({
      stepId: step.id,
      code: "chemistry.accessibility.unsupported",
      category: "unsupported",
      message: `No declared chemistry accessible path satisfies ${unsupportedAccessibility}.`,
      required: true,
    });
  }

  if (
    blueprint &&
    (step.requestedFidelity === "F3" || step.requestedFidelity === "F4") &&
    !model
  ) {
    supportedFidelity = "F2";
    limitations.push(limitation(
      step.id,
      "chemistry.model.required",
      "The requested quantitative fidelity requires a registered chemistry runtime model template.",
    ));
    gaps.push({
      stepId: step.id,
      code: "chemistry.model.required",
      category: "missing-data",
      message: "A registered deterministic chemistry model template is required for F3/F4 composition.",
      required: true,
    });
  }
  if (step.requestedFidelity === "F4") {
    limitations.push(limitation(
      step.id,
      "chemistry.fidelity.f4-calibration-unavailable",
      "No current chemistry capability has named calibration/reference evidence for an F4 claim.",
    ));
    gaps.push({
      stepId: step.id,
      code: "chemistry.fidelity.f4-calibration-unavailable",
      category: "unsupported",
      message: "The current chemistry pack cannot compose an F4 calibrated claim.",
      required: true,
    });
  }

  return {
    claim: {
      claimId: step.id,
      outcome: step.title,
      essential: true,
      quantitative: step.requestedFidelity === "F3" || step.requestedFidelity === "F4",
      requestedFidelity: step.requestedFidelity,
      supportedFidelity,
      missingRequirements,
      limitations,
    },
    coverage: {
      stepId: step.id,
      ...(actionKey ? { actionKey } : {}),
      supportedFidelity,
      ...(action ? { capabilityRef: `chemistry:operation:action.${action}@1.0.0` } : {}),
      ...(blueprint ? { blueprintId: blueprint.id } : {}),
    },
    gaps,
  };
};

const normalizedConstraintOperation = (value: string): string => normalizeActionKey(value) ?? value;

const assessChemistryProcedure = (
  procedure: ProcedureIR,
  constraints: ProcedureConstraints,
): ChemistryCoverageReport => {
  const schemaResult = validateProcedureIR(procedure);
  if (!schemaResult.ok) {
    return {
      procedureId: typeof procedure?.id === "string" ? procedure.id : "unknown-procedure",
      domainPackId: "chemistry",
      domainPackVersion: chemistryDomainPackVersion,
      classification: "unsupported",
      steps: [],
      gaps: schemaResult.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        category: diagnostic.code.includes("version") ? "version-mismatch" : "missing-data",
        message: `${diagnostic.path}: ${diagnostic.message}`,
        required: true,
      })),
    };
  }

  const validated = schemaResult.value;
  const analyses = validated.steps.map(stepAnalysis);
  const assessment = classifyAggregateSupport(analyses.map(({ claim }) => claim));
  const classificationByStep = new Map(
    assessment.claims.map((claim) => [claim.claimId, claim.classification]),
  );
  const gaps = analyses.flatMap(({ gaps: stepGaps }) => stepGaps);

  if (validated.domainHint && validated.domainHint !== "chemistry") {
    gaps.push({
      code: "chemistry.domain-hint.mismatch",
      category: "unsupported",
      message: `Procedure domainHint ${validated.domainHint} does not select the chemistry pack.`,
      required: true,
    });
  }
  if (validated.controlFlow.allowParallel || validated.steps.some((step) => step.branch || step.repeat)) {
    gaps.push({
      code: "chemistry.control-flow.not-composable",
      category: "unsupported",
      message: "Current chemistry step blueprints compose ordered linear procedures only.",
      required: true,
    });
  }
  validated.resources.forEach((resource) => {
    resource.reviewFlags.filter(({ severity }) => severity === "blocking").forEach((flag) => {
      gaps.push({
        code: "chemistry.resource.review-required",
        category: "missing-data",
        message: flag.message,
        required: true,
      });
    });
    if (resource.kind === "unknown") {
      gaps.push({
        code: "chemistry.resource.unknown",
        category: "missing-data",
        message: `Resource ${resource.id} must be resolved before chemistry composition.`,
        required: true,
      });
    } else if (
      (resource.kind === "equipment" || resource.kind === "instrument") &&
      resource.knownResourceRef &&
      !equipmentById.has(resource.knownResourceRef)
    ) {
      gaps.push({
        code: "chemistry.resource.unsupported",
        category: "unsupported",
        message: `Resource ${resource.knownResourceRef} is not in the authoritative chemistry equipment catalog.`,
        required: true,
      });
    }
  });
  validated.reviewFlags.filter(({ severity }) => severity === "blocking").forEach((flag) => {
    gaps.push({
      code: "chemistry.procedure.review-required",
      category: "missing-data",
      message: flag.message,
      required: true,
    });
  });
  if (constraints.maximumSteps !== undefined && validated.steps.length > constraints.maximumSteps) {
    gaps.push({
      code: "chemistry.constraints.maximum-steps",
      category: "unsupported",
      message: `Procedure has ${validated.steps.length} steps; maximumSteps is ${constraints.maximumSteps}.`,
      required: true,
    });
  }

  const presentOperations = new Set(validated.steps.flatMap((step) => {
    const key = step.normalizedOperation?.actionKey;
    return key ? [normalizedConstraintOperation(key)] : [];
  }));
  constraints.requiredOperationRefs.forEach((required) => {
    if (!presentOperations.has(normalizedConstraintOperation(required))) {
      gaps.push({
        code: "chemistry.constraints.required-operation-missing",
        category: "missing-data",
        message: `Required operation ${required} is absent from the procedure.`,
        required: true,
      });
    }
  });
  if (constraints.allowedOperationRefs) {
    const allowed = new Set(constraints.allowedOperationRefs.map(normalizedConstraintOperation));
    presentOperations.forEach((operation) => {
      if (!allowed.has(operation)) gaps.push({
        code: "chemistry.constraints.operation-not-allowed",
        category: "unsupported",
        message: `Operation ${operation} is outside allowedOperationRefs.`,
        required: true,
      });
    });
  }

  const representableGapCodes = new Set([
    "chemistry.operation.representable-only",
    "chemistry.model.required",
    "chemistry.fidelity.f4-calibration-unavailable",
  ]);
  const gapForcesUnsupported = gaps.some(
    (gap) => gap.required && !representableGapCodes.has(gap.code),
  );
  const classification: SupportClassification = gapForcesUnsupported
    ? "unsupported"
    : gaps.length > 0 && assessment.classification === "runnable"
      ? "representable"
      : assessment.classification;
  return {
    procedureId: validated.id,
    domainPackId: "chemistry",
    domainPackVersion: chemistryDomainPackVersion,
    classification,
    steps: analyses.map(({ coverage }) => ({
      ...coverage,
      classification: classificationByStep.get(coverage.stepId) ?? "unsupported",
    })),
    gaps,
  };
};

const parameterValue = (value: ScalarOrQuantity): ActionParameterValue => {
  if (typeof value === "string" || typeof value === "boolean") return value;
  const numeric = Number(value.value);
  return Number.isFinite(numeric) ? numeric : value.value;
};

const operationValues = (step: ProcedureStepIR): Record<string, ActionParameterValue> =>
  Object.fromEntries(
    Object.entries(step.normalizedOperation?.parameters ?? {}).map(([key, value]) => [
      key,
      parameterValue(value),
    ]),
  );

const knownResourceEquipment = (procedure: ProcedureIR): string[] => procedure.resources.flatMap((resource) =>
  resource.kind !== "unknown" &&
  (resource.kind === "equipment" || resource.kind === "instrument") &&
  resource.knownResourceRef &&
  equipmentById.has(resource.knownResourceRef)
    ? [resource.knownResourceRef]
    : []);

const composeChemistryArtifact = (
  request: ComposeArtifactRequest,
) => {
  const coverage = assessChemistryProcedure(request.procedure, request.constraints);
  if (coverage.classification !== "runnable" || coverage.gaps.some(({ required }) => required)) {
    return { ok: false as const, gaps: coverage.gaps };
  }

  const base = createDraftFromDemo();
  let draft: LabDefinition = {
    ...base,
    id: request.procedure.id,
    title: request.procedure.title,
    description: request.procedure.purpose,
    audience: request.procedure.audience ?? "Chemistry learners",
    learningGoals: request.procedure.learningObjectives.length
      ? [...request.procedure.learningObjectives]
      : [request.procedure.purpose],
    safetyNotes: [],
    equipment: knownResourceEquipment(request.procedure),
    initialState: { equipment: [] },
    titrationModels: undefined,
    chromatographyModels: undefined,
    kineticsModels: undefined,
    techniques: [],
    actions: [],
    process: { startNodeId: "", nodes: [], edges: [] },
    assessments: [],
    metadata: {
      version: "1.0",
      author: "ChemistryDomainPack",
      updatedAt: request.procedure.metadata.createdAt,
      tags: ["chemistry", "studio-core-composed"],
    },
  };
  const revision = `chemistry-compose:${request.procedure.id}:1.0`;

  for (const step of request.procedure.steps) {
    const blueprint = blueprintForStep(step);
    if (!blueprint) {
      return { ok: false as const, gaps: [{
        stepId: step.id,
        code: "chemistry.compose.blueprint-missing",
        category: "unsupported" as const,
        message: `No current Studio step blueprint can compose ${step.normalizedOperation?.actionKey ?? step.id}.`,
        required: true,
      }] };
    }
    const index = draft.process.nodes.length + 1;
    const defaultAction = createActionFromTemplate(blueprint.template, index);
    const values = { ...defaultAction.parameters, ...operationValues(step) };
    const equipmentIds = new Set([
      ...draft.equipment,
      ...blueprint.template.requiredEquipment,
      ...knownResourceEquipment(request.procedure),
    ]);
    const input = {
      idempotencyKey: `chemistry-compose:${request.procedure.id}:${step.id}`,
      values,
    };
    const blueprintDiagnostics = blueprint.validate(input, { revision, equipmentIds });
    if (blueprintDiagnostics.some(({ severity }) => severity === "fail")) {
      return { ok: false as const, gaps: blueprintDiagnostics.map((diagnostic) => ({
        stepId: step.id,
        code: `chemistry.compose.blueprint.${diagnostic.id}`,
        category: "missing-data" as const,
        message: diagnostic.message,
        required: true,
      })) };
    }

    const previousNodeIds = new Set(draft.process.nodes.map(({ id }) => id));
    const previousActionIds = new Set(draft.actions.map(({ id }) => id));
    const insertion = planStudioTransaction(draft, revision, blueprint.build(input, { revision, equipmentIds }));
    if (!insertion.ok) {
      return { ok: false as const, gaps: [{
        stepId: step.id,
        code: "chemistry.compose.transaction-failed",
        category: "unsupported" as const,
        message: insertion.error ?? "The Studio blueprint transaction failed.",
        required: true,
      }] };
    }
    draft = insertion.draft;
    const node = draft.process.nodes.find(({ id }) => !previousNodeIds.has(id));
    const action = draft.actions.find(({ id }) => !previousActionIds.has(id));
    if (!node || !action) {
      return { ok: false as const, gaps: [{
        stepId: step.id,
        code: "chemistry.compose.blueprint-output-missing",
        category: "unsupported" as const,
        message: "The Studio blueprint did not add exactly one resolvable step and action.",
        required: true,
      }] };
    }

    const updatedInteraction = action.interaction ? {
      ...action.interaction,
      ...(typeof values.sourceDefinitionId === "string"
        ? { sourceDefinitionId: values.sourceDefinitionId }
        : {}),
      ...(typeof values.targetDefinitionId === "string"
        ? { targetDefinitionId: values.targetDefinitionId }
        : {}),
      ...(typeof values.snapZoneId === "string" ? { snapZoneId: values.snapZoneId } : {}),
    } : undefined;
    const updatedAction: ActionDefinition = {
      ...action,
      label: step.title,
      parameters: { ...action.parameters, ...values },
      ...(updatedInteraction ? { interaction: updatedInteraction } : {}),
    };
    const refinement = planStudioTransaction(draft, revision, {
      baseRevision: revision,
      idempotencyKey: `chemistry-compose:${request.procedure.id}:${step.id}:refine`,
      label: `Apply ProcedureIR step ${step.id}`,
      operations: [
        { type: "updateProcessNode", node: { ...node, title: step.title, description: step.instruction } },
        { type: "updateAction", action: updatedAction },
      ],
    });
    if (!refinement.ok) {
      return { ok: false as const, gaps: [{
        stepId: step.id,
        code: "chemistry.compose.refinement-failed",
        category: "unsupported" as const,
        message: refinement.error ?? "The ProcedureIR step could not be applied to the Studio blueprint.",
        required: true,
      }] };
    }
    draft = refinement.draft;
  }

  const validation = validateChemistryArtifact(draft, {
    includeReadiness: true,
    includePreview: true,
  });
  if (!validation.ok) {
    return { ok: false as const, gaps: validation.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      category: "unsupported" as const,
      message: diagnostic.message,
      required: diagnostic.severity === "error",
    })) };
  }
  return { ok: true as const, artifact: validation.artifact as LabDefinition, gaps: [] as [] };
};

const goldenArtifacts = [...bundledLabs, ...standaloneTechniques] as ChemistryArtifact[];
const goldenArtifactsById = new Map(goldenArtifacts.map((artifact) => [artifact.id, artifact]));

export const chemistryDomainPack = {
  descriptor,
  schemas: chemistrySchemas,
  getCapabilityManifestFragment: getChemistryCapabilityManifestFragment,
  getEvidenceRegistryFragment: getChemistryEvidenceRegistryFragment,
  assessProcedure: assessChemistryProcedure,
  composeArtifact: composeChemistryArtifact,
  validateArtifact: validateChemistryArtifact,
  planRun: (artifact: ChemistryArtifact, context: RunContext) => {
    return {
      schema: "studio.run-plan",
      schemaVersion: "1.0",
      domainPackId: "chemistry",
      extension: planChemistryClassRun(artifact, context.extension, context.requestId),
    };
  },
  packageArtifact: (artifact: ChemistryArtifact, context: ArtifactPackageContext): ChemistryArtifactPackage => {
    if (!context.packageId.trim()) throw new Error("packageId must be a non-empty string.");
    if (!Number.isFinite(Date.parse(context.createdAt))) throw new Error("createdAt must be an ISO-8601 timestamp.");
    const validation = validateChemistryArtifact(artifact, {
      includeReadiness: false,
      includePreview: false,
    });
    if (!validation.ok) {
      throw new Error(validation.diagnostics.map(({ code, message }) => `${code}: ${message}`).join("\n"));
    }
    const publicJson = validatePublicJsonForPublishing(validation.artifact);
    if (!publicJson.ok) throw new Error(publicJson.errors.join("\n"));
    const title = validation.artifact.title;
    const version = validation.artifact.metadata.version;
    return createStudioArtifactPackage({
      packageId: context.packageId,
      createdAt: context.createdAt,
      domainPack: { id: "chemistry", version: chemistryDomainPackVersion },
      capabilityManifestVersion: context.capabilityManifestVersion ?? "2.0",
      artifactKind: validation.artifactKind,
      artifactTitle: title,
      artifactVersion: version,
      artifactFileName: `${validation.artifact.id}.${validation.artifactKind === "LabDefinition" ? "lab" : "technique"}.json`,
      artifact: structuredClone(validation.artifact),
      validation: {
        ok: true,
        diagnostics: validation.diagnostics,
      },
      ...(context.runPlan ? { runPlan: context.runPlan } : {}),
      assumptions: [],
      limitations: descriptor.limitations,
    });
  },
  conformance: {
    goldenArtifactIds: [...goldenArtifactsById.keys()].sort(),
    getGoldenArtifact: (id) => {
      const artifact = goldenArtifactsById.get(id);
      return artifact ? structuredClone(artifact) : undefined;
    },
  },
} satisfies StudioDomainPack<
  ChemistryArtifact,
  ChemistryValidationContext,
  ChemistryRunPlan
>;

export const validateChemistryArtifactThroughPack = validateChemistryArtifact;
