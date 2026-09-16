import type { FidelityLevel } from "../fidelity/types";
import { fidelityLevels } from "../fidelity/types";
import type { ContractDiagnostic, ContractValidationResult } from "../validation/jsonSchema";
import {
  validateCapabilityManifestFragmentSchema,
  validateCapabilityManifestSchema,
} from "./schema";
import type {
  CapabilityClaim,
  CapabilityEntry,
  CapabilityManifest,
  CapabilityManifestFragment,
  CapabilityProof,
  CapabilityProofKind,
  CapabilityRef,
} from "./types";

export interface CapabilityValidationContext {
  evidenceTypeIds?: ReadonlySet<string>;
  allowDanglingCapabilityRefs?: boolean;
}

const error = (code: string, path: string, message: string): ContractDiagnostic => ({
  code,
  path,
  message,
  severity: "error",
});

export const capabilityRefKey = (ref: CapabilityRef): string =>
  `${ref.domainPackId}:${ref.kind}:${ref.id}@${ref.version}`;

const duplicateStringDiagnostics = (
  values: readonly string[],
  path: string,
  code: string,
): ContractDiagnostic[] => {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    if (seen.has(value)) return [error(code, `${path}/${index}`, `Duplicate reference ${value}.`)];
    seen.add(value);
    return [];
  });
};

const duplicateKeyDiagnostics = <T>(
  values: readonly T[],
  path: string,
  code: string,
  getKey: (value: T) => string,
): ContractDiagnostic[] => {
  const seen = new Set<string>();
  return values.flatMap((value, index) => {
    const key = getKey(value);
    if (seen.has(key)) return [error(code, `${path}/${index}`, `Duplicate id or reference ${key}.`)];
    seen.add(key);
    return [];
  });
};

const cycleDiagnostics = (
  nodes: readonly string[],
  dependencies: ReadonlyMap<string, readonly string[]>,
  code: string,
  path: string,
): ContractDiagnostic[] => {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const diagnostics: ContractDiagnostic[] = [];

  const visit = (node: string, stack: string[]): void => {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      const cycle = [...stack.slice(Math.max(0, cycleStart)), node];
      diagnostics.push(error(code, path, `Circular reference detected: ${cycle.join(" -> ")}.`));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dependency of dependencies.get(node) ?? []) {
      if (dependencies.has(dependency)) visit(dependency, [...stack, node]);
    }
    visiting.delete(node);
    visited.add(node);
  };

  nodes.forEach((node) => visit(node, []));
  return diagnostics.slice(0, 1);
};

const proofKindsForClaim = (
  claim: CapabilityClaim,
  proofsById: ReadonlyMap<string, CapabilityProof>,
): Set<CapabilityProofKind> => new Set(
  claim.proofRefs
    .map(({ proofId }) => proofsById.get(proofId)?.kind)
    .filter((kind): kind is CapabilityProofKind => Boolean(kind)),
);

const claimHonestyDiagnostics = (
  claim: CapabilityClaim,
  path: string,
  proofsById: ReadonlyMap<string, CapabilityProof>,
  accessiblePathIds: ReadonlySet<string>,
  context: CapabilityValidationContext,
): ContractDiagnostic[] => {
  const diagnostics: ContractDiagnostic[] = [];
  const proofKinds = proofKindsForClaim(claim, proofsById);
  const rank = fidelityLevels.indexOf(claim.maximumFidelity);
  const hasRuntime = proofKinds.has("runtime-handler");
  const hasInteraction = proofKinds.has("interaction-implementation");
  const hasValidator = proofKinds.has("validator");
  const hasEvidence = proofKinds.has("evidence-producer");
  const hasAccessibleProof = proofKinds.has("accessible-path");

  if (rank === fidelityLevels.indexOf("F0") && !proofKinds.has("representative-content-fixture")) {
    diagnostics.push(error("capability.claim.f0.source-proof-missing", `${path}/proofRefs`, "F0 requires reviewed structured content or source-mapping proof."));
  }
  if (rank === fidelityLevels.indexOf("F1")) {
    if (!proofKinds.has("representative-content-fixture") && !proofKinds.has("interaction-implementation")) {
      diagnostics.push(error("capability.claim.f1.representation-proof-missing", `${path}/proofRefs`, "F1 requires a representation or data-view implementation proof."));
    }
    if (!hasAccessibleProof || claim.requiredAccessiblePathIds.length === 0) {
      diagnostics.push(error("capability.claim.f1.accessible-proof-missing", `${path}/requiredAccessiblePathIds`, "F1 requires an accessible representation proof."));
    }
  }
  if (rank >= fidelityLevels.indexOf("F2")) {
    if (!hasRuntime) diagnostics.push(error("capability.claim.f2.runtime-proof-missing", `${path}/proofRefs`, "F2+ requires runtime-handler proof."));
    if (!hasInteraction) diagnostics.push(error("capability.claim.f2.interaction-proof-missing", `${path}/proofRefs`, "F2+ requires a supported interaction implementation proof."));
    if (!hasValidator) diagnostics.push(error("capability.claim.f2.validator-proof-missing", `${path}/proofRefs`, "F2+ requires state or artifact validation proof."));
    if (!hasEvidence || claim.requiredEvidenceTypeIds.length === 0) diagnostics.push(error("capability.claim.f2.evidence-proof-missing", `${path}/requiredEvidenceTypeIds`, "F2+ requires evidence-producer proof and required evidence types."));
    if (!hasAccessibleProof || claim.requiredAccessiblePathIds.length === 0) diagnostics.push(error("capability.claim.f2.accessible-proof-missing", `${path}/requiredAccessiblePathIds`, "F2+ requires an accessible interaction path proof."));
  }
  if (rank >= fidelityLevels.indexOf("F3")) {
    const modelProofs = claim.proofRefs
      .map(({ proofId }) => proofsById.get(proofId))
      .filter((proof): proof is CapabilityProof => proof?.kind === "deterministic-model");
    if (!modelProofs.some((proof) => proof.model?.deterministic && proof.model.formula.length > 0 && proof.model.validityLimits.length > 0)) {
      diagnostics.push(error("capability.claim.f3.model-proof-missing", `${path}/proofRefs`, "F3+ requires deterministic model, formula, and validity-limit proof."));
    }
    if (!proofKinds.has("regression-test")) diagnostics.push(error("capability.claim.f3.regression-proof-missing", `${path}/proofRefs`, "F3+ requires reproducibility regression proof."));
    if (!claim.validityRange || Object.keys(claim.validityRange).length === 0) diagnostics.push(error("capability.claim.f3.validity-range-missing", `${path}/validityRange`, "F3+ requires a declared validity range."));
  }
  if (rank >= fidelityLevels.indexOf("F4")) {
    const calibrationProofs = claim.proofRefs
      .map(({ proofId }) => proofsById.get(proofId))
      .filter((proof): proof is CapabilityProof => proof?.kind === "protocol-profile");
    if (!calibrationProofs.some((proof) => proof.reference
      && proof.reference.referenceId.length > 0
      && proof.reference.version.length > 0
      && proof.reference.validityLimits.length > 0)) {
      diagnostics.push(error("capability.claim.f4.calibration-proof-missing", `${path}/proofRefs`, "F4 requires named, versioned calibration/reference evidence with validity limits."));
    }
  }

  claim.requiredAccessiblePathIds.forEach((id, index) => {
    if (!accessiblePathIds.has(id)) diagnostics.push(error("capability.claim.accessible-path.dangling", `${path}/requiredAccessiblePathIds/${index}`, `Accessible path ${id} is not declared.`));
  });
  if (context.evidenceTypeIds) claim.requiredEvidenceTypeIds.forEach((id, index) => {
    if (!context.evidenceTypeIds?.has(id)) diagnostics.push(error("capability.claim.evidence-type.dangling", `${path}/requiredEvidenceTypeIds/${index}`, `Evidence type ${id} is not registered.`));
  });
  return diagnostics;
};

interface CapabilityDocumentView {
  domainPacks: CapabilityManifest["domainPacks"];
  entries: CapabilityEntry[];
  proofs: CapabilityProof[];
  accessiblePaths: CapabilityManifest["accessiblePaths"];
  compatibilityEdges: CapabilityManifest["compatibilityEdges"];
  examples: CapabilityManifest["exampleIndex"];
}

const semanticDiagnostics = (
  capabilityView: CapabilityDocumentView,
  context: CapabilityValidationContext,
): ContractDiagnostic[] => {
  const diagnostics: ContractDiagnostic[] = [
    ...duplicateKeyDiagnostics(capabilityView.domainPacks, "/domainPacks", "capability.domain-pack.duplicate", ({ id }) => id),
    ...duplicateKeyDiagnostics(capabilityView.entries, "/entries", "capability.entry.duplicate", ({ ref }) => capabilityRefKey(ref)),
    ...duplicateKeyDiagnostics(capabilityView.proofs, "/proofs", "capability.proof.duplicate", ({ id }) => id),
    ...duplicateKeyDiagnostics(capabilityView.accessiblePaths, "/accessiblePaths", "capability.accessible-path.duplicate", ({ id }) => id),
    ...duplicateKeyDiagnostics(capabilityView.examples, "/exampleIndex", "capability.example.duplicate", ({ id }) => id),
    ...duplicateKeyDiagnostics(capabilityView.compatibilityEdges, "/compatibilityEdges", "capability.edge.duplicate", (edge) => `${capabilityRefKey(edge.from)}:${edge.relationship}:${capabilityRefKey(edge.to)}`),
  ];
  const entryKeys = new Set(capabilityView.entries.map(({ ref }) => capabilityRefKey(ref)));
  const proofsById = new Map(capabilityView.proofs.map((proof) => [proof.id, proof]));
  const accessiblePathIds = new Set(capabilityView.accessiblePaths.map(({ id }) => id));
  const exampleIds = new Set(capabilityView.examples.map(({ id }) => id));
  const domainPackIds = new Set(capabilityView.domainPacks.map(({ id }) => id));

  capabilityView.entries.forEach((entry, entryIndex) => {
    const entryPath = `/entries/${entryIndex}`;
    if (!domainPackIds.has(entry.ref.domainPackId)) diagnostics.push(error("capability.entry.domain-pack.dangling", `${entryPath}/ref/domainPackId`, `Domain pack ${entry.ref.domainPackId} is not declared.`));
    diagnostics.push(
      ...duplicateKeyDiagnostics(entry.claims, `${entryPath}/claims`, "capability.claim.duplicate", ({ id }) => id),
      ...duplicateKeyDiagnostics(entry.dependencies, `${entryPath}/dependencies`, "capability.dependency.duplicate", capabilityRefKey),
      ...duplicateStringDiagnostics(entry.accessiblePathIds, `${entryPath}/accessiblePathIds`, "capability.accessible-path.reference-duplicate"),
      ...duplicateStringDiagnostics(entry.exampleIds, `${entryPath}/exampleIds`, "capability.example.reference-duplicate"),
    );
    entry.dependencies.forEach((dependency, index) => {
      if (!entryKeys.has(capabilityRefKey(dependency)) && !context.allowDanglingCapabilityRefs) diagnostics.push(error("capability.dependency.dangling", `${entryPath}/dependencies/${index}`, `Capability ${capabilityRefKey(dependency)} is not declared.`));
    });
    entry.accessiblePathIds.forEach((id, index) => {
      if (!accessiblePathIds.has(id)) diagnostics.push(error("capability.accessible-path.dangling", `${entryPath}/accessiblePathIds/${index}`, `Accessible path ${id} is not declared.`));
    });
    entry.exampleIds.forEach((id, index) => {
      if (!exampleIds.has(id)) diagnostics.push(error("capability.example.dangling", `${entryPath}/exampleIds/${index}`, `Example ${id} is not declared.`));
    });
    entry.claims.forEach((claim, claimIndex) => {
      const claimPath = `${entryPath}/claims/${claimIndex}`;
      diagnostics.push(...duplicateKeyDiagnostics(claim.proofRefs, `${claimPath}/proofRefs`, "capability.claim.proof-reference-duplicate", ({ proofId }) => proofId));
      claim.proofRefs.forEach((proofRef, proofIndex) => {
        const proof = proofsById.get(proofRef.proofId);
        if (!proof) diagnostics.push(error("capability.claim.proof.dangling", `${claimPath}/proofRefs/${proofIndex}/proofId`, `Proof ${proofRef.proofId} is not declared.`));
        else if (proof.kind !== proofRef.kind) diagnostics.push(error("capability.claim.proof.kind-mismatch", `${claimPath}/proofRefs/${proofIndex}/kind`, `Proof ${proofRef.proofId} has kind ${proof.kind}, not ${proofRef.kind}.`));
      });
      diagnostics.push(...claimHonestyDiagnostics(claim, claimPath, proofsById, accessiblePathIds, context));
    });
  });

  capabilityView.proofs.forEach((proof, proofIndex) => {
    const proofPath = `/proofs/${proofIndex}`;
    diagnostics.push(
      ...duplicateStringDiagnostics(proof.dependsOnProofRefs, `${proofPath}/dependsOnProofRefs`, "capability.proof.dependency-duplicate"),
      ...duplicateStringDiagnostics(proof.evidenceTypeIds, `${proofPath}/evidenceTypeIds`, "capability.proof.evidence-type-duplicate"),
      ...duplicateStringDiagnostics(proof.accessiblePathIds, `${proofPath}/accessiblePathIds`, "capability.proof.accessible-path-duplicate"),
    );
    proof.dependsOnProofRefs.forEach((id, index) => {
      if (!proofsById.has(id)) diagnostics.push(error("capability.proof.dependency.dangling", `${proofPath}/dependsOnProofRefs/${index}`, `Proof ${id} is not declared.`));
    });
    proof.accessiblePathIds.forEach((id, index) => {
      if (!accessiblePathIds.has(id)) diagnostics.push(error("capability.proof.accessible-path.dangling", `${proofPath}/accessiblePathIds/${index}`, `Accessible path ${id} is not declared.`));
    });
    if (context.evidenceTypeIds) proof.evidenceTypeIds.forEach((id, index) => {
      if (!context.evidenceTypeIds?.has(id)) diagnostics.push(error("capability.proof.evidence-type.dangling", `${proofPath}/evidenceTypeIds/${index}`, `Evidence type ${id} is not registered.`));
    });
    if (proof.kind === "deterministic-model" && !proof.model) diagnostics.push(error("capability.proof.model-details-missing", `${proofPath}/model`, "Deterministic-model proof requires formula and validity details."));
    if (proof.kind === "evidence-producer" && proof.evidenceTypeIds.length === 0) diagnostics.push(error("capability.proof.evidence-types-missing", `${proofPath}/evidenceTypeIds`, "Evidence-producer proof must name produced evidence types."));
    if (proof.kind === "accessible-path" && proof.accessiblePathIds.length === 0) diagnostics.push(error("capability.proof.accessible-paths-missing", `${proofPath}/accessiblePathIds`, "Accessible-path proof must name an accessible path."));
    if (["runtime-handler", "interaction-implementation", "validator", "evidence-producer", "accessible-path", "representative-content-fixture", "regression-test"].includes(proof.kind) && !proof.implementation) diagnostics.push(error("capability.proof.implementation-missing", `${proofPath}/implementation`, `${proof.kind} proof requires a source-controlled implementation reference.`));
  });

  diagnostics.push(...cycleDiagnostics(
    capabilityView.proofs.map(({ id }) => id),
    new Map(capabilityView.proofs.map(({ id, dependsOnProofRefs }) => [id, dependsOnProofRefs])),
    "capability.proof.circular",
    "/proofs",
  ));
  diagnostics.push(...cycleDiagnostics(
    capabilityView.entries.map(({ ref }) => capabilityRefKey(ref)),
    new Map(capabilityView.entries.map(({ ref, dependencies }) => [capabilityRefKey(ref), dependencies.map(capabilityRefKey)])),
    "capability.dependency.circular",
    "/entries",
  ));

  capabilityView.compatibilityEdges.forEach((edge, index) => {
    if (!entryKeys.has(capabilityRefKey(edge.from)) && !context.allowDanglingCapabilityRefs) diagnostics.push(error("capability.edge.from.dangling", `/compatibilityEdges/${index}/from`, `Capability ${capabilityRefKey(edge.from)} is not declared.`));
    if (!entryKeys.has(capabilityRefKey(edge.to)) && !context.allowDanglingCapabilityRefs) diagnostics.push(error("capability.edge.to.dangling", `/compatibilityEdges/${index}/to`, `Capability ${capabilityRefKey(edge.to)} is not declared.`));
  });
  capabilityView.examples.forEach((example, exampleIndex) => {
    diagnostics.push(...duplicateKeyDiagnostics(example.capabilityRefs, `/exampleIndex/${exampleIndex}/capabilityRefs`, "capability.example.reference-duplicate", capabilityRefKey));
    example.capabilityRefs.forEach((ref, refIndex) => {
      if (!entryKeys.has(capabilityRefKey(ref)) && !context.allowDanglingCapabilityRefs) diagnostics.push(error("capability.example.capability.dangling", `/exampleIndex/${exampleIndex}/capabilityRefs/${refIndex}`, `Capability ${capabilityRefKey(ref)} is not declared.`));
    });
  });
  return diagnostics.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
};

export const validateCapabilityManifest = (
  input: unknown,
  context: CapabilityValidationContext = {},
): ContractValidationResult<CapabilityManifest> => {
  const schemaResult = validateCapabilityManifestSchema(input);
  if (!schemaResult.ok) return schemaResult;
  if (!Number.isFinite(Date.parse(schemaResult.value.generatedAt))) return {
    ok: false,
    diagnostics: [error("capability.generated-at.invalid", "/generatedAt", "generatedAt must be an ISO-8601 timestamp.")],
  };
  const diagnostics = semanticDiagnostics({ ...schemaResult.value, examples: schemaResult.value.exampleIndex }, context);
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, value: schemaResult.value, diagnostics: [] };
};

export const validateCapabilityManifestFragment = (
  input: unknown,
  context: CapabilityValidationContext = {},
): ContractValidationResult<CapabilityManifestFragment> => {
  const schemaResult = validateCapabilityManifestFragmentSchema(input);
  if (!schemaResult.ok) return schemaResult;
  const diagnostics = semanticDiagnostics({
    domainPacks: [schemaResult.value.domainPack],
    entries: schemaResult.value.entries,
    proofs: schemaResult.value.proofs,
    accessiblePaths: schemaResult.value.accessiblePaths,
    compatibilityEdges: schemaResult.value.compatibilityEdges,
    examples: schemaResult.value.examples,
  }, { ...context, allowDanglingCapabilityRefs: context.allowDanglingCapabilityRefs ?? true });
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, value: schemaResult.value, diagnostics: [] };
};
