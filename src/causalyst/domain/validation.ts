import { coreEvidenceRegistryFragment } from "../../platform/evidence/coreRegistry";
import { createEvidenceRegistry } from "../../platform/evidence/registry";
import type { ContractDiagnostic, ContractValidationResult } from "../../platform/validation/jsonSchema";
import { findForbiddenArtifactData } from "../../platform/artifacts/security";
import { registeredStudioDomainPacks, studioDomainPackRegistry } from "../../platform/domain-packs/staticRegistry";
import { addDecimal, compareDecimal, parseDecimal } from "../../platform/planning/decimal";
import type { CapabilityEntry, CapabilityRef } from "../../platform/capabilities/types";
import type { FidelityLevel } from "../../platform/fidelity/types";
import { validateCausalystAssessmentSchema } from "./schema";
import type { CausalystAssessmentDefinition, EvidenceSelector } from "./types";

const diagnostic = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

const unique = (
  values: readonly string[],
  path: string,
  code: string,
  diagnostics: ContractDiagnostic[],
) => {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) diagnostics.push(diagnostic(code, `${path}/${index}`, `${value} is duplicated.`));
    seen.add(value);
  });
};

const capabilityKey = ({ domainPackId, kind, id, version }: CapabilityRef) =>
  `${domainPackId}:${kind}:${id}@${version}`;

const fidelityRank: Record<FidelityLevel, number> = { F0: 0, F1: 1, F2: 2, F3: 3, F4: 4 };

const artifactIdentity = (artifact: Record<string, unknown>): { id?: string; version?: string } => {
  const metadata = artifact.metadata;
  return {
    id: typeof artifact.id === "string" ? artifact.id : undefined,
    version: metadata && typeof metadata === "object" && typeof (metadata as Record<string, unknown>).version === "string"
        ? String((metadata as Record<string, unknown>).version)
      : typeof artifact.schemaVersion === "string"
        ? artifact.schemaVersion
        : undefined,
  };
};

const selectorRequiredFields = (
  selector: EvidenceSelector,
  path: string,
  diagnostics: ContractDiagnostic[],
) => {
  if (selector.type === "evidence-type" && (!selector.evidenceTypeId || !selector.evidenceTypeVersion || selector.minimumCount < 1)) {
    diagnostics.push(diagnostic("causalyst.selector.evidence-type-invalid", path, "Evidence-type selectors require a registered type, version, and positive minimum count."));
  }
  if (selector.type === "artifact-valid" && selector.expected !== true) {
    diagnostics.push(diagnostic("causalyst.selector.artifact-valid-invalid", path, "Artifact-valid selectors can require only validated artifacts."));
  }
  if (selector.type === "capability-used" && (!selector.capabilityRef || typeof selector.capabilityRef !== "object")) {
    diagnostics.push(diagnostic("causalyst.selector.capability-invalid", path, "Capability-used selectors require a registered capability reference."));
  }
  if (selector.type === "payload-equals" && (!selector.evidenceTypeId || !selector.evidenceTypeVersion || !selector.path.startsWith("/"))) {
    diagnostics.push(diagnostic("causalyst.selector.payload-invalid", path, "Payload selectors require a registered evidence type/version and JSON Pointer path."));
  }
  if (selector.type === "payload-equals" && !["string", "number", "boolean"].includes(typeof selector.expected)) {
    diagnostics.push(diagnostic("causalyst.selector.expected-invalid", path, "Payload selector expected values must be strings, finite numbers, or booleans."));
  }
  if (selector.type === "payload-equals" && typeof selector.expected === "number" && !Number.isFinite(selector.expected)) {
    diagnostics.push(diagnostic("causalyst.selector.expected-invalid", path, "Payload selector numeric expected values must be finite."));
  }
};

export const validateCausalystAssessment = (
  candidate: unknown,
): ContractValidationResult<CausalystAssessmentDefinition> => {
  const schema = validateCausalystAssessmentSchema(candidate);
  if (!schema.ok) return schema;
  const assessment = schema.value;
  const diagnostics: ContractDiagnostic[] = [];
  if (!Number.isFinite(Date.parse(assessment.metadata.updatedAt))) diagnostics.push(diagnostic(
    "causalyst.metadata.updated-at-invalid",
    "/metadata/updatedAt",
    "updatedAt must be an ISO-8601 timestamp.",
  ));

  if (!studioDomainPackRegistry.hasExact(assessment.domainPackRef)) {
    diagnostics.push(diagnostic(
      "causalyst.domain-pack.version-mismatch",
      "/domainPackRef",
      `Domain pack ${assessment.domainPackRef.id}@${assessment.domainPackRef.version} is not registered.`,
    ));
  }
  const pack = studioDomainPackRegistry.hasExact(assessment.domainPackRef)
    ? studioDomainPackRegistry.resolveExact(assessment.domainPackRef)
    : undefined;
  if (pack) {
    const artifactValidation = pack.validateArtifact(assessment.executableArtifact.artifact, {});
    if (!artifactValidation.ok) diagnostics.push(...artifactValidation.diagnostics.map((entry) => ({
      ...entry,
      path: `/executableArtifact/artifact${entry.path === "/" ? "" : entry.path}`,
    })));
  }
  const identity = artifactIdentity(assessment.executableArtifact.artifact);
  if (identity.id !== assessment.executableArtifact.artifactRef.id) diagnostics.push(diagnostic(
    "causalyst.artifact.id-mismatch",
    "/executableArtifact/artifactRef/id",
    "Embedded artifact ID does not match its pinned artifact reference.",
  ));
  if (identity.version !== assessment.executableArtifact.artifactRef.version) diagnostics.push(diagnostic(
    "causalyst.artifact.version-mismatch",
    "/executableArtifact/artifactRef/version",
    "Embedded artifact version does not match its pinned artifact reference.",
  ));
  diagnostics.push(...findForbiddenArtifactData(assessment).map((entry) => ({
    code: entry.code,
    path: entry.path,
    message: entry.message,
    severity: "error" as const,
  })));

  const packFragments = registeredStudioDomainPacks.map((entry) => entry.getCapabilityManifestFragment());
  const capabilityEntries = new Map<string, CapabilityEntry>(
    packFragments.flatMap(({ entries }) => entries).map((entry) => [capabilityKey(entry.ref), entry]),
  );
  const allCapabilityRefs = [
    ...assessment.authoringPolicy.allowedCapabilityRefs,
    ...assessment.authoringPolicy.deniedCapabilityRefs,
    ...assessment.authoringPolicy.requiredCapabilityRefs,
  ];
  allCapabilityRefs.forEach((ref, index) => {
    const entry = capabilityEntries.get(capabilityKey(ref));
    if (!entry) diagnostics.push(diagnostic(
      "causalyst.capability.not-registered",
      `/authoringPolicy/capabilityRefs/${index}`,
      `Capability ${capabilityKey(ref)} is not registered.`,
    ));
    if (ref.domainPackId !== assessment.domainPackRef.id) diagnostics.push(diagnostic(
      "causalyst.capability.domain-mismatch",
      `/authoringPolicy/capabilityRefs/${index}/domainPackId`,
      "Assessment capability references must belong to the pinned domain pack.",
    ));
  });
  const allowed = new Set(assessment.authoringPolicy.allowedCapabilityRefs.map(capabilityKey));
  const denied = new Set(assessment.authoringPolicy.deniedCapabilityRefs.map(capabilityKey));
  const required = new Set(assessment.authoringPolicy.requiredCapabilityRefs.map(capabilityKey));
  required.forEach((key) => {
    if (!allowed.has(key)) diagnostics.push(diagnostic("causalyst.capability.required-not-allowed", "/authoringPolicy/requiredCapabilityRefs", `${key} must also be allowed.`));
    if (denied.has(key)) diagnostics.push(diagnostic("causalyst.capability.required-denied", "/authoringPolicy/deniedCapabilityRefs", `${key} cannot be both required and denied.`));
    const entry = capabilityEntries.get(key);
    const supported = entry?.claims.reduce<FidelityLevel | undefined>(
      (highest, claim) => !highest || fidelityRank[claim.maximumFidelity] > fidelityRank[highest] ? claim.maximumFidelity : highest,
      undefined,
    );
    if (supported && fidelityRank[supported] < fidelityRank[assessment.authoringPolicy.requiredFidelity]) {
      diagnostics.push(diagnostic(
        "causalyst.capability.fidelity-insufficient",
        "/authoringPolicy/requiredFidelity",
        `${key} supports ${supported}, below required ${assessment.authoringPolicy.requiredFidelity}.`,
      ));
    }
  });

  const evidencePack = pack ?? registeredStudioDomainPacks.find(({ descriptor }) => descriptor.id === assessment.domainPackRef.id);
  const evidenceRegistry = createEvidenceRegistry([
    coreEvidenceRegistryFragment,
    evidencePack!.getEvidenceRegistryFragment(),
  ]);
  if (assessment.contractPins.evidenceRegistryVersion !== evidenceRegistry.registryDocument.version) {
    diagnostics.push(diagnostic(
      "causalyst.evidence.registry-version-mismatch",
      "/contractPins/evidenceRegistryVersion",
      `Assessment pins ${assessment.contractPins.evidenceRegistryVersion}; current registry is ${evidenceRegistry.registryDocument.version}.`,
    ));
  }
  const evidenceRefs = [
    ...assessment.evidencePlan.requiredEvidenceTypeRefs,
    ...assessment.evidencePlan.optionalEvidenceTypeRefs,
  ];
  evidenceRefs.forEach((ref, index) => {
    if (!evidenceRegistry.get(ref.id, ref.version)) diagnostics.push(diagnostic(
      "causalyst.evidence.not-registered",
      `/evidencePlan/typeRefs/${index}`,
      `Evidence type ${ref.id}@${ref.version} is not registered for this assessment.`,
    ));
  });
  const plannedEvidence = new Set(evidenceRefs.map(({ id, version }) => `${id}@${version}`));
  unique(assessment.rubric.criteria.map(({ id }) => id), "/rubric/criteria", "causalyst.rubric.criterion-duplicate", diagnostics);
  unique(assessment.explanationPrompts.map(({ id }) => id), "/explanationPrompts", "causalyst.prompt.id-duplicate", diagnostics);

  let weightSum = parseDecimal("0");
  assessment.rubric.criteria.forEach((criterion, criterionIndex) => {
    weightSum = addDecimal(weightSum, parseDecimal(criterion.weight));
    unique(criterion.levels.map(({ id }) => id), `/rubric/criteria/${criterionIndex}/levels`, "causalyst.rubric.level-duplicate", diagnostics);
    unique(criterion.evidenceSelectors.map(({ id }) => id), `/rubric/criteria/${criterionIndex}/evidenceSelectors`, "causalyst.selector.id-duplicate", diagnostics);
    criterion.levels.forEach((level, levelIndex) => {
      if (compareDecimal(parseDecimal(level.points), parseDecimal(criterion.weight)) > 0) diagnostics.push(diagnostic(
        "causalyst.rubric.level-exceeds-weight",
        `/rubric/criteria/${criterionIndex}/levels/${levelIndex}/points`,
        "Rubric level points cannot exceed the criterion weight.",
      ));
    });
    criterion.evidenceSelectors.forEach((selector, selectorIndex) => {
      const path = `/rubric/criteria/${criterionIndex}/evidenceSelectors/${selectorIndex}`;
      selectorRequiredFields(selector, path, diagnostics);
      if (selector.type === "capability-used" && selector.capabilityRef && !allowed.has(capabilityKey(selector.capabilityRef))) {
        diagnostics.push(diagnostic("causalyst.selector.capability-not-allowed", path, "Capability selector must reference the assessment's allowed palette."));
      }
      if (selector.type === "evidence-type" || selector.type === "payload-equals") {
        const key = `${selector.evidenceTypeId}@${selector.evidenceTypeVersion}`;
        if (!plannedEvidence.has(key) || !evidenceRegistry.get(selector.evidenceTypeId, selector.evidenceTypeVersion)) {
          diagnostics.push(diagnostic("causalyst.selector.evidence-not-planned", path, `${key} must be registered and included in the evidence plan.`));
        }
      }
    });
  });
  if (compareDecimal(weightSum, parseDecimal(assessment.rubric.totalPoints)) !== 0) diagnostics.push(diagnostic(
    "causalyst.rubric.weight-total",
    "/rubric/totalPoints",
    "Criterion weights must sum exactly to rubric totalPoints.",
  ));

  return diagnostics.length > 0
    ? { ok: false, diagnostics: diagnostics.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)) }
    : { ok: true, value: structuredClone(assessment), diagnostics: [] };
};
