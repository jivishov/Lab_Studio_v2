import { useState, type FormEvent } from "react";
import type { TechniqueDefinition } from "../domain/types";
import {
  configurationSlots,
  standaloneTechniqueConfigurationBlocker,
  type ConfigurationSlot,
} from "../data/techniqueConfiguration";
import { hostLabsForTechnique } from "../data/techniqueHosts";

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
      <main className="route-status">
        <h1>{definition.title} — composed setup required</h1>
        <p role="alert">{blocker}</p>
        {hosts.length > 0 ? (
          <p>
            Supported {hosts.length === 1 ? "lab" : "labs"}:{" "}
            {hosts.map((host, index) => (
              <span key={host.id}>
                {index > 0 ? ", " : ""}
                <a href={host.href}>{host.title}</a>
              </span>
            ))}
            .
          </p>
        ) : null}
        <p>
          The standalone route does not substitute composition-only procedure choices or dataset
          bindings. This keeps the published technique contract intact instead of constructing a
          different workflow from unresolved templates.
        </p>
        {error ? <p role="alert">{error}</p> : null}
      </main>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(values);
  };

  const setValue = (slotId: string, value: string) => {
    setValues((current) => ({ ...current, [slotId]: value }));
  };

  const field = (slot: ConfigurationSlot) => {
    const value = values[slot.id] ?? "";
    const required = slot.required && slot.defaultValue === undefined;
    if (slot.allowedValues?.length) {
      return (
        <label key={slot.id} style={{ display: "block", marginBlock: "0.75rem" }}>
          {slot.label}
          <select
            required={required}
            value={value}
            onChange={(event) => setValue(slot.id, event.target.value)}
          >
            {required ? <option value="">Select an approved value</option> : null}
            {slot.allowedValues.map((allowed) => (
              <option key={String(allowed)} value={String(allowed)}>{String(allowed)}</option>
            ))}
          </select>
        </label>
      );
    }
    if (slot.mode === "boolean") {
      return (
        <label key={slot.id} style={{ display: "block", marginBlock: "0.75rem" }}>
          {slot.label}
          <select
            required={required}
            value={value}
            onChange={(event) => setValue(slot.id, event.target.value)}
          >
            {required ? <option value="">Select true or false</option> : null}
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      );
    }
    return (
      <label key={slot.id} style={{ display: "block", marginBlock: "0.75rem" }}>
        {slot.label}
        <input
          required={required}
          type={slot.mode === "numeric" ? "number" : "text"}
          step={slot.mode === "numeric" ? "any" : undefined}
          value={value}
          onChange={(event) => setValue(slot.id, event.target.value)}
        />
      </label>
    );
  };

  return (
    <main className="route-status">
      <h1>{definition.title} — classroom setup</h1>
      <p>
        No catalog lab composes this technique. Supply only the classroom values declared by its
        configuration contract; the configured definition is validated again before the player can
        start.
      </p>

      <form onSubmit={submit}>
        {quantities.length > 0 ? (
          <>
            <p>
              These are teaching decisions. Enumerated choices come from the published contract and
              no arbitrary substitute is accepted.
            </p>
            {quantities.map(field)}
            <label>
              <input required type="checkbox" /> The instructor approves these values for this class.
            </label>
          </>
        ) : (
          <p>
            This technique has no pre-start classroom quantity to bind. It may still require
            teacher-configured readings, measurements or instrument settings during the procedure;
            internal evidence names below identify those records but do not create their values.
          </p>
        )}

        {identifiers.length > 0 ? (
          <details>
            <summary>
              Internal evidence names ({identifiers.length}) — assigned automatically, not a
              classroom choice
            </summary>
            <p>
              These names only connect producers and consumers. They are not measurements and do not
              supply an approved concentration, volume, wavelength or other scientific value.
            </p>
            <ul>
              {identifiers.map((slot) => (
                <li key={slot.id}>
                  <code>{slot.id}</code> → <code>{slot.derivedValue}</code>
                </li>
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

        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Use approved setup and start</button>
      </form>
    </main>
  );
};
