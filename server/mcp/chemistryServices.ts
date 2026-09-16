import type { ChemistryArtifact } from "../../src/domain-packs/chemistry/artifactKind";
import {
  chemistryDomainPack,
  chemistryDomainPackVersion,
  type ChemistryValidationContext,
} from "../../src/domain-packs/chemistry/chemistryPack";
import type { ProcedureConstraints } from "../../src/platform/domain-packs/types";
import type { FidelityLevel } from "../../src/platform/fidelity/types";
import type { ProcedureIR } from "../../src/platform/procedure-ir/types";
import type { ResourceRunContext } from "../../src/platform/planning/types";
import { baseRequestProperties, nonEmptyStringSchema, resourceRunContextSchema, resultEnvelopeSchemaFor } from "./schemas";
import type { DomainServiceOutcome, DomainToolContract } from "./types";

const fidelityOrder: FidelityLevel[] = ["F0", "F1", "F2", "F3", "F4"];
const capabilityKey = (entry: ReturnType<typeof chemistryDomainPack.getCapabilityManifestFragment>["entries"][number]): string =>
  `${entry.ref.domainPackId}:${entry.ref.kind}:${entry.ref.id}@${entry.ref.version}`;

const maximumFidelity = (claims: Array<{ maximumFidelity: FidelityLevel }>): FidelityLevel =>
  claims.reduce((best, claim) => fidelityOrder.indexOf(claim.maximumFidelity) > fidelityOrder.indexOf(best)
    ? claim.maximumFidelity
    : best, "F0" as FidelityLevel);

const diagnosticsFromGaps = (gaps: Array<{ code: string; message: string; required: boolean; stepId?: string }>) =>
  gaps.map((gap) => ({
    code: gap.code,
    path: gap.stepId ? `/procedure/steps/${gap.stepId}` : "/procedure",
    message: gap.message,
    severity: gap.required ? "error" as const : "warning" as const,
  }));

export interface SearchCapabilitiesInput {
  requestId: string;
  idempotencyKey?: string;
  query?: string;
  kinds?: string[];
  minimumFidelity?: FidelityLevel;
  limit?: number;
}

export interface AssessProcedureInput {
  requestId: string;
  idempotencyKey?: string;
  procedure: ProcedureIR;
  constraints: ProcedureConstraints;
}

export interface ComposeDraftInput extends AssessProcedureInput {
  package: { packageId: string; createdAt: string };
}

export interface ValidateArtifactInput {
  requestId: string;
  idempotencyKey?: string;
  artifact: unknown;
  context?: ChemistryValidationContext;
}

export interface PlanClassRunInput {
  requestId: string;
  idempotencyKey?: string;
  artifact: unknown;
  context: ResourceRunContext;
}

export const chemistryDomainServices = {
  searchCapabilities: (input: SearchCapabilitiesInput): DomainServiceOutcome => {
    const fragment = chemistryDomainPack.getCapabilityManifestFragment();
    const query = input.query?.trim().toLowerCase();
    const kinds = new Set(input.kinds ?? []);
    const minimum = input.minimumFidelity ? fidelityOrder.indexOf(input.minimumFidelity) : 0;
    const entries = fragment.entries
      .filter((entry) => kinds.size === 0 || kinds.has(entry.ref.kind))
      .filter((entry) => fidelityOrder.indexOf(maximumFidelity(entry.claims)) >= minimum)
      .filter((entry) => !query || [
        entry.ref.id,
        entry.title,
        entry.summary,
        ...entry.tags,
      ].some((value) => value.toLowerCase().includes(query)))
      .sort((left, right) => capabilityKey(left).localeCompare(capabilityKey(right)))
      .slice(0, input.limit ?? 25)
      .map((entry) => ({
        ref: entry.ref,
        title: entry.title,
        summary: entry.summary,
        maximumFidelity: maximumFidelity(entry.claims),
        accessiblePathIds: entry.accessiblePathIds,
        limitations: entry.limitations,
      }));
    return {
      status: "ok",
      summary: `Found ${entries.length} chemistry capabilities.`,
      data: { entries, totalMatched: entries.length },
      limitations: fragment.domainPack.limitations,
    };
  },

  assessProcedure: (input: AssessProcedureInput): DomainServiceOutcome => {
    const coverage = chemistryDomainPack.assessProcedure(input.procedure, input.constraints);
    return {
      status: coverage.classification === "runnable" ? "ok" : "incomplete",
      summary: `Procedure coverage is ${coverage.classification}.`,
      data: { coverage },
      diagnostics: diagnosticsFromGaps(coverage.gaps),
      limitations: chemistryDomainPack.descriptor.limitations,
    };
  },

  composeDraft: (input: ComposeDraftInput): DomainServiceOutcome => {
    const composition = chemistryDomainPack.composeArtifact({
      procedure: input.procedure,
      constraints: input.constraints,
    });
    if (!composition.ok) return {
      status: "incomplete",
      summary: "The procedure could not be composed without unsupported or missing semantics.",
      data: { composition },
      diagnostics: diagnosticsFromGaps(composition.gaps),
      limitations: chemistryDomainPack.descriptor.limitations,
    };
    const artifactPackage = chemistryDomainPack.packageArtifact(composition.artifact, {
      packageId: input.package.packageId,
      createdAt: input.package.createdAt,
      capabilityManifestVersion: "2.0",
    });
    return {
      status: "ok",
      summary: `Composed and packaged chemistry draft ${composition.artifact.id}.`,
      data: { composition, artifactPackage },
      limitations: chemistryDomainPack.descriptor.limitations,
    };
  },

  validateArtifact: (input: ValidateArtifactInput): DomainServiceOutcome => {
    const validation = chemistryDomainPack.validateArtifact(input.artifact, input.context ?? {});
    return {
      status: validation.ok ? "ok" : "incomplete",
      summary: validation.ok ? "Chemistry artifact validation passed." : "Chemistry artifact validation failed.",
      data: { validation },
      diagnostics: validation.diagnostics,
      limitations: chemistryDomainPack.descriptor.limitations,
    };
  },

  planClassRun: (input: PlanClassRunInput): DomainServiceOutcome => {
    const validation = chemistryDomainPack.validateArtifact(input.artifact, {});
    if (!validation.ok) return {
      status: "incomplete",
      summary: "Class-run planning requires a valid chemistry artifact.",
      data: { validation },
      diagnostics: validation.diagnostics,
      limitations: chemistryDomainPack.descriptor.limitations,
    };
    const runPlan = chemistryDomainPack.planRun(validation.artifact, {
      requestId: input.requestId,
      extension: { ...input.context, requestId: input.requestId },
    });
    const plan = runPlan.extension;
    return {
      status: plan?.status === "complete" ? "ok" : "incomplete",
      summary: plan?.status === "complete"
        ? `Planned class run for ${validation.artifact.id}.`
        : `Class-run plan for ${validation.artifact.id} is incomplete and includes explicit metadata diagnostics.`,
      data: { validation, runPlan },
      diagnostics: plan?.plan.diagnostics ?? [],
      assumptions: plan?.plan.assumptions ?? [],
      limitations: plan?.plan.limitations ?? chemistryDomainPack.descriptor.limitations,
    };
  },
};

const constraintsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["requiredOperationRefs"],
  properties: {
    requiredOperationRefs: { type: "array", items: nonEmptyStringSchema, maxItems: 1000 },
    allowedOperationRefs: { type: "array", items: nonEmptyStringSchema, maxItems: 1000 },
    maximumSteps: { type: "integer", minimum: 1, maximum: 1000 },
  },
} as const;

const packageContextSchema = {
  type: "object",
  additionalProperties: false,
  required: ["packageId", "createdAt"],
  properties: { packageId: nonEmptyStringSchema, createdAt: nonEmptyStringSchema },
} as const;

const inputSchema = (
  required: string[],
  properties: Record<string, unknown>,
  definitions?: Record<string, unknown>,
): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required: ["requestId", ...required],
  properties: { ...baseRequestProperties, ...properties },
  ...(definitions ? { definitions } : {}),
});

export const chemistryToolContracts: readonly DomainToolContract[] = [
  {
    suffix: "search_capabilities",
    title: "Search Lab Studio chemistry capabilities",
    description: "Search proof-backed chemistry objects, operations, interactions, and deterministic models. Returns only registered capabilities and their honest fidelity ceilings.",
    inputSchema: inputSchema([], {
      query: { type: "string", maxLength: 500 },
      kinds: { type: "array", uniqueItems: true, items: { enum: ["object", "operation", "interaction", "model", "evidence", "planning", "export"] } },
      minimumFidelity: { enum: fidelityOrder },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
    outputSchema: resultEnvelopeSchemaFor(["entries", "totalMatched"], {
      entries: { type: "array", items: { type: "object" } },
      totalMatched: { type: "integer", minimum: 0 },
    }),
    invoke: (input) => chemistryDomainServices.searchCapabilities(input as unknown as SearchCapabilitiesInput),
  },
  {
    suffix: "assess_procedure",
    title: "Assess a chemistry procedure",
    description: "Assess ProcedureIR against the registered chemistry pack and report runnable, representable, unsupported, ambiguous, or missing semantics without composing unsupported behavior.",
    inputSchema: inputSchema(["procedure", "constraints"], {
      procedure: { type: "object" },
      constraints: constraintsSchema,
    }),
    outputSchema: resultEnvelopeSchemaFor(["coverage"], { coverage: { type: "object" } }),
    invoke: (input) => chemistryDomainServices.assessProcedure(input as unknown as AssessProcedureInput),
  },
  {
    suffix: "compose_draft",
    title: "Compose a supported chemistry draft",
    description: "Deterministically compose a reviewable chemistry draft from validated ProcedureIR using current Studio blueprints, then return a sanitized importable artifact package.",
    inputSchema: inputSchema(["procedure", "constraints", "package"], {
      procedure: { type: "object" },
      constraints: constraintsSchema,
      package: packageContextSchema,
    }),
    outputSchema: resultEnvelopeSchemaFor(["composition"], {
      composition: { type: "object" },
      artifactPackage: { type: "object" },
    }),
    invoke: (input) => chemistryDomainServices.composeDraft(input as unknown as ComposeDraftInput),
  },
  {
    suffix: "validate_artifact",
    title: "Validate a chemistry artifact",
    description: "Validate a supplied LabDefinition or TechniqueDefinition through the same chemistry validators used by Lab Studio. Performs no durable write.",
    inputSchema: inputSchema(["artifact"], {
      artifact: { type: "object" },
      context: {
        type: "object",
        additionalProperties: false,
        properties: {
          includeReadiness: { type: "boolean" },
          includePreview: { type: "boolean" },
          requireExportReady: { type: "boolean" },
          selectedNodeId: nonEmptyStringSchema,
        },
      },
    }),
    outputSchema: resultEnvelopeSchemaFor(["validation"], { validation: { type: "object" } }),
    invoke: (input) => chemistryDomainServices.validateArtifact(input as unknown as ValidateArtifactInput),
  },
  {
    suffix: "plan_class_run",
    title: "Plan a chemistry class run",
    description: "Calculate deterministic class-scaled requirements, preparation, station waves, capacity, shortages, cleanup, and review-only substitutions. Missing quantities remain explicit and no purchase is performed.",
    inputSchema: inputSchema(["artifact", "context"], {
      artifact: { type: "object" },
      context: resourceRunContextSchema,
    }),
    outputSchema: resultEnvelopeSchemaFor(["validation"], {
      validation: { type: "object" },
      runPlan: { type: "object" },
    }),
    invoke: (input) => chemistryDomainServices.planClassRun(input as unknown as PlanClassRunInput),
  },
] as const;

export const chemistryMcpDomainRegistration = {
  namespace: "labstudio" as const,
  domainPackId: "chemistry" as const,
  domainPackVersion: chemistryDomainPackVersion,
  contracts: chemistryToolContracts,
};
