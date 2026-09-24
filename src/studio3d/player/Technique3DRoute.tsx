import { useEffect, useMemo, useState, type FormEvent } from "react";
import { loadBundledTechnique, loadBundledTechniqueSummaries } from "../../data/loadBundledTechniques";
import {
  applyTechniqueConfiguration,
  configurationSlots,
  standaloneTechniqueConfigurationBlocker,
  unresolvedConfigurationMessage,
  unresolvedConfigurationSlots,
} from "../../data/techniqueConfiguration";
import { hostLabsForTechnique } from "../../data/techniqueHosts";
import type { TechniqueDefinition } from "../../domain/types";
import { slotLabel } from "../copy/slotLabels";
import { equipment3dReadiness } from "../equipment3d/readiness";
import { packNumber } from "../packs";
import { studio3DFallbackHash } from "../routes3d";
import { ProvenanceChip } from "../ui/ProvenanceChip";
import { Player3D } from "./Player3D";

/**
 * `#/3d/technique/:id` (handoff §5.2–§5.3): the same setup behaviour as the 2D technique route
 * (App.tsx DefinitionRoute). A technique with unresolved configuration slots gets the teacher
 * setup; a host-bound one gets its blocker and host links and no start button; nothing is
 * defaulted, and a slot left unbound sends the teacher back naming it.
 */
export const Technique3DRoute = ({ techniqueId }: { techniqueId: string }) => {
  const [definition, setDefinition] = useState<TechniqueDefinition>();
  const [error, setError] = useState<string>();
  const [page, setPage] = useState<"intro" | "setup" | "play">("intro");
  const [values, setValues] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);
  const [configured, setConfigured] = useState<TechniqueDefinition>();
  const [setupError, setSetupError] = useState<string>();
  const [pack, setPack] = useState<number>();
  const fallbackHash = studio3DFallbackHash({ view: "technique", techniqueId });

  // The top bar's source badge names the technique's pack (§5.4): catalogue order, in fives.
  useEffect(() => {
    let active = true;
    loadBundledTechniqueSummaries().then((summaries) => { if (active) setPack(packNumber(summaries.map((s) => s.id), techniqueId)); },
      () => undefined);
    return () => { active = false; };
  }, [techniqueId]);

  useEffect(() => {
    let active = true;
    loadBundledTechnique(techniqueId).then((d) => {
      if (!active) return;
      setDefinition(d);
      // As the 2D TechniqueSetupForm does: authored slot defaults pre-fill; nothing else is supplied.
      setValues(Object.fromEntries(configurationSlots(d)
        .filter((slot) => slot.kind === "classroom-quantity" && slot.defaultValue !== undefined)
        .map((slot) => [slot.id, String(slot.defaultValue)])));
    },
      (e: unknown) => { if (active) setError(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, [techniqueId]);

  const missing = useMemo(() => (definition ? unresolvedConfigurationSlots(definition) : []), [definition]);
  const blocker = definition ? standaloneTechniqueConfigurationBlocker(definition) : null;
  const slots = definition ? configurationSlots(definition) : [];
  const quantities = slots.filter((s) => s.kind === "classroom-quantity");
  const readiness = definition ? equipment3dReadiness(definition.initialState.equipment.map((e) => e.definitionId)) : undefined;

  if (error) return <main className="s3d-gate-page"><div className="s3d-gate"><h1>Technique unavailable</h1><p>{error}</p><a href={fallbackHash}>Open the 2D version</a></div></main>;
  if (!definition) return <main className="s3d-gate-page"><div className="s3d-gate" aria-live="polite"><p className="s3d-eyebrow">Technique</p><p>Preparing the bench…</p><a href={fallbackHash}>Open the 2D version</a></div></main>;

  if (page === "play" && (configured ?? (missing.length === 0 ? definition : undefined))) {
    return <Player3D definition={configured ?? definition} authoredDefinition={definition} title={definition.title}
      sourceTag={pack ? `TECHNIQUE · PACK ${pack}` : "TECHNIQUE"} fallbackHash={fallbackHash} backHref="#/techniques" />;
  }

  const journey = definition.process.nodes.slice(0, 8);
  const start = () => {
    if (missing.length === 0) { setPage("play"); return; }
    if (quantities.length === 0) {
      // Only internal record names are unresolved: they are derived, never asked for, so there is
      // nothing for a teacher to enter (mock-up P2). The result equals the 2D form with no inputs.
      try {
        const next = applyTechniqueConfiguration(definition, {});
        if (unresolvedConfigurationSlots(next).length === 0) { setConfigured(next); setPage("play"); return; }
      } catch (failure) {
        // There is nothing for a teacher to enter, so the core's refusal stays on this page.
        setSetupError(failure instanceof Error ? failure.message : String(failure));
        return;
      }
    }
    setPage("setup");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const next = applyTechniqueConfiguration(definition, values);
      const still = unresolvedConfigurationSlots(next);
      if (still.length > 0) { setSetupError(unresolvedConfigurationMessage(still)); return; }
      setConfigured(next);
      setPage("play");
    } catch (failure) {
      setSetupError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <main className="s3d-gate-page">
      {page === "intro" ? (
        <section className="s3d-gate" aria-labelledby="s3d-gate-title">
          <p className="s3d-eyebrow">Before you start</p>
          <h1 id="s3d-gate-title">{definition.title}</h1>
          <p>{definition.learningGoal}</p>
          <ol className="s3d-journey">
            {journey.map((node, i) => <li key={node.id}><b>{i + 1}</b>{node.title}</li>)}
            {definition.process.nodes.length > 8 ? <li className="s3d-journey__more">and {definition.process.nodes.length - 8} more</li> : null}
          </ol>
          {blocker ? (
            <>
              <p className="s3d-blocker" role="alert">{blocker}</p>
              {hostLabsForTechnique(definition.id).length ? (
                <div className="s3d-hosts">
                  <p className="s3d-eyebrow">Plays inside</p>
                  <ul>{hostLabsForTechnique(definition.id).map((h) => <li key={h.id}><a href={h.href}>{h.title}</a></li>)}</ul>
                </div>
              ) : null}
              <p className="s3d-small">No start button: this technique does not run on its own.</p>
            </>
          ) : readiness && !readiness.ready ? (
            // Readiness is necessary (plan §2.7): without every model the bench would be missing items.
            <>
              <p className="s3d-note">Not yet in 3D: {readiness.missing.join(", ")}.</p>
              <div className="s3d-gate__actions"><a className="s3d-button s3d-button--primary" href={fallbackHash}>Open the 2D version</a></div>
            </>
          ) : (
            <>
              {setupError ? <p className="s3d-field__error" role="alert">{setupError}</p> : null}
              {missing.length > 0 && quantities.length > 0 ? <p className="s3d-note">A teacher sets {quantities.length === 1 ? "one classroom value" : `${quantities.length} classroom values`} before this technique can start.</p> : null}
              <div className="s3d-gate__actions">
                <a href={fallbackHash}>Open the 2D version</a>
                <button type="button" className="s3d-button s3d-button--primary" onClick={start}>{missing.length > 0 && quantities.length > 0 ? "Next: setup" : "Start"}</button>
              </div>
            </>
          )}
        </section>
      ) : (
        <form className="s3d-gate" onSubmit={submit} aria-labelledby="s3d-setup-title">
          <p className="s3d-eyebrow">Setup</p>
          <h1 id="s3d-setup-title">Classroom values</h1>
          <p className="s3d-field__meta"><ProvenanceChip kind="teacher" /> <span className="s3d-small">Nothing is filled in for you.</span></p>
          <div className="s3d-setup-grid">
            {quantities.map((slot) => {
              const label = slotLabel(slot.id);
              const id = `s3d-slot-${slot.id}`;
              return (
                <div className="s3d-field" key={slot.id}>
                  <label htmlFor={id}>{label.label} <span className="s3d-mono s3d-small">{slot.id}</span></label>
                  <div className="s3d-input">
                    <input id={id} required inputMode={slot.mode === "numeric" ? "decimal" : "text"} value={values[slot.id] ?? ""}
                      onChange={(e) => setValues({ ...values, [slot.id]: e.target.value })} />
                    {label.unit ? <span className="s3d-input__unit">{label.unit}</span> : null}
                  </div>
                  {label.help ? <p className="s3d-small">{label.help}</p> : null}
                </div>
              );
            })}
          </div>
          {slots.some((s) => s.kind === "internal-identifier") ? <p className="s3d-small">Record names are assigned automatically and never ask you for a value.</p> : null}
          <label className="s3d-check"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> I approve these values for my classroom.</label>
          {setupError ? <p className="s3d-field__error" role="alert">{setupError}</p> : null}
          <div className="s3d-gate__actions">
            <button type="button" className="s3d-button" onClick={() => setPage("intro")}>Back</button>
            <button type="submit" className="s3d-button s3d-button--primary" disabled={!approved}>Save setup and start</button>
          </div>
        </form>
      )}
    </main>
  );
};
