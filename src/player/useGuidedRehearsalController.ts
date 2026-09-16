import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { isVisibleWorkbenchLocation } from "../domain/equipmentLocations";
import { resolveActionInteraction } from "../domain/interactions";
import type { ActionDefinition, RuntimeState } from "../domain/types";
import { FINE_WINDOW_DROPS } from "../experimentComposer/catalogs";
import type { RehearsalController } from "../experimentComposer/types";
import {
  actionInputField,
  getActions,
  getProcess,
  type InteractionInvalidFeedback,
  type InteractionSequenceResult,
  type RuntimeDefinition,
  type RuntimeInteractionIntent,
} from "../runtime";
import {
  serializedResultLength,
  WEBMCP_RESULT_CHARACTER_BUDGET,
  type JsonValue,
  type WebMCPResult,
} from "../webmcp/result";
import type { usePlayerRuntime } from "./usePlayerRuntime";

const MAX_COARSE_DROP_SEQUENCE = 1_000;
const INSPECTION_RESULT_CODE = "REHEARSAL_INSPECTED";
const INSPECTION_RESULT_MESSAGE = "Current guided rehearsal state inspected.";

type PlayerRuntime = ReturnType<typeof usePlayerRuntime>;

interface RevisionWaiter {
  revision: number;
  resolve: (acknowledged: boolean) => void;
  signal?: AbortSignal;
  abortListener?: () => void;
}

export type CoarseTitrationPlan =
  | { status: "unavailable"; count: 0; reachedFineWindow: false; capped: false }
  | { status: "use_single_drop"; count: 0; reachedFineWindow: true; capped: false }
  | { status: "ready"; count: number; reachedFineWindow: boolean; capped: boolean };

export const planCoarseTitration = (
  endpointDropCount: number,
  currentDrops: number,
): CoarseTitrationPlan => {
  if (
    !Number.isFinite(endpointDropCount)
    || endpointDropCount <= 0
    || !Number.isFinite(currentDrops)
    || currentDrops < 0
  ) {
    return { status: "unavailable", count: 0, reachedFineWindow: false, capped: false };
  }
  const normalizedCurrentDrops = Math.round(currentDrops);
  const fineWindowStart = Math.max(0, Math.round(endpointDropCount) - FINE_WINDOW_DROPS);
  if (normalizedCurrentDrops >= fineWindowStart) {
    return { status: "use_single_drop", count: 0, reachedFineWindow: true, capped: false };
  }
  const remainingCoarseDrops = fineWindowStart - normalizedCurrentDrops;
  const count = Math.min(remainingCoarseDrops, MAX_COARSE_DROP_SEQUENCE);
  return {
    status: "ready",
    count,
    reachedFineWindow: count === remainingCoarseDrops,
    capped: count < remainingCoarseDrops,
  };
};

export interface GuidedRehearsalBridgeOptions {
  attemptId: string;
  definition: RuntimeDefinition;
  enabled: boolean;
  runtime: PlayerRuntime;
  setInteractionFeedback: Dispatch<SetStateAction<InteractionInvalidFeedback | undefined>>;
}

export interface GuidedRehearsalBridge {
  controller?: RehearsalController;
  performVisibleIntent: (intent: RuntimeInteractionIntent) => boolean;
  visibleRevision: number;
}

const clip = (value: string, maximum = 180): string =>
  value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;

const sanitizeRehearsalFeedback = (value: string): string => clip(
  value
    .replace(/Extra drop \d+ of \d+(?=:|\.|$)/gi, "An extra drop")
    .replace(/Drop \d+ of \d+ dispensed\./gi, "One ordinary drop was dispensed.")
    .replace(/after \d+ extra drops?/gi, "after extra drops")
    .replace(/\d+ extra drops?/gi, "extra drops")
);

const inspectionFitsBudget = (
  data: Record<string, JsonValue>,
  revision: number,
): boolean => serializedResultLength({
  ok: true,
  code: INSPECTION_RESULT_CODE,
  message: INSPECTION_RESULT_MESSAGE,
  data,
  state: { surface: "rehearsal", revision },
}) <= WEBMCP_RESULT_CHARACTER_BUDGET;

const stringActionParameter = (
  action: ActionDefinition | undefined,
  key: string,
): string | undefined => {
  const value = action?.parameters[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const expectedActionFor = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): ActionDefinition | undefined => {
  const node = getProcess(definition).nodes.find((candidate) => candidate.id === state.currentNodeId);
  return getActions(definition).find((candidate) => candidate.id === node?.actionId);
};

const interactionForAction = (action: ActionDefinition | undefined) =>
  action ? resolveActionInteraction(action) : undefined;

const nextOperationFor = (
  definition: RuntimeDefinition,
  state: RuntimeState,
): string => {
  const process = getProcess(definition);
  const node = process.nodes.find((candidate) => candidate.id === state.currentNodeId);
  if (!node || state.completedNodes.length >= process.nodes.length) return "complete";
  const interaction = interactionForAction(expectedActionFor(definition, state));
  if (interaction?.type === "dispenseDrops") return "operate_titration";
  if (interaction?.type === "recordNotebook" || interaction?.type === "recordTimeSeries") {
    return "record_step_evidence";
  }
  if (interaction?.type === "submitCalculation") return "submit_step_calculation";
  return "act_current_step";
};

const currentNodeRecovery = (
  definition: RuntimeDefinition,
  state: RuntimeState,
  toolInstruction: string,
): string => {
  const retry = getProcess(definition).nodes.find(
    (candidate) => candidate.id === state.currentNodeId,
  )?.feedback.retry;
  return retry ? `${retry} ${toolInstruction}` : toolInstruction;
};

const currentDispenseRecord = (
  definition: RuntimeDefinition,
  state: RuntimeState,
) => {
  const action = expectedActionFor(definition, state);
  return action ? state.dropDispenses[action.id] : undefined;
};

const intentForAction = (
  action: ActionDefinition,
  input: { sourceInstanceId?: string; targetInstanceId?: string },
): RuntimeInteractionIntent | undefined => {
  const interaction = interactionForAction(action);
  if (!interaction) return undefined;
  const shared = {
    actionId: action.id,
    origin: "programmatic" as const,
    sourceInstanceId: input.sourceInstanceId,
    targetInstanceId: input.targetInstanceId,
    stationId: interaction.stationId,
    snapZoneId: interaction.snapZoneId,
  };
  switch (interaction.type) {
    case "dragToZone": return { ...shared, type: "placeIntent" };
    case "snapIntoTarget": return { ...shared, type: "snapIntent" };
    case "pourInto": return { ...shared, type: "pourIntent" };
    case "spotOnto": return { ...shared, type: "spotIntent" };
    case "rinseTarget": return { ...shared, type: "rinseIntent" };
    case "placeInInstrument":
    case "readInstrument": return { ...shared, type: "instrumentReadIntent" };
    default: return undefined;
  }
};

export const useGuidedRehearsalController = ({
  attemptId,
  definition,
  enabled,
  runtime,
  setInteractionFeedback,
}: GuidedRehearsalBridgeOptions): GuidedRehearsalBridge => {
  const definitionRef = useRef(definition);
  const runtimeRef = useRef(runtime);
  const attemptIdRef = useRef(attemptId);
  const revisionRef = useRef(0);
  const latestInvalidFeedbackRef = useRef<InteractionInvalidFeedback | undefined>(undefined);
  const latestBridgeFeedbackRef = useRef<{ message: string; recovery?: string } | undefined>(undefined);
  const waitersRef = useRef<RevisionWaiter[]>([]);
  const [visibleRevision, setVisibleRevision] = useState(0);
  const visibleRevisionRef = useRef(visibleRevision);
  visibleRevisionRef.current = visibleRevision;
  definitionRef.current = definition;
  runtimeRef.current = runtime;

  const settleWaiters = useCallback((acknowledged: boolean) => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((waiter) => {
      if (waiter.signal && waiter.abortListener) {
        waiter.signal.removeEventListener("abort", waiter.abortListener);
      }
      waiter.resolve(acknowledged);
    });
  }, []);

  useLayoutEffect(() => {
    const settled = waitersRef.current.filter((waiter) => waiter.revision <= visibleRevision);
    waitersRef.current = waitersRef.current.filter((waiter) => waiter.revision > visibleRevision);
    settled.forEach((waiter) => {
      if (waiter.signal && waiter.abortListener) {
        waiter.signal.removeEventListener("abort", waiter.abortListener);
      }
      waiter.resolve(true);
    });
  }, [visibleRevision]);

  useLayoutEffect(() => {
    if (attemptIdRef.current !== attemptId) {
      settleWaiters(false);
      attemptIdRef.current = attemptId;
      revisionRef.current = 0;
      runtimeRef.current.reset();
    }
    setVisibleRevision(0);
    latestInvalidFeedbackRef.current = undefined;
    latestBridgeFeedbackRef.current = undefined;
    setInteractionFeedback(undefined);
  }, [attemptId, setInteractionFeedback, settleWaiters]);

  useLayoutEffect(() => () => settleWaiters(false), [settleWaiters]);

  const waitForVisibleRevision = useCallback((revision: number, signal?: AbortSignal) => {
    if (visibleRevisionRef.current >= revision) return Promise.resolve(true);
    if (signal?.aborted) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const waiter: RevisionWaiter = { revision, resolve, signal };
      if (signal) {
        waiter.abortListener = () => {
          waitersRef.current = waitersRef.current.filter((candidate) => candidate !== waiter);
          resolve(false);
        };
        signal.addEventListener("abort", waiter.abortListener, { once: true });
      }
      waitersRef.current.push(waiter);
    });
  }, []);

  const publishRevision = useCallback(async (
    increment: number,
    invalidFeedback: InteractionInvalidFeedback | undefined,
    signal?: AbortSignal,
  ) => {
    latestInvalidFeedbackRef.current = invalidFeedback;
    setInteractionFeedback(invalidFeedback);
    revisionRef.current += Math.max(1, increment);
    const revision = revisionRef.current;
    setVisibleRevision(revision);
    const acknowledged = await waitForVisibleRevision(revision, signal);
    return { acknowledged, revision };
  }, [setInteractionFeedback, waitForVisibleRevision]);

  const compactSnapshot = useCallback((): Record<string, JsonValue> => {
    const currentDefinition = definitionRef.current;
    const state = runtimeRef.current.getState();
    const process = getProcess(currentDefinition);
    const node = process.nodes.find((candidate) => candidate.id === state.currentNodeId);
    const action = expectedActionFor(currentDefinition, state);
    const interaction = interactionForAction(action);
    const dispense = currentDispenseRecord(currentDefinition, state);
    const latestFeedback = latestBridgeFeedbackRef.current
      ?? latestInvalidFeedbackRef.current
      ?? state.feedbackQueue.at(-1);
    return {
      attemptId: clip(attemptIdRef.current, 80),
      currentNode: {
        id: clip(node?.id ?? state.currentNodeId, 80),
        title: clip(node?.title ?? "Unknown step", 90),
        interaction: interaction?.type ?? "none",
      },
      completed: state.completedNodes.length >= process.nodes.length,
      completedStepCount: state.completedNodes.length,
      evidenceCount: state.measurements.length + state.notebook.length + state.calculations.length,
      color: dispense?.colorState ?? "clear",
      latestFeedback: latestFeedback
        ? {
            message: sanitizeRehearsalFeedback(latestFeedback.message),
            ...(latestFeedback.recovery
              ? { recovery: sanitizeRehearsalFeedback(latestFeedback.recovery) }
              : {}),
          }
        : null,
      recommendedNextOperation: nextOperationFor(currentDefinition, state),
    };
  }, []);

  const inspect = useCallback((): JsonValue => {
    const currentDefinition = definitionRef.current;
    const state = runtimeRef.current.getState();
    const node = getProcess(currentDefinition).nodes.find(
      (candidate) => candidate.id === state.currentNodeId,
    );
    const action = expectedActionFor(currentDefinition, state);
    const interaction = interactionForAction(action);
    const expectedDefinitionIds = new Set([
      interaction?.sourceDefinitionId,
      interaction?.targetDefinitionId,
      stringActionParameter(action, "sourceDefinitionId"),
      stringActionParameter(action, "targetDefinitionId"),
      stringActionParameter(action, "equipmentDefinitionId"),
    ].filter((value): value is string => Boolean(value)));
    const visibleEquipment = state.equipmentInstances
      .filter((item) => item.location === "shelf" || isVisibleWorkbenchLocation(item.location))
      .sort((left, right) =>
        Number(expectedDefinitionIds.has(right.definitionId)) -
        Number(expectedDefinitionIds.has(left.definitionId)),
      )
      .slice(0, 4)
      .map((item) => ({
        id: clip(item.id, 80),
        label: clip(item.label, 36),
        location: item.location,
      }));
    const evidence = [
      ...state.measurements.map((item) => ({
        id: clip(item.id, 80),
        kind: "measurement",
        value: item.value,
        unit: clip(item.unit, 24),
      })),
      ...state.calculations.map((item) => ({
        id: clip(item.id, 80),
        kind: "calculation",
        unit: clip(item.unit, 24),
        passed: item.passed ?? null,
      })),
    ].slice(-4);
    const objective = "learningGoal" in currentDefinition
      ? currentDefinition.learningGoal
      : currentDefinition.description;
    const fullInspection: Record<string, JsonValue> = {
      ...compactSnapshot(),
      lab: {
        title: clip(currentDefinition.title, 80),
        objective: clip(objective, 120),
      },
      currentNode: {
        id: clip(node?.id ?? state.currentNodeId, 80),
        title: clip(node?.title ?? "Unknown step", 90),
        expectedInteraction: interaction?.type ?? "none",
      },
      visibleEquipment,
      evidence,
    };
    if (inspectionFitsBudget(fullInspection, revisionRef.current)) return fullInspection;

    const compactInspection: Record<string, JsonValue> = {
      attemptId: clip(attemptIdRef.current, 80),
      currentNode: fullInspection.currentNode,
      completed: fullInspection.completed,
      completedStepCount: fullInspection.completedStepCount,
      evidenceCount: fullInspection.evidenceCount,
      color: fullInspection.color,
      latestFeedback: fullInspection.latestFeedback,
      recommendedNextOperation: fullInspection.recommendedNextOperation,
      lab: {
        title: clip(currentDefinition.title, 60),
        objective: clip(objective, 80),
      },
      visibleEquipment: visibleEquipment.slice(0, 2),
      evidence: evidence.slice(-2),
    };
    if (inspectionFitsBudget(compactInspection, revisionRef.current)) return compactInspection;

    const minimalInspection: Record<string, JsonValue> = {
      attemptId: clip(attemptIdRef.current, 80),
      currentNode: fullInspection.currentNode,
      completed: fullInspection.completed,
      completedStepCount: fullInspection.completedStepCount,
      evidenceCount: fullInspection.evidenceCount,
      color: fullInspection.color,
      recommendedNextOperation: fullInspection.recommendedNextOperation,
      visibleEquipment: visibleEquipment.slice(0, 2).map((item) => ({
        id: item.id,
        label: clip(item.label, 24),
        location: item.location,
      })),
      evidence: [],
    };
    if (inspectionFitsBudget(minimalInspection, revisionRef.current)) return minimalInspection;

    return {
      attemptId: clip(attemptIdRef.current, 40),
      currentNode: {
        id: clip(node?.id ?? state.currentNodeId, 40),
        title: clip(node?.title ?? "Unknown step", 48),
        expectedInteraction: interaction?.type ?? "none",
      },
      completed: state.completedNodes.length >= getProcess(currentDefinition).nodes.length,
      evidenceCount: state.measurements.length + state.notebook.length + state.calculations.length,
      recommendedNextOperation: nextOperationFor(currentDefinition, state),
    };
  }, [compactSnapshot]);

  const result = useCallback((
    ok: boolean,
    code: string,
    message: string,
    revision: number,
    data?: Record<string, JsonValue>,
  ): WebMCPResult<JsonValue> => ({
    ok,
    code,
    message,
    ...(data ? { data } : {}),
    state: { surface: "rehearsal", revision },
  }), []);

  const rejectAttempt = useCallback(async (
    code: string,
    message: string,
    recovery: string,
    signal?: AbortSignal,
  ): Promise<WebMCPResult<JsonValue>> => {
    if (signal?.aborted) {
      return result(false, "REHEARSAL_ABORTED", "The rehearsal call was cancelled before it changed state.", revisionRef.current);
    }
    const publicMessage = sanitizeRehearsalFeedback(message);
    const publicRecovery = sanitizeRehearsalFeedback(recovery);
    const feedback: InteractionInvalidFeedback = {
      reason: "incompatibleIntent",
      message: publicMessage,
      recovery: publicRecovery,
      nodeId: runtimeRef.current.getState().currentNodeId,
      actionId: expectedActionFor(definitionRef.current, runtimeRef.current.getState())?.id,
    };
    latestBridgeFeedbackRef.current = { message: publicMessage, recovery: publicRecovery };
    const published = await publishRevision(1, feedback, signal);
    return result(
      false,
      published.acknowledged ? code : "VISIBLE_STATE_ACK_ABORTED",
      published.acknowledged ? publicMessage : "The attempt settled, but visible acknowledgement was cancelled. Inspect before retrying.",
      published.revision,
      compactSnapshot(),
    );
  }, [compactSnapshot, publishRevision, result]);

  const publishSequence = useCallback(async (
    sequence: InteractionSequenceResult,
    signal?: AbortSignal,
    extraData: Record<string, JsonValue> = {},
    acceptedMessage?: string,
  ): Promise<WebMCPResult<JsonValue>> => {
    if (sequence.steps.length === 0) {
      return result(
        false,
        "REHEARSAL_ABORTED",
        sequence.feedback?.message ?? "The rehearsal call was cancelled before it changed state.",
        revisionRef.current,
        compactSnapshot(),
      );
    }
    const invalid = sequence.feedback?.invalid;
    const latestStep = sequence.steps.at(-1);
    const publicSequenceMessage = sanitizeRehearsalFeedback(sequence.status === "completed" && acceptedMessage
      ? acceptedMessage
      : sequence.feedback?.message ?? latestStep?.message ?? "The rehearsal action completed.");
    const publicRecovery = sequence.feedback?.recovery ?? latestStep?.recovery;
    latestBridgeFeedbackRef.current = {
      message: publicSequenceMessage,
      ...(publicRecovery
        ? { recovery: sanitizeRehearsalFeedback(publicRecovery) }
        : {}),
    };
    const published = await publishRevision(sequence.steps.length, invalid, signal);
    const accepted = sequence.status === "completed";
    const code = !published.acknowledged
      ? "VISIBLE_STATE_ACK_ABORTED"
      : accepted
        ? "REHEARSAL_ACTION_ACCEPTED"
        : sequence.status === "aborted"
          ? "REHEARSAL_ABORTED"
          : "REHEARSAL_ACTION_REJECTED";
    const message = !published.acknowledged
      ? "The action settled, but visible acknowledgement was cancelled. Inspect before retrying."
      : publicSequenceMessage;
    return result(
      accepted && published.acknowledged,
      code,
      message,
      published.revision,
      { ...compactSnapshot(), ...extraData },
    );
  }, [compactSnapshot, publishRevision, result]);

  const controller = useMemo<RehearsalController | undefined>(() => {
    if (!enabled) return undefined;
    return {
      getRevision: () => revisionRef.current,
      inspect,
      act: async (input, signal) => {
        const state = runtimeRef.current.getState();
        const action = expectedActionFor(definitionRef.current, state);
        const interaction = interactionForAction(action);
        if (!action || !interaction) {
          return rejectAttempt(
            "NO_CURRENT_INTERACTION",
            "The current step has no supported physical interaction.",
            "Inspect the rehearsal and use the recommended operation.",
            signal,
          );
        }
        if (interaction.type === "dispenseDrops") {
          return rejectAttempt(
            "USE_TITRATION_TOOL",
            "The current step is a titration operation.",
            currentNodeRecovery(definitionRef.current, state, "Use operate_titration."),
            signal,
          );
        }
        if (interaction.type === "recordNotebook" || interaction.type === "recordTimeSeries") {
          return rejectAttempt(
            "USE_EVIDENCE_TOOL",
            "The current step records evidence.",
            currentNodeRecovery(definitionRef.current, state, "Use record_step_evidence."),
            signal,
          );
        }
        if (interaction.type === "submitCalculation") {
          return rejectAttempt(
            "USE_CALCULATION_TOOL",
            "The current step submits a calculation.",
            currentNodeRecovery(definitionRef.current, state, "Use submit_step_calculation."),
            signal,
          );
        }
        const intent = intentForAction(action, input);
        if (!intent) {
          return rejectAttempt("UNSUPPORTED_INTERACTION", "The current interaction is not supported by this rehearsal tool.", "Use the visible Player control for this step.", signal);
        }
        return publishSequence(runtimeRef.current.performIntents([intent], signal), signal);
      },
      operateTitration: async (input, signal) => {
        const stateBefore = runtimeRef.current.getState();
        const action = expectedActionFor(definitionRef.current, stateBefore);
        const interaction = interactionForAction(action);
        if (!action || interaction?.type !== "dispenseDrops") {
          return rejectAttempt(
            "NOT_TITRATION_STEP",
            "The current step is not the titration delivery step.",
            currentNodeRecovery(definitionRef.current, stateBefore, "Inspect and use the recommended operation."),
            signal,
          );
        }
        const beforeRecord = stateBefore.dropDispenses[action.id];
        const beforeDeliveredMl = beforeRecord?.deliveredVolumeMl ?? 0;
        let coarsePlan: CoarseTitrationPlan | undefined;
        let intents: RuntimeInteractionIntent[];
        if (input.mode === "drop") {
          intents = [{ type: "dispenseDropIntent", actionId: action.id, origin: "programmatic" }];
        } else if (input.mode === "accept") {
          intents = [{ type: "dispenseCompleteIntent", actionId: action.id, origin: "programmatic" }];
        } else {
          const endpointDropCount = beforeRecord?.endpointDropCount
            ?? (typeof action.parameters.endpointDropCount === "number"
              ? Math.round(action.parameters.endpointDropCount)
              : 0);
          const currentDrops = beforeRecord?.dropsDispensed ?? 0;
          coarsePlan = planCoarseTitration(endpointDropCount, currentDrops);
          if (coarsePlan.status === "unavailable") {
            return rejectAttempt("TITRATION_PLAN_UNAVAILABLE", "The titration drop plan is unavailable.", "Reset the rehearsal or restage the experiment.", signal);
          }
          if (coarsePlan.status === "use_single_drop") {
            return rejectAttempt("USE_SINGLE_DROP_MODE", "The titration is at the fine-window boundary.", "Use one drop at a time, then accept the visible endpoint.", signal);
          }
          intents = Array.from({ length: coarsePlan.count }, () => ({
            type: "dispenseDropIntent" as const,
            actionId: action.id,
            origin: "programmatic" as const,
          }));
        }
        const sequence = runtimeRef.current.performIntents(intents, signal);
        const afterRecord = runtimeRef.current.getState().dropDispenses[action.id];
        const addedVolumeMl = Math.max(
          0,
          Number(((afterRecord?.deliveredVolumeMl ?? beforeDeliveredMl) - beforeDeliveredMl).toFixed(6)),
        );
        const afterDrops = afterRecord?.dropsDispensed ?? beforeRecord?.dropsDispensed ?? 0;
        const afterEndpointDropCount = afterRecord?.endpointDropCount
          ?? beforeRecord?.endpointDropCount
          ?? (typeof action.parameters.endpointDropCount === "number"
            ? Math.round(action.parameters.endpointDropCount)
            : 0);
        const nextMode = afterRecord?.accepted
          ? undefined
          : afterRecord?.colorState === "palePink" || afterRecord?.colorState === "darkPink"
            ? "accept"
            : planCoarseTitration(afterEndpointDropCount, afterDrops).status === "ready"
              ? "coarse"
              : "drop";
        const coarseWasCapped = coarsePlan?.status === "ready" && coarsePlan.capped;
        const acceptedMessage = input.mode === "coarse"
          ? coarseWasCapped
            ? "A bounded coarse batch was delivered. Inspect and continue coarse delivery before switching to single drops."
            : "Coarse delivery stopped at the fine-window boundary. Continue one drop at a time."
          : input.mode === "drop"
            ? afterRecord?.colorState === "palePink"
              ? "One ordinary drop was added and the visible endpoint color is present."
              : "Exactly one ordinary drop was added."
            : "The visible endpoint was accepted through the ordinary runtime path.";
        return publishSequence(sequence, signal, {
          mode: input.mode,
          operationsAttempted: sequence.steps.length,
          addedVolumeMl,
          color: afterRecord?.colorState ?? beforeRecord?.colorState ?? "clear",
          ...(nextMode ? { recommendedMode: nextMode } : {}),
        }, acceptedMessage);
      },
      recordEvidence: async (signal) => {
        const state = runtimeRef.current.getState();
        const action = expectedActionFor(definitionRef.current, state);
        const interaction = interactionForAction(action);
        if (!action || (interaction?.type !== "recordNotebook" && interaction?.type !== "recordTimeSeries")) {
          return rejectAttempt(
            "NOT_EVIDENCE_STEP",
            "The current step does not record evidence.",
            currentNodeRecovery(definitionRef.current, state, "Inspect and use the recommended operation."),
            signal,
          );
        }
        if (actionInputField(action)?.required) {
          return rejectAttempt("LEARNER_INPUT_REQUIRED", "This evidence step requires learner input that the no-argument tool cannot fabricate.", "Enter the value in the visible Player, then retry the ordinary evidence control.", signal);
        }
        const intent: RuntimeInteractionIntent = interaction.type === "recordTimeSeries"
          ? { type: "timeSeriesRecordIntent", actionId: action.id, origin: "programmatic" }
          : { type: "notebookRecordIntent", actionId: action.id, origin: "programmatic" };
        return publishSequence(runtimeRef.current.performIntents([intent], signal), signal);
      },
      submitCalculation: async (input, signal) => {
        const state = runtimeRef.current.getState();
        const action = expectedActionFor(definitionRef.current, state);
        const interaction = interactionForAction(action);
        if (!action || interaction?.type !== "submitCalculation") {
          return rejectAttempt(
            "NOT_CALCULATION_STEP",
            "The current step does not submit a calculation.",
            currentNodeRecovery(definitionRef.current, state, "Inspect and use the recommended operation."),
            signal,
          );
        }
        const field = actionInputField(action);
        if (input.value !== undefined && field?.mode !== "numeric") {
          return rejectAttempt("CALCULATION_INPUT_NOT_ACCEPTED", "The current calculation derives its value from recorded evidence.", "Omit value so the ordinary calculation uses the evidence already collected.", signal);
        }
        if (field && field.mode !== "numeric") {
          return rejectAttempt("UNSUPPORTED_CALCULATION_INPUT", "The current calculation does not use numeric learner input.", "Complete it with the visible Player control.", signal);
        }
        const intent: RuntimeInteractionIntent = {
          type: "calculationSubmitIntent",
          actionId: action.id,
          origin: "programmatic",
          value: input.value,
        };
        const sequence = runtimeRef.current.performIntents([intent], signal);
        const calculation = runtimeRef.current.getState().calculations.at(-1);
        return publishSequence(
          sequence,
          signal,
          calculation
            ? {
                calculation: {
                  id: clip(calculation.id, 80),
                  unit: clip(calculation.unit, 24),
                  passed: calculation.passed ?? null,
                },
              }
            : {},
          calculation?.passed === false
            ? "The calculation was submitted but did not satisfy the current tolerance. Review the recorded evidence and retry."
            : undefined,
        );
      },
      reset: async (signal) => {
        if (signal.aborted) {
          return result(false, "REHEARSAL_ABORTED", "The reset was cancelled before it changed state.", revisionRef.current);
        }
        runtimeRef.current.reset();
        latestBridgeFeedbackRef.current = undefined;
        const published = await publishRevision(1, undefined, signal);
        return result(
          published.acknowledged,
          published.acknowledged ? "REHEARSAL_RESET" : "VISIBLE_STATE_ACK_ABORTED",
          published.acknowledged
            ? "The guided rehearsal was reset to its initial state."
            : "The reset settled, but visible acknowledgement was cancelled. Inspect before retrying.",
          published.revision,
          compactSnapshot(),
        );
      },
    };
  }, [compactSnapshot, enabled, inspect, publishRevision, publishSequence, rejectAttempt, result]);

  const performVisibleIntent = useCallback((intent: RuntimeInteractionIntent): boolean => {
    if (!enabled) return false;
    const sequence = runtimeRef.current.performIntents([intent]);
    void publishSequence(sequence);
    return sequence.status === "completed";
  }, [enabled, publishSequence]);

  return { controller, performVisibleIntent, visibleRevision };
};
