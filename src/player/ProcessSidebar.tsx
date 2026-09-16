import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, CircleDot, Droplet, Keyboard, Ruler } from "lucide-react";
import type {
  ActionDefinition,
  ActionInteractionSpec,
  ProcessDefinition,
  ProcessNode,
  RuntimeState,
  ValidationRule,
} from "../domain/types";
import { DEFAULT_TITRATION_MAX_EXTRA_DROPS } from "../domain/titrationModels";
import { equipmentById } from "../equipment/catalog";
import {
  actionInputField,
  configurationLockFor,
  isWithinTolerance,
  resolveActionInput,
  type InteractionInvalidFeedback,
} from "../runtime";
import { BuretteReadout } from "./BuretteReadout";
import { formatEvidenceValue } from "./evidenceFormatting";
import { ScientificText } from "./ScientificText";
import { TitrationCurveEvidence } from "./TitrationCurveEvidence";

interface ProcessSidebarProps {
  activeTab?: InspectorTab;
  action?: ActionDefinition;
  actionInputValue: string;
  currentNode: ProcessNode;
  evidenceContent?: ReactNode;
  evidenceCount?: number;
  hybrid?: boolean;
  invalidFeedback?: InteractionInvalidFeedback;
  interaction?: ActionInteractionSpec;
  nodeCompleted: boolean;
  onAcceptDispenseEndpoint: () => void;
  onActionInputChange: (value: string) => void;
  onConfirmAccessibleAction: () => void;
  onDispenseDrop: () => void;
  onRecordEvidence: () => void;
  onRecordTimeSeries: () => void;
  onSubmitCalculation: () => void;
  onTabChange?: (tab: InspectorTab) => void;
  previewNotice?: string;
  process: ProcessDefinition;
  selectedSource?: string;
  selectedTarget?: string;
  showGuidance?: boolean;
  state: RuntimeState;
}

export type InspectorTab = "now" | "process" | "evidence";

const interactionLabel = (interaction?: ActionInteractionSpec): string => {
  if (!interaction) return "review";
  return interaction.type.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
};

const stringParam = (
  action: ActionDefinition | undefined,
  key: string,
): string | undefined => {
  const value = action?.parameters[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const numberParam = (
  action: ActionDefinition | undefined,
  key: string,
): number | undefined => {
  const value = action?.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const rulesPass = (
  rules: ValidationRule[],
  state: RuntimeState,
  type: "measurementRecorded" | "notebookEntry" | "dataSeriesRecorded",
): boolean =>
  rules
    .filter((rule) => rule.type === type)
    .every((rule) =>
      type === "measurementRecorded"
        ? state.measurements.some((measurement) => measurement.id === rule.measurementId)
        : type === "dataSeriesRecorded"
          ? state.dataSeries.some((series) => series.id === rule.dataSeriesId)
          : state.notebook.some((entry) => entry.tags.includes(rule.notebookTag ?? "")),
    );

const statePathValue = (state: RuntimeState, path: string): unknown =>
  path.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) return undefined;
    if (Array.isArray(value) && /^\d+$/.test(segment)) return value[Number(segment)];
    return (value as Record<string, unknown>)[segment];
  }, state);

const displayRulePasses = (
  rule: ValidationRule,
  state: RuntimeState,
  nodeId: string,
): boolean => {
  if (rule.type === "actionEvidence") {
    return Boolean(
      rule.actionId &&
        state.attemptHistory.some(
          (attempt) => attempt.actionId === rule.actionId && attempt.success,
        ),
    );
  }
  if (rule.type === "measurementRecorded") {
    return Boolean(
      rule.measurementId &&
        state.measurements.some((measurement) => measurement.id === rule.measurementId),
    );
  }
  if (rule.type === "dataSeriesRecorded") {
    return Boolean(
      rule.dataSeriesId && state.dataSeries.some((series) => series.id === rule.dataSeriesId),
    );
  }
  if (rule.type === "notebookEntry") {
    return Boolean(
      rule.notebookTag &&
        state.notebook.some((entry) => entry.tags.includes(rule.notebookTag ?? "")),
    );
  }
  if (rule.type === "calculationWithinTolerance") {
    const calculation = state.calculations.find((entry) => entry.id === rule.calculationId);
    return Boolean(
      calculation &&
        calculation.expected !== undefined &&
        isWithinTolerance(
          calculation.value,
          calculation.expected,
          rule.tolerance ?? calculation.tolerance ?? 0,
        ),
    );
  }
  if (rule.type === "statePath" && rule.path) {
    return statePathValue(state, rule.path) === rule.equals;
  }
  return rule.type === "processCompleted" && state.completedNodes.includes(nodeId);
};

const authoredEvidenceLabel = (action?: ActionDefinition): string =>
  action?.evidence.length ? action.evidence.join(" · ") : "No authored evidence label";

const completionStatement = (
  node: ProcessNode,
  primaryActionLabel: string,
): string => {
  if (node.validation.length === 0) return `${primaryActionLabel} completes successfully.`;
  return `${node.validation
    .map((rule) => rule.label.replace(/[.\s]+$/, ""))
    .join("; ")}.`;
};

const submitCalculationLabel = (label: string): string => {
  const normalized = label.trim();
  if (normalized.toLowerCase().includes("hardness")) return "Submit hardness calculation";
  if (normalized.toLowerCase().startsWith("calculate ")) {
    return `Submit ${normalized.slice("Calculate ".length).toLowerCase()} calculation`;
  }
  return `Submit ${normalized.toLowerCase()}`;
};

const endpointDefinitionLabel = (definitionId?: string): string | undefined =>
  definitionId ? equipmentById.get(definitionId)?.label ?? definitionId : undefined;

interface EndpointPresentation {
  definitionId?: string;
  label: string;
  missing: boolean;
}

const sourceDefinitionFor = (
  action: ActionDefinition | undefined,
  interaction: ActionInteractionSpec | undefined,
): string | undefined =>
  interaction?.sourceDefinitionId ??
  stringParam(action, "sourceDefinitionId") ??
  stringParam(action, "equipmentDefinitionId");

const targetDefinitionFor = (
  action: ActionDefinition | undefined,
  interaction: ActionInteractionSpec | undefined,
): string | undefined =>
  interaction?.targetDefinitionId ??
  stringParam(action, "targetDefinitionId") ??
  stringParam(action, "instrumentDefinitionId") ??
  stringParam(action, "ovenDefinitionId");

const endpointLabel = (
  state: RuntimeState,
  selectedInstanceId: string | undefined,
  expectedDefinitionId: string | undefined,
  required: boolean,
  optionalLabel: string,
  showGuidance: boolean,
): EndpointPresentation => {
  if (selectedInstanceId) {
    const selected = state.equipmentInstances.find((instance) => instance.id === selectedInstanceId);
    if (!selected) return { label: "Selected equipment is unavailable", missing: true };
    const mismatched = Boolean(expectedDefinitionId && selected.definitionId !== expectedDefinitionId);
    return {
      definitionId: selected.definitionId,
      label: mismatched ? `${selected.label} (does not match required equipment)` : selected.label,
      missing: mismatched,
    };
  }
  const expected = showGuidance ? endpointDefinitionLabel(expectedDefinitionId) : undefined;
  if (expected) {
    const available = state.equipmentInstances.some(
      (instance) => instance.definitionId === expectedDefinitionId,
    );
    return {
      definitionId: expectedDefinitionId,
      label: available ? expected : `${expected} unavailable`,
      missing: !available,
    };
  }
  return required ? { label: "Not selected", missing: true } : { label: optionalLabel, missing: false };
};

const endpointArt = (endpoint: EndpointPresentation) => {
  const definition = endpoint.definitionId ? equipmentById.get(endpoint.definitionId) : undefined;
  return (
    <span
      aria-hidden="true"
      className={[
        "step-endpoint-art",
        definition ? "has-equipment" : "is-zone",
        endpoint.missing ? "is-missing" : "",
      ].filter(Boolean).join(" ")}
    >
      {definition ? <img alt="" draggable={false} src={definition.asset} /> : null}
    </span>
  );
};

const usesAccessibleConfirmation = (interaction?: ActionInteractionSpec): boolean =>
  Boolean(
    interaction &&
      interaction.type !== "dispenseDrops" &&
      interaction.type !== "recordNotebook" &&
      interaction.type !== "recordTimeSeries" &&
      interaction.type !== "submitCalculation",
  );

const interactionRequiresSource = (interaction?: ActionInteractionSpec): boolean =>
  Boolean(
    interaction &&
      (interaction.sourceDefinitionId ||
        interaction.type === "dragToZone" ||
        interaction.type === "snapIntoTarget" ||
        interaction.type === "pourInto" ||
        interaction.type === "dispenseDrops" ||
        interaction.type === "spotOnto" ||
        interaction.type === "rinseTarget" ||
        interaction.type === "placeInInstrument" ||
        interaction.type === "readInstrument"),
  );

const interactionRequiresTarget = (interaction?: ActionInteractionSpec): boolean =>
  Boolean(
    interaction &&
      (interaction.type === "snapIntoTarget" ||
        interaction.type === "pourInto" ||
        interaction.type === "dispenseDrops" ||
        interaction.type === "spotOnto" ||
      interaction.type === "rinseTarget" ||
      interaction.type === "placeInInstrument" ||
      (interaction.type === "readInstrument" && Boolean(interaction.targetDefinitionId))),
  );

const stationLabel = (stationId?: string): string => {
  if (!stationId) return "No target required";
  if (stationId === "shelf") return "Equipment shelf";
  if (stationId === "workbench") return "Workbench";
  return equipmentById.get(stationId)?.label ?? stationId;
};

const accessibleActionButtonLabel = (
  action: ActionDefinition | undefined,
  interaction: ActionInteractionSpec | undefined,
): string => {
  if (!action) return "Complete step";
  if (action.verb === "filter") return "Filter mixture";
  if (action.verb === "spotSample") return "Spot sample";
  if (action.verb === "developChromatogram") return "Develop chromatogram";
  if (action.verb === "rinse") return action.label;
  if (action.verb === "measureVolume") return "Measure volume";
  if (action.verb === "transfer" || action.verb === "dissolve" || action.verb === "precipitate" || action.verb === "dilute") return "Pour";
  if (action.verb === "place") return action.label;
  if (action.verb === "dry") return "Place in oven";
  if (action.verb === "heat") return "Heat sample";
  if (action.verb === "cool") return "Cool sample";
  if (action.verb === "stressEquilibrium") return action.label;
  if (interaction?.type === "recordTimeSeries") return "Record timed gas data";
  if (stringParam(action, "phReadingMode") === "acceptedEndpoint") return action.label;
  if (action.verb === "weigh" || interaction?.type === "readInstrument") return "Read instrument";
  return action.label || "Complete step";
};

const normalizeInstructionText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const nonRedundantHints = (hints: string[], primaryInstruction: string, accessibleLabel?: string): string[] => {
  const references = [primaryInstruction, accessibleLabel ?? ""]
    .map(normalizeInstructionText)
    .filter(Boolean);

  return hints.filter((hint) => {
    const normalizedHint = normalizeInstructionText(hint);
    if (!normalizedHint) return false;
    return !references.some(
      (reference) =>
        normalizedHint === reference ||
        normalizedHint.includes(reference) ||
        reference.includes(normalizedHint),
    );
  });
};

const buretteReadingForAction = (
  state: RuntimeState,
  action: ActionDefinition | undefined,
): { label: string; value: number } | undefined => {
  const measurementId = stringParam(action, "measurementId");
  if (measurementId !== "burette-initial-volume" && measurementId !== "burette-final-volume") return undefined;
  const measured = state.measurements.find((measurement) => measurement.id === measurementId);
  const value = measured?.value ?? action?.parameters.value;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return {
    label: measurementId === "burette-initial-volume" ? "Initial burette reading" : "Final burette reading",
    value,
  };
};

export const ProcessSidebar = ({
  activeTab = "now",
  action,
  actionInputValue,
  currentNode,
  evidenceContent,
  evidenceCount = 0,
  hybrid = true,
  invalidFeedback,
  interaction,
  nodeCompleted,
  onAcceptDispenseEndpoint,
  onActionInputChange,
  onConfirmAccessibleAction,
  onDispenseDrop,
  onRecordEvidence,
  onRecordTimeSeries,
  onSubmitCalculation,
  onTabChange,
  previewNotice,
  process,
  selectedSource,
  selectedTarget,
  showGuidance = true,
  state,
}: ProcessSidebarProps) => {
  const sidebarRef = useRef<HTMLElement>(null);
  const measurementId = stringParam(action, "measurementId");
  const pendingMeasurement = measurementId
    ? state.measurements.find((measurement) => measurement.id === measurementId)
    : undefined;
  const suppliedRecordValue = action?.parameters.value;
  const inputField = actionInputField(action);
  const inputResolution = resolveActionInput(action, actionInputValue);
  const inputReady = !inputField || inputResolution.valid;
  const configurationLock = configurationLockFor(
    action,
    inputField?.role === "teacherConfiguration" && inputResolution.valid,
  );
  const actionPrerequisites = action?.prerequisites ?? [];
  const prerequisitesMet = actionPrerequisites.filter((rule) =>
    displayRulePasses(rule, state, currentNode.id),
  ).length;
  const unmetPrerequisiteCount = actionPrerequisites.length - prerequisitesMet;
  const prerequisitesReady = unmetPrerequisiteCount === 0;
  const recordEvidence = pendingMeasurement
    ? { value: pendingMeasurement.value, unit: pendingMeasurement.unit }
    : inputField?.mode === "numeric" && inputResolution.valid && inputResolution.value !== undefined
      ? { value: inputResolution.value, unit: inputField.unit ?? "" }
    : typeof suppliedRecordValue === "number"
      ? { value: suppliedRecordValue, unit: stringParam(action, "unit") ?? "" }
      : undefined;
  const canRecord =
    action?.verb === "record" &&
    interaction?.type === "recordNotebook" &&
    !configurationLock &&
    inputReady &&
    prerequisitesReady &&
    !nodeCompleted &&
    Boolean(recordEvidence);
  const observationNote = stringParam(action, "note");
  const typedNotebookOperation = Boolean(action?.parameters.titrationOperation ||
    action?.fractionHandling || action?.extractionOperation || action?.extractionObservation ||
    action?.extractionIdentity || action?.choiceObservation,
  );
  const configuredNotebookObservation = action?.verb === "observe" &&
    inputField !== undefined && inputField !== null;
  const scopedNotebookEvidence = (action?.verb === "observe" || action?.verb === "record") &&
    typeof action.parameters.evidenceScopeSlotId === "string" && !canRecord;
  const canRecordObservation =
    interaction?.type === "recordNotebook" &&
    (typedNotebookOperation || scopedNotebookEvidence || configuredNotebookObservation || action?.verb === "stressEquilibrium" ||
      (action?.verb === "observe" && Boolean(observationNote))) &&
    !configurationLock &&
    inputReady &&
    prerequisitesReady &&
    !nodeCompleted;
  const conditionDataSeriesId = stringParam(action, "conditionId")
    ? `${stringParam(action, "conditionId")}-gas-series`
    : undefined;
  const dataSeriesId = stringParam(action, "dataSeriesId") ?? conditionDataSeriesId;
  const dataSeriesExists = dataSeriesId
    ? state.dataSeries.some((series) => series.id === dataSeriesId)
    : false;
  const canRecordTimeSeries =
    action?.verb === "record" &&
    interaction?.type === "recordTimeSeries" &&
    !configurationLock &&
    inputReady &&
    prerequisitesReady &&
    !nodeCompleted &&
    !dataSeriesExists;

  const calculationId = stringParam(action, "calculationId");
  const calculationExists = calculationId
    ? state.calculations.some((calculation) => calculation.id === calculationId)
    : false;
  const canSubmitCalculation =
    action?.verb === "calculate" &&
    interaction?.type === "submitCalculation" &&
    !configurationLock &&
    inputReady &&
    prerequisitesReady &&
    !nodeCompleted &&
      !calculationExists &&
      rulesPass(action.prerequisites, state, "measurementRecorded") &&
      rulesPass(action.prerequisites, state, "notebookEntry") &&
      rulesPass(action.prerequisites, state, "dataSeriesRecorded");
  const isDispenseDrops = interaction?.type === "dispenseDrops" && action?.verb === "transfer";
  const isDragToZone = interaction?.type === "dragToZone";
  const canConfirm = usesAccessibleConfirmation(interaction);
  const showEndpointVisuals = hybrid && canConfirm;
  const sourceRequired = interactionRequiresSource(interaction);
  const targetRequired = interactionRequiresTarget(interaction);
  const sourceEndpoint = endpointLabel(
    state,
    selectedSource,
    sourceDefinitionFor(action, interaction),
    sourceRequired,
    "No source required",
    showGuidance,
  );
  const targetEndpoint = endpointLabel(
    state,
    selectedTarget,
    targetDefinitionFor(action, interaction),
    targetRequired,
    stationLabel(interaction?.stationId),
    showGuidance,
  );
  const missingRequiredEndpoint =
    canConfirm && ((sourceRequired && sourceEndpoint.missing) || (targetRequired && targetEndpoint.missing));
  const buretteReading = buretteReadingForAction(state, action);
  const endpointPhStep = stringParam(action, "phReadingMode") === "acceptedEndpoint";
  const endpointPhMeasurement = state.measurements.find((measurement) => measurement.id === "endpoint-ph");
  const endpointPhReadout = state.equipmentInstances
    .find((instance) => instance.definitionId === "ph-meter")
    ?.contents.instrumentReadout;
  const endpointPhPrecision = Math.max(0, Math.round(numberParam(action, "phPrecision") ?? endpointPhReadout?.precision ?? 2));
  const idealEquivalenceVolumeMl =
    numberParam(action, "theoreticalEquivalenceVolumeMl") ?? endpointPhReadout?.idealEquivalenceVolumeMl;
  const idealEquivalencePh =
    numberParam(action, "idealEquivalencePh") ?? endpointPhReadout?.idealEquivalencePh;
  const dispenseRecord = action?.id ? state.dropDispenses[action.id] : undefined;
  const initialMeasurementId = stringParam(action, "initialBuretteMeasurementId") ?? "burette-initial-volume";
  const initialReading =
    state.measurements.find((measurement) => measurement.id === initialMeasurementId)?.value ??
    numberParam(action, "initialBuretteReadingMl") ??
    0;
  const dropVolumeMl = numberParam(action, "dropVolumeMl") ?? 0.05;
  const endpointDropCount =
    dispenseRecord?.endpointDropCount ??
    Math.max(1, Math.round(numberParam(action, "endpointDropCount") ?? (numberParam(action, "volumeMl") ?? 0) / dropVolumeMl));
  const maxExtraDrops =
    dispenseRecord?.maxExtraDrops ??
    Math.max(0, Math.round(numberParam(action, "maxExtraDrops") ?? DEFAULT_TITRATION_MAX_EXTRA_DROPS));
  const dropsDispensed = dispenseRecord?.dropsDispensed ?? 0;
  const deliveredVolumeMl = dispenseRecord?.deliveredVolumeMl ?? dropsDispensed * dropVolumeMl;
  const currentReadingMl =
    dispenseRecord?.currentBuretteReadingMl ?? Math.round((initialReading + deliveredVolumeMl) * 100) / 100;
  const extraDrops = Math.max(0, dropsDispensed - endpointDropCount);
  const endpointReady = dropsDispensed >= endpointDropCount;
  const dispenseAccepted = Boolean(dispenseRecord?.accepted);
  const requiredTargetSnapZoneId = stringParam(action, "requiredTargetSnapZoneId");
  const dispenseSource = state.equipmentInstances.find(
    (instance) => instance.definitionId === interaction?.sourceDefinitionId,
  );
  const dispenseTarget = state.equipmentInstances.find(
    (instance) => instance.definitionId === interaction?.targetDefinitionId,
  );
  const sourceMount = dispenseSource
    ? state.attachments.find(
        (attachment) => attachment.childInstanceId === dispenseSource.id && attachment.relationType === "mounted",
      )
    : undefined;
  const receiverIsPositioned =
    !requiredTargetSnapZoneId ||
    Boolean(
      sourceMount &&
        dispenseTarget &&
        state.attachments.some(
          (attachment) =>
            attachment.childInstanceId === dispenseTarget.id &&
            attachment.parentInstanceId === sourceMount.parentInstanceId &&
            attachment.zoneId === requiredTargetSnapZoneId,
        ),
    );
  const canDispenseDrop =
    isDispenseDrops &&
    !configurationLock &&
    inputReady &&
    prerequisitesReady &&
    !nodeCompleted &&
    !dispenseAccepted &&
    receiverIsPositioned &&
    dropsDispensed < endpointDropCount + maxExtraDrops;
  const canAcceptDispenseEndpoint =
    isDispenseDrops &&
    !configurationLock &&
    inputReady &&
    prerequisitesReady &&
    !nodeCompleted &&
    endpointReady &&
    !dispenseAccepted;
  const endpointLabelText = stringParam(action, "endpointLabel") ?? "Configured endpoint";
  const overshootLabelText =
    stringParam(action, "overshootLabel") ?? "The configured endpoint has been exceeded; restart with a fresh trial.";
  const preEndpointInstruction =
    stringParam(action, "preEndpointInstruction") ??
    "Dispense one controlled increment, mix, and observe before continuing.";
  const repeatGroupId = stringParam(action, "repeatGroupId");
  const repeatIteration = numberParam(action, "repeatIteration");
  const repeatCount = numberParam(action, "repeatCount");
  const primaryActionLabel = action?.label ?? currentNode.title;
  const completionDescriptionId = `step-${currentNode.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-completion`;
  const inputHelpId = `${completionDescriptionId}-input-help`;
  const inputHasError = !inputResolution.valid && actionInputValue.trim().length > 0;
  const stepStatus = nodeCompleted
    ? "Complete"
    : configurationLock ||
        !inputReady ||
        unmetPrerequisiteCount > 0 ||
        missingRequiredEndpoint ||
        (isDispenseDrops && !receiverIsPositioned)
      ? "Blocked"
      : "Ready";
  const stepStatusDetail = nodeCompleted
    ? "Completion requirements are satisfied."
    : configurationLock
      ? "Teacher approval is required."
      : unmetPrerequisiteCount > 0
        ? `${unmetPrerequisiteCount} prerequisite${unmetPrerequisiteCount === 1 ? " remains" : "s remain"}.`
        : !inputReady
          ? "A valid response is required."
          : missingRequiredEndpoint
            ? "Select the required source and target."
            : isDispenseDrops && !receiverIsPositioned
              ? "Position the receiver before dispensing."
              : canConfirm && sourceRequired && targetRequired
                ? "Source and target are selected."
                : canConfirm && sourceRequired
                  ? "Source is selected."
                  : canConfirm && targetRequired
                    ? "Target is selected."
                    : "Ready for the current action.";
  const readyStatusLabel =
    action?.verb === "measureVolume" ? "Ready to measure" : "Ready for the current action";
  const processEntries = process.nodes.map((node, index) => ({ node, index }));
  const orderedProcessEntries = [
    ...processEntries.filter(({ node }) => node.id === state.currentNodeId),
    ...processEntries.filter(({ node }) => node.id !== state.currentNodeId),
  ];
  const visibleProcessEntries = hybrid && activeTab === "now"
    ? orderedProcessEntries.filter(({ node }) => node.id === state.currentNodeId)
    : orderedProcessEntries;

  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.scrollTop = 0;
  }, [state.currentNodeId]);

  return (
    <aside
      className={hybrid ? `process-sidebar is-${activeTab}-tab` : "process-sidebar is-legacy-layout"}
      aria-label="Process and current step"
      data-gesture-scroll-kind="process"
      data-gesture-scroll-region="vertical"
      ref={sidebarRef}
    >
      <TitrationCurveEvidence state={state} />
      {hybrid ? <div className="process-inspector-tabs" role="tablist" aria-label="Student workspace inspector">
        {(["now", "process", "evidence"] as const).map((tab) => (
          <button
            aria-controls={`student-player-${tab}-panel`}
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : undefined}
            id={`student-player-${tab}-tab`}
            key={tab}
            onClick={() => onTabChange?.(tab)}
            role="tab"
            tabIndex={activeTab === tab ? 0 : -1}
            type="button"
            onKeyDown={(event) => {
              const tabs = ["now", "process", "evidence"] as const;
              const currentIndex = tabs.indexOf(tab);
              const nextIndex = event.key === "ArrowRight"
                ? (currentIndex + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (currentIndex + tabs.length - 1) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : -1;
              if (nextIndex < 0) return;
              event.preventDefault();
              onTabChange?.(tabs[nextIndex]);
              requestAnimationFrame(() => {
                document.getElementById(`student-player-${tabs[nextIndex]}-tab`)?.focus();
              });
            }}
          >
            <span>{tab === "now" ? "Now" : tab === "process" ? "Process" : "Evidence"}</span>
            {tab === "evidence" ? <span className="process-tab-count">{evidenceCount}</span> : null}
          </button>
        ))}
      </div> : (
        <div className="panel-heading">
          <h2>Process</h2>
          <span>Progress: {state.completedNodes.length} completed / {process.nodes.length} total</span>
        </div>
      )}
      {hybrid && activeTab === "evidence" ? (
        <section
          aria-labelledby="student-player-evidence-tab"
          className="process-evidence-panel"
          id="student-player-evidence-panel"
          role="tabpanel"
        >
          {evidenceContent}
        </section>
      ) : (
      <section
        aria-labelledby={`student-player-${activeTab}-tab`}
        className="process-inspector-panel"
        id={`student-player-${activeTab}-panel`}
        role="tabpanel"
      >
      {hybrid && activeTab === "process" ? (
        <div className="panel-heading process-overview-heading">
          <h2>Process</h2>
          <span>{state.completedNodes.length} completed / {process.nodes.length} total</span>
        </div>
      ) : null}
      <ol className="process-list">
        {visibleProcessEntries.map(({ node, index }) => {
          const isCurrent = state.currentNodeId === node.id;
          const isComplete = state.completedNodes.includes(node.id);
          const primaryInstruction = node.description || interaction?.accessibleLabel || "Review the process map.";
          const visibleHints = showGuidance
            ? nonRedundantHints(node.hints, primaryInstruction, interaction?.accessibleLabel)
            : [];
          return (
            <li
              aria-current={isCurrent ? "step" : undefined}
              className={[
                "process-step",
                isCurrent ? "is-current" : "",
                isComplete ? "is-complete" : "",
              ].join(" ")}
              key={node.id}
            >
              <div className="process-step-summary">
                <span className="process-step-marker" aria-hidden="true">
                  {isComplete ? (
                    <CheckCircle2 size={16} />
                  ) : isCurrent ? (
                    <CircleDot size={16} />
                  ) : (
                    <Circle size={16} />
                  )}
                </span>
                <span className="process-step-kicker">
                  {index + 1} {node.type}
                </span>
                <strong><ScientificText text={node.title} /></strong>
              </div>
              {isCurrent && (!hybrid || activeTab === "now") ? (
                <div className="current-step-detail">
                  <header className="atomic-step-header">
                    {hybrid ? (
                      <>
                        <div className="atomic-step-progress">
                          <span>Step {index + 1} of {process.nodes.length}</span>
                          <strong>{state.completedNodes.length} completed</strong>
                          <progress
                            aria-label={`${state.completedNodes.length} of ${process.nodes.length} steps completed`}
                            max={process.nodes.length}
                            value={state.completedNodes.length}
                          />
                        </div>
                        <h3 tabIndex={-1}><ScientificText text={currentNode.title} /></h3>
                      </>
                    ) : (
                      <div>
                        <span>Step {index + 1} of {process.nodes.length}</span>
                        <h3 tabIndex={-1}><ScientificText text={primaryActionLabel} /></h3>
                      </div>
                    )}
                    <p
                      className={`atomic-step-state is-${stepStatus.toLowerCase()}`}
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <strong>{stepStatus}</strong>
                      <span>{stepStatusDetail}</span>
                    </p>
                  </header>
                  <details
                    className="atomic-action-contract"
                    aria-label={`Current action: ${primaryActionLabel}`}
                    key={currentNode.id}
                    open={!hybrid}
                  >
                    <summary>Action details</summary>
                    <div className="atomic-action-primary">
                      <span>Action 1 of 1</span>
                      <strong><ScientificText text={primaryActionLabel} /></strong>
                    </div>
                    <dl className="atomic-action-metadata">
                      <div>
                        <dt>Interaction</dt>
                        <dd><ScientificText text={interactionLabel(interaction)} /></dd>
                      </div>
                      <div>
                        <dt>Evidence</dt>
                        <dd><ScientificText text={authoredEvidenceLabel(action)} /></dd>
                      </div>
                      <div>
                        <dt>Prerequisites</dt>
                        <dd>
                          {actionPrerequisites.length === 0
                            ? "None"
                            : `${prerequisitesMet} of ${actionPrerequisites.length} satisfied`}
                        </dd>
                      </div>
                    </dl>
                    <p className="atomic-completion-rule" id={completionDescriptionId}>
                      <strong>Complete when</strong>
                      <span><ScientificText text={completionStatement(currentNode, primaryActionLabel)} /></span>
                    </p>
                  </details>
                  {repeatGroupId && repeatIteration && repeatCount ? (
                    <p className="step-repeat-status">
                      Repeat {repeatIteration} of {repeatCount}
                      {state.repeatProgress[repeatGroupId]?.complete ? " complete" : ""}
                    </p>
                  ) : null}
                  {showGuidance ? (
                    <div className="step-instruction-stack" aria-label="Step instructions">
                      <p className="step-affordance">
                        <strong>Do this</strong>
                        <span><ScientificText text={primaryInstruction} /></span>
                      </p>
                      {visibleHints.length ? (
                        <ul className="step-hints" aria-label="Step guidance">
                          {visibleHints.slice(0, 2).map((hint) => (
                            <li key={hint}><ScientificText text={hint} /></li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  {previewNotice ? (
                    <p className="step-preview-note" role="status">
                      {previewNotice}
                    </p>
                  ) : null}
                  {configurationLock ? (
                    <div className="step-recovery" role="status" aria-label="Teacher approval required">
                      <AlertTriangle size={16} aria-hidden="true" />
                      <p>
                        <strong><ScientificText text={configurationLock.message} /></strong>
                        <span><ScientificText text={configurationLock.recovery} /></span>
                      </p>
                    </div>
                  ) : null}
                  {canConfirm ? (
                    <div
                      className={[
                        "step-control",
                        showEndpointVisuals ? "step-endpoint-control" : "",
                        isDragToZone && hybrid ? "step-drag-control" : "",
                      ].filter(Boolean).join(" ")}
                      aria-label="Accessible action flow"
                    >
                      {!showEndpointVisuals ? <span>{interactionLabel(interaction)}</span> : null}
                      <dl className="step-selection-grid">
                        <div className="step-selection-endpoint">
                          {showEndpointVisuals ? endpointArt(sourceEndpoint) : null}
                          <dt>Source</dt>
                          <dd className={sourceEndpoint.missing ? "is-missing" : undefined}>
                            <ScientificText text={sourceEndpoint.label} />
                          </dd>
                        </div>
                        {hybrid ? <ArrowRight className="step-selection-direction" size={18} aria-hidden="true" /> : null}
                        <div className="step-selection-endpoint">
                          {showEndpointVisuals ? endpointArt(targetEndpoint) : null}
                          <dt>Target</dt>
                          <dd className={targetEndpoint.missing ? "is-missing" : undefined}>
                            <ScientificText text={targetEndpoint.label} />
                          </dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        data-gesture-action="confirm-accessible-action"
                        disabled={
                          Boolean(configurationLock) ||
                          !inputReady ||
                          !prerequisitesReady ||
                          nodeCompleted ||
                          missingRequiredEndpoint
                        }
                        onClick={onConfirmAccessibleAction}
                      >
                        {action?.verb === "measureVolume" ? (
                          <Ruler size={16} aria-hidden="true" />
                        ) : (
                          <Keyboard size={16} aria-hidden="true" />
                        )}{" "}
                        <ScientificText text={accessibleActionButtonLabel(action, interaction)} />
                      </button>
                      {showEndpointVisuals ? (
                        <p className={`step-control-status is-${stepStatus.toLowerCase()}`}>
                          {stepStatus === "Blocked" ? (
                            <AlertTriangle size={17} aria-hidden="true" />
                          ) : (
                            <CheckCircle2 size={17} aria-hidden="true" />
                          )}
                          <span>
                            {stepStatus === "Ready"
                              ? <ScientificText text={readyStatusLabel} />
                              : <ScientificText text={stepStatusDetail} />}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {inputField ? (
                    <div
                      className="step-control action-input-control"
                      aria-label={
                        inputField.role === "teacherConfiguration"
                          ? "Classroom configuration"
                          : "Student response"
                      }
                    >
                      <span>
                        {inputField.role === "teacherConfiguration"
                          ? "Classroom configuration"
                          : "Student response"}
                      </span>
                      <label>
                        <strong><ScientificText text={inputField.label} /></strong>
                        {inputField.mode === "choice" ? (
                          <select
                            aria-describedby={inputHelpId}
                            aria-invalid={inputHasError || undefined}
                            disabled={!prerequisitesReady || nodeCompleted}
                            value={actionInputValue}
                            onChange={(event) => onActionInputChange(event.target.value)}
                          >
                            <option value="">Select an option</option>
                            {inputField.options.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="action-input-value">
                            <input
                              aria-describedby={inputHelpId}
                              aria-invalid={inputHasError || undefined}
                              disabled={!prerequisitesReady || nodeCompleted}
                              type={inputField.mode === "numeric" ? "number" : "text"}
                              inputMode={inputField.mode === "numeric" ? "decimal" : undefined}
                              min={inputField.min}
                              max={inputField.max}
                              step={inputField.step ?? (inputField.mode === "numeric" ? "any" : undefined)}
                              value={actionInputValue}
                              onChange={(event) => onActionInputChange(event.target.value)}
                            />
                            {inputField.unit ? <small>{inputField.unit}</small> : null}
                          </span>
                        )}
                      </label>
                      {inputHasError ? (
                        <small className="is-warning" id={inputHelpId} role="alert">
                          {inputResolution.error}
                        </small>
                      ) : (
                        <small id={inputHelpId}>
                          {inputField.role === "teacherConfiguration"
                            ? "Kept only for this lab session and cleared by Reset."
                            : "Enter your own response before completing this step."}
                        </small>
                      )}
                    </div>
                  ) : null}
                  {isDispenseDrops ? (
                    <div className="step-control titration-dispense-control" aria-label="Stopcock dispense action">
                      <span>Stopcock</span>
                      <strong>{dropsDispensed} controlled increment{dropsDispensed === 1 ? "" : "s"}</strong>
                      <small>
                        {deliveredVolumeMl.toFixed(2)} mL delivered · burette {currentReadingMl.toFixed(2)} mL
                      </small>
                      {endpointReady ? (
                        <small className={extraDrops > 0 ? "is-warning" : "is-success"}>
                          <ScientificText text={extraDrops > 0 ? overshootLabelText : endpointLabelText} />
                        </small>
                      ) : (
                        <small><ScientificText text={preEndpointInstruction} /></small>
                      )}
                      {!receiverIsPositioned ? (
                        <small className="is-warning">
                          Place the receiving flask beneath the burette before opening the stopcock.
                        </small>
                      ) : null}
                      <div className="titration-dispense-actions">
                        <button
                          type="button"
                          data-gesture-action="dispense-drop"
                          disabled={!canDispenseDrop}
                          onClick={onDispenseDrop}
                        >
                          <Droplet size={16} aria-hidden="true" /> Dispense one increment
                        </button>
                        <button
                          type="button"
                          data-gesture-action="accept-endpoint"
                          disabled={!canAcceptDispenseEndpoint}
                          onClick={onAcceptDispenseEndpoint}
                        >
                          Accept endpoint
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {buretteReading ? (
                    <BuretteReadout label={buretteReading.label} volumeMl={buretteReading.value} />
                  ) : null}
                  {endpointPhStep ? (
                    <section
                      className="endpoint-ph-readout"
                      aria-label="Endpoint pH simulator readout"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <div className="endpoint-ph-readout-heading">
                        <span>pH console</span>
                        <strong>Ideal simulator prediction</strong>
                      </div>
                      <dl>
                        <div>
                          <dt>Accepted endpoint</dt>
                          <dd>
                            {endpointPhMeasurement
                              ? endpointPhMeasurement.value.toFixed(endpointPhPrecision)
                              : "Awaiting probe read"}
                            {endpointPhReadout?.acceptedTitrantVolumeMl !== undefined ? (
                              <small>at {endpointPhReadout.acceptedTitrantVolumeMl.toFixed(2)} mL delivered</small>
                            ) : null}
                          </dd>
                        </div>
                        <div>
                          <dt>Expected equivalence</dt>
                          <dd>
                            {idealEquivalencePh === undefined
                              ? "—"
                              : idealEquivalencePh.toFixed(endpointPhPrecision)}
                            {idealEquivalenceVolumeMl === undefined ? null : (
                              <small>at {idealEquivalenceVolumeMl.toFixed(2)} mL ideal volume</small>
                            )}
                          </dd>
                        </div>
                      </dl>
                      <p>
                        Unit: pH. Calculated from the accepted delivered volume; it is not a real
                        meter measurement. Laboratory readings may vary with temperature, activities,
                        calibration, ionic strength, and probe condition.
                      </p>
                    </section>
                  ) : null}
                  {canRecord && recordEvidence ? (
                    <div className="step-control" aria-label="Notebook record action">
                      <span>{action?.extractionOperation ? "Ready for configured operation" : "Ready to record"}</span>
                      <strong><ScientificText text={action.label} /></strong>
                      <small>{formatEvidenceValue(recordEvidence.value, recordEvidence.unit)}</small>
                      <button type="button" data-gesture-action="record-evidence" onClick={onRecordEvidence}>
                        <ScientificText text={action.label} />
                      </button>
                    </div>
                  ) : null}
                  {canRecordObservation && action ? (
                    <div className="step-control" aria-label="Observation record action">
                      <span>{action?.extractionOperation ? "Ready for configured operation" : "Ready to record"}</span>
                      <strong><ScientificText text={action.label} /></strong>
                      <button type="button" data-gesture-action="record-evidence" onClick={onRecordEvidence}>
                        <ScientificText text={action.label} />
                      </button>
                    </div>
                  ) : null}
                  {canRecordTimeSeries ? (
                    <div className="step-control kinetics-record-control" aria-label="Timed gas data record action">
                      <span>Gas syringe readings</span>
                      <strong><ScientificText text={action.label} /></strong>
                      <small>0-45 s CO2 volume table</small>
                      <button type="button" data-gesture-action="record-time-series" onClick={onRecordTimeSeries}>
                        Record timed gas data
                      </button>
                    </div>
                  ) : null}
                  {canSubmitCalculation ? (
                    <div className="step-control" aria-label="Calculation submit action">
                      <span>Ready to calculate</span>
                      <strong><ScientificText text={action.label} /></strong>
                      <button type="button" data-gesture-action="submit-calculation" onClick={onSubmitCalculation}>
                        <ScientificText text={submitCalculationLabel(action.label)} />
                      </button>
                    </div>
                  ) : null}
                  {invalidFeedback ? (
                    <div className="step-recovery" role="alert">
                      <AlertTriangle size={16} aria-hidden="true" />
                      <p>
                        <strong><ScientificText text={invalidFeedback.message} /></strong>
                        <span><ScientificText text={invalidFeedback.recovery} /></span>
                      </p>
                    </div>
                  ) : null}
                  {showGuidance && action?.evidence.length ? (
                    <div className="step-evidence" aria-label="Step metadata">
                      {action.evidence.map((item) => (
                        <span key={item}><ScientificText text={item} /></span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      </section>
      )}
    </aside>
  );
};
