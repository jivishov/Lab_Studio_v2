import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureCursorOverlay, useGestureBridge } from "../../player/gesture/bridge/useGestureBridge";
import type { GestureController } from "../../player/gesture/gestureTypes";
import { useGestureRecognition } from "../../player/gesture/useGestureRecognition";
import type { RuntimeDefinition } from "../../runtime";
import { BenchView } from "../bench/BenchView";
import type { BenchEngine, CameraPose, GraphicsQuality } from "../bench/BenchEngine";
import { arrowDirection, spatialNeighbour } from "../bench/input/keyboard";
import { createBenchGestureTargetResolver, type BenchGestureGrab } from "../bench/input/targetResolver";
import { useBenchCarry } from "../bench/input/useBenchCarry";
import { Icon } from "../ui/Icon";
import { HandControlPanel } from "./HandControlPanel";
import { coveredSides, MOVABLE_FROM_WIDTH, sanitizeLayout, type PanelId, type PanelLayout, type PanelState } from "./panelLayout";
import { BenchList, EquipmentTray, ExamineCard, HelpDialog, NOTEBOOK_WIDTH, NotebookSheet, ResultsSheet, thumbnailUrl, type PanelControls } from "./panels";
import { SimulationSwitcher } from "./SimulationSwitcher";
import { DropPanel } from "./DropPanel";
import { StepCard } from "./StepCard";
import { fillLevelMm } from "../adapters/runtimeToScene";
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
const lowerFirstLetter = (text: string) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);
const systemReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const windowSize = () => ({ width: window.innerWidth, height: window.innerHeight });

/** A tray item carried by hand control: its thumbnail follows the pinch, keeping the grip it was taken with. */
interface TrayGrabPreview { definitionId: string; label: string; offsetX: number; offsetY: number; x: number; y: number }
const TRAY_PREVIEW_PX = 72;

export const Player3D = ({ definition, authoredDefinition, title, sourceTag, fallbackHash, backHref, variant = "full", focusNodeId, focusVersion, onPlayer, gestureController, simulationId }: {
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
  /** Replaces the camera recognition engine, as the 2D player allows (tests). */
  gestureController?: GestureController;
  /** A standalone technique: its title opens the switcher between the 3D simulations. */
  simulationId?: string;
}) => {
  const player = usePlayer3D(definition, "guided", authoredDefinition, { nodeId: focusNodeId, version: focusVersion });
  // The Studio's preview Restart also stops the camera tracks, as the player's own Restart does.
  useEffect(() => { onPlayer?.({ ...player, restart: () => { stopHandControl(); player.restart(); } }); });
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
  // A control on an instrument, the balance's TARE key (decided 2026-09-25): see controlRef below.
  const controlRef = useRef<(instanceId: string, controlId: string) => void>(() => undefined);
  const onControl = useCallback((instanceId: string, controlId: string) => controlRef.current(instanceId, controlId), []);
  // Drop mode (decided 2026-10-02): a pipette held over a vessel while liquid goes in a drop at a time.
  const holdOverRef = useRef<(pipetteId: string, vesselId: string) => void>(() => undefined);
  const onHoldOver = useCallback((pipetteId: string, vesselId: string) => holdOverRef.current(pipetteId, vesselId), []);
  const carry = useBenchCarry(engine, player, setHovered, onTap, onControl, onHoldOver);
  const carryingRef = useRef(carry.carrying);
  carryingRef.current = carry.carrying;

  // Hand control (§5.15): the shared gesture bridge (plan D6), which this player gives a raycast
  // resolver behind the bench canvas and the bench's own carry as its grab handlers (G-10).
  const realGesture = useGestureRecognition();
  const gesture = gestureController ?? realGesture;
  const gestureBridge = useGestureBridge<BenchGestureGrab>({ enabled: gesture.enabled, root: playerRef, stop: gesture.stop });
  const [handRearm, setHandRearm] = useState(false);
  const [trayGrab, setTrayGrab] = useState<TrayGrabPreview>();
  const trayGrabRef = useRef<TrayGrabPreview | undefined>(undefined);
  const trayPreviewRef = useRef<HTMLSpanElement | null>(null);
  // The dock button opens the panel; the camera starts only from the panel. While it runs, or while
  // the engine reports a problem, the panel stays shown.
  const [handPanelOpen, setHandPanelOpen] = useState(false);
  const handPanelShown = handPanelOpen || gesture.status !== "off";

  // While a committed pour animates, the bench shows the committed layout with the pour's contents
  // not yet moved (pourStagingScene); when it ends, the committed scene (G-3).
  // Under reduced motion the pour is skipped (§3.5: levels jump to the committed state), so nothing
  // is staged: a shelf source must not appear beside the target for a frame.
  const displayScene = player.pour && !reducedMotion ? player.pour.staging : scene;
  useEffect(() => {
    const pour = player.pour;
    if (!pour) return;
    if (reducedMotion) { player.finishPour(pour.id); return; }
    if (!engine) return;
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

  // A committed weighing (handoff §5.7): the vessel is shown on the pan, then back where the runtime
  // keeps it. Under reduced motion the end state is shown at once (§3.5).
  useEffect(() => {
    const weighing = player.weighing;
    if (!weighing) return;
    if (reducedMotion || !engine) { player.finishWeighing(weighing.id); return; }
    void engine.animateSetOn(weighing).then(() => player.finishWeighing(weighing.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.weighing?.id, engine]);

  // A committed tool transfer (decided 2026-09-25): the spatula tips its scoop onto the target where
  // it was released, then goes back where the runtime keeps it. Skipped under reduced motion (§3.5).
  useEffect(() => {
    const deposit = player.toolDeposit;
    if (!deposit) return;
    if (reducedMotion || !engine) { player.finishToolDeposit(deposit.id); return; }
    void engine.animateToolDeposit(deposit).then(() => player.finishToolDeposit(deposit.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.toolDeposit?.id, engine]);

  // Guidance in the world (guided only, G-7): the beacon marks the expected source, then the
  // expected target while something is being carried (§5.9). A step done with a tool (the spatula,
  // decided 2026-09-25) marks the tool, then the source to dip it into, then the target.
  const expectedSourceId = useMemo(() => {
    const def = flow.source.definitionId;
    return def ? scene.bench.find((i) => i.definitionId === def)?.instanceId : undefined;
  }, [flow.source.definitionId, scene]);
  const expectedTargetId = useMemo(() => {
    const def = flow.target.definitionId;
    return def ? scene.bench.find((i) => i.definitionId === def && i.instanceId !== expectedSourceId)?.instanceId : undefined;
  }, [expectedSourceId, flow.target.definitionId, scene]);
  const tool = player.toolTransfer;
  const toolId = useMemo(
    () => (tool ? scene.bench.find((i) => i.definitionId === tool.toolDefinitionId)?.instanceId : undefined),
    [scene, tool],
  );
  // A draw into a pipette (decided 2026-09-26): the pipette first, then the liquid it draws from.
  const pipette = player.pipetteStep;
  const onBench = (id?: string) => (id && scene.bench.some((i) => i.instanceId === id) ? id : undefined);
  const drawIds = pipette?.kind === "draw" ? { tool: onBench(pipette.toolInstanceId), liquid: onBench(pipette.otherInstanceId) } : undefined;
  const beaconId = drawIds ? (!carry.carrying ? drawIds.tool : carry.carriedDefinitionId === pipette!.toolDefinitionId ? drawIds.liquid : undefined)
    : !tool ? (carry.carrying ? expectedTargetId : expectedSourceId)
    : !carry.carrying ? toolId
      : carry.carriedDefinitionId !== tool.toolDefinitionId ? undefined
        : carry.toolLoaded ? expectedTargetId : expectedSourceId;
  useEffect(() => {
    const guiding = showGuidance && prefs.beacon && !flow.nodeCompleted;
    engine?.setBeacon(guiding ? beaconId ?? null : null);
  }, [beaconId, engine, flow.nodeCompleted, prefs.beacon, showGuidance, displayScene]);

  // The control a step asks for: the zero step's balance and its "zero" control (the TARE key).
  const expectedControl = useMemo(() => {
    const parameters = runtime.expectedAction?.parameters;
    const instanceId = parameters?.instrumentInstanceId;
    if (flow.nodeCompleted || parameters?.balanceOperation !== "zero" || typeof instanceId !== "string") return undefined;
    const control = scene.bench.find((item) => item.instanceId === instanceId)?.model?.controls?.find((c) => c.operation === "zero");
    return control ? { instanceId, controlId: control.id } : undefined;
  }, [flow.nodeCompleted, runtime.expectedAction, scene]);
  // Guided only (G-7): the key the step asks for is lit.
  useEffect(() => {
    engine?.setControlCue(showGuidance && expectedControl ? expectedControl : null);
  }, [engine, expectedControl, showGuidance, displayScene]);
  // Drop mode (decided 2026-10-02): the step's pipette is held over its vessel, the camera is level with
  // the line, and each tap or run of drops goes to the runtime; nothing is judged until "At the line".
  const [dropMode, setDropMode] = useState<{ pipetteId: string; vesselId: string }>();
  const runTimer = useRef<number | undefined>(undefined);
  const spaceHold = useRef<number | undefined>(undefined);
  const onBenchNow = (id: string) => scene.bench.some((item) => item.instanceId === id);
  const addDrop = (count: number) => {
    if (player.addDrops(count)) engine?.dropFromHeld();
  };
  const endRun = () => {
    if (runTimer.current !== undefined) window.clearInterval(runTimer.current);
    runTimer.current = undefined;
  };
  const startRun = () => {
    if (runTimer.current !== undefined) return;
    addDrop(3);
    runTimer.current = window.setInterval(() => addDropRef.current(3), 140);
  };
  const addDropRef = useRef(addDrop);
  addDropRef.current = addDrop;
  const exitDropMode = () => {
    endRun();
    setDropMode(undefined);
    engine?.holdOver(null);
    setAutoView(true);
    void engine?.settled().then(() => frameRef.current());
  };
  const acceptAtLine = () => {
    endRun();
    player.acceptMark();
  };
  holdOverRef.current = (pipetteId, vesselId) => {
    const mark = player.markStep;
    if (!engine || !mark) return;
    setDropMode({ pipetteId, vesselId });
    engine.holdOver(pipetteId, vesselId);
    setAutoView(false);
    // Level with the line: the flask's calibration mark, or the pipette's line for the aliquot.
    if (mark.bySource) {
      const item = scene.bench.find((i) => i.instanceId === pipetteId);
      const delivered = runtime.state.markDispenses?.[runtime.expectedAction?.id ?? ""]?.deliveredMl ?? 0;
      const held = item?.contents.kind === "liquid" ? item.contents.volumeMl : 0;
      if (item?.model?.fill) engine.eyeLevel(pipetteId, fillLevelMm(item.model.fill, Math.max(0, held + delivered - mark.goalMl)).levelMm, 0.16, [vesselId]);
    } else {
      const item = scene.bench.find((i) => i.instanceId === vesselId);
      const level = item?.model?.calibration?.heightMm ?? (item?.model?.fill ? fillLevelMm(item.model.fill, mark.goalMl).levelMm : undefined);
      if (level !== undefined) engine.eyeLevel(vesselId, level, 0.2, [pipetteId]);
    }
  };
  const holdFromCard = () => {
    const mark = player.markStep;
    if (mark) holdOverRef.current(mark.pipetteInstanceId, mark.vesselInstanceId);
  };
  // Leaving the step (accepted at the line, or restarted) puts the pipette down.
  useEffect(() => {
    if (dropMode && (!player.markStep || player.markStep.pipetteInstanceId !== dropMode.pipetteId)) exitDropMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.markStep, dropMode]);
  // Space released: a short press was one drop, a long one ended the run.
  useEffect(() => {
    if (!dropMode) return undefined;
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      const pending = spaceHold.current;
      spaceHold.current = undefined;
      if (pending) { window.clearTimeout(pending); addDropRef.current(1); } else endRun();
    };
    window.addEventListener("keyup", onUp);
    return () => window.removeEventListener("keyup", onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropMode]);
  // On the bench, a press is one drop and a held press lets it run; nothing is carried or orbited.
  useEffect(() => {
    if (!dropMode || !engine) return undefined;
    const canvas = engine.canvasElement;
    let hold: number | undefined;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      hold = window.setTimeout(() => { hold = 0; startRun(); }, 300);
    };
    const up = (e: PointerEvent) => {
      if (e.button !== 0 || hold === undefined) return;
      if (hold) { window.clearTimeout(hold); addDropRef.current(1); } else endRun();
      hold = undefined;
    };
    canvas.addEventListener("pointerdown", down, { capture: true });
    window.addEventListener("pointerup", up);
    return () => {
      canvas.removeEventListener("pointerdown", down, { capture: true });
      window.removeEventListener("pointerup", up);
      endRun();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropMode, engine]);

  // Inverting to mix (decided 2026-10-02): the vessel the step names, stoppered. Each inversion the
  // runtime counts is drawn after it, so the step card's Invert and a tap on the flask look the same.
  const invertParams = runtime.expectedAction?.parameters.mixOperation === "invert" && !flow.nodeCompleted ? runtime.expectedAction.parameters : undefined;
  const invertVesselId = typeof invertParams?.vesselInstanceId === "string" ? invertParams.vesselInstanceId : undefined;
  const isInvertTarget = (id: string): boolean => {
    if (!invertVesselId) return false;
    const item = scene.bench.find((i) => i.instanceId === id);
    return id === invertVesselId || (item?.placement.kind === "seated" && item.placement.parentInstanceId === invertVesselId);
  };
  const inversions = runtime.state.mixInversions ?? {};
  const inversionTotal = Object.values(inversions).reduce((sum, n) => sum + n, 0);
  const lastInversions = useRef<Record<string, number>>({});
  useEffect(() => {
    const before = lastInversions.current;
    lastInversions.current = { ...inversions };
    const changed = Object.keys(inversions).find((id) => (inversions[id] ?? 0) > (before[id] ?? 0));
    if (!changed || !engine) return;
    const vessel = definition.actions.find((a) => a.id === changed)?.parameters.vesselInstanceId;
    if (typeof vessel === "string") void engine.animateInversion(vessel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inversionTotal, engine]);

  // Pressing the key performs the step it is for, exactly as the step card's Tare button does
  // (both stay: G-6). At any other step nothing changes, and a neutral notice says so.
  controlRef.current = (instanceId, controlId) => {
    engine?.pressControl(instanceId, controlId);
    if (expectedControl?.instanceId === instanceId && expectedControl.controlId === controlId && (flow.canRecord || flow.canRecordObservation)) {
      player.recordEvidence();
      return;
    }
    const label = scene.bench.find((item) => item.instanceId === instanceId)?.model?.controls?.find((c) => c.id === controlId)?.label ?? "Key";
    player.notify(`${label} pressed. Nothing is zeroed at this step.`);
  };
  // A tool deposit ends with the tool back where the runtime keeps it, so the ring follows it there.
  useEffect(() => { engine?.setSelected(selected ?? null); }, [engine, selected, displayScene, player.toolDeposit]);

  // Auto-framing on a new step: the working set in guided mode, the whole bench in assessment (§5.9).
  // It fits the free area left by the open panels, wherever they have been moved, and never moves
  // the camera during a carry.
  const frame = useCallback(() => {
    if (!engine || carryingRef.current) return;
    const panels = [...(playerRef.current?.querySelectorAll<HTMLElement>("[data-panel], .s3d-examine, .s3d-sheet") ?? [])];
    engine.panelInsets = coveredSides(engine.canvasElement.getBoundingClientRect(), panels.map((el) => el.getBoundingClientRect()));
    const targetDef = flow.target.definitionId;
    const toolDef = player.toolTransfer?.toolDefinitionId;
    const working = new Set(showGuidance
      ? scene.bench.filter((i) => i.definitionId === flow.source.definitionId || i.definitionId === targetDef || i.definitionId === toolDef).map((i) => i.instanceId)
      : []);
    for (const item of scene.bench) {
      if (working.has(item.instanceId) && item.placement.kind === "seated") working.add(item.placement.parentInstanceId);
    }
    engine.frameItems(working.size ? [...working] : "all", working.size ? 1.9 : 1.2);
  }, [engine, flow.source.definitionId, flow.target.definitionId, player.toolTransfer, scene, showGuidance]);
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
  // A committed pour, weighing or tool transfer being drawn holds the framing back, as a carry does (§5.9).
  const pouring = Boolean(player.pour || player.weighing || player.toolDeposit);
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
  }, [engine, panel, notebookOpen, handPanelShown, pouring, prefs.panels, prefs.notebookWidth, viewport]);

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
      if (dropMode) {
        // Space: tap for one drop, hold to let it run; Enter: at the line; Esc: put the pipette down.
        const typing = e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "BUTTON");
        if (e.key === " " && !typing) {
          e.preventDefault();
          if (!e.repeat && spaceHold.current === undefined) spaceHold.current = window.setTimeout(() => { spaceHold.current = 0; startRun(); }, 300);
        } else if (e.key === "Enter" && !typing) {
          e.preventDefault();
          acceptAtLine();
        } else if (e.key === "Escape") {
          e.preventDefault();
          exitDropMode();
        }
        return;
      }
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
        // At an inversion step, Enter on the stoppered vessel inverts it once.
        if (selected && isInvertTarget(selected)) { player.recordEvidence(); e.preventDefault(); }
        else if (selected && scene.bench.some((item) => item.instanceId === selected)) { startMove(selected); e.preventDefault(); }
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
  // Show me (§5.9, guided only): frame the working set, then the engine's pulse-and-ghost demo. A
  // step done with a tool shows the tool going to the source, then to the target.
  const showMe = () => {
    setAutoView(true);
    frame();
    if (tool) engine?.showMe(toolId, expectedTargetId, expectedSourceId);
    else if (drawIds) engine?.showMe(drawIds.tool, drawIds.liquid);
    else engine?.showMe(expectedSourceId, expectedTargetId);
  };
  tapRef.current = (id, pointerType, x, y) => {
    // At an inversion step, a tap on the stoppered vessel (or its stopper) inverts it once.
    if (isInvertTarget(id)) {
      player.recordEvidence();
      return;
    }
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
  const hoverPoint = hoverItem && engine ? engine.labelPoint(hoverItem.instanceId) : undefined;
  const examinedItem = examined ? scene.bench.find((i) => i.instanceId === examined) : undefined;
  const n = Math.max(0, runtime.process.nodes.findIndex((node) => node.id === runtime.currentNode.id)) + 1;
  const N = runtime.process.nodes.length;
  const nbDot = showGuidance && flow.interaction?.type === "recordNotebook";
  // Blocking dialogs cancel an unfinished gesture and stop open-hand scrolling, as in 2D.
  const resultsOpen = player.complete && !confirmMode;
  const gestureBlocked = helpOpen || Boolean(confirmMode) || resultsOpen;
  useEffect(() => {
    if (!gestureBlocked) return;
    gestureBridge.cancel(true);
    gestureBridge.cancelScroll();
  }, [gestureBridge, gestureBlocked]);
  /**
   * As the 2D Reset does, stopping cancels an unfinished gesture and stops the camera tracks. The
   * engine is stopped only when it is not already off: stopping an unsupported engine reports
   * "Unavailable", which would open the panel after a Restart.
   */
  const stopHandControl = () => {
    gestureBridge.cancelScroll();
    gestureBridge.cancel(true);
    if (gesture.status !== "off") gesture.stop();
  };
  const startHandControl = () => {
    gestureBridge.resetRearm();
    void gesture.start();
  };
  /** Closing the panel stops the camera, so the camera never runs without its panel. */
  const closeHandPanel = () => {
    setHandPanelOpen(false);
    stopHandControl();
  };
  const toggleHandPanel = () => {
    if (handPanelShown) closeHandPanel();
    else setHandPanelOpen(true);
  };
  const clearTrayPreview = () => {
    trayGrabRef.current = undefined;
    setTrayGrab(undefined);
  };
  gestureBridge.host = {
    blocked: gestureBlocked,
    grabs: {
      begin: (grab, cursor) => {
        if (grab.kind === "bench") {
          carry.startGestureCarry(grab.instanceId);
        } else if (carry.startGestureTrayCarry(grab.definitionId)) {
          const preview = { definitionId: grab.definitionId, label: grab.label, offsetX: grab.gripX * TRAY_PREVIEW_PX,
            offsetY: grab.gripY * TRAY_PREVIEW_PX, x: cursor.clientX, y: cursor.clientY };
          trayGrabRef.current = preview;
          setTrayGrab(preview);
        }
        carry.gestureCarryTo(cursor.clientX, cursor.clientY);
      },
      move: (grab, cursor) => {
        const preview = trayGrabRef.current;
        if (grab.kind === "tray" && preview) {
          // The thumbnail follows by a direct transform; re-renders read the latest point.
          trayGrabRef.current = { ...preview, x: cursor.clientX, y: cursor.clientY };
          if (trayPreviewRef.current) trayPreviewRef.current.style.transform = `translate3d(${cursor.clientX - preview.offsetX}px, ${cursor.clientY - preview.offsetY}px, 0)`;
        }
        carry.gestureCarryTo(cursor.clientX, cursor.clientY);
      },
      release: (_grab, cursor) => {
        clearTrayPreview();
        carry.releaseGesture(cursor.clientX, cursor.clientY);
      },
      clear: () => {
        if (trayGrabRef.current) clearTrayPreview();
        carry.cancelGesture();
      },
    },
    onRearmChange: setHandRearm,
    resolver: createBenchGestureTargetResolver({
      canCarry: carry.canCarry,
      canPickUp: () => !player.pour && !player.weighing && !player.toolDeposit,
      canvas: () => engine?.canvasElement,
      hoverBenchItem: setHovered,
      pick: (clientX, clientY) => engine?.pick(clientX, clientY),
      root: () => playerRef.current,
      trayItem: (definitionId) => scene.tray.find((item) => item.definitionId === definitionId),
    }),
    scrollRoot: () => playerRef.current,
  };
  const shownTrayGrab = trayGrab ? trayGrabRef.current ?? trayGrab : undefined;
  const shownTrayThumb = shownTrayGrab ? thumbnailUrl(shownTrayGrab.definitionId) : undefined;

  const markStep = player.markStep;
  const markVesselLabel = markStep ? lowerFirstLetter(scene.bench.find((i) => i.instanceId === markStep.vesselInstanceId)?.label ?? "vessel") : "";
  const hint = dropMode ? "Space: tap for a drop, hold to let it run. Enter: at the line. Esc puts the pipette down."
    : carry.keyCarrying ? "Arrows move it (Shift: further). [ ] step through targets. Enter sets it down; Esc cancels."
    : carry.carrying ? "Release to set down. Esc cancels."
    : tool && flow.canConfirm ? "Dip the spatula into the source, then release it over the target; or use Source, Target and Confirm. Right-drag to look around."
    : pipette && flow.canConfirm ? "Carry the pipette by its tip and release it over the liquid or the cuvette; or use Source, Target and Confirm. Right-drag to look around."
    : markStep ? `Carry the pipette over the ${markVesselLabel} and release to hold it there, or use the step card. Right-drag to look around.`
    : invertVesselId ? "Tap the stoppered flask to invert it, or use Invert in the step card. Right-drag to look around."
    : flow.canConfirm ? "Drag items on the bench, or use Source, Target and Confirm. Right-drag to look around."
      : player.runtime.expectedAction?.parameters.balanceOperation === "zero" ? "Press TARE on the balance, or Tare in the step card. Right-drag to look around."
      : "Fill in the step card, then record. Right-drag to look around.";

  return (
    <div className={`s3d-player${reducedMotion ? " is-reduced-motion" : ""}${variant === "preview" ? " s3d-player--preview" : ""}`} ref={playerRef}>
      <header className="s3d-topbar">
        <span className="s3d-mark"><Icon name="flask" size={18} /></span>
        {simulationId && variant === "full" ? (
          <SimulationSwitcher currentId={simulationId} title={title} hasProgress={runtime.state.completedNodes.length > 0 && !player.complete}
            onLeave={stopHandControl} />
        ) : <span className="s3d-topbar__title">{title}</span>}
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

      <StepCard player={player} controls={panelControls} onShowMe={showMe}
        onHoldOver={markStep && !dropMode ? holdFromCard : undefined} holdOverReady={Boolean(markStep && onBenchNow(markStep.pipetteInstanceId) && onBenchNow(markStep.vesselInstanceId))} />
      {dropMode ? (
        <DropPanel title={`Pipette over the ${markVesselLabel || "vessel"}`} onDrop={() => addDrop(1)} onRunStart={startRun} onRunEnd={endRun}
          onAccept={acceptAtLine} onPutDown={exitDropMode} />
      ) : null}

      <BenchView
        scene={displayScene}
        options={options}
        onEngine={setEngine}
        label={`3D bench for ${title}. Every item is also listed in the Bench list.`}
        fallback={<div className="s3d-fallback"><p>This browser cannot draw the 3D bench. The 2D version runs the same steps and checks.</p><a className="s3d-button s3d-button--primary" href={fallbackHash}>Open the 2D version</a></div>}
      >
        {hoverItem && hoverPoint?.visible ? (
          <div className="s3d-label" style={{ left: hoverPoint.x, top: hoverPoint.y + 8 }}>{hoverItem.label} · {hoverItem.contentsText}</div>
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
            <Icon name={carry.callout.kind === "valid" ? "check" : carry.callout.kind === "invalid" ? "x" : carry.callout.kind === "input" ? "pencil" : "tray"} size={14} />{carry.callout.text}
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

      {panel === "tray" ? <EquipmentTray player={player} controls={panelControls} onPointerDownTile={carry.startTrayCarry}
        gestureGrabbedDefinitionId={trayGrab?.definitionId} /> : null}
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
      {handPanelShown ? <HandControlPanel gesture={gesture} rearmRequired={handRearm} controls={panelControls}
        onStart={startHandControl} onStop={stopHandControl} onClose={closeHandPanel} /> : null}

      <p className="s3d-hint">{hint}</p>
      <nav className="s3d-dock" aria-label="Player tools">
        <button type="button" className={panel === "tray" ? "is-on" : ""} onClick={() => setPanel(panel === "tray" ? "none" : "tray")}><Icon name="tray" size={20} />Tray</button>
        <button type="button" className={panel === "list" ? "is-on" : ""} onClick={() => setPanel(panel === "list" ? "none" : "list")}><Icon name="list" size={20} />Bench list</button>
        <button type="button" disabled={!selected} onClick={() => selected && examine(selected)}><Icon name="examine" size={20} />Examine</button>
        <span className="s3d-dock__sep" />
        <button type="button" className={handPanelShown ? "is-on" : ""} aria-expanded={handPanelShown} onClick={toggleHandPanel}><Icon name="hand" size={20} />Hand control</button>
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

      {player.toast ? <div className="s3d-toast" role="status"><Icon name={player.toastKind === "info" ? "info" : "check"} />{player.toast}</div> : null}
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
                if (confirmMode === "restart") {
                  stopHandControl();
                  player.restart();
                } else runtime.setMode(confirmMode);
                setConfirmMode(undefined);
                setMenuOpen(false);
              }}>{confirmMode === "restart" ? "Restart" : "Switch"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {player.complete && !confirmMode ? <ResultsSheet player={player} onPlayAgain={() => setConfirmMode("restart")} backHref={backHref} /> : null}
      {helpOpen ? <HelpDialog onClose={() => setHelpOpen(false)} /> : null}

      <GestureCursorOverlay blocked={gestureBlocked} bridge={gestureBridge} enabled={gesture.enabled} frames={gesture.frames} />
      {shownTrayGrab ? (
        <span ref={trayPreviewRef} aria-hidden="true" className="gesture-drag-preview s3d-gesture-preview" data-gesture-drag-preview="true"
          style={{ left: 0, top: 0, width: TRAY_PREVIEW_PX, height: TRAY_PREVIEW_PX,
            transform: `translate3d(${shownTrayGrab.x - shownTrayGrab.offsetX}px, ${shownTrayGrab.y - shownTrayGrab.offsetY}px, 0)` }}>
          {shownTrayThumb
            ? <img src={shownTrayThumb} alt="" width={TRAY_PREVIEW_PX} height={TRAY_PREVIEW_PX} draggable={false} />
            : <span className="gesture-drag-preview-label">{shownTrayGrab.label}</span>}
        </span>
      ) : null}
    </div>
  );
};
