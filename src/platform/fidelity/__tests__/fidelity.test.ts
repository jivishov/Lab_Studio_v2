import { describe, expect, it } from "vitest";
import { classifyAggregateSupport, compareFidelity } from "../comparison";
import { fidelityAssessmentSchema, validateFidelityAssessment } from "../schema";
import type { ClaimSupportAssessment, FidelityLimitation } from "../types";

const limitation = (id: string): FidelityLimitation => ({
  id,
  kind: "scope",
  code: "scope.limit",
  message: "Declared scope limitation.",
  appliesToRef: id,
});

const claim = (
  claimId: string,
  requestedFidelity: ClaimSupportAssessment["requestedFidelity"],
  supportedFidelity: ClaimSupportAssessment["supportedFidelity"],
  options: Partial<ClaimSupportAssessment> = {},
): ClaimSupportAssessment => ({
  claimId,
  outcome: `Outcome ${claimId}`,
  essential: true,
  quantitative: requestedFidelity === "F3" || requestedFidelity === "F4",
  requestedFidelity,
  supportedFidelity,
  missingRequirements: [],
  limitations: [limitation(claimId)],
  ...options,
});

describe("F0-F4 fidelity comparison and aggregate support", () => {
  it("compares every requested/supported level deterministically", () => {
    expect(compareFidelity("F0", "F0").status).toBe("meets");
    expect(compareFidelity("F2", "F1").status).toBe("representable-only");
    expect(compareFidelity("F4", "F3").status).toBe("insufficient");
    expect(compareFidelity("F2", "F4").meetsRequest).toBe(true);
  });

  it("classifies mixed essential claims from the weakest essential outcome", () => {
    expect(classifyAggregateSupport([
      claim("interactive", "F2", "F2"),
      claim("quantitative", "F3", "F3"),
      claim("optional-note", "F2", "F0", { essential: false }),
    ]).classification).toBe("runnable");
    expect(classifyAggregateSupport([
      claim("interactive", "F2", "F1"),
      claim("quantitative", "F3", "F3"),
    ]).classification).toBe("representable");
    expect(classifyAggregateSupport([
      claim("interactive", "F2", "F2", { missingRequirements: ["accessible-path"] }),
    ]).classification).toBe("unsupported");
  });

  it("validates, versions, and JSON-round-trips the public assessment schema", () => {
    const assessment = classifyAggregateSupport([claim("quantitative", "F3", "F3")]);
    expect(fidelityAssessmentSchema.$id).toBe("https://lab-studio.local/schemas/studio.fidelity-assessment/1.0");
    expect(validateFidelityAssessment(assessment)).toMatchObject({ ok: true });
    expect(validateFidelityAssessment(JSON.parse(JSON.stringify(assessment)))).toEqual({
      ok: true,
      value: assessment,
      diagnostics: [],
    });
    expect(validateFidelityAssessment({ ...assessment, schemaVersion: "2.0" })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ path: "/schemaVersion" })]),
    });
    expect(validateFidelityAssessment({ ...assessment, classification: "supported" })).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ path: "/classification" })]),
    });
  });
});
