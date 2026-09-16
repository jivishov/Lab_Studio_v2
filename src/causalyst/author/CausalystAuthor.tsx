import { useMemo, useState } from "react";
import { ContentTabs, type ContentTab } from "../../components/ContentTabs";
import { assayDomainPack } from "../../domain-packs/assay/assayPack";
import { chemistryDomainPack } from "../../domain-packs/chemistry/chemistryPack";
import type { CapabilityRef } from "../../platform/capabilities/types";
import {
  createAssayAssessmentFixture,
  createCausalystAssessmentPackage,
  createChemistryAssessmentFixture,
  serializeCausalystAssessment,
  serializeCausalystAssessmentPackage,
  type CausalystAssessmentDefinition,
} from "../domain";
import { LearnerPreview } from "../player/LearnerPreview";
import { buildQti22CompanionPackage, createDefaultQtiCompanionModel } from "../qti";
import { saveLocalAssessment } from "./localLibrary";
import { getStudioFeatureFlags } from "../../platform/featureFlags";

const capabilityKey = (ref: CapabilityRef) => `${ref.kind}:${ref.id}@${ref.version}`;
const lines = (value: string) => value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);

const download = (fileName: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadBytes = (fileName: string, content: Uint8Array, mediaType: string) => {
  const url = URL.createObjectURL(new Blob([new Uint8Array(content).buffer], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const CausalystAuthor = ({
  initialAssessment,
}: {
  initialAssessment?: CausalystAssessmentDefinition;
}) => {
  const [assessment, setAssessment] = useState(
    initialAssessment ?? createChemistryAssessmentFixture(),
  );
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<string>();
  const qtiEnabled = getStudioFeatureFlags().causalystQtiExportV1;
  const pack = assessment.domainPackRef.id === "chemistry" ? chemistryDomainPack : assayDomainPack;
  const capabilities = useMemo(() => pack.getCapabilityManifestFragment().entries.filter(
    ({ claims }) => claims.some(({ maximumFidelity }) => ["F2", "F3"].includes(maximumFidelity)),
  ), [pack]);

  const update = (next: CausalystAssessmentDefinition) => {
    setAssessment(next);
    setMessage(undefined);
  };
  const changeDomain = (domain: "chemistry" | "assay") => {
    update(domain === "chemistry" ? createChemistryAssessmentFixture() : createAssayAssessmentFixture());
    setPreview(false);
  };
  const toggleCapability = (ref: CapabilityRef, checked: boolean) => {
    const key = capabilityKey(ref);
    const allowedCapabilityRefs = checked
      ? [...assessment.authoringPolicy.allowedCapabilityRefs.filter((item) => capabilityKey(item) !== key), ref]
      : assessment.authoringPolicy.allowedCapabilityRefs.filter((item) => capabilityKey(item) !== key);
    const requiredCapabilityRefs = checked
      ? assessment.authoringPolicy.requiredCapabilityRefs
      : assessment.authoringPolicy.requiredCapabilityRefs.filter((item) => capabilityKey(item) !== key);
    update({
      ...assessment,
      authoringPolicy: { ...assessment.authoringPolicy, allowedCapabilityRefs, requiredCapabilityRefs },
    });
  };

  const save = () => {
    try {
      const next = {
        ...assessment,
        metadata: { ...assessment.metadata, updatedAt: new Date().toISOString() },
      };
      saveLocalAssessment(next);
      setAssessment(next);
      setMessage("Saved to the local Causalyst assessment library. No learner identity was stored.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assessment validation failed.");
    }
  };

  const exportAssessment = (asPackage: boolean) => {
    try {
      if (asPackage) {
        const createdAt = new Date().toISOString();
        const value = createCausalystAssessmentPackage(assessment, {
          packageId: `${assessment.id}:package`,
          createdAt,
        });
        download(`${assessment.id}.causalyst-package.json`, serializeCausalystAssessmentPackage(value));
      } else {
        download(`${assessment.id}.causalyst-assessment.json`, serializeCausalystAssessment(assessment));
      }
      setMessage(`Exported deterministic ${asPackage ? "package" : "assessment"} JSON.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assessment export failed.");
    }
  };

  const exportQtiCompanion = () => {
    try {
      const model = createDefaultQtiCompanionModel(assessment, {
        label: "Launch the associated Causalyst activity from the LMS resource link.",
      });
      const value = buildQti22CompanionPackage(assessment, model, { generatedAt: new Date().toISOString() });
      downloadBytes(`${assessment.id}.qti22-companion.zip`, value.zip, "application/zip");
      setMessage("Exported a default-off QTI 2.2 companion package. It does not embed the simulation; see package-report.json for unrun interoperability gates.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QTI companion export failed.");
    }
  };

  const criterion = assessment.rubric.criteria[0];
  const prompt = assessment.explanationPrompts[0];
  const authoringTabs: ContentTab[] = [
    {
      content: (
        <section id="causalyst-source" className="causalyst-card causalyst-card--source">
          <h2>Validated source</h2>
          <label>Domain and artifact
            <select value={assessment.domainPackRef.id} onChange={(event) => changeDomain(event.currentTarget.value as "chemistry" | "assay")}>
              <option value="chemistry">Chemistry · source-controlled golden artifact</option>
              <option value="assay">Assay · source-controlled golden artifact</option>
            </select>
          </label>
          <label>Assessment title
            <input value={assessment.title} onChange={(event) => update({ ...assessment, title: event.currentTarget.value })} />
          </label>
          <label>Audience
            <input value={assessment.audience} onChange={(event) => update({ ...assessment, audience: event.currentTarget.value })} />
          </label>
          <dl>
            <div><dt>Domain pack</dt><dd>{assessment.domainPackRef.id}@{assessment.domainPackRef.version}</dd></div>
            <div><dt>Artifact</dt><dd>{assessment.executableArtifact.artifactRef.id}@{assessment.executableArtifact.artifactRef.version}</dd></div>
            <div><dt>Manifest</dt><dd>v{assessment.contractPins.capabilityManifestSchemaVersion}</dd></div>
          </dl>
        </section>
      ),
      detail: `${assessment.domainPackRef.id} source`,
      id: "source",
      label: "Source",
    },
    {
      content: (
        <section id="causalyst-policy" className="causalyst-card causalyst-card--policy">
          <h2>Authoring boundaries</h2>
          <label>Authoring mode
            <select value={assessment.authoringPolicy.mode} onChange={(event) => {
              const mode = event.currentTarget.value as CausalystAssessmentDefinition["authoringPolicy"]["mode"];
              update({
                ...assessment,
                authoringPolicy: { ...assessment.authoringPolicy, mode },
              });
            }}>
              <option value="configure">Configure provided simulation</option>
              <option value="approved-palette">Assemble from approved capabilities</option>
              <option value="prompt-bounded">Prompt proposal with manual alternative</option>
            </select>
          </label>
          <label>Required fidelity
            <select value={assessment.authoringPolicy.requiredFidelity} onChange={(event) => update({
              ...assessment,
              authoringPolicy: { ...assessment.authoringPolicy, requiredFidelity: event.currentTarget.value as "F1" | "F2" | "F3" },
            })}>
              <option value="F1">F1 · representational</option>
              <option value="F2">F2 · interactive</option>
              <option value="F3">F3 · quantitative</option>
            </select>
          </label>
          <fieldset>
            <legend>Allowed capabilities</legend>
            {capabilities.map((entry) => (
              <label className="causalyst-check" key={capabilityKey(entry.ref)}>
                <input
                  checked={assessment.authoringPolicy.allowedCapabilityRefs.some((ref) => capabilityKey(ref) === capabilityKey(entry.ref))}
                  onChange={(event) => toggleCapability(entry.ref, event.currentTarget.checked)}
                  type="checkbox"
                />
                <span><strong>{entry.title}</strong><small>{entry.ref.kind} · {entry.claims[0]?.maximumFidelity}</small></span>
              </label>
            ))}
          </fieldset>
          <label>Locked parameter paths <span>(one JSON Pointer per line)</span>
            <textarea
              rows={4}
              value={assessment.authoringPolicy.lockedParameterPaths.join("\n")}
              onChange={(event) => update({
                ...assessment,
                authoringPolicy: { ...assessment.authoringPolicy, lockedParameterPaths: lines(event.currentTarget.value) },
              })}
            />
          </label>
        </section>
      ),
      detail: `${assessment.authoringPolicy.allowedCapabilityRefs.length} allowed`,
      id: "boundaries",
      label: "Boundaries",
    },
    {
      content: (
        <section id="causalyst-evidence" className="causalyst-card causalyst-card--evidence">
          <h2>Evidence plan</h2>
          <p>Selectors can inspect registered evidence only. They cannot run arbitrary code.</p>
          <label className="causalyst-check">
            <input checked readOnly type="checkbox" />
            <span><strong>Artifact validation</strong><small>artifact.validation@1.0.0 · required</small></span>
          </label>
          <label className="causalyst-check">
            <input checked readOnly type="checkbox" />
            <span><strong>Explanation response</strong><small>explanation.response@1.0.0 · optional</small></span>
          </label>
          <label>Explanation prompt
            <textarea rows={4} value={prompt.prompt} onChange={(event) => update({
              ...assessment,
              explanationPrompts: [{ ...prompt, prompt: event.currentTarget.value }],
            })} />
          </label>
        </section>
      ),
      detail: `${assessment.evidencePlan.requiredEvidenceTypeRefs.length} required`,
      id: "evidence",
      label: "Evidence",
    },
    {
      content: (
        <section id="causalyst-rubric" className="causalyst-card causalyst-card--rubric">
          <h2>Rubric builder</h2>
          <label>Criterion title
            <input value={criterion.title} onChange={(event) => update({
              ...assessment,
              rubric: { ...assessment.rubric, criteria: [{ ...criterion, title: event.currentTarget.value }] },
            })} />
          </label>
          <label>Description
            <textarea rows={3} value={criterion.description} onChange={(event) => update({
              ...assessment,
              rubric: { ...assessment.rubric, criteria: [{ ...criterion, description: event.currentTarget.value }] },
            })} />
          </label>
          <label>Scoring mode
            <select value={criterion.scoringMode} onChange={(event) => update({
              ...assessment,
              rubric: {
                ...assessment.rubric,
                criteria: [{ ...criterion, scoringMode: event.currentTarget.value as "manual" | "deterministic" | "rule-assisted" }],
              },
            })}>
              <option value="manual">Manual</option>
              <option value="deterministic">Deterministic provisional</option>
              <option value="rule-assisted">Rule-assisted provisional</option>
            </select>
          </label>
          <ul>
            {criterion.evidenceSelectors.map((selector) => <li key={selector.id}><code>{selector.type}</code> · {selector.id}</li>)}
          </ul>
          <p className="causalyst-policy-note"><strong>Final decision:</strong> teacher required. Model suggestions are disabled.</p>
        </section>
      ),
      detail: `${assessment.rubric.criteria.length} criterion`,
      id: "rubric",
      label: "Rubric",
    },
    {
      content: (
        <div className="causalyst-preview-tab">
          <section id="causalyst-preview" className="causalyst-card causalyst-preview-actions">
            <h2>Validate, preview, and export</h2>
            <div className="causalyst-button-row">
              <button className="causalyst-button--primary" onClick={save} type="button">Save local assessment</button>
              <button onClick={() => setPreview((value) => !value)} type="button">{preview ? "Hide" : "Show"} learner preview</button>
              <button onClick={() => exportAssessment(false)} type="button">Export assessment</button>
              <button onClick={() => exportAssessment(true)} type="button">Export portable package</button>
              {qtiEnabled && <button onClick={exportQtiCompanion} type="button">Export QTI 2.2 companion</button>}
            </div>
            {qtiEnabled && <p className="causalyst-policy-note">QTI export contains standard companion prompts only. The executable simulation, evidence bundle, replay, teacher review, and approved AGS workflow remain in Causalyst.</p>}
          </section>
          {preview && <LearnerPreview assessment={assessment} />}
        </div>
      ),
      detail: "Save & export",
      id: "preview",
      label: "Preview",
    },
  ];
  return (
    <main className="causalyst-author">
      <header className="causalyst-author__header">
        <div className="causalyst-author__copy">
          <span className="causalyst-kicker">Causalyst · local assessment authoring</span>
          <div className="causalyst-author__title-line">
            <h1>Causalyst</h1>
            <p className="causalyst-author__document-title">{assessment.title}</p>
          </div>
          <p>Wrap a validated simulation in inspectable policies, evidence rules, and a teacher-reviewed rubric.</p>
        </div>
        <dl className="causalyst-author__meta">
          <div><dt>Source</dt><dd>{assessment.domainPackRef.id}</dd></div>
          <div><dt>Fidelity</dt><dd>{assessment.authoringPolicy.requiredFidelity}</dd></div>
          <div><dt>Decision</dt><dd>Teacher review</dd></div>
        </dl>
        <a className="causalyst-header-link" href="#/causalyst">Assessment library</a>
      </header>
      {message && <div className="causalyst-message" role="status">{message}</div>}
      <ContentTabs
        ariaLabel="Causalyst authoring workspace"
        className="causalyst-author-tabs"
        tabs={authoringTabs}
      />
    </main>
  );
};
