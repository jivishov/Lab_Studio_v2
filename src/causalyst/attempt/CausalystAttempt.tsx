import { useMemo, useState } from "react";
import { getStudioFeatureFlags } from "../../platform/featureFlags";
import type { VersionedStudioArtifact } from "../../platform/domain-packs/types";
import type { CausalystAssessmentDefinition } from "../domain/types";
import { createCausalystPromptClient } from "../prompt/client";
import { buildManualCandidate, buildPromptCandidate } from "../prompt/orchestrator";
import { causalystPromptRuntimePolicy } from "../prompt/policy";
import type { PromptBuildResult, PromptRevisionRecord } from "../prompt/types";
import {
  createCausalystSubmissionPackage,
  serializeCausalystSubmissionPackage,
} from "../submission/package";
import type { CausalystSubmission } from "../submission/types";
import { createValidatedLocalSubmission } from "./submissionBuilder";
import { saveLocalSubmissionPackage } from "./localSubmissions";

const download = (fileName: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const CausalystAttempt = ({
  assessment,
  onValidatedSubmission,
  submissionMode = "local",
}: {
  assessment: CausalystAssessmentDefinition;
  onValidatedSubmission?: (submission: CausalystSubmission) => Promise<void>;
  submissionMode?: "local" | "lti";
}) => {
  const [prompt, setPrompt] = useState("");
  const [manualCandidate, setManualCandidate] = useState("");
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [build, setBuild] = useState<PromptBuildResult>();
  const [revisions, setRevisions] = useState<PromptRevisionRecord[]>([]);
  const [proConfirmed, setProConfirmed] = useState(false);
  const [runConfirmed, setRunConfirmed] = useState(false);
  const [message, setMessage] = useState<string>();
  const flags = getStudioFeatureFlags();
  const mode = assessment.authoringPolicy.mode;
  const modelPolicy = causalystPromptRuntimePolicy;
  const proRequiresConfirmation = Boolean(modelPolicy?.modelRef.endsWith("-pro"));
  const revisionLimitReached = Boolean(
    modelPolicy && revisions.length >= modelPolicy.maximumRevisionCount,
  );
  const canPrompt = flags.causalystPromptBuildV1
    && mode === "prompt-bounded"
    && !revisionLimitReached
    && (!proRequiresConfirmation || proConfirmed);
  const currentArtifact = useMemo(() => (
    build?.ok ? build.artifact : assessment.executableArtifact.artifact as VersionedStudioArtifact
  ), [assessment, build]);

  const propose = async () => {
    setMessage("Requesting an untrusted ProcedureIR candidate. It will not execute directly.");
    try {
      const result = await buildPromptCandidate(
        createCausalystPromptClient({
          modelRef: modelPolicy.modelRef,
          reasoningEffort: modelPolicy.reasoningEffort,
        }),
        { assessment, prompt, revisionNumber: revisions.length + 1 },
      );
      setBuild(result);
      setRevisions((value) => [...value, result.revision]);
      setMessage(result.ok
        ? "Candidate passed policy, coverage, deterministic compilation, artifact validation, and preview/readiness gates."
        : `Candidate remains blocked with ${result.gaps.length} explicit gap(s). Revise it or use the structured alternative.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Prompt candidate request failed.");
    }
  };

  const compileManual = () => {
    try {
      const result = buildManualCandidate(assessment, JSON.parse(manualCandidate), {
        revisionNumber: revisions.length + 1,
        learnerChangeReason: "Structured manual authoring revision",
      });
      setBuild(result);
      setRevisions((value) => [...value, result.revision]);
      setMessage(result.ok
        ? "Structured candidate passed the same policy, coverage, compilation, validation, and preview/readiness gates."
        : `Structured candidate remains blocked with ${result.gaps.length} explicit gap(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Structured candidate is not valid JSON.");
    }
  };

  const submit = async () => {
    try {
      const occurredAt = new Date().toISOString();
      const responseRecords = assessment.explanationPrompts.map(({ id }) => ({
        promptId: id,
        responseText: explanations[id]?.trim() ?? "",
        submittedAt: occurredAt,
      }));
      const submissionId = `${assessment.id}-attempt-${Date.now()}`;
      const submission = createValidatedLocalSubmission(assessment, {
        submissionId,
        attemptNumber: 1,
        occurredAt,
        artifact: currentArtifact,
        promptBuild: build,
        explanations: responseRecords,
        promptRevisions: modelPolicy.retainPromptRevisions ? revisions : undefined,
        runConfirmed,
      });
      const value = createCausalystSubmissionPackage(assessment, submission, {
        packageId: `${submissionId}:package`,
        createdAt: occurredAt,
      });
      if (onValidatedSubmission) {
        await onValidatedSubmission(submission);
        download(`${submissionId}.causalyst-submission-package.json`, serializeCausalystSubmissionPackage(value));
        setMessage("Validated identity-free submission sent under the pseudonymous launch session and exported for portable review. Teacher review is required.");
      } else {
        saveLocalSubmissionPackage(value);
        download(`${submissionId}.causalyst-submission-package.json`, serializeCausalystSubmissionPackage(value));
        setMessage("Validated identity-free submission exported. Teacher review is required; no score left the app.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission validation failed.");
    }
  };

  return (
    <main className="causalyst-author causalyst-attempt">
      <header className="causalyst-author__header">
        <div className="causalyst-author__copy">
          <span className="causalyst-kicker">{submissionMode === "lti" ? "LTI learner attempt" : "Local learner attempt"} · semantic evidence only</span>
          <h1>{assessment.title}</h1>
          <p>{assessment.instructions}</p>
        </div>
        <dl className="causalyst-author__meta">
          <div><dt>Mode</dt><dd>{mode}</dd></div>
          <div><dt>Source</dt><dd>{assessment.domainPackRef.id}</dd></div>
          <div><dt>Decision</dt><dd>Teacher review</dd></div>
        </dl>
        <a className="causalyst-header-link" href="#/causalyst">Assessment library</a>
      </header>
      {message && <p className="causalyst-message" role="status">{message}</p>}
      <section className="causalyst-card causalyst-flow-card">
        <h2>1. Choose an authorized authoring path</h2>
        <p><strong>Teacher-selected mode:</strong> {mode}</p>
        {mode === "prompt-bounded" ? (
          <>
            <label>Learner prompt
              <textarea
                rows={6}
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
              />
            </label>
            <button disabled={!canPrompt || !prompt.trim()} onClick={() => void propose()} type="button">
              Propose ProcedureIR candidate
            </button>
            {proRequiresConfirmation && (
              <label className="causalyst-check">
                <input
                  checked={proConfirmed}
                  onChange={(event) => setProConfirmed(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Confirm use of the GPT Pro model for this proposal</span>
              </label>
            )}
            {revisionLimitReached && (
              <p>The teacher-configured prompt revision limit has been reached.</p>
            )}
            {!flags.causalystPromptBuildV1 && (
              <p>The optional model proposal feature is disabled. The pinned structured artifact remains a complete alternative.</p>
            )}
            <details>
              <summary>Use the structured manual alternative</summary>
              <p>
                Continue with the pinned validated artifact and the teacher-approved capability list.
                This path never calls a model and remains available whenever prompt mode is enabled.
              </p>
              <label>ProcedureIR v1 JSON
                <textarea
                  rows={8}
                  value={manualCandidate}
                  onChange={(event) => setManualCandidate(event.currentTarget.value)}
                />
              </label>
              <button
                disabled={!manualCandidate.trim()}
                onClick={compileManual}
                type="button"
              >
                Validate structured candidate
              </button>
            </details>
          </>
        ) : (
          <fieldset>
            <legend>Structured manual alternative</legend>
            <p>
              The provided artifact is already validated and version-pinned. This path never calls a model.
              Teacher-allowed capabilities remain inspectable below.
            </p>
            <ul>{assessment.authoringPolicy.allowedCapabilityRefs.map((ref) => (
              <li key={`${ref.kind}:${ref.id}@${ref.version}`}>
                <code>{ref.kind}:{ref.id}@{ref.version}</code>
              </li>
            ))}</ul>
            {mode === "approved-palette" && (
              <>
                <label>ProcedureIR v1 JSON
                  <textarea
                    rows={8}
                    value={manualCandidate}
                    onChange={(event) => setManualCandidate(event.currentTarget.value)}
                  />
                </label>
                <button
                  disabled={!manualCandidate.trim()}
                  onClick={compileManual}
                  type="button"
                >
                  Validate structured candidate
                </button>
              </>
            )}
          </fieldset>
        )}
        {build && !build.ok && (
          <div role="alert">
            <h3>Revision required</h3>
            <ul>{build.gaps.map((gap, index) => <li key={`${gap.code}:${index}`}>{gap.message}</li>)}</ul>
          </div>
        )}
      </section>
      <section className="causalyst-card causalyst-flow-card">
        <h2>2. Validate and record a semantic run</h2>
        <dl>
          <div><dt>Artifact</dt><dd>{currentArtifact.id}</dd></div>
          <div><dt>Domain pack</dt><dd>{assessment.domainPackRef.id}@{assessment.domainPackRef.version}</dd></div>
          <div><dt>Trace boundary</dt><dd>Semantic events and evidence links only</dd></div>
        </dl>
        <p>
          Export records the pinned artifact validation and learner evidence. It never records
          pointer coordinates, camera or gesture data, unrelated browser events, provider internals,
          credentials, local paths, hashes, or hidden reasoning.
        </p>
        <p>
          <a
            href={assessment.domainPackRef.id === "chemistry"
              ? `#/play/${currentArtifact.id}`
              : `#/assay/${currentArtifact.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Open the pinned {assessment.domainPackRef.id} simulation
          </a>
        </p>
        <label className="causalyst-check">
          <input
            checked={runConfirmed}
            onChange={(event) => setRunConfirmed(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>
            I completed the teacher-directed run in the pinned simulation.
            This learner checkpoint is recorded as an observation, not as independent runtime proof.
          </span>
        </label>
      </section>
      <section className="causalyst-card causalyst-flow-card">
        <h2>3. Explain and submit</h2>
        {assessment.explanationPrompts.map((item) => (
          <label key={item.id}>{item.prompt}{item.required ? " (required)" : ""}
            <textarea
              rows={5}
              value={explanations[item.id] ?? ""}
              onChange={(event) => setExplanations((value) => ({
                ...value,
                [item.id]: event.currentTarget.value,
              }))}
            />
          </label>
        ))}
        <button
          disabled={!runConfirmed || Boolean(build && !build.ok) || assessment.explanationPrompts.some(
            ({ id, required }) => required && !(explanations[id]?.trim()),
          )}
          onClick={() => void submit()}
          type="button"
        >
          {submissionMode === "lti" ? "Validate, submit, and export portable copy" : "Validate and export local submission"}
        </button>
        <p><strong>No final grade:</strong> rubric suggestions remain provisional until teacher review.</p>
      </section>
    </main>
  );
};
