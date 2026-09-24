import { resolveActionInteraction } from "../../domain/interactions";
import { getProcessNodeLayout } from "../../domain/processLayout";
import type { ActionDefinition, EdgeConditionType, ActionInteractionType, LabDefinition, ProcessNode, ValidationType } from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { actionInputField, type ActionInputRole } from "../../runtime/actionInputs";
import type { StudioDiagnostic } from "../../studio/studioReadiness";

/**
 * The Flow view's reading of a draft (handoff §4.4). Pure: it only reads the draft and the
 * Studio's own diagnostics. Nothing here is new behaviour; it decides what each node card shows.
 */
export const NODE_WIDTH = 232;

export const NODE_TYPE_ICON: Record<ProcessNode["type"], string> = {
  technique: "cards",
  action: "move",
  checkpoint: "flag",
  decision: "split",
  calculation: "equals",
  observation: "eye",
  teacherNote: "note",
};

/** Interaction icons (§3.6). */
export const INTERACTION_ICON: Partial<Record<ActionInteractionType, string>> = {
  dragToZone: "move",
  snapIntoTarget: "seat",
  pourInto: "pour",
  readInstrument: "gauge",
  recordNotebook: "pencil",
  submitCalculation: "calc",
};

export const NODE_TYPE_LABEL: Record<ProcessNode["type"], string> = {
  technique: "Technique",
  action: "Action",
  checkpoint: "Checkpoint",
  decision: "Decision",
  calculation: "Calculation",
  observation: "Observation",
  teacherNote: "Teacher note",
};

export const CONDITION_LABEL: Record<EdgeConditionType, string> = {
  always: "Always",
  validationPassed: "Validation passed",
  retry: "Retry",
  calculationResult: "Calculation result",
};

/** The glyph each condition carries, so colour is never the only signal (§4.4). */
export const CONDITION_GLYPH: Record<EdgeConditionType, string | undefined> = {
  always: undefined,
  validationPassed: "check",
  retry: "retry",
  calculationResult: "equals",
};

const verbWords = (verb: string): string => verb.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();

/** Equipment an action names: its `*DefinitionId` parameters and role bindings, catalogue ids only. */
export const actionEquipment = (action: ActionDefinition | undefined): string[] => {
  if (!action) return [];
  const ids = [
    ...Object.entries(action.parameters).flatMap(([key, value]) => (key.endsWith("DefinitionId") && typeof value === "string" ? [value] : [])),
    ...Object.values(action.equipmentRoleBindings ?? {}),
  ];
  return [...new Set(ids)].filter((id) => equipmentById.has(id));
};

export interface NodeCard {
  id: string;
  type: ProcessNode["type"];
  icon: string;
  eyebrow: string;
  title: string;
  equipment: string[];
  validation: ValidationType[];
  inputRole?: ActionInputRole;
  evidence: string[];
  hasHint: boolean;
  isStart: boolean;
  issues: number;
  interaction?: ActionInteractionType;
  /** Whether the interaction is authored, or derived from the verb (§4.7). */
  interactionAuthored: boolean;
  /** The technique a flattened step came from (its id prefix), for group frames (§4.4, D8 a). */
  sourceTechniqueId?: string;
  outConditions: EdgeConditionType[];
  position: { x: number; y: number };
}

/** Issues per node: diagnostics anchored to it or to its action. */
export const issuesByNode = (draft: LabDefinition, diagnostics: StudioDiagnostic[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const d of diagnostics) {
    if (d.severity === "pass") continue;
    const nodeId = d.anchor?.nodeId
      ?? (d.anchor?.actionId ? draft.process.nodes.find((n) => n.actionId === d.anchor?.actionId)?.id : undefined);
    if (nodeId) counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1);
  }
  return counts;
};

/**
 * Which technique a flattened step came from: `appendTechniqueToDraft` prefixes copied ids with
 * the technique instance id, which the draft keeps in `techniques`.
 */
export const sourceTechniqueOf = (draft: LabDefinition, node: ProcessNode): string | undefined =>
  draft.techniques.some((t) => t.id !== draft.id)
    ? draft.techniques.find((t) => t.id !== draft.id && t.process.nodes.some((n) => n.id === node.id))?.id
    : undefined;

export const nodeCards = (draft: LabDefinition, diagnostics: StudioDiagnostic[]): NodeCard[] => {
  const issues = issuesByNode(draft, diagnostics);
  const actions = new Map(draft.actions.map((a) => [a.id, a]));
  return draft.process.nodes.map((node, index) => {
    const action = node.actionId ? actions.get(node.actionId) : undefined;
    const interaction = action ? resolveActionInteraction(action) : undefined;
    const input = actionInputField(action);
    const icon = node.type === "action" && interaction ? INTERACTION_ICON[interaction.type] ?? "move" : NODE_TYPE_ICON[node.type];
    const layout = getProcessNodeLayout(node, index);
    const eyebrow = node.type === "teacherNote"
      ? "Teacher note · not played"
      : action ? `${NODE_TYPE_LABEL[node.type]} · ${verbWords(action.verb)}` : NODE_TYPE_LABEL[node.type];
    return {
      id: node.id,
      type: node.type,
      icon,
      eyebrow,
      title: node.title,
      equipment: actionEquipment(action),
      validation: [...new Set(node.validation.map((rule) => rule.type))],
      ...(input ? { inputRole: input.role } : {}),
      evidence: action?.evidence ?? [],
      hasHint: node.hints.some((hint) => hint.trim().length > 0),
      isStart: draft.process.startNodeId === node.id,
      issues: issues.get(node.id) ?? 0,
      ...(interaction ? { interaction: interaction.type } : {}),
      interactionAuthored: Boolean(action?.interaction),
      ...(sourceTechniqueOf(draft, node) ? { sourceTechniqueId: sourceTechniqueOf(draft, node) } : {}),
      outConditions: draft.process.edges.filter((e) => e.from === node.id).map((e) => e.condition.type),
      position: { x: layout.x, y: layout.y },
    };
  });
};

/** Arrow-key travel along connections (§4.9): forward follows out-edges, back follows in-edges. */
export const neighbourAlongEdges = (draft: LabDefinition, nodeId: string, key: string): string | undefined => {
  const edges = draft.process.edges.filter((e) => e.condition.type !== "retry" || e.from !== e.to);
  if (key === "ArrowRight" || key === "ArrowDown") return edges.find((e) => e.from === nodeId && e.to !== nodeId)?.to;
  if (key === "ArrowLeft" || key === "ArrowUp") return edges.find((e) => e.to === nodeId && e.from !== nodeId)?.from;
  return undefined;
};
