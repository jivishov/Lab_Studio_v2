import { useCallback, useMemo, useRef, useState } from "react";
import type { RuntimeActionRequest, RuntimeState } from "../../domain/types";
import { resolveActionInteraction } from "../../domain/interactions";
import { getBenchSize } from "../../equipment/visualCatalog";
import { usePlayerRuntime } from "../../player/usePlayerRuntime";
import type { RuntimeDefinition } from "../../runtime";
import { resolveInteractionIntent, type InteractionInvalidFeedback, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { fromBench, benchPositionWords, runtimeBenchPointsMm, toBench } from "../adapters/benchCoordinates";
import { footprintOf, nearestFreeSpot, type FootprintMm } from "../adapters/footprints";
import { pourStagingScene, runtimeToScene, sceneContents, type SceneContents, type SceneDescription } from "../adapters/runtimeToScene";
import { benchMoveRequest, intentTypeForInteraction, mergeActionInput, resolveTrayDrop, type ReleaseOrigin } from "../adapters/sceneToIntent";
import { nextPlacementPoint, parkPointAfterInteraction } from "../adapters/twoDPlacement";
import { equipment3dEntry } from "../equipment3d/readiness";
import { stepFlow, type StepFlow } from "./stepRules";

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
  const [announcement, setAnnouncement] = useState("");
  const [pour, setPour] = useState<PourAnimation>();
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
    if (latest && !spoken) setToast(latest.message);
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

  /** StudentPlayer.runIntent: merge the step input, resolve, then refuse (and record) or commit. */
  const runIntent = useCallback((intent: RuntimeInteractionIntent): RuntimeState | undefined => {
    const merged = mergeActionInput(intent, flow.inputResolution, runtime.expectedAction);
    const before = runtime.getState();
    const result = resolveInteractionIntent(definition, before, merged);
    if (!result.ok) {
      refuse(result.feedback);
      return undefined;
    }
    setSelectedSource(undefined);
    setSelectedTarget(undefined);
    const next = runtime.performAction(result.request);
    const failed = reportCommit(before, next);
    if (!failed && result.interaction.type === "pourInto" && result.request.sourceInstanceId && result.request.targetInstanceId) {
      pourSeq.current += 1;
      const { sourceInstanceId: sourceId, targetInstanceId: targetId } = result.request;
      setPour({ sourceId, targetId, staging: pourStagingScene(before, next, definition, { sourceId, targetId }),
        sourceAfter: contentsIn(next, sourceId), targetAfter: contentsIn(next, targetId), id: pourSeq.current });
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
  const dropFromTray = useCallback((definitionId: string, at?: { xMm: number; yMm: number }, origin: ReleaseOrigin = "pointer") => {
    const spot = at ? nearestFreeSpot(footprintOf(equipment3dEntry(definitionId), at.xMm, at.yMm), occupiedFootprints()) : undefined;
    const point = spot ? fromBench(definitionId, spot.xMm, spot.yMm) : nextPlacementPoint(runtime.getState().equipmentInstances, definitionId);
    const actionDefinitionId = runtime.expectedAction?.parameters.equipmentDefinitionId;
    const resolution = resolveTrayDrop(interaction, nodeCompletedIn(runtime.getState(), runtime.currentNode.id),
      typeof actionDefinitionId === "string" ? actionDefinitionId : undefined, definitionId, point, nextZIndex(), origin);
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
    runIntent({ type: intentTypeForInteraction[interaction.type], origin: "keyboard", sourceInstanceId: selectedSource, targetInstanceId: selectedTarget } as RuntimeInteractionIntent);
  }, [flow.nodeCompleted, interaction, runIntent, selectedSource, selectedTarget]);

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
    clearToast: () => setToast(undefined),
    announcement,
    announce,
    pour,
    /** Ends pour `id`'s animation; a later pour that has already replaced it is left running. */
    finishPour: (id: number) => setPour((current) => (current?.id === id ? undefined : current)),
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
