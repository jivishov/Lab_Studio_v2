import { useEffect, useState, type FormEvent } from "react";
import { equipment3dReadiness } from "../equipment3d/readiness";
import { lab3DSummary, loadLab3D, type Lab3DSummary, type Loaded3DLab } from "../labs3d";
import { parseLab3DValues } from "../labs3dSetup";
import { studio3DFallbackHash } from "../routes3d";
import { Icon } from "../ui/Icon";
import { ProvenanceChip } from "../ui/ProvenanceChip";
import { Player3D } from "./Player3D";
import { SimulationSwitcher } from "./SimulationSwitcher";

/** Steps shown under each part on the intro; the rest are counted. */
const JOURNEY_PER_PART = 4;

/**
 * `#/3d/play/:labId` (D8, decided 2026-10-10; `proposals/D8_EXPERIMENT_ASSEMBLY.md`, "E0 design" §4–§5):
 * a 3D experiment from `public/labs-3d/`. The intro shows the parts and their steps; the setup page
 * asks for the teacher's values (the approved defaults filled in, as on a technique's setup); the
 * run plays the compiled lab, the step card naming each step's part. The intro's journey compiles the
 * defaults; the run compiles the values the teacher saved.
 */
export const Lab3DRoute = ({ labId }: { labId: string }) => {
  const [summary, setSummary] = useState<Lab3DSummary>();
  const [preview, setPreview] = useState<Loaded3DLab>();
  const [error, setError] = useState<string>();
  const [page, setPage] = useState<"intro" | "setup" | "play">("intro");
  const [values, setValues] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);
  const [loaded, setLoaded] = useState<Loaded3DLab>();
  const [setupError, setSetupError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const fallbackHash = studio3DFallbackHash({ view: "play", labId });
  const twoD = (className?: string) => <a className={className} href={fallbackHash}>Open the 2D version</a>;

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await lab3DSummary(labId);
      if (!found) throw new Error(`There is no 3D experiment "${labId}".`);
      const defaults = Object.fromEntries(found.setup.map((field) => [field.id, String(field.defaultValue)]));
      const compiled = await loadLab3D(found, defaults);
      if (!active) return;
      setSummary(found);
      setValues(defaults);
      setPreview(compiled);
    })().catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, [labId]);

  if (error) return <main className="s3d-gate-page"><div className="s3d-gate"><h1>Experiment unavailable</h1><p>{error}</p>{twoD()}</div></main>;
  if (!summary || !preview) return <main className="s3d-gate-page"><div className="s3d-gate" aria-live="polite"><p className="s3d-eyebrow">Experiment</p><p>Preparing the bench…</p>{twoD()}</div></main>;

  if (page === "play" && loaded) {
    return <Player3D definition={loaded.lab} authoredDefinition={loaded.authored} title={summary.title} sourceTag="EXPERIMENT"
      fallbackHash={fallbackHash} backHref="#/labs" simulationId={labId} parts={loaded.parts} />;
  }

  const readiness = equipment3dReadiness((preview.lab.initialState?.equipment ?? []).map((e) => e.definitionId));
  const nodes = preview.lab.process.nodes;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSetupError(undefined);
    try {
      parseLab3DValues(summary, values);
      setStarting(true);
      setLoaded(await loadLab3D(summary, values));
      setPage("play");
    } catch (failure) {
      setSetupError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="s3d-gate-page">
      <header className="s3d-gatebar">
        <span className="s3d-mark"><Icon name="flask" size={18} /></span>
        <SimulationSwitcher currentId={labId} title={summary.title} hasProgress={false} />
      </header>
      {page === "intro" ? (
        <section className="s3d-gate" aria-labelledby="s3d-gate-title">
          <p className="s3d-eyebrow">Before you start · {summary.parts.length} parts, {nodes.length} steps</p>
          <h1 id="s3d-gate-title">{summary.title}</h1>
          <p>{summary.description}</p>
          {summary.parts.map((part, partIndex) => {
            const steps = nodes.map((node, index) => ({ node, index })).filter(({ node }) => preview.parts.get(node.id)?.index === partIndex + 1);
            return (
              <section key={part.instanceId} className="s3d-journey-part" aria-label={`Part ${partIndex + 1}: ${part.title}`}>
                <h2 className="s3d-journey-part__title">Part {partIndex + 1} · {part.title}</h2>
                <ol className="s3d-journey">
                  {steps.slice(0, JOURNEY_PER_PART).map(({ node, index }) => <li key={node.id}><b>{index + 1}</b>{node.title}</li>)}
                  {steps.length > JOURNEY_PER_PART ? <li className="s3d-journey__more">and {steps.length - JOURNEY_PER_PART} more</li> : null}
                </ol>
              </section>
            );
          })}
          {!readiness.ready ? (
            <>
              <p className="s3d-note">Not yet in 3D: {readiness.missing.join(", ")}.</p>
              <div className="s3d-gate__actions">{twoD("s3d-button s3d-button--primary")}</div>
            </>
          ) : (
            <>
              <p className="s3d-note">A teacher sets {summary.setup.length} classroom values before this experiment can start.</p>
              <div className="s3d-gate__actions">
                {twoD()}
                <button type="button" className="s3d-button s3d-button--primary" onClick={() => setPage("setup")}>Next: setup</button>
              </div>
            </>
          )}
        </section>
      ) : (
        <form className="s3d-gate" onSubmit={submit} aria-labelledby="s3d-setup-title">
          <p className="s3d-eyebrow">Setup</p>
          <h1 id="s3d-setup-title">Classroom values</h1>
          <p className="s3d-field__meta"><ProvenanceChip kind="teacher" /> <span className="s3d-small">Approved defaults are filled in; change any value you need.</span></p>
          <div className="s3d-setup-grid">
            {summary.setup.map((field) => {
              const id = `s3d-lab-${field.id}`;
              return (
                <div className={`s3d-field${field.kind === "text" ? " s3d-field--wide" : ""}`} key={field.id}>
                  <label htmlFor={id}>{field.label}</label>
                  {field.kind === "text" ? (
                    <textarea id={id} className="s3d-textarea" required rows={2} value={values[field.id] ?? ""}
                      onChange={(e) => setValues({ ...values, [field.id]: e.target.value })} />
                  ) : (
                    <div className="s3d-input">
                      <input id={id} required inputMode="decimal" value={values[field.id] ?? ""}
                        onChange={(e) => setValues({ ...values, [field.id]: e.target.value })} />
                      {field.unit ? <span className="s3d-input__unit">{field.unit}</span> : null}
                    </div>
                  )}
                  {field.help ? <p className="s3d-small">{field.help}</p> : null}
                </div>
              );
            })}
          </div>
          <label className="s3d-check"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> I approve these values for my classroom.</label>
          {setupError ? <p className="s3d-field__error" role="alert">{setupError}</p> : null}
          <div className="s3d-gate__actions">
            <button type="button" className="s3d-button" onClick={() => setPage("intro")}>Back</button>
            <button type="submit" className="s3d-button s3d-button--primary" disabled={!approved || starting}>Save setup and start</button>
          </div>
        </form>
      )}
    </main>
  );
};
