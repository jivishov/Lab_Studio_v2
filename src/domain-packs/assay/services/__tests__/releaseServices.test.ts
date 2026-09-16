import { describe, expect, it } from "vitest";
import { getAssayLayoutGoldenArtifact } from "../../__fixtures__/assay-layout.v1";
import {
  applyAssayCandidateTransaction,
  assayReleaseServices,
  compareAssayArtifacts,
  createAssayReleaseReport,
} from "../releaseServices";

describe("Cycle 12 assay release services", () => {
  it.each([
    "blank-96",
    "xtt-metabolic-activity",
    "educational-broth-microdilution",
  ] as const)("composes, validates, packages, and reports the bounded %s template", (templateId) => {
    const composition = assayReleaseServices.composeAssay({
      templateId,
      id: `test-${templateId}`,
      title: `Test ${templateId}`,
      updatedAt: "2026-07-26T23:45:00.000Z",
      package: {
        packageId: `test-${templateId}-package`,
        createdAt: "2026-07-26T23:45:00.000Z",
      },
    });
    expect(composition.ok).toBe(true);
    if (!composition.ok) return;
    const report = createAssayReleaseReport(composition.artifact, {
      packageId: `test-${templateId}-report`,
      createdAt: "2026-07-26T23:45:00.000Z",
    });
    expect(report.validation.ok).toBe(true);
    expect(report.decision).toBe("limited-release-candidate");
    expect(report.downloadableFiles.map(({ fileName }) => fileName)).toEqual([
      `${composition.artifact.id}.assay.json`,
      `${composition.artifact.id}.assay-package.json`,
      `${composition.artifact.id}.plate-map.csv`,
      `${composition.artifact.id}.release-limits.md`,
    ]);
  });

  it("applies only a valid same-id candidate at the compared version", () => {
    const current = getAssayLayoutGoldenArtifact();
    const candidate = structuredClone(current);
    candidate.title = "Reviewed title";
    expect(compareAssayArtifacts(current, candidate)).toMatchObject({
      compatible: true,
      changedSections: ["title"],
    });
    expect(applyAssayCandidateTransaction({
      current,
      candidate,
      expectedCurrentVersion: current.metadata.version,
    })).toMatchObject({
      ok: true,
      artifact: { title: "Reviewed title" },
    });
    expect(applyAssayCandidateTransaction({
      current,
      candidate,
      expectedCurrentVersion: "stale-version",
    })).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "assay.apply.version-conflict" })],
    });
  });
});
