import type { ActionDefinition, NotebookEntry } from "../../domain/types";
import { actionInputField } from "../../runtime/actionInputs";
import type { ProvenanceKind } from "../ui/ProvenanceChip";

/**
 * Which provenance chip a recorded value carries (handoff §3.2), from where the runtime took it
 * (plan §2.4):
 * - the step's input field says whose value it is: `teacherConfiguration` is a teacher setting,
 *   `studentResponse` is the learner's entry;
 * - a value the definition binds to a setup slot (`{{config.x}}`, whole string) is a teacher
 *   setting too. Setup materialises the binding, so it is read from the definition as authored;
 * - anything else the runtime recorded is from the bench.
 */
export interface ProvenanceSource {
  actions: ActionDefinition[];
  process: { nodes: Array<{ id: string; actionId?: string }> };
}

const CONFIGURATION_BINDING = /^\{\{\s*config\.[^}]+\}\}$/;

export const isConfigurationBinding = (value: unknown): boolean =>
  typeof value === "string" && CONFIGURATION_BINDING.test(value.trim());

const roleProvenance = (action: ActionDefinition): ProvenanceKind | undefined => {
  const role = actionInputField(action)?.role ?? action.parameters.inputRole;
  if (role === "teacherConfiguration") return "teacher";
  if (role === "studentResponse" || action.parameters.requireStudentValue === true) return "entry";
  return undefined;
};

const boundToSetup = (authored: ProvenanceSource | undefined, actionId: string, keys: readonly string[]): boolean => {
  const action = authored?.actions.find((a) => a.id === actionId);
  return Boolean(action && keys.some((key) => isConfigurationBinding(action.parameters[key])));
};

/** A measurement's chip; `authored` is the definition before setup, when there was one. */
export const measurementProvenance = (configured: ProvenanceSource, authored: ProvenanceSource | undefined, measurementId: string): ProvenanceKind => {
  const action = configured.actions.find((a) => a.parameters.measurementId === measurementId
    || (a.mass && "outputMeasurementId" in a.mass && a.mass.outputMeasurementId === measurementId)
    || a.volume?.outputMeasurementId === measurementId);
  if (!action) return "bench";
  return roleProvenance(action) ?? (boundToSetup(authored, action.id, ["value", "volumeMl"]) ? "teacher" : "bench");
};

/** A notebook entry's chip, from the action of the step that recorded it. */
export const notebookProvenance = (configured: ProvenanceSource, authored: ProvenanceSource | undefined, entry: NotebookEntry): ProvenanceKind => {
  const actionId = configured.process.nodes.find((node) => node.id === entry.nodeId)?.actionId;
  const action = actionId ? configured.actions.find((a) => a.id === actionId) : undefined;
  const byRole = action ? roleProvenance(action) : undefined;
  if (byRole) return byRole;
  if (actionId && boundToSetup(authored, actionId, ["note", "value"])) return "teacher";
  return entry.type === "measurement" ? "entry" : "bench";
};
