import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { fallback2DTechniqueId, load3DTechnique, pack3D, practiceSummary } from "../practice";
import { studio3DFallbackHash } from "../routes3d";
import { ProvenanceChip } from "../ui/ProvenanceChip";
import { Player3D } from "./Player3D";
import { SimulationSwitcher } from "./SimulationSwitcher";
import { Icon } from "../ui/Icon";

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
  const [basedOn, setBasedOn] = useState<string>();
  // A practice version (Pack 2 decision 1A) has no 2D route of its own: its 2D fallback is the
  // lab-bound original's, which names the labs that play it. Until that is known (or when it cannot
  // be), no 2D link is offered, so a practice id never reaches the 2D player.
  const [fallbackId, setFallbackId] = useState<string>();
  const fallbackHash = fallbackId ? studio3DFallbackHash({ view: "technique", techniqueId: fallbackId }) : undefined;
  const twoD = (className?: string) => (fallbackHash
    ? <a className={className} href={fallbackHash}>Open the 2D version</a>
    : <span className="s3d-small">2D version not available</span>);

  // The top bar's source badge names the technique's pack (§5.4): catalogue order, in fives, for
  // Pack 1; a practice version's own pack.
  useEffect(() => {
    let active = true;
    pack3D(techniqueId).then((p) => { if (active) setPack(p); }, () => undefined);
    practiceSummary(techniqueId).then((p) => { if (active) setBasedOn(p?.basedOn); }, () => undefined);
    fallback2DTechniqueId(techniqueId).then((id) => { if (active) setFallbackId(id); }, () => undefined);
    return () => { active = false; };
  }, [techniqueId]);

  useEffect(() => {
    let active = true;
    load3DTechnique(techniqueId).then((d) => {
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

  if (error) return <main className="s3d-gate-page"><div className="s3d-gate"><h1>Technique unavailable</h1><p>{error}</p>{twoD()}</div></main>;
  if (!definition) return <main className="s3d-gate-page"><div className="s3d-gate" aria-live="polite"><p className="s3d-eyebrow">Technique</p><p>Preparing the bench…</p>{twoD()}</div></main>;

  if (page === "play" && (configured ?? (missing.length === 0 ? definition : undefined))) {
    return <Player3D definition={configured ?? definition} authoredDefinition={definition} title={definition.title}
      sourceTag={pack ? `${basedOn ? "PRACTICE" : "TECHNIQUE"} · PACK ${pack}` : "TECHNIQUE"} fallbackHash={fallbackHash} backHref="#/techniques"
      simulationId={techniqueId} />;
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
      <header className="s3d-gatebar">
        <span className="s3d-mark"><Icon name="flask" size={18} /></span>
        <SimulationSwitcher currentId={techniqueId} title={definition.title} hasProgress={false} />
      </header>
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
              <div className="s3d-gate__actions">{twoD("s3d-button s3d-button--primary")}</div>
            </>
          ) : (
            <>
              {setupError ? <p className="s3d-field__error" role="alert">{setupError}</p> : null}
              {missing.length > 0 && quantities.length > 0 ? <p className="s3d-note">A teacher sets {quantities.length === 1 ? "one classroom value" : `${quantities.length} classroom values`} before this technique can start.</p> : null}
              <div className="s3d-gate__actions">
                {twoD()}
                <button type="button" className="s3d-button s3d-button--primary" onClick={start}>{missing.length > 0 && quantities.length > 0 ? "Next: setup" : "Start"}</button>
              </div>
            </>
          )}
        </section>
      ) : (
        <form className="s3d-gate" onSubmit={submit} aria-labelledby="s3d-setup-title">
          <p className="s3d-eyebrow">Setup</p>
          <h1 id="s3d-setup-title">Classroom values</h1>
          <p className="s3d-field__meta"><ProvenanceChip kind="teacher" /> <span className="s3d-small">{quantities.some((slot) => slot.defaultValue !== undefined)
            ? "Approved defaults are filled in; change any value you need." : "Nothing is filled in for you."}</span></p>
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
