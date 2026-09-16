import type { ProcessNode, ValidationRule, ValidationType } from "../domain/types";

const validationTypes: ValidationType[] = [
  "actionEvidence",
  "measurementRecorded",
  "notebookEntry",
  "calculationWithinTolerance",
  "statePath",
  "processCompleted",
];

const updateRule = (
  node: ProcessNode,
  ruleId: string,
  update: (rule: ValidationRule) => ValidationRule,
): ProcessNode => ({
  ...node,
  validation: node.validation.map((rule) => (rule.id === ruleId ? update(rule) : rule)),
});

export const ValidationInspector = ({
  mode = "advanced",
  node,
  onChange,
}: {
  mode?: "guided" | "advanced";
  node: ProcessNode;
  onChange: (node: ProcessNode) => void;
}) => (
  <section className="validation-inspector">
    <div className="panel-heading">
      <h3>Validation</h3>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...node,
            validation: [
              ...node.validation,
              {
                id: `${node.id}-rule-${node.validation.length + 1}`,
                type: "actionEvidence",
                label: "Action completed.",
                actionId: node.actionId,
              },
            ],
          })
        }
      >
        Add rule
      </button>
    </div>
    {node.validation.map((rule) => (
      <div className="validation-row editable" key={rule.id}>
        <label>
          Type
          <select
            value={rule.type}
            onChange={(event) =>
              onChange(
                updateRule(node, rule.id, (current) => ({
                  ...current,
                  type: event.target.value as ValidationType,
                })),
              )
            }
          >
            {validationTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Label
          <input
            value={rule.label}
            onChange={(event) =>
              onChange(updateRule(node, rule.id, (current) => ({ ...current, label: event.target.value })))
            }
          />
        </label>
        {(mode === "advanced" || rule.type === "actionEvidence") ? (
          <label>
            Action ID
            <input
              value={rule.actionId ?? ""}
              onChange={(event) =>
                onChange(
                  updateRule(node, rule.id, (current) => ({
                    ...current,
                    actionId: event.target.value || undefined,
                  })),
                )
              }
            />
          </label>
        ) : null}
        {(mode === "advanced" || rule.type === "measurementRecorded") ? (
          <label>
            Measurement ID
            <input
              value={rule.measurementId ?? ""}
              onChange={(event) =>
                onChange(
                  updateRule(node, rule.id, (current) => ({
                    ...current,
                    measurementId: event.target.value || undefined,
                  })),
                )
              }
            />
          </label>
        ) : null}
        {(mode === "advanced" || rule.type === "calculationWithinTolerance") ? (
          <>
            <label>
              Calculation ID
              <input
                value={rule.calculationId ?? ""}
                onChange={(event) =>
                  onChange(
                    updateRule(node, rule.id, (current) => ({
                      ...current,
                      calculationId: event.target.value || undefined,
                    })),
                  )
                }
              />
            </label>
            <label>
              Calculation tolerance
              <input
                type="number"
                value={rule.tolerance ?? ""}
                onChange={(event) =>
                  onChange(
                    updateRule(node, rule.id, (current) => ({
                      ...current,
                      tolerance: event.target.value ? Number(event.target.value) : undefined,
                    })),
                  )
                }
              />
            </label>
          </>
        ) : null}
        {(mode === "advanced" || rule.type === "statePath") ? (
          <>
            <label>
              State condition
              <input
                value={rule.path ?? ""}
                placeholder="state.equipment.instance.field"
                onChange={(event) =>
                  onChange(
                    updateRule(node, rule.id, (current) => ({
                      ...current,
                      path: event.target.value || undefined,
                    })),
                  )
                }
              />
            </label>
            <label>
              Expected value
              <input
                value={rule.equals === undefined ? "" : String(rule.equals)}
                onChange={(event) =>
                  onChange(
                    updateRule(node, rule.id, (current) => ({
                      ...current,
                      equals: event.target.value || undefined,
                    })),
                  )
                }
              />
            </label>
          </>
        ) : null}
      </div>
    ))}
  </section>
);
