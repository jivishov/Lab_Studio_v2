import { executeTitrationStep } from "./titrationProcedure";
import {
  emptyContents,
  type ActionDefinition,
  type ActionMassConsumerContinuity,
  type AttemptRecord,
  type ChromatographyModelDefinition,
  type ContentState,
  type DataSeriesPoint,
  type DataSeriesRecord,
  type DropDispenseColorState,
  type DropDispenseRecord,
  type EquipmentInstance,
  type KineticsModelDefinition,
  type PrecipitateState,
  type ProcessEdge,
  type PhotometerCalibrationState,
  type RuntimeActionRequest,
  type RuntimeFeedback,
  type RuntimeState,
  type TemperatureEvidenceKind,
} from "../domain/types";
import {
  calculateAcidBasePh,
  DEFAULT_TITRATION_MAX_EXTRA_DROPS,
  deriveTitrationDropPlan,
  findTitrationModel,
} from "../domain/titrationModels";
import { equipmentRoleById } from "../domain/atomRegistry";
import { equipmentById } from "../equipment/catalog";
import { instanceSwapCompositeFor } from "../equipment/composites";
import {
  attachmentsForChild,
  canAttach,
  childAttachmentByRelation,
  closedChamberAccessRefusal,
  detachChild,
  validateActionAttachmentState,
  moveLockedChildren,
  upsertAttachment,
  withResolvedAttachments,
  zoneOccupancy,
} from "./attachments";
import {
  calculateAbsorbanceFromDecimalT,
  calculateAbsorbanceFromPercentT,
  calculateAcidBaseMolarity,
  calculateChromatographyRf,
  calculateCalciumCarbonateTheoreticalMassG,
  calculateCarbonateMassLossComposition,
  calculateComponentMassPercent,
  calculateDecimalTransmittance,
  calculateDilutedConcentration,
  calculateDilutedConcentrationMicromolar,
  calculateGravimetricPrecipitateMassG,
  calculateHardnessMgLAsCaCO3,
  calculateHydrogenPeroxidePercent,
  calculateInitialRateMlPerS,
  calculateConcentrationSeries,
  calculateConcentrationFromRegression,
  calculateCopperMassG,
  calculateDilutionAliquotMl,
  calculateLinearRegression,
  calculateMeanOfValues,
  calculateMassPercent,
  calculateNitricAcidVolumeMl,
  calculatePercentDifference,
  calculatePermanganateMolarityFromIron,
  calculateTotalPercentRecovery,
  calculateVisualComparisonConcentration,
  generateGasVolumeSeries,
  generateTemperatureResponse,
  HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL,
  isPhotometricQuantity,
  isWithinTolerance,
  PHOTOMETRIC_UNITS,
  photometricValueInRange,
  quantiseRulerReadingMm,
  transformRegressionSeries,
  WATER_DENSITY_G_PER_ML,
  WATER_SPECIFIC_HEAT_J_PER_G_C,
} from "./calculations";
import { actionInputRequestError } from "./actionInputs";
import {
  isOrdinaryLiquidContent,
  legacySolidInventoryMassG,
  mergeTransferredSolid,
  normalizeSolidTransferContract,
  physicalSolidTransferTargetError,
  mergeTransferredContents as mergeTransferredContentsBase,
  splitSolidForMass,
  splitContentForVolume,
  wholeRemainingSolidEligibility,
} from "./contentTransfer";
import {
  configuredSolidStockContents,
  transferSolid,
  type SolidTransferRequest,
} from "./solidMaterial";
import {
  createRuntimeState,
  getActions,
  getProcess,
  type RuntimeDefinition,
} from "./createRuntime";
import { configurationLockFor } from "./configurationGate";
import {
  currentEvidenceScopeGeneration,
  evaluateNode,
  evaluateRule,
  findCurrentContinuityMeasurement,
  measurementMatchesContinuity,
} from "./validation";

type ActionResult =
  | {
      ok: true;
      nextNodeId?: string;
      state: RuntimeState;
      message: string;
    }
  | {
      ok: false;
      state: RuntimeState;
      message: string;
      recovery: string;
    };

const cloneContent = (content: ContentState): ContentState => ({
  ...content,
    solutes: content.solutes.map((solute) => ({ ...solute })),
    contamination: [...content.contamination],
    concentration: content.concentration ? { ...content.concentration } : undefined,
    precipitate: content.precipitate ? { ...content.precipitate } : undefined,
    chromatogram: content.chromatogram
      ? {
          ...content.chromatogram,
          bands: content.chromatogram.bands.map((band) => ({ ...band })),
        }
      : undefined,
    instrumentReadout: content.instrumentReadout ? { ...content.instrumentReadout } : undefined,
    qualitativeSolidProvenance: content.qualitativeSolidProvenance?.map((record) => ({
      ...record,
      measurementEvidenceIds: [...record.measurementEvidenceIds],
      recoveryEvidenceIds: [...record.recoveryEvidenceIds],
      routeEvidenceIds: [...record.routeEvidenceIds],
    })),
});

const syncContents = (instances: EquipmentInstance[]): Record<string, ContentState> =>
  Object.fromEntries(instances.map((item) => [item.id, item.contents]));

const timestamp = () => new Date().toISOString();

const feedback = (
  severity: RuntimeFeedback["severity"],
  message: string,
  nodeId?: string,
  recovery?: string,
): RuntimeFeedback => ({
  id: `${severity}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  timestamp: timestamp(),
  severity,
  message,
  nodeId,
  recovery,
});

const firstByDefinition = (
  state: RuntimeState,
  definitionId?: string,
): EquipmentInstance | undefined =>
  definitionId
    ? state.equipmentInstances.find((instance) => instance.definitionId === definitionId)
    : undefined;

const firstShelfByDefinition = (
  state: RuntimeState,
  definitionId?: string,
): EquipmentInstance | undefined =>
  definitionId
    ? state.equipmentInstances.find(
        (instance) => instance.definitionId === definitionId && instance.location === "shelf",
      )
    : undefined;

const isFilterTargetDefinition = (definitionId: string): boolean =>
  equipmentById.get(definitionId)?.affordances.includes("filterTarget") ?? false;

const isSeatedInFilterTarget = (state: RuntimeState, childInstanceId: string): boolean =>
  attachmentsForChild(state, childInstanceId).some((attachment) => {
    if (attachment.relationType !== "inserted") return false;
    const parent = state.equipmentInstances.find((instance) => instance.id === attachment.parentInstanceId);
    return parent ? isFilterTargetDefinition(parent.definitionId) : false;
  });

const numericParameter = (
  parameters: RuntimeActionRequest["parameters"] | undefined,
  key: string,
): number | undefined => {
  const value = parameters?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const roundToInstrumentMl = (value: number): number => Math.round(value * 100) / 100;

const roundToRuntimeMl = (value: number): number => Number(value.toFixed(10));

const DEFAULT_RINSE_VOLUME_ML = 5;

const numberSetting = (
  params: Record<string, string | number | boolean | string[] | undefined>,
  key: string,
  fallback: number,
): number => {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const stringSetting = (
  params: Record<string, string | number | boolean | string[] | undefined>,
  key: string,
): string | undefined => {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const booleanSetting = (
  params: Record<string, string | number | boolean | string[] | undefined>,
  key: string,
): boolean => params[key] === true;

const stringArraySetting = (
  params: Record<string, string | number | boolean | string[] | undefined>,
  key: string,
): string[] => {
  const value = params[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

const allowedContentKinds = new Set<ContentState["kind"]>([
  "empty",
  "liquid",
  "solid",
  "solution",
  "mixture",
  "precipitate",
]);

const contentKindSetting = (
  params: Record<string, string | number | boolean | string[] | undefined>,
  key: string,
  fallback: ContentState["kind"],
): ContentState["kind"] => {
  const value = stringSetting(params, key);
  return value && allowedContentKinds.has(value as ContentState["kind"])
    ? (value as ContentState["kind"])
    : fallback;
};

const prefixedChromatographyMeasurementId = (
  measurementPrefix: string | undefined,
  kind: "solvent-front" | "band",
  bandId?: string,
): string => {
  if (kind === "solvent-front") {
    return measurementPrefix ? `${measurementPrefix}-solvent-front` : "chromatography-solvent-front";
  }
  return measurementPrefix && bandId ? `${measurementPrefix}-band-${bandId}` : `chromatography-band-${bandId ?? ""}`;
};

/**
 * The distance a ruler would actually read off a developed strip, or a reason it cannot be read yet.
 *
 * The value comes from the strip's own developed state, never from the action's parameters, so no
 * authored content can pre-supply a band or solvent-front distance. The chronology gates are the
 * ones Investigation 5 states: the front is marked while the paper is still wet (TR-10, M/R) and the
 * paper is dry before the ruler is aligned against it (§7's invalid-feedback list).
 */
const chromatographyRulerReading = (
  paper: EquipmentInstance,
  measurementType: string,
  bandId: string | undefined,
): { ok: true; value: number; label: string } | { ok: false; message: string; recovery: string } => {
  const chromatogram = paper.contents.chromatogram;
  if (!chromatogram || chromatogram.solventFrontMm === undefined) {
    return {
      ok: false,
      message: "That paper has not been developed, so there is nothing to measure.",
      recovery: "Develop the chromatogram in the sealed chamber before measuring any distance.",
    };
  }
  if (chromatogram.solventFrontMarked === false) {
    return {
      ok: false,
      message: "The solvent front has not been marked on this chromatogram.",
      recovery: "Mark the solvent front in pencil while the paper is still wet; measurements are taken from the origin to that mark.",
    };
  }
  if (paper.contents.wetState !== "dry") {
    return {
      ok: false,
      message: "The chromatogram is still wet.",
      recovery: "Let the marked paper dry flat before aligning the ruler: bands keep moving and smearing while the paper is wet.",
    };
  }
  if (measurementType === "solventFront") {
    return { ok: true, value: chromatogram.solventFrontMm, label: "Solvent front distance" };
  }
  if (measurementType !== "band") {
    return {
      ok: false,
      message: `Unsupported chromatography measurement type "${measurementType}".`,
      recovery: "Measure either the solvent front or one visible band.",
    };
  }
  const band = bandId ? chromatogram.bands.find((candidate) => candidate.id === bandId) : undefined;
  if (!band) {
    return {
      ok: false,
      message: "That band is not visible on this chromatogram.",
      recovery: "Measure only the bands this trial actually resolved, and record an unresolved overlap as one region rather than splitting it.",
    };
  }
  return { ok: true, value: band.distanceMm, label: `${band.label} band distance` };
};

const measurementValue = (
  state: RuntimeState,
  id: string | undefined,
): number | undefined => {
  if (!id) return undefined;
  const value = state.measurements.find((measurement) => measurement.id === id)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

/**
 * The value a named earlier calculation produced.
 *
 * Investigation 1 converts %T to decimal T in one step and then discusses `-log T` of that decimal,
 * so the second calculation's operand is the first calculation's result rather than a balance or
 * instrument reading. Cycle 06.
 */
const calculationValue = (
  state: RuntimeState,
  id: string | undefined,
): number | undefined => {
  if (!id) return undefined;
  const value = state.calculations.find((calculation) => calculation.id === id)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const evidenceRecord = (
  state: RuntimeState,
  reference: { source: "measurement" | "calculation"; referenceId: string },
): { id: string; value: number; unit: string } | undefined => {
  const record = reference.source === "measurement"
    ? state.measurements.find((entry) => entry.id === reference.referenceId)
    : state.calculations.find((entry) => entry.id === reference.referenceId && entry.passed === true);
  return record && Number.isFinite(record.value) && typeof record.unit === "string" && record.unit.length > 0
    ? record
    : undefined;
};

type ResolvedVolume =
  | { ok: true; deliveredVolumeMl: number; finalTargetVolumeMl: number }
  | { ok: false; message: string; recovery: string };

/** Resolve only the typed opt-in contract. Legacy actions continue through their existing paths. */
const resolveContractedVolume = (
  state: RuntimeState,
  request: RuntimeActionRequest,
  action: ActionDefinition,
  target: EquipmentInstance,
): ResolvedVolume => {
  const contract = action.volume;
  if (!contract) {
    return { ok: false, message: "This action has no typed volume contract.", recovery: "Author a volume contract before using the shared resolver." };
  }
  const currentVolumeMl = target.contents.volumeMl ?? 0;
  const targetDefinition = equipmentById.get(target.definitionId);
  const capacityMl = targetDefinition?.capacity.unit === "mL"
    ? targetDefinition.capacity.amount
    : undefined;
  let statedVolumeMl: number | undefined;
  if (contract.source === "action-input") statedVolumeMl = request.value;
  else if (contract.source === "literal") statedVolumeMl = contract.valueMl;
  else if (contract.source === "measurement") {
    const evidence = state.measurements.find((entry) => entry.id === contract.referenceId);
    if (!evidence || evidence.unit !== "mL") {
      return { ok: false, message: `Required volume measurement "${contract.referenceId}" is missing or not in mL.`, recovery: "Complete the named volume measurement before this action." };
    }
    statedVolumeMl = evidence.value;
  } else if (contract.source === "calculation") {
    const evidence = state.calculations.find((entry) => entry.id === contract.referenceId);
    if (!evidence || evidence.unit !== "mL") {
      return { ok: false, message: `Required volume calculation "${contract.referenceId}" is missing or not in mL.`, recovery: "Complete the named volume calculation before this action." };
    }
    statedVolumeMl = evidence.value;
  } else {
    if (!capacityMl || !Number.isFinite(capacityMl) || capacityMl <= 0) {
      return { ok: false, message: "The target has no usable mL capacity.", recovery: "Use a capacity-defined target for a fill-level volume contract." };
    }
    statedVolumeMl = contract.source === "target-fill-fraction"
      ? capacityMl * contract.fraction
      : capacityMl;
  }
  if (!Number.isFinite(statedVolumeMl) || (statedVolumeMl ?? 0) <= 0) {
    return { ok: false, message: "The resolved volume is not a positive finite value.", recovery: "Supply or record a positive volume before continuing." };
  }
  const treatsValueAsFinalLevel = action.verb === "dilute" ||
    contract.source === "target-fill-fraction" || contract.source === "target-remaining-capacity";
  const finalTargetVolumeMl = treatsValueAsFinalLevel
    ? statedVolumeMl!
    : currentVolumeMl + statedVolumeMl!;
  const deliveredVolumeMl = finalTargetVolumeMl - currentVolumeMl;
  if (!Number.isFinite(deliveredVolumeMl) || deliveredVolumeMl <= 0) {
    return { ok: false, message: "The target is already at or above the requested fill level.", recovery: "Use an emptier target or a higher valid final volume." };
  }
  if (capacityMl !== undefined && finalTargetVolumeMl > capacityMl + 1e-9) {
    return { ok: false, message: "The resolved volume would overflow the target.", recovery: "Use a larger target or a smaller measured volume." };
  }
  return { ok: true, deliveredVolumeMl, finalTargetVolumeMl };
};

const resolveContractedMassG = (
  state: RuntimeState,
  request: RuntimeActionRequest,
  action: ActionDefinition,
): number | undefined => {
  const contract = action.mass;
  if (!contract) return undefined;
  const continuity = contract.source === "action-input" || contract.source === "measurement"
    ? contract.continuity
    : undefined;
  const value = contract.source === "action-input" || contract.source === "configured-input"
    ? request.value
    : contract.source === "measurement" && contract.continuity
      ? findCurrentContinuityMeasurement(state, contract.referenceId, contract.continuity)?.value
      : state.measurements.find((entry) =>
          entry.id === contract.referenceId && entry.unit === "g")?.value;
  const isAllowed = continuity?.quantityKind === "balance-display"
    ? typeof value === "number" && Number.isFinite(value) && value >= 0
    : typeof value === "number" && Number.isFinite(value) && value > 0;
  return isAllowed ? value : undefined;
};

const producerContinuityFor = (
  actionDefinition: ActionDefinition,
): ActionMassConsumerContinuity | undefined => {
  const contract = actionDefinition.mass;
  if (contract?.source !== "action-input" || !contract.continuity) return undefined;
  return { ...contract.continuity, producerActionId: actionDefinition.id };
};

const gramSoluteMass = (content: ContentState): number | undefined => {
  const gramSolutes = content.solutes.filter((solute) => solute.unit === "g" && Number.isFinite(solute.amount));
  if (gramSolutes.length === 0) return undefined;
  return gramSolutes.reduce((sum, solute) => sum + solute.amount, 0);
};

const collectChromatographyModels = (definition: RuntimeDefinition): ChromatographyModelDefinition[] => [
  ...(definition.chromatographyModels ?? []),
  ...("techniques" in definition
    ? definition.techniques.flatMap((technique) => technique.chromatographyModels ?? [])
    : []),
];

const chromatographyModelFor = (
  definition: RuntimeDefinition,
  modelId: string | undefined,
): ChromatographyModelDefinition | undefined => {
  const models = collectChromatographyModels(definition);
  return modelId ? models.find((model) => model.id === modelId) : models[0];
};

const collectKineticsModels = (definition: RuntimeDefinition): KineticsModelDefinition[] => [
  ...(definition.kineticsModels ?? []),
  ...("techniques" in definition
    ? definition.techniques.flatMap((technique) => technique.kineticsModels ?? [])
    : []),
];

const kineticsModelFor = (
  definition: RuntimeDefinition,
  modelId: string | undefined,
): KineticsModelDefinition | undefined => {
  const models = collectKineticsModels(definition);
  return modelId ? models.find((model) => model.id === modelId) : models[0];
};

const findInstance = (
  state: RuntimeState,
  instanceId?: string,
  definitionId?: string,
): EquipmentInstance | undefined =>
  instanceId
    ? state.equipmentInstances.find((instance) => instance.id === instanceId)
    : firstByDefinition(state, definitionId);

const findBenchMoveInstance = (
  state: RuntimeState,
  instanceId?: string,
  definitionId?: string,
): EquipmentInstance | undefined =>
  instanceId
    ? state.equipmentInstances.find((instance) => instance.id === instanceId)
    : firstShelfByDefinition(state, definitionId) ?? firstByDefinition(state, definitionId);

const findParentForSnap = (
  state: RuntimeState,
  targetInstanceId: string | undefined,
  targetDefinitionId: string | undefined,
  snapZoneId: string | undefined,
): EquipmentInstance | undefined => {
  const explicit = findInstance(state, targetInstanceId, targetDefinitionId);
  if (explicit) return explicit;
  if (!snapZoneId) return undefined;
  for (const definition of equipmentById.values()) {
    if (!definition.snapZones.some((zone) => zone.id === snapZoneId)) continue;
    const parent = firstByDefinition(state, definition.id);
    if (parent) return parent;
  }
  return undefined;
};

const updateInstance = (
  state: RuntimeState,
  instanceId: string,
  update: (instance: EquipmentInstance) => EquipmentInstance,
): RuntimeState => {
  const equipmentInstances = state.equipmentInstances.map((instance) =>
    instance.id === instanceId ? update({ ...instance, contents: cloneContent(instance.contents) }) : instance,
  );
  return { ...state, equipmentInstances, contents: syncContents(equipmentInstances) };
};

const removeAttachmentsForInstances = (
  state: RuntimeState,
  instanceIds: string[],
): RuntimeState => {
  const hiddenIds = new Set(instanceIds);
  return {
    ...state,
    attachments: state.attachments.filter(
      (attachment) =>
        !hiddenIds.has(attachment.parentInstanceId) &&
        !hiddenIds.has(attachment.childInstanceId),
    ),
  };
};

const fail = (
  state: RuntimeState,
  message: string,
  recovery: string,
  nodeId?: string,
): ActionResult => ({
  ok: false,
  state: {
    ...state,
    feedbackQueue: [...state.feedbackQueue, feedback("error", message, nodeId, recovery)],
  },
  message,
  recovery,
});

const addNotebook = (
  state: RuntimeState,
  nodeId: string,
  label: string,
  value: string,
  tags: string[],
  type: "observation" | "measurement" | "calculation" | "reflection" = "observation",
): RuntimeState => ({
  ...state,
  notebook: [
    ...state.notebook,
    {
      id: `${nodeId}-${label.toLowerCase().replaceAll(" ", "-")}-${state.notebook.length + 1}`,
      timestamp: timestamp(),
      nodeId,
      type,
      label,
      value,
      tags,
    },
  ],
});

// Charging invalidates only receiver readiness; the original source remainder is untouched.
const chargedExtractionState = (target: ContentState): ContentState["extractionState"] =>
  target.extractionState ? { stage: "charged" } : undefined;
const mergeTransferredContents = (target: ContentState, source: ContentState): ContentState => ({
  ...mergeTransferredContentsBase(target, source), extractionState: chargedExtractionState(target),
});
const matchesEquipmentRole = (instance: EquipmentInstance | undefined, role: string): boolean =>
  Boolean(instance && equipmentRoleById.get(role)?.allowedEquipmentIds.includes(instance.definitionId));

const mergeContents = (
  source: ContentState,
  target: ContentState,
  volumeMl?: number,
): ContentState => {
  if (target.kind === "empty") {
    return {
      ...cloneContent(source),
      recoveryEvidence: undefined,
      extractionState: chargedExtractionState(target),
      volumeMl: volumeMl ?? source.volumeMl,
      visualState: source.precipitate ? "cloudy-precipitate" : source.visualState,
    };
  }

  return {
    ...target,
    recoveryEvidence: undefined,
    extractionState: chargedExtractionState(target),
    kind: source.precipitate || target.precipitate ? "mixture" : target.kind,
    label: `${target.label} + ${source.label}`,
    volumeMl: (target.volumeMl ?? 0) + (volumeMl ?? source.volumeMl ?? 0),
    solutes: [...target.solutes, ...source.solutes],
    precipitate: source.precipitate ?? target.precipitate,
    visualState: source.precipitate || target.precipitate ? "cloudy-precipitate" : target.visualState,
    wetState: "wet",
  };
};

const usesSpecializedContentMovement = (action: ActionDefinition): boolean => {
  const specialized = /calorimeter|thermal|temperature|kinetic|precipitat|filtrat|rinse|dry|solid|chromatograph|reactionStart|timerContinues|\bheat(?:ing)?\b|\bcool(?:ing)?\b|oven/i;
  const metadata = [
    action.id,
    action.label,
    action.atomId,
    ...action.stateChanges,
    ...action.evidence,
    ...Object.keys(action.equipmentRoleBindings ?? {}),
    ...Object.values(action.equipmentRoleBindings ?? {}),
  ];
  if (metadata.some((value) => value !== undefined && specialized.test(value))) return true;
  return Object.entries(action.parameters).some(([key, value]) => {
    if (specialized.test(key)) return true;
    if (typeof value === "string") return specialized.test(value);
    return Array.isArray(value) && value.some((item) => specialized.test(item));
  });
};

const canConserveOrdinaryContent = (
  source: ContentState,
  target: ContentState,
  action: ActionDefinition,
): boolean => (source.kind === "liquid" || source.kind === "solution")
  && isOrdinaryLiquidContent(source)
  && (target.kind === "empty" || isOrdinaryLiquidContent(target))
  && source.temperatureC === undefined
  && target.temperatureC === undefined
  && !usesSpecializedContentMovement(action);

const includesSolute = (contents: ContentState, soluteId: string): boolean =>
  contents.solutes.some((solute) => solute.id === soluteId);

/**
 * The titrand's appearance at each stage of a dispense.
 *
 * Before Cycle 09 this returned three literals unconditionally, so
 * `public/labs/hydrogen-peroxide-redox-titration.json` authored `preEndpointVisualState`,
 * `endpointVisualState`, and `overshootVisualState` — the registered permanganate colours — and the
 * runtime painted the acid-base pink over them. That is F-07 (a heuristic beating an authored
 * state) surviving inside the reducer. The authored value now wins; content that declares none is
 * unchanged.
 */
const titrationVisualState = (
  colorState: DropDispenseColorState,
  params: Record<string, string | number | boolean | string[] | undefined> = {},
): string => {
  if (colorState === "palePink") {
    return stringSetting(params, "endpointVisualState") ?? "titration-pale-pink";
  }
  if (colorState === "darkPink") {
    return stringSetting(params, "overshootVisualState") ?? "titration-dark-pink";
  }
  return stringSetting(params, "preEndpointVisualState") ?? "titration-clear";
};

const colorStateForDrops = (
  dropsDispensed: number,
  endpointDropCount: number,
): DropDispenseColorState => {
  if (dropsDispensed > endpointDropCount) return "darkPink";
  if (dropsDispensed === endpointDropCount) return "palePink";
  return "clear";
};

/**
 * Endpoint and overshoot prose.
 *
 * "Pale pink" and "excess NaOH ... alkaline solution" were unconditional, so Investigation 8's
 * permanganate endpoint — faint persistent pink, overshooting to dark red-purple, with no base
 * anywhere in the system — was described to the learner as an alkaline acid-base endpoint. The lab
 * already authored `endpointLabel` and `overshootLabel`; nothing read them. Defaults preserve the
 * acid-base wording exactly.
 */
const endpointDescription = (
  params: Record<string, string | number | boolean | string[] | undefined>,
): string => stringSetting(params, "endpointLabel") ?? "Pale pink endpoint";

const overshootDescription = (
  params: Record<string, string | number | boolean | string[] | undefined>,
): string =>
  stringSetting(params, "overshootLabel") ?? "darker pink shows excess NaOH and an alkaline solution";

const initialBuretteMeasurementIdFor = (
  params: Record<string, string | number | boolean | string[] | undefined>,
): string => stringSetting(params, "initialBuretteMeasurementId") ?? "burette-initial-volume";

/**
 * The initial burette reading a dispense counts from, or `undefined` when the student has not read
 * the instrument yet.
 *
 * The old code fell back to `numberSetting(params, "initialBuretteReadingMl", 0)`, so an action that
 * hard-coded a reading (`acid-base-titration` carried `0.2`) counted from an authored constant, and
 * one that did not counted from a fabricated 0.00 mL. Both are the "fixed placeholder" that
 * CONTINUATION_CYCLE_09.md's acceptance criteria rule out. There is no fallback now; the caller
 * refuses to dispense without a recorded reading.
 */
const recordedInitialBuretteReading = (
  state: RuntimeState,
  params: Record<string, string | number | boolean | string[] | undefined>,
): number | undefined => {
  const measurement = state.measurements.find(
    (candidate) => candidate.id === initialBuretteMeasurementIdFor(params),
  );
  return typeof measurement?.value === "number" && Number.isFinite(measurement.value)
    ? measurement.value
    : undefined;
};

const dispenseRecordFor = (
  state: RuntimeState,
  actionId: string,
  params: Record<string, string | number | boolean | string[] | undefined>,
): DropDispenseRecord => {
  const existing = state.dropDispenses[actionId];
  if (existing) return existing;

  const initialBuretteReadingMl = roundToInstrumentMl(
    Number(recordedInitialBuretteReading(state, params) ?? 0),
  );
  const dropVolumeMl = numberSetting(params, "dropVolumeMl", 0.05);
  const authoredEquivalenceDropCount = Math.max(
    1,
    Math.round(numberSetting(params, "equivalenceDropCount", 1)),
  );
  const theoreticalEquivalenceVolumeMl = numberSetting(
    params,
    "theoreticalEquivalenceVolumeMl",
    Number.NaN,
  );
  const equivalenceDropCount = Math.max(
    1,
    Number.isFinite(theoreticalEquivalenceVolumeMl)
      ? Math.round(theoreticalEquivalenceVolumeMl / dropVolumeMl)
      : authoredEquivalenceDropCount,
  );
  const endpointOffsetDrops = Math.round(
    numberSetting(params, "endpointDropCount", authoredEquivalenceDropCount) -
      authoredEquivalenceDropCount,
  );
  const endpointDropCount = Math.max(1, equivalenceDropCount + endpointOffsetDrops);
  const maxExtraDrops = Math.max(
    0,
    Math.round(numberSetting(params, "maxExtraDrops", DEFAULT_TITRATION_MAX_EXTRA_DROPS)),
  );

  return {
    actionId,
    dropsDispensed: 0,
    dropVolumeMl,
    deliveredVolumeMl: 0,
    initialBuretteReadingMl,
    currentBuretteReadingMl: initialBuretteReadingMl,
    equivalenceDropCount,
    endpointDropCount,
    maxExtraDrops,
    accepted: false,
    colorState: "clear",
  };
};

const withDispenseRecord = (
  state: RuntimeState,
  record: DropDispenseRecord,
): RuntimeState => ({
  ...state,
  dropDispenses: {
    ...state.dropDispenses,
    [record.actionId]: record,
  },
});

const applyDropToContents = (
  state: RuntimeState,
  source: EquipmentInstance,
  target: EquipmentInstance,
  volumeMl: number,
  colorState: DropDispenseColorState,
  action: ActionDefinition,
): RuntimeState => {
  const params = action.parameters;
  if (canConserveOrdinaryContent(source.contents, target.contents, action)) {
    const { transferredContents, remainingContents } = splitContentForVolume(
      source.contents,
      volumeMl,
    );
    const mergedContents = mergeTransferredContents(target.contents, transferredContents);
    const afterTarget = updateInstance(state, target.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: {
        ...mergedContents,
        kind: "mixture",
        label: stringSetting(params, "mixtureLabel") ?? "Titrating acid mixture",
        volumeMl: roundToRuntimeMl((target.contents.volumeMl ?? 0) + volumeMl),
        visualState: titrationVisualState(colorState, params),
      },
    }));
    return updateInstance(afterTarget, source.id, (instance) => ({
      ...instance,
      contents: remainingContents.kind === "empty"
        ? remainingContents
        : {
            ...remainingContents,
            volumeMl: roundToRuntimeMl(remainingContents.volumeMl ?? 0),
          },
    }));
  }

  const afterTarget = updateInstance(state, target.id, (instance) => {
    const nextVolume = roundToRuntimeMl((instance.contents.volumeMl ?? 0) + volumeMl);
    const sourceSolutes = source.contents.solutes.filter(
      (solute) => !includesSolute(instance.contents, solute.id),
    );
    return {
      ...instance,
      location: "workbench",
      contents: {
        ...instance.contents,
        kind: "mixture",
        // "Titrating acid mixture" is wrong for a redox titration, where the flask holds acidified
        // Fe(II) or peroxide and no acid is being consumed. The label is authorable for that reason.
        label: stringSetting(params, "mixtureLabel") ?? "Titrating acid mixture",
        volumeMl: nextVolume,
        solutes: [...instance.contents.solutes, ...sourceSolutes],
        wetState: "wet",
        visualState: titrationVisualState(colorState, params),
      },
    };
  });

  return updateInstance(afterTarget, source.id, (instance) => {
    const nextVolume = Math.max(0, roundToRuntimeMl((instance.contents.volumeMl ?? 0) - volumeMl));
    return {
      ...instance,
      contents:
        nextVolume === 0
          ? emptyContents()
          : {
              ...instance.contents,
              volumeMl: nextVolume,
              visualState: instance.contents.visualState === "empty" ? "clear-solution" : instance.contents.visualState,
            },
    };
  });
};

const upsertMeasurement = (
  state: RuntimeState,
  id: string,
  label: string,
  value: number,
  unit: string,
  equipmentInstanceId: string | undefined,
  nodeId: string,
): RuntimeState => ({
  ...state,
  measurements: [
    ...state.measurements.filter((measurement) => measurement.id !== id),
    {
      id,
      label,
      value,
      unit,
      equipmentInstanceId,
      nodeId,
    },
  ],
});

const executeDropDispense = (
  state: RuntimeState,
  action: RuntimeActionRequest,
  actionDefinition: ActionDefinition,
  nodeId: string,
  params: Record<string, string | number | boolean | string[] | undefined>,
): ActionResult => {
  const source = findInstance(state, action.sourceInstanceId, String(params.sourceDefinitionId ?? ""));
  const target = findInstance(state, action.targetInstanceId, String(params.targetDefinitionId ?? ""));
  if (!source || !target) {
    return fail(state, "Source or target is missing.", "Place the burette and receiving flask before dispensing.", nodeId);
  }

  const sourceDefinition = equipmentById.get(source.definitionId);
  if (!sourceDefinition?.affordances.includes("pourable")) {
    return fail(
      state,
      "The selected source is not a realistic burette source.",
      "Use the mounted burette as the titrant source.",
      nodeId,
    );
  }

  const targetDefinition = equipmentById.get(target.definitionId);
  const mode = action.parameters?.dispenseMode === "acceptEndpoint" ? "acceptEndpoint" : "drop";
  const requiredTargetSnapZoneId = stringSetting(params, "requiredTargetSnapZoneId");
  if (requiredTargetSnapZoneId && mode === "drop") {
    const sourceMount = attachmentsForChild(state, source.id).find(
      (attachment) => attachment.relationType === "mounted",
    );
    const receiverIsUnderBurette = Boolean(
      sourceMount &&
        attachmentsForChild(state, target.id).some(
          (attachment) =>
            attachment.parentInstanceId === sourceMount.parentInstanceId &&
            attachment.zoneId === requiredTargetSnapZoneId,
        ),
    );
    if (!receiverIsUnderBurette) {
      return fail(
        state,
        `The ${target.label} is not positioned beneath the mounted burette.`,
        "Place the receiving flask under the burette tip before opening the stopcock.",
        nodeId,
      );
    }
  }

  // The setup gates require a clamped burette, an analyte-bearing receiver, and an initial reading.
  // They run only while a dispense is being set up, while the receiver-position gate above applies
  // to every drop so titrant cannot be delivered after the flask has been moved away.
  const alreadyStarted = Boolean(state.dropDispenses[actionDefinition.id]);
  if (!alreadyStarted) {
    if (attachmentsForChild(state, source.id).length === 0) {
      return fail(
        state,
        `The ${source.label} is not clamped to its support.`,
        "Mount the burette in the ring-stand clamp before delivering any titrant.",
        nodeId,
      );
    }
    if (target.contents.kind === "empty" || (target.contents.volumeMl ?? 0) <= 0) {
      return fail(
        state,
        `The ${target.label} is empty.`,
        "Measure the analyte aliquot into the receiving vessel before delivering titrant.",
        nodeId,
      );
    }
    if (recordedInitialBuretteReading(state, params) === undefined) {
      return fail(
        state,
        "No initial burette reading has been taken.",
        `Read the burette and record ${initialBuretteMeasurementIdFor(params)} before delivering titrant; the simulator does not supply a starting reading.`,
        nodeId,
      );
    }
  }

  const record = dispenseRecordFor(state, actionDefinition.id, params);

  if (mode === "acceptEndpoint") {
    if (record.accepted) {
      return fail(
        state,
        "The endpoint has already been accepted.",
        "Continue to recording the final burette reading.",
        nodeId,
      );
    }
    if (record.dropsDispensed < record.endpointDropCount) {
      return fail(
        state,
        "The endpoint has not been reached.",
        "Continue dispensing one drop at a time until the solution is pale pink.",
        nodeId,
      );
    }

    const accepted: DropDispenseRecord = { ...record, accepted: true };
    const measurementId = stringSetting(params, "finalBuretteMeasurementId") ?? "burette-final-volume";
    const label = stringSetting(params, "finalBuretteLabel") ?? "Final burette reading";
    const withRecord = withDispenseRecord(state, accepted);
    const next = upsertMeasurement(
      withRecord,
      measurementId,
      label,
      accepted.currentBuretteReadingMl,
      "mL",
      source.id,
      nodeId,
    );
    const extraDrops = Math.max(0, accepted.dropsDispensed - accepted.endpointDropCount);
    return {
      ok: true,
      state: next,
      message:
        extraDrops > 0
          ? `Endpoint accepted after ${extraDrops} extra drop${extraDrops === 1 ? "" : "s"}; ${overshootDescription(params)}.`
          : actionDefinition.feedback.success,
    };
  }

  if (record.accepted) {
    return fail(
      state,
      "The endpoint has already been accepted.",
      "Record the final burette reading instead of adding more titrant.",
      nodeId,
    );
  }

  const maxDrops = record.endpointDropCount + record.maxExtraDrops;
  if (record.dropsDispensed >= maxDrops) {
    return fail(
      state,
      "No more titrant should be added.",
      `The flask has already received ${record.maxExtraDrops} extra drop${record.maxExtraDrops === 1 ? "" : "s"} past the endpoint.`,
      nodeId,
    );
  }
  if (source.contents.kind === "empty" || (source.contents.volumeMl ?? 0) < record.dropVolumeMl) {
    return fail(state, "The burette is empty.", "Refill with the approved titrant for this trial.", nodeId);
  }
  if (
    targetDefinition?.capacity.unit === "mL" &&
    (target.contents.volumeMl ?? 0) + record.dropVolumeMl > targetDefinition.capacity.amount
  ) {
    return fail(state, "The drop would overflow the flask.", "Use a larger receiving container.", nodeId);
  }

  const dropsDispensed = record.dropsDispensed + 1;
  const colorState = colorStateForDrops(dropsDispensed, record.endpointDropCount);
  const deliveredVolumeMl = roundToRuntimeMl(dropsDispensed * record.dropVolumeMl);
  const nextRecord: DropDispenseRecord = {
    ...record,
    dropsDispensed,
    deliveredVolumeMl,
    currentBuretteReadingMl: roundToRuntimeMl(record.initialBuretteReadingMl + deliveredVolumeMl),
    colorState,
  };
  const next = withDispenseRecord(
    applyDropToContents(state, source, target, record.dropVolumeMl, colorState, actionDefinition),
    nextRecord,
  );
  const extraDrops = Math.max(0, dropsDispensed - record.endpointDropCount);
  const message =
    dropsDispensed === record.endpointDropCount
      ? `${endpointDescription(params)} reached. Accept the endpoint now or add cautious extra drops to see over-titration.`
      : extraDrops > 0
        ? `Extra drop ${extraDrops} of ${record.maxExtraDrops}: ${overshootDescription(params)}.`
        : `Drop ${dropsDispensed} dispensed. Mix and observe the solution.`;

  return { ok: true, state: next, message };
};

const normalizedMaterialKey = (value: string | undefined): string =>
  value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ?? "";

const isPrecipitatedSolute = (solute: ContentState["solutes"][number], precipitate: ContentState["precipitate"]): boolean => {
  if (!precipitate) return false;
  const precipitateKey = normalizedMaterialKey(precipitate.substance);
  return normalizedMaterialKey(solute.id) === precipitateKey || normalizedMaterialKey(solute.label) === precipitateKey;
};

const displayColorRecorded = (state: RuntimeState, colorName: string): boolean => {
  const normalizedColor = normalizedMaterialKey(colorName);
  if (!normalizedColor) return false;
  return (
    state.notebook.some((entry) =>
      entry.tags.some((tag) => normalizedMaterialKey(tag) === normalizedColor) ||
      normalizedMaterialKey(entry.value).includes(normalizedColor),
    ) ||
    state.equipmentInstances.some((instance) =>
      normalizedMaterialKey(instance.contents.visualState).includes(normalizedColor) ||
      normalizedMaterialKey(instance.contents.label).includes(normalizedColor),
    )
  );
};

const instanceShowsColor = (instance: EquipmentInstance, colorName: string): boolean => {
  const normalizedColor = normalizedMaterialKey(colorName);
  return (
    normalizedMaterialKey(instance.contents.visualState).includes(normalizedColor) ||
    normalizedMaterialKey(instance.contents.label).includes(normalizedColor)
  );
};

const executeStressEquilibrium = (
  state: RuntimeState,
  action: RuntimeActionRequest,
  actionDefinition: ActionDefinition,
  nodeId: string,
  params: Record<string, string | number | boolean | string[] | undefined>,
): ActionResult => {
  const displayColorNames = stringArraySetting(params, "displayColorNames");
  if (displayColorNames.length > 0) {
    const displaySlotIds = stringArraySetting(params, "displaySlotIds");
    const displayRackInstanceId = stringSetting(params, "displayRackInstanceId");
    if (displaySlotIds.length > 0) {
      const displayTubes = displaySlotIds.flatMap((slotId) => {
        const attachment = state.attachments.find(
          (candidate) =>
            candidate.zoneId === slotId &&
            (!displayRackInstanceId || candidate.parentInstanceId === displayRackInstanceId),
        );
        const child = attachment
          ? state.equipmentInstances.find((instance) => instance.id === attachment.childInstanceId)
          : undefined;
        return child ? [child] : [];
      });
      if (displayTubes.length < displaySlotIds.length) {
        return fail(
          state,
          "The display rack is not fully assembled.",
          "Place a colored tube into each final display slot before submitting the display.",
          nodeId,
        );
      }
      const missingDisplayColors = displayColorNames.filter(
        (colorName) => !displayTubes.some((tube) => instanceShowsColor(tube, colorName)),
      );
      if (missingDisplayColors.length > 0) {
        return fail(
          state,
          `The display rack is missing ${missingDisplayColors.join(", ")} tubes.`,
          "Move the tubes with those final colors into the display rack slots.",
          nodeId,
        );
      }
    }
    const missing = displayColorNames.filter((colorName) => !displayColorRecorded(state, colorName));
    if (missing.length > 0) {
      return fail(
        state,
        `The display is missing ${missing.join(", ")} evidence.`,
        "Complete and record the stressed systems that supply each required display color.",
        nodeId,
      );
    }
    const summary =
      stringSetting(params, "note") ??
      `Final display contains ${displayColorNames.join(", ")} equilibrium colors with recorded stress explanations.`;
    return {
      ok: true,
      state: addNotebook(
        state,
        nodeId,
        actionDefinition.label,
        summary,
        ["stressEquilibrium", "display", ...displayColorNames],
      ),
      message: actionDefinition.feedback.success,
    };
  }

  const resultVisualState = stringSetting(params, "resultVisualState");
  const resultColorName = stringSetting(params, "resultColorName");
  if (!resultVisualState || !resultColorName) {
    return fail(
      state,
      "The equilibrium stress action is missing a configured result color.",
      "Configure resultVisualState and resultColorName for this stress action.",
      nodeId,
    );
  }

  const interactionType = actionDefinition.interaction?.type;
  const resultTargetDefinitionId =
    stringSetting(params, "resultTargetDefinitionId") ??
    (interactionType === "placeInInstrument"
      ? actionDefinition.interaction?.sourceDefinitionId ?? stringSetting(params, "sourceDefinitionId")
      : stringSetting(params, "targetDefinitionId") ??
        actionDefinition.interaction?.targetDefinitionId ??
        stringSetting(params, "sourceDefinitionId") ??
        actionDefinition.interaction?.sourceDefinitionId);
  const resultTargetInstanceId =
    stringSetting(params, "resultTargetInstanceId") ??
    (interactionType === "placeInInstrument"
      ? action.sourceInstanceId
      : action.targetInstanceId ?? action.sourceInstanceId);
  const target = findInstance(state, resultTargetInstanceId, resultTargetDefinitionId);
  if (!target) {
    return fail(
      state,
      "The equilibrium sample was not selected.",
      "Select the tube or syringe that should show the stressed equilibrium color.",
      nodeId,
    );
  }
  if (resultTargetDefinitionId && target.definitionId !== resultTargetDefinitionId) {
    return fail(
      state,
      "The selected target is not the configured equilibrium sample.",
      "Use the tube or syringe named by this stress step.",
      nodeId,
    );
  }

  const sourceDefinitionId =
    stringSetting(params, "sourceDefinitionId") ?? actionDefinition.interaction?.sourceDefinitionId;
  const source = findInstance(
    state,
    action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId"),
    sourceDefinitionId,
  );
  if (interactionType === "pourInto" && (!source || (sourceDefinitionId && source.definitionId !== sourceDefinitionId))) {
    return fail(
      state,
      "The required stress reagent was not selected.",
      "Use the reagent source named by this equilibrium stress step.",
      nodeId,
    );
  }

  const volumeMl = numberSetting(params, "volumeMl", Number(action.value ?? 0));
  const consumesSource =
    interactionType === "pourInto" &&
    Boolean(source) &&
    source?.id !== target.id &&
    volumeMl > 0 &&
    !booleanSetting(params, "preserveSource");
  if (consumesSource && source) {
    if (source.contents.kind === "empty" || (source.contents.volumeMl ?? 0) <= 0) {
      return fail(state, "The stress reagent is empty.", "Choose the reagent container that contains solution.", nodeId);
    }
    if ((source.contents.volumeMl ?? 0) < volumeMl) {
      return fail(
        state,
        "The stress reagent does not contain enough liquid.",
        "Use a source with enough volume for the requested stress addition.",
        nodeId,
      );
    }
  }

  const targetDefinition = equipmentById.get(target.definitionId);
  const startingVolumeMl = target.contents.volumeMl ?? 0;
  const resultVolumeMl = numberSetting(
    params,
    "resultVolumeMl",
    roundToRuntimeMl(startingVolumeMl + (consumesSource ? volumeMl : 0)),
  );
  if (
    targetDefinition?.capacity.unit === "mL" &&
    resultVolumeMl > targetDefinition.capacity.amount
  ) {
    return fail(state, "The equilibrium sample would overflow.", "Use a smaller stress addition or a larger sample container.", nodeId);
  }

  const resultLabel = stringSetting(params, "resultLabel") ?? `${resultColorName} equilibrium mixture`;
  const resultTemperatureC = numberSetting(
    params,
    "resultTemperatureC",
    target.contents.temperatureC ?? source?.contents.temperatureC ?? 22,
  );
  const systemId = stringSetting(params, "systemId") ?? "equilibrium-system";
  const stressType = stringSetting(params, "stressType") ?? "stress";
  const sourceSolutes =
    source && source.id !== target.id
      ? source.contents.solutes.filter(
          (solute) => !target.contents.solutes.some((existing) => existing.id === solute.id),
        )
      : [];
  const resultKind = contentKindSetting(
    params,
    "resultKind",
    target.contents.kind === "empty" || target.contents.kind === "solid" ? "solution" : target.contents.kind,
  );

  const withTarget = updateInstance(state, target.id, (instance) => ({
    ...instance,
    location: instance.location === "shelf" ? "workbench" : instance.location,
    contents: {
      ...instance.contents,
      kind: resultKind,
      label: resultLabel,
      volumeMl: resultVolumeMl > 0 ? resultVolumeMl : instance.contents.volumeMl,
      solutes: [...instance.contents.solutes, ...sourceSolutes],
      contamination: [...instance.contents.contamination],
      temperatureC: resultTemperatureC,
      wetState: "wet",
      visualState: resultVisualState,
    },
  }));

  const withSource =
    consumesSource && source
      ? updateInstance(withTarget, source.id, (instance) => {
          const nextVolumeMl = Math.max(0, roundToRuntimeMl((instance.contents.volumeMl ?? 0) - volumeMl));
          return {
            ...instance,
            contents:
              nextVolumeMl === 0
                ? emptyContents()
                : {
                    ...instance.contents,
                    volumeMl: nextVolumeMl,
                    visualState: instance.contents.visualState === "empty" ? "clear-liquid" : instance.contents.visualState,
                  },
          };
        })
      : withTarget;
  const note =
    stringSetting(params, "note") ??
    `${systemId}: ${stressType} stress shifted the mixture to ${resultColorName}.`;
  return {
    ok: true,
    state: addNotebook(
      withSource,
      nodeId,
      actionDefinition.label,
      note,
      ["stressEquilibrium", systemId, stressType, resultColorName, resultVisualState],
    ),
    message: actionDefinition.feedback.success,
  };
};

const executeAction = (
  definition: RuntimeDefinition,
  state: RuntimeState,
  action: RuntimeActionRequest,
  actionDefinition: ActionDefinition,
  nodeId: string,
): ActionResult => {
  const params = { ...actionDefinition.parameters, ...(action.parameters ?? {}) };
  // Explicit specimen bindings are identities, not merely preferred equipment definitions.
  if (actionDefinition.parameters.enforceInstanceIdentity === true) {
    for (const key of ["sourceInstanceId", "targetInstanceId"] as const) {
      const expected = actionDefinition.parameters[key];
      if (typeof expected === "string" && action[key] && action[key] !== expected) {
        return fail(state, "The selected material does not match this trial's assigned equipment.", "Use the named source and receiver; a bottle of the same equipment type is not interchangeable.", nodeId);
      }
      if (typeof expected === "string") action = { ...action, [key]: expected };
    }
  }
  action = {
    ...action,
    sourceInstanceId:
      action.sourceInstanceId ??
      stringSetting(params, "sourceInstanceId") ??
      (action.verb === "place" ? stringSetting(params, "equipmentInstanceId") : undefined),
    targetInstanceId: action.targetInstanceId ?? stringSetting(params, "targetInstanceId"),
  };

  const attachmentStateFailure = validateActionAttachmentState(state, params);
  if (attachmentStateFailure) {
    return fail(
      state,
      attachmentStateFailure.message,
      attachmentStateFailure.recovery,
      nodeId,
    );
  }

  if (!actionDefinition.parameters.titrationOperation && actionDefinition.verb === "calculate" && typeof actionDefinition.parameters.trialReferenceId === "string") {
    const trial = state.titrationTrials?.[actionDefinition.parameters.trialReferenceId];
    const initial = stringSetting(actionDefinition.parameters, "initialBuretteMeasurementId");
    const final = stringSetting(actionDefinition.parameters, "finalBuretteMeasurementId");
    if (!trial?.accepted || !initial || !final || !trial.readingsRecorded.includes(initial) || !trial.readingsRecorded.includes(final)) return fail(state, "The trial's accepted endpoint and both recorded readings are required.", "Complete this trial's reading and recording operations before calculating.", nodeId);
  }

  if (actionDefinition.parameters.titrationOperation) {
    const result = executeTitrationStep(definition, state, actionDefinition, action, nodeId);
    return result.ok ? result : fail(state, result.message, result.recovery, nodeId);
  }

  if (actionDefinition.parameters.tipInspectionOperation === true && action.note === "Bubbles remain: purge again") {
    const purgeNode = stringSetting(actionDefinition.parameters, "repeatPurgeNodeId");
    if (!purgeNode) return fail(state, "The repeat purge path is missing.", "Review the authored preparation before proceeding.", nodeId);
    return {ok:true,state:addNotebook({...state,completedNodes:state.completedNodes.filter(id=>id!==nodeId&&id!==purgeNode)},nodeId,actionDefinition.label,"Air bubbles observed; another separate purge is required.",["tip-inspection"]),message:"Purge into the approved waste receiver, then inspect again.",nextNodeId:purgeNode};
  }

  // Extraction readiness belongs to the current named vessel, never to old notebook entries.
  if (actionDefinition.extractionIdentity) {
    const vessel = state.equipmentInstances.find((entry) => entry.id === actionDefinition.extractionIdentity!.vesselInstanceId);
    const organic = actionDefinition.parameters.organicDensity;
    const aqueous = actionDefinition.parameters.aqueousDensity;
    if (!vessel || !matchesEquipmentRole(vessel, "extraction-funnel") || vessel.contents.extractionState?.observation !== "layers-observed" || action.note !== "aqueous-below-organic-confirmed" || typeof organic !== "number" || typeof aqueous !== "number" || organic <= 0 || aqueous <= organic) return fail(state, "Confirm the observed layer order against the supplied positive density evidence.", "This supported route requires aqueous below organic; preserve unresolved or incompatible layers.", nodeId);
    return { ok: true, state: addNotebook(updateInstance(state, vessel.id, (entry) => ({ ...entry, contents: { ...entry.contents, extractionState: { ...entry.contents.extractionState!, layerIdentityConfirmed: true } } })), nodeId, actionDefinition.label, `Observed aqueous-below-organic order agrees with supplied densities ${aqueous} and ${organic} g/mL.`, ["layer-identity", "classroom-observation"]), message: actionDefinition.feedback.success };
  }
  if (actionDefinition.fractionHandling) {
    const contract = actionDefinition.fractionHandling;
    const source = state.equipmentInstances.find((entry) => entry.id === contract.sourceInstanceId);
    const target = state.equipmentInstances.find((entry) => entry.id === contract.targetInstanceId);
    if (!source || !matchesEquipmentRole(source, "recovery-vessel") || (target && source.id === target.id)) return fail(state, "The named fraction vessel is missing or incompatible.", "Use distinct original labeled vessels.", nodeId);
    const controls = actionDefinition.parameters;
    const method = controls.recoveryMethod;
    const drynessCriterion = controls.drynessCriterion;
    const coolingLimitC = controls.coolingLimitC;
    const isRecovery = !["dispose", "remove-label"].includes(contract.operation);
    if (isRecovery && (controls.recoverySetupApproved !== true || typeof method !== "string" || !["external-unheated-evaporation", "external-acid-recovery"].includes(method) || typeof drynessCriterion !== "string" || !drynessCriterion.trim() || typeof coolingLimitC !== "number" || !Number.isFinite(coolingLimitC))) return fail(state, "Approved fraction-specific recovery controls are missing.", "Start with the approved method, dryness criterion and cooling endpoint.", nodeId);
    const priorRecovery = source.contents.recoveryEvidence;
    if (isRecovery && priorRecovery && (priorRecovery.fractionId !== contract.fractionId || priorRecovery.method !== method || priorRecovery.drynessCriterion !== drynessCriterion || priorRecovery.coolingLimitC !== coolingLimitC)) return fail(state, "The stored fraction identity or recovery controls do not match.", "Preserve the original fraction and settings; do not relabel it as another fraction.", nodeId);
    if (isRecovery && source.contents.kind === "empty") return fail(state, "This vessel contains no fraction to recover.", "Complete the preceding physical transfer first.", nodeId);
    const recovery = { fractionId: contract.fractionId, residueObserved: false, dry: false, provenance: "classroom-observation" as const, method: String(method), drynessCriterion: String(drynessCriterion), coolingLimitC: Number(coolingLimitC) };
    let next = state;
    if (contract.operation === "remove-solvent") {
      if (method !== "external-unheated-evaporation") return fail(state, "This recovery mode supports instructor-supervised unheated solvent removal only.", "Configure the supported classroom method before starting.", nodeId);
      if (typeof action.value !== "number" || !Number.isFinite(action.value) || action.value < 0 || action.value > (source.contents.volumeMl ?? 0)) return fail(state, "Enter the observed remaining solvent volume within this fraction's current volume.", "Measure the remaining liquid; do not infer a solid mass.", nodeId);
      next = updateInstance(state, source.id, (entry) => ({ ...entry, contents: { ...entry.contents, volumeMl: action.value, recoveryEvidence: recovery } }));
      if (action.value > 0) return fail(next, "Solvent remains; recovery is incomplete.", "Continue only the approved unheated removal, then report a fresh remaining-volume observation.", nodeId);
    } else if (contract.operation === "remove-drying-agent") {
      const agent = source.contents.solutes.filter((solute) => solute.id === "magnesium-sulfate" && solute.unit === "g");
      if (!target || target.contents.kind !== "empty" || !agent.length || action.note !== "agent-separated") return fail(state, "Separate the MgSO4 from the organic solution into its clean receiver.", "Observe complete drying-agent separation before proceeding; the drying agent is not a recovered component.", nodeId);
      const agentMass = agent.reduce((sum, solute) => sum + solute.amount, 0);
      const aggregateMass = source.contents.massG;
      if (agent.some((solute) => !Number.isFinite(solute.amount) || solute.amount < 0) || !Number.isFinite(agentMass) ||
          (aggregateMass !== undefined && (!Number.isFinite(aggregateMass) || aggregateMass < agentMass))) {
        return fail(state, "The drying-agent mass bookkeeping is inconsistent.", "Resolve the measured total and retained agent mass before separation.", nodeId);
      }
      next = updateInstance(state, target.id, (entry) => ({ ...entry, contents: { ...source.contents, label: "Organic solution after drying-agent removal", solutes: source.contents.solutes.filter((solute) => solute.id !== "magnesium-sulfate"), massG: aggregateMass === undefined ? undefined : aggregateMass - agentMass } }));
      next = updateInstance(next, source.id, (entry) => ({ ...entry, contents: { ...emptyContents("Retained MgSO4 drying agent"), kind: "solid", solutes: agent, massG: agent.reduce((sum, solute) => sum + solute.amount, 0), visualState: "powder" } }));
    } else if (contract.operation === "observe-residue") {
      if (method === "external-unheated-evaporation" && (!priorRecovery || source.contents.volumeMl !== 0)) return fail(state, "Solvent removal must precede this residue observation.", "Complete the named fraction's removal endpoint first.", nodeId);
      if (method === "external-acid-recovery") {
        const ph = state.measurements.find((entry) => entry.id === controls.acidEndpointMeasurementId);
        if (!ph || ph.equipmentInstanceId !== source.id || ph.unit !== "pH" || typeof controls.acidEndpointPh !== "number" || ph.value > controls.acidEndpointPh) return fail(state, "This fraction has no acquired approved pH endpoint.", "Acquire the pH for this same fraction before observing recovery.", nodeId);
      }
      if (!["residue-present", "no-residue", "incomplete"].includes(action.note ?? "")) return fail(state, "Report the actual residue observation.", "Inspect the labeled fraction.", nodeId);
      next = updateInstance(state, source.id, (entry) => ({ ...entry, contents: { ...entry.contents, recoveryEvidence: { ...recovery, residueObserved: action.note === "residue-present" } } }));
      if (action.note !== "residue-present") return fail(addNotebook(next, nodeId, actionDefinition.label, action.note!, ["classroom-observation", action.note!]), "No recoverable residue is currently established.", "Retain the fraction for instructor review. No identity or zero yield is inferred; record a fresh observation only if recovery changes.", nodeId);
    } else if (contract.operation === "collect-residue") {
      if (!target || !source.contents.recoveryEvidence?.residueObserved) return fail(state, "An observed residue and clean receiving vessel are required.", "Observe recovery before collecting this fraction.", nodeId);
      if (target.contents.kind !== "empty") return fail(state, "The residue receiver is not empty.", "Use the assigned clean, tared receiver.", nodeId);
      next = updateInstance(state, target.id, (entry) => ({ ...entry, contents: { ...source.contents, label: `Unidentified ${contract.fractionId} residue`, kind: "solid", wetState: "wet", visualState: "wet-residue", recoveryEvidence: { ...source.contents.recoveryEvidence!, dry: false } } }));
      next = updateInstance(next, source.id, (entry) => ({ ...entry, contents: emptyContents() }));
    } else if (contract.operation === "observe-dryness") {
      if (!source.contents.recoveryEvidence?.residueObserved || action.note !== "dry") return fail(state, "A dry residue has not been observed.", "Complete the instructor-approved drying criterion and record dry only after observing it.", nodeId);
      next = updateInstance(state, source.id, (entry) => ({ ...entry, contents: { ...entry.contents, wetState: "dry", visualState: "dry-residue", recoveryEvidence: { ...entry.contents.recoveryEvidence!, dry: true } } }));
    } else if (contract.operation === "observe-cooling") {
      if (!source.contents.recoveryEvidence?.dry || typeof action.value !== "number" || !Number.isFinite(action.value) || action.value > Number(coolingLimitC)) return fail(state, "The dry fraction has not reached the approved weighing temperature.", "Acquire a fresh temperature after cooling.", nodeId);
      next = updateInstance(state, source.id, (entry) => ({ ...entry, contents: { ...entry.contents, temperatureC: action.value } }));
    } else if (contract.operation === "dispose") {
      if (!target || target.definitionId !== "waste-beaker") return fail(state, "The teacher-designated waste receiver is missing.", "Select the configured waste stream.", nodeId);
      const volume = (target.contents.volumeMl ?? 0) + (source.contents.volumeMl ?? 0);
      if (volume > (equipmentById.get(target.definitionId)?.capacity.amount ?? 0)) return fail(state, "The waste receiver would overflow.", "Use an empty approved waste receiver.", nodeId);
      const packets = target.contents.wasteContents ?? (target.contents.kind === "empty" ? [] : [target.contents]);
      next = updateInstance(state, target.id, (entry) => ({ ...entry, contents: { ...emptyContents("Designated waste; material packets retained"), kind: "mixture", volumeMl: volume, wasteContents: [...packets, source.contents] } }));
      next = updateInstance(next, source.id, (entry) => ({ ...entry, contents: emptyContents() }));
    } else if (contract.operation === "remove-label") {
      if (source.contents.kind !== "empty") return fail(state, "Empty the assembly before removing its marker.", "Dispose of retained material through the designated stream first.", nodeId);
      next = updateInstance(state, source.id, (entry) => ({ ...entry, label: "Clean watch glass" }));
    }
    return { ok: true, state: addNotebook(next, nodeId, actionDefinition.label, `${contract.operation}: ${contract.fractionId}; externally observed handling, no inferred identity or yield.`, ["classroom-observation", contract.operation]), message: actionDefinition.feedback.success };
  }
  const extractionSource = action.verb === "transfer" ? findInstance(state, action.sourceInstanceId, stringSetting(params, "sourceDefinitionId") ?? "") : undefined;
  if (actionDefinition.extractionDrain || extractionSource?.contents.extractionState) {
    const readiness = extractionSource?.contents.extractionState;
    if (!matchesEquipmentRole(extractionSource, "extraction-funnel") || !extractionSource || (actionDefinition.extractionDrain && actionDefinition.extractionDrain.vesselInstanceId !== extractionSource.id) || readiness?.stage !== "settled" || readiness.observation !== "layers-observed") {
      return fail(state, "Current settled layer observation is required before drainage.", "Complete configured mixing, venting, settling and a fresh layer observation; recover emulsion or incomplete separation before drainage.", nodeId);
    }
  }
  if (actionDefinition.extractionDrain) {
    const source = extractionSource!;
    const target = state.equipmentInstances.find((entry) => entry.id === actionDefinition.parameters.targetInstanceId);
    const volume = action.value;
    if (!source.contents.extractionState?.layerIdentityConfirmed || !target || target.id === source.id || typeof volume !== "number" || !Number.isFinite(volume) || volume <= 0 || volume > (source.contents.volumeMl ?? 0)) return fail(state, "A confirmed layer identity and valid observed drain volume are required.", "Use the approved labeled phase receiver and measured volume.", nodeId);
    if (actionDefinition.parameters.requireFullTransfer === true && volume !== source.contents.volumeMl) return fail(state, "Drain the complete remaining upper phase.", "Preserve all of this phase before advancing to another wash or recovery.", nodeId);
    const capacity = equipmentById.get(target.definitionId)?.capacity.amount ?? 0;
    if ((target.contents.volumeMl ?? 0) + volume > capacity || (target.contents.kind !== "empty" && target.contents.allocationReferenceId !== source.contents.unallocatedInventory?.allocationId)) return fail(state, "The phase receiver is occupied or would overflow.", "Use the assigned clean receiver; unrelated fractions cannot be merged.", nodeId);
    const allocation = source.contents.unallocatedInventory ? structuredClone(source.contents.unallocatedInventory) : { allocationId: `${nodeId}:${source.id}`, sourceLabel: source.contents.label, solutes: source.contents.solutes, massG: source.contents.massG, precipitate: source.contents.precipitate, contamination: source.contents.contamination };
    if (source.contents.unallocatedInventory) {
      allocation.solutes = [...allocation.solutes, ...source.contents.solutes];
      allocation.contamination = [...new Set([...allocation.contamination, ...source.contents.contamination])];
    }
    const remaining = (source.contents.volumeMl ?? 0) - volume;
    let next = updateInstance(state, target.id, (entry) => ({ ...entry, contents: { ...emptyContents(entry.label), kind: "liquid", volumeMl: (entry.contents.volumeMl ?? 0) + volume, wetState: "wet", visualState: "separated-fraction", allocationReferenceId: allocation.allocationId, ...(remaining === 0 ? { unallocatedInventory: allocation } : {}), contamination: [...source.contents.contamination] } }));
    next = updateInstance(next, source.id, (entry) => ({ ...entry, contents: remaining === 0 ? emptyContents() : { ...entry.contents, volumeMl: remaining, solutes: [], massG: undefined, precipitate: undefined, unallocatedInventory: allocation } }));
    return { ok: true, state: next, message: "Observed phase volume transferred; component allocation remains explicitly unresolved." };
  }
  if (actionDefinition.extractionOperation) {
    const contract = actionDefinition.extractionOperation;
    const vessel = findInstance(state, contract.vesselInstanceId);
    const controlsReady = contract.requiredControlActionIds.length > 0 && contract.requiredControlActionIds.every((id) => getActions(definition).some((control) => control.id === id && control.parameters.inputRole === "teacherConfiguration" && control.parameters.configuredValue === undefined && state.attemptHistory.some((attempt) => attempt.actionId === id && attempt.success)));
    const previous = vessel?.contents.extractionState;
    if (action.verb !== contract.operation || !["mix", "vent", "settle"].includes(contract.operation) || !vessel || !matchesEquipmentRole(vessel, "extraction-funnel") || (vessel.contents.volumeMl ?? 0) <= 0 || !controlsReady ||
        (contract.operation === "vent" && previous?.stage !== "mixed") ||
        (contract.operation === "settle" && previous?.stage !== "vented" && previous?.stage !== "settled")) {
      return fail(state, "The extraction operation is not ready on its named vessel.", "Acquire the configured controls and complete the current mixing and venting sequence.", nodeId);
    }
    const stage = contract.operation === "mix" ? "mixed" : contract.operation === "vent" ? "vented" : "settled";
    return { ok: true, state: updateInstance(state, vessel.id, (instance) => ({ ...instance, contents: { ...instance.contents, extractionState: { stage } } })), message: actionDefinition.feedback.success };
  }
  if (actionDefinition.extractionObservation) {
    const vessel = findInstance(state, actionDefinition.extractionObservation.vesselInstanceId);
    const observation = action.note;
    if (!vessel || !matchesEquipmentRole(vessel, "extraction-funnel") || vessel.contents.extractionState?.stage !== "settled" || (observation !== "layers-observed" && observation !== "emulsion" && observation !== "incomplete")) {
      return fail(state, "A fresh explicit observation of the settled vessel is required.", "Observe layers, emulsion, or incomplete separation after configured settling.", nodeId);
    }
    const observedState = addNotebook(updateInstance(state, vessel.id, (instance) => ({ ...instance, contents: { ...instance.contents, extractionState: { stage: "settled", observation } } })), nodeId, actionDefinition.label, observation, ["observe", observation], "observation");
    if (params.requireSeparatedLayers === true && observation !== "layers-observed") return fail(observedState, "Layers are not ready for drainage.", "This supported procedure permits further standing and fresh observation at this step. Other emulsion interventions need a separately approved procedure; no drain is unlocked.", nodeId);
    return { ok: true, state: observedState, message: actionDefinition.feedback.success };
  }

  const nextEvidenceScopeId = stringSetting(params, "beginEvidenceScopeId");
  if (nextEvidenceScopeId) {
    const resetEquipmentInstanceIds = new Set(
      stringArraySetting(params, "resetEquipmentInstanceIds"),
    );
    const clearContentsInstanceIds = new Set(
      stringArraySetting(params, "clearContentsInstanceIds"),
    );
    const clearRecordedTemperatureInstanceIds = new Set(
      stringArraySetting(params, "clearRecordedTemperatureInstanceIds"),
    );
    const freshState = createRuntimeState(definition, state.mode);
    const freshById = new Map(
      freshState.equipmentInstances.map((instance) => [instance.id, instance]),
    );
    const equipmentInstances = state.equipmentInstances.map((instance) => {
      if (resetEquipmentInstanceIds.has(instance.id)) {
        return freshById.get(instance.id) ?? instance;
      }
      if (clearContentsInstanceIds.has(instance.id)) {
        return {
          ...instance,
          contents: emptyContents(),
        };
      }
      if (clearRecordedTemperatureInstanceIds.has(instance.id)) {
        return {
          ...instance,
          contents: {
            ...instance.contents,
            recordedTemperature: undefined,
          },
        };
      }
      return instance;
    });
    state = {
      // This is a scoped, authored equipment reset, not a physical reset of the whole setup, so
      // `solidStockInitializations` is deliberately carried through by this spread. Restoring one
      // vial says nothing about material this setup already moved into a receiver, so reopening
      // its initialization here would let a partial delivery be topped up. Supporting per-source
      // reinitialization needs a complete material-boundary contract, which does not exist yet.
      ...state,
      equipmentInstances,
      attachments: state.attachments.filter(
        (attachment) =>
          !resetEquipmentInstanceIds.has(attachment.childInstanceId) &&
          !resetEquipmentInstanceIds.has(attachment.parentInstanceId),
      ),
      contents: syncContents(equipmentInstances),
      thermalControls: {},
      evidenceScopeId: nextEvidenceScopeId,
      evidenceScopeGeneration: currentEvidenceScopeGeneration(state) + 1,
      photometerCalibration: {},
      photometerCalibrationEpoch: (state.photometerCalibrationEpoch ?? 1) + 1,
    };
  }

  if (actionDefinition.sourceInventory) {
    const contract = actionDefinition.sourceInventory;
    const source = findInstance(
      state,
      action.sourceInstanceId ?? contract.sourceInstanceId,
      contract.sourceDefinitionId ?? stringSetting(params, "sourceDefinitionId") ?? "",
    );
    if (contract.quantityKind === "solid-mass") {
      // A configured solid stock is a gram quantity. It is never compared against the container's
      // mL capacity, and no density relationship is implied anywhere in this branch.
      const massG = action.value ?? (typeof actionDefinition.parameters.configuredValue === "number"
        ? actionDefinition.parameters.configuredValue
        : undefined);
      if (actionDefinition.parameters.inputRole !== "teacherConfiguration" ||
          !source || source.definitionId !== contract.sourceDefinitionId ||
          !Number.isFinite(massG) || Number(massG) <= 0) {
        return fail(
          state,
          "A named solid stock container and a positive configured gram inventory are required.",
          "Select the authored solid stock container and enter its teacher-provided mass in grams.",
          nodeId,
        );
      }
      // Same definition is not the same object. The lifecycle lock below is keyed to one
      // instance, so accepting a sibling vial here would establish stock in a container this step
      // never named and leave the declared one still initializable. `contract.sourceInstanceId` is
      // already the compiled lab identity — the composition compiler rewrites every `*InstanceId`
      // key through the lab's equipment bindings — so this compares resolved bindings, not a
      // technique-local name.
      if (contract.sourceInstanceId && source.id !== contract.sourceInstanceId) {
        return fail(
          state,
          "This setup step is bound to one named stock container, and a different container was selected.",
          "Select the stock container this step declares; another container of the same type is not interchangeable here.",
          nodeId,
        );
      }
      const configuredMassG = Number(massG);
      // Capability, contents compatibility and the one-initialization-per-setup lock live in the
      // shared solid-material rule, so the generic runtime and the green-chemistry route cannot
      // drift apart about which container may take a configured stock. The order and the messages
      // are the ones this branch already used.
      const stockContents = configuredSolidStockContents(
        source,
        equipmentById.get(source.definitionId),
        {
          massG: configuredMassG,
          materialSoluteId: contract.materialSoluteId,
          materialLabel: contract.materialLabel,
          visualState: stringSetting(params, "visualState"),
          alreadyInitialized: state.solidStockInitializations?.[source.id] !== undefined,
        },
      );
      if (!stockContents.ok) {
        return fail(state, stockContents.message, stockContents.recovery, nodeId);
      }
      const next = updateInstance(state, source.id, (instance) => ({
        ...instance,
        contents: stockContents.contents,
      }));
      return {
        ok: true,
        state: {
          ...next,
          // The marker and the material it describes leave this handler in one state object, so
          // neither can be committed without the other. Every rejection above returns before the
          // material is written, and a typed source-inventory action is transactional in
          // `performRuntimeAction`, so a later handler failure discards both together.
          solidStockInitializations: {
            ...next.solidStockInitializations,
            [source.id]: {
              actionId: actionDefinition.id,
              materialSoluteId: contract.materialSoluteId,
              configuredMassG,
              evidenceScopeId: next.evidenceScopeId,
              evidenceScopeGeneration: currentEvidenceScopeGeneration(next),
            },
          },
          measurements: [
            ...next.measurements.filter((entry) => entry.id !== contract.outputMeasurementId),
            {
              id: contract.outputMeasurementId,
              label: actionDefinition.label,
              value: configuredMassG,
              unit: "g",
              equipmentInstanceId: source.id,
              nodeId,
              // Attempt provenance only. No `quantityKind` is stamped, so this setup record can
              // never satisfy a mass-continuity consumer that expects a balance reading.
              sourceActionId: actionDefinition.id,
              evidenceScopeId: next.evidenceScopeId,
              evidenceScopeGeneration: currentEvidenceScopeGeneration(next),
            },
          ],
        },
        message: actionDefinition.feedback.success,
      };
    }
    const volumeMl = action.value ?? (typeof actionDefinition.parameters.configuredValue === "number"
      ? actionDefinition.parameters.configuredValue
      : undefined);
    if (actionDefinition.parameters.inputRole !== "teacherConfiguration" ||
        !source || !["liquid", "solution"].includes(source.contents.kind) ||
        !Number.isFinite(volumeMl) || Number(volumeMl) <= 0) {
      return fail(
        state,
        "A named nonempty liquid source and positive configured mL inventory are required.",
        "Select the authored source and enter its teacher-provided inventory volume.",
        nodeId,
      );
    }
    const declaredDefinition = equipmentById.get(contract.sourceDefinitionId);
    const actualDefinition = source ? equipmentById.get(source.definitionId) : undefined;
    const capacityProven = Boolean(
      declaredDefinition && actualDefinition && source?.definitionId === contract.sourceDefinitionId &&
      declaredDefinition.capacity.unit === "mL" && Number.isFinite(declaredDefinition.capacity.amount) && declaredDefinition.capacity.amount > 0 &&
      actualDefinition.capacity.unit === "mL" && Number.isFinite(actualDefinition.capacity.amount) && actualDefinition.capacity.amount > 0,
    );
    if (!capacityProven) {
      return fail(state, "The authored inventory source lacks a matching positive mL capacity.", "Use the declared capacity-bearing liquid source.", nodeId);
    }
    if (Number(volumeMl) > actualDefinition!.capacity.amount) {
      return fail(state, "The configured inventory exceeds the source capacity.", "Enter a volume that fits the authored source.", nodeId);
    }
    const next = updateInstance(state, source.id, (instance) => ({
      ...instance,
      contents: { ...instance.contents, volumeMl: Number(volumeMl) },
    }));
    return {
      ok: true,
      state: {
        ...next,
        measurements: [
          ...next.measurements.filter((entry) => entry.id !== contract.outputMeasurementId),
          { id: contract.outputMeasurementId, label: actionDefinition.label, value: Number(volumeMl), unit: "mL", equipmentInstanceId: source.id, nodeId },
        ],
      },
      message: actionDefinition.feedback.success,
    };
  }

  if (actionDefinition.materialTransition) {
    const target = findInstance(
      state,
      action.targetInstanceId ?? stringSetting(params, "targetInstanceId"),
      stringSetting(params, "targetDefinitionId") ?? "",
    );
    if (!target || target.contents.kind === "empty" ||
        ((target.contents.volumeMl ?? 0) <= 0 && (target.contents.massG ?? 0) <= 0 && target.contents.solutes.length === 0)) {
      return fail(state, "The qualitative transition requires existing material in the target.", "Prepare the named material before confirming its transition.", nodeId);
    }
    const transition = actionDefinition.materialTransition;
    // Only the four declared qualitative fields move. Volume, mass, solutes, concentration and
    // provenance are carried through untouched, so no confirmation can manufacture a quantity.
    const transitioned = updateInstance(state, target.id, (instance) => ({
      ...instance,
      contents: {
        ...instance.contents,
        kind: transition.kind ?? instance.contents.kind,
        label: transition.label ?? instance.contents.label,
        wetState: transition.wetState ?? instance.contents.wetState,
        visualState: transition.visualState ?? instance.contents.visualState,
      },
    }));
    const externalConfirmation = actionDefinition.verb === "observe" &&
      actionDefinition.interaction?.type === "recordNotebook";
    return {
      ok: true,
      // The external form asserts that a teacher completed the operation, so the assertion itself
      // belongs in the notebook. The learner-performed dissolve form keeps its original behaviour
      // and records nothing here.
      state: externalConfirmation
        ? addNotebook(
            transitioned,
            nodeId,
            actionDefinition.label,
            transition.label ?? target.contents.label,
            [
              "observe",
              "external-teacher-operation",
              ...(stringSetting(params, "tag") ? [stringSetting(params, "tag")!] : []),
            ],
            "observation",
          )
        : transitioned,
      message: actionDefinition.feedback.success,
    };
  }

  const photometerApprovalMode = stringSetting(params, "photometerApprovalMode");
  if (photometerApprovalMode === "selected-wavelength") {
    const chosen = action.note?.trim();
    const configuredOptions = Array.isArray(params.inputOptions)
      ? params.inputOptions.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (!chosen || (configuredOptions.length > 0 && !configuredOptions.includes(chosen))) {
      return fail(
        state,
        "The teacher wavelength approval is missing or is not declared.",
        "Choose the authored teacher approval option for the recorded student proposal.",
        nodeId,
      );
    }
    const proposalMeasurementId = stringSetting(params, "proposalMeasurementId");
    const proposalMeasurement = proposalMeasurementId
      ? state.measurements.find((measurement) => measurement.id === proposalMeasurementId)
      : undefined;
    const proposedWavelengthNm = proposalMeasurement?.value;
    if (
      !proposalMeasurementId ||
      !proposalMeasurement ||
      proposalMeasurement.unit !== "nm" ||
      typeof proposedWavelengthNm !== "number" ||
      !Number.isFinite(proposedWavelengthNm)
    ) {
      return fail(
        state,
        "Teacher approval cannot be recorded without the student's wavelength proposal.",
        "Record the proposed wavelength in nm, then obtain teacher approval for that proposal.",
        nodeId,
      );
    }
    const photometerInstanceId = stringSetting(params, "photometerInstanceId");
    if (!photometerInstanceId) {
      return fail(
        state,
        "The teacher approval names no photometer.",
        "Bind the approved wavelength to the spectrophotometer that the later calibration steps use.",
        nodeId,
      );
    }
    const currentEpoch = state.photometerCalibrationEpoch ?? 1;
    const previous = state.photometerCalibration?.[photometerInstanceId];
    if (
      !previous ||
      previous.epoch !== currentEpoch ||
      previous.proposedWavelengthNm !== proposedWavelengthNm
    ) {
      return fail(
        state,
        "The teacher approval does not match the current wavelength proposal.",
        "Approve the wavelength most recently recorded by the student before configuring the instrument.",
        nodeId,
      );
    }
    const nextCalibration: PhotometerCalibrationState = {
      ...(previous?.epoch === currentEpoch ? previous : { epoch: currentEpoch }),
      epoch: currentEpoch,
      proposedWavelengthNm,
      approvedWavelengthNm: proposedWavelengthNm,
    };
    return {
      ok: true,
      state: addNotebook(
        {
          ...state,
          photometerCalibration: {
            ...(state.photometerCalibration ?? {}),
            [photometerInstanceId]: nextCalibration,
          },
          photometerCalibrationEpoch: currentEpoch,
        },
        nodeId,
        actionDefinition.label,
        chosen,
        [
          "observe",
          stringSetting(params, "tag") ?? "teacher-wavelength-approval",
          "teacher-wavelength-approval",
          `wavelength:${proposedWavelengthNm}nm`,
        ],
        "observation",
      ),
      message: actionDefinition.feedback.success,
    };
  }

  if (actionDefinition.choiceObservation) {
    const chosen = action.note?.trim();
    const option = actionDefinition.choiceObservation.options.find((entry) => entry.label === chosen);
    if (!option) {
      return fail(state, "The observed outcome is missing or is not declared.", "Choose one of the authored physical observations.", nodeId);
    }
    const calculationId = actionDefinition.choiceObservation.outputCalculationId;
    const next: RuntimeState = {
      ...state,
      calculations: [
        ...state.calculations.filter((entry) => entry.id !== calculationId),
        { id: calculationId, label: `${actionDefinition.label}: ${option.label}`, value: option.value, unit: option.tag, expected: option.value, tolerance: 0, passed: true, nodeId },
      ],
    };
    return {
      ok: true,
      state: addNotebook(next, nodeId, actionDefinition.label, option.label, ["observe", calculationId, option.tag], "observation"),
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "place") {
    if (stringSetting(params, "phProbeOperation") === "immerse") {
      const sourceDefinitionId =
        stringSetting(params, "sourceDefinitionId") ?? actionDefinition.interaction?.sourceDefinitionId;
      const targetDefinitionId =
        stringSetting(params, "targetDefinitionId") ?? actionDefinition.interaction?.targetDefinitionId;
      const meter = findInstance(state, action.sourceInstanceId, sourceDefinitionId);
      const vessel = findInstance(state, action.targetInstanceId, targetDefinitionId);
      if (!meter || !vessel) {
        return fail(
          state,
          "The pH probe or titration flask is not selected.",
          "Select the pH meter, select the titration flask, then confirm Immerse probe.",
          nodeId,
        );
      }
      if (meter.location === "shelf") {
        return fail(
          state,
          "The pH meter is still on the shelf.",
          "Place the meter on the workbench; only the probe is immersed in the flask.",
          nodeId,
        );
      }
      if (vessel.contents.kind === "empty" || (vessel.contents.volumeMl ?? 0) <= 0) {
        return fail(
          state,
          "The probe cannot be immersed in an empty flask.",
          "Prepare the titration mixture before immersing the probe bulb.",
          nodeId,
        );
      }
      const dispenseActionId = stringSetting(params, "dispenseActionId") ?? "deliver-titrant";
      const dispense = state.dropDispenses[dispenseActionId];
      if (!dispense?.accepted && !state.titrationTrials?.[stringSetting(params, "trialReferenceId") ?? ""]) {
        return fail(
          state,
          "No accepted endpoint is available for this probe placement.",
          "Accept the indicator endpoint before immersing the prepared probe.",
          nodeId,
        );
      }
      const readinessTag = stringSetting(params, "meterReadinessNotebookTag") ?? "ph-meter-ready";
      if (!state.notebook.some((entry) => entry.tags.includes(readinessTag))) {
        return fail(
          state,
          "The pH meter has not been confirmed ready.",
          "Confirm the teacher-approved meter readiness, calibration, rinsing, and stability rules before immersion.",
          nodeId,
        );
      }
      const withProbe = updateInstance(state, meter.id, (instance) => ({
        ...instance,
        contents: {
          ...instance.contents,
          probeImmersedInInstanceId: vessel.id,
          instrumentReadout: undefined,
        },
      }));
      return {
        ok: true,
        state: addNotebook(
          withProbe,
          nodeId,
          actionDefinition.label,
          `The pH probe is immersed in ${vessel.label}; the meter remains on the workbench.`,
          ["place", "ph-probe-immersed", vessel.id],
        ),
        message: actionDefinition.feedback.success,
      };
    }
    const interactionSnapZoneId =
      actionDefinition.interaction?.type === "snapIntoTarget"
        ? actionDefinition.interaction.snapZoneId
        : undefined;
    const nextLocation = action.location ?? (interactionSnapZoneId ? "snapZone" : "workbench");
    const equipment = findInstance(
      state,
      action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId") ?? stringSetting(params, "equipmentInstanceId"),
      action.equipmentDefinitionId ?? String(params.equipmentDefinitionId ?? ""),
    );
    if (!equipment) {
      return fail(
        state,
        "Equipment to place was not found.",
        "Choose an item from the equipment shelf.",
        nodeId,
      );
    }
    const snapZoneId =
      nextLocation === "snapZone"
        ? params.snapZoneId
          ? String(params.snapZoneId)
          : interactionSnapZoneId
            ? interactionSnapZoneId
            : equipment.snapZoneId
        : undefined;
    const target =
      snapZoneId && nextLocation === "snapZone"
        ? findParentForSnap(
            state,
            action.targetInstanceId,
            String(params.targetDefinitionId ?? actionDefinition.interaction?.targetDefinitionId ?? ""),
            snapZoneId,
          )
        : undefined;
    const attachmentCheck =
      target && snapZoneId && nextLocation === "snapZone"
        ? canAttach(state, target, equipment, snapZoneId)
        : undefined;
    // Taking a strip back out is the mirror of putting it in: a closed lid refuses both. `canAttach`
    // covers entry; this covers the exit, which reaches here as a `place` back onto the workbench.
    const currentParentId = attachmentsForChild(state, equipment.id)[0]?.parentInstanceId;
    const currentParent = currentParentId ? findInstance(state, currentParentId) : undefined;
    if (nextLocation !== "snapZone" && currentParent) {
      const closedParent = closedChamberAccessRefusal(currentParent);
      if (closedParent) return fail(state, closedParent.message, closedParent.recovery, nodeId);
    }
    const compositeDefinitionId = stringSetting(params, "compositeDefinitionId");
    // The registry, not the action parameter, decides what these pieces assemble into and what the
    // learner is told when they do not. Before Cycle 05 this path trusted the parameter and carried
    // funnel-specific recovery prose for every apparatus that ever used it.
    const registeredSwap =
      compositeDefinitionId && target && snapZoneId && nextLocation === "snapZone"
        ? instanceSwapCompositeFor({
            parentDefinitionId: target.definitionId,
            childDefinitionId: equipment.definitionId,
            snapZoneId,
          })
        : undefined;
    if (attachmentCheck && !attachmentCheck.ok) {
      // `canAttach` says what went wrong more precisely than any registry entry can; the composite,
      // when there is one, says how to fix it in terms of the apparatus the learner is holding.
      return fail(
        state,
        attachmentCheck.message,
        registeredSwap?.invalidFeedback?.recovery ?? attachmentCheck.recovery,
        nodeId,
      );
    }
    if (compositeDefinitionId && target && snapZoneId && nextLocation === "snapZone") {
      if (!registeredSwap || registeredSwap.resultInstanceDefinitionId !== compositeDefinitionId) {
        // An authoring error, not a learner error: the pieces may fit perfectly and still name an
        // assembly the registry does not publish. The registry's own invalidFeedback describes a
        // seating that failed, so it deliberately does not speak here.
        return fail(
          state,
          "The simulator has no registered assembly for those pieces.",
          "Follow the assembly step the technique defines for this apparatus.",
          nodeId,
        );
      }
      const composite =
        state.equipmentInstances.find(
          (instance) =>
            instance.definitionId === compositeDefinitionId &&
            instance.location === "storage",
        ) ?? firstByDefinition(state, compositeDefinitionId);
      if (!composite) {
        return fail(
          state,
          "The assembled apparatus is not available.",
          "Reset the lab so the assembled apparatus can be restored.",
          nodeId,
        );
      }
      const compositeX = numericParameter(action.parameters, "targetX") ?? target.x ?? numericParameter(action.parameters, "x");
      const compositeY = numericParameter(action.parameters, "targetY") ?? target.y ?? numericParameter(action.parameters, "y");
      const compositeZ =
        numericParameter(action.parameters, "targetZIndex") ??
        target.zIndex ??
        numericParameter(action.parameters, "zIndex");
      const equipmentInstances = state.equipmentInstances.map((instance) => {
        if (instance.id === equipment.id || instance.id === target.id) {
          return {
            ...instance,
            location: "storage" as const,
            snapZoneId: undefined,
            x: undefined,
            y: undefined,
            zIndex: undefined,
            interactionStatus: "locked" as const,
          };
        }
        if (instance.id === composite.id) {
          return {
            ...instance,
            location: "workbench" as const,
            snapZoneId: undefined,
            x: compositeX,
            y: compositeY,
            zIndex: compositeZ,
            interactionStatus: "free" as const,
          };
        }
        return instance;
      });
      const assembled = removeAttachmentsForInstances(
        {
          ...state,
          equipmentInstances,
          contents: syncContents(equipmentInstances),
        },
        [equipment.id, target.id, composite.id],
      );
      return { ok: true, state: assembled, message: actionDefinition.feedback.success };
    }
    const withPlacedChild = updateInstance(state, equipment.id, (instance) => ({
      ...instance,
      location: nextLocation,
      snapZoneId,
      x: numericParameter(action.parameters, "x") ?? instance.x,
      y: numericParameter(action.parameters, "y") ?? instance.y,
      zIndex: numericParameter(action.parameters, "zIndex") ?? instance.zIndex,
      interactionStatus: nextLocation === "snapZone" ? "snapped" : "free",
    }));
    const next =
      target && nextLocation === "snapZone" && target.location === "shelf"
        ? updateInstance(withPlacedChild, target.id, (instance) => ({
            ...instance,
            location: "workbench",
            x: numericParameter(action.parameters, "targetX") ?? instance.x,
            y: numericParameter(action.parameters, "targetY") ?? instance.y,
            zIndex: numericParameter(action.parameters, "targetZIndex") ?? instance.zIndex,
            interactionStatus: "free",
          }))
        : withPlacedChild;
    const withAttachment =
      attachmentCheck && attachmentCheck.ok
        ? upsertAttachment(next, attachmentCheck.attachment)
        : nextLocation === "snapZone"
          ? next
          : detachChild(next, equipment.id);
    const targetVisualState = stringSetting(params, "targetVisualState");
    const withTargetVisualState =
      target && attachmentCheck?.ok && targetVisualState
        ? updateInstance(withAttachment, target.id, (instance) => ({
            ...instance,
            contents: {
              ...instance.contents,
              visualState: targetVisualState,
            },
          }))
        : withAttachment;
    return { ok: true, state: withTargetVisualState, message: actionDefinition.feedback.success };
  }

  if (action.verb === "weigh") {
    const source = findInstance(
      state,
      action.sourceInstanceId,
      String(params.sourceDefinitionId ?? params.targetDefinitionId ?? ""),
    );
    if (!source) {
      return fail(state, "No item is available to weigh.", "Select the item that belongs on the balance.", nodeId);
    }
    const producerContinuity = producerContinuityFor(actionDefinition);
    if (producerContinuity && source.id !== producerContinuity.measuredSupportInstanceId) {
      return fail(
        state,
        "The named balance support does not match this continuity-aware measurement.",
        "Place the declared support on the balance before recording this mass.",
        nodeId,
      );
    }
    if (
      producerContinuity?.quantityKind === "material-portion" &&
      !findInstance(state, producerContinuity.materialSourceInstanceId)
    ) {
      return fail(
        state,
        "The declared material source is unavailable for this measurement.",
        "Use the named stock or carrier before recording the material portion.",
        nodeId,
      );
    }
    const maxSafeTemperatureC = Number(params.maxSafeTemperatureC ?? params.safeWeighTemperatureC ?? 40);
    if (
      Number.isFinite(maxSafeTemperatureC) &&
      typeof source.contents.temperatureC === "number" &&
      source.contents.temperatureC > maxSafeTemperatureC
    ) {
      return fail(
        state,
        `The ${source.label} is too hot to weigh.`,
        `Cool the ${source.label} before placing it on the analytical balance.`,
        nodeId,
      );
    }
    const contractedMassG = resolveContractedMassG(state, action, actionDefinition);
    if (actionDefinition.mass && contractedMassG === undefined) {
      return fail(
        state,
        producerContinuity?.quantityKind === "balance-display"
          ? "The required finite balance-display evidence is missing."
          : "The required positive mass evidence is missing.",
        actionDefinition.mass.source === "action-input"
          ? producerContinuity?.quantityKind === "balance-display"
            ? "Enter the finite non-negative mass displayed by the balance."
            : "Enter the finite positive mass displayed by the balance."
          : "Complete the named mass measurement before continuing.",
        nodeId,
      );
    }
    const measurementId = String(
      actionDefinition.mass?.source === "action-input"
        ? actionDefinition.mass.outputMeasurementId
        : (params.measurementId ?? action.measurementId ?? "mass"),
    );
    if (params.requiresObservedResidue === true && (!source.contents.recoveryEvidence?.residueObserved || !source.contents.recoveryEvidence.dry || source.contents.wetState !== "dry")) return fail(state, "No observed dry residue is ready for weighing.", "Collect, dry and cool the named fraction before acquiring its mass.", nodeId);
    // The dry-precipitate gate used to be reachable only through one hard-coded measurement id, so
    // any gravimetric flow that names its measurement differently — every Investigation 3 combined
    // mass does — got no gate at all. An action may now ask for it by name.
    if (measurementId === "dry-precipitate-mass" || booleanSetting(params, "requiresDryPrecipitate")) {
      if (!source.contents.precipitate) {
        return fail(
          state,
          "Dry precipitate is not available on the watch glass.",
          "Dry the collected precipitate on the watch glass before weighing it.",
          nodeId,
        );
      }
      if (source.contents.precipitate.dryness !== "dry" || source.contents.wetState !== "dry") {
        return fail(
          state,
          "The precipitate is still wet.",
          "Dry the precipitate before placing it on the balance.",
          nodeId,
        );
      }
    }
    const expected = Number(params.expectedMassG ?? source.contents.precipitate?.dryMassG ?? source.contents.precipitate?.massG ?? source.contents.massG ?? 0);
    const value = contractedMassG ?? action.value ?? expected;
    const massContract = actionDefinition.mass;
    if (massContract?.source === "action-input" && massContract.confirmLatestMeasurementIds) {
      const prior = [...state.measurements].reverse().find((entry) => massContract.confirmLatestMeasurementIds!.includes(entry.id));
      if (!prior && !state.calculations.some((entry) => entry.id === massContract.noRepeatCalculationId && entry.value === 0)) return fail(state, "The accepted repeat reading is missing.", "Complete the chosen constant-mass path; only an explicit no-extra-cycle choice may omit repeat evidence.", nodeId);
      if (prior) {
        const criterion = state.measurements.find((entry) => entry.id === massContract.toleranceMeasurementId);
        if (!criterion || criterion.unit !== "g" || prior.unit !== "g" || prior.equipmentInstanceId !== source.id || !Number.isFinite(criterion.value) || criterion.value < 0 || Math.abs(value - prior.value) > criterion.value) {
          return fail(state, "The final reading no longer agrees with this assembly's accepted cooled mass.", "Recheck the reading. If the mass has changed beyond the approved tolerance, retain the sample and request instructor review; do not report it as constant.", nodeId);
        }
      }
    }
    const tolerance = Number(params.tolerance ?? 0.005);
    if (!actionDefinition.mass && !isWithinTolerance(value, expected, tolerance)) {
      return fail(
        state,
        `Mass ${value} g is outside the expected tolerance.`,
        "Reweigh the correct item and record the displayed mass.",
        nodeId,
      );
    }
    const inventoryState =
      actionDefinition.mass?.source === "action-input" &&
      actionDefinition.mass.applyToSourceInventory &&
      !actionDefinition.mass.continuity
        ? updateInstance(state, source.id, (instance) => ({
            ...instance,
            contents: {
              ...instance.contents,
              kind: instance.contents.kind === "empty" ? "solid" : instance.contents.kind,
              massG: value,
              label: instance.contents.kind === "empty" ? source.label : instance.contents.label,
              wetState: "dry",
              visualState: instance.contents.visualState === "empty" ? "solid-sample" : instance.contents.visualState,
            },
          }))
        : state;
    return {
      ok: true,
      state: {
        ...inventoryState,
        measurements: [
          ...inventoryState.measurements.filter((measurement) =>
            producerContinuity
              ? !(
                  measurement.id === measurementId &&
                  measurementMatchesContinuity(measurement, inventoryState, producerContinuity)
                )
              : measurement.id !== measurementId,
          ),
          {
            id: measurementId,
            label: actionDefinition.label,
            value,
            unit: "g",
            equipmentInstanceId: source.id,
            nodeId,
            ...(producerContinuity
              ? {
                  sourceActionId: actionDefinition.id,
                  evidenceScopeId: inventoryState.evidenceScopeId,
                  evidenceScopeGeneration: currentEvidenceScopeGeneration(inventoryState),
                  measuredSupportInstanceId: producerContinuity.measuredSupportInstanceId,
                  materialSourceInstanceId: producerContinuity.materialSourceInstanceId,
                  quantityKind: producerContinuity.quantityKind,
                }
              : {}),
          },
        ],
      },
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "measureVolume") {
    // Reading a graduated instrument is not the same operation as pouring into one. Every
    // measureVolume before Cycle 09 was a pour, so `atom.measure.read-burette` — declared by Cycle
    // 02 as measureVolume + readInstrument — had no runtime path at all, and the three titration
    // flows recorded burette readings as authored `value:` constants instead. This branch reads the
    // instrument and moves nothing. Content that uses `pourInto` is untouched.
    if (actionDefinition.interaction?.type === "readInstrument") {
      const instrument = findInstance(
        state,
        action.sourceInstanceId,
        String(params.sourceDefinitionId ?? ""),
      );
      if (!instrument) {
        return fail(
          state,
          "The instrument to read is not available.",
          "Place the graduated instrument on the workbench before reading it.",
          nodeId,
        );
      }
      const instrumentDefinition = equipmentById.get(instrument.definitionId);
      const capacityMl =
        instrumentDefinition?.capacity.unit === "mL" ? instrumentDefinition.capacity.amount : 0;
      if (capacityMl <= 0) {
        return fail(
          state,
          `The ${instrument.label} has no volume scale to read.`,
          "Read a graduated instrument such as the burette or a graduated cylinder.",
          nodeId,
        );
      }
      const contentsMl = instrument.contents.volumeMl ?? 0;
      if (instrument.contents.kind === "empty" || contentsMl <= 0) {
        return fail(
          state,
          `The ${instrument.label} is empty.`,
          "Condition and fill the burette with titrant before taking a reading.",
          nodeId,
        );
      }
      // A burette is graduated downwards from 0 at the top, so its reading is the volume already
      // delivered rather than the volume remaining. A cylinder or a pipette reads the other way. The
      // default is the upward, "how much is in it" reading: an action that forgets to declare the
      // direction then reports a plain contents reading rather than a silently inverted one, and
      // `cycle09/burette-read-scale-undeclared` fails any burette read that leaves it unsaid.
      const scaleReadsDownward = booleanSetting(params, "scaleReadsDownward") === true;
      const rawReadingMl = scaleReadsDownward ? capacityMl - contentsMl : contentsMl;
      const precisionMl = numberSetting(
        params,
        "readingPrecisionMl",
        instrumentDefinition?.precision.unit === "mL" && instrumentDefinition.precision.amount > 0
          ? instrumentDefinition.precision.amount
          : 0.01,
      );
      if (!Number.isFinite(precisionMl) || precisionMl <= 0) {
        return fail(
          state,
          "The configured reading precision is not a usable value.",
          "Set readingPrecisionMl to one of the resolutions the approved plan lists.",
          nodeId,
        );
      }
      const readingMl = roundToInstrumentMl(Math.round(rawReadingMl / precisionMl) * precisionMl);
      const measurementId = String(params.measurementId ?? action.measurementId ?? "burette-reading");
      return {
        ok: true,
        state: upsertMeasurement(
          state,
          measurementId,
          String(params.label ?? actionDefinition.label),
          readingMl,
          "mL",
          instrument.id,
          nodeId,
        ),
        message: actionDefinition.feedback.success,
      };
    }
    const source = findInstance(state, action.sourceInstanceId, String(params.sourceDefinitionId ?? ""));
    const target = findInstance(state, action.targetInstanceId, String(params.targetDefinitionId ?? ""));
    if (!source || !target) {
      return fail(state, "Source or measurement instrument is missing.", "Select the sample and cylinder.", nodeId);
    }
    const preparationModelId = stringSetting(actionDefinition.parameters, "titrationPreparationModelId");
    if (preparationModelId) {
      const model = findTitrationModel(definition, preparationModelId);
      const requested = Number(action.value ?? actionDefinition.parameters.volumeMl);
      const acidAliquotId = stringSetting(actionDefinition.parameters, "titrationAcidAliquotMeasurementId");
      if (!model || model.type !== "redox" || !model.stoichiometricRatio) return fail(state, "The approved redox preparation model is missing.", "Review the configuration before measuring.", nodeId);
      if (acidAliquotId) {
        const aliquot = state.measurements.find(m => m.id === acidAliquotId);
        // Conservative first-proton stoichiometric floor; excess acidity remains teacher-approved.
        const protonsPerAnalyte = model.stoichiometricRatio.titrant === 1 ? 8 / 5 : 6 / 5;
        if (!aliquot || requested * 6 < model.analyteMolarityM * aliquot.value * protonsPerAnalyte)
          return fail(state, "This acid dose is outside the supported acidified-reaction domain.", "Use the instructor-approved excess acid dose for the measured aliquot, within the source limit. A trace addition is insufficient.", nodeId);
      } else {
        const maximum = Number(actionDefinition.parameters.maximumTrialDeliveryMl);
        const required = requested * model.analyteMolarityM * model.stoichiometricRatio.titrant / (model.titrantMolarityM * model.stoichiometricRatio.analyte);
        if (!Number.isFinite(required) || required + 1 > maximum)
          return fail(state, "This aliquot exceeds the supported single-burette trial domain.", "Obtain approval for a smaller prepared aliquot before consuming sample; this procedure does not support a mid-trial refill.", nodeId);
      }
    }
    const contracted = actionDefinition.volume
      ? resolveContractedVolume(state, action, actionDefinition, target)
      : undefined;
    if (contracted && !contracted.ok) {
      return fail(state, contracted.message, contracted.recovery, nodeId);
    }
    const configuredTargetVolumeMl = numberSetting(params, "targetVolumeMl", Number.NaN);
    const topsUpToConfiguredTarget = Number.isFinite(configuredTargetVolumeMl);
    const volumeMl = contracted?.ok
      ? contracted.finalTargetVolumeMl
      : topsUpToConfiguredTarget
        ? configuredTargetVolumeMl
        : Number(action.value ?? params.volumeMl ?? 0);
    const sourceDefinition = equipmentById.get(source.definitionId);
    if (!sourceDefinition?.affordances.includes("pourable")) {
      return fail(
        state,
        "The selected source is not pourable.",
        "Use a sample bottle, beaker, or other pourable container as the source.",
        nodeId,
      );
    }
    const currentTargetVolumeMl = target.contents.volumeMl ?? 0;
    const deliveredVolumeMl = contracted?.ok
      ? contracted.deliveredVolumeMl
      : topsUpToConfiguredTarget
        ? volumeMl - currentTargetVolumeMl
        : volumeMl;
    if (!Number.isFinite(volumeMl) || volumeMl < 0 || !Number.isFinite(deliveredVolumeMl) || deliveredVolumeMl <= 0) {
      return fail(
        state,
        "The configured fill target must be above the current liquid level.",
        "Choose a higher target volume or continue with the next measurement step.",
        nodeId,
      );
    }
    if ((source.contents.volumeMl ?? 0) < deliveredVolumeMl) {
      return fail(state, "The source does not contain enough liquid.", "Choose a source with enough volume.", nodeId);
    }
    const targetDefinition = equipmentById.get(target.definitionId);
    if (targetDefinition?.capacity.unit === "mL" && volumeMl > targetDefinition.capacity.amount) {
      return fail(
        state,
        "The target equipment cannot hold the requested volume.",
        "Use a larger measuring container or reduce the measured volume.",
        nodeId,
      );
    }
    const conservedSplit = (
      actionDefinition.volume &&
      isOrdinaryLiquidContent(source.contents) &&
      (target.contents.kind === "empty" || isOrdinaryLiquidContent(target.contents))
    ) || canConserveOrdinaryContent(source.contents, target.contents, actionDefinition)
      ? splitContentForVolume(source.contents, deliveredVolumeMl)
      : undefined;
    const nextContents: ContentState = conservedSplit
      ? {
          ...mergeTransferredContents(target.contents, conservedSplit.transferredContents),
          volumeMl,
          visualState: stringSetting(params, "visualState") ?? source.contents.visualState ?? "measured-liquid",
        }
      : {
          ...cloneContent(source.contents),
          volumeMl,
          visualState: stringSetting(params, "visualState") ?? source.contents.visualState ?? "measured-liquid",
        };
    const next = updateInstance(state, target.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: nextContents,
    }));
    const remainingSourceVolume = Math.max(0, (source.contents.volumeMl ?? 0) - deliveredVolumeMl);
    const withDecrementedSource = updateInstance(next, source.id, (instance) => ({
      ...instance,
      contents: conservedSplit
        ? conservedSplit.remainingContents
        : remainingSourceVolume === 0
          ? emptyContents()
          : {
              ...instance.contents,
              volumeMl: remainingSourceVolume,
              visualState: instance.contents.visualState === "empty" ? "clear-liquid" : instance.contents.visualState,
            },
    }));
    const measurementId = String(
      actionDefinition.volume?.outputMeasurementId ??
      params.measurementId ??
      action.measurementId ??
      "volume",
    );
    return {
      ok: true,
      state: {
        ...withDecrementedSource,
        measurements: [
          ...withDecrementedSource.measurements.filter((measurement) => measurement.id !== measurementId),
          {
            id: measurementId,
            label: actionDefinition.label,
            value: volumeMl,
            unit: "mL",
            equipmentInstanceId: target.id,
            nodeId,
          },
        ],
      },
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "transfer") {
    if (actionDefinition.interaction?.type === "dispenseDrops") {
      if (actionDefinition.deliveryDevice) {
        return fail(
          state,
          "A typed delivery device cannot be bypassed by a direct drop-dispense interaction.",
          "Use a mediated volume-transfer interaction or remove the typed delivery-device contract.",
          nodeId,
        );
      }
      return executeDropDispense(state, action, actionDefinition, nodeId, params);
    }

    const source = findInstance(
      state,
      action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId"),
      String(params.sourceDefinitionId ?? ""),
    );
    const target = findInstance(
      state,
      action.targetInstanceId ?? stringSetting(params, "targetInstanceId"),
      String(params.targetDefinitionId ?? ""),
    );
    if (!source || !target) {
      return fail(state, "Source or target is missing.", "Select the source container and receiving container.", nodeId);
    }
    // Solvent access obeys the same lid. Adding the mobile phase to a sealed chamber is refused here
    // rather than only in the process ordering, so an object-interaction pour cannot bypass it.
    const closedTarget = closedChamberAccessRefusal(target);
    if (closedTarget) return fail(state, closedTarget.message, closedTarget.recovery, nodeId);
    const consumerContinuity =
      actionDefinition.mass?.source === "measurement"
        ? actionDefinition.mass.continuity
        : undefined;
    if (consumerContinuity) {
      if (consumerContinuity.quantityKind !== "material-portion") {
        return fail(
          state,
          "A balance-display measurement cannot authorize a material transfer.",
          "Use a continuity-aware material-portion measurement for a solid transfer.",
          nodeId,
        );
      }
      const declaredSupport = findInstance(state, consumerContinuity.measuredSupportInstanceId);
      const declaredSource = findInstance(state, consumerContinuity.materialSourceInstanceId);
      if (!declaredSupport || !declaredSource || source.id !== declaredSource.id) {
        return fail(
          state,
          "The selected source does not match the declared continuity evidence.",
          "Use the named measured source and its declared balance support before transferring it.",
          nodeId,
        );
      }
    }
    const hasSolidTransferContract = actionDefinition.solidTransfer !== undefined
      || params.emptyRemainingSolid === true
      || params.requireNonEmptySolidSource === true;
    const sourceCarriesSolidState = source.contents.kind === "solid"
      || source.contents.kind === "mixture"
      || (source.contents.qualitativeSolidProvenance?.length ?? 0) > 0;
    if (
      actionDefinition.parameters.allowEmptySource === true
      && source.contents.kind === "empty"
      && !consumerContinuity
      && !hasSolidTransferContract
      && !sourceCarriesSolidState
    ) {
      return { ok: true, state, message: "The receiver is already empty; no material was transferred." };
    }
    const contracted = actionDefinition.volume
      ? resolveContractedVolume(state, action, actionDefinition, target)
      : undefined;
    if (contracted && !contracted.ok) {
      return fail(state, contracted.message, contracted.recovery, nodeId);
    }
    const volumeMl = contracted?.ok
      ? contracted.deliveredVolumeMl
      : Number(action.value ?? params.volumeMl ?? source.contents.volumeMl ?? 0);
    if (actionDefinition.parameters.requireFullTransfer === true && (volumeMl !== source.contents.volumeMl || target.contents.kind !== "empty")) return fail(state, "Transfer the complete named portion into its empty receiver.", "A partial transfer or occupied receiver would leave material outside this approved recovery path.", nodeId);
    const deliveryContract = actionDefinition.deliveryDevice;
    if (deliveryContract) {
      const device = findInstance(
        state,
        deliveryContract.deviceInstanceId,
        deliveryContract.deviceDefinitionId ?? "",
      );
      const deviceDefinition = device ? equipmentById.get(device.definitionId) : undefined;
      const selectorsAgree = device &&
        (!deliveryContract.deviceInstanceId || device.id === deliveryContract.deviceInstanceId) &&
        (!deliveryContract.deviceDefinitionId || device.definitionId === deliveryContract.deviceDefinitionId);
      const pairwiseDistinct = device && source.id !== target.id && source.id !== device.id && target.id !== device.id;
      const compatible = selectorsAgree && pairwiseDistinct && device.location !== "shelf" &&
        deviceDefinition?.capacity.unit === "mL" && deviceDefinition.capacity.amount >= volumeMl &&
        deviceDefinition.precision.unit === "mL" && deviceDefinition.precision.amount > 0 &&
        deviceDefinition.affordances.includes("fillable") && deviceDefinition.affordances.includes("pourable") &&
        device.contents.kind === "empty" && (device.contents.volumeMl ?? 0) === 0;
      if (!compatible) {
        return fail(
          state,
          "The named calibrated delivery device is missing, occupied, off-shelf, incompatible, or too small.",
          "Place an empty compatible calibrated volume-delivery device whose range includes the required aliquot.",
          nodeId,
        );
      }
    }
    const sourceDefinition = equipmentById.get(source.definitionId);
    if (!sourceDefinition?.affordances.includes("pourable")) {
      return fail(
        state,
        "The selected source is not pourable.",
        "Use a bottle, cylinder, beaker, or other pourable container as the source.",
        nodeId,
      );
    }
    const normalizedSolidTransfer = normalizeSolidTransferContract(
      actionDefinition.solidTransfer,
      params,
    );
    if (normalizedSolidTransfer?.ok === false) {
      return fail(
        state,
        normalizedSolidTransfer.message,
        normalizedSolidTransfer.recovery,
        nodeId,
      );
    }
    const solidTransfer = normalizedSolidTransfer?.ok
      ? normalizedSolidTransfer.contract
      : undefined;
    const emptyRemainingSolid = solidTransfer
      ? solidTransfer.mode === "whole-remaining"
      : booleanSetting(params, "emptyRemainingSolid");
    const requireNonEmptySolidSource = solidTransfer
      ? solidTransfer.requireNonEmptySource === true
      : booleanSetting(params, "requireNonEmptySolidSource");
    if (requireNonEmptySolidSource && !emptyRemainingSolid) {
      return fail(
        state,
        "This transfer requires a non-empty solid source but does not declare a whole-solid delivery.",
        "Declare the whole-remaining-solid transfer alongside the non-empty source requirement, or use the measured-portion path.",
        nodeId,
      );
    }
    // This continuity binding applies to both the shared typed dispatch and the legacy fallback.
    // Keep it before the typed branch so a whole-solid action cannot bypass a measurement that
    // names a different support than the source container it empties.
    const mismatchedSupport = requireNonEmptySolidSource
      && actionDefinition.prerequisites.some(
        (rule) =>
          rule.type === "measurementRecorded" &&
          rule.measurementContinuity !== undefined &&
          rule.measurementContinuity.measuredSupportInstanceId !== source.id,
      );
    if (mismatchedSupport) {
      return fail(
        state,
        "The recorded mass names a different support than the container this delivery empties.",
        "Record the mass of the same container the approved step empties before transferring it.",
        nodeId,
      );
    }
    const targetDefinition = equipmentById.get(target.definitionId);
    // Keep the physical receiver boundary ahead of both typed dispatch and the legacy merge. A
    // qualitative product packet is not a physical inventory, and a malformed packet must not be
    // erased by a successful zero/no-op or spread into a new solid/mixture.
    if (solidTransfer?.destinationRepresentation !== "qualitative-unknown") {
      const targetError = physicalSolidTransferTargetError(target.contents);
      if (targetError) {
        return fail(state, targetError.message, targetError.recovery, nodeId);
      }
    }
    const canUseSharedPhysicalSolidTransfer =
      solidTransfer !== undefined
      && solidTransfer.destinationRepresentation === "physical"
      && targetDefinition?.allowedContents.includes("solid")
      && stringSetting(params, "thermalResponseMode") !== "dissolution";
    if (canUseSharedPhysicalSolidTransfer) {
      const wholeRemaining = solidTransfer.mode === "whole-remaining";
      if (wholeRemaining && actionDefinition.mass) {
        return fail(
          state,
          "This whole-solid transfer also declares a measured mass, so the delivered amount is ambiguous.",
          "Declare either the whole-remaining-solid transfer or the measured-portion mass contract, not both.",
          nodeId,
        );
      }
      const contractedMassG = wholeRemaining
        ? undefined
        : resolveContractedMassG(state, action, actionDefinition);
      if (actionDefinition.mass && contractedMassG === undefined) {
        return fail(
          state,
          consumerContinuity?.quantityKind === "balance-display"
            ? "The named finite balance-display evidence is missing."
            : "The named positive solid-mass evidence is missing.",
          "Complete the matching weighing measurement in this evidence-scope attempt before transferring the solid.",
          nodeId,
        );
      }
      if (
        consumerContinuity
        && (
          typeof contractedMassG !== "number"
          || !Number.isFinite(contractedMassG)
          || contractedMassG <= 0
        )
      ) {
        return fail(
          state,
          "A positive material-portion mass is required before the transfer.",
          "Record a positive matching material-portion mass in this evidence-scope attempt.",
          nodeId,
        );
      }
      const solidRequest: SolidTransferRequest = wholeRemaining
        ? {
            mode: "whole-remaining",
            sourceInstanceId: source.id,
            targetInstanceId: target.id,
            requireNonEmptySource: solidTransfer.requireNonEmptySource === true,
            destinationRepresentation: "physical",
            targetLabel: stringSetting(params, "targetLabel"),
            visualState: stringSetting(params, "visualState"),
          }
        : {
            mode: "measured-portion",
            sourceInstanceId: source.id,
            targetInstanceId: target.id,
            massG: consumerContinuity
              ? contractedMassG!
              : contractedMassG ?? Number(params.massG ?? 0),
            destinationRepresentation: "physical",
            targetLabel: stringSetting(params, "targetLabel"),
            visualState: stringSetting(params, "visualState"),
          };
      const transferred = transferSolid(
        { instances: state.equipmentInstances, stockInitializations: {} },
        solidRequest,
        equipmentById,
      );
      if (!transferred.ok) {
        return fail(
          state,
          transferred.message ?? "The solid transfer could not be completed.",
          transferred.recovery ?? "Check the source and receiving container before retrying.",
          nodeId,
        );
      }
      return {
        ok: true,
        state: {
          ...state,
          equipmentInstances: transferred.instances,
          contents: syncContents(transferred.instances),
        },
        // `transferSolid` supplies a specific success message only for a genuine no-op residual.
        // Preserve it so an empty-support completion does not look like material was transferred.
        message: transferred.message ?? actionDefinition.feedback.success,
      };
    }
    // A qualitative destination records provenance instead of a mass, and a truthful record needs
    // the run and replicate identity that this runtime does not hold - an evidence scope is not a
    // replicate. Refuse here rather than falling through to the physical merge below, which would
    // write the input mass onto the receiver as though it were the product's measured mass. The
    // green-chemistry route holds that identity and calls `transferSolid` directly, so generic
    // playability for this mode stays explicitly out of scope rather than silently wrong.
    if (solidTransfer?.destinationRepresentation === "qualitative-unknown") {
      return fail(
        state,
        "This recovery collects material of unknown physical quantity, which this activity cannot run.",
        "Run this recovery from the activity that supplies its run and replicate identity.",
        nodeId,
      );
    }
    const sourceMassG = legacySolidInventoryMassG(source.contents);
    if (emptyRemainingSolid) {
      // A whole-solid delivery takes its amount from the source's own inventory, so a mass contract
      // on the same action names a second, contradictory amount that `sourceMassG` would silently
      // win over. Refuse the contradiction before the eligibility decision, so an empty source can
      // never be used to skip a declared mass gate.
      if (actionDefinition.mass) {
        return fail(
          state,
          "This whole-solid transfer also declares a measured mass, so the delivered amount is ambiguous.",
          "Declare either the whole-remaining-solid transfer or the measured-portion mass contract, not both.",
          nodeId,
        );
      }
      const eligibility = wholeRemainingSolidEligibility(source.contents, {
        requireNonEmptySource: requireNonEmptySolidSource,
      });
      if (!eligibility.ok) {
        return fail(state, eligibility.message, eligibility.recovery, nodeId);
      }
      if (eligibility.noOp) {
        return { ok: true, state, message: eligibility.message };
      }
    }
    const contractedMassG = resolveContractedMassG(state, action, actionDefinition);
    if (actionDefinition.mass && contractedMassG === undefined) {
      return fail(
        state,
        consumerContinuity?.quantityKind === "balance-display"
          ? "The named finite balance-display evidence is missing."
          : "The named positive solid-mass evidence is missing.",
        "Complete the matching weighing measurement in this evidence-scope attempt before transferring the solid.",
        nodeId,
      );
    }
    if (
      consumerContinuity
      && (
        typeof contractedMassG !== "number"
        || !Number.isFinite(contractedMassG)
        || contractedMassG <= 0
      )
    ) {
      return fail(
        state,
        "A positive material-portion mass is required before the transfer.",
        "Record a positive matching material-portion mass in this evidence-scope attempt.",
        nodeId,
      );
    }
    const massG = emptyRemainingSolid
      ? sourceMassG
      : consumerContinuity
        ? contractedMassG!
        : contractedMassG ?? Number(params.massG ?? 0);
    if (
      Number.isFinite(massG) &&
      massG > 0 &&
      (source.contents.kind === "solid" || source.contents.kind === "mixture")
    ) {
      if (!Number.isFinite(sourceMassG) || sourceMassG < massG) {
        return fail(
          state,
          "The source does not contain enough solid.",
          "Choose the solid sample source or transfer a smaller mass.",
          nodeId,
        );
      }
      const split = splitSolidForMass(source.contents, sourceMassG, massG);
      const afterTarget = updateInstance(state, target.id, (instance) => ({
        ...instance,
        location: "workbench",
        contents: mergeTransferredSolid(
          instance.contents,
          {
            massG,
            solutes: split.transferredSolutes,
            sourceLabel: source.contents.label,
            sourceVisualState: source.contents.visualState,
            sourceTemperatureC: source.contents.temperatureC,
          },
          {
            targetLabel: stringSetting(params, "targetLabel"),
            visualState: stringSetting(params, "visualState"),
          },
        ),
      }));
      const afterSource = updateInstance(afterTarget, source.id, (instance) => ({
        ...instance,
        contents: split.remainingContents,
      }));
      if (stringSetting(params, "thermalResponseMode") === "dissolution") {
        const initialTemperatureC = target.contents.temperatureC;
        const idealPeakTemperatureC = numberSetting(params, "idealPeakTemperatureC", Number.NaN);
        if (
          typeof initialTemperatureC !== "number" ||
          !Number.isFinite(initialTemperatureC) ||
          !Number.isFinite(idealPeakTemperatureC)
        ) {
          return fail(
            state,
            "The dissolution temperature model is missing a valid starting or peak temperature.",
            "Record the initial temperature and configure the dissolution response before adding the solid.",
            nodeId,
          );
        }
        const dataSeriesId = stringSetting(params, "dataSeriesId") ?? `${state.evidenceScopeId}-temperature-response`;
        const points = generateTemperatureResponse(
          initialTemperatureC,
          idealPeakTemperatureC,
          numberSetting(params, "responseSeed", 12),
          {
            durationS: numberSetting(params, "durationS", 120),
            sampleEveryS: numberSetting(params, "sampleEveryS", 1),
            lagSeconds: numberSetting(params, "lagSeconds", 8),
            peakTimeS: numberSetting(params, "peakTimeS", 24),
            coolingTimeConstantS: numberSetting(params, "coolingTimeConstantS", 100),
            noiseAmplitudeC: numberSetting(params, "noiseAmplitudeC", 0.05),
            precisionC: numberSetting(params, "precisionC", 0.1),
          },
        );
        const endingTemperatureC = points.at(-1)?.y ?? initialTemperatureC;
        const withTemperature = updateInstance(afterSource, target.id, (instance) => ({
          ...instance,
          contents: {
            ...instance.contents,
            temperatureC: endingTemperatureC,
          },
        }));
        const series: DataSeriesRecord = {
          id: dataSeriesId,
          label: stringSetting(params, "dataSeriesLabel") ?? "Dissolution temperature response",
          xUnit: "s",
          yUnit: "°C",
          points,
          sourceActionId: actionDefinition.id,
          nodeId,
          metadata: {
            equipmentInstanceId: target.id,
            scopeId: state.evidenceScopeId,
            initialTemperatureC,
          },
        };
        return {
          ok: true,
          state: {
            ...withTemperature,
            dataSeries: [
              ...withTemperature.dataSeries.filter((candidate) => candidate.id !== dataSeriesId),
              series,
            ],
          },
          message: actionDefinition.feedback.success,
        };
      }
      return { ok: true, state: afterSource, message: actionDefinition.feedback.success };
    }
    if (source.contents.kind === "empty" || (source.contents.volumeMl ?? 0) <= 0) {
      return fail(state, "The source is empty.", "Fill or choose a source that contains liquid.", nodeId);
    }
    if ((source.contents.volumeMl ?? 0) < volumeMl) {
      return fail(
        state,
        "The source does not contain enough liquid.",
        "Choose a source with enough volume or transfer a smaller amount.",
        nodeId,
      );
    }
    if (target.definitionId === "funnel-stand") {
      return fail(
        state,
        "The funnel cannot hold a persistent transfer volume.",
        "Use the filtration action so liquid drains to the receiving vessel and solids stay on the paper.",
        nodeId,
      );
    }
    if (targetDefinition?.capacity.unit === "mL" && (target.contents.volumeMl ?? 0) + volumeMl > targetDefinition.capacity.amount) {
      return fail(state, "The transfer would overflow the target.", "Use a larger target or reduce the transfer volume.", nodeId);
    }
    const conservedSplit = (
      actionDefinition.volume &&
      isOrdinaryLiquidContent(source.contents) &&
      (target.contents.kind === "empty" || isOrdinaryLiquidContent(target.contents))
    ) || canConserveOrdinaryContent(source.contents, target.contents, actionDefinition)
      ? splitContentForVolume(source.contents, volumeMl)
      : undefined;
    const transferred = conservedSplit?.transferredContents
      ?? { ...cloneContent(source.contents), volumeMl };
    const mergedContents = conservedSplit
      ? mergeTransferredContents(target.contents, transferred)
      : mergeContents(transferred, target.contents, volumeMl);
    const sourceTemperatureC = transferred.temperatureC;
    const targetTemperatureC = target.contents.temperatureC;
    const targetVolumeMl = target.contents.volumeMl ?? 0;
    const calorimeterConstantJPerC = Math.max(
      0,
      numberSetting(params, "calorimeterConstantJPerC", 0),
    );
    const mixedTemperatureC =
      typeof sourceTemperatureC === "number" &&
      Number.isFinite(sourceTemperatureC) &&
      typeof targetTemperatureC === "number" &&
      Number.isFinite(targetTemperatureC) &&
      targetVolumeMl > 0 &&
      volumeMl > 0
        ? (
            volumeMl * WATER_SPECIFIC_HEAT_J_PER_G_C * sourceTemperatureC +
            (targetVolumeMl * WATER_SPECIFIC_HEAT_J_PER_G_C + calorimeterConstantJPerC) *
              targetTemperatureC
          ) /
          (
            (volumeMl + targetVolumeMl) * WATER_SPECIFIC_HEAT_J_PER_G_C +
            calorimeterConstantJPerC
          )
        : undefined;
    const afterTarget = updateInstance(state, target.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: {
        ...mergedContents,
        temperatureC:
          mixedTemperatureC ??
          mergedContents.temperatureC,
      },
    }));
    const afterSource = updateInstance(afterTarget, source.id, (instance) => ({
      ...instance,
      contents: conservedSplit
        ? conservedSplit.remainingContents
        : Math.max(0, (instance.contents.volumeMl ?? 0) - volumeMl) === 0
          ? emptyContents()
          : {
              ...instance.contents,
              volumeMl: Math.max(0, (instance.contents.volumeMl ?? 0) - volumeMl),
            },
    }));
    if (deliveryContract) {
      const deliveredThroughDevice = afterSource.equipmentInstances.find((entry) =>
        deliveryContract.deviceInstanceId
          ? entry.id === deliveryContract.deviceInstanceId
          : entry.definitionId === deliveryContract.deviceDefinitionId);
      if (!deliveredThroughDevice || deliveredThroughDevice.contents.kind !== "empty" ||
          (deliveredThroughDevice.contents.volumeMl ?? 0) !== 0) {
        return fail(state, "The delivery device did not finish empty.", "Retry with an empty compatible calibrated delivery device.", nodeId);
      }
    }
    return { ok: true, state: afterSource, message: actionDefinition.feedback.success };
  }

  if (action.verb === "spotSample") {
    const sourceDefinitionId = String(params.sourceDefinitionId ?? "capillary-spotter");
    const targetDefinitionId = String(params.targetDefinitionId ?? "chromatography-paper");
    const source = findInstance(state, action.sourceInstanceId, sourceDefinitionId);
    const target = findInstance(state, action.targetInstanceId, targetDefinitionId);
    if (!source || !target) {
      return fail(
        state,
        "Spotting source or chromatography paper is missing.",
        "Select the capillary spotter and chromatography paper.",
        nodeId,
      );
    }
    if (source.definitionId !== sourceDefinitionId) {
      return fail(
        state,
        "The selected source is not the sample spotter.",
        "Use the capillary spotter to add sample to the paper baseline.",
        nodeId,
      );
    }
    if (target.definitionId !== "chromatography-paper") {
      return fail(
        state,
        "The sample must be spotted on chromatography paper.",
        "Use the chromatography paper as the spotting target.",
        nodeId,
      );
    }
    if (source.contents.kind === "empty") {
      return fail(
        state,
        "The spotter does not contain sample.",
        "Use the capillary spotter loaded with the dye sample.",
        nodeId,
      );
    }
    // Investigation 5 draws the pencil origin (TR-03) before the spot is applied (TR-04), and
    // `atom.spotSample.apply-baseline-spot` carries that as a procedural constraint. Before Cycle 10
    // this handler asserted `baselineMarked: true` itself, so the origin was a notebook sentence and
    // a spot could land on unmarked paper. Content that declares nothing still behaves as before.
    if (
      booleanSetting(params, "requiresBaselineMarked") &&
      !target.contents.chromatogram?.baselineMarked
    ) {
      return fail(
        state,
        "The pencil origin has not been drawn on this paper.",
        "Draw the pencil baseline first, above the level the mobile phase will reach, then apply the spot to it.",
        nodeId,
      );
    }
    if (target.contents.chromatogram?.solventFrontMm !== undefined) {
      return fail(
        state,
        "That paper has already been developed.",
        "Every trial uses fresh paper: take an unused strip, draw its origin, and spot that.",
        nodeId,
      );
    }
    const modelId = stringSetting(params, "chromatographyModelId") ?? "food-dyes-paper";
    const spotVolumeMl = params.spotVolumeMl;
    if (spotVolumeMl !== undefined && (typeof spotVolumeMl !== "number" || !Number.isFinite(spotVolumeMl) || spotVolumeMl <= 0 || spotVolumeMl > (source.contents.volumeMl ?? 0))) {
      return fail(state, "The configured spot exceeds the loaded sample or is invalid.", "Load enough sample for the approved positive spot volume.", nodeId);
    }
    const originDistanceMm = params.originDistanceMm;
    // The spot goes on wet and has to dry (TR-05, R/C). Only content that says so gets the wet
    // state, so no existing owner's spot suddenly needs a drying step it never authored.
    const spotWetState: ContentState["wetState"] = booleanSetting(params, "requiresDrying")
      ? "wet"
      : "dry";
    const next = updateInstance(state, target.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: {
        ...instance.contents,
        kind: "mixture",
        label: stringSetting(params, "spottedLabel") ?? "Spotted food dye sample",
        chromatogram: {
          ...instance.contents.chromatogram,
          modelId,
          baselineMarked: instance.contents.chromatogram?.baselineMarked ?? true,
          spotted: true,
          ...(typeof originDistanceMm === "number" && Number.isFinite(originDistanceMm)
            ? { originDistanceMm }
            : {}),
          // Provenance comes from the container the sample was drawn from, not from a label the
          // action happens to carry: TR-01 makes trial identity traceable.
          sampleProvenance: stringSetting(params, "sampleProvenance") ?? source.contents.label,
          bands: [],
        },
        wetState: spotWetState,
        visualState: "paper-spotted",
      },
    }));
    return { ok: true, state: typeof spotVolumeMl === "number" ? updateInstance(next, source.id, (instance) => ({ ...instance, contents: { ...instance.contents, volumeMl: Math.max(0, (instance.contents.volumeMl ?? 0) - spotVolumeMl) } })) : next, message: actionDefinition.feedback.success };
  }

  if (action.verb === "dissolve" || action.verb === "precipitate") {
    const target = findInstance(state, action.targetInstanceId, String(params.targetDefinitionId ?? ""));
    if (!target) {
      return fail(state, "No target container was selected.", "Select the solution container.", nodeId);
    }
    // A recovered mass that is written into the action is the answer key. Content may instead name a
    // solute already dissolved in the target, so the mass that precipitates is the mass that was
    // there - which for Investigation 9 traces back to the one teacher-configured composition on the
    // unknown sample and never to a literal in a recovery step. A named solute that is absent yields
    // no precipitate rather than a fabricated one, which is how a genuine non-detection is expressed.
    const namedPrecipitateSoluteId = stringSetting(params, "precipitateSoluteSourceId");
    const namedPrecipitateSoluteMassG = namedPrecipitateSoluteId
      ? target.contents.solutes.find(
          (solute) => solute.id === namedPrecipitateSoluteId && solute.unit === "g",
        )?.amount
      : undefined;
    const precipitateMassG = Number(namedPrecipitateSoluteMassG ?? params.precipitateMassG ?? 0);
    if (precipitateMassG > 0 && (target.contents.kind === "empty" || (target.contents.volumeMl ?? 0) <= 0)) {
      return fail(
        state,
        "The target container does not contain the measured sample.",
        "Transfer the measured sample into the beaker before adding the precipitating reagent.",
        nodeId,
      );
    }
    const finalVolumeMl = Number(params.finalVolumeMl ?? target.contents.volumeMl ?? 100);
    // The precipitating substance used to be hard-coded as calcium carbonate, so any other
    // investigation that recovered a solid by precipitation would have had it labelled, and its
    // solute identified, as CaCO3. Investigation 9 acidifies a bicarbonate extract to recover an
    // organic acid, which is a different substance with a different identity claim. Content that
    // names nothing still gets Investigation 3's substance verbatim.
    const precipitateSubstance = stringSetting(params, "precipitateSubstance") ?? "Calcium carbonate";
    const precipitateSoluteId = stringSetting(params, "precipitateSoluteId") ?? "calcium-carbonate";
    /**
     * Precipitating one component does not remove the others from solution.
     *
     * The handler replaced the whole solute list with the single precipitated entry, which is right
     * for Investigation 3 — the beaker holds one product — and wrong for any multistage separation:
     * recovering the acidic component wiped the other two out of the fraction, so the next stage
     * found nothing to recover and the investigation could not be completed. When the content names
     * the solute it is precipitating, only that solute is consumed and the rest stay dissolved, which
     * is also what physically happens. Content that names none keeps the original replacement.
     */
    const remainingSolutes = namedPrecipitateSoluteId
      ? target.contents.solutes.filter((solute) => solute.id !== namedPrecipitateSoluteId)
      : [];
    const contents: ContentState =
      precipitateMassG > 0
        ? {
            kind: "mixture",
            label: stringSetting(params, "precipitateMixtureLabel") ?? `${precipitateSubstance} precipitate mixture`,
            volumeMl: finalVolumeMl,
            solutes: [
              ...remainingSolutes,
              { id: precipitateSoluteId, label: precipitateSubstance, amount: precipitateMassG, unit: "g" },
            ],
            precipitate: {
              substance: precipitateSubstance,
              massG: precipitateMassG,
              rinsed: false,
              dryness: "wet",
            },
            contamination: [],
            wetState: "wet",
            // Deliberately left unconditional. `cloudy-precipitate` is registered
            // `runtimeAssignment: "unconditional"`, and offering an authored override here would
            // falsify that entry without Cycle 10 owning it. The recovered solid's appearance is set
            // where it is actually collected, by `filter`'s `retainedVisualState`.
            visualState: "cloudy-precipitate",
          }
        : {
            kind: "solution",
            label: "Prepared solution",
            volumeMl: finalVolumeMl,
            solutes: [{ id: "prepared-solute", label: "Prepared solute", amount: Number(params.soluteMassG ?? 0), unit: "g" }],
            concentration: {
              value: Number(params.soluteMassG ?? 0) / (finalVolumeMl / 1000),
              unit: "g/L",
            },
            contamination: [],
            wetState: "wet",
            visualState: "clear-solution",
          };
    return {
      ok: true,
      state: updateInstance(state, target.id, (instance) => ({ ...instance, contents })),
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "dilute") {
    const target = findInstance(state, action.targetInstanceId, String(params.targetDefinitionId ?? ""));
    if (!target) {
      return fail(state, "No dilution target was selected.", "Select the volumetric flask.", nodeId);
    }
    const startingVolumeMl = target.contents.volumeMl ?? 0;
    if (actionDefinition.volume && (!Number.isFinite(startingVolumeMl) || startingVolumeMl <= 0)) {
      return fail(
        state,
        "The dilution target contains no measured starting solution.",
        "Transfer the measured aliquot before diluting to the final volume.",
        nodeId,
      );
    }
    const contracted = actionDefinition.volume
      ? resolveContractedVolume(state, action, actionDefinition, target)
      : undefined;
    if (contracted && !contracted.ok) {
      return fail(state, contracted.message, contracted.recovery, nodeId);
    }
    const finalVolumeMl = contracted?.ok
      ? contracted.finalTargetVolumeMl
      : Number(params.finalVolumeMl ?? action.value ?? 100);
    if (!Number.isFinite(finalVolumeMl) || finalVolumeMl <= startingVolumeMl) {
      return fail(
        state,
        "The configured dilution volume must exceed the current solution volume.",
        "Choose a final volume above the current liquid level.",
        nodeId,
      );
    }
    const dilutionSourceDefinitionId = stringSetting(params, "sourceDefinitionId");
    const dilutionSource = dilutionSourceDefinitionId
      ? findInstance(
          state,
          action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId"),
          dilutionSourceDefinitionId,
        )
      : undefined;
    const addedVolumeMl = finalVolumeMl - startingVolumeMl;
    if (actionDefinition.volume && !dilutionSourceDefinitionId) {
      return fail(
        state,
        "A contracted dilution names no dilution-liquid source.",
        "Select the authored water or diluent source so added volume is conserved.",
        nodeId,
      );
    }
    if (dilutionSourceDefinitionId) {
      if (!dilutionSource) {
        return fail(state, "The dilution water source is missing.", "Select the configured water source.", nodeId);
      }
      if ((dilutionSource.contents.volumeMl ?? 0) < addedVolumeMl) {
        return fail(
          state,
          "The dilution source does not contain enough water.",
          "Refill the water source or use a smaller valid final volume.",
          nodeId,
        );
      }
      if (
        actionDefinition.volume &&
        (
          dilutionSource.contents.solutes.length > 0 ||
          dilutionSource.contents.contamination.length > 0 ||
          dilutionSource.contents.precipitate !== undefined ||
          dilutionSource.contents.concentration !== undefined
        )
      ) {
        return fail(
          state,
          "The contracted dilution source is not a pure diluent.",
          "Use an uncontaminated diluent with no dissolved or suspended material.",
          nodeId,
        );
      }
    }
    const factor = actionDefinition.volume
      ? finalVolumeMl / startingVolumeMl
      : Number(params.dilutionFactor ?? finalVolumeMl / Math.max(target.contents.volumeMl ?? 1, 1));
    const concentration = target.contents.concentration
      ? { ...target.contents.concentration, value: target.contents.concentration.value / factor }
      : actionDefinition.volume
        ? undefined
        : { value: factor, unit: "mg/L" as const };
    const nextTarget = updateInstance(state, target.id, (instance) => ({
      ...instance,
      contents: {
        ...instance.contents,
        kind: "solution",
        label: "Diluted solution",
        volumeMl: finalVolumeMl,
        finalVolumeMl,
        concentration,
        wetState: "wet",
        visualState: stringSetting(params, "visualState") ?? "clear-solution",
      },
    }));
    const next =
      dilutionSource
        ? updateInstance(nextTarget, dilutionSource.id, (instance) => {
            const remainingVolumeMl = Math.max(
              0,
              (instance.contents.volumeMl ?? 0) - addedVolumeMl,
            );
            return {
              ...instance,
              contents:
                remainingVolumeMl === 0
                  ? emptyContents()
                  : {
                      ...instance.contents,
                      volumeMl: remainingVolumeMl,
                    },
            };
          })
        : nextTarget;
    return {
      ok: true,
      state: {
        ...next,
        ...(actionDefinition.volume
          ? {
              calculations: actionDefinition.dilutionFactorOutputId
                ? [
                    ...next.calculations.filter((entry) => entry.id !== actionDefinition.dilutionFactorOutputId),
                    {
                      id: actionDefinition.dilutionFactorOutputId,
                      label: "Dilution factor",
                      value: factor,
                      unit: "x",
                      nodeId,
                    },
                  ]
                : next.calculations,
            }
          : {
              measurements: [
                ...next.measurements,
                {
                  id: "dilution-factor",
                  label: "Dilution factor",
                  value: factor,
                  unit: "x",
                  equipmentInstanceId: target.id,
                  nodeId,
                },
              ],
            }),
      },
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "developChromatogram") {
    const paperDefinitionId = String(params.sourceDefinitionId ?? "chromatography-paper");
    const chamberDefinitionId = String(params.targetDefinitionId ?? "chromatography-chamber");
    // `chamberSealed` finally has a reader. It does not assert that the chamber *is* sealed — that
    // would let an authored constant stand in for an operation nobody performed. It declares that
    // this development requires a sealed chamber, and the learner has to produce that state.
    const requiresSealedChamber = booleanSetting(params, "chamberSealed");
    const measurementPrefix = stringSetting(params, "measurementPrefix");
    const paper = findInstance(state, action.sourceInstanceId, paperDefinitionId);
    const chamber = findInstance(state, action.targetInstanceId, chamberDefinitionId);
    if (!paper || !chamber) {
      return fail(
        state,
        "Chromatography paper or chamber is missing.",
        "Select the spotted chromatography paper and solvent chamber.",
        nodeId,
      );
    }
    if (paper.definitionId !== paperDefinitionId || chamber.definitionId !== chamberDefinitionId) {
      return fail(
        state,
        "Chromatography development needs the paper and solvent chamber.",
        "Use spotted chromatography paper as the source and the chamber as the target.",
        nodeId,
      );
    }
    const spottedModelId = paper.contents.chromatogram?.modelId;
    if (!paper.contents.chromatogram?.spotted) {
      return fail(
        state,
        "The chromatography paper has not been spotted.",
        "Spot the sample on the baseline before placing the paper in the chamber.",
        nodeId,
      );
    }
    // TR-05: the spot dries before development, or it dissolves straight into the mobile phase and
    // streaks. Only content declaring `requireDrySpot` is gated, so no other owner changes.
    if (booleanSetting(params, "requireDrySpot") && paper.contents.wetState !== "dry") {
      return fail(
        state,
        "The sample spot is still wet.",
        "Let the origin spot dry to a compact mark first; a wet spot dissolves into the mobile phase and streaks.",
        nodeId,
      );
    }
    const model = chromatographyModelFor(definition, stringSetting(params, "chromatographyModelId") ?? spottedModelId);
    if (model?.requiresClassroomDataset) return fail(state, "Supply an instructor chromatogram dataset for this solvent trial.", "No predictive solvent outcome is available for this canonical template.", nodeId);
    if (chamber.contents.kind === "empty" || (chamber.contents.volumeMl ?? 0) <= 0) {
      return fail(
        state,
        "The chamber does not contain solvent.",
        "Add a shallow solvent layer to the chamber before development.",
        nodeId,
      );
    }
    // TR-06 / CHR-04: the lower edge sits in solvent and the origin stays above it. The two heights
    // are configuration points (confirmation point 3), so the check runs on whatever the action and
    // the spotted paper actually declare and is skipped entirely when neither declares a height.
    const solventDepthMm = params.solventDepthMm;
    const baselineHeightMm =
      typeof params.baselineHeightMm === "number"
        ? params.baselineHeightMm
        : paper.contents.chromatogram?.originDistanceMm;
    if (
      typeof solventDepthMm === "number" &&
      Number.isFinite(solventDepthMm) &&
      typeof baselineHeightMm === "number" &&
      Number.isFinite(baselineHeightMm) &&
      baselineHeightMm <= solventDepthMm
    ) {
      return fail(
        state,
        `The origin sits ${baselineHeightMm} mm above the lower edge, at or below the ${solventDepthMm} mm solvent layer.`,
        "Lower the solvent depth or raise the origin so the spot stays above the mobile phase: a submerged origin dissolves into the solvent instead of travelling up the paper.",
        nodeId,
      );
    }
    if (!model) {
      return fail(
        state,
        "No chromatography model is available.",
        "Add a chromatography model with solvent-front and band distances.",
        nodeId,
      );
    }
    if (params.stopCondition !== undefined && params.stopCondition !== `front-mm:${model.solventFrontMm}`) {
      return fail(state, "The stop condition has no matching chromatography dataset.", "Configure the exact dataset front distance before starting this run.", nodeId);
    }
    const snapZoneId = stringSetting(params, "snapZoneId") ?? "chromatography-chamber-paper-slot";
    const seatedAttachment = state.attachments.find(
      (attachment) =>
        attachment.parentInstanceId === chamber.id &&
        attachment.childInstanceId === paper.id &&
        attachment.zoneId === snapZoneId,
    );
    // A development that requires a sealed chamber cannot also be the operation that first seats the
    // strip: the lid has to be off to insert it and on to develop it. Content declaring
    // `chamberSealed` therefore authors a separate insertion step, and this handler refuses instead
    // of inserting — otherwise the closure gate would describe an impossible sequence. The existing
    // seating is reused rather than re-derived, because `canAttach` correctly refuses a closed
    // chamber and would otherwise reject the very state this step requires.
    if (requiresSealedChamber && !seatedAttachment) {
      return fail(
        state,
        "The strip is not suspended in the chamber.",
        "Suspend the spotted strip in the open chamber with its lower edge in the solvent and the origin above it, then close the lid.",
        nodeId,
      );
    }
    if (requiresSealedChamber && chamber.contents.developingChamberClosed !== true) {
      return fail(
        state,
        `${chamber.label} is still open.`,
        "Close the lid before developing. An open chamber lets the mobile phase evaporate before it saturates the paper, so the front rises unevenly and the trial cannot be measured.",
        nodeId,
      );
    }
    const attachmentCheck = requiresSealedChamber && seatedAttachment
      ? ({ ok: true, attachment: seatedAttachment } as const)
      : canAttach(state, chamber, paper, snapZoneId);
    if (!attachmentCheck.ok) {
      return fail(state, attachmentCheck.message, attachmentCheck.recovery, nodeId);
    }
    const developedContents: ContentState = {
      ...paper.contents,
      kind: "mixture",
      label: stringSetting(params, "developedLabel") ?? "Developed food dye chromatogram",
      chromatogram: {
        ...paper.contents.chromatogram,
        modelId: model.id,
        baselineMarked: true,
        spotted: true,
        solventFrontMm: model.solventFrontMm,
        // A strip leaving the chamber is wet and its front is unmarked. Both are the preconditions
        // for TR-10, and neither existed before Cycle 10: the developed strip inherited the dry
        // spotted state, so "mark the front while it is still wet" had nothing to check.
        solventFrontMarked: false,
        ...(typeof solventDepthMm === "number" && Number.isFinite(solventDepthMm)
          ? { solventDepthMm }
          : {}),
        bands: model.bands.map((band) => ({ ...band })),
      },
      wetState: booleanSetting(params, "trackWetState") ? "wet" : paper.contents.wetState,
      visualState: "chromatogram-developed",
    };
    const withPaper = updateInstance(state, paper.id, (instance) => ({
      ...instance,
      location: "snapZone",
      snapZoneId,
      interactionStatus: "snapped",
      contents: developedContents,
    }));
    const withChamber =
      chamber.location === "shelf"
        ? updateInstance(withPaper, chamber.id, (instance) => ({
            ...instance,
            location: "workbench",
            interactionStatus: "free",
          }))
        : withPaper;
    const withAttachment = upsertAttachment(withChamber, attachmentCheck.attachment);
    // Development used to write the solvent-front distance and every band distance straight into
    // `state.measurements`, under exactly the ids the record steps name and the Rf calculation
    // consumes. The consequence was that Rf was available the instant the strip developed - before
    // the front was marked, before the paper dried, and before a ruler was touched - so TR-10
    // through TR-15 were ceremony. Investigation 5 requires student-read distances (TR-12, TR-14, M),
    // so content that says `recordMeasurementsOnDevelop: false` gets no free measurements and must
    // read the ruler instead. The default stays `true` for every owner that declares nothing.
    const recordOnDevelop = params.recordMeasurementsOnDevelop !== false;
    if (!recordOnDevelop) {
      return { ok: true, state: withAttachment, message: actionDefinition.feedback.success };
    }
    const measurements = [
      {
        id: prefixedChromatographyMeasurementId(measurementPrefix, "solvent-front"),
        label: "Solvent front distance",
        value: model.solventFrontMm,
        unit: "mm",
        equipmentInstanceId: paper.id,
        nodeId,
      },
      ...model.bands.map((band) => ({
        id: prefixedChromatographyMeasurementId(measurementPrefix, "band", band.id),
        label: `${band.label} band distance`,
        value: band.distanceMm,
        unit: "mm",
        equipmentInstanceId: paper.id,
        nodeId,
      })),
    ];
    return {
      ok: true,
      state: {
        ...withAttachment,
        measurements: [
          ...withAttachment.measurements.filter(
            (measurement) => !measurements.some((nextMeasurement) => nextMeasurement.id === measurement.id),
          ),
          ...measurements,
        ],
      },
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "filter") {
    const source = findInstance(state, action.sourceInstanceId, String(params.sourceDefinitionId ?? ""));
    const target = findInstance(state, action.targetInstanceId, String(params.targetDefinitionId ?? ""));
    if (!source || !target) {
      return fail(state, "Filtration source or funnel is missing.", "Select the mixture and funnel setup.", nodeId);
    }
    if (!isFilterTargetDefinition(target.definitionId)) {
      return fail(
        state,
        "Filtration must use a prepared filter target.",
        "Select a funnel setup that contains filter paper and a receiver.",
        nodeId,
      );
    }
    if (!source.contents.precipitate && !source.contents.recoveryEvidence?.residueObserved) {
      return fail(state, "The source does not contain a precipitate.", "Create or select a mixture with precipitate first.", nodeId);
    }
    const preparedPaper = childAttachmentByRelation(state, target.id, "inserted");
    const paper = preparedPaper?.child;
    if (!paper || paper.definitionId !== "filter-paper") {
      return fail(
        state,
        "Filter paper must be seated in the funnel before filtering.",
        "Place the filter paper into the funnel cone first.",
        nodeId,
      );
    }
    if (paper.contents.wetState === "dry") {
      return fail(state, "Filter paper must be wetted before filtering.", "Pre-wet the filter paper to seal it in the funnel.", nodeId);
    }
    const receiverAttachment = childAttachmentByRelation(state, target.id, "receiving");
    const receiver = receiverAttachment?.child;
    if (!receiver) {
      return fail(
        state,
        "A receiving vessel must be placed under the funnel before filtering.",
        "Snap a beaker or Erlenmeyer flask into the receiving vessel zone below the funnel.",
        nodeId,
      );
    }
    const receiverDefinition = equipmentById.get(receiver.definitionId);
    const filtrateVolume = source.contents.volumeMl ?? 0;
    if (
      receiverDefinition?.capacity.unit === "mL" &&
      (receiver.contents.volumeMl ?? 0) + filtrateVolume > receiverDefinition.capacity.amount
    ) {
      return fail(
        state,
        "The filtrate would overflow the receiving vessel.",
        "Use an empty receiving vessel with enough capacity.",
        nodeId,
      );
    }
    if (source.contents.recoveryEvidence?.residueObserved && !source.contents.precipitate) {
      if (receiver.contents.kind !== "empty" || paper.contents.recoveryEvidence || source.id === receiver.id) return fail(state, "Classroom fraction allocation requires a fresh receiver and paper.", "Use the assigned empty filtration assembly; merging unknown fractions is unsupported.", nodeId);
      const allocationId = source.contents.unallocatedInventory?.allocationId ?? source.contents.allocationReferenceId ?? `${nodeId}:${source.id}`;
      const withResidue = updateInstance(state, paper.id, (entry) => ({ ...entry, contents: { ...emptyContents("Observed unidentified filter residue; component allocation unresolved"), kind: "solid", wetState: "wet", visualState: "filter-cake", recoveryEvidence: source.contents.recoveryEvidence, unallocatedInventory: source.contents.unallocatedInventory ?? (source.contents.allocationReferenceId ? undefined : { allocationId, sourceLabel: source.contents.label, solutes: source.contents.solutes, massG: source.contents.massG, precipitate: source.contents.precipitate, contamination: source.contents.contamination }), allocationReferenceId: source.contents.unallocatedInventory?.allocationId ?? allocationId, contamination: [...source.contents.contamination] } }));
      const withFiltrate = updateInstance(withResidue, receiver.id, (entry) => ({ ...entry, contents: { ...emptyContents("Classroom filtrate; component allocation unresolved"), kind: "liquid", volumeMl: filtrateVolume, wetState: "wet", visualState: "clear-filtrate", allocationReferenceId: source.contents.unallocatedInventory?.allocationId ?? allocationId, contamination: [...source.contents.contamination] } }));
      return { ok: true, state: updateInstance(withFiltrate, source.id, (entry) => ({ ...entry, contents: emptyContents() })), message: "Observed residue collected; filtrate retained. No component distribution or mass inferred." };
    }
    if (!source.contents.precipitate) return fail(state, "The recovered solid evidence is missing.", "Observe this fraction again.", nodeId);
    const precipitateContent: ContentState = {
      kind: "precipitate",
      label: source.contents.precipitate.substance,
      massG: source.contents.precipitate.massG,
      solutes: [],
      precipitate: { ...source.contents.precipitate },
      contamination: [],
      wetState: "wet",
      // A filter produces two things at once, so one `visualState` parameter would be ambiguous.
      // Both defaults are registered as `runtimeAssignment: "default"`, which is only honest while
      // an authored value can win here.
      visualState: stringSetting(params, "retainedVisualState") ?? "filter-cake",
    };
    const filtrateContent: ContentState = {
      ...emptyContents(),
      kind: "liquid",
      label: "Filtrate",
      volumeMl: filtrateVolume,
      solutes: source.contents.solutes.filter((solute) => !isPrecipitatedSolute(solute, source.contents.precipitate)),
      contamination: [...source.contents.contamination],
      wetState: "wet",
      visualState: stringSetting(params, "filtrateVisualState") ?? "clear-filtrate",
    };
    const withPaper = updateInstance(state, paper.id, (instance) => ({
      ...instance,
      contents: precipitateContent,
    }));
    const withReceiver = updateInstance(withPaper, receiver.id, (instance) => ({
      ...instance,
      location: "snapZone",
      contents: mergeContents(filtrateContent, instance.contents, filtrateVolume),
    }));
    const withoutSource = updateInstance(withReceiver, source.id, (instance) => ({
      ...instance,
      contents: emptyContents(),
    }));
    const withoutFunnelContents = updateInstance(withoutSource, target.id, (instance) => ({
      ...instance,
      contents: emptyContents(),
    }));
    return { ok: true, state: withoutFunnelContents, message: actionDefinition.feedback.success };
  }

  if (action.verb === "rinse") {
    const requestedTarget = findInstance(state, action.targetInstanceId, String(params.targetDefinitionId ?? ""));
    const target =
      requestedTarget && isFilterTargetDefinition(requestedTarget.definitionId) && String(params.rinseType ?? "rinse") === "precipitate"
        ? childAttachmentByRelation(state, requestedTarget.id, "inserted")?.child ?? requestedTarget
        : requestedTarget;
    if (!target) {
      return fail(state, "No rinse target was selected.", "Select the filter paper, precipitate, or container to rinse.", nodeId);
    }
    const rinseType = String(params.rinseType ?? "rinse");
    if (
      rinseType === "pre-wet" &&
      (target.definitionId !== "filter-paper" || !isSeatedInFilterTarget(state, target.id))
    ) {
      return fail(
        state,
        "Filter paper must be seated before it can be wetted.",
        "Drop the filter paper into the funnel first, then wet it with the wash bottle.",
        nodeId,
      );
    }
    if (rinseType === "precipitate" && !target.contents.precipitate) {
      return fail(
        state,
        "There is no collected precipitate to rinse.",
        "Filter the precipitate into the funnel before rinsing it.",
        nodeId,
      );
    }
    const source = findInstance(state, action.sourceInstanceId, String(params.sourceDefinitionId ?? ""));
    const conditionsWithSample = actionDefinition.atomId === "atom.rinse.condition-cuvette-with-sample";
    const quantitativeRinse = new Set([
      "atom.rinse.quantitative-transfer",
      "atom.rinse.measured-quantitative-transfer",
      "atom.rinse.wash-recovered-fraction",
    ]).has(actionDefinition.atomId ?? "") ||
      rinseType === "pre-wet" || rinseType === "precipitate" ||
      booleanSetting(params, "collectRinseVolume");
    const explicitLiquidRinse = conditionsWithSample || quantitativeRinse ||
      params.sourceDefinitionId !== undefined || params.volumeMl !== undefined || action.value !== undefined;
    const conditioningCount = conditionsWithSample ? numberSetting(params, "conditioningCount", Number.NaN) : 1;
    const conditioningPortionMl = conditionsWithSample ? numberSetting(params, "conditioningPortionMl", Number.NaN) : Number.NaN;
    const requestedRinseVolumeMl = conditionsWithSample
      ? conditioningCount * conditioningPortionMl
      : Number(action.value ?? params.volumeMl ?? DEFAULT_RINSE_VOLUME_ML);
    const rinseVolumeMl = requestedRinseVolumeMl;
    if (conditionsWithSample &&
      (!Number.isFinite(conditioningCount) || conditioningCount <= 0 || !Number.isInteger(conditioningCount) ||
        !Number.isFinite(conditioningPortionMl) || conditioningPortionMl <= 0)) {
      return fail(
        state,
        "Conditioning requires a positive authored whole-number count and positive portion.",
        "Author conditioningPortionMl and conditioningCount before conditioning the sample holder.",
        nodeId,
      );
    }
    if (explicitLiquidRinse &&
      (!source || source.contents.kind === "empty" || !Number.isFinite(rinseVolumeMl) || rinseVolumeMl <= 0)) {
      return fail(
        state,
        conditionsWithSample
          ? "Conditioning requires a positive authored portion and count from a non-empty sample source."
          : "The rinse source or positive rinse volume is missing.",
        conditionsWithSample
          ? "Author conditioningPortionMl and conditioningCount, then select the matching sample source."
          : "Select the rinse source and provide the stated positive rinse volume.",
        nodeId,
      );
    }
    if (explicitLiquidRinse && source && (source.contents.volumeMl ?? 0) < rinseVolumeMl) {
      return fail(state, "The rinse source does not contain enough liquid.", "Refill it or use the smaller source-stated portion.", nodeId);
    }
    const retainedRinse = booleanSetting(params, "collectRinseVolume");
    const rinseCapacity = equipmentById.get(target.definitionId)?.capacity;
    if (retainedRinse && (source?.id === target.id || rinseCapacity?.unit !== "mL" ||
      (target.contents.volumeMl ?? 0) + rinseVolumeMl > rinseCapacity.amount)) {
      return fail(state, "The rinse needs a distinct receiver with sufficient remaining capacity.", "Empty the receiver through the approved waste route before rinsing.", nodeId);
    }
    const rinseSplit = retainedRinse && source ? splitContentForVolume(source.contents, rinseVolumeMl) : undefined;
    const afterSource =
      explicitLiquidRinse && source && typeof source.contents.volumeMl === "number"
        ? updateInstance(state, source.id, (instance) => {
            const nextVolumeMl = Math.max(0, roundToRuntimeMl((instance.contents.volumeMl ?? 0) - rinseVolumeMl));
            return {
              ...instance,
              contents:
                rinseSplit ? rinseSplit.remainingContents : nextVolumeMl === 0
                  ? emptyContents()
                  : {
                      ...instance.contents,
                      volumeMl: nextVolumeMl,
                      wetState: "wet",
                      visualState: instance.contents.visualState === "empty" ? "clear-liquid" : instance.contents.visualState,
                    },
            };
          })
        : state;
    const next = updateInstance(afterSource, target.id, (instance) => ({
      ...instance,
      contents: {
        ...(booleanSetting(params, "collectRinseVolume")
          ? mergeTransferredContents(instance.contents, {
              ...cloneContent(rinseSplit?.transferredContents ?? source?.contents ?? emptyContents()),
              kind: "liquid",
              label: stringSetting(params, "resultLabel") ?? "Retained rinse washings",
              volumeMl: rinseVolumeMl,
              visualState: stringSetting(params, "resultVisualState") ?? "clear-liquid",
            })
          : instance.contents),
        wetState: "rinsed",
        precipitate: instance.contents.precipitate
          ? { ...instance.contents.precipitate, rinsed: true }
          : instance.contents.precipitate,
        visualState:
          stringSetting(params, "resultVisualState") ??
          stringSetting(params, "visualState") ??
          (instance.contents.precipitate ? "rinsed-precipitate" : "wet-equipment"),
      },
    }));
    return {
      ok: true,
      state: addNotebook(
        next,
        nodeId,
        actionDefinition.label,
        "Rinse completed.",
        ["rinse", rinseType],
      ),
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "dry") {
    if (params.requireElapsedDryingTime === true && (typeof action.value !== "number" || !Number.isFinite(action.value) || typeof params.durationMinutes !== "number" || action.value < params.durationMinutes)) return fail(state, "The configured drying duration has not been evidenced.", "Record the actual elapsed minutes after this separate drying stage.", nodeId);
    const target = findInstance(state, action.sourceInstanceId, String(params.targetDefinitionId ?? ""));
    const instrument = action.targetInstanceId
      ? findInstance(state, action.targetInstanceId, String(params.ovenDefinitionId ?? ""))
      : undefined;
    // A lab that dries more than one sample holds more than one precipitate at once. Scanning the
    // whole bench would let Sample C's drying stage pick up whichever precipitate happens to come
    // first in the array — the practice result, in Investigation 3 — and move it onto Sample C's
    // watch glass, destroying both the practice evidence and the sample identity. The authored
    // `precipitateSourceInstanceId` names the intended carrier, so it wins; the bench-wide scan
    // stays only as the fallback for content that names nothing.
    const namedPrecipitateSource = findInstance(
      state,
      stringSetting(params, "precipitateSourceInstanceId"),
    );
    const sourceWithPrecipitate = stringSetting(params, "precipitateSourceInstanceId")
      ? namedPrecipitateSource
      : state.equipmentInstances.find((instance) => instance.contents.precipitate);
    if (action.targetInstanceId && instrument?.definitionId !== String(params.ovenDefinitionId ?? "drying-oven")) {
      return fail(state, "The sample is not in the drying oven.", "Place the watch glass in the drying oven.", nodeId);
    }
    if (!target || (!target.contents.precipitate && !sourceWithPrecipitate)) {
      return fail(state, "No precipitate is available to dry.", "Move the collected precipitate to a watch glass first.", nodeId);
    }
    const precipitate = target.contents.precipitate ?? sourceWithPrecipitate?.contents.precipitate;
    if (!precipitate?.rinsed) {
      return fail(
        state,
        "The precipitate must be rinsed before drying.",
        "Rinse the collected precipitate before using the drying oven.",
        nodeId,
      );
    }
    const dryMassG = Number(params.dryMassG ?? precipitate?.dryMassG ?? precipitate?.massG ?? 0);
    // A drying stage is not automatically the last one. Investigation 3 states two, separated by
    // breaking up the cake, so an action may declare the dryness its own stage reaches; only a stage
    // that declares "dry" ends the sequence. Content that declares nothing keeps the single-stage
    // behaviour these handlers had before Cycle 08.
    const declaredDryness = stringSetting(params, "drynessResult");
    const dryness: PrecipitateState["dryness"] =
      declaredDryness === "wet" || declaredDryness === "damp" ? declaredDryness : "dry";
    const fullyDry = dryness === "dry";
    // The oven temperature is what makes the assembly unsafe to weigh. Carrying it is what turns the
    // cooling step from prose into the prerequisite the `weigh` handler already knows how to check.
    const ovenTemperatureC = numberSetting(params, "temperatureC", Number.NaN);
    const stateWithTransfer =
      !target.contents.precipitate && sourceWithPrecipitate
        ? updateInstance(state, sourceWithPrecipitate.id, (instance) => ({
            ...instance,
            contents: emptyContents(),
          }))
        : state;
    const next = updateInstance(stateWithTransfer, target.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: {
        ...instance.contents,
        kind: "precipitate",
        label: precipitate?.substance ?? "Dry precipitate",
        massG: dryMassG,
        solutes: [],
        contamination: [],
        temperatureC: Number.isFinite(ovenTemperatureC)
          ? ovenTemperatureC
          : instance.contents.temperatureC,
        wetState: fullyDry ? "dry" : "wet",
        visualState: stringSetting(params, "visualState") ?? "dry-precipitate",
        precipitate: {
          ...precipitate!,
          massG: dryMassG,
          dryMassG,
          dryness,
        },
      },
    }));
    return { ok: true, state: next, message: actionDefinition.feedback.success };
  }

  if (action.verb === "heat") {
    if (stringSetting(params, "thermalMode") === "targetTemperature") {
      const source = findInstance(
        state,
        action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId"),
        stringSetting(params, "sourceDefinitionId"),
      );
      const heatSource = findInstance(
        state,
        action.targetInstanceId ?? stringSetting(params, "targetInstanceId"),
        stringSetting(params, "targetDefinitionId") ?? "hot-plate-stirrer",
      );
      if (!source || source.contents.kind === "empty") {
        return fail(
          state,
          "No liquid sample is available to heat.",
          "Place the water sample on the configured heat source before heating.",
          nodeId,
        );
      }
      if (!heatSource || !equipmentById.get(heatSource.definitionId)?.affordances.includes("heatSource")) {
        return fail(
          state,
          "The liquid is not on a compatible heat source.",
          "Place the beaker on the hot plate and try again.",
          nodeId,
        );
      }
      const targetTemperatureC = numberSetting(params, "targetTemperatureC", 50);
      const toleranceC = Math.max(0, numberSetting(params, "toleranceC", 3));
      const requestedTemperatureC =
        numericParameter(action.parameters, "observedTemperatureC") ??
        numericParameter(action.parameters, "temperatureC") ??
        targetTemperatureC;
      if (Math.abs(requestedTemperatureC - targetTemperatureC) > toleranceC) {
        return fail(
          state,
          `The water is ${requestedTemperatureC.toFixed(1)} °C, outside the accepted range around ${targetTemperatureC.toFixed(1)} °C.`,
          `Continue heating or allow cooling until the reading is within ±${toleranceC.toFixed(1)} °C.`,
          nodeId,
        );
      }
      const elapsedSeconds = Math.max(0, numberSetting(params, "elapsedSeconds", 0));
      const next = updateInstance(state, source.id, (instance) => ({
        ...instance,
        contents: {
          ...instance.contents,
          temperatureC: requestedTemperatureC,
          visualState: "heated-liquid",
        },
      }));
      const priorControl = next.thermalControls[heatSource.id];
      return {
        ok: true,
        state: {
          ...next,
          thermalControls: {
            ...next.thermalControls,
            [heatSource.id]: {
              equipmentInstanceId: heatSource.id,
              heatOn: false,
              stirOn: priorControl?.stirOn ?? false,
              heatLevel: 0,
              stirLevel: priorControl?.stirLevel ?? 0,
              splashing: priorControl?.splashing ?? false,
              elapsedSeconds,
              peakTemperatureC: Math.max(
                priorControl?.peakTemperatureC ?? Number.NEGATIVE_INFINITY,
                requestedTemperatureC,
              ),
            },
          },
        },
        message: actionDefinition.feedback.success,
      };
    }
    const source = findInstance(state, action.sourceInstanceId, String(params.sourceDefinitionId ?? ""));
    const expectedHeatSource = String(params.targetDefinitionId ?? params.heatSourceDefinitionId ?? "bunsen-burner");
    const instrument = findInstance(state, action.targetInstanceId, expectedHeatSource);
    if (!instrument) {
      return fail(state, "No heat source is available.", "Place the Bunsen burner before heating the crucible.", nodeId);
    }
    if (instrument.definitionId !== expectedHeatSource) {
      return fail(state, "The sample is not at the heat source.", "Move the crucible to the Bunsen burner before heating.", nodeId);
    }
    const instrumentDefinition = equipmentById.get(instrument.definitionId);
    if (!instrumentDefinition?.affordances.includes("heatSource")) {
      return fail(state, "The selected equipment cannot heat the sample.", "Use the Bunsen burner for this heating step.", nodeId);
    }
    if (!source || source.contents.kind === "empty") {
      return fail(state, "No solid sample is available to heat.", "Select the crucible containing the carbonate mixture.", nodeId);
    }
    const heatedMassG = Number(params.heatedMassG ?? params.finalMassG);
    if (!Number.isFinite(heatedMassG) || heatedMassG <= 0) {
      return fail(
        state,
        "The heating step is missing a configured final mass.",
        "Configure heatedMassG for this thermal decomposition step.",
        nodeId,
      );
    }
    if (
      typeof source.contents.massG === "number" &&
      Number.isFinite(source.contents.massG) &&
      (booleanSetting(params, "allowConstantMass")
        ? heatedMassG > source.contents.massG
        : heatedMassG >= source.contents.massG)
    ) {
      return fail(
        state,
        "The configured heated mass must be lower than the starting mass.",
        "Thermal decomposition mass-loss steps need a lower heatedMassG than the initial crucible and mixture mass.",
        nodeId,
      );
    }
    const heatedTemperatureC = numberSetting(params, "heatedTemperatureC", 650);
    const minimumHotTemperatureC = numberSetting(params, "minimumHotTemperatureC", 40);
    if (heatedTemperatureC <= minimumHotTemperatureC) {
      return fail(
        state,
        "The configured heating temperature is not hot enough.",
        "Configure heatedTemperatureC above the safe weighing threshold for this decomposition step.",
        nodeId,
      );
    }
    const productMassG = Number(params.productMassG);
    if (!Number.isFinite(productMassG) || productMassG <= 0) {
      return fail(
        state,
        "The heating step is missing a configured product mass.",
        "Configure productMassG for the sodium carbonate residue.",
        nodeId,
      );
    }
    const startingSampleMassG = gramSoluteMass(source.contents);
    if (startingSampleMassG !== undefined && productMassG - startingSampleMassG > 1e-9) {
      return fail(
        state,
        "The configured product mass exceeds the starting sample mass.",
        "Keep productMassG within the gram-scale sample initially loaded in the crucible.",
        nodeId,
      );
    }
    const productLabel = stringSetting(params, "productLabel") ?? "Heated sodium carbonate residue";
    const hasSodiumCarbonate = source.contents.solutes.some((solute) => solute.id === "sodium-carbonate");
    const next = updateInstance(state, source.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: {
        ...instance.contents,
        kind: "solid",
        label: productLabel,
        massG: heatedMassG,
        solutes: [
          ...instance.contents.solutes.map((solute) =>
            solute.id === "sodium-bicarbonate"
              ? { ...solute, amount: 0 }
              : solute.id === "sodium-carbonate"
                ? { ...solute, amount: productMassG, unit: "g" as const }
                : solute,
          ),
          ...(hasSodiumCarbonate
            ? []
            : [{ id: "sodium-carbonate", label: "Sodium carbonate", amount: productMassG, unit: "g" as const }]),
        ],
        temperatureC: heatedTemperatureC,
        wetState: "dry",
        visualState: "heated-residue",
      },
    }));
    return {
      ok: true,
      state: addNotebook(
        next,
        nodeId,
        actionDefinition.label,
        `Heated residue mass target: ${heatedMassG} g; crucible remains hot.`,
        ["heat"],
      ),
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "cool") {
    const source = findInstance(state, action.sourceInstanceId, String(params.sourceDefinitionId ?? ""));
    const expectedTool = String(params.targetDefinitionId ?? params.coolingToolDefinitionId ?? "crucible-tongs");
    const tool = findInstance(state, action.targetInstanceId, expectedTool);
    // Cooling is not a crucible-only step: Investigation 3 cools a watch-glass assembly and
    // Investigation 7 cools a crucible. The object being cooled names itself, so the feedback can
    // describe the real prerequisite instead of naming one investigation's apparatus.
    const cooledObjectLabel =
      stringSetting(params, "cooledObjectLabel") ?? source?.label ?? "heated assembly";
    const coolingToolLabel = equipmentById.get(expectedTool)?.label ?? "cooling tool";
    if (!tool) {
      return fail(
        state,
        "No cooling tool is available.",
        `Place the ${coolingToolLabel} before moving the ${cooledObjectLabel}.`,
        nodeId,
      );
    }
    if (tool.definitionId !== expectedTool) {
      return fail(
        state,
        "The cooling tool is not selected.",
        `Use the ${coolingToolLabel} to move the ${cooledObjectLabel} aside.`,
        nodeId,
      );
    }
    if (!source || source.contents.kind === "empty") {
      return fail(
        state,
        `No heated ${cooledObjectLabel} is available to cool.`,
        `Select the heated ${cooledObjectLabel} before cooling.`,
        nodeId,
      );
    }
    const cooledTemperatureC = numberSetting(params, "cooledTemperatureC", 25);
    const currentTemperatureC = source.contents.temperatureC;
    if (
      typeof currentTemperatureC !== "number" ||
      !Number.isFinite(currentTemperatureC) ||
      currentTemperatureC <= cooledTemperatureC
    ) {
      return fail(
        state,
        `The ${cooledObjectLabel} is not hot.`,
        `Heat or dry the ${cooledObjectLabel} before using the cooling step.`,
        nodeId,
      );
    }
    const next = updateInstance(state, source.id, (instance) => ({
      ...instance,
      location: "workbench",
      contents: {
        ...instance.contents,
        temperatureC: cooledTemperatureC,
        visualState:
          instance.contents.visualState === "empty"
            ? "empty"
            : (stringSetting(params, "visualState") ?? "cooled-residue"),
      },
    }));
    return {
      ok: true,
      state: addNotebook(
        next,
        nodeId,
        actionDefinition.label,
        `${cooledObjectLabel} cooled to ${cooledTemperatureC} C before weighing.`,
        ["cool"],
      ),
      message: actionDefinition.feedback.success,
    };
  }

  // The authored final-display submission is an observation, but its declared display contract
  // still needs the same slot and color validation as an equilibrium stress action.
  if (action.verb === "stressEquilibrium" || stringArraySetting(params, "displayColorNames").length > 0) {
    return executeStressEquilibrium(state, action, actionDefinition, nodeId, params);
  }

  if (action.verb === "observe") {
    if (stringSetting(params, "controlType") === "stirrer") {
      const controller = findInstance(
        state,
        action.targetInstanceId ?? stringSetting(params, "targetInstanceId"),
        stringSetting(params, "targetDefinitionId") ?? "hot-plate-stirrer",
      );
      if (!controller) {
        return fail(state, "The magnetic stirrer is missing.", "Place the stirrer before adjusting its speed.", nodeId);
      }
      const stirLevel = Math.max(0, Math.min(10, numberSetting(params, "stirLevel", 0)));
      const splashThreshold = Math.max(0, numberSetting(params, "splashThreshold", 7));
      const splashing = stirLevel > splashThreshold;
      if (splashing) {
        return fail(
          state,
          "The stirring speed causes splashing.",
          `Reduce the stir setting to ${splashThreshold} or lower before continuing.`,
          nodeId,
        );
      }
      const prior = state.thermalControls[controller.id];
      return {
        ok: true,
        state: {
          ...state,
          thermalControls: {
            ...state.thermalControls,
            [controller.id]: {
              equipmentInstanceId: controller.id,
              heatOn: prior?.heatOn ?? false,
              stirOn: stirLevel > 0,
              heatLevel: prior?.heatLevel ?? 0,
              stirLevel,
              splashing: false,
              elapsedSeconds: prior?.elapsedSeconds ?? 0,
              peakTemperatureC: prior?.peakTemperatureC,
            },
          },
        },
        message: actionDefinition.feedback.success,
      };
    }

    if (params.waitSeconds !== undefined) {
      const waitSeconds = Math.max(0, numberSetting(params, "waitSeconds", 0));
      const requiredSeconds = Math.max(0, numberSetting(params, "requiredSeconds", waitSeconds));
      if (waitSeconds !== requiredSeconds) {
        return fail(
          state,
          `The reading must be taken after exactly ${requiredSeconds} seconds.`,
          `Reset the timer and wait until ${requiredSeconds} seconds have elapsed.`,
          nodeId,
        );
      }
      const timerId = stringSetting(params, "timerId") ?? "runtime-timer";
      const prior = state.thermalControls[timerId];
      return {
        ok: true,
        state: {
          ...state,
          thermalControls: {
            ...state.thermalControls,
            [timerId]: {
              equipmentInstanceId: timerId,
              heatOn: false,
              stirOn: false,
              heatLevel: 0,
              stirLevel: 0,
              splashing: false,
              elapsedSeconds: waitSeconds,
              peakTemperatureC: prior?.peakTemperatureC,
            },
          },
        },
        message: actionDefinition.feedback.success,
      };
    }

    const evidenceKind = stringSetting(params, "temperatureEvidenceKind") as
      | TemperatureEvidenceKind
      | undefined;
    if (evidenceKind) {
      const allowedKinds: TemperatureEvidenceKind[] = ["live", "stable", "peak", "timed"];
      if (!allowedKinds.includes(evidenceKind)) {
        return fail(state, "Unsupported temperature evidence type.", "Use live, stable, peak, or timed evidence.", nodeId);
      }
      const source = findInstance(
        state,
        action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId"),
        stringSetting(params, "sourceDefinitionId"),
      );
      if (!source) {
        return fail(state, "The temperature source is missing.", "Select the sample whose temperature is being observed.", nodeId);
      }
      const observed =
        numericParameter(action.parameters, "temperatureC") ??
        source.contents.temperatureC;
      if (typeof observed !== "number" || !Number.isFinite(observed)) {
        return fail(state, "No live temperature is available.", "Immerse the probe correctly and wait for a readable value.", nodeId);
      }
      const evidenceId = stringSetting(params, "evidenceId") ?? `${state.evidenceScopeId}-${actionDefinition.id}`;
      const elapsedSeconds =
        params.elapsedSeconds === undefined ? undefined : numberSetting(params, "elapsedSeconds", 0);
      if (evidenceKind === "timed") {
        const requiredSeconds = numberSetting(params, "requiredSeconds", 15);
        if (elapsedSeconds !== requiredSeconds) {
          return fail(
            state,
            `This temperature must be read at ${requiredSeconds} seconds.`,
            `Restart the timer and record the reading at exactly ${requiredSeconds} seconds.`,
            nodeId,
          );
        }
      }
      const priorPeak = state.temperatureEvidence
        .filter((item) => item.scopeId === state.evidenceScopeId && item.equipmentInstanceId === source.id)
        .reduce((peak, item) => Math.max(peak, item.valueC), Number.NEGATIVE_INFINITY);
      const peakSeriesId = stringSetting(params, "dataSeriesId");
      const seriesPeak = peakSeriesId
        ? state.dataSeries
            .find((series) => series.id === peakSeriesId)
            ?.points.reduce((peak, point) => Math.max(peak, point.y), Number.NEGATIVE_INFINITY)
        : undefined;
      const valueC =
        evidenceKind === "peak"
          ? Math.max(
              observed,
              priorPeak,
              typeof seriesPeak === "number" ? seriesPeak : Number.NEGATIVE_INFINITY,
            )
          : observed;
      return {
        ok: true,
        state: {
          ...state,
          temperatureEvidence: [
            ...state.temperatureEvidence.filter((item) => item.id !== evidenceId),
            {
              id: evidenceId,
              label: stringSetting(params, "label") ?? actionDefinition.label,
              valueC,
              kind: evidenceKind,
              equipmentInstanceId: source.id,
              scopeId: state.evidenceScopeId,
              elapsedSeconds,
              nodeId,
            },
          ],
        },
        message: actionDefinition.feedback.success,
      };
    }

    // Investigation 5, printed page 49: "The container must be sealed so the solvent saturates the
    // paper and does not evaporate first." That is the chapter's one explicit physical statement
    // about the chamber, and until now nothing in the application could represent it: the authored
    // `chamberSealed: true` had no reader and there was no unsealed state to refuse.
    //
    // Closure is a learner operation on one named chamber instance, handled here so it runs through
    // the same central action path as every other physical step: the same prerequisites, attempt
    // records, assessment and feedback. The decomposition into an open and a close operation is a
    // simulator representation of physical handling (R), not a prescribed manual step; the sealed
    // condition it produces is the manual's (M).
    const chamberOperation = stringSetting(params, "chamberOperation");
    if (chamberOperation) {
      const chamber = findInstance(
        state,
        action.targetInstanceId ?? stringSetting(params, "targetInstanceId"),
        stringSetting(params, "targetDefinitionId") ?? "chromatography-chamber",
      );
      if (!chamber) {
        return fail(
          state,
          "The chamber for this step is missing.",
          "Select the labelled chamber that belongs to this trial.",
          nodeId,
        );
      }
      if (!matchesEquipmentRole(chamber, "developing-chamber")) {
        return fail(
          state,
          "The named endpoint is not a developing chamber.",
          "Use the declared chromatography chamber for this operation.",
          nodeId,
        );
      }
      if (chamberOperation !== "closeChamber" && chamberOperation !== "openChamber") {
        return fail(
          state,
          `Unsupported chamber operation "${chamberOperation}".`,
          "Use closeChamber or openChamber.",
          nodeId,
        );
      }
      const closed = chamber.contents.developingChamberClosed === true;
      // Each chamber holds its own closure, so closing one trial's chamber authorizes nothing in
      // another. Refusing the no-op keeps the notebook from carrying a second closure record that
      // would read as a second physical operation.
      if (chamberOperation === "closeChamber" && closed) {
        return fail(
          state,
          `${chamber.label} is already closed.`,
          "This chamber is already sealed; continue with the current trial.",
          nodeId,
        );
      }
      if (chamberOperation === "openChamber" && !closed) {
        return fail(
          state,
          `${chamber.label} is already open.`,
          "This chamber is already open; continue with the current trial.",
          nodeId,
        );
      }
      const nextClosed = chamberOperation === "closeChamber";
      const authoredChamberVisualState = stringSetting(params, "visualState");
      // Opening a developed chamber only changes the lid. The chromatogram on the strip inside is
      // untouched: there is no evaporation, pressure, timed-development or pause/resume model here,
      // and a valid completed development stays valid so the strip can be removed and measured.
      const withChamber = updateInstance(state, chamber.id, (instance) => ({
        ...instance,
        contents: {
          ...instance.contents,
          developingChamberClosed: nextClosed,
          ...(authoredChamberVisualState ? { visualState: authoredChamberVisualState } : {}),
        },
      }));
      return {
        ok: true,
        state: addNotebook(
          withChamber,
          nodeId,
          actionDefinition.label,
          String(params.note ?? action.note ?? params.prompt ?? "Observation recorded."),
          ["observe", String(params.tag ?? chamberOperation)],
        ),
        message: actionDefinition.feedback.success,
      };
    }

    // Investigation 5's paper handling is a chronology, not a set of notes: the origin is drawn
    // before the spot, the spot dries before development, the front is marked while the strip is wet,
    // and the strip dries before it is measured. Each of those was a `recordNotebook` sentence whose
    // `chromatographyOperation` parameter nothing read, so any order satisfied any of them. This
    // branch is entered only when that parameter is present.
    const chromatographyOperation = stringSetting(params, "chromatographyOperation");
    if (chromatographyOperation) {
      const paper = findInstance(
        state,
        action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId"),
        stringSetting(params, "sourceDefinitionId") ?? "chromatography-paper",
      );
      if (!paper) {
        return fail(
          state,
          "The chromatography paper for this step is missing.",
          "Select the labelled paper that belongs to this trial.",
          nodeId,
        );
      }
      if (!matchesEquipmentRole(paper, "stationary-phase")) return fail(state, "The named chromatography endpoint is not stationary-phase paper.", "Use the declared chromatography paper for this operation.", nodeId);
      const chromatogram = paper.contents.chromatogram;
      const developed = chromatogram?.solventFrontMm !== undefined;
      let nextContents: ContentState;
      switch (chromatographyOperation) {
        case "markBaseline": {
          if (chromatogram?.spotted) {
            return fail(
              state,
              "That paper already carries a sample spot.",
              "Draw the pencil origin on a fresh strip before spotting it; a second origin line would make the measurement ambiguous.",
              nodeId,
            );
          }
          const baselineHeightMm = params.baselineHeightMm;
          nextContents = {
            ...paper.contents,
            chromatogram: {
              modelId: chromatogram?.modelId ?? stringSetting(params, "chromatographyModelId") ?? "",
              baselineMarked: true,
              spotted: false,
              ...(typeof baselineHeightMm === "number" && Number.isFinite(baselineHeightMm)
                ? { originDistanceMm: baselineHeightMm }
                : {}),
              bands: chromatogram?.bands ?? [],
            },
          };
          break;
        }
        case "drySpot": {
          if (!chromatogram?.spotted) {
            return fail(
              state,
              "There is no sample spot on that paper to dry.",
              "Apply the sample to the pencil origin first.",
              nodeId,
            );
          }
          if (developed) {
            return fail(
              state,
              "That chromatogram has already been developed.",
              "Dry the origin spot before development, not after; use a fresh strip for another trial.",
              nodeId,
            );
          }
          nextContents = { ...paper.contents, wetState: "dry" };
          break;
        }
        case "markSolventFront": {
          if (!developed) {
            return fail(
              state,
              "That paper has not been developed, so it carries no solvent front.",
              "Develop the chromatogram in the sealed chamber first.",
              nodeId,
            );
          }
          if (paper.contents.wetState === "dry") {
            return fail(
              state,
              "The paper is already dry, so the solvent front can no longer be located.",
              "The front has to be marked as soon as the strip leaves the chamber, while it is still wet. This trial cannot be measured: run it again on fresh paper and mark the front immediately.",
              nodeId,
            );
          }
          nextContents = {
            ...paper.contents,
            chromatogram: { ...chromatogram, solventFrontMarked: true },
          };
          break;
        }
        case "dryDevelopedPaper": {
          if (!developed) {
            return fail(
              state,
              "That paper has not been developed.",
              "Develop the chromatogram before drying it for measurement.",
              nodeId,
            );
          }
          if (!chromatogram?.solventFrontMarked) {
            return fail(
              state,
              "The solvent front has not been marked yet.",
              "Mark the front in pencil while the paper is still wet; once it dries the front cannot be recovered.",
              nodeId,
            );
          }
          nextContents = { ...paper.contents, wetState: "dry" };
          break;
        }
        default:
          return fail(
            state,
            `Unsupported chromatography paper operation "${chromatographyOperation}".`,
            "Use markBaseline, drySpot, markSolventFront, or dryDevelopedPaper.",
            nodeId,
          );
      }
      const authoredVisualState = stringSetting(params, "visualState");
      const withPaper = updateInstance(state, paper.id, (instance) => ({
        ...instance,
        contents: authoredVisualState
          ? { ...nextContents, visualState: authoredVisualState }
          : nextContents,
      }));
      return {
        ok: true,
        state: addNotebook(
          withPaper,
          nodeId,
          actionDefinition.label,
          String(params.note ?? action.note ?? params.prompt ?? "Observation recorded."),
          ["observe", String(params.tag ?? chromatographyOperation)],
        ),
        message: actionDefinition.feedback.success,
      };
    }

    // An observation that decides what may happen next has to change state, not just the notebook.
    // Investigation 9's settling step is the case: a clean two-layer state can be drained and an
    // emulsion cannot (§9), and the step declared `visualStateChoices` that nothing read, so both
    // outcomes were the same sentence. The observed state is applied to the named instance, and the
    // choice comes from the request when the student reports one and from the authored default
    // otherwise. Content that names no target instance is unaffected.
    const observedVisualStateTargetId = stringSetting(params, "visualStateTargetInstanceId");
    const observedVisualState = stringSetting(params, "observedVisualState");
    if (observedVisualStateTargetId && observedVisualState) {
      const allowedStates = stringArraySetting(params, "visualStateChoices");
      if (allowedStates.length > 0 && !allowedStates.includes(observedVisualState)) {
        return fail(
          state,
          `"${observedVisualState}" is not one of the outcomes this step recognises.`,
          `Report one of: ${allowedStates.join(", ")}.`,
          nodeId,
        );
      }
      const observedTarget = findInstance(state, observedVisualStateTargetId);
      if (!observedTarget) {
        return fail(
          state,
          "The vessel this observation describes is missing.",
          "Select the labelled vessel this step observes.",
          nodeId,
        );
      }
      const withObservation = updateInstance(state, observedTarget.id, (instance) => ({
        ...instance,
        contents: { ...instance.contents, visualState: observedVisualState },
      }));
      return {
        ok: true,
        state: addNotebook(
          withObservation,
          nodeId,
          actionDefinition.label,
          String(params.note ?? action.note ?? params.prompt ?? observedVisualState),
          ["observe", String(params.tag ?? "observation"), observedVisualState],
        ),
        message: actionDefinition.feedback.success,
      };
    }

    if (actionDefinition.interaction?.type === "readInstrument") {
      const sourceDefinitionId =
        stringSetting(params, "sourceDefinitionId") ?? actionDefinition.interaction.sourceDefinitionId;
      const targetDefinitionId =
        stringSetting(params, "targetDefinitionId") ?? actionDefinition.interaction.targetDefinitionId;
      const source = findInstance(
        state,
        action.sourceInstanceId ?? stringSetting(params, "sourceInstanceId"),
        sourceDefinitionId,
      );
      const target = targetDefinitionId
        ? findInstance(
            state,
            action.targetInstanceId ?? stringSetting(params, "targetInstanceId"),
            targetDefinitionId,
          )
        : undefined;

      if (!source || (sourceDefinitionId && source.definitionId !== sourceDefinitionId)) {
        return fail(
          state,
          "The required instrument reading source is missing.",
          actionDefinition.interaction.invalidCue ?? "Select the equipment named by this instrument-reading step.",
          nodeId,
        );
      }
      if (targetDefinitionId && (!target || target.definitionId !== targetDefinitionId)) {
        return fail(
          state,
          "The required instrument station is missing.",
          actionDefinition.interaction.invalidCue ?? "Use the instrument station named by this step.",
          nodeId,
        );
      }

      if (stringSetting(params, "phReadingMode") === "acceptedEndpoint") {
        if (!target) {
          return fail(
            state,
            "The titration flask is missing.",
            "Select the flask that contains the accepted endpoint mixture.",
            nodeId,
          );
        }
        if (source.contents.probeImmersedInInstanceId !== target.id) {
          return fail(
            state,
            "The pH probe is not immersed in this flask.",
            "Manipulate the probe into the flask probe zone before reading the meter.",
            nodeId,
          );
        }
        const readinessTag = stringSetting(params, "meterReadinessNotebookTag") ?? "ph-meter-ready";
        if (!state.notebook.some((entry) => entry.tags.includes(readinessTag))) {
          return fail(
            state,
            "The pH meter has not been confirmed ready.",
            "Confirm the teacher-approved meter readiness before taking a reading.",
            nodeId,
          );
        }
        const dispenseActionId = stringSetting(params, "dispenseActionId") ?? "deliver-titrant";
        const dispense = state.dropDispenses[dispenseActionId];
        if (!dispense?.accepted) {
          return fail(
            state,
            "The endpoint has not been accepted.",
            "Accept the indicator endpoint before reading its simulator-predicted pH.",
            nodeId,
          );
        }
        const modelId = stringSetting(params, "titrationModelId");
        const model = modelId ? findTitrationModel(definition, modelId) : undefined;
        if (!model || model.type !== "acidBase") {
          return fail(
            state,
            "The endpoint pH model is unavailable.",
            "Configure an acid-base titration model before enabling this reading.",
            nodeId,
          );
        }
        let predicted;
        let plan;
        try {
          predicted = calculateAcidBasePh(model, dispense.deliveredVolumeMl);
          plan = deriveTitrationDropPlan(model);
        } catch (error) {
          return fail(
            state,
            "The endpoint pH model is incomplete.",
            error instanceof Error ? error.message : "Review the configured acid-base species and constants.",
            nodeId,
          );
        }
        const precision = model.phPrecision;
        const displayedPh = Number(predicted.ph.toFixed(precision));
        const idealEquivalencePh = Number((plan.idealEquivalencePh ?? predicted.ph).toFixed(precision));
        const measurementId = stringSetting(params, "measurementId") ?? action.measurementId ?? "endpoint-ph";
        const readout = {
          quantity: "pH" as const,
          value: displayedPh,
          unit: "pH" as const,
          precision,
          provenance: "simulator-generated" as const,
          acceptedTitrantVolumeMl: dispense.deliveredVolumeMl,
          idealEquivalenceVolumeMl: plan.theoreticalEquivalenceVolumeMl,
          idealEquivalencePh,
        };
        const withDisplay = updateInstance(state, source.id, (instance) => ({
          ...instance,
          contents: { ...instance.contents, instrumentReadout: readout },
        }));
        const withMeasurement: RuntimeState = {
          ...withDisplay,
          measurements: [
            ...withDisplay.measurements.filter((measurement) => measurement.id !== measurementId),
            {
              id: measurementId,
              label: stringSetting(params, "label") ?? "Accepted-endpoint pH",
              value: displayedPh,
              unit: "pH",
              equipmentInstanceId: source.id,
              nodeId,
            },
          ],
        };
        return {
          ok: true,
          state: addNotebook(
            withMeasurement,
            nodeId,
            actionDefinition.label,
            `${displayedPh.toFixed(precision)} pH at ${dispense.deliveredVolumeMl.toFixed(2)} mL delivered (ideal simulator prediction).`,
            ["observe", measurementId, "endpoint-ph", predicted.region, "simulator-generated"],
            "measurement",
          ),
          message: actionDefinition.feedback.success,
        };
      }

      // Reading the ruler and writing the number down are two actions in the source (TR-12/TR-13,
      // TR-14/TR-15), and only the read produces evidence. Before Cycle 10 nothing in the runtime
      // could turn a strip into a distance, so `developChromatogram` supplied the numbers itself.
      const chromatographyMeasurementType = stringSetting(params, "chromatographyMeasurementType");
      if (chromatographyMeasurementType) {
        const measurementId = stringSetting(params, "measurementId") ?? action.measurementId;
        if (!measurementId) {
          return fail(
            state,
            "This distance reading names no measurement id.",
            "Give the reading a measurement id so the notebook entry and the Rf calculation refer to the same evidence.",
            nodeId,
          );
        }
        const reading = chromatographyRulerReading(
          source,
          chromatographyMeasurementType,
          stringSetting(params, "chromatographyBandId"),
        );
        if (!reading.ok) {
          return fail(state, reading.message, reading.recovery, nodeId);
        }
        const divisionMm = numberSetting(params, "rulerPrecisionMm", 1);
        const trueReadingMm = quantiseRulerReadingMm(reading.value, divisionMm);
        const readMm = quantiseRulerReadingMm(
          Number(action.value ?? params.value ?? trueReadingMm),
          divisionMm,
        );
        // Half a division, not a whole one. `isWithinTolerance` is inclusive, so a default of one
        // division would accept a reading a full millimetre off as correct — the ruler's own reading
        // uncertainty is half its finest division.
        const toleranceMm = numberSetting(params, "measurementToleranceMm", divisionMm / 2);
        if (!isWithinTolerance(readMm, trueReadingMm, toleranceMm)) {
          return fail(
            state,
            `${readMm} mm is not what the ruler shows for that distance.`,
            `Align the zero mark on the pencil origin and read to the nearest ${divisionMm} mm.`,
            nodeId,
          );
        }
        const withMeasurement: RuntimeState = {
          ...state,
          measurements: [
            ...state.measurements.filter((measurement) => measurement.id !== measurementId),
            {
              id: measurementId,
              label: stringSetting(params, "label") ?? reading.label,
              value: readMm,
              unit: "mm",
              equipmentInstanceId: source.id,
              nodeId,
            },
          ],
        };
        return {
          ok: true,
          state: addNotebook(
            withMeasurement,
            nodeId,
            actionDefinition.label,
            `${readMm} mm`,
            ["observe", measurementId, "ruler-reading"],
            "measurement",
          ),
          message: actionDefinition.feedback.success,
        };
      }

      // Cycle 06. Investigations 1 and 11 both read a photometer, and before this cycle neither
      // reading depended on the instrument in any way. Blue #1 read an instrument that had never
      // been loaded (audit 8.4): the cuvette was filled on the shelf and the reading succeeded with
      // an empty sample compartment. Nothing checked that a wavelength was configured, that the
      // instrument had been zeroed against the approved blank, or that the cuvette in the slot was
      // the one the step names. This block is entered only when an action declares
      // `photometerOperation`, so every other `readInstrument` step behaves exactly as before.
      const photometerOperation = stringSetting(params, "photometerOperation");
      if (photometerOperation === "darkZero" || photometerOperation === "zero" || photometerOperation === "read") {
        const instrument = findInstance(
          state,
          stringSetting(params, "photometerInstanceId") ??
            action.targetInstanceId ??
            stringSetting(params, "targetInstanceId"),
          stringSetting(params, "photometerDefinitionId") ?? "spectrophotometer",
        );
        if (!instrument) {
          return fail(
            state,
            "The photometer this step uses is not available.",
            "Place the instrument named by this step on the bench before configuring, blanking, or reading it.",
            nodeId,
          );
        }
        if (instrument.location === "shelf") {
          return fail(
            state,
            `${instrument.label} is still on the shelf.`,
            "Place the instrument on the bench before configuring, blanking, or reading it.",
            nodeId,
          );
        }

        // The measurement wavelength is an open confirmation point in both investigations
        // (Inv. 1 point 1, Inv. 11 point 1), so the runtime requires one on record and supplies no
        // default of its own.
        const wavelengthMeasurementId = stringSetting(params, "wavelengthMeasurementId");
        const wavelengthNm = measurementValue(state, wavelengthMeasurementId);
        if (wavelengthMeasurementId && wavelengthNm === undefined) {
          return fail(
            state,
            "The instrument has no configured measurement wavelength on record.",
            "Record the teacher-set wavelength before blanking or reading the instrument; the investigation supplies no default.",
            nodeId,
          );
        }

        const slotZoneId =
          stringSetting(params, "cuvetteSlotZoneId") ?? "spectrophotometer-cuvette-slot";
        const occupant = zoneOccupancy(state, instrument.id, slotZoneId)[0];
        const cuvette = occupant
          ? state.equipmentInstances.find((instance) => instance.id === occupant.childInstanceId)
          : undefined;
        const wavelengthTag = wavelengthNm === undefined ? undefined : `wavelength:${wavelengthNm}nm`;
        const photometerCalibrationMethod = stringSetting(params, "photometerCalibrationMethod");
        const genericScanCalibration = photometerCalibrationMethod === "distilled-water-per-wavelength";
        const selectedWavelengthCalibration = photometerCalibrationMethod === "selected-wavelength-pair";
        const wavelengthMeasurement = wavelengthMeasurementId
          ? state.measurements.find((measurement) => measurement.id === wavelengthMeasurementId)
          : undefined;
        const wavelengthIsNm = wavelengthMeasurement?.unit === "nm" && wavelengthNm !== undefined;
        const currentEpoch = state.photometerCalibrationEpoch ?? 1;
        const currentCalibration = state.photometerCalibration?.[instrument.id];
        if ((genericScanCalibration || selectedWavelengthCalibration) && !wavelengthIsNm) {
          return fail(
            state,
            "The photometer calibration has no current wavelength in nm.",
            "Record the approved wavelength before blanking or reading the instrument.",
            nodeId,
          );
        }
        if (photometerOperation === "darkZero") {
          if (cuvette) {
            return fail(
              state,
              "Dark zero requires an empty sample compartment.",
              "Remove the cuvette, close the empty compartment, and perform the 0%T dark-zero operation.",
              nodeId,
            );
          }
          const darkZeroTag = stringSetting(params, "tag") ?? "photometer-dark-zero";
          if (selectedWavelengthCalibration) {
            const configurationGeneration = currentCalibration?.configurationGeneration;
            if (
              !currentCalibration ||
              currentCalibration.epoch !== currentEpoch ||
              currentCalibration.configurationMode !== "approved-selected-wavelength" ||
              currentCalibration.configuredWavelengthNm !== wavelengthNm ||
              currentCalibration.approvedWavelengthNm !== wavelengthNm ||
              configurationGeneration === undefined
            ) {
              return fail(
                state,
                "The instrument has no current approved wavelength setting.",
                "Record the proposal, obtain teacher approval, and explicitly configure the instrument at that approved wavelength before dark zero.",
                nodeId,
              );
            }
            const calibration: PhotometerCalibrationState = {
              ...currentCalibration,
              epoch: currentEpoch,
              darkZeroedWavelengthNm: wavelengthNm!,
              darkZeroedGeneration: configurationGeneration,
              darkZeroMethod: "selected-wavelength-pair",
              blankedWavelengthNm: undefined,
              blankedGeneration: undefined,
              blankedMethod: undefined,
            };
            const nextCalibration: Record<string, PhotometerCalibrationState> = {
              ...(state.photometerCalibration ?? {}),
              [instrument.id]: calibration,
            };
            return {
              ok: true,
              state: addNotebook(
                {
                  ...state,
                  photometerCalibration: nextCalibration,
                  photometerCalibrationEpoch: currentEpoch,
                },
                nodeId,
                actionDefinition.label,
                `Dark-zeroed the empty compartment at ${wavelengthNm} nm.`,
                ["observe", darkZeroTag, "photometer-dark-zero", `wavelength:${wavelengthNm}nm`],
              ),
              message: actionDefinition.feedback.success,
            };
          }
          return {
            ok: true,
            state: addNotebook(
              state,
              nodeId,
              actionDefinition.label,
              `Dark-zeroed the empty compartment${wavelengthNm === undefined ? "" : ` at ${wavelengthNm} nm`}.`,
              ["observe", darkZeroTag, "photometer-dark-zero", ...(wavelengthTag ? [wavelengthTag] : [])],
            ),
            message: actionDefinition.feedback.success,
          };
        }
        if (!cuvette) {
          return fail(
            state,
            "The instrument's sample compartment is empty.",
            "Insert the cuvette this step names before taking the reading; a reading with an empty slot is not a measurement.",
            nodeId,
          );
        }
        const expectedCuvetteId =
          stringSetting(params, "cuvetteInstanceId") ??
          action.sourceInstanceId ??
          stringSetting(params, "sourceInstanceId");
        if (expectedCuvetteId && cuvette.id !== expectedCuvetteId) {
          return fail(
            state,
            `The sample compartment holds ${cuvette.label}, not the cuvette this step reads.`,
            "Remove the inserted cuvette and insert the one this step names; every reading carries its own sample identity.",
            nodeId,
          );
        }
        if (cuvette.contents.kind === "empty") {
          return fail(
            state,
            `${cuvette.label} is empty.`,
            "Fill the cuvette with the blank or sample this step names before reading it.",
            nodeId,
          );
        }

        if (genericScanCalibration && photometerOperation === "zero") {
          if (
            !currentCalibration ||
            currentCalibration.epoch !== currentEpoch ||
            currentCalibration.configurationMode !== "wavelength-scan" ||
            currentCalibration.configuredWavelengthNm !== wavelengthNm ||
            currentCalibration.configurationGeneration === undefined
          ) {
            return fail(
              state,
              "The photometer is not configured at this scan wavelength.",
              "Set this scan wavelength before blanking the instrument; a blank from another wavelength cannot be reused.",
              nodeId,
            );
          }
          const contents = cuvette.contents;
          const waterLabel = contents.label.toLowerCase();
          const isDistilledWater = /distilled[ -]water/.test(waterLabel);
          const hasPositiveVolume = typeof contents.volumeMl === "number" && contents.volumeMl > 0;
          const isClean = contents.solutes.length === 0 &&
            contents.contamination.length === 0 &&
            contents.precipitate === undefined;
          if (
            !isDistilledWater ||
            !hasPositiveVolume ||
            !isClean ||
            (contents.kind !== "liquid" && contents.kind !== "solution")
          ) {
            return fail(
              state,
              "The generic scan blank must be clean distilled water with a positive volume.",
              "Fill the named measurement cuvette with uncontaminated distilled water, then insert it at the configured wavelength.",
              nodeId,
            );
          }
          const calibration: PhotometerCalibrationState = {
            ...currentCalibration,
            epoch: currentEpoch,
            configuredWavelengthNm: wavelengthNm!,
            blankedWavelengthNm: wavelengthNm!,
            blankedGeneration: currentCalibration.configurationGeneration,
            blankedMethod: "distilled-water-per-wavelength",
            darkZeroedWavelengthNm: undefined,
            darkZeroedGeneration: undefined,
            darkZeroMethod: undefined,
          };
          const nextCalibration = {
            ...(state.photometerCalibration ?? {}),
            [instrument.id]: calibration,
          };
          const blankTag = stringSetting(params, "tag") ?? "photometer-generic-blanked";
          return {
            ok: true,
            state: addNotebook(
              {
                ...state,
                photometerCalibration: nextCalibration,
                photometerCalibrationEpoch: currentEpoch,
              },
              nodeId,
              actionDefinition.label,
              String(
                params.note ??
                  action.note ??
                  `Blanked ${instrument.label} with distilled water at ${wavelengthNm} nm.`,
              ),
              ["observe", blankTag, "photometer-zero", "distilled-water-blank", `wavelength:${wavelengthNm}nm`],
            ),
            message: actionDefinition.feedback.success,
          };
        }

        if (genericScanCalibration && photometerOperation === "read") {
          if (
            !currentCalibration ||
            currentCalibration.epoch !== currentEpoch ||
            currentCalibration.configurationMode !== "wavelength-scan" ||
            currentCalibration.configuredWavelengthNm !== wavelengthNm ||
            currentCalibration.configurationGeneration === undefined ||
            currentCalibration.blankedWavelengthNm !== wavelengthNm ||
            currentCalibration.blankedGeneration !== currentCalibration.configurationGeneration ||
            currentCalibration.blankedMethod !== "distilled-water-per-wavelength"
          ) {
            return fail(
              state,
              "The photometer has not been blanked at this scan wavelength.",
              "Configure this wavelength and blank the instrument with clean distilled water before reading either assigned solution.",
              nodeId,
            );
          }
        }

        if (photometerOperation === "zero") {
          const requiredDarkZeroTag = stringSetting(params, "requiresDarkZeroNotebookTag");
          if (!selectedWavelengthCalibration && requiredDarkZeroTag && !state.notebook.some((entry) =>
            entry.tags.includes(requiredDarkZeroTag) && (!wavelengthTag || entry.tags.includes(wavelengthTag)))) {
            return fail(
              state,
              "The empty-compartment dark zero is missing at this wavelength.",
              "Remove the cuvette and complete the wavelength-matched dark-zero operation before blank zero.",
              nodeId,
            );
          }
          const zeroTag = stringSetting(params, "tag") ?? "instrument-blanked";
          if (selectedWavelengthCalibration) {
            if (
              !currentCalibration ||
              currentCalibration.epoch !== currentEpoch ||
              currentCalibration.configurationMode !== "approved-selected-wavelength" ||
              currentCalibration.approvedWavelengthNm !== wavelengthNm ||
              currentCalibration.configuredWavelengthNm !== wavelengthNm ||
              currentCalibration.configurationGeneration === undefined ||
              currentCalibration.darkZeroedWavelengthNm !== wavelengthNm ||
              currentCalibration.darkZeroedGeneration !== currentCalibration.configurationGeneration ||
              currentCalibration.darkZeroMethod !== "selected-wavelength-pair"
            ) {
              return fail(
                state,
                "The instrument has not been dark-zeroed at the approved wavelength.",
                "Run the empty-compartment 0%T operation at the current approved wavelength before setting 100%T.",
                nodeId,
              );
            }
            const nextCalibration: Record<string, PhotometerCalibrationState> = {
              ...(state.photometerCalibration ?? {}),
              [instrument.id]: {
                ...currentCalibration,
                blankedWavelengthNm: wavelengthNm!,
                blankedGeneration: currentCalibration.configurationGeneration,
                blankedMethod: "selected-wavelength-pair",
              },
            };
            const selectedState: RuntimeState = {
              ...state,
              photometerCalibration: nextCalibration,
              photometerCalibrationEpoch: currentEpoch,
            };
            return {
              ok: true,
              state: addNotebook(
                selectedState,
                nodeId,
                actionDefinition.label,
                String(
                  params.note ??
                    action.note ??
                    `Zeroed against ${cuvette.label} at ${wavelengthNm} nm.`,
                ),
                ["observe", zeroTag, "photometer-zero", ...(wavelengthTag ? [wavelengthTag] : [])],
              ),
              message: actionDefinition.feedback.success,
            };
          }
          return {
            ok: true,
            state: addNotebook(
              state,
              nodeId,
              actionDefinition.label,
              String(
                params.note ??
                  action.note ??
                  `Zeroed against ${cuvette.label}${
                    wavelengthNm === undefined ? "" : ` at ${wavelengthNm} nm`
                  }.`,
              ),
              ["observe", zeroTag, "photometer-zero", ...(wavelengthTag ? [wavelengthTag] : [])],
            ),
            message: actionDefinition.feedback.success,
          };
        }

        if (selectedWavelengthCalibration && photometerOperation === "read") {
          if (
            !currentCalibration ||
            currentCalibration.epoch !== currentEpoch ||
            currentCalibration.configurationMode !== "approved-selected-wavelength" ||
            currentCalibration.approvedWavelengthNm !== wavelengthNm ||
            currentCalibration.configuredWavelengthNm !== wavelengthNm ||
            currentCalibration.configurationGeneration === undefined ||
            currentCalibration.darkZeroedWavelengthNm !== wavelengthNm ||
            currentCalibration.darkZeroedGeneration !== currentCalibration.configurationGeneration ||
            currentCalibration.darkZeroMethod !== "selected-wavelength-pair" ||
            currentCalibration.blankedWavelengthNm !== wavelengthNm ||
            currentCalibration.blankedGeneration !== currentCalibration.configurationGeneration ||
            currentCalibration.blankedMethod !== "selected-wavelength-pair"
          ) {
            return fail(
              state,
              "The instrument has not been blanked at the approved wavelength.",
              "Complete the current-wavelength 0%T and 100%T operations before reading this sample.",
              nodeId,
            );
          }
        }

        // A sample read is only meaningful after a zero, and the zero has to be evidence rather
        // than prose. `photometer-instrument`'s own constraint is mustBeBlankedBeforeSampleRead.
        const requiredZeroTag = stringSetting(params, "requiresZeroNotebookTag");
        if (!selectedWavelengthCalibration && requiredZeroTag && !state.notebook.some((entry) =>
          entry.tags.includes(requiredZeroTag) && (!wavelengthTag || entry.tags.includes(wavelengthTag)))) {
          return fail(
            state,
            "The instrument has not been zeroed against the approved blank.",
            "Insert the approved blank and zero the instrument at the configured wavelength before reading a sample.",
            nodeId,
          );
        }

        const quantity = stringSetting(params, "photometricQuantity");
        if (!quantity || !isPhotometricQuantity(quantity)) {
          return fail(
            state,
            "This reading does not declare which photometric quantity it measures.",
            "Declare percentTransmittance, decimalTransmittance, or absorbance; the three describe the same beam and are not interchangeable.",
            nodeId,
          );
        }
        const readingMeasurementId = stringSetting(params, "measurementId") ?? action.measurementId;
        if (!readingMeasurementId) {
          return fail(
            state,
            "This reading names no measurement id.",
            "Give the reading a measurement id so the notebook record and every later calculation refer to the same evidence.",
            nodeId,
          );
        }
        // The instrument response is either teacher-configured — Investigation 11 supplies an
        // approved simulator calibration profile — or entered by the student from the display, as
        // in Investigation 1, where the stock molarity and the wavelength are deliberately withheld
        // so no response can be derived without inventing one. Either way it belongs to the read
        // and not to the record: before this cycle the value sat on the `record` action, so a
        // student could write a reading down without ever having taken one.
        const configuredReading = numberSetting(params, "instrumentReadingValue", Number.NaN);
        const reading = Number(
          stringSetting(params, "readingSource") === "action-input"
            ? action.value
            : (action.value ?? configuredReading),
        );
        if (!Number.isFinite(reading)) {
          // Two sources are admissible and the message names both, because the third — a student
          // typing into the player — does not exist: `ProcessSidebar` collects no numeric input for
          // an `observe`. A reading with neither source is a content gap, not a student mistake.
          return fail(
            state,
            "The instrument has no reading to report for this step.",
            "This reading needs either a configured instrument response for the classroom profile, or a value supplied by the caller; the investigation supplies neither on its own.",
            nodeId,
          );
        }
        if (!photometricValueInRange(quantity, reading)) {
          return fail(
            state,
            `${reading} is not a possible ${PHOTOMETRIC_UNITS[quantity]} value.`,
            quantity === "percentTransmittance"
              ? "Percent transmittance runs from just above 0 to 100."
              : quantity === "decimalTransmittance"
                ? "Decimal transmittance runs from just above 0 to 1; divide a percent transmittance by 100 first."
                : "Absorbance cannot be negative.",
            nodeId,
          );
        }
        // The reliable maximum is teacher-configured, so exceeding it is not an error. Both sources
        // branch on it — Investigation 1 to an approved dilution and back-calculation (I-05), and
        // Investigation 11 to a wavelength or range redesign — and that branch argues from the
        // out-of-range reading, so the reading is recorded and flagged rather than rejected.
        const reliableMaximum = numberSetting(params, "reliableMaximum", Number.NaN);
        const overRange = Number.isFinite(reliableMaximum) && reading > reliableMaximum;
        const readingUnit = PHOTOMETRIC_UNITS[quantity];
        const withReading: RuntimeState = {
          ...state,
          measurements: [
            ...state.measurements.filter((measurement) => measurement.id !== readingMeasurementId),
            {
              id: readingMeasurementId,
              label: stringSetting(params, "label") ?? actionDefinition.label,
              value: reading,
              unit: readingUnit,
              equipmentInstanceId: cuvette.id,
              nodeId,
            },
          ],
        };
        return {
          ok: true,
          state: addNotebook(
            withReading,
            nodeId,
            actionDefinition.label,
            `${reading} ${readingUnit}`,
            [
              "observe",
              readingMeasurementId,
              "photometer-reading",
              quantity,
              ...(wavelengthTag ? [wavelengthTag] : []),
              ...(overRange ? ["over-range"] : []),
            ],
            "measurement",
          ),
          message: actionDefinition.feedback.success,
        };
      }
    }

    // Cycle 06, found by reviewing this cycle's own code. `i1-record-wavelength`,
    // `i1-record-stock-concentration`, and `cv11-set-approved-wavelength` each declare a
    // `measurementId`, a numeric `inputMode`, and a unit, and every gate this cycle added consumes
    // one of those three measurements. The generic `observe` path below writes a notebook entry and
    // **no measurement** — only `weigh`, `measureVolume`, `dilute`, `developChromatogram`, `record`,
    // and the two special `observe` branches above produce one — so the declaration was decorative
    // and the gates were unsatisfiable through every input path. The first version of this cycle had
    // therefore replaced a lab that computed fabricated zeros with a lab that could not be started.
    //
    // The value is teacher configuration, not a student reading: `ProcessSidebar` collects no
    // numeric input for an `observe`, the same gap the note above records for free text. So it comes
    // from a declared `configuredValue`, and content that declares none blocks here naming the
    // missing classroom value. That is what an unresolved `C` point requires — retain the
    // configuration or block the behaviour, never decide it silently — and Investigation 1 finding
    // 3.1 says of exactly these values, "do not invent these".
    const configurationQuantity = stringSetting(params, "configurationQuantity");
    if (configurationQuantity) {
      const configurationMeasurementId = stringSetting(params, "measurementId");
      if (!configurationMeasurementId) {
        return fail(
          state,
          "This configuration step names no measurement id.",
          "Give the configured value a measurement id so the steps that depend on it can find it.",
          nodeId,
        );
      }
      const configurationUnit = String(params.unit ?? "");
      const photometerConfigurationMode = stringSetting(params, "photometerConfigurationMode");
      const photometerInstanceId = photometerConfigurationMode === "wavelength-scan" ||
        photometerConfigurationMode === "approved-selected-wavelength"
        ? stringSetting(params, "photometerInstanceId")
        : undefined;
      let configured = Number(
        action.value ??
          numberSetting(
            params,
            "configuredValue",
            numberSetting(params, "configurationValue", Number.NaN),
          ),
      );
      const approvedWavelengthMeasurementId = stringSetting(
        params,
        "approvedWavelengthMeasurementId",
      );
      if (photometerConfigurationMode === "approved-selected-wavelength") {
        const approvedMeasurement = approvedWavelengthMeasurementId
          ? state.measurements.find((measurement) => measurement.id === approvedWavelengthMeasurementId)
          : undefined;
        const approvedCalibration = photometerInstanceId
          ? state.photometerCalibration?.[photometerInstanceId]
          : undefined;
        const approvedValue = approvedMeasurement?.value;
        if (
          !approvedMeasurement ||
          approvedMeasurement.unit !== "nm" ||
          typeof approvedValue !== "number" ||
          !Number.isFinite(approvedValue) ||
          !photometerInstanceId ||
          !approvedCalibration ||
          approvedCalibration.epoch !== (state.photometerCalibrationEpoch ?? 1) ||
          approvedCalibration.approvedWavelengthNm !== approvedValue
        ) {
          return fail(
            state,
            "The instrument cannot be configured without current teacher approval.",
            "Record a wavelength proposal and obtain teacher approval before setting the actual instrument wavelength.",
            nodeId,
          );
        }
        configured = approvedValue;
      }
      if (!Number.isFinite(configured)) {
        return fail(
          state,
          `This lab has no configured ${configurationQuantity} yet.`,
          String(
            params.inputLabel ??
              "The teacher supplies this value and the investigation states none. Configure it before the steps that depend on it can run.",
          ),
          nodeId,
        );
      }
      if (photometerInstanceId) {
        const photometer = findInstance(state, photometerInstanceId, "spectrophotometer");
        if (!photometer) {
          return fail(
            state,
            "The configured photometer is not available.",
            "Place the named spectrophotometer on the bench before setting its wavelength.",
            nodeId,
          );
        }
        if (photometer.location === "shelf") {
          return fail(
            state,
            `${photometer.label} is still on the shelf.`,
            "Place the spectrophotometer on the bench before setting its wavelength.",
            nodeId,
          );
        }
        if (configurationUnit !== "nm") {
          return fail(
            state,
            "The photometer wavelength must be recorded in nm.",
            "Use the authored nanometre wavelength configuration for this instrument.",
            nodeId,
          );
        }
      }
      const withConfiguration: RuntimeState = {
        ...state,
        measurements: [
          ...state.measurements.filter(
            (measurement) => measurement.id !== configurationMeasurementId,
          ),
          {
            id: configurationMeasurementId,
            label: stringSetting(params, "label") ?? actionDefinition.label,
            value: configured,
            unit: configurationUnit,
            nodeId,
          },
        ],
      };
      let nextConfiguration = withConfiguration;
      if (photometerInstanceId) {
        const epoch = state.photometerCalibrationEpoch ?? 1;
        const previous = state.photometerCalibration?.[photometerInstanceId];
        const nextCalibration = { ...(state.photometerCalibration ?? {}) };
        nextCalibration[photometerInstanceId] = {
          ...(previous?.epoch === epoch ? previous : {}),
          epoch,
          configuredWavelengthNm: configured,
          configurationMode: photometerConfigurationMode === "approved-selected-wavelength"
            ? "approved-selected-wavelength"
            : "wavelength-scan",
          configurationGeneration: (previous?.epoch === epoch
            ? previous.configurationGeneration ?? 0
            : 0) + 1,
          blankedWavelengthNm: undefined,
          blankedGeneration: undefined,
          blankedMethod: undefined,
          darkZeroedWavelengthNm: undefined,
          darkZeroedGeneration: undefined,
          darkZeroMethod: undefined,
        };
        nextConfiguration = {
          ...withConfiguration,
          photometerCalibration: nextCalibration,
          photometerCalibrationEpoch: epoch,
        };
      }
      return {
        ok: true,
        state: addNotebook(
          nextConfiguration,
          nodeId,
          actionDefinition.label,
          `${configured} ${configurationUnit}`.trim(),
          [
            "observe",
            String(params.tag ?? "configuration"),
            "configuration",
            configurationQuantity,
          ],
          "measurement",
        ),
        message: actionDefinition.feedback.success,
      };
    }

    const instrumentEvidence = stringSetting(params, "instrumentEvidence");
    if (instrumentEvidence) {
      const supportedInstruments: Record<string, { definitions: string[]; unit: string }> = { "read-aqueous-conductivity": { definitions: ["conductivity-tester"], unit: "uS/cm" }, "read-solid-conductivity": { definitions: ["conductivity-tester"], unit: "uS/cm" }, "read-ph-indicator": { definitions: ["ph-paper", "ph-meter"], unit: "pH" }, "read-melting-behavior": { definitions: ["melting-point-apparatus"], unit: "C" }, "test-magnetic-response": { definitions: ["magnet"], unit: "flag" } };
      const supported = supportedInstruments[instrumentEvidence];
      if (!supported || actionDefinition.parameters.instrumentEvidence !== instrumentEvidence || actionDefinition.parameters.unit !== supported.unit) return fail(state, "Unsupported instrument operation or unit.", "Use the authored instrument-reading contract.", nodeId);
      const sample = findInstance(state, stringSetting(params, "sourceInstanceId"), String(actionDefinition.interaction?.sourceDefinitionId ?? ""));
      const instrument = state.equipmentInstances.find((entry) => entry.id === params.instrumentInstanceId);
      const reading = action.value;
      const measurementId = stringSetting(params, "measurementId");
      if (!sample || !instrument || !supported.definitions.includes(instrument.definitionId) || sample.contents.kind === "empty" || typeof reading !== "number" || !Number.isFinite(reading) || !measurementId) return fail(state, "A matching sample, instrument and finite acquired reading are required.", "Acquire the classroom reading for this exact sample and instrument.", nodeId);
      const conductivity = instrumentEvidence.includes("conductivity");
      const magnetic = instrumentEvidence === "test-magnetic-response";
      const ph = instrumentEvidence === "read-ph-indicator";
      const threshold = magnetic ? 1 : conductivity ? actionDefinition.parameters.conductivityThresholds : ph ? actionDefinition.parameters.phThresholds : actionDefinition.parameters.meltingApparatusLimits;
      if (typeof threshold !== "number" || !Number.isFinite(threshold)) return fail(state, "The instructor instrument threshold is missing.", "Start a fresh run with the approved numeric setup.", nodeId);
      if ((conductivity && reading < 0) || (ph && (reading < 0 || reading > 14)) || (!conductivity && !ph && reading > threshold)) return fail(state, "The acquired value is outside the supported instrument limits.", "Check units and the approved instrument range; do not invent a result beyond it.", nodeId);
      if (magnetic && reading !== 0 && reading !== 1) return fail(state, "Magnetic observation must be 0 or 1.", "Record whether attraction was observed.", nodeId);
      if ((ph || instrumentEvidence === "read-aqueous-conductivity") && (sample.contents.volumeMl ?? 0) <= 0) return fail(state, "This test needs the prepared aqueous sample.", "Prepare the water test solution before acquiring this reading.", nodeId);
      const classification = magnetic ? (reading === 1 ? "attraction-observed" : "no-attraction-observed") : conductivity ? (reading >= threshold ? "at-or-above-conducting-threshold" : "below-conducting-threshold") : ph ? (reading < threshold ? "below-pH-boundary" : "at-or-above-pH-boundary") : "within-approved-apparatus-range";
      const next = { ...state, measurements: [...state.measurements.filter((entry) => entry.id !== measurementId), { id: measurementId, label: actionDefinition.label, value: reading, unit: String(params.unit), equipmentInstanceId: sample.id, nodeId }] };
      return { ok: true, state: addNotebook(next, nodeId, actionDefinition.label, `${reading} ${String(params.unit)}; ${classification}; configured limit ${threshold}. Externally acquired classroom evidence.`, ["instrument-reading", classification, "classroom-evidence"]), message: actionDefinition.feedback.success };
    }

    // A numeric observation may be student-entered evidence rather than a configured answer. When
    // content gives it a measurement id, preserve that value in the same runtime evidence store used
    // by instrument readings so later gates and calculations can consume what the student entered.
    const observationMeasurementId = stringSetting(params, "measurementId") ?? action.measurementId;
    if (
      stringSetting(params, "inputMode") === "numeric" &&
      observationMeasurementId &&
      typeof action.value === "number" &&
      Number.isFinite(action.value)
    ) {
      const photometerProposalMode = stringSetting(params, "photometerProposalMode");
      const photometerProposalInstanceId = photometerProposalMode === "selected-wavelength"
        ? stringSetting(params, "photometerInstanceId")
        : undefined;
      if (photometerProposalMode === "selected-wavelength") {
        if (!photometerProposalInstanceId || String(params.unit ?? "") !== "nm") {
          return fail(
            state,
            "The wavelength proposal is not bound to a nanometre photometer reading.",
            "Record the proposed wavelength in nm and bind it to the selected spectrophotometer.",
            nodeId,
          );
        }
      }
      const observedTemperatureC = action.value;
      const temperatureEvidenceId = stringSetting(params, "temperatureEvidenceId");
      const temperatureEvidence = temperatureEvidenceId
        ? state.temperatureEvidence.find((entry) => entry.id === temperatureEvidenceId)
        : undefined;
      if (temperatureEvidenceId && !temperatureEvidence) {
        return fail(
          state,
          "The temperature reading this record refers to is missing.",
          "Read the required initial, peak, or timed temperature before recording it.",
          nodeId,
        );
      }
      const measurementTolerance = Math.max(
        0,
        numberSetting(params, "measurementTolerance", 0.05),
      );
      if (
        temperatureEvidence &&
        !isWithinTolerance(action.value, temperatureEvidence.valueC, measurementTolerance)
      ) {
        return fail(
          state,
          `${action.value} °C does not match the temperature evidence for this step.`,
          `Record the displayed value (${temperatureEvidence.valueC} °C) without replacing it with a target or rounded guess.`,
          nodeId,
        );
      }
      const observationUnit = String(params.unit ?? "");
      const withMeasurementRecord: RuntimeState = {
        ...state,
        measurements: [
          ...state.measurements.filter(
            (measurement) => measurement.id !== observationMeasurementId,
          ),
          {
            id: observationMeasurementId,
            label: stringSetting(params, "label") ?? actionDefinition.label,
            value: action.value,
            unit: observationUnit,
            nodeId,
          },
        ],
      };
      const temperatureTargetInstanceId = stringSetting(params, "temperatureTargetInstanceId");
      const withMeasurement = temperatureTargetInstanceId
        ? updateInstance(withMeasurementRecord, temperatureTargetInstanceId, (instance) => ({
            ...instance,
            contents: {
              ...instance.contents,
              temperatureC: action.value,
            },
          }))
        : withMeasurementRecord;
      const recordedTemperatureTargetInstanceId = stringSetting(
        params,
        "recordedTemperatureTargetInstanceId",
      );
      const recordedTemperatureLabel = stringSetting(params, "recordedTemperatureLabel");
      const recordedTemperaturePrecision = Math.max(
        0,
        Math.min(4, Math.floor(numberSetting(params, "recordedTemperaturePrecision", 1))),
      );
      const withRecordedTemperature =
        recordedTemperatureTargetInstanceId && recordedTemperatureLabel
          ? updateInstance(withMeasurement, recordedTemperatureTargetInstanceId, (instance) => ({
              ...instance,
              contents: {
                ...instance.contents,
                recordedTemperature: {
                  label: recordedTemperatureLabel,
                  valueC: observedTemperatureC,
                  precision: recordedTemperaturePrecision,
                  provenance: "student-recorded",
                },
              },
            }))
          : withMeasurement;
      const withPhotometerProposal = photometerProposalInstanceId
        ? {
            ...withRecordedTemperature,
            photometerCalibration: {
              ...(withRecordedTemperature.photometerCalibration ?? {}),
              [photometerProposalInstanceId]: {
                ...(withRecordedTemperature.photometerCalibration?.[photometerProposalInstanceId]?.epoch ===
                (withRecordedTemperature.photometerCalibrationEpoch ?? 1)
                  ? withRecordedTemperature.photometerCalibration[photometerProposalInstanceId]
                  : {}),
                epoch: withRecordedTemperature.photometerCalibrationEpoch ?? 1,
                proposedWavelengthNm: action.value,
                approvedWavelengthNm: undefined,
              },
            },
          }
        : withRecordedTemperature;
      return {
        ok: true,
        state: addNotebook(
          withPhotometerProposal,
          nodeId,
          actionDefinition.label,
          `${action.value} ${observationUnit}`.trim(),
          [
            "observe",
            String(params.tag ?? (photometerProposalMode === "selected-wavelength"
              ? "photometer-wavelength-proposal"
              : "observation")),
            observationMeasurementId,
            ...(photometerProposalMode === "selected-wavelength" ? ["wavelength-proposal"] : []),
          ],
          "measurement",
        ),
        message: actionDefinition.feedback.success,
      };
    }

    // Student text and choices now travel on the request note. Preserve the response itself, while
    // retaining authored note/prompt text as the compatibility fallback for older definitions.
    let note = String(action.note ?? params.note ?? params.prompt ?? "Observation recorded.");
    // A lab with replicate trials cannot give every endpoint observation the same notebook tag —
    // Cycle 08 found that shared evidence identities let one sample's observation satisfy another's
    // gate — so the narration recognises any per-trial `<trial>-endpoint` tag as well.
    const observationTag = String(params.tag ?? "");
    if (observationTag === "endpoint" || observationTag.endsWith("-endpoint")) {
      // Scoping matters once a lab has replicates: searching every dispense record meant trial 5's
      // endpoint observation could report trial 2's overshoot. An observation that names its own
      // dispense sees only that one; content that names none keeps the previous corpus-wide search.
      const scopedDispenseActionId = stringSetting(params, "dispenseActionId");
      const candidates = scopedDispenseActionId
        ? [state.dropDispenses[scopedDispenseActionId]].filter(
            (record): record is NonNullable<typeof record> => Boolean(record),
          )
        : Object.values(state.dropDispenses);
      const overrun = candidates.find(
        (record) => record.accepted && record.dropsDispensed > record.endpointDropCount,
      );
      if (overrun) {
        const extraDrops = overrun.dropsDispensed - overrun.endpointDropCount;
        // The overshoot narration was unconditional and named NaOH, so a redox overshoot would have
        // been reported as an alkaline mixture. An endpoint observation may name its own.
        const description =
          stringSetting(params, "overshootNote") ??
          "the solution is darker pink, indicating excess NaOH and an alkaline titration mixture";
        note = `After ${extraDrops} extra drop${extraDrops === 1 ? "" : "s"}, ${description}.`;
      }
    }
    return {
      ok: true,
      state: addNotebook(state, nodeId, actionDefinition.label, note, ["observe", String(params.tag ?? "observation")]),
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "record") {
    if (actionDefinition.interaction?.type === "recordTimeSeries" || stringSetting(params, "kineticsModelId")) {
      const model = kineticsModelFor(definition, stringSetting(params, "kineticsModelId"));
      const conditionId = stringSetting(params, "conditionId");
      if (!model || !conditionId) {
        return fail(
          state,
          "No kinetics model or condition is available for timed data recording.",
          "Check that this action references a kinetics model id and condition id.",
          nodeId,
        );
      }

      const continuityMassContract =
        actionDefinition.mass?.source === "measurement"
          ? actionDefinition.mass
          : undefined;
      const massContinuity = continuityMassContract?.continuity;
      const measuredMassG = resolveContractedMassG(state, action, actionDefinition);
      if (actionDefinition.mass && measuredMassG === undefined) {
        return fail(
          state,
          "The named current-scope marble mass evidence is missing.",
          "Record the matching material-portion mass in this attempt before collecting the gas series.",
          nodeId,
        );
      }
      if (massContinuity) {
        const rateIntervalS = numberSetting(params, "rateIntervalS", Number.NaN);
        if (
          !Number.isFinite(rateIntervalS) || rateIntervalS <= 0 ||
          !model.timepointsS.includes(0) || !model.timepointsS.includes(rateIntervalS)
        ) {
          return fail(
            state,
            "The kinetic rate interval is not an authored time point for this series.",
            "Use a positive rateIntervalS that is present in the model's recorded time points.",
            nodeId,
          );
        }
      }

      let generated: ReturnType<typeof generateGasVolumeSeries>;
      try {
        generated = generateGasVolumeSeries(model, conditionId, massContinuity ? measuredMassG : undefined);
      } catch (error) {
        return fail(
          state,
          error instanceof Error ? error.message : "Kinetics data could not be generated.",
          "Check the kinetics model and selected condition before recording timed data.",
          nodeId,
        );
      }

      const dataSeriesId = stringSetting(params, "dataSeriesId") ?? `${conditionId}-gas-series`;
      const dataSeries: DataSeriesRecord = {
        id: dataSeriesId,
        label: String(params.label ?? generated.condition.label ?? actionDefinition.label),
        xUnit: String(params.xUnit ?? "s"),
        yUnit: String(params.yUnit ?? "mL CO2"),
        points: generated.points,
        sourceActionId: actionDefinition.id,
        nodeId,
        metadata: {
          kineticsModelId: model.id,
          conditionId,
          variable: generated.condition.variable,
          acidConcentrationM: generated.condition.acidConcentrationM,
          chipSize: generated.condition.chipSize,
          temperatureC: generated.condition.temperatureC,
          rateFactor: generated.condition.rateFactor,
          ...(massContinuity
            ? {
                measuredMassG: measuredMassG!,
                logicalMeasurementId: continuityMassContract!.referenceId,
                producerActionId: massContinuity.producerActionId,
                evidenceScopeId: state.evidenceScopeId,
                evidenceScopeGeneration: currentEvidenceScopeGeneration(state),
                measuredSupportInstanceId: massContinuity.measuredSupportInstanceId,
                materialSourceInstanceId: massContinuity.materialSourceInstanceId!,
                referenceMassG: model.controlled.marbleMassG,
                effectiveMaxVolumeMl: generated.effectiveMaxVolumeMl,
                rateIntervalS: numberSetting(params, "rateIntervalS", Number.NaN),
              }
            : {}),
        },
      };
      const finalPoint = dataSeries.points[dataSeries.points.length - 1];
      const next = {
        ...state,
        dataSeries: [
          ...state.dataSeries.filter((series) =>
            massContinuity
              ? !(
                  series.id === dataSeries.id &&
                  series.sourceActionId === actionDefinition.id &&
                  series.metadata?.evidenceScopeId === state.evidenceScopeId &&
                  series.metadata?.evidenceScopeGeneration === currentEvidenceScopeGeneration(state)
                )
              : series.id !== dataSeries.id,
          ),
          dataSeries,
        ],
      };
      return {
        ok: true,
        state: addNotebook(
          next,
          nodeId,
          dataSeries.label,
          `${dataSeries.points.length} timed CO2 readings recorded; final volume ${finalPoint?.y ?? 0} ${dataSeries.yUnit}.`,
          ["record", dataSeries.id, "time-series"],
          "measurement",
        ),
        message: actionDefinition.feedback.success,
      };
    }

    const measurementId = String(params.measurementId ?? action.measurementId ?? "");
    const existing = state.measurements.find((measurement) => measurement.id === measurementId);
    const suppliedValue = action.value ?? params.value;
    if (booleanSetting(params, "copyExistingMeasurementOnly")) {
      if (!existing) {
        return fail(
          state,
          "No instrument reading is available to copy.",
          "Take the required instrument reading before recording it.",
          nodeId,
        );
      }
      if (suppliedValue !== undefined && Number(suppliedValue) !== existing.value) {
        return fail(
          state,
          "The recorded value must match the instrument display.",
          `Copy ${existing.value} ${existing.unit} exactly; this step does not accept a replacement value.`,
          nodeId,
        );
      }
    }
    // Cycle 09 authored `studentValueRequired` onto two `record` steps whose value the runtime cannot
    // produce — an initial pH and an equivalence volume read off the student's own curve — and only
    // the `calculate` handler honoured the flag, so the declaration read as enforcement while being
    // decorative. It now means the same thing on both verbs: a value the student derived, never one
    // replayed from an earlier step.
    if (booleanSetting(params, "studentValueRequired") && action.value === undefined) {
      return fail(
        state,
        "This step needs the value you read or derived.",
        "Read the instrument or work the value out from your own data, then record it; the simulator does not supply it.",
        nodeId,
      );
    }
    if (measurementId && !existing && suppliedValue === undefined) {
      return fail(
        state,
        "No measurement is available to record.",
        "Collect the physical measurement first, then record it in the notebook.",
        nodeId,
      );
    }
    const value = Number(suppliedValue ?? existing?.value ?? 0);
    const unit = String(action.unit ?? params.unit ?? existing?.unit ?? "");
    const label = String(params.label ?? existing?.label ?? actionDefinition.label);
    const withMeasurement = measurementId
      ? {
          ...state,
          measurements: [
            ...state.measurements.filter((measurement) => measurement.id !== measurementId),
            {
              id: measurementId,
              label,
              value,
              unit,
              equipmentInstanceId: existing?.equipmentInstanceId,
              nodeId,
            },
          ],
        }
      : state;
    return {
      ok: true,
      state: addNotebook(withMeasurement, nodeId, label, `${value} ${unit}`.trim(), ["record", measurementId], "measurement"),
      message: actionDefinition.feedback.success,
    };
  }

  if (action.verb === "calculate") {
    if (actionDefinition.analysis) {
      const contract = actionDefinition.analysis;
      let value: number;
      let unit: string;
      let regression: RuntimeState["calculations"][number]["regression"];
      let series: DataSeriesPoint[] | undefined;
      let evidenceLabel: string;
      try {
        if (contract.type === "massDifferenceWithinTolerance") {
          const first = state.measurements.find((entry) => entry.id === contract.firstMassMeasurementId);
          const second = state.measurements.find((entry) => entry.id === contract.secondMassMeasurementId);
          const tolerance = state.measurements.find((entry) => entry.id === contract.toleranceMeasurementId);
          if (!first || !second || !tolerance || first.id === second.id ||
              [first, second, tolerance].some((entry) => !Number.isFinite(entry.value) || entry.value < 0) ||
              !["g", "mg", "kg"].includes(first.unit) || second.unit !== first.unit || tolerance.unit !== first.unit ||
              !["below", "atOrBelow"].includes(contract.comparison)) throw new Error("Distinct finite nonnegative mass readings and a compatible configured tolerance are required.");
          const toleranceApproved = actionDefinition.prerequisites.some((rule) => rule.type === "actionEvidence" && getActions(definition).some((control) =>
            control.id === rule.actionId && control.parameters.inputRole === "teacherConfiguration" && control.parameters.configuredValue === undefined &&
            getProcess(definition).nodes.some((node) => node.id === tolerance.nodeId && node.actionId === control.id) &&
            state.attemptHistory.some((attempt) => attempt.actionId === control.id && attempt.success)));
          if (!toleranceApproved) throw new Error("The tolerance requires a successfully acquired teacher configuration action prerequisite.");
          const difference = Math.abs(second.value - first.value);
          value = (contract.comparison === "below" ? difference < tolerance.value : difference <= tolerance.value) ? 1 : 0;
          unit = "flag";
          evidenceLabel = `${first.id}, ${second.id}; absolute difference ${difference} ${first.unit}; tolerance ${tolerance.id} = ${tolerance.value} ${tolerance.unit}; comparison ${contract.comparison}`;
        } else if (contract.type === "mixedEvidenceRegression") {
          const pairs = contract.pairs.map((pair) => ({
            x: evidenceRecord(state, pair.x),
            y: evidenceRecord(state, pair.y),
          }));
          if (pairs.some((pair) => !pair.x || !pair.y)) throw new Error("Every regression operand must be accepted finite evidence.");
          if (pairs.some((pair) => pair.x!.unit !== contract.xUnit || pair.y!.unit !== contract.yUnit)) {
            throw new Error("Regression evidence units do not match the declared axes.");
          }
          series = pairs.map((pair) => ({ x: pair.x!.value, y: pair.y!.value }));
          if (new Set(series.map((pair) => pair.x)).size < 2) throw new Error("Regression requires at least two distinct x values.");
          regression = { ...calculateLinearRegression(series), xUnit: contract.xUnit, yUnit: contract.yUnit };
          value = regression.rSquared;
          unit = "rSquared";
          evidenceLabel = pairs.map((pair) => `${pair.x!.id}:${pair.y!.id}`).join(", ");
        } else if (contract.type === "unaryEvidenceTransform") {
          const input = evidenceRecord(state, contract.input);
          if (!input) throw new Error("The named transform operand is missing or unaccepted.");
          if ((contract.operation === "reciprocal" && input.value === 0) ||
              ((contract.operation === "log10" || contract.operation === "negativeLog10") && input.value <= 0)) {
            throw new Error("The named evidence is outside the selected transform domain.");
          }
          value = contract.operation === "identity" ? input.value
            : contract.operation === "reciprocal" ? 1 / input.value
              : contract.operation === "log10" ? Math.log10(input.value)
                : contract.operation === "negativeLog10" ? -Math.log10(input.value)
                  : 10 ** input.value;
          if (!Number.isFinite(value)) throw new Error("The selected transform did not produce a finite result.");
          unit = contract.outputUnit;
          evidenceLabel = `${input.id} using ${contract.operation}`;
        } else if (contract.type === "concentrationFromRegression") {
          const response = evidenceRecord(state, contract.response);
          const calibration = state.calculations.find((entry) => entry.id === contract.regressionCalculationId && entry.passed === true);
          if (!response || !calibration?.regression) throw new Error("The accepted response and regression are both required.");
          if (calibration.regression.yUnit !== response.unit || calibration.regression.xUnit !== contract.outputUnit) {
            throw new Error("The response and output units must match the regression y and x axes.");
          }
          value = calculateConcentrationFromRegression(response.value, calibration.regression);
          if (!Number.isFinite(value)) throw new Error("The regression response did not produce a finite concentration.");
          unit = contract.outputUnit;
          evidenceLabel = `${response.id} and ${calibration.id}`;
        } else {
          const concentration = evidenceRecord(state, contract.concentration);
          const solutionVolume = state.measurements.find((entry) => entry.id === contract.solutionVolumeMeasurementId);
          const molarMass = state.measurements.find((entry) => entry.id === contract.molarMassMeasurementId);
          if (!concentration || !["M", "mol/L"].includes(concentration.unit) || !solutionVolume ||
              !["mL", "L"].includes(solutionVolume.unit) || !molarMass || molarMass.unit !== "g/mol") {
            throw new Error("Molar concentration, solution volume, and molar mass evidence use missing or incompatible units.");
          }
          if (!Number.isFinite(concentration.value) || !Number.isFinite(solutionVolume.value) || !Number.isFinite(molarMass.value) ||
              concentration.value < 0 || solutionVolume.value <= 0 || molarMass.value <= 0) {
            throw new Error("Molar mass conversion requires non-negative concentration and positive volume and molar mass.");
          }
          const volumeL = solutionVolume.unit === "mL" ? solutionVolume.value / 1000 : solutionVolume.value;
          if (!Number.isFinite(volumeL) || volumeL <= 0) throw new Error("The converted solution volume must be positive and finite.");
          value = concentration.value * volumeL * molarMass.value;
          if (!Number.isFinite(value)) throw new Error("The derived mass must be finite.");
          unit = "g";
          evidenceLabel = `${concentration.id}, ${solutionVolume.id}, and ${molarMass.id}`;
        }
      } catch (error) {
        return fail(
          state,
          error instanceof Error ? error.message : "Typed analysis evidence is incomplete.",
          "Complete every named, unit-compatible evidence source before continuing.",
          nodeId,
        );
      }
      const calculationId = contract.outputCalculationId;
      const next: RuntimeState = {
        ...state,
        calculations: [
          ...state.calculations.filter((entry) => entry.id !== calculationId),
          { id: calculationId, label: actionDefinition.label, value, unit, expected: value, tolerance: 0, passed: true, regression, series, nodeId },
        ],
      };
      return {
        ok: true,
        state: addNotebook(next, nodeId, actionDefinition.label, `${value} ${unit} from ${evidenceLabel}`, ["calculate", calculationId, "typed-evidence"], "calculation"),
        message: actionDefinition.feedback.success,
      };
    }
    const calculationId = String(params.calculationId ?? action.calculationId ?? "calculation");
    const template = String(params.template ?? "");
    if (
      template === "measurementCount" ||
      template === "nitricAcidVolumeFromBrassMass" ||
      template === "dilutionAliquotVolume" ||
      template === "regressionComponent" ||
      template === "concentrationFromRegression" ||
      template === "massFromConcentration" ||
      template === "massPercentFromCalculation" ||
      template === "massPercentFromConcentration" ||
      template === "visualComparisonConcentration" ||
      template === "percentDifferenceCalculations" ||
      template === "classifyMeasurementAgainstBound" ||
      template === "dilutionFactorFromVolumes" ||
      template === "backCalculateConcentrationFromDilution"
    ) {
      let derivedValue: number;
      let derivedUnit = String(params.unit ?? "");
      let regression: RuntimeState["calculations"][number]["regression"];
      let evidenceLabel = "recorded evidence";
      try {
        if (template === "measurementCount") {
          const measurementIds = stringArraySetting(params, "measurementIds");
          const recorded = measurementIds.filter((id) => state.measurements.some((entry) => entry.id === id));
          if (measurementIds.length === 0 || recorded.length !== measurementIds.length) {
            throw new Error("Every named calibration measurement must be recorded before counting the table.");
          }
          derivedValue = recorded.length;
          evidenceLabel = `${recorded.length} named measurements`;
        } else if (template === "nitricAcidVolumeFromBrassMass") {
          const measurement = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "brassMassMeasurementId"),
          );
          if (!measurement) throw new Error("The recorded brass mass is required for the acid calculation.");
          derivedValue = calculateNitricAcidVolumeMl(
            measurement.value,
            numberSetting(params, "acidMolarityM", 15.8),
            numberSetting(params, "copperMolarMassGPerMol", 63.546),
            numberSetting(params, "acidMolesPerCopperMole", 8 / 3),
          );
          evidenceLabel = measurement.id;
        } else if (template === "dilutionAliquotVolume") {
          derivedValue = calculateDilutionAliquotMl(
            numberSetting(params, "stockConcentrationM", Number.NaN),
            numberSetting(params, "targetConcentrationM", Number.NaN),
            numberSetting(params, "finalVolumeMl", Number.NaN),
          );
          evidenceLabel = "the configured stock, target, and final volume";
        } else if (template === "regressionComponent") {
          const source = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "sourceRegressionCalculationId"),
          );
          if (!source?.regression) throw new Error("The calibration regression must be completed first.");
          regression = source.regression;
          const component = stringSetting(params, "regressionComponent");
          if (component === "slope") derivedValue = source.regression.slope;
          else if (component === "intercept") derivedValue = source.regression.intercept;
          else if (component === "rSquared") derivedValue = source.regression.rSquared;
          else throw new Error("Regression component must be slope, intercept, or rSquared.");
          evidenceLabel = source.id;
        } else if (template === "concentrationFromRegression") {
          const measurement = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "responseMeasurementId"),
          );
          const source = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "sourceRegressionCalculationId"),
          );
          if (!measurement || !source?.regression) {
            throw new Error("The unknown response and calibration regression are both required.");
          }
          derivedValue = calculateConcentrationFromRegression(measurement.value, source.regression);
          evidenceLabel = `${measurement.id} and ${source.id}`;
        } else if (template === "massFromConcentration") {
          const concentration = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "concentrationCalculationId"),
          );
          if (!concentration) throw new Error("The concentration calculation must be completed first.");
          derivedValue = calculateCopperMassG(
            concentration.value,
            numberSetting(params, "solutionVolumeMl", Number.NaN),
            numberSetting(params, "copperMolarMassGPerMol", 63.546),
          );
          evidenceLabel = concentration.id;
        } else if (template === "massPercentFromCalculation") {
          const component = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "componentMassCalculationId"),
          );
          const total = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "totalMassMeasurementId"),
          );
          if (!component || !total) throw new Error("Copper mass and brass mass are both required.");
          derivedValue = calculateMassPercent(component.value, total.value);
          evidenceLabel = `${component.id} and ${total.id}`;
        } else if (template === "massPercentFromConcentration") {
          const concentration = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "concentrationCalculationId"),
          );
          const total = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "totalMassMeasurementId"),
          );
          if (!concentration || !total) throw new Error("Visual concentration and brass mass are both required.");
          const copperMass = calculateCopperMassG(
            concentration.value,
            numberSetting(params, "solutionVolumeMl", Number.NaN),
            numberSetting(params, "copperMolarMassGPerMol", 63.546),
          );
          derivedValue = calculateMassPercent(copperMass, total.value);
          evidenceLabel = `${concentration.id} and ${total.id}`;
        } else if (template === "visualComparisonConcentration") {
          const knownDepth = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "knownDepthMeasurementId"),
          );
          const unknownDepth = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "unknownDepthMeasurementId"),
          );
          if (!knownDepth || !unknownDepth) throw new Error("Both visually matched depths must be recorded.");
          derivedValue = calculateVisualComparisonConcentration(
            numberSetting(params, "knownConcentrationM", Number.NaN),
            knownDepth.value,
            unknownDepth.value,
          );
          evidenceLabel = `${knownDepth.id} and ${unknownDepth.id}`;
        } else if (template === "percentDifferenceCalculations") {
          const first = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "firstCalculationId"),
          );
          const second = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "secondCalculationId"),
          );
          if (!first || !second) throw new Error("Both method results must be completed before comparison.");
          derivedValue = calculatePercentDifference(first.value, second.value);
          evidenceLabel = `${first.id} and ${second.id}`;
        } else if (template === "classifyMeasurementAgainstBound") {
          const measured = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "measurementId"),
          );
          const bound = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "boundMeasurementId"),
          );
          const comparison = stringSetting(params, "comparison");
          if (!measured || !bound) throw new Error("The measured response and approved comparison bound are both required.");
          if (!Number.isFinite(measured.value) || !Number.isFinite(bound.value)) {
            throw new Error("The response and approved bound must both be finite.");
          }
          if (!measured.unit || measured.unit !== bound.unit) {
            throw new Error("The response and approved bound must use the same non-empty unit.");
          }
          if (comparison !== "below" && comparison !== "above") {
            throw new Error("The bound comparison must explicitly be below or above.");
          }
          derivedValue = comparison === "below"
            ? (measured.value < bound.value ? 1 : 0)
            : (measured.value > bound.value ? 1 : 0);
          derivedUnit = "flag";
          evidenceLabel = `${measured.id} ${comparison} ${bound.id}`;
        } else if (template === "dilutionFactorFromVolumes") {
          const initial = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "initialVolumeMeasurementId"),
          );
          const final = state.measurements.find(
            (entry) => entry.id === stringSetting(params, "finalVolumeMeasurementId"),
          );
          if (!initial || !final || initial.unit !== "mL" || final.unit !== "mL" ||
              initial.value <= 0 || final.value <= initial.value) {
            throw new Error("Positive initial and larger final volume measurements in mL are required.");
          }
          derivedValue = final.value / initial.value;
          derivedUnit = "x";
          evidenceLabel = `${initial.id} and ${final.id}`;
        } else {
          const diluted = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "dilutedConcentrationCalculationId"),
          ) ?? state.measurements.find(
            (entry) => entry.id === stringSetting(params, "dilutedConcentrationMeasurementId"),
          );
          const factor = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "dilutionFactorCalculationId"),
          );
          if (!diluted || !factor || factor.unit !== "x" || diluted.value < 0 || factor.value <= 0) {
            throw new Error("A non-negative diluted concentration and positive dilution-factor calculation are required.");
          }
          if (!diluted.unit || diluted.unit === "x" || diluted.unit === "flag") {
            throw new Error("The diluted concentration must carry a concentration unit.");
          }
          derivedValue = diluted.value * factor.value;
          derivedUnit = diluted.unit;
          evidenceLabel = `${diluted.id} and ${factor.id}`;
        }
      } catch (error) {
        return fail(
          state,
          error instanceof Error ? error.message : "Required calculation evidence is incomplete.",
          "Complete and record every named operand before submitting this calculation.",
          nodeId,
        );
      }
      const nonOverridableDerivedTemplate = new Set([
        "classifyMeasurementAgainstBound",
        "dilutionFactorFromVolumes",
        "backCalculateConcentrationFromDilution",
      ]).has(template);
      const value = nonOverridableDerivedTemplate ? derivedValue : (action.value ?? derivedValue);
      const expected = derivedValue;
      const tolerance = Number(params.tolerance ?? 0.000001);
      const unit = derivedUnit;
      const passed = isWithinTolerance(value, expected, tolerance);
      const next = {
        ...state,
        calculations: [
          ...state.calculations.filter((calculation) => calculation.id !== calculationId),
          {
            id: calculationId,
            label: actionDefinition.label,
            value,
            unit,
            expected,
            tolerance,
            passed,
            regression,
            nodeId,
          },
        ],
      };
      return {
        ok: true,
        state: addNotebook(
          next,
          nodeId,
          actionDefinition.label,
          `${value} ${unit} from ${evidenceLabel}`,
          ["calculate", calculationId, "evidence-derived"],
          "calculation",
        ),
        message: actionDefinition.feedback.success,
      };
    }
    // Investigation 9's four composition and recovery steps carried no template, so each fell through
    // to `Number(action.value ?? params.expected ?? 0)`, computed 0, compared it against an expected 0
    // with the default 0.5 tolerance, and passed. They now derive from recorded masses through the
    // `componentMassPercent` and `totalPercentRecovery` templates below, whose gate is operand
    // completeness — the same discipline the gravimetric templates use.
    //
    // Shared action inputs now enforce `requireStudentValue` before this branch is reached. Templates
    // derive an evidence-backed comparison value; the submitted value is checked against that value
    // instead of silently substituting an authored answer key.
    // Gravimetric operands are named, not assumed. Every id below defaults to the one the original
    // demo content used, so existing labs are unaffected; a lab that analyses two samples names its
    // own ids instead of colliding on one global "sample-volume".
    const measurementNamed = (key: string, fallbackId: string) =>
      state.measurements.find(
        (measurement) => measurement.id === (stringSetting(params, key) ?? fallbackId),
      );
    const sampleVolumeMeasurement = measurementNamed("sampleVolumeMeasurementId", "sample-volume");
    const precipitateMassMeasurement = measurementNamed(
      "precipitateMassMeasurementId",
      "dry-precipitate-mass",
    );
    // The precipitate mass may itself be a derived quantity: Investigation 3 gets it by difference
    // from the cooled combined mass, so the hardness step consumes a calculation record, not a
    // balance reading.
    const precipitateMassCalculationId = stringSetting(params, "precipitateMassCalculationId");
    const precipitateMassCalculation = precipitateMassCalculationId
      ? state.calculations.find((calculation) => calculation.id === precipitateMassCalculationId)
      : undefined;
    const sampleVolumeMl = Number(sampleVolumeMeasurement?.value ?? params.sampleVolumeMl);
    const precipitateMassG = Number(
      precipitateMassCalculationId
        ? precipitateMassCalculation?.value
        : (precipitateMassMeasurement?.value ?? params.precipitateMassG),
    );
    const preconcentrationFactor = numberSetting(params, "preconcentrationFactor", 1);
    if (
      template === "hardnessMgLAsCaCO3" &&
      (!Number.isFinite(sampleVolumeMl) ||
        sampleVolumeMl <= 0 ||
        !Number.isFinite(precipitateMassG))
    ) {
      return fail(
        state,
        "Required measurement evidence is missing for the hardness calculation.",
        precipitateMassCalculationId
          ? "Record the sample volume and complete the precipitate-mass calculation before submitting the hardness calculation."
          : "Record both sample volume and dry precipitate mass before submitting the calculation.",
        nodeId,
      );
    }

    // Two templates Investigation 3 authored against had no implementation at all. Falling through
    // to `params.expected ?? 0` gave every one of them the value 0, compared it against an expected
    // value of 0, and passed. Both now derive from named evidence and fail when it is missing.
    const combinedMassMeasurement = measurementNamed("combinedMassMeasurementId", "combined-mass");
    const tareMeasurements = ["watchGlassMassMeasurementId", "filterPaperMassMeasurementId"]
      .filter((key) => stringSetting(params, key))
      .map((key) => measurementNamed(key, ""));
    if (template === "gravimetricPrecipitateMass") {
      if (!combinedMassMeasurement || tareMeasurements.length === 0 || tareMeasurements.some((tare) => !tare)) {
        return fail(
          state,
          "Required mass evidence is missing for the precipitate-mass calculation.",
          "Record the cooled combined mass and every tare it is measured against before calculating by difference.",
          nodeId,
        );
      }
    }
    const sodiumCarbonateMeasurement = measurementNamed("sodiumCarbonateMassMeasurementId", "");
    const calciumChlorideMeasurement = measurementNamed("calciumChlorideMassMeasurementId", "");
    if (
      template === "calciumCarbonateTheoreticalMass" &&
      (!sodiumCarbonateMeasurement || !calciumChlorideMeasurement)
    ) {
      return fail(
        state,
        "Required reactant mass evidence is missing for the theoretical-yield calculation.",
        "Record both weighed reactant masses before calculating the theoretical CaCO3 mass.",
        nodeId,
      );
    }
    const analyteVolumeMeasurement = state.measurements.find(
      (measurement) => measurement.id === String(params.analyteVolumeMeasurementId ?? "acid-aliquot-volume"),
    );
    const initialBuretteMeasurement = state.measurements.find(
      (measurement) => measurement.id === String(params.initialBuretteMeasurementId ?? "burette-initial-volume"),
    );
    const finalBuretteMeasurement = state.measurements.find(
      (measurement) => measurement.id === String(params.finalBuretteMeasurementId ?? "burette-final-volume"),
    );
    if (
      template === "acidBaseMolarity" &&
      (!analyteVolumeMeasurement || !initialBuretteMeasurement || !finalBuretteMeasurement)
    ) {
      return fail(
        state,
        "Required titration measurement evidence is missing.",
        "Record analyte volume plus initial and final burette readings before calculating molarity.",
        nodeId,
      );
    }
    /* --- Investigation 8 redox operands (Cycle 09). --------------------------------- *
     * Each of the three templates below had no implementation, so the reducer's final fallback
     * `Number(action.value ?? params.expected ?? 0)` reported the teacher's own accepted value as
     * the student's result and every comparison passed. The evidence is named, never assumed, and a
     * missing operand fails the step. */
    const standardAliquotMeasurement = measurementNamed("ironAliquotMeasurementId", "");
    const standardMolarityM = Number(
      params.standardMolarityM ?? params.ironMolarityM ?? Number.NaN,
    );
    if (template === "permanganateMolarityFromIron") {
      if (!standardAliquotMeasurement || !initialBuretteMeasurement || !finalBuretteMeasurement) {
        return fail(
          state,
          "Required standardization evidence is missing.",
          "Record the standard aliquot volume and both burette readings for this trial before calculating its titrant molarity.",
          nodeId,
        );
      }
      if (!Number.isFinite(standardMolarityM) || standardMolarityM <= 0) {
        return fail(
          state,
          "No standard concentration is configured for this standardization.",
          "The approved plan must state the primary-standard concentration this trial titrates against.",
          nodeId,
        );
      }
    }
    const standardizedTitrantCalculation = stringSetting(params, "permanganateCalculationId")
      ? state.calculations.find(
          (calculation) => calculation.id === stringSetting(params, "permanganateCalculationId"),
        )
      : undefined;
    const sampleAliquotMeasurement = measurementNamed("sampleAliquotMeasurementId", "");
    const sampleAliquotMl = Number(
      sampleAliquotMeasurement?.value ?? params.sampleAliquotMl ?? Number.NaN,
    );
    if (template === "hydrogenPeroxidePercent") {
      // Section 3 finding 4: all standardization is complete before any H2O2 analysis. Consuming the
      // standardization *calculation* rather than a configured molarity is what makes that gate real.
      if (!standardizedTitrantCalculation) {
        return fail(
          state,
          "The standardized titrant concentration is not available.",
          "Complete and accept the standardization average before analysing an assigned sample.",
          nodeId,
        );
      }
      if (!initialBuretteMeasurement || !finalBuretteMeasurement) {
        return fail(
          state,
          "Required titration evidence is missing for this sample trial.",
          "Record both burette readings for this trial before calculating percent by mass.",
          nodeId,
        );
      }
      if (!Number.isFinite(sampleAliquotMl) || sampleAliquotMl <= 0) {
        return fail(
          state,
          "No sample aliquot volume is available.",
          "Record the measured sample aliquot before calculating percent by mass.",
          nodeId,
        );
      }
    }
    const meanCalculationIds = Array.isArray(params.calculationIds)
      ? params.calculationIds.map((id) => String(id))
      : [];
    const meanSourceCalculations = meanCalculationIds.map((id) =>
      state.calculations.find((calculation) => calculation.id === id),
    );
    if (template === "meanOfCalculations") {
      if (meanCalculationIds.length === 0 || meanSourceCalculations.some((entry) => !entry)) {
        return fail(
          state,
          "Every trial this average names must be calculated first.",
          "Complete each replicate trial's own calculation before averaging them.",
          nodeId,
        );
      }
    }

    const photometricTransmittanceTemplate =
      template === "decimalTransmittance" || template === "absorbanceFromPercentT";
    const percentTransmittanceMeasurementId =
      stringSetting(params, "percentTransmittanceMeasurementId") ??
      (photometricTransmittanceTemplate ? stringSetting(params, "sourceMeasurementId") : undefined);
    const percentTransmittanceMeasurement = percentTransmittanceMeasurementId
      ? state.measurements.find((measurement) => measurement.id === percentTransmittanceMeasurementId)
      : undefined;
    const percentTransmittance = Number(
      percentTransmittanceMeasurement?.value ??
        params.percentTransmittance,
    );
    if (
      photometricTransmittanceTemplate &&
      (!percentTransmittanceMeasurement ||
        percentTransmittanceMeasurement.unit !== PHOTOMETRIC_UNITS.percentTransmittance ||
        !Number.isFinite(percentTransmittance) ||
        percentTransmittance <= 0 ||
        percentTransmittance > 100)
    ) {
      return fail(
        state,
        "Required transmittance evidence is missing or outside the instrument range.",
        "Record a percent transmittance value greater than 0 and at most 100 before submitting the calculation.",
        nodeId,
      );
    }
    // Cycle 06. `A = -log10(T)` is only that equation when T is a decimal transmittance.
    // `absorbanceFromPercentT` divides by 100 first; this template does not, so its operand is
    // read from a separate parameter and validated against the decimal range. Sharing one operand
    // between the two would let a %T reading reach the log directly and return a negative
    // absorbance that nothing would question.
    const decimalTransmittanceMeasurementId = stringSetting(
      params,
      "decimalTransmittanceMeasurementId",
    );
    const decimalTransmittance = Number(
      measurementValue(state, decimalTransmittanceMeasurementId) ??
        calculationValue(state, stringSetting(params, "decimalTransmittanceCalculationId")) ??
        params.decimalTransmittance,
    );
    if (
      template === "absorbanceFromDecimalT" &&
      (!Number.isFinite(decimalTransmittance) ||
        decimalTransmittance <= 0 ||
        decimalTransmittance > 1)
    ) {
      return fail(
        state,
        "Required decimal-transmittance evidence is missing or is not a decimal transmittance.",
        "Convert the percent transmittance to a decimal between 0 and 1 first; A = -log10(T) takes the decimal, never the percent.",
        nodeId,
      );
    }
    const stockConcentration = Number(
      measurementValue(state, stringSetting(params, "stockConcentrationMeasurementId")) ??
        params.stockConcentration,
    );
    const stockVolumeMl = Number(
      measurementValue(state, stringSetting(params, "stockVolumeMeasurementId")) ??
        params.stockVolumeMl,
    );
    const finalVolumeMl = Number(
      measurementValue(state, stringSetting(params, "finalVolumeMeasurementId")) ??
        params.finalVolumeMl,
    );
    if (
      (template === "dilutedConcentration" || template === "dilutedConcentrationMicromolar") &&
      (!Number.isFinite(stockConcentration) ||
        stockConcentration < 0 ||
        !Number.isFinite(stockVolumeMl) ||
        stockVolumeMl < 0 ||
        !Number.isFinite(finalVolumeMl) ||
        finalVolumeMl <= 0)
    ) {
      return fail(
        state,
        "Required dilution evidence is missing for the concentration calculation.",
        "Record the teacher-supplied stock concentration, then provide a non-negative stock volume and a final volume, before calculating the diluted concentration.",
        nodeId,
      );
    }
    if (template === "initialRateMlPerS") {
      const dataSeriesId = stringSetting(params, "dataSeriesId");
      const dataSeries = dataSeriesId
        ? state.dataSeries.find((series) => series.id === dataSeriesId)
        : state.dataSeries[state.dataSeries.length - 1];
      if (!dataSeries) {
        return fail(
          state,
          "Timed gas-volume evidence is missing for the initial-rate calculation.",
          "Record the gas syringe readings before calculating the initial rate.",
          nodeId,
        );
      }

      let value: number;
      try {
        value = calculateInitialRateMlPerS(dataSeries.points, numberSetting(params, "intervalS", 15));
      } catch (error) {
        return fail(
          state,
          error instanceof Error ? error.message : "Timed gas-volume evidence is invalid.",
          "Check that the data table includes 0 s and 15 s gas-volume readings.",
          nodeId,
        );
      }

      const expected = Number(params.expected ?? value);
      const tolerance = Number(params.tolerance ?? 0.01);
      const unit = String(params.unit ?? "mL/s");
      const passed = isWithinTolerance(value, expected, tolerance);
      const next = {
        ...state,
        calculations: [
          ...state.calculations.filter((calculation) => calculation.id !== calculationId),
          {
            id: calculationId,
            label: actionDefinition.label,
            value,
            unit,
            expected,
            tolerance,
            passed,
            nodeId,
          },
        ],
      };
      return {
        ok: true,
        state: addNotebook(
          next,
          nodeId,
          actionDefinition.label,
          `${value} ${unit} from ${dataSeries.label}`,
          ["calculate", calculationId, dataSeries.id],
          "calculation",
        ),
        message: actionDefinition.feedback.success,
      };
    }
    if (
      template === "linearRegressionMeasurements" ||
      template === "concentrationSeriesFromCalibration" ||
      template === "regressionFromCalculationSeries" ||
      template === "bestRegressionOrder" ||
      template === "rateConstantFromRegression"
    ) {
      let derivedValue: number;
      let regression: ReturnType<typeof calculateLinearRegression> | undefined;
      let series: DataSeriesPoint[] | undefined;
      let evidenceLabel = "recorded evidence";
      try {
        if (template === "linearRegressionMeasurements") {
          const measurementIds = stringArraySetting(params, "sourceMeasurements");
          const xValues = stringArraySetting(params, "sourceValues").map(Number);
          if (measurementIds.length < 2 || measurementIds.length !== xValues.length) {
            throw new Error("Regression configuration must pair each source measurement with one x value.");
          }
          series = measurementIds.map((measurementId, index) => {
            const measurement = state.measurements.find((entry) => entry.id === measurementId);
            if (!measurement || !Number.isFinite(xValues[index])) {
              throw new Error("Every configured regression pair must have recorded measurement evidence.");
            }
            return { x: xValues[index], y: measurement.value };
          });
          regression = calculateLinearRegression(series);
          derivedValue = regression.slope;
          evidenceLabel = `${regression.pointCount} recorded calibration pairs`;
        } else if (template === "concentrationSeriesFromCalibration") {
          const measurementIds = stringArraySetting(params, "sourceMeasurements");
          const timeMeasurementIds = stringArraySetting(params, "timeMeasurements");
          if (measurementIds.length < 2 || measurementIds.length !== timeMeasurementIds.length) {
            throw new Error("Each absorbance record must have a matching recorded time.");
          }
          const absorbanceSeries = measurementIds.map((measurementId, index) => {
            const absorbance = state.measurements.find((entry) => entry.id === measurementId);
            const time = state.measurements.find((entry) => entry.id === timeMeasurementIds[index]);
            if (!absorbance || !time) {
              throw new Error("Every kinetic pair must contain both recorded time and absorbance.");
            }
            return { x: time.value, y: absorbance.value };
          });
          const calibration = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "calibrationCalculationId"),
          );
          if (!calibration?.regression) {
            throw new Error("The recorded calibration regression is required before concentration conversion.");
          }
          series = calculateConcentrationSeries(absorbanceSeries, calibration.regression);
          derivedValue = series[0].y;
          evidenceLabel = `${series.length} time-absorbance pairs and ${calibration.id}`;
        } else if (template === "regressionFromCalculationSeries") {
          const source = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "sourceCalculationId"),
          );
          if (!source?.series) throw new Error("The concentration series is not available for regression.");
          const transform = stringSetting(params, "transformTemplate");
          if (transform !== "identity" && transform !== "ln" && transform !== "reciprocal") {
            throw new Error("The regression transform must be identity, ln, or reciprocal.");
          }
          series = transformRegressionSeries(source.series, transform);
          regression = calculateLinearRegression(series);
          derivedValue = regression.rSquared;
          evidenceLabel = `${source.id} using the ${transform} transform`;
        } else if (template === "bestRegressionOrder") {
          const calculationIds = stringArraySetting(params, "sourceCalculationIds");
          const orders = stringArraySetting(params, "sourceOrders").map(Number);
          if (calculationIds.length !== orders.length || calculationIds.length < 2) {
            throw new Error("Order selection must name matching regression records and order values.");
          }
          const candidates = calculationIds.map((id, index) => {
            const calculation = state.calculations.find((entry) => entry.id === id);
            if (!calculation?.regression || !Number.isFinite(orders[index])) {
              throw new Error("Every candidate order requires a completed regression record.");
            }
            return { calculation, order: orders[index] };
          });
          const best = candidates.reduce((current, candidate) =>
            candidate.calculation.regression!.rSquared > current.calculation.regression!.rSquared
              ? candidate
              : current,
          );
          derivedValue = best.order;
          evidenceLabel = `${best.calculation.id} with R-squared ${best.calculation.regression!.rSquared}`;
        } else {
          const source = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "sourceRegressionCalculationId"),
          );
          const order = state.calculations.find(
            (entry) => entry.id === stringSetting(params, "orderCalculationId"),
          );
          if (!source?.regression || !order) {
            throw new Error("The selected order and its regression are required before calculating k*.");
          }
          if (order.value !== 1) {
            throw new Error("This k* rule is configured for the first-order integrated plot only.");
          }
          derivedValue = -source.regression.slope;
          if (!Number.isFinite(derivedValue) || derivedValue <= 0) {
            throw new Error("The first-order regression must have a negative finite slope for positive k*.");
          }
          evidenceLabel = `${source.id} slope ${source.regression.slope}`;
        }
      } catch (error) {
        return fail(
          state,
          error instanceof Error ? error.message : "Regression evidence is incomplete.",
          "Complete and record every named data pair before submitting this calculation.",
          nodeId,
        );
      }

      const value = action.value ?? derivedValue;
      const expected = derivedValue;
      const tolerance = Number(params.tolerance ?? 0.000001);
      const passed = isWithinTolerance(value, expected, tolerance);
      const unit = String(params.unit ?? "");
      const next = {
        ...state,
        calculations: [
          ...state.calculations.filter((calculation) => calculation.id !== calculationId),
          {
            id: calculationId,
            label: actionDefinition.label,
            value,
            unit,
            expected,
            tolerance,
            passed,
            regression,
            series,
            nodeId,
          },
        ],
      };
      return {
        ok: true,
        state: addNotebook(
          next,
          nodeId,
          actionDefinition.label,
          `${value} ${unit} from ${evidenceLabel}`,
          ["calculate", calculationId, "evidence-derived"],
          "calculation",
        ),
        message: actionDefinition.feedback.success,
      };
    }
    if (template === "carbonateMassLossComposition") {
      const initialMassMeasurementId = String(params.initialMassMeasurementId ?? "crucible-initial-mass");
      const finalMassMeasurementId = String(params.finalMassMeasurementId ?? "crucible-final-mass");
      const initialMassMeasurement = state.measurements.find((measurement) => measurement.id === initialMassMeasurementId);
      const finalMassMeasurement = state.measurements.find((measurement) => measurement.id === finalMassMeasurementId);
      const sampleMassG = Number(
        measurementValue(state, stringSetting(params, "sampleMassMeasurementId")) ??
          params.sampleMassG,
      );
      if (!initialMassMeasurement || !finalMassMeasurement || !Number.isFinite(sampleMassG) || sampleMassG <= 0) {
        return fail(
          state,
          "Required mass evidence is missing for the carbonate composition calculation.",
          "Record the initial crucible mass, final crucible mass, and configured sample mass before calculating composition.",
          nodeId,
        );
      }
      if (finalMassMeasurement.value >= initialMassMeasurement.value) {
        return fail(
          state,
          "The final mass must be lower than the initial mass.",
          "Recheck the heated residue mass before calculating mass loss.",
          nodeId,
        );
      }
      let composition: ReturnType<typeof calculateCarbonateMassLossComposition>;
      try {
        composition = calculateCarbonateMassLossComposition(
          initialMassMeasurement.value,
          finalMassMeasurement.value,
          sampleMassG,
        );
      } catch (error) {
        return fail(
          state,
          error instanceof Error ? error.message : "Mass evidence is invalid for carbonate composition.",
          "Check the recorded masses and configured sample mass before calculating composition.",
          nodeId,
        );
      }
      const expected = Number(params.expected ?? composition.massLossG);
      const tolerance = Number(params.tolerance ?? 0.005);
      const passed = isWithinTolerance(composition.massLossG, expected, tolerance);
      const extraCalculations = [
        {
          id: `${calculationId}-nahco3-mass`,
          label: "Sodium bicarbonate mass",
          value: composition.sodiumBicarbonateMassG,
          unit: "g",
        },
        {
          id: `${calculationId}-na2co3-mass`,
          label: "Initial sodium carbonate mass",
          value: composition.sodiumCarbonateInitialMassG,
          unit: "g",
        },
        {
          id: `${calculationId}-nahco3-percent`,
          label: "Sodium bicarbonate percent",
          value: composition.sodiumBicarbonatePercent,
          unit: "%",
        },
        {
          id: `${calculationId}-na2co3-percent`,
          label: "Sodium carbonate percent",
          value: composition.sodiumCarbonatePercent,
          unit: "%",
        },
      ];
      const allCalculationIds = new Set([calculationId, ...extraCalculations.map((calculation) => calculation.id)]);
      const next = {
        ...state,
        calculations: [
          ...state.calculations.filter((calculation) => !allCalculationIds.has(calculation.id)),
          {
            id: calculationId,
            label: actionDefinition.label,
            value: composition.massLossG,
            unit: "g",
            expected,
            tolerance,
            passed,
            nodeId,
          },
          ...extraCalculations.map((calculation) => ({
            ...calculation,
            expected: calculation.value,
            tolerance: 0,
            passed: true,
            nodeId,
          })),
        ],
      };
      return {
        ok: true,
        state: addNotebook(
          next,
          nodeId,
          actionDefinition.label,
          `${composition.massLossG} g mass loss; ${composition.sodiumBicarbonatePercent}% NaHCO3 and ${composition.sodiumCarbonatePercent}% Na2CO3.`,
          ["calculate", calculationId],
          "calculation",
        ),
        message: actionDefinition.feedback.success,
      };
    }
    if (template === "chromatographyRf") {
      const model = chromatographyModelFor(definition, stringSetting(params, "chromatographyModelId"));
      const measurementPrefix = stringSetting(params, "measurementPrefix");
      const bandIds = Array.isArray(params.bandIds)
        ? params.bandIds
        : stringSetting(params, "bandId")
          ? [stringSetting(params, "bandId")!]
          : model?.bands.map((band) => band.id) ?? [];
      if (!model || bandIds.length === 0) {
        return fail(
          state,
          "No chromatography band model is available for the Rf calculation.",
          "Develop the chromatogram or configure band ids before calculating Rf.",
          nodeId,
        );
      }
      const solventFrontMeasurementId =
        stringSetting(params, "solventFrontMeasurementId") ??
        prefixedChromatographyMeasurementId(measurementPrefix, "solvent-front");
      // Rf = distance travelled by the molecule / distance travelled by the solvent (TR-17, M), and
      // both distances are the student's ruler readings. Falling back to the model's own numbers made
      // the answer key its own evidence, so content that declares `requireRecordedMeasurements`
      // computes from recorded distances only.
      const requireRecordedMeasurements = booleanSetting(params, "requireRecordedMeasurements");
      const recordedSolventFrontMm = measurementValue(state, solventFrontMeasurementId);
      const solventFrontMm = Number(
        requireRecordedMeasurements
          ? recordedSolventFrontMm
          : (recordedSolventFrontMm ?? model.solventFrontMm),
      );
      if (!Number.isFinite(solventFrontMm) || solventFrontMm <= 0) {
        return fail(
          state,
          "Required solvent-front distance is missing for the Rf calculation.",
          "Record the solvent-front distance before calculating Rf.",
          nodeId,
        );
      }
      const tolerance = Number(params.tolerance ?? 0.005);
      const calculations = bandIds.map((bandId) => {
        const band = model.bands.find((candidate) => candidate.id === bandId);
        const measurementId = prefixedChromatographyMeasurementId(measurementPrefix, "band", bandId);
        const recordedBandDistanceMm = measurementValue(state, measurementId);
        const bandDistanceMm = Number(
          requireRecordedMeasurements
            ? recordedBandDistanceMm
            : (recordedBandDistanceMm ?? band?.distanceMm),
        );
        if (!band || !Number.isFinite(bandDistanceMm)) return undefined;
        if (bandDistanceMm < 0 || bandDistanceMm > solventFrontMm) return undefined;
        const value = calculateChromatographyRf(bandDistanceMm, solventFrontMm);
        const expected = Number((params[`expected_${bandId}`] as number | undefined) ?? band.expectedRf);
        return {
          id: `${calculationId}-${bandId}`,
          label: `${band.label} Rf`,
          value,
          unit: "Rf",
          expected,
          tolerance,
          passed: isWithinTolerance(value, expected, tolerance),
          nodeId,
        };
      });
      if (calculations.some((calculation) => calculation === undefined)) {
        return fail(
          state,
          "Required band distance evidence is missing or invalid for the Rf calculation.",
          "Record each band distance and verify no band traveled farther than the solvent front.",
          nodeId,
        );
      }
      const resolvedCalculations = calculations.filter((calculation): calculation is NonNullable<typeof calculation> =>
        Boolean(calculation),
      );
      const calculationIds = new Set(resolvedCalculations.map((calculation) => calculation.id));
      const summary = resolvedCalculations
        .map((calculation) => `${calculation.label} ${calculation.value}`)
        .join("; ");
      const next = {
        ...state,
        calculations: [
          ...state.calculations.filter((calculation) => !calculationIds.has(calculation.id)),
          ...resolvedCalculations,
        ],
      };
      return {
        ok: true,
        state: addNotebook(next, nodeId, actionDefinition.label, summary, ["calculate", calculationId], "calculation"),
        message: actionDefinition.feedback.success,
      };
    }
    // Investigation 9's Data Collection sentence describes total percent recovery while asking for
    // per-component composition (finding 3.7, confirmation point 1). Neither reading is chosen here:
    // the two are separate templates, and each refuses to run until the content states which
    // convention the instructor confirmed. Both derive from recorded masses, so their gate is operand
    // completeness rather than a stored answer key; a value supplied by an input path wins over the
    // derivation and is then checked against it.
    let derivedExpected: number | undefined;
    if (template === "componentMassPercent" || template === "totalPercentRecovery") {
      const confirmation = stringSetting(params, "compositionFormulaConfirmation");
      if (confirmation !== "component-mass-over-starting-mass") {
        return fail(
          state,
          "The percent-composition formula for this investigation has not been confirmed.",
          "The source sentence describes total recovery while asking for composition. Record the confirmed convention (component mass / starting mass x 100) before submitting either figure.",
          nodeId,
        );
      }
      const startingMassG = Number(
        measurementValue(state, stringSetting(params, "startingMassMeasurementId")),
      );
      const componentMassIds =
        template === "componentMassPercent"
          ? [stringSetting(params, "componentMassMeasurementId")].filter(
              (id): id is string => Boolean(id),
            )
          : stringArraySetting(params, "recoveredMassMeasurementIds");
      const componentMassesG = componentMassIds.map((id) => measurementValue(state, id));
      if (
        !Number.isFinite(startingMassG) ||
        componentMassIds.length === 0 ||
        componentMassesG.some((massG) => massG === undefined)
      ) {
        return fail(
          state,
          "Required recovered-mass evidence is missing for this composition calculation.",
          "Weigh and record the starting sample and every dried recovered fraction this figure names before submitting it.",
          nodeId,
        );
      }
      try {
        derivedExpected =
          template === "componentMassPercent"
            ? calculateComponentMassPercent(Number(componentMassesG[0]), startingMassG)
            : calculateTotalPercentRecovery(
                componentMassesG.map((massG) => Number(massG)),
                startingMassG,
              );
      } catch (error) {
        return fail(
          state,
          error instanceof Error ? error.message : "The composition calculation could not be evaluated.",
          "Recheck the recorded starting mass and recovered fraction masses.",
          nodeId,
        );
      }
    }
    // A template may reject its own operands after the presence checks pass — the redox average
    // rejects a replicate spread wider than the configured acceptable range, which is ordinary play,
    // not a crash. Every template throws on bad input, so the whole expression is evaluated inside
    // one guard rather than letting the exception escape the reducer.
    let computedValue: number;
    try {
      computedValue =
      template === "hardnessMgLAsCaCO3"
        ? calculateHardnessMgLAsCaCO3(precipitateMassG, sampleVolumeMl, preconcentrationFactor)
        : template === "gravimetricPrecipitateMass"
        ? calculateGravimetricPrecipitateMassG(
            Number(combinedMassMeasurement?.value),
            tareMeasurements.map((tare) => Number(tare?.value)),
          )
        : template === "calciumCarbonateTheoreticalMass"
        ? calculateCalciumCarbonateTheoreticalMassG(
            Number(sodiumCarbonateMeasurement?.value),
            Number(calciumChlorideMeasurement?.value),
          )
        : template === "permanganateMolarityFromIron"
        ? calculatePermanganateMolarityFromIron(
            standardMolarityM,
            Number(standardAliquotMeasurement?.value),
            Number(initialBuretteMeasurement?.value),
            Number(finalBuretteMeasurement?.value),
            {
              analyte: Number(params.stoichiometricRatioAnalyte ?? 5),
              titrant: Number(params.stoichiometricRatioTitrant ?? 1),
            },
          )
        : template === "hydrogenPeroxidePercent"
        ? calculateHydrogenPeroxidePercent(
            Number(standardizedTitrantCalculation?.value),
            Number(initialBuretteMeasurement?.value),
            Number(finalBuretteMeasurement?.value),
            sampleAliquotMl,
            numberSetting(params, "densityGPerMl", WATER_DENSITY_G_PER_ML),
            {
              analyte: Number(params.stoichiometricRatioAnalyte ?? 5),
              titrant: Number(params.stoichiometricRatioTitrant ?? 2),
            },
            numberSetting(params, "analyteMolarMassGPerMol", HYDROGEN_PEROXIDE_MOLAR_MASS_G_MOL),
          )
        : template === "meanOfCalculations"
        ? calculateMeanOfValues(
            meanSourceCalculations.map((entry) => Number(params.evidenceDerivedMean === true ? entry?.expected ?? entry?.value : entry?.value)),
            { maximumRange: numberSetting(params, "maximumRangeM", Number.POSITIVE_INFINITY) },
          )
        : template === "acidBaseMolarity"
          ? calculateAcidBaseMolarity(
              Number(params.titrantMolarity ?? 0.1),
              Number(initialBuretteMeasurement?.value ?? 0),
              Number(finalBuretteMeasurement?.value ?? 0),
              Number(analyteVolumeMeasurement?.value ?? params.analyteVolumeMl ?? 0),
              {
                analyte: Number(params.stoichiometricRatioAnalyte ?? 1),
                titrant: Number(params.stoichiometricRatioTitrant ?? 1),
              },
            )
          : template === "dilutedConcentration"
            ? calculateDilutedConcentration(stockConcentration, stockVolumeMl, finalVolumeMl)
            : template === "dilutedConcentrationMicromolar"
              ? calculateDilutedConcentrationMicromolar(
                  stockConcentration,
                  stockVolumeMl,
                  finalVolumeMl,
                )
              : template === "decimalTransmittance"
                ? calculateDecimalTransmittance(percentTransmittance)
                : template === "absorbanceFromPercentT"
                  ? calculateAbsorbanceFromPercentT(percentTransmittance)
                  : template === "absorbanceFromDecimalT"
                    ? calculateAbsorbanceFromDecimalT(decimalTransmittance)
                    // The two composition templates derive their own value from the recorded masses,
                    // so they never reach the `?? 0` fallback that made Investigation 9's four
                    // calculations pass on nothing. A value supplied by an input path still wins and
                    // is checked against the derivation.
                    : derivedExpected !== undefined
                      ? derivedExpected
                      : Number(action.value ?? params.expected ?? 0);
    } catch (error) {
      return fail(
        state,
        error instanceof Error ? error.message : "The calculation could not be evaluated.",
        "Recheck the recorded evidence this calculation names, then submit it again.",
        nodeId,
      );
    }
    const value = template || derivedExpected !== undefined
      ? Number(action.value ?? computedValue)
      : computedValue;
    const expected = Number(template ? computedValue : (params.expected ?? derivedExpected ?? value));
    const tolerance = Number(params.tolerance ?? 0.5);
    const passed = isWithinTolerance(value, expected, tolerance);
    const unit =
      template === "componentMassPercent" || template === "totalPercentRecovery"
        ? String(params.unit ?? "%")
        : template === "hydrogenPeroxidePercent"
        ? String(params.unit ?? "% H2O2 by mass")
        : template === "permanganateMolarityFromIron"
        ? String(params.unit ?? "M")
        : template === "acidBaseMolarity"
        ? "M"
        : template === "hardnessMgLAsCaCO3"
          ? "mg/L as CaCO3"
          // Cycle 06. The three photometric quantities and the micromolar concentration fix their
          // own unit for the same reason hardness does: an authored unit that disagrees with the
          // template is a mislabelled number, and %T, T, and absorbance are exactly the three that
          // look interchangeable in a table.
          : template === "decimalTransmittance"
            ? PHOTOMETRIC_UNITS.decimalTransmittance
            : template === "absorbanceFromPercentT" || template === "absorbanceFromDecimalT"
              ? PHOTOMETRIC_UNITS.absorbance
              : template === "dilutedConcentrationMicromolar"
                ? "uM"
                : String(params.unit ?? "");
    const next = {
      ...state,
      calculations: [
        ...state.calculations.filter((calculation) => calculation.id !== calculationId),
        {
          id: calculationId,
          label: actionDefinition.label,
          value,
          unit,
          expected,
          tolerance,
          passed,
          nodeId,
        },
      ],
    };
    return {
      ok: true,
      state: addNotebook(next, nodeId, actionDefinition.label, `${value} ${unit}`, ["calculate", calculationId], "calculation"),
      message: actionDefinition.feedback.success,
    };
  }

  return fail(state, "Unsupported action.", "Choose a supported v1 chemistry action.", nodeId);
};

const calculationSatisfiesEdge = (
  state: RuntimeState,
  edge: ProcessEdge,
): boolean => {
  const calculation = state.calculations.find(
    (record) => record.id === edge.condition.calculationId,
  );
  if (!calculation) return false;
  if (calculation.passed !== true) return false;
  const min = edge.condition.min ?? Number.NEGATIVE_INFINITY;
  const max = edge.condition.max ?? Number.POSITIVE_INFINITY;
  return calculation.value >= min && calculation.value <= max;
};

const nextNodeId = (
  currentNodeId: string,
  edges: ProcessEdge[],
  state: RuntimeState,
  passed: boolean,
): string | undefined => {
  const outgoing = edges.filter((edge) => edge.from === currentNodeId);
  if (!passed) {
    return outgoing.find((edge) => edge.condition.type === "retry")?.to;
  }

  const calculationEdge = outgoing.find(
    (edge) => edge.condition.type === "calculationResult" && calculationSatisfiesEdge(state, edge),
  );
  if (calculationEdge) return calculationEdge.to;

  return outgoing.find((edge) => edge.condition.type === "validationPassed" || edge.condition.type === "always")?.to;
};

/**
 * Scope attribution for a newly recorded attempt. It names the scope the action was requested in
 * — the same state an action's prerequisites are evaluated against — so an opt-in current-scope
 * rule and the records it reads agree by construction. Both fields are optional on the record, so
 * histories written before this existed still load; they simply never match a qualified rule.
 */
const attemptScope = (
  state: RuntimeState,
): Pick<AttemptRecord, "evidenceScopeId" | "evidenceScopeGeneration"> => ({
  evidenceScopeId: state.evidenceScopeId,
  evidenceScopeGeneration: currentEvidenceScopeGeneration(state),
});

export const performRuntimeAction = (
  definition: RuntimeDefinition,
  state: RuntimeState,
  request: RuntimeActionRequest,
): RuntimeState => {
  if (request.verb === "reset") {
    if (request.parameters?.scope === "physical") {
      const fresh = createRuntimeState(definition, state.mode);
      const nextScope =
        typeof request.parameters.nextScopeId === "string" && request.parameters.nextScopeId.trim()
          ? request.parameters.nextScopeId
          : `scope-${state.attemptHistory.length + 2}`;
      return {
        // Every field this spread does not re-add comes from the fresh runtime. That is how the
        // solid-stock initialization lifecycle is cleared: `fresh.solidStockInitializations` is
        // empty and is deliberately absent from the carry-over list below, so a full physical
        // reset restores the authored containers and permits exactly one new initialization of
        // each. Do not add it to the carry-over list — the retained configuration measurements
        // below must not be what re-locks a source.
        ...fresh,
        currentNodeId:
          typeof request.parameters.resumeNodeId === "string"
            ? request.parameters.resumeNodeId
            : fresh.currentNodeId,
        evidenceScopeId: nextScope,
        evidenceScopeGeneration: currentEvidenceScopeGeneration(state) + 1,
        photometerCalibration: {},
        photometerCalibrationEpoch: (state.photometerCalibrationEpoch ?? 1) + 1,
        measurements: state.measurements,
        dataSeries: state.dataSeries,
        temperatureEvidence: state.temperatureEvidence,
        calculations: state.calculations,
        repeatProgress: state.repeatProgress,
        notebook: state.notebook,
        completedNodes: state.completedNodes,
        validationEvidence: state.validationEvidence,
        attemptHistory: state.attemptHistory,
        feedbackQueue: [
          ...state.feedbackQueue,
          feedback(
            "success",
            "Physical equipment reset; accepted evidence from earlier trials was preserved.",
          ),
        ],
      };
    }
    return createRuntimeState(definition, state.mode);
  }

  const activeState = withResolvedAttachments(state);

  if (request.verb === "place" && request.parameters?.benchMove === true) {
    const equipment = findBenchMoveInstance(activeState, request.sourceInstanceId, request.equipmentDefinitionId);
    if (!equipment) {
      return {
        ...activeState,
        feedbackQueue: [
          ...activeState.feedbackQueue,
          feedback("error", "Equipment to move was not found.", undefined, "Select an item already on the bench."),
        ],
      };
    }
    // A free bench move detaches the item from whatever holds it, so it is another way out of a
    // sealed chamber and is refused the same way. Without this the closure would be a process-only
    // prerequisite that a drag on the bench could walk straight past.
    if (request.location !== "snapZone") {
      const holdingParentId = attachmentsForChild(activeState, equipment.id)[0]?.parentInstanceId;
      const holdingParent = holdingParentId
        ? activeState.equipmentInstances.find((instance) => instance.id === holdingParentId)
        : undefined;
      const closedHolder = holdingParent ? closedChamberAccessRefusal(holdingParent) : undefined;
      if (closedHolder) {
        return {
          ...activeState,
          feedbackQueue: [
            ...activeState.feedbackQueue,
            feedback("error", closedHolder.message, undefined, closedHolder.recovery),
          ],
        };
      }
    }
    const moved = updateInstance(activeState, equipment.id, (instance) => ({
      ...instance,
      location: request.location ?? "workbench",
      x: numericParameter(request.parameters, "x") ?? instance.x,
      y: numericParameter(request.parameters, "y") ?? instance.y,
      zIndex: numericParameter(request.parameters, "zIndex") ?? instance.zIndex,
      interactionStatus: request.location === "snapZone" ? "snapped" : "free",
      snapZoneId:
        request.location === "snapZone" && typeof request.parameters?.snapZoneId === "string"
          ? request.parameters.snapZoneId
          : request.location === "snapZone"
            ? instance.snapZoneId
            : undefined,
    }));
    const movedInstance = moved.equipmentInstances.find((instance) => instance.id === equipment.id) ?? equipment;
    const withMovedChildren = moveLockedChildren(moved, equipment, movedInstance);
    return request.location === "snapZone" ? withMovedChildren : detachChild(withMovedChildren, equipment.id);
  }

  const process = getProcess(definition);
  const currentNode = process.nodes.find((node) => node.id === activeState.currentNodeId);
  if (!currentNode) {
    return {
      ...activeState,
      feedbackQueue: [...activeState.feedbackQueue, feedback("error", "Current process node is missing.")],
    };
  }

  if (activeState.completedNodes.includes(currentNode.id)) {
    return {
      ...activeState,
      feedbackQueue: [
        ...activeState.feedbackQueue,
        feedback(
          "info",
          "The current step is already complete.",
          currentNode.id,
          "Reset the lab if you need to repeat the workflow.",
        ),
      ],
    };
  }

  const actions = getActions(definition);
  const actionDefinition =
    actions.find((candidate) => candidate.id === request.actionId) ??
    actions.find((candidate) => candidate.id === currentNode.actionId) ??
    actions.find((candidate) => candidate.verb === request.verb);

  if (!actionDefinition) {
    return fail(
      activeState,
      "No action definition matches the requested simulator verb.",
      "Use one of the configured actions for this lab or technique.",
      currentNode.id,
    ).state;
  }

  if (currentNode.actionId && actionDefinition.id !== currentNode.actionId) {
    const failedAttempt = {
      ...activeState,
      attemptHistory: [
        ...activeState.attemptHistory,
        {
          id: `${currentNode.id}-${actionDefinition.id}-${activeState.attemptHistory.length + 1}`,
          timestamp: timestamp(),
          nodeId: currentNode.id,
          actionId: actionDefinition.id,
          verb: actionDefinition.verb,
          mode: activeState.mode,
          ...attemptScope(activeState),
          success: false,
          message: "Wrong order.",
        },
      ],
    };
    return fail(
      failedAttempt,
      "That action is not expected at this point in the process.",
      currentNode.feedback.retry,
      currentNode.id,
    ).state;
  }

  const normalizedRequest = {
    ...request,
    actionId: actionDefinition.id,
    verb: actionDefinition.verb,
  };

  const configurationLock = configurationLockFor(
    actionDefinition,
    normalizedRequest.parameters?.configurationApproved === true,
  );
  if (configurationLock) {
    const failedAttempt = {
      ...activeState,
      attemptHistory: [
        ...activeState.attemptHistory,
        {
          id: `${currentNode.id}-${actionDefinition.id}-${activeState.attemptHistory.length + 1}`,
          timestamp: timestamp(),
          nodeId: currentNode.id,
          actionId: actionDefinition.id,
          verb: actionDefinition.verb,
          mode: activeState.mode,
          ...attemptScope(activeState),
          success: false,
          message: "Teacher configuration required.",
        },
      ],
    };
    return fail(
      failedAttempt,
      configurationLock.message,
      configurationLock.recovery,
      currentNode.id,
    ).state;
  }

  const inputError = actionInputRequestError(actionDefinition, normalizedRequest);
  if (inputError) {
    const failedAttempt = {
      ...activeState,
      attemptHistory: [
        ...activeState.attemptHistory,
        {
          id: `${currentNode.id}-${actionDefinition.id}-${activeState.attemptHistory.length + 1}`,
          timestamp: timestamp(),
          nodeId: currentNode.id,
          actionId: actionDefinition.id,
          verb: actionDefinition.verb,
          mode: activeState.mode,
          ...attemptScope(activeState),
          success: false,
          message: "Required action input missing.",
        },
      ],
    };
    return fail(
      failedAttempt,
      inputError,
      "Enter the requested classroom configuration or student response, then try again.",
      currentNode.id,
    ).state;
  }

  const repeatGroupId = stringSetting(actionDefinition.parameters, "repeatGroupId");
  const repeatIteration = numberSetting(actionDefinition.parameters, "repeatIteration", Number.NaN);
  const repeatExpected = numberSetting(actionDefinition.parameters, "repeatCount", Number.NaN);
  if (repeatGroupId && Number.isInteger(repeatIteration) && Number.isInteger(repeatExpected)) {
    const progress = activeState.repeatProgress[repeatGroupId];
    const nextIteration = progress
      ? Math.min(...Array.from({ length: repeatExpected }, (_, index) => index + 1)
          .filter((iteration) => !progress.completedIterations.includes(iteration)), repeatExpected + 1)
      : 1;
    if (repeatIteration > nextIteration) {
      return fail(
        activeState,
        `Repeat ${repeatGroupId} is out of order: iteration ${nextIteration} must be completed first.`,
        "Return to the next incomplete repeat and preserve its sample or trial identity.",
        currentNode.id,
      ).state;
    }
  }

  const runtimeRepeat = actionDefinition.runtimeRepeat;
  let runtimeRepeatIteration: number | undefined;
  let runtimeRepeatExpected: number | undefined;
  let runtimeRepeatOutputMeasurementId: string | undefined;
  let executableActionDefinition = actionDefinition;
  if (runtimeRepeat) {
    const count = activeState.measurements.find((entry) => entry.id === runtimeRepeat.countMeasurementId);
    if (!count || !["count", "integer"].includes(count.unit) || !Number.isInteger(count.value) || count.value <= 0) {
      return fail(activeState, "The runtime repeat count is missing, lacks a count unit, or is not a positive integer.", "Record the teacher-configured repeat count before acquisition.", currentNode.id).state;
    }
    const prior = activeState.repeatProgress[runtimeRepeat.progressId];
    if (prior && prior.expectedIterations !== count.value) {
      return fail(activeState, "The runtime repeat count changed after acquisition began.", "Reset before using a different configured repeat count.", currentNode.id).state;
    }
    runtimeRepeatExpected = count.value;
    runtimeRepeatIteration = (prior?.completedIterations.length ?? 0) + 1;
    if (runtimeRepeatIteration > runtimeRepeatExpected) {
      return fail(activeState, "The configured acquisition repeat is already complete.", "Continue to the next process step.", currentNode.id).state;
    }
    const outputMeasurementId = `${runtimeRepeat.outputMeasurementId}--${runtimeRepeatIteration}`;
    if (activeState.measurements.some((entry) => entry.id === outputMeasurementId)) {
      return fail(activeState, `Repeat output "${outputMeasurementId}" already exists.`, "Reset the repeat or preserve a fresh output namespace.", currentNode.id).state;
    }
    executableActionDefinition = {
      ...actionDefinition,
      parameters: { ...actionDefinition.parameters, measurementId: outputMeasurementId },
    };
    runtimeRepeatOutputMeasurementId = outputMeasurementId;
  }

  const unmetPrerequisite = actionDefinition.prerequisites
    .map((rule) => evaluateRule(rule, activeState, normalizedRequest, currentNode))
    .find((evidence) => !evidence.passed);

  if (unmetPrerequisite) {
    const failedAttempt = {
      ...activeState,
      attemptHistory: [
        ...activeState.attemptHistory,
        {
          id: `${currentNode.id}-${actionDefinition.id}-${activeState.attemptHistory.length + 1}`,
          timestamp: timestamp(),
          nodeId: currentNode.id,
          actionId: actionDefinition.id,
          verb: actionDefinition.verb,
          mode: activeState.mode,
          ...attemptScope(activeState),
          success: false,
          message: "Prerequisite missing.",
        },
      ],
    };
    return fail(
      failedAttempt,
      unmetPrerequisite.message,
      actionDefinition.feedback.invalid,
      currentNode.id,
    ).state;
  }

  const executableRequest = runtimeRepeatOutputMeasurementId
    ? { ...normalizedRequest, parameters: { ...(normalizedRequest.parameters ?? {}), measurementId: runtimeRepeatOutputMeasurementId } }
    : normalizedRequest;
  const transactionalTypedAction = Boolean(
    actionDefinition.volume || actionDefinition.mass || actionDefinition.solidTransfer || actionDefinition.analysis || actionDefinition.runtimeRepeat ||
    actionDefinition.sourceInventory || actionDefinition.materialTransition || actionDefinition.deliveryDevice ||
    actionDefinition.choiceObservation || actionDefinition.extractionOperation || actionDefinition.extractionObservation || actionDefinition.extractionDrain,
  );
  let result = executeAction(definition, activeState, executableRequest, executableActionDefinition, currentNode.id);
  if (result.ok && runtimeRepeat && runtimeRepeatOutputMeasurementId) {
    const produced = result.state.measurements.find((entry) => entry.id === runtimeRepeatOutputMeasurementId);
    if (!produced) {
      result = fail(result.state, "The repeated acquisition did not produce its declared measurement.", "Retry the configured acquisition action.", currentNode.id);
    } else {
      result = {
        ...result,
        state: {
          ...result.state,
          measurements: [
            ...result.state.measurements.filter((entry) => entry.id !== runtimeRepeat.outputMeasurementId),
            { ...produced, id: runtimeRepeat.outputMeasurementId },
          ],
        },
      };
    }
  }
  const visualProxyInstanceId = stringSetting(actionDefinition.parameters, "visualProxyInstanceId");
  const visualProxyVisualState = stringSetting(actionDefinition.parameters, "visualProxyVisualState");
  if (result.ok && visualProxyInstanceId && visualProxyVisualState) {
    const visualProxy = result.state.equipmentInstances.find(
      (instance) => instance.id === visualProxyInstanceId,
    );
    if (!visualProxy) {
      result = fail(
        result.state,
        "The configured apparatus visual proxy is unavailable.",
        "Reset the activity so the assembled apparatus can be restored.",
        currentNode.id,
      );
    } else {
      result = {
        ...result,
        state: updateInstance(result.state, visualProxy.id, (instance) => ({
          ...instance,
          contents: {
            ...instance.contents,
            visualState: visualProxyVisualState,
          },
        })),
      };
    }
  }
  const attempt = {
    id: `${currentNode.id}-${actionDefinition.id}-${activeState.attemptHistory.length + 1}`,
    timestamp: timestamp(),
    nodeId: currentNode.id,
    actionId: actionDefinition.id,
    verb: actionDefinition.verb,
    mode: activeState.mode,
    ...attemptScope(activeState),
    success: result.ok,
    message: result.message,
  };

  if (!result.ok) {
    const failedState = transactionalTypedAction
      ? { ...activeState, feedbackQueue: result.state.feedbackQueue }
      : result.state;
    return {
      ...failedState,
      attemptHistory: [...failedState.attemptHistory, attempt],
    };
  }

  const validationEvidence = evaluateNode(currentNode, result.state, normalizedRequest);
  const passed = validationEvidence.every((evidence) => evidence.passed);
  if (runtimeRepeat && !passed) {
    return {
      ...activeState,
      attemptHistory: [...activeState.attemptHistory, { ...attempt, success: false, message: "Post-action validation failed." }],
      feedbackQueue: [
        ...result.state.feedbackQueue,
        feedback("warning", currentNode.feedback.retry, currentNode.id),
      ],
    };
  }
  if (actionDefinition.sourceInventory?.quantityKind === "solid-mass" && !passed) {
    // A first solid-stock initialization is transactional through both its handler and this
    // post-action validation boundary. Do not generalize this rollback: legacy liquid inventory
    // and every other non-repeat action retain their established post-validation behavior.
    return {
      ...activeState,
      // Preserve the current failed-validation diagnostic just as the ordinary post-validation
      // path does, while restoring the physical setup state from before the attempted setup.
      validationEvidence: [
        ...activeState.validationEvidence.filter((evidence) => evidence.nodeId !== currentNode.id),
        ...validationEvidence,
      ],
      attemptHistory: [
        ...activeState.attemptHistory,
        {
          ...attempt,
          success: false,
          message: "Post-action validation failed; solid stock was not initialized.",
        },
      ],
      feedbackQueue: [
        ...activeState.feedbackQueue,
        feedback(
          "warning",
          "This stock configuration did not pass the step validation, so no solid stock was initialized.",
          currentNode.id,
          currentNode.feedback.retry,
        ),
      ],
    };
  }
  const runtimeRepeatComplete = runtimeRepeatExpected === undefined || runtimeRepeatIteration === runtimeRepeatExpected;
  const completedNodes = passed && runtimeRepeatComplete && !result.nextNodeId
    ? Array.from(new Set([...result.state.completedNodes, currentNode.id]))
    : result.state.completedNodes;
  const requestedNext = result.nextNodeId;
  const nextId = requestedNext && passed && process.edges.some(edge => edge.from === currentNode.id && edge.to === requestedNext)
    ? requestedNext
    : runtimeRepeatComplete ? nextNodeId(currentNode.id, process.edges, result.state, passed) : currentNode.id;
  const pendingDispenseDrop =
    !passed &&
    actionDefinition.interaction?.type === "dispenseDrops" &&
    normalizedRequest.parameters?.dispenseMode === "drop";
  const repeatProgress = { ...result.state.repeatProgress };
  if (passed && runtimeRepeat && runtimeRepeatIteration !== undefined && runtimeRepeatExpected !== undefined) {
    const completedIterations = Array.from(new Set([
      ...(repeatProgress[runtimeRepeat.progressId]?.completedIterations ?? []),
      runtimeRepeatIteration,
    ])).sort((left, right) => left - right);
    repeatProgress[runtimeRepeat.progressId] = {
      groupId: runtimeRepeat.progressId,
      completedIterations,
      expectedIterations: runtimeRepeatExpected,
      complete: completedIterations.length >= runtimeRepeatExpected,
      countMeasurementId: runtimeRepeat.countMeasurementId,
      nextIteration: Math.min(runtimeRepeatExpected + 1, completedIterations.length + 1),
      outputMeasurementIds: completedIterations.map((iteration) => `${runtimeRepeat.outputMeasurementId}--${iteration}`),
    };
  }
  if (
    passed &&
    repeatGroupId &&
    Number.isInteger(repeatIteration) &&
    Number.isInteger(repeatExpected) &&
    actionDefinition.parameters.repeatIterationComplete === true
  ) {
    const completedIterations = Array.from(new Set([
      ...(repeatProgress[repeatGroupId]?.completedIterations ?? []),
      repeatIteration,
    ])).sort((left, right) => left - right);
    repeatProgress[repeatGroupId] = {
      groupId: repeatGroupId,
      completedIterations,
      expectedIterations: repeatExpected,
      complete: completedIterations.length >= repeatExpected,
    };
  }

  return {
    ...result.state,
    currentNodeId: nextId ?? result.state.currentNodeId,
    completedNodes,
    repeatProgress,
    validationEvidence: [
      ...result.state.validationEvidence.filter((evidence) => evidence.nodeId !== currentNode.id),
      ...validationEvidence,
    ],
    attemptHistory: [...result.state.attemptHistory, attempt],
    feedbackQueue: pendingDispenseDrop
      ? result.state.feedbackQueue
      : [
          ...result.state.feedbackQueue,
          feedback(passed ? "success" : "warning", passed ? result.message : currentNode.feedback.retry, currentNode.id),
        ],
  };
};
