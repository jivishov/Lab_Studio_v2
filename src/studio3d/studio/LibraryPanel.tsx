import { useMemo, useState, type KeyboardEvent } from "react";
import { v1EquipmentCatalog } from "../../equipment/catalog";
import type { StudioArtifactKind } from "../../studio/studioArtifact";
import { studioTemplates, type StudioTemplate } from "../../studio/studioState";
import { equipment3dAssetUrl, equipment3dEntry } from "../equipment3d/readiness";
import { catalogueSpecs } from "../player/panels";
import { Icon } from "../ui/Icon";
import { INTERACTION_ICON } from "./flowModel";
import { writeLibraryDrag, type LibraryDrag } from "./libraryDrag";
import type { StageView } from "./studioUi";
import { TECHNIQUE_STATUS, type CatalogueTechnique } from "./techniqueCatalog";

/**
 * The library (handoff §4.3): find on the left. Techniques are offered to experiment drafts
 * only; step templates are the generic single-step blueprints (plan §2.1), grouped by the
 * interaction their verb derives; equipment comes from the catalogue, with its 3D status. Every
 * card can be dragged onto the stage, or clicked (or Enter) to add it at the default place.
 */
export type LibraryTab = "techniques" | "steps" | "equipment";
export type { StageView };

const TIPS: Record<StageView, Record<LibraryTab, string>> = {
  flow: {
    techniques: "Click a technique to configure it, then add it after the last step.",
    steps: "Drag onto the flow, or onto a connection to insert it there. Click or Enter adds after the selected step.",
    equipment: "Equipment is arranged in the Starting bench view.",
  },
  bench: {
    techniques: "Techniques are added in the Flow view.",
    steps: "Steps are added in the Flow view.",
    equipment: "Drag onto the bench. Drag back to the shelf to return. Click or Enter adds at the next free spot.",
  },
  preview: {
    techniques: "Techniques are added in the Flow view.",
    steps: "Selecting a step starts the preview there.",
    equipment: "Equipment is arranged in the Starting bench view.",
  },
};

/** The generic templates, and the icon their verb's interaction carries (§3.6). */
export const genericTemplates = studioTemplates.filter((t) => !t.labId && !t.techniqueId);
export const techniqueTemplates = studioTemplates.filter((t) => t.techniqueId);

/**
 * The interaction a template's verb derives (plan §2.3, `defaultInteractionForAction`): weigh reads
 * an instrument; measuring, transferring, dissolving and diluting pour; record and observe write in
 * the notebook; calculate submits a calculation. Other verbs are placed or moved.
 */
const VERB_INTERACTION: Record<string, keyof typeof INTERACTION_ICON> = {
  weigh: "readInstrument",
  measureVolume: "pourInto", transfer: "pourInto", dissolve: "pourInto", dilute: "pourInto", filter: "pourInto",
  record: "recordNotebook", observe: "recordNotebook",
  calculate: "submitCalculation",
  developChromatogram: "snapIntoTarget",
};

const templateIcon = (template: StudioTemplate): string =>
  !template.verb ? "cards" : INTERACTION_ICON[VERB_INTERACTION[template.verb] ?? "dragToZone"] ?? "move";

const GROUPS: Array<{ id: string; label: string; icon: string; verbs: string[] }> = [
  { id: "measure", label: "Weigh and read", icon: "gauge", verbs: ["weigh"] },
  { id: "pour", label: "Pour and transfer", icon: "pour", verbs: ["measureVolume", "dissolve", "dilute", "filter", "transfer"] },
  { id: "heat", label: "Heat and dry", icon: "move", verbs: ["dry", "heat", "cool"] },
  { id: "place", label: "Place and seat", icon: "seat", verbs: ["developChromatogram", "place"] },
  { id: "record", label: "Record and calculate", icon: "pencil", verbs: ["observe", "record", "calculate"] },
];

const matches = (query: string, ...texts: Array<string | undefined>) =>
  !query || texts.some((text) => text?.toLowerCase().includes(query));

const activate = (event: KeyboardEvent, run: () => void) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); run(); }
};

export const Thumbnail = ({ definitionId, size = 60 }: { definitionId?: string; size?: number }) => {
  const entry = definitionId ? equipment3dEntry(definitionId) : undefined;
  return entry
    ? <img className="s3d-lib-thumb" src={equipment3dAssetUrl(entry.thumbnail)} alt="" width={size} height={size} draggable={false} />
    : <span className="s3d-lib-thumb s3d-lib-thumb--none" aria-hidden="true"><Icon name="cube" size={20} /></span>;
};

/**
 * A technique's card image (§4.3): its first three Blender thumbnails composed together. No
 * per-technique composite render exists yet (the M2 composites are review states), so the card is
 * composed from the published item thumbnails; nothing is drawn that the models do not show.
 */
export const CompositeThumbnail = ({ ids, size = 60 }: { ids: string[]; size?: number }) => {
  if (ids.length === 0) return <Thumbnail size={size} />;
  const small = Math.round(size * 0.62);
  return (
    <span className="s3d-composite" style={{ width: size, height: size }} aria-hidden="true">
      {ids.slice(0, 3).map((id, i) => {
        const entry = equipment3dEntry(id);
        return entry ? <img key={id} src={equipment3dAssetUrl(entry.thumbnail)} alt="" width={i === 0 ? size * 0.8 : small} height={i === 0 ? size * 0.8 : small}
          className={`s3d-composite__img s3d-composite__img--${i}`} draggable={false} /> : null;
      })}
    </span>
  );
};

export const StatusChip = ({ status }: { status: CatalogueTechnique["status"] }) => {
  if (!status) return null;
  const s = TECHNIQUE_STATUS[status];
  return <span className={`s3d-chip s3d-chip--${s.tone}`}><Icon name={s.icon} size={12} />{s.label}</span>;
};

export const LibraryPanel = ({ artifactKind, view, techniques, loading, readOnly, onAdd, onDragItem, onRailOpen }: {
  artifactKind: StudioArtifactKind;
  view: StageView;
  techniques: CatalogueTechnique[];
  loading: boolean;
  readOnly: boolean;
  onAdd: (item: LibraryDrag) => void;
  /** The card being dragged, so the inspector can name the operation that will run (frame S2). */
  onDragItem?: (item: LibraryDrag | undefined) => void;
  /** At 1024–1279 px the library is a 56 px rail; a rail button opens it as a flyout (§4.10). */
  onRailOpen?: () => void;
}) => {
  const experiment = artifactKind === "lab";
  const [tab, setTab] = useState<LibraryTab>(experiment ? "techniques" : "steps");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shownTab: LibraryTab = !experiment && tab === "techniques" ? "steps" : tab;

  const templates = useMemo(() => genericTemplates.filter((t) => matches(q, t.title, t.description, t.verb)), [q]);
  const techniqueList = useMemo(() => techniques.filter((t) => matches(q, t.title, t.id, t.description)), [q, techniques]);
  const equipment = useMemo(() => v1EquipmentCatalog.filter((e) => matches(q, e.label, e.id, e.category)), [q]);
  const publishedTemplates = useMemo(() => techniqueTemplates.filter((t) => matches(q, t.title, t.techniqueId)), [q]);
  const count = shownTab === "techniques" ? techniqueList.length : shownTab === "steps" ? templates.length + publishedTemplates.length : equipment.length;

  const card = (item: LibraryDrag, label: string, body: React.ReactNode, className = "") => (
    <div
      key={`${item.kind}:${item.id}`}
      className={`s3d-lib-card ${className}${readOnly ? " is-disabled" : ""}`}
      role="button"
      tabIndex={0}
      aria-disabled={readOnly}
      aria-label={`Add ${label}`}
      draggable={!readOnly}
      onDragStart={(event) => { writeLibraryDrag(event.dataTransfer, item); onDragItem?.(item); }}
      onDragEnd={() => onDragItem?.(undefined)}
      onClick={() => { if (!readOnly) onAdd(item); }}
      onKeyDown={(event) => activate(event, () => { if (!readOnly) onAdd(item); })}
    >
      {body}
      {readOnly ? null : <span className="s3d-lib-card__plus" aria-hidden="true"><Icon name="plus" size={13} /></span>}
    </div>
  );

  return (
    <aside className="s3d-panel s3d-library" aria-label="Library">
      <nav className="s3d-lib-rail" aria-label="Library sections">
        {(experiment ? ["techniques", "steps", "equipment"] as const : ["steps", "equipment"] as const).map((id) => (
          <button key={id} type="button" className="s3d-button s3d-button--icon s3d-button--quiet" title={id === "techniques" ? "Techniques" : id === "steps" ? "Steps" : "Equipment"}
            aria-label={`Open the library: ${id === "techniques" ? "Techniques" : id === "steps" ? "Steps" : "Equipment"}`}
            onClick={() => { setTab(id); onRailOpen?.(); }}><Icon name={id === "techniques" ? "cards" : id === "steps" ? "move" : "flask"} size={18} /></button>
        ))}
      </nav>
      <div className="s3d-lib-head">
        <div className="s3d-lib-title">Library <span className="s3d-count">{count}</span></div>
        <label className="s3d-search">
          <Icon name="search" />
          <input type="search" placeholder="Find a step or equipment…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find in the library" />
        </label>
        <div className="s3d-lib-chips" role="tablist" aria-label="Library sections">
          {(experiment ? ["techniques", "steps", "equipment"] as const : ["steps", "equipment"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={shownTab === id} className={`s3d-chip-button${shownTab === id ? " is-on" : ""}`} onClick={() => setTab(id)}>
              {id === "techniques" ? "Techniques" : id === "steps" ? "Steps" : "Equipment"}
            </button>
          ))}
        </div>
      </div>
      <div className="s3d-lib-body">
        {shownTab === "techniques" ? (
          loading ? <p className="s3d-small">Loading published techniques…</p> : techniqueList.map((t) => card({ kind: "technique", id: t.id }, t.title, (
            <>
              <CompositeThumbnail ids={t.compositeIds} size={56} />
              <div className="s3d-lib-card__text">
                <div className="s3d-lib-card__name">{t.title}</div>
                <div className="s3d-lib-card__detail">
                  {t.definition ? `${t.definition.process.nodes.length} steps` : t.error ?? ""}
                  {t.pack ? ` · Pack ${t.pack}` : ""}
                  {t.hosts.length ? ` · hosts: ${t.hosts.length} lab${t.hosts.length === 1 ? "" : "s"}` : ""}
                </div>
                <StatusChip status={t.status} />
                {t.status === "host" && t.hosts.length ? (
                  <div className="s3d-lib-card__hosts">{t.hosts.map((h) => <a key={h.id} href={h.href} onClick={(e) => e.stopPropagation()}>{h.id}</a>)}</div>
                ) : null}
              </div>
            </>
          ), "s3d-lib-card--tech"))
        ) : shownTab === "steps" ? (
          <>
            {GROUPS.map((group) => {
              const list = templates.filter((t) => t.verb && group.verbs.includes(t.verb));
              return list.length ? (
                <div key={group.id} className="s3d-lib-group">
                  <div className="s3d-lib-group__label"><Icon name={group.icon} size={12} />{group.label}</div>
                  {list.map((t) => card({ kind: "template", id: t.id }, t.title, (
                    <>
                      <span className="s3d-tpl__icon"><Icon name={templateIcon(t)} size={14} /></span>
                      <span className="s3d-tpl__name" title={`${t.description} (generic template, verb ${t.verb})`}>{t.title}</span>
                    </>
                  ), "s3d-tpl"))}
                </div>
              ) : null;
            })}
            {publishedTemplates.length ? (
              <div className="s3d-lib-group">
                <div className="s3d-lib-group__label"><Icon name="cards" size={12} />Published technique</div>
                {publishedTemplates.map((template) => {
                  const t = techniques.find((c) => c.id === template.techniqueId);
                  return card({ kind: "technique", id: template.techniqueId! }, template.title, (
                    <>
                      <CompositeThumbnail ids={t?.compositeIds ?? []} size={56} />
                      <div className="s3d-lib-card__text">
                        <div className="s3d-lib-card__name">{t?.title ?? template.title}</div>
                        <div className="s3d-lib-card__detail">{t?.definition ? `${t.definition.process.nodes.length} steps` : "Loading…"}</div>
                        <StatusChip status={t?.status} />
                      </div>
                    </>
                  ), "s3d-lib-card--tech");
                })}
              </div>
            ) : null}
          </>
        ) : (
          <div className="s3d-lib-cards2">
            {equipment.map((e) => {
              const specs = catalogueSpecs(e.id);
              const has3d = Boolean(equipment3dEntry(e.id));
              return card({ kind: "equipment", id: e.id }, e.label, (
                <>
                  <div className="s3d-lib-card__thumb"><Thumbnail definitionId={e.id} /></div>
                  <div className="s3d-lib-card__name">{e.label}</div>
                  <div className="s3d-lib-card__detail">{specs.length ? specs.map((s) => s.replace(/^(Capacity|Precision) /, "")).join(" · ") : e.category}</div>
                  <span className={`s3d-chip ${has3d ? "s3d-chip--neutral" : "s3d-chip--outline"}`}>{has3d ? "3D" : "2D only"}</span>
                </>
              ), "s3d-lib-card--eq");
            })}
          </div>
        )}
      </div>
      <div className="s3d-lib-foot"><Icon name="info" /><span>{readOnly ? "This published technique is read-only. Choose “Edit a copy” to add to it." : TIPS[view][shownTab]}</span></div>
    </aside>
  );
};
