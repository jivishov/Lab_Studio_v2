import { describe, expect, it } from "vitest";
import procedureFixture from "../../../platform/procedure-ir/__fixtures__/valid-procedure-ir.v1.json";
import { validateCapabilityManifestFragment } from "../../../platform/capabilities/validation";
import { runDomainPackConformance } from "../../../platform/conformance/domainPackConformance";
import { coreEvidenceRegistryFragment } from "../../../platform/evidence/coreRegistry";
import { createEvidenceRegistry } from "../../../platform/evidence/registry";
import { validateResourceRunPlan } from "../../../platform/planning/schema";
import type { ProcedureIR } from "../../../platform/procedure-ir/types";
import { assayLayoutGoldenArtifact, getAssayLayoutGoldenArtifact } from "../__fixtures__/assay-layout.v1";
import {
  createCycle09AssayPlanningRequest,
  createCycle09PlanningArtifact,
} from "../planning/__fixtures__/cycle09PlanningFixture";
import { createCycle08QcAssayFixture } from "../qc/__fixtures__/cycle08QcFixture";
import {
  createCycle11MicAssay,
  createCycle11XttAssay,
} from "../profiles/__fixtures__/cycle11ProtocolFixtures";
import {
  assayDomainPack,
  assessProcedureThroughAssayPack,
} from "../assayPack";
import { getAssayCapabilityManifestFragment } from "../capabilityFragment";
import { getAssayEvidenceRegistryFragment } from "../evidenceRegistry";
import {
  validateAssayDefinitionSchema,
} from "../types/schema";
import {
  parseAssayDefinition,
  serializeAssayDefinition,
  validateAssayDefinition,
} from "../types/validation";

const assayProcedure = (): ProcedureIR => {
  const procedure = structuredClone(procedureFixture) as ProcedureIR;
  procedure.id = "assay-procedure-fixture";
  procedure.domainHint = "assay";
  procedure.reviewFlags = [];
  procedure.resources = [];
  procedure.variables = [];
  procedure.steps = procedure.steps.map((step, index) => ({
    ...step,
    normalizedOperation: {
      family: "assay",
      actionKey: index === 0 ? "recordNote" : "readPlate",
      actorRefs: [],
      inputRefs: [],
      outputRefs: [],
      parameters: {},
    },
    requestedFidelity: "F1",
    ambiguity: [],
    reviewFlags: [],
  }));
  return procedure;
};

describe("AssayDefinition v1", () => {
  it("validates the positive fixture and every public component through a canonical round trip", () => {
    const fixture = getAssayLayoutGoldenArtifact();
    expect(validateAssayDefinitionSchema(fixture).ok).toBe(true);
    const validation = validateAssayDefinition(fixture);
    expect(validation.ok, validation.ok ? "" : JSON.stringify(validation.diagnostics)).toBe(true);
    if (validation.ok) {
      expect(validation.diagnostics).toContainEqual(expect.objectContaining({
        code: "assay.protocol-profile.unassigned",
        severity: "warning",
      }));
      expect(validation.diagnostics).toContainEqual(expect.objectContaining({
        code: "assay.operations.representational-only",
        severity: "warning",
      }));
    }
    const serialized = serializeAssayDefinition(fixture);
    expect(parseAssayDefinition(serialized)).toEqual(fixture);
    expect(serializeAssayDefinition(parseAssayDefinition(serialized))).toBe(serialized);
  });

  it("rejects schema version drift, missing fields, unknown refs, over-capacity wells, and forbidden service data", () => {
    const wrongVersion = { ...getAssayLayoutGoldenArtifact(), schemaVersion: "2.0" };
    expect(validateAssayDefinitionSchema(wrongVersion).ok).toBe(false);

    const missing = getAssayLayoutGoldenArtifact() as unknown as Record<string, unknown>;
    delete missing.analysisPlan;
    expect(validateAssayDefinition(missing).ok).toBe(false);

    const unknownRef = getAssayLayoutGoldenArtifact();
    unknownRef.plate.wells[1].sampleRef = "missing-sample";
    const unknownRefResult = validateAssayDefinition(unknownRef);
    expect(unknownRefResult.ok).toBe(false);
    if (!unknownRefResult.ok) expect(unknownRefResult.diagnostics.some(({ code }) => code === "assay.well.sample-ref.missing")).toBe(true);

    const overflow = getAssayLayoutGoldenArtifact();
    overflow.plate.wells[1].expectedFinalVolume = { value: "301", unit: "uL" };
    expect(validateAssayDefinition(overflow).ok).toBe(false);

    const forbidden = getAssayLayoutGoldenArtifact() as unknown as Record<string, unknown>;
    forbidden.localPath = "C:\\private\\assay.json";
    const forbiddenResult = validateAssayDefinition(forbidden);
    expect(forbiddenResult.ok).toBe(false);
  });
});

describe("AssayDomainPack v1 honesty and conformance", () => {
  it("publishes Cycle 12 assay execution claims and a conservative release/export claim", () => {
    const fragment = getAssayCapabilityManifestFragment();
    const evidenceRegistry = createEvidenceRegistry([
      coreEvidenceRegistryFragment,
      getAssayEvidenceRegistryFragment(),
    ]);
    const validation = validateCapabilityManifestFragment(fragment, {
      evidenceTypeIds: evidenceRegistry.typeIds,
    });
    expect(validation.ok).toBe(true);
    expect(fragment.entries.flatMap(({ claims }) => claims.map(({ maximumFidelity }) => maximumFidelity)))
      .toEqual(["F1", "F0", "F2", "F2", "F2", "F2", "F2", "F2", "F2", "F2", "F3", "F3", "F2", "F3", "F3", "F3", "F1"]);
    expect(evidenceRegistry.get("assay.pipetting-operation")?.version).toBe("1.0.0");
    expect(evidenceRegistry.get("assay.qc-result")?.version).toBe("1.0.0");
    expect(evidenceRegistry.get("assay.assignment-change")?.version).toBe("1.0.0");
    expect(evidenceRegistry.get("assay.ingested-observation")?.version).toBe("1.0.0");

    const executableClaims = fragment.entries.flatMap((entry) => entry.claims
      .filter(({ maximumFidelity }) => maximumFidelity === "F2" || maximumFidelity === "F3")
      .map((claim) => ({ entry, claim })));
    expect(executableClaims).toHaveLength(14);
    const pipettingClaims = executableClaims.filter(({ entry }) =>
      entry.ref.id.startsWith("operation."));
    expect(pipettingClaims.every(({ claim }) =>
      claim.requiredEvidenceTypeIds.includes("assay.pipetting-operation")
      && claim.requiredAccessiblePathIds.includes("assay.accessible.pipetting-workbench"))).toBe(true);
    const assignment = fragment.entries.find(({ ref }) => ref.id === "interaction.control-replicate-assignment");
    expect(assignment?.claims[0]).toMatchObject({
      maximumFidelity: "F2",
      requiredEvidenceTypeIds: ["assay.assignment-change"],
      requiredAccessiblePathIds: ["assay.accessible.control-replicate-editor"],
    });
    const qc = fragment.entries.find(({ ref }) => ref.id === "model.profile-configurable-qc");
    expect(qc?.claims[0]).toMatchObject({ maximumFidelity: "F3" });
    expect(qc?.claims[0].requiredEvidenceTypeIds).toEqual([
      "assay.observation",
      "assay.qc-result",
      "assay.normalized-result",
      "assay.formula-trace",
    ]);
    expect(qc?.claims[0].validityRange).toEqual(expect.objectContaining({
      rules: expect.stringContaining("explicit source"),
      statistics: expect.stringContaining("Z-prime"),
    }));
    const dilution = fragment.entries.find(({ ref }) => ref.id === "model.exact-serial-dilution");
    expect(dilution?.claims[0]).toMatchObject({ maximumFidelity: "F3" });
    expect(dilution?.claims[0].validityRange).toEqual(expect.objectContaining({
      source: expect.stringContaining("mixed source"),
      mapping: expect.stringContaining("eight-channel"),
    }));
    expect(dilution?.claims[0].requiredAccessiblePathIds).toContain("assay.accessible.dilution-formula-table");
    const planning = fragment.entries.find(({ ref }) => ref.id === "planning.operational-run");
    expect(planning?.claims[0]).toMatchObject({
      maximumFidelity: "F3",
      requiredEvidenceTypeIds: ["run.plan"],
      requiredAccessiblePathIds: ["assay.accessible.operational-plan"],
    });
    expect(planning?.claims[0].validityRange).toEqual(expect.objectContaining({
      operationGraph: expect.stringContaining("accepted"),
      planningProfile: expect.stringContaining("explicit source"),
    }));
    const ingestion = fragment.entries.find(
      ({ ref }) => ref.id === "interaction.observation-ingestion",
    );
    expect(ingestion?.claims[0]).toMatchObject({
      maximumFidelity: "F2",
      requiredEvidenceTypeIds: ["assay.ingested-observation"],
      requiredAccessiblePathIds: ["assay.accessible.observation-import-review"],
    });
    expect(ingestion?.claims[0].validityRange).toEqual(expect.objectContaining({
      csv: expect.stringContaining("explicit delimiter"),
      review: expect.stringContaining("accepted, corrected, or rejected"),
    }));
    const xtt = fragment.entries.find(({ ref }) => ref.id === "model.xtt-metabolic-activity");
    expect(xtt?.claims[0]).toMatchObject({
      maximumFidelity: "F3",
      requiredAccessiblePathIds: ["assay.accessible.protocol-analysis"],
    });
    const mic = fragment.entries.find(({ ref }) => ref.id === "model.broth-microdilution-endpoint");
    expect(mic?.claims[0]).toMatchObject({ maximumFidelity: "F3" });
    const release = fragment.entries.find(({ ref }) => ref.id === "export.release-review-package");
    expect(release?.claims[0]).toMatchObject({
      maximumFidelity: "F1",
      requiredEvidenceTypeIds: [],
      requiredAccessiblePathIds: ["assay.accessible.release-review"],
    });
    expect(JSON.stringify([xtt, mic])).not.toMatch(/susceptibilityCategory|treatmentAdvice/);
    expect(JSON.stringify(fragment)).not.toMatch(/waitFor|readPlate|clinical QC capability/i);
  });

  it("rejects promoted pipetting and dilution claims when a required honesty proof is removed", () => {
    const evidenceRegistry = createEvidenceRegistry([
      coreEvidenceRegistryFragment,
      getAssayEvidenceRegistryFragment(),
    ]);
    const missingRuntime = getAssayCapabilityManifestFragment();
    const pipetting = missingRuntime.entries.find(({ ref }) => ref.id === "operation.aspirate")!;
    pipetting.claims[0].proofRefs = pipetting.claims[0].proofRefs.filter(({ kind }) => kind !== "runtime-handler");
    const runtimeValidation = validateCapabilityManifestFragment(missingRuntime, {
      evidenceTypeIds: evidenceRegistry.typeIds,
    });
    expect(runtimeValidation.ok).toBe(false);
    if (!runtimeValidation.ok) expect(runtimeValidation.diagnostics.map(({ code }) => code))
      .toContain("capability.claim.f2.runtime-proof-missing");

    const missingModel = getAssayCapabilityManifestFragment();
    const dilution = missingModel.entries.find(({ ref }) => ref.id === "model.exact-serial-dilution")!;
    dilution.claims[0].proofRefs = dilution.claims[0].proofRefs.filter(({ kind }) => kind !== "deterministic-model");
    const modelValidation = validateCapabilityManifestFragment(missingModel, {
      evidenceTypeIds: evidenceRegistry.typeIds,
    });
    expect(modelValidation.ok).toBe(false);
    if (!modelValidation.ok) expect(modelValidation.diagnostics.map(({ code }) => code))
      .toContain("capability.claim.f3.model-proof-missing");

    const missingAssignmentEvidence = getAssayCapabilityManifestFragment();
    const assignment = missingAssignmentEvidence.entries.find(
      ({ ref }) => ref.id === "interaction.control-replicate-assignment",
    )!;
    assignment.claims[0].proofRefs = assignment.claims[0].proofRefs.filter(
      ({ kind }) => kind !== "evidence-producer",
    );
    const assignmentValidation = validateCapabilityManifestFragment(missingAssignmentEvidence, {
      evidenceTypeIds: evidenceRegistry.typeIds,
    });
    expect(assignmentValidation.ok).toBe(false);
    if (!assignmentValidation.ok) expect(assignmentValidation.diagnostics.map(({ code }) => code))
      .toContain("capability.claim.f2.evidence-proof-missing");

    const missingQcModel = getAssayCapabilityManifestFragment();
    const qc = missingQcModel.entries.find(({ ref }) => ref.id === "model.profile-configurable-qc")!;
    qc.claims[0].proofRefs = qc.claims[0].proofRefs.filter(({ kind }) => kind !== "deterministic-model");
    const qcValidation = validateCapabilityManifestFragment(missingQcModel, {
      evidenceTypeIds: evidenceRegistry.typeIds,
    });
    expect(qcValidation.ok).toBe(false);
    if (!qcValidation.ok) expect(qcValidation.diagnostics.map(({ code }) => code))
      .toContain("capability.claim.f3.model-proof-missing");

    const missingPlanningModel = getAssayCapabilityManifestFragment();
    const planning = missingPlanningModel.entries.find(
      ({ ref }) => ref.id === "planning.operational-run",
    )!;
    planning.claims[0].proofRefs = planning.claims[0].proofRefs.filter(
      ({ kind }) => kind !== "deterministic-model",
    );
    const planningValidation = validateCapabilityManifestFragment(missingPlanningModel, {
      evidenceTypeIds: evidenceRegistry.typeIds,
    });
    expect(planningValidation.ok).toBe(false);
    if (!planningValidation.ok) expect(planningValidation.diagnostics.map(({ code }) => code))
      .toContain("capability.claim.f3.model-proof-missing");

    const missingIngestionReview = getAssayCapabilityManifestFragment();
    const ingestion = missingIngestionReview.entries.find(
      ({ ref }) => ref.id === "interaction.observation-ingestion",
    )!;
    ingestion.claims[0].proofRefs = ingestion.claims[0].proofRefs.filter(
      ({ kind }) => kind !== "accessible-path",
    );
    const ingestionValidation = validateCapabilityManifestFragment(missingIngestionReview, {
      evidenceTypeIds: evidenceRegistry.typeIds,
    });
    expect(ingestionValidation.ok).toBe(false);
    if (!ingestionValidation.ok) expect(ingestionValidation.diagnostics.map(({ code }) => code))
      .toContain("capability.claim.f2.accessible-proof-missing");
  });

  it("classifies recognized operations as representable and never executable", () => {
    const coverage = assessProcedureThroughAssayPack(assayProcedure(), { requiredOperationRefs: [] });
    expect(coverage.classification).toBe("representable");
    expect(coverage.steps.every(({ supportedFidelity }) => supportedFidelity === "F1")).toBe(true);
    expect(coverage.gaps.every(({ code }) => code === "assay.operation.representational-only")).toBe(true);
    const composed = assayDomainPack.composeArtifact({
      procedure: assayProcedure(),
      constraints: { requiredOperationRefs: [] },
    });
    expect(composed.ok).toBe(false);
    if (!composed.ok) expect(composed.gaps.some(({ code }) => code === "assay.compose.execution-deferred")).toBe(true);
  });

  it("plans through the explicit Cycle 09 service and remains incomplete without its extension", () => {
    const artifact = createCycle09PlanningArtifact();
    const request = createCycle09AssayPlanningRequest();
    const planned = assayDomainPack.planRun(artifact, {
      requestId: "assay-plan-request",
      extension: request,
    });
    expect(planned.extension?.status).toBe("complete");
    expect(validateResourceRunPlan(planned.extension?.plan).ok).toBe(true);
    expect(planned.extension?.plan.requirements.length).toBeGreaterThan(0);

    const missing = assayDomainPack.planRun(artifact, {
      requestId: "assay-plan-missing",
    });
    expect(missing.extension?.status).toBe("incomplete");
    expect(missing.extension?.diagnostics).toContainEqual(expect.objectContaining({
      code: "assay.planning.request.missing",
    }));
  });

  it("passes the applicable reusable domain-pack conformance assertions", () => {
    const invalidArtifact = getAssayLayoutGoldenArtifact() as unknown as Record<string, unknown>;
    delete invalidArtifact.schema;
    const report = runDomainPackConformance(assayDomainPack, {
      validationContext: { require96Well: true },
      runContext: { requestId: "assay-conformance-plan" },
      packageContext: {
        packageId: "assay-conformance-package",
        createdAt: "2026-07-19T00:00:00.000Z",
        capabilityManifestVersion: "2.0",
      },
      composeCases: [{
        id: "execution-deferred",
        request: { procedure: assayProcedure(), constraints: { requiredOperationRefs: [] } },
        expected: "failure",
        expectedGapCode: "assay.compose.execution-deferred",
      }],
      invalidArtifactCases: [{
        id: "missing-schema",
        artifact: invalidArtifact,
        expectedDiagnosticCode: "schema.required",
      }],
    });
    expect(report.passed, report.assertions.filter(({ passed }) => !passed).map(({ id, message }) => `${id}: ${message}`).join("\n"))
      .toBe(true);
    expect(report.assertions).toHaveLength(47);
    expect(assayDomainPack.conformance.getGoldenArtifact(assayLayoutGoldenArtifact.id)).toEqual(assayLayoutGoldenArtifact);
    const qcGolden = createCycle08QcAssayFixture();
    expect(assayDomainPack.conformance.getGoldenArtifact(qcGolden.id)).toEqual(qcGolden);
    const planningGolden = createCycle09PlanningArtifact();
    expect(assayDomainPack.conformance.getGoldenArtifact(planningGolden.id))
      .toEqual(planningGolden);
    const xttGolden = createCycle11XttAssay();
    expect(assayDomainPack.conformance.getGoldenArtifact(xttGolden.id)).toEqual(xttGolden);
    const micGolden = createCycle11MicAssay();
    expect(assayDomainPack.conformance.getGoldenArtifact(micGolden.id)).toEqual(micGolden);
  });
});
