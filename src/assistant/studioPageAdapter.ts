import { downloadJson } from "../studio/importExport";
import { saveDraft } from "../studio/persistence";
import { serializeStudioArtifact, type StudioArtifactKind } from "../studio/studioArtifact";
import { assessStudioReadiness } from "../studio/studioReadiness";
import { runStudioPreviewCheck } from "../studio/studioPreviewCheck";
import { stepBlueprints } from "../studio/stepBlueprints";
import {
  planStudioTransaction,
  type StudioOperation,
  type StudioTransaction,
  type StudioTransactionResult,
} from "../studio/studioTransactions";
import { collectStudioInteractionIssues } from "../studio/studioValidation";
import { studioTemplates, type StudioTemplate } from "../studio/studioState";
import { validateLabDefinition } from "../domain/validation";
import { v1EquipmentCatalog } from "../equipment/catalog";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  ActionInteractionType,
  ActionParameterValue,
  LabDefinition,
  ProcessNode,
  ProcessNodeType,
  ValidationType,
} from "../domain/types";
import { validateToolCall } from "./actionCatalog";
import { postAssistantImage } from "./client";
import type {
  AssistantToolCall,
  AssistantToolResult,
  StudioAssistantAdapter,
  StudioAssistantContext,
  StudioDraftUpdater,
} from "./types";

type ParameterPatch = {
  key: string;
  valueType: "string" | "number" | "boolean" | "stringArray" | "unset";
  stringValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  stringArrayValue: string[] | null;
};

interface CreateStudioAssistantAdapterOptions {
  draft: LabDefinition;
  revision: string;
  artifactKind?: StudioArtifactKind;
  selectedNodeId: string;
  focusNodeInPreview: (nodeId: string) => void;
  setDraft: StudioDraftUpdater;
  applyTemplate: (template: StudioTemplate) => Promise<void>;
  commitTransaction?: (transaction: StudioTransaction) => StudioTransactionResult;
  undoDraft?: () => void;
  setStatusMessage: (message: string) => void;
}

const processNodeTypes = new Set<ProcessNodeType>([
  "technique",
  "action",
  "checkpoint",
  "decision",
  "calculation",
  "observation",
  "teacherNote",
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const nullableString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const nullableStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.filter((item) => item.trim().length > 0)
    : undefined;

const parameterValueFromPatch = (patch: ParameterPatch): ActionParameterValue => {
  if (patch.valueType === "string") return patch.stringValue ?? "";
  if (patch.valueType === "number") return patch.numberValue ?? 0;
  if (patch.valueType === "boolean") return patch.booleanValue ?? false;
  if (patch.valueType === "stringArray") return patch.stringArrayValue ?? [];
  return undefined;
};

const applyParameterPatches = (
  current: ActionDefinition["parameters"],
  patches: unknown,
): ActionDefinition["parameters"] => {
  if (!Array.isArray(patches)) return current;
  const next = { ...current };
  patches.forEach((entry) => {
    if (!isObject(entry)) return;
    const key = nonEmptyString(entry.key);
    if (!key) return;
    const patch = entry as ParameterPatch;
    const value = parameterValueFromPatch(patch);
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  });
  return next;
};

const selectedActionForDraft = (
  draft: LabDefinition,
  selectedNodeId: string,
): ActionDefinition | undefined => {
  const selectedNode = draft.process.nodes.find((node) => node.id === selectedNodeId);
  return selectedNode?.actionId
    ? draft.actions.find((action) => action.id === selectedNode.actionId)
    : undefined;
};

const actionByArgOrSelection = (
  draft: LabDefinition,
  selectedNodeId: string,
  actionId: unknown,
): ActionDefinition | undefined => {
  const requestedId = nullableString(actionId);
  if (requestedId) return draft.actions.find((action) => action.id === requestedId);
  return selectedActionForDraft(draft, selectedNodeId);
};

const makeContext = (
  draft: LabDefinition,
  selectedNodeId: string,
  revision: string,
  artifactKind: StudioArtifactKind,
): StudioAssistantContext => {
  const selectedNode = draft.process.nodes.find((node) => node.id === selectedNodeId);
  const selectedAction = selectedActionForDraft(draft, selectedNodeId);
  const validation = validateLabDefinition(draft);
  const warnings = collectStudioInteractionIssues(draft).map((issue) => issue.message);
  return {
    draft: {
      id: draft.id,
      revision,
      artifactKind,
      title: draft.title,
      description: draft.description,
      audience: draft.audience,
      learningGoals: draft.learningGoals,
      safetyNotes: draft.safetyNotes,
      equipment: draft.equipment,
      tags: draft.metadata.tags,
      nodeCount: draft.process.nodes.length,
      actionCount: draft.actions.length,
      startNodeId: draft.process.startNodeId,
      selectedNodeId,
    },
    selectedNode: selectedNode
      ? {
          id: selectedNode.id,
          type: selectedNode.type,
          title: selectedNode.title,
          description: selectedNode.description,
          actionId: selectedNode.actionId,
          hints: selectedNode.hints,
        }
      : undefined,
    selectedAction: selectedAction
      ? {
          id: selectedAction.id,
          verb: selectedAction.verb,
          label: selectedAction.label,
          parameters: { ...selectedAction.parameters } as Record<string, unknown>,
          interaction: selectedAction.interaction ? { ...selectedAction.interaction } : undefined,
        }
      : undefined,
    validation: {
      ok: validation.ok,
      errors: validation.errors,
      warnings,
    },
    templates: studioTemplates.map((template) => ({
      id: template.id,
      title: template.title,
      description: template.description,
      requiredEquipment: template.requiredEquipment,
      replacesDraft: Boolean(template.labId),
      appendsWorkflow: Boolean(template.techniqueId),
    })),
    processNodes: draft.process.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      actionId: node.actionId,
    })),
  };
};

const pending = (message: string, data?: unknown): AssistantToolResult => ({
  status: "pending_confirmation",
  message,
  data,
});

const ok = (message: string, data?: unknown): AssistantToolResult => ({
  status: "ok",
  message,
  data,
});

const error = (message: string, data?: unknown): AssistantToolResult => ({
  status: "error",
  message,
  data,
});

const validationTypes: ValidationType[] = [
  "actionEvidence",
  "measurementRecorded",
  "notebookEntry",
  "calculationWithinTolerance",
  "statePath",
  "processCompleted",
];

const transactionFromArgs = (args: Record<string, unknown>): StudioTransaction | undefined => {
  const baseRevision = nonEmptyString(args.baseRevision);
  const idempotencyKey = nonEmptyString(args.idempotencyKey);
  const label = nonEmptyString(args.label);
  const operations = Array.isArray(args.operations) ? args.operations : undefined;
  if (!baseRevision || !idempotencyKey || !label || !operations) return undefined;
  return {
    baseRevision,
    idempotencyKey,
    label,
    operations: operations as StudioOperation[],
  };
};

const firstFocusTarget = (diagnostics: ReturnType<typeof assessStudioReadiness>["diagnostics"]) =>
  diagnostics.find((diagnostic) => diagnostic.anchor)?.anchor;

const transactionResultData = (result: StudioTransactionResult) => ({
  ok: result.ok,
  revision: result.revision,
  diagnostics: result.diagnostics,
  idempotent: result.idempotent,
  focus: result.focus ?? firstFocusTarget(result.diagnostics),
  draft: {
    id: result.draft.id,
    title: result.draft.title,
    nodeCount: result.draft.process.nodes.length,
    actionCount: result.draft.actions.length,
    equipmentCount: result.draft.equipment.length,
    startNodeId: result.draft.process.startNodeId,
  },
  error: result.error,
});

export const createStudioAssistantAdapter = ({
  artifactKind = "lab",
  applyTemplate,
  commitTransaction,
  draft,
  focusNodeInPreview,
  revision,
  selectedNodeId,
  setDraft,
  setStatusMessage,
  undoDraft,
}: CreateStudioAssistantAdapterOptions): StudioAssistantAdapter => {
  const executeTool = async (
    call: AssistantToolCall,
    options: { confirmed?: boolean } = {},
  ): Promise<AssistantToolResult> => {
    const validation = validateToolCall(call, "studio");
    if (!validation.ok) return error(validation.error);
    const args = call.arguments;

    if (validation.action.safety === "guarded" && !options.confirmed) {
      return pending(`${validation.action.confirmationLabel ?? call.name} is waiting for confirmation.`, {
        tool: call.name,
        arguments: args,
      });
    }

    const commitLegacyOperations = (label: string, operations: StudioOperation[]): AssistantToolResult => {
      if (!commitTransaction) return error("This Studio page cannot commit transactions yet.");
      const result = commitTransaction({
        baseRevision: revision,
        idempotencyKey: `${call.callId}:${call.name}`,
        label,
        operations,
      });
      return result.ok
        ? ok(label, transactionResultData(result))
        : error(result.error ?? `Unable to ${label.toLowerCase()}.`, transactionResultData(result));
    };

    if (call.name === "studio_get_snapshot") {
      const readiness = assessStudioReadiness(draft);
      return ok("Studio snapshot captured.", {
        revision,
        artifactKind,
        selectedNodeId,
        readiness,
        draft: {
          id: draft.id,
          title: draft.title,
          description: draft.description,
          audience: draft.audience,
          learningGoals: draft.learningGoals,
          safetyNotes: draft.safetyNotes,
          equipment: draft.equipment,
          initialState: draft.initialState,
          actions: draft.actions,
          process: draft.process,
          assessments: draft.assessments,
          metadata: draft.metadata,
        },
      });
    }

    if (call.name === "studio_query_catalog") {
      const query = nullableString(args.query)?.toLowerCase();
      const requestedKind = nullableString(args.kind);
      const equipment = v1EquipmentCatalog
        .filter((item) => !query || `${item.id} ${item.label} ${item.category}`.toLowerCase().includes(query))
        .map((item) => ({
          id: item.id,
          label: item.label,
          category: item.category,
          affordances: item.affordances,
          capacity: item.capacity,
          precision: item.precision,
          snapZones: item.snapZones.map((zone) => ({
            id: zone.id,
            label: zone.label,
            accepts: zone.accepts,
          })),
        }));
      const blueprints = stepBlueprints
        .filter((blueprint) => !query || `${blueprint.id} ${blueprint.label} ${blueprint.verb}`.toLowerCase().includes(query))
        .map((blueprint) => ({
          id: blueprint.id,
          label: blueprint.label,
          nodeType: blueprint.nodeType,
          verb: blueprint.verb,
          fields: blueprint.fields,
        }));
      return ok("Studio catalog queried.", {
        revision,
        equipment: !requestedKind || requestedKind === "equipment" ? equipment : [],
        stepBlueprints: !requestedKind || requestedKind === "blueprints" ? blueprints : [],
        validationTypes: !requestedKind || requestedKind === "validation" ? validationTypes : [],
        compatibilityRules: {
          equipmentFieldKinds: ["equipment", "statePath"],
          blueprintVerbs: Array.from(new Set(stepBlueprints.map((blueprint) => blueprint.verb))),
        },
      });
    }

    if (call.name === "studio_plan_transaction") {
      const transaction = transactionFromArgs(args);
      if (!transaction) return error("Transaction requires baseRevision, idempotencyKey, label, and operations.");
      const result = planStudioTransaction(draft, revision, transaction);
      return result.ok
        ? ok(`Planned transaction: ${transaction.label}.`, transactionResultData(result))
        : error(result.error ?? "Unable to plan Studio transaction.", transactionResultData(result));
    }

    if (call.name === "studio_commit_transaction") {
      const transaction = transactionFromArgs(args);
      if (!transaction) return error("Transaction requires baseRevision, idempotencyKey, label, and operations.");
      if (!commitTransaction) return error("This Studio page cannot commit transactions yet.");
      const result = commitTransaction(transaction);
      return result.ok
        ? ok(`Committed transaction: ${transaction.label}.`, transactionResultData(result))
        : error(result.error ?? "Unable to commit Studio transaction.", transactionResultData(result));
    }

    if (call.name === "studio_validate") {
      const draftValidation = validateLabDefinition(draft);
      const readiness = assessStudioReadiness(draft);
      const warnings = collectStudioInteractionIssues(draft);
      return ok(
        draftValidation.ok && !readiness.diagnostics.some((diagnostic) => diagnostic.severity === "fail")
          ? "Studio draft passed validation."
          : "Studio draft needs review.",
        {
          revision,
          schema: draftValidation,
          readiness,
          interactionWarnings: warnings,
          suggestedFocusTarget: firstFocusTarget(readiness.diagnostics),
        },
      );
    }

    if (call.name === "studio_run_preview_check") {
      const previewCheck = runStudioPreviewCheck(draft, selectedNodeId);
      return ok(previewCheck.runnable ? "Student preview can run this draft." : "Student preview is blocked.", {
        revision,
        runnable: previewCheck.runnable,
        startNodeId: previewCheck.startNodeId,
        selectedNodeId,
        selectedStepTitle: previewCheck.selectedStepTitle,
        readiness: previewCheck.readiness,
        errors: previewCheck.errors,
        suggestedFocusTarget: firstFocusTarget(previewCheck.readiness.diagnostics),
      });
    }

    if (call.name === "studio_undo") {
      if (!undoDraft) return error("This Studio page cannot undo assistant transactions yet.");
      undoDraft();
      return ok("Undid the last Studio change.");
    }

    if (call.name === "validate_draft") {
      const draftValidation = validateLabDefinition(draft);
      const warnings = collectStudioInteractionIssues(draft);
      return ok(
        draftValidation.ok
          ? warnings.length
            ? `Draft is valid with ${warnings.length} interaction warning(s).`
            : "Draft is valid."
          : `Draft has ${draftValidation.errors.length} validation error(s).`,
        { errors: draftValidation.errors, warnings: warnings.map((issue) => issue.message) },
      );
    }

    if (call.name === "select_node") {
      const nodeId = nonEmptyString(args.nodeId);
      if (!nodeId || !draft.process.nodes.some((node) => node.id === nodeId)) {
        return error(`Process node not found: ${String(args.nodeId)}`);
      }
      focusNodeInPreview(nodeId);
      return ok(`Selected ${nodeId}.`);
    }

    if (call.name === "add_template_node") {
      const template = studioTemplates.find((candidate) => candidate.id === args.templateId);
      if (!template) return error(`Template not found: ${String(args.templateId)}`);
      if (template.labId) {
        return error(`${template.title} replaces the full draft. Use load_full_lab_template.`);
      }
      await applyTemplate(template);
      return ok(`Added ${template.title} template node.`);
    }

    if (call.name === "update_lab_settings") {
      const patch: Extract<StudioOperation, { type: "updateLabSettings" }>["patch"] = {};
      const title = nullableString(args.title);
      const description = nullableString(args.description);
      const audience = nullableString(args.audience);
      const learningGoals = nullableStringArray(args.learningGoals);
      const safetyNotes = nullableStringArray(args.safetyNotes);
      const equipment = nullableStringArray(args.equipment);
      const tags = nullableStringArray(args.tags);
      if (title !== undefined) patch.title = title;
      if (description !== undefined) patch.description = description;
      if (audience !== undefined) patch.audience = audience;
      if (learningGoals !== undefined) patch.learningGoals = learningGoals;
      if (safetyNotes !== undefined) patch.safetyNotes = safetyNotes;
      if (equipment !== undefined) patch.equipment = equipment;
      if (tags !== undefined) patch.tags = tags;
      return commitLegacyOperations("Update lab settings", [{ type: "updateLabSettings", patch }]);
    }

    if (call.name === "update_selected_node") {
      const nextType = nullableString(args.type);
      if (nextType && !processNodeTypes.has(nextType as ProcessNodeType)) {
        return error(`Unsupported process node type: ${nextType}`);
      }
      const selectedNode = draft.process.nodes.find((node) => node.id === selectedNodeId);
      if (!selectedNode) return error("No selected process node was found.");
      const hint = nullableString(args.hint);
      const node: ProcessNode = {
        ...selectedNode,
        title: nullableString(args.title) ?? selectedNode.title,
        description: nullableString(args.description) ?? selectedNode.description,
        type: (nextType as ProcessNodeType | undefined) ?? selectedNode.type,
        hints: hint !== undefined ? [hint].filter(Boolean) : selectedNode.hints,
        feedback: {
          success: nullableString(args.successFeedback) ?? selectedNode.feedback.success,
          retry: nullableString(args.retryFeedback) ?? selectedNode.feedback.retry,
        },
      };
      return commitLegacyOperations("Update selected process node", [{ type: "updateProcessNode", node }]);
    }

    if (call.name === "update_action_fields") {
      const action = actionByArgOrSelection(draft, selectedNodeId, args.actionId);
      if (!action) return error("No selected action was found.");
      const updatedAction: ActionDefinition = {
        ...action,
        label: nullableString(args.label) ?? action.label,
        parameters: applyParameterPatches(action.parameters, args.parameters),
        feedback: {
          success: nullableString(args.successFeedback) ?? action.feedback.success,
          invalid: nullableString(args.invalidFeedback) ?? action.feedback.invalid,
        },
        stateChanges: nullableStringArray(args.stateChanges) ?? action.stateChanges,
        evidence: nullableStringArray(args.evidence) ?? action.evidence,
      };
      return commitLegacyOperations(`Update action ${action.id}`, [{ type: "updateAction", action: updatedAction }]);
    }

    if (call.name === "update_interaction_fields") {
      const action = actionByArgOrSelection(draft, selectedNodeId, args.actionId);
      if (!action) return error("No selected action was found.");
      const interaction: ActionInteractionSpec = {
        type: (nullableString(args.type) as ActionInteractionType | undefined) ??
          action.interaction?.type ??
          "dragToZone",
        accessibleLabel:
          nullableString(args.accessibleLabel) ??
          action.interaction?.accessibleLabel ??
          action.label,
        sourceDefinitionId:
          nullableString(args.sourceDefinitionId) ?? action.interaction?.sourceDefinitionId,
        targetDefinitionId:
          nullableString(args.targetDefinitionId) ?? action.interaction?.targetDefinitionId,
        stationId: nullableString(args.stationId) ?? action.interaction?.stationId,
        snapZoneId: nullableString(args.snapZoneId) ?? action.interaction?.snapZoneId,
        valueParameter:
          nullableString(args.valueParameter) ?? action.interaction?.valueParameter,
        successCue: nullableString(args.successCue) ?? action.interaction?.successCue,
        invalidCue: nullableString(args.invalidCue) ?? action.interaction?.invalidCue,
      };
      return commitLegacyOperations(`Update interaction for ${action.id}`, [
        { type: "updateAction", action: { ...action, interaction } },
      ]);
    }

    if (call.name === "add_retry_edge") {
      const nodeId = nullableString(args.nodeId) ?? selectedNodeId;
      if (!draft.process.nodes.some((node) => node.id === nodeId)) {
        return error(`Process node not found: ${nodeId}`);
      }
      return commitLegacyOperations(`Add retry edge for ${nodeId}`, [{ type: "addRetryEdge", nodeId }]);
    }

    if (call.name === "auto_layout_process") {
      return commitLegacyOperations("Auto layout process", [{ type: "autoLayoutProcess" }]);
    }

    if (call.name === "load_full_lab_template") {
      const template = studioTemplates.find((candidate) => candidate.id === args.templateId);
      if (!template) return error(`Template not found: ${String(args.templateId)}`);
      if (!template.labId) return error(`${template.title} is not a full lab template.`);
      await applyTemplate(template);
      return ok(`Loaded ${template.title} full lab template.`);
    }

    if (call.name === "save_local_draft") {
      saveDraft(draft, artifactKind);
      setStatusMessage("Draft saved by assistant.");
      return ok("Saved the current draft locally.");
    }

    if (call.name === "export_lab_json") {
      downloadJson(
        `${draft.id}.${artifactKind === "technique" ? "technique" : "lab"}.json`,
        serializeStudioArtifact(artifactKind, draft),
      );
      return ok(`Exported the current ${artifactKind} JSON.`);
    }

    if (call.name === "generate_and_save_image_asset") {
      const prompt = nonEmptyString(args.prompt);
      if (!prompt) return error("Image prompt is required.");
      const response = await postAssistantImage({
        prompt,
        filename: nullableString(args.filename) ?? null,
        kind: (args.kind as "workflow" | "equipment" | "template" | "experiment" | "reference") ??
          "workflow",
        draftId: draft.id,
      });
      return ok(`Generated image asset ${response.publicPath}.`, response);
    }

    return error(`Unhandled assistant tool: ${call.name}`);
  };

  return {
    getContext: () => makeContext(draft, selectedNodeId, revision, artifactKind),
    executeTool,
  };
};
