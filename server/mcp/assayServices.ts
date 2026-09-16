import { assayDomainPackVersion } from "../../src/domain-packs/assay/assayPack";
import {
  assayReleaseServices,
  type ComposeAssayInput,
} from "../../src/domain-packs/assay/services";
import type { ProcedureConstraints } from "../../src/platform/domain-packs/types";
import type { FidelityLevel } from "../../src/platform/fidelity/types";
import type { ProcedureIR } from "../../src/platform/procedure-ir/types";
import {
  baseRequestProperties,
  nonEmptyStringSchema,
  resultEnvelopeSchemaFor,
} from "./schemas";
import type { DomainServiceOutcome, DomainToolContract } from "./types";

const fidelityOrder: FidelityLevel[] = ["F0", "F1", "F2", "F3", "F4"];

const inputSchema = (
  required: string[],
  properties: Record<string, unknown>,
): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required: ["requestId", ...required],
  properties: { ...baseRequestProperties, ...properties },
});

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

const packageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["packageId", "createdAt"],
  properties: {
    packageId: nonEmptyStringSchema,
    createdAt: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
    },
  },
} as const;

const csvMappingSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "format", "delimiter", "decimalSeparator", "orientation", "plateIdColumn",
        "wellColumn", "signalColumn",
      ],
      properties: {
        format: { const: "long" },
        delimiter: { enum: [",", ";", "\t"] },
        decimalSeparator: { enum: [".", ","] },
        orientation: { const: "A1-top-left" },
        plateIdColumn: { type: "string" },
        wellColumn: nonEmptyStringSchema,
        signalColumn: nonEmptyStringSchema,
        unitColumn: { type: "string" },
        channelColumn: { type: "string" },
        capturedAtColumn: { type: "string" },
        defaultPlateId: { type: "string" },
        defaultUnit: { type: "string" },
        defaultChannel: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "format", "delimiter", "decimalSeparator", "orientation", "plateId",
        "unit", "rowLabelColumn",
      ],
      properties: {
        format: { const: "matrix" },
        delimiter: { enum: [",", ";", "\t"] },
        decimalSeparator: { enum: [".", ","] },
        orientation: { const: "A1-top-left" },
        plateId: nonEmptyStringSchema,
        unit: nonEmptyStringSchema,
        channel: { type: "string" },
        rowLabelColumn: nonEmptyStringSchema,
      },
    },
  ],
} as const;

const observationIngestionInputSchema = {
  ...inputSchema(["kind", "contents"], {
    kind: { enum: ["csv", "assay-lens"] },
    contents: { type: "string", maxLength: 1_048_576 },
    mapping: csvMappingSchema,
    importId: { type: "string" },
    sourceName: { type: "string" },
    sourceVersion: { type: "string" },
    createdAt: { type: "string" },
    context: {
      type: "object",
      additionalProperties: false,
      required: ["importId", "plateId", "unit", "importedAt", "sourceDescription"],
      properties: {
        importId: nonEmptyStringSchema,
        plateId: nonEmptyStringSchema,
        channel: { type: "string" },
        unit: nonEmptyStringSchema,
        importedAt: nonEmptyStringSchema,
        sourceDescription: nonEmptyStringSchema,
      },
    },
  }),
  allOf: [
    {
      if: { properties: { kind: { const: "csv" } }, required: ["kind"] },
      then: {
        required: ["mapping", "importId", "sourceName", "sourceVersion", "createdAt"],
      },
    },
    {
      if: { properties: { kind: { const: "assay-lens" } }, required: ["kind"] },
      then: { required: ["context"] },
    },
  ],
} as const;

export const assayDomainServices = {
  searchCapabilities(input: {
    query?: string;
    kinds?: string[];
    minimumFidelity?: FidelityLevel;
    limit?: number;
  }): DomainServiceOutcome {
    const result = assayReleaseServices.searchCapabilities(input);
    return {
      status: "ok",
      summary: `Found ${result.totalMatched} matching assay capabilities; returned ${result.entries.length}.`,
      data: { entries: result.entries, totalMatched: result.totalMatched },
      limitations: result.limitations,
    };
  },

  assessProtocol(input: {
    procedure: ProcedureIR;
    constraints: ProcedureConstraints;
  }): DomainServiceOutcome {
    const result = assayReleaseServices.assessProtocol(input.procedure, input.constraints);
    return {
      status: result.coverage.classification === "runnable" ? "ok" : "incomplete",
      summary: `Assay protocol coverage is ${result.coverage.classification}.`,
      data: { coverage: result.coverage },
      diagnostics: result.diagnostics,
      limitations: [
        "ProcedureIR-to-assay-runtime compilation remains unavailable; unsupported or representational steps are never promoted to runnable.",
      ],
    };
  },

  composeAssay(input: ComposeAssayInput): DomainServiceOutcome {
    const composition = assayReleaseServices.composeAssay(input);
    return composition.ok
      ? {
          status: "ok",
          summary: `Composed validated assay ${composition.artifact.id} from reviewed template ${input.templateId}.`,
          data: {
            composition: {
              ok: true,
              artifact: composition.artifact,
              validation: composition.validation,
            },
            ...(composition.artifactPackage ? { artifactPackage: composition.artifactPackage } : {}),
          },
          limitations: [
            "Composition uses only source-controlled 96-well release templates and caller-supplied descriptive metadata.",
            "No protocol value, threshold, material amount, wavelength, incubation, endpoint, or clinical interpretation is inferred.",
          ],
        }
      : {
          status: "incomplete",
          summary: "Assay composition was blocked by deterministic validation.",
          data: { composition: { ok: false, diagnostics: composition.diagnostics } },
          diagnostics: composition.diagnostics,
        };
  },

  validateAssay(input: {
    artifact: unknown;
    require96Well?: boolean;
    package?: { packageId: string; createdAt: string };
  }): DomainServiceOutcome {
    const result = assayReleaseServices.validateAssay(input.artifact, {
      require96Well: input.require96Well,
      package: input.package,
    });
    return {
      status: result.validation.ok ? "ok" : "incomplete",
      summary: result.validation.ok
        ? "Assay artifact validation passed."
        : "Assay artifact validation failed.",
      data: {
        validation: result.validation,
        ...(result.artifactPackage ? { artifactPackage: result.artifactPackage } : {}),
      },
      diagnostics: result.validation.diagnostics,
    };
  },

  planRun(input: {
    requestId: string;
    artifact: unknown;
    planningRequest: unknown;
  }): DomainServiceOutcome {
    const result = assayReleaseServices.planRun(
      input.artifact,
      input.requestId,
      input.planningRequest,
    );
    const status = result.runPlan?.status === "complete" ? "ok" : "incomplete";
    return {
      status,
      summary: status === "ok"
        ? "Assay run plan completed from explicit operation, profile, resource, inventory, and capacity data."
        : "Assay run planning is incomplete; missing or invalid metadata remains explicit.",
      data: {
        validation: result.validation,
        ...(result.runPlan ? { runPlan: result.runPlan } : {}),
      },
      diagnostics: result.runPlan?.diagnostics ?? result.validation.diagnostics,
      assumptions: result.runPlan?.plan.assumptions ?? [],
      limitations: result.runPlan?.plan.limitations ?? [],
    };
  },

  ingestObservations(input: Parameters<typeof assayReleaseServices.ingestObservations>[0]): DomainServiceOutcome {
    const result = assayReleaseServices.ingestObservations(input);
    const errors = [
      ...result.candidate.diagnostics,
      ...result.candidate.rows.flatMap((row) => row.diagnostics),
    ].filter(({ severity }) => severity === "error");
    return {
      status: errors.length === 0 ? "ok" : "incomplete",
      summary: errors.length === 0
        ? `Mapped ${result.candidate.rows.filter(({ status }) => status === "mapped").length} observations; explicit review is required before commit or analysis.`
        : "Observation mapping contains blocking diagnostics; no observations were committed.",
      data: result,
      diagnostics: errors.map((entry) => ({
        code: entry.code,
        path: entry.row ? `/rows/${entry.row}` : "/import",
        message: entry.message,
        severity: "error",
      })),
      limitations: [
        "Image-derived observations remain distinct from instrument exports and are not absorbance-equivalent.",
        "This stateless tool returns an uncommitted review candidate and performs no URL fetch, image analysis, durable write, or endpoint analysis.",
      ],
    };
  },
};

export const assayToolContracts: readonly DomainToolContract[] = [
  {
    suffix: "search_capabilities",
    title: "Search Assay Studio capabilities",
    description: "Search proof-backed plate, pipetting, QC, planning, ingestion, protocol-analysis, evidence, and export capabilities with honest fidelity ceilings.",
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
    invoke: (input) => assayDomainServices.searchCapabilities(input),
  },
  {
    suffix: "assess_protocol",
    title: "Assess an assay protocol",
    description: "Assess ProcedureIR against the assay pack without promoting unsupported compilation or scientific semantics.",
    inputSchema: inputSchema(["procedure", "constraints"], {
      procedure: { type: "object" },
      constraints: constraintsSchema,
    }),
    outputSchema: resultEnvelopeSchemaFor(["coverage"], { coverage: { type: "object" } }),
    invoke: (input) => assayDomainServices.assessProtocol(input as unknown as {
      procedure: ProcedureIR;
      constraints: ProcedureConstraints;
    }),
  },
  {
    suffix: "compose_assay",
    title: "Compose a bounded 96-well assay",
    description: "Compose a validated assay only from a reviewed source-controlled template and caller-supplied descriptive metadata. No scientific value is inferred.",
    inputSchema: inputSchema(["templateId", "id", "title", "updatedAt"], {
      templateId: { enum: ["blank-96", "xtt-metabolic-activity", "educational-broth-microdilution"] },
      id: nonEmptyStringSchema,
      title: nonEmptyStringSchema,
      description: { type: "string", maxLength: 5000 },
      audience: { type: "string", maxLength: 1000 },
      author: { type: "string", maxLength: 1000 },
      useBoundary: { enum: ["education", "research-planning"] },
      updatedAt: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$",
      },
      package: packageSchema,
    }),
    outputSchema: resultEnvelopeSchemaFor(["composition"], {
      composition: { type: "object" },
      artifactPackage: { type: "object" },
    }),
    invoke: (input) => assayDomainServices.composeAssay(input as unknown as ComposeAssayInput),
  },
  {
    suffix: "validate_assay",
    title: "Validate an Assay Studio artifact",
    description: "Validate schema, 96-well layout, references, controls, operations, evidence requirements, profile references, and forbidden-data boundaries.",
    inputSchema: inputSchema(["artifact"], {
      artifact: { type: "object" },
      require96Well: { type: "boolean" },
      package: packageSchema,
    }),
    outputSchema: resultEnvelopeSchemaFor(["validation"], {
      validation: { type: "object" },
      artifactPackage: { type: "object" },
    }),
    invoke: (input) => assayDomainServices.validateAssay(input as unknown as {
      artifact: unknown;
      require96Well?: boolean;
      package?: { packageId: string; createdAt: string };
    }),
  },
  {
    suffix: "plan_run",
    title: "Plan a bounded assay run",
    description: "Calculate materials, tips, plates, batches, capacity, schedule, inventory comparison, and formula traces from explicit validated inputs. Performs no purchase or reservation.",
    inputSchema: inputSchema(["artifact", "planningRequest"], {
      artifact: { type: "object" },
      planningRequest: { type: "object" },
    }),
    outputSchema: resultEnvelopeSchemaFor(["validation"], {
      validation: { type: "object" },
      runPlan: { type: "object" },
    }),
    invoke: (input) => assayDomainServices.planRun(input as unknown as {
      requestId: string;
      artifact: unknown;
      planningRequest: unknown;
    }),
  },
  {
    suffix: "ingest_observations",
    title: "Map supplied assay observations",
    description: "Parse bounded supplied CSV or Assay Lens JSON into an explicit uncommitted review candidate. Does not fetch URLs, analyze images, or accept observations automatically.",
    inputSchema: observationIngestionInputSchema,
    outputSchema: resultEnvelopeSchemaFor(["candidate", "reviewRequired"], {
      candidate: { type: "object" },
      reviewRequired: { const: true },
    }),
    invoke: (input) => assayDomainServices.ingestObservations(input as never),
  },
] as const;

export const assayMcpDomainRegistration = {
  namespace: "assaystudio" as const,
  domainPackId: "assay" as const,
  domainPackVersion: assayDomainPackVersion,
  contracts: assayToolContracts,
};
