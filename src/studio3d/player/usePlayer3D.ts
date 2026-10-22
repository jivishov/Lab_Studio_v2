import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RuntimeActionRequest, RuntimeState } from "../../domain/types";
import { resolveActionInteraction } from "../../domain/interactions";
import { equipmentById } from "../../equipment/catalog";
import { getBenchSize } from "../../equipment/visualCatalog";
import { usePlayerRuntime } from "../../player/usePlayerRuntime";
import type { RuntimeDefinition } from "../../runtime";
import { resolveInteractionIntent, type InteractionInvalidFeedback, type RuntimeInteractionIntent } from "../../runtime/interactionIntents";
import { fromBench, benchPositionWords, runtimeBenchPointsMm, toBench } from "../adapters/benchCoordinates";
import { footprintOf, type FootprintMm } from "../adapters/footprints";
import { readingShownFor } from "../adapters/instrumentDisplay";
import { fillLevelMm, pourStagingScene, runtimeToScene, sceneContents, sceneryUnder, type SceneContents, type SceneDescription, type SceneStrip } from "../adapters/runtimeToScene";
import { heldOnSeat, readingSeatZone } from "../bench/scene/setOn";
import { benchMoveRequest, benchOpStepFor, chromStepFor, intentTypeForInteraction, markStepFor, mergeActionInput, pipetteStepFor, resolveTrayDrop, stepClockSeconds, tongsStepFor, toolTransferFor, type ReleaseOrigin } from "../adapters/sceneToIntent";
import { nearestClearPoint, stablePlacementPoint } from "../adapters/stableBench";
import { parkPointAfterInteraction } from "../adapters/twoDPlacement";
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
  /** A measuring vessel held over the target to drain once it is empty (Pack 2's Transfer Liquid). */
  drain?: boolean;
  /** A reagent portion poured while the rod standing in the target stirs it (Pack 2's precipitation). */
  stir?: boolean;
  /**
   * A portion poured into a filter (Pack 2's filtration): it is drawn filling the paper cone, poured
   * down the stirring rod (`guideRodId`), then draining through into the receiver under the funnel.
   */
  drainInto?: { receiverId: string; receiverBefore: SceneContents; receiverAfter: SceneContents; guideRodId?: string };
  id: number;
}

/**
 * A committed bench operation being drawn (Pack 2, decided 2026-10-05): the rod stirring, a precipitate
 * settling, or a drop falling from the dropping pipette. Timed ones run on the fast step clock
 * (decision 9), with the vessel drawn as it was until the time is up.
 */
export interface BenchOpAnimation {
  operation: string;
  vesselId: string;
  toolId?: string;
  /** What the step clock shows: the stated minutes, run in `clockSeconds` from `startedAt` (performance.now()). */
  minutes?: number;
  clockSeconds?: number;
  startedAt?: number;
  label: string;
  staging: SceneDescription;
  before: SceneContents;
  after: SceneContents;
  /** A chromatography strip developing (Pack 3a): the strip as the runtime has it once the solvent has risen. */
  strip?: SceneStrip;
  id: number;
}

/**
 * A timed stage on the fast step clock (Pack 2 decision 9): its stated minutes run in `seconds`. While
 * it is set the next action waits, as a student waits out the minutes at the bench; it is cleared by the
 * same timer that moves the clock face, so the face and the wait always agree.
 */
export interface StepClockRun {
  id: number;
  operation: string;
  label: string;
  minutes: number;
  seconds: number;
  startedAt: number;
}

/** The clock face's progress (0 to 1), kept outside React state so only the face redraws as it runs. */
export interface StepClockProgress {
  get: () => number;
  subscribe: (listener: () => void) => () => void;
}

const createClockProgress = (): StepClockProgress & { set: (value: number) => void } => {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => { value = next; listeners.forEach((listener) => listener()); },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
};

/**
 * Pouring into a filter that has not drained would overflow the paper (Pack 2 decision 4): the same
 * correction whichever way the next portion is sent (the beaker picked up, the step card, the hand).
 */
export const FILTER_OVERFLOW = {
  message: "The funnel is still full: pouring now would overflow the paper.",
  recovery: "Wait until the liquid has drained well below the paper's rim, then pour the next portion.",
};

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
  /** How the tool is drawn: a spatula rolls its scoop off; a pipette dips its tip; a pencil draws a short line (Pack 3a). */
  motion?: "roll" | "dip" | "draw";
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
  const [benchOpRun, setBenchOpRun] = useState<BenchOpAnimation>();
  const [stepClock, setStepClock] = useState<StepClockRun>();
  // The refs are what a commit checks, so two presses in one moment cannot both get through.
  const stepClockRef = useRef<StepClockRun | undefined>(undefined);
  const clockProgress = useRef(createClockProgress()).current;
  // The id of a portion poured into a filter while it is drawn pouring and draining.
  const drainingPourRef = useRef<number | undefined>(undefined);
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
  // A step done as a bench operation: a stir, a settle, a drop test (Pack 2, decided 2026-10-05).
  const benchOp = useMemo(() => benchOpStepFor(runtime.expectedAction, flow.nodeCompleted), [flow.nodeCompleted, runtime.expectedAction]);
  // A Paper Chromatography step: a pencil line or label, the chamber's lid, or a wait on the step clock (Pack 3a).
  const chromStep = useMemo(() => chromStepFor(runtime.expectedAction, flow.nodeCompleted), [flow.nodeCompleted, runtime.expectedAction]);
  // A hot item moved with the crucible tongs (Pack 2, S-05).
  const tongsStep = useMemo(() => tongsStepFor(runtime.expectedAction, runtime.state.equipmentInstances, flow.nodeCompleted),
    [flow.nodeCompleted, runtime.expectedAction, runtime.state]);
  // The run is complete when the current node is done and nothing follows it.
  const complete = useMemo(
    () => runtime.state.completedNodes.includes(runtime.currentNode.id)
      && !runtime.process.edges.some((edge) => edge.from === runtime.currentNode.id),
    [runtime.currentNode.id, runtime.process.edges, runtime.state.completedNodes],
  );

  // Clear, then set on a short timer so a repeated message is announced again; a timer, not an
  // animation frame, so announcements are not held back while the tab is not drawing. The timers
  // still pending are cleared when the player goes, so none sets state after it.
  const announceTimers = useRef(new Set<number>()).current;
  useEffect(() => () => {
    announceTimers.forEach((id) => window.clearTimeout(id));
    announceTimers.clear();
  }, [announceTimers]);
  const announce = useCallback((text: string) => {
    setAnnouncement("");
    const id = window.setTimeout(() => {
      announceTimers.delete(id);
      setAnnouncement(text);
    }, 30);
    announceTimers.add(id);
  }, [announceTimers]);

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

  /**
   * The next action waits (Pack 2): while a timed stage's minutes are still on the step clock (decision
   * 9), and while the last portion poured into the filter is still in the paper, which more liquid would
   * overflow (decision 4). A 3D rule on top of the runtime, which has already recorded the stage: shown as
   * a correction, not an attempt. Returns whether the action was held back.
   */
  const holdBackNext = useCallback((): boolean => {
    const clock = stepClockRef.current;
    const wait = clock ? { message: `The ${clock.minutes} minutes are not up yet.`, recovery: "Wait until the clock has run, then go on." }
      : drainingPourRef.current !== undefined ? FILTER_OVERFLOW : undefined;
    if (!wait) return false;
    setCorrection({ ...wait, attempt: false });
    announce(wait.message);
    return true;
  }, [announce]);

  /** Starts the fast step clock for a timed stage the runtime has just recorded. */
  const startClock = useCallback((run: StepClockRun) => {
    stepClockRef.current = run;
    clockProgress.set(0);
    setStepClock(run);
  }, [clockProgress]);

  // One timer moves the clock face and ends the wait, so the two always agree. It reads the time that
  // has passed, so a tab left in the background finds the stage over as soon as it is shown again.
  useEffect(() => {
    if (!stepClock) return undefined;
    const tick = () => {
      if (stepClockRef.current?.id !== stepClock.id) return;
      const u = (performance.now() - stepClock.startedAt) / (stepClock.seconds * 1000);
      if (u < 1) { clockProgress.set(u); return; }
      // The face is never drawn full while the wait holds: both end here, together.
      stepClockRef.current = undefined;
      setStepClock((current) => (current?.id === stepClock.id ? undefined : current));
      // A stage's drawing ends with its clock (the bench then shows it as the runtime has it).
      setBenchOpRun((current) => (current?.id === stepClock.id ? undefined : current));
    };
    const timer = window.setInterval(tick, 100);
    document.addEventListener("visibilitychange", tick);
    tick();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [clockProgress, stepClock]);

  const nextZIndex = useCallback(
    () => Math.max(0, ...runtime.getState().equipmentInstances.map((instance) => instance.zIndex ?? 0)) + 1,
    [runtime],
  );

  const occupiedFootprints = useCallback((exceptId?: string): FootprintMm[] => {
    const state = runtime.getState();
    const points = runtimeBenchPointsMm(state);
    return state.equipmentInstances
      .filter((instance) => instance.id !== exceptId)
      .flatMap((instance) => {
        const p = instance.location === "workbench" ? points.get(instance.id) : undefined;
        // Scenery an item lies on takes room too, also where the item lay while it hangs elsewhere (a strip's tile).
        const under = sceneryUnder(state, instance, points);
        return [
          ...(p ? [footprintOf(equipment3dEntry(instance.definitionId), p.xMm, p.yMm)] : []),
          ...(under ? [footprintOf(under.model, under.point.xMm, under.point.yMm)] : []),
        ];
      });
  }, [runtime]);

  /**
   * StudentPlayer.runIntent: merge the step input, resolve, then refuse (and record) or commit.
   * `tool` names the tool a solid transfer was made with (the spatula): the runtime records the
   * same source-to-target transfer, and the tool, not the source, is drawn tipping its scoop.
   */
  const runIntent = useCallback((intent: RuntimeInteractionIntent, tool?: { instanceId: string; scoop?: SceneContents; motion?: "roll" | "dip" | "draw" }): RuntimeState | undefined => {
    // Every way in (the step card, a key, a click on the bench, the hand) waits for the clock and the filter.
    if (holdBackNext()) return undefined;
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
      // A portion poured through a filter: the paper cone holds what was poured until it drains into the receiver.
      const receiverId = result.action.verb === "filter" && typeof result.action.parameters.receiverInstanceId === "string"
        ? result.action.parameters.receiverInstanceId : undefined;
      const moved = receiverId ? (next.equipmentInstances.find((i) => i.id === receiverId)?.contents.volumeMl ?? 0)
        - (before.equipmentInstances.find((i) => i.id === receiverId)?.contents.volumeMl ?? 0) : 0;
      const sourceBefore = contentsIn(before, sourceId);
      const coneAfter: SceneContents | undefined = receiverId && moved > 0 && sourceBefore.kind === "liquid"
        ? (() => {
            const funnel = next.equipmentInstances.find((i) => i.id === targetId);
            const entry = funnel ? equipment3dEntry(funnel.definitionId) : undefined;
            return entry?.fill ? { kind: "liquid", volumeMl: moved, ...fillLevelMm(entry.fill, moved), style: sourceBefore.style } : undefined;
          })()
        : undefined;
      const guideRodId = receiverId ? Object.values(result.action.equipmentRoleBindings ?? {}).includes("stirring-rod")
        ? next.equipmentInstances.find((i) => i.definitionId === "stirring-rod" && i.location === "workbench")?.id : undefined : undefined;
      const staged = pourStagingScene(before, next, definition, { sourceId, targetId });
      // The receiver under a filter is drawn as it was until the funnel drains into it.
      const staging = receiverId && coneAfter
        ? { ...staged, bench: staged.bench.map((item) => (item.instanceId === receiverId ? { ...item, contents: contentsIn(before, receiverId) } : item)) }
        : staged;
      // Until it has drained, the next portion would overflow the paper.
      if (receiverId && coneAfter) drainingPourRef.current = pourSeq.current;
      setPour({ sourceId, targetId, staging,
        sourceAfter: contentsIn(next, sourceId), targetAfter: coneAfter ?? contentsIn(next, targetId),
        ...(receiverId && coneAfter ? { drainInto: { receiverId, receiverBefore: contentsIn(before, receiverId), receiverAfter: contentsIn(next, receiverId),
          ...(guideRodId ? { guideRodId } : {}) } } : {}),
        ...(result.action.parameters.drainMeasuringVessel === true ? { drain: true } : {}),
        ...(result.action.parameters.portionCount !== undefined ? { stir: true } : {}), id: pourSeq.current });
    } else if (!failed && result.interaction.type === "rinseTarget" && result.request.sourceInstanceId && result.request.targetInstanceId
      && typeof result.action.parameters.washingsReceiverInstanceId === "string") {
      // A rinse whose washings run into a receiver (decided 2026-10-04) is drawn as the wash bottle
      // squirting into the rinsed item over the receiver, whose level rises: a funnel is rinsed where it
      // is seated; a weighing boat is held tipped over the funnel while it is rinsed.
      pourSeq.current += 1;
      const { sourceInstanceId: sourceId, targetInstanceId: rinsedId } = result.request;
      const receiverId = result.action.parameters.washingsReceiverInstanceId;
      const seated = next.attachments.some((relation) => relation.childInstanceId === rinsedId && relation.parentInstanceId === receiverId);
      // Washings that run out from under what is rinsed (a precipitate washed on the paper, the flask under the
      // funnel; Pack 2): the jet goes into the funnel, and the receiver fills as the sync shows.
      const under = next.attachments.some((relation) => relation.childInstanceId === receiverId && relation.parentInstanceId === rinsedId);
      const targetId = under ? rinsedId : receiverId;
      setPour({ sourceId, targetId, staging: pourStagingScene(before, next, definition, { sourceId, targetId }),
        sourceAfter: contentsIn(next, sourceId), targetAfter: contentsIn(next, targetId), ...(seated || under ? {} : { via: rinsedId }), id: pourSeq.current });
    } else if (!failed && typeof result.action.parameters.benchOperation === "string") {
      // A bench operation (Pack 2): drawn after the runtime has recorded it, the vessel as it was until then.
      const step = benchOpStepFor(result.action, false);
      // What changes while it is drawn: the paper under a drying solid, else the vessel itself.
      const vesselId = step?.contentsInstanceId ?? step?.vesselInstanceId;
      if (step?.operation === "break-up-precipitate" && step.toolInstanceId) {
        // The scoop is drawn dipping into the solid, as a pipette dips (decided 2026-10-05).
        pourSeq.current += 1;
        setToolDeposit({ toolId: step.toolInstanceId, motion: "dip", id: pourSeq.current });
      } else if (step) {
        pourSeq.current += 1;
        const labels: Record<string, string> = { stir: "Stirring", "settle-precipitate": "Settling", "precipitation-drop-test": "One drop",
          "dry-in-oven": "Drying", "cool-on-pad": "Cooling", "heat-crucible": "Heating" };
        const label = labels[step.operation] ?? step.control;
        // A timed stage's minutes go on the step clock, which the next action waits for (decision 9).
        const clock = step.minutes !== undefined && step.minutes > 0
          ? { id: pourSeq.current, operation: step.operation, label, minutes: step.minutes, seconds: stepClockSeconds(step.minutes), startedAt: performance.now() }
          : undefined;
        if (clock) startClock(clock);
        if (vesselId) {
          const sourceId = step.operation === "precipitation-drop-test" ? step.toolInstanceId ?? vesselId : vesselId;
          setBenchOpRun({ operation: step.operation, vesselId, ...(step.toolInstanceId ? { toolId: step.toolInstanceId } : {}),
            ...(clock ? { minutes: clock.minutes, clockSeconds: clock.seconds, startedAt: clock.startedAt } : {}),
            label,
            staging: pourStagingScene(before, next, definition, { sourceId, targetId: vesselId }),
            before: contentsIn(before, vesselId), after: contentsIn(next, vesselId), id: pourSeq.current });
        }
      }
    } else if (!failed && chromStepFor(result.action, false)) {
      // A Paper Chromatography step (Pack 3a): the pencil drawn along the line where it was set down, or a wait on the
      // step clock, the bench drawn as it was until the time is up and the solvent climbing the strip as it develops.
      const step = chromStepFor(result.action, false)!;
      pourSeq.current += 1;
      const pencil = step.toolDefinitionId
        ? next.equipmentInstances.find((i) => i.definitionId === step.toolDefinitionId && i.location === "workbench") : undefined;
      if (pencil) setToolDeposit({ toolId: pencil.id, motion: "draw", id: pourSeq.current });
      if (step.minutes !== undefined) {
        const label = step.operation === "develop" ? "Developing" : "Drying";
        const clock = { id: pourSeq.current, operation: step.operation, label, minutes: step.minutes, seconds: stepClockSeconds(step.minutes),
          startedAt: performance.now() };
        startClock(clock);
        const strip = step.operation === "develop"
          ? runtimeToScene(next, definition).bench.find((item) => item.instanceId === step.targetInstanceId)?.strip : undefined;
        setBenchOpRun({ operation: step.operation, vesselId: step.targetInstanceId, minutes: clock.minutes, clockSeconds: clock.seconds,
          startedAt: clock.startedAt, label, staging: runtimeToScene(before, definition), before: contentsIn(before, step.targetInstanceId),
          after: contentsIn(next, step.targetInstanceId), ...(strip ? { strip } : {}), id: pourSeq.current });
      }
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
  }, [definition, flow.inputResolution, holdBackNext, refuse, reportCommit, runtime, startClock]);

  /**
   * A free bench move (2D movePlacedEquipment): never an attempt; the set-down slides to the
   * nearest spot clear of every footprint (handoff §5.6; no overlap at all, decided 2026-10-22). A move the runtime refuses (an item in a closed
   * chamber) shows the runtime's message.
   */
  const freeMove = useCallback((instanceId: string, xMm: number, yMm: number): void => {
    const before = runtime.getState();
    const instance = before.equipmentInstances.find((i) => i.id === instanceId);
    if (!instance) return;
    const point = nearestClearPoint(instance.definitionId, { xMm, yMm }, occupiedFootprints(instanceId));
    const next = runtime.performAction(benchMoveRequest(instanceId, point, nextZIndex()));
    const spot = toBench(instance.definitionId, point);
    reportCommit(before, next, `${instance.label} moved to the ${benchPositionWords(spot.xMm, spot.yMm)}`);
  }, [nextZIndex, occupiedFootprints, reportCommit, runtime]);

  /**
   * After an accepted pour released at `releasePoint` (runtime units), the source is parked where
   * the 2D workbench would park it (Workbench.parkAfterInteraction), then slid clear of every footprint (decided
   * 2026-10-22), sent as a plain move.
   */
  const parkAfterPour = useCallback((sourceId: string, releasePoint: { x: number; y: number }) => {
    const state = runtime.getState();
    const source = state.equipmentInstances.find((i) => i.id === sourceId);
    if (!source || source.location !== "workbench") return;
    const parked = parkPointAfterInteraction(state, sourceId, releasePoint);
    const point = nearestClearPoint(source.definitionId, toBench(source.definitionId, parked), occupiedFootprints(sourceId));
    const next = runtime.performAction(benchMoveRequest(sourceId, point, nextZIndex()));
    const at = toBench(source.definitionId, point);
    reportCommit(state, next, `${source.label} set down at the ${benchPositionWords(at.xMm, at.yMm)}`);
  }, [nextZIndex, occupiedFootprints, reportCommit, runtime]);

  /**
   * A shelf item onto the bench (the runtime's `shelf`; the name is the tray's, decided 2026-10-11): the step's
   * placement when expected, else a free move. Dropped at a
   * point, it slides to the nearest free spot; clicked or chosen with Enter, it takes its own slot of the
   * 3D layout when clear (stableBench.ts, decided 2026-10-11). A hand-control drop is tagged "vision", as in 2D.
   */
  const dropFromTray = useCallback((definitionId: string, at?: { xMm: number; yMm: number }, origin: ReleaseOrigin = "pointer", instanceId?: string) => {
    // The bench stays as it is while a timed stage's minutes pass (the Shelf list's Enter is not a carry).
    if (stepClockRef.current && holdBackNext()) return;
    // The Shelf list's Enter has no point of its own: it starts from its slot, whose picture sizes are not the 3D
    // footprints, so it too takes the nearest free spot (a ring stand never stands in a balance).
    const start = at ?? toBench(definitionId, stablePlacementPoint(runtime.getState(), definitionId, instanceId));
    const point = nearestClearPoint(definitionId, start, occupiedFootprints());
    const actionDefinitionId = runtime.expectedAction?.parameters.equipmentDefinitionId;
    const resolution = resolveTrayDrop(interaction, nodeCompletedIn(runtime.getState(), runtime.currentNode.id),
      typeof actionDefinitionId === "string" ? actionDefinitionId : undefined, definitionId, point, nextZIndex(), origin, instanceId,
      placedInstanceId(runtime.expectedAction?.parameters));
    if (resolution.kind === "intent") {
      runIntent(resolution.intent);
      return;
    }
    // A shelf item the step does not expect (2D moveEquipmentToBench): a move, never an attempt.
    const before = runtime.getState();
    const next = runtime.performAction(resolution.request as RuntimeActionRequest);
    const placedAt = toBench(definitionId, point);
    const wasOnShelf = new Set(before.equipmentInstances.filter((i) => i.location === "shelf").map((i) => i.id));
    const label = next.equipmentInstances.find((i) => wasOnShelf.has(i.id) && i.location !== "shelf")?.label ?? definitionId;
    reportCommit(before, next, `${label} placed at the ${benchPositionWords(placedAt.xMm, placedAt.yMm)}`);
  }, [holdBackNext, interaction, nextZIndex, occupiedFootprints, reportCommit, runIntent, runtime]);

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
  /**
   * At a graduation, a level past the line drawn back up into the pipette, a drop's worth at a time (decided 2026-10-10).
   * True while the pipette can take more, so a held press stops once it is full instead of asking again.
   */
  const drawBack = useCallback((dropCount: number, origin: ReleaseOrigin | "keyboard" = "pointer"): boolean => {
    if (!markStep?.drawBack) return false;
    const next = runIntent({ type: "dispenseDrawBackIntent", origin, runtimeParameters: { dropCount } } as RuntimeInteractionIntent);
    if (!next) return false;
    const capacity = equipmentById.get(markStep.pipetteDefinitionId)?.capacity;
    const heldMl = next.equipmentInstances.find((instance) => instance.id === markStep.pipetteInstanceId)?.contents.volumeMl ?? 0;
    return capacity?.unit !== "mL" || heldMl < capacity.amount - 1e-9;
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
    setBenchOpRun(undefined);
    stepClockRef.current = undefined;
    setStepClock(undefined);
    drainingPourRef.current = undefined;
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
    benchOp,
    benchOpRun,
    chromStep,
    tongsStep,
    /** Ends bench operation `id`'s animation; a later one that has already replaced it is left running. */
    finishBenchOp: (id: number) => setBenchOpRun((current) => (current?.id === id ? undefined : current)),
    /** The timed stage on the fast step clock, if one is running: the next action waits until it is cleared. */
    stepClock,
    clockProgress: clockProgress as StepClockProgress,
    addDrops,
    drawBack,
    acceptMark,
    announcement,
    announce,
    pour,
    /** Ends pour `id`'s animation; a later pour that has already replaced it is left running. */
    finishPour: (id: number) => {
      // A filter's portion has drained once it is drawn: the next can go in.
      if (drainingPourRef.current === id) drainingPourRef.current = undefined;
      setPour((current) => (current?.id === id ? undefined : current));
    },
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
