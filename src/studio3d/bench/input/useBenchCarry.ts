import { useCallback, useEffect, useRef, useState } from "react";
import { getVisualProfile } from "../../../equipment/visualCatalog";
import { fromBench, runtimeBenchPoints } from "../../adapters/benchCoordinates";
import { classifyOverlap, footprintOf, snapClassification, type FootprintCandidate } from "../../adapters/footprints";
import { resolveRelease, snapReleasePoint } from "../../adapters/sceneToIntent";
import type { SceneItem } from "../../adapters/runtimeToScene";
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
  kind: "valid" | "invalid" | "free" | "detach";
}

type Carry =
  | { kind: "bench"; via: "pointer" | "keyboard" | "gesture"; instanceId: string; definitionId: string; label: string; startX: number; startY: number;
      active: boolean; pointerType: string; point?: BenchPoint; targetIndex?: number }
  | { kind: "tray"; via: "pointer" | "gesture"; definitionId: string; point?: BenchPoint };

const LIFT_MM = 16;
const MM = 0.001;

/** A press released without carrying: a tap on an item (§5.19 "Touch: tap · Select"). */
export type TapHandler = (instanceId: string, pointerType: string, clientX: number, clientY: number) => void;

export const useBenchCarry = (engine: BenchEngine | undefined, player: Player3DController, onHover: (instanceId?: string) => void, onTap?: TapHandler) => {
  const carryRef = useRef<Carry | undefined>(undefined);
  const [callout, setCallout] = useState<CarryCallout>();
  const [carrying, setCarrying] = useState(false);
  const [keyCarrying, setKeyCarrying] = useState(false);
  const { scene, interaction, showGuidance, flow } = player;
  const pouringRef = useRef(false);
  pouringRef.current = Boolean(player.pour);

  const candidates = useCallback((exceptId?: string): Array<FootprintCandidate & { label: string }> =>
    scene.bench.flatMap((item) => item.instanceId !== exceptId && item.placement.kind === "bench"
      ? [{ instanceId: item.instanceId, definitionId: item.definitionId, label: item.label,
          footprint: footprintOf(item.model, item.placement.point.xMm, item.placement.point.yMm) }]
      : []), [scene]);

  /** The 2D overlap judgement for the carried item at `point`, snaps included (footprints.snapClassification). */
  const overlapAt = useCallback((instanceId: string, definitionId: string, point: BenchPoint) => {
    const item = scene.bench.find((i) => i.instanceId === instanceId);
    const snap = snapClassification(interaction, definitionId, scene.bench.flatMap((other) => other.placement.kind === "bench"
      ? [{ instanceId: other.instanceId, definitionId: other.definitionId, entry: other.model, ...other.placement.point }]
      : []));
    return classifyOverlap({ instanceId, definitionId, footprint: footprintOf(item?.model, point.xMm, point.yMm) },
      candidates(instanceId), interaction, snap);
  }, [candidates, interaction, scene]);

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
  }, []);

  const cancel = useCallback(() => {
    endCarry();
    engine?.endCarryPreview();
    if (engine) void engine.sync(scene);
  }, [endCarry, engine, scene]);

  /** Draw the carried item at `point` and classify what it is over; returns the callout shown. */
  const carryTo = useCallback((point: BenchPoint, screenAt?: { x: number; y: number }): CarryCallout | undefined => {
    const carry = carryRef.current;
    if (!engine || !carry) return undefined;
    carry.point = point;
    // Over the expected station (§5.6): "Release to place" in guided mode, neutral in assessment.
    const placing: CarryCallout["text"] = showGuidance ? "Release to place" : "Release to try this";
    if (carry.kind === "tray") {
      const shown: CarryCallout = placesForStep(carry.definitionId)
        ? { ...(screenAt ?? { x: 0, y: 0 }), text: placing, kind: "valid" }
        : { ...(screenAt ?? { x: 0, y: 0 }), text: "Release to set down", kind: "free" };
      setCallout(shown);
      return shown;
    }
    const overlap = overlapAt(carry.instanceId, carry.definitionId, point);
    // The pour cue shows in both modes, as the 2D workbench's overlap feedback does (G-7).
    const pourCue = interaction?.type === "pourInto" && overlap.kind === "valid" && overlap.target ? overlap.target.id : undefined;
    engine.previewCarry(carry.instanceId, point.xMm, point.yMm, LIFT_MM, pourCue);
    const top = screenAt ? undefined : engine.screenPoint(carry.instanceId, 1);
    const screen = screenAt ?? (top ? { x: top.x, y: top.y - 30 } : { x: 0, y: 0 });
    const item = scene.bench.find((i) => i.instanceId === carry.instanceId);
    let shown: CarryCallout;
    if (placesForStep(carry.definitionId)) {
      engine.setTargetRing(null);
      shown = { ...screen, text: placing, kind: "valid" };
    } else if (overlap.kind === "valid" && overlap.target) {
      const targetItem = scene.bench.find((i) => i.instanceId === overlap.target!.id);
      const anchor = interaction?.type === "snapIntoTarget" && interaction.snapZoneId ? targetItem?.model?.anchors[interaction.snapZoneId]?.positionMm : undefined;
      engine.setTargetRing(overlap.target.id, "valid", anchor);
      shown = { ...screen, text: showGuidance ? `Release to ${lowerFirst(interaction?.accessibleLabel ?? "act")}` : "Release to try this", kind: "valid" };
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
  }, [engine, interaction, overlapAt, placesForStep, scene, showGuidance]);

  const carryToPointer = useCallback((clientX: number, clientY: number) => {
    if (!engine || !carryRef.current) return;
    const point = engine.benchPointAt(clientX, clientY);
    if (!point) return;
    const rect = engine.canvasElement.getBoundingClientRect();
    carryTo(point, { x: clientX - rect.left, y: clientY - rect.top - 44 });
  }, [carryTo, engine]);

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
  }, [cancel, endCarry, engine, interaction, overlapAt, player, scene]);

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
    carryTo({ xMm: base.x / MM, yMm: -base.z / MM });
    player.announce(`Carrying ${item.label}. Arrow keys move it, Shift moves further, [ and ] step through targets. Enter sets it down; Escape cancels.`);
    return true;
  }, [cancel, carryTo, engine, player, scene]);

  /** Keys while a keyboard carry is under way; returns whether the key was used. */
  const handleCarryKey = useCallback((event: KeyboardEvent): boolean => {
    const carry = carryRef.current;
    if (!carry || carry.kind !== "bench" || carry.via !== "keyboard" || !carry.point) return false;
    const direction = arrowDirection(event.key);
    if (direction) {
      carryTo(nudgePoint(carry.point, direction, event.shiftKey));
      return true;
    }
    if (event.key === "[" || event.key === "]") {
      const targets = spatialOrder(candidates(carry.instanceId).map((c) => ({ ...c, id: c.instanceId, xMm: c.footprint.xMm, yMm: c.footprint.yMm })));
      if (targets.length === 0) return true;
      carry.targetIndex = cycleIndex(targets.length, carry.targetIndex, event.key === "]" ? 1 : -1);
      const target = targets[carry.targetIndex];
      const shown = carryTo({ xMm: target.xMm, yMm: target.yMm });
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
  }, [cancel, candidates, carryTo, player, release]);

  // Pointer handling on the canvas.
  useEffect(() => {
    if (!engine) return undefined;
    const canvas = engine.canvasElement;
    let holdTimer = 0;
    const down = (event: PointerEvent) => {
      // Nothing is picked up while a committed pour is still being drawn.
      if (event.button !== 0 || pouringRef.current) return;
      if (carryRef.current?.kind === "bench" && carryRef.current.via === "keyboard") cancel();
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
        if (!carry) onHover(engine.pick(event.clientX, event.clientY));
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
  }, [cancel, carryToPointer, engine, onHover, onTap, release, scene]);

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
    if (carry.kind === "bench" && carry.point) engine.previewCarry(carry.instanceId, carry.point.xMm, carry.point.yMm, LIFT_MM);
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

  return { callout, carrying, keyCarrying, startTrayCarry, startKeyCarry, handleCarryKey, cancel,
    canCarry, startGestureCarry, startGestureTrayCarry, gestureCarryTo, releaseGesture, cancelGesture };
};

const lowerFirst = (text: string) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);
