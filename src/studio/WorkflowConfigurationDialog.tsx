import { useEffect, useId, useRef, useState } from "react";
import { configurationSlots } from "../data/techniqueConfiguration";
import type { TechniqueDefinition } from "../domain/types";
import { workflowConfigurationBlocker, workflowHostLabs } from "./workflowConfiguration";
import "./workflowConfiguration.css";

interface WorkflowConfigurationDialogProps {
  title: string;
  technique?: TechniqueDefinition;
  instanceId?: string;
  loadError?: string;
  onCancel: () => void;
  /** Returns a transaction error; successful application closes the dialog in its owner. */
  onApply: (values: Record<string, string>, approved: boolean) => string | undefined;
}

export const WorkflowConfigurationDialog = ({
  title, technique, instanceId, loadError, onCancel, onApply,
}: WorkflowConfigurationDialogProps) => {
  const slots = technique ? configurationSlots(technique) : [];
  const fields = slots.filter((slot) => slot.kind !== "internal-identifier");
  const identifiers = slots.filter((slot) => slot.kind === "internal-identifier");
  const [values, setValues] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string>();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const blocker = technique ? workflowConfigurationBlocker(technique) : null;
  const hosts = technique ? workflowHostLabs(technique) : [];

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]',
      ) ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      if (previousFocus?.isConnected && !previousFocus.closest("[hidden]")) previousFocus.focus();
      else document.querySelector<HTMLButtonElement>(".process-add-button")?.focus();
    };
  }, []);

  const fieldValue = (slot: (typeof fields)[number]) =>
    values[slot.id] ?? (slot.defaultValue === undefined ? "" : String(slot.defaultValue));
  const updateValue = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }));
    setApproved(false);
    setError(undefined);
  };

  return (
    <div className="studio-confirmation-backdrop studio-workflow-backdrop">
      <section ref={dialogRef} className="studio-workflow-configuration" role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
        <header>
          <h2 id={titleId}>Configure {title}</h2>
          <p id={descriptionId}>{instanceId
            ? "Complete this workflow's setup in the current draft. Other workflows keep their settings."
            : "Review this workflow's settings before appending it to the current draft."}</p>
        </header>
        {!technique && !loadError ? <p role="status">Loading workflow settings…</p> : null}
        {loadError || blocker ? (
          <div>
            <p role="alert">{loadError || blocker}</p>
            {hosts.length ? (
              <ul>{hosts.map((host) => <li key={host.id}>
                <a href={host.href} target="_blank" rel="noopener noreferrer">Open {host.title} in a new tab</a>
              </li>)}</ul>
            ) : null}
            <p>The current draft is unchanged. Close this panel to continue editing or save it.</p>
          </div>
        ) : technique ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            const supplied = Object.fromEntries(fields.map((slot) => [slot.id, fieldValue(slot)]));
            setError(onApply(supplied, approved));
          }}>
            <div className="studio-workflow-fields">
              {fields.map((slot) => {
                const choices = slot.allowedValues ?? (slot.valueType === "boolean" ? [true, false] : undefined);
                const fieldId = `${titleId}-${slot.id}`;
                const helpId = `${fieldId}-help`;
                return <div key={slot.id} className="studio-workflow-field">
                  <label htmlFor={fieldId}>{slot.label}{slot.required ? " *" : " (optional)"}</label>
                  {choices ? (
                    <select id={fieldId} value={fieldValue(slot)} required={slot.required}
                      aria-describedby={helpId} onChange={(event) => updateValue(slot.id, event.target.value)}>
                      <option value="">Choose a setting</option>
                      {choices.map((value) => <option key={String(value)} value={String(value)}>{String(value)}</option>)}
                    </select>
                  ) : (
                    <input id={fieldId} type={slot.mode === "numeric" ? "number" : "text"}
                      step={slot.mode === "numeric" ? "any" : undefined} value={fieldValue(slot)} required={slot.required}
                      aria-describedby={helpId} onChange={(event) => updateValue(slot.id, event.target.value)} />
                  )}
                  <small id={helpId}>{slot.defaultValue !== undefined ? `Authored default: ${String(slot.defaultValue)}. ` : ""}
                    Teacher-approved setting for this workflow.</small>
                </div>;
              })}
            </div>
            {!fields.length ? <p>This workflow has no teacher-entered settings to enter in this panel.</p> : null}
            {identifiers.length ? <p>Each workflow keeps its measurements separate. Students still acquire or enter evidence during the activity.</p> : null}
            {fields.length ? (
              <label className="studio-workflow-approval">
                <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
                <span>I confirm these teacher-entered settings are approved for this workflow.</span>
              </label>
            ) : null}
            {error ? <p className="studio-workflow-error" role="alert">{error}</p> : null}
            <div className="studio-workflow-actions">
              <button type="button" className="secondary-action" onClick={onCancel}>Cancel</button>
              <button type="submit" disabled={fields.length > 0 && !approved}>
                {instanceId ? "Apply to this workflow" : "Append configured workflow"}
              </button>
            </div>
          </form>
        ) : null}
        {!technique || blocker || loadError ? <button type="button" className="secondary-action" onClick={onCancel}>Close workflow setup</button> : null}
      </section>
    </div>
  );
};
