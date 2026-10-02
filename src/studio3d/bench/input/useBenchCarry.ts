import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v1InteractionZones } from "../../../domain/interactionZones";
import { equipmentById } from "../../../equipment/catalog";
import { getVisualProfile } from "../../../equipment/visualCatalog";
import { fromBench, runtimeBenchPoints } from "../../adapters/benchCoordinates";
import { classifyOverlap, footprintOf, snapClassification, snapZoneFootprint, type FootprintCandidate } from "../../adapters/footprints";
import { pointInFootprint, resolvePipetteRelease, resolveRelease, resolveToolRelease, snapReleasePoint, type ToolTransfer } from "../../adapters/sceneToIntent";
import type { ActionInteractionSpec } from "../../../domain/types";
import type { SceneContents, SceneItem } from "../../adapters/runtimeToScene";
import type { Player3DController } from "../../player/usePlayer3D";
import type { BenchEngine } from "../BenchEngine";
import { arrowDirection, cycleIndex, nudgePoint, spatialOrder, type BenchPoint } from "./keyboard";
import { benchCanvasUnder } from "./targetResolver";

/**
 * Picking up and setting down on the 3D bench (handoff §5.6). A press becomes a carry after 4 px
 * of movement or 120 ms (300 ms on touch); from the keyboard, Enter on a selected item (or Move…
 * in the Bench list) starts one, arrows move it and `[` `]` step through candidate targets. While
 * carrying, the item is drawn lifted with its footprint, and overlap is classified by the shared
 * 2D rule; nothing commits until release or Enter (G-5). Both ways in release through the same
 * `resolveRelease`, in the 2D order. Esc cancels. Tray tiles start a carry of an item that is not
 * yet on the bench. Hand control (the shared gesture bridge, plan D6) carries through the same path:
 * a pinch lifts the item, the pinch point moves it over the bench, and releasing over the bench
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

type Carry =
  | { kind: "bench"; via: "pointer" | "keyboard" | "gesture"; instanceId: string; definitionId: string; label: string; startX: number; startY: number;
      active: boolean; pointerType: string; point?: BenchPoint; liftMm?: number; targetIndex?: number;
      /** A tool (the spatula) that has been dipped into the step's solid source during this carry. */
      toolLoaded?: boolean;
      /** Where a tool's working end (the spoon) is aimed; `point` is then where the tool's centre is. */
      tipPoint?: BenchPoint }
  | { kind: "tray"; via: "pointer" | "gesture"; definitionId: string; point?: BenchPoint };

const LIFT_MM = 16;
/** A tool's working end, judged as a small square over the source and the target. */
const TIP_MM = 12;
const MM = 0.001;

/** A press released without carrying: a tap on an item (§5.19 "Touch: tap · Select"). */
export type TapHandler = (instanceId: string, pointerType: string, clientX: number, clientY: number) => void;

/** A control on an instrument (the balance's TARE key) pressed and released without moving. */
export type ControlHandler = (instanceId: string, controlId: string) => void;

/** A pipette released over the vessel of a drop-to-the-line step: it is held there (decided 2026-10-02). */
export type HoldOverHandler = (pipetteId: string, vesselId: string) => void;

export const useBenchCarry = (engine: BenchEngine | undefined, player: Player3DController, onHover: (instanceId?: string) => void,
  onTap?: TapHandler, onControl?: ControlHandler, onHoldOver?: HoldOverHandler) => {
  const carryRef = useRef<Carry | undefined>(undefined);
  const [callout, setCallout] = useState<CarryCallout>();
  // What is being carried, by definition (the tool's guidance follows it); undefined when nothing is.
  const [carriedDefinitionId, setCarriedDefinitionId] = useState<string>();
  const carrying = Boolean(carriedDefinitionId);
  const setCarrying = useCallback((on: boolean) => setCarriedDefinitionId(on ? carryRef.current?.definitionId : undefined), []);
  const [keyCarrying, setKeyCarrying] = useState(false);
  const [toolLoaded, setToolLoaded] = useState(false);
  const { scene, interaction, showGuidance, flow } = player;
  // Nothing is picked up while a committed pour, weighing or tool transfer is being drawn.
  const pouringRef = useRef(false);
  pouringRef.current = Boolean(player.pour || player.weighing || player.toolDeposit);

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
  const placesForStep = useCallback((definitionId: string): boolean =>
    interaction?.type === "dragToZone" && interaction.sourceDefinitionId === definitionId
    && (interaction.stationId ?? "workbench") === "workbench" && !flow.nodeCompleted,
  [flow.nodeCompleted, interaction]);

  const endCarry = useCallback(() => {
    carryRef.current = undefined;
    setCarrying(false);
    setKeyCarrying(false);
    setCallout(undefined);
    setToolLoaded(false);
    engine?.setToolLoad(null);
  }, [engine]);

  const cancel = useCallback(() => {
    endCarry();
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
    // Over the expected station (§5.6): "Release to place" in guided mode, neutral in assessment.
    const placing = acceptedDropCallout(showGuidance, flow.inputReady, "Release to place");
    if (carry.kind === "tray") {
      const shown: CarryCallout = placesForStep(carry.definitionId)
        ? { ...(screenAt ?? { x: 0, y: 0 }), ...placing }
        : { ...(screenAt ?? { x: 0, y: 0 }), text: "Release to set down", kind: "free" };
      setCallout(shown);
      return shown;
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
      if (overSource && !carry.toolLoaded) {
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
      if (overSource) {
        engine.setTargetRing(tool.sourceInstanceId, "valid");
        // What happened, not coaching, so it reads the same in both modes.
        shown = { ...screen, text: `Scooped from the ${sourceLabel}`, kind: "valid" };
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
      setCallout(shown);
      return shown;
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
      setCallout(shown);
      return shown;
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
      if (over) {
        engine.setTargetRing(over.id, "valid");
        shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady,
          pipette.kind === "draw" ? `Release to draw up from the ${otherLabel}` : `Release to empty the pipette into the ${otherLabel}`) };
      } else if (overlap.target && overlap.kind !== "moveOnly") {
        engine.setTargetRing(overlap.target.id, "invalid");
        shown = { ...screen, text: showGuidance ? "Not the target for this step" : "Release to try this", kind: "invalid" };
      } else {
        engine.setTargetRing(null);
        shown = showGuidance ? { ...screen, text: `Carry the pipette to the ${otherLabel}`, kind: "free" } : { ...screen, text: "Release to set down", kind: "free" };
      }
      setCallout(shown);
      return shown;
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
    engine.previewCarry(carry.instanceId, point.xMm, point.yMm, carry.liftMm, pourCue);
    const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
    const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
    const item = scene.bench.find((i) => i.instanceId === carry.instanceId);
    let shown: CarryCallout;
    if (tipsSource && overlap.target) {
      engine.setTargetRing(overlap.target.id, "invalid");
      // Coaching toward the tool shows only in guided mode (G-7); the release is refused in both.
      const coaching = pouredOntoPipette ? "Draw it up with the pipette" : `Use the ${labelOf(tool!.toolDefinitionId)} to add a solid`;
      shown = { ...screen, text: showGuidance ? coaching : "Release to try this", kind: "invalid" };
    } else if (placesForStep(carry.definitionId)) {
      engine.setTargetRing(null);
      shown = { ...screen, ...placing };
    } else if (overlap.kind === "valid" && overlap.target) {
      const targetItem = scene.bench.find((i) => i.instanceId === overlap.target!.id);
      const anchor = interaction?.type === "snapIntoTarget" && interaction.snapZoneId ? targetItem?.model?.anchors[interaction.snapZoneId]?.positionMm : undefined;
      engine.setTargetRing(overlap.target.id, "valid", anchor);
      shown = { ...screen, ...acceptedDropCallout(showGuidance, flow.inputReady, `Release to ${lowerFirst(interaction?.accessibleLabel ?? "act")}`) };
    } else if (overlap.kind === "invalid" && overlap.target) {
      engine.setTargetRing(overlap.target.id, "invalid");
      shown = { ...screen, text: showGuidance ? "Not the target for this step" : "Release to try this", kind: "invalid" };
    } else {
      engine.setTargetRing(null);
      const holder = item?.placement.kind === "seated" ? scene.bench.find((i) => i.instanceId === (item.placement as { parentInstanceId: string }).parentInstanceId) : undefined;
      shown = holder ? { ...screen, text: `Release to take it off ${holder.label}`, kind: "detach" } : { ...screen, text: "Release to set down", kind: "free" };
    }
    setCallout(shown);
    return shown;
  }, [engine, flow.inputReady, interaction, labelOf, markStep, overlapAt, pipette, pipetteSpec, placesForStep, scene, scoopFor, showGuidance, toolTransfer]);

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
    // Aimed at the surface under the pointer, so a raised target is reached by pointing at it.
    const hit = engine.carryPointAt(clientX, clientY, carry.kind === "bench" ? carry.instanceId : undefined);
    if (!hit) return;
    const aim = (hit.instanceId ? seatAim(hit.instanceId, carry.definitionId) : undefined) ?? hit;
    const rect = engine.canvasElement.getBoundingClientRect();
    carryTo({ xMm: aim.xMm, yMm: aim.yMm }, { x: clientX - rect.left, y: clientY - rect.top - 44 }, aim.surfaceMm, hit.instanceId);
  }, [carryTo, engine, seatAim]);

  const release = useCallback(() => {
    const carry = carryRef.current;
    endCarry();
    // A tray tile pressed and released without moving is a click: the 2D next free slot (§5.10).
    if (engine && carry?.kind === "tray" && !carry.point) {
      player.dropFromTray(carry.definitionId);
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
      player.dropFromTray(carry.definitionId, point, origin);
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
  }, [cancel, endCarry, engine, interaction, labelOf, markStep, onHoldOver, overlapAt, pipette, pipetteSpec, player, scene, scoopFor, toolTransfer]);

  /**
   * Keyboard carry (§5.6): the item lifts where it stands. Probes do not free-move (parity), so
   * they cannot be picked up. Returns whether a carry started.
   */
  const startKeyCarry = useCallback((instanceId: string): boolean => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    const base = engine?.basePosition(instanceId);
    if (!engine || !item || !base || player.pour || getVisualProfile(item.definitionId)?.probePresentation) return false;
    if (carryRef.current) cancel();
    carryRef.current = { kind: "bench", via: "keyboard", instanceId, definitionId: item.definitionId, label: item.label,
      startX: 0, startY: 0, active: true, pointerType: "keyboard" };
    setCarrying(true);
    setKeyCarrying(true);
    // A tool is held by its working end, so the carry starts from where that end lies.
    const offset = toolTransfer?.toolDefinitionId === item.definitionId ? engine.solidRestOffsetMm(instanceId) : undefined;
    carryTo({ xMm: base.x / MM + (offset?.xMm ?? 0), yMm: -base.z / MM + (offset?.yMm ?? 0) });
    player.announce(`Carrying ${item.label}. Arrow keys move it, Shift moves further, [ and ] step through targets. Enter sets it down; Escape cancels.`);
    return true;
  }, [cancel, carryTo, engine, player, scene, toolTransfer]);

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

  // Pointer handling on the canvas.
  useEffect(() => {
    if (!engine) return undefined;
    const canvas = engine.canvasElement;
    let holdTimer = 0;
    // A control (the TARE key) pressed: it acts on release without moving, and is never carried.
    let pressed: { instanceId: string; controlId: string; x: number; y: number } | undefined;
    const down = (event: PointerEvent) => {
      // Nothing is picked up while a committed pour is still being drawn.
      if (event.button !== 0 || pouringRef.current) return;
      if (carryRef.current?.kind === "bench" && carryRef.current.via === "keyboard") cancel();
      const control = onControl ? engine.pickControl(event.clientX, event.clientY) : undefined;
      if (control) {
        pressed = { ...control, x: event.clientX, y: event.clientY };
        return;
      }
      const id = engine.pick(event.clientX, event.clientY);
      const item = id ? scene.bench.find((i) => i.instanceId === id) : undefined;
      if (!item) return;
      // Probes (a visual profile with probePresentation, as in 2D) move only as part of their interaction.
      if (getVisualProfile(item.definitionId)?.probePresentation) return;
      carryRef.current = { kind: "bench", via: "pointer", instanceId: item.instanceId, definitionId: item.definitionId, label: item.label,
        startX: event.clientX, startY: event.clientY, active: false, pointerType: event.pointerType };
      canvas.setPointerCapture(event.pointerId);
      engine.holdCameraInput(true);
      const holdMs = event.pointerType === "touch" ? 300 : 120;
      holdTimer = window.setTimeout(() => {
        const carry = carryRef.current;
        if (carry?.kind === "bench" && !carry.active) {
          carry.active = true;
          setCarrying(true);
          carryToPointer(carry.startX, carry.startY);
        }
      }, holdMs);
    };
    const move = (event: PointerEvent) => {
      const carry = carryRef.current;
      if (!carry || carry.via !== "pointer") {
        if (!carry) {
          onHover(engine.pick(event.clientX, event.clientY));
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
      window.clearTimeout(holdTimer);
      engine.holdCameraInput(false);
      if (pressed) {
        const control = pressed;
        pressed = undefined;
        if (Math.hypot(event.clientX - control.x, event.clientY - control.y) < 8) onControl?.(control.instanceId, control.controlId);
        return;
      }
      const carry = carryRef.current;
      if (!carry || carry.via !== "pointer") return;
      if (carry.kind === "bench" && !carry.active) {
        carryRef.current = undefined;
        onTap?.(carry.instanceId, carry.pointerType, event.clientX, event.clientY);
        return;
      }
      release();
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
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(holdTimer);
      engine.holdCameraInput(false);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("blur", blur);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
    };
  }, [cancel, carryToPointer, engine, onControl, onHover, onTap, release, scene]);

  /** Start carrying a tray item (pointer down on its tile). */
  const startTrayCarry = useCallback((definitionId: string) => {
    if (pouringRef.current) return;
    carryRef.current = { kind: "tray", via: "pointer", definitionId };
    setCarrying(true);
  }, []);

  /** Whether a bench item can be carried now: probes move only as part of their interaction (parity). */
  const canCarry = useCallback((instanceId: string): boolean => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    return Boolean(engine && item && !pouringRef.current && !getVisualProfile(item.definitionId)?.probePresentation);
  }, [engine, scene]);

  /**
   * Whether a client point is over the bench, where a gesture carry follows and can commit: the
   * canvas itself is the element there (no panel, tray or dock covers it) and the ray meets the bench.
   * This is the 3D form of the 2D bridge's "release over the workbench".
   */
  const overBench = useCallback((clientX: number, clientY: number): boolean =>
    Boolean(engine && benchCanvasUnder(engine.canvasElement, clientX, clientY) && engine.benchPointAt(clientX, clientY)),
  [engine]);

  /** Hand control: a pinch on a bench item lifts it at once, as a pointer carry does after 4 px. */
  const startGestureCarry = useCallback((instanceId: string): boolean => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    if (!item || !canCarry(instanceId)) return false;
    // A keyboard carry gives way, as it does to the pointer.
    if (carryRef.current) cancel();
    carryRef.current = { kind: "bench", via: "gesture", instanceId, definitionId: item.definitionId, label: item.label,
      startX: 0, startY: 0, active: true, pointerType: "gesture" };
    setCarrying(true);
    return true;
  }, [canCarry, cancel, scene]);

  /** Hand control: a pinch on a tray tile starts the same tray carry a pointer press does. */
  const startGestureTrayCarry = useCallback((definitionId: string): boolean => {
    if (pouringRef.current) return false;
    if (carryRef.current) cancel();
    carryRef.current = { kind: "tray", via: "gesture", definitionId };
    setCarrying(true);
    return true;
  }, [cancel]);

  /**
   * The pinch point moved: over the bench, the gesture carry follows it as the pointer's does. Off the
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
    engine.setTargetRing(null);
    setCallout(undefined);
  }, [carryToPointer, engine, overBench]);

  /** The pinch was released: over the bench it commits through the pointer's release; elsewhere nothing changes. */
  const releaseGesture = useCallback((clientX: number, clientY: number) => {
    if (carryRef.current?.via !== "gesture") return;
    if (!overBench(clientX, clientY)) {
      cancel();
      return;
    }
    carryToPointer(clientX, clientY);
    release();
  }, [cancel, carryToPointer, overBench, release]);

  /** Drop an unfinished gesture carry without committing (the bridge cancelled it). */
  const cancelGesture = useCallback(() => {
    if (carryRef.current?.via === "gesture") cancel();
  }, [cancel]);

  return { callout, carrying, carriedDefinitionId, keyCarrying, toolTransfer, toolLoaded, startTrayCarry, startKeyCarry, handleCarryKey, cancel,
    canCarry, startGestureCarry, startGestureTrayCarry, gestureCarryTo, releaseGesture, cancelGesture };
};

const lowerFirst = (text: string) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);
