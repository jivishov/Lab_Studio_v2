import { createServer } from "vite";

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const domain = await server.ssrLoadModule("/src/causalyst/domain/index.ts");
  const rubric = await server.ssrLoadModule("/src/causalyst/rubric/index.ts");
  const fixtures = [
    domain.createChemistryAssessmentFixture(),
    domain.createAssayAssessmentFixture(),
  ];
  for (const fixture of fixtures) {
    const validation = domain.validateCausalystAssessment(fixture);
    if (!validation.ok) throw new Error(JSON.stringify(validation.diagnostics));
    const serialized = domain.serializeCausalystAssessment(fixture);
    if (domain.serializeCausalystAssessment(domain.parseCausalystAssessment(serialized)) !== serialized) {
      throw new Error(`Assessment ${fixture.id} failed canonical round trip.`);
    }
    const first = domain.createCausalystAssessmentPackage(fixture, {
      packageId: `${fixture.id}:package`,
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    const second = domain.createCausalystAssessmentPackage(fixture, {
      packageId: `${fixture.id}:package`,
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    if (domain.serializeCausalystAssessmentPackage(first) !== domain.serializeCausalystAssessmentPackage(second)) {
      throw new Error(`Assessment package ${fixture.id} is not deterministic.`);
    }
    if (domain.serializeCausalystAssessment(domain.parseCausalystAssessmentImport(
      domain.serializeCausalystAssessmentPackage(first),
    )) !== domain.serializeCausalystAssessment(fixture)) {
      throw new Error(`Assessment package ${fixture.id} did not reopen canonically.`);
    }
    const text = domain.serializeCausalystAssessmentPackage(first);
    if (/studentId|learnerName|emailAddress|finalGrade|providerFileId|localFilePath|clinicalBreakpoint|susceptibilityCategory/.test(text)) {
      throw new Error(`Forbidden field found in ${fixture.id}.`);
    }
  }
  const fixture = fixtures[0];
  const evidenceBundle = {
    schema: "studio.evidence-bundle",
    schemaVersion: "1.0",
    bundleId: "cycle13-lint",
    registryVersion: "1.0.0",
    createdAt: "2026-07-26T00:00:00.000Z",
    records: [{
      evidenceId: "validation-1",
      typeId: "artifact.validation",
      typeVersion: "1.0.0",
      occurredAt: "2026-07-26T00:00:00.000Z",
      producerId: "studio.validation",
      summary: "Artifact valid.",
      metadata: {
        retentionClass: "submission",
        sensitivity: "none",
        accessibleRepresentation: "text",
        redactionPolicyId: "core.artifact.validation.allowlist-v1",
      },
      payload: { artifactId: fixture.executableArtifact.artifactRef.id, valid: true, diagnosticCodes: [] },
    }],
  };
  const evaluation = rubric.evaluateRubricProvisionally(fixture.rubric, evidenceBundle, {
    artifactValid: true,
    usedCapabilityRefs: fixture.authoringPolicy.requiredCapabilityRefs,
  });
  if (evaluation.finalScore !== null || evaluation.decision !== "teacher-review-required") {
    throw new Error("Rubric evaluation crossed the teacher-review boundary.");
  }
  const versionMismatch = structuredClone(fixtures[1]);
  versionMismatch.domainPackRef.version = "999.0.0";
  if (domain.validateCausalystAssessment(versionMismatch).ok) {
    throw new Error("Domain-pack version mismatch was accepted.");
  }
  console.log("Cycle 13 Causalyst lint passed: 2 domain fixtures valid; canonical packages deterministic; selectors provisional; teacher review and identity-free boundaries enforced.");
} finally {
  await server.close();
}
