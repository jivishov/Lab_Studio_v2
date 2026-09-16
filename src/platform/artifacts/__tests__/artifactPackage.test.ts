import { describe, expect, it } from "vitest";
import { demoLab } from "../../../domain/fixtures";
import { planChemistryClassRun } from "../../../domain-packs/chemistry/planning/chemistryPlanner";
import { createStudioArtifactPackage, roundTripStudioArtifactPackage } from "../builder";
import { serializeArtifactPackage } from "../canonical";
import { validateStudioArtifactPackage } from "../schema";
import { findForbiddenArtifactData } from "../security";

const context = {
  requestId: "artifact-plan",
  participants: 8,
  grouping: { kind: "group-size" as const, groupSize: 2 },
  sections: [{ id: "section-a", participantCount: 8 }],
  repeats: 1,
  technicalReplicates: 1,
  stations: [],
  availableInventory: [],
  instrumentCapacities: [],
};

describe("shared Studio artifact package", () => {
  it("serializes deterministically, validates, round-trips, and exports CSV/checklist files", () => {
    const plan = planChemistryClassRun(demoLab, context, "artifact-plan").plan;
    const input = {
      packageId: "artifact-package-golden",
      createdAt: "2026-07-18T08:00:00.000Z",
      domainPack: { id: "chemistry" as const, version: "1.0.0" },
      capabilityManifestVersion: "2.0",
      artifactKind: "LabDefinition",
      artifactTitle: demoLab.title,
      artifactVersion: demoLab.metadata.version,
      artifactFileName: "intro-filtration-demo.lab.json",
      artifact: demoLab,
      validation: { ok: true, diagnostics: [] },
      runPlan: plan,
      assumptions: ["Reviewed representative chemistry planning profile."],
      limitations: ["Human safety review remains required."],
    };
    const first = createStudioArtifactPackage(input);
    const second = createStudioArtifactPackage(structuredClone(input));
    expect(serializeArtifactPackage(first)).toBe(serializeArtifactPackage(second));
    expect(validateStudioArtifactPackage(first).ok).toBe(true);
    expect(roundTripStudioArtifactPackage(first)).toEqual(first);
    expect(first.files.map(({ role }) => role)).toEqual([
      "artifact", "requirements-csv", "preparation-checklist",
    ]);
    expect(first.files.find(({ role }) => role === "requirements-csv")?.content).toContain("normalized_value");
    expect(first.files.find(({ role }) => role === "preparation-checklist")?.content).toContain("## Cleanup and reset");
    expect(first.files.every(({ byteLength, content }) => byteLength === new TextEncoder().encode(content).byteLength)).toBe(true);
  });

  it("rejects descriptor mismatches, unsafe filenames, and forbidden provider/runtime data", () => {
    const base = createStudioArtifactPackage({
      packageId: "safe-package",
      createdAt: "2026-07-18T08:00:00.000Z",
      domainPack: { id: "chemistry", version: "1.0.0" },
      capabilityManifestVersion: "2.0",
      artifactKind: "LabDefinition",
      artifactTitle: demoLab.title,
      artifactVersion: demoLab.metadata.version,
      artifactFileName: "safe.lab.json",
      artifact: demoLab,
      validation: { ok: true, diagnostics: [] },
    });
    expect(validateStudioArtifactPackage({
      ...base,
      artifactDescriptor: { ...base.artifactDescriptor, artifactId: "different" },
    }).ok).toBe(false);
    expect(() => createStudioArtifactPackage({
      packageId: "unsafe-name",
      createdAt: "2026-07-18T08:00:00.000Z",
      domainPack: { id: "chemistry", version: "1.0.0" },
      capabilityManifestVersion: "2.0",
      artifactKind: "LabDefinition",
      artifactTitle: "Unsafe",
      artifactVersion: "1.0",
      artifactFileName: "../unsafe.json",
      artifact: { id: "unsafe", localPath: "C:\\private\\artifact.json" },
      validation: { ok: true, diagnostics: [] },
    })).toThrow();
    expect(findForbiddenArtifactData({ id: "unsafe", providerFileId: "file-provider-secret", sha256: "a".repeat(64) }).length).toBeGreaterThan(0);
  });
});
