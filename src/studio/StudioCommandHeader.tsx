import {
  Bot,
  Check,
  Download,
  EllipsisVertical,
  FilePlus2,
  FlaskConical,
  Pencil,
  Redo2,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { StudioArtifactKind } from "./studioArtifact";

export type StudioStage = "setup" | "process" | "preview";

interface StudioCommandHeaderProps {
  activeStage: StudioStage;
  artifactKind: StudioArtifactKind;
  assistantOpen: boolean;
  canExport: boolean;
  canRedo: boolean;
  canUndo: boolean;
  hasUnsavedChanges: boolean;
  title: string;
  composerOpen?: boolean;
  composerRevision?: number;
  onAssistantToggle: () => void;
  onComposerToggle?: () => void;
  onExport: () => void;
  onImport: (file: File | undefined) => void;
  onNewLab: () => void;
  onNewTechnique: () => void;
  onOpenAbout: () => void;
  onRedo: () => void;
  onSave: () => void;
  onStageChange: (stage: StudioStage) => void;
  onTitleCommit: (title: string) => void;
  onUndo: () => void;
}

const stages: Array<{ id: StudioStage; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "process", label: "Process" },
  { id: "preview", label: "Preview & validate" },
];

export const StudioCommandHeader = ({
  activeStage,
  artifactKind,
  assistantOpen,
  canExport,
  canRedo,
  canUndo,
  hasUnsavedChanges,
  title,
  composerOpen = false,
  composerRevision = 0,
  onAssistantToggle,
  onComposerToggle,
  onExport,
  onImport,
  onNewLab,
  onNewTechnique,
  onOpenAbout,
  onRedo,
  onSave,
  onStageChange,
  onTitleCommit,
  onUndo,
}: StudioCommandHeaderProps) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();
  const moreRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const stageRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => setTitleDraft(title), [title]);
  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);
  useEffect(() => {
    if (!moreOpen) return;
    const dismissPointer = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const dismissKeyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        moreRef.current?.querySelector<HTMLButtonElement>(".studio-more-trigger")?.focus();
      }
    };
    document.addEventListener("mousedown", dismissPointer);
    document.addEventListener("keydown", dismissKeyboard);
    return () => {
      document.removeEventListener("mousedown", dismissPointer);
      document.removeEventListener("keydown", dismissKeyboard);
    };
  }, [moreOpen]);

  const commitTitle = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(title);
      setEditingTitle(false);
      return;
    }
    if (nextTitle !== title) onTitleCommit(nextTitle);
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commitTitle();
    if (event.key === "Escape") {
      setTitleDraft(title);
      setEditingTitle(false);
    }
  };

  const handleStageKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % stages.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + stages.length) % stages.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = stages.length - 1;
    else return;
    event.preventDefault();
    onStageChange(stages[nextIndex].id);
    stageRefs.current[nextIndex]?.focus();
  };

  const runMoreAction = (action: () => void) => {
    setMoreOpen(false);
    action();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role='menuitem']"));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
          : currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <header className="studio-command-header">
      <div className="studio-draft-identity">
        <span className="studio-artifact-chip">{artifactKind === "lab" ? "LAB" : "TECH"}</span>
        <div className="studio-draft-title">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              aria-label="Draft title"
              value={titleDraft}
              onBlur={commitTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <strong title={title}>{title || "Untitled draft"}</strong>
          )}
          {!editingTitle ? (
            <button type="button" aria-label="Edit draft title" onClick={() => setEditingTitle(true)}>
              <Pencil size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="studio-stage-tabs" role="tablist" aria-label="Studio stages">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            ref={(element) => { stageRefs.current[index] = element; }}
            type="button"
            role="tab"
            aria-selected={activeStage === stage.id}
            className={activeStage === stage.id ? "is-active" : ""}
            tabIndex={activeStage === stage.id ? 0 : -1}
            onClick={() => onStageChange(stage.id)}
            onKeyDown={(event) => handleStageKeyDown(event, index)}
          >
            <span className="studio-stage-dot" aria-hidden="true" />
            {stage.label}
          </button>
        ))}
      </div>

      <span className={`studio-save-status ${hasUnsavedChanges ? "is-unsaved" : "is-saved"}`} aria-live="polite">
        {hasUnsavedChanges ? <span aria-hidden="true">•</span> : <Check size={18} aria-hidden="true" />}
        {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
      </span>

      <div className="studio-command-actions">
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={17} aria-hidden="true" /> Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          <Redo2 size={17} aria-hidden="true" /> Redo
        </button>
        <button className="studio-primary-save" type="button" onClick={onSave}>
          <Save size={17} aria-hidden="true" /> Save
        </button>
        {onComposerToggle ? (
          <button
            className="composer-command-button"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={composerOpen}
            aria-controls="experiment-composer-drawer"
            onClick={onComposerToggle}
          >
            <FlaskConical size={17} aria-hidden="true" /> Composer <span aria-hidden="true">r{composerRevision}</span>
          </button>
        ) : null}
        <button type="button" aria-expanded={assistantOpen} aria-controls="studio-assistant-panel" onClick={onAssistantToggle}>
          <Bot size={17} aria-hidden="true" /> Assistant
        </button>
        <div className="studio-more" ref={moreRef}>
          <button
            className="studio-more-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((current) => !current)}
          >
            <EllipsisVertical size={17} aria-hidden="true" /> More
          </button>
          {moreOpen ? (
            <div className="studio-more-menu" id={moreId} role="menu" onKeyDown={handleMenuKeyDown}>
              <button role="menuitem" type="button" onClick={() => runMoreAction(onNewLab)}><FilePlus2 size={16} aria-hidden="true" /> New lab</button>
              <button role="menuitem" type="button" onClick={() => runMoreAction(onNewTechnique)}><FilePlus2 size={16} aria-hidden="true" /> New technique</button>
              <label role="menuitem" tabIndex={0} className="studio-menu-file">
                <Upload size={16} aria-hidden="true" /> Import JSON…
                <input
                  accept=".json,.lab.json,.technique.json"
                  type="file"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setMoreOpen(false);
                    onImport(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button role="menuitem" type="button" aria-disabled={!canExport} onClick={() => runMoreAction(onExport)}>
                <Download size={16} aria-hidden="true" /> Export JSON…
              </button>
              <span className="studio-menu-separator" role="separator" />
              <button role="menuitem" type="button" onClick={() => runMoreAction(onOpenAbout)}>About Lab Design Studio</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
