import { useState, type FormEvent } from "react";
import type { TechniqueDefinition } from "../domain/types";
import {
  configurationSlots,
  standaloneTechniqueConfigurationBlocker,
  type ConfigurationSlot,
} from "../data/techniqueConfiguration";
import { hostLabsForTechnique } from "../data/techniqueHosts";
import {
  SetupApproval,
  SetupCallout,
  SetupError,
  SetupField,
  SetupSection,
  SetupSubmit,
  TeacherSetupPage,
} from "./TeacherSetupLayout";

/**
 * Teacher configuration for an unhosted technique started on its own.
 *
 * Hosted/ordered techniques stay on their composition route because that route owns procedure
 * selection, datasets and evidence bindings. For an unhosted technique, fields below mirror the
 * technique's declared configuration contract: value type, enumerated choices, required/default
 * semantics and stable derived evidence identifiers are not inferred from parameter names.
 */
export const TechniqueSetupForm = ({
  definition,
  onStart,
  error,
}: {
  definition: TechniqueDefinition;
  onStart: (configuration: Record<string, string>) => void;
  error?: string;
}) => {
  const slots = configurationSlots(definition);
  const quantities = slots.filter((slot) => slot.kind === "classroom-quantity");
  const identifiers = slots.filter((slot) => slot.kind === "internal-identifier");
  const hostOnly = slots.filter((slot) => slot.kind === "host-composition-only");
  const hosts = hostLabsForTechnique(definition.id);
  const blocker = standaloneTechniqueConfigurationBlocker(definition);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    quantities
      .filter((slot) => slot.defaultValue !== undefined)
      .map((slot) => [slot.id, String(slot.defaultValue)]),
  ));

  if (blocker) {
    return (
      <TeacherSetupPage
        backHref="#/techniques"
        backLabel="Back to techniques"
        title={`${definition.title} — composed setup required`}
        description="This technique cannot be started safely from a standalone value form. Use its supported composition route when one is available."
        context={<p><strong>Why this is blocked</strong><br />The standalone route never guesses procedure choices, datasets or scientific evidence bindings.</p>}
        guideLabel="Route guidance"
        showWorkflow={false}
      >
        <div className="teacher-setup-notice">
          <p className="teacher-setup-notice__alert" role="alert">{blocker}</p>
          {hosts.length > 0 ? (
            <p>
              Supported {hosts.length === 1 ? "lab" : "labs"}: {hosts.map((host, index) => (
                <span key={host.id}>
                  {index > 0 ? ", " : ""}
                  <a href={host.href}>{host.title}</a>
                </span>
              ))}.
            </p>
          ) : null}
          <p>
            The standalone route does not substitute composition-only procedure choices or dataset
            bindings. This preserves the published technique contract instead of constructing a
            different workflow from unresolved templates.
          </p>
          <SetupError message={error} />
        </div>
      </TeacherSetupPage>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(values);
  };

  const setValue = (slotId: string, value: string) => {
    setValues((current) => ({ ...current, [slotId]: value }));
  };

  const fieldHint = (slot: ConfigurationSlot) => {
    if (slot.allowedValues?.length) return `Supported choices: ${slot.allowedValues.map(String).join(", ")}.`;
    if (slot.defaultValue !== undefined) return `Published default: ${String(slot.defaultValue)}${slot.unit ? ` ${slot.unit}` : ""}.`;
    if (slot.unit) return `Enter the instructor-approved value in ${slot.unit}.`;
    return "Enter the value declared by the published technique contract.";
  };

  const field = (slot: ConfigurationSlot, wide = false) => {
    const value = values[slot.id] ?? "";
    const required = slot.required && slot.defaultValue === undefined;
    if (slot.allowedValues?.length) {
      return (
        <SetupField key={slot.id} label={slot.label} hint={fieldHint(slot)} optional={!required} wide={wide}>
          <select
            required={required}
            value={value}
            onChange={(event) => setValue(slot.id, event.target.value)}
          >
            <option value="">{required ? "Select an approved value" : "No value selected"}</option>
            {slot.allowedValues.map((allowed) => (
              <option key={String(allowed)} value={String(allowed)}>{String(allowed)}</option>
            ))}
          </select>
        </SetupField>
      );
    }
    if (slot.mode === "boolean") {
      return (
        <SetupField key={slot.id} label={slot.label} hint={fieldHint(slot)} optional={!required} wide={wide}>
          <select
            required={required}
            value={value}
            onChange={(event) => setValue(slot.id, event.target.value)}
          >
            <option value="">{required ? "Select true or false" : "No value selected"}</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </SetupField>
      );
    }
    return (
      <SetupField key={slot.id} label={slot.label} hint={fieldHint(slot)} optional={!required} wide={wide}>
        <input
          inputMode={slot.mode === "numeric" ? "decimal" : undefined}
          required={required}
          step={slot.mode === "numeric" ? "any" : undefined}
          type={slot.mode === "numeric" ? "number" : "text"}
          value={value}
          onChange={(event) => setValue(slot.id, event.target.value)}
        />
      </SetupField>
    );
  };

  return (
    <TeacherSetupPage
      backHref="#/techniques"
      backLabel="Back to techniques"
      title={`${definition.title} — classroom setup`}
      description="Supply only the classroom values declared by this technique's published configuration contract."
      context={<p><strong>Validation boundary</strong><br />No catalog lab composes this technique. The configured definition is validated again before the player starts.</p>}
    >
      <form className="teacher-setup-form" onSubmit={submit}>
        {quantities.length > 0 ? (
          <SetupSection
            number={1}
            title="Classroom values"
            description="Enumerated choices and defaults come directly from the published contract."
          >
            {quantities.map((slot, index) => field(slot, quantities.length % 2 === 1 && index === quantities.length - 1))}
            <SetupCallout>
              These are teaching decisions. The form accepts only the value types and enumerated choices declared by the technique; it does not create arbitrary substitutes.
            </SetupCallout>
          </SetupSection>
        ) : (
          <SetupSection
            number={1}
            title="No pre-start quantities"
            description="This technique can continue without a classroom quantity at launch."
          >
            <SetupCallout>
              Teacher-configured readings, measurements or instrument settings may still be required during the procedure. Internal evidence names identify those records but do not create scientific values.
            </SetupCallout>
          </SetupSection>
        )}

        {quantities.length > 0 ? (
          <SetupApproval>I approve these values for this class.</SetupApproval>
        ) : null}

        {identifiers.length > 0 || hostOnly.length > 0 ? (
          <div className="teacher-setup-technical">
            {identifiers.length > 0 ? (
              <details>
                <summary>
                  Internal evidence names ({identifiers.length}) — assigned automatically, not a classroom choice
                </summary>
                <p>
                  These names connect producers and consumers. They are not measurements and do not
                  supply an approved concentration, volume, wavelength or other scientific value.
                </p>
                <ul>
                  {identifiers.map((slot) => (
                    <li key={slot.id}><code>{slot.id}</code> → <code>{slot.derivedValue}</code></li>
                  ))}
                </ul>
              </details>
            ) : null}

            {hostOnly.length > 0 ? (
              <details>
                <summary>Optional composition-only declarations ({hostOnly.length})</summary>
                <p>
                  These slots are not runtime fields on this route. Required composition-only slots
                  block standalone setup before this form is shown.
                </p>
                <ul>
                  {hostOnly.map((slot) => <li key={slot.id}><code>{slot.id}</code></li>)}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}

        <SetupError message={error} />
        <SetupSubmit label="Use approved setup and start" />
      </form>
    </TeacherSetupPage>
  );
};
