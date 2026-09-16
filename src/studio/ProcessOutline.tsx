import { Ellipsis, GitBranch, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LabDefinition } from "../domain/types";
import { NodePalette } from "./NodePalette";
import type { InsertTemplateStepOptions, StudioTemplate } from "./studioState";

interface ProcessOutlineProps {
  draft: LabDefinition;
  selectedNodeId?: string;
  onAddBranch: (nodeId: string, targetNodeId: string) => void;
  onAddRetry: (nodeId: string) => void;
  onAddTemplate: (template: StudioTemplate, options?: InsertTemplateStepOptions) => void;
  onDelete: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onSetStart: (nodeId: string) => void;
}

export const ProcessOutline = ({
  draft,
  selectedNodeId,
  onAddBranch,
  onAddRetry,
  onAddTemplate,
  onDelete,
  onSelect,
  onSetStart,
}: ProcessOutlineProps) => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryOptions, setLibraryOptions] = useState<InsertTemplateStepOptions | undefined>();
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const index = draft.process.nodes.findIndex((node) => node.id === selectedNodeId);
    if (index >= 0) rowRefs.current[index]?.scrollIntoView({ block: "nearest" });
  }, [draft.process.nodes, selectedNodeId]);

  useEffect(() => {
    if (!menuNodeId) return;
    const closeKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuNodeId(null);
    };
    const closePointer = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".process-row-menu, .process-row-menu-trigger")) setMenuNodeId(null);
    };
    document.addEventListener("keydown", closeKeyboard);
    document.addEventListener("mousedown", closePointer);
    return () => {
      document.removeEventListener("keydown", closeKeyboard);
      document.removeEventListener("mousedown", closePointer);
    };
  }, [menuNodeId]);

  const openLibrary = (options?: InsertTemplateStepOptions) => {
    setLibraryOptions(options);
    setLibraryOpen(true);
    setMenuNodeId(null);
  };

  const closeLibrary = () => {
    setLibraryOpen(false);
    window.requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(draft.process.nodes.length - 1, index + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = draft.process.nodes.length - 1;
    else return;
    event.preventDefault();
    const nextNode = draft.process.nodes[nextIndex];
    if (nextNode) {
      onSelect(nextNode.id);
      rowRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <aside className="process-outline" aria-label="Process outline">
      <div className="process-outline-heading">
        <h2>Process outline</h2>
        <button ref={addButtonRef} type="button" className="process-add-button" aria-expanded={libraryOpen} onClick={() => openLibrary()}>
          <Plus size={18} aria-hidden="true" /> Add step or workflow <span aria-hidden="true">⌄</span>
        </button>
      </div>
      <NodePalette
        open={libraryOpen}
        mode={libraryOptions?.placement ? "steps" : "all"}
        onAdd={(template) => {
          onAddTemplate(template, libraryOptions);
          setLibraryOpen(false);
        }}
        onClose={closeLibrary}
      />
      <ol className="process-outline-list">
        {draft.process.nodes.map((node, index) => {
          const selected = node.id === selectedNodeId;
          const menuOpen = menuNodeId === node.id;
          return (
            <li key={node.id} className={selected ? "is-selected" : ""}>
              <span className="process-outline-rail" aria-hidden="true" />
              <span className="process-step-number">{index + 1}</span>
              <button
                ref={(element) => { rowRefs.current[index] = element; }}
                className="process-outline-row"
                type="button"
                aria-current={selected ? "step" : undefined}
                onClick={() => onSelect(node.id)}
                onKeyDown={(event) => handleRowKeyDown(event, index)}
              >
                <strong>{node.title}</strong>
                <span>{node.id === draft.process.startNodeId ? "Start step" : node.type === "action" ? "Step" : node.type}</span>
              </button>
              <button
                type="button"
                className="process-row-menu-trigger"
                aria-label={`Actions for ${node.title}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => {
                  onSelect(node.id);
                  setMenuNodeId(menuOpen ? null : node.id);
                }}
              >
                <Ellipsis size={18} aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="process-row-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => openLibrary({ anchorNodeId: node.id, placement: "after" })}><Plus size={15} aria-hidden="true" /> Add after</button>
                  <button type="button" role="menuitem" onClick={() => openLibrary({ anchorNodeId: node.id, placement: "before" })}><Plus size={15} aria-hidden="true" /> Insert before</button>
                  <button type="button" role="menuitem" onClick={() => { onAddRetry(node.id); setMenuNodeId(null); }}><RotateCcw size={15} aria-hidden="true" /> Add retry path</button>
                  {draft.process.nodes.filter((candidate) => candidate.id !== node.id).map((target) => (
                    <button key={target.id} type="button" role="menuitem" onClick={() => { onAddBranch(node.id, target.id); setMenuNodeId(null); }}><GitBranch size={15} aria-hidden="true" /> Branch to {target.title}</button>
                  ))}
                  <button type="button" role="menuitem" onClick={() => { onSetStart(node.id); setMenuNodeId(null); }}>Set as start step</button>
                  <button type="button" role="menuitem" className="is-danger" onClick={() => { onDelete(node.id); setMenuNodeId(null); }}><Trash2 size={15} aria-hidden="true" /> Delete step</button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
};
