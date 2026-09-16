import { createStudioArtifactPackage } from "../../platform/artifacts/builder";
import type { StudioArtifactPackage } from "../../platform/artifacts/types";
import type { SupportClassification } from "../../platform/fidelity/types";
import type {
  ArtifactPackageContext,
  ArtifactValidationDiagnostic,
  CompilationGap,
  ComposeArtifactRequest,
  CoverageReportContract,
  DomainPackDescriptor,
  ProcedureConstraints,
  RunContext,
  StudioDomainPack,
} from "../../platform/domain-packs/types";
import type { ProcedureIR } from "../../platform/procedure-ir/types";
import { validateProcedureIR } from "../../platform/procedure-ir/validation";
import { getAssayLayoutGoldenArtifact } from "./__fixtures__/assay-layout.v1";
import { getAssayCapabilityManifestFragment } from "./capabilityFragment";
import { getAssayEvidenceRegistryFragment } from "./evidenceRegistry";
import {
  assayLensObservationPackageSchema,
  assayLensObservationRequestSchema,
  assayObservationImportSchema,
} from "./ingestion";
import {
  createCycle09PlanningArtifact,
} from "./planning/__fixtures__/cycle09PlanningFixture";
import {
  assayPlanningProfileSchema,
  planAssayRun,
  type AssayRunPlanResult,
} from "./planning";
import { createCycle08QcAssayFixture } from "./qc/__fixtures__/cycle08QcFixture";
import {
  assayProtocolAnalysisSchema,
  assayProtocolProfileSchema,
} from "./profiles";
import {
  createCycle11MicAssay,
  createCycle11XttAssay,
} from "./profiles/__fixtures__/cycle11ProtocolFixtures";
import { assayDefinitionSchema } from "./types/schema";
import {
  assayOperationTypes,
  type AssayDefinition,
  type AssayOperationType,
} from "./types/types";
import { validateAssayDefinition } from "./types/validation";

export const assayDomainPackVersion = "1.0.0";

export interface AssayValidationContext {
  require96Well?: boolean;
}

export interface AssayStepCoverage {
  stepId: string;
  operationType?: string;
  supportedFidelity: "F0" | "F1";
  classification: SupportClassification;
}

export interface AssayCoverageReport extends CoverageReportContract {
  classification: SupportClassification;
  steps: AssayStepCoverage[];
}

export type AssayArtifactPackage = StudioArtifactPackage<AssayDefinition>;

const descriptor: DomainPackDescriptor = {
  id: "assay",
  version: assayDomainPackVersion,
  title: "Assay Studio",
  artifactKinds: ["AssayDefinition"],
  supportedProcedureIRVersions: ["1.0"],
  minimumStudioCoreVersion: "1.0.0",
  publicNamespaces: ["assaystudio"],
  limitations: [
    "Cycle 12 supports schema-valid 96-well authoring, exact-decimal nominal pipetting and dilution, explicit controls/replicates, profile-configurable QC, semantic assay evidence, operational planning, reviewed external observation ingestion, checked XTT/broth-microdilution profiles, release review, and six stateless assaystudio MCP tools.",
    "Select-pipette, set-volume, tip, aspirate, dispense, mix, explicit discard, and recovery transitions execute through the assay runtime; ProcedureIR-to-runtime compilation remains unavailable.",
    "QC thresholds must come from explicit versioned rule data; missing prerequisites return indeterminate and outliers are never automatically deleted.",
    "Assay planning requires an explicit versioned profile, accepted operation graph, run context, inventory, capacity, and user-declared assumptions; no amount or schedule is inferred when metadata is absent.",
    "Long/matrix CSV and file-based Assay Lens ingestion require explicit mapping and review; remote bridge transport remains unavailable.",
    "XTT results are protocol-dependent metabolic-activity proxies; broth-microdilution endpoints are profile-bound and non-clinical.",
    "Assay MCP tools are stateless, tools-only, and use the same pure release services as the direct app; they store no student, assignment, draft, provider, or attachment state.",
    "The Assay Studio decision is a limited release candidate because detailed tests, browser checks, and formative review were intentionally not executed under repository policy.",
    "No stochastic pipette error, quantitative carryover, clinical interpretation, hardware control, safety certification, purchasing, or assay F4 outcome is claimed.",
  ],
};

const operationTypeFromRef = (operationRef: string): AssayOperationType | undefined => {
  const terminal = operationRef.split(/[.:/]/).at(-1) ?? operationRef;
  return assayOperationTypes.find((operation) => operation.toLowerCase() === terminal.toLowerCase());
};

const assessAssayProcedure = (
  procedure: ProcedureIR,
  constraints: ProcedureConstraints,
): AssayCoverageReport => {
  const schemaResult = validateProcedureIR(procedure);
  if (!schemaResult.ok) {
    return {
      procedureId: typeof procedure?.id === "string" ? procedure.id : "unknown-procedure",
      domainPackId: "assay",
      domainPackVersion: assayDomainPackVersion,
      classification: "unsupported",
      steps: [],
      gaps: schemaResult.diagnostics.map((entry) => ({
        code: entry.code,
        category: entry.code.includes("version") ? "version-mismatch" : "missing-data",
        message: `${entry.path}: ${entry.message}`,
        required: true,
      })),
    };
  }

  const validated = schemaResult.value;
  const gaps: CompilationGap[] = [];
  let unsupported = validated.domainHint !== undefined && validated.domainHint !== "assay";
  if (unsupported) gaps.push({
    code: "assay.domain-hint.mismatch",
    category: "unsupported",
    message: `Procedure domainHint ${validated.domainHint} does not select the assay pack.`,
    required: true,
  });
  if (constraints.maximumSteps !== undefined && validated.steps.length > constraints.maximumSteps) {
    unsupported = true;
    gaps.push({
      code: "assay.constraints.maximum-steps",
      category: "unsupported",
      message: `Procedure has ${validated.steps.length} steps; maximumSteps is ${constraints.maximumSteps}.`,
      required: true,
    });
  }

  const presentOperations = new Set<string>();
  const steps = validated.steps.map((step): AssayStepCoverage => {
    const actionKey = step.normalizedOperation?.actionKey;
    const operationType = actionKey ? operationTypeFromRef(actionKey) : undefined;
    if (operationType) presentOperations.add(operationType);
    if (actionKey && !operationType) {
      unsupported = true;
      gaps.push({
        stepId: step.id,
        code: "assay.operation.unsupported",
        category: "unsupported",
        message: `Assay Studio does not register operation ${actionKey}.`,
        required: true,
      });
    } else {
      gaps.push({
        stepId: step.id,
        code: operationType ? "assay.operation.representational-only" : "assay.operation.instructional-only",
        category: "unsupported",
        message: operationType
          ? `Operation ${operationType} is schema-representable, but ProcedureIR-to-assay-runtime compilation is not part of the Cycle 12 release contract.`
          : "The step can be retained as reviewed instruction but has no normalized assay operation.",
        required: true,
      });
    }
    return {
      stepId: step.id,
      ...(operationType ? { operationType } : {}),
      supportedFidelity: operationType ? "F1" : "F0",
      classification: actionKey && !operationType ? "unsupported" : "representable",
    };
  });

  constraints.requiredOperationRefs.forEach((required) => {
    const normalized = operationTypeFromRef(required);
    if (!normalized || !presentOperations.has(normalized)) {
      unsupported = true;
      gaps.push({
        code: "assay.constraints.required-operation-missing",
        category: "missing-data",
        message: `Required operation ${required} is absent from the procedure.`,
        required: true,
      });
    }
  });
  if (constraints.allowedOperationRefs) {
    const allowed = new Set(constraints.allowedOperationRefs.map(operationTypeFromRef).filter(Boolean));
    presentOperations.forEach((operation) => {
      if (!allowed.has(operation as AssayOperationType)) {
        unsupported = true;
        gaps.push({
          code: "assay.constraints.operation-not-allowed",
          category: "unsupported",
          message: `Operation ${operation} is outside allowedOperationRefs.`,
          required: true,
        });
      }
    });
  }
  validated.reviewFlags.filter(({ severity }) => severity === "blocking").forEach((flag) => {
    unsupported = true;
    gaps.push({
      code: "assay.procedure.review-required",
      category: "missing-data",
      message: flag.message,
      required: true,
    });
  });

  return {
    procedureId: validated.id,
    domainPackId: "assay",
    domainPackVersion: assayDomainPackVersion,
    classification: unsupported ? "unsupported" : "representable",
    steps,
    gaps,
  };
};

const composeAssayArtifact = (
  request: ComposeArtifactRequest,
) => {
  const coverage = assessAssayProcedure(request.procedure, request.constraints);
  return {
    ok: false as const,
    gaps: [
      ...coverage.gaps,
      {
        code: "assay.compose.procedure-ir-unsupported",
        category: "unsupported" as const,
        message: "Cycle 12 does not compile arbitrary ProcedureIR into assay runtime operations; use the bounded source-controlled release templates or author a validated plate/control layout and call the separate typed pipetting, dilution, QC, operational-planning, and reviewed-ingestion services.",
        required: true,
      },
    ],
  };
};

const validateAssayArtifact = (
  artifact: unknown,
  context: AssayValidationContext = {},
) => {
  const validation = validateAssayDefinition(artifact);
  if (!validation.ok) return validation;
  const diagnostics: ArtifactValidationDiagnostic[] = [...validation.diagnostics];
  if (context.require96Well && validation.value.plate.format !== 96) diagnostics.push({
    code: "assay.plate.format.unsupported",
    path: "/plate/format",
    message: "The first-release assay pack requires a 96-well plate.",
    severity: "error",
  });
  return diagnostics.some(({ severity }) => severity === "error")
    ? { ok: false as const, diagnostics }
    : { ok: true as const, artifact: structuredClone(validation.value), diagnostics };
};

const goldenArtifact = getAssayLayoutGoldenArtifact();
const qcGoldenArtifact = createCycle08QcAssayFixture();
const planningGoldenArtifact = createCycle09PlanningArtifact();
const xttGoldenArtifact = createCycle11XttAssay();
const micGoldenArtifact = createCycle11MicAssay();

export const assayDomainPack = {
  descriptor,
  schemas: {
    artifact: assayDefinitionSchema,
    validationContext: {
      type: "object",
      additionalProperties: false,
      properties: { require96Well: { type: "boolean" } },
    },
    package: { schema: "studio.artifact-package", schemaVersion: "1.0" },
    planningProfile: assayPlanningProfileSchema,
    observationImport: assayObservationImportSchema,
    assayLensRequest: assayLensObservationRequestSchema,
    assayLensObservation: assayLensObservationPackageSchema,
    protocolProfile: assayProtocolProfileSchema,
    protocolAnalysis: assayProtocolAnalysisSchema,
  },
  getCapabilityManifestFragment: getAssayCapabilityManifestFragment,
  getEvidenceRegistryFragment: getAssayEvidenceRegistryFragment,
  assessProcedure: assessAssayProcedure,
  composeArtifact: composeAssayArtifact,
  validateArtifact: validateAssayArtifact,
  planRun: (artifact: AssayDefinition, context: RunContext) => {
    const result = planAssayRun(artifact, context.extension, context.requestId);
    return {
      schema: "studio.run-plan" as const,
      schemaVersion: "1.0",
      domainPackId: "assay" as const,
      extension: result,
    };
  },
  packageArtifact: (artifact: AssayDefinition, context: ArtifactPackageContext): AssayArtifactPackage => {
    const validation = validateAssayArtifact(artifact, { require96Well: true });
    if (!validation.ok) {
      throw new Error(validation.diagnostics.map(({ code, message }) => `${code}: ${message}`).join("\n"));
    }
    return createStudioArtifactPackage({
      packageId: context.packageId,
      createdAt: context.createdAt,
      domainPack: { id: "assay", version: assayDomainPackVersion },
      capabilityManifestVersion: context.capabilityManifestVersion ?? "2.0",
      artifactKind: "AssayDefinition",
      artifactTitle: validation.artifact.title,
      artifactVersion: validation.artifact.metadata.version,
      artifactFileName: `${validation.artifact.id}.assay.json`,
      artifact: validation.artifact,
      validation: { ok: true, diagnostics: validation.diagnostics },
      ...(context.runPlan ? { runPlan: context.runPlan } : {}),
      assumptions: [],
      limitations: descriptor.limitations,
    });
  },
  conformance: {
    goldenArtifactIds: [
      goldenArtifact.id,
      qcGoldenArtifact.id,
      planningGoldenArtifact.id,
      xttGoldenArtifact.id,
      micGoldenArtifact.id,
    ],
    getGoldenArtifact: (id: string) => id === goldenArtifact.id
      ? structuredClone(goldenArtifact)
      : id === qcGoldenArtifact.id
        ? structuredClone(qcGoldenArtifact)
        : id === planningGoldenArtifact.id
          ? structuredClone(planningGoldenArtifact)
          : id === xttGoldenArtifact.id
            ? structuredClone(xttGoldenArtifact)
            : id === micGoldenArtifact.id
              ? structuredClone(micGoldenArtifact)
        : undefined,
  },
} satisfies StudioDomainPack<
  AssayDefinition,
  AssayValidationContext,
  AssayRunPlanResult
>;

export const validateAssayArtifactThroughPack = validateAssayArtifact;
export const assessProcedureThroughAssayPack = assessAssayProcedure;
