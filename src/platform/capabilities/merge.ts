import { canonicalSerializeJson } from "../procedure-ir/canonical";
import type { ContractDiagnostic } from "../validation/jsonSchema";
import type {
  AccessiblePathDescriptor,
  CapabilityClaim,
  CapabilityEdge,
  CapabilityEntry,
  CapabilityExample,
  CapabilityManifest,
  CapabilityManifestFragment,
  CapabilityProof,
  CapabilityRef,
  DomainPackSummary,
} from "./types";
import {
  capabilityRefKey,
  validateCapabilityManifest,
  validateCapabilityManifestFragment,
  type CapabilityValidationContext,
} from "./validation";

const compare = (left: string, right: string): number => left.localeCompare(right);
const sortedStrings = (values: readonly string[]): string[] => [...values].sort(compare);
const sortedRefs = (values: readonly CapabilityRef[]): CapabilityRef[] =>
  [...values].sort((left, right) => compare(capabilityRefKey(left), capabilityRefKey(right)));

const normalizeClaim = (claim: CapabilityClaim): CapabilityClaim => ({
  ...claim,
  proofRefs: [...claim.proofRefs].sort((left, right) => compare(
    `${left.proofId}:${left.kind}`,
    `${right.proofId}:${right.kind}`,
  )),
  requiredEvidenceTypeIds: sortedStrings(claim.requiredEvidenceTypeIds),
  requiredAccessiblePathIds: sortedStrings(claim.requiredAccessiblePathIds),
});

const normalizeEntry = (entry: CapabilityEntry): CapabilityEntry => ({
  ...entry,
  tags: sortedStrings(entry.tags),
  claims: [...entry.claims].sort((left, right) => compare(left.id, right.id)).map(normalizeClaim),
  dependencies: sortedRefs(entry.dependencies),
  accessiblePathIds: sortedStrings(entry.accessiblePathIds),
  exampleIds: sortedStrings(entry.exampleIds),
  limitations: sortedStrings(entry.limitations),
});

const normalizeProof = (proof: CapabilityProof): CapabilityProof => ({
  ...proof,
  ...(proof.model ? { model: { ...proof.model, validityLimits: sortedStrings(proof.model.validityLimits) } } : {}),
  ...(proof.reference
    ? { reference: { ...proof.reference, validityLimits: sortedStrings(proof.reference.validityLimits) } }
    : {}),
  dependsOnProofRefs: sortedStrings(proof.dependsOnProofRefs),
  evidenceTypeIds: sortedStrings(proof.evidenceTypeIds),
  accessiblePathIds: sortedStrings(proof.accessiblePathIds),
  limitations: sortedStrings(proof.limitations),
});

const normalizeAccessiblePath = (path: AccessiblePathDescriptor): AccessiblePathDescriptor => ({
  ...path,
  modes: [...path.modes].sort(compare),
  limitations: sortedStrings(path.limitations),
});

const edgeKey = (edge: CapabilityEdge): string =>
  `${capabilityRefKey(edge.from)}:${edge.relationship}:${capabilityRefKey(edge.to)}`;

const normalizeExample = (example: CapabilityExample): CapabilityExample => ({
  ...example,
  capabilityRefs: sortedRefs(example.capabilityRefs),
  limitations: sortedStrings(example.limitations),
});

const normalizeDomainPack = (domainPack: DomainPackSummary): DomainPackSummary => ({
  ...domainPack,
  limitations: sortedStrings(domainPack.limitations),
});

export class CapabilityManifestValidationError extends Error {
  readonly diagnostics: ContractDiagnostic[];

  constructor(message: string, diagnostics: ContractDiagnostic[]) {
    super(message);
    this.name = "CapabilityManifestValidationError";
    this.diagnostics = diagnostics;
  }
}

const assertValid = <T>(
  result: { ok: true; value: T; diagnostics: ContractDiagnostic[] } | { ok: false; diagnostics: ContractDiagnostic[] },
  message: string,
): T => {
  if (!result.ok) throw new CapabilityManifestValidationError(message, result.diagnostics);
  return result.value;
};

export const mergeCapabilityManifestFragments = (
  fragments: readonly CapabilityManifestFragment[],
  generatedAt: string,
  context: CapabilityValidationContext = {},
): CapabilityManifest => {
  if (fragments.length === 0) throw new CapabilityManifestValidationError(
    "At least one capability fragment is required.",
    [{ code: "capability.fragment.required", path: "/", message: "At least one fragment is required.", severity: "error" }],
  );
  const validated = fragments.map((fragment, index) => assertValid(
    validateCapabilityManifestFragment(fragment, { ...context, allowDanglingCapabilityRefs: true }),
    `Capability fragment ${index} is invalid.`,
  ));
  const studioCoreVersions = new Set(validated.map(({ studioCoreVersion }) => studioCoreVersion));
  if (studioCoreVersions.size !== 1) throw new CapabilityManifestValidationError(
    "Capability fragments use different Studio Core versions.",
    [{ code: "capability.fragment.studio-core-version-mismatch", path: "/studioCoreVersion", message: "All fragments must target one exact Studio Core version.", severity: "error" }],
  );
  const manifest: CapabilityManifest = {
    schema: "studio.capability-manifest",
    schemaVersion: "2.0",
    studioCoreVersion: validated[0].studioCoreVersion,
    generatedAt,
    domainPacks: validated.map(({ domainPack }) => normalizeDomainPack(domainPack))
      .sort((left, right) => compare(`${left.id}@${left.version}`, `${right.id}@${right.version}`)),
    entries: validated.flatMap(({ entries }) => entries).map(normalizeEntry)
      .sort((left, right) => compare(capabilityRefKey(left.ref), capabilityRefKey(right.ref))),
    proofs: validated.flatMap(({ proofs }) => proofs).map(normalizeProof)
      .sort((left, right) => compare(left.id, right.id)),
    accessiblePaths: validated.flatMap(({ accessiblePaths }) => accessiblePaths).map(normalizeAccessiblePath)
      .sort((left, right) => compare(left.id, right.id)),
    compatibilityEdges: validated.flatMap(({ compatibilityEdges }) => compatibilityEdges)
      .sort((left, right) => compare(edgeKey(left), edgeKey(right))),
    exampleIndex: validated.flatMap(({ examples }) => examples).map(normalizeExample)
      .sort((left, right) => compare(left.id, right.id)),
  };
  return assertValid(validateCapabilityManifest(manifest, context), "Merged capability manifest is invalid.");
};

export const serializeCapabilityManifest = (
  manifest: CapabilityManifest,
  context: CapabilityValidationContext = {},
): string => canonicalSerializeJson(assertValid(
  validateCapabilityManifest(manifest, context),
  "Capability manifest is invalid.",
));

export const parseCapabilityManifest = (
  serialized: string,
  context: CapabilityValidationContext = {},
): CapabilityManifest => assertValid(
  validateCapabilityManifest(JSON.parse(serialized) as unknown, context),
  "Serialized capability manifest is invalid.",
);

export interface CapabilityManifestDriftResult {
  matches: boolean;
  checkedCanonical: string;
  generatedCanonical: string;
}

export const compareCapabilityManifestArtifact = (
  checkedArtifact: unknown,
  generatedManifest: CapabilityManifest,
  context: CapabilityValidationContext = {},
): CapabilityManifestDriftResult => {
  const checked = assertValid(validateCapabilityManifest(checkedArtifact, context), "Checked capability artifact is invalid.");
  const checkedCanonical = serializeCapabilityManifest(checked, context);
  const generatedCanonical = serializeCapabilityManifest(generatedManifest, context);
  return { matches: checkedCanonical === generatedCanonical, checkedCanonical, generatedCanonical };
};
