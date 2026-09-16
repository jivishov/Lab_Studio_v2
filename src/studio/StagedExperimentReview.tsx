import type { StagedExperiment } from "../experimentComposer/types";
import type { ProtocolCheckReport } from "../protocolCheck/types";
import {
  acidBaseTitrationFamily,
  verifiedModulesById,
} from "../experimentComposer/catalogs";
import { ProtocolCheckPanel } from "./ProtocolCheckPanel";

export interface StagedExperimentReviewProps {
  stage: StagedExperiment;
  report?: ProtocolCheckReport;
  canApply: boolean;
  busyAction?: "inventory" | "preview" | "rehearsal" | "protocol" | "apply" | "discard";
  onOpenRehearsal: () => void;
  onRunProtocolCheck: () => void;
  onApply: () => void;
  onDiscard: () => void;
}

const humanize = (value: string): string => value.replaceAll("_", " ");

const TextList = ({ items, empty }: { items: readonly string[]; empty: string }) => (
  items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>
);

export const StagedExperimentReview = ({
  stage,
  report,
  canApply,
  busyAction,
  onOpenRehearsal,
  onRunProtocolCheck,
  onApply,
  onDiscard,
}: StagedExperimentReviewProps) => {
  const blockers = [
    ...stage.validation.schemaErrors,
    ...stage.validation.inventoryErrors,
    ...stage.staleReasons.map((reason) => `Stage is stale because ${humanize(reason)}.`),
  ];
  const warnings = [
    ...stage.validation.interactionWarnings,
    ...stage.blueprint.fidelity.warnings,
  ];

  return (
    <section className="composer-stage-review" aria-labelledby="composer-stage-title">
      <div className="composer-section-heading">
        <div>
          <span className="composer-kicker">Staged review · revision {stage.stageRevision}</span>
          <h3 id="composer-stage-title">{stage.definition.title}</h3>
        </div>
        <span className={`composer-fidelity-badge is-${stage.blueprint.fidelity.status}`}>
          {humanize(stage.blueprint.fidelity.status)}
        </span>
      </div>

      <dl className="composer-facts">
        <div><dt>Objective</dt><dd>{stage.request.objective}</dd></div>
        <div><dt>Audience</dt><dd>{humanize(stage.request.audience)} · {humanize(stage.request.experience)}</dd></div>
        <div><dt>Context</dt><dd>{humanize(stage.request.deliveryContext)}</dd></div>
        <div><dt>Duration</dt><dd>{stage.request.durationMinutes} minutes</dd></div>
      </dl>

      <details open>
        <summary>Inventory role resolution</summary>
        <dl className="composer-role-list">
          {Object.entries(stage.blueprint.resolvedRoles).map(([role, definitionId]) => (
            <div key={role}><dt>{humanize(role)}</dt><dd>{definitionId}</dd></div>
          ))}
        </dl>
      </details>

      <details>
        <summary>Generated module sequence</summary>
        <ol className="composer-module-list">
          {stage.blueprint.moduleIds.map((moduleId) => (
            <li key={moduleId}>{verifiedModulesById.get(moduleId)?.label ?? moduleId}</li>
          ))}
        </ol>
      </details>

      <details open>
        <summary>Configured working volumes and fidelity</summary>
        <dl className="composer-volume-grid">
          <div><dt>Aliquot</dt><dd>{stage.blueprint.model.analyteVolumeMl} mL</dd></div>
          <div><dt>Burette fill</dt><dd>{stage.blueprint.model.buretteFillVolumeMl} mL</dd></div>
          <div><dt>Indicator</dt><dd>{stage.blueprint.model.indicatorVolumeMl} mL</dd></div>
        </dl>
        <h4>Modeled</h4>
        <TextList items={stage.blueprint.fidelity.modeled} empty="No modeled claims." />
        <h4>Procedural only</h4>
        <TextList items={stage.blueprint.fidelity.proceduralOnly} empty="No procedural-only claims." />
      </details>

      <details>
        <summary>Source and evidence provenance</summary>
        <dl className="composer-provenance-list">
          <div>
            <dt>M · source statement</dt>
            <dd>Hydrated project sources {acidBaseTitrationFamily.sourceLabId}@{acidBaseTitrationFamily.sourceLabVersion} and {acidBaseTitrationFamily.sourceTechniqueId}@{acidBaseTitrationFamily.sourceTechniqueVersion} ground the verified sequence and interaction meanings.</dd>
          </div>
          <div>
            <dt>F · supplied figure or table</dt>
            <dd>No external figure or table supplied a P0 value for this generated stage.</dd>
          </div>
          <div>
            <dt>R · disclosed reconstruction</dt>
            <dd>The synthetic sample model, prefilled-burette workflow, procedural-only statements, assumptions, and limitations below are explicit simulator or authoring inferences, not source facts.</dd>
          </div>
          <div>
            <dt>C · session configuration</dt>
            <dd>The objective, audience, duration, delivery context, aliquot, declared inventory, and titrant concentration are current Composer inputs.</dd>
          </div>
        </dl>
        <p className="composer-provenance-note">Configured working volumes feed simulator-generated readings; learner-recorded evidence and the calculated molarity remain distinct. This stage contains no external measured sample.</p>
      </details>

      <details>
        <summary>Blockers, warnings, assumptions, and limitations</summary>
        <h4>Blockers</h4>
        <TextList items={blockers} empty="No current blockers." />
        <h4>Warnings</h4>
        <TextList items={warnings} empty="No additional warnings." />
        <h4>Assumptions</h4>
        <TextList items={stage.blueprint.fidelity.assumptions} empty="No assumptions recorded." />
        <h4>Limitations</h4>
        <TextList items={stage.blueprint.fidelity.limitations} empty="No limitations recorded." />
        <h4>Declared safety readiness</h4>
        <TextList items={stage.blueprint.fidelity.safetyDeclarations} empty="No safety declarations recorded." />
      </details>

      <div className={`composer-report-status ${report?.passed ? "is-passing" : report ? "is-failing" : "is-waiting"}`} role="status">
        <strong>{report?.passed ? "Passing Protocol report" : report ? "Protocol report did not pass" : "Apply is locked"}</strong>
        <span>
          {report?.passed
            ? `${report.reportId} is bound to this exact stage.`
            : report
              ? `${report.reportId} is bound to this stage but cannot unlock Apply. Run Protocol Check again after correcting its failures.`
            : "Run Protocol Check. Apply requires its exact current passing report."}
        </span>
      </div>

      {report ? <ProtocolCheckPanel report={report} /> : null}

      <div className="composer-stage-actions" aria-label="Human staged experiment controls">
        <button type="button" className="secondary-action" disabled={Boolean(busyAction) || stage.staleReasons.length > 0} onClick={onOpenRehearsal}>
          {busyAction === "rehearsal" ? "Opening…" : "Open rehearsal"}
        </button>
        <button type="button" className="secondary-action" disabled={Boolean(busyAction) || stage.staleReasons.length > 0} onClick={onRunProtocolCheck}>
          {busyAction === "protocol" ? "Checking…" : "Run Protocol Check"}
        </button>
        <button type="button" className="primary-action" disabled={Boolean(busyAction) || !canApply} onClick={onApply}>
          {busyAction === "apply" ? "Applying…" : "Apply to Studio"}
        </button>
        <button type="button" className="composer-discard-action" disabled={Boolean(busyAction)} onClick={onDiscard}>
          {busyAction === "discard" ? "Discarding…" : "Discard"}
        </button>
      </div>
      <p className="composer-human-note">Apply and Discard are visible human-only controls and are never registered as WebMCP tools.</p>
    </section>
  );
};
