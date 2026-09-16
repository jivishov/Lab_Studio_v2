import checkedManifest from "../../../../public/capabilities/v2/manifest.json";
import { describe, expect, it } from "vitest";
import {
  chemistryActionCapabilitySources,
  chemistryCapabilityManifestGeneratedAt,
  chemistryEquipmentCapabilitySources,
  chemistryInteractionCapabilitySources,
  chemistryModelCapabilitySources,
  getChemistryCapabilityManifestFragment,
} from "../../../domain-packs/chemistry";
import {
  getAssayCapabilityManifestFragment,
  getAssayEvidenceRegistryFragment,
} from "../../../domain-packs/assay";
import { coreEvidenceRegistryFragment } from "../../evidence/coreRegistry";
import { createEvidenceRegistry } from "../../evidence/registry";
import {
  compareCapabilityManifestArtifact,
  mergeCapabilityManifestFragments,
  parseCapabilityManifest,
  serializeCapabilityManifest,
} from "../merge";
import {
  capabilityManifestDocumentSchema,
  capabilityManifestFragmentSchema,
  validateCapabilityManifestFragmentSchema,
  validateCapabilityManifestSchema,
} from "../schema";
import type { CapabilityManifestFragment, CapabilityProofKind } from "../types";
import { validateCapabilityManifestFragment } from "../validation";

const registry = createEvidenceRegistry([
  coreEvidenceRegistryFragment,
  getAssayEvidenceRegistryFragment(),
]);
const context = { evidenceTypeIds: registry.typeIds };
const fragment = (): CapabilityManifestFragment => getChemistryCapabilityManifestFragment();
const checkedFragments = (): CapabilityManifestFragment[] => [
  fragment(),
  getAssayCapabilityManifestFragment(),
];

const removeProofKind = (candidate: CapabilityManifestFragment, entryIndex: number, claimIndex: number, kind: CapabilityProofKind): void => {
  candidate.entries[entryIndex].claims[claimIndex].proofRefs = candidate.entries[entryIndex].claims[claimIndex].proofRefs
    .filter((proof) => proof.kind !== kind);
};

describe("Capability Manifest v2", () => {
  it("validates fragment/manifest versions and round-trips canonical output", () => {
    const source = fragment();
    expect(capabilityManifestDocumentSchema.$id).toBe("https://lab-studio.local/schemas/studio.capability-manifest/2.0/manifest");
    expect(capabilityManifestFragmentSchema.$id).toBe("https://lab-studio.local/schemas/studio.capability-manifest/2.0/fragment");
    expect(validateCapabilityManifestFragmentSchema(source)).toMatchObject({ ok: true });
    expect(validateCapabilityManifestFragmentSchema(JSON.parse(JSON.stringify(source)))).toEqual({
      ok: true,
      value: source,
      diagnostics: [],
    });
    expect(validateCapabilityManifestFragment(source, context)).toMatchObject({ ok: true });
    expect(validateCapabilityManifestFragmentSchema({ ...source, schemaVersion: "1.0" })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ path: "/schemaVersion" })]),
    });
    const manifest = mergeCapabilityManifestFragments([source], chemistryCapabilityManifestGeneratedAt, context);
    expect(validateCapabilityManifestSchema(manifest)).toMatchObject({ ok: true });
    const serialized = serializeCapabilityManifest(manifest, context);
    expect(parseCapabilityManifest(serialized, context)).toEqual(manifest);
    expect(validateCapabilityManifestSchema({ ...manifest, schemaVersion: "1.0" })).toMatchObject({ ok: false });
  });

  it("merges deterministically regardless of source array ordering", () => {
    const forward = fragment();
    const reversed = structuredClone(forward);
    reversed.entries.reverse();
    reversed.proofs.reverse();
    reversed.accessiblePaths.reverse();
    reversed.compatibilityEdges.reverse();
    reversed.examples.reverse();
    const assayFixture: CapabilityManifestFragment = {
      schema: "studio.capability-manifest-fragment",
      schemaVersion: "2.0",
      studioCoreVersion: "1.0.0",
      domainPack: { id: "assay", version: "1.0.0", title: "Assay test fixture", limitations: ["No entries in the Cycle 03 merge fixture."] },
      entries: [], proofs: [], accessiblePaths: [], compatibilityEdges: [], examples: [],
    };
    const first = mergeCapabilityManifestFragments([forward, assayFixture], chemistryCapabilityManifestGeneratedAt, context);
    const second = mergeCapabilityManifestFragments([assayFixture, reversed], chemistryCapabilityManifestGeneratedAt, context);
    expect(serializeCapabilityManifest(first, context)).toBe(serializeCapabilityManifest(second, context));
    expect(() => mergeCapabilityManifestFragments([forward, forward], chemistryCapabilityManifestGeneratedAt, context)).toThrow("Merged capability manifest is invalid");
    expect(() => mergeCapabilityManifestFragments([forward, { ...assayFixture, studioCoreVersion: "2.0.0" }], chemistryCapabilityManifestGeneratedAt, context)).toThrow("different Studio Core versions");
  });

  it("rejects duplicate, dangling, mismatched, and circular proof/capability references", () => {
    const duplicate = fragment();
    duplicate.proofs.push(structuredClone(duplicate.proofs[0]));
    expect(validateCapabilityManifestFragment(duplicate, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.proof.duplicate" })]),
    });

    const dangling = fragment();
    dangling.entries[0].claims[0].proofRefs[0].proofId = "missing.proof";
    expect(validateCapabilityManifestFragment(dangling, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.claim.proof.dangling" })]),
    });

    const mismatch = fragment();
    mismatch.entries[0].claims[0].proofRefs[0].kind = "validator";
    expect(validateCapabilityManifestFragment(mismatch, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.claim.proof.kind-mismatch" })]),
    });

    const circular = fragment();
    circular.proofs[0].dependsOnProofRefs = [circular.proofs[1].id];
    circular.proofs[1].dependsOnProofRefs = [circular.proofs[0].id];
    expect(validateCapabilityManifestFragment(circular, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.proof.circular" })]),
    });
  });

  it("enforces proof honesty for asset-only, action-only, F2, F3, F4, and every generated claim", () => {
    const source = fragment();
    source.entries.forEach((entry, entryIndex) => entry.claims.forEach((claim, claimIndex) => {
      const candidate = fragment();
      const requiredKind: CapabilityProofKind = claim.maximumFidelity === "F1"
        ? "accessible-path"
        : claim.maximumFidelity === "F2"
          ? "runtime-handler"
          : "deterministic-model";
      removeProofKind(candidate, entryIndex, claimIndex, requiredKind);
      expect(validateCapabilityManifestFragment(candidate, context).ok, `${entry.ref.id}/${claim.id} must reject missing ${requiredKind}`).toBe(false);
    }));

    const assetOnly = fragment();
    assetOnly.entries[0].claims[0].maximumFidelity = "F2";
    expect(validateCapabilityManifestFragment(assetOnly, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.claim.f2.runtime-proof-missing" })]),
    });
    const actionOnly = fragment();
    const actionIndex = chemistryEquipmentCapabilitySources.length;
    actionOnly.entries[actionIndex].claims[0].maximumFidelity = "F2";
    expect(validateCapabilityManifestFragment(actionOnly, context).ok).toBe(false);

    const f3Index = chemistryEquipmentCapabilitySources.length
      + chemistryActionCapabilitySources.length
      + chemistryInteractionCapabilitySources.length;
    const missingFormula = fragment();
    const modelProofId = missingFormula.entries[f3Index].claims[0].proofRefs
      .find(({ kind }) => kind === "deterministic-model")!.proofId;
    delete missingFormula.proofs.find(({ id }) => id === modelProofId)!.model;
    expect(validateCapabilityManifestFragment(missingFormula, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.claim.f3.model-proof-missing" })]),
    });

    const falseF4 = fragment();
    falseF4.entries[f3Index].claims[0].maximumFidelity = "F4";
    expect(validateCapabilityManifestFragment(falseF4, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.claim.f4.calibration-proof-missing" })]),
    });
  });

  it("rejects unregistered evidence, absolute paths, provider fields, and manifest drift", () => {
    const unregistered = fragment();
    unregistered.entries.find(({ ref }) => ref.kind === "interaction")!.claims[0].requiredEvidenceTypeIds = ["raw.runtime.state"];
    expect(validateCapabilityManifestFragment(unregistered, context)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "capability.claim.evidence-type.dangling" })]),
    });
    const localPath = fragment();
    localPath.proofs[0].implementation!.source = "C:\\private\\catalog.ts";
    expect(validateCapabilityManifestFragmentSchema(localPath).ok).toBe(false);
    const providerField = structuredClone(fragment()) as CapabilityManifestFragment & { fileId?: string };
    providerField.fileId = "file-secret";
    expect(validateCapabilityManifestFragmentSchema(providerField).ok).toBe(false);

    const generated = mergeCapabilityManifestFragments(checkedFragments(), chemistryCapabilityManifestGeneratedAt, context);
    const drift = compareCapabilityManifestArtifact(checkedManifest, generated, context);
    expect(drift.matches).toBe(true);
    const changed = structuredClone(checkedManifest);
    changed.entries[0].summary = "drifted";
    expect(compareCapabilityManifestArtifact(changed, generated, context).matches).toBe(false);
  });

  it("builds the conservative chemistry inventory from exact current registries", () => {
    const manifest = mergeCapabilityManifestFragments([fragment()], chemistryCapabilityManifestGeneratedAt, context);
    expect(manifest.entries.filter(({ ref }) => ref.kind === "object")).toHaveLength(chemistryEquipmentCapabilitySources.length);
    expect(manifest.entries.filter(({ ref }) => ref.kind === "operation")).toHaveLength(chemistryActionCapabilitySources.length);
    expect(manifest.entries.filter(({ ref }) => ref.kind === "interaction")).toHaveLength(chemistryInteractionCapabilitySources.length);
    expect(manifest.entries.filter(({ ref }) => ref.kind === "model")).toHaveLength(chemistryModelCapabilitySources.length);
    expect(manifest.entries.flatMap(({ claims }) => claims).some(({ maximumFidelity }) => maximumFidelity === "F4")).toBe(false);
    expect(manifest.entries.filter(({ ref }) => ref.kind === "operation").every(({ claims }) => claims.every(({ maximumFidelity }) => maximumFidelity === "F1"))).toBe(true);
  });
});
