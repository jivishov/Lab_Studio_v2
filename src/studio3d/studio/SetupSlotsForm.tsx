import { configurationSlots, type ConfigurationSlot } from "../../data/techniqueConfiguration";
import type { TechniqueDefinition } from "../../domain/types";
import { slotLabel } from "../copy/slotLabels";
import { Icon } from "../ui/Icon";
import { ProvenanceChip } from "../ui/ProvenanceChip";

/**
 * Teacher setup for one technique (plan §5.1 "setup forms", handoff §4.8), following the 2D
 * `TeacherSetupLayout` pattern: numbered sections, each field marked Required or Optional with the
 * same hint wording as `TechniqueSetupForm`, and an instructor-approval statement. The slots,
 * blockers and approval rule are the core's (`configurationSlots`); nothing is defaulted beyond a
 * slot's own published default. Friendlier labels come from the U10 map, and the core slot id
 * stays visible to the author in mono.
 */
export const setupSlots = (technique: TechniqueDefinition) => configurationSlots(technique);

export const initialSetupValues = (technique: TechniqueDefinition): Record<string, string> =>
  Object.fromEntries(setupSlots(technique)
    .filter((slot) => slot.kind === "classroom-quantity" && slot.defaultValue !== undefined)
    .map((slot) => [slot.id, String(slot.defaultValue)]));

/** Required as `TechniqueSetupForm` decides it: required and without a published default. */
const isRequired = (slot: ConfigurationSlot) => slot.required && slot.defaultValue === undefined;

/** Whether every required classroom value is present (the core still validates on apply). */
export const setupComplete = (technique: TechniqueDefinition, values: Record<string, string>): boolean =>
  setupSlots(technique).filter((slot) => slot.kind === "classroom-quantity" && isRequired(slot)).every((slot) => (values[slot.id] ?? "").trim().length > 0);

/** `TechniqueSetupForm.fieldHint`, word for word. */
const fieldHint = (slot: ConfigurationSlot): string => {
  if (slot.allowedValues?.length) return `Supported choices: ${slot.allowedValues.map(String).join(", ")}.`;
  if (slot.defaultValue !== undefined) return `Published default: ${String(slot.defaultValue)}${slot.unit ? ` ${slot.unit}` : ""}.`;
  if (slot.unit) return `Enter the instructor-approved value in ${slot.unit}.`;
  return "Enter the value declared by the published technique contract.";
};

export const SetupSlotsForm = ({ technique, values, approved, onChange, onApprove, idPrefix }: {
  technique: TechniqueDefinition;
  values: Record<string, string>;
  approved: boolean;
  onChange: (id: string, value: string) => void;
  onApprove: (approved: boolean) => void;
  idPrefix: string;
}) => {
  const slots = setupSlots(technique);
  const quantities = slots.filter((slot) => slot.kind === "classroom-quantity");
  const identifiers = slots.filter((slot) => slot.kind === "internal-identifier");
  const hostOnly = slots.filter((slot) => slot.kind === "host-composition-only");
  const control = (slot: ConfigurationSlot, fieldId: string, unit?: string) => {
    const value = values[slot.id] ?? "";
    const required = isRequired(slot);
    if (slot.allowedValues?.length || slot.mode === "boolean") {
      const options = slot.allowedValues?.length ? slot.allowedValues.map(String) : ["true", "false"];
      return (
        <select id={fieldId} required={required} value={value} onChange={(e) => onChange(slot.id, e.target.value)}>
          <option value="">{required ? (slot.mode === "boolean" && !slot.allowedValues?.length ? "Select true or false" : "Select an approved value") : "No value selected"}</option>
          {options.map((v) => <option key={v} value={v}>{slot.mode === "boolean" && !slot.allowedValues?.length ? (v === "true" ? "True" : "False") : v}</option>)}
        </select>
      );
    }
    return (
      <div className="s3d-input">
        <input id={fieldId} required={required} inputMode={slot.mode === "numeric" ? "decimal" : "text"} value={value} onChange={(e) => onChange(slot.id, e.target.value)} />
        {unit ? <span className="s3d-input__unit s3d-mono">{unit}</span> : null}
      </div>
    );
  };
  return (
    <div className="s3d-setup-form">
      {quantities.length ? (
        <fieldset className="s3d-setup-section">
          <legend><span className="s3d-setup-section__number">1</span><span><b>Classroom values</b><small>Enter the approved classroom values. Nothing is defaulted.</small></span></legend>
          <div className="s3d-setup-form__lead"><ProvenanceChip kind="teacher" studio /></div>
          <div className="s3d-setup-form__grid">
            {quantities.map((slot) => {
              const copy = slotLabel(slot.id);
              const fieldId = `${idPrefix}-${slot.id}`;
              return (
                <div className="s3d-field" key={slot.id}>
                  <label htmlFor={fieldId}>
                    <span>{copy.label} <span className="s3d-mono s3d-muted" title="Core slot id">{slot.id}</span></span>
                    <small>{isRequired(slot) ? "Required" : "Optional"}</small>
                  </label>
                  {control(slot, fieldId, slot.unit ?? copy.unit)}
                  <span className="s3d-small">{copy.help ? `${copy.help} ` : ""}{fieldHint(slot)}</span>
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {quantities.length ? (
        <fieldset className="s3d-setup-section">
          <legend><span className="s3d-setup-section__number">2</span><span><b>Instructor approval</b></span></legend>
          <label className="s3d-setup-approval">
            <input type="checkbox" checked={approved} onChange={(e) => onApprove(e.target.checked)} />
            <Icon name="check" />
            <span>I approve these values for my classroom.</span>
          </label>
        </fieldset>
      ) : null}
      {identifiers.length ? (
        <div className="s3d-note">
          <b>Named automatically.</b> {identifiers.map((slot) => slotLabel(slot.id).label).join(", ")}: {identifiers.length === 1 ? "this record name is" : "these record names are"} derived, never asked for.
        </div>
      ) : null}
      {hostOnly.length ? (
        <div className="s3d-note"><b>Set by a host experiment.</b> {hostOnly.map((slot) => slot.id).join(", ")}.</div>
      ) : null}
    </div>
  );
};
