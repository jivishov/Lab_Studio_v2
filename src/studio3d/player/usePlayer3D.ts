import { useCallback, useMemo, useRef, useState } from "react";
import type { RuntimeActionRequest, RuntimeState } from "../../domain/types";
import { resolveActionInteraction } from "../../domain/interactions";
import { getBenchSize } from "../../equipment/visualCatalog";
import { usePlayerRuntime } from "../../player/usePlayerRuntime";
import type { RuntimeDefinition } from "../../runtime";
import { resolveInteractionIntent, type InteractionInvalidFeedback, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { fromBench, benchPositionWords, runtimeBenchPointsMm, toBench } from "../adapters/benchCoordinates";
import { footprintOf, nearestFreeSpot, type FootprintMm } from "../adapters/footprints";
import { readingShownFor } from "../adapters/instrumentDisplay";
import { pourStagingScene, runtimeToScene, sceneContents, type SceneContents, type SceneDescription } from "../adapters/runtimeToScene";
import { heldOnSeat, readingSeatZone } from "../bench/scene/setOn";
import { benchMoveRequest, intentTypeForInteraction, markStepFor, mergeActionInput, pipetteStepFor, resolveTrayDrop, toolTransferFor, type ReleaseOrigin } from "../adapters/sceneToIntent";
import { nextPlacementPoint, parkPointAfterInteraction } from "../adapters/twoDPlacement";
import { equipment3dEntry } from "../equipment3d/readiness";
import { stepFlow, type StepFlow, placedInstanceId } from "./stepRules";

/**
 * Player3D's controller: the same runtime hook and the same intent path as the 2D player
 * (`StudentPlayer.runIntent`), with the 3D bench as one more way in. Every commit goes through
 * the runtime; refusals change nothing, are shown with the runtime's own message and recovery,
 * and are recorded as attempts in assessment mode (G-4). Free moves are never attempts.
 *
 * Every commit is judged by what the runtime added: its new feedback (success and info show as a
 * toast; an error shows as a correction, as the 2D FeedbackPanel shows it) and its new failed
 * attempts. Nothing is inferred from positions.
 */
export interface Correction {
  message: string;
  recovery: string;
  /** Whether a failed attempt was recorded for it, which assessment mode says (§5.13). */
  attempt: boolean;
}

export interface PourAnimation {
  sourceId: string;
  targetId: string;
  /** The committed layout with the source's and target's contents from before the pour (pourStagingScene). */
  staging: SceneDescription;
  /** What each holds once the runtime has committed the pour, wherever it stands (a shelf source too). */
  sourceAfter: SceneContents;
  targetAfter: SceneContents;
  /** An item held tipped over the target's mouth during the pour: a weighing boat rinsed into a flask. */
  via?: string;
  id: number;
}

/** A committed swirl being drawn (decided 2026-10-04): the vessel's contents before, while it swirls, then after. */
export interface SwirlAnimation {
  vesselId: string;
  /** The committed layout with the vessel holding what it held before the swirl. */
  staging: SceneDescription;
  before: SceneContents;
  after: SceneContents;
  id: number;
}

/** A committed reading shown with the vessel set on the instrument's seat (setOn.ts; handoff §5.7). */
export interface WeighAnimation {
  sourceId: string;
  targetId: string;
  zoneId: string;
  id: number;
}

/** A committed tool transfer being drawn: the tool tips its scoop onto the target (decided 2026-09-25). */
export interface ToolDeposit {
  toolId: string;
  scoop?: SceneContents;
  /** A target that was empty: its new contents are shown only as the scoop lands. */
  revealIn?: string;
  /** How the tool is drawn: a spatula rolls its scoop off; a pipette dips its tip. */
  motion?: "roll" | "dip";
  id: number;
}

const contentsIn = (state: RuntimeState, instanceId: string): SceneContents => {
  const instance = state.equipmentInstances.find((i) => i.id === instanceId);
  return instance ? sceneContents(instance, equipment3dEntry(instance.definitionId)) : { kind: "none" };
};

const nodeCompletedIn = (state: RuntimeState, nodeId: string) => state.completedNodes.includes(nodeId);

/**
 * `authoredDefinition` is the definition as written, before teacher setup; it tells a value the
 * setup supplied (a `{{config.x}}` binding) from one the bench recorded, for provenance chips.
 */
export const usePlayer3D = (definition: RuntimeDefinition, initialMode: RuntimeState["mode"] = "guided", authoredDefinition?: RuntimeDefinition,
  /** The Studio preview starts at a step (plan §4.6: `focusNodeId`, `focusVersion`), as the 2D preview does. */
  focus?: { nodeId?: string; version?: number }) => {
  const runtime = usePlayerRuntime(definition, initialMode, focus?.nodeId, focus?.version ?? 0);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [selectedSource, setSelectedSource] = useState<string>();
  const [selectedTarget, setSelectedTarget] = useState<string>();
  const [correction, setCorrection] = useState<Correction>();
  const [toast, setToast] = useState<string>();
  // "done" for what a commit reported, "info" for a notice that nothing changed (a key pressed out of step).
  const [toastKind, setToastKind] = useState<"done" | "info">("done");
  const [announcement, setAnnouncement] = useState("");
  const [pour, setPour] = useState<PourAnimation>();
  const [weighing, setWeighing] = useState<WeighAnimation>();
  const [toolDeposit, setToolDeposit] = useState<ToolDeposit>();
  const [swirl, setSwirl] = useState<SwirlAnimation>();
  // What each instrument showed when a reading was recorded, by measurement id (results only).
  const [displayedReadings, setDisplayedReadings] = useState<Record<string, string>>({});
  const pourSeq = useRef(0);

  const showGuidance = runtime.mode === "guided";
  const interaction = runtime.expectedAction ? resolveActionInteraction(runtime.expectedAction) : undefined;
  const inputKey = runtime.expectedAction?.id ?? "";
  const flow: StepFlow = stepFlow({
    state: runtime.state,
    node: runtime.currentNode,
    action: runtime.expectedAction,
    interaction,
    inputValue: inputValues[inputKey] ?? "",
    selectedSource,
    selectedTarget,
    showGuidance,
  });
  const scene = useMemo(() => runtimeToScene(runtime.state, definition), [runtime.state, definition]);
  // A solid transfer this step makes with a tool, the spatula (decided 2026-09-25).
  const toolTransfer = useMemo(
    () => toolTransferFor(runtime.expectedAction, runtime.expectedAction ? resolveActionInteraction(runtime.expectedAction) : undefined,
      runtime.state.equipmentInstances, flow.nodeCompleted),
    [flow.nodeCompleted, runtime.expectedAction, runtime.state],
  );
  // A level brought to a line drop by drop: the pipette is held over the vessel (decided 2026-10-02).
  const markStep = useMemo(
    () => markStepFor(runtime.expectedAction, runtime.expectedAction ? resolveActionInteraction(runtime.expectedAction) : undefined,
      runtime.state.equipmentInstances, flow.nodeCompleted),
    [flow.nodeCompleted, runtime.expectedAction, runtime.state],
  );
  // A step done with a pipette: drawing into it, or delivering from it (decided 2026-09-26).
  const pipetteStep = useMemo(
    () => pipetteStepFor(runtime.expectedAction, runtime.expectedAction ? resolveActionInteraction(runtime.expectedAction) : undefined,
      runtime.state.equipmentInstances, flow.nodeCompleted),
    [flow.nodeCompleted, runtime.expectedAction, runtime.state],
  );
  // The run is complete when the current node is done and nothing follows it.
  const complete = useMemo(
    () => runtime.state.completedNodes.includes(runtime.currentNode.id)
      && !runtime.process.edges.some((edge) => edge.from === runtime.currentNode.id),
    [runtime.currentNode.id, runtime.process.edges, runtime.state.completedNodes],
  );

  // Clear, then set on a short timer so a repeated message is announced again; a timer, not an
  // animation frame, so announcements are not held back while the tab is not drawing.
  const announce = useCallback((text: string) => {
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(text), 30);
  }, []);

  const failedAttemptAdded = (before: RuntimeState, next: RuntimeState): boolean =>
    next.attemptHistory.slice(before.attemptHistory.length).some((attempt) => !attempt.success);

  /**
   * Shows what one commit added (the runtime's feedback queue is append-only). Returns whether the
   * runtime reported an error, which leaves a correction instead of a toast.
   */
  const reportCommit = useCallback((before: RuntimeState, next: RuntimeState, spoken?: string): boolean => {
    const added = next.feedbackQueue.slice(before.feedbackQueue.length);
    const error = added.find((item) => item.severity === "error");
    if (error) {
      setCorrection({ message: error.message, recovery: error.recovery ?? "", attempt: failedAttemptAdded(before, next) });
      announce(error.message);
      return true;
    }
    setCorrection(undefined);
    const latest = added.at(-1);
    if (latest && !spoken) {
      setToast(latest.message);
      setToastKind("done");
    }
    announce(spoken ?? latest?.message ?? "");
    return false;
  }, [announce]);

  /** A refusal before anything commits: the runtime's words, recorded as an attempt in assessment. */
  const refuse = useCallback((feedback: InteractionInvalidFeedback) => {
    const before = runtime.getState();
    runtime.recordAssessmentFailure(feedback.message);
    setCorrection({ message: feedback.message, recovery: feedback.recovery, attempt: failedAttemptAdded(before, runtime.getState()) });
    announce(feedback.message);
  }, [announce, runtime]);

  const nextZIndex = useCallback(
    () => Math.max(0, ...runtime.getState().equipmentInstances.map((instance) => instance.zIndex ?? 0)) + 1,
    [runtime],
  );

  const occupiedFootprints = useCallback((exceptId?: string): FootprintMm[] => {
    const state = runtime.getState();
    const points = runtimeBenchPointsMm(state);
    return state.equipmentInstances
      .filter((instance) => instance.location === "workbench" && instance.id !== exceptId)
      .flatMap((instance) => {
        const p = points.get(instance.id);
        return p ? [footprintOf(equipment3dEntry(instance.definitionId), p.xMm, p.yMm)] : [];
      });
  }, [runtime]);

  /**
   * StudentPlayer.runIntent: merge the step input, resolve, then refuse (and record) or commit.
   * `tool` names the tool a solid transfer was made with (the spatula): the runtime records the
   * same source-to-target transfer, and the tool, not the source, is drawn tipping its scoop.
   */
  const runIntent = useCallback((intent: RuntimeInteractionIntent, tool?: { instanceId: string; scoop?: SceneContents; motion?: "roll" | "dip" }): RuntimeState | undefined => {
    const merged = mergeActionInput(intent, flow.inputResolution, runtime.expectedAction);
    const before = runtime.getState();
    const result = resolveInteractionIntent(definition, before, merged);
    if (!result.ok) {
      refuse(result.feedback);
      return undefined;
    }
    setSelectedSource(undefined);
    setSelectedTarget(undefined);
    const shown = runtime.expectedAction
      ? readingShownFor(definition, before, runtime.expectedAction, (id) => equipment3dEntry(id)?.displays[0]?.policy)
      : undefined;
    const next = runtime.performAction(result.request);
    const failed = reportCommit(before, next);
    if (!failed && shown) setDisplayedReadings((current) => ({ ...current, [shown.measurementId]: shown.text }));
    if (!failed && tool) {
      pourSeq.current += 1;
      const targetId = result.request.targetInstanceId;
      const wasEmpty = before.equipmentInstances.find((instance) => instance.id === targetId)?.contents.kind === "empty";
      setToolDeposit({ toolId: tool.instanceId, scoop: tool.scoop, motion: tool.motion, id: pourSeq.current, ...(targetId && wasEmpty ? { revealIn: targetId } : {}) });
    } else if (!failed && result.interaction.type === "pourInto" && result.request.sourceInstanceId && result.request.targetInstanceId) {
      pourSeq.current += 1;
      const { sourceInstanceId: sourceId, targetInstanceId: targetId } = result.request;
      setPour({ sourceId, targetId, staging: pourStagingScene(before, next, definition, { sourceId, targetId }),
        sourceAfter: contentsIn(next, sourceId), targetAfter: contentsIn(next, targetId), id: pourSeq.current });
    } else if (!failed && result.interaction.type === "rinseTarget" && result.request.sourceInstanceId && result.request.targetInstanceId
      && typeof result.action.parameters.washingsReceiverInstanceId === "string") {
      // A rinse whose washings run into a receiver (decided 2026-10-04) is drawn as the wash bottle
      // squirting into the rinsed item over the receiver, whose level rises: a funnel is rinsed where it
      // is seated; a weighing boat is held tipped over the funnel while it is rinsed.
      pourSeq.current += 1;
      const { sourceInstanceId: sourceId, targetInstanceId: rinsedId } = result.request;
      const targetId = result.action.parameters.washingsReceiverInstanceId;
      const seated = next.attachments.some((relation) => relation.childInstanceId === rinsedId && relation.parentInstanceId === targetId);
      setPour({ sourceId, targetId, staging: pourStagingScene(before, next, definition, { sourceId, targetId }),
        sourceAfter: contentsIn(next, sourceId), targetAfter: contentsIn(next, targetId), ...(seated ? {} : { via: rinsedId }), id: pourSeq.current });
    } else if (!failed && result.action.verb === "dissolve" && result.action.parameters.mixOperation === "swirl") {
      // A swirl (decided 2026-10-04): the vessel is drawn swirling with its contents as they were, then as the runtime has them.
      const vesselId = result.request.targetInstanceId;
      if (vesselId) {
        pourSeq.current += 1;
        setSwirl({ vesselId, staging: pourStagingScene(before, next, definition, { sourceId: vesselId, targetId: vesselId }),
          before: contentsIn(before, vesselId), after: contentsIn(next, vesselId), id: pourSeq.current });
      }
    }
    // A committed weighing is shown with the vessel on the balance's pan, then back where the
    // runtime keeps it: the runtime's `weigh` neither seats nor moves it (plan §2.4). A vessel the
    // runtime already holds on the pan is shown there at rest, and nothing is animated.
    if (!failed && result.request.verb === "weigh" && result.request.sourceInstanceId && result.request.targetInstanceId) {
      const { sourceInstanceId: sourceId, targetInstanceId: targetId } = result.request;
      const source = before.equipmentInstances.find((i) => i.id === sourceId);
      const target = before.equipmentInstances.find((i) => i.id === targetId);
      const zoneId = source && target ? readingSeatZone(source.definitionId, target.definitionId) : undefined;
      if (zoneId && !heldOnSeat(next.attachments, sourceId, targetId, zoneId)) {
        pourSeq.current += 1;
        setWeighing({ sourceId, targetId, zoneId, id: pourSeq.current });
      }
    }
    return failed ? undefined : next;
  }, [definition, flow.inputResolution, refuse, reportCommit, runtime]);

  /**
   * A free bench move (2D movePlacedEquipment): never an attempt; the set-down slides to the
   * nearest spot under 5 % overlap (handoff §5.6). A move the runtime refuses (an item in a closed
   * chamber) shows the runtime's message.
   */
  const freeMove = useCallback((instanceId: string, xMm: number, yMm: number): void => {
    const before = runtime.getState();
    const instance = before.equipmentInstances.find((i) => i.id === instanceId);
    if (!instance) return;
    const spot = nearestFreeSpot(footprintOf(equipment3dEntry(instance.definitionId), xMm, yMm), occupiedFootprints(instanceId));
    const next = runtime.performAction(benchMoveRequest(instanceId, fromBench(instance.definitionId, spot.xMm, spot.yMm), nextZIndex()));
    reportCommit(before, next, `${instance.label} moved to the ${benchPositionWords(spot.xMm, spot.yMm)}`);
  }, [nextZIndex, occupiedFootprints, reportCommit, runtime]);

  /**
   * After an accepted pour released at `releasePoint` (runtime units), the source is parked where
   * the 2D workbench would park it (Workbench.parkAfterInteraction), sent as a plain move.
   */
  const parkAfterPour = useCallback((sourceId: string, releasePoint: { x: number; y: number }) => {
    const state = runtime.getState();
    const source = state.equipmentInstances.find((i) => i.id === sourceId);
    if (!source || source.location !== "workbench") return;
    const point = parkPointAfterInteraction(state, sourceId, releasePoint);
    const next = runtime.performAction(benchMoveRequest(sourceId, point, nextZIndex()));
    const at = toBench(source.definitionId, point);
    reportCommit(state, next, `${source.label} set down at the ${benchPositionWords(at.xMm, at.yMm)}`);
  }, [nextZIndex, reportCommit, runtime]);

  /**
   * A tray item onto the bench: the step's placement when expected, else a free move. Dropped at a
   * point, it slides to the nearest free spot; clicked or chosen with Enter, it takes the slot the
   * 2D `placeEquipment` would give it. A hand-control drop is tagged "vision", as in 2D.
   */
  const dropFromTray = useCallback((definitionId: string, at?: { xMm: number; yMm: number }, origin: ReleaseOrigin = "pointer", instanceId?: string) => {
    const spot = at ? nearestFreeSpot(footprintOf(equipment3dEntry(definitionId), at.xMm, at.yMm), occupiedFootprints()) : undefined;
    const point = spot ? fromBench(definitionId, spot.xMm, spot.yMm) : nextPlacementPoint(runtime.getState().equipmentInstances, definitionId);
    const actionDefinitionId = runtime.expectedAction?.parameters.equipmentDefinitionId;
    const resolution = resolveTrayDrop(interaction, nodeCompletedIn(runtime.getState(), runtime.currentNode.id),
      typeof actionDefinitionId === "string" ? actionDefinitionId : undefined, definitionId, point, nextZIndex(), origin, instanceId,
      placedInstanceId(runtime.expectedAction?.parameters));
    if (resolution.kind === "intent") {
      runIntent(resolution.intent);
      return;
    }
    // A tray item the step does not expect (2D moveEquipmentToBench): a move, never an attempt.
    const before = runtime.getState();
    const next = runtime.performAction(resolution.request as RuntimeActionRequest);
    const placedAt = toBench(definitionId, point);
    const wasOnShelf = new Set(before.equipmentInstances.filter((i) => i.location === "shelf").map((i) => i.id));
    const label = next.equipmentInstances.find((i) => wasOnShelf.has(i.id) && i.location !== "shelf")?.label ?? definitionId;
    reportCommit(before, next, `${label} placed at the ${benchPositionWords(placedAt.xMm, placedAt.yMm)}`);
  }, [interaction, nextZIndex, occupiedFootprints, reportCommit, runIntent, runtime]);

  /**
   * The accessible action flow's Confirm (StudentPlayer.runKeyboardFlow): only the learner's own
   * selection is sent, and the runtime resolves the rest, exactly as in 2D. Keyboard confirms are
   * not parked; the 2D player parks only after a drag release.
   */
  const confirm = useCallback(() => {
    if (!interaction || flow.nodeCompleted) return;
    // A step done with a tool records the same transfer; the source is not drawn pouring. With no
    // carry to draw from, the tool's deposit shows at once.
    const toolId = toolTransfer
      ? runtime.state.equipmentInstances.find((instance) => instance.definitionId === toolTransfer.toolDefinitionId)?.id : undefined;
    runIntent({ type: intentTypeForInteraction[interaction.type], origin: "keyboard", sourceInstanceId: selectedSource, targetInstanceId: selectedTarget } as RuntimeInteractionIntent,
      toolTransfer ? { instanceId: toolId ?? toolTransfer.toolDefinitionId }
        : pipetteStep ? { instanceId: pipetteStep.toolInstanceId, motion: "dip" } : undefined);
  }, [flow.nodeCompleted, interaction, pipetteStep, runIntent, runtime.state, selectedSource, selectedTarget, toolTransfer]);

  /** One drop, or a short run of drops while the pipette is squeezed, at a drop-to-the-line step. */
  const addDrops = useCallback((dropCount: number, origin: ReleaseOrigin | "keyboard" = "pointer") => {
    if (!markStep) return undefined;
    return runIntent({ type: "dispenseDropIntent", origin, runtimeParameters: { dropCount } } as RuntimeInteractionIntent);
  }, [markStep, runIntent]);
  /** The student says the meniscus is at the line; the runtime judges it within one drop. */
  const acceptMark = useCallback((origin: ReleaseOrigin | "keyboard" = "pointer") => {
    if (!markStep) return undefined;
    return runIntent({ type: "dispenseCompleteIntent", origin } as RuntimeInteractionIntent);
  }, [markStep, runIntent]);

  const recordEvidence = useCallback(() => {
    if (!flow.nodeCompleted) runIntent({ type: "notebookRecordIntent", origin: "programmatic" });
  }, [flow.nodeCompleted, runIntent]);

  const submitCalculation = useCallback(() => {
    if (!flow.nodeCompleted) runIntent({ type: "calculationSubmitIntent", origin: "programmatic" });
  }, [flow.nodeCompleted, runIntent]);

  const setInput = useCallback((value: string) => {
    if (!inputKey) return;
    // The correction stays until the next successful action or until it is dismissed (§5.13).
    setInputValues((current) => ({ ...current, [inputKey]: value }));
  }, [inputKey]);

  const restart = useCallback(() => {
    runtime.reset();
    setPour(undefined);
    setWeighing(undefined);
    setToolDeposit(undefined);
    setSwirl(undefined);
    setDisplayedReadings({});
    setInputValues({});
    setCorrection(undefined);
    setSelectedSource(undefined);
    setSelectedTarget(undefined);
    setToast(undefined);
  }, [runtime]);

  return {
    runtime,
    definition,
    authoredDefinition: authoredDefinition ?? definition,
    scene,
    flow,
    interaction,
    showGuidance,
    complete,
    inputValue: inputValues[inputKey] ?? "",
    setInput,
    selectedSource,
    selectedTarget,
    setSelectedSource,
    setSelectedTarget,
    correction,
    dismissCorrection: () => setCorrection(undefined),
    toast,
    toastKind,
    clearToast: () => setToast(undefined),
    /** A neutral notice that nothing changed (not a runtime attempt): shown briefly and announced. */
    notify: (message: string) => {
      setToast(message);
      setToastKind("info");
      announce(message);
    },
    toolTransfer,
    pipetteStep,
    markStep,
    addDrops,
    acceptMark,
    announcement,
    announce,
    pour,
    /** Ends pour `id`'s animation; a later pour that has already replaced it is left running. */
    finishPour: (id: number) => setPour((current) => (current?.id === id ? undefined : current)),
    weighing,
    toolDeposit,
    swirl,
    /** Ends swirl `id`'s animation; a later one that has already replaced it is left running. */
    finishSwirl: (id: number) => setSwirl((current) => (current?.id === id ? undefined : current)),
    /** Ends tool deposit `id`'s animation; a later one that has already replaced it is left running. */
    finishToolDeposit: (id: number) => setToolDeposit((current) => (current?.id === id ? undefined : current)),
    /**
     * A correction for a 3D rule on top of the runtime (a solid is added with its tool): shown and
     * announced, but not a runtime attempt and not an assessment failure.
     */
    correct: (message: string, recovery: string) => {
      setCorrection({ message, recovery, attempt: false });
      announce(message);
    },
    displayedReadings,
    /** Ends weighing `id`'s animation; a later one that has already replaced it is left running. */
    finishWeighing: (id: number) => setWeighing((current) => (current?.id === id ? undefined : current)),
    runIntent,
    refuse,
    freeMove,
    parkAfterPour,
    dropFromTray,
    confirm,
    recordEvidence,
    submitCalculation,
    restart,
    nextZIndex,
    benchSize: getBenchSize,
  };
};

export type Player3DController = ReturnType<typeof usePlayer3D>;
