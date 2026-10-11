import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { equipmentById } from "../../equipment/catalog";
import { formatEvidenceValue } from "../../player/evidenceFormatting";
import { benchPositionWords } from "../adapters/benchCoordinates";
import { displaySourceLabel } from "../adapters/instrumentDisplay";
import type { SceneItem, SceneTrayItem } from "../adapters/runtimeToScene";
import { equipment3dAssetUrl, equipment3dEntry } from "../equipment3d/readiness";
import { Icon } from "../ui/Icon";
import { ProvenanceChip } from "../ui/ProvenanceChip";
import { CORNERS, clampBox, resizeBox, type Corner, type PanelBox, type PanelId, type PanelLayout, type Viewport } from "./panelLayout";
import { measurementProvenance, notebookProvenance } from "./provenance";
import { currentStepEquipmentIds, currentStepInstanceIds } from "./stepRules";
import type { Player3DController } from "./usePlayer3D";

/** Values read the same as in the 2D player's evidence and results (evidenceFormatting). */
const evidenceValue = (value: number, unit?: string): string => {
  const text = formatEvidenceValue(value, unit ?? "");
  // The 2D decimals, with the handoff's thin space before the unit (§3.2).
  return unit && text.endsWith(` ${unit}`) ? `${text.slice(0, -unit.length - 1)} ${unit}` : text;
};

/** The Blender thumbnail of a definition's 3D model, if it has one. */
export const thumbnailUrl = (definitionId: string): string | undefined => {
  const entry = equipment3dEntry(definitionId);
  return entry ? `${equipment3dAssetUrl(entry.thumbnail)}?v=${entry.provenance.sourceHash.slice(0, 12)}` : undefined;
};

const Thumb = ({ definitionId, size = 44 }: { definitionId: string; size?: number }) => {
  const src = thumbnailUrl(definitionId);
  return src ? <img className="s3d-thumb" src={src} width={size} height={size} alt="" draggable={false} /> : <span className="s3d-thumb s3d-thumb--missing" style={{ width: size, height: size }} />;
};

/** What a floating panel needs from Player3D's remembered layout (handoff §5.1, §3.8). */
export interface PanelControls {
  /** Panels float from the laptop layout up; below it CSS turns them into sheets. */
  movable: boolean;
  layout: PanelLayout;
  viewport: Viewport;
  setBox: (id: PanelId, box: PanelBox) => void;
  setCollapsed: (id: PanelId, collapsed: boolean) => void;
}

const KEY_MOVE_PX = 10;
const KEY_MOVE_LARGE_PX = 50;

/**
 * A floating panel (§5.1): drag it by the header, resize it from any corner, collapse it; the
 * layout is kept through `controls` and applied only where panels float. The grip is a button, so
 * a panel can also be moved with the arrow keys. Nothing here touches runtime state.
 */
export const FloatPanel = ({ id, label, className, controls, head, collapsedHead, onClose, closeLabel, keepMounted = false, children }: {
  id: PanelId;
  label: string;
  className: string;
  controls: PanelControls;
  /** Header content between the grip and the collapse button. */
  head: ReactNode;
  /** The one-line header shown while collapsed; defaults to `head`. */
  collapsedHead?: ReactNode;
  onClose?: () => void;
  /** The close button's name, when closing does more than hide the panel. */
  closeLabel?: string;
  /** Keep the children mounted while collapsed (they hide themselves), as a live camera video needs. */
  keepMounted?: boolean;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLElement>(null);
  const [live, setLive] = useState<PanelBox>();
  const state = controls.layout[id];
  const collapsed = Boolean(state?.collapsed);
  const stored = controls.movable ? state?.box : undefined;
  const natural = { w: ref.current?.offsetWidth ?? 320, h: ref.current?.offsetHeight ?? 200 };
  const box = live ?? (stored ? clampBox(stored, natural, controls.viewport) : undefined);
  const style = box ? {
    left: box.x, top: box.y, right: "auto", bottom: "auto",
    ...(box.w !== undefined && !collapsed ? { width: box.w } : {}),
    ...(box.h !== undefined && !collapsed ? { height: box.h, maxHeight: "none" } : {}),
  } : undefined;

  const startGesture = (event: ReactPointerEvent<HTMLElement>, mode: "move" | Corner) => {
    const element = ref.current;
    if (!controls.movable || event.button !== 0 || !element) return;
    if (mode === "move" && (event.target as HTMLElement).closest("button:not(.s3d-float__grip), a, input, select, textarea, summary")) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const start = { x: element.offsetLeft, y: element.offsetTop, w: element.offsetWidth, h: element.offsetHeight };
    const from = { x: event.clientX, y: event.clientY };
    let latest: PanelBox | undefined;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (!latest && Math.hypot(dx, dy) < 3) return;
      const next = mode === "move"
        ? { x: start.x + dx, y: start.y + dy, ...(stored?.w !== undefined ? { w: stored.w } : {}), ...(stored?.h !== undefined ? { h: stored.h } : {}) }
        : resizeBox(start, mode, dx, dy);
      latest = clampBox(next, start, controls.viewport);
      setLive(latest);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setLive(undefined);
      if (latest) controls.setBox(id, latest);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const nudge = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const element = ref.current;
    const step = event.shiftKey ? KEY_MOVE_LARGE_PX : KEY_MOVE_PX;
    const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[event.key];
    if (!delta || !element) return;
    event.preventDefault();
    const size = { w: element.offsetWidth, h: element.offsetHeight };
    controls.setBox(id, clampBox({ ...(stored ?? {}), x: element.offsetLeft + delta[0], y: element.offsetTop + delta[1] }, size, controls.viewport));
  };

  return (
    <section ref={ref} data-panel={id} className={`s3d-float ${className}${collapsed ? " is-collapsed" : ""}${live ? " is-moving" : ""}`} aria-label={label} style={style}>
      <header className="s3d-float__head" onPointerDown={(e) => startGesture(e, "move")}>
        {controls.movable ? (
          <button type="button" className="s3d-float__grip" aria-label={`Move ${label}: drag, or use the arrow keys`} onKeyDown={nudge}>
            <Icon name="grip" />
          </button>
        ) : null}
        {collapsed ? collapsedHead ?? head : head}
        <button type="button" className="s3d-icon-button" aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
          onClick={() => controls.setCollapsed(id, !collapsed)}>
          <Icon name={collapsed ? "chevron-down" : "chevron-up"} />
        </button>
        {onClose ? <button type="button" className="s3d-icon-button" aria-label={closeLabel ?? `Close ${label}`} onClick={onClose}><Icon name="x" /></button> : null}
      </header>
      {collapsed && !keepMounted ? null : children}
      {controls.movable && !collapsed
        ? CORNERS.map((corner) => (
          <span key={corner} className={`s3d-float__corner s3d-float__corner--${corner}`} aria-hidden="true" onPointerDown={(e) => startGesture(e, corner)} />
        ))
        : null}
    </section>
  );
};

/**
 * What the current step needs from the shelf, guided mode only, as the 2D shelf marks it (§5.10). Where the step
 * names one item of a kind, only that one is needed now (decided 2026-10-05).
 */
const neededOnShelf = (player: Player3DController): ((item: { instanceId: string; definitionId: string }) => boolean) => {
  if (!player.showGuidance) return () => false;
  const needed = new Set(currentStepEquipmentIds(player.interaction, player.toolTransfer?.toolDefinitionId));
  const named = new Set(currentStepInstanceIds(player.runtime.expectedAction?.parameters));
  const namedKinds = new Set(player.runtime.state.equipmentInstances.filter((i) => named.has(i.id)).map((i) => i.definitionId));
  return (item) => needed.has(item.definitionId) && (!namedKinds.has(item.definitionId) || named.has(item.instanceId));
};

/** Where a shelf item stands, in words: its tier, or the side station. */
export const shelfPlaceWords = (item: SceneTrayItem): string =>
  item.spot.place === "station" ? "side station" : item.spot.tier === 1 ? "upper shelf" : "lower shelf";

const positionWords = (item: SceneItem): string =>
  item.placement.kind === "bench" ? benchPositionWords(item.placement.point.xMm, item.placement.point.yMm) : "seated";

/** Bench list (§5.11): the accessible twin of the canvas. */
export const BenchList = ({ player, controls, selected, onSelect, onExamine, onMove, onClose }: {
  player: Player3DController;
  controls: PanelControls;
  selected?: string;
  onSelect: (id: string) => void;
  onExamine: (id: string) => void;
  onMove: (id: string) => void;
  onClose: () => void;
}) => {
  const onBench = player.scene.bench.filter((i) => i.placement.kind === "bench");
  const seated = player.scene.bench.filter((i) => i.placement.kind === "seated");
  const isNeeded = neededOnShelf(player);
  const row = (item: SceneItem) => (
    <li key={item.instanceId} className={`s3d-bl-row${selected === item.instanceId ? " is-selected" : ""}`}>
      <button type="button" className="s3d-bl-row__main" onClick={() => onSelect(item.instanceId)}>
        <Thumb definitionId={item.definitionId} size={32} />
        <span>
          <span className="s3d-bl-row__name">{item.label}</span>
          <span className="s3d-bl-row__meta">{item.contentsText} · {positionWords(item)}</span>
        </span>
      </button>
      <div className="s3d-bl-row__actions">
        <button type="button" onClick={() => onExamine(item.instanceId)}>Examine</button>
        <button type="button" onClick={() => player.setSelectedSource(item.instanceId)}>Use as source</button>
        <button type="button" onClick={() => player.setSelectedTarget(item.instanceId)}>Use as target</button>
        <button type="button" onClick={() => onMove(item.instanceId)}>Move…</button>
      </div>
    </li>
  );
  return (
    <FloatPanel id="list" label="Bench list" className="s3d-benchlist" controls={controls} onClose={onClose}
      head={<h2 className="s3d-float__title">Bench list</h2>}>
      <div className="s3d-bl-scroll" data-gesture-scroll-region="vertical">
        <h3 className="s3d-bl-group">On the bench</h3>
        <ul>{onBench.map(row)}</ul>
        {seated.length ? <><h3 className="s3d-bl-group">Seated</h3><ul>{seated.map(row)}</ul></> : null}
        {/* The Shelf list (the shelf in place of the tray, decided 2026-10-11): the keyboard and screen-reader way to
            take an item off the shelf; Enter places it as a click on the shelf does (G-6). */}
        <h3 className="s3d-bl-group" id="s3d-bl-shelf-head">On the shelf · {player.scene.tray.length}</h3>
        <ul className="s3d-bl-shelf" aria-labelledby="s3d-bl-shelf-head">
          {player.scene.tray.map((item) => {
            const needed = isNeeded(item);
            return (
              <li key={item.instanceId}>
                <button type="button" className="s3d-bl-shelf__item" data-instance-id={item.instanceId}
                  onClick={() => player.dropFromTray(item.definitionId, undefined, undefined, item.instanceId)}
                  aria-label={`${item.label}, on the ${shelfPlaceWords(item)}${needed ? ", needed now" : ""}. Press Enter to place it on the bench.`}>
                  <Thumb definitionId={item.definitionId} size={28} />
                  <span>
                    <span className="s3d-bl-row__name">{item.label}</span>
                    <span className="s3d-bl-row__meta">{shelfPlaceWords(item)}{needed ? " · needed now" : ""}</span>
                  </span>
                  {needed ? <span className="s3d-bl-shelf__need" aria-hidden="true" /> : null}
                  <span className="s3d-bl-shelf__place" aria-hidden="true">Place</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="s3d-bl-foot">The same checks apply here as on the bench.</p>
    </FloatPanel>
  );
};

/** Catalogue capacity and precision, shown only when the unit fits the item (decision U9). */
export const catalogueSpecs = (definitionId: string): string[] => {
  const def = equipmentById.get(definitionId);
  if (!def) return [];
  const specs: string[] = [];
  const cap = def.capacity;
  const prec = def.precision;
  if (cap.unit !== "none" && cap.amount > 0) specs.push(`Capacity ${cap.amount} ${cap.unit}`);
  if (prec.unit !== "none" && prec.amount > 0 && prec.unit === cap.unit) specs.push(`Precision ${prec.amount} ${prec.unit}`);
  return specs;
};

/** Examine (§5.8): the camera moves, the item does not. */
export const ExamineCard = ({ item, holderLabel, onClose, onEyeLevel }: {
  item: SceneItem;
  /** The label of the item this one is seated on, for "Seated on <holder>". */
  holderLabel?: string;
  onClose: () => void;
  onEyeLevel?: () => void;
}) => {
  const entry = item.model;
  const hasDisplay = Boolean(entry?.displays.length);
  return (
    <section className="s3d-float s3d-examine" aria-label={`Examine ${item.label}`}>
      <header className="s3d-float__head">
        <span className="s3d-eyebrow s3d-grow">Examine</span>
        <button type="button" className="s3d-icon-button" aria-label="Close Examine" onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="s3d-examine__body">
        <h2>{item.label}</h2>
        <dl className="s3d-kv">
          {catalogueSpecs(item.definitionId).map((s) => <div key={s}><dt>{s.split(" ")[0]}</dt><dd className="s3d-mono">{s.split(" ").slice(1).join(" ")}</dd></div>)}
          <div><dt>Contents</dt><dd>{item.contentsText}</dd></div>
          {item.placement.kind === "seated" ? <div><dt>Seated</dt><dd>on {holderLabel ?? "its holder"}</dd></div> : null}
        </dl>
        {hasDisplay ? <p className="s3d-note"><strong>Display policy.</strong> This display shows its settings and status, and the readings your teacher prepared. Readings you record are your own entries.</p> : null}
        {item.display?.lines.length ? (
          <ul className="s3d-display-lines">
            {item.display.lines.map((line) => <li key={line.key}><span className="s3d-mono">{line.text}</span> <span className="s3d-small">{displaySourceLabel[line.source]}</span></li>)}
          </ul>
        ) : null}
        {item.scenery ? <p className="s3d-small">Stands in a rack <span className="s3d-chip s3d-chip--neutral">Scenery</span></p> : null}
        {item.benchScenery && item.placement.kind === "bench" ? <p className="s3d-small">Lies on a white tile <span className="s3d-chip s3d-chip--neutral">Scenery</span></p> : null}
        {onEyeLevel && item.contents.kind === "liquid" ? <button type="button" className="s3d-button" onClick={onEyeLevel}><Icon name="eye" />Eye level</button> : null}
        <p className="s3d-small s3d-examine__prov">3D model built in Blender · <span className="s3d-mono">{entry?.provenance.generator ?? "no model yet"}</span></p>
      </div>
    </section>
  );
};

const CONTROLS: Record<string, Array<[string, string]>> = {
  Mouse: [
    ["Click an item", "Pick it up; it follows the pointer"],
    ["Click a spot or a target while holding it", "Set it down there, or act on the target"],
    ["Press on a seat, a vessel or a liquid, drag down and let go", "Seat it, pour, deliver or draw up; drag back up to stop"],
    ["Click the flask at a swirl or invert step", "Swirl it, or turn it over and back once"],
    ["Esc or right-click while holding it", "Put it back"],
    ["Double-click an item", "Examine it"],
    ["Drag on empty bench", "Slide the bench up, down or sideways"],
    ["Right-drag", "Pan sideways; drag up or down to tilt"],
    ["Shift or Alt + right-drag, or middle-drag", "Orbit"],
    ["Wheel", "Zoom toward the pointer"],
  ],
  "Keyboard, while the bench has focus": [
    ["Arrows", "Select the next item in that direction"],
    ["Enter", "Pick up the selected item; Enter again sets it down"],
    ["Arrows while carrying", "Move it 10 mm, or 50 mm with Shift"],
    ["[ and ] while carrying", "Step through the items it could go onto"],
    ["E", "Examine"],
    ["S / T", "Use the selection as Source / Target"],
    ["N", "Notebook"],
    ["A / Home", "Auto view / Reset view"],
    ["Esc", "Cancel a carry, or close Examine or a dialog"],
  ],
  Touch: [
    ["Hold for 300 ms, then drag", "Carry"],
    ["Drag on the empty bench", "Pan sideways; drag up or down to tilt"],
    ["Two-finger drag / pinch", "Orbit / zoom"],
  ],
};

/**
 * Help, "Controls & model" (§5.16): the control tables, what the simulation shows and does not
 * show (G-1, G-2), and where the 3D models come from. It adds nothing about the chemistry.
 */
export const HelpDialog = ({ onClose }: { onClose: () => void }) => (
  <div className="s3d-dialog-back" role="dialog" aria-modal="true" aria-labelledby="s3d-help-title">
    <div className="s3d-dialog s3d-help">
      <header className="s3d-help__head">
        <h2 id="s3d-help-title">Controls &amp; model</h2>
        <button type="button" className="s3d-icon-button" aria-label="Close help" onClick={onClose} autoFocus><Icon name="x" /></button>
      </header>
      <div className="s3d-help__body">
        {Object.entries(CONTROLS).map(([title, rows]) => (
          <section key={title}>
            <h3 className="s3d-eyebrow">{title}</h3>
            <table className="s3d-table">
              <tbody>{rows.map(([input, effect]) => <tr key={input}><th scope="row">{input}</th><td>{effect}</td></tr>)}</tbody>
            </table>
          </section>
        ))}
        <section>
          <h3 className="s3d-eyebrow">What the bench shows</h3>
          <p>The same runtime as the 2D version checks every step. Things change only when it accepts an action; when it refuses one, nothing moves and it says why.</p>
          <p>Instrument displays show their settings and status, and the readings your teacher prepared for this lab: the balance shows the mass on its pan, and the photometer shows a sample’s transmittance once it is zeroed on the blank. Nothing is simulated. The values you record are your own entries, labelled “Your entry”.</p>
          <p>Volumes come from the step’s input field or the teacher’s setting, never from how far you tilt something.</p>
        </section>
        <section>
          <h3 className="s3d-eyebrow">The 3D models</h3>
          <p>Each piece of equipment is built in Blender by a generator script, at real size; Examine names the script. Liquids and powders are drawn from the run, not built into the models.</p>
        </section>
      </div>
    </div>
  </div>
);

const provenanceForMeasurement = (player: Player3DController, m: { id: string; nodeId: string }) =>
  measurementProvenance(player.definition, player.authoredDefinition, m.id, m.nodeId);
type Entry = Parameters<typeof notebookProvenance>[2];
/**
 * A notebook row that records a measurement reads as that measurement does ("20.0 mL", not the raw
 * "20 mL" the runtime writes); any other row, or one the measurement has since moved on from, as written.
 */
const entryValue = (player: Player3DController, e: Entry): string => {
  if (e.type !== "measurement") return e.value;
  const m = player.runtime.state.measurements.find((candidate) => e.tags.includes(candidate.id));
  return m && `${m.value} ${m.unit}`.trim() === e.value ? evidenceValue(m.value, m.unit) : e.value;
};
const provenanceForEntry = (player: Player3DController, entry: Entry) =>
  notebookProvenance(player.definition, player.authoredDefinition, entry);

export const NOTEBOOK_WIDTH = Object.freeze({ min: 320, initial: 420 });

/**
 * Notebook (§5.12): every value in mono with its provenance chip. The sheet is resizable from its
 * left edge, from 320 px to half the window, by pointer or by the arrow keys on the edge.
 */
export const NotebookSheet = ({ player, width, onResize, onClose }: {
  player: Player3DController;
  width: number;
  onResize: (width: number) => void;
  onClose: () => void;
}) => {
  const { state } = player.runtime;
  const clampWidth = (w: number) => Math.round(Math.min(Math.max(NOTEBOOK_WIDTH.min, w), Math.max(NOTEBOOK_WIDTH.min, window.innerWidth / 2)));
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const from = event.clientX;
    const move = (e: PointerEvent) => onResize(clampWidth(width + from - e.clientX));
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };
  const keyResize = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 80 : 20;
    const delta = event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0;
    if (!delta) return;
    event.preventDefault();
    onResize(clampWidth(width + delta));
  };
  return (
    <aside className="s3d-sheet" aria-label="Notebook" style={{ width }}>
      <div className="s3d-sheet__edge" role="separator" aria-orientation="vertical" aria-label="Resize the notebook" tabIndex={0}
        aria-valuemin={NOTEBOOK_WIDTH.min} aria-valuenow={width} onPointerDown={startResize} onKeyDown={keyResize} />
      <header className="s3d-sheet__head">
        <Icon name="book" />
        <h2>Notebook</h2>
        <button type="button" className="s3d-icon-button" aria-label="Close the notebook" onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="s3d-sheet__body" data-gesture-scroll-region="vertical">
        <h3 className="s3d-eyebrow">Measurements</h3>
        {state.measurements.length === 0 ? <p className="s3d-small">No measurements yet.</p> : null}
        {state.measurements.map((m) => (
          <div key={m.id} className="s3d-nb-row">
            <span className="s3d-nb-row__label">{m.label}</span>
            <span className="s3d-nb-row__value s3d-mono">{evidenceValue(m.value, m.unit)}</span>
            <span className="s3d-nb-row__meta"><ProvenanceChip kind={provenanceForMeasurement(player, m)} /></span>
          </div>
        ))}
        <h3 className="s3d-eyebrow">Calculations</h3>
        {state.calculations.length === 0 ? <p className="s3d-small">No calculations yet.</p> : null}
        {state.calculations.map((c) => (
          <div key={c.id} className="s3d-nb-row">
            <span className="s3d-nb-row__label">{c.label}</span>
            <span className="s3d-nb-row__value s3d-mono">{evidenceValue(c.value, c.unit)}</span>
            <span className="s3d-nb-row__meta"><ProvenanceChip kind="calculated" /></span>
          </div>
        ))}
        <h3 className="s3d-eyebrow">Notebook entries</h3>
        {state.notebook.length === 0 ? <p className="s3d-small">No entries yet.</p> : null}
        {state.notebook.map((e) => (
          <div key={e.id} className="s3d-nb-row">
            <span className="s3d-nb-row__label">{e.label}</span>
            <span className="s3d-nb-row__value">{entryValue(player, e)}</span>
            <span className="s3d-nb-row__meta"><ProvenanceChip kind={provenanceForEntry(player, e)} /></span>
          </div>
        ))}
      </div>
    </aside>
  );
};

/**
 * Results (§5.14): steps, evidence (measurements, calculations, data series and notebook entries,
 * as the 2D results and notebook hold them) and, in assessment mode, attempts per step from
 * attemptHistory. "Play again" asks first (the caller confirms before `reset`).
 */
export const ResultsSheet = ({ player, onPlayAgain, backHref }: { player: Player3DController; onPlayAgain: () => void; backHref: string }) => {
  const { state, process } = player.runtime;
  const failures = new Map<string, string[]>();
  for (const attempt of state.attemptHistory) {
    // As the 2D feedback panel counts them: failed attempts made in assessment mode.
    if (!attempt.success && attempt.mode === "assessment") failures.set(attempt.nodeId, [...(failures.get(attempt.nodeId) ?? []), attempt.message ?? ""]);
  }
  // Teacher notes are not learner steps; completed and first-try counts use the same list.
  const steps = process.nodes.filter((n) => n.type !== "teacherNote");
  const completed = steps.filter((n) => state.completedNodes.includes(n.id)).length;
  const firstTry = steps.filter((n) => state.completedNodes.includes(n.id) && !failures.has(n.id)).length;
  return (
    <div className="s3d-results" role="dialog" aria-modal="true" aria-label="Results">
      <div className="s3d-results__card">
        <p className="s3d-eyebrow">Results · {player.runtime.mode === "assessment" ? "Assessment" : "Guided"}</p>
        <h2>{player.definition.title} · complete</h2>
        <p>
          <span className="s3d-chip s3d-chip--ok"><Icon name="check" size={12} />{completed} of {steps.length} steps</span>
          {player.runtime.mode === "assessment" ? <span className="s3d-chip s3d-chip--neutral">{firstTry} of {steps.length} at the first try</span> : null}
        </p>
        {player.runtime.mode === "assessment" ? (
          <table className="s3d-table">
            <thead><tr><th>Step</th><th>Refused attempts (runtime messages)</th></tr></thead>
            <tbody>{steps.map((n, i) => (
              <tr key={n.id}><td>{i + 1} · {n.title}</td><td className="s3d-small">{failures.get(n.id)?.join(" · ") || "—"}</td></tr>
            ))}</tbody>
          </table>
        ) : null}
        <h3 className="s3d-eyebrow">Evidence</h3>
        {state.measurements.length + state.calculations.length + state.dataSeries.length + state.notebook.length === 0
          ? <p className="s3d-small">No evidence was recorded.</p> : null}
        {state.measurements.map((m) => (
          <div key={m.id} className="s3d-nb-row">
            <span className="s3d-nb-row__label">{m.label}</span>
            <span className="s3d-nb-row__value s3d-mono">{evidenceValue(m.value, m.unit)}</span>
            <span className="s3d-nb-row__meta">
              <ProvenanceChip kind={provenanceForMeasurement(player, m)} />
              {/* What the instrument showed, beside the entry; neither is judged (decided 2026-09-25). */}
              {player.displayedReadings[m.id] ? <span className="s3d-small">Display showed <span className="s3d-mono">{player.displayedReadings[m.id]}</span></span> : null}
            </span>
          </div>
        ))}
        {state.calculations.map((c) => (
          <div key={c.id} className="s3d-nb-row">
            <span className="s3d-nb-row__label">{c.label}</span>
            <span className="s3d-nb-row__value s3d-mono">{evidenceValue(c.value, c.unit)}</span>
            <span className="s3d-nb-row__meta"><ProvenanceChip kind="calculated" /></span>
          </div>
        ))}
        {state.dataSeries.map((s) => (
          <div key={s.id} className="s3d-nb-row">
            <span className="s3d-nb-row__label">{s.label}</span>
            <span className="s3d-nb-row__value s3d-mono">{s.points.length} readings</span>
            <span className="s3d-nb-row__meta"><ProvenanceChip kind="bench" /></span>
          </div>
        ))}
        {state.notebook.map((e) => (
          <div key={e.id} className="s3d-nb-row">
            <span className="s3d-nb-row__label">{e.label}</span>
            <span className="s3d-nb-row__value">{entryValue(player, e)}</span>
            <span className="s3d-nb-row__meta"><ProvenanceChip kind={provenanceForEntry(player, e)} /></span>
          </div>
        ))}
        <div className="s3d-results__actions">
          <a className="s3d-button s3d-button--quiet" href={backHref}>Back to techniques</a>
          <button type="button" className="s3d-button" onClick={() => window.print()}>Print</button>
          <button type="button" className="s3d-button" onClick={onPlayAgain}>Play again</button>
        </div>
      </div>
    </div>
  );
};
