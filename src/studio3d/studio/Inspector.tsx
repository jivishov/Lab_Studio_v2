import { useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveActionInteraction } from "../../domain/interactions";
import type { EdgeConditionType, ProcessEdge, ProcessNode, ProcessNodeType, TechniqueDefinition, ValidationRule, ValidationType } from "../../domain/types";
import { equipmentById, v1EquipmentCatalog } from "../../equipment/catalog";
import { actionInputField } from "../../runtime/actionInputs";
import type { StudioDiagnostic } from "../../studio/studioReadiness";
import { collectStudioEquipmentIds } from "../../studio/studioValidation";
import { configurationSlots } from "../../data/techniqueConfiguration";
import { createStudioIdAllocator } from "../../studio/studioTransactions";
import { currentWorkflowInstance, workflowConfigurationBlocker, workflowNeedsConfiguration, workflowSourceId } from "../../studio/workflowConfiguration";
import { equipment3dReadiness } from "../equipment3d/readiness";
import { Icon } from "../ui/Icon";
import { ProvenanceChip } from "../ui/ProvenanceChip";
import { CONDITION_GLYPH, CONDITION_LABEL, INTERACTION_ICON, NODE_TYPE_ICON, NODE_TYPE_LABEL, actionEquipment } from "./flowModel";
import { Thumbnail } from "./LibraryPanel";
import { SetupSlotsForm, initialSetupValues, setupComplete } from "./SetupSlotsForm";
import type { Studio3DController } from "./useStudio3DDraft";

/**
 * The inspector (handoff §4.7): understand and adjust on the right. Three tabs group the plan's
 * six areas; the content is the Studio's own. Text fields commit one transaction when they are
 * left (blur or Enter), not per keystroke, so the activity list reads as a list of changes.
 */
export type InspectorTab = "selected" | "setup" | "checks";

const NODE_TYPES: ProcessNodeType[] = ["action", "checkpoint", "decision", "calculation", "observation", "teacherNote", "technique"];
const VALIDATION_TYPES: ValidationType[] = ["actionEvidence", "measurementRecorded", "dataSeriesRecorded", "notebookEntry", "calculationWithinTolerance", "statePath", "processCompleted"];
const CONDITIONS: EdgeConditionType[] = ["always", "validationPassed", "retry", "calculationResult"];

const Section = ({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="s3d-ins-sec">
      <button type="button" className="s3d-ins-sec__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {title}<Icon name={open ? "chevron-up" : "chevron-down"} />
      </button>
      {open ? <div className="s3d-ins-sec__body">{children}</div> : null}
    </section>
  );
};

/** A text field that commits once, when it is left. */
const CommitField = ({ label, value, onCommit, multiline, disabled, mono }: {
  label: string; value: string; onCommit: (value: string) => void; multiline?: boolean; disabled?: boolean; mono?: boolean;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const done = () => { if (draft !== value) onCommit(draft); };
  const common = {
    value: draft,
    disabled,
    className: mono ? "s3d-mono" : undefined,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: done,
  };
  return (
    <label className="s3d-field">
      <span>{label}</span>
      {multiline
        ? <textarea rows={3} {...common} />
        : <input {...common} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />}
    </label>
  );
};

const diagnosticNode = (studio: Studio3DController, d: StudioDiagnostic): string | undefined =>
  d.anchor?.nodeId ?? (d.anchor?.actionId ? studio.draft.process.nodes.find((n) => n.actionId === d.anchor?.actionId)?.id : undefined);

// ------------------------------------------------------------------ Selected: a step

const ValidationEditor = ({ studio, node }: { studio: Studio3DController; node: ProcessNode }) => {
  const disabled = Boolean(studio.readOnly);
  const replace = (validation: ValidationRule[], label: string) =>
    studio.commit(label, [{ type: "replaceNodeValidation", nodeId: node.id, validation }]);
  const update = (index: number, patch: Partial<ValidationRule>) =>
    replace(node.validation.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)), `Edit validation on ${node.title}`);
  const reference = (rule: ValidationRule, index: number) => {
    switch (rule.type) {
      case "actionEvidence":
        return (
          <label className="s3d-field"><span>Action</span>
            <select disabled={disabled} value={rule.actionId ?? ""} onChange={(e) => update(index, { actionId: e.target.value || undefined })}>
              <option value="">Choose…</option>
              {studio.draft.actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
        );
      case "measurementRecorded":
        return <CommitField label="Measurement id" mono disabled={disabled} value={rule.measurementId ?? ""} onCommit={(v) => update(index, { measurementId: v || undefined })} />;
      case "dataSeriesRecorded":
        return <CommitField label="Data series id" mono disabled={disabled} value={rule.dataSeriesId ?? ""} onCommit={(v) => update(index, { dataSeriesId: v || undefined })} />;
      case "notebookEntry":
        return <CommitField label="Notebook tag" mono disabled={disabled} value={rule.notebookTag ?? ""} onCommit={(v) => update(index, { notebookTag: v || undefined })} />;
      case "calculationWithinTolerance":
        return (
          <>
            <CommitField label="Calculation id" mono disabled={disabled} value={rule.calculationId ?? ""} onCommit={(v) => update(index, { calculationId: v || undefined })} />
            <CommitField label="Tolerance" mono disabled={disabled} value={rule.tolerance === undefined ? "" : String(rule.tolerance)}
              onCommit={(v) => update(index, { tolerance: v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Number(v) })} />
          </>
        );
      case "statePath":
        return (
          <>
            <CommitField label="State path" mono disabled={disabled} value={rule.path ?? ""} onCommit={(v) => update(index, { path: v || undefined })} />
            <CommitField label="Equals" mono disabled={disabled} value={rule.equals === undefined ? "" : String(rule.equals)} onCommit={(v) => update(index, { equals: v === "" ? undefined : v })} />
          </>
        );
      default:
        return null;
    }
  };
  return (
    <>
      {node.validation.length === 0 ? <p className="s3d-small">No validation rules. The step completes when its action is done.</p> : null}
      {node.validation.map((rule, index) => (
        <div className="s3d-rule" key={`${rule.id}-${index}`}>
          <div className="s3d-rule__row">
            <select aria-label="Rule type" disabled={disabled} value={rule.type} onChange={(e) => update(index, { type: e.target.value as ValidationType })}>
              {VALIDATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" className="s3d-button s3d-button--icon s3d-button--quiet" aria-label={`Remove rule ${rule.label}`} disabled={disabled}
              onClick={() => replace(node.validation.filter((_, i) => i !== index), `Remove validation from ${node.title}`)}><Icon name="trash" /></button>
          </div>
          <CommitField label="Label" disabled={disabled} value={rule.label} onCommit={(v) => update(index, { label: v })} />
          {reference(rule, index)}
        </div>
      ))}
      <button type="button" className="s3d-button" disabled={disabled} onClick={() => replace([...node.validation, {
        // A fresh id from the Studio's allocator, so it cannot collide with any id in the draft.
        id: createStudioIdAllocator(studio.draft).next(`${node.id}-rule`), type: "actionEvidence", label: "Action completed", ...(node.actionId ? { actionId: node.actionId } : {}),
      }], `Add validation to ${node.title}`)}><Icon name="plus" />Add rule</button>
    </>
  );
};

const StepInspector = ({ studio, node, onPreview, onToast }: {
  studio: Studio3DController; node: ProcessNode; onPreview: (nodeId: string) => void; onToast: (text: string, action?: { label: string; run: () => void }) => void;
}) => {
  const { draft, commit, readOnly } = studio;
  const disabled = Boolean(readOnly);
  const action = node.actionId ? draft.actions.find((a) => a.id === node.actionId) : undefined;
  const interaction = action ? resolveActionInteraction(action) : undefined;
  const input = actionInputField(action);
  const outgoing = draft.process.edges.map((edge, index) => ({ edge, index })).filter(({ edge }) => edge.from === node.id);
  const [branchTo, setBranchTo] = useState("");
  const updateNode = (patch: Partial<ProcessNode>, label: string) => commit(label, [{ type: "updateProcessNode", node: { ...node, ...patch } }]);
  const titleOf = (id: string) => draft.process.nodes.find((n) => n.id === id)?.title ?? id;
  const roles = Object.entries(action?.equipmentRoleBindings ?? {});
  const equipment = actionEquipment(action);
  return (
    <>
      <div className="s3d-eyebrow">{NODE_TYPE_LABEL[node.type]}{action ? ` · ${action.verb}` : ""}</div>
      <div className="s3d-ins-title">{node.title}</div>
      <Section title="Step">
        <CommitField label="Title" disabled={disabled} value={node.title} onCommit={(title) => updateNode({ title }, `Rename step to ${title}`)} />
        <label className="s3d-field"><span>Type</span>
          <select disabled={disabled} value={node.type} onChange={(e) => updateNode({ type: e.target.value as ProcessNodeType }, `Change ${node.title} to ${NODE_TYPE_LABEL[e.target.value as ProcessNodeType]}`)}>
            {NODE_TYPES.map((t) => <option key={t} value={t}>{NODE_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <CommitField label="Instruction" multiline disabled={disabled} value={node.description} onCommit={(description) => updateNode({ description }, `Edit instruction of ${node.title}`)} />
        <CommitField label="Hint (one per line)" multiline disabled={disabled} value={node.hints.join("\n")}
          onCommit={(text) => updateNode({ hints: text.split("\n").map((h) => h.trim()).filter(Boolean) }, `Edit hints of ${node.title}`)} />
        <CommitField label="On success" disabled={disabled} value={node.feedback.success} onCommit={(success) => updateNode({ feedback: { ...node.feedback, success } }, `Edit success feedback of ${node.title}`)} />
        <CommitField label="On retry" disabled={disabled} value={node.feedback.retry} onCommit={(retry) => updateNode({ feedback: { ...node.feedback, retry } }, `Edit retry feedback of ${node.title}`)} />
      </Section>
      {action ? (
        <Section title="Action & interaction">
          <dl className="s3d-kv">
            <dt>Verb</dt><dd className="s3d-mono">{action.verb}</dd>
            <dt>Interaction</dt>
            <dd>
              {interaction ? <><span className="s3d-inline-icon"><Icon name={INTERACTION_ICON[interaction.type] ?? "move"} size={14} /></span><span className="s3d-mono">{interaction.type}</span></> : "—"}
              {interaction && !action.interaction ? <div className="s3d-small">derived from the verb</div> : null}
            </dd>
            {interaction?.snapZoneId ? <><dt>Zone</dt><dd className="s3d-mono">{interaction.snapZoneId}</dd></> : null}
            {interaction?.stationId ? <><dt>Station</dt><dd className="s3d-mono">{interaction.stationId}</dd></> : null}
            <dt>Input</dt>
            <dd>{input ? <>{input.label}{input.unit ? <span className="s3d-mono"> ({input.unit})</span> : null}<div><ProvenanceChip kind={input.role === "teacherConfiguration" ? "teacher" : "entry"} studio /></div></> : "None"}</dd>
          </dl>
          {roles.length ? (
            <div className="s3d-roles">
              <div className="s3d-eyebrow">Equipment roles</div>
              {roles.map(([role, definitionId]) => (
                <div className="s3d-role" key={role}><Thumbnail definitionId={definitionId} size={28} /><span>{equipmentById.get(definitionId)?.label ?? definitionId}<br /><span className="s3d-small s3d-mono">{role}</span></span></div>
              ))}
            </div>
          ) : equipment.length ? (
            <div className="s3d-roles">
              <div className="s3d-eyebrow">Equipment</div>
              {equipment.map((id) => <div className="s3d-role" key={id}><Thumbnail definitionId={id} size={28} /><span>{equipmentById.get(id)?.label ?? id}</span></div>)}
            </div>
          ) : null}
          <CommitField label="Action label" disabled={disabled} value={action.label} onCommit={(label) => commit(`Rename action to ${label}`, [{ type: "updateAction", action: { ...action, label } }])} />
        </Section>
      ) : null}
      <Section title="Validation" defaultOpen={false}>
        <ValidationEditor studio={studio} node={node} />
      </Section>
      {action ? (
        <Section title="Evidence" defaultOpen={false}>
          {action.evidence.length ? <div className="s3d-chips">{action.evidence.map((e) => <span key={e} className="s3d-chip s3d-chip--neutral s3d-mono">{e}</span>)}</div> : <p className="s3d-small">This action records no evidence.</p>}
          <CommitField label="Evidence (comma-separated)" mono disabled={disabled} value={action.evidence.join(", ")}
            onCommit={(text) => commit(`Edit evidence of ${action.label}`, [{ type: "updateAction", action: { ...action, evidence: text.split(",").map((e) => e.trim()).filter(Boolean) } }])} />
        </Section>
      ) : null}
      <Section title="Connections" defaultOpen={false}>
        {outgoing.length === 0 ? <p className="s3d-small">No outgoing connections.</p> : null}
        {outgoing.map(({ edge, index }) => (
          <div className="s3d-diag" key={index}>
            <Icon name={CONDITION_GLYPH[edge.condition.type] ?? "arrow"} />
            <div>
              {edge.to === node.id ? "Back to itself" : edge.condition.type === "retry" ? "Back to " : "To "}<b>{edge.to === node.id ? "" : titleOf(edge.to)}</b>
              <select aria-label={`Condition to ${titleOf(edge.to)}`} disabled={disabled} value={edge.condition.type}
                onChange={(e) => commit(`Set condition to ${CONDITION_LABEL[e.target.value as EdgeConditionType]}`, [{ type: "updateProcessEdge", index, edge: { ...edge, condition: { ...edge.condition, type: e.target.value as EdgeConditionType } } }])}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
              </select>
            </div>
          </div>
        ))}
        <div className="s3d-row">
          <select aria-label="Branch to" disabled={disabled} value={branchTo} onChange={(e) => setBranchTo(e.target.value)}>
            <option value="">Branch to…</option>
            {draft.process.nodes.filter((n) => n.id !== node.id).map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
          <button type="button" className="s3d-button" disabled={disabled || !branchTo}
            onClick={() => { commit(`Add branch: ${node.title} → ${titleOf(branchTo)}`, [{ type: "addBranchEdge", from: node.id, to: branchTo }]); setBranchTo(""); }}><Icon name="split" />Add branch</button>
        </div>
        <div className="s3d-row">
          <button type="button" className="s3d-button" disabled={disabled} onClick={() => commit(`Add retry on ${node.title}`, [{ type: "addRetryEdge", nodeId: node.id }])}><Icon name="retry" />Add retry</button>
          <button type="button" className="s3d-button" disabled={disabled || draft.process.startNodeId === node.id}
            onClick={() => commit(`Set ${node.title} as start`, [{ type: "setStartNode", nodeId: node.id }])}><Icon name="flag" />Set as start</button>
        </div>
      </Section>
      <div className="s3d-row s3d-ins-actions">
        <button type="button" className="s3d-button" onClick={() => onPreview(node.id)}><Icon name="play" />Preview from here</button>
        <button type="button" className="s3d-button s3d-button--danger-quiet" disabled={disabled}
          onClick={() => {
            // As on the canvas (§4.9): removal comes with an undo toast.
            if (commit(`Delete ${node.title}`, [{ type: "removeProcessNode", nodeId: node.id }], { selection: undefined }).ok) onToast(`Deleted ${node.title}.`, { label: "Undo", run: studio.undo });
          }}>Delete step</button>
      </div>
    </>
  );
};

const EdgeInspector = ({ studio, index, edge, onDelete }: { studio: Studio3DController; index: number; edge: ProcessEdge; onDelete: (index: number) => void }) => {
  const { draft, commit, readOnly } = studio;
  const disabled = Boolean(readOnly);
  const update = (patch: Partial<ProcessEdge>, label: string) => commit(label, [{ type: "updateProcessEdge", index, edge: { ...edge, ...patch } }]);
  const nodeSelect = (value: string, field: "from" | "to") => (
    <select disabled={disabled} value={value} onChange={(e) => update({ [field]: e.target.value }, `Reconnect ${field === "from" ? "source" : "target"}`)}>
      {draft.process.nodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
    </select>
  );
  return (
    <>
      <div className="s3d-eyebrow">Connection</div>
      <div className="s3d-ins-title">{CONDITION_LABEL[edge.condition.type]}</div>
      <label className="s3d-field"><span>From</span>{nodeSelect(edge.from, "from")}</label>
      <label className="s3d-field"><span>To</span>{nodeSelect(edge.to, "to")}</label>
      <label className="s3d-field"><span>Condition</span>
        <select disabled={disabled} value={edge.condition.type}
          onChange={(e) => update({ condition: { ...edge.condition, type: e.target.value as EdgeConditionType } }, `Set condition to ${CONDITION_LABEL[e.target.value as EdgeConditionType]}`)}>
          {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
        </select>
      </label>
      <CommitField label="Label" disabled={disabled} value={edge.label} onCommit={(label) => update({ label }, "Edit connection label")} />
      {edge.condition.type === "calculationResult" ? (
        <>
          <CommitField label="Calculation id" mono disabled={disabled} value={edge.condition.calculationId ?? ""} onCommit={(v) => update({ condition: { ...edge.condition, calculationId: v || undefined } }, "Edit connection calculation")} />
          <CommitField label="Minimum" mono disabled={disabled} value={edge.condition.min === undefined ? "" : String(edge.condition.min)}
            onCommit={(v) => update({ condition: { ...edge.condition, min: v.trim() === "" ? undefined : Number(v) } }, "Edit connection minimum")} />
          <CommitField label="Maximum" mono disabled={disabled} value={edge.condition.max === undefined ? "" : String(edge.condition.max)}
            onCommit={(v) => update({ condition: { ...edge.condition, max: v.trim() === "" ? undefined : Number(v) } }, "Edit connection maximum")} />
        </>
      ) : null}
      <div className="s3d-row s3d-ins-actions">
        <button type="button" className="s3d-button s3d-button--danger-quiet" disabled={disabled} onClick={() => onDelete(index)}>Delete connection</button>
      </div>
    </>
  );
};

/**
 * A flattened experiment draft (§4.4, D8 a): the honest note, and each technique the draft copied,
 * which opens its technique-instance view.
 */
const ExperimentSummary = ({ studio }: { studio: Studio3DController }) => {
  const { draft } = studio;
  if (studio.artifactKind !== "lab" || draft.techniques.length === 0 || draft.compositionManifest) return null;
  return (
    <>
      <div className="s3d-eyebrow">Experiment draft</div>
      <div className="s3d-ins-title">Flattened from {draft.techniques.length} technique{draft.techniques.length === 1 ? "" : "s"}</div>
      <div className="s3d-note"><b>Techniques are copied with their own equipment.</b> A vessel does not carry across techniques. The compiled path in Phase B does this.</div>
      <ul className="s3d-eq-list">
        {draft.techniques.map((t) => (
          <li key={t.id}>
            <button type="button" className="s3d-eq-list__button" onClick={() => studio.setSelection({ kind: "technique", id: t.id })}>
              <Icon name="cards" /><span>{t.title}</span>
              <span className="s3d-small">{t.process.nodes.length} steps · {t.initialState.equipment.length} own items</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="s3d-small">Group frames on the flow show where each step came from. They cannot be edited.</div>
    </>
  );
};

/** A technique instance in an experiment (§4.7): its source, configuration, ports and state. */
const TechniqueInstanceInspector = ({ studio, instanceId }: { studio: Studio3DController; instanceId: string }) => {
  const stored = studio.draft.techniques.find((t) => t.id === instanceId);
  const current = useMemo(() => {
    try { return currentWorkflowInstance(studio.draft, instanceId); } catch { return stored; }
  }, [instanceId, stored, studio.draft]);
  if (!stored || !current) return <p className="s3d-small">This technique is no longer in the draft.</p>;
  const slots = configurationSlots(current);
  const blocker = workflowConfigurationBlocker(current);
  const needs = workflowNeedsConfiguration(current);
  const state = blocker ? "Host-bound: cannot be configured here" : needs ? "Needs setup" : "Configured";
  return (
    <>
      <div className="s3d-eyebrow">Technique instance</div>
      <div className="s3d-ins-title">{stored.title}</div>
      <dl className="s3d-kv">
        <dt>Source technique</dt><dd className="s3d-mono">{workflowSourceId(stored)}</dd>
        <dt>Instance</dt><dd className="s3d-mono">{stored.id}</dd>
        <dt>Steps</dt><dd>{stored.process.nodes.length}</dd>
        <dt>State</dt><dd>{state}</dd>
        <dt>Unset settings</dt>
        <dd>{slots.length === 0 ? "none: every setting has an approved value" : [
          `${slots.filter((s) => s.kind === "classroom-quantity").length} classroom values`,
          `${slots.filter((s) => s.kind === "internal-identifier").length} derived record names`,
          `${slots.filter((s) => s.kind === "host-composition-only").length} host-only`,
        ].join(" · ")}</dd>
        <dt>Ports</dt><dd>{stored.composition?.ports.length ? stored.composition.ports.map((p) => <div key={p.id}><span className="s3d-mono">{p.kind}</span> {p.label}</div>) : "none declared"}</dd>
      </dl>
      {blocker ? <div className="s3d-blocker" role="alert"><Icon name="lock" /><div>{blocker}</div></div> : null}
      <div className="s3d-note">Setup changes go through the Setup tab (<span className="s3d-mono">configureWorkflow</span>). In a flattened draft the ports are recorded but not connected; the compiled path in Phase B connects them.</div>
    </>
  );
};

/** Frame S2: while a library step is dragged over the Flow, the operation that will run. */
export interface DragPreview {
  title: string;
  verb?: string;
  anchorTitle?: string;
  nextTitle?: string;
}

const DragPreviewPanel = ({ preview }: { preview: DragPreview }) => (
  <>
    <div className="s3d-eyebrow">Adding a step</div>
    <div className="s3d-ins-title">{preview.title}</div>
    <div className="s3d-small">Generic step template{preview.verb ? <> (verb <span className="s3d-mono">{preview.verb}</span>)</> : null}. It is not a published technique.</div>
    <section className="s3d-ins-sec">
      <div className="s3d-ins-sec__head is-static">On release</div>
      <dl className="s3d-kv">
        <dt>Operation</dt><dd className="s3d-mono">appendTemplateStep</dd>
        <dt>Anchor</dt><dd>{preview.anchorTitle ?? "the last step"}</dd>
        <dt>Placement</dt><dd>{preview.anchorTitle ? "after" : "append"}</dd>
        {preview.nextTitle ? <><dt>Before</dt><dd>{preview.nextTitle}</dd></> : null}
      </dl>
    </section>
    <div className="s3d-note">One change, one transaction. It will read “{preview.anchorTitle ? "Insert" : "Add"} {preview.title}” in the activity list and undo in one step.</div>
  </>
);

const StepOutline = ({ studio }: { studio: Studio3DController }) => (
  <>
    <ExperimentSummary studio={studio} />
    <div className="s3d-eyebrow">Step outline</div>
    {studio.draft.process.nodes.length === 0 ? <p className="s3d-small">No steps yet.</p> : null}
    <ol className="s3d-outline">
      {studio.draft.process.nodes.map((node, i) => {
        const action = node.actionId ? studio.draft.actions.find((a) => a.id === node.actionId) : undefined;
        const interaction = action ? resolveActionInteraction(action) : undefined;
        return (
          <li key={node.id}>
            <button type="button" onClick={() => studio.setSelection({ kind: "node", id: node.id })}>
              <span className="s3d-count">{i + 1}</span>
              <Icon name={node.type === "action" && interaction ? INTERACTION_ICON[interaction.type] ?? "move" : NODE_TYPE_ICON[node.type]} />
              <span className="s3d-outline__title">{node.title}</span>
              {studio.draft.process.startNodeId === node.id ? <span className="s3d-chip">Start</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
    <div className="s3d-note">Select a step to edit it here. <b>Enter</b> opens the selected step; arrow keys move along the connections.</div>
  </>
);

// ------------------------------------------------------------------ Setup

const WorkflowSetup = ({ studio, instance }: { studio: Studio3DController; instance: TechniqueDefinition }) => {
  const current = useMemo(() => {
    try { return currentWorkflowInstance(studio.draft, instance.id); } catch { return instance; }
  }, [instance, studio.draft]);
  const [values, setValues] = useState(() => initialSetupValues(current));
  const [approved, setApproved] = useState(false);
  const blocker = workflowConfigurationBlocker(current);
  const needs = workflowNeedsConfiguration(current);
  // The core asks for approval only when a teacher sets classroom values (requireApproval).
  const needsApproval = configurationSlots(current).some((slot) => slot.kind === "classroom-quantity");
  if (!needs) return <p className="s3d-small"><Icon name="check" size={12} /> {current.title}: every setting has an approved value.</p>;
  return (
    <div className="s3d-workflow-setup">
      <div className="s3d-ins-subtitle">{current.title}</div>
      {blocker ? <div className="s3d-blocker" role="alert"><Icon name="lock" /><div>{blocker}</div></div> : (
        <>
          <SetupSlotsForm technique={current} values={values} approved={approved} idPrefix={`setup-${current.id}`}
            onChange={(id, v) => setValues((s) => ({ ...s, [id]: v }))} onApprove={setApproved} />
          <button type="button" className="s3d-button s3d-button--primary" disabled={Boolean(studio.readOnly) || (needsApproval && !approved) || !setupComplete(current, values)}
            onClick={() => studio.commit(`Configure ${current.title}`, [{ type: "configureWorkflow", instanceId: current.id, values, approved }])}>Apply setup</button>
        </>
      )}
    </div>
  );
};

const SetupTab = ({ studio }: { studio: Studio3DController }) => {
  const { draft, commit, artifactKind, readOnly } = studio;
  const disabled = Boolean(readOnly);
  const technique = draft.techniques[0];
  const [adding, setAdding] = useState("");
  const contracts = draft.techniques.filter((t) => t.composition);
  return (
    <>
      <Section title={artifactKind === "technique" ? "Technique settings" : "Experiment settings"}>
        <CommitField label="Title" disabled={disabled} value={draft.title} onCommit={(title) => commit(`Rename to ${title}`, [{ type: "updateLabSettings", patch: { title } }])} />
        {artifactKind === "technique" ? (
          <>
            <CommitField label="Learning goal" multiline disabled={disabled} value={technique?.learningGoal ?? draft.description}
              onCommit={(learningGoal) => commit("Edit learning goal", [{ type: "updateTechniqueSettings", patch: { learningGoal } }])} />
            <label className="s3d-field"><span>Reset behaviour</span>
              <select disabled={disabled} value={technique?.resetBehavior ?? "resetTechnique"}
                onChange={(e) => commit("Change reset behaviour", [{ type: "updateTechniqueSettings", patch: { resetBehavior: e.target.value as TechniqueDefinition["resetBehavior"] } }])}>
                <option value="resetTechnique">Reset the technique</option>
                <option value="resetLab">Reset the lab</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <CommitField label="Description" multiline disabled={disabled} value={draft.description} onCommit={(description) => commit("Edit description", [{ type: "updateLabSettings", patch: { description } }])} />
            <CommitField label="Audience" disabled={disabled} value={draft.audience} onCommit={(audience) => commit("Edit audience", [{ type: "updateLabSettings", patch: { audience } }])} />
            <CommitField label="Learning goals (one per line)" multiline disabled={disabled} value={draft.learningGoals.join("\n")}
              onCommit={(text) => commit("Edit learning goals", [{ type: "updateLabSettings", patch: { learningGoals: text.split("\n").map((g) => g.trim()).filter(Boolean) } }])} />
            <CommitField label="Safety notes (one per line)" multiline disabled={disabled} value={draft.safetyNotes.join("\n")}
              onCommit={(text) => commit("Edit safety notes", [{ type: "updateLabSettings", patch: { safetyNotes: text.split("\n").map((g) => g.trim()).filter(Boolean) } }])} />
          </>
        )}
        <CommitField label="Tags (comma-separated)" disabled={disabled} value={draft.metadata.tags.join(", ")}
          onCommit={(text) => commit("Edit tags", [{ type: "updateLabSettings", patch: { tags: text.split(",").map((t) => t.trim()).filter(Boolean) } }])} />
      </Section>
      <Section title="Configuration">
        {draft.techniques.length === 0 ? <p className="s3d-small">No technique has been added yet.</p> : draft.techniques.map((t) => <WorkflowSetup key={t.id} studio={studio} instance={t} />)}
      </Section>
      <Section title="Equipment roles" defaultOpen={false}>
        {contracts.flatMap((t) => t.composition!.equipmentRoles.map((role) => (
          <div className="s3d-role" key={`${t.id}:${role.roleId}`}>
            <span className="s3d-mono">{role.roleId}</span>
            <span className="s3d-small">{role.required ? "required" : "optional"}{role.allowedDefinitionIds?.length ? ` · ${role.allowedDefinitionIds.map((id) => equipmentById.get(id)?.label ?? id).join(", ")}` : ""}</span>
          </div>
        )))}
        {contracts.every((t) => t.composition!.equipmentRoles.length === 0) ? <p className="s3d-small">No equipment roles are declared.</p> : null}
      </Section>
      <Section title="Required equipment" defaultOpen={false}>
        <ul className="s3d-eq-list">
          {draft.equipment.map((id) => (
            <li key={id}>
              <Thumbnail definitionId={id} size={28} />
              <span>{equipmentById.get(id)?.label ?? id}</span>
              <button type="button" className="s3d-button s3d-button--icon s3d-button--quiet" aria-label={`Remove ${equipmentById.get(id)?.label ?? id}`} disabled={disabled}
                onClick={() => commit(`Remove ${equipmentById.get(id)?.label ?? id}`, [{ type: "removeEquipment", definitionId: id }])}><Icon name="trash" /></button>
            </li>
          ))}
        </ul>
        <div className="s3d-row">
          <select aria-label="Equipment to add" disabled={disabled} value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Add equipment…</option>
            {v1EquipmentCatalog.filter((e) => !draft.equipment.includes(e.id)).map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
          <button type="button" className="s3d-button" disabled={disabled || !adding}
            onClick={() => { commit(`Add ${equipmentById.get(adding)?.label ?? adding}`, [{ type: "addEquipment", definitionId: adding }]); setAdding(""); }}><Icon name="plus" />Add</button>
        </div>
      </Section>
      <Section title="Composition contract" defaultOpen={false}>
        {contracts.length === 0 ? <p className="s3d-small">This draft declares no composition contract.</p> : contracts.map((t) => (
          <dl className="s3d-kv" key={t.id}>
            <dt>Technique</dt><dd className="s3d-mono">{t.id}</dd>
            <dt>Ports</dt><dd>{t.composition!.ports.map((p) => `${p.kind} ${p.label}`).join(" · ") || "none"}</dd>
            <dt>Settings</dt><dd>{t.composition!.configurationSlots.length}</dd>
            <dt>Evidence outputs</dt><dd>{t.composition!.evidenceOutputs.length}</dd>
            <dt>Model slots</dt><dd>{t.composition!.modelSlots.length}</dd>
          </dl>
        ))}
        <div className="s3d-note">Read-only. Exports keep this contract, so an edited technique can still be composed (plan D10).</div>
      </Section>
    </>
  );
};

// ------------------------------------------------------------------ Checks

const ChecksTab = ({ studio, onGoTo, onImport, onExport }: { studio: Studio3DController; onGoTo: (nodeId: string) => void; onImport: () => void; onExport: () => void }) => {
  const diagnostics = studio.readiness.diagnostics;
  const blockers = diagnostics.filter((d) => d.severity === "fail");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const notes = studio.readiness.categories.filter((c) => c.status === "pass");
  const models = equipment3dReadiness(collectStudioEquipmentIds(studio.draft));
  const equipmentCount = new Set(collectStudioEquipmentIds(studio.draft)).size;
  const item = (d: StudioDiagnostic, tone: "fail" | "warning") => {
    const nodeId = diagnosticNode(studio, d);
    return (
      <div className={`s3d-diag is-${tone}`} key={d.id}>
        <Icon name={tone === "fail" ? "x" : "warn"} />
        <div>{d.message}{nodeId ? <div><button type="button" className="s3d-link" onClick={() => onGoTo(nodeId)}>Go to {studio.draft.process.nodes.find((n) => n.id === nodeId)?.title} →</button></div> : null}</div>
      </div>
    );
  };
  return (
    <>
      <div className="s3d-chips">
        <span className="s3d-chip s3d-chip--err"><Icon name="x" size={12} />{blockers.length} blocker{blockers.length === 1 ? "" : "s"}</span>
        <span className="s3d-chip s3d-chip--warn"><Icon name="warn" size={12} />{warnings.length} warning{warnings.length === 1 ? "" : "s"}</span>
        <span className="s3d-chip s3d-chip--neutral">{studio.readiness.label}</span>
      </div>
      {blockers.length ? <><div className="s3d-eyebrow">Blockers</div>{blockers.map((d) => item(d, "fail"))}</> : null}
      {warnings.length ? <><div className="s3d-eyebrow">Warnings</div>{warnings.map((d) => item(d, "warning"))}</> : null}
      {notes.length ? <><div className="s3d-eyebrow">Notes</div>{notes.map((c) => <div className="s3d-small" key={c.id}><Icon name="check" size={12} /> {c.label}: no issues.</div>)}</> : null}
      <Section title="3D readiness">
        {models.ready
          ? <div className="s3d-small"><Icon name="check" size={12} /> A 3D model exists for all {equipmentCount} pieces of equipment.</div>
          : <div className="s3d-small"><Icon name="cube" size={12} /> Not yet in 3D: {models.missing.map((id) => equipmentById.get(id)?.label ?? id).join(", ")}.</div>}
      </Section>
      <Section title="Activity">
        {studio.activity.length ? <ol className="s3d-activity">{studio.activity.map((label, i) => <li key={`${label}-${i}`}>{label}</li>)}</ol> : <p className="s3d-small">No changes yet.</p>}
      </Section>
      <Section title="Save and open">
        <div className="s3d-row">
          <button type="button" className="s3d-button" onClick={onExport}><Icon name="download" />Export</button>
          <button type="button" className="s3d-button" onClick={onImport}><Icon name="upload" />Import</button>
        </div>
        <p className="s3d-small">The draft is also kept in this browser, apart from the original Studio's draft.</p>
      </Section>
    </>
  );
};

// ------------------------------------------------------------------ Shell

export const Inspector = ({ studio, tab, onTab, onPreview, onImport, onExport, onDeleteEdge, onToast, benchSelected, benchNothing, dragPreview, onSheetHeight }: {
  studio: Studio3DController;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onPreview: (nodeId: string) => void;
  onImport: () => void;
  onExport: () => void;
  onDeleteEdge: (index: number) => void;
  onToast: (text: string, action?: { label: string; run: () => void }) => void;
  /** The Starting bench view supplies its own equipment inspector and bench list. */
  benchSelected?: ReactNode;
  benchNothing?: ReactNode;
  /** A library step being dragged over the Flow (frame S2). */
  dragPreview?: DragPreview;
  /** On a tablet the inspector is a bottom sheet; its grip resizes it (§4.10). */
  onSheetHeight?: (share: number) => void;
}) => {
  const { draft, selection } = studio;
  const node = selection?.kind === "node" ? draft.process.nodes.find((n) => n.id === selection.id) : undefined;
  const edge = selection?.kind === "edge" ? draft.process.edges[selection.index] : undefined;
  const goTo = (nodeId: string) => { studio.setSelection({ kind: "node", id: nodeId }); onTab("selected"); };
  // A drag in progress names its operation (S2). In the Starting bench view the selection is
  // equipment; with none, the bench inventory (§4.7).
  const selected = dragPreview ? <DragPreviewPanel preview={dragPreview} />
    : selection?.kind === "equipment" && benchSelected ? benchSelected
      : benchNothing ? benchNothing
        : node ? <StepInspector studio={studio} node={node} onPreview={onPreview} onToast={onToast} />
          : edge && selection?.kind === "edge" ? <EdgeInspector studio={studio} index={selection.index} edge={edge} onDelete={onDeleteEdge} />
            : selection?.kind === "technique" ? <TechniqueInstanceInspector studio={studio} instanceId={selection.id} />
              : <StepOutline studio={studio} />;
  const startSheetDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!onSheetHeight) return;
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => onSheetHeight(Math.min(0.8, Math.max(0.2, (window.innerHeight - e.clientY) / window.innerHeight)));
    const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  };
  return (
    <aside className="s3d-panel s3d-inspector" aria-label="Inspector">
      <button type="button" className="s3d-sheet-grip" aria-label="Resize the inspector" onPointerDown={startSheetDrag}
        onKeyDown={(e) => {
          if (!onSheetHeight) return;
          const current = (e.currentTarget.parentElement?.getBoundingClientRect().height ?? 0) / window.innerHeight;
          if (e.key === "ArrowUp") { e.preventDefault(); onSheetHeight(Math.min(0.8, current + 0.05)); }
          if (e.key === "ArrowDown") { e.preventDefault(); onSheetHeight(Math.max(0.2, current - 0.05)); }
        }}><span /></button>
      <div className="s3d-tabs" role="tablist">
        {(["selected", "setup", "checks"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => onTab(id)}>
            {id === "selected" ? "Selected" : id === "setup" ? "Setup" : "Checks"}
          </button>
        ))}
      </div>
      <div className="s3d-ins-body" role="tabpanel">
        {tab === "selected" ? selected : tab === "setup" ? <SetupTab studio={studio} /> : <ChecksTab studio={studio} onGoTo={goTo} onImport={onImport} onExport={onExport} />}
      </div>
      <div className="s3d-ins-foot">
        <span className={`s3d-dot${studio.readiness.diagnostics.some((d) => d.severity === "fail") ? " is-warn" : ""}`} aria-hidden="true" />
        <span className="s3d-ins-foot__last" title={studio.lastChange}>{studio.lastChange ?? "No changes yet"}</span>
        <button type="button" className="s3d-button s3d-button--icon s3d-button--quiet" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!studio.canUndo} onClick={studio.undo}><Icon name="undo" /></button>
        <button type="button" className="s3d-button s3d-button--icon s3d-button--quiet" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!studio.canRedo} onClick={studio.redo}><Icon name="redo" /></button>
      </div>
    </aside>
  );
};
