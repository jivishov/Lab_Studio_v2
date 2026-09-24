import type { ActionDefinition, ActionInteractionSpec, ProcessNode, RuntimeState, ValidationRule } from "../../domain/types";
import { equipmentById } from "../../equipment/catalog";
import { actionInputField, resolveActionInput, type ActionInputField, type ActionInputResolution } from "../../runtime/actionInputs";
import { isWithinTolerance } from "../../runtime/calculations";
import { configurationLockFor, type ConfigurationLock } from "../../runtime/configurationGate";

/**
 * The step card's enabling rules, replicated from the 2D `ProcessSidebar` (src/player/
 * ProcessSidebar.tsx: rulesPass, displayRulePasses, source/targetDefinitionFor, endpointLabel,
 * stationLabel, usesAccessibleConfirmation, interactionRequiresSource/Target, and the canRecord /
 * canRecordObservation / canSubmitCalculation / Confirm conditions). They are private to that UI
 * file; exporting them would be a 2D refactor outside plan §4.7, so they are copied here with this
 * note. The one intended difference is presentation: in assessment mode an unselected required
 * endpoint reads "Choose…" where 2D reads "Not selected" (handoff §5.5). The drop-dispense and
 * time-series controls are not copied: no Pack 1 action uses them. The drift risk and a proposal
 * to extract the rules into a shared module are recorded in evidence/M5_EVIDENCE.md.
 */
const stringParam = (action: ActionDefinition | undefined, key: string): string | undefined => {
  const value = action?.parameters[key];
  return typeof value === "string" && value.trim() ? value : undefined;
};

const rulesPass = (rules: ValidationRule[], state: RuntimeState, type: "measurementRecorded" | "notebookEntry" | "dataSeriesRecorded"): boolean =>
  rules.filter((rule) => rule.type === type).every((rule) =>
    type === "measurementRecorded"
      ? state.measurements.some((m) => m.id === rule.measurementId)
      : type === "dataSeriesRecorded"
        ? state.dataSeries.some((s) => s.id === rule.dataSeriesId)
        : state.notebook.some((e) => e.tags.includes(rule.notebookTag ?? "")));

const statePathValue = (state: RuntimeState, path: string): unknown =>
  path.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) return undefined;
    if (Array.isArray(value) && /^\d+$/.test(segment)) return value[Number(segment)];
    return (value as Record<string, unknown>)[segment];
  }, state);

/** ProcessSidebar.displayRulePasses, for the prerequisite count that gates Confirm. */
export const displayRulePasses = (rule: ValidationRule, state: RuntimeState, nodeId: string): boolean => {
  if (rule.type === "actionEvidence") return Boolean(rule.actionId && state.attemptHistory.some((a) => a.actionId === rule.actionId && a.success));
  if (rule.type === "measurementRecorded") return Boolean(rule.measurementId && state.measurements.some((m) => m.id === rule.measurementId));
  if (rule.type === "dataSeriesRecorded") return Boolean(rule.dataSeriesId && state.dataSeries.some((s) => s.id === rule.dataSeriesId));
  if (rule.type === "notebookEntry") return Boolean(rule.notebookTag && state.notebook.some((e) => e.tags.includes(rule.notebookTag ?? "")));
  if (rule.type === "calculationWithinTolerance") {
    const calculation = state.calculations.find((entry) => entry.id === rule.calculationId);
    return Boolean(calculation && calculation.expected !== undefined
      && isWithinTolerance(calculation.value, calculation.expected, rule.tolerance ?? calculation.tolerance ?? 0));
  }
  if (rule.type === "statePath" && rule.path) return statePathValue(state, rule.path) === rule.equals;
  return rule.type === "processCompleted" && state.completedNodes.includes(nodeId);
};

export const sourceDefinitionFor = (action?: ActionDefinition, interaction?: ActionInteractionSpec): string | undefined =>
  interaction?.sourceDefinitionId ?? stringParam(action, "sourceDefinitionId") ?? stringParam(action, "equipmentDefinitionId");

export const targetDefinitionFor = (action?: ActionDefinition, interaction?: ActionInteractionSpec): string | undefined =>
  interaction?.targetDefinitionId ?? stringParam(action, "targetDefinitionId") ?? stringParam(action, "instrumentDefinitionId") ?? stringParam(action, "ovenDefinitionId");

export const usesAccessibleConfirmation = (interaction?: ActionInteractionSpec): boolean =>
  Boolean(interaction && interaction.type !== "dispenseDrops" && interaction.type !== "recordNotebook"
    && interaction.type !== "recordTimeSeries" && interaction.type !== "submitCalculation");

export const interactionRequiresSource = (interaction?: ActionInteractionSpec): boolean =>
  Boolean(interaction && (interaction.sourceDefinitionId || ["dragToZone", "snapIntoTarget", "pourInto", "dispenseDrops",
    "spotOnto", "rinseTarget", "placeInInstrument", "readInstrument"].includes(interaction.type)));

export const interactionRequiresTarget = (interaction?: ActionInteractionSpec): boolean =>
  Boolean(interaction && (["snapIntoTarget", "pourInto", "dispenseDrops", "spotOnto", "rinseTarget", "placeInInstrument"].includes(interaction.type)
    || (interaction.type === "readInstrument" && Boolean(interaction.targetDefinitionId))));

/**
 * StudentPlayer.currentStepEquipmentIds: the definitions the shelf marks "Needed now" in guided
 * mode, the step's source, target and station, where each is a catalogue item.
 */
export const currentStepEquipmentIds = (interaction?: ActionInteractionSpec): string[] =>
  [interaction?.sourceDefinitionId, interaction?.targetDefinitionId, interaction?.stationId]
    .filter((definitionId): definitionId is string => Boolean(definitionId && equipmentById.has(definitionId)));

/** ProcessSidebar.stationLabel: what an optional target shows when the step names no equipment. */
export const stationLabel = (stationId?: string): string => {
  if (!stationId) return "No target required";
  if (stationId === "shelf") return "Equipment shelf";
  if (stationId === "workbench") return "Workbench";
  return equipmentById.get(stationId)?.label ?? stationId;
};

/** ProcessSidebar.submitCalculationLabel: the calculation button's wording. */
export const submitCalculationLabel = (label: string): string => {
  const normalized = label.trim();
  if (normalized.toLowerCase().includes("hardness")) return "Submit hardness calculation";
  if (normalized.toLowerCase().startsWith("calculate ")) return `Submit ${normalized.slice("Calculate ".length).toLowerCase()} calculation`;
  return `Submit ${normalized.toLowerCase()}`;
};

export interface Endpoint {
  definitionId?: string;
  label: string;
  missing: boolean;
}

const endpoint = (state: RuntimeState, selected: string | undefined, expectedDefinitionId: string | undefined,
  required: boolean, optionalLabel: string, showGuidance: boolean): Endpoint => {
  if (selected) {
    const instance = state.equipmentInstances.find((i) => i.id === selected);
    if (!instance) return { label: "Selected equipment is unavailable", missing: true };
    const mismatched = Boolean(expectedDefinitionId && instance.definitionId !== expectedDefinitionId);
    return { definitionId: instance.definitionId, label: mismatched ? `${instance.label} (does not match required equipment)` : instance.label, missing: mismatched };
  }
  const expected = showGuidance && expectedDefinitionId ? equipmentById.get(expectedDefinitionId)?.label ?? expectedDefinitionId : undefined;
  if (expected) {
    const available = state.equipmentInstances.some((i) => i.definitionId === expectedDefinitionId);
    return { definitionId: expectedDefinitionId, label: available ? expected : `${expected} unavailable`, missing: !available };
  }
  return required ? { label: showGuidance ? "Not selected" : "Choose…", missing: true } : { label: optionalLabel, missing: false };
};

export interface StepFlow {
  node: ProcessNode;
  action?: ActionDefinition;
  interaction?: ActionInteractionSpec;
  nodeCompleted: boolean;
  inputField?: ActionInputField;
  inputResolution: ActionInputResolution & { field?: ActionInputField };
  inputReady: boolean;
  configurationLock?: ConfigurationLock;
  prerequisitesReady: boolean;
  source: Endpoint;
  target: Endpoint;
  /** Confirm drives the interaction (drag, snap, pour, instrument read). */
  canConfirm: boolean;
  confirmEnabled: boolean;
  /** The notebook and calculation controls, as the 2D sidebar shows them. */
  canRecord: boolean;
  canRecordObservation: boolean;
  canSubmitCalculation: boolean;
}

export const stepFlow = (args: {
  state: RuntimeState;
  node: ProcessNode;
  action?: ActionDefinition;
  interaction?: ActionInteractionSpec;
  inputValue: string;
  selectedSource?: string;
  selectedTarget?: string;
  showGuidance: boolean;
}): StepFlow => {
  const { state, node, action, interaction, showGuidance } = args;
  const nodeCompleted = state.completedNodes.includes(node.id);
  const inputField = actionInputField(action);
  const inputResolution = { ...resolveActionInput(action, args.inputValue), field: inputField };
  const inputReady = !inputField || inputResolution.valid;
  const configurationLock = configurationLockFor(action, inputField?.role === "teacherConfiguration" && inputResolution.valid);
  const prerequisites = action?.prerequisites ?? [];
  const prerequisitesReady = prerequisites.every((rule) => displayRulePasses(rule, state, node.id));
  const measurementId = stringParam(action, "measurementId");
  const pending = measurementId ? state.measurements.find((m) => m.id === measurementId) : undefined;
  const supplied = action?.parameters.value;
  const recordEvidence = Boolean(pending
    || (inputField?.mode === "numeric" && inputResolution.valid && inputResolution.value !== undefined)
    || typeof supplied === "number");
  const base = !configurationLock && inputReady && prerequisitesReady && !nodeCompleted;
  const canRecord = action?.verb === "record" && interaction?.type === "recordNotebook" && base && recordEvidence;
  const typedNotebookOperation = Boolean(action?.parameters.titrationOperation || action?.fractionHandling || action?.extractionOperation
    || action?.extractionObservation || action?.extractionIdentity || action?.choiceObservation);
  const configuredObservation = action?.verb === "observe" && inputField !== undefined && inputField !== null;
  const scoped = (action?.verb === "observe" || action?.verb === "record") && typeof action.parameters.evidenceScopeSlotId === "string" && !canRecord;
  const canRecordObservation = interaction?.type === "recordNotebook"
    && (typedNotebookOperation || scoped || configuredObservation || action?.verb === "stressEquilibrium" || (action?.verb === "observe" && Boolean(stringParam(action, "note"))))
    && base;
  const calculationId = stringParam(action, "calculationId");
  const calculationExists = calculationId ? state.calculations.some((c) => c.id === calculationId) : false;
  const canSubmitCalculation = action?.verb === "calculate" && interaction?.type === "submitCalculation" && base && !calculationExists
    && rulesPass(prerequisites, state, "measurementRecorded") && rulesPass(prerequisites, state, "notebookEntry") && rulesPass(prerequisites, state, "dataSeriesRecorded");
  const canConfirm = usesAccessibleConfirmation(interaction);
  const sourceRequired = interactionRequiresSource(interaction);
  const targetRequired = interactionRequiresTarget(interaction);
  const source = endpoint(state, args.selectedSource, sourceDefinitionFor(action, interaction), sourceRequired, "No source required", showGuidance);
  const target = endpoint(state, args.selectedTarget, targetDefinitionFor(action, interaction), targetRequired, stationLabel(interaction?.stationId), showGuidance);
  const missingRequired = canConfirm && ((sourceRequired && source.missing) || (targetRequired && target.missing));
  const confirmEnabled = canConfirm && !configurationLock && inputReady && prerequisitesReady && !nodeCompleted && !missingRequired;
  return { node, action, interaction, nodeCompleted, inputField: inputField ?? undefined, inputResolution, inputReady, configurationLock,
    prerequisitesReady, source, target, canConfirm, confirmEnabled, canRecord, canRecordObservation, canSubmitCalculation };
};
