import { describe, expect, it } from "vitest";
import {
  createAssayAssessmentFixture,
  createCausalystAssessmentPackage,
  createChemistryAssessmentFixture,
  parseCausalystAssessment,
  parseCausalystAssessmentImport,
  serializeCausalystAssessment,
  serializeCausalystAssessmentPackage,
  validateCausalystAssessment,
} from "..";

describe("Causalyst assessment definition v1", () => {
  it("validates and round-trips chemistry and assay assessment fixtures", () => {
    [createChemistryAssessmentFixture(), createAssayAssessmentFixture()].forEach((fixture) => {
      expect(validateCausalystAssessment(fixture)).toMatchObject({ ok: true });
      expect(parseCausalystAssessment(serializeCausalystAssessment(fixture))).toEqual(fixture);
    });
  });

  it("rejects version drift, missing artifacts, duplicate IDs, invalid selectors, and unsupported fidelity", () => {
    const fixture = createAssayAssessmentFixture();
    expect(validateCausalystAssessment({ ...fixture, schemaVersion: "2.0" })).toMatchObject({ ok: false });
    expect(validateCausalystAssessment({
      ...fixture,
      executableArtifact: { ...fixture.executableArtifact, artifact: {} },
    })).toMatchObject({ ok: false });
    expect(validateCausalystAssessment({
      ...fixture,
      rubric: {
        ...fixture.rubric,
        criteria: [...fixture.rubric.criteria, structuredClone(fixture.rubric.criteria[0])],
      },
    })).toMatchObject({ ok: false });
    expect(validateCausalystAssessment({
      ...fixture,
      authoringPolicy: { ...fixture.authoringPolicy, requiredFidelity: "F4" },
    })).toMatchObject({ ok: false });
  });

  it("packages deterministically and contains no local identity or final-grade field", () => {
    const fixture = createChemistryAssessmentFixture();
    const first = createCausalystAssessmentPackage(fixture, {
      packageId: "cycle13-chemistry",
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    const second = createCausalystAssessmentPackage(fixture, {
      packageId: "cycle13-chemistry",
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    const serialized = serializeCausalystAssessmentPackage(first);
    expect(first).toEqual(second);
    expect(serialized).not.toMatch(/studentId|learnerName|email|finalGrade|finalScore/);
    expect(parseCausalystAssessmentImport(serialized)).toEqual(fixture);
  });
});
