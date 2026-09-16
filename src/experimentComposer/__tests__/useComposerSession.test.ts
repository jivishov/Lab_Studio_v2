import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LabDefinition } from "../../domain/types";
import { PROTOCOL_CHECK_NAMES, type ProtocolCheckReport } from "../../protocolCheck/types";
import { defaultLabInventory } from "../catalogs";
import { compileAcidBaseTitration } from "../compileAcidBaseTitration";
import { stableDraftFingerprint } from "../fingerprint";
import {
  stageGuardIdentity,
  type ExperimentRequest,
  type PublicStageSummary,
  type StagedExperiment,
} from "../types";
import {
  COMPOSER_ACTIVITY_LIMIT,
  composerSessionReducer,
  createInitialComposerSessionState,
  deriveStageStaleReasons,
  isStageApplyReady,
  type ComposerSessionState,
  useComposerSession,
} from "../useComposerSession";

vi.mock("../compileAcidBaseTitration", () => ({
  compileAcidBaseTitration: vi.fn(),
}));

const stageFixture = (
  revision = 1,
  sourceDraftFingerprint = "draft-a",
): StagedExperiment => ({
  stageId: `stage-${revision}`,
  stageRevision: revision,
  sourceInventoryRevision: 0,
  sourceDraftFingerprint,
  staleReasons: [],
} as unknown as StagedExperiment);

const reportFixture = (
  stage: StagedExperiment,
  reportId = "report-1",
  passed = true,
): ProtocolCheckReport => ({
  reportId,
  passed,
  stage: stageGuardIdentity(stage),
  completedAt: "2026-08-29T18:00:00.000Z",
  checks: PROTOCOL_CHECK_NAMES.map((name) => ({
    name,
    status: passed ? "passed" : "failed",
    message: `${name} fixture`,
  })),
  limitations: {
    scientific: ["Scientific fixture limitation."],
    safety: ["Safety fixture limitation."],
    physical: ["Physical fixture limitation."],
  },
});

const requestFixture: ExperimentRequest = {
  schemaVersion: "1",
  familyId: "acid_base_titration_v1",
  expectedInventoryRevision: 0,
  objective: "Estimate a synthetic acid molarity.",
  audience: "high_school",
  experience: "novice",
  durationMinutes: 45,
  deliveryContext: "virtual_training",
  aliquotVolumeMl: 20,
  endpointEvidence: "phenolphthalein",
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.mocked(compileAcidBaseTitration).mockReset();
});

describe("Composer session reducer", () => {
  it("advances revisions monotonically, bounds activity, and preserves stage/report on failed preview", () => {
    let state = createInitialComposerSessionState();
    state = composerSessionReducer(state, {
      type: "preview_succeeded",
      stage: stageFixture(),
      source: "webmcp",
      now: "2026-08-29T18:00:00.000Z",
    });
    state = {
      ...state,
      protocolReport: reportFixture(stageFixture()),
    };
    const guarded = state;
    state = composerSessionReducer(state, {
      type: "preview_failed",
      message: "MISSING_BURETTE: add a burette.",
      source: "webmcp",
      now: "2026-08-29T18:01:00.000Z",
    });
    expect(state.revision).toBe(guarded.revision + 1);
    expect(state.stage).toBe(guarded.stage);
    expect(state.protocolReport).toBe(guarded.protocolReport);

    for (let index = 0; index < COMPOSER_ACTIVITY_LIMIT + 5; index += 1) {
      state = composerSessionReducer(state, {
        type: "delegate_result",
        operation: "protocol",
        ok: false,
        message: `not-ready-${index}`,
        now: `2026-08-29T18:${String(index).padStart(2, "0")}:00.000Z`,
      });
    }
    expect(state.activity).toHaveLength(COMPOSER_ACTIVITY_LIMIT);
    expect(state.activity.at(-1)?.message).toBe(`not-ready-${COMPOSER_ACTIVITY_LIMIT + 4}`);
  });

  it("invalidates a report on inventory staleness and recomputes both stale reasons", () => {
    const stage = stageFixture();
    let state: ComposerSessionState = {
      ...createInitialComposerSessionState(),
      stage,
      rehearsalOpenIntent: stage.stageId,
      protocolReport: reportFixture(stage),
    };
    const inventory = { ...state.inventory, revision: 1 };
    state = composerSessionReducer(state, {
      type: "replace_inventory",
      inventory,
      source: "webmcp",
      now: "2026-08-29T18:00:00.000Z",
    });
    expect(state.protocolReport).toBeUndefined();
    expect(state.rehearsalOpenIntent).toBeUndefined();
    expect(state.stage?.staleReasons).toEqual(["inventory_changed"]);
    expect(deriveStageStaleReasons(state.stage, 1, "draft-b")).toEqual([
      "inventory_changed",
      "draft_changed",
    ]);
  });

  it("retires a rehearsal intent when draft staleness is published or its delegate fails", () => {
    const stage = stageFixture();
    let state: ComposerSessionState = {
      ...createInitialComposerSessionState(),
      stage,
      rehearsalOpenIntent: stage.stageId,
    };
    state = composerSessionReducer(state, {
      type: "refresh_staleness",
      staleReasons: ["draft_changed"],
      now: "2026-08-29T18:00:00.000Z",
    });
    expect(state.rehearsalOpenIntent).toBeUndefined();

    state = { ...state, rehearsalOpenIntent: stage.stageId };
    state = composerSessionReducer(state, {
      type: "delegate_result",
      operation: "rehearsal",
      ok: false,
      message: "Rehearsal is not ready.",
      now: "2026-08-29T18:01:00.000Z",
    });
    expect(state.rehearsalOpenIntent).toBeUndefined();
  });

  it("opens Apply only for a passing report bound to the exact current non-stale stage", () => {
    const stage = stageFixture(2);
    const exact = {
      reportId: "report-exact",
      passed: true,
      stage: {
        stageId: stage.stageId,
        stageRevision: stage.stageRevision,
        sourceInventoryRevision: stage.sourceInventoryRevision,
        sourceDraftFingerprint: stage.sourceDraftFingerprint,
      },
    };
    expect(isStageApplyReady(stage, exact)).toBe(true);
    expect(isStageApplyReady(stage, { ...exact, stage: { ...exact.stage, stageRevision: 1 } })).toBe(false);
    expect(isStageApplyReady({ ...stage, staleReasons: ["draft_changed"] }, exact)).toBe(false);
    // An aborted Protocol run returns no completed report, while a failed run binds passed: false.
    expect(isStageApplyReady(stage, undefined)).toBe(false);
    expect(isStageApplyReady(stage, reportFixture(stage, "report-failed", false))).toBe(false);
  });
});

describe("Composer session controller", () => {
  const draft = { id: "composer-test-draft" } as unknown as LabDefinition;

  it("atomically rejects a second inventory replacement that raced on the same revision", async () => {
    const { result } = renderHook(() => useComposerSession({
      draft,
      applyStage: () => ({ ok: true }),
    }));
    const next = defaultLabInventory();
    next.revision = 1;
    let outcomes: Awaited<ReturnType<typeof result.current.controller.replaceInventory>>[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        result.current.controller.replaceInventory(structuredClone(next), new AbortController().signal),
        result.current.controller.replaceInventory(structuredClone(next), new AbortController().signal),
      ]);
    });
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.code === "STALE_INVENTORY_REVISION")).toHaveLength(1);
    expect(result.current.state.inventory.revision).toBe(1);
  });

  it("lets only the newest concurrent preview commit a unique successful stage revision", async () => {
    const first = deferred<Awaited<ReturnType<typeof compileAcidBaseTitration>>>();
    const second = deferred<Awaited<ReturnType<typeof compileAcidBaseTitration>>>();
    vi.mocked(compileAcidBaseTitration)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const fingerprint = stableDraftFingerprint(draft);
    const firstStage = stageFixture(1, fingerprint);
    const secondStage = { ...stageFixture(1, fingerprint), stageId: "stage-newest" };
    const summary = {} as PublicStageSummary;
    const { result } = renderHook(() => useComposerSession({
      draft,
      applyStage: () => ({ ok: true }),
    }));
    let firstResult!: ReturnType<typeof result.current.controller.preview>;
    let secondResult!: ReturnType<typeof result.current.controller.preview>;
    act(() => {
      firstResult = result.current.controller.preview(requestFixture, new AbortController().signal);
      secondResult = result.current.controller.preview(requestFixture, new AbortController().signal);
    });
    second.resolve({ ok: true, stage: secondStage, summary });
    await act(async () => { await secondResult; });
    first.resolve({ ok: true, stage: firstStage, summary });
    let superseded!: Awaited<typeof firstResult>;
    await act(async () => { superseded = await firstResult; });
    expect(superseded).toMatchObject({ ok: false, code: "PREVIEW_SUPERSEDED" });
    expect(result.current.stage?.stageId).toBe("stage-newest");
    expect(result.current.state.nextStageRevision).toBe(2);
  });

  it("ignores a late mismatched Protocol report without clearing the current exact report", async () => {
    const fingerprint = stableDraftFingerprint(draft);
    const stage = stageFixture(1, fingerprint);
    vi.mocked(compileAcidBaseTitration).mockResolvedValue({
      ok: true,
      stage,
      summary: {} as PublicStageSummary,
    });
    const { result } = renderHook(() => useComposerSession({
      draft,
      applyStage: () => ({ ok: true }),
    }));
    await act(async () => {
      await result.current.controller.preview(requestFixture, new AbortController().signal);
    });
    const exact = reportFixture(stage, "report-current");
    await act(async () => { await result.current.setProtocolReport(exact); });
    await act(async () => {
      await result.current.setProtocolReport({
        ...reportFixture(stage, "report-late"),
        stage: { ...stageGuardIdentity(stage), stageRevision: 999 },
      });
    });
    expect(result.current.protocolReport).toEqual(exact);
  });

  it("does not resurrect a passing report after a draft edit is undone", async () => {
    const originalDraft = { ...draft, title: "Original" } as LabDefinition;
    const editedDraft = { ...originalDraft, title: "Edited" };
    const fingerprint = stableDraftFingerprint(originalDraft);
    const stage = stageFixture(1, fingerprint);
    vi.mocked(compileAcidBaseTitration).mockResolvedValue({
      ok: true,
      stage,
      summary: {} as PublicStageSummary,
    });
    const { result, rerender } = renderHook(
      ({ currentDraft }: { currentDraft: LabDefinition }) => useComposerSession({
        draft: currentDraft,
        applyStage: () => ({ ok: true }),
      }),
      { initialProps: { currentDraft: originalDraft } },
    );
    await act(async () => {
      await result.current.controller.preview(requestFixture, new AbortController().signal);
      await result.current.setProtocolReport(reportFixture(stage, "report-before-edit"));
    });
    expect(result.current.canApply).toBe(true);

    act(() => rerender({ currentDraft: editedDraft }));
    expect(result.current.stage?.staleReasons).toEqual(["draft_changed"]);
    expect(result.current.protocolReport).toBeUndefined();

    act(() => rerender({ currentDraft: originalDraft }));
    expect(result.current.stage?.staleReasons).toEqual([]);
    expect(result.current.protocolReport).toBeUndefined();
    expect(result.current.canApply).toBe(false);
  });

  it("preserves the rehearsal destination surface and live rehearsal revision after acknowledgement", async () => {
    const fingerprint = stableDraftFingerprint(draft);
    const stage = stageFixture(1, fingerprint);
    vi.mocked(compileAcidBaseTitration).mockResolvedValue({
      ok: true,
      stage,
      summary: {} as PublicStageSummary,
    });
    const { result } = renderHook(() => useComposerSession({
      draft,
      applyStage: () => ({ ok: true }),
      delegates: {
        startRehearsal: async () => ({
          ok: true,
          code: "REHEARSAL_READY",
          message: "Rehearsal destination ready.",
          state: { surface: "rehearsal", revision: 7 },
        }),
      },
    }));
    await act(async () => {
      await result.current.controller.preview(requestFixture, new AbortController().signal);
    });

    let outcome!: Awaited<ReturnType<typeof result.current.controller.startRehearsal>>;
    await act(async () => {
      outcome = await result.current.controller.startRehearsal(
        stage.stageId,
        new AbortController().signal,
      );
    });

    expect(outcome).toMatchObject({
      ok: true,
      state: { surface: "rehearsal", revision: 7 },
    });
  });
});
