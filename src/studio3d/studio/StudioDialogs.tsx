import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TechniqueDefinition } from "../../domain/types";
import { configurationSlots } from "../../data/techniqueConfiguration";
import { workflowConfigurationBlocker } from "../../studio/workflowConfiguration";
import { Icon } from "../ui/Icon";
import { StatusChip, Thumbnail } from "./LibraryPanel";
import { SetupSlotsForm, initialSetupValues, setupComplete } from "./SetupSlotsForm";
import { describeTechnique, type CatalogueTechnique } from "./techniqueCatalog";

/** A modal dialog (handoff §4.8): Esc or the close button dismisses it; focus starts inside. */
export const Dialog = ({ eyebrow, title, icon, onClose, children, footer, wide }: {
  eyebrow?: string; title: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="s3d-sdialog-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`s3d-sdialog${wide ? " s3d-sdialog--wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="s3d-sdialog__head">
          {eyebrow ? <div className="s3d-eyebrow">{eyebrow}</div> : null}
          <h2>{icon}{title}</h2>
          <button type="button" data-close className="s3d-button s3d-button--icon s3d-button--quiet s3d-sdialog__close" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="s3d-sdialog__body">{children}</div>
        {footer ? <div className="s3d-sdialog__foot">{footer}</div> : null}
      </div>
    </div>
  );
};

/**
 * Configure before append (handoff §4.8; plan §4.6 `appendConfiguredWorkflow`): the technique's
 * slots with units and teacher approval, or the core's blocker verbatim with host links and no way
 * to add. "Add workflow" stays disabled until the form is complete.
 */
export const ConfigureWorkflowDialog = ({ technique, pack, onAdd, onClose }: {
  technique: TechniqueDefinition;
  pack?: number;
  onAdd: (values: Record<string, string>, approved: boolean) => string | undefined;
  onClose: () => void;
}) => {
  const [values, setValues] = useState(() => initialSetupValues(technique));
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string>();
  const blocker = workflowConfigurationBlocker(technique);
  const info = describeTechnique(technique);
  const needsApproval = configurationSlots(technique).some((slot) => slot.kind === "classroom-quantity");
  const ready = !blocker && setupComplete(technique, values) && (approved || !needsApproval);
  return (
    <Dialog eyebrow={`Add workflow${pack ? ` · Pack ${pack}` : ""}`} title={technique.title} icon={<Thumbnail definitionId={info.thumbnailId} size={40} />} onClose={onClose}
      footer={(
        <>
          <button type="button" className="s3d-button" onClick={onClose}>{blocker ? "Close" : "Cancel"}</button>
          <button type="button" className="s3d-button s3d-button--primary" disabled={!ready} onClick={() => setError(onAdd(values, approved))}>Add workflow</button>
        </>
      )}>
      <p className="s3d-small">{technique.learningGoal}</p>
      {blocker ? (
        <>
          <div className="s3d-blocker" role="alert"><Icon name="lock" />
            <div>{blocker}
              {info.hosts.length ? <div className="s3d-blocker__links">{info.hosts.map((h) => <a key={h.id} href={h.href}>{h.id}</a>)}</div> : null}
            </div>
          </div>
          <p className="s3d-small">These experiments become available in 3D in later packs.</p>
        </>
      ) : (
        <>
          <SetupSlotsForm technique={technique} values={values} approved={approved} idPrefix="append" onChange={(id, v) => setValues((s) => ({ ...s, [id]: v }))} onApprove={setApproved} />
          {!needsApproval ? <p className="s3d-small">This technique has no classroom values to set.</p> : null}
          {info.missingModels.length ? <div className="s3d-note"><b>Not yet in 3D.</b> Missing models: {info.missingModels.join(", ")}. The draft still plays in the 2D player.</div> : null}
        </>
      )}
      {error ? <p className="s3d-field__error" role="alert">{error}</p> : null}
    </Dialog>
  );
};

/** Open (handoff §4.8): published techniques by pack, read-only until "Edit a copy". */
export const OpenDialog = ({ techniques, loading, onOpen, onImport, onClose }: {
  techniques: CatalogueTechnique[];
  loading: boolean;
  onOpen: (technique: TechniqueDefinition) => void;
  onImport: () => void;
  onClose: () => void;
}) => {
  const packs = [...new Set(techniques.map((t) => t.pack ?? 0))].sort((a, b) => a - b);
  return (
    <Dialog eyebrow="Open" title="Open a published technique" onClose={onClose} wide
      footer={<><button type="button" className="s3d-button" onClick={onImport}><Icon name="upload" />Import a draft file…</button><button type="button" className="s3d-button" onClick={onClose}>Close</button></>}>
      <p className="s3d-small">A published technique opens read-only. Choose “Edit a copy” to change it; the copy is your draft in this browser.</p>
      {loading ? <p className="s3d-small">Loading…</p> : packs.map((pack) => (
        <section key={pack} className="s3d-open-pack">
          <div className="s3d-eyebrow">{pack ? `Pack ${pack}` : "Not in a pack"}</div>
          <div className="s3d-open-grid">
            {techniques.filter((t) => (t.pack ?? 0) === pack).map((t) => (
              <button key={t.id} type="button" className="s3d-lib-card s3d-lib-card--tech" disabled={!t.definition} onClick={() => t.definition && onOpen(t.definition)}>
                <Thumbnail definitionId={t.thumbnailId} size={52} />
                <span className="s3d-lib-card__text">
                  <span className="s3d-lib-card__name">{t.title}</span>
                  <span className="s3d-lib-card__detail">{t.definition ? `${t.definition.process.nodes.length} steps` : t.error}</span>
                  <StatusChip status={t.status} />
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </Dialog>
  );
};

export const ImportErrorsDialog = ({ errors, onClose }: { errors: string[]; onClose: () => void }) => (
  <Dialog eyebrow="Import" title="This file could not be imported" onClose={onClose} footer={<button type="button" className="s3d-button" onClick={onClose}>Close</button>}>
    <p className="s3d-small">Nothing changed. The validator reported:</p>
    <ul className="s3d-errors">{errors.map((e, i) => <li key={i} className="s3d-mono">{e}</li>)}</ul>
  </Dialog>
);

/** The two Studios keep their drafts apart (plan §11); moving work between them is an export. */
export const OriginalStudioDialog = ({ onExport, onClose }: { onExport: () => void; onClose: () => void }) => (
  <Dialog eyebrow="Original Studio" title="Open in the original Studio" onClose={onClose}
    footer={<><button type="button" className="s3d-button" onClick={onExport}><Icon name="download" />Export draft</button><a className="s3d-button s3d-button--primary" href="#/studio">Open the original Studio</a></>}>
    <p>The two Studios store their drafts separately in this browser, so neither overwrites the other.</p>
    <p className="s3d-small">To continue this draft there, export it here and import the file in the original Studio. The WebMCP Experiment Composer, guided rehearsal and the Protocol Check are in the original Studio.</p>
  </Dialog>
);

const KEYS: Array<[string, string, string]> = [
  ["Arrows", "Move the selection along connections", "Move the selected item 10 mm"],
  ["Shift + arrows", "Nudge the step 8 px (1 px with Alt)", "Move the item 50 mm"],
  ["Enter", "Open the selection in the inspector", "Inspect"],
  ["C", "Start a connection from the selection", "—"],
  ["Delete", "Remove, with an undo toast", "Remove from the starting setup"],
  ["Ctrl/⌘ Z · Ctrl/⌘ Shift Z", "Undo, redo", "Undo, redo"],
  ["Esc", "Cancel a drag or connection, or leave expanded mode", "Cancel a drag"],
  ["Home / F", "Fit all / frame the selection", "Reset view / frame the selection"],
  ["Space + drag", "Pan", "—"],
];

export const HelpDialog = ({ onClose }: { onClose: () => void }) => (
  <Dialog eyebrow="Help" title="How Studio 3D works" onClose={onClose} wide footer={<button type="button" className="s3d-button" onClick={onClose}>Close</button>}>
    <ul className="s3d-help-list">
      <li><b>Find on the left, make in the centre, adjust on the right.</b> Drag a step from the library onto the flow, or onto a connection to insert it there.</li>
      <li><b>Every change is one step in the activity list</b> and undoes in one step.</li>
      <li><b>Starting bench</b> arranges the equipment the learner starts with, on the real 3D bench. Positions are stored in the units the 2D player uses, so a draft still plays there.</li>
      <li><b>Preview</b> runs the draft in the 3D player. Preview runs are not saved.</li>
    </ul>
    <table className="s3d-keys">
      <thead><tr><th>Key</th><th>Flow</th><th>Starting bench</th></tr></thead>
      <tbody>{KEYS.map(([key, flow, bench]) => <tr key={key}><td><span className="s3d-kbd">{key}</span></td><td>{flow}</td><td>{bench}</td></tr>)}</tbody>
    </table>
    <p className="s3d-small">Single-letter keys work only while the canvas has focus.</p>
  </Dialog>
);
