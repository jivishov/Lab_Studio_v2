import { describe, expect, it } from "vitest";
import { validateEvidenceBundle, validateRunTrace } from "../../../../platform/evidence";
import { getCycle08QcGoldenFixture } from "../../qc/__fixtures__/cycle08QcFixture";
import { assembleAssayEvidence, createAssayEvidenceRegistry } from "../assembly";
import {
  ASSAY_ENDPOINT_CANDIDATE_EVIDENCE,
  ASSAY_FORMULA_TRACE_EVIDENCE,
  ASSAY_MANUAL_CORRECTION_EVIDENCE,
  ASSAY_NORMALIZED_RESULT_EVIDENCE,
  ASSAY_OBSERVATION_EVIDENCE,
  ASSAY_QC_RESULT_EVIDENCE,
} from "../descriptors";

describe("Cycle 08 assay evidence and semantic trace", () => {
  const assembleGolden = () => {
    const fixture = getCycle08QcGoldenFixture();
    return assembleAssayEvidence({
      bundleId: "cycle08-evidence-bundle",
      traceId: "cycle08-semantic-trace",
      runId: "cycle08-qc-run",
      startedAt: "2026-07-26T20:30:00.000Z",
      completedAt: "2026-07-26T20:32:00.000Z",
      observationSet: fixture.observationSet,
      qcEvaluation: fixture.evaluation,
    });
  };

  it("registers every Cycle 08 evidence schema and keeps endpoint candidates explicit-only", () => {
    const registry = createAssayEvidenceRegistry();
    [
      ASSAY_OBSERVATION_EVIDENCE,
      ASSAY_MANUAL_CORRECTION_EVIDENCE,
      ASSAY_QC_RESULT_EVIDENCE,
      ASSAY_NORMALIZED_RESULT_EVIDENCE,
      ASSAY_FORMULA_TRACE_EVIDENCE,
      ASSAY_ENDPOINT_CANDIDATE_EVIDENCE,
    ].forEach((typeId) => expect(registry.get(typeId, "1.0.0")).toBeDefined());
    const assembled = assembleGolden();
    expect(assembled.bundle.records.some(({ typeId }) => typeId === ASSAY_ENDPOINT_CANDIDATE_EVIDENCE))
      .toBe(false);
  });

  it("assembles deterministic schema-valid evidence and ordered semantic events", () => {
    const first = assembleGolden();
    const second = assembleGolden();
    expect(first.bundle).toEqual(second.bundle);
    expect(first.trace).toEqual(second.trace);
    expect(validateEvidenceBundle(first.bundle, first.registry).ok).toBe(true);
    expect(validateRunTrace(first.trace, first.registry, first.bundle).ok).toBe(true);
    expect(first.trace.events.map(({ sequence }) => sequence))
      .toEqual(first.trace.events.map((_, index) => index + 1));
    expect(first.trace.events.every(({ evidenceRefs }) => evidenceRefs.length === 1)).toBe(true);
    const evidenceIds = new Set(first.bundle.records.map(({ evidenceId }) => evidenceId));
    first.bundle.records.filter(({ typeId }) => typeId === ASSAY_QC_RESULT_EVIDENCE)
      .forEach(({ payload }) => {
        (payload.formulaTraceRefs as string[]).forEach((traceRef) => expect(evidenceIds.has(traceRef)).toBe(true));
      });
  });

  it("preserves manual before/after provenance and rejects forbidden provider/runtime data", () => {
    const assembled = assembleGolden();
    const correction = assembled.bundle.records.find(
      ({ typeId }) => typeId === ASSAY_MANUAL_CORRECTION_EVIDENCE,
    )!;
    expect(correction.payload).toEqual(expect.objectContaining({
      previousValue: "0.524",
      acceptedValue: "0.525",
      actorRole: "fixture-author",
    }));
    expect(assembled.registry.validatePayload(
      ASSAY_QC_RESULT_EVIDENCE,
      "1.0.0",
      { ...(assembled.bundle.records.find(({ typeId }) => typeId === ASSAY_QC_RESULT_EVIDENCE)!.payload), providerFileId: "file-secret-value" },
    ).ok).toBe(false);
  });
});
