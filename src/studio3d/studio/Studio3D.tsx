import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LabDefinition, TechniqueDefinition } from "../../domain/types";
import { downloadJson, parseImportedJson } from "../../studio/importExport";
import { labDraftFromTechnique, serializeStudioArtifact, studioArtifactFilename, type StudioArtifactKind } from "../../studio/studioArtifact";
import { isRunnableReadiness } from "../../studio/studioReadiness";
import { studioTemplates } from "../../studio/studioState";
import { collectStudioEquipmentIds } from "../../studio/studioValidation";
import { workflowSourceId } from "../../studio/workflowConfiguration";
import { equipment3dReadiness } from "../equipment3d/readiness";
import { Icon } from "../ui/Icon";
import { addStartingItem, BenchInventory, BenchSetupView, EquipmentInspector, nudgeStartingItem, returnStartingItemToShelf } from "./BenchSetupView";
import { removeConnection } from "./draftEdits";
import { EquipmentTurntable } from "./EquipmentTurntable";
import { FlowView } from "./FlowView";
import { Inspector, type InspectorTab } from "./Inspector";
import { LibraryPanel, type StageView } from "./LibraryPanel";
import type { LibraryDrag } from "./libraryDrag";
import { PreviewView } from "./PreviewView";
import { ConfigureWorkflowDialog, Dialog, HelpDialog, ImportErrorsDialog, OpenDialog, OriginalStudioDialog } from "./StudioDialogs";
import { needsTeacherSetup, useTechniqueCatalogue } from "./techniqueCatalog";
import { useStudio3DDraft } from "./useStudio3DDraft";

/**
 * Studio 3D (handoff §4; plan §4.6): the original Studio's mechanism with a new face. Find on the
 * left, make in the centre, understand and adjust on the right (clarity rule 1). Every edit is one
 * Studio transaction; the draft lives under its own storage key. Its stage preferences are kept
 * under `lab-studio:3d:v1:studio-ui` (§3.8), never with the draft.
 */
const UI_KEY = "lab-studio:3d:v1:studio-ui";
interface StudioUi { view: StageView }
const readUi = (): StudioUi => {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? "{}") as Partial<StudioUi>;
    return { view: raw.view === "bench" || raw.view === "preview" ? raw.view : "flow" };
  } catch {
    return { view: "flow" };
  }
};
const writeUi = (ui: StudioUi) => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* works without storage */ } };

type Pill = { label: string; tone: "ok" | "warn" | "neutral" | "err"; icon: string };

export const Studio3D = () => {
  const studio = useStudio3DDraft();
  const { draft, artifactKind, readiness, selection, setSelection, readOnly, commit } = studio;
  const { techniques, loading } = useTechniqueCatalogue();
  const [view, setViewState] = useState<StageView>(() => readUi().view);
  const [tab, setTab] = useState<InspectorTab>("selected");
  const [expanded, setExpanded] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: "open" } | { kind: "help" } | { kind: "original" } | { kind: "import-errors"; errors: string[] }
    | { kind: "configure"; technique: TechniqueDefinition; pack?: number } | { kind: "inspect-equipment"; instanceId: string } | undefined>();
  const [newOpen, setNewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void }; tone?: "error" }>();
  const [focus, setFocus] = useState<{ nodeId?: string; version: number }>({ version: 0 });
  const [flowFocusVersion, setFlowFocusVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const setView = (next: StageView) => { setViewState(next); writeUi({ view: next }); };
  const showToast = useCallback((text: string, action?: { label: string; run: () => void }) => setToast({ text, ...(action ? { action } : {}) }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(undefined), toast.tone === "error" ? 8000 : 4000);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => { if (studio.message) setToast({ text: studio.message.text, ...(studio.message.tone === "error" ? { tone: "error" as const } : {}) }); }, [studio.message]);

  // Status (clarity rule 4): the readiness chip, the stage badge and the inspector footer.
  const failures = readiness.diagnostics.filter((d) => d.severity === "fail").length;
  const warnings = readiness.diagnostics.filter((d) => d.severity === "warning").length;
  const issues = failures + warnings;
  const models = equipment3dReadiness(collectStudioEquipmentIds(draft));
  const flattened = artifactKind === "lab" && draft.techniques.length > 0 && !draft.compositionManifest;
  const needsSetup = draft.techniques.some((t) => needsTeacherSetup(t)) || readiness.diagnostics.some((d) => d.id.startsWith("unresolved-configuration"));
  const catalogueOf = (id: string) => techniques.find((t) => t.id === id);
  const publishedPack = readOnly ? catalogueOf(readOnly.techniqueId)?.pack : undefined;
  const pill: Pill = readOnly ? { label: "Read-only", tone: "neutral", icon: "lock" }
    : draft.compositionManifest?.status === "detached" ? { label: "Detached from compiler", tone: "warn", icon: "link" }
      : flattened ? { label: "Flattened", tone: "neutral", icon: "cards" }
        : draft.techniques.some((t) => catalogueOf(workflowSourceId(t))?.status === "host") ? { label: "Host-bound", tone: "warn", icon: "lock" }
          : !models.ready ? { label: "Not yet in 3D", tone: "neutral", icon: "cube" }
            : needsSetup ? { label: "Needs setup", tone: "warn", icon: "clip" }
              // "3D-ready" claims the draft runs; until it does, the pill names the Studio's own level.
              : !isRunnableReadiness(readiness) ? { label: readiness.label, tone: "neutral", icon: "pencil" }
                : { label: "3D-ready", tone: "ok", icon: "check" };
  const eyebrow = artifactKind === "technique"
    ? `Technique / ${readOnly ? (publishedPack ? `Pack ${publishedPack}` : "Published") : draft.id.endsWith("-copy") ? "Draft copy" : "Draft"}`
    : "Experiment / Draft";
  const saveText = readOnly ? "Published technique · not saved" : studio.saveStatus === "saving" ? "Saving…" : studio.saveStatus === "unavailable" ? "Not saved: storage is unavailable" : "Saved in this browser";

  // ------------------------------------------------------------------ adding from the library
  const selectedNodeId = selection?.kind === "node" ? selection.id : undefined;
  const addFromLibrary = async (item: LibraryDrag, anchor?: { anchorNodeId: string; placement: "after" }) => {
    if (readOnly) { showToast("This published technique is read-only. Choose “Edit a copy” to change it."); return; }
    if (item.kind === "equipment") {
      if (view !== "bench") setView("bench");
      addStartingItem(studio, item.id);
      return;
    }
    if (item.kind === "technique") {
      const entry = catalogueOf(item.id);
      if (!entry?.definition) { showToast(entry?.error ?? "That technique has not loaded yet."); return; }
      setDialog({ kind: "configure", technique: entry.definition, ...(entry.pack ? { pack: entry.pack } : {}) });
      return;
    }
    const template = studioTemplates.find((t) => t.id === item.id);
    if (!template) return;
    const before = new Set(draft.process.nodes.map((n) => n.id));
    const target = anchor ?? (selectedNodeId ? { anchorNodeId: selectedNodeId, placement: "after" as const } : undefined);
    const label = target ? `Insert ${template.title}` : `Add ${template.title}`;
    const result = commit(label, [{ type: "appendTemplateStep", templateId: template.id, ...(target ? { options: target } : {}) }]);
    if (result.ok) {
      const inserted = result.draft.process.nodes.find((n) => !before.has(n.id));
      if (inserted) setSelection({ kind: "node", id: inserted.id });
    }
  };
  const appendWorkflow = (technique: TechniqueDefinition, values: Record<string, string>, approved: boolean): string | undefined => {
    const before = new Set(draft.process.nodes.map((n) => n.id));
    const result = commit(`Append workflow · ${technique.title}`, [{ type: "appendConfiguredWorkflow", technique, values, approved }]);
    if (!result.ok) return result.error;
    const first = result.draft.process.nodes.find((n) => !before.has(n.id));
    if (first) setSelection({ kind: "node", id: first.id });
    setDialog(undefined);
    setFlowFocusVersion((v) => v + 1);
    return undefined;
  };

  // ------------------------------------------------------------------ open, import and export
  const openPublished = (technique: TechniqueDefinition) => {
    studio.openPublished(technique);
    setDialog(undefined);
    setView("flow");
    setFlowFocusVersion((v) => v + 1);
  };
  const exportDraft = () => {
    try {
      downloadJson(studioArtifactFilename(artifactKind, draft), serializeStudioArtifact(artifactKind, draft));
      showToast(`Exported ${studioArtifactFilename(artifactKind, draft)}.`);
    } catch (error) {
      setDialog({ kind: "import-errors", errors: (error instanceof Error ? error.message : String(error)).split("\n") });
    }
  };
  const importFile = async (file: File) => {
    const parsed = parseImportedJson(await file.text());
    if (!parsed.ok || !parsed.value) { setDialog({ kind: "import-errors", errors: parsed.errors }); return; }
    const value = parsed.value;
    const kind: StudioArtifactKind = "audience" in value ? "lab" : "technique";
    const next: LabDefinition = "audience" in value ? value : labDraftFromTechnique(value);
    commit(`Import ${file.name}`, [{ type: "replaceDraft", draft: next }], { artifactKind: kind, selection: undefined, readOnly: null });
    setDialog(undefined);
    setFlowFocusVersion((v) => v + 1);
  };

  // Undo and redo everywhere but in text fields (§4.9).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      if (event.key === "Escape" && expanded && !dialog) { setExpanded(false); return; }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); studio.undo(); }
      else if (key === "y" || (key === "z" && event.shiftKey)) { event.preventDefault(); studio.redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const previewFrom = (nodeId: string) => {
    setFocus((f) => ({ nodeId, version: f.version + 1 }));
    setView("preview");
  };
  // In the split view the preview follows the selected step (§4.6).
  useEffect(() => {
    if (view === "preview" && selectedNodeId) setFocus((f) => (f.nodeId === selectedNodeId ? f : { nodeId: selectedNodeId, version: f.version + 1 }));
  }, [selectedNodeId, view]);

  const benchCounts = useMemo(() => {
    const kept = draft.initialState?.equipment ?? [];
    return { bench: kept.filter((i) => i.location === "workbench" || i.location === "snapZone").length, shelf: kept.filter((i) => i.location === "shelf").length };
  }, [draft.initialState?.equipment]);
  const badge = view === "bench"
    ? `Starting bench · ${benchCounts.bench} on bench · ${benchCounts.shelf} on shelf`
    : view === "preview" ? `Preview · ${readiness.label}`
      : flattened ? `Experiment · Flattened · ${draft.process.nodes.length} steps`
        : `Process · ${draft.process.nodes.length} step${draft.process.nodes.length === 1 ? "" : "s"} · ${issues} issue${issues === 1 ? "" : "s"}`;

  const selectedEquipment = selection?.kind === "equipment" ? selection.id : undefined;
  const removeStartingItem = (instanceId: string) => {
    const authored = draft.initialState?.equipment.find((i) => i.id === instanceId);
    if (!authored) { showToast("This item is added by the runtime because the draft requires it. Remove it from Required equipment in Setup."); return; }
    const result = commit(`Remove ${authored.label} from the starting setup`, [{ type: "removeInitialEquipment", instanceId }], { selection: undefined });
    if (result.ok) showToast(`Removed ${authored.label}.`, { label: "Undo", run: studio.undo });
  };

  const empty = draft.process.nodes.length === 0;
  const stage = (
    <section className={`s3d-stage${view !== "flow" ? " is-dark" : ""}`} aria-label="Stage">
      <div className="s3d-gbadge"><span className={`s3d-gbadge__t${issues && view === "flow" ? " is-warn" : ""}`}>{badge}</span></div>
      <div className="s3d-seg" role="tablist" aria-label="Stage view">
        {(["flow", "bench", "preview"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? "is-on" : ""} onClick={() => setView(id)}>
            {id === "flow" ? "Flow" : id === "bench" ? "Starting bench" : "Preview"}
          </button>
        ))}
      </div>
      <button type="button" className="s3d-stage__expand" aria-label={expanded ? "Leave expanded view" : "Expand the stage"} aria-pressed={expanded} onClick={() => setExpanded((v) => !v)}><Icon name="expand" /></button>
      {readOnly ? (
        <div className="s3d-banner" role="status"><Icon name="lock" /><span><b>Published technique · read-only.</b> Nothing here changes the published version.</span>
          <button type="button" className="s3d-button s3d-button--primary" onClick={() => { studio.editCopy(); setTab("selected"); }}>Edit a copy</button></div>
      ) : draft.compositionManifest?.status === "detached" ? (
        <div className="s3d-banner" role="status"><Icon name="link" /><span><b>Detached from the compiler.</b> Edits are not compiled until the compiler runs again.</span></div>
      ) : null}
      {view === "flow" ? (
        empty ? (
          <div className="s3d-stage-empty">
            <div className="s3d-glass-card">
              <div className="s3d-empty-title">{artifactKind === "technique" ? "Build your technique" : "Build your experiment"}</div>
              <p>{artifactKind === "technique" ? "Drag a step from the library, or open a published technique." : "Add a published technique from the library, or drag a step onto the flow."}</p>
              <button type="button" className="s3d-button s3d-button--primary" onClick={() => setDialog({ kind: "open" })}>Open a published technique</button>
            </div>
            <FlowView studio={studio} onInspect={() => setTab("selected")} onAddFromLibrary={addFromLibrary} onToast={showToast} focusVersion={flowFocusVersion} />
          </div>
        ) : <FlowView studio={studio} onInspect={() => setTab("selected")} onAddFromLibrary={addFromLibrary} onToast={showToast} focusVersion={flowFocusVersion} />
      ) : view === "bench" ? (
        <BenchSetupView studio={studio} onToast={showToast} onInspectEquipment={(instanceId) => setDialog({ kind: "inspect-equipment", instanceId })} />
      ) : (
        <PreviewView studio={studio} focusNodeId={focus.nodeId} focusVersion={focus.version}
          onFocus={(nodeId) => { setSelection({ kind: "node", id: nodeId }); setFocus((f) => ({ nodeId, version: f.version + 1 })); }}
          expanded={expanded} onExpand={setExpanded} />
      )}
    </section>
  );

  const splitPreview = view === "preview" && typeof window !== "undefined" && window.innerWidth >= 1600;

  return (
    <div className={`s3d-studio${expanded ? " is-expanded" : ""}${libraryOpen ? " is-library-open" : ""}`}>
      <header className="s3d-studio-top">
        <button type="button" className="s3d-button s3d-button--icon s3d-studio-top__library" aria-label="Library" aria-expanded={libraryOpen} onClick={() => setLibraryOpen((v) => !v)}><Icon name="menu" /></button>
        <div className="s3d-brand"><span className="s3d-mark"><Icon name="flask" size={18} /></span>Lab Studio</div>
        <span className="s3d-divider" />
        <span className="s3d-context">Studio 3D</span>
        <span className="s3d-grow" />
        <span className={`s3d-save${studio.saveStatus === "unavailable" ? " is-warn" : readOnly ? " is-off" : ""}`} role="status">{saveText}</span>
        <button type="button" className={`s3d-chip s3d-chip-button s3d-chip--${issues ? "err" : "ok"}`} onClick={() => setTab("checks")} title="Open Checks">
          <Icon name={issues ? "x" : "check"} size={12} />{issues ? `${issues} issue${issues === 1 ? "" : "s"}` : "Ready"}
        </button>
        <button type="button" className="s3d-button s3d-button--primary" onClick={() => setView("preview")}><Icon name="play" />Preview</button>
        <button type="button" className="s3d-button" onClick={exportDraft}>Export</button>
        <button type="button" className="s3d-button s3d-button--icon s3d-button--quiet" aria-label="Help" onClick={() => setDialog({ kind: "help" })}><Icon name="help" /></button>
        <span className="s3d-popover-anchor">
          <button type="button" className="s3d-button s3d-button--icon s3d-button--quiet" aria-label="More" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}><Icon name="dots" /></button>
          {moreOpen ? (
            <div className="s3d-popmenu s3d-popmenu--right" role="menu" onClick={() => setMoreOpen(false)}>
              <button type="button" role="menuitem" onClick={() => fileRef.current?.click()}><Icon name="upload" />Import…</button>
              <button type="button" role="menuitem" onClick={() => setDialog({ kind: "original" })}><Icon name="link" />Open in the original Studio…</button>
              <button type="button" role="menuitem" onClick={() => setDialog({ kind: "help" })}><Icon name="help" />Keyboard shortcuts</button>
            </div>
          ) : null}
        </span>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
      </header>
      <div className="s3d-studio-head">
        <div className="s3d-studio-head__text">
          <div className="s3d-eyebrow">{eyebrow}</div>
          <h1>
            <TitleField value={draft.title} disabled={Boolean(readOnly)} onCommit={(title) => commit(`Rename to ${title}`, [{ type: "updateLabSettings", patch: { title } }])} />
            <span className={`s3d-chip s3d-chip--${pill.tone} s3d-pill`}><Icon name={pill.icon} size={12} />{pill.label}</span>
          </h1>
          <p>{draft.techniques[0]?.learningGoal && artifactKind === "technique" ? draft.techniques[0].learningGoal : draft.learningGoals[0] ?? draft.description}</p>
        </div>
        <div className="s3d-row">
          <button type="button" className="s3d-button" onClick={() => setDialog({ kind: "open" })}>Open…</button>
          <span className="s3d-popover-anchor">
            <button type="button" className="s3d-button" aria-expanded={newOpen} onClick={() => setNewOpen((v) => !v)}>New<Icon name="chev" /></button>
            {newOpen ? (
              <div className="s3d-popmenu s3d-popmenu--right" role="menu" onClick={() => setNewOpen(false)}>
                <button type="button" role="menuitem" onClick={() => { studio.createNew("technique"); setView("flow"); }}><Icon name="cards" />Technique</button>
                <button type="button" role="menuitem" onClick={() => { studio.createNew("lab"); setView("flow"); }}><Icon name="flask" />Experiment</button>
              </div>
            ) : null}
          </span>
        </div>
      </div>
      <div className={`s3d-studio-work${splitPreview ? " is-split" : ""}`}>
        <LibraryPanel artifactKind={artifactKind} view={view} techniques={techniques} loading={loading} readOnly={Boolean(readOnly)} onAdd={(item) => { void addFromLibrary(item); setLibraryOpen(false); }} />
        {splitPreview ? (
          <div className="s3d-split">
            <section className="s3d-stage" aria-label="Flow"><FlowView studio={studio} onInspect={() => setTab("selected")} onAddFromLibrary={addFromLibrary} onToast={showToast} focusVersion={flowFocusVersion} /></section>
            {stage}
          </div>
        ) : stage}
        <Inspector studio={studio} tab={tab} onTab={setTab} onPreview={previewFrom} onImport={() => fileRef.current?.click()} onExport={exportDraft}
          onDeleteEdge={(index) => { if (removeConnection(studio, index)) showToast("Connection deleted.", { label: "Undo", run: studio.undo }); }}
          benchSelected={selectedEquipment ? (
            <EquipmentInspector studio={studio} instanceId={selectedEquipment}
              onNudge={(dx, dy) => nudgeStartingItem(studio, selectedEquipment, dx, dy)}
              onToShelf={() => returnStartingItemToShelf(studio, selectedEquipment)}
              onRemove={() => removeStartingItem(selectedEquipment)} />
          ) : undefined}
          benchNothing={view === "bench" ? <BenchInventory studio={studio} /> : undefined} />
      </div>
      <footer className="s3d-studio-foot">
        <span>Lab Studio 3D · Studio{publishedPack ? ` · Pack ${publishedPack}` : ""}</span>
        <span>{flattened ? "Techniques are copied with their own equipment. A vessel does not carry across techniques." : "Positions are stored in the 2D player's units."}</span>
      </footer>

      {toast ? (
        <div className={`s3d-toast s3d-toast--studio${toast.tone === "error" ? " is-error" : ""}`} role={toast.tone === "error" ? "alert" : "status"}>
          <Icon name={toast.tone === "error" ? "warn" : "check"} />{toast.text}
          {toast.action ? <button type="button" className="s3d-link" onClick={() => { toast.action!.run(); setToast(undefined); }}>{toast.action.label}</button> : null}
          <button type="button" className="s3d-button s3d-button--icon s3d-button--quiet" aria-label="Dismiss" onClick={() => { setToast(undefined); studio.clearMessage(); }}><Icon name="x" /></button>
        </div>
      ) : null}

      {dialog?.kind === "open" ? <OpenDialog techniques={techniques} loading={loading} onOpen={openPublished} onImport={() => fileRef.current?.click()} onClose={() => setDialog(undefined)} /> : null}
      {dialog?.kind === "help" ? <HelpDialog onClose={() => setDialog(undefined)} /> : null}
      {dialog?.kind === "original" ? <OriginalStudioDialog onExport={exportDraft} onClose={() => setDialog(undefined)} /> : null}
      {dialog?.kind === "import-errors" ? <ImportErrorsDialog errors={dialog.errors} onClose={() => setDialog(undefined)} /> : null}
      {dialog?.kind === "configure" ? (
        <ConfigureWorkflowDialog technique={dialog.technique} pack={dialog.pack} onClose={() => setDialog(undefined)}
          onAdd={(values, approved) => appendWorkflow(dialog.technique, values, approved)} />
      ) : null}
      {dialog?.kind === "inspect-equipment" ? <EquipmentDialog studio={studio} instanceId={dialog.instanceId} onClose={() => setDialog(undefined)} /> : null}
    </div>
  );
};

/** The heading title, edited inline (§4.2): one transaction when it is left. */
const TitleField = ({ value, disabled, onCommit }: { value: string; disabled: boolean; onCommit: (value: string) => void }) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input className="s3d-title-input" aria-label="Title" value={text} disabled={disabled} size={Math.max(8, text.length)}
      onChange={(e) => setText(e.target.value)} onBlur={() => { if (text.trim() && text !== value) onCommit(text.trim()); else setText(value); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setText(value); (e.target as HTMLInputElement).blur(); } }} />
  );
};

/** Equipment inspection (§4.8): the model turning, its zones and capacities, and its provenance. */
const EquipmentDialog = ({ studio, instanceId, onClose }: { studio: ReturnType<typeof useStudio3DDraft>; instanceId: string; onClose: () => void }) => {
  const instance = studio.draft.initialState?.equipment.find((i) => i.id === instanceId);
  return (
    <Dialog eyebrow="Equipment" title={instance?.label ?? instanceId} onClose={onClose} wide footer={<button type="button" className="s3d-button" onClick={onClose}>Close</button>}>
      <EquipmentTurntable studio={studio} instanceId={instanceId} />
    </Dialog>
  );
};

