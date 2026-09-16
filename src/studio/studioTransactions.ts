import type {
  ActionDefinition,
  EquipmentInstance,
  LabDefinition,
  ProcessEdge,
  ProcessNode,
  RuntimeInvalidCase,
  TechniqueDefinition,
  ValidationRule,
} from "../domain/types";
import { validateLabDefinition } from "../domain/validation";
import { equipmentById } from "../equipment/catalog";
import { autoLayoutProcessMap } from "./autoLayoutProcessMap";
import { serializeLab } from "./importExport";
import { assessStudioReadiness, type StudioDiagnostic } from "./studioReadiness";
import {
  appendTechniqueToDraft,
  insertTemplateStepIntoDraft,
  studioTemplates,
  type InsertTemplateStepOptions,
} from "./studioState";

export type StudioOperation =
  | { type: "replaceDraft"; draft: LabDefinition }
  | { type: "updateLabSettings"; patch: Partial<Pick<LabDefinition, "title" | "description" | "audience" | "learningGoals" | "safetyNotes" | "equipment">> & { tags?: string[] } }
  | { type: "updateProcessNode"; node: ProcessNode }
  | { type: "removeProcessNode"; nodeId: string }
  | { type: "updateAction"; action: ActionDefinition }
  | { type: "updateProcessEdge"; index: number; edge: ProcessEdge }
  | { type: "setStartNode"; nodeId: string }
  | { type: "addRetryEdge"; nodeId: string }
  | { type: "addBranchEdge"; from: string; to: string }
  | { type: "autoLayoutProcess" }
  | { type: "appendTemplateStep"; templateId: string; options?: InsertTemplateStepOptions }
  | { type: "appendTechnique"; technique: TechniqueDefinition }
  | { type: "updateEquipmentList"; equipment: string[] }
  | { type: "addEquipment"; definitionId: string }
  | { type: "removeEquipment"; definitionId: string }
  | { type: "upsertInitialEquipment"; instance: EquipmentInstance }
  | { type: "removeInitialEquipment"; instanceId: string }
  | {
      type: "updateTechniqueSettings";
      patch: {
        learningGoal?: string;
        commonMistakes?: RuntimeInvalidCase[];
        resetBehavior?: TechniqueDefinition["resetBehavior"];
        tags?: string[];
      };
    }
  | { type: "renameTechnicalId"; from: string; to: string }
  | { type: "replaceNodeValidation"; nodeId: string; validation: ValidationRule[] };

export interface StudioTransaction {
  baseRevision: string;
  idempotencyKey: string;
  label: string;
  operations: StudioOperation[];
}

export interface StudioTransactionResult {
  ok: boolean;
  draft: LabDefinition;
  revision: string;
  diagnostics: StudioDiagnostic[];
  idempotent?: boolean;
  focus?: {
    nodeId?: string;
    actionId?: string;
    section?: string;
  };
  error?: string;
}

export interface StudioIdAllocator {
  next: (prefix: string) => string;
  statePath: (label: string) => string;
}

export const createInitialStudioRevision = (): string =>
  `studio-rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createStudioIdAllocator = (draft: LabDefinition): StudioIdAllocator => {
  const used = new Set<string>([
    draft.id,
    ...draft.actions.map((action) => action.id),
    ...draft.process.nodes.map((node) => node.id),
    ...draft.assessments.map((rule) => rule.id),
    ...(draft.initialState?.equipment.map((instance) => instance.id) ?? []),
    ...draft.techniques.flatMap((technique) => [
      technique.id,
      ...technique.actions.map((action) => action.id),
      ...technique.process.nodes.map((node) => node.id),
      ...technique.successCriteria.map((rule) => rule.id),
      ...technique.initialState.equipment.map((instance) => instance.id),
    ]),
  ]);

  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";

  const next = (prefix: string): string => {
    const base = normalize(prefix);
    let index = 1;
    let candidate = base;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${base}-${index}`;
    }
    used.add(candidate);
    return candidate;
  };

  return {
    next,
    statePath: (label: string) => `state.${next(label).replace(/-/g, ".")}`,
  };
};

const nextRevision = (currentRevision: string): string =>
  `${currentRevision.split(":")[0]}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

const unique = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireText = (value: unknown, field: string): string => {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  throw new Error(`${field} is required.`);
};

const requireRecord = <T>(value: T, field: string): T => {
  if (isRecord(value)) return value;
  throw new Error(`${field} must be an object.`);
};

const requireArray = <T>(value: T, field: string): T => {
  if (Array.isArray(value)) return value;
  throw new Error(`${field} must be an array.`);
};

/**
 * A compiled composition is a snapshot of the action/process graph.  Studio edits must not leave
 * that snapshot advertising itself as current: the source remains portable and playable, but the
 * composed provenance is detached until the author runs the compiler again.  This marker is kept
 * deliberately small and public-safe; it never records local paths, hashes, or runtime state.
 */
export const markCompositionDetached = (draft: LabDefinition): LabDefinition => {
  if (!draft.compositionManifest || draft.compositionManifest.status === "detached") return draft;
  return {
    ...draft,
    compositionManifest: {
      ...draft.compositionManifest,
      status: "detached",
    },
  };
};

/**
 * A compiled manifest describes a specific set of process nodes.  Once it names a node the draft
 * no longer has, or omits one the draft grew, the manifest is a description of some earlier graph
 * and cannot claim to be current — so a wholesale draft replacement that arrives in that state is
 * detached too.  Without this, `replaceDraft` was the one authoring path that could carry a
 * "compiled" badge onto a graph it never described.
 */
const compositionManifestDescribesGraph = (draft: LabDefinition): boolean => {
  const manifest = draft.compositionManifest;
  if (!manifest || manifest.status !== "compiled") return true;
  const nodeIds = new Set(draft.process.nodes.map((node) => node.id));
  if (manifest.origins.some((origin) => !nodeIds.has(origin.nodeId))) return false;
  const originInstanceIds = new Set(manifest.origins.map((origin) => origin.instanceId));
  return manifest.instances.every((instance) => originInstanceIds.has(instance.instanceId));
};

const compositionMutatingOperations = new Set<StudioOperation["type"]>([
  "updateProcessNode",
  "removeProcessNode",
  "updateAction",
  "updateProcessEdge",
  "setStartNode",
  "addRetryEdge",
  "addBranchEdge",
  "autoLayoutProcess",
  "appendTemplateStep",
  "appendTechnique",
  "updateEquipmentList",
  "addEquipment",
  "removeEquipment",
  "upsertInitialEquipment",
  "removeInitialEquipment",
  "updateTechniqueSettings",
  "renameTechnicalId",
  "replaceNodeValidation",
]);

const ensureNodeExists = (draft: LabDefinition, nodeId: unknown, field = "nodeId"): string => {
  const id = requireText(nodeId, field);
  if (!draft.process.nodes.some((node) => node.id === id)) {
    throw new Error(`Process node not found: ${id}.`);
  }
  return id;
};

const ensureActionExists = (draft: LabDefinition, actionId: unknown, field = "actionId"): string => {
  const id = requireText(actionId, field);
  if (!draft.actions.some((action) => action.id === id)) {
    throw new Error(`Action not found: ${id}.`);
  }
  return id;
};

const ensureEquipmentDefinitionExists = (definitionId: unknown, field = "definitionId"): string => {
  const id = requireText(definitionId, field);
  if (!equipmentById.has(id)) {
    throw new Error(`Equipment definition not found: ${id}.`);
  }
  return id;
};

const ensureEdgeIndex = (draft: LabDefinition, index: unknown): number => {
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= draft.process.edges.length) {
    throw new Error(`Connection index is out of range: ${String(index)}.`);
  }
  return index as number;
};

const collectTechnicalIds = (draft: LabDefinition): Set<string> =>
  new Set([
    draft.id,
    ...draft.actions.map((action) => action.id),
    ...draft.process.nodes.map((node) => node.id),
    ...draft.assessments.map((rule) => rule.id),
    ...(draft.initialState?.equipment.map((instance) => instance.id) ?? []),
    ...draft.techniques.flatMap((technique) => [
      technique.id,
      ...technique.actions.map((action) => action.id),
      ...technique.process.nodes.map((node) => node.id),
      ...technique.successCriteria.map((rule) => rule.id),
      ...technique.initialState.equipment.map((instance) => instance.id),
    ]),
  ]);

const firstTechniqueForDraft = (draft: LabDefinition): TechniqueDefinition => {
  const existing = draft.techniques[0];
  return {
    id: existing?.id ?? draft.id,
    title: draft.title || existing?.title || "Untitled technique",
    learningGoal: existing?.learningGoal ?? draft.learningGoals[0] ?? draft.description ?? "Practice this technique.",
    requiredEquipment: [...draft.equipment],
    titrationModels: draft.titrationModels ?? existing?.titrationModels,
    chromatographyModels: draft.chromatographyModels ?? existing?.chromatographyModels,
    kineticsModels: draft.kineticsModels ?? existing?.kineticsModels,
    initialState: { equipment: draft.initialState?.equipment ?? [] },
    actions: draft.actions,
    process: draft.process,
    successCriteria: draft.assessments,
    commonMistakes: existing?.commonMistakes ?? [],
    resetBehavior: existing?.resetBehavior ?? "resetTechnique",
    metadata: {
      ...(existing?.metadata ?? draft.metadata),
      tags: existing?.metadata.tags ?? draft.metadata.tags,
    },
  };
};

const withTechniqueSettings = (
  draft: LabDefinition,
  patch: Extract<StudioOperation, { type: "updateTechniqueSettings" }>["patch"],
): LabDefinition => {
  const technique = firstTechniqueForDraft(draft);
  const nextTechnique: TechniqueDefinition = {
    ...technique,
    learningGoal: patch.learningGoal ?? technique.learningGoal,
    commonMistakes: patch.commonMistakes ?? technique.commonMistakes,
    resetBehavior: patch.resetBehavior ?? technique.resetBehavior,
    metadata: {
      ...technique.metadata,
      tags: patch.tags ?? technique.metadata.tags,
      updatedAt: new Date().toISOString(),
    },
  };
  return {
    ...draft,
    description: patch.learningGoal ?? draft.description,
    learningGoals: patch.learningGoal !== undefined ? [patch.learningGoal].filter(Boolean) : draft.learningGoals,
    metadata: {
      ...draft.metadata,
      tags: patch.tags ?? draft.metadata.tags,
      updatedAt: new Date().toISOString(),
    },
    techniques: [nextTechnique, ...draft.techniques.slice(1)],
  };
};

const updateReferences = (value: unknown, from: string, to: string): unknown => {
  if (Array.isArray(value)) return value.map((item) => updateReferences(item, from, to));
  if (!value || typeof value !== "object") return value === from ? to : value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, updateReferences(child, from, to)]),
  );
};

const applyOperation = (draft: LabDefinition, operation: StudioOperation): LabDefinition => {
  switch (operation.type) {
    case "replaceDraft": {
      requireRecord(operation.draft, "draft");
      return operation.draft;
    }
    case "updateLabSettings": {
      requireRecord(operation.patch, "patch");
      const { tags, ...patch } = operation.patch;
      return {
        ...draft,
        ...patch,
        metadata: {
          ...draft.metadata,
          tags: tags ?? draft.metadata.tags,
          updatedAt: new Date().toISOString(),
        },
      };
    }
    case "updateProcessNode": {
      requireRecord(operation.node, "node");
      ensureNodeExists(draft, operation.node.id, "node.id");
      return {
        ...draft,
        process: {
          ...draft.process,
          nodes: draft.process.nodes.map((node) => node.id === operation.node.id ? operation.node : node),
        },
      };
    }
    case "removeProcessNode": {
      const nodeId = ensureNodeExists(draft, operation.nodeId);
      const removedNode = draft.process.nodes.find((node) => node.id === nodeId)!;
      const remainingNodes = draft.process.nodes.filter((node) => node.id !== nodeId);
      const remainingEdges = draft.process.edges.filter(
        (edge) => edge.from !== nodeId && edge.to !== nodeId,
      );
      const survivingOutgoingTarget = draft.process.edges.find(
        (edge) =>
          edge.from === nodeId &&
          edge.to !== nodeId &&
          edge.condition.type !== "retry" &&
          remainingNodes.some((node) => node.id === edge.to),
      )?.to;
      const nextStartNodeId =
        draft.process.startNodeId === nodeId
          ? survivingOutgoingTarget ?? remainingNodes[0]?.id ?? ""
          : draft.process.startNodeId;
      const actionStillReferenced = removedNode.actionId
        ? remainingNodes.some(
            (node) =>
              node.actionId === removedNode.actionId ||
              node.validation.some((rule) => rule.actionId === removedNode.actionId),
          ) ||
          draft.assessments.some((rule) => rule.actionId === removedNode.actionId) ||
          draft.actions.some(
            (action) =>
              action.id !== removedNode.actionId &&
              action.prerequisites.some((rule) => rule.actionId === removedNode.actionId),
          )
        : true;

      return {
        ...draft,
        actions:
          removedNode.actionId && !actionStillReferenced
            ? draft.actions.filter((action) => action.id !== removedNode.actionId)
            : draft.actions,
        process: {
          ...draft.process,
          startNodeId: nextStartNodeId,
          nodes: remainingNodes,
          edges: remainingEdges,
        },
      };
    }
    case "updateAction": {
      requireRecord(operation.action, "action");
      ensureActionExists(draft, operation.action.id, "action.id");
      return {
        ...draft,
        actions: draft.actions.map((action) => action.id === operation.action.id ? operation.action : action),
      };
    }
    case "updateProcessEdge": {
      const index = ensureEdgeIndex(draft, operation.index);
      requireRecord(operation.edge, "edge");
      return {
        ...draft,
        process: {
          ...draft.process,
          edges: draft.process.edges.map((edge, edgeIndex) => edgeIndex === index ? operation.edge : edge),
        },
      };
    }
    case "setStartNode": {
      if (operation.nodeId) ensureNodeExists(draft, operation.nodeId);
      return {
        ...draft,
        process: {
          ...draft.process,
          startNodeId: operation.nodeId,
        },
      };
    }
    case "addRetryEdge": {
      const nodeId = ensureNodeExists(draft, operation.nodeId);
      return {
        ...draft,
        process: {
          ...draft.process,
          edges: [
            ...draft.process.edges,
            {
              from: nodeId,
              to: nodeId,
              label: "Retry",
              condition: { type: "retry" },
            },
          ],
        },
      };
    }
    case "addBranchEdge": {
      const from = ensureNodeExists(draft, operation.from, "from");
      const to = ensureNodeExists(draft, operation.to, "to");
      return {
        ...draft,
        process: {
          ...draft.process,
          edges: [
            ...draft.process.edges,
            {
              from,
              to,
              label: "Branch",
              condition: { type: "always" },
            },
          ],
        },
      };
    }
    case "autoLayoutProcess":
      return {
        ...draft,
        process: {
          ...draft.process,
          nodes: autoLayoutProcessMap(draft.process.nodes),
        },
      };
    case "appendTemplateStep": {
      const templateId = requireText(operation.templateId, "templateId");
      const template = studioTemplates.find((candidate) => candidate.id === templateId);
      if (!template) throw new Error(`Template not found: ${templateId}`);
      return insertTemplateStepIntoDraft(draft, template, operation.options).lab;
    }
    case "appendTechnique": {
      requireRecord(operation.technique, "technique");
      return appendTechniqueToDraft(draft, operation.technique).lab;
    }
    case "updateEquipmentList": {
      requireArray(operation.equipment, "equipment");
      operation.equipment.forEach((definitionId) => ensureEquipmentDefinitionExists(definitionId, "equipment"));
      return { ...draft, equipment: unique(operation.equipment) };
    }
    case "addEquipment": {
      const definitionId = ensureEquipmentDefinitionExists(operation.definitionId);
      return { ...draft, equipment: unique([...draft.equipment, definitionId]) };
    }
    case "removeEquipment": {
      const definitionId = requireText(operation.definitionId, "definitionId");
      if (!draft.equipment.includes(definitionId)) {
        throw new Error(`Required equipment not found: ${definitionId}.`);
      }
      return {
        ...draft,
        equipment: draft.equipment.filter((currentDefinitionId) => currentDefinitionId !== definitionId),
        initialState: {
          equipment: (draft.initialState?.equipment ?? []).filter(
            (instance) => instance.definitionId !== definitionId,
          ),
        },
      };
    }
    case "upsertInitialEquipment": {
      requireRecord(operation.instance, "instance");
      ensureEquipmentDefinitionExists(operation.instance.definitionId, "instance.definitionId");
      const current = draft.initialState?.equipment ?? [];
      const exists = current.some((instance) => instance.id === operation.instance.id);
      return {
        ...draft,
        equipment: unique([...draft.equipment, operation.instance.definitionId]),
        initialState: {
          equipment: exists
            ? current.map((instance) => instance.id === operation.instance.id ? operation.instance : instance)
            : [...current, operation.instance],
        },
      };
    }
    case "removeInitialEquipment": {
      const instanceId = requireText(operation.instanceId, "instanceId");
      if (!(draft.initialState?.equipment ?? []).some((instance) => instance.id === instanceId)) {
        throw new Error(`Starting equipment not found: ${instanceId}.`);
      }
      return {
        ...draft,
        initialState: {
          equipment: (draft.initialState?.equipment ?? []).filter(
            (instance) => instance.id !== instanceId,
          ),
        },
      };
    }
    case "updateTechniqueSettings": {
      requireRecord(operation.patch, "patch");
      return withTechniqueSettings(draft, operation.patch);
    }
    case "renameTechnicalId": {
      const from = requireText(operation.from, "from");
      const to = requireText(operation.to, "to");
      if (from === to) throw new Error("Rename target must be different from the current ID.");
      const ids = collectTechnicalIds(draft);
      if (!ids.has(from)) throw new Error(`Technical ID not found: ${from}.`);
      if (ids.has(to)) throw new Error(`Technical ID already exists: ${to}.`);
      return updateReferences(draft, from, to) as LabDefinition;
    }
    case "replaceNodeValidation": {
      const nodeId = ensureNodeExists(draft, operation.nodeId);
      requireArray(operation.validation, "validation");
      return {
        ...draft,
        process: {
          ...draft.process,
          nodes: draft.process.nodes.map((node) =>
            node.id === nodeId ? { ...node, validation: operation.validation } : node,
          ),
        },
      };
    }
    default:
      throw new Error(`Unsupported Studio operation: ${String((operation as { type?: unknown }).type)}.`);
  }
};

const applyOperationWithProvenance = (
  draft: LabDefinition,
  operation: StudioOperation,
): LabDefinition => {
  const next = applyOperation(draft, operation);
  const updatesCompositionEquipment = operation.type === "updateLabSettings" &&
    operation.patch.equipment !== undefined;
  if (compositionMutatingOperations.has(operation.type) || updatesCompositionEquipment) {
    return markCompositionDetached(next);
  }
  // `replaceDraft` legitimately carries a compiled manifest in — that is how a compiled lab is
  // opened for authoring — so it is detached only when the incoming manifest no longer describes
  // the incoming graph.
  if (operation.type === "replaceDraft" && !compositionManifestDescribesGraph(next)) {
    return markCompositionDetached(next);
  }
  return next;
};

const transactionDiagnostics = (draft: LabDefinition): StudioDiagnostic[] => {
  const validation = validateLabDefinition(draft);
  const diagnostics = assessStudioReadiness(draft).diagnostics;
  return validation.ok
    ? diagnostics
    : diagnostics.length
      ? diagnostics
      : validation.errors.map((message, index) => ({
          id: `schema-${index}`,
          message,
          category: "draftStructure",
          severity: "fail",
          anchor: { section: "details" },
        }));
};

export const planStudioTransaction = (
  currentDraft: LabDefinition,
  currentRevision: string,
  transaction: StudioTransaction,
): StudioTransactionResult => {
  if (transaction.baseRevision !== currentRevision) {
    return {
      ok: false,
      draft: currentDraft,
      revision: currentRevision,
      diagnostics: [],
      error: `Stale transaction revision ${transaction.baseRevision}; current revision is ${currentRevision}.`,
    };
  }

  try {
    const draft = transaction.operations.reduce(applyOperationWithProvenance, currentDraft);
    return {
      ok: true,
      draft,
      revision: currentRevision,
      diagnostics: transactionDiagnostics(draft),
    };
  } catch (error) {
    return {
      ok: false,
      draft: currentDraft,
      revision: currentRevision,
      diagnostics: [],
      error: error instanceof Error ? error.message : "Unable to apply Studio transaction.",
    };
  }
};

export const commitStudioTransaction = (
  currentDraft: LabDefinition,
  currentRevision: string,
  transaction: StudioTransaction,
  committedIdempotencyKeys?: Set<string>,
): StudioTransactionResult => {
  if (committedIdempotencyKeys?.has(transaction.idempotencyKey)) {
    return {
      ok: true,
      draft: currentDraft,
      revision: currentRevision,
      diagnostics: transactionDiagnostics(currentDraft),
      idempotent: true,
    };
  }

  const result = planStudioTransaction(currentDraft, currentRevision, transaction);
  if (!result.ok) return result;
  committedIdempotencyKeys?.add(transaction.idempotencyKey);
  return {
    ...result,
    revision: nextRevision(currentRevision),
  };
};

export const sanitizeStudioExportDraft = (draft: LabDefinition): LabDefinition =>
  JSON.parse(serializeLab(draft)) as LabDefinition;
