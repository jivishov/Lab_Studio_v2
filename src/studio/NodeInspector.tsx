import { useId, useState } from "react";
import { PanelRightClose, Pin, PinOff } from "lucide-react";
import {
  compatibleInteractionVerbs,
  defaultInteractionForAction,
  interactionOperationTypes,
  interactionStationIds,
} from "../domain/interactions";
import { getProcessNodeLayout } from "../domain/processLayout";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  ActionInteractionType,
  ActionVerb,
  LabDefinition,
  ProcessNode,
} from "../domain/types";
import { equipmentById, v1EquipmentCatalog } from "../equipment/catalog";
import { collectStudioEquipmentIds } from "./studioValidation";
import { ValidationInspector } from "./ValidationInspector";

interface NodeInspectorProps {
  draft: LabDefinition;
  isPinned: boolean;
  node?: ProcessNode;
  onActionChange: (action: ActionDefinition) => void;
  onChange: (node: ProcessNode) => void;
  onClose: () => void;
  onRenameTechnicalId: (from: string, to: string) => void;
  onTogglePinned: () => void;
}

type InspectorTab = "step" | "interaction" | "completion";

const inspectorTabs: { id: InspectorTab; label: string }[] = [
  { id: "step", label: "Step" },
  { id: "interaction", label: "Interaction" },
  { id: "completion", label: "Completion" },
];

const nodeTypes: Array<{ value: ProcessNode["type"]; label: string }> = [
  { value: "action", label: "Instruction" },
  { value: "technique", label: "Workflow" },
  { value: "checkpoint", label: "Checkpoint / quiz" },
  { value: "decision", label: "Decision / branch" },
  { value: "calculation", label: "Calculation" },
  { value: "observation", label: "Observation / data collection" },
  { value: "teacherNote", label: "Teacher note" },
];

const actionVerbs: ActionVerb[] = [
  "place",
  "weigh",
  "measureVolume",
  "transfer",
  "dissolve",
  "precipitate",
  "dilute",
  "filter",
  "spotSample",
  "developChromatogram",
  "rinse",
  "dry",
  "heat",
  "cool",
  "stressEquilibrium",
  "observe",
  "record",
  "calculate",
  "reset",
];

const stationFieldTypes = new Set<ActionInteractionType>([
  "dragToZone",
  "placeInInstrument",
  "readInstrument",
]);

const snapZoneFieldTypes = new Set<ActionInteractionType>([
  "snapIntoTarget",
  "placeInInstrument",
]);

const valueParameterFieldTypes = new Set<ActionInteractionType>([
  "readInstrument",
  "recordNotebook",
  "recordTimeSeries",
  "submitCalculation",
]);

const titleCase = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const valueToInput = (value: ActionDefinition["parameters"][string]): string =>
  Array.isArray(value) ? value.join("\n") : value === undefined ? "" : String(value);

const inputToValue = (
  text: string,
  previous: ActionDefinition["parameters"][string],
): ActionDefinition["parameters"][string] => {
  if (Array.isArray(previous)) return text.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  if (typeof previous === "number") {
    const value = Number(text);
    return Number.isFinite(value) ? value : previous;
  }
  if (typeof previous === "boolean") return text === "true";
  return text;
};

const generatedAccessibleLabel = (
  action: ActionDefinition,
  interaction: ActionInteractionSpec,
): string => {
  const source = interaction.sourceDefinitionId ? equipmentLabel(interaction.sourceDefinitionId) : undefined;
  const target = interaction.targetDefinitionId ? equipmentLabel(interaction.targetDefinitionId) : undefined;
  if (source && target) return `${titleCase(action.verb)} ${source} with ${target}.`;
  if (source) return `${titleCase(action.verb)} ${source}.`;
  return action.label;
};

const parseParameterJson = (
  text: string,
  fallback: ActionDefinition["parameters"],
): ActionDefinition["parameters"] => {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ActionDefinition["parameters"];
    }
  } catch {
    throw new Error("Parameters must be a JSON object.");
  }
  throw new Error("Parameters must be a JSON object.");
};

const optionalString = (value: string): string | undefined =>
  value.trim().length > 0 ? value : undefined;

const parseRequiredStateJson = (
  text: string,
  fallback: ActionInteractionSpec["requiredState"],
): ActionInteractionSpec["requiredState"] => {
  if (text.trim().length === 0) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed).filter(
        (entry): entry is [string, string | number | boolean] =>
          typeof entry[1] === "string" ||
          typeof entry[1] === "number" ||
          typeof entry[1] === "boolean",
      );
      return Object.fromEntries(entries);
    }
  } catch {
    throw new Error("Required state must be a JSON object with primitive values.");
  }
  if (fallback) return fallback;
  throw new Error("Required state must be a JSON object with primitive values.");
};

const requiredStateText = (interaction: ActionInteractionSpec): string =>
  interaction.requiredState ? JSON.stringify(interaction.requiredState, null, 2) : "";

const equipmentLabel = (id: string): string => equipmentById.get(id)?.label ?? id;

const snapZoneOptions = (targetDefinitionId?: string, currentSnapZoneId?: string) => {
  const definitions = targetDefinitionId
    ? v1EquipmentCatalog.filter((definition) => definition.id === targetDefinitionId)
    : v1EquipmentCatalog;
  const options = definitions.flatMap((definition) =>
    definition.snapZones.map((zone) => ({
      id: zone.id,
      label: `${equipmentLabel(definition.id)}: ${zone.label}`,
    })),
  );
  if (currentSnapZoneId && !options.some((option) => option.id === currentSnapZoneId)) {
    return [{ id: currentSnapZoneId, label: currentSnapZoneId }, ...options];
  }
  return options;
};

export const NodeInspector = ({
  draft,
  isPinned,
  node,
  onActionChange,
  onChange,
  onClose,
  onRenameTechnicalId,
  onTogglePinned,
}: NodeInspectorProps) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>("step");
  const [parameterJsonError, setParameterJsonError] = useState<string | null>(null);
  const [requiredStateJsonError, setRequiredStateJsonError] = useState<string | null>(null);
  const [validationJsonError, setValidationJsonError] = useState<string | null>(null);
  const [nodeRenameValue, setNodeRenameValue] = useState("");
  const [actionRenameValue, setActionRenameValue] = useState("");
  const inspectorId = useId();
  const inspectorClassName = `node-inspector ${isPinned ? "is-pinned" : "is-floating"}`;
  const tabId = (tab: InspectorTab) => `${inspectorId}-${tab}-tab`;
  const panelId = (tab: InspectorTab) => `${inspectorId}-${tab}-panel`;
  const inspectorControls = (
    <div className="inspector-actions">
      <button
        type="button"
        aria-label={isPinned ? "Unpin details" : "Pin details"}
        title={isPinned ? "Unpin details" : "Pin details"}
        onClick={onTogglePinned}
      >
        {isPinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
      </button>
      <button type="button" aria-label="Collapse details" title="Collapse details" onClick={onClose}>
        <PanelRightClose size={14} aria-hidden="true" />
      </button>
    </div>
  );

  if (!node) {
    return (
      <aside className={inspectorClassName}>
        <div className="panel-heading inspector-heading">
          <div className="inspector-heading-title">
            <h2>Details</h2>
          </div>
          {inspectorControls}
        </div>
        <p className="empty-state">Select a process node to edit its structured fields.</p>
      </aside>
    );
  }

  const action = draft.actions.find((candidate) => candidate.id === node.actionId);
  const equipmentIds = collectStudioEquipmentIds(draft);
  const stationIds = Array.from(new Set([...interactionStationIds, ...equipmentIds]));
  const nodeIndex = draft.process.nodes.findIndex((candidate) => candidate.id === node.id);
  const layout = getProcessNodeLayout(node, Math.max(0, nodeIndex));

  const updateInteraction = (
    currentAction: ActionDefinition,
    interaction: ActionInteractionSpec,
    update: Partial<ActionInteractionSpec>,
  ) => {
    onActionChange({
      ...currentAction,
      interaction: {
        ...interaction,
        ...update,
      },
    });
  };

  const addInteraction = (currentAction: ActionDefinition) => {
    const interaction =
      defaultInteractionForAction(currentAction) ??
      ({
        type: "dragToZone",
        stationId: "workbench",
        accessibleLabel: currentAction.label,
      } satisfies ActionInteractionSpec);
    onActionChange({ ...currentAction, interaction });
  };

  const updateLayout = (update: Partial<NonNullable<ProcessNode["layout"]>>) => {
    onChange({
      ...node,
      layout: {
        ...layout,
        ...node.layout,
        ...update,
      },
    });
  };

  return (
    <aside className={inspectorClassName}>
      <div className="panel-heading inspector-heading">
        <div className="inspector-heading-title">
          <h2>Details</h2>
          <span>{node.type}</span>
        </div>
        {inspectorControls}
      </div>
      <div className="inspector-tab-shell">
        <div
          className="inspector-tab-list"
          role="tablist"
          aria-label="Details sections"
          aria-orientation="horizontal"
        >
          {inspectorTabs.map((tab) => (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-controls={panelId(tab.id)}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="inspector-tab-content">
          <section
            className="inspector-tab-panel"
            id={panelId("step")}
            role="tabpanel"
            aria-labelledby={tabId("step")}
            hidden={activeTab !== "step"}
          >
            <label>
              Step title
              <input value={node.title} onChange={(event) => onChange({ ...node, title: event.target.value })} />
              <small className="studio-character-guidance">{node.title.length} / 100 suggested</small>
            </label>
            <label>
              Step type
              <select value={node.type} onChange={(event) => onChange({ ...node, type: event.target.value as ProcessNode["type"] })}>
                {nodeTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="studio-instruction-field">
              Step instructions
              <textarea
                value={node.description}
                onChange={(event) => onChange({ ...node, description: event.target.value })}
              />
            </label>
            {action ? (
              <div className="action-editor">
                <div className="panel-heading">
                  <h3>Operation</h3>
                  <span>{titleCase(action.verb)}</span>
                </div>
                <label>
                  Operation type
                  <select
                    value={action.verb}
                    onChange={(event) => {
                      const nextAction = { ...action, verb: event.target.value as ActionVerb };
                      onActionChange({
                        ...nextAction,
                        interaction: defaultInteractionForAction(nextAction) ?? nextAction.interaction,
                      });
                    }}
                  >
                    {actionVerbs.map((verb) => (
                      <option key={verb} value={verb}>
                        {titleCase(verb)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Action label
                  <input
                    value={action.label}
                    onChange={(event) => onActionChange({ ...action, label: event.target.value })}
                  />
                </label>
                {Object.entries(action.parameters).length ? (
                  <div className="parameter-grid" aria-label="Operation-specific parameters">
                    {Object.entries(action.parameters).map(([key, value]) => (
                      <label key={key}>
                        {titleCase(key)}
                        {typeof value === "boolean" ? (
                          <select
                            value={String(value)}
                            onChange={(event) =>
                              onActionChange({
                                ...action,
                                parameters: {
                                  ...action.parameters,
                                  [key]: inputToValue(event.target.value, value),
                                },
                              })
                            }
                          >
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : (
                          <input
                            type={typeof value === "number" ? "number" : "text"}
                            value={valueToInput(value)}
                            onChange={(event) =>
                              onActionChange({
                                ...action,
                                parameters: {
                                  ...action.parameters,
                                  [key]: inputToValue(event.target.value, value),
                                },
                              })
                            }
                          />
                        )}
                      </label>
                    ))}
                  </div>
                ) : null}
                <label>
                  Hint
                  <input
                    value={node.hints[0] ?? ""}
                    onChange={(event) => onChange({ ...node, hints: [event.target.value].filter(Boolean) })}
                  />
                </label>
                <label>
                  Success message
                  <input
                    value={node.feedback.success}
                    onChange={(event) =>
                      onChange({ ...node, feedback: { ...node.feedback, success: event.target.value } })
                    }
                  />
                </label>
                <label>
                  Retry message
                  <input
                    value={node.feedback.retry}
                    onChange={(event) =>
                      onChange({ ...node, feedback: { ...node.feedback, retry: event.target.value } })
                    }
                  />
                </label>
                <label>
                  Invalid message
                  <input
                    value={action.feedback.invalid}
                    onChange={(event) =>
                      onActionChange({
                        ...action,
                        feedback: { ...action.feedback, invalid: event.target.value },
                      })
                    }
                  />
                </label>
              </div>
            ) : (
              <p className="empty-state">This step does not have a linked action. Link one in Advanced.</p>
            )}
          </section>
          <section
            className="inspector-tab-panel"
            id={panelId("interaction")}
            role="tabpanel"
            aria-labelledby={tabId("interaction")}
            hidden={activeTab !== "interaction"}
          >
            <section className="interaction-editor">
              <div className="panel-heading">
                <h3>Interaction</h3>
                <span>{action?.interaction?.type ?? "not set"}</span>
              </div>
              {!action ? (
                <p className="empty-state">This node does not have a linked action. Set an action ID in Advanced.</p>
              ) : action.interaction ? (
                <>
                  <label>
                    Operation type
                    <select
                      value={action.interaction.type}
                      onChange={(event) =>
                        updateInteraction(action, action.interaction!, {
                          type: event.target.value as ActionInteractionType,
                        })
                      }
                    >
                      {interactionOperationTypes
                        .filter((type) =>
                          compatibleInteractionVerbs[type].includes(action.verb) ||
                          type === action.interaction?.type
                        )
                        .map((type) => (
                        <option key={type} value={type}>
                          {titleCase(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="interaction-grid">
                    <label>
                      Source equipment
                      <select
                        value={action.interaction.sourceDefinitionId ?? ""}
                        onChange={(event) =>
                          updateInteraction(action, action.interaction!, {
                            sourceDefinitionId: optionalString(event.target.value),
                          })
                        }
                      >
                        <option value="">None</option>
                        {equipmentIds.map((id) => (
                          <option key={id} value={id}>
                            {equipmentLabel(id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Target equipment
                      <select
                        value={action.interaction.targetDefinitionId ?? ""}
                        onChange={(event) =>
                          updateInteraction(action, action.interaction!, {
                            targetDefinitionId: optionalString(event.target.value),
                            snapZoneId:
                              event.target.value === action.interaction?.targetDefinitionId
                                ? action.interaction.snapZoneId
                                : undefined,
                          })
                        }
                      >
                        <option value="">None</option>
                        {equipmentIds.map((id) => (
                          <option key={id} value={id}>
                            {equipmentLabel(id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {stationFieldTypes.has(action.interaction.type) ? (
                      <label>
                        Station
                        <select
                          value={action.interaction.stationId ?? ""}
                          onChange={(event) =>
                            updateInteraction(action, action.interaction!, {
                              stationId: optionalString(event.target.value),
                            })
                          }
                        >
                          <option value="">None</option>
                          {stationIds.map((id) => (
                            <option key={id} value={id}>
                              {equipmentLabel(id)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {snapZoneFieldTypes.has(action.interaction.type) ? (
                      <label>
                        Snap zone
                        <select
                          value={action.interaction.snapZoneId ?? ""}
                          onChange={(event) =>
                            updateInteraction(action, action.interaction!, {
                              snapZoneId: optionalString(event.target.value),
                            })
                          }
                        >
                          <option value="">None</option>
                          {snapZoneOptions(
                            action.interaction.targetDefinitionId,
                            action.interaction.snapZoneId,
                          ).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {valueParameterFieldTypes.has(action.interaction.type) ? (
                      <label>
                        Generated value field
                        <select
                          value={action.interaction.valueParameter ?? ""}
                          onChange={(event) =>
                            updateInteraction(action, action.interaction!, {
                              valueParameter: optionalString(event.target.value),
                            })
                          }
                        >
                          <option value="">None</option>
                          {Object.keys(action.parameters).map((key) => (
                            <option key={key} value={key}>
                              {titleCase(key)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label>
                      Invalid cue
                      <input
                        value={action.interaction.invalidCue ?? ""}
                        onChange={(event) =>
                          updateInteraction(action, action.interaction!, {
                            invalidCue: optionalString(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Accessible label
                    <input
                      value={action.interaction.accessibleLabel}
                      onChange={(event) =>
                        updateInteraction(action, action.interaction!, {
                          accessibleLabel: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() =>
                      updateInteraction(action, action.interaction!, {
                        accessibleLabel: generatedAccessibleLabel(action, action.interaction!),
                      })
                    }
                  >
                    Generate accessible label
                  </button>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => onActionChange({ ...action, interaction: undefined })}
                  >
                    Remove interaction
                  </button>
                </>
              ) : (
                <div className="interaction-empty">
                  <p>No explicit interaction spec.</p>
                  <button type="button" onClick={() => addInteraction(action)}>
                    Add interaction
                  </button>
                </div>
              )}
            </section>
          </section>
          <section
            className="inspector-tab-panel"
            id={panelId("completion")}
            role="tabpanel"
            aria-labelledby={tabId("completion")}
            hidden={activeTab !== "completion"}
          >
            <ValidationInspector node={node} onChange={onChange} mode="guided" />
          </section>
          <details className="inspector-advanced-disclosure">
            <summary>Advanced technical fields</summary>
            <section className="inspector-tab-panel inspector-advanced-panel">
            <div className="advanced-id-grid">
              <label>
                Technical node ID
                <input value={node.id} readOnly />
              </label>
              <label>
                Rename node ID
                <input value={nodeRenameValue} onChange={(event) => setNodeRenameValue(event.target.value)} />
              </label>
              <button
                className="secondary-action"
                type="button"
                disabled={!nodeRenameValue.trim()}
                onClick={() => {
                  onRenameTechnicalId(node.id, nodeRenameValue.trim());
                  setNodeRenameValue("");
                }}
              >
                Rename node
              </button>
              <label>
                Technical action ID
                <input value={action?.id ?? ""} readOnly />
              </label>
              <label>
                Linked action ID
                <input
                  value={node.actionId ?? ""}
                  onChange={(event) => onChange({ ...node, actionId: event.target.value || undefined })}
                />
              </label>
              {action ? (
                <>
                  <label>
                    Rename action ID
                    <input value={actionRenameValue} onChange={(event) => setActionRenameValue(event.target.value)} />
                  </label>
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={!actionRenameValue.trim()}
                    onClick={() => {
                      onRenameTechnicalId(action.id, actionRenameValue.trim());
                      setActionRenameValue("");
                    }}
                  >
                    Rename action
                  </button>
                </>
              ) : null}
            </div>
            {action ? (
              <>
                <label>
                  Raw parameters JSON
                  <textarea
                    key={`${action.id}-parameters`}
                    defaultValue={JSON.stringify(action.parameters, null, 2)}
                    onBlur={(event) => {
                      try {
                        setParameterJsonError(null);
                        onActionChange({
                          ...action,
                          parameters: parseParameterJson(event.currentTarget.value, action.parameters),
                        });
                      } catch {
                        setParameterJsonError("Parameters must be a JSON object.");
                      }
                    }}
                  />
                </label>
                {parameterJsonError ? <p className="field-error">{parameterJsonError}</p> : null}
                <label>
                  Raw required-state JSON
                  <textarea
                    key={`${action.id}-required-state`}
                    defaultValue={requiredStateText(action.interaction ?? ({ type: "dragToZone", accessibleLabel: "" } as ActionInteractionSpec))}
                    onBlur={(event) => {
                      if (!action.interaction) return;
                      try {
                        const parsed = parseRequiredStateJson(
                          event.currentTarget.value,
                          action.interaction.requiredState,
                        );
                        setRequiredStateJsonError(null);
                        updateInteraction(action, action.interaction, { requiredState: parsed });
                      } catch {
                        setRequiredStateJsonError("Required state must be a JSON object with primitive values.");
                      }
                    }}
                  />
                </label>
                {requiredStateJsonError ? <p className="field-error">{requiredStateJsonError}</p> : null}
                <label>
                  State changes
                  <textarea
                    value={action.stateChanges.join("\n")}
                    onChange={(event) =>
                      onActionChange({
                        ...action,
                        stateChanges: event.target.value.split("\n").filter(Boolean),
                      })
                    }
                  />
                </label>
              </>
            ) : null}
            <div className="layout-grid" aria-label="Node layout">
              <label>
                Layout X
                <input type="number" value={layout.x} onChange={(event) => updateLayout({ x: Number(event.target.value) })} />
              </label>
              <label>
                Layout Y
                <input type="number" value={layout.y} onChange={(event) => updateLayout({ y: Number(event.target.value) })} />
              </label>
              <label>
                Lane
                <input value={layout.lane ?? ""} onChange={(event) => updateLayout({ lane: optionalString(event.target.value) })} />
              </label>
              <label>
                Display
                <select
                  value={layout.display ?? "expanded"}
                  onChange={(event) =>
                    updateLayout({ display: event.target.value as NonNullable<ProcessNode["layout"]>["display"] })
                  }
                >
                  <option value="expanded">Expanded</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </div>
            <ValidationInspector node={node} onChange={onChange} mode="advanced" />
            <label>
              Raw validation JSON
              <textarea
                key={`${node.id}-validation-json`}
                defaultValue={JSON.stringify(node.validation, null, 2)}
                onBlur={(event) => {
                  try {
                    const parsed = JSON.parse(event.currentTarget.value) as unknown;
                    if (!Array.isArray(parsed)) {
                      setValidationJsonError("Validation JSON must be an array.");
                      return;
                    }
                    setValidationJsonError(null);
                    onChange({ ...node, validation: parsed as typeof node.validation });
                  } catch {
                    setValidationJsonError("Validation JSON must parse before it can be committed.");
                  }
                }}
              />
            </label>
            {validationJsonError ? <p className="field-error">{validationJsonError}</p> : null}
            </section>
          </details>
        </div>
      </div>
    </aside>
  );
};
