import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v1InteractionZones } from "../../../domain/interactionZones";
import { equipmentById } from "../../../equipment/catalog";
import { getVisualProfile } from "../../../equipment/visualCatalog";
import { fromBench, runtimeBenchPoints } from "../../adapters/benchCoordinates";
import { classifyOverlap, footprintOf, snapClassification, snapZoneFootprint, type FootprintCandidate } from "../../adapters/footprints";
import { pointInFootprint, resolvePipetteRelease, resolveRelease, resolveToolRelease, snapReleasePoint, type ToolTransfer } from "../../adapters/sceneToIntent";
import type { ActionInteractionSpec } from "../../../domain/types";
import type { RuntimeInteractionIntent } from "../../../runtime/interactionIntents";
import type { SceneContents, SceneItem } from "../../adapters/runtimeToScene";
import { FILTER_OVERFLOW, type Player3DController } from "../../player/usePlayer3D";
import type { BenchEngine } from "../BenchEngine";
import { arrowDirection, cycleIndex, nudgePoint, spatialOrder, type BenchPoint } from "./keyboard";
import { placedInstanceId, seatNeededLater } from "../../player/stepRules";
import { getActions, getProcess } from "../../../runtime/createRuntime";

/**
 * Picking up and setting down on the 3D bench (handoff §5.6). With a mouse it follows the DNA
 * microarray 3D lab's controller (decided 2026-10-04, replacing §5.6's press-and-move): a press on
 * an item picks it up at once and it follows the pointer; the next press acts where it is, and a
 * press on a seat, a pour target or a liquid is dragged down to depth (`PressAction`, `STROKE`); Esc
 * or a right click puts it back. On touch a press becomes a carry after 300 ms; from the keyboard, Enter on a selected item (or Move…
 * in the Bench list) starts one, arrows move it and `[` `]` step through candidate targets. While
 * carrying, the item is drawn lifted with its footprint, and overlap is classified by the shared
 * 2D rule; nothing commits until release or Enter (G-5). Both ways in release through the same
 * `resolveRelease`, in the 2D order. Esc cancels. A press on an item on the shelf (or at the side station) starts
 * a carry of an item that is not yet on the bench, which a press back on the shelf, Esc or a right click puts back on
 * its spot (the shelf in place of the tray, decided 2026-10-11). Hand control (the microarray lab's controller, src/studio3d/hand/) carries through the same path:
 * a closed grip lifts the item, the hand moves it over the bench, and letting go over the bench
 * commits through the pointer's release, tagged "vision" as the 2D player tags its camera releases.
 * Releasing over a panel, the tray or the dock changes nothing, as releasing off the 2D workbench does.
 */
export interface CarryCallout {
  x: number;
  y: number;
  text: string;
  /** "input": over the right target, but the step card's entry is still missing. */
  kind: "valid" | "invalid" | "free" | "detach" | "input";
}

/**
 * The callout over a target or station the step accepts (§5.6). The step's entry comes first (G-2),
 * and a release without it is refused, so in guided mode the callout says to fill in the step card
 * instead of promising the action. Assessment mode stays neutral, as it does for every target.
 */
export const acceptedDropCallout = (showGuidance: boolean, inputReady: boolean, releaseText: string): Pick<CarryCallout, "text" | "kind"> =>
  !showGuidance ? { text: "Release to try this", kind: "valid" }
    : inputReady ? { text: releaseText, kind: "valid" }
      : { text: "Fill in the step card first", kind: "input" };

/**
 * What a mouse press does with an item held (the microarray lab's controller, decided 2026-10-04):
 * "commit" acts at once (set down, place, tip a scoop, hold a pipette over a vessel, or a refusal);
 * the rest are strokes, a press on the target dragged down to depth (`interaction.js:156-211`,
 * `hand-core.js:48`): "insert" (seat, pour, deliver) and "draw" act when the button is let go at
 * depth, and "dip" loads the spatula at depth. The source commits a delivery the moment the stroke
 * reaches depth; here every stroke commits on release, as guardrail G-5 requires ("a drag commits on
 * release"), with the same gesture.
 */
export type PressAction = "commit" | "insert" | "draw" | "dip";

/** A press-and-drag-down stroke: 28 px is full depth, 0.85 acts, and 32 px back above the press withdraws. */
export const STROKE = { fullPx: 28, act: 0.85, withdrawPx: 32 };
export const strokeDepth = (dyPx: number): number => Math.min(1, Math.max(0, dyPx) / STROKE.fullPx);

/** A mouse carry's callout: "Release to …" becomes "Click to …", or the stroke the press starts. */
export const clickCallout = (text: string, action: PressAction): string => {
  if (!text.startsWith("Release to ")) return text;
  const rest = text.slice("Release to ".length);
  if (action === "insert" || action === "draw") return `Press, drag down and let go to ${rest}`;
  return `Click to ${rest}`;
};

/**
 * A hand carry's callout (§8 of the adoption brief): "Release to …" becomes the hand's own action:
 * an open palm for a set-down, place or hold; a palm turn for a pour or a scoop tipped; lowering for
 * a seat or a scoop; squeezing at depth to empty a pipette; squeeze, lower and let go to draw; and a
 * wash bottle locked on what it rinses is squeezed (decided 2026-10-04).
 */
export const handCallout = (text: string, action: PressAction, how: { turn: boolean; squeeze: boolean; rinse?: boolean }): string => {
  if (!text.startsWith("Release to ")) return text;
  const rest = text.slice("Release to ".length);
  if (how.turn) return `Pause here, then turn your palm to ${rest}`;
  if (how.rinse) return `Pause here, then squeeze to ${rest}`;
  if (action === "commit") return `Open your palm to ${rest}`;
  if (action === "draw") return `Squeeze above it, lower in and let go to ${rest}`;
  if (how.squeeze) return `Pause here, lower in and squeeze to ${rest}`;
  return `Pause here, then lower your hand to ${rest}`;
};

type Carry =
  | { kind: "bench"; via: "pointer" | "keyboard" | "gesture"; instanceId: string; definitionId: string; label: string; startX: number; startY: number;
      active: boolean; pointerType: string; point?: BenchPoint; liftMm?: number; targetIndex?: number;
      /** A tool (the spatula) that has been dipped into the step's solid source during this carry. */
      toolLoaded?: boolean;
      /** Where a tool's working end (the spoon) is aimed; `point` is then where the tool's centre is. */
      tipPoint?: BenchPoint;
      /** A mouse carry in the microarray model: picked up by a press, it follows the pointer until the next press. */
      click?: boolean;
      /** Where and when it was picked up, so an immediate second press (a double-click) puts it back. */
      pickedAt?: { x: number; y: number; t: number };
      pressAction?: PressAction;
      stroke?: Stroke;
      /** The pour target under the carried item, for the tilt drawn during a pour stroke. */
      pourToward?: string;
      /** The item the carried wash bottle would rinse here (a rinse step's valid target). */
      rinseAt?: string;
      /** The kind of the last callout: "valid" when over a target the step accepts. */
      lastKind?: CarryCallout["kind"] }
  | { kind: "tray"; via: "pointer" | "gesture"; definitionId: string; instanceId?: string; point?: BenchPoint; click?: boolean; pressAction?: PressAction; stroke?: Stroke;
      pourToward?: string; liftMm?: number; pickedAt?: { x: number; y: number; t: number };
      /** Over the shelf or the side station: a release there puts it back on its spot. */
      back?: boolean };

interface Stroke { kind: Exclude<PressAction, "commit">; startY: number; depth: number }

/**
 * Whether the bench canvas itself is under a client point. The canvas fills the player and the
 * floating panels sit over it, so "over the bench" means the canvas is the element there, not only
 * that the point is inside its rectangle.
 */
export const benchCanvasUnder = (canvas: HTMLCanvasElement | undefined, clientX: number, clientY: number): boolean =>
  Boolean(canvas) && typeof document.elementFromPoint === "function" && document.elementFromPoint(clientX, clientY) === canvas;

const LIFT_MM = 16;
/** A tool's working end, judged as a small square over the source and the target. */
const TIP_MM = 12;
const MM = 0.001;

/**
 * A tap on an item (§5.19 "Touch: tap · Select"), or a mouse press on one before it is picked up.
 * Returning true means the press was used (an inversion), so nothing is picked up.
 */
export type TapHandler = (instanceId: string, pointerType: string, clientX: number, clientY: number) => boolean | void;

/** A control on an instrument (the balance's TARE key) pressed and released without moving. */
export type ControlHandler = (instanceId: string, controlId: string) => void;

/** A pipette released over the vessel of a drop-to-the-line step: it is held there (decided 2026-10-02). */
export type HoldOverHandler = (pipetteId: string, vesselId: string) => void;

export const useBenchCarry = (engine: BenchEngine | undefined, player: Player3DController, onHover: (instanceId?: string) => void,
  onTap?: TapHandler, onControl?: ControlHandler, onHoldOver?: HoldOverHandler,
  /** True while hand control runs: mouse moves are then ignored, as in the microarray lab (`app.js:121`). */
  mouseIgnored?: () => boolean,
  /** A press on an item while a committed animation is drawn (Pack 2: the oven opened before its time is up). */
  onBusyPress?: (instanceId: string) => void) => {
  const carryRef = useRef<Carry | undefined>(undefined);
  const mouseIgnoredRef = useRef(mouseIgnored);
  mouseIgnoredRef.current = mouseIgnored;
  const [callout, setCallout] = useState<CarryCallout>();
  // What is being carried, by definition (the tool's guidance follows it); undefined when nothing is.
  const [carriedDefinitionId, setCarriedDefinitionId] = useState<string>();
  const carrying = Boolean(carriedDefinitionId);
  const setCarrying = useCallback((on: boolean) => setCarriedDefinitionId(on ? carryRef.current?.definitionId : undefined), []);
  const [keyCarrying, setKeyCarrying] = useState(false);
  const [toolLoaded, setToolLoaded] = useState(false);
  const { scene, interaction, showGuidance, flow } = player;
  // Nothing is picked up while a committed pour, weighing or tool transfer is being drawn, or while a
  // timed stage's minutes run on the step clock (Pack 2 decision 9; under reduced motion too).
  const pouringRef = useRef(false);
  pouringRef.current = Boolean(player.pour || player.weighing || player.toolDeposit || player.swirl || player.benchOpRun || player.stepClock);
  /**
   * Pouring again into a filter that has not drained would overflow the paper (Pack 2 decision 4): the
   * beaker cannot be picked up while the funnel drains, and a correction says why. Returns whether refused.
   */
  const overflowRefused = useCallback((instanceId: string | undefined): boolean => {
    if (!instanceId || !player.pour?.drainInto || instanceId !== player.pour.sourceId) return false;
    player.correct(FILTER_OVERFLOW.message, FILTER_OVERFLOW.recovery);
    return true;
  }, [player]);
  // The drop test (Pack 2): the dropping pipette carried to the beaker adds one drop there.
  const benchOp = player.benchOp;
  const dropTest = useMemo(() => (benchOp?.operation === "precipitation-drop-test" && benchOp.toolInstanceId && benchOp.vesselInstanceId
    ? { pipetteId: benchOp.toolInstanceId, vesselId: benchOp.vesselInstanceId } : undefined), [benchOp]);

  // A solid transfer this step makes with a tool (the spatula), decided 2026-09-25.
  const toolTransfer = player.toolTransfer;
  const labelOf = useCallback((definitionId: string) =>
    lowerFirst(scene.bench.find((item) => item.definitionId === definitionId)?.label ?? equipmentById.get(definitionId)?.label ?? definitionId),
  [scene]);
  /** The scoop a dipped tool carries: the source's own solid, drawn at the tool's solid rest. */
  const scoopFor = useCallback((tool: ToolTransfer): SceneContents | undefined => {
    const source = scene.bench.find((item) => item.instanceId === tool.sourceInstanceId);
    return source?.contents.kind === "solid" ? { kind: "solid", style: source.contents.style } : undefined;
  }, [scene]);

  /**
   * Drop targets for a carry: items standing on the bench, and items seated on one of them at their
   * seat (a watch glass on a balance's pan receives a transfer there). The carried item, and
   * whatever is seated on it, are never targets.
   */
  const candidates = useCallback((exceptId?: string): Array<FootprintCandidate & { label: string; surfaceMm?: number }> => {
    const byId = new Map(scene.bench.map((item) => [item.instanceId, item]));
    const carriedWith = (item: SceneItem): boolean => {
      for (let current: SceneItem | undefined = item, depth = 0; current && depth < 8; depth += 1) {
        if (current.instanceId === exceptId) return true;
        current = current.placement.kind === "seated" ? byId.get(current.placement.parentInstanceId) : undefined;
      }
      return false;
    };
    return scene.bench.flatMap((item) => {
      if (carriedWith(item)) return [];
      if (item.placement.kind === "bench") {
        return [{ instanceId: item.instanceId, definitionId: item.definitionId, label: item.label,
          footprint: footprintOf(item.model, item.placement.point.xMm, item.placement.point.yMm) }];
      }
      const holder = byId.get(item.placement.parentInstanceId);
      const seat = holder?.placement.kind === "bench"
        ? snapZoneFootprint(holder.model, holder.definitionId, item.placement.zoneId, holder.placement.point)
        : undefined;
      // `surfaceMm`: the seat's height, so a keyboard carry to it is drawn above it, not in its holder.
      return seat ? [{ instanceId: item.instanceId, definitionId: item.definitionId, label: item.label,
        footprint: footprintOf(item.model, seat.xMm, seat.yMm), surfaceMm: item.placement.anchorMm[2] ?? 0 }] : [];
    });
  }, [scene]);

  /**
   * The 2D overlap judgement for the carried item at `point`, snaps included (footprints.snapClassification).
   * `asTip`: only a tool's working end at `point` is judged, not the whole tool. `spec` judges it
   * against another reading of the step (a pipette carried to the liquid it draws from).
   */
  const overlapAt = useCallback((instanceId: string, definitionId: string, point: BenchPoint, asTip = false, spec?: ActionInteractionSpec) => {
    const judged = spec ?? interaction;
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    const snap = snapClassification(judged, definitionId, scene.bench.flatMap((other) => other.placement.kind === "bench"
      ? [{ instanceId: other.instanceId, definitionId: other.definitionId, entry: other.model, ...other.placement.point }]
      : []));
    const footprint = asTip ? { xMm: point.xMm, yMm: point.yMm, widthMm: TIP_MM, depthMm: TIP_MM } : footprintOf(item?.model, point.xMm, point.yMm);
    return classifyOverlap({ instanceId, definitionId, footprint }, candidates(instanceId), judged, snap);
  }, [candidates, interaction, scene]);

  // A hot item moved with the tongs, and the solid broken up with the scoop (Pack 2, decided 2026-10-05).
  const tongs = player.tongsStep;
  // The pencil works the same way (Pack 3a): carried by its point to the strip for a line, or to the chamber's tape.
  const chromStep = player.chromStep;
  const breakUp = useMemo((): { toolId: string; vesselId: string; tool: string; doing: string } | undefined => {
    if (benchOp?.operation === "break-up-precipitate" && benchOp.toolInstanceId && benchOp.vesselInstanceId) {
      return { toolId: benchOp.toolInstanceId, vesselId: benchOp.vesselInstanceId, tool: "scoop", doing: "break up the solid on" };
    }
    const pencil = chromStep?.toolDefinitionId ? scene.bench.find((item) => item.definitionId === chromStep.toolDefinitionId) : undefined;
    if (!chromStep || !pencil) return undefined;
    const doing = chromStep.operation === "markBaseline" ? "draw the baseline on" : chromStep.operation === "markSolventFront" ? "mark the front on"
      : "write the label on";
    return { toolId: pencil.instanceId, vesselId: chromStep.targetInstanceId, tool: "pencil", doing };
  }, [benchOp, chromStep, scene]);
  /** Whether a carried item's tip is over a bench item's footprint (the dropping pipette over the beaker). */
  const tipOver = useCallback((vesselId: string, carriedId: string, point: BenchPoint): boolean =>
    candidates(carriedId).some((candidate) => candidate.instanceId === vesselId && pointInFootprint(candidate.footprint, point)), [candidates]);

  // A step done with a pipette (decided 2026-09-26): the pipette is carried, upright by its tip, to
  // the liquid it draws from or the vessel it empties into. Judged as the pipette being the pour's
  // source, which it is for a delivery; for a draw the step's reading is turned round.
  const pipette = player.pipetteStep;
  const markStep = player.markStep;
  const pipetteSpec = useMemo((): ActionInteractionSpec | undefined => (pipette && interaction
    ? { ...interaction, sourceDefinitionId: pipette.toolDefinitionId, targetDefinitionId: pipette.otherDefinitionId } : undefined),
  [interaction, pipette]);

  /**
   * Whether releasing `definitionId` on the bench lands in the step's expected drag-to-zone station
   * (Workbench.finishMove, first rule). The 3D bench has one station, the bench surface, which is
   * the station of every Pack 1 placement.
   */
  /**
   * A seated part a step still needs seated stays put (decided 2026-10-05): lifting it off would leave
   * that step no way through, as a free move never re-seats it. Says so, and returns true, when refused.
   */
  const keptSeated = useCallback((instanceId: string): boolean => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    if (item?.placement.kind !== "seated") return false;
    const { parentInstanceId, zoneId } = item.placement;
    const parent = scene.bench.find((i) => i.instanceId === parentInstanceId);
    if (!parent) return false;
    const { runtime } = player;
    const needed = seatNeededLater(getActions(player.definition), getProcess(player.definition).nodes, runtime.state.completedNodes,
      runtime.expectedAction, item, parent, zoneId);
    if (needed) player.notify(`Leave the ${item.label.toLowerCase()} in the ${parent.label.toLowerCase()}: a step still needs it there.`);
    return needed;
  }, [player, scene]);
  /**
   * Hot glassware is not picked up by hand (S-05): a correction names the tongs. Also a part a later step
   * needs where it is seated stays put. Returns whether the pick-up is refused.
   */
  const heldBack = useCallback((instanceId: string): boolean => {
    const instance = player.runtime.state.equipmentInstances.find((candidate) => candidate.id === instanceId);
    if ((instance?.contents.temperatureC ?? 0) > 45) {
      player.correct(`The ${instance!.label.toLowerCase()} is hot.`, "Pick it up with the crucible tongs.");
      return true;
    }
    return keptSeated(instanceId);
  }, [keptSeated, player]);

  // Where the step names one item, another of the same kind is only moved (decided 2026-10-05).
  const namedInstanceId = placedInstanceId(player.runtime.expectedAction?.parameters);
  const placesForStep = useCallback((definitionId: string, instanceId?: string): boolean =>
    interaction?.type === "dragToZone" && interaction.sourceDefinitionId === definitionId
    && (interaction.stationId ?? "workbench") === "workbench" && !flow.nodeCompleted
    && (!instanceId || !namedInstanceId || instanceId === namedInstanceId),
  [flow.nodeCompleted, interaction, namedInstanceId]);

  const endCarry = useCallback(() => {
    carryRef.current = undefined;
    if (engine) engine.canvasElement.style.cursor = "";
    setCarrying(false);
    setKeyCarrying(false);
    setCallout(undefined);
    setToolLoaded(false);
    engine?.setToolLoad(null);
  }, [engine]);

  const cancel = useCallback(() => {
    endCarry();
    engine?.setToolHeld(null);
    engine?.endCarryPreview();
    if (engine) void engine.sync(scene);
  }, [endCarry, engine, scene]);

  /**
   * Draw the carried item at `point`, lifted above the surface it is aimed at (`surfaceMm`, 0 for
   * the bench), and classify what it is over; returns the callout shown.
   */
  const carryTo = useCallback((point: BenchPoint, screenAt?: { x: number; y: number }, surfaceMm = 0, hitId?: string): CarryCallout | undefined => {
    const carry = carryRef.current;
    if (!engine || !carry) return undefined;
    carry.point = point;
    // What the next mouse press does here, and the callout worded for it (a click carry, decided 2026-10-04).
    const show = (shown: CarryCallout, action: PressAction): CarryCallout => {
      carry.pressAction = action;
      if (carry.kind === "bench") carry.lastKind = shown.kind;
      let out = shown;
      if (carry.click) out = { ...shown, text: clickCallout(shown.text, action) };
      else if (carry.via === "gesture") {
        const isTool = Boolean(toolTransfer && carry.definitionId === toolTransfer.toolDefinitionId);
        const turn = (action === "insert" && Boolean(carry.pourToward)) || (isTool && carry.kind === "bench" && Boolean(carry.toolLoaded) && shown.kind === "valid");
        const squeeze = action === "insert" && pipette?.kind === "deliver" && carry.kind === "bench" && carry.instanceId === pipette.toolInstanceId;
        const rinse = action === "commit" && carry.kind === "bench" && Boolean(carry.rinseAt);
        out = { ...shown, text: handCallout(shown.text, action, { turn, squeeze, rinse }) };
      }
      setCallout(out);
      return out;
    };
    // Over the expected station (§5.6): "Release to place" in guided mode, neutral in assessment.
    const placing = acceptedDropCallout(showGuidance, flow.inputReady, "Release to place");
    if (carry.kind === "tray") {
      carry.back = false;
      // The item itself follows, lifted from its spot on the shelf.
      if (carry.instanceId && engine.onShelf(carry.instanceId)) {
        carry.liftMm = surfaceMm + LIFT_MM;
        engine.previewCarry(carry.instanceId, point.xMm, point.yMm, carry.liftMm);
      }
      const shown: CarryCallout = placesForStep(carry.definitionId, carry.instanceId)
        ? { ...(screenAt ?? { x: 0, y: 0 }), ...placing }
        : { ...(screenAt ?? { x: 0, y: 0 }), text: "Release to set down", kind: "free" };
      return show(shown, "commit");
    }
    const tool = toolTransfer;
    if (tool && carry.definitionId === tool.toolDefinitionId) {
      // The tool: dipped into the source it takes a scoop, which it can then tip onto the target.
      // It is held by its working end: the spoon follows the pointer, and the tool's centre, where
      // the runtime would set it down, lies behind it.
      const offset = engine.solidRestOffsetMm(carry.instanceId);
      carry.tipPoint = point;
      carry.point = offset ? { xMm: point.xMm - offset.xMm, yMm: point.yMm - offset.yMm } : point;
      const source = scene.bench.find((item) => item.instanceId === tool.sourceInstanceId);
      const sourceFootprint = source?.placement.kind === "bench"
        ? footprintOf(source.model, source.placement.point.xMm, source.placement.point.yMm) : undefined;
      const overSource = hitId === tool.sourceInstanceId || Boolean(sourceFootprint && pointInFootprint(sourceFootprint, point));
      // A mouse or hand carry takes its scoop by lowering into the solid (the dip stroke); touch and
      // the keyboard take it as the spoon passes over the source.
      if (overSource && !carry.toolLoaded && !carry.click && carry.via !== "gesture") {
        carry.toolLoaded = true;
        setToolLoaded(true);
        engine.setToolLoad(carry.instanceId, scoopFor(tool));
      }
      carry.liftMm = surfaceMm + LIFT_MM;
      engine.previewCarry(carry.instanceId, carry.point.xMm, carry.point.yMm, carry.liftMm);
      const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
      const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
      const sourceLabel = labelOf(tool.sourceDefinitionId);
      const targetLabel = labelOf(tool.targetDefinitionId);
      let shown: CarryCallout;
      let action: PressAction = "commit";
      if (overSource) {
        engine.setTargetRing(tool.sourceInstanceId, "valid");
        // What happened, not coaching, so it reads the same in both modes.
        if (carry.toolLoaded) shown = { ...screen, text: `Scooped from the ${sourceLabel}`, kind: "valid" };
        else {
          shown = { ...screen, text: carry.via === "gesture" ? `Pause here, then lower your hand to scoop from the ${sourceLabel}`
            : `Press and drag down to scoop from the ${sourceLabel}`, kind: "valid" };
          action = "dip";
        }
      } else {
        const overlap = overlapAt(carry.instanceId, tool.sourceDefinitionId, point, true);
        const overTarget = overlap.target?.definitionId === tool.targetDefinitionId ? overlap.target : undefined;
        if (carry.toolLoaded && overlap.kind === "valid" && overTarget) {
          engine.setTargetRing(overTarget.id, "valid");
          shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady, `Release to tip the scoop onto the ${targetLabel}`) };
        } else if (overlap.kind === "invalid" && overlap.target) {
          engine.setTargetRing(overlap.target.id, "invalid");
          shown = { ...screen, text: showGuidance ? "Not the target for this step" : "Release to try this", kind: "invalid" };
        } else {
          engine.setTargetRing(null);
          shown = !showGuidance ? { ...screen, text: "Release to set down", kind: "free" }
            : carry.toolLoaded ? { ...screen, text: `Carry the scoop to the ${targetLabel}`, kind: "free" }
              : overTarget ? { ...screen, text: `Scoop from the ${sourceLabel} first`, kind: "input" }
                : { ...screen, text: "Release to set down", kind: "free" };
        }
      }
      return show(shown, action);
    }
    if ((tongs && carry.instanceId === tongs.toolInstanceId) || (breakUp && carry.instanceId === breakUp.toolId)) {
      // A tool aimed by its working end (`tipMm`): the tongs grip the hot item, then carry it where the step
      // puts it; the scoop breaks up the solid on the watch glass (Pack 2).
      const offset = engine.tipOffsetMm(carry.instanceId);
      carry.tipPoint = point;
      carry.point = offset ? { xMm: point.xMm - offset.xMm, yMm: point.yMm - offset.yMm } : point;
      carry.liftMm = surfaceMm + LIFT_MM;
      engine.previewCarry(carry.instanceId, carry.point.xMm, carry.point.yMm, carry.liftMm);
      const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
      const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
      const vesselId = tongs && carry.instanceId === tongs.toolInstanceId ? tongs.vesselInstanceId : breakUp!.vesselId;
      const vesselLabel = lowerFirst(scene.bench.find((i) => i.instanceId === vesselId)?.label ?? "watch glass");
      let shown: CarryCallout;
      let action: PressAction = "commit";
      if (breakUp && carry.instanceId === breakUp.toolId) {
        if (tipOver(vesselId, carry.instanceId, point)) {
          engine.setTargetRing(vesselId, "valid");
          shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady, `Release to ${breakUp.doing} the ${vesselLabel}`) };
        } else {
          engine.setTargetRing(null);
          shown = showGuidance ? { ...screen, text: `Carry the ${breakUp.tool} to the ${vesselLabel}`, kind: "free" } : { ...screen, text: "Release to set down", kind: "free" };
        }
        return show(shown, action);
      }
      const gripped = Boolean(carry.toolLoaded);
      if (!gripped) {
        if (tipOver(vesselId, carry.instanceId, point)) {
          engine.setTargetRing(vesselId, "valid");
          // The keyboard and touch grip as the jaws pass over it; the mouse and the hand grip with a press.
          if (!carry.click && carry.via !== "gesture") {
            carry.toolLoaded = true;
            setToolLoaded(true);
            engine.setToolHeld(carry.instanceId, vesselId);
            shown = { ...screen, text: `Gripped the ${vesselLabel}`, kind: "valid" };
          } else {
            shown = { ...screen, text: carry.via === "gesture" ? `Show your open palm here and hold it to grip the ${vesselLabel}` : `Click to grip the ${vesselLabel}`, kind: "valid" };
          }
        } else {
          engine.setTargetRing(null);
          shown = showGuidance ? { ...screen, text: `Carry the tongs to the ${vesselLabel}`, kind: "free" } : { ...screen, text: "Release to set down", kind: "free" };
        }
        return show(shown, action);
      }
      const overlap = overlapAt(vesselId, tongs!.vesselDefinitionId, point);
      if (overlap.kind === "valid" && overlap.target && (!tongs!.targetInstanceId || overlap.target.id === tongs!.targetInstanceId)) {
        engine.setTargetRing(overlap.target.id, "valid");
        shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady, `Release to ${lowerFirst(interaction?.accessibleLabel ?? "set it down")}`) };
      } else {
        engine.setTargetRing(overlap.target && overlap.kind !== "moveOnly" ? overlap.target.id : null, overlap.target && overlap.kind !== "moveOnly" ? "invalid" : "valid");
        shown = showGuidance ? { ...screen, text: `Carry the ${vesselLabel} where the step puts it`, kind: "free" } : { ...screen, text: "Release to try this", kind: "free" };
      }
      action = "commit";
      return show(shown, action);
    }
    if (dropTest && carry.instanceId === dropTest.pipetteId) {
      // The drop test: the dropping pipette, upright by its tip, adds one drop where it is released.
      carry.tipPoint = point;
      carry.liftMm = surfaceMm + LIFT_MM;
      engine.previewCarry(carry.instanceId, point.xMm, point.yMm, carry.liftMm);
      const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
      const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
      const vessel = scene.bench.find((i) => i.instanceId === dropTest.vesselId);
      const vesselLabel = vessel ? lowerFirst(vessel.label) : "beaker";
      let shown: CarryCallout;
      if (tipOver(dropTest.vesselId, carry.instanceId, point)) {
        engine.setTargetRing(dropTest.vesselId, "valid");
        shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady, `Release to add one drop to the ${vesselLabel}`) };
      } else {
        engine.setTargetRing(null);
        shown = showGuidance ? { ...screen, text: `Carry the pipette to the ${vesselLabel}`, kind: "free" } : { ...screen, text: "Release to set down", kind: "free" };
      }
      return show(shown, "commit");
    }
    const mark = markStep;
    if (mark && carry.instanceId === mark.pipetteInstanceId) {
      // A drop-to-the-line step: the pipette, upright by its tip, is held over the vessel on release.
      carry.tipPoint = point;
      carry.liftMm = surfaceMm + LIFT_MM;
      engine.previewCarry(carry.instanceId, point.xMm, point.yMm, carry.liftMm);
      const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
      const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
      const vessel = scene.bench.find((i) => i.instanceId === mark.vesselInstanceId);
      const vesselLabel = vessel ? lowerFirst(vessel.label) : labelOf(mark.vesselDefinitionId);
      const overlap = overlapAt(carry.instanceId, mark.pipetteDefinitionId, point, true);
      let shown: CarryCallout;
      if (overlap.kind === "valid" && overlap.target?.id === mark.vesselInstanceId) {
        engine.setTargetRing(mark.vesselInstanceId, "valid");
        shown = { ...screen, text: `Release to hold the pipette over the ${vesselLabel}`, kind: "valid" };
      } else if (overlap.target && overlap.kind !== "moveOnly") {
        engine.setTargetRing(overlap.target.id, "invalid");
        shown = { ...screen, text: showGuidance ? "Not the target for this step" : "Release to try this", kind: "invalid" };
      } else {
        engine.setTargetRing(null);
        shown = showGuidance ? { ...screen, text: `Carry the pipette to the ${vesselLabel}`, kind: "free" } : { ...screen, text: "Release to set down", kind: "free" };
      }
      return show(shown, "commit");
    }
    if (pipette && carry.instanceId === pipette.toolInstanceId) {
      // The pipette, upright, is judged by its tip (its origin), so the tip goes where the pointer is.
      carry.tipPoint = point;
      carry.liftMm = surfaceMm + LIFT_MM;
      engine.previewCarry(carry.instanceId, point.xMm, point.yMm, carry.liftMm);
      const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
      const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
      // The step names one vessel (the blank cuvette, not the sample cuvette): its own label.
      const otherItem = pipette.otherInstanceId ? scene.bench.find((i) => i.instanceId === pipette.otherInstanceId) : undefined;
      const otherLabel = otherItem ? lowerFirst(otherItem.label) : labelOf(pipette.otherDefinitionId);
      const overlap = overlapAt(carry.instanceId, pipette.toolDefinitionId, point, true, pipetteSpec);
      const over = overlap.kind === "valid" && overlap.target?.definitionId === pipette.otherDefinitionId
        && (!pipette.otherInstanceId || overlap.target.id === pipette.otherInstanceId) ? overlap.target : undefined;
      let shown: CarryCallout;
      let action: PressAction = "commit";
      if (over) {
        engine.setTargetRing(over.id, "valid");
        shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady,
          pipette.kind === "draw" ? `Release to draw up from the ${otherLabel}` : `Release to empty the pipette into the ${otherLabel}`) };
        // Drawn up as the bulb is let go in the liquid; emptied once the tip is lowered into the receiver.
        if (flow.inputReady || !showGuidance) action = pipette.kind === "draw" ? "draw" : "insert";
      } else if (overlap.target && overlap.kind !== "moveOnly") {
        engine.setTargetRing(overlap.target.id, "invalid");
        shown = { ...screen, text: showGuidance ? "Not the target for this step" : "Release to try this", kind: "invalid" };
      } else {
        engine.setTargetRing(null);
        shown = showGuidance ? { ...screen, text: `Carry the pipette to the ${otherLabel}`, kind: "free" } : { ...screen, text: "Release to set down", kind: "free" };
      }
      return show(shown, action);
    }
    const overlap = overlapAt(carry.instanceId, carry.definitionId, point);
    // Tipping a solid's source onto the target while the step names a tool is refused (decided 2026-09-25),
    // as is pouring a liquid onto the pipette that should draw it up (decided 2026-09-26).
    const pouredOntoPipette = Boolean(pipette?.kind === "draw" && carry.definitionId === pipette.otherDefinitionId && overlap.target?.id === pipette.toolInstanceId);
    const tipsSource = pouredOntoPipette
      || Boolean(tool && carry.definitionId === tool.sourceDefinitionId && overlap.target?.definitionId === tool.targetDefinitionId);
    // The pour cue shows in both modes, as the 2D workbench's overlap feedback does (G-7).
    const pourCue = !tipsSource && interaction?.type === "pourInto" && overlap.kind === "valid" && overlap.target ? overlap.target.id : undefined;
    carry.liftMm = surfaceMm + LIFT_MM;
    carry.pourToward = pourCue;
    carry.rinseAt = !tipsSource && interaction?.type === "rinseTarget" && overlap.kind === "valid" && overlap.target ? overlap.target.id : undefined;
    engine.previewCarry(carry.instanceId, point.xMm, point.yMm, carry.liftMm, pourCue);
    const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
    const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
    const item = scene.bench.find((i) => i.instanceId === carry.instanceId);
    let shown: CarryCallout;
    let action: PressAction = "commit";
    if (tipsSource && overlap.target) {
      engine.setTargetRing(overlap.target.id, "invalid");
      // Coaching toward the tool shows only in guided mode (G-7); the release is refused in both.
      const coaching = pouredOntoPipette ? "Draw it up with the pipette" : `Use the ${labelOf(tool!.toolDefinitionId)} to add a solid`;
      shown = { ...screen, text: showGuidance ? coaching : "Release to try this", kind: "invalid" };
    } else if (placesForStep(carry.definitionId, carry.instanceId)) {
      engine.setTargetRing(null);
      shown = { ...screen, ...placing };
    } else if (overlap.kind === "valid" && overlap.target) {
      const targetItem = scene.bench.find((i) => i.instanceId === overlap.target!.id);
      const anchor = interaction?.type === "snapIntoTarget" && interaction.snapZoneId ? targetItem?.model?.anchors[interaction.snapZoneId]?.positionMm : undefined;
      engine.setTargetRing(overlap.target.id, "valid", anchor);
      shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady, `Release to ${lowerFirst(interaction?.accessibleLabel ?? "act")}`) };
      // Pouring tips the source as the press is dragged down; seating lowers it into the seat.
      const ready = flow.inputReady || !showGuidance;
      if (ready && (pourCue || interaction?.type === "snapIntoTarget")) action = "insert";
    } else if (overlap.kind === "invalid" && overlap.target) {
      engine.setTargetRing(overlap.target.id, "invalid");
      shown = { ...screen, text: showGuidance ? "Not the target for this step" : "Release to try this", kind: "invalid" };
    } else {
      engine.setTargetRing(null);
      const holder = item?.placement.kind === "seated" ? scene.bench.find((i) => i.instanceId === (item.placement as { parentInstanceId: string }).parentInstanceId) : undefined;
      shown = holder ? { ...screen, text: `Release to take it off ${holder.label}`, kind: "detach" } : { ...screen, text: "Release to set down", kind: "free" };
    }
    return show(shown, action);
  }, [breakUp, dropTest, engine, flow.inputReady, interaction, labelOf, markStep, overlapAt, pipette, pipetteSpec, placesForStep, scene, scoopFor, showGuidance, tipOver, tongs, toolTransfer]);

  /**
   * Pointing at an item with a seat for the carried item (a registry zone that accepts it, with a 3D
   * anchor) aims at that seat, at its height (handoff §5.6: the lift for targets above bench height;
   * "Magnetic seating", §5.7 and §5.18). A watch glass pointed anywhere at a balance, its draft shield
   * included, goes to the pan, as a hand reaches in through the door. It follows the equipment, not
   * the step, so it coaches nothing (G-7); footprints still decide the target (plan §4.1).
   */
  const seatAim = useCallback((targetId: string, carriedDefinitionId: string) => {
    const target = scene.bench.find((item) => item.instanceId === targetId);
    if (!target || target.placement.kind !== "bench") return undefined;
    for (const zone of v1InteractionZones) {
      if (zone.ownerDefinitionId !== target.definitionId || !zone.accepts.includes(carriedDefinitionId)) continue;
      const anchor = target.model?.anchors[zone.id];
      const seat = anchor ? snapZoneFootprint(target.model, target.definitionId, zone.id, target.placement.point) : undefined;
      if (anchor && seat) return { xMm: seat.xMm, yMm: seat.yMm, surfaceMm: anchor.positionMm[2] ?? 0 };
    }
    return undefined;
  }, [scene]);

  const carryToPointer = useCallback((clientX: number, clientY: number) => {
    const carry = carryRef.current;
    if (!engine || !carry) return;
    if (carry.kind === "tray" && engine.overShelf(clientX, clientY)) {
      // Back over the shelf: the item waits where it was, and letting go puts it back on its spot.
      const rect = engine.canvasElement.getBoundingClientRect();
      carry.back = true;
      carry.pressAction = "commit";
      engine.setTargetRing(null);
      const shown: CarryCallout = { x: clientX - rect.left, y: clientY - rect.top - 44, text: "Release to put it back", kind: "free" };
      setCallout(carry.click ? { ...shown, text: clickCallout(shown.text, "commit") }
        : carry.via === "gesture" ? { ...shown, text: handCallout(shown.text, "commit", { turn: false, squeeze: false }) } : shown);
      return;
    }
    // Aimed at the surface under the pointer, so a raised target is reached by pointing at it.
    const hit = engine.carryPointAt(clientX, clientY, carry.kind === "bench" ? carry.instanceId : undefined);
    if (!hit) return;
    const aim = (hit.instanceId ? seatAim(hit.instanceId, carry.definitionId) : undefined) ?? hit;
    const rect = engine.canvasElement.getBoundingClientRect();
    carryTo({ xMm: aim.xMm, yMm: aim.yMm }, { x: clientX - rect.left, y: clientY - rect.top - 44 }, aim.surfaceMm, hit.instanceId);
  }, [carryTo, engine, seatAim]);

  /** A carry from the shelf put back: nothing moved, and the item is drawn on its spot again. */
  const putBack = useCallback(() => {
    cancel();
    player.announce("Put back on the shelf. Nothing moved.");
  }, [cancel, player]);

  /**
   * A shelf item set on the bench, through the tray's own intents (`dropFromTray`). When the runtime keeps it on the
   * shelf (a timed stage's minutes are passing) nothing changed, so the item is drawn back on its spot.
   */
  const dropFromShelf = useCallback((definitionId: string, point?: BenchPoint, origin?: "pointer" | "vision", instanceId?: string) => {
    player.dropFromTray(definitionId, point, origin, instanceId);
    const after = player.runtime.getState().equipmentInstances;
    const stillThere = instanceId ? after.find((i) => i.id === instanceId)?.location === "shelf"
      : !after.some((i) => i.definitionId === definitionId && i.location !== "shelf");
    if (stillThere && engine) void engine.sync(scene);
  }, [engine, player, scene]);

  const release = useCallback(() => {
    const carry = carryRef.current;
    // The tongs (Pack 2): a press over the hot item grips it and the carry goes on; over its place, the
    // runtime records the item put there, as a hand would.
    if (engine && carry?.kind === "bench" && tongs && carry.instanceId === tongs.toolInstanceId && carry.point) {
      const at = carry.tipPoint ?? carry.point;
      if (!carry.toolLoaded) {
        if (tipOver(tongs.vesselInstanceId, carry.instanceId, at)) {
          carry.toolLoaded = true;
          setToolLoaded(true);
          engine.setToolHeld(carry.instanceId, tongs.vesselInstanceId);
          carryTo(at);
          return;
        }
      } else {
        const overlap = overlapAt(tongs.vesselInstanceId, tongs.vesselDefinitionId, at);
        if (overlap.kind === "valid" && overlap.target && (!tongs.targetInstanceId || overlap.target.id === tongs.targetInstanceId)) {
          endCarry();
          engine.endCarryPreview(true);
          engine.setToolHeld(null);
          const accepted = Boolean(player.runIntent({ type: "snapIntent", origin: carry.via === "gesture" ? "vision" : "pointer",
            sourceInstanceId: tongs.vesselInstanceId, targetInstanceId: overlap.target.id } as RuntimeInteractionIntent));
          if (!accepted) void engine.sync(scene);
          return;
        }
      }
    }
    if (engine && carry?.kind === "bench" && breakUp && carry.instanceId === breakUp.toolId && carry.point
      && tipOver(breakUp.vesselId, carry.instanceId, carry.tipPoint ?? carry.point)) {
      endCarry();
      engine.endCarryPreview(true);
      void engine.sync(scene);
      player.recordEvidence();
      return;
    }
    if (engine && carry?.kind === "bench" && carry.toolLoaded && tongs && carry.instanceId === tongs.toolInstanceId) engine.setToolHeld(null);
    endCarry();
    if (carry?.kind === "tray" && carry.back) {
      putBack();
      return;
    }
    // A shelf item pressed and released without moving is a click: the 2D next free slot (§5.10).
    if (engine && carry?.kind === "tray" && !carry.point) {
      dropFromShelf(carry.definitionId, undefined, undefined, carry.instanceId);
      return;
    }
    if (!engine || !carry || !carry.point) {
      cancel();
      return;
    }
    const point = carry.point;
    const origin = carry.via === "gesture" ? "vision" : "pointer";
    engine.endCarryPreview(true);
    if (carry.kind === "tray") {
      dropFromShelf(carry.definitionId, point, origin, carry.instanceId);
      return;
    }
    if (toolTransfer) {
      // A tool transfer: the dipped tool over the target sends the step's own pour; the source
      // tipped onto the target is refused with a correction, not a runtime attempt.
      const tool = toolTransfer;
      const isTool = carry.definitionId === tool.toolDefinitionId;
      const toolOverlap = isTool
        ? overlapAt(carry.instanceId, tool.sourceDefinitionId, carry.tipPoint ?? point, true)
        : overlapAt(carry.instanceId, carry.definitionId, point);
      const toolRelease = resolveToolRelease(tool, { definitionId: carry.definitionId, loaded: Boolean(carry.toolLoaded) }, toolOverlap, origin);
      if (toolRelease.kind === "transfer") {
        const accepted = Boolean(player.runIntent(toolRelease.intent, { instanceId: carry.instanceId, scoop: scoopFor(tool) }));
        if (!accepted) void engine.sync(scene);
        return;
      }
      if (toolRelease.kind === "useTool") {
        const toolLabel = labelOf(tool.toolDefinitionId);
        const targetLabel = labelOf(tool.targetDefinitionId);
        player.correct(`Use the ${toolLabel} to add a solid to the ${targetLabel}.`,
          `Pick up the ${toolLabel}, dip it into the ${labelOf(tool.sourceDefinitionId)}, then carry it to the ${targetLabel}.`);
        void engine.sync(scene);
        return;
      }
    }
    if (dropTest && carry.instanceId === dropTest.pipetteId && tipOver(dropTest.vesselId, carry.instanceId, carry.tipPoint ?? point)) {
      // The runtime adds the drop; the pipette is then drawn held over the beaker while it falls.
      void engine.sync(scene);
      player.recordEvidence();
      return;
    }
    const mark = markStep;
    if (mark && carry.instanceId === mark.pipetteInstanceId) {
      const markOverlap = overlapAt(carry.instanceId, mark.pipetteDefinitionId, carry.tipPoint ?? point, true);
      if (markOverlap.kind === "valid" && markOverlap.target?.id === mark.vesselInstanceId) {
        void engine.sync(scene);
        onHoldOver?.(mark.pipetteInstanceId, mark.vesselInstanceId);
        return;
      }
    }
    if (pipette) {
      // A pipette step: the pipette released over the liquid or the receiver sends the step's own
      // pour and is drawn dipping; a liquid poured onto the pipette is refused with a correction.
      const isPipette = carry.instanceId === pipette.toolInstanceId;
      const pipetteOverlap = isPipette
        ? overlapAt(carry.instanceId, pipette.toolDefinitionId, carry.tipPoint ?? point, true, pipetteSpec)
        : overlapAt(carry.instanceId, carry.definitionId, point);
      const pipetteRelease = resolvePipetteRelease(pipette, { instanceId: carry.instanceId, definitionId: carry.definitionId }, pipetteOverlap, origin);
      if (pipetteRelease.kind === "transfer") {
        const accepted = Boolean(player.runIntent(pipetteRelease.intent, { instanceId: carry.instanceId, motion: "dip" }));
        if (!accepted) void engine.sync(scene);
        return;
      }
      if (pipetteRelease.kind === "usePipette") {
        const otherItem = pipette.otherInstanceId ? scene.bench.find((i) => i.instanceId === pipette.otherInstanceId) : undefined;
        const otherLabel = otherItem ? lowerFirst(otherItem.label) : labelOf(pipette.otherDefinitionId);
        player.correct(`Draw the liquid up with the pipette; do not pour it onto the pipette.`,
          `Pick up the pipette, dip its tip into the ${otherLabel}, and release.`);
        void engine.sync(scene);
        return;
      }
    }
    const overlap = overlapAt(carry.instanceId, carry.definitionId, point);
    const state = player.runtime.getState();
    const snapTarget = interaction?.type === "snapIntoTarget" && overlap.kind === "valid" && overlap.target
      ? state.equipmentInstances.find((instance) => instance.id === overlap.target!.id)
      : undefined;
    const snapTargetPoint = snapTarget ? runtimeBenchPoints(state).get(snapTarget.id) : undefined;
    const resolution = resolveRelease({
      expectedInteraction: interaction,
      expectedActionId: player.runtime.expectedAction?.id,
      currentNodeId: player.runtime.currentNode.id,
      retryFeedback: player.runtime.currentNode.feedback.retry,
      carried: { instanceId: carry.instanceId, definitionId: carry.definitionId, label: carry.label, kind: "item" },
      releaseStation: "workbench",
      overlap,
      instances: state.equipmentInstances,
      releasePoint: fromBench(carry.definitionId, point.xMm, point.yMm),
      ...(snapTarget && snapTargetPoint
        ? { snapPoint: snapReleasePoint({ instanceId: snapTarget.id, definitionId: snapTarget.definitionId, ...snapTargetPoint }, carry.definitionId, interaction?.snapZoneId) }
        : {}),
      nextZIndex: player.nextZIndex(),
      origin,
    });
    const releasePoint = fromBench(carry.definitionId, point.xMm, point.yMm);
    // Any release the runtime does not accept changes nothing, so the item springs back to where
    // the runtime has it (G-3, G-4); an accepted one re-syncs through the new scene.
    let accepted = false;
    if (resolution.kind === "dragToZone") {
      accepted = Boolean(player.runIntent(resolution.intent));
    } else if (resolution.kind === "interaction") {
      accepted = Boolean(player.runIntent(resolution.intent));
      if (accepted && resolution.parkAfter) player.parkAfterPour(carry.instanceId, releasePoint);
    } else if (resolution.kind === "invalidOverlap") {
      player.refuse(resolution.feedback);
    } else if (resolution.kind === "freeMove") {
      player.freeMove(carry.instanceId, point.xMm, point.yMm);
      accepted = true;
    }
    if (!accepted) void engine.sync(scene);
  }, [breakUp, cancel, carryTo, dropFromShelf, dropTest, endCarry, engine, interaction, labelOf, markStep, onHoldOver, overlapAt, pipette, pipetteSpec, player,
    putBack, scene, scoopFor, tipOver, tongs, toolTransfer]);

  /**
   * Keyboard carry (§5.6): the item lifts where it stands. Probes do not free-move (parity), so
   * they cannot be picked up. Returns whether a carry started.
   */
  const startKeyCarry = useCallback((instanceId: string): boolean => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    const base = engine?.basePosition(instanceId);
    // Nothing is picked up while a committed pour, weighing, tool transfer or swirl is being drawn.
    if (overflowRefused(item?.instanceId)) return true;
    if (!engine || !item || !base || pouringRef.current || getVisualProfile(item.definitionId)?.probePresentation) return false;
    if (heldBack(instanceId)) return true;
    if (carryRef.current) cancel();
    carryRef.current = { kind: "bench", via: "keyboard", instanceId, definitionId: item.definitionId, label: item.label,
      startX: 0, startY: 0, active: true, pointerType: "keyboard" };
    setCarrying(true);
    setKeyCarrying(true);
    // A tool is held by its working end, so the carry starts from where that end lies.
    const offset = toolTransfer?.toolDefinitionId === item.definitionId ? engine.solidRestOffsetMm(instanceId)
      : (tongs?.toolInstanceId === instanceId || breakUp?.toolId === instanceId) ? engine.tipOffsetMm(instanceId) : undefined;
    carryTo({ xMm: base.x / MM + (offset?.xMm ?? 0), yMm: -base.z / MM + (offset?.yMm ?? 0) });
    player.announce(`Carrying ${item.label}. Arrow keys move it, Shift moves further, [ and ] step through targets. Enter sets it down; Escape cancels.`);
    return true;
  }, [cancel, carryTo, engine, overflowRefused, player, scene, toolTransfer]);

  /** Keys while a keyboard carry is under way; returns whether the key was used. */
  const handleCarryKey = useCallback((event: KeyboardEvent): boolean => {
    const carry = carryRef.current;
    if (!carry || carry.kind !== "bench" || carry.via !== "keyboard" || !carry.point) return false;
    const direction = arrowDirection(event.key);
    if (direction) {
      carryTo(nudgePoint(carry.tipPoint ?? carry.point, direction, event.shiftKey));
      return true;
    }
    if (event.key === "[" || event.key === "]") {
      const targets = spatialOrder(candidates(carry.instanceId).map((c) => ({ ...c, id: c.instanceId, xMm: c.footprint.xMm, yMm: c.footprint.yMm })));
      if (targets.length === 0) return true;
      carry.targetIndex = cycleIndex(targets.length, carry.targetIndex, event.key === "]" ? 1 : -1);
      const target = targets[carry.targetIndex];
      // As with the pointer: a target with a seat for the carried item is reached at its seat.
      const seat = seatAim(target.id, carry.definitionId);
      const shown = seat
        ? carryTo({ xMm: seat.xMm, yMm: seat.yMm }, undefined, seat.surfaceMm, target.id)
        : carryTo({ xMm: target.xMm, yMm: target.yMm }, undefined, target.surfaceMm ?? 0, target.id);
      player.announce(`${target.label}. ${shown?.text ?? ""}`);
      return true;
    }
    if (event.key === "Enter") {
      release();
      return true;
    }
    if (event.key === "Escape") {
      cancel();
      player.announce("Carry cancelled. Nothing moved.");
      return true;
    }
    return false;
  }, [cancel, candidates, carryTo, player, release, seatAim]);

  /** Draw a stroke's depth (0..1): the item lowered toward its target, a pour source tipped further. */
  const drawDepth = useCallback((carry: Carry, depth: number, kind: Exclude<PressAction, "commit">) => {
    if (!engine || carry.kind !== "bench" || !carry.point) return;
    const at = carry.tipPoint ?? carry.point;
    const lift = carry.liftMm ?? LIFT_MM;
    const lowered = kind === "insert" && carry.pourToward ? lift : lift - LIFT_MM * depth;
    // A tool is drawn by its centre; its working end is `tipPoint`.
    const drawAt = toolTransfer && carry.definitionId === toolTransfer.toolDefinitionId ? carry.point : at;
    engine.previewCarry(carry.instanceId, drawAt.xMm, drawAt.yMm, Math.max(0, lowered), carry.pourToward, 30 + 30 * depth);
  }, [engine, toolTransfer]);

  // Pointer handling on the canvas. The mouse follows the DNA microarray lab's controller (decided
  // 2026-10-04; `3d-v3/app.js:111-131`, `interaction.js:210-211`): a press on an item picks it up at
  // once and it follows the pointer, no button held; the next press acts where it is (`pressAction`)
  // and a press on a seat, a pour target or a liquid is dragged down to depth. Touch keeps press and
  // hold, drag and release (§5.6), since the source has no touch control.
  useEffect(() => {
    if (!engine) return undefined;
    const canvas = engine.canvasElement;
    let holdTimer = 0;
    // A control (the TARE key) pressed: it acts on release without moving, and is never carried.
    let pressed: { instanceId: string; controlId: string; x: number; y: number } | undefined;
    const isMouse = (event: PointerEvent) => event.pointerType !== "touch";

    /**
     * A press on an item on the shelf takes it, as the tray's tile did: with a mouse it follows the pointer until the
     * next press; on touch it follows the finger and is set down where the finger lifts, or a tap places it.
     */
    const takeFromShelf = (shelfItem: SceneItem, event: PointerEvent) => {
      if (carryRef.current) cancel();
      const mouse = isMouse(event);
      carryRef.current = { kind: "tray", via: "pointer", definitionId: shelfItem.definitionId, instanceId: shelfItem.instanceId, click: mouse,
        pickedAt: mouse ? { x: event.clientX, y: event.clientY, t: performance.now() } : undefined };
      setCarrying(true);
      if (mouse) {
        canvas.style.cursor = "grabbing";
        carryToPointer(event.clientX, event.clientY);
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      engine.holdCameraInput(true);
    };

    /** A press with an item held by a mouse carry. */
    const pressWhileCarrying = (carry: Carry, event: PointerEvent) => {
      const { clientX: x, clientY: y } = event;
      // A second press at once where it was picked up is a double-click: it goes back, and Examine opens.
      if (carry.pickedAt && performance.now() - carry.pickedAt.t < 450
        && Math.hypot(x - carry.pickedAt.x, y - carry.pickedAt.y) < 6) {
        cancel();
        return;
      }
      carryToPointer(x, y);
      const action = carry.pressAction ?? "commit";
      if (action === "commit" || carry.kind === "tray") {
        release();
        return;
      }
      carry.stroke = { kind: action, startY: y, depth: 0 };
      canvas.setPointerCapture(event.pointerId);
    };

    /** The stroke's depth follows the pointer down; dragging back above the press withdraws. */
    const strokeMove = (carry: Carry, stroke: Stroke, clientX: number, clientY: number) => {
      const dy = clientY - stroke.startY;
      if (dy < -STROKE.withdrawPx) {
        carry.stroke = undefined;
        carryToPointer(clientX, clientY);
        return;
      }
      stroke.depth = strokeDepth(dy);
      drawDepth(carry, stroke.depth, stroke.kind);
      if (stroke.depth < STROKE.act) return;
      // A seat, pour, delivery or draw waits for the button to be let go (G-5); a scoop is only a cue.
      if (stroke.kind === "dip" && carry.kind === "bench" && toolTransfer) {
        carry.stroke = undefined;
        carry.toolLoaded = true;
        setToolLoaded(true);
        engine.setToolLoad(carry.instanceId, scoopFor(toolTransfer));
        if (carry.tipPoint) carryTo(carry.tipPoint);
      }
    };

    /** The button let go during a stroke: at depth a seat, pour, delivery or draw acts; short of it nothing changes. */
    const strokeUp = (carry: Carry, stroke: Stroke) => {
      carry.stroke = undefined;
      if ((stroke.kind === "insert" || stroke.kind === "draw") && stroke.depth >= STROKE.act) {
        release();
        return;
      }
      if (stroke.kind !== "dip") {
        player.notify(stroke.kind === "draw" ? "Nothing drawn. Press over the liquid, drag down into it, then let go."
          : "Nothing done. Press on the target, drag down and let go.");
      } else if (stroke.kind === "dip" && !(carry.kind === "bench" && carry.toolLoaded)) {
        player.notify("Nothing scooped. Press over the solid and drag down into it.");
      }
      if (carry.kind === "bench" && carry.point) carryTo(carry.tipPoint ?? carry.point);
    };

    const down = (event: PointerEvent) => {
      // Nothing is picked up while a committed pour is still being drawn; reaching for the beaker while
      // the filter drains is refused as an overflow.
      if (event.button !== 0) return;
      if (pouringRef.current) {
        const picked = carryRef.current ? undefined : engine.pick(event.clientX, event.clientY);
        if (picked && !overflowRefused(picked)) onBusyPress?.(picked);
        return;
      }
      const current = carryRef.current;
      if (current?.click && isMouse(event)) {
        pressWhileCarrying(current, event);
        return;
      }
      if (current?.kind === "bench" && current.via === "keyboard") cancel();
      const control = onControl ? engine.pickControl(event.clientX, event.clientY) : undefined;
      if (control) {
        pressed = { ...control, x: event.clientX, y: event.clientY };
        return;
      }
      const id = engine.pick(event.clientX, event.clientY);
      const item = id ? scene.bench.find((i) => i.instanceId === id) : undefined;
      if (!item) {
        const shelfId = engine.pickShelf(event.clientX, event.clientY);
        const onShelf = shelfId ? scene.tray.find((i) => i.instanceId === shelfId) : undefined;
        if (onShelf) takeFromShelf(onShelf, event);
        return;
      }
      if (isMouse(event)) {
        // A press selects the item; at an inversion step it inverts the stoppered vessel instead.
        if (onTap?.(item.instanceId, event.pointerType, event.clientX, event.clientY) === true) return;
        // Probes (a visual profile with probePresentation, as in 2D) move only as part of their interaction.
        if (getVisualProfile(item.definitionId)?.probePresentation) return;
        if (heldBack(item.instanceId)) return;
        carryRef.current = { kind: "bench", via: "pointer", click: true, instanceId: item.instanceId, definitionId: item.definitionId, label: item.label,
          startX: event.clientX, startY: event.clientY, active: true, pointerType: event.pointerType,
          pickedAt: { x: event.clientX, y: event.clientY, t: performance.now() } };
        setCarrying(true);
        canvas.style.cursor = "grabbing";
        carryToPointer(event.clientX, event.clientY);
        return;
      }
      if (getVisualProfile(item.definitionId)?.probePresentation) return;
      if (heldBack(item.instanceId)) return;
      carryRef.current = { kind: "bench", via: "pointer", instanceId: item.instanceId, definitionId: item.definitionId, label: item.label,
        startX: event.clientX, startY: event.clientY, active: false, pointerType: event.pointerType };
      canvas.setPointerCapture(event.pointerId);
      engine.holdCameraInput(true);
      holdTimer = window.setTimeout(() => {
        const carry = carryRef.current;
        if (carry?.kind === "bench" && !carry.active) {
          carry.active = true;
          setCarrying(true);
          carryToPointer(carry.startX, carry.startY);
        }
      }, 300);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && mouseIgnoredRef.current?.()) return;
      const carry = carryRef.current;
      if (carry?.click) {
        if (carry.stroke) {
          strokeMove(carry, carry.stroke, event.clientX, event.clientY);
          return;
        }
        if (benchCanvasUnder(canvas, event.clientX, event.clientY)) {
          carryToPointer(event.clientX, event.clientY);
          return;
        }
        // Over a panel or the dock the item waits where it was, and no target is cued.
        engine.setTargetRing(null);
        setCallout(undefined);
        return;
      }
      if (!carry || carry.via !== "pointer") {
        if (!carry) {
          // A shelf item names itself on hover too (the shelf in place of the tray).
          onHover(engine.pick(event.clientX, event.clientY) ?? engine.pickShelf(event.clientX, event.clientY));
          canvas.style.cursor = onControl && engine.pickControl(event.clientX, event.clientY) ? "pointer" : "";
        }
        return;
      }
      if (carry.kind === "bench" && !carry.active) {
        if (Math.hypot(event.clientX - carry.startX, event.clientY - carry.startY) < 4 || carry.pointerType === "touch") return;
        carry.active = true;
        setCarrying(true);
      }
      carryToPointer(event.clientX, event.clientY);
    };
    const up = (event: PointerEvent) => {
      const carry = carryRef.current;
      if (carry?.click) {
        // The press that picked it up, or set it down, ends here; a stroke acts or ends.
        if (carry.stroke) strokeUp(carry, carry.stroke);
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      window.clearTimeout(holdTimer);
      engine.holdCameraInput(false);
      if (pressed) {
        const control = pressed;
        pressed = undefined;
        if (Math.hypot(event.clientX - control.x, event.clientY - control.y) < 8) onControl?.(control.instanceId, control.controlId);
        return;
      }
      if (!carry || carry.via !== "pointer") return;
      if (carry.kind === "bench" && !carry.active) {
        carryRef.current = undefined;
        onTap?.(carry.instanceId, carry.pointerType, event.clientX, event.clientY);
        return;
      }
      release();
    };
    // A mouse carry ends without moving anything when a press lands outside the bench (a panel or
    // the dock), so no control acts on an item drawn where the runtime does not have it.
    const elsewhere = (event: PointerEvent) => {
      if (carryRef.current?.click && event.target !== canvas) cancel();
    };
    const key = (event: KeyboardEvent) => {
      const carry = carryRef.current;
      if (event.key === "Escape" && carry && !(carry.kind === "bench" && carry.via === "keyboard")) cancel();
    };
    // A keyboard carry belongs to the focused bench; leaving it drops the carry without committing.
    const blur = () => {
      if (carryRef.current?.kind === "bench" && carryRef.current.via === "keyboard") cancel();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("blur", blur);
    window.addEventListener("pointerdown", elsewhere, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(holdTimer);
      engine.holdCameraInput(false);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("blur", blur);
      window.removeEventListener("pointerdown", elsewhere, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
    };
  }, [cancel, carryTo, carryToPointer, drawDepth, engine, onBusyPress, onControl, onHover, onTap, overflowRefused, player, release, scene, scoopFor, toolTransfer]);

  /** Whether a bench item can be carried now: probes move only as part of their interaction (parity). */
  const canCarry = useCallback((instanceId: string): boolean => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    return Boolean(engine && item && !pouringRef.current && !getVisualProfile(item.definitionId)?.probePresentation && !heldBack(instanceId));
  }, [engine, scene, heldBack]);

  /**
   * Whether a client point is over the bench, where a gesture carry follows and can commit: the
   * canvas itself is the element there (no panel, tray or dock covers it) and the ray meets the bench.
   * Letting go anywhere else changes nothing.
   */
  const overBench = useCallback((clientX: number, clientY: number): boolean =>
    Boolean(engine && benchCanvasUnder(engine.canvasElement, clientX, clientY) && engine.benchPointAt(clientX, clientY)),
  [engine]);

  /** Hand control: a closed grip held on a bench item lifts it. */
  const startGestureCarry = useCallback((instanceId: string): boolean => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    if (overflowRefused(item?.instanceId)) return false;
    if (!item || !canCarry(instanceId)) return false;
    // A keyboard carry gives way, as it does to the pointer.
    if (carryRef.current) cancel();
    carryRef.current = { kind: "bench", via: "gesture", instanceId, definitionId: item.definitionId, label: item.label,
      startX: 0, startY: 0, active: true, pointerType: "gesture" };
    setCarrying(true);
    return true;
  }, [canCarry, cancel, overflowRefused, scene]);

  /** Hand control: a closed grip held on a shelf item starts the same carry a pointer press on it does. */
  const startGestureTrayCarry = useCallback((definitionId: string, instanceId?: string): boolean => {
    if (pouringRef.current) return false;
    if (carryRef.current) cancel();
    carryRef.current = { kind: "tray", via: "gesture", definitionId, instanceId };
    setCarrying(true);
    return true;
  }, [cancel]);

  /**
   * The hand moved: over the bench, the gesture carry follows it as the pointer's does. Off the
   * bench a release would change nothing, so the item waits where it last was and no target is cued,
   * as the 2D preview shows no overlap off the workbench. Never commits.
   */
  const gestureCarryTo = useCallback((clientX: number, clientY: number) => {
    const carry = carryRef.current;
    if (carry?.via !== "gesture" || !engine) return;
    if (overBench(clientX, clientY)) {
      carryToPointer(clientX, clientY);
      return;
    }
    if (carry.kind === "bench" && carry.point) engine.previewCarry(carry.instanceId, carry.point.xMm, carry.point.yMm, carry.liftMm ?? LIFT_MM);
    // Off the bench nothing is aimed at, so letting go here only puts the item back.
    carry.pressAction = "commit";
    carry.pourToward = undefined;
    if (carry.kind === "bench") { carry.lastKind = undefined; carry.rinseAt = undefined; }
    engine.setTargetRing(null);
    setCallout(undefined);
  }, [carryToPointer, engine, overBench]);

  /** The hand let go: over the bench it commits through the pointer's release; elsewhere nothing changes. */
  const releaseGesture = useCallback((clientX: number, clientY: number) => {
    if (carryRef.current?.via !== "gesture") return;
    if (!overBench(clientX, clientY)) {
      cancel();
      return;
    }
    carryToPointer(clientX, clientY);
    release();
  }, [cancel, carryToPointer, overBench, release]);

  /** Drop an unfinished hand carry without committing. */
  const cancelGesture = useCallback(() => {
    if (carryRef.current?.via === "gesture") cancel();
  }, [cancel]);

  /**
   * Hand control (the microarray lab's controller, decided 2026-10-04): what the hand's carry would
   * do where it is now. A pour, or a dipped tool over its target, acts on a turn of the palm.
   */
  const gestureAction = useCallback((): { action: PressAction; pour: boolean; tip: boolean; squeeze: boolean; rinse: boolean } | undefined => {
    const carry = carryRef.current;
    if (carry?.via !== "gesture") return undefined;
    const action = carry.pressAction ?? "commit";
    if (carry.kind === "tray") return { action: "commit", pour: false, tip: false, squeeze: false, rinse: false };
    const tool = Boolean(toolTransfer && carry.definitionId === toolTransfer.toolDefinitionId);
    // A pipette over the receiver it empties into delivers when its bulb is squeezed at depth.
    const squeeze = action === "insert" && pipette?.kind === "deliver" && carry.instanceId === pipette.toolInstanceId;
    // A wash bottle over what it rinses squirts when it is squeezed (decided 2026-10-04).
    const rinse = action === "commit" && Boolean(carry.rinseAt);
    return { action, pour: action === "insert" && Boolean(carry.pourToward), tip: tool && Boolean(carry.toolLoaded) && carry.lastKind === "valid", squeeze, rinse };
  }, [pipette, toolTransfer]);

  /** Hand control: draw the carried item at a stroke depth (0..1). */
  const gestureDepth = useCallback((depth: number) => {
    const carry = carryRef.current;
    if (carry?.via !== "gesture" || carry.kind !== "bench") return;
    const action = carry.pressAction ?? "commit";
    if (depth <= 0 && carry.point) carryTo(carry.tipPoint ?? carry.point);
    else drawDepth(carry, depth, action === "commit" ? "insert" : action);
  }, [carryTo, drawDepth]);

  /** Hand control: the spatula lowered into the solid takes its scoop. */
  const loadGestureTool = useCallback(() => {
    const carry = carryRef.current;
    if (!engine || carry?.via !== "gesture" || carry.kind !== "bench" || !toolTransfer || carry.definitionId !== toolTransfer.toolDefinitionId) return;
    carry.toolLoaded = true;
    setToolLoaded(true);
    engine.setToolLoad(carry.instanceId, scoopFor(toolTransfer));
    if (carry.tipPoint) carryTo(carry.tipPoint);
  }, [carryTo, engine, scoopFor, toolTransfer]);

  // A mouse carry in the microarray model (it follows the pointer until the next press).
  const clickCarrying = Boolean(carrying && carryRef.current?.click);
  const gestureCarrying = Boolean(carrying && carryRef.current?.via === "gesture");
  return { callout, carrying, clickCarrying, gestureCarrying, carriedDefinitionId, keyCarrying, toolTransfer, toolLoaded, startKeyCarry, handleCarryKey, cancel,
    canCarry, startGestureCarry, startGestureTrayCarry, gestureCarryTo, releaseGesture, cancelGesture, gestureAction, gestureDepth, loadGestureTool };
};

const lowerFirst = (text: string) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);
