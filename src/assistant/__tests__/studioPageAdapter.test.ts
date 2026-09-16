import { describe, expect, it, vi } from "vitest";
import { createStudioAssistantAdapter } from "../studioPageAdapter";
import type { AssistantToolCall } from "../types";
import { createDraftFromDemo } from "../../studio/studioState";
import {
  commitStudioTransaction,
  createInitialStudioRevision,
  type StudioTransaction,
} from "../../studio/studioTransactions";

const call = (name: string, args: Record<string, unknown>): AssistantToolCall => ({
  callId: `call-${name}`,
  name,
  arguments: args,
});

describe("Studio assistant page adapter", () => {
  it("patches lab settings without replacing the whole draft", async () => {
    let draft = createDraftFromDemo();
    let revision = "rev-1";
    const committedLabels: string[] = [];
    const commitTransaction = (transaction: StudioTransaction) => {
      const result = commitStudioTransaction(draft, revision, transaction);
      if (result.ok) {
        draft = result.draft;
        revision = result.revision;
        committedLabels.push(transaction.label);
      }
      return result;
    };
    const adapter = createStudioAssistantAdapter({
      draft,
      revision,
      selectedNodeId: draft.process.startNodeId,
      applyTemplate: vi.fn(),
      focusNodeInPreview: vi.fn(),
      setDraft: vi.fn(),
      commitTransaction,
      setStatusMessage: vi.fn(),
    });

    const result = await adapter.executeTool(call("update_lab_settings", {
      title: "Custom lab",
      description: null,
      audience: "Chemistry",
      learningGoals: ["Measure precisely"],
      safetyNotes: null,
      equipment: null,
      tags: ["custom"],
    }));

    expect(result.status).toBe("ok");
    expect(draft.title).toBe("Custom lab");
    expect(draft.description).toContain("precipitates calcium carbonate");
    expect(draft.process.nodes.length).toBeGreaterThan(0);
    expect(draft.metadata.tags).toEqual(["custom"]);
    expect(committedLabels).toEqual(["Update lab settings"]);
  });

  it("patches the selected node and adds retry edges through transaction callbacks", async () => {
    let draft = createDraftFromDemo();
    let revision = "rev-1";
    const selectedNodeId = draft.process.startNodeId;
    const committedLabels: string[] = [];
    const commitTransaction = (transaction: StudioTransaction) => {
      const result = commitStudioTransaction(draft, revision, transaction);
      if (result.ok) {
        draft = result.draft;
        revision = result.revision;
        committedLabels.push(transaction.label);
      }
      return result;
    };
    const makeAdapter = () =>
      createStudioAssistantAdapter({
        draft,
        revision,
        selectedNodeId,
        applyTemplate: vi.fn(),
        focusNodeInPreview: vi.fn(),
        setDraft: vi.fn(),
        commitTransaction,
        setStatusMessage: vi.fn(),
      });

    await makeAdapter().executeTool(call("update_selected_node", {
      title: "Measure sample carefully",
      description: null,
      type: null,
      hint: "Read the meniscus.",
      successFeedback: null,
      retryFeedback: null,
    }));
    await makeAdapter().executeTool(call("add_retry_edge", { nodeId: null }));

    const selected = draft.process.nodes.find((node) => node.id === selectedNodeId);
    expect(selected).toMatchObject({
      title: "Measure sample carefully",
      hints: ["Read the meniscus."],
    });
    expect(draft.process.edges).toContainEqual({
      from: selectedNodeId,
      to: selectedNodeId,
      label: "Retry",
      condition: { type: "retry" },
    });
    expect(committedLabels).toEqual([
      "Update selected process node",
      `Add retry edge for ${selectedNodeId}`,
    ]);
  });

  it("exposes revisioned snapshots, catalog queries, validation, and preview checks", async () => {
    const draft = createDraftFromDemo();
    const adapter = createStudioAssistantAdapter({
      draft,
      revision: "rev-snapshot",
      artifactKind: "technique",
      selectedNodeId: draft.process.startNodeId,
      applyTemplate: vi.fn(),
      focusNodeInPreview: vi.fn(),
      setDraft: vi.fn(),
      setStatusMessage: vi.fn(),
    });

    const snapshot = await adapter.executeTool(call("studio_get_snapshot", {}));
    expect(snapshot.status).toBe("ok");
    expect(snapshot.data).toMatchObject({
      revision: "rev-snapshot",
      artifactKind: "technique",
    });

    const catalog = await adapter.executeTool(call("studio_query_catalog", {
      kind: "blueprints",
      query: "weigh",
    }));
    expect(catalog.status).toBe("ok");
    expect(JSON.stringify(catalog.data)).toContain("template-weigh");

    const validationCatalog = await adapter.executeTool(call("studio_query_catalog", {
      kind: "validation",
      query: null,
    }));
    expect(validationCatalog.status).toBe("ok");
    expect(JSON.stringify(validationCatalog.data)).toContain("actionEvidence");
    expect(JSON.stringify(validationCatalog.data)).not.toContain("actionCompleted");

    const validation = await adapter.executeTool(call("studio_validate", {}));
    expect(validation.status).toBe("ok");
    expect(JSON.stringify(validation.data)).toContain("readiness");

    const preview = await adapter.executeTool(call("studio_run_preview_check", {}));
    expect(preview.status).toBe("ok");
    expect(preview.data).toMatchObject({ runnable: true });
  });

  it("plans and commits structured transactions with stale revision detection", async () => {
    let draft = createDraftFromDemo();
    let revision = createInitialStudioRevision();
    const committedLabels: string[] = [];
    const commitTransaction = (transaction: StudioTransaction) => {
      const result = commitStudioTransaction(draft, revision, transaction);
      if (result.ok) {
        draft = result.draft;
        revision = result.revision;
        committedLabels.push(transaction.label);
      }
      return result;
    };
    const adapter = createStudioAssistantAdapter({
      draft,
      revision,
      selectedNodeId: draft.process.startNodeId,
      applyTemplate: vi.fn(),
      focusNodeInPreview: vi.fn(),
      setDraft: vi.fn(),
      commitTransaction,
      setStatusMessage: vi.fn(),
    });

    const operations = [{ type: "addEquipment", definitionId: "spectrophotometer" }];
    const planned = await adapter.executeTool(call("studio_plan_transaction", {
      baseRevision: revision,
      idempotencyKey: "plan-add-spectrophotometer",
      label: "Add spectrophotometer",
      operations,
    }));
    expect(planned.status).toBe("ok");
    expect(planned.data).toMatchObject({ revision });
    expect(draft.equipment).not.toContain("spectrophotometer");

    const stale = await adapter.executeTool(call("studio_commit_transaction", {
      baseRevision: "stale",
      idempotencyKey: "stale-add-spectrophotometer",
      label: "Stale add",
      operations,
    }));
    expect(stale.status).toBe("error");
    expect(stale.data).toMatchObject({ ok: false, revision });
    expect(draft.equipment).not.toContain("spectrophotometer");

    const committed = await adapter.executeTool(call("studio_commit_transaction", {
      baseRevision: revision,
      idempotencyKey: "commit-add-spectrophotometer",
      label: "Add spectrophotometer",
      operations,
    }));
    expect(committed.status).toBe("ok");
    expect(draft.equipment).toContain("spectrophotometer");
    expect(committedLabels).toEqual(["Add spectrophotometer"]);
  });

  it("undoes the last assistant transaction through the page callback", async () => {
    const draft = createDraftFromDemo();
    const undoDraft = vi.fn();
    const adapter = createStudioAssistantAdapter({
      draft,
      revision: "rev-undo",
      selectedNodeId: draft.process.startNodeId,
      applyTemplate: vi.fn(),
      focusNodeInPreview: vi.fn(),
      setDraft: vi.fn(),
      setStatusMessage: vi.fn(),
      undoDraft,
    });

    const result = await adapter.executeTool(call("studio_undo", {}));

    expect(result.status).toBe("ok");
    expect(undoDraft).toHaveBeenCalledTimes(1);
  });
});
