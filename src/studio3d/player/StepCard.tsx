import type { Lab3DPartLabel } from "../labs3d";
import { ProvenanceChip } from "../ui/ProvenanceChip";
import { Icon } from "../ui/Icon";
import { FloatPanel, type PanelControls } from "./panels";
import { submitCalculationLabel } from "./stepRules";
import type { Player3DController } from "./usePlayer3D";

/**
 * The step card (handoff §5.5): step count, title, progress, the instruction verbatim on the
 * guidance band, the input field above the action (G-2), the accessible action flow with the 2D
 * enabling rules (G-6), Show me in guided mode only (G-7), and the correction block (§5.13).
 * It is a floating panel; collapsed, it is one line: "Step n · <title>" (§5.5.9). In a 3D experiment
 * (D8, E0 decision C) the eyebrow names the part first: "Part 2 of 4 · Transfer · Step 7 of 31".
 */
export const StepCard = ({ player, controls, onShowMe, onHoldOver, holdOverReady, part }: {
  player: Player3DController;
  controls: PanelControls;
  onShowMe: () => void;
  /** A drop-to-the-line step: hold the pipette over the vessel, as releasing it there on the bench does. */
  onHoldOver?: () => void;
  holdOverReady?: boolean;
  part?: Lab3DPartLabel;
}) => {
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
  // While a timed stage's minutes run on the step clock the next action waits (Pack 2 decision 9).
  const waiting = Boolean(player.stepClock);

  return (
    <FloatPanel id="step" label="Current step" className="s3d-step" controls={controls}
      head={<>
        {badge}
        <span className="s3d-eyebrow s3d-grow">{part ? `Part ${part.index} of ${part.count} · ${part.title} · ` : ""}Step {n} of {N}</span>
        {runtime.currentNode.type !== "action" ? <span className="s3d-chip s3d-chip--neutral">{nodeTypeLabel(runtime.currentNode.type)}</span> : null}
      </>}
      collapsedHead={<>{badge}<span className="s3d-step__line s3d-grow">Step {n} · {runtime.currentNode.title}</span></>}
    >
      <div className="s3d-step__body" data-gesture-scroll-region="vertical">
        <h2 className="s3d-step__title">{runtime.currentNode.title}</h2>
        <ol className="s3d-progress" aria-label={`${runtime.state.completedNodes.length} of ${N} steps complete`}>
          {nodes.map((node) => (
            <li key={node.id} className={runtime.state.completedNodes.includes(node.id) ? "is-done" : node.id === runtime.currentNode.id ? "is-current" : ""} />
          ))}
        </ol>
        <p className="s3d-next-action" aria-live="polite">{instruction}</p>

        {field && field.role === "teacherConfiguration" && typeof runtime.expectedAction?.parameters.configuredValue === "number" ? (
          // A value the teacher set up is shown, not asked for; the runtime takes it from the setup.
          <div className="s3d-field">
            <span className="s3d-field__caption">{field.label}</span>
            <div className="s3d-input s3d-input--readonly">
              <span className="s3d-input__value">{runtime.expectedAction.parameters.configuredValue}</span>
              {field.unit ? <span className="s3d-input__unit">{field.unit}</span> : null}
            </div>
            <div className="s3d-field__meta"><ProvenanceChip kind="teacher" /></div>
          </div>
        ) : field ? (
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
            <EndpointSelect label="Source" value={player.selectedSource} placeholder={flow.source.label} missing={flow.source.missing} disabled={waiting}
              options={runtime.state.equipmentInstances.filter((i) => i.location !== "storage")} onChange={player.setSelectedSource} />
            <Icon name="arrow-right" className="s3d-flow__arrow" />
            <EndpointSelect label="Target" value={player.selectedTarget} placeholder={flow.target.label} missing={flow.target.missing} disabled={waiting}
              options={runtime.state.equipmentInstances.filter((i) => i.location !== "storage")} onChange={player.setSelectedTarget} />
          </div>
        ) : null}

        <div className="s3d-step__actions">
          <div className="s3d-step__links">
            {showGuidance && flow.canConfirm ? <button type="button" className="s3d-button s3d-button--guide" disabled={waiting} onClick={onShowMe}><Icon name="play" />Show me</button> : null}
            <details className="s3d-about">
              <summary>About this step</summary>
              <p>{runtime.currentNode.description}</p>
              {runtime.currentNode.hints.map((hint) => <p key={hint}>{hint}</p>)}
            </details>
          </div>
          {player.markStep ? (
            onHoldOver ? (
              <button type="button" className="s3d-button s3d-button--primary" disabled={!holdOverReady || waiting} onClick={onHoldOver}
                title={holdOverReady ? undefined : "Put the pipette and the vessel on the bench first."}>Hold the pipette over it</button>
            ) : null
          ) : flow.canConfirm ? (
            <button type="button" className="s3d-button s3d-button--primary" data-hand-press="confirm-accessible-action"
              disabled={!flow.confirmEnabled || waiting || (runtime.expectedAction?.verb === "rinse" && Boolean(player.pour))} onClick={player.confirm}>
              {runtime.expectedAction?.verb === "rinse" && Number(runtime.expectedAction.parameters.rinsePortions ?? 1) > 1
                ? `Rinse (${runtime.state.rinsePortions?.[runtime.expectedAction.id] ?? 0} of ${Number(runtime.expectedAction.parameters.rinsePortions)})`
                : pourPortions(player) ?? "Confirm"}
            </button>
          ) : flow.canSubmitCalculation || (runtime.expectedAction?.verb === "calculate" && !flow.nodeCompleted) ? (
            <button type="button" className="s3d-button s3d-button--primary" data-hand-press="submit-calculation" disabled={!flow.canSubmitCalculation || waiting} onClick={player.submitCalculation}>
              {submitCalculationLabel(runtime.expectedAction?.label ?? "calculation")}
            </button>
          ) : flow.interaction?.type === "recordNotebook" ? (
            <button type="button" className="s3d-button s3d-button--primary" data-hand-press="record-evidence"
              disabled={!(flow.canRecord || flow.canRecordObservation) || waiting || Boolean(player.benchOpRun)} onClick={player.recordEvidence}>
              {runtime.expectedAction?.parameters.balanceOperation === "zero" ? "Tare"
                : player.benchOp ? player.benchOp.control
                : runtime.expectedAction?.parameters.mixOperation === "swirl" ? "Swirl"
                : runtime.expectedAction?.parameters.mixOperation === "invert"
                  ? `Invert (${runtime.state.mixInversions?.[runtime.expectedAction.id] ?? 0} of ${Number(runtime.expectedAction.parameters.inversions ?? 10)})`
                  : "Record"}
            </button>
          ) : null}
        </div>
      </div>
    </FloatPanel>
  );
};

/**
 * A mixture filtered in portions (Pack 2 decision 4): "Pour (done of all)", all being the portions poured
 * so far and those the beaker's liquid still needs at the step's portion size.
 */
const pourPortions = (player: Player3DController): string | undefined => {
  const action = player.runtime.expectedAction;
  const portion = Number(action?.parameters.pourPortionMl);
  if (!action || action.verb !== "filter" || !(portion > 0)) return undefined;
  const done = player.runtime.state.filterPortions?.[action.id] ?? 0;
  const source = player.runtime.state.equipmentInstances.find((instance) => instance.id === action.parameters.sourceInstanceId);
  const left = Math.ceil(Math.max(0, (source?.contents.volumeMl ?? 0) - 1e-9) / portion);
  return `Pour (${done} of ${done + left})`;
};

const nodeTypeLabel = (type: string): string =>
  ({ observation: "Observation", calculation: "Calculation", checkpoint: "Checkpoint", decision: "Decision", technique: "Technique", teacherNote: "Teacher note" } as Record<string, string>)[type] ?? type;

const EndpointSelect = ({ label, value, placeholder, missing, options, onChange, disabled }: {
  label: string;
  value?: string;
  placeholder: string;
  missing: boolean;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string | undefined) => void;
  disabled?: boolean;
}) => {
  const id = `s3d-endpoint-${label.toLowerCase()}`;
  return (
    <div className="s3d-field s3d-field--compact">
      <label htmlFor={id}>{label}</label>
      <select id={id} className={missing && !value ? "is-missing" : undefined} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </div>
  );
};
