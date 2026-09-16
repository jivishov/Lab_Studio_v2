import { describe, expect, it } from "vitest";
import {
  DomainPackNotRegisteredError,
  DomainPackVersionMismatchError,
  DuplicateDomainPackRegistrationError,
  InvalidDomainPackDescriptorError,
  UnsupportedDomainPackIdError,
} from "../errors";
import { createStudioDomainPackRegistry } from "../registry";
import { resolveDomainPackCandidates } from "../resolver";
import { domainPackDescriptorSchema, validateDomainPackDescriptor } from "../schema";
import { studioDomainPackRegistry } from "../staticRegistry";
import { chemistryDomainPack } from "../../../domain-packs/chemistry/chemistryPack";
import { assayDomainPack } from "../../../domain-packs/assay/assayPack";
import type { AnyStudioDomainPack, DomainPackDescriptor } from "../types";

const chemistryDescriptor: DomainPackDescriptor = {
  id: "chemistry",
  version: "1.0.0",
  title: "Chemistry",
  artifactKinds: ["lab", "technique"],
  supportedProcedureIRVersions: ["1.0"],
  minimumStudioCoreVersion: "1.0.0",
  publicNamespaces: ["labstudio"],
  limitations: ["Read-only test pack."],
};

const createPack = (descriptor = chemistryDescriptor): AnyStudioDomainPack => ({
  descriptor,
  schemas: { artifact: {} },
  getCapabilityManifestFragment: () => ({
    schema: "studio.capability-manifest-fragment",
    schemaVersion: "2.0",
    studioCoreVersion: descriptor.minimumStudioCoreVersion,
    domainPack: {
      id: descriptor.id,
      version: descriptor.version,
      title: descriptor.title,
      limitations: descriptor.limitations,
    },
    entries: [],
    proofs: [],
    accessiblePaths: [],
    compatibilityEdges: [],
    examples: [],
  }),
  getEvidenceRegistryFragment: () => ({
    schema: "studio.evidence-registry-fragment",
    schemaVersion: "1.0",
    domainPackId: descriptor.id,
    version: descriptor.version,
    entries: [],
  }),
  assessProcedure: (procedure) => ({
    procedureId: procedure.id,
    domainPackId: descriptor.id,
    domainPackVersion: descriptor.version,
    gaps: [],
  }),
  composeArtifact: () => ({ ok: false, gaps: [{
    code: "cycle-02.interface-only",
    category: "unsupported",
    message: "Compilation is not implemented by this contract fixture.",
    required: true,
  }] }),
  validateArtifact: () => ({ ok: false, diagnostics: [] }),
  planRun: () => ({
    schema: "studio.run-plan",
    schemaVersion: "1.0",
    domainPackId: descriptor.id,
  }),
  packageArtifact: (artifact, context) => ({
    schema: "studio.artifact-package",
    schemaVersion: "1.0",
    packageId: context.packageId,
    createdAt: context.createdAt,
    domainPack: { id: descriptor.id, version: descriptor.version },
    capabilityManifestVersion: "2.0",
    artifactDescriptor: {
      artifactId: artifact.id,
      artifactKind: "fixture",
      title: artifact.id,
      version: "1.0",
      fileName: `${artifact.id}.json`,
      mediaType: "application/json",
    },
    validation: { ok: true, diagnostics: [] },
    artifact,
    files: [{
      id: "artifact",
      role: "artifact",
      fileName: `${artifact.id}.json`,
      mediaType: "application/json",
      encoding: "utf-8",
      byteLength: 0,
      content: "",
    }],
    assumptions: [],
    limitations: [],
  }),
  conformance: {
    goldenArtifactIds: [],
    getGoldenArtifact: () => undefined,
  },
});

describe("StudioDomainPack descriptor and static registry", () => {
  it("validates the versioned descriptor schema and rejects unsupported ids or loose versions", () => {
    expect(domainPackDescriptorSchema.$id).toBe(
      "https://lab-studio.local/schemas/studio.domain-pack-descriptor/1.0",
    );
    expect(validateDomainPackDescriptor(chemistryDescriptor).ok).toBe(true);
    expect(validateDomainPackDescriptor({ ...chemistryDescriptor, id: "robotics" })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "schema.enum", path: "/id" })]),
    });
    expect(validateDomainPackDescriptor({ ...chemistryDescriptor, version: "latest" })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "schema.pattern", path: "/version" })]),
    });
  });

  it("resolves only exact statically supplied versions and returns immutable descriptor snapshots", () => {
    const pack = createPack();
    const registry = createStudioDomainPackRegistry([pack]);
    expect(registry.hasExact({ id: "chemistry", version: "1.0.0" })).toBe(true);
    expect(registry.resolveExact({ id: "chemistry", version: "1.0.0" })).toBe(pack);
    expect(registry.listDescriptors()).toEqual([chemistryDescriptor]);
    expect(Object.isFrozen(registry.listDescriptors()[0])).toBe(true);
    expect(Object.isFrozen(registry.listDescriptors()[0].artifactKinds)).toBe(true);
  });

  it("uses typed errors for duplicate, missing, mismatched, invalid, and unsupported registrations", () => {
    const pack = createPack();
    expect(() => createStudioDomainPackRegistry([pack, pack]))
      .toThrow(DuplicateDomainPackRegistrationError);
    expect(() => createStudioDomainPackRegistry([createPack({ ...chemistryDescriptor, version: "latest" })]))
      .toThrow(InvalidDomainPackDescriptorError);
    const registry = createStudioDomainPackRegistry([pack]);
    expect(() => registry.resolveExact({ id: "chemistry", version: "2.0.0" }))
      .toThrow(DomainPackVersionMismatchError);
    expect(() => registry.resolveExact({ id: "assay", version: "1.0.0" }))
      .toThrow(DomainPackNotRegisteredError);
    expect(() => registry.resolveExact({ id: "robotics", version: "1.0.0" }))
      .toThrow(UnsupportedDomainPackIdError);
  });

  it("registers chemistry and the Cycle 06 assay pack explicitly", () => {
    expect(studioDomainPackRegistry.listDescriptors()).toEqual([
      assayDomainPack.descriptor,
      chemistryDomainPack.descriptor,
    ]);
    expect(studioDomainPackRegistry.resolveExact({ id: "chemistry", version: "1.0.0" }))
      .toBe(chemistryDomainPack);
    expect(studioDomainPackRegistry.hasExact({ id: "assay", version: "1.0.0" })).toBe(true);
    expect(studioDomainPackRegistry.resolveExact({ id: "assay", version: "1.0.0" }))
      .toBe(assayDomainPack);
  });

  it("ranks validated resolution evidence and never silently selects low-confidence candidates", () => {
    const assayDescriptor: DomainPackDescriptor = {
      ...chemistryDescriptor,
      id: "assay",
      title: "Assay",
      artifactKinds: ["assay"],
      publicNamespaces: ["assaystudio"],
    };
    const registry = createStudioDomainPackRegistry([createPack(), createPack(assayDescriptor)]);
    const highConfidence = resolveDomainPackCandidates(registry, {
      signals: [
        { domainPackId: "assay", confidence: 0.92, reason: "Validated plate-coordinate evidence." },
        { domainPackId: "chemistry", confidence: 0.2, reason: "Weak chemistry term match." },
      ],
    });
    expect(highConfidence.selected?.descriptor.id).toBe("assay");
    expect(highConfidence.requiresConfirmation).toBe(false);
    expect(highConfidence.candidates.map(({ descriptor }) => descriptor.id)).toEqual(["assay", "chemistry"]);

    const lowConfidence = resolveDomainPackCandidates(registry, {
      signals: [{ domainPackId: "chemistry", confidence: 0.5, reason: "Ambiguous vocabulary." }],
    });
    expect(lowConfidence.selected).toBeUndefined();
    expect(lowConfidence.requiresConfirmation).toBe(true);
  });
});
