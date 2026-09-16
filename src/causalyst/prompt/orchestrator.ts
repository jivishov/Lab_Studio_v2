import type { CapabilityEntry, CapabilityRef } from "../../platform/capabilities/types";
import { studioDomainPackRegistry } from "../../platform/domain-packs/staticRegistry";
import type {
  AnyStudioDomainPack,
  CompilationGap,
  VersionedStudioArtifact,
} from "../../platform/domain-packs/types";
import {
  normalizeHostModelProcedureIRCandidate,
  normalizeProcedureIRCandidate,
} from "../../platform/procedure-ir/normalize";
import type { ProcedureIR } from "../../platform/procedure-ir/types";
import { validateProcedureIR } from "../../platform/procedure-ir/validation";
import type { ContractDiagnostic } from "../../platform/validation/jsonSchema";
import type { CausalystAssessmentDefinition } from "../domain/types";
import type {
  CausalystModelCandidateAdapter,
  CausalystPromptRequest,
  PromptBuildResult,
  PromptRevisionRecord,
} from "./types";

const diagnostic = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const capabilityKey = (ref: CapabilityRef) =>
  `${ref.domainPackId}:${ref.kind}:${ref.id}@${ref.version}`;

const artifactVersion = (artifact: VersionedStudioArtifact): string =>
  "metadata" in artifact ? artifact.metadata.version : artifact.schemaVersion;

const compilationGap = (entry: ContractDiagnostic): CompilationGap => ({
  code: entry.code,
  category: entry.code.includes("version") ? "version-mismatch" : "unsupported",
  message: entry.message,
  required: true,
});

const policyDiagnostics = (
  assessment: CausalystAssessmentDefinition,
  procedure: ProcedureIR,
  entries: readonly CapabilityEntry[],
): ContractDiagnostic[] => {
  const diagnostics: ContractDiagnostic[] = [];
  const policy = assessment.authoringPolicy;
  if (procedure.domainHint && procedure.domainHint !== assessment.domainPackRef.id) {
    diagnostics.push(diagnostic(
      "causalyst.prompt.domain-mismatch",
      "/domainHint",
      `The candidate targets ${procedure.domainHint}, but this assessment is pinned to ${assessment.domainPackRef.id}.`,
    ));
  }
  if (procedure.steps.length > policy.maximumProcessNodes) {
    diagnostics.push(diagnostic(
      "causalyst.prompt.process-limit",
      "/steps",
      `The candidate has ${procedure.steps.length} steps; the teacher limit is ${policy.maximumProcessNodes}.`,
    ));
  }
  const available = new Map(entries.map((entry) => [capabilityKey(entry.ref), entry]));
  const allowed = new Set(policy.allowedCapabilityRefs.map(capabilityKey));
  const denied = new Set(policy.deniedCapabilityRefs.map(capabilityKey));
  policy.requiredCapabilityRefs.forEach((ref, index) => {
    const key = capabilityKey(ref);
    if (!available.has(key) || !allowed.has(key) || denied.has(key)) diagnostics.push(diagnostic(
      "causalyst.prompt.required-capability-blocked",
      `/authoringPolicy/requiredCapabilityRefs/${index}`,
      `Required capability ${key} is unavailable under the teacher policy.`,
    ));
  });
  const operationEntries = entries.filter(({ ref }) => ref.kind === "operation");
  procedure.steps.forEach((step, index) => {
    const actionKey = step.normalizedOperation?.actionKey;
    if (!actionKey) return;
    const matches = operationEntries.filter(({ ref }) =>
      ref.id === actionKey || ref.id.endsWith(`.${actionKey}`) || ref.id.endsWith(`:${actionKey}`));
    if (matches.length === 0) {
      diagnostics.push(diagnostic(
        "causalyst.prompt.operation-unregistered",
        `/steps/${index}/normalizedOperation/actionKey`,
        `Operation ${actionKey} is not registered by the pinned domain pack.`,
      ));
      return;
    }
    if (matches.every(({ ref }) => !allowed.has(capabilityKey(ref)))) diagnostics.push(diagnostic(
      "causalyst.prompt.palette-expansion",
      `/steps/${index}/normalizedOperation/actionKey`,
      `Operation ${actionKey} is outside the teacher-approved capability palette.`,
    ));
    if (matches.some(({ ref }) => denied.has(capabilityKey(ref)))) diagnostics.push(diagnostic(
      "causalyst.prompt.denied-capability",
      `/steps/${index}/normalizedOperation/actionKey`,
      `Operation ${actionKey} is explicitly denied by the teacher policy.`,
    ));
  });
  if (procedure.reviewFlags.some(({ severity }) => severity === "blocking")) diagnostics.push(diagnostic(
    "causalyst.prompt.blocking-review",
    "/reviewFlags",
    "The candidate contains unresolved blocking review flags.",
  ));
  return diagnostics.sort((left, right) =>
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

const usedCapabilities = (
  assessment: CausalystAssessmentDefinition,
  procedure: ProcedureIR,
  entries: readonly CapabilityEntry[],
): CapabilityRef[] => {
  const actionKeys = new Set(procedure.steps.flatMap((step) =>
    step.normalizedOperation?.actionKey ? [step.normalizedOperation.actionKey] : []));
  const selected = entries.filter(({ ref }) =>
    ref.kind !== "operation"
      ? assessment.authoringPolicy.requiredCapabilityRefs.some((required) =>
          capabilityKey(required) === capabilityKey(ref))
      : actionKeys.has(ref.id)
        || [...actionKeys].some((actionKey) => ref.id.endsWith(`.${actionKey}`) || ref.id.endsWith(`:${actionKey}`)));
  return selected.map(({ ref }) => structuredClone(ref));
};

const constraintsFor = (
  assessment: CausalystAssessmentDefinition,
): { requiredOperationRefs: string[]; allowedOperationRefs: string[]; maximumSteps: number } => ({
  requiredOperationRefs: assessment.authoringPolicy.requiredCapabilityRefs
    .filter(({ kind }) => kind === "operation")
    .map(({ id }) => id),
  allowedOperationRefs: assessment.authoringPolicy.allowedCapabilityRefs
    .filter(({ kind }) => kind === "operation")
    .map(({ id }) => id),
  maximumSteps: assessment.authoringPolicy.maximumProcessNodes,
});

const revision = (
  source: "prompt" | "manual",
  revisionNumber: number,
  createdAt: string,
  diagnostics: readonly ContractDiagnostic[],
  procedure?: ProcedureIR,
  artifact?: VersionedStudioArtifact,
  promptText?: string,
  learnerChangeReason?: string,
): PromptRevisionRecord => ({
  revisionNumber,
  createdAt,
  source,
  ...(promptText ? { promptText } : {}),
  ...(procedure ? { procedureRef: { id: procedure.id, version: "1.0" } } : {}),
  ...(artifact ? { artifactRef: { id: artifact.id, version: artifactVersion(artifact) } } : {}),
  diagnosticCodes: [...new Set(diagnostics.map(({ code }) => code))].sort(),
  ...(learnerChangeReason ? { learnerChangeReason } : {}),
});

const buildFromCandidate = (
  assessment: CausalystAssessmentDefinition,
  candidate: unknown,
  options: {
    source: "prompt" | "manual";
    revisionNumber: number;
    createdAt: string;
    promptText?: string;
    learnerChangeReason?: string;
  },
): PromptBuildResult => {
  const normalized = options.source === "prompt"
    ? normalizeHostModelProcedureIRCandidate(candidate)
    : normalizeProcedureIRCandidate(candidate);
  if (!normalized.ok) {
    return {
      ok: false,
      gaps: normalized.diagnostics.map(compilationGap),
      revision: revision(
        options.source,
        options.revisionNumber,
        options.createdAt,
        normalized.diagnostics,
        undefined,
        undefined,
        options.promptText,
        options.learnerChangeReason,
      ),
      diagnostics: normalized.diagnostics,
    };
  }
  const fullValidation = validateProcedureIR(normalized.value);
  const pack = studioDomainPackRegistry.resolveExact(assessment.domainPackRef) as AnyStudioDomainPack;
  const entries = pack.getCapabilityManifestFragment().entries;
  const diagnostics = [
    ...(fullValidation.ok ? [] : fullValidation.diagnostics),
    ...policyDiagnostics(assessment, normalized.value, entries),
  ];
  if (diagnostics.length > 0) {
    return {
      ok: false,
      procedure: normalized.value,
      gaps: diagnostics.map(compilationGap),
      revision: revision(
        options.source,
        options.revisionNumber,
        options.createdAt,
        diagnostics,
        normalized.value,
        undefined,
        options.promptText,
        options.learnerChangeReason,
      ),
      diagnostics,
    };
  }
  const constraints = constraintsFor(assessment);
  const coverage = pack.assessProcedure(normalized.value, constraints);
  const composition = pack.composeArtifact({ procedure: normalized.value, constraints });
  if (!composition.ok) {
    return {
      ok: false,
      procedure: normalized.value,
      gaps: composition.gaps,
      revision: revision(
        options.source,
        options.revisionNumber,
        options.createdAt,
        [],
        normalized.value,
        undefined,
        options.promptText,
        options.learnerChangeReason,
      ),
      diagnostics: coverage.gaps.map((gap) => diagnostic(
        gap.code,
        gap.stepId ? `/steps/${gap.stepId}` : "/steps",
        gap.message,
      )),
    };
  }
  const validated = pack.validateArtifact(composition.artifact, {});
  if (!validated.ok) {
    const validationDiagnostics = validated.diagnostics.map((entry) => diagnostic(
      entry.code,
      entry.path,
      entry.message,
    ));
    return {
      ok: false,
      procedure: normalized.value,
      gaps: validationDiagnostics.map(compilationGap),
      revision: revision(
        options.source,
        options.revisionNumber,
        options.createdAt,
        validationDiagnostics,
        normalized.value,
        undefined,
        options.promptText,
        options.learnerChangeReason,
      ),
      diagnostics: validationDiagnostics,
    };
  }
  const artifact = structuredClone(validated.artifact);
  const capabilities = usedCapabilities(assessment, normalized.value, entries);
  return {
    ok: true,
    procedure: normalized.value,
    artifact,
    usedCapabilityRefs: capabilities,
    revision: revision(
      options.source,
      options.revisionNumber,
      options.createdAt,
      [],
      normalized.value,
      artifact,
      options.promptText,
      options.learnerChangeReason,
    ),
    diagnostics: [],
  };
};

export const buildPromptCandidate = async (
  adapter: CausalystModelCandidateAdapter,
  request: CausalystPromptRequest,
  createdAt = new Date().toISOString(),
): Promise<PromptBuildResult> => buildFromCandidate(
  request.assessment,
  await adapter.proposeProcedureIR(request),
  {
    source: "prompt",
    revisionNumber: request.revisionNumber,
    createdAt,
    promptText: request.prompt,
  },
);

export const buildManualCandidate = (
  assessment: CausalystAssessmentDefinition,
  candidate: unknown,
  options: {
    revisionNumber: number;
    createdAt?: string;
    learnerChangeReason?: string;
  },
): PromptBuildResult => buildFromCandidate(assessment, candidate, {
  source: "manual",
  revisionNumber: options.revisionNumber,
  createdAt: options.createdAt ?? new Date().toISOString(),
  learnerChangeReason: options.learnerChangeReason,
});

