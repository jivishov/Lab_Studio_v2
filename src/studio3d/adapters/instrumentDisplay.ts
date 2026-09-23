import type { ActionDefinition, EquipmentInstance, RuntimeState } from "../../domain/types";
import { actionInputField } from "../../runtime/actionInputs";

/**
 * What an instrument's display may show (plan §2.4, D7; handoff G-1; displayPolicies.json).
 *
 * Every line comes from runtime state or from the definition, and carries its provenance:
 * - "teacher": a value that entered through a `teacherConfiguration` input;
 * - "bench": runtime state, for example a completed zero against the approved blank;
 * - "entry": the learner's own `studentResponse` value, shown as "Your entry";
 * - "simulated": a readout whose provenance is "simulator-generated" (the pH meter, later packs).
 * Nothing here ever computes or invents a mass, %T or absorbance.
 */
export type DisplayLineSource = "teacher" | "bench" | "entry" | "simulated";

export interface DisplayLine {
  key: string;
  text: string;
  source: DisplayLineSource;
}

export interface InstrumentDisplayModel {
  instanceId: string;
  policy: string;
  lines: DisplayLine[];
}

interface DefinitionWithActions {
  actions: ActionDefinition[];
}

const str = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const THIN = " ";

/** Actions whose parameters name this instrument instance. */
const actionsFor = (definition: DefinitionWithActions, instanceId: string): ActionDefinition[] =>
  definition.actions.filter((action) =>
    [action.parameters.photometerInstanceId, action.parameters.targetInstanceId, action.parameters.instrumentInstanceId]
      .some((value) => value === instanceId));

/** The measurement an action writes, if it writes one. */
const outputMeasurementId = (action: ActionDefinition): string | undefined =>
  (action.mass && "outputMeasurementId" in action.mass ? action.mass.outputMeasurementId : undefined)
  ?? action.volume?.outputMeasurementId
  ?? str(action.parameters.measurementId);

const formatValue = (value: number, unit: string): string => `${value}${unit ? `${THIN}${unit}` : ""}`;

/** Learner entries: measurements written by a studentResponse input on an action naming the instrument. */
const learnerEntryLines = (definition: DefinitionWithActions, state: RuntimeState, instanceId: string): DisplayLine[] =>
  actionsFor(definition, instanceId)
    .filter((action) => actionInputField(action)?.role === "studentResponse")
    .flatMap((action) => {
      const id = outputMeasurementId(action);
      const measurement = id ? state.measurements.find((m) => m.id === id) : undefined;
      return measurement
        ? [{ key: `entry:${measurement.id}`, text: formatValue(measurement.value, measurement.unit), source: "entry" as const }]
        : [];
    });

const photometerLines = (definition: DefinitionWithActions, state: RuntimeState, instance: EquipmentInstance): DisplayLine[] => {
  const actions = actionsFor(definition, instance.id);
  const lines: DisplayLine[] = [];
  // Configured wavelength: the measurement a teacherConfiguration input wrote for this instrument.
  let wavelengthNm: number | undefined;
  for (const action of actions) {
    if (actionInputField(action)?.role !== "teacherConfiguration") continue;
    const id = outputMeasurementId(action);
    const measurement = id ? state.measurements.find((m) => m.id === id) : undefined;
    if (measurement && measurement.unit === "nm") {
      wavelengthNm = measurement.value;
      lines.push({ key: "wavelength", text: formatValue(measurement.value, "nm"), source: "teacher" });
    }
  }
  const calibration = state.photometerCalibration?.[instance.id];
  if (wavelengthNm === undefined && calibration?.configuredWavelengthNm !== undefined) {
    wavelengthNm = calibration.configuredWavelengthNm;
    lines.push({ key: "wavelength", text: formatValue(wavelengthNm, "nm"), source: "bench" });
  }
  // Mode: shown once the step that applies it is complete; its quantity comes from the read step.
  const readAction = actions.find((action) => action.parameters.photometerOperation === "read");
  const configureDone = actions.some((action) =>
    actionInputField(action)?.role === "teacherConfiguration"
    && definitionNodeCompleted(definition, state, action.id));
  if (configureDone && readAction?.parameters.photometricQuantity === "percentTransmittance") {
    lines.push({ key: "mode", text: "%T", source: "bench" });
  }
  // Zeroed against the approved blank: the same evidence the runtime requires before a read.
  const zeroAction = actions.find((action) => action.parameters.photometerOperation === "zero");
  const zeroTag = str(zeroAction?.parameters.tag);
  const wavelengthTag = wavelengthNm === undefined ? undefined : `wavelength:${wavelengthNm}nm`;
  const zeroedByNotebook = zeroTag !== undefined && state.notebook.some((entry) =>
    entry.tags.includes(zeroTag) && (!wavelengthTag || entry.tags.includes(wavelengthTag)));
  const blankedByCalibration = calibration !== undefined
    && calibration.configurationGeneration !== undefined
    && calibration.blankedGeneration === calibration.configurationGeneration
    && (wavelengthNm === undefined || calibration.blankedWavelengthNm === wavelengthNm);
  if (zeroedByNotebook || blankedByCalibration) {
    lines.push({ key: "blank", text: "Zeroed on blank", source: "bench" });
  }
  return [...lines, ...learnerEntryLines(definition, state, instance.id)];
};

/** Whether the node that runs `actionId` is complete. */
const definitionNodeCompleted = (definition: DefinitionWithActions, state: RuntimeState, actionId: string): boolean => {
  const process = (definition as { process?: { nodes: Array<{ id: string; actionId?: string }> } }).process;
  return Boolean(process?.nodes.some((node) => node.actionId === actionId && state.completedNodes.includes(node.id)));
};

/** The display model for one instrument instance under its registry policy. */
export const instrumentDisplay = (
  policy: string,
  definition: DefinitionWithActions,
  state: RuntimeState,
  instance: EquipmentInstance,
): InstrumentDisplayModel => {
  let lines: DisplayLine[] = [];
  if (policy === "balance-status-and-entry") {
    // The runtime holds no balance status and simulates no mass: the face stays blank until the
    // learner's own entry exists (decision U4).
    lines = learnerEntryLines(definition, state, instance.id);
  } else if (policy === "photometer-settings-status-and-entry") {
    lines = photometerLines(definition, state, instance);
  } else if (policy === "simulator-readout") {
    const readout = instance.contents.instrumentReadout;
    if (readout?.provenance === "simulator-generated") {
      lines = [{ key: "readout", text: readout.value.toFixed(Math.max(0, Math.round(-Math.log10(readout.precision)))) + `${THIN}${readout.unit}`, source: "simulated" }];
    }
  }
  return { instanceId: instance.id, policy, lines };
};

/** Learner-facing chip text for each source (handoff §3.2). */
export const displaySourceLabel: Record<DisplayLineSource, string> = {
  teacher: "Teacher setting",
  bench: "From the bench",
  entry: "Your entry",
  simulated: "Simulated",
};
