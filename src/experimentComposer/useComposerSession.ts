import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { LabDefinition } from "../domain/types";
import type { JsonValue, WebMCPResult } from "../webmcp/result";
import type { ProtocolCheckReport } from "../protocolCheck/types";
import { defaultLabInventory } from "./catalogs";
import { compileAcidBaseTitration } from "./compileAcidBaseTitration";
import { stableDraftFingerprint } from "./fingerprint";
import {
  stageGuardIdentity,
  stageGuardsMatch,
  type ComposerSessionController,
  type ExperimentRequest,
  type LabInventoryProfile,
  type ProtocolReportGuardIdentity,
  type PublicStageSummary,
  type StageStaleReason,
  type StagedExperiment,
} from "./types";

export const COMPOSER_ACTIVITY_LIMIT = 32;

const compactSessionMessage = (message: string, limit: number): string => message
  .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

export type ComposerWebMCPStatus = "unsupported" | "registering" | "ready" | "error";

export interface ComposerActivityItem {
  id: number;
  kind: "info" | "success" | "warning" | "error";
  message: string;
  createdAt: string;
}

export interface ComposerSessionState {
  revision: number;
  nextActivityId: number;
  nextStageRevision: number;
  inventory: LabInventoryProfile;
  stage?: StagedExperiment;
  protocolReport?: ProtocolCheckReport;
  drawerOpen: boolean;
  rehearsalOpenIntent?: string;
  webMCPStatus: ComposerWebMCPStatus;
  webMCPError?: string;
  activity: ComposerActivityItem[];
}

export type ComposerSessionEvent =
  | { type: "open_drawer"; now: string }
  | { type: "close_drawer"; now: string }
  | { type: "replace_inventory"; inventory: LabInventoryProfile; now: string; source: "human" | "webmcp" }
  | { type: "preview_succeeded"; stage: StagedExperiment; now: string; source: "human" | "webmcp" }
  | { type: "preview_failed"; message: string; now: string; source: "human" | "webmcp" }
  | { type: "refresh_staleness"; staleReasons: StageStaleReason[]; now: string }
  | { type: "discard_stage"; now: string }
  | { type: "apply_stage"; now: string }
  | { type: "request_rehearsal"; stageId: string; now: string }
  | { type: "delegate_result"; operation: "rehearsal" | "protocol"; message: string; ok: boolean; now: string }
  | { type: "set_protocol_report"; report?: ProtocolCheckReport; now: string }
  | { type: "set_webmcp_status"; status: ComposerWebMCPStatus; error?: string; now: string };

const appendActivity = (
  state: ComposerSessionState,
  kind: ComposerActivityItem["kind"],
  message: string,
  now: string,
): Pick<ComposerSessionState, "activity" | "nextActivityId"> => ({
  activity: [
    ...state.activity,
    {
      id: state.nextActivityId,
      kind,
      message: compactSessionMessage(message, 240),
      createdAt: now,
    },
  ].slice(-COMPOSER_ACTIVITY_LIMIT),
  nextActivityId: state.nextActivityId + 1,
});

const advance = (
  state: ComposerSessionState,
  patch: Partial<ComposerSessionState>,
): ComposerSessionState => ({ ...state, ...patch, revision: state.revision + 1 });

const sameReasons = (left: StageStaleReason[], right: StageStaleReason[]): boolean =>
  left.length === right.length && left.every((reason, index) => reason === right[index]);

export const createInitialComposerSessionState = (): ComposerSessionState => ({
  revision: 0,
  nextActivityId: 2,
  nextStageRevision: 1,
  inventory: defaultLabInventory(),
  drawerOpen: false,
  webMCPStatus: "unsupported",
  activity: [{
    id: 1,
    kind: "info",
    message: "Simulation inventory profile loaded. It does not prove what is present in a physical room.",
    createdAt: new Date().toISOString(),
  }],
});

export const composerSessionReducer = (
  state: ComposerSessionState,
  event: ComposerSessionEvent,
): ComposerSessionState => {
  switch (event.type) {
    case "open_drawer":
      return state.drawerOpen ? state : advance(state, {
        drawerOpen: true,
        ...appendActivity(state, "info", "Composer review opened.", event.now),
      });
    case "close_drawer":
      return state.drawerOpen ? advance(state, { drawerOpen: false }) : state;
    case "replace_inventory": {
      const staleReasons = state.stage
        ? Array.from(new Set([...state.stage.staleReasons, "inventory_changed" as const]))
        : [];
      return advance(state, {
        inventory: event.inventory,
        stage: state.stage ? { ...state.stage, staleReasons } : undefined,
        protocolReport: undefined,
        rehearsalOpenIntent: undefined,
        ...appendActivity(
          state,
          "success",
          `Inventory revision ${event.inventory.revision} acknowledged from ${event.source === "human" ? "the visible Studio control" : "WebMCP"}.`,
          event.now,
        ),
      });
    }
    case "preview_succeeded":
      return advance(state, {
        stage: event.stage,
        nextStageRevision: Math.max(state.nextStageRevision, event.stage.stageRevision + 1),
        protocolReport: undefined,
        drawerOpen: true,
        rehearsalOpenIntent: undefined,
        ...appendActivity(
          state,
          "success",
          `Stage ${event.stage.stageRevision} replaced the prior preview and is ready for human review.`,
          event.now,
        ),
      });
    case "preview_failed":
      return advance(state, {
        ...appendActivity(
          state,
          "error",
          `Preview failed; the current stage and report were preserved. ${event.message}`,
          event.now,
        ),
      });
    case "refresh_staleness":
      if (!state.stage || sameReasons(state.stage.staleReasons, event.staleReasons)) return state;
      return advance(state, {
        stage: { ...state.stage, staleReasons: event.staleReasons },
        protocolReport: event.staleReasons.length > 0 ? undefined : state.protocolReport,
        rehearsalOpenIntent: event.staleReasons.length > 0
          ? undefined
          : state.rehearsalOpenIntent,
        ...appendActivity(
          state,
          event.staleReasons.length > 0 ? "warning" : "info",
          event.staleReasons.length > 0
            ? `Stage became stale: ${event.staleReasons.join(", ")}. Its Protocol report was invalidated.`
            : "Stage matches the current draft and inventory again; run a new Protocol Check before Apply.",
          event.now,
        ),
      });
    case "discard_stage":
      if (!state.stage) return state;
      return advance(state, {
        stage: undefined,
        protocolReport: undefined,
        rehearsalOpenIntent: undefined,
        ...appendActivity(state, "info", "The staged experiment was discarded by a human.", event.now),
      });
    case "apply_stage":
      return advance(state, {
        stage: undefined,
        protocolReport: undefined,
        rehearsalOpenIntent: undefined,
        ...appendActivity(state, "success", "The passing stage was applied to the Studio draft by a human.", event.now),
      });
    case "request_rehearsal":
      return advance(state, {
        rehearsalOpenIntent: event.stageId,
        ...appendActivity(state, "info", "Rehearsal opening was requested for the current stage.", event.now),
      });
    case "delegate_result":
      return advance(state, {
        rehearsalOpenIntent: event.operation === "rehearsal" && !event.ok
          ? undefined
          : state.rehearsalOpenIntent,
        ...appendActivity(state, event.ok ? "success" : "warning", event.message, event.now),
      });
    case "set_protocol_report":
      return advance(state, {
        protocolReport: event.report,
        ...appendActivity(
          state,
          event.report?.passed ? "success" : "warning",
          event.report
            ? `Protocol report ${event.report.reportId} recorded (${event.report.passed ? "passing" : "not passing"}).`
            : "Protocol report cleared.",
          event.now,
        ),
      });
    case "set_webmcp_status":
      if (state.webMCPStatus === event.status && state.webMCPError === event.error) return state;
      return advance(state, {
        webMCPStatus: event.status,
        webMCPError: event.error,
        ...appendActivity(
          state,
          event.status === "error" ? "error" : "info",
          event.status === "ready"
            ? "The active grounded tool surface is ready."
            : event.status === "registering"
              ? "Registering grounded Composer tools."
              : event.status === "unsupported"
                ? "This browser does not expose WebMCP; visible human Composer controls remain available."
                : `WebMCP registration failed: ${event.error ?? "unknown error"}`,
          event.now,
        ),
      });
    default:
      return state;
  }
};

export const deriveStageStaleReasons = (
  stage: StagedExperiment | undefined,
  inventoryRevision: number,
  draftFingerprint: string,
): StageStaleReason[] => {
  if (!stage) return [];
  const reasons: StageStaleReason[] = [];
  if (stage.sourceInventoryRevision !== inventoryRevision) reasons.push("inventory_changed");
  if (stage.sourceDraftFingerprint !== draftFingerprint) reasons.push("draft_changed");
  return reasons;
};

export const summarizeStage = (
  stage: StagedExperiment,
  staleReasons: StageStaleReason[],
): PublicStageSummary => ({
  stageId: stage.stageId,
  stageRevision: stage.stageRevision,
  familyId: stage.request.familyId,
  title: stage.definition.title,
  objective: stage.request.objective.trim(),
  audience: stage.request.audience,
  experience: stage.request.experience,
  durationMinutes: stage.request.durationMinutes,
  deliveryContext: stage.request.deliveryContext,
  resolvedRoles: { ...stage.blueprint.resolvedRoles },
  moduleIds: [...stage.blueprint.moduleIds],
  workingVolumes: {
    aliquotMl: stage.blueprint.model.analyteVolumeMl,
    buretteFillMl: stage.blueprint.model.buretteFillVolumeMl,
    indicatorMl: stage.blueprint.model.indicatorVolumeMl,
  },
  fidelity: structuredClone(stage.blueprint.fidelity),
  staleReasons,
});

export const isStageApplyReady = (
  stage: StagedExperiment | undefined,
  report: ProtocolReportGuardIdentity | undefined,
): boolean => Boolean(
  stage
  && stage.staleReasons.length === 0
  && report?.passed
  && stageGuardsMatch(report.stage, stageGuardIdentity(stage)),
);

export interface ComposerDelegateSlots {
  startRehearsal?: (stage: StagedExperiment, signal: AbortSignal) => Promise<WebMCPResult<JsonValue>>;
  runProtocolCheck?: (stage: StagedExperiment, signal: AbortSignal) => Promise<WebMCPResult<JsonValue>>;
}

export interface UseComposerSessionOptions {
  draft: LabDefinition;
  applyStage: (stage: StagedExperiment) => { ok: boolean; error?: string };
  delegates?: ComposerDelegateSlots;
}

export interface ComposerSessionView {
  state: ComposerSessionState;
  stage?: StagedExperiment;
  protocolReport?: ProtocolCheckReport;
  canApply: boolean;
  controller: ComposerSessionController;
  open(): Promise<void>;
  close(): Promise<void>;
  replaceInventory(inventory: LabInventoryProfile): Promise<void>;
  preview(request: ExperimentRequest): Promise<WebMCPResult<JsonValue>>;
  discard(): Promise<void>;
  apply(): Promise<{ ok: boolean; message: string }>;
  startRehearsal(): Promise<WebMCPResult<JsonValue>>;
  runProtocolCheck(): Promise<WebMCPResult<JsonValue>>;
  setProtocolReport(report?: ProtocolCheckReport): Promise<void>;
  setWebMCPStatus(status: ComposerWebMCPStatus, error?: string): Promise<void>;
}

const notReady = (revision: number, operation: string): WebMCPResult<JsonValue> => ({
  ok: false,
  code: "NOT_READY",
  message: `${operation} is not wired until Cycle 05; no success was recorded.`,
  state: { surface: "studio", revision },
});

const aborted = (revision: number): WebMCPResult<JsonValue> => ({
  ok: false,
  code: "ABORTED",
  message: "The operation was cancelled before it changed Composer state.",
  state: { surface: "studio", revision },
});

const visibleAcknowledgementAborted = (revision: number): WebMCPResult<JsonValue> => ({
  ok: false,
  code: "VISIBLE_STATE_ACK_ABORTED",
  message: "Composer state may have changed, but visible acknowledgement was cancelled. Inspect current state before retrying; do not replay the mutation blindly.",
  state: { surface: "studio", revision },
});

interface SentComposerEvent {
  revision: number;
  acknowledged: Promise<number>;
}

export const useComposerSession = ({
  draft,
  applyStage,
  delegates,
}: UseComposerSessionOptions): ComposerSessionView => {
  const [state, dispatch] = useReducer(composerSessionReducer, undefined, createInitialComposerSessionState);
  const stateRef = useRef(state);
  const draftRef = useRef(draft);
  const applyRef = useRef(applyStage);
  const delegatesRef = useRef(delegates);
  const acknowledgementRef = useRef(new Map<number, () => void>());
  const previewRequestRef = useRef(0);
  draftRef.current = draft;
  applyRef.current = applyStage;
  delegatesRef.current = delegates;

  useLayoutEffect(() => {
    stateRef.current = state;
    acknowledgementRef.current.forEach((resolve, revision) => {
      if (revision <= state.revision) {
        acknowledgementRef.current.delete(revision);
        resolve();
      }
    });
  }, [state]);

  const send = useCallback((event: ComposerSessionEvent): SentComposerEvent => {
    const next = composerSessionReducer(stateRef.current, event);
    if (next === stateRef.current) {
      return { revision: next.revision, acknowledged: Promise.resolve(next.revision) };
    }
    stateRef.current = next;
    const acknowledged = new Promise<void>((resolve) => {
      acknowledgementRef.current.set(next.revision, resolve);
    });
    dispatch(event);
    return {
      revision: next.revision,
      acknowledged: acknowledged.then(() => next.revision),
    };
  }, []);

  const waitForVisibleRevision = useCallback(async (
    sent: SentComposerEvent,
    signal: AbortSignal,
  ): Promise<boolean> => {
    if (signal.aborted) return false;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (acknowledged: boolean) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        resolve(acknowledged);
      };
      const onAbort = () => finish(false);
      signal.addEventListener("abort", onAbort, { once: true });
      void sent.acknowledged.then(() => finish(true));
    });
  }, []);

  const currentStage = useCallback((): StagedExperiment | undefined => {
    const current = stateRef.current;
    if (!current.stage) return undefined;
    const staleReasons = deriveStageStaleReasons(
      current.stage,
      current.inventory.revision,
      stableDraftFingerprint(draftRef.current),
    );
    return { ...current.stage, staleReasons };
  }, []);

  const currentReport = useCallback((): ProtocolCheckReport | undefined => {
    const stage = currentStage();
    if (!stage || stage.staleReasons.length > 0) return undefined;
    const report = stateRef.current.protocolReport;
    return report && stageGuardsMatch(report.stage, stageGuardIdentity(stage)) ? report : undefined;
  }, [currentStage]);

  useLayoutEffect(() => {
    const stage = currentStage();
    if (!stage || sameReasons(state.stage?.staleReasons ?? [], stage.staleReasons)) return;
    void send({ type: "refresh_staleness", staleReasons: stage.staleReasons, now: new Date().toISOString() }).acknowledged;
  }, [currentStage, draft, send, state.inventory.revision, state.stage]);

  const replaceInventory = useCallback(async (inventory: LabInventoryProfile): Promise<void> => {
    await send({ type: "replace_inventory", inventory, source: "human", now: new Date().toISOString() }).acknowledged;
  }, [send]);

  const previewFor = useCallback(async (
    request: ExperimentRequest,
    signal: AbortSignal,
    source: "human" | "webmcp",
  ): Promise<WebMCPResult<JsonValue>> => {
    if (signal.aborted) return aborted(stateRef.current.revision);
    const previewRequest = previewRequestRef.current + 1;
    previewRequestRef.current = previewRequest;
    const current = stateRef.current;
    const sourceDraft = draftRef.current;
    const sourceDraftFingerprint = stableDraftFingerprint(sourceDraft);
    const outcome = await compileAcidBaseTitration(
      request,
      current.inventory,
      sourceDraft,
      { stageRevision: current.nextStageRevision },
    );
    if (signal.aborted) return aborted(stateRef.current.revision);
    const publishPreviewFailure = async (code: string, message: string): Promise<WebMCPResult<JsonValue>> => {
      const sent = send({ type: "preview_failed", message, source, now: new Date().toISOString() });
      const acknowledged = await waitForVisibleRevision(sent, signal);
      return acknowledged
        ? { ok: false, code, message, state: { surface: "studio", revision: sent.revision } }
        : visibleAcknowledgementAborted(stateRef.current.revision);
    };
    if (previewRequest !== previewRequestRef.current) {
      return publishPreviewFailure(
        "PREVIEW_SUPERSEDED",
        "A newer preview request superseded this one. The current valid stage and matching report were preserved.",
      );
    }
    if (
      stateRef.current.inventory.revision !== current.inventory.revision
      || stableDraftFingerprint(draftRef.current) !== sourceDraftFingerprint
    ) {
      return publishPreviewFailure(
        "PREVIEW_CONTEXT_CHANGED",
        "Inventory or the Studio draft changed while this preview compiled. Inspect current state and preview again; the prior valid stage and report were preserved.",
      );
    }
    if (!outcome.ok) {
      const message = compactSessionMessage(
        outcome.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "),
        500,
      );
      return publishPreviewFailure(outcome.issues[0]?.code ?? "PREVIEW_FAILED", message);
    }
    const sent = send({ type: "preview_succeeded", stage: outcome.stage, source, now: new Date().toISOString() });
    if (!await waitForVisibleRevision(sent, signal)) {
      return visibleAcknowledgementAborted(stateRef.current.revision);
    }
    return {
      ok: true,
      code: "PREVIEW_STAGED",
      message: "A validated experiment is staged for visible human review; the Studio draft is unchanged.",
      data: { stageId: outcome.stage.stageId, stageRevision: outcome.stage.stageRevision },
      state: { surface: "studio", revision: sent.revision },
    };
  }, [send, waitForVisibleRevision]);

  const callDelegate = useCallback(async (
    kind: "rehearsal" | "protocol",
    stageId: string,
    signal: AbortSignal,
  ): Promise<WebMCPResult<JsonValue>> => {
    if (signal.aborted) return aborted(stateRef.current.revision);
    const publishDelegateResult = async (
      result: WebMCPResult<JsonValue>,
    ): Promise<WebMCPResult<JsonValue>> => {
      const sent = send({
        type: "delegate_result",
        operation: kind,
        ok: result.ok,
        message: result.message,
        now: new Date().toISOString(),
      });
      const acknowledged = await waitForVisibleRevision(sent, signal);
      const destinationState = kind === "rehearsal" && result.state.surface === "rehearsal"
        ? result.state
        : { surface: "studio" as const, revision: sent.revision };
      return acknowledged
        ? { ...result, state: destinationState }
        : visibleAcknowledgementAborted(stateRef.current.revision);
    };
    const stage = currentStage();
    if (!stage) {
      return publishDelegateResult({ ok: false, code: "NO_ACTIVE_STAGE", message: "Stage an experiment first.", state: { surface: "studio", revision: stateRef.current.revision } });
    }
    if (stage.stageId !== stageId) {
      return publishDelegateResult({ ok: false, code: "STALE_STAGE_ID", message: "Use the exact current stage ID from inspect_lab_preview.", state: { surface: "studio", revision: stateRef.current.revision } });
    }
    if (stage.staleReasons.length > 0) {
      return publishDelegateResult({ ok: false, code: "STALE_STAGE", message: `Restage after: ${stage.staleReasons.join(", ")}.`, state: { surface: "studio", revision: stateRef.current.revision } });
    }
    const delegate = kind === "rehearsal" ? delegatesRef.current?.startRehearsal : delegatesRef.current?.runProtocolCheck;
    if (!delegate) {
      return publishDelegateResult(notReady(
        stateRef.current.revision,
        kind === "rehearsal" ? "Rehearsal" : "Protocol Check",
      ));
    }
    if (kind === "rehearsal") {
      const sent = send({ type: "request_rehearsal", stageId, now: new Date().toISOString() });
      if (!await waitForVisibleRevision(sent, signal)) {
        return visibleAcknowledgementAborted(stateRef.current.revision);
      }
    }
    let result: WebMCPResult<JsonValue>;
    try {
      result = await delegate(stage, signal);
    } catch {
      result = {
        ok: false,
        code: "DELEGATE_FAILED",
        message: `${kind === "rehearsal" ? "Rehearsal" : "Protocol Check"} could not complete; no success was recorded.`,
        state: { surface: "studio", revision: stateRef.current.revision },
      };
    }
    return publishDelegateResult(result);
  }, [currentStage, send, waitForVisibleRevision]);

  const controller = useMemo<ComposerSessionController>(() => ({
    getRevision: () => stateRef.current.revision,
    getInventory: () => structuredClone(stateRef.current.inventory),
    getStage: currentStage,
    getProtocolReport: currentReport,
    replaceInventory: async (inventory, signal) => {
      if (signal.aborted) return aborted(stateRef.current.revision);
      const currentInventoryRevision = stateRef.current.inventory.revision;
      if (inventory.revision !== currentInventoryRevision + 1) {
        return {
          ok: false,
          code: "STALE_INVENTORY_REVISION",
          message: `Inventory changed before replacement. Inspect again and replace revision ${currentInventoryRevision}.`,
          state: { surface: "studio", revision: stateRef.current.revision },
        };
      }
      const sent = send({ type: "replace_inventory", inventory, source: "webmcp", now: new Date().toISOString() });
      if (!await waitForVisibleRevision(sent, signal)) {
        return visibleAcknowledgementAborted(stateRef.current.revision);
      }
      return {
        ok: true,
        code: "INVENTORY_REPLACED",
        message: `Inventory revision ${inventory.revision} is visible in Composer. Existing stages must be restaged.`,
        data: { inventoryRevision: inventory.revision },
        state: { surface: "studio", revision: sent.revision },
      };
    },
    preview: (request, signal) => previewFor(request, signal, "webmcp"),
    inspectPreview: () => {
      const stage = currentStage();
      return stage ? summarizeStage(stage, stage.staleReasons) : undefined;
    },
    startRehearsal: (stageId, signal) => callDelegate("rehearsal", stageId, signal),
    runProtocolCheck: (stageId, signal) => callDelegate("protocol", stageId, signal),
  }), [callDelegate, currentReport, currentStage, previewFor, send, waitForVisibleRevision]);

  const stage = state.stage
    ? { ...state.stage, staleReasons: deriveStageStaleReasons(state.stage, state.inventory.revision, stableDraftFingerprint(draft)) }
    : undefined;
  const protocolReport = stage && stage.staleReasons.length === 0 && state.protocolReport
    && stageGuardsMatch(state.protocolReport.stage, stageGuardIdentity(stage))
    ? state.protocolReport
    : undefined;
  const canApply = isStageApplyReady(stage, protocolReport);

  return {
    state,
    stage,
    protocolReport,
    canApply,
    controller,
    open: async () => { await send({ type: "open_drawer", now: new Date().toISOString() }).acknowledged; },
    close: async () => { await send({ type: "close_drawer", now: new Date().toISOString() }).acknowledged; },
    replaceInventory,
    preview: (request) => previewFor(request, new AbortController().signal, "human"),
    discard: async () => { await send({ type: "discard_stage", now: new Date().toISOString() }).acknowledged; },
    apply: async () => {
      const guardedStage = currentStage();
      const report = currentReport();
      if (!guardedStage || guardedStage.staleReasons.length > 0 || !report?.passed) {
        return { ok: false, message: "Apply requires a passing Protocol report for the exact current, non-stale stage." };
      }
      const applied = applyRef.current(guardedStage);
      if (!applied.ok) return { ok: false, message: applied.error ?? "The Studio transaction rejected Apply." };
      await send({ type: "apply_stage", now: new Date().toISOString() }).acknowledged;
      return { ok: true, message: "The generated lab replaced the Studio draft through its normal transaction path." };
    },
    startRehearsal: () => {
      const current = currentStage();
      return current
        ? callDelegate("rehearsal", current.stageId, new AbortController().signal)
        : Promise.resolve({ ok: false, code: "NO_ACTIVE_STAGE", message: "Stage an experiment first.", state: { surface: "studio", revision: stateRef.current.revision } });
    },
    runProtocolCheck: () => {
      const current = currentStage();
      return current
        ? callDelegate("protocol", current.stageId, new AbortController().signal)
        : Promise.resolve({ ok: false, code: "NO_ACTIVE_STAGE", message: "Stage an experiment first.", state: { surface: "studio", revision: stateRef.current.revision } });
    },
    setProtocolReport: async (report) => {
      const guardedStage = currentStage();
      if (report === undefined) {
        await send({ type: "set_protocol_report", report: undefined, now: new Date().toISOString() }).acknowledged;
        return;
      }
      if (
        !guardedStage
        || guardedStage.staleReasons.length > 0
        || !stageGuardsMatch(report.stage, stageGuardIdentity(guardedStage))
      ) {
        await send({
          type: "delegate_result",
          operation: "protocol",
          ok: false,
          message: "A late or mismatched Protocol report was ignored; the current report was not overwritten.",
          now: new Date().toISOString(),
        }).acknowledged;
        return;
      }
      await send({ type: "set_protocol_report", report, now: new Date().toISOString() }).acknowledged;
    },
    setWebMCPStatus: async (status, error) => { await send({ type: "set_webmcp_status", status, error, now: new Date().toISOString() }).acknowledged; },
  };
};
