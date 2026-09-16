import { describe, expect, it } from "vitest";
import {
  chemistryActionCapabilitySources,
  chemistryInteractionCapabilitySources,
  chemistryModelCapabilitySources,
} from "../../../domain-packs/chemistry/capabilitySources";
import { chemistryDomainPack } from "../../../domain-packs/chemistry/chemistryPack";
import type { ProcedureIR } from "../../procedure-ir/types";
import goldenProcedureJson from "../../../domain-packs/chemistry/__fixtures__/chemistry-compose-procedure.v1.json";
import { runDomainPackConformance } from "../domainPackConformance";

const goldenProcedure = goldenProcedureJson as unknown as ProcedureIR;
const composeConstraints = {
  requiredOperationRefs: ["measureVolume", "observe", "calculate"],
  allowedOperationRefs: ["measureVolume", "observe", "calculate"],
  maximumSteps: 3,
};

const procedureWithOperation = (actionKey: string): ProcedureIR => {
  const procedure = structuredClone(goldenProcedure);
  procedure.id = `coverage-${actionKey}`;
  procedure.steps = [{
    ...procedure.steps[0],
    id: `step-${actionKey}`,
    dependencies: [],
    requestedFidelity: "F1",
    normalizedOperation: {
      ...procedure.steps[0].normalizedOperation!,
      actionKey,
    },
  }];
  procedure.controlFlow = {
    mode: "ordered",
    entryStepIds: [procedure.steps[0].id],
    completionStepIds: [procedure.steps[0].id],
    allowParallel: false,
  };
  return procedure;
};

describe("reusable domain-pack conformance runner", () => {
  it("passes the complete chemistry golden suite with deterministic positive and negative cases", () => {
    const unsupported = structuredClone(goldenProcedure);
    unsupported.steps[0].normalizedOperation!.actionKey = "teleportSample";
    const report = runDomainPackConformance(chemistryDomainPack, {
      validationContext: { includeReadiness: false, includePreview: true },
      runContext: { requestId: "conformance-run" },
      packageContext: {
        packageId: "conformance-package",
        createdAt: "2026-07-18T06:00:00.000Z",
      },
      composeCases: [
        {
          id: "golden-compose",
          request: { procedure: goldenProcedure, constraints: composeConstraints },
          expected: "success",
        },
        {
          id: "unsupported-operation",
          request: { procedure: unsupported, constraints: { requiredOperationRefs: [] } },
          expected: "failure",
          expectedGapCode: "chemistry.operation.unsupported",
        },
      ],
      invalidArtifactCases: [
        {
          id: "foreign-discriminator",
          artifact: { schema: "assay-studio.assay-definition", schemaVersion: "1.0" },
          expectedDiagnosticCode: "chemistry.artifact.kind.foreign-discriminator",
        },
        {
          id: "invalid-lab",
          artifact: { audience: "Learners", title: "Broken lab" },
          expectedDiagnosticCode: "chemistry.artifact.lab.invalid",
        },
      ],
    });

    expect(
      report.passed,
      JSON.stringify(report.assertions.filter(({ passed }) => !passed), null, 2),
    ).toBe(true);
    expect(report.assertions).toHaveLength(106);
    expect(report.assertions.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "descriptor.valid",
      "evidence.fragment.valid",
      "capabilities.fragment.valid",
      "compose.golden-compose.deterministic",
      "compose.unsupported-operation.failure",
      "artifact-negative.foreign-discriminator",
    ]));
  });

  it("covers every current action verb and every interaction/model capability through the pack", () => {
    chemistryActionCapabilitySources.forEach((action) => {
      const coverage = chemistryDomainPack.assessProcedure(procedureWithOperation(action), {
        requiredOperationRefs: [],
      });
      expect(coverage.classification, action).not.toBe("unsupported");
      expect(coverage.steps[0].capabilityRef, action).toBe(
        `chemistry:operation:action.${action}@1.0.0`,
      );
    });

    const fragment = chemistryDomainPack.getCapabilityManifestFragment();
    const interactions = fragment.entries
      .filter(({ ref }) => ref.kind === "interaction")
      .map(({ ref, claims }) => ({ id: ref.id.replace("interaction.", ""), fidelity: claims[0].maximumFidelity }));
    expect(interactions).toEqual(chemistryInteractionCapabilitySources.map((id) => ({ id, fidelity: "F2" })));
    const models = fragment.entries
      .filter(({ ref }) => ref.kind === "model")
      .map(({ ref, claims }) => ({ id: ref.id.replace("model.", ""), fidelity: claims[0].maximumFidelity }));
    expect(models).toEqual(chemistryModelCapabilitySources.map(({ id }) => ({ id, fidelity: "F3" })));
  });
});
