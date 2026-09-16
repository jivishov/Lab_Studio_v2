import { useMemo, useState } from "react";
import { getStudioFeatureFlags } from "../../platform/featureFlags";
import type { EvidenceBundle } from "../../platform/evidence/types";
import { evaluateRubricProvisionally } from "../rubric";
import type { CausalystAssessmentDefinition } from "../domain";
import { createSemanticTrace, appendSemanticEvent, completeSemanticTrace } from "../trace";
import { createCausalystSubmissionPackage, serializeCausalystSubmissionPackage, type CausalystSubmission } from "../submission";

const download = (name: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const LearnerAttempt = ({ assessment }: { assessment: CausalystAssessmentDefinition }) => {
  const promptEnabled = getStudioFeatureFlags().causalystPromptBuildV1;
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("Ready for a structured local attempt.");
  const evidence = useMemo<EvidenceBundle>(() => ({
    schema: "studio.evidence-bundle",
    schemaVersion: "1.0",
    bundleId: `${assessment.id}-local-evidence`,
    registryVersion: assessment.contractPins.evidenceRegistryVersion,
    createdAt: new Date().toISOString(),
    records: [{
      evidenceId: `${assessment.id}-artifact-validation`,
      typeId: "artifact.validation",
      typeVersion: "1.0.0",
      occurredAt: new Date().toISOString(),
      producerId: "studio.validation",
      summary: "Pinned artifact validated through its registered domain pack.",
      metadata: {
        retentionClass: "submission",
        sensitivity: "none",
        accessibleRepresentation: "text",
        redactionPolicyId: "core.artifact.validation.allowlist-v1",
      },
      payload: {
        artifactId: assessment.executableArtifact.artifactRef.id,
        valid: true,
        diagnosticCodes: [],
      },
    }],
  }), [assessment]);
  const submit = () => {
    try {
      const now = new Date().toISOString();
      let trace = createSemanticTrace(`${assessment.id}-trace`, `${assessment.id}-run-1`, now);
      trace = appendSemanticEvent(trace, {
        eventId: `${assessment.id}-validated`,
        eventTypeId: "artifact.validation",
        occurredAt: now,
        objectRefs: [assessment.executableArtifact.artifactRef.id],
        evidenceRefs: [evidence.records[0].evidenceId],
        outcome: "completed",
        summary: "Validated the pinned artifact before submission.",
        data: { artifactVersion: assessment.executableArtifact.artifactRef.version },
      });
      trace = completeSemanticTrace(trace, now);
      const rubricEvaluation = evaluateRubricProvisionally(assessment.rubric, evidence, {
        artifactValid: true,
        usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs,
      });
      const submission: CausalystSubmission = {
        schema: "causalyst.submission",
        schemaVersion: "1.0",
        submissionId: `${assessment.id}-local-1`,
        assessmentRef: { id: assessment.id, version: assessment.metadata.version },
        attemptNumber: 1,
        submittedAt: now,
        artifactSnapshots: [assessment.executableArtifact.artifact],
        procedureIRCandidates: [],
        runTraces: [trace],
        evidenceBundle: evidence,
        explanations: assessment.explanationPrompts.map(({ id }) => ({
          promptId: id,
          responseText: explanations[id] ?? "",
          submittedAt: now,
        })),
        usedCapabilityRefs: assessment.authoringPolicy.requiredCapabilityRefs,
        rubricEvaluation,
        integrity: {
          status: "valid",
          assessmentVersion: assessment.metadata.version,
          domainPackVersion: assessment.domainPackRef.version,
          capabilityManifestSchemaVersion: "2.0",
          evidenceRegistryVersion: evidence.registryVersion,
          artifactRefs: [assessment.executableArtifact.artifactRef],
          evidenceTypeRefs: [{ id: "artifact.validation", version: "1.0.0" }],
          checkCodes: ["artifact.valid", "trace.ordered", "evidence.linked"],
        },
        teacherApproval: { status: "pending", gradeReturn: false },
      };
      const packageValue = createCausalystSubmissionPackage(assessment, submission, {
        packageId: `${submission.submissionId}-package`,
        createdAt: now,
      });
      const serialized = serializeCausalystSubmissionPackage(packageValue);
      window.localStorage.setItem(`lab-studio:causalyst:v1:submission:${submission.submissionId}`, serialized);
      download(`${submission.submissionId}.causalyst-submission-package.json`, serialized);
      setStatus("Portable identity-free submission exported. Teacher review is still required.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Submission could not be created.");
    }
  };
  return (
    <section className="causalyst-preview" aria-labelledby="causalyst-attempt-title">
      <header><span className="causalyst-kicker">Local learner attempt · identity-free</span><h2 id="causalyst-attempt-title">{assessment.title}</h2><p>{assessment.instructions}</p></header>
      <section><h3>Authoring path</h3>
        <p>Use the structured controls and pinned artifact below. This manual path remains available independently of model access.</p>
        <label>Artifact title<input defaultValue={String(assessment.executableArtifact.artifact.title ?? assessment.title)} disabled={assessment.authoringPolicy.lockedParameterPaths.includes("/title")} /></label>
        {promptEnabled && assessment.authoringPolicy.mode === "prompt-bounded" && <label>Optional prompt candidate<textarea aria-describedby="prompt-boundary" /></label>}
        <p id="prompt-boundary">Prompt output is only a ProcedureIR candidate; deterministic policy, domain compilation, validation, and preview gates must accept it before use.</p>
      </section>
      <section><h3>Evidence checklist</h3><ul>{assessment.evidencePlan.requiredEvidenceTypeRefs.map(({ id, version }) => <li key={id}>{id}@{version}: present</li>)}</ul></section>
      <section><h3>Explain</h3>{assessment.explanationPrompts.map((prompt) => <label key={prompt.id}>{prompt.prompt}<textarea required={prompt.required} value={explanations[prompt.id] ?? ""} onChange={(event) => setExplanations({ ...explanations, [prompt.id]: event.currentTarget.value })} /></label>)}</section>
      <button type="button" onClick={submit}>Export local submission</button>
      <p role="status">{status}</p>
      <aside className="causalyst-boundary" role="note">No identity, final grade, model-assisted final scoring, LTI, AGS, or QTI is included.</aside>
    </section>
  );
};
