import { v1InteractionZones } from "../../domain/interactionZones";
import type { ActionDefinition, EquipmentInstance, RuntimeState } from "../../domain/types";
import { actionInputField } from "../../runtime/actionInputs";

/**
 * What an instrument's display shows (displayPolicies.json; teacher-prepared readings, decided
 * 2026-09-25, replacing the measurement-neutral rule of plan §2.4 item 1 and handoff G-1).
 *
 * Every line comes from runtime state or from the teacher's setup, and carries its provenance:
 * - "teacher": a teacher setting, such as the wavelength, or a reading the teacher prepared (the
 *   mass the balance shows, a sample's %T);
 * - "bench": runtime state, for example a completed zero against the approved blank;
 * - "entry": the learner's own `studentResponse` value, shown as "Your entry";
 * - "simulated": a readout whose provenance is "simulator-generated" (the pH meter, later packs).
 * Nothing is simulated: a reading is what the teacher prepared, arrived at through the steps the
 * learner performed. The learner's entry stays their own and is never checked against it.
 */
export type DisplayLineSource = "teacher" | "bench" | "entry" | "simulated";

export interface DisplayLine {
  key: string;
  text: string;
  source: DisplayLineSource;
}

/** The key of the line an instrument shows as its reading, drawn large on the display face. */
export const READOUT_KEY = "readout";

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

/**
 * The approved empty masses of the vessels a balance pan accepts (decided 2026-09-25). A technique
 * sets its own with a `supportEmptyMassG` setting on the step that names the vessel; these apply
 * when it sets none.
 */
export const DEFAULT_EMPTY_MASS_G: Readonly<Record<string, number>> = Object.freeze({
  "watch-glass": 30,
  "weigh-boat": 1.5,
  "beaker-250ml": 100,
  "crucible-with-lid": 25,
});

const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** A vessel's empty mass: the technique's setting for that instance, else the approved default. */
const emptyMassG = (definition: DefinitionWithActions, instance: EquipmentInstance): number | undefined => {
  for (const action of definition.actions) {
    const p = action.parameters;
    const set = num(p.supportEmptyMassG);
    if (set !== undefined && (p.equipmentInstanceId === instance.id || p.sourceInstanceId === instance.id)) return set;
  }
  return DEFAULT_EMPTY_MASS_G[instance.definitionId];
};

/** Instances seated directly on `holder` in one of its own zones. */
const seatedOn = (state: RuntimeState, holder: EquipmentInstance, zoneIds: readonly string[]): EquipmentInstance[] =>
  state.attachments
    .filter((relation) => relation.parentInstanceId === holder.id && zoneIds.includes(relation.zoneId))
    .flatMap((relation) => state.equipmentInstances.filter((instance) => instance.id === relation.childInstanceId));

/**
 * What rests on an item, in grams: its empty mass, its solid contents, and whatever is seated on
 * it. Undefined when any part is unknown, such as a liquid (no density is assumed).
 */
const loadG = (definition: DefinitionWithActions, state: RuntimeState, item: EquipmentInstance, depth = 0): number | undefined => {
  if (depth > 6) return undefined;
  const empty = emptyMassG(definition, item);
  if (empty === undefined) return undefined;
  const contents = item.contents;
  const liquid = (contents.volumeMl ?? 0) > 0 && num(contents.massG) === undefined;
  if (liquid) return undefined;
  let total = empty + (num(contents.massG) ?? 0);
  for (const child of state.attachments.filter((relation) => relation.parentInstanceId === item.id)) {
    const instance = state.equipmentInstances.find((candidate) => candidate.id === child.childInstanceId);
    const load = instance ? loadG(definition, state, instance, depth + 1) : undefined;
    if (load === undefined) return undefined;
    total += load;
  }
  return total;
};

/** Decimal places from a step's input step, such as 0.001 g: the precision the technique sets. */
const decimalsOf = (step: unknown): number | undefined => {
  const value = num(step);
  if (value === undefined || value <= 0) return undefined;
  const text = String(value);
  return text.includes("e-") ? Number(text.split("e-")[1]) : (text.split(".")[1]?.length ?? 0);
};

/**
 * The balance's reading: the load on its pan, less the zero. The zero is the empty mass of the
 * support named by the latest completed zero step (`balanceOperation: "zero"`), which the step
 * takes with that support empty on the pan (its prerequisite and place in the procedure). The
 * precision is the input step of the technique's own weighing step for this balance.
 */
const balanceReadout = (definition: DefinitionWithActions, state: RuntimeState, instance: EquipmentInstance): DisplayLine | undefined => {
  const zones = v1InteractionZones.filter((zone) => zone.ownerDefinitionId === instance.definitionId && zone.relationType === "placedOn").map((zone) => zone.id);
  let gross = 0;
  for (const item of seatedOn(state, instance, zones)) {
    const load = loadG(definition, state, item);
    if (load === undefined) return undefined;
    gross += load;
  }
  const zero = [...definition.actions].reverse().find((action) => action.parameters.balanceOperation === "zero"
    && action.parameters.instrumentInstanceId === instance.id && definitionNodeCompleted(definition, state, action.id));
  const support = zero ? state.equipmentInstances.find((candidate) => candidate.id === zero.parameters.sourceInstanceId) : undefined;
  const offset = support ? emptyMassG(definition, support) ?? 0 : 0;
  const weigh = definition.actions.find((action) => action.verb === "weigh" && action.parameters.targetInstanceId === instance.id);
  const decimals = decimalsOf(weigh?.parameters.inputStep) ?? 3;
  const value = gross - offset;
  const shown = Math.abs(value) < 0.5 * 10 ** -decimals ? 0 : value;
  return { key: READOUT_KEY, text: `${shown.toFixed(decimals)}${THIN}g`, source: "teacher" };
};

const QUANTITY_UNIT: Record<string, string> = { percentTransmittance: "%T", absorbance: "A" };

/**
 * The photometer's reading, once it is zeroed on the blank: with the blank in the slot 100 %T (the
 * meaning of zeroing on it); with a sample, the reading the teacher prepared for that cuvette, in
 * the quantity its read step declares (`teacherPreparedReading`). Otherwise nothing.
 */
const photometerReadout = (definition: DefinitionWithActions, state: RuntimeState, instance: EquipmentInstance, zeroed: boolean): DisplayLine | undefined => {
  if (!zeroed) return undefined;
  const zones = v1InteractionZones.filter((zone) => zone.ownerDefinitionId === instance.definitionId).map((zone) => zone.id);
  const cuvette = seatedOn(state, instance, zones)[0];
  if (!cuvette) return undefined;
  const actions = actionsFor(definition, instance.id);
  const blank = actions.find((action) => action.parameters.photometerOperation === "zero");
  if (blank?.parameters.cuvetteInstanceId === cuvette.id) return { key: READOUT_KEY, text: `100${THIN}%T`, source: "bench" };
  const read = actions.find((action) => action.parameters.photometerOperation === "read" && action.parameters.cuvetteInstanceId === cuvette.id);
  const prepared = num(read?.parameters.teacherPreparedReading);
  const unit = QUANTITY_UNIT[String(read?.parameters.photometricQuantity)];
  if (prepared === undefined || !unit) return undefined;
  return { key: READOUT_KEY, text: unit === "A" ? `A${THIN}${prepared}` : `${prepared}${THIN}${unit}`, source: "teacher" };
};

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
  // A reading the teacher prepared replaces the learner's entry on the face (a plain number, as on
  // a real instrument); the entry stays in the step card, the notebook and the results.
  const readout = photometerReadout(definition, state, instance, zeroedByNotebook || blankedByCalibration);
  return readout ? [...lines, readout] : [...lines, ...learnerEntryLines(definition, state, instance.id)];
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
    // The mass on the pan, as the teacher prepared it; the learner's entry when it cannot be known.
    const readout = balanceReadout(definition, state, instance);
    lines = readout ? [readout] : learnerEntryLines(definition, state, instance.id);
  } else if (policy === "oven-setpoint") {
    // The setting the student made with the dial (Pack 2): runtime state, never a simulated temperature.
    const setpoint = state.apparatusStates?.[instance.id]?.setpointC;
    lines = typeof setpoint === "number" ? [{ key: READOUT_KEY, text: `${setpoint}${THIN}°C`, source: "bench" }] : [];
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

/** The reading an instrument shows now, if it shows one (for the results' "Display showed"). */
export const displayedReading = (model: InstrumentDisplayModel): string | undefined =>
  model.lines.find((line) => line.key === READOUT_KEY)?.text;

/**
 * What the instrument a learner reads showed as the reading was committed: the measurement the
 * step records, and the display's reading at that moment. For the results' "Display showed"; it is
 * session state only (G-13), and nothing compares it with the entry.
 */
export const readingShownFor = (
  definition: DefinitionWithActions,
  state: RuntimeState,
  action: ActionDefinition,
  policyOf: (definitionId: string) => string | undefined,
): { measurementId: string; text: string } | undefined => {
  if (actionInputField(action)?.role !== "studentResponse") return undefined;
  const measurementId = outputMeasurementId(action);
  const instrumentId = [action.parameters.photometerInstanceId, action.parameters.targetInstanceId, action.parameters.instrumentInstanceId]
    .find((value): value is string => typeof value === "string");
  const instance = instrumentId ? state.equipmentInstances.find((candidate) => candidate.id === instrumentId) : undefined;
  const policy = instance ? policyOf(instance.definitionId) : undefined;
  if (!measurementId || !instance || !policy) return undefined;
  const text = displayedReading(instrumentDisplay(policy, definition, state, instance));
  return text ? { measurementId, text } : undefined;
};

/** Learner-facing chip text for each source (handoff §3.2). */
export const displaySourceLabel: Record<DisplayLineSource, string> = {
  teacher: "Teacher setting",
  bench: "From the bench",
  entry: "Your entry",
  simulated: "Simulated",
};
