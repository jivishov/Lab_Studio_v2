import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LabDefinition, TechniqueDefinition } from "../../../domain/types";
import { validateLabDefinition, validateTechniqueDefinition } from "../../../domain/validation";
import type { ProcedureIR } from "../../../platform/procedure-ir/types";
import { validateProcedureIR } from "../../../platform/procedure-ir/validation";
import { createRuntimeState } from "../../../runtime/createRuntime";
import { runStudioPreviewCheck } from "../../../studio/studioPreviewCheck";
import goldenProcedureJson from "../__fixtures__/chemistry-compose-procedure.v1.json";
import { detectChemistryArtifactKind } from "../artifactKind";
import { chemistryDomainPack } from "../chemistryPack";

const loadIndex = (folder: "labs" | "techniques") => JSON.parse(readFileSync(
  join(process.cwd(), "public", folder, "index.json"),
  "utf8",
)) as Array<{ id: string; file: string }>;

const loadArtifact = <T>(folder: "labs" | "techniques", file: string): T => JSON.parse(readFileSync(
  join(process.cwd(), "public", folder, file),
  "utf8",
)) as T;

const publicLabs = (): LabDefinition[] => loadIndex("labs").map(({ file }) =>
  loadArtifact<LabDefinition>("labs", file));
const publicTechniques = (): TechniqueDefinition[] => loadIndex("techniques").map(({ file }) =>
  loadArtifact<TechniqueDefinition>("techniques", file));
const goldenProcedure = goldenProcedureJson as unknown as ProcedureIR;
const constraints = {
  requiredOperationRefs: ["measureVolume", "observe", "calculate"],
  allowedOperationRefs: ["measureVolume", "observe", "calculate"],
  maximumSteps: 3,
};

describe("ChemistryDomainPack", () => {
  it("detects legacy artifact kinds and returns focused discriminator diagnostics", () => {
    expect(detectChemistryArtifactKind(publicLabs()[0])).toEqual({ ok: true, kind: "LabDefinition" });
    expect(detectChemistryArtifactKind(publicTechniques()[0])).toEqual({ ok: true, kind: "TechniqueDefinition" });
    expect(detectChemistryArtifactKind(null)).toMatchObject({
      ok: false,
      diagnostic: { code: "chemistry.artifact.kind.not-object", path: "/" },
    });
    expect(detectChemistryArtifactKind({ schema: "assay-studio.assay-definition", schemaVersion: "1.0" }))
      .toMatchObject({
        ok: false,
        diagnostic: { code: "chemistry.artifact.kind.foreign-discriminator", path: "/schema" },
      });
    expect(detectChemistryArtifactKind({ audience: "Learners", learningGoal: "Conflicting" }))
      .toMatchObject({ ok: false, diagnostic: { code: "chemistry.artifact.kind.ambiguous" } });
    expect(detectChemistryArtifactKind({
      schema: "lab-studio.lab-definition",
      schemaVersion: "2.0",
      audience: "Learners",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: "chemistry.artifact.kind.version-unsupported", path: "/schemaVersion" },
    });
    expect(detectChemistryArtifactKind({
      schema: "lab-studio.lab-definition",
      schemaVersion: "1.0",
      learningGoal: "Conflicting",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: "chemistry.artifact.kind.conflicting-discriminator" },
    });
    expect(detectChemistryArtifactKind({ id: "unknown" })).toMatchObject({
      ok: false,
      diagnostic: { code: "chemistry.artifact.kind.missing" },
    });
  });

  it("validates every published lab and technique with direct-call parity", () => {
    const labs = publicLabs();
    const techniques = publicTechniques();
    expect(labs).toHaveLength(6);
    expect(techniques).toHaveLength(21);

    labs.forEach((lab) => {
      const direct = validateLabDefinition(lab);
      const throughPack = chemistryDomainPack.validateArtifact(lab, {
        includeReadiness: false,
        includePreview: false,
      });
      expect(throughPack.ok, lab.id).toBe(direct.ok);
      expect(throughPack.diagnostics.filter(({ severity }) => severity === "error"), lab.id).toEqual([]);
    });
    techniques.forEach((technique) => {
      const direct = validateTechniqueDefinition(technique);
      const throughPack = chemistryDomainPack.validateArtifact(technique, {
        includeReadiness: false,
        includePreview: false,
      });
      expect(throughPack.ok, technique.id).toBe(direct.ok);
      expect(throughPack.diagnostics.filter(({ severity }) => severity === "error"), technique.id).toEqual([]);
    });

    const broken = { ...labs[0], title: "" };
    const directBroken = validateLabDefinition(broken);
    const packBroken = chemistryDomainPack.validateArtifact(broken, {});
    expect(packBroken.ok).toBe(false);
    expect(packBroken.diagnostics.map(({ message }) => message)).toEqual(directBroken.errors);
  });

  it("matches current readiness and preview initialization for representative artifacts", () => {
    const lab = publicLabs().find(({ id }) => id === "intro-filtration-demo") ?? publicLabs()[0];
    const directPreview = runStudioPreviewCheck(lab);
    const packPreview = chemistryDomainPack.validateArtifact(lab, {
      includeReadiness: true,
      includePreview: true,
    });
    expect(packPreview.ok).toBe(true);
    if (!packPreview.ok) return;
    expect(packPreview.preview).toEqual(directPreview);
    expect(packPreview.readiness).toEqual(directPreview.readiness);

    const technique = publicTechniques().find(({ id }) => id === "filtration") ?? publicTechniques()[0];
    const state = createRuntimeState(technique);
    const packTechnique = chemistryDomainPack.validateArtifact(technique, {
      includePreview: true,
    });
    expect(packTechnique.ok).toBe(true);
    expect(state.currentNodeId).toBe(technique.process.startNodeId);
  });

  it("assesses and composes the golden ProcedureIR deterministically from current blueprints", () => {
    expect(validateProcedureIR(goldenProcedure).ok).toBe(true);
    const coverage = chemistryDomainPack.assessProcedure(goldenProcedure, constraints);
    expect(coverage).toMatchObject({ classification: "runnable", gaps: [] });
    expect(coverage.steps.map(({ blueprintId }) => blueprintId)).toEqual([
      "template-volume",
      "template-observe",
      "template-calc",
    ]);
    expect(coverage.steps.map(({ supportedFidelity }) => supportedFidelity)).toEqual(["F2", "F2", "F3"]);

    const first = chemistryDomainPack.composeArtifact({ procedure: goldenProcedure, constraints });
    const second = chemistryDomainPack.composeArtifact({ procedure: goldenProcedure, constraints });
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.artifact.id).toBe(goldenProcedure.id);
    expect(first.artifact.actions.map(({ label }) => label)).toEqual([
      "Measure sample",
      "Observe sample",
      "Calculate hardness",
    ]);
    expect(first.artifact.process.nodes.map(({ description }) => description)).toEqual(
      goldenProcedure.steps.map(({ instruction }) => instruction),
    );
    expect(validateLabDefinition(first.artifact).ok).toBe(true);
    expect(runStudioPreviewCheck(first.artifact).runnable).toBe(true);
  });

  it("distinguishes representable actions from unsupported operations and constraint failures", () => {
    const representable = structuredClone(goldenProcedure);
    representable.steps[0].normalizedOperation!.actionKey = "transfer";
    const representableCoverage = chemistryDomainPack.assessProcedure(representable, {
      requiredOperationRefs: [],
    });
    expect(representableCoverage.classification).toBe("representable");
    expect(representableCoverage.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "chemistry.operation.representable-only" }),
    ]));

    const unsupported = structuredClone(goldenProcedure);
    unsupported.steps[0].normalizedOperation!.actionKey = "teleportSample";
    const unsupportedCoverage = chemistryDomainPack.assessProcedure(unsupported, {
      requiredOperationRefs: [],
    });
    expect(unsupportedCoverage.classification).toBe("unsupported");
    expect(unsupportedCoverage.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "chemistry.operation.unsupported" }),
    ]));

    const constrained = chemistryDomainPack.composeArtifact({
      procedure: goldenProcedure,
      constraints: { requiredOperationRefs: ["filter"] },
    });
    expect(constrained).toMatchObject({
      ok: false,
      gaps: expect.arrayContaining([
        expect.objectContaining({ code: "chemistry.constraints.required-operation-missing" }),
      ]),
    });

    const calibrated = structuredClone(goldenProcedure);
    calibrated.steps[2].requestedFidelity = "F4";
    const calibratedCoverage = chemistryDomainPack.assessProcedure(calibrated, {
      requiredOperationRefs: [],
    });
    expect(calibratedCoverage.classification).toBe("representable");
    expect(calibratedCoverage.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "chemistry.fidelity.f4-calibration-unavailable" }),
    ]));

    const inaccessible = structuredClone(goldenProcedure);
    inaccessible.steps[0].accessibilityRequirements = ["neural-interface"];
    expect(chemistryDomainPack.assessProcedure(inaccessible, { requiredOperationRefs: [] }))
      .toMatchObject({
        classification: "unsupported",
        gaps: expect.arrayContaining([
          expect.objectContaining({ code: "chemistry.accessibility.unsupported" }),
        ]),
      });
  });

  it("packages sanitized artifacts without changing current chemistry export behavior", () => {
    const lab = publicLabs()[0];
    const unsafe = {
      ...lab,
      metadata: {
        ...lab.metadata,
        fileId: "file-private-provider-handle",
        localPath: "C:\\private\\teacher-source.json",
        sha256: "a".repeat(64),
      },
      actions: lab.actions.map((action, index) => index === 0
        ? { ...action, parameters: { ...action.parameters, safeValue: "preserved" } }
        : action),
    } as LabDefinition;
    const report = chemistryDomainPack.validateArtifact(unsafe, {
      includeReadiness: false,
      includePreview: false,
    });
    expect(report.ok).toBe(true);
    expect(report.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "chemistry.artifact.sanitized-field", severity: "warning" }),
    ]));

    const packaged = chemistryDomainPack.packageArtifact(unsafe, {
      packageId: "package-golden",
      createdAt: "2026-07-18T04:00:00.000Z",
    });
    const serialized = JSON.stringify(packaged);
    expect(serialized).not.toContain("teacher-source.json");
    expect(serialized).not.toContain("file-private-provider-handle");
    expect(serialized).not.toContain("\"sha256\"");
    expect(serialized).toContain("safeValue");
    expect(packaged.artifact).toEqual(report.ok ? report.artifact : undefined);
  });

  it("uses the shared deterministic planner and reports missing metadata explicitly", () => {
    const artifact = publicLabs().find(({ id }) => id === "intro-filtration-demo")!;
    const context = {
      requestId: "cycle-05-plan",
      participants: 12,
      grouping: { kind: "group-size" as const, groupSize: 3 },
      sections: [{ id: "section-a", participantCount: 12 }],
      repeats: 1,
      technicalReplicates: 1,
      stations: [],
      availableInventory: [],
      instrumentCapacities: [],
    };
    const plan = chemistryDomainPack.planRun(artifact, { requestId: context.requestId, extension: context });
    expect(plan).toMatchObject({
      schema: "studio.run-plan",
      schemaVersion: "1.0",
      domainPackId: "chemistry",
      extension: {
        status: "complete",
        artifactId: artifact.id,
        plan: {
          schema: "studio.resource-run-plan",
          status: "complete",
          contextSummary: { groupCount: 4 },
        },
      },
    });
    expect(plan.extension?.plan.requirements.length).toBeGreaterThan(10);

    const incomplete = chemistryDomainPack.planRun(publicTechniques()[0], {
      requestId: "cycle-05-incomplete",
      extension: { ...context, requestId: "cycle-05-incomplete" },
    });
    expect(incomplete.extension?.status).toBe("incomplete");
    expect(incomplete.extension?.plan.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "chemistry.planning.artifact-metadata-incomplete" }),
    ]));
  });
});
