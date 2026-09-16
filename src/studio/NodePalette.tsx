import { ArrowRight, Beaker, FileText, Search, Waypoints, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { studioTemplates, type StudioTemplate } from "./studioState";

interface NodePaletteProps {
  mode?: "all" | "steps";
  onAdd: (template: StudioTemplate) => void;
  onClose?: () => void;
  open?: boolean;
}

const searchableText = (template: StudioTemplate) =>
  [template.title, template.description, template.nodeType, template.verb, template.techniqueId, ...template.requiredEquipment]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const NodePalette = ({ mode = "all", onAdd, onClose, open = true }: NodePaletteProps) => {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLElement>(null);
  const isDrawer = typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 1100px) and (min-width: 721px)").matches
    : false;
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setShowAll(false);
    window.requestAnimationFrame(() => searchRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    const closeOnPointer = (event: PointerEvent) => {
      if (!paletteRef.current?.contains(event.target as Node)) onClose?.();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointer, true);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointer, true);
    };
  }, [open, onClose]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return studioTemplates.filter((template) => {
      if (mode === "steps" && (!template.nodeType || template.labId || template.techniqueId)) return false;
      return !normalized || searchableText(template).includes(normalized);
    });
  }, [mode, query]);

  const trapDrawerFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!isDrawer || event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])"));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (!open) return null;
  const steps = matches.filter((template) => template.nodeType);
  const workflows = matches.filter((template) => template.techniqueId);
  const labs = matches.filter((template) => template.labId);
  const revealAll = showAll || Boolean(query.trim());
  const visibleSteps = revealAll ? steps : steps.slice(0, 4);
  const visibleWorkflows = revealAll ? workflows : workflows.slice(0, 2);

  const group = (label: string, templates: StudioTemplate[], icon: "step" | "workflow" | "lab") =>
    templates.length ? (
      <section className="node-palette-group">
        <h3>{label}</h3>
        {templates.map((template) => (
          <button key={template.id} type="button" onClick={() => onAdd(template)}>
            {icon === "workflow" ? <Waypoints size={16} aria-hidden="true" /> : icon === "lab" ? <Beaker size={16} aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
            <span><strong>{template.title}</strong><small>{template.description}</small></span>
          </button>
        ))}
      </section>
    ) : null;

  return (
    <aside ref={paletteRef} className="node-palette" role="dialog" aria-modal={isDrawer || undefined} aria-label="Step and workflow library" onKeyDown={trapDrawerFocus}>
      <div className="node-palette-search">
        <Search size={16} aria-hidden="true" />
        <input ref={searchRef} type="search" placeholder="Search steps and workflows…" aria-label="Search steps and workflows" value={query} onChange={(event) => setQuery(event.target.value)} />
        {onClose ? <button type="button" aria-label="Close library" onClick={onClose}><X size={16} aria-hidden="true" /></button> : null}
      </div>
      <div className="node-palette-results">
        {group("Step types", visibleSteps, "step")}
        {mode === "all" ? group("Workflows", visibleWorkflows, "workflow") : null}
        {mode === "all" && revealAll ? group("Start from lab", labs, "lab") : null}
        {!matches.length ? <p className="empty-state">No steps or workflows match “{query}”.</p> : null}
      </div>
      {!revealAll ? (
        <button aria-label="Browse all steps and workflows" className="node-palette-footer" type="button" onClick={() => setShowAll(true)}>
          Browse all steps & workflows <ArrowRight size={16} aria-hidden="true" />
        </button>
      ) : null}
    </aside>
  );
};
