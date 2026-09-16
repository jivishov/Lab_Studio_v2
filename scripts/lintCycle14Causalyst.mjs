import { createServer } from "vite";
import { readFile } from "node:fs/promises";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const domain = await server.ssrLoadModule("/src/causalyst/domain/index.ts");
  const rubric = await server.ssrLoadModule("/src/causalyst/rubric/index.ts");
  const trace = await server.ssrLoadModule("/src/causalyst/trace/index.ts");
  const submission = await server.ssrLoadModule("/src/causalyst/submission/index.ts");
  const prompt = await server.ssrLoadModule("/src/causalyst/prompt/index.ts");
  const assessment = domain.createChemistryAssessmentFixture();
  const now = "2026-07-26T00:00:00.000Z";
  const evidence = {
    schema: "studio.evidence-bundle", schemaVersion: "1.0", bundleId: "cycle14-bundle",
    registryVersion: "1.0.0", createdAt: now,
    records: [{
      evidenceId: "cycle14-validation", typeId: "artifact.validation", typeVersion: "1.0.0",
      occurredAt: now, producerId: "studio.validation", summary: "Pinned artifact valid.",
      metadata: { retentionClass: "submission", sensitivity: "none", accessibleRepresentation: "text", redactionPolicyId: "core.artifact.validation.allowlist-v1" },
      payload: { artifactId: assessment.executableArtifact.artifactRef.id, valid: true, diagnosticCodes: [] },
    }],
  };
  let runTrace = trace.createSemanticTrace("cycle14-trace", "cycle14-run", now);
  runTrace = trace.appendSemanticEvent(runTrace, {
    eventId: "cycle14-event", eventTypeId: "artifact.validation", occurredAt: now,
    objectRefs: [assessment.executableArtifact.artifactRef.id], evidenceRefs: ["cycle14-validation"],
    outcome: "completed", summary: "Validated pinned artifact.", data: { artifactVersion: assessment.executableArtifact.artifactRef.version },
  });
  const evaluation = rubric.evaluateRubricProvisionally(assessment.rubric, evidence, {
    artifactValid: true, usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs,
  });
  const value = {
    schema: "causalyst.submission", schemaVersion: "1.0",
    submissionId: "cycle14-submission", assessmentRef: { id: assessment.id, version: assessment.metadata.version },
    attemptNumber: 1, submittedAt: now,
    artifactSnapshots: [assessment.executableArtifact.artifact], runTraces: [runTrace], evidenceBundle: evidence,
    explanations: [{ promptId: "limitations", responseText: "The simulation supports only its pinned claims.", submittedAt: now }],
    usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs, rubricEvaluation: evaluation,
    integrity: {
      status: "valid", assessmentVersion: assessment.metadata.version, domainPackVersion: assessment.domainPackRef.version,
      capabilityManifestSchemaVersion: "2.0", evidenceRegistryVersion: evidence.registryVersion,
      artifactRefs: [assessment.executableArtifact.artifactRef],
      evidenceTypeRefs: [{ id: "artifact.validation", version: "1.0.0" }],
      checkCodes: ["artifact.valid", "trace.ordered", "evidence.linked"],
    },
    teacherApproval: { status: "pending", gradeReturn: false },
  };
  const packageValue = submission.createCausalystSubmissionPackage(assessment, value, { packageId: "cycle14-package", createdAt: now });
  const text = submission.serializeCausalystSubmissionPackage(packageValue);
  if (submission.serializeCausalystSubmissionPackage(submission.parseCausalystSubmissionPackage(text)) !== text) throw new Error("Submission round trip drift.");
  const tampered = structuredClone(value);
  tampered.runTraces[0].events[0].evidenceRefs = ["missing-evidence"];
  let tamperRejected = false;
  try {
    submission.createCausalystSubmissionPackage(assessment, tampered, {
      packageId: "cycle14-tampered",
      createdAt: now,
    });
  } catch {
    tamperRejected = true;
  }
  if (!tamperRejected) throw new Error("Submission integrity validation accepted a dangling evidence reference.");
  let semanticLeakRejected = false;
  try {
    trace.appendSemanticEvent(trace.createSemanticTrace("unsafe-trace", "unsafe-run", now), {
      eventId: "unsafe-event", eventTypeId: "observation.text", occurredAt: now,
      objectRefs: [], evidenceRefs: [], outcome: "recorded", summary: "Unsafe event.",
      data: { pointerCoordinate: "10,20" },
    });
  } catch {
    semanticLeakRejected = true;
  }
  if (!semanticLeakRejected) throw new Error("Semantic trace accepted pointer data.");
  if (/learnerEmail|finalGrade|pointerCoordinate|cameraFrame|gestureLandmark|chainOfThought|providerFileId/i.test(text)) throw new Error("Forbidden field leaked.");
  if (value.rubricEvaluation.finalScore !== null) throw new Error("Rubric evaluation became final.");
  const rejected = prompt.buildManualCandidate(assessment, {
    metadata: { createdBy: "host-model" },
    executableArtifact: { providerFileId: "file-secret" },
  }, { revisionNumber: 1, createdAt: now });
  if (rejected.ok || !rejected.diagnostics.some(({ code }) => code.includes("forbidden"))) {
    throw new Error("Untrusted ProcedureIR boundary did not reject executable/provider fields.");
  }
  const assistantServer = await readFile(new URL("./labStudioAssistantServer.mjs", import.meta.url), "utf8");
  for (const required of [
    'form.set("purpose", "user_data")',
    '{ type: "input_file", file_id: fileId }',
    'type: "input_text"',
    '"/api/causalyst/procedure-candidates"',
    'store: false',
  ]) {
    if (!assistantServer.includes(required)) throw new Error(`Prompt adapter boundary is missing ${required}.`);
  }
  if (assistantServer.indexOf('{ type: "input_file", file_id: fileId }')
    > assistantServer.indexOf('type: "input_text"')) {
    throw new Error("Responses API input_file must precede learner text.");
  }
  console.log("Cycle 14 Causalyst lint passed: untrusted candidate blocked; identity-free submission canonical; semantic trace linked; replayable evidence provisional; server-only user_data file boundary; no grade return.");
} finally {
  await server.close();
}
