import { useMemo, useState, type FormEvent } from "react";
import {
  assignControlToWells,
  projectAssayAssignmentChange,
  upsertAssayControl,
  upsertReplicateGroupAssignment,
  type AssayAssignmentChangeEvidencePayload,
} from "../../domain-packs/assay";
import type {
  AssayControlDefinition,
  AssayDefinition,
  ReplicateGroupDefinition,
  WellRole,
} from "../../domain-packs/assay/types";

const controlRoles: WellRole[] = [
  "blank",
  "negativeControl",
  "positiveControl",
  "vehicleControl",
  "growthControl",
  "sterilityControl",
  "qualityControl",
];

const parseCoordinates = (value: string): string[] =>
  [...new Set(value.split(/[\s,]+/).map((entry) => entry.trim().toUpperCase()).filter(Boolean))];

export interface AssayControlReplicateEditorProps {
  assay: AssayDefinition;
  onChange: (assay: AssayDefinition) => void;
}

export const AssayControlReplicateEditor = ({
  assay,
  onChange,
}: AssayControlReplicateEditorProps) => {
  const initialControl = assay.controls[0];
  const [controlId, setControlId] = useState(assay.controls[0]?.id ?? "control-new");
  const [controlLabel, setControlLabel] = useState(assay.controls[0]?.label ?? "New control");
  const [controlRole, setControlRole] = useState<WellRole>(assay.controls[0]?.role ?? "qualityControl");
  const [controlDirection, setControlDirection] = useState<AssayControlDefinition["expectedDirection"]>(
    initialControl?.expectedDirection,
  );
  const [controlInterpretation, setControlInterpretation] = useState(
    assay.controls[0]?.interpretation ?? "Author-supplied interpretation; no threshold is inferred.",
  );
  const [controlCoordinates, setControlCoordinates] = useState("A1");
  const [groupId, setGroupId] = useState(assay.replicateGroups[0]?.id ?? "replicate-new");
  const [groupType, setGroupType] = useState<ReplicateGroupDefinition["type"]>("technical");
  const [groupMinimum, setGroupMinimum] = useState("2");
  const [groupAggregation, setGroupAggregation] = useState<ReplicateGroupDefinition["aggregation"]>("mean");
  const [groupMetric, setGroupMetric] = useState<ReplicateGroupDefinition["variabilityMetric"]>("cv");
  const [groupCoordinates, setGroupCoordinates] = useState("A2, A3");
  const [message, setMessage] = useState(
    "Assignments are explicit artifact edits. No control meaning or replicate threshold is inferred.",
  );
  const [history, setHistory] = useState<AssayAssignmentChangeEvidencePayload[]>([]);

  const controlCounts = useMemo(() => new Map(assay.controls.map((control) => [
    control.id,
    assay.plate.wells.filter(({ controlRef }) => controlRef === control.id).length,
  ])), [assay.controls, assay.plate.wells]);

  const applyControl = (event: FormEvent) => {
    event.preventDefault();
    const coordinates = parseCoordinates(controlCoordinates);
    const definition: AssayControlDefinition = {
      id: controlId.trim(),
      role: controlRole,
      label: controlLabel.trim(),
      ...(controlDirection ? { expectedDirection: controlDirection } : {}),
      requiredByProfile: false,
      interpretation: controlInterpretation.trim(),
    };
    try {
      const withDefinition = upsertAssayControl(assay, definition);
      const next = assignControlToWells(withDefinition, definition.id, coordinates);
      const evidence = projectAssayAssignmentChange({
        assignmentId: `control-assignment-${history.length + 1}`,
        assignmentType: "control",
        targetRef: definition.id,
        wellIds: next.plate.wells.filter(({ coordinate }) => coordinates.includes(coordinate)).map(({ id }) => id),
        accepted: true,
        summary: `Assigned ${definition.id} to ${coordinates.join(", ")}.`,
      });
      setHistory((current) => [...current, evidence]);
      setMessage(evidence.summary);
      onChange(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Control assignment was rejected.");
    }
  };

  const applyReplicate = (event: FormEvent) => {
    event.preventDefault();
    const coordinates = parseCoordinates(groupCoordinates);
    const minimumCount = Number.parseInt(groupMinimum, 10);
    try {
      const next = upsertReplicateGroupAssignment(
        assay,
        {
          id: groupId.trim(),
          type: groupType,
          minimumCount,
          aggregation: groupAggregation,
          ...(groupMetric ? { variabilityMetric: groupMetric } : {}),
        },
        coordinates,
      );
      const group = next.replicateGroups.find(({ id }) => id === groupId.trim())!;
      const evidence = projectAssayAssignmentChange({
        assignmentId: `replicate-assignment-${history.length + 1}`,
        assignmentType: "replicate-group",
        targetRef: group.id,
        wellIds: group.memberWellIds,
        accepted: true,
        summary: `Assigned ${group.id} to ${coordinates.join(", ")} with minimum count ${minimumCount}.`,
      });
      setHistory((current) => [...current, evidence]);
      setMessage(evidence.summary);
      onChange(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Replicate assignment was rejected.");
    }
  };

  return (
    <section className="assay-assignment-editor" aria-labelledby="assay-assignment-heading">
      <header>
        <div>
          <span className="assay-eyebrow">Cycle 08 · controls and replicates</span>
          <h2 id="assay-assignment-heading">Explicit assignment editor</h2>
          <p>
            Define the scientific role and reciprocal well membership directly. Protocol-required
            counts and QC thresholds remain separate versioned rule data.
          </p>
        </div>
        <span>{assay.controls.length} controls · {assay.replicateGroups.length} groups</span>
      </header>

      <div className="assay-assignment-editor__forms">
        <form onSubmit={applyControl}>
          <fieldset>
            <legend>Control definition and wells</legend>
            <label>
              Control ID
              <input required value={controlId} onChange={(event) => setControlId(event.target.value)} />
            </label>
            <label>
              Label
              <input required value={controlLabel} onChange={(event) => setControlLabel(event.target.value)} />
            </label>
            <label>
              Role
              <select value={controlRole} onChange={(event) => setControlRole(event.target.value as WellRole)}>
                {controlRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label>
              Expected direction (optional)
              <select
                value={controlDirection ?? ""}
                onChange={(event) => setControlDirection(
                  (event.target.value || undefined) as AssayControlDefinition["expectedDirection"],
                )}
              >
                <option value="">Not declared</option>
                {["high", "low", "zero", "growth", "no-growth"].map((direction) => (
                  <option key={direction} value={direction}>{direction}</option>
                ))}
              </select>
            </label>
            <label className="assay-assignment-editor__wide">
              Interpretation
              <input
                required
                value={controlInterpretation}
                onChange={(event) => setControlInterpretation(event.target.value)}
              />
            </label>
            <label className="assay-assignment-editor__wide">
              Well coordinates
              <input
                aria-describedby="control-coordinate-help"
                required
                value={controlCoordinates}
                onChange={(event) => setControlCoordinates(event.target.value)}
              />
              <small id="control-coordinate-help">Comma or space separated, for example A1, A2, A3.</small>
            </label>
            <button type="submit">Save and assign control</button>
          </fieldset>
        </form>

        <form onSubmit={applyReplicate}>
          <fieldset>
            <legend>Replicate group and wells</legend>
            <label>
              Group ID
              <input required value={groupId} onChange={(event) => setGroupId(event.target.value)} />
            </label>
            <label>
              Type
              <select
                value={groupType}
                onChange={(event) => setGroupType(event.target.value as ReplicateGroupDefinition["type"])}
              >
                <option value="technical">Technical</option>
                <option value="biological">Biological</option>
                <option value="independent-run">Independent run</option>
              </select>
            </label>
            <label>
              Minimum count
              <input
                min="1"
                required
                type="number"
                value={groupMinimum}
                onChange={(event) => setGroupMinimum(event.target.value)}
              />
            </label>
            <label>
              Aggregation
              <select
                value={groupAggregation}
                onChange={(event) => setGroupAggregation(event.target.value as ReplicateGroupDefinition["aggregation"])}
              >
                <option value="mean">Mean</option>
                <option value="median">Median</option>
                <option value="none">None</option>
              </select>
            </label>
            <label>
              Variability
              <select
                value={groupMetric ?? ""}
                onChange={(event) => setGroupMetric(
                  (event.target.value || undefined) as ReplicateGroupDefinition["variabilityMetric"],
                )}
              >
                <option value="">Not configured</option>
                <option value="sd">Sample SD</option>
                <option value="cv">CV</option>
                <option value="range">Range</option>
              </select>
            </label>
            <label className="assay-assignment-editor__wide">
              Well coordinates
              <input required value={groupCoordinates} onChange={(event) => setGroupCoordinates(event.target.value)} />
            </label>
            <button type="submit">Save reciprocal replicate group</button>
          </fieldset>
        </form>
      </div>

      <div className="assay-assignment-editor__summary">
        <div role="status">{message}</div>
        <table>
          <caption>Current explicit control assignments</caption>
          <thead><tr><th scope="col">Control</th><th scope="col">Role</th><th scope="col">Wells</th><th scope="col">Required by profile</th></tr></thead>
          <tbody>
            {assay.controls.map((control) => (
              <tr key={control.id}>
                <th scope="row">{control.label}<small>{control.id}</small></th>
                <td>{control.role}</td>
                <td>{controlCounts.get(control.id) ?? 0}</td>
                <td>{control.requiredByProfile ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
