import { ProvenanceChip } from "../ui/ProvenanceChip";
import { Icon } from "../ui/Icon";
import { FloatPanel, type PanelControls } from "./panels";
import { submitCalculationLabel } from "./stepRules";
import type { Player3DController } from "./usePlayer3D";

/**
 * The step card (handoff §5.5): step count, title, progress, the instruction verbatim on the
 * guidance band, the input field above the action (G-2), the accessible action flow with the 2D
 * enabling rules (G-6), Show me in guided mode only (G-7), and the correction block (§5.13).
 * It is a floating panel; collapsed, it is one line: "Step n · <title>" (§5.5.9).
 */
export const StepCard = ({ player, controls, onShowMe }: { player: Player3DController; controls: PanelControls; onShowMe: () => void }) => {
  const { runtime, flow, showGuidance, correction } = player;
  const nodes = runtime.process.nodes;
  const index = Math.max(0, nodes.findIndex((node) => node.id === runtime.currentNode.id));
  const n = index + 1;
  const N = nodes.length;
  const instruction = runtime.currentNode.description || runtime.expectedAction?.label || runtime.currentNode.title;
  const field = flow.inputField;
  const inputId = "s3d-step-input";
  const errorId = "s3d-step-input-error";

  const badge = <span className={`s3d-step__badge${showGuidance ? "" : " is-assess"}`}>{n}</span>;

  return (
    <FloatPanel id="step" label="Current step" className="s3d-step" controls={controls}
      head={<>
        {badge}
        <span className="s3d-eyebrow s3d-grow">Step {n} of {N}</span>
        {runtime.currentNode.type !== "action" ? <span className="s3d-chip s3d-chip--neutral">{nodeTypeLabel(runtime.currentNode.type)}</span> : null}
      </>}
      collapsedHead={<>{badge}<span className="s3d-step__line s3d-grow">Step {n} · {runtime.currentNode.title}</span></>}
    >
      <div className="s3d-step__body">
        <h2 className="s3d-step__title">{runtime.currentNode.title}</h2>
        <ol className="s3d-progress" aria-label={`${runtime.state.completedNodes.length} of ${N} steps complete`}>
          {nodes.map((node) => (
            <li key={node.id} className={runtime.state.completedNodes.includes(node.id) ? "is-done" : node.id === runtime.currentNode.id ? "is-current" : ""} />
          ))}
        </ol>
        <p className="s3d-next-action" aria-live="polite">{instruction}</p>

        {field ? (
          <div className="s3d-field">
            <label htmlFor={inputId}>{field.label}</label>
            <div className="s3d-input">
              {field.mode === "choice" ? (
                <select id={inputId} value={player.inputValue} onChange={(e) => player.setInput(e.target.value)}>
                  <option value="">Choose…</option>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  id={inputId}
                  inputMode={field.mode === "numeric" ? "decimal" : "text"}
                  value={player.inputValue}
                  aria-invalid={player.inputValue !== "" && !flow.inputResolution.valid}
                  aria-describedby={flow.inputResolution.error ? errorId : undefined}
                  onChange={(e) => player.setInput(e.target.value)}
                />
              )}
              {field.unit ? <span className="s3d-input__unit">{field.unit}</span> : null}
            </div>
            <div className="s3d-field__meta">
              <ProvenanceChip kind={field.role === "teacherConfiguration" ? "teacher" : "entry"} />
              {runtime.expectedAction?.verb === "weigh" ? <span className="s3d-small">This simulation does not generate balance readings.</span> : null}
            </div>
            {player.inputValue !== "" && flow.inputResolution.error ? <p id={errorId} className="s3d-field__error">{flow.inputResolution.error}</p> : null}
          </div>
        ) : null}

        {flow.configurationLock ? (
          <div className="s3d-correction" role="status">
            <p><strong>Locked</strong> {flow.configurationLock.message}</p>
            <p>{flow.configurationLock.recovery}</p>
          </div>
        ) : null}

        {correction ? (
          <div className="s3d-correction" role="status">
            <div className="s3d-correction__row"><span className="s3d-correction__k">What happened</span><span>{correction.message}</span></div>
            <div className="s3d-correction__row"><span className="s3d-correction__k">Try this</span><span>{correction.recovery}</span></div>
            {correction.attempt ? <p className="s3d-correction__attempt">Recorded as an attempt.</p> : null}
            <button type="button" className="s3d-link" onClick={player.dismissCorrection}>Dismiss</button>
          </div>
        ) : null}

        {flow.canConfirm ? (
          <div className="s3d-flow" role="group" aria-label="Accessible action flow">
            <EndpointSelect label="Source" value={player.selectedSource} placeholder={flow.source.label} missing={flow.source.missing}
              options={runtime.state.equipmentInstances.filter((i) => i.location !== "storage")} onChange={player.setSelectedSource} />
            <Icon name="arrow-right" className="s3d-flow__arrow" />
            <EndpointSelect label="Target" value={player.selectedTarget} placeholder={flow.target.label} missing={flow.target.missing}
              options={runtime.state.equipmentInstances.filter((i) => i.location !== "storage")} onChange={player.setSelectedTarget} />
          </div>
        ) : null}

        <div className="s3d-step__actions">
          <div className="s3d-step__links">
            {showGuidance && flow.canConfirm ? <button type="button" className="s3d-button s3d-button--guide" onClick={onShowMe}><Icon name="play" />Show me</button> : null}
            <details className="s3d-about">
              <summary>About this step</summary>
              <p>{runtime.currentNode.description}</p>
              {runtime.currentNode.hints.map((hint) => <p key={hint}>{hint}</p>)}
            </details>
          </div>
          {flow.canConfirm ? (
            <button type="button" className="s3d-button s3d-button--primary" disabled={!flow.confirmEnabled} onClick={player.confirm}>Confirm</button>
          ) : flow.canSubmitCalculation || (runtime.expectedAction?.verb === "calculate" && !flow.nodeCompleted) ? (
            <button type="button" className="s3d-button s3d-button--primary" disabled={!flow.canSubmitCalculation} onClick={player.submitCalculation}>
              {submitCalculationLabel(runtime.expectedAction?.label ?? "calculation")}
            </button>
          ) : flow.interaction?.type === "recordNotebook" ? (
            <button type="button" className="s3d-button s3d-button--primary" disabled={!(flow.canRecord || flow.canRecordObservation)} onClick={player.recordEvidence}>
              Record
            </button>
          ) : null}
        </div>
      </div>
    </FloatPanel>
  );
};

const nodeTypeLabel = (type: string): string =>
  ({ observation: "Observation", calculation: "Calculation", checkpoint: "Checkpoint", decision: "Decision", technique: "Technique", teacherNote: "Teacher note" } as Record<string, string>)[type] ?? type;

const EndpointSelect = ({ label, value, placeholder, missing, options, onChange }: {
  label: string;
  value?: string;
  placeholder: string;
  missing: boolean;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string | undefined) => void;
}) => {
  const id = `s3d-endpoint-${label.toLowerCase()}`;
  return (
    <div className="s3d-field s3d-field--compact">
      <label htmlFor={id}>{label}</label>
      <select id={id} className={missing && !value ? "is-missing" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </div>
  );
};
