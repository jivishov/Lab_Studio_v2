import { configurationSlots } from "../../data/techniqueConfiguration";
import type { TechniqueDefinition } from "../../domain/types";
import { slotLabel } from "../copy/slotLabels";
import { ProvenanceChip } from "../ui/ProvenanceChip";

/**
 * Teacher setup for one technique (plan §5.1 "setup forms", handoff §4.8), after
 * `TeacherSetupLayout`: the same slots, blockers and approval as the 2D setup, through
 * `configurationSlots`. Nothing is defaulted beyond the slot's own authored default. Friendlier
 * labels come from the U10 map; the core slot id stays visible to the author in mono.
 */
export const setupSlots = (technique: TechniqueDefinition) => configurationSlots(technique);

export const initialSetupValues = (technique: TechniqueDefinition): Record<string, string> =>
  Object.fromEntries(setupSlots(technique)
    .filter((slot) => slot.kind === "classroom-quantity" && slot.defaultValue !== undefined)
    .map((slot) => [slot.id, String(slot.defaultValue)]));

/** Whether every classroom value is present (the core still validates on apply). */
export const setupComplete = (technique: TechniqueDefinition, values: Record<string, string>): boolean =>
  setupSlots(technique).filter((slot) => slot.kind === "classroom-quantity" && slot.required).every((slot) => (values[slot.id] ?? "").trim().length > 0);

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
  return (
    <div className="s3d-setup-form">
      {quantities.length ? (
        <>
          <div className="s3d-setup-form__lead"><ProvenanceChip kind="teacher" studio /><span className="s3d-small">Classroom quantities. Nothing is defaulted.</span></div>
          <div className="s3d-setup-form__grid">
            {quantities.map((slot) => {
              const copy = slotLabel(slot.id);
              const unit = slot.unit ?? copy.unit;
              const fieldId = `${idPrefix}-${slot.id}`;
              return (
                <div className="s3d-field" key={slot.id}>
                  <label htmlFor={fieldId}>{copy.label} <span className="s3d-mono s3d-muted" title="Core slot id">{slot.id}</span></label>
                  {slot.allowedValues?.length ? (
                    <select id={fieldId} value={values[slot.id] ?? ""} onChange={(e) => onChange(slot.id, e.target.value)}>
                      <option value="">Choose…</option>
                      {slot.allowedValues.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
                    </select>
                  ) : (
                    <div className="s3d-input">
                      <input id={fieldId} inputMode={slot.mode === "numeric" ? "decimal" : "text"} value={values[slot.id] ?? ""} onChange={(e) => onChange(slot.id, e.target.value)} />
                      {unit ? <span className="s3d-input__unit s3d-mono">{unit}</span> : null}
                    </div>
                  )}
                  {copy.help ? <span className="s3d-small">{copy.help}</span> : null}
                </div>
              );
            })}
          </div>
          <label className="s3d-check">
            <input type="checkbox" checked={approved} onChange={(e) => onApprove(e.target.checked)} />
            <span>I approve these values for my classroom.</span>
          </label>
        </>
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
