import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RuntimeDefinition } from "../../runtime";
import { BenchView } from "../bench/BenchView";
import { safeRects } from "../bench/camera/benchCamera";
import type { BenchEngine, CameraPose, GraphicsQuality } from "../bench/BenchEngine";
import { arrowDirection, spatialNeighbour } from "../bench/input/keyboard";
import { useBenchCarry } from "../bench/input/useBenchCarry";
import { Icon } from "../ui/Icon";
import type { HandTarget } from "../hand/handController";
import { handSettings } from "../hand/handTuning";
import { useHandControl } from "../hand/useHandControl";
import { HandControlPanel, HandCursorRing, type HandGuideContext } from "./HandControlPanel";
import { MOVABLE_FROM_WIDTH, sanitizeLayout, type PanelId, type PanelLayout, type PanelState } from "./panelLayout";
import { BenchList, ExamineCard, HelpDialog, NOTEBOOK_WIDTH, NotebookSheet, ResultsSheet, type PanelControls } from "./panels";
import { SimulationSwitcher } from "./SimulationSwitcher";
import { DropPanel } from "./DropPanel";
import { StepCard } from "./StepCard";
import { StepClock } from "./StepClock";
import { guideItemId } from "../adapters/guideTargets";
import { drawnItem, fillLevelMm } from "../adapters/runtimeToScene";
import { readingVesselId } from "./stepRules";
import { usePlayer3D, type Player3DController } from "./usePlayer3D";
import type { Lab3DPartLabel } from "../labs3d";

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

/** Under reduced motion, how long a filter's portion takes to drain before the next can go in (the drawn drain's time). */
const REDUCED_MOTION_DRAIN_MS = 2600;

export const Player3D = ({ definition, authoredDefinition, title, sourceTag, fallbackHash, backHref, variant = "full", focusNodeId, focusVersion, onPlayer, simulationId, parts }: {
  definition: RuntimeDefinition;
  /** The definition before teacher setup, for provenance chips (see usePlayer3D). */
  authoredDefinition?: RuntimeDefinition;
  title: string;
  sourceTag: string;
  /** The 2D route that plays the same steps; none for a 3D practice version whose original is not known yet. */
  fallbackHash?: string;
  backHref: string;
  /** "preview": inside the Studio's stage (handoff §4.6), which supplies its own toolbar. */
  variant?: "full" | "preview";
  focusNodeId?: string;
  focusVersion?: number;
  /** The Studio's preview toolbar drives restart, mode and step through the controller. */
  onPlayer?: (player: Player3DController) => void;
  /** A standalone technique: its title opens the switcher between the 3D simulations. */
  simulationId?: string;
  /** A 3D experiment (D8): each compiled node's part, which the step card names. */
  parts?: ReadonlyMap<string, Lab3DPartLabel>;
}) => {
  const player = usePlayer3D(definition, "guided", authoredDefinition, { nodeId: focusNodeId, version: focusVersion });
  // The Studio's preview Restart also stops the camera tracks, as the player's own Restart does.
  useEffect(() => { onPlayer?.({ ...player, restart: () => { stopHandControl(); player.restart(); } }); });
  const { runtime, scene, flow, showGuidance } = player;
  const [engine, setEngine] = useState<BenchEngine>();
  const [prefs, setPrefs] = useState(readPrefs);
  // Nothing opens at the start: the shelf is on the bench, and the dock opens the Bench list (decided 2026-10-11).
  const [panel, setPanel] = useState<"list" | "none">("none");
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
  const tapRef = useRef<(id: string, pointerType: string, x: number, y: number) => boolean | void>(() => undefined);
  const onTap = useCallback((id: string, pointerType: string, x: number, y: number) => tapRef.current(id, pointerType, x, y), []);
  // A control on an instrument, the balance's TARE key (decided 2026-09-25): see controlRef below.
  const controlRef = useRef<(instanceId: string, controlId: string) => void>(() => undefined);
  const onControl = useCallback((instanceId: string, controlId: string) => controlRef.current(instanceId, controlId), []);
  // Drop mode (decided 2026-10-02): a pipette held over a vessel while liquid goes in a drop at a time.
  const holdOverRef = useRef<(pipetteId: string, vesselId: string) => void>(() => undefined);
  const onHoldOver = useCallback((pipetteId: string, vesselId: string) => holdOverRef.current(pipetteId, vesselId), []);
  // While hand control runs, mouse moves are ignored (a mouse press or the wheel stops the camera).
  const handRunningRef = useRef(false);
  // A press while a committed animation is drawn: the oven is not opened before a drying stage is up.
  const busyRef = useRef<(instanceId: string) => void>(() => undefined);
  const onBusyPress = useCallback((instanceId: string) => busyRef.current(instanceId), []);
  const carry = useBenchCarry(engine, player, setHovered, onTap, onControl, onHoldOver, () => handRunningRef.current, onBusyPress);
  const carryCancelRef = useRef(carry);
  carryCancelRef.current = carry;
  const carryingRef = useRef(carry.carrying);
  carryingRef.current = carry.carrying;

  // Hand control (decided 2026-10-03/04, `proposals/MICROARRAY_ADOPTION.md` §7–8): the DNA microarray
  // lab's webcam pipeline and controller (src/studio3d/hand/), carrying through the bench's own carry.
  // The 2D player's gesture engine and bridge are not used in 3D.
  const lastHandClient = useRef({ x: 0, y: 0 });
  const handButtons = useRef(new Map<string, HTMLElement>());
  const handFocus = useRef<{ id?: string; locked: boolean }>({ locked: false });
  const gestureBlockedRef = useRef(false);
  // The dock button opens the panel; the camera starts only from the panel. While it runs the panel stays shown.
  const [handPanelOpen, setHandPanelOpen] = useState(false);
  /**
   * Hand targets in canvas pixels (screen-space, as the microarray lab picks): bench items and instrument keys, the
   * items on the shelf and the side station where they are drawn (the shelf in place of the tray, decided
   * 2026-10-11; a shelf item's keys are not pressed until it is on the bench), and hand buttons.
   */
  const handTargets = (): HandTarget[] => {
    const canvas = engine?.canvasElement;
    if (!engine || !canvas) return [];
    const rect = canvas.getBoundingClientRect();
    const onBench = new Set(scene.bench.map((item) => item.instanceId));
    const onShelf = new Map(scene.tray.map((item) => [item.instanceId, item]));
    const out: HandTarget[] = [];
    for (const t of engine.screenTargets()) {
      const shelfItem = onShelf.get(t.instanceId);
      if (shelfItem && !t.controlId) out.push({ id: t.instanceId, kind: "shelf", x: t.x, y: t.y, r: t.r, instanceId: t.instanceId, definitionId: shelfItem.definitionId });
      if (!onBench.has(t.instanceId)) continue;
      out.push(t.controlId
        ? { id: `control:${t.instanceId}:${t.controlId}`, kind: "control", x: t.x, y: t.y, r: t.r, instanceId: t.instanceId, controlId: t.controlId }
        : { id: t.instanceId, kind: "item", x: t.x, y: t.y, r: t.r, instanceId: t.instanceId });
    }
    const box = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2 - rect.left, y: b.top + b.height / 2 - rect.top, r: Math.min(b.width, b.height) / 3 };
    };
    handButtons.current.clear();
    for (const button of playerRef.current?.querySelectorAll<HTMLElement>("[data-hand-press]") ?? []) {
      const id = `button:${button.dataset.handPress}`;
      handButtons.current.set(id, button);
      out.push({ id, kind: "button", ...box(button) });
    }
    return out;
  };
  const hand = useHandControl({
    bounds: () => ({ width: engine?.canvasElement.clientWidth || 1, height: engine?.canvasElement.clientHeight || 1 }),
    blocked: () => gestureBlockedRef.current,
    targets: handTargets,
    // Aim assist snaps to the step's next target: guidance, so guided mode only (G-7).
    expectedId: () => (!showGuidance ? undefined : carryingRef.current ? expectedTargetId : tool ? toolId : expectedSourceId),
    assist: () => showGuidance && handSettings().assist,
    carrying: () => carryingRef.current,
    pickUpItem: (instanceId) => carry.startGestureCarry(instanceId),
    // A shelf item is taken through the tray's own carry; the item itself follows the hand (useBenchCarry).
    pickUpShelf: (definitionId, instanceId) => carry.startGestureTrayCarry(definitionId, instanceId),
    aimCarry: (x, y) => {
      const rect = engine?.canvasElement.getBoundingClientRect();
      if (!rect) return undefined;
      const cx = rect.left + x, cy = rect.top + y;
      lastHandClient.current = { x: cx, y: cy };
      carry.gestureCarryTo(cx, cy);
      return carry.gestureAction();
    },
    carryDepth: (depth) => carry.gestureDepth(depth),
    commitCarry: () => carry.releaseGesture(lastHandClient.current.x, lastHandClient.current.y),
    cancelCarry: () => carry.cancelGesture(),
    loadTool: () => carry.loadGestureTool(),
    pressControl: (t) => { if (t.instanceId && t.controlId) onControl(t.instanceId, t.controlId); },
    pressButton: (t) => handButtons.current.get(t.id)?.click(),
    invertTarget: (instanceId) => isInvertTarget(instanceId),
    // Only while the step is current: a hand still turning or circling never acts on the next step.
    invert: () => { if (invertVesselId) player.recordEvidence(); },
    swirlTarget: (instanceId) => isSwirlTarget(instanceId) || isStirTarget(instanceId),
    // A closed hand moved in a circle swirls the flask, or stirs with the rod (Pack 2).
    swirl: () => { if (swirlVesselId || stirVesselId) player.recordEvidence(); },
    dropMode: () => Boolean(dropMode),
    drop: () => addDropRef.current(1),
    squirtMode: () => squirtHeldRef.current,
    squirt: () => squirtAgainRef.current(),
    runDrops: (on) => (on ? startRun() : endRun()),
    // The hand's focus shows the item's hover label, as the source labels the target under the cursor.
    focus: (t, locked) => {
      if (handFocus.current.id === t?.id && handFocus.current.locked === locked) return;
      handFocus.current = { id: t?.id, locked };
      if (!carryingRef.current) setHovered(t?.kind === "item" || t?.kind === "shelf" ? t.instanceId : undefined);
    },
    // A technique mistake (bubbles, a stroke left short) shows in the correction block; it is not a runtime attempt.
    say: (text, error, recovery) => (error ? player.correct(text, recovery ?? "") : player.notify(text)),
  });
  const handPanelShown = handPanelOpen || hand.state.running;
  handRunningRef.current = hand.state.running;
  const handStopRef = useRef({ running: false, stop: () => undefined as void });

  // While a committed pour animates, the bench shows the committed layout with the pour's contents
  // not yet moved (pourStagingScene); when it ends, the committed scene (G-3).
  // Under reduced motion the pour is skipped (§3.5: levels jump to the committed state), so nothing
  // is staged: a shelf source must not be shown off its spot for a frame.
  // A committed swirl is staged the same way: the vessel holds what it held until the swirl is drawn.
  const displayScene = player.pour && !reducedMotion ? player.pour.staging
    : player.swirl && !reducedMotion ? player.swirl.staging
    : player.benchOpRun && !reducedMotion ? player.benchOpRun.staging : scene;
  useEffect(() => {
    const pour = player.pour;
    if (!pour) return;
    if (reducedMotion) {
      // Nothing is drawn, but a filter still takes its time to drain: the next portion waits for it as
      // it does when the drain is drawn (decided 2026-10-06).
      if (!pour.drainInto) { player.finishPour(pour.id); return; }
      const drained = window.setTimeout(() => player.finishPour(pour.id), REDUCED_MOTION_DRAIN_MS);
      return () => window.clearTimeout(drained);
    }
    if (!engine) return;
    // A source poured from where it stands on the shelf is staged on its shelf spot (pourStagingScene).
    const staged = (id: string) => drawnItem(pour.staging, id);
    const committed = (id: string) => scene.bench.find((i) => i.instanceId === id);
    const source = staged(pour.sourceId);
    const target = staged(pour.targetId);
    // Where the source rests afterwards (parked after a drag); a shelf source goes back to its spot on the shelf.
    const sourceAfter = committed(pour.sourceId);
    // A squirt short of a counted rinse's count keeps the bottle held for the next (decided 2026-10-05).
    const rinse = runtime.expectedAction;
    const portions = rinse?.verb === "rinse" ? Number(rinse.parameters.rinsePortions ?? 1) : 1;
    const squirted = rinse ? runtime.state.rinsePortions?.[rinse.id] ?? 0 : 0;
    const holdAfter = portions > 1 && squirted > 0 && squirted < portions && !flow.nodeCompleted;
    const continuing = engine.squirtHolding() === pour.sourceId;
    const run = async () => {
      try {
        await draw();
      } catch { /* the end state is drawn by the next sync */ } finally {
        // Drawn or not (a model that failed to load), the pour ends, so the bench and the filter are never left waiting.
        setSquirtHeld(holdAfter && engine.squirtHolding() === pour.sourceId);
        player.finishPour(pour.id);
      }
    };
    const draw = async () => {
      await engine.sync(pour.staging);
      // The pour is framed where it happens, unless the learner has taken the camera (§5.9) or the
      // bottle is already held there.
      if (autoViewRef.current && !reducedMotion && !continuing) engine.frameItems([pour.sourceId, pour.targetId, ...(pour.via ? [pour.via] : [])], 1.4);
      // A reagent portion goes in while the rod standing in the beaker stirs it (Pack 2, decided 2026-10-05).
      if (pour.stir) void engine.animateStir(pour.targetId, 2.8);
      if (source && target) {
        await engine.animatePour({ sourceId: pour.sourceId, targetId: pour.targetId,
          sourceBefore: source.contents, sourceAfter: pour.sourceAfter,
          targetBefore: target.contents, targetAfter: pour.targetAfter,
          // The source is set down where the runtime has it afterwards (parked after a drag).
          ...(sourceAfter?.placement.kind === "bench" ? { returnTo: sourceAfter.placement.point } : {}),
          ...(pour.via ? { via: pour.via } : {}), holdAfter,
          // A measuring cylinder is held over the beaker for a few seconds so it drains (decided 2026-10-05).
          ...(pour.drain ? { drainS: 2.4 } : {}),
          // Poured down the stirring rod into the filter (decided 2026-10-05).
          ...(pour.drainInto?.guideRodId ? { guideRodId: pour.drainInto.guideRodId } : {}) });
      }
      // The filter drains into the flask before the next portion can go in.
      if (pour.drainInto) {
        await engine.animateDrain({ funnelId: pour.targetId, cone: pour.targetAfter, receiverId: pour.drainInto.receiverId,
          receiverBefore: pour.drainInto.receiverBefore, receiverAfter: pour.drainInto.receiverAfter });
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.pour?.id, engine]);

  // A committed swirl (decided 2026-10-04): the flask is drawn swirling, its undissolved solid clearing
  // in the last turn. Under reduced motion the end state is shown at once (§3.5).
  useEffect(() => {
    const swirl = player.swirl;
    if (!swirl) return;
    if (reducedMotion || !engine) { player.finishSwirl(swirl.id); return; }
    void engine.sync(swirl.staging)
      .then(() => engine.animateSwirl(swirl.vesselId, { before: swirl.before, after: swirl.after }))
      .then(() => player.finishSwirl(swirl.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.swirl?.id, engine]);

  // A committed bench operation (Pack 2, decided 2026-10-05): the rod stirs, or the precipitate settles,
  // while the fast step clock runs the stated minutes; or the dropping pipette is held over the beaker and
  // one drop falls. Under reduced motion the end state is shown at once (§3.5); the clock still runs.
  useEffect(() => {
    const run = player.benchOpRun;
    if (!run) return undefined;
    if (reducedMotion || !engine) { player.finishBenchOp(run.id); return undefined; }
    const timed = run.clockSeconds !== undefined;
    let drawing = true;
    const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const draw = async () => {
      await engine.sync(run.staging);
      // Drawn over what is left of the clock, so the bench and the clock end together.
      const seconds = run.clockSeconds !== undefined
        ? Math.max(0.1, run.clockSeconds - (performance.now() - (run.startedAt ?? performance.now())) / 1000) : 3;
      if (run.operation === "stir") await engine.animateStir(run.vesselId, seconds);
      // The solvent climbs the strip and carries the dyes up with it (Pack 3a).
      else if (run.operation === "develop" && run.strip) await engine.animateStripDevelop(run.vesselId, run.strip, seconds);
      else if (run.operation === "settle-precipitate" || run.operation === "dry-in-oven" || run.operation === "cool-on-pad"
        || run.operation === "heat-crucible") {
        await engine.animateContentsChange(run.vesselId, { before: run.before, after: run.after }, seconds);
      }
      else if (run.toolId) {
        engine.holdOver(run.toolId, run.vesselId);
        await pause(700);
        engine.dropFromHeld();
        await pause(900);
        engine.holdOver(null);
      }
    };
    void draw().catch(() => undefined).finally(() => {
      drawing = false;
      // A timed stage ends with its clock (usePlayer3D); anything else ends here, drawn or not, so a model
      // that failed to load never leaves the bench waiting.
      if (!timed) player.finishBenchOp(run.id);
    });
    // The clock ran out first (a tab in the background), or the bench was restarted: the drawing stops,
    // and the next sync draws the bench as the runtime has it, never this stage's end on a reset bench.
    return () => { if (drawing) engine.cancelTimedAnimation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.benchOpRun?.id, engine]);

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
  // The instance the step names, else the first of its kind; one still on the shelf is marked on its tier
  // (the shelf in place of the tray, decided 2026-10-11; guideItemId).
  const present = useMemo(() => [...scene.bench, ...scene.tray], [scene]);
  const expectedSourceId = useMemo(() => guideItemId(scene, flow.source.definitionId, flow.source.instanceId),
    [flow.source.definitionId, flow.source.instanceId, scene]);
  const expectedTargetId = useMemo(() => guideItemId(scene, flow.target.definitionId, flow.target.instanceId, expectedSourceId),
    [expectedSourceId, flow.target.definitionId, flow.target.instanceId, scene]);
  const tool = player.toolTransfer;
  const toolId = useMemo(() => (tool ? guideItemId(scene, tool.toolDefinitionId) : undefined), [scene, tool]);
  // A draw into a pipette (decided 2026-09-26): the pipette first, then the liquid it draws from.
  const pipette = player.pipetteStep;
  const drawn = (id?: string) => (id && present.some((i) => i.instanceId === id) ? id : undefined);
  const drawIds = pipette?.kind === "draw" ? { tool: drawn(pipette.toolInstanceId), liquid: drawn(pipette.otherInstanceId) } : undefined;
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
    if (flow.nodeCompleted) return undefined;
    // The drying oven's dial at the setting step, its door at a door or drying step (Pack 2).
    const oven = player.benchOp?.deviceInstanceId;
    const ovenOperation = player.benchOp?.operation === "set-oven-temperature" ? "set-temperature"
      : ["open-oven-door", "close-oven-door", "dry-in-oven"].includes(player.benchOp?.operation ?? "") ? "door" : undefined;
    if (oven && ovenOperation) {
      const control = scene.bench.find((item) => item.instanceId === oven)?.model?.controls?.find((c) => c.operation === ovenOperation);
      return control ? { instanceId: oven, controlId: control.id } : undefined;
    }
    const instanceId = parameters?.instrumentInstanceId;
    if (parameters?.balanceOperation !== "zero" || typeof instanceId !== "string") return undefined;
    const control = scene.bench.find((item) => item.instanceId === instanceId)?.model?.controls?.find((c) => c.operation === "zero");
    return control ? { instanceId, controlId: control.id } : undefined;
  }, [flow.nodeCompleted, player.benchOp, runtime.expectedAction, scene]);
  // Guided only (G-7): the key the step asks for is lit; not while the step clock runs, when it must wait.
  const clockRunning = Boolean(player.stepClock);
  useEffect(() => {
    engine?.setControlCue(showGuidance && expectedControl && !clockRunning ? expectedControl : null);
  }, [clockRunning, engine, expectedControl, showGuidance, displayScene]);
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
  // A level past a graduation drawn back (decided 2026-10-10): the tip goes just under the surface first, the
  // bulb is eased once it is in, and the pipette rises back over the line soon after the last of it. Putting the
  // pipette down tells a dip still on its way that it never arrived, so nothing more is drawn.
  const backRun = useRef<number | undefined>(undefined); // -1 while the tip goes in; then the run's interval
  const backLift = useRef<number | undefined>(undefined);
  const drawBackRef = useRef(player.drawBack);
  drawBackRef.current = player.drawBack;
  const dipIn = () => {
    window.clearTimeout(backLift.current);
    return engine?.dipHeld(true) ?? Promise.resolve(true);
  };
  const liftAfter = (ms: number) => {
    window.clearTimeout(backLift.current);
    backLift.current = window.setTimeout(() => { backLift.current = undefined; void engine?.dipHeld(false); }, ms);
  };
  const drawBackTap = () => {
    if (backRun.current !== undefined) return;
    void dipIn().then((arrived) => {
      if (!arrived || backRun.current !== undefined) return;
      drawBackRef.current(1);
      liftAfter(450);
    });
  };
  // A run ends by itself once the pipette is full or a draw is refused, so a press still held asks no more.
  const backRunStep = () => { if (!drawBackRef.current(3)) endBackRun(); };
  const startBackRun = () => {
    if (backRun.current !== undefined) return;
    backRun.current = -1;
    void dipIn().then((arrived) => {
      if (!arrived || backRun.current !== -1) return;
      backRunStep();
      if (backRun.current === -1) backRun.current = window.setInterval(backRunStep, 140);
    });
  };
  const endBackRun = () => {
    if (backRun.current === undefined) return;
    window.clearInterval(backRun.current);
    backRun.current = undefined;
    liftAfter(300);
  };
  // Only refs: the first render's copy clears what a later one started.
  const stopDrawBack = () => {
    window.clearInterval(backRun.current);
    window.clearTimeout(backLift.current);
    backRun.current = backLift.current = undefined;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stopDrawBack, []);
  // The view from before the eye-level view at the line, returned to when the pipette is put down.
  const dropPose = useRef<(CameraPose & { auto: boolean }) | undefined>(undefined);
  const exitDropMode = () => {
    endRun();
    stopDrawBack();
    setDropMode(undefined);
    engine?.holdOver(null);
    const before = dropPose.current;
    dropPose.current = undefined;
    if (engine && before) {
      engine.restorePose(before);
      setAutoView(before.auto);
      autoViewRef.current = before.auto;
    }
  };
  const acceptAtLine = () => {
    endRun();
    endBackRun();
    player.acceptMark();
  };
  holdOverRef.current = (pipetteId, vesselId) => {
    const mark = player.markStep;
    if (!engine || !mark) return;
    setDropMode({ pipetteId, vesselId });
    if (!dropPose.current) dropPose.current = { ...engine.pose(), auto: autoViewRef.current };
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
  // A wash bottle held over what it rinses between the squirts of a counted rinse (decided 2026-10-05):
  // a click on the bench, Space, Enter, the step card's Rinse or a hand squeeze is the next squirt; Esc
  // or leaving the step puts it down. Nothing else is picked up while it is held.
  const [squirtHeld, setSquirtHeld] = useState(false);
  const squirtHeldRef = useRef(false);
  squirtHeldRef.current = squirtHeld;
  const rinseAction = runtime.expectedAction?.verb === "rinse" && Number(runtime.expectedAction.parameters.rinsePortions ?? 1) > 1
    ? runtime.expectedAction : undefined;
  const squirtCount = rinseAction
    ? { done: runtime.state.rinsePortions?.[rinseAction.id] ?? 0, total: Number(rinseAction.parameters.rinsePortions) } : undefined;
  const putBottleDown = () => {
    setSquirtHeld(false);
    engine?.releaseSquirtHold();
  };
  const squirtAgainRef = useRef(() => undefined as void);
  squirtAgainRef.current = () => {
    if (!squirtHeldRef.current || player.pour || flow.nodeCompleted) return;
    player.confirm();
  };
  // Leaving the step another way (a restart, a mode switch) puts the bottle down; the last squirt's own
  // animation sets it down after the count is complete, so nothing is released while a squirt is drawn.
  useEffect(() => {
    if (squirtHeld && !player.pour && (!rinseAction || flow.nodeCompleted)) putBottleDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squirtHeld, rinseAction?.id, flow.nodeCompleted, player.pour]);
  useEffect(() => {
    if (!squirtHeld || !engine) return undefined;
    const canvas = engine.canvasElement;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      squirtAgainRef.current();
    };
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(e.target.tagName);
      if (typing) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) squirtAgainRef.current();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        putBottleDown();
      }
    };
    canvas.addEventListener("pointerdown", down, { capture: true });
    window.addEventListener("keydown", key, { capture: true });
    return () => {
      canvas.removeEventListener("pointerdown", down, { capture: true });
      window.removeEventListener("keydown", key, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squirtHeld, engine]);
  // A count within a step, said aloud: a squirt or an inversion short of the count (decided 2026-10-05).
  const lastCounts = useRef<Record<string, number>>({});
  useEffect(() => {
    const counts = { ...runtime.state.rinsePortions, ...runtime.state.mixInversions };
    const before = lastCounts.current;
    lastCounts.current = counts;
    const action = runtime.expectedAction;
    if (!action) return;
    const done = counts[action.id] ?? 0;
    if (done <= (before[action.id] ?? 0)) return;
    if (action.verb === "rinse" && squirtCount && done < squirtCount.total) player.announce(`Squirt ${done} of ${squirtCount.total}.`);
    if (action.verb === "mix" && action.parameters.mixOperation === "invert") {
      const total = Number(action.parameters.inversions ?? 10);
      if (done < total) player.announce(`Inversion ${done} of ${total}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.state.rinsePortions, runtime.state.mixInversions]);

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
  // Swirling to dissolve (decided 2026-10-04): a tap on the flask, Enter on it, the step card's Swirl,
  // or a closed hand moved in a circle swirls it once, which dissolves the solid in it.
  const swirlParams = runtime.expectedAction?.verb === "dissolve" && runtime.expectedAction.parameters.mixOperation === "swirl" && !flow.nodeCompleted
    ? runtime.expectedAction.parameters : undefined;
  const swirlVesselId = typeof swirlParams?.targetInstanceId === "string" ? swirlParams.targetInstanceId : undefined;
  const isSwirlTarget = (id: string): boolean => Boolean(swirlVesselId) && id === swirlVesselId;
  // Stirring with the rod (Pack 2): a click on the beaker or the rod standing in it, Enter on either,
  // the step card's Stir, or a closed hand moved in a circle.
  const stirVesselId = player.benchOp?.operation === "stir" ? player.benchOp.vesselInstanceId : undefined;
  // A drying stage's time on the clock (Pack 2 decision 9): the oven is not opened before it is up.
  const refuseEarlyOpen = (instanceId: string): boolean => {
    const clock = player.stepClock;
    if (clock?.operation !== "dry-in-oven" || scene.bench.find((i) => i.instanceId === instanceId)?.definitionId !== "drying-oven") return false;
    player.correct(`The ${clock.minutes} minutes are not up yet.`, "Leave the door shut until the clock has run, then open it.");
    return true;
  };
  // A timed stage being drawn, or its minutes still on the clock: the bench's own shortcuts wait too.
  const benchBusy = Boolean(player.benchOpRun || player.stepClock);
  busyRef.current = (instanceId) => { refuseEarlyOpen(instanceId); };
  // The oven's door by a click on the oven at a door or drying step (its door key and dial are controls too).
  const ovenDoorStep = player.benchOp && ["open-oven-door", "close-oven-door", "dry-in-oven"].includes(player.benchOp.operation)
    ? player.benchOp.deviceInstanceId : undefined;
  const isOvenTarget = (id: string): boolean => Boolean(ovenDoorStep) && id === ovenDoorStep;
  // The Bunsen burner (Heat and Reweigh): a click on it lights it, opens its air collar, starts the heating or
  // turns it off, as the step says; a click on the crucible sets its lid askew.
  const burnerOperation = player.benchOp && ["light-burner", "set-flame", "heat-crucible", "turn-off-burner"].includes(player.benchOp.operation)
    ? player.benchOp : undefined;
  const isBurnerTarget = (id: string): boolean => Boolean(burnerOperation) && !benchBusy
    && (id === burnerOperation!.deviceInstanceId || (burnerOperation!.operation === "heat-crucible" && id === burnerOperation!.vesselInstanceId));
  const isLidTarget = (id: string): boolean => player.benchOp?.operation === "set-crucible-lid" && id === player.benchOp.vesselInstanceId;
  // The developing chamber (Pack 3a): a click on it, or on the strip hung in it, lowers the strip in and seats the lid,
  // lifts the lid with the strip, or leaves it closed to develop, as the step says.
  const chrom = player.chromStep;
  const chamberStepId = chrom && !benchBusy ? (chrom.operation === "closeChamber" || chrom.operation === "openChamber" ? chrom.targetInstanceId
    : chrom.operation === "develop" ? chrom.chamberInstanceId : undefined) : undefined;
  const isChamberTarget = (id: string): boolean => {
    if (!chamberStepId) return false;
    const item = scene.bench.find((i) => i.instanceId === id);
    return id === chamberStepId || (item?.placement.kind === "seated" && item.placement.parentInstanceId === chamberStepId);
  };
  // Folding the filter paper (Pack 2): a click on it once it is on the bench, Enter on it, or the step card's Fold.
  const foldPaperId = player.benchOp?.operation === "fold-filter-paper" ? player.benchOp.toolInstanceId : undefined;
  const isFoldTarget = (id: string): boolean => Boolean(foldPaperId) && id === foldPaperId
    && scene.bench.find((i) => i.instanceId === id)?.placement.kind === "bench";
  const isStirTarget = (id: string): boolean => {
    if (!stirVesselId || benchBusy) return false;
    const item = scene.bench.find((i) => i.instanceId === id);
    return id === stirVesselId || (item?.placement.kind === "seated" && item.placement.parentInstanceId === stirVesselId);
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
    const operation = scene.bench.find((item) => item.instanceId === instanceId)?.model?.controls?.find((c) => c.id === controlId)?.operation;
    // The oven (Pack 2): its door is not opened before a drying stage's time is up.
    if (operation === "door" || operation === "set-temperature") {
      if (refuseEarlyOpen(instanceId)) return;
      if (expectedControl?.instanceId === instanceId && expectedControl.controlId === controlId) {
        if (flow.canRecordObservation || flow.canRecord) player.recordEvidence();
        else player.notify(operation === "set-temperature" ? "Enter the setting in the step card, then turn the dial." : "Not yet: finish the step card first.");
        return;
      }
      player.notify(operation === "door" ? "The oven door stays as it is at this step." : "The oven's setting stays as it is at this step.");
      return;
    }
    engine?.pressControl(instanceId, controlId);
    if (expectedControl?.instanceId === instanceId && expectedControl.controlId === controlId && (flow.canRecord || flow.canRecordObservation)) {
      player.recordEvidence();
      return;
    }
    const label = scene.bench.find((item) => item.instanceId === instanceId)?.model?.controls?.find((c) => c.id === controlId)?.label ?? "Key";
    player.notify(`${label} pressed. Nothing is zeroed at this step.`);
  };
  // A tool deposit ends with the tool back where the runtime keeps it, so the ring follows it there.
  // While an item is carried its ring is not drawn at the spot it was lifted from.
  useEffect(() => { engine?.setSelected(carry.carrying ? null : selected ?? null); }, [engine, selected, displayScene, player.toolDeposit, carry.carrying]);

  // Auto-framing on a new step: the working set in guided mode, the whole bench in assessment (§5.9).
  // It fits the free area left by the open panels, wherever they have been moved, and never moves
  // the camera during a carry.
  const frame = useCallback(() => {
    if (!engine || carryingRef.current) return;
    // The free stage around every open panel, above the hint and dock (the microarray lab's safeRects).
    const canvasRect = engine.canvasElement.getBoundingClientRect();
    const rel = (el: Element | null | undefined) => {
      if (!el || (el as HTMLElement).offsetParent === null) return undefined;
      const b = el.getBoundingClientRect();
      return { left: b.left - canvasRect.left, top: b.top - canvasRect.top, right: b.right - canvasRect.left, bottom: b.bottom - canvasRect.top };
    };
    const root = playerRef.current;
    const obstacles = [...(root?.querySelectorAll("[data-panel], .s3d-examine, .s3d-sheet, .s3d-drop") ?? [])].map(rel).filter((r) => r !== undefined);
    const below = [rel(root?.querySelector(".s3d-hint")), rel(root?.querySelector(".s3d-dock"))].filter((r) => r !== undefined).map((r) => r.top);
    engine.safeAreas = safeRects({ w: canvasRect.width, h: canvasRect.height }, obstacles, below.length ? Math.min(...below) : canvasRect.height);
    // A reading of a vessel's level is taken with the eye level with the liquid (stepRules.readingVesselId).
    const readId = readingVesselId(runtime.expectedAction, runtime.state.measurements);
    const read = readId ? scene.bench.find((i) => i.instanceId === readId) : undefined;
    if (read?.model?.fill && read.contents.kind === "liquid") {
      engine.eyeLevel(read.instanceId, fillLevelMm(read.model.fill, read.contents.volumeMl).levelMm, 0.2);
      return;
    }
    const toolDef = player.toolTransfer?.toolDefinitionId;
    // A step's named instance alone, when it is on the bench; else every item of the kind. One not yet on the bench
    // is framed where it stands on the shelf, the first of its kind there (the shelf in place of the tray, 2026-10-11).
    const ends = (definitionId?: string, instanceId?: string): string[] => {
      if (instanceId && scene.bench.some((i) => i.instanceId === instanceId)) return [instanceId];
      const out = scene.bench.filter((i) => i.definitionId === definitionId).map((i) => i.instanceId);
      if (out.length) return out;
      const shelf = scene.tray.find((i) => (instanceId ? i.instanceId === instanceId : i.definitionId === definitionId));
      return shelf ? [shelf.instanceId] : [];
    };
    const working = new Set(showGuidance
      ? [...ends(flow.source.definitionId, flow.source.instanceId), ...ends(flow.target.definitionId, flow.target.instanceId), ...(toolDef ? ends(toolDef) : [])]
      : []);
    // A bench operation (Pack 2) frames what it is done to and with.
    const benchOp = player.benchOp;
    if (showGuidance && benchOp) {
      for (const id of [benchOp.vesselInstanceId, benchOp.toolInstanceId]) if (id && [...scene.bench, ...scene.tray].some((i) => i.instanceId === id)) working.add(id);
    }
    for (const item of scene.bench) {
      if (working.has(item.instanceId) && item.placement.kind === "seated") working.add(item.placement.parentInstanceId);
    }
    engine.frameItems(working.size ? [...working] : "all", working.size ? 1.6 : 1.05);
  }, [engine, flow.source.definitionId, flow.source.instanceId, flow.target.definitionId, flow.target.instanceId, player.benchOp, player.toolTransfer, runtime.expectedAction, runtime.state.measurements, scene, showGuidance]);
  useEffect(() => {
    if (runtime.currentNode.id !== lastNode.current) {
      lastNode.current = runtime.currentNode.id;
      player.announce(`${runtime.currentNode.title}. ${runtime.currentNode.description}`);
    }
  }, [player, runtime.currentNode]);
  // Framing waits for the bench to settle: a step often brings an item off the tray, and its bounds
  // exist only once its model has loaded. While a committed pour animates, the bench still shows
  // the scene from before it, so framing also waits for the pour to finish. A view the learner has
  // set is kept through new steps until they choose Auto view again (decided 2026-10-05; it no
  // longer ends at each step, §5.9).
  // A committed pour, weighing or tool transfer being drawn holds the framing back, as a carry does (§5.9).
  const pouring = Boolean(player.pour || player.weighing || player.toolDeposit || player.swirl || player.benchOpRun);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const autoViewRef = useRef(autoView);
  autoViewRef.current = autoView;
  const framedNode = useRef<string | undefined>(undefined);
  useEffect(() => {
    const nodeId = runtime.currentNode.id;
    if (!engine || pouring || framedNode.current === nodeId) return;
    framedNode.current = nodeId;
    if (autoViewRef.current) void engine.settled().then(() => { if (framedNode.current === nodeId && autoViewRef.current) frameRef.current(); });
  }, [engine, pouring, runtime.currentNode.id]);
  // Opening, closing, moving, resizing or collapsing a panel changes the free area, so the auto
  // view refits (§5.9).
  useEffect(() => {
    // Not between squirts: the bottle is held where the last one framed it.
    if (engine && !pouring && autoViewRef.current && !engine.squirtHolding()) void engine.settled().then(() => { if (autoViewRef.current) frameRef.current(); });
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
        // At an inversion or swirl step, Enter on the flask inverts or swirls it once; on the oven at a
        // door step it works the door, as a click does (and is refused while a drying stage's time runs).
        if (selected && refuseEarlyOpen(selected)) e.preventDefault();
        else if (selected && (isInvertTarget(selected) || isSwirlTarget(selected) || isStirTarget(selected) || isFoldTarget(selected)
          || isOvenTarget(selected) || isBurnerTarget(selected) || isLidTarget(selected) || isChamberTarget(selected))) { player.recordEvidence(); e.preventDefault(); }
        else if (selected && scene.bench.some((item) => item.instanceId === selected)) { startMove(selected); e.preventDefault(); }
      } else if (e.key === "e" || e.key === "E") { if (selected) examine(selected); }
      else if (e.key === "s" || e.key === "S") { if (selected) player.setSelectedSource(selected); }
      else if (e.key === "t" || e.key === "T") { if (selected) player.setSelectedTarget(selected); }
      else if (e.key === "n" || e.key === "N") setNotebookOpen((v) => !v);
      else if (e.key === "a" || e.key === "A") { setAutoView(true); frame(); }
      else if (e.key === "Home") { setAutoView(false); engine?.resetView(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!engine) return undefined;
    engine.onManualCamera = () => setAutoView(false);
    engine.onChange = () => bump((v) => v + 1);
    // A right click puts a held item back, as in the microarray lab (decided 2026-10-04).
    engine.onCameraClick = () => { if (carryCancelRef.current.carrying) carryCancelRef.current.cancel(); };
    // Mouse and hand exclude each other: a mouse press or the wheel stops the camera (decided 2026-10-04).
    engine.onMouseInput = () => { if (handStopRef.current.running) handStopRef.current.stop(); };
    // A left-drag on empty bench slides it, unless an item is carried: a press then sets the item down (decided 2026-10-11).
    engine.canSlideBench = () => !carryCancelRef.current.carrying;
    return () => {
      engine.onManualCamera = undefined; engine.onChange = undefined; engine.onCameraClick = undefined; engine.onMouseInput = undefined;
      engine.canSlideBench = undefined;
    };
  }, [engine]);

  // The loader (§5.2): the bar counts the technique's GLB bytes until the first bench is drawn.
  useEffect(() => {
    if (!engine) return undefined;
    let active = true;
    engine.onLoadProgress = (loaded, total) => setLoading({ loaded, total });
    void engine.settled().then(() => { if (active) setBenchReady(true); });
    return () => { active = false; engine.onLoadProgress = undefined; };
  }, [engine]);
  // The shelf's items load once the loader has gone, so they never hold the first step back.
  useEffect(() => { if (benchReady) engine?.showShelf(); }, [benchReady, engine]);

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
    engine.frameItems([id], 1.3);
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
    if (clockRunning) return;
    // The demo plays where the learner is looking; only the auto view frames it (decided 2026-10-05).
    if (autoViewRef.current) frame();
    // A hot item is shown handled as a tool's load (Pack 2, S-05): the tongs go to it, then on to its place.
    const tongs = player.tongsStep;
    if (tongs && drawn(tongs.toolInstanceId)) engine?.showMe(tongs.toolInstanceId, drawn(tongs.targetInstanceId) ?? expectedTargetId, tongs.vesselInstanceId);
    else if (tool) engine?.showMe(toolId, expectedTargetId, expectedSourceId);
    else if (drawIds) engine?.showMe(drawIds.tool, drawIds.liquid);
    else engine?.showMe(expectedSourceId, expectedTargetId);
  };
  tapRef.current = (id, pointerType, x, y) => {
    // At an inversion step, a tap on the stoppered vessel (or its stopper) inverts it once; at a swirl
    // step, a tap on the flask swirls it.
    if (refuseEarlyOpen(id)) return true;
    if (isInvertTarget(id) || isSwirlTarget(id) || isStirTarget(id) || isFoldTarget(id) || isOvenTarget(id) || isBurnerTarget(id) || isLidTarget(id)
      || isChamberTarget(id)) {
      player.recordEvidence();
      return true;
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
    else if (view === "selected" && selected) engine?.frameItems([selected], 1.4);
    else if (view === "overhead") engine?.overhead();
  };
  const examinedHolder = (() => {
    const item = examined ? scene.bench.find((i) => i.instanceId === examined) : undefined;
    return item?.placement.kind === "seated" ? scene.bench.find((i) => i.instanceId === (item.placement as { parentInstanceId: string }).parentInstanceId)?.label : undefined;
  })();
  const hoverItem = hovered && !carry.carrying ? [...scene.bench, ...scene.tray].find((i) => i.instanceId === hovered) : undefined;
  const hoverPoint = hoverItem && engine ? engine.labelPoint(hoverItem.instanceId) : undefined;
  // The hover name is kept clear of the floating panels: an item beside the step card (the shelf's left end at Home)
  // is named past the card's edge, not under it.
  const hoverLabelRef = useRef<HTMLDivElement>(null);
  const [hoverShift, setHoverShift] = useState(0);
  useLayoutEffect(() => {
    const label = hoverLabelRef.current;
    let shift = 0;
    if (label) {
      const box = label.getBoundingClientRect();
      const left = box.left - hoverShift, right = box.right - hoverShift, middle = (left + right) / 2;
      for (const panel of playerRef.current?.querySelectorAll<HTMLElement>(".s3d-float") ?? []) {
        const p = panel.getBoundingClientRect();
        if (p.bottom <= box.top || p.top >= box.bottom || p.right <= left + shift || p.left >= right + shift) continue;
        shift = middle >= (p.left + p.right) / 2 ? p.right + 8 - left : p.left - 8 - right;
      }
    }
    if (Math.abs(shift - hoverShift) > 0.5) setHoverShift(shift);
  });
  const examinedItem = examined ? scene.bench.find((i) => i.instanceId === examined) : undefined;
  const n = Math.max(0, runtime.process.nodes.findIndex((node) => node.id === runtime.currentNode.id)) + 1;
  const N = runtime.process.nodes.length;
  const nbDot = showGuidance && flow.interaction?.type === "recordNotebook";
  // Blocking dialogs cancel an unfinished hand motion and pause hand input.
  const resultsOpen = player.complete && !confirmMode;
  const gestureBlocked = helpOpen || Boolean(confirmMode) || resultsOpen;
  gestureBlockedRef.current = gestureBlocked;
  useEffect(() => {
    if (!gestureBlocked) return;
    if (carryingRef.current) carry.cancelGesture();
    hand.controller.resetMotion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestureBlocked]);
  /** Stopping the camera cancels an unfinished hand motion and stops the camera tracks. */
  const stopHandControl = () => {
    carry.cancelGesture();
    hand.controller.resetMotion();
    hand.stop();
  };
  const startHandControl = () => hand.start();
  handStopRef.current = { running: hand.state.running, stop: stopHandControl };
  /** Closing the panel stops the camera, so the camera never runs without its panel. */
  const closeHandPanel = () => {
    setHandPanelOpen(false);
    stopHandControl();
  };
  const toggleHandPanel = () => {
    if (handPanelShown) closeHandPanel();
    else setHandPanelOpen(true);
  };
  const handContact = hand.controller.contact;
  const { invertHold, swirlHold } = hand.controller;
  const handCarryAction = carry.gestureAction();
  const handGuideContext: HandGuideContext = {
    carrying: carry.carrying, dropMode: Boolean(dropMode), drawBack: Boolean(dropMode && player.markStep?.drawBack),
    invertHolding: Boolean(invertHold && isInvertTarget(invertHold.id)), swirlHolding: Boolean(swirlHold && isSwirlTarget(swirlHold.id)),
    holdDone: Boolean((invertHold && !isInvertTarget(invertHold.id)) || (swirlHold && !isSwirlTarget(swirlHold.id))),
    ...(squirtHeld && squirtCount ? { squirtHolding: squirtCount } : {}),
    rinse: Boolean(handCarryAction?.rinse), locked: Boolean(handContact),
    stroke: hand.controller.stroke, draw: handCarryAction?.action === "draw", squeeze: Boolean(handCarryAction?.squeeze), armed: hand.controller.armed,
    keyLocked: !carry.carrying && hand.controller.lockedTarget?.kind === "control",
    lockedLabel: handContact?.target.instanceId ? lowerFirstLetter([...scene.bench, ...scene.tray].find((i) => i.instanceId === handContact.target.instanceId)?.label ?? "") || undefined : undefined,
  };

  const markStep = player.markStep;
  const markVesselLabel = markStep ? lowerFirstLetter(scene.bench.find((i) => i.instanceId === markStep.vesselInstanceId)?.label ?? "vessel") : "";
  const invertVesselNoun = scene.bench.find((i) => i.instanceId === invertVesselId)?.definitionId === "test-tube" ? "test tube" : "flask";
  const hint = dropMode
    ? `Space: tap for a drop, hold to let it run.${markStep?.drawBack ? " Draw back takes up an overshoot." : ""} Enter: at the line. Esc puts the pipette down.`
    : squirtHeld && squirtCount ? `Squirt ${squirtCount.done} of ${squirtCount.total}: click the bench, press Space or squeeze to squirt again. Esc puts the bottle down.`
    : carry.keyCarrying ? "Arrows move it (Shift: further). [ ] step through targets. Enter sets it down; Esc cancels."
    : carry.clickCarrying ? "Click where it goes, or press on the target, drag down and let go. Esc or a right click puts it back."
    : carry.gestureCarrying ? "Open your palm over the spot to set it down; over a target, pause until it locks, then lower your hand or turn your palm."
    : carry.carrying ? "Release to set down. Esc cancels."
    : player.stepClock ? `${player.stepClock.label}: the clock runs the ${player.stepClock.minutes} minutes fast. The next step waits for it.`
    : tool && flow.canConfirm ? "Pick up the spatula, press it into the source and drag down to scoop, then click the target; or use Source, Target and Confirm. Right-drag to look around."
    : pipette?.toolDefinitionId === "capillary-spotter" && flow.canConfirm ? "Pick up the capillary, then press over the dye or the strip's baseline, drag down and let go; or use Source, Target and Confirm. Right-drag to look around."
    : pipette && flow.canConfirm ? "Pick up the pipette, then press over the liquid or the cuvette, drag down and let go; or use Source, Target and Confirm. Right-drag to look around."
    : markStep ? `Pick up the pipette and click the ${markVesselLabel} to hold it there, or use the step card. Right-drag to look around.`
    : invertVesselId ? `Click the stoppered ${invertVesselNoun} to invert it, or use Invert in the step card. Right-drag to look around.`
    : swirlVesselId ? "Click the flask to swirl it until the solid dissolves, or use Swirl in the step card. Right-drag to look around."
    : stirVesselId ? "Click the beaker to stir it with the rod, or use Stir in the step card. Right-drag to look around."
    : player.benchOp?.operation === "settle-precipitate" ? "Leave the beaker still: use Wait in the step card while the precipitate settles."
    : foldPaperId ? (scene.bench.find((i) => i.instanceId === foldPaperId)?.placement.kind === "bench"
      ? "Click the paper to fold it in half and in half again, or use Fold in the step card. Right-drag to look around."
      : "Lift the paper off the balance onto the bench, then click it to fold it. Right-drag to look around.")
    : player.benchOp?.operation === "set-oven-temperature" ? "Enter the setting in the step card, then turn the oven's SET dial (or use Set). Right-drag to look around."
    : player.benchOp?.operation === "open-oven-door" ? "Click the oven door to open it, or use Open the door. Right-drag to look around."
    : player.benchOp?.operation === "close-oven-door" ? "Click the oven door to close it, or use Close the door. Right-drag to look around."
    : player.benchOp?.operation === "dry-in-oven" ? "Click the oven door to close it and start the clock, or use Close and dry. Right-drag to look around."
    : player.benchOp?.operation === "break-up-precipitate" ? "Pick up the metal scoop and click the watch glass to break up the solid, or use Break it up. Right-drag to look around."
    : player.benchOp?.operation === "cool-on-pad" ? "Leave it on the pad: use Wait while it cools. Right-drag to look around."
    : player.benchOp?.operation === "set-crucible-lid" ? "Click the crucible to set its lid askew, or use Set the lid askew. Right-drag to look around."
    : player.benchOp?.operation === "light-burner" ? "Click the burner: collar nearly closed, gas on, striker at the top of the barrel. Or use Light. Right-drag to look around."
    : player.benchOp?.operation === "set-flame" ? "Click the burner to open its air collar until the flame is blue, or use Open the air collar. Right-drag to look around."
    : player.benchOp?.operation === "heat-crucible" ? "Click the burner to heat for the set time, or use Heat. Right-drag to look around."
    : player.benchOp?.operation === "turn-off-burner" ? "Click the burner to turn the gas off, or use Turn off. Right-drag to look around."
    : player.tongsStep ? "Pick up the crucible tongs, click the watch glass to grip it, then click where it goes. Right-drag to look around."
    : chrom?.toolDefinitionId ? `Pick up the pencil and click the ${chrom.operation === "labelChamber" ? "chamber's tape" : "strip"} to ${
      chrom.operation === "markBaseline" ? "draw the baseline" : chrom.operation === "markSolventFront" ? "mark the front" : "write the label"
    }, or use ${chrom.control}. Right-drag to look around.`
    : chrom?.operation === "closeChamber" ? "Click the chamber to lower the strip in and seat the lid, or use Lower it in. Right-drag to look around."
    : chrom?.operation === "openChamber" ? "Click the chamber to lift the lid with the strip, or use Lift the lid. Right-drag to look around."
    : chrom?.operation === "develop" ? "Leave the chamber closed: click it or use Leave it to develop, and the clock runs. Right-drag to look around."
    : chrom ? "Leave the strip flat: use Let it dry, and the clock runs. Right-drag to look around."
    : player.benchOp?.operation === "precipitation-drop-test" ? "Pick up the dropping pipette and click the beaker to add one drop, or use Add a drop in the step card. Right-drag to look around."
    : flow.canConfirm ? "Click an item to pick it up, then click where it goes; or use Source, Target and Confirm. Right-drag to look around."
      : player.runtime.expectedAction?.parameters.balanceOperation === "zero" ? "Press TARE on the balance, or Tare in the step card. Right-drag to look around."
      : "Fill in the step card, then record. Right-drag to look around.";

  return (
    // While an item is carried the step card steps back from the bench (stepHud.css).
    <div className={`s3d-player${reducedMotion ? " is-reduced-motion" : ""}${variant === "preview" ? " s3d-player--preview" : ""}${carry.carrying ? " is-carrying" : ""}`}
      ref={playerRef}>
      <header className="s3d-topbar">
        <span className="s3d-topbar__left">
          <span className="s3d-mark"><Icon name="flask" size={18} /></span>
          {simulationId && variant === "full" ? (
            <SimulationSwitcher currentId={simulationId} title={title} hasProgress={runtime.state.completedNodes.length > 0 && !player.complete}
              onLeave={stopHandControl} />
          ) : <span className="s3d-topbar__title" title={title}>{title}</span>}
          <span className="s3d-source">{sourceTag}</span>
        </span>
        <span className="s3d-topbar__centre">Step <b>{n}</b> of <b>{N}</b>
          <span className={`s3d-mode${showGuidance ? "" : " is-assess"}`}><Icon name={showGuidance ? "eye" : "clip"} size={13} />{showGuidance ? "Guided" : "Assessment"}</span>
        </span>
        <span className="s3d-topbar__right">
          <button type="button" className={`s3d-button s3d-button--quiet${nbDot ? " has-dot" : ""}`} onClick={() => setNotebookOpen((v) => !v)} aria-pressed={notebookOpen}><Icon name="book" />Notebook</button>
          <button type="button" className="s3d-icon-button s3d-icon-button--bar" aria-label="Controls and model" title="Controls & model" onClick={() => setHelpOpen(true)}><Icon name="help" size={18} /></button>
          <button type="button" className="s3d-button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}><Icon name="menu" />Menu</button>
        </span>
      </header>

      <StepCard player={player} controls={panelControls} onShowMe={showMe} part={parts?.get(player.runtime.currentNode.id)}
        onHoldOver={markStep && !dropMode ? holdFromCard : undefined} holdOverReady={Boolean(markStep && onBenchNow(markStep.pipetteInstanceId) && onBenchNow(markStep.vesselInstanceId))} />
      {player.stepClock ? (
        <StepClock key={player.stepClock.id} label={player.stepClock.label} minutes={player.stepClock.minutes} progress={player.clockProgress}
          reducedMotion={reducedMotion} />
      ) : null}
      {dropMode ? (
        <DropPanel title={`Pipette over the ${markVesselLabel || "vessel"}`} onDrop={() => addDrop(1)} onRunStart={startRun} onRunEnd={endRun}
          onAccept={acceptAtLine} onPutDown={exitDropMode}
          drawBack={markStep?.drawBack ? { onTap: drawBackTap, onRunStart: startBackRun, onRunEnd: endBackRun } : undefined} />
      ) : null}

      <BenchView
        scene={displayScene}
        options={options}
        onEngine={setEngine}
        label={`3D bench for ${title}. Every item is also listed in the Bench list.`}
        fallback={<div className="s3d-fallback"><p>This browser cannot draw the 3D bench.{fallbackHash ? " The 2D version runs the same steps and checks." : ""}</p>{fallbackHash ? <a className="s3d-button s3d-button--primary" href={fallbackHash}>Open the 2D version</a> : null}</div>}
      >
        {hoverItem && hoverPoint?.visible ? (
          <div ref={hoverLabelRef} className="s3d-label" style={{ left: hoverPoint.x + hoverShift, top: hoverPoint.y + 8 }}>{hoverItem.label} · {hoverItem.contentsText}</div>
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
          <div className={`s3d-callout s3d-callout--docked s3d-callout--${carry.callout.kind}`}>
            <Icon name={carry.callout.kind === "valid" ? "check" : carry.callout.kind === "invalid" ? "x" : carry.callout.kind === "input" ? "pencil" : "tray"} size={14} />{carry.callout.text}
          </div>
        ) : null}
        {hand.state.running && !gestureBlocked ? <HandCursorRing hand={hand} /> : null}
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
            {fallbackHash ? <a href={fallbackHash}>Open the 2D version</a> : null}
          </div>
        </div>
      ) : null}

      {panel === "list" ? <BenchList player={player} controls={panelControls} selected={selected}
        onSelect={(id) => { setSelected(id); setAutoView(false); engine?.frameItems([id], 1.4); }} onExamine={examine}
        onMove={startMove} onClose={() => setPanel("none")} /> : null}
      {examinedItem ? (
        <ExamineCard item={examinedItem} holderLabel={examinedHolder} onClose={closeExamine}
          onEyeLevel={examinedItem.contents.kind === "liquid"
            ? () => engine?.eyeLevel(examinedItem.instanceId, (examinedItem.contents as { levelMm: number }).levelMm)
            : undefined} />
      ) : null}
      {notebookOpen ? <NotebookSheet player={player} width={prefs.notebookWidth} onResize={(w) => updatePrefs({ notebookWidth: w })}
        onClose={() => setNotebookOpen(false)} /> : null}
      {handPanelShown ? <HandControlPanel hand={{ ...hand, start: startHandControl, stop: stopHandControl }} guide={handGuideContext}
        controls={panelControls} onClose={closeHandPanel} /> : null}

      <p className="s3d-hint">{hint}</p>
      <nav className="s3d-dock" aria-label="Player tools">
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
          {fallbackHash ? <a href={fallbackHash}>Open the 2D version</a> : null}
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

    </div>
  );
};
