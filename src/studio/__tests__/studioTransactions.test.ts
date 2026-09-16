import { describe, expect, it } from "vitest";
import { demoLab } from "../../domain/fixtures";
import type { LabDefinition } from "../../domain/types";
import { createEquipmentInstance } from "../../equipment/catalog";
import {
  commitStudioTransaction,
  createInitialStudioRevision,
  createStudioIdAllocator,
  markCompositionDetached,
  planStudioTransaction,
  sanitizeStudioExportDraft,
} from "../studioTransactions";

describe("studio transactions", () => {
  it("applies a grouped transaction atomically with a new revision", () => {
    const revision = createInitialStudioRevision();
    const result = commitStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "test-add-retry-and-equipment",
      label: "Add retry and equipment",
      operations: [
        { type: "addRetryEdge", nodeId: demoLab.process.startNodeId },
        { type: "addEquipment", definitionId: "watch-glass" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.revision).not.toBe(revision);
    expect(result.draft.process.edges).toContainEqual({
      from: demoLab.process.startNodeId,
      to: demoLab.process.startNodeId,
      label: "Retry",
      condition: { type: "retry" },
    });
    expect(result.draft.equipment).toContain("watch-glass");
  });

  it("plans a transaction without advancing the current revision", () => {
    const revision = createInitialStudioRevision();
    const planned = planStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "plan-add-watch-glass",
      label: "Plan equipment",
      operations: [{ type: "addEquipment", definitionId: "watch-glass" }],
    });

    expect(planned.ok).toBe(true);
    expect(planned.revision).toBe(revision);
    expect(planned.draft.equipment).toContain("watch-glass");

    const committed = commitStudioTransaction(demoLab, revision, {
      baseRevision: planned.revision,
      idempotencyKey: "commit-add-watch-glass",
      label: "Commit equipment",
      operations: [{ type: "addEquipment", definitionId: "watch-glass" }],
    });

    expect(committed.ok).toBe(true);
    expect(committed.revision).not.toBe(revision);
  });

  it("rejects stale revisions without mutating the draft", () => {
    const result = commitStudioTransaction(demoLab, "current", {
      baseRevision: "stale",
      idempotencyKey: "stale",
      label: "Stale edit",
      operations: [{ type: "addRetryEdge", nodeId: demoLab.process.startNodeId }],
    });

    expect(result.ok).toBe(false);
    expect(result.draft).toBe(demoLab);
    expect(result.error).toContain("Stale transaction revision");
  });

  it("rolls back the entire transaction when one operation fails", () => {
    const revision = createInitialStudioRevision();
    const result = commitStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "rollback",
      label: "Rollback",
      operations: [
        { type: "addEquipment", definitionId: "watch-glass" },
        { type: "appendTemplateStep", templateId: "missing-template" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.draft).toBe(demoLab);
    expect(result.draft.equipment).not.toContain("watch-glass");
  });

  it("rejects unsupported operations without mutating the draft", () => {
    const revision = createInitialStudioRevision();
    const result = commitStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "unknown-operation",
      label: "Unknown operation",
      operations: [{ type: "unknownOperation" } as never],
    });

    expect(result.ok).toBe(false);
    expect(result.draft).toBe(demoLab);
    expect(result.error).toContain("Unsupported Studio operation");
  });

  it("does not apply the same idempotency key twice", () => {
    const revision = createInitialStudioRevision();
    const keys = new Set<string>();
    const transaction = {
      baseRevision: revision,
      idempotencyKey: "same-key",
      label: "Add watch glass",
      operations: [{ type: "addEquipment", definitionId: "watch-glass" } as const],
    };

    const first = commitStudioTransaction(demoLab, revision, transaction, keys);
    const second = commitStudioTransaction(first.draft, first.revision, {
      ...transaction,
      baseRevision: first.revision,
    }, keys);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(second.draft.equipment.filter((definitionId) => definitionId === "watch-glass")).toHaveLength(1);
  });

  it("allocates unique ids across draft nodes, actions, validations, equipment, and techniques", () => {
    const allocator = createStudioIdAllocator(demoLab);

    expect(allocator.next("measure-20ml")).toBe("measure-20ml-2");
    expect(allocator.next("new measurement")).toBe("new-measurement");
    expect(allocator.statePath("calcium carbonate mass")).toMatch(/^state\.calcium\.carbonate\.mass/);
  });

  it("updates and removes required equipment with starting instances atomically", () => {
    const revision = createInitialStudioRevision();
    const instance = {
      ...createEquipmentInstance("watch-glass", "setup", "workbench"),
      id: "watch-glass-setup",
    };
    const added = commitStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "add-starting-equipment",
      label: "Add starting equipment",
      operations: [{ type: "upsertInitialEquipment", instance }],
    });

    expect(added.ok).toBe(true);
    expect(added.draft.equipment).toContain("watch-glass");
    expect(added.draft.initialState?.equipment).toContainEqual(instance);

    const removed = commitStudioTransaction(added.draft, added.revision, {
      baseRevision: added.revision,
      idempotencyKey: "remove-equipment",
      label: "Remove equipment",
      operations: [{ type: "removeEquipment", definitionId: "watch-glass" }],
    });

    expect(removed.ok).toBe(true);
    expect(removed.draft.equipment).not.toContain("watch-glass");
    expect(removed.draft.initialState?.equipment.some((item) => item.definitionId === "watch-glass")).toBe(false);
  });

  it("stores technique setup fields for technique export", () => {
    const revision = createInitialStudioRevision();
    const result = commitStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "technique-settings",
      label: "Update technique settings",
      operations: [
        {
          type: "updateTechniqueSettings",
          patch: {
            learningGoal: "Practice careful blank calibration.",
            resetBehavior: "resetLab",
            commonMistakes: [
              {
                id: "mistake-1",
                when: "Skipping blank",
                message: "The blank cuvette was not measured first.",
                recovery: "Insert the blank and retry.",
              },
            ],
            tags: ["spectroscopy"],
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.draft.learningGoals).toEqual(["Practice careful blank calibration."]);
    expect(result.draft.techniques[0].resetBehavior).toBe("resetLab");
    expect(result.draft.techniques[0].commonMistakes[0].message).toContain("blank cuvette");
    expect(result.draft.metadata.tags).toEqual(["spectroscopy"]);
  });

  it("detaches compiled provenance when an authored graph/action changes", () => {
    const compiled: LabDefinition = {
      ...demoLab,
      compositionManifest: {
        schemaVersion: 1,
        compilerContractVersion: "1.6",
        status: "compiled" as const,
        instances: [],
        origins: [],
      },
    };
    const revision = createInitialStudioRevision();
    const result = planStudioTransaction(compiled, revision, {
      baseRevision: revision,
      idempotencyKey: "detach-composed-action",
      label: "Edit composed action",
      operations: [{
        type: "updateAction",
        action: { ...compiled.actions[0], label: `${compiled.actions[0].label} (edited)` },
      }],
    });

    expect(result.ok).toBe(true);
    expect(result.draft.compositionManifest?.status).toBe("detached");
    expect(markCompositionDetached(result.draft)).toBe(result.draft);
  });

  it("keeps compiled provenance when a replaced draft's manifest still describes its graph", () => {
    const node = demoLab.process.nodes[0];
    const compiled: LabDefinition = {
      ...demoLab,
      compositionManifest: {
        schemaVersion: 1,
        compilerContractVersion: "1.6",
        status: "compiled" as const,
        instances: [{
          instanceId: "measuring-volume",
          techniqueId: "measuring-volume",
          version: "1.2.0",
          repeatIndex: 0,
          evidenceOutputs: [],
          completion: { exitNodeIds: [], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
        }],
        origins: [{
          nodeId: node.id,
          techniqueId: "measuring-volume",
          techniqueVersion: "1.2.0",
          instanceId: "measuring-volume",
          sourceNodeId: node.id,
        }],
      },
    };
    const revision = createInitialStudioRevision();
    const result = planStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "replace-with-matching-manifest",
      label: "Open compiled lab",
      operations: [{ type: "replaceDraft", draft: compiled }],
    });

    expect(result.ok).toBe(true);
    expect(result.draft.compositionManifest?.status).toBe("compiled");
  });

  it("detaches a replaced draft whose compiled manifest no longer describes its graph", () => {
    const compiled: LabDefinition = {
      ...demoLab,
      compositionManifest: {
        schemaVersion: 1,
        compilerContractVersion: "1.6",
        status: "compiled" as const,
        instances: [{
          instanceId: "measuring-volume",
          techniqueId: "measuring-volume",
          version: "1.2.0",
          repeatIndex: 0,
          evidenceOutputs: [],
          completion: { exitNodeIds: [], requiredEvidenceOutputIds: [], requiredValidationRuleIds: [] },
        }],
        origins: [{
          nodeId: "node-that-this-graph-does-not-have",
          techniqueId: "measuring-volume",
          techniqueVersion: "1.2.0",
          instanceId: "measuring-volume",
          sourceNodeId: "place-cylinder-node",
        }],
      },
    };
    const revision = createInitialStudioRevision();
    const result = planStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "replace-with-stale-manifest",
      label: "Import edited graph",
      operations: [{ type: "replaceDraft", draft: compiled }],
    });

    expect(result.ok).toBe(true);
    expect(result.draft.compositionManifest?.status).toBe("detached");
  });

  it("removes a process node and its incident paths as one reversible transaction snapshot", () => {
    const revision = createInitialStudioRevision();
    const node = demoLab.process.nodes[0];
    const outgoingTarget = demoLab.process.edges.find(
      (edge) => edge.from === node.id && edge.to !== node.id && edge.condition.type !== "retry",
    )?.to;
    const result = commitStudioTransaction(demoLab, revision, {
      baseRevision: revision,
      idempotencyKey: "remove-process-node",
      label: "Delete step",
      operations: [{ type: "removeProcessNode", nodeId: node.id }],
    });

    expect(result.ok).toBe(true);
    expect(result.draft.process.nodes.some((candidate) => candidate.id === node.id)).toBe(false);
    expect(result.draft.process.edges.some((edge) => edge.from === node.id || edge.to === node.id)).toBe(false);
    expect(result.draft.process.startNodeId).toBe(outgoingTarget ?? result.draft.process.nodes[0]?.id ?? "");
    if (node.actionId) {
      const remainsReferenced = result.draft.process.nodes.some(
        (candidate) =>
          candidate.actionId === node.actionId ||
          candidate.validation.some((rule) => rule.actionId === node.actionId),
      ) || result.draft.assessments.some((rule) => rule.actionId === node.actionId);
      expect(result.draft.actions.some((action) => action.id === node.actionId)).toBe(remainsReferenced);
    }
  });

  it("sanitizes export drafts through the authored JSON path", () => {
    const unsafe = {
      ...demoLab,
      actions: demoLab.actions.map((action, index) =>
        index === 0
          ? {
              ...action,
              parameters: {
                ...action.parameters,
                fileId: "file-provider-leak",
                assetPath: "E:/private/local.png",
              },
            }
          : action,
      ),
    } as typeof demoLab;

    const sanitized = sanitizeStudioExportDraft(unsafe);

    expect(JSON.stringify(sanitized)).not.toContain("file-provider-leak");
    expect(JSON.stringify(sanitized)).not.toContain("E:/private/local.png");
  });
});
