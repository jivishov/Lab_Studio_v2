import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RuntimeDefinition } from "../../runtime";
import { BenchView } from "../bench/BenchView";
import type { BenchEngine, CameraPose, GraphicsQuality } from "../bench/BenchEngine";
import { arrowDirection, spatialNeighbour } from "../bench/input/keyboard";
import { useBenchCarry } from "../bench/input/useBenchCarry";
import { Icon } from "../ui/Icon";
import { coveredSides, MOVABLE_FROM_WIDTH, sanitizeLayout, type PanelId, type PanelLayout, type PanelState } from "./panelLayout";
import { BenchList, EquipmentTray, ExamineCard, HelpDialog, NOTEBOOK_WIDTH, NotebookSheet, ResultsSheet, type PanelControls } from "./panels";
import { StepCard } from "./StepCard";
import { usePlayer3D, type Player3DController } from "./usePlayer3D";

/**
 * Player3D (handoff §5): the live bench full-bleed, with floating panels. It commits only through
 * the runtime (usePlayer3D), stores no run state (G-13), and keeps its UI preferences under
 * `lab-studio:3d:v1:player-ui` (§3.8). Everything is reachable without the canvas (G-6).
 */
const PREFS_KEY = "lab-studio:3d:v1:player-ui";
interface Prefs { beacon: boolean; quality: GraphicsQuality; reducedMotion: "system" | "on"; panels: PanelLayout; notebookWidth: number }
const DEFAULT_PREFS: Prefs = { beacon: true, quality: "high", reducedMotion: "system", panels: {}, notebookWidth: NOTEBOOK_WIDTH.initial };
/** Stored preferences are read field by field, so a stale or edited value falls back to its default. */
const readPrefs = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Record<string, unknown>;
    return {
      beacon: typeof raw.beacon === "boolean" ? raw.beacon : DEFAULT_PREFS.beacon,
      quality: raw.quality === "balanced" || raw.quality === "low" ? raw.quality : DEFAULT_PREFS.quality,
      reducedMotion: raw.reducedMotion === "on" ? "on" : "system",
      panels: sanitizeLayout(raw.panels),
      notebookWidth: typeof raw.notebookWidth === "number" && Number.isFinite(raw.notebookWidth)
        ? Math.max(NOTEBOOK_WIDTH.min, raw.notebookWidth) : DEFAULT_PREFS.notebookWidth,
    };
  } catch {
    return DEFAULT_PREFS;
  }
};
const writePrefs = (prefs: Prefs) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* the player works without storage */ }
};
const systemReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const windowSize = () => ({ width: window.innerWidth, height: window.innerHeight });

export const Player3D = ({ definition, authoredDefinition, title, sourceTag, fallbackHash, backHref, variant = "full", focusNodeId, focusVersion, onPlayer }: {
  definition: RuntimeDefinition;
  /** The definition before teacher setup, for provenance chips (see usePlayer3D). */
  authoredDefinition?: RuntimeDefinition;
  title: string;
  sourceTag: string;
  fallbackHash: string;
  backHref: string;
  /** "preview": inside the Studio's stage (handoff §4.6), which supplies its own toolbar. */
  variant?: "full" | "preview";
  focusNodeId?: string;
  focusVersion?: number;
  /** The Studio's preview toolbar drives restart, mode and step through the controller. */
  onPlayer?: (player: Player3DController) => void;
}) => {
  const player = usePlayer3D(definition, "guided", authoredDefinition, { nodeId: focusNodeId, version: focusVersion });
  useEffect(() => { onPlayer?.(player); });
  const { runtime, scene, flow, showGuidance } = player;
  const [engine, setEngine] = useState<BenchEngine>();
  const [prefs, setPrefs] = useState(readPrefs);
  const [panel, setPanel] = useState<"tray" | "list" | "none">("tray");
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState<{ loaded: number; total: number }>();
  const [benchReady, setBenchReady] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const examinePose = useRef<(CameraPose & { auto: boolean }) | undefined>(undefined);
  const [confirmMode, setConfirmMode] = useState<"assessment" | "guided" | "restart">();
  const [examined, setExamined] = useState<string>();
  const [hovered, setHovered] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [autoView, setAutoView] = useState(true);
  const [viewport, setViewport] = useState(windowSize);
  const [, bump] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const lastNode = useRef<string | undefined>(undefined);
  const reducedMotion = prefs.reducedMotion === "on" || systemReducedMotion();
  const options = useMemo(() => ({ quality: prefs.quality, reducedMotion }), [prefs.quality, reducedMotion]);
  const updatePrefs = (patch: Partial<Prefs>) => setPrefs((p) => { const next = { ...p, ...patch }; writePrefs(next); return next; });

  // Floating panels (§5.1): the layout is a UI preference, remembered and resettable from the Menu.
  useEffect(() => {
    const onResize = () => setViewport(windowSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const updatePanel = useCallback((id: PanelId, patch: PanelState) => setPrefs((p) => {
    const merged = { ...p.panels[id], ...patch };
    const entry: PanelState = { ...(merged.box ? { box: merged.box } : {}), ...(merged.collapsed ? { collapsed: true } : {}) };
    const panels = { ...p.panels };
    if (entry.box || entry.collapsed) panels[id] = entry;
    else delete panels[id];
    const next = { ...p, panels };
    writePrefs(next);
    return next;
  }), []);
  const panelControls: PanelControls = {
    movable: viewport.width >= MOVABLE_FROM_WIDTH,
    layout: prefs.panels,
    viewport,
    setBox: (id, box) => updatePanel(id, { box }),
    setCollapsed: (id, collapsed) => updatePanel(id, { collapsed }),
  };

  // A tap selects an item; on touch, a second tap on the selection opens its item menu (§5.19).
  const [itemMenu, setItemMenu] = useState<{ id: string; x: number; y: number }>();
  const tapRef = useRef<(id: string, pointerType: string, x: number, y: number) => void>(() => undefined);
  const onTap = useCallback((id: string, pointerType: string, x: number, y: number) => tapRef.current(id, pointerType, x, y), []);
  const carry = useBenchCarry(engine, player, setHovered, onTap);
  const carryingRef = useRef(carry.carrying);
  carryingRef.current = carry.carrying;

  // While a committed pour animates, the bench shows the committed layout with the pour's contents
  // not yet moved (pourStagingScene); when it ends, the committed scene (G-3).
  const displayScene = player.pour ? player.pour.staging : scene;
  useEffect(() => {
    const pour = player.pour;
    if (!pour || !engine) return;
    const staged = (id: string) => pour.staging.bench.find((i) => i.instanceId === id);
    const committed = (id: string) => scene.bench.find((i) => i.instanceId === id);
    const source = staged(pour.sourceId);
    const target = staged(pour.targetId);
    // Where the source rests afterwards (parked after a drag); a shelf source goes back to the tray.
    const sourceAfter = committed(pour.sourceId);
    const run = async () => {
      await engine.sync(pour.staging);
      // The pour is framed where it happens, unless the learner has taken the camera (§5.9).
      if (autoViewRef.current && !reducedMotion) engine.frameItems([pour.sourceId, pour.targetId], 2.2);
      if (source && target) {
        await engine.animatePour({ sourceId: pour.sourceId, targetId: pour.targetId,
          sourceBefore: source.contents, sourceAfter: pour.sourceAfter,
          targetBefore: target.contents, targetAfter: pour.targetAfter,
          // The source is set down where the runtime has it afterwards (parked after a drag).
          ...(sourceAfter?.placement.kind === "bench" ? { returnTo: sourceAfter.placement.point } : {}) });
      }
      player.finishPour(pour.id);
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.pour?.id, engine]);

  // Guidance in the world (guided only, G-7): the beacon marks the expected source, then the
  // expected target while something is being carried (§5.9).
  const expectedSourceId = useMemo(() => {
    const def = flow.source.definitionId;
    return def ? scene.bench.find((i) => i.definitionId === def)?.instanceId : undefined;
  }, [flow.source.definitionId, scene]);
  const expectedTargetId = useMemo(() => {
    const def = flow.target.definitionId;
    return def ? scene.bench.find((i) => i.definitionId === def && i.instanceId !== expectedSourceId)?.instanceId : undefined;
  }, [expectedSourceId, flow.target.definitionId, scene]);
  useEffect(() => {
    const guiding = showGuidance && prefs.beacon && !flow.nodeCompleted;
    engine?.setBeacon(guiding ? (carry.carrying ? expectedTargetId : expectedSourceId) ?? null : null);
  }, [carry.carrying, engine, expectedSourceId, expectedTargetId, flow.nodeCompleted, prefs.beacon, showGuidance, displayScene]);
  useEffect(() => { engine?.setSelected(selected ?? null); }, [engine, selected, displayScene]);

  // Auto-framing on a new step: the working set in guided mode, the whole bench in assessment (§5.9).
  // It fits the free area left by the open panels, wherever they have been moved, and never moves
  // the camera during a carry.
  const frame = useCallback(() => {
    if (!engine || carryingRef.current) return;
    const panels = [...(playerRef.current?.querySelectorAll<HTMLElement>("[data-panel], .s3d-examine, .s3d-sheet") ?? [])];
    engine.panelInsets = coveredSides(engine.canvasElement.getBoundingClientRect(), panels.map((el) => el.getBoundingClientRect()));
    const targetDef = flow.target.definitionId;
    const working = new Set(showGuidance
      ? scene.bench.filter((i) => i.definitionId === flow.source.definitionId || i.definitionId === targetDef).map((i) => i.instanceId)
      : []);
    for (const item of scene.bench) {
      if (working.has(item.instanceId) && item.placement.kind === "seated") working.add(item.placement.parentInstanceId);
    }
    engine.frameItems(working.size ? [...working] : "all", working.size ? 1.9 : 1.2);
  }, [engine, flow.source.definitionId, flow.target.definitionId, scene, showGuidance]);
  useEffect(() => {
    if (runtime.currentNode.id !== lastNode.current) {
      lastNode.current = runtime.currentNode.id;
      player.announce(`${runtime.currentNode.title}. ${runtime.currentNode.description}`);
    }
  }, [player, runtime.currentNode]);
  // Framing waits for the bench to settle: a step often brings an item off the tray, and its bounds
  // exist only once its model has loaded. While a committed pour animates, the bench still shows
  // the scene from before it, so framing also waits for the pour to finish. A new step also ends a
  // manual-camera suspension (§5.9).
  const pouring = Boolean(player.pour);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const autoViewRef = useRef(autoView);
  autoViewRef.current = autoView;
  const framedNode = useRef<string | undefined>(undefined);
  useEffect(() => {
    const nodeId = runtime.currentNode.id;
    if (!engine || pouring || framedNode.current === nodeId) return;
    framedNode.current = nodeId;
    setAutoView(true);
    autoViewRef.current = true;
    void engine.settled().then(() => { if (framedNode.current === nodeId && autoViewRef.current) frameRef.current(); });
  }, [engine, pouring, runtime.currentNode.id]);
  // Opening, closing, moving, resizing or collapsing a panel changes the free area, so the auto
  // view refits (§5.9).
  useEffect(() => {
    if (engine && !pouring && autoViewRef.current) void engine.settled().then(() => { if (autoViewRef.current) frameRef.current(); });
  }, [engine, panel, notebookOpen, pouring, prefs.panels, prefs.notebookWidth, viewport]);

  // Keyboard map (§5.19); single-letter keys only while the bench has focus (WCAG 2.1.4).
  const benchFocused = () => document.activeElement === engine?.canvasElement;
  /** Bench items with where they stand, for arrow-key selection in spatial order. */
  const placedItems = () => scene.bench.flatMap((item) => {
    const base = engine?.basePosition(item.instanceId);
    return base ? [{ id: item.instanceId, xMm: base.x * 1000, yMm: -base.z * 1000 }] : [];
  });
  const startMove = (id: string) => {
    setSelected(id);
    engine?.canvasElement.focus();
    if (!carry.startKeyCarry(id)) player.announce("This item moves only as part of its step.");
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (carry.keyCarrying) {
        if (benchFocused() && carry.handleCarryKey(e)) e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        setItemMenu(undefined);
        if (examined) closeExamine();
        setMenuOpen(false);
        setHelpOpen(false);
        setViewsOpen(false);
        return;
      }
      if (!benchFocused()) return;
      const direction = arrowDirection(e.key);
      if (direction) {
        const next = spatialNeighbour(placedItems(), selected, direction);
        if (next) setSelected(next);
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (selected && scene.bench.some((item) => item.instanceId === selected)) { startMove(selected); e.preventDefault(); }
      } else if (e.key === "e" || e.key === "E") { if (selected) examine(selected); }
      else if (e.key === "s" || e.key === "S") { if (selected) player.setSelectedSource(selected); }
      else if (e.key === "t" || e.key === "T") { if (selected) player.setSelectedTarget(selected); }
      else if (e.key === "n" || e.key === "N") setNotebookOpen((v) => !v);
      else if (e.key === "a" || e.key === "A") { setAutoView(true); frame(); }
      else if (e.key === "Home") engine?.resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!engine) return undefined;
    engine.onManualCamera = () => setAutoView(false);
    engine.onChange = () => bump((v) => v + 1);
    return () => { engine.onManualCamera = undefined; engine.onChange = undefined; };
  }, [engine]);

  // The loader (§5.2): the bar counts the technique's GLB bytes until the first bench is drawn.
  useEffect(() => {
    if (!engine) return undefined;
    let active = true;
    engine.onLoadProgress = (loaded, total) => setLoading({ loaded, total });
    void engine.settled().then(() => { if (active) setBenchReady(true); });
    return () => { active = false; engine.onLoadProgress = undefined; };
  }, [engine]);

  // Double-click (or double-tap) an item to examine it (§5.8).
  const examineRef = useRef<(id: string) => void>(() => undefined);
  useEffect(() => {
    if (!engine) return undefined;
    const canvas = engine.canvasElement;
    const onDouble = (event: MouseEvent) => {
      const id = engine.pick(event.clientX, event.clientY);
      if (id && scene.bench.some((item) => item.instanceId === id)) examineRef.current(id);
    };
    canvas.addEventListener("dblclick", onDouble);
    return () => canvas.removeEventListener("dblclick", onDouble);
  }, [engine, scene]);

  useEffect(() => {
    if (!player.toast) return undefined;
    const t = window.setTimeout(player.clearToast, 4000);
    return () => window.clearTimeout(t);
  }, [player.toast, player.clearToast]);

  // Examine (§5.8): the camera flies to the item and comes back to where it was on Close or Esc.
  const examine = (id: string) => {
    if (!engine) return;
    if (!examined) examinePose.current = { ...engine.pose(), auto: autoView };
    setExamined(id);
    setSelected(id);
    engine.frameItems([id], 1.6);
    setAutoView(false);
  };
  examineRef.current = examine;
  const closeExamine = () => {
    setExamined(undefined);
    if (engine && examinePose.current) {
      engine.restorePose(examinePose.current);
      setAutoView(examinePose.current.auto);
    }
    examinePose.current = undefined;
  };
  // Show me (§5.9, guided only): frame the working set, then the engine's pulse-and-ghost demo.
  const showMe = () => {
    setAutoView(true);
    frame();
    engine?.showMe(expectedSourceId, expectedTargetId);
  };
  tapRef.current = (id, pointerType, x, y) => {
    const rect = engine?.canvasElement.getBoundingClientRect();
    if (pointerType === "touch" && selected === id && rect) setItemMenu({ id, x: x - rect.left, y: y - rect.top });
    else {
      setSelected(id);
      setItemMenu(undefined);
    }
  };
  const menuItem = itemMenu ? scene.bench.find((i) => i.instanceId === itemMenu.id) : undefined;
  const chooseView = (view: "auto" | "bench" | "selected" | "overhead") => {
    setViewsOpen(false);
    setAutoView(view === "auto");
    if (view === "auto") frame();
    else if (view === "bench") engine?.frameBench();
    else if (view === "selected" && selected) engine?.frameItems([selected], 2.2);
    else if (view === "overhead") engine?.overhead();
  };
  const examinedHolder = (() => {
    const item = examined ? scene.bench.find((i) => i.instanceId === examined) : undefined;
    return item?.placement.kind === "seated" ? scene.bench.find((i) => i.instanceId === (item.placement as { parentInstanceId: string }).parentInstanceId)?.label : undefined;
  })();
  const hoverItem = hovered && !carry.carrying ? scene.bench.find((i) => i.instanceId === hovered) : undefined;
  const hoverPoint = hoverItem && engine ? engine.screenPoint(hoverItem.instanceId, 0) : undefined;
  const examinedItem = examined ? scene.bench.find((i) => i.instanceId === examined) : undefined;
  const n = Math.max(0, runtime.process.nodes.findIndex((node) => node.id === runtime.currentNode.id)) + 1;
  const N = runtime.process.nodes.length;
  const nbDot = showGuidance && flow.interaction?.type === "recordNotebook";
  const hint = carry.keyCarrying ? "Arrows move it (Shift: further). [ ] step through targets. Enter sets it down; Esc cancels."
    : carry.carrying ? "Release to set down. Esc cancels."
    : flow.canConfirm ? "Drag items on the bench, or use Source, Target and Confirm. Right-drag to look around."
      : "Fill in the step card, then record. Right-drag to look around.";

  return (
    <div className={`s3d-player${reducedMotion ? " is-reduced-motion" : ""}${variant === "preview" ? " s3d-player--preview" : ""}`} ref={playerRef}>
      <header className="s3d-topbar">
        <span className="s3d-mark"><Icon name="flask" size={18} /></span>
        <span className="s3d-topbar__title">{title}</span>
        <span className="s3d-source">{sourceTag}</span>
        <span className="s3d-topbar__centre">Step <b>{n}</b> of <b>{N}</b>
          <span className={`s3d-mode${showGuidance ? "" : " is-assess"}`}><Icon name={showGuidance ? "eye" : "clip"} size={13} />{showGuidance ? "Guided" : "Assessment"}</span>
        </span>
        <span className="s3d-topbar__right">
          <button type="button" className={`s3d-button s3d-button--quiet${nbDot ? " has-dot" : ""}`} onClick={() => setNotebookOpen((v) => !v)} aria-pressed={notebookOpen}><Icon name="book" />Notebook</button>
          <button type="button" className="s3d-icon-button s3d-icon-button--bar" aria-label="Controls and model" title="Controls & model" onClick={() => setHelpOpen(true)}><Icon name="help" size={18} /></button>
          <button type="button" className="s3d-button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}><Icon name="menu" />Menu</button>
        </span>
      </header>

      <StepCard player={player} controls={panelControls} onShowMe={showMe} />

      <BenchView
        scene={displayScene}
        options={options}
        onEngine={setEngine}
        label={`3D bench for ${title}. Every item is also listed in the Bench list.`}
        fallback={<div className="s3d-fallback"><p>This browser cannot draw the 3D bench. The 2D version runs the same steps and checks.</p><a className="s3d-button s3d-button--primary" href={fallbackHash}>Open the 2D version</a></div>}
      >
        {hoverItem && hoverPoint?.visible ? (
          <div className="s3d-label" style={{ left: hoverPoint.x, top: hoverPoint.y + 12 }}>{hoverItem.label} · {hoverItem.contentsText}</div>
        ) : null}
        {menuItem && itemMenu ? (
          <div className="s3d-itemmenu" role="menu" aria-label={menuItem.label} style={{ left: itemMenu.x, top: itemMenu.y }}>
            <button type="button" role="menuitem" onClick={() => { setItemMenu(undefined); examine(menuItem.instanceId); }}>Examine</button>
            <button type="button" role="menuitem" onClick={() => { setItemMenu(undefined); startMove(menuItem.instanceId); }}>Move…</button>
            <button type="button" role="menuitem" onClick={() => { setItemMenu(undefined); player.setSelectedSource(menuItem.instanceId); }}>Use as source</button>
            <button type="button" role="menuitem" onClick={() => { setItemMenu(undefined); player.setSelectedTarget(menuItem.instanceId); }}>Use as target</button>
          </div>
        ) : null}
        {carry.callout ? (
          <div className={`s3d-callout s3d-callout--${carry.callout.kind}`} style={{ left: carry.callout.x, top: carry.callout.y }}>
            <Icon name={carry.callout.kind === "valid" ? "check" : carry.callout.kind === "invalid" ? "x" : "tray"} size={14} />{carry.callout.text}
          </div>
        ) : null}
      </BenchView>

      {engine && !benchReady ? (
        <div className="s3d-loader" role="status" aria-live="polite">
          <div className="s3d-loader__card">
            <p className="s3d-eyebrow">{title}</p>
            <p>Preparing the bench…</p>
            <div className="s3d-loader__bar" role="progressbar" aria-label="Loading the equipment models" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={loading && loading.total > 0 ? Math.round((100 * loading.loaded) / loading.total) : 0}>
              <span style={{ width: `${loading && loading.total > 0 ? (100 * loading.loaded) / loading.total : 0}%` }} />
            </div>
            <a href={fallbackHash}>Open the 2D version</a>
          </div>
        </div>
      ) : null}

      {panel === "tray" ? <EquipmentTray player={player} controls={panelControls} onPointerDownTile={carry.startTrayCarry} /> : null}
      {panel === "list" ? <BenchList player={player} controls={panelControls} selected={selected}
        onSelect={(id) => { setSelected(id); setAutoView(false); engine?.frameItems([id], 2.2); }} onExamine={examine}
        onMove={startMove} onClose={() => setPanel("none")} /> : null}
      {examinedItem ? (
        <ExamineCard item={examinedItem} holderLabel={examinedHolder} onClose={closeExamine}
          onEyeLevel={examinedItem.contents.kind === "liquid"
            ? () => engine?.eyeLevel(examinedItem.instanceId, (examinedItem.contents as { levelMm: number }).levelMm)
            : undefined} />
      ) : null}
      {notebookOpen ? <NotebookSheet player={player} width={prefs.notebookWidth} onResize={(w) => updatePrefs({ notebookWidth: w })}
        onClose={() => setNotebookOpen(false)} /> : null}

      <p className="s3d-hint">{hint}</p>
      <nav className="s3d-dock" aria-label="Player tools">
        <button type="button" className={panel === "tray" ? "is-on" : ""} onClick={() => setPanel(panel === "tray" ? "none" : "tray")}><Icon name="tray" size={20} />Tray</button>
        <button type="button" className={panel === "list" ? "is-on" : ""} onClick={() => setPanel(panel === "list" ? "none" : "list")}><Icon name="list" size={20} />Bench list</button>
        <button type="button" disabled={!selected} onClick={() => selected && examine(selected)}><Icon name="examine" size={20} />Examine</button>
        <span className="s3d-dock__sep" />
        <button type="button" className={autoView ? "is-on" : ""} onClick={() => chooseView("auto")}><Icon name="camera" size={20} />Auto view</button>
        <button type="button" className="s3d-dock__caret" aria-label="Camera views" aria-haspopup="menu" aria-expanded={viewsOpen} onClick={() => setViewsOpen((v) => !v)}>
          <Icon name="chevron-up" size={16} />
        </button>
        {viewsOpen ? (
          <div className="s3d-viewmenu" role="menu" aria-label="Camera views">
            <button type="button" role="menuitem" onClick={() => chooseView("auto")}>Auto · follow the step</button>
            <button type="button" role="menuitem" onClick={() => chooseView("bench")}>Whole bench</button>
            <button type="button" role="menuitem" disabled={!selected} onClick={() => chooseView("selected")}>Selected item</button>
            <button type="button" role="menuitem" onClick={() => chooseView("overhead")}>Overhead</button>
          </div>
        ) : null}
        <button type="button" onClick={() => { setAutoView(false); engine?.resetView(); }}><Icon name="reset" size={20} />Reset view</button>
      </nav>

      {player.toast ? <div className="s3d-toast" role="status"><Icon name="check" />{player.toast}</div> : null}
      <div className="s3d-sr" aria-live="polite">{player.announcement}</div>

      {menuOpen ? (
        <div className="s3d-menu" role="menu">
          <label><input type="checkbox" checked={prefs.beacon} onChange={(e) => updatePrefs({ beacon: e.target.checked })} /> Next-target beacon (guided)</label>
          <label><input type="checkbox" checked={prefs.reducedMotion === "on"} onChange={(e) => updatePrefs({ reducedMotion: e.target.checked ? "on" : "system" })} /> Reduced motion</label>
          <label>Graphics quality
            <select value={prefs.quality} onChange={(e) => updatePrefs({ quality: e.target.value as GraphicsQuality })}>
              <option value="high">High</option><option value="balanced">Balanced</option><option value="low">Low</option>
            </select>
          </label>
          <button type="button" onClick={() => setConfirmMode(showGuidance ? "assessment" : "guided")}>Switch to {showGuidance ? "assessment" : "guided"}</button>
          <button type="button" onClick={() => updatePrefs({ panels: {} })}>Reset panel layout</button>
          <button type="button" onClick={() => setConfirmMode("restart")}>Restart</button>
          <a href={fallbackHash}>Open the 2D version</a>
          <a href={backHref}>Exit</a>
        </div>
      ) : null}

      {confirmMode ? (
        <div className="s3d-dialog-back" role="dialog" aria-modal="true" aria-label="Confirm">
          <div className="s3d-dialog">
            <p>{confirmMode === "restart" ? "Restart this technique? The bench returns to its starting state."
              : confirmMode === "assessment" ? "Switch to assessment? From now on, refused actions are recorded as attempts."
                : "Switch to guided? Guidance returns; the run keeps its state."}</p>
            <div className="s3d-dialog__actions">
              <button type="button" className="s3d-button" onClick={() => setConfirmMode(undefined)}>Cancel</button>
              <button type="button" className="s3d-button s3d-button--primary" onClick={() => {
                if (confirmMode === "restart") player.restart();
                else runtime.setMode(confirmMode);
                setConfirmMode(undefined);
                setMenuOpen(false);
              }}>{confirmMode === "restart" ? "Restart" : "Switch"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {player.complete && !confirmMode ? <ResultsSheet player={player} onPlayAgain={() => setConfirmMode("restart")} backHref={backHref} /> : null}
      {helpOpen ? <HelpDialog onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
};
