import { describe, expect, it } from "vitest";
import { createChemistryAssessmentFixture } from "../../domain";
import { buildManualCandidate } from "../orchestrator";

describe("Cycle 14 prompt boundary", () => {
  it("rejects executable/provider fields before deterministic compilation", () => {
    const result = buildManualCandidate(createChemistryAssessmentFixture(), {
      metadata: { createdBy: "host-model" },
      executableArtifact: { providerFileId: "file-secret" },
    }, { revisionNumber: 1, createdAt: "2026-07-26T00:00:00.000Z" });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some(({ code }) => code.includes("forbidden"))).toBe(true);
  });
});
