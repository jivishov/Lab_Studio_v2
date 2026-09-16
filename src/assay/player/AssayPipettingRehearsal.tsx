import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LiquidSourceSelection,
  MicropipetteDefinition,
  PipetteOrientation,
  PlateTargetSelection,
} from "../../domain-packs/assay/pipetting";
import {
  dispatchAssayRuntimeIntent,
  type AssayOperationEvidence,
  type AssayRuntimeIntent,
  type AssayRuntimeState,
  type AssayRuntimeTransition,
} from "../../domain-packs/assay/runtime";

export interface AssayPipettingWorkbenchProps {
  state: AssayRuntimeState;
  onIntent: (intent: AssayRuntimeIntent) => void;
  lastTransition?: AssayRuntimeTransition;
  transitions?: readonly AssayRuntimeTransition[];
}

export interface AssayPipettingRehearsalProps {
  initialState: AssayRuntimeState;
  onStateChange?: (state: AssayRuntimeState) => void;
  onTransition?: (transition: AssayRuntimeTransition) => void;
}

type SourceOption = {
  label: string;
  value: string;
};

const selectedPipette = (
  state: AssayRuntimeState,
): { definition: MicropipetteDefinition; runtime: AssayRuntimeState["pipettes"][number] } => {
  const definition = state.pipetteDefinitions.find(({ id }) => id === state.selectedPipetteId);
  const runtime = state.pipettes.find(({ pipetteId }) => pipetteId === state.selectedPipetteId);
  if (!definition || !runtime) {
    throw new Error(`Selected assay pipette ${state.selectedPipetteId} is unavailable.`);
  }
  return { definition, runtime };
};

const sourceOptions = (state: AssayRuntimeState): SourceOption[] => [
  ...state.liquidSources.map((source) => ({
    label: `${source.id} (${source.kind}, ${source.volume.value} ${source.volume.unit})`,
    value: `source:${source.id}`,
  })),
  ...state.plate.wells.map((well) => ({
    label: `${well.coordinate} (${well.volume.value} ${well.volume.unit}, ${well.mixed ? "mixed" : "not mixed"})`,
    value: `well:${well.coordinate}`,
  })),
];

const evidenceDetails = (evidence: AssayOperationEvidence): string =>
  Object.entries(evidence.data)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join("; ");

export const AssayPipettingWorkbench = ({
  state,
  onIntent,
  lastTransition,
  transitions = lastTransition ? [lastTransition] : [],
}: AssayPipettingWorkbenchProps) => {
  const [volumeValue, setVolumeValue] = useState(
    () => selectedPipette(state).runtime.setVolume.value,
  );
  const [sourceValue, setSourceValue] = useState(() => {
    const firstExternal = state.liquidSources[0];
    return firstExternal ? `source:${firstExternal.id}` : `well:${state.plate.wells[0]?.coordinate ?? "A1"}`;
  });
  const [targetCoordinate, setTargetCoordinate] = useState(
    () => state.plate.wells[0]?.coordinate ?? "A1",
  );
  const [orientation, setOrientation] = useState<PipetteOrientation>("vertical");

  const active = selectedPipette(state);
  const sources = useMemo(() => sourceOptions(state), [state]);
  const isMultichannel = active.definition.channels > 1;
  const attachedTipLabel = active.runtime.attachedTips.length === 1 ? "tip" : "tips";

  useEffect(() => {
    setVolumeValue(selectedPipette(state).runtime.setVolume.value);
  }, [state.selectedPipetteId]);

  const sourceSelection = (): LiquidSourceSelection => {
    const separator = sourceValue.indexOf(":");
    const kind = sourceValue.slice(0, separator);
    const id = sourceValue.slice(separator + 1);
    if (kind === "source") {
      return isMultichannel
        ? { kind: "shared-source", sourceId: id }
        : { kind: "single", location: { kind: "source", sourceId: id } };
    }
    return isMultichannel
      ? { kind: "plate-multichannel", anchor: id, orientation }
      : { kind: "single", location: { kind: "well", coordinate: id } };
  };

  const targetSelection = (): PlateTargetSelection => isMultichannel
    ? { kind: "multichannel", anchor: targetCoordinate, orientation }
    : { kind: "single", coordinate: targetCoordinate };

  const visibleLastTransition = lastTransition ?? transitions.at(-1);
  const compatibleTip = state.tipDefinitions.find(({ id }) =>
    active.definition.compatibleTipTypeIds.includes(id));

  return (
    <section className="assay-pipetting" aria-labelledby="assay-pipetting-title">
      <header className="assay-pipetting__header">
        <div>
          <span className="assay-eyebrow">Accessible liquid handling</span>
          <h2 id="assay-pipetting-title">Pipetting rehearsal</h2>
          <p>Every action is validated by the assay runtime before plate or pipette state changes.</p>
        </div>
        <div className="assay-orientation" aria-label="Plate orientation A1 top-left">
          <span>A1</span>
          <strong>A1 top-left</strong>
          <small>Rows A–H · columns 1–12</small>
        </div>
      </header>

      <div className="assay-pipetting__workspace">
        <form className="assay-pipetting__controls" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend>Pipette setup</legend>
            <label>
              Selected pipette
              <select
                aria-label="Selected pipette"
                onChange={(event) => {
                  const pipetteId = event.target.value;
                  const next = state.pipettes.find(({ pipetteId: id }) => id === pipetteId);
                  if (next) setVolumeValue(next.setVolume.value);
                  onIntent({ type: "selectPipette", pipetteId });
                }}
                value={state.selectedPipetteId}
              >
                {state.pipetteDefinitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.label} · {definition.channels} channel{definition.channels === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>

            <div className="assay-pipetting__inline-controls">
              <label>
                Volume (uL)
                <input
                  aria-label="Volume in microliters"
                  inputMode="decimal"
                  onChange={(event) => setVolumeValue(event.target.value)}
                  type="text"
                  value={volumeValue}
                />
              </label>
              <button
                onClick={() => onIntent({
                  type: "setVolume",
                  pipetteId: active.definition.id,
                  volume: { value: volumeValue, unit: "uL" },
                })}
                type="button"
              >
                Set volume
              </button>
            </div>

            <div className="assay-pipetting__button-row">
              <button
                disabled={!compatibleTip}
                onClick={() => compatibleTip && onIntent({
                  type: "attachTips",
                  pipetteId: active.definition.id,
                  tipTypeId: compatibleTip.id,
                })}
                type="button"
              >
                Attach {isMultichannel ? "tips" : "tip"}
              </button>
              <button
                onClick={() => onIntent({ type: "ejectTips", pipetteId: active.definition.id })}
                type="button"
              >
                Eject {isMultichannel ? "tips" : "tip"}
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Transfer selection</legend>
            <label>
              Source
              <select
                aria-label="Transfer source"
                onChange={(event) => setSourceValue(event.target.value)}
                value={sourceValue}
              >
                {sources.map((source) => (
                  <option key={source.value} value={source.value}>{source.label}</option>
                ))}
              </select>
            </label>
            <label>
              Target well or anchor
              <select
                aria-label="Target well or anchor"
                onChange={(event) => setTargetCoordinate(event.target.value)}
                value={targetCoordinate}
              >
                {state.plate.wells.map(({ coordinate }) => (
                  <option key={coordinate} value={coordinate}>{coordinate}</option>
                ))}
              </select>
            </label>
            <label>
              Channel orientation
              <select
                aria-describedby="assay-orientation-help"
                aria-label="Channel orientation"
                disabled={!isMultichannel}
                onChange={(event) => setOrientation(event.target.value as PipetteOrientation)}
                value={orientation}
              >
                <option value="vertical">Vertical · one plate column</option>
                <option value="horizontal">Horizontal · one plate row</option>
              </select>
            </label>
            <small id="assay-orientation-help">
              {isMultichannel
                ? `Channel 1 begins at ${targetCoordinate}; mapping is ${orientation}.`
                : "Orientation is not applicable to a single-channel pipette."}
            </small>
            <div className="assay-pipetting__button-row">
              <button
                onClick={() => onIntent({
                  type: "aspirate",
                  pipetteId: active.definition.id,
                  source: sourceSelection(),
                })}
                type="button"
              >
                Aspirate
              </button>
              <button
                onClick={() => onIntent({
                  type: "dispense",
                  pipetteId: active.definition.id,
                  target: targetSelection(),
                })}
                type="button"
              >
                Dispense
              </button>
              <button
                onClick={() => onIntent({
                  type: "mix",
                  pipetteId: active.definition.id,
                  target: targetSelection(),
                  cycles: 3,
                })}
                type="button"
              >
                Mix 3 cycles
              </button>
            </div>
          </fieldset>
        </form>

        <aside className="assay-pipetting__state" aria-label="Pipette runtime state">
          <h3>Runtime state</h3>
          <dl>
            <div><dt>Pipette</dt><dd>{active.definition.label}</dd></div>
            <div><dt>Set volume</dt><dd>{active.runtime.setVolume.value} {active.runtime.setVolume.unit}</dd></div>
            <div><dt>Status</dt><dd>{active.runtime.status}</dd></div>
            <div><dt>Attached</dt><dd>{active.runtime.attachedTips.length} {attachedTipLabel}</dd></div>
            <div><dt>Tip policy</dt><dd>{state.tipReusePolicy.mode}</dd></div>
          </dl>
          {active.runtime.status === "invalid" && (
            <button
              onClick={() => onIntent({
                type: "recoverInvalid",
                pipetteId: active.definition.id,
                confirmDiscard: true,
              })}
              type="button"
            >
              Discard contents and recover
            </button>
          )}
          <p className="assay-pipetting__boundary">
            Nominal deterministic volumes only. This rehearsal does not model stochastic accuracy,
            carryover amount, air gaps, reverse pipetting, or hardware control.
          </p>
        </aside>
      </div>

      <div
        className={`assay-pipetting__feedback${visibleLastTransition?.accepted === false ? " is-error" : ""}`}
        role={visibleLastTransition?.accepted === false ? "alert" : "status"}
      >
        {visibleLastTransition
          ? visibleLastTransition.diagnostics[0]?.message ?? visibleLastTransition.evidence.summary
          : "Ready. Choose a pipette setup and transfer selection."}
      </div>

      <section className="assay-pipetting__trace" aria-labelledby="assay-transfer-trace-title">
        <div>
          <h3 id="assay-transfer-trace-title">Transfer trace</h3>
          <span>{transitions.length} runtime event{transitions.length === 1 ? "" : "s"}</span>
        </div>
        {transitions.length === 0 ? (
          <p>No liquid-handling operations have been attempted.</p>
        ) : (
          <div className="assay-pipetting__trace-scroll">
            <table>
              <caption>Accepted and rejected runtime operations in attempted order</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Operation</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Objects</th>
                  <th scope="col">Exact details</th>
                </tr>
              </thead>
              <tbody>
                {transitions.map(({ evidence }, index) => (
                  <tr key={`${evidence.operationId}:${index}`}>
                    <th scope="row">{index + 1}</th>
                    <td>{evidence.operationType}</td>
                    <td>{evidence.outcome}</td>
                    <td>{evidence.summary}</td>
                    <td>{evidence.objectRefs.join(", ") || "None"}</td>
                    <td>{evidenceDetails(evidence) || "No additional data"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
};

/**
 * Thin stateful bridge around the pure assay runtime. The workbench owns only
 * form selections; all liquid, tip, plate, diagnostic, and evidence state is
 * returned by `dispatchAssayRuntimeIntent`.
 */
export const AssayPipettingRehearsal = ({
  initialState,
  onStateChange,
  onTransition,
}: AssayPipettingRehearsalProps) => {
  const [runtimeState, setRuntimeState] = useState(() => structuredClone(initialState));
  const runtimeStateRef = useRef(runtimeState);
  const [transitions, setTransitions] = useState<AssayRuntimeTransition[]>([]);

  const handleIntent = (intent: AssayRuntimeIntent) => {
    const transition = dispatchAssayRuntimeIntent(runtimeStateRef.current, intent);
    runtimeStateRef.current = transition.state;
    setRuntimeState(transition.state);
    setTransitions((current) => [...current, transition]);
    onStateChange?.(transition.state);
    onTransition?.(transition);
  };

  return (
    <AssayPipettingWorkbench
      lastTransition={transitions.at(-1)}
      onIntent={handleIntent}
      state={runtimeState}
      transitions={transitions}
    />
  );
};
