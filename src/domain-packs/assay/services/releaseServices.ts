import { createStudioArtifactPackage } from "../../../platform/artifacts/builder";
import { serializeArtifactPackage } from "../../../platform/artifacts/canonical";
import type { ContractDiagnostic } from "../../../platform/validation/jsonSchema";
import type { ProcedureConstraints, RunContext } from "../../../platform/domain-packs/types";
import type { FidelityLevel } from "../../../platform/fidelity/types";
import type { ProcedureIR } from "../../../platform/procedure-ir/types";
import { canonicalSerializeJson } from "../../../platform/procedure-ir/canonical";
import { getAssayLayoutGoldenArtifact } from "../__fixtures__/assay-layout.v1";
import { assayDomainPack, assayDomainPackVersion } from "../assayPack";
import {
  importAssayLensObservationPackage,
  mapAssayCsv,
  type AssayCsvMapping,
  type AssayLensImportContext,
  type AssayObservationImport,
} from "../ingestion";
import {
  createCycle11MicAssay,
  createCycle11XttAssay,
} from "../profiles/__fixtures__/cycle11ProtocolFixtures";
import type { AssayRunPlanResult, AssayRunPlanningRequest } from "../planning";
import type { AssayDefinition } from "../types";
import { serializeAssayDefinition } from "../types/validation";

const fidelityOrder: FidelityLevel[] = ["F0", "F1", "F2", "F3", "F4"];
const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type AssayReleaseTemplateId = "blank-96" | "xtt-metabolic-activity" | "educational-broth-microdilution";

export interface ComposeAssayInput {
  templateId: AssayReleaseTemplateId;
  id: string;
  title: string;
  description?: string;
  audience?: string;
  author?: string;
  useBoundary?: AssayDefinition["useBoundary"];
  updatedAt: string;
  package?: {
    packageId: string;
    createdAt: string;
  };
}

export interface AssayReleaseFile {
  fileName: string;
  mediaType: "application/json" | "text/csv" | "text/markdown";
  contents: string;
}

export interface AssayArtifactComparison {
  compatible: boolean;
  baseId: string;
  candidateId: string;
  baseVersion: string;
  candidateVersion: string;
  changedSections: string[];
  changedWells: string[];
  diagnostics: ContractDiagnostic[];
}

export interface AssayReleaseReport {
  schema: "assay-studio.release-report";
  schemaVersion: "1.0";
  artifactRef: { id: string; version: string };
  domainPackRef: { id: "assay"; version: string };
  decision: "limited-release-candidate";
  validation: { ok: boolean; diagnostics: ContractDiagnostic[] };
  boundaries: string[];
  accessiblePaths: string[];
  downloadableFiles: AssayReleaseFile[];
}

const maximumFidelity = (claims: Array<{ maximumFidelity: FidelityLevel }>): FidelityLevel =>
  claims.reduce((best, claim) => fidelityOrder.indexOf(claim.maximumFidelity) > fidelityOrder.indexOf(best)
    ? claim.maximumFidelity
    : best, "F0" as FidelityLevel);

const diagnosticsFromGaps = (
  gaps: Array<{ code: string; message: string; required: boolean; stepId?: string }>,
): ContractDiagnostic[] => gaps.map((gap) => ({
  code: gap.code,
  path: gap.stepId ? `/procedure/steps/${gap.stepId}` : "/procedure",
  message: gap.message,
  severity: gap.required ? "error" : "warning",
}));

const templateArtifact = (templateId: AssayReleaseTemplateId): AssayDefinition => {
  if (templateId === "xtt-metabolic-activity") return createCycle11XttAssay();
  if (templateId === "educational-broth-microdilution") return createCycle11MicAssay();
  return getAssayLayoutGoldenArtifact();
};

const escapeCsv = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;

const plateMapCsv = (artifact: AssayDefinition): string => [
  ["plate_id", "coordinate", "role", "sample_ref", "control_ref", "condition_refs", "replicate_group_refs", "expected_volume", "expected_volume_unit"],
  ...artifact.plate.wells.map((well) => [
    artifact.plate.id,
    well.coordinate,
    well.role,
    well.sampleRef ?? "",
    well.controlRef ?? "",
    well.conditionRefs.join("|"),
    well.replicateGroupRefs.join("|"),
    well.expectedFinalVolume.value,
    well.expectedFinalVolume.unit,
  ]),
].map((row) => row.map(escapeCsv).join(",")).join("\n");

export const assayReleaseServices = {
  searchCapabilities(input: {
    query?: string;
    kinds?: string[];
    minimumFidelity?: FidelityLevel;
    limit?: number;
  }) {
    const fragment = assayDomainPack.getCapabilityManifestFragment();
    const query = input.query?.trim().toLowerCase();
    const kinds = new Set(input.kinds ?? []);
    const minimum = input.minimumFidelity ? fidelityOrder.indexOf(input.minimumFidelity) : 0;
    const matched = fragment.entries
      .filter((entry) => kinds.size === 0 || kinds.has(entry.ref.kind))
      .filter((entry) => fidelityOrder.indexOf(maximumFidelity(entry.claims)) >= minimum)
      .filter((entry) => !query || [
        entry.ref.id,
        entry.title,
        entry.summary,
        ...entry.tags,
      ].some((value) => value.toLowerCase().includes(query)))
      .sort((left, right) => left.ref.id.localeCompare(right.ref.id));
    return {
      entries: matched.slice(0, input.limit ?? 25).map((entry) => ({
        ref: entry.ref,
        title: entry.title,
        summary: entry.summary,
        maximumFidelity: maximumFidelity(entry.claims),
        accessiblePathIds: entry.accessiblePathIds,
        limitations: entry.limitations,
      })),
      totalMatched: matched.length,
      limitations: fragment.domainPack.limitations,
    };
  },

  assessProtocol(procedure: ProcedureIR, constraints: ProcedureConstraints) {
    const coverage = assayDomainPack.assessProcedure(procedure, constraints);
    return {
      coverage,
      diagnostics: diagnosticsFromGaps(coverage.gaps),
    };
  },

  composeAssay(input: ComposeAssayInput) {
    if (!safeIdPattern.test(input.id)) {
      return {
        ok: false as const,
        diagnostics: [{
          code: "assay.compose.id-invalid",
          path: "/id",
          message: "Assay id must be 1-128 safe identifier characters.",
          severity: "error" as const,
        }],
      };
    }
    if (!input.title.trim()) {
      return {
        ok: false as const,
        diagnostics: [{
          code: "assay.compose.title-required",
          path: "/title",
          message: "Assay title is required.",
          severity: "error" as const,
        }],
      };
    }
    if (
      !Number.isFinite(Date.parse(input.updatedAt))
      || (input.package && !Number.isFinite(Date.parse(input.package.createdAt)))
    ) {
      return {
        ok: false as const,
        diagnostics: [{
          code: "assay.compose.updated-at-invalid",
          path: input.package && !Number.isFinite(Date.parse(input.package.createdAt))
            ? "/package/createdAt"
            : "/updatedAt",
          message: "Updated-at and package created-at values must be ISO-8601 timestamps.",
          severity: "error" as const,
        }],
      };
    }
    const artifact = templateArtifact(input.templateId);
    artifact.id = input.id;
    artifact.title = input.title.trim();
    if (input.description?.trim()) artifact.description = input.description.trim();
    if (input.audience?.trim()) artifact.audience = input.audience.trim();
    if (input.useBoundary) artifact.useBoundary = input.useBoundary;
    artifact.metadata = {
      ...artifact.metadata,
      author: input.author?.trim() || "Assay Studio user",
      updatedAt: input.updatedAt,
      tags: [...new Set([...artifact.metadata.tags, "cycle-12-release-template"])].sort(),
    };
    artifact.plate.id = `${input.id}:plate`;
    artifact.plate.wells = artifact.plate.wells.map((well) => ({
      ...well,
      id: `${artifact.plate.id}:${well.coordinate}`,
    }));
    artifact.replicateGroups = artifact.replicateGroups.map((group) => ({
      ...group,
      memberWellIds: group.memberWellIds.map((wellId) => {
        const coordinate = wellId.split(":").at(-1);
        return `${artifact.plate.id}:${coordinate}`;
      }),
    }));
    const validation = assayDomainPack.validateArtifact(artifact, { require96Well: true });
    if (!validation.ok) return { ok: false as const, diagnostics: validation.diagnostics };
    const artifactPackage = input.package
      ? assayDomainPack.packageArtifact(validation.artifact, {
          packageId: input.package.packageId,
          createdAt: input.package.createdAt,
          capabilityManifestVersion: "2.0",
        })
      : undefined;
    return {
      ok: true as const,
      artifact: validation.artifact,
      validation,
      ...(artifactPackage ? { artifactPackage } : {}),
    };
  },

  validateAssay(artifact: unknown, options: { require96Well?: boolean; package?: { packageId: string; createdAt: string } } = {}) {
    if (options.package && !Number.isFinite(Date.parse(options.package.createdAt))) {
      return {
        validation: {
          ok: false as const,
          diagnostics: [{
            code: "assay.package.created-at-invalid",
            path: "/package/createdAt",
            message: "Package created-at must be an ISO-8601 timestamp.",
            severity: "error" as const,
          }],
        },
      };
    }
    const validation = assayDomainPack.validateArtifact(artifact, {
      require96Well: options.require96Well ?? true,
    });
    if (!validation.ok) return { validation };
    const artifactPackage = options.package
      ? assayDomainPack.packageArtifact(validation.artifact, {
          packageId: options.package.packageId,
          createdAt: options.package.createdAt,
          capabilityManifestVersion: "2.0",
        })
      : undefined;
    return { validation, ...(artifactPackage ? { artifactPackage } : {}) };
  },

  planRun(artifact: unknown, requestId: string, planningRequest: unknown) {
    const validation = assayDomainPack.validateArtifact(artifact, { require96Well: true });
    if (!validation.ok) return { validation, runPlan: undefined };
    const runPlan = assayDomainPack.planRun(validation.artifact, {
      requestId,
      extension: planningRequest as AssayRunPlanningRequest,
    } satisfies RunContext).extension as AssayRunPlanResult;
    return { validation, runPlan };
  },

  ingestObservations(input:
    | {
        kind: "csv";
        contents: string;
        mapping: AssayCsvMapping;
        importId: string;
        sourceName: string;
        sourceVersion: string;
        createdAt: string;
      }
    | {
        kind: "assay-lens";
        contents: string;
        context: AssayLensImportContext;
      }): { candidate: AssayObservationImport; reviewRequired: true } {
    const candidate = input.kind === "csv"
      ? mapAssayCsv(input.contents, input.mapping, {
          importId: input.importId,
          sourceName: input.sourceName,
          sourceVersion: input.sourceVersion,
          createdAt: input.createdAt,
        })
      : importAssayLensObservationPackage(input.contents, input.context);
    return { candidate, reviewRequired: true };
  },
};

const comparableSections: Array<keyof AssayDefinition> = [
  "title",
  "description",
  "audience",
  "learningGoals",
  "useBoundary",
  "safetyNotes",
  "protocolProfileRef",
  "resources",
  "samples",
  "conditions",
  "controls",
  "replicateGroups",
  "equipment",
  "operations",
  "process",
  "analysisPlan",
  "evidenceRequirements",
  "materials",
];

export const compareAssayArtifacts = (
  base: unknown,
  candidate: unknown,
): AssayArtifactComparison => {
  const baseValidation = assayDomainPack.validateArtifact(base, { require96Well: true });
  const candidateValidation = assayDomainPack.validateArtifact(candidate, { require96Well: true });
  const diagnostics = [
    ...(!baseValidation.ok ? baseValidation.diagnostics : []),
    ...(!candidateValidation.ok ? candidateValidation.diagnostics : []),
  ];
  if (!baseValidation.ok || !candidateValidation.ok) {
    return {
      compatible: false,
      baseId: baseValidation.ok ? baseValidation.artifact.id : "invalid",
      candidateId: candidateValidation.ok ? candidateValidation.artifact.id : "invalid",
      baseVersion: baseValidation.ok ? baseValidation.artifact.metadata.version : "invalid",
      candidateVersion: candidateValidation.ok ? candidateValidation.artifact.metadata.version : "invalid",
      changedSections: [],
      changedWells: [],
      diagnostics,
    };
  }
  const baseArtifact = baseValidation.artifact;
  const candidateArtifact = candidateValidation.artifact;
  if (baseArtifact.id !== candidateArtifact.id) diagnostics.push({
    code: "assay.compare.id-mismatch",
    path: "/id",
    message: "A candidate can be applied only to the assay with the same id.",
    severity: "error",
  });
  const changedSections = comparableSections.filter((section) =>
    canonicalSerializeJson(baseArtifact[section]) !== canonicalSerializeJson(candidateArtifact[section]));
  const baseWells = new Map(baseArtifact.plate.wells.map((well) => [well.coordinate, well]));
  const changedWells = candidateArtifact.plate.wells
    .filter((well) => canonicalSerializeJson(baseWells.get(well.coordinate)) !== canonicalSerializeJson(well))
    .map(({ coordinate }) => coordinate);
  return {
    compatible: !diagnostics.some(({ severity }) => severity === "error"),
    baseId: baseArtifact.id,
    candidateId: candidateArtifact.id,
    baseVersion: baseArtifact.metadata.version,
    candidateVersion: candidateArtifact.metadata.version,
    changedSections,
    changedWells,
    diagnostics,
  };
};

export const applyAssayCandidateTransaction = (input: {
  current: AssayDefinition;
  candidate: unknown;
  expectedCurrentVersion: string;
}): { ok: true; artifact: AssayDefinition; comparison: AssayArtifactComparison } | {
  ok: false;
  comparison: AssayArtifactComparison;
  diagnostics: ContractDiagnostic[];
} => {
  const comparison = compareAssayArtifacts(input.current, input.candidate);
  const diagnostics = [...comparison.diagnostics];
  if (input.current.metadata.version !== input.expectedCurrentVersion) diagnostics.push({
    code: "assay.apply.version-conflict",
    path: "/metadata/version",
    message: "The current assay changed after comparison; compare again before applying.",
    severity: "error",
  });
  if (!comparison.compatible || diagnostics.some(({ severity }) => severity === "error")) {
    return { ok: false, comparison, diagnostics };
  }
  return {
    ok: true,
    artifact: structuredClone(input.candidate as AssayDefinition),
    comparison,
  };
};

export const createAssayReleaseReport = (
  artifact: unknown,
  context: { createdAt: string; packageId: string },
): AssayReleaseReport => {
  const validated = assayReleaseServices.validateAssay(artifact, {
    require96Well: true,
    package: context,
  });
  const validation = validated.validation;
  if (!validation.ok) {
    return {
      schema: "assay-studio.release-report",
      schemaVersion: "1.0",
      artifactRef: { id: "invalid", version: "invalid" },
      domainPackRef: { id: "assay", version: assayDomainPackVersion },
      decision: "limited-release-candidate",
      validation: { ok: false, diagnostics: validation.diagnostics },
      boundaries: [...assayDomainPack.descriptor.limitations],
      accessiblePaths: [],
      downloadableFiles: [],
    };
  }
  const packageValue = ("artifactPackage" in validated ? validated.artifactPackage : undefined)
    ?? createStudioArtifactPackage({
    packageId: context.packageId,
    createdAt: context.createdAt,
    domainPack: { id: "assay", version: assayDomainPackVersion },
    capabilityManifestVersion: "2.0",
    artifactKind: "AssayDefinition",
    artifactTitle: validation.artifact.title,
    artifactVersion: validation.artifact.metadata.version,
    artifactFileName: `${validation.artifact.id}.assay.json`,
    artifact: validation.artifact,
    validation: { ok: true, diagnostics: validation.diagnostics },
    assumptions: [],
    limitations: assayDomainPack.descriptor.limitations,
  });
  const fragment = assayDomainPack.getCapabilityManifestFragment();
  const reportBase = {
    schema: "assay-studio.release-report" as const,
    schemaVersion: "1.0" as const,
    artifactRef: { id: validation.artifact.id, version: validation.artifact.metadata.version },
    domainPackRef: { id: "assay" as const, version: assayDomainPackVersion },
    decision: "limited-release-candidate" as const,
    validation: { ok: true, diagnostics: validation.diagnostics },
    boundaries: [...assayDomainPack.descriptor.limitations],
    accessiblePaths: fragment.accessiblePaths.map(({ id }) => id).sort(),
  };
  const releaseSummary = [
    "# Assay Studio limited release candidate",
    "",
    `Artifact: ${validation.artifact.id}@${validation.artifact.metadata.version}`,
    `Profile: ${validation.artifact.protocolProfileRef.id}@${validation.artifact.protocolProfileRef.version}`,
    "",
    "## Scientific and operational boundaries",
    "",
    ...reportBase.boundaries.map((boundary) => `- ${boundary}`),
    "",
    "Detailed automated, browser, and formative-review checks were not run under the repository validation policy.",
  ].join("\n");
  const downloadableFiles: AssayReleaseFile[] = [
    {
      fileName: `${validation.artifact.id}.assay.json`,
      mediaType: "application/json",
      contents: serializeAssayDefinition(validation.artifact),
    },
    {
      fileName: `${validation.artifact.id}.assay-package.json`,
      mediaType: "application/json",
      contents: serializeArtifactPackage(packageValue),
    },
    {
      fileName: `${validation.artifact.id}.plate-map.csv`,
      mediaType: "text/csv",
      contents: plateMapCsv(validation.artifact),
    },
    {
      fileName: `${validation.artifact.id}.release-limits.md`,
      mediaType: "text/markdown",
      contents: releaseSummary,
    },
  ];
  return { ...reportBase, downloadableFiles };
};
