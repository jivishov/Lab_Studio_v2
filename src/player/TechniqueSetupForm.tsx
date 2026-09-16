import { useState, type FormEvent } from "react";
import type { TechniqueDefinition } from "../domain/types";
import { configurationSlots, type ConfigurationSlot } from "../data/techniqueConfiguration";
import { hostLabsForTechnique } from "../data/techniqueHosts";

/**
 * Teacher configuration for a technique started on its own.
 *
 * A composed lab resolves a technique's `{{config.*}}` slots while it compiles. The standalone
 * route has no such step, so this is where the same values come from — supplied by a teacher rather
 * than defaulted, because a default would be a classroom decision nobody made.
 *
 * Two things are deliberately separated. The classroom quantities are asked for, one field each,
 * with the unit the slot's own name declares. The internal measurement identifiers are shown but
 * not asked for: they are the names the runtime files evidence under, a host lab assigns them to
 * keep instances apart, and a teacher has no basis on which to choose one. Showing them keeps the
 * substitution visible instead of silent.
 *
 * When a lab does host this technique, that route is offered first and by name: it carries the
 * approved configuration already, and is the better way in.
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
  const [values, setValues] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(values);
  };

  const field = (slot: ConfigurationSlot) => (
    <label key={slot.id} style={{ display: "block", marginBlock: "0.75rem" }}>
      {slot.label}
      <input
        required
        type={slot.mode === "numeric" ? "number" : "text"}
        step={slot.mode === "numeric" ? "any" : undefined}
        value={values[slot.id] ?? ""}
        onChange={(event) => setValues({ ...values, [slot.id]: event.target.value })}
      />
    </label>
  );

  return (
    <main className="route-status">
      <h1>{definition.title} — classroom setup</h1>

      {hosts.length > 0 ? (
        <p>
          {hosts.length === 1 ? "A lab hosts" : "Labs host"} this technique and already supplies its
          approved configuration:{" "}
          {hosts.map((host, index) => (
            <span key={host.id}>
              {index > 0 ? ", " : ""}
              <a href={host.href}>{host.title}</a>
            </span>
          ))}
          . Starting from there is the supported route. Use the form below only to run the technique
          on its own against values this class approves.
        </p>
      ) : (
        <p>
          No lab in the catalog composes this technique, so there is no compiled configuration to
          inherit. Supply the approved classroom values here to run it on its own.
        </p>
      )}

      <form onSubmit={submit}>
        {quantities.length > 0 ? (
          <>
            <p>
              These are teaching decisions, so nothing is filled in for you. They stay fixed for this
              run; starting a different setup creates a fresh activity with no carried-over evidence.
            </p>
            {quantities.map(field)}
            <label>
              <input required type="checkbox" /> The instructor approves these values for this class.
            </label>
          </>
        ) : (
          <p>
            This technique asks for no classroom quantities. Everything it needs is internal
            bookkeeping, listed below, and it can start as it is.
          </p>
        )}

        {identifiers.length > 0 ? (
          <details>
            <summary>
              Internal evidence names ({identifiers.length}) — assigned automatically, not a
              classroom choice
            </summary>
            <p>
              These name the readings each step files so a later step can cite them. A host lab
              assigns them to keep instances apart; run on its own, the technique uses these derived
              names. They are not measurements and carry no approved value.
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
            <summary>
              Declared for a host composition ({hostOnly.length}) — not used on this route
            </summary>
            <p>
              The composition contract declares these, but nothing the player reads is bound to
              them: they are read while a lab compiles, which is not what happens here. Running the
              technique on its own neither needs them nor invents them.
            </p>
            <ul>
              {hostOnly.map((slot) => (
                <li key={slot.id}>
                  <code>{slot.id}</code>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Use approved setup and start</button>
      </form>
    </main>
  );
};
